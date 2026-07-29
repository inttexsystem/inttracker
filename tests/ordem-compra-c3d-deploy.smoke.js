// tests/ordem-compra-c3d-deploy.smoke.js
//
// PHASE-C3D-A smoke test.
//
// Proves, without applying any migration and without touching any shared or
// remote database:
//   - the ordered deployment manifest resolves exactly db/01..db/82, with
//     db/81 and db/82 as the terminal two, fixed migration numbers unique
//     and contiguous, and the manifest fails closed on the malformed
//     synthetic fixtures the real repository must never actually contain
//     (duplicate number, gap, missing start, unexpected trailing migration,
//     a hash diverging from the repository checkpoint, an application
//     artifact outside branch ancestry, a repository identity mismatch);
//   - db/75, db/76 and db/77 are read-only inputs: their content matches the
//     committed HEAD checkpoint exactly and stays byte-stable for the whole
//     test run;
//
// C5A note (C5A-DB-EMISSION-READINESS-IMPLEMENTATION-R1): the authorized new
// migration db/77_ordem_compra_c5a_emission_readiness.sql extends this manifest
// by one entry, so the expected terminal advances 76 -> 77 and the terminal two
// become db/76/db/77. The fail-closed mechanism (duplicate/gap/missing-start/
// unexpected-trailing via synthetic fixtures) is unchanged.
//
// PHASE-MANTA-A note (PHASE-MANTA-A-PRODUCT-IDENTITY-AND-ROUTE-FOUNDATION-R1):
// the authorized new migration db/78_manta_product_identity_and_route_foundation.sql
// extends this manifest by one further entry, so the expected terminal advances
// 77 -> 78 and the terminal two become db/77/db/78. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-A correction note (PHASE-MANTA-A-DB-VALIDATION-AND-INVARIANT-
// CORRECTION-R1): the authorized forward-correction migration
// db/79_manta_product_identity_invariant_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 78 -> 79 and the terminal
// two become db/78/db/79. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-A correction note (PHASE-MANTA-A-MODEL-REFERENCE-CONCURRENCY-
// CORRECTION-R1): the authorized forward-correction migration
// db/80_manta_model_reference_concurrency_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 79 -> 80 and the terminal
// two become db/79/db/80. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 note (PHASE-MANTA-B1-EXPEDITION-SOURCE-FOUNDATION-R1): the
// authorized new migration db/81_manta_expedition_source_foundation.sql extends
// this manifest by one further entry, so the expected terminal advances 80 -> 81
// and the terminal two become db/80/db/81. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-MEMBERSHIP-AND-LOCK-ORDER-
// CORRECTION-R1): the authorized forward-correction migration
// db/82_manta_expedition_source_invariant_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 81 -> 82 and the terminal
// two become db/81/db/82. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-ROUTE-AND-ITEM-IDENTITY-
// CORRECTION-R1): the authorized forward-correction migration
// db/83_manta_expedition_source_identity_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 82 -> 83 and the terminal
// two become db/82/db/83. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-LINEAGE-AND-LATEX-ROUTE-
// CORRECTION-R1): the authorized forward-correction migration
// db/84_manta_expedition_source_lineage_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 83 -> 84 and the terminal
// two become db/83/db/84. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1): the authorized
// activation migration db/85_manta_cima_route_conditional_delivery.sql extends
// this manifest by one further entry, so the expected terminal advances
// 84 -> 85 and the terminal two become db/84/db/85. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (same order, second migration):
// db/86_manta_expedition_release_writer.sql extends this manifest by one further
// entry, so the expected terminal advances 85 -> 86 and the terminal two become
// db/85/db/86. The fail-closed mechanism is unchanged (mechanism preserved, only
// the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (same order, third migration):
// db/87_manta_expedition_reversal_and_route_completion.sql extends this manifest
// by one further entry, so the expected terminal advances 86 -> 87 and the
// terminal two become db/86/db/87. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A correction note (PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-
// FK-LOCK-CORRECTION-R1): the authorized forward-correction migration
// db/88_manta_measured_output_identity_and_fk_lock_correction.sql extends this
// manifest by one further entry, so the expected terminal advances 87 -> 88 and
// the terminal two become db/87/db/88. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// KLEBER-APP-OPERATIONAL-STABILIZATION note: db/89_pedido_commercial_date_and_
// number_control.sql and then db/90_pedido_proximo_numero_suggestion_rpc.sql
// each extend this manifest by one further entry, so the expected terminal
// advances 88 -> 89 -> 90 and the terminal two become db/89/db/90. The
// fail-closed mechanism is unchanged (mechanism preserved, only the terminal
// expectation advanced).
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1 note:
// db/92_pedido_unified_edit_change_approval_foundation.sql extends this
// manifest by one further entry, so the expected terminal advances 91 -> 92
// and the terminal two become db/91/db/92. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 note:
// db/91_pedido_item_production_priority.sql extends this manifest by one
// further entry, so the expected terminal advances 90 -> 91 and the terminal
// two become db/90/db/91. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//   - the accepted application artifact is an ancestor of the current
//     branch;
//   - scripts/c3d/bootstrap-disposable-cluster.mjs creates a fresh disposable
//     cluster outside the repository, on a distinct non-default port, proves
//     readiness and a real connection, shuts down cleanly, leaves neither a
//     process nor a data directory behind, never reuses a data directory
//     across runs, and still cleans up fully when readiness is forced to
//     fail; and that no code path here ever references a shared or remote
//     database host.

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(REPO_ROOT, 'db');
const BOOTSTRAP_MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'c3d', 'bootstrap-disposable-cluster.mjs');
const BOOTSTRAP_MODULE_URL = pathToFileURL(BOOTSTRAP_MODULE_PATH).href;
const BOOTSTRAP_SOURCE = fs.readFileSync(BOOTSTRAP_MODULE_PATH, 'utf8');

