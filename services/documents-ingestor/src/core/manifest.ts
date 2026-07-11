import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TipoDocumento, FormatoDocumento, DirecaoNF, StorageBackend, TipoDocumentoLegado } from '../types/document.js';

export interface ManifestDocument {
  document_id: string;
  tipo_documento: TipoDocumento | TipoDocumentoLegado;
  formato?: FormatoDocumento;
  direcao_nf?: DirecaoNF | null;
  filename_original: string;
  sha256: string;

  storage_backend: StorageBackend;
  storage_uri: string;
  drive_file_id: string;
  drive_folder_id?: string;
  drive_web_view_link?: string;
  drive_web_content_link?: string;

  local_cache_path?: string;
  local_path?: string;

  ingested_at: string;
  event_id: string;
  status: 'pending_app_acceptance' | 'accepted' | 'rejected';
}

export interface Manifest {
  schema_version: 1 | 2;
  pedido: string;
  created_at: string;
  updated_at: string;

  storage_backend: StorageBackend;
  manifest_storage_uri?: string;
  manifest_drive_file_id?: string;
  manifest_drive_web_view_link?: string;

  documents: ManifestDocument[];
}

export function loadManifest(manifestPath: string): Manifest {
  if (!existsSync(manifestPath)) {
    return {
      schema_version: 1,
      pedido: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      storage_backend: 'google_drive',
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
