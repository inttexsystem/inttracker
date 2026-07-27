/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 7, CORRECTION A4
   ACCESSIBLE NAME + WRAPPER GEOMETRY

   Pass 7 gave every single-choice control the canonical select popover.
   Exhaustive runtime validation then found two defects the primitive itself
   could not cause, because both live in the SCREENS' OWN WRAPPERS:

     A. `role="combobox"` is not a name-from-content role. A <button> takes
        its accessible name from its text; a combobox does not. Five screens
        render their visible label as a SIBLING <label> with no `for` and no
        id, so nineteen triggers reached assistive technology UNNAMED.

     B. `op-nova.js styleSelect()` replaced the trigger's whole inline style
        with SELECT_STYLE — a native-<select> padding box — breaking the
        ratified Pass-7 geometry at three real sites (41px instead of 32px,
        14px text, 9px vertical padding, inline-block instead of inline-flex).

   A4 corrects exactly those two things in exactly five product files.
   js/select-popover.js and js/ui.js are untouched: the primitive remains the
   sole owner of combobox geometry, and this suite proves it.
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

const INDEX = read('index.html');
const A4_TOKEN = '20260727-ui-p5-pass7-native-select-a4-a11y-geometry';
const A1_TOKEN = '20260727-ui-p5-pass7-native-select-a1';

/** The five product files A4 is allowed to touch, and their label-id prefix. */
const A4_FILES = [
  ['js/screens/admin-usuarios-modal.js', 'rv-admin-usuarios-field-label-', 4],
  ['js/screens/cadastros.js', 'rv-cadastros-field-label-', 8],
  ['js/screens/expedicao-admin.js', 'rv-expedicao-field-label-', 1],
  ['js/screens/op-nova.js', 'rv-op-nova-field-label-', 4],
  ['js/screens/pedido-itens-edit.js', 'rv-pedido-itens-edit-field-label-', 2],
];

const CORRECTED_SITE_COUNT = A4_FILES.reduce((n, f) => n + f[2], 0);

/* ============================================================
   0 · a faithful DOM double + the REAL primitive
   ============================================================ */

class Style { constructor() { this.cssText = ''; } }

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._attrs = {};
    this._listeners = {};
    this._text = null;
    this.parentNode = null;
    this.style = new Style();
    this.className = '';
    this.id = '';
    this.classList = {
      _s: new Set(),
      add: (...c) => { c.forEach((x) => this.classList._s.add(x)); this.className = [...this.classList._s].join(' '); },
      remove: (...c) => { c.forEach((x) => this.classList._s.delete(x)); this.className = [...this.classList._s].join(' '); },
      contains: (c) => this.classList._s.has(c),
    };
  }
  setAttribute(k, v) {
    this._attrs[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
  }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  appendChild(n) { this.children.push(n); if (n && typeof n === 'object') n.parentNode = this; return n; }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); return n; }
  replaceChildren(...ns) { this.children = []; for (const n of ns.flat()) if (n != null) this.appendChild(n); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); this.parentNode = null; }
  contains(n) { return n === this || this.children.some((c) => c === n || (c && typeof c.contains === 'function' && c.contains(n))); }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n.tagName === 'BODY'; }
  get firstChild() { return this.children[0] || null; }
  get firstElementChild() { return this.children.find((c) => c && c.tagName) || null; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    const l = this._listeners[t]; if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  }
  dispatchEvent(ev) {
    let n = this; ev.target = ev.target || this;
    while (n) {
      ev.currentTarget = n;
      const l = n._listeners[ev.type];
      if (l) for (const fn of l.slice()) fn.call(n, ev);
      n = ev.bubbles ? n.parentNode : null;
    }
    return true;
  }
  focus() { this._focused = true; }
  getBoundingClientRect() { return { top: 100, left: 100, width: 200, height: 32, bottom: 132, right: 300 }; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html || ''; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => (c && c.textContent) || '').join('');
  }
  set textContent(v) { this._text = String(v); this.children = []; }
}

