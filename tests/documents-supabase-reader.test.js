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
    in: function (field, values) { calls.push({ table: table, method: 'in', field: field, values: values }); return this; },
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
        var result;
        if (table === 'document_candidates') {
          result = options.candidatesResult;
        } else if (table === 'document_decisions') {
          result = options.decisionsResult;
        } else if (table === 'document_technical_evidences') {
          result = options.evidenceResult || { data: [] };
        } else {
          result = { data: [] };
        }
        return makeQuery(result, calls, table);
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
  sender_email: 'fornecedor@empresa.com.br',
  email_message_id: 'gmail-99', email_received_at: '2026-07-09T09:00:00.000Z',
  email_received_at_source: 'gmail_internal_date', email_received_at_estimated: false,
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
  assert.ok(candidatesSelect.fields.includes('email_received_at'));
  assert.ok(candidatesSelect.fields.includes('email_received_at_source'));
  assert.ok(candidatesSelect.fields.includes('sender_email'));
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
  assert.equal(doc.email_received_at, candidate.email_received_at);
  assert.equal(doc.email_received_at_source, 'gmail_internal_date');
  assert.equal(doc.sender_email, candidate.sender_email);
  assert.equal(doc.from, candidate.sender_email);
  assert.equal(doc._ravatex_source, 'supabase');
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED_SOURCE, 'supabase');
  assert.equal(Object.prototype.hasOwnProperty.call(doc, 'raw_payload'), false);
});

test('reader: candidate legado sem sender_email permanece valido', async function () {
  const legacyCandidate = Object.assign({}, candidate);
  delete legacyCandidate.sender_email;
  const rt = makeSandbox({ candidatesResult: { data: [legacyCandidate] }, decisionsResult: { data: [] } });
  const result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  const doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc.sender_email, null);
  assert.equal(doc.from, '');
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

// =====================================================================
// G28-B3-B6 — Technical Evidence Reader Tests (RED phase)
// =====================================================================

function makeEvidenceRow(docId, version, technicalEvidence, origin, createdAt) {
  return {
    document_id: docId,
    evidence_version: version,
    technical_evidence: technicalEvidence,
    origin: origin,
    created_at: createdAt,
  };
}

var defaultOrigin = { source: 'ingestor', evidenceVersion: 1, runId: 'run-01' };
var defaultEvidence = { hash: 'abc123', payload: { v: 1 } };
var defaultCreatedAt = '2026-07-09T14:00:00.000Z';

// 1. One evidence attached as available
test('evidence: um documento com evidencia valida recebe state=available', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.ok(doc._ravatex_technical_evidence, 'doc deve ter evidencia');
  assert.equal(doc._ravatex_technical_evidence.state, 'available');
  assert.equal(doc._ravatex_technical_evidence.evidenceVersion, 1);
  assert.deepStrictEqual(doc._ravatex_technical_evidence.technicalEvidence, defaultEvidence);
  assert.deepStrictEqual(doc._ravatex_technical_evidence.origin, defaultOrigin);
  assert.equal(doc._ravatex_technical_evidence.createdAt, defaultCreatedAt);
});

// 2. evidence query uses in filter restricted to candidate doc_ids
test('evidence: consulta evidencia restrita aos document_ids dos candidatos', async function () {
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var evidenceFrom = rt.calls.find(function (c) { return c.table === 'document_technical_evidences' && c.method === 'from'; });
  assert.ok(evidenceFrom, 'evidence from chamado');
  var evidenceIn = rt.calls.find(function (c) { return c.table === 'document_technical_evidences' && c.method === 'in'; });
  assert.ok(evidenceIn, 'evidence in chamado');
  assert.equal(evidenceIn.field, 'document_id');
  assert.ok(Array.isArray(evidenceIn.values));
  assert.ok(evidenceIn.values.indexOf(candidate.document_id) >= 0);
  var evidenceSelect = rt.calls.find(function (c) { return c.table === 'document_technical_evidences' && c.method === 'select'; });
  assert.ok(evidenceSelect, 'evidence select chamado');
  assert.equal(evidenceSelect.fields, 'document_id, evidence_version, technical_evidence, origin, created_at',
    'evidence select contem exatamente os campos do contrato e na ordem especificada');
});

// 3. Multiple unordered versions — highest numeric selected
test('evidence: seleciona a maior versao numerica dentre multiplas linhas desordenadas', async function () {
  var originV2 = { source: 'ingestor', evidenceVersion: 2, runId: 'run-02' };
  var evidenceV2 = { hash: 'def456', payload: { v: 2 } };
  var rows = [
    makeEvidenceRow(candidate.document_id, 2, evidenceV2, originV2, '2026-07-10T10:00:00.000Z'),
    makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, defaultCreatedAt),
  ];
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: rows },
  });
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'available');
  assert.equal(ev.evidenceVersion, 2);
  assert.deepStrictEqual(ev.technicalEvidence, evidenceV2);
});

