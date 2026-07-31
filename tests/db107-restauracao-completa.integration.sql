-- tests/db107-restauracao-completa.integration.sql
--
-- db/107 (9.9.G.2) — pre-PONR cutover restoration, end to end.
--
-- Drives the REAL db/75 machine to the closed-ACL state, proves the
-- close refuses without a manifest, then performs the full accepted
-- restoration order — restore_acl_manifest -> purge_generation ->
-- resume_legacy — and asserts all three post-conditions, including that
-- a SECOND cutover generation can start without an idempotency
-- collision against the purged one.
--
-- HARNESS LIMITATION, stated explicitly. ordem_compra_c3c_import_and_reconcile
-- calls assert_import_reconciled, which HARD-CODES the real production
-- corpus totals and is therefore not runnable against this synthetic
-- 64-row corpus. This suite uses the documented synthetic equivalent:
-- the REAL fence_and_snapshot, a per-snapshot-row import_snapshot_row
-- loop, the REAL assert_snapshot_and_live, and then reconciliation_status
-- set directly as postgres. This is the accepted OBS-3 harness
-- limitation; every function under test here (capture, close, restore,
-- purge, resume) is the real one and is exercised unmodified.

\set ON_ERROR_STOP on

-- A stable serialization of exactly the ACL/policy surface
-- close_final_acl touches, so before/after can be compared by hash.
CREATE OR REPLACE FUNCTION pg_temp.acl_fingerprint() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT md5(coalesce(string_agg(line, E'\n' ORDER BY line), ''))
  FROM (
    SELECT 'T|' || c.relname || '|' ||
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END ||
           '|' || a.privilege_type AS line
      FROM public._oc_c3c_acl_objetos() o
      JOIN pg_class c ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) a
     WHERE a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated','service_role')
    UNION ALL
    SELECT 'C|' || c.relname || '|' || att.attname || '|' ||
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END ||
           '|' || a.privilege_type
      FROM public._oc_c3c_acl_objetos() o
      JOIN pg_class c ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
      JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum > 0
       AND NOT att.attisdropped AND att.attacl IS NOT NULL
      CROSS JOIN LATERAL aclexplode(att.attacl) a
     WHERE a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated','service_role')
    UNION ALL
    SELECT 'P|' || c.relname || '|' || pol.polname || '|' ||
           coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || '|' ||
           coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      FROM public._oc_c3c_acl_objetos() o
      JOIN pg_class c ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
      JOIN pg_policy pol ON pol.polrelid = c.oid
     WHERE 0::oid = ANY (pol.polroles)
  ) s;
$$;

