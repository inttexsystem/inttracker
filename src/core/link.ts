import { randomUUID } from 'node:crypto';
import { getDb } from '../storage/sqlite.js';
import { normalizePedido } from './pedido.js';
import { appendEvent, isEventDuplicate } from './outbox.js';

export interface LinkResult {
  documentId: string;
  pedidoManual: string;
  eventId: string;
  warnedDirection: boolean;
}

export function linkDocumentToPedido(
  emailOrDocumentId: string,
  pedidoInput: string,
): LinkResult {
  const normalized = normalizePedido(pedidoInput);
  if (!normalized) {
    throw new Error(`Invalid pedido format: ${pedidoInput}`);
  }

  const db = getDb();
  const doc = db.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(emailOrDocumentId, emailOrDocumentId) as any;

  if (!doc) {
    throw new Error(`Document not found: ${emailOrDocumentId}`);
  }

  if (doc.status !== 'pending') {
    if (doc.status === 'assigned' || doc.status === 'accepted' || doc.status === 'rejected') {
      if (doc.pedido_manual === normalized) {
        const existingEvent = db.prepare(
          `SELECT id FROM ingestion_events WHERE document_id = ? LIMIT 1`
        ).get(doc.id) as any;
        return {
          documentId: doc.id,
          pedidoManual: normalized,
          eventId: existingEvent?.id ?? '(no event)',
          warnedDirection: false,
        };
      }
      if (doc.pedido_manual && doc.pedido_manual !== normalized) {
        throw new Error(
          `Document is already linked to pedido ${doc.pedido_manual}. Cannot relink to ${normalized}.`
        );
      }
    }
    throw new Error(
      `Document status is '${doc.status}'. Only pending documents can be linked.`
    );
  }

  db.prepare(
    `UPDATE documentos SET pedido_manual = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?`
  ).run(normalized, doc.id);

  const isNf = doc.tipo_documento === 'nf' || doc.tipo_documento === 'nf_xml' || doc.tipo_documento === 'nf_pdf';
  const directionUnknown = !doc.direcao_nf || doc.direcao_nf === 'desconhecida';
  let warnedDirection = false;
  if (isNf && directionUnknown) {
    warnedDirection = true;
  }

  const eventId = randomUUID();
  const driveFileId: string = doc.drive_file_id ?? '';
  const storageUri: string = doc.storage_uri ?? (driveFileId ? `gdrive://file/${driveFileId}` : '');

  const event = {
    schema_version: 1,
    event_type: 'document.linked',
    event_id: eventId,
    created_at: new Date().toISOString(),
    pedido_manual: normalized,
    source: 'gmail',
    gmail_message_id: doc.gmail_message_id,
    thread_id: doc.thread_id,
    document: {
      document_id: doc.id,
      tipo_documento: doc.tipo_documento,
      filename_original: doc.filename_original,
      sha256: doc.sha256,
      storage_backend: 'google_drive',
      storage_uri: storageUri,
      drive_file_id: driveFileId,
      drive_folder_id: doc.drive_folder_id ?? undefined,
      drive_web_view_link: doc.drive_web_view_link ?? undefined,
      drive_web_content_link: doc.drive_web_content_link ?? undefined,
      local_cache_path: doc.local_cache_path ?? undefined,
    },
    status: 'pending_app_acceptance',
  };

  if (!isEventDuplicate(eventId)) {
    db.prepare(
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
      doc.storage_uri ?? null,
      doc.drive_file_id ?? null,
      doc.drive_web_view_link ?? null,
      null,
      null,
    );
    appendEvent(event as any);
  }

  return {
    documentId: doc.id,
    pedidoManual: normalized,
    eventId,
    warnedDirection,
  };
}
