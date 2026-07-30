const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js/screens/pedido-insumos-distribuicao.js'), 'utf8');
const router = fs.readFileSync(path.join(root, 'js/router.js'), 'utf8');
const orderRender = fs.readFileSync(path.join(root, 'js/screens/ordem-compra-render.js'), 'utf8');
const orderEvents = fs.readFileSync(path.join(root, 'js/screens/ordem-compra-events.js'), 'utf8');
const op = fs.readFileSync(path.join(root, 'js/screens/op-nova.js'), 'utf8');

test('F2 owns purchasing distribution at Pedido / Insumos', () => {
  assert.match(router, /#\\\/pedidos\\\/.+\\\/insumos/);
  assert.match(ui, /screenPedidoInsumosDistribuicao/);
  assert.match(ui, /necessidade_compra_fio/);
  assert.match(ui, /definir_alocacao_necessidade_compra_fio/);
  assert.doesNotMatch(ui, /p_op_id|p_item_id|p_pedido_id/);
});

test('F2 preserves absolute target and replay-safe client command keys', () => {
  assert.match(ui, /Quantidade alvo absoluta/);
  assert.match(ui, /Use zero para remover/);
  assert.match(ui, /commandKey\(\)/);
  assert.match(ui, /Resposta incerta.*mesma chave de comando/);
  assert.match(ui, /idempotencia_conflitante/);
});

test('F2 represents both OP and shared Pedido provenance without an OP selector', () => {
  assert.match(ui, /Pedido compartilhado/);
  assert.match(ui, /proveniência somente leitura/);
  assert.match(ui, /need\.ops/);
  assert.doesNotMatch(ui, /Selecione a OP/);
});

test('order and OP screens no longer own purchasing origination', () => {
  assert.doesNotMatch(orderRender, /oc-nova|oc-add-item/);
  assert.doesNotMatch(orderEvents, /definir_item_ordem_compra|alocar_necessidade_compra_fio|remover_alocacao_compra_fio/);
  assert.match(op, /op-purchase-assignment-readonly/);
  assert.match(op, /op-abrir-distribuicao-pedido/);
});

// =====================================================================
// === EXECUTABLE COVERAGE — distribution quantity prefill =============
// The module is an IIFE over `window`. It is evaluated in a vm realm with a
// minimal fake DOM so the REAL openModal, the REAL validator and the REAL
// RPC payload are exercised, rather than restated by the test.
// =====================================================================

function loadScreen() {
  const rpcCalls = [];
  const notices = [];
  let rpcResult = { data: { ok: true, discriminador: 'created' }, error: null };

  function makeEl(tag, attrs) {
    const node = { tagName: tag, attrs: attrs || {}, children: [] };
    node.appendChild = (child) => { if (child != null) node.children.push(child); return child; };
    node.replaceChildren = (...kids) => { node.children = kids.filter((k) => k != null); };
    if (attrs && Object.prototype.hasOwnProperty.call(attrs, 'value')) node.value = attrs.value;
    return node;
  }

  const win = {
    el(tag, attrs, ...kids) {
      const node = makeEl(tag, attrs);
      kids.forEach((k) => node.appendChild(k));
      return node;
    },
    fmtKg: (n) => (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg'),
    formField: ({ label, input }) => makeEl('field', { label, input }),
    selectInput: ({ value }) => makeEl('select', { value }),
    modal(cfg) { win.__modal = cfg; },
    crypto: { randomUUID: () => 'fixed-command-key' },
    supa: {
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return rpcResult; },
    },
    RAVATEX_OP_DISPLAY: { formatOpOperationalCode: () => 'OP-T001-1-26' },
  };

  vm.runInNewContext(ui, { window: win });
  const api = win.RAVATEX_SCREENS.pedidoInsumosDistribuicao;

  // Opens the real modal and returns its captured configuration plus the live
  // quantity input node, found by walking the body the module actually built.
  function open(need, allocation) {
    const setNotice = (kind, text) => notices.push({ kind, text });
    api.openModal(need, allocation, SUPPLIERS, async () => {}, setNotice);
    const cfg = win.__modal;
    const field = cfg.body.children.find(
      (c) => c && c.attrs && c.attrs.label === 'Quantidade alvo absoluta (kg)',
    );
    assert.ok(field, 'the quantity field must be present in the modal body');
    return { cfg, input: field.attrs.input, notices, rpcCalls };
  }

  return {
    api,
    open,
    notices,
    rpcCalls,
    setRpcResult(next) { rpcResult = next; },
  };
}

const SUPPLIERS = [{ id: 7, nome: 'Fiacao Alfa', tipo: 'fio_algodao' }];

function need(kgNecessario, kgAlocado) {
  return {
    id: 101,
    origem_tipo: 'op',
    material: 'algodao',
    cor_id: 3,
    cores: { nome: 'CRU' },
    kg_necessario: kgNecessario,
    kg_alocado: kgAlocado,
    ops: {},
  };
}

test('1. an untouched need opens the modal already filled with the full quantity', () => {
  const { open } = loadScreen();
  const { input } = open(need('500.000', '0.000'), null);
  assert.equal(input.value, '500');
});

test('2. a partially distributed need opens with only the remaining balance', () => {
  const { api, open } = loadScreen();
  const { input } = open(need('500.000', '180.500'), null);
  assert.equal(input.value, '319.5');
  assert.equal(api.distributableBalance(need('500.000', '180.500'), null), 319.5);
});

test('2b. the balance mirrors the db/74 invariant, including the allocation already held', () => {
  const { api } = loadScreen();
  // v_available := kg_necessario - (kg_alocado - v_previous)
  // Altering an existing 120 kg target may grow up to 500 - (300 - 120) = 320.
  assert.equal(api.distributableBalance(need('500.000', '300.000'), { kg_alocado: '120.000' }), 320);
  // A brand-new allocation on the same need may only take 200.
  assert.equal(api.distributableBalance(need('500.000', '300.000'), null), 200);
});

test('2c. binary-float residue never reaches the field (NUMERIC(12,3) quantisation)', () => {
  const { api, open } = loadScreen();
  // 12.5 - 3.2 === 9.299999999999999 in IEEE-754; the field must read 9.3,
  // otherwise the modal validator and the RPC would both refuse it.
  assert.equal(api.distributableBalance(need('12.5', '3.2'), null), 9.3);
  const { input } = open(need('12.5', '3.2'), null);
  assert.equal(input.value, '9.3');
  assert.match(String(input.value), /^\d+(\.\d{1,3})?$/);
});

test('3. a fully distributed need keeps the existing blocking behaviour', async () => {
  const { open } = loadScreen();
  const { cfg, input, notices } = open(need('500.000', '500.000'), null);
  // Nothing is suggested: zero is a REMOVAL command on this screen.
  assert.equal(input.value, '');
  const select = cfg.body.children.find((c) => c.attrs && c.attrs.label === 'Fornecedor').attrs.input;
  select.value = '7';
  assert.equal(await cfg.onSave(), false);
  assert.equal(notices.at(-1).kind, 'error');
  assert.match(notices.at(-1).text, /Informe fornecedor e quantidade alvo válida/);
});

test('3b. altering an existing allocation still opens with its persisted absolute target', () => {
  const { open } = loadScreen();
  const { input } = open(need('500.000', '300.000'), { kg_alocado: '120.000', item: {} });
  assert.equal(input.value, '120.000');
});

test('4. the suggested value stays editable down to a smaller partial quantity', async () => {
  const { open, rpcCalls } = loadScreen();
  const { cfg, input } = open(need('500.000', '0.000'), null);
  assert.equal(input.value, '500');
  const select = cfg.body.children.find((c) => c.attrs && c.attrs.label === 'Fornecedor').attrs.input;
  select.value = '7';
  input.value = '125.250';
  assert.equal(await cfg.onSave(), true);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'definir_alocacao_necessidade_compra_fio');
  assert.equal(rpcCalls[0].args.p_kg_alocado, 125.25);
  assert.equal(rpcCalls[0].args.p_necessidade_id, 101);
  assert.equal(rpcCalls[0].args.p_fornecedor_id, 7);
});

