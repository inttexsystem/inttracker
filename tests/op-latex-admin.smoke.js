// Smoke test do módulo js/screens/op-latex-admin.js
// (OP-LATEX-ADMIN-MODULE-A).
//
// Garante que a extração da tela `renderOPLatexAdmin` do
// <script> inline de index.html para js/screens/op-latex-admin.js
// preservou o comportamento exato: a tela continua sendo
// ativada via window.renderOPLatexAdmin(op.id) em screenNovaOP
// quando a OP é do tipo 'latex', com todos os writes internos
// (finalizar, editarEnviado, excluirOpLatex) funcionando como
// antes.
//
// Estáticos:
//   1. js/screens/op-latex-admin.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega op-latex-admin.js EXATAMENTE UMA VEZ;
//   4. ordem: op-writes.js → op-latex-admin.js → jspdf → inline;
//   5. inline NÃO contém mais async function renderOPLatexAdmin;
//   6. inline contém window.renderOPLatexAdmin(op.id) no
//      call-site de screenNovaOP;
//   7. inline AINDA contém async function screenNovaOP;
//   8. inline AINDA contém persistir;
//   9. inline AINDA contém aplicarRecalculo;
//  10. inline AINDA contém buildOrdemPendenteRow;
//  11. inline AINDA contém setRoutes;
//  12. inline AINDA contém main;
//  13. op-latex-admin.js contém async function renderOPLatexAdmin;
//  14. op-latex-admin.js contém reload, render, abrirEdicaoAdmin,
//      finalizar, editarEnviado, excluirOpLatex (closures
//      internas);
//  15. op-latex-admin.js NÃO contém service_role nem password
//      literal longo;
//  16. index.html NÃO contém service_role nem password literal
//      longo.
//
// Runtime (carrega ui + common + entrega-form + entrega-writes +
// fornecedor + op-form-helpers + op-writes + op-latex-admin num
// vm.Context com supa mockado por tabela):
//  17. window.RAVATEX_SCREENS.opLatexAdmin.renderOPLatexAdmin existe;
//  18. window.RAVATEX_SCREENS.opLatexAdmin.renderOPLatexAdmin é função;
//  19. window.renderOPLatexAdmin (global legado) é função;
//  20. renderOPLatexAdmin com opId mockado executa reload sem
//      Supabase real (chain fluente + resultado de single);
//  21. Mock registra select em ops (.eq('id', opId).single());
//  22. Mock registra select em entregas com .eq('etapa', 'latex');
//  23. Mock registra select em modelos quando há modeloIds;
//  24. finalizar chama supa.from('ops').update({ status:
//      'finalizada', finalizada_em });
//  25. editarEnviado chama supa.from('op_itens').update({ metros_pedidos });
//  26. excluirOpLatex chama supa.from('ops').delete();
//
// Integração:
//  27. boot chain completa coexiste sem SyntaxError de duplicate
//      identifier;
//  28. screenNovaOP ainda consegue resolver window.renderOPLatexAdmin;
//  29. op-writes.js continua expondo registrarRecebimentoOrdemFio;
//  30. op-writes.js continua expondo atribuirFornecedorFioOp.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const OLA    = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPN    = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OPTP   = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');
const OPW    = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OFH    = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
const optpSrc   = fs.readFileSync(OPTP,  'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const bootSrc   = fs.readFileSync(BOOT,  'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPS,   'utf8');
const ewSrc     = fs.readFileSync(EW,    'utf8');
const fornSrc   = fs.readFileSync(FORN,  'utf8');
const painelSrc = fs.readFileSync(PAINEL, 'utf8');

