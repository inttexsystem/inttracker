// =====================================================================
// === tests/pedido-unified-admin-editor.smoke.js ======================
// Smoke de runtime (vm sandbox + doubles fiéis) para o editor
// administrativo UNIFICADO do Pedido (js/screens/pedido-edit.js).
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
//
// Prova, dentre os 28 itens exigidos pela ordem (secs.17-18):
//   - composição full-width (sem max-width:768px residual);
//   - numero/status somente-leitura;
//   - entrada dupla convergindo no mesmo estado local;
//   - painel de prioridade presente (>=2 itens);
//   - zero chamada de escrita no carregamento;
//   - payload seco: sem mudança nenhuma NÃO chama a RPC;
//   - payload seco: mudança só de cabeçalho manda p_itens/p_prioridade NULL;
//   - trava estrutural após vínculo de produção (Adicionar item bloqueado);
//   - falha na leitura de vínculo TRAVA por segurança (fail closed);
//   - Pedido terminal é somente-leitura, sem ação Salvar;
//   - revisão desatualizada mostra aviso e "Recarregar dados", sem retry
//     automático.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FaithfulNode, createDocument, makeFakeSupa } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const SOURCES = [
  'js/select-popover.js',
  'js/ui.js',
  'js/pedido-ui.js',
  'js/op-display.js',
  'js/product-route.js',
  'js/pedido-priority.js',
  'js/pedido-draft.js',
  'js/pedido-fields.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/pedido-item-modal.js',
  'js/screens/pedido-edit.js',
].map((rel) => [rel, read(rel)]);

// Attribute-aware querySelectorAll — needed because pedido-edit.js reads
// back nodes by data-* attribute (updateItensSummary) exactly like
// pedido-form.js already does in tests/pedido-form.smoke.js.
class EditNode extends FaithfulNode {
  setAttribute(name, value) {
    const coerced = (name === 'style' || typeof value === 'string') ? value : String(value);
    super.setAttribute(name, coerced);
    if (name === 'value') this.value = coerced;
  }

  querySelectorAll(sel) {
    const attr = typeof sel === 'string'
      ? sel.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/)
      : null;
    if (!attr) return super.querySelectorAll(sel);
    const out = [];
    (function walk(node) {
      for (const child of (node.children || [])) {
        if (child && child._attrs) {
          const actual = child._attrs[attr[1]];
          if (actual != null && (attr[2] == null || String(actual) === attr[2])) out.push(child);
        }
        if (child && child.children) walk(child);
      }
    })(this);
    return out;
  }
}

function allByTag(root, tag) {
  const wanted = String(tag).toUpperCase();
  const out = [];
  (function walk(node) {
    if (!node || !node.children) return;
    if (node.tagName === wanted) out.push(node);
    node.children.forEach(walk);
  })(root);
  return out;
}

function allWithAttr(root, attr) {
  const out = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c && c._attrs && Object.prototype.hasOwnProperty.call(c._attrs, attr)) out.push(c);
      if (c && c.children) walk(c);
    }
  })(root);
  return out;
}

function findButtonByText(root, re) {
  return allByTag(root, 'button').find((b) => re.test(b.textContent));
}

function allStyles(root) {
  const out = [];
  (function walk(node) {
    if (node && node._attrs && node._attrs.style) out.push(node._attrs.style);
    (node.children || []).forEach(walk);
  })(root);
  return out.join(' | ');
}

const PID = '11111111-2222-3333-4444-555555555555';

function basePedidoRow(overrides) {
  return Object.assign({
    id: PID, numero: 42, data_pedido: '2026-07-20', status: 'recebido',
    cliente_id: 501, referencia_cliente: null, prazo_entrega: null,
    tipo_recebimento: null, observacao: null, prioridade_status: 'nenhuma',
    revisao: 3,
  }, overrides || {});
}

function baseItens() {
  return [
    { id: 'it-1', modelo_id: 1, metros: '2.00', largura: null, observacao: null, ordem: 0 },
    { id: 'it-2', modelo_id: 2, metros: '3.00', largura: null, observacao: null, ordem: 1 },
  ];
}

function baseModelos() {
  return [
    { id: 1, nome: 'Paris', tipo_produto: 'tapete', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } },
    { id: 2, nome: 'Roma', tipo_produto: 'tapete', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } },
  ];
}

