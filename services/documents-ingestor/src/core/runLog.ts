import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../config.js';

export type RunEvent =
  | { type: 'run.start'; timestamp: string; daysBack: number; maxAttachments: number; wideScan: boolean }
  | { type: 'run.end'; timestamp: string; emailsScanned: number; attachmentsFound: number; newDocuments: number; duplicates: number; crossMessageDuplicates: number; skippedByCap: number; errors: number }
  | { type: 'email.scanned'; timestamp: string; gmailMessageId: string; subject: string; attachmentsCount: number; status: 'processed' | 'skipped_already' }
  | { type: 'attachment.processed'; timestamp: string; gmailMessageId: string; attachmentId: string; filename: string; sha256: string; status: 'new' | 'duplicate' | 'cross_message_duplicate' | 'skipped_cap'; driveFileId?: string; reusedFrom?: string }
  | { type: 'registry.error'; timestamp: string; error: string };

export interface RunLogger {
  log(event: RunEvent): void;
  path: string;
}

export function createRunLogger(runId?: string): RunLogger {
  const id = runId ?? new Date().toISOString().replace(/[:.]/g, '-');
  const dataDir = resolve(config.localCachePath, '..');
  const dir = resolve(dataDir, 'runs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = resolve(dir, `run-${id}.jsonl`);
  return {
    path: filePath,
    log(event: RunEvent): void {
      appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8');
    },
  };
}
