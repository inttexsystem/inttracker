import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { worktreeReader } from '../scripts/governance/git-content-reader.mjs';
import {
  CORRECTED_PATHS,
  validateReader,
  validateRepository
} from '../scripts/governance/validate-canonical-authority-consumers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = worktreeReader(ROOT);

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

function append(relativePath, text) {
  return overlay({ [relativePath]: `${base.readText(relativePath)}\n## CURRENT FIXTURE\n\n${text}\n` });
}

function hasError(result, value) {
  return result.errors.some(error => error.includes(value));
}

test('current repository has the complete active normative inventory and zero contradictions', () => {
  const result = validateReader(base);
  assert.deepEqual(result.errors, []);
  assert.equal(result.active_normative_artifacts, 26);
  assert.equal(result.active_contradictions, 0);
  assert.equal(result.unresolved, 0);
  assert.deepEqual(result.contradiction_paths, []);
});

test('all nine corrected authored consumers remain present', () => {
  assert.equal(CORRECTED_PATHS.length, 9);
  for (const relativePath of CORRECTED_PATHS) assert.equal(base.exists(relativePath), true, relativePath);
});

test('asset map points classification and live state to structured owners', () => {
  const text = base.readText('docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md');
  assert.match(text, /classification and canonical paths.*docs\/governance\/catalog\/documents\.json/isu);
  assert.match(text, /Current operational state.*docs\/governance\/current-state\.json/isu);
  assert.match(text, /optional generated compatibility views with no independent authority/iu);
});

test('master plan retains architecture and backlog authority only', () => {
  const text = base.readText('docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md');
  assert.match(text, /this plan owns G28 architecture, sequence, backlog, and hard stops/iu);
  assert.match(text, /current-state\.json.*owns current operational state/iu);
  assert.match(text, /never edit them as independent owners/iu);
});

test('production backlog delegates live state and handoff compatibility', () => {
  const text = base.readText('docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md');
  assert.match(text, /current-state\.json` — \*\*Sole owner of live current operational state/iu);
  assert.match(text, /AGENT_HANDOFF\.md.*generated compatibility view.*no independent/iu);
  assert.match(text, /production-flow sequence\/backlog authority/iu);
});

test('Camada 3 contract delegates current state without changing backup authority', () => {
  const text = base.readText('docs/architecture/CAMADA3_BACKUP_CONTRACT.md');
  assert.match(text, /Operational state is owned by.*current-state\.json/isu);
  assert.match(text, /AGENT_HANDOFF\.md.*no independent authority/isu);
  assert.match(text, /binding premises for.*G28-CAMADA-3/isu);
});

test('purchase-order specification delegates classification to the structured catalog', () => {
  const text = base.readText('docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md');
  assert.match(text, /Classification is.*owned by `docs\/governance\/catalog\/documents\.json`/isu);
  assert.match(text, /DOCUMENTATION_INDEX\.md` is its generated compatibility view/iu);
});

test('Pedido OP plan uses structured state and canonical regeneration', () => {
  const text = base.readText('docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md');
  assert.match(text, /owned solely by `docs\/governance\/current-state\.json`/iu);
  assert.match(text, /Regenerate `PROJECT_STATE\.md` and `AGENT_HANDOFF\.md`.*canonical tooling/isu);
});

test('release plan references canonical and generated state correctly', () => {
  const text = base.readText('docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md');
  assert.match(text, /current-state\.json` — canonical current operational state/iu);
  assert.match(text, /PROJECT_STATE\.md` — generated compatibility view/iu);
  assert.match(text, /AGENT_HANDOFF\.md` — generated compatibility handoff/iu);
});

test('approved mockup delegates operational state without changing visual content', () => {
  const text = base.readText('docs/design/CAMADA2_A32_MOCKUP_APPROVED.md');
  assert.match(text, /operational state is owned by.*current-state\.json/isu);
  assert.match(text, /PROJECT_STATE\.md` is a generated.*compatibility view/isu);
});

test('historical Camada 2 spec applies the architect ACTIVE_CONTRADICTION ruling', () => {
  const text = base.readText('docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md');
  assert.match(text, /This document owns no current operational state/iu);
  assert.match(text, /PROJECT_STATE\.md` and.*AGENT_HANDOFF\.md` are generated compatibility views only/isu);
  assert.match(text, /HISTORICAL CHECKPOINT — Refactor governance/iu);
});

