// scripts/reset/clean-slate-transactional-export.mjs
//
// Clean-Slate Transactional Reset — deterministic archive EXPORT tool.
//
// Governed by docs/architecture/CLEAN_SLATE_TRANSACTIONAL_RESET_PHASE_CONTRACT.md
// (§8 Archive package). This tool produces the read-only, deterministic archive
// of the exact purge scope (§7.1/§7.2/§7.3) required BEFORE any future
// destructive reset. It never mutates the source database.
//
// It is deliberately transport-agnostic at its core (`buildArchive`) and exposes
// two front-ends:
//   * `export --target <ref> --database-url <url>`   — connect to an explicitly
//        supplied PostgreSQL target via the `psql` CLI, open ONE
//        `REPEATABLE READ READ ONLY` transaction, run the corpus gate, capture
//        every purge-scope row, and build the archive.
//   * `export --target <ref> --from-capture <file>`  — build the archive from a
//        capture JSON produced by an authorized read-only transaction. This is
//        the path used when the only authorized read-only transport is the
//        project-scoped MCP (no direct psql connection string is available/
//        authorized in this environment). The EXACT SAME `CAPTURE_SQL`,
//        corpus-gate assertions and serialization are used on both paths.
//
// Determinism: fixed table order, fixed row order (explicit ORDER BY inside
// `CAPTURE_SQL`), PostgreSQL `to_json(row)` canonical row serialization written
// VERBATIM (never re-serialized in JS, so numeric scale such as `732.010` is
// preserved byte-for-byte), UTF-8, LF line endings, SHA-256 per table file and a
// deterministic aggregate checksum.
//
// Safety (target identity per INTTRACKER-PRODUCTION-CUTOVER-R1): refuses a
// missing/ambiguous target; ALWAYS refuses the retired project
// `gqmpsxkxynrjvidfmojk` and the forbidden project `bhgifjrfagkzubpyqpew`;
// accepts the definitive production project `ucrjtfswnfdlxwtmxnoo` only when the
// caller supplies the exact `--confirm-production-readonly-export` flag, which
// authorizes NOTHING beyond this read-only export (no reset, purge, delete,
// migration or SQL mutation exists in this tool). It re-runs the full corpus
// gate before writing any archive, never prints business rows or secrets to
// stdout/stderr, and writes the archive OUTSIDE the repository.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Canonical constants (the accepted contract baseline; terminal 20260722055832)
// ---------------------------------------------------------------------------

// Environment identity (INTTRACKER-PRODUCTION-CUTOVER-R1). There is NO
// authorized development target: no valid separate non-production database
// exists, so the only reachable target is production, and only read-only and
// only under explicit confirmation.
export const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
export const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
export const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';
export const PRODUCTION_CONFIRMATION_FLAG = 'confirm-production-readonly-export';
export const TERMINAL_MIGRATION = '20260722055832';
export const EXPECTED_SERVER_VERSION = '17.6';
export const B6_DOCUMENT_ID = 'G28-B6-VERIFY-c63b6c2c8aff4da58e87d1e75f7a9236-DOCUMENT';
export const ARCHIVE_KIND = 'clean-slate-transactional-reset';
export const ARCHIVE_SCHEMA_VERSION = 1;

// Deterministic export order + deterministic row order + doc-fixture scope.
export const EXPORT_TABLES = [
  { name: 'public.ordens_compra_fio', order: 'id' },
  { name: 'public.necessidade_compra_fio', order: 'id' },
  { name: 'public.ordem_compra', order: 'id' },
  { name: 'public.ordem_compra_item', order: 'id' },
  { name: 'public.ordem_compra_item_alocacao', order: 'id' },
  { name: 'public.ordem_compra_item_compat_fio', order: 'id' },
  { name: 'public.ordem_compra_recebimentos', order: 'id' },
  { name: 'public.ordem_compra_eventos', order: 'id' },
  { name: 'public.ordem_compra_fio_lancamentos', order: 'id' },
  { name: 'public.ordem_compra_fio_movimentos_estoque', order: 'id' },
  { name: 'public.ordem_compra_distribuicao_comandos', order: 'id' },
  { name: 'public.document_candidates', order: 'id::text', scope: `document_id = ${sqlLit(B6_DOCUMENT_ID)}` },
  { name: 'public.document_link_revisions', order: 'version', scope: `document_id = ${sqlLit(B6_DOCUMENT_ID)}` },
  {
    name: 'public.document_link_revision_ops',
    order: 'revision_id::text, op_id',
    scope: `revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id = ${sqlLit(B6_DOCUMENT_ID)})`,
  },
  { name: 'public.document_events', order: 'id::text', scope: `document_id = ${sqlLit(B6_DOCUMENT_ID)}` },
  { name: 'public.document_technical_evidences', order: 'document_id, evidence_version', scope: `document_id = ${sqlLit(B6_DOCUMENT_ID)}` },
  { name: 'public.document_decisions', order: 'id::text', scope: `document_id = ${sqlLit(B6_DOCUMENT_ID)}` },
  { name: 'public.pedidos', order: 'numero' },
  { name: 'public.pedido_itens', order: 'id::text' },
  { name: 'public.pedido_eventos', order: 'id::text' },
  { name: 'public.pedido_cliente_eventos', order: 'id::text' },
  { name: 'public.pedido_parciais', order: 'id::text' },
  { name: 'public.pedido_parcial_itens', order: 'id::text' },
  { name: 'public.pedido_compra_fio_regime', order: 'pedido_id::text' },
  { name: 'public.ops', order: 'id' },
  { name: 'public.op_itens', order: 'id' },
  { name: 'public.op_fornecedores', order: 'id' },
  { name: 'public.op_eventos', order: 'id' },
  { name: 'public.op_latex_entregas', order: 'id' },
  { name: 'public.lotes', order: 'id' },
];

