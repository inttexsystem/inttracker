const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const SQL = path.join(ROOT, 'db', '30_cliente_pedido_summary_readmodel.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const sql = readOrFail(SQL);

test('cliente-pedido-events: arquivo screen existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedido-detail.js ausente');
});

test('cliente-pedido-events: sintaxe JS valida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('cliente-pedido-events: timeline vem do payload publico da RPC', () => {
  assert.match(screen, /\.rpc\(\s*['"]cliente_pedido_summary['"]/);
  assert.match(screen, /payload\.timeline/);
  assert.match(screen, /criado_em:\s*evento\.data/);
  assert.match(screen, /mensagem:\s*evento\.descricao/);
  assert.equal(/from\(['"]pedido_cliente_eventos['"]\)/.test(screen), false);
});

test('cliente-pedido-events: read model filtra eventos visiveis e retorna somente campos publicos', () => {
  assert.match(sql, /FROM\s+public\.pedido_cliente_eventos\s+pce/i);
  assert.match(sql, /pce\.visivel_cliente\s+IS\s+TRUE/i);
  assert.match(sql, /'data'\s*,\s*pce\.criado_em/i);
  assert.match(sql, /'titulo'\s*,\s*pce\.titulo/i);
  assert.match(sql, /'descricao'\s*,\s*pce\.mensagem/i);
  assert.doesNotMatch(sql, /'metadata'/i);
  assert.doesNotMatch(sql, /'criado_por'/i);
  assert.doesNotMatch(sql, /'origem'/i);
});

test('cliente-pedido-events: nao usa select(*) em nenhum lugar do screen', () => {
  assert.doesNotMatch(screen, /\.select\(\s*['"]\*['"]\s*\)/);
});

test('cliente-pedido-events: nao consulta a tabela interna pedido_eventos', () => {
  assert.equal(/from\(['"]pedido_eventos['"]\)/.test(screen), false);
});

test('cliente-pedido-events: nao faz writes', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false);
  assert.equal(/\.update\s*\(/.test(screen), false);
  assert.equal(/\.delete\s*\(/.test(screen), false);
  assert.equal(/\.upsert\s*\(/.test(screen), false);
});

test('cliente-pedido-events: nao referencia functions.invoke, service_role nem token_acesso', () => {
  assert.equal(/functions\.invoke/.test(screen), false);
  assert.equal(/service_role/.test(screen), false);
  assert.equal(/token_acesso/.test(screen), false);
});

test('cliente-pedido-events: nao referencia OP, lote, fornecedor, NF, romaneio, custo ou margem', () => {
  assert.equal(/\bop\b/i.test(screen), false);
  assert.equal(/\blote\b/i.test(screen), false);
  assert.equal(/fornecedor/i.test(screen), false);
  assert.equal(/\bNF\b/.test(screen), false);
  assert.equal(/romaneio/i.test(screen), false);
  assert.equal(/custo/i.test(screen), false);
  assert.equal(/margem/i.test(screen), false);
});

test('cliente-pedido-events: renderiza a secao Historico', () => {
  assert.match(screen, /Hist[oó]rico/i);
});

test('cliente-pedido-events: possui empty state quando nao ha eventos', () => {
  assert.match(screen, /Assim que houver novas atualiza[cç][oõ]es, elas aparecer[aã]o aqui\./);
  assert.match(screen, /state\.eventos\.length\s*===\s*0/);
});

test('cliente-pedido-events: erro da timeline nao quebra a tela separadamente', () => {
  assert.match(screen, /eventosError/);
  assert.equal(/loadingError\s*=\s*['"]eventos['"]/.test(screen), false);
});

test('cliente-pedido-events: nao expoe admin', () => {
  assert.equal(/RAVATEX_SCREENS\.pedidoTrackingAdmin/.test(screen), false);
  assert.equal(/buildPedidoTrackingAdminCard/.test(screen), false);
});
