// tests/db118-excedente-disponivel.integration.mjs
//
// RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1 —
// disposable-cluster proof for db/118.
//
// Reconstructs the schema on a fresh, isolated, disposable local
// PostgreSQL cluster (Supabase-platform preamble + the 64-row corpus +
// db/01..db/100 in manifest order + the P1 migrations + the P1 synthetic
// fixture), then:
//
//   * captures the ceiling behaviour of the THREE availability consumers
//     BEFORE db/118 and proves the withdrawn rule was actually in force
//     (real received surplus produced ZERO extra production capacity);
//   * applies db/118;
//   * proves the ACL of every availability object is unchanged and that
//     no client role gained anything;
//   * proves the SAME surplus now raises the ceiling, i.e. the forward
//     correction is what changed the behaviour and not the fixture;
//   * drives the focused SQL suites — the corrected db/101 origin suite,
//     the db/101 helper-permission suite, the db/102 adjustment suite and
//     the new db/118 suite — as a real administrator;
//   * destroys the cluster with the bootstrap's own PID/port/dir proof.
//
// Out of scope by design: no remote host, no managed backend, no
// credential, no production contact of any kind, no repository write.
// Every identifier and quantity in the fixture is synthetic.
//
// Run: node tests/db118-excedente-disponivel.integration.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  reconstructBaseline, resolveManifest, applyFile, scalar,
  writeTemp, log, ADMIN_UUID,
} from '../scripts/c3d/p1-harness.mjs';
import { FIXTURE_SQL, OP1 } from '../scripts/c3d/p1-fixture.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// psql echoes one line per statement. The probes below open with a
// set_config/BEGIN, so the measured value is the LAST line.
const lastLine = (handle, sql) => scalar(handle, sql).split('\n').filter(Boolean).pop().trim();

// The focused suites required by the order's VALIDATION_MANIFEST.
const SUITES = [
  ['db101-disponibilidade-origem.integration.sql',   'DB101_DISPONIBILIDADE_PASS'],
  ['db101-helper-permission-denied.integration.sql', 'DB101_HELPER_PERMISSION_PASS'],
  ['db102-ajuste-concorrencia.integration.sql',      'DB102_AJUSTE_PASS'],
  ['db118-excedente-disponivel.integration.sql',     'DB118_EXCEDENTE_PASS'],
];

// The ACL surface db/118 is forbidden to widen. Every availability object,
// old and new, with its owner, security mode and effective client grants.
const ACL_SQL = `
SELECT string_agg(line, E'\n' ORDER BY line) FROM (
  SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' owner=' || pg_get_userbyid(p.proowner)
         || ' sec=' || CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END
         || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' svc='  || has_function_privilege('service_role', p.oid, 'EXECUTE') AS line
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('oc_disponibilidade_op', 'salvar_ajuste_producao_op',
                       'iniciar_producao_op', '_oc_material_recebido_liquido',
                       '_oc_reserva_ativa', '_oc_disponibilidade_linhas',
                       '_op_reserva_proposta', '_op_status_aplicar')
) s;`;

// The P1 fixture plants a 999.000 kg SURPLUS cotton line on OP1's own
// colour, with 100.000 kg allocation-destined. Under the withdrawn rule
// the ceiling was the allocated net alone; under the restored semantic it
// is the real received material.
const CEILING_SQL = `
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', false);
SELECT d.kg_recebido_liquido || '/' || d.kg_excedente || '/' || d.kg_disponivel
  FROM public.oc_disponibilidade_op(${OP1}) d
 WHERE d.material = 'algodao' AND d.cor_id = 940000201;`;

// The metres the ADJUSTMENT WRITER accepts is the product-visible fact.
// OP1 depends on TWO axes: OP-origin cotton (100.000 kg allocated plus
// 999.000 kg of real shared surplus) and the Pedido-origin polyester pool
// of 200.000 kg, which received NO surplus. At 0.500 kg/m of cotton and
// 0.250 kg/m of polyester the feasible metres are
//   before db/118: min(100.000/0.5, 200.000/0.25) = min( 200, 800) = 200 m
//   after  db/118: min(1099.000/0.5, 200.000/0.25) = min(2198, 800) = 800 m
// so the restored semantic must turn 200 m into 800 m and must STILL
// refuse 801 m, because the polyester axis is genuinely short. Probed
// inside a rolled-back transaction so the fixture stays pristine.
const writerProbe = (metros) => `
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', true);
SELECT coalesce(public.salvar_ajuste_producao_op(${OP1},
         (SELECT ajuste_revisao FROM public.ops WHERE id = ${OP1}),
         jsonb_build_array(jsonb_build_object(
           'op_item_id', (SELECT id FROM public.op_itens WHERE op_id = ${OP1} ORDER BY id LIMIT 1),
           'metros_ajustados', '${metros}'))) ->> 'codigo', 'ACEITO');
ROLLBACK;`;

