// =====================================================================
// === tests/ordem-compra-emitir.smoke.js ==============================
// PHASE-C5 (OC-C5-EMISSION-001) — behavioral smokes for native purchase-
// order emission on the dedicated detail screen (#/ordens-compra/:id).
//
// VM-loads js/ui.js + common.js + the ordem-compra detail modules into one
// context (shared canonical doubles, tests/_doubles.js), then drives the REAL
// render → click → confirmation-modal → RPC flow through the faithful DOM
// double (real boolean-attr + _listeners.click semantics) against a mocked
// supa.rpc. No source-text greps stand in for behavior.
//
// Proves the contract §14 / order TEST MANIFEST points 1–25:
//   server-derived acoes.emitir enable/disable (no client-computed readiness
//   substitute); explicit non-destructive confirmation; cancel performs no RPC;
//   confirm invokes emitir_ordem_compra exactly once with the correct id;
//   duplicate-submit prevention; authoritative reload with no local final-state
//   fabrication; the full deterministic writer error vocabulary (no retry, no
//   fallback writer); ambiguous transport reloads before any retry;
//   exige_aceite / legacy / emitted / cancelled cannot emit; status_aceite
//   renders for every value; and no acceptance/rejection control exists.
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
  // js/op-display.js owns the canonical OP/OC identity labels and is loaded
  // before every screen in index.html. The purchase-order screens call it to
  // name an order, so the sandbox must carry it too.
  'js/op-display.js',
  'js/ui.js', 'js/screens/common.js',
  'js/screens/ordem-compra-data.js', 'js/screens/ordem-compra-distribuicao.js',
  'js/screens/ordem-compra-render.js', 'js/screens/ordem-compra-events.js',
  'js/screens/ordens-compra-list.js', 'js/screens/ordem-compra.js',
];

// Canonical identities (db/95) for the orders this suite renders. The primary
// keys are deliberately unrelated to the Pedido number: 4210 is the FIRST
// purchase order of Pedido 001 and 9999 the SECOND, so every surface must read
// OC-001-1-26 / OC-001-2-26 and never #4210 or #9999.
const PEDIDO_1 = '11111111-1111-4111-8111-111111111111';
const OC_IDENTITIES = [
  { id: 4210, identidade_operacional: 'OC-001-1-26', identidade_pedido_id: PEDIDO_1, pedido_id: PEDIDO_1 },
  { id: 9999, identidade_operacional: 'OC-001-2-26', identidade_pedido_id: PEDIDO_1, pedido_id: PEDIDO_1 },
];
const srcs = files.map((f) => [f, read(f)]);

function makeSandbox(rpcImpl, tableData) {
  const document = createDocument();
  const supa = makeFakeSupa({
    rpcImpl,
    tableData: tableData || { ordem_compra: OC_IDENTITIES },
  });
  let uuid = 0;
  const navCalls = [];
  const sandbox = {
    document, console, setTimeout, clearTimeout, supa,
    crypto: { randomUUID: () => 'uuid-' + (++uuid) },
    location: { hash: '#/ordens-compra/100' },
    navigate: (h) => navCalls.push(h),
    CURRENT_USER: { nome: 'Tester', tipo: 'admin' }, logout: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const [f, s] of srcs) vm.runInContext(s, sandbox, { filename: f });
  sandbox.window.navigate = sandbox.navigate;
  return { sandbox, supa, ns: sandbox.RAVATEX_SCREENS.ordemCompra, navCalls };
}

// ---- DOM walk helpers (faithful double) -----------------------------
function walk(node, fn) { if (!node) return; fn(node); for (const c of (node.children || [])) walk(c, fn); }
function findAll(node, pred) { const out = []; walk(node, (n) => { if (pred(n)) out.push(n); }); return out; }
function findButtons(node) { return findAll(node, (n) => n.tagName === 'BUTTON'); }
function findById(node, id) { return findAll(node, (n) => typeof n.getAttribute === 'function' && n.getAttribute('id') === id)[0] || null; }
function btnByText(node, re) { return findButtons(node).find((b) => re.test(b.textContent || '')); }
function text(node) { let s = ''; walk(node, (n) => { if (n && n._text != null) s += ' ' + n._text; }); return s; }
function overlays(sandbox) { return (sandbox.document.body.children || []).filter((n) => !n._removed); }
function overlayByTitle(sandbox, re) { return overlays(sandbox).find((o) => re.test(text(o))); }
function toasts(sandbox) { return sandbox.document._toastsNode.children; }
function lastToast(sandbox) { const t = toasts(sandbox); return t[t.length - 1]; }
function rpcCalls(supa, name) { return supa._calls.filter((c) => c.op === 'rpc' && c.name === name); }
function allRpcNames(supa) { return supa._calls.filter((c) => c.op === 'rpc').map((c) => c.name); }

async function renderScreen(rpcImpl) {
  const env = makeSandbox(rpcImpl);
  const view = await vm.runInContext('window.screenOrdemCompra(100)', env.sandbox);
  return Object.assign(env, { view });
}

// obter_ordem_compra_admin that returns each order once, repeating the last —
// lets a test see a different (server-authoritative) order on the post-emission
// reload than on the initial mount.
function sequencedObter(...orders) {
  let i = 0;
  return () => {
    const ordem = orders[Math.min(i, orders.length - 1)];
    i += 1;
    return { data: { ok: true, ordem, eventos: ordem.__eventos || [] }, error: null };
  };
}