test('shadow renderer and outputs use structured owners and own no facts', () => {
  const index = base.readText('docs/governance/shadow/generated/DOCUMENTATION_INDEX.md');
  const trace = base.readText('docs/governance/shadow/generated/ORDEM_COMPRA_C3_TRACEABILITY.md');
  assert.match(index, /Canonical structured owner: `docs\/governance\/catalog\/documents\.json`/u);
  assert.match(index, /Generated compatibility view: `docs\/DOCUMENTATION_INDEX\.md`/u);
  assert.match(trace, /Canonical structured owner: `docs\/governance\/traceability\/purchase-order-phase-c\.json`/u);
  assert.match(trace, /Generated compatibility view: `docs\/architecture\/ORDEM_COMPRA_C3_TRACEABILITY\.md`/u);
  assert.match(`${index}\n${trace}`, /owns no independent facts/iu);
});

test('validator execution causes zero Git mutation', () => {
  const result = validateRepository({ root: ROOT });
  assert.deepEqual(result.errors, []);
  assert.equal(result.git_unchanged, true);
});

test('root current-state ownership is rejected', () => {
  const result = validateReader(append('docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md',
    '`PROJECT_STATE.md` is the sole owner of live current state.'));
  assert.equal(result.active_contradictions, 1);
});

test('independent root handoff ownership is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    '`AGENT_HANDOFF.md` owns operational continuity.'));
  assert.equal(result.active_contradictions, 1);
});

test('generated Documentation Index classification authority is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    '`docs/DOCUMENTATION_INDEX.md` is the canonical classification authority.'));
  assert.equal(result.active_contradictions, 1);
});

test('generated traceability-root authority is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    '`docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md` is the canonical traceability owner.'));
  assert.equal(result.active_contradictions, 1);
});

test('mandatory generated-root bootstrap is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    'Every bootstrap must read `PROJECT_STATE.md` as authority.'));
  assert.equal(result.active_contradictions, 1);
});

test('present-tense authority in a retained historical document is rejected', () => {
  const result = validateReader(append('docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md',
    '`PROJECT_STATE.md` owns current operational state.'));
  assert.equal(result.active_contradictions, 1);
});

test('incomplete active normative inventory is rejected', () => {
  const catalog = JSON.parse(base.readText('docs/governance/catalog/documents.json'));
  const index = catalog.artifacts.findIndex(item =>
    item.status === 'ACTIVE' && (item.authority === 'NORMATIVE' || item.role === 'normative'));
  catalog.artifacts.splice(index, 1);
  const result = validateReader(overlay({
    'docs/governance/catalog/documents.json': `${JSON.stringify(catalog, null, 2)}\n`
  }));
  assert.equal(hasError(result, 'active normative inventory incomplete'), true);
});

test('an unmanifested tenth contradiction is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    '`PROJECT_STATE.md` is the canonical owner of current phase and next action.'));
  assert.deepEqual(result.contradiction_paths, ['docs/architecture/CODE_HEALTH_RULES.md']);
});

test('an unresolved semantic assignment is rejected', () => {
  const result = validateReader(append('docs/architecture/CODE_HEALTH_RULES.md',
    '`PROJECT_STATE.md` maybe owns current state; unresolved authority.'));
  assert.equal(result.unresolved, 1);
  assert.equal(hasError(result, 'unresolved semantic matches'), true);
});

test('shadow renderer naming generated roots as owners is rejected', () => {
  const renderer = base.readText('scripts/governance/render-documentation-shadow.mjs')
    .replace('Canonical structured owner: `docs/governance/catalog/documents.json`.',
      'Canonical owner: `docs/DOCUMENTATION_INDEX.md`.');
  const result = validateReader(overlay({
    'scripts/governance/render-documentation-shadow.mjs': renderer
  }));
  assert.equal(hasError(result, 'shadow renderer catalog owner mismatch'), true);
});

test('shadow output drift is rejected', () => {
  const result = validateReader(overlay({
    'docs/governance/shadow/generated/DOCUMENTATION_INDEX.md':
      `${base.readText('docs/governance/shadow/generated/DOCUMENTATION_INDEX.md')}\nDRIFT\n`
  }));
  assert.equal(hasError(result, 'Documentation Index shadow output drift'), true);
});

test('all nine corrected paths remain inside the cataloged active normative universe', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/governance/catalog/documents.json'), 'utf8'));
  const active = new Set(catalog.artifacts.filter(item =>
    item.status === 'ACTIVE' && (item.authority === 'NORMATIVE' || item.role === 'normative'))
    .map(item => item.path));
  for (const relativePath of CORRECTED_PATHS) assert.equal(active.has(relativePath), true, relativePath);
});
