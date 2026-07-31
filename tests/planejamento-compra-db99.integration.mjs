// tests/planejamento-compra-db99.integration.mjs
//
// PURCHASE-PLANNING-REFOUNDATION-R1 — disposable-cluster rehearsal for db/99,
// EXTENDED THROUGH db/100 by PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1.
//
// Reconstructs the production purchase schema on a fresh, disposable
// PostgreSQL cluster (Supabase-platform preamble + the classification-faithful
// 64-row corpus + db/01..db/100 in manifest order + synthetic actors), applies
// the terminal migration exactly once with fail-fast semantics, drives the SQL
// assertion suites in tests/planejamento-compra-db99.integration.sql and
// tests/planejamento-compra-db100.integration.sql as a real `authenticated`
// administrator, proves the intended re-apply behaviour, and destroys the
// cluster with the bootstrap's own PID/port/directory proof.
//
// db/100 SCOPE. The post-generation lifecycle suite proves cancellation
// (rascunho and emitida), the immediate and STRUCTURALLY irrepeatable balance
// release, permanent deletion branched by lifecycle state, the receipt-cutover
// gate on acoes.receber, and the ACL posture. db/99's own suite and its three
// concurrency proofs run first and unchanged, so db/100 is measured against a
// cluster that already carries the accepted db/99 behaviour.
//
// Out of scope by design: no remote host, no managed backend, no credential,
// no repository write, no production contact of any kind.
//
// Run: node tests/planejamento-compra-db99.integration.mjs

import { spawnSync, spawn } from 'node:child_process';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_UUID = '9d1f0000-0000-4000-8000-00000000ad01';
const FORN_POLI_A = 930000401;
const FORN_POLI_B = 930000402;
const FORN_ALGO_A = 930000301; // from the C3D corpus
const PEDIDO_UUID = '9d1f0000-0000-4000-8000-00000000ed01';
const CLIENTE_ID = 930000601;

// ---------------------------------------------------------------------------
// Embedded SQL — identical preamble and corpus contract as the accepted C3D
// harness, so this rehearsal reproduces the same schema the production catalog
// was directly inspected to carry.
// ---------------------------------------------------------------------------
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

const CORPUS_SQL = `
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

// Native planning fixture: one admin actor, two poliester suppliers, one
// Pedido carrying a commercial number and year, and three native
// Pedido-origin needs. Planted under session_replication_role=replica so the
// identity/setup rows do not run business triggers; every row asserted on
// later is created through the real RPCs.
const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${ADMIN_UUID}', 'db99-admin@example.invalid')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, cliente_id, ativo, nivel_acesso) VALUES
  ('${ADMIN_UUID}', 'db99-admin@example.invalid', 'DB99 Admin', 'admin', NULL, NULL, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_POLI_A}, 'DB99-FORN-POLI-A', 'fio_poliester'),
  (${FORN_POLI_B}, 'DB99-FORN-POLI-B', 'fio_poliester')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, nome)
  VALUES (${CLIENTE_ID}, 'DB99 Cliente')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, criado_em)
  VALUES ('${PEDIDO_UUID}', ${CLIENTE_ID}, 7, DATE '2026-03-10', now())
  ON CONFLICT (id) DO NOTHING;

-- A real lote/OP chain for the OP-origin need, so the need-ownership guard
-- (db/67) and the allocation-origin guard (db/74) both resolve truthfully
-- rather than being dodged.
INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
  VALUES (930000701, 930701, ${CLIENTE_ID}, '${PEDIDO_UUID}')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano, lote_id)
  VALUES (930000102, 990002, 2099, 930000701),
         (930000103, 990003, 2099, 930000701),
         (930000104, 990004, 2099, 930000701)
  ON CONFLICT (id) DO NOTHING;

-- Three native needs. Poliester is capped at one row per (pedido, colour) by
-- necessidade_native_poliester, so the third need is the OP-origin cotton
-- case — which is also the shape that carries real OP provenance.
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester,
   kg_necessario, kg_alocado, legado)
VALUES
  (930000501, '${PEDIDO_UUID}', 'pedido', NULL,      'poliester', NULL,      'PRETO',  100.000, 0, FALSE),
  (930000502, '${PEDIDO_UUID}', 'pedido', NULL,      'poliester', NULL,      'BRANCO',  60.000, 0, FALSE),
  (930000503, '${PEDIDO_UUID}', 'op',     930000102, 'algodao',   930000201, NULL,      40.000, 0, FALSE),
  -- A 1,000 kg cotton need reserved for the C1 corrections: atomic card
  -- replacement, repeated supplier after generation, and deletion merge.
  (930000504, '${PEDIDO_UUID}', 'op',     930000103, 'algodao',   930000201, NULL,    1000.000, 0, FALSE),
  -- A second 1,000 kg cotton need, reserved for the deletion release/merge
  -- proof so it does not collide with the issued documents left by W.
  (930000505, '${PEDIDO_UUID}', 'op',     930000104, 'algodao',   930000201, NULL,    1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
`;

// db/100 fixture: six more cotton suppliers and seven more 1,000 kg cotton
// needs, one per section of the post-generation lifecycle suite. Each section
// owns its own supplier so that db/67's `ordem_compra_um_rascunho_ativo`
// (one live draft per Pedido+supplier) never refuses a generation for a
// reason unrelated to what is under test. Every need takes its own OP, because
// `necessidade_native_algodao` is unique on (pedido, OP, colour).
const DB100_FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (930000303, 'DB100-FORN-AB', 'fio_algodao'),
  (930000304, 'DB100-FORN-AD', 'fio_algodao'),
  (930000305, 'DB100-FORN-AE1', 'fio_algodao'),
  (930000306, 'DB100-FORN-AE2', 'fio_algodao'),
  (930000307, 'DB100-FORN-AF', 'fio_algodao'),
  (930000308, 'DB100-FORN-AH', 'fio_algodao')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, lote_id) VALUES
  (930000110, 990010, 2099, 930000701),
  (930000111, 990011, 2099, 930000701),
  (930000112, 990012, 2099, 930000701),
  (930000113, 990013, 2099, 930000701),
  (930000114, 990014, 2099, 930000701),
  (930000115, 990015, 2099, 930000701),
  (930000116, 990016, 2099, 930000701)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester,
   kg_necessario, kg_alocado, legado)
