import type { EvidenceOrigin, TechnicalEvidence } from '../types/documentReview.js';
import type { TechnicalEvidenceExportRow } from '../types/technicalEvidenceExport.js';

// ============================================================================
// Technical evidence writer (G28-B3-B4)
//
// A narrow, single-call domain writer over the migration-49 RPC
// public.upsert_document_technical_evidence_ingestor_state.
//
// The Supabase client is injected as a minimal structural port: this module
// never creates a client, reads configuration or environment, touches the
// filesystem/network directly, retries, sleeps, or logs. It performs exactly
// one RPC call per invocation and classifies the relevant remote failures for
// a later sync layer (G28-B3-B5) to consume. Retry and orchestration are not
// this module's concern.
// ============================================================================

/**
 * Parameters of the migration-49 RPC, mapped 1:1 from the local transport row.
 * technicalEvidence and origin are passed as objects (the Supabase client
 * serializes them for transport); they are never stringified here.
 */
export interface TechnicalEvidenceRpcParams {
  p_document_id: string;
  p_evidence_version: number;
  p_technical_evidence: TechnicalEvidence;
  p_origin: EvidenceOrigin;
  p_created_at: string;
}

/** Structural shape of a Supabase/PostgREST error, without importing its type. */
export interface TechnicalEvidenceRpcError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** Structural shape of a Supabase `.rpc()` resolution. */
export interface TechnicalEvidenceRpcResponse {
  data: unknown;
  error: TechnicalEvidenceRpcError | null;
}

/**
 * Minimal injection port: only the single `.rpc()` this writer needs. A real
 * service-role SupabaseClient satisfies it structurally; tests satisfy it with
 * a hermetic mock. No configuration, environment, or network types leak in.
 */
export interface TechnicalEvidenceRpcClient {
  rpc(
    fn: string,
    params: TechnicalEvidenceRpcParams,
  ): PromiseLike<TechnicalEvidenceRpcResponse>;
}

export type TechnicalEvidenceWriteOutcome = 'inserted' | 'unchanged';

export interface TechnicalEvidenceWriteResult {
  documentId: string;
  evidenceVersion: number;
  outcome: TechnicalEvidenceWriteOutcome;
}

export type TechnicalEvidenceWriterErrorKind =
  | 'conflict'
  | 'writer_required'
  | 'migration_required'
  | 'invalid_response'
  | 'remote_error';

/**
 * Stable domain error. The message is a fixed, payload-free string; the
 * original remote error (if any) is preserved as `cause` for programmatic
 * inspection and is never rendered into the message.
 */
export class TechnicalEvidenceWriterError extends Error {
  readonly kind: TechnicalEvidenceWriterErrorKind;

  constructor(kind: TechnicalEvidenceWriterErrorKind, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'TechnicalEvidenceWriterError';
    this.kind = kind;
  }
}

/** The exact RPC exposed by db/49. The writer calls this and only this. */
const RPC_NAME = 'upsert_document_technical_evidence_ingestor_state';

/**
 * Writes one technical-evidence snapshot through the injected RPC client and
 * returns only the outcome. Exactly one RPC call is made per invocation.
 */
export async function writeTechnicalEvidence(
  client: TechnicalEvidenceRpcClient,
  row: TechnicalEvidenceExportRow,
): Promise<TechnicalEvidenceWriteResult> {
  // Exact 1:1 mapping of the local transport contract to the RPC parameters.
  // schemaVersion belongs to the local transport row, not the RPC signature,
  // and is intentionally omitted. Objects are passed by reference: no manual
  // JSON serialization, no clone, no field rename, no recomputed version or
  // regenerated timestamp. evidenceVersion is already coherent inside origin
  // by the B3-B1 contract and is not re-added here.
  const params: TechnicalEvidenceRpcParams = {
    p_document_id: row.documentId,
    p_evidence_version: row.evidenceVersion,
    p_technical_evidence: row.technicalEvidence,
    p_origin: row.origin,
    p_created_at: row.createdAt,
  };

  let response: TechnicalEvidenceRpcResponse;
  try {
    response = await client.rpc(RPC_NAME, params);
  } catch (rejection) {
    // A rejected rpc() (transport or unexpected throw) is converted to a typed
    // error: no retry, no second call, no log, fixed payload-free message, the
    // original preserved as cause. If the rejection safely presents the same
    // structured signals it reuses the same classification; otherwise it is a
    // generic remote_error. A rejection is never assumed to be a missing
    // migration.
    throw classifiedError(toRpcErrorLike(rejection), rejection);
  }

  const { data, error } = response;
  if (error) {
    throw classifiedError(error, error);
  }

  return validateResponseRow(data, row);
}

