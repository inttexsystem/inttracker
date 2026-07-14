const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const LIFECYCLE_PATH = path.join(ROOT, 'js', 'documents-decision-command.js');
const CTRL_PATH = path.join(ROOT, 'js', 'documents-decision-controller.js');

function createFakeStorage() {
  var store = {};
  return {
    getItem: function (k) { return store.hasOwnProperty(k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    _store: store,
  };
}

function createCryptoRandomUUID() {
  var counter = 0;
  return {
    randomUUID: function () {
      counter++;
      return 'c0000000-0000-4000-8000-00000000' + String(counter).padStart(4, '0');
    },
  };
}

var modulesLoaded = false;

before(function () {
  globalThis.window = globalThis.window || {};
  globalThis.window.RAVATEX_DOCUMENTS = globalThis.window.RAVATEX_DOCUMENTS || {};
  if (!modulesLoaded) {
    require(LIFECYCLE_PATH);
    require(CTRL_PATH);
    modulesLoaded = true;
  }
});

function createLifecycle() {
  return globalThis.window.RAVATEX_DOCUMENTS.documentDecisionCommand;
}

function makeEnv() {
  var storage = createFakeStorage();
  var crypto = createCryptoRandomUUID();
  globalThis.window.sessionStorage = storage;
  globalThis.window.crypto = crypto;
  return { storage: storage, crypto: crypto };
}

function makeAdapter(results) {
  var calls = [];
  var queue = results || [];
  return {
    register: function (envelope) {
      calls.push(envelope);
      var r = queue.shift();
      return r !== undefined ? Promise.resolve(r) : Promise.resolve({ ok: true, outcome: 'created' });
    },
    calls: calls,
  };
}

function makeCtrl(opts) {
  opts = opts || {};
  makeEnv();
  var lifecycle = opts.lifecycle || createLifecycle();
  var adapter = opts.adapter || makeAdapter();
  return {
    ctrl: globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: adapter,
    }),
    adapter: adapter,
    lifecycle: lifecycle,
  };
}

describe('controller factory', function () {
  test('throws without commandLifecycle', function () {
    assert.throws(function () {
      globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({ decisionAdapter: makeAdapter() });
    }, /commandLifecycle/);
  });

  test('throws without decisionAdapter', function () {
    assert.throws(function () {
      globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({ commandLifecycle: createLifecycle() });
    }, /decisionAdapter/);
  });

  test('creates controller with valid arguments', function () {
    var ctrl = makeCtrl().ctrl;
    assert.ok(ctrl);
    assert.equal(typeof ctrl.open, 'function');
    assert.equal(typeof ctrl.getState, 'function');
    assert.equal(typeof ctrl.submit, 'function');
    assert.equal(typeof ctrl.retry, 'function');
    assert.equal(typeof ctrl.cancel, 'function');
    assert.equal(typeof ctrl.restorePending, 'function');
    assert.equal(typeof ctrl.acknowledge, 'function');
  });

  test('module source has no DOM/Supabase/storage/UUID references', function () {
    var src = fs.readFileSync(CTRL_PATH, 'utf8');
    assert.doesNotMatch(src, /document\.\s*(createElement|querySelector|getElementById)/, 'no DOM');
    assert.doesNotMatch(src, /Math\.\s*random/, 'no Math.random');
    assert.doesNotMatch(src, /localStorage/, 'no localStorage');
    assert.doesNotMatch(src, /window\.supa/, 'no supa reference');
    assert.doesNotMatch(src, /supabaseClient/, 'no supabaseClient');
    assert.doesNotMatch(src, /\.rpc\s*\(/, 'no .rpc()');
    assert.doesNotMatch(src, /\bfetch\b/, 'no fetch');
    assert.doesNotMatch(src, /XMLHttpRequest/, 'no XHR');
    assert.doesNotMatch(src, /randomUUID/, 'no UUID generation');
    assert.doesNotMatch(src, /sessionStorage/, 'no sessionStorage');
  });
});

describe('open', function () {
  test('null snapshot returns failed', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.open(null);
    assert.equal(r.ok, false);
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'invalid_snapshot');
  });

  test('missing documentId returns failed', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.open({ activeDecision: null });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'invalid_document_id');
  });

  test('valid documentId with null active enters editing', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.open({ documentId: 'DOC-1', activeDecision: null });
    assert.equal(r.ok, true);
    assert.equal(r.state, 'editing');
    var st = ctrl.getState();
    assert.equal(st.documentId, 'DOC-1');
    assert.equal(st.expectedActiveDecisionId, null);
  });

  test('captures activeDecision.id as expectedActiveDecisionId', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.open({ documentId: 'DOC-2', activeDecision: { id: 'dec-abc-123', command_id: 'cmd-xyz' } });
    assert.equal(r.ok, true);
    assert.equal(r.state, 'editing');
    var st = ctrl.getState();
    assert.equal(st.expectedActiveDecisionId, 'dec-abc-123');
  });

  test('never depends on status/timestamp from snapshot', function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-3', activeDecision: null, status: 'accepted', decididoEm: '2024-01-01' });
    var st = ctrl.getState();
    assert.equal(st.documentId, 'DOC-3');
    assert.equal(st.expectedActiveDecisionId, null);
  });
});