// 4. created_at is audit only — older version with later timestamp does NOT win
test('evidence: created_at e dado de auditoria — versao menor com created_at posterior nao vence', async function () {
  var originV2 = { source: 'ingestor', evidenceVersion: 2, runId: 'run-02' };
  var evidenceV2 = { hash: 'v2', payload: { v: 2 } };
  var laterTimestamp = '2026-07-11T10:00:00.000Z';
  var earlierTimestamp = '2026-07-10T10:00:00.000Z';
  var rows = [
    makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, laterTimestamp),
    makeEvidenceRow(candidate.document_id, 2, evidenceV2, originV2, earlierTimestamp),
  ];
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: rows },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'available');
  assert.equal(ev.evidenceVersion, 2, 'evidence_version 2 deve vencer apesar de created_at anterior');
  assert.deepStrictEqual(ev.technicalEvidence, evidenceV2);
  assert.strictEqual(ev.createdAt, earlierTimestamp);
});

// 5. Missing — no evidence row for candidate
test('evidence: candidate sem evidencia recebe state=missing', async function () {
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [] },
  });
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence.state, 'missing');
});

// 6. Unknown/outside candidate ignored (evidence for doc not in candidates)
test('evidence: evidencia de documento fora dos candidatos e ignorada', async function () {
  var evidence = makeEvidenceRow('outside-doc-id', 1, defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, true);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED.length, 1);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0].document_id, candidate.document_id);
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence.state, 'missing');
});

// 7. Non-object technical_evidence → invalid
test('evidence: technical_evidence string retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, 'nao-sou-objeto', defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.evidenceVersion, 1);
  assert.equal(ev.reason, 'invalid_technical_evidence');
});

test('evidence: technical_evidence null retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, null, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_technical_evidence');
});

test('evidence: technical_evidence number retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, 42, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_technical_evidence');
});

// 8. Array technical_evidence → invalid
test('evidence: technical_evidence array retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, [1, 2, 3], defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_technical_evidence');
});

// 9. Non-object origin → invalid
test('evidence: origin string retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, 'nao-sou-objeto', defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin');
});

test('evidence: origin null retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, null, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin');
});

test('evidence: origin array retorna state=invalid', async function () {
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, [1, 2, 3], defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin');
});

// 10. Invalid origin version (not integer or < 1)
test('evidence: origin.evidenceVersion string retorna state=invalid', async function () {
  var badOrigin = { source: 'ingestor', evidenceVersion: '1' };
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, badOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin_evidence_version');
});

test('evidence: origin.evidenceVersion < 1 retorna state=invalid', async function () {
  var badOrigin = { source: 'ingestor', evidenceVersion: 0 };
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, badOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin_evidence_version');
});

test('evidence: origin.evidenceVersion float retorna state=invalid', async function () {
  var badOrigin = { source: 'ingestor', evidenceVersion: 1.5 };
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, badOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.reason, 'invalid_origin_evidence_version');
});

// 11. Version mismatch (origin.evidenceVersion !== evidence_version)
test('evidence: versao do origin divergente da linha retorna state=invalid', async function () {
  var mismatchedOrigin = { source: 'ingestor', evidenceVersion: 99 };
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, mismatchedOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.evidenceVersion, 1);
  assert.equal(ev.reason, 'origin_evidence_version_mismatch');
});

// 12. Invalid highest version — no fallback to older valid version
test('evidence: maior versao numerica invalida nao faz fallback para versao anterior valida', async function () {
  var rows = [
    makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, defaultCreatedAt),
    makeEvidenceRow(candidate.document_id, 2, 'nao-objeto', defaultOrigin, '2026-07-10T10:00:00.000Z'),
  ];
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: rows },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.evidenceVersion, 2, 'deve reportar a maior versao (2), nao fallback para 1');
});

// 13. Evidence query failure → ok:false, documents preserved
test('evidence: falha na consulta de evidencia retorna ok false e nao substitui documentos', async function () {
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { error: { message: 'evidence table not found' } },
  });
  rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED = [{ document_id: 'manual-doc' }];
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, false);
  assert.equal(result.source, 'supabase');
  assert.ok(typeof result.error === 'string');
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0].document_id, 'manual-doc');
  assert.equal(rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED.length, 1);
});

// 14. Authorization-style error → ok:false
test('evidence: erro de autorizacao na evidencia retorna ok false', async function () {
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { error: { message: 'permission denied for table document_technical_evidences', code: '42501' } },
  });
  var result = await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.equal(result.ok, false);
  assert.equal(result.source, 'supabase');
});

