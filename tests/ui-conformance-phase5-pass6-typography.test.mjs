/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 6 (UIC-005)

   Proves the TYPOGRAPHY property closed. `UIC-005` reports zero.

   Typography is ROLE-BASED, never nearest-number replacement. The pass-6
   ruling retained ten roles, ratified three more — SECTION_HEADING (20px),
   COMPONENT_HEADING (16px) and MICRO_COPY (10px) — and gave the icon-only
   text glyph its own owner, `--rv-icon-glyph-lg`, which shares 20px with
   SECTION_HEADING but is not a heading and not body copy.

   The revised closed enum is therefore thirteen computed values with 10px as
   a hard floor: no value below 10px may exist in first-party rendered runtime.

   TWO GUARDS LIVE HERE, AND THEY ARE DIFFERENT.

     · The DETECTOR guard (§1–2) reads the committed baseline. It covers the
       67-file conformance inventory and nothing else.
     · The RUNTIME OWNERSHIP guard (§4–5) reads index.html and every local
       asset it loads, plus css/tokens.css and css/responsive.css. That is the
       real product surface — 103 files, including js/ui.js and
       js/document-links-surface-ui.js, which no detector rule reaches.

   There is NO path, line or value suppression anywhere in this file. A rule
   that cannot be proved is not written; it is not silenced.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DETECTOR_VERSION } from '../scripts/ui-conformance/rules.mjs';
import { readContract, readTokens } from '../scripts/ui-conformance/contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

/* ============================================================
   0 · the ratified role table, spelled once
   ============================================================ */

/** role → [token, computed value]. This IS the contract, in test form. */
const ROLES = {
  // A1 ratified three numeric-emphasis levels above the compact metric. They
  // are owned and asserted in detail by the A1 suite; they appear here so this
  // suite's enum and counter checks stay complete.
  KPI_HERO: ['--rv-fs-kpi-hero', '30px'],
  KPI_CARD: ['--rv-fs-kpi-card', '24px'],
  SUMMARY_TOTAL: ['--rv-fs-summary-total', '20px'],
  PAGE_TITLE: ['--rv-fs-title', '22px'],
  SECTION_HEADING: ['--rv-fs-section-heading', '20px'],
  COMPONENT_HEADING: ['--rv-fs-component-heading', '16px'],
  EMPHASISED_METRIC: ['--rv-fs-metric', '15px'],
  RAIL_METRIC: ['--rv-fs-metric-rail', '14px'],
  PAIR_VALUE: ['--rv-fs-value', '13.5px'],
  BODY_CONTROL_CELL: ['--rv-fs-body', '13px'],
  SECONDARY_LINE: ['--rv-fs-sm', '12.5px'],
  COMPACT_CONTENT: ['--rv-fs-xs', '12px'],
  METADATA_BADGE: ['--rv-fs-2xs', '11.5px'],
  SECTION_LABEL: ['--rv-fs-label', '11px'],
  TABLE_HEADER: ['--rv-fs-thead', '10.5px'],
  MICRO_COPY: ['--rv-fs-micro', '10px'],
};

/** The icon-only text glyph. Separate owner, deliberately outside ROLES. */
const ICON_GLYPH = ['--rv-icon-glyph-lg', '20px'];

const ENUM = new Set(Object.values(ROLES).map(([, value]) => value));
const FLOOR_PX = 10;

/** Tailwind's default type scale, as the CDN build resolves it. */
const TAILWIND_PX = {
  'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px',
  'text-xl': '20px', 'text-2xl': '24px', 'text-3xl': '30px', 'text-4xl': '36px',
  'text-5xl': '48px', 'text-6xl': '60px', 'text-7xl': '72px', 'text-8xl': '96px',
  'text-9xl': '128px',
};

/* ============================================================
   1 · the pass closed the rule it owns
   ============================================================ */

test('1 · the detector semantics were NOT changed by this pass', () => {
  assert.equal(DETECTOR_VERSION, '1.0.6', 'pass 6 must not move the detector version');
  assert.equal(BASELINE.detector_version, '1.0.6');
});

test('2 · UIC-005 reports zero', () => {
  const uic005 = rule('UIC-005');
  assert.equal(uic005.blocking, 0, 'a typography site is still outside the enum');
  assert.equal(uic005.coverage_gaps, 0);
  assert.equal(uic005.total, 0);
  assert.equal(BASELINE.findings.filter((f) => f.rule_id === 'UIC-005').length, 0);
});

