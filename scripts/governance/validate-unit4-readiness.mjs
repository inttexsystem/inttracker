import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { commitReader } from './git-content-reader.mjs';
import {
  CONSUMERS,
  ROOT_AUTHORITIES,
  SCHEMAS,
  BASELINE,
  CATALOG_PATH,
  EQUIVALENCE_PATH,
  READINESS_PATH,
  SOURCE_MANIFEST_PATH,
  STATE_PATH,
  TRACE_PATH
} from './build-unit4-readiness.mjs';
import {
  activationManifestProjection,
  canonicalJson,
  jsonSha256,
  rejectSelfReference,
  sha256,
  statePayloadProjection
} from './unit4-canonical-json.mjs';
import {
  CANDIDATE_MARKER,
  CANDIDATE_VIEW_PATHS,
  renderCandidateViews
} from './render-unit4-candidate-views.mjs';
import {
  FULL_LEDGER_PATHS,
  readBoundedLedgerEvents
} from './read-bounded-ledger-events.mjs';
import { validateSchema } from './validate-documentation-shadow.mjs';
import { simulateWithReader } from './simulate-unit4-bootstrap.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
// Unit 4A is an immutable historical readiness transition: authority epoch 0,
// mode cutover_candidate, activation inactive. The worktree carries compact
// format 3.0.0 instead, so the candidate is always read from its accepted
// checkpoint and never from the live current state.
export const UNIT_4A_CHECKPOINT = 'fa986cf935abbf053172cfd549b0171bb9446f58';
const HASH = /^[0-9a-f]{64}$/;
const CANDIDATE_PATHS = Object.values(CANDIDATE_VIEW_PATHS);
const ROOT_PATHS = ROOT_AUTHORITIES.map(([value]) => value);

function parseJson(reader, relativePath, errors) {
  try {
    return JSON.parse(reader.readText(relativePath));
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON: ${error.message}`);
    return null;
  }
}

function stable(value) {
  return canonicalJson(value);
}

function fileHash(reader, relativePath) {
  return sha256(Buffer.from(reader.readText(relativePath), 'utf8'));
}

function unique(values) {
  return new Set(values).size === values.length;
}

export function validateCandidateSemantics(state) {
  const errors = [];
  if (state.schema_version !== '2.0.0') errors.push('candidate schema version mismatch');
  if (state.mode !== 'cutover_candidate') errors.push('candidate mode mismatch');
  if (state.authority !== 'non_canonical_until_supervisor_activation') errors.push('candidate presented as canonical');
  if (state.authority_epoch !== 0) errors.push('candidate authority epoch must be zero');
  if (state.activation?.status !== 'inactive') errors.push('active marker in Unit 4A');
  if (state.activation?.required_parent !== null) errors.push('required parent must be null before Unit 4B acceptance');
  if (state.activation?.accepted_unit4b_readiness_checkpoint !== null) {
    errors.push('accepted Unit 4B checkpoint must be null during Unit 4A');
  }
  if (state.repository?.canonical_workspace !== 'D:\\Programação\\controle-tapetes-g28') errors.push('wrong workspace');
  if (state.repository?.branch !== 'dev') errors.push('wrong branch');
  if (state.repository?.checkpoint_remote !== 'staging/dev') errors.push('wrong remote');
  if (state.applicable_baseline !== null) errors.push('applicable baseline must use explicit null');
  if (state.accepted_checkpoints?.unit_4_contract !== BASELINE) errors.push('Unit 4 contract checkpoint mismatch');
  if (state.phase_status?.unit4c !== 'NOT AUTHORIZED') errors.push('Unit 4C falsely authorized');
  if (state.phase_status?.unit5 !== 'NOT AUTHORIZED') errors.push('Unit 5 falsely authorized');
  errors.push(...rejectSelfReference(state));
  return errors;
}

export function validateIdentityGraph(state, readiness, reader) {
  const errors = [];
  const payloadHash = jsonSha256(statePayloadProjection(state));
  if (payloadHash !== state.activation.state_payload_sha256) errors.push('altered state payload projection');
  const activationHash = jsonSha256(activationManifestProjection(state));
  if (activationHash !== state.activation.activation_manifest_sha256) errors.push('altered activation manifest');
  if (readiness.identities.state_payload_sha256 !== payloadHash) errors.push('readiness state payload identity drift');
  if (readiness.identities.activation_manifest_sha256 !== activationHash) errors.push('readiness activation identity drift');
  if (readiness.identities.current_state_file_sha256 !== fileHash(reader, STATE_PATH)) {
    errors.push('final current-state file hash drift');
  }
  if (stable(readiness.identities.candidate_views) !== stable(state.activation.generated_view_hashes)) {
    errors.push('candidate view identity set drift');
  }
  if (JSON.stringify(state).includes(readiness.identities.current_state_file_sha256)) {
    errors.push('self-file full hash embedded in current state');
  }
  if (!HASH.test(payloadHash) || !HASH.test(activationHash)) errors.push('invalid hash domain');
  return errors;
}

export function validateConsumerInventory(readiness, contractText) {
  const errors = [];
  const paths = readiness.consumer_inventory.map(item => item.path);
  const contractPaths = [...contractText.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`/gmu)]
    .map(match => Number(match[1]) === 31
      ? 'docs/governance/ledger/g28-ledger-partition-index.json and partition family'
      : match[2]);
  if (paths.length !== 31) errors.push('consumer inventory must contain exactly 31 entries');
  if (!unique(paths)) errors.push('consumer inventory contains duplicate or extra entries');
  if (stable(paths) !== stable(CONSUMERS)) errors.push('consumer inventory differs from implemented exact set');
  if (stable(contractPaths) !== stable(CONSUMERS)) errors.push('consumer inventory differs from accepted contract');
  if (readiness.consumer_inventory.some(item => item.implementation_status !== 'RESOLVED')) {
    errors.push('unresolved consumer');
  }
  if (readiness.consumer_inventory.some(item => item.existing_behavior_remains_authoritative !== true)) {
    errors.push('consumer falsely marked as activated');
  }
  if (readiness.reference_search.unresolved_material_consumers !== 0) {
    errors.push('unresolved material consumer');
  }
  return errors;
}

