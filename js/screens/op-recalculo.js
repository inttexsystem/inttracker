// =====================================================================
// === SCREENS: OP — DISPONIBILIDADE NATIVA + ESCRITORES ATÔMICOS ======
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.A, §9.9.C, §9.9.D).
//
// Este módulo é um CLIENTE FINO dos escritores canônicos do servidor.
// Ele não decide teto, não decide transição de status e não faz DML.
//
//   - carregarDisponibilidadeOP({ opId })  -> rpc oc_disponibilidade_op
//   - maxMetrosItem(item, modelosById, parametrosByLargura, disponibilidade)
//   - salvarDistribuicaoOP({ opId, baseAjusteRevisao, itens })
//                                          -> rpc salvar_ajuste_producao_op
//   - iniciarProducaoOP({ opId, baseAjusteRevisao })
//                                          -> rpc iniciar_producao_op
//
// O QUE FOI APOSENTADO EM P2-A, E POR QUÊ
// ---------------------------------------
// `aplicarRecalculoOP`, `snapshotSaldoEIniciarProducao` e
// `normalizarChaveSaldo` foram REMOVIDOS. Não eram apenas código morto: seu
// corpo inteiro era feito exatamente dos mecanismos que o P2-A elimina —
//   * laço de UPDATE direto item a item em `op_itens`;
//   * semântica de sucesso PARCIAL (`partial: true` no meio do laço), que
//     deixava metade dos itens gravados quando um write falhava;
//   * INSERT direto em `saldo_fios_op` e leitura/escrita direta do
//     totalizador `saldo_fios`;
//   * `UPDATE ops SET status = 'em_producao'` pelo cliente.
// Hoje o servidor é o dono: `salvar_ajuste_producao_op` valida o payload
// COMPLETO contra os tetos por eixo ANTES de qualquer escrita, e
// `iniciar_producao_op` é o ÚNICO escritor do snapshot `saldo_fios_op` e da
// transição de status. Não há mais estado parcial para o cliente relatar.
//
// `clearFenceError` também saiu: existia só para traduzir o erro da guarda de
// mutação protegida do db/75 sobre saldo_fios/saldo_fios_op, e este arquivo
// não escreve mais nessas tabelas.
//
// TETO PRODUTIVO
// --------------
// `maxMetrosItem` lê APENAS a projeção nativa `oc_disponibilidade_op`. Não lê
// mais `ordens_compra_fio`: uma linha de Ordem de Compra plana é um documento,
// não um teto produtivo, e o teto nativo já é consciente de origem (algodão é
// da OP; poliéster é um pool do Pedido, descontadas as reservas das OUTRAS
// OPs — §9.9.A.2/A.3). O teto do servidor continua sendo o autoritativo: o que
// se faz aqui é capar o slider, nunca autorizar.
//
// Carregar via <script src="js/screens/op-recalculo.js"></script> no <head>,
// DEPOIS de js/screens/painel.js e ANTES de jspdf + script inline principal.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.larguraKey (js/calculo-op.js) — usado por maxMetrosItem
//   - window.supa (js/supabase-client.js) — usado pelos três chamadores de RPC
//
// NÃO depende de: window.toast, window.modal, window.confirmDialog,
// window.CURRENT_USER, window.navigate, window.saving.
// =====================================================================

