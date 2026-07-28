// Smoke test — active operational consumer environment identity after
// INTTRACKER-PRODUCTION-CUTOVER-R1.
//
// Owned contract (INTTRACKER-POST-CUTOVER-ACTIVE-CONSUMER-SAFETY-R1):
//
//   - ucrjtfswnfdlxwtmxnoo is the DEFINITIVE production project and the only
//     sanctioned writer target.
//   - gqmpsxkxynrjvidfmojk is RETIRED from every active runtime role: it is not
//     production, not staging, not development and not a fallback.
//   - bhgifjrfagkzubpyqpew is PROHIBITED.
//
// Covered owners:
//   1. services/documents-ingestor/ops/watcher/Start-DocumentScanWatcher.ps1
//   2. services/documents-ingestor/docs/SUPABASE_WRITER_RUNBOOK.md
//   3. scripts/reset/clean-slate-transactional-export.mjs
//   4. scripts/reset/clean-slate-transactional-verify.mjs
//
// The watcher is inspected STATICALLY: this test parses the launcher source and
// re-applies its own extracted guard (the `.env` line regex, the expected ref
// literal and the case-sensitive comparison operator) to candidate `.env`
// bodies. No process is started, no Supabase project is contacted, no Gmail
// access occurs.
//
// The clean-slate tooling is exercised through its own exported target contract
// with a fully stubbed transport: no database connection, no capture file, no
// archive of real data. Archive-integrity coverage stays owned by
// tests/clean-slate-transactional-reset.smoke.mjs; this file owns only the
// environment-identity contract shared by all four owners.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const WATCHER = path.join(ROOT, 'services/documents-ingestor/ops/watcher/Start-DocumentScanWatcher.ps1');
const RUNBOOK = path.join(ROOT, 'services/documents-ingestor/docs/SUPABASE_WRITER_RUNBOOK.md');
const EXPORT_TOOL = path.join(ROOT, 'scripts/reset/clean-slate-transactional-export.mjs');
const VERIFY_TOOL = path.join(ROOT, 'scripts/reset/clean-slate-transactional-verify.mjs');

const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';

const watcherSrc = fs.readFileSync(WATCHER, 'utf8');
const runbookSrc = fs.readFileSync(RUNBOOK, 'utf8');
const exportSrc = fs.readFileSync(EXPORT_TOOL, 'utf8');
const verifySrc = fs.readFileSync(VERIFY_TOOL, 'utf8');

const loadExportTool = () => import('../scripts/reset/clean-slate-transactional-export.mjs');
const loadVerifyTool = () => import('../scripts/reset/clean-slate-transactional-verify.mjs');

// PowerShell code lines only (whole-line `#` comments removed). Prohibited refs
// may be NAMED in a comment as prohibited; they may never appear in code.
const watcherCode = watcherSrc
  .split(/\r?\n/)
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

// -----------------------------------------------------------------------------
// Guard extraction — the simulation below is derived from the script source,
// never from a hardcoded copy of its logic.
// -----------------------------------------------------------------------------

function extractExpectedRef(src) {
  const m = src.match(/\$ExpectedProjectRef\s*=\s*'([^']+)'/);
  assert.ok(m, 'watcher must assign $ExpectedProjectRef to a single-quoted literal');
  return m[1];
}

function extractEnvLineRegex(src) {
  const m = src.match(/Where-Object\s*\{\s*\$_\s*-match\s*'([^']+)'\s*\}/);
  assert.ok(m, 'watcher must select the SUPABASE_PROJECT_REF line with a -match regex');
  return new RegExp(m[1]);
}

// Re-applies the watcher's own guard to a candidate .env body.
// Returns { started: boolean, reason }.
function simulateWatcherGuard(envBody) {
  const expected = extractExpectedRef(watcherCode);
  const lineRe = extractEnvLineRegex(watcherCode);

  // The launcher requires exactly one declaration (no first-wins ambiguity).
  assert.match(watcherCode, /\$ProjectRefLines\.Count\s*-ne\s*1/, 'watcher must require exactly one declaration');
  // The comparison must be case-sensitive (-cne), so no cased alias is accepted.
  assert.match(
    watcherCode,
    /\$ProjectRef\s*-cne\s*\$ExpectedProjectRef/,
    'watcher must compare the parsed ref case-sensitively against $ExpectedProjectRef',
  );

  const lines = envBody.split(/\r?\n/).filter((l) => lineRe.test(l));
  if (lines.length !== 1) return { started: false, reason: 'declaration-count' };
  const value = lines[0].split(/=(.*)/s)[1].trim();
  if (value !== expected) return { started: false, reason: 'ref-mismatch' };
  return { started: true, reason: 'authorized' };
}

