-- =====================================================================
-- db/103b — SUPPLIER-LEVEL EMISSION ACCEPTANCE AND CONFIGURATION DEMOTION
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1, phase P4.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.E
-- points 3 and 4 and the "Emission freeze" clause, and manifest row 3b
-- of section 9.9.N.
--
-- WHY THIS EXISTS. db/103 (P1) installed the FUTURE authority
-- public.fornecedores.exige_aceite and seeded it deterministically from
-- the global singleton public.ordem_compra_config.exige_aceite, but it
-- deliberately left emission reading the GLOBAL value, and deliberately
-- did NOT install the demotion trigger. Its own section 8.3 and 8.4
-- self-checks assert that P1 state. This migration performs exactly the
-- two switches db/103 reserved for P4, and nothing else.
--
-- THE AUTHORITY SWITCH, EXACTLY.
--   1. public.emitir_ordem_compra freezes the SUPPLIER-level value
--      public.fornecedores.exige_aceite of the order's own supplier into
--      public.ordem_compra.aceite_exigido_na_emissao, and derives
--      status_aceite from it. The global singleton is no longer read by
--      any emission path.
--   2. public.ordem_compra_config.exige_aceite becomes read-only and
--      NON-AUTHORITATIVE: a BEFORE UPDATE trigger raises
--      'config_aceite_descontinuada' when the column would change. The
--      column is NOT dropped in this release (9.9.E.3) and the other
--      configuration columns remain writable.
--
-- WHAT IS DELIBERATELY UNCHANGED. The signature, return contract, owner,
-- SECURITY DEFINER flag, search_path setting and ACL of
-- emitir_ordem_compra are preserved exactly. Every validation branch it
-- already performed (permission, existence, legado, rascunho-only,
-- supplier present, items present, complete allocation, allocation
-- coherence) is preserved term for term and in the same order. No
-- existing Purchase Order is reclassified: the live orders keep
-- aceite_exigido_na_emissao = false and status_aceite = 'nao_aplicavel',
-- asserted in section 4. No receipt path, cutover field or business row
-- is touched.
--
-- WHY NO "ROW PREDATES THE COLUMN" FALLBACK EXISTS. db/103 declared
-- fornecedores.exige_aceite NOT NULL DEFAULT false, so a supplier row
-- can never carry NULL (9.9.E.4). The migration therefore does not
-- COALESCE the value; it refuses honestly if the supplier row itself is
-- absent, which the foreign key already makes unreachable.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Emission freezes the SUPPLIER-level acceptance requirement (9.9.E)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emitir_ordem_compra(p_ordem_id BIGINT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem         RECORD;
  v_itens         INT;
  v_itens_ruins   INT;
  v_exige_aceite  BOOLEAN;
  v_status_aceite TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'Ordem nao encontrada');
  END IF;
  IF v_ordem.legado THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ordem_legado', 'erro', 'Ordem legado nao pode ser emitida por esta via');
  END IF;
  IF v_ordem.status_administrativo <> 'rascunho' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido', 'erro', 'Somente rascunho pode ser emitida');
  END IF;
  IF v_ordem.fornecedor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_fornecedor', 'erro', 'Ordem sem fornecedor');
  END IF;

  SELECT count(*) INTO v_itens FROM public.ordem_compra_item WHERE ordem_id = p_ordem_id;
  IF v_itens = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_itens', 'erro', 'Ordem sem itens');
  END IF;

  SELECT count(*) INTO v_itens_ruins
  FROM public.ordem_compra_item i
  LEFT JOIN (
    SELECT item_id, count(*) AS n, COALESCE(SUM(kg_alocado), 0) AS soma
    FROM public.ordem_compra_item_alocacao
    GROUP BY item_id
  ) a ON a.item_id = i.id
  WHERE i.ordem_id = p_ordem_id
    AND (COALESCE(a.n, 0) = 0 OR a.soma <> i.kg_pedido);
  IF v_itens_ruins > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'alocacao_incompleta',
      'erro', 'Itens sem alocacao completa', 'itens_pendentes', v_itens_ruins);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ordem_compra_item i
    JOIN public.ordem_compra_item_alocacao a ON a.item_id = i.id
    JOIN public.necessidade_compra_fio n ON n.id = a.necessidade_id
    WHERE i.ordem_id = p_ordem_id
      AND (   n.pedido_id     IS DISTINCT FROM v_ordem.pedido_id
           OR n.material      <> i.material
           OR n.cor_id        IS DISTINCT FROM i.cor_id
           OR n.cor_poliester IS DISTINCT FROM i.cor_poliester )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'alocacao_incoerente',
      'erro', 'Alocacao com ownership/identidade incoerente');
  END IF;

  -- db/103b (9.9.E): the SUPPLIER column is the sole emission authority.
  -- public.ordem_compra_config.exige_aceite is demoted in section 2 and is
  -- deliberately NOT read here. fornecedores.exige_aceite is NOT NULL, so
  -- no "row predates the column" fallback exists (9.9.E.4); the only
  -- reachable failure is an absent supplier row, which the foreign key
  -- already prevents and which is refused honestly rather than defaulted.
  SELECT f.exige_aceite INTO v_exige_aceite
    FROM public.fornecedores f
   WHERE f.id = v_ordem.fornecedor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_fornecedor',
      'erro', 'Fornecedor da ordem nao encontrado');
  END IF;

  v_status_aceite := CASE WHEN v_exige_aceite THEN 'pendente' ELSE 'nao_aplicavel' END;

  UPDATE public.ordem_compra
  SET status_administrativo     = 'emitida',
      aceite_exigido_na_emissao = v_exige_aceite,
      status_aceite             = v_status_aceite,
      emitida_em                = now(),
      emitida_por               = auth.uid()
  WHERE id = p_ordem_id;

  INSERT INTO public.ordem_compra_eventos
    (ordem_compra_id, dimensao, tipo_evento, valor_anterior, valor_novo, payload, criado_por)
  VALUES (p_ordem_id, 'administrativo', 'emitida', 'rascunho', 'emitida',
    jsonb_build_object('aceite_exigido_na_emissao', v_exige_aceite,
                       'status_aceite', v_status_aceite,
                       'aceite_origem', 'fornecedor',
                       'fornecedor_id', v_ordem.fornecedor_id),
    auth.uid());

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id, 'status_administrativo', 'emitida', 'status_aceite', v_status_aceite);
END;
$function$;

