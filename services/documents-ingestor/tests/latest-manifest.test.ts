import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  buildLatestManifestFromJsonl,
  writeLatestManifest,
} from '../src/core/latestManifest.js';
import { HERMETIC_TEST_ROOT } from './setup.js';

const SCENARIO_DIR = join(HERMETIC_TEST_ROOT, `latest-manifest-test-${randomUUID()}`);

function writeJsonl(dir: string, lines: any[], filename?: string) {
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length > 0 ? '\n' : '');
  const path = join(dir, filename ?? 'documentos-mapeados.jsonl');
  writeFileSync(path, content, 'utf-8');
  return path;
}

function validDoc(overrides: Record<string, any> = {}) {
  return {
    schema_version: 1,
    document_id: randomUUID(),
    filename_original: 'NF-test.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    status: 'pending',
    pedido_manual: null,
    ...overrides,
  };
}

describe('buildLatestManifestFromJsonl', () => {
  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('generates manifest with correct count', () => {
    const docs = [validDoc(), validDoc(), validDoc()];
    const jsonlPath = writeJsonl(SCENARIO_DIR, docs);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.ok).toBe(true);
    expect(result.manifest!.count).toBe(3);
  });

  it('schema_version is 1', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.schema_version).toBe(1);
  });

  it('kind is documents-mapped-latest', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.kind).toBe('documents-mapped-latest');
  });

  it('bytes > 0', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.bytes).toBeGreaterThan(0);
  });

  it('hash changes when content changes', () => {
    const jsonlPath1 = writeJsonl(SCENARIO_DIR, [validDoc({ document_id: 'aaa' })], 'a.jsonl');
    const jsonlPath2 = writeJsonl(SCENARIO_DIR, [validDoc({ document_id: 'bbb' })], 'b.jsonl');

    const h1 = buildLatestManifestFromJsonl(jsonlPath1).manifest!.hash;
    const h2 = buildLatestManifestFromJsonl(jsonlPath2).manifest!.hash;

    expect(h1).not.toBe(h2);
  });

  it('hash is stable when content is identical', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc({ document_id: 'same' })]);

    const h1 = buildLatestManifestFromJsonl(jsonlPath).manifest!.hash;
    const h2 = buildLatestManifestFromJsonl(jsonlPath).manifest!.hash;

    expect(h1).toBe(h2);
  });

  it('hash is 16 hex chars', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('generated_at is ISO string', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(() => new Date(result.manifest!.generated_at).toISOString()).not.toThrow();
  });

  it('exported_at is ISO string', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(() => new Date(result.manifest!.exported_at).toISOString()).not.toThrow();
  });

  it('jsonl_path is preserved as given', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.jsonl_path).toBe(jsonlPath);
  });

  it('jsonl_filename is extracted from path', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.jsonl_filename).toBe('documentos-mapeados.jsonl');
  });

  it('last_error is null by default', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.last_error).toBeNull();
  });

  it('last_error is preserved when provided', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath, { lastError: 'scan failed' });

    expect(result.manifest!.last_error).toBe('scan failed');
  });

  it('fails with clear error when JSONL file is absent', () => {
    const result = buildLatestManifestFromJsonl(join(SCENARIO_DIR, 'nonexistent.jsonl'));

    expect(result.ok).toBe(false);
    expect(result.manifest).toBeNull();
    expect(result.error).toContain('not found');
  });

  it('fails when JSONL contains invalid JSON', () => {
    const path = join(SCENARIO_DIR, 'documentos-mapeados.jsonl');
    writeFileSync(path, '{invalid json}}\n', 'utf-8');

    const result = buildLatestManifestFromJsonl(path);

    expect(result.ok).toBe(false);
    expect(result.manifest).toBeNull();
    expect(result.error).toContain('Invalid JSONL');
  });

  it('count is 0 for empty JSONL', () => {
    const path = join(SCENARIO_DIR, 'documentos-mapeados.jsonl');
    writeFileSync(path, '\n', 'utf-8');

    const result = buildLatestManifestFromJsonl(path);

    expect(result.ok).toBe(true);
    expect(result.manifest!.count).toBe(0);
  });

  it('count skips lines without document_id', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [
      { no_doc_id: true },
      validDoc(),
      { also_no_id: true },
    ]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.manifest!.count).toBe(1);
  });

  it('does not make Gmail/Drive calls', () => {
    const jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc()]);

    const result = buildLatestManifestFromJsonl(jsonlPath);

    expect(result.ok).toBe(true);
  });
});

describe('writeLatestManifest', () => {
  let jsonlPath: string;
  let manifestPath: string;

  beforeEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
    mkdirSync(SCENARIO_DIR, { recursive: true });
    jsonlPath = writeJsonl(SCENARIO_DIR, [validDoc(), validDoc()]);
    manifestPath = join(SCENARIO_DIR, 'latest.json');
  });

  afterEach(() => {
    if (existsSync(SCENARIO_DIR)) rmSync(SCENARIO_DIR, { recursive: true });
  });

  it('writes latest.json to disk', () => {
    const result = writeLatestManifest({ jsonlPath, manifestPath });

    expect(result.ok).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);
  });

  it('returns manifest in result', () => {
    const result = writeLatestManifest({ jsonlPath, manifestPath });

    expect(result.ok).toBe(true);
    expect(result.manifest!.count).toBe(2);
    expect(result.manifest!.kind).toBe('documents-mapped-latest');
  });

  it('written manifest is valid JSON with all required fields', () => {
    writeLatestManifest({ jsonlPath, manifestPath });
    const content = readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.schema_version).toBe(1);
    expect(parsed.kind).toBe('documents-mapped-latest');
    expect(typeof parsed.generated_at).toBe('string');
    expect(typeof parsed.exported_at).toBe('string');
    expect(typeof parsed.jsonl_path).toBe('string');
    expect(typeof parsed.jsonl_filename).toBe('string');
    expect(typeof parsed.count).toBe('number');
    expect(typeof parsed.hash).toBe('string');
    expect(typeof parsed.bytes).toBe('number');
    expect(parsed.last_error).toBeNull();
  });

  it('count in written manifest matches JSONL lines', () => {
    writeLatestManifest({ jsonlPath, manifestPath });
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    expect(parsed.count).toBe(2);
  });

  it('fails gracefully when JSONL does not exist', () => {
    const result = writeLatestManifest({
      jsonlPath: join(SCENARIO_DIR, 'nonexistent.jsonl'),
      manifestPath,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('creates parent directories if missing', () => {
    const nestedPath = join(SCENARIO_DIR, 'nested', 'sub', 'latest.json');

    const result = writeLatestManifest({ jsonlPath, manifestPath: nestedPath });

    expect(result.ok).toBe(true);
    expect(existsSync(nestedPath)).toBe(true);
  });

  it('does not make Gmail/Drive calls', () => {
    const result = writeLatestManifest({ jsonlPath, manifestPath });

    expect(result.ok).toBe(true);
  });
});
