// =====================================================================
// === tests/_doubles.js ===============================================
// Shared canonical test doubles (TEST-DOUBLE-SHARED-MODULE, Lot L1).
//
// Single source of truth for the test doubles that imitate the app's
// runtime boundaries, seeded from the three corrected doubles that came
// out of UI-EL-BOOLEAN-ATTR-FIX, UI-INVOKE-ENVELOPE-FIX and the ui.js
// primitive hand-mock fixes (TEST-MOCK-FIDELITY-AUDIT, 2026-07-17).
//
// Governing rule: CODE_HEALTH_RULES.md §20 — a double that imitates
// external behavior must model that system's ACTUAL semantics on every
// axis a suite asserts. This module models:
//
//   1. DOM boolean attributes (FaithfulNode) — an HTML boolean
//      attribute is true by mere PRESENCE, regardless of its string
//      value; setAttribute(k, false) still renders as present. The node
//      therefore tracks presence (hasAttribute/removeAttribute) AND
//      exposes the coerced property (node.disabled/node.checked), so a
//      raw setAttribute(k, false) regression is caught, not masked.
//
//   2. functions.invoke() double envelope (makeFakeSupa) — the real
//      @supabase/supabase-js client returns the raw parsed body verbatim
//      as `data`; every admin-* Edge Function wraps success in
//      { data: <payload> } via jsonResponse(). So a faithful invoke()
//      returns { data: { data: <payload> }, error } — one level deeper
//      than call sites read. invokeImpl callbacks return the INNER
//      payload; the fake adds the outer layer, exactly like production.
//
//   3. .rpc() single-level envelope (makeFakeSupa) — .rpc() returns the
//      raw function return under `data` (single level), NOT double
//      wrapped. PostgREST chains resolve { data, error } with
//      single()/maybeSingle() returning an object|null and chain
//      terminals returning an array.
//
// This module ships with its own meta-tests (tests/_doubles.meta.test.js)
// that prove each double catches the class it exists to catch — the
// centralized double must not become a single centralized blind spot.
//
// Classic CommonJS (require), matching the rest of tests/. No app state,
// no DOM globals, no Supabase.
// =====================================================================

'use strict';

// HTML boolean attributes — mirrors js/ui.js BOOLEAN_ATTRS. Kept in sync
// deliberately: this is the exact set for which presence (not string
// value) determines truth in a real browser.
const BOOLEAN_ATTRS = new Set([
  'checked', 'disabled', 'selected', 'readonly', 'required', 'multiple',
  'hidden', 'open', 'autofocus', 'autoplay', 'controls', 'default',
  'defer', 'ismap', 'loop', 'muted', 'novalidate', 'reversed',
]);

