-- tests/manta-expedition-source.integration.sql
--
-- PHASE-MANTA-B1 integration proof (db/81, db/82) — expedition-source
-- foundation, PLUS the db/83 forward correction (source OP type
-- immutability; source product route immutability incl. single-item;
-- expedition-item identity alignment to modelo_id/pedido_item_id; referenced
-- op_item identity immutability incl. modelo_id/pedido_item_id, no
-- retificacao bypass), PLUS the db/84 forward correction (symmetric Latex
-- source route validation; authoritative source OP->Lote->Pedido->Cliente
-- lineage derivation/match; expedition/OP/Lote/Pedido lineage immutability,
-- no retificacao bypass). Governing contract:
-- docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md.
--
-- ENVIRONMENT: disposable local PostgreSQL ONLY. The external runner applies the
-- Supabase-platform preamble, then db/01..db/81 in order, then this file. Never a
-- shared/remote/managed host. This file opens ONE transaction, plants its own
-- fixtures with triggers off, exercises the PHASE-MANTA-B1 database guards with
-- triggers on, and ROLLBACKs at the end — zero persistent mutation. db/81 clean
-- apply and idempotent re-apply are proven by the runner
-- (tests/manta-expedition-source-invariant.mjs); the constraint/trigger guards
-- below are proven here. Distinct-session concurrency (one expedition per Manta
-- OP; item writes cannot cross sources; deterministic lock order, no 40P01) is
-- proven separately in that harness.
--
-- Run:  psql -X -v ON_ERROR_STOP=1 -f tests/manta-expedition-source.integration.sql
-- Success = the MANTA_EXPEDITION_SOURCE_INTEGRATION_PASS sentinel with no error.

\set ON_ERROR_STOP on

BEGIN;

DO $mes$
DECLARE
  v_c1 BIGINT; v_c2 BIGINT;
  v_forn BIGINT; v_dest BIGINT;
  v_cli BIGINT; v_pedido UUID; v_lote BIGINT;
  v_mod_manta BIGINT; v_mod_tapete BIGINT;
  v_op_manta BIGINT; v_op_manta2 BIGINT; v_op_tapete_tec BIGINT;
  v_op_empty BIGINT; v_op_mixed BIGINT; v_op_latex BIGINT;
  v_it_manta BIGINT; v_it_manta2 BIGINT; v_it_tapete BIGINT; v_it_latex BIGINT;
  v_entrega_manta BIGINT; v_ei_manta BIGINT;
  v_entrega_manta2 BIGINT; v_ei_manta2 BIGINT;
  v_exp_manta BIGINT; v_exp_latex BIGINT;
  v_xi BIGINT;
  v_tmp BIGINT;
  v_ok BOOLEAN;
  -- db/83 fixtures
  v_mod_tapete2 BIGINT;
  v_op_manta_solo BIGINT; v_it_manta_solo BIGINT; v_exp_manta_solo BIGINT;
  v_op_latex_solo BIGINT; v_it_latex_solo BIGINT; v_exp_latex_solo BIGINT;
  v_op_manta_multi BIGINT; v_it_manta_multi_a BIGINT; v_it_manta_multi_b BIGINT; v_exp_manta_multi BIGINT;
  v_pi_manta UUID; v_pi_manta_other UUID;
  v_op_manta_c BIGINT; v_it_manta_c1 BIGINT; v_it_manta_c2 BIGINT; v_exp_manta_c BIGINT;
  v_xi_c1 BIGINT;
  -- db/84 fixtures
  v_cli2 BIGINT;
  v_op_latex_empty BIGINT;
  v_op_latex_manta BIGINT; v_it_latex_manta BIGINT;
  v_op_latex_mixed BIGINT;
  v_op_no_lote BIGINT; v_it_no_lote BIGINT;
  v_lote_no_pedido BIGINT; v_op_lote_no_pedido BIGINT; v_it_lote_no_pedido BIGINT;
  v_lote_mismatch BIGINT; v_op_lote_mismatch BIGINT; v_it_lote_mismatch BIGINT;
  v_op_lineage_a BIGINT; v_it_lineage_a BIGINT; v_exp_lineage_a BIGINT;
  v_lote2 BIGINT;
  v_lote_unrelated BIGINT; v_op_unrelated BIGINT; v_it_unrelated BIGINT;
  v_pedido_unrelated UUID;