const APPLICATION_ARTIFACT = '22bfb192c6c2ad10ccd2b2883d54c3a17e40cc9f';
const EXPECTED_BRANCH = 'dev';
const EXPECTED_TERMINAL = 92;
const DB75_FILENAME = '75_ordem_compra_c3c_inactive_cutover.sql';
const DB76_FILENAME = '76_ordem_compra_c3c_b_db_prerequisites.sql';
const DB77_FILENAME = '77_ordem_compra_c5a_emission_readiness.sql';
const DB78_FILENAME = '78_manta_product_identity_and_route_foundation.sql';
const DB79_FILENAME = '79_manta_product_identity_invariant_correction.sql';
const DB80_FILENAME = '80_manta_model_reference_concurrency_correction.sql';
const DB81_FILENAME = '81_manta_expedition_source_foundation.sql';
const DB82_FILENAME = '82_manta_expedition_source_invariant_correction.sql';
const DB83_FILENAME = '83_manta_expedition_source_identity_correction.sql';
const DB84_FILENAME = '84_manta_expedition_source_lineage_correction.sql';
const DB85_FILENAME = '85_manta_cima_route_conditional_delivery.sql';
const DB86_FILENAME = '86_manta_expedition_release_writer.sql';
const DB87_FILENAME = '87_manta_expedition_reversal_and_route_completion.sql';
const DB88_FILENAME = '88_manta_measured_output_identity_and_fk_lock_correction.sql';
const DB89_FILENAME = '89_pedido_commercial_date_and_number_control.sql';
const DB90_FILENAME = '90_pedido_proximo_numero_suggestion_rpc.sql';
const DB91_FILENAME = '91_pedido_item_production_priority.sql';
const DB92_FILENAME = '92_pedido_unified_edit_change_approval_foundation.sql';
const DB75_PATH = path.join(DB_DIR, DB75_FILENAME);
const DB76_PATH = path.join(DB_DIR, DB76_FILENAME);
const DB77_PATH = path.join(DB_DIR, DB77_FILENAME);
const DB78_PATH = path.join(DB_DIR, DB78_FILENAME);
const DB79_PATH = path.join(DB_DIR, DB79_FILENAME);
const DB80_PATH = path.join(DB_DIR, DB80_FILENAME);
const DB81_PATH = path.join(DB_DIR, DB81_FILENAME);
const DB82_PATH = path.join(DB_DIR, DB82_FILENAME);
const DB83_PATH = path.join(DB_DIR, DB83_FILENAME);
const DB84_PATH = path.join(DB_DIR, DB84_FILENAME);
const DB85_PATH = path.join(DB_DIR, DB85_FILENAME);
const DB86_PATH = path.join(DB_DIR, DB86_FILENAME);
const DB87_PATH = path.join(DB_DIR, DB87_FILENAME);
const DB88_PATH = path.join(DB_DIR, DB88_FILENAME);
const DB89_PATH = path.join(DB_DIR, DB89_FILENAME);
const DB90_PATH = path.join(DB_DIR, DB90_FILENAME);

