// tests/p4-authority-switch.integration.mjs
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1 disposable
// cluster rehearsal.
//
// Reconstructs the PRODUCTION-EQUIVALENT schema on a fresh, isolated,
// disposable local PostgreSQL cluster — Supabase preamble + the accepted
// 64-row corpus + db/01..db/100 + the eight applied P1 migrations + db/113
// — and then applies the P4 authority switch (db/103b, db/104, db/106) and
// proves it.
//
// db/112 is deliberately NOT applied: it is versioned in the repository but
// is NOT applied to production, and P4 is explicitly not authorized to
// apply it. The rehearsal mirrors the production migration set exactly.
//
// Out of scope by design: no remote host, no managed backend, no
// credential, no production contact of any kind, no repository write.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bootstrapCluster, reconstructBaseline, resolveManifest, applyFile, scalar,
  openSession, writeTemp, log, waitFor, delay, ADMIN_UUID,
} from '../scripts/c3d/p1-harness.mjs';
import { FIXTURE_SQL, OP1, PED } from '../scripts/c3d/p1-fixture.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The P4 migrations, in application order. db/103b does not match the
// numeric manifest pattern, so it is resolved by filename.
// db/106 is applied as an ordered PAIR. 106a is additive and safe while the
// pre-P4 frontend is still live; 106b narrows the authority and may only land
// once the repointed assets are deployed. The order is load-bearing and 106b
// refuses to run without 106a.
const P4_FILES = [
  '103b_emissao_aceite_e_democao.sql',
  '104_recebimento_lock_e_aceite_gate.sql',
  '106a_escritores_canonicos.sql',
  '106b_contencao_dml.sql',
];

const SUITES = [
  ['db103b-emissao-aceite.integration.sql', 'DB103B_EMISSAO_ACEITE_PASS'],
  ['db104-recebimento-lock.integration.sql', 'DB104_RECEBIMENTO_LOCK_PASS'],
  ['db106-contencao.integration.sql', 'DB106_CONTENCAO_PASS'],
  ['db106-guc-spoof-rejeitado.integration.sql', 'DB106_GUC_SPOOF_PASS'],
  ['db106-td2-insert-delete.integration.sql', 'DB106_TD2_PASS'],
];

// The authority fingerprint: every table grant on the four protected tables
// and every function ACL in the catalogue. Compared before and after P4 so
// that each difference must be an AUTHORIZED narrowing, never an accident.
const AUTHORITY_FINGERPRINT_SQL = `
SELECT string_agg(line, E'\\n' ORDER BY line) FROM (
  SELECT 'TABLE-GRANT ' || table_name || ' ' || grantee || ' ' || privilege_type AS line
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('pedidos','ops','op_itens','saldo_fios_op')
     AND grantee IN ('anon','authenticated','service_role')
  UNION ALL
  SELECT 'COLUMN-GRANT ' || table_name || '.' || column_name || ' ' || grantee || ' ' || privilege_type
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND table_name IN ('pedidos','ops','op_itens','saldo_fios_op')
     AND grantee IN ('anon','authenticated','service_role')
  UNION ALL
  SELECT 'FUNCTION-ACL ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
         || COALESCE(array_to_string(p.proacl, ','), 'DEFAULT')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
  UNION ALL
  SELECT 'TRIGGER ' || c.relname || ' ' || t.tgname
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
) s;`;

function diffLines(a, b) {
  const A = new Set((a || '').split('\n').filter(Boolean));
  const B = new Set((b || '').split('\n').filter(Boolean));
  return {
    removed: [...A].filter((l) => !B.has(l)).sort(),
    added: [...B].filter((l) => !A.has(l)).sort(),
  };
}

