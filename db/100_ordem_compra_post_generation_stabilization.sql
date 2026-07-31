-- =====================================================================
-- db/100_ordem_compra_post_generation_stabilization.sql
-- PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1
--
-- O DEFEITO CORRIGIDO
--   db/99 fechou a ETAPA 1 (planejar) e a ETAPA 2 (gerar). O que ficou
--   aberto foi o DEPOIS: um Pedido de Compra gerado nao tinha saida
--   coerente.
--
--   1. CANCELAR era so-rascunho (db/68, §R.22.7, deliberadamente
--      provisorio) e, por contrato, NAO devolvia nada. Uma ordem emitida
--      por engano ficava presa para sempre e o saldo da necessidade
--      continuava consumido por um documento comercialmente morto.
--   2. EXCLUIR recusava qualquer ordem com `emitida_em IS NOT NULL`, ou
--      seja, uma ordem CANCELADA que um dia foi emitida tambem ficava
--      presa — a regra absoluta contradizia o proprio texto
--      "rascunho ou cancelada" logo acima dela.
--   3. O RECEBIMENTO era oferecido pelo read model sem olhar o cutover:
--      `acoes.receber` ficava true com o cutover em legacy_active/flat,
--      e o operador so descobria a recusa depois de abrir o formulario e
--      confirmar.
--
-- A DECISAO ESTRUTURAL
--   Cancelar e Excluir sao coisas diferentes e continuam sendo:
--     CANCELAR  preserva o documento na historia e para IMEDIATAMENTE de
--               consumir saldo de compra;
--     EXCLUIR   apaga um documento que nao deveria existir.
--
--   COBERTURA ATIVA passa a ter UM dono servidor: `oc_cobertura_ativa`.
--   Ela NAO cria um segundo status de ciclo de vida — deriva do unico que
--   ja existe, `ordem_compra.status_administrativo`. Uma linha de
--   planejamento ou uma alocacao pertencente a uma ordem CANCELADA e
--   historia: continua existindo, continua visivel no documento, e deixa
--   de contar em qualquer teto, saldo, cache ou porta produtiva.
--
--   Por ser DERIVADA, a liberacao no cancelamento e ESTRUTURALMENTE
--   irrepetivel: nao existe quantidade "devolvida" gravada em lugar
--   nenhum que pudesse ser devolvida de novo. Cancelar duas vezes e
--   recusado; excluir depois de cancelar nao encontra nada para liberar.
--
-- ESCOPO NEGATIVO
--   Nao ativa o cutover de recebimento e nao enfraquece o fence do
--   escritor de recebimento (db/75/db/76).
--   Nao altera a semantica de aceite do fornecedor: `status_aceite`
--   continua bloqueando EXCLUSAO exatamente como db/96/db/97 decidiram, e
--   nenhuma regra nova de aceite e inventada para o cancelamento.
--   Nao renumera nada: `pedido_identidade_numeros` nunca retrocede.
--   Nao muta nenhuma linha comercial existente: esta migracao e DDL mais
--   um bloco de invariantes somente-leitura.
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. O DONO UNICO DA COBERTURA ATIVA DE COMPRA
-- ============================================================
-- Uma unica frase, escrita uma unica vez, lida por todos os donos de
-- saldo. Derivada do ciclo de vida do proprio Pedido de Compra — nao ha
-- segunda autoridade, segundo status nem coluna-marcador concorrente.
CREATE OR REPLACE FUNCTION public.oc_cobertura_ativa(p_ordem_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_ordem_id IS NULL
      OR EXISTS (
           SELECT 1 FROM public.ordem_compra o
            WHERE o.id = p_ordem_id
              AND o.status_administrativo <> 'cancelada');
$$;

COMMENT ON FUNCTION public.oc_cobertura_ativa(BIGINT) IS
  'db/100: UNICA definicao servidor de cobertura ATIVA de compra. NULL (planejamento vivo, ainda sem documento) e ativo; um Pedido de Compra existente e ativo enquanto nao esta cancelado. Uma ordem inexistente nao cobre nada. Derivada de ordem_compra.status_administrativo: NAO existe um segundo status de ciclo de vida.';

-- Soma de planejamento que ainda conta como compra ATIVA da necessidade.
CREATE OR REPLACE FUNCTION public.necessidade_kg_planejado_ativo(p_necessidade_id BIGINT)
RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3)
    FROM public.necessidade_compra_planejamento p
   WHERE p.necessidade_id = p_necessidade_id
     AND public.oc_cobertura_ativa(p.ordem_compra_id);
$$;

COMMENT ON FUNCTION public.necessidade_kg_planejado_ativo(BIGINT) IS
  'db/100: total planejado que ainda consome o teto da necessidade. Linhas de um Pedido de Compra CANCELADO continuam existindo como historia e ficam de fora.';

-- A parcela ja gerada que ainda conta. Separada porque o escritor atomico
-- do cartao precisa somar apenas o conjunto novo ao historico ATIVO.
CREATE OR REPLACE FUNCTION public.necessidade_kg_planejado_ativo_gerado(p_necessidade_id BIGINT)
RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(p.kg_planejado), 0)::NUMERIC(12,3)
    FROM public.necessidade_compra_planejamento p
   WHERE p.necessidade_id = p_necessidade_id
     AND p.gerado_em IS NOT NULL
     AND public.oc_cobertura_ativa(p.ordem_compra_id);
$$;

COMMENT ON FUNCTION public.necessidade_kg_planejado_ativo_gerado(BIGINT) IS
  'db/100: parcela JA GERADA do planejamento que ainda consome o teto. Exclui as linhas de Pedidos de Compra cancelados.';

-- Soma de alocacao que ainda consome a necessidade — a mesma frase, agora
-- sobre a camada de alocacao real.
CREATE OR REPLACE FUNCTION public.necessidade_kg_alocado_ativo(p_necessidade_id BIGINT)
RETURNS NUMERIC(12,3)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(a.kg_alocado), 0)::NUMERIC(12,3)
    FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id
   WHERE a.necessidade_id = p_necessidade_id
     AND public.oc_cobertura_ativa(i.ordem_id);
$$;

COMMENT ON FUNCTION public.necessidade_kg_alocado_ativo(BIGINT) IS
  'db/100: valor canonico de necessidade_compra_fio.kg_alocado. Alocacoes de um Pedido de Compra cancelado permanecem na tabela como historia e nao contam.';

-- O UNICO escritor de necessidade_compra_fio.kg_alocado. db/67 declarou o
-- gatilho de alocacao como dono unico do cache; a partir daqui o dono e
-- esta funcao, e o gatilho passa a ser um dos seus dois chamadores. O
-- outro e o cancelamento, que muda a cobertura sem tocar em alocacao
-- alguma e por isso nunca acordaria o gatilho.
CREATE OR REPLACE FUNCTION public.oc_recalcular_cache_necessidade(p_necessidade_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_necessidade_id IS NULL THEN RETURN; END IF;
  UPDATE public.necessidade_compra_fio
     SET kg_alocado = public.necessidade_kg_alocado_ativo(p_necessidade_id)
   WHERE id = p_necessidade_id;
END;
$$;

COMMENT ON FUNCTION public.oc_recalcular_cache_necessidade(BIGINT) IS
  'db/100: dono unico da escrita de necessidade_compra_fio.kg_alocado. Recalcula o cache a partir de necessidade_kg_alocado_ativo. Chamado pelo gatilho de alocacao (db/67) e por cancelar_ordem_compra, que muda a cobertura sem tocar em alocacoes.';

-- ============================================================
-- 2. O cache da necessidade passa a respeitar a cobertura ativa
-- ============================================================
-- Substitui o corpo de db/67. A forma (AFTER INSERT/UPDATE/DELETE, o caso
-- de troca de necessidade_id) e preservada; so a definicao da soma muda,
-- e ela agora vive num unico lugar.
CREATE OR REPLACE FUNCTION public.trg_alocacao_kg_alocado_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.necessidade_id IS DISTINCT FROM OLD.necessidade_id THEN
    PERFORM public.oc_recalcular_cache_necessidade(OLD.necessidade_id);
  END IF;

  PERFORM public.oc_recalcular_cache_necessidade(
    COALESCE(NEW.necessidade_id, OLD.necessidade_id));

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trg_alocacao_kg_alocado_cache() IS
  'db/67 + db/100: mantenedor do cache necessidade_compra_fio.kg_alocado em cada INSERT/UPDATE/DELETE de alocacao. A soma deixou de ser total e passou a ser a cobertura ATIVA (oc_cobertura_ativa): uma alocacao de Pedido de Compra cancelado permanece na tabela e nao conta. A escrita propriamente dita pertence a oc_recalcular_cache_necessidade.';

-- ============================================================
-- 3. O teto do planejamento passa a respeitar a cobertura ativa
-- ============================================================
-- Sem isto, cancelar e replanejar a MESMA quantidade estouraria o teto no
-- COMMIT: as linhas canceladas continuariam somando.
CREATE OR REPLACE FUNCTION public.trg_planejamento_saldo_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_need       BIGINT;
  v_total      NUMERIC(12,3);
  v_necessario NUMERIC(12,3);
BEGIN
  v_need := COALESCE(NEW.necessidade_id, OLD.necessidade_id);
  IF v_need IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT n.kg_necessario INTO v_necessario
    FROM public.necessidade_compra_fio n WHERE n.id = v_need;
  IF v_necessario IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_total := public.necessidade_kg_planejado_ativo(v_need);

  IF v_total > v_necessario THEN
    RAISE EXCEPTION
      'Planejamento ativo (% kg) excede a necessidade % (% kg)',
      v_total, v_need, v_necessario
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trg_planejamento_saldo_guard() IS
  'db/99 + db/100: guarda DEFERRABLE do teto da necessidade. O teto passou a considerar apenas a cobertura ATIVA, para que cancelar um Pedido de Compra realmente devolva a quantidade ao planejamento em vez de deixa-la ocupada por um documento morto.';

-- ============================================================
-- 4. Dono unico da elegibilidade de CANCELAMENTO
-- ============================================================
-- Mesmo padrao de db/97 para exclusao: o escritor e o read model leem a
-- MESMA funcao, entao a tela nunca oferece uma acao que o servidor
-- recusaria nem esconde uma que ele aceitaria.
--
-- ACEITE DO FORNECEDOR: deliberadamente ausente. db/96/db/97 decidiram que
-- um aceite DECIDIDO impede a EXCLUSAO, e essa regra e preservada intacta
-- abaixo. Cancelar e justamente o caminho de uma ordem real que precisa
-- permanecer na historia, entao nenhuma regra nova de aceite e inventada
-- aqui — este arquivo nao altera a semantica de aceite.
CREATE OR REPLACE FUNCTION public.oc_elegivel_cancelamento(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.ordem_compra%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  IF v.legado THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ordem_legado',
      'erro', 'Ordem legada nao pode ser cancelada por esta via');
  END IF;

  IF v.status_administrativo = 'cancelada' THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ja_cancelada',
      'erro', 'Esta ordem ja esta cancelada');
  END IF;

  IF v.status_administrativo NOT IN ('rascunho', 'emitida') THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma ordem em rascunho ou emitida pode ser cancelada');
  END IF;

  -- Os tres filhos ON DELETE RESTRICT sao exatamente a historia
  -- irreversivel: recebimento, lancamento de fio e movimento de estoque.
  -- Depois de qualquer um deles a ordem produziu consequencia fisica e o
  -- caminho correto e o estorno, nunca o cancelamento.
  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_movimentos_estoque WHERE ordem_compra_id = p_ordem_id) THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'historico_irreversivel',
      'erro', 'A ordem possui recebimento, lancamento de fio ou movimento de estoque e nao pode ser cancelada');
  END IF;

  RETURN jsonb_build_object('elegivel', true, 'codigo', 'ok', 'erro', NULL);
