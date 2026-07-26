/* ============================================================
   FOCUSED TESTS — ARCHETYPE-A REFERENCE FIXTURE CONFORMANCE

   Scope: exactly one file,
   docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html.

   This is NOT the phase-4 screen-conformance detector: nothing here
   walks product screens or generalises into repository-wide scanning.

   Token parsing is never reimplemented — the declaration, reference
   and classification helpers come from the same
   scripts/ui-foundation/token-parser.mjs the validator uses. The
   literal-colour matcher is declared locally only because
   scripts/ui-foundation/rules.mjs does not export its HEX_RE and is a
   prohibited path for this phase; the form list is identical and is
   pinned by the negative cases below.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATHS, buildInventory, exists, read } from '../scripts/ui-foundation/inventory.mjs';
import {
  classifyToken,
  parseTokenDeclarations,
  parseTokenReferences,
} from '../scripts/ui-foundation/token-parser.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FIXTURE = read(REPO, PATHS.fixture);
const TOKENS = parseTokenDeclarations(read(REPO, PATHS.tokens));

/** The canonical stylesheet dependency, exactly as the order specifies. */
const TOKENS_LINK = '<link rel="stylesheet" href="../../../../css/tokens.css">';
const SUPPORT_LINK = '<script src="./support.js"></script>';

/* ---------- local, fixture-scoped extractors ---------- */

