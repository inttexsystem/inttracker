-- =====================================================================
-- db/112 — CUTOVER SNAPSHOT COMPLETENESS INVARIANT FORWARD CORRECTION
--
-- NATIVE-RECEIPT-CUTOVER-SNAPSHOT-CARDINALITY-ROOT-CAUSE-CORRECTION-R1.
--
-- WHY THIS EXISTS. db/75 froze two migration-time dataset cardinalities
-- as structural invariants of the C3C cutover machine:
--
--   1. ordem_compra_c3c_fence_and_snapshot:
--        IF v_source_count <> 51 THEN RAISE 'snapshot_mapping_count_mismatch'
--   2. ordem_compra_c3c_assert_import_reconciled:
--        IF v_headers <> 39 OR v_lines <> 44 OR v_total <> 20221.280
--           OR v_excess <> 405.980 ...
--
-- Those five numbers are the measured shape of the db/67 REFUND-A seed:
-- the 64-row ordens_compra_fio corpus classified 27/12/13/12 (A/B/C/D),
-- of which Class A/B/D (51 rows) received a purchase-order header, item,
-- allocation and compat mapping, and of which the 39 rows carrying
-- received material (Class A 27 + Class D 12) reconstruct 44 ledger lines
-- totalling 20221.280 kg with 405.980 kg of excess.
--
-- They were a DATASET CARDINALITY, never a business invariant. The legacy
-- corpus has since been fully retired in production: ordens_compra_fio and
-- ordem_compra_item_compat_fio both hold zero rows, and no row anywhere
-- carries legado = TRUE. The frozen constants therefore make the ONLY
-- canonical transition into maintenance_fenced permanently unreachable —
-- fence_and_snapshot raises snapshot_mapping_count_mismatch on a source
-- set that is legitimately empty and completely represented — and, once
-- that is repaired, assert_import_reconciled would immediately refuse the
-- next step for the same reason. Proved by direct runtime probe against a
-- disposable restore of production.
--
-- WHAT THIS CHANGES. The cutover now validates COMPLETENESS instead of a
-- historical magic number. A legitimately empty source set succeeds
-- because it is complete; an incomplete or ambiguous one still fails
-- closed, on named and specific errors.
--
-- ADDITIVITY. Two CREATE OR REPLACE FUNCTION statements on INACTIVE,
-- owner-only cutover administration functions. Both are executable only by
-- postgres under a held session lock. No table, column, constraint,
-- trigger, policy, grant or product behaviour changes. The cutover row is
-- untouched and remains legacy_active / flat. CREATE OR REPLACE preserves
-- ownership and ACL; the REVOKE statements are restated as defence in
-- depth so a future DROP/CREATE cannot silently reopen PUBLIC EXECUTE.
--
-- NOT IN SCOPE. db/103b, db/104, db/106 and db/110 remain RESERVED and
-- uncreated. The native receipt remains inactive. No production database
-- is mutated by committing this file.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------
-- 1. fence_and_snapshot — derived completeness invariant
--
-- The snapshot is built from the four-way join
--   ordens_compra_fio f
--     JOIN ordem_compra_item_compat_fio c ON c.ordens_compra_fio_id = f.id
--     JOIN ordem_compra_item             i ON i.id = c.ordem_compra_item_id
--     JOIN ordem_compra_item_alocacao    a ON a.item_id = i.id
--
-- so a source row silently disappears from the snapshot when it has no
-- compat mapping, or when its mapped item has no allocation; and a source
-- row is silently DUPLICATED when its mapped item carries more than one
-- allocation. Each of those is a reconciliation-fidelity loss that the old
-- `<> 51` test could only catch by accident. The replacement names them.
--
-- C1 NO LOST MATERIAL. An unmapped flat row is legitimate only when it
--    carries no received material — that is exactly db/67 Class C
--    (rascunho + pendente), which by construction gets a need and no
--    header. A flat row with kg_recebido <> 0 and no mapping would have
--    its balance dropped by the join and never imported.
-- C2 RESOLVABLE MAPPING. A mapped item with no allocation is dropped
--    entirely by the join.
-- C3 UNAMBIGUOUS ATTRIBUTION. A mapped item with more than one allocation
--    multiplies its flat row across snapshot rows, double-counting
--    kg_recebido in source_snapshot_total_kg. This is not merely
--    defensive: ordem_compra_c3c_import_snapshot_row derives the import
--    header idempotency key as 'c3c_snapshot:<cutover>:<generation>:<flat_row_id>',
--    which structurally assumes ONE snapshot row per flat row, so a second
--    row for the same flat id would collide as idempotencia_conflitante
--    deep inside the import. Failing here is earlier and specific.
-- C4 DERIVED CARDINALITY. With C2 and C3 satisfied the snapshot must hold
--    exactly one row per mapping. Retained as defence in depth against any
--    future join anomaly, and it keeps the original error identity
--    snapshot_mapping_count_mismatch for the original failure mode.
-- C5 INVENTORY COMPLETENESS. The inventory baseline must represent every
--    saldo_fios row. This was previously unchecked at capture time.
--    saldo_fios carries a UNIQUE (tipo, COALESCE(cor_id,0),
--    COALESCE(cor_poliester,'')) index, so the stable_position ordering
--    used by the serialization is deterministic.
--
-- The row locks are widened from "mapped flat rows" to "all flat rows",
-- because C1 now reads the unmapped ones. It is a strict superset taken in
-- the same table and the same id order, so lock ordering is unchanged.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_fence_and_snapshot(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_serialization TEXT;
  v_inventory_serialization TEXT;
  v_source_count INTEGER;
  v_inventory_count INTEGER;
  v_source_total NUMERIC(15,3);
  v_inventory_total NUMERIC(15,3);
  v_expected_source_count INTEGER;
  v_expected_inventory_count INTEGER;
  v_offenders INTEGER;
BEGIN
  IF current_user <> 'postgres'
     OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;
  PERFORM 1 FROM public.ordem_compra_cutover
  WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat'
    AND reconciliation_status = 'not_started'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000'; END IF;
  UPDATE public.ordem_compra_cutover
  SET status = 'maintenance_fenced', cutover_generation = p_generation
  WHERE id = 1;

  PERFORM 1 FROM public.ordens_compra_fio ORDER BY id FOR UPDATE;
  PERFORM 1
  FROM public.ordens_compra_fio f
  JOIN public.ordem_compra_item_compat_fio c ON c.ordens_compra_fio_id = f.id
  ORDER BY f.id, c.id FOR UPDATE OF f, c;
  PERFORM 1 FROM public.saldo_fios
  ORDER BY tipo, cor_id NULLS FIRST, cor_poliester NULLS FIRST FOR UPDATE;
  PERFORM 1
  FROM public.ordem_compra_item i
  JOIN public.ordem_compra_item_alocacao a ON a.item_id = i.id
  ORDER BY i.id, a.id FOR UPDATE OF i, a;
  PERFORM 1 FROM public.ordem_compra o
  WHERE EXISTS (SELECT 1 FROM public.ordem_compra_item i WHERE i.ordem_id = o.id)
  ORDER BY o.id FOR UPDATE;

  -- C1. Every flat row carrying received material must be mapped.
  SELECT count(*) INTO v_offenders
  FROM public.ordens_compra_fio f
  WHERE COALESCE(f.kg_recebido, 0) <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.ordem_compra_item_compat_fio c
       WHERE c.ordens_compra_fio_id = f.id);
  IF v_offenders > 0 THEN
    RAISE EXCEPTION 'snapshot_unmapped_source_row' USING ERRCODE = '55000',
      DETAIL = format('%s ordens_compra_fio row(s) carry received material but have no ordem_compra_item_compat_fio mapping; the snapshot join would silently drop them', v_offenders);
  END IF;

  -- C2. Every mapped item must resolve to at least one allocation.
  SELECT count(*) INTO v_offenders
  FROM public.ordem_compra_item_compat_fio c
  JOIN public.ordens_compra_fio f ON f.id = c.ordens_compra_fio_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_item_alocacao a
     WHERE a.item_id = c.ordem_compra_item_id);
  IF v_offenders > 0 THEN
    RAISE EXCEPTION 'snapshot_incomplete_mapping' USING ERRCODE = '55000',
      DETAIL = format('%s mapped ordem_compra_item row(s) carry no ordem_compra_item_alocacao; the snapshot join would silently drop them', v_offenders);
  END IF;

  -- C3. No mapped item may carry more than one allocation.
  SELECT count(*) INTO v_offenders
  FROM (
    SELECT c.id
    FROM public.ordem_compra_item_compat_fio c
    JOIN public.ordens_compra_fio f ON f.id = c.ordens_compra_fio_id
    JOIN public.ordem_compra_item_alocacao a ON a.item_id = c.ordem_compra_item_id
    GROUP BY c.id HAVING count(a.id) > 1
  ) ambiguous;
  IF v_offenders > 0 THEN
    RAISE EXCEPTION 'snapshot_ambiguous_mapping' USING ERRCODE = '55000',
      DETAIL = format('%s mapped ordem_compra_item row(s) carry more than one allocation; the flat row would be duplicated across snapshot rows and its received kg counted more than once', v_offenders);
  END IF;

  SELECT count(*) INTO v_expected_source_count
  FROM public.ordem_compra_item_compat_fio c
  JOIN public.ordens_compra_fio f ON f.id = c.ordens_compra_fio_id;

  SELECT count(*) INTO v_expected_inventory_count FROM public.saldo_fios;

  WITH source_rows AS (
    SELECT row_number() OVER (ORDER BY f.id, c.id, i.id, a.id) AS stable_position,
           c.id AS mapping_id, f.id AS flat_row_id, i.ordem_id, i.id AS item_id,
           a.id AS allocation_id, a.necessidade_id, a.op_id,
           CASE WHEN f.status_administrativo = 'rascunho' AND f.status = 'recebido_total' THEN 'D'
                WHEN f.status_administrativo = 'emitida' AND f.status = 'recebido_total' THEN 'A'
                ELSE 'B' END AS legacy_class,
           i.material, i.cor_id, i.cor_poliester, f.kg_pedido,
           COALESCE(f.kg_recebido, 0) AS kg_recebido,
           LEAST(COALESCE(f.kg_recebido, 0), a.kg_alocado) AS kg_atribuido,
           GREATEST(COALESCE(f.kg_recebido, 0) - a.kg_alocado, 0) AS kg_excesso
    FROM public.ordens_compra_fio f
    JOIN public.ordem_compra_item_compat_fio c ON c.ordens_compra_fio_id = f.id
    JOIN public.ordem_compra_item i ON i.id = c.ordem_compra_item_id
    JOIN public.ordem_compra_item_alocacao a ON a.item_id = i.id
  ), serialized AS (
    SELECT r.*, public.ordem_compra_c3c_source_canonical_line(
      p_generation, r.stable_position, r.flat_row_id, r.mapping_id,
      r.ordem_id, r.item_id, r.allocation_id, r.necessidade_id, r.op_id,
      r.legacy_class, r.material, r.cor_id, r.cor_poliester, r.kg_pedido,
      r.kg_recebido, r.kg_atribuido, r.kg_excesso
    ) AS canonical_line
    FROM source_rows r
  )
  INSERT INTO public.ordem_compra_cutover_source_snapshot(
    cutover_id, stable_position, mapping_id, flat_row_id, ordem_compra_id,
    item_id, allocation_id, necessidade_id, op_id, legacy_class, material,
    cor_id, cor_poliester, kg_pedido, kg_recebido, kg_atribuido, kg_excesso,
    canonical_line, row_sha256
  )
  SELECT 1, stable_position, mapping_id, flat_row_id, ordem_id, item_id,
         allocation_id, necessidade_id, op_id, legacy_class, material, cor_id,
         cor_poliester, kg_pedido, kg_recebido, kg_atribuido, kg_excesso,
         canonical_line, encode(extensions.digest(canonical_line, 'sha256'), 'hex')
  FROM serialized ORDER BY stable_position;

  WITH inventory_rows AS (
    SELECT row_number() OVER (
             ORDER BY tipo, cor_id NULLS FIRST, cor_poliester NULLS FIRST
           ) AS stable_position,
           tipo AS material, cor_id, cor_poliester, kg_total
    FROM public.saldo_fios
  ), serialized AS (
    SELECT r.*, public.ordem_compra_c3c_inventory_canonical_line(
      p_generation, r.stable_position, r.material, r.cor_id,
      r.cor_poliester, r.kg_total
    ) AS canonical_line
    FROM inventory_rows r
  )
  INSERT INTO public.ordem_compra_cutover_inventory_baseline(
    cutover_id, stable_position, material, cor_id, cor_poliester, kg_total,
    canonical_line, row_sha256
  )
  SELECT 1, stable_position, material, cor_id, cor_poliester, kg_total,
         canonical_line, encode(extensions.digest(canonical_line, 'sha256'), 'hex')
  FROM serialized ORDER BY stable_position;

  SELECT count(*), COALESCE(sum(kg_recebido), 0), COALESCE(string_agg(canonical_line, E'\n' ORDER BY stable_position), '')
  INTO v_source_count, v_source_total, v_source_serialization
  FROM public.ordem_compra_cutover_source_snapshot WHERE cutover_id = 1;
  SELECT count(*), COALESCE(sum(kg_total), 0), COALESCE(string_agg(canonical_line, E'\n' ORDER BY stable_position), '')
  INTO v_inventory_count, v_inventory_total, v_inventory_serialization
  FROM public.ordem_compra_cutover_inventory_baseline WHERE cutover_id = 1;

  -- C4. Derived cardinality agreement (original error identity preserved).
  IF v_source_count <> v_expected_source_count THEN
    RAISE EXCEPTION 'snapshot_mapping_count_mismatch' USING ERRCODE = '55000',
      DETAIL = format('snapshot holds %s row(s) but the derived source set has %s mapping(s)', v_source_count, v_expected_source_count);
  END IF;

  -- C5. Inventory baseline completeness.
  IF v_inventory_count <> v_expected_inventory_count THEN
    RAISE EXCEPTION 'inventory_baseline_count_mismatch' USING ERRCODE = '55000',
      DETAIL = format('inventory baseline holds %s row(s) but saldo_fios has %s', v_inventory_count, v_expected_inventory_count);
  END IF;

  UPDATE public.ordem_compra_cutover SET
    source_snapshot_count = v_source_count,
    source_snapshot_total_kg = v_source_total,
    source_snapshot_serialization = v_source_serialization,
    snapshot_hash = encode(extensions.digest(v_source_serialization, 'sha256'), 'hex'),
    inventory_baseline_count = v_inventory_count,
    inventory_baseline_total_kg = v_inventory_total,
    inventory_baseline_serialization = v_inventory_serialization,
    inventory_baseline_hash = encode(extensions.digest(v_inventory_serialization, 'sha256'), 'hex'),
    snapshot_captured_at = clock_timestamp(), reconciliation_status = 'previewed'
  WHERE id = 1;
  RETURN jsonb_build_object('ok', true, 'mapping_count', v_source_count,
    'source_total_kg', to_char(v_source_total, 'FM999999999990.000'),
    'inventory_count', v_inventory_count,
    'inventory_total_kg', to_char(v_inventory_total, 'FM999999999990.000'));
