-- tests/db123-tecelagem-rolos.integration.sql
--
-- TECELAGEM-V1-FIRST-VERTICAL-SLICE — db/123 acceptance scenarios.
--
-- Driven by tests/db123-tecelagem-rolos.integration.mjs, which owns the
-- disposable cluster, the schema reconstruction and the Admin-domain
-- before/after fingerprint. This file owns the PRODUCT scenarios and the
-- security negatives, and emits DB123_ACCEPTANCE_PASS only when every one of
-- them holds.
--
-- Every registration below runs as the real runtime identity — role
-- `authenticated` with request.jwt.claim.sub set — never as the superuser, so
-- the grants and the RLS policies are genuinely exercised.

\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS proof;
DROP TABLE IF EXISTS proof.resultado;
CREATE TABLE proof.resultado (caso TEXT PRIMARY KEY, valor TEXT);
GRANT USAGE ON SCHEMA proof TO authenticated;
GRANT INSERT, SELECT ON proof.resultado TO authenticated;

-- Identities fixed by the driver fixture.
\set tec_user   '9d1f0000-0000-4000-8000-00000000be01'
\set other_user '9d1f0000-0000-4000-8000-00000000be02'
\set admin_user '9d1f0000-0000-4000-8000-00000000ad01'
\set item_a     930000511
\set item_b     930000512
\set item_c     930000513
\set op_trabalho 930000501
\set op_pronta   930000502
\set op_bloqueada 930000503

-- =====================================================================
-- SCENARIO 0 — LOCAL PRODUCTION START IS THE GATE.
--
-- Before anything else: registering a roll on an OP the weaving operator has
-- NOT started is refused by the SERVER. The interface is not what makes the
-- action unavailable.
--
-- OP 930000501 is deliberately 'em_producao' in the Admin lifecycle here, so
-- this scenario also proves the gate is the LOCAL fact and not ops.status.
-- =====================================================================
DO $gate$
DECLARE v_recusado BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 3);
  EXCEPTION WHEN sqlstate '55000' THEN
    v_recusado := TRUE;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO proof.resultado VALUES
    ('c0_registro_sem_inicio_recusado', v_recusado::text),
    ('c0_nada_gravado', ((SELECT count(*) FROM public.tecelagem_rolos) = 0)::text),
    ('c0_admin_em_producao_nao_basta',
     ((SELECT status FROM public.ops WHERE id = 930000501) = 'em_producao')::text);
END
$gate$;

-- O operador inicia a produção. É ESTE fato que abre o registro.
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;

INSERT INTO proof.resultado
SELECT 'c0_inicio_ja_iniciada',
       (public.iniciar_producao_tecelagem(:op_trabalho) ->> 'ja_iniciada');

RESET ROLE;

INSERT INTO proof.resultado VALUES
  ('c0_execucao_persistida',
   (SELECT count(*)::text FROM public.tecelagem_op_execucao WHERE op_id = :op_trabalho)),
  ('c0_execucao_do_fornecedor_certo',
   (SELECT fornecedor_id::text FROM public.tecelagem_op_execucao WHERE op_id = :op_trabalho));

-- =====================================================================
-- SCENARIO 1 — the reference acceptance scenario.
-- Register 10 rolls with NO length supplied at all.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;

INSERT INTO proof.resultado
SELECT 'c1_retorno_quantidade',
       (public.registrar_producao_tecelagem(:item_a, 10) ->> 'quantidade_rolos');

RESET ROLE;

