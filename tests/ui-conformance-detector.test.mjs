/* ============================================================
   FOCUSED TESTS — PHASE-4 DETERMINISTIC CONFORMANCE DETECTOR

   Scope: scripts/validate-ui-conformance.mjs and
   scripts/ui-conformance/**. Nothing here asserts that a product
   screen conforms; that is what the baseline reports.

   Two properties are load-bearing and are proved rather than
   asserted by inspection:

     1. the closed enums come from UI_VISUAL_CONTRACT.md §5, so
        mutating a temporary contract changes detector behaviour with
        the detector source untouched;
     2. a file the front-end could not fully decode is never reported
        as conforming — coverage degrades to PARTIAL or UNSUPPORTED
        and the report says so.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATHS, read } from '../scripts/ui-foundation/inventory.mjs';
import { APPROVED_DEPRECATED } from '../scripts/ui-foundation/rules.mjs';
import {
  ContractError,
  buildEnums,
  normalizeValue,
  readContract,
  readTokens,
} from '../scripts/ui-conformance/contract.mjs';
import {
  buildConformanceInventory,
  readConformanceRows,
} from '../scripts/ui-conformance/inventory.mjs';
import {
  DETECTOR_VERSION,
  RULE_IDS,
  coverageOf,
  runRules,
  sortFindings,
} from '../scripts/ui-conformance/rules.mjs';
import * as dcHtml from '../scripts/ui-conformance/frontends/dc-html.mjs';
import * as jsScreen from '../scripts/ui-conformance/frontends/js-screen.mjs';
import { scan } from '../scripts/validate-ui-conformance.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO, 'scripts', 'validate-ui-conformance.mjs');
const FIXTURES = 'tests/fixtures/ui-conformance';
const BASELINE = 'tests/fixtures/ui-conformance-baseline.json';

const DETECTOR_SOURCES = [
  'scripts/validate-ui-conformance.mjs',
  'scripts/ui-conformance/contract.mjs',
  'scripts/ui-conformance/inventory.mjs',
  'scripts/ui-conformance/rules.mjs',
  'scripts/ui-conformance/frontends/dc-html.mjs',
  'scripts/ui-conformance/frontends/js-screen.mjs',
];

const CONTRACT = readContract(REPO);
const TOKENS = readTokens(REPO);
const CTX = { tokens: TOKENS, enums: buildEnums(CONTRACT) };

/* ---------- helpers ---------- */

function analyseFixture(name, ctx = CTX) {
  const path = `${FIXTURES}/${name}`;
  const text = read(REPO, path);
  const frontEnd = name.endsWith('.js') ? jsScreen : dcHtml;
  const unit = frontEnd.analyse(path, text);
  const findings = runRules(unit, ctx);
  return { unit, findings, coverage: coverageOf(unit, findings) };
}

function analyseSource(name, text, ctx = CTX) {
  const frontEnd = name.endsWith('.js') ? jsScreen : dcHtml;
  const unit = frontEnd.analyse(name, text);
  const findings = runRules(unit, ctx);
  return { unit, findings, coverage: coverageOf(unit, findings) };
}

function byRule(findings, ruleId) {
  return findings.filter((f) => f.rule_id === ruleId);
}

function blocking(findings) {
  return findings.filter((f) => f.severity === 'blocking');
}

/** A throwaway root carrying only the two files the contract reader reads. */
function withTempContract(transform) {
  const root = mkdtempSync(join(tmpdir(), 'uic-contract-'));
  mkdirSync(join(root, 'docs', 'architecture'), { recursive: true });
  mkdirSync(join(root, 'css'), { recursive: true });
  writeFileSync(join(root, PATHS.tokens), read(REPO, PATHS.tokens), 'utf8');
  writeFileSync(join(root, PATHS.contract), transform(read(REPO, PATHS.contract)), 'utf8');
  return root;
}

function replaceEnumBlock(text, mutate) {
  const match = /```json\r?\n([\s\S]*?)\r?\n```/.exec(text.slice(text.indexOf('## 5.')));
  assert.ok(match, 'the live contract must carry a §5 json block');
  return text.replace(match[1], mutate(match[1]));
}

/* ---------- 1-3 · the contract is the source of values ---------- */

test('the closed enums are read from the canonical §5 JSON block', () => {
  const contract = read(REPO, PATHS.contract);
  const section = contract.slice(contract.indexOf('## 5.'));
  const block = /```json\r?\n([\s\S]*?)\r?\n```/.exec(section);
  assert.ok(block, 'section 5 must carry exactly one json block');
  assert.deepEqual(CONTRACT.enums, JSON.parse(block[1]));
  assert.equal(
    CONTRACT.hash,
    createHash('sha256').update(block[1], 'utf8').digest('hex'),
    'the reported blob hash must be the hash of the block that was parsed',
  );
  assert.equal(CONTRACT.path, PATHS.contract);
  assert.ok(CONTRACT.blockLine > 0, 'the block must be reported with a line');
});

test('no §5 enum value is duplicated in detector source', () => {
  // 11px and the footer divider are §2.1 component values, not §5 enum
  // members; their collision with the font-size enum is coincidental, so the
  // two CARD_ constants are excluded by name rather than by weakening the scan.
  // Only the measured values are checked. `none` is a CSS keyword that happens
  // to be a shadow-enum member, and 400/700 are the numeric equivalents of the
  // `normal`/`bold` keywords; neither is a value the detector could invent.
  const values = [
    ...CONTRACT.enums.radius,
    ...CONTRACT.enums.control_h,
    ...CONTRACT.enums.shadow,
    ...CONTRACT.enums.font_size,
  ].map(String).filter((v) => /\d/.test(v));

  for (const source of DETECTOR_SOURCES) {
    const text = read(REPO, source)
      .split('\n')
      .filter((line) => !/^const CARD_(?:DIVIDER|ACTION_PADDING_TOP)\b/.test(line))
      .join('\n');
    for (const value of values) {
      assert.ok(
        !text.includes(value),
        `${source} hard-codes the contract value "${value}"; enums must be read, not copied`,
      );
    }
  }
});

