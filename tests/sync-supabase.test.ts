import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runSyncSupabase,
  type SyncSupabaseOptions,
} from '../src/core/syncSupabase.js';
import {
  loadServiceRoleConfig,
  type ActiveDocumentDecision,
  type DocumentCandidateMetadata,
  type DocumentCandidateWrite,
  type DocumentEventWrite,
  type SupabaseWriterClient,
} from '../src/supabase/serviceRoleClient.js';

const tempDirs: string[] = [];

function writeJsonl(name: string, rows: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'ravatex-sync-supabase-'));
  tempDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf-8');
  return path;
}

function mappedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    document_id: 'doc-001',
    filename_original: 'nota.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    status: 'pending',
    pedido_manual: 'PED-25-2026',
    gmail_message_id: 'gmail-001',
    drive_file_id: 'drive-001',
    drive_web_view_link: 'https://drive.example/doc-001',
    received_at: '2026-07-09T10:00:00.000Z',
    detected_at: '2026-07-09T10:00:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 2,
    event_type: 'document.detected',
    event_id: 'doc-001',
    ingestion_event_id: 'evt-001',
    created_at: '2026-07-09T10:00:00.000Z',
    pedido_manual: 'PED-25-2026',
    source: 'gmail',
    gmail_message_id: 'gmail-001',
    thread_id: 'thread-001',
    document: {
      document_id: 'doc-001',
      filename_original: 'nota.xml',
      tipo_documento: 'nf',
      sha256: 'a'.repeat(64),
    },
    status: 'pending_app_acceptance',
    ...overrides,
  };
}

function options(mappedRows: unknown[], eventRows?: unknown[]): SyncSupabaseOptions {
  return {
    mappedPath: writeJsonl('mapped.jsonl', mappedRows),
    eventsPath: eventRows ? writeJsonl('events.jsonl', eventRows) : undefined,
    confirmWrite: true,
  };
}

class WriterClientMock implements SupabaseWriterClient {
  activeDecisions: ActiveDocumentDecision[] = [];
  existingCandidateIds = new Set<string>();
  candidateUpserts: DocumentCandidateWrite[][] = [];
  metadataUpdates: Array<{ documentId: string; metadata: DocumentCandidateMetadata }> = [];
  eventInserts: DocumentEventWrite[][] = [];
  startedRuns: Array<{ source: string; triggered_by: string }> = [];
  finishedRuns: Array<{ id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }> = [];
  eventResult = { inserted: 1, skipped: 0 };
  duplicateRunning = false;
  failCandidates = false;

  async getActiveDecisions(): Promise<ActiveDocumentDecision[]> {
    return this.activeDecisions;
  }

  async getExistingCandidateIds(): Promise<Set<string>> {
    return this.existingCandidateIds;
  }

  async upsertCandidates(rows: DocumentCandidateWrite[]): Promise<void> {
    if (this.failCandidates) throw new Error('candidate write failed');
    this.candidateUpserts.push(rows);
  }

  async updateCandidateMetadata(documentId: string, metadata: DocumentCandidateMetadata): Promise<void> {
    this.metadataUpdates.push({ documentId, metadata });
  }

  async insertEventsIgnoreConflict(rows: DocumentEventWrite[]): Promise<{ inserted: number; skipped: number }> {
    this.eventInserts.push(rows);
    return this.eventResult;
  }

  async startScanRun(run: { source: string; triggered_by: string }): Promise<{ kind: 'started'; id: string } | { kind: 'already_running' }> {
    this.startedRuns.push(run);
    return this.duplicateRunning ? { kind: 'already_running' } : { kind: 'started', id: 'run-001' };
  }

