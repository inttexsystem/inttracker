-- =====================================================================
-- db/106b — DIRECT-DML CONTAINMENT (L.2, L.3, TD2)
--
-- NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1, phase P4.
-- The narrowing half of the single accepted db/106 containment migration;
-- db/106a carries the additive half. See the db/106a header for why one
-- migration is applied as two ordered steps and why that is a deployment
-- ordering rather than a phase boundary.
--
-- THIS MIGRATION IS ORDER-DEPENDENT. It must be applied only AFTER
-- db/106a and only AFTER the repointed frontend is live, because it
-- removes the direct authority that the pre-P4 assets rely on. Section 6
-- refuses to run unless db/106a's writers and recovery baseline are
-- already in place.
--
-- THE CONTAINMENT. After this migration no client role can reach a
-- protected lifecycle or adjustment fact by direct DML:
--
--   pedidos    status, revisao, prioridade_*, status_cliente_*
--   ops        status, ajuste_revisao, finalizada_em
--   op_itens   metros_ajustados
--   saldo_fios_op  every column, every command
--
-- Containment is applied on TWO independent layers, because either alone
-- is defeatable. The GRANT layer removes the privilege; the TRIGGER fence
-- of L.3 rejects any mutation whose current_user is not the owner role,
-- which is the only identity the granted SECURITY DEFINER writers run
-- under. The fence keys on current_user and NEVER on a GUC: a set_config
-- value is data, not authority.
--
-- WHY TABLE-LEVEL REVOKE COMES FIRST. PostgreSQL takes the UNION of
-- table- and column-level grants, so a column REVOKE alone would be
-- defeated by the surviving table grant. Every narrowing below therefore
-- revokes at table level and then re-grants the exact safe column list.
--
-- WHAT THE CLIENT LOSES AND WHAT REPLACES IT.
--   direct DELETE on pedidos -> public.remover_pedido (db/34+)
--   direct DELETE on ops     -> public.remover_op     (db/34+)
--   direct DELETE on op_itens-> public.substituir_itens_op (db/106a)
-- No visible action is disabled: every one has a canonical server owner.
--
-- WHAT THIS MIGRATION DOES NOT DO. It does not touch the cutover, does
-- not activate native receipt, writes no business row, and drops nothing
-- from the flat purchasing model. Physical legacy retirement is later
-- work.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Order guard — db/106a must already be in place
-- ---------------------------------------------------------------------
DO $ordem$
DECLARE
  v_writers INT;
BEGIN
  SELECT count(*) INTO v_writers
    FROM pg_catalog.pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('criar_pedido_admin', 'criar_pedido_cliente',
                     'substituir_itens_op', 'abrir_op_tecelagem',
                     'salvar_situacao_visivel_pedido');
  IF v_writers <> 5 THEN
    RAISE EXCEPTION 'db/106b: db/106a must be applied first (found % of 5 bounded writers)', v_writers;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
                  WHERE relnamespace = 'public'::regnamespace
                    AND relname = 'p4_contencao_acl_baseline') THEN
    RAISE EXCEPTION 'db/106b: the db/106a recovery baseline table is absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.p4_contencao_acl_baseline) THEN
    RAISE EXCEPTION 'db/106b: the recovery baseline is empty; refusing to narrow without a way back';
  END IF;
END
$ordem$;

