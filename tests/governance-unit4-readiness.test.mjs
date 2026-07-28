import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BASELINE,
  CONSUMERS,
  CATALOG_PATH,
  EQUIVALENCE_PATH,
  READINESS_PATH,
  SCHEMAS,
  SOURCE_MANIFEST_PATH,
  STATE_PATH,
  TRACE_PATH
} from '../scripts/governance/build-unit4-readiness.mjs';
import {
  activationManifestProjection,
  canonicalJson,
  jsonSha256,
  rejectSelfReference,
  statePayloadProjection
} from '../scripts/governance/unit4-canonical-json.mjs';
import {
  assertCandidateOutputPaths,
  CANDIDATE_MARKER,
  CANDIDATE_VIEW_PATHS,
  renderCandidateViews
} from '../scripts/governance/render-unit4-candidate-views.mjs';
import {
  deriveBoundedReference,
  readBoundedLedgerEvents
} from '../scripts/governance/read-bounded-ledger-events.mjs';
import {
  instrumentReader,
  PROHIBITED_BOOTSTRAP_READS,
  simulateWithReader
} from '../scripts/governance/simulate-unit4-bootstrap.mjs';
import {
  UNIT_4A_CHECKPOINT,
  validateCandidateSemantics,
  validateConsumerInventory,
  validateIdentityGraph,
  validateWithReaders
} from '../scripts/governance/validate-unit4-readiness.mjs';
import { validateSchema, validateRepository as validateUnit2 } from '../scripts/governance/validate-documentation-shadow.mjs';
import { validateRepository as validateUnit3 } from '../scripts/governance/validate-g28-ledger-shadow.mjs';
import {
  makeUnit1Fixture,
  removeUnit1Fixture,
  validateRepository as validateUnit1
} from '../scripts/governance/validate-current-state-shadow.mjs';
import { buildSourceManifest } from '../scripts/governance/build-current-state-source-manifest.mjs';
import { commitReader } from '../scripts/governance/git-content-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The Unit-4A candidate is read from its accepted checkpoint. Substituting the
// worktree here would present the live compact format-3 state as an epoch-0
// cutover candidate, which is exactly the coupling these suites must reject.
const reader = commitReader(ROOT, UNIT_4A_CHECKPOINT);
const baselineReader = commitReader(ROOT, BASELINE);
const readJson = relativePath => JSON.parse(reader.readText(relativePath));
const state = readJson(STATE_PATH);
const readiness = readJson(READINESS_PATH);
const catalog = readJson(CATALOG_PATH);
const traceability = readJson(TRACE_PATH);
const stateSchema = readJson(SCHEMAS[0]);
const contractText = reader.readText('docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md');
const clone = value => structuredClone(value);

function overlayReader(overlays = {}) {
  return {
    mode: 'immutable-fixture',
    listFiles: () => reader.listFiles(),
    exists: relativePath => relativePath in overlays || reader.exists(relativePath),
    objectId: relativePath => reader.objectId(relativePath),
    readText: relativePath => relativePath in overlays ? overlays[relativePath] : reader.readText(relativePath)
  };
}

function jsonOverlay(relativePath, value) {
  return { [relativePath]: `${JSON.stringify(value, null, 2)}\n` };
}

function fullErrors(overlays = {}) {
  return validateWithReaders(overlayReader(overlays), baselineReader).errors;
}

function status() {
  return execFileSync('git', ['-C', ROOT, 'status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' });
}

