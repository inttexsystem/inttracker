-- ============================================================
-- Fase: G28-CAMADA-2 A6.1 — Audit trail schema for public.usuarios
--
-- Scope:
--   1. Table public.usuarios_eventos (append-only event log).
--   2. Trigger AFTER UPDATE on public.usuarios to record changes to
--      ativo, tipo, nivel_acesso (when the column exists) and
--      senha_temporaria.
--   3. RLS: admin-only read; no client writes (write path is the
--      SECURITY DEFINER trigger function only).
--
-- Precedent: public.op_eventos + trg_op_evento (db/21) and
-- public.document_link_revisions (db/51) — append-only event table
-- with an automatic trigger, admin-only RLS read, writes restricted
-- to a SECURITY DEFINER function.
--
-- Actor resolution / no double-recording design decision:
--   admin edits to public.usuarios happen through two distinct paths:
--     (a) direct PostgREST UPDATE from the authenticated admin session
--         (js/admin-usuarios-writes.js updateUsuario) — auth.uid()
--         resolves to the acting admin's id in this path;
--     (b) Supabase Edge Functions (admin-disable-user,
--         admin-reactivate-user, admin-reset-user-password,
--         admin-create-user, admin-delete-user) using the
--         service_role key — there is no JWT/session in that DB
--         connection, so auth.uid() is NULL in this path. A6.2 wires
--         those Edge Functions to insert their own usuarios_eventos
--         row explicitly, with the actor id they already resolved
--         from their own caller's JWT.
--   The trigger therefore only records when auth.uid() IS NOT NULL
--   (path a). When auth.uid() IS NULL (path b, service_role), the
--   trigger is a no-op — it does not know a caller for that context,
--   and A6.2 will record explicitly, avoiding a double entry once
--   wired. This mirrors op_eventos.criado_por (nullable, auth.uid()).
--
-- nivel_acesso: A2.1 (nivel_acesso schema) has not landed yet — the
-- column does not exist in public.usuarios at the time of this
-- migration. The trigger diffs OLD/NEW via to_jsonb() and a watched
-- key list; a key absent from the row (column not yet added) simply
-- never appears in the diff. No follow-up migration to this trigger
-- is required when A2.1 adds nivel_acesso later.
--
-- Idempotent: can run multiple times without cumulative effect.
-- No destructive DELETE, no real data, no secrets.
-- ============================================================


-- ============================================================
-- 1. Table public.usuarios_eventos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuarios_eventos (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  ator_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usuarios_eventos IS
  'Append-only audit trail of administrative changes to public.usuarios. Direct-UPDATE changes (ativo, tipo, nivel_acesso, senha_temporaria) are recorded by trg_usuario_evento; Edge-Function-driven changes (service_role, no auth.uid()) are recorded explicitly by those functions (A6.2), never by this trigger.';

COMMENT ON COLUMN public.usuarios_eventos.tipo_evento IS
  'Event type. perfil_alterado for trigger-recorded direct-UPDATE diffs. Extensible for Edge-Function-recorded events (A6.2).';

COMMENT ON COLUMN public.usuarios_eventos.ator_id IS
  'auth.users id of the actor. NULL when the actor cannot be resolved (e.g. compensating/system action).';

COMMENT ON COLUMN public.usuarios_eventos.payload IS
  'Event metadata. For perfil_alterado: {"<campo>": {"de": <old>, "para": <new>}, ...} for each changed watched field. Not a substitute for typed columns.';

CREATE INDEX IF NOT EXISTS usuarios_eventos_usuario_id_idx
  ON public.usuarios_eventos(usuario_id);

CREATE INDEX IF NOT EXISTS usuarios_eventos_criado_em_idx
  ON public.usuarios_eventos(usuario_id, criado_em DESC);


-- ============================================================
-- 2. Trigger: record watched-field changes in usuarios_eventos
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_usuario_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old     JSONB;
  v_new     JSONB;
  v_changed JSONB := '{}'::jsonb;
  v_key     TEXT;
  v_watched TEXT[] := ARRAY['ativo', 'tipo', 'nivel_acesso', 'senha_temporaria'];
BEGIN
  -- service_role context (Edge Functions): no JWT, auth.uid() is NULL.
  -- Those flows record explicitly (A6.2) — skip here to avoid
  -- double-recording. See design decision note above.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_key IN ARRAY v_watched LOOP
    IF v_old ? v_key AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      v_changed := v_changed || jsonb_build_object(
        v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key)
      );
    END IF;
  END LOOP;

  IF v_changed <> '{}'::jsonb THEN
    INSERT INTO public.usuarios_eventos (usuario_id, tipo_evento, ator_id, payload)
    VALUES (NEW.id, 'perfil_alterado', auth.uid(), v_changed);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuario_evento ON public.usuarios;
CREATE TRIGGER trg_usuario_evento
  AFTER UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_usuario_evento();


-- ============================================================
-- 3. RLS + grants for public.usuarios_eventos
-- Admin-only read; no client writes (write path is the SECURITY
-- DEFINER trigger function above, owned by the migration role,
-- which bypasses RLS as table owner — same model as
-- document_link_revisions, db/51 §4).
-- ============================================================

ALTER TABLE public.usuarios_eventos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usuarios_eventos FROM PUBLIC;
REVOKE ALL ON TABLE public.usuarios_eventos FROM anon;
REVOKE ALL ON TABLE public.usuarios_eventos FROM authenticated;

GRANT SELECT ON TABLE public.usuarios_eventos TO authenticated;

DROP POLICY IF EXISTS usuarios_eventos_admin_select ON public.usuarios_eventos;
CREATE POLICY usuarios_eventos_admin_select ON public.usuarios_eventos FOR SELECT
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role by design —
-- the table is written exclusively by trg_usuario_evento (and, from
-- A6.2 onward, by the Edge Functions using service_role, which
-- bypasses RLS/grants entirely).


-- ============================================================
-- Schema cache reload (PostgREST)
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
