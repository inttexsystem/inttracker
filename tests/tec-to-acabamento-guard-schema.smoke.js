// =====================================================================
// === tests/tec-to-acabamento-guard-schema.smoke.js ==================
// Smoke estático da migration D-C-B: guard server-side que impede
// alteração/exclusão de entrega de Tecelagem (etapa='cima') quando já
// gerou OP de Acabamento/Látex (ops.origem_entrega_id).
//
// Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-FLOW-CONTRACT-C-B
//
// Valida por leitura do SQL (sem executar a migration):
//   - arquivo db/24_tec_to_acabamento_guard.sql existe;
//   - trigger BEFORE UPDATE OR DELETE ON entregas;
//   - trigger BEFORE INSERT OR UPDATE OR DELETE ON entrega_itens;
//   - referencia origem_entrega_id;
//   - referencia tipo = 'latex';
//   - referencia app.retificacao_autorizada + current_setting;
//   - usa DROP TRIGGER IF EXISTS (idempotente);
//   - contém NOTIFY pgrst;
//   - NÃO altera dados (sem UPDATE/DELETE em entregas/entrega_itens);
//   - NÃO altera ops.status;
//   - NÃO altera gerar_op_latex.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(ROOT, 'db', '24_tec_to_acabamento_guard.sql');
const rawSql = fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : '';

// SQL efetivo: remove comentários de linha (`-- ...`) para evitar
// falsos positivos em verificações negativas (ex.: nomes como
// `ops.status` ou `gerar_op_latex` citados em comentários).
const stripLineComments = (s) => s.replace(/^\s*--.*$/gm, '');
const sql = stripLineComments(rawSql);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('db/24_tec_to_acabamento_guard.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION), 'migration db/24_tec_to_acabamento_guard.sql não existe');
});

// ---------------------------------------------------------------------
// 2. Triggers — presença e alvos
// ---------------------------------------------------------------------

test('define trigger BEFORE UPDATE OR DELETE ON entregas', () => {
  assert.match(sql, /CREATE\s+TRIGGER\s+entrega_cima_latex_guard/i);
  assert.match(sql, /BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.entregas/i,
    'deve haver trigger BEFORE UPDATE OR DELETE em entregas');
});

test('define trigger BEFORE INSERT OR UPDATE OR DELETE ON entrega_itens', () => {
  assert.match(sql, /CREATE\s+TRIGGER\s+entrega_itens_cima_latex_guard/i);
  assert.match(sql, /BEFORE\s+INSERT\s+OR\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.entrega_itens/i,
    'deve haver trigger BEFORE INSERT OR UPDATE OR DELETE em entrega_itens');
});

test('usa FOR EACH ROW em ambos triggers', () => {
  const triggers = sql.match(/CREATE\s+TRIGGER[\s\S]*?EXECUTE\s+FUNCTION/gi) || [];
  assert.ok(triggers.length >= 2, 'deve haver ao menos 2 triggers');
  triggers.forEach(t => {
    assert.match(t, /FOR\s+EACH\s+ROW/i, 'trigger deve ser FOR EACH ROW');
  });
});

// ---------------------------------------------------------------------
// 3. Condição de bloqueio
// ---------------------------------------------------------------------

test('referencia origem_entrega_id como vínculo da OP Látex', () => {
  assert.match(sql, /origem_entrega_id/i, 'deve referenciar origem_entrega_id');
});

test('referencia tipo = latex na condição de bloqueio', () => {
  assert.match(sql, /tipo\s*=\s*['"]latex['"]/i,
    'deve filtrar ops por tipo = latex');
});

test('trigger de entregas restringe a etapa = cima', () => {
  // A função do trigger de entregas deve checar OLD.etapa = 'cima'.
  // Captura do CREATE OR REPLACE FUNCTION até o `$$;` de fechamento
  // (a regex exige o `;` após o `$$` final para não parar no `AS $$`).
  const fnSlice = (sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.entrega_cima_latex_guard_fn\(\)[\s\S]*?END;\s*\$\$;/i) || [''])[0];
  assert.ok(fnSlice, 'função entrega_cima_latex_guard_fn não encontrada');
  assert.match(fnSlice, /OLD\.etapa\s*=\s*['"]cima['"]/i,
    'trigger de entregas deve restringir a etapa = cima');
});

// ---------------------------------------------------------------------
// 4. Escape por GUC de retificação
// ---------------------------------------------------------------------

test('usa current_setting com app.retificacao_autorizada', () => {
  assert.match(sql, /current_setting\(\s*['"]app\.retificacao_autorizada['"]\s*,\s*true\s*\)/i,
    'deve usar current_setting para o GUC app.retificacao_autorizada');
  assert.match(sql, /IS\s+DISTINCT\s+FROM\s*['"]on['"]/i,
    'deve comparar com IS DISTINCT FROM on');
});

// ---------------------------------------------------------------------
// 5. Idempotência e reload
// ---------------------------------------------------------------------

test('usa DROP TRIGGER IF EXISTS antes de CREATE (idempotente)', () => {
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+entrega_cima_latex_guard\s+ON\s+public\.entregas/i);
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+entrega_itens_cima_latex_guard\s+ON\s+public\.entrega_itens/i);
});

test('usa CREATE OR REPLACE FUNCTION (idempotente)', () => {
  const fns = sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION/gi) || [];
  assert.ok(fns.length >= 2, 'deve haver ao menos 2 CREATE OR REPLACE FUNCTION');
});

test('contém NOTIFY pgrst para reload', () => {
  assert.match(sql, /NOTIFY\s+pgrst/i);
});

// ---------------------------------------------------------------------
// 6. Não altera dados / não mexe em contrato alheio
// ---------------------------------------------------------------------

test('NÃO altera dados: sem UPDATE entregas', () => {
  assert.doesNotMatch(sql, /UPDATE\s+public\.entregas\b/i);
});

test('NÃO altera dados: sem DELETE FROM entregas', () => {
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.entregas\b/i);
});

test('NÃO altera dados: sem UPDATE entrega_itens', () => {
  assert.doesNotMatch(sql, /UPDATE\s+public\.entrega_itens\b/i);
});

test('NÃO altera dados: sem DELETE FROM entrega_itens', () => {
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.entrega_itens\b/i);
});

test('NÃO altera ops.status', () => {
  // A migration só cria triggers/funções; não deve tocar em ops.
  // Verificações em `sql` (sem comentários) para não cair em
  // referências apenas documentais.
  assert.doesNotMatch(sql, /UPDATE\s+public\.ops\b/i);
  assert.doesNotMatch(sql, /ops\.status/i);
});

test('NÃO altera gerar_op_latex', () => {
  // Verificação em `sql` (sem comentários) — nomes como
  // `gerar_op_latex` podem aparecer em comentários documentais.
  assert.doesNotMatch(sql, /gerar_op_latex/i,
    'não deve referenciar gerar_op_latex em código efetivo');
});

test('NÃO cria/dropa tabelas', () => {
  assert.doesNotMatch(sql, /CREATE\s+TABLE/i);
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
});

// ---------------------------------------------------------------------
// 7. Mensagens objetivas
// ---------------------------------------------------------------------

test('mensagens de erro mencionam retificação autorizada', () => {
  assert.match(sql, /retificação autorizada/i);
});
