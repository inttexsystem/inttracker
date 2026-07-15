// Smoke test for RAVATEX-TAPETES-END-TO-END-PRODUCTION-FLOW-B.
// Static contract only: no Supabase connection, no business data.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '23_expedicao_entrega_flow.sql');
const INDEX = path.join(ROOT, 'index.html');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const LATEX = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const EXPEDICAO = path.join(ROOT, 'js', 'screens', 'expedicao-admin.js');
const PEDIDO_DATA = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const PEDIDO_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const PEDIDO_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');
const PEDIDO_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const LATEX_ENTRY = path.join(ROOT, 'db', '22_latex_entry_gate.sql');

const sql = fs.readFileSync(SQL, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');
const router = fs.readFileSync(ROUTER, 'utf8');
const latex = fs.readFileSync(LATEX, 'utf8');
const expedicao = fs.readFileSync(EXPEDICAO, 'utf8');
const pedidoBundle = [
  fs.readFileSync(PEDIDO_DATA, 'utf8'),
  fs.readFileSync(PEDIDO_PROGRESS, 'utf8'),
  fs.readFileSync(PEDIDO_RENDER, 'utf8'),
  fs.readFileSync(PEDIDO_EVENTS, 'utf8'),
].join('\n');
const latexEntry = fs.readFileSync(LATEX_ENTRY, 'utf8');

test('expedicao flow: migration cria tabelas minimas', () => {
  for (const name of [
    'expedicoes',
    'expedicao_itens',
    'expedicao_movimentos',
    'expedicao_movimento_itens',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name}\\b`, 'i'));
  }
});

test('expedicao flow: migration cria RPCs de gate, entrega e conclusao', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.liberar_expedicao\s*\(\s*p_op_latex_id BIGINT\s*\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.registrar_entrega_expedicao\s*\(/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.concluir_pedido_se_pronto\s*\(\s*p_pedido_id UUID\s*\)/i);
});

test('expedicao flow: status e validacoes criticas estao no SQL', () => {
  assert.match(sql, /CHECK\s*\(\s*status IN \('aguardando_expedicao','parcial','concluida'\)\s*\)/i);
  assert.match(sql, /v_op\.status NOT IN \('finalizada', 'concluida'\)/i);
  assert.match(sql, /v_item\.metros_entregues \+ v_metros > v_item\.metros_liberados/i);
  assert.match(sql, /o\.status NOT IN \('concluida','finalizada','cancelada'\)/i);
  assert.match(sql, /e\.status <> 'concluida'/i);
  assert.match(sql, /SET status = 'entregue'/i);
  assert.match(sql, /status_cliente_visual = 'concluido'/i);
});

test('expedicao flow: nao altera contrato gerar_op_latex e OP Latex continua nascendo aberta', () => {
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.gerar_op_latex/i);
  assert.match(latexEntry, /CREATE OR REPLACE FUNCTION public\.gerar_op_latex\s*\(\s*p_entrega_id BIGINT\s*\)/i);
  assert.match(latexEntry, /INSERT INTO public\.ops \([^)]*status[^)]*\)\s*VALUES\s*\([\s\S]{0,240}'aberta'/i);
  assert.doesNotMatch(latexEntry, /VALUES[\s\S]{0,400}'em_producao'/i);
});

test('expedicao flow: acabamento finalizado libera expedicao sem concluir pedido', () => {
  assert.match(latex, /supa\.rpc\(\s*['"]liberar_expedicao['"]/);
  assert.match(latex, /p_op_latex_id\s*:\s*id/);
  assert.match(latex, /'Movimentar'/);
  assert.doesNotMatch(latex, /concluir_pedido_se_pronto/);
});

test('expedicao flow: tela de expedicao registra entrega\/coleta e chama conclusao por RPC', () => {
  assert.match(index, /js\/screens\/expedicao-admin\.js\?v=20260623-asset1/);
  assert.match(expedicao, /screenExpedicaoAdmin/);
  assert.match(expedicao, /registrar_entrega_expedicao/);
  assert.match(expedicao, /p_tipo\s*:\s*tipoInput\.value/);
  assert.match(expedicao, /concluir_pedido_se_pronto/);
  assert.match(expedicao, /Historico/);
});

test('expedicao flow: pedido le expedicoes e conclui somente via RPC', () => {
  for (const table of [
    'expedicoes',
    'expedicao_itens',
    'expedicao_movimentos',
    'expedicao_movimento_itens',
  ]) {
    assert.match(pedidoBundle, new RegExp(`from\\(\\s*['"]${table}['"]\\s*\\)`, 'i'));
  }
  assert.match(pedidoBundle, /pedidoConclusao/);
  assert.match(pedidoBundle, /concluir_pedido_se_pronto/);
  assert.doesNotMatch(pedidoBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,260}\.update\s*\(\s*\{[\s\S]*status\s*:\s*['"]entregue['"]/);
});

test('expedicao flow: router abre #/expedicoes/:id como admin', () => {
  assert.match(router, /#\\\/expedicoes\\\/\(\\d\+\)/);
  assert.match(router, /screenExpedicaoAdmin\(Number\(mExp\[1\]\)\)/);
  assert.match(router, /roles:\s*\[\s*['"]admin['"]\s*\]/);
});

test('expedicao flow: botao Concluir pedido nao renderiza disabled=null no DOM real', () => {
  // ui.el() faz setAttribute(k, v) para todo atributo, sem omitir null; um
  // valor null vira disabled="null" (atributo presente = botao desabilitado),
  // inclusive quando a acao esta pronta (ready === true). O atributo deve ser
  // omitido inteiramente quando pronto, e presente apenas quando nao pronto.
  assert.doesNotMatch(expedicao, /disabled:\s*ready\s*\?\s*null\s*:\s*['"]disabled['"]/,
    'botao Concluir pedido nao pode renderizar disabled=null, pois ui.el cria disabled="null" no DOM real');
  assert.doesNotMatch(expedicao, /disabled:\s*!ready\s*\?\s*['"]disabled['"]\s*:\s*null/,
    'variante equivalente de disabled=null tambem nao pode aparecer');
  assert.match(expedicao, /if\s*\(\s*!ready\s*\)\s*\{\s*buttonAttrs\.disabled\s*=\s*['"]disabled['"];\s*\}/,
    'disabled deve ser atribuido condicionalmente fora do objeto, nunca como null');
});
