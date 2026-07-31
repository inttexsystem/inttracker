-- tests/db111-entrega-cima-acabamento-atomico.integration.sql
--
-- db/111 (TD3, 9.9.J) — the server-owned atomic weaving delivery.
--
-- Proves the four semantics the browser sequence could not give: ONE
-- command creates the delivery, its complete item set and exactly one
-- finishing OP; a forced finishing failure PRESERVES the committed
-- delivery and its evidence; the whole effect is owned by ONE
-- transaction and disappears together on rollback; and a validation
-- failure creates nothing at all.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.fornecedores (id, nome, tipo)
VALUES (940000403, 'P1-FORN-TECELAGEM', 'tecelagem'),
       (940000404, 'P1-FORN-LATEX', 'latex')
  ON CONFLICT (id) DO NOTHING;

-- A Manta model + OP, so the route refusal is proved against a real
-- Manta lineage rather than a name.
INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto)
VALUES (940111201, 'P1-MODELO-MANTA', 940000201, 940000202, 1.40, 'manta')
  ON CONFLICT (id) DO NOTHING;

-- Dedicated OPs so this suite never competes with db/102, db/105 or db/108.
INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (940111001, 941101, 2099, 940000701, 'aberta', 'tecelagem'),
  (940111002, 941102, 2099, 940000701, 'aberta', 'tecelagem'),
  (940111003, 941103, 2099, 940000701, 'aberta', 'tecelagem'),
  (940111004, 941104, 2099, 940000701, 'aberta', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (940111101, 940111001, 940000301, 100.00),   -- tapete
  (940111102, 940111002, 940111201, 100.00),   -- MANTA route
  (940111103, 940111003, 940000301, 100.00),   -- tapete, forced failure
  (940111104, 940111004, 940000301, 100.00)    -- tapete, rollback proof
  ON CONFLICT (id) DO NOTHING;
-- The finishing writer takes its OP number from a ROW in op_numeros, so a
-- rolled-back creation attempt reverts that counter while committed OPs
-- keep their numbers. Earlier finishing suites in this same disposable
-- cluster can therefore leave the ('latex', <year>) high-water mark BEHIND
-- the real maximum, and the next allocation would collide with
-- ops_identidade_operacional_uidx. Reconcile it here (db/27's own
-- high-water idiom) so this suite measures the writer, not the numbering
-- residue of a previous suite.
INSERT INTO public.op_numeros (tipo, ano, ultimo_numero)
SELECT 'latex', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, COALESCE(MAX(o.numero), 0)
  FROM public.ops o
 WHERE o.tipo = 'latex' AND o.ano = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
ON CONFLICT (tipo, ano) DO UPDATE
   SET ultimo_numero = GREATEST(public.op_numeros.ultimo_numero, EXCLUDED.ultimo_numero);

-- The canonical OP identity OP-{T|A}{pedido}-{seq}-{yy} draws its seq from
-- public.pedido_identidade_numeros through proximo_seq_identidade, which is a
-- ROW counter with exactly the same revert-on-rollback behaviour. db/95 ships
-- a post-invariant asserting this high-water mark is never behind
-- MAX(identidade_seq), so reconciling it is the sanctioned repair shape.
INSERT INTO public.pedido_identidade_numeros (pedido_id, escopo, ultimo_seq)
SELECT o.identidade_pedido_id, o.identidade_tipo_letra, MAX(o.identidade_seq)
  FROM public.ops o
 WHERE o.identidade_seq IS NOT NULL
   AND o.identidade_pedido_id IS NOT NULL
 GROUP BY 1, 2
ON CONFLICT (pedido_id, escopo) DO UPDATE
   SET ultimo_seq = GREATEST(public.pedido_identidade_numeros.ultimo_seq, EXCLUDED.ultimo_seq);

SET session_replication_role = origin;

SELECT set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);

-- =====================================================================
-- A. SUCCESS — one command, one delivery, one complete item set,
--    exactly one finishing OP, success evidence, one top-level command.
-- =====================================================================
DO $t$
DECLARE
  v_res   JSONB;
  v_ent   BIGINT;
  v_op    BIGINT;
  v_n     INTEGER;
