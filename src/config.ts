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
  databasePath: resolve(process.cwd(), env.DATABASE_PATH ?? './data/app.db'),
  documentRootPath: resolve(process.cwd(), env.DOCUMENT_ROOT_PATH ?? './data/documents'),
  outboxPath: resolve(process.cwd(), env.OUTBOX_PATH ?? './data/outbox/document-events.jsonl'),
  scanDaysBack: parseInt(env.SCAN_DAYS_BACK ?? '7', 10),
};
