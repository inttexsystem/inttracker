import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

export interface WatcherInstanceLock {
  path: string;
  release: () => void;
}

export class WatcherAlreadyRunningError extends Error {}

function safeSource(source: string): string {
  return source.replace(/[^a-z0-9_-]/gi, '_');
}

export function defaultWatcherLockPath(source: string): string {
  return join(dirname(config.databasePath), `.watch-scan-requests-${safeSource(source)}.lock`);
}

function readLockPid(lockPath: string): number | null {
  try {
    const value = JSON.parse(readFileSync(lockPath, 'utf-8')) as { pid?: unknown };
    return Number.isInteger(value.pid) && Number(value.pid) > 0 ? Number(value.pid) : null;
  } catch {
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquires a process-wide, source-scoped lock for a continuous watcher.
 * A stale lock is removed only after its recorded PID is no longer alive.
 */
export function acquireWatcherInstanceLock(source: string, lockPath = defaultWatcherLockPath(source)): WatcherInstanceLock {
  mkdirSync(dirname(lockPath), { recursive: true });
  const token = randomUUID();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid, source, token, startedAt: new Date().toISOString() }));
      } finally {
        closeSync(fd);
      }
      let released = false;
      return {
        path: lockPath,
        release() {
          if (released) return;
          released = true;
          try {
            const current = JSON.parse(readFileSync(lockPath, 'utf-8')) as { token?: string };
            if (current.token === token) unlinkSync(lockPath);
          } catch {
            // The lock is already gone or has been replaced; never remove a
            // lock we do not own.
          }
        },
      };
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
      const pid = readLockPid(lockPath);
      if (pid && processIsAlive(pid)) {
        throw new WatcherAlreadyRunningError(`A continuous watcher is already running for source=${source} (pid=${pid}).`);
      }
      // A crashed process can leave its sentinel behind. Retrying via O_EXCL
      // preserves atomicity if another starter wins the race.
      if (existsSync(lockPath)) {
        try { unlinkSync(lockPath); } catch { /* retry handles a concurrent change */ }
      }
    }
  }

  throw new WatcherAlreadyRunningError(`Could not acquire the continuous watcher lock for source=${source}.`);
}