INSERT INTO proof.resultado VALUES
  ('c1_rolos_persistidos',  (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c1_rolos_distintos',    (SELECT count(DISTINCT id)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c1_numeros_distintos',  (SELECT count(DISTINCT numero)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c1_numeracao',          (SELECT string_agg(numero::text, ',' ORDER BY numero) FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c1_sem_comprimento',    (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a AND comprimento_m IS NULL)),
  ('c1_situacao_unica',     (SELECT string_agg(DISTINCT situacao, ',') FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c1_lancamentos',        (SELECT count(*)::text FROM public.tecelagem_producao_lancamentos WHERE op_item_id = :item_a));

-- =====================================================================
-- SCENARIO 2 — a second registration on the SAME product continues the
-- operator-visible numbering instead of restarting it.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;
SELECT public.registrar_producao_tecelagem(:item_a, 5);
RESET ROLE;

INSERT INTO proof.resultado VALUES
  ('c2_total_rolos',    (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c2_numero_maximo',  (SELECT max(numero)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a)),
  ('c2_sem_colisao',    (SELECT (count(*) = count(DISTINCT numero))::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a));

-- =====================================================================
-- SCENARIO 3 — RATIFIED RULE: the visible number is sequential WITHIN THE OP.
-- A different product of the SAME OP CONTINUES the sequence; it does not
-- restart it. Two rolls of one OP may never share a visible number.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;
SELECT public.registrar_producao_tecelagem(:item_b, 2);
RESET ROLE;

INSERT INTO proof.resultado VALUES
  ('c3_rolos_produto_b',   (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_b)),
  ('c3_numeracao_b',       (SELECT string_agg(numero::text, ',' ORDER BY numero) FROM public.tecelagem_rolos WHERE op_item_id = :item_b)),
  ('c3_produto_a_intacto', (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_a));

-- =====================================================================
-- SCENARIO 4 — OPTIONAL LENGTH.
-- A partially measured batch: one measured roll, one unmeasured, one measured.
-- The unmeasured roll must be a normal, valid, visible roll.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;
SELECT public.registrar_producao_tecelagem(:item_b, 3, ARRAY[28.4, NULL, 12.0]::NUMERIC[]);
RESET ROLE;

INSERT INTO proof.resultado VALUES
  ('c4_total_b',          (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_b)),
  ('c4_com_comprimento',  (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_b AND comprimento_m IS NOT NULL)),
  ('c4_sem_comprimento',  (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = :item_b AND comprimento_m IS NULL)),
  ('c4_valor_medido',     (SELECT comprimento_m::text FROM public.tecelagem_rolos WHERE op_item_id = :item_b AND comprimento_m = 28.4));

-- =====================================================================
-- SCENARIO 4b — NO VISIBLE-NUMBER COLLISION ANYWHERE IN THE OP.
-- Measured across the whole OP, not per product: this is the ratified rule.
-- =====================================================================
INSERT INTO proof.resultado VALUES
  ('c4b_rolos_na_op',      (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_id = 930000501)),
  ('c4b_numeros_distintos',(SELECT count(DISTINCT numero)::text FROM public.tecelagem_rolos WHERE op_id = 930000501)),
  ('c4b_faixa',            (SELECT min(numero) || '-' || max(numero) FROM public.tecelagem_rolos WHERE op_id = 930000501)),
  -- Dois produtos distintos, nenhum número repetido entre eles.
  ('c4b_produtos_na_op',   (SELECT count(DISTINCT op_item_id)::text FROM public.tecelagem_rolos WHERE op_id = 930000501));

-- A trava é ESTRUTURAL: nem um chamador defeituoso consegue colidir.
DO $colisao$
DECLARE v_bloqueado BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.tecelagem_rolos (lancamento_id, op_id, op_item_id, fornecedor_id, numero)
    SELECT r.lancamento_id, r.op_id, r.op_item_id, r.fornecedor_id, r.numero
      FROM public.tecelagem_rolos r WHERE r.op_id = 930000501 LIMIT 1;
  EXCEPTION WHEN unique_violation THEN
    v_bloqueado := TRUE;
  END;
  INSERT INTO proof.resultado VALUES ('c4b_colisao_bloqueada', v_bloqueado::text);
END
$colisao$;

-- =====================================================================
-- SCENARIO 4c — O CLIENTE E A ELEGIBILIDADE CHEGAM AO FORNECEDOR.
-- O cliente é definido pela Ravatex e é somente leitura aqui; a
-- elegibilidade é DERIVADA do ciclo de vida que já existe.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;

INSERT INTO proof.resultado
SELECT 'c4c_ops_visiveis', count(*)::text FROM public.tecelagem_minhas_ops();

INSERT INTO proof.resultado
SELECT 'c4c_cliente', COALESCE(max(cliente_nome), '<nulo>')
  FROM public.tecelagem_minhas_ops() WHERE op_id = 930000501;

INSERT INTO proof.resultado
SELECT 'c4c_situacoes',
       string_agg(op_id || '=' || situacao_execucao, ',' ORDER BY op_id)
  FROM public.tecelagem_minhas_ops();

INSERT INTO proof.resultado
SELECT 'c4c_motivo_bloqueio', COALESCE(max(motivo_bloqueio), '<nulo>')
  FROM public.tecelagem_minhas_ops() WHERE op_id = 930000503;

RESET ROLE;

-- Um fornecedor alheio não enxerga NENHUMA destas OPs nem o cliente delas.
SET request.jwt.claim.sub = :'other_user';
SET ROLE authenticated;
INSERT INTO proof.resultado
SELECT 'c4c_ops_de_outro', count(*)::text FROM public.tecelagem_minhas_ops();
RESET ROLE;

-- E continua SEM leitura direta de clientes/lotes: o cliente só chega pela
-- projeção que db/123 possui.
DO $cli$
DECLARE v_negado INTEGER := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.clientes';
    -- RLS pode devolver 0 linhas em vez de recusar; ambos são aceitáveis,
    -- desde que o NOME não seja legível.
    IF (SELECT count(*) FROM public.clientes) > 0 THEN
      RAISE EXCEPTION 'VAZOU: fornecedor leu linhas de clientes diretamente';
    END IF;
    v_negado := v_negado + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_negado := v_negado + 1;
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO proof.resultado VALUES ('c4c_sem_leitura_direta_clientes', (v_negado = 1)::text);
END
$cli$;

-- =====================================================================
-- SCENARIO 5 — RLS. The supplier sees its own rolls; a different supplier
-- sees none of them; the admin sees everything.
-- =====================================================================
SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;
INSERT INTO proof.resultado
SELECT 'c5_visivel_ao_dono', count(*)::text FROM public.tecelagem_rolos;
RESET ROLE;

SET request.jwt.claim.sub = :'other_user';
SET ROLE authenticated;
INSERT INTO proof.resultado
SELECT 'c5_visivel_a_outro', count(*)::text FROM public.tecelagem_rolos;
RESET ROLE;

SET request.jwt.claim.sub = :'admin_user';
SET ROLE authenticated;
INSERT INTO proof.resultado
SELECT 'c5_visivel_ao_admin', count(*)::text FROM public.tecelagem_rolos;
RESET ROLE;

-- =====================================================================
-- SCENARIO 6 — NEGATIVES. Each must refuse AND leave nothing behind.
-- =====================================================================
DO $negativos$
DECLARE
  v_antes_rolos    INTEGER;
  v_antes_lanc     INTEGER;
  v_antes_seq      INTEGER;
  v_recusas        INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_antes_rolos FROM public.tecelagem_rolos;
  SELECT count(*) INTO v_antes_lanc  FROM public.tecelagem_producao_lancamentos;
  SELECT COALESCE(sum(proximo), 0) INTO v_antes_seq FROM public.tecelagem_rolo_sequencia;

  -- 6.1 A supplier that does not weave this OP.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be02', false);
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 4);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: outro fornecedor conseguiu registrar';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 6.2 An admin is not a supplier: meu_fornecedor_id() is NULL for them.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 4);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: admin conseguiu registrar producao de tecelagem';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);

  -- 6.3 Zero rolls.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 0);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: quantidade 0 aceita';
  EXCEPTION WHEN sqlstate '22023' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 6.4 Length array that does not match the roll count.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 3, ARRAY[10.0, 20.0]::NUMERIC[]);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: comprimentos incompativeis aceitos';
  EXCEPTION WHEN sqlstate '22023' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 6.5 A non-positive individual length.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000511, 2, ARRAY[10.0, 0.0]::NUMERIC[]);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: comprimento nao positivo aceito';
  EXCEPTION WHEN sqlstate '22023' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 6.6 A product that does not exist at all.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(999999999, 2);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: produto inexistente aceito';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 6.7 Uma OP ATRIBUÍDA a este fornecedor, mas cuja produção o operador ainda
  --     NÃO iniciou nesta superfície. O registro é recusado pelo servidor até
  --     que o início local exista.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.registrar_producao_tecelagem(930000513, 2);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: registro aceito em OP fora de producao';
  EXCEPTION WHEN sqlstate '55000' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO proof.resultado VALUES ('c6_recusas', v_recusas::text);

  -- Nothing may have been written by ANY refused call, and the visible-number
  -- allocator must not have leaked a single number.
  INSERT INTO proof.resultado VALUES
    ('c6_rolos_inalterados', ((SELECT count(*) FROM public.tecelagem_rolos) = v_antes_rolos)::text),
    ('c6_lanc_inalterados',  ((SELECT count(*) FROM public.tecelagem_producao_lancamentos) = v_antes_lanc)::text),
    ('c6_seq_sem_vazamento', ((SELECT COALESCE(sum(proximo), 0) FROM public.tecelagem_rolo_sequencia) = v_antes_seq)::text);
END
$negativos$;

-- =====================================================================
-- SCENARIO 7 — direct DML is impossible for the runtime role. The writer
-- is the ONLY write path, so its authorization cannot be side-stepped.
-- =====================================================================
DO $dml$
DECLARE v_bloqueios INTEGER := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);

  BEGIN
    EXECUTE 'SET ROLE authenticated';
    EXECUTE 'INSERT INTO public.tecelagem_rolos (lancamento_id, op_item_id, fornecedor_id, numero) VALUES (1, 930000511, 930000401, 9999)';
    RAISE EXCEPTION 'DML_FALHOU: insert direto em tecelagem_rolos foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN
    v_bloqueios := v_bloqueios + 1;
  END;
  EXECUTE 'RESET ROLE';

  BEGIN
    EXECUTE 'SET ROLE authenticated';
    EXECUTE 'UPDATE public.tecelagem_rolos SET comprimento_m = 99 WHERE true';
    RAISE EXCEPTION 'DML_FALHOU: update direto em tecelagem_rolos foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN
    v_bloqueios := v_bloqueios + 1;
  END;
  EXECUTE 'RESET ROLE';

  BEGIN
    EXECUTE 'SET ROLE authenticated';
    EXECUTE 'DELETE FROM public.tecelagem_rolos WHERE true';
    RAISE EXCEPTION 'DML_FALHOU: delete direto em tecelagem_rolos foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN
    v_bloqueios := v_bloqueios + 1;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO proof.resultado VALUES ('c7_dml_bloqueado', v_bloqueios::text);
