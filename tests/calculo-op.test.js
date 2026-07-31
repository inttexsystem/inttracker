const { test } = require('node:test');
const assert = require('node:assert');
const { calcularFiosOP, larguraKey, montarNecessidadesCompra, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem, percentualEntregueOP, agruparOrdensCompraFio } = require('../js/calculo-op.js');

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

// P2-A: montarOrdensCompraFio virou montarNecessidadesCompra e passou a emitir
// NECESSIDADE nativa (material / kg_necessario) em vez de linha de documento
// plano (tipo / kg_pedido). A cardinalidade e os eixos que estes três casos
// sempre protegeram continuam valendo, agora sobre o payload nativo.
test('montarNecessidadesCompra gera 1 necessidade por cor de algodão + PRETO + BRANCO', () => {
  const calc = calcularFiosOP(
    [{ modeloId: 1, metros: 200 }, { modeloId: 2, metros: 100 }],
    MODELOS, PARAMS
  );
  const necessidades = montarNecessidadesCompra(calc);
  const algodao = necessidades.filter(o => o.material === 'algodao');
  const poliester = necessidades.filter(o => o.material === 'poliester');
  assert.strictEqual(algodao.length, 2);
  assert.strictEqual(poliester.length, 2);
  for (const o of algodao) { assert.ok(o.cor_id); assert.strictEqual(o.cor_poliester, null); assert.ok(o.kg_necessario > 0); }
  for (const o of poliester) { assert.strictEqual(o.cor_id, null); assert.ok(['PRETO','BRANCO'].includes(o.cor_poliester)); }
});

test('montarNecessidadesCompra arredonda kg_necessario para 3 casas', () => {
  const calc = calcularFiosOP([{ modeloId: 1, metros: 200 }], MODELOS, PARAMS);
  const necessidades = montarNecessidadesCompra(calc);
  const branco = necessidades.find(o => o.material === 'algodao' && o.cor_id === 1);
  assert.strictEqual(branco.kg_necessario, 0.07);
});

test('montarNecessidadesCompra não gera necessidades sem itens', () => {
  const necessidades = montarNecessidadesCompra(calcularFiosOP([], MODELOS, PARAMS));
  assert.strictEqual(necessidades.length, 0);
});

test('recalcularOP fator < 1 escala metros pra baixo e gera saldo da cor não-gargalo', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 200 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 10, kg_recebido: 10 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 10, kg_recebido: 5 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 0.5);
  assert.strictEqual(r.itens[0].metros_ajustados, 100);
  assert.strictEqual(r.itens[0].metros_pedidos, 200);
  assert.strictEqual(r.sobras.length, 1);
  assert.deepStrictEqual(r.sobras[0], { ordem_id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_sobra: 5 });
});

test('recalcularOP fator > 1 escala metros pra cima', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 10, kg_recebido: 20 },
    { id: 2, tipo: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_pedido: 10, kg_recebido: 15 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 1.5);
  assert.strictEqual(r.itens[0].metros_ajustados, 150);
  assert.strictEqual(r.sobras.length, 1);
  assert.strictEqual(r.sobras[0].ordem_id, 1);
  assert.strictEqual(r.sobras[0].kg_sobra, 5);
});

test('recalcularOP fator = 1 não ajusta e não gera saldo', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 120 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 7, kg_recebido: 7 },
    { id: 2, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 8, kg_recebido: 8 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 1);
  assert.strictEqual(r.itens[0].metros_ajustados, 120);
  assert.strictEqual(r.sobras.length, 0);
});

test('recalcularOP arredonda metros a 2 casas e sobra a 3 casas', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 3, kg_recebido: 1 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 3, kg_recebido: 3 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.itens[0].metros_ajustados, 33.33);
  assert.strictEqual(r.sobras[0].kg_sobra, 2);
});

test('recalcularOP sem ordens mantém metros (fator 1)', () => {
  const r = recalcularOP([{ op_item_id: 10, metros_pedidos: 50 }], []);
  assert.strictEqual(r.fator, 1);
  assert.strictEqual(r.itens[0].metros_ajustados, 50);
  assert.strictEqual(r.sobras.length, 0);
});

test('recalcularOP ignora ordem com kg_pedido 0 ao calcular o fator', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 10, kg_recebido: 8 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 0, kg_recebido: 0 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 0.8);
  assert.strictEqual(r.itens[0].metros_ajustados, 80);
});

test('consumoPorOrdem mapeia consumo e sobra por ordem dado metros livres', () => {
  // 100m modelo 1 (largura 1.40): algodão por cor = 0.035 kg; poliéster = 0.042 kg
  const itens = [{ op_item_id: 10, modelo_id: 1, metros: 100 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_recebido: 0.04 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_recebido: 0.03 },     // gargalo: faltam 0.005
    { id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO',  kg_recebido: 0.05 },
    { id: 4, tipo: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_recebido: 0.045 },
  ];
  const r = consumoPorOrdem(itens, ordens, MODELOS, PARAMS);
  assert.strictEqual(r.length, 4);
  assert.strictEqual(r[0].kg_consumido, 0.035);
  assert.strictEqual(r[0].sobra, 0.005);
  assert.strictEqual(r[1].kg_consumido, 0.035);
  assert.strictEqual(r[1].sobra, -0.005);  // excesso (sobra negativa)
  assert.strictEqual(r[2].kg_consumido, 0.042);
  assert.strictEqual(r[2].sobra, 0.008);
  assert.strictEqual(r[3].kg_consumido, 0.042);
  assert.strictEqual(r[3].sobra, 0.003);
});

test('consumoPorOrdem com metros 0 zera consumo (mantém sobra = recebido)', () => {
  const itens = [{ op_item_id: 10, modelo_id: 1, metros: 0 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_recebido: 0.04 },
    { id: 2, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_recebido: 0.05 },
  ];
  const r = consumoPorOrdem(itens, ordens, MODELOS, PARAMS);
  assert.strictEqual(r[0].kg_consumido, 0);
  assert.strictEqual(r[0].sobra, 0.04);
  assert.strictEqual(r[1].kg_consumido, 0);
  assert.strictEqual(r[1].sobra, 0.05);
});

test('totalEntregueCimaPorItem soma metros sem defeito por op_item', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: 10, metros_entregues: 30, defeito: false },
    { op_item_id: 11, metros_entregues: 20, defeito: false },
  ]);
  assert.strictEqual(r[10], 80);
  assert.strictEqual(r[11], 20);
});