END;
$$;

COMMENT ON FUNCTION public.oc_elegivel_cancelamento(BIGINT) IS
  'db/100: UNICO dono da elegibilidade de cancelamento de um Pedido de Compra. Rascunho e emitida sem historia irreversivel sao elegiveis; legada, ja cancelada e qualquer recebimento/lancamento/movimento nao sao. Lido por public.cancelar_ordem_compra e projetado em obter_ordem_compra_admin.acoes.cancelar.';

-- ============================================================
-- 5. CANCELAR — atomico, com liberacao imediata e irrepetivel
-- ============================================================
-- Substitui a versao so-rascunho de db/68. O grafo historico inteiro e
-- preservado: cabecalho, codigo visivel, itens, alocacoes, linhas de
-- planejamento e eventos continuam exatamente onde estavam. O que muda e
-- somente o status — e, por derivacao, a cobertura.
CREATE OR REPLACE FUNCTION public.cancelar_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem        public.ordem_compra%ROWTYPE;
  v_elegivel     JSONB;
  v_actor        UUID;
  v_necessidades BIGINT[];
  v_need         BIGINT;
  v_liberado     JSONB;
  v_planejamentos BIGINT;
  v_alocacoes    BIGINT;
  v_kg_total     NUMERIC(12,3);
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode cancelar uma ordem de compra');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  -- A decisao pertence ao dono unico; a trava FOR UPDATE acima garante que
  -- o estado que ele leu nao muda entre a verificacao e a transicao. Um
  -- segundo cancelamento cai aqui, em `ja_cancelada`, sem mutar nada.
  v_elegivel := public.oc_elegivel_cancelamento(p_ordem_id);
  IF (v_elegivel->>'elegivel')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false,
      'codigo', v_elegivel->>'codigo', 'erro', v_elegivel->>'erro');
  END IF;

  -- ============================================================
  -- ORDEM CANONICA DE TRAVA: (1) necessidade, (2) planejamento.
  -- ============================================================
  -- A mesma ordem dos escritores de planejamento e da exclusao (db/99).
  -- O conjunto e a UNIAO dos dois caminhos que ligam esta ordem a uma
  -- necessidade: as linhas de planejamento geradas por ela e as alocacoes
  -- dos seus itens.
  SELECT array_agg(DISTINCT n ORDER BY n) INTO v_necessidades
    FROM (
      SELECT p.necessidade_id AS n
        FROM public.necessidade_compra_planejamento p
       WHERE p.ordem_compra_id = p_ordem_id
      UNION
      SELECT a.necessidade_id
        FROM public.ordem_compra_item_alocacao a
        JOIN public.ordem_compra_item i ON i.id = a.item_id
       WHERE i.ordem_id = p_ordem_id
    ) s;

  IF v_necessidades IS NOT NULL THEN
    PERFORM 1 FROM public.necessidade_compra_fio
     WHERE id = ANY(v_necessidades) ORDER BY id FOR UPDATE;

    PERFORM 1 FROM public.necessidade_compra_planejamento p
     WHERE p.ordem_compra_id = p_ordem_id
     ORDER BY p.id FOR UPDATE;
  END IF;

  -- Estado ANTES, por necessidade. `kg_liberado` e a quantidade que ESTA
  -- ordem deixa de consumir; ela nao e gravada em lugar nenhum, e apenas
  -- relatada. E exatamente por isso que a liberacao nao pode acontecer
  -- duas vezes: nao existe saldo devolvido para devolver de novo.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'necessidade_id',   n.id,
           'material',         n.material,
           'kg_necessario',    n.kg_necessario,
           'kg_alocado_antes', n.kg_alocado,
           'kg_liberado',      coalesce(s.kg, 0)::NUMERIC(12,3)
         ) ORDER BY n.id), '[]'::jsonb)
    INTO v_liberado
    FROM public.necessidade_compra_fio n
    LEFT JOIN (
      SELECT a.necessidade_id AS nid, sum(a.kg_alocado) AS kg
        FROM public.ordem_compra_item_alocacao a
        JOIN public.ordem_compra_item i ON i.id = a.item_id
       WHERE i.ordem_id = p_ordem_id
       GROUP BY a.necessidade_id
    ) s ON s.nid = n.id
   WHERE n.id = ANY(coalesce(v_necessidades, ARRAY[]::BIGINT[]));

  SELECT count(*) INTO v_planejamentos
    FROM public.necessidade_compra_planejamento
   WHERE ordem_compra_id = p_ordem_id;

  SELECT count(*), coalesce(sum(a.kg_alocado), 0)::NUMERIC(12,3)
    INTO v_alocacoes, v_kg_total
    FROM public.ordem_compra_item_alocacao a
    JOIN public.ordem_compra_item i ON i.id = a.item_id
   WHERE i.ordem_id = p_ordem_id;

  UPDATE public.ordem_compra
     SET status_administrativo = 'cancelada',
         cancelada_em          = now(),
         cancelada_por         = v_actor
   WHERE id = p_ordem_id;

  -- A cobertura ja ficou inativa por derivacao no UPDATE acima. O cache da
  -- necessidade e a UNICA projecao materializada dessa cobertura, e por
  -- isso e o unico valor que precisa ser reescrito. Nenhuma alocacao e
  -- nenhuma linha de planejamento e tocada.
  IF v_necessidades IS NOT NULL THEN
    FOREACH v_need IN ARRAY v_necessidades LOOP
      PERFORM public.oc_recalcular_cache_necessidade(v_need);
    END LOOP;
  END IF;

  -- EXATAMENTE UM evento administrativo.
  INSERT INTO public.ordem_compra_eventos
    (ordem_compra_id, dimensao, tipo_evento, valor_anterior, valor_novo, payload, criado_por)
  VALUES (p_ordem_id, 'administrativo', 'cancelada',
          v_ordem.status_administrativo, 'cancelada',
          jsonb_build_object(
            'planejamentos_liberados', v_planejamentos,
            'alocacoes_liberadas', v_alocacoes,
            'kg_liberado_total', v_kg_total,
            'necessidades', v_liberado),
          v_actor);

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id,
    'identidade_operacional', v_ordem.identidade_operacional,
    'codigo', v_ordem.codigo,
    'status_anterior', v_ordem.status_administrativo,
    'status_administrativo', 'cancelada',
    'planejamentos_liberados', v_planejamentos,
    'alocacoes_liberadas', v_alocacoes,
    'kg_liberado_total', v_kg_total,
    'necessidades_liberadas', v_liberado);
END;
$$;

COMMENT ON FUNCTION public.cancelar_ordem_compra(BIGINT) IS
  'db/68 + db/100: cancelamento atomico de um Pedido de Compra NATIVO em rascunho OU emitida, sem historia irreversivel. Preserva integralmente cabecalho, codigo visivel, itens, alocacoes, linhas de planejamento e eventos; muda apenas o status. A liberacao do saldo e DERIVADA (oc_cobertura_ativa), portanto imediata e estruturalmente irrepetivel — nao existe quantidade devolvida gravada que pudesse ser devolvida duas vezes. Escreve exatamente um evento administrativo. Um segundo cancelamento devolve ja_cancelada e nao muta nada.';

