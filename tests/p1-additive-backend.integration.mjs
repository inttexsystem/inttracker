// tests/p1-additive-backend.integration.mjs
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1 —
// disposable-cluster rehearsal for the complete P1 additive backend.
//
// Reconstructs the production schema on a fresh, isolated, disposable
// local PostgreSQL cluster (Supabase-platform preamble + the
// classification-faithful 64-row corpus + db/01..db/100 in manifest
// order), captures the ACTIVE-BEHAVIOUR FINGERPRINT of every currently
// reachable business authority, applies the seven authorized P1
// migrations in exact numerical order, re-captures the fingerprint and
// refuses any difference, proves the byte-identical re-apply is a no-op,
// drives the nine focused SQL suites as a real administrator, runs the
// two-session adjustment concurrency proof, and destroys the cluster
// with the bootstrap's own PID/port/directory proof.
//
// Out of scope by design: no remote host, no managed backend, no
// credential, no production contact of any kind, no repository write.
// Every identifier and quantity in the fixture is synthetic.
//
// Run: node tests/p1-additive-backend.integration.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  reconstructBaseline, resolveManifest, p1Files, applyFile, scalar, tryQuery,
  openSession, waitFor, delay, writeTemp, log, ADMIN_UUID, P1_MIGRATIONS,
} from '../scripts/c3d/p1-harness.mjs';
import { FIXTURE_SQL, OP1, OP2, PED } from '../scripts/c3d/p1-fixture.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The nine focused suites required by the order, in dependency order.
const SUITES = [
  ['db101-disponibilidade-origem.integration.sql',        'DB101_DISPONIBILIDADE_PASS'],
  ['db101-helper-permission-denied.integration.sql',      'DB101_HELPER_PERMISSION_PASS'],
  ['db102-ajuste-concorrencia.integration.sql',           'DB102_AJUSTE_PASS'],
  ['db103-aceite.integration.sql',                        'DB103_ACEITE_PASS'],
  ['db107-restauracao-completa.integration.sql',          'DB107_RESTAURACAO_PASS'],
  ['db108-acabamento-idempotente.integration.sql',        'DB108_ACABAMENTO_PASS'],
  ['db109-estorno-tapete-correcao-entrega.integration.sql','DB109_ESTORNO_CORRECAO_PASS'],
  ['db105-status-cancelamento.integration.sql',           'DB105_STATUS_CANCELAMENTO_PASS'],
  ['db105-planejamento-historico.integration.sql',        'DB105_PLANEJAMENTO_HISTORICO_PASS'],
];