async function bootPedidoEdit(opts) {
  const o = opts || {};
  const document = createDocument();
  const supa = makeFakeSupa({
    tableData: Object.assign({
      pedidos: [basePedidoRow(o.pedido)],
      pedido_itens: o.itens || baseItens(),
      clientes: [{ id: 501, nome: 'Cliente Atlas' }],
      modelos: baseModelos(),
      lotes: [], expedicoes: [], op_itens: [], expedicao_itens: [], ops: [],
    }, o.tableData || {}),
    rpcImpl: o.rpcImpl || {},
  });

  const sandbox = { window: {}, document, console, Node: EditNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = supa;
  sandbox.ADMIN_MENU = [];
  sandbox.shellLayout = (_menu, content) => content;
  sandbox.navigate = (hash) => { sandbox.__navigated = hash; };
  sandbox.requestAnimationFrame = (fn) => fn();
  sandbox.confirmDialog = (o2) => { if (o2 && o2.onConfirm) o2.onConfirm(); };
  vm.createContext(sandbox);
  for (const [rel, src] of SOURCES) vm.runInContext(src, sandbox, { filename: rel });
  sandbox.toast = (msg, tone) => { (sandbox.__toasts = sandbox.__toasts || []).push({ msg, tone }); };

  const root = await vm.runInContext(`window.screenPedidoEditar(${JSON.stringify(PID)})`, sandbox);
  return { sandbox, root, supa };
}

// ---------------------------------------------------------------------
// 1. Composição full-width e read-only de numero/status.
// ---------------------------------------------------------------------

test('pedido-edit: full-width — a antiga moldura max-width:768px não sobrevive', async () => {
  const { root } = await bootPedidoEdit({});
  assert.doesNotMatch(allStyles(root), /max-width:\s*768px/);
});

test('pedido-edit: numero e status são sempre somente-leitura (data-rv-readonly-field)', async () => {
  const { root } = await bootPedidoEdit({});
  const readonlyFields = allWithAttr(root, 'data-rv-readonly-field');
  assert.ok(readonlyFields.length >= 2, 'esperado ao menos 2 campos somente-leitura (numero, status)');
  const texts = readonlyFields.map((n) => n.textContent);
  assert.ok(texts.some((t) => t === '42'), 'numero deve aparecer como valor somente-leitura');
});

test('pedido-edit: zero chamada de escrita ocorre apenas ao carregar a tela', async () => {
  const { supa } = await bootPedidoEdit({});
  const writes = supa._calls.filter((c) => c.op === 'rpc' || c.op === 'insert' || c.op === 'update' || c.op === 'delete');
  assert.deepEqual(writes, [], 'carregar a tela não pode escrever nada');
});

// ---------------------------------------------------------------------
// 2. Entrada dupla + prioridade.
// ---------------------------------------------------------------------

test('pedido-edit: "Adicionar item" e "Adicionar linha" convergem no MESMO estado, e o painel de prioridade aparece (>=2 itens)', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  const addLinha = findButtonByText(root, /^Adicionar linha$/);
  assert.ok(addLinha, '"Adicionar linha" deve existir');
  const before = allWithAttr(root, 'data-pedido-total-itens')[0].textContent;
  assert.equal(before, '2');
  addLinha._listeners.click();
  const after = allWithAttr(root, 'data-pedido-total-itens')[0].textContent;
  assert.equal(after, '3', '"Adicionar linha" deve acrescentar ao MESMO state.itens do modal');
  assert.ok(sandbox.window.RAVATEX_PEDIDO_PRIORITY, 'dono de prioridade deve estar carregado');
  const toggle = allWithAttr(root, 'data-pedido-priority-toggle');
  assert.ok(toggle.length >= 1, 'painel de prioridade deve renderizar com >=2 itens');
});

// ---------------------------------------------------------------------
// 3. Payload seco (dirty sections) — EXECUTION ORDER sec.10.1.
// ---------------------------------------------------------------------

test('pedido-edit: sem NENHUMA alteração, Salvar não chama a RPC e apenas avisa', async () => {
  const { root, supa, sandbox } = await bootPedidoEdit({});
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  assert.ok(saveBtn, 'botão Salvar deve existir para pedido não-terminal');
  await saveBtn._listeners.click();
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 0, 'sem mudanças, salvar_pedido_admin não pode ser chamada');
  assert.ok((sandbox.__toasts || []).some((t) => /Não há alterações/.test(t.msg)));
});

