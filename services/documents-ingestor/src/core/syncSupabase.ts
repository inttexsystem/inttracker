import { readFileSync } from 'node:fs';
import {
  type CanonicalDocumentStatus,
  type CanonicalIngestorStateWrite,
  type DocumentCandidateWrite,
  type DocumentEventWrite,
  type SupabaseWriterClient,
} from '../supabase/serviceRoleClient.js';
import {
  TechnicalEvidenceWriterError,
  type TechnicalEvidenceWriterErrorKind,
  writeTechnicalEvidence,
} from '../supabase/technicalEvidenceWriter.js';
import type { TechnicalEvidenceExportRow } from '../types/technicalEvidenceExport.js';

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
  /**
   * INTERNAL (G28-B3-B5-B / C): optional path to a technical-evidence
   * JSONL file. When present, the file is read, validated, deduplicated
   * and matched against the prepared candidates. Dry-run projects the
   * five snake_case evidence counters without any client, config or
   * remote effect. Confirmed writes perform the evidence stage between
   * candidate upserts and event inserts; a typed writer failure
   * propagates and short-circuits the rest of the run.
   */
  technicalEvidencePath?: string;
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
  /**
   * INTERNAL (G28-B3-B5-B): only present when a `technicalEvidencePath`
   * was provided (even with an empty JSONL stream). Absent from the
   * result object otherwise, to preserve the pre-existing result shape
   * when the path is not used.
   */
  technical_evidence_attempted?: number;
  /**
   * INTERNAL (G28-B3-B5-C): only present when a `technicalEvidencePath`
   * was provided. All five snake_case evidence counters share the same
   * presence rule as `technical_evidence_attempted`: when the path is
   * absent, no evidence counter is added to the result.
   *
   * - `inserted` / `unchanged` / `failed` : confirmed writes only,
   *   counted by writer outcome. In dry-run they are projected as zero.
   * - `skipped_without_evidence` : the eligible candidate count
   *   (candidates with a complete canonical base) minus the count of
   *   valid evidence documents — i.e. the candidates that did not
   *   receive a technical-evidence snapshot in this run.
   */
  technical_evidence_inserted?: number;
  technical_evidence_unchanged?: number;
  technical_evidence_failed?: number;
  technical_evidence_skipped_without_evidence?: number;
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

class TechnicalEvidenceInputError extends Error {}

/**
 * Domain error raised when a confirmed technical-evidence write throws.
 * The message is a fixed, payload-free string that contains only
 * document id, evidence version and stage; never the technical-evidence
 * payload, the origin payload, the remote error text, the service-role
 * key or the Supabase URL. The original `TechnicalEvidenceWriterError`
 * is preserved as `cause` for programmatic inspection and the writer's
 * kind (conflict / writer_required / migration_required /
 * invalid_response / remote_error) is exposed in `writerKind` so
 * callers can branch on it without ever reading the payload.
 */
class TechnicalEvidenceSyncFailure extends Error {
  readonly documentId: string;
  readonly evidenceVersion: number;
  readonly stage: 'writer';
  readonly writerKind: TechnicalEvidenceWriterErrorKind;

  constructor(
    documentId: string,
    evidenceVersion: number,
    writerError: TechnicalEvidenceWriterError,
  ) {
    super(
      `[sync:supabase] Technical evidence write failed: document_id=${documentId} evidence_version=${evidenceVersion} stage=writer`,
      { cause: writerError },
    );
    this.name = 'TechnicalEvidenceSyncFailure';
    this.documentId = documentId;
    this.evidenceVersion = evidenceVersion;
    this.stage = 'writer';
    this.writerKind = writerError.kind;
  }
}

// ============================================================================
// Technical-evidence internal loader (G28-B3-B5-B)
//
// Reads a schema-version-1 technical-evidence JSONL stream line by line as
// `unknown` (no TypeScript cast trust), validates each row, rejects
// duplicates by (documentId, evidenceVersion) AND by documentId, and
// requires every evidence documentId to exist among the prepared
// candidates. The returned collection uses a local record-shaped type
// (`InternalValidatedEvidenceEntry`) so that acceptance depends ONLY on
// the actual runtime checks (object-shape, not the full domain
// TechnicalEvidence/EvidenceOrigin contracts). Errors cite line +
// category (+ documentId only after it is validated) and never include
// the payload. createdAt goes through `parseStrictIsoTimestamp` so that
// both malformed strings and impossible calendar values are rejected
// deterministically.
// ============================================================================

const TECHNICAL_EVIDENCE_SCHEMA_VERSION = 1;

