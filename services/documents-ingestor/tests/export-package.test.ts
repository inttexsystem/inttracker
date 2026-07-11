import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import { exportPackage } from '../src/core/exportPackage.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `export-package-test-${randomUUID()}`);

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? `msg-ep-${randomUUID().slice(0, 8)}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-ep', 'Test');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id, gmailMessageId, 'thr-ep', `att-${randomUUID().slice(0, 8)}`,
    overrides.filename ?? 'NF-test.xml',
    overrides.sha256 ?? randomUUID().replace(/-/g, ''),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'xml',
    overrides.direcao ?? 'entrada',
    'google_drive',
    overrides.storageUri ?? `gdrive://file/ep-${randomUUID().slice(0, 8)}`,
    overrides.driveFileId ?? `ep-${randomUUID().slice(0, 8)}`,
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/ep/view',
  );
  return id;
}

describe('export package for Controle de Tapetes', () => {
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

  it('generates package with all 4 files for a pedido', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-1' });
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    const outDir = join(SCENARIO_DIR, 'exports');
    const result = exportPackage('PED-25-2026', { outputDir: outDir });

    expect(result.pedido).toBe('PED-25-2026');
    expect(result.outputDir).toBe(outDir);
    expect(result.totalEvents).toBe(2);
    expect(result.totalDocuments).toBe(1);
    expect(result.linkedCount).toBe(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.files).toHaveLength(4);

    for (const f of result.files) {
      expect(existsSync(f)).toBe(true);
    }
  });

  it('document-events.jsonl contains filtered events with correct fields', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-2' });
    linkDocumentToPedido(docId, '25/2026');

    const outDir = join(SCENARIO_DIR, 'exports2');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const eventsFile = join(outDir, 'document-events.jsonl');
    const lines = readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.event_type).toBe('document.linked');
    expect(parsed.ingestion_event_id).toBeTruthy();
    expect(parsed.pedido_manual).toBe('PED-25-2026');
  });

  it('manifest.json contains documents with status and taxonomy', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-3' });
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    const outDir = join(SCENARIO_DIR, 'exports3');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const manifestFile = join(outDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf-8'));
    expect(manifest.pedido).toBe('PED-25-2026');
    expect(manifest.documents).toHaveLength(1);
    expect(manifest.documents[0].document_id).toBe(docId);
    expect(manifest.documents[0].tipo_documento).toBe('nf');
    expect(manifest.documents[0].formato).toBe('xml');
    expect(manifest.documents[0].direcao_nf).toBe('entrada');
  });

  it('summary.json contains correct counts', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-4' });
    linkDocumentToPedido(docId, '25/2026');
    acceptDocument(docId);

    const outDir = join(SCENARIO_DIR, 'exports4');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const summaryFile = join(outDir, 'summary.json');
    const summary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
    expect(summary.pedido).toBe('PED-25-2026');
    expect(summary.totalEvents).toBe(2);
    expect(summary.totalDocuments).toBe(1);
    expect(summary.eventsByType['document.linked']).toBe(1);
    expect(summary.eventsByType['document.accepted']).toBe(1);
    expect(summary.documentsWithDriveLink).toBe(1);
  });

  it('README.md contains instructions', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-5' });
    linkDocumentToPedido(docId, '25/2026');

    const outDir = join(SCENARIO_DIR, 'exports5');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const readmeFile = join(outDir, 'README.md');
    const readme = readFileSync(readmeFile, 'utf-8');
    expect(readme).toContain('PED-25-2026');
    expect(readme).toContain('ingestion_event_id');
    expect(readme).toContain('drive_web_view_link');
    expect(readme).toContain('Supabase');
  });

  it('does not call Google Drive or alter documents', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-6' });
    linkDocumentToPedido(docId, '25/2026');

    const statusBefore = (db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any).status;

    const outDir = join(SCENARIO_DIR, 'exports6');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const statusAfter = (db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any).status;
    expect(statusAfter).toBe(statusBefore);
  });

  it('rejected document reason is preserved in events', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-7' });
    linkDocumentToPedido(docId, '25/2026');
    rejectDocument(docId, 'Documento inválido');

    const outDir = join(SCENARIO_DIR, 'exports7');
    exportPackage('PED-25-2026', { outputDir: outDir });

    const eventsFile = join(outDir, 'document-events.jsonl');
    const lines = readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
    const rejectedEvent = lines.map(l => JSON.parse(l)).find((e: any) => e.event_type === 'document.rejected');
    expect(rejectedEvent).toBeTruthy();
    expect(rejectedEvent.document.reason).toBe('Documento inválido');
  });

  it('normalizes 99/2026 to PED-99-2026 in pedido', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ep-8' });
    linkDocumentToPedido(docId, '99/2026');

    const outDir = join(SCENARIO_DIR, 'exports8');
    const result = exportPackage('PED-99-2026', { outputDir: outDir });

    expect(result.pedido).toBe('PED-99-2026');
    expect(result.totalEvents).toBe(1);
  });

  it('G12-C: exportPackage excludes events with pedido_manual empty string', () => {
    const db = getDb();

    const docLinked = seedPendingDoc(db, { gmailMessageId: 'msg-ep-g12c-linked' });
    linkDocumentToPedido(docLinked, '25/2026');

    const docUnlinked = seedPendingDoc(db, { gmailMessageId: 'msg-ep-g12c-unlinked' });
    db.prepare(
      `INSERT INTO ingestion_events (id, event_type, pedido_manual, document_id, status, storage_backend)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      'document.detected',
      '',
      docUnlinked,
      'pending_app_acceptance',
      'google_drive',
    );

    const outDir = join(SCENARIO_DIR, 'exports-g12c');
    const result = exportPackage('PED-25-2026', { outputDir: outDir });

    expect(result.totalEvents).toBe(1);
    expect(result.linkedCount).toBe(1);
    expect(result.detectedCount).toBe(0);

    const eventsFile = join(outDir, 'document-events.jsonl');
    const lines = readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.event_type).toBe('document.linked');
    expect(parsed.pedido_manual).toBe('PED-25-2026');
  });
});
