-- tests/db109-estorno-tapete-correcao-entrega.integration.sql
--
-- db/109 (9.9.K) — Tapete expedition reversal and delivery correction.
--
-- Depends on the finishing OP db108 created: the Tapete route releases
-- from an Acabamento/Latex source. Proves the exact released and
-- delivered guards, command idempotency, and the D1 recomputation that
-- returns an incomplete non-cancelled Pedido from entregue to produzindo.

\set ON_ERROR_STOP on

-- One expedition over the finishing OP produced by db108.
DO $seed$
DECLARE v_op BIGINT; v_item BIGINT;
BEGIN
  SELECT o.id INTO v_op FROM public.ops o
   WHERE o.tipo = 'latex' AND o.origem_entrega_id = 940000950 LIMIT 1;
  IF v_op IS NULL THEN
    RAISE EXCEPTION 'not ok - seed: db108 must have created the finishing OP first';
  END IF;
  SELECT oi.id INTO v_item FROM public.op_itens oi WHERE oi.op_id = v_op ORDER BY oi.id LIMIT 1;

  SET session_replication_role = replica;
  INSERT INTO public.expedicoes (id, pedido_id, op_latex_id, lote_id, cliente_id, status)
  VALUES (940000970, '94f10000-0000-4000-8000-000000000001', v_op, 940000701, 940000601, 'aguardando_expedicao')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.expedicao_itens (id, expedicao_id, op_item_id, modelo_id, metros_liberados, metros_entregues)
  VALUES (940000980, 940000970, v_item, 940000301, 40.00, 0.00)
    ON CONFLICT (id) DO NOTHING;
  SET session_replication_role = origin;
END
$seed$;

