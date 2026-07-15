'use strict';

// =====================================================================
// === tests/document-link-admin-controller.test.js ====================
// Pure unit of the G28-B8 link admin controller (correction / revocation
// / restoration orchestration, idempotency, optimistic concurrency,
// outcome -> UI mapping). No DOM, no Supabase.
// =====================================================================

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CTRL_PATH = path.join(ROOT, 'js', 'document-link-admin-controller.js');

const DOC = 'doc-b8';
const REV = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const SRC = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const PED = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

before(function () {
  globalThis.window = globalThis.window || {};
  globalThis.window.RAVATEX_DOCUMENTS = globalThis.window.RAVATEX_DOCUMENTS || {};
  require(CTRL_PATH);
});

function makeController(results) {
  var calls = { register: [], restore: [] };
  var queue = results ? results.slice() : [];
  var idCounter = 0;
  var adapter = {
    register: function (env) { calls.register.push(JSON.parse(JSON.stringify(env))); return Promise.resolve(queue.shift()); },
    restore: function (env) { calls.restore.push(JSON.parse(JSON.stringify(env))); return Promise.resolve(queue.shift()); },
  };
  var newCommandId = function () { idCounter++; return 'cmd-1111-4111-8111-' + String(idCounter).padStart(12, '0'); };
  var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentLinkAdminController({
    linksAdapter: adapter, newCommandId: newCommandId,
  });
  return { ctrl: ctrl, calls: calls };
}

test('factory requires adapter + newCommandId', function () {
  assert.throws(function () {
    globalThis.window.RAVATEX_DOCUMENTS.createDocumentLinkAdminController({});
  });
});

test('open sets EDITING and captures the expected active revision', function () {
  const { ctrl } = makeController();
  const r = ctrl.open({ documentId: DOC, activeRevisionId: REV });
  assert.equal(r.state, 'editing');
  assert.equal(ctrl.getState().expectedActiveRevisionId, REV);
  assert.equal(ctrl.getState().documentId, DOC);
});

test('open rejects an invalid snapshot', function () {
  const { ctrl } = makeController();
  assert.equal(ctrl.open(null).state, 'failed');
  assert.equal(ctrl.open({ documentId: '   ' }).state, 'failed');
});

