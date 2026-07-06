import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import type { DocumentEvent } from '../types/event.js';
import { getDb } from '../storage/sqlite.js';

export function appendEvent(event: DocumentEvent): void {
  const dir = dirname(config.outboxPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(config.outboxPath, JSON.stringify(event) + '\n', 'utf-8');
}

export function exportPendingEvents(): DocumentEvent[] {
  const database = getDb();
  const rows = database.prepare(
    `SELECT id FROM ingestion_events WHERE exported_at IS NULL`
  ).all() as { id: string }[];

  const events: DocumentEvent[] = [];
  for (const row of rows) {
    const doc = database.prepare(
      `SELECT d.*, e.pedido_manual, e.event_type, e.status AS event_status
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
  return {
    schema_version: 1,
    event_type: 'document.detected',
    event_id: row.id,
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
      local_path: row.local_path,
      manifest_path: row.manifest_path ?? '',
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
