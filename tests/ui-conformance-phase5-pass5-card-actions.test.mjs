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
  assert.equal(BASELINE.findings.length, 966);
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
      /style: '([^']*)',\s*\n\s*'data-post-save-actions': 'cliente',\s*\n\s*'data-card-actions': '',/,
  },
];

test('5 · PROVEN_CARD_FOOTER_COUNT = 4 and MARKED_PROVEN_CARD_FOOTER_COUNT = 4', () => {
  assert.equal(PROVEN_FOOTERS.length, 4);
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
  assert.equal(total, 4, `MARKED_PROVEN_CARD_FOOTER_COUNT = ${total}`);
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

const MODAL_ACTION_BARS = [
  { id: 'cadastros-modal-bar', path: 'js/screens/cadastros.js', owner: 'cadastros modal shell' },
  { id: 'admin-usuarios-modal-bar', path: 'js/screens/admin-usuarios-modal.js', owner: 'admin-usuarios modal shell' },
  { id: 'movement-modal-bar', path: 'js/screens/pedido-detail-events.js', owner: 'movement modal (720px)' },
  { id: 'secondary-modal-bar', path: 'js/screens/pedido-detail-events.js', owner: 'secondary modal (520px)' },
  { id: 'cliente-add-item-modal-bar', path: 'js/screens/cliente-pedido-form.js', owner: 'add-item modal' },
];

/** A modal action bar: flex-end, full-bleed padding, its own divider. */
const MODAL_BAR_RE =
  /display:flex;\s*align-items:center;\s*justify-content:flex-end;\s*gap:1[02]px;\s*padding:14px 2[02]px;\s*border-top:1px solid var\(--rv-border(?:-soft)?\)/g;

test('10 · PROVEN_MODAL_ACTION_BAR_COUNT = 5 and MARKED_MODAL_ACTION_BAR_COUNT = 0', () => {
  const perFile = new Map();
  for (const { rel, text } of RUNTIME) {
    const n = (text.match(MODAL_BAR_RE) || []).length;
    if (n) perFile.set(rel, n);
  }
  const total = [...perFile.values()].reduce((a, b) => a + b, 0);
  assert.deepEqual(
    [...perFile.entries()].sort(),
    [
      ['js/screens/admin-usuarios-modal.js', 1],
      ['js/screens/cadastros.js', 1],
      ['js/screens/cliente-pedido-form.js', 1],
      ['js/screens/pedido-detail-events.js', 2],
    ],
    'the modal action-bar population changed (HARD STOP — MODAL BAR INVENTORY CHANGED)',
  );
  assert.equal(total, 5, `PROVEN_MODAL_ACTION_BAR_COUNT = ${total}`);
  assert.equal(MODAL_ACTION_BARS.length, 5);

  // None of them carries the footer marker: a marker sits in the SAME
  // attribute object as the style, so it would appear within a few lines.
  for (const { rel, text } of RUNTIME) {
    for (const m of text.matchAll(MODAL_BAR_RE)) {
      const around = text.slice(Math.max(0, m.index - 300), m.index + 300);
      assert.ok(
        !/'data-card-actions'/.test(around),
        `${rel}: a modal action bar was marked as a card footer`,
      );
    }
  }
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
    4,
    'FALSELY_MARKED_PROVEN_NONFOOTER_COUNT must be 0',
  );
});

/* ============================================================
   4 · coarse runtime inventory, preserved by this pass
   ============================================================ */

test('12 · the coarse action inventory is unchanged by this pass', () => {
  const ACTION = /(?:window\.)?el\(\s*'button'|(?:window\.)?actionButton\s*\(|onclick\s*:/g;
  let constructions = 0;
  let bearingFiles = 0;
  let cardShaped = 0;
  for (const { text } of RUNTIME) {
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
  // removed business action. Pass 5 added no control and removed none.
  assert.equal(constructions, 485, `ACTION_CONSTRUCTION_COUNT = ${constructions}`);
  assert.equal(bearingFiles, 39, `ACTION_BEARING_FILE_COUNT = ${bearingFiles}`);
  assert.equal(cardShaped, 133, `CARD_SHAPED_CONSTRUCTION_COUNT = ${cardShaped}`);
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
  assert.equal(rule('UIC-000').coverage_gaps, 549);
  assert.equal(rule('UIC-005').blocking, 80);
  assert.equal(rule('UIC-006').blocking, 15);
  assert.equal(rule('UIC-009').debt, 322);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
});
