-- tests/db111-entrega-cima-idempotencia.integration.sql
--
-- db/111 (TD3) — replay identity of the top-level delivery command.
--
-- An identical replay must return the SAME delivery, the SAME finishing
-- OP and the SAME split_seq while creating nothing; a conflicting reuse
-- of the same key must be refused and write nothing. Wire ordering of
-- the lines must not change the identity of the command.

\set ON_ERROR_STOP on

SET session_replication_role = replica;
INSERT INTO public.fornecedores (id, nome, tipo)
VALUES (940000403, 'P1-FORN-TECELAGEM', 'tecelagem'),
       (940000404, 'P1-FORN-LATEX', 'latex')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (940111005, 941105, 2099, 940000701, 'aberta', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (940111105, 940111005, 940000301, 100.00),
  (940111106, 940111005, 940000301, 100.00)
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

DO $t$
DECLARE
  v_a      JSONB;
  v_b      JSONB;
  v_c      JSONB;
  v_ent0   INTEGER;
  v_item0  INTEGER;
  v_ops0   INTEGER;
  v_cmd0   INTEGER;
  v_n      INTEGER;
BEGIN
  -- =================================================================
  -- A. FIRST APPLICATION
  -- =================================================================
  v_a := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111005, DATE '2099-03-04', 'P1 db111 replay', 940000404,
    '[{"op_item_id":940111105,"metros_entregues":12.00,"defeito":false,"observacao":null},
      {"op_item_id":940111106,"metros_entregues":8.50,"defeito":true,"observacao":"refugo"}]'::jsonb,
    'db111-replay-1');

  IF NOT COALESCE((v_a ->> 'ok')::BOOLEAN, FALSE)
     OR NOT COALESCE((v_a -> 'acabamento' ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - A1: the first application did not succeed (%)', v_a;
  END IF;

  SELECT count(*) INTO v_ent0  FROM public.entregas;
  SELECT count(*) INTO v_item0 FROM public.entrega_itens;
  SELECT count(*) INTO v_ops0  FROM public.ops WHERE tipo IN ('latex','acabamento');
  SELECT count(*) INTO v_cmd0  FROM public.entrega_cima_comandos;

  -- =================================================================
  -- B. IDENTICAL REPLAY — same result, zero new rows
  -- =================================================================
  v_b := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111005, DATE '2099-03-04', 'P1 db111 replay', 940000404,
    '[{"op_item_id":940111105,"metros_entregues":12.00,"defeito":false,"observacao":null},
      {"op_item_id":940111106,"metros_entregues":8.50,"defeito":true,"observacao":"refugo"}]'::jsonb,
    'db111-replay-1');

  IF v_b IS DISTINCT FROM v_a THEN
    RAISE EXCEPTION 'not ok - B1: the replay returned a different result (% vs %)', v_b, v_a;
  END IF;
  IF (v_b ->> 'entrega_id') IS DISTINCT FROM (v_a ->> 'entrega_id') THEN
    RAISE EXCEPTION 'not ok - B2: the replay returned a different delivery id';
  END IF;
  IF (v_b -> 'acabamento' ->> 'op_latex_id') IS DISTINCT FROM (v_a -> 'acabamento' ->> 'op_latex_id') THEN
    RAISE EXCEPTION 'not ok - B3: the replay returned a different finishing OP id';
  END IF;
  IF (v_b -> 'acabamento' ->> 'split_seq') IS DISTINCT FROM (v_a -> 'acabamento' ->> 'split_seq') THEN
    RAISE EXCEPTION 'not ok - B4: the replay returned a different split_seq';
  END IF;

  SELECT count(*) INTO v_n FROM public.entregas;
  IF v_n <> v_ent0 THEN RAISE EXCEPTION 'not ok - B5: the replay created a delivery (%->%)', v_ent0, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.entrega_itens;
  IF v_n <> v_item0 THEN RAISE EXCEPTION 'not ok - B6: the replay created items (%->%)', v_item0, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.ops WHERE tipo IN ('latex','acabamento');
  IF v_n <> v_ops0 THEN RAISE EXCEPTION 'not ok - B7: the replay created a finishing OP (%->%)', v_ops0, v_n; END IF;
  SELECT count(*) INTO v_n FROM public.entrega_cima_comandos;
  IF v_n <> v_cmd0 THEN RAISE EXCEPTION 'not ok - B8: the replay created a command row (%->%)', v_cmd0, v_n; END IF;

  RAISE NOTICE 'ok - B: an identical replay returned the same delivery, finishing OP and split_seq and created nothing';

  -- =================================================================
  -- C. WIRE ORDER IS NOT IDENTITY — the same lines submitted in the
  --    opposite order are the SAME command, not a conflict.
  -- =================================================================
  v_c := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111005, DATE '2099-03-04', 'P1 db111 replay', 940000404,
    '[{"op_item_id":940111106,"metros_entregues":8.50,"defeito":true,"observacao":"refugo"},
      {"op_item_id":940111105,"metros_entregues":12.00,"defeito":false,"observacao":null}]'::jsonb,
    'db111-replay-1');

  IF v_c IS DISTINCT FROM v_a THEN
    RAISE EXCEPTION 'not ok - C1: line order changed the command identity (%)', v_c;
  END IF;
  SELECT count(*) INTO v_n FROM public.entrega_cima_comandos;
  IF v_n <> v_cmd0 THEN RAISE EXCEPTION 'not ok - C2: the reordered replay wrote a row'; END IF;

  RAISE NOTICE 'ok - C: canonicalization makes wire order irrelevant to command identity';

  -- =================================================================
  -- D. CONFLICTING REUSE — same key, different payload
  -- =================================================================
  v_b := public.registrar_entrega_cima_com_acabamento(
    940000403, 940111005, DATE '2099-03-04', 'P1 db111 replay', 940000404,
    '[{"op_item_id":940111105,"metros_entregues":99.00,"defeito":false,"observacao":null}]'::jsonb,
    'db111-replay-1');

  IF COALESCE((v_b ->> 'ok')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'not ok - D1: conflicting key reuse was accepted (%)', v_b;
  END IF;
  IF v_b ->> 'codigo' <> 'comando_conflitante' THEN
    RAISE EXCEPTION 'not ok - D2: unexpected refusal identity (%)', v_b;
  END IF;

  SELECT count(*) INTO v_n FROM public.entregas;
  IF v_n <> v_ent0 THEN RAISE EXCEPTION 'not ok - D3: the conflict created a delivery'; END IF;
  SELECT count(*) INTO v_n FROM public.entrega_itens;
  IF v_n <> v_item0 THEN RAISE EXCEPTION 'not ok - D4: the conflict created items'; END IF;
  SELECT count(*) INTO v_n FROM public.ops WHERE tipo IN ('latex','acabamento');
  IF v_n <> v_ops0 THEN RAISE EXCEPTION 'not ok - D5: the conflict created a finishing OP'; END IF;
  SELECT count(*) INTO v_n FROM public.entrega_cima_comandos;
  IF v_n <> v_cmd0 THEN RAISE EXCEPTION 'not ok - D6: the conflict created a command row'; END IF;

  RAISE NOTICE 'ok - D: conflicting key reuse was refused with comando_conflitante and wrote nothing';

  -- =================================================================
  -- E. THE COMMAND STORE IS APPEND-ONLY
  -- =================================================================
  BEGIN
    UPDATE public.entrega_cima_comandos SET resultado = '{}'::jsonb
     WHERE idempotency_key = 'db111-replay-1';
    RAISE EXCEPTION 'not ok - E1: the command evidence is mutable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'not ok%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'ok - E: entrega_cima_comandos is append-only';
END
$t$;

SELECT 'DB111_IDEMPOTENCIA_PASS' AS marker;