function validateCatalogParity(current, baseline, manifest) {
  const errors = [];
  if (current.schema_version !== '2.0.0' || current.mode !== 'CUTOVER_CANDIDATE'
      || current.authority !== 'NON_CANONICAL_UNTIL_SUPERVISOR_ACTIVATION'
      || current.activation_status !== 'INACTIVE') {
    errors.push('candidate catalog authority semantics invalid');
  }
  const accepted = current.artifacts.filter(item => !CANDIDATE_PATHS.includes(item.path));
  if (accepted.length !== baseline.artifacts.length) errors.push('accepted catalog cardinality drift');
  const currentByPath = new Map(accepted.map(item => [item.path, item]));
  const semanticKeys = [
    'artifact_id', 'path', 'classification', 'authority', 'owner', 'bootstrap_tier',
    'status', 'disposition', 'role', 'survival_destination', 'compatibility_pointer',
    'review_status', 'review_basis'
  ];
  for (const prior of baseline.artifacts) {
    const item = currentByPath.get(prior.path);
    if (!item) {
      errors.push(`candidate catalog missing accepted artifact: ${prior.path}`);
      continue;
    }
    for (const key of semanticKeys) {
      if (stable(item[key]) !== stable(prior[key])) errors.push(`candidate catalog semantic drift: ${prior.path}:${key}`);
    }
  }
  const manifestByPath = new Map(manifest.documents.map(item => [item.path, item]));
  for (const candidatePath of CANDIDATE_PATHS) {
    const item = current.artifacts.find(entry => entry.path === candidatePath);
    if (!item || item.authority !== 'EVIDENCE_ONLY' || item.generated_status !== 'GENERATED') {
      errors.push(`candidate catalog classification missing: ${candidatePath}`);
    }
    for (const key of ['content_hash', 'line_count', 'byte_count', 'inbound_references', 'outbound_references']) {
      if (item?.[key] !== null) errors.push(`candidate catalog cyclic metadata: ${candidatePath}:${key}`);
    }
    if (!manifestByPath.has(candidatePath)) errors.push(`candidate view absent from document manifest: ${candidatePath}`);
  }
  return errors;
}

function validateTraceParity(current, baseline) {
  const errors = [];
  if (current.schema_version !== '2.0.0' || current.mode !== 'CUTOVER_CANDIDATE'
      || current.authority !== 'NON_CANONICAL_UNTIL_SUPERVISOR_ACTIVATION'
      || current.activation_status !== 'INACTIVE') {
    errors.push('candidate traceability authority semantics invalid');
  }
  if (current.requirements.length !== 13) errors.push('traceability must contain exactly 13 rows');
  if (stable(current.requirements) !== stable(baseline.requirements)) errors.push('accepted traceability row parity drift');
  return errors;
}

