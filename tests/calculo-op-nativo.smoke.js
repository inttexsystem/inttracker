// tests/calculo-op-nativo.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 13) —
// `montarOrdensCompraFio` vira `montarNecessidadesCompra` e para de emitir
// payload de DOCUMENTO plano.
//
// O ponto central deste arquivo é provar que a MATEMÁTICA DA RECEITA NÃO
// MUDOU: a renomeação não pode ser desculpa para alterar somas, arredondamento,
// descarte de linhas <= 0 ou ordem de emissão. O que muda são os NOMES DOS
// CAMPOS, que passam a ser os do eixo nativo (material / kg_necessario) em vez
// dos de uma linha de ordens_compra_fio (tipo / kg_pedido).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CALC = path.join(ROOT, 'js', 'calculo-op.js');
const calcSrc = fs.readFileSync(CALC, 'utf8');

const mod = require(CALC);
const { calcularFiosOP, montarNecessidadesCompra } = mod;

const MODELOS = {
  1: { id: 1, nome: 'A', largura: 2.10, cor_1: { id: 10, nome: 'PRETO' }, cor_2: { id: 11, nome: 'CRU' } },
  2: { id: 2, nome: 'B', largura: 1.40, cor_1: { id: 11, nome: 'CRU' }, cor_2: { id: 11, nome: 'CRU' } },
};
const PARAMS = {
  '2.10': { algodao_por_ml: 0.42, poliester_por_ml: 0.13, valor_x: 1.05 },
  '1.40': { algodao_por_ml: 0.28, poliester_por_ml: 0.09, valor_x: 1.05 },
};

// A referência é recalculada aqui a partir da receita, não copiada da
// implementação: se a matemática mudar, isto quebra.
function referencia(itens) {
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const algodao = {}; let pol = 0;
  for (const it of itens) {
    const m = Number(it.metros); if (!(m > 0)) continue;
    const modelo = MODELOS[it.modeloId]; if (!modelo) continue;
    const p = PARAMS[Number(modelo.largura).toFixed(2)];
    const kgAlg = p.algodao_por_ml * p.valor_x * m;
    for (const cor of [modelo.cor_1, modelo.cor_2]) algodao[cor.id] = (algodao[cor.id] || 0) + kgAlg;
    pol += p.poliester_por_ml * p.valor_x * m;
  }
  return { algodao, poliesterPorCor: round3(pol) };
}

// ---------------------------------------------------------------------
// A renomeação
// ---------------------------------------------------------------------

test('1. montarNecessidadesCompra é o dono atual e está exportado', () => {
  assert.equal(typeof montarNecessidadesCompra, 'function',
    'montarNecessidadesCompra tem de ser o dono exportado');
  assert.match(calcSrc, /function\s+montarNecessidadesCompra/);
});

test('2. montarOrdensCompraFio NÃO é mais o dono nem é exportado', () => {
  assert.equal(typeof mod.montarOrdensCompraFio, 'undefined',
    'o nome antigo não pode continuar exportado');
  assert.doesNotMatch(calcSrc, /function\s+montarOrdensCompraFio/,
    'o nome antigo não pode continuar sendo uma função do módulo');
  assert.doesNotMatch(calcSrc, /module\.exports[\s\S]*montarOrdensCompraFio/,
    'o nome antigo não pode aparecer no contrato de exportação');
});

test('3. as demais exportações do módulo permanecem intactas', () => {
  for (const nome of ['larguraKey', 'calcularFiosOP', 'recalcularOP', 'consumoPorOrdem',
    'totalEntregueCimaPorItem', 'percentualEntregueOP', 'agruparOrdensCompraFio']) {
    assert.equal(typeof mod[nome], 'function', nome + ' não pode ter sido afetado pela renomeação');
  }
});

// ---------------------------------------------------------------------
// A matemática da receita é a mesma
// ---------------------------------------------------------------------

