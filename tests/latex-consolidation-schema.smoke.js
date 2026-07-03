// =====================================================================
// === tests/latex-consolidation-schema.smoke.js =======================
// Smoke estático da migration db/25_latex_consolidation.sql.
//
// Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-CONSOLIDATED-LATEX-OP-A
//
// Valida por leitura do SQL (sem executar a migration) que a correção
// estrutural do fluxo TECELAGEM -> ACABAMENTO está presente:
//   - ops.destino_fornecedor_id (coluna + backfill);
//   - tabela op_latex_entregas (N entregas -> 1 OP Látex) com UNIQUE(entrega_id);
//   - backfill de op_latex_entregas a partir de origem_entrega_id;
//   - reconciliação de duplicatas com HARD-STOP (RAISE) se houver
//     downstream (status<>aberta, recebimento latex, expedição);
//   - troca do índice: dropa ops_origem_entrega_latex_uidx e cria
//     UNIQUE parcial (origem_op_id, destino_fornecedor_id) WHERE tipo='latex';
//   - gerar_op_latex find-or-accumulate (chave origem_op_id+destino,
//     vínculo op_latex_entregas, acúmulo de op_itens sem apagar linhas);
//   - guards passam a checar op_latex_entregas;
//   - idempotência + NOTIFY pgrst.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(ROOT, 'db', '25_latex_consolidation.sql');
const rawSql = fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : '';
const stripLineComments = (s) => s.replace(/^\s*--.*$/gm, '');
const sql = stripLineComments(rawSql);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('db/25_latex_consolidation.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION), 'migration db/25_latex_consolidation.sql não existe');
});

// ---------------------------------------------------------------------
// 2. Coluna destino_fornecedor_id em ops
// ---------------------------------------------------------------------

test('adiciona ops.destino_fornecedor_id (idempotente)', () => {
  assert.match(sql, /ALTER\s+TABLE\s+public\.ops\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+destino_fornecedor_id\s+BIGINT/i);
});

test('backfill de destino_fornecedor_id a partir de op_fornecedores(etapa=latex)', () => {
  assert.match(sql, /UPDATE\s+public\.ops\s+o[\s\S]*op_fornecedores\s+ofn[\s\S]*ofn\.etapa\s*=\s*'latex'/i);
});

// ---------------------------------------------------------------------
// 3. Tabela de vínculo N:1
// ---------------------------------------------------------------------

test('cria op_latex_entregas com UNIQUE(entrega_id) (uma entrega -> uma OP)', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.op_latex_entregas/i);
  const tableSlice = (sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.op_latex_entregas[\s\S]*?\);/i) || [''])[0];
  assert.match(tableSlice, /op_latex_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+public\.ops\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(tableSlice, /entrega_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+public\.entregas\(id\)/i);
  assert.match(tableSlice, /UNIQUE\s*\(\s*entrega_id\s*\)/i);
});

test('backfill de op_latex_entregas a partir do vínculo legado origem_entrega_id', () => {
  assert.match(sql, /INSERT\s+INTO\s+public\.op_latex_entregas[\s\S]*origem_entrega_id[\s\S]*ON\s+CONFLICT\s*\(\s*entrega_id\s*\)\s+DO\s+NOTHING/i);
});

// ---------------------------------------------------------------------
// 4. Reconciliação de duplicatas com hard-stop
// ---------------------------------------------------------------------

test('reconciliação agrupa por (origem_op_id, destino_fornecedor_id) com HAVING count(*) > 1', () => {
  assert.match(sql, /GROUP\s+BY\s+o\.origem_op_id,\s*o\.destino_fornecedor_id[\s\S]*HAVING\s+count\(\*\)\s*>\s*1/i);
});

test('reconciliação faz HARD-STOP (RAISE) para OP não-aberta / recebimento latex / expedição', () => {
  const raises = sql.match(/RAISE\s+EXCEPTION\s+'Consolidacao abortada/gi) || [];
  assert.ok(raises.length >= 3, 'esperado >= 3 hard-stops (status, recebimento latex, expedição)');
  assert.match(sql, /o\.status\s*<>\s*'aberta'/i);
  assert.match(sql, /e\.etapa\s*=\s*'latex'/i);
  assert.match(sql, /FROM\s+public\.expedicoes\s+x[\s\S]*op_latex_id\s*=\s*ANY/i);
});

test('reconciliação acumula op_itens por modelo (upsert) e NÃO apaga op_itens', () => {
  assert.match(sql, /UPDATE\s+public\.op_itens\s+c[\s\S]*metros_pedidos\s*=\s*c\.metros_pedidos\s*\+/i);
  // op_itens é referenciado por expedicao_itens (ON DELETE RESTRICT):
  // a migration nunca deve apagar linhas de op_itens diretamente.
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.op_itens\b/i);
});