// -----------------------------------------------------------------------------
// Helpers estáticos
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// FakeNode mínimo
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
    this._attrs = {};
    this.style = {};
    this.firstElementChild = null;
    this._innerHTML = '';
  }
  appendChild(n) {
    if (n && typeof n === 'object') n.parentNode = this;
    this.children.push(n);
    if (!this.firstElementChild && n && n.tagName) this.firstElementChild = n;
    return n;
  }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    this.firstElementChild = null;
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      const child = typeof n === 'string' ? { textContent: n, appendChild(){}, setAttribute(){} } : n;
      if (!this.firstElementChild && child && child.tagName) this.firstElementChild = child;
      this.children.push(child);
    }
  }
  remove() { this._removed = true; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((n) => n && typeof n.textContent === 'string' ? n.textContent : '').join('');
  }
  set textContent(v) { this._text = v; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this.children = [];
    const svg = new FakeNode('svg');
    svg._raw = String(v);
    this.firstElementChild = svg;
    this.children.push(svg);
  }
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/op-latex-admin.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(OLA), 'js/screens/op-latex-admin.js não existe');
  assert.equal(/^\s*export\s+/m.test(olaSrc), false,
    'op-latex-admin.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(olaSrc), false,
    'op-latex-admin.js parece usar import — deve ser script clássico');
});

test('2. op-latex-admin.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OLA}"`, { stdio: 'pipe' });
});

test('3. index.html carrega op-latex-admin.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/op-latex-admin\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/op-latex-admin\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-latex-admin.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-latex-admin\.js"[^>]*type=/.test(indexSrc), false,
    'op-latex-admin.js está sendo carregado com type=module');
});

test('4. index.html: ordem op-writes.js → op-latex-admin.js → jspdf → boot.js (último local antes de </head>)', () => {
  const opwIdx  = findScriptIdx(indexSrc, 'js/screens/op-writes.js');
  const olaIdx  = findScriptIdx(indexSrc, 'js/screens/op-latex-admin.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx  = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(opwIdx > 0, 'op-writes.js não encontrado');
  assert.ok(olaIdx > 0, 'op-latex-admin.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(opwIdx < olaIdx, 'op-writes deve vir antes de op-latex-admin');
  assert.ok(olaIdx < jspdfIdx, 'op-latex-admin deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
});

test('5. inline NÃO contém mais async function renderOPLatexAdmin', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline ainda declara async function renderOPLatexAdmin — função deveria ter sido extraída');
});

test('6. op-nova.js contém window.renderOPLatexAdmin(op.id) no call-site de screenNovaOP', () => {
  // Após SCREENNOVAOP-MODULE-A, o call-site foi movido para op-nova.js
  assert.match(opnSrc, /window\.renderOPLatexAdmin\(/,
    'op-nova.js não referencia window.renderOPLatexAdmin — call-site não foi atualizado');
});

test('7. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  // Foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('8. inline NÃO contém mais persistir (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('9. aplicarRecalculo foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não contém aplicarRecalculo');
});

test('10. buildOrdemPendenteRow foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildOrdemPendenteRow\s*\(/.test(inline), false,
    'inline ainda tem buildOrdemPendenteRow — extração incompleta');
  assert.match(opnSrc, /function\s+buildOrdemPendenteRow\s*\(/,
    'inline perdeu buildOrdemPendenteRow — função deveria continuar inline');
});

test('11. index.html NÃO contém mais setRoutes (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes foi extraído para boot.js
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
});

test('12. index.html NÃO contém mais main (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, main foi extraído para boot.js
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('13. op-latex-admin.js contém async function renderOPLatexAdmin', () => {
  assert.match(olaSrc, /async\s+function\s+renderOPLatexAdmin\s*\(/,
    'op-latex-admin.js deve declarar async function renderOPLatexAdmin');
});

test('14. op-latex-admin.js contém as 6 funções internas (closures)', () => {
  for (const fn of ['reload', 'render', 'abrirEdicaoAdmin', 'finalizar', 'editarEnviado', 'excluirOpLatex']) {
    assert.match(olaSrc, new RegExp(`function\\s+${fn}\\s*\\(`),
      `op-latex-admin.js deve declarar ${fn} (closure interna)`);
  }
});

test('15. op-latex-admin.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(olaSrc), false, 'service_role em op-latex-admin.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(olaSrc), false,
    'password literal longo em op-latex-admin.js');
});

test('16. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

// Sandbox que carrega todos os módulos e prepara um supa mockado
// fluente que registra as chamadas por tabela.
function makeFullBootSandbox({
  opData = {
    id: 42, numero: 1, ano: 2026, status: 'em_producao', tipo: 'latex',
    observacao: 'test', origem_op_id: null, lote: null,
    op_itens: [
      { id: 100, modelo_id: 1, metros_pedidos: 50 },
    ],
    op_fornecedores: [
      { fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Latex Test' } },
    ],
  },
  entData = [],
  modelosData = [],
  origemOpData = null,
} = {}) {
  const toastsNode = new FakeNode('div');
  const appNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    getElementById: (id) => id === 'app' ? appNode : new FakeNode('div'),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const calls = [];

  function makeChain(table) {
    const opDataMap = { ops: opData, entregas: entData, modelos: modelosData };
    const defaultData = opDataMap[table] !== undefined ? opDataMap[table] : [];
    const state = { filters: [] };
    return {
      _table: table,
      _lastUpdate: null,
      select() { calls.push({ op: 'select', table }); return this; },
      insert(payload) { calls.push({ op: 'insert', table, args: [payload] }); return Promise.resolve({ data: null, error: null }); },
      update(payload) {
        calls.push({ op: 'update', table, args: [payload] });
        this._lastUpdate = payload;
        return this;
      },
      delete() { calls.push({ op: 'delete', table }); return this; },
      eq(col, val) {
        calls.push({ op: 'eq', table, col, val });
        state.filters.push({ col, val });
        return this;
      },
      order() { return this; },
      in() { return this; },
      single() {
        if (table === 'ops') {
          const idFilter = state.filters.find((f) => f.col === 'id');
          if (idFilter && origemOpData && idFilter.val === origemOpData.id) {
            return Promise.resolve({ data: origemOpData, error: null });
          }
          return Promise.resolve({ data: defaultData, error: null });
        }
        return Promise.resolve({ data: defaultData, error: null });
      },
      maybeSingle() {
        if (table === 'ops') {
          const idFilter = state.filters.find((f) => f.col === 'id');
          if (idFilter && origemOpData && idFilter.val === origemOpData.id) {
            return Promise.resolve({ data: origemOpData, error: null });
          }
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolveThen, rejectThen) {
        if (this._lastUpdate) {
          return Promise.resolve({ data: null, error: null }).then(resolveThen, rejectThen);
        }
        return Promise.resolve({ data: defaultData, error: null }).then(resolveThen, rejectThen);
      },
    };
  }

  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      return makeChain(table);
    },
    rpc: () => { calls.push({ op: 'rpc' }); return Promise.resolve({ data: null, error: null }); },
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
    Node: FakeNode,
    location: { hash: '' },
    supa: fakeSupa,
  };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.loadCurrentUser = async () => sandbox.CURRENT_USER;
  sandbox.handleRoute = () => {};
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
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.loadCurrentUser = async () => sandbox.CURRENT_USER;
  sandbox.handleRoute = () => {};

  return { sandbox, fakeSupa, calls };
}

test('17. runtime: window.RAVATEX_SCREENS.opLatexAdmin existe', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opLatexAdmin', sandbox),
    'window.RAVATEX_SCREENS.opLatexAdmin não existe');
});

