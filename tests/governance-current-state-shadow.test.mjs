import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildSourceManifest,
  buildEquivalenceSkeleton,
  writeManifest,
  REQUIRED_BOOTSTRAP_KEYS
} from '../scripts/governance/build-current-state-source-manifest.mjs';
import {
  loadState,
  renderViews
} from '../scripts/governance/render-current-state-shadow.mjs';
import {
  SHADOW_SCHEMA_PATH,
  UNIT1_CHECKPOINT,
  makeUnit1Fixture,
  parseBootstrapBlock,
  removeUnit1Fixture,
  validateRepository,
  validateRepositoryDetailed,
  validateSchemaValue
} from '../scripts/governance/validate-current-state-shadow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EPOCH1_CHECKPOINT = 'e88194cf6681d7aff154b22b4360e27b6d6e6dad';
const clone = value => JSON.parse(JSON.stringify(value));
const hasError = (errors, text) => errors.some(error => error.includes(text));

function makeFixture() { return makeUnit1Fixture(ROOT, UNIT1_CHECKPOINT); }

function cleanup(root) { removeUnit1Fixture(root); }
function read(root, relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function write(root, relativePath, text) { fs.writeFileSync(path.join(root, relativePath), text, 'utf8'); }
function mutateJson(root, relativePath, mutator) {
  const value = JSON.parse(read(root, relativePath));
  mutator(value);
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}
function mutateBootstrap(root, key, value) {
  const current = read(root, 'PROJECT_STATE.md');
  const next = current.replace(new RegExp(`^${key}: .*?$`, 'm'), `${key}: ${value}`);
  assert.notEqual(next, current, `fixture bootstrap key not found: ${key}`);
  write(root, 'PROJECT_STATE.md', next);
}
function editBootstrapLines(root, mutator) {
  const lines = read(root, 'PROJECT_STATE.md').replace(/\r\n?/g, '\n').split('\n');
  mutator(lines);
  write(root, 'PROJECT_STATE.md', lines.join('\n'));
}

test('valid complete repository fixture passes', () => {
  const root = makeFixture();
  try {
    const result = validateRepositoryDetailed(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.results.total_coverage_units, result.results.covered_units);
    for (const key of ['uncovered_ranges', 'overlapping_ranges', 'missing_mappings',
      'extra_mappings', 'duplicate_mappings', 'stale_mappings', 'unreviewed_mappings',
      'unique_content_mappings', 'ownerless_mappings', 'invalid_destinations',
      'invalid_anchors']) assert.equal(result.results[key], 0, key);
    assert.equal(result.results.structured_state_exact_mappings, 12);
  } finally { cleanup(root); }
});

test('new unmapped PROJECT_STATE heading fails', () => {
  const root = makeFixture();
  try {
    write(root, 'PROJECT_STATE.md', `${read(root, 'PROJECT_STATE.md')}\n## Fixture-only unmapped state section\ncontent\n`);
    assert.ok(hasError(validateRepository(root), 'missing mapping source ID'));
  } finally { cleanup(root); }
});

test('new unmapped AGENT_HANDOFF heading fails', () => {
  const root = makeFixture();
  try {
    write(root, 'AGENT_HANDOFF.md', `${read(root, 'AGENT_HANDOFF.md')}\n## Fixture-only unmapped handoff section\ncontent\n`);
    assert.ok(hasError(validateRepository(root), 'missing mapping source ID'));
  } finally { cleanup(root); }
});

test('changed mapped section content with stale hash fails', () => {
  const root = makeFixture();
  try {
    write(root, 'PROJECT_STATE.md', read(root, 'PROJECT_STATE.md').replace('## Active phase and next action', '## Active phase and next action\nfixture mutation'));
    assert.ok(hasError(validateRepository(root), 'source manifest is stale'));
  } finally { cleanup(root); }
});

test('missing mapping fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => value.mappings.pop());
    assert.ok(hasError(validateRepository(root), 'missing mapping source ID'));
  } finally { cleanup(root); }
});

