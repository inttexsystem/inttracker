-- =====================================================================
-- db/103 — SUPPLIER QUEUE AND PURCHASE-ORDER ACCEPTANCE
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.E,
-- ADDITIVELY ONLY.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. The following belong to
-- db/103b and phase P4 and are NOT present here:
--   * emitir_ordem_compra is NOT modified — emission still freezes
--     aceite_exigido_na_emissao from the global configuration exactly as
--     it does today;
--   * the ordem_compra_config demotion trigger is NOT installed and the
--     column is neither fenced nor dropped;
--   * no existing Purchase Order is reclassified, and the two live
--     orders keep false / nao_aplicavel.
--
-- What P1 does install is the future AUTHORITY (fornecedores.exige_aceite)
-- seeded deterministically from the current global value, the idempotent
-- command store, the supplier queue read model and the two decision
-- writers. Nothing reads the new supplier column as an emission
-- authority yet, so no reachable behaviour changes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The supplier-level acceptance column (9.9.E.1/E.2)
--
-- NOT NULL DEFAULT false makes a "row predates the column" fallback
-- structurally impossible (9.9.E.4), so none exists or is referenced.
-- ---------------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS exige_aceite BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fornecedores.exige_aceite IS
  'db/103 (9.9.E): supplier-level acceptance requirement. Becomes the SOLE authority at P4 (db/103b); in P1 it is seeded and readable but no emission path consumes it yet.';

-- Deterministic seed from the current global singleton, in the SAME
-- migration (9.9.E.2). Idempotent: re-running assigns the same value.
UPDATE public.fornecedores f
   SET exige_aceite = c.exige_aceite
  FROM public.ordem_compra_config c
 WHERE c.id = 1
   AND f.exige_aceite IS DISTINCT FROM c.exige_aceite;

-- ---------------------------------------------------------------------
-- 2. Idempotency storage for acceptance commands (9.9.E)
--    Shaped after the proven public.expedicao_comandos (F10).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordem_compra_aceite_comandos (
  id                    BIGSERIAL PRIMARY KEY,
  idempotency_namespace TEXT NOT NULL
                          CHECK (idempotency_namespace = 'oc_aceite_v1'),
  ator_id               UUID NOT NULL,
  idempotency_key       TEXT NOT NULL
                          CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  ordem_compra_id       BIGINT NOT NULL REFERENCES public.ordem_compra(id) ON DELETE CASCADE,
  decisao               TEXT NOT NULL CHECK (decisao IN ('aceita', 'rejeitada')),
  comando_payload       JSONB NOT NULL CHECK (jsonb_typeof(comando_payload) = 'object'),
  comando_hash          TEXT NOT NULL CHECK (comando_hash ~ '^[0-9a-f]{32}$'),
  resultado             JSONB NOT NULL CHECK (jsonb_typeof(resultado) = 'object'),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ordem_compra_aceite_comandos_idempotencia
    UNIQUE (idempotency_namespace, ator_id, idempotency_key)
);

COMMENT ON TABLE public.ordem_compra_aceite_comandos IS
  'db/103 (9.9.E): append-only idempotency store for supplier acceptance decisions. Same key + identical payload returns the stored resultado; same key + different payload is refused as conflicting reuse.';

CREATE INDEX IF NOT EXISTS ordem_compra_aceite_comandos_ordem_idx
  ON public.ordem_compra_aceite_comandos (ordem_compra_id, criado_em DESC, id DESC);

ALTER TABLE public.ordem_compra_aceite_comandos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ordem_compra_aceite_comandos FROM PUBLIC;
REVOKE ALL ON TABLE public.ordem_compra_aceite_comandos FROM anon;
REVOKE ALL ON TABLE public.ordem_compra_aceite_comandos FROM authenticated;
REVOKE ALL ON TABLE public.ordem_compra_aceite_comandos FROM service_role;
REVOKE ALL ON SEQUENCE public.ordem_compra_aceite_comandos_id_seq FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.ordem_compra_aceite_comandos TO authenticated;

