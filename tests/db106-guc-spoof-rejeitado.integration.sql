-- tests/db106-guc-spoof-rejeitado.integration.sql
--
-- db/106 (9.9.L.3, phase P4) — the fence is unspoofable.
--
-- The earlier GUC-based fence was withdrawn because a set_config value is
-- DATA, not authority. This suite proves the shipped fence cannot be
-- defeated by any transaction-local setting a client can write: it keys
-- on current_user, which a client role cannot forge.
--
-- The attempts run as a dedicated probe role holding full table DML and
-- BYPASSRLS. That isolates the fence: neither the grant layer nor RLS can
-- be what refuses, so the only thing standing between the statement and
-- the row is the trigger.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_ped   CONSTANT UUID   := '94f10000-0000-4000-8000-000000000001';
  v_op    CONSTANT BIGINT := 940000101;
  v_guc   TEXT;
  v_err   TEXT;
  v_state TEXT;
  v_before TEXT;
  v_alvo   TEXT;
BEGIN
  SELECT status INTO v_before FROM public.pedidos WHERE id = v_ped;
  -- The fence fires only on an ACTUAL change, so the spoof must target a
  -- value the row does not already hold.
  v_alvo := CASE WHEN v_before = 'confirmado' THEN 'rascunho' ELSE 'confirmado' END;

  -- The probe role, created here too so this suite stands alone.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p4_fence_probe') THEN
    CREATE ROLE p4_fence_probe NOLOGIN BYPASSRLS;
  END IF;
  GRANT USAGE ON SCHEMA public TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos       TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops           TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_itens      TO p4_fence_probe;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.saldo_fios_op TO p4_fence_probe;

  -- Every plausible APPLICATION-LEVEL spoof a client could attempt: claim
  -- an identity, an authorization flag, or that the canonical writer
  -- already ran.
  --
  -- `role` and `session_authorization` are deliberately NOT in this list.
  -- Setting them is not spoofing: it is genuinely BECOMING another role,
  -- and PostgreSQL allows it only to an identity that already holds that
  -- membership. In this rehearsal the session user is the superuser that
  -- built the cluster, so `SET ROLE postgres` would succeed here and would
  -- prove nothing about a real client. A PostgREST client authenticates as
  -- `authenticator`, which holds no membership in the owner role; section
  -- 2 below asserts that separation directly instead of simulating it.
  FOR v_guc IN SELECT unnest(ARRAY[
    'request.jwt.claim.role',
    'app.current_user', 'app.writer', 'app.fato_protegido_autorizado',
    'ravatex.writer_canonico'
  ])
  LOOP
    v_err := NULL; v_state := NULL;
    BEGIN
      SET LOCAL ROLE p4_fence_probe;
      -- A failed set_config on a reserved GUC is itself a refusal of the
      -- spoof, so it is tolerated and the write is still attempted.
      BEGIN
        PERFORM set_config(v_guc, 'postgres', true);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      UPDATE public.pedidos SET status = v_alvo WHERE id = v_ped;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; v_state := SQLSTATE;
      RESET ROLE;
    END;

    IF v_err IS NULL THEN
      RAISE EXCEPTION 'not ok - the fence was defeated by spoofing %', v_guc;
    END IF;
    -- Either the fence refused, or PostgreSQL refused the spoof itself.
    -- Both are correct outcomes; silently succeeding is not.
    IF v_err <> 'writer_canonico_obrigatorio' AND v_state <> '42501' THEN
      RAISE EXCEPTION 'not ok - spoofing % produced an unexpected outcome: % / %', v_guc, v_state, v_err;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - five distinct application-GUC spoofing attempts all failed to reach pedidos.status';

  IF (SELECT status FROM public.pedidos WHERE id = v_ped) IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'not ok - a spoofing attempt changed pedidos.status';
  END IF;
  RAISE NOTICE 'ok - pedidos.status is unchanged after every spoofing attempt';

  -- =================================================================
  -- 2. The client roles hold NO membership in the owner role
  --
  -- This is what makes `SET ROLE postgres` unavailable to a real client
  -- and therefore what makes current_user a sound authority. Asserted on
  -- the catalogue rather than simulated, because the rehearsal session is
  -- itself a superuser.
  -- =================================================================
  FOR v_guc IN SELECT unnest(ARRAY['anon', 'authenticated', 'service_role']) LOOP
    IF pg_has_role(v_guc, 'postgres', 'MEMBER') THEN
      RAISE EXCEPTION 'not ok - client role % is a member of the owner role postgres', v_guc;
    END IF;
    IF (SELECT rolsuper FROM pg_roles WHERE rolname = v_guc) THEN
      RAISE EXCEPTION 'not ok - client role % is a superuser', v_guc;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok - anon, authenticated and service_role hold no membership in postgres and are not superusers';

  -- The same spoof against the adjustment fact and the productive snapshot.
  v_err := NULL;
  BEGIN
    SET LOCAL ROLE p4_fence_probe;
    BEGIN PERFORM set_config('app.fato_protegido_autorizado', 'true', true); EXCEPTION WHEN OTHERS THEN NULL; END;
    UPDATE public.ops SET ajuste_revisao = 999 WHERE id = v_op;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RESET ROLE;
  END;
  IF v_err IS DISTINCT FROM 'writer_canonico_obrigatorio' THEN
    RAISE EXCEPTION 'not ok - the adjustment fence was defeated: %', COALESCE(v_err, 'NO ERROR');
  END IF;
  RAISE NOTICE 'ok - ops.ajuste_revisao is fenced against a spoofed authorization flag';

  v_err := NULL;
  BEGIN
    SET LOCAL ROLE p4_fence_probe;
    BEGIN PERFORM set_config('app.writer', 'iniciar_producao_op', true); EXCEPTION WHEN OTHERS THEN NULL; END;
    INSERT INTO public.saldo_fios_op (op_id, tipo, kg_sobra) VALUES (v_op, 'algodao', 1);
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RESET ROLE;
  END;
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'not ok - saldo_fios_op accepted a spoofed write';
  END IF;
  RAISE NOTICE 'ok - saldo_fios_op refuses a write that claims to be the canonical writer (%)', v_err;

  -- The owner role is the ONLY identity the fence accepts, and it does so
  -- without any GUC at all. This is the positive half of the proof, and it
  -- must be a REAL change: the fence's WHEN clause ignores a no-op, so
  -- writing the current value back would never reach the trigger.
  UPDATE public.ops SET ajuste_revisao = ajuste_revisao + 1 WHERE id = v_op;
  UPDATE public.ops SET ajuste_revisao = ajuste_revisao - 1 WHERE id = v_op;
  RAISE NOTICE 'ok - the owner role passes the fence on a real change with no GUC set';

  RAISE NOTICE 'DB106_GUC_SPOOF_PASS';
END
$t$;
