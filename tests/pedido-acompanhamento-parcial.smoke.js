const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'pedido-tracking-ui.js');

function readOrFail(target) {
  assert.ok(fs.existsSync(target), 'arquivo nao encontrado: ' + target);
  return fs.readFileSync(target, 'utf8');
}

function loadApi() {
  const source = readOrFail(FILE);
  const sandbox = { window: { RAVATEX_PEDIDO_UI: {} }, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/pedido-tracking-ui.js' });
  return sandbox.window.RavatexPedidoTracking;
}

const source = readOrFail(FILE);

test('pedido-acompanhamento-parcial: arquivo existe', () => {
  assert.ok(fs.existsSync(FILE));
});

test('pedido-acompanhamento-parcial: sintaxe JS valida', () => {
  require('node:child_process').execFileSync(
    process.execPath,
    ['--check', FILE],
    { stdio: 'pipe' }
  );
});

test('pedido-acompanhamento-parcial: expoe helper buildPedidoAcompanhamentoParcial', () => {
  const api = loadApi();
  assert.equal(typeof api.buildPedidoAcompanhamentoParcial, 'function');
  assert.equal(typeof api.getClienteParcialSituacao, 'function');
  assert.ok(Array.isArray(api.CLIENTE_TRACKING_STEPS));
  assert.ok(Array.isArray(api.CLIENTE_TRACKING_EXCECOES));
  assert.equal(typeof api.getClienteTrackingStep, 'function');
  assert.equal(typeof api.getClienteTrackingException, 'function');
  assert.equal(typeof api.getClienteTrackingStatusLabel, 'function');
  assert.equal(typeof api.getClienteTrackingMensagem, 'function');
  assert.equal(typeof api.getClienteTrackingProgress, 'function');
});

test('pedido-acompanhamento-parcial: pedido sem parciais preserva modo total e fallback seguro', () => {
  const api = loadApi();
  const dto = api.buildPedidoAcompanhamentoParcial(
    {
      id: 'p1',
      numero: 101,
      status_cliente_visual: 'acabamento',
      status_cliente_mensagem: 'Mensagem publicada.',
      metros_total: 1500,
      parcial_habilitado: false,
    },
    [{ metros: 500 }, { metros: 1000 }],
    [],
    { forCliente: true }
  );

  assert.equal(dto.statusModo, 'total');
  assert.equal(dto.parcialHabilitado, false);
  assert.equal(dto.statusVisual, 'acabamento');
  assert.equal(dto.metrosTotal, 1500);
  assert.equal(dto.mensagemCliente, 'Mensagem publicada.');
  assert.equal(dto.distribuicao.length, 0);
  assert.equal(dto.parciais.length, 0);
  assert.equal(dto.steps.find((step) => step.key === 'acabamento').state, 'atual');
});

test('pedido-acompanhamento-parcial: 2 parciais gera distribuicao e stepper corretos', () => {
  const api = loadApi();
  const dto = api.buildPedidoAcompanhamentoParcial(
    {
      id: 'p2',
      numero: 102,
      metros_total: 1000,
      parcial_habilitado: true,
      status_cliente_visual: 'acabamento',
    },
    [{ metros: 1000 }],
    [
      { id: 'a', sequencia: 1, situacao: 'em_tecelagem', metros: 400, visivel_cliente: true },
      { id: 'b', sequencia: 2, situacao: 'entregue', metros: 200, visivel_cliente: true },
    ],
    { forCliente: true }
  );

  assert.equal(dto.statusModo, 'parcial');
  assert.equal(dto.statusVisual, 'concluido');
  assert.equal(dto.distribuicao.length, 2);
  assert.deepEqual(
    Array.from(dto.distribuicao, (item) => item.situacao),
    ['em_tecelagem', 'entregue']
  );
  assert.equal(dto.distribuicao[0].percentual, 40);
  assert.equal(dto.distribuicao[1].percentual, 20);
  assert.equal(dto.steps.find((step) => step.key === 'tecelagem').state, 'parcial');
  assert.equal(dto.steps.find((step) => step.key === 'concluido').state, 'parcial');
  assert.equal(dto.totais.entregue, 200);
  assert.equal(dto.totais.pendente, 800);
});

test('pedido-acompanhamento-parcial: 6 parciais agrupa situacoes repetidas e nao passa de 100%', () => {
  const api = loadApi();
  const dto = api.buildPedidoAcompanhamentoParcial(
    {
      id: 'p3',
      numero: 103,
      parcial_habilitado: true,
      metros_total: 1500,
    },
    [{ metros: 1500 }],
    [
      { id: 'a', sequencia: 1, situacao: 'em_tecelagem', metros: 100, visivel_cliente: true },
      { id: 'b', sequencia: 2, situacao: 'em_tecelagem', metros: 150, visivel_cliente: true },
      { id: 'c', sequencia: 3, situacao: 'em_acabamento', metros: 300, visivel_cliente: true },
      { id: 'd', sequencia: 4, situacao: 'pronto_envio', metros: 250, visivel_cliente: true },
      { id: 'e', sequencia: 5, situacao: 'em_transporte', metros: 200, visivel_cliente: true },
      { id: 'f', sequencia: 6, situacao: 'entregue', metros: 400, visivel_cliente: true },
    ],
    { forCliente: true }
  );

  assert.equal(dto.statusModo, 'parcial');
  assert.equal(dto.parciais.length, 6);
  assert.equal(dto.distribuicao.length, 5);
  assert.equal(dto.distribuicao.find((item) => item.situacao === 'em_tecelagem').metros, 250);
  assert.equal(dto.distribuicao.find((item) => item.situacao === 'entregue').percentual, 26.67);
  assert.equal(dto.steps.find((step) => step.key === 'expedicao').metros, 250);
  assert.equal(dto.steps.find((step) => step.key === 'transporte').metros, 200);
  assert.equal(dto.steps.find((step) => step.key === 'concluido').metros, 400);
  assert.equal(dto.steps.every((step) => step.percentual <= 100), true);
});

test('pedido-acompanhamento-parcial: cliente ignora parcial invisivel e admin mantem leitura completa', () => {
  const api = loadApi();
  const pedido = { id: 'p4', numero: 104, metros_total: 500, parcial_habilitado: true };
  const parciais = [
    { id: 'a', situacao: 'em_tecelagem', metros: 100, visivel_cliente: true },
    { id: 'b', situacao: 'em_acabamento', metros: 150, visivel_cliente: false },
  ];

  const clienteDto = api.buildPedidoAcompanhamentoParcial(pedido, [{ metros: 500 }], parciais, { forCliente: true });
  const adminDto = api.buildPedidoAcompanhamentoParcial(pedido, [{ metros: 500 }], parciais, { forCliente: false });

  assert.equal(clienteDto.parciais.length, 1);
  assert.equal(clienteDto.distribuicao.length, 1);
  assert.equal(clienteDto.totais.parcialVisivel, 100);
  assert.equal(adminDto.parciais.length, 2);
  assert.equal(adminDto.distribuicao.length, 2);
  assert.equal(adminDto.totais.parcialVisivel, 250);
});

test('pedido-acompanhamento-parcial: fallback de metros_total por soma dos itens e percentuais sem NaN', () => {
  const api = loadApi();
  const dto = api.buildPedidoAcompanhamentoParcial(
    {
      id: 'p5',
      numero: 105,
      parcial_habilitado: true,
      metros_total: null,
    },
    [{ metros: 200 }, { metros: 300 }],
    [
      { id: 'a', situacao: 'entregue', metros: 125, visivel_cliente: true },
    ],
    { forCliente: true }
  );

  assert.equal(dto.metrosTotal, 500);
  assert.equal(dto.distribuicao[0].percentual, 25);
  assert.equal(dto.steps.every((step) => Number.isFinite(step.percentual)), true);
  assert.equal(dto.parciais.every((item) => Number.isFinite(item.percentual)), true);
});

test('pedido-acompanhamento-parcial: nao expoe OP, lote, fornecedor, NF, romaneio, custo ou margem', () => {
  assert.equal(/\bOP\b/.test(source), false);
  assert.equal(/\blote\b/i.test(source), false);
  assert.equal(/fornecedor/i.test(source), false);
  assert.equal(/\bNF\b/.test(source), false);
  assert.equal(/romaneio/i.test(source), false);
  assert.equal(/custo/i.test(source), false);
  assert.equal(/margem/i.test(source), false);
});

test('pedido-acompanhamento-parcial: nao chama Supabase nem service_role', () => {
  assert.equal(/window\.supa/.test(source), false);
  assert.equal(/\.from\(/.test(source), false);
  assert.equal(/service_role/i.test(source), false);
});

test('pedido-acompanhamento-parcial: nao faz insert update delete rpc ou functions.invoke', () => {
  assert.equal(/\.insert\(/.test(source), false);
  assert.equal(/\.update\(/.test(source), false);
  assert.equal(/\.delete\(/.test(source), false);
  assert.equal(/\.rpc\(/.test(source), false);
  assert.equal(/functions\.invoke\(/.test(source), false);
});
