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

function extractFunctionBody(source, fnName) {
  const start = source.indexOf('function ' + fnName + '(');
  assert.ok(start !== -1, 'function ' + fnName + ' nao encontrada');
  const next = source.indexOf('\n    function ', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

const screen = readOrFail(SCREEN);
const router = readOrFail(ROUTER);
const index = readOrFail(INDEX);

test('cliente-pedido-detail: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedido-detail.js ausente');
});

test('cliente-pedido-detail: sintaxe JS valida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
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

test('router.js: matchRoute reconhece #/cliente/pedidos/<uuid> com role cliente', () => {
  assert.match(router, /cliente\\\/pedidos\\\//);
  assert.match(router, /roles:\s*\[['"]cliente['"]\]/);
});

test('index.html carrega cliente-pedido-detail.js exatamente uma vez', () => {
  const matches = index.match(/js\/screens\/cliente-pedido-detail\.js/g) || [];
  assert.equal(matches.length, 1);
});

test('cliente-pedido-detail: usa somente a RPC publica cliente_pedido_summary para dados do detalhe', () => {
  assert.match(screen, /\.rpc\(\s*['"]cliente_pedido_summary['"]/);
  assert.match(screen, /p_pedido_id:\s*pedidoId/);
  assert.equal(/\.from\s*\(/.test(screen), false, 'nao deve consultar tabelas diretamente');
  assert.equal(/\.select\s*\(/.test(screen), false, 'nao deve montar selects diretos');
});

test('cliente-pedido-detail: removeu carregarCadeiaCliente e nao deriva cadeia operacional no front', () => {
  assert.equal(/carregarCadeiaCliente/.test(screen), false);
  assert.equal(/derivePedidoChainState/.test(screen), false);
});

test('cliente-pedido-detail: nao consulta tabelas operacionais internas', () => {
  for (const table of [
    'lotes',
    'ops',
    'op_itens',
    'ordens_compra_fio',
    'entrega_itens',
    'entregas',
    'expedicoes',
    'expedicao_itens',
    'op_latex_entregas',
  ]) {
    assert.equal(
      new RegExp(`from\\(['"]${table}['"]\\)`).test(screen),
      false,
      'nao deve consultar ' + table
    );
  }
});

test('cliente-pedido-detail: nao consulta diretamente tabelas comerciais tambem cobertas pela RPC', () => {
  for (const table of ['pedidos', 'pedido_parciais', 'pedido_itens', 'modelos', 'cores', 'pedido_cliente_eventos']) {
    assert.equal(new RegExp(`from\\(['"]${table}['"]\\)`).test(screen), false);
  }
});

test('cliente-pedido-detail: nao recebe IDs de catalogo no front', () => {
  assert.equal(/modelo_id/.test(screen), false);
  assert.equal(/cor_1_id/.test(screen), false);
  assert.equal(/cor_2_id/.test(screen), false);
});

test('cliente-pedido-detail: usa campos publicos do payload simplificado', () => {
  for (const key of [
    'payload.pedido',
    'payload.itens',
    'payload.parciais',
    'payload.timeline',
    'payload.entregas',
    'payload.pendencias',
    'payload.chain_state',
  ]) {
    assert.ok(screen.includes(key), 'faltou usar ' + key);
  }
});

test('cliente-pedido-detail: trata falha da camada publica com erro claro', () => {
  assert.match(screen, /loadingError\s*=\s*['"]summary['"]/);
  assert.match(screen, /resumo p[uú]blico do pedido/i);
});

test('cliente-pedido-detail: nao expoe campos internos proibidos', () => {
  for (const pattern of [
    /\bop_id\b/i,
    /\bop_numero\b/i,
    /\blote_id\b/i,
    /\bfornecedor_id\b/i,
    /\bfornecedor_nome\b/i,
    /\bordem_compra_id\b/i,
    /romaneio/i,
    /\bnf\b/i,
    /custo/i,
    /margem/i,
    /motivo_separacao/i,
    /origem_op_id/i,
    /destino_fornecedor_id/i,
    /service_role/i,
    /token_acesso/i,
    /functions\.invoke/,
  ]) {
    assert.equal(pattern.test(screen), false, 'campo proibido encontrado: ' + pattern);
  }
});

test('cliente-pedido-detail: nao faz writes', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false);
  assert.equal(/\.update\s*\(/.test(screen), false);
  assert.equal(/\.delete\s*\(/.test(screen), false);
  assert.equal(/\.upsert\s*\(/.test(screen), false);
});

test('cliente-pedido-detail: nao tem acoes administrativas', () => {
  assert.equal(/Editar/i.test(screen), false);
  assert.equal(/Cancelar pedido/i.test(screen), false);
  assert.equal(/Confirmar pedido/i.test(screen), false);
  assert.equal(/Editar itens/i.test(screen), false);
  assert.equal(/window\.ADMIN_MENU/.test(screen), false);
});

test('cliente-pedido-detail: valida UUID antes de consultar', () => {
  assert.match(screen, /UUID_RE\.test/);
});

test('cliente-pedido-detail: mensagem "nao encontrado ou sem permissao" presente', () => {
  assert.match(screen, /n[aã]o encontrado ou sem permiss[aã]o/i);
});

test('cliente-pedido-detail: usa helpers visuais esperados', () => {
  assert.match(screen, /window\.pedidoStatusBadge/);
  assert.match(screen, /window\.fmtDataCurta/);
  assert.match(screen, /window\.corPreviewElement/);
  assert.match(screen, /window\.corPreviewHex/);
  assert.match(screen, /window\.clienteShellLayout/);
  assert.match(screen, /window\.buildClientePedidoTrackingCard/);
});

test('cliente-pedido-detail: renderiza o card de acompanhamento depois do resumo', () => {
  const matches = [...screen.matchAll(/container\.replaceChildren\(([\s\S]*?)\);/g)];
  const principal = matches.find((m) => m[1].includes('buildResumo()'));
  assert.ok(principal);
  const args = principal[1];
  const idxTracking = args.indexOf('buildTracking()');
  const idxResumo = args.indexOf('buildResumo()');
  assert.ok(idxTracking !== -1);
  assert.ok(idxResumo < idxTracking);
});

test('cliente-pedido-detail: tracking visual continua consumindo chainState publico', () => {
  const body = extractFunctionBody(screen, 'buildTracking');
  assert.match(body, /state\.chainState/);
  assert.match(body, /buildClientePedidoTrackingCard\(state\.pedido,\s*state\.itens,\s*state\.parciais,\s*state\.chainState\)/);
});

test('cliente-pedido-detail: itens do pedido usa layout local compacto', () => {
  const body = extractFunctionBody(screen, 'buildItens');
  assert.equal(/window\.dataTable\(/.test(body), false);
  assert.match(body, /Itens do pedido/);
  const rowBody = extractFunctionBody(screen, 'buildItemRow');
  assert.match(rowBody, /modelLabel\(/);
  assert.match(rowBody, /itemCoresLabel\(/);
  assert.match(rowBody, /itemPreviewEl\(/);
  assert.match(rowBody, /fmtMetros\(/);
});

test('cliente-pedido-detail: itens do pedido nao renderiza botoes de acao', () => {
  const body = extractFunctionBody(screen, 'buildItens') + extractFunctionBody(screen, 'buildItemRow');
  assert.equal(/<button/i.test(body), false);
  assert.equal(/'button'/.test(body), false);
});

test('cliente-pedido-detail: secao "Distribuicao atual" usa buildPedidoAcompanhamentoParcial', () => {
  assert.match(screen, /Distribui[cç][aã]o atual/i);
  const body = extractFunctionBody(screen, 'buildDistribuicaoAtual');
  assert.match(body, /buildPedidoAcompanhamentoParcial/);
  assert.match(body, /acompanhamento\.distribuicao/);
  assert.equal(/window\.supa/.test(body), false);
});

test('cliente-pedido-detail: renderiza resumo publico de entrega e pendencias', () => {
  assert.match(screen, /function buildEntregasResumo/);
  assert.match(screen, /Entrega e expedi[cç][aã]o/);
  assert.match(screen, /Ainda n[aã]o h[aá] entrega registrada/);
  assert.match(screen, /function buildAvisos/);
  assert.match(screen, /Pend[eê]ncias/);
});

test('cliente-pedido-detail: renderiza a timeline depois dos itens', () => {
  const matches = [...screen.matchAll(/container\.replaceChildren\(([\s\S]*?)\);/g)];
  const principal = matches.find((m) => m[1].includes('buildResumo()'));
  assert.ok(principal);
  const args = principal[1];
  const idxItens = args.indexOf('buildItens()');
  const idxEventos = args.indexOf('buildEventos()');
  assert.ok(idxItens !== -1);
  assert.ok(idxEventos !== -1);
  assert.ok(idxItens < idxEventos);
});

test('cliente-pedido-detail: timeline publica tem titulo e empty state', () => {
  assert.match(screen, /Hist[oó]rico/i);
  assert.match(screen, /Assim que houver novas atualiza[cç][oõ]es, elas aparecer[aã]o aqui\./);
  assert.equal(/loadingError\s*=\s*['"]eventos['"]/.test(screen), false);
  assert.match(screen, /eventosError/);
});

test('cliente-pedido-detail: parciais continuam renderizando tabela publica', () => {
  assert.match(screen, /Parciais do pedido/i);
  assert.match(screen, /Este pedido ainda n[aã]o possui parciais publicadas\./);
  assert.equal(/loadingError\s*=\s*['"]parciais['"]/.test(screen), false);
  assert.match(screen, /parciaisError/);
  const body = extractFunctionBody(screen, 'buildParciaisHeaderRow');
  assert.match(body, /['"]Parcial['"]/);
  assert.match(body, /Situa[cç][aã]o/);
  assert.match(body, /Metragem/);
  assert.match(body, /Atualizado em/);
});

test('cliente-pedido-detail: parciais usam DTO existente do tracking compartilhado', () => {
  const body = extractFunctionBody(screen, 'buildParcialRow');
  assert.match(body, /parcial\.codigo/);
  assert.match(body, /parcial\.label/);
  assert.match(body, /parcial\.metros/);
  assert.match(body, /parcial\.dataReferencia/);
  assert.equal(/parcial\.atualizadoEm/.test(body), false);
});

test('cliente-pedido-detail: ordem visual preserva itens, entrega, parciais e timeline', () => {
  const matches = [...screen.matchAll(/container\.replaceChildren\(([\s\S]*?)\);/g)];
  const principal = matches.find((m) => m[1].includes('buildResumo()'));
  assert.ok(principal);
  const args = principal[1];
  const idxItens = args.indexOf('buildItens()');
  const idxDistribuicao = args.indexOf('buildDistribuicaoAtual()');
  const idxEntrega = args.indexOf('buildEntregasResumo()');
  const idxParciais = args.indexOf('buildParciais()');
  const idxEventos = args.indexOf('buildEventos()');
  assert.ok(idxItens !== -1);
  assert.ok(idxDistribuicao !== -1);
  assert.ok(idxEntrega !== -1);
  assert.ok(idxParciais !== -1);
  assert.ok(idxEventos !== -1);
  assert.ok(idxItens < idxEntrega);
  assert.ok(idxDistribuicao < idxEntrega);
  assert.ok(idxEntrega < idxParciais);
  assert.ok(idxParciais < idxEventos);
});
