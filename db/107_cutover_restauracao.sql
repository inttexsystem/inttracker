-- =====================================================================
-- db/107 — PRE-PONR CUTOVER RESTORATION
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1, phase P1.
-- Implements PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md section 9.9.G.2
-- (option A: exact restoration of grants, column grants and policies,
-- plus generation-scoped cleanup of imported facts, plus a full field
-- reset).
--
-- WHY THIS EXISTS. Measured fact F5: the db/75 machine can reach
-- maintenance_fenced / flat through ordem_compra_c3c_pre_ponr_rollback,
-- but NO function anywhere restores legacy_active. Flipping the state row
-- is not restoration: close_final_acl revokes privileges and drops
-- policies, and the legacy_active branch of
-- ordem_compra_cutover_c3c_state_check requires TEN fields to be NULL.
--
-- ADDITIVITY. Everything here is new except ONE amendment to
-- ordem_compra_c3c_close_final_acl, which is an INACTIVE, owner-only
-- cutover administration function: it is executable only by postgres
-- under a held session lock, and only from maintenance_fenced /
-- canonical. It is unreachable in the current legacy_active / flat
-- state, so this amendment changes no currently reachable business
-- behaviour. That is exactly the amendment 9.9.G permits.
--
-- NO restoration function is granted to any client role.
--
-- THE BYPASS IN purge_generation IS NOT GENERALIZABLE. No other function
-- may disable these or any other guard. The disable window exists only
-- inside ordem_compra_c3c_purge_generation, only pre-PONR, only for a
-- validated generation, and only under the mandatory re-enable
-- assertion.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The ACL/policy manifest (9.9.G.2.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordem_compra_cutover_acl_manifest (
  id                BIGSERIAL PRIMARY KEY,
  cutover_generation BIGINT NOT NULL,
  objeto_tipo       TEXT NOT NULL
                      CHECK (objeto_tipo IN ('table_grant', 'column_grant', 'policy', 'function_grant')),
  objeto_schema     TEXT NOT NULL,
  objeto_nome       TEXT NOT NULL,
  grantee           TEXT,
  privilegio        TEXT,
  coluna            TEXT,
  policy_nome       TEXT,
  policy_cmd        TEXT,
  policy_roles      TEXT[],
  policy_using      TEXT,
  policy_check      TEXT,
  capturado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ordem_compra_cutover_acl_manifest IS
  'db/107 (9.9.G.2.1): the exact ACL and policy state captured immediately BEFORE ordem_compra_c3c_close_final_acl, so a pre-PONR restoration can replay it byte-for-byte. Owner-only; no client role may read or write it.';

CREATE INDEX IF NOT EXISTS ordem_compra_cutover_acl_manifest_geracao_idx
  ON public.ordem_compra_cutover_acl_manifest (cutover_generation, objeto_tipo);

ALTER TABLE public.ordem_compra_cutover_acl_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ordem_compra_cutover_acl_manifest
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.ordem_compra_cutover_acl_manifest_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. The exact object set close_final_acl touches
--
-- Kept as one owner-only function so capture, restore and their
-- assertions can never drift from each other.
--
-- The fourteen protected tables are the v_protected_tables list of
-- ordem_compra_c3c_close_final_acl (db/75). The sequences are the six it
-- revokes ALL on, plus ordens_compra_fio_id_seq. A sequence is a
-- relation, so its privileges are captured under 'table_grant'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oc_c3c_acl_objetos()
RETURNS TABLE (relname TEXT, is_sequence BOOLEAN)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT * FROM (VALUES
    ('ordens_compra_fio', FALSE),
    ('necessidade_compra_fio', FALSE),
    ('ordem_compra_item_compat_fio', FALSE),
    ('ordem_compra_item_alocacao', FALSE),
    ('ordem_compra_item', FALSE),
    ('ordem_compra', FALSE),
    ('saldo_fios', FALSE),
    ('saldo_fios_op', FALSE),
    ('ordem_compra_recebimentos', FALSE),
    ('ordem_compra_fio_lancamentos', FALSE),
    ('ordem_compra_fio_movimentos_estoque', FALSE),
    ('ordem_compra_cutover', FALSE),
    ('ordem_compra_cutover_source_snapshot', FALSE),
    ('ordem_compra_cutover_inventory_baseline', FALSE),
    ('ordens_compra_fio_id_seq', TRUE),
    ('ordem_compra_recebimentos_id_seq', TRUE),
    ('ordem_compra_fio_lancamentos_id_seq', TRUE),
    ('ordem_compra_fio_movimentos_estoque_id_seq', TRUE),
    ('ordem_compra_cutover_id_seq', TRUE),
    ('ordem_compra_cutover_source_snapshot_id_seq', TRUE),
    ('ordem_compra_cutover_inventory_baseline_id_seq', TRUE)
  ) AS t(relname, is_sequence);
$$;

COMMENT ON FUNCTION public._oc_c3c_acl_objetos() IS
  'db/107: the exact relation set ordem_compra_c3c_close_final_acl revokes on — the fourteen protected tables plus the seven sequences. One owner-only source so capture, restore and their assertions cannot drift.';

-- ---------------------------------------------------------------------
-- 3. capture_acl_manifest — run immediately BEFORE close_final_acl
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_capture_acl_manifest(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grants   INTEGER := 0;
  v_cols     INTEGER := 0;
  v_policies INTEGER := 0;
  v_funcs    INTEGER := 0;
BEGIN
  IF current_user <> 'postgres'
     OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND cutover_generation = p_generation
     AND productive_receipt_started_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000';
  END IF;

  -- Idempotent: a re-run replaces this generation's manifest exactly.
  DELETE FROM public.ordem_compra_cutover_acl_manifest
   WHERE cutover_generation = p_generation;

  -- 3.1 RELATION-LEVEL GRANTS (tables and sequences alike), read from
  --     pg_class.relacl so sequences are covered by the same query.
  INSERT INTO public.ordem_compra_cutover_acl_manifest
    (cutover_generation, objeto_tipo, objeto_schema, objeto_nome, grantee, privilegio)
  SELECT p_generation, 'table_grant', 'public', c.relname,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
         a.privilege_type
    FROM public._oc_c3c_acl_objetos() o
    JOIN pg_catalog.pg_class c
      ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) AS a
   WHERE (a.grantee = 0
          OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated', 'service_role'));
  GET DIAGNOSTICS v_grants = ROW_COUNT;

  -- 3.2 COLUMN-LEVEL GRANTS. close_final_acl revokes an explicit column
  --     UPDATE list on ordens_compra_fio; capture every column ACL on
  --     the protected relations so the replay is exact.
  INSERT INTO public.ordem_compra_cutover_acl_manifest
    (cutover_generation, objeto_tipo, objeto_schema, objeto_nome, grantee, privilegio, coluna)
  SELECT p_generation, 'column_grant', 'public', c.relname,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
         a.privilege_type, att.attname
    FROM public._oc_c3c_acl_objetos() o
    JOIN pg_catalog.pg_class c
      ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
    JOIN pg_catalog.pg_attribute att
      ON att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
     AND att.attacl IS NOT NULL
    CROSS JOIN LATERAL aclexplode(att.attacl) AS a
   WHERE (a.grantee = 0
          OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated', 'service_role'));
  GET DIAGNOSTICS v_cols = ROW_COUNT;

  -- 3.3 POLICIES. close_final_acl drops exactly the policies whose
  --     polroles contain PUBLIC (0::oid) on the protected tables.
  INSERT INTO public.ordem_compra_cutover_acl_manifest
    (cutover_generation, objeto_tipo, objeto_schema, objeto_nome,
     policy_nome, policy_cmd, policy_roles, policy_using, policy_check)
  SELECT p_generation, 'policy', 'public', c.relname,
         pol.polname,
         CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                         WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                         ELSE 'ALL' END,
         ARRAY(SELECT CASE WHEN r = 0 THEN 'PUBLIC'
                           ELSE pg_catalog.pg_get_userbyid(r) END
                 FROM unnest(pol.polroles) AS r),
         pg_catalog.pg_get_expr(pol.polqual, pol.polrelid),
         pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid)
    FROM public._oc_c3c_acl_objetos() o
    JOIN pg_catalog.pg_class c
      ON c.relname = o.relname AND c.relnamespace = 'public'::regnamespace
    JOIN pg_catalog.pg_policy pol ON pol.polrelid = c.oid
   WHERE 0::oid = ANY (pol.polroles);
  GET DIAGNOSTICS v_policies = ROW_COUNT;

  -- 3.4 FUNCTION GRANTS on the receipt writers the cutover fences.
  INSERT INTO public.ordem_compra_cutover_acl_manifest
    (cutover_generation, objeto_tipo, objeto_schema, objeto_nome, grantee, privilegio)
  SELECT p_generation, 'function_grant', 'public',
         p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
         a.privilege_type
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL aclexplode(p.proacl) AS a
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('registrar_recebimento_ordem_compra', 'estornar_recebimento_ordem_compra')
     AND (a.grantee = 0
          OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated', 'service_role'));
  GET DIAGNOSTICS v_funcs = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true, 'cutover_generation', p_generation,
    'table_grants', v_grants, 'column_grants', v_cols,
    'policies', v_policies, 'function_grants', v_funcs);
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_c3c_capture_acl_manifest(BIGINT) IS
  'db/107 (9.9.G.2.1): captures the exact ACL and policy state of every object ordem_compra_c3c_close_final_acl touches. MUST run immediately before it; close_final_acl now refuses with acl_manifest_ausente when this manifest is missing.';

-- ---------------------------------------------------------------------
-- 4. restore_acl_manifest — replay it exactly, then assert convergence
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_restore_acl_manifest(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r            RECORD;
  v_grants     INTEGER := 0;
  v_cols       INTEGER := 0;
  v_policies   INTEGER := 0;
  v_funcs      INTEGER := 0;
  v_divergente INTEGER;
BEGIN
  IF current_user <> 'postgres'
     OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ordem_compra_cutover_acl_manifest
                  WHERE cutover_generation = p_generation) THEN
    RAISE EXCEPTION 'acl_manifest_ausente' USING ERRCODE = '55000';
  END IF;

  -- 4.1 Relation grants (tables and sequences).
  FOR r IN
    SELECT * FROM public.ordem_compra_cutover_acl_manifest
     WHERE cutover_generation = p_generation AND objeto_tipo = 'table_grant'
     ORDER BY objeto_nome, grantee, privilegio
  LOOP
    EXECUTE format('GRANT %s ON %I.%I TO %s',
                   r.privilegio, r.objeto_schema, r.objeto_nome,
                   CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC'
                        ELSE quote_ident(r.grantee) END);
    v_grants := v_grants + 1;
  END LOOP;

  -- 4.2 Column grants.
  FOR r IN
    SELECT * FROM public.ordem_compra_cutover_acl_manifest
     WHERE cutover_generation = p_generation AND objeto_tipo = 'column_grant'
     ORDER BY objeto_nome, coluna, grantee, privilegio
  LOOP
    EXECUTE format('GRANT %s (%I) ON %I.%I TO %s',
                   r.privilegio, r.coluna, r.objeto_schema, r.objeto_nome,
                   CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC'
                        ELSE quote_ident(r.grantee) END);
    v_cols := v_cols + 1;
  END LOOP;

  -- 4.3 Policies, with their exact cmd, roles, USING and WITH CHECK.
  FOR r IN
    SELECT * FROM public.ordem_compra_cutover_acl_manifest
     WHERE cutover_generation = p_generation AND objeto_tipo = 'policy'
     ORDER BY objeto_nome, policy_nome
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy pol
        JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
       WHERE c.relname = r.objeto_nome
         AND c.relnamespace = 'public'::regnamespace
         AND pol.polname = r.policy_nome
    ) THEN
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR %s TO %s%s%s',
        r.policy_nome, r.objeto_schema, r.objeto_nome, r.policy_cmd,
        (SELECT string_agg(CASE WHEN x = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(x) END, ', ')
           FROM unnest(r.policy_roles) AS x),
        CASE WHEN r.policy_using IS NOT NULL THEN ' USING (' || r.policy_using || ')' ELSE '' END,
        CASE WHEN r.policy_check IS NOT NULL THEN ' WITH CHECK (' || r.policy_check || ')' ELSE '' END);
    END IF;
    v_policies := v_policies + 1;
  END LOOP;

  -- 4.4 Function grants.
  FOR r IN
    SELECT * FROM public.ordem_compra_cutover_acl_manifest
     WHERE cutover_generation = p_generation AND objeto_tipo = 'function_grant'
     ORDER BY objeto_nome, grantee, privilegio
  LOOP
    EXECUTE format('GRANT %s ON FUNCTION %I.%s TO %s',
                   r.privilegio, r.objeto_schema, r.objeto_nome,
                   CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC'
                        ELSE quote_ident(r.grantee) END);
    v_funcs := v_funcs + 1;
  END LOOP;

  -- 4.5 ASSERT the live state matches the manifest row for row.
  SELECT count(*) INTO v_divergente
    FROM public.ordem_compra_cutover_acl_manifest m
   WHERE m.cutover_generation = p_generation
     AND (
       (m.objeto_tipo = 'table_grant' AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_class c
          CROSS JOIN LATERAL aclexplode(c.relacl) AS a
           WHERE c.relname = m.objeto_nome
             AND c.relnamespace = 'public'::regnamespace
             AND a.privilege_type = m.privilegio
             AND (CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                       ELSE pg_catalog.pg_get_userbyid(a.grantee) END) = m.grantee))
    OR (m.objeto_tipo = 'column_grant' AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_attribute att ON att.attrelid = c.oid AND att.attname = m.coluna
          CROSS JOIN LATERAL aclexplode(att.attacl) AS a
           WHERE c.relname = m.objeto_nome
             AND c.relnamespace = 'public'::regnamespace
             AND a.privilege_type = m.privilegio
             AND (CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                       ELSE pg_catalog.pg_get_userbyid(a.grantee) END) = m.grantee))
    OR (m.objeto_tipo = 'policy' AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_policy pol
            JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
           WHERE c.relname = m.objeto_nome
             AND c.relnamespace = 'public'::regnamespace
             AND pol.polname = m.policy_nome
             AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) IS NOT DISTINCT FROM m.policy_using
             AND pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) IS NOT DISTINCT FROM m.policy_check))
    OR (m.objeto_tipo = 'function_grant' AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc p
          CROSS JOIN LATERAL aclexplode(p.proacl) AS a
           WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' = m.objeto_nome
             AND a.privilege_type = m.privilegio
             AND (CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                       ELSE pg_catalog.pg_get_userbyid(a.grantee) END) = m.grantee))
     );

  IF v_divergente > 0 THEN
    RAISE EXCEPTION 'acl_restauracao_divergente' USING ERRCODE = '55000',
      DETAIL = format('%s manifest row(s) are not satisfied by the live ACL/policy state', v_divergente);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'cutover_generation', p_generation,
    'table_grants', v_grants, 'column_grants', v_cols,
    'policies', v_policies, 'function_grants', v_funcs, 'divergentes', 0);
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_c3c_restore_acl_manifest(BIGINT) IS
  'db/107 (9.9.G.2.1): replays the captured ACL/policy manifest exactly and then asserts, row for row, that the live state satisfies it — raising acl_restauracao_divergente otherwise. Idempotent.';

