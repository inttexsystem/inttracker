// Smoke test do módulo js/screens/system-screens.js (SYSTEM-SCREENS-MODULE-A).
//
// Garante que a extração das telas sistêmicas (screenLogin, screenNotFound,
// screenForbidden) do <script> inline de index.html para
// js/screens/system-screens.js preservou o comportamento exato:
//
// Estáticos:
//   1. js/screens/system-screens.js existe;
//   2. é script clássico (não ES module);
//   3. index.html carrega js/screens/system-screens.js EXATAMENTE UMA VEZ;
//   4. ordem auth → router → system-screens → inline;
//   5. inline NÃO contém mais: function screenLogin, function screenNotFound,
//      function screenForbidden;
//   6. inline ainda contém: function screenPainel, function main,
//      window.RAVATEX_ROUTER.setRoutes;
//   7. setRoutes ainda registra a rota #/login;
//   8-9. js/screens/system-screens.js não contém supa.from/.insert/.update/
//      .delete/.rpc;
//  10-11. nenhum service_role nem password literal em
//      js/screens/system-screens.js;
//  12. index.html não contém service_role nem password literal;
//
// Runtime (carrega js/ui.js + js/screens/system-screens.js num vm.Context
// com stubs de login/navigate/routeAfterLogin):
//  13-17. window.RAVATEX_SCREENS / .system / screenLogin / screenNotFound /
//      screenForbidden existem e são funções;
//  18-20. cada tela retorna um nó renderizável (mock);
//  21-23. submit do login chama window.login(email, senha), sucesso chama
//      window.routeAfterLogin(), erro chama window.toast(...);
//  24. screenNotFound chama window.navigate('#/login') no botão;
//  25. screenForbidden chama window.routeAfterLogin() no botão;
//  27. boot: ui.js + badges.js + router.js + system-screens.js + inline
//      coexistem sem SyntaxError de duplicate identifier.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const SYS    = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');

const indexSrc  = fs.readFileSync(INDEX,  'utf8');
const sysSrc    = fs.readFileSync(SYS,    'utf8');
const bootSrc   = fs.readFileSync(BOOT,   'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');
const opsSrc    = fs.readFileSync(OPS,    'utf8');
const efSrc     = fs.readFileSync(EF,     'utf8');
const ewSrc     = fs.readFileSync(EW,     'utf8');
const fornSrc   = fs.readFileSync(FORN,   'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) return bootSrc;
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
// Helper de runtime: FakeNode (DOM mínimo) + document mock, carrega js/ui.js
// (el/toast real) e js/screens/system-screens.js num vm.Context isolado.
// -----------------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.value = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this['_attr_' + k] = v; this[k] = v; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...nodes) { this.children = nodes; }
  remove() { this._removed = true; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => c && c.textContent ? c.textContent : '').join('');
  }
  set textContent(v) { this._text = v; }
}

function walk(node) {
  const out = [];
  function visit(n) {
    if (!n) return;
    out.push(n);
    if (Array.isArray(n.children)) n.children.forEach(visit);
  }
  visit(node);
  return out;
}

function firstByTag(root, tag) {
  return walk(root).find((n) => n.tagName === tag.toUpperCase());
}

function allByTag(root, tag) {
  return walk(root).filter((n) => n.tagName === tag.toUpperCase());
}

function byText(root, text) {
  return walk(root).find((n) => n.textContent === text);
}

function inputByType(root, type) {
  return allByTag(root, 'input').find((n) => n.type === type || n._attr_type === type);
}

function buttonByText(root, text) {
  return allByTag(root, 'button').find((n) => n.textContent === text);
}

function makeSystemScreensSandbox() {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const calls = { login: [], navigate: [], routeAfterLogin: 0, toast: [] };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // js/ui.js fornece el/toast/setApp reais.
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });

  // Stubs espiões (sobrescrevem toast real + login/navigate/routeAfterLogin,
  // que NÃO existem ainda neste ponto do boot real — vêm de auth.js/router.js).
  sandbox.toast = (message, type) => { calls.toast.push({ message, type }); };
  sandbox.login = async (email, senha) => { calls.login.push({ email, senha }); };
  sandbox.navigate = (hash) => { calls.navigate.push(hash); };
  sandbox.routeAfterLogin = async () => { calls.routeAfterLogin++; };

  vm.runInContext(sysSrc, sandbox, { filename: 'js/screens/system-screens.js' });
  return { sandbox, calls, toastsNode };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('js/screens/system-screens.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(SYS), 'js/screens/system-screens.js não existe');
  assert.equal(/^\s*export\s+/m.test(sysSrc), false,
    'system-screens.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(sysSrc), false,
    'system-screens.js parece usar import — deve ser script clássico');
});

