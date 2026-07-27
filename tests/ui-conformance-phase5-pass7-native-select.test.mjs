/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 7 (UIC-006)
   NATIVE SELECT → APPLICATION-OWNED SELECT POPOVER

   The product had 44 single-choice control sites: 15 native <select>
   constructions the detector can see inside js/screens/, and 29 call
   sites of the shared js/ui.js::selectInput(). js/ui.js itself is the
   IMPLEMENTATION OWNER, not a rendered site, so it is counted apart.

   43 of those 44 sites are now the canonical select popover. The 44th —
   Pedido's "Status inicial", which offered exactly one permanently
   disabled option — was never a selection decision and is now a static
   read-only field presentation.

   WHAT THIS SUITE OWNS: the population, the single owner, the value and
   event compatibility contract, the accessibility and keyboard contract,
   the portal/positioning ruling, the read-only treatment, and the exact
   detector delta. It does NOT re-derive passes 1–6; it asserts they are
   still closed.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { DETECTOR_VERSION } from '../scripts/ui-conformance/rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

const POPOVER_SRC = read('js/select-popover.js');
const UI_SRC = read('js/ui.js');
const TOKENS = read('css/tokens.css');
const INDEX = read('index.html');

/* ============================================================
   0 · the frozen 44-site inventory
   ============================================================ */

/** The 15 sites the detector reported as UIC-006 at the entry checkpoint. */
const DIRECT_SITES = [
  ['js/screens/admin-usuarios.js', 2],                      // FILTER_CONTROL ×2
  ['js/screens/cliente-pedido-form.js', 4],                 // FORM_FIELD, INLINE_EDITOR, MODAL_FIELD ×2
  ['js/screens/document-link-admin-modal.js', 1],           // MODAL_FIELD
  ['js/screens/documentos-recebidos-decision-modal.js', 1], // MODAL_FIELD
  ['js/screens/documentos-recebidos.js', 1],                // FILTER_CONTROL (selectControl)
  ['js/screens/ops-list.js', 1],                            // FILTER_CONTROL (buildSelect)
  ['js/screens/pedido-form.js', 2],                         // FORM_FIELD + READONLY_PRESENTATION
  ['js/screens/pedido-item-row-editor.js', 2],              // INLINE_EDITOR ×2
  ['js/screens/pedidos-list.js', 1],                        // FILTER_CONTROL (buildSelect)
];

/** The 29 selectInput() consumer sites, by file. */
const CONSUMER_SITES = [
  ['js/screens/admin-usuarios-modal.js', 4],
  ['js/screens/cadastros.js', 8],
  ['js/screens/entrega-form.js', 2],
  ['js/screens/expedicao-admin.js', 1],
  ['js/screens/op-nova.js', 4],
  ['js/screens/pedido-detail-events.js', 3],
  ['js/screens/pedido-edit.js', 1],
  ['js/screens/pedido-insumos-distribuicao.js', 1],
  ['js/screens/pedido-itens-edit.js', 2],
  ['js/screens/pedido-parciais-admin.js', 1],
  ['js/screens/pedido-tracking-admin.js', 2],
];

const DIRECT_COUNT = DIRECT_SITES.reduce((n, [, c]) => n + c, 0);
const CONSUMER_COUNT = CONSUMER_SITES.reduce((n, [, c]) => n + c, 0);

/** Every product runtime file index.html loads, in load order. */
function runtimeFiles() {
  const out = [];
  for (const m of INDEX.matchAll(/<script src="(js\/[^"?]+)/g)) out.push(m[1]);
  return out;
}

function countCalls(text, re) {
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const m = line.match(re);
    if (m) n += m.length;
  }
  return n;
}

