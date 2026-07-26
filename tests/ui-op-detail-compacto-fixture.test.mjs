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

import { PATHS, exists, read } from '../scripts/ui-foundation/inventory.mjs';
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

/** Open tags of one element name, with their `style` declarations parsed. */
export function elements(text, tagName) {
  const out = [];
  for (const m of text.matchAll(OPEN_TAG_RE)) {
    if (m[1].toLowerCase() !== tagName) continue;
    const attrs = m[2] || '';
    const style = /(?:^|\s)style\s*=\s*"([^"]*)"/.exec(attrs);
    const decls = new Map();
    for (const d of (style ? style[1] : '').split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    out.push({ attrs, decls });
  }
  return out;
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
