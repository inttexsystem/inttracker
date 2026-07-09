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

export function isDuplicateInSameMessage(gmailMessageId: string, sha256: string): boolean {
  if (!sha256 || sha256 === '') return false;
  const database = getDb();
  const row = database.prepare(
    `SELECT 1 FROM documentos WHERE gmail_message_id = ? AND sha256 = ? LIMIT 1`
  ).get(gmailMessageId, sha256);
  return !!row;
}

export interface CrossMessageMatch {
  documentId: string;
  driveFileId: string;
  driveFolderId: string | null;
  storageUri: string;
  driveWebViewLink: string;
  driveWebContentLink: string | null;
  filenameOriginal: string;
  gmailMessageId: string;
}

export function findExistingBySha256(sha256: string, filename: string, size: number): CrossMessageMatch | null {
  const database = getDb();
  const row = database.prepare(
    `SELECT id, drive_file_id, drive_folder_id, storage_uri,
            drive_web_view_link, drive_web_content_link,
            filename_original, gmail_message_id
       FROM documentos
       WHERE sha256 = ?
         AND filename_original = ?
         AND drive_file_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 1`
  ).get(sha256, filename) as any;
  if (!row) return null;
  return {
    documentId: row.id,
    driveFileId: row.drive_file_id,
    driveFolderId: row.drive_folder_id ?? null,
    storageUri: row.storage_uri ?? '',
    driveWebViewLink: row.drive_web_view_link ?? '',
    driveWebContentLink: row.drive_web_content_link ?? null,
    filenameOriginal: row.filename_original,
    gmailMessageId: row.gmail_message_id,
  };
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
