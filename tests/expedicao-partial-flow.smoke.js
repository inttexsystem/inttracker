// Smoke test for RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-FLOW-COHERENCE-C.
// Static/VM contract only: no Supabase connection and no business data writes.
//
// Contrato (paridade com Tecelagem):
//   - recebido_no_acabamento = entregas etapa='cima' vinculadas por
//     op_latex_entregas (== op_itens acumulados da OP Latex);
//   - ja_movimentado = expedicao_itens.metros_liberados;
//   - disponivel = recebido - ja_movimentado;
//   - movimentar Acabamento -> Expedicao e a propria liberacao (nao existe
//     etapa intermediaria "registrar acabamento");
//   - movimentar parcial nao finaliza a OP; finalizar a OP e separado.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DB32 = path.join(ROOT, 'db', '32_acabamento_expedicao_direct_movement.sql');
const DB31 = path.join(ROOT, 'db', '31_acabamento_partial_expedition_flow.sql');
const DB23 = path.join(ROOT, 'db', '23_expedicao_entrega_flow.sql');
const DB29 = path.join(ROOT, 'db', '29_op_latex_split_rpc.sql');
const CHAIN_STATE = path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js');
const OLA = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const PEDIDO_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const PEDIDO_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const EXPEDICAO_ADMIN = path.join(ROOT, 'js', 'screens', 'expedicao-admin.js');
const CLIENTE_READMODEL_TEST = path.join(ROOT, 'tests', 'cliente-pedido-summary-readmodel.smoke.js');

const db32 = fs.readFileSync(DB32, 'utf8');
const db31 = fs.readFileSync(DB31, 'utf8');
const db23 = fs.readFileSync(DB23, 'utf8');
const db29 = fs.readFileSync(DB29, 'utf8');
const chainState = fs.readFileSync(CHAIN_STATE, 'utf8');
const ola = fs.readFileSync(OLA, 'utf8');
const pedidoEvents = fs.readFileSync(PEDIDO_EVENTS, 'utf8');
const pedidoProgress = fs.readFileSync(PEDIDO_PROGRESS, 'utf8');
const expedicaoAdmin = fs.readFileSync(EXPEDICAO_ADMIN, 'utf8');
const clienteReadmodelTest = fs.readFileSync(CLIENTE_READMODEL_TEST, 'utf8');

function derive(input) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  return sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState(input);
}

function latexPedido(extra) {
  return Object.assign({
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    ops: [{
      id: 42,
      numero: 8,
      ano: 2026,
      status: 'em_producao',
      tipo: 'latex',
      op_itens: [{ id: 100, metros_pedidos: 100 }],
    }],
    entregaItens: [],
    entregasById: {},
    expedicoes: [],
    expedicaoItens: [],
  }, extra || {});
}

test('1. OP Latex em_producao com recebido da Tecelagem pode movimentar parcial para Expedicao', () => {
  const result = derive(latexPedido());
  // Recebido = op_itens acumulado (100). Nenhum movimento etapa=latex foi
  // necessario para habilitar a movimentacao para expedicao.
  assert.equal(result.actions.releaseExpedicao.mode, 'enabled');
  assert.equal(result.metrics.expedicao.liberavel, 100);
  assert.equal(result.stage, 'pronto_expedicao');
});

test('2. Nao exige OP Latex concluida/finalizada para movimentar', () => {
  // A RPC aceita em_producao/concluida/finalizada (rejeita apenas fora disso).
  assert.match(db32, /v_op\.status NOT IN \('em_producao', 'concluida', 'finalizada'\)/);
  // O gate NAO exige status terminal.
  assert.doesNotMatch(db32, /Finalize o acabamento antes de/i);
});

test('3. Movimento para Expedicao nao finaliza a OP (nao altera ops.status)', () => {
  assert.doesNotMatch(db32, /UPDATE\s+public\.ops\b/i);
  assert.doesNotMatch(db32, /alterar_status_op/i);
  assert.match(db32, /NAO altera ops\.status/i);
});

test('4. Nao existe etapa obrigatoria "registrar acabamento"', () => {
  // recebido vem das entregas Tecelagem->Acabamento (etapa=cima) via
  // op_latex_entregas, nao de um movimento etapa=latex.
  assert.match(db32, /op_latex_entregas/);
  assert.match(db32, /e\.etapa = 'cima'/);
  // O modulo da OP nao renderiza um card operacional "novo recebimento" de
  // acabamento; a UI principal usa botao curto para movimentar.
  assert.match(ola, /'Movimentar'/);
  assert.doesNotMatch(ola, /'\+ Novo recebimento'/);
});

