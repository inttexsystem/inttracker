// Smoke test do módulo js/router.js (ROUTER-MODULE-A).
//
// Garante que a extração do roteamento (routes, navigate, matchRoute,
// handleRoute, routeAfterLogin) do <script> inline de index.html para
// js/router.js preservou o comportamento exato:
//
// Estáticos:
//   1. js/router.js existe e é script clássico (não ES module);
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/router.js EXATAMENTE UMA VEZ, sem type=module;
//   4. ordem config → supabase-client → environment-banner → auth →
//      router → inline;
//   5. inline NÃO contém mais: const routes, function navigate,
//      function matchRoute, async function handleRoute,
//      async function routeAfterLogin, marcador === ROUTER ===;
//   6. inline ainda contém screenPainel e main (screenLogin, screenNotFound
//      e screenForbidden foram extraídos para js/screens/system-screens.js);
//   7. window.RAVATEX_ROUTER.setRoutes é chamado ANTES de main;
//   8. js/router.js NÃO registra hashchange (nem addEventListener);
//   9. js/router.js não contém service_role nem password literal;
//  10. index.html não contém service_role nem password literal;
//
// Runtime (carrega js/router.js num vm.Context com stubs de telas/auth):
//  11. window.RAVATEX_ROUTER criado, expondo a API esperada;
//  12. globais legados (navigate/matchRoute/handleRoute/routeAfterLogin);
//  13. setRoutes define window.routes;
//  14. matchRoute exato / null / dinâmico #/ops/:id;
//  15. handleRoute: público sem user, chama loadCurrentUser, redireciona
//      p/ #/login, screenForbidden, render autorizado;
//  16. routeAfterLogin: todos os ramos por papel;
//  17. logout (js/auth.js) continua navegando p/ #/login via window.navigate;
//  18. main registra UM listener de hashchange (no inline);
//  19. boot: ui.js + badges.js + router.js + inline coexistem sem SyntaxError.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const ROUTER  = path.join(ROOT, 'js', 'router.js');
const BOOT    = path.join(ROOT, 'js', 'boot.js');
const AUTH    = path.join(ROOT, 'js', 'auth.js');
const UI      = path.join(ROOT, 'js', 'ui.js');
const BADGES  = path.join(ROOT, 'js', 'badges.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');
const OFH    = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const OPW    = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OLA    = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPR    = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const OPP    = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const OPN    = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');

const routerSrc  = fs.readFileSync(ROUTER, 'utf8');
const bootSrc    = fs.readFileSync(BOOT,   'utf8');
const indexSrc   = fs.readFileSync(INDEX,  'utf8');
const authSrc    = fs.readFileSync(AUTH,   'utf8');
const uiSrc      = fs.readFileSync(UI,     'utf8');
const badgesSrc  = fs.readFileSync(BADGES, 'utf8');
const systemScreensSrc = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc  = fs.readFileSync(COMMON, 'utf8');
const painelSrc  = fs.readFileSync(PAINEL, 'utf8');
const ofhSrc     = fs.readFileSync(OFH,    'utf8');
const opwSrc     = fs.readFileSync(OPW,    'utf8');
const olaSrc     = fs.readFileSync(OLA,    'utf8');
const oprSrc     = fs.readFileSync(OPR,    'utf8');
const oppSrc     = fs.readFileSync(OPP,    'utf8');
const opnSrc     = fs.readFileSync(OPN,    'utf8');
const cadSrc     = fs.readFileSync(CAD,    'utf8');
const opsSrc     = fs.readFileSync(OPS,    'utf8');
const efSrc      = fs.readFileSync(EF,     'utf8');
const ewSrc      = fs.readFileSync(EW,     'utf8');
const fornSrc    = fs.readFileSync(FORN,   'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) {
    // Após ROUTES-BOOT-MODULE-A o <script> inline foi removido.
    // Tests que verificam AUSÊNCIA de coisas no inline passam
    // trivialmente; tests que esperavam PRESENÇA foram atualizados
    // para olhar em js/boot.js.
    return '';
  }
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// -----------------------------------------------------------------------------
// Helper de runtime: carrega js/router.js num vm.Context isolado, com
// location mutável e stubs registráveis para telas e auth.
// -----------------------------------------------------------------------------

