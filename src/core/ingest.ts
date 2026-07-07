import { createScan, type ScanResult } from './realScan.js';
import { createAssignPedido, type AssignResult } from './realAssign.js';
import { getDb } from '../storage/sqlite.js';
import { classifyAttachment } from './classifier.js';
import { normalizePedido } from './pedido.js';
import { exportPendingEvents } from './outbox.js';

const defaultScan = createScan();
const defaultAssign = createAssignPedido();

export interface ScanGmailOptions {
  daysBack?: number;
  confirmReal?: boolean;
  maxAttachments?: number;
  query?: string;
  retryMessageId?: string;
}

export async function scanGmail(options: ScanGmailOptions = {}): Promise<ScanResult> {
  const confirmReal = options.confirmReal ?? false;
  if (!confirmReal) {
    return {
      mode: 'dry-run',
      emailsScanned: 0,
      attachmentsFound: 0,
      newDocuments: 0,
      duplicates: 0,
      crossMessageDuplicates: 0,
      skippedByCap: 0,
      errors: [],
    };
  }
  return defaultScan({
    daysBack: options.daysBack,
    confirmReal: true,
    maxAttachments: options.maxAttachments,
    query: options.query,
    retryMessageId: options.retryMessageId,
  });
}

export async function assignPedido(
  emailOrDocumentId: string,
  pedidoManual: string,
  options: { confirmReal?: boolean } = {},
): Promise<AssignResult | null> {
  if (options.confirmReal !== true) {
    const normalized = normalizePedido(pedidoManual);
    if (!normalized) {
      console.error('Invalid pedido format:', pedidoManual);
      return null;
    }
    const db = getDb();
    const doc = db.prepare(
      `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
    ).get(emailOrDocumentId, emailOrDocumentId) as any;
    if (!doc) {
      console.error('Document not found:', emailOrDocumentId);
      return null;
    }
    if (doc.status !== 'pending') {
      console.log('Document already assigned (status=%s)', doc.status);
      return null;
    }
    console.log('Assign dry-run: pass --confirm-real-google to perform real Drive move.');
    return null;
  }
  return defaultAssign(emailOrDocumentId, pedidoManual, { confirmReal: true });
}

export function listPending(): any[] {
  const database = getDb();
  return database.prepare(
    `SELECT * FROM documentos WHERE status = 'pending' ORDER BY created_at DESC`
  ).all();
}

export function getDocumentEvents(): any[] {
  const database = getDb();
  return database.prepare(
    `SELECT * FROM ingestion_events ORDER BY created_at DESC`
  ).all();
}

export { classifyAttachment } from './classifier.js';
export { normalizePedido } from './pedido.js';
export { exportPendingEvents } from './outbox.js';
