// =====================================================================
// === tests/ordem-compra-receipt-events.smoke.js ======================
// PHASE-C4 (OC-C4-ADMIN-001) — events/interaction smokes. VM-loads js/ui.js
// + op-form-helpers.js + the three receipt modules, then drives the real
// registration and reversal modal flows through the faithful DOM double
// (real _listeners.click / value semantics) against a mocked supa.rpc.
//
// Proves, per contract §15: registration modal payload (allocation-shaped +
// explicit excess, no fabricated OP); authoritative reload after success;
// deterministic validation & RPC-error toasts with the form kept open;
// ambiguous-transport retry with the SAME token; a NEW token after a
// deterministic outcome; duplicate-submit prevention; independent receipt vs
// reversal trackers; reversal modal payload; the confirmDialog gate before
// execution; the client-side reversal cap; and the server over-reversal
// (excede_estornavel) denial presentation.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createDocument, makeFakeSupa } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const files = [
  'js/ui.js', 'js/screens/op-form-helpers.js',
  'js/screens/ordem-compra-receipt-data.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/ordem-compra-receipt-events.js',
];
const srcs = files.map((f) => [f, read(f)]);

function makeSandbox(rpcImpl) {
  const document = createDocument();
  const supa = makeFakeSupa({ rpcImpl });
  let uuid = 0;
  const sandbox = { document, console, setTimeout, clearTimeout, supa, crypto: { randomUUID: () => 'uuid-' + (++uuid) } };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: dono central da identidade de OP.
  // Dependencia real do sandbox: os consumidores nao tem fallback proprio.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'op-display.js'), 'utf8'), sandbox, { filename: 'js/op-display.js' });
  for (const [f, s] of srcs) vm.runInContext(s, sandbox, { filename: f });
  return { sandbox, supa, ns: sandbox.RAVATEX_SCREENS.ordemCompra };
}

