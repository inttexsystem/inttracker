-- tests/db105-status-cancelamento.integration.sql
--
-- db/105 (9.9.L, 9.9.M) — Pedido status authority and D7 cancellation.
--
-- Runs LAST for the main fixture Pedido, which by now carries a
-- registered delivery and therefore proves the strongest cancellation
-- gate. A second, delivery-free Pedido carries the successful
-- cancellation and its twelve-step compensation.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, status, criado_em)
VALUES ('94f10000-0000-4000-8000-000000000002', 940000601, 940002, DATE '2026-03-11', 'rascunho', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
VALUES (940000702, 940702, 940000601, '94f10000-0000-4000-8000-000000000002')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (940000104, 940104, 2099, 940000702, 'simulada', 'tecelagem'),
  (940000105, 940105, 2099, 940000702, 'aberta',   'tecelagem')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos, metros_ajustados) VALUES
  (940000114, 940000104, 940000301, 100.00, 60.00),
  (940000115, 940000105, 940000301, 100.00, NULL)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
VALUES (940000504, '94f10000-0000-4000-8000-000000000002', 'op', 940000104,
        'algodao', 940000201, NULL, 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;
-- One rascunho and one emitida Purchase Order: BOTH must be cancelled.
INSERT INTO public.ordem_compra
  (id, pedido_id, fornecedor_id, status_administrativo, status_aceite, status_recebimento,
   aceite_exigido_na_emissao, legado, emitida_em)
VALUES
  (940000803, '94f10000-0000-4000-8000-000000000002', 940000401, 'rascunho', 'nao_aplicavel', 'nao_recebido', FALSE, FALSE, NULL),
  (940000804, '94f10000-0000-4000-8000-000000000002', 940000402, 'emitida',  'aceita',        'nao_recebido', TRUE,  FALSE, now())
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

DO $t$
DECLARE
  v_admin CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_ped   CONSTANT UUID := '94f10000-0000-4000-8000-000000000001';
  v_ped2  CONSTANT UUID := '94f10000-0000-4000-8000-000000000002';
  v_res   JSONB;
  v_rev   BIGINT;
  v_n     INTEGER;
  v_ajuste NUMERIC(10,2);
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- =================================================================
  -- A. THE PUBLIC WRITER ACCEPTS ONLY ITS TWO OPERATOR TRANSITIONS
  -- =================================================================
  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped2;
  v_res := public.alterar_status_pedido(v_ped2, 'produzindo', v_rev);
  IF v_res ->> 'codigo' <> 'PEDIDO_TRANSICAO_NAO_PERMITIDA' THEN
    RAISE EXCEPTION 'not ok - A1: a DERIVED transition was accepted by the public writer (%)', v_res;
  END IF;
  v_res := public.alterar_status_pedido(v_ped2, 'entregue', v_rev);
  IF v_res ->> 'codigo' <> 'PEDIDO_TRANSICAO_NAO_PERMITIDA' THEN
    RAISE EXCEPTION 'not ok - A2: entregue was reachable from the public writer (%)', v_res;
  END IF;

  v_res := public.alterar_status_pedido(v_ped2, 'recebido', v_rev);
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A3: rascunho -> recebido was refused (%)', v_res;
  END IF;
  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped2;
  v_res := public.alterar_status_pedido(v_ped2, 'confirmado', v_rev);
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A4: recebido -> confirmado was refused (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - A: only rascunho->recebido and recebido->confirmado pass the public writer';

  -- =================================================================
  -- B. A STALE REVISION LOSES
  -- =================================================================
  v_res := public.alterar_status_pedido(v_ped2, 'recebido', 1);
  IF v_res ->> 'codigo' <> 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA' THEN
    RAISE EXCEPTION 'not ok - B: a stale revision was accepted (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - B: a stale base revision is refused';

  -- =================================================================
  -- C. THE DERIVED AUTHORITY IS OWNER-ONLY AT RUNTIME
  -- =================================================================
  DECLARE v_denied BOOLEAN := FALSE;
  BEGIN
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public._pedido_status_recalcular(v_ped2, 'ataque');
    EXCEPTION WHEN insufficient_privilege THEN v_denied := TRUE;
    END;
    RESET ROLE;
    IF NOT v_denied THEN
      RAISE EXCEPTION 'not ok - C: an authenticated client reached the derived transition authority';
    END IF;
  END;
  RAISE NOTICE 'ok - C: _pedido_status_recalcular is unreachable from an authenticated session';

  -- =================================================================
  -- D. THE CANCELLATION GATE — a registered delivery blocks it
  -- =================================================================
  v_res := public.pedido_elegivel_cancelamento(v_ped);
  IF COALESCE((v_res ->> 'elegivel')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - D1: a Pedido with a registered delivery is eligible (%)', v_res;
  END IF;
  IF v_res ->> 'codigo' <> 'PEDIDO_COM_ENTREGA_REGISTRADA' THEN
    RAISE EXCEPTION 'not ok - D2: unexpected gate identity (%)', v_res;
  END IF;

  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped;
  v_res := public.cancelar_pedido(v_ped, v_rev, 'tentativa indevida');
  IF v_res ->> 'codigo' <> 'PEDIDO_COM_ENTREGA_REGISTRADA' THEN
    RAISE EXCEPTION 'not ok - D3: cancellation bypassed the delivery gate (%)', v_res;
  END IF;
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) = 'cancelado' THEN
    RAISE EXCEPTION 'not ok - D4: a refused cancellation still cancelled the Pedido';
  END IF;
  RAISE NOTICE 'ok - D: PEDIDO_COM_ENTREGA_REGISTRADA blocks the gate and the writer alike';

  -- A motive is mandatory.
  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped2;
  v_res := public.cancelar_pedido(v_ped2, v_rev, '   ');
  IF v_res ->> 'codigo' <> 'CANCELAMENTO_MOTIVO_OBRIGATORIO' THEN
    RAISE EXCEPTION 'not ok - D5: a motiveless cancellation was accepted (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - D5: cancellation without a motive is refused';

  -- =================================================================
  -- E. THE TWELVE-STEP COMPENSATION APPLIES IN ONE TRANSACTION
  -- =================================================================
  SELECT metros_ajustados INTO v_ajuste FROM public.op_itens WHERE id = 940000114;
  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped2;
  v_res := public.cancelar_pedido(v_ped2, v_rev, 'cancelamento comercial');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - E1: a legitimate cancellation was refused (%)', v_res;
  END IF;

  IF (SELECT status FROM public.pedidos WHERE id = v_ped2) <> 'cancelado' THEN
    RAISE EXCEPTION 'not ok - E2: the Pedido is not cancelado';
  END IF;

  -- Step 3: every ACTIVE OP is cancelled.
  SELECT count(*) INTO v_n FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id
   WHERE lt.pedido_id = v_ped2 AND o.status <> 'cancelada';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - E3: % active OP(s) survived the cancellation', v_n;
  END IF;

  -- Step 5: saved adjustments are PRESERVED VERBATIM; they simply stop reserving.
  IF (SELECT metros_ajustados FROM public.op_itens WHERE id = 940000114) IS DISTINCT FROM v_ajuste THEN
    RAISE EXCEPTION 'not ok - E4: a saved adjustment was destroyed by cancellation';
  END IF;
  -- Step 4: the reservation is released IMPLICITLY.
  IF (SELECT r.kg_reservado + r.kg_comprometido
        FROM public._oc_reserva_ativa(v_ped2, 'algodao', 940000201, NULL, NULL, NULL) r) <> 0 THEN
    RAISE EXCEPTION 'not ok - E5: a cancelled OP still reserves material';
  END IF;

  -- Steps 7/8/9: rascunho, emitida AND accepted Purchase Orders are cancelled.
  SELECT count(*) INTO v_n FROM public.ordem_compra
   WHERE pedido_id = v_ped2 AND status_administrativo <> 'cancelada';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - E6: % Purchase Order(s) survived the cancellation', v_n;
  END IF;
  -- The acceptance history is intact.
  IF (SELECT status_aceite FROM public.ordem_compra WHERE id = 940000804) <> 'aceita' THEN
    RAISE EXCEPTION 'not ok - E7: the acceptance history was rewritten by cancellation';
  END IF;
  RAISE NOTICE 'ok - E: cancellation cancelled % OP(s) and % Purchase Order(s), preserved adjustments and acceptance history',
    v_res ->> 'ops_canceladas', v_res ->> 'ordens_compra_canceladas';

  -- =================================================================
  -- F. CANCELLATION IS TERMINAL AND BLOCKS THE PRODUCTION WRITERS
  -- =================================================================
  v_res := public.pedido_elegivel_cancelamento(v_ped2);
  IF v_res ->> 'codigo' <> 'PEDIDO_JA_CANCELADO' THEN
    RAISE EXCEPTION 'not ok - F1: a cancelled Pedido is not reported as already cancelled (%)', v_res;
  END IF;

  v_res := public.salvar_ajuste_producao_op(940000105, 0,
             '[{"op_item_id":940000115,"metros_ajustados":10.00}]'::JSONB);
  IF v_res ->> 'codigo' NOT IN ('PEDIDO_CANCELADO', 'AJUSTE_OP_ESTADO_INVALIDO') THEN
    RAISE EXCEPTION 'not ok - F2: the adjustment writer accepted a cancelled Pedido (%)', v_res;
  END IF;

  v_res := public.iniciar_producao_op(940000105, 0);
  IF v_res ->> 'codigo' NOT IN ('PEDIDO_CANCELADO', 'INICIO_OP_ESTADO_INVALIDO') THEN
    RAISE EXCEPTION 'not ok - F3: production start accepted a cancelled Pedido (%)', v_res;
  END IF;

  v_res := public.alterar_status_pedido(v_ped2, 'recebido', NULL);
  IF v_res ->> 'codigo' <> 'PEDIDO_CANCELADO' THEN
    RAISE EXCEPTION 'not ok - F4: a cancelled Pedido accepted a status change (%)', v_res;
  END IF;
  RAISE NOTICE 'ok - F: a cancelled Pedido is terminal and refuses the production and status writers';

  -- =================================================================
  -- G. NO RECEIPT, EXPEDITION OR DELIVERY FACT WAS DELETED
  -- =================================================================
  IF (SELECT count(*) FROM public.ordem_compra_fio_lancamentos
       WHERE recebimento_id IS NOT NULL) = 0 THEN
    RAISE EXCEPTION 'not ok - G1: receipt ledger facts were removed';
  END IF;
  IF (SELECT count(*) FROM public.expedicao_itens) = 0 THEN
    RAISE EXCEPTION 'not ok - G2: expedition facts were removed';
  END IF;
  RAISE NOTICE 'ok - G: receipt, expedition and delivery facts are untouched by cancellation';

  -- =================================================================
  -- H. P1 INSTALLS NO DIRECT-DML CONTAINMENT (db/106 owns that, in P4)
  -- =================================================================
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
              AND proname = 'trg_fato_protegido_fence') THEN
    RAISE EXCEPTION 'not ok - H1: the P4 containment fence exists in P1';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.pedidos', 'UPDATE') THEN
    RAISE EXCEPTION 'not ok - H2: P1 revoked an existing business grant on pedidos';
  END IF;
  RAISE NOTICE 'ok - H: no containment fence and no revoked grant — db/106 remains P4 work';
END
$t$;

SELECT 'DB105_STATUS_CANCELAMENTO_PASS' AS marker;