-- ---------------------------------------------------------------------
-- 5. purge_generation — the PROVEN bounded cleanup (9.9.G.2.2)
--
-- Contract, exactly as proved on a clean disposable clone (T6/T7/T8):
--   1. validate the cutover generation and pre-PONR eligibility,
--      refusing forward_recovery_only once productive_receipt_started_at
--      is set;
--   2. disable EXACTLY these five guards inside its own transaction:
--        trg_lancamento_append_only_guard
--        trg_lancamento_estorno_guard
--        trg_recebimento_movimento_immutable_guard
--        trg_recebimento_header_immutable_guard
--        trg_c3c_command_state_guard
--   3. delete only facts provably belonging to the target generation;
--   4. re-enable every one of the five before returning;
--   5. hard-fail if any guard remains with tgenabled = 'D';
--   6. preserve all unrelated facts;
--   7. NEVER modify the five TD1 saldo_fios rows.
--
-- SCOPING NOTE, stated honestly. The db/75 machine is a singleton:
-- ordem_compra_cutover_source_snapshot.cutover_id and
-- ordem_compra_cutover_inventory_baseline.cutover_id are written as the
-- constant 1, and the import identity key embeds that same constant, not
-- the generation. The generation scope is therefore established by the
-- STATE ROW — ordem_compra_cutover.cutover_generation must equal
-- p_generation — together with the fact that fence_and_snapshot runs only
-- from legacy_active, which a completed resume_legacy leaves with a zero
-- imported footprint. Under those two conditions the import artifacts
-- present are provably this generation's, and the post-condition below
-- proves the footprint is zero afterwards.
--
-- TD1 (requirement 7) BINDS OVER arithmetic repair: this function never
-- writes public.saldo_fios. Import is non-posting to saldo_fios and to
-- the movement ledger (db/71 attaches trg_native_lancamento_derive_state
-- WHEN tipo <> 'import_saldo_inicial'), so no delta can exist. If one
-- ever did, this function FAILS CLOSED rather than mutating the five
-- preserved rows.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_purge_generation(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guards CONSTANT TEXT[][] := ARRAY[
    ARRAY['ordem_compra_fio_lancamentos',        'trg_lancamento_append_only_guard'],
    ARRAY['ordem_compra_fio_lancamentos',        'trg_lancamento_estorno_guard'],
    ARRAY['ordem_compra_fio_movimentos_estoque', 'trg_recebimento_movimento_immutable_guard'],
    ARRAY['ordem_compra_recebimentos',           'trg_recebimento_header_immutable_guard'],
    ARRAY['ordem_compra_recebimentos',           'trg_c3c_command_state_guard']
  ];
  i             INTEGER;
  v_headers     BIGINT[];
  v_ledger      BIGINT[];
  v_mov         INTEGER := 0;
  v_lan         INTEGER := 0;
  v_hdr         INTEGER := 0;
  v_snap        INTEGER := 0;
  v_base        INTEGER := 0;
  v_desabilitado INTEGER;
  v_saldo_drift INTEGER;
BEGIN
  IF current_user <> 'postgres'
     OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;

  -- 1. VALIDATE the generation and pre-PONR eligibility.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND cutover_generation = p_generation FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordem_compra_cutover
              WHERE id = 1 AND productive_receipt_started_at IS NOT NULL) THEN
    RAISE EXCEPTION 'forward_recovery_only' USING ERRCODE = '55000';
  END IF;

  -- TD1 pre-condition: capture the baseline the five rows must still equal.
  SELECT count(*) INTO v_saldo_drift
    FROM public.saldo_fios s
    FULL JOIN public.ordem_compra_cutover_inventory_baseline b
      ON b.material = s.tipo
     AND b.cor_id IS NOT DISTINCT FROM s.cor_id
     AND b.cor_poliester IS NOT DISTINCT FROM s.cor_poliester
   WHERE b.id IS NULL OR s.id IS NULL OR b.kg_total IS DISTINCT FROM s.kg_total;
  IF v_saldo_drift > 0 THEN
    RAISE EXCEPTION 'td1_saldo_fios_divergente' USING ERRCODE = '55000',
      DETAIL = format('%s saldo_fios row(s) diverge from the captured inventory baseline; refusing rather than mutating preserved historical stock', v_saldo_drift);
  END IF;

  -- Resolve the target footprint BEFORE touching any guard.
  SELECT array_agg(h.id) INTO v_headers
    FROM public.ordem_compra_recebimentos h
   WHERE h.idempotency_namespace = 'legacy_initial_balance_v1';

  IF v_headers IS NOT NULL THEN
    SELECT array_agg(l.id) INTO v_ledger
      FROM public.ordem_compra_fio_lancamentos l
     WHERE l.recebimento_id = ANY (v_headers);
  END IF;

  -- Every ledger row about to be removed MUST be an import row.
  IF v_ledger IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ordem_compra_fio_lancamentos l
     WHERE l.id = ANY (v_ledger) AND l.tipo <> 'import_saldo_inicial'
  ) THEN
    RAISE EXCEPTION 'purge_escopo_invalido' USING ERRCODE = '55000',
      DETAIL = 'a ledger row linked to an import header is not tipo=import_saldo_inicial';
  END IF;

  -- 2. DISABLE exactly the five guards, inside this transaction.
  FOR i IN 1 .. array_length(v_guards, 1) LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',
                   v_guards[i][1], v_guards[i][2]);
  END LOOP;

  -- 3. DELETE only the target generation's imported facts.
  IF v_ledger IS NOT NULL THEN
    DELETE FROM public.ordem_compra_fio_movimentos_estoque m
     WHERE m.lancamento_id = ANY (v_ledger);
    GET DIAGNOSTICS v_mov = ROW_COUNT;

    DELETE FROM public.ordem_compra_fio_lancamentos l
     WHERE l.id = ANY (v_ledger) AND l.tipo = 'import_saldo_inicial';
    GET DIAGNOSTICS v_lan = ROW_COUNT;
  END IF;

  IF v_headers IS NOT NULL THEN
    DELETE FROM public.ordem_compra_recebimentos h
     WHERE h.id = ANY (v_headers)
       AND h.idempotency_namespace = 'legacy_initial_balance_v1';
    GET DIAGNOSTICS v_hdr = ROW_COUNT;
  END IF;

  DELETE FROM public.ordem_compra_cutover_source_snapshot;
  GET DIAGNOSTICS v_snap = ROW_COUNT;
  DELETE FROM public.ordem_compra_cutover_inventory_baseline;
  GET DIAGNOSTICS v_base = ROW_COUNT;

  -- ordem_compra_eventos written during reconciliation are PRESERVED:
  -- they are history and no statement above touches them.

  -- 4. RE-ENABLE every one of the five guards before returning.
  FOR i IN 1 .. array_length(v_guards, 1) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I',
                   v_guards[i][1], v_guards[i][2]);
  END LOOP;

  -- 5. HARD-FAIL if any of the five is still disabled.
  SELECT count(*) INTO v_desabilitado
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace
     AND t.tgname IN ('trg_lancamento_append_only_guard',
                      'trg_lancamento_estorno_guard',
                      'trg_recebimento_movimento_immutable_guard',
                      'trg_recebimento_header_immutable_guard',
                      'trg_c3c_command_state_guard')
     AND t.tgenabled = 'D';
  IF v_desabilitado > 0 THEN
    RAISE EXCEPTION 'purge_guard_nao_restaurado' USING ERRCODE = '55000',
      DETAIL = format('%s guard(s) remain tgenabled = D', v_desabilitado);
  END IF;

  -- POST-CONDITION: the imported footprint is zero.
  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos
              WHERE idempotency_namespace = 'legacy_initial_balance_v1')
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos
                 WHERE tipo = 'import_saldo_inicial')
     OR EXISTS (SELECT 1 FROM public.ordem_compra_cutover_source_snapshot)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_cutover_inventory_baseline) THEN
    RAISE EXCEPTION 'purge_residuo_presente' USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'cutover_generation', p_generation,
    'movimentos', v_mov, 'lancamentos', v_lan, 'recebimentos', v_hdr,
    'snapshot', v_snap, 'inventory_baseline', v_base,
    'guards_restaurados', array_length(v_guards, 1));
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_c3c_purge_generation(BIGINT) IS
  'db/107 (9.9.G.2.2): the PROVEN generation-scoped purge of imported cutover facts. postgres-only, session-locked, pre-PONR only. Disables exactly five guards inside its own transaction, deletes only import artifacts, re-enables all five and hard-fails if any remains disabled. Never writes saldo_fios. THIS BYPASS IS NOT GENERALIZABLE.';