function walk(node, fn) { if (!node) return; fn(node); for (const c of (node.children || [])) walk(c, fn); }
function findAll(node, pred) { const out = []; walk(node, (n) => { if (pred(n)) out.push(n); }); return out; }
function findButtons(node) { return findAll(node, (n) => n.tagName === 'BUTTON'); }
function btnByText(node, re) { return findButtons(node).find((b) => re.test(b.textContent || '')); }
function text(node) { let s = ''; walk(node, (n) => { if (n && n._text != null) s += ' ' + n._text; }); return s; }
function inputByAttr(node, attr, val) { return findAll(node, (n) => (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') && n.getAttribute(attr) === String(val))[0]; }
function overlays(sandbox) { return (sandbox.document.body.children || []).filter((n) => !n._removed); }
function overlayByTitle(sandbox, re) { return overlays(sandbox).find((o) => re.test(text(o))); }
function toasts(sandbox) { return sandbox.document._toastsNode.children; }
function lastToast(sandbox) { const t = toasts(sandbox); return t[t.length - 1]; }
function rpcCalls(supa, name) { return supa._calls.filter((c) => c.op === 'rpc' && c.name === name); }

function projection(overrides) {
  return Object.assign({
    ok: true, codigo: 'ok', ordem_compra_id: 100,
    status_administrativo: 'emitida', status_aceite: 'nao_aplicavel', ator_tipo: 'admin',
    acoes: { receber: true, estornar: true },
    itens: [{
      item_id: 7, material: 'poliester', cor_id: 3, cor_poliester: 'Azul',
      kg_pedido: 100, kg_recebido: 20, kg_restante: 80, kg_excesso: 0,
      alocacoes: [
        { alocacao_id: 42, op_id: 900, kg_alocado: 60, kg_recebido: 20, kg_restante: 40 },
        { alocacao_id: 43, op_id: null, kg_alocado: 40, kg_recebido: 0, kg_restante: 40 },
      ],
    }],
    comandos: [],
  }, overrides || {});
}
const LANC = {
  id: 800, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900,
  material: 'poliester', cor_id: 3, cor_poliester: 'Azul', kg: 20, kg_excesso: 0,
  estorno_de_id: null, kg_reversivel: 20, movimento_estoque: null,
};
const RECV_CMD = { id: 500, comando_tipo: 'recebimento', ator_tipo: 'admin', ocorrido_em: '2026-07-20T13:00:00+00:00', documento_ref: 'NF', origem_tipo: 'nf', origem_ref: 'R', lancamentos: [LANC] };

function setup(rpcImpl, hist) {
  const env = makeSandbox(rpcImpl);
  const reloadCalls = [];
  const state = { ordem: { modelo: 'nativo', status_administrativo: 'emitida' }, receiptHistory: hist || projection() };
  async function reload() { reloadCalls.push(1); }
  const handlers = env.ns.createReceiptEvents({ state, reload, ordemId: 100 });
  return Object.assign(env, { state, reload, reloadCalls, handlers });
}

test('registration modal opens with allocation + excess inputs and metadata fields', () => {
  const env = setup({});
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  assert.ok(modal, 'registration modal open');
  assert.ok(inputByAttr(modal, 'data-alocacao-id', 42), 'allocation 42 input');
  assert.ok(inputByAttr(modal, 'data-alocacao-id', 43), 'shared allocation 43 input');
  assert.ok(inputByAttr(modal, 'data-excesso-item', 7), 'per-item excess input');
  const total = findAll(modal, (n) => n.getAttribute && n.getAttribute('id') === 'oc-reg-total')[0];
  assert.ok(total, 'live total summary present');
  assert.match(total.getAttribute('style') || '', /position:sticky/, 'total summary is sticky above the footer (VISUAL-GATE-R1)');
});

test('registration success: allocation + explicit-excess payload; authoritative reload; modal closes', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, codigo: 'ok' }, error: null }) });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '10';
  inputByAttr(modal, 'data-excesso-item', 7).value = '2,5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const call = rpcCalls(env.supa, 'registrar_recebimento_ordem_compra')[0];
  assert.ok(call, 'native writer invoked');
  const linhas = JSON.parse(JSON.stringify(call.params.p_linhas));
  assert.deepEqual(linhas, [
    { item_id: 7, destino: 'alocacao', alocacao_id: 42, kg: 10 },
    { item_id: 7, destino: 'excesso', kg: 2.5 },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(linhas[1], 'alocacao_id'), false, 'excess line carries no allocation');
  assert.equal(env.reloadCalls.length, 1, 'authoritative reload after success');
  assert.match(lastToast(env.sandbox).className, /bg-green-600/);
  assert.equal(overlayByTitle(env.sandbox, /Registrar recebimento/), undefined, 'modal closed on success');
});

test('registration excess-only payload has no allocation, no fabricated OP', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-excesso-item', 7).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const linhas = JSON.parse(JSON.stringify(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra')[0].params.p_linhas));
  assert.deepEqual(linhas, [{ item_id: 7, destino: 'excesso', kg: 5 }]);
});

test('empty registration: deterministic validation error, no RPC, modal stays open', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  await btnByText(modal, /^Registrar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra').length, 0, 'no writer call');
  assert.match(lastToast(env.sandbox).className, /bg-red-600/);
  assert.match(lastToast(env.sandbox).textContent, /ao menos uma quantidade/i);
  assert.ok(overlayByTitle(env.sandbox, /Registrar recebimento/), 'modal stays open');
});

test('deterministic RPC rejection (recebimento_canonico_inativo): error toast, no reload, form kept open', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'recebimento_canonico_inativo', erro: 'x' }, error: null }) });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  assert.equal(env.reloadCalls.length, 0, 'no reload on rejection');
  assert.match(lastToast(env.sandbox).className, /bg-red-600/);
  assert.match(lastToast(env.sandbox).textContent, /inativo/i);
  assert.ok(overlayByTitle(env.sandbox, /Registrar recebimento/), 'form kept open with values');
  assert.equal(inputByAttr(modal, 'data-alocacao-id', 42).value, '5', 'entered value retained');
});