function makeRouterSandbox({ hash = '' } = {}) {
  const calls = {
    setApp: [], screenNotFound: 0, screenForbidden: 0,
    screenNovaOP: [], screenExpedicaoAdmin: [], screenPedidoDetalhe: [], screenPedidoEditar: [],
    screenPedidoItensEditar: [],
    loadCurrentUser: 0,
  };
  const sandbox = {
    console, setTimeout, clearTimeout, URL, URLSearchParams,
    location: { hash },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Stubs padrão (telas + ui). Sobrescrevíveis nos testes via sandbox.*.
  sandbox.setApp = (node) => { calls.setApp.push(node); };
  sandbox.screenNotFound = () => { calls.screenNotFound++; return { __screen: 'notFound' }; };
  sandbox.screenForbidden = () => { calls.screenForbidden++; return { __screen: 'forbidden' }; };
  sandbox.screenNovaOP = (id) => { calls.screenNovaOP.push(id); return { __screen: 'novaOP', id }; };
  sandbox.screenExpedicaoAdmin = (id) => { calls.screenExpedicaoAdmin.push(id); return { __screen: 'expedicaoAdmin', id }; };
  sandbox.screenPedidoDetalhe = (id) => { calls.screenPedidoDetalhe.push(id); return { __screen: 'pedidoDetalhe', id }; };
  sandbox.screenPedidoEditar = (id) => { calls.screenPedidoEditar.push(id); return { __screen: 'pedidoEditar', id }; };
  sandbox.screenPedidoItensEditar = (id) => { calls.screenPedidoItensEditar.push(id); return { __screen: 'pedidoItensEditar', id }; };
  sandbox.CURRENT_USER = null;
  sandbox.loadCurrentUser = async () => { calls.loadCurrentUser++; return sandbox.CURRENT_USER; };

  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  return { sandbox, calls };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('js/router.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(ROUTER), 'js/router.js não existe');
  assert.equal(/^\s*export\s+/m.test(routerSrc), false,
    'js/router.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(routerSrc), false,
    'js/router.js parece usar import — deve ser script clássico');
});

test('js/router.js: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${ROUTER}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/router.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/router\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/router.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/router\.js[^"]*"[^>]*type=/.test(indexSrc), false,
    'js/router.js está sendo carregado com type=module — deve ser script clássico');
});

test('index.html: ordem config → supabase-client → environment-banner → auth → router → boot.js', () => {
  // Após ROUTES-BOOT-MODULE-A, o inline foi removido. O entrypoint
  // de boot é agora js/boot.js, que deve ser o ÚLTIMO script antes
  // do </head>.
  const cfgIdx    = findScriptIdx(indexSrc, 'js/config.js');
  const supaIdx   = findScriptIdx(indexSrc, 'js/supabase-client.js');
  const envIdx    = findScriptIdx(indexSrc, 'js/environment-banner.js');
  const authIdx   = findScriptIdx(indexSrc, 'js/auth.js');
  const routerIdx = findScriptIdx(indexSrc, 'js/router.js');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(cfgIdx    > 0, 'js/config.js não encontrado');
  assert.ok(supaIdx   > 0, 'js/supabase-client.js não encontrado');
  assert.ok(envIdx    > 0, 'js/environment-banner.js não encontrado');
  assert.ok(authIdx   > 0, 'js/auth.js não encontrado');
  assert.ok(routerIdx > 0, 'js/router.js não encontrado');
  assert.ok(bootIdx   > 0, 'js/boot.js não encontrado');
  assert.ok(cfgIdx  < supaIdx,   'config antes de supabase-client');
  assert.ok(supaIdx < envIdx,    'supabase-client antes de environment-banner');
  assert.ok(envIdx  < authIdx,   'environment-banner antes de auth');
  assert.ok(authIdx < routerIdx, 'auth antes de router');
  assert.ok(routerIdx < bootIdx, 'router antes de boot.js');
});

