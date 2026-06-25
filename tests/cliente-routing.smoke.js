// =====================================================================
// === tests/cliente-routing.smoke.js ===================================
// Smoke para roteamento cliente: routeAfterLogin, matchRoute, roles.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A
// Escopo: valida que o router redireciona cliente corretamente
// e bloqueia acesso indevido.
// Garante:
//   - routeAfterLogin para cliente → #/cliente/pedidos;
//   - admin/fornecedor preservam rotas anteriores;
//   - rotas cliente exigem role 'cliente';
//   - cliente não recebe ADMIN_MENU.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const COMMON_CLI = path.join(ROOT, 'js', 'screens', 'cliente-common.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const routerSrc = readOrFail(ROUTER);
const bootSrc = readOrFail(BOOT);
const commonCliSrc = readOrFail(COMMON_CLI);

// ---------------------------------------------------------------------
// Helpers de runtime
// ---------------------------------------------------------------------

function makeRouterSandbox({ hash = '#/x' } = {}) {
  var calls = {
    setApp: [], screenNotFound: 0, screenForbidden: 0,
    screenClientePedidoDetalhe: [],
    loadCurrentUser: 0,
    navigations: [],
  };
  var sandbox = {
    console, setTimeout, clearTimeout, URL, URLSearchParams,
    location: { hash: hash },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  sandbox.setApp = function (node) { calls.setApp.push(node); };
  sandbox.screenNotFound = function () { calls.screenNotFound++; return { __screen: 'notFound' }; };
  sandbox.screenForbidden = function () { calls.screenForbidden++; return { __screen: 'forbidden' }; };
  sandbox.screenClientePedidoDetalhe = function (id) { calls.screenClientePedidoDetalhe.push(id); return { __screen: 'clienteDetalhe', id: id }; };
  sandbox.CURRENT_USER = null;
  sandbox.loadCurrentUser = async function () { calls.loadCurrentUser++; return sandbox.CURRENT_USER; };
  sandbox._calls = calls;

  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  return { sandbox, calls };
}

function routeAfterLoginDestino(user, startHash) {
  startHash = startHash || '#/x';
  var r = makeRouterSandbox({ hash: startHash });
  r.sandbox.loadCurrentUser = async function () {
    r.calls.loadCurrentUser++;
    r.sandbox.CURRENT_USER = user;
    return user;
  };
  return (async function () {
    await vm.runInContext('window.routeAfterLogin()', r.sandbox);
    return vm.runInContext('window.location.hash', r.sandbox);
  })();
}

// ---------------------------------------------------------------------
// 1. routeAfterLogin — cliente
// ---------------------------------------------------------------------

test('routeAfterLogin: cliente → #/cliente/pedidos', async () => {
  var dst = await routeAfterLoginDestino({ tipo: 'cliente' });
  assert.equal(dst, '#/cliente/pedidos');
});

test('routeAfterLogin: admin → #/painel (preservado)', async () => {
  var dst = await routeAfterLoginDestino({ tipo: 'admin' });
  assert.equal(dst, '#/painel');
});

test('routeAfterLogin: fornecedor fio_algodao → #/fornecedor/ordens (preservado)', async () => {
  var dst = await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'fio_algodao' });
  assert.equal(dst, '#/fornecedor/ordens');
});

test('routeAfterLogin: fornecedor tecelagem → #/fornecedor/entregas (preservado)', async () => {
  var dst = await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'tecelagem' });
  assert.equal(dst, '#/fornecedor/entregas');
});

test('routeAfterLogin: fornecedor latex → #/fornecedor/latex (preservado)', async () => {
  var dst = await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'latex' });
  assert.equal(dst, '#/fornecedor/latex');
});

test('routeAfterLogin: sem CURRENT_USER → #/login', async () => {
  var dst = await routeAfterLoginDestino(null);
  assert.equal(dst, '#/login');
});

// ---------------------------------------------------------------------
// 2. matchRoute — rota cliente list
// ---------------------------------------------------------------------

