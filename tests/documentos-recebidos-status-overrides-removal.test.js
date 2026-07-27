// =====================================================================
// === tests/documentos-recebidos-status-overrides-removal.test.js ======
// Focused test: statusOverrides visual fallback removal (G28-B5-D5-B3).
//
// Phase: G28-B5-D5-B3 (remove statusOverrides from documentos-recebidos)
// Scope: proves that local persistence failure shows explicit error and
//   never causes a document to look accepted/rejected unless persistence
//   succeeded. Preserves B1/B2 explicit document-source boundary and
//   canonical Supabase flow.
//
// Required coverage:
//   1. legacy/manual save success with exact explicit source;
//      effective status changes only through real persistence.
//   2. local save failure: error toast, original status,
//      no fake accepted/rejected, retry possible.
//   3. local remove success: persisted decision removed and
//      original status restored.
//   4. local remove failure: error toast and persisted decision
//      remains visibly effective.
//   5. Supabase: no local helper calls and canonical flow preserved.
//   6. unknown: no action/calls and original status.
//   7. rerender/reload only gets a decision from real persistence.
//   8. static source assertion: zero statusOverrides and zero
//      prohibited substitute names in runtime source.
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
  assert.ok(fs.existsSync(p), 'file not found: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screenSrc = readOrFail(SCREEN);
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

const LEGACY_DOC_ID = 'cda18ef9-d1d9-4f5a-8956-74875cd60b05';
const SUPA_DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

function makeDoc(overrides) {
  return Object.assign({
    document_id: LEGACY_DOC_ID,
    filename_original: 'doc.pdf', tipo_documento: 'nf', formato: 'pdf',
    status: 'pending',
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
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  removeChild(n) { var idx = this.children.indexOf(n); if (idx >= 0) this.children.splice(idx, 1); return n; }
  replaceChildren() { this.children = []; }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
  focus() {}
}

function findAll(node, pred, out) {
  out = out || [];
  if (node && pred(node)) out.push(node);
  if (node && node.children) {
    for (var i = 0; i < node.children.length; i++) {
      findAll(node.children[i], pred, out);
    }
  }
  return out;
}

function findAction(action) {
  return function (node) {
    return !!(node && node._attrs && node._attrs['data-action'] === action);
  };
}

function findStatusPill(root) {
  return findAll(root, function (n) {
    return n._attrs && n._attrs['data-field'] === 'status';
  });
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

  var localStorageMock = (function () {
    var _data = {};
    return {
      getItem: function (k) { return _data.hasOwnProperty(k) ? _data[k] : null; },
      setItem: function (k, v) { _data[k] = String(v); },
      removeItem: function (k) { delete _data[k]; },
      clear: function () { _data = {}; },
      get length() { return Object.keys(_data).length; },
      key: function (i) { return Object.keys(_data)[i] || null; },
    };
  })();

  var documentMock = {
    createElement: function (t) { return new FakeNode(t); },
    createTextNode: function (t) { return { textContent: t, appendChild: function () {}, setAttribute: function () {} }; },
    querySelector: function () { return new FakeNode('div'); },
    querySelectorAll: function () { return []; },
    getElementById: function () { return new FakeNode('div'); },
    addEventListener: function () {},
    removeEventListener: function () {},
    body: new FakeNode('body'),
    head: new FakeNode('head'),
  };

  var sb = {
    document: documentMock,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URL: URL,
    URLSearchParams: URLSearchParams,
    sessionStorage: sessionStorageMock,
    localStorage: localStorageMock,
    crypto: {
      randomUUID: function () { return '11111111-1111-4111-8111-111111111111'; },
    },
    window: null,
    globalThis: null,
    CURRENT_USER: { nome: 'Admin', tipo: 'admin' },
    logout: function () {},
    toast: function () {},
    setApp: function () {},
    open: function () {},
    prompt: function () { return ''; },
    ADMIN_MENU: [],
    shellLayout: function (menu, content) { return content; },
    location: { hash: '' },
    el: function (tag, attrs, children) {
      var node = new FakeNode(tag);
      if (attrs) {
        for (var k in attrs) {
          if (k === 'style') node.style = attrs[k];
          else if (k === 'class') node.className = attrs[k];
          else node.setAttribute(k, attrs[k]);
        }
      }
      if (children !== undefined) {
        if (typeof children === 'string') {
          node._text = children;
        } else if (Array.isArray(children)) {
          for (var i = 0; i < children.length; i++) {
            if (children[i] != null) node.appendChild(children[i]);
          }
        } else if (children != null) {
          node.appendChild(children);
        }
      }
      return node;
    },
  };
  sb.window = sb;
  sb.globalThis = sb;

  vm.createContext(sb);
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sb, { filename: 'js/select-popover.js' });
  vm.runInContext(ui, sb, { filename: 'js/ui.js' });
  vm.runInContext(ingestor, sb, { filename: 'js/documents-ingestor.js' });
  vm.runInContext(loader, sb, { filename: 'js/documents-ingestor-loader.js' });
  vm.runInContext(readerSrc, sb, { filename: 'js/documents-supabase-reader.js' });
  vm.runInContext(commandSrc, sb, { filename: 'js/documents-decision-command.js' });
  vm.runInContext(controllerSrc, sb, { filename: 'js/documents-decision-controller.js' });
  vm.runInContext(decisionModalSrc, sb, { filename: 'js/screens/documentos-recebidos-decision-modal.js' });
  vm.runInContext(common, sb, { filename: 'js/screens/common.js' });
  vm.runInContext(screenSrc, sb, { filename: 'js/screens/documentos-recebidos.js' });

  if (received !== undefined) {
    sb.window.RAVATEX_DOCUMENTS_RECEIVED = received;
  }
  return sb;
}

function getStatusFromPill(root) {
  var pills = findStatusPill(root);
  if (!pills.length) return null;
  return pills[0]._attrs['data-status'] || null;
}

function getStatusLabelFromPill(root) {
  var pills = findStatusPill(root);
  if (!pills.length) return '';
  return pills[0].textContent || '';
}

// ---------------------------------------------------------------------
// Test 1: legacy/manual save success — effective status changes only
// through real persistence
// ---------------------------------------------------------------------

test('B3: manual save success changes status through real persistence', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  // Before save: status should be pending
  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'initial status is pending');

  // Save decision via real persistence (localStorage helper)
  var saved = sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }, 'manual'
  );
  assert.ok(saved.ok, 'save succeeded');

  // Rerender: status should now be accepted (via getEffectiveDocumentStatus)
  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status changed to accepted after persisted save');
});