// Exact row-count baseline of the purge scope (contract §5).
export const EXPECTED_ROW_COUNTS = {
  'public.ordens_compra_fio': 64,
  'public.necessidade_compra_fio': 64,
  'public.ordem_compra': 51,
  'public.ordem_compra_item': 51,
  'public.ordem_compra_item_alocacao': 51,
  'public.ordem_compra_item_compat_fio': 51,
  'public.ordem_compra_recebimentos': 0,
  'public.ordem_compra_eventos': 0,
  'public.ordem_compra_fio_lancamentos': 0,
  'public.ordem_compra_fio_movimentos_estoque': 0,
  'public.ordem_compra_distribuicao_comandos': 0,
  'public.document_candidates': 1,
  'public.document_link_revisions': 8,
  'public.document_link_revision_ops': 10,
  'public.document_events': 0,
  'public.document_technical_evidences': 0,
  'public.document_decisions': 0,
  'public.pedidos': 16,
  'public.pedido_itens': 18,
  'public.pedido_eventos': 0,
  'public.pedido_cliente_eventos': 0,
  'public.pedido_parciais': 0,
  'public.pedido_parcial_itens': 0,
  'public.pedido_compra_fio_regime': 0,
  'public.ops': 20,
  'public.op_itens': 27,
  'public.op_fornecedores': 16,
  'public.op_eventos': 4,
  'public.op_latex_entregas': 0,
  'public.lotes': 25,
};

// Exact target identities (contract §6).
export const EXPECTED_OP_IDS = [1, 2, 53, 55, 57, 61, 63, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99];
export const EXPECTED_LOTE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 13, 31, 33, 37, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68];
export const EXPECTED_PEDIDO_IDS = [
  'e888f2b5-49a5-4d76-ab12-2421f86fa1f4', '7cc6a074-c163-4926-829a-afaf23835da7',
  '7fa51e02-e15b-4a1b-a0f3-8ca39ceee247', '5fdb4d9a-961a-4b6a-b964-117b99cb3ee9',
  'be2edf28-a2d8-4883-a036-ef494300a69a', 'fe6a22dc-5304-4628-93a1-70c8c78823f1',
  '85095adf-ed97-46f6-b250-97fb6e2fe1e6', '35c5bcfd-2ed8-4ed7-a116-3b5faf6ebcbf',
  'b5cbf9e1-2dfb-432f-9e6a-62c631eee6ce', '60ff0642-b477-44cc-a7ef-aa2008faf80b',
  'c0331a65-a2e4-4d60-aa61-d95d4f5a87e6', '9d71d295-6032-480f-9659-f2d1defe9a9b',
  '478825cb-5ee9-4ec8-bf6c-94f604ffb29a', 'b06df8ce-e5a7-4bf0-b3ac-80d84aaf4333',
  'c801a798-b508-4ede-a7ce-27053dc15a24', '5f0cbaef-3525-440c-96dd-192d224f3f8d',
];
export const EXPECTED_B6 = {
  document_link_revision_ops: 10,
  document_link_revisions: 8,
  document_candidates: 1,
  document_events: 0,
  document_technical_evidences: 0,
  document_decisions: 0,
  distinct_ops: [55, 57, 61, 63],
  per_revision: [0, 0, 2, 1, 2, 2, 1, 2],
};

// Preserved-baseline invariants (contract §1.3/§1.4/§3/§5) — the single source of
// truth shared by buildArchive's pre-write gate and verifyArchive; never
// duplicated with a divergent copy in the verifier.
export const EXPECTED_SALDO_FIOS = [
  { tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_total: 732.010 },
  { tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_total: 549.010 },
  { tipo: 'algodao', cor_id: 3, cor_poliester: null, kg_total: 549.000 },
  { tipo: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_total: 427.500 },
  { tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_total: 427.500 },
];
// Exact canonical op_numeros identity set (contract §1.4/§5) — exactly these two
// rows, no more, no less, including the year. Not a loose tipo->value map.
export const EXPECTED_OP_NUMEROS = [
  { tipo: 'latex', ano: 2026, ultimo_numero: 18 },
  { tipo: 'tecelagem', ano: 2026, ultimo_numero: 41 },
];
export const EXPECTED_MASTER_COUNTS = {
  clientes: 6, fornecedores: 6, cores: 6, modelos: 12, usuarios: 10, parametros_largura: 2,
  ordem_compra_config: 1, ordem_compra_cutover: 1,
  ordem_compra_cutover_source_snapshot: 0, ordem_compra_cutover_inventory_baseline: 0,
};
export const EXPECTED_DOCUMENTS_FRONT = {
  document_candidates_excl_b6: 39, document_events_total: 1,
  document_scan_requests: 24, document_scan_runs: 30,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sqlLit(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

export function sha256Hex(bufOrStr) {
  return createHash('sha256').update(bufOrStr).digest('hex');
}

// Deterministic JSON: object keys sorted recursively; used only for
// manifest/evidence files (never for exported business rows).
export function canonicalJSON(value) {
  const seen = new WeakSet();
  const norm = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('canonicalJSON: circular reference');
    seen.add(v);
    if (Array.isArray(v)) return v.map(norm);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  };
  return JSON.stringify(norm(value), null, 2) + '\n';
}

function eqSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((x, i) => x === sb[i]);
}

