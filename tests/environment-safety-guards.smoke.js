// Focused environment-safety guard — INTTRACKER-STAGING-AND-BACKUP-
// ENVIRONMENT-SAFETY-R1.
//
// Environment identities (owned by docs/governance/current-state.json and
// js/config.js):
//   ucrjtfswnfdlxwtmxnoo — the definitive PRODUCTION project;
//   gqmpsxkxynrjvidfmojk — RETIRED (not production, staging, development
//                          or fallback);
//   bhgifjrfagkzubpyqpew — FORBIDDEN.
// There is NO non-production database.
//
// This file proves, without touching any real system:
//   1. the classified manifest of scripts/staging is complete — a new
//      executable there fails this test until it is classified;
//   2. every mutation runner fails closed with the stable identity
//      INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE, before a credential
//      prompt, client construction, fetch, browser opening or a local
//      execution-config write, and no override releases it;
//   3. every retained read-only diagnostic demands the exact bare flag
//      --confirm-production-readonly-diagnostic before any side effect,
//      always fails the retired and forbidden projects, and uses read
//      operations only;
//   4. the backup toolchain validates the environment identity before
//      credentials, process spawn, directory creation or upload.
//
// Every runner/diagnostic is executed only in the state where it must
// refuse; nothing here can reach a database, Auth, an Edge Function,
// Drive, pg_dump or psql.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const STAGING_DIR = path.join(ROOT, 'scripts', 'staging');
const BACKUP_CLI = path.join(ROOT, 'scripts', 'backup', 'export-db.mjs');
const BACKUP_CORE = path.join(ROOT, 'scripts', 'backup', 'lib', 'export-core.mjs');

const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';

const FAIL_CLOSED_ID = 'INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE';
const DIAGNOSTIC_FLAG = '--confirm-production-readonly-diagnostic';
const BACKUP_FLAG = '--confirm-production-readonly-backup';

// ---------------------------------------------------------------------
// Classified manifest (see the phase report). Exactly one class per file.
// ---------------------------------------------------------------------

// A. MUTATING_OR_AUTH_WRITE_RUNNER — disabled, never redirected.
// Each entry lists the commands whose real execution path must stop.
const MUTATION_RUNNERS = [
  ['admin-create-user-password-policy-e2e.mjs', ['setup', 'run']],
  ['admin-disable-user-e2e.mjs', ['setup', 'run']],
  ['admin-disable-user-ui-browser-e2e.mjs', ['run']],
  ['admin-reactivate-e2e.mjs', ['setup', 'run']],
  ['admin-reset-password-e2e.mjs', ['setup', 'run']],
  ['trocar-senha-obrigatoria-e2e.mjs', ['setup', 'run']],
  ['usuarios-audit-e2e.mjs', ['setup', 'run']],
  // No subcommand: the refusal runs at module top level.
  ['g25-b3-parceiros-smoke.mjs', ['']],
];

// B. READ_ONLY_NETWORK_DIAGNOSTIC — retained, confirmation-gated.
const READONLY_DIAGNOSTICS = [
  'delete-impact-diag.mjs',
  'expedicao-partial-flow-diag.mjs',
  'latex-consolidation-diag.mjs',
  'latex-merge-precheck.mjs',
  'ops-without-pedido-diag.mjs',
  'orphaned-ops-triage-diag.mjs',
  'production-flow-invariants-diag.mjs',
];

// C. STATIC_OR_DRY_RUN_ONLY — no network, no project ref.
const STATIC_ONLY = ['g12-browser-validation.mjs'];

const readSrc = (file) => fs.readFileSync(path.join(STAGING_DIR, file), 'utf8');

function runNode(file, args) {
  return spawnSync(process.execPath, [path.join(STAGING_DIR, file), ...args], {
    encoding: 'utf8',
    input: '',
    timeout: 20000,
    env: { ...process.env },
  });
}

