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
import vm from 'node:vm';

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
  assert.equal(BASELINE.detector_version, '1.0.6');
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

/**
 * Rules a LATER authorized pass owns, excluded from the A2 delta.
 *
 * Pass 2 owns the radius and semantic-pill properties. It must keep pinning
 * its own exact result forever, but it may not freeze the whole repository:
 * mechanically forbidding any other rule from ever moving would block every
 * subsequent property pass — the same defect A2 itself corrected in the pass-1
 * suite (see test 12b there). `UIC-003` is owned by phase-5 pass 3 and pinned
 * exactly, at 0 blocking / 0 coverage, by
 * tests/ui-conformance-phase5-pass3-control-height.test.mjs. `UIC-004` is
 * owned by phase-5 pass 4 and pinned exactly, at 0 blocking / 0 coverage, by
 * tests/ui-conformance-phase5-pass4-shadow.test.mjs. `UIC-008` is owned by
 * phase-5 pass 5 and pinned exactly, at 0 blocking / 0 coverage, by
 * tests/ui-conformance-phase5-pass5-card-actions.test.mjs, which also withdrew
 * the blanket per-file coverage branch that produced the A2 observability
 * increase recorded below.
 *
 * UIC-005 joined the set with phase-5 pass 6, which closed typography and is
 * pinned exactly, at 0, by tests/ui-conformance-phase5-pass6-typography.test.mjs.
 *
 * This is a narrowing by RULE OWNERSHIP, not a threshold: every rule not named
 * here is still compared finding-for-finding below.
 */
/*
 * PASS-2-LATER-PASS-RULE-OWNERSHIP-FORWARD-CORRECTION-A2
 *
 * `UIC-006` joined the set with phase-5 pass 7, which replaced every native
 * <select> with the application-owned select popover and is pinned exactly,
 * at 0, by tests/ui-conformance-phase5-pass7-native-select.test.mjs. This is
 * the same documented extension the set already received for UIC-005 in
 * pass 6 — rule ownership, not a threshold.
 */
const RULES_OWNED_BY_A_LATER_PASS = new Set(['UIC-003', 'UIC-004', 'UIC-005', 'UIC-006', 'UIC-008']);

/*
 * Pass 7 also removed SIX `UIC-000` coverage gaps. They are NOT a widening of
 * the ruling above: each was an unresolved style expression attached to a
 * native select, or to the facade wrapper around one, so deleting the control
 * deleted the construct the gap described. No detector branch changed and
 * nothing was suppressed — keeping them would mean keeping dead code purely
 * to preserve a count.
 *
 * They are enumerated EXACTLY, by path + construct + code, so this stays a
 * finding-for-finding comparison. A seventh removal, or a removal at any
 * other site, still fails.
 */
const PASS7_INCIDENTAL_UIC000_REMOVALS = [
  // ordenar / filtrar-por-tipo toolbar selects — `style: selectStyle`
  ['js/screens/admin-usuarios.js', 'style: <expression>', 'NON_LITERAL_STYLE_VALUE', 2],
  // selectControl's borderless native select — concatenated style string
  ['js/screens/documentos-recebidos.js', "style: '...' + <expression>", 'CONCATENATED_STYLE_EXPRESSION', 1],
  // buildSelectBox facade — `style: fieldBoxStyle(false)`
  ['js/screens/pedido-form.js', 'style: <expression>', 'NON_LITERAL_STYLE_VALUE', 1],
  // inline Tipo / Modelo row selects — `style: selectStyle()`
  ['js/screens/pedido-item-row-editor.js', 'style: <expression>', 'NON_LITERAL_STYLE_VALUE', 2],
];

const PASS7_UIC000_REMOVED_COUNT = PASS7_INCIDENTAL_UIC000_REMOVALS
  .reduce((n, r) => n + r[3], 0);

/*
 * Phase-5 pass 8 (table contract) ADDED exactly two `UIC-000` coverage gaps,
 * and nothing else outside the rules a later pass owns.
 *
 * Both are the same construct in the same file: the Cadastros » Parâmetros
 * matrix is TRANSPOSED — one label column plus one column per registered
 * largura — and its width owner was hardcoded to three tracks, which is only
 * correct while exactly two larguras exist. Rendered with five larguras the six
 * cells wrapped onto an implicit second grid row, so the declared owner no
 * longer described the rendered contract. The correction derives the template
 * from the real column count, which the detector cannot decode to a concrete
 * value — hence one gap on the header and one on the value rows.
 *
 * This is an observability cost knowingly accepted to close a proven layout
 * defect, not a suppression: no detector branch changed, and the two gaps are
 * enumerated EXACTLY, by path + construct + code. A third addition, or an
 * addition anywhere else, still fails.
 */
const PASS8_INCIDENTAL_UIC000_ADDITIONS = [
  // Cadastros » Parâmetros — `grid-template-columns:${paramGridTemplate}`,
  // once on the header row and once on every value row.
  ['js/screens/cadastros.js', 'grid-template-columns: ${...}', 'TEMPLATE_INTERPOLATED_VALUE', 2],
];

const PASS8_UIC000_ADDED_COUNT = PASS8_INCIDENTAL_UIC000_ADDITIONS
  .reduce((n, r) => n + r[3], 0);

/*
 * SPECIALIZED-CONTROLS-B1 moved the specialized controls' geometry out of the
 * screens and into css/tokens.css, which the detector does not read. Fourteen
 * findings therefore stopped existing as JavaScript declarations, and three
 * reappeared under a different construct name in the same file.
 *
 * This is NOT a suppression and NOT a widening of the ruling above: no
 * detector branch changed, no rule was silenced, and every one of the
 * seventeen movements is enumerated EXACTLY by rule + path + construct +
 * code. An eighteenth movement, or a movement at any other site, still fails.
 *
 * The three additions are the SAME three range-gradient repaints as the three
 * op-distribuicao-ui removals. They moved from a whole-style-attribute
 * rewrite to a background-only assignment so the shared range geometry can no
 * longer be clobbered; the detector reports the identical rule, severity and
 * cause, only under the new construct name.
 */