BEGIN
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, 'P1 db111 sucesso', 940000404,
    '[{"op_item_id":940111101,"metros_entregues":40.00,"defeito":false,"observacao":"linha A"}]'::jsonb,
    'db111-ok-1');

  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A1: the command failed (%)', v_res;
  END IF;
  IF NOT COALESCE((v_res ->> 'entrega_registrada')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A2: entrega_registrada is not true (%)', v_res;
  END IF;
  IF NOT COALESCE((v_res -> 'acabamento' ->> 'ok')::BOOLEAN, FALSE) THEN
    -- Surface the recorded cause rather than only the refusal identity:
    -- db/108 stores the real SQLSTATE and message on the attempt row.
    RAISE EXCEPTION 'not ok - A3: the finishing OP was not created (% | recorded: %)',
      v_res,
      COALESCE((SELECT t.codigo_falha || ' ' || t.mensagem
                  FROM public.op_acabamento_tentativas t
                 WHERE t.origem_entrega_id = (v_res ->> 'entrega_id')::BIGINT
                 ORDER BY t.id DESC LIMIT 1), '<no attempt row>')
      || ' || existing=' || COALESCE((SELECT string_agg(o.identidade_operacional || '#' || o.id, ',' ORDER BY o.id)
                                        FROM public.ops o WHERE o.identidade_operacional IS NOT NULL), '<none>')
      || ' || counters=' || COALESCE((SELECT string_agg(n.escopo || '=' || n.ultimo_seq, ',' ORDER BY n.escopo)
                                        FROM public.pedido_identidade_numeros n), '<none>');
  END IF;

  v_ent := (v_res ->> 'entrega_id')::BIGINT;
  v_op  := (v_res -> 'acabamento' ->> 'op_latex_id')::BIGINT;

  IF v_ent IS NULL OR v_op IS NULL THEN
    RAISE EXCEPTION 'not ok - A4: the result omits entrega_id or op_latex_id (%)', v_res;
  END IF;
  IF (v_res -> 'acabamento' ->> 'split_seq')::SMALLINT IS DISTINCT FROM 0::SMALLINT THEN
    RAISE EXCEPTION 'not ok - A5: first split_seq is not 0 (%)', v_res;
  END IF;

  -- Exactly ONE delivery header, with the declared route fields.
  SELECT count(*) INTO v_n FROM public.entregas e
   WHERE e.id = v_ent AND e.etapa = 'cima'
     AND e.fornecedor_id = 940000403 AND e.destino_fornecedor_id = 940000404;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A6: the delivery header is not the declared one (n=%)', v_n;
  END IF;

  -- The COMPLETE item set, with preserved fields and NUMERIC(10,2).
  SELECT count(*) INTO v_n FROM public.entrega_itens ei
   WHERE ei.entrega_id = v_ent AND ei.op_id = 940111001
     AND ei.op_item_id = 940111101 AND ei.metros_entregues = 40.00
     AND ei.defeito = FALSE AND ei.observacao = 'linha A';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A7: the item set is not the submitted one (n=%)', v_n;
  END IF;

  -- Exactly ONE finishing OP for this delivery.
  SELECT count(*) INTO v_n FROM public.ops o
   WHERE o.origem_entrega_id = v_ent AND o.tipo IN ('latex','acabamento');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A8: expected exactly one finishing OP, found %', v_n;
  END IF;

  -- Success attempt evidence (db/108), written by the composed writer.
  SELECT count(*) INTO v_n FROM public.op_acabamento_tentativas t
   WHERE t.origem_entrega_id = v_ent AND t.resultado = 'sucesso' AND t.op_id = v_op;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A9: missing success attempt evidence (n=%)', v_n;
  END IF;

  -- Exactly ONE top-level command row, bound to the delivery.
  SELECT count(*) INTO v_n FROM public.entrega_cima_comandos c
   WHERE c.idempotency_key = 'db111-ok-1' AND c.entrega_id = v_ent
     AND c.idempotency_namespace = 'entrega_cima_v1';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - A10: expected exactly one top-level command row (n=%)', v_n;
  END IF;

  RAISE NOTICE 'ok - A: one command created the delivery, its items, one finishing OP and all evidence';
END
$t$;

-- =====================================================================
-- B. FORCED INNER FAILURE — disposable-test-only mechanism against the
--    finishing-OP INSERT. The delivery must survive.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._db111_forcar_falha_acabamento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo = 'latex' THEN
    RAISE EXCEPTION 'db111-forced-finishing-failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER db111_forcar_falha_acabamento
  BEFORE INSERT ON public.ops
  FOR EACH ROW EXECUTE FUNCTION public._db111_forcar_falha_acabamento();

DO $t$
DECLARE
  v_res JSONB;
  v_ent BIGINT;
  v_n   INTEGER;
BEGIN
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111003, CURRENT_DATE, 'P1 db111 falha forcada', 940000404,
    '[{"op_item_id":940111103,"metros_entregues":25.50,"defeito":false,"observacao":null}]'::jsonb,
    'db111-fail-1');

  -- The DELIVERY still succeeded overall. A finishing failure must NOT
  -- convert a valid committed delivery into a failed delivery result.
  IF NOT COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - B1: a finishing failure turned the delivery into a failure (%)', v_res;
  END IF;
  IF NOT COALESCE((v_res ->> 'entrega_registrada')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - B2: entrega_registrada is not true (%)', v_res;
  END IF;
  IF COALESCE((v_res -> 'acabamento' ->> 'ok')::BOOLEAN, TRUE) THEN
    RAISE EXCEPTION 'not ok - B3: the finishing result claims success (%)', v_res;
  END IF;
  IF v_res -> 'acabamento' ->> 'codigo' <> 'ACABAMENTO_CRIACAO_FALHOU' THEN
    RAISE EXCEPTION 'not ok - B4: unexpected finishing refusal identity (%)', v_res;
  END IF;
  IF COALESCE((v_res -> 'acabamento' ->> 'recuperavel')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - B5: the failure is not marked recoverable (%)', v_res;
  END IF;
  IF v_res ->> 'proxima_acao' <> 'RECUPERAR_OP_ACABAMENTO' THEN
    RAISE EXCEPTION 'not ok - B6: the result does not expose RECUPERAR_OP_ACABAMENTO (%)', v_res;
  END IF;

  v_ent := (v_res ->> 'entrega_id')::BIGINT;

  -- The delivery and its items are COMMITTED.
  SELECT count(*) INTO v_n FROM public.entregas WHERE id = v_ent;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - B7: the delivery did not survive the finishing failure (n=%)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.entrega_itens
   WHERE entrega_id = v_ent AND op_item_id = 940111103 AND metros_entregues = 25.50;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - B8: the delivery items did not survive (n=%)', v_n;
  END IF;

  -- NO finishing OP exists.
  SELECT count(*) INTO v_n FROM public.ops
   WHERE origem_entrega_id = v_ent AND tipo IN ('latex','acabamento');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - B9: a finishing OP exists despite the forced failure (n=%)', v_n;
  END IF;

  -- Exactly ONE falha attempt row, committed with the delivery.
  SELECT count(*) INTO v_n FROM public.op_acabamento_tentativas
   WHERE origem_entrega_id = v_ent AND resultado = 'falha' AND op_id IS NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'not ok - B10: expected exactly one falha attempt row (n=%)', v_n;
  END IF;

  -- Retry is unlocked ONLY by that proved failure.
  IF public.pode_recuperar_op_acabamento(v_ent) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - B11: pode_recuperar_op_acabamento did not unlock retry';
  END IF;

  RAISE NOTICE 'ok - B: the delivery survived a forced finishing failure with committed evidence and an unlocked retry';
END
$t$;

DROP TRIGGER db111_forcar_falha_acabamento ON public.ops;
DROP FUNCTION public._db111_forcar_falha_acabamento();

-- =====================================================================
-- C. VALIDATION FAILURES CREATE NOTHING
-- =====================================================================
DO $t$
DECLARE
  v_res    JSONB;
  v_ent0   INTEGER;
  v_item0  INTEGER;
  v_cmd0   INTEGER;
  v_ent1   INTEGER;
  v_item1  INTEGER;
  v_cmd1   INTEGER;
BEGIN
  SELECT count(*) INTO v_ent0  FROM public.entregas;
  SELECT count(*) INTO v_item0 FROM public.entrega_itens;
  SELECT count(*) INTO v_cmd0  FROM public.entrega_cima_comandos;

  -- C1: an op_item belonging to ANOTHER OP.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, NULL, 940000404,
    '[{"op_item_id":940111104,"metros_entregues":10.00,"defeito":false,"observacao":null}]'::jsonb,
    'db111-neg-foreign');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_ITEM_FORA_DA_OP' THEN
    RAISE EXCEPTION 'not ok - C1: a foreign op_item was accepted (%)', v_res;
  END IF;

  -- C2: the same op_item twice.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, NULL, 940000404,
    '[{"op_item_id":940111101,"metros_entregues":10.00,"defeito":false,"observacao":null},
      {"op_item_id":940111101,"metros_entregues":5.00,"defeito":true,"observacao":null}]'::jsonb,
    'db111-neg-dup');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_ITEM_DUPLICADO' THEN
    RAISE EXCEPTION 'not ok - C2: a duplicated op_item was accepted (%)', v_res;
  END IF;

  -- C3: a non-positive quantity.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, NULL, 940000404,
    '[{"op_item_id":940111101,"metros_entregues":0,"defeito":false,"observacao":null}]'::jsonb,
    'db111-neg-qty');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_METROS_INVALIDOS' THEN
    RAISE EXCEPTION 'not ok - C3: a non-positive quantity was accepted (%)', v_res;
  END IF;

  -- C4: the MANTA route, which belongs to registrar_entrega_cima_manta.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111002, CURRENT_DATE, NULL, 940000404,
    '[{"op_item_id":940111102,"metros_entregues":10.00,"defeito":false,"observacao":null}]'::jsonb,
    'db111-neg-manta');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_ROTA_NAO_TAPETE' THEN
    RAISE EXCEPTION 'not ok - C4: a Manta OP was accepted by the Tapete writer (%)', v_res;
  END IF;

  -- C5: the Tapete route without a finishing destination.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, NULL, NULL,
    '[{"op_item_id":940111101,"metros_entregues":10.00,"defeito":false,"observacao":null}]'::jsonb,
    'db111-neg-destino');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_DESTINO_OBRIGATORIO' THEN
    RAISE EXCEPTION 'not ok - C5: a Tapete delivery without destination was accepted (%)', v_res;
  END IF;

  -- C6: a missing idempotency key.
  v_res := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111001, CURRENT_DATE, NULL, 940000404,
    '[{"op_item_id":940111101,"metros_entregues":10.00,"defeito":false,"observacao":null}]'::jsonb,
    '   ');
  IF COALESCE((v_res ->> 'ok')::BOOLEAN, FALSE)
     OR v_res ->> 'codigo' <> 'ENTREGA_CHAVE_OBRIGATORIA' THEN
    RAISE EXCEPTION 'not ok - C6: a blank idempotency key was accepted (%)', v_res;
  END IF;

  SELECT count(*) INTO v_ent1  FROM public.entregas;
  SELECT count(*) INTO v_item1 FROM public.entrega_itens;
  SELECT count(*) INTO v_cmd1  FROM public.entrega_cima_comandos;

  IF v_ent1 <> v_ent0 OR v_item1 <> v_item0 OR v_cmd1 <> v_cmd0 THEN
    RAISE EXCEPTION
      'not ok - C7: a validation refusal wrote rows (entregas %->%, itens %->%, comandos %->%)',
      v_ent0, v_ent1, v_item0, v_item1, v_cmd0, v_cmd1;
  END IF;

  RAISE NOTICE 'ok - C: every validation refusal created nothing at all';
