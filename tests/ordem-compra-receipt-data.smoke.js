// =====================================================================
// === tests/ordem-compra-receipt-data.smoke.js ========================
// PHASE-C4 (OC-C4-ADMIN-001) — data-layer smokes for the admin receipt UI:
// the native read model loader, the two native writers, the independent
// idempotency-token/attempt-tracker/transport-ambiguity primitives, and the
// pure payload builders. VM-loaded js/screens/ordem-compra-receipt-data.js
// against the shared faithful supa double (single-level .rpc envelope with a
// real `status` axis for transport-ambiguity classification).
//
// Proves, per contract §15: native read-model invocation; NO legacy compat
// RPC in the C4 call graph; allocation-shaped + explicit-excess payloads;
// recebimento_canonico_inativo handled as a deterministic rejection (never a
// crash); ambiguous-transport (status===0) retains the token; a deterministic
// outcome mints a new token; the two trackers are independent.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { makeFakeSupa } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const dataSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'ordem-compra-receipt-data.js'), 'utf8');
// OP-CANONICAL-IDENTITY-REFOUNDATION-R1: `carregarIdentidadesOp` (resolucao do
// mapa op_id -> identidade via public.op_identidade_projecao, db/95) vive no
// dono de dados do MESMO namespace RAVATEX_SCREENS.ordemCompra, entao ele e
// dependencia real deste sandbox.
const ordemDataSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'ordem-compra-data.js'), 'utf8');

function makeSandbox(rpcImpl) {
  const supa = makeFakeSupa({ rpcImpl });
  let uuid = 0;
  const sandbox = {
    console, setTimeout, clearTimeout,
    supa,
    crypto: { randomUUID: () => 'uuid-' + (++uuid) },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: dono central da identidade de OP.
  // Dependencia real do sandbox: os consumidores nao tem fallback proprio.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'op-display.js'), 'utf8'), sandbox, { filename: 'js/op-display.js' });
  vm.runInContext(ordemDataSrc, sandbox, { filename: 'js/screens/ordem-compra-data.js' });
  vm.runInContext(dataSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-data.js' });
  return { sandbox, supa, ns: sandbox.RAVATEX_SCREENS.ordemCompra };
}

test('parseKgInput: pt-BR decimal comma tolerant', () => {
  const { ns } = makeSandbox();
  assert.equal(ns.parseKgInput('183,000'), 183);
  assert.equal(ns.parseKgInput('1.234,5'), 1234.5);
  assert.equal(ns.parseKgInput('12.5'), 12.5);
  assert.equal(ns.parseKgInput('12'), 12);
  assert.equal(ns.parseKgInput('0'), 0);
  assert.ok(Number.isNaN(ns.parseKgInput('')));
  assert.ok(Number.isNaN(ns.parseKgInput(null)));
});

test('buildReceiptLinhas: allocation-shaped + explicit excess, kg<=0 dropped', () => {
  const { ns } = makeSandbox();
  const linhas = ns.buildReceiptLinhas([
    { itemId: 7, destino: 'alocacao', alocacaoId: 42, kg: 10 },
    { itemId: 7, destino: 'excesso', kg: 2.5 },
    { itemId: 9, destino: 'alocacao', alocacaoId: 43, kg: 0 },   // dropped
    { itemId: 9, destino: 'excesso', kg: 0 },                    // dropped
  ]);
  assert.equal(linhas.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(linhas[0])), { item_id: 7, destino: 'alocacao', alocacao_id: 42, kg: 10 });
  // Excess line carries NO alocacao_id key (server rejects an excess line with one).
  assert.deepEqual(JSON.parse(JSON.stringify(linhas[1])), { item_id: 7, destino: 'excesso', kg: 2.5 });
  assert.equal(Object.prototype.hasOwnProperty.call(linhas[1], 'alocacao_id'), false);
});

test('buildReversalLinhas: single lancamento_id line', () => {
  const { ns } = makeSandbox();
  assert.deepEqual(JSON.parse(JSON.stringify(ns.buildReversalLinhas(55, 8))), [{ lancamento_id: 55, kg: 8 }]);
});

test('isReceiptTransportAmbiguous: only error present AND status===0', () => {
  const { ns } = makeSandbox();
  assert.equal(ns.isReceiptTransportAmbiguous({ error: { message: 'x' }, status: 0 }), true);
  assert.equal(ns.isReceiptTransportAmbiguous({ error: null, status: 0 }), false);
  assert.equal(ns.isReceiptTransportAmbiguous({ error: { message: 'x' }, status: 403 }), false);
  assert.equal(ns.isReceiptTransportAmbiguous({ error: { message: 'x' } }), false); // no status
});

test('classifyReceiptWriteResult: success / rejected / hard_failure / ambiguous', () => {
  const { ns } = makeSandbox();
  assert.equal(ns.classifyReceiptWriteResult({ data: { ok: true }, error: null }).outcome, 'success');
  const rej = ns.classifyReceiptWriteResult({ data: { ok: false, codigo: 'excede_alocacao' }, error: null });
  assert.equal(rej.outcome, 'rejected');
  assert.equal(rej.codigo, 'excede_alocacao');
  const hard = ns.classifyReceiptWriteResult({ data: null, error: { code: '42501' }, status: 403 });
  assert.equal(hard.outcome, 'hard_failure');
  assert.equal(ns.classifyReceiptWriteResult({ data: null, error: { message: 'fetch' }, status: 0 }).outcome, 'ambiguous');
});

test('idempotency: same intent reuses token; changed intent / complete() mint a new one', () => {
  const { ns } = makeSandbox();
  const tracker = ns.createReceiptAttemptTracker();
  const a = tracker.resolveAttempt({ ordemId: 1, sig: 'A' });
  const b = tracker.resolveAttempt({ ordemId: 1, sig: 'A' });
  assert.equal(a.token, b.token, 'unchanged intent reuses token');
  const c = tracker.resolveAttempt({ ordemId: 1, sig: 'B' });
  assert.notEqual(b.token, c.token, 'changed intent mints a new token');
  tracker.complete();
  const d = tracker.resolveAttempt({ ordemId: 1, sig: 'B' });
  assert.notEqual(c.token, d.token, 'complete() mints a new token even for identical intent');
});

test('idempotency: two trackers are independent; tokens are unique non-empty strings', () => {
  const { ns } = makeSandbox();
  const t1 = ns.createReceiptAttemptTracker();
  const t2 = ns.createReceiptAttemptTracker();
  const a = t1.resolveAttempt({ ordemId: 1, sig: 'A' });
  const b = t2.resolveAttempt({ ordemId: 1, sig: 'A' });
  assert.notEqual(a.token, b.token, 'independent trackers never share a token');
  assert.equal(typeof a.token, 'string');
  assert.ok(a.token.length > 0);
  assert.notEqual(ns.newReceiptIdempotencyToken(), ns.newReceiptIdempotencyToken());
});

test('loadReceiptHistory: native order invokes the native read model and stores the projection', async () => {
  const projection = { ok: true, codigo: 'ok', ordem_compra_id: 100, acoes: { receber: true, estornar: false }, itens: [], comandos: [] };
  const { sandbox, supa, ns } = makeSandbox({
    obter_historico_recebimento_ordem_compra: () => ({ data: projection, error: null }),
  });
  const state = { ordem: { modelo: 'nativo', status_administrativo: 'emitida' } };
  const rc = await ns.loadReceiptHistory(100, state);
  assert.equal(rc, null);
  assert.equal(state.receiptHistory.ok, true);
  assert.equal(state.receiptHistory.ordem_compra_id, 100);
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'obter_historico_recebimento_ordem_compra');
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls[0].params)), { p_ordem_id: 100 });
});

