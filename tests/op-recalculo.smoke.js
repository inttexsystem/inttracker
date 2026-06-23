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
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
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
const opnSrc    = fs.readFileSync(OPN,   'utf8');
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

test('7. op-nova.js chama window.maxMetrosItem (call-site em screenNovaOP)', () => {
  // Após a extração de screenNovaOP para op-nova.js, o call-site
  // window.maxMetrosItem() está em op-nova.js, não mais no inline.
  assert.match(opnSrc, /window\.maxMetrosItem\(/,
    'op-nova.js não referencia window.maxMetrosItem — call-site não foi atualizado');
});

test('8. op-nova.js contém buildProposta (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildProposta\s*\(/.test(inline), false,
    'inline ainda tem buildProposta — extração incompleta');
  assert.match(opnSrc, /function\s+buildProposta\s*\(/,
    'op-nova.js não contém buildProposta');
});

test('9. op-nova.js contém recompute (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+recompute\s*\(/.test(inline), false,
    'inline ainda tem recompute — extração incompleta');
  assert.match(opnSrc, /function\s+recompute\s*\(/,
    'op-nova.js não contém recompute');
});

test('10. op-nova.js contém onAceitar (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+onAceitar\s*\(/.test(inline), false,
    'inline ainda tem onAceitar — extração incompleta');
  assert.match(opnSrc, /function\s+onAceitar\s*\(/,
    'op-nova.js não contém onAceitar');
});

test('11. op-nova.js contém aplicarRecalculo wrapper (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não contém aplicarRecalculo');
});

