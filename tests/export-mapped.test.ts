import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import {
  exportMappedDocuments,
  listMappedDocuments,
} from '../src/core/exportPackage.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `export-mapped-test-${randomUUID()}`);

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
    createdAt?: string;
  } = {},
): string {
  const gmailMessageId = overrides.gmailMessageId ?? `msg-em-${randomUUID().slice(0, 8)}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, `thr-em-${randomUUID().slice(0, 6)}`, 'Test');

  const id = overrides.id ?? randomUUID();
  const sha256 = overrides.sha256 ?? randomUUID().replace(/-/g, '');
  const createdAt = overrides.createdAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19);

  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    gmailMessageId,
    `thr-em-${randomUUID().slice(0, 6)}`,
    `att-${randomUUID().slice(0, 8)}`,
    overrides.filename ?? 'NF-test.xml',
    sha256,
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'xml',
    overrides.direcao ?? 'entrada',
    'google_drive',
    `gdrive://file/em-${randomUUID().slice(0, 8)}`,
    `em-${randomUUID().slice(0, 8)}`,
    'https://drive.google.com/file/d/em/view',
    overrides.status ?? 'pending',
    overrides.pedidoManual ?? null,
    createdAt,
    createdAt,
  );

  return id;
}

function seedEvent(
  database: any,
  documentId: string,
  eventType: 'document.detected' | 'document.linked' | 'document.accepted' | 'document.rejected',
  overrides: { pedidoManual?: string | null; status?: string; reason?: string | null; createdAt?: string } = {},
): string {
  const eventId = randomUUID();
  database.prepare(
    `INSERT INTO ingestion_events (
       id, event_type, pedido_manual, document_id, status, storage_backend, reason, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    eventType,
    overrides.pedidoManual ?? (eventType === 'document.detected' ? '' : `PED-25-2026`),
    documentId,
    overrides.status ?? (
      eventType === 'document.detected' || eventType === 'document.linked' ? 'pending_app_acceptance' :
      eventType === 'document.accepted' ? 'accepted' : 'rejected'
    ),
    'google_drive',
    overrides.reason ?? null,
    overrides.createdAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
  );
  return eventId;
}

describe('export mapped documents (G12-E2)', () => {
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

  it('exports a pending document without pedido_manual', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-pending' });
    seedEvent(db, docId, 'document.detected');

    const outDir = join(SCENARIO_DIR, 'mapped-pending.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.status).toBe('pending');
    expect(parsed.pedido_manual).toBeNull();
    expect(parsed.detected_at).toBeTruthy();
    expect(parsed.linked_at).toBeNull();
    expect(parsed.accepted_at).toBeNull();
    expect(parsed.rejected_at).toBeNull();
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.latest_ingestion_event_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(parsed.detected_ingestion_event_id).toBeTruthy();
    expect(parsed.linked_ingestion_event_id).toBeNull();
    expect(parsed.accepted_ingestion_event_id).toBeNull();
    expect(parsed.rejected_ingestion_event_id).toBeNull();
  });

  it('exports an assigned document with pedido_manual', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-assigned', status: 'assigned', pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026' });

    const outDir = join(SCENARIO_DIR, 'mapped-assigned.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.status).toBe('assigned');
    expect(parsed.pedido_manual).toBe('PED-25-2026');
    expect(parsed.detected_at).toBeTruthy();
    expect(parsed.linked_at).toBeTruthy();
    expect(parsed.accepted_at).toBeNull();
    expect(parsed.rejected_at).toBeNull();
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.detected_ingestion_event_id).toBeTruthy();
    expect(parsed.linked_ingestion_event_id).toBeTruthy();
    expect(parsed.accepted_ingestion_event_id).toBeNull();
    expect(parsed.rejected_ingestion_event_id).toBeNull();
  });

  it('exports an accepted document with accepted_at populated', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-accepted', status: 'accepted', pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.accepted', { pedidoManual: 'PED-25-2026', status: 'accepted' });

    const outDir = join(SCENARIO_DIR, 'mapped-accepted.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.status).toBe('accepted');
    expect(parsed.pedido_manual).toBe('PED-25-2026');
    expect(parsed.accepted_at).toBeTruthy();
    expect(parsed.rejected_at).toBeNull();
    expect(parsed.rejected_reason).toBeNull();
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.detected_ingestion_event_id).toBeTruthy();
    expect(parsed.linked_ingestion_event_id).toBeTruthy();
    expect(parsed.accepted_ingestion_event_id).toBeTruthy();
    expect(parsed.rejected_ingestion_event_id).toBeNull();
  });

  it('exports a rejected document with rejected_at and rejected_reason', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-rejected', status: 'rejected', pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.rejected', {
      pedidoManual: 'PED-25-2026',
      status: 'rejected',
      reason: 'Documento duplicado',
    });

    const outDir = join(SCENARIO_DIR, 'mapped-rejected.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.status).toBe('rejected');
    expect(parsed.rejected_at).toBeTruthy();
    expect(parsed.rejected_reason).toBe('Documento duplicado');
    expect(parsed.accepted_at).toBeNull();
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.detected_ingestion_event_id).toBeTruthy();
    expect(parsed.linked_ingestion_event_id).toBeTruthy();
    expect(parsed.accepted_ingestion_event_id).toBeNull();
    expect(parsed.rejected_ingestion_event_id).toBeTruthy();
  });

  it('non-applicable fields are null', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-pending-only' });
    seedEvent(db, docId, 'document.detected');

    const rows = listMappedDocuments();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.linked_at).toBeNull();
    expect(row.accepted_at).toBeNull();
    expect(row.rejected_at).toBeNull();
    expect(row.rejected_reason).toBeNull();
    expect(row.received_at).toBeTruthy();
    expect(row.detected_at).toBeTruthy();
    expect(row.linked_ingestion_event_id).toBeNull();
    expect(row.accepted_ingestion_event_id).toBeNull();
    expect(row.rejected_ingestion_event_id).toBeNull();
    expect(row.detected_ingestion_event_id).toBeTruthy();
    expect(row.latest_ingestion_event_id).toBeTruthy();
  });

  it('every line has schema_version: 1', () => {
    const db = getDb();
    const doc1 = seedDoc(db, { gmailMessageId: 'msg-em-sv-1' });
    seedEvent(db, doc1, 'document.detected');
    const doc2 = seedDoc(db, { gmailMessageId: 'msg-em-sv-2', status: 'accepted', pedidoManual: 'PED-25-2026' });
    seedEvent(db, doc2, 'document.detected');
    seedEvent(db, doc2, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, doc2, 'document.accepted', { pedidoManual: 'PED-25-2026', status: 'accepted' });

    const outDir = join(SCENARIO_DIR, 'mapped-schema-version.jsonl');
    exportMappedDocuments({ outputPath: outDir });

    const lines = readFileSync(outDir, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.schema_version).toBe(1);
    }
  });

  it('filters by --status', () => {
    const db = getDb();
    const pending = seedDoc(db, { gmailMessageId: 'msg-em-st-pending' });
    seedEvent(db, pending, 'document.detected');
    const accepted = seedDoc(db, { gmailMessageId: 'msg-em-st-accepted', status: 'accepted', pedidoManual: 'PED-25-2026' });
    seedEvent(db, accepted, 'document.detected');
    seedEvent(db, accepted, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, accepted, 'document.accepted', { pedidoManual: 'PED-25-2026', status: 'accepted' });
    const rejected = seedDoc(db, { gmailMessageId: 'msg-em-st-rejected', status: 'rejected', pedidoManual: 'PED-25-2026' });
    seedEvent(db, rejected, 'document.detected');
    seedEvent(db, rejected, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, rejected, 'document.rejected', { pedidoManual: 'PED-25-2026', status: 'rejected' });

    const outDir = join(SCENARIO_DIR, 'mapped-status-filter.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir, status: 'accepted' });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(accepted);
    expect(parsed.status).toBe('accepted');
  });

  it('filters by --days', () => {
    const db = getDb();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldIso = oldDate.toISOString().replace('T', ' ').slice(0, 19);
    const oldDoc = seedDoc(db, { gmailMessageId: 'msg-em-days-old', createdAt: oldIso });
    seedEvent(db, oldDoc, 'document.detected', { createdAt: oldIso });
    const recentDoc = seedDoc(db, { gmailMessageId: 'msg-em-days-recent' });
    seedEvent(db, recentDoc, 'document.detected');

    const outDir = join(SCENARIO_DIR, 'mapped-days.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir, daysBack: 7 });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(recentDoc);
  });

  it('respects --limit', () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      const id = seedDoc(db, { gmailMessageId: `msg-em-limit-${i}` });
      seedEvent(db, id, 'document.detected');
    }

    const outDir = join(SCENARIO_DIR, 'mapped-limit.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir, limit: 2 });

    expect(result.totalDocuments).toBe(2);
  });

  it('is idempotent: does not modify DB, outbox, or events', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-idem' });
    const eventId = seedEvent(db, docId, 'document.detected');

    const eventsBefore = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as any).c;
    const docsBefore = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    const updatedAtBefore = (db.prepare(`SELECT updated_at FROM documentos WHERE id = ?`).get(docId) as any).updated_at;
    const exportedAtBefore = (db.prepare(`SELECT exported_at FROM ingestion_events WHERE id = ?`).get(eventId) as any).exported_at;

    const outDir = join(SCENARIO_DIR, 'mapped-idem.jsonl');
    exportMappedDocuments({ outputPath: outDir });

    const eventsAfter = (db.prepare(`SELECT COUNT(*) AS c FROM ingestion_events`).get() as any).c;
    const docsAfter = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    const updatedAtAfter = (db.prepare(`SELECT updated_at FROM documentos WHERE id = ?`).get(docId) as any).updated_at;
    const exportedAtAfter = (db.prepare(`SELECT exported_at FROM ingestion_events WHERE id = ?`).get(eventId) as any).exported_at;

    expect(eventsAfter).toBe(eventsBefore);
    expect(docsAfter).toBe(docsBefore);
    expect(updatedAtAfter).toBe(updatedAtBefore);
    expect(exportedAtAfter).toBe(exportedAtBefore);
  });

  it('duplicate events of the same type do not duplicate documents in the export', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-dup' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.detected');

    const outDir = join(SCENARIO_DIR, 'mapped-dup.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.document_id).toBe(docId);
    expect(parsed.detected_at).toBeTruthy();
  });

  it('integrates with link/accept flow correctly', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-flow' });
    seedEvent(db, docId, 'document.detected');
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    const outDir = join(SCENARIO_DIR, 'mapped-flow.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.status).toBe('accepted');
    expect(parsed.pedido_manual).toBe('PED-25-2026');
    expect(parsed.detected_at).toBeTruthy();
    expect(parsed.linked_at).toBeTruthy();
    expect(parsed.accepted_at).toBeTruthy();
    expect(parsed.rejected_at).toBeNull();
  });

  it('integrates with link/reject flow correctly', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-flow-rej' });
    seedEvent(db, docId, 'document.detected');
    linkDocumentToPedido(docId, '25/2026');
    rejectDocument(docId, 'Documento inválido');

    const outDir = join(SCENARIO_DIR, 'mapped-flow-rej.jsonl');
    const result = exportMappedDocuments({ outputPath: outDir });

    expect(result.totalDocuments).toBe(1);
    const lines = readFileSync(result.outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.status).toBe('rejected');
    expect(parsed.pedido_manual).toBe('PED-25-2026');
    expect(parsed.rejected_at).toBeTruthy();
    expect(parsed.rejected_reason).toBe('Documento inválido');
    expect(parsed.accepted_at).toBeNull();
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.rejected_ingestion_event_id).toBeTruthy();
    expect(parsed.accepted_ingestion_event_id).toBeNull();
  });

  it('latest_ingestion_event_id corresponds to the most recent event', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-latest-id' });
    const t1 = '2026-07-01 10:00:00';
    const t2 = '2026-07-01 10:01:00';
    const t3 = '2026-07-01 10:02:00';
    seedEvent(db, docId, 'document.detected', { createdAt: t1 });
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026', createdAt: t2 });
    seedEvent(db, docId, 'document.accepted', { pedidoManual: 'PED-25-2026', status: 'accepted', createdAt: t3 });

    const rows = listMappedDocuments();
    expect(rows).toHaveLength(1);
    const row = rows[0];

    const latestId = row.latest_ingestion_event_id;
    expect(latestId).toBeTruthy();
    expect(latestId).toBe(row.accepted_ingestion_event_id);
    expect(latestId).not.toBe(row.detected_ingestion_event_id);
    expect(latestId).not.toBe(row.linked_ingestion_event_id);
  });

  it('ingestion event IDs are null when no events exist for a document', () => {
    const db = getDb();
    seedDoc(db, { gmailMessageId: 'msg-em-no-events' });

    const rows = listMappedDocuments();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.latest_ingestion_event_id).toBeNull();
    expect(row.detected_ingestion_event_id).toBeNull();
    expect(row.linked_ingestion_event_id).toBeNull();
    expect(row.accepted_ingestion_event_id).toBeNull();
    expect(row.rejected_ingestion_event_id).toBeNull();
  });

  it('ingestion event IDs use UUID format and are distinct across event types', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-uuid-format' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026' });
    seedEvent(db, docId, 'document.accepted', { pedidoManual: 'PED-25-2026', status: 'accepted' });

    const rows = listMappedDocuments();
    expect(rows).toHaveLength(1);
    const row = rows[0];

    const uuidRe = /^[a-f0-9-]{36}$/;
    expect(row.latest_ingestion_event_id).toMatch(uuidRe);
    expect(row.detected_ingestion_event_id).toMatch(uuidRe);
    expect(row.linked_ingestion_event_id).toMatch(uuidRe);
    expect(row.accepted_ingestion_event_id).toMatch(uuidRe);
    expect(row.rejected_ingestion_event_id).toBeNull();

    expect(row.detected_ingestion_event_id).not.toBe(row.linked_ingestion_event_id);
    expect(row.linked_ingestion_event_id).not.toBe(row.accepted_ingestion_event_id);
    expect(row.accepted_ingestion_event_id).not.toBe(row.detected_ingestion_event_id);
  });

  it('schema_version remains 1 with new ingestion event ID fields present', () => {
    const db = getDb();
    const docId = seedDoc(db, { gmailMessageId: 'msg-em-sv-id' });
    seedEvent(db, docId, 'document.detected');
    seedEvent(db, docId, 'document.linked', { pedidoManual: 'PED-25-2026' });

    const outDir = join(SCENARIO_DIR, 'mapped-sv-id.jsonl');
    exportMappedDocuments({ outputPath: outDir });

    const lines = readFileSync(outDir, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.latest_ingestion_event_id).toBeTruthy();
    expect(parsed.detected_ingestion_event_id).toBeTruthy();
    expect(parsed.linked_ingestion_event_id).toBeTruthy();
  });
});