test('B3: legacy save success changes status through real persistence', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'legacy' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'initial status is pending');

  var saved = sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'rejected', motivo: 'invalid' }, 'legacy'
  );
  assert.ok(saved.ok, 'save succeeded');

  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'rejected', 'status changed to rejected after persisted save');
});

// ---------------------------------------------------------------------
// Test 2: local save failure — error toast, original status, no fake
// accepted/rejected, retry possible
// ---------------------------------------------------------------------

test('B3: save failure shows error toast and keeps original status (manual accept)', function () {
  var toastMessages = [];
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () {
    return { ok: false, error: 'localStorage failed' };
  };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'original status is pending');

  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  acceptBtn._listeners.click[0]();

  // After failed save: status must still be pending (no fake accepted)
  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'status remains pending after failed save');

  // Error toast shown
  var hasErrorToast = toastMessages.some(function (t) {
    return t.type === 'error' && t.msg.indexOf('Não foi possível salvar a decisão local') >= 0;
  });
  assert.ok(hasErrorToast, 'error toast shown on save failure');

  // No success toast
  var hasSuccessToast = toastMessages.some(function (t) {
    return t.type === 'success' || t.msg.indexOf('aceito') >= 0;
  });
  assert.equal(hasSuccessToast, false, 'no success toast on save failure');

  // Retry possible: accept button still present
  assert.ok(findAll(result, findAction('aceitar-documento')).length > 0, 'retry possible (accept button present)');
});