test('3 · all 80 entry findings were removed and none were added', () => {
  // Entry state at checkpoint 212972d: 966 findings, of which exactly 80 were
  // UIC-005. 966 - 80 = 886, with every other rule multiset unchanged.
  //
  // A2 (PASS-6-RUNTIME-INVENTORY-FORWARD-CORRECTION-A2): the numbers below are
  // CURRENT repository state, not pass-6 state. Phase-5 pass 7 closed UIC-006
  // (15 -> 0) and incidentally removed the six UIC-000 gaps that described
  // style expressions ON the deleted native selects (549 -> 543), so the total
  // is 886 - 21 = 865. Pass 6's own result — UIC-005 at zero — is unchanged and
  // is asserted separately.
  // Phase-5 pass 8 then added two UIC-000 gaps for the Cadastros »
  // Parâmetros derived width owner: 865 -> 867.
  // SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION. B1 moved the specialized
  // controls' inline styles into css/tokens.css, which the detector does not
  // read, so nine UIC-000 coverage gaps and two UIC-009 references stopped
  // existing as JavaScript declarations: 867 -> 856, coverage 545 -> 536,
  // debt 322 -> 320. B1 ADDED no finding to any rule.
  assert.equal(BASELINE.findings.length, 856);
  assert.equal(rule('UIC-005').total, 0, 'pass 6 must stay closed');
  assert.equal(rule('UIC-000').coverage_gaps, 536);
  assert.equal(rule('UIC-006').blocking, 0);
  assert.equal(rule('UIC-009').debt, 320);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(BASELINE.inventory.application.count, 66);
});

/* ============================================================
   2 · the revised enum and the role tokens
   ============================================================ */

test('4 · the closed font-size enum is exactly the fifteen ratified values', () => {
  // Thirteen at the pass-6 checkpoint; A1 ratified KPI_HERO 30px and
  // KPI_CARD 24px on top, restoring the numeric hierarchy pass 6 collapsed.
  const contract = readContract(ROOT);
  assert.deepEqual(
    contract.enums.font_size,
    ['30px', '24px', '22px', '20px', '16px', '15px', '14px', '13.5px', '13px',
      '12.5px', '12px', '11.5px', '11px', '10.5px', '10px'],
  );
  assert.equal(contract.enums.font_size.length, 15);
  assert.equal(new Set(contract.enums.font_size).size, 15, 'a value is declared twice');
});

test('5 · every role token resolves to its ratified value in css/tokens.css', () => {
  const tokens = readTokens(ROOT);
  for (const [role, [token, value]] of Object.entries(ROLES)) {
    assert.equal(tokens.values.get(token), value, `${role} (${token})`);
  }
  assert.equal(tokens.values.get(ICON_GLYPH[0]), ICON_GLYPH[1]);
});

/**
 * Typography owners only. `--rv-gap-cols` is also 16px and `--rv-header-h` is
 * also 60px; a spacing token sharing a number with a type ramp step is not a
 * competing typography owner, and conflating them would make this guard assert
 * something the contract never said.
 */
function typographyOwnersAt(value) {
  const tokens = readTokens(ROOT);
  return [...tokens.values]
    .filter(([name]) => /^--rv-(fs|icon-glyph)-/.test(name))
    .filter(([, v]) => v === value)
    .map(([name]) => name)
    .sort();
}

test('6 · 22px is the page-title role and nothing else owns it', () => {
  assert.deepEqual(typographyOwnersAt('22px'), ['--rv-fs-title']);
});

test('7 · 20px supports section heading, summary total AND icon glyph through DISTINCT tokens', () => {
  assert.deepEqual(typographyOwnersAt('20px'),
    ['--rv-fs-section-heading', '--rv-fs-summary-total', '--rv-icon-glyph-lg']);
  // Three roles, three owners, no aliasing: a heading is not a total and
  // neither is a glyph, however equal their computed values.
  assert.notEqual(ROLES.SECTION_HEADING[0], ICON_GLYPH[0]);
  assert.notEqual(ROLES.SECTION_HEADING[0], ROLES.SUMMARY_TOTAL[0]);
  assert.notEqual(ROLES.SUMMARY_TOTAL[0], ICON_GLYPH[0]);
});

test('8 · 16px is the component-heading role and nothing else owns it', () => {
  assert.deepEqual(typographyOwnersAt('16px'), ['--rv-fs-component-heading']);
});

test('9 · 10px is the micro-copy role and is the floor of the scale', () => {
  assert.deepEqual(typographyOwnersAt('10px'), ['--rv-fs-micro']);
  const smallest = Math.min(...[...ENUM].map((v) => parseFloat(v)));
  assert.equal(smallest, FLOOR_PX);
});

test('10 · no value below 10px is permitted by the enum', () => {
  for (const value of ENUM) {
    assert.ok(parseFloat(value) >= FLOOR_PX, `${value} is below the ratified floor`);
  }
  const contract = readContract(ROOT);
  for (const value of contract.enums.font_size) {
    assert.ok(parseFloat(value) >= FLOOR_PX, `${value} is below the ratified floor`);
  }
});

/* ============================================================
   3 · the role guard, exercised on synthetic sites

   Every predicate below is applied to the real runtime in §5. Proving it here
   on constructed input is what makes the §5 zero mean something.
   ============================================================ */

