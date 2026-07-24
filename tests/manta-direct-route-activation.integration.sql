-- tests/manta-direct-route-activation.integration.sql
--
-- PHASE-MANTA-B2A integration proof of db/85 (route-conditional `cima`
-- delivery + the Manta output RPC).
--
-- Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
-- (§3 B2-1, §8 B2-6, §11 B2A test contract).
--
-- ENVIRONMENT: disposable local PostgreSQL ONLY. The external runner
-- (tests/manta-direct-route-activation-invariant.mjs) applies the
-- Supabase-platform preamble, then db/01..db/87 in order, then this file. Never a
-- shared/remote/managed host. This file opens ONE transaction, plants its own
-- fixtures with triggers off, exercises the guards and RPCs with triggers on, and
-- ROLLBACKs at the end -- zero persistent mutation. Clean apply, idempotent
-- re-apply with zero drift, and distinct-session concurrency are proven by the
-- runner, not here; because db/85's guards are IMMEDIATE, the rolled-back
-- transaction exercises them directly and no SET CONSTRAINTS is required.
--
-- Run:  psql -X -v ON_ERROR_STOP=1 -f tests/manta-direct-route-activation.integration.sql
-- Success = the MANTA_DIRECT_ROUTE_ACTIVATION_INTEGRATION_PASS sentinel, no error.

\set ON_ERROR_STOP on

BEGIN;

DO $mdra$
DECLARE
  -- shared fixtures
  v_c1 BIGINT; v_c2 BIGINT;
  v_forn_tec BIGINT; v_forn_latex BIGINT;
  v_cli BIGINT; v_pedido UUID; v_lote BIGINT;
  v_mod_manta BIGINT; v_mod_tapete BIGINT;
  v_admin UUID; v_naoadmin UUID;
  -- OPs
  v_op_manta BIGINT;      v_it_manta BIGINT;
  v_op_manta_b BIGINT;    v_it_manta_b BIGINT;
  v_op_tapete BIGINT;     v_it_tapete BIGINT;
  v_op_mixed BIGINT;      v_it_mixed_m BIGINT;
  v_op_empty BIGINT;
  v_op_latex BIGINT;      v_it_latex BIGINT;
  v_op_sem_lote BIGINT;   v_it_sem_lote BIGINT;
  -- deliveries
  v_ent_tap_sem_dest BIGINT;
  v_ent_tap_com_dest BIGINT; v_ei_tap BIGINT;
  v_ent_manta_com_dest BIGINT;
  v_ent_manta_sem_dest BIGINT; v_ei_manta BIGINT;
  v_ent_latex BIGINT;
  v_ent_vazia_com_dest BIGINT;
  -- RPC / assertions
  v_res JSONB;
  v_ok BOOLEAN;
  v_n INTEGER;
  v_num NUMERIC;
  v_txt TEXT;
  v_ent_rpc BIGINT;
  v_evt JSONB;
  -- db/86 fixtures
  v_pi_a UUID; v_pi_b UUID;
  v_op_rel BIGINT; v_it_r1 BIGINT; v_it_r2 BIGINT;
  v_op_idem BIGINT; v_it_idem BIGINT;
  v_exp_rel BIGINT; v_exp_idem BIGINT;
  v_res2 JSONB;
  v_item JSONB;
  v_cmd_id BIGINT;
  v_op_latex_gerada BIGINT;
