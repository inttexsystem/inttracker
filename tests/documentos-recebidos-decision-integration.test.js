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
      randomUUID: function () { return '11111111-1111-4111-8111-111111111111'; },
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

test('decisao nuvem: accepted chama registerDocumentDecisionInCloud e recarrega', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var adapterCalls = 0;
  var reloadCalls = 0;
  var setAppCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    adapterCalls++;
    return Promise.resolve({ ok: true, outcome: 'created' });
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
  assert.equal(adapterCalls, 1, 'adapter chamado para accepted');
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
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
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
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: false, outcome: 'stale_active_decision', error: 'stale_active_decision' });
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
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: false, outcome: 'command_conflict', error: 'command_conflict' });
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
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function (envelope) {
    capturedEnvelope = envelope;
    return Promise.resolve({ ok: true, outcome: 'created' });
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
  var registerCalls = 0;
  var origReconcile = sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand;
  sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand = function (activeDecision, options) {
    reconcileCalls++;
    return origReconcile.call(this, activeDecision, options);
  };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    registerCalls++;
    return Promise.resolve({ ok: true });
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
  assert.equal(registerCalls, 0, 'register nao chamado pelo restorePending');

  // Normal submit funciona apos restorePending (sem pending conflitante)
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(registerCalls, 1, 'register chamado no submit normal apos restorePending');
});

// ---------------------------------------------------------------------
// Test 10: uncertain -> retry with same commandId -> success reloads
// ---------------------------------------------------------------------

test('decisao nuvem: primeira confirma uncertain (sem reload), segunda retry com mesmo commandId, terceira recarrega', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var adapterCalls = [];
  var reloadCalls = 0;
  var attempt = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function (envelope) {
    adapterCalls.push(envelope);
    attempt++;
    if (attempt === 1) return Promise.resolve({ ok: false, error: 'network' });
    if (attempt === 2) return Promise.resolve({ ok: false, error: 'network' });
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
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;

  // 1a confirmacao: network -> uncertain, SEM reload, modal aberto
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls.length, 1, 'primeira chamada ao adapter');
  assert.equal(reloadCalls, 0, 'sem reload apos network');
  var overlay = findAll(sb.window.document.body, function (n) { return n._attrs && n._attrs['role'] === 'dialog'; })[0];
  assert.ok(overlay, 'modal permanece aberto apos uncertain');

  // 2a confirmacao: network -> uncertain, retry() usado, MESMO commandId
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls.length, 2, 'segunda chamada ao adapter');
  assert.equal(reloadCalls, 0, 'sem reload apos segundo network');
  assert.equal(adapterCalls[0].commandId, adapterCalls[1].commandId, 'retry reusa mesmo commandId');
  overlay = findAll(sb.window.document.body, function (n) { return n._attrs && n._attrs['role'] === 'dialog'; })[0];
  assert.ok(overlay, 'modal permanece aberto apos segundo uncertain');

  // 3a confirmacao: sucesso -> reload
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls.length, 3, 'terceira chamada ao adapter');
  assert.equal(adapterCalls[2].commandId, adapterCalls[0].commandId, 'terceiro tambem reusa mesmo commandId');
  assert.equal(reloadCalls, 1, 'recarrega apos sucesso');
});

// ---------------------------------------------------------------------
// Test 11: pending uncertain survives initial render and retries its
// persisted envelope rather than allowing open() to replace it.
// ---------------------------------------------------------------------

test('decisao nuvem: pending uncertain restaurado na montagem reutiliza commandId no mesmo documento', async function () {
  var sb = makeSandbox([makeSupaDoc()]);
  var reconcileCalls = 0;
  var adapterCalls = [];
  var reloadCalls = 0;
  var commandId = '66666666-6666-4666-8666-666666666666';
  var originalReconcile = sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand;
  sb.window.RAVATEX_DOCUMENTS.documentDecisionCommand.reconcilePendingCommand = function (activeDecision, options) {
    reconcileCalls++;
    return originalReconcile.call(this, activeDecision, options);
  };
  sb.window.sessionStorage.setItem('RAVATEX_DOCUMENT_DECISION_PENDING_V1', JSON.stringify({
    version: 1,
    commandId: commandId,
    documentId: SUPA_DOC_ID,
    decision: 'accepted',
    motivo: null,
    expectedActiveDecisionId: null,
    state: 'uncertain',
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 86400000,
  }));
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function (envelope) {
    adapterCalls.push(envelope);
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
  await flushAsync();
  assert.equal(reconcileCalls, 1, 'reconcilia pending na montagem, antes do clique');
  assert.equal(adapterCalls.length, 0, 'restore nao reenvia automaticamente');
  assert.equal(reloadCalls, 0, 'uncertain restaurado nao recarrega reader');

  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();

  assert.equal(adapterCalls.length, 1, 'retry chama adapter uma vez');
  assert.equal(adapterCalls[0].commandId, commandId, 'retry preserva commandId restaurado');
  assert.equal(reloadCalls, 1, 'sucesso do retry recarrega reader uma vez');
});
