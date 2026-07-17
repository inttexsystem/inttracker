// =====================================================================
// === tests/_doubles.meta.test.js =====================================
// Meta-tests for the shared canonical doubles (tests/_doubles.js).
//
// MANDATE (CODE_HEALTH_RULES.md §20 / TEST-MOCK-FIDELITY-AUDIT ruling):
// a centralized double must PROVE it catches each defect class it exists
// to catch — otherwise it becomes a single centralized blind spot. These
// tests are the analogue of tests/ui-el-boolean-attrs.smoke.js's self-test
// (lines 162-166), generalized to every class the module models:
//
//   1. DOM boolean-attribute presence coercion (FaithfulNode).
//   2. The double integrates with the REAL js/ui.js el() and reproduces
//      the UI-EL-BOOLEAN-ATTR-FIX behavior end-to-end.
//   3. functions.invoke() double envelope (makeFakeSupa).
//   4. .rpc() single-level envelope + PostgREST single-vs-array.
//
// Runs with: node --test tests/_doubles.meta.test.js
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  BOOLEAN_ATTRS,
  FaithfulNode,
  createDocument,
  makeFakeSupa,
} = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');

// ---------------------------------------------------------------------
// 1. FaithfulNode boolean-attribute presence coercion
// ---------------------------------------------------------------------

test('FaithfulNode: setAttribute(k, false) renders PRESENT — proves it catches the raw-setAttribute regression class', () => {
  // This is the exact pre-fix bug shape (UI-EL-BOOLEAN-ATTR-FIX): a naive
  // el() called setAttribute(k, false). A raw-store double reads that back
  // as falsy and MASKS the bug; a faithful double must render present.
  for (const attr of ['disabled', 'checked', 'selected', 'readonly', 'required', 'hidden']) {
    const node = new FaithfulNode('input');
    node.setAttribute(attr, false);
    assert.equal(node.hasAttribute(attr), true, `${attr}: setAttribute(k,false) must render PRESENT (real DOM), the double must catch it`);
    assert.equal(node[attr], true, `${attr}: coerced property must be true when the attribute is present`);
  }
});

test('FaithfulNode: only removeAttribute clears a boolean attribute (presence + property)', () => {
  const node = new FaithfulNode('input');
  node.setAttribute('disabled', 'disabled');
  assert.equal(node.hasAttribute('disabled'), true);
  assert.equal(node.disabled, true);
  node.removeAttribute('disabled');
  assert.equal(node.hasAttribute('disabled'), false);
  assert.equal(node.disabled, false);
});

test('FaithfulNode: non-boolean attrs keep their literal value (never boolean-coerced)', () => {
  const node = new FaithfulNode('input');
  node.setAttribute('value', 'false');
  assert.equal(node.hasAttribute('value'), true);
  assert.equal(node.getAttribute('value'), 'false', 'value="false" must survive as a literal string');
  assert.equal(node._attrs.value, 'false', 'plain-object _attrs access preserved for existing suites');
});

test('FaithfulNode: style is dual-access (getAttribute + .style.cssText)', () => {
  const node = new FaithfulNode('div');
  node.setAttribute('style', 'color:red;');
  assert.equal(node.getAttribute('style'), 'color:red;');
  assert.equal(node.style.cssText, 'color:red;');
});

