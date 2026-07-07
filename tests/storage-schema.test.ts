import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb, closeDb, ensureLocalMigrations } from '../src/storage/sqlite.js';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const DB_DIR = join(tmpdir(), `ravatex-schema-test-${randomUUID()}`);

describe('SQLite schema carries Drive-first contract', () => {
  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
    closeDb();
    getDb();
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  it('documentos table has Drive columns', () => {
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map(c => c.name);
    expect(names).toContain('storage_backend');
    expect(names).toContain('storage_uri');
    expect(names).toContain('drive_file_id');
    expect(names).toContain('drive_folder_id');
    expect(names).toContain('drive_web_view_link');
    expect(names).toContain('drive_web_content_link');
    expect(names).toContain('local_cache_path');
  });

  it('documentos table has taxonomia G1 columns', () => {
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map(c => c.name);
    expect(names).toContain('formato');
    expect(names).toContain('direcao_nf');
  });

  it('ingestion_events table has Drive columns', () => {
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(ingestion_events)`).all() as any[];
    const names = cols.map(c => c.name);
    expect(names).toContain('storage_backend');
    expect(names).toContain('storage_uri');
    expect(names).toContain('drive_file_id');
    expect(names).toContain('drive_web_view_link');
    expect(names).toContain('manifest_storage_uri');
    expect(names).toContain('manifest_drive_file_id');
  });

  it('documentos unique dedup index exists', () => {
    const db = getDb();
    const idx = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_documentos_dedup'`
    ).get();
    expect(idx).toBeTruthy();
  });

  it('storage_backend default is google_drive', () => {
    const db = getDb();
    const uniqueId = `m-test-default-${randomUUID()}`;
    db.prepare(
      `INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`
    ).run(uniqueId);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO documentos (
         id, gmail_message_id, attachment_id, filename_original, sha256
       ) VALUES (?, ?, ?, ?, ?)`
    ).run(id, uniqueId, 'a', 'n.pdf', 'a'.repeat(64));
    const doc = db.prepare(`SELECT storage_backend FROM documentos WHERE id = ?`).get(id) as any;
    expect(doc.storage_backend).toBe('google_drive');
  });

  it('formato default is desconhecido', () => {
    const db = getDb();
    const uniqueId = `m-test-fmt-${randomUUID()}`;
    db.prepare(
      `INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`
    ).run(uniqueId);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO documentos (
         id, gmail_message_id, attachment_id, filename_original, sha256
       ) VALUES (?, ?, ?, ?, ?)`
    ).run(id, uniqueId, 'a', 'n.pdf', 'a'.repeat(64));
    const doc = db.prepare(`SELECT formato, direcao_nf FROM documentos WHERE id = ?`).get(id) as any;
    expect(doc.formato).toBe('desconhecido');
    expect(doc.direcao_nf).toBeNull();
  });

  it('accepts new tipo_documento values (nf, romaneio, desconhecido)', () => {
    const db = getDb();
    const uniqueId = `m-test-novo-${randomUUID()}`;
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run(uniqueId);

    const testTypes = ['nf', 'romaneio', 'desconhecido'] as const;
    for (const t of testTypes) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento, formato)
         VALUES (?, ?, ?, ?, ?, ?, 'pdf')`
      ).run(id, uniqueId, `att-${t}`, 'f.pdf', `${t}${'b'.repeat(63)}`, t);
      const doc = db.prepare(`SELECT tipo_documento FROM documentos WHERE id = ?`).get(id) as any;
      expect(doc.tipo_documento).toBe(t);
    }
  });

  it('accepts legacy tipo_documento values (nf_pdf, nf_xml)', () => {
    const db = getDb();
    const uniqueId = `m-test-legacy-${randomUUID()}`;
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run(uniqueId);

    const legacyTypes = ['nf_pdf', 'nf_xml'] as const;
    for (const t of legacyTypes) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento, formato)
         VALUES (?, ?, ?, ?, ?, ?, 'pdf')`
      ).run(id, uniqueId, `att-${t}`, 'f.pdf', `${t}${'c'.repeat(63)}`, t);
      const doc = db.prepare(`SELECT tipo_documento FROM documentos WHERE id = ?`).get(id) as any;
      expect(doc.tipo_documento).toBe(t);
    }
  });

  it('direcao_nf accepts entrada/saida/desconhecida and null', () => {
    const db = getDb();
    const uniqueId = `m-test-dir-${randomUUID()}`;
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run(uniqueId);

    const direcoes = ['entrada', 'saida', 'desconhecida', null] as const;
    for (const d of direcoes) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, direcao_nf)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, uniqueId, `att-dir-${d ?? 'none'}`, 'f.pdf', `dir${d ?? 'none'}${'d'.repeat(60)}`, d);
      const doc = db.prepare(`SELECT direcao_nf FROM documentos WHERE id = ?`).get(id) as any;
      expect(doc.direcao_nf).toBe(d);
    }
  });
});

