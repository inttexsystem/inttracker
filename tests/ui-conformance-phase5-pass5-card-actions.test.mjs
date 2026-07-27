/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 5 (UIC-008)

   Proves the CARD ACTION ALIGNMENT property closed over the population the
   detector can actually prove: the four explicitly marked in-card footer
   action rows. `UIC-008` reports zero blocking and zero coverage.

   The A1 ruling withdrew two things the R1 hard stop proved invalid:

     · the blanket per-file ACTION_ROW_UNPROVEN coverage branch. It keyed on
       DECODABLE DECLARATIONS, not on action rows — which is why 24 screens
       (including real action-bearing modals) never carried it at all — and one
       arbitrary marker anywhere in a file could silence it; and
     · the `insideCard === true` prerequisite on the divider and padding
       checks, which silently disabled both for every JavaScript screen because
       that front-end never resolves containment.

   A static `data-card-actions` marker is now the contract declaration itself:
   "this element is an in-card footer action row". Three footer layouts are
   ratified (§2 below).

   CLOSURE IS SCOPED, AND SECTION 5 SAYS SO. This suite proves the marked and
   guarded population conforms. It does NOT prove the absence of every possible
   unmarked footer in imperative runtime code — that capability limit is the
   open debt UI-ACTION-CONTAINER-CONTAINMENT-GAP.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DETECTOR_VERSION, runRules } from '../scripts/ui-conformance/rules.mjs';
import { buildEnums, readContract, readTokens } from '../scripts/ui-conformance/contract.mjs';
import * as jsScreen from '../scripts/ui-conformance/frontends/js-screen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

/** The canonical footer contract, spelled once. */
const FOOTER_DIVIDER = '1px solid var(--rv-border-soft)';
const FOOTER_PADDING_TOP = '11px';
const FOOTER_GAP = '8px';
const MARKER = "'data-card-actions': ''";

/* ---------- the first-party runtime, as the browser really loads it ---------- */

const INDEX = read('index.html');
const LOCAL_SCRIPTS = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:|^\/\//.test(src))
  .map((src) => src.split('?')[0]);
const RUNTIME = LOCAL_SCRIPTS.map((rel) => ({ rel, text: read(rel) }));

/* ============================================================
   1 · the pass closed the rule it owns
   ============================================================ */

test('1 · the detector version was raised for the pass-5 semantic correction', () => {
  assert.equal(DETECTOR_VERSION, '1.0.6');
  assert.equal(BASELINE.detector_version, '1.0.6');
});

test('2 · UIC-008 reports zero blocking and zero coverage', () => {
  const uic008 = rule('UIC-008');
  assert.equal(uic008.blocking, 0, 'a marked footer row is misaligned');
  assert.equal(uic008.coverage_gaps, 0, 'a card-action row stayed unproven');
  assert.equal(uic008.total, 0);
  assert.equal(BASELINE.findings.filter((f) => f.rule_id === 'UIC-008').length, 0);
});

test('3 · the inventory the pass was measured over is unchanged', () => {
  assert.equal(BASELINE.inventory.application.count, 66);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  // 966 at the pass-5 checkpoint; pass 6 removed its own 80 UIC-005 findings
  // (966 -> 886) and pass 7 removed 15 UIC-006 plus the 6 UIC-000 gaps that
  // described style expressions ON the deleted native selects (886 -> 865);
  // phase-5 pass 8 then added two UIC-000 gaps for the Cadastros » Parâmetros
  // derived width owner (865 -> 867, coverage 543 -> 545).
  // SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION. B1 moved the specialized
  // controls' inline styles into css/tokens.css, which the detector does not
  // read, so nine UIC-000 coverage gaps and two UIC-009 references stopped
  // existing as JavaScript declarations: 867 -> 856, coverage 545 -> 536,
  // debt 322 -> 320. B1 ADDED no finding to any rule.
  //
  // PEDIDO-SCREEN-GROUP-1 FORWARD CORRECTION. The Pedido creation and editing
  // screen group ADDED no finding to any rule and REMOVED two UIC-000 coverage
  // gaps: 856 -> 854, coverage 536 -> 534. Both removals are the same
  // mechanical cause — a pre-existing style that was WRAPPED across lines as
  // `'a' + ' b'`, which the js-screen front-end reports as
  // CONCATENATED_STYLE_EXPRESSION, became a single decodable literal (the
  // "Dados gerais" grid in pedido-form.js and cliente-pedido-form.js). Nothing
  // was suppressed: two declarations that were invisible to every rule are now
  // visible to every rule, and both are conforming.
  // Debt (320), inventory (66), coverage FULL 31 / PARTIAL 36 and every
  // per-rule blocking count are unchanged.
  assert.equal(BASELINE.findings.length, 854);
  assert.equal(BASELINE.summary_by_rule['UIC-000'].total, 534);
  assert.equal(BASELINE.summary_by_rule['UIC-009'].debt, 320);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
});

test('4 · the blanket ACTION_ROW_UNPROVEN branch no longer exists', () => {
  // Reading CODE only: the module names the removed branch in prose precisely
  // to record that it was removed and why.
  const raw = read('scripts/ui-conformance/rules.mjs');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/ACTION_ROW_UNPROVEN/.test(code), 'the blanket coverage branch is still present');
  assert.match(raw, /ACTION_ROW_UNPROVEN/, 'the removal is no longer explained in the module');
  const ruleFn = /function ruleCardActions\([\s\S]*?\n}/.exec(code)[0];
  assert.ok(!/insideCard/.test(ruleFn), 'ruleCardActions still gates on insideCard');
  assert.ok(!/declarations\.length/.test(ruleFn), 'a per-file declaration heuristic survived');
});

/* ============================================================
   2 · THE EXACT PROVEN FOOTER POPULATION — four rows

   Frozen by semantic signature, never by line number.
   ============================================================ */

