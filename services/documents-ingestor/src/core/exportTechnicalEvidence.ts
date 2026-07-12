import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getCurrentTechnicalEvidence } from './evidenceStore.js';
import { projectCurrentTechnicalEvidenceExport } from './technicalEvidenceExport.js';
import type { TechnicalEvidenceExportRow } from '../types/technicalEvidenceExport.js';

export interface ExportCurrentTechnicalEvidenceOptions {
  outputPath: string;
}

export interface ExportCurrentTechnicalEvidenceResult {
  outputPath: string;
  exportedRows: number;
  skippedWithoutEvidence: number;
}

interface DocumentIdRow {
  id: string;
}

export function exportCurrentTechnicalEvidence(
  db: Database.Database,
  { outputPath }: ExportCurrentTechnicalEvidenceOptions,
): ExportCurrentTechnicalEvidenceResult {
  const documents = db.prepare<[], DocumentIdRow>(`
    SELECT id
    FROM documentos
    ORDER BY id ASC
  `).all();
  const rows: TechnicalEvidenceExportRow[] = [];
  let skippedWithoutEvidence = 0;

  for (const document of documents) {
    const stored = getCurrentTechnicalEvidence(db, document.id);
    const row = projectCurrentTechnicalEvidenceExport(stored);
    if (row === null) {
      skippedWithoutEvidence += 1;
      continue;
    }
    rows.push(row);
  }

  const outputDirectory = dirname(outputPath);
  if (!existsSync(outputDirectory)) {
    mkdirSync(outputDirectory, { recursive: true });
  }

  const content = rows.map(serializeExportRow).join('\n') + (rows.length > 0 ? '\n' : '');
  writeFileSync(outputPath, content, 'utf-8');

  return {
    outputPath,
    exportedRows: rows.length,
    skippedWithoutEvidence,
  };
}

function serializeExportRow(row: TechnicalEvidenceExportRow): string {
  const serialized = JSON.stringify(row);
  if (serialized === undefined) {
    throw new Error('Technical evidence export row is not JSON-serializable');
  }
  return serialized;
}
