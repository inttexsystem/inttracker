/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 3 (UIC-003)
   + SPECIALIZED-CONTROLS-B1 population guard

   Proves the GENERIC control-height property closed: every control the
   ratified ladder governs resolves through --rv-h-compact / --rv-h-default /
   --rv-h-primary, and `UIC-003` reports zero blocking and zero coverage.

   Pass 3 did NOT ratify checkbox, radio, range, switch-track or multiline
   textarea geometry. It EXCLUDED those primitives from the generic ladder and
   froze 21 sites under UI-SPECIALIZED-CONTROL-CONTRACT-GAP, pinned here by the
   inline style text each site happened to carry.

   SPECIALIZED-CONTROLS-B1 CLOSES THAT GAP AND REPLACES THAT GUARD. Five
   role-specific shared primitives now exist — textarea, checkbox, switch,
   range and visually-hidden — js/ui.js is their single constructor and
   css/tokens.css is their single geometry owner. A guard anchored on
   screen-local inline style text is therefore not merely stale, it asserts the
   opposite of the contract: the styles it demanded are exactly what B1
   removed.

   Section 2 below is the replacement. It is CONSTRUCTION-SCOPED rather than
   file-scoped: it pins the exact runtime population — 5 checkboxes, 1 range,
   11 textareas, 2 switch components and 1 visually hidden compatibility
   control, 22 constructions in all — proves each one resolves through the
   correct primitive, and fails both when a construction disappears AND when a
   new one appears, including inside a file the population already knows.

   The old documentary population said "21 sites". That number counted a switch
   as its two presentation spans in one file and undercounted the textareas; it
   is superseded here, not contradicted — every one of the 21 frozen sites is
   still present, and B1 simply counts the runtime rather than the prose.

   Two front-end transport amendments made the pass-3 exclusion decidable at
   all, and section 5 pins both to their exact authorized envelope.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DETECTOR_VERSION } from '../scripts/ui-conformance/rules.mjs';
import * as jsScreen from '../scripts/ui-conformance/frontends/js-screen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

/** The ratified generic ladder, read from the contract rather than copied. */
const LADDER_TOKENS = ['var(--rv-h-compact)', 'var(--rv-h-default)', 'var(--rv-h-primary)'];

/** The same three rungs as the contract spells them, for the spelling-agnostic
    out-of-ladder counter. Read from the contract, never invented here. */
const LADDER_LITERALS = JSON.parse(
  /"control_h":\s*(\[[^\]]*\])/.exec(read('docs/architecture/UI_VISUAL_CONTRACT.md'))[1],
);

/** The canonical table-row action primitive is a role-specific 30x30 square,
    deliberately NOT a fourth rung of the generic ladder. */
const ROW_ACTION_EDGE = '30px';

/* ---------- the first-party runtime, as the browser really loads it ---------- */

const INDEX = read('index.html');
const LOCAL_SCRIPTS = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:|^\/\//.test(src))
  .map((src) => src.split('?')[0]);

const RUNTIME = LOCAL_SCRIPTS.map((rel) => ({ rel, text: read(rel) }));
const SCREENS = RUNTIME.filter((f) => f.rel.startsWith('js/screens/'));

/* ============================================================
   1 · the pass closed the rule it owns
   ============================================================ */

test('1 · the detector version was raised for the pass-3 semantic correction', () => {
  assert.equal(DETECTOR_VERSION, '1.0.6');
  assert.equal(BASELINE.detector_version, '1.0.6');
});

test('2 · UIC-003 reports zero blocking and zero coverage', () => {
  const uic003 = rule('UIC-003');
  assert.equal(uic003.blocking, 0, 'a generic control height outside the ladder survived');
  assert.equal(uic003.coverage_gaps, 0, 'a control-height role stayed unproven');
  assert.equal(uic003.total, 0);
  assert.equal(BASELINE.findings.filter((f) => f.rule_id === 'UIC-003').length, 0);
});

test('3 · the inventory the pass was measured over is unchanged', () => {
  assert.equal(BASELINE.inventory.application.count, 66);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
});

/* ============================================================
   2 · SPECIALIZED-CONTROLS-B1 — the construction-scoped population

   UI-SPECIALIZED-CONTROL-CONTRACT-GAP is closed by five role-specific shared
   primitives. This section is the guard over that closure and it is pinned by
   CONSTRUCTION, never by file and never by inline style text:

     · a construction that DISAPPEARS fails;
     · a construction that appears in a NEW file fails;
     · a construction that appears in an ALREADY-KNOWN file fails, because the
       per-file counts are exact, not lower bounds;
     · a construction that stops resolving through its primitive fails;
     · a screen that reacquires local geometry for one of these roles fails.
   ============================================================ */

/** Line comments discuss these primitives by name. Counting raw textual hits
    is exactly the error the A1 call-site rederivation corrected, so every
    count below runs over code with comments removed. */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CODE = RUNTIME.map(({ rel, text }) => ({ rel, code: stripComments(text) }));
const codeOf = (rel) => CODE.find((f) => f.rel === rel).code;

/** js/ui.js is the OWNER of all five primitives, not a consumer of any. */
const OWNER = 'js/ui.js';
const CONSUMERS = CODE.filter((f) => f.rel !== OWNER);

const countCalls = (code, name) =>
  (code.match(new RegExp(`window\\.${name}\\(`, 'g')) || []).length;

/* ---------- the declared population ---------- */

const CHECKBOX_CONSTRUCTIONS = [
  {
    id: 'login-remember',
    path: 'js/screens/system-screens.js',
    collapsed: false,
    name: 'Lembrar-me neste dispositivo',
    behaviour: 'login "remember me"; the login form reads .checked',
  },
  {
    id: 'entrega-defeito',
    path: 'js/screens/entrega-form.js',
    collapsed: true,
    name: 'Defeito',
    behaviour: 'state owner read by getPayload; drives the transfer switch',
  },
  {
    id: 'manta-defeito',
    path: 'js/screens/manta-output-form.js',
    collapsed: true,
    name: 'Defeito',
    behaviour: 'state owner read by getPayload; drives the Manta switch',
  },
  {
    id: 'parciais-visivel',
    path: 'js/screens/pedido-parciais-admin.js',
    collapsed: false,
    name: 'Visivel para o cliente',
    behaviour: 'partial-shipment visibility; .checked read on submit',
  },
  {
    id: 'admin-usuarios-mostrar-inativos',
    path: 'js/screens/admin-usuarios.js',
    collapsed: false,
    name: 'Mostrar inativos',
    behaviour: 'onchange toggles the inactive-rows filter',
  },
];

