// =====================================================================
// === tests/ui-grid-text-lot-a.smoke.js =================================
// Unit smoke for UI-GRID-TEXT-LOT-A: applies the §7.1 grid/list
// text-cell overflow rule (docs/architecture/UI_VISUAL_CONTRACT.md),
// via the shared window.truncatedCell() primitive (js/ui.js,
// UI-GRID-TEXT-HELPER), to two grids in js/screens/cadastros.js:
//   - screenCadastrosClientes: NOME, CONTATO
//   - screenCadastrosFornecedores: NOME, EMAIL
//
// Verifies (against the REAL js/ui.js + common.js + cadastros.js in a
// vm sandbox, fake supa, no real screen wired):
//   - both grids render their target cells via window.truncatedCell
//     (nowrap/hidden/ellipsis/min-width:0 present, per §7.1);
//   - a long synthetic value truncates visually (CSS) but the full
//     text is preserved verbatim in the DOM, with a `title` tooltip
//     carrying it;
//   - the "—" fallback (Clientes CONTATO when absent) carries NO
//     `title` attribute — no useless tooltip;
//   - header cells for truncated columns use the same §7.1 CSS as the
//     data rows (consistent header/value truncation);
//   - non-truncated columns (CNPJ, TIPO, ID, ACOES) are unaffected;
//   - resulting grid templates match the reported values (Fornecedores
//     EMAIL widened 1fr→1.6fr to avoid starving typical addresses;
//     Clientes NOME/CONTATO fractions unchanged — no widening judged
//     necessary for name/contact-length values).
//
// Runs with: node --test tests/ui-grid-text-lot-a.smoke.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'js', 'ui.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD = path.join(ROOT, 'js', 'screens', 'cadastros.js');

const uiSrc = fs.readFileSync(UI, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc = fs.readFileSync(CAD, 'utf8');

// Same DOM-like double as tests/ui-action-button.smoke.js /
// tests/ui-truncated-cell.smoke.js: setAttribute always marks presence
// (matches real-browser semantics), plus getAttribute/hasAttribute so
// style/title strings can be asserted directly.
class DomLikeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this._attrs = new Map();
    this.children = [];
    this._listeners = {};
    this.style = {};
    this.className = '';
    this._text = null;
  }
  setAttribute(name, value) { this._attrs.set(name, String(value)); }
  removeAttribute(name) { this._attrs.delete(name); }
  hasAttribute(name) { return this._attrs.has(name); }
  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  appendChild(n) { this.children.push(n); return n; }
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

