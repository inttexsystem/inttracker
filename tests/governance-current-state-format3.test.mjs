// Focused contract for the LIVE canonical compact current state.
//
// This suite validates docs/governance/current-state.json as itself: format
// 3.0.0, validated by the live schema and by the operational facts it owns. It
// deliberately never reaches for the retired Unit-4 candidate, activation,
// bootstrap or self-hash machinery — those belong to the historical suites,
// which read their artifacts from their own accepted Git checkpoints.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { worktreeReader } from '../scripts/governance/git-content-reader.mjs';
import {
  ACCEPTED_OPERATIONAL_CHECKPOINT,
  CLOSED_DEBT_IDENTITIES,
  ENVIRONMENT_IDENTITIES,
  RETIRED_STATE_FIELDS,
  STATE_SCHEMA,
  validateGeneratedCompatibilityViews,
  validateLiveCompactState
} from '../scripts/governance/validate-canonical-authority-consumers.mjs';
import { renderCanonicalViews } from '../scripts/governance/render-unit4-canonical-views.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = 'docs/governance/current-state.json';
const HANDOFF = 'AGENT_HANDOFF.md';
const PROJECT = 'PROJECT_STATE.md';
const base = worktreeReader(ROOT);
const state = JSON.parse(base.readText(STATE));
const clone = value => structuredClone(value);

function overlay(overrides = {}) {
  return {
    mode: 'fixture',
    listFiles: () => base.listFiles(),
    exists: relativePath => Object.hasOwn(overrides, relativePath) || base.exists(relativePath),
    readText: relativePath => Object.hasOwn(overrides, relativePath)
      ? overrides[relativePath]
      : base.readText(relativePath),
    objectId: relativePath => base.objectId(relativePath)
  };
}

function stateOverlay(mutate) {
  const value = clone(state);
  mutate(value);
  return overlay({ [STATE]: `${JSON.stringify(value, null, 2)}\n` });
}

function liveErrors(reader = base) {
  const errors = [];
  const parsed = validateLiveCompactState(reader, errors);
  validateGeneratedCompatibilityViews(reader, parsed, errors);
  return errors;
}

function rejects(mutate, fragment) {
  const errors = liveErrors(stateOverlay(mutate));
  assert.ok(errors.some(error => error.includes(fragment)),
    `expected rejection containing "${fragment}"; got:\n${errors.join('\n') || '<none>'}`);
}

test('live current state is format 3.0.0 and carries the compact identity', () => {
  assert.equal(state.format_version, '3.0.0');
  assert.equal(state.state_id, 'GOVERNANCE-COMPACT-CURRENT-STATE-R1');
  assert.equal(state.repository.identity, 'inttexsystem/inttracker');
  assert.equal(state.repository.branch, 'dev');
  assert.equal(state.repository.publication.tracking_ref, 'refs/remotes/staging/dev');
});

test('the canonical live schema describes format 3.0.0 and nothing else', () => {
  const schema = JSON.parse(base.readText(STATE_SCHEMA));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.format_version.const, '3.0.0');
  assert.equal(schema.additionalProperties, false);
  // The retired shadow 1.0.0 contract must not remain at the live schema path.
  assert.equal(Object.hasOwn(schema.properties, 'mode'), false);
  assert.equal(Object.hasOwn(schema.properties, 'live_debts'), false);
  assert.equal(Object.hasOwn(schema.properties, 'accepted_checkpoints'), true);
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/governance/schemas/current-state-shadow-v1.schema.json')));
});

test('the historical shadow schema still owns the shadow 1.0.0 contract', () => {
  const shadow = JSON.parse(base.readText('docs/governance/schemas/current-state-shadow-v1.schema.json'));
  assert.equal(shadow.properties.schema_version.const, '1.0.0');
  assert.equal(shadow.properties.mode.const, 'shadow');
  assert.equal(shadow.properties.environment_boundaries.properties.production.const,
    'gqmpsxkxynrjvidfmojk');
});

test('live current state carries no retired Unit-4 field', () => {
  for (const field of RETIRED_STATE_FIELDS) {
    assert.equal(Object.hasOwn(state, field), false, field);
  }
});

