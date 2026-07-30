// =====================================================================
// === tests/ordem-compra.smoke.js =====================================
// REFUND-B1 (spec §R.22) — render-harness smokes for the dedicated
// native purchase-order administration screens (list + detail).
//
// Uses the shared canonical doubles (tests/_doubles.js, §20): FaithfulNode
// (real boolean-attr semantics), createDocument, makeFakeSupa (single-level
// .rpc envelope). Loads js/ui.js + js/screens/common.js + the five
// ordem-compra screen files into one VM context, then drives the screen
// entry points and inspects the returned DOM tree.
//
// Asserts the R2 boundary in the UI:
//   - list renders native + imported-legacy each once, server-derived;
//   - detail exposes editar/remover/cancelar for a native draft;
//   - the Emitir control is ALWAYS disabled and never wired (§R.22.5/6);
//   - imported-legacy orders are read-only (no actions);
//   - PGRST202 (db/68 absent) degrades to a neutral notice (§R.22.0);
//   - rpcWrite checks res.data.ok (business rejection => error toast).
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { FaithfulNode, createDocument, makeFakeSupa } = require('./_doubles.js');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// js/op-display.js owns the canonical OP/OC identity labels and loads before
// every screen in index.html; the purchase-order screens call it to name an
// order, so the sandbox must carry it too.
const opDisplaySrc = read('js/op-display.js');
const uiSrc = read('js/ui.js');
const commonSrc = read('js/screens/common.js');
const dataSrc = read('js/screens/ordem-compra-data.js');
const distributionSrc = read('js/screens/ordem-compra-distribuicao.js');
const renderSrc = read('js/screens/ordem-compra-render.js');
const eventsSrc = read('js/screens/ordem-compra-events.js');
const listSrc = read('js/screens/ordens-compra-list.js');
const detailSrc = read('js/screens/ordem-compra.js');

