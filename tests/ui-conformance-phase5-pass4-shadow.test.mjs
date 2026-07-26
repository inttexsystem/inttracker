/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 4 (UIC-004)

   Proves the ELEVATION shadow property closed: every elevation shadow in the
   loaded first-party runtime resolves through --rv-shadow-none /
   --rv-shadow-sm / --rv-shadow-popover, Tailwind owns no product shadow, and
   `UIC-004` reports zero blocking and zero coverage.

   The A1 ruling corrected UIC-004 to govern ELEVATION ONLY. Two families of
   `box-shadow` are NOT elevation and are excluded by a structural predicate:

     · the ratified field FOCUS RING (contract §2.2), which is not debt; and
     · the connector KNOCKOUT HALO, which is carried by the new open debt
       UI-KNOCKOUT-HALO-CONTRACT-GAP.

   Excluded is not conforming. Sections 3 and 4 assert each site is still
   present, still owns its spelling and — for the halo — still unratified, so
   neither inventory can quietly evaporate or quietly widen.

   The former CARD_MEMBERSHIP_UNPROVEN coverage branch is gone: it required
   every non-none shadow to prove card containment, which the JavaScript
   front-end can never do, so it made the rule unclosable rather than
   informative. Section 5 asserts it cannot come back silently.
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

/** The ratified elevation enum, read from the contract rather than copied. */
const ELEVATION_LITERALS = JSON.parse(
  /"shadow":\s*(\[[^\]]*\])/.exec(read('docs/architecture/UI_VISUAL_CONTRACT.md'))[1],
);
/** The canonical spellings of those three values. */
const ELEVATION_TOKENS = ['var(--rv-shadow-none)', 'var(--rv-shadow-sm)', 'var(--rv-shadow-popover)'];

/* ---------- the first-party runtime, as the browser really loads it ---------- */

const INDEX = read('index.html');
const LOCAL_SCRIPTS = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:|^\/\//.test(src))
  .map((src) => src.split('?')[0]);

const RUNTIME = LOCAL_SCRIPTS.map((rel) => ({ rel, text: read(rel) }));
const SCREENS = RUNTIME.filter((f) => f.rel.startsWith('js/screens/'));

/** Every `box-shadow:` / `.boxShadow =` value the runtime declares statically. */
function declaredShadows() {
  const out = [];
  for (const { rel, text } of RUNTIME) {
    text.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(/box-shadow\s*:\s*([^;'"`]+)/g)) {
        out.push({ rel, line: i + 1, value: m[1].trim().replace(/\s*\+\s*$/, '').trim() });
      }
      for (const m of line.matchAll(/boxShadow\s*=\s*'([^']+)'/g)) {
        out.push({ rel, line: i + 1, value: m[1].trim() });
      }
    });
  }
  return out;
}

const SHADOWS = declaredShadows();

/** Resolve a canonical token spelling to the literal the contract ratifies. */
const TOKEN_TO_LITERAL = new Map([
  ['var(--rv-shadow-none)', 'none'],
  ['var(--rv-shadow-sm)', ELEVATION_LITERALS[1]],
  ['var(--rv-shadow-popover)', ELEVATION_LITERALS[2]],
]);

const norm = (v) => String(v).toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
const ELEVATION_SET = new Set(ELEVATION_LITERALS.map(norm));

/** The same structural predicate the detector applies, restated independently. */
function isNonElevationSpreadRing(value) {
  const text = String(value).trim();
  if (/(?:^|[\s(])inset(?:[\s)]|$)/i.test(text)) return false;
  const slots = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && ch === ',') return false;
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) slots.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) slots.push(cur);
  if (slots.length !== 5) return false;
  const zero = (s) => /^[+-]?0+(?:\.0+)?(?:px|em|rem)?$/.test(s);
  const pos = (s) => /^\+?(?:\d+\.?\d*|\.\d+)(?:px|em|rem)$/.test(s) && Number.parseFloat(s) > 0;
  const len = (s) => zero(s) || pos(s);
  let l = null;
  if (!len(slots[4]) && slots.slice(0, 4).every(len)) l = slots.slice(0, 4);
  else if (!len(slots[0]) && slots.slice(1, 5).every(len)) l = slots.slice(1, 5);
  if (!l) return false;
  return zero(l[0]) && zero(l[1]) && zero(l[2]) && pos(l[3]);
}