test('matchRoute: #/cliente/pedidos estático registrado (via boot.js)', () => {
  assert.match(bootSrc, /'#\/cliente\/pedidos'/);
  assert.match(bootSrc, /roles:\s*\[['"]cliente['"]\]/);
});

// ---------------------------------------------------------------------
// 3a. RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A — rota #/cliente/pedidos/novo
// ---------------------------------------------------------------------

test('boot.js: registra rota #/cliente/pedidos/novo com role cliente', () => {
  assert.match(
    bootSrc,
    /'#\/cliente\/pedidos\/novo'\s*:\s*\{\s*render\s*:\s*window\.screenClientePedidoNovo[^}]*roles\s*:\s*\[\s*['"]cliente['"]\s*\]/i,
    "rota #/cliente/pedidos/novo deve ser registrada com role cliente e render=screenClientePedidoNovo"
  );
});

test('handleRoute: rota #/cliente/pedidos/novo exige role cliente (admin → forbidden)', async () => {
  var r = makeRouterSandbox({ hash: '#/cliente/pedidos/novo' });
  vm.runInContext(`
    window.screenClientePedidoNovo = function() { return Promise.resolve({ __screen: 'clienteForm' }); };
    window.RAVATEX_ROUTER.setRoutes({ '#/cliente/pedidos/novo': { render: window.screenClientePedidoNovo, roles: ['cliente'] } });
    window.CURRENT_USER = { tipo: 'admin' };
  `, r.sandbox);
  await vm.runInContext('window.handleRoute()', r.sandbox);
  assert.equal(r.calls.screenForbidden, 1, 'admin deve receber forbidden em rota cliente de criação');
});

test('handleRoute: rota #/cliente/pedidos/novo renderiza para cliente autenticado', async () => {
  var r = makeRouterSandbox({ hash: '#/cliente/pedidos/novo' });
  vm.runInContext(`
    window.screenClientePedidoNovo = function() { return Promise.resolve({ __screen: 'clienteForm' }); };
    window.RAVATEX_ROUTER.setRoutes({ '#/cliente/pedidos/novo': { render: window.screenClientePedidoNovo, roles: ['cliente'] } });
    window.CURRENT_USER = { tipo: 'cliente' };
  `, r.sandbox);
  await vm.runInContext('window.handleRoute()', r.sandbox);
  assert.equal(r.calls.setApp.length, 1, 'setApp não foi chamado');
  assert.equal(r.calls.setApp[0].__screen, 'clienteForm');
  assert.equal(r.calls.screenForbidden, 0, 'cliente não deve receber forbidden na própria rota de criação');
});

// ---------------------------------------------------------------------
// 3. matchRoute dinâmico — #/cliente/pedidos/<uuid>
// ---------------------------------------------------------------------

test('matchRoute: #/cliente/pedidos/<uuid> resolve com role ["cliente"]', () => {
  var r = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", r.sandbox);
  var uuid = '11111111-2222-3333-4444-555555555555';
  var match = vm.runInContext("window.matchRoute('#/cliente/pedidos/" + uuid + "')", r.sandbox);
  assert.ok(match, 'matchRoute não resolveu #/cliente/pedidos/<uuid>');
  assert.equal(typeof match.render, 'function', 'render não é função');
  var rolesJson = vm.runInContext("JSON.stringify(window.matchRoute('#/cliente/pedidos/" + uuid + "').roles)", r.sandbox);
  assert.equal(rolesJson, '["cliente"]');
});

test('matchRoute: #/cliente/pedidos/<uuid> render chama screenClientePedidoDetalhe', () => {
  var r = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", r.sandbox);
  var uuid = '11111111-2222-3333-4444-555555555555';
  vm.runInContext("window.matchRoute('#/cliente/pedidos/" + uuid + "').render();", r.sandbox);
  assert.deepEqual(r.calls.screenClientePedidoDetalhe, [uuid]);
});

test('matchRoute: #/cliente/pedidos/<uuid> rejeita IDs não-UUID', () => {
  var r = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", r.sandbox);
  for (var i = 0; i < ['42', 'abc', '12345', 'not-a-uuid', '11111111-2222-3333-4444'].length; i++) {
    var badId = ['42', 'abc', '12345', 'not-a-uuid', '11111111-2222-3333-4444'][i];
    var m = vm.runInContext("window.matchRoute('#/cliente/pedidos/" + badId + "')", r.sandbox);
    assert.equal(m, null, '#/cliente/pedidos/' + badId + ' não deve casar');
  }
});

// ---------------------------------------------------------------------
// 4. handleRoute — bloqueio de role
// ---------------------------------------------------------------------

test('handleRoute: rota cliente exige role cliente (admin → forbidden)', async () => {
  var r = makeRouterSandbox({ hash: '#/cliente/pedidos' });
  vm.runInContext(`
    window.screenClientePedidosLista = function() { return Promise.resolve({ __screen: 'clienteList' }); };
    window.RAVATEX_ROUTER.setRoutes({ '#/cliente/pedidos': { render: window.screenClientePedidosLista, roles: ['cliente'] } });
    window.CURRENT_USER = { tipo: 'admin' };
  `, r.sandbox);
  await vm.runInContext('window.handleRoute()', r.sandbox);
  assert.equal(r.calls.screenForbidden, 1, 'admin deve receber forbidden em rota cliente');
});

test('handleRoute: rota cliente exige role cliente (fornecedor → forbidden)', async () => {
  var r = makeRouterSandbox({ hash: '#/cliente/pedidos' });
  vm.runInContext(`
    window.screenClientePedidosLista = function() { return Promise.resolve({ __screen: 'clienteList' }); };
    window.RAVATEX_ROUTER.setRoutes({ '#/cliente/pedidos': { render: window.screenClientePedidosLista, roles: ['cliente'] } });
    window.CURRENT_USER = { tipo: 'fornecedor', fornecedor_tipo: 'tecelagem' };
  `, r.sandbox);
  await vm.runInContext('window.handleRoute()', r.sandbox);
  assert.equal(r.calls.screenForbidden, 1, 'fornecedor deve receber forbidden em rota cliente');
});

test('handleRoute: rota cliente renderiza para cliente autenticado', async () => {
  var r = makeRouterSandbox({ hash: '#/cliente/pedidos' });
  vm.runInContext(`
    window.screenClientePedidosLista = function() { return Promise.resolve({ __screen: 'clienteList' }); };
    window.RAVATEX_ROUTER.setRoutes({ '#/cliente/pedidos': { render: window.screenClientePedidosLista, roles: ['cliente'] } });
    window.CURRENT_USER = { tipo: 'cliente' };
  `, r.sandbox);
  await vm.runInContext('window.handleRoute()', r.sandbox);
  assert.equal(r.calls.setApp.length, 1, 'setApp não foi chamado');
  assert.equal(r.calls.setApp[0].__screen, 'clienteList');
  assert.equal(r.calls.screenForbidden, 0, 'cliente não deve receber forbidden na própria rota');
});

// ---------------------------------------------------------------------
// 5. Menu cliente — não tem ADMIN_MENU
// ---------------------------------------------------------------------

test('cliente-common: CLIENTE_MENU não expõe entradas admin', () => {
  assert.equal(/Painel/.test(commonCliSrc), false);
  assert.equal(/OPs/.test(commonCliSrc), false);
  assert.equal(/Cadastros/.test(commonCliSrc), false);
  assert.equal(/Fornecedores/.test(commonCliSrc), false);
  assert.equal(/Usuários/.test(commonCliSrc), false);
  assert.equal(/Parâmetros/.test(commonCliSrc), false);
});

// ---------------------------------------------------------------------
// 6. Estático — router.js contém rota cliente
// ---------------------------------------------------------------------

test('router.js: routeAfterLogin contém branch para cliente', () => {
  assert.match(routerSrc, /tipo\s*===?\s*['"]cliente['"]/);
  assert.match(routerSrc, /#\/cliente\/pedidos/);
});

test('router.js: matchRoute contém match para #/cliente/pedidos/<uuid>', () => {
  assert.match(routerSrc, /cliente\\\/pedidos\\\//);
});
