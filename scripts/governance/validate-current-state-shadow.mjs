import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT, SHADOW_MARKER, loadState, renderViews, validateStateShape
} from './render-current-state-shadow.mjs';
import {
  buildSourceManifest, normalizeLf, sha256, REQUIRED_BOOTSTRAP_KEYS
} from './build-current-state-source-manifest.mjs';

// Unit 1 is an immutable historical transition over the shadow current-state,
// the PROJECT_STATE.md bootstrap block and the AGENT_HANDOFF.md byte partition
// as they stood at its accepted checkpoint. None of those shapes survives in the
// worktree, so this validator only ever runs against a materialized checkpoint
// fixture and against the shadow-1.0.0 schema, never against the live compact
// format-3 canonical state or its schema.
export const UNIT1_CHECKPOINT = 'fa986cf935abbf053172cfd549b0171bb9446f58';
export const SHADOW_SCHEMA_PATH = 'docs/governance/schemas/current-state-shadow-v1.schema.json';
export const UNIT1_FIXTURE_FILES = Object.freeze([
  'CLAUDE.md',
  'PROJECT_STATE.md',
  'AGENT_HANDOFF.md',
  'docs/DOCUMENTATION_INDEX.md',
  'docs/ledgers/G28_LEDGER.md',
  'docs/governance/AGENT_INSTRUCTIONS.md',
  'docs/governance/DOCUMENTATION_MODEL.md',
  'docs/governance/SUPERVISION_PROTOCOL.md',
  'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md',
  // The shadow-1.0.0 schema was published at the canonical path back then; the
  // fixture restores it under the historical path this validator now reads.
  ['docs/governance/schemas/current-state.schema.json', SHADOW_SCHEMA_PATH],
  'docs/governance/shadow/current-state.json',
  'docs/governance/shadow/current-state-equivalence.json',
  'docs/governance/shadow/current-state-source-manifest.json',
  'docs/governance/shadow/generated/PROJECT_STATE.md',
  'docs/governance/shadow/generated/AGENT_HANDOFF.md',
  'docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md',
  'docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md',
  'docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md',
  'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md',
  'scripts/validate-spec-custody.mjs',
  'scripts/spec-custody/validation-core.mjs',
  'scripts/spec-custody/self-tests.mjs'
]);

export function makeUnit1Fixture(root = REPO_ROOT, commit = UNIT1_CHECKPOINT) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'g28-shadow-fixture-'));
  for (const entry of UNIT1_FIXTURE_FILES) {
    const [source, destination] = Array.isArray(entry) ? entry : [entry, entry];
    const target = path.join(fixture, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, execFileSync('git', ['show', `${commit}:${source}`], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    }), 'utf8');
  }
  return fixture;
}

export function removeUnit1Fixture(fixture) {
  fs.rmSync(fixture, { recursive: true, force: true });
}

