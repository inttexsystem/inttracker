import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import { exportPendingEvents } from '../src/core/outbox.js';
import { generateReport } from '../src/core/queries.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `acceptance-test-${randomUUID()}`);

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? 'msg-acc-seed';
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-acc-seed', 'Test Subject');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id, gmailMessageId, 'thr-acc-seed', 'att-acc-seed',
    overrides.filename ?? 'NF-test.pdf',
    overrides.sha256 ?? 'a'.repeat(64),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'pdf',
    overrides.direcao ?? null,
    'google_drive',
    overrides.storageUri ?? 'gdrive://file/drive-acc',
    overrides.driveFileId ?? 'drive-acc',
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/drive-acc/view',
  );
  return id;
}

function seedAssignedDoc(database: any, pedido: string): string {
  const docId = seedPendingDoc(database);
  linkDocumentToPedido(docId, pedido);
  return docId;
}

describe('document acceptance (local-only)', () => {
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

  it('accept transients assigned document to accepted', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    const result = acceptDocument(docId);

    expect(result.status).toBe('accepted');
    expect(result.pedidoManual).toBe('PED-25-2026');
    expect(result.eventId).toBeTruthy();

    const doc = db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.status).toBe('accepted');

    const evt = db.prepare(`SELECT * FROM ingestion_events WHERE event_type = 'document.accepted' AND document_id = ?`).get(docId) as any;
    expect(evt).toBeTruthy();
    expect(evt.status).toBe('accepted');
  });

  it('accept emits document.accepted event to outbox', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    acceptDocument(docId);

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    const lines = readFileSync(outboxPath, 'utf-8').trim().split('\n').filter(Boolean);
    const acceptedEvents = lines.map(l => JSON.parse(l)).filter((e: any) => e.event_type === 'document.accepted');
    expect(acceptedEvents).toHaveLength(1);
    expect(acceptedEvents[0].status).toBe('accepted');
    expect(acceptedEvents[0].pedido_manual).toBe('PED-25-2026');
    expect(acceptedEvents[0].document.document_id).toBe(docId);
  });

  it('reject transients assigned document to rejected', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    const result = rejectDocument(docId, 'Motivo de teste');

    expect(result.status).toBe('rejected');
    expect(result.pedidoManual).toBe('PED-25-2026');

    const doc = db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.status).toBe('rejected');
  });

  it('reject emits document.rejected event with reason', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    rejectDocument(docId, 'Documento incorreto');

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    const lines = readFileSync(outboxPath, 'utf-8').trim().split('\n').filter(Boolean);
    const rejectedEvents = lines.map(l => JSON.parse(l)).filter((e: any) => e.event_type === 'document.rejected');
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0].status).toBe('rejected');
    expect(rejectedEvents[0].document.reason).toBe('Documento incorreto');
  });

  it('reject event has reason undefined when not provided', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    rejectDocument(docId);

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    const lines = readFileSync(outboxPath, 'utf-8').trim().split('\n').filter(Boolean);
    const rejectedEvents = lines.map(l => JSON.parse(l)).filter((e: any) => e.event_type === 'document.rejected');
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0].document.reason).toBeUndefined();
  });

  it('pending document cannot be accepted', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    expect(() => acceptDocument(docId)).toThrow(/not linked/);
  });

  it('pending document cannot be rejected', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    expect(() => rejectDocument(docId)).toThrow(/not linked/);
  });

  it('non-existent document fails with clear error', () => {
    expect(() => acceptDocument('nonexistent')).toThrow('Document not found');
    expect(() => rejectDocument('nonexistent')).toThrow('Document not found');
  });

  it('accepted document cannot be rejected', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    acceptDocument(docId);
    expect(() => rejectDocument(docId)).toThrow(/already accepted/);
  });

  it('rejected document cannot be accepted', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    rejectDocument(docId);
    expect(() => acceptDocument(docId)).toThrow(/already rejected/);
  });

  it('accept is idempotent (same doc, same status)', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    const r1 = acceptDocument(docId);
    expect(r1.status).toBe('accepted');

    const r2 = acceptDocument(docId);
    expect(r2.status).toBe('accepted');

    const evts = db.prepare(`SELECT * FROM ingestion_events WHERE event_type = 'document.accepted' AND document_id = ?`).all(docId);
    expect(evts).toHaveLength(1);
  });

  it('reject is idempotent (same doc, same status)', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    const r1 = rejectDocument(docId);
    expect(r1.status).toBe('rejected');

    const r2 = rejectDocument(docId);
    expect(r2.status).toBe('rejected');

    const evts = db.prepare(`SELECT * FROM ingestion_events WHERE event_type = 'document.rejected' AND document_id = ?`).all(docId);
    expect(evts).toHaveLength(1);
  });

  it('accept and reject do not call Google Drive', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    acceptDocument(docId);

    const doc = db.prepare(`SELECT drive_file_id, storage_uri FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.drive_file_id).toBe('drive-acc');
    expect(doc.storage_uri).toBe('gdrive://file/drive-acc');

    const evt = db.prepare(`SELECT manifest_storage_uri, manifest_drive_file_id FROM ingestion_events WHERE event_type = 'document.accepted' AND document_id = ?`).get(docId) as any;
    expect(evt.manifest_storage_uri).toBeNull();
    expect(evt.manifest_drive_file_id).toBeNull();
  });

  it('exportPendingEvents preserves document.accepted event_type', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    acceptDocument(docId);

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    const acceptedEvents = exported.filter(e => e.event_type === 'document.accepted');
    expect(acceptedEvents).toHaveLength(1);
    expect(acceptedEvents[0].status).toBe('accepted');
  });

  it('exportPendingEvents preserves document.rejected event_type', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, '25/2026');
    rejectDocument(docId, 'Inválido');

    db.prepare(`UPDATE ingestion_events SET exported_at = NULL WHERE document_id = ?`).run(docId);

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    if (existsSync(outboxPath)) rmSync(outboxPath);

    const exported = exportPendingEvents();
    const rejectedEvents = exported.filter(e => e.event_type === 'document.rejected');
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0].status).toBe('rejected');
  });

  it('report shows accepted and rejected counts', () => {
    const db = getDb();
    const doc1 = seedAssignedDoc(db, '25/2026');
    const doc2 = seedPendingDoc(db, { gmailMessageId: 'msg-acc-seed-2' });
    linkDocumentToPedido(doc2, '50/2026');
    acceptDocument(doc1);
    rejectDocument(doc2);

    const report = generateReport();
    expect(report.documentsAccepted).toBe(1);
    expect(report.documentsRejected).toBe(1);
    expect(report.documentsByStatus.accepted).toBe(1);
    expect(report.documentsByStatus.rejected).toBe(1);
    expect(report.documentsByStatus.assigned).toBeUndefined();
  });

  it('link local-only still works alongside accept/reject', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const linkResult = linkDocumentToPedido(docId, '25/2026');
    expect(linkResult.pedidoManual).toBe('PED-25-2026');

    const acceptResult = acceptDocument(docId);
    expect(acceptResult.status).toBe('accepted');
  });

  it('document found by gmail message id can be accepted', () => {
    const db = getDb();
    seedAssignedDoc(db, '25/2026');
    const result = acceptDocument('msg-acc-seed');
    expect(result.status).toBe('accepted');
  });
});
