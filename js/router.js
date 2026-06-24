// =====================================================================
// === ROUTER (Seam A) =================================================
// Roteamento por hash da aplicação. Extraído do <script> inline de
// index.html sem alterar comportamento. Concentra:
//   - setRoutes(routesObj) / getRoutes()  — registro das rotas
//   - navigate(hash)                      — muda o hash (ou re-renderiza)
//   - matchRoute(hash)                    — exata + dinâmica #/ops/:id
//   - handleRoute()                       — resolve + autoriza + renderiza
//   - routeAfterLogin()                   — destino pós-login por papel
//
// Carregar via <script src="js/router.js"></script> no <head>, DEPOIS de
// js/auth.js e ANTES do script inline principal. As rotas são registradas
// pelo inline (que declara as telas) via window.RAVATEX_ROUTER.setRoutes(),
// após as telas e antes de main().
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.CURRENT_USER / window.loadCurrentUser  (js/auth.js)
//   - window.setApp                                 (js/ui.js)
//   - window.screenNotFound / window.screenForbidden / window.screenNovaOP
//     e demais telas                                (inline)
//
// Este módulo NÃO registra o listener de hashchange — isso permanece em
// main() no inline, preservando a ordem de boot.
//
// Compatibilidade: window.navigate, window.matchRoute, window.handleRoute,
// window.routeAfterLogin e window.routes continuam disponíveis exatamente
// como antes para o inline e as telas.
// =====================================================================

(function (window) {
  'use strict';

  let _routes = {};

  function setRoutes(routesObj) {
    _routes = routesObj || {};
    window.routes = _routes;
  }

  function getRoutes() {
    return _routes;
  }

  function navigate(hash) {
    if (window.location.hash !== hash) window.location.hash = hash;
    else handleRoute();
  }

  // Resolve rota: primeiro match exato, depois dinâmica #/ops/:id (id numérico),
  // #/pedidos/:id/editar (UUID + /editar), #/pedidos/:id/itens
  // (UUID + /itens) e #/pedidos/:id (UUID).
  function matchRoute(hash) {
    if (_routes[hash]) return _routes[hash];

    const mOps = String(hash || '').match(/^#\/ops\/(\d+)$/);
    if (mOps) {
      return {
        render: () => window.screenNovaOP(Number(mOps[1])),
        roles: ['admin'],
      };
    }

    // Match dinâmico para EDIÇÃO de Pedido (C3C1). Mais específico que
    // o match de detalhe (terminado em /editar) — vem antes do match
    // de detalhe para clareza, embora o regex do detalhe (ancorado em
    // $) já exclua o caso.
    const mPedEdit = String(hash || '').match(
      /^#\/pedidos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/editar$/i
    );
    if (mPedEdit) {
      return {
        render: () => window.screenPedidoEditar(mPedEdit[1]),
        roles: ['admin'],
      };
    }

    // Match dinâmico para EDIÇÃO DE ITENS de Pedido (C3C2B). Mais
    // específico que o match de detalhe (terminado em /itens) — vem
    // antes do match de detalhe para clareza, embora o regex do
    // detalhe (ancorado em $) já exclua o caso.
    const mPedItens = String(hash || '').match(
      /^#\/pedidos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/itens$/i
    );
    if (mPedItens) {
      return {
        render: () => window.screenPedidoItensEditar(mPedItens[1]),
        roles: ['admin'],
      };
    }

    // Match dinâmico para detalhe de Pedido (read-only, UUID).
    // Aceita UUIDs case-insensitive. Não conflita com `#/pedidos`,
    // `#/pedidos/novo` (resolvidos pelo match exato acima),
    // `#/pedidos/<uuid>/editar` nem com
    // `#/pedidos/<uuid>/itens` (que têm regex próprios acima).
    const mPed = String(hash || '').match(/^#\/pedidos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (mPed) {
      return {
        render: () => window.screenPedidoDetalhe(mPed[1]),
        roles: ['admin'],
      };
    }

    return null;
  }

  async function handleRoute() {
    const hash = window.location.hash || '#/login';
    const route = matchRoute(hash);

    if (!route) {
      window.setApp(window.screenNotFound());
      return;
    }

    if (route.public) {
      window.setApp(await route.render());
      return;
    }

    if (!window.CURRENT_USER) await window.loadCurrentUser();

    if (!window.CURRENT_USER) {
      navigate('#/login');
      return;
    }

    if (route.roles && !route.roles.includes(window.CURRENT_USER.tipo)) {
      window.setApp(window.screenForbidden());
      return;
    }

    window.setApp(await route.render());
  }

  async function routeAfterLogin() {
    await window.loadCurrentUser();

    if (!window.CURRENT_USER) {
      navigate('#/login');
      return;
    }

    if (window.CURRENT_USER.tipo === 'admin') {
      navigate('#/painel');
      return;
    }

    const t = window.CURRENT_USER.fornecedor_tipo;

    if (t === 'fio_algodao' || t === 'fio_poliester') {
      navigate('#/fornecedor/ordens');
    } else if (t === 'tecelagem') {
      navigate('#/fornecedor/entregas');
    } else if (t === 'latex') {
      navigate('#/fornecedor/latex');
    } else {
      navigate('#/fornecedor/ordens');                       // fallback genérico
    }
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_ROUTER = {
    setRoutes,
    getRoutes,
    navigate,
    matchRoute,
    handleRoute,
    routeAfterLogin,
  };

  // Compatibilidade com o script inline atual e as telas.
  window.navigate = navigate;
  window.matchRoute = matchRoute;
  window.handleRoute = handleRoute;
  window.routeAfterLogin = routeAfterLogin;
})(window);