END
$dml$;

-- =====================================================================
-- SCENARIO 8 — THE LOCAL START HAS THE SAME AUTHORIZATION MODEL AS THE
-- REGISTRATION, AND AN INELIGIBLE OP DOES NOT GAIN IT.
-- =====================================================================
DO $inicio_neg$
DECLARE
  v_antes    INTEGER;
  v_recusas  INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_antes FROM public.tecelagem_op_execucao;

  -- 8.1 Um fornecedor que não teceu esta OP.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be02', false);
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.iniciar_producao_tecelagem(930000502);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: outro fornecedor iniciou producao alheia';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 8.2 O admin não é fornecedor: esta superfície não é dele.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', false);
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.iniciar_producao_tecelagem(930000502);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: admin iniciou producao de tecelagem';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);

  -- 8.3 UMA OP INELEGÍVEL NÃO GANHA A AÇÃO. Atribuída a este fornecedor, mas
  --     sem pedido: a elegibilidade é derivada do ciclo de vida que já existe.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.iniciar_producao_tecelagem(930000503);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: OP bloqueada foi iniciada';
  EXCEPTION WHEN sqlstate '55000' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 8.4 OP ausente.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.iniciar_producao_tecelagem(NULL);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: inicio sem OP aceito';
  EXCEPTION WHEN sqlstate '22023' THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  -- 8.5 OP inexistente: recusada pelo escopo do fornecedor, antes de qualquer
  --     avaliação de elegibilidade.
  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.iniciar_producao_tecelagem(999999999);
    RAISE EXCEPTION 'NEGATIVO_FALHOU: OP inexistente aceita';
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusas := v_recusas + 1;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO proof.resultado VALUES
    ('c8_recusas', v_recusas::text),
    ('c8_nada_iniciado', ((SELECT count(*) FROM public.tecelagem_op_execucao) = v_antes)::text);
