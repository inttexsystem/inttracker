-- tests/db106-contencao.integration.sql
--
-- db/106 (9.9.L.2, L.3, phase P4) — direct-DML containment.
--
-- Proves the EFFECTIVE privilege layer, not the migration text: every
-- refusal below is produced by actually attempting the write under a real
-- client role, and every legitimate path is actually exercised.
--
-- The two containment layers are proved SEPARATELY:
--   * as `authenticated`, the GRANT layer refuses;
--   * as a dedicated fully-granted BYPASSRLS probe role, the TRIGGER FENCE
--     refuses. That isolates the fence from the grant matrix and from RLS,
--     and it is what closes the gap the grant matrix leaves open for any
--     role that still holds table DML.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin  CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad01';
  v_ped    CONSTANT UUID   := '94f10000-0000-4000-8000-000000000001';
  v_op     CONSTANT BIGINT := 940000101;
  v_item   BIGINT;
  v_sql    TEXT;
  v_err    TEXT;
  v_state  TEXT;
  v_status TEXT;
  v_alvo_ped TEXT;
  v_alvo_op  TEXT;
  v_res    JSONB;
BEGIN
  SELECT id INTO v_item FROM public.op_itens WHERE op_id = v_op ORDER BY id LIMIT 1;

  -- =================================================================
  -- 1. GRANT LAYER — `authenticated` cannot write a protected fact
  -- =================================================================
  FOR v_sql IN SELECT unnest(ARRAY[
    format('UPDATE public.pedidos SET status = ''confirmado'' WHERE id = %L', v_ped),
    format('UPDATE public.pedidos SET revisao = 99 WHERE id = %L', v_ped),
    format('UPDATE public.pedidos SET prioridade_status = ''confirmada'' WHERE id = %L', v_ped),
    format('UPDATE public.pedidos SET status_cliente_visual = ''tecelagem'' WHERE id = %L', v_ped),
    format('UPDATE public.ops SET status = ''cancelada'' WHERE id = %s', v_op),
    format('UPDATE public.ops SET ajuste_revisao = 42 WHERE id = %s', v_op),
    format('UPDATE public.op_itens SET metros_ajustados = 1 WHERE id = %s', v_item),
    format('DELETE FROM public.op_itens WHERE id = %s', v_item),
    format('DELETE FROM public.ops WHERE id = %s', v_op),
    format('DELETE FROM public.pedidos WHERE id = %L', v_ped),
    'INSERT INTO public.pedidos (cliente_id, status) VALUES (940000601, ''confirmado'')',
    format('INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos) VALUES (%s, 940000301, 5)', v_op),
    'INSERT INTO public.saldo_fios_op (op_id, tipo, kg_sobra) VALUES (940000101, ''algodao'', 1)',
    format('UPDATE public.saldo_fios_op SET kg_sobra = 1 WHERE op_id = %s', v_op),
    format('DELETE FROM public.saldo_fios_op WHERE op_id = %s', v_op)
  ])
  LOOP
    v_err := NULL; v_state := NULL;
    BEGIN
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
      EXECUTE v_sql;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; v_state := SQLSTATE;
      RESET ROLE;
    END;

    IF v_err IS NULL THEN
      RAISE EXCEPTION 'not ok - authenticated reached a protected fact: %', v_sql;
    END IF;
    IF v_state <> '42501' THEN
      RAISE EXCEPTION 'not ok - % refused with SQLSTATE % (%), expected 42501', v_sql, v_state, v_err;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - all 15 protected direct-DML attempts refused for authenticated with SQLSTATE 42501';

  -- =================================================================
  -- 2. FENCE LAYER — a role that KEEPS the grant is still refused
  --
  -- The independent proof that containment does not rest on the grant
  -- matrix alone. A dedicated probe role is created holding full table
  -- DML and BYPASSRLS, so neither the grant layer nor RLS can be what
  -- refuses: the only thing left between the statement and the row is the
  -- trigger fence.
  --
  -- A probe role is used rather than service_role because service_role's
  -- grants on these tables come from Supabase platform defaults that the
  -- reconstructed cluster does not reproduce; the proof must not depend on
  -- them.
  -- =================================================================
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p4_fence_probe') THEN
    CREATE ROLE p4_fence_probe NOLOGIN BYPASSRLS;
  END IF;
  GRANT USAGE ON SCHEMA public TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos       TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops           TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_itens      TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.saldo_fios_op TO p4_fence_probe;

  IF NOT has_table_privilege('p4_fence_probe', 'public.pedidos', 'UPDATE') THEN
    RAISE EXCEPTION 'not ok - the probe role did not receive the table grant';
  END IF;

  -- The fence's WHEN clause fires only on an ACTUAL change, so the probe
  -- must target a value the row does not already hold. Writing the current
  -- value back is a legitimate no-op and proves nothing.
  SELECT CASE WHEN status = 'confirmado' THEN 'rascunho' ELSE 'confirmado' END
    INTO v_alvo_ped FROM public.pedidos WHERE id = v_ped;
  SELECT CASE WHEN status = 'cancelada' THEN 'simulada' ELSE 'cancelada' END
    INTO v_alvo_op FROM public.ops WHERE id = v_op;

  FOR v_sql IN SELECT unnest(ARRAY[
    format('UPDATE public.pedidos SET status = %L WHERE id = %L', v_alvo_ped, v_ped),
    format('UPDATE public.ops SET status = %L WHERE id = %s', v_alvo_op, v_op),
    format('UPDATE public.ops SET ajuste_revisao = 42 WHERE id = %s', v_op),
    format('UPDATE public.op_itens SET metros_ajustados = 1 WHERE id = %s', v_item)
  ])
  LOOP
    v_err := NULL; v_state := NULL;
    BEGIN
      SET LOCAL ROLE p4_fence_probe;
      EXECUTE v_sql;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; v_state := SQLSTATE;
      RESET ROLE;
    END;

    IF v_err IS DISTINCT FROM 'writer_canonico_obrigatorio' THEN
      RAISE EXCEPTION 'not ok - the fence did not refuse "%": % / %', v_sql, COALESCE(v_state, 'NO STATE'), COALESCE(v_err, 'NO ERROR');
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - the trigger fence refuses a fully-granted BYPASSRLS role with writer_canonico_obrigatorio';

  -- =================================================================
  -- 3. Nothing moved
  -- =================================================================
  IF (SELECT status FROM public.pedidos WHERE id = v_ped) = v_alvo_ped THEN
    RAISE EXCEPTION 'not ok - a refused attempt still changed pedidos.status';
  END IF;
  IF (SELECT ajuste_revisao FROM public.ops WHERE id = v_op) = 42 THEN
    RAISE EXCEPTION 'not ok - a refused attempt still changed ops.ajuste_revisao';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.op_itens WHERE id = v_item) THEN
    RAISE EXCEPTION 'not ok - a refused DELETE still removed an op_itens row';
  END IF;
  RAISE NOTICE 'ok - every refused attempt mutated nothing';

  -- =================================================================
  -- 4. The legitimate application paths still work as authenticated
  -- =================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

  UPDATE public.pedidos SET observacao = 'db/106 legitimate write' WHERE id = v_ped;
  UPDATE public.ops SET lote_id = lote_id WHERE id = v_op;
  UPDATE public.op_itens SET metros_pedidos = metros_pedidos WHERE id = v_item;

  RESET ROLE;
  IF (SELECT observacao FROM public.pedidos WHERE id = v_ped) <> 'db/106 legitimate write' THEN
    RAISE EXCEPTION 'not ok - a legitimate write did not reach the row';
  END IF;
  RAISE NOTICE 'ok - the surviving legitimate columns remain writable by authenticated';

  -- =================================================================
  -- 5. The canonical writers own the operations the client lost
  -- =================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  v_res := public.salvar_situacao_visivel_pedido(v_ped, 'tecelagem', NULL, 'Em tecelagem');
  RESET ROLE;
  IF COALESCE((v_res->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'not ok - salvar_situacao_visivel_pedido refused a legitimate call: %', v_res::text;
  END IF;
  IF (SELECT status_cliente_visual FROM public.pedidos WHERE id = v_ped) <> 'tecelagem' THEN
    RAISE EXCEPTION 'not ok - the canonical writer did not reach status_cliente_visual';
  END IF;
  RAISE NOTICE 'ok - salvar_situacao_visivel_pedido owns status_cliente_* and reaches the row';

  SELECT status INTO v_status FROM public.ops WHERE id = v_op;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  v_res := public.substituir_itens_op(v_op, jsonb_build_array(
    jsonb_build_object('modelo_id', 940000301, 'metros_pedidos', 7)));
  RESET ROLE;
  IF v_status IN ('simulada', 'aberta') THEN
    IF COALESCE((v_res->>'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'not ok - substituir_itens_op refused a legitimate call: %', v_res::text;
    END IF;
    IF (SELECT count(*) FROM public.op_itens WHERE op_id = v_op) <> 1 THEN
      RAISE EXCEPTION 'not ok - the item set was not replaced atomically';
    END IF;
    RAISE NOTICE 'ok - substituir_itens_op replaced the item set the client can no longer delete';
  ELSE
    IF (v_res->>'codigo') <> 'estado_invalido' THEN
      RAISE EXCEPTION 'not ok - substituir_itens_op should refuse in status %: %', v_status, v_res::text;
    END IF;
    RAISE NOTICE 'ok - substituir_itens_op refuses estado_invalido in status %', v_status;
  END IF;

  -- A non-admin reaches none of the bounded writers.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad03', true);
  v_res := public.salvar_situacao_visivel_pedido(v_ped, 'tecelagem', NULL, NULL);
  RESET ROLE;
  IF (v_res->>'codigo') <> 'sem_permissao' THEN
    RAISE EXCEPTION 'not ok - a non-admin reached salvar_situacao_visivel_pedido: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - a non-admin is refused sem_permissao by the bounded writer';

  RAISE NOTICE 'DB106_CONTENCAO_PASS';
END
$t$;
