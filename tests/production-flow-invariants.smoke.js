// =====================================================================
// === tests/production-flow-invariants.smoke.js =======================
// Invariantes de linguagem/semântica do fluxo produtivo
// Pedido -> Tecelagem -> Acabamento/Látex.
//
// Fase: RAVATEX-TAPETES-PRODUCTION-FLOW-FULL-INVARIANT-AUDIT-AND-FIX-A
//
// Foco desta suíte (correções que NÃO dependem de nova migration):
//   - Contrato 6: o histórico distingue CRIAÇÃO de ACUMULAÇÃO da OP
//     de acabamento — nunca diz "Gerou" para toda entrega.
//   - Contrato 4/6: telas não tratam a entrega parcial como "mãe" da
//     OP ("gerada por entrega parcial" removido).
//   - Contrato 9: o número exibido em ACABAMENTO é "em acabamento"
//     (recebido, não concluído); o card usa rótulos explícitos.
//
// O contrato de consolidação SQL (find-or-accumulate, op_latex_entregas
// N:1, idempotência) é coberto por tests/latex-consolidation-schema.smoke.js.
// A numeração (MAX(numero)+1 / reaproveitamento) é uma decisão de
// arquitetura reportada à parte (hard-stop #6), não testada aqui.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const db28 = read('db/28_op_latex_split_discriminator.sql');
const db29 = read('db/29_op_latex_split_rpc.sql');
const detailEvents = read('js/screens/pedido-detail-events.js');
const detailProgress = read('js/screens/pedido-detail-progress.js');
const detailRender = read('js/screens/pedido-detail-render.js');
const opTec = read('js/screens/op-tecelagem-producao-admin.js');
const entregaWrites = read('js/screens/entrega-writes.js');
const opsWithoutPedidoDiag = read('scripts/staging/ops-without-pedido-diag.mjs');

// ---------------------------------------------------------------------
// Contrato split Latex - db/28 prepara schema sem mudar fluxo funcional
// ---------------------------------------------------------------------

test('Contrato split Latex: db/28 preserva acumular como default e reserva split para motivo explicito', () => {
  assert.match(db28, /motivo_separacao\s+TEXT\s+NULL/i);
  assert.match(db28, /Default Latex OP: motivo_separacao IS NULL/i);
  assert.match(db28, /Future split Latex OP: motivo_separacao IS NOT NULL/i);
  assert.match(db28, /WHERE\s+tipo\s*=\s*'latex'\s+AND\s+motivo_separacao\s+IS\s+NULL/i);
  assert.match(db28, /WHERE\s+tipo\s*=\s*'latex'\s+AND\s+motivo_separacao\s+IS\s+NOT\s+NULL/i);
  assert.doesNotMatch(db28, /gerar_op_latex_split/i);
});

