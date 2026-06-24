-- ============================================================
-- Auth User Disable Schema — suporte a desativação segura
-- ============================================================
-- Fase: RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A
-- Escopo: schema/RLS versionado no repositório.
--         NÃO aplicar neste momento — apenas versionar e validar.
--
-- Design:
--   docs/architecture/AUTH_DELETE_USER_DESIGN.md
--   (RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A)
--
-- Compatibilidade:
--   - A Edge Function `admin-create-user` insere em `public.usuarios`
--     apenas (id, email, nome, tipo, fornecedor_id). O default
--     `ativo = true` garante que usuários novos permaneçam ativos
--     sem necessidade de ajuste na função.
--   - Usuários existentes recebem `ativo = true` automaticamente
--     via DEFAULT.
--   - Funções `is_admin()` e `meu_fornecedor_id()` passam a exigir
--     `ativo is true` (assim usuário desativado perde privilégios
--     operacionais imediatamente, sem precisar banir Auth).
--
-- Não implementado nesta fase:
--   - Edge Function `admin-disable-user` (próxima fase).
--   - UI de desativação.
--   - Ban/desativação no Supabase Auth.
--   - Aplicação deste SQL no Supabase staging.
--
-- Idempotente: pode rodar várias vezes sem efeito cumulativo.
-- Sem DELETE, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Novas colunas em public.usuarios
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ativo             BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS desativado_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS desativado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_desativacao TEXT;

-- Comentários para deixar o schema legível no PostgREST / psql
COMMENT ON COLUMN public.usuarios.ativo               IS 'FALSE quando o usuário foi desativado. DEFAULT TRUE preserva usuários existentes.';
COMMENT ON COLUMN public.usuarios.desativado_em       IS 'Timestamp da desativação. NULL enquanto o usuário está ativo.';
COMMENT ON COLUMN public.usuarios.desativado_por      IS 'UUID do admin (auth.users) que executou a desativação. NULL enquanto o usuário está ativo.';
COMMENT ON COLUMN public.usuarios.motivo_desativacao  IS 'Motivo registrado no momento da desativação (texto livre).';


-- ============================================================
-- 2. Recriar funções auxiliares para respeitar `ativo is true`
-- ============================================================
-- A assinatura real em produção é plpgsql com EXCEPTION handling
-- (ver db/05_fix_pgrst.sql). Preservamos essa assinatura para não
-- divergir do schema aplicado em staging/produção.

-- 2.1 is_admin() — exige admin ATIVO
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_tipo TEXT;
  v_ativo BOOLEAN;
BEGIN
  SELECT tipo, ativo INTO v_tipo, v_ativo
  FROM public.usuarios
  WHERE id = auth.uid();
  RETURN COALESCE(v_tipo = 'admin' AND v_ativo IS TRUE, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 2.2 meu_fornecedor_id() — só retorna fornecedor_id se usuário ATIVO
-- e do tipo 'fornecedor'. Mantém a mesma assinatura de retorno
-- (BIGINT ou NULL) usada por db/02_functions.sql e db/05_fix_pgrst.sql.
CREATE OR REPLACE FUNCTION public.meu_fornecedor_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_id    BIGINT;
  v_tipo  TEXT;
  v_ativo BOOLEAN;
BEGIN
  SELECT fornecedor_id, tipo, ativo
    INTO v_id, v_tipo, v_ativo
  FROM public.usuarios
  WHERE id = auth.uid();
  IF v_ativo IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  IF v_tipo <> 'fornecedor' THEN
    RETURN NULL;
  END IF;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Garantir GRANTs das funções para os roles que já as usavam
-- (idempotente; sem efeito se já estiverem concedidos)
GRANT EXECUTE ON FUNCTION public.is_admin()          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meu_fornecedor_id() TO anon, authenticated;


-- ============================================================
-- 3. Policies de public.usuarios ajustadas para `ativo is true`
-- ============================================================
-- Lemos as policies existentes em db/03_policies.sql:
--   - usuarios_select       (SELECT — próprio OU admin)
--   - usuarios_admin_all    (ALL   — admin)
--   - usuarios_self_update  (UPDATE — próprio, mantendo tipo)
--
-- Política adotada:
--   - Admin ATIVO vê e gerencia todos (incluindo inativos, para
--     auditoria e reativação futura).
--   - Usuário ATIVO lê o próprio perfil.
--   - Usuário inativo perde auto-leitura operacional — `loadCurrentUser`
--     não vai mais conseguir carregar o perfil via
--     `auth.uid() = id AND ativo is true`. Isso é intencional:
--     o app interpretará como "não logado" e redireciona para
--     #/login, fechando o caminho do Auth órfão (parcialmente,
--     complementado depois por ban Auth server-side).
--   - Self-update permanece para usuário ativo.
--   - A SELECT de admin **não** filtra por ativo, para permitir
--     auditoria de quem foi desativado e por quem.

-- 3.1 SELECT — usuário ativo lê o próprio perfil; admin lê todos
DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT
  USING (
    (id = auth.uid() AND ativo IS TRUE)
    OR public.is_admin()
  );

-- 3.2 ALL (admin) — admin pode inserir/atualizar/deletar (delete só
--     continua a ser `delete` de public.usuarios; a desativação
--     lógica via UPDATE é a forma esperada após esta fase).
DROP POLICY IF EXISTS usuarios_admin_all ON public.usuarios;
CREATE POLICY usuarios_admin_all ON public.usuarios
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.3 UPDATE próprio — usuário ativo pode atualizar o próprio perfil,
--     sem trocar o próprio tipo. A checagem de `ativo` é redundante
--     (a sessão do user ativo já está acima), mas reforça a intenção.
DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;
CREATE POLICY usuarios_self_update ON public.usuarios
  FOR UPDATE
  USING (id = auth.uid() AND ativo IS TRUE)
  WITH CHECK (
    id = auth.uid()
    AND ativo IS TRUE
    AND tipo = (SELECT tipo FROM public.usuarios WHERE id = auth.uid())
  );


-- ============================================================
-- 4. Comentários sobre semântica aplicada
-- ============================================================
-- - is_admin() considera apenas usuário ATIVO. Usuário desativado
--   deixa de satisfazer policies admin-only, perdendo acesso
--   operacional imediatamente.
-- - meu_fornecedor_id() retorna NULL para usuário inativo. As
--   policies que dependem de `fornecedor_id = meu_fornecedor_id()`
--   (ops_fornecedor_read, ops_read, ocf_fornecedor_*, entregas_*)
--   passam a negar o acesso implicitamente.
-- - A SELECT do próprio perfil exige `ativo IS TRUE`. O efeito
--   esperado: ao desativar, o app deixa de carregar o perfil
--   (`loadCurrentUser` retorna null) e redireciona para #/login.
--   Este comportamento será consolidado pela Edge Function
--   `admin-disable-user` em fase posterior, com ban Auth.
-- ============================================================


-- ============================================================
-- 5. Reload do schema cache (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
