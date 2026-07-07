import { getDb } from '../storage/sqlite.js';
import type { DocumentStatus } from '../types/document.js';

export interface ListPendingFilters {
  limit?: number;
  status?: DocumentStatus;
  tipo?: string;
  formato?: string;
  direcaoNf?: string;
}

export interface PendingDocumentRow {
  id: string;
  gmail_message_id: string;
  filename_original: string;
  tipo_documento: string;
  formato: string;
  direcao_nf: string | null;
  status: DocumentStatus;
  pedido_manual: string | null;
  storage_backend: string;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
  email_subject: string | null;
  email_from: string | null;
  email_date: string | null;
}

export function listPendingDocuments(filters: ListPendingFilters = {}): PendingDocumentRow[] {
  const database = getDb();
  const limit = Math.min(filters.limit ?? 20, 200);
  const where: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    where.push('d.status = ?');
    params.push(filters.status);
  }

  if (filters.tipo) {
    if (filters.tipo === 'nf_pdf') {
      where.push("(d.tipo_documento = 'nf_pdf' OR (d.tipo_documento = 'nf' AND d.formato = 'pdf'))");
    } else if (filters.tipo === 'nf_xml') {
      where.push("(d.tipo_documento = 'nf_xml' OR (d.tipo_documento = 'nf' AND d.formato = 'xml'))");
    } else {
      where.push('d.tipo_documento = ?');
      params.push(filters.tipo);
    }
  }

  if (filters.formato) {
    where.push('d.formato = ?');
    params.push(filters.formato);
  }
  if (filters.direcaoNf) {
    where.push('d.direcao_nf = ?');
    params.push(filters.direcaoNf);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT d.id, d.gmail_message_id, d.filename_original, d.tipo_documento,
           COALESCE(d.formato, 'desconhecido') AS formato,
           d.direcao_nf,
           d.status, d.pedido_manual, d.storage_backend, d.drive_file_id,
           d.created_at, d.updated_at,
           e.subject AS email_subject, NULL AS email_from, NULL AS email_date
    FROM documentos d
    LEFT JOIN emails_processados e ON e.gmail_message_id = d.gmail_message_id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ?
  `;
  params.push(limit);
  return database.prepare(sql).all(...params) as PendingDocumentRow[];
}

export interface InspectDocumentResult {
  document: any;
  email: any;
  events: any[];
  manifest_ref: string | null;
}

export function inspectByDocumentOrEmail(idOrEmail: string): InspectDocumentResult | null {
  const database = getDb();
  const doc = database.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(idOrEmail, idOrEmail) as any;
  if (!doc) return null;
  const email = database.prepare(
    `SELECT * FROM emails_processados WHERE gmail_message_id = ? LIMIT 1`
  ).get(doc.gmail_message_id) as any;
  const events = database.prepare(
    `SELECT id, event_type, pedido_manual, status, drive_file_id, drive_web_view_link,
            manifest_storage_uri, manifest_drive_file_id, created_at, exported_at
     FROM ingestion_events WHERE document_id = ? ORDER BY created_at DESC`
  ).all(doc.id) as any[];
  return {
    document: doc,
    email: email ?? null,
    events,
    manifest_ref: events[0]?.manifest_storage_uri ?? null,
  };
}

export interface ReportSummary {
  totalEmailsProcessed: number;
  totalDocuments: number;
  documentsByTipo: Record<string, number>;
  documentsByStatus: Record<string, number>;
  documentsByFormato: Record<string, number>;
  documentsByDirecao: Record<string, number>;
  nfByDirecao: Record<string, number>;
  pendingByDirecao: Record<string, number>;
  pendingWithoutPedido: number;
  assignedByPedido: Record<string, number>;
  pendingAppAcceptance: number;
  documentsAccepted: number;
  documentsRejected: number;
  recentErrors: number;
  outboxPath: string;
  runLogs: { path: string; lines: number }[];
}

export function generateReport(opts: { daysBack?: number; pedido?: string } = {}): ReportSummary {
  const database = getDb();
  const daysBack = opts.daysBack ?? 7;
  const pedido = opts.pedido;

  const totalEmailsProcessed = (database.prepare(
    `SELECT COUNT(*) AS c FROM emails_processados`
  ).get() as any).c;

  const totalDocuments = (database.prepare(
    `SELECT COUNT(*) AS c FROM documentos`
  ).get() as any).c;

  const tipoRows = database.prepare(
    `SELECT tipo_documento, COUNT(*) AS c FROM documentos GROUP BY tipo_documento`
  ).all() as any[];
  const documentsByTipo: Record<string, number> = {};
  for (const r of tipoRows) documentsByTipo[r.tipo_documento] = r.c;

  const estadoRows = database.prepare(
    `SELECT status, COUNT(*) AS c FROM documentos GROUP BY status`
  ).all() as any[];
  const documentsByStatus: Record<string, number> = {};
  for (const r of estadoRows) documentsByStatus[r.status] = r.c;

  const formatoRows = database.prepare(
    `SELECT COALESCE(formato, 'desconhecido') AS fmt, COUNT(*) AS c FROM documentos GROUP BY fmt`
  ).all() as any[];
  const documentsByFormato: Record<string, number> = {};
  for (const r of formatoRows) documentsByFormato[r.fmt] = r.c;

  const direcaoRows = database.prepare(
    `SELECT COALESCE(direcao_nf, 'null') AS dir, COUNT(*) AS c FROM documentos GROUP BY dir`
  ).all() as any[];
  const documentsByDirecao: Record<string, number> = {};
  for (const r of direcaoRows) documentsByDirecao[r.dir] = r.c;

  const nfDirRows = database.prepare(
    `SELECT COALESCE(direcao_nf, 'null') AS dir, COUNT(*) AS c FROM documentos WHERE tipo_documento = 'nf' GROUP BY dir`
  ).all() as any[];
  const nfByDirecao: Record<string, number> = {};
  for (const r of nfDirRows) nfByDirecao[r.dir] = r.c;

  const pendDirRows = database.prepare(
    `SELECT COALESCE(direcao_nf, 'null') AS dir, COUNT(*) AS c FROM documentos WHERE status = 'pending' AND tipo_documento = 'nf' GROUP BY dir`
  ).all() as any[];
  const pendingByDirecao: Record<string, number> = {};
  for (const r of pendDirRows) pendingByDirecao[r.dir] = r.c;

  let pendingSql = `SELECT COUNT(*) AS c FROM documentos WHERE status = 'pending'`;
  const pendingParams: any[] = [];
  if (pedido) {
    pendingSql += ` AND pedido_manual = ?`;
    pendingParams.push(pedido);
  }
  const pendingWithoutPedido = (database.prepare(pendingSql).get(...pendingParams) as any).c;

  let pedidoSql = `SELECT pedido_manual, COUNT(*) AS c FROM documentos WHERE status = 'assigned'`;
  const pedidoParams: any[] = [];
  if (pedido) {
    pedidoSql += ` AND pedido_manual = ?`;
    pedidoParams.push(pedido);
  }
  pedidoSql += ` GROUP BY pedido_manual`;
  const pedidoRows = database.prepare(pedidoSql).all(...pedidoParams) as any[];
  const assignedByPedido: Record<string, number> = {};
  for (const r of pedidoRows) {
    if (r.pedido_manual) assignedByPedido[r.pedido_manual] = r.c;
  }

  const pendingAppAcceptance = (database.prepare(
    `SELECT COUNT(*) AS c FROM ingestion_events WHERE status = 'pending_app_acceptance' AND exported_at IS NULL`
  ).get() as any).c;

  const documentsAccepted = (database.prepare(
    `SELECT COUNT(*) AS c FROM documentos WHERE status = 'accepted'`
  ).get() as any).c;

  const documentsRejected = (database.prepare(
    `SELECT COUNT(*) AS c FROM documentos WHERE status = 'rejected'`
  ).get() as any).c;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);
  const sinceIso = sinceDate.toISOString().replace('T', ' ').slice(0, 19);
  const recentErrors = (database.prepare(
    `SELECT COUNT(*) AS c FROM emails_processados WHERE scan_status = 'error' AND processed_at >= ?`
  ).get(sinceIso) as any).c;

  const outboxPath = process.env.OUTBOX_PATH ?? './data/outbox/document-events.jsonl';

  return {
    totalEmailsProcessed,
    totalDocuments,
    documentsByTipo,
    documentsByStatus,
    documentsByFormato,
    documentsByDirecao,
    nfByDirecao,
    pendingByDirecao,
    pendingWithoutPedido,
    assignedByPedido,
    pendingAppAcceptance,
    documentsAccepted,
    documentsRejected,
    recentErrors,
    outboxPath,
    runLogs: [],
  };
}

export interface ReprocPlan {
  documentId: string;
  actions: string[];
  blocked: boolean;
  blockReason?: string;
  existingEventId?: string;
}

export function planReprocess(idOrEmail: string): ReprocPlan | null {
  const database = getDb();
  const doc = database.prepare(
    `SELECT * FROM documentos WHERE id = ? OR gmail_message_id = ? LIMIT 1`
  ).get(idOrEmail, idOrEmail) as any;
  if (!doc) return null;

  const actions: string[] = [];
  let blocked = false;
  let blockReason: string | undefined;

  if (doc.status === 'assigned' || doc.status === 'accepted') {
    blocked = true;
    blockReason = `document is ${doc.status} — reprocess will not reclassify or move Drive files`;
  }

  if (!doc.drive_file_id) {
    blocked = true;
    blockReason = 'document has no Drive reference — cannot regenerate manifest';
  }

  if (doc.status === 'pending' && doc.drive_file_id) {
    actions.push('reclassify-local');
  }
  if (doc.drive_file_id) {
    actions.push('regenerate-manifest-reference');
  }

  const existingEvent = database.prepare(
    `SELECT id FROM ingestion_events WHERE document_id = ? LIMIT 1`
  ).get(doc.id) as any;

  if (!existingEvent && doc.drive_file_id) {
    actions.push('create-outbox-event-if-absent');
  } else if (existingEvent) {
    actions.push('skip-outbox-event-already-exists');
  }

  return {
    documentId: doc.id,
    actions,
    blocked,
    blockReason,
    existingEventId: existingEvent?.id,
  };
}
