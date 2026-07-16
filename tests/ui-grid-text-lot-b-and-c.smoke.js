// =====================================================================
// === tests/ui-grid-text-lot-b-and-c.smoke.js ===========================
// Unit smoke for UI-GRID-TEXT-LOT-B-AND-C: applies the §7.1 grid/list
// text-cell overflow rule (docs/architecture/UI_VISUAL_CONTRACT.md), via
// the shared window.truncatedCell()/window.TRUNCATE_CELL_STYLE
// primitives (js/ui.js, UI-GRID-TEXT-HELPER), to:
//   - Lot B: js/screens/pedidos-list.js CLIENTE column,
//            js/screens/ops-list.js CLIENTE column
//   - Lot C: js/screens/painel.js .rv-adm-ref / .rv-adm-mini (cosmetic
//            overflow:hidden/text-overflow:ellipsis added to the
//            existing white-space:nowrap)
//
// pedidos-list.js has no pre-existing runtime-render test harness (its
// smoke suite is fully static — see tests/pedidos-list.smoke.js), so
// its section here stays static/source-level, consistent with that
// file's own test style. ops-list.js DOES have a proven runtime
// sandbox (tests/ops-list-screen.smoke.js's makeOpsSandbox), so this
// reuses the same shape to render screenListaOPs() and assert on the
// actual DOM. painel.js is a pure CSS-string change — asserted at the
// source level.
//
// Runs with: node --test tests/ui-grid-text-lot-b-and-c.smoke.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const PEDIDOS = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const OPS = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');
const EF = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const CALC = path.join(ROOT, 'js', 'calculo-op.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD = path.join(ROOT, 'js', 'screens', 'cadastros.js');

const pedidosSrc = fs.readFileSync(PEDIDOS, 'utf8');
const opsSrc = fs.readFileSync(OPS, 'utf8');
const painelSrc = fs.readFileSync(PAINEL, 'utf8');
const efSrc = fs.readFileSync(EF, 'utf8');
const ewSrc = fs.readFileSync(EW, 'utf8');
const fornSrc = fs.readFileSync(FORN, 'utf8');
const uiSrc = fs.readFileSync(UI, 'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const calcSrc = fs.readFileSync(CALC, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc = fs.readFileSync(CAD, 'utf8');

test('node --check passes on pedidos-list.js, ops-list.js, painel.js', () => {
  const cp = require('node:child_process');
  cp.execSync(`node --check "${PEDIDOS}"`, { stdio: 'pipe' });
  cp.execSync(`node --check "${OPS}"`, { stdio: 'pipe' });
  cp.execSync(`node --check "${PAINEL}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// Lot B — pedidos-list.js CLIENTE column (static — no runtime harness
// precedent exists for this screen; see header note above).
// ---------------------------------------------------------------------

test('pedidos-list.js: CLIENTE data cell renders via window.truncatedCell', () => {
  assert.match(
    pedidosSrc,
    /var nome = clienteNome\(pedido\);\s*\n\s*return window\.truncatedCell\(nome, nome === '—' \? null : nome, 'font-size:13\.5px;color:#3f4757;'\);/,
  );
});

test('pedidos-list.js: CLIENTE header cell (index 1) uses window.TRUNCATE_CELL_STYLE; other headers keep plain nowrap', () => {
  assert.match(pedidosSrc, /index === 1 \? window\.TRUNCATE_CELL_STYLE : 'white-space:nowrap;'/);
  // PEDIDO (index 0) and AÇÕES (index 8, centered) must NOT route through the truncation branch.
  assert.doesNotMatch(pedidosSrc, /index === 0 \? window\.TRUNCATE_CELL_STYLE/);
});

test('pedidos-list.js: label order confirms CLIENTE is index 1', () => {
  assert.match(pedidosSrc, /\['PEDIDO', 'CLIENTE', 'SIT\. INTERNA'/);
});

// ---------------------------------------------------------------------
// Lot B — ops-list.js CLIENTE column (runtime — reuses the proven
// makeOpsSandbox shape from tests/ops-list-screen.smoke.js).
// ---------------------------------------------------------------------

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
  setAttribute(k, v) { this['_attr_' + k] = v; }
  removeAttribute(k) { delete this['_attr_' + k]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this, '_attr_' + k); }
  getAttribute(k) { return this.hasAttribute(k) ? this['_attr_' + k] : null; }
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

function findAll(node, pred, out) {
  out = out || [];
  if (!node) return out;
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function findCellByText(root, text) {
  return findAll(root, (n) => n.tagName === 'DIV' && textOf(n) === text)[0];
}

function makeFakeSupabaseClient(routeResolver) {
  const calls = [];
  const resolve = routeResolver || (() => []);
  function makeChain(table) {
    const data = resolve(table);
    const chain = {
      _table: table, _data: data, _error: null,
      select(_cols) { calls.push({ op: 'select', args: [_cols] }); return chain; },
      insert(payload) { calls.push({ op: 'insert', args: [payload] }); return Promise.resolve({ data: null, error: null }); },
      update(payload) { calls.push({ op: 'update', args: [payload] }); return Promise.resolve({ data: null, error: null }); },
      delete() { calls.push({ op: 'delete' }); return Promise.resolve({ data: null, error: null }); },
      eq() { return chain; },
      order() { return chain; },
      in() { return chain; },
      then(resolveThen, rejectThen) {
        return Promise.resolve({ data: chain._data, error: chain._error }).then(resolveThen, rejectThen);
      },
    };
    return chain;
  }
  return {
    from(table) { calls.push({ op: 'from', args: [table] }); return makeChain(table); },
    rpc() { return Promise.resolve({ data: null, error: null }); },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
    _calls: calls,
  };
}

function makeOpsSandbox({ tableData = {} } = {}) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient((table) => tableData[table] || []);
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc, sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc, sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc, sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc, sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc, sandbox, { filename: 'js/screens/fornecedor.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.supa = fakeSupa;
  sandbox.navigate = (h) => { sandbox._lastNavigate = h; };
  return { sandbox, fakeSupa };
}

function mainOf(node) {
  const flex = node.children.find((c) => c.tagName === 'DIV');
  return flex && flex.children.find((c) => c.tagName === 'MAIN');
}

test('ops-list.js: CLIENTE cell renders via window.truncatedCell with full-value title', async () => {
  const longCliente = 'Distribuidora e Comercio de Tapetes e Capachos Industriais do Norte Ltda';
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [{
        id: 1, numero: 1, ano: 2026, status: 'aberta', tipo: 'tecelagem',
        criado_em: '2026-06-01T00:00:00Z',
        lote: { numero: 5, cliente: { nome: longCliente } },
        op_itens: [],
      }],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = mainOf(node);
  assert.ok(main, 'screenListaOPs did not render via shellLayout');

  const cell = findCellByText(main, longCliente);
  assert.ok(cell, 'CLIENTE cell with the full long name not found in the DOM');
  const style = cell.getAttribute('style') || '';
  assert.match(style, /white-space:nowrap/);
  assert.match(style, /overflow:hidden/);
  assert.match(style, /text-overflow:ellipsis/);
  assert.match(style, /min-width:0/);
  assert.equal(cell.getAttribute('title'), longCliente);
});

test('ops-list.js: CLIENTE "—" fallback (no lote/cliente) carries NO title tooltip', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [{
        id: 1, numero: 1, ano: 2026, status: 'aberta', tipo: 'tecelagem',
        criado_em: '2026-06-01T00:00:00Z', lote: null, op_itens: [],
      }],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = mainOf(node);
  const dashCells = findAll(main, (n) => n.tagName === 'DIV' && textOf(n) === '—');
  assert.ok(dashCells.length > 0, 'no "—" fallback cell found');
  for (const cell of dashCells) {
    assert.equal(cell.hasAttribute('title'), false, '"—" fallback cell must not carry a title tooltip');
  }
});

test('ops-list.js: CLIENTE header cell uses the §7.1 truncation CSS; TIPO/STATUS headers unaffected', async () => {
  const { sandbox } = makeOpsSandbox({ tableData: { ops: [], entrega_itens: [] } });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = mainOf(node);
  const clienteHead = findCellByText(main, 'CLIENTE');
  assert.ok(clienteHead, 'CLIENTE header cell not found');
  assert.match(clienteHead.getAttribute('style') || '', /text-overflow:ellipsis/);
  const tipoHead = findCellByText(main, 'TIPO');
  assert.ok(tipoHead, 'TIPO header cell not found');
  assert.doesNotMatch(tipoHead.getAttribute('style') || '', /text-overflow:ellipsis/,
    'TIPO is a badge column — must NOT be truncated');
});

// ---------------------------------------------------------------------
// Lot C — painel.js .rv-adm-ref / .rv-adm-mini (cosmetic CSS-only)
// ---------------------------------------------------------------------

test('painel.js: .rv-adm-ref keeps white-space:nowrap and gains overflow:hidden/text-overflow:ellipsis', () => {
  assert.match(
    painelSrc,
    /\.rv-adm-ref\{font-size:13\.5px;font-weight:700;color:#2563eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\}/,
  );
});

test('painel.js: .rv-adm-mini keeps white-space:nowrap and gains overflow:hidden/text-overflow:ellipsis', () => {
  assert.match(
    painelSrc,
    /\.rv-adm-mini\{font-size:13px;color:#3f4757;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\}/,
  );
});

test('painel.js: no other CSS rule was touched (only the two ratified selectors changed)', () => {
  // Sanity check that neighboring rules (untouched) still have their
  // original exact shape — guards against an over-broad find/replace.
  assert.match(painelSrc, /\.rv-adm-action-title\{font-size:13\.5px;font-weight:600;color:#16203a;min-width:0;\}/);
  assert.match(painelSrc, /\.rv-adm-cta\{flex-shrink:0;border-radius:4px;border:1px solid #bcd3f7;/);
});
