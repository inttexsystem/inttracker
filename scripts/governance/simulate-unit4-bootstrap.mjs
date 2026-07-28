import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { commitReader, worktreeReader } from './git-content-reader.mjs';
import { readBoundedLedgerEvents } from './read-bounded-ledger-events.mjs';
import { validateSchema } from './validate-documentation-shadow.mjs';
import { HISTORICAL_CHECKPOINT, validateCanonicalConsistencyObjects } from './validate-unit4-cutover.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const ROUTING_PATHS = [
  'docs/governance/current-state.json',
  'docs/governance/schemas/current-state-v2.schema.json',
  'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_PHASE_CONTRACT.md',
  'docs/governance/GOVERNANCE_EFFICIENCY_REFOUNDATION_UNIT_4_AUTHORITY_CUTOVER_CONTRACT.md',
  'docs/governance/ledger/g28-ledger-partition-index.json',
  'docs/governance/cutover/unit4c-cutover-manifest.json',
  'docs/governance/catalog/documents.json'
];
export const PROHIBITED_BOOTSTRAP_READS = new Set([
  'PROJECT_STATE.md',
  'AGENT_HANDOFF.md',
  'docs/ledgers/G28_LEDGER.md',
  'docs/governance/shadow/generated/G28_LEDGER.md'
]);

function parseJson(reader, relativePath) {
  return JSON.parse(reader.readText(relativePath));
}

export function instrumentReader(reader, allowedPaths) {
  const reads = [];
  return {
    mode: reader.mode,
    listFiles: () => reader.listFiles(),
    exists: relativePath => reader.exists(relativePath),
    objectId: relativePath => reader.objectId(relativePath),
    readText(relativePath) {
      reads.push(relativePath);
      if (PROHIBITED_BOOTSTRAP_READS.has(relativePath)) {
        throw new Error(`forbidden bootstrap read: ${relativePath}`);
      }
      if (!allowedPaths.has(relativePath)) {
        throw new Error(`bootstrap read outside allowlist: ${relativePath}`);
      }
      return reader.readText(relativePath);
    },
    reads
  };
}