const envWith = (ref) => `SUPABASE_WRITER_ENABLED=true\nSUPABASE_PROJECT_REF=${ref}\n`;

// -----------------------------------------------------------------------------
// Watcher launcher
// -----------------------------------------------------------------------------

test('watcher: expected project ref is the definitive production project', () => {
  assert.equal(extractExpectedRef(watcherCode), PRODUCTION_REF);
});

test('watcher: accepts only ucrjtfswnfdlxwtmxnoo', () => {
  assert.equal(simulateWatcherGuard(envWith(PRODUCTION_REF)).started, true);
});

test('watcher: rejects the retired project gqmpsxkxynrjvidfmojk', () => {
  const r = simulateWatcherGuard(envWith(RETIRED_REF));
  assert.equal(r.started, false);
  assert.equal(r.reason, 'ref-mismatch');
});

test('watcher: rejects the forbidden project bhgifjrfagkzubpyqpew', () => {
  const r = simulateWatcherGuard(envWith(FORBIDDEN_REF));
  assert.equal(r.started, false);
  assert.equal(r.reason, 'ref-mismatch');
});

test('watcher: rejects a missing, empty or differently-cased project ref', () => {
  assert.equal(simulateWatcherGuard('SUPABASE_WRITER_ENABLED=true\n').started, false);
  assert.equal(simulateWatcherGuard(envWith('')).started, false);
  assert.equal(simulateWatcherGuard(envWith('some-other-project')).started, false);
  assert.equal(simulateWatcherGuard(envWith(PRODUCTION_REF.toUpperCase())).started, false);
});

test('watcher: rejects an ambiguous .env declaring the retired ref as a second value', () => {
  const body = `SUPABASE_PROJECT_REF=${PRODUCTION_REF}\nSUPABASE_PROJECT_REF=${RETIRED_REF}\n`;
  const r = simulateWatcherGuard(body);
  assert.equal(r.started, false);
  assert.equal(r.reason, 'declaration-count');
});

test('watcher: no prohibited project ref survives in executable code', () => {
  assert.equal(watcherCode.includes(RETIRED_REF), false, 'retired ref must not appear in watcher code');
  assert.equal(watcherCode.includes(FORBIDDEN_REF), false, 'forbidden ref must not appear in watcher code');
});

test('watcher: has no fallback target — production is the only project ref in code', () => {
  const refs = watcherCode.match(/[a-z]{20}/g) || [];
  const projectRefs = refs.filter((r) => r === PRODUCTION_REF || r === RETIRED_REF || r === FORBIDDEN_REF);
  assert.ok(projectRefs.length > 0, 'the production ref must appear in watcher code');
  assert.deepEqual([...new Set(projectRefs)], [PRODUCTION_REF]);
  assert.doesNotMatch(watcherCode, /\belse\b/, 'watcher must not branch to an alternative target');
});

