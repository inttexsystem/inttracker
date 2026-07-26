// =====================================================================
// DETECTOR FIXTURE — CONFORMING APPLICATION SCREEN (negative case)
//
// Synthetic. Written in the same grammar as js/screens/*.js: a classic
// IIFE that builds the DOM through el(tag, attrs, ...). Not a product
// screen, not a precedent, and excluded from the detector inventory.
//
// The comment below deliberately names a legacy literal colour,
// #2563eb, and a deprecated token var(--rv-color-accent): the detector
// lexes rather than greps, so neither may be reported.
// =====================================================================

(function (window) {
  'use strict';

  var LEGACY_PATTERN = /#[0-9a-f]{6}/i;

  function render() {
    var card = el('section', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:var(--rv-pad-card);',
    });
    var label = el('span', {
      style: 'font-size:var(--rv-fs-label);font-weight:700;color:var(--rv-text-tertiary);',
    }, 'DADOS DA OP');
    var pill = el('span', {
      style: 'height:18px;padding:0 6px;border-radius:var(--rv-radius-pill);border:1px solid var(--rv-pill-positive-border);background:var(--rv-pill-positive-bg);color:var(--rv-pill-positive-text);font-size:var(--rv-fs-2xs);font-weight:600;',
    }, 'Ativo');
    var dot = el('span', {
      style: 'width:5px;height:5px;border-radius:var(--rv-radius-pill);background:var(--rv-pill-positive-dot);',
    });
    var actions = el('div', {
      'data-card-actions': 'true',
      style: 'display:flex;align-items:center;justify-content:flex-end;padding-top:11px;border-top:1px solid var(--rv-border-soft);',
    });
    var save = el('button', {
      style: 'height:var(--rv-h-default);border-radius:var(--rv-radius);background:var(--rv-brand);color:var(--rv-text-on-brand);font-size:var(--rv-fs-body);font-weight:600;',
    }, 'Salvar');

    save.style.opacity = '1';
    actions.appendChild(save);
    card.appendChild(label);
    card.appendChild(pill);
    card.appendChild(dot);
    card.appendChild(actions);
    return card;
  }

  function isLegacyColour(value) {
    return LEGACY_PATTERN.test(String(value));
  }

  window.RAVATEX_UI_CONFORMANCE_FIXTURE_CONFORMING = {
    render: render,
    isLegacyColour: isLegacyColour,
  };
})(window);
