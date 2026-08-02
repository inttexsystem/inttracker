-- =====================================================================
-- db/115_pedido_alteracao_expected_refusal_semantics.sql
-- PEDIDO-ALTERACAO-EXPECTED-REFUSAL-SEMANTICS-CORRECTION-R1 — correcao
-- FORWARD-ONLY de SEMANTICA sobre db/92: move a DETECCAO EFETIVA de duas
-- recusas ESPERADAS para o prologo de validacao de
-- public.aprovar_alteracao_pedido(uuid,boolean,text), ANTES da subtransacao
-- de aplicacao.
--
-- Order: PEDIDO-ALTERACAO-EXPECTED-REFUSAL-SEMANTICS-CORRECTION-R1.
-- Contract shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md, U8.2, U8.3
--   e a subsecao "### U18. Expected-refusal semantics correction (db/115)".
-- Forward-only; db/01..db/114 sao INTOCADOS. db/92 e db/91 NAO sao reescritos.
--
-- A DIVIDA QUE ESTA MIGRACAO FECHA
--   docs/governance/current-state.json ::
--     PEDIDO-ALTERACAO-PRIORITY-AND-ITEM-REFUSALS-CLASSIFIED-AS-APPLICATION-FAILURE
--
--   U8.3 e explicito: uma recusa ESPERADA de validacao devolve identificador
--   estavel, deixa a solicitacao `pendente` e NAO muda nenhuma linha viva;
--   somente uma falha INESPERADA da etapa de APLICACAO vira
--   `falha_aplicacao`. Duas recusas esperadas violavam essa distincao porque
--   so eram levantadas DENTRO do bloco BEGIN ... EXCEPTION WHEN OTHERS:
--
--     1. PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED — levantada
--        por public.definir_prioridade_pedido (db/91, secao 7.6) atraves de
--        public.pedido_prioridade_aplicar (db/92);
--     2. PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP — levantada defensivamente por
--        public.pedido_itens_reconciliar (db/92).
--
--   Consequencia medida: EXCEPTION WHEN OTHERS as capturava e a solicitacao
--   era carimbada `falha_aplicacao`. Nenhuma perda de dado ocorria — a
--   subtransacao desfazia tudo e a imagem-anterior sobrevivia —, mas a
--   solicitacao ficava DECIDIDA. Isso tornava INALCANCAVEL a retentativa com
--   confirmacao explicita desenhada em U10.4 (mesmo p_solicitacao_id com
--   p_confirmar_impacto = true): a segunda chamada batia em
--   PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA.
--
-- O QUE ESTA MIGRACAO FAZ, EXATAMENTE
--   Redefine UMA funcao — public.aprovar_alteracao_pedido(uuid,boolean,text) —
--   acrescentando ao prologo de validacao a PRE-DETECCAO das duas mesmas
--   condicoes, com os MESMOS identificadores e o MESMO SQLSTATE, na MESMA
--   precedencia relativa em que a etapa de aplicacao ja as encontrava.
--
--   Nada mais muda: nenhuma tabela, coluna, indice, politica, RLS, gatilho,
--   sequencia, grant de tabela, API publica nova, nem UMA UNICA linha de
--   negocio. As demais 22 funcoes de db/92 e a autoridade de db/91 ficam
--   byte-identicas.
--
-- O QUE NAO MUDA, DELIBERADAMENTE
--   * O bloco BEGIN ... EXCEPTION WHEN OTHERS CONTINUA existindo e continua
--     dono das falhas INESPERADAS de aplicacao. Ele nao e removido, nem
--     enfraquecido, nem transformado em recusa `pendente`.
--   * As checagens defensivas dos escritores donos PERMANECEM onde estao:
--     pedido_itens_reconciliar continua recusando a remocao orfanadora e
--     definir_prioridade_pedido continua exigindo a confirmacao de impacto.
--     A pre-deteccao e uma SEGUNDA leitura da MESMA condicao, nunca a
--     substituicao da primeira. Um caminho que nao passe por
--     aprovar_alteracao_pedido continua integralmente protegido.
--   * A regra de negocio da prioridade continua com UM dono: db/91. Esta
--     migracao NAO cria uma segunda regra e NAO chama um escritor mutante
--     apenas para descobrir se ele recusaria; ela le o MESMO estado
--     (pedidos.status, ja travado FOR UPDATE) e o MESMO parametro de
--     confirmacao que db/91 avalia.
--   * A recusa de item NAO e alargada. O conjunto avaliado e exatamente o
--     conjunto de REMOCAO que pedido_itens_reconciliar calcularia (linhas
--     vivas ausentes da colecao ABSOLUTA proposta), medido pelo predicado
--     canonico read-only public.pedido_item_tem_vinculo_producao. Uma
--     proposta estrutural que nao remove nada NAO passa a ser recusada.
--   * PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP conserva identificador,
--     posicao e precedencia proprios: continua sendo avaliada ANTES da
--     recusa de vinculo de item, exatamente como hoje.
--
-- PRECEDENCIA DE VALIDACAO PRESERVADA (de cima para baixo)
--   1. autorizacao (is_admin)                PEDIDO_ALTERACAO_FORBIDDEN
--   2. existencia da solicitacao             ..._SOLICITACAO_NOT_FOUND
--   3. solicitacao ja decidida               ..._SOLICITACAO_JA_DECIDIDA
--   4. existencia do Pedido                  ..._PEDIDO_NOT_FOUND
--   5. ciclo de vida terminal                ..._PEDIDO_TERMINAL
--   6. revisao/base desatualizada            ..._REVISAO_DESATUALIZADA
--   7. campo de cabecalho nao permitido      ..._CAMPO_NAO_PERMITIDO
--   8. colecao de itens invalida             ..._ITEM_SET_INVALIDO
--   9. estrutural apos OP                    ..._ESTRUTURA_BLOQUEADA_APOS_OP
--  10. item vinculado a producao       [NOVO AQUI] ..._ITEM_VINCULADO_A_OP
--  11. impacto de prioridade           [NOVO AQUI] PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED
--  12. ETAPA DE APLICACAO (subtransacao; so falha INESPERADA)
--
--   10 antes de 11 nao e arbitrario: e a ordem em que a propria etapa de
--   aplicacao ja as encontrava (pedido_itens_reconciliar roda antes de
--   pedido_prioridade_aplicar), e e a ordem que js/screens/
--   pedido-alteracao-review.js ja consome em tratarRecusaDeAprovacao.
--
-- TRAVAS E CONCORRENCIA
--   As duas pre-deteccoes rodam DEPOIS das travas autoritativas que o prologo
--   ja tomava e ANTES de qualquer escrita:
--     public.pedido_alteracao_solicitacoes  ... FOR UPDATE
--     public.pedidos                        ... FOR UPDATE
--     public.pedido_itens ORDER BY id       ... FOR UPDATE
--   A ordem global de travas de db/88/db/91 (pedidos -> pedido_itens) e
--   preservada e NENHUMA aresta nova entra nela. Validacao e aplicacao
--   continuam na MESMA transacao, sob as MESMAS travas: nao ha janela TOCTOU
--   nova, e a superficie que resta (op_itens / expedicao_itens /
--   pedido_parcial_itens nao travadas) e exatamente a que
--   pedido_itens_reconciliar ja tinha — por isso a checagem defensiva dele
--   permanece como rede final.
--
-- ACOPLAMENTO DECLARADO E VERIFICADO
--   A pre-deteccao de prioridade espelha o predicado de db/91 secao 7.6
--   (pedidos.status = 'produzindo' E confirmacao ausente). Esse acoplamento e
--   verificado em tempo de aplicacao pelo gate abaixo: se db/91 deixar de
--   expor esse predicado exato, esta migracao FALHA FECHADA em vez de
--   silenciosamente divergir do dono da regra.
--
-- Idempotente: CREATE OR REPLACE converge, o gate aceita tanto o estado PRE
-- (divida medida) quanto o estado POS (ja corrigido), e o replay termina no
-- mesmo corpo. Nao cria, altera nem remove linha de negocio.
-- Depende de db/91 (definir_prioridade_pedido) e de db/92 (a funcao alvo, os
-- helpers e as tabelas de solicitacao).
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE. Recusa operar sobre uma topologia diferente da medida.
-- ============================================================
DO $gate$
DECLARE
  v_missing  TEXT[] := ARRAY[]::TEXT[];
  v_fn       TEXT;
  v_oid      OID;
  v_aprov    OID;
  v_src      TEXT;
  v_src91    TEXT;
  v_src_rec  TEXT;
  v_src_apl  TEXT;
  v_pos_pred INTEGER;
  v_pos_id   INTEGER;
  v_guard    INTEGER;
  v_pri      INTEGER;
  v_item     INTEGER;
  v_pre      BOOLEAN;
  v_pos      BOOLEAN;
