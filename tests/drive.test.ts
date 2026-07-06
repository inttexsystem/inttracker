import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ensureRootFolder,
  ensureFolderPath,
  uploadDocument,
  uploadManifest,
  moveOrCopyDocumentToPedido,
} from '../src/connectors/drive.js';
import type { drive_v3 } from 'googleapis';

type Call = {
  method: string;
  args: any;
};

function makeFakeDrive(seedFolderId = 'fake-root-folder'): drive_v3.Drive & { calls: Call[] } {
  const calls: Call[] = [];
  const folders = new Map<string, { id: string; name: string; parent: string | null }>([
    [seedFolderId, { id: seedFolderId, name: 'root', parent: null }],
  ]);
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
    files: {
      list: async (args: any) => {
        calls.push({ method: 'files.list', args });
        const q: string = args?.q ?? '';
        const m = q.match(/name='([^']+)'/);
        const name = m ? m[1] : null;
        const parentMatch = q.match(/'([^']+)' in parents/);
        const parent = parentMatch ? parentMatch[1] : null;
        const folderHit = name ? findFolderByNameAndParent(name, parent) : null;
        const fileHit = name ? Array.from(files.values()).filter(f => f.name === name && f.parent === parent).map(f => f.id) : [];
        return { data: { files: folderHit ? [{ id: folderHit, name }] : fileHit.map(id => ({ id, name })) } };
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
        const id = args?.fileId ?? 'updated-file';
        return { data: { id, webViewLink: `https://drive.google.com/file/d/${id}/view`, webContentLink: `https://drive.google.com/uc?export=download&id=${id}` } };
      },
      copy: async (args: any) => {
        calls.push({ method: 'files.copy', args });
        const id = nextId('file');
        files.set(id, { id, name: `copy-of-${args?.fileId}`, parent: args?.requestBody?.parents?.[0] ?? null });
        return { data: { id, webViewLink: `https://drive.google.com/file/d/${id}/view`, webContentLink: `https://drive.google.com/uc?export=download&id=${id}` } };
      },
    } as any,
  } as any;
}

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_TOKEN_PATH = './data/__never_exists_in_tests__.json';
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
  process.env.GOOGLE_DRIVE_CREATE_MISSING_FOLDERS = 'true';
});

describe('drive connector (stub contract — fake Drive, no real Google calls)', () => {
  it('ensureRootFolder returns a Drive folder reference using the fake drive', async () => {
    const fake = makeFakeDrive('fake-root-1');
    const ref = await ensureRootFolder(fake as any);
    expect(ref.driveFolderId).toBeTruthy();
    expect(ref.folderUri).toMatch(/^gdrive:\/\/folder\//);
    expect(ref.driveWebViewLink).toMatch(/^https:\/\/drive\.google\.com\/drive\/folders\//);
    expect(fake.calls.some(c => c.method === 'files.create')).toBe(true);
  });

  it('ensureFolderPath creates nested folders via the fake drive', async () => {
    const fake = makeFakeDrive('fake-root-2');
    const ref = await ensureFolderPath('Ravatex Documents Ingestor/pedidos/PED-25-2026/2026-07-06/nf', fake as any);
    expect(ref.driveFolderId).toBeTruthy();
    expect(ref.folderUri).toMatch(/^gdrive:\/\/folder\//);
    const creates = fake.calls.filter(c => c.method === 'files.create');
    expect(creates.length).toBeGreaterThan(0);
  });

  it('uploadDocument uploads via the fake drive and returns DriveReference with gdrive://file/<id>', async () => {
    const fake = makeFakeDrive('fake-root-3');
    const result = await uploadDocument({
      folderLogicalPath: 'Ravatex Documents Ingestor/pendentes/2026-07-06/email-abc',
      filename: 'nota.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('%PDF-1.4 fake content'),
      drive: fake as any,
    });
    expect(result.file.storageBackend).toBe('google_drive');
    expect(result.file.storageUri).toMatch(/^gdrive:\/\/file\//);
    expect(result.file.driveFileId).toBeTruthy();
    expect(result.file.driveWebViewLink).toMatch(/^https:\/\/drive\.google\.com\/file\/d\//);
    expect(fake.calls.some(c => c.method === 'files.create')).toBe(true);
  });

  it('uploadManifest returns DriveReference via the fake drive', async () => {
    const fake = makeFakeDrive('fake-root-4');
    const ref = await uploadManifest({ pedido: 'PED-25-2026', payload: { schema_version: 1 }, drive: fake as any });
    expect(ref.storageBackend).toBe('google_drive');
    expect(ref.storageUri).toMatch(/^gdrive:\/\/file\//);
    expect(ref.driveFileId).toBeTruthy();
    expect(fake.calls.some(c => c.method === 'files.create' && c.args?.requestBody?.name === 'manifest.json')).toBe(true);
  });

  it('moveOrCopyDocumentToPedido copies via the fake drive (no real source-abc lookup)', async () => {
    const fake = makeFakeDrive('fake-root-5');
    const ref = await moveOrCopyDocumentToPedido({
      sourceFileId: 'source-abc',
      destinationLogicalPath: 'Ravatex Documents Ingestor/pedidos/PED-25-2026/2026-07-06/nf',
      drive: fake as any,
    });
    expect(ref.storageBackend).toBe('google_drive');
    expect(ref.driveFileId).toBeTruthy();
    expect(fake.calls.some(c => c.method === 'files.copy')).toBe(true);
  });
});
