'use strict';

// G28-B7 — Pedido detail surface consumes the canonical document-link read
// model. Confirmed links come from the active revision only; pedido_manual
// suggestions are shown separately and never as confirmed links.
//
// TEST-MOCK-FIDELITY-AUDIT R1 adoption (CODE_HEALTH_RULES.md §20): the
// Documentos card is now rendered through the REAL js/ui.js el() backed by the
// shared FaithfulNode (tests/_doubles.js), instead of the hand-rolled
// boolean-blind `buildMockEl` (a text-flatten stub that ignored attributes and
// pre-flattened text). The faithful double models real-DOM boolean-attr
// semantics, so this suite is no longer structurally blind to a
// disabled/checked coercion defect.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FaithfulNode, createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const BUNDLE = [
  readOrFail(path.join(ROOT, 'js', 'documents-ingestor.js')),
  readOrFail(path.join(ROOT, 'js', 'document-surface-links-read-model.js')),
  readOrFail(path.join(ROOT, 'js', 'document-links-surface-ui.js')),
  readOrFail(path.join(ROOT, 'js', 'op-display.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js')),
  readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js')),
].join('\n\n');

// Real UI primitives: js/ui.js defines the global el() (with the
// UI-EL-BOOLEAN-ATTR-FIX) and toast(). Loaded FIRST into the sandbox so the
// pedido-detail bundle renders through the true el(), not a stub.
const uiSrc = readOrFail(path.join(ROOT, 'js', 'ui.js'));

// Walk the rendered FaithfulNode tree and concatenate every leaf's textContent
// with NO separator — exactly what the old buildMockEl's flattenNodeText
// produced (`text += child.textContent`, fully recursive, separator-free). With
// the real el() the leaf text now lives in TextDouble/FaithfulNode children
// rather than on a pre-flattened `.textContent`, so we walk `node.children` and
// read the leaves. Keeping the separator-free join preserves the SAME matching
// strength: every substring that matched before still matches, and none is
// newly split by an introduced separator.
function collectText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (node.children && node.children.length) {
    var out = '';
    for (var i = 0; i < node.children.length; i++) out += collectText(node.children[i]);
    return out;
  }
  return node.textContent != null ? String(node.textContent) : '';
}

function findTextInNode(node, search) {
  return collectText(node).indexOf(search) >= 0;
}

function makeRuntime() {
  var sandbox = {
    document: createDocument(),
    console: { error: function () {}, log: function () {} },
    Node: FaithfulNode,
  };
  // Single global object shared as `window`/`globalThis`, matching the browser
  // and the reference migration (cliente-pedido-tracking.smoke.js).
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Real js/ui.js FIRST: it installs the true el() (UI-EL-BOOLEAN-ATTR-FIX) and
  // toast() as globals, so window.el resolves to the faithful factory.
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  // Non-ui.js collaborator the bundle reads (unchanged from the old stub).
  sandbox.window.RavatexPedidoTracking = null;
  vm.runInContext(BUNDLE, sandbox, { filename: 'pedido-detail-bundle.js' });
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

test('render: canonical link timeline renders for a confirmed document', function () {
  var sandbox = makeRuntime();
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [confirmedDoc()];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var view = ns.computeViewModel(baseState(ns));
  assert.equal(view.linkedDocumentTimeline.state, 'available');
  assert.equal(view.linkedDocumentTimeline.entries.length, 1);
  var card = ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'LINHA DO TEMPO DOS VINCULOS'), 'canonical timeline title');
  assert.ok(findTextInNode(card, 'Documento vinculado'), 'timeline entry label');
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

// TEST-MOCK-FIDELITY-AUDIT R1 / §20 demonstration: proves the faithful
// adoption catches what the old buildMockEl would have masked. That stub
// flattened text and ignored attributes entirely (it only copied onclick), so
// a boolean-attr coercion bug in the surface would have passed green. The real
// el() + FaithfulNode model real-DOM boolean-attr semantics and do not.
test('faithful double + real el() catch a boolean-attr regression the old buildMockEl masked (R1 demo)', function () {
  var sandbox = makeRuntime();
  var el = sandbox.window.el;
  // Fix path: real el() omits a falsy boolean attribute entirely.
  assert.equal(el('button', { disabled: false }).hasAttribute('disabled'), false,
    'disabled:false must be ABSENT (UI-EL-BOOLEAN-ATTR-FIX), verified through the faithful double');
  assert.equal(el('button', { disabled: true }).hasAttribute('disabled'), true,
    'disabled:true must be present');
  // Regression path: a raw setAttribute(k, false) (the pre-fix bug shape) still
  // renders PRESENT in a real-DOM-faithful node, so the bug class is caught —
  // the old buildMockEl stored nothing about attributes and could not
  // distinguish present from absent.
  var raw = new FaithfulNode('button');
  raw.setAttribute('disabled', false);
  assert.equal(raw.hasAttribute('disabled'), true,
    'setAttribute(k, false) renders present in the faithful node — the double catches the bug class');
});
