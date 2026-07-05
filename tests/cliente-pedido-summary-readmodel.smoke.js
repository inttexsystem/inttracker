const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '30_cliente_pedido_summary_readmodel.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const sql = readOrFail(SQL);

test('cliente-pedido-summary-readmodel: migration existe', () => {
  assert.ok(fs.existsSync(SQL));
});

test('SQL: cria RPC publica cliente_pedido_summary(UUID) retornando JSONB', () => {
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.cliente_pedido_summary\s*\(\s*p_pedido_id\s+UUID\s*\)/i);
  assert.match(sql, /RETURNS\s+JSONB/i);
});

test('SQL: RPC e SECURITY DEFINER com search_path controlado e STABLE', () => {
  assert.match(sql, /SECURITY\s+DEFINER/i);
  assert.match(sql, /SET\s+search_path\s*=\s*public/i);
  assert.match(sql, /\bSTABLE\b/i);
});

test('SQL: checa permissao por admin ou cliente dono', () => {
  assert.match(sql, /v_is_admin\s+BOOLEAN\s*:=\s*public\.is_admin\(\)/i);
  assert.match(sql, /v_cliente_id\s+BIGINT\s*:=\s*public\.meu_cliente_id\(\)/i);
  assert.match(sql, /p\.cliente_id\s*=\s*v_cliente_id/i);
});

test('SQL: concede execucao apenas para authenticated', () => {
  assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cliente_pedido_summary\(UUID\)\s+TO\s+authenticated/i);
  assert.doesNotMatch(sql, /GRANT\s+EXECUTE[\s\S]{0,120}\bTO\s+anon\b/i);
});

test('SQL: encapsula fontes operacionais atras da RPC', () => {
  for (const table of [
    'public.ops',
    'public.lotes',
    'public.op_itens',
    'public.entrega_itens',
    'public.entregas',
    'public.ordens_compra_fio',
    'public.expedicoes',
    'public.expedicao_itens',
  ]) {
    assert.match(sql, new RegExp(table.replace('.', '\\.'), 'i'));
  }
});

test('SQL: payload publico contem chaves esperadas', () => {
  for (const key of [
    'pedido_id',
    'numero',
    'status',
    'status_label',
    'mensagem',
    'progresso_percentual',
    'etapas',
    'entregas',
    'timeline',
    'pendencias',
    'pedido',
    'itens',
    'parciais',
    'chain_state',
  ]) {
    assert.match(sql, new RegExp("'" + key + "'", 'i'), 'faltou chave publica ' + key);
  }
});

test('SQL: payload nao contem chaves internas proibidas', () => {
  for (const key of [
    'op_id',
    'op_numero',
    'lote_id',
    'fornecedor_id',
    'fornecedor_nome',
    'ordem_compra_id',
    'romaneio',
    'nf',
    'custo',
    'margem',
    'motivo_separacao',
    'origem_op_id',
    'destino_fornecedor_id',
    'modelo_id',
    'cor_1_id',
    'cor_2_id',
    'expedicao_id',
  ]) {
    assert.doesNotMatch(sql, new RegExp("'" + key + "'", 'i'), 'chave proibida no payload: ' + key);
  }
});

test('SQL: itens saem como dados publicos nomeados, sem IDs de catalogo', () => {
  assert.match(sql, /'modelo'/);
  assert.match(sql, /'cor_1'/);
  assert.match(sql, /'cor_2'/);
  assert.match(sql, /'metros'/);
  assert.doesNotMatch(sql, /'id'\s*,\s*pi\.id/i);
});

test('SQL: parciais e timeline filtram somente informacao visivel ao cliente', () => {
  assert.match(sql, /pp\.visivel_cliente\s+IS\s+TRUE/i);
  assert.match(sql, /pce\.visivel_cliente\s+IS\s+TRUE/i);
  assert.doesNotMatch(sql, /'metadata'/i);
  assert.doesNotMatch(sql, /'criado_por'/i);
  assert.doesNotMatch(sql, /'origem'/i);
});

test('SQL: nao executa writes ou comandos destrutivos', () => {
  assert.doesNotMatch(sql, /^\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sql, /^\s*UPDATE\s+/im);
  assert.doesNotMatch(sql, /^\s*INSERT\s+INTO\b/im);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /supabase\/functions/i);
});

test('SQL: termina com reload do schema cache', () => {
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+schema'/i);
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+config'/i);
});