test('script inline NÃO contém mais o bloco ROUTER extraído', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/=== ROUTER ===/.test(inline), false,
    'inline ainda contém o marcador === ROUTER ===');
  assert.equal(/\bconst\s+routes\s*=/.test(inline), false,
    'inline ainda declara const routes =');
  assert.equal(/\bfunction\s+navigate\s*\(/.test(inline), false,
    'inline ainda declara function navigate');
  assert.equal(/\bfunction\s+matchRoute\s*\(/.test(inline), false,
    'inline ainda declara function matchRoute');
  assert.equal(/\basync\s+function\s+handleRoute\s*\(/.test(inline), false,
    'inline ainda declara async function handleRoute');
  assert.equal(/\basync\s+function\s+routeAfterLogin\s*\(/.test(inline), false,
    'inline ainda declara async function routeAfterLogin');
});

test('screenPainel foi extraída de inline para painel.js; main foi extraída para boot.js', () => {
  const inline = extractInlineScript(indexSrc);
  // screenPainel foi extraída para painel.js (SCREENPAINEL-MODULE-A)
  assert.equal(/function\s+screenPainel\s*\(/.test(inline), false,
    'inline ainda declara function screenPainel — extração incompleta');
  // main() foi extraída para js/boot.js (ROUTES-BOOT-MODULE-A)
  assert.equal(/function\s+main\s*\(/.test(inline), false,
    'inline ainda declara function main — extração incompleta');
  // As duas funções estão agora em arquivos próprios
  assert.match(bootSrc, /window\.screenPainel/,
    'js/boot.js não referencia window.screenPainel — setRoutes incompleto');
});

test('script inline NÃO contém mais screenLogin, screenNotFound, screenForbidden (extraídos p/ js/screens/system-screens.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+screenLogin\s*\(/.test(inline), false,
    'inline ainda declara function screenLogin');
  assert.equal(/function\s+screenNotFound\s*\(/.test(inline), false,
    'inline ainda declara function screenNotFound');
  assert.equal(/function\s+screenForbidden\s*\(/.test(inline), false,
    'inline ainda declara function screenForbidden');
});

test('boot.js: window.RAVATEX_ROUTER.setRoutes é chamado ANTES de main', () => {
  // Após ROUTES-BOOT-MODULE-A, setRoutes e main estão em js/boot.js
  const setRoutesIdx = bootSrc.indexOf('window.RAVATEX_ROUTER.setRoutes(');
  const mainIdx = bootSrc.search(/async\s+function\s+main\s*\(/);
  assert.ok(setRoutesIdx > 0, 'setRoutes não encontrado em boot.js');
  assert.ok(mainIdx > 0, 'function main não encontrada em boot.js');
  assert.ok(setRoutesIdx < mainIdx, 'setRoutes deveria vir antes de main em boot.js');
});

test('boot.js: setRoutes registra exatamente as rotas existentes (mesma lista do inline original)', () => {
  const esperadas = [
    '#/login', '#/painel', '#/ops', '#/ops/nova',
    '#/cadastros/cores', '#/cadastros/modelos', '#/cadastros/parametros',
    '#/cadastros/fornecedores', '#/cadastros/clientes', '#/cadastros/precos',
    '#/cadastros/usuarios',
    '#/fornecedor/home', '#/fornecedor/ordens', '#/fornecedor/entregas', '#/fornecedor/latex',
  ];
  for (const rota of esperadas) {
    assert.ok(bootSrc.includes(`'${rota}'`),
      `rota ${rota} não encontrada no setRoutes de boot.js`);
  }
});

test('js/router.js NÃO registra hashchange nem addEventListener', () => {
  // O módulo não pode registrar listeners — o hashchange fica em main().
  // (A palavra "hashchange" pode aparecer em comentário explicativo; o que
  // importa é não haver chamada a addEventListener.)
  assert.equal(/addEventListener/.test(routerSrc), false,
    'js/router.js chama addEventListener — não deve registrar listeners');
  assert.equal(/addEventListener\(\s*['"]hashchange['"]/.test(routerSrc), false,
    'js/router.js registra listener de hashchange — deve ficar em main()');
});

test('js/router.js: nenhum service_role nem password literal', () => {
  assert.equal(/service_role/i.test(routerSrc), false, 'service_role em js/router.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(routerSrc), false,
    'password literal longo em js/router.js');
});

test('index.html: nenhum service_role nem password literal (preservado)', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

// -----------------------------------------------------------------------------
// 2. Validação de runtime
// -----------------------------------------------------------------------------

test('runtime: window.RAVATEX_ROUTER é criado e expõe a API esperada', () => {
  const { sandbox } = makeRouterSandbox();
  const ns = vm.runInContext('window.RAVATEX_ROUTER', sandbox);
  assert.ok(ns && typeof ns === 'object', 'RAVATEX_ROUTER não é objeto');
  for (const fn of ['setRoutes', 'getRoutes', 'navigate', 'matchRoute', 'handleRoute', 'routeAfterLogin']) {
    assert.equal(typeof ns[fn], 'function', `RAVATEX_ROUTER.${fn} ausente`);
  }
});

test('runtime: globais legados navigate/matchRoute/handleRoute/routeAfterLogin existem', () => {
  const { sandbox } = makeRouterSandbox();
  assert.equal(typeof vm.runInContext('window.navigate', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.matchRoute', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.handleRoute', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.routeAfterLogin', sandbox), 'function');
});

test('runtime: setRoutes define window.routes e getRoutes() retorna o mesmo objeto', () => {
  const { sandbox } = makeRouterSandbox();
  vm.runInContext(`
    window.renderLogin = () => ({ __screen: 'login' });
    window.RAVATEX_ROUTER.setRoutes({ '#/login': { render: renderLogin, public: true } });
  `, sandbox);
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'window.routes não foi definido por setRoutes');
  assert.equal(vm.runInContext('window.RAVATEX_ROUTER.getRoutes() === window.routes', sandbox), true);
});

test('runtime: matchRoute retorna rota exata', () => {
  const { sandbox } = makeRouterSandbox();
  vm.runInContext(`
    window.renderPainel = () => ({ __screen: 'painel' });
    window.RAVATEX_ROUTER.setRoutes({ '#/painel': { render: renderPainel, roles: ['admin'] } });
  `, sandbox);
  assert.equal(vm.runInContext("window.matchRoute('#/painel') === window.routes['#/painel']", sandbox), true);
  // roles é um Array criado dentro do vm realm; compara via JSON p/ evitar
  // falha de reference-equality de prototype em deepStrictEqual.
  assert.equal(vm.runInContext("JSON.stringify(window.matchRoute('#/painel').roles)", sandbox), '["admin"]');
});

test('runtime: matchRoute aceita query string em rota exata e preserva pedido_id UUID no hash', async () => {
  const uuid = '41c17ad7-1264-4540-817a-4a5abebe46c3';
  const { sandbox } = makeRouterSandbox({ hash: '#/ops/nova?pedido_id=' + uuid });
  sandbox.CURRENT_USER = { tipo: 'admin' };
  vm.runInContext(`
    window.__screenNovaOPArgs = null;
    window.screenNovaOP = function () {
      window.__screenNovaOPArgs = Array.from(arguments);
      return { __screen: 'novaOP' };
    };
    window.RAVATEX_ROUTER.setRoutes({
      '#/ops/nova': {
        render: () => {
          var h = window.location.hash;
          var q = h.indexOf('?');
          var pid = null;
          if (q >= 0) {
            var params = new URLSearchParams(h.slice(q));
            pid = params.get('pedido_id') || null;
          }
          return window.screenNovaOP(null, pid);
        },
        roles: ['admin'],
      },
    });
  `, sandbox);
  assert.equal(vm.runInContext("window.matchRoute(window.location.hash) === window.routes['#/ops/nova']", sandbox), true);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(vm.runInContext('JSON.stringify(window.__screenNovaOPArgs)', sandbox), JSON.stringify([null, uuid]));
});

test('runtime: matchRoute retorna null para hash desconhecido', () => {
  const { sandbox } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({ '#/login': { render: () => ({}), public: true } });", sandbox);
  assert.equal(vm.runInContext("window.matchRoute('#/inexistente')", sandbox), null);
});

test('runtime: matchRoute parseia #/ops/123 e route.render() chama window.screenNovaOP(123)', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  assert.equal(vm.runInContext("JSON.stringify(window.matchRoute('#/ops/123').roles)", sandbox), '["admin"]');
  vm.runInContext("window.matchRoute('#/ops/123').render();", sandbox);
  assert.deepEqual(calls.screenNovaOP, [123]);
});

test('runtime: matchRoute parseia #/expedicoes/123 e chama screenExpedicaoAdmin(123)', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  assert.equal(vm.runInContext("JSON.stringify(window.matchRoute('#/expedicoes/123').roles)", sandbox), '["admin"]');
  vm.runInContext("window.matchRoute('#/expedicoes/123').render();", sandbox);
  assert.deepEqual(calls.screenExpedicaoAdmin, [123]);
});

test('runtime: handleRoute renderiza rota pública sem exigir usuário', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/login' });
  vm.runInContext(`
    window.renderLogin = () => ({ __screen: 'login' });
    window.RAVATEX_ROUTER.setRoutes({ '#/login': { render: renderLogin, public: true } });
  `, sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(calls.setApp.length, 1, 'setApp não foi chamado para rota pública');
  assert.equal(calls.setApp[0].__screen, 'login');
  assert.equal(calls.loadCurrentUser, 0, 'rota pública não deveria chamar loadCurrentUser');
});

test('runtime: handleRoute chama loadCurrentUser quando CURRENT_USER é null', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/painel' });
  vm.runInContext(`
    window.renderPainel = () => ({ __screen: 'painel' });
    window.RAVATEX_ROUTER.setRoutes({ '#/painel': { render: renderPainel, roles: ['admin'] } });
    window.CURRENT_USER = null;
    window.loadCurrentUser = async () => { window.__loaded = (window.__loaded||0)+1; window.CURRENT_USER = { tipo: 'admin' }; return window.CURRENT_USER; };
  `, sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(vm.runInContext('window.__loaded', sandbox), 1, 'loadCurrentUser não foi chamado');
  assert.equal(calls.setApp[0].__screen, 'painel', 'render não foi chamado após autenticar');
});

test('runtime: handleRoute redireciona para #/login quando não autenticado', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/painel' });
  vm.runInContext(`
    window.RAVATEX_ROUTER.setRoutes({ '#/painel': { render: () => ({ __screen: 'painel' }), roles: ['admin'] } });
    window.CURRENT_USER = null;
    window.loadCurrentUser = async () => null; // permanece deslogado
  `, sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(vm.runInContext('window.location.hash', sandbox), '#/login');
  assert.equal(calls.setApp.length, 0, 'não deveria renderizar tela protegida sem usuário');
});

test('runtime: handleRoute chama screenForbidden quando role não autorizada', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/painel' });
  vm.runInContext(`
    window.RAVATEX_ROUTER.setRoutes({ '#/painel': { render: () => ({ __screen: 'painel' }), roles: ['admin'] } });
    window.CURRENT_USER = { tipo: 'fornecedor' };
  `, sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(calls.screenForbidden, 1, 'screenForbidden não foi chamado');
  assert.equal(calls.setApp[0].__screen, 'forbidden');
});

test('runtime: handleRoute chama route.render quando autorizado', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/painel' });
  vm.runInContext(`
    window.__rendered = 0;
    window.RAVATEX_ROUTER.setRoutes({ '#/painel': { render: () => { window.__rendered++; return { __screen: 'painel' }; }, roles: ['admin'] } });
    window.CURRENT_USER = { tipo: 'admin' };
  `, sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(vm.runInContext('window.__rendered', sandbox), 1, 'render não foi chamado');
  assert.equal(calls.setApp[0].__screen, 'painel');
  assert.equal(calls.screenForbidden, 0);
});

test('runtime: handleRoute renderiza screenNotFound para hash sem rota', async () => {
  const { sandbox, calls } = makeRouterSandbox({ hash: '#/zzz' });
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({ '#/login': { render: () => ({}), public: true } });", sandbox);
  await vm.runInContext('window.handleRoute()', sandbox);
  assert.equal(calls.screenNotFound, 1, 'screenNotFound não foi chamado');
  assert.equal(calls.setApp[0].__screen, 'notFound');
});

// routeAfterLogin: todos os ramos por papel ----------------------------------

function routeAfterLoginDestino(user, startHash = '#/x') {
  const { sandbox } = makeRouterSandbox({ hash: startHash });
  vm.runInContext(`
    window.__user = ${JSON.stringify(user)};
    window.loadCurrentUser = async () => { window.CURRENT_USER = window.__user; return window.CURRENT_USER; };
  `, sandbox);
  return (async () => {
    await vm.runInContext('window.routeAfterLogin()', sandbox);
    return vm.runInContext('window.location.hash', sandbox);
  })();
}

test('runtime: routeAfterLogin sem CURRENT_USER → #/login', async () => {
  assert.equal(await routeAfterLoginDestino(null), '#/login');
});

test('runtime: routeAfterLogin admin → #/painel', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'admin' }), '#/painel');
});

test('runtime: routeAfterLogin fornecedor fio_algodao → #/fornecedor/ordens', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'fio_algodao' }), '#/fornecedor/ordens');
});