test('12. op-nova.js NÃO contém writes de saldo_fios_op (write extraído para op-recalculo.js)', () => {
  // O wrapper aplicarRecalculo em op-nova.js apenas chama window.aplicarRecalculoOP
  // que executa os writes. Não há writes diretos em op-nova.js.
  assert.equal(/supa\.from\(['"`]saldo_fios_op['"`]\)/.test(opnSrc), false,
    'op-nova.js ainda tem supa.from("saldo_fios_op") — write deveria ter sido extraído');
  // O literal 'saldo_fios_op' PODE aparecer como string de mensagem
  // em mensagens de erro do aplicarRecalculo wrapper, mas não como chamada.
});

test('13. inline NÃO contém mais from("saldo_fios") como Supabase call', () => {
  const inline = extractInlineScript(indexSrc);
  // Após a extração, o inline NÃO deve ter from('saldo_fios') como
  // chamada Supabase. Pode ter 'saldo_fios_select' etc. como string
  // de mensagens, mas não como tabela.
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios") como chamada Supabase — write deveria ter sido extraído');
});

test('14. op-nova.js contém "em_producao" como string (status em mensagens, NÃO como write direto)', () => {
  // Após a extração, o status 'em_producao' aparece apenas em strings
  // de mensagem em op-nova.js, NÃO como update direto em ops.
  // O write de status foi para op-recalculo.js.
  assert.match(opnSrc, /em_producao/,
    'op-nova.js perdeu literal em_producao — usado em mensagens do wrapper aplicarRecalculo');
  // Verifica que NÃO há write direto de ops.update com em_producao
  assert.equal(/from\s*\(\s*['"]ops['"]\s*\)[\s\S]*?update\s*\(\s*\{[\s\S]*?em_producao/.test(opnSrc), false,
    'op-nova.js ainda tem update em ops com em_producao — write deveria ter sido extraído');
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
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

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

test('25. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('26. setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/,
    'setRoutes não está mais inline');
  assert.match(inline, /async\s+function\s+main\s*\(/,
    'main não está mais inline');
});

// -------------------------------------------------------------------------
// 6. aplicarRecalculoOP — extraído do inline (Seam B)
// -------------------------------------------------------------------------

function makeRecalculoSandbox({
  opItensFailOnCall = null,
  opItensFailAlways = null,
  saldoFiosOpFailAlways = null,
  saldoFiosSelectError = null,
  saldoFiosExistingData = { kg_total: 10 },
  saldoFiosUpdateError = null,
  saldoFiosInsertError = null,
  opsStatusError = null,
} = {}) {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };

  const calls = [];
  let opItensCallCount = 0;

  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      const chain = {
        _table: table,
        _lastMutation: null,
        _payload: null,
        _isFilter: {},
        _eqFilter: {},
        select() { chain._lastMutation = 'select'; return chain; },
        update(payload) { chain._lastMutation = 'update'; chain._payload = payload; return chain; },
        insert(payload) { chain._lastMutation = 'insert'; chain._payload = payload; return chain; },
        delete() { chain._lastMutation = 'delete'; return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', table, col, val });
          chain._eqFilter[col] = val;
          return chain;
        },
        is(col, val) {
          calls.push({ op: 'is', table, col, val });
          chain._isFilter[col] = val;
          return chain;
        },
        order() { return chain; },
        in() { return chain; },
        maybeSingle() {
          if (chain._table === 'saldo_fios') {
            return Promise.resolve({ data: saldoFiosExistingData, error: saldoFiosSelectError });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(resolve, reject) {
          if (chain._table === 'op_itens' && chain._lastMutation === 'update') {
            opItensCallCount++;
            calls.push({ op: 'op_itens_update', call: opItensCallCount });
            if (opItensFailAlways) {
              return Promise.resolve({ data: null, error: new Error('mock op_itens') }).then(resolve, reject);
            }
            if (opItensFailOnCall != null && opItensCallCount === opItensFailOnCall) {
              return Promise.resolve({ data: null, error: new Error('mock op_itens on call ' + opItensFailOnCall) }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios_op' && chain._lastMutation === 'insert') {
            calls.push({ op: 'saldo_fios_op_insert', payload: chain._payload });
            if (saldoFiosOpFailAlways) {
              return Promise.resolve({ data: null, error: new Error('mock saldo_fios_op') }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios' && chain._lastMutation === 'update') {
            calls.push({ op: 'saldo_fios_update', eq: chain._eqFilter, is: chain._isFilter, payload: chain._payload });
            if (saldoFiosUpdateError) {
              return Promise.resolve({ data: null, error: new Error('mock saldo_fios_update') }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios' && chain._lastMutation === 'insert') {
            calls.push({ op: 'saldo_fios_insert', payload: chain._payload });
            if (saldoFiosInsertError) {
              return Promise.resolve({ data: null, error: new Error('mock saldo_fios_insert') }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'ops' && chain._lastMutation === 'update') {
            calls.push({ op: 'ops_update_status', payload: chain._payload });
            if (opsStatusError) {
              return Promise.resolve({ data: null, error: new Error('mock ops') }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
    _calls: calls,
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
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox, fakeSupa, calls };
}

function resultadoAceitar(overrides = {}) {
  return {
    fator: 0.8,
    itens: [
      { op_item_id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 },
      { op_item_id: 101, modelo_id: 2, metros_pedidos: 60, metros_ajustados: 48 },
    ],
    sobras: [
      { ordem_id: 1, tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_sobra: 5 },
      { ordem_id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_sobra: 3 },
    ],
    ...overrides,
  };
}

function ordensManter(extras = []) {
  return [
    { id: 1, tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 30, kg_recebido: 35 },
    { id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 20, kg_recebido: 23 },
    ...extras,
  ];
}

// ---- 1-2: Exports -----------------------------------------------------

test('27. window.aplicarRecalculoOP existe', () => {
  const { sandbox } = makeRecalculoSandbox();
  assert.equal(typeof vm.runInContext('window.aplicarRecalculoOP', sandbox), 'function',
    'window.aplicarRecalculoOP não é função');
});

test('28. window.RAVATEX_SCREENS.opRecalculo.aplicarRecalculoOP existe', () => {
  const { sandbox } = makeRecalculoSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.aplicarRecalculoOP', sandbox),
    'window.RAVATEX_SCREENS.opRecalculo.aplicarRecalculoOP não existe');
});

// ---- 3-7: op_itens.update ---------------------------------------------

test('29. sucesso completo modo="aceitar" retorna { error:null, step:"ok", partial:false }', async () => {
  const { sandbox } = makeRecalculoSandbox();
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.error, null, 'error deveria ser null');
  assert.equal(result.step, 'ok', 'step deveria ser "ok"');
  assert.equal(result.partial, false, 'partial deveria ser false');
});

test('30. sucesso completo modo="manter" retorna sucesso', async () => {
  const { sandbox } = makeRecalculoSandbox();
  sandbox.resultado = { fator: 1, itens: resultadoAceitar().itens, sobras: [] };
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "manter", ordens: ordens })',
    sandbox
  );
  assert.equal(result.error, null);
  assert.equal(result.step, 'ok');
});

test('31. modo="manter" calcula sobras localmente a partir de ordens (kg_recebido - kg_pedido)', async () => {
  const { sandbox, calls } = makeRecalculoSandbox();
  sandbox.resultado = { fator: 1, itens: [], sobras: [] };
  sandbox.ordens = ordensManter();
  await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "manter", ordens: ordens })',
    sandbox
  );
  const insertCalls = calls.filter((c) => c.op === 'saldo_fios_op_insert');
  assert.ok(insertCalls.length >= 2,
    `esperado >=2 inserts em saldo_fios_op, encontrado ${insertCalls.length}`);
  // ordem 1 (algodao): 35-30 = 5; ordem 3 (poliester PRETO): 23-20 = 3
  const algInsert = insertCalls.find((c) => c.payload && c.payload.tipo === 'algodao');
  const polInsert = insertCalls.find((c) => c.payload && c.payload.tipo === 'poliester');
  assert.ok(algInsert, 'devia ter insert tipo algodao');
  assert.ok(polInsert, 'devia ter insert tipo poliester');
  assert.equal(algInsert.payload.kg_sobra, 5);
  assert.equal(polInsert.payload.kg_sobra, 3);
});

test('32. falha em op_itens.update retorna step "op_itens_update" e partial=true', async () => {
  const { sandbox } = makeRecalculoSandbox({ opItensFailAlways: true });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.ok(result.error, 'error deveria estar setado');
  assert.equal(result.step, 'op_itens_update');
  assert.equal(result.partial, true);
});

test('33. falha em op_itens.update no 2º item retorna step "op_itens_update"', async () => {
  const { sandbox, calls } = makeRecalculoSandbox({ opItensFailOnCall: 2 });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  const opItensCalls = calls.filter((c) => c.op === 'op_itens_update');
  assert.equal(opItensCalls.length, 2, 'devia ter 2 chamadas op_itens_update');
  assert.equal(result.step, 'op_itens_update');
  // saldo_fios_op.insert NÃO deve ter sido chamado
  const saldoCalls = calls.filter((c) => c.op === 'saldo_fios_op_insert');
  assert.equal(saldoCalls.length, 0, 'saldo_fios_op_insert não devia ter sido chamado');
});

// ---- 8-13: saldo_fios_op.insert + saldo_fios -------------------------

test('34. falha em saldo_fios_op.insert retorna step "saldo_fios_op_insert"', async () => {
  const { sandbox } = makeRecalculoSandbox({ saldoFiosOpFailAlways: true });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.step, 'saldo_fios_op_insert');
  assert.equal(result.partial, true);
});

test('35. falha em saldo_fios.select retorna step "saldo_fios_select"', async () => {
  const { sandbox } = makeRecalculoSandbox({ saldoFiosSelectError: true });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.step, 'saldo_fios_select');
  assert.equal(result.partial, true);
});

test('36. saldo existente chama saldo_fios.update (NÃO insert)', async () => {
  const { sandbox, calls } = makeRecalculoSandbox({
    saldoFiosExistingData: { kg_total: 100 },
  });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  const updateCalls = calls.filter((c) => c.op === 'saldo_fios_update');
  const insertCalls = calls.filter((c) => c.op === 'saldo_fios_insert');
  assert.ok(updateCalls.length >= 1, 'devia ter >=1 update em saldo_fios');
  assert.equal(insertCalls.length, 0, 'NÃO devia ter insert em saldo_fios');
});

test('37. falha em saldo_fios.update retorna step "saldo_fios_update"', async () => {
  const { sandbox } = makeRecalculoSandbox({
    saldoFiosExistingData: { kg_total: 100 },
    saldoFiosUpdateError: true,
  });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.step, 'saldo_fios_update');
  assert.equal(result.partial, true);
});

test('38. saldo inexistente chama saldo_fios.insert (NÃO update)', async () => {
  const { sandbox, calls } = makeRecalculoSandbox({
    saldoFiosExistingData: null,
  });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  const updateCalls = calls.filter((c) => c.op === 'saldo_fios_update');
  const insertCalls = calls.filter((c) => c.op === 'saldo_fios_insert');
  assert.equal(updateCalls.length, 0, 'NÃO devia ter update em saldo_fios');
  assert.ok(insertCalls.length >= 1, 'devia ter >=1 insert em saldo_fios');
});

test('39. falha em saldo_fios.insert retorna step "saldo_fios_insert"', async () => {
  const { sandbox } = makeRecalculoSandbox({
    saldoFiosExistingData: null,
    saldoFiosInsertError: true,
  });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.step, 'saldo_fios_insert');
  assert.equal(result.partial, true);
});

// ---- 14: ops.update status -------------------------------------------

test('40. falha em ops.update status retorna step "ops_update_status"', async () => {
  const { sandbox } = makeRecalculoSandbox({ opsStatusError: true });
  sandbox.resultado = resultadoAceitar();
  sandbox.ordens = ordensManter();
  const result = await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  assert.equal(result.step, 'ops_update_status');
  assert.equal(result.partial, true);
});

// ---- 15-16: algodão vs poliéster ------------------------------------

test('41. saldo de algodão usa filtro por cor_id (eq)', async () => {
  const { sandbox, calls } = makeRecalculoSandbox();
  // Apenas algodao para isolar o teste
  sandbox.resultado = {
    fator: 0.8,
    itens: [{ op_item_id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 }],
    sobras: [{ ordem_id: 1, tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_sobra: 5 }],
  };
  sandbox.ordens = ordensManter();
  await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  const saldoFiosEqCalls = calls.filter((c) => c.op === 'eq' && c.table === 'saldo_fios');
  const corIdCall = saldoFiosEqCalls.find((c) => c.col === 'cor_id' && c.val === 10);
  assert.ok(corIdCall, 'devia ter eq(cor_id, 10) para saldo_fios de algodao');
  const isNullCall = calls.filter((c) => c.op === 'is' && c.table === 'saldo_fios' && c.col === 'cor_id');
  assert.equal(isNullCall.length, 0, 'algodão NÃO devia usar is(cor_id, null)');
});

test('42. saldo de poliéster usa is("cor_id", null) + eq("cor_poliester", ...)', async () => {
  const { sandbox, calls } = makeRecalculoSandbox();
  // Apenas poliester para isolar o teste
  sandbox.resultado = {
    fator: 0.8,
    itens: [{ op_item_id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 }],
    sobras: [{ ordem_id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_sobra: 3 }],
  };
  sandbox.ordens = ordensManter();
  await vm.runInContext(
    'window.aplicarRecalculoOP({ opId: 42, resultado: resultado, modo: "aceitar", ordens: ordens })',
    sandbox
  );
  const isNullCall = calls.filter((c) => c.op === 'is' && c.table === 'saldo_fios' && c.col === 'cor_id' && c.val === null);
  assert.ok(isNullCall.length >= 1, 'devia ter is(cor_id, null) para poliéster');
  const corPolEq = calls.filter((c) => c.op === 'eq' && c.table === 'saldo_fios' && c.col === 'cor_poliester' && c.val === 'PRETO');
  assert.ok(corPolEq.length >= 1, 'devia ter eq(cor_poliester, PRETO)');
});

// ---- 17-20: helper usa normalizarChaveSaldo + não chama toast/navigate/DOM

test('43. helper usa normalizarChaveSaldo (chamada presente na source)', () => {
  assert.match(oprSrc, /normalizarChaveSaldo\s*\(/,
    'op-recalculo.js deve chamar normalizarChaveSaldo dentro de aplicarRecalculoOP');
});

test('44. helper não chama toast()', () => {
  assert.equal(/toast\s*\(/.test(oprSrc), false,
    'aplicarRecalculoOP não deve chamar toast()');
});

test('45. helper não chama navigate()', () => {
  assert.equal(/navigate\s*\(/.test(oprSrc), false,
    'aplicarRecalculoOP não deve chamar navigate()');
});

test('46. helper não acessa document.* (DOM)', () => {
  assert.equal(/document\./.test(oprSrc), false,
    'aplicarRecalculoOP não deve acessar document');
});

// ---- 21-28: inline aplicarRecalculo (estrutura preservada) -----------

// Extrai o corpo de aplicarRecalculo do source via balanced-brace walk.
// Após SCREENNOVAOP-MODULE-A, a função está em op-nova.js (NÃO no inline).
function extractAplicarRecalculoBlock(src) {
  const start = src.search(/async\s+function\s+aplicarRecalculo\s*\(/);
  if (start < 0) return null;
  // Encontra a primeira `{` (corpo da função)
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 1;
  i++;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return src.slice(start, i);
}

test('47. aplicarRecalculo foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  // Função foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não contém aplicarRecalculo');
});

test('48. bloco de aplicarRecalculo (em op-nova.js) chama window.aplicarRecalculoOP', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.match(block, /window\.aplicarRecalculoOP\s*\(/,
    'bloco de aplicarRecalculo em op-nova.js não chama window.aplicarRecalculoOP');
});

test('49. bloco de aplicarRecalculo (em op-nova.js) mantém saving', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.match(block, /if\s*\(\s*saving\s*\)\s*return/, 'saving check não encontrado');
  assert.match(block, /saving\s*=\s*true/, 'saving = true não encontrado');
  assert.match(block, /saving\s*=\s*false/, 'saving = false (no finally) não encontrado');
});

test('50. bloco de aplicarRecalculo (em op-nova.js) mantém toast', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.match(block, /toast\s*\(/, 'chamada toast não encontrada no bloco');
});

test('51. bloco de aplicarRecalculo (em op-nova.js) mantém navigate("#/ops")', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.match(block, /navigate\s*\(\s*['"]#\/ops['"]\s*\)/,
    'navigate("#/ops") não encontrado no bloco');
});

test('52. bloco de aplicarRecalculo (em op-nova.js) NÃO contém mais saldo_fios_op.insert', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)/.test(block), false,
    'bloco de aplicarRecalculo ainda tem from("saldo_fios_op")');
});

test('53. bloco de aplicarRecalculo (em op-nova.js) NÃO contém mais saldo_fios select/update/insert', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)/.test(block), false,
    'bloco de aplicarRecalculo ainda tem from("saldo_fios")');
});

test('54. bloco de aplicarRecalculo (em op-nova.js) NÃO contém mais ops.update status em_producao', () => {
  const block = extractAplicarRecalculoBlock(opnSrc);
  assert.ok(block, 'bloco de aplicarRecalculo não encontrado em op-nova.js');
  // Procura from('ops') seguido de update com status em_producao
  const re = /from\s*\(\s*['"]ops['"]\s*\)[\s\S]*?update\s*\(\s*\{[\s\S]*?status\s*:\s*['"]em_producao['"]/;
  assert.equal(re.test(block), false,
    'bloco de aplicarRecalculo ainda tem update em ops com em_producao');
});

// ---- 29-32: outras funções continuam inline -------------------------

test('55. persistir NÃO está mais inline (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('56. buildProposta/recompute/onAceitar foram extraídos para op-nova.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildProposta\s*\(/.test(inline), false,
    'inline ainda tem buildProposta — extração incompleta');
  assert.equal(/function\s+recompute\s*\(/.test(inline), false,
    'inline ainda tem recompute — extração incompleta');
  assert.equal(/function\s+onAceitar\s*\(/.test(inline), false,
    'inline ainda tem onAceitar — extração incompleta');
  // Funções foram movidas para op-nova.js
  assert.match(opnSrc, /function\s+buildProposta\s*\(/);
  assert.match(opnSrc, /function\s+recompute\s*\(/);
  assert.match(opnSrc, /function\s+onAceitar\s*\(/);
});

test('57. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('58. setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

// ---- 33: boot chain sem SyntaxError ---------------------------------

test('59. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + painel + op-recalculo + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeRecalculoSandbox();

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

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});