test('watcher: refuses to start when .env is absent or the ref is wrong', () => {
  assert.match(watcherCode, /if \(-not \(Test-Path -LiteralPath \$EnvPath\)\) \{\s*\r?\n\s*throw/);
  assert.match(watcherCode, /-cne \$ExpectedProjectRef\) \{\s*\r?\n\s*throw/);
});

test('watcher: real-write confirmations remain present', () => {
  assert.match(watcherCode, /'--confirm-real-google'/);
  assert.match(watcherCode, /'--confirm-supabase-write'/);
});

test('watcher: duplicate-process prevention remains present', () => {
  assert.match(watcherCode, /Get-CimInstance Win32_Process/);
  assert.match(watcherCode, /watch:scan-requests/);
  assert.match(watcherCode, /already running; no second process was started/);
});

// -----------------------------------------------------------------------------
// Writer runbook
// -----------------------------------------------------------------------------

test('runbook: names ucrjtfswnfdlxwtmxnoo as the sanctioned writer target', () => {
  assert.match(
    runbookSrc,
    /sanctioned writer target is the definitive production project `ucrjtfswnfdlxwtmxnoo`/,
  );
});

test('runbook: identifies gqmpsxkxynrjvidfmojk as prohibited for active use', () => {
  assert.match(runbookSrc, /`gqmpsxkxynrjvidfmojk` is retired and must never be used/);
  assert.match(runbookSrc, /not production, not staging, not development and not a fallback/);
});

test('runbook: never describes the retired project as an active environment', () => {
  const lines = runbookSrc.split(/\r?\n/).filter((l) => l.includes(RETIRED_REF));
  assert.ok(lines.length > 0, 'the retired project must be named so it can be prohibited');
  for (const line of lines) {
    assert.match(line, /retired/i, `retired ref described without the word "retired": ${line}`);
    assert.doesNotMatch(
      line,
      /sanctioned target project `gqmpsxkxynrjvidfmojk`|`gqmpsxkxynrjvidfmojk`[^.]*\bis (?:the )?(?:production|staging|development|fallback)\b/i,
      `retired ref described as an active environment: ${line}`,
    );
  }
});

test('runbook: states that starting the watcher is a production write', () => {
  assert.match(runbookSrc, /Starting the watcher is a production write operation/);
  assert.match(runbookSrc, /operator must verify that `\.env` declares exactly that project ref/);
  assert.match(
    runbookSrc,
    /Both `--confirm-real-google` and `--confirm-supabase-write` remain mandatory/,
  );
});

test('runbook: states there is no valid separate development or staging database', () => {
  assert.match(runbookSrc, /no valid separate development or staging database/);
});

test('runbook: keeps the forbidden project prohibited', () => {
  assert.match(runbookSrc, /Never use the retired project `gqmpsxkxynrjvidfmojk`, the protected reference `bhgifjrfagkzubpyqpew`/);
});

// -----------------------------------------------------------------------------
// Clean-slate export tool — target contract
// -----------------------------------------------------------------------------

test('export: constants classify the three projects correctly', async () => {
  const m = await loadExportTool();
  assert.equal(m.PRODUCTION_REF, PRODUCTION_REF);
  assert.equal(m.RETIRED_REF, RETIRED_REF);
  assert.equal(m.FORBIDDEN_REF, FORBIDDEN_REF);
  assert.equal(m.PRODUCTION_CONFIRMATION_FLAG, 'confirm-production-readonly-export');
});

test('export: AUTHORIZED_DEV_REF no longer exists in any form', async () => {
  const m = await loadExportTool();
  assert.equal('AUTHORIZED_DEV_REF' in m, false, 'no exported symbol may remain');
  assert.equal(Object.keys(m).includes('AUTHORIZED_DEV_REF'), false);
  assert.equal(exportSrc.includes('AUTHORIZED_DEV_REF'), false, 'no alias or comment may keep the name alive');
  assert.equal(verifySrc.includes('AUTHORIZED_DEV_REF'), false);
});

test('export: retired and forbidden targets always fail, confirmation notwithstanding', async () => {
  const { assertTargetIdentity } = await loadExportTool();
  const confirmed = { confirmProductionReadonlyExport: true };
  for (const ref of [RETIRED_REF, FORBIDDEN_REF]) {
    assert.throws(() => assertTargetIdentity(ref), /CLEAN_SLATE_TARGET_(RETIRED_PROJECT|FORBIDDEN_PROJECT)/);
    assert.throws(() => assertTargetIdentity(ref, confirmed), /CLEAN_SLATE_TARGET_(RETIRED_PROJECT|FORBIDDEN_PROJECT)/);
  }
});

test('export: missing, ambiguous and unknown targets fail closed', async () => {
  const { assertTargetIdentity } = await loadExportTool();
  const confirmed = { confirmProductionReadonlyExport: true };
  assert.throws(() => assertTargetIdentity(undefined), /CLEAN_SLATE_TARGET_MISSING/);
  assert.throws(() => assertTargetIdentity('', confirmed), /CLEAN_SLATE_TARGET_MISSING/);
  assert.throws(() => assertTargetIdentity(`${PRODUCTION_REF} ${RETIRED_REF}`, confirmed), /CLEAN_SLATE_TARGET_AMBIGUOUS/);
  assert.throws(() => assertTargetIdentity('unknown-project-ref', confirmed), /CLEAN_SLATE_TARGET_NOT_AUTHORIZED/);
});

test('export: production requires the exact read-only confirmation flag', async () => {
  const { assertTargetIdentity } = await loadExportTool();
  assert.throws(() => assertTargetIdentity(PRODUCTION_REF), /CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED/);
  assert.throws(() => assertTargetIdentity(PRODUCTION_REF, {}), /CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED/);
  assert.throws(
    () => assertTargetIdentity(PRODUCTION_REF, { confirmProductionReadonlyExport: 'true' }),
    /CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED/,
    'a truthy non-boolean must not satisfy the confirmation',
  );
  assert.equal(
    assertTargetIdentity(PRODUCTION_REF, { confirmProductionReadonlyExport: true }),
    PRODUCTION_REF,
  );
});

test('export: a confirmed production target reaches only the pre-existing read-only path', async () => {
  const { buildArchive } = await loadExportTool();
  const neverCreated = path.join(os.tmpdir(), 'clean-slate-identity-never-created');
  fs.rmSync(neverCreated, { recursive: true, force: true });

  // Unconfirmed: refused by the target gate itself.
  assert.throws(
    () => buildArchive({}, neverCreated, { target: PRODUCTION_REF }),
    /CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED/,
  );
  // Confirmed: the target gate passes and control reaches the pre-existing
  // read-only capture-validation pipeline, which rejects the stub capture. The
  // flag moved the failure onward; it did not create any new capability.
  assert.throws(
    () => buildArchive({}, neverCreated, { target: PRODUCTION_REF, confirmProductionReadonlyExport: true }),
    /CLEAN_SLATE_IDENTITY_FAILED/,
  );
  assert.equal(fs.existsSync(neverCreated), false, 'neither path may create an archive directory');
});

test('export CLI: unconfirmed production fails before connection, capture read or output', () => {
  const outRoot = path.join(os.tmpdir(), 'clean-slate-identity-cli-out');
  const missingCapture = path.join(os.tmpdir(), 'clean-slate-identity-absent-capture.json');
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.rmSync(missingCapture, { force: true });

  const runs = [
    ['--from-capture', missingCapture],
    ['--database-url', 'postgresql://user:pw@db.example.invalid:5432/postgres'],
  ];
  for (const source of runs) {
    const r = spawnSync(process.execPath, [
      EXPORT_TOOL, 'export', '--target', PRODUCTION_REF, ...source, '--out-root', outRoot,
    ], { encoding: 'utf8', timeout: 30000 });
    assert.notEqual(r.status, 0, 'unconfirmed production export must exit non-zero');
    assert.match(r.stderr, /CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED/);
    // The failure is the target gate, NOT a missing capture file and NOT a psql
    // failure — proof that neither was reached.
    assert.doesNotMatch(r.stderr, /ENOENT|CLEAN_SLATE_CAPTURE_PSQL_FAILED|CLEAN_SLATE_CAPTURE_EMPTY/);
    assert.equal(fs.existsSync(outRoot), false, 'no output directory may be created');
  }
});

test('export CLI: retired and forbidden targets fail even with the confirmation flag', () => {
  const outRoot = path.join(os.tmpdir(), 'clean-slate-identity-cli-out-2');
  fs.rmSync(outRoot, { recursive: true, force: true });
  for (const ref of [RETIRED_REF, FORBIDDEN_REF]) {
    const r = spawnSync(process.execPath, [
      EXPORT_TOOL, 'export', '--target', ref, '--confirm-production-readonly-export',
      '--from-capture', path.join(os.tmpdir(), 'absent.json'), '--out-root', outRoot,
    ], { encoding: 'utf8', timeout: 30000 });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /CLEAN_SLATE_TARGET_(RETIRED_PROJECT|FORBIDDEN_PROJECT)/);
    assert.equal(fs.existsSync(outRoot), false);
  }
});

