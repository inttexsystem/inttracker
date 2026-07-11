# Supabase Writer Runbook

This runbook is for the server-side Documents Ingestor CLI only. It never belongs in the Controle de Tapetes frontend.

## Staging Only

Use only the staging project `ucrjtfswnfdlxwtmxnoo`. Before a confirmed write, the local ignored `.env` must contain the staging URL, matching project ref, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_WRITER_ENABLED=true`.

Never use the production project, an anon key, a PostgreSQL password, or a frontend module as the writer credential. Never commit `.env`.

## Generate Local Exports

```bash
npm run export:mapped
npm run write:latest
npm run export:ingestion-events
```

The writer consumes `data/exports/documentos-mapeados.jsonl` and `data/exports/ingestion-events.jsonl`. The canonical events file is generated from SQLite `ingestion_events`; it preserves `ingestion_events.id` as `ingestion_event_id`.

Do not pass `data/outbox/document-events.jsonl` to `sync:supabase`. It is a legacy transport and can lack canonical event IDs.

## Dry Run

```bash
npm run sync:supabase -- --mapped data/exports/documentos-mapeados.jsonl --events data/exports/ingestion-events.jsonl
```

The dry-run validates both JSONLs and reports planned candidates/events without creating a Supabase client or scan run.

## Confirmed Staging Write

```bash
npm run sync:supabase -- --mapped data/exports/documentos-mapeados.jsonl --events data/exports/ingestion-events.jsonl --confirm-supabase-write
```

Verify `scan_run.status=completed`, canonical status values, preserved `document_id` and `ingestion_event_id`, and no residual `running` scan. Re-running the same inputs must not duplicate events.

The writer leaves `pedido_id` and `fornecedor_id` null in this version and never writes `document_decisions`.

## Recovering an Abandoned Scan Lock

The writer creates one `document_scan_runs` row with `status='running'` per source and relies on the partial unique index `document_scan_runs_running_source_uidx` to block concurrent runs. If a run crashes between the insert and its finalization, the row stays `running` and every later run for that source fails with `scan_already_running`.

`--recover-stale` opts into a compare-and-swap recovery **before** the scan run starts. It calls the staging RPC `recuperar_document_scan_runs_travados`, which flips only runs older than the stale window from `running` to `failed`, preserves `started_at`/`source`/`triggered_by`, sets `finished_at`, and records an auditable `error_message` sentinel (`stale_recovered: ...`). It never deletes rows and never touches a run younger than the window.

```bash
npm run sync:supabase -- \
  --mapped data/exports/documentos-mapeados.jsonl \
  --events data/exports/ingestion-events.jsonl \
  --confirm-supabase-write \
  --recover-stale
```

- `--stale-after-minutes <n>` sets the stale window (default `30`; a hard floor of `5` is enforced by both the CLI-side client and the SQL RPC, so a live run is never recovered).
- Recovery requires `--confirm-supabase-write`. In dry-run there is no service-role client, so `--recover-stale` is ignored (the CLI prints a note and `stale_recovery.attempted` stays `false`).
- The result envelope reports `stale_recovery: { attempted, recovered_count }`. A repeatedly non-zero `recovered_count` means runs keep dying before finalizing — investigate the crash, do not just keep recovering.
- Requires migration `db/40_document_scan_runs_stale_recovery.sql` applied to staging. If the RPC is missing, the writer aborts with `migration_40_required` **before** creating any scan run (no blind write).
- Authorization: the RPC accepts `service_role` (writer self-heal) or an authenticated `is_admin()` session (manual unstick from the UI).

## Document Scan Request Watcher (G24-B2)

`watch:scan-requests` is the worker process that consumes `public.document_scan_requests` (G24-B1) and runs the real scan flow end-to-end. It is the recommended operator entrypoint: it never starts automatically, never installs a daemon, and never opens an HTTP server. Tests and manual runs use `--once` (the default) to bound the run to a single cycle.

**Required gates.** Without BOTH `--confirm-real-google` AND `--confirm-supabase-write`, the watcher runs in **dry-run / mock mode**: it never instantiates the Gmail client, never constructs the service-role writer, and never consumes a real request. The dry-run is what tests, manual operator probes, and CI exercise.

```bash
# dry-run (mock-first; no Gmail, no Supabase, no service-role client)
npm run watch:scan-requests -- --source gmail

