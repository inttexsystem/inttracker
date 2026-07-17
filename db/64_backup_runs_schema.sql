-- ============================================================
-- Backup Runs Schema — public.backup_runs / public.backup_run_destinations
-- ============================================================
-- Phase: G28-CAMADA-3 BK4.1 (backup_runs schema)
-- Contract: docs/architecture/CAMADA3_BACKUP_CONTRACT.md
--
-- Ratified decisions honored here:
--   - Scope is public data + the full auth schema (contract SS1). This
--     migration does not touch auth.* — it only records, per run, that
--     the scope was 'public+auth' (CHECK-locked to that single ratified
--     value; any future scope change is its own contract revision, not
--     a free-text column here).
--   - Cadence/retention: GFS classes, manual backups never expire
--     (contract SS2) — retention_class is stored per run; the pruning
--     ALGORITHM itself is BK6, out of scope here.
--   - Integrity: SHA-256 + per-table row-count manifest as the restore
--     assertion baseline (contract SS3) — both persisted per run.
--   - N-destination contract (contract SS4): public.backup_run_destinations
--     is a child table, one row per (run, destination), so a single run
--     carries independent per-destination status/last-error. destination
--     is deliberately an open TEXT field (no CHECK enum) so adding a
--     second destination (OneDrive) never requires a schema migration.
--   - Trigger-agnostic exporter contract (contract SS5): the writer path
--     is two service_role-only RPCs (iniciar_backup_run /
--     finalizar_backup_run), gated the same way as the exporter itself
--     will be — no JWT, service_role only, mirroring db/49's
--     upsert_document_technical_evidence_ingestor_state() gate
--     (auth.role() = 'service_role', checked inside the function body,
--     not relied upon via GRANT alone).
--
-- Scope of THIS migration (additive, forward-only, idempotent):
--   1. Table public.backup_runs — one row per backup execution,
--      append-only (started_at, finished_at, status, scope, bytes,
--      sha256, row_count_manifest, triggered_by, retention_class, error).
--   2. Table public.backup_run_destinations — one row per (run,
--      destination) upload attempt (run_id, destination, status,
--      uploaded_at, error).
--   3. RLS admin-only SELECT on both tables. No INSERT/UPDATE/DELETE
--      policy for any client role, on either table — append-only intent
--      enforced structurally, not just by convention. All writes happen
--      exclusively through the two SECURITY DEFINER RPCs below, which
--      write as the table owner (postgres) and therefore bypass RLS by
--      ownership, never by a permissive policy.
--   4. RPCs public.iniciar_backup_run / public.finalizar_backup_run,
--      service_role-only (both GRANT and an internal auth.role() gate).
--      finalizar_backup_run writes the terminal run row AND every
--      backup_run_destinations row for that run in one call/transaction
--      — a malformed destination element aborts the whole call, so a
--      run is never left recorded as completed/failed with partial or
--      missing destination rows.
--   5. Explicit, complete ACL on every new table/function (db/57/db/63
--      standard): REVOKE ALL from PUBLIC/anon/authenticated/service_role
--      first, then GRANT exactly the intended privilege — never a delta
--      against Supabase's default grants.
--
-- Not in scope (own future orders, per the contract's BK sequence):
--   - the exporter itself (dump/upload logic) — BK4.2
--   - the read-only UI panel + manual-trigger write — BK5
--   - retention PRUNING (deleting/expiring old runs/bundles) — BK6
--   - the controlled-restore runbook — BK7
--   - the real recovery drill — BK8
--   - trigger selection (GH Actions / Vercel cron / other) —
--     CAMADA3-TRIGGER-SELECTION
--   - production
--
-- Idempotent: can run multiple times without cumulative effect.
-- No destructive DDL, no DML, no real data, no secrets.
-- ============================================================


-- ============================================================
-- 1. Table public.backup_runs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at          TIMESTAMPTZ,
  status               TEXT        NOT NULL DEFAULT 'running',
  scope                TEXT        NOT NULL DEFAULT 'public+auth',
  bytes                BIGINT,
  sha256               TEXT,
  row_count_manifest   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  triggered_by         TEXT        NOT NULL,
  retention_class      TEXT        NOT NULL,
  error                TEXT
);