test('mutating a temporary contract changes behaviour with detector source untouched', () => {
  const before = DETECTOR_SOURCES.map((s) => createHash('sha256').update(read(REPO, s)).digest('hex'));

  const root = withTempContract((text) =>
    replaceEnumBlock(text, (json) => json.replace('"4px", "999px"', '"7px", "999px"')),
  );
  const mutated = readContract(root);
  assert.notEqual(mutated.hash, CONTRACT.hash, 'the mutation must change the blob hash');
  assert.deepEqual(mutated.enums.radius, ['7px', '999px']);

  const ctx = { tokens: readTokens(root), enums: buildEnums(mutated) };
  const clean = analyseFixture('conforming.dc.html');
  const underMutation = analyseFixture('conforming.dc.html', ctx);

  assert.equal(byRule(clean.findings, 'UIC-002').length, 0, 'baseline enum accepts 4px');
  assert.ok(
    byRule(underMutation.findings, 'UIC-002').length > 0,
    'a mutated radius enum must make the same file fail UIC-002',
  );

  const after = DETECTOR_SOURCES.map((s) => createHash('sha256').update(read(REPO, s)).digest('hex'));
  assert.deepEqual(after, before, 'detector source must be byte-identical across the experiment');
});

test('a malformed, incomplete or duplicated §5 block fails closed', () => {
  const broken = withTempContract((text) =>
    replaceEnumBlock(text, (json) => json.replace('{', '{ "oops"')),
  );
  assert.throws(() => readContract(broken), ContractError, 'invalid JSON must fail closed');

  const missing = withTempContract((text) =>
    replaceEnumBlock(text, (json) => json.replace(/^\s*"radius":.*$/m, '')),
  );
  assert.throws(
    () => readContract(missing),
    (err) => err instanceof ContractError && /missing the required key "radius"/.test(err.message),
    'a missing required key must fail closed',
  );

  const duplicated = withTempContract((text) => {
    const section = text.slice(text.indexOf('## 5.'));
    const block = /```json\r?\n[\s\S]*?\r?\n```/.exec(section)[0];
    return text.replace(block, `${block}\n\n${block}`);
  });
  assert.throws(
    () => readContract(duplicated),
    (err) => err instanceof ContractError && /exactly one closed-enum block/.test(err.message),
    'two enum blocks must fail closed rather than pick one',
  );

  const noSection = withTempContract((text) => text.replace(/^## 5\..*$/m, '## Five'));
  assert.throws(() => readContract(noSection), ContractError);
});

/* ---------- 4-5 · literal colour forms ---------- */

test('all four hex forms and all four functional colour forms are detected', () => {
  const forms = ['#fff', '#ffff', '#ffffff', '#ffffffff', 'rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(1,2%,3%)', 'hsla(1,2%,3%,.5)'];
  for (const form of forms) {
    const html = analyseSource('probe.dc.html', `<div style="color:${form};"></div>`);
    assert.equal(byRule(html.findings, 'UIC-001').length, 1, `prototype front-end missed ${form}`);
    const js = analyseSource('probe.js', `el('div', { style: 'color:${form};' });`);
    assert.equal(byRule(js.findings, 'UIC-001').length, 1, `application front-end missed ${form}`);
  }
});

test('contextual colour keywords and a bare fragment stay legal', () => {
  const html = analyseSource(
    'probe.dc.html',
    '<a href="#" style="color:currentColor;fill:transparent;stroke:inherit;background:none;"></a>',
  );
  assert.deepEqual(byRule(html.findings, 'UIC-001'), []);
  const js = analyseSource(
    'probe.js',
    "el('a', { href: '#', style: 'color:currentColor;fill:transparent;stroke:inherit;background:none;' });",
  );
  assert.deepEqual(byRule(js.findings, 'UIC-001'), []);
});

/* ---------- UIC-001 contextual classification ---------- */

/**
 * One value, three outcomes, decided only by the syntax around it. `#8431` is
 * used throughout because it is both a valid `#rgba` shorthand and a plausible
 * order number, so nothing but context can separate the two.
 */
const AMBIGUOUS = '#8431';

test('a proven non-visual site produces no UIC-001 finding', () => {
  const cases = [
    ['placeholder property', 'p.js', `el('input', { placeholder: 'Ex.: Pedido ${AMBIGUOUS}' });`],
    ['title property', 'p.js', `el('b', { title: 'Pedido ${AMBIGUOUS}' });`],
    ['label property', 'p.js', `var m = { label: 'Pedido ${AMBIGUOUS}' };`],
    ['href property', 'p.js', `el('a', { href: '/pedidos/${AMBIGUOUS}' });`],
    ['text child of el()', 'p.js', `el('span', {}, 'Pedido ${AMBIGUOUS}');`],
    ['markup copy in a literal', 'p.js', `var s = '<b class="x">Pedido ${AMBIGUOUS}</b>';`],
    ['line comment', 'p.js', `// legacy ${AMBIGUOUS} was here\nvar a = 1;`],
    ['block comment', 'p.js', `/* legacy ${AMBIGUOUS} */\nvar a = 1;`],
    ['regular-expression literal', 'p.js', `var re = /${AMBIGUOUS}/i;`],
    ['visible HTML copy', 'p.dc.html', `<div>Ex.: Pedido ${AMBIGUOUS}</div>`],
    ['HTML title text', 'p.dc.html', `<svg><title>${AMBIGUOUS}</title></svg>`],
    ['non-visual HTML attribute', 'p.dc.html', `<a href="#${AMBIGUOUS}" title="Pedido ${AMBIGUOUS}">x</a>`],
    ['SVG geometry attribute', 'p.dc.html', `<svg viewBox="0 0 ${AMBIGUOUS} 24"><path d="M${AMBIGUOUS}"/></svg>`],
    ['HTML comment', 'p.dc.html', `<!-- legacy ${AMBIGUOUS} --><div></div>`],
  ];
  for (const [label, name, source] of cases) {
    const found = byRule(analyseSource(name, source).findings, 'UIC-001');
    assert.deepEqual(found, [], `${label} must produce no UIC-001: ${JSON.stringify(found)}`);
  }
});

test('a proven visual site is blocking, for the same value', () => {
  const cases = [
    ['HTML style declaration', 'p.dc.html', `<div style="color:${AMBIGUOUS}"></div>`],
    ['HTML style-hover declaration', 'p.dc.html', `<div style-hover="color:${AMBIGUOUS}"></div>`],
    ['HTML style rule block', 'p.dc.html', `<style>a{color:${AMBIGUOUS};}</style>`],
    ['SVG fill attribute', 'p.dc.html', `<svg><rect fill="${AMBIGUOUS}"/></svg>`],
    ['SVG stroke attribute', 'p.dc.html', `<svg><rect stroke="${AMBIGUOUS}"/></svg>`],
    ['JS style declaration', 'p.js', `el('div', { style: 'color:${AMBIGUOUS};' });`],
    ['JS style assignment', 'p.js', `node.style.borderColor = '${AMBIGUOUS}';`],
    ['JS cssText', 'p.js', `node.style.cssText = 'color:${AMBIGUOUS};';`],
    ['JS colour property', 'p.js', `var m = { color: '${AMBIGUOUS}' };`],
    ['JS -Color suffixed property', 'p.js', `var m = { labelColor: '${AMBIGUOUS}' };`],
    ['JS quoted CSS-property key', 'p.js', `var m = { 'background-color': '${AMBIGUOUS}' };`],
    ['JS setAttribute on a colour attribute', 'p.js', `n.setAttribute('fill', '${AMBIGUOUS}');`],
    ['SVG colour attribute inside a literal', 'p.js', `var s = '<svg stroke="${AMBIGUOUS}"></svg>';`],
    ['style attribute inside a literal', 'p.js', `var s = '<div style="color:${AMBIGUOUS}"></div>';`],
    ['style expression bound to a property', 'p.js', `el('div', { style: cond ? 'color:red' : 'color:${AMBIGUOUS}' });`],
  ];
  for (const [label, name, source] of cases) {
    const found = byRule(analyseSource(name, source).findings, 'UIC-001');
    assert.equal(found.length, 1, `${label} must produce exactly one UIC-001`);
    assert.equal(found[0].severity, 'blocking', `${label} must be blocking`);
    assert.equal(found[0].observed_value, AMBIGUOUS);
  }
});

test('an unprovable site is a coverage gap, never a colour defect', () => {
  const cases = [
    ['bare variable initialiser', `var bg = '${AMBIGUOUS}';`],
    ['ternary in a variable', `var bg = danger ? '${AMBIGUOUS}' : '#fff';`],
    ['unclassified map key', `var m = { bg: '${AMBIGUOUS}' };`],
    ['array element', `var palette = ['${AMBIGUOUS}'];`],
    ['function argument', `paint('${AMBIGUOUS}');`],
  ];
  for (const [label, source] of cases) {
    const found = byRule(analyseSource('p.js', source).findings, 'UIC-001');
    assert.ok(found.length >= 1, `${label} must still be reported`);
    for (const f of found) {
      assert.equal(f.severity, 'coverage', `${label} must not be blocking`);
      assert.match(f.message, /^COVERAGE_GAP \/ VISUAL_COLOUR_CONTEXT_UNPROVEN/);
      assert.match(f.message, /not counted as a colour defect/);
    }
  }
});

test('the functional colour forms follow the same contextual rules', () => {
  for (const form of ['rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(1,2%,3%)', 'hsla(1,2%,3%,.5)']) {
    const visual = byRule(
      analyseSource('p.js', `el('div', { style: 'color:${form};' });`).findings,
      'UIC-001',
    );
    assert.equal(visual.length, 1, `${form} in a declaration must be reported`);
    assert.equal(visual[0].severity, 'blocking', `${form} in a declaration must be blocking`);

    const copy = byRule(
      analyseSource('p.js', `el('i', { placeholder: 'valor ${form}' });`).findings,
      'UIC-001',
    );
    assert.deepEqual(copy, [], `${form} in a placeholder must be silent`);

    const unproven = byRule(analyseSource('p.js', `var v = '${form}';`).findings, 'UIC-001');
    assert.equal(unproven.length, 1);
    assert.equal(unproven[0].severity, 'coverage', `${form} unclassified must be a coverage gap`);

    const html = byRule(
      analyseSource('p.dc.html', `<div style="color:${form}"></div>`).findings,
      'UIC-001',
    );
    assert.equal(html[0].severity, 'blocking');
    assert.deepEqual(
      byRule(analyseSource('p.dc.html', `<div>${form}</div>`).findings, 'UIC-001'),
      [],
      `${form} as HTML copy must be silent`,
    );
  }
});

test('UIC-001 classification is syntactic — no path, line or value suppression exists', () => {
  for (const source of DETECTOR_SOURCES) {
    const text = read(REPO, source);
    assert.ok(!text.includes(AMBIGUOUS.slice(1)), `${source} references the literal 8431`);
    // The inventory glob `js/screens/*.js` is discovery, not suppression. What
    // must not exist is a rule naming an individual screen or line.
    assert.ok(
      !/js\/screens\/[a-z][a-z0-9-]*\.js/.test(text),
      `${source} names an individual screen file`,
    );
    assert.ok(!/\.(?:js|html)\s*:\s*\d+/.test(text), `${source} carries a line-specific rule`);
    // A binding, not the word: the CLI header legitimately states that no
    // waiver mechanism exists, and prose must not fail this check.
    assert.ok(
      !/\b(?:const|let|var|function)\s+\w*(?:waiver|allowlist|whitelist|ignore|suppress|exempt)\w*/i.test(text),
      `${source} declares a suppression structure`,
    );
  }
  // The behavioural proof: one identical value, opposite verdicts, from syntax alone.
  const blocking = byRule(
    analyseSource('p.js', `el('div', { color: '${AMBIGUOUS}' });`).findings,
    'UIC-001',
  );
  const silent = byRule(
    analyseSource('p.js', `el('div', { placeholder: '${AMBIGUOUS}' });`).findings,
    'UIC-001',
  );
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].severity, 'blocking');
  assert.deepEqual(silent, []);
});