test('Diagnostico staging de OPs sem Pedido e read-only e bloqueia producao', () => {
  assert.match(opsWithoutPedidoDiag, /ops\?select=/);
  assert.match(opsWithoutPedidoDiag, /lotes\?select=/);
  assert.match(opsWithoutPedidoDiag, /STATUS OK/);
  assert.match(opsWithoutPedidoDiag, /STATUS ALERTA/);
  assert.match(opsWithoutPedidoDiag, /URL aponta para PRODUCAO - bloqueado/);
  assert.match(opsWithoutPedidoDiag, /URL nao e staging autorizado/);
  assert.doesNotMatch(opsWithoutPedidoDiag, /\b(?:insert|update|delete|upsert)\s*\(/i);
  assert.doesNotMatch(opsWithoutPedidoDiag, /\/rest\/v1\/rpc\//i);
});

// ---------------------------------------------------------------------
// Contrato split Latex - db/29 RPC
// ---------------------------------------------------------------------

test('Contrato split Latex: db/29 redefine gerar_op_latex e cria gerar_op_latex_split', () => {
  assert.match(db29, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.gerar_op_latex/i);
  assert.match(db29, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.gerar_op_latex_split/i);
});

test('Contrato split Latex: db/29 — gerar_op_latex so acumula em OPs default (motivo_separacao IS NULL)', () => {
  // db/29 adiciona motivo_separacao IS NULL ao SELECT e ao ON CONFLICT.
  // O predicado antigo sem AND motivo_separacao foi substituido.
  assert.match(db29, /motivo_separacao\s+IS\s+NULL/i);
  assert.match(db29, /ON\s+CONFLICT\s*\(\s*origem_op_id\s*,\s*destino_fornecedor_id\s*\)\s*WHERE\s+tipo\s*=\s*'latex'\s+AND\s+motivo_separacao\s+IS\s+NULL\s+DO\s+NOTHING/i);
  // O SELECT canonico tambem filtra motivo_separacao IS NULL
  const defaultFn = (db29.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.gerar_op_latex[\s\S]*?END;\s*\$\$;/i) || [''])[0];
  assert.match(defaultFn, /WHERE\s+tipo\s*=\s*'latex'[\s\S]*?origem_op_id\s*=\s*v_op_id[\s\S]*?destino_fornecedor_id\s*=\s*v_destino[\s\S]*?motivo_separacao\s+IS\s+NULL/i);
});

test('Contrato split Latex: gerar_op_latex_split exige p_motivo, escreve motivo_separacao e rastro', () => {
  assert.match(db29, /p_motivo\s+IS\s+NULL\s+OR\s+btrim\s*\(\s*p_motivo\s*\)\s*=\s*''/i);
  assert.match(db29, /motivo_separacao/i);
  assert.match(db29, /btrim\s*\(\s*p_motivo\s*\)/i);
  assert.match(db29, /criacao_split/i);
  assert.match(db29, /split_derivado/i);
  assert.match(db29, /'split',\s*true/i);
});

test('Contrato split Latex: split e idempotente por entrega (op_latex_entregas)', () => {
  assert.match(db29, /FROM\s+public\.op_latex_entregas[\s\S]*WHERE\s+ole\.entrega_id\s*=\s*p_entrega_id/i);
  assert.match(db29, /'already_linked',\s*true/i);
});

// ---------------------------------------------------------------------
// Contrato 6 — histórico distingue criar vs acumular
// ---------------------------------------------------------------------

test('Contrato 6: histórico Tecelagem->Acabamento distingue Criou vs Acumulou', () => {
  const slice = (detailEvents.match(/if \(key === 'Tecelagem>Acabamento'\)[\s\S]*?\n      \}/) || [''])[0];
  assert.ok(slice, 'bloco Tecelagem>Acabamento não encontrado');
  // A distinção usa a proveniência canônica ops.origem_entrega_id
  // (a 1ª entrega que criou a OP consolidada); as demais acumulam.
  assert.match(slice, /origem_entrega_id\s*===\s*entrega\.id/,
    'deve derivar criação a partir de ops.origem_entrega_id === entrega.id');
  assert.match(slice, /'Criou '/, 'deve rotular criação como "Criou "');
  assert.match(slice, /'Acumulou em '/, 'deve rotular acumulação como "Acumulou em "');
  // "Gerou" para toda entrega mentia sobre acumulação: não pode voltar.
  assert.doesNotMatch(slice, /'Gerou '/, 'não pode usar "Gerou" indiscriminadamente');
});

test('Contrato 6: toast de entrega não afirma "OP de látex gerada" (pode ter acumulado)', () => {
  assert.doesNotMatch(entregaWrites, /OP de látex gerada/,
    'toast não pode afirmar geração quando a RPC é find-or-accumulate');
  assert.match(entregaWrites, /vinculada à OP de acabamento/,
    'toast deve usar linguagem neutra de vínculo');
});

// ---------------------------------------------------------------------
// Contrato 4 — entrega parcial não é identidade/"mãe" da OP
// ---------------------------------------------------------------------

test('Contrato 4: lineage da OP Tecelagem não chama a OP de acabamento de "gerada por entrega parcial"', () => {
  assert.doesNotMatch(opTec, /gerada por entrega parcial/,
    'a OP de acabamento é consolidada por origem+fornecedor, não "gerada por entrega parcial"');
  assert.match(opTec, /consolidada desta OP de tecelagem/,
    'lineage deve descrever a OP de acabamento como consolidada da OP de tecelagem');
});

// ---------------------------------------------------------------------
// Contrato 9 — número de ACABAMENTO = "em acabamento" (recebido), não concluído
// ---------------------------------------------------------------------

test('Contrato 9: métrica-resumo do acabamento é rotulada "Em acabamento" (não "Concluído")', () => {
  assert.match(detailRender, /buildSummaryMetric\('Em acabamento'/,
    'a métrica agregada de acabamento deve ser rotulada "Em acabamento"');
});

test('Contrato 9: card do acabamento separa Recebido / Finalizado / Saldo (semântica explícita)', () => {
  assert.match(detailRender, /Recebido da tecelagem/,
    'card de acabamento deve mostrar "Recebido da tecelagem" (o que entrou)');
  assert.match(detailRender, /Finalizado \(pronto \+ entregue\)/,
    'card deve mostrar o que foi de fato finalizado');
  assert.match(detailRender, /Saldo em acabamento/,
    'card deve mostrar o saldo ainda em acabamento');
});

test('Contrato 9: o estágio ACABAMENTO só vira "concluido" via adminStepper.done, não pelo recebido', () => {
  // O sublabel exibe emAcabamento (recebido-não-finalizado) enquanto houver
  // saldo; "concluido" só é forçado quando o adminStepper marca done.
  assert.match(detailProgress, /sublabel:\s*emAcabamento\s*>\s*0\s*\?\s*ns\.fmtMetros\(emAcabamento\)/,
    'sublabel de acabamento deve refletir metros em acabamento enquanto houver saldo');
  assert.match(detailProgress, /nextState === 'done'[\s\S]{0,120}stage\.sublabel = 'concluido'/,
    '"concluido" no estágio só quando o adminStepper deriva done');
});
