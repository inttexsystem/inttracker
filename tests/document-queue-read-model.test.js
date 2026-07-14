'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var readModel = require('../js/document-queue-read-model.js');
var createItem = readModel.createDocumentQueueItem;
var getAuthorizedFilters = readModel.getAuthorizedFilters;
var C = readModel.constants;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function makeRecord(overrides) {
  var rec = {
    document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18',
    filename_original: 'NF-99.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-99',
    drive_web_view_link: 'https://drive.example/99',
    status: 'pending',
    pedido_manual: 'PED-99-2026',
    pedido_id: null,
    _ravatex_technical_evidence: null,
    _ravatex_server_decision: null,
  };
  if (!overrides) return rec;
  for (var k in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) rec[k] = overrides[k];
  }
  return rec;
}

function ctx(collectionSource, remoteAvailability) {
  return { collectionSource: collectionSource, remoteAvailability: remoteAvailability };
}

var baseCtx = ctx('supabase', 'available');

function findAlert(item, code) {
  for (var i = 0; i < item.alerts.length; i++) {
    if (item.alerts[i].code === code) return item.alerts[i];
  }
  return undefined;
}

function assertAlert(t, item, code, severity) {
  var a = findAlert(item, code);
  assert.ok(a, t + ': alert ' + code + ' should exist');
  assert.equal(a.severity, severity, t + ': severity mismatch');
  assert.equal(Object.keys(a).length, 2, t + ': alert must be payload-free');
}

function assertNoAlert(t, item, code) {
  assert.equal(findAlert(item, code), undefined, t + ': alert ' + code + ' should not exist');
}

function runTable(name, rows, fn) {
  test(name, function () {
    for (var i = 0; i < rows.length; i++) {
      fn(rows[i]);
    }
  });
}

// ============================================================================
// 1. API contract and output shape
// ============================================================================

test('module exports contract', function () {
  assert.equal(typeof createItem, 'function');
  assert.equal(typeof getAuthorizedFilters, 'function');
  assert.ok(C.EVIDENCE_STATE && C.REVIEW_STATE && C.SOURCE_CAPABILITY && C.PEDIDO_STATE);
  assert.ok(C.VALIDATION_INDICATION && C.ALERT_CODE && C.ALERT_SEVERITY);
});

test('output shape contains all required axes', function () {
  var item = createItem(makeRecord(), baseCtx);
  var axes = ['identity', 'source', 'source_file', 'review', 'technical_evidence', 'pedido', 'op', 'duplicate', 'alerts', 'validation', 'display', 'filter_values'];
  for (var i = 0; i < axes.length; i++) {
    assert.ok(Object.prototype.hasOwnProperty.call(item, axes[i]), axes[i]);
  }
});

test('returns null for null/undefined/non-object documentRecord', function () {
  assert.equal(createItem(null, baseCtx), null);
  assert.equal(createItem(undefined, baseCtx), null);
  assert.equal(createItem('string', baseCtx), null);
  assert.equal(createItem(42, baseCtx), null);
  assert.notEqual(createItem(makeRecord(), null), null);
  assert.notEqual(createItem(makeRecord(), undefined), null);
});

// ============================================================================
// 2. Source axis normalization
// ============================================================================

runTable('source: normalizes collection source', [
  ['supabase', 'supabase'],
  ['legacy_fallback', 'legacy_fallback'],
  ['legacy', 'legacy'],
  ['bogus', 'unknown'],
  [undefined, 'unknown'],
], function (row) {
  var item = createItem(makeRecord(), ctx(row[0], 'available'));
  assert.deepStrictEqual(item.source, { collection_source: row[1] });
});

// ============================================================================
// 3. Identity / display metadata
// ============================================================================

test('identity: exposes display metadata fields', function () {
  var item = createItem(makeRecord(), baseCtx);
  assert.equal(item.identity.document_id, '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18');
  assert.equal(item.identity.filename_original, 'NF-99.xml');
  assert.equal(item.identity.tipo_documento, 'nf');
  assert.equal(item.identity.formato, 'xml');
  assert.equal(item.identity.direcao_nf, 'entrada');
});

test('identity: handles missing fields gracefully', function () {
  var item = createItem({ document_id: 'doc-1' }, baseCtx);
  assert.equal(item.identity.document_id, 'doc-1');
  assert.equal(item.identity.filename_original, '');
  assert.equal(item.identity.tipo_documento, '');
  assert.equal(item.identity.direcao_nf, null);
});

