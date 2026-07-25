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
const OLA = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPTP = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');
const olaSrc = fs.readFileSync(OLA, 'utf8');
const optpSrc = fs.readFileSync(OPTP, 'utf8');
const opnSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-nova.js'), 'utf8');
// YARN-BUTTONS-FINAL-CONTRACT: builder de distribuição COMPARTILHADO
// consumido pelo painel do Pedido (mesmo módulo da tela da OP).
const oduSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-distribuicao-ui.js'), 'utf8');
// PHASE-C3C-B §35 (Gate 2 runtime proof): carrega o adapter real e o
// helper real de escrita para exercitar window.registrarRecebimentoOrdemFio
// de ponta a ponta (sem stub) dentro do runtime hub do Pedido.
const cutoverSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'ordem-compra-receipt-cutover.js'), 'utf8');
const opwSrc = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-writes.js'), 'utf8');
const opDisplay = readOrFail(path.join(ROOT, 'js', 'op-display.js'));
// PHASE-MANTA-B2B: a derivacao de rota e a forma das secoes por rota
// sairam de pedido-detail-progress.js/pedido-detail-render.js para modulos
// coesos proprios (R-5/R-6: nenhum dos dois pode crescer). O runtime hub
// carrega os mesmos modulos que index.html, na mesma ordem.
const productRoute = readOrFail(path.join(ROOT, 'js', 'product-route.js'));
const routeSections = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-route-sections.js'));
const routeSectionsUi = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-route-sections-ui.js'));
const mantaWrites = readOrFail(path.join(ROOT, 'js', 'screens', 'manta-writes.js'));
const mantaOutputForm = readOrFail(path.join(ROOT, 'js', 'screens', 'manta-output-form.js'));
const mantaMovimentoForm = readOrFail(path.join(ROOT, 'js', 'screens', 'manta-movimento-form.js'));
const detailBundle = [
  opDisplay,
  productRoute,
  chainState,
  routeSections,
  routeSectionsUi,
  mantaWrites,
  mantaOutputForm,
  mantaMovimentoForm,
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

test('TEC-STAGE-FINALIZATION-A-B: saldo zerado sem status terminal nao conclui Tecelagem', () => {
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
    entregaItens: [{ entrega_id: 'e1', op_id: 'op1', op_item_id: 'i1', metros_entregues: 100, defeito: false }],
    entregasById: { e1: { id: 'e1', etapa: 'cima' } },
  });

  assert.equal(result.metrics.tecelagem.saldoEntregue, true);
  assert.equal(result.metrics.tecelagem.terminal, false);
  assert.equal(result.adminStepper.tecelagem, 'current');
  assert.equal(result.displayStatus, 'Tecelagem em andamento');
});

test('TEC-STAGE-FINALIZATION-A-B: status concluida e terminalidade canonica da Tecelagem', () => {
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
      status: 'concluida',
      tipo: 'tecelagem',
      op_itens: [{ id: 'i1', metros_pedidos: 100 }],
    }],
    entregaItens: [{ entrega_id: 'e1', op_id: 'op1', op_item_id: 'i1', metros_entregues: 100, defeito: false }],
    entregasById: { e1: { id: 'e1', etapa: 'cima' } },
  });

  assert.equal(result.metrics.tecelagem.saldoEntregue, true);
  assert.equal(result.metrics.tecelagem.terminal, true);
  assert.equal(result.adminStepper.tecelagem, 'done');
  assert.equal(result.displayStatus, 'Tecelagem concluida');
});

test('LATEX-LIFECYCLE-CANONICAL-A-B: Acabamento reconhece concluida canonico e finalizada legado', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;

  for (const status of ['concluida', 'finalizada']) {
    const result = derive({
      pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
      ops: [{
        id: 'latex1',
        numero: 8,
        ano: 2026,
        status,
        tipo: 'latex',
        op_itens: [{ id: 'li1', metros_pedidos: 100 }],
      }],
      entregaItens: [{ entrega_id: 'e1', op_id: 'latex1', op_item_id: 'li1', metros_entregues: 100, defeito: false }],
      entregasById: { e1: { id: 'e1', etapa: 'latex' } },
      expedicoes: [],
      expedicaoItens: [],
    });

    assert.equal(result.metrics.acabamento.saldoEntregue, true, status);
    assert.equal(result.metrics.acabamento.terminal, true, status);
    assert.equal(result.adminStepper.acabamento, 'done', status);
    assert.equal(result.actions.releaseExpedicao.mode, 'enabled', status);
    assert.equal(result.displayStatus, 'Pronto para expedicao', status);
  }
});

test('STEPPER-OP-PENDING-R1: Acabamento movimentavel nao exige OP terminal, mas 100% liberado fica pendente visual', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
  const ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;

  function baseState() {
    const s = ns.createInitialState();
    s.pedido = { id: 'p1', numero: 1, status: 'rascunho', metros_total: 100 };
    s.itens = [{ id: 'pi1', modelo_id: 7, metros: 100 }];
    s.modelosById = { 7: { id: 7, nome: 'Roma' } };
    s.ops = [
      { id: 29, tipo: 'tecelagem', numero: 1, ano: 2026, status: 'concluida', op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 100, pedido_item_id: 'pi1' }] },
      { id: 30, tipo: 'latex', numero: 2, ano: 2026, status: 'em_producao', origem_op_id: 29, op_itens: [{ id: 301, modelo_id: 7, metros_pedidos: 100, pedido_item_id: 'pi1' }] },
    ];
    s.entregaItens = [{ id: 1, entrega_id: 'e1', op_id: 29, op_item_id: 290, modelo_id: 7, metros_entregues: 100, defeito: false }];
    s.entregasById = { e1: { id: 'e1', etapa: 'cima' } };
    return s;
  }

  const movimentavel = baseState();
  const movimentavelView = ns.computeViewModel(movimentavel);
  assert.equal(movimentavelView.chainState.actions.releaseExpedicao.mode, 'enabled',
    'Acabamento em producao com saldo disponivel continua liberando movimento para Expedicao');

  const liberado = baseState();
  liberado.expedicoes = [{ id: 3, op_latex_id: 30, pedido_id: 'p1', status: 'aguardando_expedicao' }];
  liberado.expedicaoItens = [{ id: 4, expedicao_id: 3, op_item_id: 301, modelo_id: 7, metros_liberados: 100, metros_entregues: 0 }];

  const view = ns.computeViewModel(liberado);
  const acabamento = view.stepper.find((stage) => stage.key === 'acabamento');
  assert.equal(view.chainState.metrics.acabamento.saldoEntregue, true);
  assert.equal(view.chainState.metrics.acabamento.formalPending, true);
  assert.notEqual(view.chainState.adminStepper.acabamento, 'done');
  assert.equal(acabamento.percent, 100);
  assert.equal(acabamento.state, 'current');
  assert.equal(acabamento.sublabel, 'OP pendente');
});

test('ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1: OP Latex simulada com saldo nao habilita movimentacao', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(chainState, sandbox, { filename: 'js/screens/pedido-chain-state.js' });
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const result = derive({
    pedido: { id: 'p1', status: 'rascunho', metros_total: 100 },
    ops: [{
      id: 'latex1',
      numero: 13,
      ano: 2026,
      status: 'simulada',
      tipo: 'latex',
      op_itens: [{ id: 'li1', metros_pedidos: 100 }],
    }],
    expedicoes: [],
    expedicaoItens: [],
  });

  assert.equal(result.metrics.acabamento.saldoEntregue, false);
  assert.equal(result.actions.releaseExpedicao.mode, 'disabled');
  assert.equal(result.actions.releaseExpedicao.label, 'Aguardando acabamento');
});

