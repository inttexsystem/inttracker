// tests/p5-cutover-rehearsal.integration.mjs
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P5-CUTOVER-R1 — focused P5 rehearsal.
//
// Proves the CURRENT repository (db/112) against the CURRENT fresh backup
// position (the retained LR-12 capture), which is the exact byte image of
// production at the moment P5 runs. A migration-reconstructed cluster is a
// weaker proxy: this restores the real artifact instead.
//
// It drives the WHOLE accepted P5 state machine of
// PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md 9.9.G:
//
//   fence_and_snapshot -> lock_import_resources -> assert_snapshot_and_live
//   -> import_and_reconcile -> set_canonical_read -> capture_acl_manifest
//   -> close_final_acl -> activate
//
// and then proves the PRE-PONR RECOVERY CONTRACT of 9.9.G.2 is genuinely
// reachable FROM THE POST-ACTIVATION STATE:
//
//   restore_acl_manifest -> purge_generation -> resume_legacy
//
// It NEVER executes a native receipt. The PONR is never crossed: receipt
// reachability is proved from the db/100 read-model predicate, evaluated
// against authoritative state, exactly as the order requires.
//
//   node tests/p5-cutover-rehearsal.integration.mjs <path-to-LR12.dump>

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import { writeTemp, log, REPO_ROOT } from '../scripts/c3d/p1-harness.mjs';

const DUMP = process.argv[2];
if (!DUMP || !fs.existsSync(DUMP)) {
  console.error('P5_FAIL: pass the path to the retained LR-12 .dump file');
  process.exit(1);
}

const PRODUCTION_SYSTEM_IDENTIFIER = '7642734024280108049';
const DB112 = path.join(REPO_ROOT, 'db', '112_cutover_snapshot_completeness_invariant.sql');

// The cutover generation used by the rehearsal. Production uses its own.
const GEN = 20260801;

// Production state at the LR-12 capture, re-proved unchanged before P5.
const AT_CAPTURE = {
  cutover: 'legacy_active/flat/gen=NULL/ponr=NULL/recon=not_started',
  business_rows: '5/36/1/2/0/0',
  saldo_fios_hash: '72c789986ce94c9edfe82fc9916acd76',
  purchase_orders: '105=emitida/nao_aplicavel/false 106=emitida/nao_aplicavel/false',
  ledger_headers_flat: '0/0/0',
};

const ROLE_PREAMBLE = `
DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'anon','authenticated','service_role','authenticator','dashboard_user',
    'pgbouncer','supabase_admin','supabase_auth_admin','supabase_storage_admin',
    'supabase_read_only_user','supabase_realtime_admin','supabase_replication_admin',
    'pgsodium_keyholder','pgsodium_keyiduser','pgsodium_keymaker','pgtle_admin'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;
ALTER ROLE supabase_admin SUPERUSER;
`;

const EXE = process.platform === 'win32' ? '.exe' : '';
const psqlBin = (h) => path.join(h.pgBinDir, `psql${EXE}`);
const restoreBin = (h) => path.join(h.pgBinDir, `pg_restore${EXE}`);
const args = (h) => ['-h', h.host, '-p', String(h.port), '-U', h.user, '-d', h.database];