-- ---------------------------------------------------------------------
-- 6. resume_legacy — the FULL field reset (9.9.G.2.3)
--
-- Sets EVERY field the legacy_active branch of
-- ordem_compra_cutover_c3c_state_check requires. The previously proposed
-- version cleared four of them and would have violated the constraint.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_resume_legacy(p_generation BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.ordem_compra_cutover%ROWTYPE;
BEGIN
  IF current_user <> 'postgres'
     OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND cutover_generation = p_generation FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra_cutover
              WHERE id = 1 AND productive_receipt_started_at IS NOT NULL) THEN
    RAISE EXCEPTION 'forward_recovery_only' USING ERRCODE = '55000';
  END IF;

  UPDATE public.ordem_compra_cutover
     SET status                           = 'legacy_active',
         read_authority                   = 'flat',
         cutover_generation               = NULL,
         snapshot_hash                    = NULL,
         inventory_baseline_hash          = NULL,
         snapshot_captured_at             = NULL,
         import_started_at                = NULL,
         import_completed_at              = NULL,
         final_acl_closed_at              = NULL,
         canonical_activated_at           = NULL,
         productive_receipt_started_at     = NULL,
         reconciliation_status            = 'not_started',
         source_snapshot_count            = NULL,
         source_snapshot_total_kg         = NULL,
         source_snapshot_serialization    = NULL,
         inventory_baseline_count         = NULL,
         inventory_baseline_total_kg      = NULL,
         inventory_baseline_serialization = NULL
   WHERE id = 1;

  SELECT * INTO v_row FROM public.ordem_compra_cutover WHERE id = 1;

  -- Assert the row genuinely satisfies the legacy_active branch.
  IF v_row.status <> 'legacy_active'
     OR v_row.read_authority <> 'flat'
     OR v_row.cutover_generation IS NOT NULL
     OR v_row.snapshot_hash IS NOT NULL
     OR v_row.inventory_baseline_hash IS NOT NULL
     OR v_row.snapshot_captured_at IS NOT NULL
     OR v_row.import_started_at IS NOT NULL
     OR v_row.import_completed_at IS NOT NULL
     OR v_row.final_acl_closed_at IS NOT NULL
     OR v_row.canonical_activated_at IS NOT NULL
     OR v_row.productive_receipt_started_at IS NOT NULL
     OR v_row.reconciliation_status <> 'not_started' THEN
    RAISE EXCEPTION 'resume_legacy_incompleto' USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'legacy_active', 'read_authority', 'flat');
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_c3c_resume_legacy(BIGINT) IS
  'db/107 (9.9.G.2.3): the missing operation — a COMPLETE reset of every field the legacy_active branch of ordem_compra_cutover_c3c_state_check requires, asserted afterwards. postgres-only, session-locked, pre-PONR only.';

