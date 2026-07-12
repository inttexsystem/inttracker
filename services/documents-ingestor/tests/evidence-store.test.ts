import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  appendTechnicalEvidence,
  getCurrentTechnicalEvidence,
  listTechnicalEvidenceHistory,
} from '../src/core/evidenceStore.js';
import type { EvidenceOrigin, TechnicalEvidence } from '../src/types/documentReview.js';

function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE documentos (id TEXT PRIMARY KEY);
    CREATE TABLE document_technical_evidences (
      document_id TEXT NOT NULL,
      evidence_version INTEGER NOT NULL CHECK (evidence_version >= 1),
      technical_evidence TEXT NOT NULL,
      origin TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (document_id, evidence_version),
      FOREIGN KEY (document_id) REFERENCES documentos(id)
    );
  `);
  return db;
}

function insertDocument(db: Database.Database, id: string): void {
  db.prepare('INSERT INTO documentos (id) VALUES (?)').run(id);
}

function evidence(label = 'first'): TechnicalEvidence {
  return {
    tipoDocumento: null,
    formato: null,
    xmlObservation: { classification: 'unavailable' },
    pdfObservation: { classification: 'unavailable', reasons: [] },
    mimeExtensionObservation: { compatibility: 'unavailable', mimeType: null, extension: null },
    cnpjEmitente: { kind: 'unavailable' },
    cnpjDestinatario: { kind: 'unavailable' },
    registryAvailability: { kind: 'not_observed' },
    directionObservation: null,
    entityMatch: null,
    duplicateRelation: { kind: 'none', detectionBasis: label },
  };
}

function origin(): Omit<EvidenceOrigin, 'evidenceVersion'> {
  return {
    technical: { source: 'classifier', authorship: 'evidence-store-test' },
    suggestion: { source: 'system', authorship: 'review', note: 'human review required' },
  };
}

describe('local technical evidence store', () => {
  it('allocates monotonically increasing versions and persists the allocated version in origin', () => {
    const db = createDb();
    insertDocument(db, 'doc-versioned');

    const first = appendTechnicalEvidence(db, {
      documentId: 'doc-versioned', technicalEvidence: evidence('first'), origin: origin(),
    });
    const second = appendTechnicalEvidence(db, {
      documentId: 'doc-versioned', technicalEvidence: evidence('second'), origin: origin(),
    });

    expect(first.evidenceVersion).toBe(1);
    expect(first.origin.evidenceVersion).toBe(1);
    expect(second.evidenceVersion).toBe(2);
    expect(second.origin.evidenceVersion).toBe(2);
    expect(listTechnicalEvidenceHistory(db, 'doc-versioned').map((entry) => entry.evidenceVersion))
      .toEqual([1, 2]);

    const rows = db.prepare(
      'SELECT evidence_version, origin FROM document_technical_evidences WHERE document_id = ? ORDER BY evidence_version',
    ).all('doc-versioned') as Array<{ evidence_version: number; origin: string }>;
    expect(rows.map((row) => [row.evidence_version, JSON.parse(row.origin).evidenceVersion]))
      .toEqual([[1, 1], [2, 2]]);
  });

  it('participates in an existing transaction without opening a nested transaction', () => {
    const db = createDb();
    insertDocument(db, 'doc-external-transaction');

    db.transaction(() => {
      const stored = appendTechnicalEvidence(db, {
        documentId: 'doc-external-transaction', technicalEvidence: evidence(), origin: origin(),
      });
      expect(db.inTransaction).toBe(true);
      expect(stored.evidenceVersion).toBe(1);
      expect(getCurrentTechnicalEvidence(db, 'doc-external-transaction')).toMatchObject({
        evidenceVersion: 1,
      });
    })();

    expect(listTechnicalEvidenceHistory(db, 'doc-external-transaction')).toHaveLength(1);
  });

  it('leaves an append under an external transaction subject to the caller rollback', () => {
    const db = createDb();
    insertDocument(db, 'doc-rollback');

    expect(() => db.transaction(() => {
      appendTechnicalEvidence(db, {
        documentId: 'doc-rollback', technicalEvidence: evidence(), origin: origin(),
      });
      throw new Error('force rollback');
    })()).toThrow('force rollback');

    expect(listTechnicalEvidenceHistory(db, 'doc-rollback')).toEqual([]);
  });

  it('returns no observation for legacy documents without evidence rows', () => {
    const db = createDb();
    insertDocument(db, 'legacy-document');

    expect(getCurrentTechnicalEvidence(db, 'legacy-document')).toBeNull();
    expect(listTechnicalEvidenceHistory(db, 'legacy-document')).toEqual([]);
  });

  it('rejects persisted invalid JSON rather than synthesizing evidence', () => {
    const db = createDb();
    insertDocument(db, 'invalid-json');
    db.prepare(`
      INSERT INTO document_technical_evidences (document_id, evidence_version, technical_evidence, origin)
      VALUES (?, ?, ?, ?)
    `).run('invalid-json', 1, '{not-json', JSON.stringify({ ...origin(), evidenceVersion: 1 }));

    expect(() => getCurrentTechnicalEvidence(db, 'invalid-json')).toThrow(/invalid .*JSON/i);
    expect(() => listTechnicalEvidenceHistory(db, 'invalid-json')).toThrow(/invalid .*JSON/i);
  });

  it('rejects a persisted row whose evidence version diverges from origin.evidenceVersion', () => {
    const db = createDb();
    insertDocument(db, 'mismatched-version');
    db.prepare(`
      INSERT INTO document_technical_evidences (document_id, evidence_version, technical_evidence, origin)
      VALUES (?, ?, ?, ?)
    `).run('mismatched-version', 1, JSON.stringify(evidence()), JSON.stringify({ ...origin(), evidenceVersion: 2 }));

    expect(() => getCurrentTechnicalEvidence(db, 'mismatched-version')).toThrow(/diverges from origin\.evidenceVersion/i);
    expect(() => listTechnicalEvidenceHistory(db, 'mismatched-version')).toThrow(/diverges from origin\.evidenceVersion/i);
  });
});