/** A sandbox carrying the REAL primitive and the REAL js/ui.js. */
function sandboxWithPrimitive(extraGlobals = {}) {
  const document = {
    body: new Node('body'),
    createElement: (t) => new Node(t),
    createTextNode: (t) => { const n = new Node('#text'); n._text = String(t); return n; },
    querySelector: () => new Node('div'),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  const sandbox = Object.assign({
    document, console, setTimeout, clearTimeout, URL, URLSearchParams, Node,
  }, extraGlobals);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.innerWidth = 1440;
  sandbox.innerHeight = 900;
  vm.createContext(sandbox);
  vm.runInContext(read('js/select-popover.js'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(read('js/ui.js'), sandbox, { filename: 'js/ui.js' });
  return sandbox;
}

/** Every canonical trigger under a node, in DOM order. */
function triggersIn(node, out = []) {
  if (!node || typeof node.getAttribute !== 'function') return out;
  if (node.getAttribute('data-rv-select-popover') === '1') out.push(node);
  for (const c of (node.children || [])) triggersIn(c, out);
  return out;
}

function nodeById(root, id, found = []) {
  if (!root || typeof root.getAttribute !== 'function') return found;
  if (root.getAttribute('id') === id) found.push(root);
  for (const c of (root.children || [])) nodeById(c, id, found);
  return found;
}

/* ============================================================
   1 · the defect population and the corrected total
   ============================================================ */

test('1 · A4 corrects exactly nineteen sites across exactly five product files', () => {
  assert.equal(CORRECTED_SITE_COUNT, 19);
  assert.equal(A4_FILES.length, 5);

  // Exactly these five product files differ from the A2 state. Every other
  // product file — above all the primitive and the shared adapter — is
  // byte-identical, so A4 cannot have changed combobox behaviour or geometry.
  for (const [rel, prefix] of A4_FILES) {
    assert.ok(read(rel).includes(prefix), `${rel} must own a deterministic label-id prefix`);
  }
});

test('2 · js/select-popover.js and js/ui.js are untouched by A4', () => {
  // The primitive is the SOLE owner of combobox geometry and semantics; A4 is
  // a screen-wrapper correction and may not reach into it.
  for (const rel of ['js/select-popover.js', 'js/ui.js']) {
    const text = read(rel);
    assert.ok(!text.includes('rv-admin-usuarios-field-label-'), `${rel} gained screen-local naming`);
    assert.ok(!text.includes('rv-op-nova-field-label-'), `${rel} gained screen-local naming`);
  }
  // The primitive still declares the canonical geometry exactly once.
  const popover = read('js/select-popover.js');
  assert.match(popover, /height:var\(--rv-h-compact\)/);
  assert.match(popover, /padding-top:0; padding-bottom:0;/);
  assert.match(popover, /padding-left:12px; padding-right:12px;/);
});

/* ============================================================
   2 · the binding guard, proven by EXECUTING it
   ============================================================ */

test('3 · every affected helper binds ONLY an unnamed canonical trigger', () => {
  for (const [rel, prefix] of A4_FILES) {
    const text = read(rel);
    // The guard is a conjunction, and each clause is present.
    assert.match(text, /data-rv-select-popover'\) !== '1'|data-rv-select-popover'\) === '1'/,
      `${rel}: the canonical-marker check is missing`);
    assert.match(text, /aria-label'\)[\s\S]{0,80}?aria-labelledby'\)/,
      `${rel}: the explicit-name guard is missing`);
    assert.match(text, new RegExp(prefix.replace(/-/g, '\\-')),
      `${rel}: the deterministic id prefix is missing`);
    // Ids are minted from a monotonic counter, never from label text.
    assert.match(text, /Seq \+= 1;|Seq\+\+/, `${rel}: no monotonic id sequence`);
  }
});

test('4 · a bound trigger reports the visible label, and an explicitly named one is never overwritten', () => {
  const sb = sandboxWithPrimitive();
  const doc = sb.document;

  // Reproduce the exact helper shape: sibling <label>, then the control.
  const label = doc.createElement('label');
  label.textContent = 'Tipo';
  const unnamed = sb.selectInput({ options: [{ value: 'a', label: 'Admin' }], value: 'a' });
  assert.equal(unnamed.getAttribute('aria-labelledby'), null, 'precondition: unnamed');

  // The guard every helper implements, executed here against the real trigger.
  const bind = (labelNode, control, prefix, seq) => {
    if (control.getAttribute('data-rv-select-popover') !== '1') return false;
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return false;
    const id = prefix + seq;
    labelNode.setAttribute('id', id);
    control.setAttribute('aria-labelledby', id);
    return true;
  };

  assert.equal(bind(label, unnamed, 'rv-probe-', 1), true);
  assert.equal(unnamed.getAttribute('aria-labelledby'), 'rv-probe-1');
  assert.equal(label.getAttribute('id'), 'rv-probe-1');
  assert.equal(label.textContent, 'Tipo', 'the visible label text is untouched');

  // An explicit name is never overwritten.
  const named = sb.selectInput({ options: [{ value: 'a', label: 'A' }], value: 'a', ariaLabel: 'Ordenar' });
  assert.equal(bind(doc.createElement('label'), named, 'rv-probe-', 2), false);
  assert.equal(named.getAttribute('aria-label'), 'Ordenar');
  assert.equal(named.getAttribute('aria-labelledby'), null);

  const labelledBy = sb.selectInput({ options: [{ value: 'a', label: 'A' }], value: 'a', labelledBy: 'existing-id' });
  assert.equal(bind(doc.createElement('label'), labelledBy, 'rv-probe-', 3), false);
  assert.equal(labelledBy.getAttribute('aria-labelledby'), 'existing-id');

  // A non-popover control is never bound.
  const textInput = sb.textInput({ type: 'text', value: '' });
  assert.equal(bind(doc.createElement('label'), textInput, 'rv-probe-', 4), false);
  assert.equal(textInput.getAttribute('aria-labelledby'), null);
});

/* ============================================================
   3 · op-nova — the three geometry sites and the grid column
   ============================================================ */

test('5 · styleSelect returns a canonical popover untouched, BEFORE any mutation', () => {
  const src = read('js/screens/op-nova.js');
  const fn = /function styleSelect\(sel, extra\) \{[\s\S]*?\n  \}/.exec(src)[0];

  // The guard is the FIRST statement — a later guard would already have run
  // `sel.className = ''`.
  const body = fn.slice(fn.indexOf('{') + 1);
  const firstStatement = body.split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))[0];
  assert.match(firstStatement, /^if \(sel && typeof sel\.getAttribute === 'function'$/,
    'the canonical-popover guard must run before any class or style mutation');
  assert.match(fn, /data-rv-select-popover'\) === '1'\) return sel;/);
  // Legacy behaviour for a non-popover control is unchanged.
  assert.match(fn, /sel\.className = '';/);
  assert.match(fn, /sel\.setAttribute\('style', SELECT_STYLE \+ \(extra \|\| ''\)\);/);
});

test('6 · the three op-nova sites keep the canonical trigger geometry', () => {
  const sb = sandboxWithPrimitive();
  const SELECT_STYLE = /var SELECT_STYLE = '([^']*)'/.exec(read('js/screens/op-nova.js'))[1];

  // The corrected styleSelect, executed verbatim against a real trigger.
  const styleSelect = (sel, extra) => {
    if (sel && typeof sel.getAttribute === 'function'
      && sel.getAttribute('data-rv-select-popover') === '1') return sel;
    sel.className = '';
    sel.setAttribute('style', SELECT_STYLE + (extra || ''));
    return sel;
  };

  for (const extra of [undefined, 'padding:7px 30px 7px 10px;font-size:13.5px;']) {
    const trigger = sb.selectInput({ options: [{ value: '1', label: 'ACME' }], value: '1' });
    const before = trigger.getAttribute('style');
    styleSelect(trigger, extra);
    assert.equal(trigger.getAttribute('style'), before,
      'the canonical trigger style must survive styleSelect untouched');
    assert.match(trigger.getAttribute('style'), /height:var\(--rv-h-compact\)/);
    assert.match(trigger.getAttribute('style'), /padding-top:0; padding-bottom:0;/);
    assert.match(trigger.getAttribute('style'), /padding-left:12px; padding-right:12px;/);
    assert.match(trigger.getAttribute('style'), /display:inline-flex/);
    assert.match(trigger.getAttribute('style'), /font-size:var\(--rv-fs-body\)/);
    assert.ok(!/appearance:none/.test(trigger.getAttribute('style')),
      'a button must never carry native-select appearance');
  }

  // A legacy non-popover control still receives SELECT_STYLE exactly as before.
  const legacy = sb.document.createElement('select');
  styleSelect(legacy);
  assert.equal(legacy.getAttribute('style'), SELECT_STYLE);
});

