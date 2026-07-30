// =====================================================================
// === tests/handler-state-capture.guard.test.mjs ======================
// Structural guard for a PROVEN production defect class.
//
// Screens build their handler factory BEFORE the loaders that populate
// `state` (js/screens/ordem-compra.js calls ns.createEvents() at line 43 and
// ns.loadOrdemDetail() at line 63). The loaders REASSIGN state fields
// (`state.ordem = res.data.ordem`), so any factory-scope
// `var x = state.<field>` freezes the initial null forever.
//
// That is not a theoretical smell. It shipped: the purchase-order cancel
// handler read such a snapshot, sent `p_ordem_id: undefined`, supabase-js
// dropped the undefined key, PostgREST could not match a zero-argument
// cancelar_ordem_compra() and returned PGRST202 — surfacing to the operator
// only as the generic "Não foi possível concluir a ação.", with the RPC body
// never executed. Fixed at 7c2c364.
//
// The rule this guard enforces is narrow and mechanical:
//   a one-shot handler factory may capture the state CONTAINER, callbacks and
//   route parameters, but never a FIELD of state.
// Reading `state.<field>` lazily inside a handler or render function is the
// correct pattern and is deliberately NOT restricted.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
  return out;
}

const FILES = jsFiles(path.join(ROOT, 'js'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// One-shot handler factories: called once per screen mount, before the loaders.
const FACTORY_RE = /(?:function\s+(create\w*Events|create\w*Handlers)\s*\()|(?:(create\w*Events|create\w*Handlers)\s*[:=]\s*(?:async\s+)?function\s*\()/;

// Every state field any module reassigns — a capture of one of these is stale.
function reassignedFields() {
  const set = new Set();
  for (const rel of FILES) {
    for (const m of read(rel).matchAll(/\bstate\.(\w+)\s*=(?!=)/g)) set.add(m[1]);
  }
  return set;
}

// Declarations at the factory's own scope, i.e. before the first nested
// function of the factory body. Anything deeper runs per call and is safe.
function factoryScopeDeclarations(lines, startIdx) {
  const out = [];
  const base = lines[startIdx].match(/^\s*/)[0].length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    if (indent <= base && /^\s*\}/.test(line)) break;          // factory closed
    if (indent !== base + 2) continue;                          // nested scope
    const decl = line.match(/^\s*(?:var|let|const)\s+(\w+)\s*=\s*(.+)$/);
    if (decl) out.push({ line: i + 1, name: decl[1], init: decl[2].trim() });
  }
  return out;
}

test('no one-shot handler factory captures a reassigned state field', () => {
  const reassigned = reassignedFields();
  assert.ok(reassigned.has('ordem'), 'sanity: state.ordem is a reassigned field');

  const offenders = [];
  let factoriesSeen = 0;

  for (const rel of FILES) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!FACTORY_RE.test(line)) return;
      factoriesSeen++;
      for (const d of factoryScopeDeclarations(lines, i)) {
        const m = d.init.match(/^(?:ctx\.)?state\.(\w+)\b/);
        if (m && reassigned.has(m[1])) {
          offenders.push(`${rel}:${d.line}  var ${d.name} = state.${m[1]}  (state.${m[1]} is reassigned by a loader)`);
        }
      }
    });
  }

  assert.ok(factoriesSeen >= 3, `expected to find the handler factories, saw ${factoriesSeen}`);
  assert.deepEqual(offenders, [],
    'a handler factory froze a state field that its loaders later replace:\n  ' + offenders.join('\n  '));
});

test('the purchase-order factory keeps the container and takes its record at call time', () => {
  const src = read('js/screens/ordem-compra-events.js');
  // The container is held; no field of it is frozen at factory scope.
  assert.match(src, /var state = ctx\.state \|\| \{\};/);
  assert.doesNotMatch(src, /^\s{4}var ordem = state\.ordem/m,
    'the frozen snapshot that broke cancellation must not come back');
  // Both irreversible actions read the current record handed over by render.
  assert.match(src, /cancelar: function \(o\) \{/, 'cancelar takes the current order');
  assert.match(src, /emitir: function \(o\) \{/, 'emitir takes the current order');
  // And neither sends an id it did not resolve.
  assert.match(src, /p_ordem_id: ordemId/, 'cancelar sends the resolved id');
});

test('the render layer actually hands the current record to those handlers', () => {
  const src = read('js/screens/ordem-compra-render.js');
  assert.match(src, /handlers\.cancelar\(o\)/, 'render passes the current order to cancelar');
  assert.match(src, /handlers\.emitir\(o\)/, 'render passes the current order to emitir');
});

test('the sibling factories remain lazy readers (regression protection)', () => {
  for (const [rel, container] of [
    ['js/screens/ordem-compra-receipt-events.js', 'var state = ctx.state || {};'],
    ['js/screens/pedido-detail-events.js', 'var state = ctx.state;'],
  ]) {
    const src = read(rel);
    assert.ok(src.includes(container), rel + ' must keep holding the state container');
  }
  // createReceiptEvents takes its id from the route, never from loaded state.
  assert.match(read('js/screens/ordem-compra-receipt-events.js'), /var ordemId = ctx\.ordemId;/);
  assert.match(read('js/screens/ordem-compra.js'), /createReceiptEvents\(\{[^}]*ordemId: id/s);
});
