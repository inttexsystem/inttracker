const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const router = readOrFail(ROUTER);
const index = readOrFail(INDEX);

test('cliente-pedido-detail: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedido-detail.js ausente');
});

test('cliente-pedido-detail: sintaxe JS valida (node --check)', () => {
  const { execSync } = require('node:child_process');
  execSync(`node --check "${SCREEN}"`, { stdio: 'pipe' });
});

test('cliente-pedido-detail: script classico (nao ES module)', () => {
  assert.equal(/^\s*export\s+/m.test(screen), false);
  assert.equal(/import\s+.*\s+from\s+/.test(screen), false);
});

test('cliente-pedido-detail: expoe window.screenClientePedidoDetalhe', () => {
  assert.match(screen, /window\.screenClientePedidoDetalhe\s*=\s*screenClientePedidoDetalhe/);
});

test('cliente-pedido-detail: expoe RAVATEX_SCREENS.clientePedidoDetail', () => {
  assert.match(screen, /RAVATEX_SCREENS\.clientePedidoDetail/);
});

test('router.js: matchRoute reconhece #/cliente/pedidos/<uuid>', () => {
  assert.match(router, /cliente\\\/pedidos\\\//);
});

test('router.js: matchRoute #/cliente/pedidos/<uuid> role e ["cliente"]', () => {
  assert.match(router, /roles:\s*\[['"]cliente['"]\]/);
});

test('cliente-pedido-detail: usa from(\'pedidos\')', () => {
  assert.match(screen, /from\(['"]pedidos['"]\)/);
});

test('cliente-pedido-detail: usa from(\'pedido_itens\')', () => {
  assert.match(screen, /from\(['"]pedido_itens['"]\)/);
});

test('cliente-pedido-detail: usa from(\'modelos\')', () => {
  assert.match(screen, /from\(['"]modelos['"]\)/);
});

test('cliente-pedido-detail: usa from(\'cores\')', () => {
  assert.match(screen, /from\(['"]cores['"]\)/);
});

test('cliente-pedido-detail: seleciona status_cliente_visual, status_cliente_excecao, status_cliente_mensagem e status_cliente_atualizado_em', () => {
  assert.match(screen, /status_cliente_visual/);
  assert.match(screen, /status_cliente_excecao/);
  assert.match(screen, /status_cliente_mensagem/);
  assert.match(screen, /status_cliente_atualizado_em/);
});

test('cliente-pedido-detail: mantem SELECT explicito e nao usa select(*)', () => {
  assert.doesNotMatch(screen, /\.select\(\s*['"]\*['"]\s*\)/);
});

test('cliente-pedido-detail: nao expoe cliente_id no select de pedidos', () => {
  const selectRe = /\.select\(['"]([^'"]*)['"]\)/g;
  let m;
  let foundClienteIdInSelect = false;
  while ((m = selectRe.exec(screen)) !== null) {
    if (m[1].includes('cliente_id')) foundClienteIdInSelect = true;
  }
  assert.equal(foundClienteIdInSelect, false);
});

test('cliente-pedido-detail: nao expoe token_acesso', () => {
  assert.equal(/token_acesso/.test(screen), false);
});

test('cliente-pedido-detail: nao expoe pedido_eventos', () => {
  assert.equal(/pedido_eventos/.test(screen), false);
});

test('cliente-pedido-detail: nao expoe pedido_cliente_eventos', () => {
  assert.equal(/pedido_cliente_eventos/.test(screen), false);
});

test('cliente-pedido-detail: nao referencia OP', () => {
  assert.equal(/\bop\b/i.test(screen), false);
});

test('cliente-pedido-detail: nao referencia lote', () => {
  assert.equal(/\blote\b/i.test(screen), false);
});

test('cliente-pedido-detail: nao referencia fornecedor', () => {
  assert.equal(/fornecedor/i.test(screen), false);
});

test('cliente-pedido-detail: nao referencia NF, romaneio, custo ou margem', () => {
  assert.equal(/\bNF\b/.test(screen), false);
  assert.equal(/romaneio/i.test(screen), false);
  assert.equal(/custo/i.test(screen), false);
  assert.equal(/margem/i.test(screen), false);
});

test('cliente-pedido-detail: nao referencia service_role', () => {
  assert.equal(/service_role/.test(screen), false);
});

test('cliente-pedido-detail: nao referencia functions.invoke', () => {
  assert.equal(/functions\.invoke/.test(screen), false);
});

test('cliente-pedido-detail: nao faz insert', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false);
});

test('cliente-pedido-detail: nao faz update', () => {
  assert.equal(/\.update\s*\(/.test(screen), false);
});

test('cliente-pedido-detail: nao faz delete', () => {
  assert.equal(/\.delete\s*\(/.test(screen), false);
});

test('cliente-pedido-detail: nao usa rpc', () => {
  assert.equal(/\.rpc\s*\(/.test(screen), false);
});

test('cliente-pedido-detail: nao tem botao Editar', () => {
  assert.equal(/Editar/i.test(screen), false);
});

test('cliente-pedido-detail: nao tem botao Cancelar', () => {
  assert.equal(/Cancelar pedido/i.test(screen), false);
});

test('cliente-pedido-detail: nao tem botao Confirmar', () => {
  assert.equal(/Confirmar pedido/i.test(screen), false);
});

test('cliente-pedido-detail: nao tem botao "Editar itens"', () => {
  assert.equal(/Editar itens/i.test(screen), false);
});

test('cliente-pedido-detail: valida UUID antes de consultar', () => {
  assert.match(screen, /UUID_RE\.test/);
});

test('cliente-pedido-detail: mensagem "nao encontrado ou sem permissao" presente', () => {
  assert.match(screen, /n[aã]o encontrado ou sem permiss[aã]o/i);
});

test('cliente-pedido-detail: usa window.pedidoStatusBadge', () => {
  assert.match(screen, /window\.pedidoStatusBadge/);
});

test('cliente-pedido-detail: usa window.fmtDataCurta', () => {
  assert.match(screen, /window\.fmtDataCurta/);
});

test('cliente-pedido-detail: usa window.corPreviewElement', () => {
  assert.match(screen, /window\.corPreviewElement/);
});

test('cliente-pedido-detail: usa corPreviewHex', () => {
  assert.match(screen, /window\.corPreviewHex/);
});

test('cliente-pedido-detail: usa window.clienteShellLayout', () => {
  assert.match(screen, /window\.clienteShellLayout/);
  assert.equal(/window\.ADMIN_MENU/.test(screen), false);
});

test('cliente-pedido-detail: chama window.buildClientePedidoTrackingCard', () => {
  assert.match(screen, /window\.buildClientePedidoTrackingCard/);
});

test('cliente-pedido-detail: renderiza o card de acompanhamento antes do resumo', () => {
  const matches = [...screen.matchAll(/container\.replaceChildren\(([^;]*)\);/g)];
  const principal = matches.find((m) => m[1].includes('buildResumo()'));
  assert.ok(principal);
  const args = principal[1];
  const idxTracking = args.indexOf('buildTracking()');
  const idxResumo = args.indexOf('buildResumo()');
  assert.ok(idxTracking !== -1);
  assert.ok(idxTracking < idxResumo);
});

test('cliente-pedido-detail: mostra colunas de itens (modelo, cor, largura, preview, metros, observacao)', () => {
  assert.match(screen, /label:\s*['"]Modelo['"]/);
  assert.match(screen, /label:\s*['"]Cor 1 \/ Cor 2['"]/);
  assert.match(screen, /label:\s*['"]Largura['"]/);
  assert.match(screen, /label:\s*['"]Preview['"]/);
  assert.match(screen, /label:\s*['"]Metros['"]/);
  assert.match(screen, /label:\s*['"]Observa/);
});

test('cliente-pedido-detail: nao tem botoes de acao nos itens', () => {
  assert.match(screen, /actions:\s*\[\]/);
});