-- ============================================================
-- 6. Elegibilidade de EXCLUSAO — a regra absoluta errada sai
-- ============================================================
-- Substitui db/97. A frase removida e:
--     emitida_em IS NOT NULL -> ordem_emitida
-- Ela contradizia a linha imediatamente acima dela, que ja admitia
-- `cancelada`: uma ordem cancelada DEPOIS de emitida carrega emitida_em
-- para sempre e ficava permanentemente inelegivel, sem nenhum caminho de
-- produto. Quem governa e o ESTADO ATUAL mais a historia irreversivel.
-- Uma ordem `emitida` continua sem exclusao direta porque o seu status
-- nao e nem rascunho nem cancelada — ela precisa ser cancelada antes.
CREATE OR REPLACE FUNCTION public.oc_elegivel_exclusao(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.ordem_compra%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  IF v.legado THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'ordem_legado',
      'erro', 'Ordem legada nao pode ser excluida por esta via');
  END IF;

  IF v.status_administrativo NOT IN ('rascunho', 'cancelada') THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma ordem em rascunho ou cancelada pode ser excluida. Cancele a ordem antes de excluir.');
  END IF;

  -- Preservado de db/96/db/97 sem alteracao semantica.
  IF v.status_aceite IN ('aceita', 'rejeitada') THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'aceite_decidido',
      'erro', 'Uma ordem com aceite decidido pelo fornecedor nao pode ser excluida');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_movimentos_estoque WHERE ordem_compra_id = p_ordem_id) THEN
    RETURN jsonb_build_object('elegivel', false, 'codigo', 'historico_irreversivel',
      'erro', 'A ordem possui recebimento, lancamento de fio ou movimento de estoque e nao pode ser excluida');
  END IF;

  RETURN jsonb_build_object('elegivel', true, 'codigo', 'ok', 'erro', NULL);
END;
$$;

COMMENT ON FUNCTION public.oc_elegivel_exclusao(BIGINT) IS
  'db/97 + db/100: UNICO dono da elegibilidade de exclusao permanente. Rascunho ou cancelada, nativa, sem aceite decidido e sem historia irreversivel. db/100 removeu a regra absoluta emitida_em IS NOT NULL, que contradizia a propria admissao de `cancelada` e prendia para sempre uma ordem cancelada que um dia foi emitida. Uma ordem `emitida` continua sem exclusao direta: o seu status a exclui pela primeira regra.';

-- ============================================================
-- 7. EXCLUIR — dois ramos explicitos por estado de ciclo de vida
-- ============================================================
-- RASCUNHO   nunca teve a sua cobertura liberada, entao a exclusao DEVOLVE
--            o planejamento ao estado vivo com a semantica EXATA de db/99
--            (merge na linha viva existente ou reviver em lugar).
-- CANCELADA  ja teve a cobertura liberada no cancelamento. Devolver de novo
--            criaria planejamento do nada e duplicaria a quantidade, entao
--            as linhas historicas sao REMOVIDAS junto com o documento.
CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem        public.ordem_compra%ROWTYPE;
  v_elegivel     JSONB;
  v_necessidades JSONB;
  v_itens        BIGINT;
  v_alocacoes    BIGINT;
  v_eventos      BIGINT;
  v_planejamentos BIGINT;
  v_liberado     RECORD;
  v_viva         BIGINT;
  v_cancelada    BOOLEAN;
  v_need         BIGINT;
  v_necessidades_prelim BIGINT[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode excluir uma ordem de compra');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  v_elegivel := public.oc_elegivel_exclusao(p_ordem_id);
  IF (v_elegivel->>'elegivel')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false,
      'codigo', v_elegivel->>'codigo', 'erro', v_elegivel->>'erro');
  END IF;

  v_cancelada := v_ordem.status_administrativo = 'cancelada';

  -- ============================================================
  -- ORDEM CANONICA DE TRAVA: (1) necessidade, (2) planejamento.
  -- ============================================================
  -- Preservada de db/99 sem alteracao: leitura preliminar NAO autoritativa
  -- apenas para descobrir o conjunto a travar; tudo o que decide acontece
  -- depois, ja sob as travas.
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades_prelim
    FROM public.necessidade_compra_planejamento p
   WHERE p.ordem_compra_id = p_ordem_id;

  SELECT array_agg(DISTINCT n ORDER BY n) INTO v_necessidades_prelim
    FROM (
      SELECT unnest(coalesce(v_necessidades_prelim, ARRAY[]::BIGINT[])) AS n
      UNION
      SELECT a.necessidade_id
        FROM public.ordem_compra_item_alocacao a
        JOIN public.ordem_compra_item i ON i.id = a.item_id
       WHERE i.ordem_id = p_ordem_id
    ) s;

  IF v_necessidades_prelim IS NOT NULL THEN
    PERFORM 1 FROM public.necessidade_compra_fio
     WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'necessidade_id', n.id, 'material', n.material,
           'kg_necessario', n.kg_necessario, 'kg_alocado_antes', n.kg_alocado,
           'kg_devolvido', s.kg) ORDER BY n.id), '[]'::jsonb)
    INTO v_necessidades
    FROM (SELECT a.necessidade_id AS nid, sum(a.kg_alocado) AS kg
          FROM public.ordem_compra_item_alocacao a
          JOIN public.ordem_compra_item i ON i.id = a.item_id
          WHERE i.ordem_id = p_ordem_id GROUP BY a.necessidade_id) s
    JOIN public.necessidade_compra_fio n ON n.id = s.nid;

  PERFORM set_config('app.oc_exclusao_id', p_ordem_id::text, true);
  PERFORM set_config('app.oc_plan_release_id', p_ordem_id::text, true);

  v_planejamentos := 0;

  -- (2) planejamento, ja com as necessidades travadas acima.
  PERFORM 1 FROM public.necessidade_compra_planejamento p
   WHERE p.ordem_compra_id = p_ordem_id
      OR (p.gerado_em IS NULL AND EXISTS (
            SELECT 1 FROM public.necessidade_compra_planejamento g
             WHERE g.ordem_compra_id = p_ordem_id
               AND g.necessidade_id = p.necessidade_id
               AND g.fornecedor_id = p.fornecedor_id))
   ORDER BY p.id FOR UPDATE;

  IF v_cancelada THEN
    -- RAMO CANCELADA. O cancelamento ja tornou esta cobertura inativa e o
    -- saldo ja voltou a ficar disponivel naquele instante. Reviver as
    -- linhas aqui somaria a MESMA quantidade uma segunda vez ao
    -- planejamento vivo — a duplicacao exata que este ramo existe para
    -- impedir. As linhas historicas somem com o documento a que pertencem.
    WITH alvo AS (
      DELETE FROM public.necessidade_compra_planejamento
       WHERE ordem_compra_id = p_ordem_id
      RETURNING id
    ) SELECT count(*) INTO v_planejamentos FROM alvo;
  ELSE
    -- RAMO RASCUNHO. Semantica EXATA de db/99, preservada linha a linha:
    --   (a) existe linha viva do mesmo par -> soma nela e remove a historica;
    --   (b) nao existe                     -> a propria linha volta a viver.
    FOR v_liberado IN
      SELECT p.id, p.necessidade_id, p.fornecedor_id, p.kg_planejado
        FROM public.necessidade_compra_planejamento p
       WHERE p.ordem_compra_id = p_ordem_id
       ORDER BY p.id
       FOR UPDATE
    LOOP
      SELECT id INTO v_viva
        FROM public.necessidade_compra_planejamento
       WHERE necessidade_id = v_liberado.necessidade_id
         AND fornecedor_id = v_liberado.fornecedor_id
         AND gerado_em IS NULL
       FOR UPDATE;

      IF FOUND THEN
        UPDATE public.necessidade_compra_planejamento
           SET kg_planejado = kg_planejado + v_liberado.kg_planejado,
               atualizado_em = now()
         WHERE id = v_viva;
        DELETE FROM public.necessidade_compra_planejamento WHERE id = v_liberado.id;
      ELSE
        UPDATE public.necessidade_compra_planejamento
           SET alocacao_id = NULL, ordem_compra_id = NULL,
               gerado_em = NULL, gerado_por = NULL, atualizado_em = now()
         WHERE id = v_liberado.id;
      END IF;

      v_planejamentos := v_planejamentos + 1;
    END LOOP;
  END IF;

  WITH alvo AS (
    DELETE FROM public.ordem_compra_item_alocacao a USING public.ordem_compra_item i
    WHERE i.id = a.item_id AND i.ordem_id = p_ordem_id RETURNING a.id
  ) SELECT count(*) INTO v_alocacoes FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_item WHERE ordem_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_itens FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_eventos WHERE ordem_compra_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_eventos FROM alvo;
  DELETE FROM public.ordem_compra WHERE id = p_ordem_id;

  -- Recalculo final explicito. Para o ramo rascunho o gatilho de alocacao
  -- ja fez o trabalho; para o ramo cancelada ele foi um no-op correto,
  -- porque aquelas alocacoes ja nao contavam. Reafirmar o cache aqui e
  -- idempotente e deixa o valor final provado em vez de presumido.
  IF v_necessidades_prelim IS NOT NULL THEN
    FOREACH v_need IN ARRAY v_necessidades_prelim LOOP
      PERFORM public.oc_recalcular_cache_necessidade(v_need);
    END LOOP;
  END IF;

  PERFORM set_config('app.oc_exclusao_id', '', true);
  PERFORM set_config('app.oc_plan_release_id', '', true);

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id,
    'identidade_operacional', v_ordem.identidade_operacional,
    'codigo_liberado', v_ordem.codigo,
    'status_anterior', v_ordem.status_administrativo,
    'origem_cancelada', v_cancelada,
    'itens_removidos', v_itens, 'alocacoes_liberadas', v_alocacoes,
    'eventos_removidos', v_eventos,
    'planejamentos_liberados', CASE WHEN v_cancelada THEN 0 ELSE v_planejamentos END,
    'planejamentos_removidos', CASE WHEN v_cancelada THEN v_planejamentos ELSE 0 END,
    'necessidades_liberadas', v_necessidades);