const FORBIDDEN_HOST_PATTERNS = [
  /ucrjtfswnfdlxwtmxnoo/i,
  /gqmpsxkxynrjvidfmojk/i,
  /bhgifjrfagkzubpyqpew/i,
  /supabase/i,
];

let bootstrapModulePromise;
function loadBootstrapModule() {
  if (!bootstrapModulePromise) bootstrapModulePromise = import(BOOTSTRAP_MODULE_URL);
  return bootstrapModulePromise;
}

// ---------------------------------------------------------------------------
// Pure, fail-closed deployment-manifest resolution (no filesystem access of
// its own beyond the filename list it is given -- so its failure paths can
// be proven against synthetic fixtures without ever touching db/*.sql).
// ---------------------------------------------------------------------------

class ManifestError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'ManifestError';
    this.reason = reason;
  }
}

const MIGRATION_FILENAME_RE = /^(\d+)_[A-Za-z0-9_]+\.sql$/;

// Matches primary numbered migrations only -- excludes `.verify.sql`
// siblings (an extra literal dot never matches `[A-Za-z0-9_]+`) and any
// non-numbered file such as `setup_completo.sql`.
function filterMigrationFilenames(filenames) {
  const entries = [];
  for (const filename of filenames) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (match) entries.push({ number: Number(match[1]), filename });
  }
  return entries;
}

function resolveMigrationManifest(filenames, { expectedTerminal } = {}) {
  const entries = filterMigrationFilenames(filenames);
  if (entries.length === 0) {
    throw new ManifestError('EMPTY', 'no numbered migration files found');
  }
  entries.sort((a, b) => a.number - b.number);

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.number)) {
      throw new ManifestError('DUPLICATE_NUMBER', `duplicate migration number ${entry.number} (${entry.filename})`);
    }
    seen.add(entry.number);
  }

  if (entries[0].number !== 1) {
    throw new ManifestError('MISSING_START', `migration sequence does not start at 1 (starts at ${entries[0].number})`);
  }
  for (let i = 1; i < entries.length; i += 1) {
    const expectedNext = entries[i - 1].number + 1;
    if (entries[i].number !== expectedNext) {
      throw new ManifestError(
        'GAP',
        `non-contiguous migration sequence: expected ${expectedNext} after ${entries[i - 1].number}, found ${entries[i].number}`
      );
    }
  }

  if (expectedTerminal !== undefined) {
    const last = entries[entries.length - 1].number;
    if (last !== expectedTerminal) {
      throw new ManifestError(
        'UNEXPECTED_TRAILING',
        `migration sequence extends beyond the expected terminal ${expectedTerminal} (found ${last})`
      );
    }
  }

  return entries;
}

function sha256OfBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256OfFile(filePath) {
  return sha256OfBuffer(fs.readFileSync(filePath));
}

