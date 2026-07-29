// =====================================================================
// === PEDIDO DRAFT — SHARED OWNER =====================================
// Dono UNICO da colecao LOCAL de itens de um Pedido: identidade, conversao
// a partir de linhas persistidas, item em branco, totais, validacao,
// ordenacao estavel, deteccao de mudanca e o payload de itens da RPC
// `salvar_pedido_admin`.
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
//
// PURO POR CONTRATO — este modulo nao renderiza tela, nao chama
// `window.supa` e nao decide status/lifecycle. Ele so conhece a FORMA
// local do item: { uid, itemId, modeloId, metros, largura, observacao }.
// `uid` e a identidade de UI (novoUid()); `itemId` e o UUID real de
// `pedido_itens.id`, ou `null` para um item ainda nao salvo.
//
// A mesma forma local e consumida SEM adaptacao por:
//   - js/screens/pedido-item-row-editor.js (buildRow espera
//     { uid, tipo, modeloId, metros, observacao } — `tipo` e derivado
//     dentro do proprio buildRow a partir de modeloId);
//   - js/pedido-priority.js (painelDeCriacao/projetarItensLocais esperam
//     { uid, modeloId, metros } em `state.itens`).
// Por isso este arquivo NAO reimplementa uma projecao separada para o
// editor de linha nem para o dono de prioridade: a FORMA do item local
// e o unico contrato de projecao necessario, e um segundo formato
// paralelo so criaria dois donos do mesmo dado.
//
// PAYLOAD DA RPC — contrato fechado (EXECUTION ORDER sec.8.1): apenas
// pedido_item_id, modelo_id, metros, observacao, ordem. O servidor
// (public.pedido_itens_payload_normalizar) IGNORA o valor de `ordem`
// enviado e reatribui pela POSICAO do array — a ordem enviada e apenas
// documentacional; a autoridade e a posicao.
//
// Carregar via <script src="js/pedido-draft.js?v=..."></script> no <head>,
// DEPOIS de js/pedido-priority.js e ANTES de qualquer consumidor em
// js/screens/ (pedido-edit.js, pedido-form.js).
// =====================================================================