test('5. zero, negative, malformed and over-precise quantities are still refused', async () => {
  for (const bad of ['-1', '-0.5', 'abc', '', '1,5', '1.2345', ' ', '1e3']) {
    const { open, rpcCalls } = loadScreen();
    const { cfg, input } = open(need('500.000', '0.000'), null);
    const select = cfg.body.children.find((c) => c.attrs && c.attrs.label === 'Fornecedor').attrs.input;
    select.value = '7';
    input.value = bad;
    assert.equal(await cfg.onSave(), false, 'must refuse ' + JSON.stringify(bad));
    assert.equal(rpcCalls.length, 0, 'must not reach the RPC for ' + JSON.stringify(bad));
  }
});

test('5b. zero remains the explicit removal command, never a suggestion', async () => {
  const { open, rpcCalls } = loadScreen();
  const { cfg, input } = open(need('500.000', '200.000'), { kg_alocado: '200.000', item: {} });
  const select = cfg.body.children.find((c) => c.attrs && c.attrs.label === 'Fornecedor').attrs.input;
  select.value = '7';
  input.value = '0';
  assert.equal(await cfg.onSave(), true);
  assert.equal(rpcCalls[0].args.p_kg_alocado, 0);
});

test('5c. an excessive quantity is still refused by the server cap, not by a new client cap', async () => {
  const screen = loadScreen();
  screen.setRpcResult({ data: { ok: false, codigo: 'excede_saldo' }, error: null });
  const { cfg, input } = screen.open(need('500.000', '480.000'), null);
  assert.equal(input.value, '20');
  const select = cfg.body.children.find((c) => c.attrs && c.attrs.label === 'Fornecedor').attrs.input;
  select.value = '7';
  input.value = '900';
  // The client deliberately owns no cap: the request reaches the RPC and the
  // RPC refuses it. The prefill never proposes more than the balance.
  assert.equal(await cfg.onSave(), false);
  assert.equal(screen.rpcCalls[0].args.p_kg_alocado, 900);
  assert.match(screen.notices.at(-1).text, /excede o saldo disponível/);
});

