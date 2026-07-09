'use strict';

// =====================================================================
// === tests/documents-supabase-decisions.test.js ======================
// Unit do wrapper RAVATEX_DOCUMENTS.decideDocumentInCloud
// (js/documents-supabase-decisions.js).
//
// Fase: RAVATEX-DOCUMENTS-G23-D-B-CLOUD-DOCUMENT-DECISIONS-PATCH
// Garante o contrato da RPC public.decidir_documento sem Supabase real:
//   - guards (supabase_unavailable / document_id_required /
//     invalid_status / motivo_required);
//   - chamada rpc('decidir_documento', {p_document_id,p_status,p_motivo});
//   - r.data preservado (le r.data.error, chave `error` nao `erro`);
//   - r.error PostgREST vira ok:false; throw vira network;
//   - sem .from()/writes diretos/service_role; so rpc('decidir_documento').
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DECISIONS_PATH = path.join(ROOT, 'js', 'documents-supabase-decisions.js');
const DECISIONS = fs.readFileSync(DECISIONS_PATH, 'utf8');

const DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

// Objetos criados dentro do vm.Context tem outro Object.prototype; o
// deepEqual estrito exige prototipo reference-equal. Normaliza via JSON.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSandbox(options) {
  options = options || {};
  const calls = [];
  const sandbox = { window: {}, console: {} };
  sandbox.window = sandbox;
  if (options.withSupa !== false) {
    sandbox.supa = {
      rpc: function (fn, params) {
        calls.push({ fn: fn, params: params });
        if (typeof options.rpcImpl === 'function') return options.rpcImpl(fn, params);
        return Promise.resolve(options.rpcResult || { data: { ok: true } });
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(DECISIONS, sandbox, { filename: 'documents-supabase-decisions.js' });
  return { sandbox: sandbox, calls: calls, ns: sandbox.RAVATEX_DOCUMENTS };
}

test('decisions: arquivo existe e sintaxe valida', function () {
  assert.ok(fs.existsSync(DECISIONS_PATH));
  require('node:child_process').execFileSync(process.execPath, ['--check', DECISIONS_PATH], { stdio: 'pipe' });
});

test('decisions: expoe decideDocumentInCloud no namespace', function () {
  const rt = makeSandbox({ withSupa: false });
  assert.equal(typeof rt.ns.decideDocumentInCloud, 'function');
  assert.equal(typeof rt.ns.undoDocumentDecisionInCloud, 'function');
});

test('decisions: sem supa retorna supabase_unavailable', async function () {
  const rt = makeSandbox({ withSupa: false });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.deepEqual(plain(result), { ok: false, error: 'supabase_unavailable' });
});

test('decisions: supa sem rpc retorna supabase_unavailable', async function () {
  const rt = makeSandbox({ withSupa: false });
  rt.sandbox.supa = { from: function () {} };
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.deepEqual(plain(result), { ok: false, error: 'supabase_unavailable' });
});

test('decisions: documentId ausente retorna document_id_required e nao chama rpc', async function () {
  const rt = makeSandbox({});
  const result = await rt.ns.decideDocumentInCloud('   ', 'accepted', null);
  assert.deepEqual(plain(result), { ok: false, error: 'document_id_required' });
  assert.equal(rt.calls.length, 0);
});

test('decisions: status invalido retorna invalid_status e nao chama rpc', async function () {
  const rt = makeSandbox({});
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'foo', null);
  assert.deepEqual(plain(result), { ok: false, error: 'invalid_status' });
  assert.equal(rt.calls.length, 0);
});

test('decisions: rejected sem motivo retorna motivo_required e nao chama rpc', async function () {
  const rt = makeSandbox({});
  const vazio = await rt.ns.decideDocumentInCloud(DOC_ID, 'rejected', '   ');
  assert.deepEqual(plain(vazio), { ok: false, error: 'motivo_required' });
  const nulo = await rt.ns.decideDocumentInCloud(DOC_ID, 'rejected', null);
  assert.deepEqual(plain(nulo), { ok: false, error: 'motivo_required' });
  assert.equal(rt.calls.length, 0);
});

test('decisions: accepted usa rpc decidir_documento com p_motivo null', async function () {
  const rt = makeSandbox({
    rpcResult: { data: { ok: true, status: 'accepted', decision_id: 'd1', candidate_updated: true } },
  });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.equal(result.ok, true);
  assert.equal(result.candidate_updated, true);
  assert.equal(rt.calls.length, 1);
  assert.equal(rt.calls[0].fn, 'decidir_documento');
  assert.deepEqual(plain(rt.calls[0].params), {
    p_document_id: DOC_ID, p_status: 'accepted', p_motivo: null,
  });
});

test('decisions: rejected envia motivo trimmed', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, status: 'rejected' } } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'rejected', '  Arquivo ilegivel  ');
  assert.equal(result.ok, true);
  assert.deepEqual(plain(rt.calls[0].params), {
    p_document_id: DOC_ID, p_status: 'rejected', p_motivo: 'Arquivo ilegivel',
  });
});

