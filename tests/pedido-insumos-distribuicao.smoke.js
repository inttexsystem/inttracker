// tests/pedido-insumos-distribuicao.smoke.js
//
// PURCHASE-PLANNING-REFOUNDATION-R1 — the Planejamento de compras screen.
//
// The subject of this file changed with the phase. Until db/98 the screen was
// a per-need modal that asked for the purchase-order number and whose save
// created the document; the tests here used to prove exactly that flow. db/99
// split the two stages, so what must now be proved is the opposite: planning
// writes no document and asks for no number, and the number appears exactly
// once — in the generation confirmation, already suggested and still editable.

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
const migration = fs.readFileSync(path.join(root, 'db/99_planejamento_compra_refoundation.sql'), 'utf8');

// =====================================================================
// 1. OWNERSHIP AND ROUTING
// =====================================================================

test('the planning screen still owns the Pedido / Insumos route', () => {
  assert.match(router, /#\\\/pedidos\\\/.+\\\/insumos/);
  assert.match(ui, /screenPedidoInsumosDistribuicao/);
});

test('order and OP screens still do not own purchasing origination', () => {
  assert.doesNotMatch(orderRender, /oc-nova|oc-add-item/);
  assert.doesNotMatch(orderEvents, /definir_item_ordem_compra|alocar_necessidade_compra_fio|remover_alocacao_compra_fio/);
  assert.match(op, /op-purchase-assignment-readonly/);
  assert.match(op, /op-abrir-distribuicao-pedido/);
});

// =====================================================================
// 2. THE NEW FRONTEND NEVER CALLS THE WITHDRAWN WRITER
// =====================================================================

test('the screen calls only the canonical db/99 planning and generation RPCs', () => {
  const called = [...ui.matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  const viaHelper = [...ui.matchAll(/callRpc\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  const all = [...new Set(called.concat(viaHelper))].sort();
  assert.deepEqual(all, [
    'aplicar_planejamento_rapido',
    'gerar_ordem_compra_do_planejamento',
    'obter_planejamento_compra_pedido',
    'substituir_planejamento_compra_necessidade',
    'sugerir_codigo_ordem_compra',
  ]);
  // The per-row writer survives in db/99 for the stale-client path, but this
  // screen no longer owns a card save through it.
  assert.doesNotMatch(ui, /callRpc\(\s*'definir_planejamento_compra'/);
  assert.match(migration, /FUNCTION public\.definir_planejamento_compra\(/);
});

test('the five-argument writer is never invoked by the new frontend', () => {
  // It may be NAMED in the explanatory header — that is documentation of what
  // was withdrawn. What must not exist is a call, or its withdrawn arguments.
  assert.doesNotMatch(ui, /rpc\(\s*'definir_alocacao_necessidade_compra_fio'/);
  assert.doesNotMatch(ui, /callRpc\(\s*'definir_alocacao_necessidade_compra_fio'/);
  assert.doesNotMatch(ui, /p_codigo_ordem/);
  assert.doesNotMatch(ui, /p_kg_alocado/);
});

test('the compatibility wrapper exists in db/99 and cannot create a document', () => {
  assert.match(migration, /compatibilidade_planejamento/);
  const wrapper = migration.slice(migration.indexOf('-- 10. Compatibilidade de cliente antigo'));
  assert.match(wrapper, /public\.definir_planejamento_compra\(/);
  assert.doesNotMatch(wrapper, /INSERT INTO public\.ordem_compra/);
  assert.doesNotMatch(wrapper, /proximo_seq_identidade/);
});

// =====================================================================
// 3. THE NUMBER LEFT THE PLANNING STAGE
// =====================================================================

test('planning asks for no purchase-order number anywhere', () => {
  const planning = ui.slice(0, ui.indexOf('async function openGenerationConfirm'));
  assert.doesNotMatch(planning, /Número do Pedido de Compra/);
  assert.doesNotMatch(planning, /Número da ordem de compra/);
  assert.doesNotMatch(planning, /codigo_sugerido/);
});

test('the number appears once, pre-filled from the server suggestion and editable', () => {
  const confirm = ui.slice(ui.indexOf('async function openGenerationConfirm'));
  assert.match(confirm, /sugerir_codigo_ordem_compra/);
  // Pre-filled: the input is constructed FROM the suggestion.
  assert.match(confirm, /window\.textInput\(\{\s*value:\s*suggestion\.codigo_sugerido\s*\}\)/);
  // Editable: the confirmation sends the live field value, not the suggestion.
  assert.match(confirm, /p_codigo:\s*String\(codeInput\.value/);
  assert.doesNotMatch(confirm, /codeInput\.setAttribute\('readonly'/);
  assert.doesNotMatch(confirm, /codeInput\.disabled\s*=\s*true/);
});

test('a stale suggestion refreshes the field and keeps the confirmation open', () => {
  const confirm = ui.slice(ui.indexOf('async function openGenerationConfirm'));
  assert.match(confirm, /sugestao_desatualizada/);
  assert.match(confirm, /codeInput\.value\s*=\s*result\.codigo_sugerido/);
  assert.match(confirm, /return false/);
});

// =====================================================================
// 4. EXECUTABLE COVERAGE OF THE REAL MODULE
// =====================================================================

function loadModule() {
  function makeEl(tag, attrs) {
    const node = { tagName: tag, attrs: attrs || {}, children: [] };
    node.appendChild = (child) => { if (child != null) node.children.push(child); return child; };
    node.replaceChildren = (...kids) => { node.children = kids.filter((k) => k != null); };
    node.listeners = {};
    node.addEventListener = (evt, fn) => { (node.listeners[evt] = node.listeners[evt] || []).push(fn); };
    node.setAttribute = (k, v) => { node.attrs[k] = v; };
    return node;
  }
  const win = {
    el(tag, attrs, ...kids) {
      const node = makeEl(tag, attrs);
      kids.flat().forEach((k) => node.appendChild(k));
      return node;
    },
    fmtKg: (n) => (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg'),
    TRUNCATE_CELL_STYLE: '',
    crypto: { randomUUID: () => 'fixed-command-key' },
  };
  vm.runInNewContext(ui, { window: win });
  return win.RAVATEX_SCREENS.pedidoInsumosDistribuicao;
}

const api = loadModule();

function need(overrides) {
  return Object.assign({
    necessidade_id: 101,
    origem_tipo: 'pedido',
    material: 'poliester',
    cor_poliester: 'PRETO',
    kg_necessario: 100,
    kg_planejado: 0,
    kg_restante: 100,
    situacao: 'pendente',
    planejamentos: [],
  }, overrides);
}

test('the distributable balance mirrors the db/99 server invariant', () => {
  assert.equal(api.planningBalance(need()), 100);

  const partial = need({
    planejamentos: [{ planejamento_id: 1, fornecedor_id: 7, kg_planejado: 60 }],
  });
  assert.equal(api.planningBalance(partial), 40);

  // Re-editing an existing row returns that row's quantity to the balance,
  // exactly as `kg_necessario - (total - anterior)` does on the server.
  assert.equal(api.planningBalance(partial, 1), 100);

  const full = need({
    planejamentos: [
      { planejamento_id: 1, fornecedor_id: 7, kg_planejado: 60 },
      { planejamento_id: 2, fornecedor_id: 8, kg_planejado: 40 },
    ],
  });
  assert.equal(api.planningBalance(full), 0);
});

test('binary-float residue never reaches the field (NUMERIC(12,3) quantisation)', () => {
  const residue = need({
    kg_necessario: 12.5,
    planejamentos: [{ planejamento_id: 1, fornecedor_id: 7, kg_planejado: 3.2 }],
  });
  // 12.5 - 3.2 === 9.299999999999999 in binary floating point.
  assert.equal(api.planningBalance(residue), 9.3);
});

test('a supplier already holding a row on the need is not offered twice', () => {
  const partial = need({
    planejamentos: [{ planejamento_id: 1, fornecedor_id: 7, kg_planejado: 60 }],
  });
  // The module runs in its own vm realm, so its object literals do not share
  // this realm's Object.prototype — compare keys, not object identity.
  assert.deepEqual(Object.keys(api.suppliersAlreadyUsed(partial)), ['7']);
  // ...unless it is the row being re-edited, which must keep its own value.
  assert.deepEqual(Object.keys(api.suppliersAlreadyUsed(partial, 1)), []);
});

test('supplier compatibility is the material, not the colour', () => {
  const suppliers = [
    { fornecedor_id: 1, nome: 'Algodoeira', tipo: 'fio_algodao' },
    { fornecedor_id: 2, nome: 'Poliester SA', tipo: 'fio_poliester' },
  ];
  assert.deepEqual(
    api.compatibleSuppliers(need({ material: 'poliester' }), suppliers).map((s) => s.fornecedor_id),
    [2],
  );
  assert.deepEqual(
    api.compatibleSuppliers(need({ material: 'algodao' }), suppliers).map((s) => s.fornecedor_id),
    [1],
  );
});

test('both OP and shared-Pedido provenance render without an OP selector', () => {
  assert.equal(api.needOrigin(need({ origem_tipo: 'pedido' })), 'Pedido compartilhado');
  assert.equal(
    api.needOrigin(need({ origem_tipo: 'op', op_identidade: 'OP-T001-1-26' })),
    'OP-T001-1-26',
  );
  assert.doesNotMatch(ui, /Selecione a OP/);
});

// =====================================================================
// 5. STATUS — DISTINGUISHABLE WITHOUT COLOUR
// =====================================================================

test('pending and partial share a pill family, so the label must differ', () => {
  assert.equal(api.SITUACAO_LABEL.pendente, 'Pendente');
  assert.equal(api.SITUACAO_LABEL.parcial, 'Parcialmente distribuído');
  assert.equal(api.SITUACAO_LABEL.distribuido, 'Distribuído');
  // Both resolve through js/badges.js to `caution`; §2.6 forbids colour alone,
  // so the numeric line below is the load-bearing distinction.
  assert.equal(api.SITUACAO_PILL_STATE.pendente, 'pendente');
  assert.equal(api.SITUACAO_PILL_STATE.parcial, 'parcial');
  assert.equal(api.SITUACAO_PILL_STATE.distribuido, 'concluido');
  assert.match(ui, /'Faltam ' \+ kg\(remaining\)/);
});

test('ordering is pending-first and is owned by the server projection', () => {
  // The screen consumes the server order; it must not re-sort by eye.
  assert.doesNotMatch(ui, /necessidades[^\n]*\.sort\(/);
  assert.match(migration, /'ordenacao',/);
  assert.match(migration, /ORDER BY linha->>'ordenacao'/);
});

// =====================================================================
// 6. THE INLINE STATE CONTRACT
// =====================================================================

test('the card save is ONE atomic RPC, never a per-row loop', () => {
  const save = ui.slice(ui.indexOf('async function submitDraft'));
  const body = save.slice(0, save.indexOf('\n    }\n'));
  // Exactly one write call, and it is the atomic replacement owner.
  const calls = [...body.matchAll(/callRpc\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(calls, ['substituir_planejamento_compra_necessidade']);
  // The whole live set travels in one payload.
  assert.match(body, /p_linhas:\s*filled\.map/);
  // No loop issues writes any more.
  assert.doesNotMatch(body, /for \([^)]*\)\s*\{[\s\S]{0,200}await callRpc/);
  assert.doesNotMatch(ui, /savePlanningRow/);
});

test('there is no planning modal; only quick planning and the final confirmation', () => {
  // Exactly two modals exist on this screen, and neither is a per-need
  // planning form: quick planning is a bounded bulk action and the other is
  // the final generation confirmation.
  const modalCalls = [...ui.matchAll(/window\.modal\(\{/g)];
  assert.equal(modalCalls.length, 2);
  const titles = modalCalls
    .map((m) => /title:\s*'([^']+)'/.exec(ui.slice(m.index, m.index + 200)))
    .map((m) => m[1])
    .sort();
  assert.deepEqual(titles, ['Distribuição rápida', 'Gerar Pedido de Compra']);
});

test('edit mode is never open by default', () => {
  assert.match(ui, /editing:\s*\{\}/);
  assert.match(ui, /state\.editing\[String\(need\.necessidade_id\)\] = true;/);
});

// =====================================================================
// 6b. RENDERED COMPONENT TREE
//
// Action PLACEMENT cannot be proved by searching the source: a button
// mentioned anywhere in the file satisfies a regex regardless of which
// container it ends up in. These tests run the real screen against a fake
// DOM and walk the tree the module actually builds.
// =====================================================================

function renderScreen(needs) {
  const built = [];
  function makeEl(tag, attrs, kids) {
    const node = {
      tagName: tag,
      attrs: attrs || {},
      children: [],
      text: '',
      listeners: {},
      appendChild(c) { if (c != null && c !== false) node.children.push(c); return c; },
      replaceChildren(...cs) { node.children = cs.flat().filter((c) => c != null && c !== false); },
      addEventListener(e, fn) { (node.listeners[e] = node.listeners[e] || []).push(fn); },
      setAttribute(k, v) { node.attrs[k] = v; },
      getAttribute(k) { return node.attrs[k]; },
    };
    (kids || []).flat().forEach((k) => {
      if (k == null || k === false) return;
      if (typeof k === 'string') node.text += k; else node.children.push(k);
    });
    built.push(node);
    return node;
  }

  const win = {
    el: (tag, attrs, ...kids) => makeEl(tag, attrs, kids),
    fmtKg: (n) => (n == null ? '—' : Number(n).toFixed(3).replace('.', ',') + ' kg'),
    TRUNCATE_CELL_STYLE: '',
    crypto: { randomUUID: () => 'k' },
    ADMIN_MENU: [],
    shellLayout: (menu, node) => node,
    navigate() {},
    selectInput: (o) => makeEl('rv-select', { value: o.value, 'data-options': (o.options || []).length }),
    textInput: (o) => makeEl('rv-input', { value: o.value, type: o.type || 'text' }),
    formField: ({ label, input }) => makeEl('rv-field', { label }, [input]),
    actionButton: ({ title }) => makeEl('rv-action', { title }),
    checkboxInput: (o) => makeEl('rv-checkbox', { 'aria-label': o.ariaLabel, disabled: !!o.disabled }),
    modal(cfg) { win.__modal = cfg; },
    rvStatusPill: (label) => makeEl('rv-pill', {}, [label]),
    rvClassificationBadge: (label) => makeEl('rv-badge', {}, [label]),
    supa: {
      rpc: async (name) => {
        if (name === 'obter_planejamento_compra_pedido') {
          return {
            data: {
              ok: true,
              necessidades: needs,
              fornecedores: [
                { fornecedor_id: 1, nome: 'Algodoeira', tipo: 'fio_algodao' },
                { fornecedor_id: 2, nome: 'Algodoeira 2', tipo: 'fio_algodao' },
              ],
            },
            error: null,
          };
        }
        return { data: { ok: true }, error: null };
      },
    },
  };
  vm.runInNewContext(ui, { window: win });
  return { win, built };
}

// Collect the visible label text of a subtree.
function textOf(node) {
  if (!node || typeof node !== 'object') return '';
  let out = node.text || '';
  for (const c of node.children || []) out += ' ' + textOf(c);
  return out.trim();
}
function findAll(node, pred, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (pred(node)) acc.push(node);
  for (const c of node.children || []) findAll(c, pred, acc);
  return acc;
}
const isZeroRow = (n) => n.attrs && n.attrs['data-rv-planning-row-zero'] !== undefined;
const isRow = (n) => n.attrs && n.attrs['data-rv-planning-row'] !== undefined;
const isCard = (n) => n.attrs && n.attrs['data-necessidade-id'] !== undefined;
const isFooter = (n) => n.attrs && typeof n.attrs.style === 'string'
  && n.attrs.style.includes('border-top:1px solid var(--rv-border-soft)')
  && n.attrs.style.includes('justify-content:flex-end');

function needFixture(over) {
  return Object.assign({
    necessidade_id: 1, origem_tipo: 'pedido', material: 'algodao', cor_nome: 'CRU',
    kg_necessario: 1000, kg_planejado: 0, kg_restante: 1000, kg_gerado: 0,
    situacao: 'pendente', planejamentos: [],
  }, over);
}

async function screenFor(needs) {
  const { win } = renderScreen(needs);
  const tree = await win.screenPedidoInsumosDistribuicao('11111111-1111-4111-8111-111111111111');
  return { win, tree, card: findAll(tree, isCard)[0] };
}

test('D1. the zero-state row itself carries supplier, quantity and Distribuir', async () => {
  const { card } = await screenFor([needFixture()]);
  const zero = findAll(card, isZeroRow);
  assert.equal(zero.length, 1, 'exactly one zero-state inline row');

  const kinds = zero[0].children.map((c) => c.tagName);
  assert.ok(kinds.includes('rv-select'), 'supplier select is IN the row');
  assert.ok(kinds.includes('rv-input'), 'quantity input is IN the row');
  assert.match(textOf(zero[0]), /Distribuir/, 'Distribuir is IN the row');

  // ...and Distribuir is NOT in the card footer.
  const footers = findAll(card, isFooter);
  for (const f of footers) {
    assert.doesNotMatch(textOf(f), /Distribuir/, 'Distribuir must not sit in the card footer');
  }
});

test('D2. Adicionar fornecedor stays an external footer action', async () => {
  const { card } = await screenFor([needFixture()]);
  const footers = findAll(card, isFooter);
  assert.equal(footers.length, 1);
  assert.match(textOf(footers[0]), /Adicionar fornecedor/);
  // It is not inside any planning row.
  for (const row of findAll(card, isRow)) {
    assert.doesNotMatch(textOf(row), /Adicionar fornecedor/);
  }
});

test('D3. generated rows stay visible, and are never inputs', async () => {
  const need = needFixture({
    kg_planejado: 400, kg_restante: 600, kg_gerado: 400, situacao: 'parcial',
    planejamentos: [{
      planejamento_id: 9, fornecedor_id: 1, fornecedor_nome: 'Algodoeira',
      kg_planejado: 400, gerado: true, ordem_compra_id: 77, ordem_identidade: 'OC-007-1-26',
    }],
  });
  const { card } = await screenFor([need]);
  // Visible in the saved (non-edit) view...
  assert.match(textOf(card), /Já comprado/);
  assert.match(textOf(card), /Algodoeira/);
  assert.match(textOf(card), /OC-007-1-26/);
  // ...and rendered as read-only: the generated row is not an editable row.
  const editable = findAll(card, isRow).filter((r) =>
    r.children.some((c) => c.tagName === 'rv-select'));
  assert.equal(editable.length, 0, 'a generated row must never become an input');
});

test('D4. only generated rows + remaining balance offers a real distribute action', async () => {
  const need = needFixture({
    kg_planejado: 400, kg_restante: 600, kg_gerado: 400, situacao: 'parcial',
    planejamentos: [{
      planejamento_id: 9, fornecedor_id: 1, fornecedor_nome: 'Algodoeira',
      kg_planejado: 400, gerado: true, ordem_compra_id: 77, ordem_identidade: 'OC-007-1-26',
    }],
  });
  const { card } = await screenFor([need]);
  const footer = findAll(card, isFooter)[0];
  assert.match(textOf(footer), /Distribuir saldo restante/);
  // "Alterar distribuição" would be a lie: there is no live row to alter.
  assert.doesNotMatch(textOf(footer), /Alterar distribuição/);
});

test('D5. no editable row and no balance means no misleading action at all', async () => {
  const need = needFixture({
    kg_planejado: 1000, kg_restante: 0, kg_gerado: 1000, situacao: 'distribuido',
    planejamentos: [{
      planejamento_id: 9, fornecedor_id: 1, fornecedor_nome: 'Algodoeira',
      kg_planejado: 1000, gerado: true, ordem_compra_id: 77, ordem_identidade: 'OC-007-1-26',
    }],
  });
  const { card } = await screenFor([need]);
  assert.equal(findAll(card, isFooter).length, 0, 'no footer when nothing is actionable');
  assert.doesNotMatch(textOf(card), /Alterar distribuição/);
  assert.doesNotMatch(textOf(card), /Distribuir saldo restante/);
});

test('D6. a live row is what enables Alterar distribuição', async () => {
  const need = needFixture({
    kg_planejado: 300, kg_restante: 700, situacao: 'parcial',
    planejamentos: [{
      planejamento_id: 5, fornecedor_id: 1, fornecedor_nome: 'Algodoeira',
      kg_planejado: 300, gerado: false,
    }],
  });
  const { card } = await screenFor([need]);
  const footer = findAll(card, isFooter)[0];
  assert.match(textOf(footer), /Alterar distribuição/);
  assert.doesNotMatch(textOf(footer), /Distribuir saldo restante/);
  // Saved live rows render read-only until the operator opts into editing.
  assert.equal(findAll(card, isZeroRow).length, 0);
});

test('D7. quick planning exposes both modes, exact-pending selected by default', async () => {
  const { win } = await screenFor([needFixture()]);
  const api2 = win.RAVATEX_SCREENS.pedidoInsumosDistribuicao;
  assert.ok(api2, 'module namespace present');
  // Drive the real header action that opens the modal.
  const built = [];
  findAll(await win.screenPedidoInsumosDistribuicao('11111111-1111-4111-8111-111111111111'),
    (n) => { built.push(n); return false; });
  const quick = built.find((n) => n.tagName === 'button' && textOf(n) === 'Distribuição rápida');
  assert.ok(quick, 'the Distribuição rápida action exists');
  quick.attrs.onclick();
  const cfg = win.__modal;
  assert.ok(cfg, 'quick planning opened a bounded action modal');
  const modes = findAll(cfg.body, (n) => n.attrs && n.attrs['data-rv-quick-mode'] !== undefined);
  assert.deepEqual(modes.map((m) => m.attrs['data-rv-quick-mode']), ['exato', 'ajustado']);
  assert.equal(modes[0].attrs['aria-pressed'], 'true', 'exact-pending is the default');
  assert.equal(modes[1].attrs['aria-pressed'], 'false');
  assert.match(textOf(modes[0]), /saldo exato/);
  assert.match(textOf(modes[1]), /quantidade por necessidade/);
});

// =====================================================================
// 7. GENERATION SELECTION
// =====================================================================

test('the first selected row fixes the supplier and the rest state their reason', () => {
  assert.match(ui, /function recomputeLock/);
  assert.match(ui, /Já há um fornecedor selecionado nesta geração/);
  assert.match(ui, /disabled: !!blockedReason/);
  // A generated row is never selectable for a second document.
  assert.match(ui, /state\.selecting && !row\.gerado/);
});

test('the confirmation shows supplier, needs, quantities and a total', () => {
  const confirm = ui.slice(ui.indexOf('async function openGenerationConfirm'));
  assert.match(confirm, /supplierName/);
  assert.match(confirm, /'Total'/);
  assert.match(confirm, /rv-fs-summary-total/);
});

// =====================================================================
// 8. COPY AND VISUAL CONTRACT
// =====================================================================

test('the ratified screen name and subtitle are the ones rendered', () => {
  assert.match(ui, /'Planejamento de compras'/);
  assert.match(
    ui,
    /'Defina qual fornecedor atenderá cada necessidade do Pedido\. Os pedidos de compra serão gerados depois\.'/,
  );
  assert.match(ui, /Pedido de Compra/);
});

test('the screen declares no literal colour and no Tailwind colour utility', () => {
  assert.doesNotMatch(ui, /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/);
  assert.doesNotMatch(ui, /bg-white|bg-gray-\d|text-gray-\d|bg-blue-\d|text-blue-\d|bg-red-\d|text-red-\d|bg-green-\d/);
});

test('geometry and typography resolve through tokens only', () => {
  for (const token of [
    '--rv-radius', '--rv-surface', '--rv-border', '--rv-pad-card',
    '--rv-h-primary', '--rv-h-default', '--rv-fs-title', '--rv-fs-body',
    '--rv-fs-label', '--rv-text-tertiary', '--rv-brand',
  ]) {
    assert.ok(ui.includes(token), `missing token reference: ${token}`);
  }
  // Pill radius never dresses a control (§5 D6.1).
  assert.doesNotMatch(ui, /--rv-radius-pill/);
});

test('the screen consumes canonical shared owners rather than local primitives', () => {
  for (const owner of [
    'window.selectInput', 'window.textInput', 'window.formField',
    'window.actionButton', 'window.checkboxInput', 'window.modal',
    'window.rvStatusPill', 'window.rvClassificationBadge', 'window.shellLayout',
  ]) {
    assert.ok(ui.includes(owner), `missing canonical owner: ${owner}`);
  }
  // Native select is forbidden on product surfaces (§2.3).
  assert.doesNotMatch(ui, /el\('select'/);
});

// =====================================================================
// 9. ERROR VOCABULARY
// =====================================================================

test('every db/99 refusal code has operator-facing wording', () => {
  // `(?<!>>)` skips `v_elegivel->>'codigo', 'erro'`, where the captured token
  // is the NEXT key of the object rather than a refusal code.
  const returned = [...migration.matchAll(/(?<!->>)'codigo',\s*'([a-z_]+)'/g)]
    .map((m) => m[1])
    .filter((c) => c !== 'ok');
  const uncovered = [...new Set(returned)].filter(
    (c) => api.errorText(c) === 'Não foi possível concluir a operação.',
  );
  assert.deepEqual(uncovered, [], `db/99 codes with no wording: ${uncovered.join(', ')}`);
  assert.ok(new Set(returned).size >= 15, 'the migration should expose a real refusal vocabulary');
});

test('an unknown code still degrades to an honest sentence', () => {
  assert.equal(api.errorText('coisa_nova'), 'Não foi possível concluir a operação.');
  assert.equal(api.errorText('coisa_nova', 'Servidor indisponível.'), 'Servidor indisponível.');
});