function makeSandbox({ rpcImpl = {}, tableData = {} } = {}) {
  const document = createDocument();
  const navCalls = [];
  const sandbox = {
    document,
    setTimeout,
    clearTimeout,
    console,
    location: { hash: '#/ordens-compra' },
    supa: makeFakeSupa({ rpcImpl, tableData }),
    navigate: (h) => navCalls.push(h),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(opDisplaySrc, sandbox, { filename: 'js/op-display.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(dataSrc, sandbox, { filename: 'js/screens/ordem-compra-data.js' });
  vm.runInContext(distributionSrc, sandbox, { filename: 'js/screens/ordem-compra-distribuicao.js' });
  vm.runInContext(renderSrc, sandbox, { filename: 'js/screens/ordem-compra-render.js' });
  vm.runInContext(eventsSrc, sandbox, { filename: 'js/screens/ordem-compra-events.js' });
  vm.runInContext(listSrc, sandbox, { filename: 'js/screens/ordens-compra-list.js' });
  vm.runInContext(detailSrc, sandbox, { filename: 'js/screens/ordem-compra.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = sandbox.navigate; // keep the recorder
  sandbox.window.navigate = sandbox.navigate;
  sandbox.__navCalls = navCalls;
  sandbox.__toasts = document._toastsNode;
  return sandbox;
}

function walk(node, fn) {
  if (!node) return;
  fn(node);
  for (const c of (node.children || [])) walk(c, fn);
}
function findById(node, id) {
  let found = null;
  walk(node, (n) => { if (!found && typeof n.getAttribute === 'function' && n.getAttribute('id') === id) found = n; });
  return found;
}
function findButtons(node) {
  const out = [];
  walk(node, (n) => { if (n.tagName === 'BUTTON') out.push(n); });
  return out;
}
function text(node) {
  let s = '';
  walk(node, (n) => { if (n && n._text != null) s += ' ' + n._text; if (n && n.tagName === 'TEXT') s += ' ' + (n.textContent || ''); });
  // FaithfulNode textContent aggregates; use it directly too
  try { s += ' ' + node.textContent; } catch (e) { /* ignore */ }
  return s;
}
function btnByText(node, re) {
  return findButtons(node).find((b) => re.test(b.textContent || ''));
}

const NATIVE_DRAFT = {
  ordem_id: 100, modelo: 'nativo', pedido_id: 'p1', fornecedor_id: 1, fornecedor_nome: 'Fornecedor A',
  status_administrativo: 'rascunho', status_aceite: 'nao_aplicavel', status_recebimento: 'nao_recebido',
  legado: false, legado_provenance: null, emitida_em: null, itens_total: 1,
  itens: [{ item_id: 10, material: 'algodao', cor_id: 1, cor_poliester: null, cor_nome: 'PRETO', kg_pedido: 100, kg_recebido: 0, alocacoes: 0, kg_alocado: 0 }],
  acoes: { editar_itens: true, remover_itens: true, cancelar: true, emitir: false, receber: false },
  pode_emitir: false, bloqueio_emissao: 'distribuicao_necessidades_pendente',
};
const LEGACY_ORDER = {
  ordem_id: 200, modelo: 'legado', pedido_id: 'p2', fornecedor_id: 2, fornecedor_nome: 'Fornecedor B',
  status_administrativo: 'emitida', status_aceite: 'nao_aplicavel', status_recebimento: 'recebido',
  legado: true, legado_provenance: 'emitido_recebido', emitida_em: '2026-07-01T00:00:00Z', itens_total: 1,
  itens: [{ item_id: 20, material: 'poliester', cor_id: null, cor_poliester: 'BRANCO', cor_nome: null, kg_pedido: 50, kg_recebido: 50, alocacoes: 1, kg_alocado: 50 }],
  acoes: { editar_itens: false, remover_itens: false, cancelar: false, emitir: false, receber: false },
  pode_emitir: false, bloqueio_emissao: null,
};

const COMPLETE_DISTRIBUTION = {
  ok: true,
  ordem: { ordem_id: 100, modelo: 'nativo', pedido_id: 'p1', fornecedor_id: 1, status_administrativo: 'rascunho', legado: false },
  distribuicao_completa: true,
  pronta_para_emissao: true,
  pode_emitir: false,
  bloqueio_emissao: 'recebimento_nativo_ainda_inativo',
  itens: [{
    item_id: 10, material: 'algodao', cor_id: 1, cor_nome: 'PRETO', kg_pedido: 100, kg_alocado: 100, kg_diferenca: 0,
    alocacoes: [{ alocacao_id: 50, necessidade_id: 70, op_id: 80, op_numero: 9, op_ano: 2026, kg_alocado: 100 }],
    necessidades_compativeis: [{ necessidade_id: 70, origem_tipo: 'op', op_id: 80, op_numero: 9, kg_necessario: 100, kg_alocado: 100, kg_restante: 0 }],
    acoes: { alocar: true, editar: true, remover: true },
  }],
};

// Canonical OC identities (db/95), read from public.ordem_compra.
//   100 → the FIRST purchase order of Pedido 001. The primary key is a global
//         BIGSERIAL unrelated to the Pedido, so this row is the regression
//         case: the surface must read OC-001-1-26 and never "#100".
//   200 → a GENUINE legacy order with no Pedido: no identity exists and none
//         may be fabricated, so it keeps the deliberate non-numbered label.
const PEDIDO_1 = '11111111-1111-4111-8111-111111111111';
const OC_IDENTITIES = [
  { id: 100, identidade_operacional: 'OC-001-1-26', identidade_pedido_id: PEDIDO_1, pedido_id: PEDIDO_1 },
  { id: 200, identidade_operacional: null, identidade_pedido_id: null, pedido_id: null },
];
const FORM_REFS = { pedidos: [{ id: 'p1', numero: 120 }], fornecedores: [{ id: 1, nome: 'Fornecedor A', tipo: 'fio_algodao' }], cores: [{ id: 1, nome: 'PRETO' }], ordem_compra: OC_IDENTITIES };

// ---- LIST -----------------------------------------------------------

test('1. lista renderiza ordens nativa + legado (cada uma uma vez), com "Nova ordem" e "Ver ordem"', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { listar_ordens_compra_admin: () => ({ data: { ok: true, ordens: [NATIVE_DRAFT, LEGACY_ORDER] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdensCompra()', sandbox);
  const list = findById(view, 'ordens-compra-list');
  assert.ok(list, 'a tela de lista deve renderizar (#ordens-compra-list)');
  const nova = findById(view, 'oc-nova');
  assert.equal(nova, null, 'F2 removes the manual order creation path');
  if (nova) {
  assert.ok(nova, 'botão "Nova ordem" deve existir');
  assert.equal(nova.disabled, true, 'criação manual permanece desabilitada até F2');
  assert.equal(typeof nova.onclick, 'undefined', 'criação manual não possui handler');
  }
  const t = text(list);
  assert.match(t, /Fornecedor A/, 'ordem nativa listada');
  assert.match(t, /Fornecedor B/, 'ordem legado listada');
  assert.match(t, /Nativa/, 'discriminador de modelo Nativa presente');
  assert.match(t, /Legado/, 'discriminador de modelo Legado presente');
  const verBtns = findButtons(list).filter((b) => /Ver ordem/.test(b.textContent || ''));
  assert.equal(verBtns.length, 2, 'um "Ver ordem" por ordem (2)');
});

test('2. lista degrada com aviso quando db/68 ausente (PGRST202)', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { listar_ordens_compra_admin: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) },
  });
  const view = await vm.runInContext('window.screenOrdensCompra()', sandbox);
  const list = findById(view, 'ordens-compra-list');
  assert.match(text(list), /indispon/i, 'mostra aviso de indisponibilidade em ambiente sem db/68');
});

// ---- DETAIL ---------------------------------------------------------

test('3. detalhe (rascunho nativo): mutações manuais desabilitadas; cancelamento ativo', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: NATIVE_DRAFT, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  const detail = findById(view, 'ordem-compra-detail');
  assert.ok(detail, 'tela de detalhe deve renderizar');
  const add = findById(view, 'oc-add-item');
  assert.equal(add, null, 'F2 removes the manual item creation path');
  if (add) {
  assert.ok(add, 'botão "Adicionar item" permanece visível');
  assert.equal(add.disabled, true, 'Adicionar item permanece desabilitado');
  assert.equal(typeof add.onclick, 'undefined', 'Adicionar item não possui handler');
  assert.ok(findById(view, 'oc-cancelar'), 'botão "Cancelar ordem" (acoes.cancelar)');
  }
  const edit = btnByText(detail, /^Editar$/);
  assert.equal(edit, null, 'F2 removes manual item editing');
  const remove = btnByText(detail, /^Remover$/);
  assert.equal(remove, null, 'F2 removes manual item removal');
  if (edit || remove) {
  assert.ok(edit && edit.disabled === true, 'Editar item permanece desabilitado');
  assert.ok(remove && remove.disabled === true, 'Remover item permanece desabilitado');
  assert.equal(typeof edit.onclick, 'undefined', 'Editar item não possui handler');
  assert.equal(typeof remove.onclick, 'undefined', 'Remover item não possui handler');
  assert.match(text(detail), /PRETO/, 'item exibido (algodão · PRETO)');
  }
});

test('4. detalhe: Emitir desabilitado quando o servidor recusa (acoes.emitir=false) — sem handler, motivo visível (PHASE-C5)', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: NATIVE_DRAFT, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  const emit = findById(view, 'oc-emitir');
  assert.ok(emit, 'botão Emitir deve existir (desabilitado)');
  assert.equal(emit.disabled, true, 'Emitir deve estar disabled pois o servidor devolve acoes.emitir=false');
  // Server-derived disablement (not a static literal): NATIVE_DRAFT carries
  // acoes.emitir=false, so the control is disabled and has NO click handler —
  // it can never call emitir_ordem_compra while the server withholds the action.
  assert.ok(!emit._listeners || !emit._listeners.click, 'Emitir desabilitado NÃO pode ter handler de clique (nunca chama emitir_ordem_compra)');
  const bloq = findById(view, 'oc-bloqueio-emissao');
  assert.ok(bloq && /distribui/i.test(bloq.textContent || ''), 'motivo de bloqueio (distribuição pendente) visível');
});

test('5. detalhe (legado): read-only — sem adicionar/editar/remover/cancelar', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: LEGACY_ORDER, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(200)', sandbox);
  const detail = findById(view, 'ordem-compra-detail');
  assert.ok(!findById(view, 'oc-add-item'), 'legado NÃO tem "Adicionar item"');
  assert.ok(!findById(view, 'oc-cancelar'), 'legado NÃO tem "Cancelar ordem"');
  assert.ok(!btnByText(detail, /^Editar$/), 'legado NÃO tem "Editar" de item');
  assert.ok(!btnByText(detail, /^Remover$/), 'legado NÃO tem "Remover" de item');
  const emit = findById(view, 'oc-emitir');
  assert.equal(emit.disabled, true, 'Emitir desabilitado também no legado (servidor devolve acoes.emitir=false)');
  assert.ok(!emit._listeners || !emit._listeners.click, 'Emitir no legado não possui handler');
  // Legacy orders carry no acceptance badge (native-only, PHASE-C5).
  assert.equal(findById(view, 'oc-status-aceite'), null, 'ordem legado não exibe selo de aceite');
});

test('6. detalhe degrada com aviso quando db/68 ausente (PGRST202)', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  assert.match(text(findById(view, 'ordem-compra-detail')), /indispon/i, 'aviso de indisponibilidade');
});

