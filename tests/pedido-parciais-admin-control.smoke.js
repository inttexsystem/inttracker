const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_MODULE = path.join(ROOT, 'js', 'screens', 'pedido-parciais-admin.js');
const DETAIL = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const TRACKING_UI = path.join(ROOT, 'js', 'pedido-tracking-ui.js');
const INDEX = path.join(ROOT, 'index.html');
const CLIENT_DETAIL = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const CLIENT_LIST = path.join(ROOT, 'js', 'screens', 'cliente-pedidos-list.js');
const CLIENT_DASHBOARD = path.join(ROOT, 'js', 'screens', 'cliente-dashboard.js');
const CLIENT_TRACKING = path.join(ROOT, 'js', 'screens', 'cliente-pedido-tracking.js');

function readOrFail(file) {
  assert.ok(fs.existsSync(file), 'arquivo nao encontrado: ' + file);
  return fs.readFileSync(file, 'utf8');
}

const adminSrc = readOrFail(ADMIN_MODULE);
const detailSrc = readOrFail(DETAIL);
const trackingUiSrc = readOrFail(TRACKING_UI);
const indexSrc = readOrFail(INDEX);
const clientDetailSrc = readOrFail(CLIENT_DETAIL);
const clientListSrc = readOrFail(CLIENT_LIST);
const clientDashboardSrc = readOrFail(CLIENT_DASHBOARD);
const clientTrackingSrc = readOrFail(CLIENT_TRACKING);

test('pedido-parciais-admin: arquivo existe', () => {
  assert.ok(fs.existsSync(ADMIN_MODULE), 'js/screens/pedido-parciais-admin.js ausente');
});

test('pedido-parciais-admin: sintaxe JS valida', () => {
  require('node:child_process').execFileSync(
    process.execPath,
    ['--check', ADMIN_MODULE],
    { stdio: 'pipe' }
  );
});

test('pedido-parciais-admin: expoe buildPedidoParciaisAdminCard', () => {
  const sandbox = { window: { RAVATEX_SCREENS: {} }, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(adminSrc, sandbox, { filename: 'js/screens/pedido-parciais-admin.js' });
  assert.equal(typeof sandbox.window.buildPedidoParciaisAdminCard, 'function');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoParciaisAdmin, 'object');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoParciaisAdmin.buildPedidoParciaisAdminCard, 'function');
});

test('pedido-detail integra a secao "Parciais do pedido"', () => {
  assert.match(detailSrc, /buildPedidoParciaisAdminCard/);
  assert.match(detailSrc, /buildParciaisAdmin/);
  assert.match(adminSrc, /Parciais do pedido/);
});

