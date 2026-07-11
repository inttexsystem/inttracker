// =====================================================================
// === BOOT (Seam C) ====================================================
// Entrypoint de bootstrap do app estático. Foi a última seção inline
// do <script> de index.html. Extraída como módulo clássico (sem ES
// module) preservando:
//
//   - o registro das 14 rotas do app via window.RAVATEX_ROUTER.setRoutes;
//   - a função main() (registra hashchange, carrega usuário, decide
//     destino inicial);
//   - o handler de erro de boot (console.error + toast).
//
// Todas as referências no setRoutes usam prefixo `window.` (não bare)
// para que o módulo funcione carregado em outro escopo/script tag e
// não dependa de globais implícitos do inline.
//
// Carregar via <script src="js/boot.js"></script> DEPOIS de TODOS os
// módulos (config, auth, router, telas, helpers, writes) e ANTES do
// fechamento do <head>. É o ÚLTIMO script local antes do </head>.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.RAVATEX_ROUTER.setRoutes          (js/router.js)
//   - window.screenLogin, window.screenNotFound,
//     window.screenForbidden                   (js/screens/system-screens.js)
//   - window.screenPainel                      (js/screens/painel.js)
//   - window.screenListaOPs                    (js/screens/ops-list.js)
//   - window.screenNovaOP                      (js/screens/op-nova.js)
//   - window.screenPedidosLista                (js/screens/pedidos-list.js)
//   - window.screenCadastros{Cores,Clientes,Modelos,
//     Parametros,Fornecedores,Precos,Usuarios} (js/screens/cadastros.js)
//   - window.screenDocumentosRecebidos         (js/screens/documentos-recebidos.js)
//   - window.screenFornecedorHome,
//     screenFornecedorOrdens,
//     screenFornecedorEntregas,
//     screenFornecedorLatex                    (js/screens/fornecedor.js)
//   - window.screenClienteDashboard,
//     screenClientePedidosLista,
//     screenClientePedidoNovo,
//     screenClientePedidoDetalhe               (js/screens/cliente-*.js)
//   - window.handleRoute, window.navigate,
//     window.routeAfterLogin                   (js/router.js)
//   - window.loadCurrentUser, window.CURRENT_USER  (js/auth.js)
//   - window.toast                             (js/ui.js)
//
// Compatibilidade: nenhum novo global é exportado. O módulo é
// self-executing (IIFE). window.routes é populado via
// RAVATEX_ROUTER.setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_ROUTER.setRoutes({
    '#/login':    { render: window.screenLogin,    public: true },
    '#/painel':   { render: window.screenPainel,   roles: ['admin'] },
    '#/ops':      { render: window.screenListaOPs, roles: ['admin'] },
    '#/ops/nova': { render: () => { var h = window.location.hash; var q = h.indexOf('?'); var pid = null; if (q >= 0) { var params = new URLSearchParams(h.slice(q)); pid = params.get('pedido_id') || null; } if (!pid) window.toast('Crie a OP a partir de um Pedido.', 'info'); return window.screenNovaOP(null, pid); }, roles: ['admin'] },
    '#/pedidos':  { render: window.screenPedidosLista, roles: ['admin'] },
    '#/pedidos/novo': { render: window.screenPedidoNovo, roles: ['admin'] },

    '#/documentos/recebidos': { render: window.screenDocumentosRecebidos, roles: ['admin'] },

    '#/cadastros/cores':       { render: window.screenCadastrosCores,       roles: ['admin'] },
    '#/cadastros/modelos':     { render: window.screenCadastrosModelos,     roles: ['admin'] },
    '#/cadastros/parametros':  { render: window.screenCadastrosParametros,  roles: ['admin'] },
    '#/cadastros/fornecedores':{ render: window.screenCadastrosFornecedores,roles: ['admin'] },
    '#/cadastros/clientes':    { render: window.screenCadastrosClientes,    roles: ['admin'] },
    '#/cadastros/precos':      { render: window.screenCadastrosPrecos,      roles: ['admin'] },
    '#/cadastros/usuarios':    { render: window.screenCadastrosUsuarios,    roles: ['admin'] },

    '#/fornecedor/home':     { render: window.screenFornecedorHome,     roles: ['fornecedor'] },
    '#/fornecedor/ordens':   { render: window.screenFornecedorOrdens,   roles: ['fornecedor'] },
    '#/fornecedor/entregas': { render: window.screenFornecedorEntregas, roles: ['fornecedor'] },
    '#/fornecedor/latex':    { render: window.screenFornecedorLatex,    roles: ['fornecedor'] },

    '#/cliente/dashboard':    { render: window.screenClienteDashboard,    roles: ['cliente'] },
    '#/cliente/pedidos':      { render: window.screenClientePedidosLista, roles: ['cliente'] },
    '#/cliente/pedidos/novo': { render: window.screenClientePedidoNovo,   roles: ['cliente'] },
  });

  async function main() {
    window.addEventListener('hashchange', window.handleRoute);

    await window.loadCurrentUser();

    if (!window.CURRENT_USER) {
      window.navigate('#/login');
      return;
    }

    // G24-C: one non-blocking, authenticated-admin bootstrap per browser
    // session. The trigger first hydrates an active request and only creates
    // one when none exists; failures are rendered by the trigger and never
    // prevent normal routing.
    if (window.CURRENT_USER.tipo === 'admin'
        && window.RAVATEX_DOCUMENTS
        && typeof window.RAVATEX_DOCUMENTS.autoStartDocumentScanOnAdminBootstrap === 'function') {
      window.RAVATEX_DOCUMENTS.autoStartDocumentScanOnAdminBootstrap();
    }

    if (window.location.hash && window.location.hash !== '#/login') {
      window.handleRoute();
    } else {
      window.routeAfterLogin();
    }
  }

  function startApp() {
    main().catch((err) => {
      console.error(err);
      window.toast('Erro ao iniciar o app', 'error');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp, { once: true });
  } else {
    startApp();
  }
})(window);