test('live current state validates clean, including generated-view parity', () => {
  assert.deepEqual(liveErrors(), []);
});

test('accepted operational checkpoint is the entry checkpoint and is in the chain', () => {
  assert.equal(state.accepted_operational_checkpoint, ACCEPTED_OPERATIONAL_CHECKPOINT);
  assert.ok(state.accepted_checkpoints.some(item =>
    item.checkpoint_commit === ACCEPTED_OPERATIONAL_CHECKPOINT));
  for (const item of state.accepted_checkpoints) {
    assert.match(item.status, /^CLOSED \/ ACCEPTED/u, item.id);
    assert.match(item.checkpoint_commit, /^[0-9a-f]{40}$/u, item.id);
    assert.equal(execFileSync('git', ['cat-file', '-t', item.checkpoint_commit],
      { cwd: ROOT, encoding: 'utf8' }).trim(), 'commit', item.id);
  }
});

test('brand and cutover phases are recorded as accepted, not as pending', () => {
  const byId = new Map(state.accepted_checkpoints.map(item => [item.id, item]));
  for (const id of ['INTTEX-BRAND-ASSET-INTEGRATION-R1', 'INTTRACKER-PRODUCTION-CUTOVER-R1']) {
    assert.equal(byId.get(id)?.status, 'CLOSED / ACCEPTED', id);
  }
});

test('the retired-project consumer corrections are accepted, not still open decisions', () => {
  const byId = new Map(state.accepted_checkpoints.map(item => [item.id, item]));
  for (const id of ['ACTIVE-SUPABASE-CONSUMER-SAFETY', 'STAGING-AND-BACKUP-ENVIRONMENT-SAFETY']) {
    assert.equal(byId.get(id)?.status, 'CLOSED / ACCEPTED', id);
  }
  // Those two checkpoints reconciled the documents-ingestor watcher, the writer
  // runbook, the clean-slate export tooling, the staging mutation runners and
  // the backup tooling onto the accepted identity model. No open decision may
  // still present any of them as an unreconciled consumer of the retired
  // project — that claim contradicts the accepted checkpoints above.
  const stale = /documents-ingestor watcher|writer runbook|clean-slate export|remaining consumers|still name it/iu;
  for (const decision of state.open_architect_decisions) {
    assert.equal(stale.test(decision), false, decision);
  }
  // The physical deletion of the retired project stays open, and stays the only
  // subject of that decision.
  const deletion = state.open_architect_decisions.filter(decision =>
    decision.includes(ENVIRONMENT_IDENTITIES.retired_project));
  assert.equal(deletion.length, 1);
  assert.match(deletion[0], /physically deleted/u);
  assert.match(deletion[0], /separately authorized order/u);
});

// O sujeito deste guard e a COERENCIA entre a fase ativa e a proxima acao
// autorizavel — nunca um literal de fase especifico. O guard cobre os dois
// estados estruturais possiveis: `NONE` representa nenhuma fase de produto
// ativa e exige direcao de produto (a proxima acao deve ser
// SELECT NEXT PRODUCT PHASE, apontando para o AGENT_INSTRUCTIONS.md neutro);
// uma fase ativa real exige revisao do supervisor e deve ser nomeada pela
// proxima acao autorizavel. Futuras transicoes de fase nao devem mais exigir
// reancorar um literal de identidade de fase neste teste.
test('the active state declares a coherent phase and next authorizable action', () => {
  assert.ok(state.active_phase.immediate_objective.length > 0);

  if (state.active_phase.id === 'NONE') {
    assert.equal(state.active_phase.status, 'NO ACTIVE PRODUCT PHASE');
    assert.equal(
      state.active_phase.contract.path,
      'docs/governance/AGENT_INSTRUCTIONS.md'
    );
    assert.equal(
      state.active_phase.contract.anchor,
      '## 4. Authorization and roles'
    );
    assert.equal(
      state.next_authorizable_action.id,
      'SELECT NEXT PRODUCT PHASE'
    );
    assert.equal(
      state.next_authorizable_action.mode,
      'AWAITING PRODUCT DIRECTION; NO PHASE IS CHAINED'
    );
    assert.match(
      state.next_authorizable_action.status,
      /No subsequent product implementation is authorized/u
    );
    return;
  }

  assert.match(
    state.active_phase.status,
    /AWAITING SUPERVISOR REVIEW/u
  );
  assert.ok(
    state.next_authorizable_action.id.includes(state.active_phase.id),
    'the next authorizable action must name the active phase'
  );
  // O modo declara que a fase esta PARADA num portao de revisao humana, nao
  // uma redacao unica. `SUPERVISOR` e `ARCHITECTURAL` nomeiam o mesmo portao —
  // o arquiteto — e ambos satisfazem o sujeito do guard. Continua proibido um
  // modo que nao declare portao de revisao nenhum.
  assert.match(
    state.next_authorizable_action.mode,
    /AWAITING (SUPERVISOR|ARCHITECTURAL) REVIEW/u
  );
});

