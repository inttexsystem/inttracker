const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const TRACKING_UI = path.join(ROOT, 'js', 'pedido-tracking-ui.js');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-pedido-tracking.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const trackingUi = readOrFail(TRACKING_UI);
const screen = readOrFail(SCREEN);
const index = readOrFail(INDEX);

test('cliente-pedido-tracking: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedido-tracking.js ausente');
});

test('cliente-pedido-tracking: sintaxe JS valida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('cliente-pedido-tracking: script classico (nao ES module)', () => {
  assert.equal(/^\s*export\s+/m.test(screen), false);
  assert.equal(/import\s+.*\s+from\s+/.test(screen), false);
});

test('cliente-pedido-tracking: expoe window.buildClientePedidoTrackingCard', () => {
  assert.match(screen, /window\.buildClientePedidoTrackingCard\s*=\s*buildClientePedidoTrackingCard/);
});

test('cliente-pedido-tracking: expoe RAVATEX_SCREENS.clientePedidoTracking', () => {
  assert.match(screen, /RAVATEX_SCREENS\.clientePedidoTracking/);
});

test('cliente-pedido-tracking: usa taxonomia compartilhada', () => {
  assert.match(screen, /window\.RavatexPedidoTracking/);
  assert.match(screen, /CLIENTE_TRACKING_STEPS/);
  assert.match(screen, /CLIENTE_TRACKING_EXCECOES/);
  assert.match(screen, /getClienteTrackingStatusLabel/);
  assert.match(screen, /getClienteTrackingMensagem/);
  assert.match(screen, /getClienteTrackingProgress/);
});

