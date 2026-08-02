-- tests/db118-excedente-disponivel.integration.sql
--
-- RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1 — db/118.
--
-- ACTUAL RECEIVED MATERIAL IS THE PRODUCTION INPUT. This suite proves the
-- restored legacy semantic on a disposable cluster, through the real
-- availability read and the real server writers:
--
--   1. SHORTAGE          received 80% of required -> production ceiling 80%
--   2. EXACT             received = required      -> planned ceiling
--   3. SURPLUS / f > 1   received > required      -> ceiling RISES, exactly
--                        the property tests/calculo-op.test.js proves for the
--                        legacy factor (received/required = 1.5 -> 1.5x metres)
--   4. REAL SHAPE        146.400 allocated + 25.100 surplus -> 171.500 real
--   5. MULTI-OP          the shared surplus raises ONE sibling ceiling only
--   6. SERVER AUTHORITY  bypassing the slider cannot exceed the true ceiling
--   8. REVERSAL          a reversed surplus lowers availability, correct sign,
--                        no phantom availability
--   9. PROVENANCE        surplus stays unallocated, no fabricated OP
--  10. REGRESSION        a zero-surplus axis behaves exactly as db/101
--
-- Runs as postgres on the disposable cluster, impersonating the admin
-- through request.jwt.claim.sub. Emits DB118_EXCEDENTE_PASS only when
-- every assertion holds; any failure raises and psql stops.
--
-- FIXTURE NOTE. Receipt and reversal ledger rows are PLANTED directly,
-- under session_replication_role = replica, exactly as
-- scripts/c3d/p1-fixture.mjs does and for the same reason: the canonical
-- receipt writer is deliberately fenced while ordem_compra_cutover is
-- legacy_active / flat, so it cannot be driven here. Every planted row is
-- written in the SHAPE the canonical writers produce — in particular a
-- reversal of a surplus line carries kg_recebido = -kg AND kg_excesso =
-- -kg, which is what estornar_recebimento_ordem_compra (db/70) writes.
-- The suite asserts the AVAILABILITY SEMANTIC; it does not re-prove the
-- receipt writer.
--
-- Every identifier and quantity below is synthetic.

\set ON_ERROR_STOP on

-- =====================================================================
-- FIXTURE
--
--   Pedido PEDX --- lote LOTX --- OPA (target,  200 m -> 100 kg COR_X)
--                              \- OPB (sibling, 200 m -> 100 kg COR_X)
--     NXA  op-origin cotton COR_X for OPA      required 100.000
--     NXB  op-origin cotton COR_X for OPB      required 100.000
--
--   Pedido PEDC --- lote LOTC --- OPC          the real 146.400 + 25.100 shape
--     NC   op-origin cotton COR_CINZA for OPC  required 146.400
--
--   parametros_largura 1.40 (planted by the P1 fixture):
--     algodao_por_ml 0.500, valor_x 1.0000  =>  1 m = 0.500 kg per colour
--   Each model carries TWO DISTINCT colours, so a colour is credited once.
-- =====================================================================

DO $fx$
DECLARE
  v_admin   CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad01';
  v_cli     CONSTANT BIGINT := 940000601;   -- P1 fixture client
  v_forn    CONSTANT BIGINT := 940000401;   -- P1 fixture cotton supplier