test('4. as quantidades saem idênticas à receita recalculada de forma independente', () => {
  const itens = [{ modeloId: 1, metros: 100 }, { modeloId: 2, metros: 250 }];
  const ref = referencia(itens);
  const out = montarNecessidadesCompra(calcularFiosOP(itens, MODELOS, PARAMS));

  const round3 = (n) => Math.round(n * 1000) / 1000;
  for (const corId of Object.keys(ref.algodao)) {
    const linha = out.find((o) => o.material === 'algodao' && String(o.cor_id) === String(corId));
    assert.ok(linha, 'faltou a necessidade de algodão da cor ' + corId);
    assert.equal(linha.kg_necessario, round3(ref.algodao[corId]),
      'o kg de algodão da cor ' + corId + ' mudou');
  }
  for (const cor of ['PRETO', 'BRANCO']) {
    const linha = out.find((o) => o.material === 'poliester' && o.cor_poliester === cor);
    assert.ok(linha, 'faltou a necessidade de poliéster ' + cor);
    assert.equal(linha.kg_necessario, ref.poliesterPorCor, 'o kg de poliéster ' + cor + ' mudou');
  }
});

test('5. o arredondamento continua em 3 casas', () => {
  const out = montarNecessidadesCompra(calcularFiosOP([{ modeloId: 1, metros: 7 }], MODELOS, PARAMS));
  for (const linha of out) {
    const casas = (String(linha.kg_necessario).split('.')[1] || '').length;
    assert.ok(casas <= 3, 'kg_necessario tem de continuar arredondado a 3 casas: ' + linha.kg_necessario);
  }
});

test('6. linhas <= 0 continuam descartadas', () => {
  const out = montarNecessidadesCompra({ algodaoPorCor: { 10: { corId: 10, kg: 0 } }, poliester: { PRETO: 0, BRANCO: 0 } });
  assert.deepEqual(out, [], 'nada com kg <= 0 pode ser emitido');
});

test('7. a ordem de emissão continua algodão por cor, depois PRETO e BRANCO', () => {
  const out = montarNecessidadesCompra(calcularFiosOP([{ modeloId: 1, metros: 100 }], MODELOS, PARAMS));
  const materiais = out.map((o) => o.material);
  const primeiroPol = materiais.indexOf('poliester');
  assert.ok(primeiroPol > 0, 'tem de haver algodão antes de poliéster');
  assert.ok(materiais.slice(0, primeiroPol).every((m) => m === 'algodao'),
    'todo o algodão vem primeiro');
  const pols = out.filter((o) => o.material === 'poliester').map((o) => o.cor_poliester);
  assert.deepEqual(pols, ['PRETO', 'BRANCO'], 'a ordem PRETO, BRANCO tem de ser preservada');
});

// ---------------------------------------------------------------------
// O payload deixou de ser um documento plano
// ---------------------------------------------------------------------

test('8. o payload usa os campos do eixo NATIVO', () => {
  const out = montarNecessidadesCompra(calcularFiosOP([{ modeloId: 1, metros: 100 }], MODELOS, PARAMS));
  assert.ok(out.length > 0);
  for (const linha of out) {
    assert.deepEqual(Object.keys(linha).sort(), ['cor_id', 'cor_poliester', 'kg_necessario', 'material'],
      'a necessidade nativa tem exatamente estes quatro campos');
  }
});

test('9. NENHUM campo de documento de compra plano é produzido', () => {
  const out = montarNecessidadesCompra(calcularFiosOP([{ modeloId: 1, metros: 100 }], MODELOS, PARAMS));
  for (const linha of out) {
    for (const proibido of ['tipo', 'kg_pedido', 'status', 'op_id', 'fornecedor_id']) {
      assert.equal(proibido in linha, false,
        'o campo de documento plano `' + proibido + '` não pode mais ser emitido');
    }
  }
});

test('10. os eixos continuam distinguindo algodão por cor_id e poliéster por cor_poliester', () => {
  const out = montarNecessidadesCompra(calcularFiosOP([{ modeloId: 1, metros: 100 }], MODELOS, PARAMS));
  for (const linha of out) {
    if (linha.material === 'algodao') {
      assert.notEqual(linha.cor_id, null, 'algodão é identificado por cor_id');
      assert.equal(linha.cor_poliester, null);
    } else {
      assert.equal(linha.cor_id, null);
      assert.ok(['PRETO', 'BRANCO'].includes(linha.cor_poliester), 'poliéster é identificado por cor_poliester');
    }
  }
});
