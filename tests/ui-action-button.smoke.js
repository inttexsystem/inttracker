// =====================================================================
// === tests/ui-action-button.smoke.js ===================================
// Unit smoke for js/ui.js's actionButton() — the row-level compact icon
// button ratified in docs/architecture/UI_VISUAL_CONTRACT.md §8.1
// (UI-ACTION-BUTTON track, phase ii).
//
// Verifies (against the REAL js/ui.js in a vm sandbox, no screen wired):
//   - dimensions/attrs per the ratified spec (30x30, radius 4px, border
//     #eceef1, bg #fff, neutral/danger rest colors);
//   - screen-reader label present via the clip-rect sr-only pattern,
//     NEVER display:none (the exact defect found in ops-list.js during
//     the conformance diagnosis);
//   - disabled uses the safe boolean pattern (UI-EL-BOOLEAN-ATTR-FIX):
//     the `disabled` attribute is present only when disabled=true,
//     using the DOM-coercion-aware double (hasAttribute, not raw
//     setAttribute value) — same double style as
//     tests/ui-el-boolean-attrs.smoke.js;
//   - danger hover colors (#fca5a5/#fff1f1/#c53030) and neutral hover
//     colors (#d0d5de/#3f4757), restored on mouseleave;
//   - onclick wired via addEventListener, and NOT attached when disabled.
//
// Runs with: node --test tests/ui-action-button.smoke.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'js', 'ui.js');
const uiSrc = fs.readFileSync(UI, 'utf8');

// DOM-like double: setAttribute always marks presence (any value,
// including a stringified "false"), matching real-browser boolean-attr
// semantics — same approach as tests/ui-el-boolean-attrs.smoke.js. Also
// carries a real-ish `.style` object so imperative `button.style.x = y`
// hover mutations (actionButton doesn't rely on CSS pseudo-classes) can
// be asserted directly.
class DomLikeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this._attrs = new Map();
    this.children = [];
    this._listeners = {};
    this.style = {};
  }
  setAttribute(name, value) { this._attrs.set(name, String(value)); }
  removeAttribute(name) { this._attrs.delete(name); }
  hasAttribute(name) { return this._attrs.has(name); }
  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  appendChild(n) { this.children.push(n); return n; }
}

function makeSandbox() {
  const sandbox = {
    document: {
      createElement: (t) => new DomLikeNode(t),
      createTextNode: (t) => ({ textContent: t }),
    },
    console,
    Node: DomLikeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  return sandbox;
}

function makeIcon(sandbox) {
  return vm.runInContext(`window.el('svg', { width: '14', height: '14' })`, sandbox);
}

test('node --check passes on js/ui.js', () => {
  require('node:child_process').execSync(`node --check "${UI}"`, { stdio: 'pipe' });
});

test('window.actionButton is a function', () => {
  const sandbox = makeSandbox();
  assert.equal(typeof vm.runInContext('window.actionButton', sandbox), 'function');
});

// ---------------------------------------------------------------------
// Dimensions / rest-state attrs per the ratified §8.1 spec
// ---------------------------------------------------------------------

test('renders 30x30, radius 4px, border #eceef1, bg #fff, neutral rest color #8a93a3', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Editar usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  const style = node.getAttribute('style');
  assert.match(style, /width:30px/);
  assert.match(style, /height:30px/);
  assert.match(style, /border:1px solid #eceef1/);
  assert.match(style, /border-radius:4px/);
  assert.match(style, /background:#fff/);
  assert.match(style, /color:#8a93a3/);
  assert.equal(node.getAttribute('type'), 'button');
  assert.equal(node.getAttribute('title'), 'Editar usuario');
  assert.equal(node.getAttribute('aria-label'), 'Editar usuario');
});

test('danger:true uses rest color #d6403a', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Excluir usuario', icon: window.__icon, danger: true, onclick: () => {} })`,
    sandbox,
  );
  assert.match(node.getAttribute('style'), /color:#d6403a/);
});

// ---------------------------------------------------------------------
// Screen-reader label: clip-rect sr-only, NEVER display:none
// ---------------------------------------------------------------------

test('appends a visually-hidden sr-only label span using the clip-rect pattern (never display:none)', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Excluir usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  const srSpan = node.children[node.children.length - 1];
  assert.equal(srSpan.tagName, 'SPAN');
  const style = srSpan.getAttribute('style');
  assert.match(style, /clip:rect\(0,0,0,0\)/, 'sr-only span must use the clip-rect pattern');
  assert.doesNotMatch(style, /display:\s*none/, 'sr-only span must NEVER use display:none (hides from assistive tech too — the ops-list.js defect)');
});

test('sr-only label defaults to title when srLabel is omitted', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Reativar usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  const srSpan = node.children[node.children.length - 1];
  assert.equal(srSpan.children[0].textContent, 'Reativar usuario');
});

