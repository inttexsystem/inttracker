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
function render(sandbox, ordem, receiptHistory, handlers) {
  const ns = sandbox.RAVATEX_SCREENS.ordemCompra;
  return ns.renderReceiptSection({ ordem, receiptHistory }, handlers || noopHandlers);
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
  assert.match(t, /OP 900/, 'real OP attribution retained');
  assert.match(t, /Pedido \(compartilhada\)/, 'NULL-op rendered as shared, not fabricated');
});

test('golden rule: numeric headers align right, label header left', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  assert.match(thByText(view, 'Kg pedido').className, /text-right/);
  assert.match(thByText(view, 'Kg restante').className, /text-right/);
  assert.match(thByText(view, 'Kg alocado').className, /text-right/);
  assert.match(thByText(view, 'Fio').className, /text-left/);
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

test('reversal button disabled when kg_reversivel === 0 or acoes.estornar === false', () => {
  const s = makeSandbox();
  const exhausted = render(s, { modelo: 'nativo', status_administrativo: 'emitida' },
    projection({ comandos: [Object.assign(projection().comandos[0], { lancamentos: [Object.assign({}, projection().comandos[0].lancamentos[0], { kg_reversivel: 0 })] })] }));
  const b1 = findButtons(exhausted).find((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.equal(b1.disabled, true, 'disabled when kg_reversivel === 0');
  assert.ok(!b1._listeners || !b1._listeners.click, 'no click handler when disabled');

  const noAdmin = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection({ acoes: { receber: true, estornar: false } }));
  const b2 = findButtons(noAdmin).find((b) => b.getAttribute('title') === 'Estornar recebimento');
  assert.equal(b2.disabled, true, 'disabled when acoes.estornar === false');
});

test('visual tokens: flat card at --rv-radius-card, neutral chip tokens, accent action, token numerics (VISUAL-GATE-R1)', () => {
  const s = makeSandbox();
  const view = render(s, { modelo: 'nativo', status_administrativo: 'emitida' }, projection());
  // Card: canonical card radius + hairline line-200 border, flat (no shadow, no rounded-lg 8px).
  const card = findById(view, 'oc-recebimentos');
  const cardStyle = card.getAttribute('style') || '';
  assert.match(cardStyle, /border-radius:var\(--rv-radius-card\)/, 'card uses --rv-radius-card (6px), not rounded-lg (8px)');
  assert.match(cardStyle, /border:1px solid var\(--rv-color-line-200\)/, 'card uses the hairline line-200 border token');
  assert.doesNotMatch(cardStyle, /shadow|box-shadow/, 'flat card, no shadow');
  assert.doesNotMatch(card.className, /rounded-lg|shadow/, 'no residual rounded-lg / shadow utility classes');
  // Section chip: neutral --rv-color-chip-bg / --rv-color-chip-glyph, control radius.
  const chip = findAll(view, (n) => /var\(--rv-color-chip-bg\)/.test(n.getAttribute && n.getAttribute('style') || ''))[0];
  assert.ok(chip, 'section chip uses --rv-color-chip-bg');
  assert.match(chip.getAttribute('style'), /color:var\(--rv-color-chip-glyph\)/, 'chip glyph token');
  assert.match(chip.getAttribute('style'), /border-radius:var\(--rv-radius-control\)/, 'chip control radius');
  // Section label token.
  assert.ok(findAll(view, (n) => /color:var\(--rv-color-section-label\)/.test(n.getAttribute && n.getAttribute('style') || '')).length > 0, 'section label uses --rv-color-section-label');
  // Dominant action: accent bg + control radius.
  const reg = findById(view, 'oc-registrar-recebimento');
  assert.match(reg.getAttribute('style'), /background:var\(--rv-color-accent\)/, 'registrar uses --rv-color-accent');
  assert.match(reg.getAttribute('style'), /border-radius:var\(--rv-radius-control\)/, 'registrar uses control radius');
  // Numeric cells: strong value token + tabular numerals.
  const numCell = findAll(view, (n) => n.tagName === 'TD' && /var\(--rv-color-value\)/.test(n.getAttribute('style') || '') && /tabular-nums/.test(n.getAttribute('style') || ''))[0];
  assert.ok(numCell, 'numeric value cell uses --rv-color-value + tabular-nums');
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