test('loadReceiptHistory: legacy order renders no section and calls no RPC', async () => {
  const { supa, ns } = makeSandbox();
  const state = { ordem: { modelo: 'legado', status_administrativo: 'emitida' } };
  await ns.loadReceiptHistory(5, state);
  assert.equal(state.receiptHistory, null);
  assert.equal(supa._calls.filter((c) => c.op === 'rpc').length, 0);
});

test('loadReceiptHistory: transport error and business rejection are deterministic (no crash)', async () => {
  const err = makeSandbox({ obter_historico_recebimento_ordem_compra: () => ({ data: null, error: { code: '55000', message: 'x' } }) });
  const s1 = { ordem: { modelo: 'nativo', status_administrativo: 'emitida' } };
  assert.equal(await err.ns.loadReceiptHistory(1, s1), 'erro');
  assert.equal(s1.receiptHistory.ok, false);

  const rej = makeSandbox({ obter_historico_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'sem_permissao' }, error: null }) });
  const s2 = { ordem: { modelo: 'nativo', status_administrativo: 'emitida' } };
  assert.equal(await rej.ns.loadReceiptHistory(1, s2), 'sem_permissao');
  assert.equal(s2.receiptHistory.codigo, 'sem_permissao');
});

test('registrarRecebimento: exact native payload; recebimento_canonico_inativo is a deterministic rejection; no compat RPC', async () => {
  const { supa, ns } = makeSandbox({
    registrar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'recebimento_canonico_inativo', erro: 'inativo' }, error: null }),
  });
  const attempt = { token: 'tok-1' };
  const res = await ns.registrarRecebimento({
    ordemId: 100, ocorridoEm: '2026-07-21', documentoRef: 'NF-1', origemTipo: 'nota_fiscal', origemRef: 'R1',
    linhas: [{ item_id: 7, destino: 'alocacao', alocacao_id: 42, kg: 10 }],
  }, attempt);
  assert.equal(res.outcome, 'rejected');
  assert.equal(res.codigo, 'recebimento_canonico_inativo');
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'registrar_recebimento_ordem_compra');
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls[0].params)), {
    p_ordem_id: 100, p_idempotency_key: 'tok-1', p_ocorrido_em: '2026-07-21',
    p_documento_ref: 'NF-1', p_origem_tipo: 'nota_fiscal', p_origem_ref: 'R1',
    p_linhas: [{ item_id: 7, destino: 'alocacao', alocacao_id: 42, kg: 10 }],
  });
  // No legacy compatibility RPC anywhere in the C4 call graph.
  assert.equal(supa._calls.some((c) => /fio_compat/.test(c.name || '')), false);
});

test('estornarRecebimento: exact native reversal payload (lancamento_id + motivo)', async () => {
  const { supa, ns } = makeSandbox({
    estornar_recebimento_ordem_compra: () => ({ data: { ok: true, codigo: 'ok' }, error: null }),
  });
  const res = await ns.estornarRecebimento({ ordemId: 100, motivo: 'devolução', linhas: [{ lancamento_id: 55, kg: 8 }] }, { token: 'rev-1' });
  assert.equal(res.outcome, 'success');
  const call = supa._calls.filter((c) => c.op === 'rpc')[0];
  assert.equal(call.name, 'estornar_recebimento_ordem_compra');
  assert.deepEqual(JSON.parse(JSON.stringify(call.params)), {
    p_ordem_id: 100, p_idempotency_key: 'rev-1', p_ocorrido_em: null, p_motivo: 'devolução',
    p_linhas: [{ lancamento_id: 55, kg: 8 }],
  });
});