test('manifest: every executable under scripts/staging is classified exactly once', () => {
  const onDisk = fs.readdirSync(STAGING_DIR).filter((f) => f.endsWith('.mjs')).sort();
  const classified = [
    ...MUTATION_RUNNERS.map(([f]) => f),
    ...READONLY_DIAGNOSTICS,
    ...STATIC_ONLY,
  ].sort();
  assert.deepEqual(onDisk, classified,
    'a new or removed scripts/staging executable must be classified in this manifest');
  assert.equal(new Set(classified).size, classified.length, 'a file is classified twice');
});

// ---------------------------------------------------------------------
// A. Mutation runners fail closed
// ---------------------------------------------------------------------

for (const [file, commands] of MUTATION_RUNNERS) {
  test(`mutation runner ${file}: no valid executable path names production as staging`, () => {
    const src = readSrc(file);
    assert.doesNotMatch(src, /STAGING_REF/, 'STAGING_REF must be gone');
    assert.doesNotMatch(src, /assertStagingUrl/, 'the staging URL guard must be gone');
    assert.match(src, new RegExp(`PRODUCTION_REF\\s*=\\s*['"]${PRODUCTION_REF}['"]`));
    assert.match(src, new RegExp(`RETIRED_REF\\s*=\\s*['"]${RETIRED_REF}['"]`));
    assert.match(src, new RegExp(`FORBIDDEN_REF\\s*=\\s*['"]${FORBIDDEN_REF}['"]`));
    assert.match(src, new RegExp(FAIL_CLOSED_ID));
    // The refusal must be reached before anything effectful in the file.
    const refuseIdx = src.indexOf('refuseNonProductionEnvironmentUnavailable()');
    assert.ok(refuseIdx > 0, 'the fail-closed refusal must be called');
  });

  test(`mutation runner ${file}: no override releases the production write path`, () => {
    const src = readSrc(file);
    assert.doesNotMatch(src, /process\.env\.[A-Z_]*(ALLOW|FORCE|OVERRIDE|CONFIRM|ENABLE)[A-Z_]*/,
      'no environment variable may release the runner');
    assert.doesNotMatch(src, /--(allow|force|confirm)-[a-z-]*production/i,
      'no CLI flag may release the runner');
  });

  for (const cmd of commands) {
    const label = cmd === '' ? '(no subcommand)' : cmd;
    test(`mutation runner ${file} ${label}: stops with ${FAIL_CLOSED_ID}`, () => {
      const res = runNode(file, cmd === '' ? [] : [cmd]);
      assert.equal(res.error, undefined, 'the runner must exit, not hang on a prompt');
      assert.equal(res.status, 3, `expected the fail-closed exit code, got ${res.status}`);
      assert.match(res.stderr, new RegExp(FAIL_CLOSED_ID));
      assert.match(res.stderr, /nao-produtivo/i, 'must state an isolated non-production env is required');
      assert.match(res.stderr, new RegExp(PRODUCTION_REF), 'must state the configured project is production');
      assert.match(res.stderr, /nao e autorizada/i, 'must state production mutation is not authorized');
      // A credential prompt, a browser or a written config would have
      // produced stdout (or blocked) before this point.
      assert.equal(res.stdout.trim(), '', 'nothing may be printed before the refusal');
    });
  }
}

test('mutation runners: help output survives without reaching any external effect', () => {
  const res = runNode('admin-disable-user-e2e.mjs', ['help']);
  assert.equal(res.status, 2, 'unknown command still prints usage and exits 2');
  assert.match(res.stdout, /Uso:/);
});

// ---------------------------------------------------------------------
// B. Read-only diagnostics require the exact production-read-only flag
// ---------------------------------------------------------------------

