// =====================================================================
// === SCREENS: PEDIDO ROUTE SECTIONS UI ===============================
// PHASE-MANTA-B2B. Apresentacao das secoes por rota do Pedido: uma
// secao por rota aplicavel, cada uma com o seu proprio stepper.
//
// Extraido de js/screens/pedido-detail-render.js — que ja excede o
// limite excepcional de CODE_HEALTH_RULES sec.7 e nao pode crescer
// (R-6: PHASE-MANTA-B2B nao pode aumentar CODE-HEALTH-AUDIT-18-R1).
// A responsabilidade tambem e coesa aqui: a forma da rota vive junto
// da derivacao da rota.
//
// Os nos de estagio e de conector continuam sendo construidos pelo
// modulo de render (que detem o vocabulario visual do Pedido) e sao
// recebidos por injecao — este modulo so decide o ARRANJO por rota.
//
// Sem `window.supa` e sem escrita: apenas DOM.
// =====================================================================

(function (window) {
  'use strict';

  function routeChipStyle(route) {
    return route === 'manta'
      ? 'background:var(--rv-stage-tecelagem-bg);color:var(--rv-stage-tecelagem);'
      : 'background:var(--rv-pill-info-bg);color:var(--rv-accent-blue);';
  }

  function buildSectionHeader(section) {
    var stageLabels = (section.stepper || []).map(function (stage) { return stage.label; }).join(' → ');
    return window.el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;' },
      window.el('span', {
        style: 'display:inline-flex;align-items:center;border-radius:var(--rv-radius);padding:3px 11px;font-size:11.5px;font-weight:700;'
          + routeChipStyle(section.route),
      }, 'Rota ' + (section.label || '—')),
      window.el('span', {
        style: 'font-size:11.5px;color:var(--rv-text-tertiary);font-weight:600;letter-spacing:.02em;',
      }, stageLabels));
  }

  // A grade acompanha o numero real de estagios da rota: 5 estagios /
  // 4 conectores no Tapete, 4 estagios / 3 conectores na Manta. Nenhuma
  // rota herda uma grade fixa de 5 colunas.
  function buildSectionGrid(section, ctx) {
    var stepper = section.stepper || [];
    var children = [];
    var columns = [];
    stepper.forEach(function (stage, index) {
      children.push(ctx.buildStageNode(stage, index));
      columns.push('1fr');
      if (index < stepper.length - 1) {
        children.push(ctx.buildTransferButton(stage));
        columns.push('104px');
      }
    });
    // `data-rv-route-stepper` e o ancoradouro do breakpoint: abaixo de
    // 1024px a grade vira uma coluna e o stepper empilha, para que nenhum
    // no de rota seja cortado ou se sobreponha (D3).
    return window.el('div', {
      'data-rv-route-stepper': section.route || '',
      style: 'display:grid;grid-template-columns:' + columns.join(' ') + ';align-items:start;',
    }, children);
  }

  // ctx = { buildStageNode(stage, index), buildTransferButton(stage) }
  function buildRouteSectionsNode(sections, ctx) {
    var list = Array.isArray(sections) && sections.length ? sections : [];
    var multi = list.length > 1;
    return window.el('div', {
      style: 'display:flex;flex-direction:column;gap:' + (multi ? '22px' : '0') + ';',
    }, list.map(function (section) {
      var block = window.el('div', {});
      // Um Pedido Tapete-only nao ganha cabecalho: a tela nao muda de
      // forma. Manta e misto declaram explicitamente a rota.
      if (multi || section.route === 'manta') block.appendChild(buildSectionHeader(section));
      block.appendChild(buildSectionGrid(section, ctx));
      return block;
    }));
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoRouteSectionsUi = {
    buildRouteSectionsNode: buildRouteSectionsNode,
    buildSectionHeader: buildSectionHeader,
    buildSectionGrid: buildSectionGrid,
  };
})(window);
