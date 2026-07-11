import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../config.js';
import type { DocumentEvent } from '../types/event.js';
import { getDb } from '../storage/sqlite.js';
import { buildStorageUri } from '../types/document.js';

function resolveOutboxPath(): string {
  const envPath = process.env.OUTBOX_PATH;
  if (envPath) return resolve(process.cwd(), envPath);
  return config.outboxPath;
}

export function appendEvent(event: DocumentEvent): void {
  const path = resolveOutboxPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(path, JSON.stringify(event) + '\n', 'utf-8');
}

export function exportPendingEvents(): DocumentEvent[] {
  const database = getDb();
  const rows = database.prepare(
    `SELECT id FROM ingestion_events WHERE exported_at IS NULL`
  ).all() as { id: string }[];

  const events: DocumentEvent[] = [];
  for (const row of rows) {
    const doc = database.prepare(
      `SELECT d.*, e.id AS ingestion_event_id,
              e.pedido_manual, e.event_type, e.status AS event_status,
              e.storage_uri, e.drive_file_id, e.drive_web_view_link,
              e.manifest_storage_uri, e.reason
       FROM ingestion_events e
       JOIN documentos d ON d.id = e.document_id
       WHERE e.id = ?`
    ).get(row.id) as any;

    if (!doc) continue;

    const event = buildEventFromRow(doc);
    events.push(event);
    appendEvent(event);

    database.prepare(
      `UPDATE ingestion_events SET exported_at = datetime('now') WHERE id = ?`
    ).run(row.id);
  }

  return events;
}

function buildEventFromRow(row: any): DocumentEvent {
  const driveFileId: string = row.drive_file_id ?? '';
  const storageUri: string = row.storage_uri ?? (driveFileId ? buildStorageUri(driveFileId) : '');

  return {
    schema_version: 1,
    event_type: row.event_type,
    event_id: row.id,
    ingestion_event_id: row.ingestion_event_id,
    created_at: row.created_at,
    pedido_manual: row.pedido_manual,
    source: 'gmail',
    gmail_message_id: row.gmail_message_id,
    thread_id: row.thread_id,
    document: {
      document_id: row.id,
      tipo_documento: row.tipo_documento,
      filename_original: row.filename_original,
      sha256: row.sha256,
      storage_backend: 'google_drive',
      storage_uri: storageUri,
      drive_file_id: driveFileId,
      drive_folder_id: row.drive_folder_id,
      drive_web_view_link: row.drive_web_view_link,
      drive_web_content_link: row.drive_web_content_link,
      local_cache_path: row.local_cache_path,
      manifest_storage_uri: row.manifest_storage_uri,
      ...(row.reason ? { reason: row.reason } : {}),
    },
    status: row.event_status,
  };
}

export function isEventDuplicate(eventId: string): boolean {
  const database = getDb();
  const row = database.prepare(
    `SELECT 1 FROM ingestion_events WHERE id = ? LIMIT 1`
  ).get(eventId);
  return !!row;
}

export function queryAndExportEvents(filters: {
  eventType?: string;
  pedido?: string;
} = {}): DocumentEvent[] {
  const database = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (filters.eventType) {
    where.push('e.event_type = ?');
    params.push(filters.eventType);
  }
  if (filters.pedido) {
    where.push('e.pedido_manual = ?');
    params.push(filters.pedido);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = database.prepare(
    `SELECT d.*, e.id AS ingestion_event_id,
            e.pedido_manual, e.event_type, e.status AS event_status,
            e.storage_uri, e.drive_file_id, e.drive_web_view_link,
            e.manifest_storage_uri, e.reason
     FROM ingestion_events e
     JOIN documentos d ON d.id = e.document_id
     ${whereClause}
     ORDER BY e.created_at DESC`
  ).all(...params) as any[];

  return rows.map(row => buildEventFromRow(row));
}
