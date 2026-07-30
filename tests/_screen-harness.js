// tests/_screen-harness.js
//
// A BEHAVIOURAL harness for whole screens.
//
// Why this exists
// ---------------
// The screen suites in this repository prove SHAPE: they render once into a
// stub tree whose controls are `rv-select` / `rv-input` placeholders, and they
// reach business handlers by calling `node.attrs.onclick()` directly. That is
// enough to prove a control is IN a row and NOT in a footer, and it is what
// most of tests/ needs.
//
// It is structurally unable to prove BEHAVIOUR OVER TIME. A stub `rv-select`
// has no `.value` and emits no `change`, so the contract between the screen and
// js/select-popover.js is never exercised; and because every existing test
// renders exactly once, nothing observes what the screen looks like AFTER an
// asynchronous write completes. The purchase-planning repaint defect lived
// precisely in that blind spot: the first Distribuir click saved correctly, but
// reload() replaced state.data and cleared state.drafts without repainting, so
// the DOM stayed bound to a discarded draft and the SECOND click raised a false
// "linha incompleta" refusal. No shape assertion could see it.
//
// What this harness does differently
// ----------------------------------
//   · a DOM double faithful enough to run the SHIPPED primitives unmodified —
//     capture/target/bubble dispatch, live parent links, textContent, a mutable
//     style bag and per-instance property definition (js/select-popover.js
//     installs `value` and `disabled` accessors on its own trigger);
//   · the REAL js/select-popover.js, js/ui.js, js/badges.js and
//     js/screens/op-form-helpers.js — no primitive is stubbed;
//   · only the ambient shell is doubled: layout chrome, routing, crypto and the
//     Supabase client, because those are the seams a test must own;
//   · user-level drivers (click / type / pickOption) that dispatch the same
//     event sequences a pointer and a keyboard produce, so a handler is never
//     invoked directly.
//
// It is deliberately scoped to what a screen regression needs. It is not a
// browser, and it is not a replacement for the shape suites.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// The primitives every screen composes from, in index.html load order.
const BASE_FILES = [
  'js/select-popover.js',
  'js/ui.js',
  'js/badges.js',
  'js/screens/op-form-helpers.js',
];

// ---------------------------------------------------------------------
// DOM double
// ---------------------------------------------------------------------

// A style bag that accepts arbitrary properties, as CSSStyleDeclaration does
// for the longhands the primitives assign (minWidth, top, borderColor, ...).
function makeStyle() {
  return { cssText: '' };
}

class DomNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._attrs = Object.create(null);
    this._capture = Object.create(null);
    this._bubble = Object.create(null);
    this._text = null;
    this.style = makeStyle();
    this.className = '';
    this.id = '';
    this.value = '';
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

  appendChild(n) {
    if (n == null) return n;
    if (n.parentNode && typeof n.parentNode.removeChild === 'function') n.parentNode.removeChild(n);
    this.children.push(n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) { this.children.splice(i, 1); n.parentNode = null; }
    return n;
  }
  replaceChild(next, current) {
    const i = this.children.indexOf(current);
    if (i < 0) return current;
    this.children[i] = next;
    next.parentNode = this;
    current.parentNode = null;
    return current;
  }
  replaceChildren(...ns) {
    for (const c of this.children) c.parentNode = null;
    this.children = [];
    for (const n of ns.flat()) if (n != null) this.appendChild(n);
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

  contains(n) {
    if (n === this) return true;
    return this.children.some((c) => c && typeof c.contains === 'function' && c.contains(n));
  }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n.tagName === 'BODY' || n.tagName === '#DOCUMENT';
  }
  get firstChild() { return this.children[0] || null; }

  addEventListener(type, fn, capture) {
    const bag = capture === true ? this._capture : this._bubble;
    (bag[type] = bag[type] || []).push(fn);
  }
  removeEventListener(type, fn, capture) {
    const bag = capture === true ? this._capture : this._bubble;
    const l = bag[type];
    if (!l) return;
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  }

  // Real three-phase dispatch. js/select-popover.js registers its outside-click
  // and key handlers on the DOCUMENT with capture, so a target-only dispatch
  // would silently skip them and prove nothing.
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    ev.defaultPrevented = !!ev.defaultPrevented;
    if (typeof ev.preventDefault !== 'function') {
      ev.preventDefault = function () { ev.defaultPrevented = true; };
    }
    let stopped = false;
    if (typeof ev.stopPropagation !== 'function') {
      ev.stopPropagation = function () { stopped = true; };
    }

    const path = [];
    for (let n = this; n; n = n.parentNode) path.push(n);

    for (let i = path.length - 1; i >= 1 && !stopped; i -= 1) {
      ev.currentTarget = path[i];
      for (const fn of (path[i]._capture[ev.type] || []).slice()) fn.call(path[i], ev);
    }
    if (!stopped) {
      ev.currentTarget = this;
      for (const fn of (this._capture[ev.type] || []).slice()) fn.call(this, ev);
      for (const fn of (this._bubble[ev.type] || []).slice()) fn.call(this, ev);
    }
    if (ev.bubbles) {
      for (let i = 1; i < path.length && !stopped; i += 1) {
        ev.currentTarget = path[i];
        for (const fn of (path[i]._bubble[ev.type] || []).slice()) fn.call(path[i], ev);
      }
    }
    return !ev.defaultPrevented;
  }

  focus() { this._focused = true; }
  blur() { this._focused = false; }
  scrollIntoView() {}
  getBoundingClientRect() {
    return { top: 100, left: 100, width: 240, height: 32, bottom: 132, right: 340 };
  }

  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html || ''; }

  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => (c && c.textContent) || '').join('');
  }
  set textContent(v) {
    this._text = String(v);
    for (const c of this.children) c.parentNode = null;
    this.children = [];
  }
}

