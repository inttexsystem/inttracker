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
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
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

// Credential env vars are near-universally hand-pasted from a browser
// (Google Cloud Console, the Supabase dashboard) into a terminal. A
// trailing newline/space from the clipboard is invisible but makes the
// value byte-for-byte wrong — Google's invalid_client is exactly that
// failure mode with no hint that whitespace is the cause. Every
// credential-shaped env var is trimmed at the single point it's read.
function envTrim(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : v;
}

// Resolves the OAuth client id+secret. If BACKUP_GOOGLE_CLIENT_SECRETS_FILE
// points at the JSON that Cloud Console lets you download per client
// ("Download JSON" / "Baixar JSON"), both values are read from it as a
// MATCHED PAIR — this is the robust path, since the #1 cause of
// invalid_client is pairing an id and secret from two different clients.
// Falls back to the individual BACKUP_GOOGLE_CLIENT_ID/SECRET env vars.
function resolveGoogleClient() {
  const file = envTrim('BACKUP_GOOGLE_CLIENT_SECRETS_FILE');
  if (file) {
    if (!existsSync(file)) {
      fail(EXIT_CODES.USAGE, `BACKUP_GOOGLE_CLIENT_SECRETS_FILE not found: ${file}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf-8'));
    } catch (e) {
      fail(EXIT_CODES.USAGE, `Could not parse BACKUP_GOOGLE_CLIENT_SECRETS_FILE as JSON: ${file}`);
    }
    // Cloud Console wraps the credentials under "installed" (Desktop app)
    // or "web" (Web application); accept a flat shape too.
    const node = parsed.installed || parsed.web || parsed;
    const clientId = typeof node.client_id === 'string' ? node.client_id.trim() : undefined;
    const clientSecret = typeof node.client_secret === 'string' ? node.client_secret.trim() : undefined;
    if (!clientId || !clientSecret) {
      fail(EXIT_CODES.USAGE, `${file} has no client_id/client_secret under "installed"/"web". Re-download it from Cloud Console.`);
    }
    return { clientId, clientSecret, fromFile: true };
  }
  return { clientId: envTrim('BACKUP_GOOGLE_CLIENT_ID'), clientSecret: envTrim('BACKUP_GOOGLE_CLIENT_SECRET'), fromFile: false };
}

// Best-effort browser open; the URL is always printed as a fallback.
// rundll32 takes the URL as a plain argv entry — no cmd.exe quoting
// hazards with the '&'s inside an OAuth URL.
function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // fall through — URL is printed either way
  }
}

const LOGIN_SUCCESS_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>Ravatex Backups — autorizado</title>
<body style="font-family:sans-serif;max-width:34em;margin:4em auto;text-align:center">
<h2>&#9989; Autoriza&ccedil;&atilde;o conclu&iacute;da</h2>
<p>Pode fechar esta aba e voltar ao terminal.</p></body></html>`;

function loginErrorHtml(err) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>Ravatex Backups — erro</title>
<body style="font-family:sans-serif;max-width:34em;margin:4em auto;text-align:center">
<h2>&#10060; Autoriza&ccedil;&atilde;o falhou</h2>
<p>${String(err).replace(/[<>&]/g, '')}</p>
<p>Volte ao terminal e tente novamente.</p></body></html>`;
}

async function runLogin() {
  const { clientId, clientSecret, fromFile } = resolveGoogleClient();
  const tokenPath = process.env.BACKUP_GOOGLE_TOKEN_PATH || '.ravatex-local/backup-google-token.json';
  if (fromFile) {
    console.log(`Using client id+secret from BACKUP_GOOGLE_CLIENT_SECRETS_FILE (matched pair).`);
  }

  if (!clientId || !clientSecret) {
    fail(EXIT_CODES.USAGE, 'login requires BACKUP_GOOGLE_CLIENT_ID and BACKUP_GOOGLE_CLIENT_SECRET.');
    return;
  }
  // The two values are visually similar in the Cloud Console UI and a
  // swap produces only an opaque invalid_client much later, at token
  // exchange. Catch the recognizable shapes up front.
  if (/\.apps\.googleusercontent\.com$/.test(clientSecret)) {
    fail(EXIT_CODES.USAGE,
      'BACKUP_GOOGLE_CLIENT_SECRET looks like a CLIENT ID (*.apps.googleusercontent.com). ' +
      'The client SECRET is the other value in Cloud Console (current format starts with "GOCSPX-").');
    return;
  }
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    console.warn('warning: BACKUP_GOOGLE_CLIENT_ID does not end in .apps.googleusercontent.com — is it really the client ID?');
  }
  if (!clientSecret.startsWith('GOCSPX-')) {
    console.warn(`warning: BACKUP_GOOGLE_CLIENT_SECRET does not start with "GOCSPX-" (length=${clientSecret.length}). ` +
      'Recently created OAuth client secrets always do — double-check you copied the Client secret, not something else.');
  }

  // Loopback flow (Google's recommended pattern for installed apps): a
  // local one-shot HTTP server on an ephemeral 127.0.0.1 port receives
  // the redirect and captures ?code= automatically — the user just
  // clicks Allow; no manual copy-paste, no dead-end error page. A
  // manual-paste prompt still runs concurrently as a fallback (headless
  // machine, browser on another host). BACKUP_GOOGLE_REDIRECT_URI
  // overrides the redirect and forces the manual-only flow.
  const manualRedirect = envTrim('BACKUP_GOOGLE_REDIRECT_URI');
  let redirectUri;
  let server = null;
  let codeFromServer = new Promise(() => {});

  if (manualRedirect) {
    redirectUri = manualRedirect;
  } else {
    server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    redirectUri = `http://localhost:${server.address().port}`;
    codeFromServer = new Promise((resolve) => {
      server.on('request', (req, res) => {
        const u = new URL(req.url, redirectUri);
        const code = u.searchParams.get('code');
        const error = u.searchParams.get('error');
        if (!code && !error) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(code ? LOGIN_SUCCESS_HTML : loginErrorHtml(error));
        resolve({ code, error });
      });
    });
  }

  const url = buildAuthUrl({ clientId, redirectUri });
  console.log('\nThis grants a DEDICATED Drive OAuth token for backups (scope: drive.file),');
  console.log("separate from the Documents Ingestor's grant.\n");
  console.log('Opening your browser... if it does not open, use this URL:\n');
  console.log('  ' + url + '\n');
  if (server) {
    console.log('After you click "Permitir/Allow", this terminal continues AUTOMATICALLY.');
    console.log('(Fallback only: you may also paste the ?code= value from the browser below.)\n');
  } else {
    console.log('Grant access, then paste the authorization code here.\n');
  }
  openBrowser(url);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const codeFromPaste = rl.question('Authorization code (or just wait): ').then((t) => ({ code: t.trim(), error: null }));

  const { code, error } = await Promise.race([codeFromServer, codeFromPaste]);
  rl.close();
  if (server) {
    server.closeAllConnections?.();
    server.close();
  }

  if (error) {
    fail(EXIT_CODES.USAGE, `Google returned an authorization error: ${error}`);
    return;
  }
  if (!code) {
    fail(EXIT_CODES.USAGE, 'No code received. Aborting.');
    return;
  }

  console.log('\nCode received. Exchanging for a token...');
  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ clientId, clientSecret, redirectUri, code });
  } catch (e) {
    if (/invalid_client/.test(e.message)) {
      console.error(
        '\nGoogle rejected the CLIENT SECRET (not the code). Checklist:\n' +
        '  1. In Cloud Console > Credentials, open this exact OAuth client\n' +
        `     (ID ending "...${clientId.slice(-30)}")\n` +
        '  2. Click "Reset secret" (Redefinir chave secreta), copy the NEW value\n' +
        '  3. Re-set $env:BACKUP_GOOGLE_CLIENT_SECRET with it and run login again\n' +
        '  A secret from a DIFFERENT client/project also causes exactly this error.\n');
    }
    throw e;
  }
  const dir = dirname(tokenPath);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`\nSUCCESS. Token saved to ${tokenPath}. Never commit this file (already covered by .gitignore's .ravatex-local/).`);
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
  const { clientId, clientSecret } = resolveGoogleClient();
  const folderName = process.env.BACKUP_GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'Ravatex Backups';
  let refreshToken = envTrim('BACKUP_GOOGLE_REFRESH_TOKEN');
  if (!refreshToken) {
    const tokenPath = process.env.BACKUP_GOOGLE_TOKEN_PATH || '.ravatex-local/backup-google-token.json';
    if (existsSync(tokenPath)) {
      try {
        refreshToken = JSON.parse(readFileSync(tokenPath, 'utf-8')).refresh_token?.trim();
      } catch {
        // fall through — caller reports missing refresh token
      }
    }
  }
  return { clientId, clientSecret, refreshToken, folderName };
}

