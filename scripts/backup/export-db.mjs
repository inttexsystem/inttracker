#!/usr/bin/env node
// scripts/backup/export-db.mjs
//
// Trigger-agnostic database exporter — Camada 3, BK4.2.
// Contract: docs/architecture/CAMADA3_BACKUP_CONTRACT.md (SS5).
//
// Runnable identically from a GH Actions step, a Vercel cron function,
// or an operator's terminal (Windows/macOS/Linux) — see the phase
// report for the full runtime-choice justification. No branching logic
// keyed on "which trigger called me" lives in this file.
//
// USAGE
//   node scripts/backup/export-db.mjs [export] [--confirm]
//       [--triggered-by manual|scheduled] [--retention-class gfs|manual]
//       [--out-dir <path>] [--dest <name>]...
//   node scripts/backup/export-db.mjs login
//
// INPUTS — environment variables only, never CLI arguments (contract SS5):
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE
//       Standard libpq vars — the DB connection. Provided by the
//       architect at run time (HARD STOP: never entered into chat,
//       never committed, never logged).
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//       For the db/64 writer RPCs (iniciar_backup_run/finalizar_backup_run).
//   BACKUP_GOOGLE_CLIENT_ID, BACKUP_GOOGLE_CLIENT_SECRET,
//   BACKUP_GOOGLE_REFRESH_TOKEN (or BACKUP_GOOGLE_TOKEN_PATH to read a
//   token file saved by the `login` subcommand)
//       Dedicated OAuth grant for backups (contract SS4) — separate
//       from the Documents Ingestor's grant/folder.
//   BACKUP_GOOGLE_DRIVE_ROOT_FOLDER_NAME (default: "Ravatex Backups")
//   BACKUP_OUT_DIR (default: ./backups, already gitignored)
//   BACKUP_ALLOW_PRODUCTION=true — explicit opt-out of the production
//       guard. Never set for this phase; staging-only boundary in force.
//
// Without --confirm: structural dry-run. No DB connection, no Supabase
// call, no Drive call — prints the exact commands that would run and
// exits 0. This mirrors this repo's established --confirm-real-*
// convention (services/documents-ingestor).

import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXIT_CODES, PRODUCTION_REF, planExport, runExport } from './lib/export-core.mjs';
import { buildAuthUrl, exchangeCodeForTokens } from './lib/drive.mjs';
import { buildRedactor } from './lib/sanitize.mjs';

const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

function parseArgs(argv) {
  const opts = { confirm: false, triggeredBy: 'manual', retentionClass: null, destinations: [], outDir: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') opts.confirm = true;
    else if (a === '--triggered-by') opts.triggeredBy = argv[++i];
    else if (a === '--retention-class') opts.retentionClass = argv[++i];
    else if (a === '--out-dir') opts.outDir = argv[++i];
    else if (a === '--dest') opts.destinations.push(argv[++i]);
    else rest.push(a);
  }
  return { opts, rest };
}

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

async function runLogin() {
  const clientId = process.env.BACKUP_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.BACKUP_GOOGLE_CLIENT_SECRET;
  // "urn:ietf:wg:oauth:2.0:oob" (the old copy-paste flow) is deprecated
  // and rejected by Google for new OAuth clients. http://localhost matches
  // the Documents Ingestor's own documented convention (README.md) — the
  // browser redirect fails to load (nothing is listening), but the code
  // is still visible in the address bar's ?code= for manual paste.
  const redirectUri = process.env.BACKUP_GOOGLE_REDIRECT_URI || 'http://localhost';
  const tokenPath = process.env.BACKUP_GOOGLE_TOKEN_PATH || '.ravatex-local/backup-google-token.json';

  if (!clientId || !clientSecret) {
    fail(EXIT_CODES.USAGE, 'login requires BACKUP_GOOGLE_CLIENT_ID and BACKUP_GOOGLE_CLIENT_SECRET.');
    return;
  }

  const url = buildAuthUrl({ clientId, redirectUri });
  console.log('\nThis grants a DEDICATED Drive OAuth token for backups (scope: drive.file),');
  console.log('separate from the Documents Ingestor\'s grant. Open the following URL:\n');
  console.log('  ' + url + '\n');
  console.log('Grant access, then paste the authorization code here.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = await rl.question('Authorization code: ');
  rl.close();

  if (!code.trim()) {
    fail(EXIT_CODES.USAGE, 'No code provided. Aborting.');
    return;
  }

  const tokens = await exchangeCodeForTokens({ clientId, clientSecret, redirectUri, code: code.trim() });
  const dir = dirname(tokenPath);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`Token saved to ${tokenPath}. Never commit this file (already covered by .gitignore's .ravatex-local/).`);
}