test('totalEntregueCimaPorItem ignora linhas com defeito', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: 10, metros_entregues: 20, defeito: true },   // ignorada
    { op_item_id: 11, metros_entregues: 15, defeito: true },   // ignorada totalmente
  ]);
  assert.strictEqual(r[10], 50);
  assert.strictEqual(r[11], undefined);  // nenhuma soma sem defeito
});

test('totalEntregueCimaPorItem arredonda total a 2 casas', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 10.333, defeito: false },
    { op_item_id: 10, metros_entregues: 10.333, defeito: false },
    { op_item_id: 10, metros_entregues: 10.334, defeito: false },
  ]);
  assert.strictEqual(r[10], 31);  // 30.999... → arredonda para 31.00
});

test('totalEntregueCimaPorItem ignora linhas sem op_item_id', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: null, modelo_id: 1, metros_entregues: 25, defeito: false },
    { metros_entregues: 30, defeito: false },
  ]);
  assert.strictEqual(r[10], 50);
  assert.strictEqual(Object.keys(r).length, 1);
});

test('totalEntregueCimaPorItem vazio retorna objeto vazio', () => {
  assert.deepStrictEqual(totalEntregueCimaPorItem([]), {});
});

test('totalEntregueCimaPorItem ignora metros nao-numericos', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: 10, metros_entregues: '', defeito: false },
    { op_item_id: 10, metros_entregues: undefined, defeito: false },
    { op_item_id: 11, metros_entregues: 'abc', defeito: false },
  ]);
  assert.strictEqual(r[10], 50);
  assert.strictEqual(r[11], undefined);
});

test('totalEntregueCimaPorItem também serve ao recebido de látex (mesma forma de dados)', () => {
  const recebimentosLatex = [
    { op_item_id: 10, metros_entregues: 12.5, defeito: false },
    { op_item_id: 10, metros_entregues: 7.5, defeito: false },
    { op_item_id: 11, metros_entregues: 3, defeito: false },
  ];
  const total = totalEntregueCimaPorItem(recebimentosLatex);
  assert.deepStrictEqual(total, { 10: 20, 11: 3 });
});

test('recebido de látex ignora itens com defeito', () => {
  const recebimentosLatex = [
    { op_item_id: 10, metros_entregues: 5, defeito: false },
    { op_item_id: 10, metros_entregues: 9, defeito: true },
  ];
  const total = totalEntregueCimaPorItem(recebimentosLatex);
  assert.deepStrictEqual(total, { 10: 5 });
});

test('percentualEntregueOP: usa ajustado quando houver, senão pedido', () => {
  const opItens = [
    { id: 1, metros_pedidos: 100, metros_ajustados: 80 },
    { id: 2, metros_pedidos: 20, metros_ajustados: null },
  ];
  const entregaItens = [
    { op_item_id: 1, metros_entregues: 40, defeito: false },
    { op_item_id: 2, metros_entregues: 10, defeito: false },
  ];
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 50);
});

test('percentualEntregueOP: ignora defeito e arredonda', () => {
  const opItens = [{ id: 1, metros_pedidos: 30, metros_ajustados: null }];
  const entregaItens = [
    { op_item_id: 1, metros_entregues: 10, defeito: false },
    { op_item_id: 1, metros_entregues: 5, defeito: true },
  ];
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 33);
});

test('percentualEntregueOP: meta zero retorna 0', () => {
  assert.strictEqual(percentualEntregueOP([], []), 0);
});

test('percentualEntregueOP: cap em 100 quando entregue excede a meta', () => {
  const opItens = [{ id: 1, metros_pedidos: 10, metros_ajustados: null }];
  const entregaItens = [{ op_item_id: 1, metros_entregues: 25, defeito: false }];
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 100);
});

test('agruparOrdensCompraFio: separa por tipo, soma kg e ordena', () => {
  const ordens = [
    { tipo: 'algodao', kg_pedido: 5, cores: { nome: 'VERDE' } },
    { tipo: 'algodao', kg_pedido: 2.5, cores: { nome: 'AZUL' } },
    { tipo: 'algodao', kg_pedido: 1.5, cores: { nome: 'AZUL' } },
    { tipo: 'poliester', kg_pedido: 3, cor_poliester: 'PRETO' },
  ];
  const r = agruparOrdensCompraFio(ordens);
  assert.deepStrictEqual(r.algodao, [{ rotulo: 'AZUL', kg: 4 }, { rotulo: 'VERDE', kg: 5 }]);
  assert.deepStrictEqual(r.poliester, [{ rotulo: 'PRETO', kg: 3 }]);
  assert.strictEqual(r.totalAlgodao, 9);
  assert.strictEqual(r.totalPoliester, 3);
});

test('agruparOrdensCompraFio: lista vazia', () => {
  const r = agruparOrdensCompraFio([]);
  assert.deepStrictEqual(r, { algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0 });
});
