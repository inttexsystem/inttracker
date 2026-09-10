-- =====================================================================
-- db/130 - Pedido-item finishing applicability foundation
--
-- Extends the canonical public.pedido_itens owner. Existing rows remain
-- unresolved (NULL); only newly created compatible items receive the
-- model-derived default. Existing Pedido writers remain the only mutation
-- boundary and every established/change decision is auditable.
-- =====================================================================

BEGIN;

DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.pedido_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_itens'); END IF;
  IF to_regclass('public.op_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.op_itens'); END IF;
  IF to_regclass('public.tecelagem_rolos') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.tecelagem_rolos'); END IF;
  IF to_regclass('public.pedido_alteracao_solicitacao_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_alteracao_solicitacao_itens'); END IF;
  IF to_regprocedure('public.pedido_itens_payload_normalizar(uuid,jsonb)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.pedido_itens_payload_normalizar(uuid,jsonb)'); END IF;
  IF to_regprocedure('public.pedido_itens_reconciliar(uuid,jsonb)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.pedido_itens_reconciliar(uuid,jsonb)'); END IF;
  IF to_regprocedure('public.pedido_item_tem_vinculo_producao(uuid)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.pedido_item_tem_vinculo_producao(uuid)'); END IF;
  IF to_regprocedure('public.criar_pedido_admin(jsonb,jsonb,jsonb)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.criar_pedido_admin(jsonb,jsonb,jsonb)'); END IF;
  IF to_regprocedure('public.criar_pedido_cliente(jsonb,jsonb,jsonb)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.criar_pedido_cliente(jsonb,jsonb,jsonb)'); END IF;
  IF to_regprocedure('public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)'); END IF;
  IF to_regprocedure('public.aprovar_alteracao_pedido(uuid,boolean,text)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.aprovar_alteracao_pedido(uuid,boolean,text)'); END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/130 gate: missing prerequisite(s): %', array_to_string(v_missing, ', ');
  END IF;
END;
$gate$;

-- ---------------------------------------------------------------------
-- 1. Canonical item state. NULL is deliberately transitional.
-- ---------------------------------------------------------------------
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS requires_finishing BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_finishing_origin TEXT,
  ADD COLUMN IF NOT EXISTS requires_finishing_revision BIGINT NOT NULL DEFAULT 0;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedido_itens'::regclass
       AND conname = 'pedido_itens_requires_finishing_state_chk'
  ) THEN
    ALTER TABLE public.pedido_itens
      ADD CONSTRAINT pedido_itens_requires_finishing_state_chk CHECK (
        (requires_finishing IS NULL
          AND requires_finishing_origin IS NULL
          AND requires_finishing_revision = 0)
        OR
        (requires_finishing IS NOT NULL
          AND requires_finishing_origin IN ('MODEL_DEFAULT', 'EXPLICIT_HUMAN', 'CORRECTION')
          AND requires_finishing_revision > 0)
      );
  END IF;
END;
$constraints$;

COMMENT ON COLUMN public.pedido_itens.requires_finishing IS
  'Canonical item-level finishing applicability. TRUE=ACABADO applicable; FALSE=ACABADO NOT APPLICABLE; NULL=historically unresolved transition state. FALSE is never numeric completion.';
COMMENT ON COLUMN public.pedido_itens.requires_finishing_origin IS
  'MODEL_DEFAULT | EXPLICIT_HUMAN | CORRECTION. NULL only while the historical item remains unresolved.';
COMMENT ON COLUMN public.pedido_itens.requires_finishing_revision IS
  'Monotonic item-level applicability revision. Zero only while unresolved.';

-- ---------------------------------------------------------------------
-- 2. Append-only applicability audit.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_item_applicability_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           UUID NOT NULL,
  pedido_item_id      UUID NOT NULL,
  previous_value      BOOLEAN,
  new_value           BOOLEAN NOT NULL,
  previous_origin     TEXT,
  new_origin          TEXT NOT NULL CHECK (new_origin IN ('MODEL_DEFAULT', 'EXPLICIT_HUMAN', 'CORRECTION')),
  applicability_revision BIGINT NOT NULL CHECK (applicability_revision > 0),
  actor_id            UUID,
  process             TEXT NOT NULL,
  reason              TEXT,
  command_id          UUID NOT NULL,
  command_hash        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pedido_item_id, applicability_revision),
  UNIQUE (command_id, pedido_item_id)
);

ALTER TABLE public.pedido_item_applicability_events
  ADD COLUMN IF NOT EXISTS command_hash TEXT;

DO $applicability_command_hash_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedido_item_applicability_events'::regclass
       AND conname = 'pedido_item_applicability_events_command_hash_chk'
  ) THEN
    ALTER TABLE public.pedido_item_applicability_events
      ADD CONSTRAINT pedido_item_applicability_events_command_hash_chk
      CHECK (command_hash IS NULL OR command_hash ~ '^[0-9a-f]{64}$');
  END IF;
END;
$applicability_command_hash_constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS pedido_item_applicability_events_command_uidx
  ON public.pedido_item_applicability_events (command_id)
  WHERE command_hash IS NOT NULL;

