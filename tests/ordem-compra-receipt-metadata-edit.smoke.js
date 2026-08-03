// =====================================================================
// === tests/ordem-compra-receipt-metadata-edit.smoke.js ===============
// db/119 — administrative correction of native receipt metadata (UI layer).
//
// Proves that the Edit affordance appears only where the server allows the
// correction, that the modal opens PRE-FILLED with the current values, that
// the submitted payload carries EXACTLY the four authorized fields and no
// quantity/line/allocation/OP data, that success performs an authoritative
// reload and opens NO production-review continuation and triggers NO
// receipt/reversal, and that database IDs are never exposed on the surface.
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
  vm.runInContext(read('js/op-display.js'), sandbox, { filename: 'js/op-display.js' });
  // BACKLOG-7 phase 1: the command-type badge now goes through the canonical
  // js/badges.js owner (UI_VISUAL_CONTRACT.md 2.6) instead of a screen-local
  // colour map, so that owner is a real sandbox dependency exactly as
  // op-display.js is. index.html loads it at line 18, long before any screen.
  vm.runInContext(read('js/badges.js'), sandbox, { filename: 'js/badges.js' });
  for (const [f, s] of srcs) vm.runInContext(s, sandbox, { filename: f });
  return { sandbox, supa, ns: sandbox.RAVATEX_SCREENS.ordemCompra };
}

function walk(node, fn) { if (!node) return; fn(node); for (const c of (node.children || [])) walk(c, fn); }
function findAll(node, pred) { const out = []; walk(node, (n) => { if (pred(n)) out.push(n); }); return out; }
function findButtons(node) { return findAll(node, (n) => n.tagName === 'BUTTON'); }
function text(node) { let s = ''; walk(node, (n) => { if (n && n._text != null) s += ' ' + n._text; }); return s; }
function overlays(sandbox) { return (sandbox.document.body.children || []).filter((n) => !n._removed); }
function overlayByTitle(sandbox, re) { return overlays(sandbox).find((o) => re.test(text(o))); }
function toasts(sandbox) { return sandbox.document._toastsNode.children; }
function lastToast(sandbox) { const t = toasts(sandbox); return t[t.length - 1]; }
function rpcCalls(supa, name) { return supa._calls.filter((c) => c.op === 'rpc' && c.name === name); }
function btnByText(node, re) { return findButtons(node).find((b) => re.test(b.textContent || '')); }
function inputsIn(node) { return findAll(node, (n) => n.tagName === 'INPUT'); }

const LANC = {
  id: 800, linha_indice: 1, item_id: 7, alocacao_id: 42, op_id: 900,
  material: 'algodao', cor_id: 3, cor_poliester: null, kg: 860.1, kg_excesso: 0,
  estorno_de_id: null, kg_reversivel: 860.1, movimento_estoque: null,
};
const RECV_CMD = {
  id: 500, comando_tipo: 'recebimento', ator_tipo: 'admin',
  ocorrido_em: '2026-06-04T00:00:00+00:00', documento_ref: null,
  origem_tipo: 'historico_sem_documento', origem_ref: null, lancamentos: [LANC],
};
const ESTORNO_CMD = {
  id: 501, comando_tipo: 'estorno', ator_tipo: 'admin',
  ocorrido_em: '2026-06-11T00:00:00+00:00', documento_ref: null,
  origem_tipo: 'estorno', origem_ref: null, lancamentos: [],
};

function projection(overrides) {
  return Object.assign({
    ok: true, codigo: 'ok', ordem_compra_id: 100,
    status_administrativo: 'emitida', status_aceite: 'nao_aplicavel', ator_tipo: 'admin',
    acoes: { receber: true, estornar: true },
    itens: [{
      item_id: 7, material: 'algodao', cor_id: 3, cor_poliester: null,
      kg_pedido: 860.1, kg_recebido: 860.1, kg_restante: 0, kg_excesso: 0,
      alocacoes: [{ alocacao_id: 42, op_id: 900, kg_alocado: 860.1, kg_recebido: 860.1, kg_restante: 0 }],
    }],
    comandos: [RECV_CMD],
  }, overrides || {});
}

