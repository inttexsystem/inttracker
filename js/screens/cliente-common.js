// =====================================================================
// === SCREENS: CLIENTE-COMMON (Seam A) =================================
// Layout e menu do cliente autenticado. Shell mínimo, sem ADMIN_MENU.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A
// Escopo: apenas menu "Meus pedidos" e shell reaproveitando
//   shellLayout de common.js. Sem OP, cadastros, fornecedores,
//   produção, entregas, usuários, parâmetros, recalcular.
//
// Carregar via <script src="js/screens/cliente-common.js"></script>
// no <head>, DEPOIS de js/screens/common.js e ANTES das telas cliente.
//
// Dependências resolvidas em tempo de chamada:
//   - window.shellLayout (js/screens/common.js)
//   - window.CURRENT_USER (js/auth.js)
//
// Compatibilidade: window.CLIENTE_MENU e window.clienteShellLayout
// ficam disponíveis para as telas cliente.
// =====================================================================

(function (window) {
  'use strict';

  const CLIENTE_MENU = [
    { href: '#/cliente/dashboard', label: 'Início' },
    { href: '#/cliente/pedidos', label: 'Meus pedidos' },
  ];

  function clienteShellLayout(contentNode) {
    return window.shellLayout(CLIENTE_MENU, contentNode);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clienteCommon = {
    CLIENTE_MENU,
    clienteShellLayout,
  };

  window.CLIENTE_MENU = CLIENTE_MENU;
  window.clienteShellLayout = clienteShellLayout;
})(window);
