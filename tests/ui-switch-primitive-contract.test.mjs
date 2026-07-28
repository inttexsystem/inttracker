/* ============================================================
   UI — SWITCH PRIMITIVE CONTRACT (D11 · UI_VISUAL_CONTRACT §2.13)

   The switch was a shared primitive whose geometry NO contract entry owned.
   `SPECIALIZED-CONTROLS-B1` centralised it and faithfully preserved the
   geometry the product already rendered — including a knob at
   `var(--rv-radius-pill)`. Faithful preservation is right for a migration, but
   it promoted historical geometry into a shared owner without ratifying it, and
   the conformance detector never saw it: its application inventory is
   `js/screens/*.js`, and BOTH switch owners (`css/tokens.css`, `js/ui.js`) sit
   outside that directory.

   This guard closes exactly that hole. It is deliberately NOT screen-scoped: it
   reads the shared owners plus every runtime file index.html actually loads.

   What it proves, structurally and without rendering:
     1. the track radius resolves to the ORDINARY radius;
     2. the knob radius resolves to the ORDINARY radius;
     3. no `.rv-switch*` rule anywhere mentions `--rv-radius-pill`;
     4. no switch runtime style uses `999px` or `50%`;
     5. no caller declares track or knob geometry — the owners are sole;
     6. `js/pedido-priority.js` consumes the shared primitive;
     7. the consumer inventory is COMPLETE: consumers are DISCOVERED from the
        loaded runtime, and a new one that is not declared here fails.

   (7) is the point. A hardcoded list would rot the first time someone adds a
   switch; discovery makes an undeclared consumer a test failure rather than an
   unnoticed one.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const TOKENS = 'css/tokens.css';
const CONSTRUCTOR = 'js/ui.js';

/** The two shared owners, and nothing else, may declare switch geometry. */
const GEOMETRY_OWNERS = [TOKENS];
const CONSTRUCTION_OWNER = CONSTRUCTOR;

/** Declared consumers: files that legitimately CALL the primitive. */
const DECLARED_CONSUMERS = [
  'js/pedido-priority.js',
  'js/screens/entrega-form.js',
  'js/screens/manta-output-form.js',
];

/** Circular / capsule geometry, in every spelling the enum can express. */
const CIRCULAR = /var\(--rv-radius-pill\)|(?<!\d)9{2,4}px|50%/;