// ---------------------------------------------------------------------
// 5. Índice: troca a chave de identidade
// ---------------------------------------------------------------------

test('substitui o índice por-entrega pelo índice consolidado', () => {
  assert.match(sql, /DROP\s+INDEX\s+IF\s+EXISTS\s+public\.ops_origem_entrega_latex_uidx/i);
  assert.match(sql, /CREATE\s+UNIQUE\s+INDEX\s+ops_latex_origem_destino_uidx\s+ON\s+public\.ops\s*\(\s*origem_op_id,\s*destino_fornecedor_id\s*\)\s*WHERE\s+tipo\s*=\s*'latex'/i);
});

// ---------------------------------------------------------------------
// 6. gerar_op_latex find-or-accumulate
// ---------------------------------------------------------------------

test('gerar_op_latex é redefinida (CREATE OR REPLACE) com find-or-accumulate', () => {
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.gerar_op_latex\(p_entrega_id\s+BIGINT\)/i);
  const fnSlice = (sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.gerar_op_latex[\s\S]*?END;\s*\$\$;/i) || [''])[0];
  assert.ok(fnSlice, 'corpo de gerar_op_latex não encontrado');
  // Idempotência por entrega via op_latex_entregas.
  assert.match(fnSlice, /FROM\s+public\.op_latex_entregas\s+WHERE\s+entrega_id\s*=\s*p_entrega_id/i);
  // Chave de consolidação.
  assert.match(fnSlice, /origem_op_id\s*=\s*v_op_id[\s\S]*destino_fornecedor_id\s*=\s*v_destino/i);
  // Vincula a entrega (N:1) de forma idempotente.
  assert.match(fnSlice, /INSERT\s+INTO\s+public\.op_latex_entregas[\s\S]*ON\s+CONFLICT\s*\(\s*entrega_id\s*\)\s+DO\s+NOTHING/i);
  // Acúmulo incremental de op_itens (não recria linhas).
  assert.match(fnSlice, /UPDATE\s+public\.op_itens\s+c[\s\S]*metros_pedidos\s*=\s*c\.metros_pedidos\s*\+/i);
  assert.doesNotMatch(fnSlice, /DELETE\s+FROM\s+public\.op_itens\b/i);
});

// ---------------------------------------------------------------------
// 7. Guards passam a checar op_latex_entregas
// ---------------------------------------------------------------------

test('guards (entregas / entrega_itens) checam op_latex_entregas', () => {
  const guardEntregas = (sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.entrega_cima_latex_guard_fn[\s\S]*?END;\s*\$\$;/i) || [''])[0];
  const guardItens = (sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.entrega_itens_cima_latex_guard_fn[\s\S]*?END;\s*\$\$;/i) || [''])[0];
  assert.ok(guardEntregas, 'guard de entregas não encontrado');
  assert.ok(guardItens, 'guard de entrega_itens não encontrado');
  assert.match(guardEntregas, /op_latex_entregas\s+ole\s+WHERE\s+ole\.entrega_id\s*=\s*OLD\.id/i);
  assert.match(guardItens, /op_latex_entregas\s+ole\s+WHERE\s+ole\.entrega_id\s*=\s*v_entrega_id/i);
  // Mantém o escape por GUC de retificação.
  assert.match(guardEntregas, /current_setting\(\s*'app\.retificacao_autorizada'/i);
});

// ---------------------------------------------------------------------
// 8. Idempotência e reload
// ---------------------------------------------------------------------

test('idempotência: usa IF NOT EXISTS / CREATE OR REPLACE e NOTIFY pgrst', () => {
  assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
  assert.match(sql, /NOTIFY\s+pgrst/i);
});

test('não cria/dropa tabelas de dados destrutivamente (só op_latex_entregas via IF NOT EXISTS)', () => {
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
});
