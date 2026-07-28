import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { commitReader, validateCommit } from './git-content-reader.mjs';
import { validateSchema } from './validate-documentation-shadow.mjs';
import { activationManifestProjection, jsonSha256, rejectSelfReference, statePayloadProjection } from './unit4-canonical-json.mjs';
import { CANONICAL_VIEW_PATHS, renderCanonicalViews, validateRenderedViews } from './render-unit4-canonical-views.mjs';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..'); export const PARENT = 'fa986cf935abbf053172cfd549b0171bb9446f58';
export const SUBJECT = 'feat: activate structured governance authority'; export const CORRECTION_SUBJECT = 'fix: reconcile post-cutover governance authority'; export const CLOSEOUT_SUBJECT = 'docs: close Unit 4 post-cutover acceptance';
export const CUTOVER_ID = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4C-AUTHORITY-CUTOVER-R1'; export const CONTRACT_ID = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4-BOOTSTRAP-AUTHORITY-CUTOVER-CONTRACT-R1';
// Unit 4C is an immutable historical transition. Its artifacts are read from the
// terminal accepted Unit-4 checkpoint, never from the worktree: the live
// docs/governance/current-state.json is compact format 3.0.0 and is not, and may
// never be treated as, a Unit-4 cutover candidate.
export const HISTORICAL_CHECKPOINT = '997332b1581b7dc111b1551773ee3611ef906c6d';
const CORRECTION_ORDER = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4C-CANONICAL-CONSISTENCY-FORWARD-CORRECTION-R1';
const LIFECYCLE_CORRECTION_PARENT = '56675625ad2557572ee24650a5d7e0e435b02fec';
const LIFECYCLE_CORRECTION_SUBJECT = 'fix: decouple Unit 4 validator from Unit 5 lifecycle';
const STATE = 'docs/governance/current-state.json'; const CATALOG = 'docs/governance/catalog/documents.json';
const TRACE = 'docs/governance/traceability/purchase-order-phase-c.json';
const CUTOVER = 'docs/governance/cutover/unit4c-cutover-manifest.json'; const ROLLBACK = 'docs/governance/cutover/unit4c-rollback-readiness.json';
const SCHEMAS = {
  [STATE]: 'docs/governance/schemas/current-state-v2.schema.json',
  [CATALOG]: 'docs/governance/schemas/document-catalog-v2.schema.json',
  [TRACE]: 'docs/governance/schemas/purchase-order-phase-c-v2.schema.json',
  [CUTOVER]: 'docs/governance/schemas/unit4-cutover-manifest.schema.json', [ROLLBACK]: 'docs/governance/schemas/unit4-rollback-readiness.schema.json'
};
const AUTHORIZED = new Set([
  'PROJECT_STATE.md', 'AGENT_HANDOFF.md', 'docs/DOCUMENTATION_INDEX.md',
  'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md',
  'docs/governance/DOCUMENTATION_MODEL.md',
  'docs/governance/SUPERVISION_PROTOCOL.md',
  'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md',
  'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md',
  'docs/ledgers/G28_LEDGER.md', STATE, CATALOG,
  'docs/governance/catalog/document-source-manifest.json', CUTOVER,
  'docs/governance/schemas/current-state-v2.schema.json',
  'docs/governance/schemas/unit4-cutover-manifest.schema.json',
  'docs/governance/ledger/g28-ledger-source-manifest.json',
  'docs/governance/ledger/g28-ledger-partition-index.json',
  'docs/governance/shadow/generated/G28_LEDGER.md',
  'docs/governance/shadow/ledger/partitions/G28_LEDGER_PART_0012.md',
  'docs/governance/shadow/ledger/partitions/G28_LEDGER_PART_0013.md',
  'scripts/governance/build-unit4-cutover.mjs',
  'scripts/governance/render-unit4-canonical-views.mjs',
  'scripts/governance/validate-unit4-cutover.mjs', 'scripts/governance/build-unit4d-acceptance-closeout.mjs',
  'scripts/governance/validate-unit4d-acceptance-closeout.mjs',
  'scripts/governance/simulate-unit4-bootstrap.mjs',
  'scripts/validate-spec-custody.mjs',
  'scripts/spec-custody/validation-core.mjs',
  'scripts/spec-custody/self-tests.mjs',
  'tests/governance-unit4-cutover.test.mjs', 'tests/governance-unit4d-acceptance-closeout.test.mjs',
  'tests/governance-current-state-shadow.test.mjs',
  'tests/governance-documentation-shadow.test.mjs',
  'tests/governance-g28-ledger-shadow.test.mjs'
]);
function git(root, args, encoding = 'utf8') {
  return childProcess.execFileSync('git', args, {
    cwd: root, encoding, maxBuffer: 64 * 1024 * 1024
  }).trim();
}
function gitRaw(root, args) {
  return childProcess.execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
}
function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function parseJson(reader, relativePath, errors) {
  try { return JSON.parse(reader.readText(relativePath)); }
  catch (error) {
    errors.push(`${relativePath}: invalid JSON: ${error.message}`);
    return null;
  }
}
function fileHash(reader, relativePath) {
  return digest(reader.readText(relativePath));
}
function exact(value, expected, label, errors) {
  if (value !== expected) errors.push(`${label}: expected ${expected}; got ${value}`);
}
function nonempty(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label}: nonempty string required`);
}
function changedPaths(root, commit) {
  return git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', commit])
    .split(/\r?\n/u).filter(Boolean).sort();
}
function validateCommitIdentity(root, commit, activationCommit, errors) {
  let activation = null;
  if (activationCommit) {
    activation = validateCommit(root, activationCommit);
    exact(git(root, ['rev-parse', `${activation}^`]), PARENT, 'activation parent', errors);
    exact(git(root, ['show', '-s', '--format=%s', activation]), SUBJECT, 'activation subject', errors);
  }
  if (!commit) {
    errors.push('historical Unit 4C validation requires an accepted checkpoint commit');
    return activation;
  }
  if (!activation) errors.push('original activation commit input is required');
  else {
    if (commit === activation) errors.push('correction commit used as original activation commit');
    const subject = git(root, ['show', '-s', '--format=%s', commit]);
    const parent = subject === LIFECYCLE_CORRECTION_SUBJECT ? LIFECYCLE_CORRECTION_PARENT : activation;
    exact(git(root, ['rev-parse', `${commit}^`]), parent, 'correction parent', errors);
    if (![CORRECTION_SUBJECT, LIFECYCLE_CORRECTION_SUBJECT].includes(subject)) {
      errors.push(`correction subject: unsupported ${subject}`);
    }
  }
  return activation;
}
function validateLifecycle(state, errors) {
  const closed = state.phase_status?.unit4d === 'CLOSED / ACCEPTED / DIRECTLY VERIFIED';
  exact(state.schema_version, '2.0.0', 'state schema', errors);
  exact(state.mode, 'canonical', 'state mode', errors);
  exact(state.authority, 'canonical_current_state', 'state authority', errors);
  exact(state.authority_epoch, 1, 'authority epoch', errors);
  exact(state.cutover_id, CUTOVER_ID, 'cutover ID', errors);
  exact(state.activation.status, 'active', 'activation status', errors);
  exact(state.activation.authority_epoch, 1, 'activation epoch', errors);
  exact(state.activation.required_parent, PARENT, 'required parent', errors);
  exact(state.activation.accepted_unit4b_readiness_checkpoint, PARENT,
    'accepted Unit 4B checkpoint', errors);
  exact(state.phase_status.unit4c, closed ? 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
    : 'ACTIVATED / FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW',
    'Unit 4C status', errors);
  exact(state.phase_status.documentary_authority_cutover, closed ? 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
    : 'ACTIVE / FORWARD CORRECTION APPLIED / AWAITING UNIT 4D REVIEW',
    'documentary cutover status', errors);
  exact(state.phase_status.unit4d, closed ? 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
    : 'DIRECT SUPERVISOR REVIEW REQUIRED / NOT SELF-ACCEPTED',
    'Unit 4D status', errors);
  exact(state.active_phase?.id, 'GOVERNANCE-EFFICIENCY-REFOUNDATION', 'active phase ID', errors);
  if (closed) {
    nonempty(state.active_phase?.status, 'active phase status', errors);
    nonempty(state.phase_status?.unit5, 'Unit 5 status', errors);
    nonempty(state.next_authorizable_action?.order_id, 'next order', errors);
    nonempty(state.next_authorizable_action?.mode, 'next action mode', errors);
    nonempty(state.next_authorizable_action?.status, 'next action status', errors);
    exact(state.next_authorizable_action?.canonical_value,
      state.next_authorizable_action?.order_id, 'next action canonical value', errors);
  } else {
    exact(state.phase_status.unit5, 'NOT AUTHORIZED', 'Unit 5 status', errors);
    exact(state.next_authorizable_action.order_id, CORRECTION_ORDER, 'next order', errors);
    exact(state.next_authorizable_action.mode, 'UNIT 4D POST-CORRECTION DIRECT REVIEW',
      'next review mode', errors);
  }
  if ((state.evidence_events ?? []).some(event => event.second_activation === true)) {
    errors.push('second activation claimed by current state');
  }
  if ((state.evidence_events ?? []).some(event => event.rollback_executed === true)) {
    errors.push('rollback claimed by current state');
  }
  exact(state.rollback_readiness?.status, 'PREPARED / NOT AUTHORIZED / NOT ACTIVATED',
    'rollback readiness status', errors);
  if ('current_fact_sections' in state) errors.push('raw current_fact_sections forbidden in canonical mode');
  const historical = state.historical_fact_sources ?? [];
  const requiredSources = [
    'docs/governance/shadow/current-state-equivalence.json',
    'docs/governance/candidate/current-state-equivalence.json',
    'docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md',
    'docs/ledgers/G28_LEDGER.md'
  ];
  exact(historical.length, 4, 'historical fact-source count', errors);
  for (const sourcePath of requiredSources) {
    if (!historical.some(item => item.source_path === sourcePath)) {
      errors.push(`missing historical fact source: ${sourcePath}`);
    }
  }
  for (const source of historical) {
    if (source.bootstrap_required !== false || source.unresolved_count !== 0
        || !Number.isInteger(source.record_count) || source.record_count < 1
        || !String(source.authority_status).includes('NON_AUTHORITATIVE')) {
      errors.push(`invalid historical fact source: ${source.source_path}`);
    }
    if (Object.keys(source).some(key => /content|prose|paragraph|text/iu.test(key))) {
      errors.push(`raw historical prose field: ${source.source_path}`);
    }
  }
  for (const debt of state.live_debts ?? []) {
    exact(debt.owner_path, STATE, `live debt owner ${debt.stable_id}`, errors);
  }
  const corrections = (state.evidence_events ?? []).filter(event =>
    event.event_id === 'UNIT4C_CANONICAL_CONSISTENCY_FORWARD_CORRECTION');
  exact(corrections.length, 1, 'correction evidence event count', errors);
  const correction = corrections[0] ?? {};
  exact(correction.subject, CORRECTION_SUBJECT, 'correction evidence subject', errors);
  exact(correction.second_activation, false, 'second activation', errors);
  exact(correction.rollback_executed, false, 'rollback execution', errors);
  exact(correction.original_ponr_unchanged, true, 'original PONR', errors);
  exact((state.evidence_events ?? []).filter(event => event.event_id === 'UNIT4C_ACTIVATION').length,
    1, 'activation event count', errors);
  if (!(state.bounded_recent_ledger_references ?? []).some(reference =>
    reference.event_id === CORRECTION_ORDER)) errors.push('correction ledger event missing');
  if ('activation_commit_sha' in state || 'correction_commit_sha' in state) {
    errors.push('embedded activation or correction commit SHA');
  }
  errors.push(...rejectSelfReference(state));
}
export function validateCanonicalStateObject(state) {
  const errors = [];
  validateLifecycle(state, errors);
  if (state?.activation) {
    exact(jsonSha256(statePayloadProjection(state)), state.activation.state_payload_sha256,
      'state payload hash', errors);
    exact(jsonSha256(activationManifestProjection(state)), state.activation.activation_manifest_sha256,
      'activation manifest hash', errors);
  }
  return errors;
}
function validateSchemas(reader, payloads, errors) {
  for (const [payloadPath, schemaPath] of Object.entries(SCHEMAS)) {
    const schema = parseJson(reader, schemaPath, errors);
    if (schema && payloads[payloadPath]) {
      errors.push(...validateSchema(payloads[payloadPath], schema, payloadPath));
    }
  }
}
function validateHashes(reader, state, catalog, traceability, rollback, errors) {
  exact(jsonSha256(statePayloadProjection(state)), state.activation.state_payload_sha256,
    'state payload hash', errors);
  exact(jsonSha256(activationManifestProjection(state)), state.activation.activation_manifest_sha256,
    'activation manifest hash', errors);
  for (const [relativePath, expected] of Object.entries(state.activation.structured_source_hashes)) {
    if (!reader.exists(relativePath)) errors.push(`missing structured source: ${relativePath}`);
    else exact(fileHash(reader, relativePath), expected, `structured hash ${relativePath}`, errors);
  }
  for (const [relativePath, expected] of Object.entries(state.activation.governing_artifact_hashes)) {
    if (!reader.exists(relativePath)) errors.push(`missing governing artifact: ${relativePath}`);
    else exact(fileHash(reader, relativePath), expected, `governing hash ${relativePath}`, errors);
  }
  exact(fileHash(reader, ROLLBACK), state.activation.rollback_readiness_sha256,
    'rollback hash', errors);
  exact(rollback.status, 'PREPARED / NOT AUTHORIZED / NOT ACTIVATED', 'rollback status', errors);
  for (const prohibition of ['RESET', 'FORCE_PUSH', 'HISTORY_REWRITE', 'SILENT_FALLBACK']) {
    if (!rollback.prohibitions.includes(prohibition)) errors.push(`rollback prohibition missing: ${prohibition}`);
  }
  const views = renderCanonicalViews(state, catalog, traceability);
  try { validateRenderedViews(views); } catch (error) { errors.push(error.message); }
  for (const [relativePath, expectedText] of Object.entries(views)) {
    const actual = reader.readText(relativePath).replace(/\r\n?/gu, '\n');
    exact(actual, expectedText, `render parity ${relativePath}`, errors);
    exact(digest(actual), state.activation.generated_view_hashes[relativePath],
      `root hash ${relativePath}`, errors);
  }
}
function validateCatalogTrace(catalog, traceability, errors) {
  exact(catalog.mode, 'CANONICAL', 'catalog mode', errors);
  exact(catalog.authority, 'CANONICAL_DOCUMENT_CLASSIFICATION_OWNER', 'catalog authority', errors);
  exact(catalog.activation_status, 'ACTIVE', 'catalog activation', errors);
  exact(catalog.authority_epoch, 1, 'catalog epoch', errors);
  exact(traceability.mode, 'CANONICAL', 'traceability mode', errors);
  exact(traceability.authority, 'CANONICAL_PHASE_C_TRACEABILITY_OWNER',
    'traceability authority', errors);
  exact(traceability.activation_status, 'ACTIVE', 'traceability activation', errors);
  exact(traceability.requirements.length, 13, 'traceability row count', errors);
  const ids = traceability.requirements.map(item => item.requirement_id);
  if (new Set(ids).size !== 13) errors.push('traceability requirement IDs are not unique');
  const roots = new Map(catalog.artifacts.map(item => [item.path, item]));
  for (const relativePath of Object.values(CANONICAL_VIEW_PATHS)) {
    exact(roots.get(relativePath)?.classification, 'GENERATED_COMPATIBILITY_VIEW',
      `root catalog classification ${relativePath}`, errors);
    if (roots.get(relativePath)?.authority === 'STATE_OWNER'
        || roots.get(relativePath)?.authority === 'CLASSIFICATION_OWNER') {
      errors.push(`old root retains authority: ${relativePath}`);
    }
  }
}
export function validateCanonicalConsistencyObjects({
  state, cutover, unit4Contract, phaseContract, catalog
}) {
  const errors = [];
  const closed = state.phase_status?.unit4d === 'CLOSED / ACCEPTED / DIRECTLY VERIFIED';
  validateLifecycle(state, errors);
  const identity = unit4Contract.match(/^CONTRACT_ID:\s*(\S+)\s*$/mu)?.[1];
  exact(identity, CONTRACT_ID, 'literal contract ID', errors);
  exact(cutover.contract_id, CONTRACT_ID, 'manifest contract ID', errors);
  exact(cutover.contract_id, identity, 'contract ID parity', errors);
  exact(cutover.review_status, closed ? 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
    : 'CHANGES_REQUIRED / FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW',
    'manifest review status', errors);
  exact(cutover.authority_epoch, 1, 'manifest epoch', errors);
  exact(cutover.second_activation, false, 'manifest second activation', errors);
  exact(cutover.original_ponr_unchanged, true, 'manifest original PONR', errors);
  const unit4Required = closed ? [
    'STATUS: CLOSED / ACCEPTED / DIRECTLY VERIFIED', 'DOCUMENTARY-AUTHORITY CUTOVER: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    'UNIT 4D: CLOSED / ACCEPTED / DIRECTLY VERIFIED',
    '| Unit 4C — authority cutover execution | CLOSED / ACCEPTED / DIRECTLY VERIFIED |',
    '| Documentary-authority cutover | CLOSED / ACCEPTED / DIRECTLY VERIFIED |'
  ] : [
    'STATUS: UNIT 4C PUBLISHED / FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW',
    `UNIT 4A IMPLEMENTATION: CLOSED / ACCEPTED / DIRECTLY VERIFIED AT ${PARENT}`,
    `UNIT 4B REVIEW: DIRECT REVIEW COMPLETED / ACCEPTED AT ${PARENT}`,
    'DOCUMENTARY-AUTHORITY CUTOVER: ACTIVE / AWAITING UNIT 4D REVIEW',
    'AUTHORITY EPOCH: 1',
    'UNIT 4D: DIRECT SUPERVISOR REVIEW REQUIRED / NOT SELF-ACCEPTED',
    '| Unit 4C — authority cutover execution | ACTIVATED / FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW |',
    '| Documentary-authority cutover | ACTIVE / AWAITING UNIT 4D REVIEW |'
  ];
  const phaseRequired = closed ? [
    `STATUS: ACTIVE / ${state.active_phase.status}`,
    `UNIT 4C: ${state.phase_status.unit4c}`,
    `DOCUMENTARY-AUTHORITY CUTOVER: ${state.phase_status.documentary_authority_cutover}`,
    `UNIT 4D ACCEPTANCE: ${state.phase_status.unit4d}`,
    `UNIT 5: ${state.phase_status.unit5}`
  ] : [
    'STATUS: ACTIVE / UNIT 4C FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW',
    'UNIT 4C: ACTIVATED / FORWARD CORRECTION APPLIED / AWAITING DIRECT SUPERVISOR REVIEW',
    'DOCUMENTARY-AUTHORITY CUTOVER: ACTIVE / AWAITING UNIT 4D REVIEW',
    'UNIT 4D ACCEPTANCE: DIRECT SUPERVISOR REVIEW REQUIRED / NOT SELF-ACCEPTED',
    'UNIT 5: NOT AUTHORIZED'
  ];
  for (const value of unit4Required) if (!unit4Contract.includes(value)) errors.push(`Unit 4 contract status missing: ${value}`);
  for (const value of phaseRequired) if (!phaseContract.includes(value)) errors.push(`phase contract status missing: ${value}`);
  const stale = [
    'UNIT 4A IMPLEMENTATION: NOT AUTHORIZED',
    'DOCUMENTARY-AUTHORITY CUTOVER: NOT AUTHORIZED',
    'Structured sources remain non-canonical',
    'current canonical owners remain unchanged'
  ];
  for (const value of stale) {
    if (unit4Contract.includes(value) || phaseContract.includes(value)) {
      errors.push(`active-tense pre-cutover contradiction: ${value}`);
    }
  }
  const rootOwners = new Map(catalog.artifacts.map(item => [item.path, item]));
  for (const [rootPath, sourcePath] of Object.entries({
    'PROJECT_STATE.md': STATE,
    'AGENT_HANDOFF.md': STATE,
    'docs/DOCUMENTATION_INDEX.md': CATALOG,
    'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md': TRACE
  })) {
    const owner = rootOwners.get(rootPath);
    exact(owner?.classification, 'GENERATED_COMPATIBILITY_VIEW',
      `generated root classification ${rootPath}`, errors);
    exact(owner?.owner, sourcePath, `generated root owner ${rootPath}`, errors);
    if (['STATE_OWNER', 'CLASSIFICATION_OWNER'].includes(owner?.authority)) errors.push(`generated root retains authority: ${rootPath}`);
  }
  if (!(state.prohibitions ?? []).includes('SILENT_FALLBACK')) errors.push('silent fallback prohibition missing');
  if ((state.root_authorities ?? []).some(item => item.remains_authoritative !== false)) {
    errors.push('generated root retains current authority');
  }
  errors.push(...rejectSelfReference(cutover, '$cutover'));
  return errors;
}
function validateCutoverManifest(reader, cutover, state, root, commit, activationCommit, errors) {
  exact(cutover.current_state_file_sha256, fileHash(reader, STATE),
    'cutover current-state hash', errors);
  exact(cutover.catalog_sha256, fileHash(reader, CATALOG), 'cutover catalog hash', errors);
  exact(cutover.traceability_sha256, fileHash(reader, TRACE), 'cutover traceability hash', errors);
  exact(cutover.state_payload_sha256, state.activation.state_payload_sha256,
    'cutover state payload hash', errors);
  exact(cutover.activation_manifest_sha256, state.activation.activation_manifest_sha256,
    'cutover activation manifest hash', errors);
  exact(cutover.ponr_command, 'git push staging dev', 'PONR command', errors);
  exact(cutover.actual_activation_commit_identity,
    state.phase_status?.unit4d === 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
      ? 'EXTERNAL_GIT_FACT_RECORDED_AFTER_UNIT4D_ACCEPTANCE' : 'EXTERNAL_GIT_FACT',
    'external commit classification', errors);
  const actualPaths = changedPaths(root, commit);
  const declaredPaths = [...cutover.changed_paths].sort();
  if (activationCommit
      && state.phase_status?.unit4d !== 'CLOSED / ACCEPTED / DIRECTLY VERIFIED') {
    const activationPaths = changedPaths(root, activationCommit);
    if (JSON.stringify(activationPaths) !== JSON.stringify(declaredPaths)) {
      errors.push('original activation changed-path manifest mismatch');
    }
  }
  const unauthorized = actualPaths.filter(relativePath => !AUTHORIZED.has(relativePath));
  if (unauthorized.length) errors.push(`unauthorized changed paths: ${unauthorized.join(', ')}`);
  const lifecycleCorrection = (state.evidence_events ?? []).some(event =>
    event.subject === LIFECYCLE_CORRECTION_SUBJECT);
  const requiredPaths = [STATE, CUTOVER,
    'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md',
    'docs/ledgers/G28_LEDGER.md', ...(lifecycleCorrection
      ? ['scripts/governance/validate-unit4-cutover.mjs', 'tests/governance-unit4-cutover.test.mjs']
      : ['docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md'])];
  for (const requiredPath of requiredPaths) {
    if (!actualPaths.includes(requiredPath)) errors.push(`missing correction path: ${requiredPath}`);
  }
}
function validateBootstrap(reader, state, errors) {
  const instructions = reader.readText('docs/governance/AGENT_INSTRUCTIONS.md');
  if (!instructions.includes(STATE) || !instructions.includes('Silent fallback')) {
    errors.push('structured bootstrap or silent-fallback rejection missing');
  }
  const requiredPointers = [
    'governing_spec', 'technical_contract', 'sequence_authority', 'traceability',
    'ledger', 'unit_4_contract'
  ];
  for (const key of requiredPointers) {
    if (!state.governing_pointers[key]) errors.push(`missing governing pointer: ${key}`);
  }
  exact(state.bounded_recent_ledger_references.length, 5, 'bounded ledger reference count', errors);
  const index = parseJson(reader, 'docs/governance/ledger/g28-ledger-partition-index.json', errors);
  for (const reference of state.bounded_recent_ledger_references) {
    if (!reader.exists(reference.partition_path)) errors.push(`missing bounded partition: ${reference.partition_path}`);
    const partition = index?.partitions?.find(item => item.partition_id === reference.partition_id);
    if (!partition || partition.payload_sha256 !== reference.partition_payload_sha256) {
      errors.push(`stale bounded partition: ${reference.partition_id}`);
    }
  }
  const readiness = parseJson(reader, 'docs/governance/candidate/readiness-manifest.json', errors);
  exact(readiness?.consumer_inventory?.length, 31, 'consumer inventory', errors);
  exact(readiness?.reference_search?.unresolved_material_consumers, 0, 'unresolved consumers', errors);
  exact(readiness?.bootstrap?.full_ledger_read, false, 'full ledger read', errors);
  exact(readiness?.bootstrap?.private_memory_used, false, 'private memory', errors);
}
function validateClosedPartitions(reader, root, errors) {
  for (let number = 1; number <= 11; number += 1) {
    const fileName = `G28_LEDGER_PART_${String(number).padStart(4, '0')}.md`;
    const relativePath = `docs/governance/shadow/ledger/partitions/${fileName}`;
    const prior = gitRaw(root, ['show', `${PARENT}:${relativePath}`]);
    exact(reader.readText(relativePath), prior, `closed partition ${number}`, errors);
  }
}
export function validateCutover({
  root = REPO_ROOT, commit = HISTORICAL_CHECKPOINT, activationCommit = null
} = {}) {
  // ls-files --stage, not write-tree: it captures the mode, object ID and stage
  // of every index entry without taking .git/index.lock, so concurrent
  // validators cannot make each other fail on lock contention.
  const snapshot = () => ({
    head: git(root, ['rev-parse', 'HEAD']),
    status: git(root, ['status', '--porcelain=v1', '-uall']),
    index: git(root, ['ls-files', '--stage'])
  });
  const before = snapshot();
  const errors = [];
  const resolved = commit ? validateCommit(root, commit) : null;
  const resolvedActivation = validateCommitIdentity(root, resolved, activationCommit, errors);
  if (!resolved) return { errors, commit: null };
  const reader = commitReader(root, resolved);
  const payloads = Object.fromEntries(Object.keys(SCHEMAS).map(relativePath =>
    [relativePath, parseJson(reader, relativePath, errors)]));
  if (!Object.values(payloads).every(Boolean)) return { errors, commit: resolved };
  const state = payloads[STATE];
  const catalog = payloads[CATALOG];
  const traceability = payloads[TRACE];
  const cutover = payloads[CUTOVER];
  const rollback = payloads[ROLLBACK];
  validateSchemas(reader, payloads, errors);
  validateLifecycle(state, errors);
  validateCatalogTrace(catalog, traceability, errors);
  validateHashes(reader, state, catalog, traceability, rollback, errors);
  const unit4Contract = reader.readText(
    'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md');
  const phaseContract = reader.readText(
    'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md');
  errors.push(...validateCanonicalConsistencyObjects({
    state, cutover, unit4Contract, phaseContract, catalog
  }));
  validateCutoverManifest(reader, cutover, state, root, resolved, resolvedActivation, errors);
  validateBootstrap(reader, state, errors);
  validateClosedPartitions(reader, root, errors);
  if (resolved && reader.readText(STATE).includes(resolved)) {
    errors.push('correction commit embedded in structured source');
  }
  if (resolvedActivation
      && state.phase_status?.unit4d !== 'CLOSED / ACCEPTED / DIRECTLY VERIFIED'
      && (reader.readText(STATE).includes(resolvedActivation)
      || reader.readText(CUTOVER).includes(resolvedActivation))) {
    errors.push('original activation commit embedded in canonical source');
  }
  const after = snapshot();
  if (JSON.stringify(before) !== JSON.stringify(after)) errors.push('validator mutated Git state');
  return {
    errors,
    commit: resolved,
    positive_checks: 23,
    negative_checks: 22,
    traceability_rows: traceability.requirements.length,
    consumers: 31,
    unresolved_consumers: 0,
    bounded_references: state.bounded_recent_ledger_references
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const commitIndex = process.argv.indexOf('--commit');
  const activationIndex = process.argv.indexOf('--activation-commit');
  const result = validateCutover({
    root: process.cwd(),
    commit: commitIndex >= 0 ? process.argv[commitIndex + 1] : HISTORICAL_CHECKPOINT,
    activationCommit: activationIndex >= 0 ? process.argv[activationIndex + 1] : null
  });
  if (result.errors.length) {
    console.error(`UNIT4C_CUTOVER_VALIDATION: FAIL\n${result.errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`UNIT4C_CUTOVER_VALIDATION: PASS (${result.positive_checks} positive, ${result.negative_checks} negative, ${result.traceability_rows} trace rows, ${result.consumers} consumers)`);
  }
}