test('pedido-parciais-admin: secao e admin-only', () => {
  assert.match(adminSrc, /CURRENT_USER\.tipo\s*!==\s*['"]admin['"]/);
});

test('index.html carrega pedido-parciais-admin.js exatamente uma vez antes de pedido-detail.js', () => {
  const matches = indexSrc.match(/js\/screens\/pedido-parciais-admin\.js/g) || [];
  assert.equal(matches.length, 1);
  const idxAdmin = indexSrc.indexOf('js/screens/pedido-parciais-admin.js');
  const idxDetail = indexSrc.indexOf('js/screens/pedido-detail.js');
  assert.ok(idxAdmin > 0);
  assert.ok(idxDetail > 0);
  assert.ok(idxAdmin < idxDetail, 'pedido-parciais-admin.js deve vir antes de pedido-detail.js');
});

test('pedido-parciais-admin usa tabela pedido_parciais para select e insert', () => {
  assert.match(adminSrc, /from\(\s*['"]pedido_parciais['"]\s*\)/);
  assert.match(adminSrc, /\.insert\(\s*payload\s*\)/);
});

test('pedido-parciais-admin usa SELECT explicito sem select(*)', () => {
  assert.match(
    adminSrc,
    /\.select\(\s*['"]id,\s*pedido_id,\s*sequencia,\s*situacao,\s*metros,\s*data_referencia,\s*titulo,\s*mensagem_cliente,\s*visivel_cliente,\s*criado_em,\s*atualizado_em['"]\s*\)/
  );
  assert.doesNotMatch(adminSrc, /\.select\(\s*['"]\*['"]\s*\)/);
});

test('pedido-parciais-admin: nao seleciona metadata, criado_por, origem ou observacao_admin', () => {
  const selectMatch = adminSrc.match(/\.select\(\s*['"]([^'"]*)['"]\s*\)/);
  assert.ok(selectMatch, 'select de pedido_parciais nao encontrado');
  const selectCols = selectMatch[1];
  assert.equal(selectCols.includes('metadata'), false);
  assert.equal(selectCols.includes('criado_por'), false);
  assert.equal(selectCols.includes('origem'), false);
  assert.equal(selectCols.includes('observacao_admin'), false);
});

test('pedido-parciais-admin: insert define origem manual e visivel_cliente', () => {
  assert.match(adminSrc, /origem:\s*['"]manual['"]/);
  assert.match(adminSrc, /visivel_cliente/);
});

test('pedido-parciais-admin usa CURRENT_USER.id para criado_por quando disponivel', () => {
  assert.match(adminSrc, /window\.CURRENT_USER/);
  assert.match(adminSrc, /CURRENT_USER\.id/);
  assert.match(adminSrc, /criado_por/);
});

test('pedido-parciais-admin: nao usa pedido_parcial_itens como obrigatorio', () => {
  assert.doesNotMatch(adminSrc, /from\(\s*['"]pedido_parcial_itens['"]\s*\)/);
  assert.doesNotMatch(adminSrc, /pedido_parcial_itens/);
});

test('pedido-parciais-admin: nao insere em pedido_cliente_eventos nem altera status visual', () => {
  assert.doesNotMatch(adminSrc, /from\(\s*['"]pedido_cliente_eventos['"]\s*\)/);
  assert.doesNotMatch(adminSrc, /status_cliente_visual/);
  assert.doesNotMatch(adminSrc, /status_cliente_excecao/);
  assert.doesNotMatch(adminSrc, /status_cliente_mensagem/);
});

test('pedido-parciais-admin usa catalogo/helper compartilhado de parciais', () => {
  assert.match(adminSrc, /window\.RavatexPedidoTracking/);
  assert.match(adminSrc, /CLIENTE_PARCIAL_SITUACOES/);
  assert.match(adminSrc, /buildPedidoAcompanhamentoParcial/);
  assert.doesNotMatch(adminSrc, /var\s+CLIENTE_PARCIAL_SITUACOES\s*=\s*\[/);
});

test('pedido-parciais-admin tolera metros_total nulo com helper compartilhado', () => {
  assert.match(adminSrc, /buildPedidoAcompanhamentoParcial/);
  assert.match(trackingUiSrc, /resolveMetrosTotal/);
});

test('pedido-parciais-admin nao usa service_role, SQL ou automacao', () => {
  assert.doesNotMatch(adminSrc, /service_role/i);
  assert.doesNotMatch(adminSrc, /\bCREATE\s+TABLE\b/i);
  assert.doesNotMatch(adminSrc, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(adminSrc, /automacao/i);
});

test('pedido-parciais-admin nao contem termos internos proibidos no contexto cliente', () => {
  assert.doesNotMatch(adminSrc, /\bOP\b/);
  assert.doesNotMatch(adminSrc, /\blote\b/i);
  assert.doesNotMatch(adminSrc, /fornecedor/i);
  assert.doesNotMatch(adminSrc, /\bNF\b/);
  assert.doesNotMatch(adminSrc, /romaneio/i);
  assert.doesNotMatch(adminSrc, /custo/i);
  assert.doesNotMatch(adminSrc, /margem/i);
});

test('telas cliente nao consultam pedido_parciais nesta fase', () => {
  assert.doesNotMatch(clientDetailSrc, /pedido_parciais/);
  assert.doesNotMatch(clientListSrc, /pedido_parciais/);
  assert.doesNotMatch(clientDashboardSrc, /pedido_parciais/);
  assert.doesNotMatch(clientTrackingSrc, /pedido_parciais/);
});

test('telas cliente nao foram convertidas para writes ou leitura parcial', () => {
  assert.doesNotMatch(clientDetailSrc, /\.insert\s*\(/);
  assert.doesNotMatch(clientDetailSrc, /\.update\s*\(/);
  assert.doesNotMatch(clientListSrc, /\.insert\s*\(/);
  assert.doesNotMatch(clientListSrc, /\.update\s*\(/);
  assert.doesNotMatch(clientDashboardSrc, /\.insert\s*\(/);
  assert.doesNotMatch(clientDashboardSrc, /\.update\s*\(/);
});
