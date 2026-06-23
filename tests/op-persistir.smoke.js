// Smoke test do módulo js/screens/op-persistir.js
// (OP-PERSISTIR-HELPERS-MODULE-A).
//
// Garante que a extração dos helpers puros de persistência
// (`itensValidosOP`, `montarPayloadItensOP`,
// `montarPayloadFornecedoresOP`, `montarPayloadOP`,
// `montarPayloadLote`) do <script> inline de index.html
// para js/screens/op-persistir.js preservou o comportamento exato.
//
// Estáticos:
//   1. js/screens/op-persistir.js existe.
//   2. node --check js/screens/op-persistir.js passa.
//   3. op-persistir.js é script clássico.
//   4. index.html carrega op-persistir.js exatamente uma vez.
//   5. Ordem: op-recalculo.js → op-persistir.js → jspdf → inline.
//   6. window.RAVATEX_SCREENS.opPersistir existe.
//   7-11. windows globais são funções.
//   12-15. itensValidosOP behavior.
//   16. montarPayloadItensOP behavior.
//   17-18. montarPayloadFornecedoresOP behavior.
//   19. montarPayloadOP behavior.
//   20. montarPayloadLote behavior.
//   21. inline ainda contém async function persistir.
//   22-26. writes permanecem inline.
//   27-29. outras funções inline preservadas.
//   30. boot chain sem SyntaxError.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPP   = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
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
const oppSrc    = fs.readFileSync(OPP,   'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
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

test('1. js/screens/op-persistir.js existe', () => {
  assert.ok(fs.existsSync(OPP), 'js/screens/op-persistir.js não existe');
});

test('2. op-persistir.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPP}"`, { stdio: 'pipe' });
});

test('3. op-persistir.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(oppSrc), false,
    'op-persistir.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(oppSrc), false,
    'op-persistir.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-persistir.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/op-persistir\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-persistir.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-persistir\.js"[^>]*type=/.test(indexSrc), false,
    'op-persistir.js está sendo carregado com type=module');
});

test('5. index.html: ordem op-recalculo.js → op-persistir.js → jspdf → inline', () => {
  const oprIdx    = findScriptIdx(indexSrc, 'js/screens/op-recalculo.js');
  const oppIdx    = findScriptIdx(indexSrc, 'js/screens/op-persistir.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(oprIdx > 0, 'op-recalculo.js não encontrado');
  assert.ok(oppIdx > 0, 'op-persistir.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(oprIdx < oppIdx, 'op-recalculo.js deve vir antes de op-persistir.js');
  assert.ok(oppIdx < jspdfIdx, 'op-persistir.js deve vir antes de jspdf');
  assert.ok(oppIdx < inlineIdx, 'op-persistir.js deve vir antes do inline');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

function makePersistirBootSandbox() {
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
  vm.runInContext(oppSrc,    sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('6. runtime: window.RAVATEX_SCREENS.opPersistir existe', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opPersistir', sandbox),
    'window.RAVATEX_SCREENS.opPersistir não existe');
});

test('7. runtime: window.itensValidosOP é função', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.equal(typeof vm.runInContext('window.itensValidosOP', sandbox), 'function');
});

test('8. runtime: window.montarPayloadItensOP é função', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.equal(typeof vm.runInContext('window.montarPayloadItensOP', sandbox), 'function');
});

test('9. runtime: window.montarPayloadFornecedoresOP é função', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.equal(typeof vm.runInContext('window.montarPayloadFornecedoresOP', sandbox), 'function');
});

test('10. runtime: window.montarPayloadOP é função', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.equal(typeof vm.runInContext('window.montarPayloadOP', sandbox), 'function');
});

test('11. runtime: window.montarPayloadLote é função', () => {
  const { sandbox } = makePersistirBootSandbox();
  assert.equal(typeof vm.runInContext('window.montarPayloadLote', sandbox), 'function');
});

// -------------------------------------------------------------------------
// 3. Testes unitários
// -------------------------------------------------------------------------

function makeUnitSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(oppSrc, sandbox, { filename: 'js/screens/op-persistir.js' });
  return sandbox;
}