test('ambiguous transport retains the SAME token on same-intent retry (no fallback)', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0, statusText: '', count: null }) });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const calls = rpcCalls(env.supa, 'registrar_recebimento_ordem_compra');
  assert.equal(calls.length, 2, 'two attempts (original + retry)');
  assert.equal(calls[0].params.p_idempotency_key, calls[1].params.p_idempotency_key, 'same token reused on ambiguous retry');
  // Never falls back to the legacy compat writer.
  assert.equal(env.supa._calls.some((c) => /fio_compat/.test(c.name || '')), false);
});

test('a NEW token is minted after a deterministic outcome (rejection then success)', async () => {
  let n = 0;
  const env = setup({
    registrar_recebimento_ordem_compra: () => { n += 1; return n === 1
      ? { data: { ok: false, codigo: 'excede_alocacao' }, error: null }
      : { data: { ok: true }, error: null }; },
  });
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click(); // deterministic rejection -> complete()
  await btnByText(modal, /^Registrar$/)._listeners.click(); // same intent, but new token expected
  const calls = rpcCalls(env.supa, 'registrar_recebimento_ordem_compra');
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].params.p_idempotency_key, calls[1].params.p_idempotency_key, 'new token after a deterministic outcome');
});

test('reversal flow: modal payload (lancamento_id + motivo), confirmDialog gate, reload after success', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  assert.ok(modal, 'reversal modal open');
  const motivoEl = findAll(modal, (n) => n.tagName === 'TEXTAREA')[0];
  // VISUAL-GATE-R1, forward-corrected by SPECIALIZED-CONTROLS-B1. The gate's
  // intent is that the reversal reason is a real multiline control with a
  // canonical, owned box — not that it spells its radius inline through the
  // DEPRECATED --rv-radius-control alias. It now resolves through the shared
  // textarea primitive, whose radius css/tokens.css declares once as the
  // canonical var(--rv-radius); the deprecated reference is retired with it.
  assert.match(motivoEl.className || '', /\brv-textarea\b/, 'reversal motivo textarea is not the canonical primitive');
  assert.equal(motivoEl.getAttribute('data-rv-textarea'), 'rows', 'reversal motivo textarea lost its declared role');
  assert.doesNotMatch(motivoEl.getAttribute('style') || '', /--rv-radius-control/, 'a deprecated radius alias survived');
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  // motivo textarea
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'devolução parcial';
  btnByText(modal, /^Estornar$/)._listeners.click(); // opens confirmDialog; RPC NOT yet fired
  assert.equal(rpcCalls(env.supa, 'estornar_recebimento_ordem_compra').length, 0, 'no execution before confirmation');
  const confirm = overlayByTitle(env.sandbox, /Confirmar estorno/);
  assert.ok(confirm, 'confirmDialog before execution (guard 6)');
  await btnByText(confirm, /^Estornar$/)._listeners.click();
  const call = rpcCalls(env.supa, 'estornar_recebimento_ordem_compra')[0];
  assert.ok(call, 'reversal executed after confirmation');
  assert.deepEqual(JSON.parse(JSON.stringify(call.params.p_linhas)), [{ lancamento_id: 800, kg: 8 }]);
  assert.equal(call.params.p_motivo, 'devolução parcial');
  assert.equal(env.reloadCalls.length, 1, 'authoritative reload after reversal');
  assert.match(lastToast(env.sandbox).className, /bg-green-600/);
});

test('reversal client cap: kg above kg_reversivel is rejected before any RPC/confirm', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  inputByAttr(modal, 'data-reversal-kg', 800).value = '25'; // > 20 reversível
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'x';
  btnByText(modal, /^Estornar$/)._listeners.click();
  assert.equal(overlayByTitle(env.sandbox, /Confirmar estorno/), undefined, 'no confirmDialog for an over-cap kg');
  assert.equal(rpcCalls(env.supa, 'estornar_recebimento_ordem_compra').length, 0);
  assert.match(lastToast(env.sandbox).textContent, /saldo reversível/i);
});

