// =====================================================================
// === SCREENS: CLIENTE ROUTE SECTIONS UI ==============================
// PHASE-MANTA-B2B-R2 (correcao D1). Arranjo das SECOES POR ROTA no
// acompanhamento do cliente.
//
// Por que um modulo proprio: `cliente-pedido-tracking.js` detem o
// vocabulario visual do stepper do cliente (circulos 42px, conectores em
// top:20px, conic-gradient das parciais) e nao pode crescer para tambem
// deter o arranjo por rota. Este modulo decide SO o ARRANJO: cabecalho
// identificando a rota, nota de posicao local da rota e o container de
// rolagem de cada stepper. Os nos das etapas continuam sendo construidos
// pela tela de tracking e chegam aqui por injecao.
//
// Regras binding (MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md sec.1/sec.7):
//   - TAPETE: Insumos -> Tecelagem -> Acabamento -> Expedicao -> Entrega
//   - MANTA:  Insumos -> Tecelagem ->               Expedicao -> Entrega
//   - Pedido misto: DUAS secoes independentes, nunca a uniao num stepper.
//
// Nao le rota nenhuma: recebe as secoes ja derivadas de
// `modelos.tipo_produto`. Puro DOM — sem `window.supa`, sem escrita,
// sem dado administrativo.
// =====================================================================

(function (window) {
  'use strict';

  var ROUTE_CHIP = {
    manta: 'background:var(--rv-stage-tecelagem-bg);color:var(--rv-stage-tecelagem);',
    tapete: 'background:var(--rv-pill-info-bg);color:var(--rv-accent-blue);',
  };

  function chipStyle(route) {
    return ROUTE_CHIP[route] || 'background:var(--rv-surface-subtle);color:var(--rv-text-secondary);';
  }

  // Cabecalho da secao: identifica a rota de forma visivel e lista a
  // forma real das etapas daquela rota (o cliente ve que a Manta nao tem
  // Acabamento, sem precisar contar bolinhas).
  function buildSectionHeader(section) {
    var labels = (section.steps || []).map(function (entry) {
      return entry.step && entry.step.label ? entry.step.label : '';
    }).filter(Boolean).join(' → ');

    return window.el('div', {
      'data-rv-route-section-header': section.route || '',
      style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;',
    },
      window.el('span', {
        style: 'display:inline-flex;align-items:center;border-radius:var(--rv-radius);padding:3px 11px;'
          + 'font-size:11.5px;font-weight:700;' + chipStyle(section.route),
      }, 'Rota ' + (section.label || '—')),
      window.el('span', {
        style: 'font-size:11.5px;color:var(--rv-text-tertiary);font-weight:600;letter-spacing:.02em;',
      }, labels)
    );
  }

  // Nota de posicao LOCAL da rota. A posicao publicada e de nivel Pedido
  // (artefato comercial); o que se afirma aqui e apenas qual etapa DESTA
  // rota foi alcancada e qual e a proxima — derivado dentro da rota.
  function buildSectionPositionNote(section) {
    var pos = section.position;
    if (!pos) return null;
    var parts = [];
    if (pos.reachedLabel) parts.push('Etapa alcançada nesta rota: ' + pos.reachedLabel);
    if (pos.nextLabel) parts.push('Próxima: ' + pos.nextLabel);
    if (!parts.length) return null;
    return window.el('div', {
      'data-rv-route-section-position': section.route || '',
      style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-top:8px;line-height:1.45;',
    }, parts.join(' · '));
  }

  // ctx = { buildStepperRow(section) -> node }
  // Cada stepper vive no seu PROPRIO container de rolagem: em 375px a
  // linha rola dentro da secao em vez de comprimir os rotulos a uma
  // palavra por linha ou empurrar o documento na horizontal.
  function buildClienteRouteSectionsNode(sections, ctx) {
    var list = Array.isArray(sections) ? sections : [];
    var multi = list.length > 1;

    return window.el('div', {
      'data-rv-client-route-sections': String(list.length),
      style: 'display:flex;flex-direction:column;gap:' + (multi ? '20px' : '0') + ';',
    }, list.map(function (section) {
      var block = window.el('div', {
        'data-rv-client-route-section': section.route || 'legado',
        style: multi ? 'border-top:1px solid var(--rv-border-soft);padding-top:14px;' : '',
      });
      // Um Pedido Tapete-only nao ganha cabecalho: a tela nao muda de
      // forma. Manta e misto declaram a rota explicitamente.
      if (multi || section.route === 'manta') block.appendChild(buildSectionHeader(section));
      block.appendChild(window.el('div', {
        'data-rv-stepper-scroll': '',
        style: 'max-width:100%;',
      }, ctx.buildStepperRow(section)));
      var note = buildSectionPositionNote(section);
      if (note) block.appendChild(note);
      return block;
    }));
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clienteRouteSectionsUi = {
    buildClienteRouteSectionsNode: buildClienteRouteSectionsNode,
    buildSectionHeader: buildSectionHeader,
    buildSectionPositionNote: buildSectionPositionNote,
  };
})(window);
