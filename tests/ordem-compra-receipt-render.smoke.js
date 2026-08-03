// =====================================================================
// === tests/ordem-compra-receipt-render.smoke.js ======================
// PHASE-C4 (OC-C4-ADMIN-001) — render smokes for the persistent
// "Recebimentos" section. VM-loads js/ui.js + js/screens/op-form-helpers.js
// (window.fmtKg) + js/screens/ordem-compra-receipt-render.js and inspects the
// DOM tree returned by ns.renderReceiptSection(state, handlers).
//
// Proves, per contract §7/§13/§15: the section renders/absents per the
// actor/state matrix (legacy, native-draft, emitida-receivable, emitida-
// non-receivable); honest loading / empty / error states; golden-rule
// numeric header alignment; NULL-op / Pedido-origin allocations render as a
// first-class "Pedido (compartilhada)" (no fabricated OP); and the row-level
// reversal button's §8.1 guards, gated strictly by the server `acoes`/
// kg_reversivel model.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const uiSrc = read('js/ui.js');
const helpersSrc = read('js/screens/op-form-helpers.js');
const renderSrc = read('js/screens/ordem-compra-receipt-render.js');

function makeSandbox() {
  const document = createDocument();
  const sandbox = { document, console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: dono central da identidade de OP.
  // Dependencia real do sandbox: os consumidores nao tem fallback proprio.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'op-display.js'), 'utf8'), sandbox, { filename: 'js/op-display.js' });
  // BACKLOG-7 phase 1: the command-type badge now goes through the canonical
  // js/badges.js owner (UI_VISUAL_CONTRACT.md 2.6) instead of a screen-local
  // colour map, so that owner is a real sandbox dependency exactly as
  // op-display.js is. index.html loads it at line 18, long before any screen.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'badges.js'), 'utf8'), sandbox, { filename: 'js/badges.js' });
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(helpersSrc, sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(renderSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-render.js' });
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
function findAll(node, pred) { const out = []; walk(node, (n) => { if (pred(n)) out.push(n); }); return out; }
function findButtons(node) { return findAll(node, (n) => n.tagName === 'BUTTON'); }
function text(node) { let s = ''; walk(node, (n) => { if (n && n._text != null) s += ' ' + n._text; }); return s; }
function ths(node) { return findAll(node, (n) => n.tagName === 'TH'); }
function thByText(node, label) { return ths(node).find((t) => (t.textContent || '').trim() === label); }

function projection(overrides) {
  return Object.assign({
    ok: true, codigo: 'ok', ordem_compra_id: 100,
    status_administrativo: 'emitida', status_aceite: 'nao_aplicavel', status_recebimento: 'parcial',
    ator_tipo: 'admin',
    acoes: { receber: true, estornar: true },
    itens: [{
      item_id: 7, material: 'poliester', cor_id: 3, cor_poliester: 'Azul',
      kg_pedido: 100, kg_recebido: 20, kg_restante: 80, kg_excesso: 2,
      alocacoes: [
        { alocacao_id: 42, op_id: 900, kg_alocado: 60, kg_recebido: 20, kg_restante: 40 },
        { alocacao_id: 43, op_id: null, kg_alocado: 40, kg_recebido: 0, kg_restante: 40 },
      ],
    }],
    comandos: [{
      id: 500, comando_tipo: 'recebimento', ator_tipo: 'admin', ocorrido_em: '2026-07-20T13:45:00+00:00',
      documento_ref: 'NF-123', origem_tipo: 'nota_fiscal', origem_ref: 'R9',
      lancamentos: [{
        id: 800, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900,
        material: 'poliester', cor_id: 3, cor_poliester: 'Azul',
        kg: 20, kg_excesso: 0, estorno_de_id: null, kg_reversivel: 20,
        movimento_estoque: { id: 1, kg_excedente_delta: 0, excesso_antes: 0, excesso_depois: 0 },
      }],
    }],
  }, overrides || {});
}

const noopHandlers = { abrirRegistroRecebimento() {}, estornarLancamento() {} };
// OP-CANONICAL-IDENTITY-REFOUNDATION-R1: as RPCs aceitas de recebimento
// atribuem origem apenas por `op_id`. A tela real resolve o mapa
// op_id -> identidade em ordem-compra-receipt-data.js (view
// public.op_identidade_projecao, db/95) e o guarda em `state.opIdentidades`.
// O harness reproduz esse state para exercitar o caminho real de atribuicao.
const OP_IDENTIDADES = {
  900: { op_id: 900, identidade_operacional: 'OP-T900-1-26', identidade_pedido_id: 'ped-fix' },
};

function render(sandbox, ordem, receiptHistory, handlers, opIdentidades) {
  const ns = sandbox.RAVATEX_SCREENS.ordemCompra;
  return ns.renderReceiptSection(
    { ordem, receiptHistory, opIdentidades: opIdentidades || OP_IDENTIDADES },
    handlers || noopHandlers);
}

test('legacy order renders NO Recebimentos section', () => {
  const s = makeSandbox();
  assert.equal(render(s, { modelo: 'legado', status_administrativo: 'emitida' }, projection()), null);
});

test('native DRAFT order renders NO Recebimentos section', () => {
  const s = makeSandbox();
  assert.equal(render(s, { modelo: 'nativo', status_administrativo: 'rascunho' }, projection()), null);
});

test('native emitida & receivable: section + enabled Registrar action', () => {
  const s = makeSandbox();
  let opened = 0;
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection(),
    { abrirRegistroRecebimento() { opened += 1; }, estornarLancamento() {} });
  assert.ok(findById(view, 'oc-recebimentos'), 'section present');
  const btn = findById(view, 'oc-registrar-recebimento');
  assert.ok(btn, 'Registrar recebimento button present');
  btn._listeners.click();
  assert.equal(opened, 1, 'Registrar click wired to handler');
});

test('native emitida, acoes.receber=false: section present, NO Registrar action', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ acoes: { receber: false, estornar: true } }));
  assert.ok(findById(view, 'oc-recebimentos'));
  assert.equal(findById(view, 'oc-registrar-recebimento'), null);
});