-- ---------------------------------------------------------------------
-- 2. The trigger fence (L.3) — unspoofable, keyed on current_user
--
-- The authorized writers are SECURITY DEFINER functions owned by the
-- table owner, so inside them current_user IS that owner. A client role
-- reaching this trigger through direct DML can never satisfy the
-- predicate, and no set_config value can change it.
--
-- THE FENCE IS DELIBERATELY SECURITY INVOKER, AND THIS IS LOAD-BEARING.
-- The section 9.9.L.3 code sketch declares it SECURITY DEFINER, which
-- makes its own stated predicate structurally unreachable: inside a
-- SECURITY DEFINER function current_user is ALWAYS the function owner, so
-- `current_user <> 'postgres'` could never be true and the fence would be
-- inert while appearing installed. Measured on the disposable cluster: a
-- fully granted BYPASSRLS role updated pedidos.status with no refusal at
-- all. Declaring the trigger SECURITY INVOKER — the default for a trigger
-- function — is what makes the ACCEPTED predicate actually hold, because
-- the trigger then observes the identity of whoever issued the statement:
-- 'authenticated' for direct client DML, and 'postgres' when a granted
-- SECURITY DEFINER writer is the one writing. The intent, the predicate
-- and the error contract of L.3 are unchanged; only the unreachable
-- declaration is corrected.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fato_protegido_fence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'writer_canonico_obrigatorio'
      USING ERRCODE = '42501',
            DETAIL  = format('direct DML on %I.%I is not permitted; use the canonical RPC',
                             TG_TABLE_SCHEMA, TG_TABLE_NAME);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

ALTER FUNCTION public.trg_fato_protegido_fence() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_fato_protegido_fence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_fato_protegido_fence() FROM anon;
REVOKE ALL ON FUNCTION public.trg_fato_protegido_fence() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_fato_protegido_fence() FROM service_role;

DROP TRIGGER IF EXISTS pedidos_fato_protegido_fence ON public.pedidos;
CREATE TRIGGER pedidos_fato_protegido_fence
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.trg_fato_protegido_fence();

DROP TRIGGER IF EXISTS op_itens_fato_protegido_fence ON public.op_itens;
CREATE TRIGGER op_itens_fato_protegido_fence
BEFORE UPDATE ON public.op_itens
FOR EACH ROW
WHEN (NEW.metros_ajustados IS DISTINCT FROM OLD.metros_ajustados)
EXECUTE FUNCTION public.trg_fato_protegido_fence();

