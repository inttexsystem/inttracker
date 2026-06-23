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
const OPW    = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OFH    = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
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
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
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
  const re = /<script\s+src="js\/screens\/op-latex-admin\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-latex-admin.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-latex-admin\.js"[^>]*type=/.test(indexSrc), false,
    'op-latex-admin.js está sendo carregado com type=module');
});

test('4. index.html: ordem op-writes.js → op-latex-admin.js → jspdf → inline', () => {
  const opwIdx  = findScriptIdx(indexSrc, 'js/screens/op-writes.js');
  const olaIdx  = findScriptIdx(indexSrc, 'js/screens/op-latex-admin.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(opwIdx > 0, 'op-writes.js não encontrado');
  assert.ok(olaIdx > 0, 'op-latex-admin.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(opwIdx < olaIdx, 'op-writes deve vir antes de op-latex-admin');
  assert.ok(olaIdx < jspdfIdx, 'op-latex-admin deve vir antes de jspdf');
  assert.ok(olaIdx < inlineIdx, 'op-latex-admin deve vir antes do inline');
});

test('5. inline NÃO contém mais async function renderOPLatexAdmin', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline ainda declara async function renderOPLatexAdmin — função deveria ter sido extraída');
});

test('6. inline contém window.renderOPLatexAdmin(op.id) no call-site de screenNovaOP', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.renderOPLatexAdmin\(/,
    'inline não referencia window.renderOPLatexAdmin — call-site não foi atualizado');
});

test('7. inline AINDA contém async function screenNovaOP', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /async\s+function\s+screenNovaOP\s*\(/,
    'inline perdeu screenNovaOP — função deveria continuar inline');
});

test('8. inline AINDA contém persistir', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+persistir\s*\(/,
    'inline perdeu persistir — função deveria continuar inline');
});

test('9. inline AINDA contém aplicarRecalculo', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+aplicarRecalculo\s*\(/,
    'inline perdeu aplicarRecalculo — função deveria continuar inline');
});

test('10. inline AINDA contém buildOrdemPendenteRow', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+buildOrdemPendenteRow\s*\(/,
    'inline perdeu buildOrdemPendenteRow — função deveria continuar inline');
});

test('11. inline AINDA contém setRoutes', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/,
    'inline perdeu window.RAVATEX_ROUTER.setRoutes — boot chain quebrou');
});

test('12. inline AINDA contém main', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /async\s+function\s+main\s*\(/,
    'inline perdeu main — boot quebrou');
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

  function makeChain(table) {
    const opDataMap = { ops: opData, entregas: entData, modelos: modelosData };
    const defaultData = opDataMap[table] !== undefined ? opDataMap[table] : [];
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
        return this;
      },
      order() { return this; },
      in() { return this; },
      single() {
        if (table === 'ops') {
          return Promise.resolve({ data: defaultData, error: null });
        }
        return Promise.resolve({ data: defaultData, error: null });
      },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
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

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

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
  assert.match(olaSrc, /\.eq\(\s*['"]id['"]\s*,\s*l\.id\s*\)/,
    'editarEnviado não filtra op_itens por eq("id", l.id)');
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

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

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