test('1 · the population is exactly 15 direct + 29 shared consumers = 44 sites', () => {
  assert.equal(DIRECT_COUNT, 15, 'DIRECT_PRODUCT_SELECT_SITE_COUNT');
  assert.equal(CONSUMER_COUNT, 29, 'SELECTINPUT_CONSUMER_SITE_COUNT');
  assert.equal(DIRECT_COUNT + CONSUMER_COUNT, 44, 'TOTAL_PRODUCT_SELECT_SITE_COUNT');

  // The frozen per-file consumer counts must still hold in the tree.
  for (const [rel, expected] of CONSUMER_SITES) {
    const found = countCalls(read(rel), /(?:window\.)?selectInput\s*\(/g);
    assert.equal(found, expected, `${rel}: selectInput call sites`);
  }
  // And nothing outside the frozen list may call it.
  const listed = new Set(CONSUMER_SITES.map(([r]) => r));
  for (const rel of runtimeFiles()) {
    if (listed.has(rel) || rel === 'js/ui.js') continue;
    assert.equal(countCalls(read(rel), /(?:window\.)?selectInput\s*\(/g), 0,
      `${rel} calls selectInput but is not in the frozen inventory`);
  }
});

test('2 · 43 interactive sites and exactly one read-only presentation', () => {
  // The single read-only site: Pedido "Status inicial".
  const pedidoForm = read('js/screens/pedido-form.js');
  assert.match(pedidoForm, /createReadonlyFieldValue\(\{ text: 'Rascunho' \}\)/);
  assert.equal(countCalls(pedidoForm, /createReadonlyFieldValue\s*\(/g), 1);

  // No other product file may build a read-only field presentation.
  let readonlySites = 0;
  for (const rel of runtimeFiles()) {
    if (rel === 'js/select-popover.js') continue; // the owner DEFINES the helper
    readonlySites += countCalls(read(rel), /createReadonlyFieldValue\s*\(/g);
  }
  assert.equal(readonlySites, 1, 'READONLY_SELECT_PRESENTATION_SITE_COUNT');
  assert.equal(44 - readonlySites, 43, 'INTERACTIVE_SELECT_POPOVER_SITE_COUNT');
});

/* ============================================================
   1 · zero native selects, one owner
   ============================================================ */

test('3 · no product runtime file constructs, contains or hides a native select', () => {
  for (const rel of runtimeFiles().concat(['index.html'])) {
    const text = rel === 'index.html' ? INDEX : read(rel);
    const code = text.split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    assert.ok(!/el\(\s*'select'/.test(code), `${rel} constructs a native select`);
    assert.ok(!/createElement\(\s*'select'\s*\)/.test(code), `${rel} creates a native select`);
    assert.ok(!/<select\b/i.test(code), `${rel} carries native select markup`);
    assert.ok(!/el\(\s*'option'/.test(code), `${rel} constructs a native option`);
  }
});

test('4 · no hidden native value owner and no opacity-zero facade survives', () => {
  for (const rel of ['js/screens/ops-list.js', 'js/screens/pedidos-list.js']) {
    const text = read(rel);
    assert.ok(!/opacity:0;/.test(text), `${rel} still hides a control behind opacity:0`);
    assert.ok(!/buildSelectLike/.test(text), `${rel} still carries the facade helper`);
    assert.match(text, /createSelectPopover\(\{/);
  }
});

test('5 · exactly one select primitive owner exists', () => {
  assert.match(POPOVER_SRC, /globalWindow\.createSelectPopover = createSelectPopover;/);
  // No second definition anywhere in the runtime.
  let definitions = 0;
  for (const rel of runtimeFiles()) {
    definitions += countCalls(read(rel), /function createSelectPopover\s*\(/g);
  }
  assert.equal(definitions, 1, 'DUPLICATE_SELECT_PRIMITIVE_OWNER_COUNT must be 0');
  assert.match(INDEX, /js\/select-popover\.js/);
  assert.ok(INDEX.indexOf('js/select-popover.js') < INDEX.indexOf('js/ui.js'),
    'the owner must load before js/ui.js');
});

test('6 · selectInput is a thin adapter that delegates to the canonical owner', () => {
  assert.match(UI_SRC, /function selectInput\(\{[\s\S]{0,400}?createSelectPopover\(\{/);
  assert.ok(!/el\('select'/.test(UI_SRC));
  assert.ok(!/el\('option'/.test(UI_SRC));
  // formField binds its visible label to the generated trigger.
  assert.match(UI_SRC, /data-rv-select-popover[\s\S]{0,400}?aria-labelledby/);
});

test('7 · no third-party dependency, and the detector source is byte-identical', () => {
  assert.ok(!/require\(|import\s|from '/.test(POPOVER_SRC), 'the primitive pulled in a dependency');
  assert.ok(!/floating-ui|popper|tippy/i.test(POPOVER_SRC));

  // The strongest possible statement of "no detector change, no path-only
  // suppression": every detector source is byte-for-byte the entry version.
  const DETECTOR_SOURCES = [
    'scripts/validate-ui-conformance.mjs',
    'scripts/ui-conformance/contract.mjs',
    'scripts/ui-conformance/inventory.mjs',
    'scripts/ui-conformance/rules.mjs',
    'scripts/ui-conformance/frontends/dc-html.mjs',
    'scripts/ui-conformance/frontends/js-screen.mjs',
  ];
  for (const rel of DETECTOR_SOURCES) {
    const entry = execFileSync('git', ['show', `41655c6:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(read(rel).replace(/\r\n/g, '\n'), entry.replace(/\r\n/g, '\n'),
      `${rel} changed — the detector must be untouched`);
  }
});

/* ============================================================
   2 · detector semantics and the exact delta
   ============================================================ */

test('8 · the detector is unchanged at 1.0.6 and UIC-006 reaches zero', () => {
  assert.equal(DETECTOR_VERSION, '1.0.6');
  assert.equal(BASELINE.detector_version, '1.0.6');
  assert.equal(rule('UIC-006').blocking, 0);
  assert.equal(rule('UIC-006').total, 0);
});

test('9 · the UIC-006 delta is exactly 15 removed / 0 added', () => {
  const entry = JSON.parse(
    execFileSync('git', ['show', '41655c6:tests/fixtures/ui-conformance-baseline.json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }),
  );
  const key = (f) => `${f.path}|${f.line}|${f.column}`;
  const before = entry.findings.filter((f) => f.rule_id === 'UIC-006').map(key);
  const after = BASELINE.findings.filter((f) => f.rule_id === 'UIC-006').map(key);
  assert.equal(before.length, 15, 'the entry state must carry 15 UIC-006 findings');
  assert.equal(after.length, 0, 'UIC-006 must be empty');
  const added = after.filter((k) => !before.includes(k));
  assert.deepEqual(added, [], 'no UIC-006 finding may be added');

  // Per-file removal, so the 15 are accounted for site by site.
  const byFile = {};
  for (const f of entry.findings.filter((x) => x.rule_id === 'UIC-006')) {
    byFile[f.path] = (byFile[f.path] || 0) + 1;
  }
  assert.deepEqual(byFile, Object.fromEntries(DIRECT_SITES));
});

test('10 · every other blocking rule stays closed and the debt is untouched', () => {
  for (const id of ['UIC-001', 'UIC-002', 'UIC-003', 'UIC-004', 'UIC-005',
    'UIC-007', 'UIC-008', 'UIC-010', 'UIC-011']) {
    assert.equal(rule(id).blocking, 0, `${id} must stay at zero blocking`);
    assert.equal(rule(id).total, 0, `${id} must stay empty`);
  }
  // SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION. B1 moved the specialized
  // controls' inline styles into css/tokens.css, which the detector does not
  // read, so nine UIC-000 coverage gaps and two UIC-009 references stopped
  // existing as JavaScript declarations: 867 -> 856, coverage 545 -> 536,
  // debt 322 -> 320. B1 ADDED no finding to any rule.
  assert.equal(rule('UIC-009').debt, 320, 'the deprecated-token debt must not move');
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
});

test('11 · the detector violation fixture still produces UIC-006', () => {
  const fixture = read('tests/fixtures/ui-conformance/violations-screen.js');
  assert.match(fixture, /el\('select'/, 'the deliberate fixture select was removed');
});

/* ============================================================
   3 · tokens, layering and the visual contract
   ============================================================ */

test('12 · the two canonical tokens exist with the ratified values and order', () => {
  assert.match(TOKENS, /--rv-z-popover:\s*225;/);
  assert.match(TOKENS, /--rv-select-popover-max-h:\s*320px;/);
  assert.match(TOKENS, /--rv-z-modal:\s*200;/);
  assert.match(TOKENS, /--rv-z-toast:\s*250;/);
  const z = (n) => Number(TOKENS.match(new RegExp(`--rv-z-${n}:\\s*(\\d+);`))[1]);
  assert.ok(z('modal') < z('popover') && z('popover') < z('toast'),
    'layer order must be modal < select popover < toast');
});

test('13 · the trigger, panel and item carry the ratified visual contract', () => {
  // Trigger
  assert.match(POPOVER_SRC, /height:var\(--rv-h-compact\)/);
  assert.match(POPOVER_SRC, /border:1px solid var\(--rv-border-strong\)/);
  assert.match(POPOVER_SRC, /background:var\(--rv-surface\)/);
  assert.match(POPOVER_SRC, /border-radius:var\(--rv-radius\)/);
  assert.match(POPOVER_SRC, /font-size:var\(--rv-fs-body\)/);
  assert.match(POPOVER_SRC, /color:var\(--rv-text-primary\)/);
  assert.match(POPOVER_SRC, /padding-left:12px; padding-right:12px;/);
  assert.match(POPOVER_SRC, /padding-top:0; padding-bottom:0;/);
  assert.match(POPOVER_SRC, /text-align:left/);
  // Focus ring and hover
  assert.match(POPOVER_SRC, /0 0 0 3px var\(--rv-focus-ring\)/);
  assert.match(POPOVER_SRC, /background = 'var\(--rv-surface-subtle\)'/);
  assert.match(POPOVER_SRC, /borderColor = 'var\(--rv-accent-blue\)'/);
  // Placeholder
  assert.match(POPOVER_SRC, /'var\(--rv-text-tertiary\)'/);
  // Panel
  assert.match(POPOVER_SRC, /box-shadow:var\(--rv-shadow-popover\)/);
  assert.match(POPOVER_SRC, /padding:5px/);
  assert.match(POPOVER_SRC, /z-index:var\(--rv-z-popover\)/);
  assert.match(POPOVER_SRC, /max-height:var\(--rv-select-popover-max-h\)/);
  assert.match(POPOVER_SRC, /PANEL_GAP = 6/);
  // Item
  assert.match(POPOVER_SRC, /padding:7px 8px/);
  // Selected
  assert.match(POPOVER_SRC, /background = 'var\(--rv-active-bg\)'/);
  assert.match(POPOVER_SRC, /color = 'var\(--rv-brand\)'/);
  assert.match(POPOVER_SRC, /width="13" height="13"/, 'the selected check must be a 13px svg');
  assert.match(POPOVER_SRC, /width="14" height="14"/, 'the chevron must be 14px');
});

test('14 · no search box, no grouping, no multi-selection', () => {
  assert.ok(!/createElement\('input'\)/.test(POPOVER_SRC), 'SEARCHABLE_SELECT_COUNT must be 0');
  assert.ok(!/optgroup/i.test(POPOVER_SRC), 'GROUPED_SELECT_COUNT must be 0');
  assert.ok(!/multiple/i.test(POPOVER_SRC), 'MULTISELECT_COUNT must be 0');
  // And no emoji or textual checkmark.
  assert.ok(!/[\u2713\u2714\u2705]/.test(POPOVER_SRC), 'a textual checkmark was used');
});

test('15 · the panel is portaled to body and positioned fixed, without a library', () => {
  assert.match(POPOVER_SRC, /position:fixed/);
  assert.match(POPOVER_SRC, /doc\.body[\s\S]{0,80}?appendChild\(panel\)/);
  assert.match(POPOVER_SRC, /VIEWPORT_MARGIN = 8/);
  assert.match(POPOVER_SRC, /getBoundingClientRect/);
  assert.match(POPOVER_SRC, /'resize'/);
  assert.match(POPOVER_SRC, /'scroll'/);
});

test('16 · the primitive emulates no HTMLSelectElement protocol', () => {
  // Comments may NAME the protocol they refuse to implement; the code may not.
  const code = POPOVER_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  for (const forbidden of ['selectedIndex', '.options[', 'replaceChildren(option', '.add(', '.remove(option']) {
    assert.ok(!code.includes(forbidden), `the primitive emulates ${forbidden}`);
  }
  // Dynamic callers repopulate through setOptions, never through option nodes.
  for (const rel of ['js/screens/pedido-item-row-editor.js', 'js/screens/cliente-pedido-form.js',
    'js/screens/document-link-admin-modal.js', 'js/screens/documentos-recebidos-decision-modal.js']) {
    const text = read(rel);
    assert.match(text, /\.setOptions\(/, `${rel} must repopulate through setOptions`);
    assert.ok(!/\.selected = true/.test(text), `${rel} still sets option.selected`);
  }
});

/* ============================================================
   4 · runtime behaviour, driven through the real primitive
   ============================================================ */

class Style {
  constructor() { this.cssText = ''; }
}

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._attrs = {};
    this._listeners = {};
    this._text = null;
    this.parentNode = null;
    this.style = new Style();
    this.id = '';
    this._rect = null;
  }
  setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  appendChild(n) { this.children.push(n); if (n && typeof n === 'object') n.parentNode = this; return n; }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); return n; }
  replaceChildren(...ns) { this.children = []; for (const n of ns.flat()) if (n != null) this.appendChild(n); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); this.parentNode = null; }
  contains(n) {
    if (n === this) return true;
    return this.children.some((c) => c === n || (c && typeof c.contains === 'function' && c.contains(n)));
  }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n.tagName === 'BODY'; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    const l = this._listeners[t]; if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  }
  dispatchEvent(ev) {
    let node = this;
    ev.target = ev.target || this;
    while (node) {
      ev.currentTarget = node;
      const l = node._listeners[ev.type];
      if (l) for (const fn of l.slice()) fn.call(node, ev);
      node = ev.bubbles ? node.parentNode : null;
    }
    return true;
  }
  focus() { this._focused = true; }
  getBoundingClientRect() {
    const r = this._rect || { top: 100, left: 100, width: 220, height: 32 };
    return { ...r, bottom: r.top + r.height, right: r.left + r.width };
  }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html || ''; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => (c && c.textContent) || '').join('');
  }
  set textContent(v) { this._text = String(v); this.children = []; }
}

function makeEnv({ innerWidth = 1440, innerHeight = 900 } = {}) {
  const body = new Node('body');
  const docListeners = {};
  const winListeners = {};
  const document = {
    body,
    createElement: (t) => new Node(t),
    addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => {
      const l = docListeners[t]; if (!l) return;
      const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
    },
    _listeners: docListeners,
  };
  const window = {
    document, innerWidth, innerHeight,
    Event: class { constructor(type, o = {}) { this.type = type; this.bubbles = !!o.bubbles; } },
    addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => {
      const l = winListeners[t]; if (!l) return;
      const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
    },
    _listeners: winListeners,
  };
  window.window = window;
  document.defaultView = window;
  const sandbox = { window, document, console };
  vm.createContext(sandbox);
  vm.runInContext(POPOVER_SRC, sandbox, { filename: 'js/select-popover.js' });
  return { sandbox, document, window, body };
}

function makeControl(env, cfg = {}) {
  const create = env.sandbox.window.createSelectPopover;
  const control = create({
    options: [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Bravo' },
      { value: 'c', label: 'Charlie', disabled: true },
    ],
    value: 'a',
    document: env.document,
    window: env.window,
    ...cfg,
  });
  env.body.appendChild(control);
  return control;
}

const panelOf = (env) => env.body.children.find((n) => n.getAttribute && n.getAttribute('role') === 'listbox');
const optionsOf = (env) => (panelOf(env) ? panelOf(env).children : []);
const key = (control, k, extra = {}) => {
  const ev = { type: 'keydown', key: k, preventDefault() { this.defaultPrevented = true; }, defaultPrevented: false, ...extra };
  // The capturing document handler owns the open state, exactly as in a browser.
  const docHandlers = (control.ownerEnv.document._listeners.keydown || []).slice();
  for (const fn of docHandlers) fn(ev);
  const own = (control._listeners.keydown || []).slice();
  for (const fn of own) fn(ev);
  return ev;
};

function control(env, cfg) {
  const c = makeControl(env, cfg);
  c.ownerEnv = env;
  return c;
}

test('17 · the trigger is a named button combobox with the full ARIA contract', () => {
  const env = makeEnv();
  const c = control(env, { ariaLabel: 'Filtro' });
  assert.equal(c.tagName, 'BUTTON');
  assert.equal(c.getAttribute('type'), 'button');
  assert.equal(c.getAttribute('role'), 'combobox');
  assert.equal(c.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(c.getAttribute('aria-expanded'), 'false');
  assert.ok(c.getAttribute('aria-controls'), 'the trigger must point at its panel');
  assert.equal(c.getAttribute('aria-label'), 'Filtro');

  c.open();
  assert.equal(c.getAttribute('aria-expanded'), 'true');
  const panel = panelOf(env);
  assert.equal(panel.getAttribute('role'), 'listbox');
  assert.equal(panel.id, c.getAttribute('aria-controls'));
  for (const o of optionsOf(env)) {
    assert.equal(o.getAttribute('role'), 'option');
    assert.ok(o.getAttribute('aria-selected') === 'true' || o.getAttribute('aria-selected') === 'false');
  }
  assert.equal(optionsOf(env)[2].getAttribute('aria-disabled'), 'true');
  c.close();
  assert.equal(c.getAttribute('aria-expanded'), 'false');
  assert.equal(panelOf(env), undefined, 'the panel must be removed on close');
});

test('18 · labelledBy names the trigger and no trigger is left unnamed', () => {
  const env = makeEnv();
  const c = control(env, { ariaLabel: undefined, labelledBy: 'caption-1' });
  assert.equal(c.getAttribute('aria-labelledby'), 'caption-1');
  assert.equal(c.getAttribute('aria-label'), null);
});

test('19 · aria-activedescendant tracks the active option and DOM focus stays put', () => {
  const env = makeEnv();
  const c = control(env);
  c.open();
  const opts = optionsOf(env);
  assert.equal(c.getAttribute('aria-activedescendant'), opts[0].id, 'the selected option starts active');
  key(c, 'ArrowDown');
  assert.equal(c.getAttribute('aria-activedescendant'), opts[1].id);
  // Disabled Charlie is skipped and navigation wraps to Alpha.
  key(c, 'ArrowDown');
  assert.equal(c.getAttribute('aria-activedescendant'), opts[0].id);
  for (const o of opts) assert.ok(!o._focused, 'DOM focus must never move into an option');
  c.close();
  assert.equal(c.getAttribute('aria-activedescendant'), null);
});

test('20 · Home/End reach the first and last ENABLED option', () => {
  const env = makeEnv();
  const c = control(env);
  c.open();
  const opts = optionsOf(env);
  key(c, 'End');
  assert.equal(c.getAttribute('aria-activedescendant'), opts[1].id, 'Charlie is disabled, so Bravo is last');
  key(c, 'Home');
  assert.equal(c.getAttribute('aria-activedescendant'), opts[0].id);
  c.close();
});

test('21 · ArrowDown/ArrowUp open from the closed state at the right end', () => {
  const env = makeEnv();
  // No placeholder and no matching value: nothing is selected, so the
  // "otherwise first/last ENABLED option" branch is the one under test.
  const c = control(env, { value: '', placeholder: '' });
  key(c, 'ArrowUp');
  assert.equal(c.getAttribute('aria-expanded'), 'true');
  assert.equal(c.getAttribute('aria-activedescendant'), optionsOf(env)[1].id,
    'ArrowUp from closed activates the last ENABLED option — Charlie is disabled');
  c.close();

  key(c, 'ArrowDown');
  assert.equal(c.getAttribute('aria-expanded'), 'true');
  assert.equal(c.getAttribute('aria-activedescendant'), optionsOf(env)[0].id,
    'ArrowDown from closed activates the first enabled option');
  c.close();

  // With a real selection, both keys open ON the selected option.
  const sel = control(env, { value: 'b', placeholder: '' });
  key(sel, 'ArrowUp');
  assert.equal(sel.getAttribute('aria-activedescendant'), optionsOf(env)[1].id);
  sel.close();
});

test('22 · Enter and Space open when closed and commit when open', () => {
  const env = makeEnv();
  for (const k of ['Enter', ' ']) {
    const c = control(env, { value: 'a' });
    let changes = 0;
    c.addEventListener('change', () => { changes += 1; });
    key(c, k);
    assert.equal(c.getAttribute('aria-expanded'), 'true', `${k} must open`);
    key(c, 'ArrowDown');
    key(c, k);
    assert.equal(c.getAttribute('aria-expanded'), 'false', `${k} must commit and close`);
    assert.equal(c.value, 'b');
    assert.equal(changes, 1, `${k} must emit exactly one change`);
  }
});

test('23 · Escape closes without a change and keeps focus on the trigger', () => {
  const env = makeEnv();
  const c = control(env);
  let changes = 0;
  c.addEventListener('change', () => { changes += 1; });
  c.open();
  key(c, 'ArrowDown');
  key(c, 'Escape');
  assert.equal(c.getAttribute('aria-expanded'), 'false');
  assert.equal(c.value, 'a', 'Escape must not commit the active option');
  assert.equal(changes, 0);
  assert.equal(c._focused, true, 'Escape returns focus to the trigger');
});

test('24 · Tab closes without a change and does not trap focus', () => {
  const env = makeEnv();
  const c = control(env);
  let changes = 0;
  c.addEventListener('change', () => { changes += 1; });
  c.open();
  key(c, 'ArrowDown');
  const ev = key(c, 'Tab');
  assert.equal(c.getAttribute('aria-expanded'), 'false');
  assert.equal(c.value, 'a');
  assert.equal(changes, 0);
  assert.equal(ev.defaultPrevented, false, 'Tab must continue normal navigation');
});

test('25 · type-ahead matches by prefix and resets after 700ms', async () => {
  const env = makeEnv();
  const c = control(env);
  c.open();
  key(c, 'b');
  assert.equal(c.getAttribute('aria-activedescendant'), optionsOf(env)[1].id, 'b → Bravo');
  // "a" inside the SAME buffer window looks for "ba" and finds nothing.
  key(c, 'a');
  assert.equal(c.getAttribute('aria-activedescendant'), optionsOf(env)[1].id, 'ba matches nothing, active is kept');
  await new Promise((r) => setTimeout(r, 720));
  key(c, 'a');
  assert.equal(c.getAttribute('aria-activedescendant'), optionsOf(env)[0].id,
    'after the 700ms reset, a → Alpha');
  c.close();
});

test('26 · a disabled option can never be committed or reached by type-ahead', () => {
  const env = makeEnv();
  const c = control(env);
  let changes = 0;
  c.addEventListener('change', () => { changes += 1; });
  c.open();
  key(c, 'c');
  assert.notEqual(c.getAttribute('aria-activedescendant'), optionsOf(env)[2].id,
    'type-ahead must skip a disabled option');
  // A direct click on the disabled option is not even wired.
  assert.equal(optionsOf(env)[2]._listeners.click, undefined);
  c.close();
  assert.equal(c.value, 'a');
  assert.equal(changes, 0);
});

test('27 · a user commitment emits exactly one bubbling change; re-selecting emits none', () => {
  const env = makeEnv();
  const c = control(env);
  let onControl = 0;
  let onBody = 0;
  c.addEventListener('change', () => { onControl += 1; });
  env.body.addEventListener('change', () => { onBody += 1; });

  c.open();
  optionsOf(env)[1]._listeners.click[0]();
  assert.equal(c.value, 'b');
  assert.equal(onControl, 1, 'exactly one change on the control');
  assert.equal(onBody, 1, 'the change must bubble');

  c.open();
  optionsOf(env)[1]._listeners.click[0]();
  assert.equal(onControl, 1, 're-selecting the current value emits nothing');
});

test('28 · programmatic value and setOptions never emit, and update the visible label', () => {
  const env = makeEnv();
  const c = control(env);
  let changes = 0;
  c.addEventListener('change', () => { changes += 1; });

  c.value = 'b';
  assert.equal(c.value, 'b');
  assert.equal(c.textContent, 'Bravo', 'the visible label follows a programmatic write');
  assert.equal(changes, 0);

  c.setValue('a');
  assert.equal(c.value, 'a');
  assert.equal(changes, 0);

  c.setOptions([{ value: 'a', label: 'Alpha 2' }, { value: 'z', label: 'Zulu' }]);
  assert.equal(c.value, 'a', 'an equivalent option survives repopulation');
  assert.equal(c.textContent, 'Alpha 2');
  assert.equal(changes, 0, 'setOptions alone must not emit');

  c.setOptions([{ value: 'z', label: 'Zulu' }]);
  assert.equal(c.value, '', 'a removed current option resets the value');
  assert.equal(changes, 0);
});

test('29 · values are strings, null/undefined normalize, and numerics stay tolerant', () => {
  const env = makeEnv();
  const create = env.sandbox.window.createSelectPopover;
  const c = create({
    options: [{ value: '1.40', label: '1,40 m' }, { value: 2, label: '2 m' }],
    value: 1.4,
    document: env.document,
    window: env.window,
  });
  assert.strictEqual(c.value, '1.40', 'numeric 1.4 must resolve to the "1.40" option');
  c.value = 2;
  assert.strictEqual(c.value, '2', 'values are exposed as strings');
  c.value = null;
  assert.strictEqual(c.value, '', 'null normalizes to the empty state');
  c.value = 'nope';
  assert.strictEqual(c.value, '', 'an unmatched value resolves to the empty state');
});

test('30 · outside click closes without a change and does not steal focus', () => {
  const env = makeEnv();
  const c = control(env);
  let changes = 0;
  c.addEventListener('change', () => { changes += 1; });
  c.open();
  const elsewhere = new Node('input');
  env.body.appendChild(elsewhere);
  for (const fn of env.document._listeners.mousedown) fn({ type: 'mousedown', target: elsewhere });
  assert.equal(c.getAttribute('aria-expanded'), 'false');
  assert.equal(c.value, 'a');
  assert.equal(changes, 0);
  assert.ok(!c._focused, 'the clicked destination keeps focus');
});

test('31 · only one popover may be open globally', () => {
  const env = makeEnv();
  const a = control(env);
  const b = control(env);
  a.open();
  b.open();
  assert.equal(a.getAttribute('aria-expanded'), 'false', 'opening the second closes the first');
  assert.equal(b.getAttribute('aria-expanded'), 'true');
  const panels = env.body.children.filter((n) => n.getAttribute && n.getAttribute('role') === 'listbox');
  assert.equal(panels.length, 1, 'DUPLICATE_OPEN_SELECT_POPOVER_COUNT must be 0');
  b.close();
});

test('32 · the panel opens below by default and above when below is insufficient', () => {
  const env = makeEnv({ innerHeight: 400 });
  const c = control(env);
  c._rect = { top: 40, left: 20, width: 200, height: 32 };
  c.open();
  assert.equal(panelOf(env).getAttribute('data-rv-select-placement'), 'below');
  c.close();

  // Near the bottom edge, with more room above, it flips.
  c._rect = { top: 360, left: 20, width: 200, height: 32 };
  const panelHeight = 200;
  c.open();
  const panel = panelOf(env);
  panel._rect = { top: 0, left: 0, width: 200, height: panelHeight };
  for (const fn of env.window._listeners.resize) fn({ type: 'resize' });
  assert.equal(panel.getAttribute('data-rv-select-placement'), 'above');
  c.close();
});

test('33 · the panel stays inside the viewport and is never narrower than the trigger', () => {
  const env = makeEnv({ innerWidth: 500, innerHeight: 400 });
  const c = control(env);
  c._rect = { top: 100, left: 460, width: 220, height: 32 };
  c.open();
  const panel = panelOf(env);
  panel._rect = { top: 0, left: 0, width: 220, height: 100 };
  for (const fn of env.window._listeners.resize) fn({ type: 'resize' });
  const left = Number(panel.style.left.replace('px', ''));
  const top = Number(panel.style.top.replace('px', ''));
  assert.ok(left >= 8, `panel left ${left} must respect the 8px margin`);
  assert.ok(left + 220 <= 500 - 8 + 0.001, 'the panel must not overflow the right edge');
  assert.ok(top >= 8, 'the panel must respect the top margin');
  assert.equal(panel.style.minWidth, '220px', 'the panel may never be narrower than the trigger');
  c.close();
});

test('34 · a disconnected trigger takes its panel with it — no orphan survives', () => {
  const env = makeEnv();
  const c = control(env);
  c.open();
  assert.ok(panelOf(env), 'the panel is open');
  c.remove();
  for (const fn of env.window._listeners.scroll) fn({ type: 'scroll' });
  assert.equal(panelOf(env), undefined, 'the orphan panel must be removed');
  assert.equal(c.getAttribute('aria-expanded'), 'false');
});

test('35 · destroy() closes, unbinds and leaves no panel behind', () => {
  const env = makeEnv();
  const c = control(env);
  c.open();
  c.destroy();
  assert.equal(panelOf(env), undefined);
  assert.equal(env.document._listeners.mousedown.length, 0, 'document listeners must be released');
  assert.equal(env.window._listeners.resize.length, 0, 'window listeners must be released');
});

test('36 · a disabled control cannot open and closes immediately if disabled while open', () => {
  const env = makeEnv();
  const c = control(env);
  c.disabled = true;
  assert.equal(c.disabled, true);
  assert.equal(c.hasAttribute('disabled'), true);
  assert.equal(c.style.opacity, '.45');
  assert.equal(c.style.cursor, 'default');
  c.open();
  assert.equal(panelOf(env), undefined, 'a disabled control must not open');

  c.disabled = false;
  c.open();
  assert.ok(panelOf(env));
  c.disabled = true;
  assert.equal(panelOf(env), undefined, 'disabling while open must close the popup');
});

test('37 · a modal-owned or scroll-container-owned site cannot be clipped by its owner', () => {
  // The panel is portaled to body, so its parent is never the modal card or a
  // scrolling grid — that is the whole reason for the portal ruling.
  const env = makeEnv();
  const modalCard = new Node('div');
  modalCard.style.overflow = 'hidden';
  env.body.appendChild(modalCard);
  const c = env.sandbox.window.createSelectPopover({
    options: [{ value: 'a', label: 'Alpha' }],
    value: 'a', document: env.document, window: env.window,
  });
  modalCard.appendChild(c);
  c.ownerEnv = env;
  c.open();
  const panel = panelOf(env);
  assert.ok(panel, 'the panel must be a direct child of body');
  assert.equal(panel.parentNode, env.body);
  assert.ok(!modalCard.contains(panel), 'the panel must not live inside the clipping owner');
  c.close();
});

/* ============================================================
   5 · the read-only Status treatment
   ============================================================ */

test('38 · the read-only field exposes no combobox semantics, popup or tab stop', () => {
  const env = makeEnv();
  const node = env.sandbox.window.createReadonlyFieldValue({
    text: 'Rascunho', document: env.document, window: env.window,
  });
  assert.notEqual(node.tagName, 'BUTTON', 'a read-only field is not a control');
  assert.equal(node.getAttribute('role'), null, 'no combobox role');
  assert.equal(node.getAttribute('aria-haspopup'), null, 'no popup');
  assert.equal(node.getAttribute('tabindex'), null, 'no tab stop');
  assert.equal(node.getAttribute('data-rv-select-popover'), null);
  assert.equal(node.textContent, 'Rascunho', 'the value stays visible');
  assert.match(node.getAttribute('style'), /height:var\(--rv-h-compact\)/,
    'the compact field geometry is preserved');
  assert.equal(typeof node.open, 'undefined', 'a read-only field cannot be opened');
});

test('39 · the Pedido status payload and business state are untouched', () => {
  const text = read('js/screens/pedido-form.js');
  // The screen never read the old control's value, and still writes rascunho.
  assert.ok(!/statusSelect\.value/.test(text), 'the screen must not read the read-only field');
  assert.match(text, /data-pedido-status-readonly/);
});

/* ============================================================
   6 · passes 1–6 remain closed
   ============================================================ */

test('40 · passes 1 through 6 are still closed and the contract hash is unchanged', () => {
  assert.equal(rule('UIC-001').total, 0, 'pass 1 (colour) reopened');
  assert.equal(rule('UIC-002').total, 0, 'pass 2 (radius) reopened');
  assert.equal(rule('UIC-010').total, 0, 'pass 2 (semantic pill radius) reopened');
  assert.equal(rule('UIC-003').total, 0, 'pass 3 (control height) reopened');
  assert.equal(rule('UIC-004').total, 0, 'pass 4 (shadow) reopened');
  assert.equal(rule('UIC-008').total, 0, 'pass 5 (card actions) reopened');
  assert.equal(rule('UIC-005').total, 0, 'pass 6 (typography) reopened');
  // Pass 7 changes no typography or radius enum.
  assert.equal(BASELINE.contract_blob_hash,
    'dbb686c85a4cd0c96d9ca857738f4081460b2e56e94289f5d56d19f21cc732ac',
    'the §5 contract enums changed');
});

test('41 · the Pass-3 forward correction is recorded and its guards still bind', () => {
  const pass3 = read('tests/ui-conformance-phase5-pass3-control-height.test.mjs');
  assert.match(pass3, /PASS-3-CONTROL-HEIGHT-GUARD-FORWARD-CORRECTION-A1/);
  // The corrected guards assert ownership, not source shape.
  assert.match(pass3, /selectInput remains the shared compatibility entry point/);
  assert.match(pass3, /createSelectPopover/);
  assert.match(pass3, /the canonical select-popover TRIGGER owns the compact rung/i);
  // The two obsolete source-shape ASSERTIONS are gone. The record may still
  // quote them in prose — §16 requires the correction to be stated — so this
  // looks for the assertion, not the phrase.
  const assertions = pass3.split(/\r?\n/).filter((l) => /^\s*assert\./.test(l)).join('\n');
  assert.ok(!/const sel = el/.test(assertions),
    'the obsolete `const sel = el(select)` assertion is still binding');
  assert.ok(!/selectInput[\s\S]{0,40}\{0,900\}\?height:var/.test(assertions),
    'the obsolete selectInput height-shape assertion is still binding');
});

test('42 · the cache token was applied to exactly the changed runtime assets', () => {
  const TOKEN = '20260727-ui-p5-pass7-native-select-a1';
  const changed = [
    'js/select-popover.js',
    'js/screens/document-link-admin-modal.js',
    'js/screens/documentos-recebidos-decision-modal.js', 'js/screens/documentos-recebidos.js',
    'js/screens/ops-list.js',
    'js/screens/pedido-item-row-editor.js', 'js/screens/pedidos-list.js',
  ];
  /*
   * PASS-8-TABLE-CONTRACT-FORWARD-CORRECTION
   *
   * Phase-5 pass 8 changed js/ui.js (the dataTable() width and numeric
   * contract), js/screens/admin-usuarios.js and js/screens/cliente-pedido-form.js
   * (their tables' scroll owners), so all three moved on to the pass-8 token. A
   * pass-8 token is strictly LATER than the pass-7 one, so pass 7's invariant —
   * every asset it changed is invalidated against the pass-6 checkpoint — is
   * intact. The population is still eleven; only which later token invalidates
   * three of them moved.
   */
  const PASS8 = '20260727-ui-p5-pass8-table-r1';
  const CHANGED_BY_PASS7_THEN_PASS8 = [];
  /*
   * ACTION-CONTAINMENT-A1 FORWARD CORRECTION
   *
   * js/ui.js became the owner of the modal action bar, the page-header action
   * group and the table-row action column, and cliente-pedido-form.js became a
   * consumer of that owner, so both moved on once more. A containment token is
   * strictly LATER than a pass-8 one, so pass 7's invariant is intact: every
   * asset it changed is still invalidated against the pass-6 checkpoint. The
   * population is still eleven; only which later token invalidates two of them
   * moved.
   */
  const CONTAINMENT_A1 = '20260727-ui-action-containment-a1';
  const CHANGED_BY_PASS7_THEN_CONTAINMENT_A1 = [];
  /*
   * SPECIALIZED-CONTROLS-B1 FORWARD CORRECTION
   *
   * B1 made js/ui.js the owner of the five role-specific control
   * primitives and migrated the checkbox in admin-usuarios.js and the
   * three textareas in cliente-pedido-form.js and pedido-form.js, so four
   * of the pass-7 assets moved on once more. A B1 token is strictly LATER
   * than a pass-7, pass-8 or containment one, so pass 7's invariant is
   * intact: every asset it changed is still invalidated against the
   * pass-6 checkpoint. The population is still eleven; only which later
   * token invalidates four of them moved.
   */
  const B1 = '20260727-ui-specialized-controls-b1';
  const CHANGED_BY_PASS7_THEN_B1 = [
    'js/ui.js', 'js/screens/admin-usuarios.js',
    'js/screens/cliente-pedido-form.js', 'js/screens/pedido-form.js',
  ];
  assert.equal(changed.length + CHANGED_BY_PASS7_THEN_PASS8.length
    + CHANGED_BY_PASS7_THEN_CONTAINMENT_A1.length + CHANGED_BY_PASS7_THEN_B1.length, 11,
    'the pass-7 changed-asset population must stay eleven');
  for (const rel of changed) {
    assert.ok(INDEX.includes(`${rel}?v=${TOKEN}`), `${rel} must carry the pass-7 token`);
  }
  for (const rel of CHANGED_BY_PASS7_THEN_PASS8) {
    assert.ok(INDEX.includes(`${rel}?v=${PASS8}`), `${rel} must carry the later pass-8 token`);
    assert.ok(!INDEX.includes(`${rel}?v=20260726-ui-p5-pass6`), `${rel} fell back to a pass-6 token`);
  }
  for (const rel of CHANGED_BY_PASS7_THEN_CONTAINMENT_A1) {
    assert.ok(INDEX.includes(`${rel}?v=${CONTAINMENT_A1}`),
      `${rel} must carry the later action-containment A1 token`);
    assert.ok(!INDEX.includes(`${rel}?v=20260726-ui-p5-pass6`), `${rel} fell back to a pass-6 token`);
  }
  for (const rel of CHANGED_BY_PASS7_THEN_B1) {
    assert.ok(INDEX.includes(`${rel}?v=${B1}`),
      `${rel} must carry the later specialized-controls B1 token`);
    assert.ok(!INDEX.includes(`${rel}?v=20260726-ui-p5-pass6`), `${rel} fell back to a pass-6 token`);
  }
  // B1 changed the token stylesheet again, so it carries the later B1 token.
  assert.match(INDEX, new RegExp(`css/tokens\\.css\\?v=${B1}`));
  // Unchanged assets keep their prior token.
  assert.match(INDEX, /js\/badges\.js\?v=20260726-ui-p5-pass2-a4/);
  assert.match(INDEX, /js\/calculo-op\.js\?v=20260623-asset1/);
});