function runGit(args, { cwd = REPO_ROOT, encoding = 'utf8' } = {}) {
  return spawnSync('git', args, { cwd, encoding, timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
}

function gitCheckpointHash(relPathPosix, ref = 'HEAD') {
  const result = runGit(['show', `${ref}:${relPathPosix}`], { encoding: 'buffer' });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : '';
    throw new ManifestError('GIT_CHECKPOINT_UNAVAILABLE', `git show ${ref}:${relPathPosix} failed: ${stderr || result.status}`);
  }
  return sha256OfBuffer(result.stdout);
}

function assertHashMatchesCheckpoint(actualHash, expectedHash, label) {
  if (actualHash !== expectedHash) {
    throw new ManifestError('HASH_CHANGED', `${label} hash ${actualHash} does not match the repository checkpoint hash ${expectedHash}`);
  }
}

function assertIsAncestor(sha, ref) {
  const result = runGit(['merge-base', '--is-ancestor', sha, ref]);
  if (result.status !== 0) {
    throw new ManifestError('ARTIFACT_NOT_ANCESTOR', `${sha} is not an ancestor of ${ref} (git exit ${result.status})`);
  }
}

function getGitState() {
  const run = (args) => {
    const result = runGit(args);
    if (result.status !== 0) {
      throw new ManifestError('GIT_STATE_UNAVAILABLE', `git ${args.join(' ')} failed: ${result.stderr || result.status}`);
    }
    return result.stdout.trim();
  };
  return {
    toplevel: run(['rev-parse', '--show-toplevel']),
    branch: run(['branch', '--show-current']),
    head: run(['rev-parse', 'HEAD']),
  };
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').toLowerCase();
}

function assertEnvironmentIdentity(actual, expected) {
  if (actual.branch !== expected.branch) {
    throw new ManifestError('ENVIRONMENT_MISMATCH', `branch ${actual.branch} !== expected ${expected.branch}`);
  }
  if (normalizePath(actual.toplevel) !== normalizePath(expected.toplevel)) {
    throw new ManifestError('ENVIRONMENT_MISMATCH', `repository root ${actual.toplevel} !== expected ${expected.toplevel}`);
  }
}

// Assembles the deterministic C3D-A deployment manifest: application
// artifact, ordered db/01..db/88 sequence, terminal two migrations with
// stable path/byte-size/hash evidence, and the ancestry/identity proofs.
// Fails closed on every condition listed in the C3D-A order (missing
// migration, duplicate number, gap, unexpected trailing migration, changed
// terminal-migration hash, non-ancestor artifact, environment mismatch).
function buildDeploymentManifest({ dbDir = DB_DIR, applicationArtifact = APPLICATION_ARTIFACT, expectedBranch = EXPECTED_BRANCH } = {}) {
  const filenames = fs.readdirSync(dbDir);
  const migrations = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL }).map((entry) => {
    const filePath = path.join(dbDir, entry.filename);
    const stat = fs.statSync(filePath);
    return { ...entry, path: filePath, byteSize: stat.size, sha256: sha256OfFile(filePath) };
  });

  const terminalTwo = migrations.slice(-2);
  assert.equal(terminalTwo[0].filename, DB91_FILENAME);
  assert.equal(terminalTwo[1].filename, DB92_FILENAME);

  for (const migration of terminalTwo) {
    const relPathPosix = `db/${migration.filename}`;
    const checkpointHash = gitCheckpointHash(relPathPosix);
    assertHashMatchesCheckpoint(migration.sha256, checkpointHash, relPathPosix);
  }

  const gitState = getGitState();
  assertEnvironmentIdentity(gitState, { branch: expectedBranch, toplevel: REPO_ROOT });
  assertIsAncestor(applicationArtifact, gitState.head);

  return { applicationArtifact, documentaryCheckpoint: gitState.head, migrations, terminalTwo, gitState };
}

// ---------------------------------------------------------------------------
// Deployment manifest: happy path against the real repository
// ---------------------------------------------------------------------------