// ---- rpcWrite envelope (business-rejection fidelity, 275ede2 lesson) --

test('7. rpcWrite: rejeição de negócio (ok:false) => toast de ERRO e retorno null', async () => {
  const sandbox = makeSandbox({
    rpcImpl: { definir_item_ordem_compra: () => ({ data: { ok: false, codigo: 'kg_invalido', erro: 'Quantidade deve ser maior que zero' }, error: null }) },
  });
  const out = await vm.runInContext(
    "window.RAVATEX_SCREENS.ordemCompra.rpcWrite('definir_item_ordem_compra', {}, 'Item definido.')",
    sandbox);
  assert.equal(out, null, 'rejeição de negócio retorna null');
  const toasts = sandbox.__toasts.children;
  assert.equal(toasts.length, 1, 'exatamente 1 toast');
  assert.match(toasts[0].textContent, /maior que zero/i, 'mensagem de erro da RPC');
  assert.match(toasts[0].className, /bg-red-600/, 'toast de erro (não sucesso)');
});

test('8. rpcWrite: transporte com erro (res.error) => toast de ERRO e retorno null', async () => {
  const sandbox = makeSandbox({
    rpcImpl: { cancelar_ordem_compra: () => ({ data: null, error: { message: 'network' } }) },
  });
  const out = await vm.runInContext(
    "window.RAVATEX_SCREENS.ordemCompra.rpcWrite('cancelar_ordem_compra', { p_ordem_id: 1 }, 'ok')",
    sandbox);
  assert.equal(out, null, 'erro de transporte retorna null');
  assert.match(sandbox.__toasts.children[0].className, /bg-red-600/, 'toast de erro');
});