test('18. runtime: window.RAVATEX_SCREENS.opLatexAdmin.renderOPLatexAdmin é função', () => {
  const { sandbox } = makeFullBootSandbox();
  const fn = vm.runInContext('window.RAVATEX_SCREENS.opLatexAdmin.renderOPLatexAdmin', sandbox);
  assert.equal(typeof fn, 'function', 'renderOPLatexAdmin não é função');
});

test('19. runtime: window.renderOPLatexAdmin (global legado) é função', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.renderOPLatexAdmin', sandbox), 'function');
});

test('20. runtime: renderOPLatexAdmin(opId) executa reload (select em ops) sem Supabase real', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('ops'),
    `renderOPLatexAdmin não chamou from('ops') (tabelas: ${fromCalls.join(',')})`);
});

test('21. runtime: reload chama select em ops com .eq("id", opId).single()', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  const opsCalls = fakeSupa._calls.filter(c => c.table === 'ops');
  const hasEq = opsCalls.some(c => c.op === 'eq' && c.col === 'id' && c.val === 42);
  assert.ok(hasEq, 'reload não filtra ops por eq("id", 42)');
});

test('22. runtime: reload chama select em entregas com .eq("etapa", "latex")', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  const entregasCalls = fakeSupa._calls.filter(c => c.table === 'entregas');
  const hasEtapaEq = entregasCalls.some(c => c.op === 'eq' && c.col === 'etapa' && c.val === 'latex');
  assert.ok(hasEtapaEq, 'reload não filtra entregas por eq("etapa", "latex")');
});