test('deployment manifest resolves exactly db/01..db/92, contiguous and unique', () => {
  const filenames = fs.readdirSync(DB_DIR);
  const entries = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL });
  assert.equal(entries.length, 92);
  assert.deepEqual(
    entries.map((entry) => entry.number),
    Array.from({ length: 92 }, (_, i) => i + 1)
  );
});

test('db/91 and db/92 are the terminal two migrations', () => {
  const filenames = fs.readdirSync(DB_DIR);
  const entries = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL });
  const [penultimate91, terminal92] = entries.slice(-2);
  assert.equal(penultimate91.filename, DB91_FILENAME);
  assert.equal(terminal92.filename, DB92_FILENAME);
});

test('the full deployment manifest builds against the real repository', () => {
  const manifest = buildDeploymentManifest();
  assert.equal(manifest.migrations.length, 92);
  assert.equal(manifest.applicationArtifact, APPLICATION_ARTIFACT);
  assert.equal(manifest.terminalTwo.length, 2);
  assert.ok(/^[0-9a-f]{40}$/.test(manifest.documentaryCheckpoint));
});

// ---------------------------------------------------------------------------
// Deployment manifest: fail-closed behavior against synthetic fixtures
// (never against the real db/*.sql files, which this phase must not modify)
// ---------------------------------------------------------------------------

test('fails closed on a duplicate migration number', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '02_c.sql']),
    (err) => err instanceof ManifestError && err.reason === 'DUPLICATE_NUMBER'
  );
});

test('fails closed on a non-contiguous migration sequence (missing migration)', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '04_c.sql']),
    (err) => err instanceof ManifestError && err.reason === 'GAP'
  );
});

test('fails closed when the sequence does not start at migration 1', () => {
  assert.throws(
    () => resolveMigrationManifest(['02_a.sql', '03_b.sql']),
    (err) => err instanceof ManifestError && err.reason === 'MISSING_START'
  );
});

test('fails closed on an unexpected migration after the expected terminal', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '03_c.sql'], { expectedTerminal: 2 }),
    (err) => err instanceof ManifestError && err.reason === 'UNEXPECTED_TRAILING'
  );
});

test('the migration filename pattern excludes .verify.sql siblings and non-numbered files', () => {
  const entries = filterMigrationFilenames([
    '44_partner_cnpj_registry.sql',
    '44_partner_cnpj_registry.verify.sql',
    'setup_completo.sql',
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].filename, '44_partner_cnpj_registry.sql');
});

test('fails closed when a migration hash diverges from the repository checkpoint', () => {
  assert.throws(
    () => assertHashMatchesCheckpoint('deadbeef', 'cafef00d', 'db/synthetic.sql'),
    (err) => err instanceof ManifestError && err.reason === 'HASH_CHANGED'
  );
});

test('fails closed when the application artifact is not an ancestor of the target ref', () => {
  assert.throws(
    () => assertIsAncestor('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'HEAD'),
    (err) => err instanceof ManifestError && err.reason === 'ARTIFACT_NOT_ANCESTOR'
  );
});

test('fails closed on a repository or environment identity mismatch', () => {
  assert.throws(
    () => assertEnvironmentIdentity({ branch: 'main', toplevel: REPO_ROOT }, { branch: EXPECTED_BRANCH, toplevel: REPO_ROOT }),
    (err) => err instanceof ManifestError && err.reason === 'ENVIRONMENT_MISMATCH'
  );
  assert.throws(
    () => assertEnvironmentIdentity({ branch: EXPECTED_BRANCH, toplevel: 'D:/somewhere-else' }, { branch: EXPECTED_BRANCH, toplevel: REPO_ROOT }),
    (err) => err instanceof ManifestError && err.reason === 'ENVIRONMENT_MISMATCH'
  );
});

// ---------------------------------------------------------------------------
// db/75 and db/76 are read-only inputs: checkpoint-matched and byte-stable
// ---------------------------------------------------------------------------

test('db/75 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB75_PATH), gitCheckpointHash(`db/${DB75_FILENAME}`));
});

test('db/76 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB76_PATH), gitCheckpointHash(`db/${DB76_FILENAME}`));
});

