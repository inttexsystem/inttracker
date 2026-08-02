-- tests/db101-disponibilidade-origem.integration.sql
--
-- db/101 (9.9.A) — origin-scope aware availability, and binding
-- supervisor ruling TD1 (9.9.H).
--
-- CEILING SEMANTIC CORRECTED BY db/118
-- (RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1): actual
-- received material is the production input, so the real surplus of the
-- (Pedido, material, colour) axis is a term of the ceiling and no longer
-- a report-only column. Everything else this suite asserts — origin
-- scoping, sibling isolation on the OWN allocated net, the shared
-- Pedido-origin pool, the un-subtracted own reservation, TD1 and the
-- no-view rule — is UNCHANGED.
--
-- Runs as postgres on the disposable cluster, impersonating the admin
-- through request.jwt.claim.sub. Emits DB101_DISPONIBILIDADE_PASS only
-- when every assertion holds; any failure raises and psql stops.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin      CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_op1        CONSTANT BIGINT := 940000101;
  v_op2        CONSTANT BIGINT := 940000102;
  v_cor1       CONSTANT BIGINT := 940000201;
  v_ped        CONSTANT UUID := '94f10000-0000-4000-8000-000000000001';
  r            RECORD;
  v_teto_alg   NUMERIC(12,3);
  v_teto_pol   NUMERIC(12,3);
  v_exc        NUMERIC(12,3);
  v_liq        NUMERIC(12,3);
  v_saldo      NUMERIC(12,3);
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- =================================================================
  -- A. OP-ORIGIN COTTON IS SCOPED TO THE TARGET OP
  -- =================================================================
  SELECT d.kg_disponivel, d.kg_excedente, d.kg_recebido_liquido
    INTO v_teto_alg, v_exc, v_liq
    FROM public.oc_disponibilidade_op(v_op1) d
   WHERE d.material = 'algodao' AND d.cor_id = v_cor1;

  IF v_teto_alg IS NULL THEN
    RAISE EXCEPTION 'not ok - A1: no cotton axis returned for OP1';
  END IF;

  -- 100 kg allocation-destined were received against OP1's own need.
  IF v_liq <> 100.000 THEN
    RAISE EXCEPTION 'not ok - A2: productive net for OP1 cotton = % (expected 100.000)', v_liq;
  END IF;

  -- REAL RECEIVED SURPLUS IS PRODUCTION MATERIAL (9.9.A.1, corrected by
  -- db/118). The fixture planted a 999.000 kg surplus line on the same
  -- order, allocation-free and OP-free. No other OP has reserved yet, so
  -- the whole shared pool is still available to OP1.
  IF v_exc <> 999.000 THEN
    RAISE EXCEPTION 'not ok - A3: surplus not reported (got %)', v_exc;
  END IF;
  IF v_teto_alg <> 1099.000 THEN
    RAISE EXCEPTION 'not ok - A4: real received surplus did not reach the OP1 cotton ceiling (% <> 1099.000)', v_teto_alg;
  END IF;
  RAISE NOTICE 'ok - A: OP-origin cotton ceiling is the real received material — 100.000 allocated + 999.000 shared surplus = 1099.000';

  -- =================================================================
  -- B. SIBLING OP RESERVATIONS DO NOT REDUCE OP-ORIGIN COTTON
  --    OP2 shares the colour and now reserves 50 kg of it.
  -- =================================================================
  UPDATE public.op_itens SET metros_ajustados = 100.00 WHERE op_id = v_op2;

  SELECT r2.kg_reservado + r2.kg_comprometido INTO v_saldo
    FROM public._oc_reserva_ativa(v_ped, 'algodao', v_cor1, NULL, NULL, v_op2) r2;
  IF v_saldo <> 50.000 THEN
    RAISE EXCEPTION 'not ok - B1: OP2 should reserve 50.000 kg cotton, got %', v_saldo;
  END IF;

  SELECT d.kg_disponivel INTO v_teto_alg
    FROM public.oc_disponibilidade_op(v_op1) d
   WHERE d.material = 'algodao' AND d.cor_id = v_cor1;
  -- OP2's 50.000 kg reservation is fully covered by OP2's OWN 100.000 kg
  -- productive net, so it draws NOTHING from the shared surplus pool and
  -- OP1's ceiling is untouched (9.9.A.2, preserved by db/118).
  IF v_teto_alg <> 1099.000 THEN
    RAISE EXCEPTION 'not ok - B2: a SIBLING OP reservation reduced OP1 cotton (% <> 1099.000)', v_teto_alg;
  END IF;
  RAISE NOTICE 'ok - B: sibling OP reserves 50.000 kg of the SAME colour from its OWN net and OP1 cotton stays 1099.000';

  -- =================================================================
  -- C. PEDIDO-ORIGIN POLYESTER IS A SHARED POOL THAT OTHER OPs REDUCE
  --    Pool = 200.000; OP2 reserves 25.000 -> OP1 ceiling = 175.000.
  -- =================================================================
  SELECT d.kg_disponivel, d.kg_reservado_outras_ops
    INTO v_teto_pol, v_saldo
    FROM public.oc_disponibilidade_op(v_op1) d
   WHERE d.material = 'poliester' AND d.cor_poliester = 'PRETO';

  IF v_saldo <> 25.000 THEN
    RAISE EXCEPTION 'not ok - C1: other-OP polyester reservation = % (expected 25.000)', v_saldo;
  END IF;
  IF v_teto_pol <> 175.000 THEN
    RAISE EXCEPTION 'not ok - C2: shared polyester ceiling = % (expected 200.000 - 25.000 = 175.000)', v_teto_pol;
  END IF;
  RAISE NOTICE 'ok - C: shared Pedido polyester pool 200.000 reduced by the other OP to 175.000';

  -- =================================================================
  -- D. THE TARGET OP'S OWN RESERVATION IS NOT SUBTRACTED
  --    A replacement payload validates against the RAW ceiling.
  -- =================================================================
  UPDATE public.op_itens SET metros_ajustados = 100.00 WHERE op_id = v_op1;

  SELECT d.kg_disponivel, d.kg_reservado_propria_op
    INTO v_teto_pol, v_saldo
    FROM public.oc_disponibilidade_op(v_op1) d
   WHERE d.material = 'poliester' AND d.cor_poliester = 'PRETO';
  IF v_saldo <> 25.000 THEN
    RAISE EXCEPTION 'not ok - D1: own reservation not reported (got %)', v_saldo;
  END IF;
  IF v_teto_pol <> 175.000 THEN
    RAISE EXCEPTION 'not ok - D2: the OP''s OWN reservation was subtracted (% <> 175.000)', v_teto_pol;
  END IF;
  RAISE NOTICE 'ok - D: the target OP''s own 25.000 kg reservation is reported but never subtracted';

  -- =================================================================
  -- E. TD1 — PRESERVED saldo_fios YIELDS ZERO OP AVAILABILITY
  -- =================================================================
  SELECT coalesce(sum(s.kg_total), 0) INTO v_saldo
    FROM public.saldo_fios s WHERE s.tipo = 'algodao';
  IF v_saldo <= 0 THEN
    RAISE EXCEPTION 'not ok - E0: the fixture must carry non-zero historical cotton stock';
  END IF;

  -- Add a further preserved balance on a colour with NO ledger line at
  -- all, and prove it produces no availability anywhere.
  SET session_replication_role = replica;
  INSERT INTO public.saldo_fios (tipo, cor_id, cor_poliester, kg_total)
  VALUES ('algodao', 940000202, NULL, 5000.000);
  SET session_replication_role = origin;

  FOR r IN SELECT * FROM public.oc_disponibilidade_op(v_op1) LOOP
    IF r.cor_id = 940000202 THEN
      RAISE EXCEPTION 'not ok - E1: a saldo_fios-only colour appeared as an availability axis';
    END IF;
  END LOOP;

  SELECT public._oc_material_recebido_liquido(v_ped, v_op1, 'op', 'algodao', 940000202, NULL)
    INTO v_liq;
  IF v_liq <> 0 THEN
    RAISE EXCEPTION 'not ok - E2: TD1 violation — 5000.000 kg of preserved stock produced % kg of productive net', v_liq;
  END IF;

  SELECT d.kg_disponivel INTO v_teto_alg
    FROM public.oc_disponibilidade_op(v_op1) d
   WHERE d.material = 'algodao' AND d.cor_id = v_cor1;
  IF v_teto_alg <> 1099.000 THEN
    RAISE EXCEPTION 'not ok - E3: TD1 violation — preserved stock changed the cotton ceiling (%)', v_teto_alg;
  END IF;
  RAISE NOTICE 'ok - E: TD1 holds — preserved saldo_fios yields ZERO OP availability and raises no ceiling';

  -- =================================================================
  -- F. NO VIEW REACHES AN OWNER-ONLY HELPER (9.9.A.5)
  -- =================================================================
  IF EXISTS (
    SELECT 1 FROM pg_views v
     WHERE v.schemaname = 'public'
       AND v.definition ~ '_oc_disponibilidade_linhas|_oc_material_recebido_liquido|_oc_reserva_ativa'
  ) THEN
    RAISE EXCEPTION 'not ok - F: a view reaches an owner-only availability helper';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='vw_disponibilidade_op') THEN
    RAISE EXCEPTION 'not ok - F: vw_disponibilidade_op is withdrawn by 9.9.A.5 and must not exist';
  END IF;
  RAISE NOTICE 'ok - F: no view participates in the availability read path';

  -- Restore the fixture baseline for the suites that follow.
  UPDATE public.op_itens SET metros_ajustados = NULL WHERE op_id IN (v_op1, v_op2);
  SET session_replication_role = replica;
  DELETE FROM public.saldo_fios WHERE cor_id = 940000202;
  SET session_replication_role = origin;
END
$t$;

SELECT 'DB101_DISPONIBILIDADE_PASS' AS marker;