// Every CSS hex form plus the functional notations, longest-first so
// #rrggbbaa is not truncated to #rrggbb.
const HEX_RE = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})\b/g;
const COLOUR_FN_RE = /\b(?:rgba?|hsla?)\s*\(/g;
const OPEN_TAG_RE = /<([a-zA-Z][-a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

export function literalColours(text) {
  return [...(text.match(HEX_RE) || []), ...(text.match(COLOUR_FN_RE) || [])];
}

/** All values of one CSS property, wherever it is declared. */
export function declaredValues(text, property) {
  const re = new RegExp(`${property}\\s*:\\s*([^;"'}]+)`, 'g');
  return [...text.matchAll(re)].map((m) => m[1].trim());
}

/** Open tags of one element name (or `*`), with their `style` declarations parsed. */
export function elements(text, tagName) {
  const out = [];
  for (const m of text.matchAll(OPEN_TAG_RE)) {
    if (tagName !== '*' && m[1].toLowerCase() !== tagName) continue;
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const style = /(?:^|\s)style\s*=\s*"([^"]*)"/.exec(attrs);
    const decls = new Map();
    for (const d of (style ? style[1] : '').split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    out.push({ tag, attrs, decls });
  }
  return out;
}

/** The single element whose style carries an exact declaration. */
export function elementWith(text, property, value) {
  const hits = elements(text, '*').filter((el) => el.decls.get(property) === value);
  return hits;
}

/** Open tags carrying a bare marker attribute, with parsed declarations. */
export function markedRows(text, marker) {
  return elements(text, 'div').filter((el) =>
    new RegExp(`(?:^|\\s)${marker}(?=[\\s=>]|$)`).test(el.attrs),
  );
}

/* ---------- 1-4 · existence, dependencies and markers ---------- */

test('the versioned Archetype-A fixture exists', () => {
  assert.ok(exists(REPO, PATHS.fixture), `${PATHS.fixture} is not versioned`);
  assert.ok(FIXTURE.includes('<x-dc>'), 'fixture is not a Design Component');
});

test('the canonical token stylesheet is linked exactly once and resolves', () => {
  const hits = FIXTURE.split(TOKENS_LINK).length - 1;
  assert.equal(hits, 1, `expected exactly one ${TOKENS_LINK}, found ${hits}`);
  assert.equal(declaredValues(FIXTURE, 'href').length, 0);
  assert.ok(exists(REPO, PATHS.tokens), 'css/tokens.css must resolve from the fixture');
  const stylesheets = [...FIXTURE.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(
    (m) => m[0],
  );
  const local = stylesheets.filter((l) => !/href="https?:/.test(l));
  assert.deepEqual(local, [TOKENS_LINK], 'exactly one local stylesheet, the token owner');
});

test('the shared support.js is linked exactly once', () => {
  assert.equal(FIXTURE.split(SUPPORT_LINK).length - 1, 1);
  assert.equal((FIXTURE.match(/support\.js/g) || []).length, 1);
});

test('the fixture root carries the archetype marker', () => {
  assert.match(FIXTURE, /<div data-ui-archetype="detail-cockpit"/);
  assert.equal((FIXTURE.match(/data-ui-archetype/g) || []).length, 1);
});

/* ---------- 5-7 · value ownership ---------- */

test('the fixture contains no literal colour in any CSS form', () => {
  assert.deepEqual(literalColours(FIXTURE), []);
});

test('the literal-colour matcher rejects every CSS colour form', () => {
  for (const form of ['#fff', '#ffff', '#ffffff', '#ffffffff', 'rgb(', 'rgba(', 'hsl(', 'hsla(']) {
    assert.equal(literalColours(`a{color:${form}`).length, 1, `${form} was not caught`);
  }
  for (const safe of ['currentColor', 'transparent', 'inherit', 'none', 'href="#"']) {
    assert.deepEqual(literalColours(`a{fill:${safe}}`), [], `${safe} must stay legal`);
  }
});

test('the fixture references no deprecated compatibility token', () => {
  const deprecated = parseTokenReferences(FIXTURE).filter(
    (r) => classifyToken(TOKENS.byName, r.token) === 'deprecated',
  );
  assert.deepEqual(deprecated, []);
  assert.equal((FIXTURE.match(/--rv-(?:status|color)-/g) || []).length, 0);
});

test('every var(--rv-*) in the fixture resolves in css/tokens.css', () => {
  const refs = parseTokenReferences(FIXTURE);
  assert.ok(refs.length > 0, 'the fixture must consume canonical tokens');
  const unknown = refs.filter((r) => classifyToken(TOKENS.byName, r.token) === 'unknown');
  assert.deepEqual(unknown, []);
});

/* ---------- 8-11 · closed enums ---------- */

test('radius use is limited to --rv-radius and --rv-radius-pill', () => {
  const allowed = new Set(['var(--rv-radius)', 'var(--rv-radius-pill)']);
  const used = declaredValues(FIXTURE, 'border-radius');
  assert.ok(used.length > 0);
  assert.deepEqual([...new Set(used)].filter((v) => !allowed.has(v)), []);
});

test('control heights are limited to the three-rung ladder', () => {
  const allowed = new Set([
    'var(--rv-h-compact)',
    'var(--rv-h-default)',
    'var(--rv-h-primary)',
  ]);
  const heights = elements(FIXTURE, 'button')
    .map((el) => el.decls.get('height'))
    .filter(Boolean);
  assert.equal(heights.length, 5, 'every button must declare a height');
  assert.deepEqual(heights.filter((h) => !allowed.has(h)), []);
  assert.equal(new Set(heights).size, 3, 'the ladder must not be flattened');
});

test('shadows are limited to the canonical shadow tokens', () => {
  const allowed = new Set([
    'var(--rv-shadow-none)',
    'var(--rv-shadow-sm)',
    'var(--rv-shadow-popover)',
  ]);
  const used = declaredValues(FIXTURE, 'box-shadow');
  assert.ok(used.length > 0);
  assert.deepEqual([...new Set(used)].filter((v) => !allowed.has(v)), []);
});

test('cards are flat — every card declares --rv-shadow-none', () => {
  const cards = elements(FIXTURE, 'section');
  assert.equal(cards.length, 8, 'the ratified cockpit holds eight cards');
  for (const card of cards) {
    assert.equal(card.decls.get('box-shadow'), 'var(--rv-shadow-none)');
  }
});

/* ---------- 12-14 · structure ---------- */

test('every data-card-actions row is right-aligned or space-between', () => {
  const rows = markedRows(FIXTURE, 'data-card-actions');
  assert.ok(rows.length > 0, 'the fixture must mark its in-card action row');
  for (const row of rows) {
    assert.ok(
      ['flex-end', 'space-between'].includes(row.decls.get('justify-content')),
      `card action row is ${row.decls.get('justify-content')}`,
    );
    assert.equal(row.decls.get('border-top'), '1px solid var(--rv-border-soft)');
    assert.equal(row.decls.get('padding-top'), '11px');
  }
});

test('the marker scan does not match an unmarked row', () => {
  const sample = '<div style="justify-content:flex-start;"></div>';
  assert.deepEqual(markedRows(sample, 'data-card-actions'), []);
  assert.equal(markedRows(`<div data-card-actions ${sample.slice(5)}`, 'data-card-actions').length, 1);
});

test('the fixture uses no native <select>', () => {
  assert.equal((FIXTURE.match(/<select\b/gi) || []).length, 0);
});

test('the fixture declares no --rv-* token of its own', () => {
  assert.equal(parseTokenDeclarations(FIXTURE).byName.size, 0);
});

/* ---------- 15 · runtime boundary ---------- */

test('no fixture or evidence dependency enters application runtime', () => {
  const markers = [PATHS.fixtureDir, 'docs/ui/evidence', 'support.js', 'OP Detail - Compacto'];
  for (const file of ['index.html', 'css/tokens.css', 'css/responsive.css']) {
    if (!exists(REPO, file)) continue;
    const text = read(REPO, file);
    for (const marker of markers) {
      assert.ok(!text.includes(marker), `${file} references fixture infrastructure "${marker}"`);
    }
  }
});

/* ---------- 16-17 · copy and cockpit geometry ---------- */

test('the displayed pt-BR copy is preserved', () => {
  const copy = [
    'Dados da OP', 'Itens da OP', 'Insumos — recebimento de fios',
    'Entregas de tecelagem', 'Histórico', 'Resumo desta OP',
    'Enviar para acabamento', 'Documentos',
    'Transferir p/ acabamento', 'Nenhuma entrega registrada ainda.',
    'Todos os fios desta OP já foram recebidos.',
    'Pausar', 'Finalizar OP', 'Excluir', '+ Nova entrega',
    'Saldo em tecelagem', 'Fornecedor de tecelagem', 'PDF de compra',
  ];
  for (const phrase of copy) {
    assert.ok(FIXTURE.includes(phrase), `missing pt-BR copy: ${phrase}`);
  }
});

test('the cockpit markers for main content and rail survive', () => {
  assert.equal(
    (FIXTURE.match(/grid-template-columns:minmax\(0,1fr\) var\(--rv-rail-w\)/g) || []).length,
    1,
    'the two-column cockpit grid must be declared once, through the rail token',
  );
  assert.match(FIXTURE, /position:sticky;top:0;/, 'the rail must stay sticky');
  for (const token of [
    '--rv-header-h', '--rv-sidebar-w', '--rv-rail-w', '--rv-content-max',
    '--rv-main-pad', '--rv-gap-stack', '--rv-gap-cols',
    '--rv-pad-card', '--rv-pad-card-rail',
  ]) {
    assert.ok(FIXTURE.includes(`var(${token})`), `shell geometry lost its token: ${token}`);
  }
  const labels = [...FIXTURE.matchAll(/text-transform:uppercase;color:var\(--rv-text-tertiary\);">([^<]+)</g)]
    .map((m) => m[1]);
  assert.deepEqual(labels, [
    'Dados da OP', 'Itens da OP', 'Insumos — recebimento de fios',
    'Entregas de tecelagem', 'Histórico',
    'Resumo desta OP', 'Enviar para acabamento', 'Documentos',
  ], 'section order changed');
});

test('every section opens with a canonical icon chip', () => {
  const chips = [
    ...FIXTURE.matchAll(
      /width:20px;height:20px;border-radius:var\(--rv-radius\);background:var\(--rv-chip-bg\);color:var\(--rv-chip-glyph\);[^>]*><svg width="13" height="13"[^>]*>([\s\S]*?)<\/svg>/g,
    ),
  ].map((m) => m[1]);
  assert.equal(chips.length, 8, 'one 20px canonical chip, with a 13px glyph, per section');
  assert.equal(new Set(chips).size, chips.length, 'each section needs a distinct icon');
});

test('the fixture carries no emoji in place of functional iconography', () => {
  assert.equal((FIXTURE.match(/\p{Extended_Pictographic}/gu) || []).length, 0);
});

/* ---------- vendored offline runtime ---------- */

const VENDOR_DIR = 'docs/ui/fixtures/vendor/react-18.3.1';
const REACT_FILE = `${VENDOR_DIR}/react.production.min.js`;
const REACT_DOM_FILE = `${VENDOR_DIR}/react-dom.production.min.js`;
const VENDOR_README = `${VENDOR_DIR}/README.md`;

const REACT_TAG = '<script src="../vendor/react-18.3.1/react.production.min.js"></script>';
const REACT_DOM_TAG = '<script src="../vendor/react-18.3.1/react-dom.production.min.js"></script>';

test('the local React runtime files are versioned', () => {
  assert.ok(exists(REPO, REACT_FILE), `${REACT_FILE} is not versioned`);
  assert.ok(exists(REPO, REACT_DOM_FILE), `${REACT_DOM_FILE} is not versioned`);
  assert.ok(exists(REPO, `${VENDOR_DIR}/LICENSE`), 'vendor LICENSE is not versioned');
});

test('the fixture references each local runtime exactly once', () => {
  assert.equal(FIXTURE.split(REACT_TAG).length - 1, 1);
  assert.equal(FIXTURE.split(REACT_DOM_TAG).length - 1, 1);
  assert.equal((FIXTURE.match(/react\.production\.min\.js/g) || []).length, 1);
  assert.equal((FIXTURE.match(/react-dom\.production\.min\.js/g) || []).length, 1);
});

test('the runtime load order is React then ReactDOM then support.js', () => {
  const react = FIXTURE.indexOf(REACT_TAG);
  const reactDom = FIXTURE.indexOf(REACT_DOM_TAG);
  const support = FIXTURE.indexOf(SUPPORT_LINK);
  assert.ok(react > -1 && reactDom > -1 && support > -1, 'a runtime script tag is missing');
  assert.ok(react < reactDom, 'React must load before ReactDOM');
  assert.ok(reactDom < support, 'both runtimes must load before support.js');
});

test('no external React or ReactDOM script tag exists in the fixture', () => {
  const remote = [...FIXTURE.matchAll(/<script\b[^>]*src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => /^(https?:)?\/\//.test(src));
  assert.deepEqual(remote, [], 'the fixture must load no script from an external origin');
  assert.equal((FIXTURE.match(/unpkg\.com|cdn\.jsdelivr|cdnjs/gi) || []).length, 0);
});

test('the vendor README documents versions, hashes and license', () => {
  const readme = read(REPO, VENDOR_README);
  for (const needle of [
    'react',
    'react-dom',
    '18.3.1',
    'MIT',
    'd949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd',
    '35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d',
  ]) {
    assert.ok(readme.includes(needle), `vendor README does not document: ${needle}`);
  }
});

test('no product runtime path references the fixture vendor directory', () => {
  for (const file of buildInventory(REPO).runtimeFiles) {
    const text = read(REPO, file);
    for (const marker of ['fixtures/vendor', 'react-18.3.1', 'react.production.min.js']) {
      assert.ok(!text.includes(marker), `${file} references fixture runtime "${marker}"`);
    }
  }
});

// The offline guarantee itself is proved by rendering the fixture in a real
// browser with every external origin blocked. This test deliberately does NOT
// assert that result — a static file scan cannot observe a network fetch, and
// encoding a "pass" here would be exactly the kind of claim the gate exists to
// prevent. It asserts only the structural preconditions that make the gate
// winnable, and fails if anyone smuggles a self-declared offline verdict in.
test('offline conformance is not self-declared inside the fixture', () => {
  assert.equal(
    (FIXTURE.match(/SUPPORT_RUNTIME_OFFLINE_PASS|OFFLINE[_ ]PASS|offline[- ]verified/gi) || []).length,
    0,
    'the fixture must not carry a static claim of offline conformance',
  );
  assert.ok(exists(REPO, REACT_FILE) && exists(REPO, REACT_DOM_FILE));
  assert.ok(FIXTURE.indexOf(REACT_DOM_TAG) < FIXTURE.indexOf(SUPPORT_LINK));
});

/* ---------- canonical status pill and count badge ---------- */

test('the status pill uses the canonical §2.6 construction', () => {
  const pills = elementWith(FIXTURE, 'background', 'var(--rv-pill-caution-bg)');
  assert.equal(pills.length, 1, 'exactly one caution status pill');
  const d = pills[0].decls;
  assert.equal(d.get('height'), '18px');
  assert.equal(d.get('padding'), '0 6px');
  assert.equal(d.get('border-radius'), 'var(--rv-radius-pill)');
  assert.equal(d.get('border'), '1px solid var(--rv-pill-caution-border)');
  assert.equal(d.get('color'), 'var(--rv-pill-caution-text)');
  assert.equal(d.get('font-size'), 'var(--rv-fs-2xs)');
  assert.equal(d.get('font-weight'), '600');
  assert.ok(FIXTURE.includes('Em produção'), 'the pill label must survive');
});

test('the status dot is exactly 5x5 and uses the caution-dot token', () => {
  const dots = elementWith(FIXTURE, 'background', 'var(--rv-pill-caution-dot)');
  assert.equal(dots.length, 1);
  const d = dots[0].decls;
  assert.equal(d.get('width'), '5px');
  assert.equal(d.get('height'), '5px');
  assert.equal(d.get('border-radius'), 'var(--rv-radius-pill)');
});

test('the document count badge uses a canonical font-size token', () => {
  const badges = elementWith(FIXTURE, 'background', 'var(--rv-pill-info-bg)');
  assert.equal(badges.length, 1);
  assert.equal(badges[0].decls.get('font-size'), 'var(--rv-fs-thead)');
  assert.equal(badges[0].decls.get('border-radius'), 'var(--rv-radius-pill)');
  assert.equal(badges[0].decls.get('color'), 'var(--rv-pill-info-text)');
  assert.ok(FIXTURE.includes('{{ cat.count }}'), 'the count data must survive');
});

/* ---------- typography enum ---------- */

const FONT_SIZE_ENUM = new Set([
  '22px', '15px', '14px', '13.5px', '13px', '12.5px', '12px', '11.5px', '11px', '10.5px',
]);
const FONT_SIZE_TOKENS = new Set([
  'var(--rv-fs-title)', 'var(--rv-fs-metric)', 'var(--rv-fs-metric-rail)',
  'var(--rv-fs-value)', 'var(--rv-fs-body)', 'var(--rv-fs-sm)', 'var(--rv-fs-xs)',
  'var(--rv-fs-2xs)', 'var(--rv-fs-label)', 'var(--rv-fs-thead)',
]);

test('every fixture font size is in the closed enum or a canonical token', () => {
  const used = declaredValues(FIXTURE, 'font-size');
  assert.ok(used.length > 0);
  const bad = [...new Set(used)].filter(
    (v) => !FONT_SIZE_ENUM.has(v) && !FONT_SIZE_TOKENS.has(v),
  );
  assert.deepEqual(bad, [], `font sizes outside the contract: ${bad.join(', ')}`);
});

test('the out-of-enum 10px font size is absent', () => {
  assert.equal((FIXTURE.match(/font-size\s*:\s*10px/g) || []).length, 0);
});

/* ---------- semantic radius (D6.1) ---------- */

test('every --rv-radius-pill use is a semantic pill or a true circle', () => {
  const users = elements(FIXTURE, '*').filter(
    (el) => el.decls.get('border-radius') === 'var(--rv-radius-pill)',
  );
  assert.ok(users.length > 0, 'the fixture must exercise the pill radius');

  const unclassified = [];
  for (const el of users) {
    const bg = el.decls.get('background') || '';
    const semanticPill = /var\(--rv-(pill|stage)-/.test(bg);
    const w = el.decls.get('width');
    const h = el.decls.get('height');
    const trueCircle = Boolean(w) && w === h;
    if (!semanticPill && !trueCircle) {
      unclassified.push(`${el.tag}: ${[...el.decls].map(([k, v]) => `${k}:${v}`).join(';')}`);
    }
  }
  assert.deepEqual(unclassified, [], 'pill radius on an element that is neither a semantic pill nor a circle');
});

test('no ordinary card, button, control or section chip uses --rv-radius-pill', () => {
  const offenders = elements(FIXTURE, '*')
    .filter((el) => el.decls.get('border-radius') === 'var(--rv-radius-pill)')
    .filter((el) =>
      ['button', 'section', 'input', 'select', 'textarea', 'a'].includes(el.tag) ||
      el.decls.get('background') === 'var(--rv-chip-bg)' ||
      el.decls.get('background') === 'var(--rv-surface)');
  assert.deepEqual(
    offenders.map((el) => el.tag),
    [],
    'pill radius leaked onto a control, card or section chip',
  );
  for (const card of elements(FIXTURE, 'section')) {
    assert.equal(card.decls.get('border-radius'), 'var(--rv-radius)');
  }
});

/* ---------- contextual navigation ---------- */

test('the PDF de compra link stays in the Insumos header without a card-action marker', () => {
  const insumos = FIXTURE.indexOf('Insumos — recebimento de fios');
  const table = FIXTURE.indexOf('<table', insumos);
  const link = FIXTURE.indexOf('PDF de compra');
  assert.ok(insumos > -1 && link > -1, 'the contextual link must survive');
  assert.ok(link > insumos && link < table, 'the link must remain in the section header');
  const header = FIXTURE.slice(insumos, table);
  assert.equal((header.match(/data-card-actions/g) || []).length, 0);
  assert.equal((FIXTURE.match(/data-card-actions/g) || []).length, 1);
});
