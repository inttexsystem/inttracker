import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { queryAndExportEvents } from './outbox.js';
import { buildManifestFromDb } from './syncManifest.js';
import { getDb } from '../storage/sqlite.js';
import type { DocumentEvent } from '../types/event.js';

export interface PackageResult {
  pedido: string;
  outputDir: string;
  totalEvents: number;
  totalDocuments: number;
  files: string[];
}

function generateReadme(pedido: string): string {
  return `# Ravatex Documents Ingestor — Pacote de Integração

## Pedido: ${pedido}
## Gerado em: ${new Date().toISOString()}

### Instruções para o Controle de Tapetes

1. **Consumir eventos:** Ler \`document-events.jsonl\` linha por linha (JSONL).
2. **Idempotência:** Usar \`ingestion_event_id\` como chave única. Ignorar duplicatas.
3. **event_id legado:** Pode repetir-se para múltiplos eventos do mesmo documento. Usar \`ingestion_event_id\` como identificador canônico.
4. **Estado do documento:** Consolidar pelo último \`created_at\` para cada \`document_id\`.
5. **Visualização:** Abrir \`drive_web_view_link\` em nova aba do navegador.
6. **Não armazenar** PDF/XML no Supabase ou backend próprio.
7. **Snapshot:** Este pacote é snapshot local. A fonte de verdade permanente é o outbox JSONL.
8. **Manifest:** \`manifest.json\` é snapshot derivado do SQLite. Contém todos os documentos do pedido com status atual.
`;
}

export interface ExportPackageResult {
  pedido: string;
  outputDir: string;
  files: string[];
  totalEvents: number;
  totalDocuments: number;
  acceptedCount: number;
  rejectedCount: number;
  linkedCount: number;
  detectedCount: number;
}

export function exportPackage(
  pedido: string,
  opts: { outputDir?: string } = {},
): ExportPackageResult {
  const baseDir = opts.outputDir && opts.outputDir.trim()
    ? resolve(process.cwd(), opts.outputDir)
    : resolve(process.cwd(), 'data', 'exports', 'packages', pedido);

  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const events = queryAndExportEvents({ pedido });
  const manifest = buildManifestFromDb(pedido);

  const eventTypeCounts: Record<string, number> = {};
  for (const e of events) {
    eventTypeCounts[e.event_type] = (eventTypeCounts[e.event_type] ?? 0) + 1;
  }

  const summary = {
    pedido,
    generated_at: new Date().toISOString(),
    totalEvents: events.length,
    totalDocuments: manifest.documents.length,
    eventsByType: eventTypeCounts,
    documentsWithDriveLink: manifest.documents.filter(d => d.drive_web_view_link).length,
  };

  const eventsFilePath = join(baseDir, 'document-events.jsonl');
  const eventsContent = events.map(e => JSON.stringify(e)).join('\n') + (events.length > 0 ? '\n' : '');
  writeFileSync(eventsFilePath, eventsContent, 'utf-8');

  const manifestFilePath = join(baseDir, 'manifest.json');
  writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf-8');

  const summaryFilePath = join(baseDir, 'summary.json');
  writeFileSync(summaryFilePath, JSON.stringify(summary, null, 2), 'utf-8');

  const readmeFilePath = join(baseDir, 'README.md');
  writeFileSync(readmeFilePath, generateReadme(pedido), 'utf-8');

  const files = [eventsFilePath, manifestFilePath, summaryFilePath, readmeFilePath];

  return {
    pedido,
    outputDir: baseDir,
    files,
    totalEvents: events.length,
    totalDocuments: manifest.documents.length,
    acceptedCount: eventTypeCounts['document.accepted'] ?? 0,
    rejectedCount: eventTypeCounts['document.rejected'] ?? 0,
    linkedCount: eventTypeCounts['document.linked'] ?? 0,
    detectedCount: eventTypeCounts['document.detected'] ?? 0,
  };
}

export interface ReceivedDocumentRow {
  document_id: string;
  gmail_message_id: string;
  thread_id: string;
  filename_original: string;
  sha256: string;
  tipo_documento: string;
  formato: string | null;
  direcao_nf: string | null;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  sender_email: string | null;
  email_message_id: string | null;
  email_received_at: string | null;
  email_received_at_source: 'gmail_internal_date' | 'header_date' | null;
  email_received_at_estimated: boolean;
  created_at: string;
  updated_at: string;
  detected_event_id: string;
  detected_event_created_at: string;
}