test('B3: save failure shows error toast and keeps original status (manual reject)', function () {
  var toastMessages = [];
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () {
    return { ok: false, error: 'localStorage failed' };
  };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };
  sb.window.prompt = function () { return 'motivo qualquer'; };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'original status is pending');

  var rejectBtn = findAll(result, findAction('rejeitar-documento'))[0];
  rejectBtn._listeners.click[0]();

  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'status remains pending after failed reject save');

  var hasErrorToast = toastMessages.some(function (t) {
    return t.type === 'error' && t.msg.indexOf('Não foi possível salvar a decisão local') >= 0;
  });
  assert.ok(hasErrorToast, 'error toast shown on reject save failure');

  assert.ok(findAll(result, findAction('rejeitar-documento')).length > 0, 'retry possible (reject button present)');
});

// ---------------------------------------------------------------------
// Test 3: local remove success — persisted decision removed and
// original status restored
// ---------------------------------------------------------------------

test('B3: remove success restores original status via real persistence', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  // Save a decision first
  var saved = sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }, 'manual'
  );
  assert.ok(saved.ok, 'save succeeded');

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status is accepted after persist');

  // Undo button should appear
  assert.ok(findAll(result, findAction('desfazer-decisao-documento')).length > 0,
    'undo button visible after local decision');

  // Click undo
  var undoBtn = findAll(result, findAction('desfazer-decisao-documento'))[0];
  undoBtn._listeners.click[0]();

  // After remove: status should be back to pending (original imported status)
  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'status restored to pending after remove');
});

// ---------------------------------------------------------------------
// Test 4: local remove failure — error toast and persisted decision
// remains visible
// ---------------------------------------------------------------------

test('B3: remove failure shows error toast and decision remains effective', function () {
  var toastMessages = [];
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };

  // Save a decision first (using real persistence)
  var saved = sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }, 'manual'
  );
  assert.ok(saved.ok);

  // Override remove to fail
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () {
    return { ok: false, error: 'localStorage failed' };
  };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status is accepted (from persistence)');

  var undoBtn = findAll(result, findAction('desfazer-decisao-documento'))[0];
  undoBtn._listeners.click[0]();

  // Status must still be accepted (persisted decision still effective)
  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status remains accepted after failed remove');

  var hasErrorToast = toastMessages.some(function (t) {
    return t.type === 'error' && t.msg.indexOf('Não foi possível desfazer a decisão local') >= 0;
  });
  assert.ok(hasErrorToast, 'error toast shown on remove failure');

  var hasSuccessToast = toastMessages.some(function (t) {
    return t.type !== 'error' && t.msg.indexOf('removida') >= 0;
  });
  assert.equal(hasSuccessToast, false, 'no success toast on remove failure');
});

// ---------------------------------------------------------------------
// Test 5: Supabase — no local helper calls and canonical flow preserved
// ---------------------------------------------------------------------

test('B3: Supabase doc uses cloud adapter, NOT local save/remove', function () {
  var sb = makeSandbox([makeDoc({
    document_id: SUPA_DOC_ID,
    _ravatex_source: 'supabase',
    status: 'pending',
  })]);
  var saveCalls = 0;
  var removeCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  var result = sb.window.screenDocumentosRecebidos();
  // Should show cloud buttons
  assert.ok(findAll(result, findAction('aceitar-documento-nuvem')).length > 0, 'supabase: has cloud accept');
  assert.ok(findAll(result, findAction('rejeitar-documento-nuvem')).length > 0, 'supabase: has cloud reject');
  // Should NOT show local buttons
  assert.equal(findAll(result, findAction('aceitar-documento')).length, 0, 'supabase: NO local accept');
  assert.equal(findAll(result, findAction('rejeitar-documento')).length, 0, 'supabase: NO local reject');
  // No local helper calls
  assert.equal(saveCalls, 0, 'supabase: no saveDocumentDecision call');
  assert.equal(removeCalls, 0, 'supabase: no removeDocumentDecision call');
});

// ---------------------------------------------------------------------
// Test 6: unknown — no action/calls and original status
// ---------------------------------------------------------------------