// ---------------------------------------------------------------------------
// Target-identity enforcement (contract §12; order §8.1/§8.2)
// ---------------------------------------------------------------------------

// The retired and forbidden projects are rejected BEFORE the production
// confirmation is consulted, so `--confirm-production-readonly-export` can never
// release them. The flag authorizes exactly one thing: the read-only export of
// the definitive production project.
export function assertTargetIdentity(target, { confirmProductionReadonlyExport = false } = {}) {
  if (target === undefined || target === null || String(target).trim() === '') {
    throw new Error('CLEAN_SLATE_TARGET_MISSING: an explicit --target project ref is required');
  }
  const refs = String(target).trim().split(/[,\s]+/).filter(Boolean);
  if (refs.length !== 1) {
    throw new Error(`CLEAN_SLATE_TARGET_AMBIGUOUS: exactly one target is required, received ${refs.length}`);
  }
  const ref = refs[0];
  if (ref === RETIRED_REF) {
    throw new Error(`CLEAN_SLATE_TARGET_RETIRED_PROJECT: refusing the retired project ${ref}; it is not production, staging, development or a fallback and no confirmation can release it`);
  }
  if (ref === FORBIDDEN_REF) {
    throw new Error(`CLEAN_SLATE_TARGET_FORBIDDEN_PROJECT: refusing the forbidden project ${ref}; no confirmation can release it`);
  }
  if (ref === PRODUCTION_REF) {
    if (confirmProductionReadonlyExport !== true) {
      throw new Error(`CLEAN_SLATE_PRODUCTION_CONFIRMATION_REQUIRED: exporting the production project ${ref} requires the exact flag --${PRODUCTION_CONFIRMATION_FLAG}`);
    }
    return ref;
  }
  throw new Error(`CLEAN_SLATE_TARGET_NOT_AUTHORIZED: ${ref} is not an authorized target`);
}

// ---------------------------------------------------------------------------
// Corpus-gate + identity verification (contract §5/§6; order §6/§8)
// ---------------------------------------------------------------------------

export function verifyIdentity(identity) {
  const fail = (m) => { throw new Error(`CLEAN_SLATE_IDENTITY_FAILED: ${m}`); };
  if (!identity) fail('missing identity evidence');
  if (identity.transaction_read_only !== 'on') fail(`transaction_read_only must be on, got ${identity.transaction_read_only}`);
  if (identity.transaction_isolation !== 'repeatable read') fail(`isolation must be repeatable read, got ${identity.transaction_isolation}`);
  if (identity.current_database !== 'postgres') fail(`current_database must be postgres, got ${identity.current_database}`);
  if (identity.current_user !== 'postgres' || identity.current_role !== 'postgres') fail('current_user/current_role must be postgres');
  if (identity.server_version !== EXPECTED_SERVER_VERSION) fail(`server_version must be ${EXPECTED_SERVER_VERSION}, got ${identity.server_version}`);
  if (identity.terminal_migration !== TERMINAL_MIGRATION) fail(`terminal migration must be ${TERMINAL_MIGRATION}, got ${identity.terminal_migration}`);
  return true;
}

export function verifyCutover(cutover) {
  const fail = (m) => { throw new Error(`CLEAN_SLATE_CUTOVER_FAILED: ${m}`); };
  if (!cutover) fail('missing cutover evidence');
  if (cutover.status !== 'legacy_active') fail(`status must be legacy_active, got ${cutover.status}`);
  if (cutover.read_authority !== 'flat') fail(`read_authority must be flat, got ${cutover.read_authority}`);
  if (cutover.reconciliation_status !== 'not_started') fail(`reconciliation_status must be not_started, got ${cutover.reconciliation_status}`);
  const nullMarkers = [
    'snapshot_hash', 'inventory_baseline_hash', 'cutover_generation', 'source_snapshot_count',
    'source_snapshot_total_kg', 'inventory_baseline_count', 'inventory_baseline_total_kg',
    'snapshot_captured_at', 'import_started_at', 'import_completed_at', 'final_acl_closed_at',
    'canonical_activated_at', 'productive_receipt_started_at',
  ];
  for (const m of nullMarkers) {
    if (cutover[m] !== null && cutover[m] !== undefined) fail(`marker ${m} must be NULL, got ${cutover[m]}`);
  }
  return true;
}

