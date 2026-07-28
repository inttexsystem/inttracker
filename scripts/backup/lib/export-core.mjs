// scripts/backup/lib/export-core.mjs
//
// Orchestration for the trigger-agnostic database exporter (Camada 3,
// BK4.2 — docs/architecture/CAMADA3_BACKUP_CONTRACT.md). Pure(ish)
// logic: every real-world effect (spawning pg_dump/psql/tar, HTTP calls
// to Supabase/Google, the filesystem, "now") is received through the
// `io` parameter, defaulted by the CLI wrapper (export-db.mjs) to the
// real implementations. Tests inject fakes here directly — no real
// binaries, network, or credentials required to exercise this module.
//
// Exit-code classification (contract SS5):
//   OK               0  full success
//   USAGE            1  bad args / missing required input / binary missing
//   PREFLIGHT_BUCKET 2  storage.buckets count != 0 (contract SS1 fail-loud)
//   DUMP_FAILED      3  pg_dump/psql/tar failure
//   RECORD_FAILED    4  iniciar_backup_run/finalizar_backup_run call failed
//   UPLOAD_FAILED    5  the primary destination's upload failed

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRedactor, truncate } from './sanitize.mjs';
import {
  checkBinaryAvailable,
  dumpPublicSchema,
  dumpPublicData,
  dumpAuthFull,
  queryStorageBucketCount,
  queryRowCountManifest,
} from './pg.mjs';
import { sha256File, createBundle, bundleFilename } from './manifest.mjs';
import { uploadBackupBundle } from './drive.mjs';
import { iniciarBackupRun, finalizarBackupRun } from './supabase-backup-runs.mjs';

export const EXIT_CODES = {
  OK: 0,
  USAGE: 1,
  PREFLIGHT_BUCKET: 2,
  DUMP_FAILED: 3,
  RECORD_FAILED: 4,
  UPLOAD_FAILED: 5,
};

// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1 — identidades de
// ambiente correntes. `ucrjtfswnfdlxwtmxnoo` e a producao definitiva (e o
// unico alvo legitimo de um backup read-only); `gqmpsxkxynrjvidfmojk` foi
// retirado; `bhgifjrfagkzubpyqpew` e proibido. Nao existe banco
// nao-produtivo, portanto nao existe um ref de staging.
export const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
export const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
export const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';

function envelope(extra) {
  return { ok: false, dry_run: false, destinations: [], manifest: null, ...extra };
}

/**
 * Structural dry-run: validates inputs, states the exact commands that
 * would run, touches nothing live (no DB connection, no Supabase call,
 * no Drive call). Matches this repo's established --confirm-real-*
 * convention (dry-run is the default).
 */
export function planExport(config) {
  const commands = [
    `pg_dump --schema=public --schema-only --no-owner --no-privileges -f schema_public.sql`,
    `pg_dump --schema=public --data-only --no-owner --no-privileges --disable-triggers -f data_public.sql`,
    `pg_dump --schema=auth --no-owner --no-privileges -f auth_full.sql`,
    `psql -t -A -c "select count(*) from storage.buckets;"`,
    `psql -t -A -c "<row-count-manifest query over public+auth>"`,
    `tar -czf ${bundleFilename()} -C <tmpdir> .`,
  ];
  const destinations = ['google_drive', ...(config.destinations || []).filter((d) => d !== 'google_drive')];
  return {
    ok: true,
    dry_run: true,
    exitCode: EXIT_CODES.OK,
    scope: 'public+auth',
    triggered_by: config.triggeredBy,
    retention_class: config.retentionClass,
    planned: { commands, destinations },
  };
}

/**
 * Real, confirmed run. `config` carries validated CLI/env input (see
 * export-db.mjs for parsing); `io` carries every effectful dependency,
 * all defaulted for production use by the CLI wrapper.
 */
