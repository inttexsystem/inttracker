import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';

const HERMETIC_ROOT = join(tmpdir(), `ravatex-hermetic-${randomUUID()}`);
if (!existsSync(HERMETIC_ROOT)) {
  mkdirSync(HERMETIC_ROOT, { recursive: true });
}

process.env.NODE_ENV = 'test';
process.env.INGEST_REAL_GOOGLE = 'false';
process.env.GOOGLE_TOKEN_PATH = join(HERMETIC_ROOT, '__no_token__.json');
process.env.DATABASE_PATH = join(HERMETIC_ROOT, 'app.db');
process.env.OUTBOX_PATH = join(HERMETIC_ROOT, 'outbox.jsonl');
process.env.LOCAL_CACHE_PATH = join(HERMETIC_ROOT, 'cache');
process.env.SCAN_DAYS_BACK = '7';
process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME = 'Ravatex Documents Ingestor';
process.env.GOOGLE_DRIVE_CREATE_MISSING_FOLDERS = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost';
process.env.GOOGLE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive.file';

export const HERMETIC_TEST_ROOT = HERMETIC_ROOT;