-- ---------------------------------------------------------------------
-- 7. ordem_compra_c3c_close_final_acl — the required amendment
--
-- Reproduced VERBATIM from its accepted db/75 body with ONE addition:
-- it now refuses with acl_manifest_ausente unless a manifest row set
-- exists for the current generation (9.9.G.2.1). The function is
-- owner-only, session-locked and reachable only from
-- maintenance_fenced / canonical, so this changes no currently
-- reachable business behaviour.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordem_compra_c3c_close_final_acl(p_generation BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_protected_tables CONSTANT TEXT[] := ARRAY[
    'ordens_compra_fio',
    'necessidade_compra_fio',
    'ordem_compra_item_compat_fio',
    'ordem_compra_item_alocacao',
    'ordem_compra_item',
    'ordem_compra',
    'saldo_fios',
    'saldo_fios_op',
    'ordem_compra_recebimentos',
    'ordem_compra_fio_lancamentos',
    'ordem_compra_fio_movimentos_estoque',
    'ordem_compra_cutover',
    'ordem_compra_cutover_source_snapshot',
    'ordem_compra_cutover_inventory_baseline'
  ]::TEXT[];
BEGIN
  IF current_user <> 'postgres' OR NOT public.ordem_compra_c3c_session_lock_held(p_generation) THEN
    RAISE EXCEPTION 'cutover_session_lock_required' USING ERRCODE = '55000';
  END IF;
  PERFORM 1 FROM public.ordem_compra_cutover WHERE id = 1
    AND status = 'maintenance_fenced' AND read_authority = 'canonical'
    AND reconciliation_status = 'reconciled' AND cutover_generation = p_generation
    AND productive_receipt_started_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'estado_cutover_invalido' USING ERRCODE = '55000'; END IF;

  -- db/107 (9.9.G.2.1): refuse to close the ACL without a captured
  -- manifest, because without it the closure is not reversible.
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_cutover_acl_manifest
     WHERE cutover_generation = p_generation
  ) THEN
    RAISE EXCEPTION 'acl_manifest_ausente' USING ERRCODE = '55000';
  END IF;
  REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.ordens_compra_fio FROM PUBLIC, anon, authenticated, service_role;
  REVOKE UPDATE(op_id, fornecedor_id, tipo, cor_id, cor_poliester, kg_pedido,
    kg_recebido, data_recebimento, status, status_administrativo,
    status_recebimento) ON TABLE public.ordens_compra_fio
    FROM PUBLIC, anon, authenticated, service_role;
  REVOKE ALL ON SEQUENCE public.ordens_compra_fio_id_seq FROM PUBLIC, anon, authenticated, service_role;
  REVOKE ALL ON TABLE public.ordem_compra_recebimentos,
    public.ordem_compra_fio_lancamentos,
    public.ordem_compra_fio_movimentos_estoque,
    public.ordem_compra_cutover,
    public.ordem_compra_cutover_source_snapshot,
    public.ordem_compra_cutover_inventory_baseline
    FROM PUBLIC, anon, authenticated, service_role;
  REVOKE ALL ON SEQUENCE public.ordem_compra_recebimentos_id_seq,
    public.ordem_compra_fio_lancamentos_id_seq,
    public.ordem_compra_fio_movimentos_estoque_id_seq,
    public.ordem_compra_cutover_id_seq,
    public.ordem_compra_cutover_source_snapshot_id_seq,
    public.ordem_compra_cutover_inventory_baseline_id_seq
    FROM PUBLIC, anon, authenticated, service_role;
  FOR r IN
    SELECT n.nspname, c.relname, p.polname
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND 0::oid = ANY (p.polroles)
      AND c.relname::TEXT = ANY (v_protected_tables)
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.polname, r.nspname, r.relname);
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND 0::oid = ANY (p.polroles)
      AND c.relname::TEXT = ANY (v_protected_tables)
  ) THEN
    RAISE EXCEPTION 'public_policy_remaining' USING ERRCODE = '55000';
  END IF;
  UPDATE public.ordem_compra_cutover SET final_acl_closed_at = clock_timestamp() WHERE id = 1;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Explicit ownership and privileges