// ---- Fixtures (obter_ordem_compra_admin `ordem` shape, db/77) --------
function order(over) {
  return Object.assign({
    ordem_id: 4210, modelo: 'nativo', pedido_id: 'p1', fornecedor_id: 7, fornecedor_nome: 'Fios Premium Ltda',
    status_administrativo: 'rascunho', status_aceite: 'nao_aplicavel', status_recebimento: 'nao_recebido',
    legado: false, legado_provenance: null, emitida_em: null, cancelada_em: null, itens_total: 1,
    itens: [{ item_id: 10, material: 'poliester', cor_id: 3, cor_poliester: 'Azul Marinho', cor_nome: null, kg_pedido: 183, kg_recebido: 0, alocacoes: 1, kg_alocado: 183 }],
    acoes: { editar_itens: true, remover_itens: true, cancelar: true, distribuir: true, emitir: false, receber: false },
    distribuicao_completa: true, pronta_para_emissao: true, pode_emitir: false, bloqueio_emissao: null,
  }, over || {});
}
const ELIGIBLE = order({ acoes: { editar_itens: true, remover_itens: true, cancelar: true, distribuir: true, emitir: true, receber: false }, pode_emitir: true, bloqueio_emissao: null });
const INCOMPLETE = order({
  acoes: { editar_itens: true, remover_itens: true, cancelar: true, distribuir: true, emitir: false, receber: false },
  distribuicao_completa: false, pronta_para_emissao: false, pode_emitir: false, bloqueio_emissao: 'distribuicao_necessidades_pendente',
  itens: [{ item_id: 10, material: 'poliester', cor_id: 3, cor_poliester: 'Azul Marinho', cor_nome: null, kg_pedido: 183, kg_recebido: 0, alocacoes: 1, kg_alocado: 100 }],
});
const ACEITE_REQUIRED = order({
  acoes: { editar_itens: true, remover_itens: true, cancelar: true, distribuir: true, emitir: false, receber: false },
  pode_emitir: false, bloqueio_emissao: 'emissao_bloqueada_exige_aceite',
});
function emitted(statusAceite) {
  return order({
    status_administrativo: 'emitida', status_aceite: statusAceite, emitida_em: '2026-07-22T12:00:00Z',
    acoes: { editar_itens: false, remover_itens: false, cancelar: false, distribuir: false, emitir: false, receber: false },
    pode_emitir: false, bloqueio_emissao: null,
    __eventos: [{ id: 1, dimensao: 'administrativo', tipo_evento: 'emitida', valor_anterior: 'rascunho', valor_novo: 'emitida', criado_em: '2026-07-22T12:00:00Z' }],
  });
}
const CANCELLED = order({
  status_administrativo: 'cancelada', cancelada_em: '2026-07-10T00:00:00Z',
  acoes: { editar_itens: false, remover_itens: false, cancelar: false, distribuir: false, emitir: false, receber: false },
  pode_emitir: false, bloqueio_emissao: null,
});
const LEGACY = order({
  modelo: 'legado', legado: true, legado_provenance: 'emitido_recebido', status_administrativo: 'emitida',
  acoes: { editar_itens: false, remover_itens: false, cancelar: false, distribuir: false, emitir: false, receber: false },
  pode_emitir: false, bloqueio_emissao: null,
});

const okResult = () => ({ data: { ok: true, codigo: 'ok', ordem_compra_id: 4210, status_administrativo: 'emitida', status_aceite: 'nao_aplicavel' }, error: null });

// ============================ ENABLEMENT (server-derived) ============
test('1. acoes.emitir=true renders an ENABLED emit action wired to a click handler', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE) });
  const emit = findById(env.view, 'oc-emitir');
  assert.ok(emit, 'emit control exists');
  assert.equal(emit.disabled, false, 'enabled when acoes.emitir=true');
  assert.ok(emit._listeners && emit._listeners.click, 'enabled control is wired to a click handler');
  assert.ok(findById(env.view, 'oc-emissao-pronta'), 'readiness context is visible');
});

test('2. acoes.emitir=false prevents emission (disabled, no handler)', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(INCOMPLETE) });
  const emit = findById(env.view, 'oc-emitir');
  assert.equal(emit.disabled, true, 'disabled when acoes.emitir=false');
  assert.ok(!emit._listeners || !emit._listeners.click, 'disabled control has no click handler');
});

test('3. no client-computed readiness substitute: acoes.emitir is authoritative over local item sums', async () => {
  // (a) Server says emitir=false even though local item sums look complete
  //     (kg_alocado === kg_pedido, distribuicao_completa=true) → still disabled.
  const localLooksComplete = order({ acoes: { emitir: false }, distribuicao_completa: true, pode_emitir: false, bloqueio_emissao: 'emissao_bloqueada_exige_aceite' });
  const a = await renderScreen({ obter_ordem_compra_admin: sequencedObter(localLooksComplete) });
  assert.equal(findById(a.view, 'oc-emitir').disabled, true, 'client does not enable from local sums when the server withholds acoes.emitir');
  // (b) Server says emitir=true even though local item sums look INCOMPLETE
  //     (kg_alocado < kg_pedido) → still enabled (server authority).
  const localLooksIncomplete = order({ acoes: { emitir: true }, pode_emitir: true, itens: [{ item_id: 10, material: 'poliester', cor_poliester: 'Azul', kg_pedido: 183, kg_alocado: 5, alocacoes: 1 }] });
  const b = await renderScreen({ obter_ordem_compra_admin: sequencedObter(localLooksIncomplete) });
  assert.equal(findById(b.view, 'oc-emitir').disabled, false, 'client trusts acoes.emitir=true and does not disable from local sums');
});

