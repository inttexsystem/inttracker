import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { linkDocumentToPedido } from '../src/core/link.js';
import { acceptDocument, rejectDocument } from '../src/core/acceptance.js';
import { buildManifestFromDb, exportManifest, syncManifest } from '../src/core/syncManifest.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `manifest-sync-test-${randomUUID()}`);

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? `msg-ms-${randomUUID().slice(0, 8)}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, 'thr-ms', 'Test');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id,
       drive_web_view_link, status, pedido_manual
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`
  ).run(
    id, gmailMessageId, 'thr-ms', `att-${randomUUID().slice(0, 8)}`,
    overrides.filename ?? 'NF-test.xml',
    overrides.sha256 ?? randomUUID().replace(/-/g, ''),
    overrides.tipo ?? 'nf',
    overrides.formato ?? 'xml',
    overrides.direcao ?? 'entrada',
    'google_drive',
    overrides.storageUri ?? `gdrive://file/ms-${randomUUID().slice(0, 8)}`,
    overrides.driveFileId ?? `ms-${randomUUID().slice(0, 8)}`,
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/ms/view',
  );
  return id;
}

describe('manifest local export and sync scaffold', () => {
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

  it('buildManifestFromDb returns manifest with pending docs', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-1' });
    linkDocumentToPedido(docId, '25/2026');

    const manifest = buildManifestFromDb('PED-25-2026');
    expect(manifest.pedido).toBe('PED-25-2026');
    expect(manifest.documents).toHaveLength(1);
    expect(manifest.documents[0].document_id).toBe(docId);
    expect(manifest.documents[0].tipo_documento).toBe('nf');
    expect(manifest.documents[0].filename_original).toBe('NF-test.xml');
  });

  it('buildManifestFromDb includes accepted and rejected docs', () => {
    const db = getDb();
    const docId1 = seedPendingDoc(db, { gmailMessageId: 'msg-ms-acc' });
    const docId2 = seedPendingDoc(db, { gmailMessageId: 'msg-ms-rej' });
    linkDocumentToPedido(docId1, '25/2026');
    linkDocumentToPedido(docId2, '25/2026');
    acceptDocument(docId1);
    rejectDocument(docId2, 'Invalido');

    const manifest = buildManifestFromDb('PED-25-2026');
    expect(manifest.documents).toHaveLength(2);
  });

  it('exportManifest returns same as buildManifestFromDb', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-2' });
    linkDocumentToPedido(docId, '25/2026');

    const manifest = exportManifest('PED-25-2026');
    expect(manifest.pedido).toBe('PED-25-2026');
    expect(manifest.documents).toHaveLength(1);
  });

  it('exportManifest does not call Drive (hermetic)', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-3' });
    linkDocumentToPedido(docId, '25/2026');

    const manifest = exportManifest('PED-25-2026');
    expect(manifest.documents).toHaveLength(1);
    expect(manifest.documents[0].drive_file_id).toMatch(/^ms-/);
  });

  it('syncManifest returns dry-run by default', async () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-4' });
    linkDocumentToPedido(docId, '25/2026');

    const result = await syncManifest('PED-25-2026');
    expect(result.dryRun).toBe(true);
    expect(result.driveSyncApplied).toBe(false);
    expect(result.documentCount).toBe(1);
  });

  it('syncManifest without confirmRealGoogle does not call Drive', async () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-5' });
    linkDocumentToPedido(docId, '25/2026');

    const result = await syncManifest('PED-25-2026', { confirmRealGoogle: false });
    expect(result.dryRun).toBe(true);
    expect(result.driveSyncApplied).toBe(false);
  });

  it('syncManifest with confirmRealGoogle returns stub (hermetic, no real Drive)', async () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-6' });
    linkDocumentToPedido(docId, '25/2026');

    const result = await syncManifest('PED-25-2026', { confirmRealGoogle: true });
    expect(result.dryRun).toBe(false);
    expect(result.driveSyncApplied).toBe(true);
    expect(result.driveFileId).toBeTruthy();
    expect(result.storageUri).toBeTruthy();
  });

  it('manifest does not alter documentos status', () => {
    const db = getDb();
    const docId = seedPendingDoc(db, { gmailMessageId: 'msg-ms-7' });
    linkDocumentToPedido(docId, '25/2026');

    const statusBefore = (db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any).status;
    expect(statusBefore).toBe('assigned');

    exportManifest('PED-25-2026');

    const statusAfter = (db.prepare(`SELECT status FROM documentos WHERE id = ?`).get(docId) as any).status;
    expect(statusAfter).toBe('assigned');
  });
});
