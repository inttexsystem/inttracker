// tests/p2-cache-token-and-route.smoke.js
//
// P2-C — reconciliacao completa de cache-token e registro de rota.
//
// Todo asset JavaScript alterado por P2-A, P2-B ou P2-C carrega o token da
// fase; nenhum asset inalterado e arrastado; nenhum modulo e montado duas
// vezes; a ordem de dependencia esta correta.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ROUTER = fs.readFileSync(path.join(ROOT, 'js', 'router.js'), 'utf8');

const P2_TOKEN = '20260731-native-receipt-p2';

// Assets JS alterados pelas tres subfases. A lista e derivada do GIT, nao
// digitada: os dois commits locais mais o worktree.
function alteradosPorP2() {
  const base = 'f6f2c19cb15acdf672c34375a035fa8590d9c28d';
  const commitados = cp.execSync('git diff --name-only ' + base + ' HEAD', { cwd: ROOT, encoding: 'utf8' });
  const worktree = cp.execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' });
  const novos = cp.execSync('git ls-files --others --exclude-standard -- js/', { cwd: ROOT, encoding: 'utf8' });
  const todos = (commitados + '\n' + worktree + '\n' + novos).split('\n')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('js/') && s.endsWith('.js'));
  return Array.from(new Set(todos)).sort();
}