DROP POLICY IF EXISTS ordem_compra_aceite_comandos_admin_select ON public.ordem_compra_aceite_comandos;
CREATE POLICY ordem_compra_aceite_comandos_admin_select
  ON public.ordem_compra_aceite_comandos FOR SELECT
  USING (public.is_admin());

-- The decision writers are SECURITY DEFINER and therefore bypass RLS;
-- no client role receives INSERT, UPDATE or DELETE by design.

-- Append-only guard: a decided command is evidence and never mutates.
CREATE OR REPLACE FUNCTION public.trg_oc_aceite_comando_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'oc_aceite_comando_imutavel' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS oc_aceite_comando_immutable_guard ON public.ordem_compra_aceite_comandos;
CREATE TRIGGER oc_aceite_comando_immutable_guard
  BEFORE UPDATE OR DELETE ON public.ordem_compra_aceite_comandos
  FOR EACH ROW EXECUTE FUNCTION public.trg_oc_aceite_comando_immutable_guard();

-- ---------------------------------------------------------------------
-- 3. _oc_aceite_ator_autorizado — the supplier authorization predicate
--
-- OWNER-ONLY. The actor must be an ACTIVE supplier user bound to exactly
-- the supplier the order was issued to (9.9.A.5 authorization column).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_aceite_ator_autorizado(p_ordem_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios u
      JOIN public.ordem_compra o ON o.id = p_ordem_id
     WHERE u.id = auth.uid()
       AND u.tipo = 'fornecedor'
       AND u.ativo IS TRUE
       AND u.fornecedor_id IS NOT NULL
       AND u.fornecedor_id = o.fornecedor_id);
$$;

COMMENT ON FUNCTION public._oc_aceite_ator_autorizado(BIGINT) IS
  'db/103 (9.9.E): true only for an ACTIVE fornecedor user whose fornecedor_id equals the order''s fornecedor_id. OWNER-ONLY.';

