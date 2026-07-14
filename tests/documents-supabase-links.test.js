'use strict';

// =====================================================================
// === tests/documents-supabase-links.test.js ==========================
// Unit do adapter de vinculos canonicos (js/documents-supabase-links.js).
// registerDocumentLinksInCloud    -> registrar_vinculos_documento
// applyDocumentValidationInCloud  -> registrar_decisao_e_vinculos_documento
// loadActiveDocumentLinkRevision / loadLinkableTargets (read-only)
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const LINKS_PATH = path.join(ROOT, 'js', 'documents-supabase-links.js');
const LINKS = fs.readFileSync(LINKS_PATH, 'utf8');

const DOC_ID = 'doc-abc';
const CMD_A = '11111111-1111-4111-8111-111111111111';
const CMD_B = '22222222-2222-4222-8222-222222222222';
const PED = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';
const REV = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeBuilder(result) {
  const builder = {
    select: function () { return builder; },
    eq: function () { return builder; },
    in: function () { return builder; },
    limit: function () { return builder; },
    order: function () { return builder; },
    then: function (onF, onR) { return Promise.resolve(result).then(onF, onR); },
    catch: function (onR) { return Promise.resolve(result).catch(onR); },
  };
  return builder;
}

function makeSandbox(options) {
  options = options || {};
  const calls = [];
  const fromCalls = [];
  const sandbox = { window: {}, console: { log: function () {}, error: function () {} } };
  sandbox.window = sandbox;
  if (options.withSupa !== false) {
    sandbox.supa = {
      rpc: function (fn, params) {
        calls.push({ fn: fn, params: params });
        if (typeof options.rpcImpl === 'function') return options.rpcImpl(fn, params);
        return Promise.resolve(options.rpcResult || { data: { ok: true, outcome: 'created' } });
      },
      from: function (table) {
        fromCalls.push(table);
        const res = options.tableResults && options.tableResults[table];
        return makeBuilder(res || { data: [] });
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(LINKS, sandbox, { filename: 'documents-supabase-links.js' });
  return { sandbox: sandbox, calls: calls, fromCalls: fromCalls, ns: sandbox.RAVATEX_DOCUMENTS };
}

test('links: arquivo existe e sintaxe valida', function () {
  assert.ok(fs.existsSync(LINKS_PATH));
  require('node:child_process').execFileSync(process.execPath, ['--check', LINKS_PATH], { stdio: 'pipe' });
});

test('links: exporta exatamente os quatro pontos de entrada', function () {
  const rt = makeSandbox({ withSupa: false });
  const fns = Object.keys(rt.ns).filter(function (k) { return typeof rt.ns[k] === 'function'; });
  assert.ok(fns.includes('registerDocumentLinksInCloud'));
  assert.ok(fns.includes('applyDocumentValidationInCloud'));
  assert.ok(fns.includes('loadActiveDocumentLinkRevision'));
  assert.ok(fns.includes('loadLinkableTargets'));
});

test('links: codigo executavel nao usa localStorage, service-role, alias legado', function () {
  const exec = LINKS.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(exec, /localStorage/i);
  assert.doesNotMatch(exec, /service_role|serviceRole/i);
  assert.doesNotMatch(exec, /decidir_documento/i);
});

test('register: supabase_unavailable sem supa', async function () {
  const rt = makeSandbox({ withSupa: false });
  const r = await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A, opIds: [] });
  assert.deepEqual(plain(r), { ok: false, error: 'supabase_unavailable' });
});

test('register: valida document_id, command_id, pedido_id, op_ids, expected', async function () {
  const rt = makeSandbox();
  assert.equal((await rt.ns.registerDocumentLinksInCloud({ commandId: CMD_A })).error, 'document_id_required');
  assert.equal((await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID })).error, 'command_id_required');
  assert.equal((await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A, pedidoId: 'nope' })).error, 'invalid_pedido_id');
  assert.equal((await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A, opIds: [1, 'x'] })).error, 'invalid_op_ids');
  assert.equal((await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A, opIds: [], expectedActiveRevisionId: 'x' })).error, 'invalid_expected_active_revision_id');
});

test('register: happy path chama registrar_vinculos_documento com params normalizados', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'created', revision_id: REV } } });
  const r = await rt.ns.registerDocumentLinksInCloud({
    documentId: '  ' + DOC_ID + '  ', commandId: CMD_A, pedidoId: PED, opIds: [5, 3], expectedActiveRevisionId: null,
  });
  assert.equal(r.ok, true);
  assert.equal(r.outcome, 'created');
  assert.equal(rt.calls[0].fn, 'registrar_vinculos_documento');
  assert.deepEqual(plain(rt.calls[0].params), {
    p_document_id: DOC_ID,
    p_pedido_id: PED,
    p_op_ids: [5, 3],
    p_command_id: CMD_A,
    p_expected_active_revision_id: null,
  });
});