test('5. Nao permite movimentar acima do recebido - ja movimentado', () => {
  assert.match(db32, /v_req\.metros > ROUND\(GREATEST\(v_item\.recebido - v_item\.liberado, 0\)::NUMERIC, 2\)/);
  assert.match(db32, /Movimentacao excede saldo recebido no acabamento/);
  assert.match(db32, /FOR UPDATE/);
});

test('6. Movimento incrementa/cria expedicao_itens.metros_liberados', () => {
  assert.match(db32, /INSERT INTO public\.expedicao_itens/);
  assert.match(db32, /metros_liberados = public\.expedicao_itens\.metros_liberados \+ EXCLUDED\.metros_liberados/);
});

test('7. Entrega ao cliente continua limitada a metros_liberados', () => {
  assert.match(db23, /CHECK \(metros_entregues <= metros_liberados\)/);
  assert.match(db23, /v_item\.metros_entregues \+ v_metros > v_item\.metros_liberados/);
  assert.match(expedicaoAdmin, /Quantidade maior que o saldo do item/);
});

test('8. Pedido Detail recalcula em_acabamento / pronto_expedicao / entregue', () => {
  // Movido 40 de 100 recebido: disponivel para movimentar = 60.
  const moved = derive(latexPedido({
    expedicoes: [{ id: 'ex1', op_latex_id: 42 }],
    expedicaoItens: [{ expedicao_id: 'ex1', op_item_id: 100, metros_liberados: 40, metros_entregues: 0 }],
  }));
  assert.equal(moved.metrics.expedicao.liberavel, 60);
  assert.equal(moved.actions.releaseExpedicao.mode, 'enabled');

  // O progresso usa recebido - movimentado (op_itens - liberado por OP latex)
  // e pronto_expedicao = movimentado - entregue (= saldo da expedicao).
  assert.match(pedidoProgress, /liberadoByLatexOp\[op\.id\]/);
  assert.match(pedidoProgress, /var prontoExpedicao = expedicaoSaldo;/);
  assert.doesNotMatch(pedidoProgress, /finishedLatex - expedicaoLiberado/);

  // O modal Acabamento -> Expedicao calcula saldo por recebido - liberado,
  // sem premissa etapa=latex.
  assert.match(pedidoEvents, /liberar_expedicao_latex_parcial/);
  assert.match(pedidoEvents, /buildAcabamentoLiberavelRows/);
  assert.doesNotMatch(pedidoEvents, /entrega\.etapa !== 'latex'/);
});

test('9. Fluxo total legado de OP terminal continua valido', () => {
  assert.match(db23, /CREATE OR REPLACE FUNCTION public\.liberar_expedicao\s*\(\s*p_op_latex_id BIGINT\s*\)/i);
  assert.match(db23, /v_op\.status NOT IN \('finalizada', 'concluida'\)/);
  assert.match(ola, /'Liberar total'/);
  assert.match(ola, /supa\.rpc\(\s*'liberar_expedicao'/);
});

test('10. Split Latex e consolidacao default nao sao alterados pela db32', () => {
  assert.match(db29, /CREATE OR REPLACE FUNCTION public\.gerar_op_latex_split/i);
  assert.doesNotMatch(db32, /gerar_op_latex_split/i);
  assert.doesNotMatch(db32, /gerar_op_latex\s*\(/i);
  assert.doesNotMatch(db32, /motivo_separacao/i);
});

test('11. db32 sobrescreve a semantica errada da db31 (mesmas assinaturas)', () => {
  // A db31 usava etapa=latex como fonte de "acabado"; a db32 corrige.
  assert.match(db31, /e\.etapa = 'latex'/);
  assert.match(db32, /CREATE OR REPLACE FUNCTION public\.consultar_saldo_expedicao_latex/i);
  assert.match(db32, /CREATE OR REPLACE FUNCTION public\.liberar_expedicao_latex_parcial/i);
  assert.match(db32, /recebido_total/);
  assert.match(db32, /saldo_em_acabamento_total/);
});

test('12. Cliente read model nao expoe campos internos', () => {
  assert.match(clienteReadmodelTest, /op_id/);
  assert.match(clienteReadmodelTest, /expedicao_id/);
  assert.match(clienteReadmodelTest, /motivo_separacao/);
});
