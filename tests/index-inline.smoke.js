// Smoke D2C-R1 — rewritten for the post-modularization structure
// (TEST-DOUBLE-STALE-ASSERTION-CLEANUP / Lot L2, 2026-07-17).
//
// Original D2C bug: index.html kept `const OP_STATUS_BADGE = {...}` etc. in an
// inline <script>; once js/badges.js (which also declares them) loaded, the
// inline `const` threw `SyntaxError: Identifier ... has already been declared`
// and the screen went blank.
//
// Post-modularization reality (verified): index.html has NO content-bearing
// inline <script> at all — every script is an external module loaded with a
// ?v= cache-buster (§12). The bug is therefore eliminated BY CONSTRUCTION.
// The previous version of this suite asserted against an inline <script> that
// no longer exists (extractInlineScript threw `nenhum <script> inline
// encontrado`) and fetched a fixed dev server on :8765 (ECONNREFUSED when it
// was down). Both were stale-assertion / environment debt, not mock-fidelity.
//
// This rewrite asserts the post-modularization invariant directly, serves the
// page from an ephemeral listen(0) server (no fixed port), keeps the real
// coexistence guard (ui.js + badges.js in one context must not throw a
// duplicate-const error), and adopts the shared createDocument double.
//
// Runs with: node --test tests/index-inline.smoke.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');

const { createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const indexSrc = fs.readFileSync(INDEX, 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
const badgesSrc = fs.readFileSync(path.join(ROOT, 'js', 'badges.js'), 'utf8');

const BADGE_IDENTIFIERS = ['OP_STATUS_BADGE', 'OP_STATUS_LABEL', 'OP_TIPO_LABEL', 'OP_TIPO_BADGE'];

// All non-src <script> bodies with real content (content-bearing inline
// scripts). Empty after full modularization. Never throws — an empty result IS
// the expected post-modularization state.
function inlineScripts(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim() !== '') out.push(m[1]);
  }
  return out;
}

// Minimal DOM context via the shared double, enough to load ui.js + badges.js.
function setupSandbox() {
  const sandbox = { document: createDocument(), console, setTimeout, clearTimeout, URL, URLSearchParams };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

// Serve index.html (+ js/ files) on an ephemeral port and fetch one path.
// Replaces the old fixed :8765 dependency.
function serveAndFetch(reqPath) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath === '/' || urlPath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexSrc);
      } else if (urlPath.startsWith('/js/')) {
        try {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(fs.readFileSync(path.join(ROOT, urlPath.replace(/^\//, '')), 'utf8'));
        } catch (_) { res.writeHead(404); res.end(); }
      } else { res.writeHead(404); res.end(); }
    });
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      const req = http.get({ host: '127.0.0.1', port, path: reqPath }, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; });
        res.on('end', () => { srv.close(); resolve({ status: res.statusCode, body: buf }); });
      });
      req.on('error', (e) => { srv.close(); reject(e); });
      req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    });
  });
}

test('index.html carrega js/badges.js EXATAMENTE UMA VEZ (tolera ?v=)', () => {
  const matches = indexSrc.match(/<script\s+src="js\/badges\.js(?:\?[^"]*)?"\s*><\/script>/g) || [];
  assert.equal(matches.length, 1, `esperado 1 <script src="js/badges.js">, encontrado ${matches.length}`);
});

test('index.html NÃO tem mais nenhum <script> inline com conteúdo (totalmente modularizado)', () => {
  const inline = inlineScripts(indexSrc);
  assert.equal(inline.length, 0,
    `esperado 0 scripts inline (tudo extraído para módulos), encontrado ${inline.length}`);
});

test('identificadores de badges vivem em js/badges.js e em NENHUM script inline (D2C impossível por construção)', () => {
  const inlineJoined = inlineScripts(indexSrc).join('\n');
  for (const id of BADGE_IDENTIFIERS) {
    assert.ok(badgesSrc.includes(id), `${id} deveria estar declarado em js/badges.js`);
    assert.equal(inlineJoined.includes(id), false, `${id} não deveria aparecer em nenhum script inline`);
  }
});

test('js/badges.js declara as funções badgeStatus / badgeTipo (fonte única)', () => {
  assert.match(badgesSrc, /function\s+badgeStatus\s*\(/);
  assert.match(badgesSrc, /function\s+badgeTipo\s*\(/);
});

test('coexistência ui.js + badges.js não lança SyntaxError de duplicate-const', () => {
  const sandbox = setupSandbox();
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  assert.equal(typeof vm.runInContext('typeof el', sandbox), 'string');
  assert.equal(typeof vm.runInContext('badgeStatus', sandbox), 'function');
  assert.equal(typeof vm.runInContext('badgeTipo', sandbox), 'function');
});

test('servidor efêmero (listen(0)): index.html servido carrega js/badges.js depois de js/ui.js, sem inline', async () => {
  const { status, body } = await serveAndFetch('/index.html');
  assert.equal(status, 200);
  assert.ok(body.length > 1000, 'index.html muito curto');
  const uiIdx = body.indexOf('js/ui.js');
  const badgesIdx = body.indexOf('js/badges.js');
  assert.ok(uiIdx > 0, 'js/ui.js não encontrado no body servido');
  assert.ok(badgesIdx > 0, 'js/badges.js não encontrado no body servido');
  assert.ok(uiIdx < badgesIdx, 'js/ui.js deve vir antes de js/badges.js');
  assert.equal(inlineScripts(body).length, 0, 'o body servido não deve ter script inline');
});