test('register: pedido nulo e op_ids vazio permitido (estado explicito vazio)', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'created' } } });
  const r = await rt.ns.registerDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A, pedidoId: null, opIds: [] });
  assert.equal(r.ok, true);
  assert.equal(rt.calls[0].params.p_pedido_id, null);
  assert.deepEqual(plain(rt.calls[0].params.p_op_ids), []);
});

test('apply: valida decisao, motivo, command ids distintos', async function () {
  const rt = makeSandbox();
  assert.equal((await rt.ns.applyDocumentValidationInCloud({ documentId: DOC_ID, decision: 'x' })).error, 'invalid_decision');
  assert.equal((await rt.ns.applyDocumentValidationInCloud({ documentId: DOC_ID, decision: 'rejected', motivo: ' ' })).error, 'motivo_required');
  assert.equal((await rt.ns.applyDocumentValidationInCloud({ documentId: DOC_ID, decision: 'accepted', linkCommandId: 'x' })).error, 'link_command_id_required');
  assert.equal((await rt.ns.applyDocumentValidationInCloud({ documentId: DOC_ID, decision: 'accepted', linkCommandId: CMD_A })).error, 'decision_command_id_required');
  assert.equal((await rt.ns.applyDocumentValidationInCloud({ documentId: DOC_ID, decision: 'accepted', linkCommandId: CMD_A, decisionCommandId: CMD_A })).error, 'command_ids_must_differ');
});

test('apply: happy path atomico chama registrar_decisao_e_vinculos_documento com 9 params', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'applied' } } });
  const r = await rt.ns.applyDocumentValidationInCloud({
    documentId: DOC_ID, pedidoId: PED, opIds: [7], linkCommandId: CMD_A,
    expectedActiveRevisionId: null, decision: 'accepted', motivo: 'ignored on accept',
    decisionCommandId: CMD_B, expectedActiveDecisionId: null,
  });
  assert.equal(r.ok, true);
  assert.equal(rt.calls[0].fn, 'registrar_decisao_e_vinculos_documento');
  assert.deepEqual(plain(rt.calls[0].params), {
    p_document_id: DOC_ID,
    p_pedido_id: PED,
    p_op_ids: [7],
    p_link_command_id: CMD_A,
    p_expected_active_revision_id: null,
    p_decision: 'accepted',
    p_motivo: null,
    p_decision_command_id: CMD_B,
    p_expected_active_decision_id: null,
  });
});

test('apply: rejeicao preserva motivo trimmed', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true } } });
  await rt.ns.applyDocumentValidationInCloud({
    documentId: DOC_ID, opIds: [], linkCommandId: CMD_A, decision: 'rejected',
    motivo: '  documento ilegivel  ', decisionCommandId: CMD_B,
  });
  assert.equal(rt.calls[0].params.p_decision, 'rejected');
  assert.equal(rt.calls[0].params.p_motivo, 'documento ilegivel');
});

test('loadActiveDocumentLinkRevision: retorna revisao ativa com op_ids', async function () {
  const rt = makeSandbox({
    tableResults: {
      document_link_revisions: { data: [{ id: REV, document_id: DOC_ID, pedido_id: PED, version: 2, active: true }] },
      document_link_revision_ops: { data: [{ op_id: 7 }, { op_id: 3 }] },
    },
  });
  const r = await rt.ns.loadActiveDocumentLinkRevision(DOC_ID);
  assert.equal(r.ok, true);
  assert.equal(r.revision.revision_id, REV);
  assert.equal(r.revision.pedido_id, PED);
  assert.deepEqual(plain(r.revision.op_ids), [7, 3]);
});

test('loadActiveDocumentLinkRevision: null quando nao ha revisao ativa', async function () {
  const rt = makeSandbox({ tableResults: { document_link_revisions: { data: [] } } });
  const r = await rt.ns.loadActiveDocumentLinkRevision(DOC_ID);
  assert.equal(r.ok, true);
  assert.equal(r.revision, null);
});

test('loadLinkableTargets: mapeia pedido canonico da OP via lote', async function () {
  const rt = makeSandbox({
    tableResults: {
      pedidos: { data: [{ id: PED, numero: 25, status: 'confirmado' }] },
      ops: { data: [
        { id: 7, numero: 3, ano: 2026, tipo: 'latex', status: 'em_producao', lote_id: 9, lotes: { pedido_id: PED } },
        { id: 8, numero: 4, ano: 2026, tipo: 'tecelagem', status: 'aberta', lote_id: null, lotes: null },
      ] },
    },
  });
  const r = await rt.ns.loadLinkableTargets();
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.pedidos), [{ id: PED, numero: 25, status: 'confirmado' }]);
  assert.equal(r.ops[0].pedido_id, PED);
  assert.equal(r.ops[1].pedido_id, null);
});