VALUES
  (930000901, '${PEDIDO_UUID}', 'op', 930000110, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000902, '${PEDIDO_UUID}', 'op', 930000111, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000903, '${PEDIDO_UUID}', 'op', 930000112, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000904, '${PEDIDO_UUID}', 'op', 930000113, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000905, '${PEDIDO_UUID}', 'op', 930000114, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000906, '${PEDIDO_UUID}', 'op', 930000115, 'algodao', 930000201, NULL, 1000.000, 0, FALSE),
  (930000907, '${PEDIDO_UUID}', 'op', 930000116, 'algodao', 930000201, NULL, 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
`;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function log(tag, obj) {
  const body = obj && typeof obj === 'object'
    ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('|')
    : String(obj ?? '');
  console.log(body ? `${tag}|${body}` : tag);
}

function psqlBinary(handle) {
  return path.join(handle.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
}

function baseArgs(handle) {
  return ['-X', '-w', '-q', '-A', '-t', '-h', handle.host, '-p', String(handle.port),
    '-U', handle.user, '-d', handle.database];
}

function applyFile(handle, file, label, { expectFailure = false } = {}) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 180000,
  });
  const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
  if (expectFailure) {
    if (result.status === 0) throw new Error(`EXPECTED_FAILURE_BUT_SUCCEEDED (${label})`);
    return diag;
  }
  if (result.status !== 0) throw new Error(`APPLY_FAILED (${label}): ${diag}`);
  return result.stdout || '';
}

// ---------------------------------------------------------------------------
// Long-lived interactive psql session, for the two-session concurrency proof.
// A single applyFile()/scalar() call cannot express it: the lock-order defect
// only appears when one transaction HOLDS a lock across statements while a
// second transaction runs the real RPC.
// ---------------------------------------------------------------------------
function openSession(handle) {
  const child = spawn(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=0'],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  const s = { out: '', err: '', child };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => { s.out += d; });
  child.stderr.on('data', (d) => { s.err += d; });
  s.send = (sql) => child.stdin.write(sql + '\n');
  s.all = () => s.out + s.err;
  s.close = () => { try { child.stdin.end(); } catch { /* already closed */ } };
  s.kill = () => { try { child.kill(); } catch { /* already gone */ } };
  return s;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Waits for `pred` to hold, up to timeoutMs. Returns whether it held. Every
// wait in the concurrency proof is bounded, so a blocking regression FAILS
// instead of hanging the suite.
async function waitFor(pred, timeoutMs, stepMs = 200) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await delay(stepMs);
  }
  return pred();
}

function scalar(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 60000,
  });
  if (result.status !== 0) {
    throw new Error(`QUERY_FAILED: ${result.stderr || result.stdout || result.status}\n${sql}`);
  }
  return (result.stdout || '').trim();
}

async function writeTemp(dir, name, sql) {
  const file = path.join(dir, name);
  await writeFile(file, sql, 'utf8');
  return file;
}

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let failures = 0;
  const handle = await bootstrapCluster({});
  log('CLUSTER_UP', { host: handle.host, port: handle.port, pg: handle.pgVersion, pid: handle.postmasterPid });

  let scratchDir = null;
  try {
    scratchDir = await mkdtemp(path.join(tmpdir(), 'db99-rehearsal-'));

    // This rehearsal is scoped to the db/99 + db/100 baseline. The P1
    // additive backend (db/101..db/109) is applied by its own suite,
    // tests/p1-additive-backend.integration.mjs, and must not shift this
    // one's terminal.
    const manifest = (await resolveManifest()).filter((m) => m.n <= 100);
    const terminal = manifest[manifest.length - 1];
    if (terminal.n !== 100) throw new Error(`manifest terminal must be db/100, got db/${terminal.n}`);
    log('MANIFEST', { count: manifest.length, terminal: path.basename(terminal.file) });

    const preambleFile = await writeTemp(scratchDir, 'preamble.sql', PREAMBLE_SQL);
    const corpusFile = await writeTemp(scratchDir, 'corpus.sql', CORPUS_SQL);
    const fixtureFile = await writeTemp(scratchDir, 'fixture.sql', FIXTURE_SQL);

    // --- Reconstruction: preamble + db/01..66 + corpus + db/67..99 ----------
    // The TERMINAL migration is applied separately, below, fail-fast.
    applyFile(handle, preambleFile, 'preamble');
    for (const { n, file } of manifest) {
      if (n === terminal.n) continue;
      applyFile(handle, file, path.basename(file));
      if (n === 66) applyFile(handle, corpusFile, 'corpus (after db/66, before db/67)');
    }

    const preShape = scalar(handle, `
      SELECT (SELECT count(*) FROM public.ordens_compra_fio) || '/' ||
             (SELECT count(*) FROM public.necessidade_compra_fio) || '/' ||
             (SELECT count(*) FROM public.ordem_compra) || '/' ||
             (SELECT count(*) FROM public.ordem_compra_item) || '/' ||
             (SELECT count(*) FROM public.ordem_compra_item_alocacao);`);
    if (preShape !== '64/64/51/51/51') {
      throw new Error(`db/01..99 reconstruction shape unexpected: ${preShape}`);
    }
    log('RECONSTRUCTED', { through: 'db/99', shape: preShape });

    // --- terminal migration applied exactly once, fail-fast -----------------
    // db/100's section 12 invariant block runs INSIDE this transaction and
    // includes a zero-drift assertion: every need cache must already agree
    // with the canonical coverage definition. A reconstruction that had
    // drifted would abort here instead of being silently corrected.
    applyFile(handle, terminal.file, 'db/100');
    log('DB100_APPLIED', { file: path.basename(terminal.file), attempt: 1 });

    // --- Fixture + assertion suite -----------------------------------------
    applyFile(handle, fixtureFile, 'fixture');
    const assertionFile = path.join(HERE, 'planejamento-compra-db99.integration.sql');
    const out = applyFile(handle, assertionFile, 'assertions');
    process.stdout.write(out);
    if (!out.includes('DB99_PLANEJAMENTO_INTEGRATION_PASS')) {
      failures += 1;
      log('ASSERTIONS', { result: 'MARKER_MISSING' });
    } else {
      log('ASSERTIONS', { result: 'PASS' });
    }

    // --- Two-session concurrency proof (C2) ---------------------------------
    // Regression guard for the CONFIRMED lock-order inversion: planning
    // writers took necessidade_compra_fio then the planning rows, while
    // generation took the planning rows first and only reached the need row
    // indirectly, through db/67's trg_alocacao_kg_alocado_cache. Two sessions
    // closed a cycle and PostgreSQL aborted one with SQLSTATE 40P01 — a raw
    // error escaping these RPCs' JSON refusal contract.
    //
    // Session A holds exactly the lock the planning writers acquire first.
    // Session B then runs the REAL generation RPC. With the canonical order in
    // place B must complete without ever waiting on A.
    {
      const CONC_NEED = 930000601;
      const CONC_TIMEOUT_MS = 20000;

      // A dedicated need + one live planning row, created through the real RPC.
      applyFile(handle, await writeTemp(scratchDir, 'conc-fixture.sql', `
SET session_replication_role = replica;
INSERT INTO public.ops (id, numero, ano, lote_id)
  VALUES (930000105, 990005, 2099, 930000701) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
  VALUES (${CONC_NEED}, '${PEDIDO_UUID}', 'op', 930000105, 'algodao', 930000201, NULL, 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
SELECT public.substituir_planejamento_compra_necessidade(${CONC_NEED},
  '[{"fornecedor_id":930000301,"kg":400.000}]'::jsonb, 'conc-setup');
`), 'concurrency fixture');

      // Free the (Pedido, supplier) draft slot so generation is not refused
      // by db/67's ordem_compra_um_rascunho_ativo for an unrelated reason.
      applyFile(handle, await writeTemp(scratchDir, 'conc-slot.sql', `
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
DO $$
DECLARE r RECORD; v JSONB;
BEGIN
  FOR r IN SELECT id FROM public.ordem_compra
            WHERE pedido_id = '${PEDIDO_UUID}' AND legado = FALSE
              AND status_administrativo = 'rascunho'
  LOOP
    v := public.emitir_ordem_compra(r.id);
  END LOOP;
END $$;
`), 'concurrency draft-slot');

      const planId = scalar(handle, `SELECT id FROM public.necessidade_compra_planejamento
        WHERE necessidade_id = ${CONC_NEED} AND gerado_em IS NULL;`);
      const seq = scalar(handle, `SELECT coalesce(max(ultimo_seq),0)+1
        FROM public.pedido_identidade_numeros WHERE pedido_id = '${PEDIDO_UUID}' AND escopo = 'OC';`);
      const totalBefore = scalar(handle, `SELECT coalesce(sum(kg_planejado),0)
        FROM public.necessidade_compra_planejamento WHERE necessidade_id = ${CONC_NEED};`);

      const A = openSession(handle);
      const B = openSession(handle);
      let concFailures = 0;
      try {
        A.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        B.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        await delay(400);

        // 1. Session A takes the need-row lock — the planning writers' FIRST lock.
        A.send(`BEGIN; SELECT id FROM public.necessidade_compra_fio
                 WHERE id = ${CONC_NEED} FOR UPDATE; SELECT 'A_HOLDS_NEED';`);
        const aHolds = await waitFor(() => A.all().includes('A_HOLDS_NEED'), CONC_TIMEOUT_MS);
        if (!aHolds) { concFailures += 1; log('CONC_FAIL', { step: 'A could not take the need lock' }); }

        // 2. Session B runs the REAL generation RPC while A holds that lock.
        //    Under the canonical order B now waits on the NEED row and has NOT
        //    yet locked any planning row. Blocking here is CORRECT: one lock
        //    order means serialisation, not a cycle.
        B.send(`BEGIN; SELECT public.gerar_ordem_compra_do_planejamento(
                  ARRAY[${planId}]::bigint[], 'PC-CONC-C2', ${seq}, 'conc-gen'); SELECT 'B_SETTLED';`);
        await delay(2000);
        const bWaiting = !B.all().includes('B_SETTLED');

        // 3. THE REGRESSION GUARD. A now runs the real card replacement, which
        //    needs the planning rows. Before the fix B already held them and
        //    this closed the cycle, aborting A with SQLSTATE 40P01. With the
        //    canonical order B holds nothing yet, so A must COMPLETE.
        //    A targets a DIFFERENT supplier, so B's selected row is untouched
        //    and both operations can legitimately succeed.
        A.send(`SELECT public.substituir_planejamento_compra_necessidade(${CONC_NEED},
                  '[{"fornecedor_id":930000301,"kg":400.000},{"fornecedor_id":930000302,"kg":100.000}]'::jsonb,
                  'conc-sub'); SELECT 'A_SETTLED';`);
        const aSettled = await waitFor(() => A.all().includes('A_SETTLED'), CONC_TIMEOUT_MS);
        if (!aSettled) { concFailures += 1; log('CONC_FAIL', { step: 'A never completed — the cycle is still present' }); }

        const aOk = /"ok":\s*true/.test(A.all());
        if (!aOk) { concFailures += 1; log('CONC_FAIL', { step: 'A did not return a coherent domain result' }); }

        // 4. A commits and releases; B must then finish on its own.
        A.send('COMMIT; SELECT \'A_COMMITTED\';');
        await waitFor(() => A.all().includes('A_COMMITTED'), CONC_TIMEOUT_MS);
        const bSettled = await waitFor(() => B.all().includes('B_SETTLED'), CONC_TIMEOUT_MS);
        if (!bSettled) { concFailures += 1; log('CONC_FAIL', { step: 'B never settled after A released the need lock' }); }

        // 5. No deadlock and no transport-level failure in either session.
        const deadlock = /deadlock detected|impasse detectado|40P01/i.test(A.all() + B.all());
        const transportFail = /server closed the connection|connection to server|FATAL/i
          .test(A.all() + B.all());
        if (deadlock) { concFailures += 1; log('CONC_FAIL', { step: 'SQLSTATE 40P01 observed' }); }
        if (transportFail) { concFailures += 1; log('CONC_FAIL', { step: 'transport-level failure' }); }

        // 6. B ends in a coherent DOMAIN result — a JSON envelope either way.
        const bJson = /"ok":\s*(true|false)/.test(B.all());
        const bGenerated = /"discriminador":\s*"gerado"/.test(B.all());
        if (!bJson) { concFailures += 1; log('CONC_FAIL', { step: 'B did not return a JSON domain envelope' }); }

        B.send('COMMIT; SELECT \'B_COMMITTED\';');
        await waitFor(() => B.all().includes('B_COMMITTED'), CONC_TIMEOUT_MS);

        log('CONCURRENCY_PROOF', {
          a_held_need_lock: aHolds,
          b_waited_without_holding_planning: bWaiting,
          a_completed_while_b_waited: aSettled,
          a_domain_result_ok: aOk,
          b_settled_after_release: bSettled,
          b_generated: bGenerated,
          deadlock_40P01: deadlock,
          transport_failure: transportFail,
        });
      } finally {
        A.close(); B.close();
        await delay(300);
        A.kill(); B.kill();
      }

      // 6./7./8. No partial state, cap intact, history structurally valid.
      const totalAfter = scalar(handle, `SELECT coalesce(sum(kg_planejado),0)
        FROM public.necessidade_compra_planejamento WHERE necessidade_id = ${CONC_NEED};`);
      const shape = scalar(handle, `SELECT
          count(*) FILTER (WHERE gerado_em IS NULL) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NOT NULL) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NOT NULL AND (alocacao_id IS NULL OR ordem_compra_id IS NULL)) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NULL AND (alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL))
        FROM public.necessidade_compra_planejamento WHERE necessidade_id = ${CONC_NEED};`);
      const overCap = scalar(handle, `SELECT count(*) FROM (
          SELECT p.necessidade_id FROM public.necessidade_compra_planejamento p
            JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
           GROUP BY p.necessidade_id, n.kg_necessario
          HAVING sum(p.kg_planejado) > n.kg_necessario) s;`);

      // A added a 100 kg row for a second supplier and B generated the 400 kg
      // one, so the coherent end state is 1 live + 1 generated at 500 kg —
      // both operations applied in full, neither partially.
      const [live, gen, badGen, badLive] = shape.split('/').map(Number);
      if (Number(totalAfter) !== 500) { concFailures += 1; log('CONC_FAIL', { step: `expected 500.000 kg total, got ${totalAfter} (from ${totalBefore})` }); }
      if (!(live === 1 && gen === 1)) { concFailures += 1; log('CONC_FAIL', { step: `expected 1 live / 1 generated, got ${live}/${gen}` }); }
      if (badGen !== 0 || badLive !== 0) { concFailures += 1; log('CONC_FAIL', { step: 'orphan or half-linked planning row' }); }
      if (Number(overCap) !== 0) { concFailures += 1; log('CONC_FAIL', { step: 'a need is over the cap' }); }

      log('CONCURRENCY_STATE', {
        total_before: totalBefore, total_after: totalAfter,
        live_generated_badgen_badlive: shape, needs_over_cap: overCap,
      });

      if (concFailures > 0) failures += concFailures;
      else log('CONCURRENCY_PROOF', { result: 'PASS' });
    }

    // --- C3 proof A: multi-need quick planning vs generation ----------------
    // DISCRIMINATING ORCHESTRATION. An earlier version of this proof ran the
    // two RPCs sequentially — B committed before A even started — so the old
    // client-ordered implementation would have passed it unchanged. It proved
    // nothing. The two RPCs must genuinely contend for the NEED rows.
    //
    //   corrected code: A sorts, so it waits on LOW while holding NOTHING;
    //                   B (already holding LOW) can still take HIGH and finish.
    //   old code:       A took HIGH first (client order) and then waited on
    //                   LOW, while B waited on HIGH -> SQLSTATE 40P01.
    {
      const T = 20000;
      const N_HI = 930000603;
      const N_LO = 930000602;
      applyFile(handle, await writeTemp(scratchDir, 'c3a.sql', `