// ---------------------------------------------------------------------
// ACTIVE-BEHAVIOUR FINGERPRINT
//
// Every currently reachable business authority P1 is forbidden to
// change. Bodies are hashed rather than printed so the comparison is
// exact and the output stays readable.
// ---------------------------------------------------------------------
const FINGERPRINT_SQL = `
SELECT string_agg(line, E'\n' ORDER BY line) FROM (
  SELECT 'FN ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' body=' || md5(p.prosrc)
         || ' sec=' || CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END
         || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' svc='  || has_function_privilege('service_role', p.oid, 'EXECUTE') AS line
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('emitir_ordem_compra',
                       'registrar_recebimento_ordem_compra',
                       'estornar_recebimento_ordem_compra',
                       '_c3c_registrar_recebimento_impl',
                       '_c3c_estornar_recebimento_impl',
                       'alterar_status_op',
                       'cancelar_ordem_compra',
                       'excluir_ordem_compra')
  UNION ALL
  -- gerar_op_latex_split is the ONE pre-existing writer P1 replaces
  -- (9.9.J compatibility wrapper). Its ACL and its body are fingerprinted
  -- SEPARATELY: the ACL must be byte-identical, while the body change is
  -- the single authorized replacement and is expected to differ.
  SELECT 'WRAPPER-ACL gerar_op_latex_split proacl='
         || coalesce(p.proacl::TEXT, '<absent-or-default>')
         || ' owner=' || pg_get_userbyid(p.proowner)
         || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' svc='  || has_function_privilege('service_role', p.oid, 'EXECUTE')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'gerar_op_latex_split'
     AND pg_get_function_identity_arguments(p.oid) = 'p_entrega_id bigint, p_motivo text'
  UNION ALL
  SELECT 'WRAPPER-BODY gerar_op_latex_split body=' || md5(p.prosrc)
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'gerar_op_latex_split'
     AND pg_get_function_identity_arguments(p.oid) = 'p_entrega_id bigint, p_motivo text'
  UNION ALL
  SELECT 'CUTOVER status=' || c.status || ' read_authority=' || c.read_authority
         || ' generation=' || coalesce(c.cutover_generation::TEXT, 'NULL')
         || ' ponr=' || coalesce(c.productive_receipt_started_at::TEXT, 'NULL')
    FROM public.ordem_compra_cutover c WHERE c.id = 1
  UNION ALL
  -- ordem_compra_config UPDATE behaviour: the demotion trigger belongs
  -- to P4 and must be absent, and the grant matrix must be unchanged.
  SELECT 'CONFIG trigger=' || coalesce((SELECT string_agg(t.tgname, ',' ORDER BY t.tgname)
                                          FROM pg_trigger t JOIN pg_class cl ON cl.oid = t.tgrelid
                                         WHERE cl.relname = 'ordem_compra_config' AND NOT t.tgisinternal), 'NONE')
         || ' authUPDATE=' || has_table_privilege('authenticated', 'public.ordem_compra_config', 'UPDATE')
         || ' exige_aceite=' || (SELECT exige_aceite::TEXT FROM public.ordem_compra_config WHERE id = 1)
  UNION ALL
  -- Currently reachable client policies. Scoped to tables that ALREADY
  -- EXIST before P1: a policy on a table this release creates is
  -- additive by construction and cannot change reachable behaviour.
  SELECT 'POLICY ' || pol.schemaname || '.' || pol.tablename || '.' || pol.policyname
         || ' cmd=' || pol.cmd
         || ' roles=' || array_to_string(pol.roles, '+')
         || ' qual=' || md5(coalesce(pol.qual, ''))
         || ' check=' || md5(coalesce(pol.with_check, ''))
    FROM pg_policies pol
   WHERE pol.schemaname = 'public'
     AND pol.tablename NOT IN ('ordem_compra_aceite_comandos',
                               'op_acabamento_comandos',
                               'op_acabamento_tentativas',
                               'ordem_compra_cutover_acl_manifest')
     AND (pol.roles && ARRAY['anon','authenticated','service_role','public']::name[])
  UNION ALL
  -- Direct table privileges the P1 contract forbids revoking.
  SELECT 'GRANT ' || g.grantee || ' ' || g.table_name || ' ' || g.privilege_type
    FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public'
     AND g.grantee IN ('anon', 'authenticated', 'service_role')
     AND g.table_name IN ('pedidos', 'ops', 'op_itens', 'saldo_fios_op',
                          'ordem_compra', 'ordem_compra_item', 'ordens_compra_fio',
                          'necessidade_compra_fio', 'necessidade_compra_planejamento')
) s;`;

function diffLines(before, after) {
  const b = new Set(before.split('\n').filter(Boolean));
  const a = new Set(after.split('\n').filter(Boolean));
  const removed = [...b].filter((x) => !a.has(x));
  const added = [...a].filter((x) => !b.has(x));
  return { removed, added };
}

