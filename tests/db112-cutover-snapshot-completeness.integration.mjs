// tests/db112-cutover-snapshot-completeness.integration.mjs
//
// db/112 — CUTOVER SNAPSHOT COMPLETENESS INVARIANT, real database proof.
//
// NATIVE-RECEIPT-CUTOVER-SNAPSHOT-CARDINALITY-ROOT-CAUSE-CORRECTION-R1.
//
// db/75 froze two migration-time dataset cardinalities as structural
// invariants: fence_and_snapshot demanded exactly 51 source mappings, and
// assert_import_reconciled demanded exactly 39 headers / 44 ledger lines /
// 20221.280 kg / 405.980 kg excess. Production has since retired the whole
// legacy corpus (ordens_compra_fio = 0, ordem_compra_item_compat_fio = 0),
// so the only canonical transition into maintenance_fenced became
// permanently unreachable and the cutover machine could never run again.
//
// This suite proves the correction on a disposable cluster, against the
// REAL db/67 corpus reconstruction (64 legacy rows -> 51 mappings), and it
// deliberately does NOT encode 51 as the expected answer except as the
// historical regression case.
//
//   CONTROL  the pre-correction code really does refuse cardinality 0 and
//            really does accept 51 (so the harness reproduces the defect
//            and the historical dataset before anything is changed)
//   CASE E   historical regression: with the 51-row corpus the corrected
//            code still succeeds, and assert_import_reconciled DERIVES
//            39 / 44 / 20221.280 / 405.980 instead of asserting them
//   CASE B   an arbitrary non-zero cardinality is derived dynamically
//   CASE C   incomplete mapping fails closed (two distinct shapes)
//   CASE D   ambiguous mapping fails closed
//   CASE A   the current production shape (cardinality 0) completes the
//            whole pre-PONR round trip, and a P3-style synthetic seed then
//            yields POSITIVE native availability
//
// Out of scope by design: no remote host, no hosted backend, no
// credential, no production contact. Every identifier is synthetic.
//
// Run: node tests/db112-cutover-snapshot-completeness.integration.mjs

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  reconstructBaseline, applyFile, scalar, writeTemp, log, ADMIN_UUID, REPO_ROOT,
} from '../scripts/c3d/p1-harness.mjs';
import { FIXTURE_SQL, OP1, OC1, OCI1, ALO1 } from '../scripts/c3d/p1-fixture.mjs';
import {
  CATALOGUE_SNAPSHOT_SQL, diffCatalogue, assertDb112Delta, DB112_EXPECTED_DELTA,
} from '../scripts/c3d/catalogue-delta.mjs';

const GEN = 112001;
const DB112 = path.join(REPO_ROOT, 'db', '112_cutover_snapshot_completeness_invariant.sql');

// Historical shape of the db/67 REFUND-A seed. Used ONLY as the Case E
// regression expectation, never as the invariant.
const HIST_MAPPINGS = 51;
const HIST_HEADERS = 39;
const HIST_LINES = 44;
const HIST_TOTAL = '20221.280';
const HIST_EXCESS = '405.980';

let failures = 0;
let passes = 0;

function ok(name, cond, detail = '') {
  if (cond) { passes += 1; console.log(`ok - ${name}${detail ? ` (${detail})` : ''}`); }
  else { failures += 1; console.log(`not ok - ${name}${detail ? ` (${detail})` : ''}`); }
}

function eq(name, actual, expected) {
  ok(name, String(actual) === String(expected), `expected ${expected}, got ${actual}`);
}

// One psql session per script, so the session-scoped advisory lock taken by
// ordem_compra_c3c_acquire_session_lock survives across the statements and is
// released when the session ends.
async function session(handle, scratch, label, sql, { expectFailure = false } = {}) {
  const file = await writeTemp(scratch, `${label}.sql`, sql);
  return applyFile(handle, file, label, { expectFailure });
}

const LOCK = `SELECT public.ordem_compra_c3c_acquire_session_lock(${GEN});`;

function cutoverState(handle) {
  return scalar(handle, `SELECT status || '/' || read_authority || '/' ||
    CASE WHEN productive_receipt_started_at IS NULL THEN 'ponrnull' ELSE 'PONR_SET' END
    FROM public.ordem_compra_cutover WHERE id = 1;`);
}

function legacyShape(handle) {
  return scalar(handle, `SELECT (SELECT count(*) FROM public.ordens_compra_fio) || '/' ||
    (SELECT count(*) FROM public.ordem_compra_item_compat_fio) || '/' ||
    (SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot) || '/' ||
    (SELECT count(*) FROM public.ordem_compra_cutover_inventory_baseline);`);
}

