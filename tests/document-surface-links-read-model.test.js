'use strict';

// G28-B7 — focused tests for the canonical document-surface link read model.
// Pure reverse projection: documents canonically linked to a Pedido / OP.
// Confirmed links come ONLY from the active canonical revision; pedido_manual
// and candidate.pedido_id are never treated as links.

var test = require('node:test');
var assert = require('node:assert/strict');
var surface = require('../js/document-surface-links-read-model.js');

var buildForPedido = surface.buildLinkedDocumentsForPedido;
var buildForOp = surface.buildLinkedDocumentsForOp;
var S = surface.constants.SURFACE_LINK_STATE;

var PEDIDO_A = '11111111-1111-4111-8111-111111111111';
var PEDIDO_B = '22222222-2222-4222-8222-222222222222';
var DOC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
var DOC_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function supaDoc(overrides) {
  var doc = {
    document_id: DOC_1,
    filename_original: 'NF-1.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    status: 'pending',
    drive_web_view_link: 'https://drive.example/1',
    pedido_manual: null,
    pedido_id: null,
    _ravatex_source: 'supabase',
    _ravatex_server_decision: null,
    _ravatex_link_revision: {
      state: 'available', revision_id: 'rev-1', version: 1,
      pedido_id: null, pedido_status: null, op_links: [],
    },
  };
  if (overrides) {
    for (var k in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, k)) doc[k] = overrides[k];
    }
  }
  return doc;
}

function canonicalOpts(documents) {
  return { documents: documents, globalSource: 'supabase', globalRemoteAvailability: 'available' };
}

// ---------------------------------------------------------------------
// Confirmed Pedido projection
// ---------------------------------------------------------------------

test('pedido: confirmed link surfaces the document (available)', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 3,
    pedido_id: PEDIDO_A, pedido_status: 'em_producao', op_links: [],
  } });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.AVAILABLE);
  assert.equal(res.confirmed.length, 1);
  assert.equal(res.confirmed[0].document_id, DOC_1);
  assert.equal(res.confirmed[0].pedido_id, PEDIDO_A);
  assert.equal(res.confirmed[0].link_version, 3);
  assert.equal(res.confirmed[0].target_cancelled, false);
});

test('pedido: no confirmed link but canonical available -> empty', function () {
  var doc = supaDoc(); // revision pedido_id null
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.EMPTY);
  assert.equal(res.confirmed.length, 0);
});

test('pedido: document confirmed to a DIFFERENT pedido is not returned', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 1,
    pedido_id: PEDIDO_B, pedido_status: null, op_links: [],
  } });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.EMPTY);
});

test('pedido: pedido_manual suggestion is NEVER treated as a confirmed link', function () {
  var doc = supaDoc({
    pedido_manual: 'PED-01-2026',
    pedido_id: PEDIDO_A, // candidate.pedido_id (Ingestor-owned) must be ignored
    _ravatex_link_revision: {
      state: 'available', revision_id: 'rev-1', version: 1,
      pedido_id: null, pedido_status: null, op_links: [],
    },
  });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.EMPTY, 'suggestion + candidate.pedido_id must not confirm a link');
  assert.equal(res.confirmed.length, 0);
});

test('pedido: cancelled linked pedido is flagged target_cancelled', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 1,
    pedido_id: PEDIDO_A, pedido_status: 'cancelado', op_links: [],
  } });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.AVAILABLE);
  assert.equal(res.confirmed[0].target_cancelled, true);
});

// ---------------------------------------------------------------------
// Confirmed OP projection (0..N)
// ---------------------------------------------------------------------

test('op: document linked to multiple OPs surfaces on each matched OP', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 2, pedido_id: PEDIDO_A,
    pedido_status: 'em_producao',
    op_links: [{ op_id: 10, op_status: 'em_producao' }, { op_id: 20, op_status: 'aberta' }],
  } });
  var opts = canonicalOpts([doc]);
  var r10 = buildForOp(10, opts);
  var r20 = buildForOp(20, opts);
  var r30 = buildForOp(30, opts);
  assert.equal(r10.state, S.AVAILABLE);
  assert.deepEqual(r10.confirmed[0].op_ids, [10, 20]);
  assert.deepEqual(r10.confirmed[0].matched_op_ids, [10]);
  assert.equal(r20.state, S.AVAILABLE);
  assert.equal(r30.state, S.EMPTY, 'OP not in op_links must not surface the document');
});

test('op: accepts numeric string target and flags cancelled OP', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 1, pedido_id: PEDIDO_A,
    pedido_status: null, op_links: [{ op_id: 42, op_status: 'cancelada' }],
  } });
  var res = buildForOp('42', canonicalOpts([doc]));
  assert.equal(res.state, S.AVAILABLE);
  assert.equal(res.confirmed[0].target_cancelled, true);
});

// ---------------------------------------------------------------------
// Unavailable / error / loading / invalid
// ---------------------------------------------------------------------

test('unavailable: non-canonical collection source', function () {
  var doc = supaDoc({ _ravatex_link_revision: {
    state: 'available', revision_id: 'rev-1', version: 1, pedido_id: PEDIDO_A, op_links: [],
  } });
  var res = buildForPedido(PEDIDO_A, { documents: [doc], globalSource: 'legacy_fallback', globalRemoteAvailability: 'available' });
  assert.equal(res.state, S.UNAVAILABLE);
  assert.equal(res.reason, 'non_canonical_source');
});

test('unavailable: supabase but remote availability unavailable', function () {
  var doc = supaDoc();
  var res = buildForPedido(PEDIDO_A, { documents: [doc], globalSource: 'supabase', globalRemoteAvailability: 'unavailable' });
  assert.equal(res.state, S.UNAVAILABLE);
});

test('unavailable: fail-closed when reader marked link source unavailable', function () {
  var doc = supaDoc({ _ravatex_link_revision: { state: 'unavailable' } });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([doc]));
  assert.equal(res.state, S.UNAVAILABLE);
  assert.equal(res.reason, 'link_source_unavailable');
});

test('unavailable: documents not loaded (not an array)', function () {
  var res = buildForPedido(PEDIDO_A, { documents: undefined, globalSource: 'supabase', globalRemoteAvailability: 'available' });
  assert.equal(res.state, S.UNAVAILABLE);
  assert.equal(res.reason, 'documents_unavailable');
});

test('loading: explicit loading flag short-circuits to loading', function () {
  var res = buildForPedido(PEDIDO_A, { loading: true, documents: [], globalSource: 'supabase', globalRemoteAvailability: 'available' });
  assert.equal(res.state, S.LOADING);
});

test('invalid: malformed pedido/op target id', function () {
  assert.equal(buildForPedido('not-a-uuid', canonicalOpts([])).state, S.INVALID);
  assert.equal(buildForPedido(null, canonicalOpts([])).state, S.INVALID);
  assert.equal(buildForOp(0, canonicalOpts([])).state, S.INVALID);
  assert.equal(buildForOp('abc', canonicalOpts([])).state, S.INVALID);
});

test('legacy/non-supabase documents are never confirmed even when canonical mode', function () {
  var legacy = supaDoc({
    document_id: DOC_2,
    _ravatex_source: 'legacy',
    _ravatex_link_revision: {
      state: 'available', revision_id: 'rev-x', version: 1,
      pedido_id: PEDIDO_A, pedido_status: null, op_links: [],
    },
  });
  var res = buildForPedido(PEDIDO_A, canonicalOpts([legacy]));
  assert.equal(res.state, S.EMPTY, 'only supabase-sourced docs can carry a confirmed canonical revision');
});
