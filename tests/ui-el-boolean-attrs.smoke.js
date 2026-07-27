// =====================================================================
// === tests/ui-el-boolean-attrs.smoke.js ================================
// Unit smoke for js/ui.js's el() boolean-attribute handling
// (UI-EL-BOOLEAN-ATTR-FIX).
//
// Root cause fixed: el() called node.setAttribute(k, v) unconditionally,
// including for boolean attrs (disabled/checked/selected/...). In any
// real browser, an HTML boolean attribute's mere PRESENCE makes it true,
// regardless of its stringified value — setAttribute('disabled', false)
// still renders as disabled. Confirmed live in staging via the "Mostrar
// inativos" checkbox in admin-usuarios.js (always rendered checked,
// independent of state) and suspected in the Excluir button (disabled
// for every row, not just self).
//
// This suite loads the REAL js/ui.js in a vm sandbox with a DOM-like
// double that tracks attribute PRESENCE via hasAttribute (not raw
// setAttribute values) — the way a naive mock recording setAttribute's
// argument verbatim never would have caught this class of bug.
//
// Runs with: node --test tests/ui-el-boolean-attrs.smoke.js
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
// semantics. Only removeAttribute clears presence. This is what "simulate
// real DOM boolean coercion" means — a mock that stored the raw value
// verbatim (as the pre-fix smoke mocks did) would never surface this bug.
class DomLikeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this._attrs = new Map();
    this.children = [];
    this._listeners = {};
    // Pass-7 (§14.1) DOM fidelity: every real element exposes `.style`.
    this.style = {};
    this.className = '';
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

test('node --check passes on js/ui.js', () => {
  require('node:child_process').execSync(`node --check "${UI}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// Boolean attrs: true -> present, false/null/undefined -> absent
// ---------------------------------------------------------------------

for (const attr of ['checked', 'disabled', 'selected', 'readonly', 'required', 'hidden']) {
  test(`el(): ${attr}=true sets the attribute (present)`, () => {
    const sandbox = makeSandbox();
    const node = vm.runInContext(`window.el('input', {${attr}: true})`, sandbox);
    assert.equal(node.hasAttribute(attr), true, `${attr} should be present when true`);
  });

  test(`el(): ${attr}=false omits the attribute (absent) — the actual UI-EL-BOOLEAN-ATTR-FIX regression`, () => {
    const sandbox = makeSandbox();
    const node = vm.runInContext(`window.el('input', {${attr}: false})`, sandbox);
    assert.equal(node.hasAttribute(attr), false, `${attr} should be ABSENT when false (was always present pre-fix)`);
  });

  test(`el(): ${attr}=null omits the attribute (absent)`, () => {
    const sandbox = makeSandbox();
    const node = vm.runInContext(`window.el('input', {${attr}: null})`, sandbox);
    assert.equal(node.hasAttribute(attr), false, `${attr} should be absent when null`);
  });

  test(`el(): ${attr}=undefined omits the attribute (absent)`, () => {
    const sandbox = makeSandbox();
    const node = vm.runInContext(`window.el('input', {${attr}: undefined})`, sandbox);
    assert.equal(node.hasAttribute(attr), false, `${attr} should be absent when undefined`);
  });

  test(`el(): ${attr}='${attr}' (pre-existing literal-string convention) still sets the attribute (present)`, () => {
    const sandbox = makeSandbox();
    const node = vm.runInContext(`window.el('input', {${attr}: '${attr}'})`, sandbox);
    assert.equal(node.hasAttribute(attr), true, `${attr}='${attr}' should still render present (existing call-site convention preserved)`);
  });
}

// ---------------------------------------------------------------------
// Non-boolean attrs: exact current behavior preserved, including a
// falsy-looking string/number surviving as a literal value.
// ---------------------------------------------------------------------

test('el(): non-boolean attr value="false" (string) survives as-is, never omitted', () => {
  const sandbox = makeSandbox();
  const node = vm.runInContext(`window.el('input', {value: 'false'})`, sandbox);
  assert.equal(node.hasAttribute('value'), true, 'value attr should still be present');
  assert.equal(node.getAttribute('value'), 'false', 'value="false" must survive as the literal string');
});

test('el(): non-boolean attr with numeric 0 survives (not boolean-omitted)', () => {
  const sandbox = makeSandbox();
  const node = vm.runInContext(`window.el('input', {tabindex: 0})`, sandbox);
  assert.equal(node.hasAttribute('tabindex'), true, 'tabindex=0 must not be treated as a boolean attr');
  assert.equal(node.getAttribute('tabindex'), '0');
});

test('el(): aria-* attrs are NOT boolean-coerced (ARIA takes literal "true"/"false" strings by spec)', () => {
  const sandbox = makeSandbox();
  const nodeFalse = vm.runInContext(`window.el('div', {'aria-hidden': 'false'})`, sandbox);
  const nodeTrue = vm.runInContext(`window.el('div', {'aria-hidden': 'true'})`, sandbox);
  assert.equal(nodeFalse.getAttribute('aria-hidden'), 'false', 'aria-hidden="false" must survive as the literal string, never omitted');
  assert.equal(nodeTrue.getAttribute('aria-hidden'), 'true');
});

test('el(): class/style/event-handler attrs behave exactly as before', () => {
  const sandbox = makeSandbox();
  let clicked = false;
  vm.runInContext(`window.__onclick = () => { window.__clicked = true; }`, sandbox);
  const node = vm.runInContext(
    `window.el('button', { class: 'btn', style: 'color:red;', onclick: window.__onclick }, 'ok')`,
    sandbox,
  );
  assert.equal(node.className, 'btn');
  assert.equal(node.hasAttribute('style'), true);
  assert.equal(node.getAttribute('style'), 'color:red;');
  node._listeners.click();
  clicked = vm.runInContext('window.__clicked', sandbox);
  assert.equal(clicked, true, 'onclick handler should still be wired via addEventListener');
});

// ---------------------------------------------------------------------
// Regression-catching property: a naive setAttribute(k, false) call
// (simulating the pre-fix el()) must be distinguishable from the fixed
// removeAttribute path under this same double — proves the double itself
// is capable of catching the bug class, not just happening to pass.
// ---------------------------------------------------------------------

test('DomLikeNode double: setAttribute(k, false) (pre-fix behavior) would render present — proves the double catches the bug class', () => {
  const node = new DomLikeNode('input');
  node.setAttribute('checked', false);
  assert.equal(node.hasAttribute('checked'), true, 'a naive setAttribute(k, false) call renders present in a real-DOM-like double, confirming the double would have caught the original bug');
});
