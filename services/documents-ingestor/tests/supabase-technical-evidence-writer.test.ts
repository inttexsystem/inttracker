import { describe, it, expect } from 'vitest';
import {
  writeTechnicalEvidence,
  TechnicalEvidenceWriterError,
  type TechnicalEvidenceRpcClient,
  type TechnicalEvidenceRpcParams,
  type TechnicalEvidenceRpcResponse,
  type TechnicalEvidenceWriterErrorKind,
} from '../src/supabase/technicalEvidenceWriter.js';
import type { EvidenceOrigin, TechnicalEvidence } from '../src/types/documentReview.js';
import type { TechnicalEvidenceExportRow } from '../src/types/technicalEvidenceExport.js';

// ---------------------------------------------------------------------------
// Hermetic tests for the technical evidence writer. The Supabase client is a
// fully mocked structural port; no configuration, environment, filesystem or
// network is touched.
// ---------------------------------------------------------------------------

const RPC_NAME = 'upsert_document_technical_evidence_ingestor_state';
const SENTINEL_CNPJ = 'SENTINEL_CNPJ_99999999000199';

interface RecordedCall {
  fn: string;
  params: TechnicalEvidenceRpcParams;
}

interface MockClient {
  client: TechnicalEvidenceRpcClient;
  calls: RecordedCall[];
}

/** A client that resolves every `.rpc()` with a fixed response and records calls. */
function mockClient(response: TechnicalEvidenceRpcResponse): MockClient {
  const calls: RecordedCall[] = [];
  const client: TechnicalEvidenceRpcClient = {
    rpc(fn, params) {
      calls.push({ fn, params });
      return Promise.resolve(response);
    },
  };
  return { client, calls };
}

/** A client whose `.rpc()` rejects with a fixed value, still recording the call. */
function rejectingClient(rejection: unknown): MockClient {
  const calls: RecordedCall[] = [];
  const client: TechnicalEvidenceRpcClient = {
    rpc(fn, params) {
      calls.push({ fn, params });
      return Promise.reject(rejection);
    },
  };
  return { client, calls };
}

function okResponse(row: TechnicalEvidenceExportRow, outcome: 'inserted' | 'unchanged'): TechnicalEvidenceRpcResponse {
  return {
    data: [{ document_id: row.documentId, evidence_version: row.evidenceVersion, outcome }],
    error: null,
  };
}

function makeTechnicalEvidence(): TechnicalEvidence {
  return {
    tipoDocumento: 'nf',
    formato: 'xml',
    xmlObservation: { classification: 'structural_nfe' },
    pdfObservation: { classification: 'unavailable', reasons: [] },
    mimeExtensionObservation: { compatibility: 'unavailable', mimeType: null, extension: null },
    // Sentinel lives inside the technical payload; it must never surface in a
    // thrown error message.
    cnpjEmitente: { kind: 'valid', normalized: SENTINEL_CNPJ },
    cnpjDestinatario: { kind: 'unavailable' },
    registryAvailability: { kind: 'not_observed' },
    directionObservation: null,
    entityMatch: null,
    duplicateRelation: { kind: 'none', detectionBasis: 'no duplicate observation' },
  };
}

function makeOrigin(evidenceVersion = 7): EvidenceOrigin {
  return {
    technical: { source: 'classifier-v3', authorship: 'documents-ingestor' },
    suggestion: { source: 'system', authorship: 'review-engine', note: 'requires human review' },
    evidenceVersion,
  };
}