test('honest loading / empty / error states', () => {
  const s = makeSandbox();
  const loading = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, { loading: true });
  assert.match(text(loading), /Carregando recebimentos/);
  const empty = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({ comandos: [] }));
  assert.match(text(empty), /Nenhum recebimento registrado ainda/);
  const error = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, { ok: false, codigo: 'erro' });
  assert.ok(findById(error, 'oc-recebimentos-erro'), 'honest error state');
  assert.match(text(error), /Não foi possível carregar os recebimentos/);
});

test('NULL-op / Pedido-origin allocation renders honestly; real OP retained; no fabricated OP', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const t = text(view);
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: a atribuicao de origem deixou de ser
  // `'OP ' + op_id` (a chave primaria como nome) e passa pelo mapa
  // op_id -> identidade resolvido de public.op_identidade_projecao (db/95).
  assert.match(t, /OP-T900-1-26/, 'real OP attribution retained, by canonical identity');
  assert.doesNotMatch(t, /OP 900/, 'a chave primaria nao pode voltar como nome');
  assert.match(t, /Pedido \(compartilhada\)/, 'NULL-op rendered as shared, not fabricated');
});

// BACKLOG-7 PHASE 3: this guard used to reach the headers of the two tables the
// phase FUSED away — "Saldos por item" (Kg pedido / Kg restante) and
// "Alocações" (Kg alocado). Per UI_VISUAL_CONTRACT.md §9 a smoke test that
// encodes a retired visual is updated to the canonical form while its
// FUNCTIONAL assertion is preserved. The functional assertion here is the §2.5
// golden rule — a numeric column's header carries the same alignment as its
// values — and it is now proved on the table that survives, plus the numeric
// contract of the label/value pairs that replaced the two retired tables.
test('golden rule: numeric headers align right, label header left', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  assert.match(thByText(view, 'Kg').className, /text-right/);
  assert.match(thByText(view, 'Kg excesso').className, /text-right/);
  assert.match(thByText(view, 'Reversível').className, /text-right/);
  assert.match(thByText(view, 'Fio').className, /text-left/);
  assert.match(thByText(view, 'Origem').className, /text-left/);
  // Every value cell under a right-aligned numeric header keeps its own
  // right alignment and tabular numerals — the golden rule is a PAIR.
  const numCells = findAll(view, (n) => n.tagName === 'TD'
    && /tabular-nums/.test(n.getAttribute('style') || ''));
  assert.ok(numCells.length >= 3, 'the surviving table still carries numeric value cells');
  for (const c of numCells) assert.match(c.className, /text-right/);
});