test('decisions: undo usa rpc desfazer_decisao_documento com motivo trimmed', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, restored_status: 'assigned' } } });
  const result = await rt.ns.undoDocumentDecisionInCloud(DOC_ID, '  Reabertura conferida  ');
  assert.equal(result.ok, true);
  assert.deepEqual(plain(rt.calls[0]), {
    fn: 'desfazer_decisao_documento',
    params: { p_document_id: DOC_ID, p_motivo: 'Reabertura conferida' },
  });
});

test('decisions: undo sem motivo envia null e id ausente nao chama rpc', async function () {
  const rt = makeSandbox({});
  const missing = await rt.ns.undoDocumentDecisionInCloud(' ', null);
  assert.deepEqual(plain(missing), { ok: false, error: 'document_id_required' });
  assert.equal(rt.calls.length, 0);
  await rt.ns.undoDocumentDecisionInCloud(DOC_ID, '   ');
  assert.deepEqual(plain(rt.calls[0].params), { p_document_id: DOC_ID, p_motivo: null });
});

test('decisions: undo preserva erros retornados pela RPC', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: false, error: 'base_status_unavailable' } } });
  const result = await rt.ns.undoDocumentDecisionInCloud(DOC_ID, null);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'base_status_unavailable');
});

test('decisions: admin_required em r.data.error e preservado', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: false, error: 'admin_required' } } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'admin_required');
});

test('decisions: motivo_required do servidor em r.data.error e preservado (rpc chamada)', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: false, error: 'motivo_required' } } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'rejected', 'motivo enviado');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'motivo_required');
  assert.equal(rt.calls.length, 1);
});

test('decisions: r.error PostgREST vira ok:false com message', async function () {
  const rt = makeSandbox({ rpcResult: { error: { message: 'permission denied for function decidir_documento' } } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'permission denied for function decidir_documento');
});

test('decisions: r.error sem message cai em supabase_error', async function () {
  const rt = makeSandbox({ rpcResult: { error: {} } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'supabase_error');
});

test('decisions: promise rejeitada vira network', async function () {
  const rt = makeSandbox({ rpcImpl: function () { return Promise.reject(new Error('boom')); } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.deepEqual(plain(result), { ok: false, error: 'network' });
});

test('decisions: throw sincrono na rpc vira network', async function () {
  const rt = makeSandbox({ rpcImpl: function () { throw new Error('sync boom'); } });
  const result = await rt.ns.decideDocumentInCloud(DOC_ID, 'accepted', null);
  assert.deepEqual(plain(result), { ok: false, error: 'network' });
});

test('decisions: nao contem .from(), writes diretos nem service_role', function () {
  assert.equal(/\.from\s*\(/.test(DECISIONS), false, '.from( presente');
  assert.equal(/\.insert\s*\(/.test(DECISIONS), false, '.insert( presente');
  assert.equal(/\.update\s*\(/.test(DECISIONS), false, '.update( presente');
  assert.equal(/\.delete\s*\(/.test(DECISIONS), false, '.delete( presente');
  assert.equal(/\.upsert\s*\(/.test(DECISIONS), false, '.upsert( presente');
  assert.equal(/service_role/.test(DECISIONS), false, 'service_role presente');
  assert.equal(/localStorage/.test(DECISIONS), false, 'localStorage presente');
});

test('decisions: usa apenas as RPCs de decidir e desfazer', function () {
  const rpcNames = Array.from(DECISIONS.matchAll(/\.rpc\s*\(\s*['"]([^'"]+)['"]/g)).map((m) => m[1]);
  assert.deepEqual(rpcNames, ['decidir_documento', 'desfazer_decisao_documento']);
});