async function runExportCommand(opts) {
  const pgHost = envTrim('PGHOST');
  const supabaseUrl = envTrim('SUPABASE_URL');

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
    database: (process.env.PGDATABASE || 'postgres').trim(),
    user: (process.env.PGUSER || 'postgres').trim(),
    password: envTrim('PGPASSWORD'),
    sslmode: (process.env.PGSSLMODE || 'require').trim(),
  };
  const missing = [];
  if (!pgConn.host) missing.push('PGHOST');
  if (!pgConn.password) missing.push('PGPASSWORD');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!envTrim('SUPABASE_SERVICE_ROLE_KEY')) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const drive = loadDriveConfig();
  if (!drive.clientId) missing.push('BACKUP_GOOGLE_CLIENT_ID');
  if (!drive.clientSecret) missing.push('BACKUP_GOOGLE_CLIENT_SECRET');
  if (!drive.refreshToken) missing.push('BACKUP_GOOGLE_REFRESH_TOKEN (or a token file via `login`)');
  if (missing.length) {
    fail(EXIT_CODES.USAGE, `Missing required input for a confirmed run: ${missing.join(', ')}`);
    return;
  }

  config.pgConn = pgConn;
  config.supabase = { url: supabaseUrl, serviceRoleKey: envTrim('SUPABASE_SERVICE_ROLE_KEY') };
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

export { parseArgs, assertNotProduction, loadDriveConfig, envTrim };