function makeRow(): TechnicalEvidenceExportRow {
  return {
    schemaVersion: 1,
    documentId: 'document-42',
    evidenceVersion: 7,
    technicalEvidence: makeTechnicalEvidence(),
    origin: makeOrigin(7),
    createdAt: '2026-07-12T10:30:00.000Z',
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Narrows an unknown caught value to the writer error and asserts its kind. */
function assertWriterError(err: unknown, kind: TechnicalEvidenceWriterErrorKind): TechnicalEvidenceWriterError {
  expect(err).toBeInstanceOf(TechnicalEvidenceWriterError);
  if (!(err instanceof TechnicalEvidenceWriterError)) throw err;
  expect(err.kind).toBe(kind);
  return err;
}

async function callAndCatch(
  client: TechnicalEvidenceRpcClient,
  row: TechnicalEvidenceExportRow,
): Promise<unknown> {
  return writeTechnicalEvidence(client, row).then(
    (value) => value,
    (err: unknown) => err,
  );
}

describe('writeTechnicalEvidence — RPC call and parameter mapping', () => {
  it('calls the exact migration-49 RPC name', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(RPC_NAME);
  });

  it('sends exactly the five RPC parameters', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(Object.keys(calls[0].params).sort()).toEqual([
      'p_created_at',
      'p_document_id',
      'p_evidence_version',
      'p_origin',
      'p_technical_evidence',
    ]);
    expect(calls[0].params.p_document_id).toBe(row.documentId);
    expect(calls[0].params.p_evidence_version).toBe(row.evidenceVersion);
  });

  it('does not send schemaVersion to the RPC', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    const keys = Object.keys(calls[0].params);
    expect(keys).not.toContain('schemaVersion');
    expect(keys).not.toContain('p_schema_version');
    expect('schemaVersion' in calls[0].params).toBe(false);
  });

  it('preserves technicalEvidence and origin as objects (no manual serialization)', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(calls[0].params.p_technical_evidence).toBe(row.technicalEvidence);
    expect(calls[0].params.p_origin).toBe(row.origin);
    expect(typeof calls[0].params.p_technical_evidence).not.toBe('string');
    expect(typeof calls[0].params.p_origin).not.toBe('string');
  });

  it('preserves createdAt verbatim (no timestamp normalization)', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(calls[0].params.p_created_at).toBe(row.createdAt);
    expect(calls[0].params.p_created_at).toBe('2026-07-12T10:30:00.000Z');
  });
});

describe('writeTechnicalEvidence — successful outcomes', () => {
  it('returns inserted', async () => {
    const row = makeRow();
    const { client } = mockClient(okResponse(row, 'inserted'));

    await expect(writeTechnicalEvidence(client, row)).resolves.toEqual({
      documentId: row.documentId,
      evidenceVersion: row.evidenceVersion,
      outcome: 'inserted',
    });
  });

  it('returns unchanged', async () => {
    const row = makeRow();
    const { client } = mockClient(okResponse(row, 'unchanged'));

    await expect(writeTechnicalEvidence(client, row)).resolves.toEqual({
      documentId: row.documentId,
      evidenceVersion: row.evidenceVersion,
      outcome: 'unchanged',
    });
  });
});

describe('writeTechnicalEvidence — remote error classification', () => {
  it('classifies a divergent-content conflict as conflict', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: 'P0001', message: 'technical_evidence_conflict: divergent stored content for document_id=document-42 evidence_version=7' },
    });

    const err = await callAndCatch(client, row);
    const writerError = assertWriterError(err, 'conflict');
    expect(writerError.cause).toBeDefined();
  });

  it('classifies the service_role gate rejection as writer_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '42501', message: 'writer_required' },
    });

    assertWriterError(await callAndCatch(client, row), 'writer_required');
  });

  it('classifies a PostgREST schema-cache miss (PGRST202) as migration_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.upsert_document_technical_evidence_ingestor_state in the schema cache',
      },
    });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });

  it('classifies an undefined_function (42883) as migration_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '42883', message: 'function public.upsert_document_technical_evidence_ingestor_state(...) does not exist' },
    });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });

  it('classifies any other remote failure as remote_error', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('does not misclassify a generic error as migration_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '23514', message: 'new row violates check constraint' },
    });

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });
});

describe('writeTechnicalEvidence — invalid response rejection', () => {
  it('rejects data: null without error as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({ data: null, error: null });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects an empty collection as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({ data: [], error: null });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects multiple rows as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: [
        { document_id: row.documentId, evidence_version: row.evidenceVersion, outcome: 'inserted' },
        { document_id: row.documentId, evidence_version: row.evidenceVersion, outcome: 'unchanged' },
      ],
      error: null,
    });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects an unknown outcome as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: [{ document_id: row.documentId, evidence_version: row.evidenceVersion, outcome: 'conflict' }],
      error: null,
    });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects a divergent document_id as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: [{ document_id: 'other-document', evidence_version: row.evidenceVersion, outcome: 'inserted' }],
      error: null,
    });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects a divergent evidence_version as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: [{ document_id: row.documentId, evidence_version: 999, outcome: 'inserted' }],
      error: null,
    });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });

  it('rejects a non-object row as invalid_response', async () => {
    const row = makeRow();
    const { client } = mockClient({ data: ['not-an-object'], error: null });

    assertWriterError(await callAndCatch(client, row), 'invalid_response');
  });
});

