/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 2 (UIC-002 / UIC-010)

   Proves the radius property pass CLOSED across every inventoried
   application screen: zero blocking and zero coverage for both
   radius rules, `UIC-007` still zero, and the closed enum reached
   without a token, a waiver or a detector change.

   The baseline fixture is the measured artefact; this file asserts
   what the pass promised about it and re-reads the screens directly
   for the role rulings the detector cannot restate.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };
const findings = (id) => BASELINE.findings.filter((f) => f.rule_id === id);

/** UIC-009 may not grow past the ceiling pass 1 was accepted with. */
const UIC009_ENTRY_CEILING = 322;
/** The application inventory pass 2 was authorized against. */
const APPLICATION_FILE_COUNT = 66;

const SCREEN_DIR = path.join(ROOT, 'js', 'screens');
const SCREENS = fs.readdirSync(SCREEN_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ rel: `js/screens/${f}`, text: fs.readFileSync(path.join(SCREEN_DIR, f), 'utf8') }));

/** The 26 screens the radius pass rewrote — the only ones its rulings bind.
    Screens outside this set were not authorized by the pass-2 path boundary
    (§9: only files carrying an entry-baseline UIC-002 or UIC-010 finding). */
const PASS2_SCREENS = new Set([
  'js/screens/admin-usuarios-audit-panel.js',
  'js/screens/admin-usuarios-modal.js',
  'js/screens/admin-usuarios.js',
  'js/screens/cadastros.js',
  'js/screens/cliente-dashboard.js',
  'js/screens/cliente-pedido-detail.js',
  'js/screens/cliente-pedido-tracking.js',
  'js/screens/cliente-pedidos-list.js',
  'js/screens/cliente-route-sections-ui.js',
  'js/screens/common.js',
  'js/screens/documentos-recebidos.js',
  'js/screens/entrega-form.js',
  'js/screens/expedicao-admin.js',
  'js/screens/manta-output-form.js',
  'js/screens/op-latex-admin.js',
  'js/screens/op-nova.js',
  'js/screens/op-tecelagem-producao-admin.js',
  'js/screens/ops-list.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/pedido-route-sections-ui.js',
  'js/screens/pedidos-list.js',
  'js/screens/system-screens.js',
  'js/screens/trocar-senha-obrigatoria.js',
]);

test('0 · every pass-2 screen still exists and every one carried a radius finding', () => {
  const inventoried = new Set(BASELINE.inventory.application.files.map((f) => f.path));
  for (const rel of PASS2_SCREENS) {
    assert.ok(SCREENS.some((s) => s.rel === rel), `${rel} disappeared from js/screens`);
    assert.ok(inventoried.has(rel), `${rel} is not in the application inventory`);
  }
  assert.equal(PASS2_SCREENS.size, 26);
});

/* ---------- 1 · the inventory did not shrink ---------- */

test('1 · all 66 application files remain inventoried', () => {
  assert.equal(BASELINE.inventory.application.count, APPLICATION_FILE_COUNT);
  assert.equal(BASELINE.inventory.application.files.length, APPLICATION_FILE_COUNT);
  // Closing a property must never close it by dropping a file from the sweep.
  assert.equal(BASELINE.highlights.files_scanned, APPLICATION_FILE_COUNT + 1,
    'the 66 application files plus the ratified prototype fixture');
});

/* ---------- 2 · the two radius rules are closed ---------- */

test('2 · UIC-002 blocking === 0', () => {
  assert.equal(rule('UIC-002').blocking, 0);
});

test('3 · UIC-002 coverage === 0', () => {
  assert.equal(rule('UIC-002').coverage_gaps, 0);
  assert.equal(rule('UIC-002').total, 0);
  assert.deepEqual(findings('UIC-002'), []);
});

test('4 · UIC-010 blocking === 0', () => {
  assert.equal(rule('UIC-010').blocking, 0);
});

test('5 · UIC-010 coverage === 0', () => {
  assert.equal(rule('UIC-010').coverage_gaps, 0);
  assert.equal(rule('UIC-010').total, 0);
  assert.deepEqual(findings('UIC-010'), []);
});

test('6 · UIC-007 === 0 — no button ever carries pill geometry', () => {
  assert.equal(rule('UIC-007').total, 0);
  assert.equal(rule('UIC-007').blocking, 0);
  assert.equal(BASELINE.highlights.pill_shaped_buttons, 0);
});

