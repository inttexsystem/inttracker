// =====================================================================
// === tests/pedido-fields.test.mjs ====================================
// Testes puros (sem DOM, sem Supabase) do dono compartilhado
// js/pedido-fields.js — estado de campos gerais do Pedido, normalização,
// comparação suja e construção do payload `p_header` da RPC
// salvar_pedido_admin.
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
// =====================================================================

import test from 'node:test';
// node:assert (não /strict): loadFields() roda num vm.Context separado, e
// deepStrictEqual recusa arrays/objetos de outro realm por prototype
// mismatch mesmo com estrutura idêntica ("same structure but are not
// reference-equal"). deepEqual (estrutural) é a comparação correta aqui.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'pedido-fields.js'), 'utf8');

function loadFields() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'js/pedido-fields.js' });
  return sandbox.window.RAVATEX_PEDIDO_FIELDS;
}

test('js/pedido-fields.js: sintaxe válida (node --check)', () => {
  execSync(`node --check "${path.join(ROOT, 'js', 'pedido-fields.js')}"`, { stdio: 'pipe' });
});

test('ADMIN_HEADER_KEYS espelha exatamente public.pedido_header_validar(papel=admin) — numero e status NUNCA entram', () => {
  const F = loadFields();
  assert.deepEqual(F.ADMIN_HEADER_KEYS,
    ['cliente_id', 'data_pedido', 'prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao']);
  assert.ok(!F.ADMIN_HEADER_KEYS.includes('numero'));
  assert.ok(!F.ADMIN_HEADER_KEYS.includes('status'));
});

test('TIPO_RECEBIMENTO_OPTIONS é o domínio real (CHECK pedidos_tipo_recebimento_check): retirada | entrega', () => {
  const F = loadFields();
  assert.deepEqual(F.TIPO_RECEBIMENTO_OPTIONS.map((o) => o.value), ['retirada', 'entrega']);
});

test('fromPersisted: mapeia a linha do banco para o estado local; numero/status ficam de fora', () => {
  const F = loadFields();
  const fields = F.fromPersisted({
    cliente_id: 42, data_pedido: '2026-07-29', prazo_entrega: '2026-08-10',
    referencia_cliente: 'PO-1', tipo_recebimento: 'entrega', observacao: 'obs',
    numero: 7, status: 'confirmado',
  });
  assert.deepEqual(fields, {
    clienteId: '42', dataPedido: '2026-07-29', prazoEntrega: '2026-08-10',
    referenciaCliente: 'PO-1', tipoRecebimento: 'entrega', observacao: 'obs',
  });
});

test('isDirty / buildHeaderPayload: null quando nada mudou (EXECUTION ORDER sec.10.1)', () => {
  const F = loadFields();
  const baseline = F.fromPersisted({ cliente_id: 1, data_pedido: '2026-07-01', prazo_entrega: null, referencia_cliente: null, tipo_recebimento: null, observacao: null });
  const same = { ...baseline };
  assert.equal(F.isDirty(same, baseline), false);
  assert.equal(F.buildHeaderPayload(same, baseline), null);
});

test('buildHeaderPayload: só as chaves que mudaram, com valores normalizados (vazio -> null, cliente_id -> number)', () => {
  const F = loadFields();
  const baseline = F.fromPersisted({ cliente_id: 1, data_pedido: '2026-07-01', prazo_entrega: null, referencia_cliente: null, tipo_recebimento: null, observacao: null });
  const current = { ...baseline, clienteId: '2', referenciaCliente: '  PO-9  ', observacao: '   ' };
  const payload = F.buildHeaderPayload(current, baseline);
  assert.deepEqual(payload, { cliente_id: 2, referencia_cliente: 'PO-9' },
    'observacao só-espaços deve normalizar para o MESMO null da baseline e não entrar no payload');
  assert.equal(F.isDirty(current, baseline), true);
});

test('buildHeaderPayload: string vazia normaliza para null e conta como mudança quando a baseline não era null', () => {
  const F = loadFields();
  const baseline = F.fromPersisted({ cliente_id: 1, data_pedido: '2026-07-01', prazo_entrega: '2026-08-01', referencia_cliente: 'X', tipo_recebimento: 'retirada', observacao: 'Y' });
  const current = { ...baseline, prazoEntrega: '', referenciaCliente: '', tipoRecebimento: '', observacao: '' };
  const payload = F.buildHeaderPayload(current, baseline);
  assert.deepEqual(payload, { prazo_entrega: null, referencia_cliente: null, tipo_recebimento: null, observacao: null });
});

test('validate: exige cliente e data do pedido', () => {
  const F = loadFields();
  assert.equal(F.validate({ clienteId: '', dataPedido: '2026-07-01' }).valid, false);
  assert.equal(F.validate({ clienteId: '1', dataPedido: '' }).valid, false);
  assert.equal(F.validate({ clienteId: '1', dataPedido: '2026-07-01' }).valid, true);
});

test('capabilities(admin): numero/status somente-leitura; capabilities(cliente) projeção adiada (sem campos editáveis nesta fase)', () => {
  const F = loadFields();
  const admin = F.capabilities('admin');
  assert.deepEqual(admin.readOnlyFields, ['numero', 'status']);
  assert.deepEqual(admin.editableHeaderFields, F.ADMIN_HEADER_KEYS);
  const cliente = F.capabilities('cliente');
  assert.deepEqual(cliente.editableHeaderFields, []);
});