-- Audit evidence outlives mutable Pedido/item rows. A previous local candidate
-- used a cascading FK here; drop it on replay so deletion can neither erase
-- history nor be blocked by the immutable-history trigger.
ALTER TABLE public.pedido_item_applicability_events
  DROP CONSTRAINT IF EXISTS pedido_item_applicability_events_pedido_id_fkey;

CREATE INDEX IF NOT EXISTS pedido_item_applicability_events_pedido_idx
  ON public.pedido_item_applicability_events (pedido_id, created_at DESC);

ALTER TABLE public.pedido_item_applicability_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedido_item_applicability_events_admin_select
  ON public.pedido_item_applicability_events;
CREATE POLICY pedido_item_applicability_events_admin_select
  ON public.pedido_item_applicability_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.pedido_item_applicability_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pedido_item_applicability_events TO authenticated;

CREATE OR REPLACE FUNCTION public.pedido_item_applicability_events_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'PEDIDO_ITEM_APPLICABILITY_AUDIT_IMMUTABLE: audit events cannot be updated or deleted'
    USING ERRCODE = '55000';
END;
$$;

ALTER FUNCTION public.pedido_item_applicability_events_immutable_fn() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_item_applicability_events_immutable_fn()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS pedido_item_applicability_events_immutable
  ON public.pedido_item_applicability_events;
CREATE TRIGGER pedido_item_applicability_events_immutable
  BEFORE UPDATE OR DELETE ON public.pedido_item_applicability_events
  FOR EACH ROW EXECUTE FUNCTION public.pedido_item_applicability_events_immutable_fn();

