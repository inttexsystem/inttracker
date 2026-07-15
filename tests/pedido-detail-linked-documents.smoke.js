'use strict';

// G28-B7 — Pedido detail surface consumes the canonical document-link read
// model. Confirmed links come from the active revision only; pedido_manual
// suggestions are shown separately and never as confirmed links.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const BUNDLE = [
  readOrFail(path.join(ROOT, 'js', 'documents-ingestor.js')),
  readOrFail(path.join(ROOT, 'js', 'document-surface-links-read-model.js')),
  readOrFail(path.join(ROOT, 'js', 'op-display.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js')),
].join('\n\n');

function flattenNodeText(children) {
  var text = '';
  for (var i = 0; i < children.length; i++) {
    var c = children[i];
    if (c === null || c === undefined) continue;
    if (typeof c === 'string') text += c;
    else if (typeof c === 'object' && typeof c.textContent === 'string') text += c.textContent;
  }
  return text;
}

function buildMockEl() {
  return function (tag, attrs) {
    var children = [];
    for (var i = 2; i < arguments.length; i++) {
      if (arguments[i] === null || arguments[i] === undefined) continue;
      children.push(arguments[i]);
    }
    var node = { tag: tag, attrs: attrs || {}, children: children };
    node.textContent = flattenNodeText(children);
    node.appendChild = function (child) {
      if (child === null || child === undefined) return;
      children.push(child);
      node.children = children;
      node.textContent = flattenNodeText(children);
    };
    if (attrs && typeof attrs.onclick === 'function') node.onclick = attrs.onclick;
    return node;
  };
}

function findTextInNode(node, search, visited) {
  visited = visited || new Set();
  if (!node || visited.has(node)) return false;
  visited.add(node);
  if (typeof node === 'string') return node.indexOf(search) >= 0;
  if (node.textContent && node.textContent.indexOf(search) >= 0) return true;
  if (Array.isArray(node.children)) {
    for (var i = 0; i < node.children.length; i++) {
      if (findTextInNode(node.children[i], search, visited)) return true;
    }
  }
  return false;
}

function makeRuntime() {
  var docMock = {
    createElement: function () {
      var el = { innerHTML: '', firstChild: null };
      return {
        get firstChild() { return el.firstChild; },
        set innerHTML(html) { el.innerHTML = html; el.firstChild = { tag: 'svg', textContent: '', children: [] }; },
        get innerHTML() { return el.innerHTML; },
      };
    },
  };
  var sandbox = { window: {}, console: { error: function () {}, log: function () {} } };
  sandbox.window.el = buildMockEl();
  sandbox.window.toast = function () {};
  sandbox.window.RavatexPedidoTracking = null;
  sandbox.document = docMock;
  sandbox.window.document = docMock;
  vm.createContext(sandbox);
  vm.runInContext(BUNDLE, sandbox);
  return sandbox;
}

const PEDIDO_UUID = '33333333-3333-4333-8333-333333333333';

function baseState(ns) {
  var s = ns.createInitialState();
  s.pedido = { id: PEDIDO_UUID, numero: 42, status: 'recebido', metros_total: 0, criado_em: '2026-02-01T10:00:00.000Z' };
  s.itens = [];
  s.ops = [];
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.expedicoes = [];
  s.expedicaoItens = [];
  s.modelosById = {};
  s.coresById = {};
  return s;
}

function confirmedDoc() {
  return {
    document_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    filename_original: 'NF-vinculada.xml',
    tipo_documento: 'nf', formato: 'xml', direcao_nf: 'entrada',
    status: 'accepted', drive_web_view_link: 'https://drive.example/vinc',
    pedido_manual: 'PED-42-2026', pedido_id: null,
    _ravatex_source: 'supabase', _ravatex_server_decision: { status: 'accepted' },
    _ravatex_link_revision: {
      state: 'available', revision_id: 'rev-42', version: 2,
      pedido_id: PEDIDO_UUID, pedido_status: 'em_producao',
      op_links: [{ op_id: 7, op_status: 'aberta' }],
    },
  };
}

function suggestionOnlyDoc() {
  return {
    document_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    filename_original: 'apenas-sugestao.xml',
    tipo_documento: 'nf', formato: 'xml', direcao_nf: 'entrada',
    status: 'pending', drive_web_view_link: null,
    pedido_manual: 'PED-42-2026', pedido_id: PEDIDO_UUID,
    _ravatex_source: 'supabase', _ravatex_server_decision: null,
    _ravatex_link_revision: { state: 'available', revision_id: 'rev-x', version: 1, pedido_id: null, pedido_status: null, op_links: [] },
  };
}

test('view model: confirmed canonical link populates linkedDocumentRows', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [confirmedDoc(), suggestionOnlyDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));

  assert.equal(view.linkedDocumentsState, 'available');
  assert.equal(view.linkedDocumentRows.length, 1, 'only the confirmed doc, not the suggestion');
  assert.equal(view.linkedDocumentRows[0].label, 'NF-vinculada.xml');
  assert.equal(view.linkedDocumentRows[0].linkVersion, 2);
  assert.equal(view.linkedDocumentRows[0].opIds.length, 1);
  assert.equal(view.linkedDocumentRows[0].opIds[0], 7);
});

test('view model: suggestion-only doc stays out of confirmed links', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [suggestionOnlyDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  assert.equal(view.linkedDocumentsState, 'empty');
  assert.equal(view.linkedDocumentRows.length, 0);
});

test('view model: remote unavailable yields explicit unavailable state', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [confirmedDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  assert.equal(view.linkedDocumentsState, 'unavailable');
  assert.equal(view.linkedDocumentRows.length, 0);
});

test('render: DOCUMENTOS VINCULADOS section shows confirmed doc with confirmed pill', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [confirmedDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  var card = ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'DOCUMENTOS VINCULADOS'), 'canonical section title');
  assert.ok(findTextInNode(card, 'NF-vinculada.xml'), 'confirmed filename rendered');
  assert.ok(findTextInNode(card, 'Vinculo confirmado'), 'confirmed pill rendered');
  assert.ok(findTextInNode(card, 'Revisao v2'), 'link revision version rendered');
});

test('render: empty canonical state shows explicit empty message', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [suggestionOnlyDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  var card = ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'Nenhum documento vinculado a este pedido.'), 'explicit empty state');
});

test('render: unavailable canonical state is explicit, not a silent empty', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [confirmedDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'legacy_fallback';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  var card = ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'indisponiveis nesta sessao'), 'explicit unavailable message');
});
