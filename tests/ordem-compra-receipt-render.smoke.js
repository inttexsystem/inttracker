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

// BACKLOG-7 PHASE 3 fused away "Saldos por item" and "Alocações"; PHASE 4
// retired the last one, the six-column ledger history. Per UI_VISUAL_CONTRACT.md
// §9 a smoke test that encodes a retired visual is updated to the canonical form
// while its FUNCTIONAL assertion is preserved.
//
// §2.5's golden rule governs a TABLE, and this surface no longer builds one at
// all — so the guard now proves the retirement itself plus the contract that
// actually carries the numbers here: every quantity keeps tabular numerals, so
// digits still line up between rows.
test('no ledger table survives; every quantity keeps tabular numerals', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  assert.equal(findAll(view, (n) => n.tagName === 'TABLE').length, 0,
    'the receipt surface builds no table any more');
  assert.equal(ths(view).length, 0, 'and therefore no table header');
  const tnum = findAll(view, (n) => typeof n.getAttribute === 'function'
    && /tabular-nums/.test(n.getAttribute('style') || ''));
  assert.ok(tnum.length >= 5, 'quantities and timestamps keep tabular numerals');
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
  // BACKLOG-7 PHASE 4: the control is no longer icon-only. §2.9's icon-only
  // exemption is written for a TABLE-ROW action, and after this phase the
  // surface builds no table — so the exemption is not claimed, and §2.1's
  // general "destructive: icon + text, always" is honoured instead. Same
  // geometry as its sibling "Editar" control, whose text form the architect
  // ratified at d331154 for exactly this reason.
  assert.match(btn.textContent || '', /Estornar/, 'the destructive control carries a visible label');
  assert.equal((btn.children || []).length, 2, 'icon + text, not icon alone');
  assert.match(btn.getAttribute('style'), /height:30px/, 'row-action ladder height');
  assert.match(btn.getAttribute('style'), /border-radius:var\(--rv-radius\)/, 'canonical control radius');
  assert.match(btn.getAttribute('style'), /color:var\(--rv-signal-negative\)/, '§2.1 Destructive skin');
  // The accessible name is now BUSINESS, not the primary key read aloud.
  const nome = btn.getAttribute('aria-label');
  assert.match(nome, /Poliéster · Azul/, 'accessible name states the material');
  assert.match(nome, /20,000 kg/, 'accessible name states the quantity');
  assert.match(nome, /20\/07\/2026/, 'accessible name states the receipt date');
  assert.doesNotMatch(nome, /lançamento 800/, 'the primary key is no longer read aloud');
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
  // A acao viva pertence a linha 53, e o seu nome acessivel agora e de NEGOCIO
  // (material + quantidade + data) em vez da chave primaria.
  assert.match(acoes[0].getAttribute('aria-label'), /880,650 kg/, 'a acao viva e a da linha com saldo');
  const linha53 = findAll(view, (n) => n.getAttribute && n.getAttribute('data-lancamento-id') === '53')[0];
  assert.ok(linha53.children.some((c) => findButtons(c).length > 0), 'a acao esta DENTRO da linha 53');
  // CRITERIO 7: a linha exaurida continua VISIVEL e legivel como historia,
  // dizendo em portugues que ja nao contribui para o saldo atual.
  const linha54 = findAll(view, (n) => n.getAttribute && n.getAttribute('data-lancamento-id') === '54')[0];
  assert.ok(linha54, 'a linha 54 continua na historia');
  assert.equal(findButtons(linha54).length, 0, 'a linha 54 nao oferece mais estorno');
  assert.match(linha54.textContent || text(linha54), /Totalmente estornado/,
    'a linha 54 declara-se totalmente estornada');
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
  // Numeric values: primary text token + tabular numerals. After phase 4 these
  // are the material metric pairs, not table cells — the property is the same.
  const numCell = findAll(view, (n) => typeof n.getAttribute === 'function'
    && /var\(--rv-text-primary\)/.test(n.getAttribute('style') || '')
    && /tabular-nums/.test(n.getAttribute('style') || ''))[0];
  assert.ok(numCell, 'numeric value uses --rv-text-primary + tabular-nums');
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
  // BACKLOG-7 PHASE 4: o ator continua em portugues, agora dentro da frase
  // narrativa da entrada ("por Administrador") em vez do par tecnico "Por: ".
  assert.match(t, /por +Administrador/, 'o ator e dito em portugues, nao como enum');
  assert.match(t, /Saíram +8,000 kg/, 'a direcao do evento e dita em negocio');
  // Esta projecao contem SO o estorno, entao o recebimento de origem nao esta
  // no modelo: a resolucao falha ABERTA, dizendo a relacao sem inventar a data.
  assert.match(t, /Estorna um recebimento anterior desta ordem/, 'degrada sem inventar data');
});