test('duplicate mapping fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => value.mappings.push(clone(value.mappings[0])));
    assert.ok(hasError(validateRepository(root), 'duplicate mapping source ID'));
  } finally { cleanup(root); }
});

test('extra mapping fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => value.mappings.push({ ...value.mappings[0], source_id: 'EXTRA-SOURCE-ID' }));
    assert.ok(hasError(validateRepository(root), 'extra or nonexistent mapping source ID'));
  } finally { cleanup(root); }
});

test('mapping to nonexistent source ID fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => { value.mappings[0].source_id = 'NO-SUCH-SOURCE-ID'; });
    assert.ok(hasError(validateRepository(root), 'extra or nonexistent mapping source ID'));
  } finally { cleanup(root); }
});

test('actual unique content inserted into an existing section remains unreviewed and fails', () => {
  const root = makeFixture();
  try {
    const current = read(root, 'PROJECT_STATE.md');
    write(root, 'PROJECT_STATE.md', current.replace('## Active phase and next action\n', '## Active phase and next action\n\nFIXTURE_UNIQUE_NORMATIVE_RULE: approval required.\n'));
    writeManifest(root, true);
    const equivalence = JSON.parse(read(root, 'docs/governance/shadow/current-state-equivalence.json'));
    assert.ok(equivalence.mappings.some(mapping => mapping.semantic_status === 'UNREVIEWED'));
    assert.ok(hasError(validateRepository(root), 'unreviewed mapping'));
  } finally { cleanup(root); }
});

test('source change plus mechanical manifest and equivalence regeneration cannot preserve prior review', () => {
  const root = makeFixture();
  try {
    write(root, 'AGENT_HANDOFF.md', read(root, 'AGENT_HANDOFF.md').replace('## Workspace and Git\n', '## Workspace and Git\n\nfixture changed survival claim\n'));
    const manifest = writeManifest(root, true);
    const skeleton = buildEquivalenceSkeleton(manifest);
    assert.ok(skeleton.mappings.every(mapping => mapping.semantic_status === 'UNREVIEWED'));
    assert.ok(hasError(validateRepository(root), 'unreviewed mapping'));
  } finally { cleanup(root); }
});

test('uncovered normalized-byte source range fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-source-manifest.json', value => { value.sources[0].units[1].start_offset += 1; });
    assert.ok(hasError(validateRepository(root), 'uncovered source range'));
  } finally { cleanup(root); }
});

test('overlapping normalized-byte source ranges fail', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-source-manifest.json', value => { value.sources[0].units[1].start_offset -= 1; });
    assert.ok(hasError(validateRepository(root), 'overlapping source range'));
  } finally { cleanup(root); }
});

test('explicit UNREVIEWED disposition fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      Object.assign(value.mappings[0], { classification: 'UNREVIEWED', preservation_disposition: 'UNREVIEWED', semantic_status: 'UNREVIEWED' });
    });
    assert.ok(hasError(validateRepository(root), 'unreviewed mapping'));
  } finally { cleanup(root); }
});

test('nonexistent structured JSON pointer fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      value.mappings.find(mapping => mapping.classification === 'STRUCTURED_FIELD').destination_json_pointer = '/missing/value';
    });
    assert.ok(hasError(validateRepository(root), 'structured JSON pointer not found'));
  } finally { cleanup(root); }
});

test('structured JSON pointer with wrong value fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      value.mappings.find(mapping => mapping.source_id.endsWith('BOOTSTRAP_KEY:ACTIVE_PHASE')).destination_json_pointer = '/active_track';
    });
    assert.ok(hasError(validateRepository(root), 'structured value mismatch'));
  } finally { cleanup(root); }
});

test('owner path missing fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      const mapping = value.mappings.find(item => item.source_path === 'AGENT_HANDOFF.md');
      mapping.destination_path = mapping.actual_owner_path = 'docs/no-such-owner.md';
    });
    assert.ok(hasError(validateRepository(root), 'owner path missing'));
  } finally { cleanup(root); }
});

test('owner anchor missing fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      value.mappings.find(item => item.source_path === 'AGENT_HANDOFF.md').destination_anchor = '## NO SUCH OWNER ANCHOR';
    });
    assert.ok(hasError(validateRepository(root), 'owner anchor missing'));
  } finally { cleanup(root); }
});

