// =====================================================================
// === tests/production-flow-numbering-schema.smoke.js =================
// Smoke estatico da migration db/26_production_flow_invariants.sql.
//
// Fase: RAVATEX-TAPETES-OP-NUMBERING-MONOTONIC-DB26-A
//
// Valida por leitura de arquivos, sem executar DDL e sem acessar Supabase:
//   - op_numeros como high-water por tipo/ano;
//   - proximo_numero_op lock-safe por UPSERT;
//   - gerar_op_latex sem MAX(numero)+1 e chamando proximo_numero_op;
//   - retorno operacional da RPC;
//   - politica anti-delete fisico de OP numerada;
//   - entrega-writes.js consumindo created/accumulated/already_linked.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(ROOT, 'db', '26_production_flow_invariants.sql');
const ENTREGA_WRITES = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');

const rawSql = fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : '';
const sql = rawSql.replace(/^\s*--.*$/gm, '');
const entregaWrites = fs.existsSync(ENTREGA_WRITES) ? fs.readFileSync(ENTREGA_WRITES, 'utf8') : '';

function fnSlice(name) {
  const re = new RegExp(
    'CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + name + '[\\s\\S]*?\\n\\$\\$;',
    'i',
  );
  return (sql.match(re) || [''])[0];
}

test('db/26_production_flow_invariants.sql existe', () => {
  assert.ok(fs.existsSync(MIGRATION), 'migration db/26_production_flow_invariants.sql nao existe');
});

test('op_numeros existe como high-water por tipo/ano', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.op_numeros/i);
  const tableSlice = (sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.op_numeros[\s\S]*?\);/i) || [''])[0];
  assert.match(tableSlice, /tipo\s+TEXT\s+NOT\s+NULL/i);
  assert.match(tableSlice, /ano\s+INTEGER\s+NOT\s+NULL/i);
  assert.match(tableSlice, /ultimo_numero\s+INTEGER\s+NOT\s+NULL/i);
  assert.match(tableSlice, /PRIMARY\s+KEY\s*\(\s*tipo,\s*ano\s*\)/i);
});

test('backfill de op_numeros usa MAX atual sem reduzir high-water', () => {
  assert.match(sql, /INSERT\s+INTO\s+public\.op_numeros[\s\S]*MAX\s*\(\s*o\.numero\s*\)[\s\S]*GROUP\s+BY\s+o\.tipo,\s*o\.ano/i);
  assert.match(sql, /ON\s+CONFLICT\s*\(\s*tipo,\s*ano\s*\)\s+DO\s+UPDATE[\s\S]*GREATEST\s*\(\s*public\.op_numeros\.ultimo_numero,\s*EXCLUDED\.ultimo_numero\s*\)/i);
});

test('proximo_numero_op existe e incrementa por UPSERT lock-safe', () => {
  const slice = fnSlice('proximo_numero_op');
  assert.ok(slice, 'funcao proximo_numero_op nao encontrada');
  assert.match(slice, /RETURNS\s+INTEGER/i);
  assert.match(slice, /INSERT\s+INTO\s+public\.op_numeros\s+AS\s+n/i);
  assert.match(slice, /ON\s+CONFLICT\s*\(\s*tipo,\s*ano\s*\)\s+DO\s+UPDATE/i);
  assert.match(slice, /ultimo_numero\s*=\s*n\.ultimo_numero\s*\+\s*1/i);
  assert.match(slice, /RETURNING\s+ultimo_numero\s+INTO\s+v_numero/i);
});

test('gerar_op_latex nao usa MAX(numero)+1', () => {
  const slice = fnSlice('gerar_op_latex');
  assert.ok(slice, 'funcao gerar_op_latex nao encontrada');
  assert.doesNotMatch(slice, /MAX\s*\(\s*numero\s*\)\s*\+\s*1/i);
  assert.doesNotMatch(slice, /COALESCE\s*\(\s*MAX\s*\(\s*numero\s*\)\s*,\s*0\s*\)\s*\+\s*1/i);
});

test('gerar_op_latex chama proximo_numero_op', () => {
  const slice = fnSlice('gerar_op_latex');
  assert.match(slice, /public\.proximo_numero_op\s*\(\s*'latex'\s*,\s*v_ano\s*\)/i);
});

test('gerar_op_latex retorna flags operacionais e identificacao da OP', () => {
  const slice = fnSlice('gerar_op_latex');
  assert.match(slice, /RETURNS\s+JSONB/i);
  for (const key of ['created', 'accumulated', 'already_linked', 'numero', 'ano', 'op_latex_id']) {
    assert.match(slice, new RegExp("'" + key + "'", 'i'), 'retorno nao contem chave ' + key);
  }
});

test('gerar_op_latex preserva consolidacao por origem_op_id + destino_fornecedor_id', () => {
  const slice = fnSlice('gerar_op_latex');
  assert.match(slice, /WHERE\s+tipo\s*=\s*'latex'[\s\S]*origem_op_id\s*=\s*v_op_id[\s\S]*destino_fornecedor_id\s*=\s*v_destino/i);
  assert.match(slice, /INSERT\s+INTO\s+public\.op_latex_entregas[\s\S]*ON\s+CONFLICT\s*\(\s*entrega_id\s*\)\s+DO\s+NOTHING/i);
});

test('migration nao contem DELETE fisico de ops para reconciliacao futura', () => {
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+(?:public\.)?ops\b/i);
});

test('politica anti-delete fisico de OP numerada esta documentada e estruturada', () => {
  assert.match(rawSql, /ops_numeradas_no_delete/i);
  assert.match(rawSql, /OP numerada nao deve ser removida fisicamente/i);
  assert.match(rawSql, /Reconciliacoes futuras devem cancelar\/arquivar\/consolidar com rastro/i);
});

test('entrega-writes.js trata created/accumulated/already_linked da RPC', () => {
  assert.match(entregaWrites, /created\s*===\s*true[\s\S]*Criou\s+/);
  assert.match(entregaWrites, /accumulated\s*===\s*true[\s\S]*Acumulou na\s+/);
  assert.match(entregaWrites, /already_linked\s*===\s*true[\s\S]*J[aá]\s+vinculada\s+[àa]\s+/i);
  assert.match(entregaWrites, /normalizeGerarOpLatexResult/);
});
