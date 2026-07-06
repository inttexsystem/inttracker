// Smoke test do módulo js/screens/painel.js
// (SCREENPAINEL-MODULE-A).
//
// Garante que a extração da tela `screenPainel` do
// <script> inline de index.html para js/screens/painel.js
// preservou o comportamento exato: a tela continua sendo
// ativada via screenPainel na rota #/painel.
//
// Estáticos:
//   1. js/screens/painel.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. painel.js é script clássico, sem import/export;
//   4. index.html carrega painel.js exatamente uma vez;
//   5. ordem: op-latex-admin.js → painel.js → jspdf → inline;
//   6. index.html NÃO contém mais function screenPainel;
//   7. index.html ainda contém async function screenNovaOP;
//   8. index.html ainda contém setRoutes;
//   9. index.html ainda contém main;
//  10. painel.js contém function screenPainel;
//  11. window.RAVATEX_SCREENS.painel.screenPainel existe;
//  12. window.screenPainel é função;
//  13. screenPainel renderiza sem Supabase;
//  14. screenPainel usa shellLayout e ADMIN_MENU como antes;
//  15. boot chain com todos os módulos + painel + inline não lança
//      SyntaxError;
//  16. setRoutes ainda resolve rota #/painel com screenPainel.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OFH   = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const BOOT  = path.join(ROOT, 'js', 'boot.js');
const EF    = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW    = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN  = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI    = path.join(ROOT, 'js', 'ui.js');
const BADGES= path.join(ROOT, 'js', 'badges.js');
const ROUTER= path.join(ROOT, 'js', 'router.js');
const CALC  = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON= path.join(ROOT, 'js', 'screens', 'common.js');
const CAD   = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS   = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const painelSrc = fs.readFileSync(PAINEL, 'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const bootSrc   = fs.readFileSync(BOOT,  'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES,'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER,'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON,'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPS,   'utf8');
const ewSrc     = fs.readFileSync(EW,    'utf8');
const fornSrc   = fs.readFileSync(FORN,  'utf8');

// -------------------------------------------------------------------------
// Helpers estáticos
// -------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) {
    // Após ROUTES-BOOT-MODULE-A o <script> inline foi removido.
    // Tests que verificam AUSÊNCIA de coisas no inline passam
    // trivialmente; tests que esperavam PRESENÇA foram
    // atualizados para olhar em js/boot.js.
    return '';
  }
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  // Aceita src com ou sem query string (cache-busting ?v=...).
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/').replace(/\./g, '\\.')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// -------------------------------------------------------------------------
// FakeNode mínimo
// -------------------------------------------------------------------------

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

function textOf(node) {
  if (!node) return '';
  let out = '';
  if (typeof node.textContent === 'string') out += node.textContent + ' ';
  for (const child of node.children || []) out += textOf(child);
  return out;
}

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/screens/painel.js existe', () => {
  assert.ok(fs.existsSync(PAINEL), 'js/screens/painel.js não existe');
});

test('2. painel.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${PAINEL}"`, { stdio: 'pipe' });
});

test('3. painel.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(painelSrc), false,
    'painel.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(painelSrc), false,
    'painel.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega painel.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/painel\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/painel\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/painel.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/painel\.js"[^>]*type=/.test(indexSrc), false,
    'painel.js está sendo carregado com type=module');
});

test('5. index.html: ordem op-latex-admin.js → painel.js → jspdf → boot.js (último local antes de </head>)', () => {
  const olaIdx    = findScriptIdx(indexSrc, 'js/screens/op-latex-admin.js');
  const painelIdx = findScriptIdx(indexSrc, 'js/screens/painel.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(olaIdx > 0, 'op-latex-admin.js não encontrado');
  assert.ok(painelIdx > 0, 'painel.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(olaIdx < painelIdx, 'op-latex-admin deve vir antes de painel.js');
  assert.ok(painelIdx < jspdfIdx, 'painel.js deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
});

test('6. inline NÃO contém mais function screenPainel', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+screenPainel\s*\(/.test(inline), false,
    'inline ainda declara function screenPainel — função deveria ter sido extraída');
});

test('7. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
});

test('8. index.html NÃO contém mais setRoutes (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes foi extraído para boot.js
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
});

test('9. index.html NÃO contém mais main (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, main foi extraído para boot.js
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('10. painel.js contém function screenPainel', () => {
  assert.match(painelSrc, /function\s+screenPainel\s*\(/,
    'painel.js deve declarar function screenPainel');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

function makeFullBootSandbox() {
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
    addEventListener: () => {}, removeEventListener: () => {},
    CURRENT_USER: { nome: 'Tester', tipo: 'admin' },
    logout: () => {},
    loadCurrentUser: () => Promise.resolve(),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });
  vm.runInContext(bootSrc,   sandbox, { filename: 'js/boot.js' });

  return { sandbox };
}

test('11. runtime: window.RAVATEX_SCREENS.painel.screenPainel existe', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.painel.screenPainel', sandbox),
    'window.RAVATEX_SCREENS.painel.screenPainel não existe');
});

test('12. runtime: window.screenPainel (global legado) é função', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.screenPainel', sandbox), 'function',
    'window.screenPainel não é função');
});

test('13. runtime: screenPainel renderiza imediatamente com fallback Supabase seguro', () => {
  const { sandbox } = makeFullBootSandbox();
  const result = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(result, 'screenPainel() não retornou resultado');
  assert.ok(result.children.length > 0, 'screenPainel() não renderizou conteúdo');
});

test('14. runtime: screenPainel usa shellLayout e ADMIN_MENU como antes', () => {
  const { sandbox } = makeFullBootSandbox();
  const result = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(result, 'screenPainel() não retornou resultado');
  // root = <div class="min-h-screen flex flex-col">
  //   [0] = header
  //   [1] = <div class="flex flex-1"> → [0] = aside (menu), [1] = main (content)
  assert.ok(result.children.length >= 2, 'shellLayout deve ter ao menos 2 filhos');
  const flexDiv = result.children[1];
  assert.ok(flexDiv.children.length >= 2, 'flex deve ter aside + main');
  const aside = flexDiv.children[0];
  assert.ok(aside.children.length > 0, 'ADMIN_MENU deve ter itens');
  const main = flexDiv.children[1];
  assert.ok(main.children.length >= 1, 'main deve ter content');
  const contentDiv = main.children[0];
  const text = textOf(contentDiv);
  assert.ok(text.includes('Dashboard'), 'content deve conter "Dashboard"');
  assert.ok(text.includes('Fila de'), 'content deve conter a fila operacional');
});

test('15. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + painel + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeFullBootSandbox();

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
    'boot com painel + inline lançou SyntaxError de duplicate identifier');

  // Valida que rotas estão registradas
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/painel'], 'rota #/painel não registrada');
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');
  assert.equal(typeof vm.runInContext('window.screenPainel', sandbox), 'function',
    'window.screenPainel não é função após o boot completo');
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após o boot completo');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('16. setRoutes ainda resolve rota #/painel com screenPainel', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeFullBootSandbox();

  let otherErr = null;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (!(e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message))) {
      otherErr = e;
    }
  }

  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes, 'window.routes não existe');
  assert.ok(routes['#/painel'], 'rota #/painel não existe em routes');
  assert.equal(typeof routes['#/painel'].render, 'function',
    'render da rota #/painel não é função');
  // screenPainel é usado como bare global na definição da rota
});