// ============================ CONFIRMATION UX =======================
test('4. eligible draft: clicking Emitir opens an explicit confirmation modal (irreversible-transition copy)', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE) });
  findById(env.view, 'oc-emitir')._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Emitir ordem de compra OC-001-1-26/);
  assert.ok(modal, 'confirmation modal opened');
  const copy = text(modal);
  assert.match(copy, /retira do rascunho/i, 'explains leaving draft → emitida');
  assert.match(copy, /congelad/i, 'explains items/allocations are frozen');
  assert.match(copy, /definitiva/i, 'explains irreversibility');
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 0, 'opening the modal performs NO RPC');
});

test('5. confirmation is NOT styled as destructive deletion (primary/neutral, not red)', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE) });
  findById(env.view, 'oc-emitir')._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Emitir ordem de compra/);
  const confirm = btnByText(modal, /^Emitir ordem$/);
  assert.ok(confirm, 'confirm control present');
  assert.match(confirm.className, /bg-\[#2563eb\]/, 'confirm uses the primary/neutral treatment');
  assert.doesNotMatch(confirm.className, /bg-red-600/, 'confirm is NOT the destructive-red treatment');
});

test('6. cancelling the confirmation performs NO RPC and closes the surface', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE), emitir_ordem_compra: okResult });
  findById(env.view, 'oc-emitir')._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Emitir ordem de compra/);
  btnByText(modal, /^Cancelar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 0, 'cancel performs no emission RPC');
  assert.ok(!overlayByTitle(env.sandbox, /Emitir ordem de compra/), 'modal closed after cancel');
});

// ============================ CONFIRM → RPC → RELOAD =================
test('7+8. confirming invokes emitir_ordem_compra exactly once with the correct order id', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE, emitted('nao_aplicavel')), emitir_ordem_compra: okResult });
  findById(env.view, 'oc-emitir')._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Emitir ordem de compra/);
  await btnByText(modal, /^Emitir ordem$/)._listeners.click();
  const calls = rpcCalls(env.supa, 'emitir_ordem_compra');
  assert.equal(calls.length, 1, 'exactly one emission RPC');
  // JSON round-trip normalises the cross-realm (VM-context) params object.
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params)), { p_ordem_id: 4210 }, 'only the canonical p_ordem_id is sent (no idempotency key)');
});

test('9. duplicate confirm clicks while in flight fire only ONE emission RPC', async () => {
  let resolveRpc;
  const gate = new Promise((r) => { resolveRpc = r; });
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, emitted('nao_aplicavel')),
    emitir_ordem_compra: async () => { await gate; return okResult(); },
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  const modal = overlayByTitle(env.sandbox, /Emitir ordem de compra/);
  const confirm = btnByText(modal, /^Emitir ordem$/);
  const p1 = confirm._listeners.click();   // in flight (awaiting the gate)
  const p2 = confirm._listeners.click();   // duplicate while in flight → blocked
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'the in-flight guard blocks the duplicate submission');
  resolveRpc();
  await Promise.all([p1, p2]);
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'still exactly one emission RPC after both resolve');
});

test('10+11. success triggers an authoritative reload and renders the SERVER state (no local fabrication)', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE, emitted('nao_aplicavel')), emitir_ordem_compra: okResult });
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 1, 'one detail load on mount');
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'authoritative reload re-fetched the detail after success');
  // The re-rendered screen shows the SERVER reload payload (emitida), not a
  // locally-patched object: emit is now disabled and the emitida status shows.
  assert.equal(findById(env.view, 'oc-emitir').disabled, true, 'reloaded emitida order can no longer emit');
  assert.match(text(findById(env.view, 'ordem-compra-detail')), /Emitida/, 'server emitida state rendered');
  assert.ok(!overlayByTitle(env.sandbox, /Emitir ordem de compra/), 'modal closed on success');
});

// ============================ DETERMINISTIC ERROR VOCABULARY =========
const DENIALS = [
  ['12. wrong state', 'estado_invalido', /rascunho pode ser emitida/i],
  ['13. permission denied (codigo)', 'sem_permissao', /Sem permissão/i],
  ['14. missing supplier', 'sem_fornecedor', /fornecedor/i],
  ['15. missing items', 'sem_itens', /não possui itens/i],
  ['16. incomplete allocation', 'alocacao_incompleta', /distribuição.*incompleta/i],
  ['17a. order not found', 'nao_encontrada', /não encontrada/i],
  ['17b. legacy order', 'ordem_legado', /legado/i],
  ['17c. incoherent allocation', 'alocacao_incoerente', /incoerentes/i],
];
for (const [label, codigo, re] of DENIALS) {
  test(`${label}: deterministic denial (${codigo}) shows a fixed pt-BR message, no retry, no fallback writer`, async () => {
    const env = await renderScreen({
      obter_ordem_compra_admin: sequencedObter(ELIGIBLE),
      emitir_ordem_compra: () => ({ data: { ok: false, codigo, erro: 'raw sql/internal detail' }, error: null }),
    });
    findById(env.view, 'oc-emitir')._listeners.click();
    await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
    assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'no retry — exactly one emission RPC');
    assert.match(lastToast(env.sandbox).className, /bg-red-600/, 'error toast');
    assert.match(lastToast(env.sandbox).textContent, re, 'fixed pt-BR message');
    assert.doesNotMatch(lastToast(env.sandbox).textContent, /raw sql\/internal detail/i, 'never surfaces raw internal detail');
    assert.deepEqual(allRpcNames(env.supa).filter((n) => /emitir/.test(n)), ['emitir_ordem_compra'], 'no legacy/compat emission fallback');
    assert.ok(overlayByTitle(env.sandbox, /Emitir ordem de compra/), 'modal stays open on a deterministic denial');
  });
}