END;
$$;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_fence_and_snapshot(BIGINT) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. assert_import_reconciled — expectations derived from the snapshot
--
-- The four frozen totals are replaced by the same quantities computed from
-- the snapshot that the import actually consumed:
--
--   headers  = one per snapshot row with kg_recebido > 0, because
--              import_and_reconcile loops exactly
--              "WHERE kg_recebido > 0" and import_snapshot_row creates one
--              header per row;
--   lines    = per received row, (kg_atribuido > 0) + (kg_excesso > 0).
--              This is not a new rule: import_snapshot_row already writes
--              that exact figure into the command payload as
--              'expected_line_count' and re-asserts it on replay;
--   total kg = sum(kg_recebido) over the received rows;
--   excess   = sum(kg_excesso), already derived before this change.
--
-- v_movements <> 0 is RETAINED as a literal, because "the initial-balance
-- import creates no inventory movement" is a structural invariant of the
-- import, not a dataset cardinality.
--
-- Against the historical db/67 corpus these expressions evaluate to
-- 39 / 44 / 20221.280 / 405.980 — the same four numbers, now derived
-- rather than asserted.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_assert_import_reconciled(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state public.ordem_compra_cutover%ROWTYPE;
  v_headers INTEGER; v_lines INTEGER; v_movements INTEGER;
  v_total NUMERIC(15,3); v_excess NUMERIC(15,3); v_attributed NUMERIC(15,3);
  v_expected_attributed NUMERIC(15,3); v_expected_excess NUMERIC(15,3);
  v_expected_headers INTEGER; v_expected_lines INTEGER;
  v_expected_total NUMERIC(15,3);
BEGIN
  SELECT * INTO v_state FROM public.ordem_compra_cutover WHERE id = 1;
  IF NOT FOUND OR v_state.cutover_generation <> p_generation THEN
    RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000';
  END IF;
  IF v_state.productive_receipt_started_at IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.ordem_compra_recebimentos
    WHERE idempotency_namespace = 'native_receipt_v1' AND comando_tipo = 'recebimento'
  ) THEN RAISE EXCEPTION 'productive_receipt_exists' USING ERRCODE = '55000'; END IF;
  IF EXISTS (
    SELECT s.id
    FROM public.ordem_compra_cutover_source_snapshot s
    LEFT JOIN public.ordem_compra_recebimentos h
      ON h.idempotency_namespace = 'legacy_initial_balance_v1'
     AND h.comando_payload ->> 'cutover_generation' = p_generation::TEXT
     AND h.comando_payload ->> 'snapshot_hash' = v_state.snapshot_hash
     AND h.comando_payload ->> 'snapshot_row_id' = s.id::TEXT
    WHERE s.cutover_id = 1 AND s.kg_recebido > 0
    GROUP BY s.id HAVING count(h.id) <> 1
  ) THEN RAISE EXCEPTION 'import_reconciliation_mismatch' USING ERRCODE = '55000'; END IF;
  SELECT count(DISTINCT h.id), count(l.id), COALESCE(sum(l.kg_recebido),0),
         COALESCE(sum(l.kg_excesso),0),
         COALESCE(sum(l.kg_recebido) FILTER (WHERE l.ordem_compra_item_alocacao_id IS NOT NULL),0)
  INTO v_headers, v_lines, v_total, v_excess, v_attributed
  FROM public.ordem_compra_recebimentos h
  LEFT JOIN public.ordem_compra_fio_lancamentos l ON l.recebimento_id = h.id
  WHERE h.idempotency_namespace = 'legacy_initial_balance_v1'
    AND h.comando_payload ->> 'cutover_generation' = p_generation::TEXT
    AND h.comando_payload ->> 'snapshot_hash' = v_state.snapshot_hash;
  SELECT COALESCE(sum(kg_atribuido),0), COALESCE(sum(kg_excesso),0),
         count(*) FILTER (WHERE kg_recebido > 0),
         COALESCE(sum((CASE WHEN kg_atribuido > 0 THEN 1 ELSE 0 END)
                    + (CASE WHEN kg_excesso   > 0 THEN 1 ELSE 0 END))
                  FILTER (WHERE kg_recebido > 0), 0),
         COALESCE(sum(kg_recebido) FILTER (WHERE kg_recebido > 0), 0)
  INTO v_expected_attributed, v_expected_excess, v_expected_headers,
       v_expected_lines, v_expected_total
  FROM public.ordem_compra_cutover_source_snapshot WHERE cutover_id = 1;
  SELECT count(*) INTO v_movements
  FROM public.ordem_compra_fio_movimentos_estoque m
  JOIN public.ordem_compra_fio_lancamentos l ON l.id = m.lancamento_id
  JOIN public.ordem_compra_recebimentos h ON h.id = l.recebimento_id
  WHERE h.idempotency_namespace = 'legacy_initial_balance_v1'
    AND h.comando_payload ->> 'cutover_generation' = p_generation::TEXT
    AND h.comando_payload ->> 'snapshot_hash' = v_state.snapshot_hash;
  IF v_headers <> v_expected_headers OR v_lines <> v_expected_lines
     OR v_total <> v_expected_total OR v_movements <> 0
     OR v_attributed <> v_expected_attributed OR v_excess <> v_expected_excess
     OR v_total <> v_attributed + v_excess THEN
    RAISE EXCEPTION 'import_reconciliation_mismatch' USING ERRCODE = '55000',
      DETAIL = format('headers %s/%s, lines %s/%s, total %s/%s, attributed %s/%s, excess %s/%s, movements %s',
        v_headers, v_expected_headers, v_lines, v_expected_lines,
        v_total, v_expected_total, v_attributed, v_expected_attributed,
        v_excess, v_expected_excess, v_movements);
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ordem_compra_recebimentos h
    JOIN public.ordem_compra_fio_lancamentos l ON l.recebimento_id = h.id
    JOIN public.ordem_compra_cutover_source_snapshot s
      ON h.comando_payload ->> 'snapshot_row_id' = s.id::TEXT
    WHERE h.idempotency_namespace = 'legacy_initial_balance_v1'
      AND h.comando_payload ->> 'cutover_generation' = p_generation::TEXT
      AND h.comando_payload ->> 'snapshot_hash' = v_state.snapshot_hash
      AND ((l.ordem_compra_item_alocacao_id IS NOT NULL AND l.op_id IS DISTINCT FROM s.op_id)
        OR (l.ordem_compra_item_alocacao_id IS NULL AND l.op_id IS NOT NULL))
  ) THEN RAISE EXCEPTION 'import_reconciliation_mismatch' USING ERRCODE = '55000'; END IF;
  PERFORM public.ordem_compra_c3c_assert_snapshot_and_live(p_generation);
  RETURN jsonb_build_object('ok', true, 'headers', v_headers, 'ledger_lines', v_lines,
    'reconstructed_kg', to_char(v_total, 'FM999999999990.000'),
    'excess_kg', to_char(v_excess, 'FM999999999990.000'),
    'inventory_movements', v_movements);