END;
$$;

COMMENT ON FUNCTION public.excluir_ordem_compra(BIGINT) IS
  'db/96 + db/97 + db/99 + db/100: exclusao atomica de um Pedido de Compra NATIVO sem historia irreversivel. db/100 ramifica explicitamente por estado: um RASCUNHO devolve o planejamento ao estado vivo com a semantica exata de db/99, porque a sua cobertura nunca foi liberada; uma ordem CANCELADA teve a cobertura liberada no cancelamento, entao as suas linhas historicas sao REMOVIDAS e nada e devolvido uma segunda vez. Zero orfaos em ambos os ramos.';

-- ============================================================
-- 8. Read model administrativo — cancelar, excluir e proveniencia
-- ============================================================
-- Substitui db/97. Alem de `acoes.excluir`, agora projeta `acoes.cancelar`
-- a partir do dono unico, o motivo servidor da recusa, e os campos de
-- identidade do Pedido que a secao de proveniencia da tela precisa.
CREATE OR REPLACE FUNCTION public.obter_ordem_compra_admin(p_ordem_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ordem JSONB; v_eventos JSONB; v_completa BOOLEAN; v_legado BOOLEAN;
  v_status TEXT; v_exige_aceite BOOLEAN;
  v_excluir BOOLEAN; v_cancelar BOOLEAN;
  v_eleg_cancelar JSONB; v_eleg_excluir JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Sem permissao');
  END IF;

  SELECT oc.legado, oc.status_administrativo INTO v_legado, v_status
  FROM public.ordem_compra oc WHERE oc.id = p_ordem_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada', 'erro', 'Ordem nao encontrada');
  END IF;
  v_completa := public._distribuicao_completa_ordem(p_ordem_id);
  SELECT exige_aceite INTO v_exige_aceite FROM public.ordem_compra_config WHERE id = 1;
  v_exige_aceite := COALESCE(v_exige_aceite, FALSE);

  v_eleg_excluir  := public.oc_elegivel_exclusao(p_ordem_id);
  v_eleg_cancelar := public.oc_elegivel_cancelamento(p_ordem_id);
  v_excluir  := COALESCE((v_eleg_excluir->>'elegivel')::boolean, FALSE);
  v_cancelar := COALESCE((v_eleg_cancelar->>'elegivel')::boolean, FALSE);

  SELECT jsonb_build_object(
    'ordem_id',              oc.id,
    'codigo',                oc.codigo,
    'identidade_operacional', oc.identidade_operacional,
    'modelo',                CASE WHEN oc.legado THEN 'legado' ELSE 'nativo' END,
    'pedido_id',             oc.pedido_id,
    'pedido_numero',         oc.identidade_pedido_numero,
    'pedido_ano',            oc.identidade_pedido_ano,
    'fornecedor_id',         oc.fornecedor_id,
    'fornecedor_nome',       f.nome,
    'status_administrativo', oc.status_administrativo,
    'status_aceite',         oc.status_aceite,
    'status_recebimento',    oc.status_recebimento,
    'legado',                oc.legado,
    'legado_provenance',     oc.legado_provenance,
    'emitida_em',            oc.emitida_em,
    'cancelada_em',          oc.cancelada_em,
    'itens_total',           (SELECT count(*) FROM public.ordem_compra_item i WHERE i.ordem_id = oc.id),
    'itens',                 COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'item_id',       i.id,
          'material',      i.material,
          'cor_id',        i.cor_id,
          'cor_poliester', i.cor_poliester,
          'cor_nome',      c.nome,
          'kg_pedido',     i.kg_pedido,
          'kg_recebido',   i.kg_recebido,
          'alocacoes',     (SELECT count(*) FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id),
          'kg_alocado',    COALESCE((SELECT SUM(a.kg_alocado) FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id), 0)
        ) ORDER BY i.id)
        FROM public.ordem_compra_item i
        LEFT JOIN public.cores c ON c.id = i.cor_id
        WHERE i.ordem_id = oc.id
      ), '[]'::jsonb),
    -- A tela obedece: `cancelar` e `excluir` vem inteiros dos donos unicos,
    -- em QUALQUER status, em vez de serem congelados por um CASE de status
    -- que ja divergia da regra real do servidor.
    'acoes',                 CASE
        WHEN oc.legado THEN jsonb_build_object('editar_itens', false, 'remover_itens', false, 'cancelar', false, 'distribuir', false, 'emitir', false, 'receber', false, 'excluir', false)
        WHEN oc.status_administrativo = 'rascunho' THEN jsonb_build_object('editar_itens', true, 'remover_itens', true, 'cancelar', v_cancelar, 'distribuir', true, 'emitir', (v_completa AND NOT v_exige_aceite), 'receber', false, 'excluir', v_excluir)
        ELSE jsonb_build_object('editar_itens', false, 'remover_itens', false, 'cancelar', v_cancelar, 'distribuir', false, 'emitir', false, 'receber', false, 'excluir', v_excluir)
      END,
    'bloqueio_cancelamento', CASE WHEN v_cancelar THEN NULL ELSE v_eleg_cancelar->>'codigo' END,
    'bloqueio_exclusao',     CASE WHEN v_excluir  THEN NULL ELSE v_eleg_excluir->>'codigo' END,
    'distribuicao_completa', v_completa,
    'pronta_para_emissao',   v_completa,
    'pode_emitir',           (v_completa AND NOT v_exige_aceite),
    'bloqueio_emissao',      CASE WHEN (NOT oc.legado) AND oc.status_administrativo = 'rascunho'
                                  THEN CASE WHEN NOT v_completa THEN 'distribuicao_necessidades_pendente'
                                            WHEN v_exige_aceite THEN 'emissao_bloqueada_exige_aceite'
                                            ELSE NULL END
                                  ELSE NULL END
  )
  INTO v_ordem
  FROM public.ordem_compra oc
  LEFT JOIN public.fornecedores f ON f.id = oc.fornecedor_id
  WHERE oc.id = p_ordem_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', e.id, 'dimensao', e.dimensao, 'tipo_evento', e.tipo_evento,
      'valor_anterior', e.valor_anterior, 'valor_novo', e.valor_novo, 'criado_em', e.criado_em
    ) ORDER BY e.id), '[]'::jsonb)
  INTO v_eventos
  FROM public.ordem_compra_eventos e
  WHERE e.ordem_compra_id = p_ordem_id;

  RETURN jsonb_build_object('ok', true, 'ordem', v_ordem, 'eventos', v_eventos);
END;
$$;

COMMENT ON FUNCTION public.obter_ordem_compra_admin(BIGINT) IS
  'db/68 + db/77 + db/97 + db/100: read model administrativo do Pedido de Compra. db/100 projeta acoes.cancelar a partir de public.oc_elegivel_cancelamento em QUALQUER status (antes era congelado em false fora de rascunho, escondendo o cancelamento de uma ordem emitida), expoe o motivo servidor de cada recusa em bloqueio_cancelamento/bloqueio_exclusao e carrega a identidade comercial do Pedido (pedido_numero, pedido_ano) para a secao de proveniencia.';

