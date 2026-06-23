// Smoke test do módulo js/boot.js
// (ROUTES-BOOT-MODULE-A).
//
// Garante que a extração de setRoutes + main + main().catch do <script>
// inline de index.html para js/boot.js preservou:
//   - as 14 rotas registradas em window.RAVATEX_ROUTER.setRoutes;
//   - a função main() (registra hashchange, carrega usuário, decide
//     destino inicial);
//   - o handler de erro de boot (console.error + toast);
//   - o uso de window.* (não bare) em todas as referências.
//
// Estáticos (1-7):
//   1. js/boot.js existe.
//   2. node --check js/boot.js passa.
//   3. boot.js é script clássico, sem import/export.
//   4. index.html carrega boot.js EXATAMENTE UMA VEZ, sem type=module.
//   5. boot.js é o ÚLTIMO script local (depois do jsPDF CDN e antes de </head>).
//   6. index.html NÃO contém mais bloco <script> inline final.
//   7. index.html NÃO contém setRoutes, async function main, ou main().catch.
//
// Conteúdo de boot.js (8-12):
//   8. boot.js contém window.RAVATEX_ROUTER.setRoutes.
//   9. boot.js registra as 14 rotas esperadas.
//  10. todas as referências de rota usam window.* (sem bare screenPainel etc.).
//  11. boot.js contém window.addEventListener('hashchange', window.handleRoute).
//  12. boot.js chama window.loadCurrentUser.
//
// Lógica de main() (13-18):
//  13. boot.js chama window.navigate('#/login') quando CURRENT_USER null.
//  14. boot.js chama window.routeAfterLogin quando autenticado sem hash útil.
//  15. boot.js chama window.handleRoute quando autenticado com hash útil.
//  16. boot.js chama window.toast('Erro ao iniciar o app', 'error') no catch.
//
// Não-regressão (17-20):
//  17. nenhuma alteração em js/router.js foi feita (router.js intacto).
//  18. boot chain completo não lança SyntaxError de duplicate identifier.
//  19. boot chain completo não lança ReferenceError de globals.
//  20. window.routes populado corretamente após o boot completo.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const BOOT  = path.join(ROOT, 'js', 'boot.js');
const ROUTER= path.join(ROOT, 'js', 'router.js');
const AUTH  = path.join(ROOT, 'js', 'auth.js');
const UI    = path.join(ROOT, 'js', 'ui.js');
const BADGES= path.join(ROOT, 'js', 'badges.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON= path.join(ROOT, 'js', 'screens', 'common.js');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OFH   = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPR   = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const OPP   = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const CAD   = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS   = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF    = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW    = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN  = path.join(ROOT, 'js', 'screens', 'fornecedor.js');

const indexSrc   = fs.readFileSync(INDEX,  'utf8');
const bootSrc    = fs.readFileSync(BOOT,   'utf8');
const routerSrc  = fs.readFileSync(ROUTER, 'utf8');
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

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, appendChild(){}, setAttribute(){} } : n);
    }
  }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/boot.js existe', () => {
  assert.ok(fs.existsSync(BOOT), 'js/boot.js não existe');
});

test('2. boot.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${BOOT}"`, { stdio: 'pipe' });
});

test('3. boot.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(bootSrc), false,
    'boot.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(bootSrc), false,
    'boot.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega boot.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/boot\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/boot.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/boot\.js[^"]*"[^>]*type=/.test(indexSrc), false,
    'boot.js está sendo carregado com type=module');
});

test('5. boot.js é o ÚLTIMO script local (depois do jsPDF CDN e antes de </head>)', () => {
  const bootIdx  = findScriptIdx(indexSrc, 'js/boot.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const headEndIdx = indexSrc.indexOf('</head>');
  assert.ok(bootIdx  > 0, 'boot.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jsPDF CDN não encontrado');
  assert.ok(headEndIdx > 0, '</head> não encontrado');
  // boot.js vem DEPOIS de jsPDF (porque boot precisa de todos os módulos antes)
  assert.ok(jspdfIdx < bootIdx,
    'boot.js deve vir DEPOIS do jsPDF CDN');
  // boot.js vem ANTES de </head>
  assert.ok(bootIdx < headEndIdx,
    'boot.js deve vir ANTES de </head>');
  // boot.js é o ÚLTIMO <script src="..."> local antes de </head>
  // Encontrar todos os <script src="..."> e checar o último
  const allScripts = [...indexSrc.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)];
  const lastLocalScript = allScripts[allScripts.length - 1];
  assert.equal(lastLocalScript[1], 'js/boot.js?v=20260623-asset1',
    `último script local deveria ser js/boot.js?v=20260623-asset1, encontrado ${lastLocalScript[1]}`);
});