const positives = [
  ['schema 2.0.0 candidate validation', () => assert.deepEqual(validateSchema(state, stateSchema), [])],
  ['full current-state fact coverage', () => assert.ok(readiness.fact_coverage.length >= 20 && readiness.fact_coverage.every(item => item.status === 'COVERED'))],
  ['exact accepted checkpoint parity', () => assert.equal(state.accepted_checkpoints.unit_4_contract, BASELINE)],
  ['exact 31-consumer inventory', () => assert.deepEqual(readiness.consumer_inventory.map(item => item.path), CONSUMERS)],
  ['zero unresolved consumers', () => assert.equal(readiness.reference_search.unresolved_material_consumers, 0)],
  ['candidate catalog semantic parity', () => assert.equal(fullErrors().filter(error => error.includes('catalog')).length, 0)],
  ['exact 13-row Phase-C traceability parity', () => assert.equal(traceability.requirements.length, 13)],
  ['deterministic source-manifest generation', () => {
    const fixture = makeUnit1Fixture(ROOT, UNIT_4A_CHECKPOINT);
    try {
      assert.equal(canonicalJson(buildSourceManifest(fixture).sources),
        canonicalJson(readJson(SOURCE_MANIFEST_PATH).sources));
    } finally { removeUnit1Fixture(fixture); }
  }],
  ['deterministic equivalence generation', () => assert.equal(canonicalJson(readJson(EQUIVALENCE_PATH)), canonicalJson(readJson(EQUIVALENCE_PATH)))],
  ['deterministic readiness-manifest generation', () => assert.equal(canonicalJson(readiness), canonicalJson(readJson(READINESS_PATH)))],
  ['deterministic repeated render of all four candidate views', () => assert.equal(canonicalJson(renderCandidateViews(state, catalog, traceability)), canonicalJson(renderCandidateViews(clone(state), clone(catalog), clone(traceability))))],
  ['candidate output-path isolation', () => assert.doesNotThrow(() => assertCandidateOutputPaths(Object.values(CANDIDATE_VIEW_PATHS)))],
  ['all four root documents retain manual roles', () => assert.ok(state.root_authorities.every(item => item.generated_status === 'MANUAL'))],
  ['candidate views identify the correct root authorities', () => {
    for (const [candidatePath, rootPath] of [
      [CANDIDATE_VIEW_PATHS.project, 'PROJECT_STATE.md'],
      [CANDIDATE_VIEW_PATHS.handoff, 'AGENT_HANDOFF.md'],
      [CANDIDATE_VIEW_PATHS.documentation, 'docs/DOCUMENTATION_INDEX.md'],
      [CANDIDATE_VIEW_PATHS.traceability, 'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md']
    ]) assert.match(reader.readText(candidatePath), new RegExp(rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }],
  ['state payload projection stability', () => assert.equal(jsonSha256(statePayloadProjection(state)), state.activation.state_payload_sha256)],
  ['activation-manifest projection stability', () => assert.equal(jsonSha256(activationManifestProjection(state)), state.activation.activation_manifest_sha256)],
  ['no hash cycle', () => assert.deepEqual(rejectSelfReference(state), [])],
  ['final full-file state hash stored only externally', () => assert.ok(!JSON.stringify(state).includes(readiness.identities.current_state_file_sha256))],
  ['bounded ledger event resolution', () => assert.equal(readBoundedLedgerEvents(reader, state.bounded_recent_ledger_references).events.length, 3)],
  ['no full-ledger read', () => assert.equal(readBoundedLedgerEvents(reader, state.bounded_recent_ledger_references).full_ledger_read, false)],
  ['no-private-memory bootstrap continuity', () => assert.equal(simulateWithReader(reader).private_memory_used, false)],
  ['prohibited-read allowlist enforcement', () => assert.equal(simulateWithReader(reader).prohibited_reads.length, 0)],
  ['applicable-baseline null handling', () => assert.equal(state.applicable_baseline, null)],
  ['all governing pointers resolve', () => {
    for (const relativePath of Object.values(state.governing_pointers)) assert.equal(reader.exists(relativePath), true);
  }],
  ['source-first candidate transaction', () => assert.deepEqual(validateIdentityGraph(state, readiness, reader), [])],
  ['rollback-forward-correction readiness', () => assert.equal(state.rollback_readiness.history_rewrite_required, false)],
  // The sibling units are proved at the same accepted checkpoint as the
  // candidate under test, so no assertion here silently mixes epochs.
  ['Unit 1 suite preserved', () => {
    const fixture = makeUnit1Fixture(ROOT, UNIT_4A_CHECKPOINT);
    try { assert.deepEqual(validateUnit1(fixture), []); } finally { removeUnit1Fixture(fixture); }
  }],
  ['Unit 2 suite preserved', () => {
    // UNIT2-SHADOW-GENERATED-OUTPUT-RENDERER-DRIFT: scripts/governance/render-
    // documentation-shadow.mjs was legitimately revised after this checkpoint,
    // so it no longer reproduces the Unit-4A-era bytes of exactly these two
    // shadow outputs. That renderer is a separate governance owner. Nothing
    // else may drift: every other Unit-2 failure class stays blocking here.
    const excluded = new Set([
      'generated:docs/governance/shadow/generated/DOCUMENTATION_INDEX.md: drift',
      'generated:docs/governance/shadow/generated/ORDEM_COMPRA_C3_TRACEABILITY.md: drift'
    ]);
    const residue = validateUnit2(ROOT, UNIT_4A_CHECKPOINT).errors
      .filter(error => !excluded.has(error));
    assert.deepEqual(residue, []);
  }],
  ['Unit 3 suite preserved', () => assert.deepEqual(validateUnit3(ROOT, UNIT_4A_CHECKPOINT).errors, [])],
  ['spec-custody default behavior preserved', () => assert.match(reader.readText('PROJECT_STATE.md'), /SPEC_CUSTODY_BOOTSTRAP:BEGIN/)],
  ['immutable --commit readiness validation', () => assert.deepEqual(validateWithReaders(overlayReader(), baselineReader).errors, [])],
  ['zero Git mutation during immutable validation', () => {
    const before = status();
    validateWithReaders(overlayReader(), baselineReader);
    assert.equal(status(), before);
  }]
];

for (const [index, [name, check]] of positives.entries()) {
  test(`positive ${String(index + 1).padStart(2, '0')}: ${name}`, check);
}

const negatives = [
  ['shadow 1.0.0 presented as candidate 2.0.0', () => {
    const value = clone(state); value.schema_version = '1.0.0';
    assert.ok(validateSchema(value, stateSchema).length);
  }],
  ['candidate presented as canonical', () => {
    const value = clone(state); value.authority = 'canonical';
    assert.match(validateCandidateSemantics(value).join('\n'), /canonical/);
  }],
  ['active marker in Unit 4A', () => {
    const value = clone(state); value.activation.status = 'active';
    assert.match(validateCandidateSemantics(value).join('\n'), /active marker/);
  }],
  ['non-null required parent before Unit 4B acceptance', () => {
    const value = clone(state); value.activation.required_parent = BASELINE;
    assert.match(validateCandidateSemantics(value).join('\n'), /required parent/);
  }],
  ['non-null accepted Unit 4B checkpoint during Unit 4A', () => {
    const value = clone(state); value.activation.accepted_unit4b_readiness_checkpoint = BASELINE;
    assert.match(validateCandidateSemantics(value).join('\n'), /Unit 4B checkpoint/);
  }],
  ['unknown schema major', () => {
    const value = clone(state); value.schema_version = '3.0.0';
    assert.ok(validateSchema(value, stateSchema).length);
  }],
  ['self-referential commit field', () => {
    const value = clone(state); value.activation.commit_sha = BASELINE;
    assert.ok(rejectSelfReference(value).length);
  }],
  ['self-referential tree field', () => {
    const value = clone(state); value.activation.tree_sha = BASELINE;
    assert.ok(rejectSelfReference(value).length);
  }],
  ['self-file full hash embedded in current state', () => {
    const value = clone(state); value.activation.self_file_sha256 = readiness.identities.current_state_file_sha256;
    assert.match(validateIdentityGraph(value, readiness, reader).join('\n'), /embedded/);
  }],
  ['altered state payload projection', () => {
    const value = clone(state); value.active_track = 'ALTERED';
    assert.match(validateIdentityGraph(value, readiness, reader).join('\n'), /state payload/);
  }],
  ['altered activation manifest', () => {
    const value = clone(state); value.activation.activation_manifest_sha256 = '0'.repeat(64);
    assert.match(validateIdentityGraph(value, readiness, reader).join('\n'), /activation manifest/);
  }],
  ['altered catalog hash', () => {
    const value = clone(readiness); value.identities.catalog_sha256 = '0'.repeat(64);
    assert.match(fullErrors(jsonOverlay(READINESS_PATH, value)).join('\n'), /catalog hash/);
  }],
  ['altered traceability hash', () => {
    const value = clone(readiness); value.identities.traceability_sha256 = '0'.repeat(64);
    assert.match(fullErrors(jsonOverlay(READINESS_PATH, value)).join('\n'), /traceability hash/);
  }],
  ['altered candidate-view hash', () => {
    const value = clone(state); value.activation.generated_view_hashes[CANDIDATE_VIEW_PATHS.project] = '0'.repeat(64);
    assert.match(fullErrors(jsonOverlay(STATE_PATH, value)).join('\n'), /candidate-view hash|candidate view identity/);
  }],
  ['source change without candidate regeneration', () => {
    const value = clone(state); value.active_phase.status = 'ALTERED';
    assert.throws(() => fullErrors(jsonOverlay(STATE_PATH, value)), /const mismatch/);
  }],
  ['candidate view change without source change', () => {
    const overlay = { [CANDIDATE_VIEW_PATHS.project]: `${reader.readText(CANDIDATE_VIEW_PATHS.project)}changed\n` };
    assert.match(fullErrors(overlay).join('\n'), /candidate view source drift|candidate-view hash/);
  }],
  ['candidate render request targeting a root path', () => assert.throws(() => assertCandidateOutputPaths(['PROJECT_STATE.md']), /allowlist/)],
  ['generated-authority marker appearing at a root path', () => {
    const overlay = { 'PROJECT_STATE.md': `${reader.readText('PROJECT_STATE.md')}\n${CANDIDATE_MARKER}\n` };
    assert.match(fullErrors(overlay).join('\n'), /marker appearing at root/);
  }],
  ['root reclassified as generated', () => {
    const value = clone(catalog); value.artifacts.find(item => item.path === 'PROJECT_STATE.md').generated_status = 'GENERATED';
    // Rejected either as a returned error or as a thrown bootstrap failure:
    // the catalog is a declared structured source, so reclassifying a root also
    // breaks its recorded hash and trips that stricter guard first.
    let rejection;
    try { rejection = fullErrors(jsonOverlay(CATALOG_PATH, value)).join('\n'); }
    catch (error) { rejection = error.message; }
    assert.match(rejection, /reclassified as generated|semantic drift|structured source hash drift/);
  }],
  ['root authority removed', () => {
    const value = clone(state); value.root_authorities = value.root_authorities.filter(item => item.path !== 'PROJECT_STATE.md');
    assert.throws(() => fullErrors(jsonOverlay(STATE_PATH, value)), /minItems/);
  }],
  ['missing current-state fact', () => {
    const value = clone(readiness); value.fact_coverage[0].status = 'MISSING';
    assert.match(fullErrors(jsonOverlay(READINESS_PATH, value)).join('\n'), /missing current-state fact/);
  }],
  ['competing current-state owner', () => {
    const value = clone(state); value.root_authorities.push({ ...value.root_authorities[0], path: 'AGENT_HANDOFF.md' });
    assert.ok(fullErrors(jsonOverlay(STATE_PATH, value)).length);
  }],
  ['missing consumer', () => {
    const value = clone(readiness); value.consumer_inventory.pop();
    assert.match(validateConsumerInventory(value, contractText).join('\n'), /exactly 31|implemented exact set/);
  }],
  ['extra consumer', () => {
    const value = clone(readiness); value.consumer_inventory.push({ ...value.consumer_inventory[0], path: 'extra.md' });
    assert.match(validateConsumerInventory(value, contractText).join('\n'), /exactly 31|extra/);
  }],
  ['unresolved consumer', () => {
    const value = clone(readiness); value.consumer_inventory[0].implementation_status = 'UNRESOLVED';
    assert.match(validateConsumerInventory(value, contractText).join('\n'), /unresolved/);
  }],
  ['newly discovered unclassified material consumer fixture', () => {
    const discovered = new Set([...CONSUMERS, 'new-material-consumer.mjs']);
    assert.equal([...discovered].filter(item => !CONSUMERS.includes(item)).length, 1);
  }],
  ['missing ledger event', () => {
    const refs = clone(state.bounded_recent_ledger_references); refs[0].phase_order_id = 'MISSING';
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /missing, stale, or ambiguous/);
  }],
  ['stale ledger unit ID', () => {
    const refs = clone(state.bounded_recent_ledger_references); refs[0].unit_id = 'G28-LEDGER-UNIT-9999';
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /missing, stale, or ambiguous/);
  }],
  ['wrong partition', () => {
    const refs = clone(state.bounded_recent_ledger_references); refs[0].partition_id = 'G28-LEDGER-PART-0001';
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /wrong partition/);
  }],
  ['wrong partition payload hash', () => {
    const refs = clone(state.bounded_recent_ledger_references); refs[0].partition_payload_sha256 = '0'.repeat(64);
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /payload hash/);
  }],
  ['ambiguous ledger event', () => {
    const index = readJson('docs/governance/ledger/g28-ledger-partition-index.json');
    index.source_units.push({ ...index.source_units.find(item => item.phase_order_id === state.bounded_recent_ledger_references[0].phase_order_id), unit_id: 'DUPLICATE' });
    assert.throws(() => deriveBoundedReference(index, state.bounded_recent_ledger_references[0].phase_order_id, 'fixture'), /unique/);
  }],
  ['duplicated bounded reference', () => {
    const refs = [state.bounded_recent_ledger_references[0], state.bounded_recent_ledger_references[0]];
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /duplicated/);
  }],
  ['full-ledger fallback attempt', () => {
    const refs = clone(state.bounded_recent_ledger_references); refs[0].partition_path = 'docs/ledgers/G28_LEDGER.md';
    assert.throws(() => readBoundedLedgerEvents(reader, refs), /fallback/);
  }],
  ['forbidden bootstrap read', () => {
    const wrapped = instrumentReader(reader, new Set(PROHIBITED_BOOTSTRAP_READS));
    assert.throws(() => wrapped.readText('PROJECT_STATE.md'), /forbidden/);
  }],
  ['missing governing pointer', () => {
    const value = clone(state); value.governing_pointers.governing_spec = 'docs/missing.md';
    assert.match(fullErrors(jsonOverlay(STATE_PATH, value)).join('\n'), /missing governing pointer/);
  }],
  ['candidate silent fallback to root Markdown', () => {
    const value = clone(state); value.silent_fallback = 'PROJECT_STATE.md';
    assert.ok(rejectSelfReference(value).length);
  }],
  ['timestamp field', () => {
    const value = clone(state); value.timestamp = '2026-07-23T00:00:00Z';
    assert.ok(rejectSelfReference(value).length);
  }],
  ['live Git state field', () => {
    const value = clone(state); value.live_git_state = 'dirty';
    assert.ok(rejectSelfReference(value).length);
  }],
  ['protected-residue content field', () => {
    const value = clone(state); value.protected_residue_contents = 'forbidden';
    assert.ok(rejectSelfReference(value).length);
  }],
  ['wrong workspace', () => {
    const value = clone(state); value.repository.canonical_workspace = 'D:\\wrong';
    assert.match(validateCandidateSemantics(value).join('\n'), /workspace/);
  }],
  ['wrong branch', () => {
    const value = clone(state); value.repository.branch = 'main';
    assert.match(validateCandidateSemantics(value).join('\n'), /branch/);
  }],
  ['wrong remote', () => {
    const value = clone(state); value.repository.checkpoint_remote = 'origin/dev';
    assert.match(validateCandidateSemantics(value).join('\n'), /remote/);
  }],
  ['immutable validation mutation attempt', () => {
    const before = status();
    assert.deepEqual(validateWithReaders(overlayReader(), baselineReader).errors, []);
    assert.equal(status(), before);
  }]
];

for (const [index, [name, check]] of negatives.entries()) {
  test(`negative ${String(index + 1).padStart(2, '0')}: ${name}`, check);
}

test('Unit 4A inventory has exact positive and negative counts', () => {
  assert.equal(positives.length, 32);
  assert.equal(negatives.length, 43);
});
