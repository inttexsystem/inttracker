import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import { exportPendingEvents, queryAndExportEvents } from '../src/core/outbox.js';
import { generateReport } from '../src/core/queries.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `guardrails-test-${randomUUID()}`);

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? 'msg-guard-seed';
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-guard-seed', 'Test Subject');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id, gmailMessageId, 'thr-guard-seed', 'att-guard-seed',
    overrides.filename ?? 'NF-test.pdf',
    overrides.sha256 ?? 'a'.repeat(64),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'pdf',
    overrides.direcao ?? null,
    'google_drive',
    overrides.storageUri ?? 'gdrive://file/drive-guard',
    overrides.driveFileId ?? 'drive-guard',
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/drive-guard/view',
  );
  return id;
}

describe('outbox ingestion_event_id', () => {
  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(SCENARIO_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(SCENARIO_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(SCENARIO_DIR, 'cache');
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('document.linked export has ingestion_event_id', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    expect(exported).toHaveLength(1);
    expect(exported[0].ingestion_event_id).toBeTruthy();
    expect(exported[0].ingestion_event_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('document.accepted export has ingestion_event_id', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    const acceptedEvent = exported.find(e => e.event_type === 'document.accepted');
    expect(acceptedEvent).toBeTruthy();
    expect(acceptedEvent!.ingestion_event_id).toBeTruthy();
  });

  it('event_id legacy is preserved alongside ingestion_event_id', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    expect(exported).toHaveLength(1);
    expect(exported[0].event_id).toBe(docId);
    expect(exported[0].ingestion_event_id).toBeTruthy();
    expect(exported[0].ingestion_event_id).not.toBe(docId);
  });

  it('event_type and status are preserved alongside ingestion_event_id', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);
    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    expect(exported[0].event_type).toBe('document.linked');
    expect(exported[0].status).toBe('pending_app_acceptance');
  });

  it('report JSON shows all existing counters', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    const report = generateReport();

    expect(report.totalDocuments).toBe(1);
    expect(report.documentsAccepted).toBe(1);
    expect(report.documentsRejected).toBe(0);
    expect(report.pendingAppAcceptance).toBeGreaterThanOrEqual(0);
    expect(report.documentsByStatus.accepted).toBe(1);
    expect(report.documentsByTipo.nf).toBe(1);
  });

  it('queryAndExportEvents filters by event_type', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');

    const linked = queryAndExportEvents({ eventType: 'document.linked' });
    expect(linked).toHaveLength(1);
    expect(linked[0].event_type).toBe('document.linked');

    const detected = queryAndExportEvents({ eventType: 'document.detected' });
    expect(detected).toHaveLength(0);
  });

  it('queryAndExportEvents filters by pedido', () => {
    const db = getDb();
    const docId1 = seedPendingDoc(db, { gmailMessageId: 'msg-exp-1' });
    const docId2 = seedPendingDoc(db, { gmailMessageId: 'msg-exp-2' });
    linkDocumentToPedido(docId1, '25/2026');
    linkDocumentToPedido(docId2, '50/2026');

    const filtered = queryAndExportEvents({ pedido: 'PED-50-2026' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].pedido_manual).toBe('PED-50-2026');
  });

  it('queryAndExportEvents preserves ingestion_event_id and reason', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');
    rejectDocument(docId, 'Invalido');

    const results = queryAndExportEvents({ eventType: 'document.rejected' });
    expect(results).toHaveLength(1);
    expect(results[0].ingestion_event_id).toBeTruthy();
    expect(results[0].document.reason).toBe('Invalido');
  });
});