-- ============================================================
-- 9. Read model de RECEBIMENTO — a acao respeita o cutover
-- ============================================================
-- Substitui db/70. `acoes.receber` deixava de olhar o cutover, entao com
-- ordem_compra_cutover em legacy_active/flat a tela oferecia uma acao que
-- o escritor recusaria; o operador so descobria depois de preencher o
-- formulario inteiro. O fence do ESCRITOR (db/75/db/76) nao e tocado:
-- esta secao apenas para de mentir sobre ele antes da tentativa.
CREATE OR REPLACE FUNCTION public.obter_historico_recebimento_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.ordem_compra%ROWTYPE;
  v_user RECORD;
  v_is_admin BOOLEAN;
  v_is_supplier BOOLEAN;
  v_cutover RECORD;
  v_canonico BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  END IF;
  SELECT * INTO v_order FROM public.ordem_compra WHERE id = p_ordem_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ordem_nao_encontrada');
  END IF;
  SELECT u.tipo, u.ativo, u.fornecedor_id INTO v_user
  FROM public.usuarios u WHERE u.id = auth.uid();
  v_is_admin := COALESCE(v_user.ativo IS TRUE AND v_user.tipo = 'admin' AND public.is_admin(), FALSE);
  v_is_supplier := COALESCE(v_user.ativo IS TRUE AND v_user.tipo = 'fornecedor'
    AND v_user.fornecedor_id IS NOT NULL
    AND v_user.fornecedor_id = v_order.fornecedor_id, FALSE);
  IF NOT v_is_admin AND NOT v_is_supplier THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  END IF;

  -- Estado do cutover, fail closed: ausente ou ilegivel significa INATIVO.
  SELECT c.status, c.read_authority INTO v_cutover
  FROM public.ordem_compra_cutover c WHERE c.id = 1;
  v_canonico := COALESCE(v_cutover.status = 'canonical_active'
                     AND v_cutover.read_authority = 'canonical', FALSE);

  RETURN jsonb_build_object(
    'ok', true,
    'codigo', 'ok',
    'ordem_compra_id', v_order.id,
    'status_administrativo', v_order.status_administrativo,
    'status_aceite', v_order.status_aceite,
    'status_recebimento', v_order.status_recebimento,
    'ator_tipo', CASE WHEN v_is_admin THEN 'admin' ELSE 'fornecedor' END,
    'recebimento_canonico_ativo', v_canonico,
    'bloqueio_recebimento', CASE WHEN v_canonico THEN NULL ELSE 'recebimento_canonico_inativo' END,
    'acoes', jsonb_build_object(
      'receber', (v_canonico AND NOT v_order.legado AND v_order.status_administrativo = 'emitida'
        AND v_order.status_aceite IN ('nao_aplicavel', 'aceita')),
      'estornar', (v_is_admin AND EXISTS (
        SELECT 1
        FROM public.ordem_compra_fio_lancamentos p
        WHERE p.ordem_compra_id = v_order.id AND p.tipo = 'recebimento'
          AND p.recebimento_id IS NOT NULL
          AND p.kg_recebido + COALESCE((
            SELECT SUM(r.kg_recebido)
            FROM public.ordem_compra_fio_lancamentos r
            WHERE r.estorno_de_id = p.id
          ), 0) > 0
      ))
    ),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'item_id', i.id,
        'material', i.material,
        'cor_id', i.cor_id,
        'cor_poliester', i.cor_poliester,
        'kg_pedido', i.kg_pedido,
        'kg_recebido', i.kg_recebido,
        'kg_restante', GREATEST(i.kg_pedido - i.kg_recebido, 0),
        'kg_excesso', COALESCE((
          SELECT SUM(l.kg_excesso)
          FROM public.ordem_compra_fio_lancamentos l
          WHERE l.ordem_compra_item_id = i.id AND l.recebimento_id IS NOT NULL
        ), 0),
        'alocacoes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'alocacao_id', a.id,
            'op_id', a.op_id,
            'kg_alocado', a.kg_alocado,
            'kg_recebido', COALESCE((
              SELECT SUM(l.kg_recebido)
              FROM public.ordem_compra_fio_lancamentos l
              WHERE l.ordem_compra_item_alocacao_id = a.id
            ), 0),
            'kg_restante', a.kg_alocado - COALESCE((
              SELECT SUM(l.kg_recebido)
              FROM public.ordem_compra_fio_lancamentos l
              WHERE l.ordem_compra_item_alocacao_id = a.id
            ), 0)
          ) ORDER BY a.id)
          FROM public.ordem_compra_item_alocacao a WHERE a.item_id = i.id
        ), '[]'::jsonb)
      ) ORDER BY i.id)
      FROM public.ordem_compra_item i WHERE i.ordem_id = v_order.id
    ), '[]'::jsonb),
    'comandos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'comando_tipo', h.comando_tipo,
        'ator_tipo', h.ator_tipo,
        'ocorrido_em', h.ocorrido_em,
        'documento_ref', h.documento_ref,
        'origem_tipo', h.origem_tipo,
        'origem_ref', h.origem_ref,
        'lancamentos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', l.id,
            'linha_indice', l.linha_indice,
            'item_id', l.ordem_compra_item_id,
            'alocacao_id', l.ordem_compra_item_alocacao_id,
            'op_id', l.op_id,
            'material', l.material,
            'cor_id', l.cor_id,
            'cor_poliester', l.cor_poliester,
            'kg', l.kg_recebido,
            'kg_excesso', l.kg_excesso,
            'estorno_de_id', l.estorno_de_id,
            'kg_reversivel', CASE WHEN l.tipo = 'recebimento' THEN
              l.kg_recebido + COALESCE((
                SELECT SUM(r.kg_recebido) FROM public.ordem_compra_fio_lancamentos r
                WHERE r.estorno_de_id = l.id
              ), 0) ELSE 0 END,
            'movimento_estoque', CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', m.id,
              'kg_excedente_delta', m.kg_excedente_delta,
              'excesso_antes', m.excesso_antes,
              'excesso_depois', m.excesso_depois
            ) END
          ) ORDER BY l.linha_indice)
          FROM public.ordem_compra_fio_lancamentos l
          LEFT JOIN public.ordem_compra_fio_movimentos_estoque m ON m.lancamento_id = l.id
          WHERE l.recebimento_id = h.id
        ), '[]'::jsonb)
      ) ORDER BY h.criado_em, h.id)
      FROM public.ordem_compra_recebimentos h WHERE h.ordem_compra_id = v_order.id
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) IS
  'PHASE-C2 + db/100: read model de verificacao de recebimento para administrador ativo ou fornecedor correspondente. db/100 subordina acoes.receber ao cutover canonico (ordem_compra_cutover status=canonical_active E read_authority=canonical) e devolve o bloqueador servidor recebimento_canonico_inativo enquanto ele nao vale. O fence do escritor (db/75/db/76) e independente e permanece inalterado.';

-- ============================================================
-- 10. Planejamento — todos os donos de saldo leem a cobertura ativa
-- ============================================================

-- 10.1 Read model da tela. Alem dos totais ativos, cada linha passa a
-- declarar se ainda cobre (`ativo`) e em que estado esta o documento que a
-- consumiu, para que o operador VEJA a historia cancelada em vez de ela
-- desaparecer silenciosamente do cartao.
CREATE OR REPLACE FUNCTION public.obter_planejamento_compra_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_necessidades JSONB;
  v_fornecedores JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode ler o planejamento de compras');
  END IF;

  IF p_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_invalido',
      'erro', 'Pedido obrigatorio');
  END IF;

  SELECT coalesce(jsonb_agg(linha ORDER BY linha->>'ordenacao', (linha->>'necessidade_id')::BIGINT), '[]'::jsonb)
    INTO v_necessidades
    FROM (
      SELECT jsonb_build_object(
               'necessidade_id',  n.id,
               'origem_tipo',     n.origem_tipo,
               'op_id',           n.op_id,
               'op_identidade',   o.identidade_operacional,
               'material',        n.material,
               'cor_id',          n.cor_id,
               'cor_nome',        c.nome,
               'cor_poliester',   n.cor_poliester,
               'kg_necessario',   n.kg_necessario,
               'kg_planejado',    coalesce(pl.total, 0)::NUMERIC(12,3),
               'kg_restante',     (n.kg_necessario - coalesce(pl.total, 0))::NUMERIC(12,3),
               'kg_gerado',       coalesce(pl.total_gerado, 0)::NUMERIC(12,3),
               'kg_cancelado',    coalesce(pl.total_cancelado, 0)::NUMERIC(12,3),
               -- Ordenacao obrigatoria: pendente, parcial, distribuido.
               'situacao',
                 CASE
                   WHEN coalesce(pl.total, 0) <= 0                THEN 'pendente'
                   WHEN coalesce(pl.total, 0) < n.kg_necessario   THEN 'parcial'
                   ELSE 'distribuido'
                 END,
               'ordenacao',
                 CASE
                   WHEN coalesce(pl.total, 0) <= 0                THEN '1'
                   WHEN coalesce(pl.total, 0) < n.kg_necessario   THEN '2'
                   ELSE '3'
                 END,
               'planejamentos', coalesce(pl.linhas, '[]'::jsonb)
             ) AS linha
        FROM public.necessidade_compra_fio n
        LEFT JOIN public.ops o   ON o.id = n.op_id
        LEFT JOIN public.cores c ON c.id = n.cor_id
        LEFT JOIN LATERAL (
          SELECT sum(p.kg_planejado) FILTER (WHERE public.oc_cobertura_ativa(p.ordem_compra_id)) AS total,
                 sum(p.kg_planejado) FILTER (WHERE p.gerado_em IS NOT NULL
                                               AND public.oc_cobertura_ativa(p.ordem_compra_id)) AS total_gerado,
                 sum(p.kg_planejado) FILTER (WHERE NOT public.oc_cobertura_ativa(p.ordem_compra_id)) AS total_cancelado,
                 jsonb_agg(jsonb_build_object(
                   'planejamento_id', p.id,
                   'fornecedor_id',   p.fornecedor_id,
                   'fornecedor_nome', f.nome,
                   'kg_planejado',    p.kg_planejado,
                   'gerado',          p.gerado_em IS NOT NULL,
                   'gerado_em',       p.gerado_em,
                   'ativo',           public.oc_cobertura_ativa(p.ordem_compra_id),
                   'ordem_compra_id', p.ordem_compra_id,
                   'ordem_status',    oc.status_administrativo,
                   'ordem_identidade', oc.identidade_operacional
                 ) ORDER BY f.nome, p.id) AS linhas
            FROM public.necessidade_compra_planejamento p
            JOIN public.fornecedores f ON f.id = p.fornecedor_id
            LEFT JOIN public.ordem_compra oc ON oc.id = p.ordem_compra_id
           WHERE p.necessidade_id = n.id
        ) pl ON TRUE
       WHERE n.pedido_id = p_pedido_id
         AND n.legado = FALSE
    ) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'fornecedor_id', f.id, 'nome', f.nome, 'tipo', f.tipo
         ) ORDER BY f.nome), '[]'::jsonb)
    INTO v_fornecedores
    FROM public.fornecedores f
   WHERE f.tipo IN ('fio_algodao', 'fio_poliester');

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido_id', p_pedido_id,
    'necessidades', v_necessidades,
    'fornecedores', v_fornecedores
  );
END;
$$;

COMMENT ON FUNCTION public.obter_planejamento_compra_pedido(UUID) IS
  'db/99 + db/100: read model unico da tela Planejamento de compras. db/100 passou a somar apenas a cobertura ATIVA (oc_cobertura_ativa) em kg_planejado/kg_restante/kg_gerado, acrescentou kg_cancelado e marcou cada linha com `ativo` e o estado do documento que a consumiu, para que a historia cancelada continue visivel sem voltar a ocupar saldo.';

