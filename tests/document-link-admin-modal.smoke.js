'use strict';

// =====================================================================
// === tests/document-link-admin-modal.smoke.js ========================
// DOM smoke of the G28-B8 link admin modal (dependency-injected DOM):
// UI correction / unlink / restoration paths, reason enforcement, and
// fail-closed behaviour when the audit history is unavailable.
// =====================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const MODAL_PATH = path.join(ROOT, 'js', 'screens', 'document-link-admin-modal.js');
const SRC = fs.readFileSync(MODAL_PATH, 'utf8');

const PED = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

// --- Minimal DOM shim (mirrors the decision-modal test harness) -------
class FakeNode {
  constructor(tag) {
    this.tagName = (tag + '').toUpperCase();
    this.children = [];
    this._attrs = {};
    this._text = null;
    this.className = '';
    this.style = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.type = '';
    this.name = '';
    this.id = '';
    this.rows = 0;
    this.parentNode = null;
    this._listeners = {};
  }
  appendChild(n) { if (typeof n === 'string') n = { textContent: n }; this.children.push(n); if (n && typeof n === 'object') n.parentNode = this; return n; }
  removeChild(n) { var i = this.children.indexOf(n); if (i !== -1) this.children.splice(i, 1); return n; }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; if (k === 'id') this.id = v; }
  getAttribute(k) { return this._attrs[k]; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map(function (c) { return typeof c === 'string' ? c : (c && c.textContent) || ''; }).join('');
  }
  set textContent(v) { this._text = v; this.children = []; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { if (!this._listeners[t]) return; var i = this._listeners[t].indexOf(fn); if (i !== -1) this._listeners[t].splice(i, 1); }
  focus() {}
  querySelectorAll() { return []; }
  _findByPred(pred) {
    if (pred(this)) return this;
    for (var i = 0; i < this.children.length; i++) { var c = this.children[i]; if (!c || !c._findByPred) continue; var f = c._findByPred(pred); if (f) return f; }
    return null;
  }
  _findAllByPred(pred, out) {
    out = out || [];
    if (pred(this)) out.push(this);
    for (var i = 0; i < this.children.length; i++) { var c = this.children[i]; if (!c || !c._findAllByPred) continue; c._findAllByPred(pred, out); }
    return out;
  }
}

function makeDoc() {
  var body = new FakeNode('body');
  var active = body;
  var docListeners = {};
  return {
    createElement: function (t) { return new FakeNode(t); },
    createTextNode: function (t) { var n = new FakeNode('#text'); n._text = t; return n; },
    get body() { return body; },
    get activeElement() { return active; },
    set activeElement(el) { active = el; },
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: function () {},
  };
}

function loadModal() {
  var doc = makeDoc();
  var sandbox = { document: doc, window: { document: doc, RAVATEX_DOCUMENTS: {} }, setTimeout: function (fn) { return fn && fn(); }, console: console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: MODAL_PATH });
  var factory = sandbox.window.RAVATEX_DOCUMENTS.createDocumentLinkAdminModal;
  return { modal: factory({ document: doc }), doc: doc };
}

function byId(doc, id) { return doc.body._findByPred(function (n) { return n.id === id; }); }
function byAction(doc, action) { return doc.body._findByPred(function (n) { return n.getAttribute && n.getAttribute('data-action') === action; }); }
function click(node) { if (node && node._listeners.click) node._listeners.click.forEach(function (fn) { fn(); }); }
function change(node) { if (node && node._listeners.change) node._listeners.change.forEach(function (fn) { fn({}); }); }

function availableAudit() {
  return {
    state: 'available', active_revision_id: 'rev-3', active_count: 1, integrity: 'ok',
    entries: [
      { revision_id: 'rev-3', version: 3, active: true, kind: 'linked', pedido_id: PED, op_ids: [7], reason: null, restored_from_revision_id: null },
      { revision_id: 'rev-2', version: 2, active: false, kind: 'unlinked', pedido_id: null, op_ids: [], reason: 'desvinculado', restored_from_revision_id: null },
      { revision_id: 'rev-1', version: 1, active: false, kind: 'linked', pedido_id: PED, op_ids: [7], reason: 'superseded', restored_from_revision_id: null },
    ],
  };
}

function targets() {
  return {
    pedidos: [{ id: PED, numero: 25, status: 'confirmado' }],
    ops: [
      { id: 7, numero: 3, ano: 2026, tipo: 'latex', status: 'em_producao', pedido_id: PED },
      { id: 9, numero: 5, ano: 2026, tipo: 'tecelagem', status: 'aberta', pedido_id: null },
    ],
  };
}

test('factory exposes createDocumentLinkAdminModal + required methods', function () {
  const { modal } = loadModal();
  assert.equal(typeof modal.open, 'function');
  ['setBusy', 'setError', 'setOutcome', 'close', 'isOpen', 'destroy'].forEach(function (m) {
    assert.equal(typeof modal[m], 'function');
  });
});

test('open renders a single dialog with the audit title and current links', function () {
  const { modal, doc } = loadModal();
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {});
  const dialogs = doc.body._findAllByPred(function (n) {
    return n.getAttribute && n.getAttribute('role') === 'dialog' && n.getAttribute('aria-modal') === 'true';
  });
  assert.equal(dialogs.length, 1);
  const title = byId(doc, 'r8x-la-title');
  assert.match(title.textContent, /Histórico e vínculos/i);
  const current = byId(doc, 'r8x-la-current');
  assert.match(current.textContent, /Revisão 3/);
  modal.close();
});