test('display: derives from loaded reader fields', function () {
  var rec = makeRecord({
    email_received_at: '2026-07-01T10:00:00.000Z',
    received_at: '2026-07-01T09:00:00.000Z',
    detected_at: '2026-07-09T14:00:00.000Z',
    created_at: '2026-07-09T13:00:00.000Z',
    sender_email: 'fornecedor@example.com',
    from: 'alt@example.com',
  });
  var item = createItem(rec, baseCtx);
  assert.equal(item.display.received_at, '2026-07-01T10:00:00.000Z');
  assert.equal(item.display.processed_at, '2026-07-09T14:00:00.000Z');
  assert.equal(item.display.source_display, 'fornecedor@example.com');
});

test('display: falls back to received_at, created_at, from when primary absent', function () {
  var rec = makeRecord({
    received_at: '2026-07-01T09:00:00.000Z',
    created_at: '2026-07-09T13:00:00.000Z',
    from: 'alt@example.com',
  });
  var item = createItem(rec, baseCtx);
  assert.equal(item.display.received_at, '2026-07-01T09:00:00.000Z');
  assert.equal(item.display.processed_at, '2026-07-09T13:00:00.000Z');
  assert.equal(item.display.source_display, 'alt@example.com');
});

test('display: fields are null when not present', function () {
  var item = createItem(makeRecord(), baseCtx);
  assert.equal(item.display.received_at, null);
  assert.equal(item.display.processed_at, null);
  assert.equal(item.display.source_display, null);
});

test('display: no invented keys or raw payload', function () {
  var item = createItem(makeRecord({ raw_payload: { segredo: true } }), baseCtx);
  assert.deepStrictEqual(Object.keys(item.display).sort(), ['processed_at', 'received_at', 'source_display']);
  assert.equal(Object.prototype.hasOwnProperty.call(item.display, 'remetente'), false);
});

// ============================================================================
// 4. Immutability / determinism / purity
// ============================================================================

test('immutability: does not mutate inputs', function () {
  var rec = makeRecord();
  var context = clone(baseCtx);
  var recFrozen = clone(rec);
  createItem(rec, context);
  assert.deepStrictEqual(rec, recFrozen);
  assert.deepStrictEqual(context, baseCtx);
});

test('determinism: same input produces identical output', function () {
  var rec = makeRecord();
  var item1 = clone(createItem(rec, baseCtx));
  var item2 = clone(createItem(rec, baseCtx));
  assert.deepStrictEqual(item1, item2);
});

test('purity: input fields are not copied to output root', function () {
  var item = createItem(makeRecord(), baseCtx);
  ['document_id', 'filename_original', 'drive_file_id', 'pedido_manual', 'pedido_id', '_ravatex_technical_evidence', '_ravatex_server_decision', 'raw_payload'].forEach(function (k) {
    assert.equal(Object.prototype.hasOwnProperty.call(item, k), false, k);
  });
});

// ============================================================================
// 5. Evidence axis
// ============================================================================

runTable('evidence: maps evidence state', [
  ['available', { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' }, { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' }],
  ['missing', { state: 'missing' }, { state: 'missing' }],
  ['invalid', { state: 'invalid' }, { state: 'invalid' }],
  ['null', null, { state: 'missing' }],
  ['absent', undefined, { state: 'missing' }],
], function (row) {
  var rec = makeRecord({ _ravatex_technical_evidence: row[1] });
  var item = createItem(rec, baseCtx);
  assert.deepStrictEqual(item.technical_evidence, row[2]);
});

test('evidence: available does not carry full technicalEvidence payload', function () {
  var rec = makeRecord({
    _ravatex_technical_evidence: {
      state: 'available',
      evidenceVersion: 1,
      createdAt: '2026-07-09T14:00:00.000Z',
      technicalEvidence: { hash: 'abc123', payload: { segredo: 'não deveria sair' } },
      origin: { source: 'ingestor', runId: 'run-01' },
    },
  });
  var item = createItem(rec, baseCtx);
  assert.equal(Object.prototype.hasOwnProperty.call(item.technical_evidence, 'technicalEvidence'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item.technical_evidence, 'origin'), false);
});

