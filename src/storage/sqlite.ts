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