test('system-screens.js: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${SYS}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/screens/system-screens.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/system-screens\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/system-screens.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/system-screens\.js(?:\?[^"]*)?"[^>]*type=/.test(indexSrc), false,
    'system-screens.js está sendo carregado com type=module — deve ser script clássico');
});

test('index.html: ordem auth → router → system-screens → inline', () => {
  const authIdx = findScriptIdx(indexSrc, 'js/auth.js');
  const routerIdx = findScriptIdx(indexSrc, 'js/router.js');
  const sysIdx = findScriptIdx(indexSrc, 'js/screens/system-screens.js');
  const bootIdx = findScriptIdx(indexSrc, 'js/boot.js');
  const inlineIdx = bootIdx;
  assert.ok(authIdx > 0, 'js/auth.js não encontrado');
  assert.ok(routerIdx > 0, 'js/router.js não encontrado');
  assert.ok(sysIdx > 0, 'js/screens/system-screens.js não encontrado');
  assert.ok(inlineIdx > 0, 'tag inline não encontrada');
  assert.ok(authIdx < routerIdx, 'auth antes de router');
  assert.ok(routerIdx < sysIdx, 'router antes de system-screens');
  assert.ok(sysIdx < inlineIdx, 'system-screens antes do inline');
});

test('script inline NÃO contém mais screenLogin, screenNotFound, screenForbidden', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+screenLogin\s*\(/.test(inline), false,
    'inline ainda declara function screenLogin');
  assert.equal(/function\s+screenNotFound\s*\(/.test(inline), false,
    'inline ainda declara function screenNotFound');
  assert.equal(/function\s+screenForbidden\s*\(/.test(inline), false,
    'inline ainda declara function screenForbidden');
});

test('script inline ainda contém screenPainel, main e window.RAVATEX_ROUTER.setRoutes', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.screenPainel/);
  assert.match(inline, /function\s+main\s*\(/);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
});

test('setRoutes ainda registra a rota #/login', () => {
  const inline = extractInlineScript(indexSrc);
  assert.ok(inline.includes(`'#/login'`), 'rota #/login não encontrada no setRoutes do inline');
  assert.match(inline, /'#\/login':\s*\{\s*render:\s*window\.screenLogin,\s*public:\s*true\s*\}/);
});

