-- ============================================================
-- Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A
-- Tracking visual do cliente B2B - schema versionado.
--
-- Escopo:
--   - Versionar a base do acompanhamento visual do pedido.
--   - Separar status operacional de status comunicavel ao cliente.
--   - Criar historico visual futuro separado da auditoria interna.
--   - Proteger INSERT de cliente contra manipulacao de campos visuais.
--
-- Nao implementado nesta fase:
--   - Aplicacao do SQL no Supabase.
--   - Frontend cliente/admin.
--   - Dropdown admin.
--   - Leitura cliente de pedido_cliente_eventos.
--   - View sanitizada ou RPC sanitizada.
--   - Automacao.
--
-- Governanca:
--   - Respeita docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md
--   - status_cliente_visual sera a fonte futura do stepper cliente.
--   - status_cliente_excecao representa desvios fora do stepper.
--   - status_cliente_mensagem permite mensagem opcional do admin.
--   - pedido_cliente_eventos fica separado de pedido_eventos.
--
-- Idempotente: pode rodar varias vezes sem efeito cumulativo.
-- Sem DELETE destrutivo, sem dados reais, sem secrets.
-- ============================================================


-- ============================================================
-- 1. Novas colunas em public.pedidos
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS status_cliente_visual         TEXT,
  ADD COLUMN IF NOT EXISTS status_cliente_excecao        TEXT,
  ADD COLUMN IF NOT EXISTS status_cliente_mensagem       TEXT,
  ADD COLUMN IF NOT EXISTS status_cliente_atualizado_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referencia_cliente            TEXT,
  ADD COLUMN IF NOT EXISTS prazo_desejado                DATE,
  ADD COLUMN IF NOT EXISTS tipo_recebimento              TEXT;

COMMENT ON COLUMN public.pedidos.status_cliente_visual
  IS 'Status visual comunicado ao cliente.';
COMMENT ON COLUMN public.pedidos.status_cliente_excecao
  IS 'Excecao visual fora da sequencia principal.';
COMMENT ON COLUMN public.pedidos.status_cliente_mensagem
  IS 'Mensagem opcional publicada pelo admin.';
COMMENT ON COLUMN public.pedidos.status_cliente_atualizado_em
  IS 'Timestamp da ultima alteracao visual publicada.';
COMMENT ON COLUMN public.pedidos.referencia_cliente
  IS 'Referencia comercial opcional informada para o cliente.';
COMMENT ON COLUMN public.pedidos.prazo_desejado
  IS 'Prazo desejado informado no contexto comercial do pedido.';
COMMENT ON COLUMN public.pedidos.tipo_recebimento
  IS 'retirada|entrega';


-- ============================================================
-- 2. Constraints idempotentes em public.pedidos
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pedidos'
      AND con.conname = 'pedidos_status_cliente_visual_check'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_status_cliente_visual_check
      CHECK (
        status_cliente_visual IS NULL
        OR status_cliente_visual IN (
          'recebido',
          'confirmado',
          'insumos',
          'tecelagem',
          'acabamento',
          'expedicao',
          'transporte',
          'concluido'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pedidos'
      AND con.conname = 'pedidos_status_cliente_excecao_check'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_status_cliente_excecao_check
      CHECK (
        status_cliente_excecao IS NULL
        OR status_cliente_excecao IN (
          'aguardando_definicao',
          'aguardando_insumo',
          'pausado',
          'cancelado'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pedidos'
      AND con.conname = 'pedidos_tipo_recebimento_check'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_tipo_recebimento_check
      CHECK (
        tipo_recebimento IS NULL
        OR tipo_recebimento IN ('retirada', 'entrega')
      );
  END IF;
END $$;


-- ============================================================
-- 3. Tabela public.pedido_cliente_eventos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pedido_cliente_eventos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID        NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL,
  titulo          TEXT        NOT NULL,
  mensagem        TEXT,
  origem          TEXT        NOT NULL DEFAULT 'manual',
  visivel_cliente BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata        JSONB,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedido_cliente_eventos
  IS 'Historico visual futuro do pedido comunicado ao cliente.';
COMMENT ON COLUMN public.pedido_cliente_eventos.origem
  IS 'manual|automatico|sistema';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pedido_cliente_eventos'
      AND con.conname = 'pedido_cliente_eventos_origem_check'
  ) THEN
    ALTER TABLE public.pedido_cliente_eventos
      ADD CONSTRAINT pedido_cliente_eventos_origem_check
      CHECK (origem IN ('manual', 'automatico', 'sistema'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedido_cliente_eventos_pedido_criado
  ON public.pedido_cliente_eventos (pedido_id, criado_em DESC);


-- ============================================================
-- 4. RLS em public.pedido_cliente_eventos - admin-only nesta fase
-- ============================================================

ALTER TABLE public.pedido_cliente_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_cliente_eventos_admin_all
  ON public.pedido_cliente_eventos;
CREATE POLICY pedido_cliente_eventos_admin_all
  ON public.pedido_cliente_eventos
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ============================================================
-- 5. Trigger guard de INSERT em public.pedidos
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalizar_pedido_cliente_visual_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_admin() THEN
    IF (
      NEW.status_cliente_visual IS NOT NULL
      OR NEW.status_cliente_excecao IS NOT NULL
      OR NEW.status_cliente_mensagem IS NOT NULL
    ) AND NEW.status_cliente_atualizado_em IS NULL THEN
      NEW.status_cliente_atualizado_em := now();
    END IF;

    RETURN NEW;
  END IF;

  NEW.status_cliente_visual := NULL;
  NEW.status_cliente_excecao := NULL;
  NEW.status_cliente_mensagem := NULL;
  NEW.status_cliente_atualizado_em := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_cliente_visual_insert_guard
  ON public.pedidos;
CREATE TRIGGER pedidos_cliente_visual_insert_guard
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.normalizar_pedido_cliente_visual_insert();


-- ============================================================
-- 6. Trigger de timestamp visual em UPDATE de public.pedidos
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_pedido_cliente_visual_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF
    NEW.status_cliente_visual IS DISTINCT FROM OLD.status_cliente_visual
    OR NEW.status_cliente_excecao IS DISTINCT FROM OLD.status_cliente_excecao
    OR NEW.status_cliente_mensagem IS DISTINCT FROM OLD.status_cliente_mensagem
  THEN
    NEW.status_cliente_atualizado_em := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_cliente_visual_touch
  ON public.pedidos;
CREATE TRIGGER pedidos_cliente_visual_touch
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pedido_cliente_visual_update();


-- ============================================================
-- 7. Comentarios de semantica
-- ============================================================
-- - status_cliente_visual sera a trilha principal futura do stepper.
-- - status_cliente_excecao cobre desvios que nao pertencem ao stepper.
-- - status_cliente_mensagem permite texto opcional publicado pelo admin.
-- - pedido_cliente_eventos e o historico visual futuro, separado de
--   pedido_eventos.
-- - O cliente continua sem policy de leitura em pedido_cliente_eventos
--   nesta fase.
-- - O trigger de INSERT impede que o cliente publique o proprio estado
--   visual usando as policies atuais de INSERT em public.pedidos.
-- - O tracking atual continua derivado de pedidos.status ate fase
--   posterior de frontend.
-- ============================================================


-- ============================================================
-- 8. Reload do schema cache (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