test('reversal server over-reversal denial (excede_estornavel) is presented as a toast', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'excede_estornavel', disponivel: 5 }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'motivo';
  btnByText(modal, /^Estornar$/)._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Confirmar estorno/), /^Estornar$/)._listeners.click();
  assert.equal(env.reloadCalls.length, 0, 'no reload on denial');
  assert.match(lastToast(env.sandbox).className, /bg-red-600/);
  assert.match(lastToast(env.sandbox).textContent, /saldo reversível/i);
});

test('receipt and reversal use INDEPENDENT trackers (distinct tokens)', async () => {
  const env = setup({
    registrar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }),
    estornar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }),
  }, projection({ comandos: [RECV_CMD] }));
  // registration
  env.handlers.abrirRegistroRecebimento();
  let modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  // reversal
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'm';
  btnByText(modal, /^Estornar$/)._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Confirmar estorno/), /^Estornar$/)._listeners.click();
  const regTok = rpcCalls(env.supa, 'registrar_recebimento_ordem_compra')[0].params.p_idempotency_key;
  const revTok = rpcCalls(env.supa, 'estornar_recebimento_ordem_compra')[0].params.p_idempotency_key;
  assert.notEqual(regTok, revTok, 'receipt and reversal never share a token');
});

// --- Full-screen integration: the additive orchestration on #/ordens-compra/:id.
const fullFiles = [
  'js/ui.js', 'js/screens/common.js',
  'js/screens/ordem-compra-data.js', 'js/screens/ordem-compra-distribuicao.js',
  'js/screens/ordem-compra-render.js', 'js/screens/ordem-compra-events.js',
  'js/screens/ordem-compra-receipt-data.js', 'js/screens/ordem-compra-receipt-render.js',
  'js/screens/ordem-compra-receipt-events.js', 'js/screens/ordens-compra-list.js',
  'js/screens/ordem-compra.js',
];
const fullSrcs = fullFiles.map((f) => [f, read(f)]);

function makeFullSandbox(rpcImpl) {
  const document = createDocument();
  const supa = makeFakeSupa({ rpcImpl });
  let uuid = 0;
  const sandbox = {
    document, console, setTimeout, clearTimeout, supa,
    crypto: { randomUUID: () => 'uuid-' + (++uuid) },
    location: { hash: '#/ordens-compra/100' },
    navigate: () => {}, CURRENT_USER: { nome: 'T', tipo: 'admin' }, logout: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: dono central da identidade de OP.
  // Dependencia real do sandbox: os consumidores nao tem fallback proprio.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'op-display.js'), 'utf8'), sandbox, { filename: 'js/op-display.js' });
  for (const [f, s] of fullSrcs) vm.runInContext(s, sandbox, { filename: f });
  return { sandbox, supa };
}

function findById(node, id) {
  let f = null;
  walk(node, (n) => { if (!f && typeof n.getAttribute === 'function' && n.getAttribute('id') === id) f = n; });
  return f;
}

test('integration: screenOrdemCompra renders the Recebimentos section and reloads authoritatively after a receipt', async () => {
  let histCalls = 0;
  const env = makeFullSandbox({
    obter_ordem_compra_admin: () => ({ data: { ok: true, ordem: { ordem_id: 100, modelo: 'nativo', status_administrativo: 'emitida', fornecedor_nome: 'Fornecedor X', itens: [], acoes: {}, pode_emitir: false }, eventos: [] }, error: null }),
    obter_historico_recebimento_ordem_compra: () => { histCalls += 1; return { data: projection({ comandos: [RECV_CMD] }), error: null }; },
    registrar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }),
  });
  const view = await vm.runInContext('window.screenOrdemCompra(100)', env.sandbox);
  assert.ok(findById(view, 'oc-recebimentos'), 'Recebimentos section rendered on #/ordens-compra/:id');
  const registrar = findById(view, 'oc-registrar-recebimento');
  assert.ok(registrar, 'Registrar action rendered from the server acoes model');
  assert.equal(histCalls, 1, 'receipt history loaded once on mount');

  registrar._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra').length, 1, 'native writer invoked');
  assert.equal(histCalls, 2, 'authoritative server reload re-fetched the history after success');
});

