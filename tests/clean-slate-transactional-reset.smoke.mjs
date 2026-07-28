// tests/clean-slate-transactional-reset.smoke.mjs
//
// Clean-Slate Transactional Reset — smoke test + disposable restore/reset drill.
// Governed by docs/architecture/CLEAN_SLATE_TRANSACTIONAL_RESET_PHASE_CONTRACT.md
// (§8.3) and the CLEAN-SLATE-TRANSACTIONAL-RESET-TOOLING-AND-DRILL-R2 order (§12
// smoke requirements, §13 disposable drill).
//
// This single cohesive harness exceeds the 500-line soft cap by design (it is one
// end-to-end lifecycle proof: fixture-based verifier/export smoke + a real
// disposable-PostgreSQL restore/reset drill). Two layers:
//   1. FIXTURE SUITE (always, no database): archive manifest validation, checksum
//      mismatch, missing-file, row-count mismatch, wrong-B6-4 rejection, correct-
//      B6-10 acceptance, wrong distinct-OP footprint, wrong/shared/ambiguous
//      target rejection, malformed NDJSON, duplicate identity, preservation
//      invariants.
//   2. DRILL (when CLEAN_SLATE_REAL_ARCHIVE=<abs archive path> is set): bootstrap
//      a fresh disposable PostgreSQL 18.4 cluster, apply the Supabase preamble +
//      db/01..77, prove terminal migration 20260722055832, seed disposable master
//      stubs + preserved baselines, restore the REAL archive, reset, restore,
//      re-reset, and prove every count/identity/checksum/FK invariant, plus the
//      execution-mode guard rejection and the incorrect-delete-count rejection,
//      then destroy the cluster with proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile, readdir, access, mkdir } from 'node:fs/promises';
import { constants as fsC, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapCluster, getRepoRoot, isPidAlive, isPortOpen, DATA_DIR_PREFIX,
} from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  buildArchive, assertTargetIdentity, PRODUCTION_REF, RETIRED_REF, FORBIDDEN_REF,
  PRODUCTION_CONFIRMATION_FLAG,
  TERMINAL_MIGRATION, B6_DOCUMENT_ID, EXPORT_TABLES, EXPECTED_ROW_COUNTS,
  EXPECTED_OP_IDS, EXPECTED_LOTE_IDS, EXPECTED_PEDIDO_IDS,
} from '../scripts/reset/clean-slate-transactional-export.mjs';
import { verifyArchive } from '../scripts/reset/clean-slate-transactional-verify.mjs';

const REPO_ROOT = getRepoRoot();
// INTTRACKER-PRODUCTION-CUTOVER-R1: there is no authorized development target.
// Every archive-building call below is an explicitly confirmed READ-ONLY export
// of the definitive production project.
const PROD_TARGET = { target: PRODUCTION_REF, confirmProductionReadonlyExport: true };
const RESET_SQL = path.join(REPO_ROOT, 'scripts/reset/clean-slate-transactional-reset.sql');
const RESTORE_SQL = path.join(REPO_ROOT, 'scripts/reset/clean-slate-transactional-restore.sql');

const results = [];
function check(cond, name, detail) {
  results.push({ name, ok: !!cond, detail });
  process.stdout.write(`${cond ? 'ok  ' : 'FAIL'} - ${name}${cond ? '' : ` :: ${detail ?? ''}`}\n`);
  return !!cond;
}
function throws(fn, name) {
  try { fn(); check(false, name, 'expected throw'); } catch { check(true, name); }
}

// The Supabase-platform preamble a bare PG 18.4 cluster lacks (verbatim reuse of
// the committed C3D convention).
const PREAMBLE_SQL = `
DO $preamble$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$preamble$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  raw_user_meta_data jsonb, raw_app_meta_data jsonb);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; $fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text; $fn$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
`;

// Authoritative shared-dev migration-history versions (mirrors list_migrations of
// ucrjtfswnfdlxwtmxnoo). Seeded so the disposable cluster can literally prove
// terminal migration 20260722055832 — a documented drill-only convenience; the
// db chain itself carries no version-timestamp mapping.
const SCHEMA_MIGRATION_VERSIONS = [
  '20260713121707', '20260714012641', '20260715024449', '20260715134758', '20260715135358',
  '20260715135546', '20260715145347', '20260715190627', '20260716014338', '20260716014358',
  '20260717002523', '20260717003652', '20260717093122', '20260717101401', '20260717125153',
  '20260718110246', '20260718161418', '20260719012036', '20260719025055', '20260719120036',
  '20260719160518', '20260719172749', '20260719174006', '20260719175732', '20260719215401',
  '20260720234958', '20260720235820', TERMINAL_MIGRATION,
];

// Classification-faithful 64-row yarn corpus (verbatim C3D convention). db/67's
// migration-time self-check requires exactly 64 rows (A27/B12/C13/D12) in
// ordens_compra_fio; this is seeded after db/66 / before db/67 purely so the
// migration chain applies, then WIPED to a clean slate before the real archive
// is restored. It is drill scaffolding, not part of any archive identity claim.
const CORPUS_SQL = `
INSERT INTO public.cores (id, nome) VALUES (930000201, 'C3D-CORPUS-COR-ALGODAO') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (930000301, 'C3D-CORPUS-FORN-A', 'fio_algodao'), (930000302, 'C3D-CORPUS-FORN-B', 'fio_algodao') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano) VALUES (930000101, 990001, 2099) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.saldo_fios (tipo, cor_id, cor_poliester, kg_total) VALUES ('algodao', 930000201, NULL, 100.000) ON CONFLICT DO NOTHING;
INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, data_pedido, data_recebimento, status, status_administrativo, status_aceite, status_recebimento, legado_recebimento_automatico)
VALUES
  (930000311, 930000101, 930000301, 'algodao', 930000201, NULL, 15.500, 5.000, DATE '2026-01-05', NULL, 'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE),
  (930000312, 930000101, 930000302, 'algodao', 930000201, NULL, 12.000, NULL, DATE '2026-01-05', NULL, 'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE);
INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, data_pedido, data_recebimento, status, status_administrativo, status_aceite, status_recebimento, legado_recebimento_automatico)
SELECT gs, 930000101, 930000301, 'algodao', 930000201, NULL, 10.000,
  CASE WHEN cls.status = 'recebido_total' THEN 10.000 ELSE NULL END, DATE '2026-01-01',
  CASE WHEN cls.status = 'recebido_total' THEN DATE '2026-02-01' ELSE NULL END,
  cls.status, cls.status_administrativo, 'nao_aplicavel', cls.status_recebimento, FALSE
FROM generate_series(930000313, 930000374) AS gs
CROSS JOIN LATERAL (
  SELECT CASE WHEN gs BETWEEN 930000313 AND 930000349 THEN 'emitida' ELSE 'rascunho' END AS status_administrativo,
    CASE WHEN gs BETWEEN 930000313 AND 930000322 THEN 'pendente'
         WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido_total'
         WHEN gs BETWEEN 930000350 AND 930000362 THEN 'pendente' ELSE 'recebido_total' END AS status,
    CASE WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido'
         WHEN gs BETWEEN 930000363 AND 930000374 THEN 'recebido' ELSE 'nao_recebido' END AS status_recebimento
) AS cls;
`;

