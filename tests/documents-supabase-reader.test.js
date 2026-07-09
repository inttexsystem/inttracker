'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const INGESTOR = fs.readFileSync(path.join(ROOT, 'js', 'documents-ingestor.js'), 'utf8');
const LOADER = fs.readFileSync(path.join(ROOT, 'js', 'documents-ingestor-loader.js'), 'utf8');
const READER_PATH = path.join(ROOT, 'js', 'documents-supabase-reader.js');
const READER = fs.readFileSync(READER_PATH, 'utf8');

function makeQuery(result, calls, table) {
  return {
    select: function (fields) { calls.push({ table: table, method: 'select', fields: fields }); return this; },
    eq: function (field, value) { calls.push({ table: table, method: 'eq', field: field, value: value }); return this; },
    order: function (field) { calls.push({ table: table, method: 'order', field: field }); return this; },
    then: function (resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

function makeSandbox(options) {
  options = options || {};
  const calls = [];
  const sandbox = { window: {}, console: {}, localStorage: { getItem() { return null; }, setItem() {} } };
  sandbox.window = sandbox;
  if (options.withSupa !== false) {
    sandbox.supa = {
      from: function (table) {
        calls.push({ table: table, method: 'from' });
        return makeQuery(table === 'document_candidates' ? options.candidatesResult : options.decisionsResult, calls, table);
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(INGESTOR, sandbox, { filename: 'documents-ingestor.js' });
  vm.runInContext(LOADER, sandbox, { filename: 'documents-ingestor-loader.js' });
  vm.runInContext(READER, sandbox, { filename: 'documents-supabase-reader.js' });
  return { sandbox: sandbox, calls: calls, ns: sandbox.RAVATEX_DOCUMENTS };
}

const candidate = {
  document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18',
  filename_original: 'NF-99.xml', tipo_documento: 'nf', formato: 'xml', direcao_nf: 'entrada',
  drive_file_id: 'drive-99', drive_web_view_link: 'https://drive.example/99', status: 'pending',
  pedido_manual: 'PED-99-2026', pedido_id: null, fornecedor_id: null,
  received_at: '2026-07-09T10:00:00.000Z', detected_at: '2026-07-09T10:01:00.000Z',
  linked_at: null, accepted_at: null, rejected_at: null, rejected_reason: null,
  schema_version: 1, criado_em: '2026-07-09T10:00:00.000Z', raw_payload: { segredo: true },
};

test('reader: arquivo existe e sintaxe valida', function () {
  assert.ok(fs.existsSync(READER_PATH));
  require('node:child_process').execFileSync(process.execPath, ['--check', READER_PATH], { stdio: 'pipe' });
});

test('reader: expoe loadReceivedDocumentsFromSupabase', function () {
  const rt = makeSandbox({ candidatesResult: { data: [] }, decisionsResult: { data: [] } });
  assert.equal(typeof rt.ns.loadReceivedDocumentsFromSupabase, 'function');
});

test('reader: falha controlada sem window.supa', async function () {
  const rt = makeSandbox({ withSupa: false });
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, source: 'supabase', error: 'supabase_unavailable' });
});

test('reader: consulta candidates e decisoes ativas, sem raw_payload no select', async function () {
  const rt = makeSandbox({ candidatesResult: { data: [candidate] }, decisionsResult: { data: [] } });
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  assert.ok(rt.calls.some((call) => call.table === 'document_candidates' && call.method === 'from'));
  assert.ok(rt.calls.some((call) => call.table === 'document_decisions' && call.method === 'eq' && call.field === 'ativo' && call.value === true));
  const candidatesSelect = rt.calls.find((call) => call.table === 'document_candidates' && call.method === 'select');
  assert.ok(candidatesSelect.fields.includes('document_id'));
  assert.ok(candidatesSelect.fields.includes('ingestor_status'));
  assert.ok(candidatesSelect.fields.includes('ingestor_state_at'));
  assert.ok(candidatesSelect.fields.includes('ingestor_event_id'));
  assert.equal(candidatesSelect.fields.includes('raw_payload'), false);
});

test('reader: mapeia candidate para o shape flat e preserva origem Supabase', async function () {
  const rt = makeSandbox({ candidatesResult: { data: [candidate] }, decisionsResult: { data: [] } });
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.count, 1);
  const doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc.document_id, candidate.document_id);
  assert.equal(doc.filename_original, 'NF-99.xml');
  assert.equal(doc.pedido_manual, 'PED-99-2026');
  assert.equal(doc.created_at, candidate.criado_em);
  assert.equal(doc._ravatex_source, 'supabase');
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED_SOURCE, 'supabase');
  assert.equal(Object.prototype.hasOwnProperty.call(doc, 'raw_payload'), false);
});

test('reader: decisao ativa sobrescreve status e motivo de rejeicao', async function () {
  const decision = { document_id: candidate.document_id, status: 'rejected', motivo: 'Arquivo ilegivel', decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual', ativo: true };
  const candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned',
    ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
    ingestor_rejected_reason: null,
  });
  const rt = makeSandbox({ candidatesResult: { data: [candidateWithBase] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  const doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc.status, 'rejected');
  assert.equal(doc.rejected_reason, 'Arquivo ilegivel');
  assert.equal(doc._ravatex_decision_source, 'server');
  assert.equal(doc._ravatex_can_undo_server_decision, true);
  assert.equal(rt.ns.getEffectiveDocumentStatus(doc).isLocalDecision, false);
});

test('reader: decisao server sem base completa nao habilita undo', async function () {
  const decision = { document_id: candidate.document_id, status: 'accepted', motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual', ativo: true };
  const incomplete = Object.assign({}, candidate, { ingestor_status: 'pending', ingestor_event_id: 'ingevt-pending-99' });
  const rt = makeSandbox({ candidatesResult: { data: [incomplete] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_can_undo_server_decision, false);
});

test('reader: lista vazia e sucesso primario, sem fallback', async function () {
  const rt = makeSandbox({ candidatesResult: { data: [] }, decisionsResult: { data: [] } });
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED_SOURCE, 'supabase');
});

test('reader: erro do Supabase retorna ok false sem substituir documentos existentes', async function () {
  const rt = makeSandbox({ candidatesResult: { error: { message: 'permission denied' } }, decisionsResult: { data: [] } });
  rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED = [{ document_id: 'manual-doc' }];
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, false);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0].document_id, 'manual-doc');
});

test('reader: nao contem writes nem RPCs', function () {
  assert.equal(/\.insert\s*\(/.test(READER), false);
  assert.equal(/\.update\s*\(/.test(READER), false);
  assert.equal(/\.delete\s*\(/.test(READER), false);
  assert.equal(/\.upsert\s*\(/.test(READER), false);
  assert.equal(/\.rpc\s*\(/.test(READER), false);
});
