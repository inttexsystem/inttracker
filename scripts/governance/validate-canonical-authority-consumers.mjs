import childProcess from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { commitReader, validateCommit, worktreeReader } from './git-content-reader.mjs';
import { renderViews } from './render-documentation-shadow.mjs';
import {
  CANONICAL_VIEW_PATHS,
  isHistoricalEpochOneState,
  renderCanonicalViews
} from './render-unit4-canonical-views.mjs';
import { validateSchemaValue } from './validate-current-state-shadow.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const CATALOG = 'docs/governance/catalog/documents.json';
export const STATE = 'docs/governance/current-state.json';
export const AGENT_INSTRUCTIONS = 'docs/governance/AGENT_INSTRUCTIONS.md';
export const TRACEABILITY = 'docs/governance/traceability/purchase-order-phase-c.json';
export const RENDERER = 'scripts/governance/render-documentation-shadow.mjs';
export const SHADOW_INDEX = 'docs/governance/shadow/generated/DOCUMENTATION_INDEX.md';
export const SHADOW_TRACE = 'docs/governance/shadow/generated/ORDEM_COMPRA_C3_TRACEABILITY.md';
export const EXPECTED_ACTIVE_NORMATIVE = 26;
export const STATE_SCHEMA = 'docs/governance/schemas/current-state.schema.json';
export const ACCEPTED_OPERATIONAL_CHECKPOINT = 'b77f4d14021781ebd96bce30f625687358b2d87a';
export const ENVIRONMENT_IDENTITIES = Object.freeze({
  production: 'ucrjtfswnfdlxwtmxnoo',
  retired_project: 'gqmpsxkxynrjvidfmojk',
  forbidden_project: 'bhgifjrfagkzubpyqpew'
});
// Fields that belonged to the retired Unit-4 candidate and epoch-1 canonical
// contracts. None of them may reappear in the live compact state; the historical
// validators read them from their own accepted checkpoints instead.
export const RETIRED_STATE_FIELDS = Object.freeze([
  'activation',
  'activation_commit_sha',
  'activation_manifest_sha256',
  'authority',
  'authority_epoch',
  'bounded_recent_ledger_references',
  'correction_commit_sha',
  'current_fact_sections',
  'cutover_id',
  'evidence_events',
  'historical_fact_sources',
  'last_accepted',
  'last_accepted_phase',
  'live_debts',
  'mode',
  'phase_status',
  'rollback_readiness',
  'root_authorities',
  'schema_version',
  'source_mappings',
  'state_payload_sha256',
  'structured_sources'
]);
// Debts closed by an accepted checkpoint. Their historical evidence survives in
// Git and in the ledger; reintroducing any of them to the active population is a
// deterministic failure.
export const CLOSED_DEBT_IDENTITIES = Object.freeze([
  'UI-SPECIALIZED-CONTROL-CONTRACT-GAP',
  'UI-ACTION-BUTTON-SR-LABEL-POSITIONING',
  'UI-ACTION-BUTTON-CALLER-WORKAROUND-REDUNDANT',
  'GOVERNANCE-COMPACT-STATE-VALIDATOR-SCHEMA-MISMATCH',
  'UI-CACHE-TOKEN-CONFORMANCE-GUARD-DRIFT-R1'
]);
const STALE_ACCEPTANCE_PHRASES = Object.freeze([
  'AWAITING ARCHITECT ACCEPTANCE',
  'AWAITING FINAL ARCHITECT ACCEPTANCE',
  'AWAITING DIRECT SUPERVISOR REVIEW',
  'AWAITING UNIT 4D REVIEW',
  'PUBLISHED AND UNACCEPTED'
]);

export const CORRECTED_PATHS = Object.freeze([
  'docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md',
  'docs/architecture/CAMADA3_BACKUP_CONTRACT.md',
  'docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md',
  'docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md',
  'docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md',
  'docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md',
  'docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md',
  'docs/design/CAMADA2_A32_MOCKUP_APPROVED.md',
  'docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md'
]);