test('owner classification rejects an existing ledger as a normative owner', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      const mapping = value.mappings.find(item => item.source_path === 'AGENT_HANDOFF.md');
      mapping.destination_path = mapping.actual_owner_path = 'docs/ledgers/G28_LEDGER.md';
      mapping.destination_anchor = '# G28 — LEDGER DE FASES ACEITAS';
    });
    assert.ok(hasError(validateRepository(root), 'owner type not allowed'));
  } finally { cleanup(root); }
});

test('normative AGENT_HANDOFF self-owner fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      const mapping = value.mappings.find(item => item.source_path === 'AGENT_HANDOFF.md');
      mapping.destination_path = mapping.actual_owner_path = 'AGENT_HANDOFF.md';
      mapping.destination_anchor = '# ACTIVE OPERATIONAL HANDOFF';
    });
    assert.ok(hasError(validateRepository(root), 'normative AGENT_HANDOFF self-owner'));
  } finally { cleanup(root); }
});

test('self-destination without retained-current-owner disposition fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      const mapping = value.mappings.find(item => item.preservation_disposition === 'RETAINED_IN_CURRENT_CANONICAL_SOURCE_PENDING_LATER_UNIT');
      mapping.classification = 'DUPLICATED_CURRENT_STATE';
      mapping.preservation_disposition = 'DUPLICATED_FROM_VERIFIED_OWNER';
    });
    assert.ok(hasError(validateRepository(root), 'self-destination lacks retained-current-owner disposition'));
  } finally { cleanup(root); }
});

test('generated shadow view cannot be an independent owner', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      const mapping = value.mappings.find(item => item.source_path === 'AGENT_HANDOFF.md');
      mapping.destination_path = mapping.actual_owner_path = 'docs/governance/shadow/generated/PROJECT_STATE.md';
      mapping.destination_anchor = '# PROJECT_STATE shadow view';
    });
    assert.ok(hasError(validateRepository(root), 'generated view cannot be an independent owner'));
  } finally { cleanup(root); }
});

test('structured preservation without a concrete target fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-equivalence.json', value => {
      value.mappings.find(mapping => mapping.classification === 'STRUCTURED_FIELD').destination_json_pointer = null;
    });
    assert.ok(hasError(validateRepository(root), 'structured preservation without structured target'));
  } finally { cleanup(root); }
});

test('bootstrap active phase mismatch fails', () => {
  const root = makeFixture();
  try { mutateBootstrap(root, 'ACTIVE_PHASE', 'WRONG-PHASE'); assert.ok(hasError(validateRepository(root), 'bootstrap value mismatch: ACTIVE_PHASE')); } finally { cleanup(root); }
});

test('bootstrap active track mismatch fails', () => {
  const root = makeFixture();
  try { mutateBootstrap(root, 'ACTIVE_TRACK', 'WRONG-TRACK'); assert.ok(hasError(validateRepository(root), 'bootstrap value mismatch: ACTIVE_TRACK')); } finally { cleanup(root); }
});

test('bootstrap governing pointer mismatch fails', () => {
  const root = makeFixture();
  try { mutateBootstrap(root, 'LEDGER', 'wrong-ledger.md'); assert.ok(hasError(validateRepository(root), 'bootstrap value mismatch: LEDGER')); } finally { cleanup(root); }
});

test('bootstrap accepted checkpoint mismatch fails', () => {
  const root = makeFixture();
  try { mutateBootstrap(root, 'ACCEPTED_CHECKPOINT', '0000000000000000000000000000000000000000'); assert.ok(hasError(validateRepository(root), 'bootstrap value mismatch: ACCEPTED_CHECKPOINT')); } finally { cleanup(root); }
});

test('missing bootstrap key fails', () => {
  const root = makeFixture();
  try {
    editBootstrapLines(root, lines => lines.splice(lines.findIndex(line => line.startsWith('ACTIVE_TRACK:')), 1));
    assert.ok(hasError(validateRepository(root), 'missing bootstrap key: ACTIVE_TRACK'));
  } finally { cleanup(root); }
});

