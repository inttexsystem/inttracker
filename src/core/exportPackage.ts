import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { queryAndExportEvents } from './outbox.js';
import { buildManifestFromDb } from './syncManifest.js';
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