test('13b. call-time permission denied (42501 hard failure) is a deterministic denial, never retried', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE),
    emitir_ordem_compra: () => ({ data: null, error: { code: '42501', message: 'permission denied for function emitir_ordem_compra' }, status: 403 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'no retry on a 42501 hard failure');
  assert.match(lastToast(env.sandbox).textContent, /Sem permissão/i, 'fixed permission message');
  assert.doesNotMatch(lastToast(env.sandbox).textContent, /function emitir_ordem_compra/i, 'never leaks the internal SQL error text');
});

test('17d. unmapped deterministic result falls back to a clean generic message (no raw error)', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE),
    emitir_ordem_compra: () => ({ data: { ok: false, codigo: 'algum_codigo_novo', erro: 'internal' }, error: null }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.match(lastToast(env.sandbox).textContent, /Não foi possível emitir a ordem/i, 'clean generic deterministic message');
});

// ============================ AMBIGUOUS TRANSPORT ====================
test('18+19. ambiguous transport (status===0) reloads BEFORE any retry, never falls back to another writer', async () => {
  // The reload resolves the order to emitida → the emission actually landed.
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, emitted('nao_aplicavel')),
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'the emission writer is NOT re-called automatically');
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'an authoritative reload runs before any retry');
  assert.deepEqual(allRpcNames(env.supa).filter((n) => /emitir/.test(n)), ['emitir_ordem_compra'], 'no legacy/compat fallback writer');
  assert.match(text(findById(env.view, 'ordem-compra-detail')), /Emitida/, 'server state (emitida) is treated as authoritative after the reload');
});

test('18b. ambiguous transport that stays a draft preserves honest uncertainty and offers a deliberate retry', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, ELIGIBLE),  // reload still shows an eligible draft
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'no automatic re-emission');
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'reload performed');
  assert.match(text(env.sandbox.document._toastsNode), /continua em rascunho/i, 'honest uncertainty surfaced');
  assert.match(lastToast(env.sandbox).textContent, /tentar emitir novamente/i, 'a deliberate retry is offered because the reloaded order itself has acoes.emitir=true');
  // The reloaded screen still offers the emit action as a NEW deliberate retry.
  assert.equal(findById(env.view, 'oc-emitir').disabled, false, 'the reloaded Emitir button is the controlled deliberate retry');
});

test('18c. ambiguous transport reload to a draft that the server itself still withholds does not falsely offer a retry', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, INCOMPLETE),  // reload: still rascunho, but acoes.emitir=false
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.match(lastToast(env.sandbox).textContent, /continua em rascunho/i, 'still honestly reports the draft state');
  assert.doesNotMatch(lastToast(env.sandbox).textContent, /tentar emitir novamente/i, 'never offers a retry the reloaded server object itself withholds (acoes.emitir=false)');
  assert.equal(findById(env.view, 'oc-emitir').disabled, true, 'the reloaded Emitir control is honestly disabled, not reconstructed as enabled from stale pre-reload state');
});

test('18d. an authoritative reload that itself fails after an ambiguous transport preserves honest uncertainty (never a false draft claim)', async () => {
  let obterCalls = 0;
  const env = await renderScreen({
    obter_ordem_compra_admin: () => {
      obterCalls += 1;
      if (obterCalls === 1) return { data: { ok: true, ordem: ELIGIBLE, eventos: [] }, error: null };
      return { data: null, error: { message: 'Erro de rede' }, status: 500 };  // the reload itself fails
    },
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'emitir_ordem_compra was called exactly once — no automatic retry');
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'obter_ordem_compra_admin was attempted exactly twice (mount + one authoritative reload)');
  assert.deepEqual(allRpcNames(env.supa).filter((n) => /emitir/.test(n)), ['emitir_ordem_compra'], 'no fallback or legacy emission writer was called');
  const toastText = text(env.sandbox.document._toastsNode);
  assert.doesNotMatch(toastText, /continua em rascunho/i, 'the UI never claims the order remains a draft when the reload itself failed');
  assert.doesNotMatch(toastText, /foi emitida/i, 'the UI never claims the order was emitted when the reload itself failed');
  assert.match(lastToast(env.sandbox).textContent, /Não foi possível confirmar o resultado da emissão\. Recarregue a ordem antes de tentar novamente\./, 'the UI displays the fixed unresolved-result message');
  assert.equal(findById(env.view, 'oc-emitir'), null, 'no enabled Emitir control is reconstructed from stale pre-reload state — the failed-reload screen shows no order at all');
});

test('18e. an authoritative reload to a non-draft, non-emitted state (e.g. cancelled) after an ambiguous transport is never described as a draft', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, CANCELLED),
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 1, 'no automatic re-emission');
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'exactly one authoritative reload');
  const toastText = text(env.sandbox.document._toastsNode);
  assert.doesNotMatch(toastText, /continua em rascunho/i, 'a cancelled order is never described as remaining a draft');
  assert.doesNotMatch(toastText, /foi emitida/i, 'a cancelled order is never described as emitted');
  assert.match(lastToast(env.sandbox).textContent, /Não foi possível confirmar o resultado da emissão/i, 'shows the fixed unresolved-result message for an unrecognized post-reload state');
});