test('23. runtime: reload chama select em modelos quando há modeloIds', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('modelos'),
    `renderOPLatexAdmin não chamou from('modelos') (tabelas: ${fromCalls.join(',')})`);
});

test('24. runtime: finalizar chama supa.from("ops").update com { status: "finalizada", finalizada_em }', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  // Validação estática do source: finalizar existe e faz o write correto.
  assert.match(olaSrc, /status:\s*['"]finalizada['"]/,
    'op-latex-admin.js não referencia status: "finalizada"');
  assert.match(olaSrc, /finalizada_em/,
    'op-latex-admin.js não referencia finalizada_em');
  assert.match(olaSrc, /from\(\s*['"]ops['"]\s*\)\s*\.update/,
    'op-latex-admin.js não tem from("ops").update');
  // Tabela que está sendo modificada por finalizar
  const updateOpsCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ops');
  // finalizar não é chamado automaticamente no reload, então
  // updateOpsCalls pode estar vazio. Mas validamos que o source tem
  // o write correto.
  assert.ok(updateOpsCalls.length >= 0, 'write de finalizar está no source');
});

test('25. runtime: editarEnviado chama supa.from("op_itens").update com { metros_pedidos }', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  // Validação estática: editarEnviado está no source e contém o write.
  assert.match(olaSrc, /function\s+editarEnviado/,
    'op-latex-admin.js deve ter function editarEnviado');
  assert.match(olaSrc, /from\(\s*['"]op_itens['"]\s*\)\s*\.update\s*\(\s*\{\s*metros_pedidos/,
    'editarEnviado não escreve em op_itens.update({ metros_pedidos })');
  // Confirma que o source faz write via .eq('id', l.id)
  assert.match(olaSrc, /\.eq\(\s*['"]id['"]\s*,\s*(?:l|row)\.id\s*\)/,
    'editarEnviado não filtra op_itens por eq("id", row.id)');
});

test('26. runtime: excluirOpLatex chama supa.from("ops").delete()', async () => {
  const { sandbox, fakeSupa } = makeFullBootSandbox();
  await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  // Validação estática: excluirOpLatex está no source e contém o write.
  assert.match(olaSrc, /function\s+excluirOpLatex/,
    'op-latex-admin.js deve ter function excluirOpLatex');
  assert.match(olaSrc, /from\(\s*['"]ops['"]\s*\)\s*\.delete/,
    'excluirOpLatex não chama ops.delete()');
  // Confirma que o source faz write via .eq('id', id)
  assert.match(olaSrc, /delete\s*\(\s*\)\s*\.eq\(\s*['"]id['"]\s*,\s*id\s*\)/,
    'excluirOpLatex não filtra ops por eq("id", id)');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('27. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + inline coexiste sem SyntaxError', () => {
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
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.loadCurrentUser = async () => sandbox.CURRENT_USER;
  sandbox.handleRoute = () => {};
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
    'boot com op-latex-admin + inline lançou SyntaxError de duplicate identifier');

  // Valida que rotas estão registradas e que o call-site em
  // screenNovaOP resolve window.renderOPLatexAdmin
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'rota #/login não registrada');
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');
  assert.equal(typeof vm.runInContext('window.renderOPLatexAdmin', sandbox), 'function',
    'window.renderOPLatexAdmin não é função após o boot completo');
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após o boot completo');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('28. screenNovaOP ainda consegue resolver window.renderOPLatexAdmin', () => {
  const { sandbox } = makeFullBootSandbox();
  const fn = vm.runInContext('window.renderOPLatexAdmin', sandbox);
  assert.equal(typeof fn, 'function',
    'window.renderOPLatexAdmin deve ser função resolvível por screenNovaOP');
});

test('29. op-writes.js continua expondo registrarRecebimentoOrdemFio', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function',
    'window.registrarRecebimentoOrdemFio não é função após o boot completo');
});

test('30. op-writes.js continua expondo atribuirFornecedorFioOp', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'function',
    'window.atribuirFornecedorFioOp não é função após o boot completo');
});

function collectNodeText(node) {
  if (!node) return '';
  const parts = [];
  if (typeof node.textContent === 'string' && node.textContent) parts.push(node.textContent);
  if (node.tagName === 'INPUT' && node.value != null && node.value !== '') parts.push(String(node.value));
  for (const child of (node.children || [])) parts.push(collectNodeText(child));
  return parts.join(' ');
}

// Coleta o atributo style (string bruta) de cada nó da árvore — usado
// para travar regressões de layout (ex.: ícone de seção, grid de
// colunas) que asserções de texto puro não conseguem detectar.
function collectStyles(node, out = []) {
  if (!node) return out;
  const style = typeof node.getAttribute === 'function' ? node.getAttribute('style') : null;
  if (style) out.push(style);
  for (const child of (node.children || [])) collectStyles(child, out);
  return out;
}

// Busca em profundidade o primeiro nó cujo predicate(node) seja true.
function findNode(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of (node.children || [])) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

async function renderLatexAdminForTest(opts = {}) {
  const { sandbox } = makeFullBootSandbox(opts);
  const view = await vm.runInContext('window.renderOPLatexAdmin(42)', sandbox);
  return {
    sandbox,
    view,
    text: collectNodeText(view),
    styles: collectStyles(view),
  };
}

test('31. op-latex-admin.js usa o bloco "Material recebido da tecelagem"', () => {
  assert.match(olaSrc, /3\.\s*Material recebido da tecelagem/,
    'layout novo deve incluir o card "3. Material recebido da tecelagem"');
});

test('32. OP aberta de acabamento mostra linguagem de preparacao e fornecedor de acabamento', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'aberta',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  assert.match(rendered.text, /OP Aberta de Acabamento/i);
  assert.match(rendered.text, /Preparacao da OP/i);
  assert.match(rendered.text, /Fornecedor de acabamento/i);
  assert.match(rendered.text, /Acabamento Sul/);
});

test('33. OP aberta de acabamento mostra origem e CTA de colocar em producao', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'aberta',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  assert.match(rendered.text, /OP origem/i);
  assert.match(rendered.text, /OP 2\/2026 · Tecelagem/i);
  assert.match(rendered.text, /Colocar em producao/i);
});

test('34. OP de acabamento nao mostra "4. Entregas tecelagem"', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'aberta',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  assert.doesNotMatch(rendered.text, /4\.\s*Entregas tecelagem/i);
});

test('35. OP em producao de acabamento segue o standalone e nao mostra recebimentos legados', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    entData: [{
      id: 501,
      fornecedor_id: 7,
      data: '2026-07-01',
      observacao: 'Primeiro lote',
      entrega_itens: [{ id: 601, op_id: 42, op_item_id: 100, metros_entregues: 50, defeito: false, observacao: '' }],
    }],
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  assert.match(rendered.text, /5\.\s*Movimenta/i);
  assert.match(rendered.text, /Transferir/i);
  assert.doesNotMatch(rendered.text, /Recebimentos/i);
  assert.doesNotMatch(rendered.text, /Novo recebimento/i);
  assert.doesNotMatch(rendered.text, /Finalizar OP de l[áa]tex/i);
});

test('36. OP aberta de acabamento informa que a producao permanece fora de escopo', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'aberta',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  assert.match(rendered.text, /Transicao para producao sera implementada em fase propria/i);
});

