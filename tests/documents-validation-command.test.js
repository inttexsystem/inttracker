'use strict';

// =====================================================================
// === tests/documents-validation-command.test.js ======================
// Client idempotency lifecycle for the atomic "Validar e vincular" action
// (js/documents-validation-command.js). Two independent command ids
// (link + decision), reused on retry with identical payload.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(ROOT, 'js', 'documents-validation-command.js');
const SRC = fs.readFileSync(MOD_PATH, 'utf8');

function load() {
  const sandbox = { window: {}, console: { log() {}, error() {} } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'documents-validation-command.js' });
  return sandbox.RAVATEX_DOCUMENTS.documentValidationCommand;
}

function makeStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}

function makeOptions() {
  let n = 0;
  return {
    storage: makeStorage(),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0') },
    now: () => 1000,
  };
}

const DOC = 'doc-1';
const PED = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

test('validation-command: arquivo existe e sintaxe valida', function () {
  assert.ok(fs.existsSync(MOD_PATH));
  require('node:child_process').execFileSync(process.execPath, ['--check', MOD_PATH], { stdio: 'pipe' });
});

test('validation-command: nao usa Supabase/rpc/service-role', function () {
  const exec = SRC.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(exec, /Supabase/i);
  assert.doesNotMatch(exec, /\.rpc\(/);
  assert.doesNotMatch(exec, /service_role/i);
});

test('prepare: gera dois command ids distintos e persiste prepared', function () {
  const lc = load();
  const opts = makeOptions();
  const r = lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: PED, opIds: [3, 7] }, opts);
  assert.equal(r.ok, true);
  assert.notEqual(r.envelope.linkCommandId, r.envelope.decisionCommandId);
  assert.equal(r.envelope.state, 'prepared');
  assert.equal(r.envelope.motivo, null, 'accept normaliza motivo');
  assert.deepEqual(JSON.parse(JSON.stringify(r.envelope.opIds)), [3, 7]);
  const pend = lc.getPendingCommand(opts);
  assert.equal(pend.ok, true);
  assert.equal(pend.envelope.linkCommandId, r.envelope.linkCommandId);
});

test('prepare: retry com payload identico reutiliza os mesmos command ids', function () {
  const lc = load();
  const opts = makeOptions();
  const a = lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: PED, opIds: [7, 3] }, opts);
  const b = lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: PED, opIds: [3, 7] }, opts);
  assert.equal(b.reused, true);
  assert.equal(b.envelope.linkCommandId, a.envelope.linkCommandId);
  assert.equal(b.envelope.decisionCommandId, a.envelope.decisionCommandId);
});

test('prepare: payload diferente descarta e gera novos ids', function () {
  const lc = load();
  const opts = makeOptions();
  const a = lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: PED, opIds: [7] }, opts);
  const b = lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: null, opIds: [] }, opts);
  assert.equal(b.reused, false);
  assert.notEqual(b.envelope.linkCommandId, a.envelope.linkCommandId);
});

test('prepare: valida decision, motivo, pedido e expected ids', function () {
  const lc = load();
  assert.equal(lc.prepareCommand({ documentId: DOC, decision: 'x' }, makeOptions()).error, 'invalid_decision');
  assert.equal(lc.prepareCommand({ documentId: DOC, decision: 'rejected', motivo: '  ' }, makeOptions()).error, 'motivo_required');
  assert.equal(lc.prepareCommand({ documentId: DOC, decision: 'accepted', pedidoId: 'nope' }, makeOptions()).error, 'invalid_pedido_id');
  assert.equal(lc.prepareCommand({ documentId: DOC, decision: 'accepted', expectedActiveRevisionId: 'x' }, makeOptions()).error, 'invalid_expected_active_revision_id');
  assert.equal(lc.prepareCommand({ documentId: '', decision: 'accepted' }, makeOptions()).error, 'invalid_document_id');
});

test('prepare: opIds normalizados (dedup, ordenados, inteiros)', function () {
  const lc = load();
  const r = lc.prepareCommand({ documentId: DOC, decision: 'accepted', opIds: [7, 3, 7, '5'] }, makeOptions());
  assert.deepEqual(JSON.parse(JSON.stringify(r.envelope.opIds)), [3, 5, 7]);
});

test('lifecycle: submitting -> uncertain -> resolve limpa o pendente', function () {
  const lc = load();
  const opts = makeOptions();
  const p = lc.prepareCommand({ documentId: DOC, decision: 'accepted', opIds: [] }, opts);
  const id = p.envelope.linkCommandId;
  assert.equal(lc.markSubmitting(id, opts).ok, true);
  assert.equal(lc.markUncertain(id, opts).ok, true);
  // retry: prepare reuses, and markSubmitting is allowed from uncertain
  const again = lc.prepareCommand({ documentId: DOC, decision: 'accepted', opIds: [] }, opts);
  assert.equal(again.reused, true);
  assert.equal(lc.markSubmitting(id, opts).ok, true);
  assert.equal(lc.resolveCommand(id, opts).ok, true);
  assert.equal(lc.getPendingCommand(opts).ok, false);
});

test('lifecycle: discardBeforeSend so no estado prepared', function () {
  const lc = load();
  const opts = makeOptions();
  const p = lc.prepareCommand({ documentId: DOC, decision: 'accepted', opIds: [] }, opts);
  const id = p.envelope.linkCommandId;
  assert.equal(lc.discardBeforeSend(id, opts).ok, true);
  assert.equal(lc.getPendingCommand(opts).ok, false);
});

test('lifecycle: expirado e limpo', function () {
  const lc = load();
  const storage = makeStorage();
  let n = 0;
  const crypto = { randomUUID: () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0') };
  lc.prepareCommand({ documentId: DOC, decision: 'accepted', opIds: [] }, { storage: storage, crypto: crypto, now: () => 1000, ttlMs: 10 });
  const pend = lc.getPendingCommand({ storage: storage, now: () => 2000 });
  assert.equal(pend.ok, false);
  assert.equal(pend.error, 'expired');
});