for (const file of READONLY_DIAGNOSTICS) {
  test(`diagnostic ${file}: current identities, no STAGING_REF`, () => {
    const src = readSrc(file);
    assert.doesNotMatch(src, /STAGING_REF/);
    assert.doesNotMatch(src, /STAGING_DB_URL/);
    assert.match(src, new RegExp(`PRODUCTION_REF\\s*=\\s*'${PRODUCTION_REF}'`));
    assert.match(src, new RegExp(`RETIRED_REF\\s*=\\s*'${RETIRED_REF}'`));
    assert.match(src, new RegExp(`FORBIDDEN_REF\\s*=\\s*'${FORBIDDEN_REF}'`));
  });

  test(`diagnostic ${file}: confirmation is a bare boolean flag, checked before any side effect`, () => {
    const src = readSrc(file);
    assert.match(src, new RegExp(`CONFIRM_FLAG\\s*=\\s*'${DIAGNOSTIC_FLAG}'`));
    // Exact argv membership — not a prefix, not a `=value` form, not env.
    assert.match(src, /process\.argv\.slice\(2\)\.includes\(CONFIRM_FLAG\)/);
    assert.doesNotMatch(src, /process\.env\.[A-Z_]*CONFIRM[A-Z_]*/);

    const gateIdx = src.indexOf('assertProductionReadonlyDiagnostic();');
    assert.ok(gateIdx > 0, 'the confirmation gate must be called');
    for (const effect of ['readFileSync(CONFIG', 'await fetch(', 'new Client(']) {
      const effectIdx = src.indexOf(effect);
      if (effectIdx === -1) continue;
      assert.ok(gateIdx < effectIdx,
        `${effect} appears before the confirmation gate in ${file}`);
    }
  });

  test(`diagnostic ${file}: retired and forbidden targets always fail`, () => {
    const src = readSrc(file);
    assert.match(src, /function assertProductionTarget/);
    assert.match(src, /value\.includes\(RETIRED_REF\)/);
    assert.match(src, /value\.includes\(FORBIDDEN_REF\)/);
    assert.match(src, /!value\.includes\(PRODUCTION_REF\)/);
    assert.match(src, /assertProductionTarget\('URL do Supabase', url\)/);
    if (/new Client\(/.test(src)) {
      assert.match(src, /assertProductionTarget\('DB_URL', dbUrl\)/,
        'a direct PG connection must validate the target too');
    }
  });

  test(`diagnostic ${file}: uses read operations only`, () => {
    const src = readSrc(file);
    assert.doesNotMatch(src, /method:\s*'(PATCH|PUT|DELETE)'/i);
    assert.doesNotMatch(src, /method:\s*"(PATCH|PUT|DELETE)"/i);
    assert.doesNotMatch(src, /Prefer:\s*['"]return=/i, 'no write-returning PostgREST call');
    // The only POST endpoints allowed are the Auth token exchange and a
    // read-only `consultar_*` RPC.
    const posts = src.match(/method:\s*'POST'/gi) || [];
    const authPosts = src.match(/\/auth\/v1\/token\?grant_type=password/g) || [];
    const rpcPosts = src.match(/'\/rest\/v1\/rpc\/'/g) || [];
    assert.equal(posts.length, authPosts.length + rpcPosts.length,
      'every POST must be the Auth token exchange or a read-only RPC');
    for (const name of src.match(/rpcRead\('([a-z_]+)'/g) || []) {
      assert.match(name, /rpcRead\('consultar_/, 'only consultar_* RPCs are read-only');
    }
    // No destructive SQL in the direct-PG paths (statement-shaped, over
    // comment-stripped source).
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const re of [
      /\bdrop\s+(table|schema|database|index|view|function|sequence|role)\b/i,
      /\btruncate\s+(table|only)\b/i,
      /\bdelete\s+from\b/i,
      /\binsert\s+into\b/i,
      /\bupdate\s+[a-z_."]+\s+set\b/i,
      /\balter\s+table\b/i,
    ]) {
      assert.equal(re.test(noComments), false, `${file} contains destructive SQL matching ${re}`);
    }
  });

  test(`diagnostic ${file}: without the flag it refuses before any network access`, () => {
    const res = runNode(file, []);
    assert.equal(res.error, undefined);
    assert.notEqual(res.status, 0, 'must not proceed without confirmation');
    assert.match(res.stderr, new RegExp(DIAGNOSTIC_FLAG));
    assert.match(res.stderr, new RegExp(PRODUCTION_REF));
  });

  test(`diagnostic ${file}: a =value form or a generic --confirm does not substitute`, () => {
    for (const args of [[`${DIAGNOSTIC_FLAG}=true`], ['--confirm'], ['--confirm-production-readonly-diagnostics']]) {
      const res = runNode(file, args);
      assert.notEqual(res.status, 0, `"${args.join(' ')}" must not confirm`);
      assert.match(res.stderr, new RegExp(DIAGNOSTIC_FLAG));
    }
  });
}

// ---------------------------------------------------------------------
// D. Backup: identity before any credential, spawn, directory or upload
// ---------------------------------------------------------------------

test('backup: constants are the current identities and STAGING_REF is gone', () => {
  const core = fs.readFileSync(BACKUP_CORE, 'utf8');
  const cli = fs.readFileSync(BACKUP_CLI, 'utf8');
  assert.match(core, new RegExp(`PRODUCTION_REF\\s*=\\s*'${PRODUCTION_REF}'`));
  assert.match(core, new RegExp(`RETIRED_REF\\s*=\\s*'${RETIRED_REF}'`));
  assert.match(core, new RegExp(`FORBIDDEN_REF\\s*=\\s*'${FORBIDDEN_REF}'`));
  for (const [name, src] of [['export-core.mjs', core], ['export-db.mjs', cli]]) {
    assert.doesNotMatch(src, /STAGING_REF/, `${name} still declares STAGING_REF`);
    assert.doesNotMatch(src, /BACKUP_ALLOW_PRODUCTION/, `${name} still references the removed override`);
  }
});

test('backup: the target gate precedes credentials, process spawn, directory creation and upload', () => {
  const cli = fs.readFileSync(BACKUP_CLI, 'utf8');
  const gateIdx = cli.indexOf('assertBackupTarget(pgHost, supabaseUrl, opts);');
  assert.ok(gateIdx > 0, 'the target gate must be called on the real-run path');
  // Call sites, not definitions.
  for (const later of ["password: envTrim('PGPASSWORD')", 'const drive = loadDriveConfig();', 'await runExport(config, io)']) {
    const idx = cli.indexOf(later);
    assert.ok(idx > gateIdx, `${later} must come after the environment-identity gate`);
  }
  // The gate itself checks retired/forbidden before the confirmation.
  const gateBody = cli.slice(cli.indexOf('function assertBackupTarget'), cli.indexOf('function loadDriveConfig'));
  const retiredIdx = gateBody.indexOf('RETIRED_REF');
  const forbiddenIdx = gateBody.indexOf('FORBIDDEN_REF');
  const confirmIdx = gateBody.indexOf('confirmProductionReadonlyBackup');
  assert.ok(retiredIdx > 0 && forbiddenIdx > 0 && confirmIdx > 0);
  assert.ok(retiredIdx < confirmIdx, 'the retired project must fail before confirmation is considered');
  assert.ok(forbiddenIdx < confirmIdx, 'the forbidden project must fail before confirmation is considered');
});

test('backup: the production-read-only flag is a bare boolean with no env substitute', () => {
  const cli = fs.readFileSync(BACKUP_CLI, 'utf8');
  assert.match(cli, new RegExp(`PRODUCTION_READONLY_BACKUP_FLAG\\s*=\\s*'${BACKUP_FLAG}'`));
  assert.match(cli, /a === PRODUCTION_READONLY_BACKUP_FLAG\) opts\.confirmProductionReadonlyBackup = true/);
  assert.doesNotMatch(cli, /process\.env\.[A-Z_]*(ALLOW|CONFIRM)[A-Z_]*PRODUCTION/);
});