test('6. the field keeps machine decimals and the kg unit; the card keeps pt-BR', () => {
  const { open } = loadScreen();
  const { cfg, input } = open(need('500.000', '180.500'), null);
  assert.equal(input.attrs.type, 'number');
  assert.equal(input.attrs.step, '0.001');
  assert.equal(input.attrs.min, '0');
  // A type=number control only accepts a dot decimal; pt-BR belongs to display.
  assert.doesNotMatch(String(input.value), /,/);
  const label = cfg.body.children.find((c) => c.attrs && c.attrs.input === input).attrs.label;
  assert.equal(label, 'Quantidade alvo absoluta (kg)');
  const hint = cfg.body.children.at(-1);
  assert.match(hint.children.join(''), /restante atual: 319,500 kg/);
});

test('7. reopening recalculates from persisted state and retains no stale local input', () => {
  const { open } = loadScreen();
  const first = open(need('500.000', '0.000'), null);
  assert.equal(first.input.value, '500');
  first.input.value = '42';               // operator types, then abandons the modal
  // Reload persisted 180.5 kg against the need; reopening must reflect only that.
  const second = open(need('500.000', '180.500'), null);
  assert.equal(second.input.value, '319.5');
  assert.notEqual(second.input, first.input);
  // And the same need reopened twice is stable — no accumulation, no memo.
  const third = open(need('500.000', '180.500'), null);
  assert.equal(third.input.value, '319.5');
});
