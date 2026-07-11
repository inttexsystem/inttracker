import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { acquireWatcherInstanceLock, WatcherAlreadyRunningError } from '../src/core/watcherInstanceLock.js';

const ROOT = join(tmpdir(), `ravatex-watcher-lock-${randomUUID()}`);

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('continuous watcher instance lock', () => {
  it('allows one owner only and releases cleanly', () => {
    mkdirSync(ROOT, { recursive: true });
    const lockPath = join(ROOT, 'gmail.lock');
    const first = acquireWatcherInstanceLock('gmail', lockPath);
    expect(existsSync(lockPath)).toBe(true);
    expect(() => acquireWatcherInstanceLock('gmail', lockPath)).toThrow(WatcherAlreadyRunningError);
    first.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it('reclaims a stale sentinel only when its PID is dead', () => {
    mkdirSync(ROOT, { recursive: true });
    const lockPath = join(ROOT, 'gmail.lock');
    writeFileSync(lockPath, JSON.stringify({ pid: 2147483647, token: 'stale' }));
    const lock = acquireWatcherInstanceLock('gmail', lockPath);
    expect(existsSync(lockPath)).toBe(true);
    lock.release();
  });
});