function setup(rpcImpl, hist) {
  const env = makeSandbox(rpcImpl);
  const reloadCalls = [];
  const state = {
    ordem: { modelo: 'nativo', status_administrativo: 'emitida' },
    receiptHistory: hist || projection(),
    opIdentidades: null,
  };
  async function reload() { reloadCalls.push(1); }
  const handlers = env.ns.createReceiptEvents({ state, reload, ordemId: 100 });
  return Object.assign(env, { state, reload, reloadCalls, handlers });
}

// ---- Data layer ------------------------------------------------------

test('corrigirMetadadosRecebimento: sends exactly the four authorized fields', async () => {
  const env = setup();
  const supa = env.supa;
  const res = await env.ns.corrigirMetadadosRecebimento({
    recebimentoId: 500, ocorridoEm: '2026-06-05',
    documentoRef: 'NF 1234', origemTipo: 'nota_fiscal', origemRef: 'serie B',
  });
  const calls = rpcCalls(supa, 'corrigir_metadados_recebimento_ordem_compra');
  assert.equal(calls.length, 1, 'exactly one RPC call');
  const args = calls[0].params;
  assert.deepEqual(Object.keys(args).sort(), [
    'p_documento_ref', 'p_ocorrido_em', 'p_origem_ref', 'p_origem_tipo', 'p_recebimento_id',
  ], 'payload carries ONLY the receipt id plus the four metadata fields');
  assert.equal(args.p_recebimento_id, 500);
  assert.equal(args.p_ocorrido_em, '2026-06-05');
  assert.equal(args.p_documento_ref, 'NF 1234');
  assert.equal(args.p_origem_tipo, 'nota_fiscal');
  assert.equal(args.p_origem_ref, 'serie B');
  // No quantity, line, allocation, excess or OP data may travel.
  const blob = JSON.stringify(args);
  for (const forbidden of ['kg', 'linha', 'alocacao', 'excesso', 'op_id', 'destino']) {
    assert.ok(!blob.includes(forbidden), `payload must not carry "${forbidden}"`);
  }
  assert.equal(res.outcome, 'rejected'); // default double returns no data.ok
});

test('corrigirMetadadosRecebimento: empty optional fields travel as null, not ""', async () => {
  const env = setup();
  await env.ns.corrigirMetadadosRecebimento({
    recebimentoId: 500, ocorridoEm: '2026-06-05', documentoRef: '', origemTipo: 'nf', origemRef: '',
  });
  const args = rpcCalls(env.supa, 'corrigir_metadados_recebimento_ordem_compra')[0].params;
  assert.equal(args.p_documento_ref, null);
  assert.equal(args.p_origem_ref, null);
});

// ---- Render layer ----------------------------------------------------

test('render: admin gets an Edit action on a receipt and NOT on a reversal', () => {
  const env = setup();
  const hist = projection({ comandos: [RECV_CMD, ESTORNO_CMD] });
  const calls = [];
  const node = env.ns.renderReceiptSection(
    { ordem: { modelo: 'nativo', status_administrativo: 'emitida' }, receiptHistory: hist },
    { editarMetadadosRecebimento: (c) => calls.push(c), estornarLancamento() {} },
  );
  const editButtons = findButtons(node).filter((b) => /Editar dados do recebimento/.test(b.getAttribute('title') || ''));
  assert.equal(editButtons.length, 1, 'exactly one Edit action — the receipt, never the reversal');
  editButtons[0]._listeners.click();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 500, 'the Edit action carries the receipt it belongs to');
});

test('render: a non-admin actor gets NO Edit action', () => {
  const env = setup();
  const hist = projection({ ator_tipo: 'fornecedor', comandos: [RECV_CMD] });
  const node = env.ns.renderReceiptSection(
    { ordem: { modelo: 'nativo', status_administrativo: 'emitida' }, receiptHistory: hist },
    { editarMetadadosRecebimento() {}, estornarLancamento() {} },
  );
  const editButtons = findButtons(node).filter((b) => /Editar dados do recebimento/.test(b.getAttribute('title') || ''));
  assert.equal(editButtons.length, 0, 'a fornecedor never sees the correction affordance');
});

// ---- Events layer ----------------------------------------------------