END
$inicio_neg$;

-- 8.6 IDEMPOTÊNCIA: um segundo início não é erro e não move o momento gravado.
DO $idem$
DECLARE
  v_antes TIMESTAMPTZ;
  v_ja    BOOLEAN;
BEGIN
  SELECT iniciada_em INTO v_antes FROM public.tecelagem_op_execucao WHERE op_id = 930000501;

  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000be01', false);
  EXECUTE 'SET ROLE authenticated';
  SELECT (public.iniciar_producao_tecelagem(930000501) ->> 'ja_iniciada')::boolean INTO v_ja;
  EXECUTE 'RESET ROLE';

  INSERT INTO proof.resultado VALUES
    ('c8_reinicio_declarado', v_ja::text),
    ('c8_momento_preservado',
     ((SELECT iniciada_em FROM public.tecelagem_op_execucao WHERE op_id = 930000501) = v_antes)::text),
    ('c8_uma_linha_por_op',
     (SELECT count(*)::text FROM public.tecelagem_op_execucao WHERE op_id = 930000501));
END
$idem$;

-- =====================================================================
-- SCENARIO 9 — O FLUXO OBSERVÁVEL COMPLETO, NUMA OP QUE O ADMIN NUNCA
-- COLOCOU EM PRODUÇÃO.
--
--   MINHAS OPs -> INICIAR PRODUÇÃO -> REGISTRAR 10 ROLOS -> VER 10 ROLOS
--
-- A OP 930000502 está 'aberta' no ciclo de vida do Admin, e continua 'aberta'
-- depois de tudo. É esta a prova de que o início é LOCAL: a tecelagem produz
-- sem que o estado administrativo se mova um milímetro.
-- =====================================================================
INSERT INTO proof.resultado VALUES
  ('c9_status_admin_antes', (SELECT status FROM public.ops WHERE id = 930000502));