test('an escaped-quote attribute is unproven rather than absolved', () => {
  // Built with real escapes rather than shell quoting, so the literal genuinely
  // contains \' inside a single-quoted string.
  const source = "var s = '<svg stroke=\\'" + AMBIGUOUS + "\\'></svg>';";
  const found = byRule(analyseSource('p.js', source).findings, 'UIC-001');
  assert.equal(found.length, 1, 'the value must still be reported');
  assert.equal(found[0].severity, 'coverage', 'an undecodable attribute must not be absolved');
});

/* ---------- archetype block boundary ---------- */

const ARCHETYPE_DOC = [
  '# Conformance',
  '',
  '## Archetype F — Configuration',
  '',
  '| Screen | Generation | State |',
  '|---|---|---|',
  '| `Inside F.dc.html` | G2 | unaudited |',
  '',
].join('\n');

const LATER_SECTION = [
  '## Application surface',
  '',
  '| Screen | State | Coverage |',
  '|---|---|---|',
  '| `painel.js` | deviation | PARTIAL |',
  '',
].join('\n');

test('a screen table under a later level-two heading is not inventoried', () => {
  const rows = readConformanceRows(ARCHETYPE_DOC + LATER_SECTION);
  assert.deepEqual(rows.map((r) => r.name), ['Inside F.dc.html']);
  assert.equal(rows[0].archetype, 'F');
});