// ---------------------------------------------------------------------------
// Synthetic capture -> archive fixtures (drive the fixture suite)
// ---------------------------------------------------------------------------

function ndjsonLines(n, makeObj) {
  return Array.from({ length: n }, (_, i) => JSON.stringify(makeObj(i))).join('\n');
}

function syntheticCapture() {
  // 8 revisions v1..v8 with footprint [0,0,2,1,2,2,1,2] across OPs 55,57,61,63.
  const revIds = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-0000000000${(i + 10).toString().padStart(2, '0')}`);
  const footprint = [0, 0, 2, 1, 2, 2, 1, 2];
  const opCycle = [55, 57, 61, 63];
  const ropRows = [];
  let c = 0;
  footprint.forEach((cnt, ri) => { for (let k = 0; k < cnt; k++) ropRows.push({ revision_id: revIds[ri], op_id: opCycle[c++ % 4], criado_em: '2026-07-19T00:00:00+00:00' }); });

  const tableNdjson = {};
  for (const t of EXPORT_TABLES) {
    const n = EXPECTED_ROW_COUNTS[t.name];
    if (t.name === 'public.pedidos') tableNdjson[t.name] = ndjsonLines(n, (i) => ({ id: EXPECTED_PEDIDO_IDS[i], numero: i + 1, cliente_id: 1 }));
    else if (t.name === 'public.ops') tableNdjson[t.name] = ndjsonLines(n, (i) => ({ id: EXPECTED_OP_IDS[i], numero: i + 1, ano: 2026 }));
    else if (t.name === 'public.lotes') tableNdjson[t.name] = ndjsonLines(n, (i) => ({ id: EXPECTED_LOTE_IDS[i], cliente_id: 1 }));
    else if (t.name === 'public.document_link_revisions') tableNdjson[t.name] = revIds.map((id, i) => JSON.stringify({ id, document_id: B6_DOCUMENT_ID, version: i + 1, active: i === 7 })).join('\n');
    else if (t.name === 'public.document_link_revision_ops') tableNdjson[t.name] = ropRows.map((r) => JSON.stringify(r)).join('\n');
    else if (t.name === 'public.document_candidates') tableNdjson[t.name] = JSON.stringify({ id: '00000000-0000-4000-8000-0000000000aa', document_id: B6_DOCUMENT_ID });
    else tableNdjson[t.name] = ndjsonLines(n, (i) => ({ id: i + 1 }));
  }
  const tables = {};
  for (const t of EXPORT_TABLES) tables[t.name] = { row_count: EXPECTED_ROW_COUNTS[t.name], ndjson: tableNdjson[t.name] };

  const per_revision = footprint.map((ops, i) => ({ version: i + 1, ops }));
  return {
    identity: {
      current_database: 'postgres', current_user: 'postgres', current_role: 'postgres',
      transaction_read_only: 'on', transaction_isolation: 'repeatable read', server_version: '17.6',
      terminal_migration: TERMINAL_MIGRATION, project_ref: PRODUCTION_REF, captured_at: '2026-07-22T05:58:32+00:00',
    },
    cutover: {
      id: 1, status: 'legacy_active', read_authority: 'flat', reconciliation_status: 'not_started',
      snapshot_hash: null, inventory_baseline_hash: null, cutover_generation: null, source_snapshot_count: null,
      source_snapshot_total_kg: null, inventory_baseline_count: null, inventory_baseline_total_kg: null,
      snapshot_captured_at: null, import_started_at: null, import_completed_at: null, final_acl_closed_at: null,
      canonical_activated_at: null, productive_receipt_started_at: null,
    },
    gate: {
      boundary_a: Object.fromEntries(EXPORT_TABLES.filter((t) => /ordem|ordens|necessidade/.test(t.name)).map((t) => [t.name.replace('public.', ''), EXPECTED_ROW_COUNTS[t.name]])),
      boundary_b: Object.fromEntries(EXPORT_TABLES.filter((t) => /^public\.(op|pedido|ops|lotes)/.test(t.name)).map((t) => [t.name.replace('public.', ''), EXPECTED_ROW_COUNTS[t.name]])),
      b6: {
        document_link_revision_ops: 10, document_link_revisions: 8, document_candidates: 1,
        document_events: 0, document_technical_evidences: 0, document_decisions: 0,
        distinct_ops: [55, 57, 61, 63], per_revision, nonfixture_ops_on_b6_ops: 0,
      },
    },
    preserved_baseline: {
      saldo_fios: [
        { tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_total: 732.010 },
        { tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_total: 549.010 },
        { tipo: 'algodao', cor_id: 3, cor_poliester: null, kg_total: 549.000 },
        { tipo: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_total: 427.500 },
        { tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_total: 427.500 },
      ],
      saldo_fios_op_count: 0,
      op_numeros: [{ tipo: 'latex', ano: 2026, ultimo_numero: 18 }, { tipo: 'tecelagem', ano: 2026, ultimo_numero: 41 }],
      documents_front: { document_candidates_excl_b6: 39, document_events_total: 1, document_scan_requests: 24, document_scan_runs: 30 },
      master_counts: { clientes: 6, fornecedores: 6, cores: 6, modelos: 12, usuarios: 10, parametros_largura: 2, ordem_compra_config: 1, ordem_compra_cutover: 1, ordem_compra_cutover_source_snapshot: 0, ordem_compra_cutover_inventory_baseline: 0 },
    },
    corpus_identities: {
      pedido_ids: [...EXPECTED_PEDIDO_IDS], op_ids: [...EXPECTED_OP_IDS], lote_ids: [...EXPECTED_LOTE_IDS],
      b6: { document_id: B6_DOCUMENT_ID, revision_ids: revIds, distinct_ops: [55, 57, 61, 63], per_revision },
    },
    tables,
  };
}

async function runFixtureSuite() {
  process.stdout.write('\n== FIXTURE SUITE (no database) ==\n');
  const scratch = await mkdtemp(path.join(tmpdir(), 'clean-slate-fix-'));
  const outRoot = path.join(scratch, 'out');

  // Target-identity rejection (INTTRACKER-PRODUCTION-CUTOVER-R1 target contract:
  // missing/ambiguous/retired/forbidden/unknown always fail; production requires
  // the exact read-only confirmation).
  const confirmed = { confirmProductionReadonlyExport: true };
  throws(() => assertTargetIdentity(undefined), 'reject missing target');
  throws(() => assertTargetIdentity(''), 'reject empty target');
  throws(() => assertTargetIdentity('a b'), 'reject ambiguous target');
  throws(() => assertTargetIdentity(undefined, confirmed), 'reject missing target even when confirmed');
  throws(() => assertTargetIdentity(`${PRODUCTION_REF} ${RETIRED_REF}`, confirmed), 'reject ambiguous target even when confirmed');
  throws(() => assertTargetIdentity(RETIRED_REF), 'reject retired target');
  throws(() => assertTargetIdentity(RETIRED_REF, confirmed), 'reject retired target even with the production confirmation');
  throws(() => assertTargetIdentity(FORBIDDEN_REF), 'reject forbidden target');
  throws(() => assertTargetIdentity(FORBIDDEN_REF, confirmed), 'reject forbidden target even with the production confirmation');
  throws(() => assertTargetIdentity('some-other-ref'), 'reject non-authorized target');
  throws(() => assertTargetIdentity('some-other-ref', confirmed), 'reject non-authorized target even when confirmed');
  throws(() => assertTargetIdentity(PRODUCTION_REF), 'reject production target without the read-only confirmation');
  throws(() => assertTargetIdentity(PRODUCTION_REF, { confirmProductionReadonlyExport: 'true' }), 'reject a non-boolean production confirmation');
  check(assertTargetIdentity(PRODUCTION_REF, confirmed) === PRODUCTION_REF, 'accept the confirmed read-only production target');
  check(PRODUCTION_CONFIRMATION_FLAG === 'confirm-production-readonly-export', 'the production confirmation flag name is exact');

  // buildArchive fails closed on every unauthorized target and on a wrong-B6
  // capture. The unconfirmed-production case must leave no filesystem residue.
  const unconfirmedOutRoot = path.join(scratch, 'never-created-unconfirmed-production');
  throws(() => buildArchive(syntheticCapture(), unconfirmedOutRoot, { target: PRODUCTION_REF }), 'buildArchive rejects an unconfirmed production target');
  check(!existsSync(unconfirmedOutRoot), 'no filesystem residue after the unconfirmed production rejection', unconfirmedOutRoot);
  throws(() => buildArchive(syntheticCapture(), outRoot, { target: RETIRED_REF, ...confirmed }), 'buildArchive rejects the retired target even when confirmed');
  throws(() => buildArchive(syntheticCapture(), outRoot, { target: FORBIDDEN_REF, ...confirmed }), 'buildArchive rejects the forbidden target even when confirmed');
  throws(() => buildArchive(syntheticCapture(), outRoot, {}), 'buildArchive rejects a missing target');
  const b6four = syntheticCapture();
  b6four.gate.b6.document_link_revision_ops = 4;
  throws(() => buildArchive(b6four, outRoot, PROD_TARGET), 'buildArchive rejects wrong B6 value 4');

  // --- Blocking correction A: pre-write gate — every rejection below must leave
  // NO archive directory / partial file on disk (proven via a never-created,
  // dedicated out-root per case). ---
  const neverCreated = (label) => path.join(scratch, `never-created-${label}`);
  const rejectsBeforeWrite = (mutate, outRootLabel, name) => {
    const cap = syntheticCapture();
    mutate(cap);
    const badOutRoot = neverCreated(outRootLabel);
    throws(() => buildArchive(cap, badOutRoot, PROD_TARGET), name);
    check(!existsSync(badOutRoot), `no filesystem residue after: ${name}`, badOutRoot);
  };
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.saldo_fios[0].kg_total = 999.999; }, 'a',
    'buildArchive rejects a wrong saldo_fios quantity before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.saldo_fios.pop(); }, 'b',
    'buildArchive rejects wrong saldo_fios row count before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.op_numeros[0].ultimo_numero = 999; }, 'c',
    'buildArchive rejects wrong op_numeros value before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.documents_front.document_candidates_excl_b6 = 40; }, 'd',
    'buildArchive rejects wrong documents-front count before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.master_counts.clientes = 7; }, 'e',
    'buildArchive rejects wrong master count before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.identity.project_ref = 'wrong-project-ref-value'; }, 'f',
    'buildArchive rejects capture project_ref mismatch');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.op_numeros.push({ tipo: 'acabamento', ano: 2026, ultimo_numero: 1 }); }, 'g',
    'buildArchive rejects extra op_numeros row before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.op_numeros.pop(); }, 'h',
    'buildArchive rejects missing op_numeros row before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.op_numeros[1] = { ...cap.preserved_baseline.op_numeros[0] }; }, 'i',
    'buildArchive rejects duplicate op_numeros identity before filesystem creation');
  rejectsBeforeWrite((cap) => { cap.preserved_baseline.op_numeros[0].ano = 2025; }, 'j',
    'buildArchive rejects wrong op_numeros year before filesystem creation');

  // --- Blocking correction B: repository-boundary guard is file-location-derived
  // (getRepoRoot() via import.meta.url), never process.cwd()-derived — must
  // reject an in-repo out-root regardless of the caller's working directory. ---
  const savedCwd = process.cwd();
  try {
    process.chdir(REPO_ROOT);
    const inRepoFromRoot = path.join(REPO_ROOT, 'clean-slate-illegal-artifact-root-cwd');
    throws(() => buildArchive(syntheticCapture(), inRepoFromRoot, PROD_TARGET),
      'out-root inside repo is rejected when cwd is repo root');
    check(!existsSync(inRepoFromRoot), 'no filesystem residue after in-repo rejection (cwd=repo root)', inRepoFromRoot);

    process.chdir(path.join(REPO_ROOT, 'scripts', 'reset'));
    const inRepoFromScriptsReset = path.join(REPO_ROOT, 'clean-slate-illegal-artifact-scripts-reset-cwd');
    throws(() => buildArchive(syntheticCapture(), inRepoFromScriptsReset, PROD_TARGET),
      'out-root inside repo is rejected when cwd is scripts/reset');
    check(!existsSync(inRepoFromScriptsReset), 'no filesystem residue after in-repo rejection (cwd=scripts/reset)', inRepoFromScriptsReset);

    // Positive complement: a genuinely external out-root must still be accepted
    // even when cwd is the repo root — proves the guard checks the PATH, not cwd.
    const externalFromRepoCwd = path.join(scratch, 'external-out-from-repo-cwd');
    process.chdir(REPO_ROOT);
    const builtExternal = buildArchive(syntheticCapture(), externalFromRepoCwd, PROD_TARGET);
    check(existsSync(builtExternal.archiveDir), 'external out-root is still accepted when cwd is repo root');
  } finally {
    process.chdir(savedCwd);
  }

  // CLI-level: launched from an unrelated EXTERNAL working directory, targeting
  // an in-repo out-root — must still be rejected (proves the guard is correct
  // for the actual CLI entrypoint, not just the library function).
  const extCwd = await mkdtemp(path.join(tmpdir(), 'clean-slate-extcwd-'));
  const cliCaptureFile = path.join(scratch, 'cli-capture.json');
  await writeFile(cliCaptureFile, JSON.stringify(syntheticCapture()), 'utf8');
  const illegalCliOutRoot = path.join(REPO_ROOT, 'clean-slate-illegal-artifact-external-cwd');
  const cliResult = spawnSync(process.execPath, [
    path.join(REPO_ROOT, 'scripts/reset/clean-slate-transactional-export.mjs'),
    'export', '--target', PRODUCTION_REF, `--${PRODUCTION_CONFIRMATION_FLAG}`,
    '--from-capture', cliCaptureFile, '--out-root', illegalCliOutRoot,
  ], { cwd: extCwd, encoding: 'utf8', timeout: 30000 });
  check(cliResult.status !== 0, 'CLI export rejects in-repo out-root launched from an unrelated external cwd', cliResult.stderr);
  check(!existsSync(illegalCliOutRoot), 'no archive directory created for the rejected in-repo out-root (CLI)', illegalCliOutRoot);
  await rm(extCwd, { recursive: true, force: true });

  // Build a valid archive and verify it (correct B6 value 10 acceptance + manifest validation).
  const { archiveDir } = buildArchive(syntheticCapture(), outRoot, PROD_TARGET);
  const v = verifyArchive(archiveDir);
  check(v.failed === 0, 'valid archive verifies clean (B6=10 accepted, manifest valid)', v.checks.filter((c) => !c.ok).map((c) => c.name).join('; '));

  // Negative archive mutations.
  const clone = async (mutate) => {
    const d = await mkdtemp(path.join(scratch, 'arc-'));
    spawnSync(process.platform === 'win32' ? 'xcopy' : 'cp', process.platform === 'win32'
      ? [archiveDir, path.join(d, 'a'), '/E', '/I', '/Q']
      : ['-r', archiveDir, path.join(d, 'a')], { encoding: 'utf8' });
    const dir = path.join(d, 'a');
    await mutate(dir);
    return dir;
  };
  const ropFile = (dir) => path.join(dir, 'tables/public.document_link_revision_ops.ndjson');

  const cMissing = await clone(async (dir) => { await rm(path.join(dir, 'tables/public.pedidos.ndjson')); });
  check(verifyArchive(cMissing).failed > 0, 'reject missing table file');

  const cChecksum = await clone(async (dir) => {
    const f = path.join(dir, 'tables/public.ops.ndjson');
    const body = await readFile(f, 'utf8');
    await writeFile(f, body.replace('"id":1', '"id":9999'));
  });
  check(verifyArchive(cChecksum).failed > 0, 'reject per-file checksum mismatch');

  const cRowcount = await clone(async (dir) => {
    const f = path.join(dir, 'tables/public.op_itens.ndjson');
    const body = await readFile(f, 'utf8');
    await writeFile(f, body + '{"id":999}\n');
  });
  check(verifyArchive(cRowcount).failed > 0, 'reject row-count mismatch');

  const cB6four = await clone(async (dir) => {
    const body = (await readFile(ropFile(dir), 'utf8')).split('\n').filter(Boolean).slice(0, 4).join('\n') + '\n';
    await writeFile(ropFile(dir), body);
  });
  check(verifyArchive(cB6four).failed > 0, 'reject B6 revision-ops = 4 (must be 10)');

  const cB6ops = await clone(async (dir) => {
    const body = (await readFile(ropFile(dir), 'utf8')).replace('"op_id":63', '"op_id":99');
    await writeFile(ropFile(dir), body);
  });
  check(verifyArchive(cB6ops).failed > 0, 'reject wrong distinct-OP footprint');

  const cMalformed = await clone(async (dir) => {
    const f = path.join(dir, 'tables/public.necessidade_compra_fio.ndjson');
    const body = await readFile(f, 'utf8');
    await writeFile(f, body.replace('{"id":1}', '{"id":1'));
  });
  check(verifyArchive(cMalformed).failed > 0, 'reject malformed NDJSON');

  const cDup = await clone(async (dir) => {
    const f = path.join(dir, 'tables/public.pedidos.ndjson');
    const lines = (await readFile(f, 'utf8')).split('\n').filter(Boolean);
    lines[1] = lines[0];
    await writeFile(f, lines.join('\n') + '\n');
  });
  check(verifyArchive(cDup).failed > 0, 'reject duplicate identity');

  const cPreserve = await clone(async (dir) => {
    const f = path.join(dir, 'evidence/preserved-baseline.json');
    const body = await readFile(f, 'utf8');
    await writeFile(f, body.replace('732.01', '999.99'));
  });
  check(verifyArchive(cPreserve).failed > 0, 'reject preservation-invariant violation');

  // --- Correction B (op_numeros exact identity): archive-verifier negatives. ---
  const cOpnExtra = await clone(async (dir) => {
    const f = path.join(dir, 'evidence/preserved-baseline.json');
    const body = JSON.parse(await readFile(f, 'utf8'));
    body.op_numeros.push({ tipo: 'acabamento', ano: 2026, ultimo_numero: 1 });
    await writeFile(f, JSON.stringify(body));
  });
  const vOpnExtra = verifyArchive(cOpnExtra);
  check(
    vOpnExtra.failed > 0 && vOpnExtra.checks.some((c) => !c.ok && c.name.includes('preserved baseline evidence')),
    'reject extra op_numeros row in preserved-baseline evidence',
  );
  check(verifyArchive(archiveDir).failed === 0, 'valid archive still passes after extra-op_numeros-row negative clone');

  const cOpnYear = await clone(async (dir) => {
    const f = path.join(dir, 'evidence/preserved-baseline.json');
    const body = JSON.parse(await readFile(f, 'utf8'));
    body.op_numeros[0].ano = 2025;
    await writeFile(f, JSON.stringify(body));
  });
  const vOpnYear = verifyArchive(cOpnYear);
  check(
    vOpnYear.failed > 0 && vOpnYear.checks.some((c) => !c.ok && c.name.includes('preserved baseline evidence')),
    'reject wrong op_numeros year in preserved-baseline evidence',
  );
  check(verifyArchive(archiveDir).failed === 0, 'valid archive still passes after wrong-op_numeros-year negative clone');

  // --- Blocking correction D: project-ref custody in the verifier. ---
  const cBadRef = await clone(async (dir) => {
    const f = path.join(dir, 'manifest.json');
    const body = (await readFile(f, 'utf8')).replaceAll(PRODUCTION_REF, 'other-project-ref-xxxx');
    await writeFile(f, body);
  });
  check(verifyArchive(cBadRef).failed > 0, 'verifyArchive rejects manifest project_ref mismatch');

  // --- Target contract: an archive claiming the retired or the forbidden
  // project is never an authorized target, whatever else it contains. ---
  const claimRef = async (ref) => clone(async (dir) => {
    for (const rel of ['manifest.json', 'evidence/database-identity.json']) {
      const f = path.join(dir, rel);
      await writeFile(f, (await readFile(f, 'utf8')).replaceAll(PRODUCTION_REF, ref));
    }
  });
  const namedFail = (res, needle) => res.failed > 0 && res.checks.some((c) => !c.ok && c.name.includes(needle));
  check(namedFail(verifyArchive(await claimRef(RETIRED_REF)), RETIRED_REF),
    'verifyArchive rejects an archive claiming the retired project');
  check(namedFail(verifyArchive(await claimRef(FORBIDDEN_REF)), FORBIDDEN_REF),
    'verifyArchive rejects an archive claiming the forbidden project');
  check(verifyArchive(archiveDir).failed === 0, 'valid archive still passes after the retired/forbidden identity negatives');

  // --- Blocking correction C: exact archive inventory — unexpected content. ---
  const cExtraRoot = await clone(async (dir) => { await writeFile(path.join(dir, 'unexpected-root-file.txt'), 'x'); });
  check(verifyArchive(cExtraRoot).failed > 0, 'reject unexpected root file');

  const cExtraEvidence = await clone(async (dir) => { await writeFile(path.join(dir, 'evidence/extra-unexpected.json'), '{}'); });
  check(verifyArchive(cExtraEvidence).failed > 0, 'reject unexpected evidence file');

  const cExtraNested = await clone(async (dir) => {
    await mkdir(path.join(dir, 'tables', 'nested'), { recursive: true });
    await writeFile(path.join(dir, 'tables', 'nested', 'extra.ndjson'), '{}\n');
  });
  check(verifyArchive(cExtraNested).failed > 0, 'reject unexpected nested file');

  // --- Blocking correction C: checksums.sha256 strictness. ---
  const cExtraChecksum = await clone(async (dir) => {
    const f = path.join(dir, 'checksums.sha256');
    const body = await readFile(f, 'utf8');
    await writeFile(f, `${body}e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85  tables/public.op_eventos.ndjson.bak\n`);
  });
  check(verifyArchive(cExtraChecksum).failed > 0, 'reject extra checksums entry');

  const cDupChecksum = await clone(async (dir) => {
    const f = path.join(dir, 'checksums.sha256');
    const lines = (await readFile(f, 'utf8')).split('\n').filter(Boolean);
    await writeFile(f, [...lines, lines[0]].join('\n') + '\n');
  });
  check(verifyArchive(cDupChecksum).failed > 0, 'reject duplicate checksums entry');

  const cMalformedChecksum = await clone(async (dir) => {
    const f = path.join(dir, 'checksums.sha256');
    const lines = (await readFile(f, 'utf8')).split('\n').filter(Boolean);
    lines[0] = 'this-line-is-not-a-valid-checksums-entry';
    await writeFile(f, lines.join('\n') + '\n');
  });
  check(verifyArchive(cMalformedChecksum).failed > 0, 'reject malformed checksums line');

  const cMissingChecksum = await clone(async (dir) => {
    const f = path.join(dir, 'checksums.sha256');
    const lines = (await readFile(f, 'utf8')).split('\n').filter(Boolean);
    lines.shift();
    await writeFile(f, lines.join('\n') + '\n');
  });
  check(verifyArchive(cMissingChecksum).failed > 0, 'reject missing checksums entry');

  // The original, untouched archive must still verify clean after every clone
  // above — proves none of the negative-case fixtures mutated the source archive.
  const finalCheck = verifyArchive(archiveDir);
  check(finalCheck.failed === 0, 'valid archive still passes after all negative-case testing',
    finalCheck.checks.filter((c) => !c.ok).map((c) => c.name).join('; '));

  // Reset/restore SQL static guard-presence.
  const resetSql = await readFile(RESET_SQL, 'utf8');
  const restoreSql = await readFile(RESTORE_SQL, 'utf8');
  check(/clean_slate\.execution_mode/.test(resetSql) && /disposable-drill/.test(resetSql) && !/shared[-_]?dev.*execute/i.test(resetSql), 'reset SQL has disposable-drill execution guard, no shared-dev mode');
  check(/clean_slate\.execution_mode/.test(restoreSql) && /disposable-drill/.test(restoreSql), 'restore SQL has disposable-drill execution guard');
  check(!/\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?public\./i.test(resetSql) && /DELETE FROM public\./.test(resetSql), 'reset SQL uses DELETE not TRUNCATE');

  await rm(scratch, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Disposable drill helpers
// ---------------------------------------------------------------------------

function baseArgs(h) {
  return ['-X', '-w', '-q', '-A', '-t', '-h', h.host, '-p', String(h.port), '-U', h.user, '-d', h.database];
}
function psqlBin(h) { return path.join(h.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql'); }

function psqlExec(h, sql, extra = []) {
  const r = spawnSync(psqlBin(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', ...extra, '-c', sql], { encoding: 'utf8', timeout: 120000, maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || r.error?.message || '').trim(), status: r.status };
}
function psqlFile(h, file, { sentinel = false } = {}) {
  const pre = sentinel ? ['-c', "SET clean_slate.execution_mode = 'disposable-drill'"] : [];
  const r = spawnSync(psqlBin(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', ...pre, '-f', file], { encoding: 'utf8', timeout: 180000, maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), err: (r.stderr || r.error?.message || '').trim(), status: r.status };
}
function scalar(h, sql) { return psqlExec(h, sql).out; }

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

function sqlLit(s) { return `'${String(s).replace(/'/g, "''")}'`; }

