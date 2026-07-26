// =====================================================================
// DETECTOR FIXTURE — VIOLATING APPLICATION SCREEN (positive case)
//
// Synthetic. One deliberate defect per rule, expressed the way the real
// screens express visual values: an inline style string in an
// el(tag, attrs) attribute object, plus one imperative .style
// assignment. Not a product screen, not a precedent, and excluded from
// the detector inventory.
// =====================================================================

(function (window) {
  'use strict';

  function render() {
    var box = el('div', {
      style: 'color:#2563eb;background:rgba(0,0,0,.4);border-radius:7px;font-size:9px;font-weight:450;box-shadow:0 4px 4px rgba(0,0,0,.2);',
    });
    var tall = el('button', {
      style: 'height:44px;border-radius:999px;',
    });
    var picker = el('select', {
      style: 'height:var(--rv-h-compact);border-radius:var(--rv-radius);',
    });
    var legacy = el('span', {
      style: 'color:var(--rv-color-accent);font-size:var(--rv-fs-body);',
    });
    var ghost = el('span', {
      style: 'color:var(--rv-does-not-exist);',
    });
    var pillBox = el('div', {
      style: 'border-radius:var(--rv-radius-pill);background:var(--rv-surface);padding:8px;',
    });

    box.style.borderColor = '#dc2626';

    return el('div', {}, box, tall, picker, legacy, ghost, pillBox);
  }

  window.RAVATEX_UI_CONFORMANCE_FIXTURE_VIOLATIONS = { render: render };
})(window);