BEGIN
  -- 0.1 As duas tabelas de solicitacao de db/92 existem.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.pedido_alteracao_solicitacoes',
    'public.pedido_alteracao_solicitacao_itens',
    'public.pedidos',
    'public.pedido_itens'
  ] LOOP
    IF to_regclass(v_fn) IS NULL THEN
      v_missing := array_append(v_missing, format('table %s', v_fn));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/115 gate: pre-requisito(s) ausente(s): %', array_to_string(v_missing, '; ');
  END IF;

  -- 0.2 Colunas lidas pela pre-deteccao. Um rename silencioso invalidaria a
  --     correcao inteira, entao ele para a migracao.
  FOREACH v_fn IN ARRAY ARRAY['status','itens_propostos','proposto_prioridade_habilitada'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute
                    WHERE attrelid = to_regclass('public.pedido_alteracao_solicitacoes')
                      AND attname = v_fn AND attnum > 0 AND NOT attisdropped) THEN
      v_missing := array_append(v_missing,
        format('column public.pedido_alteracao_solicitacoes.%s', v_fn));
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = to_regclass('public.pedidos')
                    AND attname = 'status' AND attnum > 0 AND NOT attisdropped) THEN
    v_missing := array_append(v_missing, 'column public.pedidos.status');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/115 gate: coluna(s) lida(s) pela pre-deteccao ausente(s): %',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.3 Os donos executaveis envolvidos existem. `pedido_header_validar` e
  --     deliberadamente IMMUTABLE e NAO SECURITY DEFINER em db/92, entao
  --     apenas a existencia dele e exigida aqui.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.pedido_itens_reconciliar(uuid,jsonb)',
    'public.pedido_item_tem_vinculo_producao(uuid)',
    'public.pedido_prioridade_aplicar(uuid,boolean,boolean)',
    'public.pedido_tem_op_relacionada(uuid)',
    'public.pedido_itens_payload_normalizar(uuid,jsonb)',
    'public.pedido_itens_payload_e_estrutural(uuid,jsonb)',
    'public.pedido_header_validar(jsonb,text)',
    'public.pedido_header_aplicar(uuid,jsonb)',
    'public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      v_missing := array_append(v_missing, format('function %s', v_fn));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/115 gate: dono executavel ausente: %',
      array_to_string(v_missing, '; ');
  END IF;

  -- 0.3b Os donos SECURITY DEFINER de `postgres` continuam sendo exatamente
  --      isso. E a premissa que sustenta a pre-deteccao ler estado interno.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.pedido_itens_reconciliar(uuid,jsonb)',
    'public.pedido_item_tem_vinculo_producao(uuid)',
    'public.pedido_prioridade_aplicar(uuid,boolean,boolean)',
    'public.pedido_tem_op_relacionada(uuid)',
    'public.pedido_itens_payload_normalizar(uuid,jsonb)',
    'public.pedido_itens_payload_e_estrutural(uuid,jsonb)',
    'public.pedido_header_aplicar(uuid,jsonb)',
    'public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)'
  ] LOOP
    v_oid := to_regprocedure(v_fn);
    IF NOT EXISTS (SELECT 1 FROM pg_proc
                    WHERE oid = v_oid AND prosecdef AND proowner = 'postgres'::regrole) THEN
      v_missing := array_append(v_missing,
        format('function %s deixou de ser SECURITY DEFINER de postgres', v_fn));
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/115 gate: dono executavel divergente: %',
      array_to_string(v_missing, '; ');
  END IF;

  v_aprov := to_regprocedure('public.aprovar_alteracao_pedido(uuid,boolean,text)');
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_aprov;

  -- 0.4 O search_path declarado da funcao alvo continua sendo o aceito. Esta
  --     migracao o redeclara identico; se hoje for outro, o cenario mudou.
  IF NOT EXISTS (SELECT 1 FROM pg_proc
                  WHERE oid = v_aprov
                    AND proconfig @> ARRAY['search_path=public, auth']) THEN
    RAISE EXCEPTION 'db/115 gate: search_path de aprovar_alteracao_pedido divergente do aceito (public, auth)';
  END IF;

  -- 0.5 ACOPLAMENTO COM db/91 (LOAD-BEARING). O predicado de impacto de
  --     producao continua sendo exatamente `status = 'produzindo'` sem
  --     confirmacao, e continua levantando o identificador estavel logo em
  --     seguida. Se db/91 mudou a regra, a pre-deteccao desta migracao
  --     divergiria do dono: FALHA FECHADA.
  SELECT prosrc INTO v_src91 FROM pg_proc
   WHERE oid = to_regprocedure('public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)');
  v_pos_pred := position('p_confirmar_impacto_producao, FALSE) IS NOT TRUE' in v_src91);
  IF v_pos_pred = 0
     OR v_src91 !~ 'v_pedido\.status\s*=\s*''produzindo''\s*AND\s*COALESCE\(\s*p_confirmar_impacto_producao\s*,\s*FALSE\s*\)\s*IS NOT TRUE' THEN
    RAISE EXCEPTION 'db/115 gate: db/91 nao expoe mais o predicado de impacto de producao esperado (status = produzindo E confirmacao ausente)';
  END IF;
  v_pos_id := position('PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED' in v_src91);
  IF v_pos_id = 0 OR v_pos_id <= v_pos_pred OR v_pos_id - v_pos_pred > 200 THEN
    RAISE EXCEPTION 'db/115 gate: db/91 nao levanta PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED imediatamente apos o predicado de impacto';
  END IF;

  -- 0.6 O escritor defensivo de item continua com a checagem ANTES do DELETE.
  --     Esta migracao adiciona uma pre-deteccao; ela NAO substitui esta rede.
  SELECT prosrc INTO v_src_rec FROM pg_proc
   WHERE oid = to_regprocedure('public.pedido_itens_reconciliar(uuid,jsonb)');
  v_guard := position('pedido_item_tem_vinculo_producao' in v_src_rec);
  v_item  := position('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP' in v_src_rec);
  IF v_guard = 0 OR v_item = 0
     OR v_guard > position('DELETE FROM public.pedido_itens' in v_src_rec)
     OR position('DELETE FROM public.pedido_itens' in v_src_rec) = 0 THEN
    RAISE EXCEPTION 'db/115 gate: pedido_itens_reconciliar nao expoe mais a recusa defensiva de orfandade antes do DELETE';
  END IF;

  -- 0.7 pedido_prioridade_aplicar continua delegando a db/91 e continua
  --     tratando NULL como "nao tocar". A pre-deteccao espelha esse
  --     curto-circuito.
  SELECT prosrc INTO v_src_apl FROM pg_proc
   WHERE oid = to_regprocedure('public.pedido_prioridade_aplicar(uuid,boolean,boolean)');
  IF position('definir_prioridade_pedido' in v_src_apl) = 0
     OR v_src_apl !~ 'p_habilitada IS NULL\s*THEN RETURN' THEN
    RAISE EXCEPTION 'db/115 gate: pedido_prioridade_aplicar nao delega mais a db/91 com curto-circuito em NULL';
  END IF;

  -- 0.8 A FORMA exata que esta sendo corrigida. Exatamente dois estados sao
  --     aceitos; qualquer outro e drift e para a migracao.
  IF position('EXCEPTION WHEN OTHERS THEN' in v_src) = 0 THEN
    RAISE EXCEPTION 'db/115 gate: aprovar_alteracao_pedido perdeu a subtransacao de aplicacao; o cenario medido mudou';
  END IF;
  v_guard := position('EXCEPTION WHEN OTHERS THEN' in v_src);
  v_pri   := position('PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED' in v_src);
  v_item  := position('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP' in v_src);

  -- PRE: a divida medida — nenhuma das duas recusas existe no prologo.
  v_pre := (v_pri = 0 AND v_item = 0);
  -- POS: ja corrigido — as duas existem e AMBAS antes da subtransacao.
  v_pos := (v_pri > 0 AND v_pri < v_guard AND v_item > 0 AND v_item < v_guard);

  IF NOT (v_pre OR v_pos) THEN
    RAISE EXCEPTION 'db/115 gate: forma inesperada de aprovar_alteracao_pedido (prioridade@%, item@%, subtransacao@%). Esperado o estado PRE de db/92 ou o estado POS de db/115.',
      v_pri, v_item, v_guard;
  END IF;

  RAISE NOTICE 'db/115 gate: OK (estado de entrada = %)', CASE WHEN v_pre THEN 'PRE' ELSE 'POS' END;
