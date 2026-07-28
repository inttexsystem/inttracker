// scripts/reset/clean-slate-transactional-verify.mjs
//
// Clean-Slate Transactional Reset — archive & restore-drill VERIFICATION tool.
//
// Governed by docs/architecture/CLEAN_SLATE_TRANSACTIONAL_RESET_PHASE_CONTRACT.md
// (§8.3 / §16). `verify-archive` re-derives every checksum and identity claim
// from the on-disk archive and fails closed (non-zero exit) on any mismatch,
// without ever printing archived business rows.
//
// Reuses the canonical constants and gate logic from the export tool so the two
// tools cannot drift.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sha256Hex, canonicalJSON,
  EXPORT_TABLES, EXPECTED_ROW_COUNTS, EXPECTED_OP_IDS, EXPECTED_LOTE_IDS, EXPECTED_PEDIDO_IDS,
  EXPECTED_B6, B6_DOCUMENT_ID, TERMINAL_MIGRATION, ARCHIVE_KIND,
  PRODUCTION_REF, RETIRED_REF, FORBIDDEN_REF,
  verifyIdentity, verifyCutover, verifyCorpusIdentities, verifyPreservedBaseline,
} from './clean-slate-transactional-export.mjs';
// Preserved-baseline constants (EXPECTED_SALDO_FIOS/EXPECTED_OP_NUMEROS/etc.) and
// their validation logic live ONLY in clean-slate-transactional-export.mjs
// (verifyPreservedBaseline) — imported above, never duplicated here.

class Verifier {
  constructor() { this.checks = []; this.failed = 0; }
  ok(name) { this.checks.push({ name, ok: true }); }
  fail(name, detail) { this.checks.push({ name, ok: false, detail }); this.failed += 1; }
  assert(cond, name, detail) { cond ? this.ok(name) : this.fail(name, detail); return cond; }
}

function eqSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].map(String).sort(); const sb = [...b].map(String).sort();
  return sa.every((x, i) => x === sb[i]);
}

function readJSON(p) { return JSON.parse(readFileSync(p, 'utf8')); }

// Parse every NDJSON line; returns { rows, lines } or throws on malformed JSON.
function parseNdjson(abs) {
  const raw = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  if (raw.length === 0) return { rows: [], lines: 0, body: '' };
  if (!raw.endsWith('\n')) throw new Error(`NDJSON file not LF-terminated: ${path.basename(abs)}`);
  const lines = raw.slice(0, -1).split('\n');
  const rows = lines.map((l, i) => {
    if (l.length === 0) throw new Error(`empty NDJSON line ${i + 1} in ${path.basename(abs)}`);
    try { return JSON.parse(l); } catch { throw new Error(`malformed NDJSON line ${i + 1} in ${path.basename(abs)}`); }
  });
  return { rows, lines: rows.length, body: raw };
}

// Recursively enumerates every entry under `root`, rejecting symlinks and any
// entry type other than plain file/directory. Returns POSIX-style relative
// paths so exact-inventory comparison is platform-independent (blocking
// correction C — the verifier must not rely on a shallow, single-level scan).
function walkArchive(root) {
  const files = [];
  const dirs = [];
  const stack = [{ abs: root, rel: '' }];
  while (stack.length) {
    const { abs, rel } = stack.pop();
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const entryAbs = path.join(abs, entry.name);
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`CLEAN_SLATE_SYMLINK_REJECTED: ${entryRel}`);
      if (entry.isDirectory()) { dirs.push(entryRel); stack.push({ abs: entryAbs, rel: entryRel }); }
      else if (entry.isFile()) files.push(entryRel);
      else throw new Error(`CLEAN_SLATE_UNEXPECTED_ENTRY_TYPE: ${entryRel}`);
    }
  }
  return { files: files.sort(), dirs: dirs.sort() };
}

// Strict checksums.sha256 parser (blocking correction C): every non-empty line
// must match exactly `<64-hex-sha>  <relative-path>`; rejects malformed lines
// (never silently skips them), duplicate paths, and unsafe paths (backslash,
// `..` traversal, leading `/`, or a Windows drive letter).
function parseChecksumsFile(abs) {
  const raw = readFileSync(abs, 'utf8');
  if (raw.length === 0) throw new Error('checksums.sha256 is empty');
  if (!raw.endsWith('\n')) throw new Error('checksums.sha256 must be LF-terminated');
  const lines = raw.slice(0, -1).split('\n');
  const declared = new Map();
  lines.forEach((line, i) => {
    if (line.length === 0) throw new Error(`checksums.sha256 malformed blank line at ${i + 1}`);
    const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (!m) throw new Error(`checksums.sha256 malformed line at ${i + 1}: ${JSON.stringify(line)}`);
    const [, sha, relPath] = m;
    if (relPath.includes('\\') || relPath.includes('..') || relPath.startsWith('/') || /^[A-Za-z]:/.test(relPath)) {
      throw new Error(`checksums.sha256 unsafe path at line ${i + 1}: ${relPath}`);
    }
    if (declared.has(relPath)) throw new Error(`checksums.sha256 duplicate entry at line ${i + 1}: ${relPath}`);
    declared.set(relPath, sha);
  });
  return declared;
}