function validateViews(state, catalog, traceability, reader) {
  const errors = [];
  const expected = renderCandidateViews(state, catalog, traceability);
  if (stable(expected) !== stable(renderCandidateViews(state, catalog, traceability))) {
    errors.push('candidate renderer non-deterministic');
  }
  for (const [relativePath, text] of Object.entries(expected)) {
    if (!CANDIDATE_PATHS.includes(relativePath)) errors.push(`candidate renderer path escape: ${relativePath}`);
    const actual = reader.readText(relativePath);
    if (actual !== text) errors.push(`candidate view source drift: ${relativePath}`);
    if (!actual.includes(CANDIDATE_MARKER)) errors.push(`candidate marker missing: ${relativePath}`);
    if (actual.includes('\r')) errors.push(`candidate view not LF-only: ${relativePath}`);
    if (fileHash(reader, relativePath) !== state.activation.generated_view_hashes[relativePath]) {
      errors.push(`altered candidate-view hash: ${relativePath}`);
    }
  }
  for (const rootPath of ROOT_PATHS) {
    const text = reader.readText(rootPath);
    if (text.includes(CANDIDATE_MARKER) || text.includes('ACTIVE GENERATED AUTHORITY')) {
      errors.push(`generated-authority marker appearing at root path: ${rootPath}`);
    }
  }
  return errors;
}

function validateSourceEvidence(sourceManifest, equivalence, readiness) {
  const errors = [];
  const units = sourceManifest.sources.flatMap(source => source.units);
  const mappings = equivalence.mappings;
  const allowed = new Set([
    'REPRESENTED_IN_CANDIDATE_STATE',
    'PRESERVED_BY_AUTHORED_NORMATIVE_OWNER',
    'PRESERVED_BY_LEDGER_OR_ARCHIVE',
    'RETAINED_AS_NON_CURRENT_COMPATIBILITY_CONTENT',
    'DELIBERATELY_EXCLUDED_LIVE_GIT_STATE',
    'GENERATED_CANDIDATE_VIEW_CONTENT',
    'EXPLICIT_DEFERRED_NON_CURRENT_MATERIAL'
  ]);
  if (units.length !== 57 || mappings.length !== 57) errors.push('accepted Unit 1 coverage cardinality drift');
  if (!unique(mappings.map(item => item.source_id))) errors.push('duplicate source equivalence mapping');
  const ids = new Set(units.map(item => item.source_id));
  if (mappings.some(item => !ids.has(item.source_id))) errors.push('extra source equivalence mapping');
  if (units.some(item => !mappings.some(mapping => mapping.source_id === item.source_id))) {
    errors.push('missing source equivalence mapping');
  }
  if (mappings.some(item => !allowed.has(item.preservation_disposition)
      || item.semantic_status !== 'REVIEWED')) errors.push('invalid or unreviewed source disposition');
  if (mappings.some(item => item.preservation_disposition === 'REPRESENTED_IN_CANDIDATE_STATE'
      && !item.destination_json_pointer)) errors.push('represented source unit missing candidate pointer');
  if (readiness.source_equivalence.unresolved_units !== 0) errors.push('unresolved source equivalence unit');
  return errors;
}

function validatePointersAndRoots(state, catalog, reader) {
  const errors = [];
  for (const [name, relativePath] of Object.entries(state.governing_pointers)) {
    if (!reader.exists(relativePath)) errors.push(`missing governing pointer: ${name}:${relativePath}`);
  }
  for (const [rootPath, role] of ROOT_AUTHORITIES) {
    const declaration = state.root_authorities.find(item => item.path === rootPath);
    const catalogEntry = catalog.artifacts.find(item => item.path === rootPath);
    if (!declaration || declaration.role !== role || declaration.generated_status !== 'MANUAL'
        || declaration.remains_authoritative !== true) errors.push(`root authority removed: ${rootPath}`);
    if (!catalogEntry || catalogEntry.generated_status !== 'MANUAL') errors.push(`root reclassified as generated: ${rootPath}`);
  }
  return errors;
}

