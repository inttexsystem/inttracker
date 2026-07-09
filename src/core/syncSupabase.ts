import { readFileSync } from 'node:fs';
import {
  type ActiveDocumentDecision,
  type CanonicalDocumentStatus,
  type DocumentCandidateMetadata,
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
}

export interface PreparedSyncSupabaseInput {
  candidates: DocumentCandidateWrite[];
  events: DocumentEventWrite[];
  duplicateEventIds: number;
}

export interface SyncSupabaseResult {
  ok: boolean;
  dry_run: boolean;
  source: string;
  candidates_upserted: number;
  events_inserted: number;
  events_skipped: number;
  scan_run: { status: 'dry_run' | 'running' | 'completed' | 'failed' | 'scan_already_running'; id: string | null };
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
  const rejectedReason = optionalText(row.rejected_reason);
  if (status === 'rejected' && !rejectedReason) {
    throw new SyncSupabaseInputError(`mapped document ${documentId} is rejected but has no rejected_reason.`);
  }

  const schemaVersion = typeof row.schema_version === 'number' && Number.isInteger(row.schema_version)
    ? row.schema_version
    : 1;
  const rawPayload = { ...row, document_id: documentId, status };
  const now = new Date().toISOString();

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
    received_at: optionalText(row.received_at),
    detected_at: optionalText(row.detected_at),
    linked_at: optionalText(row.linked_at),
    accepted_at: optionalText(row.accepted_at),
    rejected_at: optionalText(row.rejected_at),
    rejected_reason: rejectedReason,
    atualizado_em: now,
  };
}

function normalizeEvent(row: Record<string, unknown>): DocumentEventWrite {
  const eventType = requiredText(row.event_type, 'event_type') as DocumentEventWrite['event_type'];
  if (!EVENT_TYPES.has(eventType)) {
    throw new SyncSupabaseInputError(`Invalid event_type: ${eventType}.`);
  }
  const document = asRecord(row.document, 'event document');
  const documentId = requiredText(document.document_id, 'event document.document_id');
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

  const candidatesById = new Map<string, DocumentCandidateWrite>();
  for (const row of readJsonl(options.mappedPath, 'mapped')) {
    const candidate = normalizeCandidate(row);
    candidatesById.set(candidate.document_id, candidate);
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

function candidateMetadata(candidate: DocumentCandidateWrite): DocumentCandidateMetadata {
  const {
    document_id: _documentId,
    status: _status,
    pedido_id: _pedidoId,
    fornecedor_id: _fornecedorId,
    received_at: _receivedAt,
    detected_at: _detectedAt,
    linked_at: _linkedAt,
    accepted_at: _acceptedAt,
    rejected_at: _rejectedAt,
    rejected_reason: _rejectedReason,
    ...metadata
  } = candidate;
  return metadata;
}

function candidateFromActiveDecision(
  candidate: DocumentCandidateWrite,
  decision: ActiveDocumentDecision,
): DocumentCandidateWrite {
  if (decision.status === 'rejected' && !optionalText(decision.motivo)) {
    throw new Error(`Active rejected decision for ${candidate.document_id} has no motivo.`);
  }
  return {
    ...candidate,
    status: decision.status,
    accepted_at: decision.status === 'accepted' ? decision.decidido_em : null,
    rejected_at: decision.status === 'rejected' ? decision.decidido_em : null,
    rejected_reason: decision.status === 'rejected' ? decision.motivo : null,
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
  const initialResult: SyncSupabaseResult = {
    ok: true,
    dry_run: dryRun,
    source,
    candidates_upserted: 0,
    events_inserted: 0,
    events_skipped: prepared.duplicateEventIds,
    scan_run: { status: dryRun ? 'dry_run' : 'running', id: null },
    errors: [],
  };

  if (dryRun) {
    return {
      ...initialResult,
      candidates_upserted: prepared.candidates.length,
      events_inserted: prepared.events.length,
    };
  }
  if (!client) {
    throw new Error('[sync:supabase] A service-role client is required for a confirmed write.');
  }

  const startedRun = await client.startScanRun({ source, triggered_by: 'service_role_cli' });
  if (startedRun.kind === 'already_running') {
    return {
      ...initialResult,
      ok: false,
      scan_run: { status: 'scan_already_running', id: null },
      errors: ['scan_already_running'],
    };
  }

  const result: SyncSupabaseResult = {
    ...initialResult,
    scan_run: { status: 'running', id: startedRun.id },
  };

  try {
    const decisions = await client.getActiveDecisions(prepared.candidates.map((candidate) => candidate.document_id));
    const decisionsByDocumentId = new Map(decisions.map((decision) => [decision.document_id, decision]));
    const protectedIds = [...decisionsByDocumentId.keys()];
    const existingProtectedIds = await client.getExistingCandidateIds(protectedIds);

    const candidatesToUpsert: DocumentCandidateWrite[] = [];
    const protectedExistingCandidates: DocumentCandidateWrite[] = [];
    for (const candidate of prepared.candidates) {
      const decision = decisionsByDocumentId.get(candidate.document_id);
      if (!decision) {
        candidatesToUpsert.push(candidate);
      } else if (existingProtectedIds.has(candidate.document_id)) {
        protectedExistingCandidates.push(candidate);
      } else {
        candidatesToUpsert.push(candidateFromActiveDecision(candidate, decision));
      }
    }

    await client.upsertCandidates(candidatesToUpsert);
    result.candidates_upserted += candidatesToUpsert.length;
    for (const candidate of protectedExistingCandidates) {
      await client.updateCandidateMetadata(candidate.document_id, candidateMetadata(candidate));
      result.candidates_upserted++;
    }

    const eventResult = await client.insertEventsIgnoreConflict(prepared.events);
    result.events_inserted = eventResult.inserted;
    result.events_skipped += eventResult.skipped;

    await client.finishScanRun({
      id: startedRun.id,
      status: 'completed',
      documentsProcessed: prepared.candidates.length,
      documentsNew: 0,
      errorMessage: null,
    });
    result.scan_run.status = 'completed';
    return result;
  } catch (error) {
    const message = errorMessage(error);
    result.ok = false;
    result.errors.push(message);
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
    return result;
  }
}