(function (window) {
  'use strict';

  // Códigos de recusa que o servidor devolve dentro de `data` (a função
  // retorna JSONB `{ok:false, codigo}` em vez de levantar exceção, para não
  // abortar a transação do chamador). São contrato, não texto de tela.
  var CODIGO_REVISAO_DESATUALIZADA = 'AJUSTE_REVISAO_DESATUALIZADA';

  // Normaliza as DUAS formas de falha de uma RPC canônica numa só:
  //   * falha de transporte/permissão  -> { error } do supabase-js
  //   * recusa de negócio              -> data.ok === false, com data.codigo
  // Sucesso devolve error:null e codigo:null. Nenhum caminho devolve
  // `partial`: as RPCs do P2 são atômicas por construção.
  function normalizarRespostaRpc(res) {
    if (res && res.error) {
      return {
        error: res.error,
        codigo: res.error.code === '42501' ? 'sem_permissao' : null,
        data: null,
      };
    }
    var data = res ? res.data : null;
    if (data && data.ok === false) {
      return {
        error: Object.assign(
          new Error(data.detalhe || data.codigo || 'Operação recusada pelo servidor'),
          { codigo: data.codigo }
        ),
        codigo: data.codigo || null,
        data: data,
      };
    }
    return { error: null, codigo: null, data: data };
  }

  // Projeção nativa de disponibilidade da OP (§9.9.A). Uma linha por eixo
  // (origem_tipo, material, cor_id, cor_poliester), com kg_disponivel já
  // calculado pelo servidor. RETURNS TABLE => data é um array.
  async function carregarDisponibilidadeOP({ opId }) {
    var res = await window.supa.rpc('oc_disponibilidade_op', { p_op_id: opId });
    if (res && res.error) return { data: null, error: res.error };
    return { data: Array.isArray(res && res.data) ? res.data : [], error: null };
  }

  // Localiza a linha nativa de um eixo. Algodão casa por cor_id; poliéster por
  // cor_poliester (cor_id é NULL). A comparação de cor_id é numérica dos dois
  // lados: o PostgREST devolve BIGINT como número ou string conforme o caso.
  function linhaDisponibilidade(disponibilidade, material, corId, corPoliester) {
    var linhas = disponibilidade || [];
    for (var i = 0; i < linhas.length; i++) {
      var d = linhas[i];
      if (d.material !== material) continue;
      if (material === 'algodao') {
        if (corId != null && Number(d.cor_id) === Number(corId)) return d;
      } else if (d.cor_poliester === corPoliester) {
        return d;
      }
    }
    return null;
  }

  // Limite individual de metros de um item assumindo os demais em zero: para
  // cada cor que o item consome, kg_disponivel daquela cor / kg por metro.
  //
  // `disponibilidade` são as linhas de oc_disponibilidade_op. NÃO se calcula
  // teto aqui: kg_disponivel já é o teto do servidor (dono único
  // public._oc_teto_disponivel). O que se faz é converter kg em metros pela
  // receita e devolver o eixo mais escasso.
  //
  // DUAS RESPOSTAS DIFERENTES, E A DIFERENÇA IMPORTA
  // (RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1-C1):
  //   * NÚMERO  — existe pelo menos um eixo aplicável a este item, e o
  //               servidor VAI limitar por ele. Zero é uma resposta legítima:
  //               significa "não há material", não "não sei".
  //   * null    — NENHUM eixo de oc_disponibilidade_op se aplica a este item
  //               (projeção vazia, item sem necessidade nativa, ou receita com
  //               consumo zero). O servidor também não impõe teto nesse caso:
  //               salvar_ajuste_producao_op percorre exatamente os eixos de
  //               _oc_disponibilidade_linhas, e sem eixos não há recusa.
  //
  // Antes as duas respostas eram o MESMO 0, e o chamador compensava com um
  // piso `Math.max(..., metros_pedidos)`. Esse piso transformava
  // `metros_pedidos` em disponibilidade — exatamente o que a decisão aceita em
  // P2A-OBS-6 proíbe — e escondia a falta: com 80% do fio recebido o slider
  // continuava anunciando a metragem original como "máx individual". Devolver
  // null separa "sem teto" de "teto zero" e dispensa o piso.
  function maxMetrosItem(item, modelosById, parametrosByLargura, disponibilidade) {
    const modelo = modelosById[item.modelo_id];
    const p = parametrosByLargura[window.larguraKey(modelo.largura)];
    const rAlg = p.algodao_por_ml * p.valor_x;
    const rPol = p.poliester_por_ml * p.valor_x;
    let cap = Infinity;

    // MULTIPLICIDADE DA COR — a receita cobra por OCORRÊNCIA, não por cor
    // distinta. `calcularFiosOP` soma kgAlg uma vez para cada entrada de
    // [cor_1, cor_2], e o servidor faz exatamente o mesmo:
    // _oc_reserva_ativa e _op_reserva_proposta multiplicam por
    // ((cor_1_id = cor) + (cor_2_id = cor)). Um modelo com cor_1_id =
    // cor_2_id consome, portanto, o DOBRO naquela cor.
    //
    // Percorrer [cor_1, cor_2] tomando o mínimo de kg_disponivel/rAlg avaliava
    // o MESMO eixo duas vezes com a taxa SIMPLES e devolvia o dobro dos metros
    // realmente possíveis. Agrupar por cor e dividir pela taxa PONDERADA é o
    // que faz esta conversão espelhar a autoridade do servidor em vez de
    // divergir dela.
    const ocorrenciasPorCor = new Map();
    for (const cor of [modelo.cor_1, modelo.cor_2]) {
      if (!cor || cor.id == null) continue;
      ocorrenciasPorCor.set(cor.id, (ocorrenciasPorCor.get(cor.id) || 0) + 1);
    }
    for (const [corId, ocorrencias] of ocorrenciasPorCor) {
      const d = linhaDisponibilidade(disponibilidade, 'algodao', corId, null);
      const taxa = rAlg * ocorrencias;
      if (d && taxa > 0) cap = Math.min(cap, Number(d.kg_disponivel) / taxa);
    }

    // Poliéster é creditado uma vez em PRETO e uma vez em BRANCO, sempre —
    // são eixos distintos, sem multiplicidade a ponderar.
    for (const corP of ['PRETO', 'BRANCO']) {
      const d = linhaDisponibilidade(disponibilidade, 'poliester', null, corP);
      if (d && rPol > 0) cap = Math.min(cap, Number(d.kg_disponivel) / rPol);
    }
    return Number.isFinite(cap) ? Math.floor(cap) : null;
  }

  // "Salvar distribuição" — UMA chamada, UM payload ABSOLUTO e COMPLETO.
  //
  // `itens` tem de conter TODOS os op_itens da OP, cada um exatamente uma vez;
  // o servidor recusa com AJUSTE_PAYLOAD_INCOMPLETO caso contrário. Um item
  // com metros_ajustados null LIMPA o ajuste daquele item — a limpeza viaja
  // pelo MESMO escritor atômico, nunca por um delete/update avulso.
  //
  // `baseAjusteRevisao` é o ops.ajuste_revisao lido no carregamento. O
  // servidor recarrega a OP DENTRO do lock e só então compara; divergência
  // devolve AJUSTE_REVISAO_DESATUALIZADA e não escreve nada.
  //   itens: [{ op_item_id, metros_ajustados|null }]
  async function salvarDistribuicaoOP({ opId, baseAjusteRevisao, itens }) {
    var payload = (itens || []).map(function (it) {
      return {
        op_item_id: it.op_item_id,
        metros_ajustados: it.metros_ajustados == null ? null : Number(it.metros_ajustados),
      };
    });
    var out = normalizarRespostaRpc(await window.supa.rpc('salvar_ajuste_producao_op', {
      p_op_id: opId,
      p_base_ajuste_rev: baseAjusteRevisao,
      p_itens: payload,
    }));
    return {
      error: out.error,
      codigo: out.codigo,
      revisaoDesatualizada: out.codigo === CODIGO_REVISAO_DESATUALIZADA,
      ajusteRevisao: out.data ? out.data.ajuste_revisao : null,
      itensAplicados: out.data ? out.data.itens_aplicados : null,
    };
  }

  // "Iniciar produção" — ÚNICO ponto de início, e ele é do servidor.
  //
  // O servidor exige status 'aberta' (uma OP 'simulada' NUNCA é aberta em
  // silêncio: abrir continua sendo ação explícita do operador por
  // alterar_status_op), prova que todo item tem ajuste salvo, REVALIDA a
  // disponibilidade, grava o snapshot saldo_fios_op, transiciona a OP e
  // recalcula o Pedido — tudo numa transação. Devolve a rota e o rótulo da
  // próxima ação, que a tela consome em vez de inventar destino.
  async function iniciarProducaoOP({ opId, baseAjusteRevisao }) {
    var out = normalizarRespostaRpc(await window.supa.rpc('iniciar_producao_op', {
      p_op_id: opId,
      p_base_ajuste_rev: baseAjusteRevisao,
    }));
    return {
      error: out.error,
      codigo: out.codigo,
      revisaoDesatualizada: out.codigo === CODIGO_REVISAO_DESATUALIZADA,
      ajusteRevisao: out.data ? out.data.ajuste_revisao : null,
      proximaAcao: (out.data && out.data.proxima_acao) ? out.data.proxima_acao : null,
    };
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opRecalculo = {
    carregarDisponibilidadeOP,
    maxMetrosItem,
    salvarDistribuicaoOP,
    iniciarProducaoOP,
  };

  window.carregarDisponibilidadeOP = carregarDisponibilidadeOP;
  window.maxMetrosItem = maxMetrosItem;
  window.salvarDistribuicaoOP = salvarDistribuicaoOP;
  window.iniciarProducaoOP = iniciarProducaoOP;
})(window);