test('B3: unknown source shows no decision actions and original status', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: undefined })]);
  var saveCalls = 0;
  var removeCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  var result = sb.window.screenDocumentosRecebidos();

  assert.equal(findAll(result, findAction('aceitar-documento-nuvem')).length, 0, 'unknown: NO cloud accept');
  assert.equal(findAll(result, findAction('rejeitar-documento-nuvem')).length, 0, 'unknown: NO cloud reject');
  assert.equal(findAll(result, findAction('aceitar-documento')).length, 0, 'unknown: NO local accept');
  assert.equal(findAll(result, findAction('rejeitar-documento')).length, 0, 'unknown: NO local reject');
  assert.equal(findAll(result, findAction('desfazer-decisao-documento')).length, 0, 'unknown: NO local undo');

  assert.equal(saveCalls, 0, 'unknown: no saveDocumentDecision call');
  assert.equal(removeCalls, 0, 'unknown: no removeDocumentDecision call');

  assert.equal(getStatusFromPill(result), 'pending', 'unknown: original status preserved');
});

// ---------------------------------------------------------------------
// Test 7: rerender/reload only gets a decision from real persistence
// ---------------------------------------------------------------------

test('B3: rerender shows status from real persistence, not ephemeral state', function () {
  var sharedStorage = {};
  var localStorageMock = (function () {
    return {
      getItem: function (k) { return sharedStorage.hasOwnProperty(k) ? sharedStorage[k] : null; },
      setItem: function (k, v) { sharedStorage[k] = String(v); },
      removeItem: function (k) { delete sharedStorage[k]; },
      clear: function () { sharedStorage = {}; },
      get length() { return Object.keys(sharedStorage).length; },
      key: function (i) { return Object.keys(sharedStorage)[i] || null; },
    };
  })();

  function makeSandboxWithStorage(received) {
    var sb = makeSandbox(received);
    sb.localStorage = localStorageMock;
    // Re-run the ingestor so it picks up the shared localStorage mock
    // We need to reconstruct the sandbox with the custom localStorage
    var sessionStorageMock = (function () {
      var _data = {};
      return {
        getItem: function (k) { return _data.hasOwnProperty(k) ? _data[k] : null; },
        setItem: function (k, v) { _data[k] = String(v); },
        removeItem: function (k) { delete _data[k]; },
        clear: function () { _data = {}; },
      };
    })();

    var documentMock = {
      createElement: function (t) { return new FakeNode(t); },
      createTextNode: function (t) { return { textContent: t, appendChild: function () {}, setAttribute: function () {} }; },
      querySelector: function () { return new FakeNode('div'); },
      querySelectorAll: function () { return []; },
      getElementById: function () { return new FakeNode('div'); },
      addEventListener: function () {},
      removeEventListener: function () {},
      body: new FakeNode('body'),
      head: new FakeNode('head'),
    };

    var sb2 = {
      document: documentMock,
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      URL: URL,
      URLSearchParams: URLSearchParams,
      sessionStorage: sessionStorageMock,
      localStorage: localStorageMock,
      crypto: {
        randomUUID: function () { return '11111111-1111-4111-8111-111111111111'; },
      },
      window: null,
      globalThis: null,
      CURRENT_USER: { nome: 'Admin', tipo: 'admin' },
      logout: function () {},
      toast: function () {},
      setApp: function () {},
      open: function () {},
      prompt: function () { return ''; },
      ADMIN_MENU: [],
      shellLayout: function (menu, content) { return content; },
      location: { hash: '' },
      el: function (tag, attrs, children) {
        var node = new FakeNode(tag);
        if (attrs) {
          for (var k in attrs) {
            if (k === 'style') node.style = attrs[k];
            else if (k === 'class') node.className = attrs[k];
            else node.setAttribute(k, attrs[k]);
          }
        }
        if (children !== undefined) {
          if (typeof children === 'string') {
            node._text = children;
          } else if (Array.isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              if (children[i] != null) node.appendChild(children[i]);
            }
          } else if (children != null) {
            node.appendChild(children);
          }
        }
        return node;
      },
    };
    sb2.window = sb2;
    sb2.globalThis = sb2;

    vm.createContext(sb2);
    // Pass-7: js/ui.js::selectInput() delegates to the canonical select
    // popover, so the owner must exist in the sandbox before ui.js runs.
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sb2, { filename: 'js/select-popover.js' });
    vm.runInContext(ui, sb2, { filename: 'js/ui.js' });
    vm.runInContext(ingestor, sb2, { filename: 'js/documents-ingestor.js' });
    vm.runInContext(loader, sb2, { filename: 'js/documents-ingestor-loader.js' });
    vm.runInContext(readerSrc, sb2, { filename: 'js/documents-supabase-reader.js' });
    vm.runInContext(commandSrc, sb2, { filename: 'js/documents-decision-command.js' });
    vm.runInContext(controllerSrc, sb2, { filename: 'js/documents-decision-controller.js' });
    vm.runInContext(decisionModalSrc, sb2, { filename: 'js/screens/documentos-recebidos-decision-modal.js' });
    vm.runInContext(common, sb2, { filename: 'js/screens/common.js' });
    vm.runInContext(screenSrc, sb2, { filename: 'js/screens/documentos-recebidos.js' });

    if (received !== undefined) {
      sb2.window.RAVATEX_DOCUMENTS_RECEIVED = received;
    }
    return sb2;
  }

  var sb = makeSandboxWithStorage([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  // Initial render: pending
  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'initial pending');

  // Persist a decision through the real helper
  var saved = sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }, 'manual'
  );
  assert.ok(saved.ok);

  // Simulate reload: new sandbox with same shared localStorage
  var sb2 = makeSandboxWithStorage([makeDoc({ _ravatex_source: 'manual' })]);
  sb2.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };

  // Rerender in the new sandbox: status should be accepted (from localStorage persistence)
  result = sb2.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'after reload: status from real persistence');

  // Remove the persisted decision
  var removed = sb2.window.RAVATEX_DOCUMENTS.removeDocumentDecision(LEGACY_DOC_ID, 'manual');
  assert.ok(removed.ok);

  // Re-render: status should be back to pending
  result = sb2.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'after remove: status restored to original');
});

