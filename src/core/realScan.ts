import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '../storage/sqlite.js';
import { classifyAttachment } from './classifier.js';
import { isDuplicate, isDuplicateInSameMessage, getProcessedEmailAttachmentCount, markEmailProcessed, findExistingBySha256 } from './dedupe.js';
import { pendenteDrivePath } from './paths.js';
import { uploadDocument } from '../connectors/drive.js';
import { fetchRecentEmails, fetchMessageById, listAttachments, downloadAttachment, isAttachmentCandidate } from '../connectors/gmail.js';
import { createRunLogger, type RunLogger } from './runLog.js';
import { createDocumentEvent } from '../types/event.js';
import { appendEvent, isEventDuplicate } from './outbox.js';
import type { GmailAttachmentRef, GmailMessageMeta } from '../connectors/gmail.js';

export interface ScanOptions {
  daysBack?: number;
  confirmReal?: boolean;
  maxAttachments?: number;
  query?: string;
  retryMessageId?: string;
}

export interface ScanResult {
  mode: 'real' | 'dry-run';
  emailsScanned: number;
  attachmentsFound: number;
  newDocuments: number;
  duplicates: number;
  crossMessageDuplicates: number;
  skippedByCap: number;
  errors: string[];
  runLogPath?: string;
}

export interface ScanDeps {
  fetchEmails: (daysBack: number, extraQuery?: string) => Promise<GmailMessageMeta[]>;
  fetchMessageById?: (msgId: string) => Promise<GmailMessageMeta | null>;
  listAtts: (msgId: string) => Promise<GmailAttachmentRef[]>;
  downloadAtt: (msgId: string, attId: string) => Promise<Buffer | null>;
  uploadDoc: (params: { folderLogicalPath: string; filename: string; mimeType: string; data: Buffer }) => Promise<{ file: { storageUri: string; driveFileId: string; driveWebViewLink: string; driveFolderId?: string; driveWebContentLink?: string } }>;
  logger?: RunLogger;
}

const defaultDeps: ScanDeps = {
  fetchEmails: async (daysBack, extraQuery) => fetchRecentEmails(daysBack, undefined, extraQuery),
  fetchMessageById: async (msgId) => fetchMessageById(msgId),
  listAtts: async (msgId) => listAttachments(msgId),
  downloadAtt: async (msgId, attId) => downloadAttachment(msgId, attId),
  uploadDoc: async (params) => {
    const r = await uploadDocument(params);
    return { file: r.file };
  },
  logger: createRunLogger(),
};