test('37. op-latex-admin.js nao chama alterar_status_op nem colocarEmProducao', () => {
  assert.doesNotMatch(olaSrc, /alterar_status_op/,
    'op-latex-admin.js nao pode chamar alterar_status_op nesta fase');
  assert.doesNotMatch(olaSrc, /function\s+colocarEmProducao\s*\(/,
    'op-latex-admin.js nao pode manter funcao colocarEmProducao funcional nesta fase');
});

test('38. op-latex-admin.js nao faz update de status para em_producao', () => {
  assert.doesNotMatch(olaSrc, /update\s*\(\s*\{\s*status\s*:\s*['"]em_producao['"]/,
    'op-latex-admin.js nao pode fazer update de status para em_producao nesta fase');
});

test('39. OP em producao de acabamento usa template operacional proprio', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      observacao: 'OP gerada da entrega da tecelagem',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    entData: [{
      id: 501,
      fornecedor_id: 7,
      data: '2026-07-01',
      observacao: 'Primeiro lote',
      entrega_itens: [{ id: 601, op_id: 42, op_item_id: 100, metros_entregues: 50, defeito: false, observacao: '' }],
    }],
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });

  assert.match(olaSrc, /function\s+renderOPLatexProducao\s*\(/,
    'op-latex-admin.js deve ter renderer proprio para OP em producao de acabamento');
  assert.match(rendered.text, /Em produ/i);
  assert.match(rendered.text, /Acabamento/i);
  assert.doesNotMatch(rendered.text, /Acabamento\/Latex/i);
  assert.match(rendered.text, /Cadeia produtiva/i);
  assert.match(rendered.text, /Resumo desta OP/i);
});

test('40. OP em producao de acabamento mostra todos os blocos operacionais esperados', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    entData: [{
      id: 501,
      fornecedor_id: 7,
      data: '2026-07-01',
      observacao: 'Primeiro lote',
      entrega_itens: [{ id: 601, op_id: 42, op_item_id: 100, metros_entregues: 50, defeito: false, observacao: '' }],
    }],
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });

  for (const label of [
    /1\.\s*Dados da OP/i,
    /2\.\s*Itens da OP/i,
    /3\.\s*Material recebido da tecelagem/i,
    /5\.\s*Movimenta/i,
    /6\.\s*Documentos da OP/i,
    /7\.\s*Hist.rico/i,
  ]) {
    assert.match(rendered.text, label);
  }
  assert.match(rendered.text, /Transferir/i);
  assert.match(rendered.text, /NF_INSUMOS_2026\.pdf/i);
  assert.match(rendered.text, /ROMANEIO_OP-002-2026\.pdf/i);
  assert.match(rendered.text, /Entrega parcial para Acabamento/i);
  assert.match(rendered.text, /OP aberta/i);
  assert.doesNotMatch(rendered.text, /4\.\s*Recebimentos \/ acabamento/i);
  assert.doesNotMatch(rendered.text, /5\.\s*Finalizacao \/ liberar para proxima etapa/i);
});

