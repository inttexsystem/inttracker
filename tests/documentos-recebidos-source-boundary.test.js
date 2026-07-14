// =====================================================================
// === tests/documentos-recebidos-source-boundary.test.js ===============
// Source-boundary test: tri-state decisionSourceKind classification
// (supabase / legacy / unknown) with explicit _ravatex_source values.
//
// Fase: G28-B5-D5-B1
// Escopo: prova que _ravatex_source === 'supabase' → cloud only;
//   manual/legacy → local save/remove + statusOverrides fallback;
//   undefined/null/empty/whitespace/bogus/G22 → fail-closed:
//   no decision buttons, original status, informative message.
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

const SUPA_DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';
const LEGACY_DOC_ID = 'cda18ef9-d1d9-4f5a-8956-74875cd60b05';

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

function findSourceUnknown(node) {
  return !!(node && node._attrs && node._attrs['data-source'] === 'unknown');
}

function findDecisionSourceLabel(node) {
  return !!(node && node._attrs && node._attrs['data-field'] === 'decision-source-kind');
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

function hasActionButton(root, action) {
  return findAll(root, findAction(action)).length > 0;
}

function hasSourceUnknownMsg(root) {
  return findAll(root, findSourceUnknown).length > 0;
}

// ---------------------------------------------------------------------
// Source-boundary tests
// ---------------------------------------------------------------------

test('G28-B5-D5-B1: supabase doc shows cloud decision buttons, no local buttons', function () {
  var sb = makeSandbox([makeDoc({ document_id: SUPA_DOC_ID, _ravatex_source: 'supabase' })]);
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  var result = sb.window.screenDocumentosRecebidos();
  assert.ok(hasActionButton(result, 'aceitar-documento-nuvem'), 'supabase: has cloud accept');
  assert.ok(hasActionButton(result, 'rejeitar-documento-nuvem'), 'supabase: has cloud reject');
  assert.equal(hasActionButton(result, 'aceitar-documento'), false, 'supabase: NO local accept');
  assert.equal(hasActionButton(result, 'rejeitar-documento'), false, 'supabase: NO local reject');
  assert.equal(hasActionButton(result, 'desfazer-decisao-documento'), false, 'supabase: NO local undo');
  assert.equal(hasSourceUnknownMsg(result), false, 'supabase: NO unknown message');
});

test('G28-B5-D5-B1: manual source doc shows local decision buttons and save/remove', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  var saveCalls = 0;
  var removeCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  var result = sb.window.screenDocumentosRecebidos();

  assert.ok(hasActionButton(result, 'aceitar-documento'), 'manual: has local accept');
  assert.ok(hasActionButton(result, 'rejeitar-documento'), 'manual: has local reject');
  assert.equal(hasActionButton(result, 'aceitar-documento-nuvem'), false, 'manual: NO cloud accept');
  assert.equal(hasActionButton(result, 'rejeitar-documento-nuvem'), false, 'manual: NO cloud reject');

  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  acceptBtn._listeners.click[0]();
  assert.equal(saveCalls, 1, 'manual accept: saveDocumentDecision called');

  var rejectBtn = findAll(result, findAction('rejeitar-documento'))[0];
  sb.window.prompt = function () { return 'motivo qualquer'; };
  rejectBtn._listeners.click[0]();
  assert.equal(saveCalls, 2, 'manual reject: saveDocumentDecision called');
});

test('G28-B5-D5-B1: legacy source doc shows local buttons and save/remove', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'legacy' })]);
  var saveCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  var result = sb.window.screenDocumentosRecebidos();

  assert.ok(hasActionButton(result, 'aceitar-documento'), 'legacy: has local accept');
  assert.ok(hasActionButton(result, 'rejeitar-documento'), 'legacy: has local reject');

  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  acceptBtn._listeners.click[0]();
  assert.equal(saveCalls, 1, 'legacy accept: saveDocumentDecision called');
});

