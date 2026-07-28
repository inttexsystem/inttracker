import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  COMPATIBILITY_BEGIN,
  COMPATIBILITY_PATH,
  INDEX_PATH,
  LEGACY_ENTRY_HEADINGS,
  PARTITION_DIR,
  PAYLOAD_BEGIN,
  PAYLOAD_END,
  SOURCE_MANIFEST_PATH,
  SOURCE_PATH,
  assertAppendStable,
  assertAppendStablePartitions,
  buildArtifacts,
  buildInboundMappings,
  buildPartitionIndex,
  buildSourceManifest,
  deriveSourceUnits,
  markdownHeadings,
  partitionUnits,
  sha256,
  splitRawLines
} from '../scripts/governance/build-g28-ledger-partitions.mjs';
import { isGeneratedDocument } from '../scripts/governance/build-document-source-manifest.mjs';
import { renderCompatibilityPayload, renderCompatibilityView } from '../scripts/governance/render-g28-ledger-shadow.mjs';
import { validateRepository, validateWithReader } from '../scripts/governance/validate-g28-ledger-shadow.mjs';
import { worktreeReader } from '../scripts/governance/git-content-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = 'docs/governance/catalog/document-source-manifest.json';
const DOCUMENT_CATALOG_PATH = 'docs/governance/catalog/documents.json';
const SOURCE_SCHEMA_PATH = 'docs/governance/schemas/g28-ledger-source-manifest.schema.json';
const INDEX_SCHEMA_PATH = 'docs/governance/schemas/g28-ledger-partition-index.schema.json';
const CURRENT_STATE_PATH = 'docs/governance/current-state.json';
const PUBLISHED_UNIT_3_CHECKPOINT = '52533cc1a7658cc23f055b782b98f2167b63893f';
// Terminal accepted Unit-4 checkpoint: the last state that owned bounded ledger
// references and evidence events.
const LIFECYCLE_CORRECTION_CHECKPOINT = '997332b1581b7dc111b1551773ee3611ef906c6d';
const readCheckpointText = relativePath => execFileSync(
  'git', ['show', `${LIFECYCLE_CORRECTION_CHECKPOINT}:${relativePath}`],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
const live = worktreeReader(ROOT);
const snapshotPaths = [SOURCE_PATH, SOURCE_MANIFEST_PATH, INDEX_PATH, COMPATIBILITY_PATH,
  SOURCE_SCHEMA_PATH, INDEX_SCHEMA_PATH, CATALOG_PATH, DOCUMENT_CATALOG_PATH,
  ...live.listFiles().filter(file => file.startsWith(`${PARTITION_DIR}/`))];
const files = new Map([...new Set(snapshotPaths)].map(file => [file, live.readText(file)]));

function gitBlobId(text) {
  const bytes = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function memoryReader(changes = {}) {
  const content = new Map(files);
  for (const [file, value] of Object.entries(changes)) {
    if (value === null) content.delete(file);
    else content.set(file, value);
  }
  return {
    mode: 'memory',
    listFiles: () => [...content.keys()].sort(),
    exists: file => content.has(file),
    readText: file => {
      if (!content.has(file)) throw new Error(`missing ${file}`);
      return content.get(file);
    },
    objectId: file => content.has(file)
      ? (file === SOURCE_PATH && content.get(file) === files.get(file) ? live.objectId(file) : gitBlobId(content.get(file)))
      : null
  };
}

function jsonChange(file, mutate) {
  const value = JSON.parse(files.get(file));
  mutate(value);
  return { [file]: `${JSON.stringify(value, null, 2)}\n` };
}

function textChange(file, mutate) {
  return { [file]: mutate(files.get(file)) };
}

function validationResult(changes = {}) {
  try { return validateWithReader(memoryReader(changes)); }
  catch (error) { return { errors: [error.message] }; }
}

function expectValidationFailure(name, changes, message) {
  test(name, () => {
    const result = validationResult(changes);
    assert.ok(result.errors.length > 0, 'mutation unexpectedly passed');
    if (message) assert.ok(result.errors.some(error => error.includes(message)), result.errors.join('\n'));
  });
}

function partitionFile(number) { return `${PARTITION_DIR}/G28_LEDGER_PART_${String(number).padStart(4, '0')}.md`; }
function mutatePartition(number, mutate) { return textChange(partitionFile(number), mutate); }
function currentManifest() { return JSON.parse(files.get(SOURCE_MANIFEST_PATH)); }
function currentIndex() { return JSON.parse(files.get(INDEX_PATH)); }
function currentSourceBytes() { return Buffer.from(files.get(SOURCE_PATH), 'utf8'); }
function recordedPartitionPayload(fileName) {
  const bytes = Buffer.from(files.get(`${PARTITION_DIR}/${fileName}`), 'utf8');
  const begin = Buffer.from(`${PAYLOAD_BEGIN}\n`, 'utf8');
  const end = Buffer.from(`\n${PAYLOAD_END}\n`, 'utf8');
  const start = bytes.indexOf(begin);
  const finish = bytes.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && finish >= 0);
  return bytes.subarray(start + begin.length, finish);
}

test('valid complete Unit 3 fixture passes', () => {
  const result = validateWithReader(memoryReader());
  const manifest = currentManifest();
  const index = currentIndex();
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.results, { source_bytes: manifest.canonical_byte_count, source_lines: manifest.canonical_line_count, source_units: manifest.units.length, entry_count: manifest.units.length - 1, partitions: index.partitions.length, inbound_references: index.inbound_reference_survival_mappings.length, errors: 0 });
});