-- 10.2 Escritor linha-a-linha (caminho de compatibilidade de db/99).
CREATE OR REPLACE FUNCTION public.definir_planejamento_compra(
  p_necessidade_id  BIGINT,
  p_fornecedor_id   BIGINT,
  p_kg_planejado    NUMERIC,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_plan     public.necessidade_compra_planejamento%ROWTYPE;
  v_target   NUMERIC(12,3);
  v_previous NUMERIC(12,3) := 0;
  v_disponivel NUMERIC(12,3);
  v_total    NUMERIC(12,3);
  v_disc     TEXT;
  v_plan_id  BIGINT;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  v_target := p_kg_planejado;
  IF v_target IS NULL OR v_target < 0 OR round(v_target, 3) IS DISTINCT FROM v_target THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
      'erro', 'Quantidade deve usar NUMERIC(12,3), sem sinal negativo');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'necessidade_id', p_necessidade_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_planejado', to_char(v_target, 'FM9999999990.000')
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor
     AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = p_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.fornecedores f
     WHERE f.id = p_fornecedor_id
       AND ((v_need.material = 'algodao'   AND f.tipo = 'fio_algodao')
         OR (v_need.material = 'poliester' AND f.tipo = 'fio_poliester'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
      'erro', 'Fornecedor incompativel com o material');
  END IF;

  SELECT * INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id AND fornecedor_id = p_fornecedor_id
     AND gerado_em IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_previous := v_plan.kg_planejado;
    v_plan_id  := v_plan.id;
  END IF;

  -- db/100: o teto considera apenas a cobertura ATIVA.
  v_total := public.necessidade_kg_planejado_ativo(p_necessidade_id);

  v_disponivel := v_need.kg_necessario - (v_total - v_previous);
  IF v_target > v_disponivel THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'Planejamento excede o saldo da necessidade',
      'necessidade_id', v_need.id, 'disponivel', v_disponivel);
  END IF;

  IF v_target = 0 AND v_plan_id IS NOT NULL THEN
    DELETE FROM public.necessidade_compra_planejamento WHERE id = v_plan_id;
    v_disc := 'removido';
    v_plan_id := NULL;
  ELSIF v_target = 0 THEN
    v_disc := 'inalterado';
  ELSIF v_plan_id IS NULL THEN
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (p_necessidade_id, p_fornecedor_id, v_target, v_actor)
    RETURNING id INTO v_plan_id;
    v_disc := 'criado';
  ELSIF v_target <> v_previous THEN
    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_target, atualizado_em = now()
     WHERE id = v_plan_id;
    v_disc := CASE WHEN v_target > v_previous THEN 'aumentado' ELSE 'reduzido' END;
  ELSE
    v_disc := 'inalterado';
  END IF;

  v_total := public.necessidade_kg_planejado_ativo(p_necessidade_id);

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', v_disc,
    'planejamento_id', v_plan_id,
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_anterior', v_previous,
    'kg_final', v_target,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_planejado', v_total,
    'necessidade_kg_restante', (v_need.kg_necessario - v_total)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) IS
  'db/99 + db/100: escritor idempotente linha-a-linha da ETAPA 1, alvo ABSOLUTO por (necessidade, fornecedor); zero remove a linha. db/100 passou a medir o teto pela cobertura ATIVA. NAO cria ordem_compra, item, alocacao e nao consome numeracao.';

-- 10.3 Escritor ATOMICO do cartao.
CREATE OR REPLACE FUNCTION public.substituir_planejamento_compra_necessidade(
  p_necessidade_id  BIGINT,
  p_linhas          JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_linha    JSONB;
  v_forn     BIGINT;
  v_kg       NUMERIC(12,3);
  v_tipo     TEXT;
  v_gerado   NUMERIC(12,3);
  v_soma     NUMERIC(12,3) := 0;
  v_validas  JSONB := '[]'::jsonb;
  v_ids      BIGINT[] := ARRAY[]::BIGINT[];
  v_criadas  INTEGER := 0;
  v_atualizadas INTEGER := 0;
  v_removidas   INTEGER := 0;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_invalida',
      'erro', 'O conjunto de distribuicoes e invalido');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'substituicao',
    'necessidade_id', p_necessidade_id,
    'linhas', p_linhas
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  -- ---------- PASSO 1: VALIDAR O CONJUNTO INTEIRO, SEM ESCREVER ----------
  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    IF v_forn IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Informe o fornecedor de cada distribuicao');
    END IF;

    IF v_forn = ANY(v_ids) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_duplicado',
        'erro', 'O mesmo fornecedor aparece mais de uma vez nesta distribuicao',
        'fornecedor_id', v_forn);
    END IF;
    v_ids := v_ids || v_forn;

    v_kg := (v_linha->>'kg')::NUMERIC(12,3);
    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade deve ser positiva e usar NUMERIC(12,3)',
        'fornecedor_id', v_forn);
    END IF;

    SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = v_forn;
    IF v_tipo IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Fornecedor inexistente', 'fornecedor_id', v_forn);
    END IF;
    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material', 'fornecedor_id', v_forn);
    END IF;

    v_soma := v_soma + v_kg;
    v_validas := v_validas || jsonb_build_object('fornecedor_id', v_forn, 'kg', v_kg);
  END LOOP;

  -- db/100: o teto considera a historia ATIVA. Uma linha ja gerada cujo
  -- Pedido de Compra foi cancelado nao ocupa mais saldo.
  v_gerado := public.necessidade_kg_planejado_ativo_gerado(p_necessidade_id);

  IF (v_soma + v_gerado) > v_need.kg_necessario THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'A distribuicao excede a necessidade',
      'necessidade_id', v_need.id,
      'kg_necessario', v_need.kg_necessario,
      'kg_gerado', v_gerado,
      'kg_solicitado', v_soma,
      'disponivel', (v_need.kg_necessario - v_gerado)::NUMERIC(12,3));
  END IF;

  -- ---------- PASSO 2: APLICAR. Nao ha mais caminho de recusa. ----------
  WITH alvo AS (
    DELETE FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = p_necessidade_id
       AND gerado_em IS NULL
       AND NOT (fornecedor_id = ANY(v_ids))
    RETURNING id
  ) SELECT count(*) INTO v_removidas FROM alvo;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(v_validas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    v_kg   := (v_linha->>'kg')::NUMERIC(12,3);

    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_kg, atualizado_em = now()
     WHERE necessidade_id = p_necessidade_id
       AND fornecedor_id = v_forn
       AND gerado_em IS NULL;
    IF FOUND THEN
      v_atualizadas := v_atualizadas + 1;
    ELSE
      INSERT INTO public.necessidade_compra_planejamento(
        necessidade_id, fornecedor_id, kg_planejado, criado_por
      ) VALUES (p_necessidade_id, v_forn, v_kg, v_actor);
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'substituido',
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'linhas_criadas', v_criadas,
    'linhas_atualizadas', v_atualizadas,
    'linhas_removidas', v_removidas,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_gerado', v_gerado,
    'necessidade_kg_planejado', (v_soma + v_gerado)::NUMERIC(12,3),
    'necessidade_kg_restante', (v_need.kg_necessario - v_soma - v_gerado)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) IS
  'db/99 + db/100: dono ATOMICO do salvar de um cartao de necessidade. Valida o conjunto COMPLETO antes de qualquer escrita; uma recusa deixa o estado anterior intacto. db/100 passou a somar ao conjunto novo apenas a historia gerada ATIVA, de modo que o saldo de um Pedido de Compra cancelado volta a ser planejavel.';

-- 10.4 Planejamento rapido.
CREATE OR REPLACE FUNCTION public.aplicar_planejamento_rapido(
  p_pedido_id       UUID,
  p_fornecedor_id   BIGINT,
  p_itens           JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor   UUID;
  v_key     TEXT;
  v_payload JSONB;
  v_hash    TEXT;
  v_command public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_tipo    TEXT;
  v_item    JSONB;
  v_need    public.necessidade_compra_fio%ROWTYPE;
  v_kg      NUMERIC(12,3);
  v_total   NUMERIC(12,3);
  v_prev    NUMERIC(12,3);
  v_aplicados JSONB := '[]'::jsonb;
  v_count   INTEGER := 0;
  v_necessidades_prelim BIGINT[];
  v_result  JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'itens', p_itens
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = p_fornecedor_id;
  IF v_tipo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;

  IF (SELECT count(DISTINCT value->>'necessidade_id') FROM jsonb_array_elements(p_itens))
     <> jsonb_array_length(p_itens) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_duplicada',
      'erro', 'A mesma necessidade aparece mais de uma vez na selecao');
  END IF;

  -- PASSO 0 — TRAVAR AS NECESSIDADES EM ORDEM CANONICA DE id.
  SELECT array_agg(DISTINCT (value->>'necessidade_id')::BIGINT
                   ORDER BY (value->>'necessidade_id')::BIGINT)
    INTO v_necessidades_prelim
    FROM jsonb_array_elements(p_itens);

  IF v_necessidades_prelim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  PERFORM 1 FROM public.necessidade_compra_fio
   WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;

  -- PASSO 1 — VALIDAR TUDO. Nenhuma linha e escrita nesta passagem.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_need FROM public.necessidade_compra_fio
     WHERE id = (v_item->>'necessidade_id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
        'erro', 'Necessidade nao encontrada', 'necessidade_id', v_item->>'necessidade_id');
    END IF;

    IF v_need.pedido_id IS DISTINCT FROM p_pedido_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_incoerente',
        'erro', 'Necessidade nao pertence ao Pedido informado',
        'necessidade_id', v_need.id);
    END IF;
    IF v_need.legado OR v_need.kg_necessario <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
        'erro', 'Necessidade nao e nativa e planejavel', 'necessidade_id', v_need.id);
    END IF;

    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material da necessidade',
        'necessidade_id', v_need.id);
    END IF;

    -- db/100: saldo medido pela cobertura ATIVA.
    v_total := public.necessidade_kg_planejado_ativo(v_need.id);
    SELECT coalesce(kg_planejado, 0)::NUMERIC(12,3) INTO v_prev
      FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = v_need.id AND fornecedor_id = p_fornecedor_id
       AND gerado_em IS NULL;
    v_prev := coalesce(v_prev, 0);

    IF v_item ? 'kg' AND (v_item->>'kg') IS NOT NULL THEN
      v_kg := (v_item->>'kg')::NUMERIC(12,3);
    ELSE
      v_kg := (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3);
    END IF;

    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade invalida para a necessidade', 'necessidade_id', v_need.id);
    END IF;

    IF v_kg > (v_need.kg_necessario - (v_total - v_prev)) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
        'erro', 'Planejamento excede o saldo da necessidade',
        'necessidade_id', v_need.id,
        'disponivel', (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3));
    END IF;

    v_aplicados := v_aplicados || jsonb_build_object(
      'necessidade_id', v_need.id, 'kg_planejado', v_kg);
  END LOOP;

  -- PASSO 2 — APLICAR.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_aplicados)
  LOOP
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (
      (v_item->>'necessidade_id')::BIGINT, p_fornecedor_id,
      (v_item->>'kg_planejado')::NUMERIC(12,3), v_actor
    )
    ON CONFLICT (necessidade_id, fornecedor_id) WHERE gerado_em IS NULL DO UPDATE
      SET kg_planejado = EXCLUDED.kg_planejado, atualizado_em = now();
    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'necessidades_aplicadas', v_count,
    'aplicados', v_aplicados,
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) IS
  'db/99 + db/100: aplica UM fornecedor a varias necessidades compativeis do mesmo Pedido numa unica transacao. Item sem `kg` significa preencher com o saldo exato. db/100 mede esse saldo pela cobertura ATIVA, entao um Pedido de Compra cancelado devolve espaco tambem aqui. Nao cria Pedido de Compra.';