describe('writeTechnicalEvidence — safety and invariants', () => {
  it('does not mutate the input row or its nested evidence', async () => {
    const row = makeRow();
    const snapshot = JSON.parse(JSON.stringify(row));
    deepFreeze(row);
    const { client } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(row).toEqual(snapshot);
  });

  it('never renders technical payload into the error message', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: 'P0001', message: `technical_evidence_conflict: leaked ${SENTINEL_CNPJ}` },
    });

    const err = await callAndCatch(client, row);
    const writerError = assertWriterError(err, 'conflict');
    expect(writerError.message).not.toContain(SENTINEL_CNPJ);
    expect(writerError.message).not.toContain('99999999000199');
    expect(writerError.message).not.toContain(row.createdAt);
    expect(writerError.message).not.toContain(JSON.stringify(row.technicalEvidence));
    // The original error is preserved as cause for programmatic inspection.
    expect(writerError.cause).toEqual({ code: 'P0001', message: `technical_evidence_conflict: leaked ${SENTINEL_CNPJ}` });
  });

  it('performs exactly one RPC call per invocation (success path)', async () => {
    const row = makeRow();
    const { client, calls } = mockClient(okResponse(row, 'inserted'));

    await writeTechnicalEvidence(client, row);

    expect(calls).toHaveLength(1);
  });

  it('performs exactly one RPC call per invocation (error path)', async () => {
    const row = makeRow();
    const { client, calls } = mockClient({ data: null, error: { code: '08006', message: 'connection failure' } });

    await callAndCatch(client, row);

    expect(calls).toHaveLength(1);
  });
});

describe('writeTechnicalEvidence — migration_required hardening (R1)', () => {
  it('treats a permission error on the RPC as remote_error, not migration_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '42501', message: `permission denied for function ${RPC_NAME}` },
    });

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('treats an unrelated "does not exist" object as remote_error', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '42P01', message: 'relation unrelated_table does not exist' },
    });

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('treats a generic error that only names the RPC as remote_error (name alone is insufficient)', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: 'XX000', message: `unexpected failure while executing ${RPC_NAME}` },
    });

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('classifies PGRST202 as migration_required even when the message omits the RPC name (code-driven)', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' },
    });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });

  it('classifies a schema-cache message naming the RPC, without the code, as migration_required (text-driven)', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { message: `Could not find the function public.${RPC_NAME} in the schema cache` },
    });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });

  it('classifies undefined_function (42883) that names the RPC as migration_required', async () => {
    const row = makeRow();
    const { client } = mockClient({
      data: null,
      error: { code: '42883', message: `function public.${RPC_NAME}(text, integer, jsonb, jsonb, timestamptz) does not exist` },
    });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });
});

describe('writeTechnicalEvidence — rpc() rejection handling (R1)', () => {
  it('converts a generic Error rejection into a typed remote_error', async () => {
    const row = makeRow();
    const { client } = rejectingClient(new Error('network down'));

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('converts a non-Error rejection into a typed remote_error', async () => {
    const row = makeRow();
    const { client } = rejectingClient('socket hang up');

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('reuses classification when the rejection carries a concrete absence signal', async () => {
    const row = makeRow();
    const { client } = rejectingClient({ code: 'PGRST202', message: 'Could not find the function in the schema cache' });

    assertWriterError(await callAndCatch(client, row), 'migration_required');
  });

  it('does not assume a rejection is a missing migration', async () => {
    const row = makeRow();
    const { client } = rejectingClient(new Error('does not exist somewhere unrelated'));

    assertWriterError(await callAndCatch(client, row), 'remote_error');
  });

  it('preserves the original rejection as cause', async () => {
    const row = makeRow();
    const rejection = new Error('network down');
    const { client } = rejectingClient(rejection);

    const err = assertWriterError(await callAndCatch(client, row), 'remote_error');
    expect(err.cause).toBe(rejection);
  });

  it('never renders payload into a rejection error message', async () => {
    const row = makeRow();
    const { client } = rejectingClient(new Error(`boom leaking ${SENTINEL_CNPJ}`));

    const err = assertWriterError(await callAndCatch(client, row), 'remote_error');
    expect(err.message).not.toContain(SENTINEL_CNPJ);
    expect(err.message).not.toContain('99999999000199');
    expect(err.message).not.toContain(row.createdAt);
    expect(err.message).not.toContain(JSON.stringify(row.technicalEvidence));
  });

  it('makes exactly one rpc() call even when it rejects', async () => {
    const row = makeRow();
    const { client, calls } = rejectingClient(new Error('network down'));

    await callAndCatch(client, row);

    expect(calls).toHaveLength(1);
  });
});