test('export: no mutation or destructive capability exists', () => {
  const sqlish = exportSrc.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(sqlish, /\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b/i);
  assert.match(exportSrc, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(exportSrc, /ROLLBACK;/);
});

// -----------------------------------------------------------------------------
// Clean-slate verifier — reconciled target contract
// -----------------------------------------------------------------------------

test('verifier: links against the new target contract only', async () => {
  const m = await loadVerifyTool();
  assert.equal(typeof m.verifyArchive, 'function', 'the verifier must still link and export verifyArchive');
  assert.match(verifySrc, /PRODUCTION_REF,\s*RETIRED_REF,\s*FORBIDDEN_REF,/);
});

test('verifier: keeps its target-classification assertions', () => {
  assert.match(verifySrc, /manifest\.database\?\.project_ref === PRODUCTION_REF/);
  assert.match(verifySrc, /identityEvidence\?\.project_ref === PRODUCTION_REF/);
  assert.match(verifySrc, /!claimedRefs\.includes\(RETIRED_REF\)/);
  assert.match(verifySrc, /!claimedRefs\.includes\(FORBIDDEN_REF\)/);
  assert.match(verifySrc, /manifest\.database\?\.project_ref === identityEvidence\?\.project_ref/);
});

test('verifier: archive-integrity assertions remain active', () => {
  for (const needle of ['verifyIdentity', 'verifyCutover', 'verifyCorpusIdentities', 'verifyPreservedBaseline']) {
    assert.ok(verifySrc.includes(needle), `${needle} must still be exercised by the verifier`);
  }
  assert.match(verifySrc, /aggregate/i);
  assert.match(verifySrc, /checksums\.sha256/);
});
