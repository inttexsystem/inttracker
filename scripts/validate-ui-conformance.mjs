#!/usr/bin/env node
/* ============================================================
   VALIDATE UI CONFORMANCE — PHASE-4 DETERMINISTIC DETECTOR

   Deterministic. No network, no LLM, no database, no clock, no
   randomness: two runs against an unchanged tree are byte-identical.

   One detector, two front-ends (prototype `.dc.html` and application
   `js/screens/*.js`), one rule engine, one contract reader. The
   numeric enums live in docs/architecture/UI_VISUAL_CONTRACT.md §5
   and are read at run time — they are not duplicated here.

   This tool REPORTS. It never edits a screen, a token file or a
   contract, and it owns no waiver or ignore-list mechanism.

   Usage:
     node scripts/validate-ui-conformance.mjs [--report | --enforce]
          [--rule <RULE_ID>] [--format text|json] [--output <PATH>]
          [--root <DIR>]

   Exit codes:
     0  the scan completed (findings may exist; --report always 0)
     1  --enforce and at least one blocking finding
     2  the detector, its configuration or its inventory failed
   ============================================================ */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { read } from './ui-foundation/inventory.mjs';
import {
  ContractError,
  buildEnums,
  readContract,
  readTokens,
} from './ui-conformance/contract.mjs';
import { buildConformanceInventory } from './ui-conformance/inventory.mjs';
import {
  DETECTOR_VERSION,
  RULE_IDS,
  RULE_NAMES,
  coverageOf,
  runRules,
  sortFindings,
} from './ui-conformance/rules.mjs';
import * as dcHtml from './ui-conformance/frontends/dc-html.mjs';
import * as jsScreen from './ui-conformance/frontends/js-screen.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SEVERITIES = ['blocking', 'debt', 'coverage'];
const COVERAGE_STATES = ['FULL', 'PARTIAL', 'UNSUPPORTED'];
const TABLE_VERDICTS = ['AUTOMATICALLY_PROVEN', 'AUTOMATICALLY_FAILED', 'MANUAL_REVIEW_REQUIRED'];

class UsageError extends Error {}

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    mode: 'report',
    rule: null,
    format: 'text',
    output: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') args.mode = 'report';
    else if (arg === '--enforce') args.mode = 'enforce';
    else if (arg === '--rule') {
      args.rule = argv[i += 1];
      if (!args.rule) throw new UsageError('--rule requires a rule ID.');
      if (!RULE_IDS.includes(args.rule)) {
        throw new UsageError(`Unknown rule ID "${args.rule}". Known: ${RULE_IDS.join(', ')}.`);
      }
    } else if (arg === '--format') {
      args.format = argv[i += 1];
      if (args.format !== 'text' && args.format !== 'json') {
        throw new UsageError('--format accepts only "text" or "json".');
      }
    } else if (arg === '--output') {
      args.output = argv[i += 1];
      if (!args.output) throw new UsageError('--output requires a path.');
    } else if (arg === '--root') {
      const value = argv[i += 1];
      if (!value) throw new UsageError('--root requires a directory.');
      args.root = resolve(value);
    } else {
      throw new UsageError(`Unrecognised argument "${arg}".`);
    }
  }
  return args;
}

function frontEndFor(path) {
  if (/\.html$/i.test(path)) return dcHtml;
  if (/\.m?js$/i.test(path)) return jsScreen;
  return null;
}

/**
 * Severity counters are named apart from the per-file coverage STATE. Reusing
 * the word "coverage" for both silently overwrote the state in an earlier
 * draft, which is precisely the class of bug that turns "not evaluated" into
 * something a reader mistakes for a verdict.
 */
const COUNT_KEY = { blocking: 'blocking', debt: 'debt', coverage: 'coverage_gaps' };

function emptyCounts() {
  const counts = { total: 0 };
  for (const severity of SEVERITIES) counts[COUNT_KEY[severity]] = 0;
  return counts;
}

function tally(counts, finding) {
  counts.total += 1;
  counts[COUNT_KEY[finding.severity]] += 1;
}

/* ---------- scan ---------- */