test('runtime: routeAfterLogin fornecedor fio_poliester → #/fornecedor/ordens', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'fio_poliester' }), '#/fornecedor/ordens');
});

test('runtime: routeAfterLogin fornecedor tecelagem → #/fornecedor/entregas', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'tecelagem' }), '#/fornecedor/entregas');
});

test('runtime: routeAfterLogin fornecedor latex → #/fornecedor/latex', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'latex' }), '#/fornecedor/latex');
});

test('runtime: routeAfterLogin fornecedor_tipo desconhecido → #/fornecedor/ordens (fallback)', async () => {
  assert.equal(await routeAfterLoginDestino({ tipo: 'fornecedor', fornecedor_tipo: 'qualquer' }), '#/fornecedor/ordens');
});

// Integração auth + router ----------------------------------------------------

test('runtime: logout (js/auth.js) continua navegando para #/login via window.navigate', async () => {
  const sandbox = {
    console, setTimeout, clearTimeout, URL, URLSearchParams,
    location: { hash: '#/painel' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // router.js define window.navigate; auth.js usa window.navigate no logout.
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext('window.supa = { auth: { signOut: async () => ({ error: null }) } };', sandbox);
  vm.runInContext(authSrc, sandbox, { filename: 'js/auth.js' });
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  await vm.runInContext('window.logout()', sandbox);
  assert.equal(vm.runInContext('window.location.hash', sandbox), '#/login',
    'logout não navegou para #/login');
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null,
    'logout não zerou CURRENT_USER');
});

// -----------------------------------------------------------------------------
// 3. Boot: inline ainda referencia o listener e coexiste com os módulos
// -----------------------------------------------------------------------------

test('main() em boot.js registra UM listener de hashchange (não no router)', () => {
  // Após ROUTES-BOOT-MODULE-A, main() e seu addEventListener foram
  // movidos de inline para js/boot.js. O router.js continua sem
  // registrar hashchange.
  const bootMatches = (bootSrc.match(/addEventListener\(\s*['"]hashchange['"]/g) || []).length;
  const routerMatches = (routerSrc.match(/addEventListener\(\s*['"]hashchange['"]/g) || []).length;
  assert.equal(bootMatches, 1,
    `esperado 1 addEventListener('hashchange') em boot.js, encontrado ${bootMatches}`);
  assert.equal(routerMatches, 0,
    `esperado 0 addEventListener('hashchange') em router.js (deve ficar em boot), encontrado ${routerMatches}`);
});

test('boot: todos os módulos + boot.js coexistem sem SyntaxError de duplicate identifier', () => {
  // Após ROUTES-BOOT-MODULE-A, o inline foi removido e o entrypoint
  // é js/boot.js. O boot chain deve carregar TODOS os módulos
  // (incluindo os extraídos em fases anteriores) ANTES de boot.js,
  // porque boot.js referencia window.screenLogin, window.screenPainel,
  // window.screenCadastros*, window.screenFornecedor*,
  // window.screenListaOPs, window.screenNovaOP via setRoutes.

  class FakeNode {
    constructor(t){ this.tagName=(t+'').toUpperCase(); this.children=[]; this.className=''; this._text=null; }
    appendChild(n){ this.children.push(n); return n; }
    setAttribute(){} addEventListener(){} removeEventListener(){}
    replaceChildren(){ this.children=[]; }
    remove(){ this._removed = true; }
    get textContent(){ return this._text || ''; }
    set textContent(v){ this._text=v; }
  }
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild(){}, setAttribute(){} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = {
    from: () => ({
      select() { return this; },
      order() { return this; },
      eq() { return this; },
      single() { return Promise.resolve({ data: null, error: null }); },
      then(r) { return Promise.resolve({ data: null, error: null }).then(r); },
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
  };
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
    supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Ordem completa do <head>:
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  // system-screens.js define window.screenLogin/screenNotFound/screenForbidden
  vm.runInContext(systemScreensSrc, sandbox, { filename: 'js/screens/system-screens.js' });
  // common.js define shellLayout/ADMIN_MENU
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  // Telas e módulos extraídos em fases anteriores
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(oppSrc,    sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });
  // boot.js é o entrypoint — substitui o inline
  vm.runInContext(bootSrc,    sandbox, { filename: 'js/boot.js' });

  // auth.js define loadCurrentUser/CURRENT_USER (necessário para boot)
  vm.runInContext(authSrc,   sandbox, { filename: 'js/auth.js' });

  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(bootSrc, sandbox, { filename: 'js/boot.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'coexistência módulos + boot.js lançou SyntaxError de duplicate identifier');

  // setRoutes em boot.js deve ter populado window.routes.
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'] && routes['#/painel'],
    'setRoutes em boot.js não populou window.routes durante o boot');

  if (otherErr) {
    console.log('(esperado) boot.js falhou em runtime fora do duplicate-identifier:', String(otherErr.message).slice(0, 120));
  }
});

// -----------------------------------------------------------------------------
// Match dinâmico #/pedidos/<uuid> e #/pedidos/<uuid>/editar (C3A / C3C1)
// -----------------------------------------------------------------------------

test('runtime: matchRoute parseia #/pedidos/<uuid> e route.render() chama window.screenPedidoDetalhe(uuid)', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  const uuid = '11111111-2222-3333-4444-555555555555';
  const match = vm.runInContext(`window.matchRoute('#/pedidos/${uuid}')`, sandbox);
  assert.ok(match, 'matchRoute não resolveu #/pedidos/<uuid>');
  assert.equal(typeof match.render, 'function', 'render de #/pedidos/<uuid> não é função');
  // Compara roles via JSON (cruza vm context boundary).
  assert.equal(vm.runInContext(`JSON.stringify(window.matchRoute('#/pedidos/${uuid}').roles)`, sandbox), '["admin"]',
    'roles de #/pedidos/<uuid> deve ser ["admin"]');
  // Executa render e verifica que screenPedidoDetalhe foi chamado.
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}').render();`, sandbox);
  assert.deepEqual(calls.screenPedidoDetalhe, [uuid],
    'render de #/pedidos/<uuid> deve chamar screenPedidoDetalhe com o UUID');
  // E NÃO deve chamar screenPedidoEditar.
  assert.equal(calls.screenPedidoEditar.length, 0,
    'render de #/pedidos/<uuid> NÃO deve chamar screenPedidoEditar');
});

test('runtime: matchRoute parseia #/pedidos/<uuid>/editar e route.render() chama window.screenPedidoEditar(uuid) (admin-only, C3C1)', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  const uuid = '11111111-2222-3333-4444-555555555555';
  const match = vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/editar')`, sandbox);
  assert.ok(match, 'matchRoute não resolveu #/pedidos/<uuid>/editar');
  assert.equal(typeof match.render, 'function', 'render de #/pedidos/<uuid>/editar não é função');
  // roles admin-only via JSON.
  assert.equal(vm.runInContext(`JSON.stringify(window.matchRoute('#/pedidos/${uuid}/editar').roles)`, sandbox), '["admin"]',
    'roles de #/pedidos/<uuid>/editar deve ser ["admin"]');
  // Executa render e verifica que screenPedidoEditar foi chamado.
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/editar').render();`, sandbox);
  assert.deepEqual(calls.screenPedidoEditar, [uuid],
    'render de #/pedidos/<uuid>/editar deve chamar screenPedidoEditar com o UUID');
  // E NÃO deve chamar screenPedidoDetalhe (rotas distintas).
  assert.equal(calls.screenPedidoDetalhe.length, 0,
    'render de #/pedidos/<uuid>/editar NÃO deve chamar screenPedidoDetalhe');
});

test('runtime: matchRoute rejeita IDs não-UUID para #/pedidos/<uuid>/editar', () => {
  const { sandbox } = makeRouterSandbox();
  // Registra rotas estáticas para o teste (limpa antes e re-popula).
  vm.runInContext(`
    window.RAVATEX_ROUTER.setRoutes({
      '#/pedidos/novo': { render: () => ({}), roles: ['admin'] }
    });
  `, sandbox);
  // IDs não-UUID não devem casar o match dinâmico de edição.
  for (const badId of ['42', 'abc', '12345', 'not-a-uuid', '11111111-2222-3333-4444']) {
    const m = vm.runInContext(`window.matchRoute('#/pedidos/${badId}/editar')`, sandbox);
    assert.equal(m, null, `#/pedidos/${badId}/editar não deve casar rota dinâmica`);
  }
  // A rota estática `#/pedidos/novo` continua resolvendo exato.
  const novo = vm.runInContext("window.matchRoute('#/pedidos/novo')", sandbox);
  assert.ok(novo, '#/pedidos/novo deve continuar resolvendo pela rota estática');
});

test('runtime: matchRoute distingue #/pedidos/<uuid> vs #/pedidos/<uuid>/editar', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  const uuid = '11111111-2222-3333-4444-555555555555';
  // Hash de detalhe
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}').render();`, sandbox);
  // Hash de edição
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/editar').render();`, sandbox);
  assert.deepEqual(calls.screenPedidoDetalhe, [uuid]);
  assert.deepEqual(calls.screenPedidoEditar, [uuid]);
});

test('runtime: matchRoute parseia #/pedidos/<uuid>/itens e route.render() chama window.screenPedidoItensEditar(uuid) (admin-only, C3C2B)', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  const uuid = '11111111-2222-3333-4444-555555555555';
  const match = vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/itens')`, sandbox);
  assert.ok(match, 'matchRoute não resolveu #/pedidos/<uuid>/itens');
  assert.equal(typeof match.render, 'function', 'render de #/pedidos/<uuid>/itens não é função');
  // roles admin-only via JSON.
  assert.equal(vm.runInContext(`JSON.stringify(window.matchRoute('#/pedidos/${uuid}/itens').roles)`, sandbox), '["admin"]',
    'roles de #/pedidos/<uuid>/itens deve ser ["admin"]');
  // Executa render e verifica que screenPedidoItensEditar foi chamado.
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/itens').render();`, sandbox);
  assert.deepEqual(calls.screenPedidoItensEditar, [uuid],
    'render de #/pedidos/<uuid>/itens deve chamar screenPedidoItensEditar com o UUID');
  // E NÃO deve chamar screenPedidoDetalhe nem screenPedidoEditar.
  assert.equal(calls.screenPedidoDetalhe.length, 0,
    'render de #/pedidos/<uuid>/itens NÃO deve chamar screenPedidoDetalhe');
  assert.equal(calls.screenPedidoEditar.length, 0,
    'render de #/pedidos/<uuid>/itens NÃO deve chamar screenPedidoEditar');
});

test('runtime: matchRoute rejeita IDs não-UUID para #/pedidos/<uuid>/itens', () => {
  const { sandbox } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  // IDs não-UUID não devem casar o match dinâmico de itens.
  for (const badId of ['42', 'abc', '12345', 'not-a-uuid', '11111111-2222-3333-4444']) {
    const m = vm.runInContext(`window.matchRoute('#/pedidos/${badId}/itens')`, sandbox);
    assert.equal(m, null, `#/pedidos/${badId}/itens não deve casar rota dinâmica`);
  }
  // `/itens` sem UUID (ex.: `#/pedidos//itens`) não casa.
  const empty = vm.runInContext("window.matchRoute('#/pedidos//itens')", sandbox);
  assert.equal(empty, null, '#/pedidos//itens não deve casar');
});

test('runtime: matchRoute distingue #/pedidos/<uuid>, /editar e /itens', () => {
  const { sandbox, calls } = makeRouterSandbox();
  vm.runInContext("window.RAVATEX_ROUTER.setRoutes({});", sandbox);
  const uuid = '11111111-2222-3333-4444-555555555555';
  // Render detalhe
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}').render();`, sandbox);
  // Render edição
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/editar').render();`, sandbox);
  // Render edição de itens
  vm.runInContext(`window.matchRoute('#/pedidos/${uuid}/itens').render();`, sandbox);
  assert.deepEqual(calls.screenPedidoDetalhe, [uuid]);
  assert.deepEqual(calls.screenPedidoEditar, [uuid]);
  assert.deepEqual(calls.screenPedidoItensEditar, [uuid]);
});