test('a screen table inside the archetype section is still inventoried', () => {
  const inside = [
    '# Conformance',
    '',
    '## Archetype F — Configuration',
    '',
    '| Screen | Generation | State |',
    '|---|---|---|',
    '| `Inside F.dc.html` | G2 | unaudited |',
    '',
    '### A subsection that belongs to F',
    '',
    '| Screen | Generation | State |',
    '|---|---|---|',
    '| `Also F.dc.html` | G2 | unaudited |',
    '',
    '## Something else',
    '',
    '| Screen | State | Coverage |',
    '|---|---|---|',
    '| `painel.js` | deviation | PARTIAL |',
    '',
  ].join('\n');
  const rows = readConformanceRows(inside);
  assert.deepEqual(rows.map((r) => r.name), ['Inside F.dc.html', 'Also F.dc.html']);
  assert.ok(rows.every((r) => r.archetype === 'F'));
});

test('inventory is invariant under moving unrelated level-two sections', () => {
  const before = readConformanceRows(
    ['# Conformance', '', LATER_SECTION, ARCHETYPE_DOC].join('\n'),
  );
  const after = readConformanceRows(ARCHETYPE_DOC + LATER_SECTION);
  const shape = (rows) => rows.map((r) => `${r.archetype}:${r.name}:${r.state}`);
  assert.deepEqual(shape(before), shape(after));
  assert.deepEqual(shape(after), ['F:Inside F.dc.html:unaudited']);
});

test('the live conformance document resolves the same inventory whatever the section order', () => {
  const doc = read(REPO, 'docs/architecture/UI_CONFORMANCE.md');
  const baseRows = readConformanceRows(doc);
  const applicationHeading = '## Application surface';
  assert.ok(doc.includes(applicationHeading), 'the application section must exist');

  // Relocate the whole application section to the very end of the document.
  const start = doc.indexOf(applicationHeading);
  const nextHeading = doc.indexOf('\n## ', start + 1);
  const section = doc.slice(start, nextHeading + 1);
  const moved = `${doc.slice(0, start)}${doc.slice(nextHeading + 1)}\n${section}`;
  const movedRows = readConformanceRows(moved);

  const shape = (rows) => rows.map((r) => `${r.archetype}:${r.name}`).sort();
  assert.deepEqual(shape(movedRows), shape(baseRows), 'section order must not change inventory');
  assert.ok(baseRows.length > 0);
  assert.ok(
    baseRows.every((r) => r.name.endsWith('.dc.html')),
    'no application module may be inventoried as a prototype row',
  );
});

test('line attribution survives the new block boundary', () => {
  const rows = readConformanceRows(ARCHETYPE_DOC + LATER_SECTION);
  assert.equal(rows[0].line, 7, 'the row must report its own line');
  const live = readConformanceRows(read(REPO, 'docs/architecture/UI_CONFORMANCE.md'));
  const doc = read(REPO, 'docs/architecture/UI_CONFORMANCE.md').split('\n');
  for (const row of live) {
    assert.ok(doc[row.line - 1].includes(row.name), `line ${row.line} must contain ${row.name}`);
  }
});

/* ---------- 6 · every enum rule, positive and negative ---------- */

test('the conforming prototype fixture produces no finding at all', () => {
  const { findings, coverage } = analyseFixture('conforming.dc.html');
  assert.deepEqual(findings, [], `unexpected findings: ${JSON.stringify(findings, null, 2)}`);
  assert.equal(coverage, 'FULL');
});

test('the conforming application fixture produces no finding at all', () => {
  const { findings, coverage } = analyseFixture('conforming-screen.js');
  assert.deepEqual(findings, [], `unexpected findings: ${JSON.stringify(findings, null, 2)}`);
  assert.equal(coverage, 'FULL');
});