// 15. Decisions unchanged — decision overlay still works with evidence
test('evidence: decisao ativa continua funcionando com evidencia anexada', async function () {
  var decision = { document_id: candidate.document_id, status: 'rejected', motivo: 'Arquivo ilegivel', decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual', ativo: true };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned',
    ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
    ingestor_rejected_reason: null,
  });
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidateWithBase] },
    decisionsResult: { data: [decision] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc.status, 'rejected');
  assert.equal(doc.rejected_reason, 'Arquivo ilegivel');
  assert.equal(doc._ravatex_decision_source, 'server');
  assert.equal(doc._ravatex_can_undo_server_decision, true);
  assert.equal(doc._ravatex_technical_evidence.state, 'available');
});

// 16. Evidence and origin objects not mutated
test('evidence: nao muta objetos de technical_evidence nem origin', async function () {
  var originalEvidence = JSON.parse(JSON.stringify(defaultEvidence));
  var originalOrigin = JSON.parse(JSON.stringify(defaultOrigin));
  var evidence = makeEvidenceRow(candidate.document_id, 1, defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [evidence] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  assert.deepStrictEqual(defaultEvidence, originalEvidence, 'technical_evidence nao foi mutado');
  assert.deepStrictEqual(defaultOrigin, originalOrigin, 'origin nao foi mutado');
});

// =====================================================================
// G28-B5-D1 — Active Decision Projection Tests
// =====================================================================

test('reader: DECISION_FIELDS inclui id e command_id', async function () {
  var decision = {
    id: 'dec-001', document_id: candidate.document_id, status: 'accepted',
    motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual',
    command_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ativo: true,
  };
  var rt = makeSandbox({ candidatesResult: { data: [candidate] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var decisionsSelect = rt.calls.find(function (c) {
    return c.table === 'document_decisions' && c.method === 'select';
  });
  assert.ok(decisionsSelect, 'decision select chamado');
  assert.ok(decisionsSelect.fields.includes('id'), 'id em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('command_id'), 'command_id em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('document_id'), 'document_id em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('status'), 'status em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('motivo'), 'motivo em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('decidido_em'), 'decidido_em em DECISION_FIELDS');
  assert.ok(decisionsSelect.fields.includes('source'), 'source em DECISION_FIELDS');
});

test('reader: _ravatex_server_decision contem id e command_id', async function () {
  var decision = {
    id: 'dec-001', document_id: candidate.document_id, status: 'accepted',
    motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual',
    command_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ativo: true,
  };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned', ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
  });
  var rt = makeSandbox({ candidatesResult: { data: [candidateWithBase] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.ok(doc._ravatex_server_decision, 'server decision presente');
  assert.equal(doc._ravatex_server_decision.id, 'dec-001');
  assert.equal(doc._ravatex_server_decision.command_id, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(doc._ravatex_server_decision.status, 'accepted');
  assert.equal(doc._ravatex_server_decision.motivo, '');
  assert.ok(doc._ravatex_server_decision.decidido_em);
  assert.equal(doc._ravatex_server_decision.source, 'manual');
});

test('reader: command_id null permanece null na projecao', async function () {
  var decision = {
    id: 'dec-002', document_id: candidate.document_id, status: 'accepted',
    motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual',
    command_id: null, ativo: true,
  };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned', ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
  });
  var rt = makeSandbox({ candidatesResult: { data: [candidateWithBase] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc._ravatex_server_decision.command_id, null);
});

test('reader: decisao sem id (legado) retorna id null na projecao', async function () {
  var decision = {
    document_id: candidate.document_id, status: 'accepted',
    motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual',
    command_id: null, ativo: true,
  };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned', ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
  });
  var rt = makeSandbox({ candidatesResult: { data: [candidateWithBase] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc._ravatex_server_decision.id, null);
});

test('reader: linha historica inativa nao e projetada', async function () {
  var activeDecision = {
    id: 'dec-active', document_id: candidate.document_id, status: 'accepted',
    motivo: null, decidido_em: '2026-07-09T12:00:00.000Z', source: 'manual',
    command_id: 'cmd-active', ativo: true,
  };
  var inactiveDecision = {
    id: 'dec-old', document_id: candidate.document_id, status: 'rejected',
    motivo: 'Versao anterior', decidido_em: '2026-07-08T12:00:00.000Z', source: 'manual',
    command_id: 'cmd-old', ativo: false,
  };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned', ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99',
  });
  var rt = makeSandbox({
    candidatesResult: { data: [candidateWithBase] },
    decisionsResult: { data: [activeDecision, inactiveDecision] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc._ravatex_server_decision.id, 'dec-active');
  assert.equal(doc._ravatex_decision_source, 'server');
});

test('reader: sem decisao ativa _ravatex_server_decision e null', async function () {
  var rt = makeSandbox({ candidatesResult: { data: [candidate] }, decisionsResult: { data: [] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc._ravatex_server_decision, null);
  assert.equal(doc._ravatex_decision_source, null);
});

test('reader: shape antigo permanece intacto com novos campos', async function () {
  var decision = {
    id: 'dec-003', document_id: candidate.document_id, status: 'rejected',
    motivo: 'Documento duplicado', decidido_em: '2026-07-09T12:00:00.000Z', source: 'email',
    command_id: 'cmd-003', ativo: true,
  };
  var candidateWithBase = Object.assign({}, candidate, {
    ingestor_status: 'assigned', ingestor_state_at: '2026-07-09T10:02:00.000Z',
    ingestor_event_id: 'ingevt-assigned-99', ingestor_rejected_reason: null,
  });
  var rt = makeSandbox({ candidatesResult: { data: [candidateWithBase] }, decisionsResult: { data: [decision] } });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var doc = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0];
  assert.equal(doc.status, 'rejected');
  assert.equal(doc.rejected_reason, 'Documento duplicado');
  assert.equal(doc._ravatex_decision_source, 'server');
  assert.equal(doc._ravatex_can_undo_server_decision, true);
  assert.equal(doc._ravatex_server_decision.status, 'rejected');
  assert.equal(doc._ravatex_server_decision.motivo, 'Documento duplicado');
  assert.equal(doc._ravatex_server_decision.source, 'email');
});

// 17. No writes or RPCs (including evidence table)
test('evidence: nenhuma escrita ou RPC mesmo com tabela de evidencia', function () {
  assert.equal(/\.insert\s*\(/.test(READER), false);
  assert.equal(/\.update\s*\(/.test(READER), false);
  assert.equal(/\.delete\s*\(/.test(READER), false);
  assert.equal(/\.upsert\s*\(/.test(READER), false);
  assert.equal(/\.rpc\s*\(/.test(READER), false);
});

// 18. Screen fallback compatibility — tela referencia loadReceivedDocumentsFromSupabase
test('evidence: tela documentoS-recebidos referencia loadReceivedDocumentsFromSupabase para fallback', function () {
  var screenPath = path.join(ROOT, 'js', 'screens', 'documentos-recebidos.js');
  var screenSource = fs.readFileSync(screenPath, 'utf8');
  assert.ok(screenSource.indexOf('loadReceivedDocumentsFromSupabase') >= 0,
    'tela deve referenciar o reader');
  assert.equal(/window\.supa/.test(screenSource), false,
    'tela nao deve criar query Supabase diretamente');
});

// 19. Non-integer evidence_version (string) → invalid, not missing
test('evidence: evidence_version string nao numerica retorna state=invalid com version null', async function () {
  var row = makeEvidenceRow(candidate.document_id, 'abc', defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [row] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.evidenceVersion, null);
  assert.equal(ev.reason, 'invalid_evidence_version');
});

test('evidence: evidence_version float retorna invalid com version null', async function () {
  var row = makeEvidenceRow(candidate.document_id, 1.5, defaultEvidence, defaultOrigin, defaultCreatedAt);
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: [row] },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'invalid');
  assert.equal(ev.evidenceVersion, null);
  assert.equal(ev.reason, 'invalid_evidence_version');
});

// 19b. Malformed version row does not override a valid numeric-current row
test('evidence: linha com versao invalida nao contamina candidato com versao valida', async function () {
  var rows = [
    makeEvidenceRow(candidate.document_id, 'abc', defaultEvidence, defaultOrigin, defaultCreatedAt),
    makeEvidenceRow(candidate.document_id, 2, { hash: 'valid' }, { source: 'ingestor', evidenceVersion: 2 }, '2026-07-10T10:00:00.000Z'),
  ];
  var rt = makeSandbox({
    candidatesResult: { data: [candidate] },
    decisionsResult: { data: [] },
    evidenceResult: { data: rows },
  });
  await rt.ns.loadReceivedDocumentsFromSupabase();
  var ev = rt.sandbox.RAVATEX_DOCUMENTS_RECEIVED[0]._ravatex_technical_evidence;
  assert.equal(ev.state, 'available');
  assert.equal(ev.evidenceVersion, 2);
});

// 20. No second client or production reference
test('evidence: nao cria segundo cliente Supabase nem referencia producao', function () {
  var supabaseFromCount = (READER.match(/window\.supa\.from/g) || []).length;
  // availability guard + candidates + decisions + evidence + link revisions +
  // link revision ops + pedidos status + ops status = 8 read-only reads.
  assert.equal(supabaseFromCount, 8, 'reader usa apenas window.supa.from (leituras canonicas incluindo revisao de vinculo)');
  assert.equal(/createClient/.test(READER), false);
  assert.equal(/production/.test(READER) || /PRODUCTION/.test(READER), false);
  // reader remains read-only: no rpc, no writes.
  assert.equal(/\.rpc\(/.test(READER), false, 'reader nao chama rpc');
});
