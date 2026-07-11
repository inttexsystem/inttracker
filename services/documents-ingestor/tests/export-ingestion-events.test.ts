import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from '../src/storage/sqlite.js';
import { exportIngestionEvents, listIngestionEvents } from '../src/core/exportPackage.js';
import { runSyncSupabase } from '../src/core/syncSupabase.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `export-ingestion-events-${randomUUID()}`);

function seedEvent(database: any, overrides: Record<string, unknown> = {}): string {
  const id = String(overrides.id ?? randomUUID());
  const documentId = String(overrides.document_id ?? 'doc-export-001');
  const gmailMessageId = `msg-${documentId}`;
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject) VALUES (?, ?, ?)`
  ).run(gmailMessageId, `thread-${documentId}`, 'Canonical export test');
  database.prepare(`
    INSERT OR IGNORE INTO documentos (
      id, gmail_message_id, thread_id, attachment_id, filename_original,
      sha256, tipo_documento, formato, direcao_nf,
      storage_backend, storage_uri, drive_file_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    gmailMessageId,
    `thread-${documentId}`,
    `attachment-${documentId}`,
    'canonical-export.xml',
    'a'.repeat(64),
    'nf',
    'xml',
    'entrada',
    'google_drive',
    'gdrive://file/canonical-export',
    'drive-canonical-export',
    'pending',
  );
  database.prepare(`
    INSERT INTO ingestion_events (
      id, event_type, pedido_manual, document_id, status,
      storage_backend, storage_uri, drive_file_id, drive_web_view_link,
      manifest_storage_uri, manifest_drive_file_id, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.event_type ?? 'document.detected',
    overrides.pedido_manual ?? '',
    documentId,
    overrides.status ?? 'pending_app_acceptance',
    'google_drive',
    'gdrive://file/export-001',
    'drive-export-001',
    'https://drive.example/export-001',
    null,
    null,
    overrides.reason ?? null,
    overrides.created_at ?? '2026-07-09 17:00:00',
  );
  return id;
}

beforeEach(() => {
  if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  mkdirSync(SCENARIO_DIR, { recursive: true });
  process.env.DATABASE_PATH = join(SCENARIO_DIR, 'app.db');
  process.env.OUTBOX_PATH = join(SCENARIO_DIR, 'legacy-outbox.jsonl');
  process.env.LOCAL_CACHE_PATH = join(SCENARIO_DIR, 'cache');
  closeDb();
  const db = getDb();
  db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
});

afterEach(() => {
  closeDb();
  if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
});

describe('canonical ingestion events export', () => {
  it('exports the real ingestion_events.id without event_id or synthetic IDs', () => {
    const db = getDb();
    const eventId = seedEvent(db, { id: 'real-ingestion-id-001' });
    const outputPath = join(SCENARIO_DIR, 'ingestion-events.jsonl');

    const result = exportIngestionEvents({ outputPath });
    const parsed = JSON.parse(readFileSync(outputPath, 'utf-8').trim());

    expect(result.totalEvents).toBe(1);
    expect(parsed.ingestion_event_id).toBe(eventId);
    expect(parsed).not.toHaveProperty('event_id');
    expect(parsed.payload).not.toHaveProperty('event_id');
  });

  it('normalizes pending_app_acceptance to pending and SQLite timestamps to ISO', () => {
    const db = getDb();
    seedEvent(db, { status: 'pending_app_acceptance', created_at: '2026-07-09 17:00:00' });

    const event = listIngestionEvents()[0];

    expect(event.status).toBe('pending');
    expect(event.created_at).toBe('2026-07-09T17:00:00.000Z');
  });

  it('forces document.linked to assigned', () => {
    const db = getDb();
    seedEvent(db, { event_type: 'document.linked', status: 'pending_app_acceptance' });

    expect(listIngestionEvents()[0].status).toBe('assigned');
  });

  it('rejects an ingestion event with an empty canonical ID', () => {
    const db = getDb();
    seedEvent(db, { id: '' });

    expect(() => listIngestionEvents()).toThrow(/id is required/);
  });

  it('rejects invalid event types and statuses explicitly', () => {
    const db = getDb();
    seedEvent(db, { event_type: 'document.unknown' });
    expect(() => listIngestionEvents()).toThrow(/Invalid ingestion event type/);

    db.exec('DELETE FROM ingestion_events;');
    db.pragma('ignore_check_constraints = ON');
    seedEvent(db, { status: 'unknown' });
    db.pragma('ignore_check_constraints = OFF');
    expect(() => listIngestionEvents()).toThrow(/Invalid ingestion event status/);
  });

  it('writes valid JSONL and is compatible with the writer dry-run', async () => {
    const db = getDb();
    const eventId = seedEvent(db, { document_id: 'doc-export-writer', pedido_manual: 'PED-99-2026' });
    const eventsPath = join(SCENARIO_DIR, 'ingestion-events.jsonl');
    exportIngestionEvents({ outputPath: eventsPath });

    const mappedPath = join(SCENARIO_DIR, 'mapped.jsonl');
    writeFileSync(mappedPath, JSON.stringify({
      schema_version: 1,
      document_id: 'doc-export-writer',
      status: 'pending',
      pedido_manual: 'PED-99-2026',
    }) + '\n', 'utf-8');

    const result = await runSyncSupabase({ mappedPath, eventsPath, confirmWrite: false });
    const parsed = JSON.parse(readFileSync(eventsPath, 'utf-8').trim());

    expect(parsed.ingestion_event_id).toBe(eventId);
    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.events_inserted).toBe(1);
  });

  it('does not use the legacy outbox path', () => {
    const db = getDb();
    seedEvent(db);
    const legacyOutbox = process.env.OUTBOX_PATH!;
    writeFileSync(legacyOutbox, JSON.stringify({ event_id: 'legacy-only' }) + '\n', 'utf-8');

    const events = listIngestionEvents();

    expect(events).toHaveLength(1);
    expect(events[0].ingestion_event_id).not.toBe('legacy-only');
  });
});