test('every enum rule fires on the violating prototype fixture', () => {
  const { findings } = analyseFixture('violations.dc.html');
  const expected = {
    'UIC-001': 9,
    'UIC-002': 1,
    'UIC-003': 1,
    'UIC-004': 2,
    'UIC-005': 2,
    'UIC-006': 1,
    'UIC-007': 1,
    'UIC-010': 1,
    'UIC-011': 1,
  };
  for (const [rule, count] of Object.entries(expected)) {
    const hits = byRule(findings, rule).filter((f) => f.severity === 'blocking');
    assert.equal(hits.length, count, `${rule}: ${JSON.stringify(byRule(findings, rule), null, 2)}`);
  }
  assert.equal(
    byRule(findings, 'UIC-004').filter((f) => /Cards are flat/.test(f.message)).length,
    1,
    'a shadow on a card must be reported separately from the enum breach',
  );
  assert.equal(byRule(findings, 'UIC-009').length, 1, 'the deprecated reference is debt, not blocking');
});

test('every enum rule fires on the violating application fixture', () => {
  const { findings, coverage } = analyseFixture('violations-screen.js');
  const expected = {
    'UIC-001': 4,
    'UIC-002': 1,
    'UIC-003': 1,
    'UIC-004': 1,
    'UIC-005': 2,
    'UIC-006': 1,
    'UIC-007': 1,
    'UIC-010': 1,
    'UIC-011': 1,
  };
  for (const [rule, count] of Object.entries(expected)) {
    const hits = byRule(findings, rule).filter((f) => f.severity === 'blocking');
    assert.equal(hits.length, count, `${rule}: ${JSON.stringify(byRule(findings, rule), null, 2)}`);
  }
  assert.equal(byRule(findings, 'UIC-009').length, 1);
  // An application screen exposes no static ancestor chain, so "cards are
  // flat" and "in-card action alignment" degrade the file rather than pass.
  assert.equal(coverage, 'PARTIAL');
  assert.ok(byRule(findings, 'UIC-004').some((f) => f.severity === 'coverage'));
  assert.ok(byRule(findings, 'UIC-008').some((f) => f.severity === 'coverage'));
});

/* ---------- 7-8 · token classification ---------- */

test('deprecated-token classification comes from token-parser.mjs', () => {
  const deprecated = byRule(analyseFixture('violations.dc.html').findings, 'UIC-009');
  assert.equal(deprecated.length, 1);
  assert.equal(deprecated[0].observed_value, '--rv-color-accent');
  assert.equal(deprecated[0].severity, 'debt');
  assert.ok(
    APPROVED_DEPRECATED.includes(deprecated[0].observed_value),
    'the detector must report exactly the ratified compatibility names',
  );
  assert.equal(TOKENS.kinds.get('--rv-color-accent').kind, 'deprecated');
  assert.equal(TOKENS.kinds.get('--rv-brand').kind, 'canonical');
  const canonical = analyseSource('probe.js', "el('div', { style: 'color:var(--rv-brand);' });");
  assert.deepEqual(byRule(canonical.findings, 'UIC-009'), []);
});

test('unknown tokens are reported under their own rule, not as deprecated', () => {
  const { findings } = analyseSource('probe.js', "el('div', { style: 'color:var(--rv-nope);' });");
  assert.equal(byRule(findings, 'UIC-011').length, 1);
  assert.equal(byRule(findings, 'UIC-009').length, 0);
  assert.equal(byRule(findings, 'UIC-011')[0].severity, 'blocking');
});

/* ---------- 9-10 · D6.1 semantic radius ---------- */

test('D6.1 permits semantic pills and true circles', () => {
  const pill = analyseSource(
    'probe.dc.html',
    '<span style="height:18px;border-radius:var(--rv-radius-pill);background:var(--rv-pill-positive-bg);"></span>',
  );
  assert.deepEqual(byRule(pill.findings, 'UIC-010'), []);

  const stage = analyseSource(
    'probe.dc.html',
    '<span style="border-radius:var(--rv-radius-pill);background:var(--rv-stage-tecelagem-bg);"></span>',
  );
  assert.deepEqual(byRule(stage.findings, 'UIC-010'), []);

  const circle = analyseSource(
    'probe.dc.html',
    '<span style="width:8px;height:8px;border-radius:var(--rv-radius-pill);background:var(--rv-brand);"></span>',
  );
  assert.deepEqual(byRule(circle.findings, 'UIC-010'), []);
});

test('D6.1 rejects pill radius on an ordinary control, card or box', () => {
  const box = analyseSource(
    'probe.dc.html',
    '<div style="border-radius:var(--rv-radius-pill);background:var(--rv-surface);"></div>',
  );
  assert.equal(byRule(box.findings, 'UIC-010').length, 1);
  assert.equal(byRule(box.findings, 'UIC-010')[0].severity, 'blocking');

  const chip = analyseSource(
    'probe.dc.html',
    '<div style="border-radius:var(--rv-radius-pill);background:var(--rv-chip-bg);"></div>',
  );
  assert.match(byRule(chip.findings, 'UIC-010')[0].message, /section icon chip/);

  const card = analyseSource(
    'probe.dc.html',
    '<section style="border-radius:var(--rv-radius-pill);background:var(--rv-surface);"></section>',
  );
  assert.match(byRule(card.findings, 'UIC-010')[0].message, /a card/);

  const field = analyseSource(
    'probe.dc.html',
    '<input style="border-radius:var(--rv-radius-pill);height:var(--rv-h-compact);">',
  );
  assert.equal(byRule(field.findings, 'UIC-010').length, 1);
});

test('pill radius on a button is always rejected, however it is spelled', () => {
  const spellings = [
    'var(--rv-radius-pill)',
    '999px',
    '24px',
    '20px',
  ];
  for (const radius of spellings) {
    const html = analyseSource('probe.dc.html', `<button style="border-radius:${radius};"></button>`);
    assert.equal(byRule(html.findings, 'UIC-007').length, 1, `prototype accepted ${radius}`);
    const js = analyseSource('probe.js', `el('button', { style: 'border-radius:${radius};' });`);
    assert.equal(byRule(js.findings, 'UIC-007').length, 1, `application accepted ${radius}`);
  }
  // A pill background does not rescue a pill-shaped button.
  const dressed = analyseSource(
    'probe.dc.html',
    '<button style="border-radius:999px;background:var(--rv-pill-positive-bg);"></button>',
  );
  assert.equal(byRule(dressed.findings, 'UIC-007').length, 1);
  assert.equal(byRule(dressed.findings, 'UIC-010').length, 0);
  // The enum still accepts 4px on a button.
  const square = analyseSource('probe.dc.html', '<button style="border-radius:var(--rv-radius);"></button>');
  assert.deepEqual(byRule(square.findings, 'UIC-007'), []);
});

