import { randomUUID } from 'node:crypto';
import { getDb } from '../storage/sqlite.js';
import { normalizePedido } from './pedido.js';
import { pedidoSubfolderDrivePath, manifestDrivePath, localCacheRoot } from './paths.js';
import { moveOrCopyDocumentToPedido, uploadManifest } from '../connectors/drive.js';
import { createDocumentEvent } from '../types/event.js';
import { appendEvent, isEventDuplicate } from './outbox.js';
import { addDocumentToManifest } from './manifest.js';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import { fromLegacyTipo } from '../types/document.js';
import type { TipoDocumento } from '../types/document.js';

export interface AssignOptions {
  confirmReal?: boolean;
  copyInsteadOfMove?: boolean;
}

export interface AssignResult {
  documentId: string;
  pedidoManual: string;
  eventId: string;
  storageUri: string;
  driveFileId: string;
  manifestStorageUri: string;
}

export interface AssignDeps {
  moveOrCopy: (params: { sourceFileId: string; destinationLogicalPath: string; copy?: boolean }) => Promise<{
    storageUri: string;
    driveFileId: string;
    driveFolderId?: string;
    driveWebViewLink: string;
    driveWebContentLink?: string;
  }>;
  uploadManifest: (params: { pedido: string; payload: unknown }) => Promise<{ storageUri: string; driveFileId: string; driveWebViewLink: string }>;
}

const defaultDeps: AssignDeps = {
  moveOrCopy: async (params) => {
    const r = await moveOrCopyDocumentToPedido(params);
    return {
      storageUri: r.storageUri,
      driveFileId: r.driveFileId,
      driveFolderId: r.driveFolderId,
      driveWebViewLink: r.driveWebViewLink,
      driveWebContentLink: r.driveWebContentLink,
    };
  },
  uploadManifest: async (params) => {
    const r = await uploadManifest(params);
    return { storageUri: r.storageUri, driveFileId: r.driveFileId, driveWebViewLink: r.driveWebViewLink };
  },
};

export function createAssignPedido(deps: AssignDeps = defaultDeps) {
  return async function assignPedido(
    emailOrDocumentId: string,
    pedidoManual: string,
    opts: AssignOptions = {},
  ): Promise<AssignResult | null> {
    const normalized = normalizePedido(pedidoManual);
    if (!normalized) {
      return null;
    }

    const database = getDb();
    const doc = database.prepare(
      `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
    ).get(emailOrDocumentId, emailOrDocumentId) as any;

    if (!doc) return null;
    if (doc.status !== 'pending') return null;

    if (opts.confirmReal !== true) {
      return null;
    }

    const tipoRaw: string = doc.tipo_documento;
    const tax = fromLegacyTipo(tipoRaw as any);
    const tipo: TipoDocumento = tax.tipoDocumento;
    const direcaoNf = (doc.direcao_nf as string | null) ?? tax.direcaoNf;
    const subfolder = pedidoSubfolderDrivePath({
      pedidoManual: normalized,
      tipoDocumento: tipo,
      direcaoNf: direcaoNf as any,
    });
    const moveResult = await deps.moveOrCopy({
      sourceFileId: doc.drive_file_id,
      destinationLogicalPath: subfolder.logicalPath,
      copy: opts.copyInsteadOfMove ?? true,
    });

    const pathParts = subfolder.logicalPath.split('/');
    const subPath = pathParts.slice(-3).join('/');
    const localCacheFilePath = join(
      localCacheRoot(),
      'pedidos',
      normalized,
      subPath,
      doc.filename_original,
    );
    ensureLocalCacheDir(localCacheFilePath);

    const eventId = randomUUID();
    const manifestRef = await deps.uploadManifest({
      pedido: normalized,
      payload: {
        schema_version: 1,
        pedido: normalized,
        storage_backend: 'google_drive',
        manifest_storage_uri: undefined,
        documents: [],
      },
    });

    addDocumentToManifest(os.devNull, normalized, {
      document_id: doc.id,
      tipo_documento: tipo,
      filename_original: doc.filename_original,
      sha256: doc.sha256,
      storage_backend: 'google_drive',
      storage_uri: moveResult.storageUri,
      drive_file_id: moveResult.driveFileId,
      drive_folder_id: moveResult.driveFolderId,
      drive_web_view_link: moveResult.driveWebViewLink,
      drive_web_content_link: moveResult.driveWebContentLink,
      local_cache_path: localCacheFilePath,
      ingested_at: new Date().toISOString(),
      event_id: eventId,
      status: 'pending_app_acceptance',
    });

    database.prepare(
      `UPDATE documentos
       SET status = 'assigned',
           pedido_manual = ?,
           updated_at = datetime('now'),
           storage_uri = ?,
           drive_file_id = ?,
           drive_folder_id = ?,
           drive_web_view_link = ?,
           drive_web_content_link = ?,
           local_cache_path = ?
       WHERE id = ?`
    ).run(
      normalized,
      moveResult.storageUri,
      moveResult.driveFileId,
      moveResult.driveFolderId ?? null,
      moveResult.driveWebViewLink,
      moveResult.driveWebContentLink ?? null,
      localCacheFilePath,
      doc.id,
    );

    const event = createDocumentEvent({
      eventId,
      pedidoManual: normalized,
      gmailMessageId: doc.gmail_message_id,
      threadId: doc.thread_id,
      documentId: doc.id,
      tipoDocumento: tipo,
      filenameOriginal: doc.filename_original,
      sha256: doc.sha256,
      driveFileId: moveResult.driveFileId,
      driveFolderId: moveResult.driveFolderId,
      driveWebViewLink: moveResult.driveWebViewLink,
      driveWebContentLink: moveResult.driveWebContentLink,
      localCachePath: localCacheFilePath,
      manifestStorageUri: manifestRef.storageUri,
      status: 'pending_app_acceptance',
      eventType: 'document.linked',
    });

    if (!isEventDuplicate(eventId)) {
      database.prepare(
        `INSERT INTO ingestion_events (
           id, event_type, pedido_manual, document_id, status,
           storage_backend, storage_uri, drive_file_id, drive_web_view_link,
           manifest_storage_uri, manifest_drive_file_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        eventId,
        'document.linked',
        normalized,
        doc.id,
        'pending_app_acceptance',
        'google_drive',
        moveResult.storageUri,
        moveResult.driveFileId,
        moveResult.driveWebViewLink,
        manifestRef.storageUri,
        manifestRef.driveFileId,
      );
      appendEvent(event);
    }

    void manifestDrivePath;
    return {
      documentId: doc.id,
      pedidoManual: normalized,
      eventId,
      storageUri: moveResult.storageUri,
      driveFileId: moveResult.driveFileId,
      manifestStorageUri: manifestRef.storageUri,
    };
  };
}

function ensureLocalCacheDir(filePath: string): void {
  const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  if (idx === -1) return;
  const dir = filePath.slice(0, idx);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