/**
 * The role guard. Returns a list of violations for one decodable site.
 *
 * A site is `{ tag, value, token, isControl, isTableHeader, text }` where
 * `value` is the computed px and `token` the owning custom property (or null
 * when the site writes a literal).
 */
function roleViolations(site) {
  const out = [];
  const px = site.value == null ? null : parseFloat(site.value);

  if (px != null && px < FLOOR_PX) out.push('BELOW_FLOOR');
  if (site.value != null && !ENUM.has(site.value)) out.push('OUT_OF_ENUM');

  // A page-level H1 is the one role the tag alone proves (rule A).
  if (site.tag === 'h1' && site.token !== ROLES.PAGE_TITLE[0]) out.push('H1_NOT_PAGE_TITLE');

  // 20px never reaches the runtime as a bare literal: it must declare whether
  // it is a structural heading or an icon glyph.
  if (site.value === '20px' && site.token == null) out.push('BARE_20PX');
  if (site.token === ROLES.SECTION_HEADING[0] && site.isControl) out.push('SECTION_HEADING_ON_CONTROL');

  // 10px likewise: micro-copy is a proven role, not a leftover literal.
  if (site.value === '10px' && site.token == null) out.push('BARE_10PX');
  if (site.token === ROLES.MICRO_COPY[0] && site.isControl) out.push('MICRO_ON_CONTROL');

  // The table-header token is a table-header role, never a size that happens
  // to look right (order §7.7).
  if (site.token === ROLES.TABLE_HEADER[0] && !site.isTableHeader) out.push('THEAD_OUTSIDE_TABLE_HEADER');

  // The icon glyph is a glyph, not copy.
  if (site.token === ICON_GLYPH[0] && site.text != null && /[a-z0-9]/i.test(site.text)
      && site.text.trim().length > 2) out.push('ICON_GLYPH_ON_COPY');

  return out;
}

const site = (over) => ({
  tag: 'div', value: null, token: null, isControl: false,
  isTableHeader: false, text: null, ...over,
});

test('11 · an h1 at 23px or 24px fails the role guard', () => {
  // 23px is out of the enum AND not the page-title role.
  assert.deepEqual(roleViolations(site({ tag: 'h1', value: '23px' })),
    ['OUT_OF_ENUM', 'H1_NOT_PAGE_TITLE']);
  // 24px is now IN the enum as KPI_CARD — and still fails, because the guard
  // enforces ROLE, not enum membership. This is the sharper case: a legal value
  // in the wrong role is exactly what a nearest-number pass would let through.
  assert.deepEqual(roleViolations(site({ tag: 'h1', value: '24px' })),
    ['H1_NOT_PAGE_TITLE']);
  assert.deepEqual(roleViolations(site({ tag: 'h1', value: '30px', token: '--rv-fs-kpi-hero' })),
    ['H1_NOT_PAGE_TITLE']);
  assert.deepEqual(roleViolations(site({ tag: 'h1', value: '22px', token: '--rv-fs-title' })), []);
});

test('12 · an h2 carrying the canonical section-heading token passes', () => {
  assert.deepEqual(roleViolations(site({
    tag: 'h2', value: '20px', token: ROLES.SECTION_HEADING[0], text: 'Progresso produtivo',
  })), []);
});

test('13 · a modal title at the canonical 16px component-heading token passes', () => {
  assert.deepEqual(roleViolations(site({
    tag: 'h2', value: '16px', token: ROLES.COMPONENT_HEADING[0], text: 'Editar usuario',
  })), []);
});

test('14 · an ordinary button label at 20px fails the runtime role guard', () => {
  assert.deepEqual(roleViolations(site({ tag: 'button', value: '20px', isControl: true })),
    ['BARE_20PX']);
  assert.deepEqual(
    roleViolations(site({
      tag: 'button', value: '20px', token: ROLES.SECTION_HEADING[0], isControl: true, text: 'Salvar',
    })),
    ['SECTION_HEADING_ON_CONTROL'],
  );
});

test('15 · an icon-only close glyph at the icon token passes', () => {
  assert.deepEqual(roleViolations(site({
    tag: 'button', value: '20px', token: ICON_GLYPH[0], isControl: true, text: '×',
  })), []);
});

test('16 · 15.5px and 14.5px fail', () => {
  assert.ok(roleViolations(site({ value: '15.5px' })).includes('OUT_OF_ENUM'));
  assert.ok(roleViolations(site({ value: '14.5px' })).includes('OUT_OF_ENUM'));
  assert.ok(!ENUM.has('15.5px'));
  assert.ok(!ENUM.has('14.5px'));
  // 24px and 30px were dead at the pass-6 checkpoint and were RE-ADMITTED by A1
  // as KPI_CARD and KPI_HERO. Everything else stays dead.
  for (const dead of ['9px', '14.5px', '15.5px', '18px', '19px', '21px', '23px']) {
    assert.ok(!ENUM.has(dead), `${dead} must not be in the revised enum`);
  }
  assert.ok(ENUM.has('24px') && ENUM.has('30px'), 'the A1 KPI levels must be admitted');
});

