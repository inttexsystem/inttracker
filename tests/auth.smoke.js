// Smoke test do módulo js/auth.js (AUTH-MODULE-A).
//
// Garante que a extração do bloco AUTH do script inline de index.html
// para js/auth.js preservou o comportamento exato:
//
//   1. módulo existe, é script clássico (não ES module);
//   2. index.html carrega js/auth.js depois de js/environment-banner.js
//      e antes do script inline principal;
//   3. script inline NÃO contém mais as declarações de CURRENT_USER,
//      login, logout, loadCurrentUser, nem as chamadas a supa.auth.*;
//   4. script inline ainda contém routeAfterLogin, handleRoute,
//      screenLogin, marcador === ROUTER ===;
//   5. window.RAVATEX_AUTH é criado no runtime;
//   6. window.login, window.logout, window.loadCurrentUser são funções;
//   7. window.CURRENT_USER é definido via getter/setter (Object.defineProperty);
//   8. login chama signInWithPassword com { email, password: senha };
//   9. logout chama signOut, zera CURRENT_USER e navega para #/login;
//  10. loadCurrentUser chama getSession + from('usuarios') com o select
//      esperado e cacheia fornecedor_tipo;
//  11. USER_ROLES e FORNECEDOR_SUBTIPOS exportados com valores canônicos;
//  12. isAdmin e isFornecedor funcionam;
//  13. service_role e password literal NÃO aparecem.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const http   = require('node:http');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const CFG   = path.join(ROOT, 'js', 'config.js');
const SUPA  = path.join(ROOT, 'js', 'supabase-client.js');
const ENV   = path.join(ROOT, 'js', 'environment-banner.js');
const AUTH  = path.join(ROOT, 'js', 'auth.js');