async function main() {
  let failures = 0;
  const handle = await bootstrapCluster({});
  log('CLUSTER_UP', {
    host: handle.host, port: handle.port, pg: handle.pgVersion,
    pid: handle.postmasterPid, dataDir: handle.dataDir,
  });

  let scratch = null;
  try {
    scratch = await mkdtemp(path.join(tmpdir(), 'p1-rehearsal-'));

    // ---- 1. Baseline db/01..db/100 -----------------------------------
    const base = await reconstructBaseline(handle, scratch, { applyP1: false });
    log('BASELINE', { migrations: base.baseline.length, shape: base.shape });

    // ---- 2. PRE-P1 active-behaviour fingerprint ----------------------
    const fpBefore = scalar(handle, FINGERPRINT_SQL);
    log('FINGERPRINT_PRE', { lines: fpBefore.split('\n').filter(Boolean).length });

    // ---- 3. Apply P1 in exact numerical order ------------------------
    const manifest = await resolveManifest();
    for (const { n, file } of p1Files(manifest)) {
      applyFile(handle, file, `db/${n}`);
      log('P1_APPLY', { migration: `db/${n}`, result: 'CLEAN' });
    }

    // ---- 4. Byte-identical re-apply is a no-op ------------------------
    for (const { n, file } of p1Files(manifest)) {
      applyFile(handle, file, `db/${n} reapply`);
      log('P1_REAPPLY', { migration: `db/${n}`, result: 'NOOP' });
    }

    // ---- 5. POST-P1 fingerprint: any difference is a HARD STOP -------
    const fpAfter = scalar(handle, FINGERPRINT_SQL);
    const { removed, added } = diffLines(fpBefore, fpAfter);

    // The ONLY authorized difference is the 9.9.J compatibility wrapper's
    // BODY. Its ACL, and every other fingerprinted authority, must be
    // byte-identical; anything else is a hard stop.
    const isWrapperBody = (l) => l.startsWith('WRAPPER-BODY gerar_op_latex_split');
    const unauthorizedRemoved = removed.filter((l) => !isWrapperBody(l));
    const unauthorizedAdded = added.filter((l) => !isWrapperBody(l));

    if (unauthorizedRemoved.length || unauthorizedAdded.length) {
      failures += 1;
      log('FINGERPRINT_POST', {
        result: 'UNAUTHORIZED_DIFFERENCE',
        removed: unauthorizedRemoved.length,
        added: unauthorizedAdded.length,
      });
      for (const l of unauthorizedRemoved) console.log('  - ' + l);
      for (const l of unauthorizedAdded) console.log('  + ' + l);
    } else {
      log('FINGERPRINT_POST', {
        result: 'IDENTICAL_EXCEPT_AUTHORIZED_WRAPPER_BODY',
        lines: fpAfter.split('\n').filter(Boolean).length,
        wrapper_body_replaced: removed.some(isWrapperBody) && added.some(isWrapperBody),
      });
    }

    // Explicit, separate assertion: the wrapper's ACL did not narrow.
    const aclBefore = fpBefore.split('\n').find((l) => l.startsWith('WRAPPER-ACL '));
    const aclAfter = fpAfter.split('\n').find((l) => l.startsWith('WRAPPER-ACL '));
    if (!aclBefore || !aclAfter || aclBefore !== aclAfter) {
      failures += 1;
      log('WRAPPER_ACL', { result: 'CHANGED' });
      console.log('  - ' + aclBefore);
      console.log('  + ' + aclAfter);
    } else {
      log('WRAPPER_ACL', { result: 'PRESERVED_BYTE_IDENTICAL' });
      console.log('    ' + aclAfter);
    }

    // ---- 6. Synthetic fixture ----------------------------------------
    applyFile(handle, await writeTemp(scratch, 'p1-fixture.sql', FIXTURE_SQL(ADMIN_UUID)), 'fixture');
    log('FIXTURE', { result: 'PLANTED' });

    // ---- 7. The nine focused suites ----------------------------------
    // P1_SUITES=<substring>[,<substring>] narrows the run during
    // development; unset (the reported configuration) runs all nine.
    const only = (process.env.P1_SUITES || '').split(',').map((s) => s.trim()).filter(Boolean);
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

    // ---- 8. Two-session adjustment concurrency proof (9.9.B/9.9.C) ---
    // Session A holds the Pedido row — the FIRST lock every writer in
    // the protocol takes. Session B then runs the REAL adjustment RPC.
    // Under one lock order B must WAIT (correct serialisation) and then
    // settle cleanly once A releases, with no SQLSTATE 40P01 anywhere.
    {
      const T = 25000;
      const A = openSession(handle);
      const B = openSession(handle);
      let cf = 0;
      try {
        A.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        B.send(`SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',false);`);
        await delay(400);

        A.send(`BEGIN; SELECT id FROM public.pedidos WHERE id='${PED}' FOR UPDATE; SELECT 'A_HOLDS';`);
        if (!(await waitFor(() => A.all().includes('A_HOLDS'), T))) {
          cf += 1; log('CONC_FAIL', { step: 'A could not take the Pedido lock' });
        }

        const itemB = scalar(handle, `SELECT id FROM public.op_itens WHERE op_id=${OP2} ORDER BY id LIMIT 1;`);
        B.send(`BEGIN; SELECT public.salvar_ajuste_producao_op(${OP2}, 0,
                  '[{"op_item_id":${itemB},"metros_ajustados":10.00}]'::jsonb); SELECT 'B_SETTLED';`);
        await delay(2500);
        const bWaiting = !B.all().includes('B_SETTLED');
        log('CONC', { step: 'B blocked on the Pedido row while A holds it', blocked: bWaiting });

        A.send("COMMIT; SELECT 'A_COMMITTED';");
        if (!(await waitFor(() => A.all().includes('A_COMMITTED'), T))) {
          cf += 1; log('CONC_FAIL', { step: 'A never committed' });
        }
        if (!(await waitFor(() => B.all().includes('B_SETTLED'), T))) {
          cf += 1; log('CONC_FAIL', { step: 'B never settled after A released' });
        }
        B.send("COMMIT; SELECT 'B_COMMITTED';");
        await waitFor(() => B.all().includes('B_COMMITTED'), T);

        const both = A.all() + B.all();
        if (/deadlock detected|impasse detectado|40P01/i.test(both)) {
          cf += 1; log('CONC_FAIL', { step: 'SQLSTATE 40P01 observed' });
        }
        if (/server closed the connection|FATAL/i.test(both)) {
          cf += 1; log('CONC_FAIL', { step: 'transport-level failure' });
        }
        if (!/"ok"\s*:\s*true/.test(B.all())) {
          cf += 1; log('CONC_FAIL', { step: 'B did not return a coherent domain result' });
        }

        // STALE REVISION LOSES WITHOUT A PARTIAL WRITE.
        const revNow = scalar(handle, `SELECT ajuste_revisao FROM public.ops WHERE id=${OP2};`);
        const before = scalar(handle,
          `SELECT coalesce(metros_ajustados::TEXT,'NULL') FROM public.op_itens WHERE id=${itemB};`);
        const stale = tryQuery(handle,
          `SELECT set_config('request.jwt.claim.sub','${ADMIN_UUID}',true);
           SELECT public.salvar_ajuste_producao_op(${OP2}, 0,
             '[{"op_item_id":${itemB},"metros_ajustados":77.00}]'::jsonb);`);
        const after = scalar(handle,
          `SELECT coalesce(metros_ajustados::TEXT,'NULL') FROM public.op_itens WHERE id=${itemB};`);
        const refused = /AJUSTE_REVISAO_DESATUALIZADA/.test(stale.out);
        if (!refused || after !== before) {
          cf += 1;
          log('CONC_FAIL', { step: 'stale revision', refused, before, after });
        } else {
          log('CONC', { step: 'stale revision refused with zero partial write', revisao: revNow, metros: after });
        }

        if (cf === 0) log('CONCURRENCY', { result: 'PASS', deadlock_40P01: false });
        else { failures += cf; log('CONCURRENCY', { result: 'FAIL', failures: cf }); }
      } finally {
        A.close(); B.close();
        await delay(300);
        A.kill(); B.kill();
      }
    }
  } catch (err) {
    failures += 1;
    console.error(err.stack || String(err));
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {});
    const proof = await handle.stop();
    log('TEARDOWN', {
      port: handle.port, pid: handle.postmasterPid,
      stop_ok: proof.stopResult?.ok, port_closed: proof.portClosed,
      pid_absent: proof.pidAbsent, dir_absent: proof.dirAbsent,
    });
  }

  if (failures) {
    console.error(`P1_INTEGRATION_FAILURES=${failures}`);
    process.exitCode = 1;
  } else {
    console.log('P1_ADDITIVE_BACKEND_INTEGRATION_PASS');
  }
}

main().catch((err) => { console.error(err.stack || String(err)); process.exitCode = 1; });