export function simulateWithReader(baseReader) {
  const allowed = new Set(ROUTING_PATHS);
  const reader = instrumentReader(baseReader, allowed);
  const state = parseJson(reader, ROUTING_PATHS[0]);
  // This simulation reproduces the Unit-4 bootstrap only. A compact
  // format_version state is a different contract entirely and must fail closed
  // instead of being coerced into a candidate or canonical epoch-1 reading.
  if (Object.hasOwn(state, 'format_version')) {
    throw new Error(`compact current-state format is not a Unit 4 bootstrap state: ${state.format_version}`);
  }
  const canonical = state.mode === 'canonical';
  if (canonical && (state.authority !== 'canonical_current_state'
      || state.authority_epoch !== 1 || state.activation.status !== 'active')) {
    throw new Error('canonical structured activation is invalid');
  }
  if (!canonical && (state.mode !== 'cutover_candidate'
      || state.authority !== 'non_canonical_until_supervisor_activation'
      || state.authority_epoch !== 0 || state.activation.status !== 'inactive')) {
    throw new Error('candidate readiness lifecycle is invalid');
  }
  for (const reference of state.bounded_recent_ledger_references) {
    allowed.add(reference.partition_path);
  }
  for (const relativePath of Object.keys(state.activation.structured_source_hashes)) {
    allowed.add(relativePath);
  }
  const schema = parseJson(reader, ROUTING_PATHS[1]);
  const schemaErrors = validateSchema(state, schema, 'current-state-v2');
  if (schemaErrors.length) throw new Error(schemaErrors.join('\n'));
  for (const [relativePath, expected] of Object.entries(state.activation.structured_source_hashes)) {
    const actual = crypto.createHash('sha256').update(reader.readText(relativePath), 'utf8').digest('hex');
    if (actual !== expected) throw new Error(`structured source hash drift: ${relativePath}`);
  }
  const phaseContract = reader.readText(ROUTING_PATHS[2]);
  const unit4Contract = reader.readText(ROUTING_PATHS[3]);
  if (!phaseContract.includes('PHASE_ID: GOVERNANCE-EFFICIENCY-REFOUNDATION')) {
    throw new Error('active phase contract identity missing');
  }
  if (!unit4Contract.includes('## 8. Read-only consumer reconciliation')) {
    if (!unit4Contract.includes('## 8. HISTORICAL PRE-CUTOVER STATE — Read-only consumer reconciliation')) {
      throw new Error('accepted Unit 4 contract identity missing');
    }
  }
  // The Unit-4C cutover manifest is an epoch-1 artifact. A Unit-4A candidate
  // checkpoint predates it, so requiring it there would only be satisfiable by
  // reading a later epoch's file — the cross-epoch mixture this simulation is
  // meant to rule out.
  const cutover = canonical ? parseJson(reader, ROUTING_PATHS[5]) : null;
  const catalog = parseJson(reader, ROUTING_PATHS[6]);
  if (canonical) {
    const consistencyErrors = validateCanonicalConsistencyObjects({
      state, cutover, unit4Contract, phaseContract, catalog
    });
    if (consistencyErrors.length) throw new Error(consistencyErrors.join('\n'));
  }
  const ledger = readBoundedLedgerEvents(reader, state.bounded_recent_ledger_references);
  const debtOwners = state.live_debts.map(item => item.owner_path);
  const invalidDebtOwners = debtOwners.filter(owner => owner !== 'docs/governance/current-state.json');
  const contractIdentity = unit4Contract.match(/^CONTRACT_ID:\s*(\S+)\s*$/mu)?.[1] ?? null;
  const facts = {
    schema_version: state.schema_version,
    authority: state.authority,
    active_phase: state.active_phase.id,
    active_phase_status: state.active_phase.status,
    next_authorizable_action: state.next_authorizable_action.canonical_value,
    unit4_contract_checkpoint: state.accepted_checkpoints.unit_4_contract,
    unit4a_status: state.phase_status.unit4a,
    unit4b_status: state.phase_status.unit4b,
    unit4c_status: state.phase_status.unit4c,
    unit4d_status: state.phase_status.unit4d,
    current_debt_count: state.live_debts.length,
    debt_owner_paths: [...new Set(debtOwners)].sort(),
    invalid_owner_count: invalidDebtOwners.length,
    historical_fact_sources: (state.historical_fact_sources ?? []).map(item => item.source_path),
    raw_legacy_prose_present: Object.hasOwn(state, 'current_fact_sections'),
    contract_identity: contractIdentity,
    manifest_contract_identity: cutover?.contract_id ?? null,
    contract_identity_parity: cutover ? contractIdentity === cutover.contract_id : null,
    unit4_contract_status: unit4Contract.match(/^STATUS:\s*(.+)$/mu)?.[1] ?? null,
    phase_contract_status: phaseContract.match(/^STATUS:\s*(.+)$/mu)?.[1] ?? null,
    second_activation: cutover?.second_activation ?? null,
    root_authorities: state.root_authorities.map(item => item.path),
    ledger_events: ledger.events.map(item => item.reference.unit_id)
  };
  return {
    result: 'PASS',
    facts,
    read_allowlist: [...allowed].sort(),
    reads_performed: reader.reads,
    prohibited_reads: reader.reads.filter(value => PROHIBITED_BOOTSTRAP_READS.has(value)),
    full_ledger_read: ledger.full_ledger_read,
    private_memory_used: false
  };
}

export function simulateRepository(root = REPO_ROOT, commit = HISTORICAL_CHECKPOINT) {
  return simulateWithReader(commit ? commitReader(root, commit) : worktreeReader(root));
}

function main() {
  const rootIndex = process.argv.indexOf('--root');
  const commitIndex = process.argv.indexOf('--commit');
  const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());
  const commit = commitIndex >= 0 ? process.argv[commitIndex + 1] : HISTORICAL_CHECKPOINT;
  try {
    if (commitIndex >= 0 && !commit) throw new Error('--commit requires a SHA');
    const result = simulateRepository(root, commit);
    console.log(`UNIT4C_BOOTSTRAP_RESULT: ${JSON.stringify(result)}`);
    console.log('UNIT4C_BOOTSTRAP_SIMULATION: PASS');
  } catch (error) {
    console.error(error.message);
    console.error('UNIT4C_BOOTSTRAP_SIMULATION: FAIL');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
