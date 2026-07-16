// =====================================================================
// === tests/ui-documentos-recebidos-layout-fix.smoke.js =================
// Unit smoke for UI-DOCUMENTOS-RECEBIDOS-LAYOUT-FIX: closes the
// overlap defects found by the architect's live visual inspection of
// #/documentos-recebidos (UI-DOCUMENTOS-RECEBIDOS-LAYOUT-DIAGNOSIS):
//   (a) PEDIDO cell (pedidoCell()) overflowing into DATAS — missing
//       overflow:hidden/text-overflow:ellipsis/min-width:0 alongside
//       its existing white-space:nowrap;
//   (b) AÇÕES cell (buildActionButtons()'s wrap div) — source-file-
//       unavailable label + decision icon buttons could occupy the
//       same fixed 148px flex row with no flex-wrap, overflowing.
//
// Reuses the same vm sandbox shape as tests/documentos-recebidos.smoke.js
// (makeScreenSandbox), against the REAL js/ui.js + documentos-recebidos.js.
//
// Runs with: node --test tests/ui-documentos-recebidos-layout-fix.smoke.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'documentos-recebidos.js');
const INGESTOR = path.join(ROOT, 'js', 'documents-ingestor.js');
const LOADER = path.join(ROOT, 'js', 'documents-ingestor-loader.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const IMPORT_RECEIVED = path.join(ROOT, 'js', 'documents-ingestor-import-received.js');
const AUTO_LOAD = path.join(ROOT, 'js', 'documents-ingestor-auto-load.js');
const READER = path.join(ROOT, 'js', 'documents-supabase-reader.js');
const COMMAND = path.join(ROOT, 'js', 'documents-decision-command.js');
const VALIDATION_CMD = path.join(ROOT, 'js', 'documents-validation-command.js');
const CONTROLLER = path.join(ROOT, 'js', 'documents-decision-controller.js');
const DECISION_MODAL = path.join(ROOT, 'js', 'screens', 'documentos-recebidos-decision-modal.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const ingestor = readOrFail(INGESTOR);
const loader = readOrFail(LOADER);
const common = readOrFail(COMMON);
const ui = readOrFail(UI);
const importReceivedSrc = readOrFail(IMPORT_RECEIVED);
const autoLoadSrc = readOrFail(AUTO_LOAD);
const readerSrc = readOrFail(READER);
const commandSrc = readOrFail(COMMAND);
const validationCmdSrc = readOrFail(VALIDATION_CMD);
const controllerSrc = readOrFail(CONTROLLER);
const decisionModalSrc = readOrFail(DECISION_MODAL);

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this._attrs = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
  }
  appendChild(n) { if (n != null) { this.children.push(n); n.parentNode = this; } return n; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  removeChild(n) { var idx = this.children.indexOf(n); if (idx >= 0) this.children.splice(idx, 1); return n; }
  replaceChildren() { this.children = []; }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function findAll(node, pred, out) {
  out = out || [];
  if (node && pred(node)) out.push(node);
  if (node && node.children) {
    for (const c of node.children) findAll(c, pred, out);
  }
  return out;
}

function findRow(node) {
  return (node && node._attrs && node._attrs['data-row'] === 'documento-recebido');
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function makeScreenSandbox(received) {
  const documentMock = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  var sessionStorageMock = (function () {
    var _data = {};
    return {
      getItem: function (k) { return _data.hasOwnProperty(k) ? _data[k] : null; },
      setItem: function (k, v) { _data[k] = String(v); },
      removeItem: function (k) { delete _data[k]; },
      clear: function () { _data = {}; },
    };
  })();

  const sandbox = {
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    sessionStorage: sessionStorageMock,
    crypto: {
      randomUUID: (function () {
        var n = 0;
        return function () { n++; return '1111' + String(n).padStart(4, '0') + '-1111-4111-8111-111111111111'; };
      })(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.CURRENT_USER = { nome: 'Admin', tipo: 'admin' };
  sandbox.logout = () => {};

  vm.createContext(sandbox);
  vm.runInContext(ui, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(ingestor, sandbox, { filename: 'js/documents-ingestor.js' });
  vm.runInContext(loader, sandbox, { filename: 'js/documents-ingestor-loader.js' });
  vm.runInContext(readerSrc, sandbox, { filename: 'js/documents-supabase-reader.js' });
  vm.runInContext(autoLoadSrc, sandbox, { filename: 'js/documents-ingestor-auto-load.js' });
  vm.runInContext(importReceivedSrc, sandbox, { filename: 'js/documents-ingestor-import-received.js' });
  vm.runInContext(commandSrc, sandbox, { filename: 'js/documents-decision-command.js' });
  vm.runInContext(validationCmdSrc, sandbox, { filename: 'js/documents-validation-command.js' });
  vm.runInContext(controllerSrc, sandbox, { filename: 'js/documents-decision-controller.js' });
  vm.runInContext(decisionModalSrc, sandbox, { filename: 'js/screens/documentos-recebidos-decision-modal.js' });
  vm.runInContext(common, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(screen, sandbox, { filename: 'js/screens/documentos-recebidos.js' });

  if (received !== undefined) {
    sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = received;
  } else {
    delete sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  }

  return sandbox;
}

test('node --check passes on documentos-recebidos.js', () => {
  require('node:child_process').execSync(`node --check "${SCREEN}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// (a) PEDIDO cell — §7.1 truncation bundle + title tooltip
// ---------------------------------------------------------------------

test('PEDIDO cell (linked): full §7.1 bundle present, title carries the full token, full text stays in the DOM', () => {
  const longPedido = 'G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a92aa11bb22cc33dd44ee';
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-long-ped',
      filename_original: 'NF-003.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/long',
      pedido_manual: longPedido,
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  assert.ok(row, 'row nao encontrado');
  const pedidoCell = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'pedido')[0];
  assert.ok(pedidoCell, 'celula de pedido nao encontrada');

  const style = pedidoCell._attrs.style || '';
  assert.match(style, /white-space:nowrap/);
  assert.match(style, /overflow:hidden/);
  assert.match(style, /text-overflow:ellipsis/);
  assert.match(style, /min-width:0/);
  assert.equal(pedidoCell._attrs.title, longPedido, 'title deve carregar o token completo');
  assert.equal(pedidoCell._attrs['data-pedido'], longPedido, 'data-pedido preservado (regressao)');
  assert.ok(textOf(pedidoCell).indexOf(longPedido) >= 0,
    'texto completo deve continuar no DOM (CSS trunca a renderizacao, nao a string)');
});

test('PEDIDO cell (fallback "Não mapeado"): same §7.1 bundle present, no title required (short static label)', () => {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-no-ped',
      filename_original: 'NF-004.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/nofound',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const pedidoCell = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'pedido')[0];
  assert.ok(pedidoCell, 'celula de pedido nao encontrada');
  const style = pedidoCell._attrs.style || '';
  assert.match(style, /overflow:hidden/);
  assert.match(style, /text-overflow:ellipsis/);
  assert.match(style, /min-width:0/);
  assert.equal(pedidoCell._attrs['data-pedido'], '', 'data-pedido vazio preservado (regressao)');
  assert.ok(textOf(pedidoCell).indexOf('Não mapeado') >= 0);
});

// ---------------------------------------------------------------------
// (b) AÇÕES wrap — flex-wrap:wrap so label + buttons stack instead of
// overflowing the fixed 148px column.
// ---------------------------------------------------------------------

test('AÇÕES cell wrap: carries flex-wrap:wrap (source string — column-sizing fix, not truncation)', () => {
  assert.match(
    screen,
    /var wrap = window\.el\('div', \{\s*\n\s*style: 'display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;',/,
  );
});

test('AÇÕES cell wrap: renders with flex-wrap:wrap at runtime for a document with a drive link', () => {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-acoes',
      filename_original: 'NF-005.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/acoes',
      pedido_manual: 'PED-05-2026',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  assert.ok(row, 'row nao encontrado');
  // Sem queueItem, buildActionButtons() cai no branch "Indisponível"
  // (data-action="sem-link") — suficiente para localizar o wrap real.
  const semLink = findAll(row, (n) => n._attrs && n._attrs['data-action'] === 'sem-link')[0];
  assert.ok(semLink, 'span "Indisponível" nao encontrado — nao foi possivel localizar a celula de acoes');
  const acoesWrap = semLink.parentNode;
  assert.ok(acoesWrap, 'wrap pai do span "Indisponível" nao encontrado');
  assert.match(acoesWrap._attrs.style || '', /flex-wrap:wrap/);
});

// ---------------------------------------------------------------------
// stateSpan() — defensive §7.1 bundle (source-level; labels are short
// enum-mapped strings today, no runtime repro needed for this class).
// ---------------------------------------------------------------------

test('stateSpan(): gained the defensive §7.1 bundle alongside its existing white-space:nowrap', () => {
  assert.match(
    screen,
    /function stateSpan\(label, ariaLabel, color\) \{\s*\n\s*return window\.el\('span', \{\s*\n\s*style: 'font-size:10\.5px;color:' \+ \(color \|\| '#8a93a3'\) \+ ';white-space:nowrap;'\s*\n\s*\+ 'overflow:hidden;text-overflow:ellipsis;min-width:0;',/,
  );
});
