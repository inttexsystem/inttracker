// =====================================================================
// === SCREENS: OP FORM PURE HELPERS (Seam A) ==========================
// Helpers puros de UI/formatação extraídos do <script> inline de
// index.html, de dentro de screenNovaOP. Concentra:
//
//   - rotuloModelo(modelo)  — rótulo de modelo (nome + largura + cores)
//   - fmtKg(n)              — formata kg com 3 casas
//   - fmtMetros(n)          — formata metros com 2 casas
//   - disabledAttr(disabled, node) — seta disabled se true, retorna node
//
// Carregar via <script src="js/screens/op-form-helpers.js"></script>
// no <head>, DEPOIS de js/screens/fornecedor.js e ANTES de jspdf +
// script inline principal. As telas inline (screenNovaOP,
// renderOPLatexAdmin) referenciam os helpers acima com prefixo
// `window.` (call-sites explícitos).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.larguraKey (js/calculo-op.js) — usado por rotuloModelo
//
// NÃO depende de: window.supa, window.toast, window.modal,
// window.confirmDialog, window.CURRENT_USER, window.navigate.
// NÃO faz insert / update / delete / rpc — apenas helpers puros.
//
// Compatibilidade: window.rotuloModelo, window.fmtKg, window.fmtMetros
// e window.disabledAttr seguem disponíveis para os call-sites do
// inline (prefixados com `window.`).
// =====================================================================

(function (window) {
  'use strict';

  function rotuloModelo(modelo) {
    if (!modelo) return '?';
    return `${modelo.nome} ${window.larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`;
  }

  function fmtKg(n) {
    return (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg');
  }

  function fmtMetros(n) {
    return Number(n).toFixed(2).replace('.', ',') + ' m';
  }

  function disabledAttr(disabled, node) {
    if (disabled) node.setAttribute('disabled', 'disabled');
    return node;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opFormHelpers = {
    rotuloModelo,
    fmtKg,
    fmtMetros,
    disabledAttr,
  };

  window.rotuloModelo = rotuloModelo;
  window.fmtKg = fmtKg;
  window.fmtMetros = fmtMetros;
  window.disabledAttr = disabledAttr;
})(window);