test('cliente-pedido-tracking: nao duplica array local antigo de 6 etapas', () => {
  assert.doesNotMatch(screen, /var\s+STEPS\s*=\s*\[/);
  assert.doesNotMatch(screen, /Em produ/);
  assert.doesNotMatch(screen, /Pronto para entrega/);
});

test('cliente-pedido-tracking: nao consulta pedido_cliente_eventos', () => {
  assert.equal(/pedido_cliente_eventos/.test(screen), false);
});

test('cliente-pedido-tracking: nao referencia OP, lote, fornecedor, token, custo ou margem', () => {
  assert.equal(/\bop\b/i.test(screen), false);
  assert.equal(/\blote\b/i.test(screen), false);
  assert.equal(/fornecedor/i.test(screen), false);
  assert.equal(/\btoken\b/i.test(screen), false);
  assert.equal(/\bcusto\b/i.test(screen), false);
  assert.equal(/\bmargem\b/i.test(screen), false);
});

test('cliente-pedido-tracking: nao referencia NF ou romaneio', () => {
  assert.equal(/\bNF\b/.test(screen), false);
  assert.equal(/romaneio/i.test(screen), false);
});

test('cliente-pedido-tracking: nao referencia service_role', () => {
  assert.equal(/service_role/.test(screen), false);
});

test('cliente-pedido-tracking: nao referencia window.supa', () => {
  assert.equal(/window\.supa/.test(screen), false);
});

test('cliente-pedido-tracking: nao faz insert/update/delete', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false);
  assert.equal(/\.update\s*\(/.test(screen), false);
  assert.equal(/\.delete\s*\(/.test(screen), false);
});

test('cliente-pedido-tracking: nao usa rpc nem functions.invoke', () => {
  assert.equal(/\.rpc\s*\(/.test(screen), false);
  assert.equal(/functions\.invoke/.test(screen), false);
});

function makeElStub() {
  function el(tag, attrs) {
    const node = { tag, attrs: attrs || {}, children: [] };
    const rest = Array.prototype.slice.call(arguments, 2);
    const flat = [];
    rest.forEach((c) => { if (Array.isArray(c)) flat.push(...c); else flat.push(c); });
    flat.forEach((c) => {
      if (c == null || c === false) return;
      node.children.push(typeof c === 'string' ? { tag: '#text', text: c } : c);
    });
    node.appendChild = function (n) { if (n != null) node.children.push(n); return n; };
    return node;
  }
  function collectText(node) {
    if (!node) return '';
    if (node.tag === '#text') return node.text;
    let out = '';
    (node.children || []).forEach((c) => { out += collectText(c) + ' '; });
    return out;
  }
  return { el, collectText };
}

function renderCard(pedido) {
  const stub = makeElStub();
  const sandbox = {
    window: {
      el: stub.el,
      fmtDataCurta: (value) => 'FMT(' + value + ')',
      RAVATEX_PEDIDO_UI: {},
    },
    console,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(trackingUi, sandbox, { filename: 'js/pedido-tracking-ui.js' });
  vm.runInContext(screen, sandbox, { filename: 'js/screens/cliente-pedido-tracking.js' });
  const node = vm.runInContext('window.buildClientePedidoTrackingCard', sandbox)(pedido);
  return stub.collectText(node);
}

const ETAPAS_ESPERADAS = [
  'Recebido', 'Confirmado', 'Insumos', 'Tecelagem',
  'Acabamento', 'Expedi', 'Transporte', 'Conclu',
];

test('cliente-pedido-tracking: renderiza as 8 etapas principais', () => {
  const texto = renderCard({ status_cliente_visual: 'tecelagem' });
  for (const etapa of ETAPAS_ESPERADAS) {
    assert.ok(texto.includes(etapa), `etapa "${etapa}" nao apareceu no card renderizado`);
  }
});

test('cliente-pedido-tracking: pedido nulo nao lanca erro e devolve no vazio', () => {
  const texto = renderCard(null);
  assert.equal(texto.trim(), '');
});

test('cliente-pedido-tracking: prioriza mensagem personalizada', () => {
  const texto = renderCard({
    status_cliente_visual: 'expedicao',
    status_cliente_mensagem: 'Mensagem publicada pelo admin.',
  });
  assert.ok(texto.includes('Mensagem publicada pelo admin.'));
});

test('cliente-pedido-tracking: trata cancelado como excecao terminal', () => {
  const texto = renderCard({
    status_cliente_visual: 'acabamento',
    status_cliente_excecao: 'cancelado',
    status_cliente_atualizado_em: '2026-06-26',
  });
  assert.match(texto, /cancelado/i);
  assert.equal(texto.includes('Etapa 5 de 8.'), false);
  assert.ok(texto.includes('FMT(2026-06-26)'));
});

test('cliente-pedido-tracking: fallback seguro nao volta para pedido.status como fonte principal', () => {
  const texto = renderCard({ status: 'produzindo' });
  assert.ok(texto.includes('Recebido'));
  assert.ok(texto.includes('Status visual ainda nao publicado'));
  assert.equal(texto.includes('Em produ'), false);
});

test('cliente-pedido-tracking: mostra atualizado em quando status_cliente_atualizado_em existir', () => {
  const texto = renderCard({
    status_cliente_visual: 'transporte',
    status_cliente_atualizado_em: '2026-06-26',
  });
  assert.ok(texto.includes('Atualizado em FMT(2026-06-26)'));
});

test('index.html carrega js/screens/cliente-pedido-tracking.js exatamente uma vez', () => {
  const matches = index.match(/js\/screens\/cliente-pedido-tracking\.js/g) || [];
  assert.equal(matches.length, 1);
});

test('index.html: cliente-pedido-tracking.js vem depois de cliente-pedidos-list.js e antes de cliente-pedido-detail.js', () => {
  const idxList = index.indexOf('js/screens/cliente-pedidos-list.js');
  const idxTracking = index.indexOf('js/screens/cliente-pedido-tracking.js');
  const idxDetail = index.indexOf('js/screens/cliente-pedido-detail.js');
  assert.ok(idxList > 0);
  assert.ok(idxTracking > 0);
  assert.ok(idxDetail > 0);
  assert.ok(idxList < idxTracking);
  assert.ok(idxTracking < idxDetail);
});
