// =====================================================================
// === SCREENS: OP RECALCULO PURE HELPERS (Seam A) =====================
// Helpers puros de cálculo de recalculo de OP, extraídos do
// <script> inline de index.html, de dentro de screenNovaOP.
// Concentra:
//
//   - maxMetrosItem(item, modelosById, parametrosByLargura, ordens)
//   - normalizarChaveSaldo(tipo, corId, corPoliester)
//
// Carregar via <script src="js/screens/op-recalculo.js"></script>
// no <head>, DEPOIS de js/screens/painel.js e ANTES de jspdf +
// script inline principal.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.larguraKey (js/calculo-op.js) — usado por maxMetrosItem
//
// NÃO depende de: window.supa, window.toast, window.modal,
// window.confirmDialog, window.CURRENT_USER, window.navigate.
// NÃO faz insert / update / delete / rpc — apenas helpers puros.
//
// Compatibilidade: window.maxMetrosItem e window.normalizarChaveSaldo
// seguem disponíveis para os call-sites do inline (prefixados com
// `window.`).
// =====================================================================

(function (window) {
  'use strict';

  function maxMetrosItem(item, modelosById, parametrosByLargura, ordens) {
    const modelo = modelosById[item.modelo_id];
    const p = parametrosByLargura[window.larguraKey(modelo.largura)];
    const rAlg = p.algodao_por_ml * p.valor_x;
    const rPol = p.poliester_por_ml * p.valor_x;
    let cap = Infinity;
    for (const cor of [modelo.cor_1, modelo.cor_2]) {
      const ord = ordens.find(o => o.tipo === 'algodao' && o.cor_id === cor.id);
      if (ord && rAlg > 0) cap = Math.min(cap, Number(ord.kg_recebido) / rAlg);
    }
    for (const corP of ['PRETO', 'BRANCO']) {
      const ord = ordens.find(o => o.tipo === 'poliester' && o.cor_poliester === corP);
      if (ord && rPol > 0) cap = Math.min(cap, Number(ord.kg_recebido) / rPol);
    }
    return Number.isFinite(cap) ? Math.floor(cap) : 0;
  }

  function normalizarChaveSaldo(tipo, corId, corPoliester) {
    if (tipo === 'poliester') {
      return {
        is: { cor_id: null },
        eq: { tipo, cor_poliester: corPoliester },
      };
    }
    return {
      eq: { tipo, cor_id: corId },
    };
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opRecalculo = {
    maxMetrosItem,
    normalizarChaveSaldo,
  };

  window.maxMetrosItem = maxMetrosItem;
  window.normalizarChaveSaldo = normalizarChaveSaldo;
})(window);