test('17 · arbitrary 10px body copy fails the runtime role guard', () => {
  assert.deepEqual(roleViolations(site({ value: '10px', text: 'Ultimo import' })), ['BARE_10PX']);
  assert.deepEqual(
    roleViolations(site({ value: '10px', token: ROLES.MICRO_COPY[0], isControl: true, text: 'Salvar' })),
    ['MICRO_ON_CONTROL'],
  );
  assert.deepEqual(
    roleViolations(site({ value: '10px', token: ROLES.MICRO_COPY[0], text: 'Auto-sync' })),
    [],
  );
});

test('18 · the table-header token outside a table-header role fails', () => {
  assert.deepEqual(
    roleViolations(site({ value: '10.5px', token: ROLES.TABLE_HEADER[0], text: 'Auto-sync' })),
    ['THEAD_OUTSIDE_TABLE_HEADER'],
  );
  assert.deepEqual(
    roleViolations(site({ tag: 'th', value: '10.5px', token: ROLES.TABLE_HEADER[0], isTableHeader: true })),
    [],
  );
});

test('19 · a value below the floor fails even when it carries a token', () => {
  assert.ok(roleViolations(site({ value: '9px', token: ROLES.MICRO_COPY[0] })).includes('BELOW_FLOOR'));
});

/* ============================================================
   4 · THE FIRST-PARTY RUNTIME — index.html and everything it loads

   This is the product surface, not the detector inventory. No path is
   excluded by name; the set is derived from index.html itself.
   ============================================================ */

const INDEX = read('index.html');

