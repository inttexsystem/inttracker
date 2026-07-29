// tests/cliente-pedido-structural-capability-invariant.mjs
//
// PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1-C1-SCHEMA disposable-cluster proof
// of db/94_cliente_pedido_structural_capability.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic and is
// built inside the disposable cluster; NO production data is used.
//
// WHY THIS FILE EXISTS AND DOES NOT EXTEND AN OLDER HARNESS
//   tests/pedido-unified-edit-change-approval-invariant.mjs and
//   tests/pedido-change-approval-helper-privilege-invariant.mjs are the FROZEN
//   phase harnesses of db/92 and db/93 and pin EXPECTED_TERMINAL = 93. They are
//   accepted-checkpoint evidence and this order does not re-point them, exactly
//   as db/91..db/93 did not re-point the db/89 and db/90 harnesses. The static
//   file guards for db/94 live in the existing owner
//   tests/pedido-unified-edit-change-approval-schema.smoke.js; only the
//   BEHAVIOURAL proof needs a cluster, and that is this file.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   A  db/01..db/94 apply cleanly, in order, and db/94 is the terminal. The
//      BASELINE responses of cliente_alteracao_resumo are captured on the
//      db/92+db/93 state immediately BEFORE db/94 is applied, so shape
//      preservation is MEASURED, not asserted.
//   B  db/94 replays idempotently: identical function definition, identical
//      ACL fingerprint, identical response bytes, zero row-count drift.
//   C  db/94 fails closed when a prerequisite is absent, naming it.
//   D  the seven POSITIVE capability cases of the order. Paths are isolated
//      wherever the accepted schema allows it; where it does not (expedicoes
//      requires its own lote lineage since db/84, and expedicao_itens must
//      mirror its op_item's pedido_item_id since db/83/db/88), the coupling
//      is proved explicitly rather than assumed away.
//   E  the two NEGATIVE cases: another client's Pedido and an absent Pedido —
//      the existing error shape, with NO capability leak.
//   F  pendente shape, historico shape and historico ORDERING are byte-identical
//      to the captured pre-db/94 baseline.
//   G  effective privileges: authenticated executes the RPC, anon does not, and
//      NONE of anon/authenticated/service_role executes the owner-only helper;
//      the owner still executes both.
//   H  no internal production data is exposed: the response key set is exactly
//      the five accepted keys and `capacidades` carries exactly one boolean.
//   I  the exposed capability EQUALS the authoritative helper for every fixture.
//   Z  mandatory full cluster destruction.
//
// Run:  node tests/cliente-pedido-structural-capability-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 94;
const DB94 = '94_cliente_pedido_structural_capability.sql';

// The db/92 phase harness already owns the platform preamble, the db/67 corpus
// and the actor fixture. Reusing its literals keeps ONE definition of each and
// guarantees this suite cannot silently drift from the phase it extends.
const parent = fs.readFileSync(
  path.join(REPO_ROOT, 'tests', 'pedido-unified-edit-change-approval-invariant.mjs'), 'utf8');
const between = (open, close) => parent.split(open)[1].split(close)[0];
const PREAMBLE_SQL = between('const PREAMBLE_SQL = `', '`;');
const CORPUS_SQL = between('const CORPUS_SQL = `', '`;');

const CLI_A = 960000101;
const CLI_B = 960000102;
const MOD_A = 960000201;
const MOD_B = 960000202;
const ADMIN_UID = '00000000-0000-4000-8000-0000000000a1';
const CLIENT_UID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_UID = '00000000-0000-4000-8000-0000000000c2';
const FORN_UID = '00000000-0000-4000-8000-0000000000f1';
const ABSENT_PEDIDO = '00000000-0000-4000-8000-0000dead0001';

const ATORES_SQL = between('const ATORES_SQL = `', '`;')
  .replace(/\$\{CLI_A\}/g, String(CLI_A)).replace(/\$\{CLI_B\}/g, String(CLI_B))
  .replace(/\$\{MOD_A\}/g, String(MOD_A)).replace(/\$\{MOD_B\}/g, String(MOD_B))
  .replace(/\$\{ADMIN_UID\}/g, ADMIN_UID)
  .replace(/\$\{CLIENT_UID\}/g, CLIENT_UID)
  .replace(/\$\{OTHER_UID\}/g, OTHER_UID)
  .replace(/\$\{FORN_UID\}/g, FORN_UID);

// The RPC under correction and the owner-only gate it now exposes.
const RPC = 'public.cliente_alteracao_resumo(uuid)';
const HELPER = 'public.pedido_tem_op_relacionada(uuid)';

// Every table db/94 must leave untouched.
const NO_DRIFT_TABLES = [
  'pedidos', 'pedido_itens', 'ops', 'op_itens', 'expedicoes', 'expedicao_itens',
  'pedido_alteracao_solicitacoes', 'pedido_alteracao_solicitacao_itens',
  'pedido_eventos', 'pedido_cliente_eventos', 'pedido_prioridade_eventos',
];