test('18f. an authoritative reload returning a different order id after an ambiguous transport preserves honest uncertainty', async () => {
  const otherOrder = order({ ordem_id: 9999, status_administrativo: 'rascunho' });
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, otherOrder),
    emitir_ordem_compra: () => ({ data: null, error: { message: 'Failed to fetch' }, status: 0 }),
  });
  findById(env.view, 'oc-emitir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Emitir ordem de compra/), /^Emitir ordem$/)._listeners.click();
  const toastText = text(env.sandbox.document._toastsNode);
  assert.doesNotMatch(toastText, /continua em rascunho/i, 'a mismatched order id is never described as the attempted order remaining a draft');
  assert.match(lastToast(env.sandbox).textContent, /Não foi possível confirmar o resultado da emissão/i, 'shows the fixed unresolved-result message when the reload returns a different order');
});

// ============================ STATE MATRIX (cannot emit) =============
for (const [label, fx] of [
  ['20. exige_aceite draft', ACEITE_REQUIRED],
  ['23. legacy order', LEGACY],
  ['24. emitted order', emitted('nao_aplicavel')],
  ['25. cancelled order', CANCELLED],
]) {
  test(`${label} cannot emit (disabled, no handler)`, async () => {
    const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(fx) });
    const emit = findById(env.view, 'oc-emitir');
    assert.equal(emit.disabled, true, 'emit control disabled');
    assert.ok(!emit._listeners || !emit._listeners.click, 'no click handler');
  });
}

test('20b. exige_aceite draft shows the canonical blocker and offers NO acceptance override', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ACEITE_REQUIRED) });
  const bloq = findById(env.view, 'oc-bloqueio-emissao');
  assert.ok(bloq && /exige aceite/i.test(bloq.textContent), 'canonical exige_aceite blocker shown');
  assert.equal(findButtons(env.view).find((b) => /aceit|rejeit|aprovar|recusar/i.test(b.textContent || '')), undefined, 'no acceptance/override control');
});

// ============================ status_aceite RENDERING ================
for (const [statusAceite, re, notLabel] of [
  ['nao_aplicavel', /não aplicável/i, null],
  ['pendente', /aguardando aceite/i, /confirmado/i],
  ['aceita', /aceite confirmado/i, null],
  ['rejeitada', /aceite rejeitado/i, null],
]) {
  test(`21. status_aceite='${statusAceite}' renders a distinct acceptance badge`, async () => {
    const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(emitted(statusAceite)) });
    const badge = findById(env.view, 'oc-status-aceite');
    assert.ok(badge, 'acceptance badge rendered for a native emitted order');
    assert.equal(badge.getAttribute('data-status-aceite'), statusAceite, 'badge carries the exact status value');
    assert.match(badge.textContent, re, 'correct label');
    if (notLabel) assert.doesNotMatch(badge.textContent, notLabel, 'pendente is never presented as accepted');
  });
}

test('21b. emitted + pendente surfaces the "not lifecycle-complete" notice (PHASE-C5B limitation)', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(emitted('pendente')) });
  const aviso = findById(env.view, 'oc-aceite-pendente-aviso');
  assert.ok(aviso, 'pending-acceptance notice present');
  assert.match(aviso.textContent, /ainda não está concluída/i, 'states the order is not complete');
});

test('22. no acceptance/rejection control exists on the detail screen (any acceptance state)', async () => {
  for (const sa of ['nao_aplicavel', 'pendente', 'aceita', 'rejeitada']) {
    const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(emitted(sa)) });
    const control = findButtons(env.view).find((b) => /aceitar|rejeitar|aprovar|recusar|decidir aceite/i.test(b.textContent || ''));
    assert.equal(control, undefined, `no acceptance/rejection button for status_aceite=${sa}`);
  }
});

// ============================ DATA-LAYER PRIMITIVES ==================
test('data: classifyEmissionResult maps every outcome deterministically', () => {
  const { ns } = makeSandbox({});
  assert.equal(ns.classifyEmissionResult({ data: { ok: true, codigo: 'ok' }, error: null }).outcome, 'success');
  const rej = ns.classifyEmissionResult({ data: { ok: false, codigo: 'estado_invalido' }, error: null });
  assert.equal(rej.outcome, 'rejected'); assert.equal(rej.codigo, 'estado_invalido');
  const hard = ns.classifyEmissionResult({ data: null, error: { code: '42501' }, status: 403 });
  assert.equal(hard.outcome, 'hard_failure'); assert.equal(hard.codigo, '42501');
  assert.equal(ns.classifyEmissionResult({ data: null, error: { message: 'net' }, status: 0 }).outcome, 'ambiguous');
});

test('data: isEmissionTransportAmbiguous is TRUE only for an error with status===0', () => {
  const { ns } = makeSandbox({});
  assert.equal(ns.isEmissionTransportAmbiguous({ error: { message: 'x' }, status: 0 }), true);
  assert.equal(ns.isEmissionTransportAmbiguous({ error: { code: '42501' }, status: 403 }), false);
  assert.equal(ns.isEmissionTransportAmbiguous({ data: { ok: true }, error: null }), false);
});

