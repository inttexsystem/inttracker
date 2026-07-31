-- tests/db108-acabamento-idempotente.integration.sql
--
-- db/108 (9.9.J) — finishing-OP transaction structure and replay identity.
--
-- Proves the four semantics that matter: the delivery SURVIVES a failed
-- creation, the failure evidence commits with it, retry is permitted
-- ONLY after a proved failure, and a replayed idempotency key returns
-- the same result and the SAME split_seq while creating nothing.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.fornecedores (id, nome, tipo)
VALUES (940000403, 'P1-FORN-TECELAGEM', 'tecelagem'),
       (940000404, 'P1-FORN-LATEX', 'latex')
  ON CONFLICT (id) DO NOTHING;

-- A weaving delivery with NO latex destination: the creation MUST fail
-- and the delivery MUST survive.
INSERT INTO public.entregas (id, fornecedor_id, etapa, data, destino_fornecedor_id, observacao)
VALUES (940000950, 940000403, 'cima', CURRENT_DATE, NULL, 'P1 entrega sem destino')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.entrega_itens (id, entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
VALUES (940000960, 940000950, 940000103, 940000113, 940000301, 40.00, FALSE)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

DO $t$
DECLARE
  v_admin CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_ent   CONSTANT BIGINT := 940000950;
  v_res   JSONB;
  v_res2  JSONB;
  v_n     INTEGER;
  v_ops   INTEGER;
  v_seq   SMALLINT;
  v_opid  BIGINT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- =================================================================
  -- A. A FAILED CREATION PRESERVES THE DELIVERY AND COMMITS EVIDENCE
  -- =================================================================
  SELECT count(*) INTO v_ops FROM public.ops WHERE tipo = 'latex';

  v_res := public.gerar_op_acabamento(v_ent, 'k-fail-1');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A1: creation succeeded despite the missing latex destination (%)', v_res;
  END IF;
  IF v_res ->> 'codigo' <> 'ACABAMENTO_CRIACAO_FALHOU' THEN
    RAISE EXCEPTION 'not ok - A2: unexpected refusal identity (%)', v_res;
  END IF;

  -- THE DELIVERY SURVIVES.
  IF NOT EXISTS (SELECT 1 FROM public.entregas WHERE id = v_ent) THEN
    RAISE EXCEPTION 'not ok - A3: the delivery was rolled back by the failed creation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.entrega_itens WHERE entrega_id = v_ent) THEN
    RAISE EXCEPTION 'not ok - A4: the delivery items were rolled back';
  END IF;

  -- NO finishing OP exists.
  IF (SELECT count(*) FROM public.ops WHERE tipo = 'latex') <> v_ops THEN
    RAISE EXCEPTION 'not ok - A5: a finishing OP survived a failed creation';
  END IF;

  -- THE FAILURE EVIDENCE COMMITTED WITH THE DELIVERY.
  SELECT count(*) INTO v_n FROM public.op_acabamento_tentativas
   WHERE origem_entrega_id = v_ent AND resultado = 'falha';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A6: expected exactly one falha attempt row, got %', v_n;
  END IF;
  IF (SELECT codigo_falha FROM public.op_acabamento_tentativas
       WHERE origem_entrega_id = v_ent AND resultado = 'falha') IS NULL THEN
    RAISE EXCEPTION 'not ok - A7: the captured SQLSTATE was not recorded';
  END IF;
  RAISE NOTICE 'ok - A: the creation failed, the DELIVERY SURVIVED and one falha attempt committed with it';

  -- =================================================================
  -- B. RETRY IS PERMITTED ONLY AFTER A PROVED FAILURE
  -- =================================================================
  IF NOT public.pode_recuperar_op_acabamento(v_ent) THEN
    RAISE EXCEPTION 'not ok - B1: recovery must be available after a proved failure';
  END IF;
  -- A delivery that never failed is NOT recoverable.
  IF public.pode_recuperar_op_acabamento(999999999) THEN
    RAISE EXCEPTION 'not ok - B2: recovery offered for a delivery with no proved failure';
  END IF;
  RAISE NOTICE 'ok - B: recovery is offered only where a proved failure exists';

  -- =================================================================
  -- C. REPLAYING THE FAILED KEY RETURNS THE STORED RESULT
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.op_acabamento_tentativas WHERE origem_entrega_id = v_ent;
  v_res2 := public.gerar_op_acabamento(v_ent, 'k-fail-1');
  IF v_res2 ->> 'codigo' <> 'ACABAMENTO_CRIACAO_FALHOU' THEN
    RAISE EXCEPTION 'not ok - C1: the replay did not return the stored failure (%)', v_res2;
  END IF;
  IF (SELECT count(*) FROM public.op_acabamento_tentativas WHERE origem_entrega_id = v_ent) <> v_n THEN
    RAISE EXCEPTION 'not ok - C2: the replay recorded a second attempt';
  END IF;
  RAISE NOTICE 'ok - C: replaying the failed key returns the stored result and records nothing new';

  -- =================================================================
  -- D. AFTER THE CAUSE IS CORRECTED, A NEW KEY SUCCEEDS
  -- =================================================================
  SET session_replication_role = replica;
  UPDATE public.entregas SET destino_fornecedor_id = 940000404 WHERE id = v_ent;
  SET session_replication_role = origin;

  v_res := public.gerar_op_acabamento(v_ent, 'k-ok-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - D1: the corrected retry was refused (%)', v_res;
  END IF;
  v_opid := (v_res ->> 'op_latex_id')::BIGINT;
  v_seq  := (v_res ->> 'split_seq')::SMALLINT;

  IF (SELECT origem_entrega_id FROM public.ops WHERE id = v_opid) <> v_ent THEN
    RAISE EXCEPTION 'not ok - D2: the finishing OP does not carry its origin delivery';
  END IF;
  IF (SELECT split_seq FROM public.ops WHERE id = v_opid) <> v_seq THEN
    RAISE EXCEPTION 'not ok - D3: the OP split_seq does not match the command';
  END IF;
  SELECT count(*) INTO v_n FROM public.op_acabamento_tentativas
   WHERE origem_entrega_id = v_ent AND resultado = 'sucesso';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - D4: the success attempt was not recorded once';
  END IF;
  IF public.pode_recuperar_op_acabamento(v_ent) THEN
    RAISE EXCEPTION 'not ok - D5: recovery is still offered after a canonical OP exists';
  END IF;
  RAISE NOTICE 'ok - D: the corrected retry created finishing OP % at split_seq % and closed recovery', v_opid, v_seq;

  -- =================================================================
  -- E. REPLAY IS STABLE — SAME RESULT, SAME split_seq, NOTHING CREATED
  -- =================================================================
  SELECT count(*) INTO v_ops FROM public.ops WHERE tipo = 'latex';
  v_res2 := public.gerar_op_acabamento(v_ent, 'k-ok-1');
  IF (v_res2 ->> 'op_latex_id')::BIGINT <> v_opid THEN
    RAISE EXCEPTION 'not ok - E1: the replay returned a different OP';
  END IF;
  IF (v_res2 ->> 'split_seq')::SMALLINT <> v_seq THEN
    RAISE EXCEPTION 'not ok - E2: the replay returned a different split_seq (% vs %)',
      v_res2 ->> 'split_seq', v_seq;
  END IF;
  IF (SELECT count(*) FROM public.ops WHERE tipo = 'latex') <> v_ops THEN
    RAISE EXCEPTION 'not ok - E3: the replay created a second finishing OP';
  END IF;
  RAISE NOTICE 'ok - E: the replayed key returns the SAME OP and the SAME split_seq and creates nothing';

  -- =================================================================
  -- F. A CONFLICTING PAYLOAD ON THE SAME KEY IS REFUSED
  -- =================================================================
  v_res2 := public.gerar_op_acabamento(v_ent, 'k-ok-1', 'motivo diferente');
  IF v_res2 ->> 'codigo' <> 'comando_conflitante' THEN
    RAISE EXCEPTION 'not ok - F: a conflicting payload reused the key (%)', v_res2;
  END IF;
  RAISE NOTICE 'ok - F: the same key with a different payload is refused as comando_conflitante';

  -- =================================================================
  -- G. THE COMPATIBILITY WRAPPER KEEPS ITS CONTRACT
  -- =================================================================
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'gerar_op_latex_split'
       AND pg_get_function_identity_arguments(p.oid) = 'p_entrega_id bigint, p_motivo text') THEN
    RAISE EXCEPTION 'not ok - G1: gerar_op_latex_split lost its exact signature';
  END IF;

  -- Its historical "already linked" payload is preserved.
  v_res2 := public.gerar_op_latex_split(v_ent, 'motivo qualquer');
  IF COALESCE((v_res2 ->> 'already_linked')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - G2: the wrapper lost its already-linked contract (%)', v_res2;
  END IF;

  -- Its historical RAISE-on-missing-motive contract is preserved.
  BEGIN
    v_res2 := public.gerar_op_latex_split(v_ent, '   ');
    RAISE EXCEPTION 'not ok - G3: the wrapper accepted an empty motive';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'not ok%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'ok - G: the compatibility wrapper keeps its signature, payload and RAISE contract';

  -- =================================================================
  -- H. THE EVIDENCE TABLES ARE APPEND-ONLY
  -- =================================================================
  BEGIN
    UPDATE public.op_acabamento_tentativas SET resultado = 'sucesso' WHERE origem_entrega_id = v_ent;
    RAISE EXCEPTION 'not ok - H: the attempt evidence is mutable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'not ok%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'ok - H: op_acabamento_tentativas is append-only';
END
$t$;

SELECT 'DB108_ACABAMENTO_PASS' AS marker;