async function main() {
  let failures = 0;
  let scratch = null;
  const handle = await bootstrapCluster({});
  log('CLUSTER', { port: handle.port, pid: handle.postmasterPid });

  try {
    scratch = await mkdtemp(path.join(tmpdir(), 'db118-'));

    // ---- 1. Baseline: preamble + db/01..100 + corpus + actors + P1 ----
    const { shape, p1Applied } = await reconstructBaseline(handle, scratch, { applyP1: true });
    log('BASELINE', { shape, p1: p1Applied.join('+') });

    applyFile(handle, await writeTemp(scratch, 'p1-fixture.sql', FIXTURE_SQL(ADMIN_UUID)), 'fixture');
    log('FIXTURE', { result: 'PLANTED' });

    // ---- 2. The withdrawn rule, PROVED IN FORCE before the fix -------
    const aclBefore = scalar(handle, ACL_SQL);
    const before = lastLine(handle, CEILING_SQL);
    const before201 = lastLine(handle, writerProbe('201.00'));
    const before800 = lastLine(handle, writerProbe('800.00'));
    if (before !== '100.000/999.000/100.000') {
      failures += 1;
      log('PRE_DB118', { result: 'UNEXPECTED', measured: before });
    } else if (before201 !== 'AJUSTE_EXCEDE_DISPONIVEL' || before800 !== 'AJUSTE_EXCEDE_DISPONIVEL') {
      failures += 1;
      log('PRE_DB118', { result: 'WRITER_UNEXPECTED', at_201m: before201, at_800m: before800 });
    } else {
      log('PRE_DB118', {
        result: 'WITHDRAWN_RULE_IN_FORCE',
        liquido_excedente_teto: before,
        feasible_metres: '200',
        at_201m: before201,
        at_800m: before800,
      });
    }

    // ---- 3. Apply the forward correction ------------------------------
    const manifest = await resolveManifest();
    const db118 = manifest.find((m) => m.n === 118);
    if (!db118) throw new Error('db/118 is absent from the migration manifest');
    applyFile(handle, db118.file, 'db/118');
    log('MIGRATION', { applied: 'db/118', file: path.basename(db118.file) });

    // Byte-identical re-apply must be a no-op.
    applyFile(handle, db118.file, 'db/118 (re-apply)');
    log('REAPPLY', { result: 'IDEMPOTENT' });

    // ---- 4. ACL unchanged --------------------------------------------
    const aclAfter = scalar(handle, ACL_SQL);
    if (aclBefore !== aclAfter) {
      failures += 1;
      log('ACL', { result: 'CHANGED' });
      const b = new Set(aclBefore.split('\n'));
      const a = new Set(aclAfter.split('\n'));
      for (const l of aclBefore.split('\n')) if (!a.has(l)) console.log('  - ' + l);
      for (const l of aclAfter.split('\n')) if (!b.has(l)) console.log('  + ' + l);
    } else {
      log('ACL', { result: 'PRESERVED_BYTE_IDENTICAL', objects: aclAfter.split('\n').length });
    }

    // The three NEW helpers must be owner-only.
    const newAcl = scalar(handle, `
      SELECT coalesce(string_agg(p.proname || '/' || r.role_name, ', '), 'NONE')
        FROM pg_proc p
        CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('_oc_excedente_pool', '_oc_excedente_consumido', '_oc_teto_disponivel')
         AND has_function_privilege(r.role_name, p.oid, 'EXECUTE');`);
    if (newAcl !== 'NONE') {
      failures += 1;
      log('NEW_HELPER_ACL', { result: 'REACHABLE_BY_A_CLIENT_ROLE', detail: newAcl });
    } else {
      log('NEW_HELPER_ACL', { result: 'OWNER_ONLY' });
    }

    // ---- 5. The SAME surplus now raises the SAME ceiling --------------
    const after = lastLine(handle, CEILING_SQL);
    const after800 = lastLine(handle, writerProbe('800.00'));
    const after801 = lastLine(handle, writerProbe('801.00'));
    if (after !== '100.000/999.000/1099.000') {
      failures += 1;
      log('POST_DB118', { result: 'UNEXPECTED', measured: after });
    } else if (after800 !== 'ACEITO' || after801 !== 'AJUSTE_EXCEDE_DISPONIVEL') {
      failures += 1;
      log('POST_DB118', { result: 'WRITER_UNEXPECTED', at_800m: after800, at_801m: after801 });
    } else {
      log('POST_DB118', {
        result: 'RESTORED_SEMANTIC',
        liquido_excedente_teto: after,
        feasible_metres: '800',
        at_800m: after800,
        at_801m: after801,
        ceiling_delta_kg: '+999.000',
        metres_delta: '200 -> 800',
      });
    }

    // No business row moved: the migration changed function bodies only.
    const rows = scalar(handle, `
      SELECT (SELECT count(*) FROM public.ordem_compra_fio_lancamentos) || '/' ||
             (SELECT count(*) FROM public.saldo_fios) || '/' ||
             (SELECT count(*) FROM public.saldo_fios_op) || '/' ||
             (SELECT count(*) FROM public.ordem_compra_item_alocacao) || '/' ||
             (SELECT count(*) FROM public.ops);`);
    log('ROWS_AFTER_MIGRATION', { ledger_saldo_saldoop_aloc_ops: rows });

    // ---- 6. The focused suites ----------------------------------------
    for (const [file, marker] of SUITES) {
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
    console.error(`DB118_INTEGRATION_FAILURES=${failures}`);
    process.exitCode = 1;
  } else {
    console.log('DB118_EXCEDENTE_DISPONIVEL_INTEGRATION_PASS');
  }
}

main().catch((err) => { console.error(err.stack || String(err)); process.exitCode = 1; });