function assertNotProduction(pgHost, supabaseUrl) {
  if (process.env.BACKUP_ALLOW_PRODUCTION === 'true') return;
  const haystack = `${pgHost || ''} ${supabaseUrl || ''}`;
  if (haystack.includes(PRODUCTION_REF)) {
    fail(
      EXIT_CODES.USAGE,
      `Refusing to run: target references the PRODUCTION ref (${PRODUCTION_REF}). ` +
        `Staging-only execution boundary is in force. Set BACKUP_ALLOW_PRODUCTION=true to override (not authorized for this phase).`,
    );
  }
}

function loadDriveConfig() {
  const clientId = process.env.BACKUP_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.BACKUP_GOOGLE_CLIENT_SECRET;
  const folderName = process.env.BACKUP_GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'Ravatex Backups';
  let refreshToken = process.env.BACKUP_GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    const tokenPath = process.env.BACKUP_GOOGLE_TOKEN_PATH || '.ravatex-local/backup-google-token.json';
    if (existsSync(tokenPath)) {
      try {
        refreshToken = JSON.parse(readFileSync(tokenPath, 'utf-8')).refresh_token;
      } catch {
        // fall through — caller reports missing refresh token
      }
    }
  }
  return { clientId, clientSecret, refreshToken, folderName };
}

async function runExportCommand(opts) {
  const pgHost = process.env.PGHOST;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (opts.triggeredBy && !['manual', 'scheduled'].includes(opts.triggeredBy)) {
    fail(EXIT_CODES.USAGE, `invalid --triggered-by: ${opts.triggeredBy} (expected manual|scheduled)`);
    return;
  }
  const retentionClass = opts.retentionClass || (opts.triggeredBy === 'manual' ? 'manual' : 'gfs');
  if (!['gfs', 'manual'].includes(retentionClass)) {
    fail(EXIT_CODES.USAGE, `invalid --retention-class: ${retentionClass} (expected gfs|manual)`);
    return;
  }

  const config = {
    triggeredBy: opts.triggeredBy,
    retentionClass,
    destinations: opts.destinations,
    outDir: opts.outDir || process.env.BACKUP_OUT_DIR || 'backups',
  };

  if (!opts.confirm) {
    const plan = planExport(config);
    console.log(JSON.stringify(plan, null, 2));
    process.exit(plan.exitCode);
    return;
  }

  assertNotProduction(pgHost, supabaseUrl);

  const pgConn = {
    host: pgHost,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    sslmode: process.env.PGSSLMODE || 'require',
  };
  const missing = [];
  if (!pgConn.host) missing.push('PGHOST');
  if (!pgConn.password) missing.push('PGPASSWORD');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const drive = loadDriveConfig();
  if (!drive.clientId) missing.push('BACKUP_GOOGLE_CLIENT_ID');
  if (!drive.clientSecret) missing.push('BACKUP_GOOGLE_CLIENT_SECRET');
  if (!drive.refreshToken) missing.push('BACKUP_GOOGLE_REFRESH_TOKEN (or a token file via `login`)');
  if (missing.length) {
    fail(EXIT_CODES.USAGE, `Missing required input for a confirmed run: ${missing.join(', ')}`);
    return;
  }

  config.pgConn = pgConn;
  config.supabase = { url: supabaseUrl, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
  config.drive = drive;

  const redact = buildRedactor([pgConn.password, config.supabase.serviceRoleKey, drive.clientSecret, drive.refreshToken]);
  const io = { log: (msg) => console.log(redact(String(msg))) };

  const result = await runExport(config, io);
  console.log(JSON.stringify({ ...result, exitCode: undefined }, null, 2));
  process.exit(result.exitCode);
}

async function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2));
  const command = rest[0] || 'export';

  if (command === 'login') {
    await runLogin();
    return;
  }
  if (command !== 'export') {
    fail(EXIT_CODES.USAGE, `Unknown command: ${command} (expected export|login)`);
    return;
  }
  await runExportCommand(opts);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e) => {
    console.error(`fatal: ${e.message}`);
    process.exit(EXIT_CODES.USAGE);
  });
}

export { parseArgs, assertNotProduction, loadDriveConfig };