const PROVEN_FOOTERS = [
  {
    id: 'cadastros-parametros-footer',
    path: 'js/screens/cadastros.js',
    owner: 'screenCadastrosParametros → render(), footer appended last to the card <section>',
    kind: 'SPLIT_INFORMATION_FOOTER',
    left: 'operational metadata (buildFooterMeta)',
    right: 'action group: Cancelar alteracoes + Salvar parametros',
    align: 'space-between',
    controls: 2,
    signature:
      /const footer = window\.el\('div', \{\s*\n\s*'data-card-actions': '',\s*\n\s*style: '([^']*)'/,
  },
  {
    id: 'pedido-detail-op-summary-footer',
    path: 'js/screens/pedido-detail-render.js',
    owner: 'OP summary card, footer is the last positional child',
    kind: 'SPLIT_RISK_FOOTER',
    left: 'non-destructive group: Ver OP / Confirmar / movement / Documentos',
    right: 'destructive action isolated: Excluir OP',
    align: 'space-between',
    controls: 5,
    signature:
      /window\.el\('div', \{\s*\n\s*'data-card-actions': '',\s*\n\s*style: '([^']*)',\s*\n\s*\}/,
  },
  {
    id: 'pedido-form-post-save-footer',
    path: 'js/screens/pedido-form.js',
    owner: 'buildPostSaveResumo(), last child of the post-save summary card',
    kind: 'STANDARD_ACTION_FOOTER',
    left: null,
    right: 'action group: Ver pedido + Abrir OP',
    align: 'flex-end',
    controls: 2,
    signature:
      /style: '([^']*)',\s*\n\s*'data-post-save-actions': 'right',\s*\n\s*'data-card-actions': '',/,
  },
  {
    id: 'cliente-pedido-form-post-save-footer',
    path: 'js/screens/cliente-pedido-form.js',
    owner: 'buildPostSaveResumo(), last child of the post-save summary card',
    kind: 'STANDARD_ACTION_FOOTER',
    left: null,
    right: 'action group: Ver meus pedidos + Criar novo pedido',
    align: 'flex-end',
    controls: 2,
    signature:
      /style: '([^']*)',\s*\r?\n\s*'data-post-save-actions': 'cliente',\s*\r?\n\s*'data-card-actions': '',/,
  },
  /*
   * PEDIDO-SCREEN-GROUP-1 — TWO NEW MARKED FOOTERS.
   *
   * These are not newly built rows: both existed as the save/cancel row at the
   * bottom of an editing card and both declared their geometry through Tailwind
   * utilities (`flex justify-end gap-2 pt-4 border-t mt-4`), with an inherited
   * divider colour and a `pt-4` the UIC-008 rule cannot decode. They were part
   * of the screen-local population that UI-ACTION-CONTAINER-CONTAINMENT-GAP
   * records as OPEN and unclaimed.
   *
   * The ACTION-CONTAINMENT-A1 order CANCELLED the global A2 closure phase and
   * ruled that local action containment is corrected INSIDE each future screen
   * batch. This is that correction for the Pedido editing screens: the two rows
   * now declare the contract with `data-card-actions` and carry the canonical
   * STANDARD_ACTION_FOOTER geometry, so they are proved here rather than left
   * unproven. The open debt shrinks by exactly these two rows; every other
   * screen-local container it names stays open and stays unclaimed.
   */
  {
    id: 'pedido-edit-dados-gerais-footer',
    path: 'js/screens/pedido-edit.js',
    owner: 'buildForm(), last child of the "Dados gerais do pedido" card',
    kind: 'STANDARD_ACTION_FOOTER',
    left: null,
    right: 'action group: Cancelar + Salvar alterações',
    align: 'flex-end',
    controls: 2,
    signature:
      /style: '([^']*)',\s*\r?\n\s*'data-pedido-edit-actions': 'geral',\s*\r?\n\s*'data-card-actions': '',/,
  },
  {
    id: 'pedido-itens-edit-itens-footer',
    path: 'js/screens/pedido-itens-edit.js',
    owner: 'buildForm(), last child of the items card',
    kind: 'STANDARD_ACTION_FOOTER',
    left: null,
    right: 'action group: Cancelar + Salvar alterações',
    align: 'flex-end',
    controls: 2,
    signature:
      /style: '([^']*)',\s*\r?\n\s*'data-pedido-itens-edit-actions': 'itens',\s*\r?\n\s*'data-card-actions': '',/,
  },
];

test('5 · PROVEN_CARD_FOOTER_COUNT = 6 and MARKED_PROVEN_CARD_FOOTER_COUNT = 6', () => {
  assert.equal(PROVEN_FOOTERS.length, 6);
  for (const f of PROVEN_FOOTERS) {
    const text = read(f.path);
    assert.match(text, f.signature, `${f.id}: the marked footer disappeared or changed shape`);
  }
  // Exactly four markers exist in the whole first-party runtime, one per owner.
  const perFile = new Map();
  for (const { rel, text } of RUNTIME) {
    const n = text.split("'data-card-actions'").length - 1;
    if (n) perFile.set(rel, n);
  }
  assert.deepEqual(
    [...perFile.entries()].sort(),
    PROVEN_FOOTERS.map((f) => [f.path, 1]).sort(),
    'the marked footer population changed (HARD STOP — CARD FOOTER POPULATION CHANGED)',
  );
  const total = [...perFile.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 6, `MARKED_PROVEN_CARD_FOOTER_COUNT = ${total}`);
});

test('6 · NONCONFORMING_PROVEN_CARD_FOOTER_COUNT = 0', () => {
  const offenders = [];
  for (const f of PROVEN_FOOTERS) {
    const style = f.signature.exec(read(f.path))[1];
    const get = (prop) => {
      const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style);
      return m ? m[1].trim() : null;
    };
    if (!/display\s*:\s*flex/.test(style)) offenders.push(`${f.id}: not display:flex`);
    if (get('align-items') !== 'center') offenders.push(`${f.id}: align-items ${get('align-items')}`);
    if (get('justify-content') !== f.align) offenders.push(`${f.id}: justify-content ${get('justify-content')} != ${f.align}`);
    if (get('gap') !== FOOTER_GAP) offenders.push(`${f.id}: gap ${get('gap')} != ${FOOTER_GAP}`);
    if (get('border-top') !== FOOTER_DIVIDER) offenders.push(`${f.id}: divider ${get('border-top')}`);
    if (get('padding-top') !== FOOTER_PADDING_TOP) offenders.push(`${f.id}: padding-top ${get('padding-top')}`);
    // A shorthand `padding` would leave padding-top undecodable to the rule.
    if (/(?:^|;)\s*padding\s*:/.test(style)) offenders.push(`${f.id}: padding shorthand hides padding-top`);
  }
  assert.deepEqual(offenders, [], `NONCONFORMING_PROVEN_CARD_FOOTER_COUNT = ${offenders.length}`);
});

