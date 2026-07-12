import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { format } from 'node:util';
import { appendTechnicalEvidence } from '../src/core/evidenceStore.js';
import { exportCurrentTechnicalEvidence } from '../src/core/exportTechnicalEvidence.js';
import type { TechnicalEvidence } from '../src/types/documentReview.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE documentos (id TEXT PRIMARY KEY);
    CREATE TABLE document_technical_evidences (
      document_id TEXT NOT NULL,
      evidence_version INTEGER NOT NULL,
      technical_evidence TEXT NOT NULL,
      origin TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (document_id, evidence_version)
    );
  `);
  return db;
}

function createOutputPath(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'g28-technical-evidence-export-'));
  temporaryDirectories.push(directory);
  return join(directory, 'nested', name);
}

function technicalEvidence(marker: string): TechnicalEvidence {
  return {
    tipoDocumento: 'nf',
    formato: 'xml',
    xmlObservation: { classification: 'structural_nfe' },
    pdfObservation: { classification: 'unavailable', reasons: [] },
    mimeExtensionObservation: {
      compatibility: 'compatible',
      mimeType: 'application/xml',
      extension: 'xml',
    },
    cnpjEmitente: { kind: 'valid', normalized: '11111111000111' },
    cnpjDestinatario: { kind: 'missing' },
    registryAvailability: { kind: 'available' },
    directionObservation: null,
    entityMatch: null,
    duplicateRelation: { kind: 'none', detectionBasis: marker },
  };
}

function appendEvidence(db: Database.Database, documentId: string, marker: string): void {
  appendTechnicalEvidence(db, {
    documentId,
    technicalEvidence: technicalEvidence(marker),
    origin: {
      technical: { source: 'test-classifier', authorship: 'test' },
      suggestion: { source: 'system', authorship: 'test', note: 'human review required' },
    },
  });
}

function insertDocument(db: Database.Database, documentId: string): void {
  db.prepare('INSERT INTO documentos (id) VALUES (?)').run(documentId);
}

describe('exportCurrentTechnicalEvidence', () => {
  it('exports only current evidence ordered by document id as compact schema-version-1 JSONL', () => {
    const db = createDatabase();
    try {
      insertDocument(db, 'document-b');
      insertDocument(db, 'document-a');
      appendEvidence(db, 'document-b', 'b-current');
      appendEvidence(db, 'document-a', 'a-historical');
      appendEvidence(db, 'document-a', 'a-current');
      const outputPath = createOutputPath('current.jsonl');

      const result = exportCurrentTechnicalEvidence(db, { outputPath });
      const content = readFileSync(outputPath, 'utf-8');
      const rows = content.trimEnd().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);

      expect(result).toEqual({ outputPath, exportedRows: 2, skippedWithoutEvidence: 0 });
      expect(content.endsWith('\n')).toBe(true);
      expect(rows.map((row) => row.documentId)).toEqual(['document-a', 'document-b']);
      expect(rows.map((row) => row.evidenceVersion)).toEqual([2, 1]);
      expect(rows.every((row) => row.schemaVersion === 1)).toBe(true);
      expect(content).not.toContain('a-historical');
      expect(content).not.toContain('humanDecision');
      expect(content).not.toContain('RAW_XML_SENTINEL');
    } finally {
      db.close();
    }
  });

  it('omits legacy documents and counts them as skipped without evidence', () => {
    const db = createDatabase();
    try {
      insertDocument(db, 'legacy-document');
      insertDocument(db, 'current-document');
      appendEvidence(db, 'current-document', 'current');
      const outputPath = createOutputPath('legacy.jsonl');

      const result = exportCurrentTechnicalEvidence(db, { outputPath });

      expect(result).toEqual({ outputPath, exportedRows: 1, skippedWithoutEvidence: 1 });
      expect(readFileSync(outputPath, 'utf-8')).not.toContain('legacy-document');
    } finally {
      db.close();
    }
  });

  it('writes an empty file without a final newline when no current evidence exists', () => {
    const db = createDatabase();
    try {
      insertDocument(db, 'legacy-document');
      const outputPath = createOutputPath('empty.jsonl');

      const result = exportCurrentTechnicalEvidence(db, { outputPath });

      expect(result).toEqual({ outputPath, exportedRows: 0, skippedWithoutEvidence: 1 });
      expect(readFileSync(outputPath, 'utf-8')).toBe('');
    } finally {
      db.close();
    }
  });

  it('rejects a persisted evidence/origin version mismatch without writing output', () => {
    const db = createDatabase();
    try {
      insertDocument(db, 'mismatched-document');
      db.prepare(`
        INSERT INTO document_technical_evidences (
          document_id, evidence_version, technical_evidence, origin, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'mismatched-document',
        1,
        JSON.stringify(technicalEvidence('mismatch')),
        JSON.stringify({
          technical: { source: 'test-classifier', authorship: 'test' },
          suggestion: { source: 'system', authorship: 'test', note: 'human review required' },
          evidenceVersion: 2,
        }),
        '2026-07-12T10:30:00.000Z',
      );
      const outputPath = createOutputPath('mismatch.jsonl');

      expect(() => exportCurrentTechnicalEvidence(db, { outputPath })).toThrow(/version/i);
    } finally {
      db.close();
    }
  });

  it('produces deterministic bytes for unchanged current evidence', () => {
    const db = createDatabase();
    try {
      insertDocument(db, 'document-a');
      appendEvidence(db, 'document-a', 'stable');
      const firstOutputPath = createOutputPath('first.jsonl');
      const secondOutputPath = createOutputPath('second.jsonl');

      exportCurrentTechnicalEvidence(db, { outputPath: firstOutputPath });
      exportCurrentTechnicalEvidence(db, { outputPath: secondOutputPath });

      expect(readFileSync(firstOutputPath)).toEqual(readFileSync(secondOutputPath));
    } finally {
      db.close();
    }
  });

  it('propagates output write failures', () => {
    const db = createDatabase();
    const outputDirectory = mkdtempSync(join(tmpdir(), 'g28-technical-evidence-write-failure-'));
    temporaryDirectories.push(outputDirectory);
    try {
      insertDocument(db, 'document-a');
      appendEvidence(db, 'document-a', 'write-failure');

      expect(() => exportCurrentTechnicalEvidence(db, { outputPath: outputDirectory })).toThrow();
    } finally {
      db.close();
    }
  });
});