test('sr-only label uses srLabel when explicitly provided (distinct from title)', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Ver detalhes', srLabel: 'Ver detalhes do pedido 42', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  const srSpan = node.children[node.children.length - 1];
  assert.equal(srSpan.children[0].textContent, 'Ver detalhes do pedido 42');
});

test('icon is appended as a child before the sr-only label', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Editar usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  assert.equal(node.children.length, 2, 'button should have exactly 2 children: icon + sr-only label');
  assert.equal(node.children[0].tagName, 'SVG');
  assert.equal(node.children[1].tagName, 'SPAN');
});

// ---------------------------------------------------------------------
// Disabled: safe boolean pattern (UI-EL-BOOLEAN-ATTR-FIX)
// ---------------------------------------------------------------------

test('disabled=true sets the disabled attribute (present) and no onclick listener', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const clicked = { value: false };
  sandbox.__onclick = () => { clicked.value = true; };
  const node = vm.runInContext(
    `window.actionButton({ title: 'Nao pode excluir', icon: window.__icon, disabled: true, onclick: window.__onclick })`,
    sandbox,
  );
  assert.equal(node.hasAttribute('disabled'), true);
  assert.equal(node._listeners.click, undefined, 'no click listener should be attached when disabled');
  assert.match(node.getAttribute('style'), /opacity:0\.45/);
  assert.match(node.getAttribute('style'), /cursor:default/);
});

test('disabled=false (default) omits the disabled attribute entirely (absent, not "false")', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Excluir usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  assert.equal(node.hasAttribute('disabled'), false,
    'disabled attribute must be ABSENT when not disabled — this is exactly the UI-EL-BOOLEAN-ATTR-FIX regression class');
  assert.match(node.getAttribute('style'), /opacity:1/);
  assert.match(node.getAttribute('style'), /cursor:pointer/);
});

test('disabled buttons get no hover listeners attached', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Nao pode excluir', icon: window.__icon, disabled: true })`,
    sandbox,
  );
  assert.equal(node._listeners.mouseenter, undefined);
  assert.equal(node._listeners.mouseleave, undefined);
});

// ---------------------------------------------------------------------
// Hover: neutral and danger variants, restored on mouseleave
// ---------------------------------------------------------------------

test('neutral hover: border-color #d0d5de, color #3f4757; restored on mouseleave', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Editar usuario', icon: window.__icon, onclick: () => {} })`,
    sandbox,
  );
  assert.equal(typeof node._listeners.mouseenter, 'function');
  node._listeners.mouseenter();
  assert.equal(node.style.borderColor, '#d0d5de');
  assert.equal(node.style.color, '#3f4757');
  node._listeners.mouseleave();
  assert.equal(node.style.borderColor, '#eceef1');
  assert.equal(node.style.background, '#fff');
  assert.equal(node.style.color, '#8a93a3');
});

test('danger hover: border-color #fca5a5, background #fff1f1, color #c53030; restored on mouseleave', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Excluir usuario', icon: window.__icon, danger: true, onclick: () => {} })`,
    sandbox,
  );
  node._listeners.mouseenter();
  assert.equal(node.style.borderColor, '#fca5a5');
  assert.equal(node.style.background, '#fff1f1');
  assert.equal(node.style.color, '#c53030');
  node._listeners.mouseleave();
  assert.equal(node.style.borderColor, '#eceef1');
  assert.equal(node.style.background, '#fff');
  assert.equal(node.style.color, '#d6403a');
});

// ---------------------------------------------------------------------
// onclick wiring
// ---------------------------------------------------------------------

test('onclick is wired via addEventListener and fires on click', () => {
  const sandbox = makeSandbox();
  sandbox.__icon = makeIcon(sandbox);
  vm.runInContext(`window.__calls = 0; window.__onclick = () => { window.__calls++; };`, sandbox);
  const node = vm.runInContext(
    `window.actionButton({ title: 'Editar usuario', icon: window.__icon, onclick: window.__onclick })`,
    sandbox,
  );
  assert.equal(typeof node._listeners.click, 'function');
  node._listeners.click();
  assert.equal(vm.runInContext('window.__calls', sandbox), 1);
});