(function (window) {
  'use strict';

  function novoUid() {
    return 'i_' + Math.random().toString(36).slice(2, 10);
  }

  // Item local em branco, ou pre-preenchido pelos DOIS caminhos de entrada
  // (modal detalhado e linha rapida) — ambos entregam a MESMA forma
  // { tipo, modeloId, metros, observacao }.
  function novoItem(dados) {
    var d = dados || {};
    return {
      uid: novoUid(),
      itemId: null,
      modeloId: d.modeloId || '',
      metros: d.metros == null ? '' : String(d.metros),
      largura: null,
      observacao: d.observacao || '',
    };
  }

  // Converte linhas persistidas de `pedido_itens` (id, modelo_id, metros,
  // largura, observacao, ordem) na forma local, ja ordenadas por `ordem`.
  function fromPersisted(rows) {
    var list = Array.isArray(rows) ? rows.slice() : [];
    list.sort(function (a, b) {
      var ao = Number(a && a.ordem), bo = Number(b && b.ordem);
      if (!Number.isFinite(ao)) ao = Number.MAX_SAFE_INTEGER;
      if (!Number.isFinite(bo)) bo = Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a && a.id).localeCompare(String(b && b.id));
    });
    return list.map(function (row) {
      return {
        uid: novoUid(),
        itemId: row.id,
        modeloId: row.modelo_id != null ? String(row.modelo_id) : '',
        metros: row.metros != null ? String(row.metros) : '',
        largura: row.largura != null ? row.largura : null,
        observacao: row.observacao || '',
      };
    });
  }

  function addItem(items, dados) {
    return (items || []).concat([novoItem(dados)]);
  }

  function removeItem(items, uid) {
    return (items || []).filter(function (it) { return it.uid !== uid; });
  }

  function totalMetros(items) {
    var total = 0;
    (items || []).forEach(function (it) {
      var v = parseFloat(it.metros);
      if (Number.isFinite(v) && v > 0) total += v;
    });
    return total;
  }

  function totalMetrosLabel(items) {
    var total = totalMetros(items);
    return total > 0
      ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
      : '0,00 m';
  }

  function totals(items) {
    return {
      count: (items || []).length,
      metros: totalMetros(items),
      metrosLabel: totalMetrosLabel(items),
    };
  }

  // Validacao cliente-side, espelhando (nao substituindo) as recusas do
  // servidor: ao menos 1 item; cada item com modelo e metros > 0.
  function validate(items) {
    var list = items || [];
    var errors = [];
    if (list.length === 0) {
      errors.push({ index: -1, message: 'O pedido deve manter ao menos um item.' });
      return { valid: false, errors: errors };
    }
    list.forEach(function (it, i) {
      if (!it.modeloId) {
        errors.push({ index: i, message: 'Item ' + (i + 1) + ': selecione o tipo e o modelo.' });
        return;
      }
      var m = Number(it.metros);
      if (!Number.isFinite(m) || m <= 0) {
        errors.push({ index: i, message: 'Item ' + (i + 1) + ': metros deve ser > 0.' });
      }
    });
    return { valid: errors.length === 0, errors: errors };
  }

  // Payload EXATO da RPC (EXECUTION ORDER sec.8.1): a posicao no array e a
  // ordem final; `ordem` viaja apenas como documentacao.
  function toRpcPayload(items) {
    return (items || []).map(function (it, index) {
      return {
        pedido_item_id: it.itemId || null,
        modelo_id: Number(it.modeloId),
        metros: Number(it.metros),
        observacao: it.observacao ? it.observacao : null,
        ordem: index,
      };
    });
  }

  // Mudanca ESTRUTURAL — espelha public.pedido_itens_payload_e_estrutural:
  // insercao (item sem itemId), troca de modelo_id ou metros num item
  // existente, ou remocao (contagem enviada != contagem persistida).
  // Reordenacao pura e mudanca de observacao NAO sao estruturais.
  function isStructuralChange(current, baseline) {
    var cur = current || [];
    var base = baseline || [];
    var baseById = {};
    base.forEach(function (it) { baseById[it.itemId] = it; });

    for (var i = 0; i < cur.length; i++) {
      var it = cur[i];
      if (!it.itemId) return true; // insercao
      var was = baseById[it.itemId];
      if (!was) return true; // defesa: id desconhecido, trata como estrutural
      if (String(was.modeloId) !== String(it.modeloId)) return true;
      if (Number(was.metros) !== Number(it.metros)) return true;
    }
    if (cur.length !== base.length) return true; // remocao
    return false;
  }

  // Mudanca de QUALQUER natureza na colecao (para a decisao p_itens=NULL):
  // ordem, contagem, ou qualquer campo de qualquer item.
  //
  // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: `observacao` SAIU desta
  // comparacao POR PADRAO. A administrativa nao cria nem edita mais
  // item.observacao (retirado da linha e do modal — ver
  // js/screens/pedido-item-row-editor.js e js/screens/pedido-item-modal.js),
  // entao ela nunca pode mais ser o motivo de p_itens ser enviado ali. O campo
  // continua no formato local, em fromPersisted() e em toRpcPayload() — so a
  // comparacao padrao de "mudou?" parou de olhar para ele.
  //
  // PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1: terceiro parametro OPCIONAL
  // `options.compareObservacao`. item.observacao CONTINUA editavel pelo
  // Cliente (U4; U13.2 amendment secao L preserva isso — a retirada foi
  // SOMENTE administrativa), entao o editor do Cliente passa
  // `{ compareObservacao: true }` para que uma mudanca de observacao de item
  // dispare p_itens. Chamadores existentes (administrativos) nunca passam
  // este parametro e mantem o comportamento EXATO de sempre.
  function isCollectionChanged(current, baseline, options) {
    var cur = current || [];
    var base = baseline || [];
    var opts = options || {};
    if (cur.length !== base.length) return true;
    for (var i = 0; i < cur.length; i++) {
      var a = cur[i];
      var b = base[i];
      if ((a.itemId || null) !== (b.itemId || null)) return true;
      if (String(a.modeloId) !== String(b.modeloId)) return true;
      if (Number(a.metros) !== Number(b.metros)) return true;
      if (opts.compareObservacao && (a.observacao || '') !== (b.observacao || '')) return true;
    }
    return false;
  }

  // Formatadores LOCAIS e minimos para a mencao — deliberadamente NAO
  // reaproveitam corResumo/larguraStr de js/screens/pedido-item-row-editor.js
  // porque o formato exigido pelo contrato ratificado usa "COR1/COR2" sem
  // espaco ao redor da barra, enquanto corResumo() usa "COR1 / COR2" (com
  // espaco) para a celula da tabela. Sao dois formatos distintos por
  // contrato; duplicar aqui evita acoplar o formato de mencao ao formato de
  // exibicao de celula, que pode mudar por razoes visuais independentes.
  function corNomeParaMencao(cor) {
    return cor && cor.nome ? cor.nome : '-';
  }

  function larguraParaMencao(modelo) {
    if (!modelo) return '-';
    return typeof modelo.largura === 'number'
      ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
      : String(modelo.largura || '-');
  }

  function modeloPorId(modelos, id) {
    var list = Array.isArray(modelos) ? modelos : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  // buildItemMention — PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 sec.G. Dono
  // UNICO e compartilhado do texto de mencao inserido em Observacoes
  // gerais; nem js/screens/pedido-form.js nem js/screens/pedido-edit.js
  // reimplementam esta formatacao.
  //
  //   item     entrada local { modeloId, ... }. Funciona para item ainda
  //            NAO salvo (itemId null) — a mencao usa apenas estado local,
  //            nunca um UUID de banco.
  //   modelos  lista unica ja carregada (mesma projecao consumida pela
  //            linha e pelo modal).
  //   index    posicao 0-based ATUAL do item no array local. A posicao
  //            exibida ("Item N") e sempre a do momento do clique — nao ha
  //            estado de posicao guardado a parte.
  //
  // Formato exato: "@Item {N} — {modelo} · {cor1}/{cor2} · {largura}: "
  // (ex.: "@Item 3 — Noite · KRAFT/CRU · 2,10 m: "). NUNCA inclui uid,
  // itemId, pedido_item_id, metragem ou qualquer identificador de banco.
  // Devolve `null` — nunca uma mencao vazia ou incompleta — quando o
  // modelo nao pode ser resolvido ou quando a posicao e desconhecida;
  // o chamador nao insere nada nesse caso (EXECUTION ORDER PART 4: "nao
  // permitir referencia vazia ou sem sentido").
  function buildItemMention(item, modelos, index) {
    if (!item) return null;
    var posicao = (typeof index === 'number' && index >= 0) ? (index + 1) : null;
    if (posicao == null) return null;
    var modelo = modeloPorId(modelos, item.modeloId);
    if (!modelo) return null;
    var nomeModelo = modelo.nome == null ? '' : String(modelo.nome);
    var cor1 = corNomeParaMencao(modelo.cor_1);
    var cor2 = corNomeParaMencao(modelo.cor_2);
    var largura = larguraParaMencao(modelo);
    return '@Item ' + posicao + ' — ' + nomeModelo + ' · ' + cor1 + '/' + cor2 + ' · ' + largura + ': ';
  }

  // computeMentionInsertion — PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 sec.H.
  // Dono UNICO e PURO da aritmetica de insercao: nem js/screens/pedido-form.js
  // nem js/screens/pedido-edit.js reimplementam esta logica separadamente —
  // cada tela so aplica o resultado a um <textarea> real e toca o path normal
  // de input. Nao toca DOM, nao decide foco: recebe o estado JA OBSERVADO
  // pelo chamador e devolve o novo valor e a posicao final do caret.
  //
  //   currentValue    valor atual do campo Observacoes gerais.
  //   selectionStart  textarea.selectionStart no momento do clique.
  //   isFocused       true somente se o campo estava com foco ativo no
  //                   momento do clique — o sinal que distingue "inserir no
  //                   caret" de "acrescentar ao final" (EXECUTION ORDER
  //                   PART 5, regras 1-2). Sem foco ativo, selectionStart
  //                   pode ser residual/nao-confiavel; o caso seguro e
  //                   sempre acrescentar ao final.
  //   mentionText     texto pronto de buildItemMention(); nunca vazio.
  //
  // Regra 3 (newline): so quando a insercao NAO e no inicio do texto E o
  // caractere anterior nao e ja uma quebra de linha. Regra 4: o texto antes
  // e depois do ponto de insercao e sempre preservado — nada e cortado,
  // inclusive uma selecao existente (o chamador nunca troca o valor por
  // `after = value.slice(selectionEnd)`; usa sempre `selectionStart`).
  function computeMentionInsertion(currentValue, selectionStart, isFocused, mentionText) {
    var current = currentValue == null ? '' : String(currentValue);
    var text = mentionText == null ? '' : String(mentionText);
    var caretPos = (isFocused && typeof selectionStart === 'number' && selectionStart >= 0)
      ? selectionStart
      : current.length;
    var before = current.slice(0, caretPos);
    var after = current.slice(caretPos);
    var needsNewline = before.length > 0 && before.charAt(before.length - 1) !== '\n';
    var insertText = (needsNewline ? '\n' : '') + text;
    return {
      value: before + insertText + after,
      caret: before.length + insertText.length,
    };
  }

  window.RAVATEX_PEDIDO_DRAFT = {
    novoUid: novoUid,
    novoItem: novoItem,
    fromPersisted: fromPersisted,
    addItem: addItem,
    removeItem: removeItem,
    totals: totals,
    totalMetrosLabel: totalMetrosLabel,
    validate: validate,
    toRpcPayload: toRpcPayload,
    isStructuralChange: isStructuralChange,
    isCollectionChanged: isCollectionChanged,
    buildItemMention: buildItemMention,
    computeMentionInsertion: computeMentionInsertion,
  };
})(window);
