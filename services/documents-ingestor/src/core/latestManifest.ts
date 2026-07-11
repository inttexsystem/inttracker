import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface LatestManifest {
  schema_version: 1;
  kind: 'documents-mapped-latest';
  generated_at: string;
  exported_at: string;
  jsonl_path: string;
  jsonl_filename: string;
  count: number;
  hash: string;
  bytes: number;
  last_error: string | null;
}

export interface LatestManifestError {
  ok: false;
  error: string;
  manifest: null;
}

export interface LatestManifestSuccess {
  ok: true;
  manifest: LatestManifest;
}

export type LatestManifestResult = LatestManifestError | LatestManifestSuccess;

function shortHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

export function buildLatestManifestFromJsonl(
  jsonlPath: string,
  options: { lastError?: string | null } = {},
): LatestManifestResult {
  const resolved = resolve(process.cwd(), jsonlPath);

  if (!existsSync(resolved)) {
    return {
      ok: false,
      error: `JSONL file not found: ${jsonlPath}`,
      manifest: null,
    };
  }

  let content: string;
  try {
    content = readFileSync(resolved, 'utf-8');
  } catch (e: any) {
    return {
      ok: false,
      error: `Failed to read JSONL file: ${e.message}`,
      manifest: null,
    };
  }

  const stat = statSync(resolved);
  const exportedAt = stat.mtime.toISOString();
  const bytes = stat.size;
  const hash = shortHash(content);

  const lines = content.split('\n').filter((line) => line.trim() !== '');
  let count = 0;
  let parseError: string | null = null;

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object' && typeof obj.document_id === 'string' && obj.document_id) {
        count++;
      }
    } catch (_e) {
      parseError = `Invalid JSONL line: ${line.slice(0, 80)}...`;
      break;
    }
  }

  if (parseError) {
    return {
      ok: false,
      error: parseError,
      manifest: null,
    };
  }

  const filename = resolved.split(/[\\/]/).pop() ?? 'documentos-mapeados.jsonl';

  const manifest: LatestManifest = {
    schema_version: 1,
    kind: 'documents-mapped-latest',
    generated_at: new Date().toISOString(),
    exported_at: exportedAt,
    jsonl_path: jsonlPath,
    jsonl_filename: filename,
    count,
    hash,
    bytes,
    last_error: options.lastError ?? null,
  };

  return { ok: true, manifest };
}

export interface WriteLatestManifestOptions {
  jsonlPath: string;
  manifestPath: string;
  lastError?: string | null;
}

export interface WriteLatestManifestResult {
  ok: boolean;
  manifestPath: string;
  manifest?: LatestManifest;
  error?: string;
}

export function writeLatestManifest(opts: WriteLatestManifestOptions): WriteLatestManifestResult {
  const resolved = resolve(process.cwd(), opts.manifestPath);
  const dir = dirname(resolved);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const result = buildLatestManifestFromJsonl(opts.jsonlPath, { lastError: opts.lastError });

  if (!result.ok) {
    return {
      ok: false,
      manifestPath: resolved,
      error: result.error,
    };
  }

  try {
    writeFileSync(resolved, JSON.stringify(result.manifest, null, 2) + '\n', 'utf-8');
  } catch (e: any) {
    return {
      ok: false,
      manifestPath: resolved,
      error: `Failed to write manifest: ${e.message}`,
    };
  }

  return {
    ok: true,
    manifestPath: resolved,
    manifest: result.manifest,
  };
}