// ---------------------------------------------------------------------
// RECEIPT-REVERSAL-MANDATORY-DATE-R1
//
// O escritor recusa o comando ANTES de qualquer escrita quando a data falta.
// Contrato medido na producao (_c3c_estornar_recebimento_impl, linhas 15-17):
//
//   IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 1 AND 200
//      OR p_estornado_em IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
//     RETURN ... 'codigo', 'comando_invalido', 'erro', 'Idempotencia, data e motivo sao obrigatorios';
//
// O modal de estorno nao coletava a data e o handler nao a enviava, entao
// TODO estorno era recusado. O teste de payload existente afirmava p_linhas e
// p_motivo e NAO afirmava p_ocorrido_em — foi essa omissao que deixou passar.
// Estes casos amarram os TRES campos obrigatorios do escritor.
// ---------------------------------------------------------------------

// Os tres campos que o escritor exige. Um NULL em qualquer um deles e uma
// recusa deterministica, nao um erro de digitacao do operador.
function assertComandoEstornoCompleto(call) {
  assert.ok(call, 'reversal RPC was never issued');
  assert.ok(call.params.p_idempotency_key, 'p_idempotency_key obrigatorio');
  assert.ok(call.params.p_ocorrido_em, 'p_ocorrido_em obrigatorio — sua ausencia devolve comando_invalido');
  assert.notEqual(call.params.p_ocorrido_em, null);
  assert.ok(String(call.params.p_motivo || '').trim(), 'p_motivo obrigatorio');
}

test('reversal: o comando carrega os TRES campos obrigatorios do escritor (data inclusive)', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  const dataEl = inputByAttr(modal, 'data-reversal-date', 800);
  assert.ok(dataEl, 'o modal de estorno tem de coletar a data');
  assert.equal(dataEl.getAttribute('type'), 'date', 'a data usa o primitivo de data, como no recebimento');
  assert.ok(dataEl.value, 'a data vem preenchida com o dia corrente, como no modal de recebimento');
  dataEl.value = '2026-08-03';
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'excesso lancado por engano';
  btnByText(modal, /^Estornar$/)._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Confirmar estorno/), /^Estornar$/)._listeners.click();
  const call = rpcCalls(env.supa, 'estornar_recebimento_ordem_compra')[0];
  assertComandoEstornoCompleto(call);
  assert.equal(call.params.p_ocorrido_em, '2026-08-03', 'a data enviada e a que o operador escolheu');
});

test('reversal: data em branco bloqueia o envio com mensagem propria, sem gastar RPC', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: true }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  inputByAttr(modal, 'data-reversal-date', 800).value = '';
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'motivo qualquer';
  btnByText(modal, /^Estornar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'estornar_recebimento_ordem_compra').length, 0,
    'sem data o comando nem chega ao servidor');
  assert.ok(!overlayByTitle(env.sandbox, /Confirmar estorno/), 'nem abre a confirmacao');
  assert.match(String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || ''), /data do estorno/i);
});

test('reversal: recusa do servidor fala de ESTORNO, nao de recebimento', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'comando_invalido' }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  env.handlers.estornarLancamento(RECV_CMD, LANC);
  const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
  inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
  findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'motivo qualquer';
  btnByText(modal, /^Estornar$/)._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Confirmar estorno/), /^Estornar$/)._listeners.click();
  const msg = String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || '');
  assert.match(msg, /estorno/i, 'a recusa tem de nomear a operacao que o operador fez');
  assert.doesNotMatch(msg, /Dados do recebimento inv/i,
    'a mensagem generica de recebimento foi o que impediu o operador de entender a falha');
});