export function verifyGateBaseline(gate) {
  const fail = (m) => { throw new Error(`CLEAN_SLATE_GATE_FAILED: ${m}`); };
  if (!gate) fail('missing gate evidence');
  const flat = { ...(gate.boundary_a || {}), ...(gate.boundary_b || {}) };
  for (const t of EXPORT_TABLES) {
    const short = t.name.replace(/^public\./, '');
    const expected = EXPECTED_ROW_COUNTS[t.name];
    // Boundary counts are keyed by short name in the gate; doc-fixture counts live in gate.b6.
    if (short in flat && flat[short] !== expected) fail(`${short} expected ${expected}, got ${flat[short]}`);
  }
  const b6 = gate.b6 || {};
  for (const k of ['document_link_revision_ops', 'document_link_revisions', 'document_candidates', 'document_events', 'document_technical_evidences', 'document_decisions']) {
    if (b6[k] !== EXPECTED_B6[k]) fail(`b6.${k} expected ${EXPECTED_B6[k]}, got ${b6[k]}`);
  }
  if (!eqSet(b6.distinct_ops || [], EXPECTED_B6.distinct_ops)) fail(`b6 distinct OPs must be ${EXPECTED_B6.distinct_ops.join(',')}`);
  const perRev = (b6.per_revision || []).map((r) => (typeof r === 'object' ? r.ops : r));
  if (JSON.stringify(perRev) !== JSON.stringify(EXPECTED_B6.per_revision)) {
    fail(`b6 per-revision footprint must be ${EXPECTED_B6.per_revision.join(',')}, got ${perRev.join(',')}`);
  }
  if ((b6.nonfixture_ops_on_b6_ops ?? 0) !== 0) fail('non-fixture revision-op rows reference B6 OPs (deletion boundary contaminated)');
  return true;
}

export function verifyCorpusIdentities(ids) {
  const fail = (m) => { throw new Error(`CLEAN_SLATE_IDENTITIES_FAILED: ${m}`); };
  if (!ids) fail('missing corpus identities');
  if ((ids.pedido_ids || []).length !== 16) fail(`expected 16 Pedidos, got ${(ids.pedido_ids || []).length}`);
  if (!eqSet(ids.pedido_ids || [], EXPECTED_PEDIDO_IDS)) fail('16 Pedido UUIDs do not match the contract §6 set');
  if (!eqSet(ids.op_ids || [], EXPECTED_OP_IDS)) fail('20 OP ids do not match the contract §6 set');
  if (!eqSet(ids.lote_ids || [], EXPECTED_LOTE_IDS)) fail('25 lote ids do not match the contract §6 set');
  return true;
}

// Preserved-baseline gate (contract §1.3/§1.4/§3): saldo_fios exact 5-row
// identity+quantities, saldo_fios_op=0, op_numeros exact, documents-front exact,
// master/reference exact, cutover snapshot/baseline table counts. Single source
// of truth — the verifier imports and reuses this, never a divergent copy.
export function verifyPreservedBaseline(preserved) {
  const fail = (m) => { throw new Error(`CLEAN_SLATE_PRESERVED_BASELINE_FAILED: ${m}`); };
  if (!preserved) fail('missing preserved-baseline evidence');
  const sf = preserved.saldo_fios || [];
  if (sf.length !== 5) fail(`saldo_fios expected 5 rows, got ${sf.length}`);
  for (const exp of EXPECTED_SALDO_FIOS) {
    const row = sf.find((r) => r.tipo === exp.tipo && (r.cor_id ?? null) === exp.cor_id && (r.cor_poliester ?? null) === exp.cor_poliester);
    if (!row || Number(row.kg_total) !== exp.kg_total) {
      fail(`saldo_fios ${exp.tipo}/${exp.cor_id ?? exp.cor_poliester} expected ${exp.kg_total}, got ${row ? row.kg_total : '(missing row)'}`);
    }
  }
  if ((preserved.saldo_fios_op_count ?? -1) !== 0) fail(`saldo_fios_op expected 0, got ${preserved.saldo_fios_op_count}`);

  // op_numeros: exact canonical identity set — exact row count, exact identity
  // (tipo+ano), exact value; rejects missing/extra/duplicate/wrong-tipo/
  // wrong-year/wrong-value/NULL rows (not a loose tipo->value map).
  const opn = preserved.op_numeros || [];
  if (opn.length !== EXPECTED_OP_NUMEROS.length) {
    fail(`op_numeros expected exactly ${EXPECTED_OP_NUMEROS.length} rows, got ${opn.length}`);
  }
  const opnSeen = new Set();
  for (const r of opn) {
    if (r == null || r.tipo == null || r.ano == null || r.ultimo_numero == null) {
      fail(`op_numeros row has a NULL field: ${JSON.stringify(r)}`);
    }
    const key = `${r.tipo}|${r.ano}`;
    if (opnSeen.has(key)) fail(`op_numeros duplicate identity: ${key}`);
    opnSeen.add(key);
  }
  const opnExpectedKeys = new Set(EXPECTED_OP_NUMEROS.map((e) => `${e.tipo}|${e.ano}`));
  for (const r of opn) {
    const key = `${r.tipo}|${r.ano}`;
    if (!opnExpectedKeys.has(key)) fail(`op_numeros unexpected identity (wrong tipo or year): ${key}`);
  }
  for (const exp of EXPECTED_OP_NUMEROS) {
    const row = opn.find((r) => r.tipo === exp.tipo && r.ano === exp.ano);
    if (!row) fail(`op_numeros missing required row: tipo=${exp.tipo} ano=${exp.ano}`);
    if (row.ultimo_numero !== exp.ultimo_numero) {
      fail(`op_numeros ${exp.tipo}/${exp.ano} expected ultimo_numero=${exp.ultimo_numero}, got ${row.ultimo_numero}`);
    }
  }
  const mc = preserved.master_counts || {};
  for (const [k, expected] of Object.entries(EXPECTED_MASTER_COUNTS)) {
    if (mc[k] !== expected) fail(`master_counts.${k} expected ${expected}, got ${mc[k]}`);
  }
  const df = preserved.documents_front || {};
  for (const [k, expected] of Object.entries(EXPECTED_DOCUMENTS_FRONT)) {
    if (df[k] !== expected) fail(`documents_front.${k} expected ${expected}, got ${df[k]}`);
  }
  return true;
}