test('data: emitirOrdem sends only p_ordem_id to the canonical writer', async () => {
  const env = makeSandbox({ emitir_ordem_compra: okResult });
  const res = await env.ns.emitirOrdem(4210);
  assert.equal(res.outcome, 'success');
  const call = rpcCalls(env.supa, 'emitir_ordem_compra')[0];
  assert.deepEqual(JSON.parse(JSON.stringify(call.params)), { p_ordem_id: 4210 }, 'exact canonical payload, no invented idempotency key');
});

test('data: the emission attempt tracker is a local, independent copy (never the receipt tracker)', () => {
  const { ns } = makeSandbox({});
  const t = ns.createEmissionAttemptTracker();
  const a1 = t.resolveAttempt({ ordemId: 1 });
  assert.equal(t.resolveAttempt({ ordemId: 1 }), a1, 'same intent → same in-flight attempt token');
  t.complete();
  assert.notEqual(t.resolveAttempt({ ordemId: 1 }).token, a1.token, 'a new deliberate attempt mints a fresh token');
  assert.notEqual(ns.createEmissionAttemptTracker, ns.createReceiptAttemptTracker, 'structurally independent from the receipt tracker');
});

// ============================ CANCELLATION HANDLER PRESERVED =========
test('27. the existing cancellation handler is preserved (still calls cancelar_ordem_compra)', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE, CANCELLED),
    cancelar_ordem_compra: () => ({ data: { ok: true }, error: null }),
  });
  findById(env.view, 'oc-cancelar')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Cancelar ordem de compra/), /^Cancelar ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'cancelar_ordem_compra').length, 1, 'cancellation still routes to cancelar_ordem_compra');
  assert.equal(rpcCalls(env.supa, 'emitir_ordem_compra').length, 0, 'cancellation never calls the emission writer');
});

// =====================================================================
// === CANCELLATION — the order id must survive to the RPC =============
// Regression: createEvents() runs before loadOrdemDetail, so the handler's
// `ordem` closure was captured while state.ordem was still null. Cancelling
// sent p_ordem_id: undefined, supabase-js dropped the key, and PostgREST
// answered PGRST202 for a zero-argument cancelar_ordem_compra(). The UI could
// only show the generic "Não foi possível concluir a ação." and no order was
// ever cancelled.
// =====================================================================

test('C1. cancelling a draft reaches the RPC with the real order id', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(order()),
    cancelar_ordem_compra: () => ({ data: { ok: true, codigo: 'ok', ordem_compra_id: 4210, status_administrativo: 'cancelada' }, error: null }),
  });
  findById(env.view, 'oc-cancelar')._listeners.click();
  const dialog = overlayByTitle(env.sandbox, /Cancelar ordem de compra/);
  assert.ok(dialog, 'the confirmation dialog opened');
  await btnByText(dialog, /^Cancelar ordem$/)._listeners.click();

  const calls = rpcCalls(env.supa, 'cancelar_ordem_compra');
  assert.equal(calls.length, 1, 'exactly one cancellation RPC');
  const params = JSON.parse(JSON.stringify(calls[0].params));
  assert.deepEqual(params, { p_ordem_id: 4210 }, 'the real order id is sent');
  // The precise regression: an undefined id serialises away entirely.
  assert.ok('p_ordem_id' in params, 'p_ordem_id must survive JSON serialisation');
  assert.notEqual(params.p_ordem_id, null);
});

test('C2. the confirmation names the order canonically, never by the primary key', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(order()) });
  findById(env.view, 'oc-cancelar')._listeners.click();
  const dialog = overlayByTitle(env.sandbox, /Cancelar ordem de compra/);
  const copy = text(dialog);
  assert.match(copy, /OC-001-1-26/, 'canonical identity in the confirmation');
  assert.doesNotMatch(copy, /#4210/, 'never the raw primary key');

  // PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 AMENDMENT. The previous
  // expectation was that the copy "still states the distribution is
  // untouched". Under the decided lifecycle that sentence became FALSE:
  // cancellation now releases the order's active quantities immediately. A
  // confirmation that mis-describes its own consequence is worse than none, so
  // the three decided facts are asserted instead.
  assert.match(copy, /permanece no histórico/i, 'the order stays in history');
  assert.match(copy, /liberadas/i, 'the active quantities are released');
  assert.match(copy, /novo planejamento/i, 'released for new planning');
  assert.match(copy, /recebimento|estorno/i, 'irreversible orders cannot be cancelled');
  assert.doesNotMatch(copy, /distribuição não será alterada/i,
    'the superseded promise must not survive');
});

test('C3. a successful cancellation reloads from the server, never fabricating the state', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(
      order(),
      order({ status_administrativo: 'cancelada', cancelada_em: '2026-07-30T10:00:00Z', acoes: { editar_itens: false, remover_itens: false, cancelar: false, distribuir: false, emitir: false, receber: false } }),
    ),
    cancelar_ordem_compra: () => ({ data: { ok: true, codigo: 'ok' }, error: null }),
  });
  findById(env.view, 'oc-cancelar')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Cancelar ordem de compra/), /^Cancelar ordem$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 2, 'the screen re-read the server');
  assert.equal(findById(env.view, 'oc-cancelar'), null, 'the cancel action is gone on the reloaded state');
});