-- 10.5 Geracao — a revalidacao do teto sob trava passa a ser ativa.
CREATE OR REPLACE FUNCTION public.gerar_ordem_compra_do_planejamento(
  p_planejamento_ids BIGINT[],
  p_codigo           TEXT,
  p_sequencia_esperada INTEGER,
  p_idempotency_key  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor     UUID;
  v_key       TEXT;
  v_payload   JSONB;
  v_hash      TEXT;
  v_command   public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_codigo    TEXT;
  v_pedido    UUID;
  v_fornecedor BIGINT;
  v_numero    BIGINT;
  v_ano       SMALLINT;
  v_ultimo    INTEGER;
  v_proximo   INTEGER;
  v_seq       INTEGER;
  v_ordem_id  BIGINT;
  v_item_id   BIGINT;
  v_aloc_id   BIGINT;
  v_grupo     RECORD;
  v_plan      RECORD;
  v_itens     INTEGER := 0;
  v_alocacoes INTEGER := 0;
  v_distintos_fornecedor INTEGER;
  v_distintos_pedido     INTEGER;
  v_rascunho  BIGINT;
  v_necessidades_prelim BIGINT[];
  v_necessidades        BIGINT[];
  v_total     NUMERIC(12,3) := 0;
  v_identidade TEXT;
  v_result    JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode gerar Pedido de Compra');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_planejamento_ids IS NULL OR array_length(p_planejamento_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma distribuicao salva');
  END IF;

  v_codigo := btrim(coalesce(p_codigo, ''));
  IF v_codigo = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_invalido',
      'erro', 'Informe o numero do Pedido de Compra');
  END IF;
  IF length(v_codigo) > 40 OR v_codigo ~ '[[:cntrl:]]' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_invalido',
      'erro', 'O numero deve ter ate 40 caracteres, sem espaco no inicio ou fim e sem caractere de controle');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_generation_v1',
    'planejamento_ids', to_jsonb(p_planejamento_ids),
    'codigo', v_codigo
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_generation_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_generation_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  -- ORDEM CANONICA DE TRAVA: (1) necessidade, (2) planejamento.
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades_prelim
    FROM public.necessidade_compra_planejamento p
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_necessidades_prelim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  PERFORM 1 FROM public.necessidade_compra_fio
   WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;

  PERFORM 1 FROM public.necessidade_compra_planejamento
   WHERE id = ANY(p_planejamento_ids) ORDER BY id FOR UPDATE;

  -- ---------- REVALIDACAO AUTORITATIVA SOB AS DUAS TRAVAS ----------
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades
    FROM public.necessidade_compra_planejamento p
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_necessidades IS DISTINCT FROM v_necessidades_prelim THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  IF (SELECT count(*) FROM public.necessidade_compra_planejamento
       WHERE id = ANY(p_planejamento_ids)) <> array_length(p_planejamento_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE id = ANY(p_planejamento_ids) AND gerado_em IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_ja_gerado',
      'erro', 'Alguma distribuicao selecionada ja pertence a um Pedido de Compra. Recarregue a tela.');
  END IF;

  SELECT count(DISTINCT p.fornecedor_id), count(DISTINCT n.pedido_id),
         min(p.fornecedor_id), min(n.pedido_id::TEXT)::UUID
    INTO STRICT v_distintos_fornecedor, v_distintos_pedido, v_fornecedor, v_pedido
    FROM public.necessidade_compra_planejamento p
    JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_distintos_fornecedor <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_misturado',
      'erro', 'Um Pedido de Compra pertence a um unico fornecedor. Selecione somente distribuicoes do mesmo fornecedor.');
  END IF;
  IF v_distintos_pedido <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_misturado',
      'erro', 'Um Pedido de Compra pertence a um unico Pedido.');
  END IF;

  -- db/100: o teto revalidado sob a trava mede apenas a cobertura ATIVA.
  IF EXISTS (
    SELECT 1
      FROM public.necessidade_compra_fio n
     WHERE n.id = ANY(v_necessidades)
       AND public.necessidade_kg_planejado_ativo(n.id) > n.kg_necessario
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'A distribuicao excede a necessidade');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE codigo = v_codigo) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_duplicado',
      'erro', 'Ja existe um Pedido de Compra com este numero');
  END IF;

  SELECT id INTO v_rascunho
    FROM public.ordem_compra
   WHERE pedido_id = v_pedido
     AND fornecedor_id = v_fornecedor
     AND legado = FALSE
     AND status_administrativo = 'rascunho'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'rascunho_em_aberto',
      'erro', 'Ja existe um Pedido de Compra em rascunho para este fornecedor neste Pedido. Emita ou cancele aquele antes de gerar outro.',
      'ordem_compra_id', v_rascunho,
      'fornecedor_id', v_fornecedor);
  END IF;

  SELECT p.numero, public.pedido_ano_comercial(p.data_pedido, p.criado_em)
    INTO v_numero, v_ano FROM public.pedidos p WHERE p.id = v_pedido;
  IF v_numero IS NULL OR v_ano IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_sem_identidade',
      'erro', 'O Pedido ainda nao tem numero comercial e ano definidos');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_generation_v1|seq|' || v_pedido::TEXT, 0));

  SELECT n.ultimo_seq INTO v_ultimo
    FROM public.pedido_identidade_numeros n
   WHERE n.pedido_id = v_pedido AND n.escopo = 'OC';
  v_proximo := coalesce(v_ultimo, 0) + 1;

  IF p_sequencia_esperada IS DISTINCT FROM v_proximo THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sugestao_desatualizada',
      'erro', 'A numeracao deste Pedido avancou enquanto a confirmacao estava aberta. Confira o numero e confirme novamente.',
      'sequencia_esperada', p_sequencia_esperada,
      'sequencia_sugerida', v_proximo,
      'codigo_sugerido', 'OC-' || lpad(v_numero::TEXT, 3, '0')
                         || '-' || v_proximo::TEXT
                         || '-' || lpad((v_ano % 100)::TEXT, 2, '0'));
  END IF;

  v_seq := public.proximo_seq_identidade(v_pedido, 'OC');

  INSERT INTO public.ordem_compra(
    pedido_id, fornecedor_id, codigo,
    identidade_pedido_id, identidade_pedido_numero, identidade_pedido_ano, identidade_seq,
    status_administrativo, status_aceite, status_recebimento, legado
  ) VALUES (
    v_pedido, v_fornecedor, v_codigo,
    v_pedido, v_numero, v_ano, v_seq,
    'rascunho', 'nao_aplicavel', 'nao_recebido', FALSE
  ) RETURNING id, identidade_operacional INTO v_ordem_id, v_identidade;

  FOR v_grupo IN
    SELECT n.material, n.cor_id, n.cor_poliester,
           sum(p.kg_planejado)::NUMERIC(12,3) AS kg
      FROM public.necessidade_compra_planejamento p
      JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
     WHERE p.id = ANY(p_planejamento_ids)
     GROUP BY n.material, n.cor_id, n.cor_poliester
     ORDER BY n.material, n.cor_id, n.cor_poliester
  LOOP
    INSERT INTO public.ordem_compra_item(
      ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido
    ) VALUES (
      v_ordem_id, v_grupo.material, v_grupo.cor_id, v_grupo.cor_poliester,
      v_grupo.kg, 0
    ) RETURNING id INTO v_item_id;
    v_itens := v_itens + 1;
    v_total := v_total + v_grupo.kg;

    FOR v_plan IN
      SELECT p.id, p.kg_planejado, n.id AS necessidade_id, n.origem_tipo, n.op_id
        FROM public.necessidade_compra_planejamento p
        JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
       WHERE p.id = ANY(p_planejamento_ids)
         AND n.material = v_grupo.material
         AND n.cor_id IS NOT DISTINCT FROM v_grupo.cor_id
         AND n.cor_poliester IS NOT DISTINCT FROM v_grupo.cor_poliester
       ORDER BY p.id
    LOOP
      INSERT INTO public.ordem_compra_item_alocacao(
        item_id, necessidade_id, op_id, kg_alocado
      ) VALUES (
        v_item_id, v_plan.necessidade_id,
        CASE WHEN v_plan.origem_tipo = 'op' THEN v_plan.op_id ELSE NULL END,
        v_plan.kg_planejado
      ) RETURNING id INTO v_aloc_id;

      UPDATE public.necessidade_compra_planejamento
         SET alocacao_id = v_aloc_id,
             ordem_compra_id = v_ordem_id,
             gerado_em = now(),
             gerado_por = v_actor,
             atualizado_em = now()
       WHERE id = v_plan.id;

      v_alocacoes := v_alocacoes + 1;
    END LOOP;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'gerado',
    'ordem_compra_id', v_ordem_id,
    'identidade_operacional', v_identidade,
    'codigo_final', v_codigo,
    'sequencia_reservada', v_seq,
    'pedido_id', v_pedido,
    'fornecedor_id', v_fornecedor,
    'itens_criados', v_itens,
    'alocacoes_criadas', v_alocacoes,
    'kg_total', v_total
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_generation_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_duplicado',
      'erro', 'Ja existe um Pedido de Compra com este numero');