# confirmed staging run (a single cycle; default --once)
npm run watch:scan-requests -- \
  --source gmail \
  --confirm-real-google \
  --confirm-supabase-write

# confirmed staging run with optional stale-recovery
npm run watch:scan-requests -- \
  --source gmail \
  --confirm-real-google \
  --confirm-supabase-write \
  --recover-stale \
  --stale-after-minutes 30
```

**Flags.**

- `--source <name>` (required): logical source (e.g. `gmail`). Matches the queue's `source` and the run's `source`.
- `--once` (default) / `--no-once`: bound the watcher to a single cycle vs. loop with `--poll-seconds`.
- `--poll-seconds <n>` (1-3600; default `30`): idle wait between empty polls when `--no-once` is set.
- `--recover-stale` (boolean): opt into `recuperar_document_scan_runs_travados` before the new run.
- `--stale-after-minutes <n>` (default `30`; floor `5` via the RPC).
- `--confirm-real-google` / `--confirm-supabase-write`: required for a real cycle. Missing either → dry-run.
- `--json`: render the result envelope as JSON instead of human-readable text.

**Lifecycle of a confirmed cycle.**

1. (optional) recover stale `document_scan_runs` older than the window.
2. `claim_next_document_scan_request` (service_role, `FOR UPDATE SKIP LOCKED`); empty queue → exit (in `--once`) or sleep.
3. `startScanRun` → `scan_run_id`; on `already_running`, finish request as `failed` with `scan_already_running` and skip the cycle.
4. `mark_document_scan_request_running` (claimed → running + `scan_run_id`); on failure, finish the run as `failed` and the request as `failed`.
5. Run the scan cycle: `scanGmail(confirmReal)` → `exportMappedDocuments` → `runSyncSupabase(scanRunId)`. `runSyncSupabase` is told to skip the run lifecycle via the new `scanRunId` option; the watcher owns the run.
6. `finishScanRun` (`completed` or `failed`).
7. `finish_document_scan_request` (`completed` or `failed`); `error_message` sanitized to 1000 chars and only set on `failed`.

**Concurrency.** Two watchers are safe: `FOR UPDATE SKIP LOCKED` on the queue + the partial unique index on `document_scan_runs` ensure that the second instance never receives the same request, never opens a parallel run, and only sees the empty result.

**Required migration.** G24-B1 — `db/41_document_scan_requests_queue.sql` — must be applied to staging. If the queue RPCs are missing, the writer aborts with `migration_41_required` **before** claiming or starting anything (no blind write). The watcher never creates requests; only the operator (admin) creates them via the UI's `solicitar_document_scan`.

**Result envelope.**

```json
{
  "ok": true,
  "dry_run": false,
  "source": "gmail",
  "cycles": 1,
  "requests_processed": 1,
  "requests_completed": 1,
  "requests_failed": 0,
  "empty_polls": 0,
  "errors": [],
  "events": [
    { "kind": "cycle.start", "requestId": "…", "source": "gmail" },
    { "kind": "cycle.start_run", "scanRunId": "…" },
    { "kind": "cycle.mark_running", "requestId": "…", "scanRunId": "…" },
    { "kind": "cycle.scan", "mode": "real", "documentsProcessed": 3, "documentsNew": 2 },
    { "kind": "cycle.finish_run", "scanRunId": "…", "status": "completed", "errorMessage": null },
    { "kind": "cycle.finish_request", "requestId": "…", "status": "completed", "errorMessage": null },
    { "kind": "watch.done", "reason": "once_completed" }
  ]
}
```
