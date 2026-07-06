import { getDb } from '../storage/sqlite.js';

export function buildDedupeKey(gmailMessageId: string, attachmentId: string, sha256: string): string {
  return `${gmailMessageId}:${attachmentId}:${sha256}`;
}

export function isDuplicate(gmailMessageId: string, attachmentId: string, sha256: string): boolean {
  const database = getDb();
  const row = database.prepare(
    `SELECT 1 FROM documentos WHERE gmail_message_id = ? AND attachment_id = ? AND sha256 = ? LIMIT 1`
  ).get(gmailMessageId, attachmentId, sha256);
  return !!row;
}

export function isEmailProcessed(gmailMessageId: string): boolean {
  const database = getDb();
  const row = database.prepare(
    `SELECT 1 FROM emails_processados WHERE gmail_message_id = ? LIMIT 1`
  ).get(gmailMessageId);
  return !!row;
}

export function markEmailProcessed(gmailMessageId: string, threadId: string, subject: string, attachmentsCount: number): void {
  const database = getDb();
  database.prepare(
    `INSERT OR IGNORE INTO emails_processados (gmail_message_id, thread_id, subject, attachments_count) VALUES (?, ?, ?, ?)`
  ).run(gmailMessageId, threadId, subject, attachmentsCount);
}
