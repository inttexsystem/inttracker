#!/usr/bin/env node
/* ============================================================
   VALIDATE UI FOUNDATION

   Deterministic. No network, no LLM, no database.
   Verifies foundation ownership and package integration only —
   it is NOT the phase-4 screen-conformance detector.

   Usage:  node scripts/validate-ui-foundation.mjs [--root <dir>] [--json]

   Exit codes:
     0  PASS  (debt findings may be present)
     1  FAIL  (at least one error finding)
     2  the validator itself could not run
   ============================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { buildInventory } from './ui-foundation/inventory.mjs';
import { runRules } from './ui-foundation/rules.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validate(root) {
  const findings = runRules(buildInventory(root));
  const errors = findings.filter((f) => f.severity === 'error');
  const debt = findings.filter((f) => f.severity === 'debt');
  return { status: errors.length === 0 ? 'PASS' : 'FAIL', findings, errors, debt };
}

function parseArgs(argv) {
  const args = { root: DEFAULT_ROOT, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') args.root = resolve(argv[i + 1] ?? '.');
    else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

function report({ status, findings, errors, debt }, json) {
  if (json) {
    console.log(JSON.stringify({ status, findings }, null, 2));
    return;
  }

  for (const f of errors) {
    console.log(`[${f.rule_id}] ERROR ${f.path}:${f.line_or_location}\n    ${f.message}`);
  }

  if (debt.length > 0) {
    const byRule = new Map();
    for (const f of debt) {
      if (!byRule.has(f.path)) byRule.set(f.path, 0);
      byRule.set(f.path, byRule.get(f.path) + 1);
    }
    console.log(
      `\nDEPRECATED COMPATIBILITY DEBT — ${debt.length} reference(s), permitted during this intake:`,
    );
    for (const [path, count] of [...byRule].sort()) {
      console.log(`  ${count.toString().padStart(3)}  ${path}`);
    }
    console.log('  (run with --json for per-line detail)');
  }

  console.log(`\n${status}  errors=${errors.length}  debt=${debt.length}`);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = validate(args.root);
    report(result, args.json);
    process.exit(result.status === 'PASS' ? 0 : 1);
  } catch (err) {
    console.error(`validate-ui-foundation: ${err.stack || err.message}`);
    process.exit(2);
  }
}