/* ============================================================
   1 · the pass closed the rule it owns
   ============================================================ */

test('1 · the detector version was raised for the pass-4 semantic correction', () => {
  assert.equal(DETECTOR_VERSION, '1.0.5');
  assert.equal(BASELINE.detector_version, '1.0.5');
});

test('2 · UIC-004 reports zero blocking and zero coverage', () => {
  const uic004 = rule('UIC-004');
  assert.equal(uic004.blocking, 0, 'an elevation shadow outside the enum survived');
  assert.equal(uic004.coverage_gaps, 0, 'a shadow role stayed unproven');
  assert.equal(uic004.total, 0);
  assert.equal(BASELINE.findings.filter((f) => f.rule_id === 'UIC-004').length, 0);
});

test('3 · the inventory the pass was measured over is unchanged', () => {
  assert.equal(BASELINE.inventory.application.count, 66);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(BASELINE.coverage_summary.FULL, 23);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 44);
});

/* ============================================================
   2 · the runtime ownership guard — §8 counters
   ============================================================ */

test('4 · OUT_OF_ENUM_ELEVATION_SHADOW_COUNT = 0', () => {
  const offenders = [];
  for (const { rel, line, value } of SHADOWS) {
    if (isNonElevationSpreadRing(value)) continue; // focus ring or knockout halo
    const literal = TOKEN_TO_LITERAL.has(value) ? TOKEN_TO_LITERAL.get(value) : value;
    if (ELEVATION_SET.has(norm(literal))) continue;
    offenders.push(`${rel}:${line} box-shadow:${value}`);
  }
  assert.deepEqual(offenders, [], `OUT_OF_ENUM_ELEVATION_SHADOW_COUNT = ${offenders.length}`);
});

test('5 · TAILWIND_SHADOW_UTILITY_COUNT = 0', () => {
  const offenders = [];
  const TW = /(?:^|[\s"'`])(shadow-(?:sm|md|lg|xl|2xl|inner|\[[^\]]+\]))(?=$|[\s"'`])/g;
  for (const { rel, text } of RUNTIME) {
    text.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(TW)) offenders.push(`${rel}:${i + 1} ${m[1]}`);
    });
  }
  assert.deepEqual(offenders, [], `TAILWIND_SHADOW_UTILITY_COUNT = ${offenders.length}`);
});

test('6 · CARD_NON_NONE_ELEVATION_SHADOW_COUNT = 0', () => {
  // Judged by the real front-end on the element that CARRIES the shadow.
  const offenders = [];
  for (const { rel, text } of SCREENS) {
    const unit = jsScreen.analyse(rel, text);
    if (unit.lexError) continue;
    for (const decl of unit.declarations) {
      if (decl.property !== 'box-shadow' || decl.interpolated) continue;
      if (!decl.element.isCard) continue;
      if (isNonElevationSpreadRing(decl.value)) continue;
      const literal = TOKEN_TO_LITERAL.has(decl.value) ? TOKEN_TO_LITERAL.get(decl.value) : decl.value;
      if (norm(literal) === 'none') continue;
      offenders.push(`${rel}:${unit.locate(decl.valueOffset).line} ${decl.value}`);
    }
  }
  assert.deepEqual(offenders, [], `CARD_NON_NONE_ELEVATION_SHADOW_COUNT = ${offenders.length}`);
});

test('7 · UNRESOLVED_ELEVATION_SHADOW_COUNT = 0', () => {
  // A shadow whose token does not resolve is exactly what UIC-004 reports as
  // blocking; reuse the real rule engine rather than a second grammar.
  const unresolved = BASELINE.findings.filter(
    (f) => f.rule_id === 'UIC-004' && /does not resolve/.test(f.message || ''),
  );
  assert.deepEqual(unresolved, [], `UNRESOLVED_ELEVATION_SHADOW_COUNT = ${unresolved.length}`);
});

