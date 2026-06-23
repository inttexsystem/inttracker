// =====================================================================
// === SCREENS: PAINEL (Seam A) ========================================
// Tela de painel/dashboard administrativo. Placeholder da Fase 1.
//
// Extraída do <script> inline de index.html sem alterar
// comportamento, lógica ou dependências.
//
// Carregar via <script src="js/screens/painel.js"></script>
// no <head>, DEPOIS de js/screens/op-latex-admin.js e ANTES
// de jspdf + script inline principal. A rota #/painel em
// setRoutes referencia screenPainel como bare global.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el, window.toast                          (js/ui.js)
//   - window.CURRENT_USER                               (js/auth.js)
//   - window.shellLayout, window.ADMIN_MENU             (js/screens/common.js)
// =====================================================================

(function (window) {
  'use strict';

  function screenPainel() {
    const content = el('div', {},
      el('h1', { class: 'text-2xl font-bold mb-4' }, 'Painel'),
      el('div', { class: 'bg-white rounded-xl p-6 shadow' },
        el('p', { class: 'text-gray-700' }, 'Bem-vindo, ' + CURRENT_USER.nome + '. (Fase 1 — placeholder; as próximas fases vão preencher essa tela.)')
      )
    );
    return shellLayout(ADMIN_MENU, content);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.painel = {
    screenPainel,
  };

  window.screenPainel = screenPainel;
})(window);
