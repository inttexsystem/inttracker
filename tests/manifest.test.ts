import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest, saveManifest, addDocumentToManifest } from '../src/core/manifest.js';
import type { Manifest } from '../src/core/manifest.js';

describe('manifest', () => {
  const tmpDir = join(tmpdir(), 'ravatex-manifest-test');
  const manifestPath = join(tmpDir, 'manifest.json');

  beforeEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('loads empty manifest for non-existent file', () => {
    const m = loadManifest(manifestPath);
    expect(m.schema_version).toBe(1);
    expect(m.documents).toEqual([]);
    expect(m.pedido).toBe('');
  });

  it('saves and loads manifest', () => {
    const m: Manifest = {
      schema_version: 1,
      pedido: 'PED-25-2026',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      documents: [],
    };
    saveManifest(manifestPath, m);
    const loaded = loadManifest(manifestPath);
    expect(loaded.pedido).toBe('PED-25-2026');
  });

  it('adds document to manifest', () => {
    const m = addDocumentToManifest(manifestPath, 'PED-25-2026', {
      document_id: 'doc-123',
      tipo_documento: 'nf_pdf',
      filename_original: 'nota.pdf',
      sha256: 'a'.repeat(64),
      local_path: 'pedidos/PED-25-2026/2026-01-01/nf/nota.pdf',
      ingested_at: '2026-01-01T00:00:00.000Z',
      event_id: 'evt-123',
      status: 'pending_app_acceptance',
    });
    expect(m.documents).toHaveLength(1);
    expect(m.documents[0].document_id).toBe('doc-123');
  });
});
