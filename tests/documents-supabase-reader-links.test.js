'use strict';

// =====================================================================
// === tests/documents-supabase-reader-links.test.js ===================
// Reader attaches the active canonical link revision (+ OP children +
// target statuses) as doc._ravatex_link_revision. Fail-closed to
// { state: 'unavailable' } when the link source errors; never a silent
// "no links". document_candidates.pedido_id is not the confirmed link.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const INGESTOR = fs.readFileSync(path.join(ROOT, 'js', 'documents-ingestor.js'), 'utf8');
const LOADER = fs.readFileSync(path.join(ROOT, 'js', 'documents-ingestor-loader.js'), 'utf8');
const READER = fs.readFileSync(path.join(ROOT, 'js', 'documents-supabase-reader.js'), 'utf8');

const DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';
const PED = 'ped-uuid-1';
const REV = 'rev-uuid-1';

function makeQuery(result) {
  const q = {
    select: function () { return q; },
    eq: function () { return q; },
    in: function () { return q; },
    order: function () { return q; },
    then: function (resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return q;
}

function makeSandbox(tableResults) {
  const sandbox = { window: {}, console: { log() {}, error() {} }, localStorage: { getItem() { return null; }, setItem() {} } };
  sandbox.window = sandbox;
  sandbox.supa = {
    from: function (table) {
      const r = Object.prototype.hasOwnProperty.call(tableResults, table) ? tableResults[table] : { data: [] };
      return makeQuery(r);
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(INGESTOR, sandbox, { filename: 'documents-ingestor.js' });
  vm.runInContext(LOADER, sandbox, { filename: 'documents-ingestor-loader.js' });
  vm.runInContext(READER, sandbox, { filename: 'documents-supabase-reader.js' });
  return sandbox;
}

const candidate = {
  document_id: DOC_ID, filename_original: 'NF.xml', tipo_documento: 'nf', formato: 'xml',
  direcao_nf: 'entrada', status: 'pending', pedido_manual: 'PED-99-2026',
  pedido_id: 'candidate-pedido-should-be-ignored', criado_em: '2026-07-09T10:00:00.000Z',
};

test('reader-links: active revision attached with pedido + OP children + statuses', async function () {
  const sb = makeSandbox({
    document_candidates: { data: [candidate] },
    document_decisions: { data: [] },
    document_link_revisions: { data: [{ id: REV, document_id: DOC_ID, pedido_id: PED, version: 2 }] },
    document_link_revision_ops: { data: [{ revision_id: REV, op_id: 7 }, { revision_id: REV, op_id: 3 }] },
    pedidos: { data: [{ id: PED, status: 'confirmado' }] },
    ops: { data: [{ id: 7, status: 'em_producao' }, { id: 3, status: 'cancelada' }] },
  });
  await sb.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase();
  const doc = sb.RAVATEX_DOCUMENTS_RECEIVED[0];
  const link = doc._ravatex_link_revision;
  assert.equal(link.state, 'available');
  assert.equal(link.revision_id, REV);
  assert.equal(link.pedido_id, PED);
  assert.equal(link.pedido_status, 'confirmado');
  assert.equal(link.op_links.length, 2);
  const byId = {};
  link.op_links.forEach(function (o) { byId[o.op_id] = o.op_status; });
  assert.equal(byId[7], 'em_producao');
  assert.equal(byId[3], 'cancelada');
});

test('reader-links: no active revision -> available empty (not unavailable)', async function () {
  const sb = makeSandbox({
    document_candidates: { data: [candidate] },
    document_decisions: { data: [] },
    document_link_revisions: { data: [] },
  });
  await sb.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase();
  const link = sb.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_link_revision;
  assert.equal(link.state, 'available');
  assert.equal(link.revision_id, null);
  assert.deepEqual(JSON.parse(JSON.stringify(link.op_links)), []);
});

test('reader-links: link source error -> fail-closed unavailable (never silent no-links)', async function () {
  const sb = makeSandbox({
    document_candidates: { data: [candidate] },
    document_decisions: { data: [] },
    document_link_revisions: { error: { message: 'boom' } },
  });
  await sb.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase();
  const link = sb.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_link_revision;
  assert.deepEqual(JSON.parse(JSON.stringify(link)), { state: 'unavailable' });
});

test('reader-links: OP children error -> fail-closed unavailable', async function () {
  const sb = makeSandbox({
    document_candidates: { data: [candidate] },
    document_decisions: { data: [] },
    document_link_revisions: { data: [{ id: REV, document_id: DOC_ID, pedido_id: PED, version: 1 }] },
    document_link_revision_ops: { error: { message: 'boom' } },
  });
  await sb.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase();
  const link = sb.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_link_revision;
  assert.equal(link.state, 'unavailable');
});
