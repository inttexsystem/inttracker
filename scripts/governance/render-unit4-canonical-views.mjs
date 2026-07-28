import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  catalogRenderProjection,
  jsonSha256,
  sha256,
  traceabilityRenderProjection
} from './unit4-canonical-json.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const RENDERER_ID = 'scripts/governance/render-unit4-canonical-views.mjs';
export const CUTOVER_ID = 'GOVERNANCE-EFFICIENCY-REFOUNDATION-UNIT-4C-AUTHORITY-CUTOVER-R1';
export const CANONICAL_VIEW_PATHS = Object.freeze({
  project: 'PROJECT_STATE.md',
  handoff: 'AGENT_HANDOFF.md',
  documentation: 'docs/DOCUMENTATION_INDEX.md',
  traceability: 'docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md'
});
const ALL_CANONICAL_VIEW_PATHS = Object.freeze(Object.values(CANONICAL_VIEW_PATHS));
export const CANONICAL_OUTPUT_ALLOWLIST = new Set(Object.values(CANONICAL_VIEW_PATHS));

// This renderer serves two disjoint state formats and must never mix them.
//
//   HISTORICAL — authority epoch 1, `schema_version` 2.0.0, carries `activation`.
//     Its projections are immutable: they are the only way the accepted Unit-4C
//     and Unit-4D checkpoints can still reproduce their own committed roots.
//
//   LIVE — compact `format_version` 3.0.0, carries no activation machinery.
//
// Format is derived from the state itself, never from the caller, so a state
// can never be rendered through the other format's projection.
export function isHistoricalEpochOneState(state) {
  return Boolean(state)
    && typeof state === 'object'
    && !Object.hasOwn(state, 'format_version')
    && state.schema_version === '2.0.0'
    && Object.hasOwn(state, 'activation');
}

function compatibilityMarker(source) {
  return `<!-- GENERATED_COMPATIBILITY_VIEW: ${source} via ${RENDERER_ID}; NO INDEPENDENT AUTHORITY -->`;
}

function legacyTraceabilityMarker(source, sourceHash) {
  return [
    '<!-- GOVERNANCE_GENERATED_VIEW:BEGIN -->',
    '',
    'STATUS: ACTIVE_GENERATED_COMPATIBILITY_VIEW',
    `STRUCTURED_SOURCE: ${source}`,
    `RENDERER: ${RENDERER_ID}`,
    'SCHEMA_VERSION: 2.0.0',
    'AUTHORITY_EPOCH: 1',
    `CUTOVER_ID: ${CUTOVER_ID}`,
    `SOURCE_PAYLOAD_SHA256: ${sourceHash}`,
    '',
    '<!-- GOVERNANCE_GENERATED_VIEW:END -->',
    ''
  ];
}

function pointerText(pointer) {
  return `${pointer.path}::${pointer.anchor}`;
}

function bullets(object) {
  return Object.entries(object).map(([key, value]) => `- ${key}: \`${value}\``);
}

function historicalProjectView(state) {
  return [
    '# Current State',
    ...legacyTraceabilityMarker('docs/governance/current-state.json',
      state.activation.state_payload_sha256),
    'This compatibility view owns no facts. `docs/governance/current-state.json` is canonical.',
    '',
    '## Activation',
    '',
    `- Status: \`${state.activation.status}\``,
    `- Authority epoch: \`${state.authority_epoch}\``,
    `- Cutover ID: \`${state.cutover_id}\``,
    `- Active phase: \`${state.active_phase.status}\``,
    '',
    '## Accepted checkpoints',
    '',
    ...bullets(state.accepted_checkpoints),
    '',
    '## Next authorized action',
    '',
    `- \`${state.next_authorizable_action.canonical_value}\``,
    `- Mode: \`${state.next_authorizable_action.mode}\``,
    `- Status: \`${state.next_authorizable_action.status}\``,
    '',
    '## Governing pointers',
    '',
    ...bullets(state.governing_pointers),
    '',
    '## Blockers and debts',
    '',
    ...(state.live_debts.length ? state.live_debts.map(debt =>
      `- \`${debt.stable_id}\`: ${debt.status}; blocking=${debt.blocking}; owner=\`${debt.owner_path}\`.`)
      : ['- None recorded.']),
    '',
    '## Prohibitions',
    '',
    ...state.prohibitions.map(value => `- \`${value}\``),
    '',
    '## Authority matrix',
    '',
    ...state.root_authorities.map(item =>
      `- \`${item.path}\`: ${item.role}; generated=${item.generated_status}; authoritative=${item.remains_authoritative}.`),
    '',
    '## Bounded ledger references',
    '',
    ...state.bounded_recent_ledger_references.map(reference =>
      `- \`${reference.unit_id}\` / \`${reference.partition_id}\`: ${reference.reason}`),
    ''
  ].join('\n');
}