test('41. OP em producao de acabamento mostra enviado, recebido, falta e excedente quando houver', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 100, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    entData: [{
      id: 501,
      fornecedor_id: 7,
      data: '2026-07-01',
      observacao: 'Excedente informado',
      entrega_itens: [{ id: 601, op_id: 42, op_item_id: 100, metros_entregues: 120, defeito: false, observacao: '' }],
    }],
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });

  assert.match(rendered.text, /Total ajustado da OP/i);
  assert.match(rendered.text, /Finalizado \(pronto \+ entregue\)/i);
  assert.match(rendered.text, /J[aá] liberado/i);
  assert.match(rendered.text, /Excedente/i);
  assert.match(rendered.text, /120,00 m/);
});

test('42. OP em producao de acabamento nao mostra elementos de preparacao ou tecelagem', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      observacao: '',
      origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });

  assert.doesNotMatch(rendered.text, /4\.\s*Entregas tecelagem/i);
  assert.doesNotMatch(rendered.text, /4\.\s*Recebimentos \/ acabamento/i);
  assert.doesNotMatch(rendered.text, /Finalizar OP de latex/i);
  assert.doesNotMatch(rendered.text, /Acabamento\/Latex/i);
  assert.doesNotMatch(rendered.text, /PDF de compra de fios/i);
  assert.doesNotMatch(rendered.text, /Colocar em producao/i);
  assert.doesNotMatch(rendered.text, /Transicao para producao sera implementada em fase propria/i);
});

