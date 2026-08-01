-- =====================================================================
-- db/113 — pode_recuperar_op_acabamento ADMIN GUARD FORWARD CORRECTION
--
-- NATIVE-RECEIPT-P3-AUTHENTICATED-PROOF :: proved authorization defect.
--
-- WHY THIS EXISTS. db/108 section 7 created
--
--   public.pode_recuperar_op_acabamento(p_entrega_id BIGINT)
--     RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
--
-- and granted EXECUTE to `authenticated` (db/108 line 560) WITHOUT any
-- auth.uid()/is_admin() guard in its body. Every sibling of that release
-- guards: gerar_op_acabamento and gerar_op_latex_split both refuse with
-- 'sem_permissao' / 42501, and the SAME migration protects the tables this
-- function reads — op_acabamento_comandos and op_acabamento_tentativas are
-- REVOKEd from PUBLIC/anon/authenticated/service_role (db/108 lines
-- 119-122) and carry RLS SELECT policies requiring public.is_admin()
-- (db/108 lines 129, 133).
--
-- MEASURED ON THE DISPOSABLE P3 CLONE (system_identifier
-- 7668905723812930636), NOT INFERRED. Under identity C — a real
-- `authenticated` session whose usuarios row is tipo='cliente' — with
-- request.jwt.claims set exactly as PostgREST sets them:
--
--   is_admin()                                        = false
--   SELECT count(*) FROM op_acabamento_tentativas      = 0   (admin sees 4)
--   SELECT count(*) FROM entregas                      = 0   (admin sees 2)
--   SELECT count(*) FROM ops                           = 0
--   SELECT public.pode_recuperar_op_acabamento(36)     = ANSWERED
--   SELECT public.pode_recuperar_op_acabamento(37)     = ANSWERED
--
-- The function is therefore an UNGUARDED SECURITY DEFINER ORACLE over three
-- tables the caller provably cannot read: it discloses whether a delivery
-- exists, whether a canonical finishing OP exists for it, and whether a
-- PROVED finishing failure was recorded against it. The earlier assessment
-- that the value was "already derivable ... which authenticated can SELECT
-- under the pre-P4 direct-table authority" was measured to be FALSE: RLS
-- returns zero rows on all three source tables for that identity, so this
-- is NOT the pre-P4 direct-DML surface that section 8 of the P3 contract
-- defers to P4. It is an authorization gap in a function introduced by the
-- coordinated release itself.
--
-- WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT. It adds the
-- canonical guard and nothing else.
--
--   * The eligibility predicate is preserved EXACTLY, term for term.
--   * LANGUAGE becomes plpgsql solely because LANGUAGE sql cannot RAISE;
--     that is the only way to emit the canonical 'sem_permissao' / 42501
--     refusal the other three read RPCs already emit.
--   * STABLE, SECURITY DEFINER, SET search_path = '', the signature, the
--     return type and the OWNER are unchanged.
--   * The ACL is unchanged: `authenticated` KEEPS EXECUTE and is refused in
--     the BODY, exactly like oc_disponibilidade_op,
--     pedido_elegivel_cancelamento and listar_fila_aceite_fornecedor. The
--     P3 grant sweep requires `authenticated` to reach all 14 RPCs, so
--     revoking EXECUTE would be the WRONG correction.
--   * No other function, table, policy, trigger, grant or business rule is
--     touched. This is not a P4 direct-DML containment step and does not
--     anticipate one.
--
-- REGRESSION SURFACE FOR THE AUTHORIZED CALLER: none. The only caller is
-- the administrative delivery surface (js/screens/entrega-writes.js ::
-- podeRecuperarOpAcabamento, consumed by js/screens/entrega-form.js), which
-- runs as an administrator, and which already treats ANY error as
-- `elegivel: false` and renders no recovery action. No internal SQL caller
-- exists: no other routine in the catalogue references this function, and
-- db/111 only asserts its EXISTENCE by name.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The guarded replacement
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_recuperar_op_acabamento(p_entrega_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Canonical read-RPC guard, identical in shape and error contract to
  -- db/101 oc_disponibilidade_op and db/105 pedido_elegivel_cancelamento.
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- Predicate preserved EXACTLY as shipped in db/108 section 7.
  RETURN (
    EXISTS (SELECT 1 FROM public.entregas e WHERE e.id = p_entrega_id)
    AND NOT EXISTS (SELECT 1 FROM public.ops o
                     WHERE o.origem_entrega_id = p_entrega_id
                       AND o.tipo IN ('latex', 'acabamento'))
    AND EXISTS (SELECT 1 FROM public.op_acabamento_tentativas t
                 WHERE t.origem_entrega_id = p_entrega_id
                   AND t.resultado = 'falha')
  );
END
$$;

ALTER FUNCTION public.pode_recuperar_op_acabamento(BIGINT) OWNER TO postgres;

COMMENT ON FUNCTION public.pode_recuperar_op_acabamento(BIGINT) IS
  'db/108 (9.9.J), guarded by db/113: true only when the delivery is committed, NO canonical finishing OP exists for the identity, and a PROVED falha attempt row exists. Retry is permitted only after proved failure. ADMIN ONLY: refuses sem_permissao (42501) without auth.uid() and public.is_admin(), because the predicate reads entregas, ops and op_acabamento_tentativas, none of which are readable by a non-admin authenticated identity under RLS.';

-- Deliberately NO REVOKE and NO GRANT: CREATE OR REPLACE FUNCTION preserves
-- the existing ACL, and the intended final state is the one db/108 already
-- established (postgres=X/postgres, authenticated=X/postgres). Section 2
-- asserts that, rather than restating a normalized set that could differ
-- from the measured one.

-- ---------------------------------------------------------------------
-- 2. Self-verification — fail closed inside the same transaction
-- ---------------------------------------------------------------------
DO $db113$
DECLARE
  v_src   TEXT;
  v_acl   TEXT;
  v_owner TEXT;
BEGIN
  SELECT p.prosrc,
         COALESCE(array_to_string(p.proacl, ','), 'NULL'),
         pg_get_userbyid(p.proowner)
    INTO v_src, v_acl, v_owner
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'pode_recuperar_op_acabamento';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'db/113: pode_recuperar_op_acabamento is absent';
  END IF;

  -- 2.1 The guard is present.
  IF v_src NOT ILIKE '%is_admin%' OR v_src NOT ILIKE '%auth.uid%'
     OR v_src NOT ILIKE '%sem_permissao%' THEN
    RAISE EXCEPTION 'db/113: the admin guard is not present in the body';
  END IF;

  -- 2.2 The eligibility predicate survived intact.
  IF v_src NOT ILIKE '%op_acabamento_tentativas%'
     OR v_src NOT ILIKE '%origem_entrega_id%'
     OR v_src NOT ILIKE '%falha%'
     OR v_src NOT ILIKE '%latex%'
     OR v_src NOT ILIKE '%acabamento%' THEN
    RAISE EXCEPTION 'db/113: the eligibility predicate was altered';
  END IF;

  -- 2.3 Declared properties are unchanged.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'pode_recuperar_op_acabamento'
       AND p.prosecdef
       AND p.provolatile = 's'
       AND p.prorettype = 'boolean'::regtype
       AND EXISTS (
             SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) e
              WHERE e LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION 'db/113: SECURITY DEFINER / STABLE / search_path / return type drifted';
  END IF;

  -- 2.4 Ownership and ACL are exactly the db/108 state. Compared as a SET
  --     through aclexplode, never by substring: 'postgres=X/postgres' is a
  --     substring of many wrong ACLs, and grantee 0 is PUBLIC.
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'db/113: owner is %, expected postgres', v_owner;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p,
           LATERAL aclexplode(p.proacl) a
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'pode_recuperar_op_acabamento'
       AND (a.grantee = 0                                            -- PUBLIC
            OR pg_catalog.pg_get_userbyid(a.grantee)
                 NOT IN ('postgres', 'authenticated')
            OR a.privilege_type <> 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'db/113: authority was BROADENED, measured %', v_acl;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p,
           LATERAL aclexplode(p.proacl) a
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'pode_recuperar_op_acabamento'
       AND pg_catalog.pg_get_userbyid(a.grantee) = 'authenticated'
       AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'db/113: authenticated lost EXECUTE; the P3 grant sweep requires it, measured %', v_acl;
  END IF;

  -- 2.5 Nothing else in the finishing cluster moved.
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('_op_acabamento_criar', 'gerar_op_acabamento',
                           'pode_recuperar_op_acabamento', 'gerar_op_latex_split')) <> 4 THEN
    RAISE EXCEPTION 'db/113: a db/108 finishing object is missing';
  END IF;
END
$db113$;

COMMIT;