function historicalHandoffView(state) {
  return [
    '# Operational Handoff',
    ...legacyTraceabilityMarker('docs/governance/current-state.json',
      state.activation.state_payload_sha256),
    'This bounded compatibility view owns no facts. Use the structured source and its governing pointers.',
    '',
    `- Repository: \`${state.repository.identity}\``,
    `- Workspace: \`${state.repository.canonical_workspace}\``,
    `- Branch: \`${state.repository.branch}\``,
    `- Objective: \`${state.next_authorizable_action.canonical_value}\``,
    `- Unit 4D: \`${state.phase_status.unit4d}\``,
    `- Unit 5: \`${state.phase_status.unit5}\``,
    '',
    '## Governing pointers',
    '',
    ...bullets(state.governing_pointers),
    '',
    '## Bounded ledger evidence',
    '',
    ...state.bounded_recent_ledger_references.map(reference =>
      `- \`${reference.event_id ?? reference.unit_id}\` in \`${reference.partition_path}\`; ${reference.reason}`),
    ''
  ].join('\n');
}

function historicalDocumentationView(catalog) {
  const rows = catalog.artifacts.map(item =>
    `| ${item.artifact_id} | \`${item.path}\` | ${item.classification} | ${item.authority} | ${item.disposition} |`);
  return [
    '# Documentation Index',
    ...legacyTraceabilityMarker('docs/governance/catalog/documents.json',
      jsonSha256(catalogRenderProjection(catalog))),
    'This generated view owns no classifications. Normative governance semantics remain in `docs/governance/DOCUMENTATION_MODEL.md`.',
    '',
    '| ID | Path | Classification | Authority | Disposition |',
    '|---|---|---|---|---|',
    ...rows,
    ''
  ].join('\n');
}

function projectView() {
  return [
    '# Project State Compatibility Pointer',
    '',
    compatibilityMarker('docs/governance/current-state.json'),
    '',
    '`docs/governance/current-state.json` is the sole current operational state owner.',
    '`AGENT_HANDOFF.md` is the generated continuation view. Read neither this file nor any historical ledger as independent current-state authority.',
    ''
  ].join('\n');
}

function handoffView(state) {
  const pointers = [
    state.active_phase.contract,
    ...state.active_track.governing_pointers
  ];
  return [
    '# Agent Handoff',
    compatibilityMarker('docs/governance/current-state.json'),
    '',
    'This generated continuation view owns no rules, state, product semantics, or acceptance.',
    '',
    '## Routing',
    '',
    `- Repository: \`${state.repository.identity}\``,
    `- Workspace: \`${state.repository.canonical_workspace}\``,
    `- Branch: \`${state.repository.branch}\``,
    `- Publication boundary: \`${state.repository.publication.remote}/${state.repository.publication.branch}\`; ${state.repository.publication.mode}`,
    `- Accepted operational checkpoint: \`${state.accepted_operational_checkpoint}\``,
    '',
    '## Environment',
    '',
    `- Production: \`${state.environment_boundaries.production.project_id}\``,
    `- Retired: \`${state.environment_boundaries.retired_project.project_id}\``,
    `- Forbidden: \`${state.environment_boundaries.forbidden_project.project_id}\``,
    `- Non-production database: ${state.environment_boundaries.non_production_database}`,
    `- Deployment: ${state.deployment_boundaries.provider}; production branch \`${state.deployment_boundaries.production_branch}\`; repository ID \`${state.deployment_boundaries.git_repository_id}\`; ${state.deployment_boundaries.publication_path}`,
    '',
    '## Current objective',
    '',
    `- Status: \`${state.active_phase.status}\``,
    `- Objective: ${state.active_phase.immediate_objective}`,
    `- Next authorizable action: \`${state.next_authorizable_action.id}\` / \`${state.next_authorizable_action.mode}\``,
    '',
    '## Blockers and decisions',
    '',
    `- Blockers/debts: ${state.blockers_and_material_debts.map(item => `\`${item.id}\``).join(', ')}`,
    `- Open architect decisions: ${state.open_architect_decisions.join(' | ')}`,
    '',
    '## Prohibitions',
    '',
    `- ${state.prohibitions.join(' | ')}`,
    '',
    '## Task-specific pointers',
    '',
    ...pointers.map(pointer => `- \`${pointerText(pointer)}\``),
    ''
  ].join('\n');
}

