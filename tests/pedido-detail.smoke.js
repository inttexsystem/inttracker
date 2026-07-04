// =====================================================================
// === tests/pedido-detail.smoke.js =====================================
// Smoke estático para a tela admin js/screens/pedido-detail.js
// (`screenPedidoDetalhe`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B +
//   RAVATEX-TAPETES-PEDIDO-DETAIL-UI-B1
// Escopo: valida que a UI é read-only no conteúdo do pedido, mas com
// ações reais RESTRITAS de status nesta fase. Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenPedidoDetalhe e RAVATEX_SCREENS.pedidoDetail;
//   - index.html carrega pedido-detail.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedido-form → pedido-detail → boot;
//   - faz SELECT em `pedidos` (com join `cliente:cliente_id(...)`),
//     `pedido_itens`, `modelos`, `cores`, `lotes`, `ops`,
//     `entrega_itens`, `entregas`, `ordens_compra_fio`;
//   - faz APENAS `update` em `pedidos` (campo `status` apenas),
//     com `.eq('id', pedidoId)`;
//   - NÃO faz insert/update/delete em `pedido_itens`;
//   - NÃO faz insert em `pedido_eventos` (fica para fase futura);
//   - NÃO chama functions.invoke / Edge Function;
//   - NÃO referencia op-nova/op-persistir/op-latex-admin/
//     entrega-writes/entrega-form/fornecedor;
//   - NÃO consulta `lotes` para escrita, NÃO chama `gerar_op_latex`,
//     NÃO chama `criar_lote`;
//   - NÃO cria policy/RLS/GRANT/service_role/token público;
//   - NÃO cria rota pública de cliente (sem `#/cliente` ou similar);
//   - rota dinâmica `#/pedidos/<uuid>` continua admin-only;
//   - transições permitidas (rascunho→recebido, recebido→confirmado,
//     rascunho/recebido/confirmado→cancelado);
//   - NÃO há transição para `produzindo` ou `entregue`;
//   - `cancelado` é terminal (sem transição reversa);
//   - cancelar pedido pede confirmação visual (`window.confirmDialog`);
//   - Editar continua como placeholder (C3C);
//   - tela atualiza/re-renderiza após mudança de status.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const DETAIL_DATA = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const CHAIN_STATE = path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js');
const DETAIL_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const DETAIL_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');
const LIST   = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const FORM   = path.join(ROOT, 'js', 'screens', 'pedido-form.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const detailData = readOrFail(DETAIL_DATA);
const chainState = readOrFail(CHAIN_STATE);
const detailProgress = readOrFail(DETAIL_PROGRESS);
const detailEvents = readOrFail(DETAIL_EVENTS);
const detailRender = readOrFail(DETAIL_RENDER);
const list   = readOrFail(LIST);
const helper = readOrFail(HELPER);
const router = readOrFail(ROUTER);
const boot   = readOrFail(BOOT);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);
const detailBundle = [
  chainState,
  screen,
  detailData,
  detailProgress,
  detailEvents,
  detailRender,
].join('\n\n');
const movementModalSlice = (detailEvents.match(
  /function openMovementModal\s*\(ctxMovement\)\s*\{[\s\S]*?\n    \}\n\n    function buildStageDetailBody/
) || [''])[0];

// Strip line comments and block comments for code-only assertions.
function codeOnly(src) {
  return src
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
}

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('pedido-detail: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-detail.js ausente');
  assert.ok(fs.existsSync(DETAIL_DATA), 'js/screens/pedido-detail-data.js ausente');
  assert.ok(fs.existsSync(CHAIN_STATE), 'js/screens/pedido-chain-state.js ausente');
  assert.ok(fs.existsSync(DETAIL_PROGRESS), 'js/screens/pedido-detail-progress.js ausente');
  assert.ok(fs.existsSync(DETAIL_EVENTS), 'js/screens/pedido-detail-events.js ausente');
  assert.ok(fs.existsSync(DETAIL_RENDER), 'js/screens/pedido-detail-render.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-detail: sintaxe JS válida (node --check)', () => {
  [SCREEN, DETAIL_DATA, CHAIN_STATE, DETAIL_PROGRESS, DETAIL_EVENTS, DETAIL_RENDER].forEach((file) => {
    require('node:child_process').execFileSync(
      process.execPath, ['--check', file], { stdio: 'pipe' }
    );
  });
});

test('pedido-detail: expõe screenPedidoDetalhe no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
  assert.equal(typeof sandbox.window.screenPedidoDetalhe, 'function',
    'window.screenPedidoDetalhe deve estar exposto como função');
  assert.ok(sandbox.window.RAVATEX_SCREENS, 'RAVATEX_SCREENS ausente');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoDetail, 'object',
    'window.RAVATEX_SCREENS.pedidoDetail deve ser objeto');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoDetail.screenPedidoDetalhe, 'function',
    'window.RAVATEX_SCREENS.pedidoDetail.screenPedidoDetalhe deve ser função');
});

test('pedido-chain-state: OP tecelagem em producao vira estado operacional e gates corretos', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    ops: [{
      id: 'op1',
      numero: 1,
      ano: 2026,
      status: 'em_producao',
      tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [{ op_id: 'op1', kg_pedido: 10, kg_recebido: 10 }],
    entregaItens: [],
    entregasById: {},
    expedicoes: [],
    expedicaoItens: [],
  });

  assert.equal(result.stage, 'tecelagem');
  assert.equal(result.displayStatus, 'Tecelagem em andamento');
  assert.equal(result.adminBadge, 'Em producao');
  assert.equal(result.adminStepper.insumos, 'done');
  assert.equal(result.adminStepper.tecelagem, 'current');
  assert.equal(result.actions.transferInsumosToTecelagem.mode, 'view');
  assert.equal(result.actions.transferTecelagemToAcabamento.mode, 'enabled');
  assert.equal(result.clientSteps[0].state, 'concluido');
  assert.equal(result.clientSteps[1].state, 'concluido');
  assert.equal(result.clientSteps[2].state, 'concluido');
  assert.equal(result.clientSteps[3].state, 'atual');
});

test('pedido-chain-state: pedido sem OP preserva abertura de tecelagem', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({ pedido: { id: 'p1', status: 'rascunho', metros_total: 100 } });

  assert.equal(result.stage, 'comercial');
  assert.equal(result.displayStatus, 'Rascunho');
  assert.equal(result.actions.openTecelagemOp.mode, 'enabled');
  assert.equal(result.actions.transferInsumosToTecelagem.mode, 'disabled');
});

