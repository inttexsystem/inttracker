'use strict';

// =====================================================================
// === tests/document-link-audit-read-model.test.js ====================
// Pure unit of the G28-B8 audit read model. No DOM, no network.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../js/document-link-audit-read-model.js');

const { AUDIT_STATE, AUDIT_KIND } = audit.constants;

const DOC = 'doc-audit';
const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const R3 = '33333333-3333-4333-8333-333333333333';
const PED = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

function rev(over) {
  return Object.assign({
    revision_id: R1, document_id: DOC, pedido_id: null, version: 1, active: false,
    command_id: 'cmd', created_by: 'user-1', created_at: '2026-07-14T01:00:00Z',
    revoked_by: null, revoked_at: null, revocation_reason: null,
    restored_from_revision_id: null, op_ids: [],
  }, over || {});
}

test('exposes buildAuditTrail and constants', function () {
  assert.equal(typeof audit.buildAuditTrail, 'function');
  assert.equal(typeof audit.activeRevisionOf, 'function');
  assert.equal(AUDIT_STATE.AVAILABLE, 'available');
});

test('loading state via options.loading', function () {
  const r = audit.buildAuditTrail(null, { loading: true });
  assert.equal(r.state, AUDIT_STATE.LOADING);
  assert.deepEqual(r.entries, []);
});

test('unavailable (fail-closed) for null / ok:false / non-array', function () {
  assert.equal(audit.buildAuditTrail(null).state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildAuditTrail({ ok: false, error: 'boom' }).state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildAuditTrail({ ok: true, revisions: 'nope' }).state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildAuditTrail(undefined).state, AUDIT_STATE.UNAVAILABLE);
});

test('empty state when history has zero revisions', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [] });
  assert.equal(r.state, AUDIT_STATE.EMPTY);
  assert.equal(r.active_count, 0);
  assert.equal(r.active_revision_id, null);
});

test('ordering: newest-first by version desc (deterministic)', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R1, version: 1, active: false }),
    rev({ revision_id: R3, version: 3, active: true }),
    rev({ revision_id: R2, version: 2, active: false }),
  ] });
  assert.equal(r.state, AUDIT_STATE.AVAILABLE);
  assert.deepEqual(r.entries.map(function (e) { return e.version; }), [3, 2, 1]);
});

test('active revision uniqueness: single active -> integrity ok', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R2, version: 2, active: true }),
    rev({ revision_id: R1, version: 1, active: false, revoked_at: '2026-07-14T02:00:00Z' }),
  ] });
  assert.equal(r.active_count, 1);
  assert.equal(r.active_revision_id, R2);
  assert.equal(r.integrity, 'ok');
});

test('active revision uniqueness: more than one active -> multiple_active anomaly', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R2, version: 2, active: true }),
    rev({ revision_id: R1, version: 1, active: true }),
  ] });
  assert.equal(r.active_count, 2);
  assert.equal(r.integrity, 'multiple_active');
});

test('reason / actor / timestamp preservation', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({
      revision_id: R2, version: 2, active: true, created_by: 'admin-x', created_at: '2026-07-14T05:00:00Z',
      pedido_id: PED, op_ids: [7, 3],
    }),
    rev({
      revision_id: R1, version: 1, active: false, created_by: 'admin-y', created_at: '2026-07-14T01:00:00Z',
      revoked_by: 'admin-x', revoked_at: '2026-07-14T05:00:00Z', revocation_reason: 'pedido errado',
    }),
  ] });
  const active = r.entries[0];
  assert.equal(active.actor, 'admin-x');
  assert.equal(active.created_at, '2026-07-14T05:00:00Z');
  assert.deepEqual(active.op_ids, [3, 7]); // normalized ascending
  const revoked = r.entries[1];
  assert.equal(revoked.reason, 'pedido errado');
  assert.equal(revoked.revoked_by, 'admin-x');
  assert.equal(revoked.revoked_at, '2026-07-14T05:00:00Z');
  assert.equal(revoked.revoked, true);
});

test('kind: linked / unlinked / restored', function () {
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R3, version: 3, active: true, restored_from_revision_id: R1, pedido_id: PED }),
    rev({ revision_id: R2, version: 2, active: false, pedido_id: null, op_ids: [] }),
    rev({ revision_id: R1, version: 1, active: false, pedido_id: PED, op_ids: [5] }),
  ] });
  const byVersion = {};
  r.entries.forEach(function (e) { byVersion[e.version] = e; });
  assert.equal(byVersion[3].kind, AUDIT_KIND.RESTORED);
  assert.equal(byVersion[3].restored_from_revision_id, R1);
  assert.equal(byVersion[2].kind, AUDIT_KIND.UNLINKED);
  assert.equal(byVersion[1].kind, AUDIT_KIND.LINKED);
});

test('activeRevisionOf returns the single active entry or null', function () {
  const trail = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R2, version: 2, active: true, pedido_id: PED }),
    rev({ revision_id: R1, version: 1, active: false }),
  ] });
  const active = audit.activeRevisionOf(trail);
  assert.equal(active.revision_id, R2);
  assert.equal(audit.activeRevisionOf(audit.buildAuditTrail(null)), null);
  assert.equal(audit.activeRevisionOf(audit.buildAuditTrail({ ok: true, revisions: [rev({ active: false })] })), null);
});

test('does not read pedido_manual / candidate.pedido_id as a link', function () {
  // The read model consumes only the revision fields; any extraneous suggestion
  // fields on the input are ignored (never projected as a confirmed link).
  const r = audit.buildAuditTrail({ ok: true, revisions: [
    rev({ revision_id: R1, version: 1, active: true, pedido_id: null, op_ids: [], pedido_manual: 'PED-999', candidate_pedido_id: 'x' }),
  ] });
  const e = r.entries[0];
  assert.equal(e.pedido_id, null);
  assert.equal(e.kind, AUDIT_KIND.UNLINKED);
  assert.equal(Object.prototype.hasOwnProperty.call(e, 'pedido_manual'), false);
});