END;
$$;

COMMENT ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT) IS
  'db/99 + db/100: ETAPA 2. Cria em UMA transacao o Pedido de Compra, os itens agrupados por (material, cor) e uma alocacao por linha de planejamento. db/100 revalida o teto sob a trava pela cobertura ATIVA, de modo que um Pedido de Compra cancelado nao impeca a geracao do seu substituto. A reserva de sequencia canonica continua acontecendo exatamente uma vez e nunca retrocede.';

-- ============================================================
-- 11. Privilegios explicitos
-- ============================================================
-- Nada depende do grant-por-padrao do Supabase (a armadilha fechada por
-- db/93): cada funcao declara o seu estado final.

-- 11.1 Ajudantes internos e gatilhos: OWNER-ONLY.
ALTER FUNCTION public.oc_cobertura_ativa(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.necessidade_kg_planejado_ativo(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.necessidade_kg_planejado_ativo_gerado(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.necessidade_kg_alocado_ativo(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.oc_recalcular_cache_necessidade(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.oc_elegivel_cancelamento(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.oc_elegivel_exclusao(BIGINT) OWNER TO postgres;
ALTER FUNCTION public.trg_alocacao_kg_alocado_cache() OWNER TO postgres;
ALTER FUNCTION public.trg_planejamento_saldo_guard() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.oc_cobertura_ativa(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.necessidade_kg_planejado_ativo(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.necessidade_kg_planejado_ativo_gerado(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.necessidade_kg_alocado_ativo(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.oc_recalcular_cache_necessidade(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.oc_elegivel_cancelamento(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.oc_elegivel_exclusao(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_alocacao_kg_alocado_cache()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_planejamento_saldo_guard()
  FROM PUBLIC, anon, authenticated, service_role;

-- 11.2 RPCs publicas: EXECUTE somente para `authenticated`.
ALTER FUNCTION public.cancelar_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancelar_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_compra(BIGINT) TO authenticated;

ALTER FUNCTION public.excluir_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(BIGINT) TO authenticated;

ALTER FUNCTION public.obter_ordem_compra_admin(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_ordem_compra_admin(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_ordem_compra_admin(BIGINT) TO authenticated;

ALTER FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_historico_recebimento_ordem_compra(BIGINT) TO authenticated;

ALTER FUNCTION public.obter_planejamento_compra_pedido(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_planejamento_compra_pedido(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_planejamento_compra_pedido(UUID) TO authenticated;

ALTER FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT)
  TO authenticated;

ALTER FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT)
  TO authenticated;

ALTER FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT)
  TO authenticated;

ALTER FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT)
  TO authenticated;

-- ============================================================
-- 12. Invariantes pos-migracao (fail closed)
-- ============================================================
DO $inv$
DECLARE
  v_missing TEXT;
  v_drift   BIGINT;
BEGIN
  -- 12.1 O dono unico da cobertura existe e responde a forma esperada.
  IF to_regprocedure('public.oc_cobertura_ativa(bigint)') IS NULL THEN
    RAISE EXCEPTION 'db/100: oc_cobertura_ativa ausente';
  END IF;
  IF public.oc_cobertura_ativa(NULL) IS NOT TRUE THEN
    RAISE EXCEPTION 'db/100: planejamento sem documento precisa ser cobertura ativa';
  END IF;

  -- 12.2 Os dois donos de elegibilidade existem.
  IF to_regprocedure('public.oc_elegivel_cancelamento(bigint)') IS NULL
     OR to_regprocedure('public.oc_elegivel_exclusao(bigint)') IS NULL THEN
    RAISE EXCEPTION 'db/100: dono de elegibilidade ausente';
  END IF;

  -- 12.3 Nenhum ajudante interno e alcancavel por role cliente.
  SELECT string_agg(f, ', ') INTO v_missing FROM (
    SELECT f FROM (VALUES
      ('public.oc_cobertura_ativa(bigint)'),
      ('public.necessidade_kg_planejado_ativo(bigint)'),
      ('public.necessidade_kg_planejado_ativo_gerado(bigint)'),
      ('public.necessidade_kg_alocado_ativo(bigint)'),
      ('public.oc_recalcular_cache_necessidade(bigint)'),
      ('public.oc_elegivel_cancelamento(bigint)'),
      ('public.oc_elegivel_exclusao(bigint)')
    ) AS t(f)
    WHERE has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
       OR has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')
       OR has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE')
  ) s;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'db/100: ajudante interno alcancavel por role cliente: %', v_missing;
  END IF;

  -- 12.4 As RPCs publicas do dominio existem e sao executaveis pelo app.
  SELECT string_agg(f, ', ') INTO v_missing FROM (
    SELECT f FROM (VALUES
      ('public.cancelar_ordem_compra(bigint)'),
      ('public.excluir_ordem_compra(bigint)'),
      ('public.obter_ordem_compra_admin(bigint)'),
      ('public.obter_historico_recebimento_ordem_compra(bigint)'),
      ('public.obter_planejamento_compra_pedido(uuid)'),
      ('public.definir_planejamento_compra(bigint,bigint,numeric,text)'),
      ('public.substituir_planejamento_compra_necessidade(bigint,jsonb,text)'),
      ('public.aplicar_planejamento_rapido(uuid,bigint,jsonb,text)'),
      ('public.gerar_ordem_compra_do_planejamento(bigint[],text,integer,text)')
    ) AS t(f)
    WHERE to_regprocedure(f) IS NULL
       OR NOT has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
  ) s;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'db/100: RPC ausente ou sem grant para authenticated: %', v_missing;
  END IF;

  -- 12.5 anon nao alcanca nenhum escritor do ciclo de vida.
  IF has_function_privilege('anon', 'public.cancelar_ordem_compra(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.excluir_ordem_compra(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/100: anon nao pode executar os escritores do ciclo de vida';
  END IF;

  -- 12.6 Nenhuma role cliente ganhou DML direto na tabela de planejamento.
  IF has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'INSERT')
     OR has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'DELETE')
     OR has_table_privilege('anon', 'public.necessidade_compra_planejamento', 'SELECT') THEN
    RAISE EXCEPTION 'db/100: privilegio direto indevido na tabela de planejamento';
  END IF;

  -- 12.7 A sugestao de numero continua STABLE (nao escreve).
  IF (SELECT provolatile FROM pg_proc
       WHERE oid = to_regprocedure('public.sugerir_codigo_ordem_compra(uuid)')) <> 's' THEN
    RAISE EXCEPTION 'db/100: a sugestao de numero precisa continuar STABLE';
  END IF;

  -- 12.8 Os tres guardas do planejamento continuam instalados.
  IF (SELECT count(*) FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'necessidade_compra_planejamento'
        AND NOT t.tgisinternal) <> 3 THEN
    RAISE EXCEPTION 'db/100: guardas de integridade do planejamento incompletos';
  END IF;

  -- 12.9 O cutover NAO foi ativado por esta migracao.
  IF EXISTS (SELECT 1 FROM public.ordem_compra_cutover
              WHERE id = 1 AND (status <> 'legacy_active' OR read_authority <> 'flat')) THEN
    RAISE NOTICE 'db/100: ordem_compra_cutover nao esta em legacy_active/flat; esta migracao nao o alterou.';
  END IF;

  -- 12.10 ZERO DERIVA DE LINHA COMERCIAL. Esta migracao e DDL: o cache de
  -- toda necessidade tem de ja concordar com a definicao canonica, porque
  -- nenhuma ordem cancelada existia sob a definicao antiga (uma ordem so
  -- chegava a cancelada por db/68, que era so-rascunho, e o corpus
  -- comercial de producao estava vazio). Se alguma necessidade divergir, a
  -- migracao PARA em vez de mascarar a diferenca com uma correcao
  -- silenciosa de dado.
  SELECT count(*) INTO v_drift
    FROM public.necessidade_compra_fio n
   WHERE n.kg_alocado IS DISTINCT FROM public.necessidade_kg_alocado_ativo(n.id);
  IF v_drift > 0 THEN
    RAISE EXCEPTION
      'db/100 abortada: % necessidade(s) com kg_alocado divergente da cobertura ativa. Esta migracao nao muta linha comercial; reconcilie sob ordem propria.',
      v_drift;
  END IF;
END
$inv$;

COMMIT;

-- ============================================================
-- 13. Recarga do cache de schema do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