COMMENT ON TABLE public.backup_runs IS
  'Append-only record of each automated backup execution (Camada 3, BK4.1). One row per exporter (BK4.2) invocation, independent of upload destination — see public.backup_run_destinations for per-destination state.';
COMMENT ON COLUMN public.backup_runs.status IS
  'running|completed|failed. running is written by iniciar_backup_run; completed/failed by finalizar_backup_run.';
COMMENT ON COLUMN public.backup_runs.scope IS
  'Locked to the single value ratified by the contract (public+auth). Document bytes and Storage are out of scope by design (CAMADA3_BACKUP_CONTRACT.md SS1) — any scope change requires a contract revision, not a free-text value here.';
COMMENT ON COLUMN public.backup_runs.row_count_manifest IS
  'Per-table row counts captured at backup time, used as the restore assertion baseline in the drill (CAMADA3_BACKUP_CONTRACT.md SS3/SS6). JSON object {"table_name": count, ...}.';
COMMENT ON COLUMN public.backup_runs.triggered_by IS
  'scheduled|manual. scheduled = the eventual automated trigger (CAMADA3-TRIGGER-SELECTION, not yet chosen); manual = an operator ran the exporter by hand.';
COMMENT ON COLUMN public.backup_runs.retention_class IS
  'gfs|manual. manual never expires and never consumes a GFS retention slot (CAMADA3_BACKUP_CONTRACT.md SS2). Kept distinct from triggered_by because a scheduled run can still be pinned manual by operator decision (e.g. a pre-migration backup).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_status_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_status_check
      CHECK (status IN ('running','completed','failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_scope_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_scope_check
      CHECK (scope IN ('public+auth'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_triggered_by_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_triggered_by_check
      CHECK (triggered_by IN ('scheduled','manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_retention_class_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_retention_class_check
      CHECK (retention_class IN ('gfs','manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_bytes_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_bytes_check
      CHECK (bytes IS NULL OR bytes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_sha256_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_sha256_check
      CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_row_count_manifest_object_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_row_count_manifest_object_check
      CHECK (jsonb_typeof(row_count_manifest) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_terminal_times_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_terminal_times_check
      CHECK (
        (status = 'running' AND finished_at IS NULL)
        OR (status IN ('completed','failed') AND finished_at IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_runs_failed_reason_check'
       AND conrelid = 'public.backup_runs'::regclass
  ) THEN
    ALTER TABLE public.backup_runs
      ADD CONSTRAINT backup_runs_failed_reason_check
      CHECK (status <> 'failed' OR NULLIF(btrim(COALESCE(error, '')), '') IS NOT NULL);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS backup_runs_started_at_idx
  ON public.backup_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS backup_runs_status_idx
  ON public.backup_runs(status);


-- ============================================================
-- 2. Table public.backup_run_destinations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backup_run_destinations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID        NOT NULL REFERENCES public.backup_runs(id) ON DELETE CASCADE,
  destination   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  uploaded_at   TIMESTAMPTZ,
  error         TEXT
);

COMMENT ON TABLE public.backup_run_destinations IS
  'Per-destination upload state of a backup_runs row, N destinations from day one (CAMADA3_BACKUP_CONTRACT.md SS4). Google Drive is the first implemented destination; OneDrive is interface-ready/not configured — no code may assume a single destination.';
COMMENT ON COLUMN public.backup_run_destinations.destination IS
  'Open, extensible field (google_drive, onedrive, future values) — deliberately WITHOUT a CHECK enum so adding a destination never requires a migration, unlike backup_runs.scope, which the contract treats as a gated revision event.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_run_destinations_destination_check'
       AND conrelid = 'public.backup_run_destinations'::regclass
  ) THEN
    ALTER TABLE public.backup_run_destinations
      ADD CONSTRAINT backup_run_destinations_destination_check
      CHECK (destination = lower(destination) AND char_length(btrim(destination)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_run_destinations_status_check'
       AND conrelid = 'public.backup_run_destinations'::regclass
  ) THEN
    ALTER TABLE public.backup_run_destinations
      ADD CONSTRAINT backup_run_destinations_status_check
      CHECK (status IN ('pending','ok','failed','skipped'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_run_destinations_ok_uploaded_check'
       AND conrelid = 'public.backup_run_destinations'::regclass
  ) THEN
    ALTER TABLE public.backup_run_destinations
      ADD CONSTRAINT backup_run_destinations_ok_uploaded_check
      CHECK (status <> 'ok' OR uploaded_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'backup_run_destinations_failed_reason_check'
       AND conrelid = 'public.backup_run_destinations'::regclass
  ) THEN
    ALTER TABLE public.backup_run_destinations
      ADD CONSTRAINT backup_run_destinations_failed_reason_check
      CHECK (status <> 'failed' OR NULLIF(btrim(COALESCE(error, '')), '') IS NOT NULL);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS backup_run_destinations_run_idx
  ON public.backup_run_destinations(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS backup_run_destinations_run_destination_uidx
  ON public.backup_run_destinations(run_id, destination);


-- ============================================================
-- 3. RLS admin-only SELECT and grants (both tables)
-- ============================================================

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_run_destinations ENABLE ROW LEVEL SECURITY;

-- Admin-only read. No INSERT/UPDATE/DELETE policy for any client
-- role on either table — append-only intent (contract SS3/SS5)
-- enforced structurally: every write happens through the two
-- SECURITY DEFINER RPCs below, which run as the table owner
-- (postgres) and bypass RLS by ownership, never by a permissive
-- policy that a client role could otherwise reach.
DROP POLICY IF EXISTS backup_runs_admin_select ON public.backup_runs;
CREATE POLICY backup_runs_admin_select ON public.backup_runs
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS backup_run_destinations_admin_select ON public.backup_run_destinations;
CREATE POLICY backup_run_destinations_admin_select ON public.backup_run_destinations
  FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.backup_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.backup_runs FROM anon;
REVOKE ALL ON TABLE public.backup_runs FROM authenticated;
REVOKE ALL ON TABLE public.backup_runs FROM service_role;
REVOKE ALL ON TABLE public.backup_run_destinations FROM PUBLIC;
REVOKE ALL ON TABLE public.backup_run_destinations FROM anon;
REVOKE ALL ON TABLE public.backup_run_destinations FROM authenticated;
REVOKE ALL ON TABLE public.backup_run_destinations FROM service_role;

-- Admin read via RLS; service_role never reads/writes either table
-- directly — every exporter interaction goes through the RPCs
-- below (which write as table owner, not as service_role).
GRANT SELECT ON TABLE public.backup_runs TO authenticated;
GRANT SELECT ON TABLE public.backup_run_destinations TO authenticated;


-- ============================================================
-- 4. RPC public.iniciar_backup_run (service_role writer)
-- ============================================================

CREATE OR REPLACE FUNCTION public.iniciar_backup_run(
  p_scope TEXT DEFAULT 'public+auth',
  p_triggered_by TEXT DEFAULT 'manual',
  p_retention_class TEXT DEFAULT 'gfs'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_scope TEXT := COALESCE(NULLIF(btrim(p_scope), ''), 'public+auth');
  v_triggered_by TEXT := lower(NULLIF(btrim(p_triggered_by), ''));
  v_retention_class TEXT := lower(NULLIF(btrim(p_retention_class), ''));
  v_run_id UUID;
BEGIN
  -- Mandatory internal gate: writer service_role only. Do not rely
  -- on GRANT alone (db/49 pattern). The exporter has no JWT — same
  -- authorization path as the admin Edge Functions.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'writer_required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_scope <> 'public+auth' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_scope');
  END IF;

  IF v_triggered_by NOT IN ('scheduled', 'manual') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_triggered_by');
  END IF;

  IF v_retention_class NOT IN ('gfs', 'manual') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_retention_class');
  END IF;

  INSERT INTO public.backup_runs (scope, status, triggered_by, retention_class)
  VALUES (v_scope, 'running', v_triggered_by, v_retention_class)
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'run_id', v_run_id,
    'scope', v_scope,
    'triggered_by', v_triggered_by,
    'retention_class', v_retention_class
  );
END;
$$;

COMMENT ON FUNCTION public.iniciar_backup_run(TEXT, TEXT, TEXT) IS
  'service_role writer: opens a backup run in status running. The exporter (BK4.2) calls this at the start of every run; finalizar_backup_run closes it with the terminal status and its destination rows.';


-- ============================================================
-- 5. RPC public.finalizar_backup_run (service_role writer)
-- ============================================================

CREATE OR REPLACE FUNCTION public.finalizar_backup_run(
  p_run_id UUID,
  p_status TEXT,
  p_bytes BIGINT DEFAULT NULL,
  p_sha256 TEXT DEFAULT NULL,
  p_row_count_manifest JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL,
  p_destinations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status TEXT := lower(NULLIF(btrim(p_status), ''));
  v_error TEXT := NULLIF(btrim(p_error), '');
  v_run_id UUID;
  v_dest JSONB;
  v_dest_count INTEGER := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'writer_required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_run_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'run_id_required');
  END IF;

  IF v_status NOT IN ('completed', 'failed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid_status');
  END IF;

  IF v_status = 'failed' AND v_error IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'error_required_when_failed');
  END IF;

  IF p_row_count_manifest IS NULL
     OR jsonb_typeof(p_row_count_manifest) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'row_count_manifest_invalid');
  END IF;

  IF p_destinations IS NULL
     OR jsonb_typeof(p_destinations) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'destinations_invalid');
  END IF;

  -- Strict transition: only a still-running run can be finalized.
  -- Double-finalize is not a supported case in this phase (BK4.1) —
  -- the exporter (BK4.2) is the sole caller and calls this RPC
  -- exactly once per run.
  UPDATE public.backup_runs
     SET status = v_status,
         bytes = p_bytes,
         sha256 = p_sha256,
         row_count_manifest = p_row_count_manifest,
         error = v_error,
         finished_at = now()
   WHERE id = p_run_id
     AND status = 'running'
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'run_not_running_or_not_found',
      'run_id', p_run_id
    );
  END IF;

  -- One backup_run_destinations row per array element. Any single
  -- INSERT failure (e.g. a NULL destination, or a status outside the
  -- table CHECK) aborts the whole RPC call — a run is never left
  -- recorded as completed/failed with partial or missing destination
  -- rows. This is intentional fail-loud behavior: this writer is
  -- internal-only (the exporter, BK4.2, is its sole caller), so a
  -- malformed element is a caller bug that should surface immediately
  -- as a hard error, not be silently absorbed.
  FOR v_dest IN SELECT * FROM jsonb_array_elements(p_destinations)
  LOOP
    INSERT INTO public.backup_run_destinations (
      run_id, destination, status, uploaded_at, error
    )
    VALUES (
      v_run_id,
      lower(NULLIF(btrim(v_dest ->> 'destination'), '')),
      lower(COALESCE(NULLIF(btrim(v_dest ->> 'status'), ''), 'pending')),
      NULLIF(v_dest ->> 'uploaded_at', '')::TIMESTAMPTZ,
      NULLIF(btrim(v_dest ->> 'error'), '')
    );
    v_dest_count := v_dest_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'run_id', v_run_id,
    'status', v_status,
    'destinations_recorded', v_dest_count
  );
END;
$$;

COMMENT ON FUNCTION public.finalizar_backup_run(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB) IS
  'service_role writer: closes a backup run as completed or failed and, in the same transaction, writes one public.backup_run_destinations row per element of p_destinations ({destination, status, uploaded_at, error}). Any destination insert failure rolls back the entire run.';


-- ============================================================
-- 6. RPC grants and schema cache reload
-- ============================================================

REVOKE ALL ON FUNCTION public.iniciar_backup_run(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.iniciar_backup_run(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.iniciar_backup_run(TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_backup_run(TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.finalizar_backup_run(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_backup_run(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.finalizar_backup_run(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_backup_run(UUID, TEXT, BIGINT, TEXT, JSONB, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
