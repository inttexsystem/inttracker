import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env');
  const vars: Record<string, string> = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      vars[key] = val;
    }
  }

  for (const key of Object.keys(process.env)) {
    vars[key] = process.env[key]!;
  }

  return vars;
}

const env = loadEnv();

export const config = {
  googleClientId: env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri: env.GOOGLE_REDIRECT_URI ?? '',
  googleTokenPath: resolve(process.cwd(), env.GOOGLE_TOKEN_PATH ?? './data/google-token.json'),

  googleOAuthScopes: (env.GOOGLE_OAUTH_SCOPES
    ? env.GOOGLE_OAUTH_SCOPES.split(',').map(s => s.trim()).filter(Boolean)
    : [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ]),

  googleDriveRootFolderName: env.GOOGLE_DRIVE_ROOT_FOLDER_NAME ?? 'Ravatex Documents Ingestor',
  googleDriveRootFolderId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? '',
  googleDriveCreateMissingFolders: (env.GOOGLE_DRIVE_CREATE_MISSING_FOLDERS ?? 'true').toLowerCase() === 'true',

  localCachePath: resolve(process.cwd(), env.LOCAL_CACHE_PATH ?? './data/cache'),

  databasePath: resolve(process.cwd(), env.DATABASE_PATH ?? './data/app.db'),
  outboxPath: resolve(process.cwd(), env.OUTBOX_PATH ?? './data/outbox/document-events.jsonl'),
  scanDaysBack: parseInt(env.SCAN_DAYS_BACK ?? '7', 10),

  ingestRealGoogle: (env.INGEST_REAL_GOOGLE ?? 'false').toLowerCase() === 'true',

  // Server-side Supabase writer only. This module is never imported by the browser app.
  supabaseUrl: env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  supabaseProjectRef: env.SUPABASE_PROJECT_REF ?? '',
  supabaseWriterEnabled: (env.SUPABASE_WRITER_ENABLED ?? 'false').toLowerCase() === 'true',

  ravatexCnpjs: (env.RAVATEX_CNPJS
    ? env.RAVATEX_CNPJS.split(',').map(s => s.replace(/\D/g, '')).filter(s => s.length === 14)
    : []),
};