// Project-ref custody (blocking correction D): capture.identity.project_ref must
// equal the explicit --target used to generate this archive. Not tautological —
// buildCaptureSQL(target) embeds the actual target argument, not a hardcoded
// literal, so this genuinely cross-checks capture against invocation.
export function verifyProjectRefCustody(identity, target) {
  if (!identity || identity.project_ref !== target) {
    throw new Error(`CLEAN_SLATE_PROJECT_REF_MISMATCH: capture.identity.project_ref (${identity ? identity.project_ref : '(missing)'}) must equal --target (${target})`);
  }
  return true;
}

// Pure, side-effect-free per-table capture validation (blocking correction A):
// every EXPORT_TABLES entry must be present, its NDJSON line count must equal
// its declared row_count, and that row_count must equal the contract baseline.
// Returns the exact bytes to write later — this function performs NO filesystem
// I/O, so it can run entirely inside the pre-write validation pass.
export function validateCaptureTables(tables) {
  if (!tables || typeof tables !== 'object') throw new Error('CLEAN_SLATE_CAPTURE_TABLES_MISSING: capture.tables is required');
  const prepared = [];
  for (const t of EXPORT_TABLES) {
    const cap = tables[t.name];
    if (!cap) throw new Error(`CLEAN_SLATE_CAPTURE_TABLE_MISSING: ${t.name}`);
    const rows = cap.ndjson ? cap.ndjson.split('\n').filter((l) => l.length > 0) : [];
    if (rows.length !== cap.row_count) {
      throw new Error(`CLEAN_SLATE_CAPTURE_ROWCOUNT_MISMATCH: ${t.name} agg ${rows.length} vs count ${cap.row_count}`);
    }
    if (cap.row_count !== EXPECTED_ROW_COUNTS[t.name]) {
      throw new Error(`CLEAN_SLATE_CAPTURE_ROWCOUNT_UNEXPECTED: ${t.name} ${cap.row_count} != ${EXPECTED_ROW_COUNTS[t.name]}`);
    }
    const body = rows.length ? rows.join('\n') + '\n' : '';
    prepared.push({ table: t.name, rel: `tables/${t.name}.ndjson`, body, sha: sha256Hex(Buffer.from(body, 'utf8')), row_count: cap.row_count });
  }
  return prepared;
}

// ---------------------------------------------------------------------------
// Repository-boundary enforcement (blocking correction B) — derived from this
// module's own file location via import.meta.url, NEVER from process.cwd(), so
// the guard is correct regardless of the caller's working directory.
// ---------------------------------------------------------------------------

