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
    where.push('d.created_at >= ?');
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
    ORDER BY d.created_at DESC
    LIMIT ?
  `;
  params.push(limit);
  return database.prepare(sql).all(...params) as ReceivedDocumentRow[];
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