-- ---------------------------------------------------------------------
-- 3. Default and guarded state transition mechanics.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_item_requires_finishing_default(p_modelo_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  SELECT m.tipo_produto INTO v_tipo
    FROM public.modelos m
   WHERE m.id = p_modelo_id;
  IF NOT FOUND OR v_tipo NOT IN ('tapete', 'manta') THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_MODEL_INVALID: modelo % has no compatible product type', p_modelo_id
      USING ERRCODE = '23514';
  END IF;
  RETURN v_tipo = 'tapete';
END;
$$;

ALTER FUNCTION public.pedido_item_requires_finishing_default(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_item_requires_finishing_default(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pedido_item_applicability_prepare_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Canonical Pedido writers and the dedicated correction command execute as
  -- their non-assumable postgres owner. Application DML retains its effective
  -- authenticated role, so caller-controlled settings cannot confer authority.
  v_writer BOOLEAN := CURRENT_USER = 'postgres';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requires_finishing IS NULL THEN
      NEW.requires_finishing := public.pedido_item_requires_finishing_default(NEW.modelo_id);
      NEW.requires_finishing_origin := 'MODEL_DEFAULT';
      NEW.requires_finishing_revision := 1;
    ELSE
      IF NOT v_writer THEN
        RAISE EXCEPTION 'PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN: use a canonical Pedido writer'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.requires_finishing_origin NOT IN ('MODEL_DEFAULT', 'EXPLICIT_HUMAN', 'CORRECTION') THEN
        RAISE EXCEPTION 'PEDIDO_ITEM_APPLICABILITY_ORIGIN_INVALID'
          USING ERRCODE = '23514';
      END IF;
      NEW.requires_finishing_revision := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.requires_finishing IS NOT DISTINCT FROM OLD.requires_finishing
     AND NEW.requires_finishing_origin IS NOT DISTINCT FROM OLD.requires_finishing_origin THEN
    NEW.requires_finishing_revision := OLD.requires_finishing_revision;
    RETURN NEW;
  END IF;

  IF NOT v_writer THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN: use a canonical Pedido writer'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.requires_finishing IS NULL
     OR NEW.requires_finishing_origin NOT IN ('MODEL_DEFAULT', 'EXPLICIT_HUMAN', 'CORRECTION') THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_APPLICABILITY_STATE_INVALID'
      USING ERRCODE = '23514';
  END IF;

  NEW.requires_finishing_revision := OLD.requires_finishing_revision + 1;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.pedido_item_applicability_prepare_fn() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_item_applicability_prepare_fn()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS pedido_item_applicability_prepare ON public.pedido_itens;
CREATE TRIGGER pedido_item_applicability_prepare
  BEFORE INSERT OR UPDATE OF requires_finishing, requires_finishing_origin, modelo_id
  ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.pedido_item_applicability_prepare_fn();

CREATE OR REPLACE FUNCTION public.pedido_item_applicability_audit_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_command UUID;
  v_process TEXT;
  v_reason  TEXT;
  v_command_hash TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.requires_finishing IS NOT DISTINCT FROM OLD.requires_finishing
     AND NEW.requires_finishing_origin IS NOT DISTINCT FROM OLD.requires_finishing_origin THEN
    RETURN NEW;
  END IF;

  v_command := COALESCE(
    NULLIF(current_setting('app.traceability_command_id', true), '')::UUID,
    gen_random_uuid());
  v_process := COALESCE(
    NULLIF(current_setting('app.traceability_process', true), ''),
    CASE WHEN TG_OP = 'INSERT' THEN 'COMPATIBLE_ITEM_INSERT' ELSE 'CANONICAL_PEDIDO_WRITER' END);
  v_reason := NULLIF(current_setting('app.traceability_reason', true), '');
  v_command_hash := NULLIF(current_setting('app.traceability_command_hash', true), '');

  INSERT INTO public.pedido_item_applicability_events (
    pedido_id, pedido_item_id, previous_value, new_value,
    previous_origin, new_origin, applicability_revision,
    actor_id, process, reason, command_id, command_hash)
  VALUES (
    NEW.pedido_id, NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.requires_finishing ELSE NULL END,
    NEW.requires_finishing,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.requires_finishing_origin ELSE NULL END,
    NEW.requires_finishing_origin, NEW.requires_finishing_revision,
    auth.uid(), v_process, v_reason, v_command, v_command_hash);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.pedido_item_applicability_audit_fn() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_item_applicability_audit_fn()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS pedido_item_applicability_audit ON public.pedido_itens;
CREATE TRIGGER pedido_item_applicability_audit
  AFTER INSERT OR UPDATE OF requires_finishing, requires_finishing_origin
  ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.pedido_item_applicability_audit_fn();

-- ---------------------------------------------------------------------
-- 4. Existing canonical payload normalization and reconciliation.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_itens_payload_normalizar(p_pedido_id UUID, p_itens JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out       JSONB := '[]'::jsonb;
  v_row       JSONB;
  v_idx       INTEGER := 0;
  v_item_id   UUID;
  v_modelo    BIGINT;
  v_metros    NUMERIC;
  v_requires  BOOLEAN;
  v_origin    TEXT;
  v_current_requires BOOLEAN;
  v_current_origin   TEXT;
  v_explicit  BOOLEAN;
  v_reason    TEXT;
  v_seen      UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: a colecao de itens deve ser um array JSON'
      USING ERRCODE = '22004';
  END IF;
  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: o Pedido deve manter ao menos um item'
      USING ERRCODE = '23514';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_item_id := NULLIF(v_row->>'pedido_item_id', '')::UUID;
    v_modelo  := NULLIF(v_row->>'modelo_id', '')::BIGINT;
    v_metros  := NULLIF(v_row->>'metros', '')::NUMERIC;
    v_explicit := v_row ? 'requires_finishing';
    v_reason := NULLIF(btrim(COALESCE(v_row->>'requires_finishing_reason', '')), '');

    IF v_modelo IS NULL THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item na posicao % sem modelo_id', v_idx
        USING ERRCODE = '22004';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.modelos WHERE id = v_modelo) THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: modelo_id % inexistente', v_modelo
        USING ERRCODE = '23503';
    END IF;
    IF v_metros IS NULL OR v_metros <= 0 THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item na posicao % com metros invalido', v_idx
        USING ERRCODE = '23514';
    END IF;
    IF v_explicit AND jsonb_typeof(v_row->'requires_finishing') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_INVALID: requires_finishing must be a JSON boolean'
        USING ERRCODE = '22023';
    END IF;

    v_current_requires := NULL;
    v_current_origin := NULL;
    IF v_item_id IS NOT NULL THEN
      SELECT pi.requires_finishing, pi.requires_finishing_origin
        INTO v_current_requires, v_current_origin
        FROM public.pedido_itens pi
       WHERE pi.id = v_item_id AND pi.pedido_id = p_pedido_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item % nao pertence a este Pedido', v_item_id
          USING ERRCODE = '23514';
      END IF;
      IF v_item_id = ANY (v_seen) THEN
        RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item % informado mais de uma vez', v_item_id
          USING ERRCODE = '23514';
      END IF;
      v_seen := v_seen || v_item_id;
    END IF;

    IF v_explicit THEN
      v_requires := (v_row->>'requires_finishing')::BOOLEAN;
      IF v_item_id IS NULL THEN
        v_origin := 'EXPLICIT_HUMAN';
      ELSE
        IF v_current_requires IS NULL OR v_requires IS DISTINCT FROM v_current_requires THEN
          IF public.pedido_item_tem_vinculo_producao(v_item_id) THEN
            RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_PRODUCTION_EVIDENCE_DEDICATED_COMMAND_REQUIRED'
              USING ERRCODE = '23514';
          END IF;
          RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_DEDICATED_COMMAND_REQUIRED'
            USING ERRCODE = '42501';
        END IF;
        v_requires := v_current_requires;
        v_origin := v_current_origin;
      END IF;
    ELSIF v_item_id IS NULL THEN
      v_requires := public.pedido_item_requires_finishing_default(v_modelo);
      v_origin := 'MODEL_DEFAULT';
    ELSE
      v_requires := v_current_requires;
      v_origin := v_current_origin;
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'pedido_item_id', v_item_id,
      'modelo_id', v_modelo,
      'metros', v_metros,
      'largura', NULLIF(v_row->>'largura','')::NUMERIC,
      'observacao', NULLIF(btrim(COALESCE(v_row->>'observacao','')), ''),
      'ordem', v_idx,
      'requires_finishing', v_requires,
      'requires_finishing_origin', v_origin,
      'requires_finishing_explicit', v_explicit,
      'requires_finishing_reason', v_reason));
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_out;
END;
$$;

ALTER FUNCTION public.pedido_itens_payload_normalizar(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_itens_payload_normalizar(UUID, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pedido_itens_reconciliar(p_pedido_id UUID, p_itens JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      JSONB;
  v_id       UUID;
  v_manter   UUID[] := ARRAY[]::UUID[];
  v_remover  UUID;
  v_command  UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('app.traceability_process', 'pedido_itens_reconciliar', true);
  PERFORM set_config('app.traceability_command_id', v_command::TEXT, true);
  PERFORM set_config('app.traceability_command_hash', '', true);

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
    IF v_id IS NOT NULL THEN v_manter := v_manter || v_id; END IF;
  END LOOP;

  FOR v_remover IN
    SELECT pi.id FROM public.pedido_itens pi
     WHERE pi.pedido_id = p_pedido_id
       AND NOT (pi.id = ANY (v_manter))
  LOOP
    IF public.pedido_item_tem_vinculo_producao(v_remover) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item % ja esta vinculado a producao, expedicao ou entrega parcial e nao pode ser removido; a reconciliacao de producao e um fluxo proprio', v_remover
        USING ERRCODE = '23514';
    END IF;
    DELETE FROM public.pedido_itens WHERE id = v_remover;
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
    PERFORM set_config('app.traceability_reason', COALESCE(v_row->>'requires_finishing_reason', ''), true);
    IF v_id IS NULL THEN
      INSERT INTO public.pedido_itens (
        pedido_id, modelo_id, metros, largura, observacao, ordem,
        requires_finishing, requires_finishing_origin)
      VALUES (
        p_pedido_id,
        (v_row->>'modelo_id')::BIGINT,
        (v_row->>'metros')::NUMERIC,
        NULLIF(v_row->>'largura','')::NUMERIC,
        NULLIF(v_row->>'observacao',''),
        (v_row->>'ordem')::INTEGER,
        (v_row->>'requires_finishing')::BOOLEAN,
        v_row->>'requires_finishing_origin');
    ELSE
      UPDATE public.pedido_itens
         SET modelo_id  = (v_row->>'modelo_id')::BIGINT,
             metros     = (v_row->>'metros')::NUMERIC,
             largura    = NULLIF(v_row->>'largura','')::NUMERIC,
             observacao = NULLIF(v_row->>'observacao',''),
             ordem      = (v_row->>'ordem')::INTEGER,
             requires_finishing = NULLIF(v_row->>'requires_finishing','')::BOOLEAN,
             requires_finishing_origin = NULLIF(v_row->>'requires_finishing_origin','')
       WHERE id = v_id AND pedido_id = p_pedido_id;
    END IF;
  END LOOP;

  PERFORM set_config('app.traceability_reason', '', true);
  PERFORM public.recalcular_pedido_metros_total(p_pedido_id);
END;
$$;

ALTER FUNCTION public.pedido_itens_reconciliar(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_itens_reconciliar(UUID, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Dedicated governed correction authority for established state.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_requires_finishing_pedido_item(
  p_pedido_item_id UUID,
  p_requires_finishing BOOLEAN,
  p_expected_revision BIGINT,
  p_command_id UUID,
  p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_item public.pedido_itens%ROWTYPE;
  v_event public.pedido_item_applicability_events%ROWTYPE;
  v_pedido_id UUID;
  v_reason TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  v_hash TEXT;
  v_origin TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_FORBIDDEN: admin authentication required'
      USING ERRCODE = '42501';
  END IF;
  IF p_pedido_item_id IS NULL OR p_requires_finishing IS NULL
     OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_command_id IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_COMMAND_INVALID: item, value, expected revision, command UUID and reason are required'
      USING ERRCODE = '22023';
  END IF;

  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'operation', 'DEFINE_REQUIRES_FINISHING',
      'pedido_item_id', p_pedido_item_id,
      'requires_finishing', p_requires_finishing,
      'expected_revision', p_expected_revision,
      'reason', v_reason)::TEXT,
    'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_event
    FROM public.pedido_item_applicability_events
   WHERE command_id = p_command_id
   ORDER BY created_at
   LIMIT 1;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_COMMAND_CONFLICT: command_id reused with different intent'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'pedido_id', v_event.pedido_id,
      'pedido_item_id', v_event.pedido_item_id,
      'requires_finishing', v_event.new_value,
      'origin', v_event.new_origin,
      'revision', v_event.applicability_revision);
  END IF;

  SELECT pi.pedido_id INTO v_pedido_id
    FROM public.pedido_itens pi
   WHERE pi.id = p_pedido_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_ITEM_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM p.id FROM public.pedidos p WHERE p.id = v_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_PEDIDO_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_item
    FROM public.pedido_itens pi
   WHERE pi.id = p_pedido_item_id AND pi.pedido_id = v_pedido_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_ITEM_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  -- Required after the stable Pedido/item lock: a concurrent identical caller
  -- may have committed while this backend was waiting.
  SELECT * INTO v_event
    FROM public.pedido_item_applicability_events
   WHERE command_id = p_command_id
   ORDER BY created_at
   LIMIT 1;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_COMMAND_CONFLICT: command_id reused with different intent'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'pedido_id', v_event.pedido_id,
      'pedido_item_id', v_event.pedido_item_id,
      'requires_finishing', v_event.new_value,
      'origin', v_event.new_origin,
      'revision', v_event.applicability_revision);
  END IF;

  IF v_item.requires_finishing_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_STALE_REVISION: expected %, current %',
      p_expected_revision, v_item.requires_finishing_revision
      USING ERRCODE = '40001';
  END IF;
  IF v_item.requires_finishing IS NOT DISTINCT FROM p_requires_finishing
     AND v_item.requires_finishing_origin IN ('EXPLICIT_HUMAN', 'CORRECTION') THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_ALREADY_ESTABLISHED'
      USING ERRCODE = '23505';
  END IF;

  IF NOT p_requires_finishing AND EXISTS (
    SELECT 1
      FROM public.op_itens oi
      JOIN public.tecelagem_rolos tr ON tr.op_item_id = oi.id
     WHERE oi.pedido_item_id = p_pedido_item_id
       AND tr.situacao = 'enviado_acabamento'
  ) THEN
    RAISE EXCEPTION 'PEDIDO_ITEM_REQUIRES_FINISHING_DOWNSTREAM_FINISHING_EVIDENCE_CONFLICT'
      USING ERRCODE = '23514';
  END IF;

  v_origin := CASE
    WHEN v_item.requires_finishing IS NULL OR v_item.requires_finishing_origin = 'MODEL_DEFAULT'
      THEN 'EXPLICIT_HUMAN'
    ELSE 'CORRECTION'
  END;

  PERFORM set_config('app.traceability_process', 'definir_requires_finishing_pedido_item', true);
  PERFORM set_config('app.traceability_command_id', p_command_id::TEXT, true);
  PERFORM set_config('app.traceability_command_hash', v_hash, true);
  PERFORM set_config('app.traceability_reason', v_reason, true);

  UPDATE public.pedido_itens
     SET requires_finishing = p_requires_finishing,
         requires_finishing_origin = v_origin
   WHERE id = p_pedido_item_id
   RETURNING * INTO v_item;

  PERFORM set_config('app.traceability_reason', '', true);
  PERFORM set_config('app.traceability_command_hash', '', true);
  PERFORM set_config('app.traceability_command_id', '', true);
  PERFORM set_config('app.traceability_process', '', true);

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'replay', false,
    'pedido_id', v_item.pedido_id,
    'pedido_item_id', v_item.id,
    'requires_finishing', v_item.requires_finishing,
    'origin', v_item.requires_finishing_origin,
    'revision', v_item.requires_finishing_revision);
END;
$$;

ALTER FUNCTION public.definir_requires_finishing_pedido_item(UUID, BOOLEAN, BIGINT, UUID, TEXT)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_requires_finishing_pedido_item(UUID, BOOLEAN, BIGINT, UUID, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.definir_requires_finishing_pedido_item(UUID, BOOLEAN, BIGINT, UUID, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Snapshot and change-request proposal shape.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_snapshot(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pedido_id', p.id,
    'revisao', p.revisao,
    'status', p.status,
    'data_pedido', p.data_pedido,
    'prazo_entrega', p.prazo_entrega,
    'referencia_cliente', p.referencia_cliente,
    'tipo_recebimento', p.tipo_recebimento,
    'observacao', p.observacao,
    'prioridade_status', p.prioridade_status,
    'prioridade_observacao', p.prioridade_observacao,
    'metros_total', p.metros_total,
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'pedido_item_id', pi.id,
               'modelo_id', pi.modelo_id,
               'modelo_nome', m.nome,
               'metros', pi.metros,
               'largura', pi.largura,
               'observacao', pi.observacao,
               'ordem', pi.ordem,
               'requires_finishing', pi.requires_finishing,
               'requires_finishing_origin', pi.requires_finishing_origin,
               'requires_finishing_revision', pi.requires_finishing_revision)
             ORDER BY pi.ordem, pi.criado_em)
        FROM public.pedido_itens pi
        LEFT JOIN public.modelos m ON m.id = pi.modelo_id
       WHERE pi.pedido_id = p.id), '[]'::jsonb)
  )
  FROM public.pedidos p WHERE p.id = p_pedido_id;
$$;

ALTER FUNCTION public.pedido_snapshot(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.pedido_alteracao_solicitacao_itens
  ADD COLUMN IF NOT EXISTS requires_finishing BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_finishing_origin TEXT,
  ADD COLUMN IF NOT EXISTS requires_finishing_explicit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_finishing_reason TEXT;

DO $proposal_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedido_alteracao_solicitacao_itens'::regclass
       AND conname = 'pedido_alteracao_item_requires_finishing_chk'
  ) THEN
    ALTER TABLE public.pedido_alteracao_solicitacao_itens
      ADD CONSTRAINT pedido_alteracao_item_requires_finishing_chk CHECK (
        (requires_finishing IS NULL AND requires_finishing_origin IS NULL)
        OR
        (requires_finishing IS NOT NULL
          AND requires_finishing_origin IN ('MODEL_DEFAULT', 'EXPLICIT_HUMAN', 'CORRECTION'))
      );
  END IF;
END;
$proposal_constraint$;

-- ---------------------------------------------------------------------
-- 6. Canonical creation writers now share the normalized item owner.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_pedido_admin(
  p_pedido JSONB,
  p_itens JSONB,
  p_prioridade JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_pedido_id UUID;
  v_row public.pedidos%ROWTYPE;
  v_itens JSONB;
  v_ids UUID[];
  v_prio JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode criar um Pedido');
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_itens',
      'erro', 'Um Pedido precisa de ao menos um item');
  END IF;
  IF NULLIF(p_pedido->>'data_pedido', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'data_pedido_obrigatoria',
      'erro', 'A data do Pedido e obrigatoria');
  END IF;

  IF NULLIF(p_pedido->>'numero', '') IS NULL THEN
    INSERT INTO public.pedidos (cliente_id, data_pedido, prazo_entrega, observacao)
    VALUES ((p_pedido->>'cliente_id')::BIGINT,
            NULLIF(p_pedido->>'data_pedido', '')::DATE,
            NULLIF(p_pedido->>'prazo_entrega', '')::DATE,
            NULLIF(p_pedido->>'observacao', ''))
    RETURNING id INTO v_pedido_id;
  ELSE
    INSERT INTO public.pedidos (cliente_id, numero, data_pedido, prazo_entrega, observacao)
    VALUES ((p_pedido->>'cliente_id')::BIGINT,
            (p_pedido->>'numero')::INTEGER,
            NULLIF(p_pedido->>'data_pedido', '')::DATE,
            NULLIF(p_pedido->>'prazo_entrega', '')::DATE,
            NULLIF(p_pedido->>'observacao', ''))
    RETURNING id INTO v_pedido_id;
  END IF;

  v_itens := public.pedido_itens_payload_normalizar(v_pedido_id, p_itens);
  PERFORM public.pedido_itens_reconciliar(v_pedido_id, v_itens);

  SELECT jsonb_agg(jsonb_build_object('id', i.id, 'ordem', i.ordem) ORDER BY i.ordem),
         array_agg(i.id ORDER BY i.ordem)
    INTO v_itens, v_ids
    FROM public.pedido_itens i WHERE i.pedido_id = v_pedido_id;

  IF p_prioridade IS NOT NULL AND COALESCE((p_prioridade->>'habilitada')::BOOLEAN, FALSE) THEN
    v_prio := public.definir_prioridade_pedido(
      v_pedido_id, v_ids, TRUE, NULLIF(p_prioridade->>'observacao', ''), FALSE);
    IF COALESCE((v_prio->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'prioridade_recusada'
        USING ERRCODE = '22023', DETAIL = COALESCE(v_prio->>'erro', v_prio::TEXT);
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.pedidos WHERE id = v_pedido_id;
  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido', jsonb_build_object('id', v_row.id, 'numero', v_row.numero,
      'status', v_row.status, 'data_pedido', v_row.data_pedido),
    'itens', COALESCE(v_itens, '[]'::JSONB));
END;
$$;

ALTER FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_admin(JSONB, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_pedido_cliente(
  p_pedido JSONB,
  p_itens JSONB,
  p_prioridade JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_meu BIGINT;
  v_cliente BIGINT;
  v_pedido_id UUID;
  v_row public.pedidos%ROWTYPE;
  v_itens JSONB;
  v_ids UUID[];
  v_prio JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Autenticacao obrigatoria');
  END IF;
  v_meu := public.meu_cliente_id();
  v_cliente := (p_pedido->>'cliente_id')::BIGINT;
  IF v_meu IS NULL OR v_cliente IS NULL OR v_cliente <> v_meu THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Um cliente so pode criar Pedido para si mesmo');
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_itens',
      'erro', 'Um Pedido precisa de ao menos um item');
  END IF;
  IF NULLIF(p_pedido->>'data_pedido', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'data_pedido_obrigatoria',
      'erro', 'A data do Pedido e obrigatoria');
  END IF;

  INSERT INTO public.pedidos (cliente_id, status, data_pedido, prazo_entrega, observacao)
  VALUES (v_cliente, 'recebido', NULLIF(p_pedido->>'data_pedido', '')::DATE,
          NULLIF(p_pedido->>'prazo_entrega', '')::DATE, NULLIF(p_pedido->>'observacao', ''))
  RETURNING id INTO v_pedido_id;

  v_itens := public.pedido_itens_payload_normalizar(v_pedido_id, p_itens);
  PERFORM public.pedido_itens_reconciliar(v_pedido_id, v_itens);

  SELECT jsonb_agg(jsonb_build_object('id', i.id, 'ordem', i.ordem) ORDER BY i.ordem),
         array_agg(i.id ORDER BY i.ordem)
    INTO v_itens, v_ids
    FROM public.pedido_itens i WHERE i.pedido_id = v_pedido_id;

  IF p_prioridade IS NOT NULL AND COALESCE((p_prioridade->>'habilitada')::BOOLEAN, FALSE) THEN
    v_prio := public.definir_prioridade_pedido(
      v_pedido_id, v_ids, TRUE, NULLIF(p_prioridade->>'observacao', ''), FALSE);
    IF COALESCE((v_prio->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'prioridade_recusada'
        USING ERRCODE = '22023', DETAIL = COALESCE(v_prio->>'erro', v_prio::TEXT);
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.pedidos WHERE id = v_pedido_id;
  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido', jsonb_build_object('id', v_row.id, 'numero', v_row.numero, 'status', v_row.status),
    'itens', COALESCE(v_itens, '[]'::JSONB));
END;
$$;

ALTER FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_cliente(JSONB, JSONB, JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Client change request captures the normalized applicability proposal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.solicitar_alteracao_pedido(
  p_pedido_id UUID,
  p_header JSONB DEFAULT NULL,
  p_itens JSONB DEFAULT NULL,
  p_prioridade BOOLEAN DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_cliente BIGINT := public.meu_cliente_id();
  v_campos TEXT[];
  v_itens JSONB;
  v_id UUID;
  v_substituidas INTEGER := 0;
  v_row JSONB;
BEGIN
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: chamador nao e um cliente' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.cliente_id IS DISTINCT FROM v_cliente THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: Pedido nao pertence a este cliente' USING ERRCODE = '42501';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita solicitacao', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF v_pedido.status IN ('rascunho','recebido') THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_PEDIDO_NAO_ACEITO: o Pedido ainda nao foi aceito; edite-o diretamente por salvar_pedido_cliente'
      USING ERRCODE = '23514';
  END IF;

  v_campos := public.pedido_header_validar(p_header, 'cliente');

  IF p_itens IS NOT NULL THEN
    v_itens := public.pedido_itens_payload_normalizar(p_pedido_id, p_itens);
    IF public.pedido_itens_payload_e_estrutural(p_pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(p_pedido_id) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; alterar modelo, metragem ou a composicao de itens exige reconciliacao de producao e nao pode ser solicitado por este fluxo'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.pedido_alteracao_solicitacoes
     SET status = 'substituida', decidido_em = now()
   WHERE pedido_id = p_pedido_id AND status = 'pendente';
  GET DIAGNOSTICS v_substituidas = ROW_COUNT;

  INSERT INTO public.pedido_alteracao_solicitacoes (
    pedido_id, status, solicitante_id, solicitante_papel, base_revisao, base_snapshot,
    proposto_prazo_entrega, proposto_referencia_cliente, proposto_tipo_recebimento,
    proposto_observacao, proposto_prioridade_habilitada, campos_alterados,
    itens_propostos, mensagem_cliente)
  VALUES (
    p_pedido_id, 'pendente', auth.uid(), 'cliente', v_pedido.revisao,
    public.pedido_snapshot(p_pedido_id),
    CASE WHEN p_header ? 'prazo_entrega' THEN NULLIF(p_header->>'prazo_entrega','')::DATE END,
    CASE WHEN p_header ? 'referencia_cliente' THEN NULLIF(btrim(COALESCE(p_header->>'referencia_cliente','')),'') END,
    CASE WHEN p_header ? 'tipo_recebimento' THEN NULLIF(p_header->>'tipo_recebimento','') END,
    CASE WHEN p_header ? 'observacao' THEN NULLIF(btrim(COALESCE(p_header->>'observacao','')),'') END,
    COALESCE(p_prioridade, FALSE), v_campos,
    p_itens IS NOT NULL, NULLIF(btrim(COALESCE(p_mensagem,'')),''))
  RETURNING id INTO v_id;

  IF v_itens IS NOT NULL THEN
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
      INSERT INTO public.pedido_alteracao_solicitacao_itens (
        solicitacao_id, pedido_item_id, modelo_id, metros, largura, observacao, ordem,
        requires_finishing, requires_finishing_origin, requires_finishing_explicit,
        requires_finishing_reason)
      VALUES (
        v_id,
        NULLIF(v_row->>'pedido_item_id','')::UUID,
        (v_row->>'modelo_id')::BIGINT,
        (v_row->>'metros')::NUMERIC,
        NULLIF(v_row->>'largura','')::NUMERIC,
        NULLIF(v_row->>'observacao',''),
        (v_row->>'ordem')::INTEGER,
        NULLIF(v_row->>'requires_finishing','')::BOOLEAN,
        NULLIF(v_row->>'requires_finishing_origin',''),
        COALESCE((v_row->>'requires_finishing_explicit')::BOOLEAN, FALSE),
        NULLIF(v_row->>'requires_finishing_reason',''));
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'solicitacao_id', v_id, 'status', 'pendente',
    'base_revisao', v_pedido.revisao, 'substituiu_pendente', v_substituidas > 0);
END;
$$;

ALTER FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Approval applies the immutable, already-normalized proposal and
-- preserves db/115 expected-refusal semantics.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aprovar_alteracao_pedido(
  p_solicitacao_id UUID,
  p_confirmar_impacto BOOLEAN DEFAULT FALSE,
  p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_sol public.pedido_alteracao_solicitacoes%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_header JSONB := '{}'::JSONB;
  v_itens JSONB;
  v_campo TEXT;
  v_falha TEXT;
  v_row JSONB;
  v_item_id UUID;
  v_manter UUID[] := ARRAY[]::UUID[];
  v_remover UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes
   WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND: solicitacao % inexistente', p_solicitacao_id USING ERRCODE = 'P0002';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em %', v_sol.status USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = v_sol.pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', v_sol.pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita aplicacao', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF v_pedido.revisao IS DISTINCT FROM v_sol.base_revisao THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a criacao da solicitacao (base %, atual %)',
      v_sol.base_revisao, v_pedido.revisao USING ERRCODE = '40001';
  END IF;

  PERFORM 1 FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE;

  FOREACH v_campo IN ARRAY v_sol.campos_alterados LOOP
    v_header := v_header || CASE v_campo
      WHEN 'prazo_entrega' THEN jsonb_build_object('prazo_entrega', v_sol.proposto_prazo_entrega)
      WHEN 'referencia_cliente' THEN jsonb_build_object('referencia_cliente', v_sol.proposto_referencia_cliente)
      WHEN 'tipo_recebimento' THEN jsonb_build_object('tipo_recebimento', v_sol.proposto_tipo_recebimento)
      WHEN 'observacao' THEN jsonb_build_object('observacao', v_sol.proposto_observacao)
      ELSE '{}'::JSONB END;
  END LOOP;
  PERFORM public.pedido_header_validar(v_header, 'cliente');

  IF v_sol.itens_propostos THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'pedido_item_id', i.pedido_item_id,
        'modelo_id', i.modelo_id,
        'metros', i.metros,
        'largura', i.largura,
        'observacao', i.observacao,
        'ordem', i.ordem,
        'requires_finishing', i.requires_finishing,
        'requires_finishing_origin', i.requires_finishing_origin,
        'requires_finishing_explicit', i.requires_finishing_explicit,
        'requires_finishing_reason', i.requires_finishing_reason)
      ORDER BY i.ordem), '[]'::JSONB)
      INTO v_itens
      FROM public.pedido_alteracao_solicitacao_itens i
     WHERE i.solicitacao_id = p_solicitacao_id;

    IF public.pedido_itens_payload_e_estrutural(v_sol.pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(v_sol.pedido_id) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; a proposta estrutural nao pode ser aplicada e deve ser rejeitada com justificativa'
        USING ERRCODE = '23514';
    END IF;

    FOR v_row IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
      v_item_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
      IF v_item_id IS NOT NULL THEN v_manter := v_manter || v_item_id; END IF;
    END LOOP;
    FOR v_remover IN
      SELECT pi.id FROM public.pedido_itens pi
       WHERE pi.pedido_id = v_sol.pedido_id
         AND NOT (pi.id = ANY (v_manter))
    LOOP
      IF public.pedido_item_tem_vinculo_producao(v_remover) THEN
        RAISE EXCEPTION
          'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item % ja esta vinculado a producao, expedicao ou entrega parcial e nao pode ser removido; a reconciliacao de producao e um fluxo proprio', v_remover
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;

  IF v_sol.proposto_prioridade_habilitada IS NOT NULL
     AND v_pedido.status = 'produzindo'
     AND COALESCE(p_confirmar_impacto, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED: a producao deste Pedido ja foi iniciada; confirme o impacto antes de alterar a prioridade'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    IF v_itens IS NOT NULL THEN
      PERFORM public.pedido_itens_reconciliar(v_sol.pedido_id, v_itens);
    END IF;
    PERFORM public.pedido_header_aplicar(v_sol.pedido_id, v_header);
    PERFORM public.pedido_prioridade_aplicar(
      v_sol.pedido_id, v_sol.proposto_prioridade_habilitada, p_confirmar_impacto);

    INSERT INTO public.pedido_eventos (
      pedido_id, status_anterior, status_novo, criado_por, observacao)
    VALUES (
      v_sol.pedido_id, v_pedido.status, v_pedido.status, auth.uid(),
      'db/130 aprovar_alteracao_pedido: solicitacao ' || p_solicitacao_id ||
      '; campos=' || COALESCE(array_to_string(v_sol.campos_alterados, ','), ''));

    INSERT INTO public.pedido_cliente_eventos (
      pedido_id, status, titulo, mensagem, origem, visivel_cliente, criado_por)
    VALUES (
      v_sol.pedido_id, COALESCE(v_pedido.status_cliente_visual, 'confirmado'),
      'Solicitacao de alteracao aprovada',
      COALESCE(NULLIF(btrim(COALESCE(p_motivo,'')),''),
        'Sua solicitacao de alteracao foi aprovada pela equipe.'),
      'sistema', TRUE, auth.uid());

    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'aprovada', decidido_em = now(), decidido_por = auth.uid(),
           decisao_motivo = NULLIF(btrim(COALESCE(p_motivo,'')),'')
     WHERE id = p_solicitacao_id;
  EXCEPTION WHEN OTHERS THEN
    v_falha := SQLSTATE || ':' || left(COALESCE(SQLERRM, ''), 300);
    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'falha_aplicacao', decidido_em = now(), decidido_por = auth.uid(),
           falha_identificador = v_falha
     WHERE id = p_solicitacao_id;
    RETURN jsonb_build_object(
      'ok', false, 'erro', 'PEDIDO_ALTERACAO_FALHA_APLICACAO',
      'solicitacao_id', p_solicitacao_id, 'status', 'falha_aplicacao',
      'falha_identificador', v_falha);
  END;

  RETURN jsonb_build_object(
    'ok', true, 'solicitacao_id', p_solicitacao_id, 'status', 'aprovada',
    'pedido_id', v_sol.pedido_id,
    'revisao', (SELECT revisao FROM public.pedidos WHERE id = v_sol.pedido_id));
END;
$fn$;

ALTER FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