test('correction: new revision -> SUCCEEDED (updated) with expected + command + reason', async function () {
  const { ctrl, calls } = makeController([{ ok: true, outcome: 'updated', revision_id: 'new' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'correct', pedidoId: PED, opIds: [7, 3], reason: 'pedido errado' });
  assert.equal(r.state, 'succeeded');
  assert.equal(r.outcome, 'updated');
  assert.equal(r.closeModal, true);
  assert.equal(r.refreshRequired, true);
  assert.equal(calls.register.length, 1);
  assert.equal(calls.register[0].pedidoId, PED);
  assert.deepEqual(calls.register[0].opIds, [3, 7]); // normalized ascending
  assert.equal(calls.register[0].reason, 'pedido errado');
  assert.equal(calls.register[0].expectedActiveRevisionId, REV);
  assert.ok(calls.register[0].commandId);
});

test('correction with identical state -> no_change is still SUCCEEDED', async function () {
  const { ctrl } = makeController([{ ok: true, outcome: 'no_change' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'correct', pedidoId: PED, opIds: [], reason: 'sem mudanca' });
  assert.equal(r.state, 'succeeded');
  assert.equal(r.outcome, 'no_change');
});

test('reason is required for every mutation', async function () {
  const { ctrl, calls } = makeController([]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'correct', pedidoId: PED, opIds: [], reason: '   ' });
  assert.equal(r.state, 'failed');
  assert.equal(r.messageKey, 'reason_required');
  assert.equal(calls.register.length, 0, 'no write attempted without a reason');
});

test('explicit unlink sends the empty state (no pedido, no ops)', async function () {
  const { ctrl, calls } = makeController([{ ok: true, outcome: 'updated' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'unlink', reason: 'documento nao pertence' });
  assert.equal(r.state, 'succeeded');
  assert.equal(calls.register[0].pedidoId, null);
  assert.deepEqual(calls.register[0].opIds, []);
  assert.equal(calls.register[0].reason, 'documento nao pertence');
  assert.equal(calls.register[0].expectedActiveRevisionId, REV);
});

test('stale expected active revision -> STALE (refresh required)', async function () {
  const { ctrl } = makeController([{ ok: false, outcome: 'stale_active_revision', error: 'stale_active_revision' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'correct', pedidoId: null, opIds: [], reason: 'x' });
  assert.equal(r.state, 'stale');
  assert.equal(r.refreshRequired, true);
});

test('divergent command reuse -> CONFLICT', async function () {
  const { ctrl } = makeController([{ ok: false, outcome: 'command_conflict', error: 'command_conflict' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'correct', pedidoId: null, opIds: [], reason: 'x' });
  assert.equal(r.state, 'conflict');
  assert.equal(r.messageKey, 'command_conflict');
});

test('transport failure -> UNCERTAIN; retry reuses the SAME command id (idempotent replay)', async function () {
  const { ctrl, calls } = makeController([
    { ok: false, error: 'network' },
    { ok: true, outcome: 'replayed' },
  ]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r1 = await ctrl.submit({ kind: 'correct', pedidoId: PED, opIds: [3], reason: 'motivo' });
  assert.equal(r1.state, 'uncertain');
  assert.equal(r1.retryAllowed, true);
  const firstCmd = calls.register[0].commandId;

  const r2 = await ctrl.retry();
  assert.equal(r2.state, 'succeeded');
  assert.equal(r2.outcome, 'replayed');
  assert.equal(calls.register.length, 2);
  assert.equal(calls.register[1].commandId, firstCmd, 'retry reuses the same command id');
  assert.deepEqual(calls.register[1].opIds, [3], 'retry resends the same payload');
});

test('restoration: new revision from a historical source -> SUCCEEDED', async function () {
  const { ctrl, calls } = makeController([{ ok: true, outcome: 'updated', restored_from_revision_id: SRC }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'restore', sourceRevisionId: SRC, reason: 'restaurar v2' });
  assert.equal(r.state, 'succeeded');
  assert.equal(calls.restore.length, 1);
  assert.equal(calls.restore[0].sourceRevisionId, SRC);
  assert.equal(calls.restore[0].reason, 'restaurar v2');
  assert.equal(calls.restore[0].expectedActiveRevisionId, REV);
  assert.ok(calls.restore[0].commandId);
});

test('restoration requires a source revision id', async function () {
  const { ctrl } = makeController([]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'restore', reason: 'x' });
  assert.equal(r.state, 'failed');
  assert.equal(r.messageKey, 'source_revision_id_required');
});

test('restoration rejects an invalid/incompatible target -> FAILED', async function () {
  const { ctrl } = makeController([{ ok: false, outcome: 'op_pedido_mismatch', error: 'op_pedido_mismatch' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'restore', sourceRevisionId: SRC, reason: 'x' });
  assert.equal(r.state, 'failed');
  assert.equal(r.messageKey, 'op_pedido_mismatch');
});

test('restoration rejects a missing source -> FAILED (restore_source_not_found)', async function () {
  const { ctrl } = makeController([{ ok: false, outcome: 'restore_source_not_found', error: 'restore_source_not_found' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'restore', sourceRevisionId: SRC, reason: 'x' });
  assert.equal(r.state, 'failed');
  assert.equal(r.messageKey, 'restore_source_not_found');
});

test('restoration stale active expectation -> STALE', async function () {
  const { ctrl } = makeController([{ ok: false, outcome: 'stale_active_revision', error: 'stale_active_revision' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'restore', sourceRevisionId: SRC, reason: 'x' });
  assert.equal(r.state, 'stale');
});

test('admin_required maps to a terminal FAILED', async function () {
  const { ctrl } = makeController([{ ok: false, error: 'admin_required' }]);
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'unlink', reason: 'x' });
  assert.equal(r.state, 'failed');
  assert.equal(r.messageKey, 'admin_required');
});

test('command id unavailable (no crypto) -> FAILED, no write attempted', async function () {
  var calls = [];
  var ctrl = globalThis.window.RAVATEX_DOCUMENTS.createDocumentLinkAdminController({
    linksAdapter: { register: function (e) { calls.push(e); return Promise.resolve({ ok: true }); }, restore: function () {} },
    newCommandId: function () { return null; },
  });
  ctrl.open({ documentId: DOC, activeRevisionId: REV });
  const r = await ctrl.submit({ kind: 'unlink', reason: 'x' });
  assert.equal(r.state, 'failed');
  assert.equal(calls.length, 0);
});

test('submit is rejected outside EDITING', async function () {
  const { ctrl } = makeController([{ ok: true, outcome: 'updated' }]);
  const r = await ctrl.submit({ kind: 'unlink', reason: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.messageKey, 'invalid_state');
});
