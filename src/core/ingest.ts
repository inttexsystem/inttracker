import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../storage/sqlite.js';
import { classifyAttachment } from './classifier.js';
import { isDuplicate, isEmailProcessed, markEmailProcessed } from './dedupe.js';
import { pendentePath } from './paths.js';
import { appendEvent, isEventDuplicate } from './outbox.js';
import { normalizePedido } from './pedido.js';
import { addDocumentToManifest, loadManifest } from './manifest.js';
import { pedidoPath, pedidoDocumentPath, manifestPath } from './paths.js';
import { createDocumentEvent } from '../types/event.js';
import type { RawAttachment, TipoDocumento } from '../types/document.js';

export async function scanGmail(options: { daysBack?: number } = {}): Promise<number> {
  console.log('[scanGmail] Structure prepared — Gmail connector not yet wired.');
  console.log('[scanGmail] Would scan emails with daysBack=%d', options.daysBack ?? 7);
  return 0;
}

export interface AssignResult {
  documentId: string;
  pedidoManual: string;
  eventId: string;
}

export function assignPedido(
  emailOrDocumentId: string,
  pedidoManual: string,
): AssignResult | null {
  const normalized = normalizePedido(pedidoManual);
  if (!normalized) {
    console.error('Invalid pedido format:', pedidoManual);
    return null;
  }

  const database = getDb();

  const doc = database.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(emailOrDocumentId, emailOrDocumentId) as any;

  if (!doc) {
    console.error('Document not found:', emailOrDocumentId);
    return null;
  }

  if (doc.status !== 'pending') {
    console.log('Document already assigned (status=%s)', doc.status);
    return null;
  }

  const eventId = randomUUID();
  const tipo = doc.tipo_documento as TipoDocumento;

  const destDir = pedidoPath(normalized);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const destFile = pedidoDocumentPath(normalized, tipo, doc.filename_original);
  const destDirFile = join(destDir, pdfSubfolder(tipo));
  if (!existsSync(destDirFile)) {
    mkdirSync(destDirFile, { recursive: true });
  }

  const destPath = destFile;
  const pendingPath = doc.local_path;
  if (existsSync(pendingPath)) {
    copyFileSync(pendingPath, destPath);
  }

  const mPath = manifestPath(normalized);
  const relDestPath = join('pedidos', normalized, todayDir(), pdfSubfolder(tipo), doc.filename_original);

  addDocumentToManifest(mPath, normalized, {
    document_id: doc.id,
    tipo_documento: tipo,
    filename_original: doc.filename_original,
    sha256: doc.sha256,
    local_path: relDestPath,
    ingested_at: new Date().toISOString(),
    event_id: eventId,
    status: 'pending_app_acceptance',
  });

  database.prepare(
    `UPDATE documentos SET status = 'assigned', pedido_manual = ?, updated_at = datetime('now'), local_path = ? WHERE id = ?`
  ).run(normalized, relDestPath, doc.id);

  const event = createDocumentEvent({
    eventId,
    pedidoManual: normalized,
    gmailMessageId: doc.gmail_message_id,
    threadId: doc.thread_id,
    documentId: doc.id,
    tipoDocumento: tipo,
    filenameOriginal: doc.filename_original,
    sha256: doc.sha256,
    localPath: relDestPath,
    manifestPath: join('pedidos', normalized, 'manifest.json'),
    status: 'pending_app_acceptance',
  });

  if (!isEventDuplicate(eventId)) {
    database.prepare(
      `INSERT INTO ingestion_events (id, event_type, pedido_manual, document_id, status) VALUES (?, ?, ?, ?, ?)`
    ).run(eventId, 'document.detected', normalized, doc.id, 'pending_app_acceptance');

    appendEvent(event);
  }

  return { documentId: doc.id, pedidoManual: normalized, eventId };
}

function todayDir(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pdfSubfolder(tipo: TipoDocumento): string {
  const map: Record<TipoDocumento, string> = {
    nf_pdf: 'nf',
    nf_xml: 'nf',
    romaneio: 'romaneio',
    desconhecido: 'desconhecido',
  };
  return map[tipo];
}

export function listPending(): any[] {
  const database = getDb();
  return database.prepare(
    `SELECT * FROM documentos WHERE status = 'pending' ORDER BY created_at DESC`
  ).all();
}

export function getDocumentEvents(): any[] {
  const database = getDb();
  return database.prepare(
    `SELECT * FROM ingestion_events ORDER BY created_at DESC`
  ).all();
}

export { classifyAttachment } from './classifier.js';
export { normalizePedido } from './pedido.js';
export { exportPendingEvents } from './outbox.js';