test('C4. a server refusal surfaces the server reason, not the generic fallback', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(order()),
    cancelar_ordem_compra: () => ({ data: { ok: false, codigo: 'estado_invalido', erro: 'Somente rascunho pode ser cancelada nesta fase' }, error: null }),
  });
  findById(env.view, 'oc-cancelar')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Cancelar ordem de compra/), /^Cancelar ordem$/)._listeners.click();
  assert.match(lastToast(env.sandbox).textContent, /Somente rascunho/, 'the server reason is shown verbatim');
  assert.equal(rpcCalls(env.supa, 'obter_ordem_compra_admin').length, 1, 'a refusal does not reload');
});

// =====================================================================
// === PERMANENT DELETION (db/96 + db/97) ==============================
// Availability comes only from acoes.excluir, decided by the server in
// public.oc_elegivel_exclusao. The screen never recomputes the rule.
// =====================================================================

const ELIGIBLE_DELETE = order({ acoes: Object.assign({}, order().acoes, { excluir: true }) });

test('D1. the delete action appears only when the server says the order is eligible', async () => {
  const yes = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE_DELETE) });
  assert.ok(findById(yes.view, 'oc-excluir'), 'offered when acoes.excluir is true');
  const no = await renderScreen({ obter_ordem_compra_admin: sequencedObter(order({ acoes: Object.assign({}, order().acoes, { excluir: false }) })) });
  assert.equal(findById(no.view, 'oc-excluir'), null, 'absent when the server withholds it');
});

test('D2. deletion names the order canonically and states exactly what disappears', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE_DELETE) });
  findById(env.view, 'oc-excluir')._listeners.click();
  const dialog = overlayByTitle(env.sandbox, /Excluir ordem de compra OC-001-1-26/);
  assert.ok(dialog, 'the confirmation names the order by its business code');
  const copy = text(dialog);
  assert.match(copy, /permanentemente/i);
  assert.match(copy, /itens/i);
  assert.match(copy, /aloca/i);
  assert.match(copy, /voltam a ficar disponíveis/i, 'states the quantities return');
  assert.match(copy, /não pode ser desfeita/i);
  assert.match(copy, /use Cancelar/i, 'points at Cancelar for a real order');
  assert.doesNotMatch(copy, /#4210/, 'never the primary key');
  assert.equal(rpcCalls(env.supa, 'excluir_ordem_compra').length, 0, 'opening performs no RPC');
});

test('D3. confirming calls the canonical writer once and returns to the list', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE_DELETE),
    excluir_ordem_compra: () => ({ data: { ok: true, codigo: 'ok', alocacoes_liberadas: 2 }, error: null }),
  });
  findById(env.view, 'oc-excluir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Excluir ordem de compra/), /^Excluir definitivamente$/)._listeners.click();
  const calls = rpcCalls(env.supa, 'excluir_ordem_compra');
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params)), { p_ordem_id: 4210 });
  assert.ok(env.navCalls.includes('#/ordens-compra'), 'the vanished detail is left for the list');
  assert.equal(allRpcNames(env.supa).filter((n) => n === 'obter_ordem_compra_admin').length, 1,
    'no reload of an entity that no longer exists');
});

test('D4. a server refusal is shown verbatim and the order stays', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(ELIGIBLE_DELETE),
    excluir_ordem_compra: () => ({ data: { ok: false, codigo: 'historico_irreversivel', erro: 'A ordem possui recebimento, lancamento de fio ou movimento de estoque e nao pode ser excluida' }, error: null }),
  });
  findById(env.view, 'oc-excluir')._listeners.click();
  await btnByText(overlayByTitle(env.sandbox, /Excluir ordem de compra/), /^Excluir definitivamente$/)._listeners.click();
  assert.match(lastToast(env.sandbox).textContent, /recebimento, lancamento de fio ou movimento/,
    'the exact server reason reaches the operator');
  assert.ok(!env.navCalls.includes('#/ordens-compra'), 'a refused deletion does not navigate away');
});

test('D5. Cancelar and Excluir remain distinct actions', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(ELIGIBLE_DELETE) });
  assert.ok(findById(env.view, 'oc-cancelar'), 'Cancelar still exists for a real order');
  assert.ok(findById(env.view, 'oc-excluir'), 'Excluir exists alongside it');
});

// =====================================================================
// E. POST-GENERATION LIFECYCLE (PURCHASE-ORDER-POST-GENERATION-
//    STABILIZATION-R1)
// =====================================================================
// db/97 froze `acoes.cancelar` to false for every status other than rascunho,
// so an EMITTED purchase order could never be cancelled from the product —
// and, because `oc_elegivel_exclusao` also refused anything with emitida_em,
// it could never be deleted either. The order was stuck forever and its
// quantities stayed booked against the Pedido's needs. db/100 makes both
// projections come from their single server-side eligibility owners; the
// screen's job is only to obey them.

const EMITTED_CANCELLABLE = order({
  status_administrativo: 'emitida', emitida_em: '2026-07-22T12:00:00Z',
  acoes: { editar_itens: false, remover_itens: false, cancelar: true, distribuir: false, emitir: false, receber: false, excluir: false },
  bloqueio_cancelamento: null, bloqueio_exclusao: 'estado_invalido',
  pode_emitir: false, bloqueio_emissao: null,
});

const CANCELLED_DELETABLE = order({
  status_administrativo: 'cancelada', emitida_em: '2026-07-22T12:00:00Z',
  cancelada_em: '2026-07-30T09:00:00Z',
  acoes: { editar_itens: false, remover_itens: false, cancelar: false, distribuir: false, emitir: false, receber: false, excluir: true },
  bloqueio_cancelamento: 'ja_cancelada', bloqueio_exclusao: null,
  pode_emitir: false, bloqueio_emissao: null,
});

