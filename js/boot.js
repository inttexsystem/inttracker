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
//   - window.screenCadastros{Cores,Clientes,Modelos,
//     Parametros,Fornecedores,Precos,Usuarios} (js/screens/cadastros.js)
//   - window.screenFornecedorHome,
//     screenFornecedorOrdens,
//     screenFornecedorEntregas,
//     screenFornecedorLatex                    (js/screens/fornecedor.js)
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
    '#/ops/nova': { render: () => window.screenNovaOP(null), roles: ['admin'] },

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
  });

  async function main() {
    window.addEventListener('hashchange', window.handleRoute);

    await window.loadCurrentUser();

    if (!window.CURRENT_USER) {
      window.navigate('#/login');
      return;
    }

    if (window.location.hash && window.location.hash !== '#/login') {
      window.handleRoute();
    } else {
      window.routeAfterLogin();
    }
  }

  main().catch((err) => {
    console.error(err);
    window.toast('Erro ao iniciar o app', 'error');
  });
})(window);