export function scan(root, { rule = null } = {}) {
  const contract = readContract(root);
  const tokens = readTokens(root);
  const enums = buildEnums(contract);
  const inventory = buildConformanceInventory(root);

  const targets = [
    ...inventory.prototypes.map((p) => ({ ...p, kind: 'prototype' })),
    ...inventory.applications.map((a) => ({ ...a, kind: 'application', name: a.path })),
  ];

  const findings = [];
  const files = [];
  const tables = [];

  for (const target of targets) {
    const frontEnd = frontEndFor(target.path);
    if (!frontEnd) {
      throw new ContractError(
        `No front-end handles "${target.path}"; the inventory and the front-ends disagree.`,
        target.path,
        null,
      );
    }
    const unit = frontEnd.analyse(target.path, read(root, target.path));
    unit.archetype = target.archetype ?? null;

    const unitFindings = runRules(unit, { tokens, enums });
    findings.push(...unitFindings);

    const coverage = coverageOf(unit, unitFindings);
    const counts = emptyCounts();
    for (const finding of unitFindings) tally(counts, finding);

    files.push({
      path: target.path,
      kind: target.kind,
      front_end: unit.frontEnd,
      archetype: unit.archetype,
      declared_state: target.declaredState ?? null,
      coverage,
      indeterminate_sites: unit.indeterminate.length,
      declaration_sites: unit.declarations.length,
      element_sites: unit.elements.length,
      findings: counts,
    });

    for (const table of unit.tables) {
      tables.push({
        path: target.path,
        line: table.line,
        column: table.column,
        verdict: table.verdict,
        context: table.context,
        reason: table.reason,
      });
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  tables.sort((a, b) =>
    a.path === b.path ? a.line - b.line || a.column - b.column : a.path < b.path ? -1 : 1);

  const sorted = sortFindings(findings);

  return {
    detector_version: DETECTOR_VERSION,
    rule_filter: rule,
    contract_path: contract.path,
    contract_blob_hash: contract.hash,
    contract_block_line: contract.blockLine,
    tokens_path: tokens.path,
    inventory: buildInventoryReport(inventory, files),
    coverage_summary: buildCoverageSummary(files),
    findings: sorted,
    summary_by_rule: buildRuleSummary(sorted),
    summary_by_file: buildFileSummary(files),
    summary_by_archetype: buildArchetypeSummary(files, sorted),
    deprecated_token_summary: buildDeprecatedSummary(sorted),
    table_review_summary: buildTableSummary(tables),
    highlights: buildHighlights(sorted, files),
  };
}

function buildInventoryReport(inventory, files) {
  const byKind = (kind) =>
    files
      .filter((f) => f.kind === kind)
      .map((f) => ({
        path: f.path,
        archetype: f.archetype,
        declared_state: f.declared_state,
        coverage: f.coverage,
      }));
  return {
    conformance_document: 'docs/architecture/UI_CONFORMANCE.md',
    prototype: { count: files.filter((f) => f.kind === 'prototype').length, files: byKind('prototype') },
    application: { count: files.filter((f) => f.kind === 'application').length, files: byKind('application') },
    unresolved: inventory.unresolved
      .slice()
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    excluded: inventory.excluded
      .slice()
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    non_screen_rows: inventory.nonScreenRows.slice().sort(),
  };
}

function buildCoverageSummary(files) {
  const summary = { by_front_end: {} };
  for (const state of COVERAGE_STATES) summary[state] = 0;
  for (const file of files) {
    summary[file.coverage] += 1;
    const bucket =
      summary.by_front_end[file.front_end] ??
      (summary.by_front_end[file.front_end] = Object.fromEntries(
        COVERAGE_STATES.map((s) => [s, 0]),
      ));
    bucket[file.coverage] += 1;
  }
  summary.partial_files = files.filter((f) => f.coverage === 'PARTIAL').map((f) => f.path);
  summary.unsupported_files = files.filter((f) => f.coverage === 'UNSUPPORTED').map((f) => f.path);
  return summary;
}

function buildRuleSummary(findings) {
  const summary = {};
  for (const id of ['UIC-000', ...RULE_IDS]) {
    summary[id] = {
      name: id === 'UIC-000' ? 'COVERAGE_GAP' : RULE_NAMES[id],
      ...emptyCounts(),
      files: 0,
    };
  }
  const filesByRule = new Map();
  for (const finding of findings) {
    const entry = summary[finding.rule_id];
    if (!entry) continue;
    tally(entry, finding);
    if (!filesByRule.has(finding.rule_id)) filesByRule.set(finding.rule_id, new Set());
    filesByRule.get(finding.rule_id).add(finding.path);
  }
  for (const [id, set] of filesByRule) summary[id].files = set.size;
  return summary;
}

function buildFileSummary(files) {
  const summary = {};
  for (const file of files) {
    summary[file.path] = {
      front_end: file.front_end,
      archetype: file.archetype,
      coverage: file.coverage,
      indeterminate_sites: file.indeterminate_sites,
      declaration_sites: file.declaration_sites,
      ...file.findings,
    };
  }
  return summary;
}

function buildArchetypeSummary(files, findings) {
  const summary = {};
  const bucket = (key) =>
    summary[key] ??
    (summary[key] = {
      files: 0,
      ...emptyCounts(),
      coverage_states: Object.fromEntries(COVERAGE_STATES.map((s) => [s, 0])),
    });
  for (const file of files) {
    const entry = bucket(file.archetype ?? 'unassigned');
    entry.files += 1;
    entry.coverage_states[file.coverage] += 1;
  }
  const archetypeOf = new Map(files.map((f) => [f.path, f.archetype ?? 'unassigned']));
  for (const finding of findings) {
    tally(bucket(archetypeOf.get(finding.path) ?? 'unassigned'), finding);
  }
  return Object.fromEntries(Object.keys(summary).sort().map((k) => [k, summary[k]]));
}

function buildDeprecatedSummary(findings) {
  const byToken = new Map();
  for (const finding of findings) {
    if (finding.rule_id !== 'UIC-009') continue;
    const token = finding.observed_value;
    if (!byToken.has(token)) byToken.set(token, { references: 0, files: new Set() });
    const entry = byToken.get(token);
    entry.references += 1;
    entry.files.add(finding.path);
  }
  const out = {};
  for (const token of [...byToken.keys()].sort()) {
    const entry = byToken.get(token);
    out[token] = { references: entry.references, files: entry.files.size };
  }
  return out;
}

function buildTableSummary(tables) {
  const summary = { total: tables.length, tables };
  for (const verdict of TABLE_VERDICTS) {
    summary[verdict] = tables.filter((t) => t.verdict === verdict).length;
  }
  return summary;
}

function buildHighlights(findings, files) {
  const count = (predicate) => findings.filter(predicate).length;
  return {
    native_selects: count((f) => f.rule_id === 'UIC-006'),
    cards_with_shadow: count(
      (f) => f.rule_id === 'UIC-004' && f.message.startsWith('Cards are flat'),
    ),
    pill_shaped_buttons: count((f) => f.rule_id === 'UIC-007'),
    action_alignment_coverage_gaps: count(
      (f) => f.rule_id === 'UIC-008' && f.severity === 'coverage',
    ),
    literal_colours: count((f) => f.rule_id === 'UIC-001'),
    // Renamed to match the three-state UIC-001 semantics the names had lagged
    // behind. The predicates are unchanged and equivalent: a proven-visual site
    // always carries the property it was proved on, and an unproven one never
    // does, so `property !== null` is exactly the blocking set.
    literal_visual_colours_blocking: count(
      (f) => f.rule_id === 'UIC-001' && f.property !== null,
    ),
    literal_colour_context_unproven: count(
      (f) => f.rule_id === 'UIC-001' && f.property === null,
    ),
    unknown_token_references: count((f) => f.rule_id === 'UIC-011'),
    deprecated_token_references: count((f) => f.rule_id === 'UIC-009'),
    files_scanned: files.length,
  };
}

/* ---------- reporting ---------- */

function renderText(report, args) {
  const lines = [];
  const push = (line = '') => lines.push(line);

  push(`UI CONFORMANCE DETECTOR ${report.detector_version}`);
  push(`contract   ${report.contract_path}:${report.contract_block_line}`);
  push(`enum hash  ${report.contract_blob_hash}`);
  push(`mode       ${args.mode}${args.rule ? ` --rule ${args.rule}` : ''}`);
  push();

  push('INVENTORY');
  push(`  prototype front-end   ${report.inventory.prototype.count} file(s)`);
  for (const f of report.inventory.prototype.files) {
    push(`    [${f.archetype}] ${f.coverage.padEnd(11)} ${f.path}`);
  }
  push(`  application front-end ${report.inventory.application.count} file(s)`);
  push(`  unresolved rows       ${report.inventory.unresolved.length}`);
  for (const u of report.inventory.unresolved) {
    push(`    [${u.archetype}] ${u.reason}: ${u.name}`);
  }
  if (report.inventory.excluded.length > 0) {
    push(`  excluded rows         ${report.inventory.excluded.length}`);
    for (const e of report.inventory.excluded) push(`    ${e.reason}: ${e.name}`);
  }
  push();

  push('COVERAGE');
  for (const state of COVERAGE_STATES) {
    push(`  ${state.padEnd(12)} ${String(report.coverage_summary[state]).padStart(4)}`);
  }
  for (const [frontEnd, states] of Object.entries(report.coverage_summary.by_front_end)) {
    push(
      `    ${frontEnd.padEnd(10)} ` +
        COVERAGE_STATES.map((s) => `${s}=${states[s]}`).join('  '),
    );
  }
  if (report.coverage_summary.unsupported_files.length > 0) {
    push('  UNSUPPORTED files (no rule was evaluated — NOT conforming):');
    for (const path of report.coverage_summary.unsupported_files) push(`    ${path}`);
  }
  push();

  push('FINDINGS BY RULE');
  for (const [id, entry] of Object.entries(report.summary_by_rule)) {
    if (entry.total === 0) continue;
    push(
      `  ${id} ${entry.name.padEnd(28)} total=${String(entry.total).padStart(5)}` +
        `  blocking=${String(entry.blocking).padStart(5)}` +
        `  debt=${String(entry.debt).padStart(4)}` +
        `  coverage_gaps=${String(entry.coverage_gaps).padStart(4)}` +
        `  files=${entry.files}`,
    );
  }
  push();

  push('FINDINGS BY ARCHETYPE');
  for (const [key, entry] of Object.entries(report.summary_by_archetype)) {
    push(
      `  ${String(key).padEnd(11)} files=${String(entry.files).padStart(3)}` +
        `  blocking=${String(entry.blocking).padStart(5)}` +
        `  debt=${String(entry.debt).padStart(4)}` +
        `  coverage_gaps=${String(entry.coverage_gaps).padStart(4)}` +
        `  [${COVERAGE_STATES.map((s) => `${s}=${entry.coverage_states[s]}`).join(' ')}]`,
    );
  }
  push();

  push('DEPRECATED TOKEN REFERENCES (UIC-009)');
  for (const [token, entry] of Object.entries(report.deprecated_token_summary)) {
    push(`  ${String(entry.references).padStart(4)}  ${token}  (${entry.files} file(s))`);
  }
  push();

  push('TABLE REVIEW');
  for (const verdict of TABLE_VERDICTS) {
    push(`  ${verdict.padEnd(24)} ${String(report.table_review_summary[verdict]).padStart(4)}`);
  }
  push();

  push('HIGHLIGHTS');
  for (const [key, value] of Object.entries(report.highlights)) {
    push(`  ${key.padEnd(32)} ${value}`);
  }
  push();

  const shown = args.rule
    ? report.findings.filter((f) => f.rule_id === args.rule)
    : report.findings;
  push(`FINDINGS (${shown.length}${args.rule ? ` of ${report.findings.length}, filtered by ${args.rule}` : ''})`);
  for (const f of shown) {
    push(
      `  [${f.rule_id}] ${f.severity.toUpperCase()} ${f.path}:${f.line}:${f.column ?? '-'}` +
        `${f.property ? ` ${f.property}` : ''}${f.observed_value ? ` = ${f.observed_value}` : ''}`,
    );
    push(`      ${f.message}`);
    if (f.element_or_context) push(`      context: ${f.element_or_context}`);
  }
  push();

  const blocking = report.findings.filter((f) => f.severity === 'blocking');
  const enforced = args.rule ? blocking.filter((f) => f.rule_id === args.rule) : blocking;
  push(
    `RESULT  blocking=${blocking.length}  enforced=${enforced.length}` +
      `  debt=${report.findings.filter((f) => f.severity === 'debt').length}` +
      `  coverage=${report.findings.filter((f) => f.severity === 'coverage').length}`,
  );
  return `${lines.join('\n')}\n`;
}

/* ---------- entry point ---------- */

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`validate-ui-conformance: ${err.message}`);
    process.exit(2);
  }

  let report;
  try {
    report = scan(args.root, { rule: args.rule });
  } catch (err) {
    const where = err instanceof ContractError && err.path
      ? ` (${err.path}${err.line ? `:${err.line}` : ''})`
      : '';
    console.error(`validate-ui-conformance: ${err.message}${where}`);
    process.exit(2);
  }

  const rendered =
    args.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : renderText(report, args);

  if (args.output) writeFileSync(resolve(args.output), rendered, 'utf8');
  else process.stdout.write(rendered);

  if (args.mode === 'enforce') {
    const blocking = report.findings.filter(
      (f) => f.severity === 'blocking' && (!args.rule || f.rule_id === args.rule),
    );
    process.exit(blocking.length > 0 ? 1 : 0);
  }
  process.exit(0);
}