export function validateWithReaders(reader, baselineReader) {
  const errors = [];
  const state = parseJson(reader, STATE_PATH, errors);
  const readiness = parseJson(reader, READINESS_PATH, errors);
  const catalog = parseJson(reader, CATALOG_PATH, errors);
  const traceability = parseJson(reader, TRACE_PATH, errors);
  const sourceManifest = parseJson(reader, SOURCE_MANIFEST_PATH, errors);
  const equivalence = parseJson(reader, EQUIVALENCE_PATH, errors);
  const documentManifest = parseJson(reader, 'docs/governance/catalog/document-source-manifest.json', errors);
  const schemas = SCHEMAS.map(value => parseJson(reader, value, errors));
  if (errors.length) return { errors, results: {} };
  errors.push(...validateSchema(state, schemas[0], 'current-state-v2'));
  errors.push(...validateSchema(catalog, schemas[1], 'catalog-v2'));
  errors.push(...validateSchema(traceability, schemas[2], 'traceability-v2'));
  errors.push(...validateSchema(readiness, schemas[3], 'readiness-manifest'));
  errors.push(...validateCandidateSemantics(state));
  errors.push(...validateIdentityGraph(state, readiness, reader));
  const contractText = reader.readText('docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md');
  errors.push(...validateConsumerInventory(readiness, contractText));
  const baselineCatalog = parseJson(baselineReader, CATALOG_PATH, errors);
  const baselineTrace = parseJson(baselineReader, TRACE_PATH, errors);
  errors.push(...validateCatalogParity(catalog, baselineCatalog, documentManifest));
  errors.push(...validateTraceParity(traceability, baselineTrace));
  errors.push(...validateViews(state, catalog, traceability, reader));
  errors.push(...validateSourceEvidence(sourceManifest, equivalence, readiness));
  errors.push(...validatePointersAndRoots(state, catalog, reader));
  for (const relativePath of SCHEMAS) {
    if (readiness.identities.schemas[relativePath] !== fileHash(reader, relativePath)) {
      errors.push(`schema identity drift: ${relativePath}`);
    }
  }
  if (readiness.identities.catalog_sha256 !== fileHash(reader, CATALOG_PATH)) errors.push('altered catalog hash');
  if (readiness.identities.traceability_sha256 !== fileHash(reader, TRACE_PATH)) errors.push('altered traceability hash');
  if (readiness.fact_coverage.some(item => item.status !== 'COVERED')) errors.push('missing current-state fact');
  if (readiness.fact_coverage.length < 20) errors.push('current-state fact coverage incomplete');
  const ledger = readBoundedLedgerEvents(reader, state.bounded_recent_ledger_references);
  if (ledger.full_ledger_read || ledger.partitions_read.some(value => FULL_LEDGER_PATHS.has(value))) {
    errors.push('full-ledger read occurred');
  }
  const bootstrap = simulateWithReader(reader);
  if (bootstrap.prohibited_reads.length || bootstrap.full_ledger_read || bootstrap.private_memory_used) {
    errors.push('bootstrap isolation failed');
  }
  return {
    errors,
    results: {
      schema_version: state.schema_version,
      authority_epoch: state.authority_epoch,
      consumers: readiness.consumer_inventory.length,
      unresolved_consumers: readiness.reference_search.unresolved_material_consumers,
      fact_coverage: readiness.fact_coverage.length,
      source_units: sourceManifest.sources.flatMap(source => source.units).length,
      equivalence_mappings: equivalence.mappings.length,
      traceability_rows: traceability.requirements.length,
      bounded_ledger_events: ledger.events.length,
      partitions_read: ledger.partitions_read,
      full_ledger_read: ledger.full_ledger_read,
      candidate_views: CANDIDATE_PATHS.length,
      errors: errors.length
    }
  };
}

export function validateRepository(root = REPO_ROOT, commit = UNIT_4A_CHECKPOINT) {
  if (!commit) {
    return { errors: ['historical Unit 4A validation requires an accepted checkpoint commit'], results: {} };
  }
  return validateWithReaders(commitReader(root, commit), commitReader(root, BASELINE));
}

function main() {
  const rootIndex = process.argv.indexOf('--root');
  const commitIndex = process.argv.indexOf('--commit');
  const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());
  const commit = commitIndex >= 0 ? process.argv[commitIndex + 1] : UNIT_4A_CHECKPOINT;
  try {
    if (commitIndex >= 0 && !commit) throw new Error('--commit requires a SHA');
    const { errors, results } = validateRepository(root, commit);
    console.log(`UNIT4A_READINESS_RESULTS: ${JSON.stringify(results)}`);
    if (errors.length) {
      for (const error of errors) console.error(error);
      console.error('UNIT4A_READINESS_VALIDATION: FAIL');
      process.exitCode = 1;
    } else {
      console.log('UNIT4A_READINESS_VALIDATION: PASS');
    }
  } catch (error) {
    console.error(error.stack ?? error.message);
    console.error('UNIT4A_READINESS_VALIDATION: FAIL');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
