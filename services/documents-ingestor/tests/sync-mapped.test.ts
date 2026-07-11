import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  runSyncMapped,
  validateSyncMappedOptions,
  buildScanOptions,
  buildExportOptions,
  type SyncMappedDeps,
  type SyncMappedOptions,
} from '../src/core/syncMapped.js';
import type { ScanResult } from '../src/core/realScan.js';
import type { ExportMappedResult } from '../src/core/exportPackage.js';
import type { ReportSummary } from '../src/core/queries.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `sync-mapped-test-${randomUUID()}`);

function makeFakeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    mode: 'dry-run',
    emailsScanned: 0,
    attachmentsFound: 0,
    newDocuments: 0,
    duplicates: 0,
    crossMessageDuplicates: 0,
    skippedByCap: 0,
    errors: [],
    ...overrides,
  };
}

function makeFakeExportResult(overrides: Partial<ExportMappedResult> = {}): ExportMappedResult {
  return {
    outputPath: join(SCENARIO_DIR, 'documentos-mapeados.jsonl'),
    totalDocuments: 0,
    files: [join(SCENARIO_DIR, 'documentos-mapeados.jsonl')],
    ...overrides,
  };
}

function makeFakeReport(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    totalEmailsProcessed: 0,
    totalDocuments: 0,
    documentsByTipo: {},
    documentsByStatus: {},
    documentsByFormato: {},
    documentsByDirecao: {},
    nfByDirecao: {},
    pendingByDirecao: {},
    pendingWithoutPedido: 0,
    assignedByPedido: {},
    pendingAppAcceptance: 0,
    documentsAccepted: 0,
    documentsRejected: 0,
    recentErrors: 0,
    outboxPath: 'data/outbox/document-events.jsonl',
    runLogs: [],
    ...overrides,
  };
}

function makeOrderSpyDeps(): { deps: SyncMappedDeps; calls: string[]; scanOpts: any[]; exportOpts: any[]; reportOpts: any[] } {
  const calls: string[] = [];
  const scanOpts: any[] = [];
  const exportOpts: any[] = [];
  const reportOpts: any[] = [];
  const deps: SyncMappedDeps = {
    scan: async (opts) => {
      calls.push('scan');
      scanOpts.push(opts);
      return makeFakeScanResult({ mode: opts.confirmReal ? 'real' : 'dry-run' });
    },
    exportMapped: (opts) => {
      calls.push('export');
      exportOpts.push(opts);
      return makeFakeExportResult();
    },
    report: (opts) => {
      calls.push('report');
      reportOpts.push(opts);
      return makeFakeReport();
    },
  };
  return { deps, calls, scanOpts, exportOpts, reportOpts };
}