/** Every LOCAL asset index.html references, in load order, without `?v=`. */
const LOADED_ASSETS = [...new Set(
  [...INDEX.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^https?:|^\/\//.test(u))
    .map((u) => u.split('?')[0]),
)];

/** The scan set: what the browser loads, plus both stylesheets and the shell. */
const SCAN_SET = [...new Set([
  ...LOADED_ASSETS,
  ...fs.readdirSync(path.join(ROOT, 'js/screens')).filter((f) => /\.m?js$/.test(f)).map((f) => `js/screens/${f}`),
  'css/tokens.css', 'css/responsive.css', 'index.html',
])].sort();

test('20 · every loaded first-party asset is scanned, and none is missing', () => {
  for (const rel of SCAN_SET) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} is referenced but absent`);
  }
  // Every screen the application ships is really loaded by index.html: a screen
  // that is scanned but not loaded would make this guard measure dead code.
  const screens = fs.readdirSync(path.join(ROOT, 'js/screens'))
    .filter((f) => /\.m?js$/.test(f)).map((f) => `js/screens/${f}`);
  for (const s of screens) assert.ok(LOADED_ASSETS.includes(s), `${s} is never loaded by index.html`);
  assert.ok(SCAN_SET.length >= 100, `scan set collapsed to ${SCAN_SET.length} files`);
  assert.ok(SCAN_SET.includes('js/ui.js'));
  assert.ok(SCAN_SET.includes('js/document-links-surface-ui.js'));
  assert.ok(SCAN_SET.includes('js/badges.js'));
});

/* ---------- the sweep itself ---------- */

const FONT_SIZE_RE = /font-size\s*:\s*([^;'"`)}]+)/g;
const FONT_WEIGHT_RE = /\bfont-weight\s*:\s*([^;'"`)}]+)/g;
const TAILWIND_RE = /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/g;
const RV_FS_TOKEN_RE = /var\(\s*(--rv-(?:fs|font-size|icon-glyph)-[a-z0-9-]+)/g;

function sweepRuntime() {
  const outOfEnumSize = [];
  const outOfEnumWeight = [];
  const tailwindOutOfEnum = [];
  const belowFloor = [];
  const unresolved = [];
  const unknownToken = [];
  let inEnumLiteral = 0;
  let tokenised = 0;

  const tokens = readTokens(ROOT);
  // 'bold' computes to 700 and 'normal' to 400; both are inside the enum. The
  // keyword spelling itself is not a defect (order §8.3).
  const WEIGHTS = new Set(['400', '500', '600', '700', '800', 'normal', 'bold', 'inherit']);

  for (const rel of SCAN_SET) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      const at = `${rel}:${i + 1}`;

      for (const m of line.matchAll(FONT_SIZE_RE)) {
        const value = m[1].trim();
        if (/^var\(/.test(value)) { tokenised += 1; continue; }
        if (ENUM.has(value)) inEnumLiteral += 1;
        else outOfEnumSize.push(`${at} = ${value}`);
        if (/px$/.test(value) && parseFloat(value) < FLOOR_PX) belowFloor.push(`${at} = ${value}`);
      }

      for (const m of line.matchAll(FONT_WEIGHT_RE)) {
        const value = m[1].trim();
        if (/^var\(/.test(value)) continue;
        if (!WEIGHTS.has(value)) outOfEnumWeight.push(`${at} = ${value}`);
      }

      for (const m of line.matchAll(TAILWIND_RE)) {
        const cls = `text-${m[1]}`;
        if (!ENUM.has(TAILWIND_PX[cls])) tailwindOutOfEnum.push(`${at} ${cls} -> ${TAILWIND_PX[cls]}`);
      }

      for (const m of line.matchAll(RV_FS_TOKEN_RE)) {
        const name = m[1];
        if (!tokens.values.has(name)) { unknownToken.push(`${at} ${name}`); continue; }
        const resolved = tokens.values.get(name);
        if (/var\(/.test(resolved)) {
          // an alias: it must itself resolve to a real value
          const inner = /var\(\s*(--[a-z0-9-]+)/.exec(resolved);
          if (!inner || !tokens.values.has(inner[1])) unresolved.push(`${at} ${name}`);
        } else if (!ENUM.has(resolved) && !/^20px$/.test(resolved)) {
          unresolved.push(`${at} ${name} -> ${resolved}`);
        }
      }
    });
  }

  return {
    OUT_OF_ENUM_RUNTIME_FONT_SIZE_COUNT: outOfEnumSize,
    OUT_OF_ENUM_RUNTIME_FONT_WEIGHT_COUNT: outOfEnumWeight,
    TAILWIND_OUT_OF_ENUM_FONT_SIZE_UTILITY_COUNT: tailwindOutOfEnum,
    UNRESOLVED_RUNTIME_TYPOGRAPHY_COUNT: unresolved,
    FONT_SIZE_LITERAL_BELOW_10PX_COUNT: belowFloor,
    UNKNOWN_TYPOGRAPHY_TOKEN_COUNT: unknownToken,
    IN_ENUM_RUNTIME_TYPOGRAPHY_LITERAL_COUNT: inEnumLiteral,
    TOKENISED_RUNTIME_TYPOGRAPHY_COUNT: tokenised,
  };
}

test('21 · every required runtime ownership counter is zero', () => {
  const s = sweepRuntime();
  assert.deepEqual(s.OUT_OF_ENUM_RUNTIME_FONT_SIZE_COUNT, []);
  assert.deepEqual(s.OUT_OF_ENUM_RUNTIME_FONT_WEIGHT_COUNT, []);
  assert.deepEqual(s.TAILWIND_OUT_OF_ENUM_FONT_SIZE_UTILITY_COUNT, []);
  assert.deepEqual(s.UNRESOLVED_RUNTIME_TYPOGRAPHY_COUNT, []);
  assert.deepEqual(s.FONT_SIZE_LITERAL_BELOW_10PX_COUNT, []);
  assert.deepEqual(s.UNKNOWN_TYPOGRAPHY_TOKEN_COUNT, []);
});

test('22 · the informational in-enum literal counter is reported, not forced', () => {
  const s = sweepRuntime();
  // Reported, never asserted to zero: §9 of the order permits an in-enum
  // literal to survive unless this pass already changed it. It only has to
  // stay finite and non-negative, and the tokenised population has to be real.
  assert.ok(Number.isInteger(s.IN_ENUM_RUNTIME_TYPOGRAPHY_LITERAL_COUNT));
  assert.ok(s.IN_ENUM_RUNTIME_TYPOGRAPHY_LITERAL_COUNT >= 0);
  assert.ok(s.TOKENISED_RUNTIME_TYPOGRAPHY_COUNT >= 96,
    'the pass-6 role tokens are missing from the runtime');
});

/* ============================================================
   5 · the role guard applied to the real runtime
   ============================================================ */

/** Every `el('tag', { ... })` / `<tag ...>` site that declares a font-size. */
function runtimeFontSizeSites() {
  const sites = [];
  for (const rel of SCAN_SET) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(FONT_SIZE_RE)) {
        const raw = m[1].trim();
        const token = /var\(\s*(--[a-z0-9-]+)/.exec(raw)?.[1] ?? null;
        // A construction spans several lines: the tag, the attribute object and
        // the text child are rarely on the line that carries the declaration.
        const near = lines.slice(Math.max(0, i - 4), i + 5).join(' ');
        sites.push({ at: `${rel}:${i + 1}`, raw, token, line, near });
      }
    });
  }
  return sites;
}

test('23 · the table-header token appears only in a table-header role', () => {
  const offenders = runtimeFontSizeSites()
    .filter((s) => s.token === ROLES.TABLE_HEADER[0])
    .filter((s) => !/\bth\b|thead|head[A-Z]?|HEAD|columns|column\.|\.label/i.test(s.line));
  assert.deepEqual(offenders.map((s) => s.at), []);
});

test('24 · the icon-glyph token appears only on icon-only text glyphs', () => {
  const sites = runtimeFontSizeSites().filter((s) => s.token === ICON_GLYPH[0]);
  assert.ok(sites.length >= 4, 'the ratified icon-glyph sites disappeared');
  for (const s of sites) {
    // Each is either the modal close "×" or the "In" brand mark, and each
    // carries an aria-label because a glyph is not readable copy.
    assert.match(s.near, /'×'\)|"×"\)|, '×'|'In'\)|aria-label/,
      `${s.at} carries the icon-glyph token but is not an icon-only glyph`);
  }
});