const RANGE_CONSTRUCTIONS = [
  {
    id: 'op-distribuicao-metros',
    path: 'js/screens/op-distribuicao-ui.js',
    behaviour: 'input listener writing metrosOverride; live gradient progress',
  },
];

/** Every textarea, with the bounded ROLE that carries its minimum height.
    `rows` declares no minimum on purpose: the rows attribute is the geometry
    there. Collapsing these onto one height is precisely what B1 forbids. */
const TEXTAREA_CONSTRUCTIONS = [
  { id: 'admin-usuarios-observacoes', path: 'js/screens/admin-usuarios-modal.js', role: 'large' },
  { id: 'cadastros-observacoes', path: 'js/screens/cadastros.js', role: 'large' },
  { id: 'cliente-pedido-item-observacao', path: 'js/screens/cliente-pedido-form.js', role: 'medium' },
  { id: 'cliente-pedido-instrucoes', path: 'js/screens/cliente-pedido-form.js', role: 'rows' },
  { id: 'expedicao-observacao', path: 'js/screens/expedicao-admin.js', role: 'standard' },
  { id: 'receipt-estorno-motivo', path: 'js/screens/ordem-compra-receipt-events.js', role: 'rows' },
  { id: 'pedido-tracking-mensagem-inline', path: 'js/screens/pedido-detail-events.js', role: 'message' },
  { id: 'pedido-edit-observacao', path: 'js/screens/pedido-edit.js', role: 'rows' },
  { id: 'pedido-form-instrucoes', path: 'js/screens/pedido-form.js', role: 'autosize' },
  { id: 'parciais-mensagem', path: 'js/screens/pedido-parciais-admin.js', role: 'notice' },
  { id: 'tracking-mensagem', path: 'js/screens/pedido-tracking-admin.js', role: 'tracking' },
];

/** A switch is ONE component. Before B1 each was two anonymous presentation
    spans — a track and a knob — with independent geometry in the screen. */
const SWITCH_COMPONENTS = [
  { id: 'entrega-defeito-switch', path: 'js/screens/entrega-form.js', tone: 'brand', label: 'Defeito' },
  { id: 'manta-defeito-switch', path: 'js/screens/manta-output-form.js', tone: 'caution', label: 'Defeito' },
];

const VISUALLY_HIDDEN_CONSTRUCTIONS = [
  {
    id: 'shell-compat-logout',
    path: 'js/screens/common.js',
    behaviour: 'window.logout; kept for the screens-common smoke contract',
  },
];

/** The five roles and the primitive that owns each. */
const PRIMITIVES = [
  { role: 'textarea', fn: 'textArea', population: TEXTAREA_CONSTRUCTIONS, expected: 11 },
  { role: 'checkbox', fn: 'checkboxInput', population: CHECKBOX_CONSTRUCTIONS, expected: 5 },
  { role: 'switch', fn: 'switchToggle', population: SWITCH_COMPONENTS, expected: 2 },
  { role: 'range', fn: 'rangeInput', population: RANGE_CONSTRUCTIONS, expected: 1 },
  { role: 'visually-hidden', fn: 'visuallyHidden', population: VISUALLY_HIDDEN_CONSTRUCTIONS, expected: 1 },
];

const TOKENS = read('css/tokens.css');
const UI = read('js/ui.js');

test('4 · the runtime population is exactly the declared 22 constructions', () => {
  // The five pinned counts, stated as literals so a silent drift in the
  // declaration arrays cannot move them.
  assert.equal(CHECKBOX_CONSTRUCTIONS.length, 5, 'checkbox constructions');
  assert.equal(RANGE_CONSTRUCTIONS.length, 1, 'range constructions');
  assert.equal(TEXTAREA_CONSTRUCTIONS.length, 11, 'textarea constructions');
  assert.equal(SWITCH_COMPONENTS.length, 2, 'switch components');
  assert.equal(VISUALLY_HIDDEN_CONSTRUCTIONS.length, 1, 'visually hidden compatibility controls');

  // 22 runtime constructions: a switch component contributes its track AND its
  // knob, which is the pair the old 21-entry inventory counted separately.
  const constructions =
    CHECKBOX_CONSTRUCTIONS.length
    + RANGE_CONSTRUCTIONS.length
    + TEXTAREA_CONSTRUCTIONS.length
    + SWITCH_COMPONENTS.length * 2
    + VISUALLY_HIDDEN_CONSTRUCTIONS.length;
  assert.equal(constructions, 22);
});

test('5 · every construction resolves through the correct shared primitive', () => {
  for (const { role, fn, population, expected } of PRIMITIVES) {
    // Per-FILE exactness is what stops a new construction hiding in a file the
    // population already knows: a sixth checkbox in admin-usuarios.js would
    // move that file's count from 1 to 2 and fail here.
    const wanted = new Map();
    for (const site of population) wanted.set(site.path, (wanted.get(site.path) || 0) + 1);

    const seen = new Map();
    for (const { rel, code } of CONSUMERS) {
      const n = countCalls(code, fn);
      if (n > 0) seen.set(rel, n);
    }
    assert.deepEqual(
      [...seen].sort(),
      [...wanted].sort(),
      `${role}: the ${fn}() call-site map moved. HARD STOP — SPECIALIZED-CONTROL POPULATION CHANGED.`,
    );

    const total = [...seen.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, expected, `${role}: expected ${expected} construction(s), found ${total}`);

    // The owner defines it exactly once and no consumer redefines it.
    assert.equal(
      (UI.match(new RegExp(`^function ${fn}\\(`, 'gm')) || []).length,
      1,
      `${fn} is not defined exactly once in js/ui.js`,
    );
    for (const { rel, code } of CONSUMERS) {
      assert.ok(
        !new RegExp(`function ${fn}\\(`).test(code),
        `${rel} redefines the shared primitive ${fn}`,
      );
    }
  }
});