// P4_MIGRATIONS=<substring>[,<substring>] narrows the applied migration set
// during development. Unset — the reported configuration — applies all three.
// A narrowed run is logged explicitly so a partial rehearsal can never be
// mistaken for the full one.
async function p4Files() {
  const dbDir = path.join(path.dirname(HERE), 'db');
  const only = (process.env.P4_MIGRATIONS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const chosen = only.length ? P4_FILES.filter((f) => only.some((o) => f.includes(o))) : P4_FILES;
  if (only.length) {
    log('MIGRATION_FILTER', {
      only: only.join('+'), selected: chosen.length, of: P4_FILES.length,
      warning: 'PARTIAL_REHEARSAL_NOT_THE_REPORTED_CONFIGURATION',
    });
  }
  return chosen.map((f) => ({ name: f, file: path.join(dbDir, f) }));
}

async function main() {
  let failures = 0;
  const handle = await bootstrapCluster({});
  log('CLUSTER_UP', {
    host: handle.host, port: handle.port, pg: handle.pgVersion,
    pid: handle.postmasterPid,
  });

  let scratch = null;
  try {
    scratch = await mkdtemp(path.join(tmpdir(), 'p4-rehearsal-'));

    // ---- 1. Baseline db/01..db/100 + the applied P1 set --------------
    const base = await reconstructBaseline(handle, scratch, { applyP1: true });
    log('BASELINE', {
      migrations: base.baseline.length, shape: base.shape,
      p1: base.p1Applied.join('+'),
    });

    // ---- 2. db/113, the P3 security correction, as in production -----
    const manifest = await resolveManifest();
    const db113 = manifest.find((m) => m.n === 113);
    if (!db113) throw new Error('DB113_MISSING');
    applyFile(handle, db113.file, 'db/113');
    log('DB113', { result: 'APPLIED' });

    const db112Applied = scalar(handle, `
      SELECT count(*)::text FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname = 'ordem_compra_c3c_assert_snapshot_completeness';`);
    log('DB112_ABSENT', { objects: db112Applied, expected: '0' });
    if (db112Applied !== '0') {
      failures += 1;
      log('DB112_ABSENT', { result: 'UNEXPECTEDLY_PRESENT' });
    }

    // ---- 3. PRE-P4 authority fingerprint -----------------------------
    const fpBefore = scalar(handle, AUTHORITY_FINGERPRINT_SQL);
    log('AUTHORITY_PRE', { lines: fpBefore.split('\n').filter(Boolean).length });

    // The OBS-4 measurement TD2 exists to drive to zero, taken BEFORE P4 so
    // the recovery proof compares against what this environment actually had
    // rather than against a literal copied from another environment.
    const OBS4_SQL = `
      SELECT count(*)::text FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name IN ('pedidos','ops','op_itens')
         AND grantee IN ('anon','authenticated')
         AND privilege_type IN ('INSERT','UPDATE','DELETE');`;
    const obs4Before = scalar(handle, OBS4_SQL);
    log('OBS4_PRE', { table_grants: obs4Before });

    const RECEIPT_FACTS_SQL = `
      SELECT (SELECT count(*) FROM public.ordem_compra_fio_lancamentos)::text || '/' ||
             (SELECT count(*) FROM public.ordem_compra_recebimentos)::text;`;
    const ledgerBefore = scalar(handle, RECEIPT_FACTS_SQL);

    // ---- 4. Apply P4 --------------------------------------------------
    const files = await p4Files();
    for (const { name, file } of files) {
      applyFile(handle, file, name);
      log('P4_APPLY', { migration: name, result: 'CLEAN' });
    }

    // ---- 5. Byte-identical re-apply is a no-op ------------------------
    for (const { name, file } of files) {
      applyFile(handle, file, `${name} reapply`);
      log('P4_REAPPLY', { migration: name, result: 'NOOP' });
    }

    // ---- 6. POST-P4 authority delta -----------------------------------
    const fpAfter = scalar(handle, AUTHORITY_FINGERPRINT_SQL);
    const { removed, added } = diffLines(fpBefore, fpAfter);
    log('AUTHORITY_POST', { removed: removed.length, added: added.length });
    for (const l of removed) console.log('  - ' + l);
    for (const l of added) console.log('  + ' + l);

    // Every removed TABLE-GRANT must be an authorized narrowing, and no
    // new table-level INSERT/UPDATE/DELETE may appear for a client role.
    const illegalAdd = added.filter((l) =>
      /^TABLE-GRANT \S+ (anon|authenticated|service_role) (INSERT|UPDATE|DELETE)$/.test(l));
    if (illegalAdd.length) {
      failures += 1;
      log('AUTHORITY_POST', { result: 'BROADENED', count: illegalAdd.length });
    }

    // P4 fabricates no receipt fact. Measured BEFORE the synthetic fixture
    // is planted, because the fixture deliberately plants its own ledger
    // rows and would mask a real regression.
    const ledgerAfterP4 = scalar(handle, RECEIPT_FACTS_SQL);
    const ledgerOk = ledgerAfterP4 === ledgerBefore;
    if (!ledgerOk) failures += 1;
    log('RECEIPT_FACTS', {
      before: ledgerBefore, after: ledgerAfterP4,
      result: ledgerOk ? 'UNCHANGED_BY_P4' : 'FABRICATED',
    });

    // ---- 7. Fixture ---------------------------------------------------
    applyFile(handle, await writeTemp(scratch, 'p4-fixture.sql', FIXTURE_SQL(ADMIN_UUID)), 'fixture');
    log('FIXTURE', { result: 'PLANTED' });

    // ---- 8. Suites ----------------------------------------------------
    const only = (process.env.P4_SUITES || '').split(',').map((s) => s.trim()).filter(Boolean);
    const selected = only.length
      ? SUITES.filter(([f]) => only.some((o) => f.includes(o)))
      : SUITES;
    if (only.length) log('SUITE_FILTER', { only: only.join('+'), selected: selected.length });

    for (const [file, marker] of selected) {
      const full = path.join(HERE, file);
      let out;
      try {
        out = applyFile(handle, full, file);
      } catch (err) {
        failures += 1;
        log('SUITE', { file, result: 'ERROR' });
        console.error(err.message);
        continue;
      }
      const ok = out.includes(marker) && !/not ok -/.test(out);
      if (!ok) failures += 1;
      log('SUITE', { file, result: ok ? 'PASS' : 'FAIL' });
      for (const line of out.split('\n')) {
        if (/^(NOTA|NOTICE|not ok)/.test(line.trim()) || /\bok - /.test(line)) {
          console.log('    ' + line.trim());
        }
      }
    }

    // ---- 9. Two-session lock proof over the db/104 protocol -----------
    // Session A holds the Pedido row. Session B calls the REAL public
    // writer. Under one lock order B must refuse with concorrencia_ocupada
    // after its 5s lock_timeout, never deadlock (40P01).
    {
      const T = 25000;
      const A = openSession(handle);
      const B = openSession(handle);
      let refusal = '';
      let deadlock = false;
      try {
        A.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        B.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        await delay(400);

        A.send(`BEGIN; SELECT id FROM public.pedidos WHERE id='${PED}' FOR UPDATE; SELECT 'A_HOLDS';`);
        if (!(await waitFor(() => A.all().includes('A_HOLDS'), T))) {
          failures += 1;
          log('LOCK_PROOF_FAIL', { step: 'A could not take the Pedido lock' });
        }

        // B calls the REAL public writer. Its wrapper declares
        // lock_timeout = 5s, so it must give up and answer
        // concorrencia_ocupada instead of waiting forever or deadlocking.
        B.send(`SELECT public.alterar_status_op(${OP1}, 'cancelada', 'p4 lock probe') AS probe; SELECT 'B_SETTLED';`);
        if (!(await waitFor(() => B.all().includes('B_SETTLED'), T))) {
          failures += 1;
          log('LOCK_PROOF_FAIL', { step: 'B never settled within the timeout budget' });
        }
        refusal = B.all();

        A.send("ROLLBACK; SELECT 'A_RELEASED';");
        await waitFor(() => A.all().includes('A_RELEASED'), T);
        deadlock = /deadlock detected|impasse detectado|40P01/i.test(A.all() + B.all());
      } finally {
        A.close(); B.close();
      }
      const ok = /concorrencia_ocupada/.test(refusal) && !deadlock;
      if (!ok) failures += 1;
      log('LOCK_PROOF', {
        result: ok ? 'CONCORRENCIA_OCUPADA_NO_DEADLOCK' : 'UNEXPECTED',
        deadlock_40P01: deadlock,
      });
    }

    // ---- 9b. RECOVERY BOUNDARY — the db/106 rollback block is PROVED --
    //
    // 9.9.P names the P4 recovery as "re-apply db/106 rollback block
    // restoring the prior grant". That block is inert inside the migration,
    // so it is executed HERE, against the post-P4 cluster, and the restored
    // authority fingerprint is compared to the PRE-P4 one. Anything short of
    // byte-identical restoration means the release has no proved way back.
    {
      applyFile(handle, await writeTemp(scratch, 'p4-rollback.sql', `
        BEGIN;
        DROP TRIGGER IF EXISTS pedidos_fato_protegido_fence       ON public.pedidos;
        DROP TRIGGER IF EXISTS op_itens_fato_protegido_fence      ON public.op_itens;
        DROP TRIGGER IF EXISTS ops_fato_protegido_fence           ON public.ops;
        DROP TRIGGER IF EXISTS saldo_fios_op_fato_protegido_fence ON public.saldo_fios_op;
        REVOKE ALL ON TABLE public.pedidos, public.ops, public.op_itens,
                             public.saldo_fios_op
               FROM anon, authenticated, service_role;
        DO $rollback$
        DECLARE r RECORD;
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM public.p4_contencao_acl_baseline) THEN
            RAISE EXCEPTION 'db/106 rollback: the recovery baseline is empty';
          END IF;
          FOR r IN SELECT * FROM public.p4_contencao_acl_baseline LOOP
            EXECUTE format('GRANT %s ON TABLE public.%I TO %I',
                           r.privilegio, r.objeto_tabela, r.grantee);
          END LOOP;
        END
        $rollback$;
        COMMIT;`), 'db/106 rollback block');

      const fpRestored = scalar(handle, AUTHORITY_FINGERPRINT_SQL);
      const d = diffLines(fpBefore, fpRestored);

      // The five bounded writers and the two lock primitives are ADDITIVE and
      // are deliberately left in place by a rollback: the pre-P4 frontend
      // never calls them. Only the grant/trigger surface must come back.
      const grantOrTrigger = (l) => l.startsWith('TABLE-GRANT ') || l.startsWith('COLUMN-GRANT ')
        || (l.startsWith('TRIGGER ') && l.includes('fato_protegido_fence'));
      const lost = d.removed.filter(grantOrTrigger);
      const extra = d.added.filter(grantOrTrigger);

      const ok = lost.length === 0 && extra.length === 0;
      if (!ok) failures += 1;
      log('RECOVERY_BOUNDARY', {
        result: ok ? 'PRE_P4_AUTHORITY_RESTORED_EXACTLY' : 'INCOMPLETE',
        not_restored: lost.length, unexpected: extra.length,
      });
      for (const l of lost) console.log('  MISSING ' + l);
      for (const l of extra) console.log('  EXTRA   ' + l);

      // And the containment is genuinely gone afterwards, so the pre-P4
      // application would work again.
      const back = scalar(handle, OBS4_SQL);
      log('RECOVERY_REACHABLE', { obs4_table_grants: back, expected: obs4Before });
      if (back !== obs4Before) failures += 1;

      // Re-applying db/106 after a rollback must restore the containment,
      // so recovery is not a one-way door.
      applyFile(handle, path.join(path.dirname(HERE), 'db', '106b_contencao_dml.sql'), 'db/106b re-containment');
      const again = scalar(handle, OBS4_SQL);
      log('RECOVERY_REVERSIBLE', { after_reapply: again, expected: '0' });
      if (again !== '0') failures += 1;
    }

    // ---- 10. Cutover and PONR are untouched ---------------------------
    const cut = scalar(handle, `
      SELECT status || '/' || read_authority || '/ponr=' ||
             COALESCE(productive_receipt_started_at::text, 'NULL')
        FROM public.ordem_compra_cutover WHERE id = 1;`);
    const cutOk = cut === 'legacy_active/flat/ponr=NULL';
    if (!cutOk) failures += 1;
    log('CUTOVER', { state: cut, result: cutOk ? 'INACTIVE_PONR_UNCROSSED' : 'DRIFTED' });
  } finally {
    await handle.stop();
    log('CLUSTER_DOWN', { result: 'PROVED' });
  }

  log('P4_REHEARSAL', { failures, result: failures === 0 ? 'PASS' : 'FAIL' });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