// CRITERIO 6: quando o recebimento de origem ESTA no modelo — o caso real — o
// estorno nomeia-o pela sua DATA, que e como o operador identifica um
// recebimento. O elo e `estorno_de_id`, gravado por db/70 e projetado por
// db/100; a tela nao o adivinha.
test('phase 4: um estorno nomeia o recebimento que desfaz, pela data', () => {
  const s = makeSandbox();
  const base = projection();
  // O servidor recalcula kg_reversivel do recebimento como
  // kg + SUM(estornos) — e os estornos sao negativos (db/70 grava `-v_line.kg`).
  // Estornados os 20 kg, a linha de origem fica com 0 reversivel; a fixture tem
  // de dizer o mesmo que db/100 diria, senao provaria um estado impossivel.
  const recebimento = Object.assign({}, base.comandos[0], {
    lancamentos: [Object.assign({}, base.comandos[0].lancamentos[0], { kg_reversivel: 0 })],
  });
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({
    comandos: [
      recebimento,
      {
        id: 501, comando_tipo: 'estorno', ator_tipo: 'admin', ocorrido_em: '2026-07-21T10:00:00+00:00',
        documento_ref: null, origem_tipo: 'estorno_admin', origem_ref: 'lancamento em duplicidade',
        lancamentos: [{
          id: 801, linha_indice: 0, item_id: 7, alocacao_id: 42, op_id: 900,
          material: 'poliester', cor_id: 3, cor_poliester: 'Azul',
          kg: -20, kg_excesso: 0, estorno_de_id: 800, kg_reversivel: 0, movimento_estoque: null,
        }],
      },
    ],
  }));
  const t = text(view);
  assert.match(t, /Estorna o recebimento de +20\/07\/2026 13:45/,
    'o estorno nomeia, por data, o recebimento que afeta');
  // As duas entradas coexistem, em ordem cronologica ascendente: a narrativa
  // "entrou X -> saiu X" le no sentido do tempo.
  const entradas = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-evento-tipo') != null);
  assert.deepEqual(entradas.map((e) => e.getAttribute('data-evento-tipo')), ['recebimento', 'estorno'],
    'ordem cronologica ascendente, exatamente como db/100 devolve');
  assert.match(t, /Entraram +20,000 kg/, 'a entrada de recebimento soma');
  assert.match(t, /Saíram +20,000 kg/, 'a entrada de estorno subtrai');
  // CRITERIO 7: o recebimento totalmente estornado continua na historia e
  // declara que ja nao contribui para o saldo atual.
  assert.match(t, /Totalmente estornado — não contribui para o saldo atual/,
    'o recebimento exaurido continua legivel como historia');
});

test('um recebimento comum conserva Origem, que ali significa procedencia', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const t = text(view);
  // BACKLOG-7 PHASE 4: a procedencia continua legivel e VERBATIM (origem_tipo e
  // texto livre do operador, db/70 aceita 1..80 caracteres), mas desce para a
  // linha de auditoria no pe da entrada — criterio 8: proveniencia e detalhe
  // secundario, nao a narrativa primaria.
  assert.match(t, /Origem +nota_fiscal/, 'num recebimento a origem continua sendo origem');
  assert.match(t, /Documento +NF-123/, 'o documento continua auditavel');
  assert.doesNotMatch(t, /Motivo:/, 'um recebimento nao tem motivo de estorno');
});

/* ============================================================
   BACKLOG-7 PHASE 4 COMPLETION — THE THIRD EVENT FAMILY
   (administrative correction, reachable through db/122)
   ============================================================ */

// A correcao real de OC-001-4-26: a data de negocio do recebimento foi
// corrigida de 02/08/2026 para 04/06/2026. db/119 sempre gravou isto; ate
// db/122 nada no produto o mostrava.
function correcaoFixture(overrides) {
  return Object.assign({
    id: 1, recebimento_id: 500, corrigido_em: '2026-08-02T14:20:00+00:00',
    ator_tipo: 'admin',
    ocorrido_em_antes: '2026-08-02T10:00:00+00:00',
    ocorrido_em_depois: '2026-07-20T13:45:00+00:00',
    documento_ref_antes: null, documento_ref_depois: 'NF-123',
    origem_tipo_antes: 'Sem nota', origem_tipo_depois: 'nota_fiscal',
    origem_ref_antes: null, origem_ref_depois: 'R9',
  }, overrides || {});
}

test('phase 4c: a correcao administrativa e a TERCEIRA familia, distinguivel', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ correcoes: [correcaoFixture()] }));
  const familias = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-evento-tipo') != null).map((n) => n.getAttribute('data-evento-tipo'));
  assert.deepEqual(familias, ['recebimento', 'correcao_administrativa'],
    'as tres familias coexistem e a correcao e uma delas');
  const entrada = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-correcao-id') === '1')[0];
  assert.ok(entrada, 'a correcao tem a sua propria entrada');
  const t = text(entrada);
  assert.match(t, /Correção administrativa/, 'a familia diz o seu nome');
  assert.match(t, /por +Administrador/, 'o ator e humano, nunca o UUID');
});

