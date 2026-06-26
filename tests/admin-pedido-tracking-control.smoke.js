const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_MODULE = path.join(ROOT, 'js', 'screens', 'pedido-tracking-admin.js');
const DETAIL = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const TRACKING_UI = path.join(ROOT, 'js', 'pedido-tracking-ui.js');
const INDEX = path.join(ROOT, 'index.html');
const CLIENT_DETAIL = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const CLIENT_TRACKING = path.join(ROOT, 'js', 'screens', 'cliente-pedido-tracking.js');
const CLIENT_FORM = path.join(ROOT, 'js', 'screens', 'cliente-pedido-form.js');

function readOrFail(file) {
  assert.ok(fs.existsSync(file), 'arquivo nao encontrado: ' + file);
  return fs.readFileSync(file, 'utf8');
}

const adminSrc = readOrFail(ADMIN_MODULE);
const detailSrc = readOrFail(DETAIL);
const trackingUiSrc = readOrFail(TRACKING_UI);
const indexSrc = readOrFail(INDEX);
const clientDetailSrc = readOrFail(CLIENT_DETAIL);
const clientTrackingSrc = readOrFail(CLIENT_TRACKING);
const clientFormSrc = readOrFail(CLIENT_FORM);

test('pedido-tracking-admin: arquivo existe', () => {
  assert.ok(fs.existsSync(ADMIN_MODULE), 'js/screens/pedido-tracking-admin.js ausente');
});

test('pedido-tracking-admin: sintaxe JS valida', () => {
  require('node:child_process').execFileSync(
    process.execPath,
    ['--check', ADMIN_MODULE],
    { stdio: 'pipe' }
  );
});

test('pedido-tracking-admin: expoe buildPedidoTrackingAdminCard', () => {
  const sandbox = { window: { RAVATEX_SCREENS: {} }, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(adminSrc, sandbox, { filename: 'js/screens/pedido-tracking-admin.js' });
  assert.equal(typeof sandbox.window.buildPedidoTrackingAdminCard, 'function');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoTrackingAdmin, 'object');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoTrackingAdmin.buildPedidoTrackingAdminCard, 'function');
});

test('pedido-detail.js integra a secao admin de tracking', () => {
  assert.match(detailSrc, /buildPedidoTrackingAdminCard/);
  assert.match(detailSrc, /buildTrackingAdmin/);
  assert.match(detailSrc, /status_cliente_visual/);
  assert.match(detailSrc, /status_cliente_excecao/);
  assert.match(detailSrc, /status_cliente_mensagem/);
});

test('index.html carrega pedido-tracking-admin.js exatamente uma vez antes de pedido-detail.js', () => {
  const matches = indexSrc.match(/js\/screens\/pedido-tracking-admin\.js/g) || [];
  assert.equal(matches.length, 1);
  const idxAdmin = indexSrc.indexOf('js/screens/pedido-tracking-admin.js');
  const idxDetail = indexSrc.indexOf('js/screens/pedido-detail.js');
  assert.ok(idxAdmin > 0);
  assert.ok(idxDetail > 0);
  assert.ok(idxAdmin < idxDetail, 'pedido-tracking-admin.js deve vir antes de pedido-detail.js');
});

test('pedido-tracking-admin usa a taxonomia compartilhada, nao arrays duplicados', () => {
  assert.match(adminSrc, /window\.RavatexPedidoTracking/);
  assert.match(adminSrc, /CLIENTE_TRACKING_STEPS/);
  assert.match(adminSrc, /CLIENTE_TRACKING_EXCECOES/);
  assert.doesNotMatch(adminSrc, /var\s+CLIENTE_TRACKING_STEPS\s*=\s*\[/);
  assert.doesNotMatch(adminSrc, /var\s+CLIENTE_TRACKING_EXCECOES\s*=\s*\[/);
});

test('pedido-tracking-admin usa helpers compartilhados para preview', () => {
  assert.match(adminSrc, /getClienteTrackingStatusLabel/);
  assert.match(adminSrc, /getClienteTrackingMensagem/);
  assert.match(adminSrc, /getClienteTrackingProgress/);
});

test('pedido-tracking-admin grava campos visuais em pedidos', () => {
  assert.match(adminSrc, /from\(\s*['"]pedidos['"]\s*\)/);
  assert.match(adminSrc, /status_cliente_visual/);
  assert.match(adminSrc, /status_cliente_excecao/);
  assert.match(adminSrc, /status_cliente_mensagem/);
});

test('pedido-tracking-admin insere evento em pedido_cliente_eventos com origem manual e visivel_cliente true', () => {
  assert.match(adminSrc, /from\(\s*['"]pedido_cliente_eventos['"]\s*\)/);
  assert.match(adminSrc, /origem:\s*['"]manual['"]/);
  assert.match(adminSrc, /visivel_cliente:\s*true/);
  assert.match(adminSrc, /pedido_id/);
  assert.match(adminSrc, /titulo/);
  assert.match(adminSrc, /mensagem/);
});

test('pedido-tracking-admin nao usa pedido_eventos para historico visual', () => {
  assert.doesNotMatch(adminSrc, /from\(\s*['"]pedido_eventos['"]\s*\)/);
});

test('pedido-tracking-admin usa CURRENT_USER.id para criado_por quando disponivel', () => {
  assert.match(adminSrc, /window\.CURRENT_USER/);
  assert.match(adminSrc, /CURRENT_USER\.id/);
  assert.match(adminSrc, /criado_por/);
});

test('pedido-tracking-admin trata falha no update antes do insert e falha de historico separadamente', () => {
  assert.match(adminSrc, /Erro ao salvar situacao visivel/);
  assert.match(adminSrc, /Situacao visivel salva, mas o historico visual nao foi registrado/);
  assert.match(adminSrc, /if\s*\(\s*updateRes\.error\s*\)/);
  assert.match(adminSrc, /if\s*\(\s*insertRes\.error\s*\)/);
});

test('pedido-tracking-admin restringe exibicao a admin', () => {
  assert.match(adminSrc, /CURRENT_USER\.tipo\s*!==\s*['"]admin['"]/);
});

test('pedido-tracking-admin nao contem service_role, SQL ou automacao', () => {
  assert.doesNotMatch(adminSrc, /service_role/i);
  assert.doesNotMatch(adminSrc, /\bCREATE\s+TABLE\b/i);
  assert.doesNotMatch(adminSrc, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(adminSrc, /automacao/i);
});

test('pedido-tracking-admin nao mexe em fornecedor nem em telas cliente', () => {
  assert.doesNotMatch(adminSrc, /fornecedor/i);
  assert.doesNotMatch(clientDetailSrc, /pedido_cliente_eventos/);
  assert.doesNotMatch(clientTrackingSrc, /pedido_cliente_eventos/);
  assert.doesNotMatch(clientFormSrc, /pedido_cliente_eventos/);
  assert.doesNotMatch(clientDetailSrc, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]*status_cliente_visual/);
  assert.doesNotMatch(clientTrackingSrc, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]*status_cliente_visual/);
  assert.doesNotMatch(clientFormSrc, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]*status_cliente_visual/);
});

test('pedido-tracking-admin nao contem termos internos proibidos no contexto visual', () => {
  assert.doesNotMatch(adminSrc, /\bOP\b/);
  assert.doesNotMatch(adminSrc, /\blote\b/i);
  assert.doesNotMatch(adminSrc, /\bNF\b/);
  assert.doesNotMatch(adminSrc, /romaneio/i);
  assert.doesNotMatch(adminSrc, /custo/i);
  assert.doesNotMatch(adminSrc, /margem/i);
});