END;
$gate$;

-- ============================================================
-- 1. CORRECAO. Uma unica funcao e redefinida.
-- ============================================================
-- CONTRATO DE FALHA (emenda vinculante secao 4.4 / U8.3):
--   * recusa ESPERADA de validacao -> identificador estavel, solicitacao
--     CONTINUA `pendente`, nenhuma linha viva muda;
--   * falha INESPERADA durante a APLICACAO -> a subtransacao PL/pgSQL desfaz
--     todo o trabalho de aplicacao, e a transacao externa marca a solicitacao
--     como `falha_aplicacao` com `falha_identificador`.
--   Toda a validacao acontece ANTES do bloco com EXCEPTION, exatamente para
--   que uma recusa esperada nunca seja confundida com uma falha de aplicacao.
--   db/115 tornou essa frase VERDADEIRA tambem para as duas recusas que ate
--   entao so apareciam dentro da subtransacao.
CREATE OR REPLACE FUNCTION public.aprovar_alteracao_pedido(
  p_solicitacao_id    UUID,
  p_confirmar_impacto BOOLEAN DEFAULT FALSE,
  p_motivo            TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_sol     public.pedido_alteracao_solicitacoes%ROWTYPE;
  v_pedido  public.pedidos%ROWTYPE;
  v_header  JSONB := '{}'::jsonb;
  v_itens   JSONB;
  v_campo   TEXT;
  v_falha   TEXT;
  v_row     JSONB;
  v_item_id UUID;
  v_manter  UUID[] := ARRAY[]::UUID[];
  v_remover UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' USING ERRCODE = '42501';
  END IF;

  -- ---------- VALIDACAO (fora da subtransacao) ----------
  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND: solicitacao % inexistente', p_solicitacao_id USING ERRCODE = 'P0002';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em %', v_sol.status USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = v_sol.pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', v_sol.pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita aplicacao', v_pedido.status USING ERRCODE = '23514';
  END IF;

  -- Concorrencia: sem merge silencioso. Falha fechada, solicitacao continua
  -- pendente, e o cliente reabre o editor contra o estado aceito mais recente.
  IF v_pedido.revisao IS DISTINCT FROM v_sol.base_revisao THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a criacao da solicitacao (base %, atual %)', v_sol.base_revisao, v_pedido.revisao
      USING ERRCODE = '40001';
  END IF;

  PERFORM 1 FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE;

  -- Recompoe o cabecalho proposto SOMENTE com os campos declarados.
  FOREACH v_campo IN ARRAY v_sol.campos_alterados LOOP
    v_header := v_header || CASE v_campo
      WHEN 'prazo_entrega'      THEN jsonb_build_object('prazo_entrega', v_sol.proposto_prazo_entrega)
      WHEN 'referencia_cliente' THEN jsonb_build_object('referencia_cliente', v_sol.proposto_referencia_cliente)
      WHEN 'tipo_recebimento'   THEN jsonb_build_object('tipo_recebimento', v_sol.proposto_tipo_recebimento)
      WHEN 'observacao'         THEN jsonb_build_object('observacao', v_sol.proposto_observacao)
      ELSE '{}'::jsonb END;
  END LOOP;
  PERFORM public.pedido_header_validar(v_header, 'cliente');

  IF v_sol.itens_propostos THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'pedido_item_id', i.pedido_item_id,
             'modelo_id', i.modelo_id,
             'metros', i.metros,
             'largura', i.largura,
             'observacao', i.observacao,
             'ordem', i.ordem) ORDER BY i.ordem), '[]'::jsonb)
      INTO v_itens
      FROM public.pedido_alteracao_solicitacao_itens i
     WHERE i.solicitacao_id = p_solicitacao_id;

    v_itens := public.pedido_itens_payload_normalizar(v_sol.pedido_id, v_itens);

    IF public.pedido_itens_payload_e_estrutural(v_sol.pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(v_sol.pedido_id) THEN
      -- A aprovacao NAO e um override. Uma proposta estrutural sobre um Pedido
      -- que ja tem producao vinculada deve ser REJEITADA pelo revisor.
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; a proposta estrutural nao pode ser aplicada e deve ser rejeitada com justificativa'
        USING ERRCODE = '23514';
    END IF;

    -- db/115 — PRE-DETECCAO 1: item vinculado a producao, expedicao ou
    -- entrega parcial. Recusa ESPERADA, avaliada AQUI para que nunca mais
    -- chegue ao EXCEPTION WHEN OTHERS e vire `falha_aplicacao`.
    --
    -- O conjunto avaliado e EXATAMENTE o conjunto de remocao que
    -- public.pedido_itens_reconciliar calcularia: as linhas vivas deste
    -- Pedido ausentes da colecao ABSOLUTA proposta. O predicado e o dono
    -- canonico read-only public.pedido_item_tem_vinculo_producao. Nada e
    -- alargado: uma proposta que nao remove nada nao e recusada aqui, e
    -- PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP acima conserva a sua
    -- propria identidade e a sua propria precedencia.
    --
    -- A checagem defensiva dentro de pedido_itens_reconciliar PERMANECE: ela
    -- e a rede final para qualquer chamador que nao passe por aqui, e cobre
    -- a janela em que op_itens / expedicao_itens / pedido_parcial_itens nao
    -- estao travadas.
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
      v_item_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
      IF v_item_id IS NOT NULL THEN v_manter := v_manter || v_item_id; END IF;
    END LOOP;

    FOR v_remover IN
      SELECT pi.id FROM public.pedido_itens pi
       WHERE pi.pedido_id = v_sol.pedido_id
         AND NOT (pi.id = ANY (v_manter))
    LOOP
      IF public.pedido_item_tem_vinculo_producao(v_remover) THEN
        RAISE EXCEPTION
          'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item % ja esta vinculado a producao, expedicao ou entrega parcial e nao pode ser removido; a reconciliacao de producao e um fluxo proprio', v_remover
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;

  -- db/115 — PRE-DETECCAO 2: a prioridade exige confirmacao de impacto.
  -- Recusa ESPERADA, avaliada AQUI para que a solicitacao continue
  -- `pendente` e a retentativa de U10.4 (mesmo p_solicitacao_id com
  -- p_confirmar_impacto = true) seja alcancavel.
  --
  -- O DONO DA REGRA CONTINUA SENDO db/91, secao 7.6. Isto NAO e uma segunda
  -- regra de negocio e NAO chama o escritor mutante para descobrir se ele
  -- recusaria: le o MESMO pedidos.status (ja travado FOR UPDATE acima) e o
  -- MESMO parametro de confirmacao que definir_prioridade_pedido avalia.
  -- A condicao `proposto_prioridade_habilitada IS NOT NULL` espelha o
  -- curto-circuito de public.pedido_prioridade_aplicar, que so delega a db/91
  -- quando ha instrucao de prioridade a aplicar.
  --
  -- definir_prioridade_pedido CONTINUA levantando a mesma recusa: nenhuma
  -- checagem defensiva do dono e enfraquecida por esta pre-deteccao.
  IF v_sol.proposto_prioridade_habilitada IS NOT NULL
     AND v_pedido.status = 'produzindo'
     AND COALESCE(p_confirmar_impacto, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED: a producao deste Pedido ja foi iniciada; confirme o impacto antes de alterar a prioridade'
      USING ERRCODE = '23514';
  END IF;

  -- ---------- APLICACAO (dentro da subtransacao) ----------
  BEGIN
    IF v_itens IS NOT NULL THEN
      PERFORM public.pedido_itens_reconciliar(v_sol.pedido_id, v_itens);
    END IF;

    PERFORM public.pedido_header_aplicar(v_sol.pedido_id, v_header);

    -- Prioridade pelo dono canonico, sob a identidade ADMINISTRATIVA de quem
    -- aprova: o resultado correto e `confirmada`.
    PERFORM public.pedido_prioridade_aplicar(
      v_sol.pedido_id, v_sol.proposto_prioridade_habilitada, p_confirmar_impacto);

    INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
    VALUES (v_sol.pedido_id, v_pedido.status, v_pedido.status, auth.uid(),
            'db/92 aprovar_alteracao_pedido: solicitacao ' || p_solicitacao_id ||
            '; campos=' || COALESCE(array_to_string(v_sol.campos_alterados, ','), ''));

    INSERT INTO public.pedido_cliente_eventos (pedido_id, status, titulo, mensagem, origem, visivel_cliente, criado_por)
    VALUES (v_sol.pedido_id, COALESCE(v_pedido.status_cliente_visual, 'confirmado'),
            'Solicitacao de alteracao aprovada',
            COALESCE(NULLIF(btrim(COALESCE(p_motivo,'')),''), 'Sua solicitacao de alteracao foi aprovada pela equipe.'),
            'sistema', TRUE, auth.uid());

    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'aprovada', decidido_em = now(), decidido_por = auth.uid(),
           decisao_motivo = NULLIF(btrim(COALESCE(p_motivo,'')),'')
     WHERE id = p_solicitacao_id;

  EXCEPTION WHEN OTHERS THEN
    -- Toda a aplicacao acima foi desfeita por esta subtransacao. O Pedido vivo
    -- esta EXATAMENTE como estava. Registramos a falha na transacao externa.
    -- Depois de db/115 este caminho e reservado a falha INESPERADA: as duas
    -- recusas esperadas que antes caiam aqui sao pre-detectadas no prologo.
    v_falha := SQLSTATE || ':' || left(COALESCE(SQLERRM, ''), 300);
    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'falha_aplicacao', decidido_em = now(), decidido_por = auth.uid(),
           falha_identificador = v_falha
     WHERE id = p_solicitacao_id;
    RETURN jsonb_build_object('ok', false,
      'erro', 'PEDIDO_ALTERACAO_FALHA_APLICACAO',
      'solicitacao_id', p_solicitacao_id,
      'status', 'falha_aplicacao',
      'falha_identificador', v_falha);
  END;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', p_solicitacao_id, 'status', 'aprovada',
    'pedido_id', v_sol.pedido_id,
    'revisao', (SELECT revisao FROM public.pedidos WHERE id = v_sol.pedido_id));
END;
$fn$;

COMMENT ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) IS
  'db/92, corrigida por db/115: aplicacao ATOMICA da revisao aprovada. TODA recusa esperada — inclusive PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP e PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED — e detectada no prologo de validacao, mantem a solicitacao pendente e nao toca o Pedido; somente uma falha INESPERADA e desfeita por subtransacao e vira falha_aplicacao. Nunca altera OP ou op_itens.';

