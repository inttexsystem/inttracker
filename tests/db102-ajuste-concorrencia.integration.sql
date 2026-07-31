-- tests/db102-ajuste-concorrencia.integration.sql
--
-- db/102 (9.9.C, 9.9.D) — atomic production adjustment and server-owned
-- production start. The two-session deadlock/serialisation proof lives
-- in the Node driver, which is the only place two real sessions can hold
-- locks across statements; this suite owns everything single-session.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin  CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_op1    CONSTANT BIGINT := 940000101;
  v_op3    CONSTANT BIGINT := 940000103;
  v_ped    CONSTANT UUID := '94f10000-0000-4000-8000-000000000001';
  v_item1  BIGINT;
  v_item3  BIGINT;
  v_res    JSONB;
  v_rev    INTEGER;
  v_metros NUMERIC(10,2);
  v_n      INTEGER;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);
  SELECT id INTO v_item1 FROM public.op_itens WHERE op_id = v_op1 ORDER BY id LIMIT 1;
  SELECT id INTO v_item3 FROM public.op_itens WHERE op_id = v_op3 ORDER BY id LIMIT 1;

  -- =================================================================
  -- A. THE PAYLOAD IS ABSOLUTE AND COMPLETE
  -- =================================================================
  v_res := public.salvar_ajuste_producao_op(v_op1, 0, '[]'::JSONB);
  IF v_res ->> 'codigo' <> 'AJUSTE_PAYLOAD_INCOMPLETO' THEN
    RAISE EXCEPTION 'not ok - A1: an empty payload was accepted (%)', v_res;
  END IF;

  v_res := public.salvar_ajuste_producao_op(v_op1, 0,
             format('[{"op_item_id":%s,"metros_ajustados":10.00},{"op_item_id":%s,"metros_ajustados":10.00}]',
                    v_item1, v_item3)::JSONB);
  IF v_res ->> 'codigo' <> 'AJUSTE_PAYLOAD_INCOMPLETO' THEN
    RAISE EXCEPTION 'not ok - A2: a payload naming a FOREIGN op_item was accepted (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - A: the adjustment payload must be absolute and complete';

  -- =================================================================
  -- B. THE CEILING IS ENFORCED, AND NOTHING IS WRITTEN ON REFUSAL
  --    OP1 cotton ceiling is 100.000 kg; 300 m would reserve 150.000.
  -- =================================================================
  SELECT metros_ajustados INTO v_metros FROM public.op_itens WHERE id = v_item1;
  v_res := public.salvar_ajuste_producao_op(v_op1, 0,
             format('[{"op_item_id":%s,"metros_ajustados":300.00}]', v_item1)::JSONB);
  IF v_res ->> 'codigo' <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - B1: 150.000 kg against a 100.000 kg ceiling was accepted (%)', v_res;
  END IF;
  IF (SELECT metros_ajustados FROM public.op_itens WHERE id = v_item1) IS DISTINCT FROM v_metros THEN
    RAISE EXCEPTION 'not ok - B2: a refused adjustment wrote to op_itens';
  END IF;
  IF (SELECT ajuste_revisao FROM public.ops WHERE id = v_op1) <> 0 THEN
    RAISE EXCEPTION 'not ok - B3: a refused adjustment bumped ajuste_revisao';
  END IF;
  RAISE NOTICE 'ok - B: the origin-aware ceiling refuses 150.000 kg against 100.000 with ZERO writes';

  -- =================================================================
  -- C. A VALID ADJUSTMENT APPLIES ATOMICALLY
  --    100 m -> 50.000 kg cotton and 25.000 kg polyester: both fit.
  -- =================================================================
  v_res := public.salvar_ajuste_producao_op(v_op1, 0,
             format('[{"op_item_id":%s,"metros_ajustados":100.00}]', v_item1)::JSONB);
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - C1: a valid adjustment was refused (%)', v_res;
  END IF;
  IF (SELECT metros_ajustados FROM public.op_itens WHERE id = v_item1) <> 100.00 THEN
    RAISE EXCEPTION 'not ok - C2: metros_ajustados was not applied';
  END IF;
  IF (SELECT ajuste_revisao FROM public.ops WHERE id = v_op1) <> 1 THEN
    RAISE EXCEPTION 'not ok - C3: ajuste_revisao did not advance to 1';
  END IF;

  -- The event belongs to op_eventos, never to ordem_compra_eventos (F7).
  SELECT count(*) INTO v_n FROM public.op_eventos
   WHERE op_id = v_op1 AND tipo_evento = 'ajuste_producao_salvo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - C4: expected exactly one op_eventos adjustment row, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_eventos
   WHERE tipo_evento = 'ajuste_producao_salvo';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - C5: an adjustment event leaked into ordem_compra_eventos';
  END IF;
  RAISE NOTICE 'ok - C: a valid adjustment applies, bumps ajuste_revisao to 1 and writes ONE op_eventos row';

  -- =================================================================
  -- D. THE CLIENT NEVER SUPPLIES KILOGRAMS
  --    A kg field in the payload is ignored; the server derives it.
  -- =================================================================
  v_res := public.salvar_ajuste_producao_op(v_op1, 1,
             format('[{"op_item_id":%s,"metros_ajustados":300.00,"kg":1.000}]', v_item1)::JSONB);
  IF v_res ->> 'codigo' <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - D: a client-supplied kg overrode the server-derived quantity (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - D: a client-supplied kg is ignored; the server derives kilograms from metres';

  -- =================================================================
  -- E. PRODUCTION START REQUIRES A COMPLETE ADJUSTMENT
  -- =================================================================
  v_res := public.iniciar_producao_op(v_op3, 0);
  IF v_res ->> 'codigo' <> 'INICIO_AJUSTE_INCOMPLETO' THEN
    RAISE EXCEPTION 'not ok - E1: production started with an unadjusted item (%)', v_res;
  END IF;
  IF (SELECT status FROM public.ops WHERE id = v_op3) <> 'aberta' THEN
    RAISE EXCEPTION 'not ok - E2: a refused start changed the OP status';
  END IF;
  RAISE NOTICE 'ok - E: production start refuses an incomplete adjustment and changes nothing';

  -- =================================================================
  -- F. STALE REVISION LOSES ON PRODUCTION START TOO
  -- =================================================================
  v_res := public.iniciar_producao_op(v_op1, 0);
  IF v_res ->> 'codigo' <> 'AJUSTE_REVISAO_DESATUALIZADA' THEN
    RAISE EXCEPTION 'not ok - F: a stale revision started production (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - F: production start refuses a stale ajuste_revisao';

  -- =================================================================
  -- G. PRODUCTION START IS ATOMIC
  --    OP -> em_producao, Pedido -> produzindo, saldo_fios_op written,
  --    ajuste_revisao advanced, all in ONE transaction.
  -- =================================================================
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) <> 'confirmado' THEN
    RAISE EXCEPTION 'not ok - G0: the fixture Pedido must start confirmado';
  END IF;

  v_res := public.iniciar_producao_op(v_op1, 1);
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - G1: production start was refused (%)', v_res;
  END IF;
  IF (SELECT status FROM public.ops WHERE id = v_op1) <> 'em_producao' THEN
    RAISE EXCEPTION 'not ok - G2: the OP did not transition to em_producao';
  END IF;
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) <> 'produzindo' THEN
    RAISE EXCEPTION 'not ok - G3: the Pedido was not recomputed to produzindo';
  END IF;

  -- saldo_fios_op is the AUTHORITATIVE start snapshot, written here and
  -- nowhere else. Cotton: 100.000 ceiling - 50.000 reserved = 50.000.
  -- Polyester: 200.000 ceiling - 25.000 reserved = 175.000.
  SELECT count(*) INTO v_n FROM public.saldo_fios_op WHERE op_id = v_op1;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'not ok - G4: expected 2 saldo_fios_op snapshot rows, got %', v_n;
  END IF;
  IF (SELECT kg_sobra FROM public.saldo_fios_op
       WHERE op_id = v_op1 AND tipo = 'algodao' AND cor_id = 940000201) <> 50.000 THEN
    RAISE EXCEPTION 'not ok - G5: the cotton start snapshot is not 50.000';
  END IF;
  IF (SELECT kg_sobra FROM public.saldo_fios_op
       WHERE op_id = v_op1 AND tipo = 'poliester' AND cor_poliester = 'PRETO') <> 175.000 THEN
    RAISE EXCEPTION 'not ok - G6: the polyester start snapshot is not 175.000';
  END IF;

  SELECT count(*) INTO v_n FROM public.op_eventos
   WHERE op_id = v_op1 AND tipo_evento = 'producao_iniciada';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - G7: the production-start event was not recorded once';
  END IF;
  SELECT count(*) INTO v_n FROM public.pedido_eventos
   WHERE pedido_id = v_ped AND status_novo = 'produzindo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - G8: the derived Pedido event was not recorded once';
  END IF;
  RAISE NOTICE 'ok - G: production start is atomic — OP em_producao, Pedido produzindo, 2 snapshot rows, both events';

  -- =================================================================
  -- H. AN OP IN PRODUCTION NO LONGER ACCEPTS AN ADJUSTMENT
  -- =================================================================
  SELECT ajuste_revisao INTO v_rev FROM public.ops WHERE id = v_op1;
  v_res := public.salvar_ajuste_producao_op(v_op1, v_rev,
             format('[{"op_item_id":%s,"metros_ajustados":50.00}]', v_item1)::JSONB);
  IF v_res ->> 'codigo' <> 'AJUSTE_OP_ESTADO_INVALIDO' THEN
    RAISE EXCEPTION 'not ok - H: an OP in production accepted an adjustment (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - H: an OP in production refuses further adjustment';

  -- =================================================================
  -- I. NO WRITER TARGETS ops.finalizada (9.9.L)
  -- =================================================================
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('_op_status_aplicar','salvar_ajuste_producao_op','iniciar_producao_op')
       AND p.prosrc ~ '''finalizada'''
  ) THEN
    RAISE EXCEPTION 'not ok - I: a db/102 writer targets ops.finalizada';
  END IF;
  RAISE NOTICE 'ok - I: no db/102 writer targets ops.finalizada';
END
$t$;

SELECT 'DB102_AJUSTE_PASS' AS marker;
