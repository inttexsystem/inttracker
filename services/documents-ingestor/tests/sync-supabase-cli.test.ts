import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { HERMETIC_TEST_ROOT } from './setup.js';

// ---------------------------------------------------------------------------
// Hermetic CLI forwarding test for sync-supabase --technical-evidence
// (G28-B3-B5-C). The runSyncSupabase core is replaced with a vi.doMock
// stub so we observe the exact options the CLI forwards, including
// technicalEvidencePath. No configuration, no env, no real Supabase
// client and no network are touched. The local CLI module is imported
// only after all mocks are in place.
// ---------------------------------------------------------------------------

const SCENARIO_DIRS: string[] = [];

function scenarioDir(): string {
  const dir = mkdtempSync(join(HERMETIC_TEST_ROOT, `sync-supabase-cli-${randomUUID()}`));
  SCENARIO_DIRS.push(dir);
  return dir;
}

function writeJsonl(name: string, rows: unknown[]): string {
  const dir = scenarioDir();
  const path = join(dir, name);
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf-8');
  return path;
}

function mappedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    document_id: 'doc-cli-1',
    filename_original: 'nfe.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    status: 'pending',
    pedido_manual: 'PED-25-2026',
    sender_email: 'fornecedor@empresa.com.br',
    cnpj_emitente: '12345678000199',
    cnpj_destinatario: '98765432000100',
    gmail_message_id: 'gmail-cli-1',
    email_message_id: 'gmail-cli-1',
    email_received_at: '2026-07-09T09:00:00.000Z',
    email_received_at_source: 'gmail_internal_date',
    email_received_at_estimated: false,
    drive_file_id: 'drive-cli-1',
    drive_web_view_link: 'https://drive.example/doc-cli-1',
    received_at: '2026-07-09T10:00:00.000Z',
    detected_at: '2026-07-09T10:00:00.000Z',
    latest_ingestion_event_id: 'evt-cli-1',
    latest_ingestion_event_at: '2026-07-09T10:00:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
    ...overrides,
  };
}

function baseEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    documentId: 'doc-cli-1',
    evidenceVersion: 1,
    technicalEvidence: { duplicateRelation: { kind: 'none', detectionBasis: 'sentinel' } },
    origin: {
      technical: { source: 'test-classifier', authorship: 'test' },
      suggestion: { source: 'system', authorship: 'test', note: 'review' },
      evidenceVersion: 1,
    },
    createdAt: '2026-07-12T10:30:00.000Z',
    ...overrides,
  };
}

interface CapturedCall {
  options: Record<string, unknown>;
  client: unknown;
}

let captured: CapturedCall | null = null;
let stdoutLines: string[] = [];

beforeEach(async () => {
  captured = null;
  stdoutLines = [];

  vi.resetModules();
  vi.doMock('../src/config.js', () => ({ config: { scanDaysBack: 7 } }));
  vi.doMock('../src/index.js', () => ({
    scanGmail: vi.fn(),
    listPending: vi.fn(),
    assignPedido: vi.fn(),
    exportPendingEvents: vi.fn(),
    queryAndExportEvents: vi.fn(),
  }));
  vi.doMock('../src/core/exportTechnicalEvidence.js', () => ({
    exportCurrentTechnicalEvidence: vi.fn(),
  }));
  vi.doMock('../src/core/exportPackage.js', () => ({
    exportIngestionEvents: vi.fn(),
    exportPackage: vi.fn(),
    exportReceivedDocuments: vi.fn(),
    exportMappedDocuments: vi.fn(),
  }));
  vi.doMock('../src/core/syncMapped.js', () => ({
    runSyncMapped: vi.fn(),
    validateSyncMappedOptions: vi.fn(),
  }));
  vi.doMock('../src/core/syncManifest.js', () => ({
    exportManifest: vi.fn(),
    syncManifest: vi.fn(),
  }));
  vi.doMock('../src/core/reconcileGmailDocuments.js', () => ({
    reconcileGmailDocuments: vi.fn(),
  }));
  vi.doMock('../src/storage/sqlite.js', () => ({
    getDb: vi.fn(),
    closeDb: vi.fn(),
  }));
  vi.doMock('../src/supabase/serviceRoleClient.js', () => ({
    loadServiceRoleConfig: vi.fn(() => {
      throw new Error('service-role config must not be read in dry-run forwarding');
    }),
    createServiceRoleWriterClient: vi.fn(() => {
      throw new Error('service-role client must not be created in dry-run forwarding');
    }),
  }));
  vi.doMock('../src/core/syncSupabase.js', () => ({
    runSyncSupabase: vi.fn(async (options, client) => {
      captured = { options: { ...options }, client };
      return {
        ok: true,
        dry_run: true,
        source: options.source ?? 'documents_ingestor',
        candidates_total: 1,
        candidates_upserted: 1,
        canonical_base_complete: 1,
        canonical_base_skipped: [],
        events_inserted: 0,
        events_skipped: 0,
        scan_run: { status: 'dry_run', id: null },
        stale_recovery: { attempted: false, recovered_count: 0 },
        technical_evidence_attempted: 1,
        technical_evidence_inserted: 0,
        technical_evidence_unchanged: 0,
        technical_evidence_failed: 0,
        technical_evidence_skipped_without_evidence: 0,
        errors: [],
      };
    }),
    prepareSyncSupabaseInput: vi.fn(),
  }));

  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdoutLines.push(format(...args));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stdoutLines.push(format(...args));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of SCENARIO_DIRS.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.doUnmock('../src/config.js');
  vi.doUnmock('../src/index.js');
  vi.doUnmock('../src/core/exportTechnicalEvidence.js');
  vi.doUnmock('../src/core/exportPackage.js');
  vi.doUnmock('../src/core/syncMapped.js');
  vi.doUnmock('../src/core/syncManifest.js');
  vi.doUnmock('../src/core/reconcileGmailDocuments.js');
  vi.doUnmock('../src/storage/sqlite.js');
  vi.doUnmock('../src/supabase/serviceRoleClient.js');
  vi.doUnmock('../src/core/syncSupabase.js');
  vi.resetModules();
});