const ALLOWED_CLASSIFICATIONS = new Set([
  'STRUCTURED_FIELD', 'NORMATIVE_OWNER_POINTER', 'HISTORICAL_LEDGER_CONTENT',
  'DUPLICATED_CURRENT_STATE', 'RETAINED_CURRENT_CANONICAL_CONTENT',
  'UNIQUE_CONTENT_REQUIRING_DISPOSITION', 'UNREVIEWED'
]);
const ALLOWED_DISPOSITIONS = new Set([
  'REPRESENTED_IN_STRUCTURED_STATE', 'PRESERVED_BY_EXISTING_NORMATIVE_OWNER',
  'DUPLICATED_FROM_VERIFIED_OWNER', 'RETAINED_IN_CURRENT_CANONICAL_SOURCE_PENDING_LATER_UNIT',
  'PRESERVED_IN_LEDGER_OR_ARCHIVE', 'UNIQUE_CONTENT_REQUIRING_DISPOSITION', 'UNREVIEWED'
]);
const REQUIRED_SOURCE_PATHS = [
  'CLAUDE.md', 'docs/governance/AGENT_INSTRUCTIONS.md',
  'docs/governance/DOCUMENTATION_MODEL.md', 'docs/governance/SUPERVISION_PROTOCOL.md',
  'PROJECT_STATE.md', 'AGENT_HANDOFF.md', 'docs/DOCUMENTATION_INDEX.md',
  'docs/ledgers/G28_LEDGER.md', 'scripts/validate-spec-custody.mjs',
  'scripts/spec-custody/validation-core.mjs', 'scripts/spec-custody/self-tests.mjs'
];
const CHECKPOINTS = {
  product: '3405fdab8e05ec0f81cbfe07c63c489e551fee92',
  clean_slate_readiness: '62bdcc75c335e3881adb1af6350de801675aa788',
  clean_slate_execution: '770772548baf04c52e9ef020ff94f8bdabf77f03'
};
const ENVIRONMENT_BOUNDARIES = {
  shared_development: 'ucrjtfswnfdlxwtmxnoo',
  production: 'gqmpsxkxynrjvidfmojk',
  forbidden_project: 'bhgifjrfagkzubpyqpew'
};

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function fullPath(root, relativePath) { return path.join(root, relativePath); }
function flattenManifestUnits(manifest) {
  return (manifest.sources ?? []).flatMap(source => (source.units ?? []).map(unit => ({ ...unit, source_path: source.source_path })));
}
function emptyResults() {
  return {
    total_coverage_units: 0, covered_units: 0, uncovered_ranges: 0, overlapping_ranges: 0,
    missing_mappings: 0, extra_mappings: 0, duplicate_mappings: 0, stale_mappings: 0,
    structured_state_exact_mappings: 0, verified_owner_pointer_mappings: 0,
    retained_current_owner_mappings: 0, ledger_archive_mappings: 0,
    unreviewed_mappings: 0, unique_content_mappings: 0, ownerless_mappings: 0,
    invalid_destinations: 0, invalid_anchors: 0
  };
}

function typeMatches(value, type) {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'null') return value === null;
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

export function validateSchemaValue(value, schema, location = '$') {
  const errors = [];
  if (schema.type && !typeMatches(value, schema.type)) errors.push(`${location}: expected type ${schema.type}`);
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !deepEqual(value, schema.const)) errors.push(`${location}: const mismatch`);
  if (schema.enum && !schema.enum.some(item => deepEqual(value, item))) errors.push(`${location}: enum mismatch`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: minLength violated`);
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern)).test(value)) errors.push(`${location}: pattern mismatch`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: minItems violated`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchemaValue(item, schema.items, `${location}[${index}]`)));
  }
  if (typeMatches(value, 'object')) {
    for (const required of schema.required ?? []) if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push(`${location}: missing required property ${required}`);
    const properties = schema.properties ?? {};
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push(`${location}: minProperties violated`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(`${location}: unknown property ${key}`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(...validateSchemaValue(value[key], schema.additionalProperties, `${location}.${key}`));
    }
    for (const [key, childSchema] of Object.entries(properties)) if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(...validateSchemaValue(value[key], childSchema, `${location}.${key}`));
  }
  return errors;
}

export function parseBootstrapBlock(text) {
  const lines = normalizeLf(text).split('\n');
  const beginMarker = '<!-- SPEC_CUSTODY_BOOTSTRAP:BEGIN -->';
  const endMarker = '<!-- SPEC_CUSTODY_BOOTSTRAP:END -->';
  const begins = lines.flatMap((line, index) => line === beginMarker ? [index] : []);
  const ends = lines.flatMap((line, index) => line === endMarker ? [index] : []);
  const errors = [];
  if (begins.length !== 1) errors.push(`bootstrap begin marker count ${begins.length}`);
  if (ends.length !== 1) errors.push(`bootstrap end marker count ${ends.length}`);
  if (errors.length) return { errors, values: {}, order: [] };
  const begin = begins[0];
  const end = ends[0];
  if (end <= begin + 3 || lines[begin + 1] !== '```text' || lines[end - 1] !== '```') errors.push('bootstrap fence malformed');
  const values = {};
  const order = [];
  for (const line of lines.slice(begin + 2, end - 1)) {
    const match = line.match(/^([A-Z_]+):[ \t]+(.+)$/);
    if (!match) { errors.push(`malformed bootstrap line: ${line || '<blank>'}`); continue; }
    const [, key, value] = match;
    if (!REQUIRED_BOOTSTRAP_KEYS.includes(key)) errors.push(`unknown bootstrap key: ${key}`);
    if (Object.prototype.hasOwnProperty.call(values, key)) errors.push(`duplicate bootstrap key: ${key}`);
    values[key] = value;
    order.push(key);
  }
  for (const key of REQUIRED_BOOTSTRAP_KEYS) if (!Object.prototype.hasOwnProperty.call(values, key)) errors.push(`missing bootstrap key: ${key}`);
  if (!deepEqual(order, REQUIRED_BOOTSTRAP_KEYS)) errors.push('bootstrap key order mismatch');
  return { errors, values, order };
}