function documentationView() {
  return [
    '# Documentation Inventory Pointer',
    '',
    compatibilityMarker('docs/governance/catalog/documents.json'),
    '',
    'This passive generated notice owns no current state, bootstrap rule, classification decision, supervision rule, authorization, or product semantics.',
    '',
    '- Active operational rules: `docs/governance/AGENT_INSTRUCTIONS.md`',
    '- Current operational continuity: `docs/governance/current-state.json`',
    '- Generated continuation view: `AGENT_HANDOFF.md`',
    '- Passive structured inventory: `docs/governance/catalog/documents.json`',
    '- Product and technical semantics: applicable authored specifications and contracts',
    '- Sequence and dependencies: applicable plans and backlogs',
    '- Historical evidence: applicable append-only ledgers and Git',
    '',
    'The complete governed corpus remains discoverable through repository search and the passive structured inventory; it is not a fixed-bootstrap input.',
    ''
  ].join('\n');
}

function traceabilityView(traceability) {
  const rows = traceability.requirements.map(item => {
    const sources = item.normative_sources.map(source => `\`${source.path}::${source.anchor}\``).join('; ');
    return `| ${item.requirement_id} | ${sources} | ${item.phase_owner} | ${item.disposition} | ${item.blocking_state} |`;
  });
  return [
    '# Purchase Order Phase-C Traceability',
    ...legacyTraceabilityMarker('docs/governance/traceability/purchase-order-phase-c.json',
      jsonSha256(traceabilityRenderProjection(traceability))),
    'This generated view owns no product or technical semantics.',
    '',
    '| Requirement | Normative pointers | Owner | Disposition | Blocking |',
    '|---|---|---|---|---|',
    ...rows,
    ''
  ].join('\n');
}

function selectionPaths(requestedPaths) {
  if (!Array.isArray(requestedPaths) && !(requestedPaths instanceof Set)) {
    throw new Error('canonical output selection must be an array or set');
  }
  const paths = [...requestedPaths];
  if (!paths.length) throw new Error('canonical output selection must not be empty');
  if (paths.some(value => typeof value !== 'string')) {
    throw new Error('canonical output selection contains a non-string path');
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error('canonical output selection contains a duplicate path');
  }
  const invalid = paths.filter(value => !CANONICAL_OUTPUT_ALLOWLIST.has(value));
  if (invalid.length) {
    throw new Error(`canonical output selection contains an unknown path: ${invalid.join(',')}`);
  }
  return paths;
}

function requiredSource(sources, key, relativePath) {
  const source = sources?.[key];
  if (!source || typeof source !== 'object') {
    throw new Error(`missing required ${key} source for ${relativePath}`);
  }
  return source;
}

function renderSelectedView(relativePath, sources) {
  const historical = isHistoricalEpochOneState(sources?.state);
  if (relativePath === CANONICAL_VIEW_PATHS.project) {
    return historical ? historicalProjectView(sources.state) : projectView();
  }
  if (relativePath === CANONICAL_VIEW_PATHS.handoff) {
    const state = requiredSource(sources, 'state', relativePath);
    return historical ? historicalHandoffView(state) : handoffView(state);
  }
  if (relativePath === CANONICAL_VIEW_PATHS.documentation) {
    return historical
      ? historicalDocumentationView(requiredSource(sources, 'catalog', relativePath))
      : documentationView();
  }
  return traceabilityView(requiredSource(sources, 'traceability', relativePath));
}