// Drives fence -> purge -> resume so the cutover returns to the exact
// legacy_active baseline between committed cases.
const RESET_SQL = `${LOCK}
SELECT public.ordem_compra_c3c_purge_generation(${GEN});
SELECT public.ordem_compra_c3c_resume_legacy(${GEN});
SELECT public.ordem_compra_c3c_release_session_lock(${GEN});`;

async function main() {
  const handle = await bootstrapCluster({});
  const scratch = await mkdtemp(path.join(tmpdir(), 'db112-'));
  try {
    log('BOOT', { port: handle.port, dataDir: handle.dataDir });

    const base = await reconstructBaseline(handle, scratch, { applyP1: true });
    log('BASELINE', { shape: base.shape, p1: base.p1Applied.join(',') });
    eq('baseline reconstructs the db/67 corpus shape', base.shape, '64/64/51/51/51');
    eq('cutover starts legacy_active/flat/PONR NULL', cutoverState(handle), 'legacy_active/flat/ponrnull');

    // -----------------------------------------------------------------
    // CONTROL — the pre-correction code, before db/112 is applied.
    // -----------------------------------------------------------------
    const preFence = await session(handle, scratch, 'control-fence-51', `${LOCK}
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});`);
    ok('CONTROL: pre-correction fence accepts the historical 51 mappings',
      /"mapping_count" *: *51/.test(preFence) || preFence.includes('51'), preFence.trim().slice(0, 120));
    eq('CONTROL: snapshot holds 51 rows',
      scalar(handle, 'SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot;'), HIST_MAPPINGS);
    await session(handle, scratch, 'control-reset', RESET_SQL);
    eq('CONTROL: reset restores legacy_active/flat', cutoverState(handle), 'legacy_active/flat/ponrnull');

    // The defect itself, proved against the pre-correction code: empty the
    // legacy source and watch the old assertion refuse a complete set.
    // Fixture arrangement only uses replica mode, and it is switched back
    // to origin before the cutover function under test is called.
    const preEmpty = await session(handle, scratch, 'control-empty-refused', `${LOCK}
BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM public.ordem_compra_item_compat_fio;
DELETE FROM public.ordens_compra_fio;
SET LOCAL session_replication_role = origin;
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
ROLLBACK;`, { expectFailure: true });
    ok('CONTROL: pre-correction fence REFUSES a legitimately empty source',
      preEmpty.includes('snapshot_mapping_count_mismatch'), preEmpty.trim().split('\n')[0]);
    eq('CONTROL: the refusal left the cutover untouched', cutoverState(handle), 'legacy_active/flat/ponrnull');

    // And the SECOND frozen constant, proved the same way: run the real
    // import against this corpus while the pre-correction
    // assert_import_reconciled is still installed. It refuses, because the
    // corpus does not have exactly 39 headers / 44 lines / 20221.280 kg.
    const preImport = await session(handle, scratch, 'control-import-refused', `${LOCK}
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
SELECT public.ordem_compra_c3c_import_and_reconcile(${GEN});`, { expectFailure: true });
    ok('CONTROL: pre-correction assert_import_reconciled REFUSES a complete, self-consistent import',
      preImport.includes('import_reconciliation_mismatch'), preImport.trim().split('\n')[0]);
    await session(handle, scratch, 'control-import-reset', RESET_SQL);
    eq('CONTROL: reset after the refused import', cutoverState(handle), 'legacy_active/flat/ponrnull');

    // -----------------------------------------------------------------
    // MAPPING UNIQUENESS (supervisor finding 3).
    //
    // The import lineage is keyed by flat_row_id
    // ('c3c_snapshot:<cutover>:<generation>:<flat_row_id>'), so it assumes ONE
    // snapshot/import lineage per flat row. db/112 needs no extra guard for
    // that ONLY IF the schema already forbids a second mapping for the same
    // flat row. db/67 declares ordens_compra_fio_id BIGINT NOT NULL UNIQUE;
    // this proves the constraint exists AND that it actually refuses at
    // runtime, rather than inferring uniqueness from the historical 51/51.
    // -----------------------------------------------------------------
    eq('UNIQUENESS: compat_fio carries UNIQUE (ordens_compra_fio_id)',
      scalar(handle, `SELECT count(*)::text FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        WHERE c.relname = 'ordem_compra_item_compat_fio' AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) = 'UNIQUE (ordens_compra_fio_id)';`), '1');
    // Every corpus item is already mapped, and ordem_compra_item_id is UNIQUE
    // too, so the second mapping needs a BRAND NEW item pointed at an
    // ALREADY-MAPPED flat row. That isolates the ordens_compra_fio_id
    // constraint as the one that must refuse.
    const dupMap = await session(handle, scratch, 'uniqueness-second-mapping', `
BEGIN;
DO $u$
DECLARE v_item BIGINT; v_flat BIGINT; v_ordem BIGINT;
BEGIN
  -- ordem_compra_item_unico_poliester makes (ordem_id, cor_poliester) unique
  -- for poliester, so pick a rascunho order that has no PRETO poliester item.
  SELECT o.id INTO v_ordem FROM public.ordem_compra o
   WHERE o.status_administrativo = 'rascunho'
     AND NOT EXISTS (SELECT 1 FROM public.ordem_compra_item i
                      WHERE i.ordem_id = o.id AND i.material = 'poliester'
                        AND i.cor_poliester = 'PRETO')
   ORDER BY o.id LIMIT 1;
  SELECT c.ordens_compra_fio_id INTO v_flat
    FROM public.ordem_compra_item_compat_fio c ORDER BY c.id LIMIT 1;
  IF v_ordem IS NULL OR v_flat IS NULL THEN
    RAISE EXCEPTION 'UNIQUENESS_FIXTURE_UNAVAILABLE';
  END IF;
  INSERT INTO public.ordem_compra_item (ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido)
  VALUES (v_ordem, 'poliester', NULL, 'PRETO', 1.000, 0)
  RETURNING id INTO v_item;
  -- The flat row already has a mapping; this must violate
  -- ordem_compra_item_compat_fio_ordens_compra_fio_id_key.
  INSERT INTO public.ordem_compra_item_compat_fio (ordem_compra_item_id, ordens_compra_fio_id, origem)
  VALUES (v_item, v_flat, 'native_bridge');
  RAISE EXCEPTION 'UNIQUENESS_NOT_ENFORCED: a second mapping for flat row % was accepted', v_flat;
END
$u$;
ROLLBACK;`, { expectFailure: true });
    ok('UNIQUENESS: a SECOND mapping for the same flat row is refused at runtime',
      /unicidade|unique/i.test(dupMap) && dupMap.includes('ordens_compra_fio_id'),
      dupMap.trim().split('\n')[0]);
    log('UNIQUENESS_VERDICT', {
      note: 'one ordens_compra_fio row -> at most one ordem_compra_item_compat_fio mapping is SCHEMA-ENFORCED (db/67), so the flat_row_id-keyed import lineage cannot be ambiguous and db/112 needs no additional C6 guard. The remaining multiplication vector is allocations, which C3 (snapshot_ambiguous_mapping) closes.',
    });

    // -----------------------------------------------------------------
    // Apply the correction, measuring the EXACT catalogue delta
    // (supervisor finding 1).
    // -----------------------------------------------------------------
    const catBefore = JSON.parse(scalar(handle, CATALOGUE_SNAPSHOT_SQL));
    applyFile(handle, DB112, 'db/112');
    const catAfter = JSON.parse(scalar(handle, CATALOGUE_SNAPSHOT_SQL));
    const delta = diffCatalogue(catBefore, catAfter);
    const verdict = assertDb112Delta(delta);
    log('DB112_CATALOGUE_DELTA', {
      changed_dimensions: delta.changedDimensions.join(',') || '(none)',
      changed_functions: delta.changedFunctions.map((f) => `${f.function}[${f.changed_terms.join('+')}]`).join(' ') || '(none)',
      count_changes: delta.countChanges.length,
    });
    ok('DB112 DELTA: exactly the authorized catalogue delta and nothing else',
      verdict.authorized, verdict.violations.join(' | ') || 'no violations');
    eq('DB112 DELTA: only the functions dimension moved',
      delta.changedDimensions.join(','), DB112_EXPECTED_DELTA.changed_dimensions.join(','));
    eq('DB112 DELTA: exactly two function bodies changed', delta.changedFunctions.length, 2);
    eq('DB112 DELTA: only the src term moved in each',
      [...new Set(delta.changedFunctions.flatMap((f) => f.changed_terms))].join(','), 'src');
    eq('DB112 DELTA: zero functions added or removed',
      delta.addedFunctions.length + delta.removedFunctions.length, 0);
    eq('DB112 DELTA: zero catalogue cardinality change', delta.countChanges.length, 0);
    log('APPLIED', { migration: 'db/112' });
    eq('db/112 is inactive: cutover still legacy_active/flat', cutoverState(handle), 'legacy_active/flat/ponrnull');
    eq('db/112 dropped the frozen 51 assertion',
      scalar(handle, `SELECT (prosrc LIKE '%v_source_count <> 51%')::text FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname='ordem_compra_c3c_fence_and_snapshot';`), 'false');
    eq('db/112 dropped the frozen import totals',
      scalar(handle, `SELECT (prosrc LIKE '%20221.280%' OR prosrc LIKE '%405.980%'
        OR prosrc LIKE '%<> 39%' OR prosrc LIKE '%<> 44%')::text FROM pg_proc
        WHERE pronamespace='public'::regnamespace AND proname='ordem_compra_c3c_assert_import_reconciled';`), 'false');
    eq('both corrected functions stay unreachable from every client role',
      scalar(handle, `SELECT count(*)::text FROM pg_proc p
        CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) g(r)
        WHERE p.pronamespace='public'::regnamespace
          AND p.proname IN ('ordem_compra_c3c_fence_and_snapshot','ordem_compra_c3c_assert_import_reconciled')
          AND has_function_privilege(g.r, p.oid, 'EXECUTE');`), '0');

    // -----------------------------------------------------------------
    // CASE E — historical regression at the real 51-row corpus.
    // -----------------------------------------------------------------
    const eFence = await session(handle, scratch, 'caseE-fence', `${LOCK}
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});`);
    ok('CASE E: corrected fence still accepts the historical corpus', eFence.includes(`"mapping_count": ${HIST_MAPPINGS}`)
      || eFence.includes(`"mapping_count" : ${HIST_MAPPINGS}`) || eFence.includes(String(HIST_MAPPINGS)),
      eFence.trim().slice(0, 140));
    eq('CASE E: derived snapshot cardinality equals the historical 51',
      scalar(handle, 'SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot;'), HIST_MAPPINGS);
    eq('CASE E: maintenance_fenced/flat reached, PONR still NULL', cutoverState(handle), 'maintenance_fenced/flat/ponrnull');

    // The SAME import that the pre-correction code refused above now
    // succeeds, because the expectations are derived from the snapshot the
    // import actually consumed.
    const eImport = await session(handle, scratch, 'caseE-import', `${LOCK}
SELECT public.ordem_compra_c3c_import_and_reconcile(${GEN});`);
    log('CASE_E_IMPORT', { result: eImport.trim().replace(/\s+/g, ' ').slice(0, 200) });
    ok('CASE E: assert_import_reconciled now PASSES the import it previously refused',
      eImport.includes('true'), eImport.trim().replace(/\s+/g, ' ').slice(0, 200));

    // Self-consistency: the derived expectations must equal the facts the
    // import actually wrote. This is the invariant that replaced the four
    // frozen constants, checked independently of the function itself.
    const derived = scalar(handle, `SELECT
        (SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot WHERE kg_recebido > 0) || '/' ||
        (SELECT COALESCE(sum((CASE WHEN kg_atribuido > 0 THEN 1 ELSE 0 END)
                            + (CASE WHEN kg_excesso  > 0 THEN 1 ELSE 0 END)), 0)
           FROM public.ordem_compra_cutover_source_snapshot WHERE kg_recebido > 0) || '/' ||
        (SELECT to_char(COALESCE(sum(kg_recebido),0),'FM999999999990.000')
           FROM public.ordem_compra_cutover_source_snapshot WHERE kg_recebido > 0) || '/' ||
        (SELECT to_char(COALESCE(sum(kg_excesso),0),'FM999999999990.000')
           FROM public.ordem_compra_cutover_source_snapshot);`);
    const actual = scalar(handle, `SELECT
        (SELECT count(*) FROM public.ordem_compra_recebimentos
          WHERE idempotency_namespace = 'legacy_initial_balance_v1') || '/' ||
        (SELECT count(*) FROM public.ordem_compra_fio_lancamentos
          WHERE tipo = 'import_saldo_inicial') || '/' ||
        (SELECT to_char(COALESCE(sum(kg_recebido),0),'FM999999999990.000')
           FROM public.ordem_compra_fio_lancamentos WHERE tipo = 'import_saldo_inicial') || '/' ||
        (SELECT to_char(COALESCE(sum(kg_excesso),0),'FM999999999990.000')
           FROM public.ordem_compra_fio_lancamentos WHERE tipo = 'import_saldo_inicial');`);
    eq('CASE E: derived headers/lines/kg/excess exactly equal what the import wrote', actual, derived);

    // And the derived answer for THIS corpus is not the frozen one, which
    // is precisely why the frozen constants were a dataset cardinality.
    ok('CASE E: the derived answer differs from the frozen constants',
      derived !== `${HIST_HEADERS}/${HIST_LINES}/${HIST_TOTAL}/${HIST_EXCESS}`,
      `derived=${derived}, frozen=${HIST_HEADERS}/${HIST_LINES}/${HIST_TOTAL}/${HIST_EXCESS}`);
    log('CASE_E_LIMITATION', {
      note: 'the exact production 51-row corpus is NOT reconstructible (production retired it; the C3D corpus is classification-faithful but value-synthetic), so 39/44/20221.280/405.980 is proved dataset-specific rather than reproduced',
    });

    await session(handle, scratch, 'caseE-reset', RESET_SQL);
    eq('CASE E: purge + resume restore legacy_active/flat', cutoverState(handle), 'legacy_active/flat/ponrnull');
    eq('CASE E: purge removed every imported fact and staging row',
      scalar(handle, `SELECT (SELECT count(*) FROM public.ordem_compra_recebimentos) || '/' ||
        (SELECT count(*) FROM public.ordem_compra_fio_lancamentos) || '/' ||
        (SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot) || '/' ||
        (SELECT count(*) FROM public.ordem_compra_cutover_inventory_baseline);`), '0/0/0/0');

    // -----------------------------------------------------------------
    // CASE B — an arbitrary non-zero cardinality, derived dynamically.
    // Six Class-B mappings (kg_recebido = 0, so C1 stays satisfied) are
    // removed inside a transaction that is rolled back afterwards.
    // -----------------------------------------------------------------
    const bOut = await session(handle, scratch, 'caseB-dynamic', `${LOCK}
BEGIN;
DELETE FROM public.ordem_compra_item_compat_fio c
 USING public.ordens_compra_fio f
 WHERE f.id = c.ordens_compra_fio_id
   AND COALESCE(f.kg_recebido,0) = 0
   AND c.id IN (SELECT c2.id FROM public.ordem_compra_item_compat_fio c2
                JOIN public.ordens_compra_fio f2 ON f2.id = c2.ordens_compra_fio_id
                WHERE COALESCE(f2.kg_recebido,0) = 0 ORDER BY c2.id LIMIT 6);
SELECT 'expected_mappings=' || count(*)::text FROM public.ordem_compra_item_compat_fio;
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
SELECT 'snapshot_rows=' || count(*)::text FROM public.ordem_compra_cutover_source_snapshot;
ROLLBACK;`);
    const bExpected = (bOut.match(/expected_mappings=(\d+)/) || [])[1];
    const bActual = (bOut.match(/snapshot_rows=(\d+)/) || [])[1];
    eq('CASE B: derived cardinality tracks the reduced source set', bActual, bExpected);
    ok('CASE B: the reduced cardinality is not the historical 51', bActual !== String(HIST_MAPPINGS),
      `mappings=${bActual}`);
    eq('CASE B: rollback left the corpus intact', legacyShape(handle), '64/51/0/0');
    eq('CASE B: cutover untouched', cutoverState(handle), 'legacy_active/flat/ponrnull');

    // -----------------------------------------------------------------
    // CASE C — incomplete mapping, two distinct shapes, both fail closed.
    // -----------------------------------------------------------------
    const c1 = await session(handle, scratch, 'caseC1-unmapped', `${LOCK}
BEGIN;
DELETE FROM public.ordem_compra_item_compat_fio c
 WHERE c.id = (SELECT c2.id FROM public.ordem_compra_item_compat_fio c2
               JOIN public.ordens_compra_fio f2 ON f2.id = c2.ordens_compra_fio_id
               WHERE COALESCE(f2.kg_recebido,0) > 0 ORDER BY c2.id LIMIT 1);
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
ROLLBACK;`, { expectFailure: true });
    ok('CASE C1: a received flat row with no mapping fails closed',
      c1.includes('snapshot_unmapped_source_row'), c1.trim().split('\n')[0]);

    // Allocations are mutable only while their order is rascunho
    // (trg_alocacao_rascunho_guard), so both remaining negatives target a
    // Class D mapped item, whose order really is rascunho.
    const c2 = await session(handle, scratch, 'caseC2-no-allocation', `${LOCK}
BEGIN;
DELETE FROM public.ordem_compra_item_alocacao a
 WHERE a.item_id = (SELECT c2.ordem_compra_item_id
                      FROM public.ordem_compra_item_compat_fio c2
                      JOIN public.ordem_compra_item i2 ON i2.id = c2.ordem_compra_item_id
                      JOIN public.ordem_compra o2 ON o2.id = i2.ordem_id
                     WHERE o2.status_administrativo = 'rascunho'
                     ORDER BY c2.id LIMIT 1);
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
ROLLBACK;`, { expectFailure: true });
    ok('CASE C2: a mapped item with no allocation fails closed',
      c2.includes('snapshot_incomplete_mapping'), c2.trim().split('\n')[0]);
    eq('CASE C: both refusals left the corpus and cutover intact',
      `${legacyShape(handle)}|${cutoverState(handle)}`, '64/51/0/0|legacy_active/flat/ponrnull');

    // -----------------------------------------------------------------
    // CASE D — ambiguous mapping (a mapped item with two allocations).
    // -----------------------------------------------------------------
    // ordem_compra_item_alocacao carries UNIQUE (item_id, necessidade_id),
    // so the reachable ambiguity is a second allocation of the SAME mapped
    // item to a DIFFERENT need. trg_alocacao_origem_guard additionally
    // requires the second need to agree with the item on Pedido, material
    // and colour, so the pair is resolved dynamically and the fixture fails
    // loudly rather than silently inserting nothing.
    const d = await session(handle, scratch, 'caseD-ambiguous', `${LOCK}
BEGIN;
DO $d$
DECLARE v_n INT;
BEGIN
  INSERT INTO public.ordem_compra_item_alocacao (item_id, necessidade_id, op_id, kg_alocado)
  SELECT i.id, n2.id, a.op_id, LEAST(1.000, n2.kg_necessario - n2.kg_alocado)
    FROM public.ordem_compra_item_compat_fio c
    JOIN public.ordem_compra_item i ON i.id = c.ordem_compra_item_id
    JOIN public.ordem_compra o ON o.id = i.ordem_id
    JOIN public.ordem_compra_item_alocacao a ON a.item_id = i.id
    JOIN public.necessidade_compra_fio n2
      ON n2.pedido_id IS NOT DISTINCT FROM o.pedido_id
     AND n2.material = i.material
     AND n2.cor_id IS NOT DISTINCT FROM i.cor_id
     AND n2.cor_poliester IS NOT DISTINCT FROM i.cor_poliester
     AND n2.id <> a.necessidade_id
     AND n2.kg_alocado < n2.kg_necessario
   WHERE o.status_administrativo = 'rascunho'
   ORDER BY i.id, n2.id
   LIMIT 1;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'CASE_D_FIXTURE_UNAVAILABLE'; END IF;
END
$d$;
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});
ROLLBACK;`, { expectFailure: true });
    ok('CASE D: a mapped item with two allocations fails closed',
      d.includes('snapshot_ambiguous_mapping'), d.trim().split('\n')[0]);
    eq('CASE D: the refusal left the corpus and cutover intact',
      `${legacyShape(handle)}|${cutoverState(handle)}`, '64/51/0/0|legacy_active/flat/ponrnull');

    // -----------------------------------------------------------------
    // CASE A — the current production shape: legacy source cardinality 0.
    // Committed, because this is the operational sequence P3 needs.
    // -----------------------------------------------------------------
    // Reproduce the two load-bearing facts of the current production shape:
    // ordens_compra_fio = 0 and ordem_compra_item_compat_fio = 0. Fixture
    // arrangement only; the cutover functions under test run normally
    // afterwards, under origin replication role and every real guard.
    // necessidade_compra_fio keeps legado = TRUE and its (now dangling)
    // legado_origem_ordem_compra_fio_id, because necessidade_legado_ref and
    // necessidade_pedido_native together forbid flipping it here; no cutover
    // code path reads that column.
    await session(handle, scratch, 'caseA-retire-legacy', `
SET session_replication_role = replica;
DELETE FROM public.ordem_compra_item_compat_fio;
DELETE FROM public.ordens_compra_fio;
SET session_replication_role = origin;`);
    eq('CASE A: legacy source retired to the production shape', legacyShape(handle), '0/0/0/0');

    // The C3D corpus builds only LEGACY needs, and _oc_disponibilidade_linhas
    // deliberately excludes them (n.legado = FALSE), so native availability
    // has to be proved on a native lineage. The accepted P1 fixture provides
    // exactly one: need N1 (legado FALSE, OP-origin, OP1) allocated by ALO1.
    await session(handle, scratch, 'caseA-native-fixture', FIXTURE_SQL(ADMIN_UUID));

    // oc_disponibilidade_op is admin-guarded (auth.uid() IS NOT NULL AND
    // is_admin()), so every reading here runs under the real authenticated
    // administrator, never as postgres.
    const availabilityFor = async (opId, label) => {
      const out = await session(handle, scratch, label, `
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_UUID}","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT 'LIQ=' || COALESCE(sum(kg_recebido_liquido),0)::text FROM public.oc_disponibilidade_op(${opId});
COMMIT;`);
      return (out.match(/LIQ=([0-9.]+)/) || [])[1];
    };
    const before = await availabilityFor(OP1, 'caseA-avail-before');
    log('CASE_A_AVAILABILITY_BEFORE', { kg_recebido_liquido: before });

    const saldoRows = scalar(handle, 'SELECT count(*) FROM public.saldo_fios;');
    const aFence = await session(handle, scratch, 'caseA-fence', `${LOCK}
SELECT public.ordem_compra_c3c_fence_and_snapshot(${GEN});`);
    ok('CASE A: fence_and_snapshot SUCCEEDS at cardinality 0', aFence.includes('true'),
      aFence.trim().replace(/\s+/g, ' ').slice(0, 160));
    eq('CASE A: maintenance_fenced/flat reached, PONR still NULL', cutoverState(handle), 'maintenance_fenced/flat/ponrnull');
    eq('CASE A: source snapshot is empty and complete',
      scalar(handle, 'SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot;'), '0');
    eq('CASE A: inventory baseline captured every saldo_fios row',
      scalar(handle, 'SELECT count(*) FROM public.ordem_compra_cutover_inventory_baseline;'), saldoRows);

    const aPurge = await session(handle, scratch, 'caseA-purge', `${LOCK}
SELECT public.ordem_compra_c3c_purge_generation(${GEN});`);
    ok('CASE A: purge_generation SUCCEEDS', aPurge.includes('true'), aPurge.trim().replace(/\s+/g, ' ').slice(0, 160));
    eq('CASE A: staging tables back to zero',
      scalar(handle, `SELECT (SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot) || '/' ||
        (SELECT count(*) FROM public.ordem_compra_cutover_inventory_baseline);`), '0/0');
    eq('CASE A: all five receipt-writer guards re-enabled',
      scalar(handle, `SELECT count(*)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace='public'::regnamespace AND t.tgenabled='D'
          AND t.tgname IN ('trg_lancamento_append_only_guard','trg_lancamento_estorno_guard',
            'trg_recebimento_movimento_immutable_guard','trg_recebimento_header_immutable_guard',
            'trg_c3c_command_state_guard');`), '0');

    // P3-style synthetic productive seed, still inside the maintenance
    // window, on the NATIVE allocation ALO1. Owner/setup identity only, and
    // deliberately NOT under replica role: it must pass the real
    // trg_c3c_command_state_guard and trg_native_lancamento_shape_guard.
    const seedAxis = scalar(handle, `SELECT i.material || '|' || COALESCE(i.cor_id::text,'NULL')
      FROM public.ordem_compra_item i WHERE i.id = ${OCI1};`);
    const [material, corId] = seedAxis.split('|');
    log('CASE_A_SEED_TARGET', { allocId: ALO1, itemId: OCI1, orderId: OC1, opId: OP1, material, corId });
    const allocId = ALO1, itemId = OCI1, orderId = OC1, opId = OP1;

    const aSeed = await session(handle, scratch, 'caseA-seed', `${LOCK}
BEGIN;
INSERT INTO public.ordem_compra_recebimentos(
  ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
  ator_id, ator_tipo, ocorrido_em, origem_tipo, origem_ref,
  comando_payload, comando_hash, resultado_metadata)
VALUES (${orderId}, 'import_saldo_inicial', 'legacy_compat_receipt_v1',
  'db112:caseA:seed:1', NULL, 'sistema', clock_timestamp(), 'db112_case_a_seed', NULL,
  '{"probe":"db112-case-a"}'::jsonb, md5('db112:caseA:seed:1'), '{"probe":"db112-case-a"}'::jsonb);
INSERT INTO public.ordem_compra_fio_lancamentos(
  ordem_compra_fio_id, ordem_compra_item_id, kg_recebido, data_recebimento, criado_por,
  tipo, idempotency_key, origem_tipo, origem_ref, recebimento_id, ordem_compra_id,
  ordem_compra_item_alocacao_id, op_id, material, cor_id, cor_poliester,
  kg_excesso, ator_tipo, linha_indice)
SELECT NULL, ${itemId}, 25.000, NULL, NULL, 'import_saldo_inicial',
  'db112:caseA:seed:1:1', 'db112_case_a_seed', NULL, h.id, ${orderId},
  ${allocId}, ${opId}, '${material}', ${corId}, NULL, 0, 'sistema', 1
FROM public.ordem_compra_recebimentos h WHERE h.idempotency_key = 'db112:caseA:seed:1';
COMMIT;`);
    log('CASE_A_SEED', { out: aSeed.trim().replace(/\s+/g, ' ').slice(0, 120) });
    // Scoped to THIS seed: the P1 fixture already carries its own header.
    eq('CASE A: the guarded synthetic productive lineage was created',
      scalar(handle, `SELECT (SELECT count(*) FROM public.ordem_compra_recebimentos
          WHERE idempotency_key = 'db112:caseA:seed:1'
            AND idempotency_namespace = 'legacy_compat_receipt_v1'
            AND comando_tipo = 'import_saldo_inicial') || '/' ||
        (SELECT count(*) FROM public.ordem_compra_fio_lancamentos l
          JOIN public.ordem_compra_recebimentos h ON h.id = l.recebimento_id
          WHERE h.idempotency_key = 'db112:caseA:seed:1'
            AND l.ordem_compra_item_alocacao_id IS NOT NULL
            AND l.kg_excesso = 0 AND l.kg_recebido = 25.000);`), '1/1');
    eq('CASE A: PONR marker never became non-NULL', cutoverState(handle), 'maintenance_fenced/flat/ponrnull');

    const aResume = await session(handle, scratch, 'caseA-resume', `${LOCK}
SELECT public.ordem_compra_c3c_resume_legacy(${GEN});
SELECT public.ordem_compra_c3c_release_session_lock(${GEN});`);
    ok('CASE A: resume_legacy SUCCEEDS', aResume.includes('legacy_active'),
      aResume.trim().replace(/\s+/g, ' ').slice(0, 160));
    eq('CASE A: legacy_active/flat exactly restored', cutoverState(handle), 'legacy_active/flat/ponrnull');
    eq('CASE A: every restoration field reset',
      scalar(handle, `SELECT (cutover_generation IS NULL AND snapshot_hash IS NULL
        AND inventory_baseline_hash IS NULL AND snapshot_captured_at IS NULL
        AND import_started_at IS NULL AND import_completed_at IS NULL
        AND final_acl_closed_at IS NULL AND canonical_activated_at IS NULL
        AND productive_receipt_started_at IS NULL
        AND reconciliation_status = 'not_started')::text
        FROM public.ordem_compra_cutover WHERE id = 1;`), 'true');

    // Positive native availability from the seeded lineage, under the real
    // authenticated admin identity (never as postgres).
    const after = await availabilityFor(OP1, 'caseA-avail-after');
    const availAuth = await session(handle, scratch, 'caseA-availability', `
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${ADMIN_UUID}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_UUID}","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT 'current_user=' || current_user;
SELECT 'uid=' || COALESCE(auth.uid()::text,'NULL');
SELECT 'liquido=' || COALESCE(sum(kg_recebido_liquido),0)::text FROM public.oc_disponibilidade_op(${opId});
COMMIT;`);
    const liquido = (availAuth.match(/liquido=([0-9.]+)/) || [])[1];
    ok('CASE A: the call really ran as authenticated with a real uid',
      availAuth.includes('current_user=authenticated') && availAuth.includes(`uid=${ADMIN_UUID}`),
      availAuth.trim().replace(/\s+/g, ' ').slice(0, 200));
    eq('CASE A: the authenticated read agrees with the owner read', liquido, after);
    eq('CASE A: availability rose by exactly the seeded 25.000 kg',
      (Number(after) - Number(before)).toFixed(3), '25.000');
    ok('CASE A: seeded lineage yields POSITIVE native availability',
      Number(after) > 0, `before=${before}, after=${after}`);

    console.log(`\n1..${passes + failures}`);
    console.log(failures === 0 ? 'DB112_SUITE_PASS' : `DB112_SUITE_FAIL failures=${failures}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await handle.stop();
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('not ok - suite crashed:', e.message); process.exit(1); });