END;
$$;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_assert_import_reconciled(BIGINT) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Self-verification.
-- ---------------------------------------------------------------------
DO $db112$
DECLARE
  v_src TEXT;
  v_bad TEXT := '';
BEGIN
  -- 3.1 Neither function may retain a frozen historical cardinality.
  SELECT p.prosrc INTO v_src FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'ordem_compra_c3c_fence_and_snapshot';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'db/112: ordem_compra_c3c_fence_and_snapshot is absent';
  END IF;
  IF v_src LIKE '%v_source_count <> 51%' THEN
    RAISE EXCEPTION 'db/112: the frozen 51-row assertion survived the replacement';
  END IF;
  IF v_src NOT LIKE '%snapshot_unmapped_source_row%'
     OR v_src NOT LIKE '%snapshot_incomplete_mapping%'
     OR v_src NOT LIKE '%snapshot_ambiguous_mapping%'
     OR v_src NOT LIKE '%snapshot_mapping_count_mismatch%'
     OR v_src NOT LIKE '%inventory_baseline_count_mismatch%' THEN
    RAISE EXCEPTION 'db/112: the completeness invariant is not fully installed';
  END IF;

  SELECT p.prosrc INTO v_src FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'ordem_compra_c3c_assert_import_reconciled';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'db/112: ordem_compra_c3c_assert_import_reconciled is absent';
  END IF;
  IF v_src LIKE '%<> 39%' OR v_src LIKE '%<> 44%'
     OR v_src LIKE '%20221.280%' OR v_src LIKE '%405.980%' THEN
    RAISE EXCEPTION 'db/112: a frozen import total survived the replacement';
  END IF;
  IF v_src NOT LIKE '%v_expected_headers%' OR v_src NOT LIKE '%v_expected_lines%'
     OR v_src NOT LIKE '%v_expected_total%' THEN
    RAISE EXCEPTION 'db/112: the derived import expectations are not installed';
  END IF;
  -- The structural no-inventory-movement invariant must survive.
  IF v_src NOT LIKE '%v_movements <> 0%' THEN
    RAISE EXCEPTION 'db/112: the no-inventory-movement invariant was lost';
  END IF;

  -- 3.2 Both remain owner-only, SECURITY DEFINER, search_path-pinned.
  SELECT string_agg(p.proname, ',' ORDER BY p.proname) INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('ordem_compra_c3c_fence_and_snapshot',
                       'ordem_compra_c3c_assert_import_reconciled')
     AND (NOT p.prosecdef
          OR NOT EXISTS (
               SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) e
                WHERE e LIKE 'search_path=%')
          OR pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres');
  IF v_bad IS NOT NULL AND v_bad <> '' THEN
    RAISE EXCEPTION 'db/112: security posture drift on %', v_bad;
  END IF;

  SELECT string_agg(x.proname || ':' || x.grantee, ',' ORDER BY x.proname, x.grantee)
    INTO v_bad
    FROM (
      SELECT p.proname, r.rolname AS grantee
        FROM pg_proc p
        CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS g(rolname)
        JOIN pg_roles r ON r.rolname = g.rolname
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('ordem_compra_c3c_fence_and_snapshot',
                           'ordem_compra_c3c_assert_import_reconciled')
         AND pg_catalog.has_function_privilege(r.rolname, p.oid, 'EXECUTE')
      UNION ALL
      SELECT p.proname, 'PUBLIC'
        FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('ordem_compra_c3c_fence_and_snapshot',
                           'ordem_compra_c3c_assert_import_reconciled')
         AND pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
    ) x;
  IF v_bad IS NOT NULL AND v_bad <> '' THEN
    RAISE EXCEPTION 'db/112: client role reached an owner-only cutover function: %', v_bad;
  END IF;

  -- 3.3 This migration is inactive: the cutover is untouched.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat'
     AND productive_receipt_started_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/112: ordem_compra_cutover is not legacy_active/flat with a NULL PONR marker';
  END IF;

  -- 3.4 The five receipt-writer guards remain enabled.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace
      AND t.tgname IN ('trg_lancamento_append_only_guard',
                       'trg_lancamento_estorno_guard',
                       'trg_recebimento_movimento_immutable_guard',
                       'trg_recebimento_header_immutable_guard',
                       'trg_c3c_command_state_guard')
      AND t.tgenabled = 'D'
  ) THEN
    RAISE EXCEPTION 'db/112: a receipt-writer guard is disabled';
  END IF;
END
$db112$;

COMMIT;