/**
 * Local internal record for one validated technical-evidence row. Only
 * the fields actually checked at runtime are declared; nested
 * `technicalEvidence` and `origin` are kept as `Record<string, unknown>`
 * because the loader only enforces object-shape, not the full domain
 * contracts. This type is structurally JSON-compatible with the
 * downstream `TechnicalEvidenceExportRow` but does NOT lie about
 * validation that this loader did not perform.
 */
interface InternalValidatedEvidenceEntry {
  schemaVersion: 1;
  documentId: string;
  evidenceVersion: number;
  technicalEvidence: Record<string, unknown>;
  origin: Record<string, unknown>;
  createdAt: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strict ISO-8601 timestamp validation with calendar-impossibility
 * rejection. Accepts `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:MM)`. The
 * `Date` constructor silently rolls impossible dates (e.g. Feb 30, Apr
 * 31, Feb 29 in a non-leap year) into the next valid calendar day, so
 * a roundtrip check is required: the YYYY-MM-DD written by the caller
 * must match the YYYY-MM-DD Date produces for the same instant in the
 * input's own timezone. Returns the deterministic UTC canonical
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`) so the loader can store a normalized
 * value regardless of the input's offset.
 */
function parseStrictIsoTimestamp(value: string): string | null {
  const isoRe = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
  if (!isoRe.test(value)) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const inputYmd = value.slice(0, 10);
  let parsedYmd: string;
  if (value.endsWith('Z')) {
    parsedYmd = date.toISOString().slice(0, 10);
  } else {
    const offsetMatch = /([+-])(\d{2}):?(\d{2})$/.exec(value);
    if (!offsetMatch) return null;
    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
    const localMs = date.getTime() + offsetMinutes * 60000;
    parsedYmd = new Date(localMs).toISOString().slice(0, 10);
  }
  if (inputYmd !== parsedYmd) return null;

  return date.toISOString();
}

function loadTechnicalEvidenceRows(
  path: string,
  candidates: PreparedCanonicalCandidate[],
): InternalValidatedEvidenceEntry[] {
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (error: any) {
    throw new TechnicalEvidenceInputError(
      `Technical evidence JSONL: cannot read file: ${error?.message ?? String(error)}`,
    );
  }

  const candidateDocumentIds = new Set<string>();
  for (const item of candidates) {
    if (item.canonical) candidateDocumentIds.add(item.candidate.document_id);
  }

  const rows: InternalValidatedEvidenceEntry[] = [];
  const seenKeys = new Set<string>();
  const seenDocumentIds = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    const lineNumber = index + 1;
    const ctx = `Technical evidence JSONL line ${lineNumber}`;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new TechnicalEvidenceInputError(`${ctx}: invalid_json`);
    }
    if (!isPlainObject(parsed)) {
      throw new TechnicalEvidenceInputError(`${ctx}: invalid_object`);
    }
    const row = parsed;

    if (row.schemaVersion !== TECHNICAL_EVIDENCE_SCHEMA_VERSION) {
      throw new TechnicalEvidenceInputError(`${ctx}: invalid_schema_version`);
    }

    if (typeof row.documentId !== 'string' || !row.documentId.trim()) {
      throw new TechnicalEvidenceInputError(`${ctx}: invalid_document_id`);
    }
    const documentId = row.documentId.trim();

    // evidenceVersion MUST be a present, positive integer; null,
    // undefined, non-numbers, fractional, zero and negative are all
    // rejected. Number.isInteger guards against values like 1.5 and
    // strings like "1".
    if (
      !('evidenceVersion' in row)
      || typeof row.evidenceVersion !== 'number'
      || !Number.isInteger(row.evidenceVersion)
      || row.evidenceVersion < 1
    ) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: invalid_evidence_version (documentId=${documentId})`,
      );
    }
    const evidenceVersion = row.evidenceVersion;

    if (!isPlainObject(row.technicalEvidence)) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: invalid_technical_evidence (documentId=${documentId})`,
      );
    }
    const technicalEvidence = row.technicalEvidence;

    if (!isPlainObject(row.origin)) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: invalid_origin (documentId=${documentId})`,
      );
    }
    const origin = row.origin;
    if (origin.evidenceVersion !== evidenceVersion) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: origin_evidence_version_mismatch (documentId=${documentId})`,
      );
    }

    if (typeof row.createdAt !== 'string' || !row.createdAt.trim()) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: invalid_created_at (documentId=${documentId})`,
      );
    }
    const createdAtCanonical = parseStrictIsoTimestamp(row.createdAt);
    if (createdAtCanonical === null) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: invalid_created_at (documentId=${documentId})`,
      );
    }

    const key = `${documentId}|${evidenceVersion}`;
    if (seenKeys.has(key)) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: duplicate_key (documentId=${documentId}, evidenceVersion=${evidenceVersion})`,
      );
    }
    if (seenDocumentIds.has(documentId)) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: duplicate_document_id (documentId=${documentId})`,
      );
    }

    if (!candidateDocumentIds.has(documentId)) {
      throw new TechnicalEvidenceInputError(
        `${ctx}: evidence_document_not_in_candidates (documentId=${documentId})`,
      );
    }

    seenKeys.add(key);
    seenDocumentIds.add(documentId);
    rows.push({
      schemaVersion: 1,
      documentId,
      evidenceVersion,
      technicalEvidence,
      origin,
      createdAt: createdAtCanonical,
    });
  }

  return rows;
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

  // Internal technical-evidence JSONL (G28-B3-B5-B / C): when a path
  // is provided, read, validate, deduplicate and reconcile against
  // the prepared candidates BEFORE any other branch. Validation throws
  // on bad input (payload-free error). This runs strictly before
  // configuration is read, before a service-role client is built,
  // before recoverStaleRuns, before startScanRun, before any candidate
  // RPC, before any event upsert and before any technical-evidence
  // RPC. A confirmed write without a technical-evidence path never
  // touches this code.
  const evidencePath = options.technicalEvidencePath?.trim() || '';
  const evidencePathProvided = evidencePath.length > 0;
  const validEvidence: InternalValidatedEvidenceEntry[] = evidencePathProvided
    ? loadTechnicalEvidenceRows(evidencePath, prepared.candidates)
    : [];

  const complete = prepared.candidates.filter((item) => item.canonical);
  const skipped = prepared.candidates
    .filter((item) => item.skip_reason)
    .map((item) => ({ document_id: item.candidate.document_id, reason: item.skip_reason! }));

  // The five snake_case evidence counters are conditionally included
  // ONLY when a path was provided (even with an empty JSONL). Without
  // a path, the result object is byte-for-byte the pre-existing shape
  // so the CLI / existing consumers see no new keys. The
  // `skipped_without_evidence` counter is the eligible-candidate count
  // (candidates with a complete canonical base) minus the count of
  // valid evidence documents — i.e. complete candidates that did not
  // receive a technical-evidence snapshot in this run.
  const evidenceSkippedWithoutEvidence = complete.length - validEvidence.length;
  const evidenceCounters = evidencePathProvided
    ? {
        technical_evidence_attempted: 0,
        technical_evidence_inserted: 0,
        technical_evidence_unchanged: 0,
        technical_evidence_failed: 0,
        technical_evidence_skipped_without_evidence: evidenceSkippedWithoutEvidence,
      }
    : {};
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
    ...evidenceCounters,
    errors: [],
  };

  if (dryRun) {
    // Dry-run never touches the client (no recovery, no scan run, no
    // candidate RPC, no event RPC, no technical-evidence RPC). All
    // five evidence counters are projected from the validated input
    // alone, with inserted/unchanged/failed equal to zero because no
    // remote call was made.
    return {
      ...initialResult,
      ...(evidencePathProvided ? { technical_evidence_attempted: validEvidence.length } : {}),
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
  //      only does the candidate upserts + technical-evidence writes +
  //      event inserts and reports progress. The caller will finalize
  //      the run.
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

    // G28-B3-B5-C: evidence stage runs between candidate upserts and
    // event inserts. With no evidence path the block is skipped and
    // no evidence RPC / counter is touched, preserving the pre-existing
    // behavior. With an evidence path, every validated row is sent to
    // the writer; `attempted` is incremented immediately before the
    // RPC; `inserted` / `unchanged` are incremented by writer outcome;
    // a typed writer failure is rethrown as a payload-free sync
    // failure that carries document id, evidence version, stage and
    // the writer's kind, short-circuits the rest of the run (no
    // event insert, no finish completed, attempt finish failed) and
    // never retries.
    if (evidencePathProvided) {
      for (const entry of validEvidence) {
        result.technical_evidence_attempted! += 1;
        try {
          const writeResult = await writeTechnicalEvidence(
            client.writeTechnicalEvidence,
            entry as unknown as TechnicalEvidenceExportRow,
          );
          if (writeResult.outcome === 'inserted') {
            result.technical_evidence_inserted! += 1;
          } else {
            result.technical_evidence_unchanged! += 1;
          }
        } catch (writerError) {
          result.technical_evidence_failed! += 1;
          if (writerError instanceof TechnicalEvidenceWriterError) {
            throw new TechnicalEvidenceSyncFailure(
              entry.documentId,
              entry.evidenceVersion,
              writerError,
            );
          }
          throw writerError;
        }
      }
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