BEGIN
  -- ==========================================================================
  -- Fixtures (triggers off): a Manta and a Tapete model; a client/pedido/lote;
  -- weaving OPs (Manta homogeneous, a second Manta, a Tapete weaving, an empty
  -- one, a defensively-mixed one) and a Latex OP; op_itens; and the Manta cima
  -- weaving output (entregas etapa='cima' + entrega_itens) that a Manta
  -- expedition consumes. Terminal statuses planted here so the reopening guard
  -- can be exercised.
  -- ==========================================================================
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO public.cores (nome) VALUES ('MES-KRAFT') RETURNING id INTO v_c1;
  INSERT INTO public.cores (nome) VALUES ('MES-CRU')   RETURNING id INTO v_c2;
  INSERT INTO public.fornecedores (nome, tipo) VALUES ('MES-TECELAGEM', 'tecelagem') RETURNING id INTO v_forn;
  INSERT INTO public.fornecedores (nome, tipo) VALUES ('MES-LATEX-DEST', 'latex')     RETURNING id INTO v_dest;

  INSERT INTO public.modelos (nome, cor_1_id, cor_2_id, largura, tipo_produto)
    VALUES ('MES-ARABESCO', v_c1, v_c2, 1.40, 'manta')  RETURNING id INTO v_mod_manta;
  INSERT INTO public.modelos (nome, cor_1_id, cor_2_id, largura, tipo_produto)
    VALUES ('MES-BARCELONA', v_c1, v_c2, 2.10, 'tapete') RETURNING id INTO v_mod_tapete;

  INSERT INTO public.clientes (nome) VALUES ('MES-CLI') RETURNING id INTO v_cli;
  INSERT INTO public.pedidos (cliente_id, numero, status)
    VALUES (v_cli, 980001, 'confirmado') RETURNING id INTO v_pedido;
  INSERT INTO public.lotes (numero, cliente_id, pedido_id)
    VALUES (980001, v_cli, v_pedido) RETURNING id INTO v_lote;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980001, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980002, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta2;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980003, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_tapete_tec;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980004, 2026, 'simulada', 'tecelagem', v_lote) RETURNING id INTO v_op_empty;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980005, 2026, 'simulada', 'tecelagem', v_lote) RETURNING id INTO v_op_mixed;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980006, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex;

  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta,  v_mod_manta,  100) RETURNING id INTO v_it_manta;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta2, v_mod_manta,  100) RETURNING id INTO v_it_manta2;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_tapete_tec, v_mod_tapete, 100) RETURNING id INTO v_it_tapete;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex,  v_mod_tapete, 100) RETURNING id INTO v_it_latex;
  -- Defensively-mixed OP (only reachable with triggers off; db/78-80 forbid it).
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_mixed, v_mod_manta,  50);
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_mixed, v_mod_tapete, 50);

  -- Manta cima weaving output consumed later (destino provided: db/81 does NOT
  -- relax entregas_destino_cima_chk — that relaxation is PHASE-MANTA-B2).
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn, 'cima', CURRENT_DATE, v_dest) RETURNING id INTO v_entrega_manta;
  INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (v_entrega_manta, v_op_manta, v_it_manta, v_mod_manta, 100, FALSE) RETURNING id INTO v_ei_manta;

  -- Unconsumed Manta cima output (op_manta2) — stays correctable before release.
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn, 'cima', CURRENT_DATE, v_dest) RETURNING id INTO v_entrega_manta2;
  INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (v_entrega_manta2, v_op_manta2, v_it_manta2, v_mod_manta, 80, FALSE) RETURNING id INTO v_ei_manta2;

  -- db/83 fixtures: a second Tapete model; dedicated single-item Manta and
  -- Latex sources (the mixing-only db/78-80 homogeneity check cannot catch a
  -- single item flipping type -- BLOCKER B needs a source-aware check); a
  -- multi-item Manta source; two Pedido-item origins; a dedicated Manta
  -- source with one Pedido-origin item and one NULL-origin item for the
  -- identity-alignment (BLOCKER C/D) tests. Selected sources are planted
  -- with triggers off (their INSERT-time composition proof is already
  -- covered by tests (2)/(3) above with triggers on).
  INSERT INTO public.modelos (nome, cor_1_id, cor_2_id, largura, tipo_produto)
    VALUES ('MES-BARCELONA-2', v_c1, v_c2, 2.10, 'tapete') RETURNING id INTO v_mod_tapete2;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980007, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta_solo;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta_solo, v_mod_manta, 40) RETURNING id INTO v_it_manta_solo;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980008, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex_solo;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex_solo, v_mod_tapete, 40) RETURNING id INTO v_it_latex_solo;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980009, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta_multi;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta_multi, v_mod_manta, 30) RETURNING id INTO v_it_manta_multi_a;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta_multi, v_mod_manta, 30) RETURNING id INTO v_it_manta_multi_b;

  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros) VALUES (v_pedido, v_mod_manta, 40) RETURNING id INTO v_pi_manta;
  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros) VALUES (v_pedido, v_mod_manta, 40) RETURNING id INTO v_pi_manta_other;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980010, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta_c;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
    VALUES (v_op_manta_c, v_mod_manta, 40, v_pi_manta) RETURNING id INTO v_it_manta_c1;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
    VALUES (v_op_manta_c, v_mod_manta, 20, NULL) RETURNING id INTO v_it_manta_c2;

  INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_manta_solo, v_lote, v_cli) RETURNING id INTO v_exp_manta_solo;
  INSERT INTO public.expedicoes (pedido_id, op_latex_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_latex_solo, v_lote, v_cli) RETURNING id INTO v_exp_latex_solo;
  INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_manta_multi, v_lote, v_cli) RETURNING id INTO v_exp_manta_multi;
  INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_manta_c, v_lote, v_cli) RETURNING id INTO v_exp_manta_c;

  -- db/84 fixtures: a second client; a Latex OP with zero items, one with a
  -- Manta item, one defensively mixed (BLOCKER A symmetric Latex tests); a
  -- source-less-Lote OP, a Lote-without-Pedido OP, and a Lote/Pedido
  -- client-mismatch OP (BLOCKER B lineage-existence/consistency tests); a
  -- fresh valid-lineage OP for the expedition-payload-mismatch and
  -- immutability tests; a second Lote (BLOCKER D target); and a genuinely
  -- unrelated Lote/OP/Pedido never selected as a source (BLOCKER D/E/F
  -- inertness).
  INSERT INTO public.clientes (nome) VALUES ('MES-CLI-2') RETURNING id INTO v_cli2;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980011, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex_empty;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980012, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex_manta;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex_manta, v_mod_manta, 40) RETURNING id INTO v_it_latex_manta;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980013, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex_mixed;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex_mixed, v_mod_tapete, 30);
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex_mixed, v_mod_manta, 30);

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980014, 2026, 'concluida', 'tecelagem', NULL) RETURNING id INTO v_op_no_lote;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_no_lote, v_mod_manta, 40) RETURNING id INTO v_it_no_lote;

  INSERT INTO public.lotes (numero, cliente_id, pedido_id) VALUES (980002, v_cli, NULL) RETURNING id INTO v_lote_no_pedido;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980015, 2026, 'concluida', 'tecelagem', v_lote_no_pedido) RETURNING id INTO v_op_lote_no_pedido;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_lote_no_pedido, v_mod_manta, 40) RETURNING id INTO v_it_lote_no_pedido;

  -- Deliberately inconsistent (only reachable with triggers off): the Lote's
  -- own cliente_id diverges from its Pedido's cliente_id.
  INSERT INTO public.lotes (numero, cliente_id, pedido_id) VALUES (980003, v_cli2, v_pedido) RETURNING id INTO v_lote_mismatch;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980016, 2026, 'concluida', 'tecelagem', v_lote_mismatch) RETURNING id INTO v_op_lote_mismatch;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_lote_mismatch, v_mod_manta, 40) RETURNING id INTO v_it_lote_mismatch;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980017, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_lineage_a;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_lineage_a, v_mod_manta, 40) RETURNING id INTO v_it_lineage_a;

  INSERT INTO public.lotes (numero, cliente_id, pedido_id) VALUES (980004, v_cli, v_pedido) RETURNING id INTO v_lote2;

  INSERT INTO public.lotes (numero, cliente_id, pedido_id) VALUES (980005, v_cli, v_pedido) RETURNING id INTO v_lote_unrelated;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (980018, 2026, 'concluida', 'tecelagem', v_lote_unrelated) RETURNING id INTO v_op_unrelated;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_unrelated, v_mod_manta, 40) RETURNING id INTO v_it_unrelated;
  INSERT INTO public.pedidos (cliente_id, numero, status) VALUES (v_cli, 980002, 'confirmado') RETURNING id INTO v_pedido_unrelated;

  PERFORM set_config('session_replication_role', 'origin', true);  -- guards ON.

  -- ==========================================================================
  -- (1) Exactly-one-source: both sources rejected; neither rejected.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicoes (pedido_id, op_latex_id, op_tecelagem_id, lote_id, cliente_id)
      VALUES (v_pedido, v_op_latex, v_op_manta, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(1a): expedicao with BOTH sources accepted'; END IF;

  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicoes (pedido_id, lote_id, cliente_id)
      VALUES (v_pedido, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(1b): expedicao with NEITHER source accepted'; END IF;

  -- ==========================================================================
  -- (2) Valid Latex source accepted (existing Tapete semantics preserved).
  -- ==========================================================================
  INSERT INTO public.expedicoes (pedido_id, op_latex_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_latex, v_lote, v_cli) RETURNING id INTO v_exp_latex;
  IF v_exp_latex IS NULL THEN RAISE EXCEPTION 'FAIL(2): valid Latex expedition not created'; END IF;

  -- ==========================================================================
  -- (3) Valid homogeneous Manta weaving source accepted.
  -- ==========================================================================
  INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_manta, v_lote, v_cli) RETURNING id INTO v_exp_manta;
  IF v_exp_manta IS NULL THEN RAISE EXCEPTION 'FAIL(3): valid Manta expedition not created'; END IF;

  -- ==========================================================================
  -- (4) Tapete weaving source rejected. (5) empty OP rejected. (6) mixed OP
  --     rejected defensively.
  -- ==========================================================================
  -- (lote_id/cliente_id supplied and correct throughout so rejection is
  -- unambiguously attributable to the route guard, not to db/84 lineage.)
  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_tapete_tec, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(4): Tapete weaving source accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_empty, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(5): empty weaving OP source accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_mixed, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(6): mixed weaving OP source accepted'; END IF;

  -- ==========================================================================
  -- (7) Duplicate Manta expedition source rejected (one expedition per OP).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_manta, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(7): duplicate Manta expedition source accepted'; END IF;

  -- ==========================================================================
  -- (8) Expedition item from the selected source accepted. This positive
  --     release (metros_liberados>0) is what makes the Manta output consumed.
  -- ==========================================================================
  INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, modelo_id, metros_liberados)
    VALUES (v_exp_manta, v_it_manta, v_mod_manta, 100) RETURNING id INTO v_xi;
  IF v_xi IS NULL THEN RAISE EXCEPTION 'FAIL(8): valid Manta expedition item not created'; END IF;

  -- ==========================================================================
  -- (9) Expedition item from another OP rejected (cross-OP injection).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, modelo_id, metros_liberados)
      VALUES (v_exp_manta, v_it_manta2, v_mod_manta, 10);  -- v_it_manta2 belongs to op_manta2
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(9): cross-OP expedition item accepted'; END IF;

  -- Latex expedition membership: a Latex item must belong to op_latex_id.
  INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, modelo_id, metros_liberados)
    VALUES (v_exp_latex, v_it_latex, v_mod_tapete, 50);
  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, modelo_id, metros_liberados)
      VALUES (v_exp_latex, v_it_manta, v_mod_manta, 10);  -- weaving item, not the latex OP
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(9b): cross-OP Latex expedition item accepted'; END IF;

  -- ==========================================================================
  -- (10) Source change that orphans existing items rejected.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.expedicoes SET op_tecelagem_id = v_op_manta2 WHERE id = v_exp_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(10): orphaning source change accepted'; END IF;

  -- ==========================================================================
  -- (11) Referenced source op_item move rejected; delete rejected (FK RESTRICT).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET op_id = v_op_manta2 WHERE id = v_it_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(11a): move of referenced op_item accepted'; END IF;

  v_ok := FALSE;
  BEGIN DELETE FROM public.op_itens WHERE id = v_it_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(11b): delete of referenced op_item accepted'; END IF;

  -- ==========================================================================
  -- (12) Unconsumed Manta output remains correctable (op_manta2, no release).
  -- ==========================================================================
  UPDATE public.entrega_itens SET metros_entregues = 82 WHERE id = v_ei_manta2;
  IF (SELECT metros_entregues FROM public.entrega_itens WHERE id = v_ei_manta2) <> 82 THEN
    RAISE EXCEPTION 'FAIL(12): unconsumed Manta output correction did not persist';
  END IF;

  -- ==========================================================================
  -- (13) Consumed Manta output UPDATE rejected. (14) DELETE rejected.
  --      Header mutation of the consumed entrega rejected too.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.entrega_itens SET metros_entregues = 120 WHERE id = v_ei_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(13a): consumed Manta output UPDATE accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.entrega_itens SET defeito = TRUE WHERE id = v_ei_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(13b): consumed Manta output defeito flip accepted'; END IF;

  v_ok := FALSE;
  BEGIN DELETE FROM public.entrega_itens WHERE id = v_ei_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(14a): consumed Manta output DELETE accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.entregas SET observacao = 'tamper' WHERE id = v_entrega_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(14b): consumed Manta entrega header mutation accepted'; END IF;

  -- A non-owning entrega header (unconsumed) stays mutable.
  UPDATE public.entregas SET observacao = 'ok' WHERE id = v_entrega_manta2;

  -- ==========================================================================
  -- (15) Controlled retificacao escape: consumed output becomes correctable
  --      only under app.retificacao_autorizada='on' (proven inside this
  --      rolled-back transaction; no UI enables the escape).
  -- ==========================================================================
  PERFORM set_config('app.retificacao_autorizada', 'on', true);
  UPDATE public.entrega_itens SET metros_entregues = 130 WHERE id = v_ei_manta;
  IF (SELECT metros_entregues FROM public.entrega_itens WHERE id = v_ei_manta) <> 130 THEN
    RAISE EXCEPTION 'FAIL(15): retificacao escape did not permit the consumed correction';
  END IF;
  PERFORM set_config('app.retificacao_autorizada', 'off', true);

  -- Escape reset: the guard is closed again.
  v_ok := FALSE;
  BEGIN DELETE FROM public.entrega_itens WHERE id = v_ei_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(15b): consumed DELETE accepted after escape reset'; END IF;

  -- ==========================================================================
  -- (16) Manta OP reopen AFTER positive release rejected (op_manta consumed).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.ops SET status = 'em_producao' WHERE id = v_op_manta;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(16): consumed Manta OP reopen accepted'; END IF;

  -- ==========================================================================
  -- (17) Manta OP reopen BEFORE release is inert to db/81 (op_manta2, no
  --      release): the reopening guard does not add a restriction.
  -- ==========================================================================
  UPDATE public.ops SET status = 'em_producao' WHERE id = v_op_manta2;
  IF (SELECT status FROM public.ops WHERE id = v_op_manta2) <> 'em_producao' THEN
    RAISE EXCEPTION 'FAIL(17): pre-release Manta OP reopen was wrongly blocked by db/81';
  END IF;

  -- ==========================================================================
  -- (18) Tapete behavior unchanged: db/81's reopen guard never fires for a
  --      non-Manta-sourced OP (op_tapete_tec has no op_tecelagem_id expedition).
  -- ==========================================================================
  UPDATE public.ops SET status = 'em_producao' WHERE id = v_op_tapete_tec;
  IF (SELECT status FROM public.ops WHERE id = v_op_tapete_tec) <> 'em_producao' THEN
    RAISE EXCEPTION 'FAIL(18): Tapete weaving OP reopen was wrongly blocked by db/81';
  END IF;

  -- (19) Retificacao escape also lifts the reopening restriction (atomic
  --      correction path). op_manta is terminal again for this probe.
  UPDATE public.ops SET status = 'concluida' WHERE id = v_op_manta2;  -- unrelated reset (unconsumed)
  PERFORM set_config('app.retificacao_autorizada', 'on', true);
  UPDATE public.ops SET status = 'em_producao' WHERE id = v_op_manta;
  IF (SELECT status FROM public.ops WHERE id = v_op_manta) <> 'em_producao' THEN
    RAISE EXCEPTION 'FAIL(19): retificacao escape did not lift the reopening restriction';
  END IF;
  PERFORM set_config('app.retificacao_autorizada', 'off', true);

  -- ==========================================================================
  -- db/83 BLOCKER A — source OP type immutability.
  -- (18) is covered by the still-unchanged tests above (11b/13-15 FK +
  -- consumed-output rejection): db/83 touches none of those guards.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.ops SET tipo = 'latex' WHERE id = v_op_manta_solo;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(20): selected Manta source ops.tipo change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.ops SET tipo = 'tecelagem' WHERE id = v_op_latex_solo;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(21): selected Latex source ops.tipo change accepted'; END IF;

  UPDATE public.ops SET tipo = 'tecelagem' WHERE id = v_op_manta_solo;  -- same-value update
  IF (SELECT tipo FROM public.ops WHERE id = v_op_manta_solo) <> 'tecelagem' THEN
    RAISE EXCEPTION 'FAIL(22): same-value ops.tipo update was wrongly blocked';
  END IF;

  v_ok := FALSE;
  PERFORM set_config('app.retificacao_autorizada', 'on', true);
  BEGIN UPDATE public.ops SET tipo = 'latex' WHERE id = v_op_manta_solo;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  PERFORM set_config('app.retificacao_autorizada', 'off', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(20b): retificacao escape wrongly lifted source-type immutability'; END IF;

  -- ==========================================================================
  -- db/83 BLOCKER B — source product route immutability (incl. single-item).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET modelo_id = v_mod_tapete WHERE id = v_it_manta_solo;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(23): single-item Manta source modelo_id -> Tapete accepted'; END IF;
  IF (SELECT tipo_produto FROM public.modelos WHERE id = (SELECT modelo_id FROM public.op_itens WHERE id = v_it_manta_solo)) <> 'manta' THEN
    RAISE EXCEPTION 'FAIL(23b): rejected single-item Manta source item was mutated anyway';
  END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta_multi, v_mod_tapete, 10);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(24): multi-item Manta source received a Tapete item'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET modelo_id = v_mod_manta WHERE id = v_it_latex_solo;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(25): single-item Latex source modelo_id -> Manta accepted'; END IF;

  -- Unreferenced OP (v_op_tapete_tec never became a selected source): a
  -- legal same-route (Tapete -> Tapete) model change stays permitted.
  UPDATE public.op_itens SET modelo_id = v_mod_tapete2 WHERE id = v_it_tapete;
  IF (SELECT modelo_id FROM public.op_itens WHERE id = v_it_tapete) <> v_mod_tapete2 THEN
    RAISE EXCEPTION 'FAIL(26): unreferenced OP same-route model change was wrongly blocked';
  END IF;

  -- ==========================================================================
  -- db/83 BLOCKER C — expedition item identity alignment.
  -- ==========================================================================
  INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados)
    VALUES (v_exp_manta_c, v_it_manta_c1, v_pi_manta, v_mod_manta, 40) RETURNING id INTO v_xi_c1;
  IF v_xi_c1 IS NULL THEN RAISE EXCEPTION 'FAIL(27): correctly aligned expedition item rejected'; END IF;

  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados)
      VALUES (v_exp_manta_c, v_it_manta_c2, NULL, v_mod_tapete, 10);  -- correct (NULL) pedido, wrong modelo
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(28): expedition item with wrong modelo_id accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.expedicao_itens SET pedido_item_id = v_pi_manta_other WHERE id = v_xi_c1;  -- correct op_item/model, wrong pedido_item_id
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(29): expedition item with wrong pedido_item_id (correct op_item/model) accepted'; END IF;

  v_ok := FALSE;
  BEGIN
    INSERT INTO public.expedicao_itens (expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados)
      VALUES (v_exp_manta_c, v_it_manta_c2, v_pi_manta, v_mod_manta, 10);  -- correct modelo, arbitrary non-null pedido on a NULL-origin item
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(30): NULL-origin op_item accepted an arbitrary non-null pedido_item_id'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.expedicao_itens SET pedido_item_id = NULL WHERE id = v_xi_c1;  -- op_item has non-null origin
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(31): non-NULL-origin op_item accepted a NULL pedido_item_id'; END IF;

  UPDATE public.expedicao_itens SET metros_entregues = 5 WHERE id = v_xi_c1;
  IF (SELECT metros_entregues FROM public.expedicao_itens WHERE id = v_xi_c1) <> 5
     OR (SELECT pedido_item_id FROM public.expedicao_itens WHERE id = v_xi_c1) <> v_pi_manta THEN
    RAISE EXCEPTION 'FAIL(32): quantity-only expedition item update was wrongly blocked or identity drifted';
  END IF;

  -- ==========================================================================
  -- db/83 BLOCKER D — referenced op_item identity immutability.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET modelo_id = v_mod_tapete WHERE id = v_it_manta_c1;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(33): referenced op_item modelo_id change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET pedido_item_id = v_pi_manta_other WHERE id = v_it_manta_c1;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(34): referenced op_item pedido_item_id change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.op_itens SET op_id = v_op_manta_multi WHERE id = v_it_manta_c1;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(35): referenced op_item op_id move accepted'; END IF;

  v_ok := FALSE;
  PERFORM set_config('app.retificacao_autorizada', 'on', true);
  BEGIN UPDATE public.op_itens SET modelo_id = v_mod_tapete WHERE id = v_it_manta_c1;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  PERFORM set_config('app.retificacao_autorizada', 'off', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(33b): retificacao escape wrongly lifted referenced op_item identity immutability'; END IF;

  UPDATE public.op_itens
     SET metros_pedidos = 45, op_id = v_op_manta_c, modelo_id = v_mod_manta, pedido_item_id = v_pi_manta
   WHERE id = v_it_manta_c1;
  IF (SELECT metros_pedidos FROM public.op_itens WHERE id = v_it_manta_c1) <> 45 THEN
    RAISE EXCEPTION 'FAIL(36): non-identity column update on a referenced op_item was wrongly blocked';
  END IF;

  -- ==========================================================================
  -- db/84 BLOCKER A — symmetric Latex source route validation.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_latex_id, lote_id, cliente_id) VALUES (v_pedido, v_op_latex_empty, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(37): empty Latex OP source accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_latex_id, lote_id, cliente_id) VALUES (v_pedido, v_op_latex_manta, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(38): Latex OP containing Manta accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_latex_id, lote_id, cliente_id) VALUES (v_pedido, v_op_latex_mixed, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(39): mixed Latex source accepted'; END IF;

  -- ==========================================================================
  -- db/84 BLOCKER B — source lineage existence and consistency.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_no_lote, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(40): source OP without Lote accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_lote_no_pedido, v_lote_no_pedido, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(41): Lote without Pedido accepted as source'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_lote_mismatch, v_lote_mismatch, v_cli2);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(42): Lote/Pedido client mismatch accepted as source'; END IF;

  -- ==========================================================================
  -- db/84 BLOCKER B — expedition payload must match the derived lineage.
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido_unrelated, v_op_lineage_a, v_lote, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(43): expedition pedido_id mismatch accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_lineage_a, v_lote2, v_cli);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(44): expedition lote_id mismatch accepted'; END IF;

  v_ok := FALSE;
  BEGIN INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id) VALUES (v_pedido, v_op_lineage_a, v_lote, v_cli2);
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(45): expedition cliente_id mismatch accepted'; END IF;

  -- (46) Valid exact lineage accepted.
  INSERT INTO public.expedicoes (pedido_id, op_tecelagem_id, lote_id, cliente_id)
    VALUES (v_pedido, v_op_lineage_a, v_lote, v_cli) RETURNING id INTO v_exp_lineage_a;
  IF v_exp_lineage_a IS NULL THEN RAISE EXCEPTION 'FAIL(46): valid exact-lineage expedition rejected'; END IF;
  IF (SELECT (lote_id, pedido_id, cliente_id) FROM public.expedicoes WHERE id = v_exp_lineage_a)
     IS DISTINCT FROM (v_lote, v_pedido, v_cli) THEN
    RAISE EXCEPTION 'FAIL(46b): accepted expedition lineage does not match the source-derived values';
  END IF;

  -- ==========================================================================
  -- db/84 BLOCKER C — expedition lineage immutability (UPDATE rejected).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.expedicoes SET pedido_id = v_pedido_unrelated WHERE id = v_exp_lineage_a;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(47): expedition pedido_id change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.expedicoes SET lote_id = v_lote2 WHERE id = v_exp_lineage_a;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(48): expedition lote_id change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.expedicoes SET cliente_id = v_cli2 WHERE id = v_exp_lineage_a;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(49): expedition cliente_id change accepted'; END IF;

  -- ==========================================================================
  -- db/84 BLOCKER D — selected source OP lineage immutability (lote_id).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.ops SET lote_id = v_lote2 WHERE id = v_op_lineage_a;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(50): selected source ops.lote_id change accepted'; END IF;

  -- ==========================================================================
  -- db/84 BLOCKER E — Lote lineage immutability (v_lote is a selected-source
  -- Lote via v_op_manta/v_exp_manta and v_op_lineage_a/v_exp_lineage_a).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.lotes SET pedido_id = v_pedido_unrelated WHERE id = v_lote;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(51): source lotes.pedido_id change accepted'; END IF;

  v_ok := FALSE;
  BEGIN UPDATE public.lotes SET cliente_id = v_cli2 WHERE id = v_lote;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(52): source lotes.cliente_id change accepted'; END IF;

  -- ==========================================================================
  -- db/84 BLOCKER F — Pedido client immutability (v_pedido participates via
  -- v_lote in the lineage of the selected-source OPs above).
  -- ==========================================================================
  v_ok := FALSE;
  BEGIN UPDATE public.pedidos SET cliente_id = v_cli2 WHERE id = v_pedido;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(53): source pedidos.cliente_id change accepted'; END IF;

  -- ==========================================================================
  -- (54) Unrelated OP/Lote/Pedido legal updates remain permitted (BLOCKER
  --      D/E/F inert for entities never selected as an expedition source).
  -- ==========================================================================
  UPDATE public.ops SET lote_id = v_lote2 WHERE id = v_op_unrelated;
  IF (SELECT lote_id FROM public.ops WHERE id = v_op_unrelated) <> v_lote2 THEN
    RAISE EXCEPTION 'FAIL(54a): unrelated ops.lote_id update was wrongly blocked';
  END IF;

  UPDATE public.lotes SET pedido_id = v_pedido_unrelated WHERE id = v_lote_unrelated;
  IF (SELECT pedido_id FROM public.lotes WHERE id = v_lote_unrelated) <> v_pedido_unrelated THEN
    RAISE EXCEPTION 'FAIL(54b): unrelated lotes.pedido_id update was wrongly blocked';
  END IF;

  UPDATE public.pedidos SET cliente_id = v_cli2 WHERE id = v_pedido_unrelated;
  IF (SELECT cliente_id FROM public.pedidos WHERE id = v_pedido_unrelated) <> v_cli2 THEN
    RAISE EXCEPTION 'FAIL(54c): unrelated pedidos.cliente_id update was wrongly blocked';
  END IF;

  -- ==========================================================================
  -- db/84 DELETE / FK EVIDENCE — no FK action was changed; the new UPDATE
  -- guards cause the parent DELETE to fail closed instead (ops.lote_id and
  -- expedicoes.lote_id are ON DELETE SET NULL from lotes; lotes.pedido_id is
  -- ON DELETE SET NULL from pedidos; Postgres implements these as a real
  -- UPDATE against the referencing table, which fires BLOCKER D/C/E).
  -- ==========================================================================
  -- (55) Deleting a source Lote must not silently null ops.lote_id /
  --      expedicoes.lote_id: the cascade SET NULL on ops (v_op_manta is a
  --      selected source) is rejected by BLOCKER D, failing the DELETE.
  v_ok := FALSE;
  BEGIN DELETE FROM public.lotes WHERE id = v_lote;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(55): deleting a source Lote (referenced by a selected-source OP) was accepted'; END IF;
  IF (SELECT lote_id FROM public.ops WHERE id = v_op_manta) <> v_lote THEN
    RAISE EXCEPTION 'FAIL(55b): source OP lote_id was silently nulled by a failed Lote delete';
  END IF;

  -- (56) Deleting/detaching a source Pedido must not silently null
  --      lotes.pedido_id: the cascade SET NULL on lotes (v_lote is a
  --      selected-source Lote) is rejected by BLOCKER E, failing the DELETE.
  v_ok := FALSE;
  BEGIN DELETE FROM public.pedidos WHERE id = v_pedido;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(56): deleting a source Pedido (referenced by a selected-source Lote) was accepted'; END IF;
  IF (SELECT pedido_id FROM public.lotes WHERE id = v_lote) <> v_pedido THEN
    RAISE EXCEPTION 'FAIL(56b): source Lote pedido_id was silently nulled by a failed Pedido delete';
  END IF;

  -- (57) Deleting the source client remains blocked outright by the
  --      pre-existing lotes.cliente_id / pedidos.cliente_id ON DELETE
  --      RESTRICT FKs (unchanged by this migration).
  v_ok := FALSE;
  BEGIN DELETE FROM public.clientes WHERE id = v_cli;
  EXCEPTION WHEN others THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL(57): deleting the source client was accepted'; END IF;

  RAISE NOTICE 'MANTA_EXPEDITION_SOURCE_INTEGRATION_PASS';
END
$mes$;

SELECT 'MANTA_EXPEDITION_SOURCE_INTEGRATION_PASS' AS result;

ROLLBACK;