function sourceUnitText(root, unit) {
  const normalized = normalizeLf(fs.readFileSync(fullPath(root, unit.source_path), 'utf8'));
  return Buffer.from(normalized, 'utf8').subarray(unit.start_offset, unit.end_offset).toString('utf8');
}

export function validateSourceManifest(manifest, root = REPO_ROOT) {
  const errors = [];
  const results = emptyResults();
  let expected;
  try { expected = buildSourceManifest(root); } catch (error) {
    return { errors: [`source manifest rebuild failed: ${error.message}`], results, expected: null, actualUnits: [], expectedUnits: [] };
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { errors: ['source manifest must be an object'], results, expected, actualUnits: [], expectedUnits: flattenManifestUnits(expected) };
  if (!deepEqual(manifest, expected)) errors.push('source manifest is stale, incomplete, or non-deterministic');
  if (manifest.schema_version !== '2.0.0') errors.push('source manifest schema_version mismatch');
  if (manifest.line_ending !== 'LF') errors.push('source manifest must declare LF normalization');
  if (manifest.coverage_model !== 'CONTIGUOUS_NORMALIZED_UTF8_BYTE_PARTITION') errors.push('source manifest coverage model mismatch');
  const expectedUnits = flattenManifestUnits(expected);
  const actualUnits = flattenManifestUnits(manifest);
  results.total_coverage_units = actualUnits.length;
  const ids = new Set();
  for (const sourcePath of ['PROJECT_STATE.md', 'AGENT_HANDOFF.md']) {
    const source = (manifest.sources ?? []).find(item => item.source_path === sourcePath);
    if (!source) { errors.push(`source manifest missing source ${sourcePath}`); continue; }
    const normalized = normalizeLf(fs.readFileSync(fullPath(root, sourcePath), 'utf8'));
    const bytes = Buffer.from(normalized, 'utf8');
    let cursor = 0;
    for (const unit of [...(source.units ?? [])].sort((left, right) => left.start_offset - right.start_offset || left.end_offset - right.end_offset)) {
      if (unit.start_offset > cursor) { results.uncovered_ranges += 1; errors.push(`uncovered source range: ${sourcePath}:${cursor}-${unit.start_offset}`); }
      if (unit.start_offset < cursor) { results.overlapping_ranges += 1; errors.push(`overlapping source range: ${unit.source_id}`); }
      cursor = Math.max(cursor, unit.end_offset);
      const validOffsets = Number.isInteger(unit.start_offset) && Number.isInteger(unit.end_offset) && unit.start_offset >= 0 && unit.end_offset > unit.start_offset && unit.end_offset <= bytes.length;
      if (!validOffsets) errors.push(`invalid normalized byte range: ${unit.source_id}`);
      else if (sha256(bytes.subarray(unit.start_offset, unit.end_offset)) !== unit.sha256) errors.push(`source unit hash mismatch: ${unit.source_id}`);
      else results.covered_units += 1;
      if (!Number.isInteger(unit.start_line) || !Number.isInteger(unit.end_line) || unit.start_line < 1 || unit.end_line < unit.start_line) errors.push(`invalid line range: ${unit.source_id}`);
      if (!['BOOTSTRAP_KEY', 'MARKDOWN_HEADING', 'TEXT_BLOCK', 'PREAMBLE'].includes(unit.source_kind)) errors.push(`invalid source kind: ${unit.source_id}`);
      if (ids.has(unit.source_id)) errors.push(`duplicate source unit ID: ${unit.source_id}`);
      ids.add(unit.source_id);
    }
    if (cursor < bytes.length) { results.uncovered_ranges += 1; errors.push(`uncovered source range: ${sourcePath}:${cursor}-${bytes.length}`); }
    if (cursor > bytes.length) { results.overlapping_ranges += 1; errors.push(`coverage exceeds source length: ${sourcePath}`); }
  }
  if (actualUnits.length !== expectedUnits.length) errors.push(`source unit count mismatch: expected ${expectedUnits.length}, got ${actualUnits.length}`);
  return { errors, results, expected, actualUnits, expectedUnits };
}

function resolveRootRelative(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..')) return null;
  const resolved = path.resolve(root, relativePath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
function anchorExists(filePath, anchor) {
  if (typeof anchor !== 'string' || anchor.length === 0) return false;
  return normalizeLf(fs.readFileSync(filePath, 'utf8')).split('\n').includes(anchor);
}
function normativeOwnerAllowed(relativePath) {
  return relativePath === 'PROJECT_STATE.md'
    || relativePath === 'docs/DOCUMENTATION_INDEX.md'
    || relativePath === 'docs/governance/AGENT_INSTRUCTIONS.md'
    || /^docs\/architecture\/.+\.md$/.test(relativePath ?? '')
    || /^docs\/governance\/(?!shadow\/).+\.md$/.test(relativePath ?? '');
}
function jsonPointerGet(value, pointer) {
  if (pointer === '') return { found: true, value };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false };
  let current = value;
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) return { found: false };
    current = current[key];
  }
  return { found: true, value: current };
}