/* ============================================================
   BACKLOG-7 PHASE 3 — THE MATERIAL IS THE OPERATIONAL UNIT
   ============================================================ */

test('phase 3: the three competing representations collapse into ONE material block', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const t = text(view);
  // The two retired section bands are gone as top-level representations.
  assert.doesNotMatch(t, /Saldos por item/, '"Saldos por item" is no longer a competing section');
  assert.doesNotMatch(t, /Alocações/, '"Alocações" is no longer a competing top-level section');
  // The fused block exists and is named for its unit.
  assert.ok(findById(view, 'oc-materiais'), 'the Materiais block exists');
  assert.match(t, /Materiais/, 'the block is named for the material');
  // Exactly one block per material of the read model.
  const blocks = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-item-id') != null);
  assert.equal(blocks.length, 1, 'one block per material, no duplicate representation');
  assert.equal(blocks[0].getAttribute('data-item-id'), '7');
});

test('phase 3: one material states identity, state and its four quantities together', () => {
  const s = makeSandbox();
  const view = render(s, {
    modelo: 'nativo', status_administrativo: 'emitida',
    itens: [{ item_id: 7, material: 'poliester', cor_id: 3, cor_nome: 'AZUL' }],
  }, projection());
  const bloco = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-item-id') === '7')[0];
  const t = text(bloco);
  // Identity — human-readable material + real colour name, never the raw key.
  assert.match(t, /Poliéster · AZUL/, 'material identity is legible inside its own block');
  assert.doesNotMatch(t, /Cor 3/, 'the raw cor_id never reaches the block');
  // The four quantities, all four, in the SAME block — this is the whole point:
  // the operator no longer assembles them from separate sections.
  for (const label of ['Kg pedido', 'Kg recebido', 'Kg restante', 'Kg excedente']) {
    assert.ok(t.includes(label), `${label} is stated inside the material block`);
  }
  assert.match(t, /100,000 kg/, 'ordered quantity');
  assert.match(t, /20,000 kg/, 'received quantity');
  assert.match(t, /80,000 kg/, 'remaining quantity');
  assert.match(t, /2,000 kg/, 'real excess quantity');
});

test('phase 3: receipt state is legible AT MATERIAL LEVEL, through the ruled owner', () => {
  // The three cases are derived from the server's own per-item numbers — the
  // screen reads kg_recebido / kg_restante exactly as db/100 projected them and
  // recomputes no accounting. The vocabulary is the SAME ruled vocabulary the
  // order-level pill uses, so js/badges.js stays the single family owner and no
  // fourth family is invented (the open D5 excess-pill decision is untouched).
  const casos = [
    [{ kg_pedido: 100, kg_recebido: 0, kg_restante: 100, kg_excesso: 0 }, 'nao_recebido', 'Não recebido', 'neutral'],
    [{ kg_pedido: 100, kg_recebido: 20, kg_restante: 80, kg_excesso: 0 }, 'parcial', 'Parcial', 'caution'],
    [{ kg_pedido: 100, kg_recebido: 100, kg_restante: 0, kg_excesso: 0 }, 'recebido', 'Recebido', 'positive'],
  ];
  for (const [quantidades, chave, rotulo, familia] of casos) {
    const s = makeSandbox();
    const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
      projection({ itens: [Object.assign({ item_id: 7, material: 'poliester', cor_poliester: 'Azul', alocacoes: [] }, quantidades)] }));
    const pill = findAll(view, (n) => typeof n.getAttribute === 'function'
      && n.getAttribute('data-estado-material') != null)[0];
    assert.ok(pill, `${chave}: the material declares its own receipt state`);
    assert.equal(pill.getAttribute('data-estado-material'), chave);
    assert.match(pill.textContent || '', new RegExp(rotulo));
    assert.equal(s.rvStatusFamily(chave), familia, `${chave} resolves to ${familia} through js/badges.js`);
  }
});