test('7 · the ratified layout kinds are exactly the three the contract allows', () => {
  const kinds = new Set(PROVEN_FOOTERS.map((f) => f.kind));
  for (const k of kinds) {
    assert.ok(
      ['STANDARD_ACTION_FOOTER', 'SPLIT_INFORMATION_FOOTER', 'SPLIT_RISK_FOOTER'].includes(k),
      `unratified footer layout ${k}`,
    );
  }
  // A split layout keeps a real left group; a standard layout has none.
  for (const f of PROVEN_FOOTERS) {
    if (f.kind === 'STANDARD_ACTION_FOOTER') {
      assert.equal(f.left, null, `${f.id}: a standard footer must not carry left content`);
      assert.equal(f.align, 'flex-end');
    } else {
      assert.ok(f.left, `${f.id}: a split footer must declare its left role`);
      assert.equal(f.align, 'space-between');
    }
  }
});

test('8 · the two post-save markers are preserved', () => {
  assert.match(read('js/screens/pedido-form.js'), /'data-post-save-actions': 'right'/);
  assert.match(read('js/screens/cliente-pedido-form.js'), /'data-post-save-actions': 'cliente'/);
});

test('9 · the split footers keep their distinct left and right groups', () => {
  // SPLIT_RISK_FOOTER: the destructive action is a SIBLING of the primary
  // group, never inside it. Collapsing them would erase the separation.
  const render = read('js/screens/pedido-detail-render.js');
  const block = /'data-card-actions': '',[\s\S]{0,3000}?\n    \);/.exec(render)[0];
  assert.match(block, /buildFooterAction\('Ver OP'/, 'primary group lost');
  assert.match(block, /excluirOpRelacionada/, 'destructive action lost');
  assert.ok(
    block.indexOf('buildFooterAction(\'Ver OP\'') < block.indexOf('excluirOpRelacionada'),
    'the destructive action must stay on the right of the primary group',
  );
  // SPLIT_INFORMATION_FOOTER: metadata is appended before the action group.
  const cadastros = read('js/screens/cadastros.js');
  assert.match(cadastros, /footer\.appendChild\(buildFooterMeta\(latestMeta\)\)/);
  assert.match(cadastros, /footer\.appendChild\(actions\)/);
  assert.ok(
    cadastros.indexOf('footer.appendChild(buildFooterMeta(latestMeta))') <
      cadastros.indexOf('footer.appendChild(actions)'),
    'metadata must stay left of the action group',
  );
  assert.match(cadastros, /card\.appendChild\(footer\)/, 'the footer is no longer the card’s child');
});

/* ============================================================
   3 · THE FIVE PROVEN MODAL ACTION BARS — explicitly NOT footers
   ============================================================ */

/* ------------------------------------------------------------------
   ACTION-CONTAINMENT-A1 §6 · THE MODAL ACTION BAR HAS ONE OWNER

   R1 of this suite pinned FIVE modal action bars by matching INLINE STYLE
   TEXT. That inventory was incomplete by construction: the generic
   `modal()` bar in js/ui.js declared its geometry through Tailwind
   utilities (`px-6 py-4 border-t border-[#eceef1] flex justify-end gap-2`)
   and therefore never matched the regex — even though it is reached from
   more call sites than the other five combined, and is what every
   `confirmDialog()` renders.

   The six bars also disagreed: gap 8 / 10 / 12px, horizontal padding
   20 / 22 / 24px, and three different dividers including a literal
   #eceef1.

   A1 replaced the text inventory with a ROLE. `modalActionBar()` in
   js/ui.js is the single owner, it stamps `data-rv-modal-actions`, and
   the six surfaces are now one definition plus five screen-local
   consumers. The guard below counts the ROLE, so a Tailwind-classed bar
   can never escape it again.
   ------------------------------------------------------------------ */

const MODAL_ACTION_BAR_CONSUMERS = [
  { id: 'cadastros-modal-bar', path: 'js/screens/cadastros.js', owner: 'cadastros modal shell' },
  { id: 'admin-usuarios-modal-bar', path: 'js/screens/admin-usuarios-modal.js', owner: 'admin-usuarios modal shell' },
  { id: 'movement-modal-bar', path: 'js/screens/pedido-detail-events.js', owner: 'movement modal (720px)' },
  { id: 'secondary-modal-bar', path: 'js/screens/pedido-detail-events.js', owner: 'secondary modal (520px)' },
  { id: 'cliente-add-item-modal-bar', path: 'js/screens/cliente-pedido-form.js', owner: 'add-item modal' },
];

/** The one canonical geometry, spelled once, exactly as the owner emits it. */
const MODAL_BAR_CANONICAL = {
  'display': 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  'gap': '10px',
  'padding': '14px 20px',
  'border-top': '1px solid var(--rv-border-soft)',
};

const UI = read('js/ui.js');
/**
 * Every real `modalActionBar(` CALL in the runtime. Comment lines and the
 * `function modalActionBar(` declaration are excluded, so the doc block that
 * spells the usage can never inflate the population.
 */