export function createScan(deps: ScanDeps = defaultDeps) {
  return async function scan(opts: ScanOptions = {}): Promise<ScanResult> {
    const mode: 'real' | 'dry-run' = opts.confirmReal ? 'real' : 'dry-run';
    const daysBack = opts.daysBack ?? 7;
    const maxAttachments = opts.maxAttachments ?? 25;
    const wideScan = daysBack > 7;
    const errors: string[] = [];
    let attachmentsFound = 0;
    let newDocuments = 0;
    let duplicates = 0;
    let crossMessageDuplicates = 0;
    let skippedByCap = 0;
    let processedAttachments = 0;

    if (mode === 'dry-run') {
      return {
        mode,
        emailsScanned: 0,
        attachmentsFound: 0,
        newDocuments: 0,
        duplicates: 0,
        crossMessageDuplicates: 0,
        skippedByCap: 0,
        errors: [],
      };
    }

    const logger = deps.logger ?? createRunLogger();
    logger.log({ type: 'run.start', timestamp: new Date().toISOString(), daysBack, maxAttachments, wideScan, retryMessageId: opts.retryMessageId ?? null });

    let emails: GmailMessageMeta[];
    if (opts.retryMessageId) {
      if (!deps.fetchMessageById) {
        const errMsg = '[retry] --retry-message requires fetchMessageById dependency which is unavailable.';
        logger.log({ type: 'retry.error', timestamp: new Date().toISOString(), error: errMsg });
        errors.push(errMsg);
        return {
          mode,
          emailsScanned: 0,
          attachmentsFound: 0,
          newDocuments: 0,
          duplicates: 0,
          crossMessageDuplicates: 0,
          skippedByCap: 0,
          errors,
          runLogPath: logger.path,
        };
      }
      logger.log({ type: 'retry.direct_fetch', timestamp: new Date().toISOString(), gmailMessageId: opts.retryMessageId });
      const msg = await deps.fetchMessageById(opts.retryMessageId);
      emails = msg ? [msg] : [];
    } else {
      emails = await deps.fetchEmails(daysBack, opts.query);
    }
    const database = getDb();

    for (const email of emails) {
      const isRetry = opts.retryMessageId != null && email.gmailMessageId === opts.retryMessageId;

      const priorAttachmentCount = isRetry ? null : getProcessedEmailAttachmentCount(email.gmailMessageId);
      if (!isRetry && priorAttachmentCount !== null && priorAttachmentCount > 0) {
        logger.log({ type: 'email.scanned', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, subject: email.subject, attachmentsCount: 0, status: 'skipped_already' });
        continue;
      }

      if (isRetry) {
        logger.log({ type: 'retry.start', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, subject: email.subject, status: 'retry_requested' });
      }

      markEmailProcessed(email.gmailMessageId, email.threadId, email.subject, 0);

      const atts = await deps.listAtts(email.gmailMessageId);
      const candidates = atts.filter(a => isAttachmentCandidate(a.filename, a.mimeType));
      attachmentsFound += candidates.length;

      let processedCount = 0;
      for (const att of candidates) {
        if (processedAttachments >= maxAttachments) {
          skippedByCap++;
          logger.log({ type: 'attachment.processed', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, attachmentId: att.attachmentId, filename: att.filename, sha256: '', status: 'skipped_cap' });
          continue;
        }
        try {
          const buffer = await deps.downloadAtt(email.gmailMessageId, att.attachmentId);
          if (!buffer) {
            errors.push(`empty buffer for ${att.attachmentId}`);
            continue;
          }

          const sha256 = createHash('sha256').update(buffer).digest('hex');
          if (isDuplicate(email.gmailMessageId, att.attachmentId, sha256)) {
            duplicates++;
            logger.log({ type: 'attachment.processed', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, attachmentId: att.attachmentId, filename: att.filename, sha256, status: 'duplicate' });
            continue;
          }

          if (isDuplicateInSameMessage(email.gmailMessageId, sha256)) {
            duplicates++;
            logger.log({ type: 'attachment.processed', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, attachmentId: att.attachmentId, filename: att.filename, sha256, status: 'duplicate_same_message' });
            continue;
          }

          const crossMatch = findExistingBySha256(sha256, att.filename, att.size);
          if (crossMatch) {
            const documentId = randomUUID();
            database.prepare(
              `INSERT INTO documentos (
                 id, gmail_message_id, thread_id, attachment_id, filename_original,
                 sha256, tipo_documento, formato, direcao_nf,
                 storage_backend, storage_uri, drive_file_id, drive_folder_id,
                 drive_web_view_link, drive_web_content_link, local_cache_path,
                 status
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
            ).run(
              documentId,
              email.gmailMessageId,
              email.threadId,
              att.attachmentId,
              att.filename,
              sha256,
              'desconhecido',
              'desconhecido',
              null,
              'google_drive',
              crossMatch.storageUri,
              crossMatch.driveFileId,
              crossMatch.driveFolderId,
              crossMatch.driveWebViewLink,
              crossMatch.driveWebContentLink,
              null,
            );
            crossMessageDuplicates++;
            processedAttachments++;
            processedCount++;
            logger.log({ type: 'attachment.processed', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, attachmentId: att.attachmentId, filename: att.filename, sha256, status: 'cross_message_duplicate', driveFileId: crossMatch.driveFileId, reusedFrom: crossMatch.gmailMessageId });
            continue;
          }

          const classificacao = classifyAttachment({
            filename: att.filename,
            mimeType: att.mimeType,
            subject: email.subject,
            contentSample: sampleXml(buffer, att.mimeType),
          });

          const drivePath = pendenteDrivePath({
            tipoDocumento: classificacao.tipoDocumento,
            direcaoNf: classificacao.direcaoNf,
          }).logicalPath;
          const upload = await deps.uploadDoc({
            folderLogicalPath: drivePath,
            filename: att.filename,
            mimeType: att.mimeType,
            data: buffer,
          });

          const documentId = randomUUID();
          database.prepare(
            `INSERT INTO documentos (
               id, gmail_message_id, thread_id, attachment_id, filename_original,
               sha256, tipo_documento, formato, direcao_nf,
               storage_backend, storage_uri, drive_file_id, drive_folder_id,
               drive_web_view_link, drive_web_content_link, local_cache_path,
               status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
          ).run(
            documentId,
            email.gmailMessageId,
            email.threadId,
            att.attachmentId,
            att.filename,
            sha256,
            classificacao.tipoDocumento,
            classificacao.formato,
            classificacao.direcaoNf,
            'google_drive',
            upload.file.storageUri,
            upload.file.driveFileId,
            upload.file.driveFolderId ?? null,
            upload.file.driveWebViewLink,
            upload.file.driveWebContentLink ?? null,
            null,
          );

          const detectedEventId = randomUUID();
          const detectedEvent = createDocumentEvent({
            eventId: detectedEventId,
            pedidoManual: '',
            gmailMessageId: email.gmailMessageId,
            threadId: email.threadId,
            documentId,
            tipoDocumento: classificacao.tipoDocumento,
            filenameOriginal: att.filename,
            sha256,
            driveFileId: upload.file.driveFileId,
            driveFolderId: upload.file.driveFolderId ?? undefined,
            driveWebViewLink: upload.file.driveWebViewLink,
            driveWebContentLink: upload.file.driveWebContentLink ?? undefined,
            formato: classificacao.formato,
            direcaoNf: classificacao.direcaoNf ?? undefined,
            status: 'pending_app_acceptance',
          });

          if (!isEventDuplicate(detectedEventId)) {
            database.prepare(
              `INSERT INTO ingestion_events (
                 id, event_type, pedido_manual, document_id, status,
                 storage_backend, storage_uri, drive_file_id, drive_web_view_link,
                 manifest_storage_uri, manifest_drive_file_id
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              detectedEventId,
              'document.detected',
              '',
              documentId,
              'pending_app_acceptance',
              'google_drive',
              upload.file.storageUri,
              upload.file.driveFileId,
              upload.file.driveWebViewLink,
              null,
              null,
            );
            appendEvent(detectedEvent);
          }

          newDocuments++;
          processedAttachments++;
          processedCount++;
          logger.log({ type: 'attachment.processed', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, attachmentId: att.attachmentId, filename: att.filename, sha256, status: 'new', driveFileId: upload.file.driveFileId });
        } catch (err: any) {
          errors.push(`att ${att.attachmentId}: ${err?.message ?? String(err)}`);
        }
      }

      logger.log({ type: 'email.scanned', timestamp: new Date().toISOString(), gmailMessageId: email.gmailMessageId, subject: email.subject, attachmentsCount: processedCount, status: 'processed' });
      database.prepare(
        `UPDATE emails_processados SET attachments_count = ? WHERE gmail_message_id = ?`
      ).run(processedCount, email.gmailMessageId);
    }

    logger.log({ type: 'run.end', timestamp: new Date().toISOString(), emailsScanned: emails.length, attachmentsFound, newDocuments, duplicates, crossMessageDuplicates, skippedByCap, errors: errors.length });

    return {
      mode,
      emailsScanned: emails.length,
      attachmentsFound,
      newDocuments,
      duplicates,
      crossMessageDuplicates,
      skippedByCap,
      errors,
      runLogPath: logger.path,
    };
  };
}

function sampleXml(buffer: Buffer, mimeType: string): string {
  if (mimeType !== 'text/xml' && mimeType !== 'application/xml') return '';
  return buffer.toString('utf-8', 0, Math.min(buffer.length, 2048));
}
