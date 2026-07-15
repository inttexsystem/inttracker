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

test('links: exporta os pontos de entrada canonicos (B6 + B8)', function () {
  const rt = makeSandbox({ withSupa: false });
  const fns = Object.keys(rt.ns).filter(function (k) { return typeof rt.ns[k] === 'function'; });
  // B6 writers/readers
  assert.ok(fns.includes('registerDocumentLinksInCloud'));
  assert.ok(fns.includes('applyDocumentValidationInCloud'));
  assert.ok(fns.includes('loadActiveDocumentLinkRevision'));
  assert.ok(fns.includes('loadLinkableTargets'));
  // B8 writer/reader
  assert.ok(fns.includes('restoreDocumentLinksInCloud'));
  assert.ok(fns.includes('loadDocumentLinkRevisionHistory'));
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

// ---------------------------------------------------------------------
// B8 — correction/revocation reason on register; restore writer; history read
// ---------------------------------------------------------------------
const REV2 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const REV3 = 'cccccccc-3333-4333-8333-cccccccccccc';

test('register (correcao): sem reason envia exatamente os cinco params B6', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'updated' } } });
  await rt.ns.registerDocumentLinksInCloud({
    documentId: DOC_ID, commandId: CMD_A, pedidoId: PED, opIds: [3], expectedActiveRevisionId: REV,
  });
  assert.deepEqual(Object.keys(rt.calls[0].params).sort(), [
    'p_command_id', 'p_document_id', 'p_expected_active_revision_id', 'p_op_ids', 'p_pedido_id',
  ]);
});

test('register (correcao): reason presente adiciona p_reason (trimmed)', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'updated' } } });
  const r = await rt.ns.registerDocumentLinksInCloud({
    documentId: DOC_ID, commandId: CMD_A, pedidoId: PED, opIds: [3],
    expectedActiveRevisionId: REV, reason: '  pedido errado  ',
  });
  assert.equal(r.ok, true);
  assert.equal(rt.calls[0].params.p_reason, 'pedido errado');
  assert.equal(rt.calls[0].params.p_expected_active_revision_id, REV);
});

test('register (revogacao): pedido null + op vazio + reason = unlink explicito', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'updated' } } });
  await rt.ns.registerDocumentLinksInCloud({
    documentId: DOC_ID, commandId: CMD_A, pedidoId: null, opIds: [],
    expectedActiveRevisionId: REV, reason: 'documento nao pertence a este pedido',
  });
  assert.equal(rt.calls[0].params.p_pedido_id, null);
  assert.deepEqual(plain(rt.calls[0].params.p_op_ids), []);
  assert.equal(rt.calls[0].params.p_reason, 'documento nao pertence a este pedido');
});

test('restore: supabase_unavailable sem supa', async function () {
  const rt = makeSandbox({ withSupa: false });
  const r = await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, sourceRevisionId: REV, commandId: CMD_A });
  assert.deepEqual(plain(r), { ok: false, error: 'supabase_unavailable' });
});

test('restore: valida document_id, source_revision_id, command_id, expected', async function () {
  const rt = makeSandbox();
  assert.equal((await rt.ns.restoreDocumentLinksInCloud({ sourceRevisionId: REV, commandId: CMD_A })).error, 'document_id_required');
  assert.equal((await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, commandId: CMD_A })).error, 'source_revision_id_required');
  assert.equal((await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, sourceRevisionId: 'nope', commandId: CMD_A })).error, 'source_revision_id_required');
  assert.equal((await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, sourceRevisionId: REV })).error, 'command_id_required');
  assert.equal((await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, sourceRevisionId: REV, commandId: CMD_A, expectedActiveRevisionId: 'x' })).error, 'invalid_expected_active_revision_id');
});

