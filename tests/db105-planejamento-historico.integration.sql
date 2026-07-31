-- tests/db105-planejamento-historico.integration.sql
--
-- db/105 (D7, 9.9.M step 6) — planning release WITHOUT physical deletion.
--
-- The binding requirement is that a cancelled Pedido returns its need to
-- FREE BALANCE while the supplier assignment and the quantity stay
-- auditable. This suite proves both halves on a Pedido of its own, and
-- proves the narrowing is behaviour-preserving for every row that is not
-- released.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, status, criado_em)
VALUES ('94f10000-0000-4000-8000-000000000003', 940000601, 940003, DATE '2026-03-12', 'confirmado', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
VALUES (940000703, 940703, 940000601, '94f10000-0000-4000-8000-000000000003')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo)
VALUES (940000106, 940106, 2099, 940000703, 'simulada', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos)
VALUES (940000116, 940000106, 940000301, 100.00)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
VALUES (940000505, '94f10000-0000-4000-8000-000000000003', 'op', 940000106,
        'algodao', 940000201, NULL, 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;

DO $t$
DECLARE
  v_admin CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_ped3  CONSTANT UUID := '94f10000-0000-4000-8000-000000000003';
  v_need  CONSTANT BIGINT := 940000505;
  v_forn  CONSTANT BIGINT := 940000401;
  v_res   JSONB;
  v_rev   BIGINT;
  v_saldo NUMERIC(12,3);
  v_n     INTEGER;
  v_plan  RECORD;
  v_kg    NUMERIC(12,3);
  v_denied BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- =================================================================
  -- A. LIVE PLANNING CONSUMES THE NEED CEILING
  -- =================================================================
  v_res := public.definir_planejamento_compra(v_need, v_forn, 400.000, 'p1-plan-1');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A1: planning could not be created (%)', v_res;
  END IF;
  v_saldo := public.necessidade_kg_planejado_ativo(v_need);
  IF v_saldo <> 400.000 THEN
    RAISE EXCEPTION 'not ok - A2: active planned balance = % (expected 400.000)', v_saldo;
  END IF;
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = v_need AND gerado_em IS NULL AND cancelado_em IS NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A3: expected exactly one live planning row, got %', v_n;
  END IF;
  RAISE NOTICE 'ok - A: one live planning row of 400.000 kg consumes the need ceiling';

  -- =================================================================
  -- B. THE NARROWING IS BEHAVIOUR-PRESERVING WHILE NOTHING IS RELEASED
  --    Every planning row in the cluster still carries cancelado_em NULL,
  --    so the narrowed predicate selects exactly what the old one did.
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE (gerado_em IS NULL) <> (gerado_em IS NULL AND cancelado_em IS NULL);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - B: the narrowed predicate diverges on % row(s) before any release', v_n;
  END IF;
  RAISE NOTICE 'ok - B: before any release the narrowed predicate is provably equivalent to the old one';

  -- The writers still work normally on a non-cancelled Pedido.
  v_res := public.substituir_planejamento_compra_necessidade(v_need,
             format('[{"fornecedor_id":%s,"kg":500.000}]', v_forn)::JSONB, 'p1-plan-2');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - B2: the re-declared replacement writer refused a normal call (%)', v_res;
  END IF;
  IF public.necessidade_kg_planejado_ativo(v_need) <> 500.000 THEN
    RAISE EXCEPTION 'not ok - B3: the replacement writer did not update the active balance';
  END IF;
  RAISE NOTICE 'ok - B2: the re-declared planning writers behave normally on a live Pedido';

  -- =================================================================
  -- C. CANCELLATION RELEASES THE BALANCE WITHOUT DELETING THE ROW
  -- =================================================================
  SELECT id, fornecedor_id, kg_planejado INTO v_plan
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = v_need AND gerado_em IS NULL AND cancelado_em IS NULL;

  SELECT revisao INTO v_rev FROM public.pedidos WHERE id = v_ped3;
  v_res := public.cancelar_pedido(v_ped3, v_rev, 'cancelamento para prova de planejamento');
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - C1: cancellation was refused (%)', v_res;
  END IF;
  IF (v_res ->> 'planejamentos_liberados')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'not ok - C2: expected 1 released planning row, got %', v_res ->> 'planejamentos_liberados';
  END IF;

  -- THE ROW IS PHYSICALLY PRESERVED, with supplier and quantity intact.
  SELECT kg_planejado INTO v_kg FROM public.necessidade_compra_planejamento WHERE id = v_plan.id;
  IF v_kg IS NULL THEN
    RAISE EXCEPTION 'not ok - C3: the planning row was PHYSICALLY DELETED — D7 forbids it';
  END IF;
  IF v_kg <> v_plan.kg_planejado THEN
    RAISE EXCEPTION 'not ok - C4: the planned quantity was rewritten (% -> %)', v_plan.kg_planejado, v_kg;
  END IF;
  IF (SELECT fornecedor_id FROM public.necessidade_compra_planejamento WHERE id = v_plan.id)
     <> v_plan.fornecedor_id THEN
    RAISE EXCEPTION 'not ok - C5: the supplier assignment was lost';
  END IF;

  -- THE TYPED RELEASE FIELDS ARE COMPLETE.
  IF NOT EXISTS (
    SELECT 1 FROM public.necessidade_compra_planejamento
     WHERE id = v_plan.id AND cancelado_em IS NOT NULL
       AND cancelado_por = v_admin AND cancelamento_motivo IS NOT NULL) THEN
    RAISE EXCEPTION 'not ok - C6: the typed planning-release fields are incomplete';
  END IF;

  -- THE BALANCE IS RELEASED.
  v_saldo := public.necessidade_kg_planejado_ativo(v_need);
  IF v_saldo <> 0 THEN
    RAISE EXCEPTION 'not ok - C7: the active planned balance is % after release (expected 0)', v_saldo;
  END IF;
  RAISE NOTICE 'ok - C: the row survives with supplier % and % kg intact, and the active balance drops to 0',
    v_plan.fornecedor_id, v_plan.kg_planejado;

  -- =================================================================
  -- D. A RELEASED ROW NO LONGER OCCUPIES THE LIVE SLOT
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = v_need AND gerado_em IS NULL AND cancelado_em IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - D1: a released row still counts as live';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
      AND indexname = 'necessidade_compra_planejamento_viva_uidx'
      AND indexdef LIKE '%gerado_em IS NULL%cancelado_em IS NULL%') THEN
    RAISE EXCEPTION 'not ok - D2: the active-planning unique index is not narrowed';
  END IF;
  RAISE NOTICE 'ok - D: the released row leaves the live slot and the unique index is narrowed';

  -- =================================================================
  -- E. PLANNING WRITES ARE REFUSED FOR A CANCELLED PEDIDO
  -- =================================================================
  v_denied := FALSE;
  BEGIN
    v_res := public.definir_planejamento_compra(v_need, v_forn, 100.000, 'p1-plan-after-cancel');
    IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN v_denied := TRUE; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PEDIDO_CANCELADO%' THEN v_denied := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - E1: planning was assigned to a CANCELLED Pedido';
  END IF;
  IF public.necessidade_kg_planejado_ativo(v_need) <> 0 THEN
    RAISE EXCEPTION 'not ok - E2: a refused planning write changed the active balance';
  END IF;
  RAISE NOTICE 'ok - E: planning assignment for a cancelled Pedido is refused with PEDIDO_CANCELADO';

  -- =================================================================
  -- F. THE HISTORY IS QUERYABLE
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = v_need AND cancelado_em IS NOT NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - F: the released planning history is not queryable (% rows)', v_n;
  END IF;
  RAISE NOTICE 'ok - F: the released planning decision remains auditable as history';
END
$t$;

SELECT 'DB105_PLANEJAMENTO_HISTORICO_PASS' AS marker;