test('8 · RENDERED_DROP_SHADOW_COUNT = 0', () => {
  const offenders = [];
  for (const { rel, text } of RUNTIME) {
    text.split(/\r?\n/).forEach((line, i) => {
      if (/drop-shadow/i.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `RENDERED_DROP_SHADOW_COUNT = ${offenders.length}`);
});

test('9 · MALFORMED_SHADOW_DECLARATION_COUNT = 0', () => {
  // `none` is not a legal member of a comma-separated layer list: such a
  // declaration is dropped by the parser and only computes to `none` by
  // accident. It is a defect, not a canonical spelling.
  const offenders = [];
  for (const { rel, line, value } of SHADOWS) {
    if (!value.includes(',')) continue;
    const topLevel = value.replace(/\([^()]*\)/g, '');
    if (!topLevel.includes(',')) continue; // commas were inside rgba() etc.
    if (/(^|,)\s*(none|var\(--rv-shadow-none\))\s*(,|$)/.test(topLevel)) {
      offenders.push(`${rel}:${line} box-shadow:${value}`);
    }
  }
  assert.deepEqual(offenders, [], `MALFORMED_SHADOW_DECLARATION_COUNT = ${offenders.length}`);
});

/* ============================================================
   3 · RATIFIED_FIELD_FOCUS_RING — contract §2.2, not debt

   These implement the existing field contract. They are preserved exactly and
   must not be converted to an elevation token.
   ============================================================ */

const FOCUS_RING_SPELLING = '0 0 0 3px var(--rv-focus-ring)';

const FOCUS_RINGS = [
  {
    id: 'admin-usuarios-modal-control',
    path: 'js/screens/admin-usuarios-modal.js',
    helper: 'applyAdminUsuariosControlStyle',
    role: 'single-line field / textarea inside the admin-usuarios modal',
    signature: /control\.addEventListener\('focus',[\s\S]{0,200}?control\.style\.boxShadow = '0 0 0 3px var\(--rv-focus-ring\)'/,
    blur: /control\.addEventListener\('blur',[\s\S]{0,200}?control\.style\.boxShadow = 'none'/,
  },
  {
    id: 'cadastros-modal-control',
    path: 'js/screens/cadastros.js',
    helper: 'applyCadastrosModalControlStyle',
    role: 'single-line field / textarea inside the cadastros modal',
    signature: /control\.addEventListener\('focus',[\s\S]{0,200}?control\.style\.boxShadow = '0 0 0 3px var\(--rv-focus-ring\)'/,
    blur: /control\.addEventListener\('blur',[\s\S]{0,200}?control\.style\.boxShadow = 'none'/,
  },
  {
    id: 'cadastros-inline-input',
    path: 'js/screens/cadastros.js',
    helper: 'styleInput',
    role: 'inline price-row input',
    signature: /input\.addEventListener\('focus',[\s\S]{0,200}?input\.style\.boxShadow = '0 0 0 3px var\(--rv-focus-ring\)'/,
    blur: /input\.addEventListener\('blur',[\s\S]{0,200}?input\.style\.boxShadow = 'none'/,
  },
];

test('10 · RATIFIED_FIELD_FOCUS_RING_COUNT = 3, each site exact', () => {
  for (const site of FOCUS_RINGS) {
    const text = read(site.path);
    assert.match(text, new RegExp(`function ${site.helper}\\b`), `${site.id}: helper ${site.helper} disappeared`);
    assert.match(text, site.signature, `${site.id}: the ratified focus ring disappeared`);
    assert.match(text, site.blur, `${site.id}: the blur reset disappeared`);
  }
  const total = RUNTIME.reduce(
    (n, { text }) => n + text.split(FOCUS_RING_SPELLING).length - 1,
    0,
  );
  assert.equal(total, 3, `RATIFIED_FIELD_FOCUS_RING_COUNT = ${total}`);
});

test('11 · the focus ring is the contract spelling, read from the contract', () => {
  const contract = read('docs/architecture/UI_VISUAL_CONTRACT.md');
  assert.match(
    contract,
    /box-shadow:\s*0 0 0 3px var\(--rv-focus-ring\)/,
    'contract §2.2 no longer specifies the field focus ring',
  );
  assert.match(read('css/tokens.css'), /--rv-focus-ring:/, '--rv-focus-ring is no longer a token');
});

/* ============================================================
   4 · UI-KNOCKOUT-HALO-CONTRACT-GAP — open, NOT ratified

   A spread ring in the surface colour, masking the connector line behind a
   timeline step. Preserved unchanged by this pass. Neither the halo nor its
   geometry is ratified, and none may be cited as precedent.
   ============================================================ */

const HALO_SPELLING = '0 0 0 4px var(--rv-surface)';

const KNOCKOUT_HALOS = [
  {
    id: 'cliente-tracking-step-halo',
    path: 'js/screens/cliente-pedido-tracking.js',
    constructor: 'circleWrapStyle string, applied to the 42px step wrapper',
    role: 'timeline step wrapper',
    geometryOwner: 'inline style: 42x42, --rv-radius-pill',
    masks: 'the vertical/horizontal connector rail drawn behind the step',
    signature: /circleWrapStyle = [\s\S]{0,300}?box-shadow:0 0 0 4px var\(--rv-surface\)/,
    occurrences: 1,
  },
  {
    id: 'pedido-detail-stage-halo-done',
    path: 'js/screens/pedido-detail-render.js',
    constructor: "buildStageNode(), stage.state === 'done' branch",
    role: 'completed progress stage node',
    geometryOwner: 'inline style: 42x42, --rv-radius-pill',
    masks: 'the connector rail between stage nodes',
    signature: /stage\.state === 'done'[\s\S]{0,300}?box-shadow:0 0 0 4px var\(--rv-surface\)/,
    occurrences: 2,
  },
  {
    id: 'pedido-detail-stage-halo-progress',
    path: 'js/screens/pedido-detail-render.js',
    constructor: 'buildStageNode(), conic-gradient progress branch',
    role: 'in-progress / future progress stage node',
    geometryOwner: 'inline style: 42x42, --rv-radius-pill',
    masks: 'the connector rail between stage nodes',
    signature: /conic-gradient\(from -90deg,[\s\S]{0,300}?box-shadow:0 0 0 4px var\(--rv-surface\)/,
    occurrences: 2,
  },
];

test('12 · OPEN_KNOCKOUT_HALO_COUNT = 3, each site exact and unchanged', () => {
  for (const site of KNOCKOUT_HALOS) {
    const text = read(site.path);
    assert.match(text, site.signature, `${site.id}: the knockout halo disappeared or moved`);
  }
  const perFile = new Map();
  for (const { rel, text } of RUNTIME) {
    const n = text.split(HALO_SPELLING).length - 1;
    if (n) perFile.set(rel, n);
  }
  assert.deepEqual(
    [...perFile.entries()].sort(),
    [
      ['js/screens/cliente-pedido-tracking.js', 1],
      ['js/screens/pedido-detail-render.js', 2],
    ],
    'the knockout-halo inventory expanded or shrank (HARD STOP — KNOCKOUT-HALO INVENTORY CHANGED)',
  );
  const total = [...perFile.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 3, `OPEN_KNOCKOUT_HALO_COUNT = ${total}`);
});

test('13 · the knockout halo is not ratified as an elevation role', () => {
  // It must never acquire a canonical elevation token: that would silently
  // promote an open debt into a ratified role.
  for (const site of KNOCKOUT_HALOS) {
    const text = read(site.path);
    for (const token of ELEVATION_TOKENS.filter((t) => t !== 'var(--rv-shadow-none)')) {
      assert.ok(
        !new RegExp(`border-radius:var\\(--rv-radius-pill\\)[^;]*;[^\\n]*box-shadow:${token.replace(/[()\\-]/g, '\\$&')}`).test(text),
        `${site.id}: a halo site acquired ${token}`,
      );
    }
  }
});

/* ============================================================
   5 · UI-SPECIALIZED-CONTROL-CONTRACT-GAP — the two switch knobs

   Their var(--rv-shadow-sm) is a member of the canonical elevation enum, but
   this pass does NOT ratify the switch component, its geometry or its shadow
   as precedent for any other component.
   ============================================================ */

const SWITCH_KNOBS = [
  { id: 'entrega-defeito-knob', path: 'js/screens/entrega-form.js', helper: 'defeitoToggle' },
  { id: 'manta-defeito-knob', path: 'js/screens/manta-output-form.js', helper: 'defeitoToggle' },
];

const KNOB_SIGNATURE =
  /el\('span', \{\s*\n?\s*style: 'position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:var\(--rv-radius-pill\);background:var\(--rv-surface\);box-shadow:var\(--rv-shadow-sm\);transition:transform \.15s ease;',/;

test('14 · SPECIALIZED_SWITCH_KNOB_SHADOW_COUNT = 2, geometry and shadow preserved', () => {
  let total = 0;
  for (const knob of SWITCH_KNOBS) {
    const text = read(knob.path);
    assert.match(text, new RegExp(`${knob.helper}\\b`), `${knob.id}: helper disappeared`);
    assert.match(text, KNOB_SIGNATURE, `${knob.id}: the knob geometry or shadow changed`);
    total += (text.match(new RegExp(KNOB_SIGNATURE.source, 'g')) || []).length;
  }
  assert.equal(total, 2, `SPECIALIZED_SWITCH_KNOB_SHADOW_COUNT = ${total}`);
});

test('15 · the three non-elevation and specialized inventories are disjoint', () => {
  const focus = new Set(FOCUS_RINGS.map((s) => `${s.path}::${s.helper}`));
  const halo = new Set(KNOCKOUT_HALOS.map((s) => `${s.path}::${s.constructor}`));
  const knob = new Set(SWITCH_KNOBS.map((s) => `${s.path}::${s.helper}`));
  // No single declared value belongs to two inventories.
  assert.notEqual(FOCUS_RING_SPELLING, HALO_SPELLING);
  assert.ok(!ELEVATION_TOKENS.includes(FOCUS_RING_SPELLING));
  assert.ok(!ELEVATION_TOKENS.includes(HALO_SPELLING));
  assert.equal(focus.size, 3);
  assert.equal(halo.size, 3);
  assert.equal(knob.size, 2);
  // The knob is an ELEVATION member; the other two are not.
  assert.ok(isNonElevationSpreadRing(FOCUS_RING_SPELLING));
  assert.ok(isNonElevationSpreadRing(HALO_SPELLING));
  assert.ok(!isNonElevationSpreadRing('var(--rv-shadow-sm)'));
});

/* ============================================================
   6 · the authorized product treatments
   ============================================================ */

test('16 · js/ui.js owns its shadows through canonical tokens, not Tailwind', () => {
  const ui = read('js/ui.js');
  // The generic toast is a nonmodal banner.
  assert.match(ui, /function toast\([\s\S]{0,400}?box-shadow:var\(--rv-shadow-sm\);/);
  assert.ok(!/shadow-lg/.test(ui), 'the Tailwind toast shadow survived');
  // The generic modal card takes the popover elevation (contract §2.10).
  assert.match(ui, /const card = el\('div', \{ style: '[^']*box-shadow:var\(--rv-shadow-popover\);'/);
  assert.ok(!/shadow-xl/.test(ui), 'the Tailwind modal shadow survived');
});

test('17 · the two banners take the canonical small elevation', () => {
  assert.match(read('js/environment-banner.js'), /box-shadow:var\(--rv-shadow-sm\);/);
  assert.match(read('js/supabase-client.js'), /box-shadow:var\(--rv-shadow-sm\);/);
});

test('18 · the two import actions carry no decorative elevation', () => {
  for (const rel of ['js/documents-ingestor-import-received.js', 'js/documents-ingestor-import-ui.js']) {
    const text = read(rel);
    assert.match(text, /box-shadow:var\(--rv-shadow-none\);/, `${rel}: not flattened`);
    assert.ok(!/box-shadow:0 \d/.test(text), `${rel}: a literal tinted shadow survived`);
  }
});

test('19 · the login card declares one valid canonical shadow', () => {
  const text = read('js/screens/system-screens.js');
  assert.match(text, /\+ 'box-shadow:var\(--rv-shadow-none\);',/);
  assert.ok(
    !/box-shadow:var\(--rv-shadow-none\),/.test(text),
    'the malformed two-layer none declaration survived',
  );
});

test('20 · the three screen modal cards keep the popover elevation', () => {
  for (const rel of [
    'js/screens/admin-usuarios-modal.js',
    'js/screens/cadastros.js',
    'js/screens/cliente-pedido-form.js',
  ]) {
    assert.match(read(rel), /box-shadow:var\(--rv-shadow-popover\);/, `${rel}: modal elevation lost`);
  }
});

/* ============================================================
   7 · non-vacuity — the rule still rejects what it must
   ============================================================ */

const CONTRACT = readContract(ROOT);
const CTX = { tokens: readTokens(ROOT), enums: buildEnums(CONTRACT) };
const probe = (src) => jsScreen.analyse('probe.js', src);
const uic004Of = (src) => runRules(probe(src), CTX).filter((f) => f.rule_id === 'UIC-004');

test('21 · an unresolved elevation token is blocking', () => {
  const found = uic004Of("el('div', { style: 'box-shadow:var(--rv-shadow-missing);' })");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'blocking');
  assert.match(found[0].message, /does not resolve/);
});

test('22 · an elevation shadow outside the enum is blocking', () => {
  for (const value of [
    '0 2px 8px rgba(37,99,235,.35)',
    '0 1px 4px rgba(0,0,0,.2)',
    '0 -1px 4px rgba(0,0,0,.2)',
    '0 1px 3px rgba(24,121,74,.3)',
    '0 0 4px rgba(0,0,0,.2)',
  ]) {
    const found = uic004Of(`el('div', { style: 'box-shadow:${value};' })`);
    assert.equal(found.length, 1, `${value} was not reported`);
    assert.equal(found[0].severity, 'blocking');
  }
});

test('23 · a card carrying any non-none elevation is blocking', () => {
  for (const token of ['var(--rv-shadow-sm)', 'var(--rv-shadow-popover)']) {
    const found = uic004Of(`el('section', { style: 'box-shadow:${token};' })`);
    assert.equal(found.length, 1, `a card with ${token} was excused`);
    assert.equal(found[0].severity, 'blocking');
    assert.match(found[0].message, /Cards are flat/);
  }
  // A card may declare the none token, and nothing else.
  assert.deepEqual(uic004Of("el('section', { style: 'box-shadow:var(--rv-shadow-none);' })"), []);
});

test('24 · a popover, modal or banner using a canonical elevation passes', () => {
  assert.deepEqual(uic004Of("el('div', { style: 'box-shadow:var(--rv-shadow-popover);' })"), []);
  assert.deepEqual(uic004Of("el('div', { style: 'box-shadow:var(--rv-shadow-sm);' })"), []);
  assert.deepEqual(uic004Of("el('span', { style: 'box-shadow:var(--rv-shadow-sm);' })"), []);
});

test('25 · a strict spread-only ring is excluded from UIC-004', () => {
  for (const value of [
    '0 0 0 3px var(--rv-focus-ring)',
    '0 0 0 4px var(--rv-surface)',
    '0 0 0 2px red',
    '0px 0px 0px 3px rgba(3,105,161,.22)',
  ]) {
    assert.deepEqual(uic004Of(`el('div', { style: 'box-shadow:${value};' })`), [], value);
  }
});

test('26 · a ring that is not strictly spread-only is NOT excluded', () => {
  const rejected = [
    ['0 0 2px 3px var(--rv-focus-ring)', 'nonzero blur'],
    ['0 1px 0 3px var(--rv-focus-ring)', 'nonzero vertical offset'],
    ['1px 0 0 3px var(--rv-focus-ring)', 'nonzero horizontal offset'],
    ['0 0 0 0 var(--rv-focus-ring)', 'zero spread'],
    ['inset 0 0 0 3px var(--rv-focus-ring)', 'inset ring'],
    ['0 0 0 3px red, 0 1px 2px black', 'second layer'],
    ['0 0 0 3px', 'no colour slot'],
  ];
  for (const [value, why] of rejected) {
    const found = uic004Of(`el('div', { style: 'box-shadow:${value};' })`);
    assert.ok(found.length >= 1, `${why} (${value}) was silently excluded`);
    assert.ok(found.every((f) => f.severity === 'blocking'), `${why} produced a non-blocking finding`);
  }
});

test('27 · a card carrying a spread ring is not a card defect', () => {
  // The ring is not elevation, so "cards are flat" does not apply to it.
  assert.deepEqual(uic004Of("el('section', { style: 'box-shadow:0 0 0 3px var(--rv-focus-ring);' })"), []);
});

/* ============================================================
   8 · the removed coverage branch, and no suppression
   ============================================================ */

test('28 · UIC-004 emits no coverage finding anywhere, on either front-end', () => {
  assert.deepEqual(
    BASELINE.findings.filter((f) => f.rule_id === 'UIC-004' && f.severity === 'coverage'),
    [],
  );
  // A non-none shadow on an element of unknown containment is no longer a gap.
  assert.deepEqual(uic004Of("el('div', { style: 'box-shadow:var(--rv-shadow-popover);' })"), []);
});

test('29 · the CARD_MEMBERSHIP_UNPROVEN branch no longer exists', () => {
  // Reading CODE only: the module names the removed branch in prose precisely
  // to record that it was removed and why.
  const raw = read('scripts/ui-conformance/rules.mjs');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/CARD_MEMBERSHIP_UNPROVEN/.test(code), 'the removed coverage branch is still present');
  assert.match(raw, /CARD_MEMBERSHIP_UNPROVEN/, 'the removal is no longer explained in the module');
  // and it cannot be reintroduced by reading the field it depended on.
  const shadowRule = /function ruleShadow\([\s\S]*?\n}/.exec(code)[0];
  assert.ok(!/insideCard/.test(shadowRule), 'ruleShadow still reads insideCard');
  assert.ok(/isCard/.test(shadowRule), 'ruleShadow no longer judges the carrying element');
});

test('30 · the guard and the detector carry no path, line or value suppression', () => {
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const src of ['scripts/ui-conformance/rules.mjs', 'scripts/ui-conformance/frontends/js-screen.mjs']) {
    const code = stripComments(read(src));
    assert.ok(
      !/\b(ignoreList|IGNORE_PATHS|WAIVERS?|SUPPRESS\w*|skipFiles|EXEMPT_PATHS)\b/i.test(code),
      `${src} appears to carry a waiver or ignore mechanism`,
    );
    assert.ok(!/['"`]js\/screens\/[a-z0-9-]+\.js['"`]/.test(code), `${src} names a specific screen path`);
    assert.ok(!/--rv-focus-ring|--rv-surface\b/.test(code), `${src} names a product token in the predicate`);
  }
});

/* ============================================================
   9 · earlier passes remain closed
   ============================================================ */

test('31 · passes 1, 2 and 3 remain closed', () => {
  for (const id of ['UIC-001', 'UIC-002', 'UIC-010']) {
    const r = rule(id);
    assert.equal(r.blocking, 0, `${id} reopened`);
    assert.equal(r.coverage_gaps, 0, `${id} gained a coverage gap`);
  }
  const uic003 = rule('UIC-003');
  assert.equal(uic003.blocking, 0, 'UIC-003 reopened');
  assert.equal(uic003.coverage_gaps, 0, 'UIC-003 gained a coverage gap');
  for (const id of ['UIC-007', 'UIC-011']) assert.equal(rule(id).total, 0, `${id} reopened`);
});

test('32 · no rule outside UIC-004 moved in this pass', () => {
  // The exact multiset the pass-4 order authorizes: UIC-004 to zero, and the
  // rest of the repository byte-identical to the 42ce915 entry baseline.
  assert.equal(rule('UIC-000').coverage_gaps, 549);
  assert.equal(rule('UIC-005').blocking, 80);
  assert.equal(rule('UIC-006').blocking, 15);
  assert.equal(rule('UIC-008').blocking, 0);
  assert.equal(rule('UIC-008').coverage_gaps, 42);
  assert.equal(rule('UIC-009').debt, 322);
  assert.equal(BASELINE.findings.length, 1008);
});