BEGIN
  SET session_replication_role = replica;

  INSERT INTO public.cores (id, nome) VALUES
    (941000201, 'DB118-COR-X'), (941000202, 'DB118-COR-Y'),
    (942000201, 'DB118-CINZA'), (942000202, 'DB118-COR-Z')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
    (941000301, 'DB118-MODELO-X', 941000201, 941000202, 1.40, 'tapete'),
    (942000301, 'DB118-MODELO-C', 942000201, 942000202, 1.40, 'tapete')
    ON CONFLICT (id) DO NOTHING;

  -- ---------------- Pedido PEDX: two sibling OPs, one shared colour ----
  INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, status, criado_em)
  VALUES ('94f10000-0000-4000-8000-000000000002', v_cli, 941001, DATE '2026-03-11', 'confirmado', now())
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
  VALUES (941000701, 941701, v_cli, '94f10000-0000-4000-8000-000000000002')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
    (941000101, 941101, 2099, 941000701, 'aberta', 'tecelagem'),
    (941000102, 941102, 2099, 941000701, 'aberta', 'tecelagem')
    ON CONFLICT (id) DO NOTHING;

  -- 200 m each => 100.000 kg of COR_X each at 0.500 kg/m.
  INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
    (941000111, 941000101, 941000301, 200.00),
    (941000112, 941000102, 941000301, 200.00)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.necessidade_compra_fio
    (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
  VALUES
    (941000501, '94f10000-0000-4000-8000-000000000002', 'op', 941000101, 'algodao', 941000201, NULL, 100.000, 0, FALSE),
    (941000502, '94f10000-0000-4000-8000-000000000002', 'op', 941000102, 'algodao', 941000201, NULL, 100.000, 0, FALSE)
    ON CONFLICT (id) DO NOTHING;

  -- ordem_compra_item_unico_algodao makes (ordem_id, cor_id) unique and the
  -- two needs deliberately SHARE a colour, so each needs its own order.
  INSERT INTO public.ordem_compra
    (id, pedido_id, fornecedor_id, status_administrativo, status_aceite, status_recebimento,
     aceite_exigido_na_emissao, legado, emitida_em)
  VALUES
    (941000801, '94f10000-0000-4000-8000-000000000002', v_forn, 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE, FALSE, now()),
    (941000802, '94f10000-0000-4000-8000-000000000002', v_forn, 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE, FALSE, now())
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item (id, ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido)
  VALUES
    (941000811, 941000801, 'algodao', 941000201, NULL, 200.000, 0),
    (941000812, 941000802, 'algodao', 941000201, NULL, 200.000, 0)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item_alocacao (id, item_id, necessidade_id, op_id, kg_alocado)
  VALUES
    (941000821, 941000811, 941000501, 941000101, 100.000),
    (941000822, 941000812, 941000502, 941000102, 100.000)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_recebimentos
    (id, ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
     ator_id, ator_tipo, ocorrido_em, documento_ref, origem_tipo, origem_ref,
     comando_payload, comando_hash, resultado_metadata)
  VALUES (941000901, 941000801, 'recebimento', 'native_receipt_v1', 'db118-rec-1',
          v_admin, 'admin', now(), 'DB118-DOC-1', 'nota_fiscal', 'DB118-NF-1',
          '{"fixture":true}'::jsonb, md5('db118-rec-1'), '{"fixture":true}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

  -- STAGE 1 ONLY: 80.000 kg of the 100.000 kg required by OPA (80%), plus
  -- OPB's own full 100.000 kg. Nothing else is received yet.
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
     op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
  VALUES
    (NULL, 80.000, CURRENT_DATE, v_admin, 941000811, 'recebimento', 'db118-lan-a80',
     941000901, 941000801, 941000821, 941000101, 'algodao', 941000201, NULL, 0, 'admin', 1),
    (NULL, 100.000, CURRENT_DATE, v_admin, 941000812, 'recebimento', 'db118-lan-b100',
     941000901, 941000802, 941000822, 941000102, 'algodao', 941000201, NULL, 0, 'admin', 2)
    ON CONFLICT DO NOTHING;

  -- ---------------- Pedido PEDC: the real 146.400 + 25.100 shape --------
  INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, status, criado_em)
  VALUES ('94f10000-0000-4000-8000-000000000003', v_cli, 942001, DATE '2026-03-12', 'confirmado', now())
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
  VALUES (942000701, 942701, v_cli, '94f10000-0000-4000-8000-000000000003')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo)
  VALUES (942000101, 942101, 2099, 942000701, 'aberta', 'tecelagem')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos)
  VALUES (942000111, 942000101, 942000301, 292.80)   -- 292.80 m * 0.5 = 146.400 kg
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.necessidade_compra_fio
    (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
  VALUES (942000501, '94f10000-0000-4000-8000-000000000003', 'op', 942000101, 'algodao', 942000201, NULL, 146.400, 0, FALSE)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra
    (id, pedido_id, fornecedor_id, status_administrativo, status_aceite, status_recebimento,
     aceite_exigido_na_emissao, legado, emitida_em)
  VALUES (942000801, '94f10000-0000-4000-8000-000000000003', v_forn, 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE, FALSE, now())
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item (id, ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido)
  VALUES (942000811, 942000801, 'algodao', 942000201, NULL, 146.400, 0)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_item_alocacao (id, item_id, necessidade_id, op_id, kg_alocado)
  VALUES (942000821, 942000811, 942000501, 942000101, 146.400)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ordem_compra_recebimentos
    (id, ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
     ator_id, ator_tipo, ocorrido_em, documento_ref, origem_tipo, origem_ref,
     comando_payload, comando_hash, resultado_metadata)
  VALUES (942000901, 942000801, 'recebimento', 'native_receipt_v1', 'db118-rec-c',
          v_admin, 'admin', now(), 'DB118-DOC-C', 'nota_fiscal', 'DB118-NF-C',
          '{"fixture":true}'::jsonb, md5('db118-rec-c'), '{"fixture":true}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

  -- THE REAL SHAPE: 146.400 kg allocated + 25.100 kg explicit surplus.
  -- The surplus line carries NO allocation and NO OP, which is what
  -- ordem_compra_fio_lancamentos_native_shape enforces.
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
     op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
  VALUES
    (NULL, 146.400, CURRENT_DATE, v_admin, 942000811, 'recebimento', 'db118-lan-c-aloc',
     942000901, 942000801, 942000821, 942000101, 'algodao', 942000201, NULL, 0, 'admin', 1),
    (NULL, 25.100, CURRENT_DATE, v_admin, 942000811, 'recebimento', 'db118-lan-c-exc',
     942000901, 942000801, NULL, NULL, 'algodao', 942000201, NULL, 25.100, 'admin', 2)
    ON CONFLICT DO NOTHING;

  SET session_replication_role = origin;
END
$fx$;

-- =====================================================================
-- ASSERTIONS
-- =====================================================================

DO $t$
DECLARE
  v_admin   CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad01';
  v_pedx    CONSTANT UUID   := '94f10000-0000-4000-8000-000000000002';
  v_pedc    CONSTANT UUID   := '94f10000-0000-4000-8000-000000000003';
  v_opa     CONSTANT BIGINT := 941000101;
  v_opb     CONSTANT BIGINT := 941000102;
  v_opc     CONSTANT BIGINT := 942000101;
  v_corx    CONSTANT BIGINT := 941000201;
  v_corc    CONSTANT BIGINT := 942000201;
  v_teto    NUMERIC(12,3);
  v_liq     NUMERIC(12,3);
  v_exc     NUMERIC(12,3);
  v_pool    NUMERIC(12,3);
  v_res     JSONB;
  v_rev     INTEGER;
  v_n       INTEGER;
  v_sobra   NUMERIC(10,3);
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- =================================================================
  -- 1. LEGACY SEMANTIC — SHORTAGE
  --    Required 100.000 kg; 80.000 kg actually received (80%).
  --    Feasible production must fall to the real-material ceiling.
  -- =================================================================
  SELECT d.kg_disponivel, d.kg_recebido_liquido, d.kg_excedente
    INTO v_teto, v_liq, v_exc
    FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;

  IF v_teto IS NULL THEN
    RAISE EXCEPTION 'not ok - 1.0: no cotton axis returned for OPA';
  END IF;
  IF v_liq <> 80.000 THEN
    RAISE EXCEPTION 'not ok - 1.1: productive net = % (expected 80.000)', v_liq;
  END IF;
  IF v_exc <> 0 THEN
    RAISE EXCEPTION 'not ok - 1.2: no surplus exists yet, got %', v_exc;
  END IF;
  IF v_teto <> 80.000 THEN
    RAISE EXCEPTION 'not ok - 1.3: shortage ceiling = % (expected 80.000 = 80%% of the required 100.000)', v_teto;
  END IF;

  -- 80.000 kg / 0.500 kg per metre = 160 m, i.e. 80% of the planned 200 m.
  v_res := public.salvar_ajuste_producao_op(
    v_opa, 0, '[{"op_item_id":941000111,"metros_ajustados":"160.00"}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 1.4: 160 m must be accepted under an 80.000 kg ceiling, got %', v_res;
  END IF;

  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"161.00"}]'::jsonb);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 1.5: 161 m (80.500 kg) must be refused above an 80.000 kg ceiling, got %', v_res;
  END IF;
  RAISE NOTICE 'ok - 1: SHORTAGE — 80%% of the required yarn caps production at 160 m of the planned 200 m';

  -- Clear the adjustment so the following stages measure a raw ceiling.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":null}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 1.6: clearing the adjustment must be accepted, got %', v_res;
  END IF;

  -- =================================================================
  -- 2. LEGACY SEMANTIC — EXACT
  --    The remaining 20.000 kg arrive: received = required.
  --    Feasible production returns to the planned ceiling.
  -- =================================================================
  SET session_replication_role = replica;
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
     op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
  VALUES (NULL, 20.000, CURRENT_DATE, v_admin, 941000811, 'recebimento', 'db118-lan-a20',
          941000901, 941000801, 941000821, 941000101, 'algodao', 941000201, NULL, 0, 'admin', 3);
  SET session_replication_role = origin;

  SELECT d.kg_disponivel, d.kg_recebido_liquido
    INTO v_teto, v_liq
    FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_liq <> 100.000 OR v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 2.1: exact receipt must give net/ceiling 100.000/100.000, got %/%', v_liq, v_teto;
  END IF;

  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"200.00"}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 2.2: the full planned 200 m must be accepted, got %', v_res;
  END IF;
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"201.00"}]'::jsonb);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 2.3: 201 m must still be refused at an exact receipt, got %', v_res;
  END IF;
  RAISE NOTICE 'ok - 2: EXACT — received = required preserves the planned 200 m and nothing more';

  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":null}]'::jsonb);

  -- =================================================================
  -- 3. LEGACY SEMANTIC — SURPLUS, FACTOR > 1
  --    50.000 kg of real surplus arrive on the same colour, with no
  --    allocation and no OP. received/required = 150.000/100.000 = 1.5,
  --    and production metres must rise by that factor: 200 m -> 300 m.
  --    This is the same product property tests/calculo-op.test.js proves
  --    for the legacy recalcularOP factor of 1.5.
  -- =================================================================
  SET session_replication_role = replica;
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
     op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
  VALUES (NULL, 50.000, CURRENT_DATE, v_admin, 941000811, 'recebimento', 'db118-lan-a-exc',
          941000901, 941000801, NULL, NULL, 'algodao', 941000201, NULL, 50.000, 'admin', 4);
  SET session_replication_role = origin;

  SELECT d.kg_disponivel, d.kg_recebido_liquido, d.kg_excedente
    INTO v_teto, v_liq, v_exc
    FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_liq <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 3.1: the allocated net must stay 100.000, got %', v_liq;
  END IF;
  IF v_exc <> 50.000 THEN
    RAISE EXCEPTION 'not ok - 3.2: surplus must be reported as 50.000, got %', v_exc;
  END IF;
  IF v_teto <> 150.000 THEN
    RAISE EXCEPTION 'not ok - 3.3: FACTOR > 1 — the ceiling must rise to 150.000 real received kg, got %', v_teto;
  END IF;

  -- 150.000 kg / 0.500 = 300 m = 1.5 x the planned 200 m.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"300.00"}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 3.4: real surplus must make 300 m feasible, got %', v_res;
  END IF;
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"301.00"}]'::jsonb);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 3.5: 301 m must be refused — surplus raises the ceiling, it does not remove it, got %', v_res;
  END IF;
  RAISE NOTICE 'ok - 3: SURPLUS — received/required 1.5 raises feasible production 200 m -> 300 m, and 301 m is still refused';

  -- Release OPA's reservation again for the multi-OP stage.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":null}]'::jsonb);

  -- =================================================================
  -- 4. THE REAL 146.400 + 25.100 SHAPE
  --    The receipt representation stays 146.400 allocated + 25.100
  --    surplus, and the production-availability model recognizes the
  --    real 171.500 kg before any commitment.
  -- =================================================================
  SELECT d.kg_recebido_liquido, d.kg_excedente, d.kg_disponivel
    INTO v_liq, v_exc, v_teto
    FROM public.oc_disponibilidade_op(v_opc) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corc;

  IF v_liq <> 146.400 THEN
    RAISE EXCEPTION 'not ok - 4.1: allocated receipt must remain 146.400, got %', v_liq;
  END IF;
  IF v_exc <> 25.100 THEN
    RAISE EXCEPTION 'not ok - 4.2: surplus must remain explicitly identifiable as 25.100, got %', v_exc;
  END IF;
  IF v_teto <> 171.500 THEN
    RAISE EXCEPTION 'not ok - 4.3: real received CINZA must be recognized as 171.500, got %', v_teto;
  END IF;
  RAISE NOTICE 'ok - 4: REAL SHAPE — 146.400 allocated + 25.100 surplus = 171.500 kg of real production availability';

  -- =================================================================
  -- 9. PROVENANCE (asserted on the same real shape)
  --    The 25.100 kg remain unallocated, carry no fabricated OP and stay
  --    traceable as surplus.
  -- =================================================================
  SELECT count(*) INTO v_n
    FROM public.ordem_compra_fio_lancamentos l
   WHERE l.idempotency_key = 'db118-lan-c-exc'
     AND l.ordem_compra_item_alocacao_id IS NULL
     AND l.op_id IS NULL
     AND l.kg_excesso = l.kg_recebido
     AND l.recebimento_id IS NOT NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - 9.1: the surplus line must stay unallocated, OP-free and self-identifying';
  END IF;

  SELECT count(*) INTO v_n
    FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item it ON it.id = a.item_id
   WHERE it.ordem_id = 942000801;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - 9.2: an allocation was fabricated for the surplus (allocations = %)', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.ops o
    JOIN public.lotes lt ON lt.id = o.lote_id WHERE lt.pedido_id = v_pedc;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - 9.3: an OP was fabricated for the surplus (OPs = %)', v_n;
  END IF;
  RAISE NOTICE 'ok - 9: PROVENANCE — surplus stays unallocated, no OP and no allocation was fabricated';

  -- =================================================================
  -- 5. MULTIPLE SIBLING OPS — ONE PHYSICAL KG, ONE CEILING
  --    OPA and OPB each own 100.000 kg; the Pedido holds 50.000 kg of
  --    SHARED surplus. Real received on this axis = 250.000 kg.
  -- =================================================================
  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 150.000 THEN
    RAISE EXCEPTION 'not ok - 5.1: OPA must see own 100.000 + shared 50.000, got %', v_teto;
  END IF;
  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opb) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 150.000 THEN
    RAISE EXCEPTION 'not ok - 5.2: the shared surplus must be AVAILABLE to the sibling too, got %', v_teto;
  END IF;

  -- OPB spends the whole shared surplus through the real writer.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opb;
  v_res := public.salvar_ajuste_producao_op(
    v_opb, v_rev, '[{"op_item_id":941000112,"metros_ajustados":"300.00"}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 5.3: OPB must be able to take the shared surplus, got %', v_res;
  END IF;

  -- USE BY ONE OP REDUCES THE REMAINING SHARED POOL.
  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 5.4: the second OP consumed the original surplus AGAIN (OPA ceiling % <> 100.000)', v_teto;
  END IF;

  -- OPA's own allocated material is untouched by the sibling (9.9.A.2).
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"200.00"}]'::jsonb);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 5.5: a sibling reservation must not touch OPA''s OWN allocated 100.000 kg, got %', v_res;
  END IF;

  -- TOTAL COMMITMENTS CANNOT EXCEED THE REAL RECEIVED QUANTITY.
  SELECT sum(oi.metros_ajustados * pl.algodao_por_ml * pl.valor_x) INTO v_liq
    FROM public.op_itens oi
    JOIN public.ops o ON o.id = oi.op_id
    JOIN public.lotes lt ON lt.id = o.lote_id
    JOIN public.modelos m ON m.id = oi.modelo_id
    JOIN public.parametros_largura pl ON pl.largura = m.largura
   WHERE lt.pedido_id = v_pedx AND oi.metros_ajustados IS NOT NULL
     AND (m.cor_1_id = v_corx OR m.cor_2_id = v_corx);
  IF v_liq <> 250.000 THEN
    RAISE EXCEPTION 'not ok - 5.6: total committed = % (expected exactly the real received 250.000)', v_liq;
  END IF;

  -- And one more metre on either OP is now refused.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opa;
  v_res := public.salvar_ajuste_producao_op(
    v_opa, v_rev, '[{"op_item_id":941000111,"metros_ajustados":"201.00"}]'::jsonb);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 5.7: commitments must not be allowed past the real received quantity, got %', v_res;
  END IF;
  RAISE NOTICE 'ok - 5: MULTI-OP — the shared 50.000 kg raised exactly one ceiling; 250.000 kg received, 250.000 kg committed, no double spend';

  -- =================================================================
  -- 6. SERVER AUTHORITY
  --    The client slider is not in this path at all: these are direct
  --    RPC calls. The refusals above and this explicit over-request
  --    prove the server ceiling is authoritative on its own.
  -- =================================================================
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opb;
  v_res := public.salvar_ajuste_producao_op(
    v_opb, v_rev, '[{"op_item_id":941000112,"metros_ajustados":"9999.00"}]'::jsonb);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 6.1: a slider bypass must be refused by the server, got %', v_res;
  END IF;
  IF (v_res ->> 'kg_disponivel')::NUMERIC <> 150.000 THEN
    RAISE EXCEPTION 'not ok - 6.2: the refusal must report the true remaining availability, got %', v_res;
  END IF;

  -- The refused call wrote nothing.
  SELECT oi.metros_ajustados INTO v_liq FROM public.op_itens oi WHERE oi.id = 941000112;
  IF v_liq <> 300.00 THEN
    RAISE EXCEPTION 'not ok - 6.3: a refused adjustment must leave the saved value intact, got %', v_liq;
  END IF;
  RAISE NOTICE 'ok - 6: SERVER AUTHORITY — the writer refuses above the true remaining availability and writes nothing';

  -- =================================================================
  -- 8. REVERSAL
  --    The surplus receipt is reversed. Availability must fall with the
  --    correct sign and leave NO phantom surplus availability.
  -- =================================================================
  -- Written in EXACTLY the shape estornar_recebimento_ordem_compra (db/70)
  -- produces: kg_recebido = -kg, kg_excesso = -kg because the source line
  -- was surplus-destined, estorno_de_id pointing at that source line (the
  -- ordem_compra_fio_lancamentos_sinal_kg CHECK requires it), and no
  -- allocation and no OP.
  SELECT l.id INTO v_n FROM public.ordem_compra_fio_lancamentos l
   WHERE l.idempotency_key = 'db118-lan-a-exc';
  IF v_n IS NULL THEN
    RAISE EXCEPTION 'not ok - 8.0: the surplus line to reverse was not found';
  END IF;

  SET session_replication_role = replica;
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, estorno_de_id, idempotency_key, recebimento_id, ordem_compra_id,
     ordem_compra_item_alocacao_id, op_id, material, cor_id, cor_poliester,
     kg_excesso, ator_tipo, linha_indice)
  VALUES (NULL, -50.000, CURRENT_DATE, v_admin, 941000811, 'estorno', v_n, 'db118-lan-a-exc-estorno',
          941000901, 941000801, NULL, NULL, 'algodao', 941000201, NULL, -50.000, 'admin', 5);
  SET session_replication_role = origin;

  SELECT d.kg_excedente, d.kg_disponivel INTO v_exc, v_teto
    FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_exc <> 0.000 THEN
    RAISE EXCEPTION 'not ok - 8.1: the reversed surplus must net to 0.000, got %', v_exc;
  END IF;
  IF v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 8.2: phantom surplus availability survived the reversal (OPA ceiling %)', v_teto;
  END IF;

  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opb) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 8.3: OPB must fall back to its own 100.000 kg after the reversal, got %', v_teto;
  END IF;

  -- OPB now holds 150.000 kg of commitments against 100.000 kg of real
  -- material, so the server-owned production start must refuse.
  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opb;
  v_res := public.iniciar_producao_op(v_opb, v_rev);
  IF COALESCE(v_res ->> 'codigo', '') <> 'AJUSTE_EXCEDE_DISPONIVEL' THEN
    RAISE EXCEPTION 'not ok - 8.4: production start must revalidate against the reversed availability, got %', v_res;
  END IF;

  -- Re-receiving the surplus makes it feasible again, with the same sign
  -- rule applied in the opposite direction.
  SET session_replication_role = replica;
  INSERT INTO public.ordem_compra_fio_lancamentos
    (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
     tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
     op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
  VALUES (NULL, 50.000, CURRENT_DATE, v_admin, 941000811, 'recebimento', 'db118-lan-a-exc-2',
          941000901, 941000801, NULL, NULL, 'algodao', 941000201, NULL, 50.000, 'admin', 6);
  SET session_replication_role = origin;

  SELECT o.ajuste_revisao INTO v_rev FROM public.ops o WHERE o.id = v_opb;
  v_res := public.iniciar_producao_op(v_opb, v_rev);
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - 8.5: production start must succeed once the material is really there, got %', v_res;
  END IF;

  SELECT s.kg_sobra INTO v_sobra FROM public.saldo_fios_op s
   WHERE s.op_id = v_opb AND s.tipo = 'algodao' AND s.cor_id = v_corx;
  IF v_sobra <> 0.000 THEN
    RAISE EXCEPTION 'not ok - 8.6: the start snapshot must record 150.000 available - 150.000 reserved = 0.000, got %', v_sobra;
  END IF;

  -- A committed sibling still draws on the shared pool exactly once.
  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - 8.7: an in-production sibling must still hold the shared surplus, got %', v_teto;
  END IF;
  RAISE NOTICE 'ok - 8: REVERSAL — a reversed surplus lowers availability with the correct sign, blocks production start, and leaves no phantom availability';

  -- =================================================================
  -- 10. REGRESSION — a ZERO-SURPLUS axis is untouched by db/118
  --     OPC holds surplus; the P1 fixture's polyester pool holds none.
  --     Prove the surplus-free path still matches the db/101 expression
  --     exactly, on both origins, computed here independently.
  -- =================================================================
  SELECT public._oc_excedente_pool(v_pedc, 'algodao', v_corc, NULL) INTO v_pool;
  IF v_pool <> 25.100 THEN
    RAISE EXCEPTION 'not ok - 10.1: pool helper disagrees with the reported surplus (%)', v_pool;
  END IF;

  -- OP-origin, zero surplus: ceiling must equal the raw productive net.
  SELECT public._oc_excedente_pool(v_pedx, 'algodao', 941000202, NULL) INTO v_pool;
  IF v_pool <> 0 THEN
    RAISE EXCEPTION 'not ok - 10.2: a colour with no surplus must pool to 0, got %', v_pool;
  END IF;
  SELECT public._oc_teto_disponivel(v_pedx, v_opa, 'op', 'algodao', 941000202, NULL) INTO v_teto;
  SELECT public._oc_material_recebido_liquido(v_pedx, v_opa, 'op', 'algodao', 941000202, NULL) INTO v_liq;
  IF v_teto <> GREATEST(0, v_liq) THEN
    RAISE EXCEPTION 'not ok - 10.3: with zero surplus the OP-origin ceiling must be the db/101 expression (% <> %)', v_teto, v_liq;
  END IF;

  -- Pedido-origin, zero surplus: ceiling must equal pool - other OPs.
  SELECT public._oc_teto_disponivel(v_pedx, v_opa, 'pedido', 'poliester', NULL, 'PRETO') INTO v_teto;
  SELECT public._oc_material_recebido_liquido(v_pedx, v_opa, 'pedido', 'poliester', NULL, 'PRETO')
       - (SELECT r.kg_reservado + r.kg_comprometido
            FROM public._oc_reserva_ativa(v_pedx, 'poliester', NULL, 'PRETO', v_opa, NULL) r)
    INTO v_liq;
  IF v_teto <> GREATEST(0, v_liq) THEN
    RAISE EXCEPTION 'not ok - 10.4: with zero surplus the Pedido-origin ceiling must be the db/101 expression (% <> %)', v_teto, v_liq;
  END IF;
  RAISE NOTICE 'ok - 10: REGRESSION — a zero-surplus axis reduces exactly to the db/101 ceiling on both origins';

  -- =================================================================
  -- TD1 / R.33.2 — saldo_fios IS STILL NOT AN AVAILABILITY AUTHORITY
  -- =================================================================
  SET session_replication_role = replica;
  INSERT INTO public.saldo_fios (tipo, cor_id, cor_poliester, kg_total)
  VALUES ('algodao', 941000201, NULL, 7000.000)
  ON CONFLICT DO NOTHING;
  SET session_replication_role = origin;

  SELECT d.kg_disponivel INTO v_teto FROM public.oc_disponibilidade_op(v_opa) d
   WHERE d.material = 'algodao' AND d.cor_id = v_corx;
  IF v_teto <> 100.000 THEN
    RAISE EXCEPTION 'not ok - TD1: preserved saldo_fios stock changed a productive ceiling (%)', v_teto;
  END IF;

  SET session_replication_role = replica;
  DELETE FROM public.saldo_fios WHERE cor_id = 941000201;
  SET session_replication_role = origin;
  RAISE NOTICE 'ok - TD1: the restored surplus term reads the native ledger, never saldo_fios';
END
$t$;

SELECT 'DB118_EXCEDENTE_PASS' AS marker;
