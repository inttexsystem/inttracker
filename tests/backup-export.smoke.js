// Smoke tests for the trigger-agnostic database exporter — BK4.2
// (Camada 3 backup contract: docs/architecture/CAMADA3_BACKUP_CONTRACT.md).
//
// Two layers:
//   - CLI-level (spawnSync of the real export-db.mjs): argument
//     validation, dry-run default, the production-ref guard, missing-
//     input USAGE errors. No real binaries/network/credentials needed —
//     these paths all exit before touching any of them.
//   - Core-level (dynamic import of lib/export-core.mjs with a fully
//     injected `io`): exit-code classification, the bucket-check
//     fail-loud path, upload-failure handling, and the sanitization
//     proof — a forced worst-case leak from a mocked pg_dump is
//     asserted absent from every log line, the returned error, and the
//     payload sent to finalizar_backup_run.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'backup', 'export-db.mjs');
const CORE_URL = pathToFileURL(path.join(ROOT, 'scripts', 'backup', 'lib', 'export-core.mjs')).href;

function loadCore() {
  return import(CORE_URL);
}

// A minimal env with every credential-shaped var stripped, so CLI-level
// tests never accidentally inherit a real value from the host shell.
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(PG|SUPABASE_|BACKUP_GOOGLE_)/.test(k)) delete env[k];
  }
  return { ...env, ...extra };
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8', env: cleanEnv(env) });
}

test('CLI: no --confirm is a structural dry-run, exit 0, touches nothing', () => {
  const res = runCli(['export']);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.dry_run, true);
  assert.equal(out.ok, true);
  assert.match(out.planned.commands.join('\n'), /pg_dump --schema=public --schema-only/);
  assert.match(out.planned.commands.join('\n'), /pg_dump --schema=auth/);
  assert.deepEqual(out.planned.destinations, ['google_drive']);
});

test('CLI: retention-class defaults from triggered-by (manual -> manual, scheduled -> gfs)', () => {
  const manual = JSON.parse(runCli(['export']).stdout);
  assert.equal(manual.retention_class, 'manual');
  const scheduled = JSON.parse(runCli(['export', '--triggered-by', 'scheduled']).stdout);
  assert.equal(scheduled.retention_class, 'gfs');
});

test('CLI: invalid --triggered-by is a USAGE error (exit 1), before any I/O', () => {
  const res = runCli(['export', '--triggered-by', 'bogus']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /invalid --triggered-by/);
});

test('CLI: invalid --retention-class is a USAGE error (exit 1)', () => {
  const res = runCli(['export', '--retention-class', 'bogus']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /invalid --retention-class/);
});

test('CLI: unknown subcommand is a USAGE error (exit 1)', () => {
  const res = runCli(['nonsense']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Unknown command/);
});

test('CLI: --confirm with no env at all fails USAGE (exit 1) and lists missing inputs', () => {
  const res = runCli(['export', '--confirm']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Missing required input/);
  assert.match(res.stderr, /PGHOST/);
  assert.match(res.stderr, /SUPABASE_URL/);
});