test('db/77 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB77_PATH), gitCheckpointHash(`db/${DB77_FILENAME}`));
});

test('db/78 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB78_PATH), gitCheckpointHash(`db/${DB78_FILENAME}`));
});

test('db/79 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB79_PATH), gitCheckpointHash(`db/${DB79_FILENAME}`));
});

test('db/80 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB80_PATH), gitCheckpointHash(`db/${DB80_FILENAME}`));
});

test('db/81 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB81_PATH), gitCheckpointHash(`db/${DB81_FILENAME}`));
});

test('db/82 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB82_PATH), gitCheckpointHash(`db/${DB82_FILENAME}`));
});

test('db/83 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB83_PATH), gitCheckpointHash(`db/${DB83_FILENAME}`));
});

test('db/90 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB90_PATH), gitCheckpointHash(`db/${DB90_FILENAME}`));
});

test('db/89 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB89_PATH), gitCheckpointHash(`db/${DB89_FILENAME}`));
});

test('db/88 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB88_PATH), gitCheckpointHash(`db/${DB88_FILENAME}`));
});

test('db/87 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB87_PATH), gitCheckpointHash(`db/${DB87_FILENAME}`));
});

test('db/86 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB86_PATH), gitCheckpointHash(`db/${DB86_FILENAME}`));
});

test('db/85 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB85_PATH), gitCheckpointHash(`db/${DB85_FILENAME}`));
});

test('db/84 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB84_PATH), gitCheckpointHash(`db/${DB84_FILENAME}`));
});

let db75HashAtStart;
let db76HashAtStart;
let db77HashAtStart;
let db78HashAtStart;
let db79HashAtStart;
let db80HashAtStart;
let db81HashAtStart;
let db82HashAtStart;
let db83HashAtStart;
let db84HashAtStart;
let db85HashAtStart;
let db86HashAtStart;
let db87HashAtStart;
let db88HashAtStart;
let db89HashAtStart;
let db90HashAtStart;
before(() => {
  db75HashAtStart = sha256OfFile(DB75_PATH);
  db76HashAtStart = sha256OfFile(DB76_PATH);
  db77HashAtStart = sha256OfFile(DB77_PATH);
  db78HashAtStart = sha256OfFile(DB78_PATH);
  db79HashAtStart = sha256OfFile(DB79_PATH);
  db80HashAtStart = sha256OfFile(DB80_PATH);
  db81HashAtStart = sha256OfFile(DB81_PATH);
  db82HashAtStart = sha256OfFile(DB82_PATH);
  db83HashAtStart = sha256OfFile(DB83_PATH);
  db84HashAtStart = sha256OfFile(DB84_PATH);
  db85HashAtStart = sha256OfFile(DB85_PATH);
  db86HashAtStart = sha256OfFile(DB86_PATH);
  db87HashAtStart = sha256OfFile(DB87_PATH);
  db88HashAtStart = sha256OfFile(DB88_PATH);
  db89HashAtStart = sha256OfFile(DB89_PATH);
  db90HashAtStart = sha256OfFile(DB90_PATH);
});
after(() => {
  assert.equal(sha256OfFile(DB75_PATH), db75HashAtStart, 'db/75 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB76_PATH), db76HashAtStart, 'db/76 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB77_PATH), db77HashAtStart, 'db/77 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB78_PATH), db78HashAtStart, 'db/78 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB79_PATH), db79HashAtStart, 'db/79 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB80_PATH), db80HashAtStart, 'db/80 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB81_PATH), db81HashAtStart, 'db/81 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB82_PATH), db82HashAtStart, 'db/82 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB83_PATH), db83HashAtStart, 'db/83 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB84_PATH), db84HashAtStart, 'db/84 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB85_PATH), db85HashAtStart, 'db/85 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB86_PATH), db86HashAtStart, 'db/86 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB87_PATH), db87HashAtStart, 'db/87 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB88_PATH), db88HashAtStart, 'db/88 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB89_PATH), db89HashAtStart, 'db/89 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB90_PATH), db90HashAtStart, 'db/90 must remain byte-stable for the whole test run');
});