test('evidence: remote_unavailable when remoteAvailability is unavailable (NEVER missing)', function () {
  var rec = makeRecord({ _ravatex_technical_evidence: null });
  var item = createItem(rec, ctx('supabase', 'unavailable'));
  assert.deepStrictEqual(item.technical_evidence, { state: 'remote_unavailable' });
});

test('evidence: remote_unavailable even when evidence data exists', function () {
  var rec = makeRecord({ _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' } });
  var item = createItem(rec, ctx('supabase', 'unavailable'));
  assert.deepStrictEqual(item.technical_evidence, { state: 'remote_unavailable' });
});

runTable('evidence: legacy evidence is unavailable', [
  ['legacy_fallback', 'legacy_fallback'],
  ['legacy', 'legacy'],
], function (row) {
  var rec = makeRecord({ _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' } });
  var item = createItem(rec, ctx(row[1], 'not_applicable'));
  assert.deepStrictEqual(item.technical_evidence, { state: 'unavailable' });
});

// ============================================================================
// 6. Review axis
// ============================================================================

runTable('review: maps review state', [
  ['accepted decision', { _ravatex_server_decision: { status: 'accepted' } }, 'accepted', 'supabase'],
  ['rejected decision', { _ravatex_server_decision: { status: 'rejected' } }, 'rejected', 'supabase'],
  ['pending status', { _ravatex_server_decision: null, status: 'pending' }, 'pending', 'supabase'],
  ['unknown', { _ravatex_server_decision: null, status: null }, 'unknown', 'supabase'],
  ['legacy unavailable', { _ravatex_server_decision: null, status: 'pending' }, 'unavailable', 'legacy_fallback'],
  ['legacy fallback unavailable', { _ravatex_server_decision: { status: 'accepted' } }, 'unavailable', 'legacy_fallback'],
], function (row) {
  var rec = makeRecord(row[1]);
  var item = createItem(rec, ctx(row[3], row[3] === 'supabase' ? 'available' : 'not_applicable'));
  assert.deepStrictEqual(item.review, { state: row[2] });
});

test('review: technical evidence does not affect review', function () {
  var decision = { status: 'accepted' };
  var itemA = createItem(makeRecord({ _ravatex_technical_evidence: { state: 'available' }, _ravatex_server_decision: decision }), baseCtx);
  var itemB = createItem(makeRecord({ _ravatex_technical_evidence: { state: 'invalid' }, _ravatex_server_decision: decision }), baseCtx);
  assert.deepStrictEqual(itemA.review, itemB.review);
});

// ============================================================================
// 7. Pedido axis — confirmed derives ONLY from the active link revision
// ============================================================================

function withLink(overrides, link) {
  var rec = makeRecord(overrides);
  rec._ravatex_link_revision = link;
  return rec;
}

runTable('pedido: confirmed derives from active link revision, not candidate.pedido_id', [
  [withLink({ pedido_manual: null }, { state: 'available', pedido_id: 'uuid-12345', op_links: [] }),
    { state: 'confirmed_pedido_reference', pedido_id: 'uuid-12345', pedido_manual: null }],
  [withLink({ pedido_manual: 'PED-99-2026' }, { state: 'available', pedido_id: 'uuid-12345', op_links: [] }),
    { state: 'confirmed_pedido_reference', pedido_id: 'uuid-12345', pedido_manual: 'PED-99-2026' }],
  [makeRecord({ pedido_id: null, pedido_manual: 'PED-99-2026' }),
    { state: 'suggested_pedido', pedido_manual: 'PED-99-2026', pedido_id: null }],
  [makeRecord({ pedido_id: null, pedido_manual: null }),
    { state: 'no_confirmed_link', pedido_manual: null, pedido_id: null }],
], function (row) {
  var item = createItem(row[0], baseCtx);
  assert.deepStrictEqual(item.pedido, row[1]);
});

test('pedido: candidate.pedido_id is IGNORED (never treated as confirmed)', function () {
  var item = createItem(makeRecord({ pedido_id: 'uuid-should-be-ignored', pedido_manual: null }), baseCtx);
  assert.equal(item.pedido.state, 'no_confirmed_link');
  assert.equal(item.pedido.pedido_id, null);
});

test('pedido: suggestion stays distinct from confirmation', function () {
  var item = createItem(withLink({ pedido_manual: 'PED-99-2026' }, { state: 'available', pedido_id: 'uuid-conf', op_links: [] }), baseCtx);
  assert.equal(item.pedido.state, 'confirmed_pedido_reference');
  assert.equal(item.pedido.pedido_id, 'uuid-conf');
  assert.equal(item.pedido.pedido_manual, 'PED-99-2026');
});

test('pedido: link source unavailable is explicit, never silent no-links', function () {
  var item = createItem(withLink({ pedido_manual: 'PED-99-2026' }, { state: 'unavailable' }), baseCtx);
  assert.equal(item.pedido.state, 'unavailable');
});

test('pedido: does not fetch or validate pedido', function () {
  var item = createItem(withLink({}, { state: 'available', pedido_id: 'uuid-12345', op_links: [] }), baseCtx);
  assert.equal(item.pedido.state, 'confirmed_pedido_reference');
  assert.equal(Object.prototype.hasOwnProperty.call(item.pedido, 'valid'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item.pedido, 'fetch'), false);
});

test('pedido: no_confirmed_link for absent values in canonical context', function () {
  var rec = makeRecord({ pedido_manual: null, pedido_id: null });
  var item = createItem(rec, baseCtx);
  assert.deepStrictEqual(item.pedido, { state: 'no_confirmed_link', pedido_manual: null, pedido_id: null });
});

test('pedido: no_confirmed_link for whitespace-only pedido_manual in canonical context', function () {
  var rec = makeRecord({ pedido_manual: '   ', pedido_id: null });
  var item = createItem(rec, baseCtx);
  assert.deepStrictEqual(item.pedido, { state: 'no_confirmed_link', pedido_manual: null, pedido_id: null });
});

runTable('pedido: unavailable for non-canonical contexts', [
  ['legacy_fallback + not_applicable', ctx('legacy_fallback', 'not_applicable'), { pedido_id: 'uuid', pedido_manual: null }],
  ['legacy_fallback + available', ctx('legacy_fallback', 'available'), { pedido_id: null, pedido_manual: 'PED-99' }],
  ['legacy + not_applicable', ctx('legacy', 'not_applicable'), { pedido_id: 'uuid', pedido_manual: 'PED-99' }],
  ['unknown + available', ctx('unknown', 'available'), { pedido_id: null, pedido_manual: 'PED-99' }],
  ['supabase + unavailable', ctx('supabase', 'unavailable'), { pedido_id: 'uuid', pedido_manual: 'PED-99' }],
  ['supabase + not_applicable', ctx('supabase', 'not_applicable'), { pedido_id: null, pedido_manual: null }],
], function (row) {
  var rec = makeRecord(row[2]);
  var item = createItem(rec, row[1]);
  assert.equal(item.pedido.state, 'unavailable', row[0]);
  assert.ok(Object.prototype.hasOwnProperty.call(item.pedido, 'pedido_manual'), 'pedido_manual key preserved ' + row[0]);
  assert.ok(Object.prototype.hasOwnProperty.call(item.pedido, 'pedido_id'), 'pedido_id key preserved ' + row[0]);
});

// ============================================================================
// 8. OP axis — canonical projection from the active link revision
// ============================================================================

test('op: unavailable in non-canonical context', function () {
  var item = createItem(makeRecord(), ctx('legacy_fallback', 'not_applicable'));
  assert.deepStrictEqual(item.op, { state: 'unavailable' });
});

test('op: unavailable when link source unavailable (never silent no-links)', function () {
  var item = createItem(withLink({}, { state: 'unavailable' }), baseCtx);
  assert.deepStrictEqual(item.op, { state: 'unavailable' });
});

test('op: no_confirmed_op when canonical and no OP children', function () {
  var item = createItem(withLink({}, { state: 'available', pedido_id: null, op_links: [] }), baseCtx);
  assert.deepStrictEqual(item.op, { state: 'no_confirmed_op', op_ids: [] });
});

test('op: no_confirmed_op when canonical and no link revision attached', function () {
  var item = createItem(makeRecord(), baseCtx);
  assert.deepStrictEqual(item.op, { state: 'no_confirmed_op', op_ids: [] });
});

test('op: confirmed_op projects the revision OP children (placeholder replaced)', function () {
  var item = createItem(withLink({}, {
    state: 'available', pedido_id: 'uuid-12345',
    op_links: [{ op_id: 7, op_status: 'em_producao' }, { op_id: 3, op_status: 'aberta' }],
  }), baseCtx);
  assert.deepStrictEqual(item.op, { state: 'confirmed_op', op_ids: [7, 3] });
});

test('duplicate: always unavailable (not implemented in B6)', function () {
  assert.deepStrictEqual(createItem(makeRecord(), baseCtx).duplicate, { state: 'unavailable' });
  assert.deepStrictEqual(createItem(makeRecord(), ctx('legacy_fallback', 'not_applicable')).duplicate, { state: 'unavailable' });
});

// ============================================================================
// 8b. Cancelled linked targets surface as warnings (never silent unlink)
// ============================================================================

test('alerts: linked cancelled Pedido surfaces a warning', function () {
  var item = createItem(withLink({}, {
    state: 'available', pedido_id: 'uuid-c', pedido_status: 'cancelado', op_links: [],
  }), baseCtx);
  assertAlert('linked pedido cancelled', item, 'linked_pedido_cancelled', 'warning');
});

test('alerts: linked cancelled OP surfaces a warning', function () {
  var item = createItem(withLink({}, {
    state: 'available', pedido_id: 'uuid-c', pedido_status: 'confirmado',
    op_links: [{ op_id: 7, op_status: 'cancelada' }],
  }), baseCtx);
  assertAlert('linked op cancelled', item, 'linked_op_cancelled', 'warning');
});

test('alerts: no cancelled warnings when targets are healthy', function () {
  var item = createItem(withLink({}, {
    state: 'available', pedido_id: 'uuid-c', pedido_status: 'confirmado',
    op_links: [{ op_id: 7, op_status: 'em_producao' }],
  }), baseCtx);
  assertNoAlert('healthy pedido', item, 'linked_pedido_cancelled');
  assertNoAlert('healthy op', item, 'linked_op_cancelled');
});

// ============================================================================
// 9. Source file capability
// ============================================================================

runTable('source_file: maps capability state', [
  ['drive link only', { drive_web_view_link: 'https://drive.example/abc', drive_file_id: null }, 'drive_available'],
  ['drive id only', { drive_web_view_link: null, drive_file_id: 'drive-abc' }, 'drive_available'],
  ['both drive fields', { drive_web_view_link: 'https://drive.example/abc', drive_file_id: 'drive-abc' }, 'drive_available'],
  ['email_message_id', { drive_web_view_link: null, drive_file_id: null, email_message_id: 'msg-abc' }, 'unsupported'],
  ['gmail_message_id', { drive_web_view_link: null, drive_file_id: null, gmail_message_id: 'gmail-xyz' }, 'unsupported'],
  ['local_path', { drive_web_view_link: null, drive_file_id: null, local_path: 'C:\\docs\\NF.xml' }, 'unsupported'],
  ['no locator', { drive_web_view_link: null, drive_file_id: null }, 'missing'],
], function (row) {
  var item = createItem(makeRecord(row[1]), baseCtx);
  assert.deepStrictEqual(item.source_file, { state: row[2] }, row[0]);
});

test('source_file: output exposes no locator', function () {
  var item = createItem(makeRecord({ email_message_id: 'msg', local_path: 'x' }), baseCtx);
  ['local_path', 'email_message_id', 'gmail_message_id', 'email_received_at', 'drive_web_view_link', 'drive_file_id'].forEach(function (k) {
    assert.equal(Object.prototype.hasOwnProperty.call(item.source_file, k), false, k);
  });
});

// ============================================================================
// 10. Alerts — stable, payload-free, deterministic
// ============================================================================

test('alerts: evidence-related alerts', function () {
  var itemInvalid = createItem(makeRecord({ _ravatex_technical_evidence: { state: 'invalid' } }), baseCtx);
  assertAlert('invalid', itemInvalid, 'invalid_evidence', 'warning');

  var itemMissing = createItem(makeRecord({ _ravatex_technical_evidence: { state: 'missing' } }), baseCtx);
  assertAlert('missing', itemMissing, 'missing_evidence', 'info');

  var itemRemote = createItem(makeRecord({ _ravatex_technical_evidence: null }), ctx('supabase', 'unavailable'));
  assertAlert('remote', itemRemote, 'remote_unavailable', 'warning');
  assertNoAlert('remote no missing_evidence', itemRemote, 'missing_evidence');
});

test('alerts: source-related alerts', function () {
  var itemLegacy = createItem(makeRecord({ tipo_documento: null, _ravatex_technical_evidence: null }), ctx('legacy_fallback', 'not_applicable'));
  assertAlert('legacy_fallback', itemLegacy, 'legacy_fallback', 'info');
  assertNoAlert('legacy no missing_evidence', itemLegacy, 'missing_evidence');
  assertNoAlert('legacy no unknown_document_type', itemLegacy, 'unknown_document_type');

  var itemUnknownType = createItem(makeRecord({ tipo_documento: null }), baseCtx);
  assertAlert('unknown_document_type', itemUnknownType, 'unknown_document_type', 'warning');
});

test('alerts: pedido and source file alerts', function () {
  var itemSuggested = createItem(makeRecord({ pedido_manual: 'PED', pedido_id: null }), baseCtx);
  assertAlert('suggested pedido', itemSuggested, 'suggested_pedido', 'info');

  var itemUnsupported = createItem(makeRecord({ drive_web_view_link: null, drive_file_id: null, email_message_id: 'msg' }), baseCtx);
  assertAlert('unsupported locator', itemUnsupported, 'unsupported_source_file', 'info');

  var itemMissing = createItem(makeRecord({ drive_web_view_link: null, drive_file_id: null }), baseCtx);
  assertAlert('missing locator', itemMissing, 'unsupported_source_file', 'info');

  var itemDrive = createItem(makeRecord({ drive_web_view_link: 'https://drive.example/abc' }), baseCtx);
  assertNoAlert('drive available', itemDrive, 'unsupported_source_file');
});

test('alerts: deterministic and payload-free', function () {
  var rec = makeRecord({ _ravatex_technical_evidence: { state: 'invalid' }, pedido_manual: 'PED', pedido_id: null });
  var item1 = createItem(rec, baseCtx);
  var item2 = createItem(rec, baseCtx);
  assert.deepStrictEqual(item1.alerts, item2.alerts);
  for (var i = 0; i < item1.alerts.length; i++) {
    var keys = Object.keys(item1.alerts[i]);
    assert.equal(keys.length, 2);
    assert.ok(keys.indexOf('code') >= 0);
    assert.ok(keys.indexOf('severity') >= 0);
  }
});

test('alerts: no_confirmed_link does not create suggested_pedido alert', function () {
  var rec = makeRecord({ pedido_manual: null, pedido_id: null });
  var item = createItem(rec, baseCtx);
  assertNoAlert('no_confirmed_link', item, 'suggested_pedido');
});

test('alerts: no_confirmed_link does not create any new alert code', function () {
  var rec = makeRecord({ pedido_manual: null, pedido_id: null });
  var item = createItem(rec, baseCtx);
  item.alerts.forEach(function (a) {
    assert.notEqual(a.code, 'no_confirmed_link', 'no_confirmed_link must not produce an alert');
  });
});

test('alerts: suggested_pedido alert only in canonical available context', function () {
  var recCanonical = makeRecord({ pedido_manual: 'PED-99', pedido_id: null });
  var itemCanonical = createItem(recCanonical, baseCtx);
  assertAlert('canonical suggested', itemCanonical, 'suggested_pedido', 'info');

  var recLegacy = makeRecord({ pedido_manual: 'PED-99', pedido_id: 'uuid' });
  var itemLegacy = createItem(recLegacy, ctx('legacy_fallback', 'not_applicable'));
  assertNoAlert('legacy suggested', itemLegacy, 'suggested_pedido');

  var recUnknown = makeRecord({ pedido_manual: 'PED-99', pedido_id: null });
  var itemUnknown = createItem(recUnknown, ctx('unknown', 'available'));
  assertNoAlert('unknown suggested', itemUnknown, 'suggested_pedido');

  var recRemoteUnavail = makeRecord({ pedido_manual: 'PED-99', pedido_id: null });
  var itemRemoteUnavail = createItem(recRemoteUnavail, ctx('supabase', 'unavailable'));
  assertNoAlert('remote_unavailable suggested', itemRemoteUnavail, 'suggested_pedido');
});

test('alerts: no success alert', function () {
  var rec = makeRecord({
    _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' },
    pedido_id: 'uuid-12345',
  });
  var item = createItem(rec, baseCtx);
  var successAlerts = item.alerts.filter(function (a) { return a.severity === 'success' || a.code === 'success'; });
  assert.equal(successAlerts.length, 0);
});

// ============================================================================
// 11. Filter values per item
// ============================================================================

test('filter_values: exposes all authorized axes', function () {
  var item = createItem(makeRecord(), baseCtx);
  assert.deepStrictEqual(Object.keys(item.filter_values).sort(), [
    'collection_source', 'evidence_state', 'review_state', 'pedido_state',
    'source_capability', 'tipo_documento', 'formato', 'direcao_nf', 'validation_review',
  ].sort());
  assert.equal(item.filter_values.collection_source, 'supabase');
  assert.equal(item.filter_values.evidence_state, 'missing');
  assert.equal(item.filter_values.review_state, 'pending');
  assert.equal(item.filter_values.pedido_state, 'suggested_pedido');
  assert.equal(item.filter_values.source_capability, 'drive_available');
  assert.equal(item.filter_values.tipo_documento, 'nf');
  assert.equal(item.filter_values.formato, 'xml');
  assert.equal(item.filter_values.direcao_nf, 'entrada');
  assert.equal(item.filter_values.validation_review, 'review_pending');
});

test('filter_values: reflects state changes', function () {
  var itemConfirmed = createItem(withLink({ pedido_manual: null }, { state: 'available', pedido_id: 'uuid', op_links: [] }), baseCtx);
  assert.equal(itemConfirmed.filter_values.pedido_state, 'confirmed_pedido_reference');

  var itemRemote = createItem(makeRecord({ _ravatex_technical_evidence: null }), ctx('supabase', 'unavailable'));
  assert.equal(itemRemote.filter_values.evidence_state, 'remote_unavailable');

  var itemUnsupported = createItem(makeRecord({ drive_web_view_link: null, drive_file_id: null, email_message_id: 'msg' }), baseCtx);
  assert.equal(itemUnsupported.filter_values.source_capability, 'unsupported');

  var itemMissing = createItem(makeRecord({ drive_web_view_link: null, drive_file_id: null }), baseCtx);
  assert.equal(itemMissing.filter_values.source_capability, 'missing');
});

// ============================================================================
// 12. Validation indication
// ============================================================================

runTable('validation: maps indication', [
  ['supabase pending available', ctx('supabase', 'available'), { status: 'pending' }, 'review_pending'],
  ['supabase unknown available', ctx('supabase', 'available'), { status: null }, 'review_pending'],
  ['supabase accepted available', ctx('supabase', 'available'), { _ravatex_server_decision: { status: 'accepted' } }, 'review_unavailable'],
  ['supabase rejected available', ctx('supabase', 'available'), { _ravatex_server_decision: { status: 'rejected' } }, 'review_unavailable'],
  ['legacy pending', ctx('legacy_fallback', 'not_applicable'), { status: 'pending' }, 'review_unavailable'],
  ['legacy accepted', ctx('legacy', 'not_applicable'), { _ravatex_server_decision: { status: 'accepted' } }, 'review_unavailable'],
  ['unknown unavailable', ctx('unknown', 'unavailable'), { status: 'pending' }, 'review_unavailable'],
  ['unknown available', ctx('unknown', 'available'), { status: 'pending' }, 'review_pending'],
], function (row) {
  var rec = makeRecord(row[2]);
  var item = createItem(rec, row[1]);
  assert.equal(item.validation.review, row[3], row[0]);
  assert.equal(Object.keys(item.validation).length, 1);
});

test('validation: remote_unavailable overrides accepted review to review_unavailable', function () {
  var rec = makeRecord({ _ravatex_server_decision: { status: 'accepted' } });
  var item = createItem(rec, ctx('supabase', 'unavailable'));
  assert.equal(item.review.state, 'accepted');
  assert.equal(item.validation.review, 'review_unavailable');
});

// ============================================================================
// 13. Authorized filters
// ============================================================================

test('filters: returns fresh authorized axes', function () {
  var filters = getAuthorizedFilters();
  assert.ok(Array.isArray(filters));
  assert.notStrictEqual(getAuthorizedFilters(), filters);
  var blocked = ['duplicate', 'op', 'scan', 'event'];
  filters.forEach(function (f) {
    assert.ok(typeof f.axis === 'string');
    assert.ok(Array.isArray(f.values));
    assert.ok(f.values.length > 0);
    assert.equal(blocked.indexOf(f.axis), -1, f.axis);
  });
  var axes = filters.map(function (f) { return f.axis; });
  ['collection_source', 'evidence_state', 'review_state', 'pedido_state', 'source_capability'].forEach(function (a) {
    assert.ok(axes.indexOf(a) >= 0, a);
  });
});

runTable('filters: axis values', [
  ['collection_source', ['supabase', 'legacy_fallback', 'legacy', 'unknown']],
  ['evidence_state', ['available', 'missing', 'invalid', 'remote_unavailable', 'unavailable']],
  ['review_state', ['pending', 'accepted', 'rejected', 'unknown', 'unavailable']],
  ['pedido_state', ['confirmed_pedido_reference', 'no_confirmed_link', 'suggested_pedido', 'unavailable']],
  ['source_capability', ['drive_available', 'unsupported', 'missing']],
  ['validation_review', ['review_available', 'review_pending', 'review_unavailable']],
], function (row) {
  var axis = getAuthorizedFilters().find(function (f) { return f.axis === row[0]; });
  assert.ok(axis, row[0]);
  row[1].forEach(function (v) {
    assert.ok(axis.values.indexOf(v) >= 0, row[0] + ':' + v);
  });
});

// ============================================================================
// 14. No action / no external access
// ============================================================================

test('no-action: output contains no function/action/callback keys', function () {
  function walk(obj, path) {
    for (var key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (['action', 'callback', 'onClick', 'handler', 'fn'].indexOf(key) >= 0) {
        assert.fail('action-like key ' + key + ' at ' + path);
      }
      if (typeof obj[key] === 'function') {
        assert.fail('function at ' + path + '.' + key);
      }
    }
  }
  walk(createItem(makeRecord(), baseCtx), 'root');
});

test('no-access: module does not use prohibited APIs', function () {
  var fs = require('node:fs');
  var path = require('node:path');
  var source = fs.readFileSync(path.join(__dirname, '..', 'js', 'document-queue-read-model.js'), 'utf8');
  assert.equal(/window\./.test(source), false);
  assert.equal(/\bwindow\b/.test(source), false);
  assert.equal(/document\./.test(source), false);
  assert.equal(/localStorage/.test(source), false);
  assert.equal(/sessionStorage/.test(source), false);
  assert.equal(/\bfetch\s*\(/.test(source), false);
  assert.equal(/XMLHttpRequest/.test(source), false);
  assert.equal(/supabase\./i.test(source) || /supa\b/i.test(source), false);
  assert.equal(/googleapis/i.test(source), false);
  assert.equal(/node:/.test(source), false);
});

// ============================================================================
// 15. Constants integrity
// ============================================================================

test('constants: distinct values', function () {
  function vals(obj) { return Object.keys(obj).map(function (k) { return obj[k]; }); }
  assert.deepStrictEqual(vals(C.EVIDENCE_STATE).sort(), ['available', 'invalid', 'missing', 'remote_unavailable', 'unavailable'].sort());
  assert.deepStrictEqual(vals(C.REVIEW_STATE).sort(), ['accepted', 'pending', 'rejected', 'unavailable', 'unknown'].sort());
  assert.deepStrictEqual(vals(C.SOURCE_CAPABILITY).sort(), ['drive_available', 'missing', 'unsupported'].sort());
  assert.deepStrictEqual(vals(C.VALIDATION_INDICATION).sort(), ['review_available', 'review_pending', 'review_unavailable'].sort());
  assert.deepStrictEqual(vals(C.PEDIDO_STATE).sort(), ['confirmed_pedido_reference', 'no_confirmed_link', 'suggested_pedido', 'unavailable'].sort());
});

// ============================================================================
// 16. Edge cases
// ============================================================================

test('edge: minimal record', function () {
  var item = createItem({ document_id: 'doc-minimal' }, baseCtx);
  assert.equal(item.identity.document_id, 'doc-minimal');
  assert.deepStrictEqual(item.technical_evidence, { state: 'missing' });
  assert.deepStrictEqual(item.review, { state: 'unknown' });
  assert.deepStrictEqual(item.pedido, { state: 'no_confirmed_link', pedido_manual: null, pedido_id: null });
  assert.deepStrictEqual(item.source_file, { state: 'missing' });
});

test('edge: unexpected fields are not copied', function () {
  var item = createItem(makeRecord({ raw_payload: { segredo: true }, internal_state: 'confidential' }), baseCtx);
  assert.equal(Object.prototype.hasOwnProperty.call(item, 'raw_payload'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, 'internal_state'), false);
});

test('edge: context defaults', function () {
  var item = createItem(makeRecord(), {});
  assert.equal(item.source.collection_source, 'unknown');
  assert.equal(item.technical_evidence.state, 'missing');
});