test('canonical source Git object, hash, bytes, and lines are exact', () => {
  const manifest = currentManifest();
  assert.equal(manifest.canonical_source_git_object, live.objectId(SOURCE_PATH));
  assert.equal(manifest.canonical_source_sha256, sha256(currentSourceBytes()));
  assert.equal(manifest.canonical_byte_count, currentSourceBytes().length);
  assert.equal(manifest.canonical_line_count, splitRawLines(currentSourceBytes()).length);
});

test('partition index has exact dynamic identity parity', () => {
  const sourceBytes = currentSourceBytes();
  const manifest = currentManifest();
  const index = currentIndex();
  const expectedManifest = buildSourceManifest(sourceBytes, live.objectId(SOURCE_PATH));
  const expectedPartitions = partitionUnits(expectedManifest.units);
  const expectedIndex = buildPartitionIndex(
    sourceBytes,
    expectedManifest,
    expectedPartitions,
    buildInboundMappings(
      JSON.parse(files.get(CATALOG_PATH)),
      expectedManifest,
      expectedPartitions,
      markdownHeadings(splitRawLines(sourceBytes))
    )
  );
  const compatibilityPayload = renderCompatibilityPayload(ROOT);
  const reassembled = Buffer.concat(index.partitions.map(partition => recordedPartitionPayload(partition.file_name)));
  assert.equal(index.canonical_source_git_object, manifest.canonical_source_git_object);
  assert.equal(index.canonical_source_sha256, manifest.canonical_source_sha256);
  assert.equal(index.canonical_byte_count, sourceBytes.length);
  assert.equal(index.canonical_line_count, splitRawLines(sourceBytes).length);
  assert.equal(index.compatibility_view.payload_sha256, sha256(sourceBytes));
  assert.equal(index.compatibility_view.payload_sha256, sha256(compatibilityPayload));
  assert.equal(index.compatibility_view.payload_sha256, sha256(reassembled));
  assert.equal(index.complete_reassembly_sha256, sha256(reassembled));
  assert.deepEqual(index, expectedIndex);
});

