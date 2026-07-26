/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 3 (UIC-003)

   Proves the GENERIC control-height property closed: every control the
   ratified ladder governs resolves through --rv-h-compact / --rv-h-default /
   --rv-h-primary, and `UIC-003` reports zero blocking and zero coverage.

   The pass did NOT ratify checkbox, radio, range, switch-track or multiline
   textarea geometry. Those primitives are EXCLUDED from the generic ladder and
   carried instead by the frozen UI-SPECIALIZED-CONTROL-CONTRACT-GAP inventory
   below. Excluded is not conforming: section 3 asserts each one is still
   present, still owns its geometry and is still unratified, so the debt cannot
   quietly evaporate and cannot quietly widen.

   Two front-end transport amendments made the exclusion decidable at all, and
   section 5 pins both to their exact authorized envelope.
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
   2 · UI-SPECIALIZED-CONTROL-CONTRACT-GAP — the frozen inventory

   Pinned by SEMANTIC SIGNATURE, never by line number: a source edit that
   moves one of these sites must not silently break the guard, but a site that
   DISAPPEARS or a NEW specialized site that appears must.
   ============================================================ */

const SPECIALIZED_CONTROLS = [
  {
    id: 'login-remember-checkbox',
    path: 'js/screens/system-screens.js',
    constructor: "el('input', { type: 'checkbox', style })",
    controlType: 'input[type=checkbox]',
    geometryOwner: 'inline style width/height on the factory attribute object',
    behaviourOwner: 'native checkbox; the login form reads .checked',
    reason: 'a native checkbox is not a member of the generic action/field ladder',
    signature: /type:\s*'checkbox'[\s\S]{0,120}?height:15px/,
  },
  {
    id: 'entrega-defeito-hidden-checkbox',
    path: 'js/screens/entrega-form.js',
    constructor: "el('input', { type: 'checkbox', class: 'h-4 w-4', style })",
    controlType: 'input[type=checkbox], visually collapsed',
    geometryOwner: 'inline style at construction (position/opacity/width/height)',
    behaviourOwner: 'state owner read by getPayload; drives the visual toggle',
    reason: 'a checkbox backing a toggle is a specialized primitive, not a field',
    signature: /type:\s*'checkbox'[\s\S]{0,200}?position:absolute;opacity:0;width:0;height:0/,
  },
  {
    id: 'manta-defeito-hidden-checkbox',
    path: 'js/screens/manta-output-form.js',
    constructor: "el('input', { type: 'checkbox', class: 'h-4 w-4', style })",
    controlType: 'input[type=checkbox], visually collapsed',
    geometryOwner: 'inline style at construction (position/opacity/width/height)',
    behaviourOwner: 'state owner read by getPayload; drives the visual toggle',
    reason: 'a checkbox backing a toggle is a specialized primitive, not a field',
    signature: /type:\s*'checkbox'[\s\S]{0,200}?position:absolute;opacity:0;width:0;height:0/,
  },
  {
    id: 'entrega-defeito-toggle-track',
    path: 'js/screens/entrega-form.js',
    constructor: "el('span', { style }) wrapping the knob",
    controlType: 'switch track (non-control presentation)',
    geometryOwner: 'inline style at construction: 40x22',
    behaviourOwner: 'paint() repaints background only; the checkbox owns state',
    reason: 'a switch track has independent geometry the contract never ratified',
    signature: /display:inline-block;width:40px;height:22px/,
  },
  {
    id: 'manta-defeito-toggle-track',
    path: 'js/screens/manta-output-form.js',
    constructor: "el('span', { style }) wrapping the knob",
    controlType: 'switch track (non-control presentation)',
    geometryOwner: 'inline style at construction: 40x22',
    behaviourOwner: 'paint() repaints background only; the checkbox owns state',
    reason: 'a switch track has independent geometry the contract never ratified',
    signature: /display:inline-block;width:40px;height:22px/,
  },
  {
    id: 'entrega-defeito-toggle-knob',
    path: 'js/screens/entrega-form.js',
    constructor: "el('span', { style })",
    controlType: 'switch knob (non-control presentation)',
    geometryOwner: 'inline style at construction: 18x18',
    behaviourOwner: 'paint() sets transform only',
    reason: 'the knob belongs to the unratified switch primitive',
    signature: /width:18px;height:18px;border-radius:var\(--rv-radius-pill\)/,
  },
  {
    id: 'manta-defeito-toggle-knob',
    path: 'js/screens/manta-output-form.js',
    constructor: "el('span', { style })",
    controlType: 'switch knob (non-control presentation)',
    geometryOwner: 'inline style at construction: 18x18',
    behaviourOwner: 'paint() sets transform only',
    reason: 'the knob belongs to the unratified switch primitive',
    signature: /width:18px;height:18px;border-radius:var\(--rv-radius-pill\)/,
  },
  {
    id: 'pedido-form-autosize-textarea',
    path: 'js/screens/pedido-form.js',
    constructor: "el('textarea', { rows: 1, style })",
    controlType: 'textarea, autosizing',
    geometryOwner: 'syncTextareaHeight() — height:auto then scrollHeight, min 40px',
    behaviourOwner: 'input listener; resize:none; overflow-y:hidden',
    reason: 'a multiline height is content behaviour, not a ladder rung',
    signature: /function syncTextareaHeight\(\)[\s\S]{0,200}?scrollHeight/,
  },
  {
    id: 'cliente-pedido-form-autosize-textarea',
    path: 'js/screens/cliente-pedido-form.js',
    constructor: "el('textarea', { rows: 1, style })",
    controlType: 'textarea, autosizing',
    geometryOwner: 'input listener — height:auto then scrollHeight',
    behaviourOwner: 'input listener; resize:none; overflow-y:hidden',
    reason: 'a multiline height is content behaviour, not a ladder rung',
    signature: /obsTextarea\.style\.height = 'auto'/,
  },
  {
    id: 'cadastros-modal-textarea-minimum',
    path: 'js/screens/cadastros.js',
    constructor: "cadastrosTextarea() -> el('textarea', { rows, placeholder })",
    controlType: 'textarea, fixed minimum height',
    geometryOwner: 'applyCadastrosModalControlStyle TEXTAREA branch + options.minHeight',
    behaviourOwner: 'resize:vertical',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /if \(control\.tagName === 'TEXTAREA'\)[\s\S]{0,160}?minHeight = '44px'/,
  },
  {
    id: 'admin-usuarios-modal-textarea-minimum',
    path: 'js/screens/admin-usuarios-modal.js',
    constructor: "adminUsuariosTextarea() -> el('textarea', { rows, placeholder })",
    controlType: 'textarea, fixed minimum height',
    geometryOwner: 'applyAdminUsuariosControlStyle TEXTAREA branch + options.minHeight',
    behaviourOwner: 'resize:vertical',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /if \(control\.tagName === 'TEXTAREA'\)[\s\S]{0,160}?minHeight = '44px'/,
  },
  {
    id: 'movement-modal-textarea-minimum',
    path: 'js/screens/pedido-detail-events.js',
    constructor: 'normalizeMovementModalControls()',
    controlType: 'textarea, fixed minimum height',
    geometryOwner: "MOVEMENT_TEXTAREA_MIN_HEIGHT applied only when tagName === 'TEXTAREA'",
    behaviourOwner: 'the transfer form that owns the modal',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /MOVEMENT_TEXTAREA_MIN_HEIGHT/,
  },
  {
    id: 'parciais-mensagem-textarea',
    path: 'js/screens/pedido-parciais-admin.js',
    constructor: "el('textarea', { style, class })",
    controlType: 'textarea, Tailwind minimum height',
    geometryOwner: 'class token min-h-[96px]',
    behaviourOwner: 'plain textarea',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /min-h-\[96px\]/,
  },
  {
    id: 'tracking-mensagem-textarea',
    path: 'js/screens/pedido-tracking-admin.js',
    constructor: "el('textarea', { style, class })",
    controlType: 'textarea, Tailwind minimum height',
    geometryOwner: 'class token min-h-[110px]',
    behaviourOwner: 'plain textarea',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /min-h-\[110px\]/,
  },
  {
    id: 'parciais-visivel-checkbox',
    path: 'js/screens/pedido-parciais-admin.js',
    constructor: "el('input', { type: 'checkbox', style, class })",
    controlType: 'input[type=checkbox]',
    geometryOwner: 'Tailwind class tokens h-4 w-4',
    behaviourOwner: 'native checkbox; .checked read on submit',
    reason: 'a native checkbox is not a member of the generic ladder',
    signature: /type:\s*'checkbox'[\s\S]{0,140}?h-4 w-4/,
  },
  {
    id: 'admin-usuarios-mostrar-inativos-checkbox',
    path: 'js/screens/admin-usuarios.js',
    constructor: "el('input', { type: 'checkbox', checked, onchange })",
    controlType: 'input[type=checkbox]',
    geometryOwner: 'native user-agent default — the screen declares none',
    behaviourOwner: 'onchange toggles the inactive-rows filter',
    reason: 'a native checkbox is not a member of the generic ladder',
    signature: /type:\s*'checkbox',\s*\n\s*checked: mostrarInativos/,
  },
  {
    id: 'op-distribuicao-metros-range',
    path: 'js/screens/op-distribuicao-ui.js',
    constructor: "el('input', { type: 'range', min, max, step })",
    controlType: 'input[type=range]',
    geometryOwner: "setAttribute('style', trackBg(slider)) — a computed gradient track",
    behaviourOwner: 'input listener writing metrosOverride',
    reason: 'a range track has independent geometry the contract never ratified',
    signature: /type:\s*'range',\s*min:\s*'0'/,
  },
  {
    id: 'pedido-edit-observacao-textarea',
    path: 'js/screens/pedido-edit.js',
    constructor: "el('textarea', { rows: 3, style, class })",
    controlType: 'textarea, row-sized',
    geometryOwner: 'rows=3 plus Tailwind px-3 py-2',
    behaviourOwner: 'plain textarea bound to state.observacao',
    reason: 'a multiline height is content behaviour, not a ladder rung',
    signature: /el\('textarea', \{\s*\n\s*rows: 3,/,
  },
  {
    id: 'receipt-estorno-motivo-textarea',
    path: 'js/screens/ordem-compra-receipt-events.js',
    constructor: "el('textarea', { class, style, rows: '3' })",
    controlType: 'textarea, row-sized',
    geometryOwner: "rows='3' plus Tailwind px-3 py-2",
    behaviourOwner: 'reversal reason captured on submit',
    reason: 'a multiline height is content behaviour, not a ladder rung',
    signature: /placeholder: 'Motivo do estorno'/,
  },
  {
    id: 'expedicao-observacao-textarea',
    path: 'js/screens/expedicao-admin.js',
    constructor: "el('textarea', { style, placeholder })",
    controlType: 'textarea, fixed minimum height',
    geometryOwner: 'inline min-height:56px',
    behaviourOwner: 'plain textarea; resize:none',
    reason: 'a multiline minimum is outside the single-line field rung',
    signature: /min-height:56px[\s\S]{0,200}?Observacao opcional/,
  },
  {
    id: 'shell-sr-only-logout',
    path: 'js/screens/common.js',
    constructor: "el('button', { class: 'sr-only', style, onclick: window.logout })",
    controlType: 'visually hidden compatibility button',
    geometryOwner: 'inline style: absolute + clip + 1px box',
    behaviourOwner: 'window.logout; kept for the screens-common smoke contract',
    reason: 'a visually hidden control has no rendered box to measure',
    signature: /class:\s*'sr-only'[\s\S]{0,160}?clip:rect\(0 0 0 0\)/,
  },
];

test('4 · every frozen specialized control is still present and still owns its geometry', () => {
  for (const entry of SPECIALIZED_CONTROLS) {
    const text = read(entry.path);
    assert.match(
      text,
      entry.signature,
      `${entry.id}: the specialized control disappeared from ${entry.path}. ` +
        'UI-SPECIALIZED-CONTROL-CONTRACT-GAP must be closed by a component-contract ' +
        'order, never by deleting the control or its geometry.',
    );
  }
});

test('5 · no frozen specialized control is declared conforming by UIC-003', () => {
  const paths = new Set(SPECIALIZED_CONTROLS.map((e) => e.path));
  for (const p of paths) {
    assert.equal(
      BASELINE.findings.filter((f) => f.rule_id === 'UIC-003' && f.path === p).length,
      0,
      `${p} still reports UIC-003; a specialized control must be EXCLUDED, not measured.`,
    );
  }
  // Excluded is not ratified: the debt identifier must remain discoverable.
  assert.ok(SPECIALIZED_CONTROLS.length >= 21);
});

test('6 · the specialized inventory has not silently widened', () => {
  // A checkbox/radio/range or a textarea anywhere in the rendered runtime must
  // correspond to a frozen entry's file. A new specialized surface is a real
  // event that needs an architect ruling, not an automatic exemption.
  const known = new Set(SPECIALIZED_CONTROLS.map((e) => e.path));
  const offenders = [];
  for (const { rel, text } of RUNTIME) {
    const hasSpecial =
      /type:\s*'(checkbox|radio|range)'/.test(text) || /el\(\s*'textarea'/.test(text);
    if (hasSpecial && !known.has(rel)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'HARD STOP — SPECIALIZED-CONTROL INVENTORY EXPANDED: ' + offenders.join(', '),
  );
});

/* ============================================================
   3 · first-party runtime guard — the four required counters
   ============================================================ */

/** Tailwind height utilities that would make a class token the geometry owner. */
const TW_HEIGHT_RE = /(?<![\w-])(h-\d+(?:\.\d+)?|h-\[[^\]]*\]|min-h-\[[^\]]*\]|max-h-\[[^\]]*\]|min-h-\w+|max-h-\w+)/g;

/** Is this Tailwind height utility carried by a frozen specialized control? */
function isSpecializedUtility(rel, utility) {
  return SPECIALIZED_CONTROLS.some(
    (e) => e.path === rel && e.geometryOwner.includes(utility),
  );
}

test('7 · OUT_OF_LADDER_GENERIC_CONTROL_HEIGHT_COUNT = 0', () => {
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

test('8 · TAILWIND_GENERIC_CONTROL_HEIGHT_UTILITY_COUNT = 0', () => {
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
        // Carried by the frozen inventory in section 2, which asserts each one
        // is still present and still unratified.
        if (specialized) continue;
        if (isSpecializedUtility(rel, u)) continue;
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

test('9 · UNRESOLVED_GENERIC_CONTROL_ROLE_COUNT = 0', () => {
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

test('10 · GENERIC_CONTROL_HEIGHT_LITERAL_CONSTANT_COUNT = 0', () => {
  // A named constant may hold a canonical TOKEN; it may never hold a bare
  // literal that a generic control's height resolves through.
  const offenders = [];
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g;
  for (const { rel, text } of RUNTIME) {
    for (const m of text.matchAll(re)) {
      const [, name, value] = m;
      if (!/height/i.test(name)) continue;
      if (/TEXTAREA|MULTILINE|MIN_HEIGHT|MAX_HEIGHT/i.test(name)) continue; // specialized, inventoried
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

test('11 · the guard carries no path-only ignore list', () => {
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

test('12 · the three pagination current-page nodes are non-interactive indicators', () => {
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

test('13 · both cadastros price-row actions delegate to the canonical primitive', () => {
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

test('14 · the shared single-line field primitives own the canonical compact rung', () => {
  const ui = read('js/ui.js');
  assert.match(ui, /function textInput\(\{[\s\S]{0,900}?height:var\(--rv-h-compact\);/);
  assert.match(ui, /function selectInput\(\{[\s\S]{0,900}?height:var\(--rv-h-compact\);/);
  // Horizontal padding preserved, vertical padding removed so the fixed
  // border-box height cannot clip the value.
  assert.ok(!/w-full border px-3 py-2/.test(ui), 'py-2 still fights the explicit height');
  assert.match(ui, /w-full border px-3 focus:outline-none/);
});

test('15 · neither shared field primitive can build a specialized control', () => {
  const ui = read('js/ui.js');
  assert.match(ui, /function textInput\(\{ type = 'text'/);
  assert.match(ui, /const input = el\('input', attrs\)/);
  assert.match(ui, /const sel = el\('select', \{/);
  // Every type any consumer passes is a single-line field type.
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

test('16 · literal input type is transported, and only literally', () => {
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

test('17 · a factory-bound checkbox keeps its type when styled after construction', () => {
  const u = probe([
    "var chk = window.el('input', { type: 'checkbox', class: 'h-4 w-4' });",
    "chk.style.cssText = 'position:absolute;opacity:0;width:0;height:0;margin:0;';",
  ].join('\n'));
  const [h] = heightDecls(u);
  assert.equal(h.element.attrMap.get('type'), 'checkbox');
});

test('18 · the window.el binding amendment stays inside its authorized envelope', () => {
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

test('19 · no role, ancestry or interaction is inferred by either amendment', () => {
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

test('20 · an ordinary control outside the ladder is still rejected', () => {
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

test('21 · a specialized or hidden control is excluded, never reported', () => {
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

test('22 · a control merely dressed as a track or a hidden node is still rejected', () => {
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

test('23 · a canonical ladder value on a real control passes', () => {
  for (const token of LADDER_TOKENS) {
    assert.deepEqual(uic003Of(`el('button', { style: 'height:${token};' })`), [], token);
  }
  assert.deepEqual(uic003Of("el('input', { type: 'text', style: 'height:var(--rv-h-compact);' })"), []);
});

test('24 · comments and prose do not fire the rule', () => {
  assert.deepEqual(uic003Of("// height:40px on a button\n/* height:30px */\nvar s = 'height:40px';"), []);
});
