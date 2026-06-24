-- ============================================================
-- Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1
-- Perfil autenticado de cliente — schema/RLS versionado.
--
-- Design:
--   - Cria a base segura para o perfil de cliente autenticado.
--   - Adiciona role `cliente` ao tipo de usuário.
--   - Vincula `usuarios.cliente_id` → `public.clientes(id)`.
--   - Cria função `meu_cliente_id()` (SECURITY DEFINER, STABLE).
--   - Adiciona policies mínimas para cliente criar e consultar
--     seus próprios pedidos/itens.
--   - NÃO libera UPDATE/DELETE de cliente nesta fase.
--   - NÃO expõe token público.
--   - NÃO cria policy anon.
--   - `pedido_eventos` permanece admin-only (auditoria interna).
--
-- Compatibilidade:
--   - `clientes.id` existe (db/09_fase6_cliente_lote.sql) → BIGSERIAL.
--   - `pedidos` e `pedido_itens` existem (db/13_pedidos_schema.sql).
--   - `is_admin()` já exige `ativo IS TRUE` (db/12_auth_user_disable_schema.sql).
--   - `meu_fornecedor_id()` já exige `tipo = 'fornecedor' AND ativo IS TRUE`
--     (db/12_auth_user_disable_schema.sql).
--
-- Não implementado nesta fase:
--   - UPDATE/DELETE de cliente em pedidos/pedido_itens.
--   - Criação de usuário cliente.
--   - Token público (rota pública, anon).
--   - Edge Function.
--   - Frontend de cliente.
--   - Aplicação deste SQL no Supabase.
--
-- Idempotente: pode rodar várias vezes sem efeito cumulativo.
-- Sem DELETE destrutivo, sem dados reais, sem secrets.
-- Sem alterar migrations antigas, sem tocar frontend, sem tocar Edge Functions.
-- ============================================================


-- ============================================================
-- 1. Atualizar CHECK constraint de usuarios.tipo para aceitar 'cliente'
-- ============================================================

-- A constraint original (db/01_schema.sql) é inline e não tem nome
-- previsível. Usamos DO block para localizar e dropar dinamicamente.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'usuarios'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%tipo%'
    AND pg_get_constraintdef(con.oid) LIKE '%admin%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS ' || v_constraint_name;
  END IF;
END $$;

-- Agora recria a constraint com nome controlado, aceitando 'cliente'.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('admin', 'fornecedor', 'cliente'));

COMMENT ON CONSTRAINT usuarios_tipo_check ON public.usuarios IS 'admin|fornecedor|cliente — sem anon, sem public.';


-- ============================================================
-- 2. Adicionar usuarios.cliente_id (FK → public.clientes)
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS cliente_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'usuarios'
      AND con.contype = 'f'
      AND con.conname = 'usuarios_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.usuarios.cliente_id IS 'Cliente vinculado ao usuário. Preenchido apenas para tipo=cliente.';