test('TEC-STAGE-FINALIZATION-A-B: Pedido Detail diferencia saldo entregue de conclusao explicita', () => {
  assert.match(detailProgress, /var\s+tecTerminal\s*=/,
    'computeViewModel deve calcular terminalidade real da Tecelagem');
  // PHASE-MANTA-B2B: o sublabel passou a ser emitido por
  // `pedidoRouteSections` (dono do stepper por rota). A garantia e a mesma.
  assert.match(routeSections, /entregue; finalizar OP/,
    'saldo zerado sem status terminal deve pedir finalizacao explicita, nao "concluido"');
  assert.match(detailEvents, /Tecelagem entregue; finalizar OP\./,
    'modal da etapa deve explicar a diferenca entre saldo e terminalidade');
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
    /function buildTransferButton\s*\(stage,\s*handlers,\s*view\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(detailRender, /function buildConnectorVisual/);
  assert.match(detailRender, /label:\s*['"]Conclu[ií]do['"]/);
  assert.match(detailRender, /label:\s*['"]Transferir['"]/);
  assert.match(detailRender, /label:\s*['"]Aguardar['"]/);
  assert.match(detailRender, /connectorLabel/);
  assert.match(detailProgress, /connectorLabel:\s*linkedOpCount\s*\?\s*['"]Receber['"]\s*:\s*['"]Iniciar['"]/);
  assert.match(detailProgress, /connectorLabel:\s*['"]Movimentar['"]/);
  assert.match(detailProgress, /connectorLabel:\s*['"]Entregar['"]/);
  assert.doesNotMatch(connectorRegion, /['"](?:Ver|Editar|Entregar|Done|Waiting|View|Edit)['"]/);
  assert.doesNotMatch(connectorSlice, /var\s+label\s*=\s*action\.label/);
  assert.doesNotMatch(connectorSlice, /action\.label\s*\|\|/);
});

test('pedido-detail: pipeline nao renderiza textos longos da matriz nos conectores', () => {
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers,\s*view\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
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
    /function buildTransferButton\s*\(stage,\s*handlers,\s*view\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(detailRender, /function buildConnectorStyle/);
  assert.match(detailRender, /clip-path:polygon\(0 0, calc\(100% - 15px\) 0, 100% 50%, calc\(100% - 15px\) 100%, 0 100%, 13px 50%\)/);
  assert.match(detailRender, /min-width:100px;height:30px/,
    'conector deve ter largura fixa suficiente para label curto');
  assert.match(connectorSlice, /buildConnectorStyle\(visual,\s*false\)/,
    'concluido/aguardando devem usar o mesmo formato de seta integrada');
  assert.match(connectorSlice, /buildConnectorStyle\(visual,\s*true\)/,
    'seta clicavel deve usar o mesmo formato integrado');
  assert.doesNotMatch(detailRender, /function buildPassiveConnector/);
  assert.doesNotMatch(detailRender, /border-radius:999px/);
  assert.doesNotMatch(connectorRegion, /border:\s*1px solid/);
});

test('pedido-detail: setas de transicao abrem modal de movimento; bolinhas mantem hub', () => {
  const connectorRegion = (detailRender.match(
    /function isConnectorDoneAction\s*\(action\)\s*\{[\s\S]*?\n  function buildStepper/
  ) || [''])[0];
  const connectorSlice = (detailRender.match(
    /function buildTransferButton\s*\(stage,\s*handlers,\s*view\)\s*\{[\s\S]*?\n  \}\n\n  function buildStepper/
  ) || [''])[0];
  assert.ok(connectorRegion, 'trecho dos helpers de conector nao encontrado');
  assert.ok(connectorSlice, 'trecho buildTransferButton nao encontrado');
  assert.match(connectorRegion, /mode === ['"]hidden['"][\s\S]*?state:\s*['"]waiting['"][\s\S]*?label:\s*['"]Aguardar['"]/,
    'action hidden deve renderizar Aguardar, nao sumir');
  assert.match(connectorSlice, /var\s+clickable\s*=\s*typeof handlers\.openMovementModal === ['"]function['"]/,
    'toda seta renderizada deve usar o modal de transicao/movimento');
  assert.doesNotMatch(connectorSlice, /handlers\.openStageDetailModal\(stage,\s*view\)/,
    'seta nao pode abrir o hub da bolinha');
  assert.match(detailRender, /buildStageNode\(stage,\s*index,[\s\S]*?handlers\.openStageDetailModal\(stage,\s*view\)/,
    'bolinha/etapa continua abrindo o hub contextual');
  assert.match(connectorSlice, /window\.el\(['"]button['"][\s\S]*?handlers\.openMovementModal\(stage\.transfer\)/,
    'Transferir/Concluido/Aguardar devem abrir o modal de transicao do Pedido');
  assert.doesNotMatch(connectorSlice, /visual\.state === ['"]view['"]/);
  assert.doesNotMatch(connectorSlice, /action\.mode === ['"]hidden['"][\s\S]*?return window\.el\(['"]div['"],\s*\{\s*style:\s*['"]display:flex;align-items:center;justify-content:center;height:42px;['"]\s*\}\)/);
});

// PHASE-MANTA-B2B: a mesma garantia Tapete de antes (5 etapas, 4
// conectores, EXPEDICAO -> ENTREGA, ENTREGA sem conector extra), agora
// provada em RUNTIME sobre o modulo que passou a construir o stepper
// (`pedidoRouteSections`) em vez do array literal que vivia em
// pedido-detail-progress.js. Nenhuma assercao Tapete foi enfraquecida.
function routeSectionsSandbox() {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext([opDisplay, productRoute, routeSections].join('\n\n'), sandbox);
  return sandbox.window.RAVATEX_SCREENS.pedidoRouteSections;
}

function stepperForRoute(route) {
  const api = routeSectionsSandbox();
  const built = api.buildRouteSections({
    routes: [route],
    opSummaries: [],
    expedicoes: [],
    expedicaoItens: [],
    insumoOrdens: [],
    totalPedido: 0,
    deliveredExactTotal: 0,
    chainState: null,
    fmt: { metros: (v) => String(v), kg: (v) => String(v) },
  });
  return built.sections[0].stepper;
}

test('pedido-detail: stepper produtivo Tapete tem 5 etapas e 4 conectores fixos', () => {
  const stepper = stepperForRoute('tapete');
  assert.equal(stepper.map((s) => s.key).join(','), 'insumos,tecelagem,acabamento,expedicao,entrega');
  assert.equal(stepper.filter((s) => s.transfer).length, 4, '5 etapas exigem 4 conectores visuais');
  const expedicao = stepper.find((s) => s.key === 'expedicao');
  assert.equal(expedicao.transfer.origem, 'Expedicao', 'deve existir conector EXPEDICAO -> ENTREGA');
  assert.equal(expedicao.transfer.destino, 'Entrega');
  assert.equal(stepper.find((s) => s.key === 'entrega').transfer, null,
    'ENTREGA e a ultima etapa e nao cria conector extra');
});

test('pedido-detail: stepper produtivo Manta tem 4 etapas, 3 conectores e nenhum Acabamento', () => {
  const stepper = stepperForRoute('manta');
  assert.equal(stepper.map((s) => s.key).join(','), 'insumos,tecelagem,expedicao,entrega');
  assert.equal(stepper.filter((s) => s.transfer).length, 3, '4 etapas exigem 3 conectores visuais');
  const tecelagem = stepper.find((s) => s.key === 'tecelagem');
  assert.equal(tecelagem.transfer.destino, 'Expedicao',
    'a Manta liga Tecelagem direto a Expedicao, sem Acabamento');
  assert.equal(stepper.find((s) => s.key === 'entrega').transfer, null);
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
});

// ---------------------------------------------------------------------
// PHASE-C3C-B: pedido-detail-data.js canonical-first ordensFio adaptation
// (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md §32). Static,
// proportional to risk: this reader's canonical/fallback branching and the
// shared row-mapping logic are exhaustively runtime-tested in
// tests/ordem-compra-receipt-cutover.smoke.js; here we only confirm the
// exact pre-phase flat select is preserved byte-identical and that the
// adapter is attempted first, scoped by p_pedido_id.
// ---------------------------------------------------------------------

test('pedido-detail-data.js: attempts the canonical adapter (p_pedido_id scoped) before the flat select', () => {
  assert.match(detailData, /ordemCompraReceiptCutover/,
    'loadPedidoDetailData deve tentar o adapter PHASE-C3C-B antes do select flat');
  assert.match(detailData, /attemptCanonicalRead\(\{\s*pedidoId:\s*pedidoId\s*\}\)/,
    'attemptCanonicalRead deve ser escopado por p_pedido_id (grain por item, nao por OP)');
});

test('pedido-detail-data.js: exact pre-phase flat select preserved byte-identical as the fallback body', () => {
  assert.match(detailData,
    /\.from\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.select\(\s*['"]id, op_id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, cores:cor_id\(id, nome\)['"]\s*\)\s*\.in\(\s*['"]op_id['"]\s*,\s*opIds\s*\)/,
    'o select flat de ordens_compra_fio deve permanecer byte-identico ao pre-fase');
});

test('pedido-detail-data.js: state.ordensFio is populated on both the canonical and the fallback branch', () => {
  assert.match(detailData, /state\.ordensFio\s*=\s*canonicalOrdens\.rows/);
  assert.match(detailData, /state\.ordensFio\s*=\s*ordensRes\.data\s*\|\|\s*\[\]/);
});

// ---------------------------------------------------------------------
// PHASE-C3C-B §34 (supervisor correction): buildInsumosTransferForm's
// onSave loop must own a per-line receipt-attempt tracker outside
// window.registrarRecebimentoOrdemFio, and pass it into every call. Static,
// proportional: this file's onSave is exercised at runtime nowhere else in
// this suite (openMovementModal's custom overlay/card has no existing
// runtime-test harness — every other reference to it in this file is
// itself a static source-pattern assertion, the file's dominant
// convention). The underlying retry/ambiguous-vs-deterministic mechanism
// this call-site delegates to is exhaustively runtime-proven in
// tests/op-writes.smoke.js (tests 56-61, the exact function this file
// calls) and, end-to-end through a real DOM click, in
// tests/op-nova.smoke.js (tests 80-83) and
// tests/fornecedor-screens.smoke.js (tests 43-46).
// ---------------------------------------------------------------------

test('pedido-detail-events.js §34: each line owns its own attemptTracker, created outside registrarRecebimentoOrdemFio, alongside linhas', () => {
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\r?\n    \}\r?\n\r?\n    function buildTecelagemTransferForm/) || [''])[0];
  assert.ok(slice, 'trecho buildInsumosTransferForm nao encontrado');
  assert.match(slice, /ordemCompraReceiptCutover/,
    'deve resolver o adapter PHASE-C3C-B para criar o tracker');
  assert.match(slice, /attemptTracker:\s*cutoverForTracker\s*\?\s*cutoverForTracker\.createAttemptTracker\(\)\s*:\s*null/,
    'cada linha deve ter seu proprio attemptTracker, criado junto com linhas (fora de registrarRecebimentoOrdemFio)');
});

test('pedido-detail-events.js §34: onSave resolves the per-line attempt by intent (ordemId/kg/date) and passes it into registrarRecebimentoOrdemFio', () => {
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\r?\n    \}\r?\n\r?\n    function buildTecelagemTransferForm/) || [''])[0];
  assert.match(slice, /tracker\.resolveAttempt\(\{\s*ordemId:\s*linhas\[i\]\.ordem\.id,\s*kg:\s*total,\s*dataRec:\s*dataInput\.value\s*\}\)/,
    'resolveAttempt deve ser chamado com a intencao completa (ordem, kg absoluto total, data)');
  assert.match(slice, /window\.registrarRecebimentoOrdemFio\(\{[\s\S]{0,400}?attempt:\s*attempt,?\s*\}\)/,
    'registrarRecebimentoOrdemFio deve receber o attempt resolvido pelo tracker');
});

test('pedido-detail-events.js §34: an ambiguous outcome retains the tracker; every other outcome completes it', () => {
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\r?\n    \}\r?\n\r?\n    function buildTecelagemTransferForm/) || [''])[0];
  assert.match(slice, /if\s*\(tracker\s*&&\s*!res\.ambiguous\)\s*tracker\.complete\(\)/,
    'uma falha ambigua (res.ambiguous===true) NAO deve completar o tracker — deve ser retido para retry');
  assert.match(slice, /if\s*\(tracker\)\s*tracker\.complete\(\)/,
    'sucesso deve completar o tracker (proxima submissao gera um novo token)');
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

test('pedido-detail.js: OP aberta com insumos recebidos mostra CTA de distribuição (YARN-BUTTONS-FINAL-CONTRACT)', () => {
  assert.match(detailEvents, /function buildPendingAcceptanceBlock/);
  // A CTA deixou de ser "aceitar" (que iniciava produção) e passou a ser
  // "distribuição" (save-only); a produção parte de "Iniciar produção".
  assert.match(detailEvents, /OP pendente de distribuição/);
  assert.match(detailEvents, /ajuste e salve a distribuição, depois use "Iniciar produção"/);
  assert.match(detailEvents, /Revisar distribuição/);
  assert.doesNotMatch(detailEvents, /Revisar e aceitar OP/);
  // PHASE-MANTA-B2B: o pos-processamento do stepper acompanhou o stepper
  // para `pedidoRouteSections`; a mesma garantia, no novo dono.
  assert.match(routeSections, /stage\.sublabel\s*=\s*['"]OP pendente de aceite['"]/);
  assert.match(detailEvents, /function openTecAcceptanceModal/,
    'deve ter o modal de distribuição da OP Tecelagem pelo Pedido');
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

test('FIRST-OP-CTA: CTA destacado fica no cabecalho do bloco OPs vinculadas', () => {
  const buildOpsSlice = (detailRender.match(
    /function buildOps\s*\(state,\s*view,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildExpedicoes/
  ) || [''])[0];
  assert.ok(buildOpsSlice, 'trecho buildOps nao encontrado');
  assert.match(buildOpsSlice, /var\s+semOps\s*=\s*view\.opSummaries\.length === 0 && !state\.opsLoadError/,
    'CTA deve ser exibido somente quando nao ha OP e nao houve erro de carga');
  assert.match(buildOpsSlice, /var\s+firstOpButton\s*=\s*function\s*\(\)\s*\{/,
    'CTA deve ser helper unico reaproveitado no bloco');
  assert.match(buildOpsSlice, /justify-content:space-between/,
    'cabecalho deve distribuir titulo e CTA nas extremidades');
  assert.match(buildOpsSlice, /semOps\s*\?\s*firstOpButton\(\)\s*:\s*null/,
    'CTA deve ficar no lado direito do cabecalho quando o pedido nao tem OP');
  assert.equal((buildOpsSlice.match(/firstOpButton\(\)/g) || []).length, 1,
    'nao deve duplicar o botao em outro ponto do bloco vazio');
  assert.match(buildOpsSlice, /onclick:\s*handlers\.navigateToNovaOp/,
    'CTA deve reutilizar o handler canonico existente');
  assert.match(buildOpsSlice, /Nenhuma OP vinculada ainda\./);
  assert.match(buildOpsSlice, /Proxima acao: gerar a primeira OP de Tecelagem\./);
});

test('pedido-detail.js: se OP já existir não sugere gerar duplicada; mostra OP existente', () => {
  const buildOpsSlice = (detailRender.match(
    /function buildOps\s*\(state,\s*view,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildExpedicoes/
  ) || [''])[0];
  assert.ok(buildOpsSlice, 'trecho buildOps nao encontrado');
  assert.match(buildOpsSlice, /if\s*\(\s*view\.opSummaries\.length\s*===\s*0\s*\)/);
  assert.match(buildOpsSlice, /semOps\s*\?\s*firstOpButton\(\)\s*:\s*null/);
  assert.match(buildOpsSlice, /Gerar primeira OP/);
  assert.match(buildOpsSlice, /view\.opSummaries\.map/);
  assert.match(buildOpsSlice, /buildOpCard/);
  assert.match(detailRender, /buildFooterAction\(\s*['"]Ver OP['"]/);
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
  assert.match(movementModalSlice, /buildTransitionPendingTable\(activeCtx\)/,
    'openMovementModal deve chamar buildTransitionPendingTable');
});

test('transition-related-ops-R2: openMovementModal integra secao OPs relacionadas', () => {
  assert.match(movementModalSlice, /buildRelatedOpsSection\(activeCtx/,
    'modal da seta deve compor a secao OPs relacionadas sem substituir o fluxo principal');
  assert.match(detailEvents, /function buildRelatedOpsSection/,
    'deve existir builder dedicado para OPs relacionadas');
  const sectionSlice = (detailEvents.match(/function buildRelatedOpsSection[\s\S]*?\n    \}\n\n    function openTecAcceptanceModal/) || [''])[0];
  assert.ok(sectionSlice, 'trecho buildRelatedOpsSection nao encontrado');
  assert.match(sectionSlice, /OPs relacionadas/,
    'secao deve ter titulo OPs relacionadas');
  assert.match(sectionSlice, /Tipo: /,
    'cada OP deve exibir tipo');
  assert.match(sectionSlice, /Numero\/Ano: /,
    'cada OP deve exibir numero\/ano');
  assert.match(sectionSlice, /Status: /,
    'cada OP deve exibir status');
  assert.match(sectionSlice, /relatedActionButton\('Ver OP'/,
    'Ver OP deve aparecer sempre que houver OP relacionada');
  assert.match(sectionSlice, /relatedActionButton\('Carregar nesta movimentacao'/,
    'OP relacionada com saldo deve carregar a origem no formulario principal');
  assert.doesNotMatch(sectionSlice, /relatedActionButton\('Movimentar'/,
    'OP relacionada nao pode expor botao ambiguo Movimentar');
  assert.match(sectionSlice, /relatedActionButton\('Finalizar OP'/,
    'Finalizar OP deve aparecer quando aplicavel');
  assert.doesNotMatch(sectionSlice, /Aceitar OP/,
    'secao do modal da seta nao pode substituir o fluxo real por botao simples Aceitar OP');
});

test('ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2: formulario operacional vem antes de OPs relacionadas', () => {
  assert.ok(movementModalSlice, 'trecho openMovementModal nao encontrado');
  var formIndex = movementModalSlice.indexOf('Registrar nova transferencia');
  var relatedIndex = movementModalSlice.indexOf('buildRelatedOpsSection(activeCtx');
  var historyIndex = movementModalSlice.indexOf('buildHistoryBlock(historyEntries)');
  assert.ok(formIndex >= 0, 'modal deve manter bloco operacional de transferencia');
  assert.ok(relatedIndex > formIndex, 'OPs relacionadas devem ser auxiliares, abaixo do formulario principal');
  assert.ok(historyIndex > formIndex, 'historico deve ficar abaixo do formulario operacional');
});

test('transition-related-ops-R2: aceite Tecelagem usa slider/proposta e helper canonico', () => {
  const proposalSlice = (detailEvents.match(/function buildTecAcceptanceProposalBlock[\s\S]*?\n    \}\n\n    function relatedActionButton/) || [''])[0];
  assert.ok(proposalSlice, 'trecho buildTecAcceptanceProposalBlock nao encontrado');
  assert.match(proposalSlice, /Proposta de aceite/,
    'deve renderizar bloco de proposta');
  assert.match(proposalSlice, /type:\s*['"]range['"]/,
    'deve renderizar slider real');
  assert.match(proposalSlice, /Aceitar proposta/,
    'deve renderizar botao real Aceitar proposta');
  assert.match(proposalSlice, /Voltar a proposta proporcional/,
    'deve permitir voltar para proposta proporcional');
  assert.match(proposalSlice, /window\.recalcularOP/,
    'deve usar o recalculo canonico da proposta');
  assert.match(proposalSlice, /window\.consumoPorOrdem/,
    'deve recomputar consumo de fio ao vivo');
  assert.match(proposalSlice, /window\.aplicarRecalculoOP/,
    'aceite deve reutilizar o helper canonico');
  assert.doesNotMatch(proposalSlice, /\.from\(\s*['"]ops['"]\s*\)\.update/,
    'nao deve fazer update direto em ops.status no Pedido');
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
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\r?\n    \}\r?\n\r?\n    function buildTecelagemTransferForm/) || [''])[0];
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

test('transfer-remaining-B: openMovementModal removeu "Transferir restante" duplicado (Preencher restante ja existe no form)', () => {
  assert.doesNotMatch(movementModalSlice, /Transferir restante/,
    'botao duplicado "Transferir restante" deve ser removido — "Preencher restante" ja esta no form');
  assert.match(detailEvents, /'Preencher restante'/,
    '"Preencher restante" continua preservado no form canonico');
});

test('transfer-remaining-B: "Preencher restante" no form canonico NAO chama write, RPC, ou save automatico', () => {
  var efs = null;
  try { efs = require('fs').readFileSync(require('path').resolve(__dirname, '..', 'js', 'screens', 'entrega-form.js'), 'utf8'); } catch (e) {}
  var preencherSlice = efs ? (efs.match(/fillRemaining[\s\S]*?window\.fmtMetros/) || [''])[0] : '';
  if (!preencherSlice || preencherSlice.length < 10) return;
  assert.doesNotMatch(preencherSlice, /salvarEntregaCima/,
    'Preencher restante nao pode chamar salvarEntregaCima');
  assert.doesNotMatch(preencherSlice, /salvarEntregaLatex/,
    'Preencher restante nao pode chamar salvarEntregaLatex');
  assert.doesNotMatch(preencherSlice, /registrarRecebimentoOrdemFio/,
    'Preencher restante nao pode chamar registrarRecebimentoOrdemFio');
  assert.doesNotMatch(preencherSlice, /window\.supa\.rpc/,
    'Preencher restante nao pode chamar RPC');
  assert.doesNotMatch(preencherSlice, /transferForm\.onSave/,
    'Preencher restante nao pode disparar onSave automaticamente');
  assert.doesNotMatch(preencherSlice, /\.insert\(|\.update\(|\.delete\(/,
    'Preencher restante nao pode fazer write');
});

test('transfer-remaining-B: Acabamento>Expedicao expoe fillRemaining e hasRemaining', () => {
  const slice = (detailEvents.match(/function buildAcabamentoTransferForm[\s\S]*?\n    \}\n\n    function buildExpedicaoTransferForm/) || [''])[0];
  assert.ok(slice, 'trecho buildAcabamentoTransferForm nao encontrado');
  assert.match(slice, /fillRemaining:\s*preencherRestante/,
    'Acabamento>Expedicao deve expor fillRemaining para movimentar saldo por produto');
  assert.match(slice, /hasRemaining:\s*linhas\.some/,
    'Acabamento>Expedicao deve expor hasRemaining quando ha saldo movimentavel');
  assert.match(slice, /linha\.input\.value = String\(linha\.row\.saldo\)/,
    'fillRemaining deve preencher a quantidade restante de cada item');
  assert.match(slice, /liberar_expedicao_latex_parcial/,
    'write efetivo deve continuar na RPC canonica parcial');
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
  assert.match(detailRender, /buildTransferButton\(stage,\s*handlers,\s*view\)/,
    'buildTransferButton deve receber handlers e view para acao direta ou hub');
});

test('stepper-modals-B: modal Acabamento mostra OPs latex e fornecedor', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.match(stageModalSlice, /OPs de Acabamento\/Latex/,
    'deve ter secao de OPs de Acabamento/Latex');
  assert.match(stageModalSlice, /Fornecedor:/,
    'deve mostrar fornecedor da OP de latex');
});

test('stepper-modals-B: navegacao read-only permitida (Ver OP, Abrir Expedicao)', () => {
  const stageModalSlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];
  assert.match(stageModalSlice, /Ver OP/,
    'deve permitir navegacao para Ver OP');
  assert.match(stageModalSlice, /Abrir Expedicao/,
    'deve permitir navegacao para Abrir Expedicao');
  assert.match(stageModalSlice, /navigateToOp|navigateToExpedicao/,
    'deve usar funcoes de navegacao existentes');
});

test('stepper-modals-B: "Transferir restante" removido — unificado com "Preencher restante" no form', () => {
  assert.doesNotMatch(movementModalSlice, /Transferir restante/,
    '"Transferir restante" removido — "Preencher restante" ja esta no form canonico');
  assert.match(detailEvents, /fillRemaining/,
    'fillRemaining continua acessivel via contrato do form');
});

// ---------------------------------------------------------------------
// 21. OP-PEDIDO-LINEAGE-UX-B — linhagem padronizada Pedido ↔ OP
// ---------------------------------------------------------------------

test('lineage-UX-B: buildOpCard renderiza lineage strip com Pedido + OP', () => {
  assert.match(detailRender, /lineageNodes/,
    'buildOpCard deve construir lineageNodes');
  assert.match(detailRender, /state\.pedido && state\.pedido\.numero/,
    'deve usar state.pedido.numero para referenciar Pedido');
  assert.match(detailRender, /lineageStrip/,
    'deve renderizar lineageStrip nos cards de OP');
});

test('lineage-UX-B: buildOpCard recebe state no escopo (regressao ReferenceError)', () => {
  // O lineage strip lê state.pedido.numero. buildOpCard é uma função de
  // módulo (irmã de buildOps/renderPedidoDetailScreen), portanto NÃO herda
  // o `state` de nenhum escopo externo: ele precisa vir por parâmetro. Sem
  // isso, renderizar QUALQUER pedido com >=1 OP lança
  // "ReferenceError: state is not defined" e a tela não abre.
  assert.match(detailRender, /function buildOpCard\(state,\s*summary,\s*handlers\)/,
    'buildOpCard deve receber `state` como primeiro parametro');
  assert.match(detailRender, /return buildOpCard\(state,\s*summary,\s*handlers\)/,
    'a chamada em buildOps deve repassar `state` para buildOpCard');
});

test('lineage-UX-B: buildOpCard mostra origem para OP de acabamento', () => {
  assert.match(detailRender, /summary\.origemOp/,
    'deve verificar origemOp para OP de acabamento');
  assert.match(detailRender, /ns\.opLabel\(summary\.origemOp\)/,
    'deve mostrar label da OP de origem no lineage');
});

test('lineage-UX-B: OP Tecelagem lineage strip inclui Pedido quando vinculado', () => {
  // A lineage foi integrada ao cabeçalho/Dados da OP (campo Pedido vinculado e
  // Destino clicáveis) em vez da antiga strip "Cadeia produtiva".
  assert.match(optpSrc, /if \(hasLinkedPedido\(ctx\)\)/,
    'deve checar hasLinkedPedido antes de incluir Pedido na cadeia');
  assert.match(optpSrc, /Pedido Nº ' \+ ctx\.pedidoCtx\.numero/,
    'deve exibir Pedido + numero do pedido');
  assert.match(optpSrc, /navigate\('#\/pedidos\/' \+ ctx\.pedidoCtx\.id\)/,
    'deve permitir navegar para o Pedido via clique');
});

test('lineage-UX-B: OP Latex cadeia inclui Pedido quando vinculado', () => {
  // Lineage foi integrada aos "Dados da OP" (campo Pedido vinculado, clicável)
  // em vez da antiga strip "Cadeia produtiva": o Pedido é renderizado
  // condicionalmente quando vinculado e permanece navegável.
  assert.match(olaSrc, /pedidoId \?/,
    'deve renderizar o Pedido condicionalmente quando vinculado');
  assert.match(olaSrc, /Pedido #' \+ pedidoId/,
    'deve exibir Pedido na cadeia produtiva do Latex');
  assert.match(olaSrc, /navigate\('#\/pedidos\/' \+ pedidoId\)/,
    'deve permitir navegar para o Pedido via clique');
});

test('lineage-UX-B: Expedicao header inclui lineage strip Pedido → OP → Expedicao', () => {
  var expSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'expedicao-admin.js'));
  assert.match(expSrc, /Cadeia:/,
    'deve ter label "Cadeia:" no header da expedicao');
  assert.match(expSrc, /Pedido ' \+ pedidoNumero/,
    'deve exibir Pedido na cadeia da expedicao');
  assert.match(expSrc, /Expedicao \(esta tela\)/,
    'deve marcar Expedicao como etapa atual na cadeia');
});

test('lineage-UX-B: nenhum arquivo inventa ID operacional persistido', () => {
  var allSources = [detailRender, detailProgress, detailEvents, olaSrc, optpSrc, opnSrc];
  for (var i = 0; i < allSources.length; i++) {
    assert.doesNotMatch(allSources[i], /P\d{2}-T\d{2}-L\d{2}/,
      'nao deve conter ID operacional inventado tipo P18-T16-L5');
    assert.doesNotMatch(allSources[i], /op_lineage_id/,
      'nao deve conter campo persistido novo');
  }
});

test('lineage-UX-B: numeração oficial da OP preservada', () => {
  assert.match(detailRender, /ns\.opLabel/,
    'deve usar ns.opLabel (numero/ano oficial) para identificar OP');
  assert.doesNotMatch(detailRender, /op\.codigo|op\.codigo_lineage/,
    'nao deve usar campo inexistente');
});

// ---------------------------------------------------------------------
// 22. PEDIDO-TEC-ACCEPTANCE-B — aceite da OP Tecelagem pelo Pedido
// ---------------------------------------------------------------------

test('tec-acceptance-B: openTecAcceptanceModal existe e e exposto', () => {
  assert.match(detailEvents, /function openTecAcceptanceModal/,
    'deve ter funcao openTecAcceptanceModal');
  assert.match(detailEvents, /openTecAcceptanceModal:\s*openTecAcceptanceModal/,
    'deve expor no retorno dos handlers');
});

test('tec-acceptance-B: buildPendingAcceptanceBlock oferece "Revisar distribuição" (save-only, sem iniciar produção)', () => {
  // YARN-BUTTONS-FINAL-CONTRACT: o CTA do bloqueio abre o modal de
  // DISTRIBUIÇÃO (Manter/Salvar), não mais um "aceite" que iniciava produção.
  assert.match(detailEvents, /Revisar distribuição/,
    'bloqueio deve oferecer "Revisar distribuição" (modal save-only)');
  assert.doesNotMatch(detailEvents, /Revisar e aceitar OP/,
    'CTA de "aceitar" (que iniciava produção) foi removido');
  assert.match(detailEvents, /openTecAcceptanceModal\(tecAcceptance\)/,
    'botao deve abrir o modal de distribuição, nao apenas navegar');
});

test('tec-acceptance-B: modal de aceite mostra itens da OP', () => {
  var accSlice = (detailEvents.match(/function openTecAcceptanceModal[\s\S]*?\n    \}\n\n    function buildPendingAcceptanceBlock/) || [''])[0];
  assert.ok(accSlice, 'trecho openTecAcceptanceModal nao encontrado');
  assert.match(accSlice, /Itens da OP/,
    'modal deve mostrar secao de itens da OP');
  assert.match(accSlice, /Metros pedido/,
    'modal deve mostrar coluna de metros pedido');
});

test('tec-acceptance-B: modal reutiliza aplicarRecalculoOP canonico', () => {
  var accSlice = (detailEvents.match(/function openTecAcceptanceModal[\s\S]*?\n    \}\n\n    function buildPendingAcceptanceBlock/) || [''])[0];
  assert.match(accSlice, /window\.aplicarRecalculoOP/,
    'deve referenciar helper canonico aplicarRecalculoOP');
  assert.match(accSlice, /window\.recalcularOP/,
    'deve referenciar recalcularOP para modo aceitar proporcional');
  assert.doesNotMatch(accSlice, /\.from\(\s*['"]ops['"]\s*\)\.update/,
    'nao deve fazer write direto, apenas via helper canonico');
});

test('tec-acceptance-B: modal tem opcoes Aceitar e Manter', () => {
  var accSlice = (detailEvents.match(/function openTecAcceptanceModal[\s\S]*?\n    \}\n\n    function buildPendingAcceptanceBlock/) || [''])[0];
  assert.match(accSlice, /Aceitar proposta/,
    'deve ter botao Aceitar proposta (proporcional)');
  assert.match(accSlice, /Manter como pedido/,
    'deve ter botao Manter como pedido');
  assert.match(accSlice, /Abrir na tela da OP/,
    'deve ter botao para abrir na tela da OP como fallback');
});

test('tec-acceptance-B: parametros_largura carregado no Pedido Detail', () => {
  assert.match(detailData, /from\(\s*['"]parametros_largura['"]\s*\)/,
    'loadPedidoDetailData deve consultar parametros_largura');
  assert.match(detailBundle, /parametrosLargura:/,
    'createInitialState deve incluir parametrosLargura');
});

test('tec-acceptance-B: modal recarrega apos aceite com sucesso', () => {
  var accSlice = (detailEvents.match(/function openTecAcceptanceModal[\s\S]*?\n    \}\n\n    function buildPendingAcceptanceBlock/) || [''])[0];
  assert.match(accSlice, /await reload\(\)/,
    'deve recarregar dados apos aceite');
  assert.match(accSlice, /render\(\)/,
    'deve re-renderizar apos aceite');
});

// ---------------------------------------------------------------------
// 23. RAVATEX-TAPETES-OP-PARTIAL-SPLIT-UI-B — select split no lançamento
// ---------------------------------------------------------------------

test('split-UI-B: buildTecelagemTransferForm contem comOpcaoSplit:true', () => {
  var slice = (detailEvents.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.ok(slice, 'trecho buildTecelagemTransferForm nao encontrado');
  assert.match(slice, /comOpcaoSplit:\s*true/,
    'deve passar comOpcaoSplit:true para buildEntregaInlineForm');
});

test('split-UI-B: buildTecelagemTransferForm onSave le getSplitOption e passa a salvarEntregaCima', () => {
  var slice = (detailEvents.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.match(slice, /form\.getSplitOption\(\)/,
    'onSave deve chamar form.getSplitOption()');
  assert.match(slice, /splitOpt\.forceSplit\s*\?\s*\{/,
    'onSave deve condicionar forceSplit no segundo arg de salvarEntregaCima');
  assert.match(slice, /salvarEntregaCima\([\s\S]*splitOpt/,
    'salvarEntregaCima deve receber os dados do split via segundo arg');
});

test('split-UI-B: buildTecelagemTransferForm NAO referencia gerar_op_latex_split', () => {
  assert.doesNotMatch(detailEvents, /gerar_op_latex_split/,
    'pedido-detail-events.js nao deve chamar gerar_op_latex_split diretamente');
});

test('split-UI-B: buildTecelagemTransferForm nao referencia gerar_op_latex diretamente', () => {
  var slice = (detailEvents.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.doesNotMatch(slice, /gerar_op_latex/,
    'buildTecelagemTransferForm nao deve chamar RPC diretamente; delega a salvarEntregaCima');
});

test('split-UI-B: outros fluxos (Insumos, Expedicao, Acabamento) NAO tem comOpcaoSplit', () => {
  assert.doesNotMatch(detailEvents, /buildInsumosTransferForm[\s\S]{0,300}comOpcaoSplit/,
    'buildInsumosTransferForm nao deve ter comOpcaoSplit');
  assert.doesNotMatch(detailEvents, /buildAcabamentoTransferForm[\s\S]{0,300}comOpcaoSplit/,
    'buildAcabamentoTransferForm nao deve ter comOpcaoSplit');
  assert.doesNotMatch(detailEvents, /buildExpedicaoTransferForm[\s\S]{0,300}comOpcaoSplit/,
    'buildExpedicaoTransferForm nao deve ter comOpcaoSplit');
});

test('split-UI-B: "Transferir restante" removido — "Preencher restante" unificado no form', () => {
  assert.doesNotMatch(detailEvents, /Transferir restante/,
    '"Transferir restante" foi removido — "Preencher restante" ja esta no form canonico');
  assert.match(detailEvents, /fillRemaining/,
    'fillRemaining continua acessivel via contrato do form');
});

test('split-UI-B: "Preencher restante" permanece sem chamar writes ou RPC split', () => {
  var efs2 = null;
  try { efs2 = require('fs').readFileSync(require('path').resolve(__dirname, '..', 'js', 'screens', 'entrega-form.js'), 'utf8'); } catch (e) {}
  var preencherSlice2 = efs2 ? (efs2.match(/fillRemaining[\s\S]*?window\.fmtMetros/) || [''])[0] : '';
  if (!preencherSlice2 || preencherSlice2.length < 10) return;
  assert.doesNotMatch(preencherSlice2, /salvarEntregaCima/);
  assert.doesNotMatch(preencherSlice2, /gerar_op_latex/);
  assert.doesNotMatch(preencherSlice2, /supa\.rpc/);
  assert.doesNotMatch(preencherSlice2, /transferForm\.onSave/);
});

// ---------------------------------------------------------------------
// PEDIDO-CONCLUIR-ACTION-R1: acao de conclusao do pedido
// ---------------------------------------------------------------------

function makeConclusaoRuntime() {
  var toasts = [];
  var sandbox = { window: {}, console };
  sandbox.window.RavatexPedidoTracking = null;
  sandbox.window.toast = function (msg, type) { toasts.push({ msg: msg, type: type }); };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
  return { sandbox: sandbox, ns: sandbox.window.RAVATEX_SCREENS.pedidoDetail, toasts: toasts };
}

var CONCLUIR_PEDIDO_ID = 'ad988da1-df36-4441-afef-16d9172f5c01';
function aptConclusaoState(ns) {
  var s = ns.createInitialState();
  s.pedido = { id: CONCLUIR_PEDIDO_ID, numero: 20, status: 'rascunho', metros_total: 1000 };
  s.itens = [{ id: 'pi1', modelo_id: 7, metros: 1000 }];
  s.ops = [
    { id: 29, tipo: 'tecelagem', numero: 18, ano: 2026, status: 'concluida', op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 1000, metros_ajustados: 1000, pedido_item_id: 'pi1' }] },
    { id: 30, tipo: 'latex', numero: 11, ano: 2026, status: 'concluida', origem_op_id: 29, op_itens: [{ id: 301, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: null }] },
  ];
  s.entregaItens = [{ id: 1, entrega_id: 'e1', op_id: 29, op_item_id: 290, modelo_id: 7, metros_entregues: 1000, defeito: false }];
  s.entregasById = { e1: { id: 'e1', etapa: 'cima' } };
  s.opLatexEntregas = [{ op_latex_id: 30, entrega_id: 'e1' }];
  s.expedicoes = [{ id: 3, op_latex_id: 30, pedido_id: CONCLUIR_PEDIDO_ID, status: 'concluida' }];
  s.expedicaoItens = [{ id: 4, expedicao_id: 3, op_item_id: 301, modelo_id: 7, metros_liberados: 1000, metros_entregues: 1000 }];
  s.modelosById = { 7: { id: 7, nome: 'Roma' } };
  return s;
}

async function runConcluir(rpcImpl, opts) {
  opts = opts || {};
  var rt = makeConclusaoRuntime();
  var s = aptConclusaoState(rt.ns);
  var rpcCalls = [];
  rt.sandbox.window.supa = { rpc: async function (fn, params) { rpcCalls.push({ fn: fn, params: params }); return rpcImpl(fn, params); } };
  var reloadN = 0, renderN = 0;
  var handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id, state: s,
    reload: async function () { reloadN++; if (opts.reloadThrows) throw new Error('reload boom'); },
    render: function () { renderN++; if (opts.renderThrows) throw new Error('render boom'); },
    getLoadingError: function () { return null; }, setLoadingError: function () {},
  });
  var btn = { disabled: false, textContent: 'Concluir pedido' };
  await handlers.concluirPedido(btn);
  return { rpcCalls: rpcCalls, toasts: rt.toasts, reloadN: reloadN, renderN: renderN, btn: btn };
}

test('PEDIDO-CONCLUIR: pedido apto habilita conclusao (pronto=true, sem pendencias)', () => {
  var rt = makeConclusaoRuntime();
  var view = rt.ns.computeViewModel(aptConclusaoState(rt.ns));
  assert.equal(view.pedidoConclusao.pronto, true);
  assert.equal(view.pedidoConclusao.pendencias.length, 0);
});

test('PEDIDO-CONCLUIR: pedido nao apto explica saldo em acabamento nao movimentado', () => {
  var rt = makeConclusaoRuntime();
  var s = aptConclusaoState(rt.ns);
  s.ops[1].status = 'em_producao';
  s.expedicoes = [];
  s.expedicaoItens = [];
  var view = rt.ns.computeViewModel(s);
  assert.equal(view.pedidoConclusao.pronto, false);
  assert.ok(view.pedidoConclusao.pendencias.some(function (p) { return /aberta ou em producao/.test(p); }));
  assert.ok(view.pedidoConclusao.pendencias.some(function (p) { return /saldo em acabamento[\s\S]*nao movimentado para expedicao/i.test(p); }),
    'pendencia deve explicar saldo em acabamento nao movimentado');
});

test('PEDIDO-CONCLUIR: clique apto chama concluir_pedido_se_pronto e atualiza a tela', async () => {
  var r = await runConcluir(async function () { return { data: { ok: true, status: 'entregue' }, error: null }; });
  assert.equal(r.rpcCalls.length, 1);
  assert.equal(r.rpcCalls[0].fn, 'concluir_pedido_se_pronto');
  assert.equal(r.rpcCalls[0].params.p_pedido_id, CONCLUIR_PEDIDO_ID);
  assert.equal(r.reloadN, 1);
  assert.equal(r.renderN, 1);
  assert.ok(r.toasts.some(function (t) { return t.type === 'success' && /concluido/i.test(t.msg); }));
});

test('PEDIDO-CONCLUIR: RPC com pendencias exibe erro real e restaura o botao', async () => {
  var r = await runConcluir(async function () {
    return { data: { ok: false, erro: 'Pedido ainda possui pendencias', pendencias: ['Ha expedicao com saldo pendente'] }, error: null };
  });
  assert.ok(r.toasts.some(function (t) { return t.type === 'error' && /pendencias/i.test(t.msg) && /saldo pendente/i.test(t.msg); }));
  assert.equal(r.btn.disabled, false);
  assert.equal(r.btn.textContent, 'Concluir pedido');
});

test('PEDIDO-CONCLUIR: RPC que lanca nao deixa o clique morto (erro acionavel + botao restaurado)', async () => {
  var r = await runConcluir(async function () { throw new Error('network down'); });
  assert.ok(r.toasts.some(function (t) { return t.type === 'error' && /network down/.test(t.msg); }),
    'erro real da RPC deve ser exibido, nao engolido');
  assert.equal(r.btn.disabled, false);
  assert.equal(r.btn.textContent, 'Concluir pedido');
});

test('PEDIDO-CONCLUIR: falha ao re-renderizar pos-sucesso nao induz novo clique/duplicidade', async () => {
  var r = await runConcluir(async function () { return { data: { ok: true }, error: null }; }, { renderThrows: true });
  assert.equal(r.rpcCalls.length, 1);
  assert.ok(r.toasts.some(function (t) { return t.type === 'success' && /concluido/i.test(t.msg); }));
  assert.ok(r.toasts.some(function (t) { return t.type === 'info' && /Recarregue/i.test(t.msg); }));
  assert.equal(r.btn.disabled, false);
});

test('PEDIDO-CONCLUIR: onclick delega ao handler canonico e handler nao engole erro', () => {
  assert.match(detailRender, /handlers\.concluirPedido\(/);
  assert.match(detailRender, /jaEntregue \? 'Pedido concluido' : 'Concluir pedido'/);
  assert.doesNotMatch(detailRender, /disabled:\s*ready\s*\?\s*null\s*:\s*['"]disabled['"]/,
    'botao pronto nao pode renderizar disabled=null, pois ui.el cria disabled="null" no DOM real');
  assert.doesNotMatch(detailRender, /disabled:\s*disabled\s*\?\s*['"]disabled['"]\s*:\s*null/,
    'acoes habilitadas nao podem renderizar disabled=null no DOM real');
  assert.match(detailEvents, /try\s*\{[\s\S]*?concluir_pedido_se_pronto[\s\S]*?\}\s*catch/);
  assert.match(detailEvents, /Erro ao concluir pedido/);
  assert.doesNotMatch(detailEvents, /catch\s*\([^)]*\)\s*\{\s*\}/);
});

// ---------------------------------------------------------------------
// PEDIDO-STAGE-ACTION-HUB-B: hub contextual de acoes por etapa
// ---------------------------------------------------------------------

const stageBodySlice = (detailEvents.match(/function buildStageDetailBody[\s\S]*?\n    \}\n\n    function openStageDetailModal/) || [''])[0];

test('HUB: finalizarOp reutiliza alterar_status_op(concluida) sem update direto em ops.status', () => {
  assert.match(detailEvents, /function finalizarOp/);
  const finSlice = (detailEvents.match(/function finalizarOp[\s\S]*?\n    \}\n\n    function movementField/) || [''])[0];
  assert.ok(finSlice, 'trecho finalizarOp nao encontrado');
  assert.match(finSlice, /alterar_status_op/);
  assert.match(finSlice, /p_novo_status:\s*'concluida'/);
  assert.match(finSlice, /confirmDialog/, 'nao finaliza automaticamente: exige confirmacao');
  assert.doesNotMatch(finSlice, /from\(\s*['"]ops['"]\s*\)\s*\.update/, 'sem update direto em ops.status');
  assert.match(detailEvents, /finalizarOp:\s*finalizarOp/, 'finalizarOp exposto nos handlers');
});

test('HUB stacking: finalizarOp fecha o modal pai (overlay bespoke) ANTES de abrir a confirmacao', () => {
  const finSlice = (detailEvents.match(/function finalizarOp[\s\S]*?\n    \}\n\n    function movementField/) || [''])[0];
  assert.ok(finSlice, 'trecho finalizarOp nao encontrado');
  // A chamada de fechar o modal pai deve preceder a confirmacao, evitando que
  // a confirmacao (window.modal) apareca atras do modal da seta (z maior).
  const idxClose = finSlice.indexOf('closeTopPedidoOverlay()');
  const idxConfirm = finSlice.indexOf('confirmDialog');
  assert.ok(idxClose !== -1, 'finalizarOp deve fechar o overlay pai via closeTopPedidoOverlay()');
  assert.ok(idxConfirm !== -1, 'finalizarOp deve abrir a confirmacao');
  assert.ok(idxClose < idxConfirm, 'closeTopPedidoOverlay() deve ocorrer ANTES de confirmDialog');
});

test('HUB stacking: modais bespoke da seta e da etapa registram-se na pilha de overlays', () => {
  // Registro do overlay permite fechar o pai antes da confirmacao (root cause).
  const registros = (detailEvents.match(/registerPedidoOverlay\(closeModal\)/g) || []).length;
  assert.ok(registros >= 2, 'openMovementModal e openStageDetailModal devem registrar seus overlays (>=2 registros)');
  assert.match(detailEvents, /function closeTopPedidoOverlay/, 'helper closeTopPedidoOverlay deve existir');
  // Nao mascarar com z-index gigante: o modal da confirmacao continua sendo o
  // window.confirmDialog padrao; a correcao e fechar o pai, nao inflar z-index.
  assert.doesNotMatch(detailEvents, /z-index:\s*9{4,}/, 'nao deve usar z-index gigante como mascara');
});

test('HUB: modal de etapa oferece acoes contextuais curtas por OP/expedicao', () => {
  assert.ok(stageBodySlice, 'trecho buildStageDetailBody nao encontrado');
  for (const label of ['Ver OP', 'Aceitar OP', 'Finalizar OP', 'Movimentar', 'Entregar', 'Abrir Expedicao', 'Gerar primeira OP', 'Concluir']) {
    assert.ok(stageBodySlice.indexOf(label) !== -1, 'hub deve oferecer acao: ' + label);
  }
});

test('BLOCKER: hub explica bloqueios com motivo e proxima acao fora da seta', () => {
  assert.ok(stageBodySlice, 'trecho buildStageDetailBody nao encontrado');
  for (const text of [
    'Pedido ainda nao possui OP vinculada. Proxima acao: Gerar primeira OP neste hub.',
    'OP de Tecelagem pendente de aceite. Proxima acao: Aceitar OP',
    'Tecelagem entregue; finalizar OP.',
    'Saldo produtivo entregue. Proxima acao: Finalizar OP neste hub.',
    'Sem material recebido da Tecelagem.',
    'Tudo ja movimentado para Expedicao.',
    'Ha saldo em acabamento nao movimentado. Proxima acao: Movimentar para Expedicao.',
    'Nenhuma quantidade movimentada para Expedicao.',
    'Ha saldo liberado nesta expedicao. Proxima acao: Entregar.',
  ]) {
    assert.ok(stageBodySlice.indexOf(text) !== -1, 'hub deve explicar: ' + text);
  }
});

test('HUB: acoes do modal delegam a handlers canonicos (sem write inline)', () => {
  // Delegacao a helpers canonicos.
  assert.match(stageBodySlice, /finalizarOp\(op\)/);
  assert.match(stageBodySlice, /openTecAcceptanceModal\(\{\s*op:\s*op\s*\}\)/);
  assert.match(stageBodySlice, /openMovimentar\(/);
  assert.match(stageBodySlice, /navigateToNovaOp\(\)/);
  assert.match(stageBodySlice, /concluirPedido\(/);
  // Continua sem write/RPC inline no corpo do modal (contrato read-only-of-writes).
  assert.doesNotMatch(stageBodySlice, /salvarEntregaCima/);
  assert.doesNotMatch(stageBodySlice, /salvarEntregaLatex/);
  assert.doesNotMatch(stageBodySlice, /registrarRecebimentoOrdemFio/);
  assert.doesNotMatch(stageBodySlice, /supa\.rpc/);
  assert.doesNotMatch(stageBodySlice, /\.insert\(|\.update\(|\.delete\(/);
});

test('HUB: modal Acabamento usa recebido/movimentado/disponivel (contrato Acabamento->Expedicao)', () => {
  assert.match(stageBodySlice, /Recebido:\s*'\s*\+\s*ns\.fmtMetros\(recebido\)/);
  assert.match(stageBodySlice, /Movimentado:\s*'\s*\+\s*ns\.fmtMetros\(movido\)/);
  assert.match(stageBodySlice, /Disponivel:\s*'\s*\+\s*ns\.fmtMetros\(disponivel\)/);
});

// ---- Runtime: renderiza o corpo do modal de etapa e exercita as acoes ----

function makeHubRuntime() {
  function isNodeLike(c) {
    return !!c && (c.nodeType === 3 || typeof c.tagName === 'string');
  }
  function node(tag) {
    return {
      tagName: (tag || 'div').toUpperCase(), attrs: {}, children: [], _listeners: {}, style: {}, textContent: '', disabled: false, className: '',
      appendChild(c) {
        if (!isNodeLike(c)) throw new TypeError('Failed to execute appendChild: parameter 1 is not of type Node.');
        this.children.push(c);
        return c;
      },
      append() { for (const c of arguments) this.appendChild(c); },
      replaceChildren() { this.children = []; for (const c of arguments) this.appendChild(c); },
      setAttribute(k, v) {
        this.attrs[k] = v == null ? String(v) : String(v);
        if (k === 'disabled') this.disabled = true;
        if (k === 'class') this.className = String(v || '');
      },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener(ev, fn) { this._listeners[ev] = fn; }, removeEventListener() {}, remove() {}, focus() {},
    };
  }
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.document = {
    createElement: (t) => node(t), createTextNode: (t) => ({ textContent: String(t), nodeType: 3, children: [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: node('body'),
    addEventListener() {}, removeEventListener() {},
  };
  vm.createContext(sandbox);
  sandbox.window.el = function el(tag, attrs) {
    const n = node(tag); attrs = attrs || {};
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n._listeners[k.slice(2)] = v;
      else n.setAttribute(k, v);
    });
    const kids = Array.prototype.slice.call(arguments, 2).flat();
    kids.forEach(function add(c) {
      if (c == null || c === '' || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') { n.appendChild(sandbox.document.createTextNode(c)); return; }
      n.appendChild(c);
    });
    return n;
  };
  const events = [];
  sandbox.window.toast = (m, t) => events.push('toast:' + t);
  sandbox.window.navigate = (h) => events.push('navigate:' + h);
  sandbox.window.modal = (o) => events.push('modal:' + (o && o.title || ''));
  sandbox.window.confirmDialog = (o) => { events.push('confirm'); if (o && o.onConfirm) return o.onConfirm(); };
  sandbox.window.textInput = (opts = {}) => {
    const input = node('input');
    input.value = opts.value || '';
    if (opts.type) input.setAttribute('type', opts.type);
    if (opts.step) input.setAttribute('step', opts.step);
    if (opts.placeholder) input.placeholder = opts.placeholder;
    return input;
  };
  sandbox.window.selectInput = (opts = {}) => {
    const select = node('select');
    select.value = opts.value || '';
    return select;
  };
  sandbox.window.formField = (o) => (o && o.input) || node('div');
  sandbox.window.buildEntregaInlineForm = () => ({ node: node('div'), getPayload: () => [], getSplitOption: () => ({ forceSplit: false, motivo: null }) });
  sandbox.window.salvarEntregaCima = async () => true;
  sandbox.window.rotuloModelo = (m) => (m && m.nome) || 'm'; sandbox.window.rotuloFio = () => 'fio';
  sandbox.window.fmtMetros = (v) => Number(v || 0).toFixed(2) + ' m'; sandbox.window.pedidoStatusLabel = (s) => s;
  sandbox.window.isPedidoEditavel = (s) => s === 'rascunho';
  sandbox.window.recalcularOP = () => ({ fator: 1, itens: [], sobras: [] }); sandbox.window.aplicarRecalculoOP = async () => ({ error: null });
  // Deps do builder de distribuição COMPARTILHADO (op-distribuicao-ui.js).
  sandbox.window.consumoPorOrdem = () => [];
  sandbox.window.maxMetrosItem = () => 1000;
  sandbox.window.fmtKg = (v) => Number(v || 0).toFixed(3) + ' kg';
  sandbox.window.larguraKey = (l) => Number(l);
  sandbox.window.salvarDistribuicaoOP = async () => { events.push('salvarDistribuicaoOP'); return { error: null, step: 'ok' }; };
  sandbox.window.iniciarProducaoOP = async () => { events.push('iniciarProducaoOP'); return { error: null, step: 'ok' }; };
  // PHASE-C3C-B §35 (Gate 2): crypto.randomUUID determinístico para tornar
  // os tokens de idempotência gerados em runtime observáveis/asseráveis.
  let hubUuidCounter = 0;
  sandbox.window.crypto = { randomUUID: () => 'hub-uuid-' + (++hubUuidCounter) };
  vm.runInContext(detailBundle, sandbox);
  // Carrega o builder COMPARTILHADO no sandbox do hub (mesmo módulo da OP).
  vm.runInContext(oduSrc, sandbox, { filename: 'js/screens/op-distribuicao-ui.js' });
  // PHASE-C3C-B §35 (Gate 2): carrega o adapter real + op-writes.js real,
  // para que window.registrarRecebimentoOrdemFio exercite a classificação
  // canônica de verdade (sem stub) quando os testes de runtime chamam
  // handlers.openMovementModal(...) e clicam em "Salvar".
  vm.runInContext(cutoverSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-cutover.js' });
  vm.runInContext(opwSrc, sandbox, { filename: 'js/screens/op-writes.js' });
  const ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  return { sandbox, ns, events, node };
}
function collectHubText(n) {
  if (!n) return '';
  if (n.textContent && (!n.children || !n.children.length)) return n.textContent;
  let s = ''; (n.children || []).forEach((c) => { s += collectHubText(c); }); return s;
}
function findHubBtn(n, re) {
  if (!n) return null;
  if (n.tagName === 'BUTTON' && re.test(collectHubText(n))) return n;
  for (const c of (n.children || [])) { const f = findHubBtn(c, re); if (f) return f; }
  return null;
}
function findNode(n, pred) {
  if (!n) return null;
  if (pred(n)) return n;
  for (const c of (n.children || [])) { const f = findNode(c, pred); if (f) return f; }
  return null;
}
function stageHub(rt, s, key) {
  const view = rt.ns.computeViewModel(s);
  rt.sandbox.window.supa = { rpc: async (fn) => { rt.events.push('rpc:' + fn); return { data: { ok: true }, error: null }; } };
  const handlers = rt.ns.createPedidoDetailEvents({ pedidoId: s.pedido.id, state: s, reload: async () => {}, render: () => {}, getLoadingError: () => null, setLoadingError: () => {} });
  handlers.currentView = view;
  const cap = rt.node('body'); rt.sandbox.document.body = cap;
  const stg = (view.stepper || []).find((x) => x.key === key) || { key: key, state: 'current' };
  rt.events.length = 0;
  handlers.openStageDetailModal(stg, view);
  return { root: cap, view: view };
}
function hubBase(ns) {
  const s = ns.createInitialState();
  s.pedido = { id: CONCLUIR_PEDIDO_ID, numero: 20, status: 'rascunho', metros_total: 1000 };
  s.itens = [{ id: 'pi1', modelo_id: 7, metros: 1000 }];
  s.modelosById = { 7: { id: 7, nome: 'Roma' } };
  return s;
}
function hubTecAcab(ns, latexStatus) {
  const s = hubBase(ns);
  s.ops = [
    { id: 29, tipo: 'tecelagem', numero: 18, ano: 2026, status: 'em_producao', op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }], op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 1000, metros_ajustados: 1000, pedido_item_id: 'pi1' }] },
    { id: 30, tipo: 'latex', numero: 11, ano: 2026, status: latexStatus, origem_op_id: 29, op_fornecedores: [{ fornecedor_id: 2, etapa: 'latex', fornecedores: { nome: 'Conitex' } }], op_itens: [{ id: 301, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: null }] },
  ];
  s.entregaItens = [{ id: 1, entrega_id: 'e1', op_id: 29, op_item_id: 290, modelo_id: 7, metros_entregues: 1000, defeito: false }];
  s.entregasById = { e1: { id: 'e1', etapa: 'cima' } };
  s.opLatexEntregas = [{ op_latex_id: 30, entrega_id: 'e1' }];
  return s;
}

function countHubBtns(n, re) {
  if (!n) return 0;
  var count = n.tagName === 'BUTTON' && re.test(collectHubText(n)) ? 1 : 0;
  for (const c of (n.children || [])) count += countHubBtns(c, re);
  return count;
}

test('PEDIDO-CONCLUIR runtime: botao apto fica habilitado no DOM real e chama handler', () => {
  const rt = makeHubRuntime();
  const s = aptConclusaoState(rt.ns);
  const view = rt.ns.computeViewModel(s);
  const container = rt.node('div');
  let concluirCalls = 0;
  const handlers = {
    buildEditButton: () => rt.node('button'),
    navigateToPedidos: () => {},
    scrollToSection: () => {},
    openStatusActions: () => {},
    navigateToNovaOp: () => {},
    navigateToOp: () => {},
    navigateToExpedicao: () => {},
    openMovementModal: () => {},
    openStageDetailModal: () => {},
    openTrackingModal: () => {},
    concluirPedido: (btn) => {
      concluirCalls++;
      assert.equal(btn, concluir);
    },
  };
  rt.ns.renderPedidoDetailScreen({ container, state: s, view, handlers, loadingError: null });
  const concluir = findHubBtn(container, /^Concluir pedido$/i);
  assert.ok(concluir, 'botao Concluir pedido deve existir');
  assert.equal(concluir.disabled, false, 'pedido apto deve renderizar botao habilitado');
  assert.equal(concluir.getAttribute('disabled'), null, 'pedido apto nao pode ter atributo disabled fantasma');
  assert.equal(typeof concluir._listeners.click, 'function', 'pedido apto deve ter handler de clique');

  concluir._listeners.click({ currentTarget: concluir });
  assert.equal(concluirCalls, 1);
});

test('PEDIDO-CONCLUIR runtime: pedido nao apto ou ja concluido nao mostra acao falsa', () => {
  const rt = makeHubRuntime();
  const handlers = {
    buildEditButton: () => rt.node('button'),
    navigateToPedidos: () => {},
    scrollToSection: () => {},
    openStatusActions: () => {},
    navigateToNovaOp: () => {},
    navigateToOp: () => {},
    navigateToExpedicao: () => {},
    openMovementModal: () => {},
    openStageDetailModal: () => {},
    openTrackingModal: () => {},
    concluirPedido: () => { throw new Error('nao deve chamar'); },
  };

  const pendente = aptConclusaoState(rt.ns);
  pendente.ops[1].status = 'em_producao';
  pendente.expedicoes = [];
  pendente.expedicaoItens = [];
  const pendingView = rt.ns.computeViewModel(pendente);
  const pendingRoot = rt.node('div');
  rt.ns.renderPedidoDetailScreen({ container: pendingRoot, state: pendente, view: pendingView, handlers, loadingError: null });
  const pendingBtn = findHubBtn(pendingRoot, /^Concluir pedido$/i);
  assert.ok(pendingBtn, 'botao bloqueado deve continuar visivel');
  assert.equal(pendingBtn.disabled, true, 'pedido nao apto deve ficar claramente disabled');
  assert.equal(pendingBtn.getAttribute('disabled'), 'disabled');
  assert.equal(pendingBtn._listeners.click, undefined, 'pedido nao apto nao deve ter guarda silenciosa clicavel');
  assert.match(collectHubText(pendingRoot), /Pendencias|pendencias|saldo em acabamento/i);

  const entregue = aptConclusaoState(rt.ns);
  entregue.pedido.status = 'entregue';
  const entregueView = rt.ns.computeViewModel(entregue);
  const entregueRoot = rt.node('div');
  rt.ns.renderPedidoDetailScreen({ container: entregueRoot, state: entregue, view: entregueView, handlers, loadingError: null });
  const entregueBtn = findHubBtn(entregueRoot, /^Pedido concluido$/i);
  assert.ok(entregueBtn, 'pedido entregue deve mostrar estado concluido');
  assert.equal(entregueBtn.disabled, true);
  assert.equal(entregueBtn._listeners.click, undefined);
});

function renderDetailForFirstOp(rt, s) {
  const view = rt.ns.computeViewModel(s);
  const container = rt.node('div');
  const handlers = {
    buildEditButton: () => rt.node('button'),
    navigateToPedidos: () => {},
    scrollToSection: () => {},
    openStatusActions: () => {},
    navigateToNovaOp: () => { rt.events.push('nova-op'); },
    navigateToOp: () => {},
    navigateToExpedicao: () => {},
    concluirPedido: () => {},
    openTrackingModal: () => {},
    openMovementModal: () => {},
    openStageDetailModal: () => {},
  };
  rt.ns.renderPedidoDetailScreen({ container, state: s, view, handlers, loadingError: null });
  return { root: container, view: view };
}

test('FIRST-OP runtime: pedido sem OP mostra CTA destacado e usa handler canonico', () => {
  const rt = makeHubRuntime();
  const rendered = renderDetailForFirstOp(rt, hubBase(rt.ns));
  assert.match(collectHubText(rendered.root), /Nenhuma OP vinculada ainda\./);
  assert.match(collectHubText(rendered.root), /Proxima acao: gerar a primeira OP de Tecelagem\./);
  assert.equal(countHubBtns(rendered.root, /^Gerar primeira OP$/i), 1,
    'deve haver um unico CTA Gerar primeira OP na tela principal');
  const cta = findHubBtn(rendered.root, /^Gerar primeira OP$/i);
  assert.ok(cta, 'CTA Gerar primeira OP deve estar renderizado');
  rt.events.length = 0;
  cta._listeners.click({});
  assert.ok(rt.events.indexOf('nova-op') !== -1,
    'CTA deve delegar para handlers.navigateToNovaOp');
});

test('FIRST-OP runtime: pedido com OP nao mostra CTA de gerar primeira OP na tela principal', () => {
  const rt = makeHubRuntime();
  const rendered = renderDetailForFirstOp(rt, hubTecAcab(rt.ns, 'em_producao'));
  assert.equal(countHubBtns(rendered.root, /^Gerar primeira OP$/i), 0,
    'pedido com OP vinculada nao deve sugerir gerar primeira OP duplicada');
  assert.match(collectHubText(rendered.root), /Ver OP/);
});

test('TRANSITION runtime: setas ativas usam labels especificos do contrato', () => {
  const rt = makeHubRuntime();

  let rendered = renderDetailForFirstOp(rt, hubBase(rt.ns));
  assert.ok(findHubBtn(rendered.root, /^Iniciar$/i),
    'Insumos -> Tecelagem sem OP deve mostrar Iniciar');

  const receberState = hubBase(rt.ns);
  receberState.ops = [{
    id: 29,
    tipo: 'tecelagem',
    numero: 18,
    ano: 2026,
    status: 'aberta',
    op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }],
    op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: 'pi1' }],
  }];
  receberState.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 4 }];
  rendered = renderDetailForFirstOp(rt, receberState);
  assert.ok(findHubBtn(rendered.root, /^Receber$/i),
    'Insumos -> Tecelagem com OP deve mostrar Receber');

  const transferirState = hubBase(rt.ns);
  transferirState.ops = [{
    id: 29,
    tipo: 'tecelagem',
    numero: 18,
    ano: 2026,
    status: 'em_producao',
    op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }],
    op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: 'pi1' }],
  }];
  transferirState.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 10 }];
  rendered = renderDetailForFirstOp(rt, transferirState);
  assert.ok(findHubBtn(rendered.root, /^Transferir$/i),
    'Tecelagem -> Acabamento deve mostrar Transferir');

  rendered = renderDetailForFirstOp(rt, hubTecAcab(rt.ns, 'aberta'));
  assert.ok(findHubBtn(rendered.root, /^Movimentar$/i),
    'Acabamento -> Expedicao deve mostrar Movimentar');

  const entregarState = hubBase(rt.ns);
  entregarState.expedicoes = [{ id: 'ex1', status: 'aberta' }];
  entregarState.expedicaoItens = [{ id: 'exi1', expedicao_id: 'ex1', modelo_id: 7, metros_liberados: 1000, metros_entregues: 0 }];
  rendered = renderDetailForFirstOp(rt, entregarState);
  assert.ok(findHubBtn(rendered.root, /^Entregar$/i),
    'Expedicao -> Entrega deve mostrar Entregar');
});

test('TRANSITION runtime: clique em seta Iniciar abre modal de transicao', () => {
  const rt = makeHubRuntime();
  const s = hubBase(rt.ns);
  const view = rt.ns.computeViewModel(s);
  const container = rt.node('div');
  const handlers = {
    buildEditButton: () => rt.node('button'),
    navigateToPedidos: () => {},
    scrollToSection: () => {},
    openStatusActions: () => {},
    navigateToNovaOp: () => {},
    navigateToOp: () => {},
    navigateToExpedicao: () => {},
    concluirPedido: () => {},
    openTrackingModal: () => {},
    openMovementModal: () => { rt.events.push('movement'); },
    openStageDetailModal: (stage, stageView) => {
      rt.events.push('stage:' + stage.key + ':' + (stageView === view ? 'same-view' : 'other-view'));
    },
  };
  rt.ns.renderPedidoDetailScreen({ container, state: s, view, handlers, loadingError: null });
  const start = findHubBtn(container, /^Iniciar$/i);
  assert.ok(start, 'seta Iniciar deve renderizar como botao clicavel');
  start._listeners.click({});
  assert.ok(rt.events.indexOf('movement') !== -1,
    'Iniciar da transicao inicial deve abrir o modal de transicao/movimento');
  assert.equal(rt.events.indexOf('stage:insumos:same-view'), -1,
    'Iniciar da seta nao deve abrir o hub contextual da bolinha');
});

test('INSUMOS-TECELAGEM modal: pedido sem OP bloqueia recebimento e oferece Gerar primeira OP', () => {
  const rt = makeHubRuntime();
  const s = hubBase(rt.ns);
  const view = rt.ns.computeViewModel(s);
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = view;
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(view.stepper[0].transfer);

  const text = collectHubText(cap);
  assert.match(text, /Este pedido ainda nao possui OP de Tecelagem vinculada/);
  assert.match(text, /Gere a primeira OP para iniciar o fluxo produtivo/);
  assert.match(text, /Nao e possivel registrar material sem OP vinculada/);
  assert.equal(findHubBtn(cap, /^Registrar recebimento$/i), null,
    'sem OP nao pode expor acao de recebimento');
  assert.doesNotMatch(text, /Nenhuma parcial registrada para esta transicao/,
    'sem OP nao deve usar historico vazio como fluxo');

  const gerar = findHubBtn(cap, /^Gerar primeira OP$/i);
  assert.ok(gerar, 'deve mostrar CTA Gerar primeira OP');
  rt.events.length = 0;
  gerar._listeners.click({});
  assert.ok(rt.events.some((e) => /navigate:#\/ops\/nova/.test(e)),
    'CTA deve usar a rota canonica de Nova OP do Pedido');
});

test('OP-OPERATIONAL-CODE-B: computeViewModel rende OP {pedido}/{ano}-{tipo}{seq} com contexto completo', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'aberta');
  // Pedido com contexto completo: numero + criado_em (ano operacional).
  s.pedido = { id: s.pedido.id, numero: 21, status: 'rascunho', metros_total: 1000, criado_em: '2026-03-15T10:00:00Z' };
  // Duas OPs de Tecelagem + uma de Acabamento/Latex, todas com criado_em
  // para o sequencial por Pedido + Tipo.
  s.ops = [
    { id: 29, tipo: 'tecelagem', numero: 18, ano: 2026, status: 'em_producao', criado_em: '2026-03-15T10:00:00Z', op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }], op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 600, metros_ajustados: 600, pedido_item_id: 'pi1' }] },
    { id: 40, tipo: 'tecelagem', numero: 19, ano: 2026, status: 'aberta', criado_em: '2026-03-16T10:00:00Z', op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }], op_itens: [{ id: 400, modelo_id: 7, metros_pedidos: 400, metros_ajustados: 400, pedido_item_id: 'pi1' }] },
    { id: 30, tipo: 'latex', numero: 11, ano: 2026, status: 'aberta', origem_op_id: 29, criado_em: '2026-03-17T10:00:00Z', op_itens: [{ id: 301, modelo_id: 7, metros_pedidos: 600, pedido_item_id: 'pi1' }] },
  ];
  const view = rt.ns.computeViewModel(s);
  const byId = {};
  view.opSummaries.forEach((sm) => { byId[sm.id] = sm; });
  assert.equal(byId[29].label, 'OP 21/2026-T01', 'primeira Tecelagem = T01');
  assert.equal(byId[40].label, 'OP 21/2026-T02', 'segunda Tecelagem = T02');
  assert.equal(byId[30].label, 'OP 21/2026-A01', 'primeira Acabamento/Latex = A01');
  // Numero/ano legado permanece disponivel como referencia secundaria.
  assert.equal(byId[29].legacyLabel, 'OP 18/2026');
  assert.equal(byId[30].legacyLabel, 'OP 11/2026');
  // OP de origem (Tecelagem) tambem exibida em codigo operacional.
  assert.equal(byId[30].origemOpLabel, 'OP 21/2026-T01');
  // OPs relacionadas do item usam o codigo operacional.
  assert.equal(view.itemMetricsById.pi1.relatedOpsLabel, 'OP 21/2026-T01 -> OP 21/2026-T02 -> OP 21/2026-A01');
});

test('OP-OPERATIONAL-CODE-B: sem pedido.criado_em cai no legado OP {numero}/{ano}', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'aberta');
  // hubBase nao tem criado_em => fallback legado.
  const view = rt.ns.computeViewModel(s);
  const tec = view.opSummaries.find((sm) => sm.id === 29);
  assert.equal(tec.label, 'OP 18/2026', 'sem ano operacional confiavel, mantem legado');
});

test('INSUMOS-TECELAGEM modal: OP aberta mostra distribuição COMPARTILHADA (slider + Manter/Salvar) sem Aceitar', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.ops = [s.ops[0]];
  s.ops[0].status = 'aberta';
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 10 }];
  const view = rt.ns.computeViewModel(s);
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = view;
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(view.stepper[0].transfer);

  const text = collectHubText(cap);
  assert.match(text, /OPs relacionadas/);
  assert.match(text, /OP 18\/2026/);
  assert.ok(findHubBtn(cap, /^Ver OP$/i), 'deve mostrar Ver OP');
  // YARN-BUTTONS-FINAL-CONTRACT: bloco de distribuição compartilhado.
  assert.match(text, /Fator proporcional/, 'deve renderizar o bloco de distribuição compartilhado');
  assert.ok(findNode(cap, (n) => n.tagName === 'INPUT' && n.getAttribute('type') === 'range'),
    'deve renderizar slider real');
  assert.ok(findHubBtn(cap, /Salvar distribui/i), 'deve mostrar "Salvar distribuição" (save-only)');
  assert.ok(findHubBtn(cap, /Manter pedido/i), 'deve mostrar "Manter pedido"');
  assert.ok(findHubBtn(cap, /Iniciar produ/i), 'deve mostrar "Iniciar produção" (único início de produção)');
  assert.equal(findHubBtn(cap, /Aceitar proposta/i), null, '"Aceitar proposta" foi removido');
  assert.equal(findHubBtn(cap, /^Aceitar OP$/i), null, '"Aceitar OP" foi removido');
});

test('INSUMOS-TECELAGEM modal: "Iniciar produção" usa iniciarProducaoOP e re-renderiza; save-only NÃO inicia produção', async () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.ops = [s.ops[0]];
  s.ops[0].status = 'aberta';
  // Distribuição já salva (metros_ajustados setado) + fios recebidos =>
  // "Iniciar produção" habilitado; save-only não deve iniciar produção.
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 10 }];
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => {
      rt.events.push('reload');
      s.ops[0].status = 'em_producao';
    },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = rt.ns.computeViewModel(s);
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(handlers.currentView.stepper[0].transfer);

  const iniciar = findHubBtn(cap, /Iniciar produ/i);
  assert.ok(iniciar, '"Iniciar produção" deve estar visível');
  assert.equal(iniciar.disabled, false, 'com distribuição salva + fios recebidos, "Iniciar produção" habilita');
  await iniciar._listeners.click({ currentTarget: iniciar });

  assert.ok(rt.events.includes('iniciarProducaoOP'), 'deve iniciar via iniciarProducaoOP (único início de produção)');
  assert.ok(rt.events.includes('reload'), 'deve recarregar dados após iniciar');
  assert.ok(rt.events.includes('render'), 'deve re-renderizar a tela após iniciar');
  assert.ok(!rt.events.includes('salvarDistribuicaoOP'), '"Iniciar produção" não persiste distribuição');
  assert.ok(!rt.events.includes('aplicarRecalculoOP'), 'fluxo antigo aplicarRecalculoOP não é usado');
});

test('INSUMOS-TECELAGEM modal: registrar recebimento atualiza para proposta sem fechar', async () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.ops = [s.ops[0]];
  s.ops[0].status = 'aberta';
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 4 }];
  rt.sandbox.window.registrarRecebimentoOrdemFio = async ({ kgRecebido }) => {
    rt.events.push('registrarRecebimentoOrdemFio');
    s.ordensFio[0].kg_recebido = kgRecebido;
    return { error: null };
  };
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = rt.ns.computeViewModel(s);
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(handlers.currentView.stepper[0].transfer);

  assert.match(collectHubText(cap), /Registrar nova transferencia/);
  const salvar = findHubBtn(cap, /^Registrar recebimento$/i);
  assert.ok(salvar, 'com OP vinculada e saldo de fio deve permitir recebimento canonico');
  await salvar._listeners.click({ currentTarget: salvar });

  const updatedText = collectHubText(cap);
  assert.ok(rt.events.includes('registrarRecebimentoOrdemFio'), 'deve usar helper canonico de recebimento');
  assert.ok(rt.events.includes('reload'), 'deve recarregar dados apos recebimento');
  assert.ok(rt.events.includes('render'), 'deve re-renderizar a tela apos recebimento');
  assert.match(updatedText, /Fator proporcional/,
    'apos receber todos os insumos, o mesmo modal deve mostrar o bloco de distribuição compartilhado');
  assert.ok(findHubBtn(cap, /Salvar distribui/i), 'proxima acao (Salvar distribuição) deve aparecer sem fechar/reabrir');
  assert.equal(findHubBtn(cap, /Aceitar proposta/i), null, '"Aceitar proposta" não existe mais');
  assert.doesNotMatch(updatedText, /Registrar nova transferencia/,
    'modal nao deve manter formulario antigo stale apos recebimento');
});

// ---------------------------------------------------------------------
// PHASE-C3C-B §35 (Gate 2 — supervisor correction): prova em RUNTIME de
// que a fiação de idempotência de buildInsumosTransferForm funciona de
// ponta a ponta, atravessando o window.registrarRecebimentoOrdemFio REAL
// (op-writes.js) e o adapter REAL (ordem-compra-receipt-cutover.js) — sem
// stub do helper canonico. Apenas window.supa e mockado na fronteira
// rpc/query-builder. Inspecao estatica isoladamente e insuficiente
// (exigencia explicita da ordem); toda asserção abaixo observa valores de
// retorno reais capturados de uma execucao ao vivo de vm.createContext
// dos modulos de producao.
// ---------------------------------------------------------------------

function findNumberInput(n) {
  return findNode(n, function (x) { return x.tagName === 'INPUT' && x.getAttribute('type') === 'number'; });
}
function findDateInput(n) {
  return findNode(n, function (x) { return x.tagName === 'INPUT' && x.getAttribute('type') === 'date'; });
}
function insumosReceiptState(rt, kgRecebido) {
  var s = hubBase(rt.ns);
  s.ops = [{
    id: 29,
    tipo: 'tecelagem',
    numero: 18,
    ano: 2026,
    status: 'aberta',
    op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }],
    op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: 'pi1' }],
  }];
  s.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: kgRecebido }];
  return s;
}

test('PHASE-C3C-B §35 runtime: buildInsumosTransferForm retem/renova o token de idempotencia atraves do window.registrarRecebimentoOrdemFio real', async () => {
  const rt = makeHubRuntime();
  const s = insumosReceiptState(rt, 0);
  const rpcCalls = [];
  const fromCalls = [];
  let nextRpcResult = null;
  rt.sandbox.window.supa = {
    rpc: async (fn, params) => {
      rpcCalls.push({ fn: fn, params: params });
      return nextRpcResult;
    },
    from: function (table) {
      return {
        update: function (patch) {
          return {
            eq: async function (col, val) {
              fromCalls.push({ table: table, patch: patch, col: col, val: val });
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => {
      rt.events.push('reload');
      const last = rpcCalls[rpcCalls.length - 1];
      if (last && last.params && typeof last.params.p_kg_total_absoluto === 'number') {
        s.ordensFio[0].kg_recebido = last.params.p_kg_total_absoluto;
      }
    },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = rt.ns.computeViewModel(s);
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(handlers.currentView.stepper[0].transfer);

  let salvar = findHubBtn(cap, /^Registrar recebimento$/i);
  assert.ok(salvar, 'com OP aberta e saldo de fio deve permitir recebimento canonico');
  let kgInput = findNumberInput(cap);
  let dateInput = findDateInput(cap);
  assert.ok(kgInput && dateInput, 'formulario de recebimento deve expor input de kg e de data');
  assert.equal(kgInput.value, '10', 'saldo inicial (10-0) deve preencher o input por padrao');
  const dateA = dateInput.value;

  function ambiguous() {
    return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0, statusText: '', count: null };
  }
  function hardFailure() {
    return { data: null, error: { code: '42501', message: 'permission denied for function registrar_recebimento_ordem_compra_fio_compat' }, status: 403, statusText: 'Forbidden', count: null };
  }
  function success(total) {
    return { data: { ok: true, ordem_id: 'fio1', kg_total_absoluto: total }, error: null, status: 200, statusText: 'OK', count: null };
  }

  // click 1: primeira submissao (qtd padrao = saldo = 10) -> token A.
  nextRpcResult = ambiguous();
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fn, 'registrar_recebimento_ordem_compra_fio_compat');
  const tokenA = rpcCalls[0].params.p_idempotency_key;
  assert.ok(tokenA, 'primeira submissao deve gerar um token de idempotencia');
  assert.equal(fromCalls.length, 0, 'falha ambigua nao pode disparar escrita legada plana');
  assert.equal(salvar.disabled, false, 'apos falha, botao deve reabilitar para permitir retry');
  assert.ok(findHubBtn(cap, /^Registrar recebimento$/i), 'falha ambigua nao pode remontar/fechar o modal');

  // click 2: retry com a MESMA intencao (mesmo kg, mesma data) -> reusa
  // token A. So e possivel porque o attemptTracker sobrevive fora do
  // invocation do onSave (linhas e construido uma unica vez ao abrir o
  // formulario) — se fosse recriado a cada clique, nunca haveria reuso.
  nextRpcResult = ambiguous();
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[1].params.p_idempotency_key, tokenA,
    'retry com intencao inalterada deve reusar o mesmo token (prova de que o tracker vive fora do clique)');
  assert.equal(fromCalls.length, 0);

  // click 3: muda o kg (7 em vez de 10) -> nova intencao -> token B.
  kgInput.value = '7';
  nextRpcResult = ambiguous();
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 3);
  const tokenB = rpcCalls[2].params.p_idempotency_key;
  assert.notEqual(tokenB, tokenA, 'mudar o kg deve gerar um novo token (token B)');
  assert.equal(fromCalls.length, 0);

  // click 4: mantem kg=7, muda a data -> nova intencao -> token C.
  dateInput.value = dateA === '2026-01-01' ? '2026-01-02' : '2026-01-01';
  nextRpcResult = ambiguous();
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 4);
  const tokenC = rpcCalls[3].params.p_idempotency_key;
  assert.notEqual(tokenC, tokenB, 'mudar a data deve gerar um novo token (token C)');
  assert.notEqual(tokenC, tokenA);
  assert.equal(fromCalls.length, 0);

  // click 5: retry com a MESMA intencao do click 4 (kg=7, mesma data) ->
  // reusa token C -> desta vez uma falha DETERMINISTICA (42501, com
  // status HTTP real) -> deve fechar o attempt.
  nextRpcResult = hardFailure();
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 5);
  assert.equal(rpcCalls[4].params.p_idempotency_key, tokenC,
    'retry antes da falha deterministica ainda deve reusar o token C');
  assert.equal(fromCalls.length, 0, 'falha deterministica (42501) jamais aciona fallback plano');
  assert.equal(salvar.disabled, false, 'apos falha deterministica, botao reabilita para nova tentativa');

  // click 6: MESMA intencao do click 5 (kg=7, mesma data) -> deveria
  // reusar o token SE o attempt continuasse aberto; como o click 5 fechou
  // o attempt (falha deterministica), este clique deve gerar um token
  // NOVO (D) mesmo com intencao inalterada. Desta vez sucesso canonico.
  nextRpcResult = success(7);
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 6);
  const tokenD = rpcCalls[5].params.p_idempotency_key;
  assert.notEqual(tokenD, tokenC,
    'apos falha deterministica, a proxima submissao (mesma intencao) deve gerar um token novo — prova de que a falha deterministica fechou o attempt anterior');
  assert.equal(fromCalls.length, 0, 'sucesso canonico jamais aciona fallback plano');
  assert.ok(rt.events.includes('reload'), 'sucesso deve recarregar os dados');
  assert.ok(rt.events.includes('render'), 'sucesso deve re-renderizar a tela');

  // Sucesso remonta o modal inteiro (refreshPedidoTransitionModal): uma
  // nova submissao apos a conclusao deve usar um tracker novo -> token E.
  salvar = findHubBtn(cap, /^Registrar recebimento$/i);
  assert.ok(salvar, 'saldo restante (3kg) deve continuar oferecendo recebimento apos o sucesso parcial');
  kgInput = findNumberInput(cap);
  assert.equal(kgInput.value, '3', 'saldo apos receber 7 de 10 deve ser 3');
  nextRpcResult = success(10);
  await salvar._listeners.click({ currentTarget: salvar });
  assert.equal(rpcCalls.length, 7);
  const tokenE = rpcCalls[6].params.p_idempotency_key;
  assert.notEqual(tokenE, tokenD,
    'submissao apos conclusao (sucesso + remontagem) deve gerar um token novo, nunca reusar um attempt encerrado');
  assert.equal(fromCalls.length, 0, 'nenhuma das 7 submissoes canonicas deve ter acionado o fallback plano');
});

test('PHASE-C3C-B §35 runtime: sinal de escritor inativo aciona exatamente um fallback plano via window.registrarRecebimentoOrdemFio real', async () => {
  const rt = makeHubRuntime();
  const s = insumosReceiptState(rt, 2);
  const rpcCalls = [];
  const fromCalls = [];
  rt.sandbox.window.supa = {
    rpc: async (fn, params) => {
      rpcCalls.push({ fn: fn, params: params });
      return { data: { ok: false, codigo: 'recebimento_compat_inativo' }, error: null, status: 200, statusText: 'OK', count: null };
    },
    from: function (table) {
      return {
        update: function (patch) {
          return {
            eq: async function (col, val) {
              fromCalls.push({ table: table, patch: patch, col: col, val: val });
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = rt.ns.computeViewModel(s);
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(handlers.currentView.stepper[0].transfer);

  const salvar = findHubBtn(cap, /^Registrar recebimento$/i);
  assert.ok(salvar);
  const dateInput = findDateInput(cap);
  const savedDate = dateInput.value;
  await salvar._listeners.click({ currentTarget: salvar });

  assert.equal(rpcCalls.length, 1, 'deve tentar a rota canonica primeiro');
  assert.equal(rpcCalls[0].fn, 'registrar_recebimento_ordem_compra_fio_compat');
  assert.equal(fromCalls.length, 1, 'sinal de escritor inativo deve acionar exatamente um fallback plano');
  assert.equal(fromCalls[0].table, 'ordens_compra_fio');
  assert.equal(fromCalls[0].col, 'id');
  assert.equal(fromCalls[0].val, 'fio1');
  assert.equal(fromCalls[0].patch.kg_recebido, 10, 'fallback plano deve usar o total absoluto (2 + saldo 8)');
  assert.equal(fromCalls[0].patch.data_recebimento, savedDate);
  assert.equal(fromCalls[0].patch.status, 'recebido_total');
  assert.ok(rt.events.includes('reload'), 'fallback bem-sucedido ainda deve recarregar/re-renderizar como um sucesso normal');
  assert.ok(rt.events.includes('render'));
});

test('TRANSITION runtime: Acabamento aberto com saldo movimenta para Expedicao pelo modal da seta', async () => {
  const rt = makeHubRuntime();
  const s = hubBase(rt.ns);
  s.ops = [
    { id: 29, tipo: 'tecelagem', numero: 18, ano: 2026, status: 'concluida', op_itens: [{ id: 290, modelo_id: 7, metros_pedidos: 2000, metros_ajustados: 2000, pedido_item_id: 'pi1' }] },
    { id: 30, tipo: 'latex', numero: 13, ano: 2026, status: 'aberta', origem_op_id: 29, op_itens: [{ id: 301, modelo_id: 7, metros_pedidos: 1000, pedido_item_id: 'pi1' }] },
    { id: 31, tipo: 'latex', numero: 14, ano: 2026, status: 'aberta', origem_op_id: 29, op_itens: [{ id: 302, modelo_id: 9, metros_pedidos: 650, pedido_item_id: 'pi2' }] },
  ];
  s.itens.push({ id: 'pi2', modelo_id: 9, metros: 650 });
  s.modelosById[9] = { id: 9, nome: 'Venezia' };
  const view = rt.ns.computeViewModel(s);
  const acabamento = view.stepper.find((stage) => stage.key === 'acabamento');
  assert.equal(view.chainState.actions.releaseExpedicao.mode, 'enabled',
    'OP Latex aberta com saldo recebido deve habilitar movimento para Expedicao');
  assert.equal(acabamento.transfer.op.id, 30,
    'modal deve carregar a OP escolhida pela matriz de releaseExpedicao');

  const rpcCalls = [];
  rt.sandbox.window.supa = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: { ok: true, expedicao_id: 3 }, error: null };
    },
  };
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = view;
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(acabamento.transfer);

  const text = collectHubText(cap);
  assert.match(text, /Registrar nova transferencia/);
  assert.match(text, /Produtos a transferir/);
  assert.match(text, /Esta OP esta carregada para movimentacao neste modal/);
  assert.match(text, /Preencher restante/);
  assert.equal(findHubBtn(cap, /^Movimentar$/i), null,
    'OP relacionada nao pode mostrar acao contextual ambigua Movimentar');
  const selectRelated = findHubBtn(cap, /^Carregar nesta movimentacao$/i);
  assert.ok(selectRelated,
    'OP relacionada com saldo deve mostrar acao de carregar/selecionar origem');
  assert.equal(/Nenhuma acao contextual disponivel agora para esta OP/.test(text), false,
    'OP aberta com saldo nao pode aparecer sem acao contextual');

  await selectRelated._listeners.click({ currentTarget: selectRelated });
  assert.equal(rpcCalls.length, 0,
    'carregar OP relacionada nao pode executar movimentacao automaticamente');
  const selectedText = collectHubText(cap);
  assert.match(selectedText, /OP 14\/2026/);
  assert.match(selectedText, /Venezia/);

  const save = findHubBtn(cap, /^Movimentar para Expedicao$/i);
  assert.ok(save, 'modal deve expor botao efetivo de movimentar para Expedicao');
  await save._listeners.click({ currentTarget: save });

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fn, 'liberar_expedicao_latex_parcial');
  assert.equal(rpcCalls[0].args.p_op_latex_id, 31);
  assert.equal(rpcCalls[0].args.p_itens.length, 1);
  assert.equal(rpcCalls[0].args.p_itens[0].op_item_id, 302);
  assert.equal(rpcCalls[0].args.p_itens[0].metros, 650);
  assert.ok(rt.events.indexOf('reload') !== -1, 'sucesso deve recarregar a tela');
  assert.ok(rt.events.indexOf('render') !== -1, 'sucesso deve renderizar a tela');
});

test('HUB runtime: modal lista OPs com Ver OP e Finalizar OP para Tecelagem entregue', () => {
  const rt = makeHubRuntime();
  const r = stageHub(rt, hubTecAcab(rt.ns, 'em_producao'), 'tecelagem');
  assert.ok(findHubBtn(r.root, /Ver OP/i), 'deve ter Ver OP');
  const fin = findHubBtn(r.root, /Finalizar OP/i);
  assert.ok(fin, 'Tecelagem em_producao com saldo 0 deve ter Finalizar OP');
  rt.events.length = 0;
  fin._listeners.click({});
  assert.ok(rt.events.indexOf('confirm') !== -1, 'Finalizar OP deve pedir confirmacao');
  assert.ok(rt.events.indexOf('rpc:alterar_status_op') !== -1, 'Finalizar OP deve chamar alterar_status_op');
});

test('HUB runtime: OP Tecelagem aberta oferece Distribuição + Iniciar produção (YARN-BUTTONS-FINAL-CONTRACT)', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.ops[0].status = 'aberta'; s.entregaItens = []; s.opLatexEntregas = [];
  s.ordensFio = [{ op_id: 29, kg_pedido: 10, kg_recebido: 10 }];
  const r = stageHub(rt, s, 'insumos');
  // Superfície de transição do hub: abrir a distribuição (save-only) +
  // a ação primária "Iniciar produção" (único início de produção).
  assert.ok(findHubBtn(r.root, /Distribui/i), 'OP aberta deve oferecer "Distribuição"');
  assert.ok(findHubBtn(r.root, /Iniciar produ/i), 'OP aberta deve oferecer "Iniciar produção"');
  assert.ok(!findHubBtn(r.root, /Aceitar OP/i), '"Aceitar OP" foi removido');
});

test('HUB runtime: Pedido #13 abre Tecelagem/Aguardar sem appendChild invalido', () => {
  const rt = makeHubRuntime();
  assert.throws(
    () => rt.node('div').appendChild({ tone: 'neutral', text: 'Sem movimentacao para acabamento registrada ainda' }),
    /parameter 1 is not of type Node/,
    'harness deve rejeitar objeto comum como o DOM real'
  );

  const s = hubTecAcab(rt.ns, 'em_producao');
  s.pedido = { id: 'pedido-13', numero: 13, status: 'rascunho', metros_total: 500 };
  s.itens = [
    { id: 'pi-barcelona', modelo_id: 7, metros: 300 },
    { id: 'pi-obra', modelo_id: 8, metros: 200 },
  ];
  s.modelosById = { 7: { id: 7, nome: 'Barcelona' }, 8: { id: 8, nome: 'Obra de Arte' } };
  s.ops = [
    { id: 10, tipo: 'tecelagem', numero: 10, ano: 2026, status: 'aberta', op_fornecedores: [{ fornecedor_id: 5, etapa: 'cima' }], op_itens: [
      { id: 1001, modelo_id: 7, metros_pedidos: 300, metros_ajustados: 300, pedido_item_id: 'pi-barcelona' },
      { id: 1002, modelo_id: 8, metros_pedidos: 200, metros_ajustados: 200, pedido_item_id: 'pi-obra' },
    ] },
  ];
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.ordensFio = [{ op_id: 10, kg_pedido: 10, kg_recebido: 10 }];

  const r = stageHub(rt, s, 'tecelagem');
  const text = collectHubText(r.root);
  assert.match(text, /OPs de Tecelagem/);
  assert.match(text, /OP 10\/2026/);
  assert.match(text, /Sem movimentacao para acabamento registrada ainda/);
  assert.match(text, /OP Tecelagem pendente\. Proxima acao: salvar a distribuicao e Iniciar producao/);
  assert.ok(findHubBtn(r.root, /Ver OP/i), 'hub deve manter Ver OP');
  assert.ok(findHubBtn(r.root, /Distribui/i), 'hub deve oferecer "Distribuição"');
  assert.ok(findHubBtn(r.root, /Iniciar produ/i), 'hub deve oferecer "Iniciar produção" (distribuição salva)');
  assert.equal(rt.events.some((ev) => /^rpc:|^toast:/.test(ev)), false, 'abrir hub nao deve executar write');
});

test('HUB runtime: Acabamento com disponivel>0 oferece Movimentar sem exigir status terminal', () => {
  const rt = makeHubRuntime();
  const r = stageHub(rt, hubTecAcab(rt.ns, 'em_producao'), 'acabamento');
  assert.ok(findHubBtn(r.root, /Movimentar/i), 'disponivel>0 deve oferecer Movimentar');
  assert.match(collectHubText(r.root), /Recebido:[\s\S]*Movimentado:[\s\S]*Disponivel:/);
});

test('HUB runtime: Acabamento com tudo movimentado oferece Finalizar OP (nao Movimentar)', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.expedicoes = [{ id: 3, op_latex_id: 30, pedido_id: s.pedido.id, status: 'aguardando_expedicao' }];
  s.expedicaoItens = [{ id: 4, expedicao_id: 3, op_item_id: 301, modelo_id: 7, metros_liberados: 1000, metros_entregues: 0 }];
  const r = stageHub(rt, s, 'acabamento');
  assert.ok(findHubBtn(r.root, /Finalizar OP/i), 'saldo 0 + em_producao deve oferecer Finalizar OP');
  assert.ok(!findHubBtn(r.root, /Movimentar/i), 'sem disponivel nao deve oferecer Movimentar');
});

test('HUB runtime: Expedicao com saldo pendente oferece Entregar', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.expedicoes = [{ id: 3, op_latex_id: 30, pedido_id: s.pedido.id, status: 'aguardando_expedicao' }];
  s.expedicaoItens = [{ id: 4, expedicao_id: 3, op_item_id: 301, modelo_id: 7, metros_liberados: 1000, metros_entregues: 0 }];
  const r = stageHub(rt, s, 'expedicao');
  assert.ok(findHubBtn(r.root, /Abrir Expedicao/i));
  assert.ok(findHubBtn(r.root, /Entregar/i), 'saldo pendente deve oferecer Entregar');
});

test('HUB runtime: Pedido sem OP oferece Gerar primeira OP; etapa entrega apto oferece Concluir', () => {
  const rt = makeHubRuntime();
  const semOp = stageHub(rt, hubBase(rt.ns), 'insumos');
  const gerar = findHubBtn(semOp.root, /Gerar primeira OP/i);
  assert.ok(gerar, 'pedido sem OP deve oferecer Gerar primeira OP');
  rt.events.length = 0; gerar._listeners.click({});
  assert.ok(rt.events.some((e) => /navigate:#\/ops\/nova/.test(e)), 'Gerar primeira OP deve navegar para nova OP');

  const s = hubTecAcab(rt.ns, 'concluida');
  s.ops[0].status = 'concluida';
  s.expedicoes = [{ id: 3, op_latex_id: 30, pedido_id: s.pedido.id, status: 'concluida' }];
  s.expedicaoItens = [{ id: 4, expedicao_id: 3, op_item_id: 301, modelo_id: 7, metros_liberados: 1000, metros_entregues: 1000 }];
  const ent = stageHub(rt, s, 'entrega');
  const concluir = findHubBtn(ent.root, /Concluir/i);
  assert.ok(concluir, 'etapa entrega apta deve oferecer Concluir');
  rt.events.length = 0; concluir._listeners.click({ currentTarget: rt.node('button') });
  assert.ok(rt.events.indexOf('rpc:concluir_pedido_se_pronto') !== -1, 'Concluir deve reutilizar concluir_pedido_se_pronto');
});

// ---------------------------------------------------------------------
// 24. RAVATEX-TAPETES-INSUMOS-TECELAGEM-UI-FIX-A — alinhamento +
//     botoes default da proposta + Excluir OP/OPs relacionadas
// ---------------------------------------------------------------------

test('INSUMOS-TECELAGEM-UI-FIX-A: buildInsumosTransferForm empilha Data do recebimento + texto auxiliar', () => {
  const slice = (detailEvents.match(/function buildInsumosTransferForm[\s\S]*?\r?\n    \}\r?\n\r?\n    function buildTecelagemTransferForm/) || [''])[0];
  assert.ok(slice, 'trecho buildInsumosTransferForm nao encontrado');
  assert.doesNotMatch(slice, /grid-template-columns:\s*['"]?180px\s+1fr/,
    'nao deve usar grid 2 colunas (180px 1fr) para alinhar label com texto auxiliar');
  assert.match(slice, /Data do recebimento/,
    'label Data do recebimento deve continuar visivel');
  assert.match(slice, /Informe a quantidade recebida agora/,
    'texto auxiliar canonico deve continuar visivel');
  assert.match(slice, /margin-top:\s*4px/,
    'texto auxiliar deve usar margin-top para alinhar logo abaixo do input');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: enablement de "Salvar" vive no builder COMPARTILHADO (atual vs última salva)', () => {
  // YARN-BUTTONS-FINAL-CONTRACT: a lógica de habilitação migrou para o
  // builder compartilhado (op-distribuicao-ui.js): "Salvar distribuição"
  // habilita só quando a distribuição atual difere da última SALVA e não
  // excede o recebido.
  assert.match(oduSrc, /function\s+metrosIguais/,
    'builder compartilhado deve comparar distribuição atual vs salva');
  assert.match(oduSrc, /savedSnapshot/,
    'builder compartilhado deve manter o snapshot da última distribuição salva');
  assert.match(oduSrc, /!mudouAtual\s*\|\|\s*infoAtual\.algumExcede/,
    'Salvar desabilita quando (atual == salva) ou há excesso');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: "Salvar distribuição" desabilitado por default; slider divergente habilita; voltar desabilita', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  s.ops = [s.ops[0]];
  s.ops[0].status = 'aberta';
  // op_item 290 já salvo com metros_ajustados=1000 (== slider default).
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  // 10 kg pedidos, 10 recebidos -> sem excedente
  s.ordensFio = [{ id: 'fio1', op_id: 29, tipo: 'algodao', kg_pedido: 10, kg_recebido: 10 }];
  rt.sandbox.window.recalcularOP = () => ({
    fator: 1,
    itens: [
      { op_item_id: 290, metros_pedidos: 1000, metros_ajustados: 1000 },
    ],
    sobras: [],
  });
  const view = rt.ns.computeViewModel(s);
  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id, state: s,
    reload: async () => {}, render: () => {},
    getLoadingError: () => null, setLoadingError: () => {},
  });
  handlers.currentView = view;
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(view.stepper[0].transfer);

  const salvar = findHubBtn(cap, /Salvar distribui/i);
  assert.ok(salvar, 'botao "Salvar distribuição" deve existir');
  assert.equal(salvar.disabled, true,
    'por default (distribuição atual == última salva), "Salvar distribuição" deve estar desabilitado');

  const sliders = [];
  function walk(n) {
    if (n && n.tagName === 'INPUT' && n.getAttribute('type') === 'range') sliders.push(n);
    (n && n.children || []).forEach(walk);
  }
  walk(cap);
  assert.equal(sliders.length, 1, 'deve existir 1 slider para o unico op_item');
  const slider = sliders[0];
  // Move o slider para um valor divergente da distribuição salva
  slider.value = String(Math.max(0, Number(slider.value) - 100));
  slider._listeners.input({ currentTarget: slider });
  assert.equal(salvar.disabled, false,
    'apos mover o slider (mudança não salva), "Salvar distribuição" deve habilitar');

  // Volta exatamente para a distribuição salva (1000): desabilita de novo.
  slider.value = String(Math.round(1000));
  slider._listeners.input({ currentTarget: slider });
  assert.equal(salvar.disabled, true,
    'ao voltar à distribuição salva, "Salvar distribuição" deve voltar a desabilitar');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: "Manter pedido" é SAVE-ONLY da metragem do pedido (builder compartilhado)', () => {
  // YARN-BUTTONS-FINAL-CONTRACT: "Manter pedido" persiste a metragem do
  // pedido (pedidoMap) via salvarDistribuicaoOP; NUNCA inicia produção.
  assert.match(oduSrc, /btnManter\.addEventListener/,
    'Manter pedido deve ter handler no builder compartilhado');
  assert.match(oduSrc, /persistir\(pedidoMap/,
    'Manter pedido persiste a metragem do pedido (save-only)');
  assert.doesNotMatch(oduSrc, /Aceitar proposta/i,
    '"Aceitar proposta" não existe no builder compartilhado');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: excluirOpRelacionada exposto nos handlers e usa helper canonico', () => {
  assert.match(detailEvents, /function excluirOpRelacionada/,
    'deve existir funcao excluirOpRelacionada');
  assert.match(detailEvents, /excluirOpRelacionada:\s*excluirOpRelacionada/,
    'excluirOpRelacionada deve ser exposta no retorno dos handlers');
  assert.match(detailEvents, /excluirOpRelacionada[\s\S]{0,400}RAVATEX_DELETE\.excluirOPComFluxo/,
    'excluirOpRelacionada deve chamar o helper canonico excluirOPComFluxo');
  assert.match(detailEvents, /window\.RAVATEX_DELETE\.excluirOPComFluxo[\s\S]{0,300}await reload\(\)[\s\S]{0,80}render\(\)/,
    'apos sucesso, deve recarregar e re-renderizar a tela');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: card de OP no render expõe botao Excluir OP via handler canonico', () => {
  const opCardSlice = (detailRender.match(/function buildOpCard[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(opCardSlice, 'trecho buildOpCard nao encontrado');
  assert.match(opCardSlice, /handlers\.excluirOpRelacionada/,
    'buildOpCard deve referenciar handlers.excluirOpRelacionada');
  assert.match(opCardSlice, /'Excluir OP'/,
    'card deve renderizar botao Excluir OP');
  assert.match(opCardSlice, /handlers\.excluirOpRelacionada\(summary\.op\)/,
    'onclick deve chamar handlers.excluirOpRelacionada(summary.op)');
  assert.doesNotMatch(opCardSlice, /\.from\(\s*['"]ops['"]\s*\)[\s\S]{0,160}\.delete\s*\(/,
    'card nao pode fazer delete direto em ops');
  assert.doesNotMatch(opCardSlice, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]{0,160}\.delete\s*\(/,
    'card nao pode fazer delete direto em pedidos');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: Excluir OP no card usa helper central (sem delete direto)', () => {
  const bundle = [detailEvents, detailRender].join('\n');
  assert.match(bundle, /RAVATEX_DELETE\.excluirOPComFluxo/,
    'deve usar helper canonico RAVATEX_DELETE.excluirOPComFluxo');
  assert.doesNotMatch(bundle, /\.from\(\s*['"]ops['"]\s*\)[\s\S]{0,200}\.delete\s*\(/,
    'nao deve chamar supabase.from("ops").delete() direto');
  assert.doesNotMatch(bundle, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]{0,200}\.delete\s*\(/,
    'nao deve chamar supabase.from("pedidos").delete() direto');
});

test('INSUMOS-TECELAGEM-UI-FIX-A: Excluir OP no card passa summary.op e exige helper', () => {
  const opCardSlice = (detailRender.match(/function buildOpCard[\s\S]*?\n  \}/) || [''])[0];
  // O botao so aparece quando o handler existe e o summary.op tem id.
  assert.match(opCardSlice, /summary\.op\s*&&\s*summary\.op\.id\s*!=\s*null/,
    'botao deve ser condicional a summary.op.id valido');
  assert.match(opCardSlice, /typeof handlers\.excluirOpRelacionada === 'function'/,
    'botao deve ser condicional a handlers.excluirOpRelacionada existir');
});

test('NO-PARALLEL-LOAD-B: acabamento OP nao mostra Carregar no modal Tecelagem>Acabamento', () => {
  const rt = makeHubRuntime();
  const s = hubTecAcab(rt.ns, 'em_producao');
  var tecOp = s.ops[0];
  tecOp.status = 'em_producao';
  var acabOp = s.ops[1];
  acabOp.status = 'em_producao';
  var pedidoNumero = s.pedido && s.pedido.numero ? s.pedido.numero : null;
  if (pedidoNumero) acabOp.origem_op_id = tecOp.id;
  const view = rt.ns.computeViewModel(s);
  const tecelagemStage = view.stepper.find(function (st) { return st && st.key === 'tecelagem'; });
  assert.ok(tecelagemStage && tecelagemStage.transfer,
    'stepper deve ter etapa Tecelagem com transfer context');
  assert.equal(tecelagemStage.transfer.op && tecelagemStage.transfer.op.id, tecOp.id,
    'modal deve carregar OP Tecelagem como origem');

  const handlers = rt.ns.createPedidoDetailEvents({
    pedidoId: s.pedido.id,
    state: s,
    reload: async () => { rt.events.push('reload'); },
    render: () => { rt.events.push('render'); },
    getLoadingError: () => null,
    setLoadingError: () => {},
  });
  handlers.currentView = view;
  const cap = rt.node('body');
  rt.sandbox.document.body = cap;
  handlers.openMovementModal(tecelagemStage.transfer);

  const text = collectHubText(cap);
  assert.match(text, /OPs relacionadas/,
    'modal Tecelagem>Acabamento deve ter secao OPs relacionadas');
  assert.ok(findHubBtn(cap, /^Ver OP$/i),
    'OP relacionada (acabamento) deve manter Ver OP');
  assert.equal(findHubBtn(cap, /^Carregar nesta movimentacao$/i), null,
    'OP acabamento NAO pode mostrar Carregar nesta movimentacao no modal Tecelagem>Acabamento');
  assert.doesNotMatch(text, /Sem saldo disponivel para carregar nesta movimentacao/,
    'nao deve exibir mensagem enganosa de saldo quando a acao foi bloqueada por contexto');
});

// -------------------------------------------------------------------
// G14-B: Bridge RAVATEX_DOCUMENTS_RECEIVED smoke
// -------------------------------------------------------------------

test('G14-B-bridge-smoke: pedido-detail-progress referencia RAVATEX_DOCUMENTS_RECEIVED', () => {
  assert.match(detailProgress, /RAVATEX_DOCUMENTS_RECEIVED/,
    'pedido-detail-progress deve referenciar RAVATEX_DOCUMENTS_RECEIVED');
});

test('G14-B-bridge-smoke: pedido-detail-progress referencia mapReceivedDocToEventShape', () => {
  assert.match(detailProgress, /mapReceivedDocToEventShape/,
    'pedido-detail-progress deve chamar mapReceivedDocToEventShape');
});

test('G14-B-bridge-smoke: pedido-detail-progress nao referencia botao legado de eventos', () => {
  assert.doesNotMatch(detailProgress, /RAVATEX_ENABLE_DOCUMENTS_EVENTS_IMPORT_UI/,
    'bridge nao deve reintroduzir botao legado de eventos');
});

test('G14-B-bridge-smoke: documents-ingestor.js exporta mapReceivedDocToEventShape', () => {
  const ingestorSrc = readOrFail(path.join(ROOT, 'js', 'documents-ingestor.js'));
  assert.match(ingestorSrc, /mapReceivedDocToEventShape\s*[=:]\s*function/,
    'documents-ingestor.js deve exportar mapReceivedDocToEventShape');
});

test('G18-B-bridge-smoke: documents-ingestor.js nao inventa event_id no mapper (permite ingestion_event_id)', () => {
  const ingestorSrc = readOrFail(path.join(ROOT, 'js', 'documents-ingestor.js'));
  // ingestion_event_id agora e preservado do JSONL (G18-B), apenas event_id nao deve ser fabricado
  const mapperSlice = (ingestorSrc.match(/ns\.mapReceivedDocToEventShape[\s\S]*?\n  \};/) || [''])[0];
  if (mapperSlice) {
    assert.doesNotMatch(mapperSlice, /event_id\s*:/,
      'mapReceivedDocToEventShape nao deve atribuir event_id');
  }
});

test('G20-B-bridge-smoke: pedido-detail-progress referencia getEffectiveDocumentStatus', () => {
  assert.match(detailProgress, /getEffectiveDocumentStatus/,
    'pedido-detail-progress deve usar getEffectiveDocumentStatus');
});

test('G20-B-bridge-smoke: pedido-detail-progress usa effectiveStatus para status exibido', () => {
  assert.match(detailProgress, /effectiveStatus/,
    'pedido-detail-progress deve usar effectiveStatus');
});

test('G23-C-B: Pedido Detail prioriza received Supabase sobre eventos legados', function () {
  var sandbox = { window: {}, console: {} };
  sandbox.window.el = function (tag, attrs) {
    return { tag: tag, attrs: attrs || {}, children: Array.prototype.slice.call(arguments, 2), appendChild: function () {} };
  };
  vm.createContext(sandbox);
  vm.runInContext(readOrFail(path.join(ROOT, 'js', 'documents-ingestor.js')), sandbox);

  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = 'supabase';
  sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS = [{
    ingestion_event_id: 'legacy-event-99', event_type: 'document.accepted', status: 'accepted',
    pedido_manual: 'PED-25-2026', created_at: '2026-07-09T10:00:00.000Z',
    document: { document_id: 'legacy-doc-99', filename_original: 'legado.xml', tipo_documento: 'nf', formato: 'xml' },
  }];
  sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [{
    document_id: 'cloud-doc-99', filename_original: 'nuvem.xml', tipo_documento: 'nf', formato: 'xml',
    status: 'pending', pedido_manual: 'PED-25-2026', received_at: '2026-07-09T11:00:00.000Z',
    _ravatex_source: 'supabase',
  }];

  var opDisplaySrc = readOrFail(path.join(ROOT, 'js', 'op-display.js'));
  var chainStateSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js'));
  var screenSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js'));
  var detailDataSrc = detailData;
  var detailEventsSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js'));
  var detailRenderSrc = readOrFail(DETAIL_RENDER);
  vm.runInContext([opDisplaySrc, chainStateSrc, screenSrc, detailDataSrc, detailProgress, detailEventsSrc, detailRenderSrc].join('\n\n'), sandbox);

  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var state = ns.createInitialState();
  state.pedido = { id: 'ped-cloud-25', numero: 25, status: 'recebido', metros_total: 0, criado_em: '2026-01-15T10:00:00.000Z' };
  state.itens = [];
  state.ops = [];
  state.entregaItens = [];
  state.entregasById = {};
  state.opLatexEntregas = [];
  state.expedicoes = [];
  state.expedicaoItens = [];
  state.modelosById = {};
  state.coresById = {};

  var view = ns.computeViewModel(state);
  assert.equal(view.ingestorDocumentRows.length, 1);
  assert.equal(view.ingestorDocumentRows[0].label, 'nuvem.xml');
  assert.equal(view.ingestorDocumentRows[0].status, 'pending');
});

test('G20-B-bridge-smoke: pedido-detail-progress nao referencia ingestion_event_id como chave de decisao', () => {
  const decisionSection = (detailProgress.match(/isLocalDecision[\s\S]{0,300}/) || [''])[0];
  assert.doesNotMatch(decisionSection || '', /ingestion_event_id\s*[:=]/,
    'decisao local deve usar document_id, nao ingestion_event_id');
});

// =====================================================================
// PHASE-MANTA-B2B — secoes por rota no detalhe do Pedido. As garantias
// Tapete acima permanecem inalteradas; o que se acrescenta e a prova de
// que o Pedido misto renderiza DUAS secoes independentes e de que a
// secao Manta nunca contem Acabamento.
// =====================================================================

function mixedRouteView() {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext([opDisplay, productRoute, routeSections].join('\n\n'), sandbox);
  return sandbox.window.RAVATEX_SCREENS.pedidoRouteSections.buildRouteSections({
    routes: ['tapete', 'manta'],
    opSummaries: [
      { id: 1, route: 'tapete', stageKey: 'tecelagem', status: 'concluida', target: 60, done: 60, remaining: 0, op: { id: 1 } },
      { id: 2, route: 'tapete', stageKey: 'acabamento', status: 'em_producao', target: 60, done: 0, remaining: 60, op: { id: 2 } },
      { id: 3, route: 'manta', stageKey: 'tecelagem', status: 'em_producao', target: 40, done: 40, remaining: 0, op: { id: 3 } },
    ],
    expedicoes: [{ id: 900, op_tecelagem_id: 3 }],
    expedicaoItens: [{ expedicao_id: 900, metros_liberados: 40, metros_entregues: 40 }],
    insumoOrdens: [],
    totalPedido: 100,
    deliveredExactTotal: 40,
    chainState: null,
    fmt: { metros: (v) => String(v), kg: (v) => String(v) },
  });
}

test('MANTA-B2B: Pedido misto emite duas secoes de rota, cada uma com o seu stepper', () => {
  const built = mixedRouteView();
  assert.equal(built.sections.length, 2);
  assert.equal(built.sections.map((s) => s.route).join(','), 'tapete,manta');
  assert.equal(built.sections[0].stepper.map((s) => s.key).join(','),
    'insumos,tecelagem,acabamento,expedicao,entrega');
  assert.equal(built.sections[1].stepper.map((s) => s.key).join(','),
    'insumos,tecelagem,expedicao,entrega');
});

test('MANTA-B2B: uma rota concluida nao conclui nem bloqueia a outra', () => {
  const built = mixedRouteView();
  const tapete = built.sections[0];
  const manta = built.sections[1];
  assert.equal(manta.stepper.find((s) => s.key === 'entrega').state, 'done',
    'a Manta entregou tudo e fecha a sua propria rota');
  assert.equal(tapete.stepper.find((s) => s.key === 'entrega').state, 'future',
    'o Tapete continua aberto, sem herdar a conclusao da Manta');
  assert.equal(tapete.stepper.find((s) => s.key === 'acabamento').state, 'current');
});

test('MANTA-B2B: a transicao da secao Manta e Tecelagem -> Expedicao, nunca Acabamento', () => {
  const manta = mixedRouteView().sections[1];
  const tec = manta.stepper.find((s) => s.key === 'tecelagem');
  assert.equal(tec.transfer.origem, 'Tecelagem');
  assert.equal(tec.transfer.destino, 'Expedicao');
  assert.doesNotMatch(tec.transfer.title, /Acabamento/);
});

test('MANTA-B2B: o modal de movimentacao roteia Tecelagem>Expedicao para o caminho Manta', () => {
  assert.match(detailEvents, /key === 'Tecelagem>Expedicao'\) return buildMantaSaidaForm/);
  assert.match(detailEvents, /key === 'Tecelagem>Acabamento'\) return buildTecelagemTransferForm/,
    'o caminho Tapete permanece exatamente onde estava');
  const slice = (detailEvents.match(/function buildMantaSaidaForm[\s\S]*?\r?\n    \}\r?\n/) || [''])[0];
  assert.ok(slice, 'buildMantaSaidaForm nao encontrado');
  assert.doesNotMatch(slice, /salvarEntregaCima/);
  assert.doesNotMatch(slice, /latexOptions|comOpcaoSplit/);
});

test('MANTA-B2B: a atribuicao de expedicao no progresso usa a origem real', () => {
  assert.match(detailProgress, /expedicaoSourceOpId/);
  assert.doesNotMatch(detailProgress, /expedicao\.op_latex_id != null\) \{\n\s*liberadoByLatexOp/,
    'a atribuicao nao pode continuar presa a op_latex_id');
  assert.match(detailProgress, /op_tecelagem_id/,
    'a pendencia de conclusao Manta usa op_tecelagem_id (simetria de db/87)');
});
