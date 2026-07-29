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
  function isCollectionChanged(current, baseline) {
    var cur = current || [];
    var base = baseline || [];
    if (cur.length !== base.length) return true;
    for (var i = 0; i < cur.length; i++) {
      var a = cur[i];
      var b = base[i];
      if ((a.itemId || null) !== (b.itemId || null)) return true;
      if (String(a.modeloId) !== String(b.modeloId)) return true;
      if (Number(a.metros) !== Number(b.metros)) return true;
      if ((a.observacao || '') !== (b.observacao || '')) return true;
    }
    return false;
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
  };
})(window);