SET request.jwt.claim.sub = :'tec_user';
SET ROLE authenticated;

-- MINHAS OPs: a OP aparece pronta para iniciar, e sem início registrado.
INSERT INTO proof.resultado
SELECT 'c9_antes_situacao', situacao_execucao || '/' ||
       COALESCE(producao_iniciada_em::text, '<nulo>')
  FROM public.tecelagem_minhas_ops() WHERE op_id = 930000502;

-- INICIAR PRODUÇÃO.
SELECT public.iniciar_producao_tecelagem(:op_pronta);

-- Depois do início, o mesmo read model já declara a produção iniciada.
INSERT INTO proof.resultado
SELECT 'c9_depois_situacao', situacao_execucao || '/' ||
       (producao_iniciada_em IS NOT NULL)::text
  FROM public.tecelagem_minhas_ops() WHERE op_id = 930000502;

-- REGISTRAR 10 ROLOS.
INSERT INTO proof.resultado
SELECT 'c9_registro_quantidade',
       (public.registrar_producao_tecelagem(:item_c, 10) ->> 'quantidade_rolos');

RESET ROLE;

-- VER 10 ROLOS — e o ciclo de vida do Admin intacto.
INSERT INTO proof.resultado VALUES
  ('c9_rolos_persistidos', (SELECT count(*)::text FROM public.tecelagem_rolos WHERE op_item_id = 930000513)),
  ('c9_rolos_distintos',   (SELECT count(DISTINCT id)::text FROM public.tecelagem_rolos WHERE op_item_id = 930000513)),
  ('c9_numeracao',         (SELECT string_agg(numero::text, ',' ORDER BY numero) FROM public.tecelagem_rolos WHERE op_item_id = 930000513)),
  ('c9_status_admin_depois', (SELECT status FROM public.ops WHERE id = 930000502));

RESET ROLE;
RESET request.jwt.claim.sub;