/* ---------- 11 · native select, both front-ends ---------- */

test('native <select> is detected by both front-ends', () => {
  const html = analyseSource('probe.dc.html', '<div><select><option>a</option></select></div>');
  assert.equal(byRule(html.findings, 'UIC-006').length, 1);
  assert.equal(html.findings[0].line, 1);

  const factory = analyseSource('probe.js', "var s = el('select', {});");
  assert.equal(byRule(factory.findings, 'UIC-006').length, 1);

  const created = analyseSource('probe.js', "var s = document.createElement('select');");
  assert.equal(byRule(created.findings, 'UIC-006').length, 1);

  const markup = analyseSource('probe.js', "root.innerHTML = '<select><option>a</option></select>';");
  assert.equal(byRule(markup.findings, 'UIC-006').length, 1);

  const mention = analyseSource('probe.js', '// a comment naming <select> must not be reported\nvar x = 1;');
  assert.deepEqual(byRule(mention.findings, 'UIC-006'), []);
});

/* ---------- 12 · card action alignment ---------- */

test('card-action alignment passes and fails deterministically', () => {
  const good =
    '<section style="background:var(--rv-surface);">' +
    '<div data-card-actions style="justify-content:flex-end;padding-top:11px;border-top:1px solid var(--rv-border-soft);"></div>' +
    '</section>';
  assert.deepEqual(byRule(analyseSource('probe.dc.html', good).findings, 'UIC-008'), []);

  const between = good.replace('flex-end', 'space-between');
  assert.deepEqual(byRule(analyseSource('probe.dc.html', between).findings, 'UIC-008'), []);

  const left = good.replace('flex-end', 'flex-start');
  const leftFindings = byRule(analyseSource('probe.dc.html', left).findings, 'UIC-008');
  assert.equal(leftFindings.length, 1);
  assert.equal(leftFindings[0].severity, 'blocking');
  assert.equal(leftFindings[0].property, 'justify-content');

  const noDivider = good.replace('border-top:1px solid var(--rv-border-soft);', '');
  const dividerFindings = byRule(analyseSource('probe.dc.html', noDivider).findings, 'UIC-008');
  assert.equal(dividerFindings.length, 1);
  assert.equal(dividerFindings[0].property, 'border-top');

  const noPadding = good.replace('padding-top:11px;', '');
  assert.equal(
    byRule(analyseSource('probe.dc.html', noPadding).findings, 'UIC-008')[0].property,
    'padding-top',
  );

  // An unmarked row is a coverage gap, never a pass.
  const unmarked = analyseSource('probe.dc.html', '<section style="background:var(--rv-surface);"></section>');
  const gap = byRule(unmarked.findings, 'UIC-008');
  assert.equal(gap.length, 1);
  assert.equal(gap[0].severity, 'coverage');
  assert.match(gap[0].message, /COVERAGE_GAP \/ ACTION_ROW_UNPROVEN/);
  assert.match(gap[0].message, /not a pass/);
});

/* ---------- 13 · unsupported syntax cannot pass silently ---------- */

test('unsupported JavaScript syntax cannot produce a silent pass', () => {
  const cases = [
    ['unterminated template', 'var a = `color:#fff;'],
    ['unterminated string', "var a = 'color:#fff;\nvar b = 2;"],
    ['unterminated block comment', 'var a = 1; /* never closed'],
  ];
  for (const [label, source] of cases) {
    const { unit, findings, coverage } = analyseSource('probe.js', source);
    assert.equal(coverage, 'UNSUPPORTED', `${label} was not reported as UNSUPPORTED`);
    assert.ok(unit.lexError, `${label} produced no lex error`);
    assert.equal(findings.length, 1, `${label} must report exactly the coverage finding`);
    assert.equal(findings[0].rule_id, 'UIC-000');
    assert.equal(findings[0].severity, 'coverage');
    assert.match(findings[0].message, /UNSUPPORTED/);
    assert.match(findings[0].message, /NOT conforming/);
    assert.ok(findings[0].line >= 1 && findings[0].column >= 1, 'the failure must carry a location');
  }
});

test('a regular-expression literal is not read as a screen value', () => {
  const { findings, coverage } = analyseSource(
    'probe.js',
    'var re = /#ffffff|rgba\\(/i;\nvar ok = 6 / 2;\nvar s = "x";\n',
  );
  assert.equal(coverage, 'FULL');
  assert.deepEqual(findings.filter((f) => f.rule_id !== 'UIC-008'), []);
});

test('an interpolated style value degrades coverage instead of being judged', () => {
  const { unit, findings, coverage } = analyseSource(
    'probe.js',
    'var w = 3;\nvar n = el("div", { style: `border-radius:${w}px;font-size:13px;` });\n',
  );
  assert.equal(coverage, 'PARTIAL');
  assert.equal(unit.indeterminate.length, 1);
  assert.equal(unit.indeterminate[0].reason, 'TEMPLATE_INTERPOLATED_VALUE');
  assert.deepEqual(byRule(findings, 'UIC-002'), [], 'an undecodable radius must not be judged');
  assert.deepEqual(byRule(findings, 'UIC-005'), [], 'the literal font-size beside it stays legal');
  assert.equal(byRule(findings, 'UIC-000').length, 1);
});

/* ---------- 14-15 · attribution and order ---------- */

