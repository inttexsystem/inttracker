// Focused deterministic guard for GOVERNANCE-PROPORTIONAL-EXECUTION-AND-DEBT-CAPTURE-R1.
//
// This suite pins the EXECUTION CONTRACT, not prose style. It exists because the
// contract is only worth anything if it cannot be silently dropped: the failure
// mode it guards against is a future edit quietly removing the full-suite
// prohibition, the debt-capture classifications, or the execution envelope, and
// nothing noticing.
//
// It is deliberately narrow. It asserts that the two normative owners declare
// the binding terms and that the two documents do not contradict each other on
// the one rule they share (full-suite opt-in). It does NOT assert wording,
// ordering or section numbering, so ordinary editorial work stays free.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTRUCTIONS_PATH = 'docs/governance/AGENT_INSTRUCTIONS.md';
const CODE_HEALTH_PATH = 'docs/architecture/CODE_HEALTH_RULES.md';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const instructions = read(INSTRUCTIONS_PATH);
const codeHealth = read(CODE_HEALTH_PATH);

// -----------------------------------------------------------------------------
// 1. Execution profiles
// -----------------------------------------------------------------------------

test('both execution profiles are declared and bound to risk classes', () => {
  assert.match(instructions, /`FAST`/, 'FAST profile must be declared');
  assert.match(instructions, /`ASSURANCE`/, 'ASSURANCE profile must be declared');
  // FAST must be the default for the low risk classes, ASSURANCE for the high ones.
  for (const rc of ['`R0`', '`R1`', '`R2`']) {
    assert.ok(instructions.includes(rc), `FAST default risk class ${rc} must be named`);
  }
  for (const rc of ['`R3`', '`R4`']) {
    assert.ok(instructions.includes(rc), `ASSURANCE default risk class ${rc} must be named`);
  }
});

// -----------------------------------------------------------------------------
// 2. Mandatory execution envelope — all twelve fields
// -----------------------------------------------------------------------------

const ENVELOPE_FIELDS = [
  'RISK_CLASS',
  'EXECUTION_PROFILE',
  'TIME_BUDGET',
  'DECIDED_FACTS',
  'AUTHORIZED_READS',
  'AUTHORIZED_CHANGES',
  'VALIDATION_MANIFEST',
  'FULL_SUITE_POLICY',
  'DOCUMENTATION_MODE',
  'EXPANSION_GATE',
  'DEBT_CAPTURE_MODE',
  'STOP_CONDITION',
];

test('every mandatory execution-envelope field is declared', () => {
  const missing = ENVELOPE_FIELDS.filter((f) => !instructions.includes(f));
  assert.deepEqual(missing, [],
    'the execution envelope must declare every field; missing: ' + missing.join(', '));
});

// -----------------------------------------------------------------------------
// 3. Full-suite opt-in — the rule both documents share
// -----------------------------------------------------------------------------

test('full-suite execution requires the explicit FULL_SUITE_POLICY opt-in', () => {
  assert.match(instructions, /FULL_SUITE_POLICY:\s*AUTHORIZED/,
    'the explicit opt-in token must appear in the governance owner');
  assert.match(instructions, /prohibited/i,
    'the full suite must be described as prohibited without the opt-in');
});

test('CODE_HEALTH_RULES does not contradict the governance owner on full-suite opt-in', () => {
  // The one rule both files state. If a future edit relaxes it in either place
  // the two owners disagree, which §1 forbids.
  assert.match(codeHealth, /FULL_SUITE_POLICY:\s*AUTHORIZED/,
    'CODE_HEALTH_RULES must carry the same explicit opt-in token');
  assert.match(codeHealth, /AGENT_INSTRUCTIONS\.md/,
    'CODE_HEALTH_RULES must point at the owning document rather than restate authority');
});

// -----------------------------------------------------------------------------
// 4. Report-only treatment of accepted baseline failures
// -----------------------------------------------------------------------------

test('accepted failure identities are report-only', () => {
  assert.match(instructions, /report-only/i,
    'accepted failure identities must be declared report-only');
  assert.match(instructions, /re-baseline/i,
    'the prohibition on re-baselining accepted failures must be explicit');
});

// -----------------------------------------------------------------------------
// 5. Debt capture — all four classifications and the fixed treatment
// -----------------------------------------------------------------------------

const CLASSIFICATIONS = [
  'BLOCKING',
  'NONBLOCKING_MATERIAL_DEBT',
  'ACCEPTED_BASELINE',
  'OPTIONAL_IMPROVEMENT',
];

test('all four debt classifications and the report section are declared', () => {
  const missing = CLASSIFICATIONS.filter((c) => !instructions.includes(c));
  assert.deepEqual(missing, [],
    'every debt classification must be declared; missing: ' + missing.join(', '));
  assert.ok(instructions.includes('OUT_OF_SCOPE_OBSERVATIONS'),
    'the mandatory report section must be declared');
});

test('debt capture is mandatory and cannot be silently dropped', () => {
  assert.match(instructions, /No inconsistency may be silently ignored/i,
    'the non-silence rule must be stated verbatim enough to survive editing');
});

// -----------------------------------------------------------------------------
// 6. System health gate is separate from routine execution
// -----------------------------------------------------------------------------

test('the system health gate is a separate authorized operation in both owners', () => {
  assert.match(instructions, /system health gate/i,
    'the governance owner must declare the system health gate');
  assert.match(instructions, /separate authorized operation/i,
    'the gate must be declared a separate authorized operation');
  assert.match(codeHealth, /SYSTEM HEALTH GATE/i,
    'the periodic audit must be identified as the system health gate');
});

// -----------------------------------------------------------------------------
// 7. Structural sanity — the guarded documents still exist and are non-trivial
// -----------------------------------------------------------------------------

test('both normative owners are present and non-trivial', () => {
  for (const [rel, src] of [[INSTRUCTIONS_PATH, instructions], [CODE_HEALTH_PATH, codeHealth]]) {
    assert.ok(src.length > 2000, rel + ' is unexpectedly small — possible truncation');
    assert.equal(src.includes('�'), false, rel + ' contains a replacement character (encoding damage)');
  }
});