/* ---------- 3 · the role rulings, read from the screens ---------- */

/**
 * Byte ranges that are comments, so a radius mentioned in prose is not read as
 * CSS. Strings and template literals — where these screens build style text —
 * are deliberately NOT excluded; that is exactly where the declarations live.
 */
function commentRanges(src) {
  const out = [];
  let i = 0;
  let mode = null;
  let start = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === null) {
      if (c === '/' && n === '/') { mode = 'line'; start = i; i += 2; continue; }
      if (c === '/' && n === '*') { mode = 'block'; start = i; i += 2; continue; }
      if (c === "'") { mode = 'sq'; i++; continue; }
      if (c === '"') { mode = 'dq'; i++; continue; }
      if (c === '`') { mode = 'tpl'; i++; continue; }
      i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { out.push([start, i]); mode = null; } i++; continue; }
    if (mode === 'block') { if (c === '*' && n === '/') { out.push([start, i + 2]); mode = null; i += 2; continue; } i++; continue; }
    if (c === '\\') { i += 2; continue; }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = null;
    i++;
  }
  if (mode === 'line' || mode === 'block') out.push([start, src.length]);
  return out;
}

/** Every `border-radius:` DECLARATION a screen writes, comments excluded. */
function radiusDecls(text) {
  const comments = commentRanges(text);
  const out = [];
  for (const m of text.matchAll(/border-radius\s*:\s*([^;'"`\n]*)/g)) {
    if (comments.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const value = m[1].trim();
    if (!value) continue;
    out.push({ value, line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** Every `border-radius:` value a screen writes literally. */
function radiusValues(text) {
  return radiusDecls(text).map((d) => d.value);
}

/** The value at `rel` as committed at the accepted pass-1 checkpoint. */
function atPass1Checkpoint(rel) {
  return execFileSync('git', ['show', `cabd358:${rel}`], { cwd: ROOT, encoding: 'utf8' });
}

/**
 * What a radius may legally be after this pass.
 *
 * `4px` is the enum's own low value, so a pre-existing literal is conforming;
 * the pass may not INTRODUCE one (proved separately against `cabd358`). The two
 * deprecated aliases resolve to `var(--rv-radius)` in `css/tokens.css`, so they
 * satisfy UIC-002 and are counted by UIC-009, whose debt pass 2 may not touch.
 */
const RADIUS_IN_ENUM = new Set([
  'var(--rv-radius)',
  'var(--rv-radius-pill)',
  '4px',
  'var(--rv-radius-card)',
  'var(--rv-radius-control)',
]);
const DEPRECATED_ALIASES = ['--rv-radius-card', '--rv-radius-control'];
const count = (text, needle) => text.split(needle).length - 1;

/** Pill geometry however it is spelled: the token, its value, or >= 20px. */
const PILL_GEOMETRY = /^(?:var\(--rv-radius-pill\)|50%|9{2,4}px|[2-9]\d(?:\.\d+)?px|\d{3,}px)$/;

test('7 · no button or icon button carries pill geometry; every button radius is inside the enum', () => {
  const offenders = [];
  for (const s of SCREENS) {
    if (!PASS2_SCREENS.has(s.rel)) continue;
    // A button element and the radius declared inside its own attribute object.
    for (const m of s.text.matchAll(/el\('button',\s*\{[\s\S]{0,600}?border-radius:\s*([^;'"`\n]+)/g)) {
      const v = m[1].trim();
      if (PILL_GEOMETRY.test(v)) offenders.push(`${s.rel}: button carries pill geometry ${v}`);
      else if (!RADIUS_IN_ENUM.has(v)) offenders.push(`${s.rel}: button radius ${v} is outside the enum`);
    }
  }
  assert.deepEqual(offenders, [],
    `a button is never a pill and never leaves the enum:\n${offenders.join('\n')}`);
});

test('8 · semantic pill geometry is only ever the pill token', () => {
  // D6.1 is expressed by ONE name. A pill spelled as a literal is not a pill.
  const offenders = [];
  for (const s of SCREENS) {
    if (!PASS2_SCREENS.has(s.rel)) continue;
    for (const v of radiusValues(s.text)) {
      if (/^(999px|99px|9999px)$/.test(v)) offenders.push(`${s.rel}: literal pill radius ${v}`);
    }
  }
  assert.deepEqual(offenders, [], `pill geometry must use var(--rv-radius-pill):\n${offenders.join('\n')}`);
});

test('9 · true circles use the pill token and declare equal width/height', () => {
  const offenders = [];
  for (const s of SCREENS) {
    if (!PASS2_SCREENS.has(s.rel)) continue;
    const lines = s.text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/border-radius:var\(--rv-radius-pill\)/.test(line)) return;
      const w = line.match(/width:\s*([0-9.]+px)/);
      const h = line.match(/height:\s*([0-9.]+px)/);
      // Statically provable circles only: where both are literal they must match.
      if (w && h && w[1] !== h[1]) offenders.push(`${s.rel}:${i + 1} ${w[1]} != ${h[1]}`);
    });
  }
  assert.deepEqual(offenders, [], `pill radius on unequal static geometry:\n${offenders.join('\n')}`);
});

test('10 · no screen keeps a raw 50% circle', () => {
  const offenders = [];
  for (const s of SCREENS) {
    if (!PASS2_SCREENS.has(s.rel)) continue;
    if (/border-radius:\s*50%/.test(s.text)) offenders.push(s.rel);
  }
  assert.deepEqual(offenders, [], `50% is outside the closed enum:\n${offenders.join('\n')}`);
});

test('11 · every radius a pass-2 screen writes is inside the closed enum', () => {
  const offenders = [];
  for (const s of SCREENS) {
    if (!PASS2_SCREENS.has(s.rel)) continue;
    for (const v of radiusValues(s.text)) {
      if (RADIUS_IN_ENUM.has(v)) continue;
      offenders.push(`${s.rel}: ${v}`);
    }
  }
  assert.deepEqual(offenders, [],
    `no radius may sit outside the closed enum:\n${offenders.join('\n')}`);
});

test('11b · the pass introduced no new literal radius — every site it wrote is a token', () => {
  const offenders = [];
  for (const rel of PASS2_SCREENS) {
    const now = read(rel);
    const then = atPass1Checkpoint(rel);
    const grew = count(now, 'border-radius:4px') - count(then, 'border-radius:4px');
    if (grew > 0) offenders.push(`${rel}: +${grew} literal 4px`);
  }
  assert.deepEqual(offenders, [],
    `remediation writes var(--rv-radius), never the literal:\n${offenders.join('\n')}`);
});

test('12 · no screen introduces a radius compatibility alias or declares a local radius token', () => {
  const offenders = [];
  for (const rel of PASS2_SCREENS) {
    const now = read(rel);
    const then = atPass1Checkpoint(rel);
    // The aliases are accepted UIC-009 debt; pass 2 may not lean on them to
    // dodge the enum, so their count may fall but never rise.
    for (const alias of DEPRECATED_ALIASES) {
      const grew = count(now, alias) - count(then, alias);
      if (grew > 0) offenders.push(`${rel}: +${grew} ${alias}`);
    }
    // No screen may own a radius name of its own — css/tokens.css owns them all.
    for (const m of now.matchAll(/(--rv-[a-z0-9-]*radius[a-z0-9-]*)\s*:\s*(?!;)/g)) {
      const decl = m[0];
      if (/var\(/.test(now.slice(Math.max(0, m.index - 4), m.index))) continue;
      offenders.push(`${rel}: declares ${m[1]} (${decl.trim()})`);
    }
  }
  assert.deepEqual(offenders, [], `radius ownership stays in css/tokens.css:\n${offenders.join('\n')}`);
});

test('13 · no waiver or suppression mechanism exists', () => {
  const engine = read('scripts/ui-conformance/rules.mjs') + read('scripts/ui-conformance/contract.mjs');
  // A mechanism, not a word: the engine must own no per-path, per-line or
  // per-value escape list that could turn a real finding into silence.
  for (const mech of [
    /\b(?:WAIVERS?|SUPPRESS(?:IONS?|ED)?|ALLOW_?LIST|IGNORE_?LIST|EXEMPT(?:IONS?)?)\b/,
    /\beslint-disable\b/,
    /skipPaths|ignorePaths|waivedRules|mutedRules/,
  ]) {
    assert.doesNotMatch(engine, mech, `the detector must own no escape mechanism (${mech})`);
  }
  // No screen may carry an inline escape hatch either.
  for (const s of SCREENS) {
    assert.doesNotMatch(s.text, /uic-(?:00\d|01\d)[- ]?(?:ignore|disable|waive)/i, `${s.rel} carries a rule escape`);
  }
  // Zero findings must mean "nothing to report", not "the rule stopped firing":
  // both radius rules still emit blocking findings from the live engine.
  const rules = read('scripts/ui-conformance/rules.mjs');
  assert.match(rules, /rule_id: 'UIC-002',\s*\n\s*severity: 'blocking'/);
  assert.match(rules, /rule_id: 'UIC-010',\s*\n\s*severity: 'blocking'/);
  assert.match(rules, /rule_id: 'UIC-007',\s*\n\s*severity: 'blocking'/);
  // The enum the rules read is the contract's, not a constant in the engine.
  assert.match(rules, /ctx\.enums\.radius/);
});

/* ---------- 4 · everything pass 2 promised not to touch ---------- */

test('14 · UIC-001 remains zero', () => {
  assert.equal(rule('UIC-001').blocking, 0);
  assert.equal(rule('UIC-001').coverage_gaps, 0);
  assert.equal(rule('UIC-001').total, 0);
  assert.equal(BASELINE.highlights.literal_visual_colours_blocking, 0);
});

test('15 · UIC-009 did not increase', () => {
  assert.ok(rule('UIC-009').debt <= UIC009_ENTRY_CEILING,
    `UIC-009 debt ${rule('UIC-009').debt} exceeds the entry ceiling ${UIC009_ENTRY_CEILING}`);
});

test('16 · UIC-011 remains zero', () => {
  assert.equal(rule('UIC-011').total, 0);
  assert.equal(BASELINE.highlights.unknown_token_references, 0);
});

test('17 · the compact fixture stays FULL with zero findings', () => {
  const fixture = BASELINE.inventory.prototype.files.find((f) => f.path.includes('OP Detail - Compacto'));
  assert.ok(fixture, 'the ratified prototype fixture must stay inventoried');
  assert.equal(fixture.coverage, 'FULL');
  const onFixture = BASELINE.findings.filter((f) => f.path === fixture.path);
  assert.deepEqual(onFixture, [], 'the ratified fixture must carry no finding');
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
});

test('18 · repeated baseline generation is byte-identical and reproduces the committed file', () => {
  const run = () => execFileSync(
    process.execPath,
    ['scripts/validate-ui-conformance.mjs', '--report', '--format', 'json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const first = run();
  const second = run();
  assert.equal(first, second, 'two detector runs over the same tree must agree byte for byte');
  assert.equal(first, read('tests/fixtures/ui-conformance-baseline.json'),
    'the committed baseline must be exactly what the detector produces from this tree');
  // 1.0.3 is the js-screen front-end amendment that made a static
  // `data-ui-pill` marker observable, so the six ruled badges could keep pill
  // geometry without a colour, contract or rule-semantics change.
  assert.equal(BASELINE.detector_version, '1.0.3');
  assert.equal(BASELINE.contract_blob_hash.length, 64, 'the contract is pinned by a sha-256');
});

/* ============================================================
   19 · GLOBAL SOURCE-LEVEL PROOF — all 66 application screens

   The detector cannot see a radius written inside an interpolated
   or concatenated style string, so a metric of zero is necessary
   but not sufficient. These assertions read every screen directly,
   so closure does not depend on detector visibility.
   ============================================================ */

const ALL_SCREENS = SCREENS;

test('19 · no out-of-enum radius survives anywhere in the 66 screens', () => {
  const offenders = [];
  for (const s of ALL_SCREENS) {
    for (const d of radiusDecls(s.text)) {
      if (RADIUS_IN_ENUM.has(d.value)) continue;
      offenders.push(`${s.rel}:${d.line} ${d.value}`);
    }
  }
  assert.equal(ALL_SCREENS.length, APPLICATION_FILE_COUNT);
  assert.deepEqual(offenders, [],
    `50%, 99px, 999px and every other out-of-enum radius must be gone:\n${offenders.join('\n')}`);
});

test('19b · the permitted 4px enum value and the resolving aliases are still permitted', () => {
  const values = ALL_SCREENS.flatMap((s) => radiusValues(s.text));
  assert.ok(values.includes('4px'), 'a pre-existing literal 4px is inside the enum, not a defect');
  assert.ok(values.some((v) => v === 'var(--rv-radius-card)' || v === 'var(--rv-radius-control)'),
    'aliases resolving to --rv-radius stay UIC-009 debt, not a pass-2 failure');
  // …and that debt did not grow.
  assert.ok(rule('UIC-009').debt <= UIC009_ENTRY_CEILING);
});

test('19c · no button or button-equivalent uses pill geometry, in any screen', () => {
  const offenders = [];
  for (const s of ALL_SCREENS) {
    for (const m of s.text.matchAll(/el\('button',\s*\{[\s\S]{0,600}?border-radius:\s*([^;'"`\n]+)/g)) {
      const v = m[1].trim();
      if (PILL_GEOMETRY.test(v)) offenders.push(`${s.rel}: ${v}`);
    }
    // A button-equivalent declares the control marker the detector reads.
    for (const m of s.text.matchAll(/'data-ui-control'[\s\S]{0,400}?border-radius:\s*([^;'"`\n]+)/g)) {
      const v = m[1].trim();
      if (PILL_GEOMETRY.test(v)) offenders.push(`${s.rel}: data-ui-control ${v}`);
    }
  }
  assert.deepEqual(offenders, [], `a control is never a pill:\n${offenders.join('\n')}`);
});

test('19d · true circles declare equal, explicit width and height', () => {
  const offenders = [];
  for (const s of ALL_SCREENS) {
    s.text.split(/\r?\n/).forEach((line, i) => {
      if (!/border-radius:var\(--rv-radius-pill\)/.test(line)) return;
      const w = line.match(/width:\s*([0-9.]+px)/);
      const h = line.match(/height:\s*([0-9.]+px)/);
      if (w && h && w[1] !== h[1]) offenders.push(`${s.rel}:${i + 1} ${w[1]} != ${h[1]}`);
    });
  }
  assert.deepEqual(offenders, [],
    `pill radius on unequal static geometry — an elongated bar is not a circle:\n${offenders.join('\n')}`);
});

test('19e · pill geometry only ever appears as the token, never as a literal', () => {
  const offenders = [];
  for (const s of ALL_SCREENS) {
    for (const d of radiusDecls(s.text)) {
      if (d.value === 'var(--rv-radius-pill)') continue;
      if (PILL_GEOMETRY.test(d.value)) offenders.push(`${s.rel}:${d.line} ${d.value}`);
    }
  }
  assert.deepEqual(offenders, [],
    `D6.1 is expressed by one name:\n${offenders.join('\n')}`);
});

test('19f · no screen introduces a local radius token, waiver or suppression', () => {
  const offenders = [];
  for (const s of ALL_SCREENS) {
    for (const m of s.text.matchAll(/(--rv-[a-z0-9-]*radius[a-z0-9-]*)\s*:\s*(?!;)/g)) {
      if (/var\(/.test(s.text.slice(Math.max(0, m.index - 4), m.index))) continue;
      offenders.push(`${s.rel}: declares ${m[1]}`);
    }
    if (/uic-(?:00\d|01\d)[- ]?(?:ignore|disable|waive)/i.test(s.text)) offenders.push(`${s.rel}: rule escape`);
  }
  assert.deepEqual(offenders, [], `radius ownership stays in css/tokens.css:\n${offenders.join('\n')}`);
});

test('19g · the ruled semantic pills keep pill geometry and declare their role', () => {
  const SEMANTIC_PILLS = [
    'js/screens/admin-usuarios-audit-panel.js',
    'js/screens/documentos-recebidos.js',
    'js/screens/op-latex-admin.js',
    'js/screens/op-nova.js',
    'js/screens/op-tecelagem-producao-admin.js',
    'js/screens/ordem-compra-receipt-render.js',
    'js/screens/pedido-itens-edit.js',
    'js/screens/pedido-tracking-admin.js',
  ];
  for (const rel of SEMANTIC_PILLS) {
    const text = read(rel);
    assert.ok(text.split("'data-ui-pill'").length - 1 >= 1, `${rel} must declare the pill role`);
    assert.match(text, /'data-ui-pill': '1', style: '[^']*border-radius:var\(--rv-radius-pill\)/,
      `${rel}: the ruled badge must keep pill geometry`);
  }
  // No other screen may claim the marker.
  const carriers = ALL_SCREENS.filter((s) => s.text.includes("'data-ui-pill'")).map((s) => s.rel);
  assert.deepEqual(carriers.sort(), SEMANTIC_PILLS.slice().sort());
});

/* ============================================================
   20 · A2 — css/tokens.css is the ONLY radius owner

   Pass 2 closed explicit `border-radius:` declarations but left a
   second geometry source untouched: Tailwind's `rounded*` utility
   classes, delivered by an unversioned external runtime. They never
   appear in a radius declaration, so neither the detector nor the
   §19 scan could see them, yet they decide the computed radius.
   A2 removed every one of them. This guard is what stops them
   coming back.
   ============================================================ */

/** Every Tailwind radius utility spelling, including per-corner and logical sides. */
const TAILWIND_RADIUS_UTILITY = new RegExp(
  '\\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|ee|es))?'
  + '(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\\[[^\\]\\s]+\\]))?\\b',
  'g',
);

/** A named constant whose value is the screen's own radius literal. */
const RADIUS_CONSTANT = new RegExp("\\b([A-Z][A-Z0-9_]*RADIUS[A-Z0-9_]*)\\s*=\\s*'([^']*)'", 'g');

/**
 * Class-token sites only: a `rounded` inside a comment is prose, and this must
 * never fire on an unrelated identifier. Strings and template literals ARE
 * inspected — that is where these screens build their class attributes.
 */
function tailwindRadiusHits(text) {
  const comments = commentRanges(text);
  const out = [];
  TAILWIND_RADIUS_UTILITY.lastIndex = 0;
  for (const m of text.matchAll(TAILWIND_RADIUS_UTILITY)) {
    if (comments.some(([a, b]) => m.index >= a && m.index < b)) continue;
    out.push({ token: m[0], line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}

test('20 · TAILWIND_RADIUS_UTILITY_COUNT === 0 across all 66 screens', () => {
  const offenders = [];
  let files = 0;
  for (const s of ALL_SCREENS) {
    const hits = tailwindRadiusHits(s.text);
    if (!hits.length) continue;
    files += 1;
    for (const h of hits) offenders.push(`${s.rel}:${h.line} ${h.token}`);
  }
  assert.equal(offenders.length, 0,
    `css/tokens.css is the only radius owner; Tailwind must own none:\n${offenders.join('\n')}`);
  assert.equal(files, 0, 'TAILWIND_RADIUS_UTILITY_FILE_COUNT must be 0');
  assert.equal(ALL_SCREENS.length, APPLICATION_FILE_COUNT);
});

test('20b · the guard actually fires — it is not a vacuous zero', () => {
  // Every spelling the ruling names must be caught, in a class-shaped string.
  for (const spelling of ['rounded', 'rounded-none', 'rounded-sm', 'rounded-md',
    'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full',
    'rounded-t-lg', 'rounded-b-xl', 'rounded-s-md', 'rounded-e-full', 'rounded-[3px]']) {
    const probe = `el('div', { class: 'bg-white ${spelling} shadow p-4' })`;
    assert.equal(tailwindRadiusHits(probe).length, 1, `${spelling} must be caught`);
  }
  // …and prose must not be.
  assert.equal(tailwindRadiusHits('// the old rounded-xl card is gone\n').length, 0);
  assert.equal(tailwindRadiusHits('/* rounded-full was removed by A2 */\n').length, 0);
  // …nor an unrelated identifier.
  assert.equal(tailwindRadiusHits('var roundedValue = 1; surroundedBy(x);').length, 0);
});

test('20c · no screen declares a radius through a literal constant either', () => {
  // A named constant holding a literal is still the screen owning geometry.
  const offenders = [];
  for (const s of ALL_SCREENS) {
    for (const m of s.text.matchAll(RADIUS_CONSTANT)) {
      if (RADIUS_IN_ENUM.has(m[2]) && m[2].startsWith('var(')) continue;
      offenders.push(`${s.rel}: ${m[1]} = '${m[2]}'`);
    }
  }
  assert.deepEqual(offenders, [],
    `a radius constant must hold a token, never a literal:\n${offenders.join('\n')}`);
});

/* ============================================================
   21 · A2 — THE EXACT COVERAGE DELTA

   Moving radius ownership out of Tailwind and into canonical
   declarations made five screens that had NO declaration at all
   start declaring visual values. They were `FULL` by absence, not
   by conformance, and the detector could not see them. Now it can,
   and each honestly reports the one thing it cannot evaluate.

   That is an OBSERVABILITY INCREASE, not a product, detector or
   radius regression — but it is only acceptable at the exact size
   the architect ruled. These assertions pin that size against the
   published entry checkpoint so a sixth gap, a different reason or
   any other rule movement fails loudly rather than passing as
   "coverage noise".
   ============================================================ */

/** The published A2 entry checkpoint this delta is measured against. */
const A2_ENTRY_CHECKPOINT = '2114191cc8d3fdb602d830d486cabbc933246620';

/** The exact five screens authorized to become newly observable. */
const A2_NEWLY_OBSERVABLE = [
  'js/screens/pedido-edit.js',
  'js/screens/pedido-insumos-distribuicao.js',
  'js/screens/pedido-itens-edit.js',
  'js/screens/pedido-parciais-admin.js',
  'js/screens/pedido-tracking-admin.js',
];

/** UIC-008 coverage before and after A2. Nothing else may move. */
const UIC008_COVERAGE_BEFORE = 37;
const UIC008_COVERAGE_AFTER = 42;

/** The exact accepted A2 coverage result — not a floor and not a ceiling. */
const A2_FULL = 23;
const A2_PARTIAL = 44;

const ENTRY_BASELINE = JSON.parse(execFileSync(
  'git',
  ['show', `${A2_ENTRY_CHECKPOINT}:tests/fixtures/ui-conformance-baseline.json`],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
));

/**
 * Identity of a finding, LINE-INSENSITIVE: `line`/`column` shift whenever a
 * screen gains or loses a line, which A2 does everywhere, so pinning them
 * would report hundreds of false moves and hide the real five.
 */
const findingKey = (f) => JSON.stringify([
  f.rule_id, f.severity, f.path, f.property,
  f.observed_value, f.resolved_value, f.element_or_context, f.message,
]);

/** Multiset difference, so a repeated finding is not silently collapsed. */
function multisetDelta(before, after) {
  const bag = (arr) => arr.reduce((m, f) => m.set(findingKey(f), (m.get(findingKey(f)) || 0) + 1), new Map());
  const a = bag(before);
  const b = bag(after);
  const added = [];
  const removed = [];
  for (const [k, n] of b) for (let i = 0; i < n - (a.get(k) || 0); i++) added.push(JSON.parse(k));
  for (const [k, n] of a) for (let i = 0; i < n - (b.get(k) || 0); i++) removed.push(JSON.parse(k));
  return { added, removed };
}

const A2_DELTA = multisetDelta(ENTRY_BASELINE.findings, BASELINE.findings);

test('21 · exactly five findings were added and none removed', () => {
  assert.equal(A2_DELTA.removed.length, 0,
    `A2 may not remove a finding:\n${A2_DELTA.removed.map((f) => f[0] + ' ' + f[2]).join('\n')}`);
  assert.equal(A2_DELTA.added.length, 5,
    `A2 COVERAGE DELTA EXCEEDS THE ARCHITECT RULING:\n${A2_DELTA.added.map((f) => f[0] + ' ' + f[2]).join('\n')}`);
});

test('21b · every added finding is UIC-008 / coverage / ACTION_ROW_UNPROVEN', () => {
  assert.equal(A2_DELTA.added.length, 5);
  // The key is positional: [rule_id, severity, path, property, observed,
  // resolved, element_or_context, message] — read it back field by field.
  for (const [ruleId, severity, relPath, , , , , message] of A2_DELTA.added) {
    assert.equal(ruleId, 'UIC-008', `${relPath}: only UIC-008 may appear`);
    assert.equal(severity, 'coverage', `${relPath}: only a coverage gap may appear`);
    assert.match(message, /ACTION_ROW_UNPROVEN/, `${relPath}: only ACTION_ROW_UNPROVEN may appear`);
  }
});

test('21c · the added findings sit on exactly the five authorized paths', () => {
  const paths = A2_DELTA.added.map((f) => f[2]).sort();
  assert.deepEqual(paths, A2_NEWLY_OBSERVABLE.slice().sort());
  // …and each of the five was FULL only because it declared nothing at all.
  for (const rel of A2_NEWLY_OBSERVABLE) {
    const before = ENTRY_BASELINE.summary_by_file[rel];
    assert.equal(before.coverage, 'FULL');
    assert.equal(before.declaration_sites, 0,
      `${rel} was FULL by absence, not by conformance`);
    assert.ok(BASELINE.summary_by_file[rel].declaration_sites > 0,
      `${rel} must now declare canonical values`);
  }
});

test('21d · no rule moved except UIC-008 coverage 37 -> 42', () => {
  const ids = new Set([...Object.keys(ENTRY_BASELINE.summary_by_rule), ...Object.keys(BASELINE.summary_by_rule)]);
  for (const id of ids) {
    const before = ENTRY_BASELINE.summary_by_rule[id];
    const after = BASELINE.summary_by_rule[id];
    if (id === 'UIC-008') {
      assert.equal(before.coverage_gaps, UIC008_COVERAGE_BEFORE);
      assert.equal(after.coverage_gaps, UIC008_COVERAGE_AFTER);
      assert.equal(before.blocking, 0);
      assert.equal(after.blocking, 0, 'A2 may not turn a coverage gap into a defect');
      continue;
    }
    assert.deepEqual(after, before, `${id} moved and A2 authorizes no movement outside UIC-008`);
  }
});

test('21e · blocking, debt, inventory and support are unchanged', () => {
  const sum = (b, k) => Object.values(b.summary_by_rule).reduce((n, r) => n + r[k], 0);
  assert.equal(sum(BASELINE, 'blocking'), sum(ENTRY_BASELINE, 'blocking'),
    'A2 is a radius-ownership change; it may not move a blocking count');
  assert.equal(sum(BASELINE, 'debt'), sum(ENTRY_BASELINE, 'debt'));
  assert.equal(rule('UIC-009').debt, UIC009_ENTRY_CEILING);
  assert.equal(BASELINE.inventory.application.count, ENTRY_BASELINE.inventory.application.count);
  assert.equal(BASELINE.inventory.application.count, APPLICATION_FILE_COUNT);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(ENTRY_BASELINE.coverage_summary.UNSUPPORTED, 0);
  // Detector semantics did not move under A2 — only what the screens declare did.
  assert.equal(BASELINE.detector_version, ENTRY_BASELINE.detector_version);
  assert.equal(BASELINE.contract_blob_hash, ENTRY_BASELINE.contract_blob_hash);
});

test('21f · the accepted A2 coverage result is exactly FULL 23 / PARTIAL 44 / UNSUPPORTED 0', () => {
  const c = BASELINE.coverage_summary;
  assert.equal(c.FULL, A2_FULL);
  assert.equal(c.PARTIAL, A2_PARTIAL);
  assert.equal(c.UNSUPPORTED, 0);
  // The five moves account for the whole difference; nothing else changed state.
  const before = new Map(ENTRY_BASELINE.inventory.application.files.map((f) => [f.path, f.coverage]));
  const moved = BASELINE.inventory.application.files
    .filter((f) => before.get(f.path) !== f.coverage)
    .map((f) => `${f.path} ${before.get(f.path)}->${f.coverage}`)
    .sort();
  assert.deepEqual(moved, A2_NEWLY_OBSERVABLE.slice().sort().map((p) => `${p} FULL->PARTIAL`));
});

test('21g · A2 added no data-card-actions marker — the 42 gaps stay open', () => {
  // The UIC-008 alignment pass is a separate, dedicated order that must
  // reconcile the whole 42-gap corpus. Marking only the five newly visible
  // rows here would close the symptom and leave the population unproven.
  for (const rel of A2_NEWLY_OBSERVABLE) {
    const now = read(rel);
    const then = execFileSync('git', ['show', `${A2_ENTRY_CHECKPOINT}:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(count(now, 'data-card-actions'), count(then, 'data-card-actions'),
      `${rel}: A2 may not add a card-action marker`);
  }
  assert.equal(rule('UIC-008').coverage_gaps, UIC008_COVERAGE_AFTER);
  assert.equal(rule('UIC-008').blocking, 0);
  assert.equal(BASELINE.highlights.action_alignment_coverage_gaps, UIC008_COVERAGE_AFTER);
});