-- ---------------------------------------------------------------------
-- 4. _oc_aceite_decidir — the shared decision primitive
--    OWNER-ONLY. Authorization belongs to the two guarded wrappers.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_aceite_decidir(
  p_ordem_id        BIGINT,
  p_decisao         TEXT,
  p_idempotency_key TEXT,
  p_motivo          TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ator      UUID := auth.uid();
  v_payload   JSONB;
  v_hash      TEXT;
  v_existente RECORD;
  v_ordem     RECORD;
  v_resultado JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ACEITE_CHAVE_OBRIGATORIA');
  END IF;

  v_payload := jsonb_build_object(
    'ordem_compra_id', p_ordem_id,
    'decisao', p_decisao,
    'motivo', COALESCE(btrim(p_motivo), ''));
  v_hash := md5(v_payload::TEXT);

  -- IDEMPOTENCY, before any state change.
  SELECT * INTO v_existente
    FROM public.ordem_compra_aceite_comandos
   WHERE idempotency_namespace = 'oc_aceite_v1'
     AND ator_id = v_ator
     AND idempotency_key = btrim(p_idempotency_key);
  IF FOUND THEN
    IF v_existente.comando_hash = v_hash THEN
      RETURN v_existente.resultado;          -- replay: same result, no write
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'comando_conflitante');
  END IF;

  BEGIN
    SET LOCAL lock_timeout = '5s';
    SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'concorrencia_ocupada');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ORDEM_NAO_ENCONTRADA');
  END IF;

  IF v_ordem.status_administrativo <> 'emitida' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ACEITE_ORDEM_NAO_EMITIDA',
                              'status_administrativo', v_ordem.status_administrativo);
  END IF;

  IF v_ordem.status_aceite <> 'pendente' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ACEITE_JA_DECIDIDO',
                              'status_aceite', v_ordem.status_aceite);
  END IF;

  IF p_decisao = 'rejeitada' AND COALESCE(btrim(p_motivo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ACEITE_MOTIVO_OBRIGATORIO');
  END IF;

  UPDATE public.ordem_compra
     SET status_aceite      = p_decisao,
         aceite_decidida_em = now(),
         aceite_decidida_por = v_ator,
         aceite_motivo      = NULLIF(btrim(p_motivo), '')
   WHERE id = p_ordem_id;

  INSERT INTO public.ordem_compra_eventos
    (ordem_compra_id, dimensao, tipo_evento, valor_anterior, valor_novo, payload, criado_por)
  VALUES (p_ordem_id, 'aceite',
          CASE WHEN p_decisao = 'aceita' THEN 'aceite_registrado' ELSE 'aceite_rejeitado' END,
          v_ordem.status_aceite, p_decisao, v_payload, v_ator);

  v_resultado := jsonb_build_object(
    'ok', true, 'ordem_compra_id', p_ordem_id,
    'status_aceite', p_decisao,
    'decidida_em', now());

  INSERT INTO public.ordem_compra_aceite_comandos
    (idempotency_namespace, ator_id, idempotency_key, ordem_compra_id,
     decisao, comando_payload, comando_hash, resultado)
  VALUES ('oc_aceite_v1', v_ator, btrim(p_idempotency_key), p_ordem_id,
          p_decisao, v_payload, v_hash, v_resultado);

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public._oc_aceite_decidir(BIGINT, TEXT, TEXT, TEXT) IS
  'db/103 (9.9.E): OWNER-ONLY shared acceptance/rejection primitive with command idempotency. Authorization belongs to aceitar_ordem_compra / rejeitar_ordem_compra.';

-- ---------------------------------------------------------------------
-- 5. The two guarded public decision writers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aceitar_ordem_compra(
  p_ordem_id        BIGINT,
  p_idempotency_key TEXT,
  p_motivo          TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._oc_aceite_ator_autorizado(p_ordem_id) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  RETURN public._oc_aceite_decidir(p_ordem_id, 'aceita', p_idempotency_key, p_motivo);
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeitar_ordem_compra(
  p_ordem_id        BIGINT,
  p_idempotency_key TEXT,
  p_motivo          TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._oc_aceite_ator_autorizado(p_ordem_id) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  RETURN public._oc_aceite_decidir(p_ordem_id, 'rejeitada', p_idempotency_key, p_motivo);
END;
$$;

COMMENT ON FUNCTION public.aceitar_ordem_compra(BIGINT, TEXT, TEXT) IS
  'db/103 (9.9.E): supplier acceptance. Guarded SECURITY DEFINER; only the ACTIVE supplier the order was issued to may call it. Idempotent by (namespace, actor, key).';
COMMENT ON FUNCTION public.rejeitar_ordem_compra(BIGINT, TEXT, TEXT) IS
  'db/103 (9.9.E): supplier rejection, motive mandatory. Guarded SECURITY DEFINER; only the ACTIVE supplier the order was issued to may call it. Idempotent by (namespace, actor, key).';

-- ---------------------------------------------------------------------
-- 6. The supplier queue read model
--
-- Returns the orders awaiting THIS supplier's decision. A SECURITY
-- DEFINER function rather than a view, for the same reason as 9.9.A.5:
-- the read must not depend on client-visible privileges on ordem_compra.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_fila_aceite_fornecedor()
RETURNS TABLE (
  ordem_compra_id       BIGINT,
  codigo                TEXT,
  identidade_operacional TEXT,
  fornecedor_id         BIGINT,
  emitida_em            TIMESTAMPTZ,
  status_aceite         TEXT,
  kg_total              NUMERIC(12,3),
  itens                 INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_forn BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT u.fornecedor_id INTO v_forn
    FROM public.usuarios u
   WHERE u.id = auth.uid() AND u.tipo = 'fornecedor' AND u.ativo IS TRUE;

  IF v_forn IS NULL THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT o.id, o.codigo, o.identidade_operacional, o.fornecedor_id, o.emitida_em,
         o.status_aceite,
         coalesce((SELECT sum(i.kg_pedido) FROM public.ordem_compra_item i
                    WHERE i.ordem_id = o.id), 0)::NUMERIC(12,3),
         (SELECT count(*) FROM public.ordem_compra_item i WHERE i.ordem_id = o.id)::INTEGER
    FROM public.ordem_compra o
   WHERE o.fornecedor_id = v_forn
     AND o.status_administrativo = 'emitida'
     AND o.status_aceite = 'pendente'
   ORDER BY o.emitida_em NULLS LAST, o.id;
END;
$$;

COMMENT ON FUNCTION public.listar_fila_aceite_fornecedor() IS
  'db/103 (9.9.E): the supplier''s own acceptance queue — emitted orders still pendente for the calling ACTIVE supplier user. Guarded SECURITY DEFINER; never exposes another supplier''s orders.';

-- ---------------------------------------------------------------------
-- 7. Explicit ownership and privileges
-- ---------------------------------------------------------------------
ALTER FUNCTION public.trg_oc_aceite_comando_immutable_guard()                 OWNER TO postgres;
ALTER FUNCTION public._oc_aceite_ator_autorizado(BIGINT)                      OWNER TO postgres;
ALTER FUNCTION public._oc_aceite_decidir(BIGINT, TEXT, TEXT, TEXT)            OWNER TO postgres;
ALTER FUNCTION public.aceitar_ordem_compra(BIGINT, TEXT, TEXT)                OWNER TO postgres;
ALTER FUNCTION public.rejeitar_ordem_compra(BIGINT, TEXT, TEXT)               OWNER TO postgres;
ALTER FUNCTION public.listar_fila_aceite_fornecedor()                         OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_oc_aceite_comando_immutable_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_aceite_ator_autorizado(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._oc_aceite_decidir(BIGINT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.aceitar_ordem_compra(BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aceitar_ordem_compra(BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.rejeitar_ordem_compra(BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rejeitar_ordem_compra(BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_fila_aceite_fornecedor()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_fila_aceite_fornecedor() TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db103$
DECLARE
  v_config BOOLEAN;
  v_drift  INTEGER;
  v_alter  INTEGER;
BEGIN
  -- 8.1 The seed is deterministic: EVERY supplier equals the global value.
  SELECT c.exige_aceite INTO v_config FROM public.ordem_compra_config c WHERE c.id = 1;
  SELECT count(*) INTO v_drift FROM public.fornecedores f
   WHERE f.exige_aceite IS DISTINCT FROM v_config;
  IF v_drift > 0 THEN
    RAISE EXCEPTION 'db/103: % supplier row(s) diverge from the seeded global value %', v_drift, v_config;
  END IF;

  -- 8.2 NO existing Purchase Order is reclassified by this migration.
  SELECT count(*) INTO v_alter FROM public.ordem_compra o
   WHERE o.legado = FALSE
     AND o.status_aceite NOT IN ('nao_aplicavel', 'pendente', 'aceita', 'rejeitada');
  IF v_alter > 0 THEN
    RAISE EXCEPTION 'db/103: purchase-order acceptance state drifted';
  END IF;

  -- 8.3 The ordem_compra_config demotion trigger belongs to P4 and must
  --     NOT exist yet.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal
       AND c.relname = 'ordem_compra_config'
       AND t.tgname LIKE '%aceite%'
  ) THEN
    RAISE EXCEPTION 'db/103: the configuration demotion trigger must not be installed in P1';
  END IF;

  -- 8.4 emitir_ordem_compra must still be the db/77 body — P1 does not
  --     switch emission to supplier-level acceptance.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND p.prosrc ~ 'fornecedores'
  ) THEN
    RAISE EXCEPTION 'db/103: emitir_ordem_compra must not read fornecedores.exige_aceite in P1';
  END IF;

  -- 8.5 The command store is unreachable for direct mutation.
  IF has_table_privilege('authenticated', 'public.ordem_compra_aceite_comandos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ordem_compra_aceite_comandos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ordem_compra_aceite_comandos', 'DELETE')
     OR has_table_privilege('anon', 'public.ordem_compra_aceite_comandos', 'SELECT') THEN
    RAISE EXCEPTION 'db/103: ordem_compra_aceite_comandos privileges are too wide';
  END IF;

  -- 8.6 Owner-only helpers unreachable by every client role.
  IF has_function_privilege('authenticated', 'public._oc_aceite_decidir(bigint,text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._oc_aceite_decidir(bigint,text,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._oc_aceite_decidir(bigint,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._oc_aceite_ator_autorizado(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/103: an owner-only acceptance helper is reachable by a client role';
  END IF;

  -- 8.7 The cutover remains untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/103: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db103$;

COMMIT;