test('reversal: trocar SO a data cunha um token novo (a data entra na intencao)', async () => {
  const env = setup({ estornar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'comando_invalido' }, error: null }) }, projection({ comandos: [RECV_CMD] }));
  async function submeter(data) {
    env.handlers.estornarLancamento(RECV_CMD, LANC);
    const modal = overlayByTitle(env.sandbox, /Estornar recebimento/);
    inputByAttr(modal, 'data-reversal-date', 800).value = data;
    inputByAttr(modal, 'data-reversal-kg', 800).value = '8';
    findAll(modal, (n) => n.tagName === 'TEXTAREA')[0].value = 'mesmo motivo';
    btnByText(modal, /^Estornar$/)._listeners.click();
    await btnByText(overlayByTitle(env.sandbox, /Confirmar estorno/), /^Estornar$/)._listeners.click();
  }
  await submeter('2026-08-03');
  await submeter('2026-08-04');
  const calls = rpcCalls(env.supa, 'estornar_recebimento_ordem_compra');
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].params.p_idempotency_key, calls[1].params.p_idempotency_key,
    'data diferente e comando diferente');
  assert.equal(calls[0].params.p_ocorrido_em, '2026-08-03');
  assert.equal(calls[1].params.p_ocorrido_em, '2026-08-04');
});

// ---------------------------------------------------------------------
// RECEIPT-ORIGIN-REQUIRED-R1
//
// O escritor exige DATA e ORIGEM (_c3c_registrar_recebimento_impl, linha 21,
// medido na producao):
//
//   IF p_recebido_em IS NULL OR p_origem_tipo IS NULL
//      OR length(btrim(p_origem_tipo)) NOT BETWEEN 1 AND 80 THEN
//     RETURN ... 'codigo', 'comando_invalido', 'erro', 'Data e origem sao obrigatorias';
//
// O campo "Tipo de origem" era rotulado "(opcional)". Quem acreditava no
// rotulo e deixava vazio tinha o recebimento RECUSADO antes de qualquer
// escrita — foi assim que um lancamento de poliester PRETO simplesmente nao
// existiu no banco. Estes casos amarram os dois campos obrigatorios.
// ---------------------------------------------------------------------

test('registro: o comando carrega data E origem, e a origem vem preenchida', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [] }, error: null }) }, projection());
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  const origem = inputByAttr(modal, 'data-receipt-origem-tipo', 1);
  assert.ok(origem, 'o modal tem de expor o campo de origem');
  assert.ok(String(origem.value || '').trim(), 'a origem vem preenchida: o caminho comum nao exige digitacao');
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const call = rpcCalls(env.supa, 'registrar_recebimento_ordem_compra')[0];
  assert.ok(call, 'o recebimento tem de chegar ao servidor');
  assert.ok(call.params.p_ocorrido_em, 'p_ocorrido_em obrigatorio');
  assert.ok(String(call.params.p_origem_tipo || '').trim(),
    'p_origem_tipo obrigatorio — NULL devolve comando_invalido e nada e gravado');
  assert.ok(String(call.params.p_origem_tipo).length <= 80, 'origem cabe no limite do escritor');
});

test('registro: origem em branco bloqueia o envio com mensagem propria, sem gastar RPC', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [] }, error: null }) }, projection());
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  inputByAttr(modal, 'data-receipt-origem-tipo', 1).value = '   ';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra').length, 0,
    'sem origem o comando nem chega ao servidor');
  assert.match(String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || ''), /origem/i);
});

test('registro: data em branco bloqueia o envio com mensagem propria', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [] }, error: null }) }, projection());
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  findAll(modal, (n) => n.tagName === 'INPUT' && n.getAttribute('type') === 'date')[0].value = '';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra').length, 0);
  assert.match(String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || ''), /data do recebimento/i);
});

test('registro: recusa comando_invalido nomeia os campos que faltam', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: false, codigo: 'comando_invalido' }, error: null }) }, projection());
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const msg = String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || '');
  assert.match(msg, /origem/i, 'a recusa tem de dizer QUAL campo falta');
  assert.doesNotMatch(msg, /^Dados do recebimento inv/i, 'a mensagem muda nao ajudava ninguem');
});

// ---------------------------------------------------------------------
// RECEIPT-POOL-DESTINATION-VISIBILITY-R1
//
// O recebimento de poliester PRETO da OC-001-4-26 entrou 100% na alocacao 102
// (kg_excesso 0,000) e a tela anunciou "Nenhuma OP foi afetada — o material
// entrou como excedente ou no pool do Pedido". Esse material NAO e excedente:
// e o pool COMPARTILHADO do Pedido, que db/101 escopa por pedido_id e que
// eleva o teto de todas as OPs do Pedido. A frase com "ou" fundia dois
// estados opostos e escolhia a leitura errada.
//
// op_id NULL numa linha COM alocacao significa origem-Pedido (constraint
// db/67 necessidade_origem_shape), nao ausencia de destino.
// ---------------------------------------------------------------------