DROP TRIGGER IF EXISTS ops_fato_protegido_fence ON public.ops;
CREATE TRIGGER ops_fato_protegido_fence
BEFORE UPDATE ON public.ops
FOR EACH ROW
WHEN (NEW.ajuste_revisao IS DISTINCT FROM OLD.ajuste_revisao
      OR NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.trg_fato_protegido_fence();

DROP TRIGGER IF EXISTS saldo_fios_op_fato_protegido_fence ON public.saldo_fios_op;
CREATE TRIGGER saldo_fios_op_fato_protegido_fence
BEFORE INSERT OR UPDATE OR DELETE ON public.saldo_fios_op
FOR EACH ROW
EXECUTE FUNCTION public.trg_fato_protegido_fence();

-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 4. The grant matrix (L.2, TD2.1, TD2.2, TD2.3)
--
-- Table-level REVOKE first, then the exact safe column list. Every list
-- below was derived from the measured column inventory and from the
-- surviving client call sites, not copied from prose.
-- ---------------------------------------------------------------------


-- 4.1 pedidos. No client role inserts or deletes a Pedido after P4:
--     creation belongs to criar_pedido_admin / criar_pedido_cliente and
--     removal to public.remover_pedido. There is therefore NO surviving
--     column-level INSERT grant at all, which is stricter than TD2.1's
--     minimum and is the correct outcome once every creation surface is
--     repointed.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pedidos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pedidos FROM anon;

GRANT UPDATE (
  cliente_id, data_pedido, prazo_entrega, observacao, referencia_cliente,
  tipo_recebimento, metros_total, parcial_habilitado, parcial_atualizado_em,
  atualizado_em
) ON TABLE public.pedidos TO authenticated;

-- 4.2 ops. Creation still inserts the two identity-neutral reservation
--     fields directly (TD2.1 point 2: column-level INSERT for the exact
--     creation fields); status is NOT among them, so a new OP takes the
--     canonical 'simulada' default. lote_id is the only column a client
--     still updates.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ops FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ops FROM anon;

GRANT INSERT (numero, ano) ON TABLE public.ops TO authenticated;
GRANT UPDATE (lote_id)     ON TABLE public.ops TO authenticated;

-- 4.3 op_itens. The set is replaced by substituir_itens_op, so no client
--     INSERT or DELETE survives. metros_pedidos remains directly editable
--     by the latex administrative surface; metros_ajustados is protected
--     and belongs to salvar_ajuste_producao_op alone.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.op_itens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.op_itens FROM anon;

GRANT UPDATE (metros_pedidos) ON TABLE public.op_itens TO authenticated;

-- 4.4 saldo_fios_op (TD2.3). authenticated, anon AND service_role receive
--     no direct mutation of any kind. iniciar_producao_op owns its
--     productive snapshot writes exclusively.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios_op FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios_op FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.saldo_fios_op FROM service_role;

-- ---------------------------------------------------------------------
-- 5. ROLLBACK BLOCK — the authorized P4 containment recovery path
--
-- Recorded here as the executable recovery for the 9.9.P row "During P4
-- (containment): re-apply db/106 rollback block restoring the prior
-- grant". The block below restores the EXACT pre-P4 privilege matrix
-- measured on production before application:
--
--   pedidos, ops, op_itens, saldo_fios_op each carried table-level
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE for
--   anon, authenticated AND service_role.
--
-- It is intentionally INERT in this migration. Recovery is a separate
-- authorized operation; executing it silently here would defeat the
-- containment this migration exists to install.
--
-- It replays public.p4_contencao_acl_baseline row for row, so it restores
-- what the environment ACTUALLY had (section 4.0) rather than a blanket set.
--
--   BEGIN;
--   DROP TRIGGER IF EXISTS pedidos_fato_protegido_fence       ON public.pedidos;
--   DROP TRIGGER IF EXISTS op_itens_fato_protegido_fence      ON public.op_itens;
--   DROP TRIGGER IF EXISTS ops_fato_protegido_fence           ON public.ops;
--   DROP TRIGGER IF EXISTS saldo_fios_op_fato_protegido_fence ON public.saldo_fios_op;
--   REVOKE ALL ON TABLE public.pedidos, public.ops, public.op_itens,
--                        public.saldo_fios_op
--          FROM anon, authenticated, service_role;
--   DO $rollback$
--   DECLARE r RECORD;
--   BEGIN
--     IF NOT EXISTS (SELECT 1 FROM public.p4_contencao_acl_baseline) THEN
--       RAISE EXCEPTION 'db/106 rollback: the recovery baseline is empty';
--     END IF;
--     FOR r IN SELECT * FROM public.p4_contencao_acl_baseline LOOP
--       EXECUTE format('GRANT %s ON TABLE public.%I TO %I',
--                      r.privilegio, r.objeto_tabela, r.grantee);
--     END LOOP;
--   END
--   $rollback$;
--   COMMIT;
--
-- The five bounded writers may be left in place during a rollback: they
-- are additive, and the pre-P4 frontend does not call them.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 6. Self-verification — fail closed inside the same transaction
-- ---------------------------------------------------------------------
DO $db106$
DECLARE
  v_role  TEXT;
  v_col   TEXT;
  v_fn    TEXT;
  v_tbl   TEXT;
  v_n     INTEGER;
BEGIN
  -- 6.1 TD2: zero table-level INSERT, UPDATE and DELETE on the three
  --     lifecycle tables for authenticated and anon. This is the exact
  --     measurement that OBS-4 failed and that TD2 exists to close.
  SELECT count(*) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('pedidos', 'ops', 'op_itens')
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'db/106 TD2: % table-level INSERT/UPDATE/DELETE grant(s) survived', v_n;
  END IF;

  -- 6.2 TD2.3: saldo_fios_op carries no mutation for any client role,
  --     service_role included.
  SELECT count(*) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'saldo_fios_op'
     AND grantee IN ('anon', 'authenticated', 'service_role')
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'db/106 TD2.3: saldo_fios_op still carries % client mutation grant(s)', v_n;
  END IF;

  -- 6.3 No protected column survives in ANY column-level grant.
  FOR v_tbl, v_col IN
    SELECT c.table_name, c.column_name
      FROM information_schema.column_privileges c
     WHERE c.table_schema = 'public'
       AND c.grantee IN ('anon', 'authenticated')
       AND c.privilege_type IN ('INSERT', 'UPDATE')
       AND (
         (c.table_name = 'pedidos'  AND (c.column_name IN ('status', 'revisao', 'numero', 'token_acesso')
                                          OR c.column_name LIKE 'prioridade\_%'
                                          OR c.column_name LIKE 'status\_cliente\_%'))
         OR (c.table_name = 'ops'      AND c.column_name IN ('status', 'ajuste_revisao', 'finalizada_em'))
         OR (c.table_name = 'op_itens' AND c.column_name = 'metros_ajustados')
       )
  LOOP
    RAISE EXCEPTION 'db/106 L.2: protected column %.% is still client-writable', v_tbl, v_col;
  END LOOP;

  -- 6.4 The legitimate application paths remain reachable. Containment
  --     that also closes the legitimate path is a defect, not a success.
  IF NOT has_column_privilege('authenticated', 'public.pedidos', 'observacao', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.pedidos', 'cliente_id', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.ops', 'lote_id', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.ops', 'numero', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.ops', 'ano', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.op_itens', 'metros_pedidos', 'UPDATE') THEN
    RAISE EXCEPTION 'db/106: a legitimate application column lost its grant';
  END IF;

  -- 6.5 The four fences exist.
  FOR v_tbl IN SELECT unnest(ARRAY['pedidos', 'op_itens', 'ops', 'saldo_fios_op']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
       WHERE NOT t.tgisinternal
         AND c.relnamespace = 'public'::regnamespace
         AND c.relname = v_tbl
         AND t.tgname = v_tbl || '_fato_protegido_fence'
    ) THEN
      RAISE EXCEPTION 'db/106 L.3: the protected-fact fence is missing on %', v_tbl;
    END IF;
  END LOOP;

  -- 6.6 The fence keys on current_user, NOT on a GUC, and is SECURITY
  --     INVOKER. A SECURITY DEFINER fence would observe its own owner and
  --     never refuse anything, so this assertion is what keeps the fence
  --     from silently becoming inert in a future edit.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'trg_fato_protegido_fence'
       AND p.prosrc LIKE '%current_user%'
       AND p.prosrc NOT LIKE '%current_setting%'
       AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'db/106 L.3: the fence must be SECURITY INVOKER and key on current_user alone';
  END IF;

  -- 6.7 The five bounded writers are reachable by authenticated and by
  --     nobody else.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.criar_pedido_admin(jsonb,jsonb,jsonb)',
    'public.criar_pedido_cliente(jsonb,jsonb,jsonb)',
    'public.substituir_itens_op(bigint,jsonb)',
    'public.abrir_op_tecelagem(bigint)',
    'public.salvar_situacao_visivel_pedido(uuid,text,text,text)'
  ] LOOP
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'db/106: authenticated cannot reach the bounded writer %', v_fn;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'db/106: % still holds EXECUTE on %', v_role, v_fn;
      END IF;
    END LOOP;
  END LOOP;

  -- 6.8 The canonical deletion writers TD2.2 defers to still exist and are
  --     still reachable, so no visible action is left without an owner.
  IF NOT has_function_privilege('authenticated', 'public.remover_pedido(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.remover_op(bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'db/106 TD2.2: a canonical deletion writer is unreachable';
  END IF;

  -- 6.9 The cutover is untouched and the PONR is uncrossed.
  PERFORM 1 FROM public.ordem_compra_cutover
   WHERE id = 1
     AND status = 'legacy_active'
     AND read_authority = 'flat'
     AND productive_receipt_started_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'db/106: ordem_compra_cutover is not legacy_active/flat with an uncrossed PONR';
  END IF;
END
$db106$;

COMMIT;