async function runCli(args: string): Promise<void> {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  process.argv = ['node', 'cli.ts', 'sync-supabase', ...args];
  process.exitCode = undefined;
  try {
    await import('../src/cli.ts');
  } finally {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
  }
}

describe('CLI sync-supabase --technical-evidence forwarding', () => {
  it('forwards --technical-evidence <path> to runSyncSupabase as technicalEvidencePath', { timeout: 60000 }, async () => {
    const mappedPath = writeJsonl('mapped.jsonl', [mappedRow()]);
    const evidencePath = writeJsonl('evidence.jsonl', [baseEvidence()]);

    await runCli([
      '--mapped', mappedPath,
      '--technical-evidence', evidencePath,
      '--dry-run',
      '--source', 'cli-test',
    ]);

    expect(captured).not.toBeNull();
    expect(captured!.options.technicalEvidencePath).toBe(evidencePath);
    expect(captured!.options.mappedPath).toBe(mappedPath);
    expect(captured!.options.dryRun).toBe(true);
    expect(captured!.options.confirmWrite).toBe(false);
    expect(captured!.options.source).toBe('cli-test');
    expect(captured!.client).toBeUndefined();
  });

  it('absent --technical-evidence forwards technicalEvidencePath as undefined', { timeout: 60000 }, async () => {
    const mappedPath = writeJsonl('mapped.jsonl', [mappedRow()]);

    await runCli([
      '--mapped', mappedPath,
      '--dry-run',
    ]);

    expect(captured).not.toBeNull();
    expect(captured!.options.technicalEvidencePath).toBeUndefined();
    expect(captured!.options.mappedPath).toBe(mappedPath);
    expect(captured!.client).toBeUndefined();
  });

  it('dry-run forwarding does not call loadServiceRoleConfig or createServiceRoleWriterClient', { timeout: 60000 }, async () => {
    const mappedPath = writeJsonl('mapped.jsonl', [mappedRow()]);
    const evidencePath = writeJsonl('evidence.jsonl', [baseEvidence()]);

    await runCli([
      '--mapped', mappedPath,
      '--technical-evidence', evidencePath,
      '--dry-run',
    ]);

    const { loadServiceRoleConfig, createServiceRoleWriterClient } = await import(
      '../src/supabase/serviceRoleClient.js'
    );
    expect(vi.mocked(loadServiceRoleConfig)).not.toHaveBeenCalled();
    expect(vi.mocked(createServiceRoleWriterClient)).not.toHaveBeenCalled();
  });

  it('prints the five snake_case evidence counters in the CLI JSON output', { timeout: 60000 }, async () => {
    const mappedPath = writeJsonl('mapped.jsonl', [mappedRow()]);
    const evidencePath = writeJsonl('evidence.jsonl', [baseEvidence()]);

    await runCli([
      '--mapped', mappedPath,
      '--technical-evidence', evidencePath,
      '--dry-run',
    ]);

    const combined = stdoutLines.join('\n');
    const jsonStart = combined.indexOf('{');
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const json = JSON.parse(combined.slice(jsonStart));
    expect(json.technical_evidence_attempted).toBe(1);
    expect(json.technical_evidence_inserted).toBe(0);
    expect(json.technical_evidence_unchanged).toBe(0);
    expect(json.technical_evidence_failed).toBe(0);
    expect(json.technical_evidence_skipped_without_evidence).toBe(0);
    expect(json.dry_run).toBe(true);
  });
});