test('source units are exhaustive, ordered, contiguous, and complete', () => {
  const manifest = currentManifest();
  let byte = 0;
  let line = 1;
  for (const unit of manifest.units) {
    assert.equal(unit.start_byte, byte);
    assert.equal(unit.start_line, line);
    assert.ok(unit.end_byte > unit.start_byte);
    assert.ok(unit.end_line >= unit.start_line);
    byte = unit.end_byte;
    line = unit.end_line + 1;
  }
  assert.equal(byte, manifest.canonical_byte_count);
  assert.equal(line, manifest.canonical_line_count + 1);
  assert.equal(new Set(manifest.units.map(unit => unit.unit_id)).size, manifest.units.length);
});

test('entry inventory and heading exceptions are deterministic', () => {
  const manifest = currentManifest();
  assert.equal(manifest.units.filter(unit => unit.unit_kind === 'PREAMBLE').length, 1);
  assert.equal(manifest.units.filter(unit => unit.unit_kind === 'ENTRY').length, manifest.units.length - 1);
  assert.equal(manifest.heading_exceptions.length, 2);
  assert.deepEqual(manifest.heading_exceptions.map(exception => exception.heading), LEGACY_ENTRY_HEADINGS);
  assert.equal(manifest.entry_heading_grammar, '^## YYYY-MM-DD — <non-empty title>$, plus exactly two reviewed legacy headings');
});

test('Unit 3 partitions are GENERATED while normal authored Markdown remains MANUAL', () => {
  const partition = `${PARTITION_DIR}/G28_LEDGER_PART_0001.md`;
  const authored = 'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md';
  const manifest = JSON.parse(files.get(CATALOG_PATH));
  assert.equal(isGeneratedDocument(partition), true);
  assert.equal(isGeneratedDocument(authored), false);
  assert.equal(manifest.documents.find(document => document.path === partition).generated_status, 'GENERATED');
  assert.equal(manifest.documents.find(document => document.path === authored).generated_status, 'MANUAL');
});

test('partitions contain complete source units without split entries', () => {
  const index = currentIndex();
  const unitIds = index.source_units.map(unit => unit.unit_id);
  assert.deepEqual(index.partitions.flatMap(partition => partition.unit_ids), unitIds);
  assert.equal(index.partitions.filter(partition => partition.oversized_single_unit).length, 0);
  assert.ok(index.partitions.every(partition => partition.line_count <= 1000 && partition.byte_count <= 128 * 1024));
  assert.equal(index.partitions.at(-1).status, 'OPEN');
  assert.ok(index.partitions.slice(0, -1).every(partition => partition.status === 'CLOSED'));
});

test('compatibility payload is reconstructed exactly from ordered partition payloads', () => {
  const compatibility = fs.readFileSync(path.join(ROOT, COMPATIBILITY_PATH));
  const begin = Buffer.from(`${COMPATIBILITY_BEGIN}\n`, 'utf8');
  const end = Buffer.from(`\n<!-- G28_LEDGER_SHADOW_COMPATIBILITY_PAYLOAD_END_7b9d4e3a -->\n`, 'utf8');
  const start = compatibility.indexOf(begin);
  const finish = compatibility.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && finish >= 0);
  const payload = compatibility.subarray(start + begin.length, finish);
  assert.deepEqual(payload, renderCompatibilityPayload(ROOT));
  assert.deepEqual(payload, currentSourceBytes());
});

test('reference survival has exact cardinality and path-only destination', () => {
  const index = currentIndex();
  const count = index.inbound_reference_survival_mappings.length;
  assert.ok(count > 0);
  assert.ok(index.inbound_reference_survival_mappings.every(mapping => mapping.resolution_status === 'COMPATIBILITY_VIEW'));
  assert.ok(index.inbound_reference_survival_mappings.every(mapping => mapping.compatibility_view_destination === COMPATIBILITY_PATH));
  assert.equal(new Set(index.inbound_reference_survival_mappings.map(mapping => mapping.mapping_id)).size, count);
});

test('append-stability fixture preserves every previously closed partition', () => {
  const result = assertAppendStable(currentSourceBytes(), currentIndex().partitions);
  assert.equal(result.appended_partition_count, result.old_partition_count);
});