BEGIN
  -- ==========================================================================
  -- FIXTURES (triggers OFF: db/78-85 guards must be exercised live afterwards,
  -- never pre-empted by the planting itself).
  -- ==========================================================================
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO public.cores (nome) VALUES ('MDRA-KRAFT') RETURNING id INTO v_c1;
  INSERT INTO public.cores (nome) VALUES ('MDRA-CRU')   RETURNING id INTO v_c2;
  INSERT INTO public.fornecedores (nome, tipo) VALUES ('MDRA-TECELAGEM', 'tecelagem') RETURNING id INTO v_forn_tec;
  INSERT INTO public.fornecedores (nome, tipo) VALUES ('MDRA-LATEX', 'latex')          RETURNING id INTO v_forn_latex;

  INSERT INTO public.modelos (nome, cor_1_id, cor_2_id, largura, tipo_produto)
    VALUES ('MDRA-MANTA', v_c1, v_c2, 1.40, 'manta')  RETURNING id INTO v_mod_manta;
  INSERT INTO public.modelos (nome, cor_1_id, cor_2_id, largura, tipo_produto)
    VALUES ('MDRA-TAPETE', v_c1, v_c2, 2.10, 'tapete') RETURNING id INTO v_mod_tapete;

  INSERT INTO public.clientes (nome) VALUES ('MDRA-CLI') RETURNING id INTO v_cli;
  INSERT INTO public.pedidos (cliente_id, numero, status)
    VALUES (v_cli, 985001, 'confirmado') RETURNING id INTO v_pedido;
  INSERT INTO public.lotes (numero, cliente_id, pedido_id)
    VALUES (985001, v_cli, v_pedido) RETURNING id INTO v_lote;

  -- Actors: is_admin() requires usuarios.tipo='admin' AND usuarios.ativo IS TRUE.
  INSERT INTO auth.users (email) VALUES ('mdra-admin@example.test') RETURNING id INTO v_admin;
  INSERT INTO auth.users (email) VALUES ('mdra-user@example.test')  RETURNING id INTO v_naoadmin;
  INSERT INTO public.usuarios (id, email, nome, tipo, ativo)
    VALUES (v_admin, 'mdra-admin@example.test', 'MDRA Admin', 'admin', TRUE);
  INSERT INTO public.usuarios (id, email, nome, tipo, fornecedor_id, ativo)
    VALUES (v_naoadmin, 'mdra-user@example.test', 'MDRA User', 'fornecedor', v_forn_tec, TRUE);

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985001, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985002, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_manta_b;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985003, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_tapete;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985004, 2026, 'simulada', 'tecelagem', v_lote) RETURNING id INTO v_op_mixed;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985005, 2026, 'simulada', 'tecelagem', v_lote) RETURNING id INTO v_op_empty;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985006, 2026, 'finalizada', 'latex', v_lote) RETURNING id INTO v_op_latex;
  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985007, 2026, 'concluida', 'tecelagem', NULL) RETURNING id INTO v_op_sem_lote;

  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta,   v_mod_manta,  120) RETURNING id INTO v_it_manta;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_manta_b, v_mod_manta,  120) RETURNING id INTO v_it_manta_b;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_tapete,  v_mod_tapete, 120) RETURNING id INTO v_it_tapete;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_latex,   v_mod_tapete, 120) RETURNING id INTO v_it_latex;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_sem_lote, v_mod_manta, 120) RETURNING id INTO v_it_sem_lote;
  -- Defensively-mixed OP (reachable only with triggers off; db/78-80 forbid it).
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_mixed, v_mod_manta,  60) RETURNING id INTO v_it_mixed_m;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (v_op_mixed, v_mod_tapete, 60);

  -- db/86: a Manta release source (2 items, commercial identity via pedido_itens)
  -- and a dedicated idempotency source.
  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, largura)
    VALUES (v_pedido, v_mod_manta, 100, 1.40) RETURNING id INTO v_pi_a;
  INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, largura)
    VALUES (v_pedido, v_mod_manta, 100, 1.40) RETURNING id INTO v_pi_b;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985008, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_rel;
  INSERT INTO public.op_itens (op_id, modelo_id, pedido_item_id, metros_pedidos)
    VALUES (v_op_rel, v_mod_manta, v_pi_a, 100) RETURNING id INTO v_it_r1;
  INSERT INTO public.op_itens (op_id, modelo_id, pedido_item_id, metros_pedidos)
    VALUES (v_op_rel, v_mod_manta, v_pi_b, 100) RETURNING id INTO v_it_r2;

  INSERT INTO public.ops (numero, ano, status, tipo, lote_id)
    VALUES (985009, 2026, 'concluida', 'tecelagem', v_lote) RETURNING id INTO v_op_idem;
  INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos)
    VALUES (v_op_idem, v_mod_manta, 100) RETURNING id INTO v_it_idem;

  -- Delivery headers planted without items (route rule is item-driven).
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_tec, 'cima', CURRENT_DATE, NULL)          RETURNING id INTO v_ent_tap_sem_dest;
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_tec, 'cima', CURRENT_DATE, v_forn_latex)  RETURNING id INTO v_ent_tap_com_dest;
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_tec, 'cima', CURRENT_DATE, v_forn_latex)  RETURNING id INTO v_ent_manta_com_dest;
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_tec, 'cima', CURRENT_DATE, NULL)          RETURNING id INTO v_ent_manta_sem_dest;
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_latex, 'latex', CURRENT_DATE, NULL)       RETURNING id INTO v_ent_latex;
  INSERT INTO public.entregas (fornecedor_id, etapa, data, destino_fornecedor_id)
    VALUES (v_forn_tec, 'cima', CURRENT_DATE, v_forn_latex)  RETURNING id INTO v_ent_vazia_com_dest;

  PERFORM set_config('session_replication_role', 'origin', true);  -- guards ON.
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);

  -- ==========================================================================
  -- A. Constraint evolution.
  -- ==========================================================================
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entregas_destino_cima_chk') THEN
    RAISE EXCEPTION 'not ok 1 - entregas_destino_cima_chk deveria ter sido removido por db/85';
  END IF;
  RAISE NOTICE 'ok 1 - entregas_destino_cima_chk removido (nao substituido por CHECK mais fraco)';

  IF (SELECT count(*) FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgname IN ('entrega_itens_cima_route_destino_guard','entregas_cima_destino_route_guard')) <> 2 THEN
    RAISE EXCEPTION 'not ok 2 - os dois guards de rota de db/85 devem existir';
  END IF;
  RAISE NOTICE 'ok 2 - guards de rota instalados (item + cabecalho)';

  -- ==========================================================================
  -- B. Item guard: the route-conditional destination rule (INSERT).
  -- ==========================================================================
  -- B1 Tapete cima WITHOUT destination -> rejected.
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_tap_sem_dest, v_op_tapete, v_it_tapete, v_mod_tapete, 50, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 3 - entrega cima Tapete SEM destino deveria ser rejeitada'; END IF;
  RAISE NOTICE 'ok 3 - entrega cima Tapete sem destino rejeitada';

  -- B2 Tapete cima WITH destination -> accepted (existing behavior preserved).
  INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (v_ent_tap_com_dest, v_op_tapete, v_it_tapete, v_mod_tapete, 50, FALSE)
    RETURNING id INTO v_ei_tap;
  IF v_ei_tap IS NULL THEN RAISE EXCEPTION 'not ok 4 - entrega cima Tapete COM destino deveria ser aceita'; END IF;
  RAISE NOTICE 'ok 4 - entrega cima Tapete com destino aceita (Tapete inalterado)';

  -- B3 Manta cima WITH destination -> rejected.
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_manta_com_dest, v_op_manta, v_it_manta, v_mod_manta, 50, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 5 - entrega cima Manta COM destino deveria ser rejeitada'; END IF;
  RAISE NOTICE 'ok 5 - entrega cima Manta com destino rejeitada';

  -- B4 Manta cima WITHOUT destination -> accepted.
  INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (v_ent_manta_sem_dest, v_op_manta, v_it_manta, v_mod_manta, 50, FALSE)
    RETURNING id INTO v_ei_manta;
  IF v_ei_manta IS NULL THEN RAISE EXCEPTION 'not ok 6 - entrega cima Manta SEM destino deveria ser aceita'; END IF;
  RAISE NOTICE 'ok 6 - entrega cima Manta sem destino aceita';

  -- B5 Cross-OP injection: op_item does not belong to the declared op_id.
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_manta_sem_dest, v_op_manta, v_it_manta_b, v_mod_manta, 10, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 7 - op_item de outra OP deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 7 - item que nao pertence a OP declarada rejeitado';

  -- B6 Unresolved source: NULL op_item_id on a `cima` parent.
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_manta_sem_dest, v_op_manta, NULL, v_mod_manta, 10, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 8 - item cima sem op_item_id deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 8 - origem irresolvivel (op_item_id nulo) rejeitada';

  -- B7 Mixed source OP -> rejected on both destination variants.
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_manta_sem_dest, v_op_mixed, v_it_mixed_m, v_mod_manta, 10, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 9 - OP fonte mista deveria ser rejeitada'; END IF;
  BEGIN
    INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
      VALUES (v_ent_tap_com_dest, v_op_mixed, v_it_mixed_m, v_mod_manta, 10, FALSE);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 10 - OP fonte mista deveria ser rejeitada tambem com destino'; END IF;
  RAISE NOTICE 'ok 9 - OP fonte mista/nao homogenea rejeitada (com e sem destino)';

  -- B8 Non-`cima` deliveries keep their existing behavior (no destination rule).
  INSERT INTO public.entrega_itens (entrega_id, op_id, op_item_id, modelo_id, metros_entregues, defeito)
    VALUES (v_ent_latex, v_op_latex, v_it_latex, v_mod_tapete, 40, FALSE);
  RAISE NOTICE 'ok 10 - entrega etapa=latex inalterada (sem regra de destino)';

  -- ==========================================================================
  -- C. Item guard: identity-changing UPDATE cannot bypass the rule.
  -- ==========================================================================
  -- C1 Moving a Manta item into a destination-bearing `cima` header -> rejected.
  BEGIN
    UPDATE public.entrega_itens SET entrega_id = v_ent_vazia_com_dest WHERE id = v_ei_manta;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 11 - mudar entrega_id nao pode contornar a validacao de rota'; END IF;
  RAISE NOTICE 'ok 11 - alteracao de entrega_id nao contorna a validacao de rota';

  -- C2 Moving a Tapete item into a destination-less `cima` header -> rejected.
  BEGIN
    UPDATE public.entrega_itens SET entrega_id = v_ent_tap_sem_dest WHERE id = v_ei_tap;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 12 - mover item Tapete para cabecalho sem destino deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 12 - mover item Tapete para cabecalho cima sem destino rejeitado';

  -- C3 Re-pointing op_item/op_id to a foreign OP -> rejected.
  BEGIN
    UPDATE public.entrega_itens SET op_id = v_op_manta_b, op_item_id = v_it_manta_b WHERE id = v_ei_tap;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 13 - repontar op_item para rota Manta em cabecalho com destino deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 13 - repontar identidade do item nao contorna a validacao de rota';

  -- C4 A quantity/defect UPDATE is NOT route-relevant: existing behavior kept.
  UPDATE public.entrega_itens SET metros_entregues = 55 WHERE id = v_ei_manta;
  IF (SELECT metros_entregues FROM public.entrega_itens WHERE id = v_ei_manta) <> 55 THEN
    RAISE EXCEPTION 'not ok 14 - correcao de metros_entregues deveria continuar permitida (sem consumo)';
  END IF;
  UPDATE public.entrega_itens SET metros_entregues = 50 WHERE id = v_ei_manta;
  RAISE NOTICE 'ok 14 - UPDATE de metros_entregues/defeito nao dispara a regra de rota';

  -- ==========================================================================
  -- D. Header guard.
  -- ==========================================================================
  -- D1 Adding a destination to a Manta `cima` -> rejected.
  BEGIN
    UPDATE public.entregas SET destino_fornecedor_id = v_forn_latex WHERE id = v_ent_manta_sem_dest;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 15 - adicionar destino a uma entrega cima Manta deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 15 - adicionar destino a entrega cima Manta rejeitado';

  -- D2 Removing the destination from a Tapete `cima` -> rejected.
  BEGIN
    UPDATE public.entregas SET destino_fornecedor_id = NULL WHERE id = v_ent_tap_com_dest;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 16 - remover destino de uma entrega cima Tapete deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 16 - remover destino de entrega cima Tapete rejeitado';

  -- D3 A non-route header UPDATE is untouched.
  UPDATE public.entregas SET observacao = 'MDRA-ok' WHERE id = v_ent_manta_sem_dest;
  IF (SELECT observacao FROM public.entregas WHERE id = v_ent_manta_sem_dest) <> 'MDRA-ok' THEN
    RAISE EXCEPTION 'not ok 17 - UPDATE de observacao deveria continuar permitido';
  END IF;
  RAISE NOTICE 'ok 17 - UPDATE de cabecalho nao relacionado a rota inalterado';

  -- D4 Changing etapa to `cima` re-derives the route from the existing items.
  BEGIN
    UPDATE public.entregas SET etapa = 'cima' WHERE id = v_ent_latex;
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 18 - promover para cima uma entrega Tapete sem destino deveria ser rejeitado'; END IF;
  RAISE NOTICE 'ok 18 - alteracao de etapa rederiva a rota a partir dos itens existentes';

  -- D5 The item-less `cima` header remains the accepted residual.
  UPDATE public.entregas SET destino_fornecedor_id = NULL WHERE id = v_ent_vazia_com_dest;
  IF (SELECT destino_fornecedor_id FROM public.entregas WHERE id = v_ent_vazia_com_dest) IS NOT NULL THEN
    RAISE EXCEPTION 'not ok 19 - cabecalho cima sem itens e o residual aceito';
  END IF;
  UPDATE public.entregas SET destino_fornecedor_id = v_forn_latex WHERE id = v_ent_vazia_com_dest;
  RAISE NOTICE 'ok 19 - cabecalho cima sem itens permanece o residual explicitamente aceito';

  -- ==========================================================================
  -- E. registrar_entrega_cima_manta -- authorization and validation.
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_naoadmin::TEXT, true);
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok 20 - chamador nao autorizado deveria ser rejeitado (got %)', v_res;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);
  RAISE NOTICE 'ok 20 - chamador nao autorizado rejeitado (sem_permissao)';

  -- Non-tecelagem source.
  v_res := public.registrar_entrega_cima_manta(
    v_op_latex, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_latex, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_tipo_invalido' THEN
    RAISE EXCEPTION 'not ok 21 - OP nao-tecelagem deveria ser rejeitada (got %)', v_res;
  END IF;

  -- Tapete (non-homogeneous-Manta) source.
  v_res := public.registrar_entrega_cima_manta(
    v_op_tapete, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_tapete, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_nao_manta' THEN
    RAISE EXCEPTION 'not ok 22 - OP Tapete deveria ser rejeitada (got %)', v_res;
  END IF;

  -- Mixed source.
  v_res := public.registrar_entrega_cima_manta(
    v_op_mixed, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_mixed_m, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_nao_manta' THEN
    RAISE EXCEPTION 'not ok 23 - OP mista deveria ser rejeitada (got %)', v_res;
  END IF;

  -- Empty source.
  v_res := public.registrar_entrega_cima_manta(
    v_op_empty, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_vazia' THEN
    RAISE EXCEPTION 'not ok 24 - OP vazia deveria ser rejeitada (got %)', v_res;
  END IF;

  -- Broken lineage (OP without lote).
  v_res := public.registrar_entrega_cima_manta(
    v_op_sem_lote, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_sem_lote, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'linhagem_invalida' THEN
    RAISE EXCEPTION 'not ok 25 - OP sem linhagem deveria ser rejeitada (got %)', v_res;
  END IF;
  RAISE NOTICE 'ok 21 - fonte invalida rejeitada (tipo, rota, vazia, linhagem) com identificadores estaveis';

  -- Payload validation.
  v_res := public.registrar_entrega_cima_manta(v_op_manta_b, v_forn_tec, CURRENT_DATE, '[]'::jsonb);
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'payload_vazio' THEN
    RAISE EXCEPTION 'not ok 26 - payload vazio deveria ser rejeitado (got %)', v_res;
  END IF;
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 0, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'metros_invalidos' THEN
    RAISE EXCEPTION 'not ok 27 - metragem zero deveria ser rejeitada (got %)', v_res;
  END IF;
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', -5, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'metros_invalidos' THEN
    RAISE EXCEPTION 'not ok 28 - metragem negativa deveria ser rejeitada (got %)', v_res;
  END IF;
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 10)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'defeito_ausente' THEN
    RAISE EXCEPTION 'not ok 29 - estado de defeito ausente deveria ser rejeitado (got %)', v_res;
  END IF;
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_manta, 'metros_entregues', 10, 'defeito', FALSE)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'item_fora_da_op' THEN
    RAISE EXCEPTION 'not ok 30 - item de outra OP deveria ser rejeitado (got %)', v_res;
  END IF;
  RAISE NOTICE 'ok 22 - payload invalido rejeitado (vazio, zero, negativo, defeito ausente, item alheio)';

  -- No partial write from any rejected call.
  SELECT count(*) INTO v_n FROM public.entrega_itens WHERE op_id = v_op_manta_b;
  IF v_n <> 0 THEN RAISE EXCEPTION 'not ok 31 - nenhuma chamada rejeitada pode ter escrito itens (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.op_eventos WHERE op_id = v_op_manta_b AND tipo_evento = 'manta_saida_registrada';
  IF v_n <> 0 THEN RAISE EXCEPTION 'not ok 32 - nenhuma chamada rejeitada pode ter escrito evento (got %)', v_n; END IF;
  RAISE NOTICE 'ok 23 - nenhuma escrita parcial apos rejeicao';

  -- ==========================================================================
  -- F. registrar_entrega_cima_manta -- atomic happy path.
  --    Duplicate payload entries are normalized per (op_item_id, defeito).
  -- ==========================================================================
  v_res := public.registrar_entrega_cima_manta(
    v_op_manta_b, v_forn_tec, DATE '2026-03-04',
    jsonb_build_array(
      jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 40,  'defeito', FALSE),
      jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 30,  'defeito', FALSE),
      jsonb_build_object('op_item_id', v_it_manta_b, 'metros_entregues', 5.5, 'defeito', TRUE)),
    'saida medida MDRA');

  IF NOT (v_res->>'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 33 - registro de saida Manta deveria ser aceito (got %)', v_res;
  END IF;
  v_ent_rpc := (v_res->>'entrega_id')::BIGINT;

  IF (v_res->>'total_medido')::NUMERIC <> 75.5
     OR (v_res->>'total_sem_defeito')::NUMERIC <> 70
     OR (v_res->>'total_defeito')::NUMERIC <> 5.5 THEN
    RAISE EXCEPTION 'not ok 34 - totais medidos incorretos (got %)', v_res;
  END IF;
  IF jsonb_array_length(v_res->'itens') <> 2 THEN
    RAISE EXCEPTION 'not ok 35 - entradas duplicadas devem ser normalizadas por (op_item_id, defeito) (got %)', v_res->'itens';
  END IF;
  RAISE NOTICE 'ok 24 - saida Manta registrada; duplicatas normalizadas deterministicamente';

  -- Header shape.
  SELECT etapa, destino_fornecedor_id, fornecedor_id INTO v_txt, v_n, v_num
    FROM public.entregas WHERE id = v_ent_rpc;
  IF v_txt <> 'cima' THEN RAISE EXCEPTION 'not ok 36 - etapa deveria ser cima'; END IF;
  IF v_n IS NOT NULL THEN RAISE EXCEPTION 'not ok 37 - destino_fornecedor_id deveria ser NULL'; END IF;
  IF v_num <> v_forn_tec THEN RAISE EXCEPTION 'not ok 38 - fornecedor de tecelagem deveria ficar no campo canonico'; END IF;
  IF (SELECT data FROM public.entregas WHERE id = v_ent_rpc) <> DATE '2026-03-04' THEN
    RAISE EXCEPTION 'not ok 39 - data informada deveria ser preservada';
  END IF;
  RAISE NOTICE 'ok 25 - cabecalho: etapa=cima, destino NULL, fornecedor de tecelagem canonico, data preservada';

  -- Item shape and identity.
  SELECT count(*) INTO v_n FROM public.entrega_itens WHERE entrega_id = v_ent_rpc;
  IF v_n <> 2 THEN RAISE EXCEPTION 'not ok 40 - deveriam existir 2 itens normalizados (got %)', v_n; END IF;
  IF EXISTS (SELECT 1 FROM public.entrega_itens
              WHERE entrega_id = v_ent_rpc
                AND (op_id <> v_op_manta_b OR op_item_id <> v_it_manta_b OR modelo_id <> v_mod_manta)) THEN
    RAISE EXCEPTION 'not ok 41 - identidade (op_id/op_item_id/modelo_id) deveria ser copiada exatamente';
  END IF;
  SELECT SUM(metros_entregues) INTO v_num FROM public.entrega_itens
    WHERE entrega_id = v_ent_rpc AND COALESCE(defeito, FALSE) = FALSE;
  IF v_num <> 70 THEN RAISE EXCEPTION 'not ok 42 - metragem sem defeito incorreta (got %)', v_num; END IF;
  SELECT SUM(metros_entregues) INTO v_num FROM public.entrega_itens
    WHERE entrega_id = v_ent_rpc AND defeito IS TRUE;
  IF v_num <> 5.5 THEN RAISE EXCEPTION 'not ok 43 - metragem com defeito incorreta (got %)', v_num; END IF;
  RAISE NOTICE 'ok 26 - itens gravados com identidade exata e estado de defeito explicito';

  -- No finishing side effect whatsoever.
  IF EXISTS (SELECT 1 FROM public.ops WHERE tipo = 'latex' AND origem_entrega_id = v_ent_rpc) THEN
    RAISE EXCEPTION 'not ok 44 - o escritor Manta nunca pode gerar OP de acabamento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.op_latex_entregas WHERE entrega_id = v_ent_rpc) THEN
    RAISE EXCEPTION 'not ok 45 - o escritor Manta nunca pode criar op_latex_entregas';
  END IF;
  RAISE NOTICE 'ok 27 - nenhuma OP Latex e nenhuma linha op_latex_entregas criada';

  -- Event.
  SELECT payload INTO v_evt FROM public.op_eventos
   WHERE op_id = v_op_manta_b AND tipo_evento = 'manta_saida_registrada'
   ORDER BY id DESC LIMIT 1;
  IF v_evt IS NULL THEN RAISE EXCEPTION 'not ok 46 - evento manta_saida_registrada deveria existir'; END IF;
  IF (v_evt->>'entrega_id')::BIGINT <> v_ent_rpc
     OR (v_evt->>'total_medido')::NUMERIC <> 75.5
     OR (v_evt->>'total_sem_defeito')::NUMERIC <> 70
     OR (v_evt->>'total_defeito')::NUMERIC <> 5.5
     OR jsonb_array_length(v_evt->'itens') <> 2
     OR v_evt->>'observacao' <> 'saida medida MDRA' THEN
    RAISE EXCEPTION 'not ok 47 - payload do evento incompleto (got %)', v_evt;
  END IF;
  IF (SELECT criado_por FROM public.op_eventos
       WHERE op_id = v_op_manta_b AND tipo_evento = 'manta_saida_registrada'
       ORDER BY id DESC LIMIT 1) IS DISTINCT FROM v_admin THEN
    RAISE EXCEPTION 'not ok 48 - criado_por deveria ser auth.uid()';
  END IF;
  RAISE NOTICE 'ok 28 - evento manta_saida_registrada com saldos, totais, defeitos, observacao e criado_por';

  -- ==========================================================================
  -- G. Authorization surface of the new function (grants exact).
  -- ==========================================================================
  IF NOT has_function_privilege('authenticated',
        'public.registrar_entrega_cima_manta(bigint,bigint,date,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok 49 - authenticated deveria ter EXECUTE';
  END IF;
  IF has_function_privilege('anon',
        'public.registrar_entrega_cima_manta(bigint,bigint,date,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok 50 - anon nao deveria ter EXECUTE';
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid = 'public.registrar_entrega_cima_manta(bigint,bigint,date,jsonb,text)'::regprocedure
     AND a.grantee = 0;
  IF v_n <> 0 THEN RAISE EXCEPTION 'not ok 51 - PUBLIC nao deveria constar na ACL (got %)', v_n; END IF;
  IF (SELECT prosecdef FROM pg_proc
       WHERE oid = 'public.registrar_entrega_cima_manta(bigint,bigint,date,jsonb,text)'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok 52 - a RPC deveria ser SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc
                  WHERE oid = 'public.registrar_entrega_cima_manta(bigint,bigint,date,jsonb,text)'::regprocedure
                    AND 'search_path=public' = ANY(proconfig)) THEN
    RAISE EXCEPTION 'not ok 53 - a RPC deveria fixar search_path=public';
  END IF;
  RAISE NOTICE 'ok 29 - grants exatos (authenticated EXECUTE; sem PUBLIC/anon), SECURITY DEFINER, search_path fixo';

  -- ==========================================================================
  -- H. Existing Latex expedition/delivery grants unchanged.
  -- ==========================================================================
  IF NOT has_function_privilege('authenticated',
        'public.liberar_expedicao_latex_parcial(bigint,jsonb,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
        'public.consultar_saldo_expedicao_latex(bigint)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
        'public.registrar_entrega_expedicao(bigint,text,date,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok 54 - grants das RPCs Latex existentes nao podem mudar';
  END IF;
  RAISE NOTICE 'ok 30 - grants das RPCs de expedicao/entrega Latex preservados';

  -- ==========================================================================
  -- I. Existing Tapete delivery behavior unchanged, through the real writer
  --    chain: the accepted `cima` Tapete delivery still generates its finishing
  --    OP and op_latex_entregas link exactly as before db/85.
  -- ==========================================================================
  v_res := public.gerar_op_latex(v_ent_tap_com_dest);
  IF v_res IS NULL THEN
    RAISE EXCEPTION 'not ok 55 - gerar_op_latex deveria continuar funcionando para uma entrega cima Tapete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops WHERE tipo = 'latex' AND origem_entrega_id = v_ent_tap_com_dest) THEN
    RAISE EXCEPTION 'not ok 56 - a entrega cima Tapete deveria gerar a OP de acabamento (got %)', v_res;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.op_latex_entregas WHERE entrega_id = v_ent_tap_com_dest) THEN
    RAISE EXCEPTION 'not ok 57 - o vinculo op_latex_entregas deveria ser criado';
  END IF;
  RAISE NOTICE 'ok 31 - fluxo Tapete cima -> gerar_op_latex -> op_latex_entregas inalterado';

  -- And the Manta finishing rejection remains intact and is now reachable from a
  -- real Manta `cima` delivery written by the new RPC.
  BEGIN
    PERFORM public.gerar_op_latex(v_ent_rpc);
    v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE;
  END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 58 - Manta nunca pode gerar OP de acabamento'; END IF;
  RAISE NOTICE 'ok 32 - rejeicao de acabamento para Manta intacta a partir da saida real da RPC';

  -- ==========================================================================
  -- J. db/86 -- Manta expedition balance and release.
  --    Measured output for v_op_rel: item 1 = 60 valid + 10 defect (planned 100),
  --    item 2 = 30 valid (planned 100). So `previsto` (100/100) is deliberately
  --    ABOVE the measured authority (60/30) and the defect metres are excluded.
  -- ==========================================================================
  v_res := public.registrar_entrega_cima_manta(
    v_op_rel, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(
      jsonb_build_object('op_item_id', v_it_r1, 'metros_entregues', 60, 'defeito', FALSE),
      jsonb_build_object('op_item_id', v_it_r1, 'metros_entregues', 10, 'defeito', TRUE),
      jsonb_build_object('op_item_id', v_it_r2, 'metros_entregues', 30, 'defeito', FALSE)));
  IF NOT (v_res->>'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 59 - a saida medida de apoio deveria ser registrada (got %)', v_res;
  END IF;

  -- J1 Balance read: exact per-item, defects excluded, planned display-only.
  v_res := public.consultar_saldo_expedicao_manta(v_op_rel);
  IF NOT (v_res->>'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 60 - consulta de saldo Manta deveria funcionar (got %)', v_res;
  END IF;
  IF (v_res->>'previsto_total')::NUMERIC <> 200
     OR (v_res->>'recebido_total')::NUMERIC <> 90
     OR (v_res->>'liberado_total')::NUMERIC <> 0
     OR (v_res->>'disponivel_total')::NUMERIC <> 90 THEN
    RAISE EXCEPTION 'not ok 61 - totais de saldo incorretos (got %)', v_res;
  END IF;
  v_item := v_res->'itens'->0;
  IF (v_item->>'op_item_id')::BIGINT <> LEAST(v_it_r1, v_it_r2) THEN
    RAISE EXCEPTION 'not ok 62 - ordenacao deveria ser deterministica por op_item_id (got %)', v_res->'itens';
  END IF;
  IF (v_item->>'previsto')::NUMERIC <> 100
     OR (v_item->>'recebido')::NUMERIC <> 60
     OR (v_item->>'disponivel')::NUMERIC <> 60
     OR (v_item->>'pedido_item_id')::UUID <> v_pi_a THEN
    RAISE EXCEPTION 'not ok 63 - saldo do item 1 incorreto; defeito deve ser excluido (got %)', v_item;
  END IF;
  RAISE NOTICE 'ok 33 - saldo Manta exato por op_item; metros com defeito excluidos; previsto apenas informativo';

  -- J2 Planned quantity is NOT an authority: 100 was planned, 60 was measured.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', 100)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'excede_disponivel' THEN
    RAISE EXCEPTION 'not ok 64 - liberar o planejado (100) acima do medido (60) deveria ser rejeitado (got %)', v_res;
  END IF;
  IF (v_res->>'disponivel')::NUMERIC <> 60 THEN
    RAISE EXCEPTION 'not ok 65 - a rejeicao deveria informar o disponivel medido (got %)', v_res;
  END IF;
  RAISE NOTICE 'ok 34 - quantidade planejada nao e autoridade; liberacao acima do disponivel rejeitada';

  -- J3 Invalid payloads.
  v_res := public.liberar_expedicao_manta_parcial(v_op_rel, '[]'::jsonb);
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'payload_vazio' THEN
    RAISE EXCEPTION 'not ok 66 - payload vazio deveria ser rejeitado (got %)', v_res;
  END IF;
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', 0)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'metros_invalidos' THEN
    RAISE EXCEPTION 'not ok 67 - quantidade zero deveria ser rejeitada (got %)', v_res;
  END IF;
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', -10)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'metros_invalidos' THEN
    RAISE EXCEPTION 'not ok 68 - quantidade negativa deveria ser rejeitada (got %)', v_res;
  END IF;
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 5)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'item_fora_da_op' THEN
    RAISE EXCEPTION 'not ok 69 - item de outra OP deveria ser rejeitado (got %)', v_res;
  END IF;
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_tapete, jsonb_build_array(jsonb_build_object('op_item_id', v_it_tapete, 'metros', 5)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_nao_manta' THEN
    RAISE EXCEPTION 'not ok 70 - OP Tapete nao pode liberar expedicao Manta (got %)', v_res;
  END IF;
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_latex, jsonb_build_array(jsonb_build_object('op_item_id', v_it_latex, 'metros', 5)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'op_tipo_invalido' THEN
    RAISE EXCEPTION 'not ok 71 - OP latex nao pode liberar expedicao Manta (got %)', v_res;
  END IF;
  IF EXISTS (SELECT 1 FROM public.expedicoes WHERE op_tecelagem_id = v_op_rel) THEN
    RAISE EXCEPTION 'not ok 72 - nenhuma rejeicao pode ter criado expedicao';
  END IF;
  RAISE NOTICE 'ok 35 - payload/fonte invalidos rejeitados sem qualquer mutacao';

  -- J4 Partial release: expedition created with the exact identity and balances.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', 40)),
    'primeira parcial');
  IF NOT (v_res->>'ok')::BOOLEAN OR NOT (v_res->>'created')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 73 - liberacao parcial deveria criar a expedicao (got %)', v_res;
  END IF;
  v_exp_rel := (v_res->>'expedicao_id')::BIGINT;
  IF (v_res->>'liberado_total')::NUMERIC <> 40 OR (v_res->>'saldo_restante')::NUMERIC <> 20 THEN
    RAISE EXCEPTION 'not ok 74 - totais da parcial incorretos (got %)', v_res;
  END IF;
  v_item := v_res->'itens'->0;
  IF (v_item->>'recebido')::NUMERIC <> 60
     OR (v_item->>'liberado_antes')::NUMERIC <> 0
     OR (v_item->>'liberar')::NUMERIC <> 40
     OR (v_item->>'liberado_depois')::NUMERIC <> 40
     OR (v_item->>'saldo_restante')::NUMERIC <> 20
     OR NOT (v_item->>'created')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 75 - saldos antes/depois incorretos (got %)', v_item;
  END IF;
  IF (SELECT op_latex_id FROM public.expedicoes WHERE id = v_exp_rel) IS NOT NULL
     OR (SELECT op_tecelagem_id FROM public.expedicoes WHERE id = v_exp_rel) <> v_op_rel THEN
    RAISE EXCEPTION 'not ok 76 - a expedicao deveria ter fonte Manta com op_latex_id NULL';
  END IF;
  IF (SELECT pedido_id FROM public.expedicoes WHERE id = v_exp_rel) <> v_pedido
     OR (SELECT lote_id FROM public.expedicoes WHERE id = v_exp_rel) <> v_lote
     OR (SELECT cliente_id FROM public.expedicoes WHERE id = v_exp_rel) <> v_cli THEN
    RAISE EXCEPTION 'not ok 77 - a linhagem deveria ser derivada da fonte';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.expedicao_itens
                  WHERE expedicao_id = v_exp_rel AND op_item_id = v_it_r1
                    AND modelo_id = v_mod_manta AND pedido_item_id = v_pi_a
                    AND metros_liberados = 40) THEN
    RAISE EXCEPTION 'not ok 78 - identidade (modelo_id/pedido_item_id) deveria ser copiada do op_item';
  END IF;
  RAISE NOTICE 'ok 36 - liberacao parcial aceita; expedicao Manta criada com identidade e linhagem exatas';

  -- J5 Additive re-release on the SAME expedition.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(
      jsonb_build_object('op_item_id', v_it_r1, 'metros', 12),
      jsonb_build_object('op_item_id', v_it_r1, 'metros', 8),
      jsonb_build_object('op_item_id', v_it_r2, 'metros', 30)));
  IF NOT (v_res->>'ok')::BOOLEAN OR (v_res->>'created')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 79 - a segunda liberacao deveria reutilizar a expedicao (got %)', v_res;
  END IF;
  IF (v_res->>'expedicao_id')::BIGINT <> v_exp_rel THEN
    RAISE EXCEPTION 'not ok 80 - a expedicao fonte deveria ser reutilizada';
  END IF;
  IF (v_res->>'liberado_total')::NUMERIC <> 50 OR (v_res->>'saldo_restante')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'not ok 81 - totais aditivos incorretos (got %)', v_res;
  END IF;
  SELECT SUM(metros_liberados) INTO v_num FROM public.expedicao_itens WHERE expedicao_id = v_exp_rel;
  IF v_num <> 90 THEN RAISE EXCEPTION 'not ok 82 - total liberado deveria ser 90 (got %)', v_num; END IF;
  RAISE NOTICE 'ok 37 - liberacao aditiva repetida aceita com duplicatas agregadas; expedicao reutilizada';

  -- J6 Overconsumption after full release.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', 0.01)));
  IF (v_res->>'ok')::BOOLEAN OR v_res->>'codigo' <> 'excede_disponivel' THEN
    RAISE EXCEPTION 'not ok 83 - liberar acima do medido deveria ser rejeitado (got %)', v_res;
  END IF;
  v_res := public.consultar_saldo_expedicao_manta(v_op_rel);
  IF (v_res->>'liberado_total')::NUMERIC <> 90 OR (v_res->>'disponivel_total')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'not ok 84 - saldo apos liberacao total incorreto (got %)', v_res;
  END IF;
  RAISE NOTICE 'ok 38 - sobreconsumo rejeitado; saldo pos-liberacao exato';

  -- J7 Release event.
  SELECT payload INTO v_evt FROM public.op_eventos
   WHERE op_id = v_op_rel AND tipo_evento = 'expedicao_manta_liberada' ORDER BY id DESC LIMIT 1;
  IF v_evt IS NULL
     OR (v_evt->>'expedicao_id')::BIGINT <> v_exp_rel
     OR (v_evt->>'liberado_total')::NUMERIC <> 50
     OR jsonb_array_length(v_evt->'itens') <> 2 THEN
    RAISE EXCEPTION 'not ok 85 - evento expedicao_manta_liberada incompleto (got %)', v_evt;
  END IF;
  IF (SELECT count(*) FROM public.op_eventos
       WHERE op_id = v_op_rel AND tipo_evento = 'expedicao_manta_liberada') <> 2 THEN
    RAISE EXCEPTION 'not ok 86 - deveria haver exatamente 2 eventos de liberacao';
  END IF;
  RAISE NOTICE 'ok 39 - evento expedicao_manta_liberada com saldos antes/depois e restante';

  -- ==========================================================================
  -- K. db/86 -- idempotency (dedicated source so balances stay meaningful).
  -- ==========================================================================
  v_res := public.registrar_entrega_cima_manta(
    v_op_idem, v_forn_tec, CURRENT_DATE,
    jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros_entregues', 80, 'defeito', FALSE)));
  IF NOT (v_res->>'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 87 - saida medida de apoio (idempotencia) deveria ser registrada (got %)', v_res;
  END IF;

  -- K1 NULL key: legacy additive execution, NO command row.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 10)));
  IF NOT (v_res->>'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'not ok 88 - liberacao sem chave deveria executar (got %)', v_res;
  END IF;
  v_exp_idem := (v_res->>'expedicao_id')::BIGINT;
  IF EXISTS (SELECT 1 FROM public.expedicao_comandos) THEN
    RAISE EXCEPTION 'not ok 89 - uma chamada sem chave nao pode gravar linha de comando';
  END IF;
  RAISE NOTICE 'ok 40 - chave NULL: execucao aditiva legada, sem linha de comando';

  -- K2 New key: executes once and persists the result atomically.
  v_res := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 20)),
    'com chave', 'K-1');
  IF NOT (v_res->>'ok')::BOOLEAN OR (v_res->>'liberado_total')::NUMERIC <> 20 THEN
    RAISE EXCEPTION 'not ok 90 - primeira execucao com chave deveria liberar 20 (got %)', v_res;
  END IF;
  SELECT id INTO v_cmd_id FROM public.expedicao_comandos
   WHERE idempotency_namespace = 'manta_release_v1' AND ator_id = v_admin AND idempotency_key = 'K-1';
  IF v_cmd_id IS NULL THEN RAISE EXCEPTION 'not ok 91 - a linha de comando deveria existir'; END IF;
  IF (SELECT resultado FROM public.expedicao_comandos WHERE id = v_cmd_id) <> v_res THEN
    RAISE EXCEPTION 'not ok 92 - o resultado armazenado deveria ser identico ao retornado';
  END IF;

  -- K3 Exact replay: stored result byte-for-byte, ZERO business mutation.
  SELECT SUM(metros_liberados) INTO v_num FROM public.expedicao_itens WHERE expedicao_id = v_exp_idem;
  SELECT count(*) INTO v_n FROM public.op_eventos
   WHERE op_id = v_op_idem AND tipo_evento = 'expedicao_manta_liberada';
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 20)),
    'com chave', 'K-1');
  IF v_res2 <> v_res THEN
    RAISE EXCEPTION 'not ok 93 - o replay deveria devolver o resultado armazenado byte a byte (got %)', v_res2;
  END IF;
  IF (SELECT SUM(metros_liberados) FROM public.expedicao_itens WHERE expedicao_id = v_exp_idem) <> v_num THEN
    RAISE EXCEPTION 'not ok 94 - o replay nao pode causar qualquer mutacao de negocio';
  END IF;
  IF (SELECT count(*) FROM public.op_eventos
       WHERE op_id = v_op_idem AND tipo_evento = 'expedicao_manta_liberada') <> v_n THEN
    RAISE EXCEPTION 'not ok 95 - o replay nao pode gravar um segundo evento';
  END IF;
  IF (SELECT count(*) FROM public.expedicao_comandos
       WHERE idempotency_namespace = 'manta_release_v1' AND ator_id = v_admin AND idempotency_key = 'K-1') <> 1 THEN
    RAISE EXCEPTION 'not ok 96 - o replay nao pode gravar uma segunda linha de comando';
  END IF;
  RAISE NOTICE 'ok 41 - replay exato: resultado armazenado byte a byte, zero mutacao de negocio';

  -- K3b Numeric normalization: 20 and 20.00 are the SAME request, not a conflict.
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 20.00)),
    'com chave', 'K-1');
  IF v_res2 <> v_res THEN
    RAISE EXCEPTION 'not ok 97 - 20 e 20.00 deveriam normalizar para a mesma requisicao (got %)', v_res2;
  END IF;
  RAISE NOTICE 'ok 42 - normalizacao numerica da requisicao e deterministica';

  -- K4 Same key, different request -> conflict with zero mutation.
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 25)),
    'com chave', 'K-1');
  IF (v_res2->>'ok')::BOOLEAN OR v_res2->>'codigo' <> 'idempotencia_conflitante' THEN
    RAISE EXCEPTION 'not ok 98 - chave reutilizada com comando diferente deveria conflitar (got %)', v_res2;
  END IF;
  IF (SELECT SUM(metros_liberados) FROM public.expedicao_itens WHERE expedicao_id = v_exp_idem) <> v_num THEN
    RAISE EXCEPTION 'not ok 99 - o conflito nao pode causar mutacao';
  END IF;
  RAISE NOTICE 'ok 43 - mesma chave com requisicao diferente conflita, sem mutacao';

  -- K5 A different key with the same target is a NEW additive command.
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 20)),
    'com chave', 'K-2');
  IF NOT (v_res2->>'ok')::BOOLEAN OR (v_res2->>'liberado_total')::NUMERIC <> 20 THEN
    RAISE EXCEPTION 'not ok 100 - uma nova chave deveria executar aditivamente (got %)', v_res2;
  END IF;
  IF (SELECT SUM(metros_liberados) FROM public.expedicao_itens WHERE expedicao_id = v_exp_idem) <> v_num + 20 THEN
    RAISE EXCEPTION 'not ok 101 - a segunda chave deveria somar 20';
  END IF;
  IF (SELECT count(*) FROM public.expedicao_comandos WHERE idempotency_namespace = 'manta_release_v1') <> 2 THEN
    RAISE EXCEPTION 'not ok 102 - deveriam existir exatamente 2 linhas de comando';
  END IF;
  RAISE NOTICE 'ok 44 - duas chaves distintas sao dois comandos aditivos';

  -- K6 Failed validation writes NO command row.
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_idem, jsonb_build_array(jsonb_build_object('op_item_id', v_it_idem, 'metros', 9999)),
    NULL, 'K-3');
  IF (v_res2->>'ok')::BOOLEAN OR v_res2->>'codigo' <> 'excede_disponivel' THEN
    RAISE EXCEPTION 'not ok 103 - a liberacao excessiva deveria falhar (got %)', v_res2;
  END IF;
  IF EXISTS (SELECT 1 FROM public.expedicao_comandos WHERE idempotency_key = 'K-3') THEN
    RAISE EXCEPTION 'not ok 104 - uma validacao falha nao pode gravar linha de comando';
  END IF;
  RAISE NOTICE 'ok 45 - validacao falha nao grava linha de comando (retry revalida o estado vivo)';

  -- K7 The command row is immutable.
  BEGIN UPDATE public.expedicao_comandos SET resultado = '{}'::jsonb WHERE id = v_cmd_id; v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE; END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 105 - expedicao_comandos deveria ser imutavel (UPDATE)'; END IF;
  BEGIN DELETE FROM public.expedicao_comandos WHERE id = v_cmd_id; v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE; END;
  IF v_ok THEN RAISE EXCEPTION 'not ok 106 - expedicao_comandos deveria ser imutavel (DELETE)'; END IF;
  -- Even the controlled technical escape does not open it.
  PERFORM set_config('app.retificacao_autorizada', 'on', true);
  BEGIN DELETE FROM public.expedicao_comandos WHERE id = v_cmd_id; v_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN v_ok := FALSE; END;
  PERFORM set_config('app.retificacao_autorizada', 'off', true);
  IF v_ok THEN RAISE EXCEPTION 'not ok 107 - nem retificacao autorizada pode apagar historico de comando'; END IF;
  RAISE NOTICE 'ok 46 - linha de comando imutavel (UPDATE/DELETE rejeitados, sem bypass)';

  -- ==========================================================================
  -- L. db/86 -- authorization, RLS and grants.
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_naoadmin::TEXT, true);
  v_res2 := public.consultar_saldo_expedicao_manta(v_op_rel);
  IF (v_res2->>'ok')::BOOLEAN OR v_res2->>'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok 108 - consulta de saldo exige admin (got %)', v_res2;
  END IF;
  v_res2 := public.liberar_expedicao_manta_parcial(
    v_op_rel, jsonb_build_array(jsonb_build_object('op_item_id', v_it_r1, 'metros', 1)));
  IF (v_res2->>'ok')::BOOLEAN OR v_res2->>'codigo' <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok 109 - liberacao exige admin (got %)', v_res2;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, true);
  RAISE NOTICE 'ok 47 - RPCs de saldo/liberacao Manta sao admin-only';

  IF NOT has_function_privilege('authenticated', 'public.consultar_saldo_expedicao_manta(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.consultar_saldo_expedicao_manta(bigint)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.liberar_expedicao_manta_parcial(bigint,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.liberar_expedicao_manta_parcial(bigint,jsonb,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok 110 - grants das RPCs db/86 incorretos';
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid IN ('public.consultar_saldo_expedicao_manta(bigint)'::regprocedure,
                   'public.liberar_expedicao_manta_parcial(bigint,jsonb,text,text)'::regprocedure)
     AND a.grantee = 0;
  IF v_n <> 0 THEN RAISE EXCEPTION 'not ok 111 - PUBLIC nao deveria constar nas ACLs db/86 (got %)', v_n; END IF;
  IF (SELECT count(*) FROM pg_proc
       WHERE oid IN ('public.consultar_saldo_expedicao_manta(bigint)'::regprocedure,
                     'public.liberar_expedicao_manta_parcial(bigint,jsonb,text,text)'::regprocedure)
         AND prosecdef AND 'search_path=public' = ANY(proconfig)) <> 2 THEN
    RAISE EXCEPTION 'not ok 112 - as RPCs db/86 deveriam ser SECURITY DEFINER com search_path=public';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.expedicao_comandos'::regclass) THEN
    RAISE EXCEPTION 'not ok 113 - expedicao_comandos deveria ter RLS habilitado';
  END IF;
  IF has_table_privilege('authenticated', 'public.expedicao_comandos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.expedicao_comandos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.expedicao_comandos', 'DELETE')
     OR has_table_privilege('authenticated', 'public.expedicao_comandos', 'SELECT')
     OR has_table_privilege('anon', 'public.expedicao_comandos', 'SELECT') THEN
    RAISE EXCEPTION 'not ok 114 - expedicao_comandos nao pode ter caminho de DML/leitura de cliente';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.expedicao_comandos'::regclass
                AND contype = 'f'
                AND confrelid IN ('public.expedicoes'::regclass, 'public.expedicao_itens'::regclass)) THEN
    RAISE EXCEPTION 'not ok 115 - expedicao_comandos nao pode ter FK para linhas de expedicao';
  END IF;
  RAISE NOTICE 'ok 48 - expedicao_comandos: RLS on, sem grants de cliente, sem FK para linhas de expedicao';

  -- ==========================================================================
  -- M. Latex release and delivery unchanged (functional regression through the
  --    real Tapete chain generated in section I).
  -- ==========================================================================
  SELECT id INTO v_op_latex_gerada FROM public.ops
   WHERE tipo = 'latex' AND origem_entrega_id = v_ent_tap_com_dest ORDER BY id DESC LIMIT 1;
  IF v_op_latex_gerada IS NULL THEN
    RAISE EXCEPTION 'not ok 116 - a OP Latex gerada deveria existir';
  END IF;
  UPDATE public.ops SET status = 'em_producao' WHERE id = v_op_latex_gerada;

  v_res2 := public.consultar_saldo_expedicao_latex(v_op_latex_gerada);
  IF NOT (v_res2->>'ok')::BOOLEAN OR (v_res2->>'recebido_total')::NUMERIC <> 50 THEN
    RAISE EXCEPTION 'not ok 117 - saldo Latex deveria continuar correto (got %)', v_res2;
  END IF;
  v_res2 := public.liberar_expedicao_latex_parcial(
    v_op_latex_gerada,
    jsonb_build_array(jsonb_build_object(
      'op_item_id', (SELECT id FROM public.op_itens WHERE op_id = v_op_latex_gerada ORDER BY id LIMIT 1),
      'metros', 30)));
  IF NOT (v_res2->>'ok')::BOOLEAN OR (v_res2->>'liberado_total')::NUMERIC <> 30 THEN
    RAISE EXCEPTION 'not ok 118 - a liberacao parcial Latex deveria continuar funcionando (got %)', v_res2;
  END IF;
  IF (SELECT op_tecelagem_id FROM public.expedicoes WHERE id = (v_res2->>'expedicao_id')::BIGINT) IS NOT NULL THEN
    RAISE EXCEPTION 'not ok 119 - a expedicao Latex nao pode ganhar fonte Manta';
  END IF;
  v_res2 := public.registrar_entrega_expedicao(
    (v_res2->>'expedicao_id')::BIGINT, 'entrega', CURRENT_DATE,
    jsonb_build_array(jsonb_build_object(
      'expedicao_item_id', (SELECT id FROM public.expedicao_itens
                             WHERE expedicao_id = (v_res2->>'expedicao_id')::BIGINT ORDER BY id LIMIT 1),
      'metros', 30)));
  IF NOT (v_res2->>'ok')::BOOLEAN OR v_res2->>'status' <> 'concluida' THEN
    RAISE EXCEPTION 'not ok 120 - a entrega ao cliente Latex deveria continuar funcionando (got %)', v_res2;
  END IF;
  RAISE NOTICE 'ok 49 - fluxo Latex (saldo -> liberacao parcial -> entrega ao cliente) inalterado';

  RAISE NOTICE 'MANTA_DIRECT_ROUTE_ACTIVATION_INTEGRATION_PASS';
END
$mdra$;

ROLLBACK;