test('phase 3: allocations are DEMOTED inside their material, losing no quantity', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const bloco = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-item-id') === '7')[0];
  // Both allocations live INSIDE the material block, not in a sibling table.
  const dest = findAll(bloco, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-alocacao-id') != null);
  assert.equal(dest.length, 2, 'both destinations are nested under their own material');
  assert.deepEqual(dest.map((d) => d.getAttribute('data-alocacao-id')), ['42', '43']);
  const t = text(bloco);
  // Honest attribution survives the demotion: canonical OP identity, and the
  // NULL-op allocation as a first-class shared Pedido — never a fabricated OP.
  assert.match(t, /OP-T900-1-26/, 'canonical OP identity retained');
  assert.match(t, /Pedido \(compartilhada\)/, 'NULL-op destination retained honestly');
  assert.doesNotMatch(t, /OP 900/, 'the primary key never returns as a name');
  // The three quantities the retired "Alocações" table showed are all still here.
  assert.match(t, /Alocado 60,000 kg · Recebido 20,000 kg · Restante 40,000 kg/);
  assert.match(t, /Alocado 40,000 kg · Recebido 0,000 kg · Restante 40,000 kg/);
});

test('phase 3: the cockpit rail carries order state, the aggregate and the one flow action', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({
      status_recebimento: 'parcial',
      itens: [
        { item_id: 7, material: 'poliester', cor_poliester: 'Azul', kg_pedido: 100, kg_recebido: 20, kg_restante: 80, kg_excesso: 2, alocacoes: [] },
        { item_id: 8, material: 'algodao', cor_id: 1, kg_pedido: 50, kg_recebido: 50, kg_restante: 0, kg_excesso: 0, alocacoes: [] },
      ],
    }));
  // §3A: the grid and the sticky rail are declared and MARKED, so
  // css/responsive.css collapses them at the breakpoint by attribute alone.
  const cockpit = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-rv-cockpit') != null)[0];
  assert.ok(cockpit, 'the Archetype-A cockpit grid is declared');
  assert.match(cockpit.getAttribute('style'), /grid-template-columns:minmax\(0,1fr\) var\(--rv-rail-w\)/);
  const rail = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-rv-rail') != null)[0];
  assert.ok(rail, 'the rail is declared');
  assert.match(rail.getAttribute('style'), /position:sticky/);
  // The ORDER's own receipt state lives in the rail, not repeated on the left.
  const pill = findById(rail, 'oc-status-recebimento');
  assert.ok(pill, 'the order-level receipt state is in the rail');
  assert.equal(pill.getAttribute('data-status-recebimento'), 'parcial');
  // The aggregate — a sum of what the server already derived per item.
  const railText = text(rail);
  assert.match(railText, /150,000 kg/, 'total ordered');
  assert.match(railText, /70,000 kg/, 'total received');
  assert.match(railText, /80,000 kg/, 'total remaining');
  assert.match(railText, /2,000 kg/, 'total real excess');
  // What is meaningful now, at the only scope where the action exists.
  assert.match(text(findById(view, 'oc-rail-orientacao')), /Falta receber 1 material/);
  // §2.1's first exception: in the rail every control is width:100%.
  const reg = findById(rail, 'oc-registrar-recebimento');
  assert.ok(reg, 'the dominant flow action lives in the rail');
  assert.match(reg.getAttribute('style'), /width:100%/);
  assert.match(reg.getAttribute('style'), /height:var\(--rv-h-primary\)/);
});

test('phase 3: the server blocker sits in the rail, beside the action it blocks', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ acoes: { receber: false, estornar: true }, bloqueio_recebimento: 'recebimento_canonico_inativo' }));
  const rail = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-rv-rail') != null)[0];
  assert.ok(findById(rail, 'oc-recebimento-inativo'), 'the blocker notice is in the rail');
  assert.equal(findById(view, 'oc-registrar-recebimento'), null, 'and no actionable control exists');
});