test('double build is deterministic', () => {
  const first = buildArtifacts(ROOT);
  const second = buildArtifacts(ROOT);
  assert.deepEqual(second.manifest, first.manifest);
  assert.deepEqual(second.index, first.index);
  assert.deepEqual(second.partitions, first.partitions);
});

test('double render is deterministic', () => {
  assert.deepEqual(renderCompatibilityView(ROOT), renderCompatibilityView(ROOT));
});

test('Unit 3 worktree validator passes', () => {
  assert.deepEqual(validateRepository(ROOT).errors, []);
});

test('all Unit 3 JSON artifacts parse', () => {
  for (const file of [SOURCE_SCHEMA_PATH, INDEX_SCHEMA_PATH, SOURCE_MANIFEST_PATH, INDEX_PATH, CATALOG_PATH, DOCUMENT_CATALOG_PATH]) JSON.parse(files.get(file));
});

test('all Unit 3 modules pass syntax checking', () => {
  for (const file of ['scripts/governance/build-g28-ledger-partitions.mjs',
    'scripts/governance/render-g28-ledger-shadow.mjs', 'scripts/governance/validate-g28-ledger-shadow.mjs']) {
    execFileSync(process.execPath, ['--check', file], { cwd: ROOT, stdio: 'pipe' });
  }
});

expectValidationFailure('canonical ledger hash drift fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.canonical_source_sha256 = '0'.repeat(64);
}), 'canonical ledger source hash drift');

expectValidationFailure('valid-format incorrect partition index Git object identity fails', jsonChange(INDEX_PATH, value => {
  value.canonical_source_git_object = '0'.repeat(40);
}), 'partition index canonical source Git object identity drift');

expectValidationFailure('valid-format incorrect partition index source SHA-256 identity fails', jsonChange(INDEX_PATH, value => {
  value.canonical_source_sha256 = '0'.repeat(64);
}), 'partition index canonical source SHA-256 identity drift');

expectValidationFailure('incorrect positive partition index byte count identity fails', jsonChange(INDEX_PATH, value => {
  value.canonical_byte_count += 1;
}), 'partition index canonical byte count identity drift');

expectValidationFailure('incorrect positive partition index line count identity fails', jsonChange(INDEX_PATH, value => {
  value.canonical_line_count += 1;
}), 'partition index canonical line count identity drift');

expectValidationFailure('valid-format incorrect compatibility payload SHA-256 identity fails', jsonChange(INDEX_PATH, value => {
  value.compatibility_view.payload_sha256 = '0'.repeat(64);
}), 'partition index compatibility payload SHA-256 identity drift');

expectValidationFailure('valid-format incorrect complete reassembly SHA-256 identity fails', jsonChange(INDEX_PATH, value => {
  value.complete_reassembly_sha256 = '0'.repeat(64);
}), 'partition index complete reassembly SHA-256 identity drift');

test('coordinated false source and compatibility SHA-256 identities fail explicitly', () => {
  const changes = jsonChange(INDEX_PATH, value => {
    value.canonical_source_sha256 = 'f'.repeat(64);
    value.compatibility_view.payload_sha256 = 'f'.repeat(64);
  });
  const result = validationResult(changes);
  assert.ok(result.errors.includes('partition index canonical source SHA-256 identity drift'), result.errors.join('\n'));
  assert.ok(result.errors.includes('partition index compatibility payload SHA-256 identity drift'), result.errors.join('\n'));
});

expectValidationFailure('missing source-manifest schema fails', { [SOURCE_SCHEMA_PATH]: null }, `missing required ledger shadow artifact: ${SOURCE_SCHEMA_PATH}`);

expectValidationFailure('missing partition-index schema fails', { [INDEX_SCHEMA_PATH]: null }, `missing required ledger shadow artifact: ${INDEX_SCHEMA_PATH}`);

expectValidationFailure('malformed schema JSON fails', { [SOURCE_SCHEMA_PATH]: '{ malformed' }, `${SOURCE_SCHEMA_PATH}: invalid JSON`);

