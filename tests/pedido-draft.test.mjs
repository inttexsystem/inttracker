// =====================================================================
// === tests/pedido-draft.test.mjs =====================================
// Testes puros (sem DOM, sem Supabase) do dono compartilhado
// js/pedido-draft.js — identidade local de item, totais, validação,
// payload da RPC salvar_pedido_admin, detecção de mudança estrutural e
// de qualquer mudança na coleção.
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
// =====================================================================

import test from 'node:test';
// node:assert (não /strict): loadDraft() roda num vm.Context separado, e
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
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'pedido-draft.js'), 'utf8');

function loadDraft() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'js/pedido-draft.js' });
  return sandbox.window.RAVATEX_PEDIDO_DRAFT;
}

test('js/pedido-draft.js: sintaxe válida (node --check)', () => {
  execSync(`node --check "${path.join(ROOT, 'js', 'pedido-draft.js')}"`, { stdio: 'pipe' });
});

test('novoItem: forma local correta, uid único, itemId null (não persistido)', () => {
  const D = loadDraft();
  const a = D.novoItem({ modeloId: '7', metros: '3.5', observacao: 'obs' });
  const b = D.novoItem();
  assert.equal(a.itemId, null);
  assert.equal(a.modeloId, '7');
  assert.equal(a.metros, '3.5');
  assert.equal(a.observacao, 'obs');
  assert.notEqual(a.uid, b.uid, 'cada item deve receber um uid distinto');
  assert.equal(b.modeloId, '');
  assert.equal(b.itemId, null);
});

test('fromPersisted: converte linhas do banco ordenadas por `ordem`, preserva itemId', () => {
  const D = loadDraft();
  const rows = [
    { id: 'c', modelo_id: 3, metros: '2.00', largura: null, observacao: null, ordem: 2 },
    { id: 'a', modelo_id: 1, metros: '1.00', largura: 1.4, observacao: 'x', ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3.00', largura: null, observacao: '', ordem: 1 },
  ];
  const items = D.fromPersisted(rows);
  assert.deepEqual(items.map((it) => it.itemId), ['a', 'b', 'c'], 'deve ordenar por `ordem`, não pela ordem de chegada');
  assert.equal(items[0].modeloId, '1');
  assert.equal(items[0].metros, '1.00');
  assert.equal(items[0].observacao, 'x');
});

test('addItem/removeItem: colecao ABSOLUTA — devolvem um NOVO array, nunca mutam o original', () => {
  const D = loadDraft();
  const original = D.fromPersisted([{ id: 'a', modelo_id: 1, metros: '1', ordem: 0 }]);
  const added = D.addItem(original, { modeloId: '2', metros: '2' });
  assert.equal(original.length, 1, 'addItem não pode mutar o array original');
  assert.equal(added.length, 2);
  const removed = D.removeItem(added, added[0].uid);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].uid, added[1].uid);
});

test('totals: soma apenas metros finitos e positivos; formata em pt-BR', () => {
  const D = loadDraft();
  const items = [
    D.novoItem({ metros: '1.5' }),
    D.novoItem({ metros: '2.25' }),
    D.novoItem({ metros: 'abc' }),
    D.novoItem({ metros: '-4' }),
  ];
  const t = D.totals(items);
  assert.equal(t.count, 4);
  assert.equal(t.metros, 3.75);
  assert.equal(t.metrosLabel, '3,75 m');
  assert.equal(D.totalMetrosLabel([]), '0,00 m');
});

test('validate: recusa coleção vazia e itens sem modelo ou com metros <= 0', () => {
  const D = loadDraft();
  assert.equal(D.validate([]).valid, false);
  const semModelo = [D.novoItem({ metros: '1' })];
  assert.equal(D.validate(semModelo).valid, false);
  const metrosInvalido = [D.novoItem({ modeloId: '1', metros: '0' })];
  assert.equal(D.validate(metrosInvalido).valid, false);
  const ok = [D.novoItem({ modeloId: '1', metros: '2.5' })];
  assert.equal(D.validate(ok).valid, true);
});

test('toRpcPayload: EXATAMENTE pedido_item_id, modelo_id, metros, observacao, ordem — posição = ordem', () => {
  const D = loadDraft();
  const items = D.fromPersisted([{ id: 'x', modelo_id: 9, metros: '5', ordem: 0 }]);
  items.push(D.novoItem({ modeloId: '10', metros: '1', observacao: '' }));
  const payload = D.toRpcPayload(items);
  assert.equal(payload.length, 2);
  assert.deepEqual(Object.keys(payload[0]).sort(), ['metros', 'modelo_id', 'observacao', 'ordem', 'pedido_item_id'].sort());
  assert.equal(payload[0].pedido_item_id, 'x');
  assert.equal(payload[0].modelo_id, 9);
  assert.equal(payload[0].ordem, 0);
  assert.equal(payload[1].pedido_item_id, null, 'item novo deve viajar com pedido_item_id null');
  assert.equal(payload[1].observacao, null, 'observação vazia normaliza para null');
  assert.equal(payload[1].ordem, 1, 'ordem é a POSIÇÃO no array, não um campo do item local');
});

test('isStructuralChange: espelha public.pedido_itens_payload_e_estrutural — só modelo/metros/inserção/remoção', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3', ordem: 1 },
  ]);

  // Reordenação pura: NÃO é estrutural.
  const reordered = [baseline[1], baseline[0]];
  assert.equal(D.isStructuralChange(reordered, baseline), false, 'reordenar itens não é mudança estrutural');

  // Observação mudou: NÃO é estrutural.
  const obsChanged = baseline.map((it) => ({ ...it }));
  obsChanged[0].observacao = 'nova observação';
  assert.equal(D.isStructuralChange(obsChanged, baseline), false, 'mudar observação não é mudança estrutural');

  // modelo_id mudou: É estrutural.
  const modeloChanged = baseline.map((it) => ({ ...it }));
  modeloChanged[0].modeloId = '99';
  assert.equal(D.isStructuralChange(modeloChanged, baseline), true, 'trocar modelo é mudança estrutural');

  // metros mudou: É estrutural.
  const metrosChanged = baseline.map((it) => ({ ...it }));
  metrosChanged[0].metros = '7';
  assert.equal(D.isStructuralChange(metrosChanged, baseline), true, 'trocar metros é mudança estrutural');

  // Inserção: É estrutural.
  const inserted = baseline.concat([D.novoItem({ modeloId: '3', metros: '1' })]);
  assert.equal(D.isStructuralChange(inserted, baseline), true, 'adicionar item é mudança estrutural');

  // Remoção: É estrutural.
  const removed = [baseline[0]];
  assert.equal(D.isStructuralChange(removed, baseline), true, 'remover item é mudança estrutural');
});

test('isCollectionChanged: detecta QUALQUER diferença (ordem, observação, contagem) para a decisão p_itens=NULL', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', observacao: null, ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3', observacao: null, ordem: 1 },
  ]);
  const identical = baseline.map((it) => ({ ...it }));
  assert.equal(D.isCollectionChanged(identical, baseline), false, 'cópia idêntica não deve disparar mudança');

  const reordered = [baseline[1], baseline[0]];
  assert.equal(D.isCollectionChanged(reordered, baseline), true, 'reordenar É mudança de coleção (embora não seja estrutural)');

  const obsChanged = baseline.map((it) => ({ ...it }));
  obsChanged[1].observacao = 'algo';
  assert.equal(D.isCollectionChanged(obsChanged, baseline), true, 'mudar observação É mudança de coleção');

  assert.equal(D.isCollectionChanged(baseline, baseline), false);
});
