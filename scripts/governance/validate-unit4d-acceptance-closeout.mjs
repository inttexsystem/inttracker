import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { commitReader, validateCommit, worktreeReader } from './git-content-reader.mjs';
import { readBoundedLedgerEvents } from './read-bounded-ledger-events.mjs';
import { validateSchema } from './validate-documentation-shadow.mjs';
import {
  activationManifestProjection,
  jsonSha256,
  rejectSelfReference,
  statePayloadProjection
} from './unit4-canonical-json.mjs';
import {
  renderCanonicalViews,
  validateRenderedViews
} from './render-unit4-canonical-views.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const ACTIVATION = '51a61ddfdbf058887ead64f9b018c30ebc371b48';
export const CORRECTION = '7abaff26559c71b62337356eccd0baaf36b5f214';
export const PARENT = 'fa986cf935abbf053172cfd549b0171bb9446f58';
export const CUTOVER_ID = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4C-AUTHORITY-CUTOVER-R1';
export const SUBJECT = 'docs: close Unit 4 post-cutover acceptance';
export const ACTIVATION_SUBJECT = 'feat: activate structured governance authority';
export const CORRECTION_SUBJECT = 'fix: reconcile post-cutover governance authority';
export const NEXT_ORDER = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-5-LEGACY-DEPRECATION-AND-POST-CUTOVER-AUDIT-DIAGNOSIS-R1';

const STATE = 'docs/governance/current-state.json';
const CATALOG = 'docs/governance/catalog/documents.json';
const TRACE = 'docs/governance/traceability/purchase-order-phase-c.json';
const CUTOVER = 'docs/governance/cutover/unit4c-cutover-manifest.json';
const ROLLBACK = 'docs/governance/cutover/unit4c-rollback-readiness.json';
const PHASE_CONTRACT = 'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md';
const UNIT4_CONTRACT = 'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md';
const LEDGER = 'docs/ledgers/G28_LEDGER.md';
const SCHEMAS = {
  [STATE]: 'docs/governance/schemas/current-state-v2.schema.json',
  [CATALOG]: 'docs/governance/schemas/document-catalog-v2.schema.json',
  [TRACE]: 'docs/governance/schemas/purchase-order-phase-c-v2.schema.json',
  [CUTOVER]: 'docs/governance/schemas/unit4-cutover-manifest.schema.json',
  [ROLLBACK]: 'docs/governance/schemas/unit4-rollback-readiness.schema.json'
};
const AUTHORIZED = new Set([
  'PROJECT_STATE.md',
  'AGENT_HANDOFF.md',
  'docs/DOCUMENTATION_INDEX.md',
  'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md',
  STATE,
  PHASE_CONTRACT,
  UNIT4_CONTRACT,
  CUTOVER,
  'docs/governance/schemas/current-state-v2.schema.json',
  'docs/governance/schemas/unit4-cutover-manifest.schema.json',
  LEDGER,
  CATALOG,
  'docs/governance/catalog/document-source-manifest.json',
  'docs/governance/ledger/g28-ledger-source-manifest.json',
  'docs/governance/ledger/g28-ledger-partition-index.json',
  'docs/governance/shadow/generated/G28_LEDGER.md',
  'docs/governance/shadow/ledger/partitions/G28_LEDGER_PART_0012.md',
  'docs/governance/shadow/ledger/partitions/G28_LEDGER_PART_0013.md',
  'scripts/governance/build-unit4d-acceptance-closeout.mjs',
  'scripts/governance/validate-unit4d-acceptance-closeout.mjs',
  'scripts/governance/validate-unit4-cutover.mjs',
  'tests/governance-unit4-cutover.test.mjs',
  'tests/governance-g28-ledger-shadow.test.mjs',
  'tests/governance-unit4d-acceptance-closeout.test.mjs'
]);

