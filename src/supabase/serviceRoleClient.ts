import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export type CanonicalDocumentStatus = 'pending' | 'assigned' | 'accepted' | 'rejected';

export interface ActiveDocumentDecision {
  document_id: string;
  status: 'accepted' | 'rejected';
  motivo: string | null;
  decidido_em: string;
}

export interface DocumentCandidateMetadata {
  gmail_message_id: string | null;
  attachment_id: string | null;
  sha256: string | null;
  filename_original: string | null;
  tipo_documento: string | null;
  formato: string | null;
  direcao_nf: string | null;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  pedido_manual: string | null;
  schema_version: number;
  raw_payload: Record<string, unknown>;
  atualizado_em: string;
}

export interface DocumentCandidateWrite extends DocumentCandidateMetadata {
  document_id: string;
  status: CanonicalDocumentStatus;
  pedido_id: null;
  fornecedor_id: null;
  received_at: string | null;
  detected_at: string | null;
  linked_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
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
  getActiveDecisions(documentIds: string[]): Promise<ActiveDocumentDecision[]>;
  getExistingCandidateIds(documentIds: string[]): Promise<Set<string>>;
  upsertCandidates(rows: DocumentCandidateWrite[]): Promise<void>;
  updateCandidateMetadata(documentId: string, metadata: DocumentCandidateMetadata): Promise<void>;
  insertEventsIgnoreConflict(rows: DocumentEventWrite[]): Promise<{ inserted: number; skipped: number }>;
  startScanRun(run: DocumentScanRunWrite): Promise<{ kind: 'started'; id: string } | { kind: 'already_running' }>;
  finishScanRun(params: {
    id: string;
    status: 'completed' | 'failed';
    documentsProcessed: number;
    documentsNew: number;
    errorMessage: string | null;
  }): Promise<void>;
}

export interface ServiceRoleConfig {
  url: string;
  serviceRoleKey: string;
  projectRef: string | null;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string, configuredValue: string): string {
  const value = env[name]?.trim() || configuredValue.trim();
  if (!value) {
    throw new Error(`[sync:supabase] ${name} is required when --confirm-supabase-write is used.`);
  }
  return value;
}

export function loadServiceRoleConfig(env: NodeJS.ProcessEnv = process.env): ServiceRoleConfig {
  const useLoadedDotEnv = env === process.env;
  const configuredWriterEnabled = useLoadedDotEnv && config.supabaseWriterEnabled;
  const writerEnabled = env.SUPABASE_WRITER_ENABLED?.toLowerCase() === 'true'
    || (!env.SUPABASE_WRITER_ENABLED && configuredWriterEnabled);
  if (!writerEnabled) {
    throw new Error('[sync:supabase] SUPABASE_WRITER_ENABLED=true is required for a real write.');
  }

  return {
    url: requiredEnv(env, 'SUPABASE_URL', useLoadedDotEnv ? config.supabaseUrl : ''),
    serviceRoleKey: requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', useLoadedDotEnv ? config.supabaseServiceRoleKey : ''),
    projectRef: env.SUPABASE_PROJECT_REF?.trim() || (useLoadedDotEnv ? config.supabaseProjectRef.trim() : '') || null,
  };
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createServiceRoleWriterClient(config: ServiceRoleConfig): SupabaseWriterClient {
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async getActiveDecisions(documentIds) {
      if (documentIds.length === 0) return [];
      const { data, error } = await client
        .from('document_decisions')
        .select('document_id,status,motivo,decidido_em')
        .eq('ativo', true)
        .in('document_id', documentIds);
      throwOnError(error);
      return (data ?? []) as ActiveDocumentDecision[];
    },

    async getExistingCandidateIds(documentIds) {
      if (documentIds.length === 0) return new Set<string>();
      const { data, error } = await client
        .from('document_candidates')
        .select('document_id')
        .in('document_id', documentIds);
      throwOnError(error);
      return new Set((data ?? []).map((row: { document_id: string }) => row.document_id));
    },

    async upsertCandidates(rows) {
      if (rows.length === 0) return;
      const { error } = await client
        .from('document_candidates')
        .upsert(rows, { onConflict: 'document_id' });
      throwOnError(error);
    },

    async updateCandidateMetadata(documentId, metadata) {
      const { error } = await client
        .from('document_candidates')
        .update(metadata)
        .eq('document_id', documentId);
      throwOnError(error);
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
  };
}