expectValidationFailure('source manifest schema violation fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.unreviewed_property = true;
}), `${SOURCE_MANIFEST_PATH}: unknown property unreviewed_property`);

expectValidationFailure('partition nested schema violation fails', jsonChange(INDEX_PATH, value => {
  delete value.partitions[0].status;
}), `${INDEX_PATH}.partitions[0]: missing required property status`);

expectValidationFailure('survival mapping nested schema violation fails', jsonChange(INDEX_PATH, value => {
  value.inbound_reference_survival_mappings[0].source_line = '1';
}), `${INDEX_PATH}.inbound_reference_survival_mappings[0].source_line: type violation`);

expectValidationFailure('unresolved local schema ref fails', jsonChange(SOURCE_SCHEMA_PATH, value => {
  value.$defs.unused = { $ref: '#/$defs/missing' };
}), 'unresolved local $ref');

expectValidationFailure('missing source byte fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.units[1].end_byte -= 1;
}), 'source manifest drift');

expectValidationFailure('duplicated source byte fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.units[2].start_byte = value.units[1].start_byte;
}), 'source manifest drift');

expectValidationFailure('overlapping source-unit ranges fail', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.units[2].start_line = value.units[1].start_line;
}), 'source manifest drift');

expectValidationFailure('uncovered source range fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.units[1].start_byte += 1;
}), 'source manifest drift');

expectValidationFailure('reordered source units fail', jsonChange(SOURCE_MANIFEST_PATH, value => {
  [value.units[1], value.units[2]] = [value.units[2], value.units[1]];
}), 'source manifest drift');

test('new non-dated ledger boundary fails during derivation', () => {
  const changed = Buffer.from(`${files.get(SOURCE_PATH)}\n## UNREVIEWED-NON-DATED-ENTRY\n\n- fixture\n`, 'utf8');
  assert.throws(() => deriveSourceUnits(changed), /unrecognized non-dated ledger entry heading/);
});