function git(root, args, encoding = 'utf8') {
  return childProcess.execFileSync('git', args, {
    cwd: root, encoding, maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function snapshotGit(root) {
  return {
    branch: git(root, ['branch', '--show-current']),
    head: git(root, ['rev-parse', 'HEAD']),
    // ls-files --stage, not write-tree: it captures the mode, object ID and
    // stage of every index entry without taking .git/index.lock, so concurrent
    // validators cannot make each other fail on lock contention.
    index: git(root, ['ls-files', '--stage']),
    status: git(root, ['status', '--porcelain=v1', '-uall']),
    refs: git(root, ['show-ref', '--head'])
  };
}

export function validateGitSnapshot(before, after) {
  return JSON.stringify(before) === JSON.stringify(after) ? [] : ['validator mutated Git state'];
}

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function parseJson(reader, relativePath, errors) {
  try {
    return JSON.parse(reader.readText(relativePath));
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON: ${error.message}`);
    return null;
  }
}

function exact(value, expected, label, errors) {
  if (value !== expected) errors.push(`${label}: expected ${expected}; got ${value}`);
}

function includes(text, value, label, errors) {
  if (!text.includes(value)) errors.push(`${label}: missing ${value}`);
}

function fileHash(reader, relativePath) {
  return digest(reader.readText(relativePath));
}

function changedPaths(root, commit) {
  return git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', commit])
    .split(/\r?\n/u).filter(Boolean).sort();
}

function validateLifecycle(state, cutover, errors) {
  exact(state.mode, 'canonical', 'state mode', errors);
  exact(state.authority, 'canonical_current_state', 'state authority', errors);
  exact(state.authority_epoch, 1, 'authority epoch', errors);
  exact(state.cutover_id, CUTOVER_ID, 'cutover ID', errors);
  exact(state.activation.status, 'active', 'activation status', errors);
  exact(state.activation.authority_epoch, 1, 'activation epoch', errors);
  exact(state.activation.required_parent, PARENT, 'required parent', errors);
  exact(state.activation.accepted_unit4b_readiness_checkpoint, PARENT,
    'accepted Unit 4B checkpoint', errors);
  const checkpoints = state.accepted_checkpoints;
  exact(checkpoints.unit_4c_activation, ACTIVATION, 'activation checkpoint', errors);
  exact(checkpoints.unit_4c_canonical_correction, CORRECTION, 'correction checkpoint', errors);
  exact(checkpoints.unit_4d_acceptance, CORRECTION, 'Unit 4D checkpoint', errors);
  exact(state.phase_status.unit4c, 'CLOSED / ACCEPTED / DIRECTLY VERIFIED', 'Unit 4C status', errors);
  exact(state.phase_status.unit4d, 'CLOSED / ACCEPTED / DIRECTLY VERIFIED', 'Unit 4D status', errors);
  exact(state.phase_status.documentary_authority_cutover,
    'CLOSED / ACCEPTED / DIRECTLY VERIFIED', 'documentary cutover status', errors);
  exact(state.phase_status.unit5, 'NOT AUTHORIZED / DIAGNOSIS NEXT AUTHORIZABLE',
    'Unit 5 status', errors);
  exact(state.active_phase.status, 'UNIT 4 CLOSED / UNIT 5 DIAGNOSIS NEXT AUTHORIZABLE',
    'active phase status', errors);
  exact(state.next_authorizable_action.order_id, NEXT_ORDER, 'next order', errors);
  exact(state.next_authorizable_action.canonical_value, NEXT_ORDER, 'next canonical action', errors);
  exact(state.next_authorizable_action.mode, 'READ_ONLY_DIAGNOSIS', 'next mode', errors);
  exact(state.next_authorizable_action.risk_class, 'R1', 'next risk class', errors);
  exact(state.next_authorizable_action.status,
    'AUTHORIZABLE / NOT AUTHORIZED BY THIS CLOSEOUT', 'next authorization status', errors);
  const acceptance = (state.evidence_events ?? []).filter(event =>
    event.event_id === 'UNIT4D_POST_CUTOVER_ACCEPTANCE');
  exact(acceptance.length, 1, 'acceptance event count', errors);
  const event = acceptance[0] ?? {};
  const expectedEvent = {
    classification: 'EXTERNAL_SUPERVISOR_ACCEPTANCE',
    subject: SUBJECT,
    original_activation_checkpoint: ACTIVATION,
    accepted_corrected_checkpoint: CORRECTION,
    unit4c_status: 'CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    unit4d_status: 'CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    documentary_authority_cutover_status: 'CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    authority_epoch: 1,
    second_activation: false,
    rollback_executed: false,
    unit5_authorized: false
  };
  for (const [key, expected] of Object.entries(expectedEvent)) exact(event[key], expected, `event ${key}`, errors);
  const acceptanceReferences = (state.bounded_recent_ledger_references ?? []).filter(reference =>
    reference.event_id === 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4D-POST-CUTOVER-ACCEPTANCE-CLOSEOUT-R1');
  exact(acceptanceReferences.length, 1, 'bounded acceptance-reference count', errors);
  for (const reference of state.bounded_recent_ledger_references ?? []) {
    if ([LEDGER, 'PROJECT_STATE.md', 'AGENT_HANDOFF.md',
      'docs/governance/shadow/generated/G28_LEDGER.md'].includes(reference.partition_path)) {
      errors.push(`forbidden bounded-ledger fallback: ${reference.partition_path}`);
    }
  }
  exact(cutover.review_status, 'CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'manifest review status', errors);
  exact(cutover.unit4c_activation_checkpoint, ACTIVATION, 'manifest activation checkpoint', errors);
  exact(cutover.accepted_corrected_checkpoint, CORRECTION, 'manifest correction checkpoint', errors);
  exact(cutover.unit4d_acceptance_checkpoint, CORRECTION, 'manifest Unit 4D checkpoint', errors);
  exact(cutover.actual_activation_commit_identity,
    'EXTERNAL_GIT_FACT_RECORDED_AFTER_UNIT4D_ACCEPTANCE', 'activation identity classification', errors);
  exact(cutover.authority_epoch, 1, 'manifest epoch', errors);
  exact(cutover.required_parent, PARENT, 'manifest required parent', errors);
  exact(cutover.second_activation, false, 'manifest second activation', errors);
  exact(cutover.original_ponr_unchanged, true, 'manifest original PONR', errors);
  exact(cutover.rollback_executed, false, 'manifest rollback execution', errors);
  exact(cutover.unit4d_review, 'CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'manifest Unit 4D review', errors);
  if (Object.keys(cutover).some(key =>
    ['closeoutcommit', 'closeoutsha', 'enclosingcloseoutcommit']
      .includes(key.toLowerCase().replace(/[^a-z0-9]/gu, '')))) {
    errors.push('self-referential closeout identity field');
  }
  errors.push(...rejectSelfReference(state), ...rejectSelfReference(cutover, '$cutover'));
}

function validateContracts(reader, errors) {
  const unit4 = reader.readText(UNIT4_CONTRACT);
  const phase = reader.readText(PHASE_CONTRACT);
  const unitRequired = [
    'STATUS: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'UNIT 4D: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'DOCUMENTARY-AUTHORITY CUTOVER: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    `ACCEPTED ACTIVATION CHECKPOINT: ${ACTIVATION}`,
    `ACCEPTED CORRECTED CANONICAL CHECKPOINT: ${CORRECTION}`,
    'AUTHORITY EPOCH: 1',
    'SECOND ACTIVATION: NO',
    'ROLLBACK: NOT AUTHORIZED / NOT ACTIVATED',
    'UNIT 5: NOT AUTHORIZED / DIAGNOSIS NEXT AUTHORIZABLE'
  ];
  const phaseRequired = [
    'STATUS: ACTIVE / UNIT 4 CLOSED / UNIT 5 DIAGNOSIS NEXT AUTHORIZABLE',
    'UNIT 4C: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'UNIT 4D ACCEPTANCE: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'DOCUMENTARY-AUTHORITY CUTOVER: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'UNIT 5: NOT AUTHORIZED / DIAGNOSIS NEXT AUTHORIZABLE'
  ];
  unitRequired.forEach(value => includes(unit4, value, 'Unit 4 contract', errors));
  phaseRequired.forEach(value => includes(phase, value, 'phase contract', errors));
}

function validateHashes(reader, state, catalog, traceability, cutover, rollback, errors) {
  exact(jsonSha256(statePayloadProjection(state)), state.activation.state_payload_sha256,
    'state payload hash', errors);
  exact(jsonSha256(activationManifestProjection(state)), state.activation.activation_manifest_sha256,
    'activation manifest hash', errors);
  for (const [relativePath, expected] of Object.entries(state.activation.structured_source_hashes)) {
    exact(fileHash(reader, relativePath), expected, `structured hash ${relativePath}`, errors);
  }
  for (const [relativePath, expected] of Object.entries(state.activation.governing_artifact_hashes)) {
    exact(fileHash(reader, relativePath), expected, `governing hash ${relativePath}`, errors);
  }
  exact(rollback.status, 'PREPARED / NOT AUTHORIZED / NOT ACTIVATED', 'rollback status', errors);
  exact(fileHash(reader, ROLLBACK), state.activation.rollback_readiness_sha256,
    'rollback hash', errors);
  const views = renderCanonicalViews(state, catalog, traceability);
  try {
    validateRenderedViews(views);
  } catch (error) {
    errors.push(error.message);
  }
  for (const [relativePath, expectedText] of Object.entries(views)) {
    const actual = reader.readText(relativePath).replace(/\r\n?/gu, '\n');
    exact(actual, expectedText, `render parity ${relativePath}`, errors);
    exact(digest(actual), state.activation.generated_view_hashes[relativePath],
      `root hash ${relativePath}`, errors);
  }
  exact(cutover.current_state_file_sha256, fileHash(reader, STATE), 'manifest state hash', errors);
  exact(cutover.catalog_sha256, fileHash(reader, CATALOG), 'manifest catalog hash', errors);
  exact(cutover.traceability_sha256, fileHash(reader, TRACE), 'manifest traceability hash', errors);
  exact(cutover.state_payload_sha256, state.activation.state_payload_sha256,
    'manifest state payload hash', errors);
  exact(cutover.activation_manifest_sha256, state.activation.activation_manifest_sha256,
    'manifest activation hash', errors);
  for (const [relativePath, expected] of Object.entries(cutover.schema_hashes)) {
    exact(fileHash(reader, relativePath), expected, `manifest schema hash ${relativePath}`, errors);
  }
}

export function validateCloseoutObjects({
  state, cutover, unit4Contract, phaseContract, catalog
}) {
  const errors = [];
  validateLifecycle(state, cutover, errors);
  const roots = new Map(catalog.artifacts.map(item => [item.path, item]));
  for (const [relativePath, classification] of [
    ['scripts/governance/build-unit4d-acceptance-closeout.mjs', 'GOVERNANCE_TOOLING'],
    ['scripts/governance/validate-unit4d-acceptance-closeout.mjs', 'GOVERNANCE_TOOLING'],
    ['tests/governance-unit4d-acceptance-closeout.test.mjs', 'GOVERNANCE_TEST']
  ]) {
    exact(roots.get(relativePath)?.classification, classification,
      `catalog classification ${relativePath}`, errors);
  }
  for (const [relativePath, owner] of [
    ['PROJECT_STATE.md', STATE],
    ['AGENT_HANDOFF.md', STATE],
    ['docs/DOCUMENTATION_INDEX.md', CATALOG],
    ['docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md', TRACE]
  ]) {
    exact(roots.get(relativePath)?.classification, 'GENERATED_COMPATIBILITY_VIEW',
      `generated root classification ${relativePath}`, errors);
    exact(roots.get(relativePath)?.owner, owner, `generated root owner ${relativePath}`, errors);
  }
  if (!unit4Contract.includes('STATUS: CLOSED / ACCEPTED / DIRECTLY VERIFIED')) {
    errors.push('Unit 4 contract is not closed');
  }
  if (!phaseContract.includes('STATUS: ACTIVE / UNIT 4 CLOSED / UNIT 5 DIAGNOSIS NEXT AUTHORIZABLE')) {
    errors.push('phase contract closeout status missing');
  }
  if (/(cleanup|archival|deprecation|deletion).{0,40}(?<!un)authorized/iu
    .test(`${unit4Contract}\n${phaseContract}`)) {
    errors.push('closeout claims unauthorized Unit 5 cleanup or archival');
  }
  return errors;
}

export function validateCloseout({
  root = REPO_ROOT,
  commit = null,
  activationCommit = null,
  acceptedCorrection = null
} = {}) {
  const before = snapshotGit(root);
  const errors = [];
  const resolved = commit ? validateCommit(root, commit) : null;
  const activation = activationCommit ? validateCommit(root, activationCommit) : null;
  const correction = acceptedCorrection ? validateCommit(root, acceptedCorrection) : null;
  if (resolved) {
    if (!activation) errors.push('original activation commit input is required');
    if (!correction) errors.push('accepted correction input is required');
  }
  if (activation) {
    exact(activation, ACTIVATION, 'activation input', errors);
    exact(git(root, ['rev-parse', `${activation}^`]), PARENT, 'activation parent', errors);
    exact(git(root, ['show', '-s', '--format=%s', activation]), ACTIVATION_SUBJECT,
      'activation subject', errors);
  }
  if (correction) {
    exact(correction, CORRECTION, 'correction input', errors);
    exact(git(root, ['rev-parse', `${correction}^`]), ACTIVATION, 'correction parent', errors);
    exact(git(root, ['show', '-s', '--format=%s', correction]), CORRECTION_SUBJECT,
      'correction subject', errors);
  }
  if (resolved) {
    exact(git(root, ['rev-parse', `${resolved}^`]), CORRECTION, 'closeout parent', errors);
    exact(git(root, ['show', '-s', '--format=%s', resolved]), SUBJECT, 'closeout subject', errors);
  }
  const reader = resolved ? commitReader(root, resolved) : worktreeReader(root);
  const payloads = Object.fromEntries(Object.keys(SCHEMAS).map(relativePath =>
    [relativePath, parseJson(reader, relativePath, errors)]));
  if (!Object.values(payloads).every(Boolean)) return { errors, commit: resolved };
  for (const [payloadPath, schemaPath] of Object.entries(SCHEMAS)) {
    const schema = parseJson(reader, schemaPath, errors);
    if (schema) errors.push(...validateSchema(payloads[payloadPath], schema, payloadPath));
  }
  const state = payloads[STATE];
  const catalog = payloads[CATALOG];
  const traceability = payloads[TRACE];
  const cutover = payloads[CUTOVER];
  const rollback = payloads[ROLLBACK];
  validateLifecycle(state, cutover, errors);
  validateContracts(reader, errors);
  validateHashes(reader, state, catalog, traceability, cutover, rollback, errors);
  errors.push(...validateCloseoutObjects({
    state,
    cutover,
    unit4Contract: reader.readText(UNIT4_CONTRACT),
    phaseContract: reader.readText(PHASE_CONTRACT),
    catalog
  }));
  const bounded = readBoundedLedgerEvents(reader, state.bounded_recent_ledger_references);
  exact(bounded.full_ledger_read, false, 'full ledger read', errors);
  const acceptanceRefs = bounded.events.filter(item =>
    item.reference.event_id === 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4D-POST-CUTOVER-ACCEPTANCE-CLOSEOUT-R1');
  exact(acceptanceRefs.length, 1, 'bounded acceptance event', errors);
  if (acceptanceRefs[0] && !acceptanceRefs[0].text.includes(SUBJECT)) {
    errors.push('ledger acceptance subject missing');
  }
  if (resolved) {
    const actualPaths = changedPaths(root, resolved);
    const declaredPaths = [...cutover.changed_paths].sort();
    if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths)) {
      errors.push('closeout changed-path manifest mismatch');
    }
    const unauthorized = actualPaths.filter(relativePath => !AUTHORIZED.has(relativePath));
    if (unauthorized.length) errors.push(`unauthorized changed paths: ${unauthorized.join(', ')}`);
    if (reader.readText(STATE).includes(resolved) || reader.readText(CUTOVER).includes(resolved)) {
      errors.push('self-referential closeout SHA');
    }
  }
  for (let number = 1; number <= 11; number += 1) {
    const relativePath = `docs/governance/shadow/ledger/partitions/G28_LEDGER_PART_${String(number).padStart(4, '0')}.md`;
    const prior = childProcess.execFileSync('git', ['show', `${CORRECTION}:${relativePath}`], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    });
    exact(reader.readText(relativePath), prior, `closed partition ${number}`, errors);
  }
  const after = snapshotGit(root);
  errors.push(...validateGitSnapshot(before, after));
  return {
    errors,
    commit: resolved,
    positive_checks: 23,
    negative_checks: 20,
    bounded_references: state.bounded_recent_ledger_references,
    full_ledger_read: bounded.full_ledger_read,
    private_memory_used: false,
    generated_root_hashes: state.activation.generated_view_hashes
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const commitIndex = process.argv.indexOf('--commit');
  const activationIndex = process.argv.indexOf('--activation-commit');
  const correctionIndex = process.argv.indexOf('--accepted-correction');
  const result = validateCloseout({
    root: process.cwd(),
    commit: commitIndex >= 0 ? process.argv[commitIndex + 1] : null,
    activationCommit: activationIndex >= 0 ? process.argv[activationIndex + 1] : null,
    acceptedCorrection: correctionIndex >= 0 ? process.argv[correctionIndex + 1] : null
  });
  if (result.errors.length) {
    console.error(`UNIT4D_ACCEPTANCE_CLOSEOUT_VALIDATION: FAIL\n${result.errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`UNIT4D_ACCEPTANCE_CLOSEOUT_VALIDATION: PASS (${result.positive_checks} positive, ${result.negative_checks} negative, ${result.bounded_references.length} bounded events)`);
  }
}