const LINHA_OP = { id: 1, item_id: 7, alocacao_id: 42, op_id: 900, kg: 10, kg_excesso: 0 };
const LINHA_POOL = { id: 2, item_id: 7, alocacao_id: 102, op_id: null, kg: 880.65, kg_excesso: 0 };
const LINHA_EXCEDENTE = { id: 3, item_id: 7, alocacao_id: null, op_id: null, kg: 5, kg_excesso: 5 };

test('destinos: pool do Pedido nao e excedente e nao e OP', () => {
  const env = setup({}, projection());
  const c = env.handlers.classificarDestinos({ lancamentos: [LINHA_POOL] });
  // O array volta do realm do vm; comparar por conteudo, nao por prototipo.
  assert.equal(c.opIds.length, 0, 'pool nao aponta OP nenhuma');
  assert.equal(c.temPool, true, 'linha com alocacao e op_id NULL e pool do Pedido');
  assert.equal(c.temExcedente, false, 'pool nunca e classificado como excedente');

  const e = env.handlers.classificarDestinos({ lancamentos: [LINHA_EXCEDENTE] });
  assert.equal(e.temPool, false);
  assert.equal(e.temExcedente, true, 'linha sem alocacao e excedente');

  const o = env.handlers.classificarDestinos({ lancamentos: [LINHA_OP] });
  assert.equal(o.opIds.length, 1);
  assert.equal(o.opIds[0], 900);
  assert.equal(o.temPool, false);
  assert.equal(o.temExcedente, false);
});

test('recebimento no POOL oferece continuacao para o painel do Pedido, sem dizer excedente', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [LINHA_POOL] }, error: null }) },
    projection());
  env.state.ordem.pedido_id = 'ped-1';
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const cont = overlayByTitle(env.sandbox, /Recebimento registrado/);
  assert.ok(cont, 'o pool tem continuacao, nao um toast de beco sem saida');
  const txt = text(cont);
  assert.match(txt, /pool compartilhado do Pedido/i, 'a tela nomeia o destino real');
  assert.match(txt, /todas as OPs do Pedido/i, 'e diz que eleva o teto delas');
  assert.doesNotMatch(txt, /excedente/i, 'pool puro nunca pode ser chamado de excedente');
  assert.ok(btnByText(cont, /Revisar produção do Pedido/), 'acao de continuacao presente');
});

test('recebimento SO de excedente diz exatamente isso, sem citar pool', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [LINHA_EXCEDENTE] }, error: null }) },
    projection());
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const msg = String(lastToast(env.sandbox)._text || lastToast(env.sandbox).textContent || '');
  assert.match(msg, /excedente/i);
  assert.doesNotMatch(msg, /pool/i, 'excedente puro nao pode citar pool na mesma frase');
});

test('pool + excedente no mesmo recebimento: continuacao do pool, excedente declarado a parte', async () => {
  const env = setup({ registrar_recebimento_ordem_compra: () => ({ data: { ok: true, lancamentos: [LINHA_POOL, LINHA_EXCEDENTE] }, error: null }) },
    projection());
  env.state.ordem.pedido_id = 'ped-1';
  env.handlers.abrirRegistroRecebimento();
  const modal = overlayByTitle(env.sandbox, /Registrar recebimento/);
  inputByAttr(modal, 'data-alocacao-id', 42).value = '5';
  await btnByText(modal, /^Registrar$/)._listeners.click();
  const cont = overlayByTitle(env.sandbox, /Recebimento registrado/);
  assert.ok(cont, 'havendo pool, a continuacao existe');
  const txt = text(cont);
  assert.match(txt, /pool compartilhado do Pedido/i);
  assert.match(txt, /excedente/i, 'a parte excedente e declarada, nao escondida');
});