export interface ExportReceivedOptions {
  outputPath?: string;
  daysBack?: number;
  limit?: number;
}

export interface MappedDocumentRow {
  schema_version: 1;
  document_id: string;
  filename_original: string;
  tipo_documento: string;
  formato: string | null;
  direcao_nf: string | null;
  status: string;
  pedido_manual: string | null;
  gmail_message_id: string;
  thread_id: string;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  sender_email: string | null;
  /** @deprecated Processing timestamp retained only for old consumers. */
  received_at: string | null;
  processed_at: string;
  email_message_id: string | null;
  email_received_at: string | null;
  email_received_at_source: 'gmail_internal_date' | 'header_date' | null;
  email_received_at_estimated: boolean;
  detected_at: string | null;
  linked_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  cnpj_emitente: string | null;
  cnpj_destinatario: string | null;
  latest_ingestion_event_id: string | null;
  latest_ingestion_event_at: string | null;
  detected_ingestion_event_id: string | null;
  linked_ingestion_event_id: string | null;
  accepted_ingestion_event_id: string | null;
  rejected_ingestion_event_id: string | null;
}

export interface ExportMappedOptions {
  outputPath?: string;
  status?: 'pending' | 'assigned' | 'accepted' | 'rejected';
  daysBack?: number;
  limit?: number;
}

export interface ExportMappedResult {
  outputPath: string;
  totalDocuments: number;
  files: string[];
}

function normalizeOptionalEventTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function listMappedDocuments(
  opts: ExportMappedOptions = {},
): MappedDocumentRow[] {
  const database = getDb();
  const limit = Math.min(opts.limit ?? 5000, 5000);
  const where: string[] = [];
  const params: any[] = [];

  if (opts.status) {
    where.push('d.status = ?');
    params.push(opts.status);
  }
  if (opts.daysBack !== undefined) {
    if (!Number.isFinite(opts.daysBack) || opts.daysBack < 1) {
      throw new Error(`daysBack must be a positive integer (got ${opts.daysBack})`);
    }
    const since = new Date();
    since.setDate(since.getDate() - opts.daysBack);
    const sinceIso = since.toISOString().replace('T', ' ').slice(0, 19);
    where.push('COALESCE(d.email_received_at, d.created_at) >= ?');
    params.push(sinceIso);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT
      d.id AS document_id,
      d.filename_original,
      d.tipo_documento,
      d.formato,
      d.direcao_nf,
      d.cnpj_emitente,
      d.cnpj_destinatario,
      d.status,
      d.pedido_manual,
      d.gmail_message_id,
      d.thread_id,
      d.drive_file_id,
      d.drive_web_view_link,
      d.sender_email,
      d.email_message_id,
      d.email_received_at,
      d.email_received_at_source,
      CAST(d.email_received_at_estimated AS INTEGER) AS email_received_at_estimated,
      NULL AS received_at,
      d.created_at AS processed_at,
      (SELECT MIN(e.created_at) FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.detected') AS detected_at,
      (SELECT MIN(e.created_at) FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.linked') AS linked_at,
      (SELECT MIN(e.created_at) FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.accepted') AS accepted_at,
      (SELECT MIN(e.created_at) FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.rejected') AS rejected_at,
      (SELECT e.reason FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.rejected'
        ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS rejected_reason,
      (SELECT e.id FROM ingestion_events e
        WHERE e.document_id = d.id
        ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_ingestion_event_id,
      (SELECT e.created_at FROM ingestion_events e
        WHERE e.document_id = d.id
        ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS latest_ingestion_event_at,
      (SELECT e.id FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.detected'
        ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS detected_ingestion_event_id,
      (SELECT e.id FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.linked'
        ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS linked_ingestion_event_id,
      (SELECT e.id FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.accepted'
        ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS accepted_ingestion_event_id,
      (SELECT e.id FROM ingestion_events e
        WHERE e.document_id = d.id AND e.event_type = 'document.rejected'
        ORDER BY e.created_at ASC, e.id ASC LIMIT 1) AS rejected_ingestion_event_id
    FROM documentos d
    ${whereClause}
    ORDER BY COALESCE(d.email_received_at, d.created_at) DESC
    LIMIT ?
  `;
  params.push(limit);

  const rows = database.prepare(sql).all(...params) as Array<Omit<MappedDocumentRow, 'schema_version'>>;
  return rows.map((r) => ({
    ...r,
    email_received_at_estimated: Boolean(r.email_received_at_estimated),
    latest_ingestion_event_at: normalizeOptionalEventTimestamp(r.latest_ingestion_event_at),
    schema_version: 1 as const,
  }));
}

export function exportMappedDocuments(
  opts: ExportMappedOptions = {},
): ExportMappedResult {
  const baseDir = opts.outputPath && opts.outputPath.trim()
    ? resolve(process.cwd(), opts.outputPath)
    : resolve(process.cwd(), 'data', 'exports', 'documentos-mapeados.jsonl');

  const dir = dirname(baseDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const rows = listMappedDocuments({
    status: opts.status,
    daysBack: opts.daysBack,
    limit: opts.limit,
  });

  const content = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
  writeFileSync(baseDir, content, 'utf-8');

  return {
    outputPath: baseDir,
    totalDocuments: rows.length,
    files: [baseDir],
  };
}

export type CanonicalIngestionEventType =
  | 'document.detected'
  | 'document.linked'
  | 'document.accepted'
  | 'document.rejected';

export type CanonicalIngestionEventStatus = 'pending' | 'assigned' | 'accepted' | 'rejected' | null;

export interface CanonicalIngestionEvent {
  schema_version: 1;
  ingestion_event_id: string;
  document_id: string;
  event_type: CanonicalIngestionEventType;
  status: CanonicalIngestionEventStatus;
  pedido_manual: string | null;
  pedido_id: null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ExportIngestionEventsOptions {
  outputPath?: string;
}

export interface ExportIngestionEventsResult {
  outputPath: string;
  totalEvents: number;
  files: string[];
}

const CANONICAL_EVENT_TYPES = new Set<CanonicalIngestionEventType>([
  'document.detected',
  'document.linked',
  'document.accepted',
  'document.rejected',
]);

function normalizeIngestionEventStatus(value: unknown): CanonicalIngestionEventStatus {
  if (value == null || String(value).trim() === '') return null;
  const status = String(value).trim().toLowerCase();
  if (status === 'pending_app_acceptance') return 'pending';
  if (status === 'pending' || status === 'assigned' || status === 'accepted' || status === 'rejected') {
    return status;
  }
  throw new Error(`Invalid ingestion event status: ${status}`);
}

function toIsoTimestamp(value: unknown, eventId: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`ingestion_events.created_at is required for ${eventId}`);
  }
  const raw = value.trim();
  const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ingestion_events.created_at for ${eventId}: ${raw}`);
  }
  return date.toISOString();
}

export function listIngestionEvents(): CanonicalIngestionEvent[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT
      id,
      event_type,
      pedido_manual,
      document_id,
      storage_backend,
      storage_uri,
      drive_file_id,
      drive_web_view_link,
      manifest_storage_uri,
      manifest_drive_file_id,
      status,
      created_at,
      reason
    FROM ingestion_events
    ORDER BY created_at ASC, id ASC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const ingestionEventId = typeof row.id === 'string' ? row.id.trim() : '';
    if (!ingestionEventId) {
      throw new Error('ingestion_events.id is required; canonical export does not generate synthetic IDs.');
    }
    const documentId = typeof row.document_id === 'string' ? row.document_id.trim() : '';
    if (!documentId) {
      throw new Error(`ingestion_events.document_id is required for ${ingestionEventId}`);
    }
    const eventType = row.event_type as CanonicalIngestionEventType;
    if (!CANONICAL_EVENT_TYPES.has(eventType)) {
      throw new Error(`Invalid ingestion event type for ${ingestionEventId}: ${String(row.event_type)}`);
    }
    const normalizedStatus = normalizeIngestionEventStatus(row.status);
    const status = eventType === 'document.linked' ? 'assigned' : normalizedStatus;
    const pedidoManual = typeof row.pedido_manual === 'string' && row.pedido_manual.trim()
      ? row.pedido_manual.trim()
      : null;

    return {
      schema_version: 1,
      ingestion_event_id: ingestionEventId,
      document_id: documentId,
      event_type: eventType,
      status,
      pedido_manual: pedidoManual,
      pedido_id: null,
      payload: {
        source: 'sqlite.ingestion_events',
        storage_backend: row.storage_backend ?? null,
        storage_uri: row.storage_uri ?? null,
        drive_file_id: row.drive_file_id ?? null,
        drive_web_view_link: row.drive_web_view_link ?? null,
        manifest_storage_uri: row.manifest_storage_uri ?? null,
        manifest_drive_file_id: row.manifest_drive_file_id ?? null,
        reason: row.reason ?? null,
      },
      created_at: toIsoTimestamp(row.created_at, ingestionEventId),
    };
  });
}

export function exportIngestionEvents(
  opts: ExportIngestionEventsOptions = {},
): ExportIngestionEventsResult {
  const outputPath = opts.outputPath && opts.outputPath.trim()
    ? resolve(process.cwd(), opts.outputPath)
    : resolve(process.cwd(), 'data', 'exports', 'ingestion-events.jsonl');
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const events = listIngestionEvents();
  const content = events.map((event) => JSON.stringify(event)).join('\n') + (events.length > 0 ? '\n' : '');
  writeFileSync(outputPath, content, 'utf-8');

  return {
    outputPath,
    totalEvents: events.length,
    files: [outputPath],
  };
}

export interface ExportReceivedResult {
  outputPath: string;
  totalDocuments: number;
  files: string[];
}

export function listReceivedDocuments(
  opts: { daysBack?: number; limit?: number } = {},
): ReceivedDocumentRow[] {
  const database = getDb();
  const limit = Math.min(opts.limit ?? 5000, 5000);
  const where: string[] = [
    "d.status = 'pending'",
    "(d.pedido_manual IS NULL OR d.pedido_manual = '')",
  ];
  const params: any[] = [];

  if (opts.daysBack !== undefined) {
    if (!Number.isFinite(opts.daysBack) || opts.daysBack < 1) {
      throw new Error(`daysBack must be a positive integer (got ${opts.daysBack})`);
    }
    const since = new Date();
    since.setDate(since.getDate() - opts.daysBack);
    const sinceIso = since.toISOString().replace('T', ' ').slice(0, 19);
    where.push('COALESCE(d.email_received_at, d.created_at) >= ?');
    params.push(sinceIso);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const sql = `
    SELECT
      d.id AS document_id,
      d.gmail_message_id,
      d.thread_id,
      d.filename_original,
      d.sha256,
      d.tipo_documento,
      d.formato,
      d.direcao_nf,
      d.drive_file_id,
      d.drive_web_view_link,
      d.sender_email,
      d.email_message_id,
      d.email_received_at,
      d.email_received_at_source,
      CAST(d.email_received_at_estimated AS INTEGER) AS email_received_at_estimated,
      d.created_at,
      d.updated_at,
      det.id AS detected_event_id,
      det.created_at AS detected_event_created_at
    FROM documentos d
    INNER JOIN (
      SELECT e.document_id, e.id, e.created_at
      FROM ingestion_events e
      WHERE e.event_type = 'document.detected'
    ) det ON det.document_id = d.id
    ${whereClause}
    ORDER BY COALESCE(d.email_received_at, d.created_at) DESC
    LIMIT ?
  `;
  params.push(limit);
  return (database.prepare(sql).all(...params) as ReceivedDocumentRow[]).map((row) => ({
    ...row,
    email_received_at_estimated: Boolean(row.email_received_at_estimated),
  }));
}

export function exportReceivedDocuments(
  opts: ExportReceivedOptions = {},
): ExportReceivedResult {
  const baseDir = opts.outputPath && opts.outputPath.trim()
    ? resolve(process.cwd(), opts.outputPath)
    : resolve(process.cwd(), 'data', 'exports', 'documentos-recebidos.jsonl');

  const dir = dirname(baseDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const rows = listReceivedDocuments({
    daysBack: opts.daysBack,
    limit: opts.limit,
  });

  const content = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
  writeFileSync(baseDir, content, 'utf-8');

  return {
    outputPath: baseDir,
    totalDocuments: rows.length,
    files: [baseDir],
  };
}
