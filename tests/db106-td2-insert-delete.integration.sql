-- tests/db106-td2-insert-delete.integration.sql
--
-- db/106 — binding supervisor ruling TD2 (9.9.L.4).
--
-- TD2 closes OBS-4, which the C3 prototype measured as TWELVE surviving
-- table grants after the containment migration. This suite re-runs that
-- exact measurement and proves the count is now zero, that every
-- surviving INSERT is column-level and carries no protected column, that
-- the six protected creation defaults hold, and that the creation and
-- deletion paths TD2 redirects are actually reachable through their
-- canonical owners.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin    CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_cliente  CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad03';
  v_n        INTEGER;
  v_row      RECORD;
  v_res      JSONB;
  v_pedido   UUID;
  v_def      TEXT;
BEGIN
  -- =================================================================
  -- 1. TD2 — the OBS-4 measurement is now zero
  -- =================================================================
  SELECT count(*) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('pedidos', 'ops', 'op_itens')
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - OBS-4 regression: % table-level grant(s) survive', v_n;
  END IF;
  RAISE NOTICE 'ok - zero table-level INSERT/UPDATE/DELETE on pedidos, ops and op_itens for anon and authenticated';

  -- =================================================================
  -- 2. TD2.3 — saldo_fios_op carries no client mutation at all
  -- =================================================================
  SELECT count(*) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'saldo_fios_op'
     AND grantee IN ('anon', 'authenticated', 'service_role')
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - saldo_fios_op still carries % client mutation grant(s)', v_n;
  END IF;
  RAISE NOTICE 'ok - saldo_fios_op grants no INSERT/UPDATE/DELETE to authenticated, anon or service_role';

  -- =================================================================
  -- 3. TD2.1 — every surviving INSERT is column-level and safe
  -- =================================================================
  FOR v_row IN
    SELECT table_name, column_name, grantee
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name IN ('pedidos', 'ops', 'op_itens')
       AND grantee IN ('anon', 'authenticated')
       AND privilege_type = 'INSERT'
  LOOP
    IF NOT (v_row.table_name = 'ops' AND v_row.column_name IN ('numero', 'ano')) THEN
      RAISE EXCEPTION 'not ok - unexpected surviving INSERT grant %.% to %',
        v_row.table_name, v_row.column_name, v_row.grantee;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - the only surviving INSERT grant is column-level ops(numero, ano)';

  -- No lifecycle, revision, adjustment, completion or derived-status
  -- column appears in ANY surviving client grant.
  SELECT count(*) INTO v_n
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('INSERT', 'UPDATE')
     AND ( (table_name = 'pedidos'  AND (column_name IN ('status', 'revisao')
                                          OR column_name LIKE 'prioridade\_%'
                                          OR column_name LIKE 'status\_cliente\_%'))
        OR (table_name = 'ops'      AND column_name IN ('status', 'ajuste_revisao', 'finalizada_em'))
        OR (table_name = 'op_itens' AND column_name = 'metros_ajustados') );
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'not ok - % protected column(s) remain client-writable', v_n;
  END IF;
  RAISE NOTICE 'ok - no protected lifecycle, revision, adjustment or completion column is client-writable';

  -- =================================================================
  -- 4. The six protected creation defaults (TD2.1)
  -- =================================================================
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='pedidos' AND column_name='status';
  IF v_def IS DISTINCT FROM '''rascunho''::text' THEN
    RAISE EXCEPTION 'not ok - pedidos.status default drifted to %', COALESCE(v_def,'NULL');
  END IF;
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ops' AND column_name='status';
  IF v_def IS DISTINCT FROM '''simulada''::text' THEN
    RAISE EXCEPTION 'not ok - ops.status default drifted to %', COALESCE(v_def,'NULL');
  END IF;
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='op_itens' AND column_name='metros_ajustados';
  IF v_def IS NOT NULL THEN
    RAISE EXCEPTION 'not ok - op_itens.metros_ajustados acquired a default';
  END IF;
  RAISE NOTICE 'ok - the protected creation defaults are intact (rascunho / simulada / NULL)';

  -- =================================================================
  -- 5. TD2.1 — creation still works, through the bounded writers
  -- =================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  v_res := public.criar_pedido_admin(
    jsonb_build_object('cliente_id', 940000601, 'data_pedido', '2026-08-01', 'observacao', 'db/106 TD2 admin'),
    jsonb_build_array(jsonb_build_object('modelo_id', 940000301, 'metros', 12, 'ordem', 0)),
    NULL);
  RESET ROLE;

  IF COALESCE((v_res->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - criar_pedido_admin refused a legitimate creation: %', v_res::text;
  END IF;
  v_pedido := (v_res->'pedido'->>'id')::UUID;
  IF (v_res->'pedido'->>'status') <> 'rascunho' THEN
    RAISE EXCEPTION 'not ok - administrative creation did not take the canonical rascunho default: %', v_res::text;
  END IF;
  IF jsonb_array_length(v_res->'itens') <> 1 THEN
    RAISE EXCEPTION 'not ok - the created Pedido has the wrong item count: %', v_res::text;
  END IF;
  IF (SELECT count(*) FROM public.pedido_itens WHERE pedido_id = v_pedido) <> 1 THEN
    RAISE EXCEPTION 'not ok - the item set did not reach the table';
  END IF;
  RAISE NOTICE 'ok - criar_pedido_admin creates Pedido + items atomically and owns the status';

  -- The client writer refuses a Pedido for someone else's cliente.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_cliente::text, true);
  v_res := public.criar_pedido_cliente(
    jsonb_build_object('cliente_id', 940000601, 'data_pedido', '2026-08-01'),
    jsonb_build_array(jsonb_build_object('modelo_id', 940000301, 'metros', 3, 'ordem', 0)),
    NULL);
  RESET ROLE;
  IF (v_res->>'codigo') <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - a client created a Pedido for another cliente: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - criar_pedido_cliente refuses a Pedido for a cliente the caller does not own';

  -- And accepts its own, with the server-owned 'recebido' status.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_cliente::text, true);
  v_res := public.criar_pedido_cliente(
    jsonb_build_object('cliente_id', 930000602, 'data_pedido', '2026-08-01'),
    jsonb_build_array(jsonb_build_object('modelo_id', 940000301, 'metros', 4, 'ordem', 0)),
    NULL);
  RESET ROLE;
  IF COALESCE((v_res->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - criar_pedido_cliente refused a legitimate own-cliente creation: %', v_res::text;
  END IF;
  IF (v_res->'pedido'->>'status') <> 'recebido' THEN
    RAISE EXCEPTION 'not ok - client creation did not take the server-owned recebido status: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - criar_pedido_cliente creates its own Pedido with the server-owned recebido status';

  -- =================================================================
  -- 6. TD2.2 — removal has a canonical owner and the direct path is gone
  -- =================================================================
  IF NOT has_function_privilege('authenticated', 'public.remover_pedido(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.remover_op(bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - a canonical deletion writer is unreachable by authenticated';
  END IF;
  IF has_table_privilege('authenticated', 'public.pedidos', 'DELETE')
     OR has_table_privilege('authenticated', 'public.ops', 'DELETE')
     OR has_table_privilege('authenticated', 'public.op_itens', 'DELETE') THEN
    RAISE EXCEPTION 'not ok - direct DELETE authority survived TD2.2';
  END IF;
  RAISE NOTICE 'ok - direct DELETE is gone and remover_pedido / remover_op remain reachable';

  RAISE NOTICE 'DB106_TD2_PASS';
END
$t$;