let failures = 0;
let passes = 0;
function ok(name, cond, detail = '') {
  if (cond) { passes += 1; console.log(`ok - ${name}${detail ? ` (${detail})` : ''}`); }
  else { failures += 1; console.log(`not ok - ${name}${detail ? ` (${detail})` : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, String(actual) === String(expected), `expected ${expected}, got ${actual}`);
}

// PGTZ=UTC is load-bearing: the whole-row fingerprints cast rows to text and a
// timestamptz renders through the session TimeZone. The reference was measured
// under UTC.
function scalar(h, sql) {
  return execFileSync(psqlBin(h), [...args(h), '-X', '-w', '-A', '-t', '-c', sql.replace(/\s+/g, ' ')], {
    encoding: 'utf8', timeout: 120000, env: { ...process.env, PGTZ: 'UTC' },
  }).trim();
}

// One psql invocation == one session, so the session-scoped advisory lock
// taken by acquire_session_lock survives every statement in the script.
function runSession(h, file, label, { expectFailure = false } = {}) {
  const res = spawnSync(psqlBin(h), [...args(h), '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 600000, env: { ...process.env, PGTZ: 'UTC' },
  });
  const okRun = res.status === 0;
  if (!expectFailure && !okRun) {
    console.log(`--- ${label} stderr ---\n${res.stderr}`);
  }
  return { ok: okRun, stdout: res.stdout || '', stderr: res.stderr || '' };
}

const cutover = (h) => scalar(h, `SELECT status||'/'||read_authority||'/gen='||COALESCE(cutover_generation::text,'NULL')
  ||'/ponr='||COALESCE(productive_receipt_started_at::text,'NULL')||'/recon='||reconciliation_status
  FROM public.ordem_compra_cutover WHERE id=1;`);

const businessRows = (h) => scalar(h, `SELECT (SELECT count(*) FROM public.pedidos)||'/'||(SELECT count(*) FROM public.pedido_itens)
  ||'/'||(SELECT count(*) FROM public.ops)||'/'||(SELECT count(*) FROM public.ordem_compra)
  ||'/'||(SELECT count(*) FROM public.ordem_compra_fio_lancamentos)
  ||'/'||(SELECT count(*) FROM public.ordem_compra_recebimentos);`);

const saldoHash = (h) => scalar(h, `SELECT md5(string_agg(t.r,'|')) FROM (SELECT (s.*)::text AS r FROM public.saldo_fios s ORDER BY s.id) t;`);

const purchaseOrders = (h) => scalar(h, `SELECT string_agg(id::text||'='||status_administrativo||'/'||status_aceite
  ||'/'||COALESCE(aceite_exigido_na_emissao::text,'NULL'), ' ' ORDER BY id) FROM public.ordem_compra;`);

const ledgerHeadersFlat = (h) => scalar(h, `SELECT (SELECT count(*) FROM public.ordem_compra_fio_lancamentos)::text||'/'||
  (SELECT count(*) FROM public.ordem_compra_recebimentos)::text||'/'||
  (SELECT count(*) FROM public.ordens_compra_fio)::text;`);

// The db/100 read-model predicate for acoes.receber, evaluated directly.
// This is how receipt reachability is proved WITHOUT executing a receipt.
const receberReachable = (h) => scalar(h, `
  WITH c AS (SELECT COALESCE(status='canonical_active' AND read_authority='canonical', FALSE) AS canonico
             FROM public.ordem_compra_cutover WHERE id=1)
  SELECT string_agg(o.id::text||'='||((SELECT canonico FROM c) AND NOT o.legado
    AND o.status_administrativo='emitida'
    AND o.status_aceite IN ('nao_aplicavel','aceita'))::text, ' ' ORDER BY o.id)
  FROM public.ordem_compra o;`);

async function main() {
  const handle = await bootstrapCluster({});
  const scratch = await mkdtemp(path.join(tmpdir(), 'p5-'));
  log('CLUSTER_UP', { host: handle.host, port: handle.port, pg: handle.pgVersion });

  try {
    // ---- 1. Prove this is NOT production, before any mutation ------------
    const sysid = scalar(handle, 'SELECT system_identifier FROM pg_control_system();');
    if (sysid === PRODUCTION_SYSTEM_IDENTIFIER) {
      throw new Error('P5_ABORT: the rehearsal target reports the PRODUCTION system_identifier');
    }
    log('NOT_PRODUCTION', { rehearsal: sysid, production: PRODUCTION_SYSTEM_IDENTIFIER });

    // ---- 2. Restore the retained LR-12 capture ---------------------------
    execFileSync(psqlBin(handle), [...args(handle), '-X', '-v', 'ON_ERROR_STOP=1', '-c', ROLE_PREAMBLE],
      { encoding: 'utf8', timeout: 120000 });
    const res = spawnSync(restoreBin(handle), [...args(handle), '--no-password', '--jobs=1', DUMP],
      { encoding: 'utf8', timeout: 900000 });
    const errLines = (res.stderr || '').split('\n').filter((l) => /^pg_restore: error:/.test(l));
    const material = errLines.filter((l) =>
      /public\.|supabase_migrations|GRANT|REVOKE|ACL/.test(l)
      && !/extension|pg_graphql|pgjwt|pgsodium|vault|pg_net|pg_cron|supabase_vault|graphql/i.test(l));
    log('RESTORE', { exit: res.status, error_lines: errLines.length, material: material.length });
    ok('restore has no material error', material.length === 0);

    // ---- 3. The restored image IS the current production position --------
    eq('entry cutover state', cutover(handle), AT_CAPTURE.cutover);
    eq('entry business rows', businessRows(handle), AT_CAPTURE.business_rows);
    eq('entry TD1 saldo_fios fingerprint', saldoHash(handle), AT_CAPTURE.saldo_fios_hash);
    eq('entry protected purchase orders', purchaseOrders(handle), AT_CAPTURE.purchase_orders);
    eq('entry ledger/headers/flat', ledgerHeadersFlat(handle), AT_CAPTURE.ledger_headers_flat);
    eq('entry receipt NOT reachable', receberReachable(handle), '105=false 106=false');

    // ---- 4. db/112 is absent, and the frozen constants make P5 impossible -
    eq('db/112 absent: fence still frozen at 51',
      scalar(handle, `SELECT (prosrc LIKE '%v_source_count <> 51%') FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname='ordem_compra_c3c_fence_and_snapshot';`), 't');

    // Prove the defect is REAL on this exact image: fence must refuse now.
    const preFile = await writeTemp(scratch, 'pre112-fence.sql',
      `SELECT public.ordem_compra_c3c_acquire_session_lock(${GEN});
       SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});`);
    const pre = runSession(handle, preFile, 'pre112-fence', { expectFailure: true });
    ok('without db/112 the cutover is structurally unreachable',
      !pre.ok && /snapshot_mapping_count_mismatch/.test(pre.stderr),
      pre.ok ? 'UNEXPECTEDLY SUCCEEDED' : 'snapshot_mapping_count_mismatch');
    eq('failed fence left the cutover untouched', cutover(handle), AT_CAPTURE.cutover);

    // ---- 5. Apply db/112 exactly as committed ----------------------------
    const applied = spawnSync(psqlBin(handle),
      [...args(handle), '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', DB112],
      { encoding: 'utf8', timeout: 300000 });
    if (applied.status !== 0) console.log(`--- db/112 stderr ---\n${applied.stderr}`);
    ok('db/112 applies cleanly on the production image', applied.status === 0);
    eq('db/112 installed: completeness invariant present',
      scalar(handle, `SELECT (prosrc LIKE '%snapshot_unmapped_source_row%') FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname='ordem_compra_c3c_fence_and_snapshot';`), 't');
    eq('db/112 installed: derived import expectations present',
      scalar(handle, `SELECT (prosrc LIKE '%v_expected_headers%') FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname='ordem_compra_c3c_assert_import_reconciled';`), 't');
    eq('db/112 did not touch the cutover row', cutover(handle), AT_CAPTURE.cutover);

    // ---- 6. The accepted P5 state machine, one session -------------------
    const p5 = `\\set ON_ERROR_STOP on
SELECT public.ordem_compra_c3c_acquire_session_lock(${GEN}) AS lock_acquired;
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN}) AS fence_and_snapshot;
SELECT status||'/'||read_authority||'/'||reconciliation_status AS after_fence FROM public.ordem_compra_cutover WHERE id=1;
SELECT public.ordem_compra_c3c_lock_import_resources(${GEN}) AS lock_import;
SELECT public.ordem_compra_c3c_assert_snapshot_and_live(${GEN}) AS assert_snapshot;
SELECT public.ordem_compra_c3c_import_and_reconcile(${GEN}) AS import_and_reconcile;
SELECT status||'/'||read_authority||'/'||reconciliation_status AS after_import FROM public.ordem_compra_cutover WHERE id=1;
SELECT public.ordem_compra_c3c_set_canonical_read(${GEN}) AS set_canonical_read;
SELECT status||'/'||read_authority AS after_canonical_read FROM public.ordem_compra_cutover WHERE id=1;
SELECT public.ordem_compra_c3c_capture_acl_manifest(${GEN}) AS capture_acl_manifest;
SELECT public.ordem_compra_c3c_close_final_acl(${GEN}) AS close_final_acl;
SELECT public.ordem_compra_c3c_activate(${GEN}) AS activate;
SELECT status||'/'||read_authority||'/ponr='||COALESCE(productive_receipt_started_at::text,'NULL') AS terminal FROM public.ordem_compra_cutover WHERE id=1;
SELECT public.ordem_compra_c3c_release_session_lock(${GEN}) AS lock_released;`;
    const p5File = await writeTemp(scratch, 'p5-sequence.sql', p5);
    const p5Run = runSession(handle, p5File, 'p5-sequence');
    ok('the whole P5 sequence completes', p5Run.ok);
    if (p5Run.ok) console.log(p5Run.stdout.trim().split('\n').map((l) => '    ' + l).join('\n'));

    // ---- 7. Terminal state and every protected invariant ------------------
    eq('terminal cutover state', cutover(handle),
      `canonical_active/canonical/gen=${GEN}/ponr=NULL/recon=reconciled`);
    eq('PONR still NULL',
      scalar(handle, 'SELECT productive_receipt_started_at IS NULL FROM public.ordem_compra_cutover WHERE id=1;'), 't');
    eq('final ACL closed',
      scalar(handle, 'SELECT final_acl_closed_at IS NOT NULL FROM public.ordem_compra_cutover WHERE id=1;'), 't');
    eq('zero-row import is still a real transition (snapshot complete)',
      scalar(handle, `SELECT source_snapshot_count::text||'/'||inventory_baseline_count::text
        FROM public.ordem_compra_cutover WHERE id=1;`), '0/5');
    eq('TD1 saldo_fios UNCHANGED by the cutover', saldoHash(handle), AT_CAPTURE.saldo_fios_hash);
    eq('protected purchase orders intact', purchaseOrders(handle), AT_CAPTURE.purchase_orders);
    eq('business rows unchanged', businessRows(handle), AT_CAPTURE.business_rows);
    eq('no receipt fact was created', ledgerHeadersFlat(handle), AT_CAPTURE.ledger_headers_flat);
    eq('no native receipt command exists',
      scalar(handle, `SELECT count(*)::text FROM public.ordem_compra_recebimentos
        WHERE idempotency_namespace='native_receipt_v1';`), '0');
    ok('ACL manifest captured and bound to the generation',
      Number(scalar(handle, `SELECT count(*)::text FROM public.ordem_compra_cutover_acl_manifest
        WHERE cutover_generation=${GEN};`)) > 0,
      scalar(handle, `SELECT count(*)::text FROM public.ordem_compra_cutover_acl_manifest WHERE cutover_generation=${GEN};`));
    eq('manifest carries no foreign generation',
      scalar(handle, `SELECT count(*)::text FROM public.ordem_compra_cutover_acl_manifest
        WHERE cutover_generation<>${GEN};`), '0');

    // ---- 8. Native receipt is REACHABLE, proved without executing one -----
    eq('receipt now reachable by the read-model predicate',
      receberReachable(handle), '105=true 106=true');
    eq('legacy flat authority is closed',
      scalar(handle, `SELECT count(*)::text FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='ordens_compra_fio'
          AND grantee IN ('anon','authenticated','service_role');`), '0');

    // ---- 9. The PRE-PONR RECOVERY CONTRACT, from the activated state ------
    const rec = `\\set ON_ERROR_STOP on