test('G28-B5-D5-B1: manual doc fallback to statusOverrides when save fails', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  var saveCalls = 0;
  var toastMessages = [];
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: false }; };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.toast = function (msg, type) { toastMessages.push({ msg: msg, type: type }); };

  var result = sb.window.screenDocumentosRecebidos();
  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  assert.doesNotThrow(function () { acceptBtn._listeners.click[0](); }, 'handler does not throw');
  assert.equal(saveCalls, 1, 'saveDocumentDecision was called');
  // Fallback toast: "sem persistencia" signals statusOverrides path was taken
  var hasFallbackToast = toastMessages.some(function (t) {
    return t.msg.indexOf('sem persistencia') >= 0;
  });
  assert.ok(hasFallbackToast, 'fallback toast shows sem persistencia (statusOverrides path)');
});

test('G28-B5-D5-B1: manual doc local undo calls removeDocumentDecision', function () {
  var sb = makeSandbox([makeDoc({ _ravatex_source: 'manual' })]);
  var removeCalls = 0;
  var origRemove = sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision;
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () {
    removeCalls++;
    return origRemove.apply(this, arguments);
  };
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: true });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    return Promise.resolve({ ok: true });
  };
  // Use real saveDocumentDecision (persists to localStorage mock) to create a local decision
  var result = sb.window.screenDocumentosRecebidos();
  var acceptBtn = findAll(result, findAction('aceitar-documento'))[0];
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision(
    LEGACY_DOC_ID, { status: 'accepted' }
  );
  // Re-render to see undo button (hasLocalDecision now true via getEffectiveDocumentStatus)
  result = sb.window.screenDocumentosRecebidos();
  assert.ok(hasActionButton(result, 'desfazer-decisao-documento'), 'manual: undo button visible after local decision');
  var undoBtn = findAll(result, findAction('desfazer-decisao-documento'))[0];
  undoBtn._listeners.click[0]();
  assert.equal(removeCalls, 1, 'manual undo: removeDocumentDecision called');
});

// ---------------------------------------------------------------------
// Unknown source: must show NO decision actions, only informative message
// ---------------------------------------------------------------------

var UNKNOWN_CASES = [
  { name: 'undefined', doc: makeDoc({ _ravatex_source: undefined }) },
  { name: 'null', doc: makeDoc({ _ravatex_source: null }) },
  { name: 'empty string', doc: makeDoc({ _ravatex_source: '' }) },
  { name: 'whitespace', doc: makeDoc({ _ravatex_source: '   ' }) },
  { name: 'bogus value', doc: makeDoc({ _ravatex_source: 'bogus' }) },
  { name: 'G22 fallback (no _ravatex_source key)', doc: makeDoc({}) },
];

UNKNOWN_CASES.forEach(function (tc) {
  test('G28-B5-D5-B1: unknown source "' + tc.name + '" shows no decision actions, only message', function () {
    var sb = makeSandbox([tc.doc]);
    var saveCalls = 0;
    var removeCalls = 0;
    var effectiveCalls = 0;
    sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
    sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; };
    var origGetEffective = sb.window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus;
    sb.window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus = function () {
      effectiveCalls++;
      return origGetEffective.apply(this, arguments);
    };
    sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
      return Promise.resolve({ ok: true });
    };

    var result = sb.window.screenDocumentosRecebidos();

    assert.equal(hasActionButton(result, 'aceitar-documento-nuvem'), false, tc.name + ': NO cloud accept');
    assert.equal(hasActionButton(result, 'rejeitar-documento-nuvem'), false, tc.name + ': NO cloud reject');
    assert.equal(hasActionButton(result, 'aceitar-documento'), false, tc.name + ': NO local accept');
    assert.equal(hasActionButton(result, 'rejeitar-documento'), false, tc.name + ': NO local reject');
    assert.equal(hasActionButton(result, 'desfazer-decisao-documento'), false, tc.name + ': NO local undo');
    assert.equal(hasActionButton(result, 'desfazer-decisao-nuvem'), false, tc.name + ': NO cloud undo');
    assert.ok(hasSourceUnknownMsg(result), tc.name + ': has unknown source message');

    assert.equal(saveCalls, 0, tc.name + ': NO saveDocumentDecision call');
    assert.equal(removeCalls, 0, tc.name + ': NO removeDocumentDecision call');
    assert.equal(effectiveCalls, 0, tc.name + ': NO getEffectiveDocumentStatus call');

    // Status must be imported/original
    var statusPills = findAll(result, function (n) {
      return n._attrs && n._attrs['data-field'] === 'status';
    });
    assert.ok(statusPills.length > 0, tc.name + ': status pill present');
  });
});