/** Kinds produced from a remote error or a rejected rpc(); invalid_response is separate. */
type RemoteFailureKind = Exclude<TechnicalEvidenceWriterErrorKind, 'invalid_response'>;

/** Fixed, payload-free messages. No remote text or evidence is ever interpolated. */
const MESSAGE_FOR_KIND: Record<RemoteFailureKind, string> = {
  conflict: 'Technical evidence content conflict for this version.',
  writer_required: 'A service_role writer is required for this RPC.',
  migration_required: 'Technical evidence RPC (migration 49) is not available.',
  remote_error: 'Technical evidence remote write failed.',
};

/**
 * Builds a typed writer error from a structured remote error and the original
 * cause. Shared by the resolved `{ error }` path and the rejected rpc() path so
 * both classify identically. The cause is preserved but never rendered into
 * the message.
 */
function classifiedError(error: TechnicalEvidenceRpcError, cause: unknown): TechnicalEvidenceWriterError {
  const kind = classifyErrorKind(error);
  return new TechnicalEvidenceWriterError(kind, MESSAGE_FOR_KIND[kind], cause);
}

/**
 * Maps a structured remote error to a stable domain kind. The explicit domain
 * markers win; migration_required requires a concrete absence of THIS RPC;
 * everything else is a generic remote_error.
 */
function classifyErrorKind(error: TechnicalEvidenceRpcError): RemoteFailureKind {
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';

  // Explicit domain markers raised by the migration RPC take priority.
  if (/technical_evidence_conflict/i.test(message)) return 'conflict';
  if (/writer_required/i.test(message)) return 'writer_required';

  if (isMissingRpcSignal(code, message)) return 'migration_required';

  return 'remote_error';
}

/**
 * True only for concrete signals that THIS RPC is absent:
 *   - PostgREST schema-cache miss (PGRST202): always about the single RPC this
 *     writer calls, so it stands on its own;
 *   - PostgreSQL undefined_function (42883) that references the expected RPC;
 *   - a message that names the expected RPC AND carries an unambiguous absence
 *     semantic (could not find / not found / does not exist / schema cache /
 *     undefined function).
 *
 * The RPC name alone is never sufficient (e.g. a permission error on the RPC),
 * and a generic "does not exist" about an unrelated object is never sufficient.
 */
function isMissingRpcSignal(code: string, message: string): boolean {
  if (code === 'PGRST202') return true;

  const lower = message.toLowerCase();
  const mentionsRpc = lower.includes(RPC_NAME);
  if (!mentionsRpc) return false;

  if (code === '42883') return true;

  return (
    lower.includes('could not find')
    || lower.includes('not found')
    || lower.includes('does not exist')
    || lower.includes('schema cache')
    || lower.includes('undefined function')
  );
}

/**
 * Extracts only the recognized structured fields (code, message) from an
 * unknown rpc() rejection so it can be classified with the same rules. A
 * rejection that carries no recognized signal becomes remote_error.
 */
function toRpcErrorLike(value: unknown): TechnicalEvidenceRpcError {
  if (isRecord(value)) {
    return {
      code: typeof value.code === 'string' ? value.code : undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
    };
  }
  return {};
}

/**
 * Validates the RPC response strictly: exactly one row whose document_id,
 * evidence_version and outcome match the request. Anything else is an
 * invalid_response — never silently accepted.
 */
function validateResponseRow(
  data: unknown,
  row: TechnicalEvidenceExportRow,
): TechnicalEvidenceWriteResult {
  if (!isUnknownArray(data)) {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response was not a row collection.');
  }
  if (data.length !== 1) {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response did not contain exactly one row.');
  }

  const record = data[0];
  if (!isRecord(record)) {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response row was not an object.');
  }

  if (record.document_id !== row.documentId) {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response document_id did not match the request.');
  }
  if (record.evidence_version !== row.evidenceVersion) {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response evidence_version did not match the request.');
  }

  const outcome = record.outcome;
  if (outcome !== 'inserted' && outcome !== 'unchanged') {
    throw new TechnicalEvidenceWriterError('invalid_response', 'RPC response outcome was not inserted or unchanged.');
  }

  return {
    documentId: row.documentId,
    evidenceVersion: row.evidenceVersion,
    outcome,
  };
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