describe('submit basic flow', function () {
  test('accepted calls prepare and adapter once, resolves', async function () {
    var { ctrl, adapter } = makeCtrl();
    ctrl.open({ documentId: 'DOC-A', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, true);
    assert.equal(r.state, 'succeeded');
    assert.equal(r.messageKey, 'decision_created');
    assert.equal(r.closeModal, true);
    assert.equal(adapter.calls.length, 1);
  });

  test('rejected with motivo succeeds', async function () {
    var { ctrl, adapter } = makeCtrl();
    ctrl.open({ documentId: 'DOC-B', activeDecision: null });
    var r = await ctrl.submit({ decision: 'rejected', motivo: 'Documento invalido' });
    assert.equal(r.ok, true);
    assert.equal(r.state, 'succeeded');
    assert.equal(adapter.calls.length, 1);
  });

  test('submit while not editing returns invalid_state', async function () {
    var { ctrl } = makeCtrl();
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'idle');
  });

  test('duplicate submit blocked while submitting', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-C', activeDecision: null });
    var p1 = ctrl.submit({ decision: 'accepted' });
    var p2 = ctrl.submit({ decision: 'accepted' });
    var r1 = await p1;
    var r2 = await p2;
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, false);
    assert.equal(r2.messageKey, 'invalid_state');
  });
});

describe('submit validation', function () {
  test('null draft returns invalid_input', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    var r = await ctrl.submit(null);
    assert.equal(r.ok, false);
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'invalid_input');
  });

  test('invalid decision returns invalid_decision', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    var r = await ctrl.submit({ decision: 'maybe' });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'invalid_decision');
  });

  test('rejected without motivo returns motivo_required', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    var r = await ctrl.submit({ decision: 'rejected', motivo: '' });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'motivo_required');
  });
});