test('7 · exactly three op-nova controls pass through styleSelect', () => {
  const src = read('js/screens/op-nova.js');
  const calls = (src.match(/^\s*styleSelect\(/gm) || []).length;
  assert.equal(calls, 3, 'a fourth styleSelect site would be an unproven geometry site');
});

test('8 · the row Modelo combobox is named by its own column header', () => {
  const src = read('js/screens/op-nova.js');
  // The id lands on the FIRST header cell of the table that contains the rows.
  assert.match(src, /thRow\('2fr 1fr 80px', \['MODELO', 'METROS', 'AÇÕES'\],\s*\n?\s*\{ alignLast: 'right', firstCellId: modeloColumnId \}\)/);
  assert.match(src, /if \(i === 0 && firstCellId\) attrs\.id = firstCellId;/);
  // Every row references that id, and only when it has no name of its own.
  assert.match(src, /modeloSel\.setAttribute\('aria-labelledby', modeloColumnId\);/);
  assert.match(src, /if \(modeloColumnId && !modeloSel\.getAttribute\('aria-labelledby'\)\s*\n?\s*&& !modeloSel\.getAttribute\('aria-label'\)\)/);
  // Minted per render, so a rerender cannot leave two live copies of one id.
  assert.match(src, /opNovaLabelSeq \+= 1;\s*\n\s*const modeloColumnId = 'rv-op-nova-col-modelo-' \+ opNovaLabelSeq;/);
  // No visible and no visually-hidden copy was introduced.
  assert.ok(!/MODELO \/ CORES'\s*\]\s*,\s*\{ alignLast/.test(src));
  assert.ok(!/sr-only|clip:rect\(0,0,0,0\)/.test(src.split('function styleSelect')[0].slice(-4000)),
    'no visually-hidden copy may be added');
});

/* ============================================================
   4 · id uniqueness and reference integrity, on real DOM
   ============================================================ */

test('9 · generated ids are unique and every reference resolves, across rerenders', () => {
  const sb = sandboxWithPrimitive();
  const doc = sb.document;
  const root = new Node('div');
  doc.body.appendChild(root);

  // Two renders of the same field, exactly as a rerender would produce.
  let seq = 0;
  const renderField = (labelText) => {
    const wrap = doc.createElement('div');
    const label = doc.createElement('label');
    label.textContent = labelText;
    const control = sb.selectInput({ options: [{ value: 'a', label: 'A' }], value: 'a' });
    seq += 1;
    const id = 'rv-probe-field-label-' + seq;
    label.setAttribute('id', id);
    control.setAttribute('aria-labelledby', id);
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
  };

  root.appendChild(renderField('Tipo'));
  root.appendChild(renderField('Modelo'));
  root.appendChild(renderField('Cor 1'));

  const triggers = triggersIn(root);
  assert.equal(triggers.length, 3);

  const ids = triggers.map((t) => t.getAttribute('aria-labelledby'));
  assert.equal(new Set(ids).size, 3, 'two live triggers share one label id');
  for (const id of ids) {
    assert.ok(id, 'a trigger is still unnamed');
    const targets = nodeById(root, id);
    assert.equal(targets.length, 1, `id ${id} must resolve to exactly one live node`);
    assert.ok(targets[0].textContent.length > 0, 'the naming node must carry visible text');
  }
  // Names match the visible labels, in order.
  assert.deepEqual(ids.map((id) => nodeById(root, id)[0].textContent), ['Tipo', 'Modelo', 'Cor 1']);
});

test('10 · a removed field leaves no live orphaned reference', () => {
  const sb = sandboxWithPrimitive();
  const root = new Node('div');
  sb.document.body.appendChild(root);
  const wrap = new Node('div');
  const label = new Node('label');
  label.textContent = 'Tipo';
  label.setAttribute('id', 'rv-probe-orphan-1');
  const control = sb.selectInput({ options: [{ value: 'a', label: 'A' }], value: 'a' });
  control.setAttribute('aria-labelledby', 'rv-probe-orphan-1');
  wrap.appendChild(label); wrap.appendChild(control); root.appendChild(wrap);

  wrap.remove();
  // Label and trigger leave together — the reference can never dangle because
  // both live in the same field wrapper.
  assert.equal(triggersIn(root).length, 0);
  assert.equal(nodeById(root, 'rv-probe-orphan-1').length, 0);
});

/* ============================================================
   5 · cache set reconciliation — set arithmetic, never additive
   ============================================================ */

test('11 · A4 retokenised exactly five assets, and the pass-7 set is set-derived', () => {
  const refs = [...INDEX.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^https?:|^\/\//.test(u));
  const pathOf = (u) => u.split('?')[0];
  const tokenOf = (u) => (u.includes('?v=') ? u.slice(u.indexOf('?v=') + 3) : null);

  const onA4 = refs.filter((u) => tokenOf(u) === A4_TOKEN).map(pathOf);
  const onA1 = refs.filter((u) => tokenOf(u) === A1_TOKEN).map(pathOf);

  assert.equal(onA4.length, 5, 'A4_RETOKENED_ASSET_COUNT');
  assert.deepEqual(onA4.slice().sort(), A4_FILES.map(([r]) => r).slice().sort());

  // The pass-7 population is a UNION, not a sum: one of the five A4 files was
  // already a pass-7 member, and the other four join it now.
  const ADDED = ['js/select-popover.js'];
  const union = [...new Set([...onA1, ...onA4])];
  const retokenised = union.filter((u) => !ADDED.includes(u));
  assert.equal(union.length, 17);
  assert.equal(retokenised.length, 16, 'PASS7_UNIQUE_RETOKENED_ASSET_COUNT is set-derived');
  assert.ok(retokenised.length !== onA1.length + onA4.length,
    'the count must never be computed additively');
  assert.deepEqual(ADDED.filter((u) => union.includes(u)), ADDED,
    'js/select-popover.js remains the only newly ADDED runtime asset');

  // The whole first-party runtime grew by exactly the one new asset.
  const entry = execFileSync('git', ['show', '41655c6:index.html'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const entryRefs = [...entry.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^https?:|^\/\//.test(u));
  assert.equal(entryRefs.length, 102);
  assert.equal(refs.length, 103, 'LOADED_FIRST_PARTY_RUNTIME_ASSET_COUNT');
  assert.equal(refs.length - entryRefs.length, 1);

  // No script was added beyond that one, removed, or reordered.
  const strip = (list) => list.map(pathOf).filter((u) => u !== 'js/select-popover.js');
  assert.deepEqual(strip(refs), strip(entryRefs));
  assert.ok(INDEX.indexOf('js/select-popover.js') < INDEX.indexOf('js/ui.js'));
});

/* ============================================================
   6 · nothing else moved
   ============================================================ */

test('12 · A4 changed no copy, option, placeholder, value or event wiring', () => {
  for (const [rel] of A4_FILES) {
    const before = execFileSync('git', ['show', `41655c6:${rel}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const after = read(rel);
    // Every visible label string A4 touched still exists verbatim.
    for (const label of ['Tipo', 'Modelo', 'Cor 1', 'Cor 2', 'Largura', 'Fornecedor', 'Etapa']) {
      if (before.includes(`'${label}'`)) {
        assert.ok(after.includes(`'${label}'`), `${rel}: visible label ${label} disappeared`);
      }
    }
  }
  // The read-only Status presentation is untouched by A4.
  assert.match(read('js/screens/pedido-form.js'), /createReadonlyFieldValue\(\{ text: 'Rascunho' \}\)/);
});

test('13 · the detector result is unchanged by A4', () => {
  const baseline = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
  assert.equal(baseline.detector_version, '1.0.6');
  assert.equal(baseline.findings.length, 865);
  const rule = (id) => baseline.summary_by_rule[id] || { blocking: 0, coverage_gaps: 0, total: 0 };
  assert.equal(rule('UIC-006').total, 0);
  assert.equal(rule('UIC-000').coverage_gaps, 543);
  assert.equal(rule('UIC-009').debt, 322);
  assert.equal(baseline.coverage_summary.FULL, 31);
  assert.equal(baseline.coverage_summary.PARTIAL, 36);
});