describe('G13-B: sync:mapped orchestrator (validation)', () => {
  it('accepts plain run (no retry)', () => {
    const v = validateSyncMappedOptions({ daysBack: 7 });
    expect(v.ok).toBe(true);
    expect(v.resolvedDaysBack).toBe(7);
  });

  it('--retry-message without --days resolves to days=1', () => {
    const v = validateSyncMappedOptions({ retryMessageId: 'msg-123' });
    expect(v.ok).toBe(true);
    expect(v.resolvedDaysBack).toBe(1);
  });

  it('--retry-message with --days=1 is allowed', () => {
    const v = validateSyncMappedOptions({ retryMessageId: 'msg-123', daysBack: 1 });
    expect(v.ok).toBe(true);
    expect(v.resolvedDaysBack).toBe(1);
  });

  it('--retry-message with --days > 1 is REJECTED', () => {
    const v = validateSyncMappedOptions({ retryMessageId: 'msg-123', daysBack: 3 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/--retry-message/);
    expect(v.reason).toMatch(/--days/);
  });

  it('--retry-message with --wide-scan is REJECTED', () => {
    const v = validateSyncMappedOptions({ retryMessageId: 'msg-123', wideScan: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/--retry-message/);
    expect(v.reason).toMatch(/--wide-scan/);
  });

  it('--retry-message with --query is REJECTED', () => {
    const v = validateSyncMappedOptions({ retryMessageId: 'msg-123', query: 'from:foo' });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/--retry-message/);
    expect(v.reason).toMatch(/--query/);
  });

  it('--wide-scan alone is allowed (no retry)', () => {
    const v = validateSyncMappedOptions({ daysBack: 14, wideScan: true });
    expect(v.ok).toBe(true);
    expect(v.resolvedDaysBack).toBe(14);
  });
});

describe('G13-B: sync:mapped buildScanOptions', () => {
  it('passes through days when no retry', () => {
    const opts = buildScanOptions({ daysBack: 5 });
    expect(opts.daysBack).toBe(5);
    expect(opts.retryMessageId).toBeUndefined();
    expect(opts.confirmReal).toBe(false);
  });

  it('forces days=1 for retry', () => {
    const opts = buildScanOptions({ retryMessageId: 'msg-abc' });
    expect(opts.daysBack).toBe(1);
    expect(opts.retryMessageId).toBe('msg-abc');
  });

  it('forwards query, maxAttachments, confirmReal', () => {
    const opts = buildScanOptions({ daysBack: 3, query: 'from:foo', maxAttachments: 10, confirmReal: true });
    expect(opts.daysBack).toBe(3);
    expect(opts.query).toBe('from:foo');
    expect(opts.maxAttachments).toBe(10);
    expect(opts.confirmReal).toBe(true);
  });
});

describe('G13-B: sync:mapped buildExportOptions', () => {
  it('maps days/limit/status/output correctly', () => {
    const opts = buildExportOptions({
      days: 7,
      limit: 100,
      status: 'pending',
      outputPath: 'custom/path.jsonl',
    });
    expect(opts.daysBack).toBe(7);
    expect(opts.limit).toBe(100);
    expect(opts.status).toBe('pending');
    expect(opts.outputPath).toBe('custom/path.jsonl');
  });

  it('omits filters when not set', () => {
    const opts = buildExportOptions({});
    expect(opts.daysBack).toBeUndefined();
    expect(opts.limit).toBeUndefined();
    expect(opts.status).toBeUndefined();
    expect(opts.outputPath).toBeUndefined();
  });
});

describe('G13-B: sync:mapped runSyncMapped (sequence + delegation)', () => {
  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('calls scan → export → report in that order', async () => {
    const { deps, calls } = makeOrderSpyDeps();
    const result = await runSyncMapped({ daysBack: 7 }, deps);
    expect(calls).toEqual(['scan', 'export', 'report']);
    expect(result.sequence).toEqual(['scan', 'export', 'report']);
  });

  it('dry-run by default (confirmReal=false) propagates to scan', async () => {
    const { deps, scanOpts } = makeOrderSpyDeps();
    await runSyncMapped({ daysBack: 7 }, deps);
    expect(scanOpts[0].confirmReal).toBe(false);
  });

  it('--confirm-real-google propagates to scan', async () => {
    const { deps, scanOpts } = makeOrderSpyDeps();
    await runSyncMapped({ daysBack: 7, confirmReal: true }, deps);
    expect(scanOpts[0].confirmReal).toBe(true);
  });

  it('--retry-message without --days passes days=1 to scan', async () => {
    const { deps, scanOpts } = makeOrderSpyDeps();
    await runSyncMapped({ retryMessageId: 'msg-xyz' }, deps);
    expect(scanOpts[0].retryMessageId).toBe('msg-xyz');
    expect(scanOpts[0].daysBack).toBe(1);
  });

  it('--retry-message with --days > 1 throws with clear message', async () => {
    const { deps, calls } = makeOrderSpyDeps();
    await expect(
      runSyncMapped({ retryMessageId: 'msg-xyz', daysBack: 5 }, deps),
    ).rejects.toThrow(/--retry-message.*--days/);
    expect(calls).toEqual([]);
  });

  it('--retry-message with --wide-scan throws', async () => {
    const { deps, calls } = makeOrderSpyDeps();
    await expect(
      runSyncMapped({ retryMessageId: 'msg-xyz', wideScan: true, daysBack: 14 }, deps),
    ).rejects.toThrow(/--retry-message.*--wide-scan/);
    expect(calls).toEqual([]);
  });

  it('--retry-message with --query throws', async () => {
    const { deps, calls } = makeOrderSpyDeps();
    await expect(
      runSyncMapped({ retryMessageId: 'msg-xyz', query: 'from:foo' }, deps),
    ).rejects.toThrow(/--retry-message.*--query/);
    expect(calls).toEqual([]);
  });

  it('returns full result envelope with scan, export, report', async () => {
    const { deps } = makeOrderSpyDeps();
    const result = await runSyncMapped({ daysBack: 7, confirmReal: true }, deps);
    expect(result.scan).toBeDefined();
    expect(result.scan.mode).toBe('real');
    expect(result.export).toBeDefined();
    expect(result.export.totalDocuments).toBe(0);
    expect(result.report).toBeDefined();
    expect(result.report.totalDocuments).toBe(0);
  });
});

describe('G13-B: sync:mapped package.json wiring (read-only)', () => {
  it('package.json declares sync:mapped script pointing to sync-mapped command', async () => {
    const { readFileSync: read } = await import('node:fs');
    const { resolve } = await import('node:path');
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(read(pkgPath, 'utf-8'));
    expect(pkg.scripts['sync:mapped']).toBe('tsx src/cli.ts sync-mapped');
  });
});

describe('G13-B: sync:mapped end-to-end with real export (hermetic DB)', () => {
  let dbDir: string;
  let outPath: string;

  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    dbDir = join(SCENARIO_DIR, 'db');
    mkdirSync(dbDir, { recursive: true });
    process.env.DATABASE_PATH = join(dbDir, 'app.db');
    process.env.OUTBOX_PATH = join(SCENARIO_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(SCENARIO_DIR, 'cache');
    outPath = join(SCENARIO_DIR, 'documentos-mapeados.jsonl');
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/storage/sqlite.js');
    closeDb();
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('writes the expected JSONL file to data/exports/documentos-mapeados.jsonl', async () => {
    const { getDb } = await import('../src/storage/sqlite.js');
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const id = 'doc-sm-1';
    db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`).run('msg-sm-1', 'thr-sm-1', 'NF');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, drive_web_view_link, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, 'msg-sm-1', 'thr-sm-1', 'att-sm-1', 'NF-001.xml', 'sha-sm-1', 'nf', 'xml', 'entrada', 'google_drive', 'gdrive://file/x1', 'x1', 'https://drive.google.com/file/d/x1/view', 'pending', now, now);
    db.prepare(
      `INSERT INTO ingestion_events (id, event_type, pedido_manual, document_id, status, storage_backend, storage_uri, drive_file_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('evt-sm-1', 'document.detected', '', id, 'pending_app_acceptance', 'google_drive', 'gdrive://file/x1', 'x1', now);

    const { runSyncMapped: runReal } = await import('../src/core/syncMapped.js');
    const result = await runReal({ daysBack: 7, outputPath: outPath });

    expect(existsSync(result.export.outputPath)).toBe(true);
    expect(result.export.outputPath).toBe(outPath);
    expect(result.export.totalDocuments).toBe(1);
    const lines = readFileSync(result.export.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(id);
    expect(parsed.status).toBe('pending');
    expect(parsed.schema_version).toBe(1);
  });

  it('report is computed and reflects DB counts', async () => {
    const { getDb } = await import('../src/storage/sqlite.js');
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`).run('msg-r-1', 'thr-r-1', 'A');
    db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`).run('msg-r-2', 'thr-r-2', 'B');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('doc-r-1', 'msg-r-1', 'thr-r-1', 'att-r-1', 'a.xml', 'sha-r-1', 'nf', 'xml', 'entrada', 'google_drive', 'gdrive://file/r1', 'r1', 'pending', now, now);
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('doc-r-2', 'msg-r-2', 'thr-r-2', 'att-r-2', 'b.pdf', 'sha-r-2', 'romaneio', 'pdf', null, 'google_drive', 'gdrive://file/r2', 'r2', 'pending', now, now);

    const { runSyncMapped: runReal } = await import('../src/core/syncMapped.js');
    const result = await runReal({ daysBack: 7, outputPath: outPath });

    expect(result.report.totalDocuments).toBe(2);
    expect(result.report.totalEmailsProcessed).toBe(2);
    expect(result.report.documentsByTipo.nf).toBe(1);
    expect(result.report.documentsByTipo.romaneio).toBe(1);
    expect(result.report.documentsByStatus.pending).toBe(2);
  });
});