for (const [index, heading] of LEGACY_ENTRY_HEADINGS.entries()) {
  test(`mutation of reviewed legacy heading ${index + 1} fails during derivation`, () => {
    const changed = Buffer.from(files.get(SOURCE_PATH).replace(heading, `${heading} mutated`), 'utf8');
    assert.throws(() => deriveSourceUnits(changed), /unrecognized non-dated ledger entry heading/);
  });
  test(`demotion of reviewed legacy heading ${index + 1} fails during derivation`, () => {
    const changed = Buffer.from(files.get(SOURCE_PATH).replace(heading, heading.replace(/^##/u, '#')), 'utf8');
    assert.throws(() => deriveSourceUnits(changed), /must occur exactly once/);
  });
  test(`duplicate reviewed legacy heading ${index + 1} fails during derivation`, () => {
    const changed = Buffer.from(`${files.get(SOURCE_PATH)}\n${heading}\n\n- duplicate fixture\n`, 'utf8');
    assert.throws(() => deriveSourceUnits(changed), /must occur exactly once/);
  });
}

test('removal of a reviewed legacy heading fails during derivation', () => {
  const heading = LEGACY_ENTRY_HEADINGS[0];
  const changed = Buffer.from(files.get(SOURCE_PATH).replace(`${heading}\n`, ''), 'utf8');
  assert.throws(() => deriveSourceUnits(changed), /must occur exactly once/);
});

expectValidationFailure('duplicate unit ID fails', jsonChange(SOURCE_MANIFEST_PATH, value => {
  value.units[1].unit_id = value.units[2].unit_id;
}), 'duplicate source-unit ID');

expectValidationFailure('entry split between partitions fails', jsonChange(INDEX_PATH, value => {
  value.partitions[0].unit_ids.pop();
}), 'partition ordering');

expectValidationFailure('unjustified threshold overflow fails', jsonChange(INDEX_PATH, value => {
  value.thresholds.max_source_lines = 1001;
}), 'partition thresholds drift');

expectValidationFailure('missing partition fails', { [partitionFile(1)]: null }, 'missing partition');

expectValidationFailure('extra partition fails', { [partitionFile(9999)]: files.get(partitionFile(1)) }, 'extra partition');

expectValidationFailure('reordered partitions fail', jsonChange(INDEX_PATH, value => {
  [value.partitions[0], value.partitions[1]] = [value.partitions[1], value.partitions[0]];
}), 'partition ordering');

expectValidationFailure('altered partition payload fails', mutatePartition(1, value => value.replace(`${PAYLOAD_BEGIN}\n`, `${PAYLOAD_BEGIN}\nfixture mutation\n`)), 'altered partition payload');

expectValidationFailure('stale payload hash fails', jsonChange(INDEX_PATH, value => {
  value.partitions[0].payload_sha256 = '0'.repeat(64);
}), 'stale partition payload hash');

expectValidationFailure('invalid delimiter fails', mutatePartition(1, value => value.replace(PAYLOAD_END, 'BROKEN_PAYLOAD_END')), 'invalid payload delimiter');

expectValidationFailure('delimiter collision fails', textChange(SOURCE_PATH, value => `${value}\n${PAYLOAD_BEGIN}`), 'delimiter collision');

expectValidationFailure('compatibility payload drift fails', textChange(COMPATIBILITY_PATH, value => value.replace(`${COMPATIBILITY_BEGIN}\n`, `${COMPATIBILITY_BEGIN}\nfixture mutation\n`)), 'compatibility payload differs');

expectValidationFailure('independently sourced compatibility payload fails', textChange(COMPATIBILITY_PATH, value => value.replace('ORDERED_PARTITION_PAYLOADS', 'INDEPENDENT_COPY')), 'reconstructed independently');

expectValidationFailure('missing unit mapping fails', jsonChange(INDEX_PATH, value => {
  value.unit_to_partition.pop();
}), 'unit-to-partition mapping drift');

expectValidationFailure('duplicate unit mapping fails', jsonChange(INDEX_PATH, value => {
  value.unit_to_partition.push({ ...value.unit_to_partition[0] });
}), 'unit-to-partition mapping drift');

expectValidationFailure('missing inbound-reference mapping fails', jsonChange(INDEX_PATH, value => {
  value.inbound_reference_survival_mappings.pop();
}), 'inbound ledger reference missing');

expectValidationFailure('unused reference mapping fails', jsonChange(INDEX_PATH, value => {
  value.inbound_reference_survival_mappings.push({ ...value.inbound_reference_survival_mappings[0], mapping_id: 'G28-LEDGER-REF-9999' });
}), 'extra unused survival mapping');

function syntheticReference(overrides = {}) {
  return { source_path: 'fixture.md', source_line: 1, kind: 'ROOT_REFERENCE', anchor: null, line_suffix: null, ...overrides };
}

function syntheticMappings(reference, headings = markdownHeadings(splitRawLines(currentSourceBytes()))) {
  const manifest = buildSourceManifest(currentSourceBytes(), live.objectId(SOURCE_PATH));
  const partitions = partitionUnits(manifest.units);
  return () => buildInboundMappings({ documents: [{ path: SOURCE_PATH, inbound_references: [reference] }] }, manifest, partitions, headings);
}

test('missing anchor fails', () => {
  assert.throws(syntheticMappings(syntheticReference({ anchor: 'missing-anchor' })), /cannot be resolved/);
});

test('ambiguous anchor fails', () => {
  const headings = [{ anchor: 'duplicate-1', base_anchor: 'duplicate', line: 1 }, { anchor: 'duplicate-2', base_anchor: 'duplicate', line: 2 }];
  assert.throws(syntheticMappings(syntheticReference({ anchor: 'duplicate' }), headings), /ambiguous/);
});

test('invalid line suffix fails', () => {
  assert.throws(syntheticMappings(syntheticReference({ line_suffix: 'bad' })), /malformed/);
});

expectValidationFailure('line mapped to wrong partition fails', jsonChange(INDEX_PATH, value => {
  value.inbound_reference_survival_mappings[0].resolved_partition_id = value.partitions[0].partition_id;
}), 'inbound reference survival mapping drift');

expectValidationFailure('generated partition declared normative fails', mutatePartition(1, value => value.replace('GENERATED NON-CANONICAL', 'GENERATED NORMATIVE')), 'declared normative');

expectValidationFailure('appended ledger entry without regeneration fails', textChange(SOURCE_PATH, value => `${value}\n## 2099-12-31 — G28-LEDGER-APPEND-UNREGENERATED\n\n- fixture\n`), 'canonical ledger source hash drift');

test('same-byte-length closed payload mutation plus valid append fails payload proof', () => {
  const source = currentSourceBytes();
  const mutated = Buffer.from(source);
  const first = currentIndex().partitions[0];
  const mutation = mutated.indexOf(Buffer.from('Canonical', 'utf8'), first.start_byte);
  assert.ok(mutation >= first.start_byte && mutation < first.end_byte);
  mutated[mutation] = mutated[mutation] === 0x43 ? 0x44 : 0x43;
  const appended = Buffer.concat([mutated, Buffer.from('## 2099-12-31 — G28-LEDGER-APPEND-STABILITY-FIXTURE\n\n- fixture\n', 'utf8')]);
  const next = partitionUnits(deriveSourceUnits(appended).units);
  assert.deepEqual(next[0].unit_ids, first.unit_ids);
  assert.deepEqual(
    [next[0].start_byte, next[0].end_byte, next[0].start_line, next[0].end_line],
    [first.start_byte, first.end_byte, first.start_line, first.end_line]
  );
  assert.throws(
    () => assertAppendStablePartitions(source, appended, currentIndex().partitions, next),
    /previously closed partition payload/
  );
});

test('changed closed partition unit interval fails append-stability proof', () => {
  const source = currentSourceBytes();
  const appended = Buffer.concat([source, Buffer.from('## 2099-12-31 — G28-LEDGER-APPEND-STABILITY-FIXTURE\n\n- fixture\n', 'utf8')]);
  const next = partitionUnits(deriveSourceUnits(appended).units);
  next[0].unit_ids = [...next[0].unit_ids, 'G28-LEDGER-FAKE-UNIT'];
  assert.throws(() => assertAppendStablePartitions(source, appended, currentIndex().partitions, next), /closed partition unit interval/);
});

function gitState() {
  const run = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return {
    worktree_status: run(['status', '--porcelain=v1', '--untracked-files=all']),
    index_state: run(['ls-files', '--stage']),
    current_branch: run(['branch', '--show-current']).trim(),
    head: run(['rev-parse', 'HEAD']).trim(),
    refs: run(['show-ref', '--head'])
  };
}

test('published Unit 3 checkpoint immutable validation produces zero Git mutation', () => {
  const before = gitState();
  assert.deepEqual(validateRepository(ROOT, PUBLISHED_UNIT_3_CHECKPOINT).errors, []);
  const after = gitState();
  assert.deepEqual(after, before);
});

expectValidationFailure('generated artifact without explicit catalog review fails', jsonChange(DOCUMENT_CATALOG_PATH, value => {
  value.artifacts = value.artifacts.filter(artifact => artifact.path !== COMPATIBILITY_PATH);
}), `generated artifact added without explicit catalog review: ${COMPATIBILITY_PATH}`);

test('current correction is bounded while prior Unit 5 evidence remains append-stable', () => {
  const priorOrder = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-5-PRECONDITION-CANONICAL-AUTHORITY-CONSUMER-FORWARD-CORRECTION-R3';
  const correctionOrder = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-5-R2-BOOTSTRAP-VALIDATOR-LIFECYCLE-DECOUPLING-FORWARD-CORRECTION-R1';
  const manifest = currentManifest();
  const unitsFor = (units, order) => units.filter(unit => unit.phase_order_id === order);
  const prior = unitsFor(manifest.units, priorOrder);
  const correction = unitsFor(manifest.units, correctionOrder);
  assert.equal(prior.length, 1);
  assert.equal(correction.length, 1);
  assert.ok(prior[0].ordinal < correction[0].ordinal);

  // The bounded-reference coupling belongs to the epoch-1 state, which owned
  // bounded_recent_ledger_references and evidence_events. It is proved at the
  // checkpoint that established it. The live compact format-3 state owns
  // neither field and is deliberately not consulted here; the ledger has since
  // grown past this correction, which is exactly what append-only means.
  const historicalState = JSON.parse(readCheckpointText(CURRENT_STATE_PATH));
  const historicalManifest = JSON.parse(readCheckpointText(SOURCE_MANIFEST_PATH));
  const finalUnit = historicalManifest.units.at(-1);
  const currentBounded = historicalState.bounded_recent_ledger_references.at(-1);
  const currentEvent = historicalState.evidence_events.at(-1);
  assert.equal(finalUnit.phase_order_id, correctionOrder);
  assert.equal(finalUnit.phase_order_id, currentBounded.phase_order_id);
  assert.equal(finalUnit.unit_id, currentBounded.unit_id);
  assert.equal(currentBounded.event_id, currentBounded.phase_order_id);
  assert.ok(finalUnit.heading.endsWith(currentEvent.subject));
  const boundedOrdinals = historicalState.bounded_recent_ledger_references.map(reference =>
    historicalManifest.units.find(unit => unit.unit_id === reference.unit_id)?.ordinal);
  assert.ok(boundedOrdinals.every(Number.isInteger));
  assert.deepEqual(boundedOrdinals, [...boundedOrdinals].sort((left, right) => left - right));
  // The correction unit survives unchanged in the live append-only manifest.
  assert.deepEqual(correction[0].unit_id, currentBounded.unit_id);

  // Append-only means a partition that was already CLOSED at the accepted
  // Unit-3 checkpoint is byte-identical today. The partition that was OPEN then
  // has since been filled and closed by authorized appends, so comparing it to
  // that checkpoint would assert immutability the contract never claimed.
  const acceptedIndex = JSON.parse(execFileSync(
    'git', ['show', `${PUBLISHED_UNIT_3_CHECKPOINT}:${INDEX_PATH}`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ));
  const closedAtAcceptance = acceptedIndex.partitions
    .filter(item => item.status === 'CLOSED').map(item => item.file_name);
  assert.ok(closedAtAcceptance.length > 0);
  const closedNow = new Set(currentIndex().partitions
    .filter(item => item.status === 'CLOSED').map(item => item.file_name));
  for (const fileName of closedAtAcceptance) {
    assert.equal(closedNow.has(fileName), true, `partition reopened: ${fileName}`);
    const relativePath = `${PARTITION_DIR}/${fileName}`;
    const accepted = execFileSync('git', ['show', `${PUBLISHED_UNIT_3_CHECKPOINT}:${relativePath}`], {
      cwd: ROOT, encoding: 'utf8'
    });
    assert.equal(files.get(relativePath), accepted);
  }

  const futureSource = Buffer.concat([
    currentSourceBytes(),
    Buffer.from('\n## 2099-12-31 — FUTURE-GOVERNANCE-EVENT-R1 — append-only fixture\n\n- fixture\n', 'utf8')
  ]);
  const futureUnits = deriveSourceUnits(futureSource).units;
  assert.equal(unitsFor(futureUnits, priorOrder).length, 1);
  assert.equal(unitsFor(futureUnits, correctionOrder).length, 1);
  assert.ok(
    unitsFor(futureUnits, priorOrder)[0].ordinal < unitsFor(futureUnits, correctionOrder)[0].ordinal
  );
  assert.notEqual(futureUnits.at(-1).phase_order_id, correctionOrder);
});