// ---------------------------------------------------------------------
// Test 8: static source assertion — zero statusOverrides and zero
// prohibited substitute names in runtime source
// ---------------------------------------------------------------------

test('B3: static check — no statusOverrides or prohibited substitute names in source', function () {
  var src = fs.readFileSync(SCREEN, 'utf8');

  // No statusOverrides
  assert.equal(src.indexOf('statusOverrides'), -1,
    'source must not contain statusOverrides');

  // No prohibited substitute names
  var forbidden = [
    'decisionOverrides',
    'localDecisionOverrides',
    'temporaryDecisionStatus',
    'sessionDecisionStatus',
  ];
  forbidden.forEach(function (name) {
    assert.equal(src.indexOf(name), -1,
      'source must not contain prohibited name: ' + name);
  });
});

// ---------------------------------------------------------------------
// Test 9: helper unavailable (null/undefined) — error toast, no change
// ---------------------------------------------------------------------

test('B3: saveDocumentDecision unavailable shows error and no status change', function () {
  var toastMessages = [];
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  // Remove saveDocumentDecision
  delete sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision;
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'initial pending');

  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  acceptBtn._listeners.click[0]();

  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'pending', 'status unchanged after unavailable helper');

  var hasErrorToast = toastMessages.some(function (t) {
    return t.type === 'error' && t.msg.indexOf('Não foi possível salvar a decisão local') >= 0;
  });
  assert.ok(hasErrorToast, 'error toast shown when helper unavailable');
});

test('B3: removeDocumentDecision unavailable shows error and no change', function () {
  var toastMessages = [];
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  // Save a decision first
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }, 'manual'
  );

  // Remove the helper
  delete sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision;
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };

  var result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status shows accepted from persistence');

  var undoBtn = findAll(result, findAction('desfazer-decisao-documento'))[0];
  undoBtn._listeners.click[0]();

  result = sb.window.screenDocumentosRecebidos();
  assert.equal(getStatusFromPill(result), 'accepted', 'status remains accepted after failed remove');

  var hasErrorToast = toastMessages.some(function (t) {
    return t.type === 'error' && t.msg.indexOf('Não foi possível desfazer a decisão local') >= 0;
  });
  assert.ok(hasErrorToast, 'error toast shown when helper unavailable');
});