test('BOOLEAN_ATTRS mirrors js/ui.js exactly (drift guard)', () => {
  // If js/ui.js's BOOLEAN_ATTRS ever changes, this meta-test fails so the
  // shared double is updated in lockstep — the double must not silently
  // diverge from the primitive it imitates.
  const m = uiSrc.match(/const\s+BOOLEAN_ATTRS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'could not locate BOOLEAN_ATTRS in js/ui.js');
  const uiSet = new Set(m[1].match(/'([a-z]+)'/g).map((s) => s.replace(/'/g, '')));
  assert.deepEqual([...uiSet].sort(), [...BOOLEAN_ATTRS].sort(), 'tests/_doubles.js BOOLEAN_ATTRS must equal js/ui.js BOOLEAN_ATTRS');
});

// ---------------------------------------------------------------------
// 2. End-to-end with the REAL js/ui.js el() — the integration path the
//    adopting suites actually use.
// ---------------------------------------------------------------------

function loadUi() {
  const document = createDocument();
  const sandbox = { document, console, Node: FaithfulNode };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  return sandbox;
}

test('real el() + FaithfulNode: disabled:true present, disabled:false ABSENT (UI-EL-BOOLEAN-ATTR-FIX end-to-end)', () => {
  const sandbox = loadUi();
  const on = vm.runInContext(`window.el('button', { disabled: true })`, sandbox);
  const off = vm.runInContext(`window.el('button', { disabled: false })`, sandbox);
  assert.equal(on.hasAttribute('disabled'), true, 'disabled:true must render present');
  assert.equal(off.hasAttribute('disabled'), false, 'disabled:false must be ABSENT — the fix, verified through the shared double');
  assert.equal(off.disabled, false);
});

test('real el() + FaithfulNode: checkbox checked toggles presence with the value', () => {
  const sandbox = loadUi();
  const checked = vm.runInContext(`window.el('input', { type: 'checkbox', checked: true })`, sandbox);
  const unchecked = vm.runInContext(`window.el('input', { type: 'checkbox', checked: false })`, sandbox);
  assert.equal(checked.hasAttribute('checked'), true);
  assert.equal(unchecked.hasAttribute('checked'), false);
});

test('real actionButton() + FaithfulNode: disabled:false yields no disabled attribute', () => {
  const sandbox = loadUi();
  const btn = vm.runInContext(`window.actionButton({ title: 'X', disabled: false, onclick: () => {} })`, sandbox);
  assert.equal(btn.hasAttribute('disabled'), false, 'safe-disabled pattern: no disabled attribute when not disabled');
});

test('real selectInput() + FaithfulNode: a pre-selected option reflects into select.value (real-DOM behavior)', () => {
  const sandbox = loadUi();
  const sel = vm.runInContext(`window.selectInput({ options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'b' })`, sandbox);
  assert.equal(sel.value, 'b', 'select.value must reflect the pre-selected option — an edit form pre-populates through the faithful double');
  const empty = vm.runInContext(`window.selectInput({ options: [{ value: 'a', label: 'A' }] })`, sandbox);
  assert.equal(empty.value, '', 'no pre-selected option leaves select.value at the placeholder default');
});

// ---------------------------------------------------------------------
// 3. functions.invoke() double envelope (makeFakeSupa)
// ---------------------------------------------------------------------

test('makeFakeSupa.invoke: returns the DOUBLE envelope { data: { data: payload } } — forces a real unwrap', async () => {
  const supa = makeFakeSupa({
    invokeImpl: { 'admin-reset-user-password': () => ({ data: { password: 'gen-123' }, error: null }) },
  });
  const res = await supa.functions.invoke('admin-reset-user-password', { body: { user_id: 'u1' } });
  // Faithful shape: the payload is one level deeper than a flat mock.
  assert.deepEqual(res.data, { data: { password: 'gen-123' } }, 'invoke must double-wrap like the real client + jsonResponse');
  assert.equal(res.data.data.password, 'gen-123', 'the true value lives at data.data.password');
  // The masked-bug shape: a call site that reads one level too shallow gets
  // undefined. A flat mock would have made this pass and hidden the bug.
  assert.equal(res.data.password, undefined, 'a shallow read must be undefined — this is what the flat mock used to mask');
});

test('makeFakeSupa.invoke: error passes through as { data: null, error }', async () => {
  const supa = makeFakeSupa({
    invokeImpl: { 'admin-disable-user': () => ({ data: null, error: { message: 'FORBIDDEN', context: {} } }) },
  });
  const res = await supa.functions.invoke('admin-disable-user', { body: { user_id: 'u1' } });
  assert.equal(res.data, null);
  assert.equal(res.error.message, 'FORBIDDEN');
});

test('makeFakeSupa: the single-central-unwrap contract (mirrors invokeAdminFunction) yields the inner payload', async () => {
  const supa = makeFakeSupa({
    invokeImpl: { 'admin-create-user': () => ({ data: { user_id: 'new-id' }, error: null }) },
  });
  const res = await supa.functions.invoke('admin-create-user', { body: {} });
  const unwrapped = (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
  assert.deepEqual(unwrapped, { user_id: 'new-id' }, 'the production unwrap (res.data.data) recovers the payload');
});

// ---------------------------------------------------------------------
// 4. .rpc() single-level envelope + PostgREST single-vs-array
// ---------------------------------------------------------------------

test('makeFakeSupa.rpc: single-level envelope (NOT double wrapped)', async () => {
  const supa = makeFakeSupa({
    rpcImpl: { 'admin_usuarios_last_sign_in': () => ({ data: [{ id: 'u1', last: 't' }], error: null }) },
  });
  const res = await supa.rpc('admin_usuarios_last_sign_in');
  assert.deepEqual(res.data, [{ id: 'u1', last: 't' }], 'rpc data is the raw function return, single level');
  assert.equal(res.error, null);
});

test('makeFakeSupa from-chain: single() returns an object, chain terminal returns an array', async () => {
  const supa = makeFakeSupa({ tableData: { usuarios: [{ id: 'u1' }, { id: 'u2' }] } });
  const single = await supa.from('usuarios').select('*').eq('id', 'u1').single();
  assert.equal(Array.isArray(single.data), false, 'single() must resolve an object, not an array');
  assert.deepEqual(single.data, { id: 'u1' });
  const list = await supa.from('usuarios').select('*');
  assert.equal(Array.isArray(list.data), true, 'a chain terminal must resolve an array');
  assert.equal(list.data.length, 2);
});

test('makeFakeSupa: writeError injects on the matching mutation', async () => {
  const supa = makeFakeSupa({
    tableData: { clientes: [] },
    writeError: ({ op }) => (op === 'insert' ? { code: '23505', message: 'dup' } : null),
  });
  const res = await supa.from('clientes').insert({ nome: 'x' });
  assert.equal(res.error.code, '23505');
  assert.ok(supa._calls.some((c) => c.op === 'insert' && c.table === 'clientes'));
});