function tokenDe(asset) {
  const m = INDEX.match(new RegExp('src="' + asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=([^"]+)"'));
  return m ? m[1] : null;
}

// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-STABILIZATION-R1: a estabilizacao
// alterou DOIS dos assets do P2 depois da publicacao da fase, entao eles
// passam a carregar o token da ordem que os alterou POR ULTIMO — o mesmo
// mecanismo que toda ordem posterior usou. O sujeito do guard nao muda: todo
// asset alterado carrega um token da fase, e nenhum asset inalterado carrega
// token de fase nenhum.
const STABILIZATION_TOKEN = '20260731-native-receipt-p2-stabilization-r1';
const STABILIZATION_ASSETS = [
  'js/screens/expedicao-admin.js',
];

// NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1: o P4 repontou
// as superficies de criacao e de rastreamento para os escritores canonicos,
// entao os assets que ele alterou passam a carregar o token do P4 — o mesmo
// mecanismo da estabilizacao, aplicado a fase seguinte. O sujeito do guard
// continua o mesmo: todo asset alterado carrega o token da fase que o alterou
// POR ULTIMO.
//
// `pedido-detail-events.js` migrou da lista da estabilizacao para a do P4
// porque o P4 foi a ultima fase a altera-lo, e migrou de novo dali para a
// lista YARN_COLOR_LABEL abaixo, pela mesma razao.
const P4_TOKEN = '20260801-native-receipt-p4-authority-switch-r1';
const P4_ASSETS = [
  'js/pedido-priority.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/pedido-form.js',
  'js/screens/op-persistir.js',
  'js/screens/pedido-tracking-admin.js',
];
// OP-CANONICAL-PURCHASE-ORDER-DISTINCT-COUNT-FIX-R1: a restauracao do alcance
// dos sliders nativos, a contagem por ORDEM distinta e as duas rotas de
// proveniencia canonica alteraram op-nova.js DEPOIS do P2, entao ele carrega o
// token desta ordem — o mesmo mecanismo declarado para a estabilizacao e para
// o P4. O sujeito do guard nao muda: todo asset alterado carrega o token da
// ordem que o alterou POR ULTIMO, e o token anterior
// (20260802-native-yarn-distribution-ui-reachability-r1) foi superseded sem
// nunca ter sido publicado sobre estes bytes finais. op-nova.js migrou de
// novo dali para a lista YARN_COLOR_LABEL abaixo, pela mesma razao.
const REACHABILITY_TOKEN = '20260802-live-purchase-order-reader-r1';
const REACHABILITY_ASSETS = [];
// RECEIPT-REVERSAL-MANDATORY-DATE-R1: o modal de estorno passou a coletar e
// enviar a data que o escritor exige, entao ordem-compra-receipt-events.js
// carrega o token desta ordem — mesmo mecanismo das anteriores. Ele deixa de
// reter o token de db/119, que era o ultimo a te-lo alterado.
// BACKLOG-7 PHASE 1 esvaziou esta lista: ordem-compra-receipt-events.js migrou
// para BACKLOG7_PHASE1_ASSETS, pelo mesmo mecanismo com que op-nova.js saiu de
// REACHABILITY_ASSETS — alterado por ultimo por aquela ordem.
const REVERSAL_DATE_TOKEN = '20260803-receipt-pool-destination-r1';
const REVERSAL_DATE_ASSETS = [];

// REVERSED-RECEIPT-LINE-ACTION-VISIBILITY-R1: a acao de estorno passou a ser
// AUSENTE (nao desabilitada) num lancamento sem saldo reversivel, entao
// ordem-compra-receipt-render.js carrega o token desta ordem e deixa de reter
// o de db/119.
// BACKLOG-7 PHASE 1 esvaziou esta lista pela mesma razao:
// ordem-compra-receipt-render.js migrou para BACKLOG7_PHASE1_ASSETS.
const REVERSED_ACTION_TOKEN = '20260803-reversed-line-action-visibility-r1';
const REVERSED_ACTION_ASSETS = [];

// YARN-CONSUMPTION-HUMAN-READABLE-COLOR-R1: o eixo de algodao de CONSUMO DE
// FIO exibia o cor_id cru de oc_disponibilidade_op ("Algodao - cor 1") porque
// nenhum chamador do dono compartilhado (op-distribuicao-ui.js) resolvia o
// nome canonico da tabela `cores`. Os quatro assets alterados — o dono
// compartilhado e os tres chamadores que agora carregam `coresById` —
// carregam o token desta ordem. `op-nova.js` migrou da lista REACHABILITY e
// `pedido-detail-events.js` migrou da lista P4, cada um pela mesma razao:
// alterado por ultimo por esta ordem.
const YARN_COLOR_LABEL_TOKEN = '20260803-yarn-consumption-human-readable-color-r1';
const YARN_COLOR_LABEL_ASSETS = [
  'js/screens/op-distribuicao-ui.js',
  'js/screens/op-nova.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-producao-panel.js',
];
// BACKLOG-7-PHASE-1: a superficie do Pedido de Compra falava DUAS geracoes
// visuais mortas — o namespace de compatibilidade `--rv-color-*` /
// `--rv-radius-card` / `--rv-radius-control`, que o proprio css/tokens.css
// declara "LEGACY COMPATIBILITY — NONCONFORMING / DEPRECATED", e 52 classes
// literais de cor Tailwind. Os cinco assets alterados por essa migracao
// carregam o token desta ordem. `ordem-compra-receipt-events.js` migrou da
// lista REVERSAL_DATE e `ordem-compra-receipt-render.js` da lista
// REVERSED_ACTION, cada um pela mesma razao de sempre: alterado por ultimo por
// esta ordem.
const BACKLOG7_PHASE1_TOKEN = '20260803-backlog7-phase1-canonical-tokens-r1';
const BACKLOG7_PHASE1_ASSETS = [
  'js/screens/ordem-compra-events.js',
];

// BACKLOG-7-OC-HEADER-ALIGNMENT: revisao direta do Kleber sobre a tela
// publicada. O link "<- Ordens de compra" saiu e a barra de acoes passou a ser
// alinhada a direita no TOPO do bloco de titulo (§2.1). ordem-compra-render.js
// migra da lista da fase 1 pela mesma razao: alterado por ultimo por esta ordem.
const OC_HEADER_TOKEN = '20260803-backlog7-oc-header-alignment-r1';
const OC_HEADER_ASSETS = [];

// BACKLOG-7-PHASE-2: as correcoes de VERDADE da superficie de recebimento — o
// nome real da cor no lugar de "Cor 3", o status_recebimento da ordem que os
// dois read models ja projetavam e ninguem renderizava, o motivo do estorno
// dito como motivo em vez do par tecnico origem_tipo/origem_ref, o ator em
// portugues e o bloqueador do cutover como cartao de aviso autonomo (D12). Os
// dois assets alterados migram da lista da fase 1 pela mesma razao de sempre.
const BACKLOG7_PHASE2_TOKEN = '20260803-backlog7-phase2-state-legibility-r1';
const BACKLOG7_PHASE2_ASSETS = [
  'js/screens/ordem-compra-receipt-events.js',
];

// BACKLOG-7-EDITAR-TEXT-ACTION: decisao do arquiteto sobre a tela publicada —
// nesta posicao (linha de metadados do comando, nao linha de tabela) o controle
// leva TEXTO, nao icone. ordem-compra-receipt-render.js migra da lista da fase 2
// pela mesma razao de sempre: alterado por ultimo por esta ordem.
const EDITAR_TEXT_TOKEN = '20260803-backlog7-editar-text-action-r1';
const EDITAR_TEXT_ASSETS = [];

// BACKLOG-7-STACK-GAP-AND-EVENTS-ORDER: revisao direta do Kleber. A pilha
// passou a ser dona do seu espacamento (--rv-gap-stack), porque o ultimo
// cartao do detalhe nao tinha margem e a secao Recebimentos encostava nele; e
// o log administrativo desceu para o fim da pilha, renomeado para "Eventos
// administrativos", acabando com dois blocos "Histórico" na mesma tela. Os
// quatro assets alterados carregam o token desta ordem.
const STACK_GAP_TOKEN = '20260803-backlog7-stack-gap-and-events-order-r1';
const STACK_GAP_ASSETS = [
  'js/screens/ordem-compra.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/ordem-compra-distribuicao.js',
];
const TOKENS_DA_FASE = [P2_TOKEN, STABILIZATION_TOKEN, P4_TOKEN, REACHABILITY_TOKEN, REVERSAL_DATE_TOKEN, REVERSED_ACTION_TOKEN, YARN_COLOR_LABEL_TOKEN, BACKLOG7_PHASE1_TOKEN, BACKLOG7_PHASE2_TOKEN, OC_HEADER_TOKEN, EDITAR_TEXT_TOKEN, STACK_GAP_TOKEN];

function tokenEsperado(asset) {
  if (STACK_GAP_ASSETS.includes(asset)) return STACK_GAP_TOKEN;
  if (EDITAR_TEXT_ASSETS.includes(asset)) return EDITAR_TEXT_TOKEN;
  if (OC_HEADER_ASSETS.includes(asset)) return OC_HEADER_TOKEN;
  if (BACKLOG7_PHASE2_ASSETS.includes(asset)) return BACKLOG7_PHASE2_TOKEN;
  if (BACKLOG7_PHASE1_ASSETS.includes(asset)) return BACKLOG7_PHASE1_TOKEN;
  if (YARN_COLOR_LABEL_ASSETS.includes(asset)) return YARN_COLOR_LABEL_TOKEN;
  if (REVERSED_ACTION_ASSETS.includes(asset)) return REVERSED_ACTION_TOKEN;
  if (REVERSAL_DATE_ASSETS.includes(asset)) return REVERSAL_DATE_TOKEN;
  if (REACHABILITY_ASSETS.includes(asset)) return REACHABILITY_TOKEN;
  if (P4_ASSETS.includes(asset)) return P4_TOKEN;
  return STABILIZATION_ASSETS.includes(asset) ? STABILIZATION_TOKEN : P2_TOKEN;
}

test('1. TODO asset JS alterado por P2 carrega o token da fase que o alterou por ultimo', () => {
  const alterados = alteradosPorP2();
  assert.ok(alterados.length >= 16, 'a fase alterou pelo menos 16 modulos, achou ' + alterados.length);
  const semToken = [];
  for (const a of alterados) {
    const t = tokenDe(a);
    if (t === null) continue;               // modulo nao montado por index.html
    if (t !== tokenEsperado(a)) semToken.push(a + ' => ' + t);
  }
  assert.deepEqual(semToken, [],
    'nenhum asset alterado por P2 pode reter um token antigo');
});

test('1b. os dois assets da estabilizacao carregam EXATAMENTE o token da estabilizacao', () => {
  for (const a of STABILIZATION_ASSETS) {
    assert.equal(tokenDe(a), STABILIZATION_TOKEN, a + ' deve carregar o token da estabilizacao');
  }
  const portadores = Array.from(INDEX.matchAll(/src="([^"]+?)\?v=([^"]+)"/g))
    .filter((m) => m[2] === STABILIZATION_TOKEN)
    .map((m) => m[1]);
  assert.deepEqual(portadores.slice().sort(), STABILIZATION_ASSETS.slice().sort(),
    'somente os dois assets corrigidos podem carregar o token da estabilizacao');
  assert.notEqual(STABILIZATION_TOKEN, P2_TOKEN, 'o token da estabilizacao difere do token do P2');
});

test('2. nenhum asset INALTERADO recebeu token de fase (sem churn)', () => {
  const alterados = new Set(alteradosPorP2());
  const portadores = Array.from(INDEX.matchAll(/src="([^"]+?)\?v=([^"]+)"/g))
    .filter((m) => TOKENS_DA_FASE.includes(m[2]))
    .map((m) => m[1]);
  const intrusos = portadores.filter((p) => !alterados.has(p));
  assert.deepEqual(intrusos, [],
    'so assets realmente alterados podem carregar um token da fase');
});

test('3. nenhum modulo e montado duas vezes', () => {
  const refs = Array.from(INDEX.matchAll(/src="(js\/[^"?]+\.js)/g)).map((m) => m[1]);
  const dup = refs.filter((r, i) => refs.indexOf(r) !== i);
  assert.deepEqual(Array.from(new Set(dup)), [], 'script montado mais de uma vez');
});

test('4. o novo modulo esta montado exatamente uma vez, com o token da fase que o alterou por ultimo', () => {
  const n = (INDEX.match(/src="js\/screens\/pedido-producao-panel\.js\?v=/g) || []).length;
  assert.equal(n, 1);
  assert.equal(tokenDe('js/screens/pedido-producao-panel.js'), YARN_COLOR_LABEL_TOKEN);
});

test('5. ordem de dependencia: dono compartilhado antes do painel, painel antes do boot', () => {
  const iOwner = INDEX.indexOf('js/screens/op-distribuicao-ui.js');
  const iPanel = INDEX.indexOf('js/screens/pedido-producao-panel.js');
  const iBoot = INDEX.indexOf('js/boot.js');
  assert.ok(iOwner > -1 && iPanel > -1 && iBoot > -1);
  assert.ok(iOwner < iPanel, 'o painel consome o dono compartilhado');
  assert.ok(iPanel < iBoot, 'o painel carrega ANTES de o roteador ser invocado');
});

test('6. a rota do painel esta registrada no roteador existente', () => {
  assert.match(ROUTER, /\/\^#\\\/pedidos\\\/\(\[0-9a-f\]\{8\}[\s\S]{0,120}\\\/producao\$\/i/,
    'match dinamico ancorado, no mesmo padrao dos demais sufixos de Pedido');
  assert.match(ROUTER, /render: \(\) => window\.screenPedidoProducaoPanel\(mPedProducao\[1\]\)/);
  assert.match(ROUTER, /mPedProducao[\s\S]{0,120}roles: \['admin'\]/);
});

test('7. NAO foi criado um roteador nem um parser paralelo', () => {
  const arquivos = fs.readdirSync(path.join(ROOT, 'js'));
  assert.equal(arquivos.filter((f) => /router/i.test(f)).length, 1,
    'existe exatamente um roteador');
  const panel = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'pedido-producao-panel.js'), 'utf8');
  assert.doesNotMatch(panel, /location\.hash|addEventListener\(\s*['"]hashchange/,
    'o painel nao interpreta rota por conta propria');
});

test('8. a rota nao colide com o detalhe do Pedido nem com os demais sufixos', () => {
  // O match de detalhe e ancorado em `$`, entao `/producao` nao cai nele.
  assert.match(ROUTER, /\{12\}\)\$\/i\)/, 'o match de detalhe continua ancorado');
  for (const sufixo of ['editar', 'itens', 'insumos', 'producao']) {
    assert.ok(ROUTER.indexOf('\\/' + sufixo + '$') > -1, 'sufixo ancorado: ' + sufixo);
  }
});