// ---------------------------------------------------------------------
// FaithfulNode — a DOM node double that models real-browser semantics on
// the axes suites assert. Seeded from the corrected FakeNode in
// tests/admin-usuarios.smoke.js (the crown-jewel double) and widened to
// cover the DOM surface used across the adopting suites.
//
// Fidelity guarantees:
//   - setAttribute stores the raw value in a plain-object `_attrs` (so
//     existing `node._attrs.title` reads keep working) AND, for a boolean
//     attribute, marks the coerced property true — matching real DOM,
//     where setAttribute('disabled', false) still renders present.
//   - removeAttribute clears both. This is the ONLY way a boolean attr
//     becomes false — exactly what real el() relies on for falsy values.
//   - hasAttribute/getAttribute report presence/value.
//   - `style` is dual-access: setAttribute('style', v) also fills
//     `node.style.cssText`, and direct `node.style.foo = ...` works.
// ---------------------------------------------------------------------
class FaithfulNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.className = '';
    this._attrs = {};
    this._listeners = {};
    this._text = null;
    // Coerced boolean properties (real-DOM reflected IDL attributes).
    this.disabled = false;
    this.checked = false;
    this.selected = false;
    // Common element properties suites read/write directly.
    this.value = '';
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.firstChild = null;
    this.firstElementChild = null;
    this.parentNode = null;
    this._removed = false;
    this.style = new StyleDouble();
    const self = this;
    this.classList = {
      _set: new Set(),
      add(...cs) { cs.forEach((c) => this._set.add(c)); self.className = Array.from(this._set).join(' '); },
      remove(...cs) { cs.forEach((c) => this._set.delete(c)); self.className = Array.from(this._set).join(' '); },
      contains(c) { return this._set.has(c); },
      toggle(c) { if (this._set.has(c)) { this._set.delete(c); } else { this._set.add(c); } self.className = Array.from(this._set).join(' '); },
    };
  }

  setAttribute(name, value) {
    if (name === 'style') {
      this.style.cssText = String(value);
      this._attrs.style = String(value);
      return;
    }
    this._attrs[name] = value;
    if (BOOLEAN_ATTRS.has(name)) this[name] = true;
  }

  removeAttribute(name) {
    delete this._attrs[name];
    if (name === 'style') this.style.cssText = '';
    if (BOOLEAN_ATTRS.has(name)) this[name] = false;
  }

  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, name); }
  getAttribute(name) { return this.hasAttribute(name) ? this._attrs[name] : null; }

  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }

  appendChild(node) {
    this.children.push(node);
    if (node && typeof node === 'object') node.parentNode = this;
    if (this.firstChild == null) this.firstChild = node;
    if (this.firstElementChild == null && node && node.tagName) this.firstElementChild = node;
    // Real <select> reflects the selected <option>'s value into select.value.
    // js/ui.js selectInput() sets option.selected = true, then appends it — so
    // an edit form pre-populates the select; a raw-store double masked this by
    // never reflecting the option (TEST-MOCK-FIDELITY-AUDIT R1).
    if (this.tagName === 'SELECT' && node && node.tagName === 'OPTION' && node.selected) {
      const v = node.getAttribute('value');
      this.value = v != null ? v : (node.value || '');
    }
    return node;
  }

  prepend(node) {
    this.children.unshift(node);
    if (node && typeof node === 'object') node.parentNode = this;
    this.firstChild = node;
    if (node && node.tagName) this.firstElementChild = node;
    return node;
  }

  insertBefore(node, ref) {
    const idx = ref ? this.children.indexOf(ref) : -1;
    if (idx < 0) this.children.push(node); else this.children.splice(idx, 0, node);
    if (node && typeof node === 'object') node.parentNode = this;
    this.firstChild = this.children[0] || null;
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.firstChild = null;
    this.firstElementChild = null;
    for (const n of nodes.flat()) {
      if (n == null || n === false) continue;
      this.appendChild(typeof n === 'string' ? new TextDouble(n) : n);
    }
  }

  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  remove() { this._removed = true; if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); } }

  // innerHTML: suites only set it (e.g. to inject an svg icon). Model the
  // observable effect real code depends on — a firstChild element appears.
  set innerHTML(html) {
    this._innerHTML = String(html);
    if (String(html).trim() === '') { this.children = []; this.firstChild = null; this.firstElementChild = null; return; }
    const svg = new FaithfulNode('svg');
    this.children = [svg];
    this.firstChild = svg;
    this.firstElementChild = svg;
  }
  get innerHTML() { return this._innerHTML || ''; }

  get textContent() {
    if (this._text != null) return this._text;
    return (this.children || []).map((c) => (c && c.textContent) || '').join('');
  }
  set textContent(v) { this._text = String(v); this.children = []; }

  // Minimal query support (predicate-free): suites that need it usually
  // walk `children` themselves; querySelectorAll returns a flat descendant
  // list filtered by tagName when a simple tag selector is given.
  querySelectorAll(sel) {
    const out = [];
    const wantTag = typeof sel === 'string' && /^[a-zA-Z]+$/.test(sel) ? sel.toUpperCase() : null;
    (function walk(node) {
      for (const c of (node.children || [])) {
        if (c && c.tagName && (wantTag == null || c.tagName === wantTag)) out.push(c);
        if (c && c.children) walk(c);
      }
    })(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

// A CSS style double supporting both `.cssText` and individual property
// access (node.style.display = 'none'), matching real HTMLElement.style.
class StyleDouble {
  constructor() { this.cssText = ''; }
}

// Text node double — a minimal object with textContent, matching what
// document.createTextNode returns for the suites' text-walk helpers.
class TextDouble {
  constructor(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  appendChild(n) { return n; }
  setAttribute() {}
}

// ---------------------------------------------------------------------
// createDocument — a document double whose createElement yields
// FaithfulNodes. querySelector('#toasts') returns a live node (js/ui.js
// toast() appends to it), everything else a fresh node.
// ---------------------------------------------------------------------
function createDocument() {
  const toastsNode = new FaithfulNode('div');
  const body = new FaithfulNode('body');
  return {
    body,
    createElement: (tag) => new FaithfulNode(tag),
    createTextNode: (text) => new TextDouble(text),
    querySelector: (sel) => (sel === '#toasts' ? toastsNode : new FaithfulNode('div')),
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'toasts' ? toastsNode : null),
    addEventListener() {},
    removeEventListener() {},
    _toastsNode: toastsNode,
  };
}

// ---------------------------------------------------------------------
// makeFakeSupa — a Supabase client double that models the real envelopes.
// Seeded from tests/admin-usuarios.smoke.js makeFakeSupabaseClient (the
// corrected double from UI-INVOKE-ENVELOPE-FIX).
//
//   opts.tableData  : { [table]: rows[] }  — data for from(table) reads.
//   opts.invokeImpl : { [fnName]: (body) => ({ data: <inner>, error }) }
//                     — returns the INNER payload; the fake adds the outer
//                       envelope layer (double wrap) automatically.
//   opts.rpcImpl    : { [fnName]: (params) => ({ data, error }) }  (single
//                     level — .rpc() is NOT double wrapped).
//   opts.writeError : ({ table, op, payload }) => errorObj | null
//                     — inject an error on insert/update/delete/upsert.
//
// Every call is recorded in the returned client's `_calls` array.
// ---------------------------------------------------------------------
function makeFakeSupa(opts = {}) {
  const tableData = opts.tableData || {};
  const invokeImpl = opts.invokeImpl || {};
  const rpcImpl = opts.rpcImpl || {};
  const writeError = opts.writeError || (() => null);
  const calls = [];

  function makeChain(table) {
    const chain = {
      _table: table,
      _write: null,
      select(cols) { calls.push({ op: 'select', table, cols }); return chain; },
      order() { return chain; },
      eq(col, val) { calls.push({ op: 'eq', table, col, val }); return chain; },
      in(col, vals) { calls.push({ op: 'in', table, col, vals }); return chain; },
      limit() { return chain; },
      insert(payload) { calls.push({ op: 'insert', table, payload }); chain._write = { op: 'insert', payload }; return chain; },
      update(payload) { calls.push({ op: 'update', table, payload }); chain._write = { op: 'update', payload }; return chain; },
      delete() { calls.push({ op: 'delete', table }); chain._write = { op: 'delete' }; return chain; },
      upsert(payload) { calls.push({ op: 'upsert', table, payload }); chain._write = { op: 'upsert', payload }; return chain; },
      // single()/maybeSingle() resolve an object (or null), NOT an array —
      // modelling the real PostgREST distinction.
      single() {
        calls.push({ op: 'single', table });
        const rows = tableData[table] || [];
        const err = chain._write ? writeError({ table, ...chain._write }) : null;
        const data = err ? null : (rows.length ? rows[0] : null);
        return Promise.resolve({ data, error: err });
      },
      maybeSingle() {
        calls.push({ op: 'maybeSingle', table });
        const rows = tableData[table] || [];
        const err = chain._write ? writeError({ table, ...chain._write }) : null;
        const data = err ? null : (rows.length ? rows[0] : null);
        return Promise.resolve({ data, error: err });
      },
      // Chain terminal resolves an array under `data`.
      then(resolve, reject) {
        const err = chain._write ? writeError({ table, ...chain._write }) : null;
        const data = err ? null : (tableData[table] || []);
        return Promise.resolve({ data, error: err }).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    from(table) { calls.push({ op: 'from', table }); return makeChain(table); },
    functions: {
      // Faithful double envelope: real invoke() returns the raw parsed
      // body verbatim as `data`, and the Edge Function wrapped its payload
      // in { data: <payload> } — so `data` here is { data: <payload> }.
      invoke: async (name, options) => {
        calls.push({ op: 'invoke', name, body: options && options.body });
        const inner = invokeImpl[name]
          ? await invokeImpl[name](options && options.body)
          : { data: null, error: null };
        if (inner && inner.error) return { data: null, error: inner.error };
        return { data: { data: inner ? inner.data : null }, error: null };
      },
    },
    // .rpc() is single level: the function return is `data` directly.
    rpc: async (name, params) => {
      calls.push({ op: 'rpc', name, params });
      if (rpcImpl[name]) return rpcImpl[name](params);
      return { data: null, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user: null }, error: null }),
    },
    _calls: calls,
  };
}

module.exports = {
  BOOLEAN_ATTRS,
  FaithfulNode,
  TextDouble,
  StyleDouble,
  createDocument,
  makeFakeSupa,
};
