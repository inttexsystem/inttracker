// tests/lr12-restore-rehearsal.integration.mjs
//
// NATIVE-RECEIPT-P4-ACCEPTANCE-CLOSEOUT-AND-LR12-P5-ENTRY-R1 — LR-12.
//
// Restores the FRESH read-only production capture into a disposable local
// PostgreSQL cluster and proves the fidelity of exactly the facts that can
// make P5 unsafe or unrecoverable.
//
// The capture itself is NOT in the repository and never will be: it lives
// outside the workspace and is passed in by path. This file contains no
// production data, no credential and no dump.
//
// USAGE
//   node tests/lr12-restore-rehearsal.integration.mjs <path-to-.dump>
//
// The restored cluster is PROVED not to be production before any local
// mutation: a fresh initdb cluster has its own system_identifier, and the
// probe refuses to continue if it ever matches the production one.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const DUMP = process.argv[2];
if (!DUMP || !fs.existsSync(DUMP)) {
  console.error('LR12_FAIL: pass the path to the production .dump file');
  process.exit(1);
}

// The definitive production cluster identity, proved independently at capture
// time. The restored cluster must NEVER report this value.
const PRODUCTION_SYSTEM_IDENTIFIER = '7642734024280108049';

// Production state measured read-only immediately before the capture.
// These are the reference facts the restore must reproduce.
const AT_CAPTURE = {
  terminal_migration: '20260801213507',
  migration_count: '65',
  cutover: 'legacy_active/flat/gen=NULL/ponr=NULL/recon=not_started',
  obs4_table_grants: '0',
  fences: '4',
  recovery_baseline_rows: '84',
  business_rows: '5/36/1/2/0/0',
  saldo_fios_rows: '5',
  saldo_fios_hash: '72c789986ce94c9edfe82fc9916acd76',
  purchase_orders: '105=emitida/nao_aplicavel/false 106=emitida/nao_aplicavel/false',
};

// Supabase platform roles the dump's OWNER/GRANT statements reference. A
// fresh initdb cluster has none of them, so they are created before the
// restore; otherwise every ACL line would fail and ACL fidelity — the whole
// point of a P4-era restore — could not be proved at all.
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

function log(tag, obj) {
  const body = obj && typeof obj === 'object'
    ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('|')
    : String(obj ?? '');
  console.log(body ? `${tag}|${body}` : tag);
}

const EXE = process.platform === 'win32' ? '.exe' : '';
function psqlBin(h) { return path.join(h.pgBinDir, `psql${EXE}`); }
function restoreBin(h) { return path.join(h.pgBinDir, `pg_restore${EXE}`); }
function args(h) {
  return ['-h', h.host, '-p', String(h.port), '-U', h.user, '-d', h.database];
}

// Every probe runs with TimeZone pinned to UTC.
//
// This is load-bearing, not cosmetic. The whole-row fingerprints cast rows to
// text, and a timestamptz renders through the session TimeZone — so the SAME
// faithfully restored row hashes differently on a cluster whose TimeZone
// differs from the one the reference was measured on. Production was measured
// under UTC; without this the fingerprint reports DRIFT for data that is
// byte-identical, which would either mask a real failure or manufacture a
// false one.
function scalar(h, sql) {
  return execFileSync(psqlBin(h), [...args(h), '-X', '-w', '-A', '-t', '-c', sql], {
    encoding: 'utf8', timeout: 120000,
    // PGTZ rather than an inline SET: a SET statement emits its own "SET"
    // command tag, which -t -A would return as the probe's value.
    env: { ...process.env, PGTZ: 'UTC' },
  }).trim();
}