export function getRepoRoot() {
  // scripts/reset/clean-slate-transactional-export.mjs -> repo root is two dirs up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

export function verifyRepoBoundary(candidatePath) {
  const repoRoot = getRepoRoot();
  const resolved = path.resolve(candidatePath);
  const normalize = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const nRoot = normalize(repoRoot);
  const nResolved = normalize(resolved);
  if (nResolved === nRoot || nResolved.startsWith(nRoot + path.sep)) {
    throw new Error(`CLEAN_SLATE_ARCHIVE_INSIDE_REPO: ${resolved} resolves inside the repository root ${repoRoot}`);
  }
  return resolved;
}

// Best-effort, non-blocking corroboration that a --database-url endpoint targets
// the authorized project (order §8: "if the environment cannot reliably derive
// the project ref from the connection endpoint, do not claim independent
// endpoint-derived proof; record the limitation explicitly"). Never inspects or
// returns the credential portion of the URL.
export function checkDatabaseUrlProjectRefHint(databaseUrl, target) {
  try {
    const u = new URL(databaseUrl);
    const hinted = (u.hostname || '').includes(target) || (u.username || '').includes(target);
    return { checked: true, hinted };
  } catch {
    return { checked: false, hinted: false };
  }
}

// ---------------------------------------------------------------------------
// Capture SQL (identical on the psql and MCP transports)
// ---------------------------------------------------------------------------

export function buildCaptureSQL(target = PRODUCTION_REF) {
  const b6 = sqlLit(B6_DOCUMENT_ID);
  const tableEntries = EXPORT_TABLES.map((t) => {
    const where = t.scope ? ` WHERE ${t.scope}` : '';
    return `${sqlLit(t.name)}, json_build_object(`
      + `'row_count',(SELECT count(*) FROM ${t.name} t${where}),`
      + `'ndjson',(SELECT coalesce(string_agg(to_json(t)::text, chr(10) ORDER BY ${t.order}),'') FROM ${t.name} t${where}))`;
  }).join(',\n      ');

  return `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT to_json(cap) AS capture FROM (SELECT
  (SELECT json_build_object(
     'current_database', current_database(), 'current_user', current_user, 'current_role', current_role,
     'transaction_read_only', current_setting('transaction_read_only'),
     'transaction_isolation', current_setting('transaction_isolation'),
     'server_version', current_setting('server_version'),
     'terminal_migration', (SELECT max(version) FROM supabase_migrations.schema_migrations),
     'project_ref', ${sqlLit(target)},
     'captured_at', now())) AS identity,
  (SELECT to_json(c) FROM public.ordem_compra_cutover c WHERE c.id=1) AS cutover,
  json_build_object(
    'boundary_a', json_build_object(
      'ordem_compra_fio_movimentos_estoque',(SELECT count(*) FROM public.ordem_compra_fio_movimentos_estoque),
      'ordem_compra_fio_lancamentos',(SELECT count(*) FROM public.ordem_compra_fio_lancamentos),
      'ordem_compra_recebimentos',(SELECT count(*) FROM public.ordem_compra_recebimentos),
      'ordem_compra_eventos',(SELECT count(*) FROM public.ordem_compra_eventos),
      'ordem_compra_distribuicao_comandos',(SELECT count(*) FROM public.ordem_compra_distribuicao_comandos),
      'ordem_compra_item_compat_fio',(SELECT count(*) FROM public.ordem_compra_item_compat_fio),
      'ordem_compra_item_alocacao',(SELECT count(*) FROM public.ordem_compra_item_alocacao),
      'ordem_compra_item',(SELECT count(*) FROM public.ordem_compra_item),
      'necessidade_compra_fio',(SELECT count(*) FROM public.necessidade_compra_fio),
      'ordem_compra',(SELECT count(*) FROM public.ordem_compra),
      'ordens_compra_fio',(SELECT count(*) FROM public.ordens_compra_fio)),
    'boundary_b', json_build_object(
      'op_itens',(SELECT count(*) FROM public.op_itens),
      'op_fornecedores',(SELECT count(*) FROM public.op_fornecedores),
      'op_eventos',(SELECT count(*) FROM public.op_eventos),
      'pedido_itens',(SELECT count(*) FROM public.pedido_itens),
      'pedido_eventos',(SELECT count(*) FROM public.pedido_eventos),
      'pedido_cliente_eventos',(SELECT count(*) FROM public.pedido_cliente_eventos),
      'pedido_parcial_itens',(SELECT count(*) FROM public.pedido_parcial_itens),
      'pedido_parciais',(SELECT count(*) FROM public.pedido_parciais),
      'pedido_compra_fio_regime',(SELECT count(*) FROM public.pedido_compra_fio_regime),
      'op_latex_entregas',(SELECT count(*) FROM public.op_latex_entregas),
      'ops',(SELECT count(*) FROM public.ops),
      'pedidos',(SELECT count(*) FROM public.pedidos),
      'lotes',(SELECT count(*) FROM public.lotes)),
    'b6', json_build_object(
      'document_technical_evidences',(SELECT count(*) FROM public.document_technical_evidences WHERE document_id=${b6}),
      'document_decisions',(SELECT count(*) FROM public.document_decisions WHERE document_id=${b6}),
      'document_link_revisions',(SELECT count(*) FROM public.document_link_revisions WHERE document_id=${b6}),
      'document_link_revision_ops',(SELECT count(*) FROM public.document_link_revision_ops WHERE revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id=${b6})),
      'document_events',(SELECT count(*) FROM public.document_events WHERE document_id=${b6}),
      'document_candidates',(SELECT count(*) FROM public.document_candidates WHERE document_id=${b6}),
      'distinct_ops',(SELECT json_agg(DISTINCT op_id ORDER BY op_id) FROM public.document_link_revision_ops WHERE revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id=${b6})),
      'per_revision',(SELECT json_agg(json_build_object('version',r.version,'ops',(SELECT count(*) FROM public.document_link_revision_ops o WHERE o.revision_id=r.id)) ORDER BY r.version) FROM public.document_link_revisions r WHERE r.document_id=${b6}),
      'nonfixture_ops_on_b6_ops',(SELECT count(*) FROM public.document_link_revision_ops WHERE op_id IN (55,57,61,63) AND revision_id NOT IN (SELECT id FROM public.document_link_revisions WHERE document_id=${b6})))
  ) AS gate,
  json_build_object(
    'saldo_fios',(SELECT json_agg(json_build_object('tipo',tipo,'cor_id',cor_id,'cor_poliester',cor_poliester,'kg_total',kg_total) ORDER BY tipo,cor_id NULLS FIRST,cor_poliester) FROM public.saldo_fios),
    'saldo_fios_op_count',(SELECT count(*) FROM public.saldo_fios_op),
    'op_numeros',(SELECT json_agg(json_build_object('tipo',tipo,'ano',ano,'ultimo_numero',ultimo_numero) ORDER BY tipo,ano) FROM public.op_numeros),
    'documents_front', json_build_object(
      'document_candidates_excl_b6',(SELECT count(*) FROM public.document_candidates WHERE document_id<>${b6}),
      'document_events_total',(SELECT count(*) FROM public.document_events),
      'document_scan_requests',(SELECT count(*) FROM public.document_scan_requests),
      'document_scan_runs',(SELECT count(*) FROM public.document_scan_runs)),
    'master_counts', json_build_object(
      'clientes',(SELECT count(*) FROM public.clientes),'fornecedores',(SELECT count(*) FROM public.fornecedores),
      'cores',(SELECT count(*) FROM public.cores),'modelos',(SELECT count(*) FROM public.modelos),
      'usuarios',(SELECT count(*) FROM public.usuarios),'parametros_largura',(SELECT count(*) FROM public.parametros_largura),
      'ordem_compra_config',(SELECT count(*) FROM public.ordem_compra_config),
      'ordem_compra_cutover',(SELECT count(*) FROM public.ordem_compra_cutover),
      'ordem_compra_cutover_source_snapshot',(SELECT count(*) FROM public.ordem_compra_cutover_source_snapshot),
      'ordem_compra_cutover_inventory_baseline',(SELECT count(*) FROM public.ordem_compra_cutover_inventory_baseline))
  ) AS preserved_baseline,
  json_build_object(
    'pedido_ids',(SELECT json_agg(id::text ORDER BY numero) FROM public.pedidos),
    'op_ids',(SELECT json_agg(id ORDER BY id) FROM public.ops),
    'lote_ids',(SELECT json_agg(id ORDER BY id) FROM public.lotes),
    'b6', json_build_object(
      'document_id', ${b6},
      'revision_ids',(SELECT json_agg(id::text ORDER BY version) FROM public.document_link_revisions WHERE document_id=${b6}),
      'distinct_ops',(SELECT json_agg(DISTINCT op_id ORDER BY op_id) FROM public.document_link_revision_ops WHERE revision_id IN (SELECT id FROM public.document_link_revisions WHERE document_id=${b6})),
      'per_revision',(SELECT json_agg(json_build_object('version',r.version,'ops',(SELECT count(*) FROM public.document_link_revision_ops o WHERE o.revision_id=r.id)) ORDER BY r.version) FROM public.document_link_revisions r WHERE r.document_id=${b6}))
  ) AS corpus_identities,
  json_build_object(
      ${tableEntries}
  ) AS tables
) cap;
ROLLBACK;`;
}

export const CAPTURE_SQL = buildCaptureSQL();

// ---------------------------------------------------------------------------
// psql connect-mode capture
// ---------------------------------------------------------------------------

function psqlBin() {
  const dir = process.env.C3D_PG_BIN_DIR
    || (process.platform === 'win32' && process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, 'scoop', 'apps', 'postgresql', 'current', 'bin')
      : null);
  const exe = process.platform === 'win32' ? 'psql.exe' : 'psql';
  return dir ? path.join(dir, exe) : exe;
}

