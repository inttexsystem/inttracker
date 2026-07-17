-- ============================================================
-- Admin Access Level Schema — public.usuarios.nivel_acesso
-- ============================================================
-- Phase: G28-CAMADA-2 A2.1 (nivel_acesso schema)
-- Spec:  docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md
--
-- Ratified decisions honored here:
--   - Two levels only: 'completo' / 'somente_leitura'. Expandable
--     later via the CHECK; NO permission-overrides table (registered
--     as a future option, conditioned on demonstrated real need).
--   - public.usuarios.tipo is UNTOUCHED — it anchors every existing
--     RLS policy (db/03, db/12). This migration does not alter tipo,
--     does not redefine is_admin(), and does not touch any policy.
--   - nivel_acesso is meaningful only for tipo='admin'. Non-admin
--     rows carry the default 'completo' with no effect (is_admin_full()
--     already requires tipo='admin').
--
-- Scope of THIS migration (additive, forward-only, idempotent):
--   1. Column public.usuarios.nivel_acesso TEXT NOT NULL DEFAULT
--      'completo', with a named CHECK ('completo','somente_leitura').
--      Existing rows default to 'completo' — every current admin keeps
--      full privileges, no silent privilege change.
--   2. Helper public.is_admin_full() — SECURITY DEFINER STABLE,
--      requires ativo IS TRUE AND tipo='admin' AND
--      nivel_acesso='completo'. Same shape/search_path/EXCEPTION as
--      db/12's is_admin(). NOT consumed by any policy yet — modal
--      wiring (A2.2) and route enforcement (A2.3) are separate phases.
--   3. Explicit ACL on is_admin_full() (db/30/54/57 lesson): revoke the
--      default PUBLIC/anon EXECUTE, grant only to authenticated.
--
-- Audit interaction: db/60's trg_usuario_evento already watches
--   nivel_acesso (it was written to). Before this migration the column
--   was absent, so to_jsonb(OLD) never carried the key and the diff
--   skipped it; now that it exists, an authenticated admin UPDATE that
--   changes nivel_acesso records a 'perfil_alterado' event with payload
--   {"nivel_acesso": {"de": <old>, "para": <new>}}. No change to the
--   trigger is required — db/60 anticipated this column.
--
-- Not in scope: usuarios.tipo, is_admin(), any RLS policy, the
--   overrides table, UI (A2.2), route enforcement (A2.3), production.
--
-- Idempotent: can run multiple times without cumulative effect.
-- No destructive DDL, no DML, no real data, no secrets.
-- ============================================================


-- ============================================================
-- 1. Column public.usuarios.nivel_acesso (+ named CHECK)
-- ============================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS nivel_acesso TEXT NOT NULL DEFAULT 'completo';

COMMENT ON COLUMN public.usuarios.nivel_acesso IS
  'Admin access level: ''completo'' (full) or ''somente_leitura'' (read-only). Meaningful only for tipo=''admin''. DEFAULT ''completo'' preserves current behavior for every existing admin. Expandable later; enforced by is_admin_full(), not by tipo (which anchors existing RLS).';

-- Named CHECK, added idempotently (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_nivel_acesso_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_nivel_acesso_check
      CHECK (nivel_acesso IN ('completo', 'somente_leitura'));
  END IF;
END $$;


-- ============================================================
-- 2. Helper public.is_admin_full()
-- Same shape as db/12's is_admin() (plpgsql, SECURITY DEFINER, STABLE,
-- search_path=public,auth, EXCEPTION -> FALSE), with the additional
-- nivel_acesso='completo' requirement. NOT consumed by any policy in
-- this phase — is_admin() remains the sole RLS anchor, unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_full()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_tipo  TEXT;
  v_ativo BOOLEAN;
  v_nivel TEXT;
BEGIN
  SELECT tipo, ativo, nivel_acesso
    INTO v_tipo, v_ativo, v_nivel
  FROM public.usuarios
  WHERE id = auth.uid();
  RETURN COALESCE(
    v_ativo IS TRUE AND v_tipo = 'admin' AND v_nivel = 'completo',
    FALSE
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


-- ============================================================
-- 3. Explicit ACL on is_admin_full() (db/30/54/57 lesson)
-- A freshly created function is EXECUTE-able by PUBLIC by default;
-- revoke that (and anon) and grant only to authenticated — the same
-- audience is_admin() serves for RLS.
-- ============================================================

REVOKE ALL ON FUNCTION public.is_admin_full() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_full() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_full() TO authenticated;


-- ============================================================
-- 4. Reload schema cache (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