test('row-level reversal button: all §8.1 guards, enabled when server allows', () => {
  const s = makeSandbox();
  let reversed = null;
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection(),
    { abrirRegistroRecebimento() {}, estornarLancamento(c, l) { reversed = l.id; } });
  const btn = findButtons(view).find((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.ok(btn, 'reversal button present on a reversible receipt lançamento');
  assert.equal(btn.getAttribute('aria-label'), 'Estornar recebimento', 'aria-label matches title');
  assert.match(btn.getAttribute('style') || btn.style.cssText, /width:30px/, '30×30 size');
  assert.match(btn.getAttribute('style') || btn.style.cssText, /border-radius:4px/, 'control radius');
  const sr = (btn.children || []).find((c) => /Estornar recebimento/.test(c.textContent || ''));
  assert.ok(sr, 'visually-hidden accessible label present');
  assert.equal(btn.disabled, false, 'enabled — server acoes.estornar && kg_reversivel>0');
  btn._listeners.click();
  assert.equal(reversed, 800, 'reversal wired to the lançamento');
});

// REVERSED-RECEIPT-LINE-ACTION-VISIBILITY-R1: a acao AUSENTE, nao desabilitada.
//
// Antes este guard exigia o oposto — que o controle existisse e ficasse
// `disabled`. Na tela real isso fez um lancamento JA TOTALMENTE ESTORNADO
// (linha 54 de OC-001-4-26, kg_reversivel 0,000) continuar anunciando
// "Estornar recebimento do lancamento 54" ao lado da propria coluna que dizia
// Reversivel 0,000 kg. Sem saldo reversivel nao ha acao.
test('reversal action is ABSENT when kg_reversivel === 0 or acoes.estornar === false', () => {
  const s = makeSandbox();
  const exhausted = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ comandos: [Object.assign(projection().comandos[0], { lancamentos: [Object.assign({}, projection().comandos[0].lancamentos[0], { kg_reversivel: 0 })] })] }));
  const b1 = findButtons(exhausted).find((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.equal(b1, undefined, 'nenhuma acao de estorno num lancamento sem saldo reversivel');
  // E o rotulo acessivel tambem some: para leitor de tela a acao deixa de existir.
  assert.doesNotMatch(text(exhausted), /Estornar recebimento do lançamento/,
    'o rotulo sr-only nao pode sobreviver a ausencia da acao');

  const noAdmin = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({ acoes: { receber: true, estornar: false } }));
  const b2 = findButtons(noAdmin).find((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.equal(b2, undefined, 'sem permissao de estorno nenhuma linha oferece a acao');
});

// O caso REAL de OC-001-4-26 depois do estorno operacional: duas linhas do
// MESMO comando, uma ainda reversivel e outra ja exaurida.
test('linha reversivel mantem a acao enquanto a linha exaurida perde a acao', () => {
  const s = makeSandbox();
  const base = projection().comandos[0];
  const lancBase = base.lancamentos[0];
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({
      comandos: [Object.assign({}, base, {
        lancamentos: [
          Object.assign({}, lancBase, { id: 53, kg: 880.65, kg_excesso: 0, kg_reversivel: 880.65 }),
          Object.assign({}, lancBase, { id: 54, kg: 880.65, kg_excesso: 880.65, kg_reversivel: 0 }),
        ],
      })],
    }));
  const acoes = findButtons(view).filter((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.equal(acoes.length, 1, 'exatamente UMA acao: so a linha que ainda tem saldo reversivel');
  const texto = text(view);
  assert.match(texto, /Estornar recebimento do lançamento 53/, 'a linha 53 mantem a acao');
  assert.doesNotMatch(texto, /Estornar recebimento do lançamento 54/, 'a linha 54 nao oferece mais estorno');
  // A linha exaurida continua VISIVEL e legivel como nao reversivel.
  assert.ok(findAll(view, (n) => n.getAttribute && n.getAttribute('data-lancamento-id') === '54').length > 0,
    'a linha 54 continua na historia');
});

/*
 * BACKLOG-7 PHASE 1 RECONCILIATION.
 *
 * This guard is UNCHANGED IN INTENT: flat card, neutral section chip, section
 * label, one dominant action, tokenised numeric cells. Only its SUBJECT moved.
 *
 * It used to name --rv-radius-card, --rv-color-line-200, --rv-color-chip-bg,
 * --rv-color-chip-glyph, --rv-radius-control, --rv-color-section-label,
 * --rv-color-accent and --rv-color-value. css/tokens.css declares every one of
 * those under "LEGACY COMPATIBILITY — NONCONFORMING / DEPRECATED … New code must
 * not use them", so a guard that REQUIRED them was pinning the screen to the
 * namespace the contract is retiring. The assertions now name the canonical
 * owners the screen actually renders.
 *
 * The old title also claimed --rv-radius-card was 6px. The alias has resolved to
 * var(--rv-radius) (4px) since the radius pass; the literal in the title was
 * stale, not a second value.
 *
 * This adds NO new visual assertion and relaxes none: it is the same eight
 * properties under their current names, plus an explicit negative proving the
 * deprecated namespace does not come back.
 */
test('visual tokens: flat canonical card, neutral chip, dominant action, token numerics (VISUAL-GATE-R1)', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  // Card: canonical radius + hairline border, flat (no shadow, no rounded-lg 8px).
  const card = findById(view, 'oc-recebimentos');
  const cardStyle = card.getAttribute('style') || '';
  assert.match(cardStyle, /border-radius:var\(--rv-radius\)/, 'card uses the canonical --rv-radius');
  assert.match(cardStyle, /border:1px solid var\(--rv-border\)/, 'card uses the canonical hairline border token');
  assert.doesNotMatch(cardStyle, /shadow|box-shadow/, 'flat card, no shadow');
  assert.doesNotMatch(card.className, /rounded-lg|shadow/, 'no residual rounded-lg / shadow utility classes');
  // Section chip: neutral --rv-chip-bg / --rv-chip-glyph, canonical radius.
  const chip = findAll(view, (n) => /var\(--rv-chip-bg\)/.test(n.getAttribute && n.getAttribute('style') || ''))[0];
  assert.ok(chip, 'section chip uses --rv-chip-bg');
  assert.match(chip.getAttribute('style'), /color:var\(--rv-chip-glyph\)/, 'chip glyph token');
  assert.match(chip.getAttribute('style'), /border-radius:var\(--rv-radius\)/, 'chip canonical radius');
  // Section label: the SECTION_LABEL role on the canonical tertiary text token.
  assert.ok(findAll(view, (n) => /font-size:var\(--rv-fs-label\)/.test(n.getAttribute && n.getAttribute('style') || '')
    && /color:var\(--rv-text-tertiary\)/.test(n.getAttribute('style') || '')).length > 0,
  'section label takes --rv-fs-label on --rv-text-tertiary');
  // Dominant action: §2.1 Primary — brand fill, on-brand foreground, ladder height.
  const reg = findById(view, 'oc-registrar-recebimento');
  assert.match(reg.getAttribute('style'), /background:var\(--rv-brand\)/, 'registrar uses --rv-brand');
  assert.match(reg.getAttribute('style'), /color:var\(--rv-text-on-brand\)/, 'registrar uses --rv-text-on-brand');
  assert.match(reg.getAttribute('style'), /height:var\(--rv-h-primary\)/, 'registrar declares a ladder height');
  assert.match(reg.getAttribute('style'), /border-radius:var\(--rv-radius\)/, 'registrar uses the canonical radius');
  // Numeric cells: primary text token + tabular numerals.
  const numCell = findAll(view, (n) => n.tagName === 'TD' && /var\(--rv-text-primary\)/.test(n.getAttribute('style') || '') && /tabular-nums/.test(n.getAttribute('style') || ''))[0];
  assert.ok(numCell, 'numeric value cell uses --rv-text-primary + tabular-nums');
  // The retired namespace must not reappear anywhere in the rendered tree.
  const allStyles = findAll(view, (n) => typeof n.getAttribute === 'function')
    .map((n) => n.getAttribute('style') || '').join(' ');
  assert.doesNotMatch(allStyles, /var\(--rv-color-|var\(--rv-radius-card\)|var\(--rv-radius-control\)/,
    'no deprecated compatibility token survives in the rendered receipt section');
});

test('reversal control absent on estorno (negative) command rows', () => {
  const s = makeSandbox();
  const estornoCmd = {
    id: 501, comando_tipo: 'estorno', ator_tipo: 'admin', ocorrido_em: '2026-07-21T10:00:00+00:00',
    documento_ref: null, origem_tipo: 'estorno', origem_ref: null,
    lancamentos: [{ id: 801, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900, material: 'poliester', cor_id: 3, cor_poliester: 'Azul', kg: -8, kg_excesso: 0, estorno_de_id: 800, kg_reversivel: 0, movimento_estoque: null }],
  };
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({ comandos: [estornoCmd] }));
  assert.equal(findButtons(view).some((b) => b.getAttribute('title') === 'Estornar recebimento'), false,
    'no reversal control on an estorno command');
  assert.match(text(view), /Estorno/, 'estorno command rendered');
});

// =====================================================================
// PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 — the receipt action
// obeys the cutover.
// =====================================================================
// The canonical receipt writer is fenced until ordem_compra_cutover reaches
// canonical_active/canonical (db/75/db/76), but the read model used to project
// `acoes.receber` from the order's lifecycle ALONE. The operator was offered
// "Registrar recebimento", filled the whole form, confirmed, and only then met
// `recebimento_canonico_inativo`. db/100 subordinates the projection to the
// same fence and returns the blocker; this section proves the screen obeys it
// and never reconstructs the cutover state for itself.

test('an inactive canonical cutover exposes no actionable receipt control', () => {
  const sandbox = makeSandbox();
  const node = render(sandbox,
    { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({
      acoes: { receber: false, estornar: false },
      recebimento_canonico_ativo: false,
      bloqueio_recebimento: 'recebimento_canonico_inativo',
    }));

  assert.equal(findById(node, 'oc-registrar-recebimento'), null,
    'no Registrar recebimento control exists while the cutover is inactive');

  const aviso = findById(node, 'oc-recebimento-inativo');
  assert.ok(aviso, 'an honest read-only explanation is rendered instead');
  assert.match(text(aviso), /indisponível/i);
  assert.match(text(aviso), /somente leitura/i);

  // Whatever else the section renders, none of it is an enabled receipt action.
  const enabled = findButtons(node).filter((b) => !b.disabled);
  assert.equal(enabled.filter((b) => /Registrar recebimento/i.test(b.textContent || '')).length, 0);
});

test('the blocker is server-derived: the screen never reconstructs the cutover', () => {
  const src = read('js/screens/ordem-compra-receipt-render.js');
  assert.match(src, /hist\.bloqueio_recebimento === 'recebimento_canonico_inativo'/,
    'the render reads the server blocker verbatim');

  // Comments are stripped first. The rule under test is that no CODE reads or
  // re-derives the cutover state; a comment that explains WHY the blocker
  // exists must be allowed to name it, or the guard would forbid documenting
  // its own subject.
  // CRLF is normalised first: this checkout runs with core.autocrlf=true, so a
  // per-line `.*$` would never reach the end of a CRLF line and would silently
  // strip nothing at all.
  const code = src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  assert.doesNotMatch(code, /ordem_compra_cutover/,
    'the cutover table is never read or reconstructed on this surface');
  assert.doesNotMatch(code, /canonical_active/,
    'the cutover state machine is not re-implemented in JavaScript');
});

test('an ACTIVE canonical cutover restores the receipt action', () => {
  const sandbox = makeSandbox();
  const node = render(sandbox,
    { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({
      acoes: { receber: true, estornar: true },
      recebimento_canonico_ativo: true,
      bloqueio_recebimento: null,
    }));
  assert.ok(findById(node, 'oc-registrar-recebimento'),
    'the action returns exactly when the server says the cutover is canonical');
  assert.equal(findById(node, 'oc-recebimento-inativo'), null,
    'and the inactive explanation disappears with it');
});

/* ============================================================
   BACKLOG-7 PHASE 2 — the surface stops contradicting itself

   These four prove BUSINESS-DATA correctness, not visual values:
   which string reaches the operator, from which server field.
   ============================================================ */

test('a cor real do item vence a chave crua, e sem o detalhe carregado nada quebra', () => {
  const s = makeSandbox();
  // Algodao nao tem cor_poliester, entao o read model de recebimento so oferece
  // cor_id — era exatamente o caso que imprimia "Algodão · Cor 3" logo abaixo de
  // uma tabela Itens que ja dizia "Algodão · CRU" para o MESMO item.
  const hist = projection({
    itens: [{
      item_id: 7, material: 'algodao', cor_id: 3, cor_poliester: null,
      kg_pedido: 100, kg_recebido: 20, kg_restante: 80, kg_excesso: 0,
      alocacoes: [{ alocacao_id: 42, op_id: 900, kg_alocado: 100, kg_recebido: 20, kg_restante: 80 }],
    }],
    comandos: [{
      id: 500, comando_tipo: 'recebimento', ator_tipo: 'admin', ocorrido_em: '2026-07-20T13:45:00+00:00',
      documento_ref: null, origem_tipo: 'nota_fiscal', origem_ref: null,
      lancamentos: [{
        id: 800, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900,
        material: 'algodao', cor_id: 3, cor_poliester: null,
        kg: 20, kg_excesso: 0, estorno_de_id: null, kg_reversivel: 20, movimento_estoque: null,
      }],
    }],
  });

  // COM o detalhe da ordem carregado (o caso real: obter_ordem_compra_admin
  // projeta cor_nome via LEFT JOIN public.cores, db/100).
  const comDetalhe = render(s, {
    modelo: 'nativo', status_administrativo: 'emitida',
    itens: [{ item_id: 7, material: 'algodao', cor_id: 3, cor_nome: 'CRU', cor_poliester: null }],
  }, hist);
  const t = text(comDetalhe);
  assert.match(t, /Algodão · CRU/, 'a cor real do cadastro chega a secao de recebimento');
  assert.doesNotMatch(t, /Cor 3/, 'a chave crua nao aparece em lugar nenhum');

  // SEM o detalhe: degrada exatamente para o rotulo anterior, nunca lanca.
  const s2 = makeSandbox();
  const semDetalhe = render(s2, { modelo: 'nativo', status_administrativo: 'emitida' }, hist);
  assert.match(text(semDetalhe), /Cor 3/, 'sem o mapa, o fallback anterior permanece');
});

test('o estado de recebimento da ORDEM e dito, com a familia ruled de cada chave', () => {
  const casos = [
    ['recebido', 'Recebido', 'positive'],
    ['parcial', 'Parcial', 'caution'],
    ['nao_recebido', 'Não recebido', 'neutral'],
  ];
  for (const [chave, rotulo, familia] of casos) {
    const s = makeSandbox();
    const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
      projection({ status_recebimento: chave }));
    const pill = findById(view, 'oc-status-recebimento');
    assert.ok(pill, `${chave}: a ordem declara o seu estado de recebimento`);
    assert.equal(pill.getAttribute('data-status-recebimento'), chave);
    assert.match(pill.textContent || '', new RegExp(rotulo));
    // A familia vem do dono canonico js/badges.js, nunca de um mapa local.
    assert.equal(s.rvStatusFamily(chave), familia, `${chave} resolve para ${familia}`);
  }
});

test('o motivo do estorno e dito como motivo, nao como par tecnico de origem', () => {
  const s = makeSandbox();
  // db/70 grava o motivo obrigatorio do estorno como
  // origem_tipo='estorno_admin' + origem_ref=<motivo>.
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({
    comandos: [{
      id: 501, comando_tipo: 'estorno', ator_tipo: 'admin', ocorrido_em: '2026-07-21T10:00:00+00:00',
      documento_ref: null, origem_tipo: 'estorno_admin', origem_ref: 'lancamento em duplicidade',
      lancamentos: [{
        id: 801, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900,
        material: 'poliester', cor_id: 3, cor_poliester: 'Azul',
        kg: -8, kg_excesso: 0, estorno_de_id: 800, kg_reversivel: 0, movimento_estoque: null,
      }],
    }],
  }));
  const t = text(view);
  assert.match(t, /Motivo: +lancamento em duplicidade/, 'o motivo aparece rotulado como motivo');
  assert.doesNotMatch(t, /estorno_admin/, 'o enum interno nao vaza para a superficie');
  assert.match(t, /Por: +Administrador/, 'o ator e dito em portugues, nao como enum');
});

test('um recebimento comum conserva Origem, que ali significa procedencia', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const t = text(view);
  assert.match(t, /Origem: +nota_fiscal/, 'num recebimento a origem continua sendo origem');
  assert.doesNotMatch(t, /Motivo:/, 'um recebimento nao tem motivo de estorno');
});