ALTER FUNCTION public.emitir_ordem_compra(BIGINT) OWNER TO postgres;

COMMENT ON FUNCTION public.emitir_ordem_compra(BIGINT) IS
  'db/66/db/77, emission authority switched by db/103b (9.9.E, phase P4): freezes public.fornecedores.exige_aceite of the order''s own supplier into ordem_compra.aceite_exigido_na_emissao and derives status_aceite. public.ordem_compra_config.exige_aceite is demoted and is no longer read by any emission path.';

-- CREATE OR REPLACE preserves the existing ACL; section 4 asserts that the
-- measured ACL is still exactly postgres=X/postgres,authenticated=X/postgres
-- rather than restating a normalized set that could differ from it.

-- ---------------------------------------------------------------------
-- 2. The global singleton is demoted from authority (9.9.E.3)
--
-- The trigger fires only when the demoted column would actually change,
-- so atualizado_em/atualizado_por and any future configuration column
-- remain writable. Demotion is not deletion: the column is preserved and
-- keeps its historical value.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_oc_config_aceite_descontinuada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.exige_aceite IS DISTINCT FROM OLD.exige_aceite THEN
    RAISE EXCEPTION 'config_aceite_descontinuada'
      USING ERRCODE = '42501',
            DETAIL  = 'public.ordem_compra_config.exige_aceite was demoted from authority by db/103b (9.9.E.3); public.fornecedores.exige_aceite is the sole acceptance authority';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_oc_config_aceite_descontinuada() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_oc_config_aceite_descontinuada() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_oc_config_aceite_descontinuada() FROM anon;
REVOKE ALL ON FUNCTION public.trg_oc_config_aceite_descontinuada() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_oc_config_aceite_descontinuada() FROM service_role;

DROP TRIGGER IF EXISTS ordem_compra_config_aceite_democao_guard ON public.ordem_compra_config;
CREATE TRIGGER ordem_compra_config_aceite_democao_guard
BEFORE UPDATE ON public.ordem_compra_config
FOR EACH ROW EXECUTE FUNCTION public.trg_oc_config_aceite_descontinuada();

COMMENT ON COLUMN public.ordem_compra_config.exige_aceite IS
  'DEMOTED by db/103b (9.9.E.3, phase P4): read-only and NON-AUTHORITATIVE. It is preserved as the historical seed of public.fornecedores.exige_aceite, which is the sole acceptance authority. Any UPDATE that would change it raises config_aceite_descontinuada (42501). The column is deliberately NOT dropped in this release.';

-- ---------------------------------------------------------------------
-- 3. Idempotency guard for the demotion trigger function
--
-- The function is owner-only and unreachable by every client role; a
-- trigger function is invoked by the executor, never by a grantee.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. Self-verification — fail closed inside the same transaction
-- ---------------------------------------------------------------------
DO $db103b$
DECLARE
  v_src           TEXT;
  v_acl           TEXT;
  v_owner         TEXT;
  v_ordens_drift  INT;
  v_forn_drift    INT;
  v_config        BOOLEAN;
  v_refused       BOOLEAN := FALSE;