test('25 · the micro-copy token never carries interactive control text', () => {
  const offenders = runtimeFontSizeSites()
    .filter((s) => s.token === ROLES.MICRO_COPY[0])
    .filter((s) => /el\(\s*['"](?:button|input|select|textarea)['"]/.test(s.line));
  assert.deepEqual(offenders.map((s) => s.at), []);
});

test('26 · no bare 20px or 10px literal survives in the runtime', () => {
  const bare = runtimeFontSizeSites().filter((s) => s.raw === '20px' || s.raw === '10px');
  assert.deepEqual(bare.map((s) => `${s.at} = ${s.raw}`), []);
});

test('27 · every page-level h1 in the runtime resolves to the page-title role', () => {
  const offenders = [];
  for (const rel of SCAN_SET) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/el\(\s*['"]h1['"]|<h1[\s>]/.test(line)) return;
      // The declaration may sit on the same line or on the following two.
      const window_ = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join(' ');
      if (!/font-size|class=|class:/.test(window_)) return;
      if (/font-size\s*:\s*var\(\s*--rv-fs-title\s*\)/.test(window_)) return;
      if (/rv-adm-title/.test(window_)) return;  // class hook; its CSS is scanned too
      offenders.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

/* ============================================================
   6 · the sites this order named explicitly
   ============================================================ */

test('28 · js/ui.js no longer owns an out-of-enum Tailwind size', () => {
  const ui = read('js/ui.js');
  for (const m of ui.matchAll(TAILWIND_RE)) {
    assert.ok(ENUM.has(TAILWIND_PX[`text-${m[1]}`]),
      `js/ui.js still carries text-${m[1]}`);
  }
  // The three roles the order names for this shared owner.
  assert.match(ui, /el\('h1', \{ style: 'font-size:var\(--rv-fs-title\);'/);
  assert.match(ui, /el\('h2', \{ style: 'font-size:var\(--rv-fs-component-heading\);'/);
  assert.match(ui, /style: 'font-size:var\(--rv-icon-glyph-lg\);'[\s\S]{0,120}'×'/);
});

test('29 · the two document-links 10px sites are reconciled to micro-copy', () => {
  const src = read('js/document-links-surface-ui.js');
  assert.equal((src.match(/font-size:10px/g) || []).length, 0);
  assert.equal((src.match(/font-size:var\(--rv-fs-micro\)/g) || []).length, 2);
  assert.ok(!/--rv-fs-thead/.test(src), 'a badge was assigned the table-header token by proximity');
});

test('30 · the former 9px sites no longer exist anywhere in the runtime', () => {
  for (const rel of SCAN_SET) {
    assert.ok(!/font-size\s*:\s*9px/.test(read(rel)), `${rel} still declares 9px`);
  }
  // cadastros.js carried the site the order ruled on: the width badge overlaid
  // on the synthetic model swatch, appended by buildPreviewCard() and rendered
  // into the modelos list row. It is micro-copy, not a hidden control.
  const cadastros = read('js/screens/cadastros.js');
  assert.match(cadastros, /background:var\(--rv-brand\); color:var\(--rv-text-on-brand\); font-size:var\(--rv-fs-micro\)/);
});

test('31 · js/badges.js still owns the canonical badge scale', () => {
  const badges = read('js/badges.js');
  assert.equal((badges.match(/font-size:var\(--rv-fs-2xs\)/g) || []).length, 2);
  assert.ok(!/font-size:\s*\d/.test(badges), 'a literal badge size appeared in the canonical owner');
});

/* ============================================================
   7 · no suppression, and earlier passes remain closed
   ============================================================ */

test('32 · no path, line or value suppression exists in this guard', () => {
  const self = read('tests/ui-conformance-phase5-pass6-typography.test.mjs');
  const code = self.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Spelled in halves so this guard does not match its own vocabulary.
  const FORBIDDEN = [['eslint', '-disable'], ['t', '.skip'], ['IGNORE', '_PATHS'],
    ['ALLOW', 'LIST'], ['WAI', 'VER'], ['todo', ': true']];
  for (const [a, b] of FORBIDDEN) {
    assert.ok(!code.includes(a + b), `${a}${b} appears in the guard`);
  }
  // The scan set is derived, never enumerated by hand.
  assert.ok(/matchAll\(\/\(\?:src\|href\)/.test(code) || /LOADED_ASSETS/.test(code));
  // And the detector still owns no waiver mechanism.
  const rules = read('scripts/ui-conformance/rules.mjs');
  for (const word of ['waiver', 'ignoreList', 'suppress', 'allowlist']) {
    assert.ok(!new RegExp(word, 'i').test(rules.replace(/\/\*[\s\S]*?\*\//g, '')),
      `the detector gained a ${word} mechanism`);
  }
});

test('33 · passes 1, 2, 3, 4 and 5 remain closed', () => {
  for (const id of ['UIC-001', 'UIC-002', 'UIC-003', 'UIC-004', 'UIC-008', 'UIC-010']) {
    const r = rule(id);
    assert.equal(r.blocking, 0, `${id} reopened`);
    assert.equal(r.coverage_gaps, 0, `${id} gained a coverage gap`);
  }
  for (const id of ['UIC-007', 'UIC-011']) assert.equal(rule(id).total, 0, `${id} reopened`);
});

test('34 · the deprecated typography aliases stay UIC-009 debt, untouched', () => {
  // Pass 6 does NOT open the general deprecated-token pass. Both aliases must
  // still exist and still resolve; the incidental UIC-009 delta was zero
  // because no UIC-005 site referenced one.
  const tokens = readTokens(ROOT);
  assert.equal(tokens.values.get('--rv-font-size-body'), 'var(--rv-fs-body)');
  assert.equal(tokens.values.get('--rv-font-size-label'), 'var(--rv-fs-label)');
  // SPECIALIZED-CONTROLS-B1 retired the two --rv-color-input-border /
  // --rv-radius-control references the reversal-reason textarea carried, by
  // moving that textarea's border to css/tokens.css. Both aliases still exist
  // and still resolve; the general deprecated-token pass is still not open.
  assert.equal(rule('UIC-009').debt, 320, 'unrelated deprecated-token debt moved');
});

test('35 · every asset pass 6 changed is invalidated under a pass-6 or later token', () => {
  const PASS6 = '20260726-ui-p5-pass6-typography-r1';
  const A1 = '20260726-ui-p5-pass6-typography-a1-kpi';
  /*
   * PASS-6-RUNTIME-INVENTORY-FORWARD-CORRECTION-A2
   *
   * The guarantee this test owns is unchanged: EVERY asset pass 6 touched is
   * still invalidated against the pass-5 checkpoint. What moved is only WHICH
   * later token does the invalidating — phase-5 pass 7 changed six of these
   * files again and retokenised them, and a pass-7 token is strictly later
   * than a pass-6 or A1 one. No asset lost its cache-busting.
   */
  const PASS7 = '20260727-ui-p5-pass7-native-select-a1';
  const PASS7_A4 = '20260727-ui-p5-pass7-native-select-a4-a11y-geometry';
  const PASS7_CHANGED = [
    'js/screens/documentos-recebidos.js',
    'js/screens/pedidos-list.js',
  ];
  // Pass-7 correction A4 bound the visible label of nineteen comboboxes and
  // restored the ratified trigger geometry at three op-nova sites. It touched
  // four assets pass 6 had also changed, so those carry the A4 token.
  // admin-usuarios-modal.js moved on again with ACTION-CONTAINMENT-A1 (its
  // modal bar now comes from the canonical owner), so it carries that token.
  const PASS7_A4_CHANGED = [];
  // A5 removed the duplicate legacy chevron op-nova's wrapSelect() drew over
  // the canonical trigger.
  const PASS7_A5 = '20260727-ui-p5-pass7-native-select-a5-chevron';
  const PASS7_A5_CHANGED = [];
  const A1_CHANGED = [
    'js/screens/painel.js',
  ];
  /*
   * PASS-8-TABLE-CONTRACT-FORWARD-CORRECTION
   *
   * Phase-5 pass 8 closed the §2.5 table contract and changed fourteen of the
   * assets pass 6 had also changed, so those now carry the pass-8 token. A
   * pass-8 token is strictly later than a pass-6, A1 or pass-7 one, so every
   * asset pass 6 touched is still invalidated against the pass-5 checkpoint —
   * only WHICH later token does the invalidating moved. Nothing lost its
   * cache-busting, and the population below still sums to the same 27.
   */
  const PASS8 = '20260727-ui-p5-pass8-table-r1';
  const PASS8_CHANGED = [
    'js/screens/cliente-dashboard.js',
    'js/screens/fornecedor.js',
    'js/screens/manta-expedicao-ui.js', 'js/screens/op-tecelagem-producao-admin.js',
    'js/screens/ordem-compra-render.js', 'js/screens/pedido-detail-render.js',
  ];
  /*
   * PASS-8-A1-RESIDUAL-OVERFLOW-FORWARD-CORRECTION
   *
   * A1 closed the nine residual fixed-pixel overflow gaps and changed five of
   * these assets again, so they carry the strictly later A1 token. The pass-6
   * population is still 27; only which later token invalidates five of them
   * moved.
   */
  const PASS8_A1 = '20260727-ui-p5-pass8-table-a1-overflow';
  const PASS8_A1_CHANGED = [
    'js/screens/cliente-pedido-detail.js',
  ];
  /*
   * ACTION-CONTAINMENT-A1 FORWARD CORRECTION
   *
   * That order declared the shared action owners and the Archetype-A cockpit
   * membership, changing SEVEN assets pass 6 had also changed. A containment
   * token is strictly later than a pass-6, A1, pass-7 or pass-8 one, so every
   * asset pass 6 touched is still invalidated against the pass-5 checkpoint —
   * only WHICH later token does the invalidating moved. The population below
   * still sums to the same 27.
   */
  const CONTAINMENT_A1 = '20260727-ui-action-containment-a1';
  const CONTAINMENT_A1_CHANGED = [
    'js/screens/op-latex-admin.js', 'js/screens/op-nova.js',
  ];
  /*
   * SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION
   *
   * B1 created the five role-specific shared primitives and migrated their 22
   * runtime constructions, changing TEN of the assets pass 6 had also changed
   * — the token stylesheet, the shared owner and eight screens. A B1 token is
   * strictly later than a pass-6, A1, pass-7, pass-8 or containment one, so
   * every asset pass 6 touched is still invalidated against the pass-5
   * checkpoint; only WHICH later token does the invalidating moved. The
   * population below still sums to the same 27.
   */
  const B1 = '20260727-ui-specialized-controls-b1';
  const B1_CHANGED = [
    'css/tokens.css', 'js/ui.js',
    'js/screens/admin-usuarios-modal.js', 'js/screens/cadastros.js',
    'js/screens/cliente-pedido-form.js', 'js/screens/common.js',
    'js/screens/expedicao-admin.js', 'js/screens/pedido-detail-events.js',
    'js/screens/pedido-form.js', 'js/screens/system-screens.js',
  ];
  const PASS6_ONLY = [
    'js/document-links-surface-ui.js',
    'js/screens/cliente-pedido-tracking.js', 'js/screens/cliente-pedidos-list.js',
    'js/screens/pedido-insumos-distribuicao.js',
    'js/screens/trocar-senha-obrigatoria.js',
  ];
  // The pass-6 population is unchanged in SIZE — 27 assets — only redistributed
  // across the tokens. That is what proves nothing silently dropped out.
  assert.equal(PASS7_CHANGED.length + PASS7_A4_CHANGED.length + PASS7_A5_CHANGED.length
    + A1_CHANGED.length + PASS8_CHANGED.length + PASS8_A1_CHANGED.length
    + CONTAINMENT_A1_CHANGED.length + B1_CHANGED.length + PASS6_ONLY.length, 27);
  for (const rel of PASS7_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS7}"`), `${rel} must carry the pass-7 token`);
  }
  for (const rel of PASS7_A4_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS7_A4}"`), `${rel} must carry the pass-7 A4 token`);
  }
  for (const rel of PASS7_A5_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS7_A5}"`), `${rel} must carry the pass-7 A5 token`);
  }
  for (const rel of A1_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${A1}"`), `${rel} must carry the A1 token`);
  }
  for (const rel of PASS8_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS8}"`), `${rel} must carry the pass-8 token`);
  }
  for (const rel of PASS8_A1_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS8_A1}"`), `${rel} must carry the pass-8 A1 token`);
  }
  for (const rel of CONTAINMENT_A1_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${CONTAINMENT_A1}"`),
      `${rel} must carry the action-containment A1 token`);
  }
  for (const rel of B1_CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${B1}"`),
      `${rel} must carry the specialized-controls B1 token`);
  }
  for (const rel of PASS6_ONLY) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS6}"`), `${rel} must keep the pass-6 token`);
  }
  assert.equal((INDEX.match(new RegExp(A1, 'g')) || []).length, A1_CHANGED.length,
    'an asset A1 did not change was retokenised');
  assert.equal((INDEX.match(new RegExp(`${PASS6}(?!-)`, 'g')) || []).length, PASS6_ONLY.length,
    'the pass-6 token leaked or was dropped');
  // Every asset pass 6 touched still carries a token LATER than the pass-5 one.
  for (const rel of [...PASS7_CHANGED, ...PASS7_A4_CHANGED, ...PASS7_A5_CHANGED, ...A1_CHANGED,
    ...PASS8_CHANGED, ...PASS8_A1_CHANGED, ...B1_CHANGED, ...PASS6_ONLY]) {
    assert.ok(!INDEX.includes(`"${rel}?v=20260726-ui-p5-pass5`),
      `${rel} fell back to the pass-5 token`);
  }
  // css/responsive.css changed in neither pass and must keep its own token.
  assert.ok(!INDEX.includes(`css/responsive.css?v=${PASS6}`));
  assert.ok(!INDEX.includes(`css/responsive.css?v=${A1}`));
});