END
$t$;

-- =====================================================================
-- D. TRANSACTION OWNERSHIP — the whole effect belongs to ONE
--    transaction and disappears together on rollback.
-- =====================================================================
-- psql does NOT interpolate :variables inside dollar-quoted bodies, so the
-- assertions below are plain SQL against a session-temp helper created
-- BEFORE the transaction (it must survive the ROLLBACK).
CREATE FUNCTION pg_temp._db111_assert(p_cond BOOLEAN, p_msg TEXT)
RETURNS VOID LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_cond IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - %', p_msg;
  END IF;
END;
$fn$;

BEGIN;

SELECT (public.registrar_entrega_cima_com_acabamento(
          940000403, 940111004, CURRENT_DATE, 'P1 db111 rollback', 940000404,
          '[{"op_item_id":940111104,"metros_entregues":33.00,"defeito":false,"observacao":null}]'::jsonb,
          'db111-tx-1') ->> 'entrega_id')::BIGINT AS tx_entrega_id \gset

SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entregas WHERE id = :tx_entrega_id) = 1,
  'D1: the delivery is not visible inside the transaction');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entrega_itens WHERE entrega_id = :tx_entrega_id) = 1,
  'D2: the items are not visible inside the transaction');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.ops
    WHERE origem_entrega_id = :tx_entrega_id AND tipo IN ('latex','acabamento')) = 1,
  'D3: the finishing OP is not visible inside the transaction');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.op_acabamento_tentativas WHERE origem_entrega_id = :tx_entrega_id) = 1,
  'D4: the attempt evidence is not visible inside the transaction');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entrega_cima_comandos WHERE entrega_id = :tx_entrega_id) = 1,
  'D5: the command row is not visible inside the transaction');

ROLLBACK;

SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entregas WHERE id = :tx_entrega_id) = 0,
  'D6: the delivery survived the rollback');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entrega_itens WHERE entrega_id = :tx_entrega_id) = 0,
  'D7: the items survived the rollback');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.ops
    WHERE origem_entrega_id = :tx_entrega_id AND tipo IN ('latex','acabamento')) = 0,
  'D8: the finishing OP survived the rollback');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.op_acabamento_tentativas WHERE origem_entrega_id = :tx_entrega_id) = 0,
  'D9: the attempt evidence survived the rollback');
SELECT pg_temp._db111_assert(
  (SELECT count(*) FROM public.entrega_cima_comandos WHERE entrega_id = :tx_entrega_id) = 0,
  'D10: the command row survived the rollback');

DO $t$
BEGIN
  RAISE NOTICE 'ok - D: delivery, items, finishing OP and both evidence rows were visible in ONE transaction and disappeared together on rollback';
END
$t$;

SELECT 'DB111_ATOMICO_PASS' AS marker;