// Exactly one generated marker of exactly one contract per view. The two
// contracts are mutually exclusive, so a compact view can never carry the
// epoch-1 block and an epoch-1 view can never carry the compact marker.
function markerKind(relativePath, text) {
  const legacyBegins = (text.match(/GOVERNANCE_GENERATED_VIEW:BEGIN/gu) ?? []).length;
  const legacyEnds = (text.match(/GOVERNANCE_GENERATED_VIEW:END/gu) ?? []).length;
  const compact = (text.match(/<!-- GENERATED_COMPATIBILITY_VIEW:/gu) ?? []).length;
  const legacy = legacyBegins === 1 && legacyEnds === 1;
  if (legacy && compact === 0) return 'EPOCH_1';
  if (relativePath === CANONICAL_VIEW_PATHS.traceability) {
    throw new Error(`invalid historical traceability marker cardinality: ${relativePath}`);
  }
  if (compact === 1 && legacyBegins === 0 && legacyEnds === 0) return 'COMPACT';
  throw new Error(`invalid compact generated marker cardinality: ${relativePath}`);
}

function validateViewEntries(views) {
  for (const [relativePath, text] of Object.entries(views)) {
    if (typeof text !== 'string') {
      throw new Error(`rendered canonical output must be text: ${relativePath}`);
    }
    markerKind(relativePath, text);
    if (/CANDIDATE READINESS VIEW|commit_sha|tree_sha|TIMESTAMP:/iu.test(text)) {
      throw new Error(`forbidden generated content: ${relativePath}`);
    }
  }
  const handoff = views[CANONICAL_VIEW_PATHS.handoff];
  if (typeof handoff === 'string'
      && markerKind(CANONICAL_VIEW_PATHS.handoff, handoff) === 'COMPACT'
      && /SHA256|hash chain|ledger history/iu.test(handoff)) {
    throw new Error('compact handoff contains historical hash or ledger machinery');
  }
}

function assertRenderedPathMatch(views, requestedPaths) {
  if (!views || typeof views !== 'object' || Array.isArray(views)) {
    throw new Error('rendered canonical outputs must be an object');
  }
  const renderedPaths = Object.keys(views);
  if (renderedPaths.length !== requestedPaths.length
      || renderedPaths.some(value => !requestedPaths.includes(value))
      || requestedPaths.some(value => !Object.hasOwn(views, value))) {
    throw new Error('rendered canonical outputs do not match the requested paths');
  }
}

function writeValidatedViews(root, views) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'unit4c-roots-'));
  try {
    for (const [relativePath, text] of Object.entries(views)) {
      const output = path.join(temporary, relativePath);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, text.replace(/\r\n?/gu, '\n'), 'utf8');
    }
    for (const relativePath of Object.keys(views)) {
      const source = path.join(temporary, relativePath);
      const target = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  return Object.fromEntries(Object.keys(views).map(relativePath =>
    [relativePath, sha256(fs.readFileSync(path.join(root, relativePath)))]));
}

export function assertSelectiveOutputPaths(requestedPaths) {
  return selectionPaths(requestedPaths);
}

export function assertCanonicalOutputPaths(requestedPaths) {
  const paths = selectionPaths(requestedPaths);
  if (paths.length !== ALL_CANONICAL_VIEW_PATHS.length) {
    throw new Error('canonical root transaction violation: partial set');
  }
  return paths;
}

export function renderSelectedCanonicalViews(sources, requestedPaths) {
  const paths = assertSelectiveOutputPaths(requestedPaths);
  return Object.fromEntries(paths.map(relativePath =>
    [relativePath, renderSelectedView(relativePath, sources)]));
}

export function renderCanonicalViews(state, catalog, traceability) {
  assertCanonicalOutputPaths(ALL_CANONICAL_VIEW_PATHS);
  return renderSelectedCanonicalViews({ state, catalog, traceability }, ALL_CANONICAL_VIEW_PATHS);
}

export function validateSelectedRenderedViews(views, requestedPaths) {
  const paths = assertSelectiveOutputPaths(requestedPaths);
  assertRenderedPathMatch(views, paths);
  validateViewEntries(views);
}

export function validateRenderedViews(views) {
  const paths = assertCanonicalOutputPaths(Object.keys(views));
  assertRenderedPathMatch(views, paths);
  validateViewEntries(views);
}

export function writeSelectedCanonicalViews(root, views, requestedPaths) {
  validateSelectedRenderedViews(views, requestedPaths);
  return writeValidatedViews(root, views);
}

export function writeCanonicalViews(root, views) {
  validateRenderedViews(views);
  return writeValidatedViews(root, views);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  console.error('Import this module and write only the explicitly authorized generated paths.');
  process.exitCode = 1;
}