test('E1. an EMITTED order offers Cancelar, and only because the server projected it', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(EMITTED_CANCELLABLE) });
  assert.ok(findById(env.view, 'oc-cancelar'),
    'the emitted order exposes Cancelar when acoes.cancelar is true');

  // The signal is the server's, not a client-side status rule: the SAME
  // emitted status with acoes.cancelar=false must hide the control.
  const denied = await renderScreen({ obter_ordem_compra_admin: sequencedObter(emitted('nao_aplicavel')) });
  assert.equal(findById(denied.view, 'oc-cancelar'), null,
    'the control disappears purely because the server said so');
});

test('E2. an EMITTED order never exposes a direct Excluir', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(EMITTED_CANCELLABLE) });
  assert.equal(findById(env.view, 'oc-excluir'), null,
    'permanent deletion of an emitted order must go through cancellation first');
});

test('E3. a CANCELLED eligible order exposes Excluir and never a repeated Cancelar', async () => {
  const env = await renderScreen({ obter_ordem_compra_admin: sequencedObter(CANCELLED_DELETABLE) });
  assert.ok(findById(env.view, 'oc-excluir'),
    'a cancelled, previously emitted order is deletable when the server says so');
  assert.equal(findById(env.view, 'oc-cancelar'), null,
    'an already-cancelled order is never offered cancellation again');
});

// ---- Provenance -----------------------------------------------------
// `obter_distribuicao_ordem_compra` was already fetched on every open of this
// screen and the result was thrown away, because nothing mounted the section
// that consumed it. It is now the source of the read-only provenance card.

const DISTRIBUICAO = {
  ok: true,
  ordem: { ordem_id: 4210, modelo: 'nativo', pedido_id: PEDIDO_1, fornecedor_id: 7, status_administrativo: 'rascunho', legado: false },
  itens: [{
    item_id: 10, material: 'poliester', cor_id: 3, cor_poliester: 'Azul Marinho', cor_nome: null,
    kg_pedido: 183, kg_alocado: 183, kg_diferenca: 0,
    alocacoes: [
      { alocacao_id: 55, necessidade_id: 31, op_id: 900, kg_alocado: 120 },
      { alocacao_id: 56, necessidade_id: 32, op_id: null, kg_alocado: 63 },
    ],
    necessidades_compativeis: [
      { necessidade_id: 31, origem_tipo: 'op', op_id: 900, kg_necessario: 200, kg_alocado: 120, kg_restante: 80 },
      { necessidade_id: 32, origem_tipo: 'pedido', op_id: null, kg_necessario: 63, kg_alocado: 63, kg_restante: 0 },
    ],
    acoes: { alocar: true, editar: true, remover: true },
  }],
  distribuicao_completa: true, pronta_para_emissao: true, pode_emitir: false,
  bloqueio_emissao: null,
};

test('E4. the provenance section is actually mounted from the distribution read model', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(order({ pedido_numero: 1, pedido_ano: 2026 })),
    obter_distribuicao_ordem_compra: () => ({ data: DISTRIBUICAO, error: null }),
  });
  const section = findById(env.view, 'oc-proveniencia');
  assert.ok(section, 'the provenance card exists in the rendered detail');

  const copy = text(section);
  assert.match(copy, /Pedido 001\/2026/, 'the Pedido identity is shown');
  assert.match(copy, /Pedido compartilhado/, 'a NULL-op allocation is attributed honestly');
  assert.match(copy, /183/, 'the item ordered quantity is shown');
  assert.match(copy, /120/, 'the original allocated quantity per origin is shown');
  assert.match(copy, /Diferença/, 'the allocation reconciliation is shown');

  // Both allocations are projected, each addressable by its own identity.
  assert.equal(findAll(section, (n) => n.getAttribute && n.getAttribute('data-alocacao-id')).length, 2);
});

test('E5. the provenance section carries no mutation control whatsoever', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(order({ pedido_numero: 1, pedido_ano: 2026 })),
    obter_distribuicao_ordem_compra: () => ({ data: DISTRIBUICAO, error: null }),
  });
  const section = findById(env.view, 'oc-proveniencia');
  assert.equal(findButtons(section).length, 0, 'zero buttons: no allocate, no remove, no synchronize');
  assert.equal(findAll(section, (n) => n.tagName === 'INPUT' || n.tagName === 'SELECT').length, 0,
    'zero inputs: supplier assignment does not live here');
  const copy = text(section);
  assert.doesNotMatch(copy, /Fase F2/i, 'the stale Phase F2 activation copy is gone');
  assert.doesNotMatch(copy, /Sincronizar/i, 'no synchronization control');
  assert.match(copy, /somente leitura/i, 'the section states its read-only nature');
});

test('E6. a cancelled order states that its origins are released history', async () => {
  const env = await renderScreen({
    obter_ordem_compra_admin: sequencedObter(
      Object.assign({}, CANCELLED_DELETABLE, { pedido_numero: 1, pedido_ano: 2026 })),
    obter_distribuicao_ordem_compra: () => ({ data: DISTRIBUICAO, error: null }),
  });
  const section = findById(env.view, 'oc-proveniencia');
  assert.ok(section, 'a cancelled order still shows its provenance — it is history, not deletion');
  assert.ok(findById(section, 'oc-proveniencia-cancelada'), 'the released-history state is declared');
  assert.match(text(section), /liberadas/i, 'the copy says the quantities were released');
});