test('js/screens/system-screens.js não contém chamadas Supabase (supa.from/.insert/.update/.delete/.rpc)', () => {
  assert.equal(/supa\.from\s*\(/.test(sysSrc), false, 'supa.from( encontrado');
  assert.equal(/\.insert\s*\(/.test(sysSrc), false, '.insert( encontrado');
  assert.equal(/\.update\s*\(/.test(sysSrc), false, '.update( encontrado');
  assert.equal(/\.delete\s*\(/.test(sysSrc), false, '.delete( encontrado');
  assert.equal(/\.rpc\s*\(/.test(sysSrc), false, '.rpc( encontrado');
});

test('js/screens/system-screens.js: nenhum service_role nem password literal', () => {
  assert.equal(/service_role/i.test(sysSrc), false, 'service_role em system-screens.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(sysSrc), false,
    'password literal longo em system-screens.js');
});

test('index.html: nenhum service_role nem password literal (preservado)', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

// -----------------------------------------------------------------------------
// 2. Validação de runtime
// -----------------------------------------------------------------------------

test('runtime: window.RAVATEX_SCREENS.system existe e expõe as 3 telas', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const screens = vm.runInContext('window.RAVATEX_SCREENS', sandbox);
  assert.ok(screens && typeof screens === 'object', 'RAVATEX_SCREENS não é objeto');
  assert.ok(screens.system && typeof screens.system === 'object', 'RAVATEX_SCREENS.system não é objeto');
  for (const fn of ['screenLogin', 'screenNotFound', 'screenForbidden']) {
    assert.equal(typeof screens.system[fn], 'function', `RAVATEX_SCREENS.system.${fn} ausente`);
  }
});

test('runtime: globais legados window.screenLogin/screenNotFound/screenForbidden são funções', () => {
  const { sandbox } = makeSystemScreensSandbox();
  assert.equal(typeof vm.runInContext('window.screenLogin', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.screenNotFound', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.screenForbidden', sandbox), 'function');
});

test('runtime: screenLogin() retorna nó renderizável com form de login', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenLogin não retornou um <div>');
  const card = walk(root).find((c) => c.className === 'login-card');
  assert.ok(card, 'card de login ausente');
  const form = firstByTag(root, 'form');
  assert.ok(form, 'form ausente dentro do card');
  assert.equal(typeof form._listeners.submit, 'function', 'form não tem listener de submit');
});

test('runtime: screenNotFound() retorna nó renderizável com botão de ação', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenNotFound()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenNotFound não retornou um <div>');
  const btn = root.children.find((c) => c.tagName === 'BUTTON');
  assert.ok(btn, 'botão ausente em screenNotFound');
});

test('runtime: screenForbidden() retorna nó renderizável com botão de ação', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenForbidden()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenForbidden não retornou um <div>');
  const btn = root.children.find((c) => c.tagName === 'BUTTON');
  assert.ok(btn, 'botão ausente em screenForbidden');
});

test('runtime: login renderiza titulo, subtitulo e rodape', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  assert.ok(byText(root, 'Inttex OptiControl'), 'titulo do produto ausente');
  assert.ok(byText(root, 'Entre com seu e-mail e senha'), 'subtitulo ausente');
  assert.ok(byText(root, '© 2026 Inttex · Controle de Tapetes'), 'rodape ausente');
});

test('runtime: login renderiza campos E-mail e Senha com botao Entrar', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  assert.ok(byText(root, 'E-mail'), 'label E-mail ausente');
  assert.ok(byText(root, 'Senha'), 'label Senha ausente');
  assert.ok(inputByType(root, 'email'), 'input de e-mail ausente');
  assert.ok(inputByType(root, 'password'), 'input de senha ausente');
  assert.ok(buttonByText(root, 'Entrar'), 'botao Entrar ausente');
});

test('runtime: login renderiza lembrar-me e esqueceu a senha', () => {
  const { sandbox } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  assert.ok(byText(root, 'Lembrar-me neste dispositivo'), 'checkbox lembrar-me ausente');
  assert.ok(inputByType(root, 'checkbox'), 'input checkbox ausente');
  assert.ok(buttonByText(root, 'Esqueceu a senha?'), 'acao esqueceu a senha ausente');
});

test('runtime: esqueceu a senha mostra placeholder controlado', () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const btn = buttonByText(root, 'Esqueceu a senha?');
  btn._listeners.click();
  assert.ok(calls.toast.some((t) =>
    t.message === 'Recuperação de senha ainda não configurada.' && t.type === 'info'
  ), 'placeholder de recuperacao nao foi exibido');
});

test('runtime: submit do login chama window.login(email, senha)', async () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const form = firstByTag(root, 'form');
  const emailInput = inputByType(form, 'email');
  const senhaInput = inputByType(form, 'password');
  emailInput.value = '  a@b.c  ';
  senhaInput.value = 'minhaSenha123';
  await form._listeners.submit({ preventDefault() {} });
  assert.equal(calls.login.length, 1, 'window.login não foi chamado');
  assert.equal(calls.login[0].email, 'a@b.c', 'email não foi trim()ado antes de login()');
  assert.equal(calls.login[0].senha, 'minhaSenha123');
});

test('runtime: login bem-sucedido chama window.toast("Login OK", "success") e window.routeAfterLogin()', async () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const form = firstByTag(root, 'form');
  const emailInput = inputByType(form, 'email');
  const senhaInput = inputByType(form, 'password');
  emailInput.value = 'a@b.c';
  senhaInput.value = 'segredo';
  await form._listeners.submit({ preventDefault() {} });
  assert.equal(calls.routeAfterLogin, 1, 'window.routeAfterLogin não foi chamado após login bem-sucedido');
  assert.ok(calls.toast.some((t) => t.message === 'Login OK' && t.type === 'success'),
    'window.toast("Login OK", "success") não foi chamado');
});

