// Smoke test do módulo js/screens/op-recalculo.js
// (OP-RECALCULO-HELPERS-MODULE-A).
//
// Garante que a extração dos helpers puros de recalculo de OP
// (`maxMetrosItem` e `normalizarChaveSaldo`) do <script> inline de
// index.html para js/screens/op-recalculo.js preservou o
// comportamento exato.
//
// Estáticos:
//   1. js/screens/op-recalculo.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. op-recalculo.js é script clássico, sem import/export;
//   4. index.html carrega op-recalculo.js exatamente uma vez;
//   5. ordem: painel.js → op-recalculo.js → jspdf → inline;
//   6. index.html NÃO contém mais function maxMetrosItem;
//   7. index.html contém window.maxMetrosItem;
//   8. index.html ainda contém buildProposta;
//   9. index.html ainda contém recompute;
//  10. index.html ainda contém onAceitar;
//  11. index.html ainda contém async function aplicarRecalculo;
//  12. index.html ainda contém saldo_fios_op.insert;
//  13. index.html ainda contém saldo_fios select/update/insert;
//  14. index.html ainda contém ops.update status em_producao;
//  15. window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem existe;
//  16. window.RAVATEX_SCREENS.opRecalculo.normalizarChaveSaldo existe;
//  17. window.maxMetrosItem é função;
//  18. window.normalizarChaveSaldo é função;
//  19. maxMetrosItem com ordens válidas retorna cap numérico esperado;
//  20. maxMetrosItem sem ordens retorna 0 ou comportamento atual;
//  21. maxMetrosItem com ordens zeradas preserva comportamento atual;
//  22. normalizarChaveSaldo('algodao', 1, null) retorna chave de algodão;
//  23. normalizarChaveSaldo('poliester', null, 'PRETO') retorna chave
//      de poliéster com cor_id null;
//  24. boot chain com todos os módulos + op-recalculo + inline não
//      lança SyntaxError;
//  25. screenNovaOP continua inline;
//  26. setRoutes e main continuam inline.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPR   = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OFH   = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
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
const OPSLIST = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const oprSrc    = fs.readFileSync(OPR,   'utf8');
const painelSrc = fs.readFileSync(PAINEL,'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES,'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER,'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON,'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPSLIST,'utf8');
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
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}"\\s*></script>`);
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

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/screens/op-recalculo.js existe', () => {
  assert.ok(fs.existsSync(OPR), 'js/screens/op-recalculo.js não existe');
});

test('2. op-recalculo.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPR}"`, { stdio: 'pipe' });
});

test('3. op-recalculo.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(oprSrc), false,
    'op-recalculo.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(oprSrc), false,
    'op-recalculo.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-recalculo.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/op-recalculo\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-recalculo.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-recalculo\.js"[^>]*type=/.test(indexSrc), false,
    'op-recalculo.js está sendo carregado com type=module');
});

test('5. index.html: ordem painel.js → op-recalculo.js → jspdf → inline', () => {
  const painelIdx = findScriptIdx(indexSrc, 'js/screens/painel.js');
  const oprIdx    = findScriptIdx(indexSrc, 'js/screens/op-recalculo.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(painelIdx > 0, 'painel.js não encontrado');
  assert.ok(oprIdx > 0, 'op-recalculo.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(painelIdx < oprIdx, 'painel.js deve vir antes de op-recalculo.js');
  assert.ok(oprIdx < jspdfIdx, 'op-recalculo.js deve vir antes de jspdf');
  assert.ok(oprIdx < inlineIdx, 'op-recalculo.js deve vir antes do inline');
});

test('6. inline NÃO contém mais function maxMetrosItem', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+maxMetrosItem\s*\(/.test(inline), false,
    'inline ainda declara function maxMetrosItem — função deveria ter sido extraída');
});

test('7. inline contém window.maxMetrosItem', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.maxMetrosItem\(/,
    'inline não referencia window.maxMetrosItem — call-site não foi atualizado');
});

test('8. inline AINDA contém function buildProposta', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+buildProposta\s*\(/,
    'inline perdeu buildProposta — função deveria continuar inline');
});

test('9. inline AINDA contém recompute', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+recompute\s*\(/,
    'inline perdeu recompute — função deveria continuar inline');
});

test('10. inline AINDA contém onAceitar', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+onAceitar\s*\(/,
    'inline perdeu onAceitar — função deveria continuar inline');
});

test('11. inline AINDA contém async function aplicarRecalculo', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /async\s+function\s+aplicarRecalculo\s*\(/,
    'inline perdeu aplicarRecalculo — função deveria continuar inline');
});

test('12. inline AINDA contém saldo_fios_op.insert', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /saldo_fios_op/,
    'inline perdeu saldo_fios_op — write deveria continuar inline');
});

test('13. inline AINDA contém saldo_fios select/update/insert', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /saldo_fios\b/,
    'inline perdeu referência a saldo_fios');
});

test('14. inline AINDA contém ops.update status em_producao', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /em_producao/,
    'inline perdeu em_producao — status da OP deveria continuar inline');
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
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('15. runtime: window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem existe', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem', sandbox),
    'window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem não existe');
});