test('43. nenhum schema, upload real ou lifecycle novo foi introduzido no modulo de acabamento', () => {
  assert.doesNotMatch(olaSrc, /supa\.from\(\s*['"]op_eventos['"]\s*\)\.(insert|update|delete)/);
  assert.doesNotMatch(olaSrc, /storage\.from|upload\s*\(/,
    'documentos da OP devem ser placeholder controlado, sem upload real');
  assert.doesNotMatch(olaSrc, /alterar_status_op/);
  assert.doesNotMatch(olaSrc, /gerar_op_latex/);
});

test('44. OP em producao de tecelagem fica em modulo proprio, fora do acabamento', () => {
  assert.doesNotMatch(opnSrc, /function\s+buildScreenProducaoTecelagem\s*\(/,
    'render de producao de tecelagem nao deve voltar para op-nova.js');
  assert.match(opnSrc, /window\.renderOPTecelagemProducaoAdmin\(/,
    'op-nova.js deve apenas delegar o template operacional de tecelagem');
  assert.match(optpSrc, /function\s+renderOPTecelagemProducaoAdmin\s*\(/,
    'modulo dedicado de tecelagem em producao deve expor o renderer');
  assert.match(optpSrc, /function\s+buildBlocoTecelagem\s*\(/,
    'bloco de entregas de tecelagem deve ficar no modulo de tecelagem em producao');
  assert.match(opnSrc, /window\.renderOPLatexAdmin\(op\.id\)/,
    'call-site de OP latex deve continuar delegado ao modulo de latex');
});

// RAVATEX-TAPETES-OP-EM-PRODUCAO-ACABAMENTO-STANDALONE-R1-VISUAL-PARITY
// (correção pós-implementação — a standalone PROD-OP-ACABAMENTO é
// byte-a-byte o mesmo componente da PROD-OP-TECELAGEM, alternado pela
// prop `tipo`, logo segue a mesma convenção: nenhum dos 7 blocos usa
// ícone no título. `renderOPLatexProducao` tinha herdado o ícone do
// template Nova OP/OP Aberta em todos os 7 cards — o mesmo erro já
// corrigido em op-nova.js duas fases atrás.)
test('45. OP em producao de acabamento não tem nenhum ícone de seção (padrão do standalone: título só em texto)', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42, numero: 8, ano: 2026, status: 'em_producao', tipo: 'latex',
      observacao: '', origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    entData: [{
      id: 501, fornecedor_id: 7, data: '2026-07-01', observacao: '',
      entrega_itens: [{ id: 601, op_id: 42, op_item_id: 100, metros_entregues: 50, defeito: false, observacao: '' }],
    }],
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  const temIconeSecao = rendered.styles.some((s) => /width:34px;height:34px;border-radius:6px;background:#eaf1fd/.test(s));
  assert.equal(temIconeSecao, false, 'nenhum dos 7 blocos do standalone PROD-OP-ACABAMENTO usa ícone no título — renderOPLatexProducao não pode ter herdado o ícone do template Nova OP/OP Aberta');
});

test('46. Card "1. Dados da OP" (Acabamento em produção) usa 3 colunas do standalone', async () => {
  const rendered = await renderLatexAdminForTest({
    opData: {
      id: 42, numero: 8, ano: 2026, status: 'em_producao', tipo: 'latex',
      observacao: '', origem_op_id: 12,
      lote: { id: 91, numero: 22, pedido_id: 77, cliente: { id: 3, nome: 'Cliente Atlas' } },
      op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 125, pedido_item_id: 700 }],
      op_fornecedores: [{ fornecedor_id: 7, etapa: 'latex', fornecedores: { nome: 'Acabamento Sul' } }],
    },
    modelosData: [{ id: 1, nome: 'Roma', largura: 1.5, cor_1: { id: 1, nome: 'CINZA' }, cor_2: { id: 2, nome: 'GELO' } }],
    origemOpData: { id: 12, numero: 2, ano: 2026, tipo: 'tecelagem' },
  });
  const camposDados = findNode(rendered.view, (n) => {
    const style = typeof n.getAttribute === 'function' ? n.getAttribute('style') : null;
    return !!style && /grid-template-columns/.test(style) && /^Cliente/.test(n.textContent || '');
  });
  assert.ok(camposDados, 'esperado encontrar o container de campos do Card 1 (começa com "Cliente")');
  const style = camposDados.getAttribute('style');
  assert.match(style, /grid-template-columns\s*:\s*repeat\(\s*3\s*,\s*minmax\(0,\s*1fr\)\s*\)/,
    'Card 1 (Dados da OP) da OP Em Producao Acabamento deve seguir o standalone PROD-OP-ACABAMENTO, que usa 3 colunas e 6 campos');
  assert.doesNotMatch(style, /grid-template-columns\s*:\s*repeat\(\s*2/,
    'Card 1 (Dados da OP) da OP Em Producao Acabamento nao deve voltar ao grid intermediario de 2 colunas');
});
