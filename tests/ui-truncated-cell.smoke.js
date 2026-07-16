// =====================================================================
// === tests/ui-truncated-cell.smoke.js ==================================
// Unit smoke for js/ui.js's truncatedCell() — the grid/list text-cell
// overflow primitive ratified in docs/architecture/UI_VISUAL_CONTRACT.md
// §7.1 (UI-GRID-TEXT-HELPER track), promoted verbatim from
// js/screens/admin-usuarios.js (UI-USERS-GRID-TEXT-OVERFLOW).
//
// Verifies (against the REAL js/ui.js in a vm sandbox, no screen wired):
//   - single-line ellipsis CSS present (white-space:nowrap;
//     overflow:hidden; text-overflow:ellipsis; min-width:0);
//   - the caller's colorStyle is preserved alongside the truncation CSS;
//   - `title` attribute carries the full rawValue when present;
//   - `title` attribute is ABSENT when rawValue is falsy (the "—"
//     fallback case) — no useless "—" tooltip;
//   - the displayed (possibly-truncated) text is preserved verbatim as
//     the node's text content, regardless of length — CSS truncates the
//     rendering, not the DOM content;
//   - window.TRUNCATE_CELL_STYLE is exposed for direct reuse (the one
//     admin-usuarios.js header-row call site that uses the raw style
//     string outside of truncatedCell()).
//
// Runs with: node --test tests/ui-truncated-cell.smoke.js
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
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  return sandbox;
}

test('node --check passes on js/ui.js', () => {
  require('node:child_process').execSync(`node --check "${UI}"`, { stdio: 'pipe' });
});

test('window.truncatedCell is a function', () => {
  const sandbox = makeSandbox();
  assert.equal(typeof vm.runInContext('window.truncatedCell', sandbox), 'function');
});

test('window.TRUNCATE_CELL_STYLE is exposed with the exact ratified CSS string', () => {
  const sandbox = makeSandbox();
  const style = vm.runInContext('window.TRUNCATE_CELL_STYLE', sandbox);
  assert.equal(style, 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;');
});

test('renders a div with nowrap/hidden/ellipsis/min-width:0 plus the caller colorStyle', () => {
  const sandbox = makeSandbox();
  const node = vm.runInContext(
    `window.truncatedCell('user@example.com', 'user@example.com', 'font-size:13.5px; color:#3f4757;')`,
    sandbox,
  );
  assert.equal(node.tagName, 'DIV');
  const style = node.getAttribute('style');
  assert.match(style, /white-space:nowrap/);
  assert.match(style, /overflow:hidden/);
  assert.match(style, /text-overflow:ellipsis/);
  assert.match(style, /min-width:0/);
  assert.match(style, /font-size:13\.5px/);
  assert.match(style, /color:#3f4757/);
});

test('title attribute carries the full rawValue when present', () => {
  const sandbox = makeSandbox();
  const longEmail = 'a.very.long.synthetic.address.for.truncation.testing@example-corp-subdomain.com';
  const node = vm.runInContext(
    `window.truncatedCell(${JSON.stringify(longEmail)}, ${JSON.stringify(longEmail)}, 'font-size:13.5px;')`,
    sandbox,
  );
  assert.equal(node.getAttribute('title'), longEmail);
  assert.equal(node.children[0].textContent, longEmail, 'full text must still be present in the DOM, not truncated at the string level');
});

test('title attribute is absent when rawValue is falsy (the "—" fallback case)', () => {
  const sandbox = makeSandbox();
  const node = vm.runInContext(
    `window.truncatedCell('—', undefined, 'font-size:13.5px;')`,
    sandbox,
  );
  assert.equal(node.hasAttribute('title'), false, 'no useless tooltip should appear on the "—" fallback');
});

test('title attribute is absent when rawValue is an empty string', () => {
  const sandbox = makeSandbox();
  const node = vm.runInContext(
    `window.truncatedCell('', '', 'font-size:13.5px;')`,
    sandbox,
  );
  assert.equal(node.hasAttribute('title'), false);
});