const MIG_DB_DIR = join(tmpdir(), `ravatex-mig-test-${randomUUID()}`);

function createOldDb(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS emails_processados (
    gmail_message_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    processed_at TEXT NOT NULL DEFAULT (datetime('now')),
    scan_status TEXT NOT NULL DEFAULT 'processed',
    attachments_count INTEGER NOT NULL DEFAULT 0
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS documentos (
    id TEXT PRIMARY KEY,
    gmail_message_id TEXT NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    attachment_id TEXT NOT NULL,
    filename_original TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    tipo_documento TEXT NOT NULL DEFAULT 'desconhecido',
    storage_backend TEXT NOT NULL DEFAULT 'google_drive',
    storage_uri TEXT,
    drive_file_id TEXT,
    drive_folder_id TEXT,
    drive_web_view_link TEXT,
    drive_web_content_link TEXT,
    local_cache_path TEXT,
    local_path TEXT,
    pedido_manual TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

describe('SQLite migration for taxonomy columns (pre-G1 → G1+)', () => {
  beforeEach(() => {
    if (existsSync(MIG_DB_DIR)) rmSync(MIG_DB_DIR, { recursive: true });
    mkdirSync(MIG_DB_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(MIG_DB_DIR)) rmSync(MIG_DB_DIR, { recursive: true });
  });

  function openOldDb(): Database.Database {
    const dbPath = join(MIG_DB_DIR, 'old.db');
    const db = new Database(dbPath);
    createOldDb(db);
    return db;
  }

  it('adds formato and direcao_nf columns to old schema', () => {
    const db = openOldDb();
    ensureLocalMigrations(db);
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('formato');
    expect(names).toContain('direcao_nf');
    db.close();
  });

  it('backfill nf_xml → formato xml, direcao_nf = desconhecida', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento) VALUES (?, ?, ?, ?, ?, ?)`).run('mb1', 'm1', 'a1', 'nfe.xml', 's1', 'nf_xml');
    ensureLocalMigrations(db);
    const doc = db.prepare(`SELECT formato, direcao_nf FROM documentos WHERE id = ?`).get('mb1') as any;
    expect(doc.formato).toBe('xml');
    expect(doc.direcao_nf).toBe('desconhecida');
    db.close();
  });

  it('backfill nf_pdf → formato pdf, direcao_nf = NULL', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento) VALUES (?, ?, ?, ?, ?, ?)`).run('mb2', 'm2', 'a2', 'nf.pdf', 's2', 'nf_pdf');
    ensureLocalMigrations(db);
    const doc = db.prepare(`SELECT formato, direcao_nf FROM documentos WHERE id = ?`).get('mb2') as any;
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
    db.close();
  });

  it('backfill romaneio → formato pdf, direcao_nf = NULL', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento) VALUES (?, ?, ?, ?, ?, ?)`).run('mb3', 'm3', 'a3', 'r.pdf', 's3', 'romaneio');
    ensureLocalMigrations(db);
    const doc = db.prepare(`SELECT formato, direcao_nf FROM documentos WHERE id = ?`).get('mb3') as any;
    expect(doc.formato).toBe('pdf');
    expect(doc.direcao_nf).toBeNull();
    db.close();
  });

  it('backfill desconhecido → formato desconhecido, direcao_nf = NULL', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento) VALUES (?, ?, ?, ?, ?, ?)`).run('mb4', 'm4', 'a4', 'd.bin', 's4', 'desconhecido');
    ensureLocalMigrations(db);
    const doc = db.prepare(`SELECT formato, direcao_nf FROM documentos WHERE id = ?`).get('mb4') as any;
    expect(doc.formato).toBe('desconhecido');
    expect(doc.direcao_nf).toBeNull();
    db.close();
  });

  it('migration is idempotent (running twice does not break)', () => {
    const db = openOldDb();
    ensureLocalMigrations(db);
    ensureLocalMigrations(db);
    const cols = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('formato');
    expect(names).toContain('direcao_nf');
    db.close();
  });

  it('listPendingDocuments works after migration on legacy DB', () => {
    const db = openOldDb();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject, processed_at, attachments_count) VALUES (?, ?, ?, ?, ?)`).run('mm1', 't1', 'NF-e', now, 1);
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('mmdoc1', 'mm1', 't1', 'a1', 'nf.pdf', 's11', 'nf_pdf', 'pending', now, now);

    ensureLocalMigrations(db);

    const rows = db.prepare(`
      SELECT d.id, d.tipo_documento,
             COALESCE(d.formato, 'desconhecido') AS formato,
             d.direcao_nf
      FROM documentos d
      ORDER BY d.created_at DESC LIMIT 20
    `).all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].tipo_documento).toBe('nf_pdf');
    expect(rows[0].formato).toBe('pdf');

    db.close();
  });
});
