import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createScan } from '../src/core/realScan.js';
import type { ScanDeps } from '../src/core/realScan.js';
import { createAssignPedido } from '../src/core/realAssign.js';
import type { AssignDeps } from '../src/core/realAssign.js';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { exportPendingEvents } from '../src/core/outbox.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `integration-${randomUUID()}`);

type DriveCallLog = { method: string; args: any };

function makeFakeDrive() {
  const calls: DriveCallLog[] = [];
  const folders = new Map<string, { id: string; name: string; parent: string | null }>();
  const files = new Map<string, { id: string; name: string; parent: string | null }>();
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}-${randomUUID().slice(0, 6)}`;

  const findFolderByNameAndParent = (name: string, parent: string | null) => {
    for (const f of folders.values()) {
      if (f.name === name && f.parent === parent) return f.id;
    }
    return null;
  };

  return {
    calls,
    uploadCalls: () => calls.filter(c => c.method === 'files.create'),
    copyCalls: () => calls.filter(c => c.method === 'files.copy'),
    listFolders: () => Array.from(folders.values()),
    listFiles: () => Array.from(files.values()),
    api: {
      files: {
        list: async (args: any) => {
          calls.push({ method: 'files.list', args });
          const q: string = args?.q ?? '';
          const m = q.match(/name='([^']+)'/);
          const name = m ? m[1] : null;
          const parentMatch = q.match(/'([^']+)' in parents/);
          const parent = parentMatch ? parentMatch[1] : null;
          const folderHit = name ? findFolderByNameAndParent(name, parent) : null;
          const fileHits = name ? Array.from(files.values()).filter(f => f.name === name && f.parent === parent).map(f => f.id) : [];
          return { data: { files: folderHit ? [{ id: folderHit, name }] : fileHits.map(id => ({ id, name })) } };
        },
        create: async (args: any) => {
          calls.push({ method: 'files.create', args });
          const name = args?.requestBody?.name ?? 'unnamed';
          const parent = args?.requestBody?.parents?.[0] ?? null;
          const mime = args?.requestBody?.mimeType ?? '';
          if (mime === 'application/vnd.google-apps.folder') {
            const id = nextId('folder');
            folders.set(id, { id, name, parent });
            return { data: { id, webViewLink: `https://drive.google.com/drive/folders/${id}` } };
          }
          const id = nextId('file');
          files.set(id, { id, name, parent });
          return { data: { id, webViewLink: `https://drive.google.com/file/d/${id}/view`, webContentLink: `https://drive.google.com/uc?export=download&id=${id}` } };
        },
        update: async (args: any) => {
          calls.push({ method: 'files.update', args });
          const id = args?.fileId ?? 'updated';
          return { data: { id, webViewLink: `https://drive.google.com/file/d/${id}/view`, webContentLink: `https://drive.google.com/uc?export=download&id=${id}` } };
        },
        copy: async (args: any) => {
          calls.push({ method: 'files.copy', args });
          const id = nextId('file');
          files.set(id, { id, name: `copy-of-${args?.fileId}`, parent: args?.requestBody?.parents?.[0] ?? null });
          return { data: { id, webViewLink: `https://drive.google.com/file/d/${id}/view`, webContentLink: `https://drive.google.com/uc?export=download&id=${id}` } };
        },
      },
    },
  };
}