// ---------------------------------------------------------------------
// Static checks: source uses decisionSourceKind guards, not !isSupabaseSource
// ---------------------------------------------------------------------

test('G28-B5-D5-B1: static check — no generic !isSupabaseSource authorizing local persistence', function () {
  var screenContent = fs.readFileSync(SCREEN, 'utf8');

  // The only allowed !isSupabaseSource is for compatibility rendering,
  // NOT for authorizing local persistence. Check that the old line 1042
  // pattern (!doc.isSupabaseSource) is replaced with decisionSourceKind.
  var lines = screenContent.split('\n');

  // Find all lines that use isSupabaseSource in a way that authorizes
  // local persistence (saveDocumentDecision, removeDocumentDecision, etc.)
  var unsafePattern = /!\s*doc\s*\.\s*isSupabaseSource/;
  var unsafeLines = [];
  for (var i = 0; i < lines.length; i++) {
    if (unsafePattern.test(lines[i]) && /saveDocumentDecision|removeDocumentDecision|statusOverrides|getEffectiveDocumentStatus/.test(lines[i])) {
      unsafeLines.push((i + 1) + ': ' + lines[i]);
    }
  }
  assert.equal(unsafeLines.length, 0,
    'No line should use !isSupabaseSource to authorize local persistence. Found: ' + JSON.stringify(unsafeLines));

  // Verify decisionSourceKind guard exists (not just isSupabaseSource)
  assert.ok(screenContent.indexOf('decisionSourceKind') >= 0,
    'screen must reference decisionSourceKind');

  // Every ui.statusOverrides use must be guarded by a decisionSourceKind check
  // that prevents execution for unknown source.
  var guardOverridePat = /decisionSourceKind\s*!==\s*['"]unknown['"]/;
  var guardLegacyPat = /doc\.decisionSourceKind\s*===\s*['"]legacy['"]/;
  var soHits = [];
  for (var si = 0; si < lines.length; si++) {
    if (lines[si].indexOf('ui.statusOverrides') >= 0) {
      soHits.push(si);
    }
  }
  soHits.forEach(function (soLine) {
    var inBuildActions = lines[soLine].indexOf('ui.statusOverrides[doc.id]') >= 0;
    var needPat = inBuildActions ? guardLegacyPat : guardOverridePat;
    var found = false;
    for (var sj = soLine - 1; sj >= Math.max(0, soLine - 60); sj--) {
      if (needPat.test(lines[sj])) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'Line ' + (soLine + 1) + ': ui.statusOverrides must be guarded by decisionSourceKind check');
  });
});

test('G28-B5-D5-B1: static check — buildActionButtons uses explicit source kind tri-state', function () {
  var screenContent = fs.readFileSync(SCREEN, 'utf8');

  // Verify the supabase guard is by === 'supabase', not by truthy isSupabaseSource
  var supabaseGuard = /doc\.decisionSourceKind\s*===\s*['"]supabase['"]/;
  assert.ok(supabaseGuard.test(screenContent),
    'buildActionButtons must use decisionSourceKind === "supabase"');

  var legacyGuard = /doc\.decisionSourceKind\s*===\s*['"]legacy['"]/;
  assert.ok(legacyGuard.test(screenContent),
    'buildActionButtons must use decisionSourceKind === "legacy"');
});
