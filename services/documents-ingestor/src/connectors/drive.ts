import { randomUUID } from 'node:crypto';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import type { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient, loadOAuthConfig } from './oauth.js';
import { config } from '../config.js';

export interface DriveReference {
  storageBackend: 'google_drive';
  storageUri: string;
  driveFileId: string;
  driveFolderId?: string;
  driveWebViewLink: string;
  driveWebContentLink?: string;
}

export interface DriveFolderReference {
  driveFolderId: string;
  folderUri: string;
  driveWebViewLink?: string;
}

export interface UploadResult {
  file: DriveReference;
  folder: DriveFolderReference;
}

function stubId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function fileViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function fileContentLink(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function folderViewLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function buildDriveClient(auth: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: 'v3', auth });
}

export async function buildAuthenticatedDrive(): Promise<drive_v3.Drive | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;
  return buildDriveClient(auth);
}

async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | undefined,
): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'");
  const q = parentId
    ? `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id,name)' });
  return res.data.files?.[0]?.id ?? null;
}

export async function ensureRootFolder(
  drive: drive_v3.Drive | null = null,
): Promise<DriveFolderReference> {
  const d = drive ?? (await buildAuthenticatedDrive());
  if (!d) {
    const id = stubId('folder');
    return {
      driveFolderId: id,
      folderUri: `gdrive://folder/${id}`,
      driveWebViewLink: folderViewLink(id),
    };
  }
  if (config.googleDriveRootFolderId) {
    return {
      driveFolderId: config.googleDriveRootFolderId,
      folderUri: `gdrive://folder/${config.googleDriveRootFolderId}`,
      driveWebViewLink: folderViewLink(config.googleDriveRootFolderId),
    };
  }
  let id = await findFolder(d, config.googleDriveRootFolderName, undefined);
  if (!id && config.googleDriveCreateMissingFolders) {
    const res = await d.files.create({
      requestBody: {
        name: config.googleDriveRootFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id,webViewLink',
    });
    id = res.data.id ?? stubId('folder');
  }
  if (!id) {
    id = stubId('folder');
  }
  return {
    driveFolderId: id,
    folderUri: `gdrive://folder/${id}`,
    driveWebViewLink: folderViewLink(id),
  };
}

export async function ensureFolderPath(
  logicalPath: string,
  drive: drive_v3.Drive | null = null,
): Promise<DriveFolderReference> {
  const d = drive ?? (await buildAuthenticatedDrive());
  if (!d) {
    const id = stubId('folder');
    return {
      driveFolderId: id,
      folderUri: `gdrive://folder/${id}`,
      driveWebViewLink: folderViewLink(id),
    };
  }
  const root = await ensureRootFolder(d);
  const parts = logicalPath.split('/').filter(p => p && p !== config.googleDriveRootFolderName);
  let parentId: string | undefined = root.driveFolderId;
  let currentId = root.driveFolderId;

  for (const part of parts) {
    let childId = await findFolder(d, part, parentId);
    if (!childId && config.googleDriveCreateMissingFolders) {
      const res = await d.files.create({
        requestBody: {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId ? [parentId] : undefined,
        },
        fields: 'id,webViewLink',
      });
      childId = res.data.id ?? stubId('folder');
    }
    if (!childId) {
      childId = stubId('folder');
    }
    currentId = childId;
    parentId = childId;
  }

  return {
    driveFolderId: currentId,
    folderUri: `gdrive://folder/${currentId}`,
    driveWebViewLink: folderViewLink(currentId),
  };
}

export async function uploadDocument(params: {
  folderLogicalPath: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  drive?: drive_v3.Drive | null;
}): Promise<UploadResult> {
  const d = params.drive ?? (await buildAuthenticatedDrive());
  if (!d) {
    const id = stubId('file');
    return {
      file: {
        storageBackend: 'google_drive',
        storageUri: `gdrive://file/${id}`,
        driveFileId: id,
        driveWebViewLink: fileViewLink(id),
        driveWebContentLink: fileContentLink(id),
      },
      folder: {
        driveFolderId: stubId('folder'),
        folderUri: `gdrive://folder/${stubId('folder')}`,
      },
    };
  }
  const folder = await ensureFolderPath(params.folderLogicalPath, d);
  const res = await d.files.create({
    requestBody: {
      name: params.filename,
      parents: [folder.driveFolderId],
    },
    media: {
      mimeType: params.mimeType,
      body: BufferToReadable(params.data),
    },
    fields: 'id,webViewLink,webContentLink',
  });
  const fileId = res.data.id ?? stubId('file');
  return {
    file: {
      storageBackend: 'google_drive',
      storageUri: `gdrive://file/${fileId}`,
      driveFileId: fileId,
      driveFolderId: folder.driveFolderId,
      driveWebViewLink: res.data.webViewLink ?? fileViewLink(fileId),
      driveWebContentLink: res.data.webContentLink ?? fileContentLink(fileId),
    },
    folder,
  };
}

