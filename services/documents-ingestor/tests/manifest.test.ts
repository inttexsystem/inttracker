import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
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

  it('loads empty manifest for non-existent file with google_drive backend', () => {
    const m = loadManifest(manifestPath);
    expect(m.schema_version).toBe(1);
    expect(m.documents).toEqual([]);
    expect(m.pedido).toBe('');
    expect(m.storage_backend).toBe('google_drive');
  });

  it('saves and loads manifest', () => {
    const m: Manifest = {
      schema_version: 1,
      pedido: 'PED-25-2026',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      storage_backend: 'google_drive',
      documents: [],
    };
    saveManifest(manifestPath, m);
    const loaded = loadManifest(manifestPath);
    expect(loaded.pedido).toBe('PED-25-2026');
    expect(loaded.storage_backend).toBe('google_drive');
  });

  it('adds document with storage_backend=google_drive and storage_uri', () => {
    const m = addDocumentToManifest(manifestPath, 'PED-25-2026', {
      document_id: 'doc-123',
      tipo_documento: 'nf',
      filename_original: 'nota.pdf',
      sha256: 'a'.repeat(64),
      storage_backend: 'google_drive',
      storage_uri: 'gdrive://file/abc123',
      drive_file_id: 'abc123',
      drive_folder_id: 'folder-xyz',
      drive_web_view_link: 'https://drive.google.com/file/d/abc123/view',
      ingested_at: '2026-01-01T00:00:00.000Z',
      event_id: 'evt-123',
      status: 'pending_app_acceptance',
    });
    expect(m.documents).toHaveLength(1);
    expect(m.documents[0].storage_backend).toBe('google_drive');
    expect(m.documents[0].storage_uri).toBe('gdrive://file/abc123');
    expect(m.documents[0].drive_file_id).toBe('abc123');
  });

  it('manifest can carry local_cache_path but local_path is not required', () => {
    const m = addDocumentToManifest(manifestPath, 'PED-25-2026', {
      document_id: 'doc-456',
      tipo_documento: 'romaneio',
      filename_original: 'romaneio.pdf',
      sha256: 'b'.repeat(64),
      storage_backend: 'google_drive',
      storage_uri: 'gdrive://file/xyz789',
      drive_file_id: 'xyz789',
      local_cache_path: './data/cache/pedidos/PED-25-2026/2026-01-01/romaneio/romaneio.pdf',
      ingested_at: '2026-01-01T00:00:00.000Z',
      event_id: 'evt-456',
      status: 'pending_app_acceptance',
    });
    expect(m.documents[0].local_cache_path).toContain('data/cache');
    expect(m.documents[0].local_path).toBeUndefined();
  });

  it('accepts legacy tipo nf_pdf in document', () => {
    const m = addDocumentToManifest(manifestPath, 'PED-25-2026', {
      document_id: 'doc-legacy',
      tipo_documento: 'nf_pdf',
      filename_original: 'legacy.pdf',
      sha256: 'c'.repeat(64),
      storage_backend: 'google_drive',
      storage_uri: 'gdrive://file/legacy',
      drive_file_id: 'legacy',
      ingested_at: '2026-01-01T00:00:00.000Z',
      event_id: 'evt-legacy',
      status: 'pending_app_acceptance',
    });
    expect(m.documents[0].tipo_documento).toBe('nf_pdf');
  });
});
