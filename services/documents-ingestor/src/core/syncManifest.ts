import { getDb } from '../storage/sqlite.js';
import { uploadManifest } from '../connectors/drive.js';
import type { Manifest, ManifestDocument } from './manifest.js';
import type { DocumentStatus, TipoDocumento, DirecaoNF } from '../types/document.js';

export interface SyncManifestResult {
  pedido: string;
  documentCount: number;
  dryRun: boolean;
  driveSyncApplied: boolean;
  driveFileId?: string;
  storageUri?: string;
}

export function buildManifestFromDb(pedido: string): Manifest {
  const db = getDb();

  const docs = db.prepare(
    `SELECT d.id, d.gmail_message_id, d.thread_id, d.attachment_id,
            d.filename_original, d.sha256, d.tipo_documento, d.formato,
            d.direcao_nf, d.storage_backend, d.storage_uri, d.drive_file_id,
            d.drive_folder_id, d.drive_web_view_link, d.drive_web_content_link,
            d.local_cache_path, d.status, d.pedido_manual,
            d.created_at, d.updated_at
     FROM documentos d
     WHERE d.pedido_manual = ?
     ORDER BY d.created_at ASC`
  ).all(pedido) as any[];

  const documentRows: any[] = docs;

  const manifestDocuments: ManifestDocument[] = documentRows.map((doc: any) => {
    const tipoRaw: string = doc.tipo_documento ?? 'desconhecido';
    const isLegacy = tipoRaw === 'nf_xml' || tipoRaw === 'nf_pdf';

    const md: ManifestDocument = {
      document_id: doc.id,
      tipo_documento: isLegacy && tipoRaw === 'nf_xml' ? 'nf' as any : tipoRaw === 'nf_pdf' ? 'nf' as any : tipoRaw as any,
      filename_original: doc.filename_original,
      sha256: doc.sha256,
      storage_backend: 'google_drive',
      storage_uri: doc.storage_uri ?? '',
      drive_file_id: doc.drive_file_id ?? '',
      drive_folder_id: doc.drive_folder_id ?? undefined,
      drive_web_view_link: doc.drive_web_view_link ?? undefined,
      drive_web_content_link: doc.drive_web_content_link ?? undefined,
      local_cache_path: doc.local_cache_path ?? undefined,
      ingested_at: doc.created_at,
      event_id: doc.id,
      status: doc.status === 'assigned' ? 'pending_app_acceptance' : doc.status as any,
    };

    if (doc.formato) {
      (md as any).formato = doc.formato;
    }
    if (doc.direcao_nf) {
      (md as any).direcao_nf = doc.direcao_nf;
    }

    return md;
  });

  return {
    schema_version: 1,
    pedido,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    storage_backend: 'google_drive',
    documents: manifestDocuments,
  };
}

export function exportManifest(pedido: string): Manifest {
  return buildManifestFromDb(pedido);
}

export async function syncManifest(
  pedido: string,
  opts: { confirmRealGoogle?: boolean } = {},
): Promise<SyncManifestResult> {
  const manifest = buildManifestFromDb(pedido);

  if (opts.confirmRealGoogle !== true) {
    return {
      pedido,
      documentCount: manifest.documents.length,
      dryRun: true,
      driveSyncApplied: false,
    };
  }

  const result = await uploadManifest({
    pedido,
    payload: manifest,
  });

  return {
    pedido,
    documentCount: manifest.documents.length,
    dryRun: false,
    driveSyncApplied: true,
    driveFileId: result.driveFileId,
    storageUri: result.storageUri,
  };
}
