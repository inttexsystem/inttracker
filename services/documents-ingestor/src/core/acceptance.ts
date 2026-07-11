import { randomUUID } from 'node:crypto';
import { getDb } from '../storage/sqlite.js';
import { appendEvent, isEventDuplicate } from './outbox.js';

export interface AcceptanceResult {
  documentId: string;
  pedidoManual: string;
  status: 'accepted' | 'rejected';
  eventId: string;
}

function buildEvent(doc: any, docStatus: 'accepted' | 'rejected', eventId: string, reason?: string) {
  const driveFileId: string = doc.drive_file_id ?? '';
  const storageUri: string = doc.storage_uri ?? (driveFileId ? `gdrive://file/${driveFileId}` : '');

  const document: Record<string, any> = {
    document_id: doc.id,
    tipo_documento: doc.tipo_documento,
    filename_original: doc.filename_original,
    sha256: doc.sha256,
    storage_backend: 'google_drive',
    storage_uri: storageUri,
    drive_file_id: driveFileId,
  };
  if (doc.formato) document.formato = doc.formato;
  if (doc.direcao_nf) document.direcao_nf = doc.direcao_nf;
  if (reason) document.reason = reason;

  return {
    schema_version: 1,
    event_type: docStatus === 'accepted' ? 'document.accepted' : 'document.rejected',
    event_id: eventId,
    created_at: new Date().toISOString(),
    pedido_manual: doc.pedido_manual,
    source: 'gmail',
    gmail_message_id: doc.gmail_message_id,
    thread_id: doc.thread_id,
    document,
    status: docStatus,
  };
}

export function acceptDocument(emailOrDocumentId: string): AcceptanceResult {
  const db = getDb();
  const doc = db.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(emailOrDocumentId, emailOrDocumentId) as any;

  if (!doc) {
    throw new Error(`Document not found: ${emailOrDocumentId}`);
  }

  if (doc.status !== 'assigned') {
    if (doc.status === 'accepted') {
      const existingEvent = db.prepare(
        `SELECT id FROM ingestion_events WHERE document_id = ? AND status = 'accepted' LIMIT 1`
      ).get(doc.id) as any;
      return {
        documentId: doc.id,
        pedidoManual: doc.pedido_manual ?? '',
        status: 'accepted',
        eventId: existingEvent?.id ?? '(no event)',
      };
    }
    if (doc.status === 'rejected') {
      throw new Error('Document is already rejected. Cannot accept a rejected document.');
    }
    if (doc.status === 'pending') {
      throw new Error("Document is not linked to a pedido. Use 'link' first to assign a pedido.");
    }
  }

  if (!doc.pedido_manual) {
    throw new Error("Document has no pedido assigned. Use 'link' first to assign a pedido.");
  }

  db.prepare(
    `UPDATE documentos SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`
  ).run(doc.id);

  const eventId = randomUUID();
  const event = buildEvent(doc, 'accepted', eventId);

  if (!isEventDuplicate(eventId)) {
    db.prepare(
      `INSERT INTO ingestion_events (
         id, event_type, pedido_manual, document_id, status,
         storage_backend, storage_uri, drive_file_id, drive_web_view_link,
         manifest_storage_uri, manifest_drive_file_id, reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      'document.accepted',
      doc.pedido_manual,
      doc.id,
      'accepted',
      'google_drive',
      doc.storage_uri ?? null,
      doc.drive_file_id ?? null,
      doc.drive_web_view_link ?? null,
      null,
      null,
      null,
    );
    appendEvent(event as any);
  }

  return {
    documentId: doc.id,
    pedidoManual: doc.pedido_manual,
    status: 'accepted',
    eventId,
  };
}

export function rejectDocument(emailOrDocumentId: string, reason?: string): AcceptanceResult {
  const db = getDb();
  const doc = db.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(emailOrDocumentId, emailOrDocumentId) as any;

  if (!doc) {
    throw new Error(`Document not found: ${emailOrDocumentId}`);
  }

  if (doc.status !== 'assigned') {
    if (doc.status === 'rejected') {
      const existingEvent = db.prepare(
        `SELECT id FROM ingestion_events WHERE document_id = ? AND status = 'rejected' LIMIT 1`
      ).get(doc.id) as any;
      return {
        documentId: doc.id,
        pedidoManual: doc.pedido_manual ?? '',
        status: 'rejected',
        eventId: existingEvent?.id ?? '(no event)',
      };
    }
    if (doc.status === 'accepted') {
      throw new Error('Document is already accepted. Cannot reject an accepted document.');
    }
    if (doc.status === 'pending') {
      throw new Error("Document is not linked to a pedido. Use 'link' first to assign a pedido.");
    }
  }

  if (!doc.pedido_manual) {
    throw new Error("Document has no pedido assigned. Use 'link' first to assign a pedido.");
  }

  db.prepare(
    `UPDATE documentos SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`
  ).run(doc.id);

  const eventId = randomUUID();
  const event = buildEvent(doc, 'rejected', eventId, reason);

  if (!isEventDuplicate(eventId)) {
    db.prepare(
      `INSERT INTO ingestion_events (
         id, event_type, pedido_manual, document_id, status,
         storage_backend, storage_uri, drive_file_id, drive_web_view_link,
         manifest_storage_uri, manifest_drive_file_id, reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      'document.rejected',
      doc.pedido_manual,
      doc.id,
      'rejected',
      'google_drive',
      doc.storage_uri ?? null,
      doc.drive_file_id ?? null,
      doc.drive_web_view_link ?? null,
      null,
      null,
      reason ?? null,
    );
    appendEvent(event as any);
  }

  return {
    documentId: doc.id,
    pedidoManual: doc.pedido_manual,
    status: 'rejected',
    eventId,
  };
}
