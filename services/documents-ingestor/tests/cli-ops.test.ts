import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `cli-ops-${randomUUID()}`);
const CLI = join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd');

function env(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_PATH: join(SCENARIO_DIR, 'app.db'),
    OUTBOX_PATH: join(SCENARIO_DIR, 'outbox.jsonl'),
    LOCAL_CACHE_PATH: join(SCENARIO_DIR, 'cache'),
    GOOGLE_TOKEN_PATH: join(SCENARIO_DIR, '__no_token__.json'),
  };
}

function run(args: string): string {
  return execSync(`"${CLI}" src/cli.ts ${args}`, {
    cwd: process.cwd(),
    env: env(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function runAllowFailure(args: string): { stdout: string; stderr: string; code: number } {
  try {
    const out = execSync(`"${CLI}" src/cli.ts ${args} 2>&1`, {
      cwd: process.cwd(),
      env: env(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: out, stderr: '', code: 0 };
  } catch (e: any) {
    return { stdout: e.stdout?.toString() ?? e.stderr?.toString() ?? '', stderr: e.stderr?.toString() ?? '', code: e.status ?? 1 };
  }
}

async function seedData() {
  const Database = (await import('better-sqlite3')).default;
  const { readFileSync, mkdirSync } = await import('node:fs');
  const { dirname, resolve } = await import('node:path');
  const dbPath = join(SCENARIO_DIR, 'app.db');
  mkdirSync(SCENARIO_DIR, { recursive: true });
  const db = new Database(dbPath);
  const schemaPath = resolve(process.cwd(), 'src', 'storage', 'schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.exec(`DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;`);
  db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject, processed_at, attachments_count) VALUES (?, ?, ?, ?, ?)`).run('msg-cli-1', 'thr-cli-1', 'NF-e 99999', now, 1);
  db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject, processed_at, attachments_count) VALUES (?, ?, ?, ?, ?)`).run('msg-cli-2', 'thr-cli-2', 'Romaneio carga', now, 1);
  db.prepare(`INSERT INTO emails_processados (gmail_message_id, thread_id, subject, processed_at, attachments_count) VALUES (?, ?, ?, ?, ?)`).run('msg-cli-3', 'thr-cli-3', 'NF-e XML entrada', now, 1);
  db.prepare(`INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('doc-cli-1', 'msg-cli-1', 'thr-cli-1', 'att-cli-1', 'NF-99999.pdf', 'sha-cli-1', 'nf_pdf', 'pdf', null, 'google_drive', 'gdrive://file/dcli1', 'dcli1', 'pending', now, now);
  db.prepare(`INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('doc-cli-2', 'msg-cli-2', 'thr-cli-2', 'att-cli-2', 'romaneio.pdf', 'sha-cli-2', 'romaneio', 'pdf', null, 'google_drive', 'gdrive://file/dcli2', 'dcli2', 'pending', now, now);
  db.prepare(`INSERT INTO documentos (id, gmail_message_id, thread_id, attachment_id, filename_original, sha256, tipo_documento, formato, direcao_nf, storage_backend, storage_uri, drive_file_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('doc-cli-3', 'msg-cli-3', 'thr-cli-3', 'att-cli-3', 'nfe-entrada.xml', 'sha-cli-3', 'nf', 'xml', 'entrada', 'google_drive', 'gdrive://file/dcli3', 'dcli3', 'pending', now, now);
  db.close();
  void dirname;
}

describe('CLI operational commands (hermetic)', () => {
  beforeEach(async () => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    await seedData();
  });

  afterEach(async () => {
    await new Promise(r => setTimeout(r, 50));
    try {
      if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true, force: true });
    } catch {
    }
  });

  it('list-pending text mode shows masked IDs and no raw secrets', () => {
    const out = run('list-pending');
    expect(out).toContain('doc');
    expect(out).toContain('msg');
    expect(out).toContain('*');
  });

  it('list-pending --json returns structured output', () => {
    const out = run('list-pending --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(3);
    expect(parsed.documents).toBeInstanceOf(Array);
    expect(parsed.documents[0].gmail_message_id).toContain('*');
  });

  it('list-pending --limit caps at 200', () => {
    const result = runAllowFailure('list-pending --limit 9999');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('capped at 200');
  });

  it('list-pending --status filters by status', () => {
    const out = run('list-pending --status pending --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(3);
  });

  it('list-pending --tipo filters by tipo', () => {
    const out = run('list-pending --tipo romaneio --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(1);
    expect(parsed.documents[0].tipo_documento).toBe('romaneio');
  });

  it('list-pending --formato xml filters by formato', () => {
    const out = run('list-pending --formato xml --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(1);
    expect(parsed.documents[0].formato).toBe('xml');
  });

  it('list-pending --direcao entrada filters by direcao', () => {
    const out = run('list-pending --direcao entrada --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(1);
    expect(parsed.documents[0].direcao_nf).toBe('entrada');
  });

  it('list-pending --tipo nf_pdf maps to nf+pdf', () => {
    const out = run('list-pending --tipo nf_pdf --json');
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(1);
    expect(parsed.documents[0].tipo_documento).toBe('nf_pdf');
    expect(parsed.documents[0].formato).toBe('pdf');
  });

  it('list-pending text mode shows formato and direcao columns', () => {
    const out = run('list-pending');
    expect(out).toContain('fmt');
    expect(out).toContain('dir');
  });

  it('inspect --id finds by document id (text mode)', () => {
    const out = run('inspect --id doc-cli-1');
    expect(out).toContain('document');
    expect(out).toContain('NF-99999.pdf');
    expect(out).toContain('(original: nf_pdf)');
    expect(out).toContain('formato');
    expect(out).toContain('pdf');
  });

  it('inspect --id finds by gmail message id', () => {
    const out = run('inspect --id msg-cli-2');
    expect(out).toContain('romaneio.pdf');
    expect(out).toContain('romaneio');
  });

  it('inspect shows formato and direcao for new docs', () => {
    const out = run('inspect --id doc-cli-3');
    expect(out).toContain('nfe-entrada.xml');
    expect(out).toContain('formato:');
    expect(out).toContain('xml');
    expect(out).toContain('direcao_nf:');
    expect(out).toContain('entrada');
  });

  it('inspect --json masks IDs and links', () => {
    const out = run('inspect --id doc-cli-1 --json');
    const parsed = JSON.parse(out);
    expect(parsed.document.gmail_message_id).toContain('*');
    expect(parsed.document.drive_file_id).toContain('*');
  });

  it('inspect unknown id exits with error', () => {
    const result = runAllowFailure('inspect --id nonexistent');
    expect(result.code).toBe(1);
  });

  it('report text mode shows summary', () => {
    const out = run('report');
    expect(out).toContain('totalDocuments');
    expect(out).toContain('totalEmailsProcessed');
    expect(out).toContain('by formato');
    expect(out).toContain('by direcao NF');
    expect(out).toContain('NF by direcao');
    expect(out).toContain('pending NF by direcao');
  });

  it('report --json returns structured output', () => {
    const out = run('report --json');
    const parsed = JSON.parse(out);
    expect(parsed.totalDocuments).toBe(3);
    expect(parsed.documentsByTipo.nf_pdf).toBe(1);
    expect(parsed.documentsByTipo.romaneio).toBe(1);
    expect(parsed.documentsByTipo.nf).toBe(1);
    expect(parsed.documentsByFormato.pdf).toBe(2);
    expect(parsed.documentsByFormato.xml).toBe(1);
    expect(parsed.nfByDirecao.entrada).toBe(1);
  });

  it('reprocess without --confirm is dry-run', () => {
    const out = run('reprocess --id doc-cli-1');
    expect(out).toContain('DRY-RUN');
  });

  it('reprocess with --confirm applies safe local actions', () => {
    const out = run('reprocess --id doc-cli-1 --confirm');
    expect(out).toContain('APPLY');
  });

  it('reprocess unknown id exits with error', () => {
    const result = runAllowFailure('reprocess --id nonexistent');
    expect(result.code).toBe(1);
  });
});
