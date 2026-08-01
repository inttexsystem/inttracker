-- tests/db104-recebimento-lock.integration.sql
--
-- db/104 (9.9.B, 9.9.F, phase P4) — lock protocol, acceptance gate, lock
-- alignment and the ACL correction on alterar_status_op.
--
-- Proves POSITIVELY that the canonical writers still work through their
-- new wrappers, and NEGATIVELY that the renamed implementations and the
-- lock primitives are unreachable by every client role, that anon and
-- service_role lost the db/21 EXECUTE grant, and that the receipt cutover
-- was NOT activated by this migration.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin    CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad01';
  v_nonadmin CONSTANT UUID   := '9d1f0000-0000-4000-8000-00000000ad03';
  v_op       CONSTANT BIGINT := 940000103;   -- OP3 of the fixture
  v_oc_com   CONSTANT BIGINT := 940000801;   -- aceite_exigido TRUE / pendente
  v_oc_sem   CONSTANT BIGINT := 940000802;   -- aceite_exigido FALSE / nao_aplicavel
  v_res      JSONB;
  v_fn       TEXT;
  v_role     TEXT;
  v_gate     TEXT;
  v_gate_sem TEXT;
  v_status_antes TEXT;
  v_alvo     TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);

  -- =================================================================
  -- 1. The renamed implementations and lock primitives are owner-only
  -- =================================================================
  FOREACH v_fn IN ARRAY ARRAY[
    'public._p4_lock_dominio_pedido(uuid)',
    'public._p4_pedido_de_op(bigint)',
    'public._op_alterar_status_impl(bigint,text,text)',
    'public._oc_cancelar_ordem_compra_impl(bigint)',
    'public._oc_excluir_ordem_compra_impl(bigint)'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF has_function_privilege(v_role, v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'not ok - owner-only % is reachable by %', v_fn, v_role;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'ok - all five owner-only P4 internals refuse every client role';

  -- =================================================================
  -- 2. The db/21 over-grant on alterar_status_op is closed
  -- =================================================================
  IF has_function_privilege('anon', 'public.alterar_status_op(bigint,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.alterar_status_op(bigint,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - anon or service_role still holds EXECUTE on alterar_status_op';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'alterar_status_op'
       AND a.grantee = 0
  ) THEN
    RAISE EXCEPTION 'not ok - PUBLIC still holds a privilege on alterar_status_op';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.alterar_status_op(bigint,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - authenticated lost EXECUTE on alterar_status_op';
  END IF;
  RAISE NOTICE 'ok - alterar_status_op is authenticated-only; PUBLIC, anon and service_role are closed';

  -- =================================================================
  -- 3. The wrapper still delegates correctly to the proven body
  -- =================================================================
  v_res := public.alterar_status_op(v_op, 'nao_existe_este_status', NULL);
  IF (v_res->>'ok')::boolean IS NOT FALSE OR (v_res->>'erro') IS NULL THEN
    RAISE EXCEPTION 'not ok - the db/21 transition matrix did not refuse an invalid status: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - the db/21 transition matrix still refuses an invalid transition through the wrapper';

  -- The target is DERIVED from the OP's actual current status through the
  -- db/21 matrix, so the probe stays valid whatever state the fixture and
  -- the preceding suites left the OP in.
  SELECT status INTO v_status_antes FROM public.ops WHERE id = v_op;
  v_alvo := CASE v_status_antes
              WHEN 'simulada'    THEN 'aberta'
              WHEN 'aberta'      THEN 'em_producao'
              WHEN 'em_producao' THEN 'pausada'
              WHEN 'pausada'     THEN 'em_producao'
            END;
  IF v_alvo IS NULL THEN
    RAISE EXCEPTION 'not ok - OP % is in the terminal status %, no valid transition to probe',
      v_op, v_status_antes;
  END IF;

  v_res := public.alterar_status_op(v_op, v_alvo, 'db/104 delegation probe');
  IF (v_res->>'ok')::boolean IS NOT TRUE
     OR (v_res->>'status_novo') <> v_alvo
     OR (v_res->>'status_anterior') <> v_status_antes THEN
    RAISE EXCEPTION 'not ok - the valid transition %->% failed through the wrapper: %',
      v_status_antes, v_alvo, v_res::text;
  END IF;
  IF (SELECT status FROM public.ops WHERE id = v_op) <> v_alvo THEN
    RAISE EXCEPTION 'not ok - the transition did not reach the row';
  END IF;
  RAISE NOTICE 'ok - the valid transition % -> % is applied through the wrapper and reaches the row',
    v_status_antes, v_alvo;

  -- The observation still lands on the event the transition created.
  IF NOT EXISTS (
    SELECT 1 FROM public.op_eventos
     WHERE op_id = v_op AND status_novo = v_alvo
       AND observacao = 'db/104 delegation probe'
  ) THEN
    RAISE EXCEPTION 'not ok - the observation was not attached to the transition event';
  END IF;
  RAISE NOTICE 'ok - the observation still binds to the correct op_eventos row';

  PERFORM set_config('request.jwt.claim.sub', v_nonadmin::text, false);
  v_res := public.alterar_status_op(v_op, 'cancelada', NULL);
  IF (v_res->>'ok')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'not ok - a non-admin transitioned an OP: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - a non-admin is still refused by the delegated body';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);

  -- =================================================================
  -- 4. Every wrapper declares the lock protocol
  -- =================================================================
  FOREACH v_fn IN ARRAY ARRAY[
    'alterar_status_op', 'cancelar_ordem_compra', 'excluir_ordem_compra',
    'registrar_recebimento_ordem_compra', 'estornar_recebimento_ordem_compra'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname = v_fn
         AND p.prosrc LIKE '%_p4_lock_dominio_pedido%'
         AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) e
                      WHERE e = 'lock_timeout=5s')
    ) THEN
      RAISE EXCEPTION 'not ok - % does not declare the 9.9.B lock protocol', v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - all five canonical writers declare the pedidos->ops lock protocol at lock_timeout 5s';

  -- =================================================================
  -- 5. RECEIPT IS STILL INACTIVE — db/104 is not a cutover step
  -- =================================================================
  v_res := public.registrar_recebimento_ordem_compra(
    v_oc_sem, 'db104-probe-1', now(), NULL, NULL, NULL, '[]'::jsonb);
  IF (v_res->>'codigo') <> 'recebimento_canonico_inativo' THEN
    RAISE EXCEPTION 'not ok - native receipt is no longer fenced: %', v_res::text;
  END IF;
  v_res := public.estornar_recebimento_ordem_compra(
    v_oc_sem, 'db104-probe-2', now(), 'probe', '[]'::jsonb);
  IF (v_res->>'codigo') <> 'recebimento_canonico_inativo' THEN
    RAISE EXCEPTION 'not ok - native reversal is no longer fenced: %', v_res::text;
  END IF;
  RAISE NOTICE 'ok - both receipt paths still refuse with recebimento_canonico_inativo';

  IF (SELECT productive_receipt_started_at FROM public.ordem_compra_cutover WHERE id = 1) IS NOT NULL THEN
    RAISE EXCEPTION 'not ok - the PONR was crossed';
  END IF;
  RAISE NOTICE 'ok - productive_receipt_started_at is still NULL';

  -- =================================================================
  -- 6. The 9.9.F acceptance gate, proved on its own axis
  --
  -- The cutover gate is evaluated FIRST, so the acceptance gate is only
  -- reachable with the cutover active. This block activates it INSIDE a
  -- subtransaction that is then deliberately rolled back, so the gate is
  -- proved by execution and the cluster returns to legacy_active with no
  -- receipt possible. Disposable cluster only; nothing here runs anywhere
  -- else.
  -- =================================================================
  BEGIN
    UPDATE public.ordem_compra_cutover
       SET status = 'canonical_active', read_authority = 'canonical',
           reconciliation_status = 'reconciled', cutover_generation = 1,
           final_acl_closed_at = now(), canonical_activated_at = now()
     WHERE id = 1;

    -- An order emitted under a supplier requiring acceptance, still
    -- pendente, must be refused on the ACCEPTANCE axis.
    v_gate := public.registrar_recebimento_ordem_compra(
      v_oc_com, 'db104-gate-1', now(), NULL, NULL, NULL, '[]'::jsonb) ->> 'codigo';

    -- An order that never required acceptance must pass the gate and fail
    -- (or succeed) on its own merits, never with the acceptance code.
    v_gate_sem := public.registrar_recebimento_ordem_compra(
      v_oc_sem, 'db104-gate-2', now(), NULL, NULL, NULL, '[]'::jsonb) ->> 'codigo';

    RAISE EXCEPTION 'DB104_GATE_PROBE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DB104_GATE_PROBE_ROLLBACK' THEN
      RAISE;
    END IF;
  END;

  IF v_gate <> 'recebimento_aceite_pendente' THEN
    RAISE EXCEPTION 'not ok - the acceptance gate did not fire, got %', COALESCE(v_gate, 'NULL');
  END IF;
  RAISE NOTICE 'ok - a pendente Purchase Order is refused with recebimento_aceite_pendente';

  IF v_gate_sem = 'recebimento_aceite_pendente' THEN
    RAISE EXCEPTION 'not ok - the acceptance gate fired on an order that never required acceptance';
  END IF;
  RAISE NOTICE 'ok - an order that never required acceptance is NOT blocked by the gate (got %)', COALESCE(v_gate_sem, 'NULL');

  -- The probe left nothing behind.
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_cutover
     WHERE id = 1 AND status = 'legacy_active' AND read_authority = 'flat'
       AND productive_receipt_started_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not ok - the rolled-back probe left the cutover activated';
  END IF;
  RAISE NOTICE 'ok - the gate probe rolled back; the cutover is legacy_active/flat with an uncrossed PONR';

  RAISE NOTICE 'DB104_RECEBIMENTO_LOCK_PASS';
END
$t$;