test('9. rpcWrite: sucesso (ok:true) => toast de sucesso e retorno do payload', async () => {
  const sandbox = makeSandbox({
    rpcImpl: { definir_item_ordem_compra: () => ({ data: { ok: true, ordem_compra_id: 5, ordem_compra_item_id: 9 }, error: null }) },
  });
  const out = await vm.runInContext(
    "window.RAVATEX_SCREENS.ordemCompra.rpcWrite('definir_item_ordem_compra', {}, 'Item definido.')",
    sandbox);
  assert.ok(out && out.ordem_compra_id === 5, 'retorna o payload em sucesso');
  assert.match(sandbox.__toasts.children[0].className, /bg-green-600/, 'toast de sucesso');
});

test('10. isMissingFunction reconhece PGRST202 e "could not find the function"', () => {
  const sandbox = makeSandbox({});
  const ns = sandbox.window.RAVATEX_SCREENS.ordemCompra;
  assert.equal(ns.isMissingFunction({ code: 'PGRST202' }), true);
  assert.equal(ns.isMissingFunction({ message: 'Could not find the function public.x' }), true);
  assert.equal(ns.isMissingFunction({ code: '42501', message: 'permission denied' }), false);
  assert.equal(ns.isMissingFunction(null), false);
});

test('11. F1 keeps native distribution read-only while complete emission remains blocked', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: {
      obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: NATIVE_DRAFT, eventos: [] }, error: null }),
      obter_distribuicao_ordem_compra: () => ({ data: COMPLETE_DISTRIBUTION, error: null }),
    },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  const section = findById(view, 'oc-distribuicao');
  assert.equal(section, null, 'F2 removes allocation controls from the purchase-order detail');
  if (section) {
  const distribute = btnByText(section, /^Distribuir$/);
  assert.ok(distribute && distribute.disabled === true, 'create/update control is disabled until F2');
  assert.equal(typeof distribute.onclick, 'undefined', 'create/update control has no handler');
  let allocationRemove = null;
  walk(section, (node) => {
    if (node.getAttribute && node.getAttribute('data-alocacao-id') === '50') {
      allocationRemove = btnByText(node, /^Remover$/);
    }
  });
  assert.ok(allocationRemove && allocationRemove.disabled === true, 'allocation removal is disabled until F2');
  assert.equal(typeof allocationRemove.onclick, 'undefined', 'allocation removal has no handler');
  assert.match(text(section), /somente leitura/i, 'F2 activation boundary is visible');
  assert.match(text(section), /recebimento nativo/i, 'complete distribution retains the Phase-C emission block');
  }
  const emit = findById(view, 'oc-emitir');
  assert.equal(emit.disabled, true, 'emission remains disabled even after complete distribution');
  assert.ok(!emit._listeners || !emit._listeners.click, 'emission remains without a handler');
});