test('history renders one restore radio per revoked revision (not the active one)', function () {
  const { modal, doc } = loadModal();
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {});
  const radios = doc.body._findAllByPred(function (n) {
    return n.getAttribute && n.getAttribute('data-role') === 'restore-source';
  });
  assert.equal(radios.length, 2, 'two revoked revisions are restore candidates');
  modal.close();
});

test('UI correction path: pick Pedido + OP + reason -> onCorrect', function () {
  const { modal, doc } = loadModal();
  var captured = null;
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {
    onCorrect: function (i) { captured = i; },
  });
  var sel = byId(doc, 'r8x-la-pedido');
  sel.value = PED;
  change(sel); // rebuilds the OP list under the compatibility filter
  var box = byId(doc, 'r8x-la-oplist')._findByPred(function (n) { return n.tagName === 'INPUT' && n.value === '7'; });
  assert.ok(box, 'compatible OP 7 is offered');
  box.checked = true;
  byId(doc, 'r8x-la-reason').value = '  troca de pedido  ';
  click(byAction(doc, 'corrigir-vinculos'));
  assert.ok(captured, 'onCorrect fired');
  assert.equal(captured.pedidoId, PED);
  // captured.opIds is created inside the vm realm; normalize before comparing.
  assert.deepEqual(Array.from(captured.opIds), [7]);
  assert.equal(captured.reason, 'troca de pedido');
  modal.close();
});

test('UI unlink path: reason -> onUnlink', function () {
  const { modal, doc } = loadModal();
  var captured = null;
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {
    onUnlink: function (i) { captured = i; },
  });
  byId(doc, 'r8x-la-reason').value = 'documento nao pertence';
  click(byAction(doc, 'desvincular'));
  assert.ok(captured);
  assert.equal(captured.reason, 'documento nao pertence');
  modal.close();
});

test('UI restoration path: select a historical revision + reason -> onRestore', function () {
  const { modal, doc } = loadModal();
  var captured = null;
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {
    onRestore: function (i) { captured = i; },
  });
  var radio = doc.body._findByPred(function (n) { return n.getAttribute && n.getAttribute('data-role') === 'restore-source' && n.value === 'rev-1'; });
  radio.checked = true;
  change(radio);
  byId(doc, 'r8x-la-reason').value = 'restaurar v1';
  click(byAction(doc, 'restaurar-revisao'));
  assert.ok(captured);
  assert.equal(captured.sourceRevisionId, 'rev-1');
  assert.equal(captured.reason, 'restaurar v1');
  modal.close();
});

test('reason is enforced: action without reason shows an error and fires no handler', function () {
  const { modal, doc } = loadModal();
  var fired = false;
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {
    onUnlink: function () { fired = true; },
  });
  click(byAction(doc, 'desvincular'));
  assert.equal(fired, false);
  assert.match(byId(doc, 'r8x-la-error').textContent, /motivo/i);
  modal.close();
});

test('restore without a selected source shows an error and fires no handler', function () {
  const { modal, doc } = loadModal();
  var fired = false;
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {
    onRestore: function () { fired = true; },
  });
  byId(doc, 'r8x-la-reason').value = 'restaurar';
  click(byAction(doc, 'restaurar-revisao'));
  assert.equal(fired, false);
  assert.match(byId(doc, 'r8x-la-error').textContent, /Selecione uma revisão/i);
  modal.close();
});

test('fail-closed: unavailable history disables all mutating actions', function () {
  const { modal, doc } = loadModal();
  var fired = false;
  modal.open({ documentId: 'DOC-1', audit: { state: 'unavailable', entries: [] }, linkTargets: targets() }, {
    onUnlink: function () { fired = true; }, onCorrect: function () { fired = true; }, onRestore: function () { fired = true; },
  });
  assert.match(byId(doc, 'r8x-la-unavailable').textContent, /indispon/i);
  assert.equal(byAction(doc, 'corrigir-vinculos').disabled, true);
  assert.equal(byAction(doc, 'desvincular').disabled, true);
  assert.equal(byAction(doc, 'restaurar-revisao').disabled, true);
  click(byAction(doc, 'desvincular'));
  assert.equal(fired, false, 'disabled action does not fire even if clicked');
  modal.close();
});

test('multiple_active integrity is surfaced and locks actions fail-closed', function () {
  const { modal, doc } = loadModal();
  var audit = availableAudit();
  audit.integrity = 'multiple_active';
  audit.active_count = 2;
  modal.open({ documentId: 'DOC-1', audit: audit, linkTargets: targets() }, { onUnlink: function () {} });
  assert.equal(byAction(doc, 'desvincular').disabled, true);
  assert.match(byId(doc, 'r8x-la-unavailable').textContent, /inconsistente|Recarregue/i);
  modal.close();
});

test('conflict/error feedback surfaces via setError / setOutcome', function () {
  const { modal, doc } = loadModal();
  modal.open({ documentId: 'DOC-1', audit: availableAudit(), linkTargets: targets() }, {});
  modal.setError('Comando divergente. Recarregue e tente novamente.');
  assert.match(byId(doc, 'r8x-la-error').textContent, /divergente/i);
  modal.setOutcome('Falha de comunicação. Tente novamente.', 'warning');
  assert.match(byId(doc, 'r8x-la-outcome').textContent, /Falha de comunica/i);
  modal.close();
});

test('suggestion (pedido_manual) is shown read-only and labelled as not a link', function () {
  const { modal, doc } = loadModal();
  modal.open({ documentId: 'DOC-1', suggestion: 'PED-999', audit: availableAudit(), linkTargets: targets() }, {});
  assert.match(byId(doc, 'r8x-la-suggestion').textContent, /Sugestão do Ingestor: PED-999 \(não é vínculo\)/);
  modal.close();
});