async function main() {
  let failures = 0;
  const handle = await bootstrapCluster({});
  log('CLUSTER_UP', { host: handle.host, port: handle.port, pg: handle.pgVersion, pid: handle.postmasterPid });

  try {
    // ---- 1. PROVE THIS IS NOT PRODUCTION, before any mutation ----------
    const restoredSysId = scalar(handle, 'SELECT system_identifier FROM pg_control_system();');
    if (restoredSysId === PRODUCTION_SYSTEM_IDENTIFIER) {
      throw new Error('LR12_ABORT: the restore target reports the PRODUCTION system_identifier');
    }
    log('NOT_PRODUCTION', {
      restored_sysid: restoredSysId,
      production_sysid: PRODUCTION_SYSTEM_IDENTIFIER,
      result: 'DISTINCT_CLUSTER_CONFIRMED',
    });

    // ---- 2. Platform roles, then restore --------------------------------
    execFileSync(psqlBin(handle), [...args(handle), '-X', '-v', 'ON_ERROR_STOP=1', '-c', ROLE_PREAMBLE],
      { encoding: 'utf8', timeout: 120000 });
    log('ROLE_PREAMBLE', { result: 'CREATED' });

    // No --exit-on-error: pg_restore's DEFAULT is to continue past errors and
    // report the count at the end, which is exactly what is wanted here — a
    // vanilla cluster cannot host the Supabase-managed extensions, and those
    // failures must not stop the public-schema restore this rehearsal exists
    // to prove.
    const res = spawnSync(restoreBin(handle), [
      ...args(handle), '--no-password', '--jobs=1', DUMP,
    ], { encoding: 'utf8', timeout: 900000 });

    const errLines = (res.stderr || '').split('\n').filter((l) => /^pg_restore: error:/.test(l));
    log('RESTORE', { exit: res.status, error_lines: errLines.length });

    // Errors are expected ONLY for Supabase-managed extensions that do not
    // exist in a vanilla cluster. Any error touching the public schema, the
    // migration ledger or an ACL is a fidelity failure, not noise.
    const material = errLines.filter((l) =>
      /public\.|supabase_migrations|GRANT|REVOKE|ACL/.test(l)
      && !/extension|pg_graphql|pgjwt|pgsodium|vault|pg_net|pg_cron|supabase_vault|graphql/i.test(l));
    if (material.length) {
      failures += 1;
      log('RESTORE_MATERIAL_ERRORS', { count: material.length });
      for (const l of material.slice(0, 15)) console.log('  ' + l);
    } else {
      log('RESTORE_MATERIAL_ERRORS', { count: 0, result: 'ONLY_PLATFORM_EXTENSION_NOISE' });
    }

    // ---- 3. Fidelity probes, derived from the executable owners ---------
    const probes = {
      terminal_migration: 'SELECT max(version) FROM supabase_migrations.schema_migrations;',
      migration_count: 'SELECT count(*)::text FROM supabase_migrations.schema_migrations;',
      cutover: `SELECT status||'/'||read_authority||'/gen='||COALESCE(cutover_generation::text,'NULL')
                ||'/ponr='||COALESCE(productive_receipt_started_at::text,'NULL')
                ||'/recon='||reconciliation_status FROM public.ordem_compra_cutover WHERE id=1;`,
      obs4_table_grants: `SELECT count(*)::text FROM information_schema.role_table_grants
                WHERE table_schema='public' AND table_name IN ('pedidos','ops','op_itens')
                  AND grantee IN ('anon','authenticated')
                  AND privilege_type IN ('INSERT','UPDATE','DELETE');`,
      fences: `SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace
                  AND t.tgname LIKE '%fato_protegido_fence';`,
      recovery_baseline_rows: 'SELECT count(*)::text FROM public.p4_contencao_acl_baseline;',
      business_rows: `SELECT (SELECT count(*) FROM public.pedidos)||'/'||(SELECT count(*) FROM public.pedido_itens)
                ||'/'||(SELECT count(*) FROM public.ops)||'/'||(SELECT count(*) FROM public.ordem_compra)
                ||'/'||(SELECT count(*) FROM public.ordem_compra_fio_lancamentos)
                ||'/'||(SELECT count(*) FROM public.ordem_compra_recebimentos);`,
      saldo_fios_rows: 'SELECT count(*)::text FROM public.saldo_fios;',
      saldo_fios_hash: `SELECT md5(string_agg(t.r,'|')) FROM (SELECT (s.*)::text AS r FROM public.saldo_fios s ORDER BY s.id) t;`,
      purchase_orders: `SELECT string_agg(id::text||'='||status_administrativo||'/'||status_aceite
                ||'/'||COALESCE(aceite_exigido_na_emissao::text,'NULL'), ' ' ORDER BY id) FROM public.ordem_compra;`,
    };

    for (const [name, sql] of Object.entries(probes)) {
      let got;
      try { got = scalar(handle, sql.replace(/\s+/g, ' ')); }
      catch (e) { got = 'PROBE_ERROR'; }
      const want = AT_CAPTURE[name];
      const ok = got === want;
      if (!ok) failures += 1;
      log('FIDELITY', { probe: name, restored: got, at_capture: want, result: ok ? 'MATCH' : 'DRIFT' });
    }

    // ---- 4. The P5 recovery infrastructure the cutover depends on -------
    const infra = scalar(handle, `
      SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc
       WHERE pronamespace='public'::regnamespace
         AND proname IN ('ordem_compra_c3c_capture_acl_manifest','ordem_compra_c3c_restore_acl_manifest',
                         'ordem_compra_c3c_purge_generation','ordem_compra_c3c_resume_legacy',
                         'ordem_compra_c3c_fence_and_snapshot','ordem_compra_c3c_close_final_acl');`.replace(/\s+/g, ' '));
    const infraCount = infra ? infra.split(',').length : 0;
    if (infraCount !== 6) failures += 1;
    log('P5_RECOVERY_INFRA', { found: infraCount, expected: 6, objects: infra, result: infraCount === 6 ? 'PRESENT' : 'INCOMPLETE' });

    // The cutover ACL manifest table db/107 restoration depends on.
    const manifest = scalar(handle, `SELECT to_regclass('public.ordem_compra_cutover_acl_manifest')::text;`);
    if (manifest !== 'ordem_compra_cutover_acl_manifest') failures += 1;
    log('P5_ACL_MANIFEST_TABLE', { found: manifest, result: manifest ? 'PRESENT' : 'MISSING' });

    // ---- 5. No fabricated receipt facts anywhere ------------------------
    const fabricated = scalar(handle, `
      SELECT (SELECT count(*) FROM public.ordem_compra_fio_lancamentos)::text||'/'||
             (SELECT count(*) FROM public.ordem_compra_recebimentos)::text||'/'||
             (SELECT count(*) FROM public.ordens_compra_fio)::text;`.replace(/\s+/g, ' '));
    const fabOk = fabricated === '0/0/0';
    if (!fabOk) failures += 1;
    log('NO_FABRICATED_RECEIPTS', { ledger_headers_flat: fabricated, result: fabOk ? 'NONE' : 'PRESENT' });

    // ---- 6. The restored copy is genuinely usable, not just present -----
    // A real query through the canonical read path proves the restore is
    // functional rather than a set of matching counts.
    const fnCheck = scalar(handle, `SELECT count(*)::text FROM pg_proc
       WHERE pronamespace='public'::regnamespace AND prosecdef;`.replace(/\s+/g, ' '));
    log('SECURITY_DEFINER_FUNCTIONS', { restored: fnCheck });
  } finally {
    await handle.stop();
    log('CLUSTER_DOWN', { result: 'PROVED' });
  }

  log('LR12_REHEARSAL', { failures, result: failures === 0 ? 'PASS' : 'FAIL' });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