// =====================================================================
// === OC CANONICAL IDENTITY (db/95) — completion of
// === OP-CANONICAL-IDENTITY-REFOUNDATION-R1 ===========================
// Regression: public.ordem_compra.id is a GLOBAL BIGSERIAL, so the first
// purchase order of Pedido 001 could be #100. The screens printed that key
// as the order's name. The business identity is identidade_operacional.
// =====================================================================

const PEDIDO_2 = '22222222-2222-4222-8222-222222222222';

// Two orders of Pedido 001 plus one of Pedido 002 — primary keys deliberately
// out of order and unrelated to either Pedido number.
const MULTI_OC_IDENTITIES = [
  { id: 100, identidade_operacional: 'OC-001-1-26', identidade_pedido_id: PEDIDO_1, pedido_id: PEDIDO_1 },
  { id: 4210, identidade_operacional: 'OC-001-2-26', identidade_pedido_id: PEDIDO_1, pedido_id: PEDIDO_1 },
  { id: 7, identidade_operacional: 'OC-002-1-26', identidade_pedido_id: PEDIDO_2, pedido_id: PEDIDO_2 },
  { id: 200, identidade_operacional: null, identidade_pedido_id: null, pedido_id: null },
];

function ocOrder(over) {
  return Object.assign({}, NATIVE_DRAFT, over);
}

