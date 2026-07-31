-- tests/db101-helper-permission-denied.integration.sql
--
-- db/101 (9.9.A.5) — the function security matrix.
--
-- Proves NEGATIVELY that every owner-only helper denies anon, an
-- authenticated NON-admin, an authenticated ADMIN and service_role, and
-- POSITIVELY that the one guarded wrapper authorizes only its intended
-- application role. The admin case matters: EXECUTE is refused even to
-- the role that legitimately calls the public wrapper, which is what
-- makes the wrapper the only door.

\set ON_ERROR_STOP on

DO $t$
DECLARE
  v_admin    CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad01';
  v_nonadmin CONSTANT UUID := '9d1f0000-0000-4000-8000-00000000ad03';
  v_helpers  CONSTANT TEXT[] := ARRAY[
    'public._oc_disponibilidade_linhas(bigint)',
    'public._oc_material_recebido_liquido(uuid,bigint,text,text,bigint,text)',
    'public._oc_reserva_ativa(uuid,text,bigint,text,bigint,bigint)'
  ];
  v_roles    CONSTANT TEXT[] := ARRAY['anon', 'authenticated', 'service_role'];
  h TEXT; rl TEXT;
BEGIN
  -- =================================================================
  -- A. CATALOG MATRIX — no client role holds EXECUTE on a helper
  -- =================================================================
  FOREACH h IN ARRAY v_helpers LOOP
    FOREACH rl IN ARRAY v_roles LOOP
      IF has_function_privilege(rl, h, 'EXECUTE') THEN
        RAISE EXCEPTION 'not ok - A: % holds EXECUTE on owner-only %', rl, h;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'ok - A: anon, authenticated and service_role hold no EXECUTE on any owner-only helper';

  -- =================================================================
  -- B. THE GUARDED WRAPPER authorizes only authenticated
  -- =================================================================
  IF NOT has_function_privilege('authenticated', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - B1: authenticated must reach the guarded wrapper';
  END IF;
  IF has_function_privilege('anon', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.oc_disponibilidade_op(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'not ok - B2: anon or service_role reaches the guarded wrapper';
  END IF;
  RAISE NOTICE 'ok - B: only authenticated holds EXECUTE on oc_disponibilidade_op';
END
$t$;

-- =====================================================================
-- C. RUNTIME PROOF — a REAL authenticated session is refused
--    Each block runs under SET ROLE authenticated, so the refusal is
--    measured, not inferred from the catalog.
-- =====================================================================
DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public._oc_disponibilidade_linhas(940000101);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C1: an authenticated ADMIN executed the owner-only helper directly';
  END IF;
  RAISE NOTICE 'ok - C1: authenticated ADMIN is refused permission on _oc_disponibilidade_linhas';
END
$t$;

DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad03', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public._oc_reserva_ativa('94f10000-0000-4000-8000-000000000001', 'algodao', 940000201, NULL, NULL, NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C2: an authenticated NON-admin executed the owner-only helper directly';
  END IF;
  RAISE NOTICE 'ok - C2: authenticated NON-admin is refused permission on _oc_reserva_ativa';
END
$t$;

DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public._oc_material_recebido_liquido(
      '94f10000-0000-4000-8000-000000000001', 940000101, 'op', 'algodao', 940000201, NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C3: anon executed the owner-only helper directly';
  END IF;
  RAISE NOTICE 'ok - C3: anon is refused permission on _oc_material_recebido_liquido';
END
$t$;

DO $t$
DECLARE v_denied BOOLEAN := FALSE;
BEGIN
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public._oc_disponibilidade_linhas(940000101);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - C4: service_role executed the owner-only helper directly';
  END IF;
  RAISE NOTICE 'ok - C4: service_role is refused permission on _oc_disponibilidade_linhas';
END
$t$;

-- =====================================================================
-- D. THE WRAPPER'S OWN AUTHORIZATION GUARD
--    An authenticated NON-admin reaches the function but is refused by
--    its first executable statement.
-- =====================================================================
DO $t$
DECLARE v_denied BOOLEAN := FALSE; v_n INTEGER := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad03', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO v_n FROM public.oc_disponibilidade_op(940000101);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  RESET ROLE;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'not ok - D1: a NON-admin read availability through the wrapper (% rows)', v_n;
  END IF;
  RAISE NOTICE 'ok - D1: the wrapper refuses an authenticated NON-admin with sem_permissao';
END
$t$;

DO $t$
DECLARE v_n INTEGER := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '9d1f0000-0000-4000-8000-00000000ad01', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.oc_disponibilidade_op(940000101);
  RESET ROLE;
  IF v_n < 1 THEN
    RAISE EXCEPTION 'not ok - D2: the authenticated ADMIN could not read availability through the wrapper';
  END IF;
  RAISE NOTICE 'ok - D2: the authenticated ADMIN reads % availability axes through the wrapper', v_n;
END
$t$;

SELECT 'DB101_HELPER_PERMISSION_PASS' AS marker;
