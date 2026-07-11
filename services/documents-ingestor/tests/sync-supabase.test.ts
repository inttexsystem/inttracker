import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runSyncSupabase, type SyncSupabaseOptions } from '../src/core/syncSupabase.js';
import {
  loadServiceRoleConfig,
  type CanonicalIngestorStateWrite,
  type ClaimedDocumentScanRequest,
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
    sender_email: 'fornecedor@empresa.com.br',
    cnpj_emitente: '12345678000199',
    cnpj_destinatario: '98765432000100',
    gmail_message_id: 'gmail-001',
    email_message_id: 'gmail-001',
    email_received_at: '2026-07-09T09:00:00.000Z',
    email_received_at_source: 'gmail_internal_date',
    email_received_at_estimated: false,
    drive_file_id: 'drive-001',
    drive_web_view_link: 'https://drive.example/doc-001',
    received_at: '2026-07-09T10:00:00.000Z',
    detected_at: '2026-07-09T10:00:00.000Z',
    latest_ingestion_event_id: 'evt-latest-001',
    latest_ingestion_event_at: '2026-07-09T10:00:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    event_type: 'document.detected',
    ingestion_event_id: 'evt-001',
    created_at: '2026-07-09T10:00:00.000Z',
    pedido_manual: 'PED-25-2026',
    document_id: 'doc-001',
    status: 'pending',
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
  canonicalWrites: CanonicalIngestorStateWrite[] = [];
  eventInserts: DocumentEventWrite[][] = [];
  startedRuns: Array<{ source: string; triggered_by: string }> = [];
  finishedRuns: Array<{ id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }> = [];
  recoveredCalls: Array<{ source: string; staleAfterMinutes?: number }> = [];
  callSequence: string[] = [];
  eventResult = { inserted: 1, skipped: 0 };
  canonicalError: Error | null = null;
  recoverResult: { recoveredCount: number } = { recoveredCount: 0 };
  recoverError: Error | null = null;
  startScanResult: { kind: 'started'; id: string } | { kind: 'already_running' } = { kind: 'started', id: 'run-001' };

  async recoverStaleRuns(params: { source: string; staleAfterMinutes?: number }): Promise<{ recoveredCount: number }> {
    this.callSequence.push('recover');
    this.recoveredCalls.push(params);
    if (this.recoverError) throw this.recoverError;
    return this.recoverResult;
  }

  async upsertCanonicalCandidateState(params: CanonicalIngestorStateWrite): Promise<void> {
    if (this.canonicalError) throw this.canonicalError;
    this.canonicalWrites.push(params);
  }

  async insertEventsIgnoreConflict(rows: DocumentEventWrite[]): Promise<{ inserted: number; skipped: number }> {
    this.eventInserts.push(rows);
    return this.eventResult;
  }

  async startScanRun(run: { source: string; triggered_by: string }): Promise<{ kind: 'started'; id: string } | { kind: 'already_running' }> {
    this.callSequence.push('start');
    this.startedRuns.push(run);
    return this.startScanResult;
  }

  async finishScanRun(params: { id: string; status: 'completed' | 'failed'; documentsProcessed: number; documentsNew: number; errorMessage: string | null }): Promise<void> {
    this.finishedRuns.push(params);
  }

  async claimNextDocumentScanRequest(_params: { source: string | null }): Promise<{ empty: boolean; request: ClaimedDocumentScanRequest | null }> {
    return { empty: true, request: null };
  }

  async markDocumentScanRequestRunning(_params: { requestId: string; scanRunId: string }): Promise<void> {
    // no-op: the sync:supabase path does not consume the scan request queue.
  }

  async finishDocumentScanRequest(_params: { requestId: string; status: 'completed' | 'failed'; errorMessage: string | null }): Promise<void> {
    // no-op: the sync:supabase path does not consume the scan request queue.
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('sync:supabase canonical writer', () => {
  it('dry-run has no client calls and reports complete canonical base', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase({ ...options([mappedRow()]), confirmWrite: false }, client);

    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.candidates_total).toBe(1);
    expect(result.canonical_base_complete).toBe(1);
    expect(result.canonical_base_skipped).toEqual([]);
    expect(result.candidates_upserted).toBe(1);
    expect(client.startedRuns).toHaveLength(0);
    expect(client.canonicalWrites).toHaveLength(0);
    expect(client.recoveredCalls).toHaveLength(0);
    expect(result.stale_recovery).toEqual({ attempted: false, recovered_count: 0 });
  });

  it('calls the canonical writer RPC contract with all ingestor fields', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase(options([mappedRow({ status: 'assigned' })]), client);

    expect(result.ok).toBe(true);
    expect(client.canonicalWrites[0]).toMatchObject({
      ingestor_status: 'assigned',
      ingestor_state_at: '2026-07-09T10:00:00.000Z',
      ingestor_event_id: 'evt-latest-001',
      ingestor_rejected_reason: null,
    });
    expect(client.canonicalWrites[0].candidate.document_id).toBe('doc-001');
    expect(client.canonicalWrites[0].candidate.email_received_at).toBe('2026-07-09T09:00:00.000Z');
    expect(client.canonicalWrites[0].candidate.email_received_at_source).toBe('gmail_internal_date');
    expect(client.canonicalWrites[0].candidate.sender_email).toBe('fornecedor@empresa.com.br');
  });

  it('keeps a missing sender as null in the canonical payload', async () => {
    const client = new WriterClientMock();
    await runSyncSupabase(options([mappedRow({ sender_email: null })]), client);
    expect(client.canonicalWrites[0].candidate.sender_email).toBeNull();
  });

  it.each(['pending', 'assigned', 'accepted', 'rejected'] as const)(
    'maps %s as the canonical ingestor status',
    async (status) => {
      const client = new WriterClientMock();
      const row = status === 'rejected'
        ? mappedRow({ status, rejected_reason: 'canonical reason' })
        : mappedRow({ status });
      await runSyncSupabase(options([row]), client);
      expect(client.canonicalWrites[0].ingestor_status).toBe(status);
      expect(client.canonicalWrites[0].ingestor_rejected_reason).toBe(status === 'rejected' ? 'canonical reason' : null);
    },
  );

  it('skips incomplete bases without fabricating a canonical state', async () => {
    const client = new WriterClientMock();
    const result = await runSyncSupabase(options([
      mappedRow({ document_id: 'doc-no-id', latest_ingestion_event_id: null }),
      mappedRow({ document_id: 'doc-no-time', latest_ingestion_event_at: null }),
      mappedRow({ document_id: 'doc-no-reason', status: 'rejected', rejected_reason: null }),
    ]), client);

    expect(result.ok).toBe(true);
    expect(result.canonical_base_complete).toBe(0);
    expect(result.candidates_upserted).toBe(0);
    expect(result.canonical_base_skipped).toEqual([
      { document_id: 'doc-no-id', reason: 'missing_latest_ingestion_event_id' },
      { document_id: 'doc-no-time', reason: 'missing_latest_ingestion_event_at' },
      { document_id: 'doc-no-reason', reason: 'ingestor_rejected_reason_required' },
    ]);
    expect(client.canonicalWrites).toHaveLength(0);
  });

  it('inserts canonical events idempotently even when a candidate base is skipped', async () => {
    const client = new WriterClientMock();
    client.eventResult = { inserted: 0, skipped: 1 };
    const result = await runSyncSupabase(options([mappedRow({ latest_ingestion_event_id: null })], [eventRow()]), client);

    expect(client.eventInserts[0][0].ingestion_event_id).toBe('evt-001');
    expect(result.events_inserted).toBe(0);
    expect(result.events_skipped).toBe(1);
  });

  it('returns migration_39_required as a controlled writer error', async () => {
    const client = new WriterClientMock();
    client.canonicalError = new Error('migration_39_required');
    const result = await runSyncSupabase(options([mappedRow()]), client);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['migration_39_required']);
    expect(result.scan_run.status).toBe('failed');
  });

  it('rejects malformed status and event ID before any write', async () => {
    const client = new WriterClientMock();
    await expect(runSyncSupabase(options([mappedRow({ status: 'unknown' })]), client)).rejects.toThrow(/Invalid document status/);
    await expect(runSyncSupabase(options([mappedRow()], [eventRow({ ingestion_event_id: '' })]), client)).rejects.toThrow(/ingestion_event_id is required/);
    expect(client.startedRuns).toHaveLength(0);
  });

  it('keeps the service-role key guard for confirmed writes', () => {
    expect(() => loadServiceRoleConfig({
      SUPABASE_WRITER_ENABLED: 'true',
      SUPABASE_URL: 'https://abc123def456.supabase.co',
      SUPABASE_PROJECT_REF: 'abc123def456',
    })).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
  });

  describe('project ref guard for confirmed writes', () => {
    const validUrl = 'https://abc123def456.supabase.co';
    const validRef = 'abc123def456';

    it('fails with supabase_project_ref_required when SUPABASE_PROJECT_REF is missing', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: validUrl,
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
      })).toThrow('supabase_project_ref_required');
    });

    it('fails with supabase_project_ref_mismatch when URL hostname ref does not match SUPABASE_PROJECT_REF', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: validUrl,
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: 'differentref000000',
      })).toThrow('supabase_project_ref_mismatch');
    });

    it('fails with supabase_url_invalid when SUPABASE_URL is not parseable', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: 'not-a-valid-url',
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: 'some-ref',
      })).toThrow('supabase_url_invalid');
    });

    it('fails with supabase_url_invalid when SUPABASE_URL hostname is not *.supabase.co', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: 'https://example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: 'some-ref',
      })).toThrow('supabase_url_invalid');
    });

    it('succeeds when project ref matches URL hostname', () => {
      const cfg = loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: validUrl,
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: validRef,
      });
      expect(cfg.projectRef).toBe(validRef);
      expect(cfg.url).toBe(validUrl);
      expect(cfg.serviceRoleKey).toBe('sk-test-key');
    });

    it('never logs service_role key in error messages', () => {
      const key = 'sk-sensitive-secret-key-12345';
      const urls = [
        'not-a-valid-url',
        'https://wrongref.supabase.co',
      ];
      const configs = [
        { SUPABASE_WRITER_ENABLED: 'true', SUPABASE_URL: urls[0], SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_PROJECT_REF: 'any' },
        { SUPABASE_WRITER_ENABLED: 'true', SUPABASE_URL: urls[1], SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_PROJECT_REF: 'different' },
      ];

      for (const cfg of configs) {
        try {
          loadServiceRoleConfig(cfg);
        } catch (error: any) {
          const msg = error?.message ?? '';
          expect(msg).not.toContain(key);
        }
      }

      try {
        loadServiceRoleConfig({ SUPABASE_WRITER_ENABLED: 'true', SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_PROJECT_REF: 'abc' });
      } catch (error: any) {
        const msg = error?.message ?? '';
        expect(msg).not.toContain('sk-');
        expect(msg).not.toContain('service_role');
      }
    });
  });

  it('delegates active human decision preservation to the database RPC', () => {
    const core = readFileSync(join(process.cwd(), 'src/core/syncSupabase.ts'), 'utf-8');
    const client = readFileSync(join(process.cwd(), 'src/supabase/serviceRoleClient.ts'), 'utf-8');

    expect(core + client).toMatch(/upsertCanonicalCandidateState/);
    expect(client).toMatch(/rpc\('upsert_document_candidate_ingestor_state'/);
    expect(core + client).not.toMatch(/\.from\('document_candidates'\)/);
    expect(core + client).not.toMatch(/\.from\('document_decisions'\)/);
    expect(core + client).not.toMatch(/decidir_documento|desfazer_decisao_documento/);
    expect(core + client).not.toMatch(/SUPABASE_ANON_KEY|controle-tapetes/i);
  });

  describe('stale lock recovery (G23-F-D)', () => {
    it('recovers stale runs strictly before startScanRun when --recover-stale is set', async () => {
      const client = new WriterClientMock();
      client.recoverResult = { recoveredCount: 1 };
      const result = await runSyncSupabase({ ...options([mappedRow()]), recoverStale: true, staleAfterMinutes: 30 }, client);

      expect(result.ok).toBe(true);
      expect(client.callSequence).toEqual(['recover', 'start']);
      expect(client.recoveredCalls).toEqual([{ source: 'documents_ingestor', staleAfterMinutes: 30 }]);
      expect(result.stale_recovery).toEqual({ attempted: true, recovered_count: 1 });
    });

    it('does not recover when --recover-stale is absent (behavior unchanged)', async () => {
      const client = new WriterClientMock();
      const result = await runSyncSupabase(options([mappedRow()]), client);

      expect(result.ok).toBe(true);
      expect(client.recoveredCalls).toHaveLength(0);
      expect(client.callSequence).toEqual(['start']);
      expect(result.stale_recovery).toEqual({ attempted: false, recovered_count: 0 });
    });

    it('dry-run performs no recovery and needs no client even with --recover-stale', async () => {
      const result = await runSyncSupabase(
        { ...options([mappedRow()]), confirmWrite: false, recoverStale: true },
        undefined,
      );

      expect(result.ok).toBe(true);
      expect(result.dry_run).toBe(true);
      expect(result.stale_recovery).toEqual({ attempted: false, recovered_count: 0 });
    });

    it('leaves a live run untouched: recovery frees nothing and scan stays already_running', async () => {
      const client = new WriterClientMock();
      client.recoverResult = { recoveredCount: 0 };
      client.startScanResult = { kind: 'already_running' };
      const result = await runSyncSupabase({ ...options([mappedRow()]), recoverStale: true }, client);

      expect(result.ok).toBe(false);
      expect(result.scan_run.status).toBe('scan_already_running');
      expect(result.stale_recovery).toEqual({ attempted: true, recovered_count: 0 });
      expect(client.callSequence).toEqual(['recover', 'start']);
      expect(client.canonicalWrites).toHaveLength(0);
    });

    it('recovery RPC failure is controlled and never proceeds to a scan run or write', async () => {
      const client = new WriterClientMock();
      client.recoverError = new Error('migration_40_required');
      await expect(
        runSyncSupabase({ ...options([mappedRow()]), recoverStale: true }, client),
      ).rejects.toThrow('migration_40_required');

      expect(client.callSequence).toEqual(['recover']);
      expect(client.startedRuns).toHaveLength(0);
      expect(client.canonicalWrites).toHaveLength(0);
      expect(client.finishedRuns).toHaveLength(0);
    });

    describe('document party CNPJs in canonical payload', () => {
    it('both CNPJs enter the payload as explicit strings', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.cnpj_emitente).toBe('12345678000199');
      expect(candidate.cnpj_destinatario).toBe('98765432000100');
    });

    it('only emitente enters as string and destinatario as null', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow({ cnpj_destinatario: null })]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.cnpj_emitente).toBe('12345678000199');
      expect(candidate.cnpj_destinatario).toBeNull();
    });

    it('only destinatario enters as string and emitente as null', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow({ cnpj_emitente: null })]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.cnpj_emitente).toBeNull();
      expect(candidate.cnpj_destinatario).toBe('98765432000100');
    });

    it('both absent enter explicitly as null', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow({ cnpj_emitente: null, cnpj_destinatario: null })]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.cnpj_emitente).toBeNull();
      expect(candidate.cnpj_destinatario).toBeNull();
    });

    it('preserves 14-digit CNPJ values without punctuation', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow({ cnpj_emitente: '99999999000199', cnpj_destinatario: '00000000000191' })]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.cnpj_emitente).toBe('99999999000199');
      expect(candidate.cnpj_destinatario).toBe('00000000000191');
    });

    it('payload has exactly cnpj_emitente and cnpj_destinatario keys', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(Object.keys(candidate)).toContain('cnpj_emitente');
      expect(Object.keys(candidate)).toContain('cnpj_destinatario');
    });

    it('does not use camelCase property names in remote payload', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate).not.toHaveProperty('cnpjEmitente');
      expect(candidate).not.toHaveProperty('cnpjDestinatario');
    });

    it('entityMatch is not sent in payload', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      const candidate = client.canonicalWrites[0].candidate as Record<string, unknown>;
      expect(candidate).not.toHaveProperty('entityMatch');
    });

    it('fornecedor_id remains null as before', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      expect(client.canonicalWrites[0].candidate.fornecedor_id).toBeNull();
    });

    it('schema_version remains unchanged', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      expect(client.canonicalWrites[0].candidate.schema_version).toBe(1);
    });

    it('remaining fields are unaltered', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect(candidate.document_id).toBe('doc-001');
      expect(candidate.filename_original).toBe('nota.xml');
      expect(candidate.tipo_documento).toBe('nf');
      expect(candidate.sender_email).toBe('fornecedor@empresa.com.br');
    });

    it('dry-run does not create writer client nor execute write', async () => {
      const client = new WriterClientMock();
      const result = await runSyncSupabase({ ...options([mappedRow()]), confirmWrite: false }, client);
      expect(result.dry_run).toBe(true);
      expect(client.canonicalWrites).toHaveLength(0);
      expect(client.startedRuns).toHaveLength(0);
    });

    it('confirmed write mock contains the new CNPJ fields', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow()]), client);
      expect(client.canonicalWrites).toHaveLength(1);
      expect(client.canonicalWrites[0].candidate.cnpj_emitente).toBe('12345678000199');
      expect(client.canonicalWrites[0].candidate.cnpj_destinatario).toBe('98765432000100');
    });

    it('project ref absent continues to fail', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: 'https://abc123def456.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
      })).toThrow('supabase_project_ref_required');
    });

    it('project ref mismatch continues to fail', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: 'https://abc123def456.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: 'differentref000000',
      })).toThrow('supabase_project_ref_mismatch');
    });

    it('invalid URL continues to fail', () => {
      expect(() => loadServiceRoleConfig({
        SUPABASE_WRITER_ENABLED: 'true',
        SUPABASE_URL: 'not-a-valid-url',
        SUPABASE_SERVICE_ROLE_KEY: 'sk-test-key',
        SUPABASE_PROJECT_REF: 'some-ref',
      })).toThrow('supabase_url_invalid');
    });

    it('secret does not appear in error message', () => {
      const key = 'sk-sensitive-secret-key-12345';
      try {
        loadServiceRoleConfig({
          SUPABASE_WRITER_ENABLED: 'true',
          SUPABASE_URL: 'https://abc.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: key,
          SUPABASE_PROJECT_REF: 'abc',
        });
      } catch (error: any) {
        expect(error.message).not.toContain(key);
      }
    });

    it('writer error preserves previous behavior', async () => {
      const client = new WriterClientMock();
      client.canonicalError = new Error('migration_39_required');
      const result = await runSyncSupabase(options([mappedRow()]), client);
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['migration_39_required']);
    });

    it('null values are not omitted from payload keys', async () => {
      const client = new WriterClientMock();
      await runSyncSupabase(options([mappedRow({ cnpj_emitente: null, cnpj_destinatario: null })]), client);
      const candidate = client.canonicalWrites[0].candidate;
      expect('cnpj_emitente' in candidate).toBe(true);
      expect('cnpj_destinatario' in candidate).toBe(true);
      expect(candidate.cnpj_emitente).toBeNull();
      expect(candidate.cnpj_destinatario).toBeNull();
    });
  });

  it('binds recovery to the dedicated RPC without touching decision tables', () => {
      const core = readFileSync(join(process.cwd(), 'src/core/syncSupabase.ts'), 'utf-8');
      const client = readFileSync(join(process.cwd(), 'src/supabase/serviceRoleClient.ts'), 'utf-8');

      expect(client).toMatch(/rpc\('recuperar_document_scan_runs_travados'/);
      expect(client).toMatch(/migration_40_required/);
      expect(core + client).not.toMatch(/\.from\('document_candidates'\)/);
      expect(core + client).not.toMatch(/\.from\('document_decisions'\)/);
    });
  });
});