test('6 · no screen-local checkbox, switch, range or textarea geometry remains', () => {
  const offenders = [];
  for (const { rel, code } of CONSUMERS) {
    // The raw constructions the primitives replaced.
    if (/el\(\s*['"]textarea['"]/.test(code)) offenders.push(`${rel}: builds a raw textarea`);
    if (/type:\s*'(checkbox|radio|range)'/.test(code)) offenders.push(`${rel}: builds a raw ${/type:\s*'(checkbox|radio|range)'/.exec(code)[1]}`);
    // The switch track and knob geometry, in any spelling.
    if (/width:40px;\s*height:22px/.test(code)) offenders.push(`${rel}: declares switch track geometry`);
    if (/width:18px;\s*height:18px/.test(code)) offenders.push(`${rel}: declares switch knob geometry`);
    // Checkbox and range paint owned by the stylesheet.
    if (/accent-color/.test(code)) offenders.push(`${rel}: declares checkbox accent paint`);
    // Only the SLIDER pseudo-elements. A bare `-webkit-appearance:none` is
    // also how a native select suppresses its chrome, which is a different
    // role and not what this counter governs.
    if (/::-webkit-slider|::-moz-range/.test(code)) offenders.push(`${rel}: declares range track/thumb geometry`);
    // A multiline minimum height, inline or as a Tailwind utility.
    for (const m of code.matchAll(/min-h-\[[^\]]*\]/g)) offenders.push(`${rel}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [], `screen-local specialized geometry survived:\n${offenders.join('\n')}`);

  // Every role minimum, the checkbox size and the switch/range geometry are
  // declared once, in the single owner.
  for (const decl of [
    /--rv-textarea-min-autosize:\s*40px;/, /--rv-textarea-min-compact:\s*44px;/,
    /--rv-textarea-min-standard:\s*56px;/, /--rv-textarea-min-medium:\s*80px;/,
    /--rv-textarea-min-message:\s*92px;/, /--rv-textarea-min-notice:\s*96px;/,
    /--rv-textarea-min-large:\s*104px;/, /--rv-textarea-min-tracking:\s*110px;/,
    /--rv-checkbox-size:\s*16px;/,
    /--rv-switch-track-w:\s*40px;/, /--rv-switch-track-h:\s*22px;/,
    // The travel moved 18px -> 16px when the knob inset went to 2px on the
    // horizontal: the knob now stops 2px from each end instead of 1px. The
    // 40x22 track and the 18px knob are unchanged, and what this line guards
    // is unchanged too — the value is declared ONCE, in the single owner.
    /--rv-switch-knob:\s*18px;/, /--rv-switch-knob-travel:\s*16px;/,
    /--rv-range-track-h:\s*4px;/, /--rv-range-thumb:\s*16px;/,
  ]) {
    assert.match(TOKENS, decl, 'a specialized-control value left css/tokens.css');
  }
});

test('7 · each textarea keeps the role that carries its own minimum height', () => {
  // The eight distinct minima are real use cases. Collapsing them onto one
  // value would be a visual regression the population guard must catch.
  for (const site of TEXTAREA_CONSTRUCTIONS) {
    const code = codeOf(site.path);
    assert.ok(
      new RegExp(`role:\\s*'${site.role}'`).test(code)
        || new RegExp(`options\\.role\\s*\\|\\|\\s*'${site.role}'`).test(code),
      `${site.id}: the '${site.role}' role is not declared in ${site.path}`,
    );
  }
  const roles = new Set(TEXTAREA_CONSTRUCTIONS.map((s) => s.role));
  assert.ok(roles.size >= 6, 'the textarea roles collapsed onto too few heights');

  // The role enum is CLOSED and lives in the owner; an unknown role throws
  // rather than rendering an unowned height.
  assert.match(UI, /const TEXTAREA_ROLES = new Set\(\[/);
  assert.match(UI, /textArea: unknown role/);
  for (const role of roles) {
    assert.ok(
      new RegExp(`data-rv-textarea="${role}"`).test(TOKENS) || role === 'rows',
      `css/tokens.css declares no geometry for the '${role}' textarea role`,
    );
  }
  // `rows` deliberately declares NO minimum.
  assert.ok(!/data-rv-textarea="rows"/.test(TOKENS),
    'the rows role acquired a minimum height; its geometry is the rows attribute');
});

test('8 · the collapsed checkboxes stay collapsed and keep owning the state', () => {
  const collapsed = CHECKBOX_CONSTRUCTIONS.filter((c) => c.collapsed);
  assert.equal(collapsed.length, 2, 'the collapsed state-carrier population changed');

  for (const site of collapsed) {
    assert.match(codeOf(site.path), /collapsed:\s*true/,
      `${site.id}: the collapsed state carrier became a visible control`);
  }
  // Zero-size, invisible, and still in the accessibility tree — never
  // display:none, and never a second visible box.
  const rule = /\.rv-checkbox-collapsed\s*\{([^}]*)\}/.exec(TOKENS);
  assert.ok(rule, '.rv-checkbox-collapsed is not declared');
  assert.match(rule[1], /position:\s*absolute/);
  assert.match(rule[1], /opacity:\s*0/);
  assert.match(rule[1], /width:\s*0/);
  assert.match(rule[1], /height:\s*0/);
  assert.ok(!/display:\s*none/.test(rule[1]), 'the collapsed carrier was hidden from assistive tech');

  // The two switches read that carrier and nothing else.
  for (const s of SWITCH_COMPONENTS) {
    assert.match(codeOf(s.path), /switchToggle\(\{\s*input:\s*chk/,
      `${s.id}: the switch stopped consuming the caller-owned checkbox`);
    assert.match(codeOf(s.path), /defeitoChk\.checked/,
      `${s.id}: getPayload no longer reads the checkbox state`);
  }
});

test('9 · the switch is one component: track and knob geometry are centralized', () => {
  for (const s of SWITCH_COMPONENTS) {
    assert.match(codeOf(s.path), new RegExp(`tone:\\s*'${s.tone}'`), `${s.id}: tone changed`);
    assert.match(codeOf(s.path), new RegExp(`label:\\s*'${s.label}'`), `${s.id}: label changed`);
  }
  // Exactly two tones, and they are the two the product already painted.
  assert.match(UI, /const SWITCH_TONES = new Set\(\['brand', 'caution'\]\)/);
  assert.match(UI, /switchToggle: unknown tone/);

  // One owner builds both parts.
  assert.match(UI, /class: 'rv-switch-track'/);
  assert.match(UI, /class: 'rv-switch-knob'/);
  assert.equal((UI.match(/class: 'rv-switch-track'/g) || []).length, 1);
  assert.equal((UI.match(/class: 'rv-switch-knob'/g) || []).length, 1);

  // Checked / unchecked / disabled are declarative, so a programmatic
  // `.checked = true` repaints with no handler at all.
  assert.match(TOKENS, /\.rv-switch \.rv-checkbox-collapsed:checked ~ \.rv-switch-track \{[^}]*background:\s*var\(--rv-viz-primary\)/);
  assert.match(TOKENS, /\.rv-switch\[data-rv-switch-tone="caution"\] \.rv-checkbox-collapsed:checked ~ \.rv-switch-track \{[^}]*background:\s*var\(--rv-signal-caution\)/);
  // The OFF fill moved from --rv-surface-subtle to the ramp's mid grey: with a
  // white knob, #f8fafc gave 1.05:1 and the control read as one solid white
  // shape. What this line guards is unchanged — the OFF fill is declared ONCE,
  // in the stylesheet, by the single track owner.
  assert.match(TOKENS, /\.rv-switch-track \{[^}]*background:\s*var\(--rv-text-tertiary\)/);
  assert.match(TOKENS, /\.rv-switch \.rv-checkbox-collapsed:disabled ~ \.rv-switch-track/);
  assert.match(TOKENS, /translateX\(var\(--rv-switch-knob-travel\)\)/);
  // No screen repaints the switch any more.
  for (const s of SWITCH_COMPONENTS) {
    assert.ok(!/track\.style\.background/.test(codeOf(s.path)), `${s.id}: a repaint handler survived`);
  }
});

test('10 · the runtime-computed range gradient is still active and still owned by the screen', () => {
  const range = RANGE_CONSTRUCTIONS[0];
  const code = codeOf(range.path);

  // The gradient itself: same stops, same arithmetic, recomputed per event.
  assert.match(code, /linear-gradient\(to right,var\(--rv-brand\) ' \+ pct \+ '%,var\(--rv-surface-subtle\) ' \+ pct \+ '%\)/);
  assert.match(code, /Math\.max\(0, Math\.min\(100, \(Number\(slider\.value\) \/ max\) \* 100\)\)/);

  // It is assigned to `background` ONLY, so it can never overwrite the shared
  // geometry the way the old whole-style-attribute rewrite did.
  const assignments = code.match(/\.style\.background = trackBg\(/g) || [];
  assert.equal(assignments.length, 3, 'the three gradient repaint sites changed');
  assert.ok(!/setAttribute\('style', trackBg/.test(code),
    'the slider style attribute is being rewritten wholesale again');

  // min / max / step and the input listener survive.
  assert.match(code, /min:\s*'0'/);
  assert.match(code, /max:\s*String\(maxCalc\)/);
  assert.match(code, /step:\s*'1'/);
  assert.match(code, /slider\.addEventListener\('input'/);

  // The stylesheet's own background is only the REST fallback: an inline
  // background always wins over it.
  assert.match(TOKENS, /\.rv-range \{[^}]*background:\s*var\(--rv-viz-track\)/);
  assert.match(TOKENS, /\.rv-range::-webkit-slider-thumb/);
  assert.match(TOKENS, /\.rv-range::-moz-range-thumb/);
});

test('11 · every construction carries a label or an accessible name', () => {
  const named = [
    ...CHECKBOX_CONSTRUCTIONS.map((c) => ({ id: c.id, path: c.path, needle: c.name })),
    ...SWITCH_COMPONENTS.map((s) => ({ id: s.id, path: s.path, needle: s.label })),
    ...TEXTAREA_CONSTRUCTIONS.map((t) => ({ id: t.id, path: t.path, needle: null })),
  ];
  for (const site of named) {
    const code = codeOf(site.path);
    if (site.needle) {
      assert.ok(
        code.includes(site.needle),
        `${site.id}: the accessible name "${site.needle}" disappeared from ${site.path}`,
      );
    }
  }
  // Every textarea and checkbox construction supplies a name.
  for (const site of [...TEXTAREA_CONSTRUCTIONS, ...CHECKBOX_CONSTRUCTIONS]) {
    const code = codeOf(site.path);
    assert.match(code, /ariaLabel:/, `${site.id}: ${site.path} passes no accessible name`);
  }
  // The range names itself from the model it distributes.
  assert.match(codeOf(RANGE_CONSTRUCTIONS[0].path), /ariaLabel:\s*'Metros — ' \+ rotuloModelo\(modelo\)/);
  // The switch names its own state carrier from the visible label.
  assert.match(UI, /box\.setAttribute\('aria-label', label\)/);
  // The visually hidden control keeps its text in the accessibility tree.
  assert.match(codeOf(VISUALLY_HIDDEN_CONSTRUCTIONS[0].path), /visuallyHidden\('Sair'/);
  assert.match(TOKENS, /\.rv-visually-hidden \{[^}]*clip:\s*rect\(0, 0, 0, 0\)/);
  assert.ok(!/\.rv-visually-hidden \{[^}]*display:\s*none/.test(TOKENS),
    'the visually hidden utility was removed from the accessibility tree');
});

test('12 · every primitive declares a focus-visible and a disabled owner', () => {
  for (const selector of ['.rv-textarea', '.rv-checkbox', '.rv-range']) {
    assert.ok(
      new RegExp(`\\${selector}:focus-visible`).test(TOKENS),
      `${selector} declares no focus-visible state`,
    );
    assert.ok(
      new RegExp(`\\${selector}:disabled`).test(TOKENS),
      `${selector} declares no disabled state`,
    );
  }
  // The switch focuses and disables through its collapsed state carrier.
  assert.match(TOKENS, /\.rv-switch \.rv-checkbox-collapsed:focus-visible ~ \.rv-switch-track/);
  assert.match(TOKENS, /\.rv-switch\[data-rv-switch-disabled\]/);
  // Invalid is declared where a value can be invalid.
  assert.match(TOKENS, /\.rv-textarea\[aria-invalid="true"\]/);
  assert.match(TOKENS, /\.rv-checkbox\[aria-invalid="true"\]/);
  // Hover and rest exist too.
  assert.match(TOKENS, /\.rv-textarea:hover:not\(:disabled\)/);
  assert.match(TOKENS, /\.rv-checkbox:hover:not\(:disabled\)/);
});

test('13 · no specialized primitive joined the generic UIC-003 ladder', () => {
  // The detector proves it for the 66 screens; this proves the STYLESHEET
  // never places a specialized role on a rung of the generic ladder.
  const specializedBlock = TOKENS.slice(TOKENS.indexOf('SPECIALIZED CONTROLS — the five role primitives'));
  assert.ok(specializedBlock.length > 0, 'the specialized-control stylesheet block disappeared');
  assert.ok(
    !/--rv-h-(compact|default|primary)/.test(specializedBlock),
    'a specialized control resolves through a generic control-height rung',
  );
  // And the constructors declare no height at all.
  const primitiveSource = UI.slice(
    UI.indexOf('SPECIALIZED CONTROLS (SPECIALIZED-CONTROLS-B1)'),
    UI.indexOf('// --- Tabela de dados ---'),
  );
  assert.ok(primitiveSource.length > 0, 'the specialized-control primitives disappeared from js/ui.js');
  assert.ok(!/height:/.test(primitiveSource), 'a specialized primitive declares a height in JavaScript');
  assert.ok(!/style:/.test(primitiveSource), 'a specialized primitive carries a style escape hatch');
  assert.equal(
    BASELINE.findings.filter((f) => f.rule_id === 'UIC-003').length,
    0,
    'a specialized construction is being measured by the generic ladder',
  );
});

test('14 · no new specialized construction can hide anywhere in the runtime', () => {
  // A raw specialized construction may exist ONLY in the owner. Anywhere else
  // it is a new unowned surface and needs an architect ruling, not an
  // automatic exemption.
  const offenders = [];
  for (const { rel, code } of CONSUMERS) {
    if (/type:\s*'(checkbox|radio|range)'/.test(code)) offenders.push(`${rel}: raw specialized input`);
    if (/el\(\s*['"]textarea['"]/.test(code)) offenders.push(`${rel}: raw textarea`);
  }
  assert.deepEqual(
    offenders,
    [],
    `HARD STOP — SPECIALIZED-CONTROL POPULATION EXPANDED: ${offenders.join(', ')}`,
  );

  // And the owner builds each of them exactly once.
  assert.equal((stripComments(UI).match(/type:\s*'checkbox'/g) || []).length, 1);
  assert.equal((stripComments(UI).match(/type:\s*'range'/g) || []).length, 1);
  assert.equal((stripComments(UI).match(/el\('textarea',/g) || []).length, 1);
});

/* ============================================================
   3 · first-party runtime guard — the four required counters
   ============================================================ */

/** Tailwind height utilities that would make a class token the geometry owner. */
const TW_HEIGHT_RE = /(?<![\w-])(h-\d+(?:\.\d+)?|h-\[[^\]]*\]|min-h-\[[^\]]*\]|max-h-\[[^\]]*\]|min-h-\w+|max-h-\w+)/g;

/* B1 removed the `isSpecializedUtility()` allowance entirely. It existed so a
   frozen specialized site could keep a Tailwind height utility as its geometry
   owner (`h-4 w-4`, `min-h-[96px]`, `min-h-[110px]`). No specialized control
   carries a class-token height any more — section 2 proves that directly — so
   the exemption has nothing left to exempt and its removal makes the counter
   below STRICTLY stronger, never weaker. */

test('15 · OUT_OF_LADDER_GENERIC_CONTROL_HEIGHT_COUNT = 0', () => {
  // Every explicit height on a control the generic ladder governs must be one
  // of the three canonical tokens. The detector proves this for the 66 screens;
  // this asserts it over the WHOLE loaded runtime, shared primitives included.
  const offenders = [];
  for (const { rel, text } of RUNTIME) {
    const re = /el\(\s*'(button|input|select)'\s*,\s*\{([\s\S]{0,900}?)\}\s*[,)]/g;
    for (const m of text.matchAll(re)) {
      const [, tag, attrs] = m;
      if (/type:\s*'(checkbox|radio|range|hidden)'/.test(attrs)) continue;
      const height = /(?<!min-|max-)(?<![\w-])height\s*:\s*([^;'"`]+)/.exec(attrs);
      if (!height) continue;
      const value = height[1].trim();
      if (LADDER_TOKENS.includes(value)) continue;
      // A literal that IS a ladder rung is inside the ladder. The token
      // spelling is preferred and every site this pass touched uses it, but a
      // pre-existing in-ladder literal is not an out-of-ladder height and this
      // counter does not measure spelling.
      if (LADDER_LITERALS.includes(value)) continue;
      if (tag === 'button' && value === ROW_ACTION_EDGE) continue; // canonical row action
      if (/^(auto|100%|0)$/.test(value)) continue; // fill/reset, not a ladder claim
      // A statically proven visually hidden control has no rendered box, and
      // the detector excludes it for exactly this reason.
      if (/position:absolute/.test(attrs) && /clip(-path)?\s*:/.test(attrs)) continue;
      offenders.push(`${rel}: ${tag} height:${value}`);
    }
  }
  assert.deepEqual(offenders, [], `OUT_OF_LADDER_GENERIC_CONTROL_HEIGHT_COUNT = ${offenders.length}`);
});