// ---------------------------------------------------------------------------
// Application-artifact ancestry
// ---------------------------------------------------------------------------

test('application artifact 22bfb192 is present in current branch ancestry', () => {
  const gitState = getGitState();
  assert.equal(gitState.branch, EXPECTED_BRANCH);
  assertIsAncestor(APPLICATION_ARTIFACT, gitState.head);
});

// ---------------------------------------------------------------------------
// No shared/remote database reference anywhere in the bootstrap script
// ---------------------------------------------------------------------------

test('the bootstrap script never references a shared, remote, or Supabase database host', () => {
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    assert.doesNotMatch(BOOTSTRAP_SOURCE, pattern);
  }
});

// ---------------------------------------------------------------------------
// Disposable-cluster lifecycle (real PostgreSQL processes; DB-backed)
// ---------------------------------------------------------------------------

// Asserts the three independent cleanup proofs a stop()/failed-bootstrap
// cleanup must establish: the captured postmaster PID is gone (checked via
// the cross-platform `process.kill(pid, 0)` probe, never a process-name
// listing that could match an unrelated PostgreSQL installation), the port
// is closed, and the temp directory no longer exists.
async function assertFullyCleanedUp(mod, { postmasterPid, host, port, dataDir }) {
  if (postmasterPid) {
    assert.equal(mod.isPidAlive(postmasterPid), false, `postmaster PID ${postmasterPid} must no longer exist`);
  }
  const stillOpen = await mod.isPortOpen(host, port, 1000);
  assert.equal(stillOpen, false, `${host}:${port} must no longer be listening`);
  await assert.rejects(fsp.access(dataDir), /ENOENT/, `${dataDir} must no longer exist`);
}