test('CLI: production-ref guard fires before the missing-input check', () => {
  const res = runCli(['export', '--confirm'], { PGHOST: 'db.bhgifjrfagkzubpyqpew.supabase.co' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /PRODUCTION ref/);
  assert.doesNotMatch(res.stderr, /Missing required input/);
});

test('CLI: BACKUP_ALLOW_PRODUCTION override is honored (guard skipped, falls through to missing-input check)', () => {
  const res = runCli(['export', '--confirm'], {
    PGHOST: 'db.bhgifjrfagkzubpyqpew.supabase.co',
    BACKUP_ALLOW_PRODUCTION: 'true',
  });
  assert.equal(res.status, 1);
  assert.doesNotMatch(res.stderr, /PRODUCTION ref/);
  assert.match(res.stderr, /Missing required input/);
});

test('CLI: credential env vars are trimmed — a trailing newline/space (common clipboard artifact) does not read as missing', async () => {
  const { envTrim } = await import(pathToFileURL(CLI).href);
  const original = process.env.BACKUP_GOOGLE_CLIENT_ID;
  try {
    process.env.BACKUP_GOOGLE_CLIENT_ID = '  some-client-id\r\n';
    assert.equal(envTrim('BACKUP_GOOGLE_CLIENT_ID'), 'some-client-id');
    process.env.BACKUP_GOOGLE_CLIENT_ID = '';
    assert.equal(envTrim('BACKUP_GOOGLE_CLIENT_ID'), '');
  } finally {
    if (original === undefined) delete process.env.BACKUP_GOOGLE_CLIENT_ID;
    else process.env.BACKUP_GOOGLE_CLIENT_ID = original;
  }
});

test('CLI: production-ref guard still fires when PGHOST has trailing whitespace from a pasted value', () => {
  const res = runCli(['export', '--confirm'], { PGHOST: 'db.bhgifjrfagkzubpyqpew.supabase.co \r\n' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /PRODUCTION ref/);
});

test('CLI: login without client id/secret fails USAGE (exit 1), no interactive prompt reached', () => {
  const res = runCli(['login']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /BACKUP_GOOGLE_CLIENT_ID/);
});

// ---------------------------------------------------------------------
// Core-level: injected io, no real binaries/network/credentials.
// ---------------------------------------------------------------------

function makeFakeIo({ bucketCount = 0, driveUploadOk = true, pgDumpLeak = null, iniciarOk = true } = {}) {
  const logs = [];
  const rpcCalls = [];
  const spawnCalls = [];
  let workDir = null;

  const KNOWN_BINS = ['pg_dump', 'psql', 'tar'];
  const isKnownBin = (bin) => KNOWN_BINS.some((k) => bin === k || bin.endsWith(k));

  const spawnSyncFake = (bin, args, spawnOpts = {}) => {
    spawnCalls.push({ bin, args });
    if (!isKnownBin(bin)) return { status: 1, stdout: '', stderr: `not found: ${bin}` };
    if (args.includes('--version')) return { status: 0, stdout: 'fake 1.0', stderr: '' };

    if (bin === 'pg_dump' || bin.endsWith('pg_dump')) {
      if (pgDumpLeak) {
        return { status: 1, stdout: '', stderr: pgDumpLeak };
      }
      const fIdx = args.indexOf('-f');
      if (fIdx >= 0) fs.writeFileSync(args[fIdx + 1], '-- fake dump\n');
      return { status: 0, stdout: '', stderr: '' };
    }
    if (bin === 'psql' || bin.endsWith('psql')) {
      const sql = args[args.length - 1];
      if (/storage\.buckets/.test(sql)) return { status: 0, stdout: `${bucketCount}\n`, stderr: '' };
      return { status: 0, stdout: '{"public.usuarios":10,"auth.users":10}\n', stderr: '' };
    }
    if (bin === 'tar' || bin.endsWith('tar')) {
      // createBundle passes a relative archive name with cwd set to its
      // directory (see lib/manifest.mjs — avoids the GNU-tar drive-letter
      // remote-spec ambiguity), so the fake must honor spawnOpts.cwd too.
      const fIdx = args.indexOf('-czf');
      if (fIdx >= 0) {
        const target = spawnOpts.cwd ? path.join(spawnOpts.cwd, args[fIdx + 1]) : args[fIdx + 1];
        fs.writeFileSync(target, 'fake-bundle-bytes');
      }
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unknown fake bin: ${bin}` };
  };

  const fetchImplFake = async (url, reqOpts = {}) => {
    const body = reqOpts.body ? safeJson(reqOpts.body) : null;

    if (url.includes('/rpc/iniciar_backup_run')) {
      rpcCalls.push({ url, body });
      if (!iniciarOk) return jsonResponse(400, { ok: false, error: 'forced_iniciar_failure' });
      return jsonResponse(200, { ok: true, run_id: 'test-run-id', scope: body.p_scope, triggered_by: body.p_triggered_by, retention_class: body.p_retention_class });
    }
    if (url.includes('/rpc/finalizar_backup_run')) {
      rpcCalls.push({ url, body });
      return jsonResponse(200, { ok: true, run_id: body.p_run_id, status: body.p_status, destinations_recorded: (body.p_destinations || []).length });
    }
    if (url.includes('oauth2.googleapis.com/token')) {
      return jsonResponse(200, { access_token: 'fake-access-token', expires_in: 3600 });
    }
    if (url.includes('/drive/v3/files') && (!reqOpts.method || reqOpts.method === 'GET')) {
      return jsonResponse(200, { files: [{ id: 'fake-folder-id', name: 'Ravatex Backups' }] });
    }
    if (url.includes('/upload/drive/v3/files')) {
      if (!driveUploadOk) return jsonResponse(500, { error: { message: 'forced_upload_failure' } });
      return jsonResponse(200, { id: 'fake-file-id', webViewLink: 'https://drive.google.com/file/d/fake-file-id/view' });
    }
    if (url === 'https://www.googleapis.com/drive/v3/files') {
      return jsonResponse(200, { id: 'fake-folder-id' });
    }
    throw new Error(`fetchImplFake: unmocked url ${url}`);
  };

  const io = {
    log: (msg) => logs.push(msg),
    spawnSync: spawnSyncFake,
    fetchImpl: fetchImplFake,
    now: () => '2026-07-17T00:00:00.000Z',
    mkdtemp: () => {
      workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ravatex-backup-test-'));
      return workDir;
    },
  };
  return { io, logs, rpcCalls, spawnCalls, getWorkDir: () => workDir };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function jsonResponse(status, obj) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  };
}

function baseConfig(overrides = {}) {
  return {
    triggeredBy: 'manual',
    retentionClass: 'manual',
    destinations: [],
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ravatex-backup-out-')),
    pgConn: { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'test-pg-password', sslmode: 'require' },
    supabase: { url: 'https://fake.supabase.co', serviceRoleKey: 'fake-service-role-key' },
    drive: { clientId: 'fake-client-id', clientSecret: 'fake-client-secret', refreshToken: 'fake-refresh-token', folderName: 'Ravatex Backups' },
    ...overrides,
  };
}

test('core: happy path — exit 0, both destinations recorded, run finalized completed', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const { io, rpcCalls } = makeFakeIo({ bucketCount: 0, driveUploadOk: true });
  const result = await runExport(baseConfig(), io);

  assert.equal(result.exitCode, EXIT_CODES.OK);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  const dests = result.destinations.reduce((acc, d) => ({ ...acc, [d.destination]: d.status }), {});
  assert.equal(dests.google_drive, 'ok');
  assert.equal(dests.onedrive, 'skipped');

  const finalizeCall = rpcCalls.find((c) => c.url.includes('finalizar_backup_run'));
  assert.equal(finalizeCall.body.p_status, 'completed');
  assert.equal(finalizeCall.body.p_destinations.length, 2);
  assert.ok(finalizeCall.body.p_sha256);
  assert.ok(finalizeCall.body.p_row_count_manifest['public.usuarios'] === 10);
});

test('core: bucket check fail-loud — nonzero bucket count aborts BEFORE any dump, exit PREFLIGHT_BUCKET', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const { io, spawnCalls, rpcCalls } = makeFakeIo({ bucketCount: 3 });
  const result = await runExport(baseConfig(), io);

  assert.equal(result.exitCode, EXIT_CODES.PREFLIGHT_BUCKET);
  assert.equal(result.ok, false);
  assert.match(result.error, /storage_bucket_appeared/);

  const dumpCalls = spawnCalls.filter((c) => c.bin === 'pg_dump' && c.args.includes('-f'));
  assert.equal(dumpCalls.length, 0, 'pg_dump must never run once the bucket pre-flight fails');

  const finalizeCall = rpcCalls.find((c) => c.url.includes('finalizar_backup_run'));
  assert.equal(finalizeCall.body.p_status, 'failed');
  assert.match(finalizeCall.body.p_error, /storage_bucket_appeared/);
});

test('core: iniciar_backup_run rejection -> RECORD_FAILED, no run ever opened, no dump attempted', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const { io, spawnCalls } = makeFakeIo({ iniciarOk: false });
  const result = await runExport(baseConfig(), io);

  assert.equal(result.exitCode, EXIT_CODES.RECORD_FAILED);
  assert.equal(result.run_id, undefined);
  assert.equal(spawnCalls.filter((c) => c.bin === 'pg_dump' && c.args.includes('-f')).length, 0);
});

test('core: primary destination upload failure -> UPLOAD_FAILED, run finalized failed with the destination row', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const { io, rpcCalls } = makeFakeIo({ bucketCount: 0, driveUploadOk: false });
  const result = await runExport(baseConfig(), io);

  assert.equal(result.exitCode, EXIT_CODES.UPLOAD_FAILED);
  assert.equal(result.ok, false);
  const dests = result.destinations.reduce((acc, d) => ({ ...acc, [d.destination]: d.status }), {});
  assert.equal(dests.google_drive, 'failed');

  const finalizeCall = rpcCalls.find((c) => c.url.includes('finalizar_backup_run'));
  assert.equal(finalizeCall.body.p_status, 'failed');
  assert.equal(finalizeCall.body.p_destinations.find((d) => d.destination === 'google_drive').status, 'failed');
});

test('core: missing binary -> USAGE, before any Supabase/Drive call', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const { io, rpcCalls } = makeFakeIo();
  const result = await runExport(baseConfig(), { ...io, pgDumpBin: 'definitely-not-a-real-binary-xyz' });

  assert.equal(result.exitCode, EXIT_CODES.USAGE);
  assert.equal(rpcCalls.length, 0, 'no run should ever be opened if a required binary is missing');
});

test('sanitization: a forced credential leak from pg_dump never survives into logs, the result, or the finalize payload', async () => {
  const { runExport, EXIT_CODES } = await loadCore();
  const poisonPassword = `S3cr3tPassw0rd-${randomUUID()}`;
  const poisonServiceKey = `eyFAKE.${randomUUID()}.SERVICEROLEKEY`;
  const leakingStderr = `pg_dump: error: connection failed: password=${poisonPassword} role=postgres host=db.example.com`;

  const { io, logs, rpcCalls } = makeFakeIo({ bucketCount: 0, pgDumpLeak: leakingStderr });
  const config = baseConfig({
    pgConn: { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: poisonPassword, sslmode: 'require' },
    supabase: { url: 'https://fake.supabase.co', serviceRoleKey: poisonServiceKey },
  });

  const result = await runExport(config, io);

  assert.equal(result.exitCode, EXIT_CODES.DUMP_FAILED);

  const allLogText = logs.join('\n');
  assert.doesNotMatch(allLogText, new RegExp(escapeRe(poisonPassword)));
  assert.doesNotMatch(allLogText, new RegExp(escapeRe(poisonServiceKey)));

  assert.ok(!JSON.stringify(result).includes(poisonPassword), 'result envelope must not contain the raw password');
  assert.ok(!JSON.stringify(result).includes(poisonServiceKey), 'result envelope must not contain the raw service role key');

  const finalizeCall = rpcCalls.find((c) => c.url.includes('finalizar_backup_run'));
  const finalizePayload = JSON.stringify(finalizeCall.body);
  assert.ok(!finalizePayload.includes(poisonPassword), 'finalizar_backup_run payload must not contain the raw password');
  assert.ok(!finalizePayload.includes(poisonServiceKey), 'finalizar_backup_run payload must not contain the raw service role key');
  assert.match(finalizeCall.body.p_error, /REDACTED/);
});

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
