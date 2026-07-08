import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssignPedido } from '../src/core/realAssign.js';
import type { AssignDeps } from '../src/core/realAssign.js';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { randomUUID } from 'node:crypto';

const DB_DIR = join(tmpdir(), `ravatex-assign-test-${randomUUID()}`);

function mkDeps(overrides: Partial<AssignDeps> = {}): AssignDeps {
  return {
    moveOrCopy: async ({ sourceFileId, destinationLogicalPath }) => ({
      storageUri: `gdrive://file/moved-${sourceFileId}`,
      driveFileId: `moved-${sourceFileId}`,
      driveFolderId: `folder-for-${destinationLogicalPath.split('/').pop()}`,
      driveWebViewLink: `https://drive.google.com/file/d/moved-${sourceFileId}/view`,
      driveWebContentLink: `https://drive.google.com/uc?id=moved-${sourceFileId}`,
    }),
    uploadManifest: async ({ pedido }) => ({
      storageUri: `gdrive://file/manifest-${pedido}`,
      driveFileId: `manifest-${pedido}`,
      driveWebViewLink: `https://drive.google.com/file/d/manifest-${pedido}/view`,
    }),
    ...overrides,
  };
}

function seedPendingDoc(database: any, overrides: any = {}): string {
  const gmailMessageId = overrides.gmailMessageId ?? 'msg-seed';
  const threadId = overrides.threadId ?? 'thr-seed';
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, threadId, '');

  const id = overrides.id ?? randomUUID();
  database.prepare(
    `INSERT INTO documentos (
       id, gmail_message_id, thread_id, attachment_id, filename_original,
       sha256, tipo_documento, formato, direcao_nf,
       storage_backend, storage_uri, drive_file_id, drive_folder_id,
       drive_web_view_link, drive_web_content_link, local_cache_path,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    gmailMessageId,
    threadId,
    overrides.attachmentId ?? 'att-seed',
    overrides.filename ?? 'NF-001.pdf',
    overrides.sha256 ?? 'a'.repeat(64),
    overrides.tipoDocumento ?? 'nf',
    overrides.formato ?? 'pdf',
    overrides.direcaoNf ?? null,
    'google_drive',
    overrides.storageUri ?? 'gdrive://file/seed-file',
    overrides.driveFileId ?? 'seed-file',
    overrides.driveFolderId ?? 'seed-folder',
    overrides.driveWebViewLink ?? 'https://drive.google.com/file/d/seed-file/view',
    overrides.driveWebContentLink ?? null,
    null,
  );
  return id;
}

describe('real assign flow (mocked Google)', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  it('rejects invalid pedido format', async () => {
    const assign = createAssignPedido(mkDeps());
    const r = await assign('any', 'lalala', { confirmReal: true });
    expect(r).toBeNull();
  });

  it('without confirmReal: returns null (no Drive call)', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database);
    let called = false;
    const deps = mkDeps({
      moveOrCopy: async () => { called = true; return { storageUri: 'x', driveFileId: 'x', driveWebViewLink: 'x' }; },
    });
    const assign = createAssignPedido(deps);
    const r = await assign(docId, '25/2026', { confirmReal: false });
    expect(r).toBeNull();
    expect(called).toBe(false);
  });

  it('real assign: moves in Drive, updates SQLite, appends outbox event', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database);
    const assign = createAssignPedido(mkDeps());
    const r = await assign(docId, '25/2026', { confirmReal: true });
    expect(r).not.toBeNull();
    expect(r!.pedidoManual).toBe('PED-25-2026');
    expect(r!.storageUri).toMatch(/^gdrive:\/\/file\//);
    expect(r!.manifestStorageUri).toMatch(/^gdrive:\/\/file\//);

    const doc = database.prepare(`SELECT * FROM documentos WHERE id = ?`).get(docId) as any;
    expect(doc.status).toBe('assigned');
    expect(doc.pedido_manual).toBe('PED-25-2026');
    expect(doc.storage_uri).toBe(r!.storageUri);

    const ev = database.prepare(`SELECT * FROM ingestion_events WHERE id = ?`).get(r!.eventId) as any;
    expect(ev).toBeTruthy();
    expect(ev.event_type).toBe('document.linked');
    expect(ev.pedido_manual).toBe('PED-25-2026');
    expect(ev.status).toBe('pending_app_acceptance');
    expect(ev.storage_uri).toBe(r!.storageUri);
    expect(ev.manifest_storage_uri).toBe(r!.manifestStorageUri);

    const outboxFile = join(DB_DIR, 'outbox.jsonl');
    expect(existsSync(outboxFile)).toBe(true);
    const line = readFileSync(outboxFile, 'utf-8').trim();
    const parsed = JSON.parse(line);
    expect(parsed.event_type).toBe('document.linked');
    expect(parsed.event_id).toBe(r!.eventId);
    expect(parsed.document.storage_uri).toBe(r!.storageUri);
    expect(parsed.document.manifest_storage_uri).toBe(r!.manifestStorageUri);
    expect(parsed.status).toBe('pending_app_acceptance');
  });

  it('real assign: idempotency on second call for same document', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database);
    const assign = createAssignPedido(mkDeps());
    const r1 = await assign(docId, '25/2026', { confirmReal: true });
    expect(r1).not.toBeNull();
    const r2 = await assign(docId, '25/2026', { confirmReal: true });
    expect(r2).toBeNull();
    const evs = database.prepare(`SELECT * FROM ingestion_events`).all();
    expect(evs).toHaveLength(1);
  });

  it('real assign: normalizes pedido PED-25-2026 to canonical form', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database);
    const assign = createAssignPedido(mkDeps());
    const r = await assign(docId, 'PED-25-2026', { confirmReal: true });
    expect(r!.pedidoManual).toBe('PED-25-2026');
  });

  it('real assign: not-found document returns null', async () => {
    const assign = createAssignPedido(mkDeps());
    const r = await assign('does-not-exist', '25/2026', { confirmReal: true });
    expect(r).toBeNull();
  });

  it('real assign: respects copy flag passed to drive', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database);
    let copyUsed: boolean | undefined;
    const deps = mkDeps({
      moveOrCopy: async (params) => {
        copyUsed = params.copy;
        return {
          storageUri: 'gdrive://file/c',
          driveFileId: 'c',
          driveWebViewLink: 'https://drive.google.com/file/d/c/view',
        };
      },
    });
    const assign = createAssignPedido(deps);
    await assign(docId, '25/2026', { confirmReal: true, copyInsteadOfMove: true });
    expect(copyUsed).toBe(true);
  });

  it('real assign: handles legacy nf_pdf tipo from DB', async () => {
    const database = getDb();
    const docId = seedPendingDoc(database, { tipoDocumento: 'nf_pdf', formato: 'pdf' });
    const assign = createAssignPedido(mkDeps());
    const r = await assign(docId, '25/2026', { confirmReal: true });
    expect(r).not.toBeNull();
    expect(r!.pedidoManual).toBe('PED-25-2026');
  });
});
