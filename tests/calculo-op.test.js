const { test } = require('node:test');
const assert = require('node:assert');
const { calcularFiosOP, larguraKey, montarOrdensCompraFio } = require('../js/calculo-op.js');

// Parâmetros do seed (db/04_seed.sql)
const PARAMS = {
  '1.40': { algodao_por_ml: 0.000350, poliester_por_ml: 0.000420, valor_x: 1.0 },
  '2.10': { algodao_por_ml: 0.000525, poliester_por_ml: 0.000630, valor_x: 1.0 },
};
// Modelos: Conforto 1.40 (BRANCO/PRETO), Conforto 2.10 (PRETO/BRANCO)
const MODELOS = {
  1: { id: 1, nome: 'Conforto', largura: 1.40, cor_1: { id: 1, nome: 'BRANCO' }, cor_2: { id: 2, nome: 'PRETO' } },
  2: { id: 2, nome: 'Conforto', largura: 2.10, cor_1: { id: 2, nome: 'PRETO' }, cor_2: { id: 1, nome: 'BRANCO' } },
};

test('larguraKey normaliza 1.4 e 1.40 para a mesma chave', () => {
  assert.strictEqual(larguraKey(1.4), '1.40');
  assert.strictEqual(larguraKey('1.40'), '1.40');
  assert.strictEqual(larguraKey(2.1), '2.10');
});

test('1 item 1.40 x 200m: algodão por cor e poliéster conferem', () => {
  const r = calcularFiosOP([{ modeloId: 1, metros: 200 }], MODELOS, PARAMS);
  assert.ok(Math.abs(r.algodaoPorCor[1].kg - 0.07) < 1e-9);
  assert.ok(Math.abs(r.algodaoPorCor[2].kg - 0.07) < 1e-9);
  assert.strictEqual(r.algodaoPorCor[1].corNome, 'BRANCO');
  assert.ok(Math.abs(r.poliester.PRETO - 0.084) < 1e-9);
  assert.ok(Math.abs(r.poliester.BRANCO - 0.084) < 1e-9);
});

test('2 itens larguras diferentes somam algodão por cor', () => {
  const r = calcularFiosOP(
    [{ modeloId: 1, metros: 200 }, { modeloId: 2, metros: 100 }],
    MODELOS, PARAMS
  );
  assert.ok(Math.abs(r.algodaoPorCor[1].kg - 0.1225) < 1e-9);
  assert.ok(Math.abs(r.algodaoPorCor[2].kg - 0.1225) < 1e-9);
});

test('poliéster sempre lista PRETO e BRANCO mesmo sem itens', () => {
  const r = calcularFiosOP([], MODELOS, PARAMS);
  assert.strictEqual(r.poliester.PRETO, 0);
  assert.strictEqual(r.poliester.BRANCO, 0);
  assert.deepStrictEqual(r.algodaoPorCor, {});
});

test('item com metros inválido é ignorado', () => {
  const r = calcularFiosOP([{ modeloId: 1, metros: 0 }, { modeloId: 1, metros: -5 }], MODELOS, PARAMS);
  assert.deepStrictEqual(r.algodaoPorCor, {});
});

test('largura sem parâmetro lança erro', () => {
  const modelos = { 9: { id: 9, nome: 'X', largura: 3.0, cor_1: { id: 1, nome: 'BRANCO' }, cor_2: { id: 2, nome: 'PRETO' } } };
  assert.throws(() => calcularFiosOP([{ modeloId: 9, metros: 100 }], modelos, PARAMS), /largura/);
});

test('montarOrdensCompraFio gera 1 ordem por cor de algodão + PRETO + BRANCO', () => {
  const calc = calcularFiosOP(
    [{ modeloId: 1, metros: 200 }, { modeloId: 2, metros: 100 }],
    MODELOS, PARAMS
  );
  const ordens = montarOrdensCompraFio(calc);
  const algodao = ordens.filter(o => o.tipo === 'algodao');
  const poliester = ordens.filter(o => o.tipo === 'poliester');
  assert.strictEqual(algodao.length, 2);
  assert.strictEqual(poliester.length, 2);
  for (const o of algodao) { assert.ok(o.cor_id); assert.strictEqual(o.cor_poliester, null); assert.ok(o.kg_pedido > 0); }
  for (const o of poliester) { assert.strictEqual(o.cor_id, null); assert.ok(['PRETO','BRANCO'].includes(o.cor_poliester)); }
});

test('montarOrdensCompraFio arredonda kg_pedido para 3 casas', () => {
  const calc = calcularFiosOP([{ modeloId: 1, metros: 200 }], MODELOS, PARAMS);
  const ordens = montarOrdensCompraFio(calc);
  const branco = ordens.find(o => o.tipo === 'algodao' && o.cor_id === 1);
  assert.strictEqual(branco.kg_pedido, 0.07);
});

test('montarOrdensCompraFio não gera ordens sem itens', () => {
  const ordens = montarOrdensCompraFio(calcularFiosOP([], MODELOS, PARAMS));
  assert.strictEqual(ordens.length, 0);
});
