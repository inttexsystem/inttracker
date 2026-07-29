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

test('isCollectionChanged: detecta ordem e contagem para a decisão p_itens=NULL', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', observacao: null, ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3', observacao: null, ordem: 1 },
  ]);
  const identical = baseline.map((it) => ({ ...it }));
  assert.equal(D.isCollectionChanged(identical, baseline), false, 'cópia idêntica não deve disparar mudança');

  const reordered = [baseline[1], baseline[0]];
  assert.equal(D.isCollectionChanged(reordered, baseline), true, 'reordenar É mudança de coleção (embora não seja estrutural)');

  assert.equal(D.isCollectionChanged(baseline, baseline), false);
});

// PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: `observacao` SAIU da comparação de
// isCollectionChanged. A administrativa não cria nem edita mais
// item.observacao (retirado da linha e do modal), então mudar esse campo
// sozinho NÃO pode mais ser o motivo de p_itens ser enviado — mesmo que
// algum caminho externo (ex.: um valor legado carregado do banco) o altere.
test('isCollectionChanged: mudar SOMENTE observacao NAO dispara mudança de coleção', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', observacao: null, ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3', observacao: null, ordem: 1 },
  ]);
  const obsChanged = baseline.map((it) => ({ ...it }));
  obsChanged[1].observacao = 'algo';
  assert.equal(D.isCollectionChanged(obsChanged, baseline), false,
    'mudar observação sozinha NÃO pode mais disparar p_itens — retirada da UI administrativa');
});

// PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1: terceiro parâmetro OPCIONAL
// `{ compareObservacao: true }`. item.observacao CONTINUA editável pelo
// Cliente (U4; a retirada foi SOMENTE administrativa), então o editor do
// Cliente opta por comparar observação — sem alterar nenhum chamador
// existente, que nunca passa esse terceiro argumento.
test('isCollectionChanged: com { compareObservacao: true }, mudar SOMENTE observacao DISPARA mudança de coleção', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', observacao: null, ordem: 0 },
    { id: 'b', modelo_id: 2, metros: '3', observacao: null, ordem: 1 },
  ]);
  const obsChanged = baseline.map((it) => ({ ...it }));
  obsChanged[1].observacao = 'algo';
  assert.equal(D.isCollectionChanged(obsChanged, baseline, { compareObservacao: true }), true,
    'com compareObservacao, mudar a observação do item deve disparar p_itens (editor do Cliente)');
  assert.equal(D.isCollectionChanged(baseline.map((it) => ({ ...it })), baseline, { compareObservacao: true }), false,
    'cópia idêntica ainda não deve disparar mudança mesmo com compareObservacao');
});

test('isCollectionChanged: ausência do terceiro parâmetro preserva o comportamento administrativo EXATO (compatibilidade retroativa)', () => {
  const D = loadDraft();
  const baseline = D.fromPersisted([
    { id: 'a', modelo_id: 1, metros: '2', observacao: null, ordem: 0 },
  ]);
  const obsChanged = baseline.map((it) => ({ ...it }));
  obsChanged[0].observacao = 'algo';
  assert.equal(D.isCollectionChanged(obsChanged, baseline), false);
  assert.equal(D.isCollectionChanged(obsChanged, baseline, {}), false,
    'options vazio (sem compareObservacao) também preserva o comportamento antigo');
});

// =====================================================================
// buildItemMention — PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 sec.G.
// =====================================================================

const MODELOS_MENCAO = [
  { id: 1, nome: 'Noite', largura: 2.10, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } },
  { id: 2, nome: 'Sol Poente', largura: 1.40, cor_1: { id: 3, nome: 'AZUL' }, cor_2: { id: 4, nome: 'BRANCO' } },
];

test('buildItemMention: formato exato do contrato ratificado, com largura em pt-BR', () => {
  const D = loadDraft();
  const item = { uid: 'i_abc123', itemId: 'db-uuid-should-not-appear', modeloId: '1', metros: '10' };
  const out = D.buildItemMention(item, MODELOS_MENCAO, 2);
  assert.equal(out, '@Item 3 — Noite · KRAFT/CRU · 2,10 m: ');
});

test('buildItemMention: nunca inclui uid, itemId, pedido_item_id ou metragem', () => {
  const D = loadDraft();
  const item = { uid: 'i_zzzzzz', itemId: '11111111-1111-1111-1111-111111111111', modeloId: '2', metros: '37.5' };
  const out = D.buildItemMention(item, MODELOS_MENCAO, 0);
  assert.doesNotMatch(out, /i_zzzzzz/);
  assert.doesNotMatch(out, /11111111-1111-1111-1111-111111111111/);
  assert.doesNotMatch(out, /pedido_item_id/);
  assert.doesNotMatch(out, /37[.,]5/, 'metragem não pode aparecer na menção');
  assert.equal(out, '@Item 1 — Sol Poente · AZUL/BRANCO · 1,40 m: ');
});