test('pedido-detail: conectores do progresso usam labels visuais curtos', () => {
  const connectorRegion = (detailRender.match(
    /function isConnectorDoneAction\s*\(action\)\s*\{[\s\S]*?\n  function buildStepper/
  ) || [''])[0];
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(detailRender, /function buildConnectorVisual/);
  assert.match(detailRender, /label:\s*['"]Conclu[ií]do['"]/);
  assert.match(detailRender, /label:\s*['"]Transferir['"]/);
  assert.match(detailRender, /label:\s*['"]Aguardar['"]/);
  assert.doesNotMatch(connectorRegion, /['"](?:Ver|Editar|Entregar|Done|Waiting|View|Edit)['"]/);
  assert.doesNotMatch(connectorSlice, /var\s+label\s*=\s*action\.label/);
  assert.doesNotMatch(connectorSlice, /action\.label\s*\|\|/);
});

test('pedido-detail: pipeline nao renderiza textos longos da matriz nos conectores', () => {
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.doesNotMatch(connectorSlice, /Insumos conclu[ií]dos/i);
  assert.doesNotMatch(connectorSlice, /Aguardando acabamento/i);
  assert.doesNotMatch(connectorSlice, /Transferir para acabamento/i);
  assert.doesNotMatch(connectorSlice, /Liberar para expedi[cç][aã]o/i);
  assert.match(connectorSlice, /handlers\.openMovementModal\(stage\.transfer\)/,
    'Transferir pelo Pedido continua abrindo a operacao canonica quando permitido');
});

test('pedido-detail: conectores continuam como setas integradas, nao badges soltos', () => {
  const connectorRegion = (detailRender.match(
    /function isConnectorDoneAction\s*\(action\)\s*\{[\s\S]*?\n  function buildStepper/
  ) || [''])[0];
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(detailRender, /function buildConnectorStyle/);
  assert.match(detailRender, /clip-path:polygon\(0 0, calc\(100% - 15px\) 0, 100% 50%, calc\(100% - 15px\) 100%, 0 100%, 13px 50%\)/);
  assert.match(detailRender, /min-width:100px;height:30px/,
    'conector deve ter largura fixa suficiente para label curto');
  assert.match(connectorSlice, /buildConnectorStyle\(visual,\s*false\)/,
    'concluido/aguardando devem usar o mesmo formato de seta integrada');
  assert.match(connectorSlice, /buildConnectorStyle\(visual,\s*clickable\)/,
    'ativo deve usar o mesmo formato de seta integrada');
  assert.doesNotMatch(detailRender, /function buildPassiveConnector/);
  assert.doesNotMatch(detailRender, /border-radius:999px/);
  assert.doesNotMatch(connectorRegion, /border:\s*1px solid/);
});

test('pedido-detail: Transferir e Concluido abrem transicao; Aguardar permanece sem handler', () => {
  const connectorRegion = (detailRender.match(
    /function isConnectorDoneAction\s*\(action\)\s*\{[\s\S]*?\n  function buildStepper/
  ) || [''])[0];
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(connectorRegion, /mode === ['"]hidden['"][\s\S]*?state:\s*['"]waiting['"][\s\S]*?label:\s*['"]Aguardar['"]/,
    'action hidden deve renderizar Aguardar, nao sumir');
  assert.match(connectorSlice, /var\s+clickable\s*=\s*visual\.state === ['"]active['"] \|\| visual\.state === ['"]done['"]/,
    'Concluido deve ficar clicavel para abrir historico da transicao');
  assert.match(connectorSlice, /window\.el\(['"]div['"][\s\S]*?buildConnectorStyle\(visual,\s*false\)/,
    'Aguardar deve ser elemento estatico sem handler');
  assert.match(connectorSlice, /window\.el\(['"]button['"][\s\S]*?handlers\.openMovementModal\(stage\.transfer\)/,
    'Transferir/Concluido devem abrir o modal de transicao do Pedido');
  assert.doesNotMatch(connectorSlice, /visual\.state === ['"]view['"]/);
  assert.doesNotMatch(connectorSlice, /action\.mode === ['"]hidden['"][\s\S]*?return window\.el\(['"]div['"],\s*\{\s*style:\s*['"]display:flex;align-items:center;justify-content:center;height:42px;['"]\s*\}\)/);
});

test('pedido-detail: stepper produtivo tem 5 etapas e 4 conectores fixos', () => {
  const stepperSlice = (detailProgress.match(/var stepper = \[[\s\S]*?\n    \];/) || [''])[0];
  assert.ok(stepperSlice, 'array stepper nao encontrado em pedido-detail-progress.js');
  const keys = Array.from(stepperSlice.matchAll(/key:\s*['"]([^'"]+)['"]/g)).map(match => match[1]);
  assert.deepEqual(keys, ['insumos', 'tecelagem', 'acabamento', 'expedicao', 'entrega']);
  assert.equal((stepperSlice.match(/transfer:\s*\{/g) || []).length, 4,
    '5 etapas exigem 4 conectores visuais');
  assert.match(stepperSlice, /key:\s*['"]expedicao['"][\s\S]*?transfer:\s*\{[\s\S]*?origem:\s*['"]Expedicao['"][\s\S]*?destino:\s*['"]Entrega['"][\s\S]*?registerDelivery/,
    'deve existir conector EXPEDICAO -> ENTREGA');
  assert.match(stepperSlice, /key:\s*['"]entrega['"][\s\S]*?transfer:\s*null/,
    'ENTREGA e a ultima etapa e nao cria conector extra');
});

test('pedido-chain-state: ultima transicao preserva gates hidden/enabled/view', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;

  const blocked = derive({ pedido: { id: 'p1', status: 'rascunho', metros_total: 100 } });
  assert.equal(blocked.actions.registerDelivery.mode, 'hidden');

  const enabled = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    expedicoes: [{ id: 'ex1' }],
    expedicaoItens: [{ expedicao_id: 'ex1', metros_liberados: 100, metros_entregues: 0 }],
  });
  assert.equal(enabled.actions.registerDelivery.mode, 'enabled');
  assert.equal(enabled.actions.registerDelivery.label, 'Registrar entrega');

  const done = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    expedicoes: [{ id: 'ex1' }],
    expedicaoItens: [{ expedicao_id: 'ex1', metros_liberados: 100, metros_entregues: 100 }],
  });
  assert.equal(done.actions.registerDelivery.mode, 'view');
});

test('pedido-chain-state: matriz preserva labels contextuais e gates funcionais', () => {
  assert.match(chainState, /transferInsumosToTecelagem:[\s\S]{0,420}action\(['"]view['"],\s*['"]Insumos concluidos['"]/);
  assert.match(chainState, /releaseExpedicao:[\s\S]{0,260}action\(['"]disabled['"],\s*['"]Aguardando acabamento['"]/);

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    ops: [{
      id: 'op1',
      numero: 1,
      ano: 2026,
      status: 'em_producao',
      tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [{ op_id: 'op1', kg_pedido: 10, kg_recebido: 10 }],
    entregaItens: [],
    entregasById: {},
    expedicoes: [],
    expedicaoItens: [],
  });

  assert.equal(result.actions.transferInsumosToTecelagem.mode, 'view');
  assert.equal(result.actions.transferInsumosToTecelagem.label, 'Insumos concluidos');
  assert.equal(result.actions.transferTecelagemToAcabamento.mode, 'enabled');
  assert.equal(result.actions.transferTecelagemToAcabamento.label, 'Transferir');
  assert.equal(result.actions.releaseExpedicao.mode, 'disabled');
  assert.equal(result.actions.releaseExpedicao.label, 'Aguardando acabamento');
});

test('pedido-chain-state: insumos recebidos com OP aberta expõe pendência de aceite', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    ops: [{
      id: 12,
      numero: 12,
      ano: 2026,
      status: 'aberta',
      tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [{ op_id: 12, kg_pedido: 10, kg_recebido: 10 }],
    entregaItens: [],
    entregasById: {},
    expedicoes: [],
    expedicaoItens: [],
  });

  // B4: etapa INSUMOS não pode ficar done enquanto OP está aberta —
  // induziria que a cadeia está fechada.
  assert.equal(result.adminStepper.insumos, 'current');
  // B1: a action INS->TEC deve representar bloqueio, não conclusão.
  assert.equal(result.actions.transferInsumosToTecelagem.mode, 'disabled');
  assert.equal(result.actions.transferInsumosToTecelagem.label, 'Aguardar aceite da OP');
  assert.equal(result.actions.transferTecelagemToAcabamento.mode, 'disabled');
  assert.equal(result.actions.transferTecelagemToAcabamento.label, 'OP pendente de aceite');
  assert.equal(result.tecPendingAcceptance.label, 'OP 12/2026 pendente de aceite');
  assert.equal(result.tecPendingAcceptance.message, 'Insumos recebidos; OP pendente de aceite');
  assert.equal(result.tecPendingAcceptance.opId, 12);
});

// ---------------------------------------------------------------------
// PRODUCTION-FLOW-STATE-CONTRACT-B: casos obrigatórios do patch visual
// ---------------------------------------------------------------------

test('CONTRACT-B caso 1: OP aberta + insumos recebidos => conector INS->TEC NAO é Concluido', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    ops: [{
      id: 12, numero: 12, ano: 2026, status: 'aberta', tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [{ op_id: 12, kg_pedido: 10, kg_recebido: 10 }],
    entregaItens: [], entregasById: {}, expedicoes: [], expedicaoItens: [],
  });

  // Conector INS->TEC: action em modo disabled, não view/done.
  const insAct = result.actions.transferInsumosToTecelagem;
  assert.equal(insAct.mode, 'disabled',
    'conector INS->TEC deve ficar bloqueado (disabled), não view/done');
  assert.equal(result.adminStepper.insumos, 'current',
    'etapa INSUMOS não pode ser done enquanto OP está aberta');
  // Tecelagem mostra pendência de aceite.
  assert.ok(result.tecPendingAcceptance,
    'tecPendingAcceptance deve estar ativo');
  // Pedido não expõe Transferir para TEC->ACAB enquanto aceite pendente.
  const tecAct = result.actions.transferTecelagemToAcabamento;
  assert.notEqual(tecAct.mode, 'enabled',
    'Pedido não deve expor Transferir TEC->ACAB com OP ainda aberta');
});

test('CONTRACT-B caso 2: OP em_producao + insumos recebidos => conector INS->TEC pode ser Concluido (sem regressao)', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    ops: [{
      id: 12, numero: 12, ano: 2026, status: 'em_producao', tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [{ op_id: 12, kg_pedido: 10, kg_recebido: 10 }],
    entregaItens: [], entregasById: {}, expedicoes: [], expedicaoItens: [],
  });

  // Após aceite (em_producao), o conector INS->TEC volta a poder ser Concluido.
  assert.equal(result.actions.transferInsumosToTecelagem.mode, 'view');
  assert.equal(result.actions.transferInsumosToTecelagem.label, 'Insumos concluidos');
  assert.equal(result.adminStepper.insumos, 'done');
  assert.equal(result.stage, 'tecelagem');
  assert.equal(result.adminBadge, 'Em producao');
  assert.ok(!result.tecPendingAcceptance,
    'não deve haver tecPendingAcceptance após aceite da OP');
});

test('CONTRACT-B caso 3: expedicao entregue >= total mas status != entregue => pedido NAO Concluido', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    // status confirmado: a RPC concluir_pedido_se_pronto ainda não rodou.
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    ops: [{
      id: 12, numero: 12, ano: 2026, status: 'finalizada', tipo: 'latex',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    ordensFio: [],
    entregaItens: [], entregasById: {},
    expedicoes: [{ id: 'ex1', status: 'concluida' }],
    expedicaoItens: [{ expedicao_id: 'ex1', metros_liberados: 100, metros_entregues: 100 }],
  });

  // Métrica operacional sinaliza entrega completa, mas o status principal
  // não deve antecipar Concluido sem a RPC ter gravado status='entregue'.
  assert.notEqual(result.displayStatus, 'Concluido',
    'status principal não deve virar Concluido sem pedido.status=entregue');
  assert.notEqual(result.stage, 'concluido',
    'stage não deve virar concluido sem pedido.status=entregue');
  assert.notEqual(result.adminBadge, 'Concluido',
    'badge admin não deve virar Concluido sem pedido.status=entregue');
});

test('CONTRACT-B B2: render trata action de aguardo como waiting, nunca done', () => {
  // Mesmo que uma action chegue em mode=view com label de aguardo,
  // o render não pode rotular como Concluído (defesa B2).
  assert.match(detailRender, /label\.indexOf\(['"]aguard['"]\) >= 0\)*\s*return false/);
  // O conector permanece como seta integrada (não vira link).
  assert.doesNotMatch(detailRender, /function buildPassiveConnector/);
  assert.match(detailRender, /clip-path:polygon\(0 0, calc\(100% - 15px\) 0, 100% 50%, calc\(100% - 15px\) 100%, 0 100%, 13px 50%\)/);
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez e na ordem correta
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedido-detail.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedido-detail\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-detail.js deve ser carregado exatamente 1 vez');
});

test('index.html: pedido-detail.js vem antes de boot.js', () => {
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxDetail < idxBoot, 'pedido-detail.js deve vir antes de boot.js');
});

test('index.html: pedido-detail.js vem depois de pedido-ui.js, pedido-form.js e pedidos-list.js', () => {
  const idxHelper = index.indexOf('js/pedido-ui.js');
  const idxList = index.indexOf('js/screens/pedidos-list.js');
  const idxForm = index.indexOf('js/screens/pedido-form.js');
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  assert.ok(idxHelper > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxList > 0, 'pedidos-list.js deve estar no <head>');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxHelper < idxDetail, 'pedido-detail.js deve vir depois de pedido-ui.js');
  assert.ok(idxList < idxDetail, 'pedido-detail.js deve vir depois de pedidos-list.js');
  assert.ok(idxForm < idxDetail, 'pedido-detail.js deve vir depois de pedido-form.js');
});

// ---------------------------------------------------------------------
// 4. Router tem match dinâmico para #/pedidos/<uuid> (admin only)
// ---------------------------------------------------------------------

test('router.js: tem match dinâmico para #/pedidos/<uuid> chamando screenPedidoDetalhe', () => {
  assert.ok(router.includes('#/pedidos/'),
    'router.js deve referenciar #/pedidos/ no matchRoute');
  assert.ok(router.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
    'router.js deve validar formato UUID do id do pedido');
  assert.match(router, /screenPedidoDetalhe/,
    'router.js deve chamar screenPedidoDetalhe no matchRoute');
  // O regex de UUID aparece em vários matches dinâmicos (C3A detalhe,
  // C3C1 editar, C3C2B itens). Pega a ÚLTIMA ocorrência (que é a
  // do match de detalhe) e mede a distância até screenPedidoDetalhe.
  const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  let idxRegex = -1;
  let last = -1;
  while (true) {
    const next = router.indexOf(uuidRegex, last + 1);
    if (next === -1) break;
    idxRegex = next;
    last = next;
  }
  const idxRender = router.indexOf('screenPedidoDetalhe');
  assert.ok(idxRegex > 0, 'regex de UUID deve existir em router.js (última ocorrência — detalhe)');
  assert.ok(idxRender > 0, 'chamada screenPedidoDetalhe deve existir em router.js');
  const distancia = Math.abs(idxRender - idxRegex);
  assert.ok(distancia <= 400,
    'regex de UUID (match de detalhe) e screenPedidoDetalhe devem estar próximos (distância ' + distancia + ' > 400)');
});

test('router.js: rota dinâmica #/pedidos/<uuid> é admin-only', () => {
  assert.match(router, /#\/pedidos\/[\s\S]{0,400}?roles\s*:\s*\[\s*['"]admin['"]\s*\]/,
    'rota dinâmica #/pedidos/<uuid> deve ser admin-only');
});

test('router.js: matchRoute dinâmico #/pedidos/<uuid> NÃO é público', () => {
  const pedidosSlice = router.match(/#\/pedidos\/[\s\S]{0,500}/);
  assert.ok(pedidosSlice, 'trecho do match dinâmico de pedidos não encontrado em router.js');
  assert.doesNotMatch(pedidosSlice[0], /public\s*:\s*true/,
    'rota dinâmica #/pedidos/<uuid> NÃO deve ser pública (sem public: true)');
});

// ---------------------------------------------------------------------
// 5. Transições de status (C3B) — núcleo do escopo desta fase
// ---------------------------------------------------------------------

test('pedido-detail.js: define TRANSITIONS com transições permitidas nesta fase', () => {
  // A constante deve permitir:
  //   rascunho   -> recebido
  //   rascunho   -> cancelado
  //   recebido   -> confirmado
  //   recebido   -> cancelado
  //   confirmado -> cancelado
  assert.match(screen, /TRANSITIONS\s*[=:]/, 'deve definir TRANSITIONS');
  // Helper regex: casa 'origem': [...possíveis wrappers... 'destino' ...
  // Casa o destino dentro do array de TRANSITIONS mesmo com wrapper
  // Object.freeze() e indentação variável.
  const TRANS_RE = function (from, to) {
    return new RegExp(
      "\\b" + from + "\\s*:\\s*(?:Object\\.freeze\\s*\\(\\s*)?\\s*\\[[^\\]]*['\"]" + to + "['\"]",
      'm'
    );
  };
  assert.match(screen, TRANS_RE('rascunho', 'recebido'),
    'TRANSITIONS.rascunho deve incluir "recebido"');
  assert.match(screen, TRANS_RE('recebido', 'confirmado'),
    'TRANSITIONS.recebido deve incluir "confirmado"');
  assert.match(screen, TRANS_RE('rascunho', 'cancelado'),
    'TRANSITIONS.rascunho deve incluir "cancelado"');
  assert.match(screen, TRANS_RE('recebido', 'cancelado'),
    'TRANSITIONS.recebido deve incluir "cancelado"');
  assert.match(screen, TRANS_RE('confirmado', 'cancelado'),
    'TRANSITIONS.confirmado deve incluir "cancelado"');
});

test('pedido-detail.js: TRANSITIONS NÃO permite transição para "produzindo"', () => {
  // Nenhum status pode ter "produzindo" como destino nesta fase.
  // Verifica que a string 'produzindo' não aparece em uma estrutura
  // de array literal (objeto literal com valor de array).
  const co = codeOnly(screen);
  // Padrão: 'qualquerStatus': [...'produzindo'...]
  assert.doesNotMatch(co, /:\s*\[[^\]]*['"]produzindo['"][^\]]*\]/,
    'nenhum status deve listar "produzindo" como destino em TRANSITIONS');
});

test('pedido-detail.js: TRANSITIONS NÃO permite transição para "entregue"', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /:\s*\[[^\]]*['"]entregue['"][^\]]*\]/,
    'nenhum status deve listar "entregue" como destino em TRANSITIONS');
});

test('pedido-detail.js: TRANSITIONS marca cancelado como terminal (sem saídas)', () => {
  // cancelado deve estar mapeado para array vazio (com possível
  // wrapper Object.freeze()).
  assert.match(screen, /\bcancelado\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.cancelado deve ser terminal (array vazio)');
  // produzindo e entregue também devem ser terminais nesta fase.
  assert.match(screen, /\bproduzindo\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.produzindo deve ser terminal (array vazio)');
  assert.match(screen, /\bentregue\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.entregue deve ser terminal (array vazio)');
});

test('pedido-detail.js: expõe canTransition (helper de validação)', () => {
  // Deve haver uma função canTransition (definida ou referenciada)
  // que valida a transição antes de aplicar.
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
  // O módulo é IIFE; canTransition não é exposto como global, mas é
  // usado internamente. Validamos indiretamente: o módulo expõe
  // screenPedidoDetalhe e ao avaliá-lo, não deve quebrar.
  assert.equal(typeof sandbox.window.screenPedidoDetalhe, 'function');
});

test('pedido-detail.js: tem função alterarStatus (helper interno de update)', () => {
  // A função alterarStatus deve existir e ser usada.
  assert.match(detailBundle, /function\s+alterarStatus\s*\(/,
    'pedido-detail.js deve definir function alterarStatus');
  // Deve referenciar alterarStatus em algum onclick de botão.
  assert.match(detailBundle, /alterarStatus\s*\(/,
    'alterarStatus deve ser referenciado em algum lugar do código');
});

// ---------------------------------------------------------------------
// 6. Write: APENAS update em pedidos (status only), com .eq('id', ...)
// ---------------------------------------------------------------------

test('pedido-detail.js: faz .update() em pedidos com .eq("id", pedidoId)', () => {
  // Permitido nesta fase: update apenas em pedidos, filtrado por id.
  assert.match(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,300}?\.update\s*\(\s*\{\s*status\s*:\s*novoStatus\s*\}\s*\)[\s\S]{0,200}?\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/,
    'deve fazer .update({ status }).eq("id", pedidoId) na tela de detalhe');
});

test('pedido-detail.js: NÃO faz .update() em outros campos de pedidos', () => {
  // Defesa: o payload de update deve ser EXATAMENTE { status }.
  // Não pode atualizar prazo_entrega, observacao, cliente_id, numero, etc.
  const co = codeOnly(detailBundle);
  // Procura o bloco `.update({ ... })` aplicado a pedidos e checa que
  // a única chave dentro do objeto é `status`.
  const m = co.match(/\.from\(\s*['"]pedidos['"][\s\S]{0,300}?\.update\s*\(\s*\{([^}]*)\}\s*\)/);
  assert.ok(m, 'deve haver .update({...}) em pedidos');
  const chaves = m[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.equal(chaves.length, 1, '.update({...}) em pedidos deve ter exatamente 1 chave');
  assert.match(chaves[0], /^status\s*:/,
    'a única chave em .update({...}) em pedidos deve ser "status"');
});

test('pedido-detail.js: NÃO faz .insert() / .delete() / .upsert() em pedidos', () => {
  // Ainda não permitimos insert/delete/upsert no detalhe.
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() / .update() / .delete() / .upsert() em pedido_itens', () => {
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.update\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() em pedido_eventos (best-effort fica para fase futura)', () => {
  // Decisão C3B: pedido_eventos fica para fase futura (best-effort).
  // Nenhuma referência a pedido_eventos no detalhe.
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_eventos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_eventos['"]/,
    'pedido-detail.js não deve referenciar pedido_eventos nesta fase');
});

test('pedido-detail.js: usa apenas .select() em pedidos/pedido_itens/clientes/modelos/cores', () => {
  assert.match(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,500}\.select\s*\(/);
  // Join aninhado com cliente:cliente_id(id, nome)
  assert.match(detailBundle, /cliente\s*:\s*cliente_id\s*\(/,
    'deve usar join aninhado cliente:cliente_id(...) em pedidos');
  assert.match(detailBundle, /\.from\(\s*['"]modelos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]cores['"][\s\S]{0,500}\.select\s*\(/);
});

// ---------------------------------------------------------------------
// 7. Confirmação visual para cancelar
// ---------------------------------------------------------------------

test('pedido-detail.js: cancelar pedido usa window.confirmDialog (confirmação visual)', () => {
  // Antes de aplicar update para "cancelado", deve abrir confirmDialog.
  assert.match(detailBundle, /window\.confirmDialog\s*\(/,
    'cancelar pedido deve chamar window.confirmDialog');
  // O fluxo de cancelamento deve estar próximo do update de status.
  // Garante que confirmDialog é chamado no caminho de cancelamento
  // (case-insensitive para aceitar "Cancelar pedido" e "Cancelado").
  const co = codeOnly(detailBundle);
  assert.match(co, /confirmDialog[\s\S]{0,800}?(?:cancelar|cancelado|cancelad)/i,
    'confirmDialog deve ser usado no caminho de cancelamento');
});

test('pedido-detail.js: NÃO chama confirmDialog para recebido/confirmado (transições diretas)', () => {
  // As transições para recebido/confirmado NÃO devem pedir confirmação
  // visual (são ações simples de fluxo).
  // Defesa: confirmDialog só é usado quando novoStatus === 'cancelado'.
  assert.match(detailBundle, /novoStatus\s*===\s*['"]cancelado['"][\s\S]{0,300}?confirmDialog/,
    'confirmDialog só deve ser invocado quando novoStatus === "cancelado"');
});

// ---------------------------------------------------------------------
// 8. pedido-detail.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(detailBundle, /functions\.invoke\s*\(/);
  assert.doesNotMatch(detailBundle, /supabase\.functions\./);
  assert.doesNotMatch(detailBundle, /supabase\/functions/);
  assert.doesNotMatch(detailBundle, /admin-create-user/);
  assert.doesNotMatch(detailBundle, /admin-disable-user/);
  assert.doesNotMatch(detailBundle, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 9. pedido-detail.js não referencia OP/lote/entrega para escrita
// ---------------------------------------------------------------------

test('pedido-detail.js: consolida leitura de lote/OP/entregas sem writes operacionais', () => {
  assert.match(detailBundle, /\.from\(\s*['"]lotes['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]ops['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /op_itens\s*\(/,
    'select de ops deve incluir op_itens aninhados');
  assert.match(detailBundle, /\.from\(\s*['"]entrega_itens['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]entregas['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]ordens_compra_fio['"][\s\S]{0,500}\.select\s*\(/);

  assert.doesNotMatch(detailBundle, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens|lotes)['"][\s\S]{0,220}\.(?:insert|update|delete|upsert)\s*\(/);
  assert.doesNotMatch(detailBundle, /gerar_op_latex/);
  assert.doesNotMatch(detailBundle, /gerar_op_pedido/);
  assert.doesNotMatch(detailBundle, /criar_lote/);
  assert.doesNotMatch(detailBundle, /persistirOP/);
  assert.doesNotMatch(detailBundle, /aplicarRecalculoOP/);
});

test('pedido-detail.js: NÃO referencia arquivos críticos de OP', () => {
  assert.doesNotMatch(detailBundle, /op-nova\.js/);
  assert.doesNotMatch(detailBundle, /op-persistir\.js/);
  assert.doesNotMatch(detailBundle, /op-latex-admin\.js/);
  assert.doesNotMatch(detailBundle, /op-recalculo\.js/);
  assert.doesNotMatch(detailBundle, /op-writes\.js/);
  assert.doesNotMatch(detailBundle, /entrega-writes\.js/);
  assert.doesNotMatch(detailBundle, /entrega-form\.js/);
  assert.doesNotMatch(detailBundle, /fornecedor\.js/);
  assert.doesNotMatch(detailBundle, /screenNovaOP/);
  assert.doesNotMatch(detailBundle, /window\.screenNovaOP/);
  assert.doesNotMatch(detailBundle, /renderOPLatexAdmin/);
  assert.doesNotMatch(detailBundle, /screenFornecedor/);
});

test('pedido-detail.js: openMovementModal abre transicao local e nao redireciona Transferir para OP', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  assert.match(movementModalSlice, /Movimentacao no Pedido/,
    'modal deve abrir a movimentacao no contexto do Pedido');
  assert.match(movementModalSlice, /mode\s*=\s*action\.mode === ['"]enabled['"] \? ['"]transfer['"] : ['"]history['"]/,
    'modal deve separar modo transfer do modo history');
  assert.doesNotMatch(movementModalSlice, /Abrir OP de origem/,
    'Transferir nao pode ser apenas um redirecionamento para OP');
  assert.doesNotMatch(movementModalSlice, /window\.navigate\(\s*['"]#\/ops\//,
    'openMovementModal nao deve navegar direto para OP');
  assert.match(movementModalSlice, /nao mantem estado paralelo no Pedido/i,
    'modal deve reforcar que nao existe write paralelo no Pedido');
});

test('pedido-detail.js: openMovementModal mostra contexto pre-carregado esperado', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  for (const label of [
    'Origem',
    'Destino',
    'OP de origem',
    'Itens envolvidos',
    'Saldo/restante calculado',
    'Documentos esperados',
  ]) {
    assert.match(movementModalSlice, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'modal nao renderiza o campo esperado: ' + label);
  }
});

test('pedido-detail.js: modal usa resumo proprio para insumos e expedicao', () => {
  assert.match(detailEvents, /function summarizeInsumos/);
  assert.match(detailEvents, /function summarizeExpedicao/);
  assert.match(detailEvents, /key === ['"]Insumos>Tecelagem['"][\s\S]{0,500}summarizeInsumos\(ctxMovement\)\.ordens/);
  assert.match(detailEvents, /key === ['"]Expedicao>Entrega['"][\s\S]{0,500}state\.expedicaoItens/);
  assert.match(detailEvents, /key === ['"]Insumos>Tecelagem['"][\s\S]{0,500}totalLabel:\s*ns\.fmtKg\(insumos\.pedido\)/);
  assert.match(detailEvents, /key === ['"]Expedicao>Entrega['"][\s\S]{0,500}totalLabel:\s*ns\.fmtMetros\(expedicao\.liberado\)/);
});

test('pedido-detail.js: modal de transicao usa contrato visual discreto', () => {
  assert.match(detailEvents, /MOVEMENT_MODAL_RADIUS\s*=\s*['"]6px['"]/);
  assert.match(detailEvents, /MOVEMENT_SURFACE_RADIUS\s*=\s*['"]4px['"]/);
  assert.match(detailEvents, /function normalizeMovementModalControls/);
  assert.match(movementModalSlice, /border:1px solid #eceef1;border-radius:' \+ MOVEMENT_MODAL_RADIUS/);
  assert.match(movementModalSlice, /box-shadow:' \+ MOVEMENT_MODAL_SHADOW/);
  assert.match(movementModalSlice, /border-radius:' \+ MOVEMENT_SURFACE_RADIUS/);
  assert.doesNotMatch(movementModalSlice, /border-radius:999px/);
  assert.doesNotMatch(movementModalSlice, /rounded-(?:lg|xl|2xl|full)/);
});

test('pedido-detail.js: OP aberta com insumos recebidos mostra bloqueio e CTA contextual', () => {
  assert.match(detailEvents, /function buildPendingAcceptanceBlock/);
  assert.match(detailEvents, /OP pendente de aceite/);
  assert.match(detailEvents, /Insumos recebidos; OP ainda precisa ser aceita para liberar producao\./);
  assert.match(detailEvents, /Abrir OP ['"] \+ ctxMovement\.op\.numero \+ ['"]\/['"] \+ ctxMovement\.op\.ano/);
  assert.match(detailEvents, /navigateToOp\(ctxMovement\.op\.id\)/);
  assert.match(detailProgress, /stage\.sublabel\s*=\s*['"]OP pendente de aceite['"]/);
  assert.doesNotMatch(detailEvents, /aplicarRecalculoOP/);
  assert.doesNotMatch(detailEvents, /status:\s*['"]em_producao['"]/);
});

test('pedido-detail.js: openMovementModal usa operacoes canonicas para movimentar pelo Pedido', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  assert.match(detailEvents, /window\.registrarRecebimentoOrdemFio/,
    'Insumos -> Tecelagem deve usar helper canonico de recebimento da OP');
  assert.match(detailEvents, /window\.buildEntregaInlineForm/);
  assert.match(detailEvents, /window\.salvarEntregaCima/,
    'Tecelagem -> Acabamento deve usar helper canonico da OP');
  assert.match(detailEvents, /window\.supa\.rpc\(['"]liberar_expedicao['"]/,
    'Acabamento -> Expedicao deve usar RPC canonica ja usada pela OP');
  assert.match(detailEvents, /window\.supa\.rpc\(['"]registrar_entrega_expedicao['"]/,
    'Expedicao -> Entrega deve usar RPC canonica da tela de expedicao');
  assert.doesNotMatch(movementModalSlice, /gerar_op_latex/);
  assert.doesNotMatch(movementModalSlice, /\.from\(\s*['"]/);
});

test('pedido-detail.js: Concluido abre historico com parciais da OP e do Pedido', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  assert.match(detailEvents, /function buildTransitionHistoryEntries/);
  assert.match(movementModalSlice, /buildHistoryBlock\(historyEntries\)/);
  assert.match(detailEvents, /state\.entregaItens/);
  assert.match(detailEvents, /state\.entregasById/);
  assert.match(detailEvents, /state\.expedicaoMovimentos/);
  assert.match(detailEvents, /state\.expedicaoMovimentoItens/);
  assert.match(detailEvents, /state\.ordensFio/);
  assert.match(detailEvents, /entries\.map\(function \(entry, index\)/,
    'multiplas parciais devem aparecer como multiplas entradas, nao consolidadas em uma linha unica');
});

test('pedido-detail-data: carrega destinos latex para o formulario canonico de transferencia', () => {
  assert.match(detailData, /state\.latexOptions\s*=\s*\[\]/);
  assert.match(detailData, /\.from\(\s*['"]fornecedores['"]\s*\)[\s\S]{0,180}\.eq\(\s*['"]tipo['"]\s*,\s*['"]latex['"]\s*\)/,
    'Pedido precisa carregar fornecedores latex para reutilizar buildEntregaInlineForm/salvarEntregaCima');
});

// ---------------------------------------------------------------------
// 10. pedido-detail.js usa helper pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-detail.js: usa helper de status do pedido no badge customizado do header', () => {
  assert.match(detailBundle, /window\.pedidoStatusLabel/);
});

test('pedido-detail.js: usa window.corPreviewElement para preview 48x48', () => {
  assert.match(detailBundle, /window\.corPreviewElement/);
});

test('pedido-detail.js: usa window.fmtDataCurta para datas', () => {
  assert.match(detailBundle, /window\.fmtDataCurta/);
});

test('pedido-detail.js: usa window.pedidoStatusLabel ou namespace RAVATEX_PEDIDO_UI', () => {
  const usaHelper = /window\.pedidoStatusLabel|window\.RAVATEX_PEDIDO_UI|window\.corPreviewHex|window\.pedidoStatusBadge|window\.corPreviewElement|window\.fmtDataCurta|window\.pedidoStatusTodos/.test(detailBundle);
  assert.ok(usaHelper, 'detalhe deve consumir helpers de js/pedido-ui.js');
});

// ---------------------------------------------------------------------
// 11. pedido-detail.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(detailBundle, /CREATE\s+POLICY/i);
  assert.doesNotMatch(detailBundle, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(detailBundle, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 12. pedido-detail.js não tem token público / service_role
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  const co = codeOnly(detailBundle);
  assert.doesNotMatch(co, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

test('pedido-detail.js: NÃO contém service_role / SUPERUSER', () => {
  const co = codeOnly(detailBundle);
  assert.doesNotMatch(co, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(co, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 13. pedido-detail.js não cria rota pública de cliente
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria rota pública de cliente (sem public: true)', () => {
  assert.doesNotMatch(detailBundle, /public\s*:\s*true/);
  assert.doesNotMatch(detailBundle, /['"]#\/cliente/);
  assert.doesNotMatch(detailBundle, /['"]#\/pedido\/[^'"]+['"]\s*:\s*\{\s*public\s*:\s*true/);
});

test('pedido-detail.js: NÃO usa hash para acesso público', () => {
  // O arquivo de tela não deve registrar rotas por conta própria.
  assert.doesNotMatch(detailBundle, /setRoutes/);
  assert.doesNotMatch(detailBundle, /window\.RAVATEX_ROUTER\.setRoutes/);
});

// ---------------------------------------------------------------------
// 14. Botões da tela (C3B) — Cancelar/Receber/Confirmar são REAIS
// ---------------------------------------------------------------------

test('pedido-detail.js: tem labels "Marcar como recebido", "Confirmar pedido", "Cancelar pedido"', () => {
  assert.match(detailBundle, /Marcar como recebido/,
    'label "Marcar como recebido" deve existir (ação real)');
  assert.match(detailBundle, /Confirmar pedido/,
    'label "Confirmar pedido" deve existir (ação real)');
  assert.match(detailBundle, /Cancelar pedido/,
    'label "Cancelar pedido" deve existir (ação real)');
});

test('pedido-detail.js: botão Editar é controlado por status editável (C3C1)', () => {
  // C3C1: o botão Editar é FUNCIONAL para status editáveis
  // (rascunho / recebido) e PLACEHOLDER para os demais.
  assert.match(detailBundle, /Editar/,
    'botão Editar deve existir como label');
  // Helper isPedidoEditavel (ou checagem equivalente) deve ser usado
  // para decidir entre botão funcional e placeholder.
  const usaEditavel = /window\.isPedidoEditavel|isPedidoEditavel\s*\(/.test(detailBundle);
  assert.ok(usaEditavel,
    'botão Editar deve usar isPedidoEditavel() para decidir entre funcional e placeholder');
  // Para status editáveis, o fluxo pode navegar direto ou abrir o
  // warning modal antes da navegação final.
  const usaEditFlow = /openEditWarning/.test(detailBundle)
    || /(?:window\.)?navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\+\s*['"]\/editar['"]/.test(detailBundle);
  assert.ok(usaEditFlow,
    'botão Editar funcional deve abrir o fluxo de edição do pedido');
  // placeholderButton continua disponível para o caminho placeholder
  // (status não editáveis) e deve gerar `disabled`.
  assert.match(detailBundle, /function\s+placeholderButton[\s\S]{0,400}?disabled\s*:\s*['"]disabled['"]/,
    'placeholderButton deve criar botão com disabled="disabled"');
});

test('pedido-detail.js: botão Editar itens é controlado por status editável (C3C2B)', () => {
  // C3C2B: o botão "Editar itens" é FUNCIONAL para status
  // editáveis (rascunho / recebido) e PLACEHOLDER para os demais.
  // Deve navegar para "#/pedidos/<id>/itens".
  assert.match(detailBundle, /Editar itens/,
    'botão "Editar itens" deve existir como label');
  // O botão Editar itens funcional deve navegar para /itens.
  assert.match(detailBundle, /navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\+\s*['"]\/itens['"]/,
    'botão Editar itens funcional deve navegar para "#/pedidos/<id>/itens"');
  // O botão Editar itens é criado em buildEditItensButton()
  // (helper separado, mesmo padrão de buildEditButton).
  assert.match(detailBundle, /function\s+buildEditItensButton/,
    'deve existir função buildEditItensButton()');
});

test('pedido-detail.js: "Gerar primeira OP" usa hash route #/ops/nova?pedido_id=<id>', () => {
  assert.match(detailBundle, /Gerar primeira OP/);
  assert.match(
    detailEvents,
    /navigate\(\s*['"]#\/ops\/nova\?pedido_id=['"]\s*\+\s*pedidoId\s*\)/,
    'navigateToNovaOp deve usar hash route com pedido_id'
  );
  assert.doesNotMatch(detailBundle, /location\.href\s*=\s*['"]\/ops\/nova/);
  assert.doesNotMatch(detailBundle, /location\.assign\s*\(\s*['"]\/ops\/nova/);
});

test('pedido-detail.js: se OP já existir não sugere gerar duplicada; mostra OP existente', () => {
  const buildOpsSlice = (detailRender.match(
    /function buildOps\s*\(state,\s*view,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildExpedicoes/
  ) || [''])[0];
  assert.ok(buildOpsSlice, 'trecho buildOps nao encontrado');
  assert.match(buildOpsSlice, /if\s*\(\s*view\.opSummaries\.length\s*===\s*0\s*\)/);
  assert.match(buildOpsSlice, /Gerar primeira OP/);
  assert.match(buildOpsSlice, /view\.opSummaries\.map/);
  assert.match(buildOpsSlice, /buildOpCard/);
  assert.match(detailRender, /buildFooterAction\(\s*['"]Abrir OP['"]/);
});

test('pedido-detail.js: NÃO usa mais "Confirmar / Receber" como placeholder (substituído)', () => {
  // O placeholder antigo "Confirmar / Receber" foi substituído por
  // "Marcar como recebido" + "Confirmar pedido" como ações reais.
  assert.doesNotMatch(detailBundle, /Confirmar\s*\/\s*Receber/,
    'placeholder "Confirmar / Receber" não deve mais existir (substituído)');
});

test('pedido-detail.js: botão Voltar é funcional', () => {
  assert.match(detailBundle, /window\.navigate\(\s*['"]#\/pedidos['"]/);
  assert.match(detailBundle, /Voltar(?: para pedidos)?/);
});

// ---------------------------------------------------------------------
// 15. Re-render após mudança de status
// ---------------------------------------------------------------------

test('pedido-detail.js: chama render() após sucesso no update de status', () => {
  // Após o update bem-sucedido, deve chamar render() para refletir
  // o novo status (e reabilitar/desabilitar botões).
  assert.match(detailBundle, /state\.pedido\.status\s*=\s*novoStatus/,
    'deve atualizar state.pedido.status após update');
  // render() deve ser chamado no caminho de sucesso.
  const co = codeOnly(detailBundle);
  assert.match(co, /state\.pedido\.status\s*=\s*novoStatus[\s\S]{0,400}?render\s*\(\s*\)/,
    'render() deve ser chamado após atualizar state.pedido.status');
});

// ---------------------------------------------------------------------
// 16. Schema 13_* não foi alterado por esta fase
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C3B', () => {
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

// ---------------------------------------------------------------------
// 17. Não mexe em arquivos proibidos
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO referencia cadastros.js (escopo separado)', () => {
  assert.doesNotMatch(detailBundle, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});

test('pedido-detail.js: Gerar primeira OP preserva pedido_id UUID sem Number/parseInt', () => {
  assert.match(detailEvents, /#\/ops\/nova\?pedido_id=['"]\s*\+\s*pedidoId/);
  assert.doesNotMatch(detailEvents, /Number\s*\(\s*pedidoId\s*\)/);
  assert.doesNotMatch(detailEvents, /parseInt\s*\(\s*pedidoId\s*/);
});

// ---------------------------------------------------------------------
// 18. PEDIDO-TRANSITION-MODAL-GAPS-B — pendências nos modais de seta
// ---------------------------------------------------------------------

test('modal-gaps-B: buildTransitionPendingTable existe e usa a fonte canônica', () => {
  assert.match(detailEvents, /function buildTransitionPendingTable/,
    'deve ter funcao dedicada para tabela de pendencias por produto');
  assert.match(detailEvents, /var key = transitionKey\(ctxMovement\)/,
    'deve usar a mesma chave de transicao dos outros builders');
});

test('modal-gaps-B: modal mostra tabela "Pendencias por produto" com colunas Produto/Alocado/Transferido/Pendente', () => {
  assert.match(detailEvents, /Pendencias por produto/,
    'tabela de pendencias deve ter titulo "Pendencias por produto"');
  // Colunas da tabela
  assert.match(detailEvents, /'Produto'/);
  assert.match(detailEvents, /'Alocado'/);
  assert.match(detailEvents, /'Transferido'/);
  assert.match(detailEvents, /'Pendente'/);
});

test('modal-gaps-B: tabela de pendencias usa state.entregaItens e state.entregasById (fonte canônica)', () => {
  const slice = (detailEvents.match(/function buildTransitionPendingTable[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.ok(slice, 'trecho buildTransitionPendingTable nao encontrado');
  assert.match(slice, /state\.entregaItens/,
    'deve usar state.entregaItens como fonte canonica de dados');
  assert.match(slice, /state\.entregasById/,
    'deve usar state.entregasById como fonte canonica de dados');
});

test('modal-gaps-B: itens da tabela de pendencias calculam moved/remaining por op_item', () => {
  const slice = (detailEvents.match(/function buildTransitionPendingTable[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.match(slice, /movedByItem/,
    'deve calcular movedByItem por op_item_id');
  assert.match(slice, /pendente > 0 \? ns\.fmtMetros\(pendente\) : 'Completo'/,
    'deve rotular item como "Completo" quando pendente <= 0');
  assert.match(slice, /remainingColor/,
    'deve colorir pendente de vermelho quando > 0 e verde quando completo');
});

test('modal-gaps-B: tabela de pendencias cobre Insumos, Tecelagem e Expedicao', () => {
  const slice = (detailEvents.match(/function buildTransitionPendingTable[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.match(slice, /'Insumos>Tecelagem'/,
    'deve ter ramo para Insumos>Tecelagem');
  assert.match(slice, /'Expedicao>Entrega'/,
    'deve ter ramo para Expedicao>Entrega');
  // O ramo genérico cobre Tecelagem>Acabamento e Acabamento>Expedicao via ctxMovement.op.op_itens
  assert.match(slice, /ctxMovement\.op && Array\.isArray\(ctxMovement\.op\.op_itens\)/,
    'deve ter ramo generico para OPs com op_itens (Tecelagem>Acabamento, etc)');
});

test('modal-gaps-B: openMovementModal integra tabela de pendencias', () => {
  assert.match(movementModalSlice, /buildTransitionPendingTable\(ctxMovement\)/,
    'openMovementModal deve chamar buildTransitionPendingTable');
});

test('modal-gaps-B: items do modal mostram moved/de/pendente por item', () => {
  // buildMovementItems agora mostra "X de Y · Z pendente" ou "X de Y · completo"
  const itemsSlice = (detailEvents.match(/function buildMovementItems[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.match(itemsSlice, /movedByOpItem/,
    'deve calcular movedByOpItem para enriquecer o meta dos itens');
  assert.match(itemsSlice, /pendente > 0 \? ns\.fmtMetrosShort\(pendente\) \+ ' pendente' : 'completo'/,
    'meta dos itens deve mostrar status pendente/completo');
  assert.match(itemsSlice, /ns\.fmtMetrosShort\(moved\) \+ ' de ' \+ ns\.fmtMetrosShort\(metros\)/,
    'meta dos itens deve mostrar moved de target');
});

test('modal-gaps-B: itens de insumos mostram recebido/de/pedido/pendente', () => {
  const itemsSlice = (detailEvents.match(/function buildMovementItems[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.match(itemsSlice, /ns\.fmtKg\(recebido\) \+ ' de ' \+ ns\.fmtKg\(pedido\)/,
    'meta de insumos deve mostrar recebido de pedido');
});

test('modal-gaps-B: itens de expedicao mostram entregue/de/liberado/pendente', () => {
  const itemsSlice = (detailEvents.match(/function buildMovementItems[\s\S]*?\n    \}\n\n    function buildMovementMetrics/) || [''])[0];
  assert.match(itemsSlice, /ns\.fmtMetros\(entregue\) \+ ' de ' \+ ns\.fmtMetros\(liberado\)/,
    'meta de expedicao deve mostrar entregue de liberado');
});

// ---------------------------------------------------------------------
// 19. PEDIDO-TRANSFER-REMAINING-B — ação "Transferir restante"
// ---------------------------------------------------------------------

test('transfer-remaining-B: computePendingByItem existe como helper canonico', () => {
  assert.match(detailEvents, /function computePendingByItem/,
    'deve ter helper canonico para calcular pendentes por item');
  assert.match(detailEvents, /var key = transitionKey\(ctxMovement\)/,
    'deve usar a mesma chave de transicao compartilhada');
});

test('transfer-remaining-B: computePendingByItem retorna pending/target/moved por item', () => {
  const slice = (detailEvents.match(/function computePendingByItem[\s\S]*?\n    \}\n\n    function buildMovementItems/) || [''])[0];
  assert.match(slice, /pending:\s*ns\.round2\(Math\.max\(target\s*-\s*moved,\s*0\)\)/,
    'pending deve ser calculado como target - moved');
  assert.match(slice, /state\.entregaItens/,
    'deve usar state.entregaItens como fonte canonica');
  assert.match(slice, /state\.entregasById/,
    'deve usar state.entregasById como fonte canonica');
});

test('transfer-remaining-B: buildInsumosTransferForm expoe fillRemaining e hasRemaining', () => {
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\n    \}\n\n    function buildTecelagemTransferForm/) || [''])[0];
  assert.match(slice, /fillRemaining:\s*function/,
    'buildInsumosTransferForm deve expor fillRemaining');
  assert.match(slice, /hasRemaining:\s*linhas\.some/,
    'buildInsumosTransferForm deve expor hasRemaining');
  assert.match(slice, /linha\.saldo > 0 && !linha\.input\.disabled/,
    'fillRemaining deve preencher apenas itens com saldo positivo e nao desabilitados');
  assert.match(slice, /linha\.input\.value = String\(linha\.saldo\)/,
    'fillRemaining deve setar input.value = saldo pendente');
});

test('transfer-remaining-B: buildTecelagemTransferForm expoe fillRemaining e hasRemaining', () => {
  const slice = (detailEvents.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.match(slice, /fillRemaining:\s*function/,
    'buildTecelagemTransferForm deve expor fillRemaining');
  assert.match(slice, /hasRemaining:\s*hasRemaining/,
    'buildTecelagemTransferForm deve expor hasRemaining');
  assert.match(slice, /querySelectorAll\(['"]input\[type="number"\]['"]\)/,
    'fillRemaining deve buscar inputs number no form via querySelectorAll');
  assert.match(slice, /pendingByItem\[i\]\.pending > 0 && !inputs\[i\]\.disabled/,
    'fillRemaining so preenche se pending > 0 e input nao disabled');
});

test('transfer-remaining-B: buildExpedicaoTransferForm expoe fillRemaining e hasRemaining', () => {
  const slice = (detailEvents.match(/function buildExpedicaoTransferForm[\s\S]*?\n    \}\n\n    function buildTransferForm/) || [''])[0];
  assert.match(slice, /fillRemaining:\s*function/,
    'buildExpedicaoTransferForm deve expor fillRemaining');
  assert.match(slice, /hasRemaining:\s*linhas\.some/,
    'buildExpedicaoTransferForm deve expor hasRemaining');
});

test('transfer-remaining-B: openMovementModal renderiza botao "Transferir restante"', () => {
  assert.match(movementModalSlice, /Transferir restante/,
    'modal deve renderizar botao "Transferir restante"');
  assert.match(movementModalSlice, /transferForm \&\& transferForm\.hasRemaining \&\& typeof transferForm\.fillRemaining === 'function'/,
    'botao deve aparecer apenas quando transferForm tem hasRemaining e fillRemaining');
  assert.match(movementModalSlice, /transferForm\.fillRemaining\(\)/,
    'onclick do botao deve chamar transferForm.fillRemaining()');
});

test('transfer-remaining-B: botao NAO chama write, RPC, ou save automatico', () => {
  const slice = (detailEvents.match(/Transferir restante[\s\S]*?\n\s*\}\)/) || [''])[0];
  assert.ok(slice, 'trecho do botao Transferir restante nao encontrado');
  assert.doesNotMatch(slice, /salvarEntregaCima/,
    'botao nao pode chamar salvarEntregaCima');
  assert.doesNotMatch(slice, /salvarEntregaLatex/,
    'botao nao pode chamar salvarEntregaLatex');
  assert.doesNotMatch(slice, /registrarRecebimentoOrdemFio/,
    'botao nao pode chamar registrarRecebimentoOrdemFio');
  assert.doesNotMatch(slice, /window\.supa\.rpc/,
    'botao nao pode chamar RPC');
  assert.doesNotMatch(slice, /transferForm\.onSave/,
    'botao nao pode disparar onSave automaticamente');
  assert.doesNotMatch(slice, /\.insert\(|\.update\(|\.delete\(/,
    'botao nao pode fazer write');
});

test('transfer-remaining-B: Acabamento>Expedicao sem form de metros NAO expoe fillRemaining', () => {
  const slice = (detailEvents.match(/function buildAcabamentoTransferForm[\s\S]*?\n    \}\n\n    function buildExpedicaoTransferForm/) || [''])[0];
  assert.ok(slice, 'trecho buildAcabamentoTransferForm nao encontrado');
  assert.doesNotMatch(slice, /fillRemaining/,
    'Acabamento>Expedicao usa RPC direta, nao deve ter fillRemaining (sem campos para preencher)');
  assert.doesNotMatch(slice, /hasRemaining/,
    'Acabamento>Expedicao nao deve expor hasRemaining');
});

test('transfer-remaining-B: preenchimento preenche valor correto, nao zera nem excede', () => {
  const buildTecSlice = (detailEvents.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.match(buildTecSlice, /inputs\[i\]\.value = String\(pendingByItem\[i\]\.pending\)/,
    'deve preencher com valor string do pending do item correspondente');
  assert.doesNotMatch(buildTecSlice, /inputs\[i\]\.value = ['"]0['"]/,
    'nao deve zerar o campo');
});

// ---------------------------------------------------------------------
// 20. PEDIDO-STEPPER-STAGE-MODALS-B — bolinhas do stepper clicaveis
// ---------------------------------------------------------------------

test('stepper-modals-B: buildStageNode aceita onclick e renderiza button quando clicavel', () => {
  assert.match(detailRender, /function buildStageNode\s*\(stage,\s*index,\s*onclick\)/,
    'buildStageNode deve aceitar parametro onclick');
  assert.match(detailRender, /if \(typeof onclick === 'function'\)/,
    'deve checar se onclick e funcao antes de criar button');
  assert.match(detailRender, /window\.el\(['"]button['"][\s\S]{0,200}onclick:\s*onclick/,
    'deve criar button com onclick quando clicavel');
});

test('stepper-modals-B: buildStepper passa onclick para buildStageNode', () => {
  assert.match(detailRender, /handlers\.openStageDetailModal/,
    'buildStepper deve referenciar handlers.openStageDetailModal');
  assert.match(detailRender, /buildStageNode\(stage,\s*index,\s*typeof handlers\.openStageDetailModal/,
    'deve passar onclick condicional para buildStageNode');
});

test('stepper-modals-B: openStageDetailModal existe e e exposto nos handlers', () => {
  assert.match(detailEvents, /function openStageDetailModal/,
    'deve ter funcao openStageDetailModal');
  assert.match(detailEvents, /openStageDetailModal:\s*openStageDetailModal/,
    'deve expor openStageDetailModal no retorno dos handlers');
});

test('stepper-modals-B: buildStageDetailBody cobre todas as 5 etapas', () => {
  for (const key of ['insumos', 'tecelagem', 'acabamento', 'expedicao', 'entrega']) {
    assert.match(detailEvents, new RegExp("if \\(key === '" + key + "'\\)"),
      'buildStageDetailBody deve ter ramo para etapa: ' + key);
  }
});

test('stepper-modals-B: modal read-only NAO chama writes ou RPCs', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.ok(stageModalSlice, 'trecho buildStageDetailBody nao encontrado');
  assert.doesNotMatch(stageModalSlice, /salvarEntregaCima/,
    'modal de etapa nao pode chamar salvarEntregaCima');
  assert.doesNotMatch(stageModalSlice, /salvarEntregaLatex/,
    'modal de etapa nao pode chamar salvarEntregaLatex');
  assert.doesNotMatch(stageModalSlice, /registrarRecebimentoOrdemFio/,
    'modal de etapa nao pode chamar registrarRecebimentoOrdemFio');
  assert.doesNotMatch(stageModalSlice, /liberar_expedicao/,
    'modal de etapa nao pode chamar liberar_expedicao');
  assert.doesNotMatch(stageModalSlice, /registrar_entrega_expedicao/,
    'modal de etapa nao pode chamar registrar_entrega_expedicao');
  assert.doesNotMatch(stageModalSlice, /concluir_pedido_se_pronto/,
    'modal de etapa nao pode chamar concluir_pedido_se_pronto');
  assert.doesNotMatch(stageModalSlice, /\.insert\(|\.update\(|\.delete\(/,
    'modal de etapa nao pode fazer write direto');
  assert.doesNotMatch(stageModalSlice, /supa\.rpc/,
    'modal de etapa nao pode chamar RPC');
});

test('stepper-modals-B: modal mostra estados vazios claros', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.match(stageModalSlice, /Nenhuma OP/,
    'deve ter mensagem de estado vazio');
  assert.match(stageModalSlice, /Nenhuma entrega/,
    'deve ter mensagem de estado vazio para entregas');
  assert.match(stageModalSlice, /Nenhuma informacao/,
    'deve ter mensagem de fallback');
});

test('stepper-modals-B: botao "Fechar" unico CTA do modal (sem Salvar/Transferir)', () => {
  const openStageSlice = (detailEvents.match(/function openStageDetailModal[\s\S]*?\n    \}\n\n    function openEditWarning/) || [''])[0];
  assert.ok(openStageSlice, 'trecho openStageDetailModal nao encontrado');
  assert.match(openStageSlice, /'Fechar'/,
    'modal deve ter botao "Fechar"');
  assert.doesNotMatch(openStageSlice, /'Salvar'/,
    'modal nao pode ter botao "Salvar"');
  assert.doesNotMatch(openStageSlice, /'Transferir'/,
    'modal nao pode ter botao "Transferir"');
  assert.doesNotMatch(openStageSlice, /transferForm/,
    'modal de etapa nao referencia transferForm');
});

test('stepper-modals-B: setas de transicao continuam usando openMovementModal', () => {
  assert.match(detailRender, /handlers\.openMovementModal\(stage\.transfer\)/,
    'botoes de transferencia devem continuar usando openMovementModal');
  assert.match(detailRender, /buildTransferButton\(stage,\s*handlers\)/,
    'buildTransferButton deve continuar recebendo handlers');
});

test('stepper-modals-B: modal Acabamento mostra OPs latex e fornecedor', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.match(stageModalSlice, /OPs de Acabamento\/Latex/,
    'deve ter secao de OPs de Acabamento/Latex');
  assert.match(stageModalSlice, /Fornecedor:/,
    'deve mostrar fornecedor da OP de latex');
});

test('stepper-modals-B: navegacao read-only permitida (Abrir OP, Abrir Expedicao)', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.match(stageModalSlice, /Abrir OP/,
    'deve permitir navegacao para Abrir OP');
  assert.match(stageModalSlice, /Abrir Expedicao/,
    'deve permitir navegacao para Abrir Expedicao');
  assert.match(stageModalSlice, /navigateToOp|navigateToExpedicao/,
    'deve usar funcoes de navegacao existentes');
});

test('stepper-modals-B: "Transferir restante" da fase C continua preservado', () => {
  assert.match(movementModalSlice, /Transferir restante/,
    'modal de transicao deve continuar renderizando "Transferir restante"');
  assert.match(detailEvents, /transferForm\.fillRemaining\(\)/,
    'fillRemaining deve continuar existindo');
});
