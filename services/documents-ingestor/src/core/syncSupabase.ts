import { readFileSync } from 'node:fs';
import {
  type CanonicalDocumentStatus,
  type CanonicalIngestorStateWrite,
  type DocumentCandidateWrite,
  type DocumentEventWrite,
  type SupabaseWriterClient,
} from '../supabase/serviceRoleClient.js';

const EVENT_TYPES = new Set<DocumentEventWrite['event_type']>([
  'document.detected',
  'document.linked',
  'document.accepted',
  'document.rejected',
]);

export interface SyncSupabaseOptions {
  mappedPath: string;
  eventsPath?: string;
  confirmWrite?: boolean;
  dryRun?: boolean;
  source?: string;
  recoverStale?: boolean;
  staleAfterMinutes?: number;
  /**
   * If provided, the sync flow uses this existing document_scan_runs.id
   * instead of creating a new one via startScanRun. The caller becomes
   * responsible for calling startScanRun and finishScanRun. Used by the
   * document scan request watcher (G24-B2) so the request owns the
   * scan_run lifecycle end-to-end.
   */
  scanRunId?: string;
}

export interface PreparedCanonicalCandidate {
  candidate: DocumentCandidateWrite;
  canonical: CanonicalIngestorStateWrite | null;
  skip_reason: string | null;
}

export interface PreparedSyncSupabaseInput {
  candidates: PreparedCanonicalCandidate[];
  events: DocumentEventWrite[];
  duplicateEventIds: number;
}

export interface SyncSupabaseResult {
  ok: boolean;
  dry_run: boolean;
  source: string;
  candidates_total: number;
  candidates_upserted: number;
  canonical_base_complete: number;
  canonical_base_skipped: Array<{ document_id: string; reason: string }>;
  events_inserted: number;
  events_skipped: number;
  scan_run: { status: 'dry_run' | 'running' | 'completed' | 'failed' | 'scan_already_running' | 'external_owner' | 'external_owner_failed'; id: string | null };
  stale_recovery: { attempted: boolean; recovered_count: number };
  errors: string[];
}

