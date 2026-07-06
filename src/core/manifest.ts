import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TipoDocumento } from '../types/document.js';

export interface ManifestDocument {
  document_id: string;
  tipo_documento: TipoDocumento;
  filename_original: string;
  sha256: string;
  local_path: string;
  ingested_at: string;
  event_id: string;
  status: 'pending_app_acceptance' | 'accepted' | 'rejected';
}

export interface Manifest {
  schema_version: 1;
  pedido: string;
  created_at: string;
  updated_at: string;
  documents: ManifestDocument[];
}

export function loadManifest(manifestPath: string): Manifest {
  if (!existsSync(manifestPath)) {
    return {
      schema_version: 1,
      pedido: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      documents: [],
    };
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}

export function saveManifest(manifestPath: string, manifest: Manifest): void {
  const dir = dirname(manifestPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  manifest.updated_at = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export function addDocumentToManifest(
  manifestPath: string,
  pedido: string,
  doc: ManifestDocument,
): Manifest {
  const manifest = loadManifest(manifestPath);
  if (manifest.pedido === '') {
    manifest.pedido = pedido;
  }
  manifest.documents.push(doc);
  saveManifest(manifestPath, manifest);
  return manifest;
}