test('12. itensValidosOP filtra item sem modeloId', () => {
  const sandbox = makeUnitSandbox();
  sandbox.itens = [{ modeloId: 0, metros: 100 }, { modeloId: 2, metros: 50 }];
  const result = vm.runInContext('window.itensValidosOP(itens)', sandbox);
  assert.equal(result.length, 1, 'devia filtrar item sem modeloId');
  assert.equal(result[0].modeloId, 2);
});

test('13. itensValidosOP filtra metros zero', () => {
  const sandbox = makeUnitSandbox();
  sandbox.itens = [{ modeloId: 1, metros: 0 }, { modeloId: 2, metros: 50 }];
  const result = vm.runInContext('window.itensValidosOP(itens)', sandbox);
  assert.equal(result.length, 1, 'devia filtrar item com metros zero');
  assert.equal(result[0].modeloId, 2);
});

test('14. itensValidosOP filtra metros inválidos (NaN, negativo)', () => {
  const sandbox = makeUnitSandbox();
  sandbox.itens = [{ modeloId: 1, metros: -10 }, { modeloId: 2, metros: 'abc' }, { modeloId: 3, metros: 30 }];
  const result = vm.runInContext('window.itensValidosOP(itens)', sandbox);
  assert.equal(result.length, 1, 'devia filtrar metros inválidos');
  assert.equal(result[0].modeloId, 3);
});

test('15. itensValidosOP preserva item válido', () => {
  const sandbox = makeUnitSandbox();
  sandbox.itens = [{ modeloId: 1, metros: 100 }];
  const result = vm.runInContext('window.itensValidosOP(itens)', sandbox);
  assert.equal(result.length, 1, 'devia preservar item válido');
  assert.equal(result[0].modeloId, 1);
  assert.equal(result[0].metros, 100);
});

test('16. montarPayloadItensOP gera { op_id, modelo_id, metros_pedidos }', () => {
  const sandbox = makeUnitSandbox();
  sandbox.validos = [{ modeloId: 1, metros: 50 }, { modeloId: 2, metros: 60.5 }];
  sandbox.opId = 42;
  const result = vm.runInContext('window.montarPayloadItensOP(validos, opId)', sandbox);
  assert.equal(result.length, 2);
  assert.equal(result[0].op_id, 42);
  assert.equal(result[0].modelo_id, 1);
  assert.equal(result[0].metros_pedidos, 50);
  assert.equal(result[1].op_id, 42);
  assert.equal(result[1].modelo_id, 2);
  assert.equal(result[1].metros_pedidos, 60.5);
});

test('17. montarPayloadFornecedoresOP gera fornecedor cima quando fornSel.cima existe', () => {
  const sandbox = makeUnitSandbox();
  sandbox.fornSel = { cima: 7, fio_algodao: '', fio_poliester: '' };
  sandbox.opId = 42;
  const result = vm.runInContext('window.montarPayloadFornecedoresOP(fornSel, opId)', sandbox);
  assert.equal(result.length, 1);
  assert.equal(result[0].op_id, 42);
  assert.equal(result[0].fornecedor_id, 7);
  assert.equal(result[0].etapa, 'cima');
});

test('18. montarPayloadFornecedoresOP retorna [] quando fornSel.cima não existe', () => {
  const sandbox = makeUnitSandbox();
  sandbox.fornSel = { cima: '', fio_algodao: '', fio_poliester: '' };
  sandbox.opId = 42;
  const result = vm.runInContext('window.montarPayloadFornecedoresOP(fornSel, opId)', sandbox);
  assert.equal(result.length, 0);
});

test('19. montarPayloadOP gera { numero, ano, status } com números convertidos', () => {
  const sandbox = makeUnitSandbox();
  const result = vm.runInContext(
    'window.montarPayloadOP({ numero: "5", ano: 2026, status: "simulada" })',
    sandbox
  );
  assert.equal(result.numero, 5);
  assert.equal(result.ano, 2026);
  assert.equal(result.status, 'simulada');
});

test('20. montarPayloadLote gera { numero, cliente_id } com números convertidos', () => {
  const sandbox = makeUnitSandbox();
  const result = vm.runInContext(
    'window.montarPayloadLote({ numero: 3, clienteSel: "7" })',
    sandbox
  );
  assert.equal(result.numero, 3);
  assert.equal(result.cliente_id, 7);
});