  async finishScanRun(params: { id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }): Promise<void> {
    this.finishedRuns.push(params);
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('sync:supabase writer', () => {
  it('normalizes pending_app_acceptance to pending in dry-run without a client', async () => {
    const result = await runSyncSupabase({
      ...options([mappedRow({ status: 'pending_app_acceptance' })]),
      confirmWrite: false,
    });

    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.candidates_upserted).toBe(1);
    expect(result.scan_run.status).toBe('dry_run');
  });

  it('rejects invalid mapped status before any write', async () => {
    const client = new WriterClientMock();
    await expect(runSyncSupabase(options([mappedRow({ status: 'unknown' })]), client)).rejects.toThrow(/Invalid document status/);
    expect(client.startedRuns).toHaveLength(0);
  });

  it('rejects an event without ingestion_event_id before any write', async () => {
    const client = new WriterClientMock();
    const event = eventRow();
    delete event.ingestion_event_id;
    await expect(runSyncSupabase(options([mappedRow()], [event]), client)).rejects.toThrow(/ingestion_event_id is required/);
    expect(client.startedRuns).toHaveLength(0);
  });

  it('upserts candidates by document_id with nullable FKs', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase(options([mappedRow({ sha256: 'b'.repeat(64), attachment_id: 'att-001' })]), client);
    const candidate = client.candidateUpserts[0][0];

    expect(result.ok).toBe(true);
    expect(candidate.document_id).toBe('doc-001');
    expect(candidate.pedido_id).toBeNull();
    expect(candidate.fornecedor_id).toBeNull();
    expect(candidate.raw_payload.status).toBe('pending');
    expect(candidate.sha256).toBe('b'.repeat(64));
    expect(candidate.attachment_id).toBe('att-001');
  });

  it('inserts events through the conflict-ignore path', async () => {
    const client = new WriterClientMock();
    client.eventResult = { inserted: 0, skipped: 1 };
    const result = await runSyncSupabase(options([mappedRow()], [eventRow()]), client);

    expect(client.eventInserts[0][0].ingestion_event_id).toBe('evt-001');
    expect(result.events_inserted).toBe(0);
    expect(result.events_skipped).toBe(1);
  });

  it('forces document.linked to assigned', async () => {
    const client = new WriterClientMock();
    await runSyncSupabase(options([mappedRow()], [eventRow({ event_type: 'document.linked', status: 'pending_app_acceptance' })]), client);

    expect(client.eventInserts[0][0].status).toBe('assigned');
  });

  it('preserves status and decision dates for an existing active human decision', async () => {
    const client = new WriterClientMock();
    client.activeDecisions = [{
      document_id: 'doc-001',
      status: 'accepted',
      motivo: null,
      decidido_em: '2026-07-09T11:00:00.000Z',
    }];
    client.existingCandidateIds.add('doc-001');

    await runSyncSupabase(options([mappedRow({ status: 'rejected', rejected_at: '2026-07-09T12:00:00.000Z', rejected_reason: 'source reason' })]), client);

    expect(client.candidateUpserts[0]).toEqual([]);
    expect(client.metadataUpdates).toHaveLength(1);
    expect(client.metadataUpdates[0].metadata).not.toHaveProperty('status');
    expect(client.metadataUpdates[0].metadata).not.toHaveProperty('accepted_at');
    expect(client.metadataUpdates[0].metadata).not.toHaveProperty('rejected_reason');
  });

  it('updates status normally when there is no active decision', async () => {
    const client = new WriterClientMock();
    await runSyncSupabase(options([mappedRow({ status: 'accepted', accepted_at: '2026-07-09T12:00:00.000Z' })]), client);

    expect(client.candidateUpserts[0][0].status).toBe('accepted');
    expect(client.metadataUpdates).toHaveLength(0);
  });

  it('creates a documents_ingestor scan run and completes it on success', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase(options([mappedRow()]), client);

    expect(client.startedRuns).toEqual([{ source: 'documents_ingestor', triggered_by: 'service_role_cli' }]);
    expect(client.finishedRuns[0].status).toBe('completed');
    expect(result.scan_run.status).toBe('completed');
  });

  it('returns scan_already_running without document writes', async () => {
    const client = new WriterClientMock();
    client.duplicateRunning = true;
    const result = await runSyncSupabase(options([mappedRow()]), client);

    expect(result.ok).toBe(false);
    expect(result.scan_run.status).toBe('scan_already_running');
    expect(client.candidateUpserts).toHaveLength(0);
    expect(client.finishedRuns).toHaveLength(0);
  });

  it('finalizes the scan run as failed after a normal writer error', async () => {
    const client = new WriterClientMock();
    client.failCandidates = true;
    const result = await runSyncSupabase(options([mappedRow()]), client);

    expect(result.ok).toBe(false);
    expect(result.scan_run.status).toBe('failed');
    expect(client.finishedRuns[0].status).toBe('failed');
    expect(result.errors[0]).toContain('candidate write failed');
  });

  it('does not write without --confirm-supabase-write', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase({ ...options([mappedRow()]), confirmWrite: false }, client);

    expect(result.dry_run).toBe(true);
    expect(client.startedRuns).toHaveLength(0);
    expect(client.candidateUpserts).toHaveLength(0);
  });

  it('requires a service-role key before a confirmed CLI write', () => {
    expect(() => loadServiceRoleConfig({
      SUPABASE_WRITER_ENABLED: 'true',
      SUPABASE_URL: 'https://example.supabase.co',
    })).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
  });

  it('keeps the writer isolated from Controle de Tapetes modules', () => {
    const core = readFileSync(join(process.cwd(), 'src/core/syncSupabase.ts'), 'utf-8');
    const client = readFileSync(join(process.cwd(), 'src/supabase/serviceRoleClient.ts'), 'utf-8');

    expect(core + client).not.toMatch(/controle-tapetes|RAVATEX_SUPABASE_CLIENT|SUPABASE_ANON_KEY/i);
  });
});