async function loadStage(h, archiveDir, scratch) {
  // Build one persistent staging table populated from every archived NDJSON row.
  const stmts = [
    'DROP TABLE IF EXISTS clean_slate_restore_stage;',
    'CREATE TABLE clean_slate_restore_stage (table_name text NOT NULL, payload jsonb NOT NULL);',
  ];
  for (const t of EXPORT_TABLES) {
    const raw = await readFile(path.join(archiveDir, `tables/${t.name}.ndjson`), 'utf8');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    for (let i = 0; i < lines.length; i += 200) {
      const chunk = lines.slice(i, i + 200)
        .map((l) => `(${sqlLit(t.name)}, ${sqlLit(l)}::jsonb)`).join(',');
      if (chunk) stmts.push(`INSERT INTO clean_slate_restore_stage(table_name,payload) VALUES ${chunk};`);
    }
  }
  const f = path.join(scratch, 'stage-load.sql');
  await writeFile(f, stmts.join('\n'), 'utf8');
  const r = spawnSync(psqlBin(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8', timeout: 180000, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`stage load failed: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`);
}

// External FK edges to auth.users among the restored tables (from the authoritative
// shared-dev catalog). Each maps to opaque id-only auth.users stubs in the drill.
const ACTOR_FK_COLUMNS = {
  'public.document_decisions': ['decidido_por', 'revogada_por'],
  'public.document_link_revisions': ['created_by', 'revoked_by'],
  'public.op_eventos': ['criado_por'],
  'public.ordem_compra': ['aceite_decidida_por', 'emitida_por', 'cancelada_por'],
  'public.ordem_compra_distribuicao_comandos': ['ator_id'],
  'public.ordem_compra_eventos': ['criado_por'],
  'public.ordem_compra_fio_lancamentos': ['criado_por'],
  'public.ordem_compra_fio_movimentos_estoque': ['ator_id'],
  'public.ordem_compra_item_compat_fio': ['criado_por'],
  'public.ordem_compra_recebimentos': ['ator_id'],
  'public.ordens_compra_fio': ['cancelada_por', 'aceite_decidida_por', 'emitida_por'],
  'public.pedido_cliente_eventos': ['criado_por'],
  'public.pedido_compra_fio_regime': ['definido_por'],
  'public.pedido_eventos': ['criado_por'],
  'public.pedido_parciais': ['criado_por'],
};

async function wipeCleanSlate(h, scratch) {
  // Replica-mode DELETE of every operational/preserved-runtime table + the
  // synthetic 930000xxx master rows, so the real archive restores into a clean DB.
  const tables = [...EXPORT_TABLES.map((t) => t.name), 'public.saldo_fios', 'public.saldo_fios_op', 'public.op_numeros'];
  const lines = [
    'SET session_replication_role = replica;',
    ...tables.map((t) => `DELETE FROM ${t};`),
    'DELETE FROM public.cores WHERE id >= 930000000;',
    'DELETE FROM public.fornecedores WHERE id >= 930000000;',
    'SET session_replication_role = DEFAULT;',
  ];
  const f = path.join(scratch, 'wipe.sql');
  await writeFile(f, lines.join('\n'), 'utf8');
  const r = spawnSync(psqlBin(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`wipe failed: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`);
}

async function seedDisposable(h, archiveDir, scratch) {
  // Distinct master ids referenced by the archived rows (opaque stubs, disposable only).
  const idsFrom = async (table, cols) => {
    const raw = await readFile(path.join(archiveDir, `tables/${table}.ndjson`), 'utf8');
    const set = new Set();
    for (const l of raw.split('\n').filter(Boolean)) { const o = JSON.parse(l); for (const c of cols) if (o[c] != null) set.add(o[c]); }
    return [...set];
  };
  const cor = new Set([...(await idsFrom('public.pedido_itens', ['cor_1_id', 'cor_2_id'])), ...(await idsFrom('public.necessidade_compra_fio', ['cor_id'])), ...(await idsFrom('public.ordem_compra_item', ['cor_id'])), ...(await idsFrom('public.ordens_compra_fio', ['cor_id'])), 1, 2, 3]);
  const cliente = new Set([...(await idsFrom('public.pedidos', ['cliente_id'])), ...(await idsFrom('public.lotes', ['cliente_id']))]);
  const forn = new Set([...(await idsFrom('public.op_fornecedores', ['fornecedor_id'])), ...(await idsFrom('public.ordens_compra_fio', ['fornecedor_id'])), ...(await idsFrom('public.ordem_compra', ['fornecedor_id']))]);
  const modelo = new Set([...(await idsFrom('public.op_itens', ['modelo_id'])), ...(await idsFrom('public.pedido_itens', ['modelo_id']))]);

  // Actor UUIDs referencing auth.users (opaque id-only stubs, disposable only).
  // The exact actor-column map (external FK edges to auth.users). restore.sql's
  // FK orphan check is the safety net for any dependency missed here.
  const actor = new Set();
  for (const [tbl, cols] of Object.entries(ACTOR_FK_COLUMNS)) (await idsFrom(tbl, cols)).forEach((v) => actor.add(v));

  const preserved = JSON.parse(await readFile(path.join(archiveDir, 'evidence/preserved-baseline.json'), 'utf8'));

  const lines = ['SET session_replication_role = replica;'];
  for (const u of actor) lines.push(`INSERT INTO auth.users(id) VALUES (${sqlLit(u)}) ON CONFLICT (id) DO NOTHING;`);
  for (const id of cor) lines.push(`INSERT INTO public.cores(id,nome) VALUES (${id},'stub-cor-${id}') ON CONFLICT (id) DO NOTHING;`);
  for (const id of cliente) lines.push(`INSERT INTO public.clientes(id,nome) VALUES (${id},'stub-cliente-${id}') ON CONFLICT (id) DO NOTHING;`);
  for (const id of forn) lines.push(`INSERT INTO public.fornecedores(id,nome,tipo) VALUES (${id},'stub-forn-${id}','tecelagem') ON CONFLICT (id) DO NOTHING;`);
  for (const id of modelo) lines.push(`INSERT INTO public.modelos(id,nome,cor_1_id,cor_2_id,largura) VALUES (${id},'stub-modelo-${id}',1,1,1.40) ON CONFLICT (id) DO NOTHING;`);
  // Preserved baselines (exact values from the archive evidence).
  lines.push('DELETE FROM public.saldo_fios;');
  for (const s of preserved.saldo_fios) lines.push(`INSERT INTO public.saldo_fios(cor_id,cor_poliester,tipo,kg_total) VALUES (${s.cor_id ?? 'NULL'},${s.cor_poliester ? sqlLit(s.cor_poliester) : 'NULL'},${sqlLit(s.tipo)},${s.kg_total});`);
  lines.push('DELETE FROM public.op_numeros;');
  for (const o of preserved.op_numeros) lines.push(`INSERT INTO public.op_numeros(tipo,ano,ultimo_numero) VALUES (${sqlLit(o.tipo)},${o.ano},${o.ultimo_numero});`);
  lines.push('SET session_replication_role = DEFAULT;');

  const f = path.join(scratch, 'seed.sql');
  await writeFile(f, lines.join('\n'), 'utf8');
  const r = spawnSync(psqlBin(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`seed failed: ${(r.stderr || '').split('\n').slice(0, 3).join(' ')}`);
  return { cor: cor.size, cliente: cliente.size, forn: forn.size, modelo: modelo.size, actor: actor.size };
}

function proveZero(h, label) {
  const total = scalar(h, `SELECT (SELECT count(*) FROM public.ordens_compra_fio)+(SELECT count(*) FROM public.ordem_compra)+(SELECT count(*) FROM public.ordem_compra_item)+(SELECT count(*) FROM public.ordem_compra_item_alocacao)+(SELECT count(*) FROM public.necessidade_compra_fio)+(SELECT count(*) FROM public.pedidos)+(SELECT count(*) FROM public.pedido_itens)+(SELECT count(*) FROM public.ops)+(SELECT count(*) FROM public.op_itens)+(SELECT count(*) FROM public.op_fornecedores)+(SELECT count(*) FROM public.lotes)+(SELECT count(*) FROM public.document_link_revisions WHERE document_id=${sqlLit(B6_DOCUMENT_ID)})+(SELECT count(*) FROM public.document_candidates WHERE document_id=${sqlLit(B6_DOCUMENT_ID)})`);
  return check(total === '0', `${label}: target corpus is zero`, `sum=${total}`);
}

function provePreserved(h, label) {
  const sf = scalar(h, 'SELECT count(*) FROM public.saldo_fios');
  const sfKg = scalar(h, "SELECT to_char(sum(kg_total),'FM9999999.000') FROM public.saldo_fios");
  const latex = scalar(h, "SELECT ultimo_numero FROM public.op_numeros WHERE tipo='latex'");
  const tec = scalar(h, "SELECT ultimo_numero FROM public.op_numeros WHERE tipo='tecelagem'");
  const cut = scalar(h, 'SELECT status||'+"'/'"+'||read_authority||'+"'/'"+'||reconciliation_status FROM public.ordem_compra_cutover WHERE id=1');
  check(sf === '5', `${label}: saldo_fios preserved (5 rows)`, sf);
  check(sfKg === '2685.020', `${label}: saldo_fios total preserved (2685.020 kg)`, sfKg);
  check(latex === '18' && tec === '41', `${label}: op_numeros preserved (latex 18 / tecelagem 41)`, `${latex}/${tec}`);
  check(cut === 'legacy_active/flat/not_started', `${label}: cutover preserved`, cut);
}

async function runDrill(realArchive) {
  process.stdout.write(`\n== DISPOSABLE DRILL (archive ${realArchive}) ==\n`);

  // §13.1 verify the real archive first.
  const av = verifyArchive(realArchive);
  check(av.failed === 0, 'drill: real archive verifies clean', av.checks.filter((c) => !c.ok).map((c) => c.name).join('; '));
  if (av.failed) return;

  const handle = await bootstrapCluster({});
  const scratch = await mkdtemp(path.join(tmpdir(), 'clean-slate-drill-'));
  handle._scratchDir = scratch;
  let ok = true;
  try {
    check(true, `drill: disposable cluster bootstrapped (pid ${handle.postmasterPid}, port ${handle.port})`);

    // Preamble + db/01..77.
    const preambleFile = path.join(scratch, 'preamble.sql');
    await writeFile(preambleFile, PREAMBLE_SQL, 'utf8');
    let r = spawnSync(psqlBin(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', preambleFile], { encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) throw new Error(`preamble failed: ${r.stderr}`);
    const manifest = await resolveManifest();
    check(manifest.length === 77 && manifest[manifest.length - 1].n === 77, 'drill: migration manifest is db/01..77', `${manifest.length} files`);
    const corpusFile = path.join(scratch, 'corpus.sql');
    await writeFile(corpusFile, CORPUS_SQL, 'utf8');
    for (const { n, file } of manifest) {
      r = spawnSync(psqlBin(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) throw new Error(`APPLY_FAILED (${path.basename(file)}): ${(r.stderr || '').split('\n').slice(0, 4).join(' ')}`);
      if (n === 66) { // db/67's self-check requires the classified 64-row corpus
        const cr = spawnSync(psqlBin(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', corpusFile], { encoding: 'utf8', timeout: 60000 });
        if (cr.status !== 0) throw new Error(`CORPUS_APPLY_FAILED: ${(cr.stderr || '').split('\n').slice(0, 4).join(' ')}`);
      }
    }
    check(true, 'drill: applied Supabase preamble + db/01..66 + classification corpus + db/67..77');

    // Prove terminal migration (seed schema_migrations mirroring shared-dev).
    const smValues = SCHEMA_MIGRATION_VERSIONS.map((v) => `(${sqlLit(v)})`).join(',');
    psqlExec(handle, `CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text primary key, statements text[], name text); INSERT INTO supabase_migrations.schema_migrations(version) VALUES ${smValues} ON CONFLICT DO NOTHING;`);
    check(scalar(handle, 'SELECT max(version) FROM supabase_migrations.schema_migrations') === TERMINAL_MIGRATION, 'drill: terminal migration 20260722055832 proven');
    check(scalar(handle, "SELECT status||'/'||read_authority||'/'||reconciliation_status FROM public.ordem_compra_cutover WHERE id=1") === 'legacy_active/flat/not_started', 'drill: fresh cutover is legacy_active/flat/not_started');

    // Wipe the migration-seeded synthetic corpus to a clean slate (drill scaffolding).
    await wipeCleanSlate(handle, scratch);
    check(scalar(handle, 'SELECT (SELECT count(*) FROM public.ordens_compra_fio)+(SELECT count(*) FROM public.ops)+(SELECT count(*) FROM public.ordem_compra)+(SELECT count(*) FROM public.necessidade_compra_fio)') === '0', 'drill: synthetic migration corpus wiped to clean slate');

    // Seed disposable master stubs + preserved baselines.
    const stubs = await seedDisposable(handle, realArchive, scratch);
    check(true, `drill: seeded opaque stubs (auth.users ${stubs.actor}, cores ${stubs.cor}, clientes ${stubs.cliente}, fornecedores ${stubs.forn}, modelos ${stubs.modelo}) + preserved baselines`);
    await loadStage(handle, realArchive, scratch);
    check(scalar(handle, 'SELECT count(*) FROM clean_slate_restore_stage') === String(Object.values(EXPECTED_ROW_COUNTS).reduce((a, b) => a + b, 0)), 'drill: archive staged (all rows)');

    // §13.7 prepare corpus = restore #0; §13.8 reset #1; §13.9 zero; §13.10 preserved intact.
    let res = psqlFile(handle, RESTORE_SQL, { sentinel: true });
    check(res.ok && /CLEAN_SLATE_RESTORE_DISPOSABLE_DRILL_PASS/.test(res.out), 'drill: prepare corpus (restore #0)', res.err);
    res = psqlFile(handle, RESET_SQL, { sentinel: true });
    check(res.ok && /CLEAN_SLATE_RESET_DISPOSABLE_DRILL_PASS/.test(res.out), 'drill: reset #1 exact affected-row sequence', res.err);
    proveZero(handle, 'drill reset #1');
    provePreserved(handle, 'drill after reset #1');

    // §13.11 restore #1; §13.12-22 prove counts/identities/B6/preserved/FK.
    res = psqlFile(handle, RESTORE_SQL, { sentinel: true });
    check(res.ok && /CLEAN_SLATE_RESTORE_DISPOSABLE_DRILL_PASS/.test(res.out), 'drill: restore #1 (FK + identities proven in-SQL)', res.err);
    for (const t of EXPORT_TABLES) {
      const got = scalar(handle, `SELECT count(*) FROM ${t.name}${t.scope ? ` WHERE ${t.scope.replace(/\$B6/g, sqlLit(B6_DOCUMENT_ID))}` : ''}`);
      if (String(EXPECTED_ROW_COUNTS[t.name]) !== got) check(false, `drill restore count ${t.name}`, `${got} != ${EXPECTED_ROW_COUNTS[t.name]}`);
    }
    check(scalar(handle, 'SELECT count(*) FROM public.pedidos') === '16', 'drill: restored 16 Pedidos');
    check(scalar(handle, "SELECT string_agg(id::text,',' ORDER BY id) FROM public.ops") === EXPECTED_OP_IDS.join(','), 'drill: restored exact 20 OP ids');
    check(scalar(handle, "SELECT string_agg(id::text,',' ORDER BY id) FROM public.lotes") === EXPECTED_LOTE_IDS.join(','), 'drill: restored exact 25 lote ids');
    const b6ops = scalar(handle, `SELECT string_agg(DISTINCT op_id::text,',' ORDER BY op_id::text) FROM public.document_link_revision_ops WHERE revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id=${sqlLit(B6_DOCUMENT_ID)})`);
    const b6rops = scalar(handle, `SELECT count(*) FROM public.document_link_revision_ops WHERE revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id=${sqlLit(B6_DOCUMENT_ID)})`);
    const b6revs = scalar(handle, `SELECT count(*) FROM public.document_link_revisions WHERE document_id=${sqlLit(B6_DOCUMENT_ID)}`);
    check(b6revs === '8' && b6rops === '10' && b6ops === '55,57,61,63', 'drill: B6 restored (8 revisions, 10 revision-ops across OPs 55/57/61/63)', `${b6revs}/${b6rops}/${b6ops}`);
    provePreserved(handle, 'drill after restore #1');

    // §13.23-25 reset #2 (restored corpus fully re-deletable) -> zero again.
    res = psqlFile(handle, RESET_SQL, { sentinel: true });
    check(res.ok && /CLEAN_SLATE_RESET_DISPOSABLE_DRILL_PASS/.test(res.out), 'drill: reset #2 (restored corpus re-deletable)', res.err);
    proveZero(handle, 'drill reset #2');

    // Negative behavioral cases (order §12): execution-mode guard + delete-count assertion.
    const noSentinel = psqlFile(handle, RESET_SQL, { sentinel: false });
    check(!noSentinel.ok && /disposable-drill sentinel/.test(noSentinel.out), 'drill: reset rejected without execution-mode sentinel');
    const emptyReset = psqlFile(handle, RESET_SQL, { sentinel: true }); // corpus already empty -> A6 expects 51, gets 0
    check(!emptyReset.ok && /expected 51 got 0/.test(emptyReset.out), 'drill: incorrect delete-count assertion rejected');

    // Scaffolding removed before disposal.
    psqlExec(handle, 'DROP TABLE IF EXISTS clean_slate_restore_stage;');
    check(scalar(handle, "SELECT to_regclass('clean_slate_restore_stage') IS NULL") === 't', 'drill: restore-stage scaffolding removed');
  } catch (e) {
    ok = false;
    check(false, 'drill: unexpected error', e.message);
  } finally {
    // §13.26-27 destroy the disposable environment and prove no residue.
    const pid = handle.postmasterPid, port = handle.port, dataDir = handle.dataDir;
    try {
      const stop = await handle.stop();
      check(stop.stopResult?.ok && stop.pidAbsent && stop.portClosed && stop.dirAbsent, 'drill: cluster stop proof (pid/port/dir absent)');
      check(!isPidAlive(pid), 'drill: postmaster PID independently absent');
      check(!(await isPortOpen(handle.host, port, 500)), 'drill: TCP port independently closed');
      check(await access(dataDir, fsC.F_OK).then(() => false).catch(() => true), 'drill: data directory independently absent');
      await rm(scratch, { recursive: true, force: true });
      const leftover = (await readdir(tmpdir())).filter((e) => e.startsWith(DATA_DIR_PREFIX) && dataDir.includes(e));
      check(leftover.length === 0, 'drill: no disposable-cluster residue remains');
    } catch (e) {
      check(false, 'drill: destruction proof', e.message);
    }
  }
  return ok;
}

async function main() {
  await runFixtureSuite();
  const realArchive = process.env.CLEAN_SLATE_REAL_ARCHIVE;
  if (realArchive) await runDrill(path.resolve(realArchive));
  else process.stdout.write('\n(NOTE) CLEAN_SLATE_REAL_ARCHIVE not set — the disposable cluster drill (and the two cluster-only behavioral cases) were NOT run.\n');

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\nclean-slate smoke: ${results.length - failed.length}/${results.length} checks passed\n`);
  if (failed.length) { process.exitCode = 1; }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main().catch((err) => { process.stderr.write(`${err.stack || err}\n`); process.exitCode = 1; });

export { runFixtureSuite, runDrill };