-- =====================================================================
-- VERDICT
-- =====================================================================
DO $verdict$
DECLARE
  v_bad      TEXT[] := ARRAY[]::TEXT[];
  v_esperado CONSTANT TEXT[][] := ARRAY[
    -- SCENARIO 0: the local production start is the gate on registration
    ['c0_registro_sem_inicio_recusado', 'true'],
    ['c0_nada_gravado',                 'true'],
    ['c0_admin_em_producao_nao_basta',  'true'],
    ['c0_inicio_ja_iniciada',           'false'],
    ['c0_execucao_persistida',          '1'],
    ['c0_execucao_do_fornecedor_certo', '930000401'],
    -- SCENARIO 1: the reference acceptance scenario
    ['c1_retorno_quantidade', '10'],
    ['c1_rolos_persistidos',  '10'],
    ['c1_rolos_distintos',    '10'],
    ['c1_numeros_distintos',  '10'],
    ['c1_numeracao',          '1,2,3,4,5,6,7,8,9,10'],
    ['c1_sem_comprimento',    '10'],
    ['c1_situacao_unica',     'na_tecelagem'],
    ['c1_lancamentos',        '1'],
    -- SCENARIO 2: numbering continues on the same product
    ['c2_total_rolos',        '15'],
    ['c2_numero_maximo',      '15'],
    ['c2_sem_colisao',        'true'],
    -- SCENARIO 3: a different product CONTINUES the OP sequence
    ['c3_rolos_produto_b',    '2'],
    ['c3_numeracao_b',        '16,17'],
    ['c3_produto_a_intacto',  '15'],
    -- SCENARIO 4: optional length, including a partially measured batch
    ['c4_total_b',            '5'],
    ['c4_com_comprimento',    '2'],
    ['c4_sem_comprimento',    '3'],
    ['c4_valor_medido',       '28.40'],
    -- SCENARIO 4b: the visible number never collides inside one OP
    ['c4b_rolos_na_op',       '20'],
    ['c4b_numeros_distintos', '20'],
    ['c4b_faixa',             '1-20'],
    ['c4b_produtos_na_op',    '2'],
    ['c4b_colisao_bloqueada', 'true'],
    -- SCENARIO 4c: customer and execution eligibility reach the supplier
    ['c4c_ops_visiveis',      '3'],
    ['c4c_cliente',           'Felipe Grandi'],
    ['c4c_situacoes',         '930000501=em_producao,930000502=pode_iniciar,930000503=bloqueada'],
    ['c4c_motivo_bloqueio',   'OP_TECELAGEM_SEM_PEDIDO'],
    ['c4c_ops_de_outro',      '0'],
    ['c4c_sem_leitura_direta_clientes', 'true'],
    -- SCENARIO 5: RLS scoping
    ['c5_visivel_ao_dono',    '20'],
    ['c5_visivel_a_outro',    '0'],
    ['c5_visivel_ao_admin',   '20'],
    -- SCENARIO 6: every negative refuses and leaves nothing behind
    ['c6_recusas',            '7'],
    ['c6_rolos_inalterados',  'true'],
    ['c6_lanc_inalterados',   'true'],
    ['c6_seq_sem_vazamento',  'true'],
    -- SCENARIO 7: the writer is the only write path
    ['c7_dml_bloqueado',      '3'],
    -- SCENARIO 8: the local start has the same authorization model, an
    -- ineligible OP does not gain it, and a second start is not an error
    ['c8_recusas',            '5'],
    ['c8_nada_iniciado',      'true'],
    ['c8_reinicio_declarado', 'true'],
    ['c8_momento_preservado', 'true'],
    ['c8_uma_linha_por_op',   '1'],
    -- SCENARIO 9: the complete observable flow, with the Admin lifecycle
    -- provably untouched from beginning to end
    ['c9_status_admin_antes',  'aberta'],
    ['c9_antes_situacao',      'pode_iniciar/<nulo>'],
    ['c9_depois_situacao',     'em_producao/true'],
    ['c9_registro_quantidade', '10'],
    ['c9_rolos_persistidos',   '10'],
    ['c9_rolos_distintos',     '10'],
    ['c9_numeracao',           '1,2,3,4,5,6,7,8,9,10'],
    ['c9_status_admin_depois', 'aberta']
  ];
  v_obtido TEXT;
  i        INTEGER;
BEGIN
  FOR i IN 1 .. array_length(v_esperado, 1) LOOP
    SELECT valor INTO v_obtido FROM proof.resultado WHERE caso = v_esperado[i][1];
    IF v_obtido IS DISTINCT FROM v_esperado[i][2] THEN
      v_bad := v_bad || format('%s: esperado %L, obtido %L',
                               v_esperado[i][1], v_esperado[i][2], COALESCE(v_obtido, '<ausente>'));
    END IF;
  END LOOP;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'DB123_ACCEPTANCE_FAIL: %', array_to_string(v_bad, ' | ');
  END IF;

  RAISE NOTICE 'DB123_ACCEPTANCE_PASS — o inicio local abre o registro e nada abre sem ele; 10 rolos registrados sao 10 rolos individuais; comprimento e opcional; a escrita tem um unico dono; o escopo por fornecedor e respeitado; o ciclo de vida do Admin nao se moveu';
END
$verdict$;
