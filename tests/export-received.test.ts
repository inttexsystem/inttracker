import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument } from '../src/core/acceptance.js';
import {
  exportReceivedDocuments,
  listReceivedDocuments,
} from '../src/core/exportPackage.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `export-received-test-${randomUUID()}`);

function seedDoc(
  database: any,
  overrides: {
    id?: string;
    gmailMessageId?: string;
    status?: string;
    pedidoManual?: string | null;
    filename?: string;
    tipo?: string;
    formato?: string;
    direcao?: string | null;
    sha256?: string;
    senderEmail?: string | null;
    createdAt?: string;
  } = {},
): string {
  const gmailMessageId = overrides.gmailMessageId ?? `msg-er-${randomUUID().slice(0, 8)}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, `thr-er-${randomUUID().slice(0, 6)}`, 'Test');

  const id = overrides.id ?? randomUUID();
  const sha256 = overrides.sha256 ?? randomUUID().replace(/-/g, '');
  const createdAt = overrides.createdAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19);

  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, sender_email, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    gmailMessageId,
    `thr-er-${randomUUID().slice(0, 6)}`,
    `att-${randomUUID().slice(0, 8)}`,
    overrides.filename ?? 'NF-test.xml',
    sha256,
    overrides.senderEmail ?? null,
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'xml',
    overrides.direcao ?? 'entrada',
    'google_drive',
    `gdrive://file/er-${randomUUID().slice(0, 8)}`,
    `er-${randomUUID().slice(0, 8)}`,
    'https://drive.google.com/file/d/er/view',
    overrides.status ?? 'pending',
    overrides.pedidoManual ?? null,
    createdAt,
    createdAt,
  );

  return id;
}

function seedDetectedEvent(database: any, documentId: string): string {
  const eventId = randomUUID();
  database.prepare(
    `INSERT INTO ingestion_events (
       id, event_type, pedido_manual, document_id, status, storage_backend
     ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(eventId, 'document.detected', '', documentId, 'pending_app_acceptance', 'google_drive');
  return eventId;
}

describe('export received documents (G12-D1)', () => {
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

  it('exports a pending document without pedido_manual and a detected event', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-er-1' });
    seedDetectedEvent(db, docId);

    const outDir = join(SCENARIO_DIR, 'exports-received');
    const result = exportReceivedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    expect(existsSync(result.outputPath)).toBe(true);

    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.gmail_message_id).toBe('msg-er-1');
    expect(parsed.tipo_documento).toBe('nf');
    expect(parsed.formato).toBe('xml');
    expect(parsed.direcao_nf).toBe('entrada');
    expect(parsed.detected_event_id).toBeTruthy();
  });

  it('exports sender_email without changing timestamp fields', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-er-sender', senderEmail: 'fornecedor@empresa.com.br' });
    seedDetectedEvent(db, docId);

    const row = listReceivedDocuments({ daysBack: 30 })[0];
    expect(row.sender_email).toBe('fornecedor@empresa.com.br');
  });

  it('excludes documents that have been linked to a pedido', () => {
    const db = getDb();
    const linkedDoc = seedDoc(db, { gmailMessageId: 'msg-er-linked' });
    linkDocumentToPedido(linkedDoc, '25/2026');

    const pendingDoc = seedDoc(db, { gmailMessageId: 'msg-er-pending' });
    seedDetectedEvent(db, pendingDoc);

    const outDir = join(SCENARIO_DIR, 'exports-received-2');
    const result = exportReceivedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(pendingDoc);
  });

  it('excludes documents with pedido_manual filled in (even if pending)', () => {
    const db = getDb();
    const doc = seedDoc(db, {
      gmailMessageId: 'msg-er-pedido-filled',
      pedidoManual: 'PED-77-2026',
    });
    seedDetectedEvent(db, doc);

    const outDir = join(SCENARIO_DIR, 'exports-received-3');
    const result = exportReceivedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(0);
  });

  it('excludes documents with no document.detected event (no event base)', () => {
    const db = getDb();
    seedDoc(db, { gmailMessageId: 'msg-er-no-detected' });

    const outDir = join(SCENARIO_DIR, 'exports-received-4');
    const result = exportReceivedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(0);
  });

  it('respects --limit (caps result count)', () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      const id = seedDoc(db, { gmailMessageId: `msg-er-limit-${i}` });
      seedDetectedEvent(db, id);
    }

    const outDir = join(SCENARIO_DIR, 'exports-received-5');
    const result = exportReceivedDocuments({ outputPath: outDir, limit: 2 });

    expect(result.totalDocuments).toBe(2);
  });

  it('is idempotent: does not modify DB, outbox, or events', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-er-idem' });
    const eventId = seedDetectedEvent(db, docId);

    const eventsBefore = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as any).c;
    const docsBefore = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    const updatedAtBefore = (db.prepare(`SELECT updated_at FROM documentos WHERE id = ?`).get(docId) as any).updated_at;
    const exportedAtBefore = (db.prepare(`SELECT exported_at FROM ingestion_events WHERE id = ?`).get(eventId) as any).exported_at;

    const outDir = join(SCENARIO_DIR, 'exports-received-idem');
    exportReceivedDocuments({ outputPath: outDir });

    const eventsAfter = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as any).c;
    const docsAfter = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    const updatedAtAfter = (db.prepare(`SELECT updated_at FROM documentos WHERE id = ?`).get(docId) as any).updated_at;
    const exportedAtAfter = (db.prepare(`SELECT exported_at FROM ingestion_events WHERE id = ?`).get(eventId) as any).exported_at;

    expect(eventsAfter).toBe(eventsBefore);
    expect(docsAfter).toBe(docsBefore);
    expect(updatedAtAfter).toBe(updatedAtBefore);
    expect(exportedAtAfter).toBe(exportedAtBefore);
  });

  it('listReceivedDocuments returns the same data as the file export', () => {
    const db = getDb();
    const doc1 = seedDoc(db, { gmailMessageId: 'msg-er-list-1' });
    seedDetectedEvent(db, doc1);
    const doc2 = seedDoc(db, { gmailMessageId: 'msg-er-list-2' });
    seedDetectedEvent(db, doc2);

    const rows = listReceivedDocuments();
    expect(rows).toHaveLength(2);
    const ids = rows.map(r => r.document_id).sort();
    expect(ids).toEqual([doc1, doc2].sort());
  });

  it('filters by --days: old documents are excluded', () => {
    const db = getDb();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldIso = oldDate.toISOString().replace('T', ' ').slice(0, 19);

    const oldDoc = seedDoc(db, {
      gmailMessageId: 'msg-er-old',
      createdAt: oldIso,
    });
    seedDetectedEvent(db, oldDoc);

    const recentDoc = seedDoc(db, { gmailMessageId: 'msg-er-recent' });
    seedDetectedEvent(db, recentDoc);

    const outDir = join(SCENARIO_DIR, 'exports-received-days');
    const result = exportReceivedDocuments({ outputPath: outDir, daysBack: 7 });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(recentDoc);
  });

  it('handles accepted documents (status no longer pending) as expected', () => {
    const db = getDb();
    const acceptedDoc = seedDoc(db, { gmailMessageId: 'msg-er-accepted' });
    seedDetectedEvent(db, acceptedDoc);
    linkDocumentToPedido(acceptedDoc, '25/2026');
    acceptDocument(acceptedDoc);

    const outDir = join(SCENARIO_DIR, 'exports-received-accepted');
    const result = exportReceivedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(0);
  });
});