describe('outcome mapping', function () {
  test('created maps to succeeded', async function () {
    var adp = makeAdapter([{ ok: true, outcome: 'created' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'succeeded');
    assert.equal(r.messageKey, 'decision_created');
    assert.equal(r.closeModal, true);
    assert.equal(r.refreshRequired, false);
  });

  test('replayed maps to succeeded with refresh', async function () {
    var adp = makeAdapter([{ ok: true, outcome: 'replayed' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'succeeded');
    assert.equal(r.messageKey, 'decision_replayed');
    assert.equal(r.refreshRequired, true);
  });

  test('active_decision_exists with ok:true maps to succeeded', async function () {
    var adp = makeAdapter([{ ok: true, outcome: 'active_decision_exists' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'succeeded');
    assert.equal(r.messageKey, 'decision_exists');
    assert.equal(r.refreshRequired, true);
  });

  test('active_decision_exists with ok:false maps to stale', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'active_decision_exists', error: 'active_decision_exists' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'stale');
    assert.equal(r.refreshRequired, true);
  });

  test('stale_active_decision maps to stale', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'stale_active_decision', error: 'stale_active_decision' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'stale');
    assert.equal(r.refreshRequired, true);
  });

  test('candidate_not_found maps to stale', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'candidate_not_found', error: 'candidate_not_found' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'stale');
    assert.equal(r.refreshRequired, true);
  });

  test('command_conflict maps to conflict', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'command_conflict', error: 'command_conflict' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'conflict');
    assert.equal(r.refreshRequired, true);
  });

  test('network error maps to uncertain with retry', async function () {
    var adp = makeAdapter([{ ok: false, error: 'network' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'uncertain');
    assert.equal(r.retryAllowed, true);
  });

  test('supabase_unavailable maps to uncertain with retry', async function () {
    var adp = makeAdapter([{ ok: false, error: 'supabase_unavailable' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'uncertain');
    assert.equal(r.retryAllowed, true);
  });

  test('input_error maps to failed', async function () {
    var adp = makeAdapter([{ ok: false, error: 'input_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'failed');
    assert.equal(r.retryAllowed, false);
  });

  test('auth_error maps to failed', async function () {
    var adp = makeAdapter([{ ok: false, error: 'auth_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'failed');
  });

  test('admin_required maps to failed', async function () {
    var adp = makeAdapter([{ ok: false, error: 'admin_required' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'failed');
  });

  test('unknown error maps to failed', async function () {
    var adp = makeAdapter([{ ok: false, error: 'supabase_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.state, 'failed');
    assert.equal(r.messageKey, 'unknown_error');
  });
});

describe('retry', function () {
  test('retry in uncertain resends same commandId', async function () {
    var adp = makeAdapter([
      { ok: false, error: 'network' },
      { ok: true, outcome: 'created' },
    ]);
    var { ctrl, adapter } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r1 = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r1.state, 'uncertain');
    var cmdId = r1.commandId;
    var r2 = await ctrl.retry();
    assert.equal(r2.state, 'succeeded');
    assert.equal(r2.commandId, cmdId);
    assert.equal(adapter.calls.length, 2);
  });

  test('retry in non-uncertain returns invalid_state', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.retry();
    assert.equal(r.ok, false);
    assert.equal(r.messageKey, 'retry_invalid_state');
  });

  test('retry maps outcomes same as submit', async function () {
    var adp = makeAdapter([
      { ok: false, error: 'network' },
      { ok: false, outcome: 'command_conflict', error: 'command_conflict' },
    ]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    var r = await ctrl.retry();
    assert.equal(r.state, 'conflict');
  });
});

describe('exception transport branches', function () {
  test('submit: synchronous adapter.register throw returns uncertain with ok:false', async function () {
    var throwingAdapter = {
      register: function () { throw new Error('connection failed'); },
    };
    var { ctrl } = makeCtrl({ adapter: throwingAdapter });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.messageKey, 'network_error');
    assert.equal(r.retryAllowed, true);
    assert.ok(r.commandId);
  });

  test('submit: rejected adapter promise returns uncertain with ok:false', async function () {
    var rejectingAdapter = {
      register: function () { return Promise.reject(new Error('timeout')); },
    };
    var { ctrl } = makeCtrl({ adapter: rejectingAdapter });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.messageKey, 'network_error');
    assert.equal(r.retryAllowed, true);
    assert.ok(r.commandId);
  });

  test('retry: synchronous adapter.register throw returns uncertain with ok:false and same commandId', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var calls = 0;
    var throwingAdapter = {
      register: function (envelope) {
        calls++;
        if (calls === 1) return Promise.resolve({ ok: false, error: 'network' });
        throw new Error('connection failed');
      },
    };
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: throwingAdapter,
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var submitR = await ctrl.submit({ decision: 'accepted' });
    assert.equal(submitR.state, 'uncertain');
    var cmdId = submitR.commandId;
    var r = await ctrl.retry();
    assert.equal(r.ok, false);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.messageKey, 'network_error');
    assert.equal(r.retryAllowed, true);
    assert.equal(r.commandId, cmdId);
  });

  test('retry: rejected adapter promise returns uncertain with ok:false and same commandId', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var calls = 0;
    var rejectingAdapter = {
      register: function (envelope) {
        calls++;
        if (calls === 1) return Promise.resolve({ ok: false, error: 'network' });
        return Promise.reject(new Error('timeout'));
      },
    };
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: rejectingAdapter,
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var submitR = await ctrl.submit({ decision: 'accepted' });
    assert.equal(submitR.state, 'uncertain');
    var cmdId = submitR.commandId;
    var r = await ctrl.retry();
    assert.equal(r.ok, false);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.messageKey, 'network_error');
    assert.equal(r.retryAllowed, true);
    assert.equal(r.commandId, cmdId);
  });
});

describe('cancel', function () {
  test('cancel from editing without prepared pending closes', function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = ctrl.cancel();
    assert.equal(r.closeModal, true);
    assert.equal(r.state, 'idle');
  });

  test('cancel from submitting returns error', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var p1 = ctrl.submit({ decision: 'accepted' });
    var r = ctrl.cancel();
    assert.equal(r.ok, false);
    assert.equal(r.error, 'cannot_cancel');
    assert.equal(r.state, 'submitting');
    await p1;
  });

  test('cancel from uncertain returns error with retry allowed', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var adp = makeAdapter([{ ok: false, error: 'network' }]);
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: adp,
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var submitR = await ctrl.submit({ decision: 'accepted' });
    assert.equal(submitR.state, 'uncertain');
    var cmdId = submitR.commandId;

    var discardCalled = false;
    var origDiscard = lifecycle.discardBeforeSend;
    lifecycle.discardBeforeSend = function () { discardCalled = true; return origDiscard(); };

    var r = ctrl.cancel();
    assert.equal(discardCalled, false);
    assert.equal(r.ok, false);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.messageKey, 'cannot_cancel');
    assert.equal(r.retryAllowed, true);
    assert.equal(r.commandId, cmdId);

    var pendingR = lifecycle.getPendingCommand();
    assert.equal(pendingR.ok, true);

    lifecycle.discardBeforeSend = origDiscard;
  });

  test('cancel from idle returns close', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.cancel();
    assert.equal(r.closeModal, true);
    assert.equal(r.state, 'idle');
  });

  test('cancel from editing with prepared pending calls discardBeforeSend', function () {
    makeEnv();
    var lifecycle = createLifecycle();
    lifecycle.prepareCommand({ documentId: 'DOC', decision: 'accepted' });
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: makeAdapter(),
    });
    var restoreR = ctrl.restorePending(null);
    assert.equal(restoreR.state, 'editing');
    var discardCalled = false;
    var origDiscard = lifecycle.discardBeforeSend;
    lifecycle.discardBeforeSend = function (id) { discardCalled = true; return origDiscard(id); };
    var r = ctrl.cancel();
    assert.equal(discardCalled, true);
    assert.equal(r.closeModal, true);
    lifecycle.discardBeforeSend = origDiscard;
  });

  test('cancel from editing with prepared pending clears command', function () {
    makeEnv();
    var lifecycle = createLifecycle();
    lifecycle.prepareCommand({ documentId: 'DOC', decision: 'accepted' });
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: makeAdapter(),
    });
    ctrl.restorePending(null);
    ctrl.cancel();
    var getR = lifecycle.getPendingCommand();
    assert.equal(getR.ok, false);
  });
});