test('line, column and path attribution survive both front-ends', () => {
  const html = analyseSource(
    'probe.dc.html',
    '<div></div>\n<div></div>\n<button style="height:40px;"></button>\n',
  );
  const height = byRule(html.findings, 'UIC-003');
  assert.equal(height.length, 1);
  assert.equal(height[0].path, 'probe.dc.html');
  assert.equal(height[0].line, 3);
  assert.ok(height[0].column > 1, 'the column must point inside the declaration');
  assert.equal(height[0].front_end, 'dc-html');

  const js = analyseSource(
    'probe.js',
    "var a = 1;\nvar b = 2;\nel('button', {\n  style: 'height:40px;',\n});\n",
  );
  const jsHeight = byRule(js.findings, 'UIC-003');
  assert.equal(jsHeight.length, 1);
  assert.equal(jsHeight[0].path, 'probe.js');
  assert.equal(jsHeight[0].line, 4);
  assert.equal(jsHeight[0].front_end, 'js-screen');
});

test('finding order is stable under input permutation', () => {
  const { findings } = analyseFixture('violations.dc.html');
  const sorted = sortFindings(findings);
  const reversed = sortFindings(findings.slice().reverse());
  const rotated = sortFindings([...findings.slice(3), ...findings.slice(0, 3)]);
  assert.deepEqual(reversed, sorted);
  assert.deepEqual(rotated, sorted);
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1];
    const b = sorted[i];
    assert.ok(
      a.path < b.path ||
        (a.path === b.path && (a.line < b.line || (a.line === b.line &&
          (a.column <= b.column)))),
      `order broken between ${a.rule_id}@${a.line}:${a.column} and ${b.rule_id}@${b.line}:${b.column}`,
    );
  }
});

/* ---------- 16 · deterministic baseline ---------- */

