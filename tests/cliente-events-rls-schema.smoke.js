const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '16_pedido_cliente_eventos_cliente_select.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const sql = readOrFail(SQL);

function blockAround(src, marker, extra = 900) {
  const idx = src.indexOf(marker);
  assert.ok(idx >= 0, 'marcador nao encontrado: ' + marker);
  return src.slice(Math.max(0, idx - 200), idx + extra);
}

test('arquivo db/16_pedido_cliente_eventos_cliente_select.sql existe', () => {
  assert.ok(fs.existsSync(SQL), 'db/16_pedido_cliente_eventos_cliente_select.sql ausente');
});

test('SQL: cria policy pedido_cliente_eventos_cliente_select', () => {
  assert.match(sql, /CREATE\s+POLICY\s+pedido_cliente_eventos_cliente_select/i);
});

test('SQL: usa FOR SELECT', () => {
  const bloco = blockAround(sql, 'CREATE POLICY pedido_cliente_eventos_cliente_select');
  assert.match(bloco, /FOR\s+SELECT/i);
});

test('SQL: exige visivel_cliente = true', () => {
  assert.match(sql, /visivel_cliente\s*=\s*true/i);
});

test('SQL: usa EXISTS com public.pedidos', () => {
  assert.match(sql, /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.pedidos\s+p/i);
});

test('SQL: compara p.id = pedido_cliente_eventos.pedido_id', () => {
  assert.match(sql, /p\.id\s*=\s*pedido_cliente_eventos\.pedido_id/i);
});

test('SQL: compara p.cliente_id = public.meu_cliente_id()', () => {
  assert.match(sql, /p\.cliente_id\s*=\s*public\.meu_cliente_id\(\)/i);
});

test('SQL: nao cria INSERT/UPDATE/DELETE para cliente', () => {
  assert.doesNotMatch(sql, /FOR\s+INSERT/i);
  assert.doesNotMatch(sql, /FOR\s+UPDATE/i);
  assert.doesNotMatch(sql, /FOR\s+DELETE/i);
  assert.doesNotMatch(sql, /WITH\s+CHECK/i);
});

test('SQL: nao remove policy admin', () => {
  assert.doesNotMatch(sql, /DROP\s+POLICY\s+IF\s+EXISTS\s+pedido_cliente_eventos_admin_all/i);
});

test('SQL: nao contem service_role', () => {
  assert.doesNotMatch(sql, /service_role/i);
});

test('SQL: nao contem OP, lote, fornecedor, NF, romaneio, custo ou margem', () => {
  assert.doesNotMatch(sql, /\bOP\b/);
  assert.doesNotMatch(sql, /\blote\b/i);
  assert.doesNotMatch(sql, /fornecedor/i);
  assert.doesNotMatch(sql, /\bNF\b/);
  assert.doesNotMatch(sql, /romaneio/i);
  assert.doesNotMatch(sql, /custo/i);
  assert.doesNotMatch(sql, /margem/i);
});

test('SQL: nao altera public.pedidos', () => {
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+public\.pedidos/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.pedidos/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.pedidos/i);
});

test('SQL: nao cria view ou RPC', () => {
  assert.doesNotMatch(sql, /CREATE\s+VIEW/i);
  assert.doesNotMatch(sql, /CREATE\s+OR\s+REPLACE\s+VIEW/i);
  assert.doesNotMatch(sql, /CREATE\s+FUNCTION/i);
  assert.doesNotMatch(sql, /\.rpc\s*\(/i);
});