test('restore: happy path chama restaurar_vinculos_documento com params', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'updated', restored_from_revision_id: REV } } });
  const r = await rt.ns.restoreDocumentLinksInCloud({
    documentId: '  ' + DOC_ID + '  ', sourceRevisionId: REV, commandId: CMD_A,
    expectedActiveRevisionId: REV2, reason: '  restaurar v2  ',
  });
  assert.equal(r.ok, true);
  assert.equal(r.outcome, 'updated');
  assert.equal(rt.calls[0].fn, 'restaurar_vinculos_documento');
  assert.deepEqual(plain(rt.calls[0].params), {
    p_document_id: DOC_ID,
    p_source_revision_id: REV,
    p_command_id: CMD_A,
    p_expected_active_revision_id: REV2,
    p_reason: 'restaurar v2',
  });
});

test('restore: sem reason omite p_reason', async function () {
  const rt = makeSandbox({ rpcResult: { data: { ok: true, outcome: 'created' } } });
  await rt.ns.restoreDocumentLinksInCloud({ documentId: DOC_ID, sourceRevisionId: REV, commandId: CMD_A });
  assert.equal(Object.prototype.hasOwnProperty.call(rt.calls[0].params, 'p_reason'), false);
  assert.equal(rt.calls[0].params.p_expected_active_revision_id, null);
});

test('loadDocumentLinkRevisionHistory: supabase_unavailable / document_id_required', async function () {
  const noSupa = makeSandbox({ withSupa: false });
  assert.equal((await noSupa.ns.loadDocumentLinkRevisionHistory(DOC_ID)).error, 'supabase_unavailable');
  const rt = makeSandbox();
  assert.equal((await rt.ns.loadDocumentLinkRevisionHistory('   ')).error, 'document_id_required');
});

test('loadDocumentLinkRevisionHistory: revisoes com op_ids agrupados e campos de auditoria', async function () {
  const rt = makeSandbox({
    tableResults: {
      document_link_revisions: { data: [
        { id: REV3, document_id: DOC_ID, pedido_id: PED, version: 3, active: true, command_id: CMD_A,
          created_by: 'user-1', created_at: '2026-07-14T03:00:00Z', revoked_by: null, revoked_at: null,
          revocation_reason: null, restored_from_revision_id: REV },
        { id: REV2, document_id: DOC_ID, pedido_id: null, version: 2, active: false, command_id: CMD_B,
          created_by: 'user-1', created_at: '2026-07-14T02:00:00Z', revoked_by: 'user-1',
          revoked_at: '2026-07-14T03:00:00Z', revocation_reason: 'corrigido', restored_from_revision_id: null },
      ] },
      document_link_revision_ops: { data: [
        { revision_id: REV3, op_id: 7 }, { revision_id: REV3, op_id: 3 },
      ] },
    },
  });
  const r = await rt.ns.loadDocumentLinkRevisionHistory(DOC_ID);
  assert.equal(r.ok, true);
  assert.equal(r.revisions.length, 2);
  assert.equal(r.revisions[0].version, 3);
  assert.equal(r.revisions[0].active, true);
  assert.equal(r.revisions[0].restored_from_revision_id, REV);
  assert.deepEqual(plain(r.revisions[0].op_ids), [3, 7]);
  assert.equal(r.revisions[1].revocation_reason, 'corrigido');
  assert.deepEqual(plain(r.revisions[1].op_ids), []);
});

test('loadDocumentLinkRevisionHistory: fail-closed em erro de query (nunca vazio silencioso)', async function () {
  const rt = makeSandbox({
    tableResults: { document_link_revisions: { error: { message: 'boom' } } },
  });
  const r = await rt.ns.loadDocumentLinkRevisionHistory(DOC_ID);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'boom');
});

test('loadDocumentLinkRevisionHistory: sem revisoes retorna lista vazia ok', async function () {
  const rt = makeSandbox({ tableResults: { document_link_revisions: { data: [] } } });
  const r = await rt.ns.loadDocumentLinkRevisionHistory(DOC_ID);
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.revisions), []);
});

test('history/restore: codigo executavel permanece sem localStorage/service-role/legado', function () {
  const exec = LINKS.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(exec, /localStorage/i);
  assert.doesNotMatch(exec, /service_role|serviceRole/i);
  assert.doesNotMatch(exec, /decidir_documento/i);
});