DO $t$
DECLARE
  g1        CONSTANT BIGINT := 9401;
  g2        CONSTANT BIGINT := 9402;
  v_acl_pre  TEXT;
  v_acl_post TEXT;
  v_acl_rest TEXT;
  v_snap     RECORD;
  v_n        INTEGER;
  v_saldo_pre  TEXT;
  v_saldo_post TEXT;
  v_denied   BOOLEAN;
  v_guards   INTEGER;
  v_res      JSONB;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'not ok - this suite must run as postgres';
  END IF;

  SELECT md5(coalesce(string_agg(s.tipo || '|' || coalesce(s.cor_id::TEXT,'-') || '|' ||
                                 coalesce(s.cor_poliester,'-') || '|' || s.kg_total::TEXT,
                                 E'\n' ORDER BY s.id), ''))
    INTO v_saldo_pre FROM public.saldo_fios s;

  -- =================================================================
  -- A. DRIVE THE REAL MACHINE TO THE CLOSED-ACL STATE
  -- =================================================================
  PERFORM public.ordem_compra_c3c_acquire_session_lock(g1);
  PERFORM public.ordem_compra_c3c_fence_and_snapshot(g1);

  SELECT count(*) INTO v_n FROM public.ordem_compra_cutover_source_snapshot;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'not ok - A1: fence_and_snapshot captured no source snapshot';
  END IF;
  SELECT count(*) INTO v_n FROM public.ordem_compra_cutover_inventory_baseline;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'not ok - A2: TD1 requires the saldo_fios rows captured verbatim into the baseline';
  END IF;

  PERFORM public.ordem_compra_c3c_lock_import_resources(g1);
  FOR v_snap IN SELECT id FROM public.ordem_compra_cutover_source_snapshot ORDER BY stable_position LOOP
    PERFORM public.ordem_compra_c3c_import_snapshot_row(v_snap.id);
  END LOOP;
  PERFORM public.ordem_compra_c3c_assert_snapshot_and_live(g1);

  SELECT count(*) INTO v_n FROM public.ordem_compra_recebimentos
   WHERE idempotency_namespace = 'legacy_initial_balance_v1';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'not ok - A3: the import produced no command header';
  END IF;
  RAISE NOTICE 'ok - A: generation % fenced, snapshot captured and % import header(s) created', g1, v_n;

  -- Synthetic equivalent of assert_import_reconciled (see the header note).
  UPDATE public.ordem_compra_cutover SET reconciliation_status = 'reconciled' WHERE id = 1;
  PERFORM public.ordem_compra_c3c_set_canonical_read(g1);

  v_acl_pre := pg_temp.acl_fingerprint();

  -- =================================================================
  -- B. close_final_acl REFUSES WITHOUT A CAPTURED MANIFEST
  -- =================================================================
  v_denied := FALSE;
  BEGIN
    PERFORM public.ordem_compra_c3c_close_final_acl(g1);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%acl_manifest_ausente%' THEN v_denied := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - B: close_final_acl closed the ACL with no manifest to restore from';
  END IF;
  RAISE NOTICE 'ok - B: close_final_acl refuses with acl_manifest_ausente until a manifest exists';

  -- =================================================================
  -- C. CAPTURE, THEN CLOSE
  -- =================================================================
  v_res := public.ordem_compra_c3c_capture_acl_manifest(g1);
  IF (v_res ->> 'table_grants')::INTEGER = 0 THEN
    RAISE EXCEPTION 'not ok - C1: the manifest captured no relation grant';
  END IF;
  RAISE NOTICE 'ok - C1: manifest captured — % table, % column, % policy, % function entries',
    v_res ->> 'table_grants', v_res ->> 'column_grants', v_res ->> 'policies', v_res ->> 'function_grants';

  PERFORM public.ordem_compra_c3c_close_final_acl(g1);
  v_acl_post := pg_temp.acl_fingerprint();
  IF v_acl_post = v_acl_pre THEN
    RAISE EXCEPTION 'not ok - C2: close_final_acl changed nothing, so the restoration proof would be vacuous';
  END IF;
  RAISE NOTICE 'ok - C2: close_final_acl really revoked — acl pre=% post=%', left(v_acl_pre,12), left(v_acl_post,12);

  -- =================================================================
  -- D. RESTORE THE ACL/POLICY STATE EXACTLY
  -- =================================================================
  v_res := public.ordem_compra_c3c_restore_acl_manifest(g1);
  v_acl_rest := pg_temp.acl_fingerprint();
  IF v_acl_rest <> v_acl_pre THEN
    RAISE EXCEPTION 'not ok - D1: restored ACL hash % does not equal the pre-close hash %', v_acl_rest, v_acl_pre;
  END IF;
  RAISE NOTICE 'ok - D1: ACL/policy state restored EXACTLY — hash % matches pre-close', left(v_acl_rest,12);

  -- Idempotent: a second replay converges to the same state.
  PERFORM public.ordem_compra_c3c_restore_acl_manifest(g1);
  IF pg_temp.acl_fingerprint() <> v_acl_pre THEN
    RAISE EXCEPTION 'not ok - D2: the restore is not idempotent';
  END IF;
  RAISE NOTICE 'ok - D2: restore_acl_manifest is idempotent';

  -- =================================================================
  -- E. GENERATION-SCOPED PURGE
  -- =================================================================
  SELECT count(*) INTO v_n FROM public.ordem_compra_fio_lancamentos
   WHERE tipo <> 'import_saldo_inicial';
  v_res := public.ordem_compra_c3c_purge_generation(g1);

  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos
              WHERE idempotency_namespace = 'legacy_initial_balance_v1')
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos WHERE tipo = 'import_saldo_inicial')
     OR EXISTS (SELECT 1 FROM public.ordem_compra_cutover_source_snapshot)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_cutover_inventory_baseline) THEN
    RAISE EXCEPTION 'not ok - E1: the imported footprint is not zero after the purge';
  END IF;

  -- UNRELATED facts survive: the fixture's own native receipt ledger.
  IF (SELECT count(*) FROM public.ordem_compra_fio_lancamentos
       WHERE tipo <> 'import_saldo_inicial') <> v_n THEN
    RAISE EXCEPTION 'not ok - E2: the purge removed unrelated ledger facts';
  END IF;

  -- ALL FIVE GUARDS ARE RE-ENABLED.
  SELECT count(*) INTO v_guards
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace
     AND t.tgname IN ('trg_lancamento_append_only_guard',
                      'trg_lancamento_estorno_guard',
                      'trg_recebimento_movimento_immutable_guard',
                      'trg_recebimento_header_immutable_guard',
                      'trg_c3c_command_state_guard');
  IF v_guards <> 5 THEN
    RAISE EXCEPTION 'not ok - E3: expected the five accepted guards, found %', v_guards;
  END IF;
  SELECT count(*) INTO v_guards
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace
     AND t.tgname IN ('trg_lancamento_append_only_guard',
                      'trg_lancamento_estorno_guard',
                      'trg_recebimento_movimento_immutable_guard',
                      'trg_recebimento_header_immutable_guard',
                      'trg_c3c_command_state_guard')
     AND t.tgenabled = 'D';
  IF v_guards <> 0 THEN
    RAISE EXCEPTION 'not ok - E4: % guard(s) remain tgenabled = D after the purge', v_guards;
  END IF;
  RAISE NOTICE 'ok - E: purge removed only the import footprint (% lanc, % rec) and re-enabled all five guards',
    v_res ->> 'lancamentos', v_res ->> 'recebimentos';

  -- TD1: the preserved rows are untouched.
  SELECT md5(coalesce(string_agg(s.tipo || '|' || coalesce(s.cor_id::TEXT,'-') || '|' ||
                                 coalesce(s.cor_poliester,'-') || '|' || s.kg_total::TEXT,
                                 E'\n' ORDER BY s.id), ''))
    INTO v_saldo_post FROM public.saldo_fios s;
  IF v_saldo_post <> v_saldo_pre THEN
    RAISE EXCEPTION 'not ok - E5: TD1 violation — saldo_fios changed across the cutover and purge';
  END IF;
  RAISE NOTICE 'ok - E5: TD1 holds — the preserved saldo_fios rows are byte-identical (hash %)', left(v_saldo_post,12);

  -- =================================================================
  -- F. FULL FIELD RESET BACK TO legacy_active / flat
  -- =================================================================
  PERFORM public.ordem_compra_c3c_resume_legacy(g1);
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat'
     AND cutover_generation IS NULL AND snapshot_hash IS NULL
     AND inventory_baseline_hash IS NULL AND snapshot_captured_at IS NULL
     AND import_started_at IS NULL AND import_completed_at IS NULL
     AND final_acl_closed_at IS NULL AND canonical_activated_at IS NULL
     AND productive_receipt_started_at IS NULL AND reconciliation_status = 'not_started';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not ok - F: resume_legacy did not satisfy the legacy_active branch of the state check';
  END IF;
  PERFORM public.ordem_compra_c3c_release_session_lock(g1);
  RAISE NOTICE 'ok - F: resume_legacy reset every field the legacy_active constraint branch requires';

  -- =================================================================
  -- G. A SECOND GENERATION CANNOT COLLIDE WITH THE PURGED ONE
  -- =================================================================
  PERFORM public.ordem_compra_c3c_acquire_session_lock(g2);
  PERFORM public.ordem_compra_c3c_fence_and_snapshot(g2);
  PERFORM public.ordem_compra_c3c_lock_import_resources(g2);
  FOR v_snap IN SELECT id FROM public.ordem_compra_cutover_source_snapshot ORDER BY stable_position LOOP
    PERFORM public.ordem_compra_c3c_import_snapshot_row(v_snap.id);
  END LOOP;
  PERFORM public.ordem_compra_c3c_assert_snapshot_and_live(g2);
  SELECT count(*) INTO v_n FROM public.ordem_compra_recebimentos
   WHERE idempotency_namespace = 'legacy_initial_balance_v1';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'not ok - G1: the second generation imported nothing';
  END IF;
  RAISE NOTICE 'ok - G: a SECOND cutover generation imported % header(s) with no idempotency collision', v_n;

  -- Return the cluster to legacy_active for the suites that follow.
  UPDATE public.ordem_compra_cutover SET reconciliation_status = 'reconciled' WHERE id = 1;
  PERFORM public.ordem_compra_c3c_set_canonical_read(g2);
  PERFORM public.ordem_compra_c3c_capture_acl_manifest(g2);
  PERFORM public.ordem_compra_c3c_close_final_acl(g2);
  PERFORM public.ordem_compra_c3c_restore_acl_manifest(g2);
  PERFORM public.ordem_compra_c3c_purge_generation(g2);
  PERFORM public.ordem_compra_c3c_resume_legacy(g2);
  PERFORM public.ordem_compra_c3c_release_session_lock(g2);

  IF pg_temp.acl_fingerprint() <> v_acl_pre THEN
    RAISE EXCEPTION 'not ok - G2: the second restoration did not converge to the original ACL state';
  END IF;
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not ok - G3: the cluster did not return to legacy_active / flat';
  END IF;
  RAISE NOTICE 'ok - G2: the second generation restored to the identical ACL state and legacy_active / flat';

  -- =================================================================
  -- H. NO RESTORATION FUNCTION IS GRANTED TO A CLIENT ROLE
  -- =================================================================
  IF EXISTS (
    SELECT 1 FROM (VALUES
        ('public.ordem_compra_c3c_capture_acl_manifest(bigint)'),
        ('public.ordem_compra_c3c_restore_acl_manifest(bigint)'),
        ('public.ordem_compra_c3c_purge_generation(bigint)'),
        ('public.ordem_compra_c3c_resume_legacy(bigint)')) AS f(fn)
      CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) AS r(rn)
     WHERE has_function_privilege(r.rn, f.fn, 'EXECUTE')) THEN
    RAISE EXCEPTION 'not ok - H: a restoration function is reachable by a client role';
  END IF;
  RAISE NOTICE 'ok - H: no restoration function is granted to any client role';
END
$t$;

SELECT 'DB107_RESTAURACAO_PASS' AS marker;