describe('restorePending', function () {
  test('no pending returns idle', function () {
    var { ctrl } = makeCtrl();
    var r = ctrl.restorePending(null);
    assert.equal(r.state, 'idle');
  });

  test('confirmed returns succeeded with closeModal', function () {
    var { ctrl, lifecycle } = makeCtrl();
    makeEnv();
    var prep = lifecycle.prepareCommand(
      { documentId: 'DOC', decision: 'accepted' }
    );
    var active = { id: 'dec-1', command_id: prep.commandId };
    var r = ctrl.restorePending(active);
    assert.equal(r.state, 'succeeded');
    assert.equal(r.closeModal, true);
    assert.equal(r.messageKey, 'confirmed');
  });

  test('stale returns stale with refresh', function () {
    var { ctrl, lifecycle } = makeCtrl();
    makeEnv();
    lifecycle.prepareCommand({ documentId: 'DOC', decision: 'accepted' });
    var active = { id: 'dec-2', command_id: 'other-uuid' };
    var r = ctrl.restorePending(active);
    assert.equal(r.state, 'stale');
    assert.equal(r.refreshRequired, true);
  });

  test('retry_available returns uncertain with retry', function () {
    var { ctrl, lifecycle } = makeCtrl();
    makeEnv();
    var prep = lifecycle.prepareCommand({ documentId: 'DOC', decision: 'accepted' });
    lifecycle.markSubmitting(prep.commandId);
    lifecycle.markUncertain(prep.commandId);
    var r = ctrl.restorePending(null);
    assert.equal(r.state, 'uncertain');
    assert.equal(r.retryAllowed, true);
  });

  test('prepared returns editing', function () {
    var { ctrl, lifecycle } = makeCtrl();
    makeEnv();
    lifecycle.prepareCommand({ documentId: 'DOC', decision: 'accepted' });
    var r = ctrl.restorePending(null);
    assert.equal(r.state, 'editing');
  });
});