export async function uploadManifest(params: {
  pedido: string;
  payload: unknown;
  drive?: drive_v3.Drive | null;
}): Promise<DriveReference> {
  const d = params.drive ?? (await buildAuthenticatedDrive());
  const content = Buffer.from(JSON.stringify(params.payload, null, 2), 'utf-8');
  if (!d) {
    const id = stubId('file');
    return {
      storageBackend: 'google_drive',
      storageUri: `gdrive://file/${id}`,
      driveFileId: id,
      driveWebViewLink: fileViewLink(id),
      driveWebContentLink: fileContentLink(id),
    };
  }
  const folderLogicalPath = `${config.googleDriveRootFolderName}/pedidos/${params.pedido}`;
  const folder = await ensureFolderPath(folderLogicalPath, d);

  const search = await d.files.list({
    q: `name='manifest.json' and '${folder.driveFolderId}' in parents and trashed=false`,
    fields: 'files(id,webViewLink)',
  });
  const existing = search.data.files?.[0];

  if (existing?.id) {
    const update = await d.files.update({
      fileId: existing.id,
      media: {
        mimeType: 'application/json',
        body: BufferToReadable(content),
      },
      fields: 'id,webViewLink,webContentLink',
    });
    return {
      storageBackend: 'google_drive',
      storageUri: `gdrive://file/${update.data.id ?? existing.id}`,
      driveFileId: update.data.id ?? existing.id,
      driveWebViewLink: update.data.webViewLink ?? fileViewLink(existing.id),
      driveWebContentLink: update.data.webContentLink ?? fileContentLink(existing.id),
    };
  }

  const create = await d.files.create({
    requestBody: {
      name: 'manifest.json',
      parents: [folder.driveFolderId],
    },
    media: {
      mimeType: 'application/json',
      body: BufferToReadable(content),
    },
    fields: 'id,webViewLink,webContentLink',
  });
  const fileId = create.data.id ?? stubId('file');
  return {
    storageBackend: 'google_drive',
    storageUri: `gdrive://file/${fileId}`,
    driveFileId: fileId,
    driveWebViewLink: create.data.webViewLink ?? fileViewLink(fileId),
    driveWebContentLink: create.data.webContentLink ?? fileContentLink(fileId),
  };
}

export async function moveOrCopyDocumentToPedido(params: {
  sourceFileId: string;
  destinationLogicalPath: string;
  copy?: boolean;
  drive?: drive_v3.Drive | null;
}): Promise<DriveReference> {
  const d = params.drive ?? (await buildAuthenticatedDrive());
  if (!d) {
    const id = stubId('file');
    return {
      storageBackend: 'google_drive',
      storageUri: `gdrive://file/${id}`,
      driveFileId: id,
      driveWebViewLink: fileViewLink(id),
      driveWebContentLink: fileContentLink(id),
    };
  }
  const folder = await ensureFolderPath(params.destinationLogicalPath, d);
  const copy = params.copy ?? true;
  if (copy) {
    const res = await d.files.copy({
      fileId: params.sourceFileId,
      requestBody: {
        parents: [folder.driveFolderId],
      },
      fields: 'id,webViewLink,webContentLink',
    });
    const fileId = res.data.id ?? stubId('file');
    return {
      storageBackend: 'google_drive',
      storageUri: `gdrive://file/${fileId}`,
      driveFileId: fileId,
      driveFolderId: folder.driveFolderId,
      driveWebViewLink: res.data.webViewLink ?? fileViewLink(fileId),
      driveWebContentLink: res.data.webContentLink ?? fileContentLink(fileId),
    };
  }
  const res = await d.files.update({
    fileId: params.sourceFileId,
    addParents: folder.driveFolderId,
    fields: 'id,webViewLink,webContentLink,parents',
  });
  const fileId = res.data.id ?? params.sourceFileId;
  return {
    storageBackend: 'google_drive',
    storageUri: `gdrive://file/${fileId}`,
    driveFileId: fileId,
    driveFolderId: folder.driveFolderId,
    driveWebViewLink: res.data.webViewLink ?? fileViewLink(fileId),
    driveWebContentLink: res.data.webContentLink ?? fileContentLink(fileId),
  };
}

export async function listRecentFiles(daysBack: number): Promise<DriveReference[]> {
  void daysBack;
  return [];
}

function BufferToReadable(buf: Buffer): NodeJS.ReadableStream {
  return Readable.from(buf);
}