SELECT public.ordem_compra_c3c_acquire_session_lock(${GEN}) AS lock_acquired;
SELECT public.ordem_compra_c3c_restore_acl_manifest(${GEN}) AS restore_acl;
SELECT public.ordem_compra_c3c_purge_generation(${GEN}) AS purge;
SELECT public.ordem_compra_c3c_resume_legacy(${GEN}) AS resume_legacy;
SELECT public.ordem_compra_c3c_release_session_lock(${GEN}) AS lock_released;`;
    const recFile = await writeTemp(scratch, 'p5-recovery.sql', rec);
    const recRun = runSession(handle, recFile, 'p5-recovery');
    ok('pre-PONR recovery completes from the activated state', recRun.ok);
    eq('recovery restored legacy_active/flat', cutover(handle), AT_CAPTURE.cutover);
    eq('recovery restored TD1 saldo_fios', saldoHash(handle), AT_CAPTURE.saldo_fios_hash);
    eq('recovery restored the flat grant', receberReachable(handle), '105=false 106=false');
    eq('recovery left no imported footprint', ledgerHeadersFlat(handle), AT_CAPTURE.ledger_headers_flat);
    eq('recovery re-enabled every receipt-writer guard',
      scalar(handle, `SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace='public'::regnamespace AND t.tgenabled='D'
          AND t.tgname IN ('trg_lancamento_append_only_guard','trg_lancamento_estorno_guard',
            'trg_recebimento_movimento_immutable_guard','trg_recebimento_header_immutable_guard',
            'trg_c3c_command_state_guard');`), '0');
    eq('recovery restored the protected purchase orders', purchaseOrders(handle), AT_CAPTURE.purchase_orders);
  } finally {
    await handle.stop();
    await rm(scratch, { recursive: true, force: true }).catch(() => {});
    log('CLUSTER_DOWN', { result: 'PROVED' });
  }

  log('P5_REHEARSAL', { passes, failures, result: failures === 0 ? 'PASS' : 'FAIL' });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