test('duplicate bootstrap key fails', () => {
  const root = makeFixture();
  try {
    editBootstrapLines(root, lines => { const index = lines.findIndex(line => line.startsWith('ACTIVE_TRACK:')); lines.splice(index + 1, 0, lines[index]); });
    assert.ok(hasError(validateRepository(root), 'duplicate bootstrap key: ACTIVE_TRACK'));
  } finally { cleanup(root); }
});

test('unknown bootstrap key fails', () => {
  const root = makeFixture();
  try {
    editBootstrapLines(root, lines => { const index = lines.findIndex(line => line.startsWith('ACTIVE_TRACK:')); lines.splice(index, 0, 'UNKNOWN_BOOTSTRAP_KEY: value'); });
    assert.ok(hasError(validateRepository(root), 'unknown bootstrap key: UNKNOWN_BOOTSTRAP_KEY'));
  } finally { cleanup(root); }
});

test('unknown top-level state property fails schema validation', () => {
  const state = loadState(ROOT);
  state.unknown_top_level = true;
  const schema = JSON.parse(read(ROOT, SHADOW_SCHEMA_PATH));
  assert.ok(hasError(validateSchemaValue(state, schema), 'unknown property unknown_top_level'));
});

test('unknown nested state property fails schema validation', () => {
  const state = loadState(ROOT);
  state.repository.unknown_nested = true;
  const schema = JSON.parse(read(ROOT, SHADOW_SCHEMA_PATH));
  assert.ok(hasError(validateSchemaValue(state, schema), 'unknown property unknown_nested'));
});

test('wrong array-item shape fails schema validation', () => {
  const state = loadState(ROOT);
  state.protected_residue[0] = 'wrong-shape';
  const schema = JSON.parse(read(ROOT, SHADOW_SCHEMA_PATH));
  assert.ok(hasError(validateSchemaValue(state, schema), 'expected type object'));
});

test('manual generated-view edit fails', () => {
  const root = makeFixture();
  try {
    write(root, 'docs/governance/shadow/generated/PROJECT_STATE.md', `${read(root, 'docs/governance/shadow/generated/PROJECT_STATE.md')}manual edit\n`);
    assert.ok(hasError(validateRepository(root), 'generated view drifted'));
  } finally { cleanup(root); }
});

test('source-manifest stale line range or hash fails', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'docs/governance/shadow/current-state-source-manifest.json', value => { value.sources[0].units[0].start_line += 1; });
    assert.ok(hasError(validateRepository(root), 'source manifest is stale'));
  } finally { cleanup(root); }
});

test('deterministic source-manifest double build passes', () => {
  const root = makeFixture();
  try {
    const first = buildSourceManifest(root);
    const second = buildSourceManifest(root);
    assert.deepEqual(second, first);
  } finally { cleanup(root); }
});

test('deterministic generated-view double render passes', () => {
  const state = loadState(ROOT);
  assert.deepEqual(renderViews(clone(state)), renderViews(clone(state)));
});

test('bootstrap parser rejects changed key order', () => {
  const current = execFileSync('git', ['show', `${UNIT1_CHECKPOINT}:PROJECT_STATE.md`], {
    cwd: ROOT, encoding: 'utf8'
  });
  const parsed = parseBootstrapBlock(current);
  assert.deepEqual(parsed.order, REQUIRED_BOOTSTRAP_KEYS);
});

test('canonical epoch-1 state uses compact history and structured debt ownership', () => {
  // Read at the accepted epoch-1 closeout, not from the worktree: the live
  // canonical state is compact format 3.0.0 and owns none of these fields.
  const canonical = JSON.parse(execFileSync(
    'git', ['show', `${EPOCH1_CHECKPOINT}:docs/governance/current-state.json`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ));
  assert.equal(Object.hasOwn(canonical, 'current_fact_sections'), false);
  assert.deepEqual(canonical.historical_fact_sources.map(item => item.bootstrap_required), [false, false, false, false]);
  assert.ok(canonical.live_debts.every(item => item.owner_path === 'docs/governance/current-state.json'));
});