test('edit modal opens PRE-FILLED with the current values and exposes no database id', () => {
  const env = setup();
  env.handlers.editarMetadadosRecebimento(RECV_CMD);
  const modal = overlayByTitle(env.sandbox, /Editar dados do recebimento/);
  assert.ok(modal, 'edit modal is open');
  const values = inputsIn(modal).map((i) => i.value);
  assert.ok(values.includes('2026-06-04'), 'date pre-filled from ocorrido_em');
  assert.ok(values.includes('historico_sem_documento'), 'origin type pre-filled');
  assert.ok(btnByText(modal, /^Salvar$/), 'the save label is exactly "Salvar"');
  // Do not expose database IDs.
  const shown = text(modal);
  assert.ok(!/\b500\b/.test(shown), 'the receipt primary key is never rendered');
  assert.ok(!/\b800\b/.test(shown), 'the lancamento primary key is never rendered');
});

test('edit success: authoritative reload, no continuation modal, no receipt/reversal RPC', async () => {
  const env = setup({
    corrigir_metadados_recebimento_ordem_compra: () => ({
      data: { ok: true, codigo: 'ok', recebimento_id: 500, alterado: true }, error: null, status: 200,
    }),
  });
  env.handlers.editarMetadadosRecebimento(RECV_CMD);
  const modal = overlayByTitle(env.sandbox, /Editar dados do recebimento/);
  const inputs = inputsIn(modal);
  inputs[0].value = '2026-06-05';
  inputs[2].value = 'nota_fiscal';
  await btnByText(modal, /^Salvar$/)._listeners.click();

  assert.equal(env.reloadCalls.length, 1, 'exactly one authoritative reload');
  assert.equal(rpcCalls(env.supa, 'registrar_recebimento_ordem_compra').length, 0, 'no receipt was created');
  assert.equal(rpcCalls(env.supa, 'estornar_recebimento_ordem_compra').length, 0, 'no reversal was created');
  assert.ok(!overlayByTitle(env.sandbox, /Recebimento registrado/), 'no production-review continuation modal');
  assert.ok(!overlayByTitle(env.sandbox, /Editar dados do recebimento/), 'the edit modal closed on success');
  assert.match(text(lastToast(env.sandbox)), /atualizados/i);
});

test('edit validation: a missing date or origin type is refused client-side, modal stays open', async () => {
  const env = setup();
  env.handlers.editarMetadadosRecebimento(RECV_CMD);
  const modal = overlayByTitle(env.sandbox, /Editar dados do recebimento/);
  const inputs = inputsIn(modal);
  inputs[0].value = '';
  assert.equal(await btnByText(modal, /^Salvar$/)._listeners.click(), undefined);
  assert.equal(rpcCalls(env.supa, 'corrigir_metadados_recebimento_ordem_compra').length, 0, 'nothing was sent');
  assert.ok(overlayByTitle(env.sandbox, /Editar dados do recebimento/), 'modal stays open');

  inputs[0].value = '2026-06-05';
  inputs[2].value = '   ';
  await btnByText(modal, /^Salvar$/)._listeners.click();
  assert.equal(rpcCalls(env.supa, 'corrigir_metadados_recebimento_ordem_compra').length, 0, 'blank origin type not sent');
});

test('edit rejection: server refusal is surfaced and the modal stays open with no reload', async () => {
  const env = setup({
    corrigir_metadados_recebimento_ordem_compra: () => ({
      data: { ok: false, codigo: 'sem_permissao', erro: 'x' }, error: null, status: 200,
    }),
  });
  env.handlers.editarMetadadosRecebimento(RECV_CMD);
  const modal = overlayByTitle(env.sandbox, /Editar dados do recebimento/);
  await btnByText(modal, /^Salvar$/)._listeners.click();
  assert.equal(env.reloadCalls.length, 0, 'a refusal never reloads');
  assert.ok(overlayByTitle(env.sandbox, /Editar dados do recebimento/), 'modal stays open on refusal');
  assert.match(text(lastToast(env.sandbox)), /permiss/i);
});

test('edit is refused for a reversal command and for a non-admin actor', () => {
  const env = setup();
  env.handlers.editarMetadadosRecebimento(ESTORNO_CMD);
  assert.ok(!overlayByTitle(env.sandbox, /Editar dados do recebimento/), 'no modal for a reversal');
  assert.match(text(lastToast(env.sandbox)), /indispon/i);

  const env2 = setup(undefined, projection({ ator_tipo: 'fornecedor' }));
  env2.handlers.editarMetadadosRecebimento(RECV_CMD);
  assert.ok(!overlayByTitle(env2.sandbox, /Editar dados do recebimento/), 'no modal for a fornecedor');
});