// ---------------------------------------------------------------------
// Tree queries
// ---------------------------------------------------------------------

function findAll(root, pred, acc = []) {
  if (!root || typeof root !== 'object') return acc;
  if (pred(root)) acc.push(root);
  for (const c of root.children || []) findAll(c, pred, acc);
  return acc;
}

function findOne(root, pred) { return findAll(root, pred)[0] || null; }

const byAttr = (name, value) => (n) => typeof n.getAttribute === 'function'
  && n.getAttribute(name) !== null
  && (value === undefined || n.getAttribute(name) === value);

const textOf = (n) => (n && typeof n.textContent === 'string' ? n.textContent.trim().replace(/\s+/g, ' ') : '');

const buttonLabelled = (label) => (n) => n.tagName === 'BUTTON' && textOf(n) === label;

// ---------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------

/**
 * @param {object} options
 * @param {string[]} options.files      screen files to load after the primitives
 * @param {function} options.rpc        async (name, params) => { data, error }
 * @param {object}   [options.globals]  extra sandbox globals / overrides
 */
function createScreenHarness({ files = [], rpc, globals = {} } = {}) {
  const body = new DomNode('body');
  const rpcCalls = [];
  const navigations = [];

  const doc = new DomNode('#document');
  doc.body = body;
  doc.appendChild(body);
  doc.createElement = (t) => new DomNode(t);
  doc.createTextNode = (t) => { const n = new DomNode('#text'); n._text = String(t); return n; };
  doc.querySelector = () => null;
  doc.querySelectorAll = () => [];

  // A minimal Event so js/select-popover.js takes its REAL construction path
  // (new W.Event('change', {bubbles:true})) rather than its reduced-DOM
  // fallback — the contract under test must be the shipped one.
  function Ev(type, init) {
    this.type = String(type);
    this.bubbles = !!(init && init.bubbles);
    this.cancelable = !!(init && init.cancelable);
    this.defaultPrevented = false;
  }

  let uuidSeq = 0;

  const sandbox = Object.assign({
    document: doc,
    console,
    setTimeout,
    clearTimeout,
    Event: Ev,
    innerWidth: 1440,
    innerHeight: 900,
    crypto: { randomUUID: () => `harness-key-${++uuidSeq}` },
    // Ambient shell — the seams a screen test legitimately owns.
    ADMIN_MENU: [],
    shellLayout: (menu, node) => node,
    navigate: (href) => { navigations.push(href); },
    RAVATEX_OP_DISPLAY: { formatOpOperationalCode: () => 'OP' },
    supa: {
      rpc: async (name, params) => {
        rpcCalls.push({ name, params: JSON.parse(JSON.stringify(params === undefined ? null : params)) });
        return rpc(name, params);
      },
    },
  }, globals);

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  doc.defaultView = sandbox;

  vm.createContext(sandbox);
  for (const rel of BASE_FILES.concat(files)) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }

  // ---- user-level drivers -------------------------------------------
  function fire(node, type, init) {
    const ev = Object.assign(new Ev(type, { bubbles: true, cancelable: true }), init || {});
    node.dispatchEvent(ev);
    return ev;
  }

  /** The event sequence a real pointer produces, in order. */
  function click(node) {
    if (!node) throw new Error('click(): node is null');
    if (node.disabled === true) return false;
    fire(node, 'mousedown');
    fire(node, 'mouseup');
    fire(node, 'click');
    return true;
  }

  /** Type into a real text input the way a keyboard does. */
  function type(input, value) {
    if (!input) throw new Error('type(): input is null');
    input.value = String(value);
    fire(input, 'input');
    return input;
  }

  /**
   * Choose an option through the REAL popover: open the trigger, then click the
   * option's inner label span — the node a cursor actually lands on.
   */
  function pickOption(trigger, optionValue) {
    click(trigger);
    const panel = findOne(body, byAttr('data-rv-select-panel'));
    if (!panel) throw new Error('pickOption(): the popover did not open');
    const option = findOne(panel, (n) => n.getAttribute
      && n.getAttribute('data-rv-option-value') === String(optionValue));
    if (!option) {
      const offered = findAll(panel, byAttr('data-rv-select-option'))
        .map((o) => `${o.getAttribute('data-rv-option-value')}=${textOf(o)}`);
      throw new Error(`pickOption(): value ${optionValue} not offered; got [${offered.join(', ')}]`);
    }
    click(option.children[0] || option);
    return trigger;
  }

  const openPanel = () => findOne(body, byAttr('data-rv-select-panel'));

  return {
    win: sandbox,
    document: doc,
    body,
    rpcCalls,
    navigations,
    // queries
    findAll: (pred, root) => findAll(root || body, pred),
    findOne: (pred, root) => findOne(root || body, pred),
    byAttr,
    textOf,
    buttonLabelled,
    openPanel,
    // drivers
    click,
    type,
    pickOption,
    fire,
    /** Mount a screen's returned tree so document-level behaviour is live. */
    mount(node) { body.replaceChildren(node); return node; },
    /** Let queued microtasks and the awaited RPC chain settle. */
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

module.exports = {
  createScreenHarness,
  DomNode,
  findAll,
  findOne,
  byAttr,
  textOf,
  buttonLabelled,
};
