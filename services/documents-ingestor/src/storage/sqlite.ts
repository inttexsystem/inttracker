import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = dirname(config.databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  ensureLocalMigrations(db);
  ensureCheckMigration(db);
  return db;
}

function runMigrations(database: Database.Database): void {
  const schemaPath = resolve(import.meta.dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
}

export function ensureLocalMigrations(database: Database.Database): void {
  const cols = database.prepare(`PRAGMA table_info(documentos)`).all() as any[];
  const colNames = new Set(cols.map((c: any) => c.name));

  if (!colNames.has('formato')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN formato TEXT NOT NULL DEFAULT 'desconhecido'`);
  }
  if (!colNames.has('direcao_nf')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN direcao_nf TEXT`);
  }
  if (!colNames.has('email_message_id')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN email_message_id TEXT`);
  }
  if (!colNames.has('sender_email')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN sender_email TEXT`);
  }
  if (!colNames.has('email_received_at')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN email_received_at TEXT`);
  }
  if (!colNames.has('email_received_at_source')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN email_received_at_source TEXT`);
  }
  if (!colNames.has('email_received_at_estimated')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN email_received_at_estimated INTEGER NOT NULL DEFAULT 0`);
  }
  if (!colNames.has('cnpj_emitente')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN cnpj_emitente TEXT`);
  }
  if (!colNames.has('cnpj_destinatario')) {
    database.exec(`ALTER TABLE documentos ADD COLUMN cnpj_destinatario TEXT`);
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_documentos_email_received_at ON documentos(email_received_at DESC)`);

  database.exec(`
    UPDATE documentos SET formato = 'xml', direcao_nf = 'desconhecida'
      WHERE tipo_documento = 'nf_xml' AND formato IN ('desconhecido', '');

    UPDATE documentos SET formato = 'pdf', direcao_nf = NULL
      WHERE tipo_documento = 'nf_pdf' AND formato IN ('desconhecido', '');

    UPDATE documentos SET formato = 'pdf', direcao_nf = NULL
      WHERE tipo_documento = 'romaneio' AND formato IN ('desconhecido', '');

    UPDATE documentos SET formato = 'desconhecido', direcao_nf = NULL
      WHERE tipo_documento = 'desconhecido' AND formato IN ('desconhecido', '');
  `);

  const eventCols = database.prepare(`PRAGMA table_info(ingestion_events)`).all() as any[];
  const eventColNames = new Set(eventCols.map((c: any) => c.name));
  if (eventCols.length > 0 && !eventColNames.has('reason')) {
    database.exec(`ALTER TABLE ingestion_events ADD COLUMN reason TEXT`);
  }
}

export function ensureCheckMigration(database: Database.Database): void {
  const tableRow = database.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='documentos'`
  ).get() as { sql: string } | undefined;

  if (!tableRow || !tableRow.sql) return;

  const sql: string = tableRow.sql;
  const needsRebuild =
    sql.includes("'nf_xml'") && sql.includes("'nf_pdf'") &&
    !sql.includes("'nf', 'romaneio'");

  if (!needsRebuild) return;

  database.exec('PRAGMA foreign_keys = OFF');

  const createSql = `CREATE TABLE documentos_new (
    id TEXT PRIMARY KEY,
    gmail_message_id TEXT NOT NULL,
    thread_id TEXT NOT NULL DEFAULT '',
    attachment_id TEXT NOT NULL,
    filename_original TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    sender_email TEXT,
    email_message_id TEXT,
    email_received_at TEXT,
    email_received_at_source TEXT,
    email_received_at_estimated INTEGER NOT NULL DEFAULT 0,
    tipo_documento TEXT NOT NULL DEFAULT 'desconhecido'
      CHECK (tipo_documento IN ('nf', 'romaneio', 'desconhecido', 'nf_xml', 'nf_pdf')),
    formato TEXT NOT NULL DEFAULT 'desconhecido'
      CHECK (formato IN ('pdf', 'xml', 'desconhecido')),
    direcao_nf TEXT
      CHECK (direcao_nf IS NULL OR direcao_nf IN ('entrada', 'saida', 'desconhecida')),
    cnpj_emitente TEXT,
    cnpj_destinatario TEXT,
    storage_backend TEXT NOT NULL DEFAULT 'google_drive',
    storage_uri TEXT,
    drive_file_id TEXT,
    drive_folder_id TEXT,
    drive_web_view_link TEXT,
    drive_web_content_link TEXT,
    local_cache_path TEXT,
    local_path TEXT,
    pedido_manual TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'assigned', 'accepted', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (gmail_message_id) REFERENCES emails_processados(gmail_message_id)
  )`;

  database.exec('BEGIN');
  database.exec(createSql);

  const cols = database.prepare(`PRAGMA table_info(documentos)`).all() as any[];
  const colList = cols.map((c: any) => c.name).join(', ');

  database.exec(`INSERT INTO documentos_new (${colList}) SELECT ${colList} FROM documentos`);
  database.exec('DROP TABLE documentos');
  database.exec('ALTER TABLE documentos_new RENAME TO documentos');
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_dedup
      ON documentos(gmail_message_id, attachment_id, sha256)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_documentos_drive_file_id
      ON documentos(drive_file_id)
  `);
  database.exec('COMMIT');
  database.exec('PRAGMA foreign_keys = ON');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDbPath(): string {
  return config.databasePath;
}