-- ============================================================
-- 3. Constraint de vínculo exclusivo entre admin/fornecedor/cliente
-- ============================================================
-- Regra:
--   admin:      fornecedor_id IS NULL AND cliente_id IS NULL
--   fornecedor: fornecedor_id IS NOT NULL AND cliente_id IS NULL
--   cliente:    fornecedor_id IS NULL AND cliente_id IS NOT NULL
--
-- Ou seja: nunca ambas colunas preenchidas simultaneamente.

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_vinculo_exclusivo_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_vinculo_exclusivo_check CHECK (
    (tipo = 'admin'       AND fornecedor_id IS NULL     AND cliente_id IS NULL) OR
    (tipo = 'fornecedor'  AND fornecedor_id IS NOT NULL AND cliente_id IS NULL) OR
    (tipo = 'cliente'     AND fornecedor_id IS NULL     AND cliente_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT usuarios_vinculo_exclusivo_check ON public.usuarios
  IS 'Garante que admin não tem vínculo, fornecedor só tem fornecedor_id e cliente só tem cliente_id.';


-- ============================================================
-- 4. Função meu_cliente_id()
-- ============================================================
-- Retorna o cliente_id do usuário logado, se e somente se:
--   - auth.uid() tem linha em public.usuarios;
--   - tipo = 'cliente';
--   - ativo IS TRUE;
--   - cliente_id IS NOT NULL.
-- Retorna NULL nos demais casos, inclusive em erro.

CREATE OR REPLACE FUNCTION public.meu_cliente_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_cliente_id BIGINT;
  v_tipo       TEXT;
  v_ativo      BOOLEAN;
BEGIN
  SELECT cliente_id, tipo, ativo
    INTO v_cliente_id, v_tipo, v_ativo
  FROM public.usuarios
  WHERE id = auth.uid();

  IF v_ativo IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF v_tipo <> 'cliente' THEN
    RETURN NULL;
  END IF;

  IF v_cliente_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_cliente_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.meu_cliente_id() TO anon, authenticated;

COMMENT ON FUNCTION public.meu_cliente_id() IS 'Retorna cliente_id do usuário logado se tipo=cliente AND ativo=true. NULL caso contrário. SECURITY DEFINER.';


-- ============================================================
-- 5. RLS em clientes
-- ============================================================
-- Policy admin existente: clientes_admin (db/09_fase6_cliente_lote.sql)
-- Adicionar: cliente SELECT do próprio cadastro.

DROP POLICY IF EXISTS clientes_cliente_select ON public.clientes;
CREATE POLICY clientes_cliente_select ON public.clientes
  FOR SELECT
  USING (id = public.meu_cliente_id());


-- ============================================================
-- 6. RLS em pedidos
-- ============================================================
-- Policy admin existente: pedidos_admin_all (db/13_pedidos_schema.sql)
-- Adicionar: cliente SELECT + INSERT.
-- NÃO adicionar UPDATE / DELETE de cliente nesta fase.

-- 6.1 SELECT — cliente vê apenas pedidos cujo cliente_id = meu_cliente_id()
DROP POLICY IF EXISTS pedidos_cliente_select ON public.pedidos;
CREATE POLICY pedidos_cliente_select ON public.pedidos
  FOR SELECT
  USING (cliente_id = public.meu_cliente_id());

-- 6.2 INSERT — cliente cria pedido apenas como próprio e em status editável
DROP POLICY IF EXISTS pedidos_cliente_insert ON public.pedidos;
CREATE POLICY pedidos_cliente_insert ON public.pedidos
  FOR INSERT
  WITH CHECK (
    cliente_id = public.meu_cliente_id()
    AND status IN ('rascunho', 'recebido')
  );

-- NÃO há pedidos_cliente_update nesta fase.
-- NÃO há pedidos_cliente_delete nesta fase.


-- ============================================================
-- 7. RLS em pedido_itens
-- ============================================================
-- Policy admin existente: pedido_itens_admin_all (db/13_pedidos_schema.sql)
-- Adicionar: cliente SELECT + INSERT.
-- NÃO adicionar UPDATE / DELETE de cliente nesta fase.

-- 7.1 SELECT — cliente vê itens de pedidos próprios
DROP POLICY IF EXISTS pedido_itens_cliente_select ON public.pedido_itens;
CREATE POLICY pedido_itens_cliente_select ON public.pedido_itens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos
      WHERE pedidos.id = pedido_itens.pedido_id
        AND pedidos.cliente_id = public.meu_cliente_id()
    )
  );

-- 7.2 INSERT — cliente insere item apenas se dono do pedido e status editável
DROP POLICY IF EXISTS pedido_itens_cliente_insert ON public.pedido_itens;
CREATE POLICY pedido_itens_cliente_insert ON public.pedido_itens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pedidos
      WHERE pedidos.id = pedido_itens.pedido_id
        AND pedidos.cliente_id = public.meu_cliente_id()
        AND pedidos.status IN ('rascunho', 'recebido')
    )
  );

-- NÃO há pedido_itens_cliente_update nesta fase.
-- NÃO há pedido_itens_cliente_delete nesta fase.


-- ============================================================
-- 8. pedido_eventos — continua admin-only
-- ============================================================
-- pedido_eventos: auditoria interna. Nenhuma policy de cliente é criada.

-- Comentário explícito no SQL:
-- pedido_eventos_admin_all (db/13_pedidos_schema.sql) permanece a única policy.
-- Cliente NÃO pode consultar, inserir, atualizar ou deletar pedido_eventos.
-- Eventos continuam sendo registros internos de auditoria, visíveis apenas para admin.


-- ============================================================
-- 9. Token público — NÃO exposto nesta fase
-- ============================================================
-- NÃO há policy por token_acesso.
-- NÃO há acesso anon para clientes/usuarios/pedidos/pedido_itens/pedido_eventos.
-- NÃO há rota pública.
-- O campo token_acesso existe na tabela pedidos (db/13_pedidos_schema.sql)
-- para uso futuro com Edge Function sanitizada, NÃO via RLS direta.


-- ============================================================
-- 10. Comentários sobre semântica
-- ============================================================
-- - O perfil de cliente é o terceiro tipo de usuário do sistema.
-- - Cliente autenticado pode ver o próprio cadastro (clientes) e seus pedidos/itens.
-- - Cliente pode criar pedidos como rascunho ou recebido (MVP: o admin ainda
--   precisará revisar/confirmar o pedido antes de programar produção).
-- - UPDATE/DELETE de cliente em pedidos/pedido_itens não são liberados nesta fase
--   porque exigem controle mais fino de colunas e transições de status.
-- - pedido_eventos permanece admin-only: são registros internos de auditoria.
-- - NÃO há token público, NÃO há acesso anon, NÃO há rota pública.
-- - A função meu_cliente_id() é SECURITY DEFINER e retorna NULL para qualquer
--   caso que não seja um cliente ativo autenticado — incluindo erros.
-- - Todas as policies de cliente dependem de meu_cliente_id(), que por sua vez
--   depende de auth.uid() (usuário autenticado). Sem autenticação, o cliente
--   não acessa nada.
-- ============================================================


-- ============================================================
-- 11. Reload do schema cache (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