const GENERATED_ROOTS = Object.freeze([
  'PROJECT_STATE.md',
  'AGENT_HANDOFF.md',
  'docs/DOCUMENTATION_INDEX.md',
  'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md'
]);
const GENERATED_PATH_RE = /docs\/governance\/(?:shadow|candidate)\//u;
const AUTHORITY_RE = /\b(?:sole|only|canonical|authority|authoritative|arbiter|owner|owns|source of (?:current state|truth)|current operational state|live current|current phase|next authorizable|precedence|bootstrap|mandatory|must read|records? operational continuity|accepted state for resumption|update)\b/iu;
const GENERATED_RE = /\b(?:generated|regenerate|derived|compatibility view|no independent authority|no independent facts|non-authoritative|optional human-readable|not a source)\b/iu;
const UNCERTAIN_RE = /\b(?:maybe|possibly|unclear|unknown owner|to be classified|unresolved authority)\b/iu;

function git(root, args) {
  return childProcess.execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function snapshotGit(root) {
  return {
    head: git(root, ['rev-parse', 'HEAD']),
    // ls-files --stage, not write-tree: it captures the mode, object ID and
    // stage of every index entry without taking .git/index.lock, so concurrent
    // validators cannot make each other fail on lock contention.
    index: git(root, ['ls-files', '--stage']),
    status: git(root, ['status', '--porcelain=v1', '-uall']),
    refs: git(root, ['show-ref', '--head'])
  };
}

function hasGeneratedTarget(text) {
  return GENERATED_ROOTS.some(value => text.includes(value)) || GENERATED_PATH_RE.test(text);
}

function historicalScope(relativePath, heading, line, documentPreamble) {
  if (/HISTORICAL|SUPERSEDED BY STRUCTURED AUTHORITY EPOCH 1/iu.test(heading)) return true;
  if (relativePath === 'docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md'
      && /^# Update \d{4}-\d{2}-\d{2}/u.test(heading)
      && /Every dated .*historical record|historical and superseded/iu.test(documentPreamble)) return true;
  if (relativePath === 'docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md'
      && /This design was .*implemented/iu.test(documentPreamble)) return true;
  if (relativePath === 'docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md'
      && /diagnostic\/documentation.*Read-only/isu.test(documentPreamble)) return true;
  if (relativePath === 'docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md'
      && /Update \d{4}-\d{2}-\d{2}.*CLOSED \/ ACCEPTED/iu.test(heading)) return true;
  if (relativePath === 'docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md'
      && /CLOSED \/ ACCEPTED.*technical commit/iu.test(line)) return true;
  if (relativePath === 'docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md'
      && /\b(?:Ruling 7|Ratification record|projected; NOT authorized)\b/iu.test(`${heading} ${line}`)) return true;
  return false;
}

export function classifyMatch({ relativePath, heading, line, window, documentPreamble }) {
  if (!hasGeneratedTarget(line)) return null;
  if (historicalScope(relativePath, heading, line, documentPreamble)) return 'HISTORICAL_VALID';
  if (UNCERTAIN_RE.test(window) && AUTHORITY_RE.test(window)) return 'UNRESOLVED';
  if (GENERATED_RE.test(window)) return 'GENERATED_COMPATIBILITY_REFERENCE';
  if (relativePath === 'docs/governance/SUPERVISION_PROTOCOL.md'
      && /AGENT_HANDOFF\.md|docs\/DOCUMENTATION_INDEX\.md/iu.test(line)) {
    return line.includes('AGENT_HANDOFF.md')
      ? 'GENERATED_COMPATIBILITY_REFERENCE'
      : 'NON_AUTHORITY_REFERENCE';
  }
  if (/Indexed in `docs\/DOCUMENTATION_INDEX\.md`|listed in\s+`docs\/DOCUMENTATION_INDEX\.md`/iu.test(window)) {
    return 'NON_AUTHORITY_REFERENCE';
  }
  const referenceOnly = line.replace(/[`>*\s;,.()[\]—/-]/gu, '')
    .replace(/PROJECT_STATEmd|AGENT_HANDOFFmd|docsDOCUMENTATION_INDEXmd|docsarchitectureORDEM_COMPRA_C3_TRACEABILITYmd/gu, '') === '';
  if (AUTHORITY_RE.test(line) || (referenceOnly && AUTHORITY_RE.test(window))) return 'ACTIVE_CONTRADICTION';
  return 'NON_AUTHORITY_REFERENCE';
}

export function scanActiveNormative(reader) {
  const catalog = JSON.parse(reader.readText(CATALOG));
  const artifacts = catalog.artifacts.filter(item =>
    item.status === 'ACTIVE' && (item.authority === 'NORMATIVE' || item.role === 'normative'));
  const rows = [];
  const missing = [];
  for (const artifact of artifacts) {
    if (!reader.exists(artifact.path)) { missing.push(artifact.path); continue; }
    const lines = reader.readText(artifact.path).replace(/\r\n?/gu, '\n').split('\n');
    const preamble = lines.slice(0, 30).join('\n');
    let heading = '';
    for (let index = 0; index < lines.length; index += 1) {
      if (/^#{1,6}\s/u.test(lines[index])) heading = lines[index];
      if (!hasGeneratedTarget(lines[index])) continue;
      const window = lines.slice(Math.max(0, index - 2), index + 3).join(' ');
      rows.push({
        path: artifact.path,
        artifact_id: artifact.artifact_id,
        catalog_status: artifact.status,
        catalog_classification: artifact.classification,
        line: index + 1,
        matched_clause: lines[index],
        semantic_classification: classifyMatch({
          relativePath: artifact.path,
          heading,
          line: lines[index],
          window,
          documentPreamble: preamble
        })
      });
    }
  }
  return { artifacts, rows, missing };
}

function requireText(reader, relativePath, values, errors) {
  const text = reader.readText(relativePath);
  for (const value of values) if (!text.includes(value)) errors.push(`${relativePath}: missing ${value}`);
}

function validateCorrectedDocuments(reader, errors) {
  requireText(reader, 'docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md', [
    '`docs/governance/catalog/documents.json`', '`docs/governance/current-state.json`',
    '`docs/governance/AGENT_INSTRUCTIONS.md`', 'optional generated compatibility views'
  ], errors);
  requireText(reader, 'docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md', [
    'this plan owns G28 architecture, sequence, backlog, and hard stops',
    '`docs/governance/current-state.json` owns current operational state',
    'never edit them as independent owners'
  ], errors);
  requireText(reader, 'docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md', [
    '`docs/governance/current-state.json` — **Sole owner of live current operational state**',
    'no independent continuity or current-state facts'
  ], errors);
  requireText(reader, 'docs/architecture/CAMADA3_BACKUP_CONTRACT.md', [
    '`docs/governance/current-state.json`', 'no independent authority'
  ], errors);
  requireText(reader, 'docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md', [
    'Classification is', 'owned by `docs/governance/catalog/documents.json`',
    '`docs/DOCUMENTATION_INDEX.md` is its generated compatibility view'
  ], errors);
  requireText(reader, 'docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md', [
    'owned solely by `docs/governance/current-state.json`',
    'never edit either as an independent owner'
  ], errors);
  requireText(reader, 'docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md', [
    '`docs/governance/current-state.json` — canonical current operational state',
    '`AGENT_HANDOFF.md` — generated compatibility handoff with no independent authority'
  ], errors);
  requireText(reader, 'docs/design/CAMADA2_A32_MOCKUP_APPROVED.md', [
    'operational state is owned by', '`PROJECT_STATE.md` is a generated'
  ], errors);
  requireText(reader, 'docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md', [
    'This document owns no current operational state',
    '`PROJECT_STATE.md` and', '`AGENT_HANDOFF.md` are generated compatibility views only'
  ], errors);
}

function validateOwners(reader, errors) {
  const state = JSON.parse(reader.readText(STATE));
  const catalog = JSON.parse(reader.readText(CATALOG));
  const traceability = JSON.parse(reader.readText(TRACEABILITY));
  if (state.canonical_sources?.current_operational_state !== STATE) {
    errors.push('structured current-state ownership mismatch');
  }
  if (state.canonical_sources?.generated_continuation_view !== 'AGENT_HANDOFF.md') {
    errors.push('structured handoff view ownership mismatch');
  }
  if (state.canonical_sources?.document_classification !== CATALOG) {
    errors.push('structured catalog ownership mismatch in current state');
  }
  if (catalog.authority !== 'CANONICAL_DOCUMENT_CLASSIFICATION_OWNER') errors.push('structured catalog ownership mismatch');
  if (traceability.authority !== 'CANONICAL_PHASE_C_TRACEABILITY_OWNER') errors.push('structured traceability ownership mismatch');
  const instructions = reader.readText(AGENT_INSTRUCTIONS);
  // The bootstrap must still reject generated roots as independent authority.
  // The wording moved when the instructions were compacted, so the assertion is
  // re-anchored on the clauses that carry that rule now.
  if (!/`AGENT_HANDOFF\.md` is a concise generated projection of current state and has\s+no independent authority/u.test(instructions)) {
    errors.push('agent bootstrap generated-root rejection missing');
  }
  if (!/generated views, and tool caches are\s+non-authoritative/u.test(instructions)) {
    errors.push('agent bootstrap generated-view non-authority rejection missing');
  }
  if (!/Silent fallback to a shadow, candidate, generated, historical, or\s+private source is forbidden/u.test(instructions)) {
    errors.push('agent bootstrap silent-fallback rejection missing');
  }
}

function unresolvedPointer(reader, relativePath, anchor) {
  if (typeof relativePath !== 'string' || !reader.exists(relativePath)) return 'missing path';
  if (typeof anchor !== 'string' || anchor.length === 0) return 'missing anchor';
  if (anchor.startsWith('/')) return null;
  return reader.readText(relativePath).replace(/\r\n?/gu, '\n').split('\n').includes(anchor)
    ? null : 'missing anchor line';
}

// The live compact state is validated as itself: against the format-3 schema and
// against the operational facts it owns. Nothing here reads or reconstructs the
// retired Unit-4 candidate machinery.
export function validateLiveCompactState(reader, errors) {
  let state;
  try { state = JSON.parse(reader.readText(STATE)); }
  catch (error) { errors.push(`live current-state is not valid JSON: ${error.message}`); return; }
  if (isHistoricalEpochOneState(state)) {
    errors.push('live current-state carries the retired epoch-1 canonical shape');
    return;
  }
  try {
    errors.push(...validateSchemaValue(state, JSON.parse(reader.readText(STATE_SCHEMA)))
      .map(error => `live current-state schema: ${error}`));
  } catch (error) { errors.push(`cannot load live current-state schema: ${error.message}`); }

  for (const field of RETIRED_STATE_FIELDS) {
    if (Object.hasOwn(state, field)) errors.push(`retired Unit-4 field in live current-state: ${field}`);
  }

  const serialized = JSON.stringify(state);
  for (const phrase of STALE_ACCEPTANCE_PHRASES) {
    if (serialized.includes(phrase)) errors.push(`stale acceptance language in live current-state: ${phrase}`);
  }

  if (state.accepted_operational_checkpoint !== ACCEPTED_OPERATIONAL_CHECKPOINT) {
    errors.push('accepted operational checkpoint mismatch');
  }
  const checkpointCommits = new Set((state.accepted_checkpoints ?? []).map(item => item.checkpoint_commit));
  if (!checkpointCommits.has(ACCEPTED_OPERATIONAL_CHECKPOINT)) {
    errors.push('accepted operational checkpoint is absent from the accepted checkpoint chain');
  }
  const checkpointIds = (state.accepted_checkpoints ?? []).map(item => item.id);
  if (new Set(checkpointIds).size !== checkpointIds.length) {
    errors.push('duplicate accepted checkpoint identity');
  }

  for (const [key, projectId] of Object.entries(ENVIRONMENT_IDENTITIES)) {
    if (state.environment_boundaries?.[key]?.project_id !== projectId) {
      errors.push(`environment identity mismatch: ${key}`);
    }
  }
  if (!/^NONE\b/u.test(state.environment_boundaries?.non_production_database ?? '')) {
    errors.push('live current-state declares a non-production database');
  }

  const residuePaths = (state.protected_residue ?? []).map(item => item.path);
  if (new Set(residuePaths).size !== residuePaths.length) {
    errors.push('duplicate protected-residue path');
  }

  const debtIds = (state.blockers_and_material_debts ?? []).map(item => item.id);
  if (new Set(debtIds).size !== debtIds.length) errors.push('duplicate active debt identity');
  for (const closed of CLOSED_DEBT_IDENTITIES) {
    if (debtIds.includes(closed)) errors.push(`closed debt reintroduced into the active list: ${closed}`);
  }

  const pointers = [
    ['active_phase.contract', state.active_phase?.contract?.path, state.active_phase?.contract?.anchor],
    ...(state.active_track?.governing_pointers ?? []).map(pointer =>
      [`active_track.${pointer.role}`, pointer.path, pointer.anchor]),
    ...(state.exceptional_evidence ?? []).map((pointer, index) =>
      [`exceptional_evidence[${index}]`, pointer.path, pointer.anchor])
  ];
  for (const [label, relativePath, anchor] of pointers) {
    const failure = unresolvedPointer(reader, relativePath, anchor);
    if (failure) errors.push(`invalid governing pointer (${label}): ${failure}`);
  }
  for (const relativePath of Object.values(state.canonical_sources ?? {})) {
    if (!reader.exists(relativePath)) errors.push(`missing canonical source: ${relativePath}`);
  }
  return state;
}

export function validateGeneratedCompatibilityViews(reader, state, errors) {
  if (!state) return;
  let rendered;
  try {
    const catalog = JSON.parse(reader.readText(CATALOG));
    const traceability = JSON.parse(reader.readText(TRACEABILITY));
    rendered = renderCanonicalViews(state, catalog, traceability);
    if (JSON.stringify(rendered) !== JSON.stringify(renderCanonicalViews(state, catalog, traceability))) {
      errors.push('canonical renderer is not deterministic');
    }
  } catch (error) { errors.push(`canonical renderer failed: ${error.message}`); return; }
  for (const [relativePath, expected] of Object.entries(rendered)) {
    if (reader.readText(relativePath).replace(/\r\n?/gu, '\n') !== expected) {
      errors.push(`generated compatibility view drift: ${relativePath}`);
    }
  }
  const project = reader.readText(CANONICAL_VIEW_PATHS.project);
  if (!project.includes('is the sole current operational state owner.')) {
    errors.push('PROJECT_STATE.md is not a compatibility pointer');
  }
  if (project.includes('SPEC_CUSTODY_BOOTSTRAP:BEGIN')) {
    errors.push('PROJECT_STATE.md still carries a bootstrap block');
  }
  const handoff = reader.readText(CANONICAL_VIEW_PATHS.handoff);
  for (const required of [ACCEPTED_OPERATIONAL_CHECKPOINT, ENVIRONMENT_IDENTITIES.production]) {
    if (!handoff.includes(required)) errors.push(`generated handoff missing current fact: ${required}`);
  }
  for (const phrase of STALE_ACCEPTANCE_PHRASES) {
    if (handoff.includes(phrase)) errors.push(`stale acceptance language in generated handoff: ${phrase}`);
  }
}

function validateRenderer(reader, errors) {
  const catalog = JSON.parse(reader.readText(CATALOG));
  const traceability = JSON.parse(reader.readText(TRACEABILITY));
  const rendered = renderViews(catalog, traceability);
  const renderer = reader.readText(RENDERER);
  if (!renderer.includes('Canonical structured owner: `docs/governance/catalog/documents.json`')) {
    errors.push('shadow renderer catalog owner mismatch');
  }
  if (!renderer.includes('Canonical structured owner: `docs/governance/traceability/purchase-order-phase-c.json`')) {
    errors.push('shadow renderer traceability owner mismatch');
  }
  if (reader.readText(SHADOW_INDEX).replace(/\r\n?/gu, '\n') !== rendered.documentationIndex) {
    errors.push('Documentation Index shadow output drift');
  }
  if (reader.readText(SHADOW_TRACE).replace(/\r\n?/gu, '\n') !== rendered.traceability) {
    errors.push('Phase-C traceability shadow output drift');
  }
  for (const relativePath of [SHADOW_INDEX, SHADOW_TRACE]) {
    if (!reader.readText(relativePath).includes('owns no independent facts')) {
      errors.push(`${relativePath}: independent-fact rejection missing`);
    }
  }
}

export function validateReader(reader) {
  const errors = [];
  const scan = scanActiveNormative(reader);
  if (scan.artifacts.length !== EXPECTED_ACTIVE_NORMATIVE) {
    errors.push(`active normative inventory incomplete: expected ${EXPECTED_ACTIVE_NORMATIVE}; got ${scan.artifacts.length}`);
  }
  if (scan.missing.length) errors.push(`missing active normative artifacts: ${scan.missing.join(', ')}`);
  const contradictions = scan.rows.filter(row => row.semantic_classification === 'ACTIVE_CONTRADICTION');
  const unresolved = scan.rows.filter(row => row.semantic_classification === 'UNRESOLVED');
  if (contradictions.length) errors.push(`active authority contradictions: ${[...new Set(contradictions.map(row => row.path))].join(', ')}`);
  if (unresolved.length) errors.push(`unresolved semantic matches: ${unresolved.map(row => `${row.path}:${row.line}`).join(', ')}`);
  validateCorrectedDocuments(reader, errors);
  validateOwners(reader, errors);
  validateRenderer(reader, errors);
  const liveState = validateLiveCompactState(reader, errors);
  validateGeneratedCompatibilityViews(reader, liveState, errors);
  const count = value => scan.rows.filter(row => row.semantic_classification === value).length;
  return {
    errors,
    active_normative_artifacts: scan.artifacts.length,
    semantic_matches: scan.rows.length,
    active_contradictions: contradictions.length,
    historical_valid: count('HISTORICAL_VALID'),
    generated_references: count('GENERATED_COMPATIBILITY_REFERENCE'),
    non_authority_references: count('NON_AUTHORITY_REFERENCE'),
    unresolved: unresolved.length,
    contradiction_paths: [...new Set(contradictions.map(row => row.path))].sort(),
    rows: scan.rows
  };
}

export function validateRepository({ root = REPO_ROOT, commit = null } = {}) {
  const before = snapshotGit(root);
  const resolved = commit ? validateCommit(root, commit) : null;
  const reader = resolved ? commitReader(root, resolved) : worktreeReader(root);
  const result = validateReader(reader);
  const after = snapshotGit(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) result.errors.push('validator mutated Git state');
  return { ...result, commit: resolved, git_unchanged: JSON.stringify(before) === JSON.stringify(after) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const index = process.argv.indexOf('--commit');
  const result = validateRepository({
    root: process.cwd(),
    commit: index >= 0 ? process.argv[index + 1] : null
  });
  if (result.errors.length) {
    console.error(`CANONICAL_AUTHORITY_CONSUMERS: FAIL\n${result.errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log([
      'CANONICAL_AUTHORITY_CONSUMERS: PASS',
      `ACTIVE_NORMATIVE_ARTIFACTS: ${result.active_normative_artifacts}`,
      `SEMANTIC_MATCHES: ${result.semantic_matches}`,
      `ACTIVE_CONTRADICTIONS: ${result.active_contradictions}`,
      `HISTORICAL_VALID: ${result.historical_valid}`,
      `GENERATED_COMPATIBILITY_REFERENCE: ${result.generated_references}`,
      `NON_AUTHORITY_REFERENCE: ${result.non_authority_references}`,
      `UNRESOLVED_MATCHES: ${result.unresolved}`,
      `GIT_UNCHANGED: ${result.git_unchanged}`
    ].join('\n'));
  }
}