// -------------------------------------------------------------------------
// 4. Estáticos — inline persistir preservado
// -------------------------------------------------------------------------

test('21. inline NÃO contém mais async function persistir (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem async function persistir — writes deveriam ter sido extraídos');
});

test('22. inline NÃO contém mais writes em ops (insert/update) — apenas reads', () => {
  const inline = extractInlineScript(indexSrc);
  // Reads (.select) são permitidos. Writes (.insert, .update) foram extraídos.
  assert.equal(/from\s*\(\s*['"]ops['"]\s*\)\s*\.\s*insert\s*\(/.test(inline), false,
    'inline ainda tem from("ops").insert — write deveria ter sido extraído');
  assert.equal(/from\s*\(\s*['"]ops['"]\s*\)\s*\.\s*update\s*\(/.test(inline), false,
    'inline ainda tem from("ops").update — write deveria ter sido extraído');
});

test('23. inline NÃO contém mais from("lotes") (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/from\s*\(\s*['"]lotes['"]\s*\)/.test(inline), false,
    'inline ainda tem from("lotes") — write deveria ter sido extraído');
});

test('24. inline NÃO contém mais from("op_itens") (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/from\s*\(\s*['"]op_itens['"]\s*\)/.test(inline), false,
    'inline ainda tem from("op_itens") — write deveria ter sido extraído');
});

test('25. inline NÃO contém mais from("op_fornecedores") (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/from\s*\(\s*['"]op_fornecedores['"]\s*\)/.test(inline), false,
    'inline ainda tem from("op_fornecedores") — write deveria ter sido extraído');
});

test('26. inline NÃO contém mais writes em ordens_compra_fio (insert/update/delete) — apenas reads', () => {
  const inline = extractInlineScript(indexSrc);
  // Reads (.select) são permitidos. Writes (.insert, .update, .delete) foram extraídos.
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*insert\s*\(/.test(inline), false,
    'inline ainda tem from("ordens_compra_fio").insert — write deveria ter sido extraído');
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*update\s*\(/.test(inline), false,
    'inline ainda tem from("ordens_compra_fio").update — write deveria ter sido extraído');
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*delete\s*\(/.test(inline), false,
    'inline ainda tem from("ordens_compra_fio").delete — write deveria ter sido extraído');
});

test('27. salvarSimulacao e abrirOP foram extraídas para op-nova.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+salvarSimulacao\s*\(/.test(inline), false,
    'inline ainda tem salvarSimulacao — extração incompleta');
  assert.equal(/async\s+function\s+abrirOP\s*\(/.test(inline), false,
    'inline ainda tem abrirOP — extração incompleta');
  // Foram movidas para op-nova.js
  assert.match(opnSrc, /async\s+function\s+salvarSimulacao\s*\(/);
  assert.match(opnSrc, /async\s+function\s+abrirOP\s*\(/);
});

test('28. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
  // Foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/);
});

