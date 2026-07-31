// scripts/c3d/p1-harness.mjs
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1 shared
// disposable-cluster harness.
//
// Reconstructs the production schema on a fresh, isolated, disposable local
// PostgreSQL cluster (Supabase-platform preamble + the classification-faithful
// 64-row corpus + db/01..db/100 in manifest order) and then applies the seven
// authorized P1 migrations (db/101, 102, 103, 105, 107, 108, 109) in exact
// numerical order. Exposes the psql helpers every P1 integration test needs.
//
// The preamble and corpus are byte-equivalent to the accepted C3D/db99
// harnesses, so this rehearsal reproduces the same schema those accepted
// proofs were measured against.
//
// Out of scope by design: no remote host, no managed backend, no credential,
// no production contact of any kind, no repository write.

import { spawnSync, spawn } from 'node:child_process';
import { writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from './bootstrap-disposable-cluster.mjs';

export const REPO_ROOT = getRepoRoot();

// The seven authorized P1 migrations. db/103b, db/104, db/106 and db/110 are
// deliberately absent: they belong to P4/P5 and later phases.
// db/111 is the TD3 forward correction (server-owned atomic weaving
// delivery). db/104 and db/106 stay reserved for P4 and db/110 for the
// post-acceptance legacy retirement, so the sequence is deliberately
// non-contiguous.
export const P1_MIGRATIONS = [101, 102, 103, 105, 107, 108, 109, 111];

export const ADMIN_UUID = '9d1f0000-0000-4000-8000-00000000ad01';
export const ADMIN2_UUID = '9d1f0000-0000-4000-8000-00000000ad02';
export const NONADMIN_UUID = '9d1f0000-0000-4000-8000-00000000ad03';
export const FORNUSER_UUID = '9d1f0000-0000-4000-8000-00000000ad04';

// ---------------------------------------------------------------------------
// Supabase-platform preamble (before db/01)
// ---------------------------------------------------------------------------
export const PREAMBLE_SQL = `
DO $preamble$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$preamble$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text,
  last_sign_in_at    timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  raw_user_meta_data jsonb,
  raw_app_meta_data  jsonb
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
$fn$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
`;

// ---------------------------------------------------------------------------
// Classification-faithful 64-row legacy corpus (after db/66, before db/67)
// ---------------------------------------------------------------------------
export const CORPUS_SQL = `
INSERT INTO public.cores (id, nome) VALUES (930000201, 'C3D-CORPUS-COR-ALGODAO')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (930000301, 'C3D-CORPUS-FORN-A (matching)', 'fio_algodao'),
  (930000302, 'C3D-CORPUS-FORN-B (control)',  'fio_algodao')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano) VALUES (930000101, 990001, 2099)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.saldo_fios (tipo, cor_id, cor_poliester, kg_total)
  VALUES ('algodao', 930000201, NULL, 100.000)
  ON CONFLICT DO NOTHING;

INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester,
   kg_pedido, kg_recebido, data_pedido, data_recebimento,
   status, status_administrativo, status_aceite, status_recebimento,
   legado_recebimento_automatico)
VALUES
  (930000311, 930000101, 930000301, 'algodao', 930000201, NULL,
   15.500, 5.000, DATE '2026-01-05', NULL,
   'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE),
  (930000312, 930000101, 930000302, 'algodao', 930000201, NULL,
   12.000, NULL, DATE '2026-01-05', NULL,
   'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE);

INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester,
   kg_pedido, kg_recebido, data_pedido, data_recebimento,
   status, status_administrativo, status_aceite, status_recebimento,
   legado_recebimento_automatico)
SELECT
  gs, 930000101, 930000301, 'algodao', 930000201, NULL,
  10.000,
  CASE WHEN cls.status = 'recebido_total' THEN 10.000 ELSE NULL END,
  DATE '2026-01-01',
  CASE WHEN cls.status = 'recebido_total' THEN DATE '2026-02-01' ELSE NULL END,
  cls.status, cls.status_administrativo, 'nao_aplicavel', cls.status_recebimento, FALSE
FROM generate_series(930000313, 930000374) AS gs
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN gs BETWEEN 930000313 AND 930000349 THEN 'emitida' ELSE 'rascunho' END AS status_administrativo,
    CASE
      WHEN gs BETWEEN 930000313 AND 930000322 THEN 'pendente'
      WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido_total'
      WHEN gs BETWEEN 930000350 AND 930000362 THEN 'pendente'
      ELSE 'recebido_total'
    END AS status,
    CASE
      WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido'
      WHEN gs BETWEEN 930000363 AND 930000374 THEN 'recebido'
      ELSE 'nao_recebido'
    END AS status_recebimento
) AS cls;

DO $corpus$
DECLARE v_a int; v_b int; v_c int; v_d int; v_tot int;
BEGIN
  SELECT count(*) FILTER (WHERE status_administrativo='emitida'  AND status='recebido_total'),
         count(*) FILTER (WHERE status_administrativo='emitida'  AND status='pendente'),
         count(*) FILTER (WHERE status_administrativo='rascunho' AND status='pendente'),
         count(*) FILTER (WHERE status_administrativo='rascunho' AND status='recebido_total'),
         count(*)
    INTO v_a, v_b, v_c, v_d, v_tot FROM public.ordens_compra_fio;
  IF v_tot <> 64 OR v_a <> 27 OR v_b <> 12 OR v_c <> 13 OR v_d <> 12 THEN
    RAISE EXCEPTION 'C3D corpus mismatch: total=%, A=%, B=%, C=%, D=% (expected 64/27/12/13/12)', v_tot, v_a, v_b, v_c, v_d;
  END IF;
END
$corpus$;
`;

// ---------------------------------------------------------------------------
// Shared actor fixture. Four synthetic identities, no real business data.
// ---------------------------------------------------------------------------
export const ACTORS_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${ADMIN_UUID}',    'p1-admin@example.invalid'),
  ('${ADMIN2_UUID}',   'p1-admin2@example.invalid'),
  ('${NONADMIN_UUID}', 'p1-user@example.invalid'),
  ('${FORNUSER_UUID}', 'p1-fornecedor@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, nome) VALUES (930000602, 'P1 Cliente Ator')
  ON CONFLICT (id) DO NOTHING;

-- usuarios_tipo_check (db/14) admits exactly admin|fornecedor|cliente, so the
-- "authenticated non-admin" negative actor is a cliente and the supplier actor
-- is bound to the corpus supplier 930000301.
INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, cliente_id, ativo, nivel_acesso) VALUES
  ('${ADMIN_UUID}',    'p1-admin@example.invalid',      'P1 Admin',     'admin',      NULL,      NULL,      TRUE, 'completo'),
  ('${ADMIN2_UUID}',   'p1-admin2@example.invalid',     'P1 Admin 2',   'admin',      NULL,      NULL,      TRUE, 'completo'),
  ('${NONADMIN_UUID}', 'p1-user@example.invalid',       'P1 Nao Admin', 'cliente',    NULL,      930000602, TRUE, 'completo'),
  ('${FORNUSER_UUID}', 'p1-fornecedor@example.invalid', 'P1 Fornec',    'fornecedor', 930000301, NULL,      TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
`;

// ---------------------------------------------------------------------------
// psql plumbing
// ---------------------------------------------------------------------------
export function psqlBinary(handle) {
  return path.join(handle.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
}

export function baseArgs(handle) {
  return ['-X', '-w', '-q', '-A', '-t', '-h', handle.host, '-p', String(handle.port),
    '-U', handle.user, '-d', handle.database];
}

export function applyFile(handle, file, label, { expectFailure = false, timeout = 300000 } = {}) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout,
  });
  const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
  if (expectFailure) {
    if (result.status === 0) throw new Error(`EXPECTED_FAILURE_BUT_SUCCEEDED (${label})`);
    return diag;
  }
  if (result.status !== 0) throw new Error(`APPLY_FAILED (${label}): ${diag}`);
  return (result.stdout || '') + (result.stderr || '');
}

export function scalar(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 120000,
  });
  if (result.status !== 0) {
    throw new Error(`QUERY_FAILED: ${result.stderr || result.stdout || result.status}\n${sql}`);
  }
  return (result.stdout || '').trim();
}

// Runs `sql` and returns {ok, out}. Never throws on a SQL error: used for the
// negative security proofs, where the refusal IS the expected result.
export function tryQuery(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 120000,
  });
  return {
    ok: result.status === 0,
    out: ((result.stdout || '') + (result.stderr || '')).trim(),
  };
}

export function openSession(handle) {
  const child = spawn(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=0'],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  const s = { out: '', err: '', child };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => { s.out += d; });
  child.stderr.on('data', (d) => { s.err += d; });
  // A session that is .kill()ed for a disconnect proof rejects its completion
  // promise; swallow it so Node does not crash on an unhandled rejection.
  child.on('error', () => {});
  s.send = (sql) => { try { child.stdin.write(sql + '\n'); } catch { /* closed */ } };
  s.all = () => s.out + s.err;
  s.close = () => { try { child.stdin.end(); } catch { /* already closed */ } };
  s.kill = () => { try { child.kill(); } catch { /* already gone */ } };
  return s;
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(pred, timeoutMs, stepMs = 200) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await delay(stepMs);
  }
  return pred();
}

export async function writeTemp(dir, name, sql) {
  const file = path.join(dir, name);
  await writeFile(file, sql, 'utf8');
  return file;
}

export function log(tag, obj) {
  const body = obj && typeof obj === 'object'
    ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('|')
    : String(obj ?? '');
  console.log(body ? `${tag}|${body}` : tag);
}

// ---------------------------------------------------------------------------
// Migration manifest
// ---------------------------------------------------------------------------
export async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

export function p1Files(manifest) {
  return P1_MIGRATIONS.map((n) => {
    const hit = manifest.find((m) => m.n === n);
    if (!hit) throw new Error(`P1_MIGRATION_MISSING: db/${n}`);
    return hit;
  });
}

// ---------------------------------------------------------------------------
// Baseline reconstruction: preamble + db/01..66 + corpus + db/67..100
// ---------------------------------------------------------------------------
export async function reconstructBaseline(handle, scratchDir, { applyP1 = false } = {}) {
  const manifest = await resolveManifest();
  const baseline = manifest.filter((m) => m.n <= 100);
  const terminal = baseline[baseline.length - 1];
  if (terminal.n !== 100) throw new Error(`baseline terminal must be db/100, got db/${terminal.n}`);

  const preambleFile = await writeTemp(scratchDir, 'preamble.sql', PREAMBLE_SQL);
  const corpusFile = await writeTemp(scratchDir, 'corpus.sql', CORPUS_SQL);
  const actorsFile = await writeTemp(scratchDir, 'actors.sql', ACTORS_SQL);

  applyFile(handle, preambleFile, 'preamble');
  for (const { n, file } of baseline) {
    applyFile(handle, file, path.basename(file));
    if (n === 66) applyFile(handle, corpusFile, 'corpus (after db/66, before db/67)');
  }

  const shape = scalar(handle, `
    SELECT (SELECT count(*) FROM public.ordens_compra_fio) || '/' ||
           (SELECT count(*) FROM public.necessidade_compra_fio) || '/' ||
           (SELECT count(*) FROM public.ordem_compra) || '/' ||
           (SELECT count(*) FROM public.ordem_compra_item) || '/' ||
           (SELECT count(*) FROM public.ordem_compra_item_alocacao);`);
  if (shape !== '64/64/51/51/51') {
    throw new Error(`db/01..100 reconstruction shape unexpected: ${shape}`);
  }

  applyFile(handle, actorsFile, 'actors');

  const applied = [];
  if (applyP1) {
    for (const { n, file } of p1Files(manifest)) {
      applyFile(handle, file, `db/${n}`);
      applied.push(n);
    }
  }

  return { manifest, baseline, shape, p1Applied: applied };
}

// Brings up a cluster, reconstructs the baseline and (optionally) applies P1.
export async function bootP1Cluster({ applyP1 = true } = {}) {
  const handle = await bootstrapCluster({});
  return { handle, applyP1 };
}

export { bootstrapCluster };
