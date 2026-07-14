// =====================================================================
// === tests/documentos-recebidos-decision-integration.test.js ==========
// Integration test: Supabase cloud decision via canonical controller +
// modal + adapter, replacing the old runCloudDecision + window.prompt.
//
// Fase: G28-D-B-CLOUD-DECISION-CANONICAL-CONTROLLER-MODAL
// Escopo: prova que o clique nos botoes de decisao em nuvem passa pelo
//   controller, modal e adapter, e que os outcomes sao tratados conforme
//   as regras (success, stale/conflict, uncertain, failed). Garante
//   tambem que documentos manuais NAO entram no fluxo canonico.
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
const readerSrc = readOrFail(READER);
const commandSrc = readOrFail(COMMAND);
const validationCmdSrc = readOrFail(VALIDATION_CMD);
const controllerSrc = readOrFail(CONTROLLER);
const decisionModalSrc = readOrFail(DECISION_MODAL);

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

const SUPA_DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

function makeSupaDoc(overrides) {
  return Object.assign({
    document_id: SUPA_DOC_ID,
    filename_original: 'NF-cloud.xml', tipo_documento: 'nf', formato: 'xml',
    status: 'pending', pedido_manual: 'PED-99-2026', _ravatex_source: 'supabase',
  }, overrides || {});
}

function makeManualDoc(overrides) {
  return Object.assign({
    document_id: 'cda18ef9-d1d9-4f5a-8956-74875cd60b05',
    filename_original: 'manual.pdf', tipo_documento: 'nf', formato: 'pdf', status: 'pending',
    _ravatex_source: 'manual',
  }, overrides || {});
}

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

function findAction(action) {
  return function (node) {
    return !!(node && node._attrs && node._attrs['data-action'] === action);
  };
}

function flushAsync() {
  return new Promise(function (resolve) { setTimeout(resolve, 10); });
}

function makeSandbox(received) {
  var sessionStorageMock = (function () {
    var _data = {};
    return {
      getItem: function (k) { return _data.hasOwnProperty(k) ? _data[k] : null; },
      setItem: function (k, v) { _data[k] = String(v); },
      removeItem: function (k) { delete _data[k]; },
      clear: function () { _data = {}; },
    };
  })();

  const documentMock = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };

  const sandbox = {
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    sessionStorage: sessionStorageMock,
    crypto: {
      // Distinct ids per call (the atomic validation lifecycle mints two).
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
  vm.runInContext(commandSrc, sandbox, { filename: 'js/documents-decision-command.js' });
  vm.runInContext(validationCmdSrc, sandbox, { filename: 'js/documents-validation-command.js' });
  vm.runInContext(controllerSrc, sandbox, { filename: 'js/documents-decision-controller.js' });
  vm.runInContext(decisionModalSrc, sandbox, { filename: 'js/screens/documentos-recebidos-decision-modal.js' });
  vm.runInContext(common, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(screen, sandbox, { filename: 'js/screens/documentos-recebidos.js' });

  if (received !== undefined) {
    sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = received;
  }
  return sandbox;
}

// ---------------------------------------------------------------------
// Test 1: Click opens controller + modal
// ---------------------------------------------------------------------

test('decisao nuvem: clique abre controller e modal para doc Supabase pending', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var btn = findAll(result, findAction('aceitar-documento-nuvem'))[0];
  assert.ok(btn, 'botao aceitar nuvem existe');
  btn._listeners.click[0]();
  await flushAsync();
  var overlay = findAll(sb.window.document.body, function (n) { return n._attrs && n._attrs['role'] === 'dialog'; })[0];
  assert.ok(overlay, 'modal aberto (overlay com role=dialog)');
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  assert.ok(confirmBtn, 'botao confirmar no modal');
});

// ---------------------------------------------------------------------
// Test 2: Accepted reaches adapter
// ---------------------------------------------------------------------

test('decisao nuvem: accepted chama a acao atomica applyDocumentValidationInCloud e recarrega', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var atomicCalls = 0;
  var reloadCalls = 0;
  var setAppCalls = 0;
  // Controller still needs the decision adapter (reject path).
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () {
    atomicCalls++;
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () { setAppCalls++; };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls, 1, 'acao atomica chamada para accepted');
  assert.equal(reloadCalls, 1, 'reader recarregado');
  assert.ok(setAppCalls >= 1, 'rerender chamado');
});