DO $t$
DECLARE
  v_admin CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_exp   CONSTANT BIGINT := 940000970;
  v_ped   CONSTANT UUID := '94f10000-0000-4000-8000-000000000001';
  v_item  BIGINT;
  v_res   JSONB;
  v_n     INTEGER;
  v_lib   NUMERIC(10,2);
  v_ent   NUMERIC(10,2);
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);
  SELECT op_item_id INTO v_item FROM public.expedicao_itens WHERE id = 940000980;

  -- =================================================================
  -- A. NO REVERSAL ABOVE THE RELEASED QUANTITY
  -- =================================================================
  v_res := public.estornar_expedicao_tapete_parcial(v_exp,
             format('[{"op_item_id":%s,"metros":50.00}]', v_item)::JSONB, 'excesso');
  IF v_res ->> 'codigo' <> 'ESTORNO_ACIMA_DO_LIBERADO' THEN
    RAISE EXCEPTION 'not ok - A1: a reversal above the released quantity was accepted (%)', v_res;
  END IF;
  SELECT metros_liberados INTO v_lib FROM public.expedicao_itens WHERE id = 940000980;
  IF v_lib <> 40.00 THEN
    RAISE EXCEPTION 'not ok - A2: a refused reversal wrote to expedicao_itens';
  END IF;
  RAISE NOTICE 'ok - A: reversal above the released quantity is refused with ZERO writes';

  -- =================================================================
  -- B. NO REVERSAL BELOW THE DELIVERED QUANTITY
  --    Deliver 30 of the 40 released, then try to reverse 20.
  -- =================================================================
  SET session_replication_role = replica;
  UPDATE public.expedicao_itens SET metros_entregues = 30.00 WHERE id = 940000980;
  SET session_replication_role = origin;

  v_res := public.estornar_expedicao_tapete_parcial(v_exp,
             format('[{"op_item_id":%s,"metros":20.00}]', v_item)::JSONB, 'abaixo do entregue');
  IF v_res ->> 'codigo' <> 'ESTORNO_ABAIXO_DO_ENTREGUE' THEN
    RAISE EXCEPTION 'not ok - B1: a reversal below the delivered quantity was accepted (%)', v_res;
  END IF;
  SELECT metros_liberados INTO v_lib FROM public.expedicao_itens WHERE id = 940000980;
  IF v_lib <> 40.00 THEN
    RAISE EXCEPTION 'not ok - B2: a refused reversal wrote to expedicao_itens';
  END IF;
  RAISE NOTICE 'ok - B: reversal below the delivered quantity is refused with ZERO writes';

  -- =================================================================
  -- C. A LEGAL REVERSAL APPLIES (40 -> 30, delivered 30 preserved)
  -- =================================================================
  v_res := public.estornar_expedicao_tapete_parcial(v_exp,
             format('[{"op_item_id":%s,"metros":10.00}]', v_item)::JSONB,
             'ajuste legitimo', 'k-est-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - C1: a legal reversal was refused (%)', v_res;
  END IF;
  SELECT metros_liberados, metros_entregues INTO v_lib, v_ent
    FROM public.expedicao_itens WHERE id = 940000980;
  IF v_lib <> 30.00 OR v_ent <> 30.00 THEN
    RAISE EXCEPTION 'not ok - C2: expected 30.00 released / 30.00 delivered, got % / %', v_lib, v_ent;
  END IF;
  SELECT count(*) INTO v_n FROM public.op_eventos WHERE tipo_evento = 'expedicao_estornada';
  IF v_n < 1 THEN
    RAISE EXCEPTION 'not ok - C3: the reversal wrote no op_eventos row';
  END IF;
  RAISE NOTICE 'ok - C: a legal reversal applies (40.00 -> 30.00) and preserves the delivered 30.00';

  -- =================================================================
  -- D. IDEMPOTENCY AND CONFLICTING REUSE
  -- =================================================================
  v_res := public.estornar_expedicao_tapete_parcial(v_exp,
             format('[{"op_item_id":%s,"metros":10.00}]', v_item)::JSONB,
             'ajuste legitimo', 'k-est-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - D1: the duplicate command did not return the stored result (%)', v_res;
  END IF;
  SELECT metros_liberados INTO v_lib FROM public.expedicao_itens WHERE id = 940000980;
  IF v_lib <> 30.00 THEN
    RAISE EXCEPTION 'not ok - D2: the duplicate command reversed a second time (now %)', v_lib;
  END IF;

  v_res := public.estornar_expedicao_tapete_parcial(v_exp,
             format('[{"op_item_id":%s,"metros":5.00}]', v_item)::JSONB,
             'outro motivo', 'k-est-1');
  IF v_res ->> 'codigo' <> 'comando_conflitante' THEN
    RAISE EXCEPTION 'not ok - D3: a conflicting payload reused the key (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - D: a duplicate command returns the stored result; conflicting reuse is refused';

  -- =================================================================
  -- E. DELIVERY CORRECTION GUARDS
  -- =================================================================
  v_res := public.corrigir_entrega_expedicao(v_exp,
             format('[{"op_item_id":%s,"metros_entregues":99.00}]', v_item)::JSONB, 'acima');
  IF v_res ->> 'codigo' <> 'CORRECAO_QUANTIDADE_INVALIDA' THEN
    RAISE EXCEPTION 'not ok - E1: a delivered quantity above the released one was accepted (%)', v_res;
  END IF;
  v_res := public.corrigir_entrega_expedicao(v_exp,
             format('[{"op_item_id":%s,"metros_entregues":-1.00}]', v_item)::JSONB, 'negativo');
  IF v_res ->> 'codigo' <> 'CORRECAO_QUANTIDADE_INVALIDA' THEN
    RAISE EXCEPTION 'not ok - E2: a negative delivered quantity was accepted (%)', v_res;
  END IF;
  SELECT metros_entregues INTO v_ent FROM public.expedicao_itens WHERE id = 940000980;
  IF v_ent <> 30.00 THEN
    RAISE EXCEPTION 'not ok - E3: a refused correction wrote to expedicao_itens';
  END IF;
  RAISE NOTICE 'ok - E: delivery correction refuses > released and < 0 with ZERO writes';

  -- =================================================================
  -- F. A COMPLETE DELIVERY DRIVES THE PEDIDO TO entregue
  -- =================================================================
  UPDATE public.pedidos SET status = 'produzindo' WHERE id = v_ped AND status <> 'produzindo';
  v_res := public.corrigir_entrega_expedicao(v_exp,
             format('[{"op_item_id":%s,"metros_entregues":30.00}]', v_item)::JSONB,
             'confirma entrega total', 'k-cor-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - F1: the correction was refused (%)', v_res;
  END IF;
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) <> 'entregue' THEN
    RAISE EXCEPTION 'not ok - F2: a complete delivery did not drive the Pedido to entregue (got %)',
      (SELECT status FROM public.pedidos WHERE id = v_ped);
  END IF;
  RAISE NOTICE 'ok - F: a complete delivery recomputes the Pedido to entregue';

  -- =================================================================
  -- G. THE D1 PROOF — an INCOMPLETE, NON-CANCELLED Pedido returns
  --    from entregue to produzindo, and NEVER to confirmado.
  -- =================================================================
  v_res := public.corrigir_entrega_expedicao(v_exp,
             format('[{"op_item_id":%s,"metros_entregues":10.00}]', v_item)::JSONB,
             'correcao para baixo', 'k-cor-2');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - G1: the downward correction was refused (%)', v_res;
  END IF;
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) <> 'produzindo' THEN
    RAISE EXCEPTION 'not ok - G2: the Pedido did not return to produzindo (got %)',
      (SELECT status FROM public.pedidos WHERE id = v_ped);
  END IF;
  IF v_res ->> 'pedido_status' <> 'produzindo' THEN
    RAISE EXCEPTION 'not ok - G3: the writer did not report the recomputed status';
  END IF;

  -- The PRIOR delivered values are preserved in the command payload.
  IF NOT EXISTS (
    SELECT 1 FROM public.expedicao_comandos
     WHERE idempotency_namespace = 'expedicao_entrega_correcao_v1'
       AND idempotency_key = 'k-cor-2'
       AND comando_payload -> 'anterior' @> '[{"metros_entregues": 30.00}]'::JSONB) THEN
    RAISE EXCEPTION 'not ok - G4: the prior delivered value was not preserved in the command payload';
  END IF;
  RAISE NOTICE 'ok - G: an incomplete non-cancelled Pedido returns entregue -> produzindo, history preserved';

  -- =================================================================
  -- H. THE ACCEPTED MANTA WRITERS ARE UNTOUCHED
  -- =================================================================
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                  AND p.proname = 'estornar_expedicao_manta_parcial') THEN
    RAISE EXCEPTION 'not ok - H: the accepted Manta reversal writer disappeared';
  END IF;
  IF (SELECT count(*) FROM pg_constraint
       WHERE conrelid = 'public.expedicao_comandos'::regclass
         AND conname = 'expedicao_comandos_idempotency_namespace_check'
         AND pg_get_constraintdef(oid) LIKE '%manta_release_v1%'
         AND pg_get_constraintdef(oid) LIKE '%manta_reversal_v1%') <> 1 THEN
    RAISE EXCEPTION 'not ok - H: the Manta namespaces were lost when the CHECK was widened';
  END IF;
  RAISE NOTICE 'ok - H: the Manta route writers and namespaces are untouched';
END
$t$;

SELECT 'DB109_ESTORNO_CORRECAO_PASS' AS marker;