describe('integration mock flow — full Gmail→Drive→SQLite→Outbox hermetic', () => {
  let fakeDrive: ReturnType<typeof makeFakeDrive>;

  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(SCENARIO_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(SCENARIO_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(SCENARIO_DIR, 'cache');
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
    fakeDrive = makeFakeDrive();
  });

  afterEach(() => {
    closeDb();
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('end-to-end: fake Gmail → classify → fake Drive → SQLite → fake assign → manifest → outbox pending_app_acceptance', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n<nfe>fake nota fiscal content for integration test</nfe>');
    const sha256Expected = 'computed-later';

    const scanDeps: ScanDeps = {
      fetchEmails: async () => [
        { gmailMessageId: 'msg-int-1', threadId: 'thr-int-1', from: 'fornecedor@example.com', subject: 'NF-e 99999 integração', date: '2026-07-06', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-int-1', threadId: 'thr-int-1', attachmentId: 'att-int-1', filename: 'NF-99999.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ folderLogicalPath, filename, mimeType, data }) => {
        const result = await fakeDrive.api.files.create({
          requestBody: { name: filename, parents: ['fake-pendentes-folder'] },
          media: { mimeType, body: data },
          fields: 'id,webViewLink,webContentLink',
        });
        void folderLogicalPath;
        const fileId = result.data.id!;
        return {
          file: {
            storageUri: `gdrive://file/${fileId}`,
            driveFileId: fileId,
            driveWebViewLink: result.data.webViewLink!,
            driveFolderId: 'fake-pendentes-folder',
            driveWebContentLink: result.data.webContentLink,
          },
        };
      },
    };

    const scan = createScan(scanDeps);
    const scanResult = await scan({ confirmReal: true, maxAttachments: 10 });
    expect(scanResult.mode).toBe('real');
    expect(scanResult.emailsScanned).toBe(1);
    expect(scanResult.attachmentsFound).toBe(1);
    expect(scanResult.newDocuments).toBe(1);
    expect(scanResult.duplicates).toBe(0);

    const db = getDb();
    const docs = db.prepare(`SELECT id, sha256, tipo_documento, formato, drive_file_id, status, gmail_message_id FROM documentos`).all() as any[];
    expect(docs).toHaveLength(1);
    expect(docs[0].tipo_documento).toBe('nf');
    expect(docs[0].formato).toBe('pdf');
    expect(docs[0].status).toBe('pending');
    expect(docs[0].drive_file_id).toMatch(/^file-/);
    void sha256Expected;

    const assignDeps: AssignDeps = {
      moveOrCopy: async ({ sourceFileId, destinationLogicalPath }) => {
        const destFolder = fakeDrive.listFolders().find(f => f.name === destinationLogicalPath.split('/').pop()) ?? { id: `folder-${destinationLogicalPath}` };
        const result = await fakeDrive.api.files.copy({
          fileId: sourceFileId,
          requestBody: { parents: [destFolder.id] },
          fields: 'id,webViewLink,webContentLink',
        });
        const fileId = result.data.id!;
        return {
          storageUri: `gdrive://file/${fileId}`,
          driveFileId: fileId,
          driveFolderId: destFolder.id,
          driveWebViewLink: result.data.webViewLink!,
          driveWebContentLink: result.data.webContentLink,
        };
      },
      uploadManifest: async ({ pedido }) => {
        const result = await fakeDrive.api.files.create({
          requestBody: { name: 'manifest.json', parents: [`folder-${pedido}`], mimeType: 'application/json' },
          fields: 'id,webViewLink',
        });
        return { storageUri: `gdrive://file/${result.data.id}`, driveFileId: result.data.id!, driveWebViewLink: result.data.webViewLink! };
      },
    };

    const assign = createAssignPedido(assignDeps);
    const assignResult = await assign(docs[0].id, '25/2026', { confirmReal: true });
    expect(assignResult).not.toBeNull();
    expect(assignResult!.pedidoManual).toBe('PED-25-2026');
    expect(assignResult!.driveFileId).toMatch(/^file-/);
    expect(assignResult!.manifestStorageUri).toMatch(/^gdrive:\/\/file\//);

    const docAfter = db.prepare(`SELECT status, pedido_manual, drive_file_id FROM documentos WHERE id = ?`).get(docs[0].id) as any;
    expect(docAfter.status).toBe('assigned');
    expect(docAfter.pedido_manual).toBe('PED-25-2026');
    expect(docAfter.drive_file_id).toBe(assignResult!.driveFileId);

    const events = db.prepare(`SELECT id, event_type, pedido_manual, document_id, status, drive_file_id, manifest_storage_uri FROM ingestion_events ORDER BY created_at`).all() as any[];
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe('document.detected');
    expect(events[0].pedido_manual).toBe('');
    expect(events[0].status).toBe('pending_app_acceptance');
    expect(events[1].event_type).toBe('document.linked');
    expect(events[1].pedido_manual).toBe('PED-25-2026');
    expect(events[1].status).toBe('pending_app_acceptance');

    const outboxPath = process.env.OUTBOX_PATH!;
    expect(existsSync(outboxPath)).toBe(true);
    const outboxLines = readFileSync(outboxPath, 'utf-8').trim().split('\n').filter(Boolean);
    expect(outboxLines).toHaveLength(2);
    const ev = JSON.parse(outboxLines[0]);
    expect(ev.event_type).toBe('document.detected');
    expect(ev.pedido_manual).toBe('');
    expect(ev.status).toBe('pending_app_acceptance');
    const ev2 = JSON.parse(outboxLines[1]);
    expect(ev2.event_type).toBe('document.linked');
    expect(ev2.pedido_manual).toBe('PED-25-2026');
    expect(ev2.document.drive_file_id).toBe(assignResult!.driveFileId);

    expect(fakeDrive.copyCalls().length).toBeGreaterThan(0);
    expect(fakeDrive.uploadCalls().some(c => c.args?.requestBody?.name === 'manifest.json')).toBe(true);
  });

  it('idempotency: second scan of same email does NOT create new Drive file or new document', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n<nfe>same content for idempotency</nfe>');
    const scanDeps: ScanDeps = {
      fetchEmails: async () => [
        { gmailMessageId: 'msg-idem', threadId: 'thr-idem', from: '', subject: 'idem', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-idem', threadId: 'thr-idem', attachmentId: 'att-idem', filename: 'NF-idem.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename, data }) => {
        const result = await fakeDrive.api.files.create({ requestBody: { name: filename }, media: { body: data } });
        return { file: { storageUri: `gdrive://file/${result.data.id}`, driveFileId: result.data.id!, driveWebViewLink: result.data.webViewLink!, driveFolderId: 'f' } };
      },
    };

    const scan = createScan(scanDeps);
    const r1 = await scan({ confirmReal: true });
    const r2 = await scan({ confirmReal: true });
    expect(r1.newDocuments).toBe(1);
    expect(r2.newDocuments).toBe(0);
    expect(r2.emailsScanned).toBe(1);
    expect(r2.duplicates).toBe(0);

    const db = getDb();
    const count = (db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any).c;
    expect(count).toBe(1);

    const driveFiles = fakeDrive.listFiles();
    expect(driveFiles).toHaveLength(1);
  });

  it('exportPendingEvents moves events from SQLite to outbox JSONL', async () => {
    const fakePdf = Buffer.from('%PDF-1.4\n<export>content</export>');
    const scanDeps: ScanDeps = {
      fetchEmails: async () => [
        { gmailMessageId: 'msg-exp', threadId: 'thr-exp', from: '', subject: 'export', date: '', attachmentCount: 1 },
      ],
      listAtts: async () => [
        { gmailMessageId: 'msg-exp', threadId: 'thr-exp', attachmentId: 'att-exp', filename: 'E.pdf', mimeType: 'application/pdf', size: fakePdf.length },
      ],
      downloadAtt: async () => fakePdf,
      uploadDoc: async ({ filename, data }) => {
        const result = await fakeDrive.api.files.create({ requestBody: { name: filename }, media: { body: data } });
        return { file: { storageUri: `gdrive://file/${result.data.id}`, driveFileId: result.data.id!, driveWebViewLink: result.data.webViewLink!, driveFolderId: 'f' } };
      },
    };

    const scan = createScan(scanDeps);
    await scan({ confirmReal: true });

    const doc = (getDb().prepare(`SELECT id FROM documentos LIMIT 1`).get() as any).id;
    const assign = createAssignPedido({
      moveOrCopy: async ({ sourceFileId, destinationLogicalPath }) => {
        const result = await fakeDrive.api.files.copy({ fileId: sourceFileId, requestBody: { parents: [`folder-${destinationLogicalPath}`] } });
        return { storageUri: `gdrive://file/${result.data.id}`, driveFileId: result.data.id!, driveFolderId: 'f', driveWebViewLink: result.data.webViewLink! };
      },
      uploadManifest: async () => {
        const result = await fakeDrive.api.files.create({ requestBody: { name: 'manifest.json' } });
        return { storageUri: `gdrive://file/${result.data.id}`, driveFileId: result.data.id!, driveWebViewLink: result.data.webViewLink! };
      },
    });
    await assign(doc, '50/2026', { confirmReal: true });

    const before = (getDb().prepare(`SELECT COUNT(*) AS c FROM ingestion_events WHERE exported_at IS NULL`).get() as any).c;
    expect(before).toBe(2);

    const outboxPath = process.env.OUTBOX_PATH!;
    if (existsSync(outboxPath)) rmSync(outboxPath);
    const exported = exportPendingEvents();
    expect(exported).toHaveLength(2);
    expect(existsSync(outboxPath)).toBe(true);
    const content = readFileSync(outboxPath, 'utf-8').trim().split('\n');
    expect(content).toHaveLength(2);
    const ev = JSON.parse(content[0]);
    expect(ev.event_type).toBe('document.detected');
    expect(ev.pedido_manual).toBe('');
    const ev2 = JSON.parse(content[1]);
    expect(ev2.event_type).toBe('document.linked');
    expect(ev2.pedido_manual).toBe('PED-50-2026');
    expect(ev2.status).toBe('pending_app_acceptance');

    const after = (getDb().prepare(`SELECT COUNT(*) AS c FROM ingestion_events WHERE exported_at IS NULL`).get() as any).c;
    expect(after).toBe(0);
  });
});