describe('export-technical-evidence CLI', () => {
  it('passes the requested temporary output path to the exporter, prints only its summary, and closes the database', async () => {
    const outputPath = createOutputPath('cli-current.jsonl');
    const mockedDb = { marker: 'mocked-sqlite-db' };
    const exportCurrentTechnicalEvidenceMock = vi.fn(() => ({
      outputPath,
      exportedRows: 2,
      skippedWithoutEvidence: 1,
    }));
    const getDbMock = vi.fn(() => mockedDb);
    const closeDbMock = vi.fn();
    const stdout: string[] = [];
    const originalArgv = process.argv;
    const originalExitCode = process.exitCode;
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdout.push(format(...args));
    });

    try {
      vi.resetModules();
      vi.doMock('../src/config.js', () => ({ config: { scanDaysBack: 7 } }));
      vi.doMock('../src/index.js', () => ({
        scanGmail: vi.fn(),
        listPending: vi.fn(),
        assignPedido: vi.fn(),
        exportPendingEvents: vi.fn(),
        queryAndExportEvents: vi.fn(),
      }));
      vi.doMock('../src/core/syncMapped.js', () => ({
        runSyncMapped: vi.fn(),
        validateSyncMappedOptions: vi.fn(),
      }));
      vi.doMock('../src/core/reconcileGmailDocuments.js', () => ({
        reconcileGmailDocuments: vi.fn(),
      }));
      vi.doMock('../src/core/exportTechnicalEvidence.js', () => ({
        exportCurrentTechnicalEvidence: exportCurrentTechnicalEvidenceMock,
      }));
      vi.doMock('../src/storage/sqlite.js', () => ({
        getDb: getDbMock,
        closeDb: closeDbMock,
      }));
      process.argv = ['node', 'cli.ts', 'export-technical-evidence', '--output', outputPath];
      process.exitCode = undefined;

      await import('../src/cli.ts');

      expect(getDbMock).toHaveBeenCalledTimes(1);
      expect(exportCurrentTechnicalEvidenceMock).toHaveBeenCalledWith(mockedDb, { outputPath });
      expect(closeDbMock).toHaveBeenCalledTimes(1);
      expect(stdout).toEqual([
        `[export-technical-evidence] Output: ${outputPath}`,
        '[export-technical-evidence] Exported rows: 2',
        '[export-technical-evidence] Skipped without evidence: 1',
      ]);
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
      consoleLogSpy.mockRestore();
      vi.doUnmock('../src/config.js');
      vi.doUnmock('../src/index.js');
      vi.doUnmock('../src/core/syncMapped.js');
      vi.doUnmock('../src/core/reconcileGmailDocuments.js');
      vi.doUnmock('../src/core/exportTechnicalEvidence.js');
      vi.doUnmock('../src/storage/sqlite.js');
      vi.resetModules();
    }
  });
});