test('environment identities and the absent non-production database are exact', () => {
  assert.equal(state.environment_boundaries.production.project_id, ENVIRONMENT_IDENTITIES.production);
  assert.equal(state.environment_boundaries.retired_project.project_id, ENVIRONMENT_IDENTITIES.retired_project);
  assert.equal(state.environment_boundaries.forbidden_project.project_id, ENVIRONMENT_IDENTITIES.forbidden_project);
  assert.match(state.environment_boundaries.non_production_database, /^NONE\b/u);
  assert.equal(state.deployment_boundaries.git_repository_id, '1276430187');
  assert.equal(state.deployment_boundaries.production_branch, 'dev');
});

test('no current canonical or generated operational view names the retired project as production', () => {
  const retired = ENVIRONMENT_IDENTITIES.retired_project;
  // Structural check on the canonical state: the retired identity is owned by
  // environment_boundaries.retired_project, and every other string value that
  // mentions it must also say it is retired.
  assert.equal(state.environment_boundaries.retired_project.project_id, retired);
  assert.equal(state.environment_boundaries.production.project_id === retired, false);
  const walk = (node, at) => {
    if (typeof node === 'string') {
      if (node.includes(retired) && at !== '$.environment_boundaries.retired_project.project_id') {
        assert.match(node, /retired/iu, at);
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${at}[${index}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [key, item] of Object.entries(node)) walk(item, `${at}.${key}`);
    }
  };
  walk(state, '$');
  // Line check on the generated Markdown views.
  for (const relativePath of [PROJECT, HANDOFF, 'docs/DOCUMENTATION_INDEX.md']) {
    for (const line of base.readText(relativePath).split('\n')) {
      if (!line.includes(retired)) continue;
      assert.match(line, /retired/iu, `${relativePath}: ${line.slice(0, 120)}`);
    }
  }
});

test('the active debt population contains open debts only', () => {
  const ids = state.blockers_and_material_debts.map(item => item.id);
  for (const closed of CLOSED_DEBT_IDENTITIES) assert.equal(ids.includes(closed), false, closed);
  for (const debt of state.blockers_and_material_debts) {
    assert.match(debt.status, /^(OPEN|ACTIVE_)/u, debt.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('PROJECT_STATE.md stays a compatibility pointer and AGENT_HANDOFF.md is current', () => {
  const project = base.readText(PROJECT);
  assert.match(project, /is the sole current operational state owner\./u);
  assert.equal(project.includes('SPEC_CUSTODY_BOOTSTRAP:BEGIN'), false);
  const handoff = base.readText(HANDOFF);
  assert.ok(handoff.includes(ACCEPTED_OPERATIONAL_CHECKPOINT));
  assert.ok(handoff.includes(ENVIRONMENT_IDENTITIES.production));
  assert.equal(handoff.includes('AWAITING ARCHITECT ACCEPTANCE'), false);
  assert.equal(handoff.includes('AWAITING DIRECT SUPERVISOR REVIEW'), false);
});

test('the canonical renderer is deterministic and owns the four generated views', () => {
  const catalog = JSON.parse(base.readText('docs/governance/catalog/documents.json'));
  const traceability = JSON.parse(base.readText('docs/governance/traceability/purchase-order-phase-c.json'));
  const first = renderCanonicalViews(state, catalog, traceability);
  assert.deepEqual(first, renderCanonicalViews(state, catalog, traceability));
  for (const [relativePath, text] of Object.entries(first)) {
    assert.equal(base.readText(relativePath).replace(/\r\n?/gu, '\n'), text, relativePath);
  }
});

test('unknown top-level field is rejected', () => {
  rejects(value => { value.unknown_top_level = true; }, 'unknown property unknown_top_level');
});

test('malformed nested owner is rejected', () => {
  rejects(value => { value.repository.publication = 'staging/dev'; }, 'repository.publication');
});

test('wrong repository identity is rejected', () => {
  rejects(value => { value.repository.identity = 'grupoterrabranca/controle-tapetes'; }, 'const mismatch');
});

test('wrong branch is rejected', () => {
  rejects(value => { value.repository.branch = 'main'; }, 'repository.branch');
});

test('wrong publication ref is rejected', () => {
  rejects(value => { value.repository.publication.tracking_ref = 'refs/remotes/origin/dev'; },
    'publication.tracking_ref');
});

test('wrong production, retired or forbidden project is rejected', () => {
  rejects(value => { value.environment_boundaries.production.project_id = 'gqmpsxkxynrjvidfmojk'; },
    'environment identity mismatch: production');
  rejects(value => { value.environment_boundaries.retired_project.project_id = 'ucrjtfswnfdlxwtmxnoo'; },
    'environment identity mismatch: retired_project');
  rejects(value => { value.environment_boundaries.forbidden_project.project_id = 'ucrjtfswnfdlxwtmxnoo'; },
    'environment identity mismatch: forbidden_project');
});

test('a declared non-production database is rejected', () => {
  rejects(value => { value.environment_boundaries.non_production_database = 'gqmpsxkxynrjvidfmojk'; },
    'declares a non-production database');
});

test('duplicate protected-residue path is rejected', () => {
  rejects(value => { value.protected_residue.push(clone(value.protected_residue[0])); },
    'duplicate protected-residue path');
});

test('a closed debt reintroduced into the active list is rejected', () => {
  rejects(value => {
    value.blockers_and_material_debts.push({
      id: 'GOVERNANCE-COMPACT-STATE-VALIDATOR-SCHEMA-MISMATCH',
      status: 'OPEN',
      blocking: false
    });
  }, 'closed debt reintroduced into the active list');
});

test('stale awaiting-acceptance language is rejected', () => {
  rejects(value => {
    value.active_phase.status = 'INTTRACKER-PRODUCTION-CUTOVER IMPLEMENTED / AWAITING ARCHITECT ACCEPTANCE';
  }, 'stale acceptance language');
});

test('a wrong accepted operational checkpoint is rejected', () => {
  rejects(value => { value.accepted_operational_checkpoint = '0'.repeat(40); },
    'accepted operational checkpoint mismatch');
});

test('an invalid governing pointer is rejected', () => {
  rejects(value => { value.active_track.governing_pointers[0].path = 'docs/missing.md'; },
    'invalid governing pointer');
  rejects(value => { value.active_track.governing_pointers[0].anchor = '## no such heading'; },
    'invalid governing pointer');
});

test('a retired Unit-4 field reintroduced into the live state is rejected', () => {
  rejects(value => { value.activation = { status: 'active' }; },
    'retired Unit-4 field in live current-state: activation');
});

test('generated compatibility view drift is rejected', () => {
  const errors = liveErrors(overlay({ [HANDOFF]: `${base.readText(HANDOFF)}\nDRIFT\n` }));
  assert.ok(errors.some(error => error.includes(`generated compatibility view drift: ${HANDOFF}`)));
});

test('live validation performs no repository mutation', () => {
  // ls-files --stage rather than write-tree: it snapshots the index without
  // taking .git/index.lock, so this proof cannot collide with a concurrent one.
  const snapshot = () => execFileSync('git',
    ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' })
    + execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
    + execFileSync('git', ['ls-files', '--stage'], { cwd: ROOT, encoding: 'utf8' });
  const before = snapshot();
  assert.deepEqual(liveErrors(), []);
  assert.equal(snapshot(), before);
});