--
-- NO restoration function is granted to any client role (9.9.G).
-- ---------------------------------------------------------------------
ALTER FUNCTION public._oc_c3c_acl_objetos()                                OWNER TO postgres;
ALTER FUNCTION public.ordem_compra_c3c_capture_acl_manifest(BIGINT)        OWNER TO postgres;
ALTER FUNCTION public.ordem_compra_c3c_restore_acl_manifest(BIGINT)        OWNER TO postgres;
ALTER FUNCTION public.ordem_compra_c3c_purge_generation(BIGINT)            OWNER TO postgres;
ALTER FUNCTION public.ordem_compra_c3c_resume_legacy(BIGINT)               OWNER TO postgres;
ALTER FUNCTION public.ordem_compra_c3c_close_final_acl(BIGINT)             OWNER TO postgres;

REVOKE ALL ON FUNCTION public._oc_c3c_acl_objetos()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_capture_acl_manifest(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_restore_acl_manifest(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_purge_generation(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_resume_legacy(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ordem_compra_c3c_close_final_acl(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. Migration-time invariants
-- ---------------------------------------------------------------------
DO $db107$
DECLARE
  v_bad INTEGER;
BEGIN
  -- 9.1 No restoration function may be reachable by a client role.
  SELECT count(*) INTO v_bad
    FROM (VALUES
      ('public.ordem_compra_c3c_capture_acl_manifest(bigint)'),
      ('public.ordem_compra_c3c_restore_acl_manifest(bigint)'),
      ('public.ordem_compra_c3c_purge_generation(bigint)'),
      ('public.ordem_compra_c3c_resume_legacy(bigint)'),
      ('public.ordem_compra_c3c_close_final_acl(bigint)'),
      ('public._oc_c3c_acl_objetos()')
    ) AS f(fn)
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
   WHERE has_function_privilege(r.role_name, f.fn, 'EXECUTE');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'db/107: % restoration-function grant(s) reach a client role', v_bad;
  END IF;

  -- 9.2 The manifest table is unreachable by every client role.
  IF has_table_privilege('authenticated', 'public.ordem_compra_cutover_acl_manifest', 'SELECT')
     OR has_table_privilege('anon', 'public.ordem_compra_cutover_acl_manifest', 'SELECT')
     OR has_table_privilege('service_role', 'public.ordem_compra_cutover_acl_manifest', 'SELECT') THEN
    RAISE EXCEPTION 'db/107: the ACL manifest must not be readable by a client role';
  END IF;

  -- 9.3 close_final_acl carries the manifest precondition.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'ordem_compra_c3c_close_final_acl'
       AND p.prosrc LIKE '%acl_manifest_ausente%'
  ) THEN
    RAISE EXCEPTION 'db/107: close_final_acl is missing the acl_manifest_ausente precondition';
  END IF;

  -- 9.4 The purge names EXACTLY the five guards, and no other function
  --     in the schema disables a trigger.
  IF (SELECT count(*) FROM (VALUES
        ('trg_lancamento_append_only_guard'),
        ('trg_lancamento_estorno_guard'),
        ('trg_recebimento_movimento_immutable_guard'),
        ('trg_recebimento_header_immutable_guard'),
        ('trg_c3c_command_state_guard')
      ) AS g(n)
      WHERE (SELECT p.prosrc FROM pg_proc p
              WHERE p.pronamespace = 'public'::regnamespace
                AND p.proname = 'ordem_compra_c3c_purge_generation') LIKE '%' || g.n || '%') <> 5 THEN
    RAISE EXCEPTION 'db/107: purge_generation does not name exactly the five accepted guards';
  END IF;

  SELECT count(*) INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosrc LIKE '%DISABLE TRIGGER%'
     AND p.proname <> 'ordem_compra_c3c_purge_generation';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'db/107: the guard-disable bypass is not generalizable — % other function(s) disable a trigger', v_bad;
  END IF;

  -- 9.5 All five guards are enabled right now.
  SELECT count(*) INTO v_bad
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace
     AND t.tgname IN ('trg_lancamento_append_only_guard',
                      'trg_lancamento_estorno_guard',
                      'trg_recebimento_movimento_immutable_guard',
                      'trg_recebimento_header_immutable_guard',
                      'trg_c3c_command_state_guard')
     AND t.tgenabled = 'D';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'db/107: % guard(s) are disabled at migration time', v_bad;
  END IF;

  -- 9.6 P1 does NOT activate the cutover.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/107: ordem_compra_cutover is not legacy_active/flat';
  END IF;
END
$db107$;

COMMIT;
