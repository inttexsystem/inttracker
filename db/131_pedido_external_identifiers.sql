-- =====================================================================
-- db/131 - Typed exact-literal external Pedido identifiers
--
-- The canonical Pedido remains public.pedidos. This migration adds only
-- typed aliases/references and one explicit, audited current mapping owner.
-- No formatting heuristic can create or resolve a mapping.
-- =====================================================================

BEGIN;

DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.pedidos') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedidos'); END IF;
  IF to_regclass('public.pedido_itens') IS NULL
    THEN v_missing := array_append(v_missing, 'table public.pedido_itens'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pedido_itens'
       AND column_name = 'requires_finishing'
  ) THEN
    v_missing := array_append(v_missing, 'db/130 public.pedido_itens.requires_finishing');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/131 gate: missing prerequisite(s): %', array_to_string(v_missing, ', ');
  END IF;
END;
$gate$;

-- ---------------------------------------------------------------------
-- 1. Stable typed literal and its current explicit target.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_external_identifier_literal_valid(
  p_namespace TEXT,
  p_literal_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_namespace
    WHEN 'legacy' THEN COALESCE(p_literal_value ~ '^[0-9]{5}$', FALSE)
    WHEN 't_series' THEN COALESCE(p_literal_value ~ '^T[0-9]{3}-[0-9]{2}$', FALSE)
    ELSE FALSE
  END;
$$;

ALTER FUNCTION public.pedido_external_identifier_literal_valid(TEXT, TEXT)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_external_identifier_literal_valid(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.pedido_external_identifiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       TEXT NOT NULL,
  literal_value   TEXT NOT NULL,
  pedido_id       UUID REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  active          BOOLEAN NOT NULL DEFAULT FALSE,
  revision        BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pedido_external_identifiers_namespace_chk
    CHECK (namespace IN ('legacy', 't_series')),
  CONSTRAINT pedido_external_identifiers_literal_chk
    CHECK (public.pedido_external_identifier_literal_valid(namespace, literal_value)),
  CONSTRAINT pedido_external_identifiers_active_target_chk
    CHECK ((active AND pedido_id IS NOT NULL) OR (NOT active AND pedido_id IS NULL)),
  UNIQUE (namespace, literal_value)
);

ALTER TABLE public.pedido_external_identifiers
  DROP CONSTRAINT IF EXISTS pedido_external_identifiers_namespace_chk,
  DROP CONSTRAINT IF EXISTS pedido_external_identifiers_literal_chk;
ALTER TABLE public.pedido_external_identifiers
  ADD CONSTRAINT pedido_external_identifiers_namespace_chk
    CHECK (namespace IN ('legacy', 't_series')),
  ADD CONSTRAINT pedido_external_identifiers_literal_chk
    CHECK (public.pedido_external_identifier_literal_valid(namespace, literal_value));

CREATE INDEX IF NOT EXISTS pedido_external_identifiers_pedido_idx
  ON public.pedido_external_identifiers (pedido_id)
  WHERE active;

COMMENT ON TABLE public.pedido_external_identifiers IS
  'Typed exact-literal external references to canonical Pedidos. Identity is (namespace,literal_value); literal_value is never normalized or heuristically mapped.';
COMMENT ON COLUMN public.pedido_external_identifiers.pedido_id IS
  'Current explicit canonical Pedido target. This alias never renames or replaces pedidos.id/numero and never owns ops.identidade_operacional.';

-- ---------------------------------------------------------------------
-- 2. Append-only mapping/revocation history and command idempotency.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_external_identifier_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_identifier_id UUID NOT NULL
    REFERENCES public.pedido_external_identifiers(id) ON DELETE RESTRICT,
  revision            BIGINT NOT NULL CHECK (revision > 0),
  action              TEXT NOT NULL CHECK (action IN ('MAP', 'CORRECTION', 'REVOKE')),
  previous_pedido_id  UUID,
  new_pedido_id       UUID,
  actor_id            UUID,
  reason              TEXT,
  command_id          UUID NOT NULL UNIQUE,
  command_hash        TEXT NOT NULL CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_identifier_id, revision),
  CONSTRAINT pedido_external_identifier_events_action_chk CHECK (
    (action = 'MAP' AND previous_pedido_id IS NULL AND new_pedido_id IS NOT NULL)
    OR (action = 'CORRECTION' AND previous_pedido_id IS NOT NULL AND new_pedido_id IS NOT NULL
        AND previous_pedido_id IS DISTINCT FROM new_pedido_id)
    OR (action = 'REVOKE' AND previous_pedido_id IS NOT NULL AND new_pedido_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS pedido_external_identifier_events_identifier_idx
  ON public.pedido_external_identifier_events (external_identifier_id, revision DESC);

COMMENT ON TABLE public.pedido_external_identifier_events IS
  'Append-only explicit mapping history. Target UUIDs remain literal historical evidence and deliberately carry no cascading Pedido FK.';

CREATE OR REPLACE FUNCTION public.pedido_external_identifier_events_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_HISTORY_IMMUTABLE: mapping history cannot be updated or deleted'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.revogar_identificador_externo_pedido(
  p_namespace TEXT,
  p_literal_value TEXT,
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
  v_identifier public.pedido_external_identifiers%ROWTYPE;
  v_event public.pedido_external_identifier_events%ROWTYPE;
  v_previous_pedido_id UUID;
  v_reason TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  v_hash TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_FORBIDDEN: admin authentication required'
      USING ERRCODE = '42501';
  END IF;
  IF p_namespace IS NULL OR p_namespace NOT IN ('legacy', 't_series') THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_NAMESPACE_INVALID'
      USING ERRCODE = '22023';
  END IF;
  IF NOT public.pedido_external_identifier_literal_valid(p_namespace, p_literal_value) THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_LITERAL_INVALID_FOR_NAMESPACE'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_revision IS NULL OR p_command_id IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_REVOCATION_REASON_REQUIRED'
      USING ERRCODE = '22023';
  END IF;

  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'operation', 'REVOKE', 'namespace', p_namespace,
      'literal_value', p_literal_value,
      'expected_revision', p_expected_revision, 'reason', v_reason)::TEXT,
    'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_event
    FROM public.pedido_external_identifier_events
   WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_CONFLICT: command_id reused with different payload'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'external_identifier_id', v_event.external_identifier_id,
      'revision', v_event.revision, 'pedido_id', v_event.new_pedido_id,
      'action', v_event.action);
  END IF;

  SELECT * INTO v_identifier
    FROM public.pedido_external_identifiers
   WHERE namespace = p_namespace AND literal_value = p_literal_value
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  -- Recheck after the stable identifier lock: an identical concurrent command
  -- may have committed while this backend was waiting.
  SELECT * INTO v_event
    FROM public.pedido_external_identifier_events
   WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_CONFLICT: command_id reused with different payload'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'external_identifier_id', v_event.external_identifier_id,
      'revision', v_event.revision, 'pedido_id', v_event.new_pedido_id,
      'action', v_event.action);
  END IF;
  IF v_identifier.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION
      'PEDIDO_EXTERNAL_IDENTIFIER_STALE_REVISION: expected %, current %',
      p_expected_revision, v_identifier.revision USING ERRCODE = '40001';
  END IF;
  IF NOT v_identifier.active OR v_identifier.pedido_id IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_NOT_ACTIVE'
      USING ERRCODE = '23514';
  END IF;

  v_previous_pedido_id := v_identifier.pedido_id;
  UPDATE public.pedido_external_identifiers
     SET pedido_id = NULL,
         active = FALSE,
         revision = revision + 1,
         updated_by = auth.uid(),
         updated_at = now()
   WHERE id = v_identifier.id
   RETURNING * INTO v_identifier;

  INSERT INTO public.pedido_external_identifier_events (
    external_identifier_id, revision, action,
    previous_pedido_id, new_pedido_id, actor_id, reason,
    command_id, command_hash)
  VALUES (
    v_identifier.id, v_identifier.revision, 'REVOKE',
    v_previous_pedido_id, NULL, auth.uid(), v_reason,
    p_command_id, v_hash);

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'replay', false,
    'external_identifier_id', v_identifier.id,
    'revision', v_identifier.revision, 'pedido_id', NULL,
    'action', 'REVOKE');