const cfgSrc   = fs.readFileSync(CFG,  'utf8');
const supaSrc  = fs.readFileSync(SUPA, 'utf8');
const envSrc   = fs.readFileSync(ENV,  'utf8');
const authSrc  = fs.readFileSync(AUTH, 'utf8');
const indexSrc = fs.readFileSync(INDEX, 'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}"\\s*><\\/script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// -----------------------------------------------------------------------------
// Helpers de runtime
// -----------------------------------------------------------------------------

// Cria um client Supabase FAKE identificável.
function makeFakeSupabaseClient(overrides = {}) {
  const calls = [];
  const record = (op) => (...args) => {
    calls.push({ op, args });
    if (op === 'auth.signInWithPassword') {
      return Promise.resolve({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null });
    }
    if (op === 'auth.signOut') return Promise.resolve({ error: null });
    if (op === 'auth.getSession') {
      if (overrides.session !== undefined) {
        return Promise.resolve({ data: { session: overrides.session }, error: null });
      }
      return Promise.resolve({ data: { session: null }, error: null });
    }
    if (op === 'select') {
      if (overrides.userData) {
        return Promise.resolve({ data: overrides.userData, error: overrides.userError || null });
      }
      return Promise.resolve({ data: {
        id: 'u1', email: 'a@b.c', nome: 'Test', tipo: 'admin',
        fornecedor_id: null, fornecedores: null,
      }, error: overrides.userError || null });
    }
    return Promise.resolve({ data: null, error: null });
  };
  // Builder encadeável: select/eq retornam o mesmo builder (com single).
  const queryBuilder = () => {
    const b = {};
    b.select = (...args) => { record('select')(...args); return b; };
    b.eq = (...args) => { calls.push({ op: 'eq', args }); return b; };
    b.single = (...args) => record('select')(...args);
    return b;
  };
  return {
    from: (table) => { calls.push({ op: 'from', args: [table] }); return queryBuilder(); },
    auth: {
      signInWithPassword: record('auth.signInWithPassword'),
      signOut: record('auth.signOut'),
      getSession: record('auth.getSession'),
    },
    _calls: calls,
  };
}

function makeSupabaseMock() {
  return {
    createClient: (url, key) => {
      const client = makeFakeSupabaseClient();
      client._url = url; client._key = key;
      return client;
    },
  };
}

// Carrega config.js + supabase-client.js + environment-banner.js + auth.js
// num vm.Context com Supabase mockado, DOM mock mínimo, location e
// (opcional) navigate mockado.
//
// Opções:
//   - session:        override para getSession (default: null)
//   - userError:      error object devolvido por .select().single() (default: null)
//   - userData:       data object devolvido por .select().single() (default: { id, ... })
//   - withNavigate:   se true, injeta window.navigate mockado
function runSandbox({ hostname = 'localhost', withNavigate = true, session, userError, userData, withFornecedorTipo } = {}) {
  const overrides = {};
  if (session !== undefined) overrides.session = session;
  if (userError !== undefined) overrides.userError = userError;
  if (userData !== undefined) overrides.userData = userData;
  if (withFornecedorTipo !== undefined) {
    overrides.userData = {
      id: 'u1', email: 'a@b.c', nome: 'Test', tipo: 'admin',
      fornecedor_id: 'f1', fornecedores: { tipo: withFornecedorTipo },
    };
  }
  const fakeSupa = makeFakeSupabaseClient(overrides);
  const fakeSupabase = {
    createClient: (url, key) => {
      fakeSupa._url = url; fakeSupa._key = key;
      return fakeSupa;
    },
  };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    document: documentMock,
    supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  if (withNavigate) {
    const navigations = [];
    sandbox.window_navigateMock = (hash) => { navigations.push(hash); };
    sandbox.window_navigations = navigations;
    sandbox.window = null;
  }
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Carrega os módulos na ordem do <head>
  vm.runInContext(cfgSrc,  sandbox, { filename: 'js/config.js' });
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  vm.runInContext(envSrc,  sandbox, { filename: 'js/environment-banner.js' });

  if (withNavigate) {
    vm.runInContext(
      'window.navigate = window_navigateMock;',
      sandbox, { filename: 'inject-navigate.js' }
    );
  }

  vm.runInContext(authSrc, sandbox, { filename: 'js/auth.js' });

  return { sandbox, fakeSupa };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('js/auth.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(AUTH), 'js/auth.js não existe');
  assert.equal(/^\s*export\s+/m.test(authSrc), false,
    'js/auth.js parece usar export — deve ser script clássico');
});

test('js/auth.js: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${AUTH}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/auth.js EXATAMENTE UMA VEZ no <head>', () => {
  const re = /<script\s+src="js\/auth\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/auth.js">, encontrado ${matches.length}`);
});

test('index.html: ordem config → supabase-client → environment-banner → auth → inline', () => {
  const cfgIdx   = findScriptIdx(indexSrc, 'js/config.js');
  const supaIdx  = findScriptIdx(indexSrc, 'js/supabase-client.js');
  const envIdx   = findScriptIdx(indexSrc, 'js/environment-banner.js');
  const authIdx  = findScriptIdx(indexSrc, 'js/auth.js');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(cfgIdx   > 0, 'js/config.js não encontrado');
  assert.ok(supaIdx  > 0, 'js/supabase-client.js não encontrado');
  assert.ok(envIdx   > 0, 'js/environment-banner.js não encontrado');
  assert.ok(authIdx  > 0, 'js/auth.js não encontrado');
  assert.ok(inlineIdx > 0, 'tag inline não encontrada');
  assert.ok(cfgIdx  < supaIdx,  'config antes de supabase-client');
  assert.ok(supaIdx < envIdx,   'supabase-client antes de environment-banner');
  assert.ok(envIdx  < authIdx,  'environment-banner antes de auth');
  assert.ok(authIdx  < inlineIdx, 'auth antes do inline');
});

test('script inline NÃO contém mais as declarações de CURRENT_USER, login, logout, loadCurrentUser', () => {
  const inline = extractInlineScript(indexSrc);
  // O inline não pode mais conter as definições de auth. Comentários
  // podem mencionar os nomes, mas não como DECLARAÇÃO.
  assert.equal(/\blet\s+CURRENT_USER\s*=/.test(inline), false,
    'script inline ainda tem `let CURRENT_USER =`');
  assert.equal(/\basync\s+function\s+login\s*\(/.test(inline), false,
    'script inline ainda define `async function login`');
  assert.equal(/\basync\s+function\s+logout\s*\(/.test(inline), false,
    'script inline ainda define `async function logout`');
  assert.equal(/\basync\s+function\s+loadCurrentUser\s*\(/.test(inline), false,
    'script inline ainda define `async function loadCurrentUser`');
  // Supabase Auth methods não podem ser chamados do inline
  assert.equal(/supa\.auth\.signInWithPassword/.test(inline), false,
    'script inline ainda chama supa.auth.signInWithPassword');
  assert.equal(/supa\.auth\.signOut/.test(inline), false,
    'script inline ainda chama supa.auth.signOut');
  assert.equal(/supa\.auth\.getSession/.test(inline), false,
    'script inline ainda chama supa.auth.getSession');
  // A query da tabela usuarios para carregar perfil também saiu
  assert.equal(/from\(['"]usuarios['"]\)\s*\n?\s*\.select\(['"][^'"]*fornecedores:fornecedor_id/.test(inline), false,
    'script inline ainda tem a query `from("usuarios")` do loadCurrentUser');
});

test('script inline ainda contém screenLogin (tela permanece no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+screenLogin/);
});

// ROUTER-MODULE-A: routeAfterLogin, handleRoute e o marcador === ROUTER ===
// foram extraídos do inline para js/router.js. O inline NÃO pode mais
// declará-los nem conter o marcador antigo (senão duplica os globais que
// js/router.js define). O inline apenas registra as rotas via setRoutes.
test('script inline NÃO declara mais routeAfterLogin/handleRoute nem o marcador === ROUTER === (extraídos p/ js/router.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+routeAfterLogin/.test(inline), false,
    'script inline ainda declara routeAfterLogin — deveria vir de js/router.js');
  assert.equal(/function\s+handleRoute/.test(inline), false,
    'script inline ainda declara handleRoute — deveria vir de js/router.js');
  assert.equal(/=== ROUTER ===/.test(inline), false,
    'script inline ainda contém o marcador === ROUTER ===');
  // E passou a registrar as rotas no módulo extraído.
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
});

test('js/auth.js: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(authSrc), false,
    'service_role encontrado em js/auth.js');
});

test('js/auth.js: nenhum password literal de credencial real', () => {
  // Não pode haver string `password = '...'` com valor de credencial
  // (anon keys, etc). Aceita-se `password: senha` que é só field name.
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(authSrc), false,
    'password literal longo encontrado em js/auth.js');
});

test('index.html: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(indexSrc), false,
    'service_role encontrado em index.html');
});

test('index.html: nenhum password literal de credencial real', () => {
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo encontrado em index.html');
});

test('js/auth.js: usa Object.defineProperty para CURRENT_USER (getter/setter)', () => {
  assert.match(authSrc, /Object\.defineProperty\s*\(\s*window\s*,\s*['"]CURRENT_USER['"]/,
    'js/auth.js não usa Object.defineProperty para window.CURRENT_USER');
  assert.match(authSrc, /get\s*\(\s*\)\s*\{/);
  assert.match(authSrc, /set\s*\(\s*value\s*\)\s*\{/);
  assert.match(authSrc, /configurable\s*:\s*true/);
  assert.match(authSrc, /enumerable\s*:\s*true/);
});

// -----------------------------------------------------------------------------
// 2. Validação de runtime
// -----------------------------------------------------------------------------

test('runtime: window.RAVATEX_AUTH é criado', () => {
  const { sandbox } = runSandbox();
  const ns = vm.runInContext('window.RAVATEX_AUTH', sandbox);
  assert.ok(ns && typeof ns === 'object', 'RAVATEX_AUTH não é objeto');
  assert.equal(typeof ns.login, 'function');
  assert.equal(typeof ns.logout, 'function');
  assert.equal(typeof ns.loadCurrentUser, 'function');
  assert.equal(typeof ns.getCurrentUser, 'function');
  assert.equal(typeof ns.setCurrentUser, 'function');
  assert.equal(typeof ns.isAdmin, 'function');
  assert.equal(typeof ns.isFornecedor, 'function');
  assert.ok(ns.USER_ROLES, 'USER_ROLES ausente');
  assert.ok(ns.FORNECEDOR_SUBTIPOS, 'FORNECEDOR_SUBTIPOS ausente');
});

test('runtime: window.login, window.logout, window.loadCurrentUser são funções', () => {
  const { sandbox } = runSandbox();
  assert.equal(typeof vm.runInContext('window.login', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.logout', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.loadCurrentUser', sandbox), 'function');
});

test('runtime: window.CURRENT_USER inicia como null', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null);
});

test('runtime: window.CURRENT_USER é getter/setter (não variável simples)', () => {
  const { sandbox } = runSandbox();
  // Verifica via descriptor que CURRENT_USER tem getter/setter.
  const desc = vm.runInContext(
    'Object.getOwnPropertyDescriptor(window, "CURRENT_USER")',
    sandbox
  );
  assert.ok(desc, 'descriptor ausente — não é propriedade configurada');
  assert.equal(typeof desc.get, 'function', 'getter ausente');
  assert.equal(typeof desc.set, 'function', 'setter ausente');
  assert.equal(desc.configurable, true, 'configurable deveria ser true');
  assert.equal(desc.enumerable, true, 'enumerable deveria ser true');
});

test('runtime: atribuir window.CURRENT_USER = { tipo: "admin" } atualiza RAVATEX_AUTH.getCurrentUser()', () => {
  const { sandbox } = runSandbox();
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  const u = vm.runInContext('window.RAVATEX_AUTH.getCurrentUser()', sandbox);
  assert.ok(u);
  assert.equal(u.tipo, 'admin');
});

test('runtime: RAVATEX_AUTH.setCurrentUser(null) atualiza window.CURRENT_USER', () => {
  const { sandbox } = runSandbox();
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  vm.runInContext('window.RAVATEX_AUTH.setCurrentUser(null);', sandbox);
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null);
});

test('runtime: login chama signInWithPassword com { email, password: senha }', async () => {
  const { sandbox, fakeSupa } = runSandbox();
  await vm.runInContext('window.login("a@b.c", "minhaSenha123")', sandbox);
  const signInCalls = fakeSupa._calls.filter(c => c.op === 'auth.signInWithPassword');
  assert.equal(signInCalls.length, 1, 'signInWithPassword não foi chamado');
  const arg = signInCalls[0].args[0];
  assert.ok(arg && typeof arg === 'object', 'arg não é objeto');
  assert.equal(arg.email, 'a@b.c', `email divergente: ${arg.email}`);
  assert.equal(arg.password, 'minhaSenha123', `password divergente: ${arg.password}`);
});

test('runtime: loadCurrentUser chama supa.auth.getSession()', async () => {
  const { sandbox, fakeSupa } = runSandbox({ session: { user: { id: 'u1' } } });
  await vm.runInContext('window.loadCurrentUser()', sandbox);
  const sessCalls = fakeSupa._calls.filter(c => c.op === 'auth.getSession');
  assert.ok(sessCalls.length >= 1, 'getSession não foi chamado');
});

test('runtime: loadCurrentUser com session consulta from("usuarios") com select esperado', async () => {
  // Cria fakeSupa customizado que captura o arg de .select()
  const calls = [];
  const captured = { selectArg: null };
  const qb = () => {
    const b = {};
    b.select = (arg) => { captured.selectArg = arg; calls.push({ op: 'select', args: [arg] }); return b; };
    b.eq = () => b;
    b.single = () => Promise.resolve({ data: {
      id: 'u1', email: 'a@b.c', nome: 'Test', tipo: 'admin',
      fornecedor_id: null, fornecedores: null,
    }, error: null });
    return b;
  };
  const fakeSupa = {
    from: (table) => { calls.push({ op: 'from', args: [table] }); return qb(); },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }),
    },
    _calls: calls,
  };
  const fakeSupabase = { createClient: () => fakeSupa };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname: 'localhost', href: 'http://localhost/index.html' },
    document: documentMock, supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc,  sandbox, { filename: 'js/config.js' });
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  vm.runInContext(envSrc,  sandbox, { filename: 'js/environment-banner.js' });
  vm.runInContext(authSrc, sandbox, { filename: 'js/auth.js' });

  await vm.runInContext('window.loadCurrentUser()', sandbox);
  assert.match(captured.selectArg,
    /id, email, nome, tipo, fornecedor_id, fornecedores:fornecedor_id\(tipo\)/,
    `select arg não tem o formato esperado: ${captured.selectArg}`);
});

test('runtime: loadCurrentUser cacheia fornecedor_tipo em CURRENT_USER', async () => {
  const { sandbox } = runSandbox({
    session: { user: { id: 'u1' } },
    withFornecedorTipo: 'tecelagem',
  });
  await vm.runInContext('window.loadCurrentUser()', sandbox);
  const ft = vm.runInContext('window.CURRENT_USER.fornecedor_tipo', sandbox);
  assert.equal(ft, 'tecelagem');
});

test('runtime: loadCurrentUser sem session retorna null e zera CURRENT_USER', async () => {
  // session não é passada — mock devolve { session: null } por default
  const { sandbox } = runSandbox();
  // Pré-popula CURRENT_USER para verificar que é zerado
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  const result = await vm.runInContext('window.loadCurrentUser()', sandbox);
  assert.equal(result, null);
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null);
});

test('runtime: loadCurrentUser com erro de from("usuarios") retorna null, zera CURRENT_USER e chama console.error', async () => {
  // Monta o sandbox manualmente para conseguir interceptar console.error
  // ANTES de criar o vm.Context (sandbox.console é capturado por valor).
  const calls = [];
  const qb = () => {
    const b = {};
    b.select = () => b;
    b.eq = () => b;
    b.single = () => Promise.resolve({ data: null, error: { message: 'boom', code: 'XX' } });
    return b;
  };
  const fakeSupa = {
    from: (table) => { calls.push({ op: 'from', args: [table] }); return qb(); },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }),
    },
    _calls: calls,
  };
  const fakeSupabase = { createClient: () => fakeSupa };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  let loggedError = null;
  const consoleWithCapture = {
    log: () => {}, info: () => {}, warn: () => {},
    error: (...args) => { loggedError = args[0]; consoleWithCapture._lastCall = args; },
    debug: () => {},
  };
  const sandbox = {
    console: consoleWithCapture,
    URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname: 'localhost', href: 'http://localhost/index.html' },
    document: documentMock, supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc,  sandbox, { filename: 'js/config.js' });
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  vm.runInContext(envSrc,  sandbox, { filename: 'js/environment-banner.js' });
  vm.runInContext(authSrc, sandbox, { filename: 'js/auth.js' });

  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  const result = await vm.runInContext('window.loadCurrentUser()', sandbox);
  assert.equal(result, null);
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null);
  assert.ok(loggedError, `console.error não foi chamado. lastCall: ${JSON.stringify(consoleWithCapture._lastCall)}`);
  // LoggedError pode ser string ou Error dependendo de como vm.Context
  // serializa. Acessa .message se for objeto.
  const msg = loggedError && typeof loggedError === 'object' ? loggedError.message : String(loggedError);
  assert.match(msg, /Erro carregando perfil/);
});

test('runtime: logout chama supa.auth.signOut(), zera CURRENT_USER e navega para #/login', async () => {
  const { sandbox, fakeSupa } = runSandbox();
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  await vm.runInContext('window.logout()', sandbox);
  // signOut foi chamado
  const signOutCalls = fakeSupa._calls.filter(c => c.op === 'auth.signOut');
  assert.equal(signOutCalls.length, 1, 'signOut não foi chamado');
  // CURRENT_USER foi zerado
  assert.equal(vm.runInContext('window.CURRENT_USER', sandbox), null);
  // navigate foi chamado
  const navs = vm.runInContext('window_navigations', sandbox);
  assert.equal(navs.length, 1, 'navigate não foi chamado');
  assert.equal(navs[0], '#/login');
});

test('runtime: USER_ROLES.ADMIN === "admin"', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.USER_ROLES.ADMIN', sandbox), 'admin');
});

test('runtime: USER_ROLES.FORNECEDOR === "fornecedor"', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.USER_ROLES.FORNECEDOR', sandbox), 'fornecedor');
});

test('runtime: FORNECEDOR_SUBTIPOS.LATEX === "latex"', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.FORNECEDOR_SUBTIPOS.LATEX', sandbox), 'latex');
});

test('runtime: FORNECEDOR_SUBTIPOS tem FIO_ALGODAO, FIO_POLIESTER, TECELAGEM, LATEX', () => {
  const { sandbox } = runSandbox();
  const subs = vm.runInContext('window.RAVATEX_AUTH.FORNECEDOR_SUBTIPOS', sandbox);
  assert.equal(subs.FIO_ALGODAO, 'fio_algodao');
  assert.equal(subs.FIO_POLIESTER, 'fio_poliester');
  assert.equal(subs.TECELAGEM, 'tecelagem');
  assert.equal(subs.LATEX, 'latex');
});

test('runtime: isAdmin() retorna true só quando CURRENT_USER.tipo === "admin"', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isAdmin()', sandbox), false);
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isAdmin()', sandbox), true);
  vm.runInContext('window.CURRENT_USER = { tipo: "fornecedor" };', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isAdmin()', sandbox), false);
  vm.runInContext('window.CURRENT_USER = null;', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isAdmin()', sandbox), false);
});

test('runtime: isFornecedor() retorna true só quando CURRENT_USER.tipo === "fornecedor"', () => {
  const { sandbox } = runSandbox();
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isFornecedor()', sandbox), false);
  vm.runInContext('window.CURRENT_USER = { tipo: "fornecedor" };', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isFornecedor()', sandbox), true);
  vm.runInContext('window.CURRENT_USER = { tipo: "admin" };', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isFornecedor()', sandbox), false);
  vm.runInContext('window.CURRENT_USER = null;', sandbox);
  assert.equal(vm.runInContext('window.RAVATEX_AUTH.isFornecedor()', sandbox), false);
});

// -----------------------------------------------------------------------------
// 3. Integração: serve o index.html via http.server e valida ordem dos scripts
// -----------------------------------------------------------------------------

test('http.server: index.html servido contém js/auth.js antes do inline', (t, done) => {
  const srv = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexSrc);
    } else if (req.url === '/js/config.js' || req.url === '/js/supabase-client.js' ||
               req.url === '/js/environment-banner.js' || req.url === '/js/auth.js') {
      const file = req.url === '/js/config.js' ? cfgSrc
        : req.url === '/js/supabase-client.js' ? supaSrc
        : req.url === '/js/environment-banner.js' ? envSrc
        : authSrc;
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(file);
    } else {
      res.writeHead(404); res.end();
    }
  });
  srv.listen(0, '127.0.0.1', () => {
    const port = srv.address().port;
    http.get({ host: '127.0.0.1', port, path: '/index.html' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const cfgIdx   = body.indexOf('js/config.js');
          const supaIdx  = body.indexOf('js/supabase-client.js');
          const envIdx   = body.indexOf('js/environment-banner.js');
          const authIdx  = body.indexOf('js/auth.js');
          const inlineIdx = body.indexOf('<script>');
          assert.ok(cfgIdx > 0);
          assert.ok(supaIdx > 0);
          assert.ok(envIdx > 0);
          assert.ok(authIdx > 0);
          assert.ok(inlineIdx > 0);
          assert.ok(cfgIdx < supaIdx, 'config antes de supabase-client');
          assert.ok(supaIdx < envIdx, 'supabase-client antes de environment-banner');
          assert.ok(envIdx < authIdx, 'environment-banner antes de auth');
          assert.ok(authIdx < inlineIdx, 'auth antes do inline');
          srv.close();
          done();
        } catch (e) { srv.close(); done(e); }
      });
    }).on('error', (e) => { srv.close(); done(e); });
  });
});