describe('acknowledge', function () {
  test('acknowledge returns idle with closeModal', function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = ctrl.acknowledge();
    assert.equal(r.state, 'idle');
    assert.equal(r.closeModal, true);
  });
});

describe('defensive snapshots', function () {
  test('getState returns defensive copy', function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-S', activeDecision: null });
    var st = ctrl.getState();
    st.documentId = 'MUTATED';
    var st2 = ctrl.getState();
    assert.equal(st2.documentId, 'DOC-S');
  });
});

describe('submit prepareCommand called exactly once', function () {
  test('prepareCommand called once, adapter called once', async function () {
    var prepareCalls = [];
    var markSubmitCalls = [];
    var origLifecycle = createLifecycle();
    var lifecycle = {
      prepareCommand: function (i) {
        prepareCalls.push(i);
        return origLifecycle.prepareCommand(i);
      },
      getPendingCommand: function () { return origLifecycle.getPendingCommand(); },
      markSubmitting: function (id) {
        markSubmitCalls.push(id);
        return origLifecycle.markSubmitting(id);
      },
      markUncertain: function (id) { return origLifecycle.markUncertain(id); },
      markStale: function (id) { return origLifecycle.markStale(id); },
      resolveCommand: function (id) { return origLifecycle.resolveCommand(id); },
      discardBeforeSend: function (id) { return origLifecycle.discardBeforeSend(id); },
      reconcilePendingCommand: function (ad) { return origLifecycle.reconcilePendingCommand(ad); },
    };
    var adp = makeAdapter([{ ok: true, outcome: 'created' }]);
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: adp,
    });
    makeEnv();
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    assert.equal(prepareCalls.length, 1);
    assert.equal(adp.calls.length, 1);
  });
});

describe('expectedActiveDecisionId propagation', function () {
  test('null active passes null expectedActiveDecisionId', async function () {
    var origLifecycle = createLifecycle();
    var capturedInput = null;
    var lifecycle = Object.assign({}, origLifecycle, {
      prepareCommand: function (input) {
        capturedInput = input;
        return origLifecycle.prepareCommand(input);
      },
    });
    var { ctrl } = makeCtrl({ lifecycle: lifecycle });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    assert.equal(capturedInput.expectedActiveDecisionId, null);
  });

  test('active id passes as expectedActiveDecisionId', async function () {
    var origLifecycle = createLifecycle();
    var capturedInput = null;
    var lifecycle = Object.assign({}, origLifecycle, {
      prepareCommand: function (input) {
        capturedInput = input;
        return origLifecycle.prepareCommand(input);
      },
    });
    var { ctrl } = makeCtrl({ lifecycle: lifecycle });
    ctrl.open({ documentId: 'DOC', activeDecision: { id: 'dec-active-1', command_id: 'cmd-1' } });
    await ctrl.submit({ decision: 'accepted' });
    assert.equal(capturedInput.expectedActiveDecisionId, 'dec-active-1');
  });
});