-- Estado de privilegio REDECLARADO identico ao de db/93. CREATE OR REPLACE
-- preserva a ACL existente; esta redeclaracao existe para que o arquivo seja
-- auto-contido e idempotente, e NAO alarga nada.
REVOKE EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- ============================================================
-- 2. VERIFICACAO. A migracao prova o proprio resultado.
-- ============================================================
DO $verify$
DECLARE
  v_bad    TEXT[] := ARRAY[]::TEXT[];
  v_aprov  OID := to_regprocedure('public.aprovar_alteracao_pedido(uuid,boolean,text)');
  v_src    TEXT;
  v_guard  INTEGER;
  v_apl    INTEGER;
  v_pri    INTEGER;
  v_item   INTEGER;
  v_estr   INTEGER;
  v_fn     TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_aprov;

  -- 2.1 A subtransacao de aplicacao CONTINUA existindo e continua gravando
  --     falha_aplicacao com identificador. Ela nao foi removida.
  --     `v_apl` marca a ABERTURA da etapa de aplicacao; `v_guard` marca o
  --     manipulador. O que precede v_apl e prologo de validacao.
  v_guard := position('EXCEPTION WHEN OTHERS THEN' in v_src);
  v_apl   := position('---------- APLICACAO (dentro da subtransacao) ----------' in v_src);
  IF v_guard = 0 THEN
    v_bad := array_append(v_bad, 'a subtransacao de aplicacao desapareceu');
  END IF;
  IF v_apl = 0 OR (v_guard > 0 AND v_apl > v_guard) THEN
    v_bad := array_append(v_bad, 'a fronteira da etapa de aplicacao nao e identificavel');
  END IF;
  IF position('falha_aplicacao' in v_src) = 0
     OR position('falha_identificador = v_falha' in v_src) = 0
     OR position('PEDIDO_ALTERACAO_FALHA_APLICACAO' in v_src) = 0 THEN
    v_bad := array_append(v_bad, 'o contrato de falha INESPERADA deixou de estar completo');
  END IF;

  -- 2.2 As duas recusas corrigidas existem e estao ANTES da subtransacao.
  v_pri  := position('PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED' in v_src);
  v_item := position('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP' in v_src);
  IF v_pri = 0 OR (v_apl > 0 AND v_pri > v_apl) THEN
    v_bad := array_append(v_bad, 'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED nao e pre-detectada no prologo');
  END IF;
  IF v_item = 0 OR (v_apl > 0 AND v_item > v_apl) THEN
    v_bad := array_append(v_bad, 'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP nao e pre-detectada no prologo');
  END IF;

  -- 2.3 A precedencia aceita e preservada: estrutural-apos-OP antes da recusa
  --     de vinculo de item, e esta antes da recusa de prioridade.
  v_estr := position('PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP' in v_src);
  IF v_estr = 0 OR v_estr > v_item OR v_item > v_pri THEN
    v_bad := array_append(v_bad,
      format('precedencia de recusa divergente (estrutural@%s, item@%s, prioridade@%s)', v_estr, v_item, v_pri));
  END IF;

  -- 2.4 As demais recusas esperadas continuam antes da subtransacao.
  FOREACH v_fn IN ARRAY ARRAY[
    'PEDIDO_ALTERACAO_FORBIDDEN',
    'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND',
    'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA',
    'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND',
    'PEDIDO_ALTERACAO_PEDIDO_TERMINAL',
    'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA'
  ] LOOP
    IF position(v_fn in v_src) = 0 OR (v_apl > 0 AND position(v_fn in v_src) > v_apl) THEN
      v_bad := array_append(v_bad, format('%s deixou de ser recusa de prologo', v_fn));
    END IF;
  END LOOP;

  -- 2.5 A pre-deteccao usa o predicado canonico read-only, e NENHUM escritor
  --     mutante e invocado no prologo apenas para descobrir uma recusa. Os
  --     dois escritores continuam sendo chamados, mas SOMENTE na etapa de
  --     aplicacao (depois de v_apl).
  --     A medicao usa a sintaxe de CHAMADA (`PERFORM public.<fn>(`), nunca a
  --     simples mencao do nome, que tambem aparece em comentario.
  IF position('public.pedido_item_tem_vinculo_producao(v_remover)' in v_src) = 0
     OR (v_apl > 0 AND position('public.pedido_item_tem_vinculo_producao(v_remover)' in v_src) > v_apl) THEN
    v_bad := array_append(v_bad, 'a pre-deteccao de item nao usa o predicado canonico no prologo');
  END IF;
  IF position('PERFORM public.pedido_prioridade_aplicar(' in v_src) = 0
     OR (v_apl > 0 AND position('PERFORM public.pedido_prioridade_aplicar(' in v_src) < v_apl) THEN
    v_bad := array_append(v_bad, 'o escritor de prioridade nao esta exclusivamente na etapa de aplicacao');
  END IF;
  IF position('PERFORM public.pedido_itens_reconciliar(' in v_src) = 0
     OR (v_apl > 0 AND position('PERFORM public.pedido_itens_reconciliar(' in v_src) < v_apl) THEN
    v_bad := array_append(v_bad, 'o escritor de itens nao esta exclusivamente na etapa de aplicacao');
  END IF;

  -- 2.6 As travas autoritativas continuam no prologo, na ordem global aceita.
  IF position('FROM public.pedidos WHERE id = v_sol.pedido_id FOR UPDATE' in v_src) = 0
     OR position('FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE' in v_src) = 0
     OR position('FROM public.pedidos WHERE id = v_sol.pedido_id FOR UPDATE' in v_src)
        > position('FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE' in v_src) THEN
    v_bad := array_append(v_bad, 'a ordem global de travas pedidos -> pedido_itens nao esta provada no prologo');
  END IF;
  IF position('FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE' in v_src) > v_item
     AND v_item > 0 THEN
    v_bad := array_append(v_bad, 'a pre-deteccao de item roda antes da trava de itens');
  END IF;

  -- 2.7 Assinatura, dono, SECURITY DEFINER e search_path inalterados.
  IF NOT EXISTS (SELECT 1 FROM pg_proc
                  WHERE oid = v_aprov AND prosecdef
                    AND proowner = 'postgres'::regrole
                    AND proconfig @> ARRAY['search_path=public, auth']
                    AND pg_get_function_identity_arguments(oid) = 'p_solicitacao_id uuid, p_confirmar_impacto boolean, p_motivo text') THEN
    v_bad := array_append(v_bad, 'assinatura, dono, SECURITY DEFINER ou search_path mudaram');
  END IF;

  -- 2.8 Privilegio exatamente como db/93 declarou: nada de PUBLIC nem anon.
  IF has_function_privilege('anon', v_aprov, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'anon ou PUBLIC ganhou EXECUTE');
  END IF;
  IF NOT has_function_privilege('authenticated', v_aprov, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_aprov, 'EXECUTE') THEN
    v_bad := array_append(v_bad, 'authenticated ou service_role perdeu EXECUTE');
  END IF;

  -- 2.9 Os donos defensivos permanecem intactos.
  IF position('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP' in
       (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.pedido_itens_reconciliar(uuid,jsonb)'))) = 0 THEN
    v_bad := array_append(v_bad, 'pedido_itens_reconciliar perdeu a recusa defensiva');
  END IF;
  IF position('PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED' in
       (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)'))) = 0 THEN
    v_bad := array_append(v_bad, 'definir_prioridade_pedido perdeu a exigencia de confirmacao de impacto');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'db/115 verify: %', array_to_string(v_bad, '; ');
  END IF;

  RAISE NOTICE 'db/115 verify: OK — as duas recusas esperadas sao detectadas no prologo, a subtransacao continua dona da falha inesperada e nada mais mudou';
END;
$verify$;

COMMIT;