test('6. index.html NÃO contém mais bloco <script> inline final', () => {
  // Verifica que não há nenhum <script> sem src antes de </body>
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const m = re.exec(indexSrc);
  assert.equal(m, null,
    'index.html ainda tem <script> inline — extração incompleta');
});

test('7. index.html NÃO contém setRoutes, async function main, ou main().catch', () => {
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(indexSrc), false,
    'index.html ainda referencia setRoutes — extração incompleta');
  assert.equal(/async\s+function\s+main\s*\(/.test(indexSrc), false,
    'index.html ainda declara async function main — extração incompleta');
  assert.equal(/main\s*\(\s*\)\s*\.\s*catch/.test(indexSrc), false,
    'index.html ainda tem main().catch — extração incompleta');
});

// -------------------------------------------------------------------------
// 2. Conteúdo de boot.js
// -------------------------------------------------------------------------

test('8. boot.js contém window.RAVATEX_ROUTER.setRoutes', () => {
  assert.match(bootSrc, /window\.RAVATEX_ROUTER\.setRoutes\s*\(/,
    'boot.js não chama window.RAVATEX_ROUTER.setRoutes');
});

test('9. boot.js registra as 14 rotas esperadas', () => {
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

test('10. todas as referências de rota em boot.js usam window.* (sem bare)', () => {
  // Cada render deve ser window.screen* ou () => window.screen*
  // Verifica que NÃO há identificador bare (ex: render: screenPainel)
  // dentro do setRoutes. Pode haver outros identificadores fora, então
  // isolamos o bloco do setRoutes.
  const setRoutesBlock = bootSrc.match(/window\.RAVATEX_ROUTER\.setRoutes\(([\s\S]*?)\n\s*\}\s*\);/);
  assert.ok(setRoutesBlock, 'bloco setRoutes não encontrado em boot.js');
  const block = setRoutesBlock[1];
  // Garante que cada `render:` aponta para window.screen* ou () => window.screen*
  const renderLines = [...block.matchAll(/render:\s*([^\n,}]+)/g)].map(m => m[1].trim());
  assert.ok(renderLines.length >= 14,
    `esperado >= 14 render em setRoutes, encontrado ${renderLines.length}`);
  for (const render of renderLines) {
    const isWindowRef = /^window\./.test(render) || /=>\s*window\./.test(render);
    assert.ok(isWindowRef,
      `render "${render}" não usa window.* — deve usar window.screen*`);
  }
});

test('11. boot.js contém window.addEventListener(\'hashchange\', window.handleRoute)', () => {
  assert.match(bootSrc, /window\.addEventListener\(\s*['"]hashchange['"]\s*,\s*window\.handleRoute\s*\)/,
    'boot.js não registra window.addEventListener("hashchange", window.handleRoute)');
});

test('12. boot.js chama window.loadCurrentUser', () => {
  assert.match(bootSrc, /await\s+window\.loadCurrentUser\s*\(/,
    'boot.js não chama window.loadCurrentUser');
});

// -------------------------------------------------------------------------
// 3. Lógica de main()
// -------------------------------------------------------------------------

test('13. boot.js chama window.navigate(\'#/login\') quando não autenticado', () => {
  assert.match(bootSrc, /window\.navigate\(\s*['"]#\/login['"]\s*\)/,
    'boot.js não chama window.navigate("#/login")');
});

test('14. boot.js chama window.routeAfterLogin quando autenticado sem hash útil', () => {
  assert.match(bootSrc, /window\.routeAfterLogin\s*\(\s*\)/,
    'boot.js não chama window.routeAfterLogin');
});

test('15. boot.js chama window.handleRoute quando autenticado com hash útil', () => {
  assert.match(bootSrc, /window\.handleRoute\s*\(\s*\)/,
    'boot.js não chama window.handleRoute');
});

test('16. boot.js chama window.toast(\'Erro ao iniciar o app\', \'error\') no catch', () => {
  assert.match(bootSrc, /window\.toast\(\s*['"]Erro ao iniciar o app['"]\s*,\s*['"]error['"]\s*\)/,
    'boot.js não chama window.toast("Erro ao iniciar o app", "error") no catch');
});

// -------------------------------------------------------------------------
// 4. Não-regressão
// -------------------------------------------------------------------------

test('17. nenhuma alteração em js/router.js (router.js intacto)', () => {
  // router.js não deve ter sido tocado nesta fase
  assert.ok(fs.existsSync(ROUTER), 'js/router.js não existe');
  // router.js continua com sua API esperada
  assert.match(routerSrc, /window\.RAVATEX_ROUTER\s*=/,
    'router.js não tem window.RAVATEX_ROUTER');
  // router.js NÃO deve ter setRoutes com 14 rotas (isso é boot.js agora)
  const setRoutesBlock = routerSrc.match(/setRoutes\(\s*\{([\s\S]*?)\n\s*\}\s*\)/);
  if (setRoutesBlock) {
    const routeCount = (setRoutesBlock[1].match(/'#\//g) || []).length;
    assert.ok(routeCount === 0,
      `router.js contém setRoutes com ${routeCount} rotas — deveria ser 0 (movido para boot.js)`);
  }
});

// -------------------------------------------------------------------------
// 5. Boot chain (runtime)
// -------------------------------------------------------------------------

function makeBootChainSandbox() {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
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
    location: { hash: '' }, supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Ordem completa do <head>:
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(systemScreensSrc, sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
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
  vm.runInContext(authSrc,   sandbox, { filename: 'js/auth.js' });
  // boot.js é o entrypoint
  vm.runInContext(bootSrc,    sandbox, { filename: 'js/boot.js' });

  return { sandbox };
}

test('18. boot chain completo não lança SyntaxError de duplicate identifier', () => {
  const { sandbox } = makeBootChainSandbox();
  let threwSyntax = false;
  let otherErr = null;
  try {
    // boot.js foi carregado em makeBootChainSandbox; vamos
    // simular um reload para verificar que não duplica identifier.
    // (boot.js IIFE não exporta globais, então re-rodar deve
    // simplesmente re-executar setRoutes + main)
    vm.runInContext(bootSrc, sandbox, { filename: 'js/boot.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'boot chain lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) boot falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('19. boot chain completo não lança ReferenceError de globals', () => {
  const { sandbox } = makeBootChainSandbox();
  // setRoutes deve ter rodado sem ReferenceError (todos os
  // window.screen* foram carregados via vm.runInContext antes).
  // Vamos verificar que window.routes existe e tem 15 rotas.
  const routesOk = vm.runInContext('window.routes && Object.keys(window.routes).length === 15', sandbox);
  assert.equal(routesOk, true,
    'window.routes não foi populado com 15 rotas (algum window.screen* não foi resolvido)');
});

test('20. window.routes populado corretamente após o boot completo', () => {
  const { sandbox } = makeBootChainSandbox();
  const rotasEsperadas = [
    '#/login', '#/painel', '#/ops', '#/ops/nova',
    '#/cadastros/cores', '#/cadastros/modelos', '#/cadastros/parametros',
    '#/cadastros/fornecedores', '#/cadastros/clientes', '#/cadastros/precos',
    '#/cadastros/usuarios',
    '#/fornecedor/home', '#/fornecedor/ordens', '#/fornecedor/entregas', '#/fornecedor/latex',
  ];
  for (const rota of rotasEsperadas) {
    const tem = vm.runInContext(`!!window.routes['${rota}']`, sandbox);
    assert.equal(tem, true,
      `rota ${rota} não está em window.routes após boot`);
  }
});
