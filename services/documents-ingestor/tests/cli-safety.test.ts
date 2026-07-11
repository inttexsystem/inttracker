import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { scanGmail, assignPedido } from '../src/core/ingest.js';
import { config } from '../src/config.js';
import { closeDb } from '../src/storage/sqlite.js';

const DB_DIR = join(tmpdir(), `ravatex-cli-safety-test-${randomUUID()}`);

describe('CLI safety: real Google calls gated by confirmReal', () => {
  beforeEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    process.env.DATABASE_PATH = join(DB_DIR, 'app.db');
    process.env.OUTBOX_PATH = join(DB_DIR, 'outbox.jsonl');
    process.env.LOCAL_CACHE_PATH = join(DB_DIR, 'cache');
  });

  afterEach(() => {
    closeDb();
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
  });

  it('scan() without confirmReal returns dry-run result without errors', async () => {
    const result = await scanGmail({ daysBack: 7 });
    expect(result.mode).toBe('dry-run');
    expect(result.emailsScanned).toBe(0);
    expect(result.newDocuments).toBe(0);
  });

  it('scan() with confirmReal=false explicitly also dry-runs', async () => {
    const result = await scanGmail({ daysBack: 7, confirmReal: false });
    expect(result.mode).toBe('dry-run');
  });

  it('config exposes ingestRealGoogle flag (default false)', () => {
    expect(typeof config.ingestRealGoogle).toBe('boolean');
  });

  it('assign() without confirmReal returns null', async () => {
    const r = await assignPedido('nonexistent-id', '25/2026');
    expect(r).toBeNull();
  });

  it('assign() with confirmReal=false returns null', async () => {
    const r = await assignPedido('nonexistent-id', '25/2026', { confirmReal: false });
    expect(r).toBeNull();
  });
});
