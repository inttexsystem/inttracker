import Database from 'better-sqlite3';
import type { EvidenceOrigin, TechnicalEvidence } from '../types/documentReview.js';

export interface AppendTechnicalEvidenceInput {
  documentId: string;
  technicalEvidence: TechnicalEvidence;
  /**
   * The producer supplies provenance but not a version. Version allocation is
   * local to this store so a snapshot and its provenance cannot disagree.
   */
  origin: Omit<EvidenceOrigin, 'evidenceVersion'>;
}

export interface StoredTechnicalEvidence {
  documentId: string;
  evidenceVersion: number;
  technicalEvidence: TechnicalEvidence;
  origin: EvidenceOrigin;
  createdAt: string;
}

type EvidenceRow = {
  document_id: string;
  evidence_version: number;
  technical_evidence: string;
  origin: string;
  created_at: string;
};

/**
 * Appends an immutable technical-evidence snapshot. When invoked outside a
 * transaction, allocation and insertion run in an IMMEDIATE transaction; an
 * enclosing transaction remains wholly owned by its caller.
 */
export function appendTechnicalEvidence(
  db: Database.Database,
  input: AppendTechnicalEvidenceInput,
): StoredTechnicalEvidence {
  const append = (): StoredTechnicalEvidence => {
    const nextVersionRow = db.prepare(`
      SELECT COALESCE(MAX(evidence_version), 0) + 1 AS evidence_version
      FROM document_technical_evidences
      WHERE document_id = ?
    `).get(input.documentId) as { evidence_version: number };
    const evidenceVersion = nextVersionRow.evidence_version;
    const origin: EvidenceOrigin = { ...input.origin, evidenceVersion };
    const technicalEvidenceJson = stringifyJson(input.technicalEvidence, 'technical evidence');
    const originJson = stringifyJson(origin, 'evidence origin');

    db.prepare(`
      INSERT INTO document_technical_evidences (
        document_id, evidence_version, technical_evidence, origin
      ) VALUES (?, ?, ?, ?)
    `).run(input.documentId, evidenceVersion, technicalEvidenceJson, originJson);

    const row = db.prepare(`
      SELECT document_id, evidence_version, technical_evidence, origin, created_at
      FROM document_technical_evidences
      WHERE document_id = ? AND evidence_version = ?
    `).get(input.documentId, evidenceVersion) as EvidenceRow | undefined;

    if (!row) {
      throw new Error('Technical evidence insert did not produce a persisted row');
    }
    return parseEvidenceRow(row);
  };

  return db.inTransaction ? append() : db.transaction(append).immediate();
}

/** Returns the latest snapshot, or null for a legacy document with no rows. */
export function getCurrentTechnicalEvidence(
  db: Database.Database,
  documentId: string,
): StoredTechnicalEvidence | null {
  const row = db.prepare(`
    SELECT document_id, evidence_version, technical_evidence, origin, created_at
    FROM document_technical_evidences
    WHERE document_id = ?
    ORDER BY evidence_version DESC
    LIMIT 1
  `).get(documentId) as EvidenceRow | undefined;

  return row ? parseEvidenceRow(row) : null;
}

/** Returns immutable snapshots in ascending evidence-version order. */
export function listTechnicalEvidenceHistory(
  db: Database.Database,
  documentId: string,
): StoredTechnicalEvidence[] {
  const rows = db.prepare(`
    SELECT document_id, evidence_version, technical_evidence, origin, created_at
    FROM document_technical_evidences
    WHERE document_id = ?
    ORDER BY evidence_version ASC
  `).all(documentId) as EvidenceRow[];

  return rows.map(parseEvidenceRow);
}

function stringifyJson(value: unknown, label: string): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${errorMessage(error)}`);
  }
  if (json === undefined) {
    throw new Error(`Invalid ${label} JSON: value is not JSON-serializable`);
  }
  return json;
}

function parseEvidenceRow(row: EvidenceRow): StoredTechnicalEvidence {
  const technicalEvidence = parseJson(row.technical_evidence, 'technical evidence') as TechnicalEvidence;
  const origin = parseOrigin(row.origin);

  if (row.evidence_version !== origin.evidenceVersion) {
    throw new Error(
      `Evidence row version ${row.evidence_version} diverges from origin.evidenceVersion ${origin.evidenceVersion}`,
    );
  }

  return {
    documentId: row.document_id,
    evidenceVersion: row.evidence_version,
    technicalEvidence,
    origin,
    createdAt: row.created_at,
  };
}

function parseOrigin(json: string): EvidenceOrigin {
  const origin = parseJson(json, 'evidence origin');
  if (!isRecord(origin)) {
    throw new Error('Invalid evidence origin JSON: evidenceVersion must be a positive integer');
  }

  const evidenceVersion = origin.evidenceVersion;
  if (typeof evidenceVersion !== 'number' || !Number.isSafeInteger(evidenceVersion) || evidenceVersion < 1) {
    throw new Error('Invalid evidence origin JSON: evidenceVersion must be a positive integer');
  }
  return origin as unknown as EvidenceOrigin;
}

function parseJson(json: string, label: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${errorMessage(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