test('buildItemMention: posição é sempre a ATUAL (1-based) do índice recebido', () => {
  const D = loadDraft();
  const item = { uid: 'i_x', modeloId: '1', metros: '5' };
  assert.match(D.buildItemMention(item, MODELOS_MENCAO, 0), /^@Item 1 /);
  assert.match(D.buildItemMention(item, MODELOS_MENCAO, 4), /^@Item 5 /);
});

test('buildItemMention: modelo não resolvido devolve null (nunca referência vazia/incompleta)', () => {
  const D = loadDraft();
  assert.equal(D.buildItemMention({ uid: 'i_x', modeloId: '', metros: '' }, MODELOS_MENCAO, 0), null,
    'item sem modelo selecionado');
  assert.equal(D.buildItemMention({ uid: 'i_x', modeloId: '999', metros: '5' }, MODELOS_MENCAO, 0), null,
    'modelo_id não encontrado na lista carregada (ex.: modelo removido)');
  assert.equal(D.buildItemMention(null, MODELOS_MENCAO, 0), null);
});

test('buildItemMention: funciona para item ainda NÃO salvo (itemId null) — usa só estado local', () => {
  const D = loadDraft();
  const item = D.novoItem({ modeloId: '1', metros: '3' });
  assert.equal(item.itemId, null);
  const out = D.buildItemMention(item, MODELOS_MENCAO, 0);
  assert.equal(out, '@Item 1 — Noite · KRAFT/CRU · 2,10 m: ');
});

// =====================================================================
// computeMentionInsertion — PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 sec.H.
// Função pura: nenhum DOM é necessário para provar caret/newline/append.
// =====================================================================

test('computeMentionInsertion: campo vazio -> acrescenta sem quebra de linha', () => {
  const D = loadDraft();
  const r = D.computeMentionInsertion('', 0, false, '@Item 1 — Noite · KRAFT/CRU · 2,10 m: ');
  assert.equal(r.value, '@Item 1 — Noite · KRAFT/CRU · 2,10 m: ');
  assert.equal(r.caret, r.value.length);
});

test('computeMentionInsertion: texto existente sem foco ativo -> acrescenta ao FINAL com quebra de linha', () => {
  const D = loadDraft();
  const r = D.computeMentionInsertion('Entregar até sexta', 3, false, '@Item 2 — X · Y/Z · 1,40 m: ');
  assert.equal(r.value, 'Entregar até sexta\n@Item 2 — X · Y/Z · 1,40 m: ');
  assert.equal(r.caret, r.value.length);
});

test('computeMentionInsertion: com foco ativo, insere no caret SEM apagar o texto ao redor', () => {
  const D = loadDraft();
  // "Antes|Depois" — caret logo após "Antes" (posição 5).
  const r = D.computeMentionInsertion('AntesDepois', 5, true, '@Item 1 — X · Y/Z · 1,40 m: ');
  assert.equal(r.value, 'Antes\n@Item 1 — X · Y/Z · 1,40 m: Depois');
  assert.equal(r.value.startsWith('Antes'), true, 'texto anterior preservado');
  assert.ok(r.value.endsWith('Depois'), 'texto posterior preservado, não apagado');
  assert.equal(r.caret, 'Antes\n@Item 1 — X · Y/Z · 1,40 m: '.length, 'caret logo após ": "');
});

test('computeMentionInsertion: NÃO acrescenta quebra de linha se o caractere anterior já é \n', () => {
  const D = loadDraft();
  const r = D.computeMentionInsertion('primeira linha\n', 15, true, '@Item 1 — X · Y/Z · 1,40 m: ');
  assert.equal(r.value, 'primeira linha\n@Item 1 — X · Y/Z · 1,40 m: ');
});

test('computeMentionInsertion: inserção no INÍCIO (posição 0) nunca acrescenta quebra de linha', () => {
  const D = loadDraft();
  const r = D.computeMentionInsertion('texto existente', 0, true, '@Item 1 — X · Y/Z · 1,40 m: ');
  assert.equal(r.value, '@Item 1 — X · Y/Z · 1,40 m: texto existente');
});

test('computeMentionInsertion: cliques repetidos inserem referências repetidas (sem dedup)', () => {
  const D = loadDraft();
  const mention = '@Item 1 — X · Y/Z · 1,40 m: ';
  const first = D.computeMentionInsertion('', 0, false, mention);
  const second = D.computeMentionInsertion(first.value, first.caret, true, mention);
  assert.equal(second.value, mention + '\n' + mention);
  assert.equal((second.value.match(/@Item 1/g) || []).length, 2, 'a segunda menção não substitui nem remove a primeira');
});