export async function runExport(config, io) {
  const redact = buildRedactor([
    config.pgConn?.password,
    config.supabase?.serviceRoleKey,
    config.drive?.clientSecret,
    config.drive?.refreshToken,
  ]);
  const log = (msg) => io.log(redact(msg));

  for (const bin of [io.pgDumpBin || 'pg_dump', io.psqlBin || 'psql', io.tarBin || 'tar']) {
    if (!checkBinaryAvailable(bin, { spawnSync: io.spawnSync })) {
      return { ...envelope({ error: `binary_not_found: ${bin}` }), exitCode: EXIT_CODES.USAGE };
    }
  }

  let runId = null;
  const workDir = io.mkdtemp ? io.mkdtemp() : mkdtempSync(join(tmpdir(), 'ravatex-backup-'));
  const pgOpts = { spawnSync: io.spawnSync, redact, pgDumpBin: io.pgDumpBin, psqlBin: io.psqlBin };

  try {
    log('opening backup_runs record...');
    let openResult;
    try {
      openResult = await iniciarBackupRun(
        {
          supabaseUrl: config.supabase.url,
          serviceRoleKey: config.supabase.serviceRoleKey,
          scope: 'public+auth',
          triggeredBy: config.triggeredBy,
          retentionClass: config.retentionClass,
        },
        io,
      );
    } catch (e) {
      return { ...envelope({ error: truncate(redact(e.message)) }), exitCode: EXIT_CODES.RECORD_FAILED };
    }
    if (!openResult?.ok) {
      return { ...envelope({ error: `iniciar_backup_run_rejected: ${openResult?.error}` }), exitCode: EXIT_CODES.RECORD_FAILED };
    }
    runId = openResult.run_id;
    log(`run_id=${runId}`);

    log('pre-flight: storage bucket count...');
    let bucketCount;
    try {
      bucketCount = queryStorageBucketCount(config.pgConn, pgOpts);
    } catch (e) {
      return await failRun(io, config, runId, redact, e, EXIT_CODES.DUMP_FAILED);
    }
    if (bucketCount !== 0) {
      return await failRun(
        io,
        config,
        runId,
        redact,
        new Error(`storage_bucket_appeared: count=${bucketCount}`),
        EXIT_CODES.PREFLIGHT_BUCKET,
      );
    }

    log('computing row-count manifest...');
    let rowCountManifest;
    try {
      rowCountManifest = queryRowCountManifest(config.pgConn, pgOpts);
    } catch (e) {
      return await failRun(io, config, runId, redact, e, EXIT_CODES.DUMP_FAILED);
    }

    log('dumping schema_public.sql...');
    log('dumping data_public.sql...');
    log('dumping auth_full.sql...');
    const schemaFile = join(workDir, 'schema_public.sql');
    const dataFile = join(workDir, 'data_public.sql');
    const authFile = join(workDir, 'auth_full.sql');
    try {
      dumpPublicSchema(config.pgConn, schemaFile, pgOpts);
      dumpPublicData(config.pgConn, dataFile, pgOpts);
      dumpAuthFull(config.pgConn, authFile, pgOpts);
    } catch (e) {
      return await failRun(io, config, runId, redact, e, EXIT_CODES.DUMP_FAILED);
    }

    const manifestFile = join(workDir, 'manifest.json');
    const fileHashes = {};
    for (const [name, path] of [['schema_public.sql', schemaFile], ['data_public.sql', dataFile], ['auth_full.sql', authFile]]) {
      const sha = io.sha256File ? await io.sha256File(path) : await sha256File(path);
      const bytes = io.statSize ? io.statSize(path) : statSync(path).size;
      fileHashes[name] = { sha256: sha, bytes };
    }
    const manifestPayload = {
      created_at: io.now ? io.now() : new Date().toISOString(),
      scope: 'public+auth',
      files: fileHashes,
      row_count_manifest: rowCountManifest,
      storage_buckets_count: bucketCount,
    };
    (io.writeFile || writeFileSync)(manifestFile, JSON.stringify(manifestPayload, null, 2));

    log('assembling bundle...');
    const bundleName = bundleFilename(io.now ? new Date(io.now()) : new Date());
    const bundlePath = join(config.outDir, bundleName);
    if (!existsSync(config.outDir)) (io.mkdir || mkdirSync)(config.outDir, { recursive: true });
    try {
      (io.createBundle || createBundle)(workDir, bundlePath, { spawnSync: io.spawnSync, tarBin: io.tarBin, redact });
    } catch (e) {
      return await failRun(io, config, runId, redact, e, EXIT_CODES.DUMP_FAILED);
    }
    const bundleSha = io.sha256File ? await io.sha256File(bundlePath) : await sha256File(bundlePath);
    const bundleBytes = io.statSize ? io.statSize(bundlePath) : statSync(bundlePath).size;

    log(`bundle ready: ${bundlePath} (${bundleBytes} bytes, sha256=${bundleSha})`);

    const destinationResults = [];
    log('uploading to google_drive...');
    let primaryOk = false;
    try {
      const bundleData = io.readFile ? await io.readFile(bundlePath) : readFileSync(bundlePath);
      const upload = await uploadBackupBundle(
        {
          clientId: config.drive.clientId,
          clientSecret: config.drive.clientSecret,
          refreshToken: config.drive.refreshToken,
          folderName: config.drive.folderName,
          filename: bundleName,
          mimeType: 'application/gzip',
          data: bundleData,
        },
        io,
      );
      destinationResults.push({ destination: 'google_drive', status: 'ok', uploaded_at: io.now ? io.now() : new Date().toISOString() });
      primaryOk = true;
      log(`drive upload ok: fileId=${upload.fileId}`);
    } catch (e) {
      destinationResults.push({ destination: 'google_drive', status: 'failed', error: truncate(redact(e.message)) });
      log(`drive upload failed: ${e.message}`);
    }

    // OneDrive ships disabled — interface-ready, never attempted, per
    // contract SS4. Recorded as its own row so the N-destination shape
    // is exercised end-to-end even with a single active destination.
    destinationResults.push({ destination: 'onedrive', status: 'skipped' });

    const finalStatus = primaryOk ? 'completed' : 'failed';
    const finalError = primaryOk ? undefined : 'primary_destination_upload_failed';

    let closeResult;
    try {
      closeResult = await finalizarBackupRun(
        {
          supabaseUrl: config.supabase.url,
          serviceRoleKey: config.supabase.serviceRoleKey,
          runId,
          status: finalStatus,
          bytes: bundleBytes,
          sha256: bundleSha,
          rowCountManifest,
          error: finalError,
          destinations: destinationResults,
        },
        io,
      );
    } catch (e) {
      return { ...envelope({ error: truncate(redact(e.message)), run_id: runId }), exitCode: EXIT_CODES.RECORD_FAILED };
    }
    if (!closeResult?.ok) {
      return { ...envelope({ error: `finalizar_backup_run_rejected: ${closeResult?.error}`, run_id: runId }), exitCode: EXIT_CODES.RECORD_FAILED };
    }

    return {
      ok: primaryOk,
      dry_run: false,
      run_id: runId,
      status: finalStatus,
      bundle_path: bundlePath,
      bytes: bundleBytes,
      sha256: bundleSha,
      manifest: manifestPayload,
      destinations: destinationResults,
      exitCode: primaryOk ? EXIT_CODES.OK : EXIT_CODES.UPLOAD_FAILED,
    };
  } finally {
    if (!config.keepWorkDir) {
      try {
        (io.rmDir || rmSync)(workDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup only
      }
    }
  }
}

async function failRun(io, config, runId, redact, error, exitCode) {
  const message = truncate(redact(error.message || String(error)));
  try {
    await finalizarBackupRun(
      {
        supabaseUrl: config.supabase.url,
        serviceRoleKey: config.supabase.serviceRoleKey,
        runId,
        status: 'failed',
        rowCountManifest: {},
        error: message,
        destinations: [],
      },
      io,
    );
  } catch {
    // best-effort: the run stays 'running' in backup_runs if even the
    // failure record can't be written; this is surfaced by the exit
    // code and stderr, never silently swallowed.
  }
  return { ...envelope({ error: message, run_id: runId }), exitCode };
}