export function validateEquivalence(equivalence, root = REPO_ROOT, manifest = buildSourceManifest(root), state = null) {
  const errors = [];
  const results = emptyResults();
  const units = flattenManifestUnits(manifest);
  const expectedById = new Map(units.map(unit => [unit.source_id, unit]));
  const actualState = state ?? readJson(fullPath(root, 'docs/governance/shadow/current-state.json'));
  if (!equivalence || typeof equivalence !== 'object' || Array.isArray(equivalence)) return { errors: ['equivalence must be an object'], results };
  if (equivalence.schema_version !== '2.0.0') errors.push('equivalence schema_version mismatch');
  if (equivalence.manifest_id !== manifest.manifest_id) errors.push('equivalence manifest_id mismatch');
  if (!Array.isArray(equivalence.mappings)) return { errors: [...errors, 'equivalence mappings must be an array'], results };
  const seen = new Set();
  for (const [index, mapping] of equivalence.mappings.entries()) {
    const label = mapping.source_id ?? `mapping-${index}`;
    if (seen.has(mapping.source_id)) { results.duplicate_mappings += 1; errors.push(`duplicate mapping source ID: ${label}`); }
    seen.add(mapping.source_id);
    const unit = expectedById.get(mapping.source_id);
    if (!unit) { results.extra_mappings += 1; errors.push(`extra or nonexistent mapping source ID: ${label}`); continue; }
    if (mapping.source_path !== unit.source_path) errors.push(`mapping source path mismatch: ${label}`);
    if (mapping.source_sha256 !== unit.sha256) { results.stale_mappings += 1; errors.push(`stale mapping source hash: ${label}`); }
    if (!ALLOWED_CLASSIFICATIONS.has(mapping.classification)) errors.push(`invalid classification: ${label}`);
    if (!ALLOWED_DISPOSITIONS.has(mapping.preservation_disposition)) errors.push(`invalid preservation disposition: ${label}`);
    if (typeof mapping.review_basis !== 'string' || mapping.review_basis.length === 0) errors.push(`missing review basis: ${label}`);
    const unreviewed = mapping.classification === 'UNREVIEWED' || mapping.preservation_disposition === 'UNREVIEWED' || mapping.semantic_status !== 'REVIEWED';
    if (unreviewed) { results.unreviewed_mappings += 1; errors.push(`unreviewed mapping: ${label}`); }
    if (mapping.classification === 'UNIQUE_CONTENT_REQUIRING_DISPOSITION' || mapping.preservation_disposition === 'UNIQUE_CONTENT_REQUIRING_DISPOSITION') {
      results.unique_content_mappings += 1;
      errors.push(`unique content requires disposition: ${label}`);
    }
    const destinationFile = resolveRootRelative(root, mapping.destination_path);
    if (!destinationFile || !fs.existsSync(destinationFile) || !fs.statSync(destinationFile).isFile()) {
      results.invalid_destinations += 1;
      errors.push(`invalid destination path: ${label}`);
    }
    const structured = mapping.preservation_disposition === 'REPRESENTED_IN_STRUCTURED_STATE';
    if (structured) {
      if (mapping.classification !== 'STRUCTURED_FIELD' || mapping.destination_path !== 'docs/governance/shadow/current-state.json' || typeof mapping.destination_json_pointer !== 'string') {
        results.ownerless_mappings += 1;
        errors.push(`structured preservation without structured target: ${label}`);
      } else {
        const target = jsonPointerGet(actualState, mapping.destination_json_pointer);
        if (!target.found) errors.push(`structured JSON pointer not found: ${label}`);
        else {
          const match = sourceUnitText(root, unit).trimEnd().match(/^([A-Z_]+):[ \t]+(.+)$/);
          if (!match || match[1] !== unit.heading_text || target.value !== match[2]) errors.push(`structured value mismatch: ${label}`);
          else results.structured_state_exact_mappings += 1;
        }
      }
      if (mapping.actual_owner_path !== null || mapping.destination_anchor !== null) errors.push(`structured mapping declares independent owner or anchor: ${label}`);
      continue;
    }
    if (mapping.destination_json_pointer !== null) errors.push(`non-structured mapping declares JSON pointer: ${label}`);
    const ownerFile = resolveRootRelative(root, mapping.actual_owner_path);
    if (!ownerFile || !fs.existsSync(ownerFile) || !fs.statSync(ownerFile).isFile()) {
      results.ownerless_mappings += 1;
      errors.push(`owner path missing: ${label}`);
    }
    if (mapping.actual_owner_path?.startsWith('docs/governance/shadow/generated/')) errors.push(`generated view cannot be an independent owner: ${label}`);
    if (unit.source_path === 'AGENT_HANDOFF.md' && mapping.actual_owner_path === 'AGENT_HANDOFF.md') errors.push(`normative AGENT_HANDOFF self-owner: ${label}`);
    const selfDestination = mapping.destination_path === unit.source_path || mapping.actual_owner_path === unit.source_path;
    const retained = mapping.preservation_disposition === 'RETAINED_IN_CURRENT_CANONICAL_SOURCE_PENDING_LATER_UNIT';
    if (selfDestination && !retained) errors.push(`self-destination lacks retained-current-owner disposition: ${label}`);
    if (retained) {
      if (unit.source_path !== 'PROJECT_STATE.md' || mapping.destination_path !== 'PROJECT_STATE.md' || mapping.actual_owner_path !== 'PROJECT_STATE.md' || mapping.classification !== 'RETAINED_CURRENT_CANONICAL_CONTENT') errors.push(`invalid retained-current-owner mapping: ${label}`);
      else results.retained_current_owner_mappings += 1;
    }
    if (ownerFile && fs.existsSync(ownerFile) && (!mapping.destination_anchor || !anchorExists(ownerFile, mapping.destination_anchor))) {
      results.invalid_anchors += 1;
      errors.push(`owner anchor missing: ${label}`);
    }
    if (mapping.preservation_disposition === 'PRESERVED_IN_LEDGER_OR_ARCHIVE') {
      if (mapping.classification !== 'HISTORICAL_LEDGER_CONTENT' || !/^(docs\/ledgers|docs\/closeouts)\//.test(mapping.actual_owner_path ?? '')) errors.push(`invalid ledger/archive owner: ${label}`);
      else results.ledger_archive_mappings += 1;
    } else if (!retained && !unreviewed && mapping.preservation_disposition !== 'UNIQUE_CONTENT_REQUIRING_DISPOSITION') {
      if (!['PRESERVED_BY_EXISTING_NORMATIVE_OWNER', 'DUPLICATED_FROM_VERIFIED_OWNER'].includes(mapping.preservation_disposition)) errors.push(`invalid owner-pointer disposition: ${label}`);
      else if (mapping.destination_path !== mapping.actual_owner_path) errors.push(`destination and actual owner differ: ${label}`);
      else if (!normativeOwnerAllowed(mapping.actual_owner_path)) errors.push(`owner type not allowed: ${label}`);
      else results.verified_owner_pointer_mappings += 1;
    }
  }
  for (const unit of units) if (!seen.has(unit.source_id)) { results.missing_mappings += 1; errors.push(`missing mapping source ID: ${unit.source_id}`); }
  return { errors, results };
}

function requireMappedSection(root, manifest, equivalence, token) {
  const candidates = flattenManifestUnits(manifest).filter(unit => unit.source_path === 'PROJECT_STATE.md' && sourceUnitText(root, unit).includes(token));
  if (candidates.length === 0) return [`canonical owner unit count for ${token}: 0`];
  const mapped = candidates.filter(unit => equivalence.mappings.some(item => item.source_id === unit.source_id && item.semantic_status === 'REVIEWED'));
  return mapped.length ? [] : [`canonical owner unit is unreviewed or unmapped for ${token}`];
}

export function validateGeneratedText(projectText, handoffText) {
  const errors = [];
  for (const [name, text, maxLines] of [['PROJECT_STATE', projectText, 150], ['AGENT_HANDOFF', handoffText, 120]]) {
    if (typeof text !== 'string') { errors.push(`${name} generated view is not text`); continue; }
    if (!text.includes(SHADOW_MARKER)) errors.push(`${name} generated view marker missing`);
    if (!text.endsWith('\n')) errors.push(`${name} generated view must end with LF`);
    if (text.includes('\r')) errors.push(`${name} generated view must use LF only`);
    if (text.split('\n').length - 1 > maxLines) errors.push(`${name} generated view exceeds ${maxLines} lines`);
    if (/timestamp|git_status|live_git|credential/i.test(text)) errors.push(`${name} generated view contains unstable or secret content`);
  }
  return errors;
}

export function validateGeneratedFiles(root = REPO_ROOT, state = loadState(root)) {
  const projectPath = fullPath(root, 'docs/governance/shadow/generated/PROJECT_STATE.md');
  const handoffPath = fullPath(root, 'docs/governance/shadow/generated/AGENT_HANDOFF.md');
  if (!fs.existsSync(projectPath) || !fs.existsSync(handoffPath)) return ['generated shadow files are missing'];
  const projectText = fs.readFileSync(projectPath, 'utf8');
  const handoffText = fs.readFileSync(handoffPath, 'utf8');
  const errors = validateGeneratedText(projectText, handoffText);
  try {
    const expected = renderViews(state);
    if (projectText !== expected.project) errors.push('PROJECT_STATE generated view drifted from deterministic renderer');
    if (handoffText !== expected.handoff) errors.push('AGENT_HANDOFF generated view drifted from deterministic renderer');
    if (!deepEqual(expected, renderViews(state))) errors.push('renderer is not deterministic');
  } catch (error) { errors.push(`renderer failed: ${error.message}`); }
  return errors;
}

export function validateCanonicalReconciliation(root, state, manifest, equivalence) {
  const errors = [];
  const projectText = fs.readFileSync(fullPath(root, 'PROJECT_STATE.md'), 'utf8');
  const handoffText = fs.readFileSync(fullPath(root, 'AGENT_HANDOFF.md'), 'utf8');
  const parsed = parseBootstrapBlock(projectText);
  errors.push(...parsed.errors);
  const expected = {
    LAST_ACCEPTED_PHASE: state.last_accepted_phase, ACTIVE_PHASE: state.active_phase.id,
    ACTIVE_PHASE_CONTRACT: state.active_phase.contract, ACTIVE_TRACK: state.active_track,
    NEXT_AUTHORIZABLE_ACTION: state.next_authorizable_action.canonical_value,
    GOVERNING_SPEC: state.governing_pointers.governing_spec,
    TECHNICAL_CONTRACT: state.governing_pointers.technical_contract,
    SEQUENCE_AUTHORITY: state.governing_pointers.sequence_authority,
    TRACEABILITY: state.governing_pointers.traceability, LEDGER: state.governing_pointers.ledger,
    HANDOFF: state.governing_pointers.handoff, ACCEPTED_CHECKPOINT: state.accepted_checkpoints.product
  };
  for (const key of REQUIRED_BOOTSTRAP_KEYS) if (parsed.values[key] !== expected[key]) errors.push(`bootstrap value mismatch: ${key}`);
  for (const text of ['GOVERNANCE-EFFICIENCY-REFOUNDATION', 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4A-CUTOVER-READINESS-IMPLEMENTATION-R1']) if (!handoffText.includes(text)) errors.push(`AGENT_HANDOFF missing current action text: ${text}`);
  const contractPath = fullPath(root, state.active_phase.contract);
  if (!fs.existsSync(contractPath)) errors.push('active phase contract is missing');
  else if (!normalizeLf(fs.readFileSync(contractPath, 'utf8')).includes('<!-- MATERIAL_PHASE_CONTRACT:BEGIN -->\nPHASE_ID: GOVERNANCE-EFFICIENCY-REFOUNDATION\n<!-- MATERIAL_PHASE_CONTRACT:END -->')) errors.push('active phase contract material marker mismatch');
  for (const [name, pointer] of Object.entries(state.governing_pointers)) if (!fs.existsSync(fullPath(root, pointer))) errors.push(`governing pointer missing (${name}): ${pointer}`);
  for (const relativePath of REQUIRED_SOURCE_PATHS) if (!fs.existsSync(fullPath(root, relativePath))) errors.push(`mandatory reconciliation source missing: ${relativePath}`);
  for (const [key, value] of Object.entries(CHECKPOINTS)) errors.push(...requireMappedSection(root, manifest, equivalence, value).map(error => `${key}: ${error}`));
  for (const [key, value] of Object.entries(ENVIRONMENT_BOUNDARIES)) errors.push(...requireMappedSection(root, manifest, equivalence, value).map(error => `${key}: ${error}`));
  return errors;
}

export function validateRepositoryDetailed(root = REPO_ROOT) {
  const errors = [];
  const results = emptyResults();
  let state;
  let manifest;
  let manifestResult;
  let equivalence;
  try { state = loadState(root); } catch (error) { return { errors: [`cannot load state: ${error.message}`], results }; }
  try { errors.push(...validateSchemaValue(state, readJson(fullPath(root, SHADOW_SCHEMA_PATH)))); } catch (error) { errors.push(`cannot load schema: ${error.message}`); }
  errors.push(...validateStateShape(state));
  try { manifest = readJson(fullPath(root, 'docs/governance/shadow/current-state-source-manifest.json')); } catch (error) { errors.push(`cannot load source manifest: ${error.message}`); }
  if (manifest) {
    manifestResult = validateSourceManifest(manifest, root);
    errors.push(...manifestResult.errors);
    Object.assign(results, manifestResult.results);
  }
  try { equivalence = readJson(fullPath(root, 'docs/governance/shadow/current-state-equivalence.json')); } catch (error) { errors.push(`cannot load equivalence: ${error.message}`); }
  if (equivalence && manifest) {
    const equivalenceResult = validateEquivalence(equivalence, root, manifestResult?.expected ?? manifest, state);
    errors.push(...equivalenceResult.errors);
    for (const [key, value] of Object.entries(equivalenceResult.results)) if (!['total_coverage_units', 'covered_units', 'uncovered_ranges', 'overlapping_ranges'].includes(key)) results[key] = value;
    errors.push(...validateCanonicalReconciliation(root, state, manifestResult?.expected ?? manifest, equivalence));
  }
  if (!errors.length) errors.push(...validateGeneratedFiles(root, state));
  return { errors, results };
}
export function validateRepository(root = REPO_ROOT) { return validateRepositoryDetailed(root).errors; }

function main() {
  const rootIndex = process.argv.indexOf('--root');
  const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());
  const { errors, results } = validateRepositoryDetailed(root);
  if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
  else {
    console.log(`CURRENT_STATE_SHADOW_RESULTS: ${JSON.stringify(results)}`);
    console.log('CURRENT_STATE_SHADOW_VALIDATION: PASS');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