test('29. setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

// -------------------------------------------------------------------------
// 5. Boot chain
// -------------------------------------------------------------------------

test('30. boot chain: todos os módulos + op-persistir + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makePersistirBootSandbox();

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
    'boot com op-persistir + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

// -------------------------------------------------------------------------
// 6. persistirOP — extraído do inline (Seam B)
// -------------------------------------------------------------------------

// Mock Supabase que rastreia todas as chamadas e permite configurar
// quais steps retornam erro. Suporta múltiplas mutações no mesmo from()
// (ex: from('saldo_fios') chamado para select e depois update/insert).
function makePersistirOPSandbox({
  opsInsertResult = { data: { id: 42 }, error: null },
  opsInsertError = null,
  opsUpdateResult = { data: { id: 42 }, error: null },
  opsUpdateError = null,
  lotesSelectResult = { data: [{ numero: 1 }], error: null },
  lotesSelectError = null,
  lotesInsertResult = { data: { id: 100 }, error: null },
  lotesInsertError = null,
  lotesUpdateResult = { data: null, error: null },
  lotesUpdateError = null,
  lotesVinculError = null,
  opItensDeleteError = null,
  opItensInsertError = null,
  opFornecedoresDeleteError = null,
  opFornecedoresInsertError = null,
  ordensDeleteError = null,
  ordensInsertError = null,
  calcularFiosOPResult = { algodaoPorCor: {}, poliester: { PRETO: 0, BRANCO: 0 } },
  montarOrdensResult = [],
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

  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      const chain = {
        _table: table,
        _lastMutation: null,
        _hasInsert: false,
        _hasUpdate: false,
        _payload: null,
        select() { chain._lastMutation = 'select'; return chain; },
        update(payload) {
          chain._lastMutation = 'update';
          chain._hasUpdate = true;
          chain._payload = payload;
          return chain;
        },
        insert(payload) {
          chain._lastMutation = 'insert';
          chain._hasInsert = true;
          chain._payload = payload;
          return chain;
        },
        delete() { chain._lastMutation = 'delete'; return chain; },
        eq() { return chain; },
        order() { return chain; },
        in() { return chain; },
        limit() { return chain; },
        single() {
          if (chain._table === 'ops') {
            if (chain._hasUpdate) {
              calls.push({ op: 'ops_update_single', payload: chain._payload });
              if (opsUpdateError) {
                return Promise.resolve({ data: null, error: opsUpdateError });
              }
              return Promise.resolve(opsUpdateResult);
            }
            calls.push({ op: 'ops_insert_single', payload: chain._payload });
            if (opsInsertError) {
              return Promise.resolve({ data: null, error: opsInsertError });
            }
            return Promise.resolve(opsInsertResult);
          }
          if (chain._table === 'lotes') {
            if (chain._hasInsert) {
              calls.push({ op: 'lotes_insert_single', payload: chain._payload });
              if (lotesInsertError) {
                return Promise.resolve({ data: null, error: lotesInsertError });
              }
              return Promise.resolve(lotesInsertResult);
            }
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (chain._table === 'lotes' && chain._lastMutation === 'select') {
            return Promise.resolve({ data: lotesSelectResult, error: lotesSelectError });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve, reject) {
          if (chain._table === 'ops' && chain._lastMutation === 'update') {
            calls.push({ op: 'ops_update', payload: chain._payload });
            if (opsUpdateError) {
              return Promise.resolve({ data: null, error: opsUpdateError }).then(resolve, reject);
            }
            return Promise.resolve(opsUpdateResult).then(resolve, reject);
          }
          if (chain._table === 'ops' && chain._lastMutation === 'insert') {
            calls.push({ op: 'ops_insert', payload: chain._payload });
            if (opsInsertError) {
              return Promise.resolve({ data: null, error: opsInsertError }).then(resolve, reject);
            }
            return Promise.resolve(opsInsertResult).then(resolve, reject);
          }
          if (chain._table === 'lotes' && chain._lastMutation === 'select') {
            calls.push({ op: 'lotes_select' });
            if (lotesSelectError) {
              return Promise.resolve({ data: null, error: lotesSelectError }).then(resolve, reject);
            }
            return Promise.resolve(lotesSelectResult).then(resolve, reject);
          }
          if (chain._table === 'lotes' && chain._lastMutation === 'insert') {
            calls.push({ op: 'lotes_insert', payload: chain._payload });
            if (lotesInsertError) {
              return Promise.resolve({ data: null, error: lotesInsertError }).then(resolve, reject);
            }
            return Promise.resolve(lotesInsertResult).then(resolve, reject);
          }
          if (chain._table === 'lotes' && chain._lastMutation === 'update') {
            calls.push({ op: 'lotes_update', payload: chain._payload });
            if (lotesUpdateError) {
              return Promise.resolve({ data: null, error: lotesUpdateError }).then(resolve, reject);
            }
            return Promise.resolve(lotesUpdateResult).then(resolve, reject);
          }
          if (chain._table === 'op_itens' && chain._lastMutation === 'delete') {
            calls.push({ op: 'op_itens_delete' });
            if (opItensDeleteError) {
              return Promise.resolve({ data: null, error: opItensDeleteError }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_itens' && chain._lastMutation === 'insert') {
            calls.push({ op: 'op_itens_insert', payload: chain._payload });
            if (opItensInsertError) {
              return Promise.resolve({ data: null, error: opItensInsertError }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_fornecedores' && chain._lastMutation === 'delete') {
            calls.push({ op: 'op_fornecedores_delete' });
            if (opFornecedoresDeleteError) {
              return Promise.resolve({ data: null, error: opFornecedoresDeleteError }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_fornecedores' && chain._lastMutation === 'insert') {
            calls.push({ op: 'op_fornecedores_insert', payload: chain._payload });
            if (opFornecedoresInsertError) {
              return Promise.resolve({ data: null, error: opFornecedoresInsertError }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'ordens_compra_fio' && chain._lastMutation === 'delete') {
            calls.push({ op: 'ordens_compra_fio_delete' });
            if (ordensDeleteError) {
              return Promise.resolve({ data: null, error: ordensDeleteError }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'ordens_compra_fio' && chain._lastMutation === 'insert') {
            calls.push({ op: 'ordens_compra_fio_insert', payload: chain._payload });
            if (ordensInsertError) {
              return Promise.resolve({ data: null, error: ordensInsertError }).then(resolve, reject);
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
  vm.runInContext(oppSrc,    sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  // Mocks de calcularFiosOP e montarOrdensCompraFio devem ser definidos
  // DEPOIS de carregar calculo-op.js, pois este define as funções reais
  // no global scope do sandbox, sobrescrevendo os mocks se definidos antes.
  sandbox.calcularFiosOP = (validos, modelosById, parametrosByLargura) => {
    calls.push({ op: 'calcularFiosOP' });
    return calcularFiosOPResult;
  };
  sandbox.montarOrdensCompraFio = (calc) => {
    calls.push({ op: 'montarOrdensCompraFio' });
    return montarOrdensResult;
  };

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox, fakeSupa, calls };
}

function payloadBase() {
  return {
    status: 'simulada',
    op: null,
    numero: 5,
    ano: 2026,
    clienteSel: 7,
    itens: [{ modeloId: 1, metros: 50 }],
    fornSel: { cima: 3, fio_algodao: '', fio_poliester: '' },
    modelosById: { 1: { id: 1, largura: 1.40, cor_1: { id: 10 }, cor_2: { id: 11 } } },
    parametrosByLargura: { '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 } },
  };
}

// ---- 1-2: Exports -----------------------------------------------------

test('31. window.persistirOP existe', () => {
  const { sandbox } = makePersistirOPSandbox();
  assert.equal(typeof vm.runInContext('window.persistirOP', sandbox), 'function',
    'window.persistirOP não é função');
});

test('32. window.RAVATEX_SCREENS.opPersistir.persistirOP existe', () => {
  const { sandbox } = makePersistirOPSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opPersistir.persistirOP', sandbox),
    'window.RAVATEX_SCREENS.opPersistir.persistirOP não existe');
});

// ---- 3-6: Sucesso -----------------------------------------------------

test('33. sucesso criar OP simulada retorna { error:null, step:"ok", partial:false, opId }', async () => {
  const { sandbox } = makePersistirOPSandbox();
  sandbox.payload = payloadBase();
  const result = await vm.runInContext(
    'window.persistirOP(payload)',
    sandbox
  );
  assert.equal(result.error, null, 'error deveria ser null');
  assert.equal(result.step, 'ok', 'step deveria ser "ok"');
  assert.equal(result.partial, false);
  assert.equal(result.opId, 42);
});

test('34. sucesso criar OP aberta retorna { error:null, step:"ok", partial:false, opId }', async () => {
  const { sandbox } = makePersistirOPSandbox({
    montarOrdensResult: [{ tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 50 }],
  });
  sandbox.payload = { ...payloadBase(), status: 'aberta' };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.error, null);
  assert.equal(result.step, 'ok');
  assert.equal(result.partial, false);
  assert.equal(result.opId, 42);
});

test('35. sucesso editar OP com lote existente', async () => {
  const { sandbox } = makePersistirOPSandbox();
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.error, null);
  assert.equal(result.step, 'ok');
  assert.equal(result.opId, 42);
});

test('36. sucesso editar OP sem lote, criando lote', async () => {
  const { sandbox, calls } = makePersistirOPSandbox();
  sandbox.payload = { ...payloadBase(), op: { id: 42 } }; // sem lote_id
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.error, null);
  assert.equal(result.step, 'ok');
  // Deve ter chamado lotes_select, lotes_insert (via single()), e ops.update(lote_id)
  const hasSelect = calls.some((c) => c.op === 'lotes_select');
  const hasInsert = calls.some((c) => c.op === 'lotes_insert' || c.op === 'lotes_insert_single');
  assert.ok(hasSelect, 'devia ter chamado lotes_select');
  assert.ok(hasInsert, 'devia ter chamado lotes_insert');
});

// ---- 7-11: Falhas em ops/lotes ---------------------------------------

test('37. falha em ops.insert retorna step "ops_insert" e opId null', async () => {
  const { sandbox } = makePersistirOPSandbox({ opsInsertError: new Error('mock ops insert') });
  sandbox.payload = payloadBase();
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.ok(result.error, 'error deveria estar setado');
  assert.equal(result.step, 'ops_insert');
  assert.equal(result.partial, false);
  assert.equal(result.opId, null, 'opId deveria ser null');
});

test('38. falha em ops.update retorna step "ops_update" e opId do OP existente', async () => {
  const { sandbox } = makePersistirOPSandbox({ opsUpdateError: new Error('mock ops update') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'ops_update');
  assert.equal(result.partial, false);
  assert.equal(result.opId, 42, 'opId deveria ser o id do OP existente');
});

test('39. falha em lotes.insert retorna step "lotes_insert" e partial true', async () => {
  const { sandbox } = makePersistirOPSandbox({ lotesInsertError: new Error('mock lotes insert') });
  sandbox.payload = { ...payloadBase(), op: { id: 42 } }; // sem lote_id → vai tentar criar
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'lotes_insert');
  assert.equal(result.partial, true);
  assert.equal(result.opId, 42);
});

test('40. falha em lotes.update retorna step "lotes_update" e partial true', async () => {
  const { sandbox } = makePersistirOPSandbox({ lotesUpdateError: new Error('mock lotes update') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'lotes_update');
  assert.equal(result.partial, true);
});

test('41. falha em ops.update({ lote_id }) retorna step "lotes_vincular"', async () => {
  // Cria sandbox custom onde o segundo ops.update (vinculação de lote)
  // falha. O primeiro ops.update (numero/ano/status) sucede.
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  let opsUpdateCount = 0;
  const fakeSupa = {
    from: (table) => {
      const chain = {
        _table: table,
        _lastMutation: null,
        _hasInsert: false,
        _hasUpdate: false,
        _payload: null,
        select() { chain._lastMutation = 'select'; return chain; },
        update(payload) { chain._lastMutation = 'update'; chain._hasUpdate = true; chain._payload = payload; return chain; },
        insert(payload) { chain._lastMutation = 'insert'; chain._hasInsert = true; chain._payload = payload; return chain; },
        delete() { chain._lastMutation = 'delete'; return chain; },
        eq() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        single() {
          if (chain._table === 'ops') {
            return Promise.resolve({ data: { id: 42 }, error: null });
          }
          if (chain._table === 'lotes' && chain._hasInsert) {
            return Promise.resolve({ data: { id: 100 }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (chain._table === 'lotes' && chain._lastMutation === 'select') {
            return Promise.resolve({ data: [{ numero: 1 }], error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve, reject) {
          if (chain._table === 'ops' && chain._lastMutation === 'update') {
            // O update principal (numero/ano/status) vai por single(), não por then().
            // O update de vinculação de lote é o primeiro a ir por then().
            // Logo, o primeiro then() em ops.update DEVE falhar.
            return Promise.resolve({ data: null, error: new Error('mock vincular') }).then(resolve, reject);
          }
          if (chain._table === 'op_itens' && chain._lastMutation === 'delete') {
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_itens' && chain._lastMutation === 'insert') {
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_fornecedores' && chain._lastMutation === 'delete') {
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'op_fornecedores' && chain._lastMutation === 'insert') {
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
  };
  const sandbox2 = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' }, supa: fakeSupa,
    calcularFiosOP: () => ({ algodaoPorCor: {}, poliester: { PRETO: 0, BRANCO: 0 } }),
    montarOrdensCompraFio: () => [],
  };
  sandbox2.window = sandbox2;
  sandbox2.globalThis = sandbox2;
  vm.createContext(sandbox2);
  vm.runInContext(oppSrc, sandbox2, { filename: 'js/screens/op-persistir.js' });
  sandbox2.payload = { ...payloadBase(), op: { id: 42 } }; // sem lote_id
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox2);
  assert.equal(result.step, 'lotes_vincular');
  assert.equal(result.partial, true);
});

// ---- 12-15: Falhas em op_itens / op_fornecedores --------------------

test('42. falha em op_itens.delete retorna step "op_itens_delete"', async () => {
  const { sandbox } = makePersistirOPSandbox({ opItensDeleteError: new Error('mock itens delete') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'op_itens_delete');
  assert.equal(result.partial, true);
});

test('43. falha em op_itens.insert retorna step "op_itens_insert"', async () => {
  const { sandbox } = makePersistirOPSandbox({ opItensInsertError: new Error('mock itens insert') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'op_itens_insert');
  assert.equal(result.partial, true);
});

test('44. falha em op_fornecedores.delete retorna step "op_fornecedores_delete"', async () => {
  const { sandbox } = makePersistirOPSandbox({ opFornecedoresDeleteError: new Error('mock forn delete') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'op_fornecedores_delete');
  assert.equal(result.partial, true);
});

test('45. falha em op_fornecedores.insert retorna step "op_fornecedores_insert"', async () => {
  const { sandbox } = makePersistirOPSandbox({ opFornecedoresInsertError: new Error('mock forn insert') });
  sandbox.payload = { ...payloadBase(), op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'op_fornecedores_insert');
  assert.equal(result.partial, true);
});

// ---- 16-20: status='simulada' vs 'aberta' ---------------------------

test('46. status="simulada" NÃO chama ordens_compra_fio', async () => {
  const { sandbox, calls } = makePersistirOPSandbox();
  sandbox.payload = { ...payloadBase(), status: 'simulada' };
  await vm.runInContext('window.persistirOP(payload)', sandbox);
  const ordensCalls = calls.filter((c) =>
    c.op === 'from' && c.table === 'ordens_compra_fio'
  );
  assert.equal(ordensCalls.length, 0, 'simulada NÃO devia tocar ordens_compra_fio');
});

test('47. status="aberta" chama calcularFiosOP', async () => {
  const { sandbox, calls } = makePersistirOPSandbox({
    montarOrdensResult: [{ tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 50 }],
  });
  sandbox.payload = { ...payloadBase(), status: 'aberta' };
  await vm.runInContext('window.persistirOP(payload)', sandbox);
  const calcularCall = calls.find((c) => c.op === 'calcularFiosOP');
  assert.ok(calcularCall, 'devia ter chamado calcularFiosOP');
});

test('48. status="aberta" chama montarOrdensCompraFio', async () => {
  const { sandbox, calls } = makePersistirOPSandbox({
    montarOrdensResult: [{ tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 50 }],
  });
  sandbox.payload = { ...payloadBase(), status: 'aberta' };
  await vm.runInContext('window.persistirOP(payload)', sandbox);
  const montarCall = calls.find((c) => c.op === 'montarOrdensCompraFio');
  assert.ok(montarCall, 'devia ter chamado montarOrdensCompraFio');
});

test('49. falha em ordens_compra_fio.delete retorna step "ordens_compra_fio_delete"', async () => {
  const { sandbox } = makePersistirOPSandbox({
    ordensDeleteError: new Error('mock ordens delete'),
    montarOrdensResult: [{ tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 50 }],
  });
  sandbox.payload = { ...payloadBase(), status: 'aberta', op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'ordens_compra_fio_delete');
  assert.equal(result.partial, true);
});

test('50. falha em ordens_compra_fio.insert retorna step "ordens_compra_fio_insert"', async () => {
  const { sandbox } = makePersistirOPSandbox({
    ordensInsertError: new Error('mock ordens insert'),
    montarOrdensResult: [{ tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 50 }],
  });
  sandbox.payload = { ...payloadBase(), status: 'aberta', op: { id: 42, lote_id: 100 } };
  const result = await vm.runInContext('window.persistirOP(payload)', sandbox);
  assert.equal(result.step, 'ordens_compra_fio_insert');
  assert.equal(result.partial, true);
});

// ---- 21-22: fornecedor cima -----------------------------------------

test('51. criação sem fornecedor cima NÃO insere op_fornecedores', async () => {
  const { sandbox, calls } = makePersistirOPSandbox();
  sandbox.payload = { ...payloadBase(), fornSel: { cima: '', fio_algodao: '', fio_poliester: '' } };
  await vm.runInContext('window.persistirOP(payload)', sandbox);
  const fornInserts = calls.filter((c) => c.op === 'op_fornecedores_insert');
  assert.equal(fornInserts.length, 0, 'NÃO devia inserir op_fornecedores sem fornecedor cima');
});

test('52. criação com fornecedor cima INSERE op_fornecedores', async () => {
  const { sandbox, calls } = makePersistirOPSandbox();
  sandbox.payload = { ...payloadBase(), fornSel: { cima: 3, fio_algodao: '', fio_poliester: '' } };
  await vm.runInContext('window.persistirOP(payload)', sandbox);
  const fornInserts = calls.filter((c) => c.op === 'op_fornecedores_insert');
  assert.ok(fornInserts.length >= 1, 'devia inserir op_fornecedores');
  assert.equal(fornInserts[0].payload[0].fornecedor_id, 3);
  assert.equal(fornInserts[0].payload[0].etapa, 'cima');
});

// ---- 23-25: helper não chama toast/navigate/DOM --------------------

test('53. helper não chama toast()', () => {
  assert.equal(/toast\s*\(/.test(oppSrc), false,
    'persistirOP não deve chamar toast()');
});

test('54. helper não chama navigate()', () => {
  assert.equal(/navigate\s*\(/.test(oppSrc), false,
    'persistirOP não deve chamar navigate()');
});

test('55. helper não acessa document.* (DOM)', () => {
  assert.equal(/document\./.test(oppSrc), false,
    'persistirOP não deve acessar document');
});

// ---- 26-30: inline callers ----------------------------------------

test('56. inline NÃO contém mais async function persistir', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem async function persistir — write deveria ter sido extraído');
});

test('57. salvarSimulacao foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+salvarSimulacao\s*\(/.test(inline), false,
    'inline ainda tem salvarSimulacao — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+salvarSimulacao\s*\(/,
    'op-nova.js não contém salvarSimulacao');
});

test('58. abrirOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+abrirOP\s*\(/.test(inline), false,
    'inline ainda tem abrirOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+abrirOP\s*\(/,
    'op-nova.js não contém abrirOP');
});

test('59. salvarSimulacao chama window.persistirOP (em op-nova.js)', () => {
  // Função foi movida para op-nova.js
  assert.match(opnSrc, /salvarSimulacao[\s\S]*?window\.persistirOP/,
    'salvarSimulacao em op-nova.js não chama window.persistirOP');
});

test('60. abrirOP chama window.persistirOP (em op-nova.js)', () => {
  // Função foi movida para op-nova.js
  assert.match(opnSrc, /abrirOP[\s\S]*?window\.persistirOP/,
    'abrirOP em op-nova.js não chama window.persistirOP');
});

// ---- 31-33: outras funções inline ----------------------------------

test('61. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('62. buildRight e renderRightInto foram extraídos para op-nova.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildRight\s*\(/.test(inline), false,
    'inline ainda tem buildRight — extração incompleta');
  assert.equal(/function\s+renderRightInto\s*\(/.test(inline), false,
    'inline ainda tem renderRightInto — extração incompleta');
  // Foram movidos para op-nova.js
  assert.match(opnSrc, /function\s+buildRight\s*\(/);
  assert.match(opnSrc, /function\s+renderRightInto\s*\(/);
});

test('63. aplicarRecalculo foi extraída para op-nova.js chamando window.aplicarRecalculoOP', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  // Foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/);
  assert.match(opnSrc, /aplicarRecalculo[\s\S]*?window\.aplicarRecalculoOP/,
    'aplicarRecalculo em op-nova.js não chama window.aplicarRecalculoOP');
});

// ---- 34: setRoutes/main inline -------------------------------------

test('64. setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

// ---- 35: boot chain sem SyntaxError --------------------------------

test('65. boot chain com todos os módulos + op-persistir + inline não lança SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makePersistirBootSandbox();

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
    'boot com op-persistir + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});