class SyncSupabaseInputError extends Error {}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SyncSupabaseInputError(`${context} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SyncSupabaseInputError(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function canonicalTimestamp(value: unknown): string | null {
  const raw = optionalText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeEmailReceivedAtSource(value: unknown): 'gmail_internal_date' | 'header_date' | null {
  return value === 'gmail_internal_date' || value === 'header_date' ? value : null;
}

export function normalizeDocumentStatus(value: unknown): CanonicalDocumentStatus {
  const status = requiredText(value, 'status').toLowerCase();
  if (status === 'pending_app_acceptance') return 'pending';
  if (status === 'pending' || status === 'assigned' || status === 'accepted' || status === 'rejected') {
    return status;
  }
  throw new SyncSupabaseInputError(`Invalid document status: ${status}.`);
}

function readJsonl(path: string, label: string): Array<Record<string, unknown>> {
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (error: any) {
    throw new SyncSupabaseInputError(`Unable to read ${label} JSONL: ${error?.message ?? String(error)}`);
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(asRecord(JSON.parse(line), `${label} line ${index + 1}`));
    } catch (error: any) {
      if (error instanceof SyncSupabaseInputError) throw error;
      throw new SyncSupabaseInputError(`Invalid ${label} JSONL at line ${index + 1}: ${error?.message ?? String(error)}`);
    }
  }
  return rows;
}

function normalizeCandidate(row: Record<string, unknown>): DocumentCandidateWrite {
  const documentId = requiredText(row.document_id, 'mapped document_id');
  const status = normalizeDocumentStatus(row.status);
  const schemaVersion = typeof row.schema_version === 'number' && Number.isInteger(row.schema_version)
    ? row.schema_version
    : 1;
  const rawPayload = { ...row, document_id: documentId, status };
  const emailReceivedAt = canonicalTimestamp(row.email_received_at);
  const emailReceivedAtSource = emailReceivedAt ? normalizeEmailReceivedAtSource(row.email_received_at_source) : null;

  return {
    document_id: documentId,
    gmail_message_id: optionalText(row.gmail_message_id),
    attachment_id: optionalText(row.attachment_id),
    sha256: optionalText(row.sha256),
    filename_original: optionalText(row.filename_original),
    tipo_documento: optionalText(row.tipo_documento),
    formato: optionalText(row.formato),
    direcao_nf: optionalText(row.direcao_nf),
    drive_file_id: optionalText(row.drive_file_id),
    drive_web_view_link: optionalText(row.drive_web_view_link),
    status,
    pedido_manual: optionalText(row.pedido_manual),
    pedido_id: null,
    fornecedor_id: null,
    schema_version: schemaVersion,
    raw_payload: rawPayload,
    sender_email: optionalText(row.sender_email),
    email_message_id: optionalText(row.email_message_id),
    email_received_at: emailReceivedAt,
    email_received_at_source: emailReceivedAtSource,
    email_received_at_estimated: emailReceivedAtSource === 'header_date' && row.email_received_at_estimated === true,
    received_at: optionalText(row.received_at),
    detected_at: optionalText(row.detected_at),
    linked_at: optionalText(row.linked_at),
    accepted_at: optionalText(row.accepted_at),
    rejected_at: optionalText(row.rejected_at),
    rejected_reason: optionalText(row.rejected_reason),
    cnpj_emitente: optionalText(row.cnpj_emitente),
    cnpj_destinatario: optionalText(row.cnpj_destinatario),
    atualizado_em: new Date().toISOString(),
  };
}

function deriveCanonicalState(candidate: DocumentCandidateWrite, row: Record<string, unknown>): PreparedCanonicalCandidate {
  const eventId = optionalText(row.latest_ingestion_event_id);
  const stateAt = canonicalTimestamp(row.latest_ingestion_event_at);
  const rejectedReason = candidate.status === 'rejected' ? candidate.rejected_reason : null;
  if (!eventId) return { candidate, canonical: null, skip_reason: 'missing_latest_ingestion_event_id' };
  if (!stateAt) return { candidate, canonical: null, skip_reason: 'missing_latest_ingestion_event_at' };
  if (candidate.status === 'rejected' && !rejectedReason) {
    return { candidate, canonical: null, skip_reason: 'ingestor_rejected_reason_required' };
  }

  return {
    candidate,
    canonical: {
      candidate,
      ingestor_status: candidate.status,
      ingestor_state_at: stateAt,
      ingestor_event_id: eventId,
      ingestor_rejected_reason: rejectedReason,
    },
    skip_reason: null,
  };
}

function normalizeEvent(row: Record<string, unknown>): DocumentEventWrite {
  const eventType = requiredText(row.event_type, 'event_type') as DocumentEventWrite['event_type'];
  if (!EVENT_TYPES.has(eventType)) {
    throw new SyncSupabaseInputError(`Invalid event_type: ${eventType}.`);
  }
  const documentId = typeof row.document_id === 'string' && row.document_id.trim()
    ? requiredText(row.document_id, 'event document_id')
    : requiredText(asRecord(row.document, 'event document').document_id, 'event document.document_id');
  const ingestionEventId = requiredText(row.ingestion_event_id, 'ingestion_event_id');
  const status = eventType === 'document.linked' ? 'assigned' : normalizeDocumentStatus(row.status);

  return {
    document_id: documentId,
    ingestion_event_id: ingestionEventId,
    event_type: eventType,
    status,
    pedido_manual: optionalText(row.pedido_manual),
    pedido_id: null,
    payload: { ...row, status },
  };
}

export function prepareSyncSupabaseInput(options: Pick<SyncSupabaseOptions, 'mappedPath' | 'eventsPath'>): PreparedSyncSupabaseInput {
  if (!options.mappedPath?.trim()) {
    throw new SyncSupabaseInputError('mappedPath is required.');
  }

  const candidatesById = new Map<string, PreparedCanonicalCandidate>();
  for (const row of readJsonl(options.mappedPath, 'mapped')) {
    const candidate = normalizeCandidate(row);
    candidatesById.set(candidate.document_id, deriveCanonicalState(candidate, row));
  }

  const eventsById = new Map<string, DocumentEventWrite>();
  let duplicateEventIds = 0;
  if (options.eventsPath?.trim()) {
    for (const row of readJsonl(options.eventsPath, 'events')) {
      const event = normalizeEvent(row);
      if (eventsById.has(event.ingestion_event_id)) {
        duplicateEventIds++;
        continue;
      }
      eventsById.set(event.ingestion_event_id, event);
    }
  }

  return {
    candidates: [...candidatesById.values()],
    events: [...eventsById.values()],
    duplicateEventIds,
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

export async function runSyncSupabase(
  options: SyncSupabaseOptions,
  client?: SupabaseWriterClient,
): Promise<SyncSupabaseResult> {
  const prepared = prepareSyncSupabaseInput(options);
  const source = options.source?.trim() || 'documents_ingestor';
  const dryRun = options.dryRun || !options.confirmWrite;
  const complete = prepared.candidates.filter((item) => item.canonical);
  const skipped = prepared.candidates
    .filter((item) => item.skip_reason)
    .map((item) => ({ document_id: item.candidate.document_id, reason: item.skip_reason! }));
  const initialResult: SyncSupabaseResult = {
    ok: true,
    dry_run: dryRun,
    source,
    candidates_total: prepared.candidates.length,
    candidates_upserted: 0,
    canonical_base_complete: complete.length,
    canonical_base_skipped: skipped,
    events_inserted: 0,
    events_skipped: prepared.duplicateEventIds,
    scan_run: { status: dryRun ? 'dry_run' : 'running', id: null },
    stale_recovery: { attempted: false, recovered_count: 0 },
    errors: [],
  };

  if (dryRun) {
    // Dry-run never touches the client (no recovery, no scan run, no writes).
    return {
      ...initialResult,
      candidates_upserted: complete.length,
      events_inserted: prepared.events.length,
    };
  }
  if (!client) {
    throw new Error('[sync:supabase] A service-role client is required for a confirmed write.');
  }

  // Opt-in stale lock recovery runs BEFORE startScanRun so a recovered
  // source frees the partial unique index in time for the insert below.
  // A live run (younger than the timeout) is left untouched and still
  // surfaces as scan_already_running. A recovery RPC failure throws here,
  // before any scan run is created — no blind write can follow.
  let staleRecovery = { attempted: false, recovered_count: 0 };
  if (options.recoverStale) {
    const recovered = await client.recoverStaleRuns({ source, staleAfterMinutes: options.staleAfterMinutes });
    staleRecovery = { attempted: true, recovered_count: recovered.recoveredCount };
  }

  // Two ownership paths for the document_scan_runs row:
  //   1. Default (no scanRunId): this function owns the run lifecycle
  //      (startScanRun + finishScanRun). Used by sync:supabase.
  //   2. External (scanRunId provided): the caller (e.g. the document
  //      scan request watcher) owns the run lifecycle. This function
  //      only does the candidate upserts + event inserts and reports
  //      progress. The caller will finalize the run.
  let startedRun: { id: string };
  if (options.scanRunId) {
    startedRun = { id: options.scanRunId };
  } else {
    const startResult = await client.startScanRun({ source, triggered_by: 'service_role_cli' });
    if (startResult.kind === 'already_running') {
      return {
        ...initialResult,
        ok: false,
        stale_recovery: staleRecovery,
        scan_run: { status: 'scan_already_running', id: null },
        errors: ['scan_already_running'],
      };
    }
    startedRun = { id: startResult.id };
  }

  const result: SyncSupabaseResult = {
    ...initialResult,
    stale_recovery: staleRecovery,
    scan_run: { status: 'running', id: startedRun.id },
  };

  try {
    for (const item of complete) {
      await client.upsertCanonicalCandidateState(item.canonical!);
      result.candidates_upserted++;
    }

    const eventResult = await client.insertEventsIgnoreConflict(prepared.events);
    result.events_inserted = eventResult.inserted;
    result.events_skipped += eventResult.skipped;

    // When the run is externally owned, the caller is responsible for
    // calling finishScanRun; do not finalize it here.
    if (!options.scanRunId) {
      await client.finishScanRun({
        id: startedRun.id,
        status: 'completed',
        documentsProcessed: prepared.candidates.length,
        documentsNew: 0,
        errorMessage: null,
      });
      result.scan_run.status = 'completed';
    } else {
      result.scan_run.status = 'external_owner';
    }
    return result;
  } catch (error) {
    const message = errorMessage(error);
    result.ok = false;
    result.errors.push(message);
    // On the external ownership path, leave finishScanRun to the caller.
    if (!options.scanRunId) {
      try {
        await client.finishScanRun({
          id: startedRun.id,
          status: 'failed',
          documentsProcessed: result.candidates_upserted,
          documentsNew: 0,
          errorMessage: message,
        });
        result.scan_run.status = 'failed';
      } catch (finishError) {
        result.errors.push(`Failed to finalize scan run: ${errorMessage(finishError)}`);
      }
    } else {
      result.scan_run.status = 'external_owner_failed';
    }
    return result;
  }
}
