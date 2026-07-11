import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export type CanonicalDocumentStatus = 'pending' | 'assigned' | 'accepted' | 'rejected';

export interface DocumentCandidateWrite {
  document_id: string;
  gmail_message_id: string | null;
  attachment_id: string | null;
  sha256: string | null;
  filename_original: string | null;
  tipo_documento: string | null;
  formato: string | null;
  direcao_nf: string | null;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  status: CanonicalDocumentStatus;
  pedido_manual: string | null;
  pedido_id: null;
  fornecedor_id: null;
  schema_version: number;
  raw_payload: Record<string, unknown>;
  sender_email: string | null;
  email_message_id: string | null;
  email_received_at: string | null;
  email_received_at_source: 'gmail_internal_date' | 'header_date' | null;
  email_received_at_estimated: boolean;
  received_at: string | null;
  detected_at: string | null;
  linked_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  cnpj_emitente: string | null;
  cnpj_destinatario: string | null;
  atualizado_em: string;
}

export interface CanonicalIngestorStateWrite {
  candidate: DocumentCandidateWrite;
  ingestor_status: CanonicalDocumentStatus;
  ingestor_state_at: string;
  ingestor_event_id: string;
  ingestor_rejected_reason: string | null;
}

export interface DocumentEventWrite {
  document_id: string;
  ingestion_event_id: string;
  event_type: 'document.detected' | 'document.linked' | 'document.accepted' | 'document.rejected';
  status: CanonicalDocumentStatus;
  pedido_manual: string | null;
  pedido_id: null;
  payload: Record<string, unknown>;
}

export interface DocumentScanRunWrite {
  source: string;
  triggered_by: string;
}

export interface SupabaseWriterClient {
  recoverStaleRuns(params: { source: string; staleAfterMinutes?: number }): Promise<{ recoveredCount: number }>;
  upsertCanonicalCandidateState(params: CanonicalIngestorStateWrite): Promise<void>;
  insertEventsIgnoreConflict(rows: DocumentEventWrite[]): Promise<{ inserted: number; skipped: number }>;
  startScanRun(run: DocumentScanRunWrite): Promise<{ kind: 'started'; id: string } | { kind: 'already_running' }>;
  finishScanRun(params: {
    id: string;
    status: 'completed' | 'failed';
    documentsProcessed: number;
    documentsNew: number;
    errorMessage: string | null;
  }): Promise<void>;
  claimNextDocumentScanRequest(params: { source: string | null }): Promise<{ empty: boolean; request: ClaimedDocumentScanRequest | null }>;
  markDocumentScanRequestRunning(params: { requestId: string; scanRunId: string }): Promise<void>;
  finishDocumentScanRequest(params: {
    requestId: string;
    status: 'completed' | 'failed';
    errorMessage: string | null;
  }): Promise<void>;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string, configuredValue: string): string {
  const value = env[name]?.trim() || configuredValue.trim();
  if (!value) {
    throw new Error(`[sync:supabase] ${name} is required when --confirm-supabase-write is used.`);
  }
  return value;
}

export interface ServiceRoleConfig {
  url: string;
  serviceRoleKey: string;
  projectRef: string;
}

export function extractProjectRefFromUrl(urlString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('supabase_url_invalid');
  }
  const hostname = parsed.hostname;
  if (!hostname) throw new Error('supabase_url_invalid');
  const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  if (match) return match[1];
  throw new Error('supabase_url_invalid');
}

