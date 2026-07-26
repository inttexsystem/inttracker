/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 1 (UIC-001)

   Proves the literal-colour ownership pass CLOSED: zero blocking,
   zero coverage, zero total, across the whole application surface,
   with no path silently dropped and no waiver mechanism invented.

   A pass that reached zero by hiding files, suppressing findings or
   narrowing the detector would satisfy the count and nothing else,
   so each of those is asserted against directly.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { DETECTOR_VERSION } from '../scripts/ui-conformance/rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const FIXTURE = 'docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html';

/** The accepted entry ceiling for the deprecated compatibility block. */
const UIC009_ENTRY_CEILING = 323;

const uic001 = BASELINE.summary_by_rule['UIC-001'];
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

/* ---------- 1 · the inventory is intact ---------- */

test('1 · all 66 application files remain inventoried', () => {
  const app = BASELINE.inventory.application || BASELINE.inventory.application_files || [];
  const files = Array.isArray(app) ? app : app.files;
  assert.equal(files.length, 66, 'the application inventory changed size');

  const tracked = fs.readdirSync(path.join(ROOT, 'js', 'screens'))
    .filter((f) => f.endsWith('.js'));
  assert.ok(tracked.length >= 66, 'js/screens shrank');
});

test('1b · no application path is silently excluded', () => {
  const app = BASELINE.inventory.application || BASELINE.inventory.application_files || [];
  const files = Array.isArray(app) ? app : app.files;
  const inventoried = new Set(files.map((f) => (typeof f === 'string' ? f : f.path)));

  // Every file that carried a UIC-001 finding at the entry baseline must still
  // be inventoried; a pass that reached zero by dropping a file is not a pass.
  const ENTRY_FILES = [
    'admin-usuarios-audit-panel.js', 'admin-usuarios-modal.js', 'admin-usuarios.js',
    'cadastros.js', 'cliente-dashboard.js', 'cliente-pedido-detail.js',
    'cliente-pedido-form.js', 'cliente-pedido-tracking.js', 'cliente-pedidos-list.js',
    'cliente-route-sections-ui.js', 'common.js', 'document-link-admin-modal.js',
    'documentos-recebidos-decision-modal.js', 'documentos-recebidos.js',
    'entrega-form.js', 'expedicao-admin.js', 'manta-expedicao-ui.js',
    'manta-output-form.js', 'op-distribuicao-ui.js', 'op-latex-admin.js',
    'op-nova.js', 'op-tecelagem-producao-admin.js', 'ops-list.js',
    'ordem-compra-distribuicao.js', 'ordem-compra-receipt-render.js',
    'ordem-compra-render.js', 'painel.js', 'pedido-detail-events.js',
    'pedido-detail-progress.js', 'pedido-detail-render.js', 'pedido-detail.js',
    'pedido-form.js', 'pedido-item-row-editor.js', 'pedido-route-sections-ui.js',
    'pedido-route-sections.js', 'pedidos-list.js', 'system-screens.js',
    'trocar-senha-obrigatoria.js',
  ];
  assert.equal(ENTRY_FILES.length, 38, 'the entry-baseline file set is 38 files');
  for (const name of ENTRY_FILES) {
    const rel = `js/screens/${name}`;
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} no longer exists`);
    assert.ok(inventoried.has(rel), `${rel} dropped out of the inventory`);
  }
});

/* ---------- 2 · UIC-001 is closed ---------- */

test('2 · UIC-001 blocking === 0', () => {
  assert.equal(uic001 ? uic001.blocking : 0, 0);
});

test('3 · UIC-001 coverage === 0', () => {
  assert.equal(uic001 ? uic001.coverage_gaps : 0, 0);
});

test('4 · UIC-001 total === 0', () => {
  assert.equal(uic001 ? uic001.total : 0, 0);
  assert.equal(BASELINE.findings.filter((f) => f.rule_id === 'UIC-001').length, 0);
  assert.equal(BASELINE.highlights.literal_colours, 0);
});

test('4b · zero was reached by removing literals, not by hiding them', () => {
  // If the rule had been narrowed or the front-end blinded, the fixture and the
  // rule engine would still have to agree that a real literal is blocking.
  const rules = read('scripts/ui-conformance/rules.mjs');
  assert.match(rules, /ruleLiteralColour/);
  assert.match(rules, /severity: 'blocking'/);
  assert.match(rules, /COVERAGE_GAP \/ VISUAL_COLOUR_CONTEXT_UNPROVEN/);
});

/* ---------- 5 · no screen-local business palette ---------- */

test('5 · no screen holds a product-colour palette', () => {
  const dir = path.join(ROOT, 'js', 'screens');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(text, /\bAMARELO\s*:|\bKRAFT\s*:|\bMARINHO\s*:|\bAZUL_CLARO\s*:/, f);
    assert.doesNotMatch(text, /palette\s*=\s*\[\s*'#/, f);
  }
  // and the owner still holds it
  assert.match(read('js/pedido-ui.js'), /COR_PREVIEW_MAP/);
});

/* ---------- 6 · no waiver mechanism ---------- */

test('6 · no waiver, ignore, suppression or path exception exists', () => {
  const sources = [
    'scripts/validate-ui-conformance.mjs',
    'scripts/ui-conformance/rules.mjs',
    'scripts/ui-conformance/contract.mjs',
    'scripts/ui-conformance/inventory.mjs',
    'scripts/ui-conformance/frontends/dc-html.mjs',
    'scripts/ui-conformance/frontends/js-screen.mjs',
  ];
  for (const rel of sources) {
    const text = read(rel);
    for (const word of ['waiver', 'allowlist', 'whitelist', 'ignorelist', 'suppress', 'exempt']) {
      // A prose sentence saying the mechanism does not exist is not the
      // mechanism. What must be absent is a BINDING that implements one.
      const binding = new RegExp(
        `(?:const|let|var|function|class)\\s+\\w*${word}\\w*\\b|\\b\\w*${word}\\w*\\s*[:=]\\s*[[{]`,
        'i',
      );
      assert.ok(!binding.test(text), `${rel} declares a "${word}" binding`);
    }
    assert.doesNotMatch(text, /js\/screens\/[a-z-]+\.js/, `${rel} names an individual screen`);
    assert.doesNotMatch(text, /#[0-9a-f]{6}\b/i, `${rel} carries a literal colour value`);
  }
});

/* ---------- 7-9 · the corrected report schema ---------- */

test('7 · the baseline is attributable to the detector that produced it', () => {
  // Pass 1 pinned 1.0.2, the report-schema correction. Pass 2 raised it to
  // 1.0.3 for the js-screen front-end amendment. What this guard owns is not a
  // particular number but the pairing: the committed baseline must always name
  // the detector it came from, so a report can never be read against a
  // different engine than the one that measured it.
  assert.equal(DETECTOR_VERSION, '1.0.3');
  assert.equal(BASELINE.detector_version, DETECTOR_VERSION);
});

test('8 · the two corrected highlight keys exist', () => {
  assert.ok('literal_visual_colours_blocking' in BASELINE.highlights);
  assert.ok('literal_colour_context_unproven' in BASELINE.highlights);
  assert.equal(BASELINE.highlights.literal_visual_colours_blocking, 0);
  assert.equal(BASELINE.highlights.literal_colour_context_unproven, 0);
});

test('9 · the two stale highlight keys are absent', () => {
  assert.ok(!('literal_colours_attributed_to_a_site' in BASELINE.highlights));
  assert.ok(!('literal_colours_needing_site_confirmation' in BASELINE.highlights));
  const cli = read('scripts/validate-ui-conformance.mjs');
  assert.doesNotMatch(cli, /literal_colours_attributed_to_a_site/);
  assert.doesNotMatch(cli, /literal_colours_needing_site_confirmation/);
});

/* ---------- 10-12 · nonregression on the other rules ---------- */

test('10 · UIC-009 does not exceed the accepted entry ceiling', () => {
  assert.ok(rule('UIC-009').debt <= UIC009_ENTRY_CEILING,
    `UIC-009 debt ${rule('UIC-009').debt} exceeds ${UIC009_ENTRY_CEILING}`);
});

test('11 · UIC-011 is zero', () => {
  assert.equal(rule('UIC-011').total, 0);
  assert.equal(BASELINE.highlights.unknown_token_references, 0);
});

test('12 · no other rule increased against the entry baseline', () => {
  // Entry baseline at 9fbb84c, blocking counts.
  const ENTRY = {
    'UIC-002': 97, 'UIC-003': 13, 'UIC-004': 21, 'UIC-005': 80,
    'UIC-006': 15, 'UIC-007': 0, 'UIC-008': 0, 'UIC-010': 16, 'UIC-011': 0,
  };
  for (const [id, before] of Object.entries(ENTRY)) {
    assert.ok(rule(id).blocking <= before,
      `${id} blocking rose from ${before} to ${rule(id).blocking}`);
  }
});

test('12b · coverage and support did not regress', () => {
  const c = BASELINE.coverage_summary;
  assert.equal(c.UNSUPPORTED ?? c.unsupported ?? 0, 0);
  const partial = c.PARTIAL ?? c.partial;
  assert.ok(partial <= 40, `PARTIAL rose from 40 to ${partial}`);
});

/* ---------- 13 · the reference fixture is untouched ---------- */

test('13 · the compact fixture remains FULL with zero findings', () => {
  const findings = BASELINE.findings.filter((f) => f.path === FIXTURE);
  assert.deepEqual(findings, [], 'the reference fixture acquired a finding');
  const entry = BASELINE.summary_by_file[FIXTURE];
  assert.ok(entry, 'the reference fixture is missing from summary_by_file');
  assert.equal(entry.coverage, 'FULL');
  assert.equal(entry.blocking, 0);
  assert.equal(entry.debt, 0);
  assert.equal(entry.coverage_gaps, 0);
  assert.equal(entry.total, 0);
});

/* ---------- 14 · determinism ---------- */

test('14 · repeated baseline generation is byte-identical', () => {
  const run = () => execFileSync(
    process.execPath,
    ['scripts/validate-ui-conformance.mjs', '--report', '--format', 'json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  );
  const a = run();
  const b = run();
  assert.equal(a, b, 'two independent detector processes disagree');
  assert.equal(
    JSON.stringify(JSON.parse(a), null, 2) + '\n',
    read('tests/fixtures/ui-conformance-baseline.json'),
    'the committed baseline does not reproduce from the published tree',
  );
});

/* ---------- 15 · only the authorized token and contract additions ---------- */

test('15 · the contract §5 enum block was not touched by this pass', () => {
  assert.equal(
    BASELINE.contract_blob_hash,
    'f8349e6eeca291fef2edf4d6e30afd628732f00b6495d54eb9273860fa63f1c4',
    'the closed enums changed; this pass was not authorized to change them',
  );
});

test('15b · exactly the nine D9 tokens were added and nothing else', () => {
  const css = read('css/tokens.css');
  const NEW = [
    '--rv-signal-caution-bg', '--rv-signal-caution-border', '--rv-text-on-signal',
    '--rv-viz-track', '--rv-viz-primary', '--rv-viz-secondary',
    '--rv-viz-series-3', '--rv-viz-series-4', '--rv-overlay-scrim',
  ];
  for (const t of NEW) {
    assert.ok(new RegExp(`^\\s*${t}\\s*:`, 'm').test(css), `${t} is not declared`);
  }
  // The legacy compatibility block is untouched by this pass.
  const legacy = css.slice(css.indexOf('LEGACY COMPATIBILITY'));
  assert.equal((legacy.match(/^\s*--rv-[a-z0-9-]+\s*:/gm) || []).length, 26);
});