export function verifyArchive(archiveDir) {
  const v = new Verifier();
  const rel = (r) => path.join(archiveDir, r);

  // --- Structure ---
  if (!v.assert(existsSync(archiveDir) && statSync(archiveDir).isDirectory(), 'archive dir exists', archiveDir)) return v;
  for (const f of ['manifest.json', 'checksums.sha256', 'tables', 'evidence']) {
    v.assert(existsSync(rel(f)), `required entry present: ${f}`, f);
  }
  for (const e of ['database-identity.json', 'cutover-state.json', 'preserved-baseline.json', 'corpus-identities.json']) {
    v.assert(existsSync(rel(`evidence/${e}`)), `evidence present: ${e}`, e);
  }
  if (v.failed) return v;

  let manifest;
  try { manifest = readJSON(rel('manifest.json')); } catch (e) { v.fail('manifest parseable', e.message); return v; }
  v.assert(manifest.archive_kind === ARCHIVE_KIND, 'manifest.archive_kind', manifest.archive_kind);
  v.assert(manifest.database?.terminal_migration === TERMINAL_MIGRATION, 'terminal migration evidence', manifest.database?.terminal_migration);

  // --- Exact archive inventory (blocking correction C): recursively enumerate
  // the COMPLETE archive and reject anything beyond exactly the permitted set
  // (no unexpected root/nested files, no unexpected directories, no auth.*
  // content, no symlinks, no duplicate/missing paths). ---
  let walk;
  try { walk = walkArchive(archiveDir); v.ok('archive recursively enumerable (no symlinks/unexpected entry types)'); }
  catch (e) { v.fail('archive recursively enumerable (no symlinks/unexpected entry types)', e.message); walk = { files: [], dirs: [] }; }

  const expectedDirs = new Set(['tables', 'evidence']);
  for (const d of walk.dirs) v.assert(expectedDirs.has(d), `no unexpected directory: ${d}`, d);
  v.assert(walk.dirs.length === expectedDirs.size, 'exact directory count', `${walk.dirs.length} != ${expectedDirs.size}`);

  const expectedFiles = new Set([
    'manifest.json', 'checksums.sha256',
    'evidence/database-identity.json', 'evidence/cutover-state.json',
    'evidence/preserved-baseline.json', 'evidence/corpus-identities.json',
    ...EXPORT_TABLES.map((t) => `tables/${t.name}.ndjson`),
  ]);
  for (const f of walk.files) {
    v.assert(expectedFiles.has(f), `no unexpected file: ${f}`, f);
    if (f.startsWith('tables/')) {
      const name = f.slice('tables/'.length).replace(/\.ndjson$/, '');
      v.assert(name.startsWith('public.'), `no non-public schema exported: ${f}`, name);
      v.assert(!/^auth\./.test(name), `no auth.* content: ${f}`, name);
    }
  }
  for (const f of expectedFiles) v.assert(walk.files.includes(f), `expected file present: ${f}`, f);
  v.assert(walk.files.length === expectedFiles.size, 'exact file count', `${walk.files.length} != ${expectedFiles.size}`);
  const tableFiles = walk.files.filter((f) => f.startsWith('tables/')).map((f) => f.slice('tables/'.length).replace(/\.ndjson$/, ''));
  v.assert(tableFiles.length === EXPORT_TABLES.length, 'exact table-file count', `${tableFiles.length} != ${EXPORT_TABLES.length}`);

  // --- Per-table: parseable NDJSON, row counts, per-file checksum ---
  const manifestByTable = new Map((manifest.tables || []).map((t) => [t.table, t]));
  const fileShas = new Map();
  for (const t of EXPORT_TABLES) {
    const abs = rel(`tables/${t.name}.ndjson`);
    if (!v.assert(existsSync(abs), `table file present: ${t.name}`, t.name)) continue;
    let parsed;
    try { parsed = parseNdjson(abs); } catch (e) { v.fail(`NDJSON parseable: ${t.name}`, e.message); continue; }
    v.ok(`NDJSON parseable: ${t.name}`);
    v.assert(parsed.lines === EXPECTED_ROW_COUNTS[t.name], `row count: ${t.name}`, `${parsed.lines} != ${EXPECTED_ROW_COUNTS[t.name]}`);
    const mt = manifestByTable.get(t.name);
    v.assert(mt && mt.row_count === parsed.lines, `manifest row_count: ${t.name}`, mt?.row_count);
    const sha = sha256Hex(Buffer.from(parsed.body, 'utf8'));
    fileShas.set(`tables/${t.name}.ndjson`, sha);
    v.assert(mt && mt.sha256 === sha, `per-file checksum: ${t.name}`, 'sha mismatch');
  }

  // --- Evidence checksums ---
  for (const e of ['database-identity.json', 'cutover-state.json', 'preserved-baseline.json', 'corpus-identities.json']) {
    const body = readFileSync(rel(`evidence/${e}`), 'utf8');
    fileShas.set(`evidence/${e}`, sha256Hex(Buffer.from(body, 'utf8')));
  }

  // --- checksums.sha256 strict cross-check (blocking correction C): malformed
  // lines, duplicates, unsafe paths, extra entries, and missing entries are all
  // rejected — never silently ignored. ---
  const manifestBodySha = sha256Hex(Buffer.from(readFileSync(rel('manifest.json'), 'utf8'), 'utf8'));
  let declared = new Map();
  try { declared = parseChecksumsFile(rel('checksums.sha256')); v.ok('checksums.sha256 strictly parseable'); }
  catch (e) { v.fail('checksums.sha256 strictly parseable', e.message); }

  for (const [p, sha] of fileShas) {
    v.assert(declared.get(p) === sha, `checksums.sha256 entry: ${p}`, `declared ${declared.get(p)} vs actual ${sha}`);
  }
  v.assert(declared.get('manifest.json') === manifestBodySha, 'checksums.sha256 entry: manifest.json', 'manifest sha mismatch');
  for (const p of declared.keys()) {
    v.assert(fileShas.has(p) || p === 'manifest.json', `no extra checksums.sha256 entry: ${p}`, p);
  }
  v.assert(declared.size === fileShas.size + 1, 'exact checksums.sha256 entry count', `${declared.size} != ${fileShas.size + 1}`);

  // --- Aggregate checksum recomputation ---
  const aggFiles = [...fileShas.entries()].map(([r, sha]) => ({ rel: r, sha }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const aggregate = sha256Hex(aggFiles.map((f) => `${f.rel}\n${f.sha}\n`).join(''));
  v.assert(manifest.aggregate_sha256 === aggregate, 'aggregate checksum', `${manifest.aggregate_sha256} != ${aggregate}`);

  // --- Identity / cutover / preserved-baseline evidence ---
  let identityEvidence;
  try {
    identityEvidence = readJSON(rel('evidence/database-identity.json'));
    verifyIdentity(identityEvidence);
    v.ok('database identity evidence');
  } catch (e) { v.fail('database identity evidence', e.message); }
  try { verifyCutover(readJSON(rel('evidence/cutover-state.json'))); v.ok('cutover evidence'); }
  catch (e) { v.fail('cutover evidence', e.message); }

  // --- Project-ref custody (blocking correction D; target contract per
  // INTTRACKER-PRODUCTION-CUTOVER-R1): manifest.database.project_ref,
  // evidence/database-identity.json's project_ref, and the definitive production
  // ref must all agree — no archive may verify clean for any other project. The
  // retired and forbidden projects are rejected explicitly and unconditionally:
  // an archive claiming either of them is never an authorized target, whatever
  // else it contains. ---
  const claimedRefs = [manifest.database?.project_ref, identityEvidence?.project_ref];
  v.assert(!claimedRefs.includes(RETIRED_REF), `archive does not claim the retired project ${RETIRED_REF}`, claimedRefs.join(' / '));
  v.assert(!claimedRefs.includes(FORBIDDEN_REF), `archive does not claim the forbidden project ${FORBIDDEN_REF}`, claimedRefs.join(' / '));
  v.assert(manifest.database?.project_ref === PRODUCTION_REF, `manifest project_ref = ${PRODUCTION_REF}`, manifest.database?.project_ref);
  v.assert(identityEvidence?.project_ref === PRODUCTION_REF, `evidence project_ref = ${PRODUCTION_REF}`, identityEvidence?.project_ref);
  v.assert(manifest.database?.project_ref === identityEvidence?.project_ref, 'manifest/evidence project_ref match', `${manifest.database?.project_ref} vs ${identityEvidence?.project_ref}`);

  try {
    verifyPreservedBaseline(readJSON(rel('evidence/preserved-baseline.json')));
    v.ok('preserved baseline evidence (saldo_fios/op_numeros/master/documents-front)');
  } catch (e) {
    v.fail('preserved baseline evidence (saldo_fios/op_numeros/master/documents-front)', e.message);
  }

  // --- Corpus identities (16/20/25 + B6) from evidence AND manifest ---
  try { verifyCorpusIdentities(readJSON(rel('evidence/corpus-identities.json'))); v.ok('corpus identities evidence'); }
  catch (e) { v.fail('corpus identities evidence', e.message); }
  v.assert(eqSet(manifest.targets?.pedido_ids || [], EXPECTED_PEDIDO_IDS), 'manifest 16 Pedido ids', 'mismatch');
  v.assert(eqSet(manifest.targets?.op_ids || [], EXPECTED_OP_IDS), 'manifest 20 OP ids', 'mismatch');
  v.assert(eqSet(manifest.targets?.lote_ids || [], EXPECTED_LOTE_IDS), 'manifest 25 lote ids', 'mismatch');

  // --- B6 fixture footprint from manifest + actual NDJSON ---
  verifyB6(v, archiveDir, manifest);

  // --- Duplicate-identity rejection (PK / target-id uniqueness) ---
  verifyNoDuplicates(v, archiveDir);

  return v;
}

function verifyB6(v, archiveDir, manifest) {
  const bf = manifest.b6_fixture || {};
  v.assert(bf.document_id === B6_DOCUMENT_ID, 'B6 fixture id', bf.document_id);
  v.assert(bf.document_link_revision_ops === EXPECTED_B6.document_link_revision_ops, 'B6 document_link_revision_ops = 10', bf.document_link_revision_ops);
  v.assert(bf.document_link_revisions === EXPECTED_B6.document_link_revisions, 'B6 document_link_revisions = 8', bf.document_link_revisions);
  v.assert(eqSet(bf.distinct_ops || [], EXPECTED_B6.distinct_ops), 'B6 distinct OPs = 55,57,61,63', bf.distinct_ops);

  const ropsAbs = path.join(archiveDir, 'tables/public.document_link_revision_ops.ndjson');
  let rops;
  try { rops = parseNdjson(ropsAbs).rows; } catch (e) { v.fail('B6 revision-ops parseable', e.message); return; }
  v.assert(rops.length === 10, 'B6 revision-op rows on disk = 10', rops.length);
  const ops = [...new Set(rops.map((r) => r.op_id))].sort((a, b) => a - b);
  v.assert(eqSet(ops, EXPECTED_B6.distinct_ops), 'B6 revision-op distinct OP footprint = 55,57,61,63', ops.join(','));
  const revAbs = path.join(archiveDir, 'tables/public.document_link_revisions.ndjson');
  const revs = parseNdjson(revAbs).rows;
  const perRev = revs.sort((a, b) => a.version - b.version)
    .map((r) => rops.filter((o) => o.revision_id === r.id).length);
  v.assert(JSON.stringify(perRev) === JSON.stringify(EXPECTED_B6.per_revision),
    'B6 per-revision footprint = 0,0,2,1,2,2,1,2', perRev.join(','));
}

function verifyNoDuplicates(v, archiveDir) {
  const check = (table, keyFn, label) => {
    const abs = path.join(archiveDir, `tables/${table}.ndjson`);
    if (!existsSync(abs)) return;
    let rows;
    try { rows = parseNdjson(abs).rows; } catch { return; }
    const keys = rows.map(keyFn);
    v.assert(new Set(keys.map(String)).size === keys.length, `no duplicate identity: ${label}`, table);
  };
  check('public.pedidos', (r) => r.id, 'pedidos.id');
  check('public.ops', (r) => r.id, 'ops.id');
  check('public.lotes', (r) => r.id, 'lotes.id');
  check('public.document_link_revisions', (r) => r.id, 'document_link_revisions.id');
  check('public.document_link_revision_ops', (r) => `${r.revision_id}|${r.op_id}`, 'document_link_revision_ops(revision_id,op_id)');
  check('public.ordem_compra_item', (r) => r.id, 'ordem_compra_item.id');
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args._[0] !== 'verify-archive' || !args.archive) {
    process.stderr.write('usage: clean-slate-transactional-verify.mjs verify-archive --archive <ABSOLUTE_ARCHIVE_PATH>\n');
    process.exit(2);
  }
  const v = verifyArchive(path.resolve(args.archive));
  const passed = v.checks.length - v.failed;
  process.stdout.write(`clean-slate archive verification: ${passed}/${v.checks.length} checks passed\n`);
  if (v.failed) {
    for (const c of v.checks.filter((c) => !c.ok)) process.stderr.write(`FAIL: ${c.name}${c.detail ? ` (${c.detail})` : ''}\n`);
    process.exit(1);
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try { main(); } catch (err) { process.stderr.write(`${err.message}\n`); process.exit(1); }
}