BEGIN
  SELECT p.prosrc, COALESCE(array_to_string(p.proacl, ','), 'NULL'),
         pg_get_userbyid(p.proowner)
    INTO v_src, v_acl, v_owner
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'emitir_ordem_compra';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'db/103b: emitir_ordem_compra is absent';
  END IF;

  -- 4.1 The supplier column is now the emission authority, and the global
  --     singleton is no longer read by emission. This is the exact
  --     inversion of the db/103 section 8.4 P1 assertion.
  IF v_src NOT LIKE '%public.fornecedores%' THEN
    RAISE EXCEPTION 'db/103b: emitir_ordem_compra does not read fornecedores.exige_aceite';
  END IF;
  -- Matched as a SQL REFERENCE, not as a bare name: the body's own
  -- explanatory comment names the demoted table in prose, and a substring
  -- test would flag that comment as if it were a read.
  IF v_src ~* '(from|join|into|update)[[:space:]]+public\.ordem_compra_config' THEN
    RAISE EXCEPTION 'db/103b: emitir_ordem_compra still reads the demoted global configuration';
  END IF;

  -- 4.2 Every pre-existing validation branch survived, term for term.
  IF v_src NOT LIKE '%sem_permissao%'
     OR v_src NOT LIKE '%nao_encontrada%'
     OR v_src NOT LIKE '%ordem_legado%'
     OR v_src NOT LIKE '%estado_invalido%'
     OR v_src NOT LIKE '%sem_fornecedor%'
     OR v_src NOT LIKE '%sem_itens%'
     OR v_src NOT LIKE '%alocacao_incompleta%'
     OR v_src NOT LIKE '%alocacao_incoerente%' THEN
    RAISE EXCEPTION 'db/103b: an emission validation branch was lost';
  END IF;

  -- 4.3 Declared properties and authority are unchanged. The ACL is
  --     compared as a SET through aclexplode, never by substring.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND p.prosecdef
       AND p.prorettype = 'jsonb'::regtype
  ) THEN
    RAISE EXCEPTION 'db/103b: SECURITY DEFINER or return type drifted';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'db/103b: emitir_ordem_compra owner is %, expected postgres', v_owner;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p, LATERAL aclexplode(p.proacl) a
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND (a.grantee = 0
            OR pg_catalog.pg_get_userbyid(a.grantee) NOT IN ('postgres', 'authenticated')
            OR a.privilege_type <> 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'db/103b: emission authority was BROADENED, measured %', v_acl;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p, LATERAL aclexplode(p.proacl) a
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'emitir_ordem_compra'
       AND pg_catalog.pg_get_userbyid(a.grantee) = 'authenticated'
       AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'db/103b: authenticated lost EXECUTE on emitir_ordem_compra, measured %', v_acl;
  END IF;

  -- 4.4 The demotion trigger exists and is BEFORE UPDATE on the singleton.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal
       AND c.relnamespace = 'public'::regnamespace
       AND c.relname = 'ordem_compra_config'
       AND t.tgname = 'ordem_compra_config_aceite_democao_guard'
  ) THEN
    RAISE EXCEPTION 'db/103b: the configuration demotion trigger is not installed';
  END IF;

  -- 4.5 The demotion is PROVED, not asserted: an attempt to change the
  --     demoted column is refused. The failed attempt is contained in
  --     this subtransaction and mutates nothing.
  BEGIN
    UPDATE public.ordem_compra_config
       SET exige_aceite = NOT exige_aceite
     WHERE id = 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_refused := (SQLERRM = 'config_aceite_descontinuada');
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'db/103b: the demoted configuration column is still writable';
  END IF;

  -- 4.6 No business fact moved. The two live Purchase Orders keep
  --     false / nao_aplicavel, every supplier keeps the seeded false, and
  --     the demoted singleton keeps its historical value.
  SELECT count(*) INTO v_ordens_drift
    FROM public.ordem_compra o
   WHERE o.legado = FALSE
     AND (o.aceite_exigido_na_emissao IS DISTINCT FROM FALSE
          OR o.status_aceite <> 'nao_aplicavel');
  IF v_ordens_drift > 0 THEN
    RAISE EXCEPTION 'db/103b: % live Purchase Order(s) were reclassified', v_ordens_drift;
  END IF;

  SELECT count(*) INTO v_forn_drift FROM public.fornecedores WHERE exige_aceite IS DISTINCT FROM FALSE;
  IF v_forn_drift > 0 THEN
    RAISE EXCEPTION 'db/103b: % supplier row(s) changed acceptance requirement', v_forn_drift;
  END IF;

  SELECT exige_aceite INTO v_config FROM public.ordem_compra_config WHERE id = 1;
  IF v_config IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'db/103b: the demoted configuration value changed';
  END IF;

  -- 4.7 The cutover is untouched and the PONR is uncrossed. db/103b is
  --     not a cutover step and must not become one.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1
     AND status = 'legacy_active'
     AND read_authority = 'flat'
     AND productive_receipt_started_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/103b: ordem_compra_cutover is not legacy_active/flat with an uncrossed PONR';
  END IF;
END
$db103b$;

COMMIT;