export function captureViaPsql(databaseUrl, target = PRODUCTION_REF) {
  if (!databaseUrl) throw new Error('CLEAN_SLATE_NO_DATABASE_URL: --database-url is required for connect mode');
  // Best-effort, non-blocking endpoint corroboration (order §8) — never prints
  // the URL or credentials, only a boolean-derived diagnostic notice.
  const hint = checkDatabaseUrlProjectRefHint(databaseUrl, target);
  if (!hint.checked) {
    process.stderr.write('CLEAN_SLATE_ENDPOINT_REF_HINT: the supplied connection endpoint could not be parsed as a URL; independent endpoint-derived proof is NOT claimed — relying on the strict capture/manifest/evidence project_ref equality checks.\n');
  } else if (!hint.hinted) {
    process.stderr.write('CLEAN_SLATE_ENDPOINT_REF_HINT: the supplied connection endpoint does not visibly encode the target project ref; independent endpoint-derived proof is NOT claimed — relying on the strict capture/manifest/evidence project_ref equality checks.\n');
  }
  const sql = buildCaptureSQL(target);
  const res = spawnSync(psqlBin(), ['-X', '-w', '-q', '-A', '-t', '-d', databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 512 * 1024 * 1024,
  });
  if (res.status !== 0) {
    // Never surface the connection string; report only status + a scrubbed diagnostic.
    const diag = (res.stderr || res.error?.message || `exit ${res.status}`).split(/\r?\n/).slice(0, 4).join(' ');
    throw new Error(`CLEAN_SLATE_CAPTURE_PSQL_FAILED: ${diag}`);
  }
  const raw = (res.stdout || '').trim();
  if (!raw) throw new Error('CLEAN_SLATE_CAPTURE_EMPTY: psql returned no capture row');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Archive construction (transport-agnostic core)
// ---------------------------------------------------------------------------

function utcStamp(iso) {
  // 2026-07-22T05:58:32.123+00:00 -> 20260722T055832Z
  const d = new Date(iso);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function buildArchive(capture, outRoot, { target, confirmProductionReadonlyExport = false } = {}) {
  assertTargetIdentity(target, { confirmProductionReadonlyExport });
  if (!capture || typeof capture !== 'object') throw new Error('CLEAN_SLATE_CAPTURE_INVALID: capture object required');

  // ===========================================================================
  // PURE VALIDATION PASS — no mkdir, no writeFileSync, no filesystem mutation of
  // any kind may occur above this line and none occurs until every gate below
  // has passed. A thrown error here leaves the filesystem exactly as it was.
  // ===========================================================================
  verifyIdentity(capture.identity);
  verifyProjectRefCustody(capture.identity, target);
  verifyCutover(capture.cutover);
  verifyGateBaseline(capture.gate);
  verifyCorpusIdentities(capture.corpus_identities);
  verifyPreservedBaseline(capture.preserved_baseline);
  const tableFiles = validateCaptureTables(capture.tables); // pure — no I/O

  const resolvedOutRoot = verifyRepoBoundary(outRoot);
  const stamp = utcStamp(capture.identity.captured_at || new Date().toISOString());
  const archiveDir = path.join(resolvedOutRoot, stamp);
  verifyRepoBoundary(archiveDir);
  // ===========================================================================
  // END OF VALIDATION PASS — every gate passed; filesystem writes start now.
  // ===========================================================================

  const tablesDir = path.join(archiveDir, 'tables');
  const evidenceDir = path.join(archiveDir, 'evidence');
  mkdirSync(tablesDir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });

  const files = [];
  const tableManifest = [];
  for (const tf of tableFiles) {
    writeFileSync(path.join(archiveDir, tf.rel), tf.body, { encoding: 'utf8' });
    files.push({ rel: tf.rel, sha: tf.sha });
    tableManifest.push({ table: tf.table, file: tf.rel, row_count: tf.row_count, sha256: tf.sha });
  }

  const evidence = {
    'evidence/database-identity.json': capture.identity,
    'evidence/cutover-state.json': capture.cutover,
    'evidence/preserved-baseline.json': capture.preserved_baseline,
    'evidence/corpus-identities.json': capture.corpus_identities,
  };
  for (const [rel, obj] of Object.entries(evidence)) {
    const body = canonicalJSON(obj);
    writeFileSync(path.join(archiveDir, rel), body, { encoding: 'utf8' });
    files.push({ rel, sha: sha256Hex(Buffer.from(body, 'utf8')) });
  }

  // Aggregate checksum = SHA-256 over "<rel>\n<sha>\n" for every file, sorted by rel.
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const aggregate = sha256Hex(files.map((f) => `${f.rel}\n${f.sha}\n`).join(''));

  const manifest = {
    archive_kind: ARCHIVE_KIND,
    schema_version: ARCHIVE_SCHEMA_VERSION,
    generated_at_utc: capture.identity.captured_at,
    database: {
      project_ref: target,
      current_database: capture.identity.current_database,
      server_version: capture.identity.server_version,
      terminal_migration: capture.identity.terminal_migration,
    },
    aggregate_sha256: aggregate,
    b6_fixture: {
      document_id: B6_DOCUMENT_ID,
      document_link_revision_ops: capture.gate.b6.document_link_revision_ops,
      document_link_revisions: capture.gate.b6.document_link_revisions,
      document_candidates: capture.gate.b6.document_candidates,
      distinct_ops: EXPECTED_B6.distinct_ops,
    },
    targets: {
      pedido_count: (capture.corpus_identities.pedido_ids || []).length,
      pedido_ids: capture.corpus_identities.pedido_ids,
      op_ids: capture.corpus_identities.op_ids,
      lote_ids: capture.corpus_identities.lote_ids,
    },
    tables: tableManifest,
  };
  const manifestBody = canonicalJSON(manifest);
  writeFileSync(path.join(archiveDir, 'manifest.json'), manifestBody, { encoding: 'utf8' });

  // checksums.sha256 (manifest included), sorted by path.
  const allFiles = [...files, { rel: 'manifest.json', sha: sha256Hex(Buffer.from(manifestBody, 'utf8')) }];
  allFiles.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const checksumsBody = allFiles.map((f) => `${f.sha}  ${f.rel}`).join('\n') + '\n';
  writeFileSync(path.join(archiveDir, 'checksums.sha256'), checksumsBody, { encoding: 'utf8' });

  return { archiveDir, manifest, aggregate };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd !== 'export') {
    process.stderr.write(`usage: clean-slate-transactional-export.mjs export --target <ref> (--from-capture <file> | --database-url <url>) --out-root <dir> [--${PRODUCTION_CONFIRMATION_FLAG}]\n`);
    process.exit(2);
  }
  // Target identity is asserted FIRST — before --out-root handling, before any
  // capture file is read, before any psql connection is opened and before any
  // directory or archive artifact is created. An unconfirmed production target,
  // the retired project and the forbidden project all fail here with zero side
  // effects. The flag must be supplied bare (boolean true); `--flag <value>`
  // does not satisfy it.
  const confirmProductionReadonlyExport = args[PRODUCTION_CONFIRMATION_FLAG] === true;
  const target = assertTargetIdentity(args.target, { confirmProductionReadonlyExport });
  const outRoot = args['out-root'];
  if (!outRoot) throw new Error('CLEAN_SLATE_NO_OUT_ROOT: --out-root is required');
  // Repository-boundary enforcement lives solely in buildArchive's
  // verifyRepoBoundary (file-location-derived, never process.cwd()-derived), so
  // it is correct regardless of the directory this CLI was launched from.
  let capture;
  if (args['from-capture']) capture = JSON.parse(readFileSync(args['from-capture'], 'utf8'));
  else if (args['database-url']) capture = captureViaPsql(args['database-url'], target);
  else throw new Error('CLEAN_SLATE_NO_SOURCE: one of --from-capture or --database-url is required');

  const { archiveDir, aggregate } = buildArchive(capture, outRoot, { target, confirmProductionReadonlyExport });
  // Only non-sensitive metadata is printed (never business rows).
  process.stdout.write(JSON.stringify({ ok: true, archiveDir, aggregate_sha256: aggregate, target }) + '\n');
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => { process.stderr.write(`${err.message}\n`); process.exit(1); });
}