test('pedido-edit: mudar SÓ o cabeçalho manda p_header preenchido e p_itens/p_prioridade NULL', async () => {
  let captured = null;
  const { root, supa } = await bootPedidoEdit({
    rpcImpl: { salvar_pedido_admin: (params) => { captured = params; return { data: { ok: true }, error: null }; } },
  });
  // Acha o campo de Referência do cliente (input de texto livre) e digita.
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  assert.ok(refInputs.length >= 1, 'input de texto (Referência do cliente) deve existir');
  refInputs[0].value = 'PO-123';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  assert.ok(captured, 'salvar_pedido_admin deveria ter sido chamada');
  assert.equal(captured.p_pedido_id, PID);
  assert.equal(captured.p_base_revisao, 3);
  assert.equal(captured.p_itens, null, 'itens inalterados devem viajar como NULL');
  assert.equal(captured.p_prioridade, null, 'prioridade inalterada deve viajar como NULL');
  assert.ok(captured.p_header && Object.keys(captured.p_header).length > 0, 'cabeçalho alterado não pode ser NULL');
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 1, 'exatamente uma chamada de RPC esperada');
});

// ---------------------------------------------------------------------
// 4. Trava estrutural (EXECUTION ORDER sec.9.1) e fail-closed.
// ---------------------------------------------------------------------

test('pedido-edit: OP vinculada trava "Adicionar item" e mostra o aviso, mas Observação de item continua editável', async () => {
  const { root } = await bootPedidoEdit({
    tableData: { op_itens: [{ id: 'oi-1', pedido_item_id: 'it-1' }] },
  });
  const addItem = findButtonByText(root, /Adicionar item/);
  assert.ok(addItem, '"Adicionar item" deve continuar visível (não removido, apenas travado)');
  assert.equal(addItem.getAttribute('disabled'), 'disabled', '"Adicionar item" deve estar desabilitado sob trava estrutural');
  assert.match(root.textContent, /já tem produção vinculada/);
  // Observação (input de texto livre dentro da linha de item) permanece habilitada.
  const obsInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text' && i.getAttribute('maxlength') === '200');
  assert.ok(obsInputs.length >= 1, 'inputs de observação de item devem existir');
  assert.notEqual(obsInputs[0].disabled, true, 'observação do item deve continuar editável sob trava estrutural');
});

test('pedido-edit: falha ao detectar vínculo de produção TRAVA por segurança (fail closed, nunca assume "sem OP")', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  // Simula falha de leitura substituindo from('lotes') para devolver erro.
  const originalFrom = sandbox.supa.from;
  sandbox.supa.from = (t) => {
    if (t === 'lotes') {
      return { select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: null, error: { message: 'RLS negado' } }).then(resolve); } };
    }
    return originalFrom(t);
  };
  const root2 = await vm.runInContext(`window.screenPedidoEditar(${JSON.stringify(PID)})`, sandbox);
  const addItem = findButtonByText(root2, /Adicionar item/);
  assert.equal(addItem.getAttribute('disabled'), 'disabled', 'falha de leitura deve travar os controles estruturais');
  assert.match(root2.textContent, /Não foi possível confirmar/);
});

// ---------------------------------------------------------------------
// 5. Pedido terminal — somente-leitura, sem ação Salvar.
// ---------------------------------------------------------------------

test('pedido-edit: Pedido terminal (entregue) é somente-leitura, sem botão Salvar e sem controles estruturais', async () => {
  const { root } = await bootPedidoEdit({ pedido: { status: 'entregue' } });
  assert.equal(findButtonByText(root, /^Salvar alterações$/), undefined, 'pedido terminal não pode ter ação Salvar');
  assert.equal(findButtonByText(root, /Adicionar item/), undefined, 'pedido terminal não pode oferecer Adicionar item');
  assert.match(root.textContent, /encerrado|terminal/i);
});

// ---------------------------------------------------------------------
// 6. Concorrência — revisão desatualizada.
// ---------------------------------------------------------------------

test('pedido-edit: revisão desatualizada mostra aviso e "Recarregar dados", sem retry automático nem merge', async () => {
  const { root, supa } = await bootPedidoEdit({
    rpcImpl: {
      salvar_pedido_admin: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base 3, atual 4)' } }),
    },
  });
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  refInputs[0].value = 'Mudou';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  assert.match(root.textContent, /mudou desde a abertura do editor/);
  const reloadBtn = findButtonByText(root, /^Recarregar dados$/);
  assert.ok(reloadBtn, 'deve oferecer "Recarregar dados"');
  const rpcCallsAfterFirstFailure = supa._calls.filter((c) => c.op === 'rpc').length;
  assert.equal(rpcCallsAfterFirstFailure, 1, 'não pode haver retry automático da RPC');
  const saveBtnNow = findButtonByText(root, /alterações/);
  assert.equal(saveBtnNow.getAttribute('disabled'), 'disabled', 'Salvar deve ficar desabilitado até recarregar explicitamente');
});