const B1_INCIDENTAL_REMOVALS = [
  ['UIC-000', 'js/screens/admin-usuarios-modal.js', '.style.minHeight = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/cadastros.js', '.style.minHeight = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/cliente-pedido-form.js', '.style.height = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/entrega-form.js', '.style.transform = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/entrega-form.js', 'style: <expression>', 'NON_LITERAL_STYLE_VALUE', 1],
  ['UIC-000', 'js/screens/manta-output-form.js', '.style.transform = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/manta-output-form.js', 'style: <expression>', 'NON_LITERAL_STYLE_VALUE', 1],
  ['UIC-000', 'js/screens/op-distribuicao-ui.js', "setAttribute('style', <expression>)", 'NON_LITERAL_STYLE_ASSIGNMENT', 3],
  ['UIC-000', 'js/screens/pedido-detail-events.js', '.style.minHeight = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-000', 'js/screens/pedido-form.js', '.style.height = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 1],
  ['UIC-009', 'js/screens/ordem-compra-receipt-events.js', 'string literal', 'DEPRECATED_TOKEN_REFERENCE', 2],
];

const B1_INCIDENTAL_ADDITIONS = [
  ['UIC-000', 'js/screens/op-distribuicao-ui.js', '.style.background = <expression>', 'NON_LITERAL_STYLE_ASSIGNMENT', 3],
];

/*
 * PEDIDO-SCREEN-GROUP-1 removed exactly TWO further UIC-000 coverage gaps and
 * added NONE. Both are the same mechanical cause and neither is a suppression:
 * a "Dados gerais" grid style that had been WRAPPED across source lines as
 * `'a' + ' b'` — which the js-screen front-end reports as
 * CONCATENATED_STYLE_EXPRESSION because it can only decode a single literal —
 * became one literal. Two declarations that no rule could see are now seen by
 * every rule, and both conform.
 *
 * Enumerated by rule + path + construct + code exactly as every earlier
 * movement is. A third movement, or a movement at any other site, still fails.
 */
const SCREEN_GROUP_1_INCIDENTAL_REMOVALS = [
  ['UIC-000', 'js/screens/cliente-pedido-form.js', "style: '...' + <expression>", 'CONCATENATED_STYLE_EXPRESSION', 1],
  ['UIC-000', 'js/screens/pedido-form.js', "style: '...' + <expression>", 'CONCATENATED_STYLE_EXPRESSION', 1],
];
const SCREEN_GROUP_1_INCIDENTAL_ADDITIONS = [];

/*
 * INTTEX-BRAND-ASSET-INTEGRATION removed exactly ONE further UIC-000 coverage
 * gap and added NONE. The site is the login card's improvised "In"
 * placeholder: a 72x72 bordered box whose inline style was WRAPPED across four
 * source lines as `'a' + 'b' + 'c' + 'd'`, which the js-screen front-end
 * reports as CONCATENATED_STYLE_EXPRESSION because it can only decode a single
 * literal. The order replaced that box with the approved horizontal Inttex
 * logo, an <img> whose style IS a single literal, so the undecodable
 * declaration stopped existing rather than being suppressed.
 *
 * This is not a widening of the ruling above: no detector branch changed, no
 * rule was silenced, and the movement is enumerated by rule + path +
 * construct + code exactly as every earlier one is. A second movement, or a
 * movement at any other site, still fails.
 */
const BRAND_INCIDENTAL_REMOVALS = [
  ['UIC-000', 'js/screens/system-screens.js', "style: '...' + <expression>", 'CONCATENATED_STYLE_EXPRESSION', 1],
];
const BRAND_INCIDENTAL_ADDITIONS = [];

const BRAND_REMOVED_COUNT = BRAND_INCIDENTAL_REMOVALS.reduce((n, r) => n + r[4], 0);
const BRAND_ADDED_COUNT = BRAND_INCIDENTAL_ADDITIONS.reduce((n, r) => n + r[4], 0);
const BRAND_UIC000_NET = BRAND_REMOVED_COUNT - BRAND_ADDED_COUNT;

const SG1_REMOVED_COUNT = SCREEN_GROUP_1_INCIDENTAL_REMOVALS.reduce((n, r) => n + r[4], 0);
const SG1_ADDED_COUNT = SCREEN_GROUP_1_INCIDENTAL_ADDITIONS.reduce((n, r) => n + r[4], 0);
const SG1_UIC000_NET = SG1_REMOVED_COUNT - SG1_ADDED_COUNT;

const B1_REMOVED_COUNT = B1_INCIDENTAL_REMOVALS.reduce((n, r) => n + r[4], 0);
const B1_ADDED_COUNT = B1_INCIDENTAL_ADDITIONS.reduce((n, r) => n + r[4], 0);
const B1_UIC000_NET = B1_INCIDENTAL_REMOVALS
  .filter((r) => r[0] === 'UIC-000').reduce((n, r) => n + r[4], 0)
  - B1_ADDED_COUNT;
const B1_UIC009_REMOVED = B1_INCIDENTAL_REMOVALS
  .filter((r) => r[0] === 'UIC-009').reduce((n, r) => n + r[4], 0);

const withoutLaterPasses = (findings) =>
  findings.filter((f) => !RULES_OWNED_BY_A_LATER_PASS.has(f.rule_id));

const A2_DELTA = multisetDelta(
  withoutLaterPasses(ENTRY_BASELINE.findings),
  withoutLaterPasses(BASELINE.findings),
);

test('21 · A2 moved nothing outside the rules later passes own', () => {
  // The only removals permitted outside rule ownership are the six pass-7
  // incidental UIC-000 gaps, matched site by site.
  const expectedRemovals = [];
  for (const [relPath, context, code, n] of PASS7_INCIDENTAL_UIC000_REMOVALS) {
    for (let i = 0; i < n; i += 1) expectedRemovals.push(`UIC-000|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of B1_INCIDENTAL_REMOVALS) {
    for (let i = 0; i < n; i += 1) expectedRemovals.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of SCREEN_GROUP_1_INCIDENTAL_REMOVALS) {
    for (let i = 0; i < n; i += 1) expectedRemovals.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of BRAND_INCIDENTAL_REMOVALS) {
    for (let i = 0; i < n; i += 1) expectedRemovals.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  // UIC-009 carries no COVERAGE_GAP code, so name it by its rule instead of
  // letting it collapse to an unidentifiable '?'.
  const codeOf = (f) => {
    const m = /COVERAGE_GAP \/ ([A-Z_]+)/.exec(f[7]);
    if (m) return m[1];
    return f[0] === 'UIC-009' ? 'DEPRECATED_TOKEN_REFERENCE' : '?';
  };
  const actualRemovals = A2_DELTA.removed.map((f) => `${f[0]}|${f[2]}|${f[6]}|${codeOf(f)}`);
  assert.deepEqual(actualRemovals.slice().sort(), expectedRemovals.slice().sort(),
    `A2 may only lose the six authorized pass-7 UIC-000 gaps:\n${
      A2_DELTA.removed.map((f) => f[0] + ' ' + f[2]).join('\n')}`);
  assert.equal(A2_DELTA.removed.length,
    PASS7_UIC000_REMOVED_COUNT + B1_REMOVED_COUNT + SG1_REMOVED_COUNT + BRAND_REMOVED_COUNT);
  assert.equal(SG1_REMOVED_COUNT, 2);
  assert.equal(BRAND_REMOVED_COUNT, 1);
  assert.equal(PASS7_UIC000_REMOVED_COUNT, 6);
  assert.equal(B1_REMOVED_COUNT, 14);

  // The only additions permitted outside rule ownership are the two pass-8
  // Parâmetros gaps, matched site by site exactly as the removals are.
  const expectedAdditions = [];
  for (const [relPath, context, code, n] of PASS8_INCIDENTAL_UIC000_ADDITIONS) {
    for (let i = 0; i < n; i += 1) expectedAdditions.push(`UIC-000|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of B1_INCIDENTAL_ADDITIONS) {
    for (let i = 0; i < n; i += 1) expectedAdditions.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of SCREEN_GROUP_1_INCIDENTAL_ADDITIONS) {
    for (let i = 0; i < n; i += 1) expectedAdditions.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  for (const [ruleId, relPath, context, code, n] of BRAND_INCIDENTAL_ADDITIONS) {
    for (let i = 0; i < n; i += 1) expectedAdditions.push(`${ruleId}|${relPath}|${context}|${code}`);
  }
  const actualAdditions = A2_DELTA.added.map((f) => `${f[0]}|${f[2]}|${f[6]}|${codeOf(f)}`);
  assert.deepEqual(actualAdditions.slice().sort(), expectedAdditions.slice().sort(),
    `A2 COVERAGE DELTA EXCEEDS THE ARCHITECT RULING:\n${A2_DELTA.added.map((f) => f[0] + ' ' + f[2]).join('\n')}`);
});

test('21b · A2 added nothing outside the rules later passes own', () => {
  assert.equal(A2_DELTA.added.length,
    PASS8_UIC000_ADDED_COUNT + B1_ADDED_COUNT + SG1_ADDED_COUNT + BRAND_ADDED_COUNT);
  assert.equal(SG1_ADDED_COUNT, 0, 'SCREEN-GROUP-1 added no finding to any rule');
  assert.equal(BRAND_ADDED_COUNT, 0,
    'INTTEX-BRAND-ASSET-INTEGRATION added no finding to any rule');
  assert.equal(PASS8_UIC000_ADDED_COUNT, 2);
  assert.equal(B1_ADDED_COUNT, 3);
  for (const [ruleId, severity, relPath, , , , , message] of A2_DELTA.added) {
    assert.equal(ruleId, 'UIC-000', `${relPath}: only a coverage gap may appear`);
    assert.equal(severity, 'coverage', `${relPath}: only a coverage gap may appear`);
    assert.match(message, /TEMPLATE_INTERPOLATED_VALUE|NON_LITERAL_STYLE_ASSIGNMENT/,
      `${relPath}: unexpected coverage code`);
  }
  // The five findings A2 DID add were all UIC-008 / coverage /
  // ACTION_ROW_UNPROVEN. That rule is now owned by pass 5, which withdrew the
  // blanket branch entirely, so the historical fact is asserted against the
  // ENTRY baseline rather than against a live count that no longer exists.
  const entry = ENTRY_BASELINE.findings.filter((f) => f.rule_id === 'UIC-008');
  assert.equal(entry.length, UIC008_COVERAGE_BEFORE);
  for (const f of entry) {
    assert.equal(f.severity, 'coverage');
    assert.match(f.message, /ACTION_ROW_UNPROVEN/);
  }
  return;
  // The key is positional: [rule_id, severity, path, property, observed,
  // resolved, element_or_context, message] — read it back field by field.
  for (const [ruleId, severity, relPath, , , , , message] of A2_DELTA.added) {
    assert.equal(ruleId, 'UIC-008', `${relPath}: only UIC-008 may appear`);
    assert.equal(severity, 'coverage', `${relPath}: only a coverage gap may appear`);
    assert.match(message, /ACTION_ROW_UNPROVEN/, `${relPath}: only ACTION_ROW_UNPROVEN may appear`);
  }
});

test('21c · the five newly observable files became evaluable, and only those five', () => {
  // A2 added exactly five UIC-008 gaps, on exactly these paths. Read from the
  // ENTRY baseline: pass 5 later withdrew the branch that produced them.
  const entryPaths = ENTRY_BASELINE.findings
    .filter((f) => f.rule_id === 'UIC-008').map((f) => f.path);
  for (const rel of A2_NEWLY_OBSERVABLE) {
    assert.ok(!entryPaths.includes(rel), rel + ' already carried a gap before A2');
  }
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

test('21d · no rule moved except UIC-008, which a later pass closed', () => {
  const ids = new Set([...Object.keys(ENTRY_BASELINE.summary_by_rule), ...Object.keys(BASELINE.summary_by_rule)]);
  for (const id of ids) {
    const before = ENTRY_BASELINE.summary_by_rule[id];
    const after = BASELINE.summary_by_rule[id];
    if (id === 'UIC-008') {
      // A2 raised the gaps 37 -> 42; pass 5 then withdrew the branch and closed
      // the rule. Both facts are asserted exactly, neither is loosened.
      assert.equal(before.coverage_gaps, UIC008_COVERAGE_BEFORE);
      assert.equal(before.blocking, 0);
      assert.equal(after.coverage_gaps, 0, 'pass 5 must leave UIC-008 closed');
      assert.equal(after.blocking, 0, 'A2 may not turn a coverage gap into a defect');
      continue;
    }
    if (RULES_OWNED_BY_A_LATER_PASS.has(id)) {
      // Not "anything goes": pass 3 closed UIC-003 completely, and this suite
      // asserts that exact end state rather than pretending the rule vanished.
      assert.equal(after.blocking, 0, `${id} is owned by a later pass and must be closed`);
      assert.equal(after.coverage_gaps, 0, `${id} is owned by a later pass and must be closed`);
      continue;
    }
    if (id === 'UIC-000') {
      // Pass 7 removed exactly six gaps together with the native selects that
      // carried them. Both endpoints are pinned; neither is a threshold.
      // …and pass 8 added exactly the two Parâmetros gaps enumerated above.
      assert.equal(before.coverage_gaps, 549);
      // …and SPECIALIZED-CONTROLS-B1 removed a further nine, net of the three
      // range repaints it restated under a new construct name.
      // …and SCREEN-GROUP-1 removed a further two wrapped-literal gaps.
      // …and INTTEX-BRAND-ASSET-INTEGRATION removed the one wrapped-literal gap
      // that the login card's improvised "In" placeholder carried, when the
      // approved logo replaced it.
      assert.equal(after.coverage_gaps, 549 - PASS7_UIC000_REMOVED_COUNT + PASS8_UIC000_ADDED_COUNT
        - B1_UIC000_NET - SG1_UIC000_NET - BRAND_UIC000_NET);
      assert.equal(B1_UIC000_NET, 9);
      assert.equal(SG1_UIC000_NET, 2);
      assert.equal(BRAND_UIC000_NET, 1);
      assert.equal(after.coverage_gaps, 533);
      assert.equal(after.blocking, 0, 'a coverage gap may never become a defect');
      assert.equal(after.debt, 0);
      continue;
    }
    if (id === 'UIC-009') {
      // SPECIALIZED-CONTROLS-B1 retired exactly two deprecated references by
      // moving the reversal-reason textarea's border to css/tokens.css. Both
      // endpoints are pinned; neither is a threshold, and debt only ever falls.
      assert.equal(before.debt, UIC009_ENTRY_CEILING);
      assert.equal(after.debt, UIC009_ENTRY_CEILING - B1_UIC009_REMOVED);
      assert.equal(B1_UIC009_REMOVED, 2);
      assert.equal(after.blocking, 0);
      assert.equal(after.coverage_gaps, 0);
      continue;
    }
    assert.deepEqual(after, before, `${id} moved and A2 authorizes no movement outside UIC-008`);
  }
});

test('21e · blocking, debt, inventory and support are unchanged', () => {
  // Summed over the rules A2 owns; UIC-003 is pinned separately by the pass-3
  // suite, which requires it to reach exactly zero.
  const sum = (b, k) => Object.entries(b.summary_by_rule)
    .filter(([id]) => !RULES_OWNED_BY_A_LATER_PASS.has(id))
    .reduce((n, [, r]) => n + r[k], 0);
  assert.equal(sum(BASELINE, 'blocking'), sum(ENTRY_BASELINE, 'blocking'),
    'A2 is a radius-ownership change; it may not move a blocking count');
  assert.equal(sum(BASELINE, 'debt'),
    sum(ENTRY_BASELINE, 'debt') - B1_UIC009_REMOVED,
    'debt may only fall, and only by the two B1 retired references');
  // The coverage sum moved by exactly the six authorized pass-7 removals, and
  // the current repository totals are pinned to their post-pass-7 values.
  const coverageSum = (b) => Object.entries(b.summary_by_rule)
    .filter(([id]) => !RULES_OWNED_BY_A_LATER_PASS.has(id))
    .reduce((n, [, r]) => n + r.coverage_gaps, 0);
  assert.equal(coverageSum(ENTRY_BASELINE) - coverageSum(BASELINE),
    PASS7_UIC000_REMOVED_COUNT - PASS8_UIC000_ADDED_COUNT + B1_UIC000_NET + SG1_UIC000_NET
      + BRAND_UIC000_NET);
  // SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION. B1 moved the specialized
  // controls' inline styles into css/tokens.css, which the detector does not
  // read, so nine UIC-000 coverage gaps and two UIC-009 references stopped
  // existing as JavaScript declarations: 867 -> 856, coverage 545 -> 536,
  // debt 322 -> 320. B1 ADDED no finding to any rule.
  // SCREEN-GROUP-1 then removed the two wrapped-literal gaps: 856 -> 854.
  // INTTEX-BRAND-ASSET-INTEGRATION then removed the one the login placeholder
  // carried: 854 -> 853.
  assert.equal(BASELINE.findings.length, 853,
    'current repository total after INTTEX-BRAND-ASSET-INTEGRATION');
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
  assert.equal(rule('UIC-009').debt, UIC009_ENTRY_CEILING - B1_UIC009_REMOVED);
  assert.equal(BASELINE.inventory.application.count, ENTRY_BASELINE.inventory.application.count);
  assert.equal(BASELINE.inventory.application.count, APPLICATION_FILE_COUNT);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(ENTRY_BASELINE.coverage_summary.UNSUPPORTED, 0);
  // Detector semantics did not move under A2 — only what the screens declare
  // did. Phase-5 pass 3 later raised the version for its own UIC-003
  // correction, so this pins both exact values rather than their equality.
  assert.equal(ENTRY_BASELINE.detector_version, '1.0.3');
  assert.equal(BASELINE.detector_version, '1.0.6');
  // A2 did not touch the closed enums. Phase-5 pass 6 was authorized to revise
  // the font_size enum, so the two hashes now differ by that authorized change
  // alone; both are pinned exactly instead of merely being compared.
  assert.equal(ENTRY_BASELINE.contract_blob_hash,
    'f8349e6eeca291fef2edf4d6e30afd628732f00b6495d54eb9273860fa63f1c4');
  assert.equal(BASELINE.contract_blob_hash,
    'dbb686c85a4cd0c96d9ca857738f4081460b2e56e94289f5d56d19f21cc732ac');
});

test('21f · A2 moved exactly five files FULL -> PARTIAL, and only those five', () => {
  // A2's own accepted coverage result was FULL 23 / PARTIAL 44 / UNSUPPORTED 0,
  // and those five FULL->PARTIAL moves were its whole difference. Pass 5 then
  // withdrew the blanket UIC-008 branch, which is the ONLY reason a file may
  // move back: every file that returned to FULL must be one the blanket gap
  // alone was degrading, and it must now carry no coverage gap at all.
  assert.equal(A2_FULL, 23);
  assert.equal(A2_PARTIAL, 44);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(ENTRY_BASELINE.coverage_summary.UNSUPPORTED, 0);
  const before = new Map(ENTRY_BASELINE.inventory.application.files.map((f) => [f.path, f.coverage]));
  for (const f of BASELINE.inventory.application.files) {
    const was = before.get(f.path);
    if (was === f.coverage) continue;
    if (A2_NEWLY_OBSERVABLE.includes(f.path)) continue; // A2's own five
    assert.equal(was, 'PARTIAL', `${f.path}: ${was}->${f.coverage} is not a pass-5 recovery`);
    assert.equal(f.coverage, 'FULL', `${f.path}: ${was}->${f.coverage} is not a pass-5 recovery`);
    assert.equal(BASELINE.summary_by_file[f.path].coverage_gaps, 0,
      `${f.path} returned to FULL while still carrying a coverage gap`);
  }
});

/*
 * PEDIDO-SCREEN-GROUP-1 FORWARD CORRECTION to 21g.
 *
 * The subject of 21g is "A2 did not mark these rows", and its reason still
 * holds exactly as written: A2 was a RADIUS pass and marking the five rows it
 * had just made observable would have closed the symptom and left the
 * population unproven.
 *
 * But 21g measured that claim by diffing A2's entry checkpoint against the
 * CURRENT tree, so it also silently forbade every LATER order from ever
 * marking one of those five paths. ACTION-CONTAINMENT-A1 then CANCELLED the
 * global alignment phase and ruled that local action containment is corrected
 * INSIDE each screen batch. PEDIDO-SCREEN-GROUP-1 is that batch for two of the
 * five, so it marks exactly two rows — and it does so having brought each row
 * onto the full canonical footer contract, which the pass-5 suite proves
 * independently.
 *
 * The correction keeps A2's ruling intact and makes the measurement say what
 * it means: the per-path delta is enumerated exactly, so an unlisted marker on
 * any of the five still fails, and the three untouched paths must still be at
 * zero.
 */
const MARKERS_ADDED_BY_A_LATER_ORDER = new Map([
  ['js/screens/pedido-edit.js', 1],            // PEDIDO-SCREEN-GROUP-1
  ['js/screens/pedido-itens-edit.js', 1],      // PEDIDO-SCREEN-GROUP-1
  // PEDIDO-SCREEN-GROUP-2 is the screen batch for the two ADMINISTRATIVE paths
  // of the same five. Same instrument, same ruling, same evidence: each row was
  // brought onto the full canonical footer contract first, which the pass-5
  // suite proves independently, and only then declared. Four of A2's five paths
  // are now reached by a named later order; js/screens/pedido-insumos-
  // distribuicao.js is the one that remains at zero and unclaimed.
  ['js/screens/pedido-tracking-admin.js', 1],  // PEDIDO-SCREEN-GROUP-2
  ['js/screens/pedido-parciais-admin.js', 1],  // PEDIDO-SCREEN-GROUP-2
]);

test('21g · A2 added no data-card-actions marker on any of its five paths', () => {
  // The UIC-008 alignment pass is a separate, dedicated order that must
  // reconcile the whole 42-gap corpus. Marking only the five newly visible
  // rows here would close the symptom and leave the population unproven.
  //
  // Counted over COMMENT-STRIPPED code: prose naming the marker is not a marker.
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const rel of A2_NEWLY_OBSERVABLE) {
    const now = strip(read(rel));
    const then = strip(execFileSync('git', ['show', `${A2_ENTRY_CHECKPOINT}:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    const allowed = MARKERS_ADDED_BY_A_LATER_ORDER.get(rel) || 0;
    assert.equal(count(now, 'data-card-actions'), count(then, 'data-card-actions') + allowed,
      `${rel}: A2 may not add a card-action marker`);
  }
  // The three paths no later order has reached are still exactly at zero.
  for (const rel of A2_NEWLY_OBSERVABLE) {
    if (MARKERS_ADDED_BY_A_LATER_ORDER.has(rel)) continue;
    assert.equal(count(strip(read(rel)), 'data-card-actions'), 0,
      `${rel}: an unauthorized card-action marker appeared`);
  }
  assert.equal([...MARKERS_ADDED_BY_A_LATER_ORDER.values()].reduce((a, b) => a + b, 0), 4);
  // Exactly one of A2's five paths has still not been reached by any order.
  assert.deepEqual(
    A2_NEWLY_OBSERVABLE.filter((rel) => !MARKERS_ADDED_BY_A_LATER_ORDER.has(rel)),
    ['js/screens/pedido-insumos-distribuicao.js'],
  );
  // A2 raised the population to 42 and left every gap open. Pass 5 owns the
  // rule now: it withdrew the blanket branch and marked exactly four proven
  // footers, none of which is one of A2's five paths.
  assert.equal(ENTRY_BASELINE.summary_by_rule['UIC-008'].coverage_gaps, UIC008_COVERAGE_BEFORE);
  assert.equal(UIC008_COVERAGE_AFTER, 42, 'A2 raised the population to exactly 42');
  assert.equal(rule('UIC-008').coverage_gaps, 0);
  assert.equal(rule('UIC-008').blocking, 0);
  assert.equal(BASELINE.highlights.action_alignment_coverage_gaps, 0);
});

/* ============================================================
   22 · A3 — THE FIRST-PARTY PRODUCT RUNTIME, NOT JUST THE SCREENS

   The radius property is evaluated over the RENDERED first-party
   product surface. `js/screens/*.js` is the detector's inventory,
   not the surface: a shared primitive that manufactures application
   controls renders on every route while sitting outside all 66
   files. `js/ui.js` did exactly that — `textInput` and `selectInput`
   rendered at 8px from a `rounded-lg` no rule could see.

   This guard is deliberately NOT the detector inventory and does not
   redefine it. It walks every local script `index.html` actually
   loads and holds the whole product runtime to the closed enum.
   ============================================================ */

/** Every local script the application really loads, screens included. */
const INDEX_HTML = read('index.html');
const RUNTIME_SCRIPTS = [...INDEX_HTML.matchAll(/src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((s) => !/^https?:/.test(s))
  .map((s) => s.replace(/\?v=.*$/, ''));
const SHARED_RUNTIME = RUNTIME_SCRIPTS.filter((s) => !s.startsWith('js/screens/'));

/**
 * Byte ranges covered by a `console.*(…)` call, by paren balancing.
 *
 * A `border-radius` inside one is a DevTools `%c` format string: it never
 * reaches the DOM, and a CSS custom property does NOT resolve in console
 * styling, so rewriting it to `var(--rv-radius)` would break the styling
 * rather than canonicalize it. Excluded on that mechanical basis alone —
 * never by path, never by an ignore list.
 */
function consoleCallRanges(src) {
  const out = [];
  for (const m of src.matchAll(/\bconsole\s*\.\s*[A-Za-z]+\s*\(/g)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') { depth--; if (depth === 0) break; }
    }
    out.push([m.index, i]);
  }
  return out;
}

/** Every radius a runtime file declares, however it is spelled. */
function runtimeRadiusSites(text) {
  const skip = commentRanges(text).concat(consoleCallRanges(text));
  const blocked = (i) => skip.some(([a, b]) => i >= a && i <= b);
  const out = { tailwind: [], values: [], constants: [] };

  for (const m of text.matchAll(TAILWIND_RADIUS_UTILITY)) {
    if (blocked(m.index)) continue;
    out.tailwind.push({ token: m[0], line: text.slice(0, m.index).split('\n').length });
  }
  // Explicit style strings, static template fragments and concatenations.
  for (const m of text.matchAll(/border-radius\s*:\s*([^;'"`\n}]*)/g)) {
    if (blocked(m.index)) continue;
    const value = m[1].trim();
    if (value) out.values.push({ value, line: text.slice(0, m.index).split('\n').length });
  }
  // `.style.borderRadius = …` and `{ borderRadius: … }`.
  for (const m of text.matchAll(/borderRadius\s*(?:=|:)\s*(['"`])([^'"`]*)\1/g)) {
    if (blocked(m.index)) continue;
    out.values.push({ value: m[2].trim(), line: text.slice(0, m.index).split('\n').length });
  }
  // A named constant holding geometry is still that file owning geometry.
  // A property assignment is NOT one: `node.style.borderRadius = '4px'` is a
  // declaration, already measured by the value rule above, and `borderRadius`
  // is the DOM property name rather than a name this file invented.
  for (const m of text.matchAll(/(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*(?:RADIUS|[Rr]adius)[A-Za-z0-9_$]*)\s*=\s*(['"`])([^'"`]*)\3/g)) {
    if (blocked(m.index)) continue;
    if (m[2] === 'borderRadius') continue;
    out.constants.push({ name: m[2], value: m[4].trim(), line: text.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** A constant may legally hold a radius only as a token, never a literal. */
const isRadiusValued = (v) => RADIUS_IN_ENUM.has(v) || /^-?\d/.test(v) || v.endsWith('%');

test('22 · the application really loads what this guard claims to cover', () => {
  // If index.html stops loading a module, the guard must shrink loudly rather
  // than silently pass over a file nobody serves any more.
  assert.equal(RUNTIME_SCRIPTS.length, ALL_SCREENS.length + SHARED_RUNTIME.length);
  assert.equal(RUNTIME_SCRIPTS.filter((s) => s.startsWith('js/screens/')).length, APPLICATION_FILE_COUNT);
  assert.ok(SHARED_RUNTIME.includes('js/ui.js'), 'the shared control factory must be covered');
  for (const rel of SHARED_RUNTIME) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} is loaded but absent from the worktree`);
  }
});

test('22b · TAILWIND_RADIUS_UTILITY_COUNT_IN_PRODUCT_RUNTIME === 0', () => {
  const offenders = [];
  const files = new Set();
  for (const rel of RUNTIME_SCRIPTS) {
    for (const h of runtimeRadiusSites(read(rel)).tailwind) {
      offenders.push(`${rel}:${h.line} ${h.token}`);
      files.add(rel);
    }
  }
  assert.equal(offenders.length, 0,
    `css/tokens.css is the only radius owner in the product runtime:\n${offenders.join('\n')}`);
  assert.equal(files.size, 0, 'TAILWIND_RADIUS_UTILITY_FILE_COUNT_IN_PRODUCT_RUNTIME must be 0');
});

test('22c · OUT_OF_ENUM_RUNTIME_RADIUS_COUNT === 0', () => {
  const offenders = [];
  for (const rel of RUNTIME_SCRIPTS) {
    for (const h of runtimeRadiusSites(read(rel)).values) {
      if (RADIUS_IN_ENUM.has(h.value)) continue;
      offenders.push(`${rel}:${h.line} ${h.value}`);
    }
  }
  assert.deepEqual(offenders, [],
    `every runtime radius must resolve through the closed enum:\n${offenders.join('\n')}`);
});

test('22d · OUT_OF_ENUM_RUNTIME_RADIUS_CONSTANT_COUNT === 0', () => {
  const offenders = [];
  for (const rel of RUNTIME_SCRIPTS) {
    for (const c of runtimeRadiusSites(read(rel)).constants) {
      if (!isRadiusValued(c.value)) continue;          // not geometry at all
      if (RADIUS_IN_ENUM.has(c.value) && c.value.startsWith('var(')) continue;
      offenders.push(`${rel}:${c.line} ${c.name} = '${c.value}'`);
    }
  }
  assert.deepEqual(offenders, [],
    `a radius constant must hold a token, never a literal:\n${offenders.join('\n')}`);
});

test('22e · the runtime guard actually fires — it is not a vacuous zero', () => {
  const tw = (probe) => runtimeRadiusSites(probe).tailwind.length;
  const vals = (probe) => runtimeRadiusSites(probe).values.map((v) => v.value);
  const consts = (probe) => runtimeRadiusSites(probe).constants.map((c) => c.value);

  // Class tokens, in every shape the runtime writes them.
  assert.equal(tw(`el('div', { class: 'bg-white rounded shadow' })`), 1);
  assert.equal(tw(`el('div', { class: 'bg-white rounded-lg shadow' })`), 1);
  assert.equal(tw(`el('div', { class: 'bg-white rounded-xl shadow' })`), 1);
  assert.equal(tw(`el('span', { class: 'px-2 rounded-full ' + skin })`), 1);
  assert.equal(tw('node.className = `card rounded-2xl ${extra}`;'), 1);
  // Explicit style strings, concatenated fragments and JS assignments.
  assert.deepEqual(vals(`x.style.cssText = 'color:#fff;' + 'border-radius:8px;'`), ['8px']);
  assert.deepEqual(vals("node.style.borderRadius = '8px';"), ['8px']);
  assert.deepEqual(vals('el("div", { style: `border-radius:8px;` })'), ['8px']);
  // Named constants.
  assert.deepEqual(consts("const SOME_RADIUS = '8px';"), ['8px']);
  assert.deepEqual(consts("var cardRadius = '8px';"), ['8px']);

  // …and prose, unrelated identifiers and console styling must NOT fire.
  assert.equal(tw('// the old rounded-xl card is gone\n'), 0);
  assert.equal(tw('/* rounded-full was removed by A3 */\n'), 0);
  assert.equal(tw('var roundedValue = 1; surroundedBy(x);'), 0);
  assert.equal(vals("console.warn('%c[X] hi', 'padding:2px;border-radius:3px;')").length, 0,
    'a DevTools %c format string is not rendered product surface');
  assert.equal(vals("console.info('%cA', 'border-radius:3px;'); el('i', { style: 'border-radius:8px;' })").length, 1,
    'excluding the console call must not swallow the declaration after it');
});

test('22f · the three console-styling radii are the only excluded sites, and they are unchanged', () => {
  // Named explicitly so the exclusion can never quietly widen: if a fourth
  // appears, or one of these moves into real markup, this fails.
  const EXCLUDED = { 'js/environment-banner.js': 2, 'js/supabase-client.js': 1 };
  const found = {};
  for (const rel of SHARED_RUNTIME) {
    const text = read(rel);
    const ranges = consoleCallRanges(text);
    let n = 0;
    for (const m of text.matchAll(/border-radius\s*:\s*([^;'"`\n}]*)/g)) {
      if (ranges.some(([a, b]) => m.index >= a && m.index <= b)) n += 1;
    }
    if (n) found[rel] = n;
  }
  assert.deepEqual(found, EXCLUDED,
    'only the declared DevTools console format strings may be excluded');
});

/* ============================================================
   23 · A4 — THE THREE SHARED SEMANTIC BADGE CONSTRUCTORS

   `badgeStatus` and `pedidoStatusBadge` render a LIFECYCLE STATUS;
   `badgeTipo` renders an OP-TYPE CLASSIFICATION. All three used to
   build their own span from a local Tailwind family map, at ordinary
   4px geometry — which made them semantic badges that neither the
   canonical badge owner nor D6.1 governed.

   They now delegate to the canonical constructors in js/badges.js.
   These guards execute the REAL modules and assert the rendered
   result, so a return to a local map, to 4px, or to a missing or
   spurious dot fails here rather than in review.
   ============================================================ */

const A4_BADGES_SRC = read('js/badges.js');
const A4_PEDIDO_UI_SRC = read('js/pedido-ui.js');

/** Minimal DOM good enough for `el()`, mirroring tests/badges.smoke.js. */
function a4Sandbox({ withBadges = true } = {}) {
  class FakeNode {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = []; this._attrs = {}; this._text = null; this.className = '';
    }
    appendChild(n) { this.children.push(n); return n; }
    setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; if (k === 'style') this.style = v; }
    // Pass-7 (§14.1) DOM fidelity: every real element exposes these.
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
    removeAttribute(k) { delete this._attrs[k]; }
    addEventListener() {} removeEventListener() {}
    replaceChildren(...nodes) {
      this.children = [];
      for (const n of nodes.flat()) { if (n == null || n === false) continue; this.children.push(typeof n === 'string' ? new FakeText(n) : n); }
    }
    get textContent() { return this._text != null ? this._text : this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this._text = v; this.children = []; }
  }
  class FakeText extends FakeNode { constructor(t) { super('#text'); this._text = t; } }
  const document = {
    createElement: (t) => new FakeNode(t), createTextNode: (t) => new FakeText(t),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {}, body: new FakeNode('body'),
  };
  const sandbox = { document, setTimeout, clearTimeout, console };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(read('js/ui.js'), sandbox, { filename: 'js/ui.js' });
  if (withBadges) vm.runInContext(A4_BADGES_SRC, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(A4_PEDIDO_UI_SRC, sandbox, { filename: 'js/pedido-ui.js' });
  return sandbox;
}

const A4_SANDBOX = a4Sandbox();
const a4Run = (expr) => vm.runInContext(expr, A4_SANDBOX, { filename: 'a4-probe' });

/** The family a node's skin resolves to, read back from the pill token it used. */
function a4FamilyOf(node) {
  const style = String(node && node.style ? node.style : '');
  const m = style.match(/var\(--rv-pill-([a-z]+)-bg\)/);
  return m ? m[1] : null;
}
const a4Dots = (node) => (node && node.children ? node.children : [])
  .filter((c) => String(c.style || '').includes('width:5px') && String(c.style || '').includes('height:5px'));

test('23 · each constructor delegates to the canonical owner and declares no ordinary radius', () => {
  // Source-level: the delegation IS the implementation, not a wrapper around the
  // old span, and none of the three writes the ordinary radius any more.
  assert.match(A4_BADGES_SRC, /function badgeStatus\(status\)\s*\{\s*return rvStatusPill\(/);
  assert.match(A4_BADGES_SRC, /function badgeTipo\(tipo\)\s*\{\s*return rvClassificationBadge\(/);
  assert.match(A4_PEDIDO_UI_SRC, /function pedidoStatusBadge\(status\)[\s\S]{0,240}?return window\.rvStatusPill\(/);

  const badgeTipoBody = A4_BADGES_SRC.slice(A4_BADGES_SRC.indexOf('function badgeTipo'), A4_BADGES_SRC.indexOf('function badgeStatus'));
  const afterStatus = A4_BADGES_SRC.indexOf('function badgeStatus');
  const badgeStatusBody = A4_BADGES_SRC.slice(afterStatus, A4_BADGES_SRC.indexOf('// ====', afterStatus));
  // `function pedidoStatusBadge(` — the trailing paren is what separates it from
  // `pedidoStatusBadgeClass`, which is retained and legitimately reads the map.
  const pedidoBadgeBody = A4_PEDIDO_UI_SRC.slice(A4_PEDIDO_UI_SRC.indexOf('function pedidoStatusBadge('), A4_PEDIDO_UI_SRC.indexOf('function pedidoStatusTodos'));
  for (const [name, body] of [['badgeTipo', badgeTipoBody], ['badgeStatus', badgeStatusBody], ['pedidoStatusBadge', pedidoBadgeBody]]) {
    assert.doesNotMatch(body, /var\(--rv-radius\)/, name + ' must not declare ordinary radius geometry');
    assert.doesNotMatch(body, /bg-\w+-\d{3}|text-\w+-\d{3}/, name + ' must not consume a local Tailwind family class');
  }
  // The legacy maps survive for their compatibility consumers, but no rendered
  // constructor may read them.
  assert.doesNotMatch(badgeStatusBody, /OP_STATUS_BADGE/);
  assert.doesNotMatch(badgeTipoBody, /OP_TIPO_BADGE\[/);
  assert.doesNotMatch(pedidoBadgeBody, /PEDIDO_STATUS_BADGE\[|pedidoStatusBadgeClass\(/);
  for (const legacy of ['OP_STATUS_BADGE', 'OP_TIPO_BADGE']) assert.ok(A4_BADGES_SRC.includes(legacy), legacy + ' stays for its compatibility consumer');
  for (const legacy of ['PEDIDO_STATUS_BADGE', 'pedidoStatusBadgeClass']) assert.ok(A4_PEDIDO_UI_SRC.includes(legacy), legacy + ' stays for its compatibility consumer');
});

test('23b · every rendered badge resolves to the canonical pill radius', () => {
  for (const expr of ["badgeStatus('em_producao')", "badgeTipo('tecelagem')", "window.pedidoStatusBadge('entregue')"]) {
    const node = a4Run(expr);
    assert.ok(node, expr + ' returned nothing');
    assert.equal(node.tagName, 'SPAN');
    assert.match(String(node.style), /border-radius:var\(--rv-radius-pill\)/, expr + ' must carry pill geometry');
    assert.doesNotMatch(String(node.style), /border-radius:var\(--rv-radius\);/, expr + ' must not carry ordinary geometry');
    assert.match(String(node.style), /height:18px/, expr + ' must use the canonical 18px pill');
  }
});

test('23c · the OP lifecycle family matrix', () => {
  const EXPECTED = { simulada: 'neutral', aberta: 'info', em_producao: 'caution', finalizada: 'positive' };
  for (const [status, family] of Object.entries(EXPECTED)) {
    const node = a4Run('badgeStatus(' + JSON.stringify(status) + ')');
    assert.equal(a4FamilyOf(node), family, "badgeStatus('" + status + "')");
    assert.equal(a4Dots(node).length, 1, "badgeStatus('" + status + "') must render exactly one 5px status dot");
  }
  // An unknown lifecycle state is neutral — never an invented family.
  const unknown = a4Run("badgeStatus('xyz')");
  assert.equal(a4FamilyOf(unknown), 'neutral');
  assert.equal(unknown.textContent, 'xyz', 'the label still falls back to the raw key');
});

test('23d · the Pedido lifecycle family matrix', () => {
  const EXPECTED = {
    rascunho: 'neutral', recebido: 'positive', confirmado: 'neutral',
    produzindo: 'caution', entregue: 'positive', cancelado: 'negative',
  };
  for (const [status, family] of Object.entries(EXPECTED)) {
    const node = a4Run('window.pedidoStatusBadge(' + JSON.stringify(status) + ')');
    assert.ok(node, "pedidoStatusBadge('" + status + "') returned nothing");
    assert.equal(a4FamilyOf(node), family, "pedidoStatusBadge('" + status + "')");
    assert.equal(a4Dots(node).length, 1, "pedidoStatusBadge('" + status + "') must render exactly one 5px status dot");
  }
  // `produzindo` is caution only through the accepted alias, not a new family.
  assert.equal(a4Run("window.rvStatusFamily('produzindo')"), 'caution');
  assert.equal(a4Run("window.RV_BADGES.RV_STATUS_KEY_ALIAS['produzindo']"), 'em producao');
});

test('23e · badgeTipo is a neutral classification badge with no status dot', () => {
  for (const [tipo, label] of [['tecelagem', 'Tecelagem'], ['latex', 'Látex']]) {
    const node = a4Run('badgeTipo(' + JSON.stringify(tipo) + ')');
    assert.equal(a4FamilyOf(node), 'neutral', "badgeTipo('" + tipo + "') must be a neutral classification");
    assert.equal(a4Dots(node).length, 0, "badgeTipo('" + tipo + "') must render NO status dot");
    assert.equal(node.textContent, label, 'the meaning is carried by the label');
    // The per-type indigo/amber treatment is gone, and Latex is not a stage.
    assert.doesNotMatch(String(node.style), /--rv-stage-/, 'the OP type is not the contract acabamento stage');
  }
  assert.equal(a4FamilyOf(a4Run("badgeTipo('xyz')")), 'neutral');
});

test('23f · the guards are not vacuous — the pre-A4 shape fails them', () => {
  // Reconstruct exactly what these helpers used to return and prove each
  // assertion above rejects it.
  const legacy = a4Run("el('span', { style: 'border-radius:var(--rv-radius);', class: 'px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700' }, 'x')");
  assert.equal(a4FamilyOf(legacy), null, 'a Tailwind-class badge resolves to no canonical family');
  assert.equal(a4Dots(legacy).length, 0, 'a Tailwind-class status badge has no dot');
  assert.doesNotMatch(String(legacy.style), /border-radius:var\(--rv-radius-pill\)/);
  // …and the family reader really does distinguish the five families.
  const seen = new Set(['simulada', 'aberta', 'em_producao', 'finalizada', 'cancelado']
    .map((s) => a4FamilyOf(a4Run('badgeStatus(' + JSON.stringify(s) + ')'))));
  assert.deepEqual([...seen].sort(), ['caution', 'info', 'negative', 'neutral', 'positive']);
});

test('23g · delegation degrades safely when the canonical owner is absent', () => {
  // js/pedido-ui.js loads after js/badges.js; if the owner is missing the badge
  // must be absent rather than silently rendered by a local fallback map.
  const withoutBadges = a4Sandbox({ withBadges: false });
  assert.equal(vm.runInContext("window.pedidoStatusBadge('entregue')", withoutBadges, { filename: 'a4-probe' }), null);
  // The compatibility helper still answers, unchanged, for its own consumers.
  assert.equal(vm.runInContext("window.pedidoStatusBadgeClass('entregue')", withoutBadges, { filename: 'a4-probe' }), 'bg-green-100 text-green-700');
});