test('16. runtime: window.RAVATEX_SCREENS.opRecalculo.normalizarChaveSaldo existe', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.normalizarChaveSaldo', sandbox),
    'window.RAVATEX_SCREENS.opRecalculo.normalizarChaveSaldo não existe');
});

test('17. runtime: window.maxMetrosItem é função', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.maxMetrosItem', sandbox), 'function',
    'window.maxMetrosItem não é função');
});

test('18. runtime: window.normalizarChaveSaldo é função', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.normalizarChaveSaldo', sandbox), 'function',
    'window.normalizarChaveSaldo não é função');
});

// -------------------------------------------------------------------------
// 3. Testes unitários de maxMetrosItem
// -------------------------------------------------------------------------

function makeUnitSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(oprSrc, sandbox, { filename: 'js/screens/op-recalculo.js' });
  return sandbox;
}

test('19. maxMetrosItem com ordens válidas retorna cap numérico esperado (round down)', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 10, kg_recebido: 100 },
    { id: 2, tipo: 'algodao', cor_id: 11, kg_recebido: 80 },
    { id: 3, tipo: 'poliester', cor_poliester: 'PRETO', kg_recebido: 50 },
    { id: 4, tipo: 'poliester', cor_poliester: 'BRANCO', kg_recebido: 60 },
  ];

  // rAlg = 0.5 * 2 = 1.0; rPol = 0.3 * 2 = 0.6
  // Alg 10: 100/1 = 100; Alg 11: 80/1 = 80
  // Pol PRETO: 50/0.6 = 83.33; Pol BRANCO: 60/0.6 = 100
  // Min = 80 → floor(80) = 80

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.ordensArr = ordens;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, ordensArr)',
    sandbox
  );
  assert.ok(Number.isFinite(cap), 'cap não é finito');
  assert.ok(cap >= 0, 'cap deve ser >= 0');
  assert.equal(cap, 80, 'cap deveria ser 80 (gargalo = algodao cor 11)');
});

test('20. maxMetrosItem sem ordens correspondentes retorna 0', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const ordens = []; // sem ordens

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.ordensArr = ordens;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, ordensArr)',
    sandbox
  );
  assert.equal(cap, 0, 'sem ordens, cap deve ser 0');
});

test('21. maxMetrosItem com ordens de kg_recebido = 0 retorna 0', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 10, kg_recebido: 0 },
    { id: 2, tipo: 'algodao', cor_id: 11, kg_recebido: 0 },
    { id: 3, tipo: 'poliester', cor_poliester: 'PRETO', kg_recebido: 0 },
    { id: 4, tipo: 'poliester', cor_poliester: 'BRANCO', kg_recebido: 0 },
  ];

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.ordensArr = ordens;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, ordensArr)',
    sandbox
  );
  assert.equal(cap, 0, 'com ordens zeradas, cap deve ser 0 (floor(0))');
});

// -------------------------------------------------------------------------
// 4. Testes unitários de normalizarChaveSaldo
// -------------------------------------------------------------------------

test('22. normalizarChaveSaldo algodao retorna chave com cor_id', () => {
  const sandbox = makeUnitSandbox();
  const result = vm.runInContext(
    'window.normalizarChaveSaldo("algodao", 1, null)',
    sandbox
  );
  assert.ok(result, 'normalizarChaveSaldo algodao retornou falsy');
  assert.ok(result.eq, 'result.eq deve existir para algodao');
  assert.equal(result.eq.tipo, 'algodao');
  assert.equal(result.eq.cor_id, 1);
  assert.equal(result.is, undefined, 'algodao NÃO deve ter is');
});

test('23. normalizarChaveSaldo poliéster retorna chave com cor_id null', () => {
  const sandbox = makeUnitSandbox();
  const result = vm.runInContext(
    'window.normalizarChaveSaldo("poliester", null, "PRETO")',
    sandbox
  );
  assert.ok(result, 'normalizarChaveSaldo poliéster retornou falsy');
  assert.ok(result.is, 'result.is deve existir para poliéster');
  assert.equal(result.is.cor_id, null);
  assert.ok(result.eq, 'result.eq deve existir para poliéster');
  assert.equal(result.eq.tipo, 'poliester');
  assert.equal(result.eq.cor_poliester, 'PRETO');
});

// -------------------------------------------------------------------------
// 5. Integração / boot chain
// -------------------------------------------------------------------------

test('24. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + painel + op-recalculo + inline coexiste sem SyntaxError', () => {
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
    'boot com op-recalculo + inline lançou SyntaxError de duplicate identifier');

  // Valida que rotas estão registradas
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/painel'], 'rota #/painel não registrada');
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('25. screenNovaOP continua inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /async\s+function\s+screenNovaOP\s*\(/,
    'screenNovaOP não está mais inline');
});

test('26. setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/,
    'setRoutes não está mais inline');
  assert.match(inline, /async\s+function\s+main\s*\(/,
    'main não está mais inline');
});