describe('open internal state consistency', function () {
  test('null snapshot sets internal state to failed', function () {
    var { ctrl } = makeCtrl();
    ctrl.open(null);
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
  });

  test('missing documentId sets internal state to failed', function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ activeDecision: null });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
  });
});

describe('submit internal state consistency', function () {
  test('null draft sets internal state to failed', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    await ctrl.submit(null);
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
  });

  test('invalid decision sets internal state to failed', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    await ctrl.submit({ decision: 'maybe' });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
  });

  test('rejected without motivo sets internal state to failed', async function () {
    var { ctrl } = makeCtrl();
    ctrl.open({ documentId: 'DOC-X', activeDecision: null });
    await ctrl.submit({ decision: 'rejected', motivo: '' });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
  });

  test('lifecycle prepare error sets internal state to failed', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var origPrepare = lifecycle.prepareCommand;
    lifecycle.prepareCommand = function () { return { ok: false, error: 'prep_error' }; };
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: makeAdapter(),
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
    lifecycle.prepareCommand = origPrepare;
  });

  test('lifecycle mark error sets internal state to failed', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var origMark = lifecycle.markSubmitting;
    lifecycle.markSubmitting = function () { return { ok: false, error: 'mark_error' }; };
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: makeAdapter(),
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
    lifecycle.markSubmitting = origMark;
  });
});

describe('outcome ok contract', function () {
  test('stale outcome has ok false', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'stale_active_decision', error: 'stale_active_decision' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
  });

  test('conflict outcome has ok false', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'command_conflict', error: 'command_conflict' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
  });

  test('uncertain outcome has ok false', async function () {
    var adp = makeAdapter([{ ok: false, error: 'network' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
  });

  test('terminal error outcome has ok false', async function () {
    var adp = makeAdapter([{ ok: false, error: 'input_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
  });

  test('unknown error outcome has ok false', async function () {
    var adp = makeAdapter([{ ok: false, error: 'supabase_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.equal(r.ok, false);
  });
});

describe('outcome commandId contract', function () {
  test('conflict outcome includes commandId', async function () {
    var adp = makeAdapter([{ ok: false, outcome: 'command_conflict', error: 'command_conflict' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.ok(r.commandId);
  });

  test('terminal error outcome includes commandId', async function () {
    var adp = makeAdapter([{ ok: false, outcome: null, error: 'input_error' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.ok(r.commandId);
  });

  test('uncertain transport error outcome includes commandId', async function () {
    var adp = makeAdapter([{ ok: false, error: 'network' }]);
    var { ctrl } = makeCtrl({ adapter: adp });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    var r = await ctrl.submit({ decision: 'accepted' });
    assert.ok(r.commandId);
  });
});

describe('cancel from failed state', function () {
  test('cancel from failed with commandId discards and closes', async function () {
    makeEnv();
    var lifecycle = createLifecycle();
    var origPrepare = lifecycle.prepareCommand;
    var origMark = lifecycle.markSubmitting;
    var origDiscard = lifecycle.discardBeforeSend;
    lifecycle.markSubmitting = function () { return { ok: false, error: 'mark_error' }; };
    var discardCalled = false;
    lifecycle.discardBeforeSend = function (id) { discardCalled = true; return origDiscard(id); };
    var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentDecisionController({
      commandLifecycle: lifecycle,
      decisionAdapter: makeAdapter(),
    });
    ctrl.open({ documentId: 'DOC', activeDecision: null });
    await ctrl.submit({ decision: 'accepted' });
    var st = ctrl.getState();
    assert.equal(st.state, 'failed');
    assert.ok(st.commandId);
    var r = ctrl.cancel();
    assert.equal(discardCalled, true);
    assert.equal(r.closeModal, true);
    lifecycle.prepareCommand = origPrepare;
    lifecycle.markSubmitting = origMark;
    lifecycle.discardBeforeSend = origDiscard;
  });
});