// ---------------------------------------------------------------------
// Test 3: Rejected reaches adapter
// ---------------------------------------------------------------------

test('decisao nuvem: rejected com motivo chama registerDocumentDecisionInCloud e recarrega', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var adapterCalls = [];
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function (envelope) {
    adapterCalls.push({ decision: envelope.decision, motivo: envelope.motivo });
    return Promise.resolve({ ok: true, outcome: 'created' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var rejectRadio = findAll(sb.window.document.body, function (n) { return n.value === 'rejected'; })[0];
  var motivoTa = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-motivo'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  rejectRadio.checked = true;
  motivoTa.value = 'Documento incompleto';
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls.length, 1, 'adapter chamado para rejected');
  assert.equal(adapterCalls[0].decision, 'rejected', 'decision rejected');
  assert.equal(adapterCalls[0].motivo, 'Documento incompleto', 'motivo repassado');
  assert.equal(reloadCalls, 1, 'reader recarregado');
});

// ---------------------------------------------------------------------
// Test 4: Transport/uncertain does NOT reload
// ---------------------------------------------------------------------

test('decisao nuvem: erro de transporte (network) NAO recarrega reader', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () {
    return Promise.resolve({ ok: false, error: 'network' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(reloadCalls, 0, 'NAO recarrega reader em erro de transporte');
  // Modal still open (uncertain keeps it open)
  var overlay = findAll(sb.window.document.body, function (n) { return n._attrs && n._attrs['role'] === 'dialog'; })[0];
  assert.ok(overlay, 'modal permanece aberto em uncertain');
});

// ---------------------------------------------------------------------
// Test 5: Stale does NOT reload
// ---------------------------------------------------------------------

test('decisao nuvem: stale NAO recarrega reader', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () {
    return Promise.resolve({ ok: false, outcome: 'decision_failed', decision: { ok: false, outcome: 'stale_active_decision' } });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(reloadCalls, 0, 'NAO recarrega reader em stale');
});

// ---------------------------------------------------------------------
// Test 6: Conflict does NOT reload
// ---------------------------------------------------------------------

test('decisao nuvem: conflict NAO recarrega reader', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () {
    return Promise.resolve({ ok: false, outcome: 'link_failed', links: { ok: false, outcome: 'command_conflict' } });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(reloadCalls, 0, 'NAO recarrega reader em conflict');
});

// ---------------------------------------------------------------------
// Test 7: Manual doc uses saveDocumentDecision, NOT canonical flow
// ---------------------------------------------------------------------

test('decisao nuvem: doc manual NAO entra no fluxo canonico (usa saveDocumentDecision)', async function () {
  var sb = makeSandbox([makeManualDoc()]);
  var adapterCalls = 0;
  var saveCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { adapterCalls++; return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  assert.ok(acceptBtn, 'doc manual tem botao aceitar local');
  acceptBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(saveCalls, 1, 'usou saveDocumentDecision (localStorage)');
  assert.equal(adapterCalls, 0, 'NAO chamou adapter para doc manual');
});

// ---------------------------------------------------------------------
// Test 8: Supabase doc with raw._ravatex_server_decision reaches adapter
// with correct expectedActiveDecisionId
// ---------------------------------------------------------------------

test('decisao nuvem: raw._ravatex_server_decision envia expectedActiveDecisionId correto', async function () {
  var decisionId = '44444444-4444-4444-8444-444444444444';
  var commandId = '55555555-5555-4555-8555-555555555555';
  var sb = makeSandbox([makeSupaDoc({
    _ravatex_server_decision: { id: decisionId, command_id: commandId },
  })]);
  var capturedEnvelope = null;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function (envelope) {
    capturedEnvelope = envelope;
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.ok(capturedEnvelope, 'adapter recebeu envelope');
  assert.equal(capturedEnvelope.expectedActiveDecisionId, decisionId,
    'expectedActiveDecisionId = id do _ravatex_server_decision');
});

// ---------------------------------------------------------------------
// Test 9: restorePending is called once per singleton and does NOT
// trigger register/retry
// ---------------------------------------------------------------------

test('restorePending: chamado uma vez na criacao do singleton, sem register/retry', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var reconcileCalls = 0;
  var atomicCalls = 0;
  var origReconcile = sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand;
  sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand = function (activeDecision, options) {
    reconcileCalls++;
    return origReconcile.call(this, activeDecision, options);
  };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () {
    atomicCalls++;
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};

  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Trigger controller creation via button click
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();

  assert.equal(reconcileCalls, 1, 'reconcilePendingCommand chamado uma vez');
  assert.equal(atomicCalls, 0, 'acao atomica nao chamada pelo restore');

  // Normal submit funciona apos restorePending (sem pending conflitante)
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls, 1, 'acao atomica chamada no submit apos restore');
});

// ---------------------------------------------------------------------
// Test 10: atomic accept uncertain -> retry reuses the same command ids
// ---------------------------------------------------------------------

test('decisao nuvem: accept uncertain retria com os mesmos command ids ate o sucesso recarregar', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var atomicCalls = [];
  var reloadCalls = 0;
  var attempt = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function (envelope) {
    atomicCalls.push(envelope);
    attempt++;
    if (attempt <= 2) return Promise.resolve({ ok: false, error: 'network' });
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;

  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls.length, 1, 'primeira chamada atomica');
  assert.equal(reloadCalls, 0, 'sem reload apos network');
  var overlay = findAll(sb.window.document.body, function (n) { return n._attrs && n._attrs['role'] === 'dialog'; })[0];
  assert.ok(overlay, 'modal permanece aberto apos uncertain');

  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls.length, 2, 'segunda chamada atomica (retry)');
  assert.equal(reloadCalls, 0, 'sem reload apos segundo network');
  assert.equal(atomicCalls[0].linkCommandId, atomicCalls[1].linkCommandId, 'retry reusa linkCommandId');
  assert.equal(atomicCalls[0].decisionCommandId, atomicCalls[1].decisionCommandId, 'retry reusa decisionCommandId');

  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls.length, 3, 'terceira chamada atomica');
  assert.equal(atomicCalls[2].linkCommandId, atomicCalls[0].linkCommandId, 'terceiro reusa linkCommandId');
  assert.equal(reloadCalls, 1, 'recarrega apos sucesso');
});