test('OC-ID 1. detail names the order by its canonical identity, never by the primary key', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: NATIVE_DRAFT, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  const t = text(findById(view, 'ordem-compra-detail'));
  assert.match(t, /OC-001-1-26/, 'the canonical identity is the visible name');
  assert.doesNotMatch(t, /#100/, 'the raw BIGSERIAL is never rendered as a business number');
  assert.doesNotMatch(t, /Ordem de compra #/, 'the "#<pk>" heading form is gone');
});

test('OC-ID 2. the list names every row by its canonical identity', async () => {
  const sandbox = makeSandbox({
    tableData: Object.assign({}, FORM_REFS, { ordem_compra: MULTI_OC_IDENTITIES }),
    rpcImpl: {
      listar_ordens_compra_admin: () => ({
        data: { ok: true, ordens: [ocOrder({ ordem_id: 100 }), ocOrder({ ordem_id: 4210 }), ocOrder({ ordem_id: 7 })] },
        error: null,
      }),
    },
  });
  const view = await vm.runInContext('window.screenOrdensCompra()', sandbox);
  const t = text(findById(view, 'ordens-compra-list'));
  // Two orders of the SAME Pedido keep one sequence; a third Pedido has its own.
  assert.match(t, /OC-001-1-26/);
  assert.match(t, /OC-001-2-26/);
  assert.match(t, /OC-002-1-26/);
  assert.doesNotMatch(t, /#100|#4210/, 'no raw primary key reaches the list');
  assert.match(t, /Ordem/, 'the first column is headed by the order, not the model');
});

test('OC-ID 3. a genuine legacy order without Pedido keeps its deliberate non-numbered label', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: LEGACY_ORDER, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(200)', sandbox);
  const t = text(findById(view, 'ordem-compra-detail'));
  assert.match(t, /OC legada \(sem Pedido\)/, 'legacy label is shown');
  assert.doesNotMatch(t, /#200/, 'no primary key is offered as a substitute identity');
  assert.doesNotMatch(t, /OC-\d/, 'no Pedido relationship is fabricated for a legacy order');
});

test('OC-ID 4. an unresolvable identity fails closed, never to the legacy label or the key', async () => {
  // Identity read returns nothing for this id (error, permission, id outside
  // the loaded batch). That is NOT the same as "legacy order without Pedido".
  const sandbox = makeSandbox({
    tableData: Object.assign({}, FORM_REFS, { ordem_compra: [] }),
    rpcImpl: { obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: NATIVE_DRAFT, eventos: [] }, error: null }) },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  const t = text(findById(view, 'ordem-compra-detail'));
  assert.match(t, /OC \(identidade pendente\)/, 'diagnostic state is declared honestly');
  assert.doesNotMatch(t, /OC legada/, 'a failed read must not claim the order has no Pedido');
  assert.doesNotMatch(t, /#100/, 'and must not fall back to the primary key');
});

test('OC-ID 5. the emission confirmation names the order canonically while the RPC still takes the id', async () => {
  const sandbox = makeSandbox({
    tableData: FORM_REFS,
    rpcImpl: {
      obter_ordem_compra_admin: () => ({
        data: { ok: true, eventos: [], ordem: ocOrder({ acoes: Object.assign({}, NATIVE_DRAFT.acoes, { emitir: true }), pode_emitir: true, bloqueio_emissao: null }) },
        error: null,
      }),
    },
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', sandbox);
  findById(view, 'oc-emitir')._listeners.click();
  const overlay = (sandbox.document.body.children || []).filter((n) => !n._removed).pop();
  const t = text(overlay);
  assert.match(t, /Emitir ordem de compra OC-001-1-26/, 'modal title uses the canonical identity');
  assert.match(t, /Emitir a ordem OC-001-1-26/, 'confirmation copy uses it too');
  assert.doesNotMatch(t, /#100/, 'the irreversible confirmation never names the order by its key');
});

// Comments legitimately quote the defect they document ("it used to print
// 'Ordem de compra #' + o.ordem_id"). A comment renders nothing, so the scan
// looks at code only.
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

test('OC-ID 6. static scan: no active OC surface concatenates a primary key into visible text', () => {
  const RAW_PK_AS_NAME = /(['"`])[^'"`]*(?:ordem|OC)[^'"`]*#\s*\1\s*\+\s*\w*[Oo]rdem/;
  for (const rel of [
    'js/screens/ordem-compra-render.js',
    'js/screens/ordem-compra-events.js',
    'js/screens/ordem-compra-receipt-render.js',
    'js/screens/ordem-compra-receipt-events.js',
    'js/screens/ordem-compra-distribuicao.js',
  ]) {
    const src = codeOnly(read(rel));
    assert.doesNotMatch(src, RAW_PK_AS_NAME, rel + ' renders a raw purchase-order key as a business name');
    assert.doesNotMatch(src, /'Ordem de compra #'/, rel + ' still carries the "#<pk>" heading literal');
  }
});

test('OC-ID 7. identity I/O has ONE owner and the screens never re-fetch it themselves', () => {
  const data = read('js/screens/ordem-compra-data.js');
  // Both resolvers share a single batch reader; neither screen opens its own.
  assert.match(data, /async function carregarIdentidades\(/, 'one shared batch resolver');
  assert.match(data, /ns\.carregarIdentidadesOp = /);
  assert.match(data, /ns\.carregarIdentidadesOc = /);
  for (const rel of ['js/screens/ordem-compra-render.js', 'js/screens/ordem-compra-events.js']) {
    assert.doesNotMatch(read(rel), /\.from\(\s*'ordem_compra'\s*\)/, rel + ' must not fetch identity itself');
  }
  // Formatting stays with the central display owner, not the data module.
  assert.doesNotMatch(data, /OC-\d|identidade pendente/, 'the data module must not format labels');
});
