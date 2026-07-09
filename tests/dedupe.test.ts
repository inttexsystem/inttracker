import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildDedupeKey, isDuplicateInSameMessage } from '../src/core/dedupe.js';
import { getDb, closeDb } from '../src/storage/sqlite.js';

describe('dedupe', () => {
  it('builds correct dedupe key', () => {
    const key = buildDedupeKey('msg123', 'att456', 'abc123def456');
    expect(key).toBe('msg123:att456:abc123def456');
  });

  it('produces different keys for different message ids', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg2', 'att1', 'hash1');
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different attachment ids', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att2', 'hash1');
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different hashes', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att1', 'hash2');
    expect(k1).not.toBe(k2);
  });

  it('produces same key for same inputs', () => {
    const k1 = buildDedupeKey('msg1', 'att1', 'hash1');
    const k2 = buildDedupeKey('msg1', 'att1', 'hash1');
    expect(k1).toBe(k2);
  });
});

describe('isDuplicateInSameMessage (G12-E4 hardening)', () => {
  const DB_DIR = join(tmpdir(), `ravatex-dedupe-samemsg-${randomUUID()}`);

  beforeEach(() => {
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    closeDb();
    const db = getDb();
    db.exec('DELETE FROM ingestion_events; DELETE FROM documentos; DELETE FROM emails_processados;');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  it('returns false when no document exists for the message', () => {
    expect(isDuplicateInSameMessage('msg-X', 'hash-X')).toBe(false);
  });

  it('returns false when sha256 is empty', () => {
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-empty');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256) VALUES (?, ?, ?, ?, ?)`
    ).run('doc-1', 'msg-empty', 'att-1', 'x.pdf', 'realhash');
    expect(isDuplicateInSameMessage('msg-empty', '')).toBe(false);
  });

  it('returns true when same gmail_message_id + same sha256 exists (different attachment_id)', () => {
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-same');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256) VALUES (?, ?, ?, ?, ?)`
    ).run('doc-1', 'msg-same', 'att-A', 'x.pdf', 'shared-hash');
    expect(isDuplicateInSameMessage('msg-same', 'shared-hash')).toBe(true);
  });

  it('returns false when same sha256 but different gmail_message_id (cross-message is allowed)', () => {
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-1');
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-2');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256) VALUES (?, ?, ?, ?, ?)`
    ).run('doc-1', 'msg-1', 'att-A', 'x.pdf', 'shared-hash');
    expect(isDuplicateInSameMessage('msg-2', 'shared-hash')).toBe(false);
  });

  it('returns false when same gmail_message_id but different sha256', () => {
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO emails_processados (gmail_message_id) VALUES (?)`).run('msg-diff-hash');
    db.prepare(
      `INSERT INTO documentos (id, gmail_message_id, attachment_id, filename_original, sha256) VALUES (?, ?, ?, ?, ?)`
    ).run('doc-1', 'msg-diff-hash', 'att-A', 'x.pdf', 'hash-1');
    expect(isDuplicateInSameMessage('msg-diff-hash', 'hash-2')).toBe(false);
  });
});