/** Every local runtime asset index.html actually loads (css and js). */
function loadedRuntimeAssets() {
  const index = read('index.html');
  const out = [];
  const re = /(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^"]*)?"/g;
  let m;
  while ((m = re.exec(index)) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out.filter((rel) => fs.existsSync(path.join(ROOT, rel)));
}

/** The body of a CSS rule, by exact selector. */
function ruleBody(css, selector) {
  const re = new RegExp('^' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const found = re.exec(css);
  assert.ok(found, `${selector} is not declared in ${TOKENS}`);
  return found[1];
}

/* ---------- 1 · the two parts take the ordinary radius ---------- */

test('1 · the switch track radius resolves to the ordinary radius', () => {
  const body = ruleBody(read(TOKENS), '.rv-switch-track');
  const radius = /border-radius:\s*([^;]+);/.exec(body);
  assert.ok(radius, 'the track declares no radius');
  assert.equal(radius[1].trim(), 'var(--rv-radius)');
});

test('2 · the switch knob radius resolves to the ordinary radius', () => {
  const body = ruleBody(read(TOKENS), '.rv-switch-knob');
  const radius = /border-radius:\s*([^;]+);/.exec(body);
  assert.ok(radius, 'the knob declares no radius');
  assert.equal(
    radius[1].trim(),
    'var(--rv-radius)',
    'D11: the knob is an ordinary control part, never a pill and never a circle',
  );
});

test('3 · the knob radius is NOT half of its rendered dimension', () => {
  const css = read(TOKENS);
  // The knob is 18px, so a circle would be 9px — and any literal at all is
  // already a defect, because the value must come from the token.
  const body = ruleBody(css, '.rv-switch-knob');
  const radius = /border-radius:\s*([^;]+);/.exec(body)[1].trim();
  assert.doesNotMatch(radius, /\d/u, 'the knob radius must be a token reference, not a literal');
  const knobSize = /--rv-switch-knob:\s*(\d+)px;/.exec(css);
  assert.ok(knobSize, 'the knob dimension token disappeared');
  const half = Number(knobSize[1]) / 2;
  assert.doesNotMatch(radius, new RegExp(`\\b${half}px\\b`), 'the knob radius equals half its size');
});

/* ---------- 2 · no circular or capsule geometry anywhere in the switch ---------- */

test('4 · no .rv-switch* rule uses pill, 999px or 50% geometry', () => {
  const css = read(TOKENS);

  // Bound the WHOLE switch section rather than matching rule by rule: a
  // per-rule regex silently misses a multi-line selector, and a miss here would
  // read as a pass. The section is delimited by the numbered block comments the
  // stylesheet already uses.
  const start = css.indexOf('/* ---------- 3 · switch');
  const end = css.indexOf('/* ---------- 4 · range');
  assert.ok(start > 0 && end > start, 'the switch stylesheet section moved or was renamed');
  // Comments are stripped first: prose EXPLAINING that `999px` is forbidden is
  // not geometry, and a guard that cannot tell the two apart would forbid
  // documenting its own rule.
  const section = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');

  // The section really is the switch population, not a stale slice.
  for (const sel of ['.rv-switch-track', '.rv-switch-knob', '.rv-switch-field', '.rv-switch-label']) {
    assert.ok(section.includes(sel), `${sel} is not inside the switch section`);
  }
  const rules = (section.match(/\{/g) || []).length;
  assert.ok(rules >= 7, `expected the full .rv-switch rule population, saw ${rules}`);

  assert.doesNotMatch(section, CIRCULAR,
    'circular/capsule geometry survives somewhere in the switch stylesheet section');

  // And nowhere else in the file may a switch selector carry it either.
  const strays = (css.match(/[^\n{}]*\.rv-switch[^\n{}]*\{[^}]*\}/g) || [])
    .filter((rule) => CIRCULAR.test(rule));
  assert.deepEqual(strays, [], `circular geometry on a switch selector:\n${strays.join('\n')}`);
});

test('5 · the switch constructor declares no geometry at all', () => {
  const ui = read(CONSTRUCTION_OWNER);
  const from = ui.indexOf('function switchToggle');
  const to = ui.indexOf('function rangeInput');
  assert.ok(from > 0 && to > from, 'switchToggle() moved or disappeared');
  const body = ui.slice(from, to);
  assert.doesNotMatch(body, /border-radius/, 'the constructor declares a radius in JavaScript');
  assert.doesNotMatch(body, CIRCULAR, 'the constructor declares circular geometry');
  assert.doesNotMatch(body, /width:|height:/, 'the constructor declares a dimension in JavaScript');
});

/* ---------- 3 · sole ownership: no caller declares switch geometry ---------- */

test('6 · no consumer supplies local track or knob geometry', () => {
  for (const rel of DECLARED_CONSUMERS) {
    const text = read(rel);
    assert.match(text, /switchToggle\(/, `${rel}: stopped consuming the shared primitive`);
    // A caller may position the control; it may not restyle its parts.
    assert.doesNotMatch(text, /rv-switch-track/, `${rel}: a caller referenced the track`);
    assert.doesNotMatch(text, /rv-switch-knob/, `${rel}: a caller referenced the knob`);
    assert.doesNotMatch(text, /--rv-switch-/, `${rel}: a caller read a switch geometry token`);
  }
});

test('7 · the priority module consumes the shared primitive and keeps its row layout', () => {
  const text = read('js/pedido-priority.js');
  assert.match(text, /window\.switchToggle\(\{\s*input:\s*box\s*\}\)/,
    'the priority panel stopped building the switch through the shared owner');
  // Label left, control right, one row — UI_VISUAL_CONTRACT §2.1 / §2.13.
  const row = /data-pedido-priority-toggle-row[\s\S]{0,400}/.exec(text);
  assert.ok(row, 'the priority toggle row marker disappeared');
  assert.match(row[0], /justify-content:space-between/,
    'the priority toggle is no longer right-aligned against its label');

  // The caller may position the control; it may not restyle the primitive it
  // received. It sets only a data-* marker on the returned node.
  const mutations = text.match(/\btoggle\.\w+/g) || [];
  assert.deepEqual(
    [...new Set(mutations)],
    ['toggle.setAttribute'],
    `the caller mutated the shared switch node beyond its marker: ${[...new Set(mutations)].join(', ')}`,
  );
});

/* ---------- 4 · the inventory is complete, by discovery ---------- */

test('8 · every discovered switch consumer is declared in this guard', () => {
  const owners = new Set([...GEOMETRY_OWNERS, CONSTRUCTION_OWNER]);
  const declared = new Set(DECLARED_CONSUMERS);
  const discovered = [];

  for (const rel of loadedRuntimeAssets()) {
    if (owners.has(rel)) continue;
    const text = read(rel);
    if (/switchToggle\(|rv-switch/.test(text)) discovered.push(rel);
  }

  const undeclared = discovered.filter((rel) => !declared.has(rel));
  assert.deepEqual(
    undeclared,
    [],
    `a switch consumer is not covered by this guard:\n${undeclared.join('\n')}\n`
      + 'add it to DECLARED_CONSUMERS so its geometry ownership is proved too',
  );

  // And every declared consumer is really loaded — a stale entry is also a defect.
  const loaded = new Set(loadedRuntimeAssets());
  for (const rel of DECLARED_CONSUMERS) {
    assert.ok(loaded.has(rel), `${rel} is declared here but index.html does not load it`);
  }
});

test('9 · the shared owners are loaded by index.html and are the only geometry owners', () => {
  const loaded = new Set(loadedRuntimeAssets());
  assert.ok(loaded.has(TOKENS), 'css/tokens.css is not loaded by index.html');
  assert.ok(loaded.has(CONSTRUCTOR), 'js/ui.js is not loaded by index.html');

  // No OTHER loaded runtime asset may declare a .rv-switch* rule or class.
  for (const rel of loadedRuntimeAssets()) {
    if (rel === TOKENS || rel === CONSTRUCTOR) continue;
    const text = read(rel);
    assert.doesNotMatch(text, /\.rv-switch[\w-]*\s*\{/, `${rel} declares a switch rule`);
    assert.doesNotMatch(text, /class:\s*'rv-switch-(track|knob)'/, `${rel} constructs a switch part`);
  }
});

/* ---------- 5 · D6.1 is not weakened ---------- */

test('10 · true circles keep the pill radius — D6.1 is untouched', () => {
  const css = read(TOKENS);
  assert.match(css, /--rv-radius-pill:\s*999px;/, 'the pill token was removed or changed');
  // The token still has real consumers; D11 moved exactly one element out.
  const users = (css.match(/var\(--rv-radius-pill\)/g) || []).length;
  assert.ok(users > 0, 'D11 must not empty the pill radius of every consumer');
});