END;
$$;

ALTER FUNCTION public.revogar_identificador_externo_pedido(TEXT, TEXT, BIGINT, UUID, TEXT)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.revogar_identificador_externo_pedido(TEXT, TEXT, BIGINT, UUID, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revogar_identificador_externo_pedido(TEXT, TEXT, BIGINT, UUID, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Minimal exact read/search capability for existing Pedido surfaces.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_identificadores_externos_pedido(p_pedido_id UUID)
RETURNS TABLE (
  external_identifier_id UUID,
  namespace TEXT,
  literal_value TEXT,
  revision BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_FORBIDDEN: authentication required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.pedidos p
     WHERE p.id = p_pedido_id AND p.cliente_id = public.meu_cliente_id()
  ) THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_FORBIDDEN: Pedido is outside caller scope'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT e.id, e.namespace, e.literal_value, e.revision
    FROM public.pedido_external_identifiers e
   WHERE e.pedido_id = p_pedido_id AND e.active
   ORDER BY e.namespace, e.literal_value;
END;
$$;

ALTER FUNCTION public.listar_identificadores_externos_pedido(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.listar_identificadores_externos_pedido(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.listar_identificadores_externos_pedido(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.buscar_pedido_por_identificador_externo(
  p_namespace TEXT,
  p_literal_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_FORBIDDEN: authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.pedido_id INTO v_pedido_id
    FROM public.pedido_external_identifiers e
   WHERE e.namespace = p_namespace
     AND e.literal_value = p_literal_value
     AND e.active;

  IF v_pedido_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF public.is_admin() OR EXISTS (
    SELECT 1 FROM public.pedidos p
     WHERE p.id = v_pedido_id AND p.cliente_id = public.meu_cliente_id()
  ) THEN
    RETURN v_pedido_id;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.buscar_pedido_por_identificador_externo(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.buscar_pedido_por_identificador_externo(TEXT, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_pedido_por_identificador_externo(TEXT, TEXT)
  TO authenticated;

ALTER FUNCTION public.pedido_external_identifier_events_immutable_fn() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pedido_external_identifier_events_immutable_fn()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS pedido_external_identifier_events_immutable
  ON public.pedido_external_identifier_events;
CREATE TRIGGER pedido_external_identifier_events_immutable
  BEFORE UPDATE OR DELETE ON public.pedido_external_identifier_events
  FOR EACH ROW EXECUTE FUNCTION public.pedido_external_identifier_events_immutable_fn();

-- ---------------------------------------------------------------------
-- 3. RLS and direct-DML containment.
-- ---------------------------------------------------------------------
ALTER TABLE public.pedido_external_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_external_identifier_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_external_identifiers_admin_select
  ON public.pedido_external_identifiers;
CREATE POLICY pedido_external_identifiers_admin_select
  ON public.pedido_external_identifiers FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS pedido_external_identifiers_client_select
  ON public.pedido_external_identifiers;
CREATE POLICY pedido_external_identifiers_client_select
  ON public.pedido_external_identifiers FOR SELECT
  TO authenticated
  USING (
    active AND EXISTS (
      SELECT 1 FROM public.pedidos p
       WHERE p.id = pedido_external_identifiers.pedido_id
         AND p.cliente_id = public.meu_cliente_id()
    )
  );

DROP POLICY IF EXISTS pedido_external_identifier_events_admin_select
  ON public.pedido_external_identifier_events;
CREATE POLICY pedido_external_identifier_events_admin_select
  ON public.pedido_external_identifier_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.pedido_external_identifiers
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.pedido_external_identifier_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pedido_external_identifiers TO authenticated;
GRANT SELECT ON public.pedido_external_identifier_events TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Explicit map/correct command. Exact equality only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mapear_identificador_externo_pedido(
  p_namespace TEXT,
  p_literal_value TEXT,
  p_pedido_id UUID,
  p_expected_revision BIGINT,
  p_command_id UUID,
  p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  v_identifier public.pedido_external_identifiers%ROWTYPE;
  v_event public.pedido_external_identifier_events%ROWTYPE;
  v_action TEXT;
  v_previous_pedido_id UUID;
  v_reason TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  v_hash TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_FORBIDDEN: admin authentication required'
      USING ERRCODE = '42501';
  END IF;
  IF p_namespace IS NULL OR p_namespace NOT IN ('legacy', 't_series') THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_NAMESPACE_INVALID'
      USING ERRCODE = '22023';
  END IF;
  IF NOT public.pedido_external_identifier_literal_valid(p_namespace, p_literal_value) THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_LITERAL_INVALID_FOR_NAMESPACE'
      USING ERRCODE = '22023';
  END IF;
  IF p_pedido_id IS NULL OR p_expected_revision IS NULL OR p_command_id IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_INVALID'
      USING ERRCODE = '22004';
  END IF;

  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'operation', 'MAP', 'namespace', p_namespace, 'literal_value', p_literal_value,
      'pedido_id', p_pedido_id, 'expected_revision', p_expected_revision,
      'reason', v_reason)::TEXT, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_event
    FROM public.pedido_external_identifier_events
   WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_CONFLICT: command_id reused with different payload'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'external_identifier_id', v_event.external_identifier_id,
      'revision', v_event.revision, 'pedido_id', v_event.new_pedido_id,
      'action', v_event.action);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = p_pedido_id) THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_PEDIDO_NOT_FOUND: Pedido % does not exist', p_pedido_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.pedido_external_identifiers (
    namespace, literal_value, created_by, updated_by)
  VALUES (p_namespace, p_literal_value, auth.uid(), auth.uid())
  ON CONFLICT (namespace, literal_value) DO NOTHING;

  SELECT * INTO v_identifier
    FROM public.pedido_external_identifiers
   WHERE namespace = p_namespace AND literal_value = p_literal_value
   FOR UPDATE;

  -- Recheck after the stable identifier lock: an identical concurrent command
  -- may have committed while this backend was waiting.
  SELECT * INTO v_event
    FROM public.pedido_external_identifier_events
   WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_event.command_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_COMMAND_CONFLICT: command_id reused with different payload'
        USING ERRCODE = '40001';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'replay', true,
      'external_identifier_id', v_event.external_identifier_id,
      'revision', v_event.revision, 'pedido_id', v_event.new_pedido_id,
      'action', v_event.action);
  END IF;

  IF v_identifier.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION
      'PEDIDO_EXTERNAL_IDENTIFIER_STALE_REVISION: expected %, current %',
      p_expected_revision, v_identifier.revision USING ERRCODE = '40001';
  END IF;
  IF v_identifier.active AND v_identifier.pedido_id = p_pedido_id THEN
    RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_ALREADY_MAPPED: identifier already has this active target'
      USING ERRCODE = '23505';
  END IF;

  IF v_identifier.active THEN
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'PEDIDO_EXTERNAL_IDENTIFIER_CORRECTION_REASON_REQUIRED'
        USING ERRCODE = '22023';
    END IF;
    v_action := 'CORRECTION';
  ELSE
    v_action := 'MAP';
  END IF;

  v_previous_pedido_id := v_identifier.pedido_id;

  UPDATE public.pedido_external_identifiers
     SET pedido_id = p_pedido_id,
         active = TRUE,
         revision = revision + 1,
         updated_by = auth.uid(),
         updated_at = now()
   WHERE id = v_identifier.id
   RETURNING * INTO v_identifier;

  INSERT INTO public.pedido_external_identifier_events (
    external_identifier_id, revision, action,
    previous_pedido_id, new_pedido_id, actor_id, reason,
    command_id, command_hash)
  VALUES (
    v_identifier.id, v_identifier.revision, v_action,
    CASE WHEN v_action = 'CORRECTION' THEN v_previous_pedido_id ELSE NULL END,
    p_pedido_id, auth.uid(), v_reason, p_command_id, v_hash);

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'replay', false,
    'external_identifier_id', v_identifier.id,
    'revision', v_identifier.revision, 'pedido_id', v_identifier.pedido_id,
    'action', v_action);
END;
$$;

ALTER FUNCTION public.mapear_identificador_externo_pedido(TEXT, TEXT, UUID, BIGINT, UUID, TEXT)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mapear_identificador_externo_pedido(TEXT, TEXT, UUID, BIGINT, UUID, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mapear_identificador_externo_pedido(TEXT, TEXT, UUID, BIGINT, UUID, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
