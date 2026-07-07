import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `link-test-${randomUUID()}`);

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? 'msg-link-seed';
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-link-seed', 'Test Subject');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id,
    gmailMessageId,
    'thr-link-seed',
    'att-link-seed',
    overrides.filename ?? 'NF-test.pdf',
    overrides.sha256 ?? 'a'.repeat(64),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'pdf',
    overrides.direcao ?? null,
    'google_drive',
    overrides.storageUri ?? 'gdrive://file/drive-seed',
    overrides.driveFileId ?? 'drive-seed',
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/drive-seed/view',
  );
  return id;
}

function seedAssignedDoc(database: any, pedido: string, docId?: string): string {
  const id = seedPendingDoc(database, { id: docId ?? undefined });
  database.prepare(
    `UPDATE documentos SET status = 'assigned', pedido_manual = ? WHERE id = ?`
  ).run(pedido, id);
  return id;
}

describe('link document to pedido (local-only)', () => {
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

  it('links a pending document to a pedido', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const result = linkDocumentToPedido(docId, '25/2026');

    expect(result.documentId).toBe(docId);
    expect(result.pedidoManual).toBe('PED-25-2026');
    expect(result.eventId).toBeTruthy();

    const doc = db.prepare(`SELECT status, pedido_manual, updated_at FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.status).toBe('assigned');
    expect(doc.pedido_manual).toBe('PED-25-2026');

    const evt = db.prepare(`SELECT * FROM ingestion_events WHERE document_id = ?`).get(docId) as any;
    expect(evt).toBeTruthy();
    expect(evt.event_type).toBe('document.linked');
    expect(evt.pedido_manual).toBe('PED-25-2026');
    expect(evt.status).toBe('pending_app_acceptance');
  });

  it('writes event to outbox JSONL', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const result = linkDocumentToPedido(docId, '25/2026');

    const outboxPath = join(SCENARIO_DIR, 'outbox.jsonl');
    expect(existsSync(outboxPath)).toBe(true);
    const lines = readFileSync(outboxPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.event_type).toBe('document.linked');
    expect(parsed.event_id).toBe(result.eventId);
    expect(parsed.pedido_manual).toBe('PED-25-2026');
    expect(parsed.status).toBe('pending_app_acceptance');
    expect(parsed.document.document_id).toBe(docId);
  });

  it('does not call Google Drive (no Drive deps, no manifest, no move)', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const result = linkDocumentToPedido(docId, '25/2026');
    expect(result).toBeTruthy();

    const doc = db.prepare(`SELECT storage_uri, drive_file_id, drive_folder_id FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.storage_uri).toBe('gdrive://file/drive-seed');
    expect(doc.drive_file_id).toBe('drive-seed');

    const evt = db.prepare(`SELECT manifest_storage_uri, manifest_drive_file_id FROM ingestion_events WHERE document_id = ?`).get(docId) as any;
    expect(evt.manifest_storage_uri).toBeNull();
    expect(evt.manifest_drive_file_id).toBeNull();
  });

  it('does not require --confirm-real-google (always local)', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const result = linkDocumentToPedido(docId, '50/2026');
    expect(result.pedidoManual).toBe('PED-50-2026');
  });

  it('fails for non-existent document', () => {
    expect(() => linkDocumentToPedido('nonexistent-id', '25/2026')).toThrow('Document not found');
  });

  it('fails for invalid pedido format', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    expect(() => linkDocumentToPedido(docId, 'lalala')).toThrow('Invalid pedido format');
  });

  it('is idempotent: linking same document to same pedido returns success without duplicate', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    const r1 = linkDocumentToPedido(docId, '25/2026');
    expect(r1.eventId).toBeTruthy();

    const r2 = linkDocumentToPedido(docId, '25/2026');
    expect(r2.documentId).toBe(docId);
    expect(r2.pedidoManual).toBe('PED-25-2026');

    const events = db.prepare(`SELECT * FROM ingestion_events WHERE document_id = ?`).all(docId);
    expect(events).toHaveLength(1);
  });

  it('blocks linking to a different pedido when already linked', () => {
    const db = getDb();
    const docId = seedAssignedDoc(db, 'PED-25-2026');
    expect(() => linkDocumentToPedido(docId, '50/2026')).toThrow(/already linked/);
  });

  it('blocks linking a document that is already accepted', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    db.prepare(`UPDATE documentos SET status = 'accepted', pedido_manual = ? WHERE id = ?`).run('PED-01-2026', docId);
    expect(() => linkDocumentToPedido(docId, '50/2026')).toThrow(/already linked/);
  });

  it('blocks linking a document that is already rejected', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    db.prepare(`UPDATE documentos SET status = 'rejected', pedido_manual = ? WHERE id = ?`).run('PED-01-2026', docId);
    expect(() => linkDocumentToPedido(docId, '50/2026')).toThrow(/already linked/);
  });

  it('preserves existing Drive references after link', () => {
    const db = getDb();
    const docId = seedPendingDoc(db);
    linkDocumentToPedido(docId, '25/2026');

    const doc = db.prepare(`SELECT drive_file_id, storage_uri, drive_web_view_link FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.drive_file_id).toBe('drive-seed');
    expect(doc.storage_uri).toBe('gdrive://file/drive-seed');
    expect(doc.drive_web_view_link).toBe('https://drive.google.com/file/d/drive-seed/view');
  });

  it('links document found by gmail message id', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-specific' });
    const result = linkDocumentToPedido('msg-specific', '25/2026');
    expect(result.documentId).toBe(docId);
  });
});