const barCallSites = () => {
  const per = new Map();
  for (const { rel, text } of RUNTIME) {
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (/function\s+modalActionBar\s*\(/.test(line)) continue;
      for (const _ of line.matchAll(/(?:window\.)?modalActionBar\s*\(/g)) n += 1;
    }
    if (n > 0) per.set(rel, n);
  }
  return per;
};

test('10 · MODAL_ACTION_BAR_COUNT = 6, one owner and five screen-local consumers', () => {
  // 10a · exactly one definition of the role, and it lives in the shared runtime.
  const definitions = RUNTIME.filter((f) => /function modalActionBar\s*\(/.test(f.text));
  assert.deepEqual(
    definitions.map((f) => f.rel),
    ['js/ui.js'],
    'CANONICAL_MODAL_ACTION_BAR_OWNER_COUNT must be 1, in js/ui.js',
  );

  // 10b · the owner stamps the contract attribute and the canonical geometry.
  assert.match(UI, /'data-rv-modal-actions':\s*''/, 'the owner stopped declaring its role');
  // The declaration spans two concatenated lines; the file is CRLF.
  const decl = /const MODAL_ACTION_BAR_STYLE = ([\s\S]*?);\r?\n/.exec(UI);
  assert.ok(decl, 'MODAL_ACTION_BAR_STYLE is no longer a single declaration');
  const style = decl[1].replace(/['+\r\n]/g, ' ');
  for (const [prop, value] of Object.entries(MODAL_BAR_CANONICAL)) {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style);
    assert.ok(m, `the canonical bar declares no ${prop}`);
    assert.equal(m[1].trim(), value, `${prop} drifted off the canonical value`);
  }

  // 10c · the six surfaces: one owner + five consumers, at the exact files.
  const per = barCallSites();
  assert.deepEqual(
    [...per.entries()].sort(),
    [
      ['js/screens/admin-usuarios-modal.js', 1],
      ['js/screens/cadastros.js', 1],
      ['js/screens/cliente-pedido-form.js', 1],
      ['js/screens/pedido-detail-events.js', 2],
      ['js/ui.js', 1],
    ],
    'the modal action-bar population changed (HARD STOP — MODAL BAR INVENTORY CHANGED)',
  );
  const consumers = [...per.entries()]
    .filter(([rel]) => rel !== 'js/ui.js')
    .reduce((a, [, n]) => a + n, 0);
  assert.equal(consumers, 5, `SCREEN_LOCAL_MODAL_ACTION_BAR_CONSUMER_COUNT = ${consumers}`);
  assert.equal(MODAL_ACTION_BAR_CONSUMERS.length, 5);
  assert.equal(consumers + 1, 6, 'MODAL_ACTION_BAR_COUNT must be 6');
});

test('10b · no modal action bar reimplements the geometry locally', () => {
  // The five consumers must OWN nothing: no gap-12, no 22px padding, no
  // var(--rv-border) divider on a flex-end bar, and no #eceef1 anywhere in a
  // modal action bar. The regex that used to BE the inventory now proves the
  // opposite — that no inline bar geometry survives.
  const LEGACY_INLINE_BAR =
    /display:\s*flex;[^"'`]*justify-content:\s*flex-end;[^"'`]*padding:\s*14px\s+2[024]px;[^"'`]*border-top:\s*1px solid var\(--rv-border\b/g;
  const LEGACY_TAILWIND_BAR = /border-t border-\[#eceef1\][^"'`]*flex justify-end/g;
  const offenders = [];
  for (const { rel, text } of RUNTIME) {
    for (const m of text.matchAll(LEGACY_INLINE_BAR)) offenders.push(`${rel}: inline bar ${m[0].slice(0, 60)}`);
    for (const m of text.matchAll(LEGACY_TAILWIND_BAR)) offenders.push(`${rel}: tailwind bar ${m[0].slice(0, 60)}`);
  }
  assert.deepEqual(offenders, [], 'a modal action bar still declares its own geometry');
  // And the literal that made the generic bar invisible is gone from js/ui.js.
  assert.ok(!/#eceef1[^"'`]*flex justify-end/.test(UI), 'the generic bar kept its literal divider');
});

test('10c · a modal action bar is never a card footer', () => {
  // The two roles stay disjoint: `data-rv-modal-actions` and
  // `data-card-actions` may never appear in the same attribute object.
  for (const { rel, text } of RUNTIME) {
    for (const m of text.matchAll(/'data-rv-modal-actions':\s*''/g)) {
      const around = text.slice(Math.max(0, m.index - 300), m.index + 300);
      assert.ok(
        !/'data-card-actions'/.test(around),
        `${rel}: a modal action bar was marked as a card footer`,
      );
    }
  }
  // Symmetrically: a marked card footer keeps the FOOTER geometry, never the
  // bar's full-bleed padding. The two contracts must stay distinguishable.
  for (const f of PROVEN_FOOTERS) {
    const style = f.signature.exec(read(f.path))[1];
    assert.ok(
      !/padding\s*:\s*14px\s+20px/.test(style),
      `${f.id}: a card footer adopted modal-action-bar padding`,
    );
    assert.match(style, /padding-top\s*:\s*11px/, `${f.id}: lost the footer padding-top`);
  }
});

/* ------------------------------------------------------------------
   A1 §7 · §8 — the page-header and table-row action owners
   ------------------------------------------------------------------ */

test('10d · pageHeader() is the single page-header action-group owner', () => {
  assert.match(UI, /'data-rv-page-actions':\s*''/, 'the page-header action group lost its role');
  // Exactly one owner in the whole runtime.
  const owners = RUNTIME.filter((f) => /'data-rv-page-actions':\s*''/.test(f.text));
  assert.deepEqual(owners.map((f) => f.rel), ['js/ui.js'], 'pageHeader shared action owner must be 1');
  // The group's existing layout is preserved, not redesigned.
  assert.match(UI, /'data-rv-page-actions':\s*'',\s*class:\s*'flex gap-2'/);

  // Call sites REDERIVED from current source (A1 §12.2 forbids reusing a
  // reported number). Comment lines that merely NAME the helper are excluded,
  // which is why this is 13 and not the 17 raw textual hits.
  const sites = [];
  for (const { rel, text } of RUNTIME) {
    if (rel === 'js/ui.js') continue;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      for (const _ of line.matchAll(/(?:window\.)?pageHeader\s*\(/g)) sites.push(rel);
    }
  }
  assert.equal(sites.length, 13, `pageHeader call sites = ${sites.length}`);
  assert.equal(new Set(sites).size, 6, 'pageHeader consumer files');
  // Not one call site was edited: the owner absorbed the whole change.
  assert.deepEqual([...new Set(sites)].sort(), [
    'js/screens/cadastros.js',
    'js/screens/cliente-pedido-detail.js',
    'js/screens/fornecedor.js',
    'js/screens/op-latex-admin.js',
    'js/screens/pedido-edit.js',
    'js/screens/pedido-itens-edit.js',
  ]);
});

test('10e · dataTable() is the single row-action owner', () => {
  const owners = RUNTIME.filter((f) => /'data-rv-table-actions':\s*''/.test(f.text));
  assert.deepEqual(owners.map((f) => f.rel), ['js/ui.js'], 'dataTable shared action owner must be 1');
  // The role lands on the header cell AND on the value cell — the whole
  // column — and nowhere else.
  assert.equal((UI.match(/'data-rv-table-actions':\s*''/g) || []).length, 2,
    'the action column must declare exactly its header and its value cell');
  assert.match(UI, /el\('th',\s*\{\s*'data-rv-table-actions':\s*'',\s*class:\s*'px-4 py-3 text-right/);
  assert.match(UI, /el\('td',\s*\{\s*'data-rv-table-actions':\s*'',\s*class:\s*'px-4 py-3 text-right'/);
  // Right alignment, order, classes and numeric metadata are untouched.
  assert.match(UI, /if \(layout\[i\]\.numeric\) attrs\['data-num'\] = '1';/);
  assert.match(UI, /const cls = a\.class \|\| 'text-blue-700 hover:underline';/);
  // `data-num` must never land on the action column. Checked on the two real
  // attribute objects, not by scanning prose: the surrounding comments name
  // both attributes, so a loose scan would match its own documentation.
  for (const m of UI.matchAll(/\{\s*'data-rv-table-actions':\s*''[^}]*\}/g)) {
    assert.ok(!/data-num/.test(m[0]), 'data-num leaked onto the action column');
  }

  const sites = [];
  for (const { rel, text } of RUNTIME) {
    if (rel === 'js/ui.js') continue;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      for (const _ of line.matchAll(/(?:window\.)?dataTable\s*\(/g)) sites.push(rel);
    }
  }
  assert.equal(sites.length, 6, `dataTable call sites = ${sites.length}`);
  assert.equal(new Set(sites).size, 4, 'dataTable consumer files');
});

test('10f · row actions were NOT converted to the 30x30 actionButton primitive', () => {
  // A1 explicitly forbids that conversion; it belongs to a later order.
  const cell = /if \(hasActions\) \{[\s\S]*?tr\.appendChild\(td\);/.exec(UI)[0];
  assert.ok(!/actionButton/.test(cell), 'dataTable row actions were converted to actionButton');
  assert.match(cell, /el\('button', \{ class: 'text-sm ml-3 ' \+ cls/);
});

test('11 · no page-header, table-row, pagination, rail or inline action is marked', () => {
  // The marker may only appear in the four proven owners, and exactly once.
  const owners = new Set(PROVEN_FOOTERS.map((f) => f.path));
  for (const { rel, text } of RUNTIME) {
    const n = text.split("'data-card-actions'").length - 1;
    if (!n) continue;
    assert.ok(owners.has(rel), `${rel}: an unproven file carries the card-footer marker`);
    assert.equal(n, 1, `${rel}: more than one marker in a proven owner`);
  }
  assert.equal(
    [...RUNTIME].filter((f) => f.text.includes("'data-card-actions'")).length,
    6,
    'FALSELY_MARKED_PROVEN_NONFOOTER_COUNT must be 0',
  );
});

/* ============================================================
   4 · coarse runtime inventory, preserved by this pass
   ============================================================ */

/*
 * PASS-5-CARD-SHAPED-INVENTORY-FORWARD-CORRECTION-A2
 *
 * Phase-5 pass 7 deleted EIGHT card-shaped declarations. Every one was a
 * visual facade wrapped around a native <select>, or the shared style constant
 * feeding such a facade — never a business card. The canonical select popover
 * now owns that box itself, and it declares its border, radius and background
 * on separate lines, so it contributes none.
 *
 * The action inventory is the invariant that matters here and it did NOT move:
 * ACTION_CONSTRUCTION_COUNT and ACTION_BEARING_FILE_COUNT are unchanged, so no
 * business action was added or removed.
 */
const PASS7_REMOVED_SELECT_FACADES = [
  ['js/screens/admin-usuarios.js', 248, 1, 'selectStyle const shared by both toolbar filters'],
  ['js/screens/ops-list.js', 88, 1, 'buildSelectLike facade over the hidden native select'],
  ['js/screens/pedidos-list.js', 209, 1, 'buildSelectLike facade over the hidden native select'],
  ['js/screens/pedido-item-row-editor.js', 125, 1, 'selectStyle() return for the inline Tipo/Modelo selects'],
  ['js/screens/cliente-pedido-form.js', 242, 1, 'recebimentoWrap bordered facade'],
  ['js/screens/cliente-pedido-form.js', 283, 1, 'inline Modelo cell select style'],
  ['js/screens/cliente-pedido-form.js', 430, 2, 'tipoWrap + modeloWrap bordered facades'],
];

const PASS7_FACADE_REMOVED_COUNT = PASS7_REMOVED_SELECT_FACADES
  .reduce((n, r) => n + r[2], 0);

/*
 * SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION
 *
 * B1 deleted THREE more card-shaped declarations. Every one was a multiline
 * TEXTAREA's inline style, which satisfies this coarse heuristic only because
 * it declares a surface background, a 1px --rv-border-strong border and a
 * radius on one line. None was a business card: css/tokens.css now owns that
 * box through the canonical `.rv-textarea` role.
 *
 * The action inventory moved by exactly ONE construction, for a mechanical
 * reason rather than a behavioural one: the shell's visually hidden
 * compatibility logout is no longer spelled as a literal `el('button', ...)`
 * in the screen because window.visuallyHidden() builds it, so this coarse
 * counter still sees the `onclick:` and no longer sees the `el('button'`. The
 * action is unchanged and tests/screens-common.smoke.js still proves the click
 * reaches window.logout.
 */
const B1_REMOVED_TEXTAREA_BOXES = [
  ['js/screens/cliente-pedido-form.js', 2, 'item observation + general instructions textarea boxes'],
  ['js/screens/pedido-form.js', 1, 'general instructions autosizing textarea box'],
];

const B1_TEXTAREA_REMOVED_COUNT = B1_REMOVED_TEXTAREA_BOXES
  .reduce((n, r) => n + r[1], 0);

/*
 * PEDIDO-SCREEN-GROUP-1 FORWARD CORRECTION — the counter moves by THREE, and
 * NO business action was added or removed.
 *
 * The batch converted three row actions from a bare `<span>` carrying an SVG
 * and (for two of them) an `onclick:` into `window.actionButton(...)`, the
 * ratified 30x30 row-action owner. A span is not focusable, does not respond
 * to Enter/Space and reaches assistive technology unnamed — so the DESTRUCTIVE
 * "remove this item from the order" action existed for mouse users only. The
 * click behaviour is byte-for-byte the same function.
 *
 * The counter is coarse and matches THREE alternatives, so the same action can
 * be counted once or twice depending only on how it is SPELLED:
 *
 *   before                                            matches
 *     el('span', { onclick: fn })                     onclick:                  1
 *     el('span', { title })            (edit, no handler, decorative)           0
 *   after
 *     actionButton({ onclick: fn })    actionButton( + onclick:                 2
 *     actionButton({ disabled: true }) actionButton(                            1
 *
 * cliente-pedido-form.js: remove 1 -> 2 (+1), edit 0 -> 1 (+1).
 * pedido-item-row-editor.js: remove 1 -> 2 (+1).
 * Total +3. ACTION_BEARING_FILE_COUNT is unchanged: all three files already
 * bore actions.
 */
const SCREEN_GROUP_1_ACTION_BUTTON_MIGRATIONS = [
  ['js/screens/cliente-pedido-form.js', 'remove item (destructive)', 1, 2],
  ['js/screens/cliente-pedido-form.js', 'edit item (disabled placeholder)', 0, 1],
  ['js/screens/pedido-item-row-editor.js', 'remove item (destructive)', 1, 2],
];
const SCREEN_GROUP_1_ACTION_DELTA = SCREEN_GROUP_1_ACTION_MIGRATION_DELTA();
function SCREEN_GROUP_1_ACTION_MIGRATION_DELTA() {
  return SCREEN_GROUP_1_ACTION_BUTTON_MIGRATIONS.reduce((n, r) => n + (r[3] - r[2]), 0);
}

/**
 * PEDIDO-SCREEN-GROUP-1 FORWARD CORRECTION — this counter is measured over
 * COMMENT-STRIPPED code.
 *
 * A1 already established this discipline for the pageHeader / dataTable
 * call-site counts, precisely because prose that NAMES a primitive was
 * inflating them. Test 12 was never given the same treatment, so a comment
 * explaining why a row action moved to `actionButton()` counted as two extra
 * actions — the guard was measuring documentation, not the product.
 *
 * Stripping comments does not weaken the guard: it still fails on any real
 * action added or removed anywhere in the first-party runtime. It removes a
 * false signal, and it is what makes the +3 arithmetic below the REAL delta.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('12 · the coarse action inventory is unchanged by this pass', () => {
  const ACTION = /(?:window\.)?el\(\s*'button'|(?:window\.)?actionButton\s*\(|onclick\s*:/g;
  let constructions = 0;
  let bearingFiles = 0;
  let cardShaped = 0;
  for (const { text: raw } of RUNTIME) {
    const text = stripComments(raw);
    ACTION.lastIndex = 0;
    const n = (text.match(ACTION) || []).length;
    if (n) { bearingFiles += 1; constructions += n; }
    for (const ln of text.split(/\r?\n/)) {
      if (/background:\s*var\(--rv-surface\)/.test(ln)
        && /border:\s*1px solid var\(--rv-border\b/.test(ln)
        && /border-radius/.test(ln)) cardShaped += 1;
    }
  }
  // A change here must be explained exactly and must never represent a new or
  // removed business action. Pass 5 added no control and removed none, and
  // pass 7 added none either: it replaced controls one for one.
  // B1: 485 minus the ONE literal el('button') the shell's visually hidden
  // logout no longer spells itself. The action is not gone: its `onclick:` is
  // still counted here and the click still reaches window.logout.
  //
  // SCREEN-GROUP-1 REDERIVATION. The figure this guard carried, 484, was a RAW
  // text count that included TWELVE prose matches — comments across the runtime
  // that spell `onclick:` or `el('button'` while explaining something. Measured
  // over comment-stripped code, the same entry tree (f6986bb) yields 472. This
  // is the identical correction A1 applied to the pageHeader and dataTable
  // call-site counts, for the identical reason, and it changes no product fact:
  // it removes documentation from a product measurement.
  const ENTRY_CONSTRUCTIONS_REDERIVED = 472;
  // SCREEN-GROUP-1's own delta is +3, entirely from SPELLING — three row
  // actions moved from `el('span', …)` to the canonical `actionButton(…)`
  // owner. See SCREEN_GROUP_1_ACTION_BUTTON_MIGRATIONS for the per-site
  // arithmetic. No business action was added or removed.
  assert.equal(SCREEN_GROUP_1_ACTION_DELTA, 3);
  assert.equal(constructions, ENTRY_CONSTRUCTIONS_REDERIVED + SCREEN_GROUP_1_ACTION_DELTA,
    `ACTION_CONSTRUCTION_COUNT = ${constructions}`);
  assert.equal(constructions, 475, `ACTION_CONSTRUCTION_COUNT = ${constructions}`);
  assert.equal(bearingFiles, 39, `ACTION_BEARING_FILE_COUNT = ${bearingFiles}`);
  // A2: 133 at the pass-5 checkpoint, minus the eight pass-7 select facades,
  // minus the three B1 textarea boxes, plus the fifteen SCREEN-GROUP-1 cards.
  assert.equal(PASS7_FACADE_REMOVED_COUNT, 8);
  assert.equal(B1_TEXTAREA_REMOVED_COUNT, 3);
  assert.equal(SCREEN_GROUP_1_CARD_ADDED_COUNT, 15);
  assert.equal(
    cardShaped,
    133 - PASS7_FACADE_REMOVED_COUNT - B1_TEXTAREA_REMOVED_COUNT + SCREEN_GROUP_1_CARD_ADDED_COUNT,
    `CARD_SHAPED_CONSTRUCTION_COUNT = ${cardShaped}`,
  );
  assert.equal(cardShaped, 137, `CARD_SHAPED_CONSTRUCTION_COUNT = ${cardShaped}`);
});

/*
 * PEDIDO-SCREEN-GROUP-1 — why this counter RISES, and why every added line is
 * a real card rather than a heuristic false positive.
 *
 * The two Pedido editing screens declared every card through Tailwind
 * utilities (`bg-white shadow p-6`, `bg-white shadow p-4 mb-4`). Tailwind
 * classes are invisible to this heuristic, so those cards were never counted —
 * and, more importantly, they were never governed: `shadow` is a Tailwind
 * elevation that the ratified three-value enum does not contain, and the card
 * had no `--rv-border`. Declaring them with the canonical tokens makes them
 * visible to this counter for the first time.
 *
 * So the rise is the OPPOSITE of a regression: it is previously ungoverned
 * surface entering the governed population. Nothing was added to the product —
 * each of the fifteen lines is a card that already rendered on one of these two
 * screens before this batch, spelled in Tailwind.
 */
const SCREEN_GROUP_1_ADDED_CARDS = [
  ['js/screens/pedido-edit.js', 7],
  ['js/screens/pedido-itens-edit.js', 8],
];
const SCREEN_GROUP_1_CARD_ADDED_COUNT = SCREEN_GROUP_1_ADDED_CARDS
  .reduce((n, r) => n + r[1], 0);

test('12c · every card SCREEN-GROUP-1 added replaced a Tailwind-declared card', () => {
  const isCardShaped = (ln) => /background:\s*var\(--rv-surface\)/.test(ln)
    && /border:\s*1px solid var\(--rv-border\b/.test(ln)
    && /border-radius/.test(ln);
  // Tailwind card utilities are gone from both files, and the rise in this
  // counter is accounted for file by file. A card appearing anywhere else
  // still fails test 12.
  for (const [rel, expectedRise] of SCREEN_GROUP_1_ADDED_CARDS) {
    const entry = execFileSync('git', ['show', `f6986bb:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const before = entry.split(/\r?\n/).filter(isCardShaped).length;
    const after = read(rel).split(/\r?\n/).filter(isCardShaped).length;
    assert.equal(after - before, expectedRise, `${rel}: card-shaped rise`);
    // The Tailwind card language they replaced may not come back. Measured over
    // COMMENT-STRIPPED code, so the prose that records what was removed cannot
    // be mistaken for the thing itself.
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.match(strip(entry), /bg-white shadow/, `${rel}: had no Tailwind card at entry`);
    assert.ok(!/bg-white shadow/.test(strip(read(rel))), `${rel}: a Tailwind card survived`);
  }
});

test('12b · every removed card-shaped declaration was a select facade, not a card', () => {
  // Each removal is proved at its exact entry site: the declaration existed at
  // 41655c6, it is gone now, and the file still renders its selects through
  // the canonical owner. A card removed anywhere else still fails test 12.
  const isCardShaped = (ln) => /background:\s*var\(--rv-surface\)/.test(ln)
    && /border:\s*1px solid var\(--rv-border\b/.test(ln)
    && /border-radius/.test(ln);
  const byFile = new Map();
  const selectFiles = new Set();
  for (const [rel, , n] of PASS7_REMOVED_SELECT_FACADES) {
    byFile.set(rel, (byFile.get(rel) || 0) + n);
    selectFiles.add(rel);
  }
  // B1's three removals are textarea boxes, proved at the same entry commit.
  const textareaFiles = new Set();
  for (const [rel, n] of B1_REMOVED_TEXTAREA_BOXES) {
    byFile.set(rel, (byFile.get(rel) || 0) + n);
    textareaFiles.add(rel);
  }
  for (const [rel, expectedDrop] of byFile) {
    const entry = execFileSync('git', ['show', `41655c6:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const before = entry.split(/\r?\n/).filter(isCardShaped).length;
    const after = read(rel).split(/\r?\n/).filter(isCardShaped).length;
    assert.equal(before - after, expectedDrop, `${rel}: card-shaped drop`);
    // The file still builds the control whose box was removed, through the
    // canonical owner, instead of reacquiring the box locally.
    if (selectFiles.has(rel)) {
      assert.match(read(rel), /createSelectPopover\(/, `${rel} lost its select entirely`);
    }
    if (textareaFiles.has(rel)) {
      assert.match(read(rel), /window\.textArea\(/, `${rel} lost its textarea entirely`);
    }
  }
});

/* ============================================================
   5 · the capability limit this closure does NOT overcome
   ============================================================ */

test('13 · UI-ACTION-CONTAINER-CONTAINMENT-GAP is recorded, and nothing claims otherwise', () => {
  const state = JSON.parse(read('docs/governance/current-state.json'));
  const debt = state.blockers_and_material_debts.find(
    (d) => d.id === 'UI-ACTION-CONTAINER-CONTAINMENT-GAP',
  );
  assert.ok(debt, 'the containment-capability debt is not recorded');
  assert.equal(debt.blocking, false);
  // The suite must not claim the withdrawn exhaustive counter.
  const self = read('tests/ui-conformance-phase5-pass5-card-actions.test.mjs');
  assert.ok(
    !/UNCLASSIFIED_ACTION_CONTAINER_COUNT\s*=\s*0/.test(self.replace(/^.*Do not claim.*$/gm, '')),
    'this suite must not claim exhaustive container classification',
  );
});

test('14 · no scope-aware AST or fabricated containment inference was introduced', () => {
  const front = read('scripts/ui-conformance/frontends/js-screen.mjs');
  // insideCard is still the deliberate `null` the front-end has always used.
  assert.match(front, /insideCard: null/);
  assert.ok(!/require\(['"]acorn|from ['"]acorn|@babel\/parser|espree/.test(front), 'a JS parser was vendored in');
  const rules = read('scripts/ui-conformance/rules.mjs');
  assert.ok(!/acorn|@babel\/parser|espree/.test(rules), 'a JS parser was vendored in');
});

test('15 · the detector carries no path, line or value suppression', () => {
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const src of ['scripts/ui-conformance/rules.mjs', 'scripts/ui-conformance/frontends/js-screen.mjs']) {
    const code = stripComments(read(src));
    assert.ok(
      !/\b(ignoreList|IGNORE_PATHS|WAIVERS?|SUPPRESS\w*|skipFiles|EXEMPT_PATHS)\b/i.test(code),
      `${src} appears to carry a waiver or ignore mechanism`,
    );
    assert.ok(!/['"`]js\/screens\/[a-z0-9-]+\.js['"`]/.test(code), `${src} names a specific screen path`);
  }
});

/* ============================================================
   6 · non-vacuity — the rule still rejects what it must
   ============================================================ */

const CONTRACT = readContract(ROOT);
const CTX = { tokens: readTokens(ROOT), enums: buildEnums(CONTRACT) };
const probe = (src) => jsScreen.analyse('probe.js', src);
const uic008Of = (src) => runRules(probe(src), CTX).filter((f) => f.rule_id === 'UIC-008');
const row = (style) => `window.el('div', { ${MARKER}, style: '${style}' })`;
const CANON = `display:flex;align-items:center;gap:${FOOTER_GAP};border-top:${FOOTER_DIVIDER};padding-top:${FOOTER_PADDING_TOP};`;

test('16 · a marked row is evaluated even though insideCard is null', () => {
  const unit = probe(row(`justify-content:flex-end;${CANON}`));
  assert.equal(unit.actionRows.length, 1, 'the marker did not bind to a row');
  assert.equal(unit.actionRows[0].insideCard, null, 'containment must stay unknown');
  assert.deepEqual(runRules(unit, CTX).filter((f) => f.rule_id === 'UIC-008'), []);
});

test('17 · the three ratified layouts pass', () => {
  for (const jc of ['flex-end', 'space-between']) {
    assert.deepEqual(uic008Of(row(`justify-content:${jc};${CANON}`)), [], jc);
  }
});

test('18 · a missing or wrong alignment is blocking', () => {
  const missing = uic008Of(row(CANON));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].severity, 'blocking');
  assert.match(missing[0].message, /declares no justify-content/);
  for (const jc of ['center', 'flex-start', 'start', 'left', 'space-around']) {
    const found = uic008Of(row(`justify-content:${jc};${CANON}`));
    assert.ok(found.length >= 1, `${jc} was excused`);
    assert.ok(found.some((f) => /allows only flex-end or space-between/.test(f.message)), jc);
  }
});

test('19 · a missing, strong or wrong divider is blocking', () => {
  const cases = [
    ['', 'missing divider'],
    ['border-top:1px solid var(--rv-border);', 'strong divider'],
    ['border-top:1px solid var(--rv-border-strong);', 'stronger divider'],
    ['border-top:2px solid var(--rv-border-soft);', 'wrong width'],
  ];
  for (const [decl, why] of cases) {
    const found = uic008Of(row(`justify-content:flex-end;display:flex;align-items:center;gap:${FOOTER_GAP};${decl}padding-top:${FOOTER_PADDING_TOP};`));
    assert.ok(found.some((f) => f.property === 'border-top'), `${why} was excused`);
    assert.ok(found.every((f) => f.severity === 'blocking'), why);
  }
});

test('20 · a missing or wrong padding-top is blocking', () => {
  for (const [decl, why] of [['', 'missing'], ['padding-top:12px;', '12px'], ['padding-top:16px;', '16px'], ['padding:11px 24px;', 'shorthand only']]) {
    const found = uic008Of(row(`justify-content:flex-end;display:flex;align-items:center;gap:${FOOTER_GAP};border-top:${FOOTER_DIVIDER};${decl}`));
    assert.ok(found.some((f) => f.property === 'padding-top'), `${why} padding-top was excused`);
  }
});

test('21 · an unmarked row is never evaluated, and no per-file gap replaces it', () => {
  // A misaligned, dividerless row with no marker produces nothing: containment
  // is not inferred, and the blanket branch is gone.
  assert.deepEqual(uic008Of("window.el('div', { style: 'display:flex;justify-content:center;' })"), []);
  // A file full of visual declarations and buttons but no marker: still nothing.
  assert.deepEqual(
    uic008Of("window.el('div', { style: 'padding:16px;color:var(--rv-text-primary);' }, window.el('button', { style: 'height:var(--rv-h-default);' }, 'x'))"),
    [],
  );
});

test('22 · one arbitrary marker cannot silence another unmarked row', () => {
  // Two rows, one marked and conforming, one unmarked and misaligned. The
  // marked one passes on its own merit; the blanket branch that the single
  // marker used to switch off no longer exists, so nothing is silenced.
  const src = [
    row(`justify-content:flex-end;${CANON}`) + ';',
    "window.el('div', { style: 'display:flex;justify-content:center;' });",
  ].join('\n');
  assert.deepEqual(uic008Of(src), []);
  // And a marked NON-conforming row is still caught in the same file.
  const src2 = [
    row(`justify-content:flex-end;${CANON}`) + ';',
    row('justify-content:center;' + CANON) + ';',
  ].join('\n');
  const found = uic008Of(src2);
  assert.equal(found.length, 1, 'a second marked row escaped evaluation');
  assert.equal(found[0].severity, 'blocking');
});

test('23 · files with no actionable control need no marker and produce nothing', () => {
  assert.deepEqual(uic008Of("window.el('p', { style: 'font-size:13px;color:var(--rv-text-secondary);' }, 'texto')"), []);
  assert.deepEqual(uic008Of('// nothing at all'), []);
});

/* ============================================================
   7 · earlier passes remain closed
   ============================================================ */

test('24 · passes 1, 2, 3 and 4 remain closed', () => {
  for (const id of ['UIC-001', 'UIC-002', 'UIC-003', 'UIC-004', 'UIC-010']) {
    const r = rule(id);
    assert.equal(r.blocking, 0, `${id} reopened`);
    assert.equal(r.coverage_gaps, 0, `${id} gained a coverage gap`);
  }
  for (const id of ['UIC-007', 'UIC-011']) assert.equal(rule(id).total, 0, `${id} reopened`);
});

test('25 · no rule outside UIC-008 moved in this pass', () => {
  // SCREEN-GROUP-1 removed two coverage gaps and added none: two wrapped
  // style concatenations became single decodable literals. See section 3.
  assert.equal(rule('UIC-000').coverage_gaps, 534);
  // UIC-005 was 80 at the pass-5 checkpoint; the authorized pass-6 typography
  // order took it to 0 and moved nothing else. Pass 7 then took UIC-006 to 0.
  // Both are carried forward mechanically.
  assert.equal(rule('UIC-005').blocking, 0);
  assert.equal(rule('UIC-006').blocking, 0);
  assert.equal(rule('UIC-006').total, 0);
  // Pass 5's own rule is still exactly closed.
  assert.equal(rule('UIC-008').blocking, 0);
  assert.equal(rule('UIC-008').coverage_gaps, 0);
  assert.equal(rule('UIC-009').debt, 320);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
});