// ---------------------------------------------------------------------
// Test 11: a persisted uncertain validation command is reused (same
// command ids) rather than minting new ones on the next accept.
// ---------------------------------------------------------------------

test('decisao nuvem: validacao pendente uncertain reutiliza command ids no mesmo documento', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var atomicCalls = [];
  var reloadCalls = 0;
  var linkId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  var decId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  sb.window.sessionStorage.setItem('RAVATEX_DOCUMENT_VALIDATION_PENDING_V1', JSON.stringify({
    version: 1, linkCommandId: linkId, decisionCommandId: decId,
    documentId: SUPA_DOC_ID, decision: 'accepted', motivo: null, pedidoId: null, opIds: [],
    expectedActiveRevisionId: null, expectedActiveDecisionId: null,
    state: 'uncertain', createdAt: Date.now() - 1000, expiresAt: Date.now() + 86400000,
  }));
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function (envelope) {
    atomicCalls.push(envelope);
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  await flushAsync();
  assert.equal(atomicCalls.length, 0, 'restore nao reenvia automaticamente');

  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();

  assert.equal(atomicCalls.length, 1, 'acao atomica chamada uma vez');
  assert.equal(atomicCalls[0].linkCommandId, linkId, 'reutiliza linkCommandId pendente');
  assert.equal(atomicCalls[0].decisionCommandId, decId, 'reutiliza decisionCommandId pendente');
  assert.equal(reloadCalls, 1, 'sucesso recarrega uma vez');
});