test('runtime: login com erro chama window.toast(erro) e NÃO chama routeAfterLogin', async () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  vm.runInContext('window.login = async () => { throw new Error("credenciais inválidas"); };', sandbox);
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const form = firstByTag(root, 'form');
  const emailInput = inputByType(form, 'email');
  const senhaInput = inputByType(form, 'password');
  emailInput.value = 'a@b.c';
  senhaInput.value = 'errada';
  await form._listeners.submit({ preventDefault() {} });
  assert.equal(calls.routeAfterLogin, 0, 'routeAfterLogin não deveria ser chamado em erro de login');
  assert.ok(calls.toast.some((t) => t.message === 'E-mail ou senha incorretos' && t.type === 'error'),
    'window.toast de erro não foi chamado');
});

test('runtime: screenNotFound chama window.navigate("#/login") ao clicar no botão', () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenNotFound()', sandbox);
  const btn = root.children.find((c) => c.tagName === 'BUTTON');
  btn._listeners.click();
  assert.deepEqual(calls.navigate, ['#/login']);
});

test('runtime: screenForbidden chama window.routeAfterLogin() ao clicar no botão', () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenForbidden()', sandbox);
  const btn = root.children.find((c) => c.tagName === 'BUTTON');
  btn._listeners.click();
  assert.equal(calls.routeAfterLogin, 1);
});

test('runtime: loading/disabled do botao Entrar e preservado durante login pendente', async () => {
  const { sandbox } = makeSystemScreensSandbox();
  vm.runInContext('window.__loginPromise = new Promise((resolve) => { window.__resolveLogin = resolve; }); window.login = async () => window.__loginPromise;', sandbox);
  const resolveLogin = vm.runInContext('window.__resolveLogin', sandbox);
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const form = firstByTag(root, 'form');
  const btn = buttonByText(root, 'Entrar');
  const pending = form._listeners.submit({ preventDefault() {} });
  assert.equal(btn.disabled, true, 'botao Entrar nao ficou disabled durante loading');
  assert.equal(btn.textContent, 'Entrando...', 'botao Entrar nao exibiu loading');
  resolveLogin();
  await pending;
  assert.equal(btn.disabled, false, 'botao Entrar nao voltou do disabled');
  assert.equal(btn.textContent, 'Entrar', 'botao Entrar nao restaurou label');
});

test('runtime: toggle de senha alterna password/text sem chamar login', () => {
  const { sandbox, calls } = makeSystemScreensSandbox();
  const root = vm.runInContext('window.screenLogin()', sandbox);
  const senhaInput = inputByType(root, 'password');
  const toggle = allByTag(root, 'button').find((b) => b['aria-label'] === 'Mostrar senha');
  assert.ok(toggle, 'botao de mostrar senha ausente');
  toggle._listeners.click();
  assert.equal(senhaInput.type, 'text', 'senha nao alternou para text');
  assert.equal(toggle['aria-label'], 'Ocultar senha');
  toggle._listeners.click();
  assert.equal(senhaInput.type, 'password', 'senha nao voltou para password');
  assert.equal(calls.login.length, 0, 'toggle de senha nao deve chamar login');
});

// -----------------------------------------------------------------------------
// 3. Boot: ui.js + badges.js + router.js + system-screens.js + inline coexistem
// -----------------------------------------------------------------------------

test('boot: ui.js + badges.js + router.js + system-screens.js + inline coexistem sem SyntaxError de duplicate identifier', () => {
  const inline = extractInlineScript(indexSrc);

  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  // common.js define shellLayout/ADMIN_MENU (consumidos por screenPainel
  // e demais telas remanescentes no inline) e cadastros.js define as 7
  // telas de cadastro (consumidas pelo setRoutes do inline).
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });

  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'coexistência system-screens.js + inline lançou SyntaxError de duplicate identifier');

  // setRoutes do inline deve ter rodado e referenciado window.screenLogin sem ReferenceError.
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'] && routes['#/login'].render === vm.runInContext('window.screenLogin', sandbox),
    'setRoutes do inline não referenciou window.screenLogin corretamente');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:', String(otherErr.message).slice(0, 120));
  }
});