export function loadServiceRoleConfig(env: NodeJS.ProcessEnv = process.env): ServiceRoleConfig {
  const useLoadedDotEnv = env === process.env;
  const configuredWriterEnabled = useLoadedDotEnv && config.supabaseWriterEnabled;
  const writerEnabled = env.SUPABASE_WRITER_ENABLED?.toLowerCase() === 'true'
    || (!env.SUPABASE_WRITER_ENABLED && configuredWriterEnabled);
  if (!writerEnabled) {
    throw new Error('[sync:supabase] SUPABASE_WRITER_ENABLED=true is required for a real write.');
  }

  const url = requiredEnv(env, 'SUPABASE_URL', useLoadedDotEnv ? config.supabaseUrl : '');
  const serviceRoleKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', useLoadedDotEnv ? config.supabaseServiceRoleKey : '');

  const urlProjectRef = extractProjectRefFromUrl(url);

  const projectRef = env.SUPABASE_PROJECT_REF?.trim() || (useLoadedDotEnv ? config.supabaseProjectRef.trim() : '') || '';
  if (!projectRef) {
    throw new Error('supabase_project_ref_required');
  }

  if (urlProjectRef !== projectRef) {
    throw new Error('supabase_project_ref_mismatch');
  }

  return { url, serviceRoleKey, projectRef };
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function canonicalWriterError(error: { message?: string; code?: string } | null): Error {
  const message = error?.message || 'Supabase canonical writer RPC failed.';
  if (error?.code === 'PGRST202' || error?.code === '42883'
    || /upsert_document_candidate_ingestor_state|schema cache|does not exist/i.test(message)) {
    return new Error('migration_39_required');
  }
  return new Error(`canonical_writer_rpc_failed: ${message}`);
}

function staleRecoveryError(error: { message?: string; code?: string } | null): Error {
  const message = error?.message || 'Supabase stale recovery RPC failed.';
  if (error?.code === 'PGRST202' || error?.code === '42883'
    || /recuperar_document_scan_runs_travados|schema cache|does not exist/i.test(message)) {
    return new Error('migration_40_required');
  }
  return new Error(`stale_recovery_rpc_failed: ${message}`);
}

function scanRequestError(error: { message?: string; code?: string } | null, op: 'claim' | 'mark_running' | 'finish'): Error {
  const opLabel = op === 'claim'
    ? 'claim_next_document_scan_request'
    : op === 'mark_running'
      ? 'mark_document_scan_request_running'
      : 'finish_document_scan_request';
  const message = error?.message || `Supabase scan request RPC (${op}) failed.`;
  if (error?.code === 'PGRST202' || error?.code === '42883'
    || new RegExp(`${opLabel}|schema cache|does not exist`, 'i').test(message)) {
    return new Error('migration_41_required');
  }
  return new Error(`scan_request_rpc_failed (${op}): ${message}`);
}

export interface ClaimedDocumentScanRequest {
  requestId: string;
  source: string;
}

export function createServiceRoleWriterClient(config: ServiceRoleConfig): SupabaseWriterClient {
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async recoverStaleRuns({ source, staleAfterMinutes = 30 }) {
      // Floor of 5 minutes so a live run is never recovered; the SQL RPC
      // clamps identically via GREATEST(..., INTERVAL '5 minutes').
      const requested = Number.isFinite(staleAfterMinutes) ? Math.floor(staleAfterMinutes) : 30;
      const minutes = Math.max(requested, 5);
      const { data, error } = await client.rpc('recuperar_document_scan_runs_travados', {
        p_source: source,
        p_stale_after: `${minutes} minutes`,
      });
      if (error) throw staleRecoveryError(error);
      if (!data || typeof data !== 'object' || data.ok !== true) {
        const rpcError = data && typeof data === 'object' && typeof data.error === 'string'
          ? data.error : 'Supabase stale recovery RPC returned an invalid result.';
        throw new Error(`stale_recovery_rpc_failed: ${rpcError}`);
      }
      return { recoveredCount: typeof data.recovered_count === 'number' ? data.recovered_count : 0 };
    },

    async upsertCanonicalCandidateState(params) {
      const { data, error } = await client.rpc('upsert_document_candidate_ingestor_state', {
        p_candidate: params.candidate,
        p_ingestor_status: params.ingestor_status,
        p_ingestor_state_at: params.ingestor_state_at,
        p_ingestor_event_id: params.ingestor_event_id,
        p_ingestor_rejected_reason: params.ingestor_rejected_reason,
      });
      if (error) throw canonicalWriterError(error);
      if (!data || typeof data !== 'object' || data.ok !== true) {
        const rpcError = data && typeof data === 'object' && typeof data.error === 'string'
          ? data.error : 'Supabase canonical writer RPC returned an invalid result.';
        throw new Error(`canonical_writer_rpc_failed: ${rpcError}`);
      }
    },

    async insertEventsIgnoreConflict(rows) {
      if (rows.length === 0) return { inserted: 0, skipped: 0 };
      const { data, error } = await client
        .from('document_events')
        .upsert(rows, { onConflict: 'ingestion_event_id', ignoreDuplicates: true })
        .select('ingestion_event_id');
      throwOnError(error);
      const inserted = data?.length ?? rows.length;
      return { inserted, skipped: Math.max(rows.length - inserted, 0) };
    },

    async startScanRun(run) {
      const { data, error } = await client
        .from('document_scan_runs')
        .insert(run)
        .select('id')
        .single();
      if (error?.code === '23505') return { kind: 'already_running' };
      throwOnError(error);
      return { kind: 'started', id: (data as { id: string }).id };
    },

    async finishScanRun(params) {
      const { error } = await client
        .from('document_scan_runs')
        .update({
          status: params.status,
          documents_processed: params.documentsProcessed,
          documents_new: params.documentsNew,
          error_message: params.status === 'failed' ? params.errorMessage : null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('status', 'running');
      throwOnError(error);
    },

    async claimNextDocumentScanRequest({ source }) {
      const { data, error } = await client.rpc('claim_next_document_scan_request', {
        p_source: source,
      });
      if (error) throw scanRequestError(error, 'claim');
      const result = (data ?? {}) as {
        ok?: boolean;
        empty?: boolean;
        request_id?: string | null;
        source?: string | null;
        error?: string;
      };
      if (!result || result.ok !== true) {
        const err = typeof result.error === 'string' ? result.error : 'invalid_claim_response';
        throw new Error(`scan_request_rpc_failed (claim): ${err}`);
      }
      if (result.empty === true) {
        return { empty: true, request: null };
      }
      if (!result.request_id || !result.source) {
        throw new Error('scan_request_rpc_failed (claim): empty result without empty flag');
      }
      return {
        empty: false,
        request: { requestId: result.request_id, source: result.source },
      };
    },

    async markDocumentScanRequestRunning({ requestId, scanRunId }) {
      const { data, error } = await client.rpc('mark_document_scan_request_running', {
        p_request_id: requestId,
        p_scan_run_id: scanRunId,
      });
      if (error) throw scanRequestError(error, 'mark_running');
      const result = (data ?? {}) as { ok?: boolean; error?: string };
      if (!result || result.ok !== true) {
        const err = typeof result.error === 'string' ? result.error : 'invalid_mark_running_response';
        throw new Error(`scan_request_rpc_failed (mark_running): ${err}`);
      }
    },

    async finishDocumentScanRequest({ requestId, status, errorMessage }) {
      const { data, error } = await client.rpc('finish_document_scan_request', {
        p_request_id: requestId,
        p_status: status,
        p_error_message: status === 'failed' ? errorMessage : null,
      });
      if (error) throw scanRequestError(error, 'finish');
      const result = (data ?? {}) as { ok?: boolean; error?: string };
      if (!result || result.ok !== true) {
        const err = typeof result.error === 'string' ? result.error : 'invalid_finish_response';
        throw new Error(`scan_request_rpc_failed (finish): ${err}`);
      }
    },
  };
}