test('phase 4c: a correcao diz QUE recebimento afetou e O QUE mudou, em negocio', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ correcoes: [correcaoFixture()] }));
  const entrada = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-correcao-id') === '1')[0];
  const t = text(entrada);
  // Contexto: o recebimento afetado, pela sua data ATUAL, e os seus materiais.
  assert.match(t, /Dados do recebimento de +20\/07\/2026 13:45 +foram corrigidos/);
  assert.match(t, /Materiais do recebimento: +Poliéster · Azul/);
  // Antes/depois pelos NOMES DE NEGOCIO dos campos, nunca pelas colunas.
  assert.match(t, /Data do recebimento/);
  assert.match(t, /Documento/);
  assert.match(t, /Tipo de origem/);
  assert.match(t, /Referência da origem/);
  for (const coluna of ['ocorrido_em', 'documento_ref', 'origem_tipo', 'origem_ref', 'recebimento_id']) {
    assert.ok(!t.includes(coluna), `o nome de coluna ${coluna} nao pode vazar para a narrativa`);
  }
  // As datas sao formatadas, nunca ISO cru.
  assert.match(t, /02\/08\/2026 10:00 +→ +20\/07\/2026 13:45/);
  assert.doesNotMatch(t, /T\d\d:\d\d:\d\d/, 'nenhum timestamp ISO cru na superficie');
});

test('phase 4c: so os campos REALMENTE alterados aparecem', () => {
  const s = makeSandbox();
  // db/119 grava a imagem dos QUATRO campos mesmo quando so um muda.
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ correcoes: [correcaoFixture({
      documento_ref_antes: 'NF-123', documento_ref_depois: 'NF-123',
      origem_tipo_antes: 'nota_fiscal', origem_tipo_depois: 'nota_fiscal',
      origem_ref_antes: 'R9', origem_ref_depois: 'R9',
    })] }));
  const t = text(findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-correcao-id') === '1')[0]);
  assert.match(t, /Data do recebimento/, 'o campo que mudou aparece');
  assert.doesNotMatch(t, /Documento/, 'um campo inalterado nao entra na lista');
  assert.doesNotMatch(t, /Tipo de origem/, 'um campo inalterado nao entra na lista');
  assert.doesNotMatch(t, /Referência da origem/, 'um campo inalterado nao entra na lista');
});

test('phase 4c: uma correcao sem efeito diz isso, em vez de inventar uma alteracao', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ correcoes: [correcaoFixture({
      ocorrido_em_antes: '2026-08-02T10:00:00+00:00', ocorrido_em_depois: '2026-08-02T10:00:00+00:00',
      documento_ref_antes: 'NF-123', documento_ref_depois: 'NF-123',
      origem_tipo_antes: 'nota_fiscal', origem_tipo_depois: 'nota_fiscal',
      origem_ref_antes: 'R9', origem_ref_depois: 'R9',
    })] }));
  assert.match(text(view), /Nenhum dos dados do recebimento ficou diferente/);
});

test('phase 4c: os dois fluxos intercalam pelo relogio de REGISTO, nao pela data de negocio', () => {
  const s = makeSandbox();
  const base = projection().comandos[0];
  // O recebimento foi REGISTADO a 02/08 e a sua data de negocio foi depois
  // corrigida para 20/07. Ordenar por `ocorrido_em` poria a correcao ANTES do
  // recebimento que ela corrige; `criado_em` (db/122) e o relogio imutavel.
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({
      comandos: [Object.assign({}, base, {
        criado_em: '2026-08-02T10:00:00+00:00', ocorrido_em: '2026-07-20T13:45:00+00:00',
      })],
      correcoes: [correcaoFixture()],
    }));
  const familias = findAll(view, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-evento-tipo') != null).map((n) => n.getAttribute('data-evento-tipo'));
  assert.deepEqual(familias, ['recebimento', 'correcao_administrativa'],
    'a correcao vem DEPOIS do recebimento que corrigiu');
});

test('phase 4c: sem db/122 aplicado a linha do tempo e byte a byte a de antes', () => {
  // FAIL-OPEN: enquanto a migracao nao estiver aplicada o read model nao
  // devolve `correcoes` nem `criado_em`. Nenhum evento novo, nenhuma reordenacao.
  const s1 = makeSandbox();
  const semCorrecoes = render(s1, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  const s2 = makeSandbox();
  const listaVazia = render(s2, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ correcoes: [] }));
  assert.equal(text(semCorrecoes), text(listaVazia),
    'ausente e vazio produzem exatamente a mesma superficie');
  assert.equal(findAll(semCorrecoes, (n) => typeof n.getAttribute === 'function'
    && n.getAttribute('data-correcao-id') != null).length, 0, 'nenhuma entrada de correcao e inventada');
});