test('bootstrap creates a fresh disposable cluster outside the repository, on a distinct port, with readiness/connection proof and clean shutdown', async () => {
  const mod = await loadBootstrapModule();
  const repoRoot = mod.getRepoRoot();
  assert.equal(normalizePath(repoRoot), normalizePath(REPO_ROOT));

  const handle = await mod.bootstrapCluster({});
  try {
    assert.ok(!normalizePath(handle.dataDir).startsWith(normalizePath(repoRoot)), 'disposable data directory must be outside the repository');
    assert.ok(fs.existsSync(handle.dataDir), 'data directory must exist while the cluster is running');
    assert.notEqual(handle.port, mod.FORBIDDEN_DEFAULT_PORT, 'the cluster must not bind the conventional default PostgreSQL port');
    assert.equal(handle.host, '127.0.0.1', 'no shared or remote host is ever used');
    assert.ok(Number.isInteger(handle.postmasterPid) && handle.postmasterPid > 0, 'the postmaster PID must be captured from postmaster.pid');
    assert.equal(mod.isPidAlive(handle.postmasterPid), true, 'the captured postmaster PID must be alive while the cluster is running');

    const psqlPath = path.join(handle.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
    const check = spawnSync(
      psqlPath,
      ['-h', handle.host, '-p', String(handle.port), '-U', handle.user, '-d', handle.database, '-tAc', 'SELECT 1'],
      { encoding: 'utf8', timeout: 5000 }
    );
    assert.equal(check.status, 0, `psql connection check failed: ${check.stderr}`);
    assert.equal(check.stdout.trim(), '1');
  } finally {
    const proof = await handle.stop();
    assert.equal(proof.stopResult.ok, true);
    assert.equal(proof.portClosed, true);
    assert.equal(proof.pidAbsent, true);
    assert.equal(proof.dirAbsent, true);
  }

  await assertFullyCleanedUp(mod, handle);
});

test('repeated bootstrap runs do not reuse the same data directory', async () => {
  const mod = await loadBootstrapModule();
  const first = await mod.bootstrapCluster({});
  await first.stop();

  const second = await mod.bootstrapCluster({});
  await second.stop();

  assert.notEqual(first.dataDir, second.dataDir);
  await assertFullyCleanedUp(mod, first);
  await assertFullyCleanedUp(mod, second);
});

test('an injected readiness failure still cleans up the process and the data directory', async () => {
  const mod = await loadBootstrapModule();
  let caught = null;
  try {
    await mod.bootstrapCluster({ simulateReadinessFailure: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'an injected readiness failure must cause bootstrapCluster to reject');
  assert.match(caught.message, /C3D_BOOTSTRAP_FAILED/);
  assert.ok(caught.dataDir, 'the thrown error must report the data directory it attempted to clean up');
  assert.ok(Number.isInteger(caught.postmasterPid) && caught.postmasterPid > 0, 'the thrown error must report the captured postmaster PID');
  assert.equal(caught.cleanupError, null, 'cleanup itself must have succeeded cleanly for this injected failure');
  await assertFullyCleanedUp(mod, { postmasterPid: caught.postmasterPid, host: '127.0.0.1', port: caught.port, dataDir: caught.dataDir });
});

// ---------------------------------------------------------------------------
// Fail-closed shutdown proof: controlled stop/port/process failure injection
// ---------------------------------------------------------------------------

test('a controlled pg_ctl-stop failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forceStopFailure: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'an injected pg_ctl-stop failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_STOP_FAILED/);
  assert.equal(caught.proof.stopResult.ok, false, 'the discarded pg_ctl stop result must be captured, not silently ignored');
  // The real command was never issued for this injected failure, so the
  // process must genuinely still be alive -- proving stop() did not lie.
  assert.equal(mod.isPidAlive(handle.postmasterPid), true, 'the real process must be untouched by an injected stop failure');

  // A failed cleanup attempt can be retried, and a real (non-injected)
  // retry must genuinely finish the job.
  const proof = await handle.stop({});
  assert.equal(proof.stopResult.ok, true);
  assert.equal(proof.portClosed, true);
  assert.equal(proof.pidAbsent, true);
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a controlled persistent-open-port proof failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forcePortStillOpen: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'a persistent-open-port proof failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_PORT_STILL_OPEN/);
  assert.equal(caught.proof.portClosed, false, 'the false port-closed result must be captured, not silently ignored');
  // Unlike the stop-failure injection, this path lets the real `pg_ctl
  // stop` run -- only the port-closed *proof* is forced false -- so the
  // process is genuinely already gone by the time this rejects.
  assert.equal(mod.isPidAlive(handle.postmasterPid), false, 'the real shutdown must have already happened despite the forced proof failure');

  const proof = await handle.stop({});
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a controlled process-still-alive proof failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forceProcessStillAlive: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'a process-still-alive proof failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_PROCESS_STILL_ALIVE/);
  assert.equal(caught.proof.pidAbsent, false, 'the false pid-absent result must be captured, not silently ignored');
  assert.equal(mod.isPidAlive(handle.postmasterPid), false, 'the real shutdown must have already happened despite the forced proof failure');

  const proof = await handle.stop({});
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a second stop() call after a genuinely successful cleanup is a safe no-op', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});
  const first = await handle.stop({});
  const second = await handle.stop({});
  assert.equal(second, first, 'a second call after success must return the cached proof, not re-run cleanup');
  await assertFullyCleanedUp(mod, handle);
});

test('the bootstrap script identifies the disposable process only by its own captured PID, never by process-name enumeration', () => {
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /tasklist/i);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /taskkill/i);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /\bpkill\b/i);
  assert.match(BOOTSTRAP_SOURCE, /readPostmasterPid/);
  assert.match(BOOTSTRAP_SOURCE, /process\.kill\(pid, 0\)/);
});

test('no shared or remote database connection is attempted (runtime host assertion)', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});
  try {
    assert.equal(handle.host, '127.0.0.1');
    assert.equal(handle.database, 'postgres');
  } finally {
    await handle.stop();
  }
});