test('repeated baseline generation is byte-identical across processes', () => {
  const run = () =>
    execFileSync(process.execPath, [CLI, '--report', '--format', 'json'], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
  assert.equal(run(), run(), 'two independent detector processes must agree byte for byte');
});

test('the committed baseline matches the detector and contract it was generated from', () => {
  const baseline = JSON.parse(read(REPO, BASELINE));
  assert.equal(baseline.detector_version, DETECTOR_VERSION);
  assert.equal(baseline.contract_path, CONTRACT.path);
  assert.equal(
    baseline.contract_blob_hash,
    CONTRACT.hash,
    'the §5 enums changed; regenerate the baseline in the phase that changed them',
  );
  assert.deepEqual(sortFindings(baseline.findings), baseline.findings, 'the baseline must be stored sorted');
  assert.ok(baseline.findings.length > 0, 'a baseline with no findings would prove nothing');
  for (const key of [
    'detector_version', 'contract_path', 'contract_blob_hash', 'inventory',
    'coverage_summary', 'findings', 'summary_by_rule', 'summary_by_file',
    'summary_by_archetype', 'deprecated_token_summary', 'table_review_summary',
  ]) {
    assert.ok(key in baseline, `the report schema is missing ${key}`);
  }
});

test('the UIC-001 highlight keys name the three-state semantics they report', () => {
  const baseline = JSON.parse(read(REPO, BASELINE));
  const h = baseline.highlights;
  assert.ok(h, 'the report carries no highlights block');

  // Corrected forward in phase 5 pass 1: the previous names described the
  // pre-correction semantics while already carrying the corrected numbers.
  assert.ok('literal_visual_colours_blocking' in h);
  assert.ok('literal_colour_context_unproven' in h);
  assert.ok(!('literal_colours_attributed_to_a_site' in h),
    'the stale highlight key is still present');
  assert.ok(!('literal_colours_needing_site_confirmation' in h),
    'the stale highlight key is still present');

  // The rename kept the predicates, so the keys must still agree with
  // summary_by_rule, which reports the same two numbers unambiguously.
  const uic001 = baseline.summary_by_rule['UIC-001'] || { blocking: 0, coverage_gaps: 0, total: 0 };
  assert.equal(h.literal_visual_colours_blocking, uic001.blocking);
  assert.equal(h.literal_colour_context_unproven, uic001.coverage_gaps);
  assert.equal(h.literal_colours, uic001.total);
});

test('the detector version was raised for the report-schema correction', () => {
  assert.equal(DETECTOR_VERSION, '1.0.2');
});

/* ---------- 17 · the ratified reference fixture ---------- */

test('the phase-3 compact fixture produces zero blocking detector findings', () => {
  const report = scan(REPO);
  const fixture = report.findings.filter((f) => f.path === PATHS.fixture);
  assert.deepEqual(
    blocking(fixture),
    [],
    `the Archetype-A reference must be clean: ${JSON.stringify(blocking(fixture), null, 2)}`,
  );
  assert.equal(report.summary_by_file[PATHS.fixture].coverage, 'FULL');
  assert.equal(report.summary_by_file[PATHS.fixture].archetype, 'A');
  assert.equal(report.summary_by_file[PATHS.fixture].debt, 0);
});

/* ---------- 18 · the detector writes nothing ---------- */

test('no inventoried prototype or application source is modified by a scan', () => {
  const inventory = buildConformanceInventory(REPO);
  const watched = [
    ...inventory.prototypes.map((p) => p.path),
    ...inventory.applications.map((a) => a.path),
    PATHS.tokens,
    PATHS.contract,
    PATHS.decisions,
  ];
  const digest = () =>
    watched.map((p) => `${p} ${createHash('sha256').update(read(REPO, p)).digest('hex')}`);
  const before = digest();
  scan(REPO);
  execFileSync(process.execPath, [CLI, '--report', '--format', 'text'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  assert.deepEqual(digest(), before, 'the detector must be strictly read-only');
});

/* ---------- inventory honesty ---------- */

test('a conformance row that resolves to no file is reported, never dropped', () => {
  const inventory = buildConformanceInventory(REPO);
  assert.ok(inventory.prototypes.length > 0, 'at least the reference fixture must resolve');
  assert.ok(
    inventory.prototypes.some((p) => p.path === PATHS.fixture && p.archetype === 'A'),
    'the Archetype-A reference must resolve from its conformance row',
  );
  assert.ok(
    inventory.unresolved.length > 0,
    'the conformance document lists screens that are not in this repository; that must surface',
  );
  for (const row of inventory.unresolved) {
    assert.ok(row.reason, 'every unresolved row must carry a reason');
    assert.ok(row.archetype, 'every unresolved row must carry its archetype');
  }
  for (const app of inventory.applications) {
    assert.match(app.path, /^js\/screens\/[^/]+\.js$/);
  }
  assert.ok(
    inventory.applications.every((a) => !a.path.endsWith('support.js')),
    'fixture infrastructure must never enter the application inventory',
  );
});

test('generated export derivatives and evidence pages are excluded', () => {
  const report = scan(REPO);
  const scanned = Object.keys(report.summary_by_file);
  for (const path of scanned) {
    assert.ok(!/-standalone\.html$|-bundle-ready\.html$|-print-/.test(path), path);
    assert.ok(!path.startsWith('docs/ui/evidence/'), path);
    assert.ok(!path.startsWith('docs/ui/fixtures/vendor/'), path);
    assert.ok(!path.startsWith('tests/'), path);
  }
});

/* ---------- CLI contract ---------- */

test('the CLI honours --report, --enforce, --rule and --format', () => {
  const runCli = (args) => {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: REPO,
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
      });
      return { status: 0, stdout };
    } catch (err) {
      return { status: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  };

  const report = runCli(['--report', '--format', 'text']);
  assert.equal(report.status, 0, '--report exits 0 even with findings');
  assert.match(report.stdout, /UI CONFORMANCE DETECTOR/);
  assert.match(report.stdout, /RESULT {2}blocking=\d+/);

  const json = runCli(['--report', '--format', 'json']);
  assert.equal(json.status, 0);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.contract_blob_hash, CONTRACT.hash);

  const enforce = runCli(['--enforce', '--format', 'text']);
  assert.equal(
    enforce.status,
    parsed.findings.some((f) => f.severity === 'blocking') ? 1 : 0,
    '--enforce must exit 1 exactly when a blocking finding exists',
  );

  const clean = RULE_IDS.find(
    (id) => !parsed.findings.some((f) => f.rule_id === id && f.severity === 'blocking'),
  );
  if (clean) {
    const scoped = runCli(['--enforce', '--rule', clean, '--format', 'json']);
    assert.equal(scoped.status, 0, `--rule ${clean} must not fail on other rules' findings`);
    assert.equal(
      JSON.parse(scoped.stdout).findings.length,
      parsed.findings.length,
      '--rule limits enforcement, never the JSON report',
    );
  }

  const bad = runCli(['--rule', 'UIC-999']);
  assert.equal(bad.status, 2, 'an unknown rule ID is a detector configuration failure');
  const unknownFlag = runCli(['--nope']);
  assert.equal(unknownFlag.status, 2);
});

test('a broken contract makes the CLI exit 2 rather than report a pass', () => {
  const root = withTempContract((text) =>
    replaceEnumBlock(text, (json) => json.replace('"radius"', '"radiusss"')),
  );
  mkdirSync(join(root, 'docs', 'ui', 'fixtures'), { recursive: true });
  writeFileSync(join(root, 'docs', 'architecture', 'UI_CONFORMANCE.md'), '# empty\n', 'utf8');
  try {
    execFileSync(process.execPath, [CLI, '--report', '--root', root], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.fail('the CLI must not succeed against a broken contract');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(err.stderr, /missing the required key "radius"/);
  }
});

/* ---------- table boundary ---------- */

test('table alignment is proven, failed or referred to manual review — never faked', () => {
  const proven = analyseSource(
    'probe.dc.html',
    '<table style="table-layout:fixed;"><colgroup><col><col></colgroup><tr><th>A</th><th>B</th></tr></table>',
  );
  assert.equal(proven.unit.tables.length, 1);
  assert.equal(proven.unit.tables[0].verdict, 'AUTOMATICALLY_PROVEN');

  const failed = analyseSource(
    'probe.dc.html',
    '<table style="table-layout:fixed;"><colgroup><col><col><col></colgroup><tr><th>A</th><th>B</th></tr></table>',
  );
  assert.equal(failed.unit.tables[0].verdict, 'AUTOMATICALLY_FAILED');

  const manual = analyseSource('probe.dc.html', '<table><tr><th>A</th><th>B</th></tr></table>');
  assert.equal(manual.unit.tables[0].verdict, 'MANUAL_REVIEW_REQUIRED');

  const js = analyseSource('probe.js', "var t = el('table', {});");
  assert.equal(js.unit.tables[0].verdict, 'MANUAL_REVIEW_REQUIRED');

  const report = scan(REPO);
  assert.equal(
    report.table_review_summary.total,
    report.table_review_summary.AUTOMATICALLY_PROVEN +
      report.table_review_summary.AUTOMATICALLY_FAILED +
      report.table_review_summary.MANUAL_REVIEW_REQUIRED,
    'every inventoried table must carry exactly one verdict',
  );
});

/* ---------- value normalization ---------- */

test('enum comparison is spelling-insensitive but not value-insensitive', () => {
  assert.equal(normalizeValue('0 1px 3px rgba(0,0,0,.10)'), normalizeValue('0 1px 3px rgba(0, 0, 0, 0.10)'));
  assert.equal(normalizeValue('4.0px'), normalizeValue('4px'));
  assert.notEqual(normalizeValue('4px'), normalizeValue('6px'));
  const shadow = analyseSource(
    'probe.dc.html',
    '<div style="box-shadow:0 1px 3px rgba(0, 0, 0, 0.1);"></div>',
  );
  assert.deepEqual(byRule(shadow.findings, 'UIC-004'), [], 'the same shadow spelled differently is the same shadow');
  const other = analyseSource('probe.dc.html', '<div style="box-shadow:0 1px 4px rgba(0,0,0,.1);"></div>');
  assert.equal(byRule(other.findings, 'UIC-004').length, 1);
});
