-- ============================================================
-- is_admin_full() ACL correction — grants-only
-- ============================================================
-- Phase: G28-CAMADA-2 A2.1-B (grants-only ACL correction over db/62)
-- Spec:  docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md
-- Precedent: db/57 (grants-only correction over db/30).
--
-- Why: db/62 created public.is_admin_full() and revoked the default
-- EXECUTE from PUBLIC and anon, but did NOT revoke service_role, which
-- retained EXECUTE via Supabase's default function privileges
-- (ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO
-- service_role). That left the ACL less strict than the db/54/57
-- standard (authenticated-only) on the service_role row. Functionally
-- harmless — service_role is server-only, bypasses RLS, and
-- is_admin_full() returns FALSE under it (auth.uid() is NULL) — but
-- corrected forward-only for least-privilege consistency.
--
-- This migration states the COMPLETE intended ACL (not a delta): a
-- reader of db/63 alone sees the final intent — EXECUTE for
-- authenticated only; PUBLIC, anon and service_role denied.
--
-- Grants-only: no schema change, no function redefinition, no policy
-- change, no DML. Idempotent. No production.
-- ============================================================

REVOKE ALL ON FUNCTION public.is_admin_full() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_full() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin_full() FROM service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_full() TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