SET session_replication_role = replica;
INSERT INTO public.ops (id, numero, ano, lote_id) VALUES
  (930000106, 990006, 2099, 930000701), (930000107, 990007, 2099, 930000701)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
VALUES (${N_LO}, '${PEDIDO_UUID}', 'op', 930000106, 'algodao', 930000201, NULL, 500.000, 0, FALSE),
       (${N_HI}, '${PEDIDO_UUID}', 'op', 930000107, 'algodao', 930000201, NULL, 500.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
-- Live rows for the SAME supplier on BOTH needs, so ONE generation spans both
-- and therefore must acquire both need rows.
SELECT public.substituir_planejamento_compra_necessidade(${N_LO},
  '[{"fornecedor_id":930000301,"kg":200.000}]'::jsonb, 'c3a-setup-lo');
SELECT public.substituir_planejamento_compra_necessidade(${N_HI},
  '[{"fornecedor_id":930000301,"kg":200.000}]'::jsonb, 'c3a-setup-hi');
DO $do$ DECLARE r RECORD; v JSONB; BEGIN
  FOR r IN SELECT id FROM public.ordem_compra WHERE pedido_id='${PEDIDO_UUID}'
            AND legado=FALSE AND status_administrativo='rascunho'
  LOOP v := public.emitir_ordem_compra(r.id); END LOOP; END $do$;
`), 'c3a fixture');

      const planLo = scalar(handle, `SELECT id FROM public.necessidade_compra_planejamento
        WHERE necessidade_id = ${N_LO} AND gerado_em IS NULL;`);
      const planHi = scalar(handle, `SELECT id FROM public.necessidade_compra_planejamento
        WHERE necessidade_id = ${N_HI} AND gerado_em IS NULL;`);
      const seqA = scalar(handle, `SELECT coalesce(max(ultimo_seq),0)+1
        FROM public.pedido_identidade_numeros WHERE pedido_id='${PEDIDO_UUID}' AND escopo='OC';`);

      const A = openSession(handle); const B = openSession(handle);
      let f = 0;
      try {
        A.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        B.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        await delay(400);

        // 1. B holds the LOW-id need — the first need any multi-need operation
        //    must acquire under the canonical ascending order.
        B.send(`BEGIN; SELECT id FROM public.necessidade_compra_fio WHERE id=${N_LO} FOR UPDATE; SELECT 'B_HOLDS_LO';`);
        if (!await waitFor(() => B.all().includes('B_HOLDS_LO'), T)) {
          f += 1; log('C3A_FAIL', { step: 'B could not hold the low-id need' });
        }

        // 2. A starts the REAL quick-planning RPC with input ordered [HIGH, LOW].
        //    It must block — and, critically, must NOT be holding HIGH.
        A.send(`BEGIN; SELECT public.aplicar_planejamento_rapido('${PEDIDO_UUID}', 930000302,
                  '[{"necessidade_id": ${N_HI}, "kg": 50.000}, {"necessidade_id": ${N_LO}, "kg": 50.000}]'::jsonb,
                  'c3a-quick'); SELECT 'A_SETTLED';`);
        await delay(2500);
        const aBlocked = !A.all().includes('A_SETTLED');
        if (!aBlocked) { f += 1; log('C3A_FAIL', { step: 'A did not block — the needs did not actually contend' }); }

        // 3. THE DISCRIMINATOR. B, still holding LOW, runs the REAL generation
        //    over planning rows from BOTH needs, so it must acquire HIGH.
        //    Old code: A owns HIGH -> cycle -> 40P01. Corrected: HIGH is free.
        B.send(`SELECT public.gerar_ordem_compra_do_planejamento(
                  ARRAY[${planLo},${planHi}]::bigint[], 'PC-C3A', ${seqA}, 'c3a-gen'); SELECT 'B_SETTLED';`);
        const bDone = await waitFor(() => B.all().includes('B_SETTLED'), T);
        if (!bDone) { f += 1; log('C3A_FAIL', { step: 'generation never settled while A waited' }); }
        const bOk = /"ok":\s*true/.test(B.all()) && /"discriminador":\s*"gerado"/.test(B.all());
        if (!bOk) { f += 1; log('C3A_FAIL', { step: 'generation returned no coherent success' }); }

        B.send("COMMIT; SELECT 'B_OK';");
        await waitFor(() => B.all().includes('B_OK'), T);

        // 4. A must now unblock and complete on its own.
        const aDone = await waitFor(() => A.all().includes('A_SETTLED'), T);
        if (!aDone) { f += 1; log('C3A_FAIL', { step: 'quick planning never settled after release' }); }
        const aOk = /"ok":\s*true/.test(A.all());
        if (!aOk) { f += 1; log('C3A_FAIL', { step: 'quick planning returned no coherent domain result' }); }
        A.send("COMMIT; SELECT 'A_OK';");
        await waitFor(() => A.all().includes('A_OK'), T);

        const dl = /deadlock detected|impasse detectado|40P01/i.test(A.all() + B.all());
        const tf = /server closed the connection|connection to server|FATAL/i.test(A.all() + B.all());
        if (dl) { f += 1; log('C3A_FAIL', { step: 'SQLSTATE 40P01' }); }
        if (tf) { f += 1; log('C3A_FAIL', { step: 'transport failure' }); }

        log('C3A_QUICK_VS_GEN', {
          b_held_low_need: true, a_blocked_without_holding_high: aBlocked,
          b_generated_across_both_needs: bOk, a_quick_settled_after_release: aDone,
          a_domain_ok: aOk, deadlock_40P01: dl, transport_failure: tf,
        });
      } finally { A.close(); B.close(); await delay(300); A.kill(); B.kill(); }

      // Exact business state: each need keeps 200 generated + 50 live = 250.
      for (const pair of [[N_LO, 'low'], [N_HI, 'high']]) {
        const need = pair[0]; const label = pair[1];
        const gen = scalar(handle, `SELECT coalesce(sum(kg_planejado),0) FROM public.necessidade_compra_planejamento
          WHERE necessidade_id=${need} AND gerado_em IS NOT NULL;`);
        const live = scalar(handle, `SELECT coalesce(sum(kg_planejado),0) FROM public.necessidade_compra_planejamento
          WHERE necessidade_id=${need} AND gerado_em IS NULL;`);
        const liveN = scalar(handle, `SELECT count(*) FROM public.necessidade_compra_planejamento
          WHERE necessidade_id=${need} AND gerado_em IS NULL;`);
        if (Number(gen) !== 200) { f += 1; log('C3A_FAIL', { step: `${label} need generated ${gen}, expected 200.000` }); }
        if (Number(live) !== 50) { f += 1; log('C3A_FAIL', { step: `${label} need live ${live}, expected 50.000` }); }
        if (Number(liveN) !== 1) { f += 1; log('C3A_FAIL', { step: `${label} need has ${liveN} live rows, expected 1` }); }
        log('C3A_NEED_STATE', { need: label, generated: gen, live: live, live_rows: liveN });
      }

      // One document really did span BOTH needs.
      const spanned = scalar(handle, `SELECT count(DISTINCT necessidade_id)
        FROM public.necessidade_compra_planejamento
        WHERE gerado_em IS NOT NULL AND necessidade_id IN (${N_LO},${N_HI});`);
      if (Number(spanned) !== 2) { f += 1; log('C3A_FAIL', { step: `generation covered ${spanned} needs, expected 2` }); }

      const over = scalar(handle, `SELECT count(*) FROM (
        SELECT p.necessidade_id FROM public.necessidade_compra_planejamento p
          JOIN public.necessidade_compra_fio n ON n.id=p.necessidade_id
         WHERE p.necessidade_id IN (${N_LO},${N_HI})
         GROUP BY p.necessidade_id, n.kg_necessario
        HAVING sum(p.kg_planejado) > n.kg_necessario) s;`);
      const dup = scalar(handle, `SELECT count(*) FROM (
        SELECT necessidade_id, fornecedor_id FROM public.necessidade_compra_planejamento
         WHERE gerado_em IS NULL GROUP BY 1,2 HAVING count(*) > 1) s;`);
      const orph = scalar(handle, `SELECT count(*) FROM public.necessidade_compra_planejamento
        WHERE (gerado_em IS NULL AND (alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL))
           OR (gerado_em IS NOT NULL AND (alocacao_id IS NULL OR ordem_compra_id IS NULL));`);
      if (Number(over) !== 0) { f += 1; log('C3A_FAIL', { step: 'need over cap' }); }
      if (Number(dup) !== 0) { f += 1; log('C3A_FAIL', { step: 'duplicate live row' }); }
      if (Number(orph) !== 0) { f += 1; log('C3A_FAIL', { step: 'orphan linkage' }); }
      log('C3A_STATE', { needs_spanned: spanned, needs_over_cap: over, duplicate_live_rows: dup, orphan_links: orph });
      if (f > 0) failures += f; else log('C3A_QUICK_VS_GEN', { result: 'PASS' });
    }


    // --- C3 proof B: eligible deletion vs card replacement -------------------
    // Deletion reached the need row only at the end, through db/67's cache
    // trigger on allocation DELETE, while already holding planning rows. A
    // concurrent card replacement holds the need and wants those planning rows.
    {
      const T = 20000;
      const N_DEL = 930000604;
      applyFile(handle, await writeTemp(scratchDir, 'c3b.sql', `
SET session_replication_role = replica;
INSERT INTO public.ops (id, numero, ano, lote_id) VALUES (930000108, 990008, 2099, 930000701)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
  VALUES (${N_DEL}, '${PEDIDO_UUID}', 'op', 930000108, 'algodao', 930000201, NULL, 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;
SET session_replication_role = origin;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
DO $$ DECLARE r RECORD; v JSONB; BEGIN
  FOR r IN SELECT id FROM public.ordem_compra WHERE pedido_id='${PEDIDO_UUID}'
            AND legado=FALSE AND status_administrativo='rascunho'
  LOOP v := public.emitir_ordem_compra(r.id); END LOOP; END $$;
SELECT public.substituir_planejamento_compra_necessidade(${N_DEL},
  '[{"fornecedor_id":930000301,"kg":300.000}]'::jsonb, 'c3b-setup');
`), 'c3b fixture');

      const planDel = scalar(handle, `SELECT id FROM public.necessidade_compra_planejamento
        WHERE necessidade_id=${N_DEL} AND gerado_em IS NULL;`);
      const seqB = scalar(handle, `SELECT coalesce(max(ultimo_seq),0)+1
        FROM public.pedido_identidade_numeros WHERE pedido_id='${PEDIDO_UUID}' AND escopo='OC';`);
      // Generate, then add a live row for the SAME supplier so deletion must MERGE.
      applyFile(handle, await writeTemp(scratchDir, 'c3b2.sql', `
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
SELECT public.gerar_ordem_compra_do_planejamento(ARRAY[${planDel}]::bigint[], 'PC-C3B', ${seqB}, 'c3b-gen');
SELECT public.substituir_planejamento_compra_necessidade(${N_DEL},
  '[{"fornecedor_id":930000301,"kg":200.000}]'::jsonb, 'c3b-live');
`), 'c3b generate+live');

      const ocDel = scalar(handle, `SELECT ordem_compra_id FROM public.necessidade_compra_planejamento
        WHERE necessidade_id=${N_DEL} AND gerado_em IS NOT NULL LIMIT 1;`);
      const totalBefore = scalar(handle, `SELECT coalesce(sum(kg_planejado),0)
        FROM public.necessidade_compra_planejamento WHERE necessidade_id=${N_DEL};`);

      const A = openSession(handle); const B = openSession(handle);
      let f = 0;
      try {
        A.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        B.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        await delay(400);

        // A holds the need — the card writer's first lock.
        A.send(`BEGIN; SELECT id FROM public.necessidade_compra_fio WHERE id=${N_DEL} FOR UPDATE; SELECT 'A_HOLDS';`);
        if (!await waitFor(() => A.all().includes('A_HOLDS'), T)) { f += 1; log('C3B_FAIL', { step: 'A could not hold the need' }); }

        // B: real deletion. Must now wait on the NEED first, holding no planning row.
        B.send(`BEGIN; SELECT public.excluir_ordem_compra(${ocDel}); SELECT 'B_SETTLED';`);
        await delay(2000);
        const bWaiting = !B.all().includes('B_SETTLED');

        // A: real card replacement must COMPLETE — previously the cycle killed it.
        A.send(`SELECT public.substituir_planejamento_compra_necessidade(${N_DEL},
                  '[{"fornecedor_id":930000301,"kg":250.000}]'::jsonb, 'c3b-sub'); SELECT 'A_SETTLED';`);
        const aDone = await waitFor(() => A.all().includes('A_SETTLED'), T);
        if (!aDone) { f += 1; log('C3B_FAIL', { step: 'replacement never completed — cycle still present' }); }
        const aOk = /"ok":\s*true/.test(A.all());
        if (!aOk) { f += 1; log('C3B_FAIL', { step: 'replacement returned no coherent domain result' }); }
        A.send("COMMIT; SELECT 'A_OK';");
        await waitFor(() => A.all().includes('A_OK'), T);

        const bDone = await waitFor(() => B.all().includes('B_SETTLED'), T);
        if (!bDone) { f += 1; log('C3B_FAIL', { step: 'deletion never settled after release' }); }
        const bJson = /"ok":\s*(true|false)/.test(B.all());
        if (!bJson) { f += 1; log('C3B_FAIL', { step: 'deletion returned no JSON envelope' }); }
        B.send("COMMIT; SELECT 'B_OK';");
        await waitFor(() => B.all().includes('B_OK'), T);

        const dl = /deadlock detected|impasse detectado|40P01/i.test(A.all() + B.all());
        const tf = /server closed the connection|connection to server|FATAL/i.test(A.all() + B.all());
        if (dl) { f += 1; log('C3B_FAIL', { step: 'SQLSTATE 40P01' }); }
        if (tf) { f += 1; log('C3B_FAIL', { step: 'transport failure' }); }
        log('C3B_DELETE_VS_REPLACE', {
          b_waited_on_need_first: bWaiting, a_replacement_completed: aDone, a_domain_ok: aOk,
          b_settled_after_release: bDone, deadlock_40P01: dl, transport_failure: tf,
        });
      } finally { A.close(); B.close(); await delay(300); A.kill(); B.kill(); }

      const shape = scalar(handle, `SELECT
          count(*) FILTER (WHERE gerado_em IS NULL) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NOT NULL) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NULL AND (alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL)) || '/' ||
          count(*) FILTER (WHERE gerado_em IS NOT NULL AND (alocacao_id IS NULL OR ordem_compra_id IS NULL))
        FROM public.necessidade_compra_planejamento WHERE necessidade_id=${N_DEL};`);
      const dup = scalar(handle, `SELECT count(*) FROM (
        SELECT necessidade_id, fornecedor_id FROM public.necessidade_compra_planejamento
         WHERE gerado_em IS NULL AND necessidade_id=${N_DEL} GROUP BY 1,2 HAVING count(*)>1) s;`);
      const over = scalar(handle, `SELECT count(*) FROM (
        SELECT p.necessidade_id FROM public.necessidade_compra_planejamento p
          JOIN public.necessidade_compra_fio n ON n.id=p.necessidade_id
         WHERE p.necessidade_id=${N_DEL} GROUP BY p.necessidade_id, n.kg_necessario
        HAVING sum(p.kg_planejado) > n.kg_necessario) s;`);
      const totalAfter = scalar(handle, `SELECT coalesce(sum(kg_planejado),0)
        FROM public.necessidade_compra_planejamento WHERE necessidade_id=${N_DEL};`);
      const [liveN, genN, badLive, badGen] = shape.split('/').map(Number);
      if (badLive !== 0 || badGen !== 0) { f += 1; log('C3B_FAIL', { step: 'orphan or half-linked planning row' }); }
      if (Number(dup) !== 0) { f += 1; log('C3B_FAIL', { step: 'duplicate live row after merge' }); }
      if (Number(over) !== 0) { f += 1; log('C3B_FAIL', { step: 'need over cap' }); }

      // EXACT final business state. 300 kg of generated history, a live row the
      // replacement moved 200 -> 250, then deletion releases and MERGES the 300
      // into it: one live row at 550 kg, no generated rows, no linkage left.
      const liveKg = scalar(handle, `SELECT coalesce(sum(kg_planejado),0)
        FROM public.necessidade_compra_planejamento WHERE necessidade_id=${N_DEL} AND gerado_em IS NULL;`);
      const linked = scalar(handle, `SELECT count(*) FROM public.necessidade_compra_planejamento
        WHERE necessidade_id=${N_DEL} AND gerado_em IS NULL
          AND (alocacao_id IS NOT NULL OR ordem_compra_id IS NOT NULL);`);
      const ocGone = scalar(handle, `SELECT count(*) FROM public.ordem_compra WHERE id=${ocDel};`);
      const itensGone = scalar(handle, `SELECT count(*) FROM public.ordem_compra_item WHERE ordem_id=${ocDel};`);
      const alocGone = scalar(handle, `SELECT count(*) FROM public.ordem_compra_item_alocacao a
        JOIN public.ordem_compra_item i ON i.id=a.item_id WHERE i.ordem_id=${ocDel};`);

      if (liveN !== 1) { f += 1; log('C3B_FAIL', { step: `expected exactly 1 live row, got ${liveN}` }); }
      if (genN !== 0) { f += 1; log('C3B_FAIL', { step: `expected 0 generated rows, got ${genN}` }); }
      if (Number(liveKg) !== 550) { f += 1; log('C3B_FAIL', { step: `expected 550.000 kg live, got ${liveKg}` }); }
      if (Number(linked) !== 0) { f += 1; log('C3B_FAIL', { step: 'live row still carries alocacao_id/ordem_compra_id' }); }
      if (Number(ocGone) !== 0) { f += 1; log('C3B_FAIL', { step: 'deleted Purchase Order survived' }); }
      if (Number(itensGone) !== 0) { f += 1; log('C3B_FAIL', { step: 'items of the deleted order survived' }); }
      if (Number(alocGone) !== 0) { f += 1; log('C3B_FAIL', { step: 'allocations of the deleted order survived' }); }

      log('C3B_STATE', { live_gen_badlive_badgen: shape, duplicate_live: dup, over_cap: over,
        total_before: totalBefore, total_after: totalAfter });
      log('C3B_FINAL_BUSINESS_STATE', {
        live_rows: liveN, generated_rows: genN, live_kg: liveKg, residual_linkage: linked,
        ordem_compra_rows: ocGone, item_rows: itensGone, alocacao_rows: alocGone,
      });
      if (f > 0) failures += f; else log('C3B_DELETE_VS_REPLACE', { result: 'PASS' });
    }

    // --- db/100 post-generation lifecycle suite -----------------------------
    // Runs LAST among the behavioural suites, on the cluster the accepted
    // db/99 proofs already exercised: its needs, suppliers and documents are
    // dedicated, so it is measured against realistic residue rather than a
    // pristine fixture.
    {
      applyFile(handle, await writeTemp(scratchDir, 'db100-fixture.sql', DB100_FIXTURE_SQL),
        'db/100 fixture');
      const db100File = path.join(HERE, 'planejamento-compra-db100.integration.sql');
      const out100 = applyFile(handle, db100File, 'db/100 assertions');
      process.stdout.write(out100);
      if (!out100.includes('DB100_LIFECYCLE_INTEGRATION_PASS')) {
        failures += 1;
        log('DB100_ASSERTIONS', { result: 'MARKER_MISSING' });
      } else {
        log('DB100_ASSERTIONS', { result: 'PASS' });
      }

      // The suite plants and then reverts a canonical-active cutover fixture.
      // Leaving it active would silently change every later proof, so the
      // restored state is asserted here rather than assumed.
      const cutover = scalar(handle,
        `SELECT status || '/' || read_authority FROM public.ordem_compra_cutover WHERE id = 1;`);
      if (cutover !== 'legacy_active/flat') {
        failures += 1;
        log('DB100_CUTOVER', { result: 'NOT_RESTORED', state: cutover });
      } else {
        log('DB100_CUTOVER', { result: 'legacy_active/flat' });
      }
    }

    // --- Re-apply behaviour -------------------------------------------------
    // This repository's migration convention is re-runnable DDL: every recent
    // migration (db/95..db/99) is written with IF NOT EXISTS / CREATE OR
    // REPLACE / DROP ... IF EXISTS, and db/100 follows it. The proof required
    // here is therefore NOT a refusal — it is that a second application is an
    // exact no-op that leaves the business state byte-identical. A migration
    // that silently DUPLICATED planning rows, re-reserved numbering or
    // recreated documents would fail this.
    const shapeQuery = `
      SELECT (SELECT count(*) FROM public.necessidade_compra_planejamento) || '/' ||
             (SELECT count(*) FROM public.necessidade_compra_planejamento WHERE gerado_em IS NOT NULL) || '/' ||
             (SELECT coalesce(sum(kg_planejado), 0) FROM public.necessidade_compra_planejamento) || '/' ||
             (SELECT count(*) FROM public.ordem_compra WHERE NOT legado) || '/' ||
             (SELECT count(*) FROM public.ordem_compra_item) || '/' ||
             (SELECT count(*) FROM public.ordem_compra_item_alocacao) || '/' ||
             (SELECT coalesce(max(ultimo_seq), 0) FROM public.pedido_identidade_numeros WHERE escopo = 'OC');`;
    const beforeReapply = scalar(handle, shapeQuery);

    const reapply = spawnSync(psqlBinary(handle),
      [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', terminal.file],
      { encoding: 'utf8', timeout: 180000 });
    const reapplyAccepted = reapply.status === 0;
    const afterReapply = scalar(handle, shapeQuery);

    log('DB100_REAPPLY', {
      attempt: 2,
      accepted: reapplyAccepted,
      shape_before: beforeReapply,
      shape_after: afterReapply,
      no_op: beforeReapply === afterReapply,
    });
    if (!reapplyAccepted) {
      failures += 1;
      log('DB100_REAPPLY_DIAGNOSTIC', {
        error: (reapply.stderr || '').split('\n').find((l) => l.includes('ERRO') || l.includes('ERROR')) || 'non-zero exit',
      });
    }
    if (beforeReapply !== afterReapply) {
      failures += 1;
      log('DB100_REAPPLY_DIAGNOSTIC', { drift: `${beforeReapply} -> ${afterReapply}` });
    }
  } catch (err) {
    failures += 1;
    console.error(`REHEARSAL_ERROR: ${err.stack || err.message}`);
  } finally {
    if (scratchDir) await rm(scratchDir, { recursive: true, force: true }).catch(() => {});
    const proof = await handle.stop();
    log('CLUSTER_DESTROYED', {
      stop_ok: proof.stopResult && proof.stopResult.ok,
      port_closed: proof.portClosed,
      pid_absent: proof.pidAbsent,
      dir_absent: proof.dirAbsent,
    });
  }

  if (failures > 0) {
    console.error(`DB100_REHEARSAL_FAIL: ${failures} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('DB100_REHEARSAL_PASS');
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
