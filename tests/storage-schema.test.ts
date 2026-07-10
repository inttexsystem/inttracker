import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb, closeDb, ensureLocalMigrations, ensureCheckMigration } from '../src/storage/sqlite.js';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

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

  it('persists canonical Gmail email timestamp fields separately from created_at', () => {
    const db = getDb();
    const columns = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = columns.map((column) => column.name);
    expect(names).toEqual(expect.arrayContaining([
      'email_message_id', 'email_received_at', 'email_received_at_source', 'email_received_at_estimated',
    ]));
    db.prepare(`INSERT INTO emails_processados (gmail_message_id) VALUES (?)`).run('email-ts-message');
    db.prepare(`INSERT INTO documentos (
      id, gmail_message_id, attachment_id, filename_original, sha256,
      email_message_id, email_received_at, email_received_at_source, email_received_at_estimated, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('email-ts-doc', 'email-ts-message', 'attachment', 'nota.pdf', 'sha-email-ts',
        'email-ts-message', '2026-07-09T09:00:00.000Z', 'gmail_internal_date', 0, '2026-07-09 12:00:00');
    const row = db.prepare(`SELECT email_received_at, email_received_at_source, email_received_at_estimated, created_at
      FROM documentos WHERE id = ?`).get('email-ts-doc') as any;
    expect(row).toMatchObject({
      email_received_at: '2026-07-09T09:00:00.000Z', email_received_at_source: 'gmail_internal_date',
      email_received_at_estimated: 0, created_at: '2026-07-09 12:00:00',
    });
    const index = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`)
      .get('idx_documentos_email_received_at');
    expect(index).toBeTruthy();
  });

  it('creates the sender_email column for a new database', () => {
    const db = getDb();
    const names = (db.prepare(`PRAGMA table_info(documentos)`).all() as any[]).map((column) => column.name);
    expect(names).toContain('sender_email');
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

  it('migrates email timestamp columns and index on a legacy database without losing rows', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO emails_processados (gmail_message_id) VALUES (?)`).run('legacy-email-message');
    db.prepare(`INSERT INTO documentos (
      id, gmail_message_id, attachment_id, filename_original, sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('legacy-email-doc', 'legacy-email-message', 'legacy.pdf', 'legacy.pdf', 'legacy-sha', '2026-07-10 18:00:00');

    expect(() => ensureLocalMigrations(db)).not.toThrow();
    expect(() => ensureLocalMigrations(db)).not.toThrow();

    const columns = db.prepare(`PRAGMA table_info(documentos)`).all() as any[];
    const names = columns.map((column: any) => column.name);
    expect(names).toEqual(expect.arrayContaining([
      'email_message_id', 'email_received_at', 'email_received_at_source', 'email_received_at_estimated',
    ]));
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`)
      .all('idx_documentos_email_received_at') as any[];
    expect(indexes).toHaveLength(1);
    expect(db.prepare(`SELECT id, filename_original, created_at FROM documentos WHERE id = ?`)
      .get('legacy-email-doc')).toMatchObject({
      id: 'legacy-email-doc', filename_original: 'legacy.pdf', created_at: '2026-07-10 18:00:00',
    });
    db.close();
  });

  it('adds sender_email on a legacy database without replacing existing data', () => {
    const db = openOldDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run('legacy-sender-doc', 'legacy-sender-message', 'legacy-sender-att', 'legacy-sender.pdf', 'legacy-sender-sha', '2026-07-10 18:00:00');

    expect(() => ensureLocalMigrations(db)).not.toThrow();
    expect(() => ensureLocalMigrations(db)).not.toThrow();

    const row = db.prepare(`SELECT filename_original, sender_email FROM documentos WHERE id = ?`)
      .get('legacy-sender-doc') as any;
    expect(row.filename_original).toBe('legacy-sender.pdf');
    expect(row.sender_email).toBeNull();
    db.close();
  });

  it('opens a legacy database through the real getDb startup flow', () => {
    const dbPath = join(MIG_DB_DIR, 'startup-legacy.db');
    const legacy = new Database(dbPath);
    createOldDb(legacy);
    legacy.prepare(`INSERT INTO emails_processados (gmail_message_id) VALUES (?)`).run('startup-legacy-message');
    legacy.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256)
      VALUES (?, ?, ?, ?, ?)`)
      .run('startup-legacy-doc', 'startup-legacy-message', 'legacy.pdf', 'legacy.pdf', 'startup-sha');
    legacy.close();

    const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    execFileSync(process.execPath, [tsxCli, '-e', "import { getDb, closeDb } from './src/storage/sqlite.ts'; getDb(); closeDb();"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: dbPath },
      stdio: 'pipe',
    });

    const migrated = new Database(dbPath, { readonly: true });
    expect(migrated.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`)
      .get('idx_documentos_email_received_at')).toBeTruthy();
    expect(migrated.prepare(`SELECT id FROM documentos WHERE id = ?`).get('startup-legacy-doc'))
      .toMatchObject({ id: 'startup-legacy-doc' });
    migrated.close();
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

const CHECK_DB_DIR = join(tmpdir(), `ravatex-check-test-${randomUUID()}`);

function createDbWithOldCheck(db: Database.Database): void {
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
    tipo_documento TEXT NOT NULL DEFAULT 'desconhecido'
      CHECK (tipo_documento IN ('nf_xml', 'nf_pdf', 'romaneio', 'desconhecido')),
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

describe('SQLite CHECK constraint rebuild (pre-G1 legacy CHECK)', () => {
  beforeEach(() => {
    if (existsSync(CHECK_DB_DIR)) rmSync(CHECK_DB_DIR, { recursive: true });
    mkdirSync(CHECK_DB_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CHECK_DB_DIR)) rmSync(CHECK_DB_DIR, { recursive: true });
  });

  function openLegacyDb(): Database.Database {
    const dbPath = join(CHECK_DB_DIR, 'legacy-check.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    createDbWithOldCheck(db);
    return db;
  }

  it('detects old CHECK and rebuilds table', () => {
    const db = openLegacyDb();
    const oldSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='documentos'`).get() as any;
    expect(oldSql.sql).toContain("'nf_xml'");
    expect(oldSql.sql).not.toContain("'nf', 'romaneio'");

    ensureLocalMigrations(db);
    ensureCheckMigration(db);

    const newSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='documentos'`).get() as any;
    expect(newSql.sql).toContain("'nf', 'romaneio', 'desconhecido', 'nf_xml', 'nf_pdf'");
    db.close();
  });

  it('preserves existing data after CHECK rebuild', () => {
    const db = openLegacyDb();
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento, drive_file_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('ck1', 'm1', 'a1', 'nota.xml', 'sha-ck1', 'nf_xml', 'drive-ck1', 'pending');
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento, drive_file_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('ck2', 'm1', 'a2', 'nota.pdf', 'sha-ck2', 'nf_pdf', 'drive-ck2', 'assigned');

    ensureLocalMigrations(db);
    ensureCheckMigration(db);

    const rows = db.prepare(`SELECT id, tipo_documento, drive_file_id, status FROM documentos ORDER BY id`).all() as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('ck1');
    expect(rows[0].tipo_documento).toBe('nf_xml');
    expect(rows[0].drive_file_id).toBe('drive-ck1');
    expect(rows[1].id).toBe('ck2');
    expect(rows[1].status).toBe('assigned');
    db.close();
  });

  it('accepts new tipo_documento=nf after CHECK rebuild', () => {
    const db = openLegacyDb();
    ensureLocalMigrations(db);
    ensureCheckMigration(db);

    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('m2');
    expect(() => {
      db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('ck3', 'm2', 'a1', 'nfe.xml', 'sha-ck3', 'nf', 'xml', 'entrada');
    }).not.toThrow();
    db.close();
  });

  it('CHECK rebuild is idempotent', () => {
    const db = openLegacyDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('m3');
    db.prepare(`INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256, tipo_documento) VALUES (?, ?, ?, ?, ?, ?)`).run('ck4', 'm3', 'a1', 'r.pdf', 'sha-ck4', 'nf_pdf');

    ensureLocalMigrations(db);
    ensureCheckMigration(db);
    ensureCheckMigration(db);

    const rows = db.prepare(`SELECT COUNT(*) AS c FROM documentos`).get() as any;
    expect(rows.c).toBe(1);
    const doc = db.prepare(`SELECT tipo_documento, formato FROM documentos WHERE id = ?`).get('ck4') as any;
    expect(doc.tipo_documento).toBe('nf_pdf');
    expect(doc.formato).toBe('pdf');
    db.close();
  });

  it('indexes are preserved after CHECK rebuild', () => {
    const db = openLegacyDb();
    ensureLocalMigrations(db);
    ensureCheckMigration(db);

    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='documentos'`).all() as any[];
    const names = indexes.map((i: any) => i.name);
    expect(names).toContain('idx_documentos_dedup');
    expect(names).toContain('idx_documentos_drive_file_id');
    db.close();
  });
});