// ---------------------------------------------------------------------------
let FAILURES = 0;
function check(cond, msg) {
  if (cond) return true;
  FAILURES += 1;
  throw new Error(`PROOF FAILED: ${msg}`);
}
function log(tag, obj) {
  const body = obj && typeof obj === 'object'
    ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('|') : String(obj ?? '');
  console.log(body ? `${tag}|${body}` : tag);
}
const psqlBinary = h => path.join(h.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
const baseArgs = h => ['-X', '-w', '-q', '-A', '-t', '-h', h.host, '-p', String(h.port),
  '-U', h.user, '-d', h.database];

function applyFile(h, file, label) {
  const r = spawnSync(psqlBinary(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-f', file],
    { encoding: 'utf8', timeout: 240000 });
  if (r.status !== 0) {
    throw new Error(`APPLY_FAILED (${label || file}): ${r.error ? r.error.message : (r.stderr || r.stdout)}`);
  }
  return r.stdout || '';
}
function applyFileExpectFailure(h, file, label) {
  const r = spawnSync(psqlBinary(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-f', file],
    { encoding: 'utf8', timeout: 240000 });
  check(r.status !== 0, `${label}: deveria falhar fechado, mas aplicou`);
  return (r.stderr || '').split('\n').filter(Boolean)[0] || '';
}
let SCRATCH = null;
async function applySql(h, name, sql, label) {
  const f = path.join(SCRATCH, name);
  await writeFile(f, sql, 'utf8');
  return applyFile(h, f, label || name);
}
function run(h, sql) {
  const r = spawnSync(psqlBinary(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8', timeout: 90000 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function scalar(h, sql) {
  const r = run(h, sql);
  if (!r.ok) throw new Error(`QUERY_FAILED: ${r.err || r.out}`);
  return r.out;
}
function must(h, sql, label) {
  const r = run(h, sql);
  check(r.ok, `FIXTURE ${label}: ${r.err || r.out}`);
  return r;
}
const isTrue = v => v === 't' || v === 'true';
const asRole = (uid, sql, role = 'authenticated') =>
  `BEGIN; SET LOCAL ROLE ${role}; ${uid ? `SET LOCAL request.jwt.claim.sub = '${uid}';` : ''} ${sql} COMMIT;`;

function canExecute(h, role, signature) {
  return isTrue(scalar(h,
    `SELECT has_function_privilege('${role}', to_regprocedure('${signature}')::oid, 'EXECUTE');`));
}
// Direct invocation as an application role. Returns the first error line, or
// null when the call was ACCEPTED.
function callAs(h, uid, sql, role = 'authenticated') {
  const r = run(h, asRole(uid, sql, role));
  return r.ok ? null : (r.err.split('\n').filter(Boolean)[0] || 'error');
}

// The RPC response, as the owning client, parsed. `jsonb` output is already
// key-normalized by PostgreSQL, so a key-set comparison is exact.
function resumo(h, pedidoId, uid = CLIENT_UID) {
  const raw = scalar(h, asRole(uid, `SELECT public.cliente_alteracao_resumo('${pedidoId}')::text;`));
  return JSON.parse(raw);
}
// Owner-side authoritative truth, for the equality proof of Part I.
const helperSays = (h, pedidoId) =>
  isTrue(scalar(h, `SELECT public.pedido_tem_op_relacionada('${pedidoId}');`));

function aclFingerprint(h) {
  return scalar(h, `
    WITH t AS (
      SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||
             r.rolname||'='||has_function_privilege(r.rolname, p.oid, 'EXECUTE')::text AS line
        FROM pg_proc p
        CROSS JOIN (SELECT unnest(ARRAY['anon','authenticated','service_role','postgres']) AS rolname) r
       WHERE p.oid IN (to_regprocedure('${RPC}')::oid, to_regprocedure('${HELPER}')::oid)
    ) SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
}
const functionDef = h => scalar(h, `SELECT md5(pg_get_functiondef(to_regprocedure('${RPC}')::oid));`);
function rowCounts(h) {
  return scalar(h, `SELECT string_agg(t||'='||c, ',' ORDER BY t) FROM (
    ${NO_DRIFT_TABLES.map(t => `SELECT '${t}' AS t, (SELECT count(*) FROM public.${t}) AS c`).join(' UNION ALL ')}
  ) s;`);
}

async function resolveManifest() {
  const dir = path.join(REPO_ROOT, 'db');
  return (await readdir(dir))
    .filter(f => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map(f => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dir, f) }))
    .sort((a, b) => a.n - b.n);
}

// ---------------------------------------------------------------------------
// Fixtures. Each linkage path is built in ISOLATION so a `true` can only be
// attributed to the one path under test.
// ---------------------------------------------------------------------------
function novoPedido(h, clienteId, status) {
  const id = scalar(h, `
    WITH p AS (INSERT INTO public.pedidos (cliente_id, status, data_pedido, prazo_entrega, observacao)
      VALUES (${clienteId}, '${status}', DATE '2026-03-01', DATE '2026-04-01', 'obs inicial') RETURNING id)
    SELECT id FROM p;`);
  must(h, `INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem)
    VALUES ('${id}', ${MOD_A}, 10.00, 0), ('${id}', ${MOD_B}, 20.00, 1);`, 'itens');
  return id;
}
const itemIds = (h, p) => scalar(h,
  `SELECT string_agg(id::text, ',' ORDER BY ordem) FROM public.pedido_itens WHERE pedido_id='${p}';`)
  .split(',').filter(Boolean);

// Path 1: ops -> lotes.pedido_id. NO op_itens.pedido_item_id, so ONLY the lote
// path can make the gate true.
function linkViaLote(h, pedidoId, { opId, loteId, numero, status }) {
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
    VALUES (${loteId}, ${numero}, ${CLI_A}, '${pedidoId}');`, `lote ${loteId}`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id)
    VALUES (${opId}, ${numero}, 2099, '${status}', 'tecelagem', ${loteId});`, `op ${opId}`);
}

// Path 3: expedicoes.pedido_id directly. db/84's lineage correction (applied
// AFTER this order's baseline, discovered while proving this fixture) requires
// an expedition's source OP to carry a Lote, and that Lote's pedido_id/
// cliente_id must equal the expedition's own pedido_id/cliente_id exactly
// (expedicoes_source_validation_guard_fn). So a real expedicoes.pedido_id
// linkage NECESSARILY co-occurs with an ops-via-lotes.pedido_id linkage for
// the SAME Pedido: the schema makes paths 1 and 3 inseparable by
// construction, not a gap in this fixture. Isolation is still proved against
// paths 2, 4 and 5, which remain independent.
function linkViaExpedicao(h, pedidoId, { opId, expId, loteId, numero }) {
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
    VALUES (${loteId}, ${numero}, ${CLI_A}, '${pedidoId}');`, `lote ${loteId}`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id)
    VALUES (${opId}, ${numero}, 2099, 'aberta', 'latex', ${loteId});`, `op latex ${opId}`);
  // A non-empty, homogeneous (default tipo_produto='tapete') item is required
  // for a latex source OP; unrelated to the SUBJECT Pedido's own items.
  must(h, `INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
    VALUES (${opId}, ${MOD_A}, 10.00, NULL);`, `op_item for op ${opId}`);
  must(h, `INSERT INTO public.expedicoes (id, pedido_id, op_latex_id, lote_id, cliente_id)
    VALUES (${expId}, '${pedidoId}', ${opId}, ${loteId}, ${CLI_A});`, `expedicao ${expId}`);
}

// Path 2: op_itens.pedido_item_id where the owning OP has NO lote at all, so the
// item reference is the ONLY thing that identifies the Pedido.
function linkViaOpItem(h, itemId, { opId, numero }) {
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id)
    VALUES (${opId}, ${numero}, 2099, 'aberta', 'tecelagem', NULL);`, `op ${opId}`);
  must(h, `INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
    VALUES (${opId}, ${MOD_A}, 10.00, '${itemId}');`, `op_item ${opId}`);
}

// Path 4: expedicao_itens.pedido_item_id where the owning expedition belongs to a
// DIFFERENT Pedido (donoPedidoId), so the SUBJECT Pedido gains no lote/expedicao
// linkage of its own. `expedicao_itens_membership_guard_fn` (db/88) requires
// expedicao_itens.pedido_item_id to MIRROR its op_item's own pedido_item_id
// exactly ("identidade divergente rejeitada"), so this fixture necessarily also
// satisfies the op_itens.pedido_item_id join for the SAME row -- paths 4 and 5
// cannot be separated on this schema, by the same accepted db/83/db/88
// item-identity invariant that makes paths 1 and 3 inseparable (see
// linkViaExpedicao). The owning expedition still needs the db/84 lineage (its
// OWN Lote, matching donoPedidoId), which is unrelated to the subject Pedido.
function linkViaExpedicaoItem(h, itemId, { opId, expId, loteId, numero, donoPedidoId }) {
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
    VALUES (${loteId}, ${numero}, ${CLI_A}, '${donoPedidoId}');`, `lote ${loteId}`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id)
    VALUES (${opId}, ${numero}, 2099, 'aberta', 'latex', ${loteId});`, `op latex ${opId}`);
  const opItem = scalar(h, `INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
    VALUES (${opId}, ${MOD_A}, 10.00, '${itemId}') RETURNING id;`);
  must(h, `INSERT INTO public.expedicoes (id, pedido_id, op_latex_id, lote_id, cliente_id)
    VALUES (${expId}, '${donoPedidoId}', ${opId}, ${loteId}, ${CLI_A});`, `expedicao ${expId}`);
  must(h, `INSERT INTO public.expedicao_itens
      (expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados)
    VALUES (${expId}, ${opItem}, '${itemId}', ${MOD_A}, 5.00);`, `expedicao_item ${expId}`);
}

// ===========================================================================
// The fixture set, and the baseline captured on the db/92+db/93 state.
// ===========================================================================
const F = {};        // fixture ids
let BASELINE = null; // pre-db/94 responses

// Built while the cluster is still at db/93, so the baseline is real.
function construirFixtures(h) {
  // D1 — own Pedido, no linkage whatsoever.
  F.semVinculo = novoPedido(h, CLI_A, 'confirmado');

  // D2 — ops via lotes.pedido_id only.
  F.viaLote = novoPedido(h, CLI_A, 'confirmado');
  linkViaLote(h, F.viaLote, { opId: 970000101, loteId: 970000201, numero: 970101, status: 'aberta' });

  // D3 — expedicoes.pedido_id, via its OWN db/84-required lote lineage (this
  // necessarily also satisfies path 1 for the SAME Pedido; see the comment on
  // linkViaExpedicao).
  F.viaExpedicao = novoPedido(h, CLI_A, 'confirmado');
  linkViaExpedicao(h, F.viaExpedicao, { opId: 970000102, expId: 970000301, loteId: 970000211, numero: 970102 });

  // D4 — op_itens.pedido_item_id only.
  F.viaOpItem = novoPedido(h, CLI_A, 'confirmado');
  linkViaOpItem(h, itemIds(h, F.viaOpItem)[0], { opId: 970000103, numero: 970103 });

  // D5 — expedicao_itens.pedido_item_id, via its OWN db/88-required identity
  // mirror to op_itens.pedido_item_id (this necessarily also satisfies the
  // op_itens.pedido_item_id join for the SAME row; see linkViaExpedicaoItem).
  // The owning expedition belongs to D3's Pedido, which is already `true` for
  // its own reason, so the SUBJECT Pedido gains no lote/expedicao linkage.
  F.viaExpedicaoItem = novoPedido(h, CLI_A, 'confirmado');
  linkViaExpedicaoItem(h, itemIds(h, F.viaExpedicaoItem)[0],
    { opId: 970000104, expId: 970000302, loteId: 970000212, numero: 970104, donoPedidoId: F.viaExpedicao });

  // D6 — simulada OP. D7 — cancelada OP. Both count.
  F.simulada = novoPedido(h, CLI_A, 'confirmado');
  linkViaLote(h, F.simulada, { opId: 970000105, loteId: 970000202, numero: 970105, status: 'simulada' });
  F.cancelada = novoPedido(h, CLI_A, 'confirmado');
  linkViaLote(h, F.cancelada, { opId: 970000106, loteId: 970000203, numero: 970106, status: 'cancelada' });

  // E8 — another client's Pedido.
  F.alheio = novoPedido(h, CLI_B, 'confirmado');

  // F — a Pedido carrying ONE pending request and THREE decided ones, so
  // historico shape AND ordering are provable. Built through the accepted RPCs,
  // never by direct DML.
  F.comSolicitacoes = novoPedido(h, CLI_A, 'confirmado');
  const sub = (msg) => scalar(h, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${F.comSolicitacoes}', '{"observacao":"${msg}"}'::jsonb, NULL, NULL, '${msg}')->>'solicitacao_id');`));
  const s1 = sub('rejeitada-1');
  must(h, asRole(ADMIN_UID, `SELECT public.rejeitar_alteracao_pedido('${s1}', 'nao');`), 'rejeitar s1');
  const s2 = sub('retirada-2');
  must(h, asRole(CLIENT_UID, `SELECT public.retirar_alteracao_pedido('${s2}');`), 'retirar s2');
  const s3 = sub('aprovada-3');
  must(h, asRole(ADMIN_UID, `SELECT public.aprovar_alteracao_pedido('${s3}', false, 'ok');`), 'aprovar s3');
  sub('pendente-4');

  log('FIXTURES', {
    semVinculo: 1, viaLote: 1, viaExpedicao: 1, viaOpItem: 1, viaExpedicaoItem: 1,
    simulada: 1, cancelada: 1, alheio: 1, comSolicitacoes: '1 pendente + 3 decididas',
  });
}

// Captured at db/93, BEFORE db/94 exists. This is what "preserved" is measured
// against.
function capturarBaseline(h) {
  const antes = resumo(h, F.comSolicitacoes);
  check(antes.capacidades === undefined,
    'db/93 NAO pode ter capacidades; o baseline estaria contaminado');
  BASELINE = {
    chaves: Object.keys(antes).sort(),
    pendente: antes.pendente,
    historico: antes.historico,
    naoEncontrado: resumo(h, ABSENT_PEDIDO),
    proibido: resumo(h, F.alheio),
  };
  check(BASELINE.historico.length === 3, `o baseline deve ter 3 decididas (got ${BASELINE.historico.length})`);
  log('BASELINE', {
    at: 'db/93', chaves: BASELINE.chaves.join('+'),
    pendente: Object.keys(BASELINE.pendente).sort().join('+'),
    historico: `${BASELINE.historico.length} itens`,
  });
}

// ===========================================================================
// PART A — chain apply through db/94, with the baseline taken at db/93.
// ===========================================================================
async function partA(h) {
  const manifest = await resolveManifest();
  check(manifest.length === EXPECTED_TERMINAL,
    `manifest deve ser db/01..db/${EXPECTED_TERMINAL} (got ${manifest.length})`);
  check(manifest.at(-1).n === EXPECTED_TERMINAL, `migration terminal deve ser db/${EXPECTED_TERMINAL}`);
  check(path.basename(manifest.at(-1).file) === DB94, `terminal deve ser ${DB94}`);

  await applySql(h, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(h, 'corpus.sql', CORPUS_SQL, 'corpus');
    if (n === 94) {
      // The db/92+db/93 state is the ONLY place the baseline can be taken.
      await applySql(h, 'atores.sql', ATORES_SQL, 'atores');
      construirFixtures(h);
      capturarBaseline(h);
    }
    applyFile(h, file, path.basename(file));
  }
  log('A', { migrations: manifest.length, terminal: EXPECTED_TERMINAL, applied: 'clean' });
}

// ===========================================================================
// PART B — idempotent replay: no definition, ACL or data drift.
// ===========================================================================
function partB(h) {
  const def = functionDef(h);
  const acl = aclFingerprint(h);
  const counts = rowCounts(h);
  const resp = JSON.stringify(resumo(h, F.comSolicitacoes));

  applyFile(h, path.join(REPO_ROOT, 'db', DB94), 'db/94 replay 1');
  applyFile(h, path.join(REPO_ROOT, 'db', DB94), 'db/94 replay 2');

  check(functionDef(h) === def, 'db/94 deve reaplicar sem mudar a definicao da funcao');
  check(aclFingerprint(h) === acl, 'db/94 deve reaplicar sem drift de ACL');
  check(rowCounts(h) === counts, 'db/94 nao pode criar, alterar ou remover linha alguma');
  check(JSON.stringify(resumo(h, F.comSolicitacoes)) === resp,
    'a resposta da RPC deve ser identica apos o replay');
  log('B', { replays: 2, defDrift: 'none', aclDrift: 'none', dataDrift: 'none', respostaIdentica: true });
}

// ===========================================================================
// PART C — db/94 fails closed on a missing prerequisite.
// ===========================================================================
function partC(h) {
  // C1: the authoritative gate itself is absent.
  must(h, 'ALTER FUNCTION public.pedido_tem_op_relacionada(UUID) RENAME TO pedido_tem_op_relacionada_oculto;',
    'esconder helper');
  const errHelper = applyFileExpectFailure(h, path.join(REPO_ROOT, 'db', DB94), 'db/94 sem helper');
  check(/db\/94 gate/i.test(errHelper) && /pedido_tem_op_relacionada/i.test(errHelper),
    `o gate deve nomear o helper ausente (got ${errHelper})`);
  must(h, 'ALTER FUNCTION public.pedido_tem_op_relacionada_oculto(UUID) RENAME TO pedido_tem_op_relacionada;',
    'restaurar helper');

  // C2: db/93's privilege state is absent (the helper is open again).
  must(h, `GRANT EXECUTE ON FUNCTION ${HELPER} TO authenticated;`, 'reabrir helper');
  const errAcl = applyFileExpectFailure(h, path.join(REPO_ROOT, 'db', DB94), 'db/94 sem db/93');
  check(/db\/94 gate/i.test(errAcl) && /authenticated/i.test(errAcl),
    `o gate deve recusar o estado de privilegio de db/93 ausente (got ${errAcl})`);
  must(h, `REVOKE EXECUTE ON FUNCTION ${HELPER} FROM authenticated;`, 'refechar helper');

  applyFile(h, path.join(REPO_ROOT, 'db', DB94), 'db/94 apos restauracao');
  log('C', { gate: 'fail-closed', casos: 'helper ausente + db/93 ausente', restaurado: true });
}

// ===========================================================================
// PART D + I — the seven positive capability cases, each path isolated, and
// equality with the authoritative owner.
// ===========================================================================
function partDI(h) {
  const casos = [
    ['1 sem vinculo', F.semVinculo, false],
    ['2 op via lote.pedido_id', F.viaLote, true],
    ['3 expedicoes.pedido_id', F.viaExpedicao, true],
    ['4 op_itens.pedido_item_id', F.viaOpItem, true],
    ['5 expedicao_itens.pedido_item_id', F.viaExpedicaoItem, true],
    ['6 OP simulada', F.simulada, true],
    ['7 OP cancelada', F.cancelada, true],
  ];
  for (const [nome, pedidoId, esperado] of casos) {
    const r = resumo(h, pedidoId);
    check(r.ok === true, `${nome}: a resposta deve ser ok`);
    check(typeof r.capacidades === 'object' && r.capacidades !== null,
      `${nome}: capacidades deve existir`);
    check(r.capacidades.estrutura_itens_bloqueada === esperado,
      `${nome}: estrutura_itens_bloqueada deveria ser ${esperado} (got ${r.capacidades.estrutura_itens_bloqueada})`);
    // PART I: the client-visible value IS the owner's value, never a copy that
    // may drift.
    check(helperSays(h, pedidoId) === esperado,
      `${nome}: o helper autoritativo deveria dizer ${esperado}`);
    check(r.capacidades.estrutura_itens_bloqueada === helperSays(h, pedidoId),
      `${nome}: a capacidade exposta deve ser IGUAL ao gate autoritativo`);
  }

  // Isolation is proved, not assumed: for each fixture, exactly the intended
  // source table(s) carry the link. viaExpedicao carries BOTH lote and exp by
  // construction: db/84's lineage correction requires an expedition's source
  // OP to carry a Lote belonging to the SAME Pedido (see linkViaExpedicao), so
  // paths 1 and 3 cannot be separated for one fixture on this schema. Paths 2,
  // 4 and 5 remain independently isolated.
  const isolamento = (pedidoId) => ({
    lote: Number(scalar(h, `SELECT count(*) FROM public.ops o JOIN public.lotes l ON l.id=o.lote_id WHERE l.pedido_id='${pedidoId}';`)),
    exp: Number(scalar(h, `SELECT count(*) FROM public.expedicoes WHERE pedido_id='${pedidoId}';`)),
    opItem: Number(scalar(h, `SELECT count(*) FROM public.op_itens oi JOIN public.pedido_itens pi ON pi.id=oi.pedido_item_id WHERE pi.pedido_id='${pedidoId}';`)),
    expItem: Number(scalar(h, `SELECT count(*) FROM public.expedicao_itens ei JOIN public.pedido_itens pi ON pi.id=ei.pedido_item_id WHERE pi.pedido_id='${pedidoId}';`)),
  });
  const esperados = {
    viaLote: { lote: 1, exp: 0, opItem: 0, expItem: 0 },
    // 2, not 1: D5's own expedition (linkViaExpedicaoItem) is deliberately
    // hung off F.viaExpedicao as its "dono" (see D5 construction below), so
    // this Pedido carries TWO independent lote/expedicao pairs. It stays
    // `true` for the same reason either way; only the raw count moves.
    viaExpedicao: { lote: 2, exp: 2, opItem: 0, expItem: 0 },
    viaOpItem: { lote: 0, exp: 0, opItem: 1, expItem: 0 },
    viaExpedicaoItem: { lote: 0, exp: 0, opItem: 1, expItem: 1 },
    semVinculo: { lote: 0, exp: 0, opItem: 0, expItem: 0 },
  };
  for (const [nome, esperado] of Object.entries(esperados)) {
    const real = isolamento(F[nome]);
    check(JSON.stringify(real) === JSON.stringify(esperado),
      `${nome}: o caminho deve estar ISOLADO; esperado ${JSON.stringify(esperado)}, real ${JSON.stringify(real)}`);
  }
  log('D/I', { casos: casos.length, positivos: 6, negativo: 1, isolamento: 'provado',
    igualAoOwner: true });
}

// ===========================================================================
// PART E — the two negative cases leak nothing.
// ===========================================================================
function partE(h) {
  const proibido = resumo(h, F.alheio);
  check(proibido.ok === false && proibido.erro === 'PEDIDO_ALTERACAO_FORBIDDEN',
    `Pedido alheio deve devolver PEDIDO_ALTERACAO_FORBIDDEN (got ${JSON.stringify(proibido)})`);
  check(Object.keys(proibido).sort().join('+') === 'erro+ok',
    `a resposta proibida deve ter EXATAMENTE {ok,erro} (got ${Object.keys(proibido).sort().join('+')})`);
  check(proibido.capacidades === undefined, 'a resposta proibida NAO pode vazar capacidades');
  check(JSON.stringify(proibido) === JSON.stringify(BASELINE.proibido),
    'a forma da resposta proibida deve ser identica a de db/93');

  const ausente = resumo(h, ABSENT_PEDIDO);
  check(ausente.ok === false && ausente.erro === 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND',
    `Pedido ausente deve devolver PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND (got ${JSON.stringify(ausente)})`);
  check(ausente.capacidades === undefined, 'a resposta not-found NAO pode vazar capacidades');
  check(JSON.stringify(ausente) === JSON.stringify(BASELINE.naoEncontrado),
    'a forma da resposta not-found deve ser identica a de db/93');

  // A forbidden answer must be indistinguishable whether or not production
  // exists: the other client's Pedido gains an OP and the answer does not move.
  linkViaLote(h, F.alheio, { opId: 970000107, loteId: 970000204, numero: 970107, status: 'aberta' });
  check(helperSays(h, F.alheio) === true, 'a fixture alheia deveria estar vinculada agora');
  const proibidoDepois = resumo(h, F.alheio);
  check(JSON.stringify(proibidoDepois) === JSON.stringify(proibido),
    'a resposta proibida NAO pode mudar por existir producao (seria um oraculo)');
  log('E', { proibido: 'PEDIDO_ALTERACAO_FORBIDDEN', ausente: 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND',
    vazamento: 'nenhum', oraculo: 'nenhum' });
}

// ===========================================================================
// PART F — pendente and historico preserved against the db/93 baseline.
// ===========================================================================
function partF(h) {
  const depois = resumo(h, F.comSolicitacoes);

  // The key set grows by EXACTLY one name.
  const chaves = Object.keys(depois).sort();
  check(chaves.join('+') === [...BASELINE.chaves, 'capacidades'].sort().join('+'),
    `o conjunto de chaves deve ganhar exatamente capacidades (baseline ${BASELINE.chaves.join('+')}, agora ${chaves.join('+')})`);

  // pendente: byte-identical.
  check(JSON.stringify(depois.pendente) === JSON.stringify(BASELINE.pendente),
    'o objeto pendente deve ser identico ao baseline de db/93');
  check(Object.keys(depois.pendente).sort().join('+')
    === 'campos_alterados+criado_em+itens_propostos+mensagem+prioridade_proposta+solicitacao_id+status',
    `a forma de pendente mudou: ${Object.keys(depois.pendente).sort().join('+')}`);
  check(depois.pendente.status === 'pendente', 'pendente deve ser a solicitacao pendente');

  // historico: byte-identical, including ORDER.
  check(JSON.stringify(depois.historico) === JSON.stringify(BASELINE.historico),
    'o array historico deve ser identico ao baseline de db/93, na mesma ordem');
  check(depois.historico.length === 3, `historico deve ter 3 entradas (got ${depois.historico.length})`);
  for (const h1 of depois.historico) {
    check(Object.keys(h1).sort().join('+') === 'criado_em+decidido_em+motivo+solicitacao_id+status',
      `a forma de uma entrada de historico mudou: ${Object.keys(h1).sort().join('+')}`);
    check(h1.status !== 'pendente', 'historico nunca contem a solicitacao pendente');
  }
  // ORDER BY criado_em DESC — proved on the values, not on the SQL text.
  const datas = depois.historico.map(x => x.criado_em);
  check(JSON.stringify(datas) === JSON.stringify([...datas].sort().reverse()),
    `historico deve permanecer ordenado por criado_em DESC (got ${datas.join(' > ')})`);
  check(new Set(depois.historico.map(x => x.status)).size === 3,
    'as tres decididas devem ter status distintos (rejeitada/retirada/aprovada)');

  // And the empty case still resolves to an array, never null.
  check(Array.isArray(resumo(h, F.semVinculo).historico)
    && resumo(h, F.semVinculo).historico.length === 0,
    'historico vazio deve continuar sendo [] e nunca null');
  log('F', { chaves: '+capacidades', pendente: 'identico', historico: 'identico',
    ordenacao: 'criado_em DESC', vazio: '[]' });
}

// ===========================================================================
// PART G — effective privileges.
// ===========================================================================
function partG(h) {
  // 12/13 — the RPC.
  check(canExecute(h, 'authenticated', RPC), 'authenticated deve executar cliente_alteracao_resumo');
  check(canExecute(h, 'service_role', RPC), 'service_role deve executar cliente_alteracao_resumo');
  check(!canExecute(h, 'anon', RPC), 'anon NAO pode executar cliente_alteracao_resumo');
  const errAnon = callAs(h, null, `SELECT public.cliente_alteracao_resumo('${F.semVinculo}');`, 'anon');
  check(errAnon !== null && /permission denied|permiss/i.test(errAnon),
    `anon deve receber recusa de permissao (got ${errAnon})`);

  // 14 — the owner-only gate, all three application roles, statically and by
  // real invocation.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    check(!canExecute(h, role, HELPER), `${role} NAO pode executar pedido_tem_op_relacionada`);
    const uid = role === 'authenticated' ? CLIENT_UID : null;
    const err = callAs(h, uid, `SELECT public.pedido_tem_op_relacionada('${F.viaLote}');`, role);
    check(err !== null, `chamada direta ao helper como ${role} deveria ser NEGADA`);
    check(/permission denied|permiss/i.test(err),
      `helper como ${role}: a recusa deve ser de permissao (got ${err})`);
  }
  check(!isTrue(scalar(h, `SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
     WHERE p.oid = to_regprocedure('${HELPER}')::oid AND a.grantee = 0);`)),
    'o helper NAO pode conceder nada a PUBLIC');

  // 15 — the owner still holds EXECUTE on both (privilege proof). The
  // FUNCTIONAL proof that postgres's retained EXECUTE actually lets the
  // SECURITY DEFINER RPC call the owner-only helper is the admin call right
  // below: calling AS the raw connection role (no request.jwt.claim.sub) would
  // hit meu_cliente_id()/is_admin()'s own NULL-auth.uid() fallback and prove
  // nothing about the helper.
  check(canExecute(h, 'postgres', RPC), 'o dono deve executar a RPC');
  check(canExecute(h, 'postgres', HELPER), 'o dono deve executar o helper');

  // The admin path is unchanged: an admin reads any Pedido's summary.
  const comoAdmin = resumo(h, F.alheio, ADMIN_UID);
  check(comoAdmin.ok === true && comoAdmin.capacidades.estrutura_itens_bloqueada === true,
    'o admin deve continuar lendo o resumo de qualquer Pedido, com capacidade correta');
  log('G', { authenticated: 'pode RPC', anon: 'negado', helper: 'negado a 3 papeis',
    dono: 'funcional', admin: 'inalterado' });
}

// ===========================================================================
// PART H — no internal production data is exposed.
// ===========================================================================
function partH(h) {
  const r = resumo(h, F.viaLote);
  check(Object.keys(r).sort().join('+') === 'capacidades+historico+ok+pedido_id+pendente',
    `o conjunto de chaves deve ser exatamente as cinco aceitas (got ${Object.keys(r).sort().join('+')})`);
  check(Object.keys(r.capacidades).length === 1
    && Object.keys(r.capacidades)[0] === 'estrutura_itens_bloqueada',
    `capacidades deve ter EXATAMENTE uma chave (got ${Object.keys(r.capacidades).join('+')})`);
  check(typeof r.capacidades.estrutura_itens_bloqueada === 'boolean',
    'a capacidade deve ser um booleano, nunca um motivo, contagem ou identificador');

  // The serialized response must not contain any internal identity, for a
  // Pedido whose production linkage really exists.
  // Only NON-HEX terms are searched in the serialized response: a random UUID can
  // contain any digit run, so a numeric fixture id would be a flaky assertion.
  // The numeric case is covered exactly by the capacidades equality below.
  const bruto = JSON.stringify(r);
  const proibidos = ['op_id', 'lote', 'lote_id', 'expedicao', 'expedicao_id', 'fornecedor',
    'ordem_compra', 'documento', 'fiscal', 'custo', 'numero', 'tem_op_relacionada',
    'op_item', 'motivo', 'origem', 'status_op', 'simulada', 'cancelada'];
  for (const termo of proibidos) {
    check(!bruto.includes(termo), `a resposta NAO pode conter "${termo}": ${bruto}`);
  }
  // Nor may it carry a count or an id anywhere under capacidades.
  check(JSON.stringify(r.capacidades) === '{"estrutura_itens_bloqueada":true}',
    `capacidades deve ser exatamente um booleano nomeado (got ${JSON.stringify(r.capacidades)})`);
  log('H', { chaves: 5, capacidades: '1 booleano', vazamentoInterno: 'nenhum',
    termosProibidos: proibidos.length });
}

// ===========================================================================
async function main() {
  let h = null;
  try {
    SCRATCH = await mkdtemp(path.join(tmpdir(), 'g28-c94-'));
    h = await bootstrapCluster({});
    log('CLUSTER', { host: h.host, port: h.port, pg: h.pgVersion });

    await partA(h);
    partB(h);
    partC(h);
    partDI(h);
    partE(h);
    partF(h);
    partG(h);
    partH(h);

    console.log(`\nALL PROOFS PASSED (failures=${FAILURES})`);
  } catch (e) {
    FAILURES += 1;
    console.error(`\nHARNESS ERROR: ${e.message}`);
  } finally {
    if (h) {
      try {
        const proof = await h.stop();
        log('Z', { destroyed: 'true', pidAbsent: proof?.pidAbsent ?? 'n/a', portClosed: proof?.portClosed ?? 'n/a' });
      } catch (e) {
        FAILURES += 1;
        console.error(`CLUSTER DESTRUCTION FAILED: ${e.message}`);
      }
    }
    if (SCRATCH) await rm(SCRATCH, { recursive: true, force: true });
  }
  process.exit(FAILURES === 0 ? 0 : 1);
}

await main();