test('16 · TAILWIND_GENERIC_CONTROL_HEIGHT_UTILITY_COUNT = 0', () => {
  const offenders = [];
  for (const { rel, text } of RUNTIME) {
    // Bind each class list to its OWN element by matching the whole factory
    // call, so a utility on a neighbouring card or page shell can never be
    // attributed to a control.
    const re = /el\(\s*'(button|input|select|textarea|div|span|section|label|a)'\s*,\s*\{([\s\S]{0,900}?)\}\s*[,)]/g;
    for (const m of text.matchAll(re)) {
      const [, tag, attrs] = m;
      const classAttr = /class:\s*['"`]([^'"`]*)['"`]/.exec(attrs);
      if (!classAttr) continue;
      const utilities = classAttr[1].match(TW_HEIGHT_RE);
      if (!utilities) continue;
      // A height utility on a proven non-control is outside UIC-003. It is
      // listed here as justified rather than silently skipped.
      if (!['button', 'input', 'select', 'textarea'].includes(tag)) continue;
      const specialized =
        tag === 'textarea' || /type:\s*'(checkbox|radio|range|hidden)'/.test(attrs);
      for (const u of utilities) {
        // A specialized control is outside the GENERIC ladder this counter
        // measures. Section 2 proves separately that no specialized control
        // owns a class-token height any more, so this branch is now
        // unreachable in the real runtime and is kept only as the semantic
        // statement of what the counter does not govern.
        if (specialized) continue;
        offenders.push(`${rel}: ${u} on a generic control`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `TAILWIND_GENERIC_CONTROL_HEIGHT_UTILITY_COUNT = ${offenders.length}`,
  );
});

test('17 · UNRESOLVED_GENERIC_CONTROL_ROLE_COUNT = 0', () => {
  // Reuse the real front-end rather than a second grammar: a height whose role
  // the detector cannot resolve is exactly what UIC-003 reports as coverage.
  let unresolved = 0;
  const offenders = [];
  for (const { rel, text } of SCREENS) {
    const unit = jsScreen.analyse(rel, text);
    if (unit.lexError) continue;
    for (const decl of unit.declarations) {
      if (decl.property !== 'height' || decl.interpolated) continue;
      if (decl.element.roleResolved) continue;
      if (decl.element.attrMap.get('type')) continue;
      unresolved += 1;
      offenders.push(`${rel}:${unit.locate(decl.valueOffset).line} height:${decl.value}`);
    }
  }
  assert.equal(unresolved, 0, `UNRESOLVED_GENERIC_CONTROL_ROLE_COUNT = ${unresolved}\n${offenders.join('\n')}`);
});

test('18 · GENERIC_CONTROL_HEIGHT_LITERAL_CONSTANT_COUNT = 0', () => {
  // A named constant may hold a canonical TOKEN; it may never hold a bare
  // literal that a generic control's height resolves through.
  const offenders = [];
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g;
  for (const { rel, text } of RUNTIME) {
    for (const m of text.matchAll(re)) {
      const [, name, value] = m;
      if (!/height/i.test(name)) continue;
      // B1 narrowed this exemption. The TEXTAREA / MULTILINE / MIN_HEIGHT
      // spellings are gone together with the last constants that used them
      // (MOVEMENT_TEXTAREA_MIN_HEIGHT and the two modal 44px minima): a
      // multiline minimum is now a CSS token behind a declared role. What
      // survives is MAX_HEIGHT alone, which is a scroll-container ceiling —
      // never a height a control resolves through.
      if (/MAX_HEIGHT/i.test(name)) continue;
      if (!/^\d+(\.\d+)?px$/.test(value)) continue;
      offenders.push(`${rel}: ${name} = '${value}'`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `GENERIC_CONTROL_HEIGHT_LITERAL_CONSTANT_COUNT = ${offenders.length}`,
  );
});

test('19 · the guard carries no path-only ignore list', () => {
  // Every exclusion above is expressed as a semantic predicate. A "skip this
  // file" list is the mechanism this whole structure exists to prevent, so
  // assert the detector carries none — reading CODE only, since the modules
  // discuss waivers in prose precisely to say they have none.
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const src of [
    'scripts/ui-conformance/rules.mjs',
    'scripts/ui-conformance/frontends/js-screen.mjs',
  ]) {
    const code = stripComments(read(src));
    assert.ok(
      !/\b(ignoreList|IGNORE_PATHS|WAIVERS?|SUPPRESS\w*|skipFiles|EXEMPT_PATHS)\b/i.test(code),
      `${src} appears to carry a waiver or ignore mechanism`,
    );
    assert.ok(
      !/['"`]js\/screens\/[a-z0-9-]+\.js['"`]/.test(code),
      `${src} names a specific screen path in code`,
    );
  }
});

/* ============================================================
   4 · role rulings the detector cannot restate
   ============================================================ */

test('20 · the three pagination current-page nodes are non-interactive indicators', () => {
  for (const rel of [
    'js/screens/ops-list.js',
    'js/screens/pedidos-list.js',
    'js/screens/cliente-pedidos-list.js',
  ]) {
    const text = read(rel);
    assert.match(text, /el\(\s*'span'\s*,\s*\{\s*\n?\s*'aria-current':\s*'page'/, `${rel}: current page is not a span[aria-current=page]`);
    assert.ok(
      !/el\('button',\s*\{\s*\n?\s*type:\s*'button',\s*\n?\s*style:\s*'width:30px;height:30px;display:flex/.test(text),
      `${rel}: the current-page button survived`,
    );
    // Still 30x30 and still without a handler.
    const block = /aria-current':\s*'page',[\s\S]{0,400}?\}/.exec(text)[0];
    assert.match(block, /width:30px;height:30px/);
    assert.ok(!/onclick/.test(block), `${rel}: the indicator gained a click handler`);
  }
});

test('21 · both cadastros price-row actions delegate to the canonical primitive', () => {
  const text = read('js/screens/cadastros.js');
  assert.match(text, /window\.actionButton\(\{\s*\n?\s*title: 'Editar preco'/);
  assert.match(text, /window\.actionButton\(\{\s*\n?\s*title: 'Excluir preco'/);
  assert.match(text, /title: 'Excluir preco'[\s\S]{0,200}?danger: true/);
  // The deletion gate is preserved.
  assert.match(text, /title: 'Excluir preco'[\s\S]{0,200}?onclick: \(\) => confirmExcluir\(row\)/);
  // The canonical primitive still supplies the full row-action contract.
  const ui = read('js/ui.js');
  assert.match(ui, /function actionButton\(\{ title, icon, danger[^)]*\}\)/);
  assert.match(ui, /width:30px; height:30px;/);
  assert.match(ui, /'aria-label': title/);
  assert.match(ui, /srLabel \|\| title/);
});

/* ------------------------------------------------------------
   PASS-3-CONTROL-HEIGHT-GUARD-FORWARD-CORRECTION-A1

   Pass 3 remains CLOSED / ACCEPTED. Two of its assertions were
   written against the SHAPE of the then-current implementation
   rather than against the contract, and Pass 7 (UIC-006)
   intentionally replaced that implementation: the native
   <select> owner is gone and js/select-popover.js is the single
   owner of the single-choice control.

   Test 14 asserted the compact rung was declared INSIDE
   selectInput; test 15 asserted selectInput contained
   `const sel = el('select', {`. Both are now obsolete SOURCE
   SHAPE facts. They are replaced below by SEMANTIC ownership
   assertions that prove the same Pass-3 contract — one compact
   rung, one owner per primitive, no specialized control — over
   the new structure. The generic compact-height contract, the
   closed 32/34/38 ladder and the Pass-3 specialized-control
   exclusions are unchanged, and no coverage is weakened: every
   dropped assertion is replaced by a strictly stronger one.
   ------------------------------------------------------------ */

test('22 · the shared single-line field primitives own the canonical compact rung', () => {
  const ui = read('js/ui.js');
  const popover = read('js/select-popover.js');

  // textInput still declares the rung DIRECTLY — unchanged by Pass 7.
  assert.match(ui, /function textInput\(\{[\s\S]{0,900}?height:var\(--rv-h-compact\);/);

  // selectInput remains the shared compatibility entry point and delegates
  // to the canonical owner instead of declaring geometry of its own.
  assert.match(ui, /function selectInput\(\{/);
  assert.match(ui, /function selectInput\(\{[\s\S]{0,600}?createSelectPopover\(/);

  // The canonical select-popover TRIGGER owns the compact rung.
  assert.match(popover, /height:var\(--rv-h-compact\)/);
  assert.match(popover, /TRIGGER_STYLE[\s\S]{0,600}?height:var\(--rv-h-compact\);/);

  // Neither primitive carries vertical padding competing with the explicit
  // border-box height.
  assert.ok(!/w-full border px-3 py-2/.test(ui), 'py-2 still fights the explicit height');
  assert.match(ui, /w-full border px-3 focus:outline-none/);
  assert.match(popover, /padding-top:0; padding-bottom:0;/);

  // The read-only field presentation shares the same compact geometry.
  assert.match(popover, /createReadonlyFieldValue[\s\S]{0,900}?height:var\(--rv-h-compact\)/);

  // The closed ladder is still exactly three rungs, declared once.
  const tokens = read('css/tokens.css');
  assert.match(tokens, /--rv-h-compact: 32px;/);
  assert.match(tokens, /--rv-h-default: 34px;/);
  assert.match(tokens, /--rv-h-primary: 38px;/);
  assert.equal((tokens.match(/--rv-h-(compact|default|primary):/g) || []).length, 3,
    'the control-height ladder gained or lost a rung');
});

test('23 · neither shared field primitive can build a specialized control', () => {
  const ui = read('js/ui.js');
  const popover = read('js/select-popover.js');

  assert.match(ui, /function textInput\(\{ type = 'text'/);
  assert.match(ui, /const input = el\('input', attrs\)/);

  // Pass 7: selectInput must NOT create, contain or hide a native select.
  assert.ok(!/el\('select'/.test(ui), 'js/ui.js still constructs a native select');
  assert.ok(!/el\('option'/.test(ui), 'js/ui.js still constructs a native option');
  assert.ok(!/createElement\('select'\)/.test(ui), 'js/ui.js still creates a native select');

  // The canonical owner builds a button trigger with combobox semantics —
  // never a native select and never a hidden native value owner.
  assert.match(popover, /createElement\('button'\)/);
  assert.match(popover, /setAttribute\('role', 'combobox'\)/);
  assert.ok(!/createElement\('select'\)/.test(popover), 'the primitive creates a native select');
  assert.ok(!/createElement\('option'\)/.test(popover), 'the primitive creates a native option');

  // Neither shared primitive may build a specialized control. This is the
  // Pass-3 exclusion set, unchanged.
  for (const forbidden of ['checkbox', 'radio', 'range', 'file', 'color']) {
    assert.ok(!new RegExp(`createElement\\('${forbidden}'\\)`).test(popover));
  }
  assert.ok(!/createElement\('textarea'\)/.test(popover), 'the primitive builds a textarea');
  assert.ok(!/type:\s*'hidden'/.test(popover), 'the primitive builds a hidden input');
  assert.ok(!/createElement\('input'\)/.test(popover),
    'the primitive builds an input — there is no search box in a select popover');

  // Every type any consumer passes to textInput is a single-line field type.
  const allowed = new Set(['text', 'email', 'password', 'number', 'date']);
  const seen = new Set();
  for (const { text } of RUNTIME) {
    for (const m of text.matchAll(/textInput\(\{[^}]*type:\s*'([a-z]+)'/g)) seen.add(m[1]);
  }
  for (const t of seen) {
    assert.ok(allowed.has(t), `textInput is used to build a ${t} control`);
  }
});

/* ============================================================
   5 · the two transport amendments, pinned to their envelope
   ============================================================ */

const probe = (src) => jsScreen.analyse('probe.js', src);
const heightDecls = (unit) => unit.declarations.filter((d) => d.property === 'height');

test('24 · literal input type is transported, and only literally', () => {
  const u = probe([
    "var a = window.el('input', { type: 'checkbox', style: 'height:15px;' });",
    "var b = el('input', { type: 'text', style: 'height:40px;' });",
    "var c = window.el('input', { type: kind, style: 'height:40px;' });",
    "var d = window.el('button', { type: 'button', style: 'height:40px;' });",
  ].join('\n'));
  const [a, b, c, d] = heightDecls(u);
  assert.equal(a.element.attrMap.get('type'), 'checkbox');
  assert.equal(b.element.attrMap.get('type'), 'text', 'an ordinary field must stay measurable');
  assert.equal(c.element.attrMap.get('type'), undefined, 'a computed type must stay unproven');
  assert.equal(d.element.attrMap.get('type'), undefined, 'type is transported for inputs only');
});

test('25 · a factory-bound checkbox keeps its type when styled after construction', () => {
  const u = probe([
    "var chk = window.el('input', { type: 'checkbox', class: 'h-4 w-4' });",
    "chk.style.cssText = 'position:absolute;opacity:0;width:0;height:0;margin:0;';",
  ].join('\n'));
  const [h] = heightDecls(u);
  assert.equal(h.element.attrMap.get('type'), 'checkbox');
});

test('26 · the window.el binding amendment stays inside its authorized envelope', () => {
  const accepted = probe([
    "var i = window.el('input', { type: 'text' });  i.style.height = '40px';",
    "var s = window.el('select', {});               s.style.height = '40px';",
    "var t = window.el('textarea', {});             t.style.height = '40px';",
    "var b = window.el('button', {});               b.style.height = '40px';",
  ].join('\n'));
  assert.deepEqual(heightDecls(accepted).map((d) => d.element.tag), ['input', 'select', 'textarea', 'button']);

  const bare = probe("var x = el('input', {}); x.style.height = '40px';");
  assert.equal(heightDecls(bare)[0].element.tag, 'input', 'existing bare-el behaviour changed');

  const rejected = probe([
    "var p = foo.el('input', {});          p.style.height = '40px';",
    "var q = obj.factory('input', {});     q.style.height = '40px';",
    "var r = window.el(dynamicTag, {});    r.style.height = '40px';",
  ].join('\n'));
  for (const d of heightDecls(rejected)) {
    assert.equal(d.element.tag, null, 'an unauthorized factory or a dynamic tag was resolved');
    assert.equal(d.element.roleResolved, false);
  }
});

test('27 · no role, ancestry or interaction is inferred by either amendment', () => {
  const u = probe([
    "var a = window.el('div', { role: 'button', 'data-ui-control': '1', style: 'height:40px;' });",
  ].join('\n'));
  const [h] = heightDecls(u);
  assert.equal(h.element.attrMap.get('role'), undefined, 'role must never be transported');
  assert.equal(h.element.attrMap.get('data-ui-control'), undefined);
  assert.equal(h.element.insideCard, null, 'ancestry must stay unknown');
});

/* ============================================================
   6 · non-vacuity — the guard still rejects what it must
   ============================================================ */

import { buildEnums, readContract, readTokens } from '../scripts/ui-conformance/contract.mjs';
import { runRules } from '../scripts/ui-conformance/rules.mjs';

const CONTRACT = readContract(ROOT);
const CTX = { tokens: readTokens(ROOT), enums: buildEnums(CONTRACT) };
const uic003Of = (src) => runRules(probe(src), CTX).filter((f) => f.rule_id === 'UIC-003');

test('28 · an ordinary control outside the ladder is still rejected', () => {
  const cases = [
    ["el('button', { style: 'height:30px;' })", 'blocking', 'ordinary 30px button'],
    ["el('button', { style: 'height:36px;' })", 'blocking', 'ordinary 36px button'],
    ["el('button', { style: 'height:1px;' })", 'blocking', 'visible 1px button'],
    ["el('input', { type: 'text', style: 'height:40px;' })", 'blocking', 'single-line input at 40px'],
    ["el('input', { type: 'date', style: 'height:44px;' })", 'blocking', 'date field outside the ladder'],
    ["el('button', { style: 'height:var(--rv-missing-height);' })", 'blocking', 'unresolved token'],
  ];
  for (const [src, severity, label] of cases) {
    const found = uic003Of(src);
    assert.equal(found.length, 1, `${label} was not reported`);
    assert.equal(found[0].severity, severity, label);
  }
});

test('29 · a specialized or hidden control is excluded, never reported', () => {
  const cases = [
    ["el('input', { type: 'checkbox', style: 'height:16px;' })", 'checkbox'],
    ["el('input', { type: 'radio', style: 'height:16px;' })", 'radio'],
    ["el('input', { type: 'range', style: 'height:22px;' })", 'range'],
    ["el('input', { type: 'hidden', style: 'height:0;' })", 'hidden'],
    ["el('textarea', { style: 'min-height:104px;height:104px;' })", 'textarea'],
    ["el('button', { class: 'sr-only', style: 'position:absolute;width:1px;height:1px;clip:rect(0 0 0 0);' })", 'sr-only button'],
    ["el('span', { style: 'display:inline-block;width:40px;height:22px;' })", '40x22 span track'],
  ];
  for (const [src, label] of cases) {
    assert.deepEqual(uic003Of(src), [], `${label} must be excluded from the generic ladder`);
  }
});

test('30 · a control merely dressed as a track or a hidden node is still rejected', () => {
  // A button is a control however it is styled: the track exemption is about
  // the span the toggle really uses, not about any 40x22 box.
  const masquerade = uic003Of("el('button', { style: 'display:inline-block;width:40px;height:22px;' })");
  assert.equal(masquerade.length, 1, 'a button masquerading as a track was excused');
  assert.equal(masquerade[0].severity, 'blocking');

  // The visually hidden proof is structural and complete-or-nothing.
  const partial = uic003Of("el('button', { style: 'position:absolute;width:1px;height:1px;' })");
  assert.equal(partial.length, 1, 'a 1px absolute button with no clipping was excused');

  const notHairline = uic003Of(
    "el('button', { style: 'position:absolute;width:40px;height:40px;clip:rect(0 0 0 0);' })",
  );
  assert.equal(notHairline.length, 1, 'a clipped but full-size button was excused');
});

test('31 · a canonical ladder value on a real control passes', () => {
  for (const token of LADDER_TOKENS) {
    assert.deepEqual(uic003Of(`el('button', { style: 'height:${token};' })`), [], token);
  }
  assert.deepEqual(uic003Of("el('input', { type: 'text', style: 'height:var(--rv-h-compact);' })"), []);
});

test('32 · comments and prose do not fire the rule', () => {
  assert.deepEqual(uic003Of("// height:40px on a button\n/* height:30px */\nvar s = 'height:40px';"), []);
});