function makeSandbox({ tableData = {} } = {}) {
  const document = {
    createElement: (t) => new DomLikeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new DomLikeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new DomLikeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient((table) => tableData[table] || []);
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: DomLikeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(cadSrc, sandbox, { filename: 'js/screens/cadastros.js' });
  sandbox.supa = fakeSupa;
  return { sandbox, fakeSupa };
}

function mainOf(node) {
  const flex = node.children.find((c) => c.tagName === 'DIV');
  return flex && flex.children.find((c) => c.tagName === 'MAIN');
}

// truncatedCell()/el() render a DIV whose text is an appended child text
// node, not the DIV's own .textContent (only set via an explicit
// textContent assignment, never done here) — so cell lookups must match
// on the DIV's aggregate rendered text (textOf), not node.textContent.
function findCellByText(root, text) {
  return findAll(root, (n) => n.tagName === 'DIV' && textOf(n) === text)[0];
}

test('node --check passes on js/screens/cadastros.js', () => {
  require('node:child_process').execSync(`node --check "${CAD}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// screenCadastrosClientes — NOME, CONTATO
// ---------------------------------------------------------------------

test('Clientes: NOME and CONTATO cells use the §7.1 truncation CSS (nowrap/hidden/ellipsis/min-width:0)', async () => {
  const longNome = 'Distribuidora e Comercio de Tapetes e Capachos Industriais Ltda ME';
  const longContato = 'Maria da Conceicao Aparecida dos Santos Fernandes de Oliveira Neta';
  const { sandbox } = makeSandbox({
    tableData: { clientes: [{ id: 1, nome: longNome, contato: longContato, cnpj: null }] },
  });
  const node = await vm.runInContext('window.screenCadastrosClientes()', sandbox);
  const main = mainOf(node);
  assert.ok(main, 'screenCadastrosClientes did not render via shellLayout');

  const nomeCell = findCellByText(main, longNome);
  assert.ok(nomeCell, 'NOME cell with the full long name not found in the DOM');
  const nomeStyle = nomeCell.getAttribute('style') || '';
  assert.match(nomeStyle, /white-space:nowrap/);
  assert.match(nomeStyle, /overflow:hidden/);
  assert.match(nomeStyle, /text-overflow:ellipsis/);
  assert.match(nomeStyle, /min-width:0/);
  assert.equal(nomeCell.getAttribute('title'), longNome, 'NOME title tooltip must carry the full value');

  const contatoCell = findCellByText(main, longContato);
  assert.ok(contatoCell, 'CONTATO cell with the full long contact not found in the DOM');
  const contatoStyle = contatoCell.getAttribute('style') || '';
  assert.match(contatoStyle, /white-space:nowrap/);
  assert.match(contatoStyle, /overflow:hidden/);
  assert.match(contatoStyle, /text-overflow:ellipsis/);
  assert.match(contatoStyle, /min-width:0/);
  assert.equal(contatoCell.getAttribute('title'), longContato);
});

test('Clientes: CONTATO "—" fallback carries NO title tooltip', async () => {
  const { sandbox } = makeSandbox({
    tableData: { clientes: [{ id: 1, nome: 'Cliente Sem Contato', contato: null, cnpj: null }] },
  });
  const node = await vm.runInContext('window.screenCadastrosClientes()', sandbox);
  const main = mainOf(node);
  const dashCells = findAll(main, (n) => n.tagName === 'DIV' && textOf(n) === '—');
  assert.ok(dashCells.length > 0, 'no "—" fallback cell found');
  for (const cell of dashCells) {
    assert.equal(cell.hasAttribute('title'), false, '"—" fallback cell must not carry a title tooltip');
  }
});

test('Clientes: header row NOME/CONTATO use the same §7.1 CSS as data rows; CNPJ/ID/ACOES headers unaffected', async () => {
  const { sandbox } = makeSandbox({ tableData: { clientes: [] } });
  const node = await vm.runInContext('window.screenCadastrosClientes()', sandbox);
  const main = mainOf(node);
  const nomeHead = findCellByText(main, 'NOME');
  assert.ok(nomeHead, 'NOME header cell not found');
  assert.match(nomeHead.getAttribute('style') || '', /text-overflow:ellipsis/);
  const contatoHead = findAll(main, (n) => n.tagName === 'DIV' && textOf(n).startsWith('CONTATO '))[0];
  assert.ok(contatoHead, 'CONTATO header cell not found');
  assert.match(contatoHead.getAttribute('style') || '', /text-overflow:ellipsis/);
  const cnpjHead = findCellByText(main, 'CNPJ');
  assert.ok(cnpjHead, 'CNPJ header cell not found');
  assert.doesNotMatch(cnpjHead.getAttribute('style') || '', /text-overflow:ellipsis/,
    'CNPJ is a short fixed-format column — must NOT be truncated');
});

// ---------------------------------------------------------------------
// screenCadastrosFornecedores — NOME, EMAIL
// ---------------------------------------------------------------------

test('Fornecedores: NOME and EMAIL cells use the §7.1 truncation CSS', async () => {
  const longNome = 'Industria e Comercio de Fios Texteis do Vale do Paraiba S.A.';
  const longEmail = 'departamento.comercial.vendas@fornecedor-industrial-textil-corp.com.br';
  const { sandbox } = makeSandbox({
    tableData: { fornecedores: [{ id: 1, nome: longNome, email: longEmail, tipo: 'tecelagem', cnpj: null }] },
  });
  const node = await vm.runInContext('window.screenCadastrosFornecedores()', sandbox);
  const main = mainOf(node);
  assert.ok(main, 'screenCadastrosFornecedores did not render via shellLayout');

  const nomeCell = findCellByText(main, longNome);
  assert.ok(nomeCell, 'NOME cell with the full long name not found in the DOM');
  assert.match(nomeCell.getAttribute('style') || '', /text-overflow:ellipsis/);
  assert.equal(nomeCell.getAttribute('title'), longNome);

  const emailCell = findCellByText(main, longEmail);
  assert.ok(emailCell, 'EMAIL cell with the full long address not found in the DOM');
  const emailStyle = emailCell.getAttribute('style') || '';
  assert.match(emailStyle, /white-space:nowrap/);
  assert.match(emailStyle, /overflow:hidden/);
  assert.match(emailStyle, /text-overflow:ellipsis/);
  assert.match(emailStyle, /min-width:0/);
  assert.equal(emailCell.getAttribute('title'), longEmail);
});

test('Fornecedores: EMAIL "—" fallback carries NO title tooltip', async () => {
  const { sandbox } = makeSandbox({
    tableData: { fornecedores: [{ id: 1, nome: 'Fornecedor Sem Email', email: null, tipo: 'latex', cnpj: null }] },
  });
  const node = await vm.runInContext('window.screenCadastrosFornecedores()', sandbox);
  const main = mainOf(node);
  const dashCells = findAll(main, (n) => n.tagName === 'DIV' && textOf(n) === '—');
  assert.ok(dashCells.length > 0, 'no "—" fallback cell found');
  for (const cell of dashCells) {
    assert.equal(cell.hasAttribute('title'), false, '"—" fallback cell must not carry a title tooltip');
  }
});

test('Fornecedores: grid template widened EMAIL 1fr→1.6fr (NOME/CNPJ/TIPO/ID/ACOES unchanged)', () => {
  const matches = cadSrc.match(/grid-template-columns:1fr 1\.6fr 110px 1fr 70px 100px/g) || [];
  assert.equal(matches.length, 2, 'expected the widened Fornecedores template in both the header row and data rows');
  assert.equal(/grid-template-columns:1fr 1fr 110px 1fr 70px 100px/.test(cadSrc), false,
    'the old, un-widened Fornecedores template must no longer be present');
});

test('Clientes: NOME/CONTATO grid fractions unchanged (1.2fr / 1fr) — no widening judged necessary', () => {
  assert.match(cadSrc, /\{ key: 'nome', label: 'NOME', width: '1\.2fr', truncate: true \}/);
  assert.match(cadSrc, /\{ key: 'contato', label: 'CONTATO', width: '1fr', optional: true, truncate: true \}/);
});

test('Fornecedores: TIPO badge cell (non-text-overflow column) is unaffected', async () => {
  const { sandbox } = makeSandbox({
    tableData: { fornecedores: [{ id: 1, nome: 'X', email: 'x@x.com', tipo: 'tecelagem', cnpj: null }] },
  });
  const node = await vm.runInContext('window.screenCadastrosFornecedores()', sandbox);
  const main = mainOf(node);
  const rendered = textOf(main);
  assert.match(rendered, /Tecelagem \(parte de cima\)/, 'TIPO badge label must still render via labelFornecedorTipo');
});
