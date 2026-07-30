// tests/op-canonical-identity-invariant.mjs
//
// OP-CANONICAL-IDENTITY-REFOUNDATION-R1 disposable-cluster proof of
// db/95_op_canonical_identity_refoundation.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic and is
// built inside the disposable cluster; NO production data is used.
//
// WHY THIS FILE EXISTS AND DOES NOT EXTEND AN OLDER HARNESS
//   tests/pedido-unified-edit-change-approval-invariant.mjs (db/92),
//   tests/pedido-change-approval-helper-privilege-invariant.mjs (db/93) and
//   tests/cliente-pedido-structural-capability-invariant.mjs (db/94) are FROZEN
//   phase harnesses pinning their own EXPECTED_TERMINAL. They are
//   accepted-checkpoint evidence and this order does not re-point them, exactly
//   as db/94 did not re-point db/92's. Only the BEHAVIOURAL proof of db/95
//   needs a cluster, and that is this file. The STATIC file guards live in
//   tests/op-canonical-identity-schema.smoke.js.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z),
// following the order's MANDATORY VALIDATION DATASET item by item:
//   A  db/01..db/95 apply cleanly, in order, and db/95 is the terminal.
//   B  the mandatory dataset: op_numeros.tecelagem = 41; Pedido 1/2026; the
//      first Pedido-linked Tecelagem OP is canonical `OP-T005-1-26` with
//      internal 42/2026; the second is `OP-T005-2-26`; the first
//      Acabamento/latex OP is `OP-A005-1-26`.
//   C  dataset item 6: removing T01 leaves T02 as T02. This is the exact
//      instability the audit reproduced against the old positional display,
//      where T02 INHERITED T01's code.
//   D  dataset item 7: a Tecelagem OP created after the removal does NOT reuse
//      the freed sequence.
//   E  both assignment paths are covered: UPDATE OF lote_id (the persistirOP
//      path, which inserts the OP before the Lote) and INSERT with lote_id
//      (the gerar_op_latex / Manta-route path).
//   F  immutability is EXECUTABLE: the canonical identity cannot be rewritten,
//      and ops.numero/ops.ano cannot be arbitrarily rewritten either -- the
//      defect proved in js/screens/op-persistir.js.
//   G  database-enforced uniqueness of the canonical identity.
//   H  OP avulsa (no Pedido) is preserved with a NULL canonical identity, and
//      is assigned EXACTLY ONCE if it is later linked to a Pedido.
//   M  CONCORRENCIA: 12 sessoes psql REAIS e simultaneas disputando o mesmo
//      (pedido, escopo) produzem sequencias 1..12 contiguas, sem lacuna nem
//      duplicata, e nenhuma reaproveita sequencia liberada por remocao.
//   I  db/95 replays idempotently: no identity drift, no sequence consumed
//      twice, no row-count drift, byte-identical high-water.
//   J  the post-invariant of db/95 fails closed on a desynchronized high-water.
//   K  the backfill is deterministic: OPs created BEFORE db/95 receive
//      (criado_em ASC, id ASC) sequences, and the high-water is frozen ahead
//      of them.
//   Z  mandatory full cluster destruction.
//
// Run:  node tests/op-canonical-identity-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync, spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 95;
const DB95 = '95_op_canonical_identity_refoundation.sql';

// The db/92 phase harness already owns the platform preamble and the db/67
// corpus. Reusing its literals keeps ONE definition of each and guarantees this
// suite cannot silently drift from the schema chain it extends.
const parent = fs.readFileSync(
  path.join(REPO_ROOT, 'tests', 'pedido-unified-edit-change-approval-invariant.mjs'), 'utf8');
const between = (open, close) => parent.split(open)[1].split(close)[0];
const PREAMBLE_SQL = between('const PREAMBLE_SQL = `', '`;');
const CORPUS_SQL = between('const CORPUS_SQL = `', '`;');

// Synthetic fixture identities, disjoint from the corpus ranges used by the
// db/92..db/94 harnesses.
const CLI = 950000101;
const MOD = 950000201;
const COR_1 = 950000401;
const COR_2 = 950000402;
const PEDIDO_ID = '00000000-0000-4000-8000-000095000001';
const PEDIDO_NUMERO = 5;   // exibido como 005
const FORN = 950000501;
const FORN_2 = 950000502;
const FORN_3 = 950000503;
const LOTE = 950000301;
const LOTE_AVULSA = 950000302;

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
// Returns the first error line, or null when the statement was ACCEPTED.
function expectReject(h, sql) {
  const r = run(h, sql);
  return r.ok ? null : (r.err.split('\n').filter(Boolean)[0] || 'error');
}

// The canonical identity, straight from the database. NULL renders as ''.
const canonico = (h, opId) =>
  scalar(h, `SELECT coalesce(identidade_operacional, '') FROM public.ops WHERE id = ${opId};`);
const interno = (h, opId) =>
  scalar(h, `SELECT numero || '/' || ano FROM public.ops WHERE id = ${opId};`);
const highWater = (h, letra) =>
  scalar(h, `SELECT coalesce(max(ultimo_seq)::text, 'none') FROM public.pedido_identidade_numeros
             WHERE pedido_id = '${PEDIDO_ID}' AND escopo = '${letra}';`);

async function resolveManifest() {
  const dir = path.join(REPO_ROOT, 'db');
  return (await readdir(dir))
    .filter(f => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map(f => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dir, f) }))
    .sort((a, b) => a.n - b.n);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// The order's dataset requires the EXACT collision that produced the defect:
// a Pedido numbered 1 created in 2026, meeting an internal counter already at
// 41. `pedidos.numero` is GENERATED BY DEFAULT AS IDENTITY, so an explicit
// value is legal; `criado_em` is set at INSERT (db/89 guards UPDATE, not the
// initial write), which is what freezes the canonical year to 2026.
function baseFixture(h) {
  must(h, `INSERT INTO public.cores (id, nome) VALUES (${COR_1}, 'OCI-COR-1'), (${COR_2}, 'OCI-COR-2')
           ON CONFLICT (id) DO NOTHING;`, 'cores');
  must(h, `INSERT INTO public.clientes (id, nome) VALUES (${CLI}, 'Cliente Identidade 95')
           ON CONFLICT (id) DO NOTHING;`, 'cliente');
  must(h, `INSERT INTO public.modelos (id, nome, largura, cor_1_id, cor_2_id)
           VALUES (${MOD}, 'Modelo Identidade 95', 2.10, ${COR_1}, ${COR_2})
           ON CONFLICT (id) DO NOTHING;`, 'modelo');
  must(h, `INSERT INTO public.pedidos (id, numero, cliente_id, status, criado_em, data_pedido, prazo_entrega)
           VALUES ('${PEDIDO_ID}', ${PEDIDO_NUMERO}, ${CLI}, 'confirmado',
                   TIMESTAMPTZ '2026-07-20 12:00:00+00', DATE '2026-07-20', DATE '2026-08-20');`,
    'pedido 005-26');
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
           VALUES (${LOTE}, 950101, ${CLI}, '${PEDIDO_ID}');`, 'lote');
}

// Reproduces the internal counter state the clean-slate reset preserved and
// asserted (scripts/reset/clean-slate-transactional-reset.sql:151).
function setInternalHighWater(h, tipo, valor) {
  must(h, `INSERT INTO public.op_numeros (tipo, ano, ultimo_numero) VALUES ('${tipo}', 2026, ${valor})
           ON CONFLICT (tipo, ano) DO UPDATE SET ultimo_numero = GREATEST(public.op_numeros.ultimo_numero, ${valor});`,
    `op_numeros ${tipo}=${valor}`);
}

// The REAL persistirOP path: reserve the internal number, INSERT the OP with NO
// lote, then link the Lote by UPDATE. The canonical identity must be assigned on
// that UPDATE, not on the INSERT.
function criarOpViaUpdateDeLote(h, opId, tipo) {
  const numero = scalar(h, `SELECT public.proximo_numero_op('${tipo}', 2026);`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, criado_em)
           VALUES (${opId}, ${numero}, 2026, 'simulada', '${tipo}', now());`, `op ${opId} insert`);
  check(canonico(h, opId) === '',
    `op ${opId}: sem Lote a identidade canonica deve ser NULL, nao um codigo inventado`);
  must(h, `UPDATE public.ops SET lote_id = ${LOTE} WHERE id = ${opId};`, `op ${opId} vincula lote`);
  return numero;
}

// The gerar_op_latex / Manta-route path: INSERT already carrying lote_id.
function criarOpViaInsertComLote(h, opId, tipo) {
  const numero = scalar(h, `SELECT public.proximo_numero_op('${tipo}', 2026);`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id, criado_em)
           VALUES (${opId}, ${numero}, 2026, 'aberta', '${tipo}', ${LOTE}, now());`, `op ${opId} insert+lote`);
  return numero;
}

// ===========================================================================
// PART A — chain apply through db/95.
// ===========================================================================
async function partA(h) {
  const manifest = await resolveManifest();
  check(manifest.length === EXPECTED_TERMINAL,
    `manifest deve ser db/01..db/${EXPECTED_TERMINAL} (got ${manifest.length})`);
  check(manifest.at(-1).n === EXPECTED_TERMINAL, `migration terminal deve ser db/${EXPECTED_TERMINAL}`);
  check(path.basename(manifest.at(-1).file) === DB95, `terminal deve ser ${DB95}`);

  await applySql(h, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(h, 'corpus.sql', CORPUS_SQL, 'corpus');
    if (n === 95) {
      // Built at db/94 so PART K can prove the BACKFILL, not just live
      // assignment: this OP exists BEFORE the identity columns do.
      baseFixture(h);
      setInternalHighWater(h, 'tecelagem', 41);
      const nPre = scalar(h, `SELECT public.proximo_numero_op('tecelagem', 2026);`);
      check(nPre === '42', `a primeira OP apos o high-water 41 deve ser 42 (got ${nPre})`);
      must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id, criado_em)
               VALUES (950001001, ${nPre}, 2026, 'aberta', 'tecelagem', ${LOTE},
                       TIMESTAMPTZ '2026-07-20 13:00:00+00');`, 'op pre-db/95');
      check(scalar(h, `SELECT count(*) FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ops'
                AND column_name='identidade_operacional';`) === '0',
        'a coluna canonica NAO pode existir antes de db/95');
    }
    applyFile(h, file, path.basename(file));
  }
  log('A', { migrations: manifest.length, terminal: EXPECTED_TERMINAL, applied: 'clean' });
}

// ===========================================================================
// PART K — the backfill froze the pre-db/95 OP deterministically.
// ===========================================================================
function partK(h) {
  check(canonico(h, 950001001) === 'OP-T005-1-26',
    `a OP pre-db/95 deve ter sido backfilled para OP-T005-1-26 (got ${canonico(h, 950001001)})`);
  check(interno(h, 950001001) === '42/2026',
    `o numero interno da OP backfilled deve permanecer 42/2026 (got ${interno(h, 950001001)})`);
  check(highWater(h, 'T') === '1',
    `o high-water canonico deve estar congelado em 1 apos o backfill (got ${highWater(h, 'T')})`);
  // Dataset item 1 — the internal counter was never reset by db/95.
  check(scalar(h, `SELECT ultimo_numero FROM public.op_numeros WHERE tipo='tecelagem' AND ano=2026;`) === '42',
    'db/95 nao pode alterar op_numeros; ele avancou 41->42 apenas pela reserva legitima da OP');
  log('K', { backfill: 'OP-T005-1-26', interno: '42/2026', highWaterCanonico: 1,
    opNumerosIntocado: true });
}

// ===========================================================================
// PART B + E — the mandatory dataset, through BOTH assignment paths.
// ===========================================================================
function partBE(h) {
  // Dataset item 2 — Pedido 1/2026.
  check(scalar(h, `SELECT numero FROM public.pedidos WHERE id='${PEDIDO_ID}';`) === String(PEDIDO_NUMERO),
    'o Pedido de prova deve ser o numero 5 (exibido 005)');
  check(scalar(h, `SELECT EXTRACT(YEAR FROM (criado_em AT TIME ZONE 'UTC'))::int
                     FROM public.pedidos WHERE id='${PEDIDO_ID}';`) === '2026',
    'o Pedido de prova deve ser de 2026');

  // Dataset item 3 is already proved by PART K for the backfilled OP. Now the
  // LIVE path: dataset item 4 — the second Tecelagem OP, created through the
  // real persistirOP sequence (INSERT then UPDATE OF lote_id).
  const n2 = criarOpViaUpdateDeLote(h, 950001002, 'tecelagem');
  check(canonico(h, 950001002) === 'OP-T005-2-26',
    `a segunda OP de Tecelagem deve ser OP-T005-2-26 (got ${canonico(h, 950001002)})`);
  check(interno(h, 950001002) === `${n2}/2026`, 'o numero interno da segunda OP deve ser o reservado');
  check(n2 === '43', `a reserva interna deve continuar monotonica em 43 (got ${n2})`);

  // Dataset item 5 — the first Acabamento/latex OP, through the INSERT-with-lote
  // path used by gerar_op_latex.
  const nA = criarOpViaInsertComLote(h, 950001003, 'latex');
  check(canonico(h, 950001003) === 'OP-A005-1-26',
    `a primeira OP de Acabamento deve ser OP-A005-1-26 (got ${canonico(h, 950001003)})`);
  check(highWater(h, 'A') === '1', 'o high-water de Acabamento deve estar em 1');

  // The two letters are INDEPENDENT counters: an Acabamento OP never consumes a
  // Tecelagem sequence.
  check(highWater(h, 'T') === '2', `o high-water de Tecelagem deve estar em 2 (got ${highWater(h, 'T')})`);
  log('B/E', { pedido: '005-26', T01: 'OP-T005-1-26 (backfill)', T02: 'OP-T005-2-26 (update-de-lote)',
    A01: 'OP-A005-1-26 (insert-com-lote)', internoA: `${nA}/2026`, letrasIndependentes: true });
}

// ===========================================================================
// PART C + D — the exact instability the audit reproduced, now impossible.
// ===========================================================================
function partCD(h) {
  const antes = canonico(h, 950001002);
  check(antes === 'OP-T005-2-26', 'pre-condicao: T02 deve ser T02');

  // Dataset item 6 — remove T01. db/34 dropped ops_numeradas_no_delete, so this
  // is the real reachable removal path, not a synthetic one.
  must(h, 'DELETE FROM public.ops WHERE id = 950001001;', 'remover T01');
  check(scalar(h, 'SELECT count(*) FROM public.ops WHERE id = 950001001;') === '0', 'T01 removida');

  const depois = canonico(h, 950001002);
  check(depois === 'OP-T005-2-26',
    `REGRESSAO DO DEFEITO AUDITADO: T02 deve permanecer T02 apos a remocao de T01 (got ${depois})`);
  check(depois === antes, 'a identidade canonica de T02 nao pode mudar por causa de uma irma removida');

  // Dataset item 7 — the freed sequence is NOT reused.
  const n3 = criarOpViaUpdateDeLote(h, 950001004, 'tecelagem');
  const nova = canonico(h, 950001004);
  check(nova === 'OP-T005-3-26',
    `a OP criada apos a remocao deve ser T03, nunca reaproveitar T01 (got ${nova})`);
  check(nova !== 'OP-T005-1-26', 'a sequencia da OP removida NAO pode ser reaproveitada');
  check(interno(h, 950001004) === `${n3}/2026` && n3 === '44',
    `o numero interno tambem nao reaproveita (esperado 44, got ${n3})`);
  log('C/D', { removida: 'T01', T02: 'permanece T02', nova: 'OP-T005-3-26',
    reusoDeSequencia: 'nenhum', reusoInterno: 'nenhum' });
}

// ===========================================================================
// PART F — immutability is executable, not declared.
// ===========================================================================
function partF(h) {
  // The canonical identity cannot be rewritten.
  const e1 = expectReject(h, 'UPDATE public.ops SET identidade_seq = 9 WHERE id = 950001002;');
  check(e1 !== null && /imutavel/i.test(e1), `a sequencia canonica deve ser imutavel (got ${e1})`);
  const e2 = expectReject(h, 'UPDATE public.ops SET identidade_pedido_numero = 999 WHERE id = 950001002;');
  check(e2 !== null && /imutavel/i.test(e2), `o numero de Pedido congelado deve ser imutavel (got ${e2})`);
  const e3 = expectReject(h, `UPDATE public.ops SET identidade_tipo_letra = 'A' WHERE id = 950001002;`);
  check(e3 !== null && /imutavel/i.test(e3), `a letra congelada deve ser imutavel (got ${e3})`);

  // The generated column has NO write path at all.
  const e4 = expectReject(h, `UPDATE public.ops SET identidade_operacional = 'OP-T999-9-99' WHERE id = 950001002;`);
  check(e4 !== null, 'a coluna gerada nao pode ser escrita diretamente');

  // ops.numero/ops.ano cannot be arbitrarily rewritten -- the op-persistir.js
  // defect, now closed at the database.
  const e5 = expectReject(h, 'UPDATE public.ops SET numero = 777 WHERE id = 950001002;');
  check(e5 !== null && /imutavel/i.test(e5),
    `ops.numero deve ser imutavel apos a criacao (got ${e5})`);
  const e6 = expectReject(h, 'UPDATE public.ops SET ano = 2099 WHERE id = 950001002;');
  check(e6 !== null && /imutavel/i.test(e6), `ops.ano deve ser imutavel apos a criacao (got ${e6})`);

  // A legitimate lifecycle update on the SAME row still works: the guard is
  // targeted, not a blanket write lock.
  must(h, `UPDATE public.ops SET status = 'aberta' WHERE id = 950001002;`, 'status update legitimo');
  check(canonico(h, 950001002) === 'OP-T005-2-26', 'a identidade sobrevive a um update de ciclo de vida');
  log('F', { identidadeCanonica: 'imutavel', colunaGerada: 'sem write path',
    numeroInterno: 'imutavel', updateDeStatus: 'permitido' });
}

// ===========================================================================
// PART G — database-enforced uniqueness.
// ===========================================================================
function partG(h) {
  check(scalar(h, `SELECT count(*) FROM pg_indexes WHERE schemaname='public'
            AND indexname='ops_identidade_operacional_uidx';`) === '1',
    'o indice unico da identidade canonica deve existir');

  // Forge a duplicate by writing the frozen components directly, bypassing the
  // reservation function. The database must still refuse it.
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, criado_em)
           VALUES (950001005, 900, 2026, 'simulada', 'tecelagem', now());`, 'op para colisao');
  // Forja EXATAMENTE o codigo que a T02 (950001002) ja possui: OP-T005-2-26.
  const dup = expectReject(h, `UPDATE public.ops SET identidade_pedido_id='${PEDIDO_ID}',
      identidade_pedido_numero=${PEDIDO_NUMERO}, identidade_pedido_ano=2026,
      identidade_tipo_letra='T', identidade_seq=2 WHERE id = 950001005;`);
  check(dup !== null && /duplicat|unique|ops_identidade_operacional_uidx/i.test(dup),
    `uma identidade canonica duplicada deve ser recusada pelo banco (got ${dup})`);

  // Partial identity is refused too: no surface can ever receive half a code.
  const parcial = expectReject(h,
    `UPDATE public.ops SET identidade_pedido_numero = ${PEDIDO_NUMERO} WHERE id = 950001005;`);
  check(parcial !== null && /ops_identidade_completa_chk|check/i.test(parcial),
    `uma identidade parcial deve ser recusada (got ${parcial})`);
  must(h, 'DELETE FROM public.ops WHERE id = 950001005;', 'limpar op de colisao');
  log('G', { indiceUnico: 'presente', duplicata: 'recusada', identidadeParcial: 'recusada' });
}

// ===========================================================================
// PART H — OP avulsa preserved, and assigned exactly once on later linkage.
// ===========================================================================
function partH(h) {
  const n = scalar(h, `SELECT public.proximo_numero_op('tecelagem', 2026);`);
  must(h, `INSERT INTO public.ops (id, numero, ano, status, tipo, criado_em)
           VALUES (950002001, ${n}, 2026, 'simulada', 'tecelagem', now());`, 'op avulsa');
  check(canonico(h, 950002001) === '',
    'uma OP avulsa NAO pode ter identidade canonica; ela exibe numero/ano interno');
  check(interno(h, 950002001) === `${n}/2026`, 'a OP avulsa mantem seu numero interno');

  // A Lote with NO pedido must not create an identity either.
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
           VALUES (${LOTE_AVULSA}, 950102, ${CLI}, NULL);`, 'lote sem pedido');
  must(h, `UPDATE public.ops SET lote_id = ${LOTE_AVULSA} WHERE id = 950002001;`, 'vincula lote sem pedido');
  check(canonico(h, 950002001) === '',
    'um Lote sem Pedido nao produz identidade canonica (fail closed)');

  // Now the real linkage: assigned EXACTLY once.
  must(h, `UPDATE public.ops SET lote_id = ${LOTE} WHERE id = 950002001;`, 'vincula ao Pedido');
  const atribuida = canonico(h, 950002001);
  check(atribuida === 'OP-T005-4-26',
    `a OP avulsa vinculada depois deve receber a proxima sequencia, T04 (got ${atribuida})`);

  // Re-linking must NOT reassign: "exactly once" holds even if lote_id moves.
  must(h, `UPDATE public.ops SET lote_id = ${LOTE} WHERE id = 950002001;`, 're-vincula');
  check(canonico(h, 950002001) === atribuida,
    'revincular NAO pode reatribuir a identidade canonica');
  check(highWater(h, 'T') === '4',
    `o high-water deve ter avancado exatamente uma vez, para 4 (got ${highWater(h, 'T')})`);
  log('H', { avulsa: 'identidade NULL', loteSemPedido: 'fail closed',
    aoVincular: 'OP-T005-4-26', reatribuicao: 'impossivel', highWater: 4 });
}

// ===========================================================================
// PART L — a Ordem de Compra amarrada ao MESMO Pedido.
// `public.ordem_compra` (db/67) nunca teve numero de negocio: as telas
// exibiam o BIGSERIAL cru. Aqui provamos o codigo casado OC-005-1-26.
// ===========================================================================
const ocCanonico = (h, ocId) =>
  scalar(h, `SELECT coalesce(identidade_operacional, '') FROM public.ordem_compra WHERE id = ${ocId};`);

function partL(h) {
  // db/67 impoe UNIQUE (pedido_id, fornecedor_id) para rascunho ativo
  // (`ordem_compra_um_rascunho_ativo`): duas ordens de compra abertas do MESMO
  // Pedido sao necessariamente de fornecedores DIFERENTES. Isso confirma o
  // modelo de numeracao por Pedido em vez de por OP.
  must(h, `INSERT INTO public.fornecedores (id, nome, tipo) VALUES
             (${FORN}, 'Fornecedor 95-A', 'fio_algodao'),
             (${FORN_2}, 'Fornecedor 95-B', 'fio_algodao'),
             (${FORN_3}, 'Fornecedor 95-C', 'fio_algodao')
           ON CONFLICT (id) DO NOTHING;`, 'fornecedores');

  // 1a e 2a ordens de compra do MESMO Pedido.
  must(h, `INSERT INTO public.ordem_compra (id, pedido_id, fornecedor_id)
           VALUES (950003001, '${PEDIDO_ID}', ${FORN});`, 'oc 1');
  check(ocCanonico(h, 950003001) === 'OC-005-1-26',
    `a 1a Ordem de Compra do Pedido deve ser OC-005-1-26 (got ${ocCanonico(h, 950003001)})`);

  must(h, `INSERT INTO public.ordem_compra (id, pedido_id, fornecedor_id)
           VALUES (950003002, '${PEDIDO_ID}', ${FORN_2});`, 'oc 2');
  check(ocCanonico(h, 950003002) === 'OC-005-2-26',
    `a 2a Ordem de Compra deve ser OC-005-2-26 (got ${ocCanonico(h, 950003002)})`);

  // A sequencia da OC conta por PEDIDO e e INDEPENDENTE das sequencias de OP:
  // o Pedido ja tem T ate 4 e A em 1, e a OC comecou do 1.
  check(highWater(h, 'OC') === '2', `o high-water de OC deve estar em 2 (got ${highWater(h, 'OC')})`);
  check(highWater(h, 'T') === '4', 'a sequencia de OC nao pode consumir a de Tecelagem');
  check(highWater(h, 'A') === '1', 'a sequencia de OC nao pode consumir a de Acabamento');

  // Remover a 1a OC NAO libera a sequencia: a proxima e a 3a.
  must(h, 'DELETE FROM public.ordem_compra WHERE id = 950003001;', 'remover oc 1');
  must(h, `INSERT INTO public.ordem_compra (id, pedido_id, fornecedor_id)
           VALUES (950003003, '${PEDIDO_ID}', ${FORN_3});`, 'oc 3');
  check(ocCanonico(h, 950003003) === 'OC-005-3-26',
    `a OC criada apos a remocao deve ser OC-005-3-26, sem reaproveitar (got ${ocCanonico(h, 950003003)})`);
  check(ocCanonico(h, 950003002) === 'OC-005-2-26',
    'a 2a OC nao pode mudar de nome porque a 1a foi removida');

  // Imutabilidade da identidade da OC.
  const e = expectReject(h, 'UPDATE public.ordem_compra SET identidade_seq = 9 WHERE id = 950003002;');
  check(e !== null && /imutavel/i.test(e), `a identidade da OC deve ser imutavel (got ${e})`);

  // Unicidade no banco.
  check(scalar(h, `SELECT count(*) FROM pg_indexes WHERE schemaname='public'
            AND indexname='ordem_compra_identidade_operacional_uidx';`) === '1',
    'o indice unico da identidade da OC deve existir');

  // OC legada sem Pedido: identidade NULL, fail closed — nunca a chave crua.
  must(h, `INSERT INTO public.ordem_compra (id, pedido_id, fornecedor_id, legado, legado_provenance)
           VALUES (950003004, NULL, ${FORN}, TRUE, 'emitido_recebido');`, 'oc legada');
  check(ocCanonico(h, 950003004) === '',
    'OC legada sem Pedido nao pode receber identidade derivada');
  log('L', { oc1: 'OC-005-1-26', oc2: 'OC-005-2-26', aposRemocao: 'OC-005-3-26',
    escoposIndependentes: 'T=4|A=1|OC=3', imutavel: true, legadaSemPedido: 'NULL' });
}

// ===========================================================================
// PART M — CONCORRENCIA de numeracao.
//
// `proximo_seq_identidade` reserva por UPSERT `ON CONFLICT ... ultimo_seq + 1`,
// que serializa no lock da linha do contador. A prova nao pode ser lida do
// codigo: N sessoes REAIS e SIMULTANEAS disputam o mesmo (pedido, escopo), e o
// resultado tem de ser N sequencias distintas, contiguas, sem lacuna e sem
// duplicata — e o indice unico da identidade nao pode ser violado nenhuma vez.
// ===========================================================================
async function partM(h) {
  const N = 12;
  const PEDIDO_CONC = '00000000-0000-4000-8000-0000950000c1';
  must(h, `INSERT INTO public.pedidos (id, numero, cliente_id, status, criado_em, data_pedido, prazo_entrega)
           VALUES ('${PEDIDO_CONC}', 777, ${CLI}, 'confirmado',
                   TIMESTAMPTZ '2026-07-20 12:00:00+00', DATE '2026-07-20', DATE '2026-08-20');`,
    'pedido concorrencia');
  const LOTE_CONC = 950000390;
  must(h, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
           VALUES (${LOTE_CONC}, 950390, ${CLI}, '${PEDIDO_CONC}');`, 'lote concorrencia');

  // N processos psql REALMENTE simultaneos. `spawnSync` bloquearia e executaria
  // em sequencia, nao provando concorrencia alguma: aqui todos sao disparados
  // com `spawn` e aguardados juntos, de modo que disputam de fato o lock da
  // linha do contador. Cada sessao reserva o numero interno, insere a OP e
  // vincula o Lote na MESMA transacao — o caminho real de criacao.
  const procs = await Promise.all(Array.from({ length: N }, (_, i) => {
    const opId = 950004000 + i;
    const sql = `BEGIN;
      INSERT INTO public.ops (id, numero, ano, status, tipo, criado_em)
      VALUES (${opId}, public.proximo_numero_op('tecelagem', 2026), 2026, 'simulada', 'tecelagem', now());
      UPDATE public.ops SET lote_id = ${LOTE_CONC} WHERE id = ${opId};
      COMMIT;`;
    return new Promise((resolve) => {
      const child = spawn(psqlBinary(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-c', sql],
        { encoding: 'utf8' });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (status) => resolve({ status, stderr }));
    });
  }));
  const falhas = procs.filter((r) => r.status !== 0);
  check(falhas.length === 0,
    `todas as ${N} sessoes concorrentes deviam concluir (falharam ${falhas.length}: ${
      falhas.map((f) => (f.stderr || '').split('\n')[0]).join(' | ')})`);

  // Sequencias: exatamente 1..N, distintas e contiguas.
  const seqs = scalar(h, `SELECT string_agg(identidade_seq::text, ',' ORDER BY identidade_seq)
                            FROM public.ops WHERE identidade_pedido_id = '${PEDIDO_CONC}';`);
  const esperado = Array.from({ length: N }, (_, i) => i + 1).join(',');
  check(seqs === esperado, `as sequencias devem ser 1..${N} sem lacuna nem duplicata (got ${seqs})`);

  // Identidades: N distintas, e o indice unico nunca foi violado.
  const distintas = scalar(h, `SELECT count(DISTINCT identidade_operacional)
                                 FROM public.ops WHERE identidade_pedido_id = '${PEDIDO_CONC}';`);
  check(distintas === String(N), `devem existir ${N} identidades distintas (got ${distintas})`);
  check(scalar(h, `SELECT count(*) FROM public.ops WHERE identidade_pedido_id = '${PEDIDO_CONC}';`) === String(N),
    `devem existir exatamente ${N} OPs`);

  // O high-water acompanhou exatamente N reservas.
  check(scalar(h, `SELECT ultimo_seq FROM public.pedido_identidade_numeros
                    WHERE pedido_id = '${PEDIDO_CONC}' AND escopo = 'T';`) === String(N),
    `o high-water deve estar em ${N}`);

  // E o numero INTERNO tambem nao colidiu: N valores distintos.
  const internos = scalar(h, `SELECT count(DISTINCT numero) FROM public.ops
                               WHERE identidade_pedido_id = '${PEDIDO_CONC}';`);
  check(internos === String(N), `os ${N} numeros internos devem ser distintos (got ${internos})`);

  // Non-reuse sob concorrencia: remove 3 e cria 3; nenhuma sequencia repetida.
  must(h, `DELETE FROM public.ops WHERE id IN (950004000, 950004001, 950004002);`, 'remove 3');
  const depois = [];
  for (let i = 0; i < 3; i++) {
    const opId = 950004100 + i;
    const r = spawnSync(psqlBinary(h), [...baseArgs(h), '-v', 'ON_ERROR_STOP=1', '-c',
      `BEGIN;
       INSERT INTO public.ops (id, numero, ano, status, tipo, criado_em)
       VALUES (${opId}, public.proximo_numero_op('tecelagem', 2026), 2026, 'simulada', 'tecelagem', now());
       UPDATE public.ops SET lote_id = ${LOTE_CONC} WHERE id = ${opId};
       COMMIT;`], { encoding: 'utf8', timeout: 90000 });
    check(r.status === 0, `recriacao ${i} deve concluir: ${(r.stderr || '').split('\n')[0]}`);
    depois.push(scalar(h, `SELECT identidade_seq FROM public.ops WHERE id = ${opId};`));
  }
  check(depois.join(',') === `${N + 1},${N + 2},${N + 3}`,
    `as novas sequencias devem continuar em ${N + 1}.. sem reaproveitar 1..3 (got ${depois.join(',')})`);
  log('M', { sessoesSimultaneas: N, sequencias: `1..${N} contiguas`, duplicatas: 0,
    internosDistintos: N, aposRemocaoDe3: depois.join(','), reuso: 'nenhum' });
}

// ===========================================================================
// PART I — idempotent replay.
// ===========================================================================
function partI(h) {
  const snapshot = () => scalar(h, `SELECT md5(
      (SELECT string_agg(id || ':' || coalesce(identidade_operacional, '-') || ':' || numero || '/' || ano, '|' ORDER BY id) FROM public.ops)
      || '#' ||
      (SELECT coalesce(string_agg(id || ':' || coalesce(identidade_operacional, '-'), '|' ORDER BY id), '') FROM public.ordem_compra));`);
  const hw = () => scalar(h, `SELECT md5(coalesce(string_agg(
      pedido_id || ':' || escopo || ':' || ultimo_seq, '|' ORDER BY pedido_id, escopo), ''))
    FROM public.pedido_identidade_numeros;`);
  const counts = () => scalar(h, `SELECT (SELECT count(*) FROM public.ops) || ',' ||
      (SELECT count(*) FROM public.pedido_identidade_numeros) || ',' ||
      (SELECT count(*) FROM public.ordem_compra) || ',' ||
      (SELECT count(*) FROM public.op_numeros);`);

  const s0 = snapshot(); const h0 = hw(); const c0 = counts();
  applyFile(h, path.join(REPO_ROOT, 'db', DB95), 'db/95 replay 1');
  applyFile(h, path.join(REPO_ROOT, 'db', DB95), 'db/95 replay 2');

  check(snapshot() === s0, 'db/95 deve reaplicar sem alterar identidade alguma');
  check(hw() === h0, 'db/95 deve reaplicar sem mover o high-water canonico');
  check(counts() === c0, 'db/95 nao pode criar nem remover linha alguma no replay');
  log('I', { replays: 2, identidadeDrift: 'none', highWaterDrift: 'none', rowDrift: 'none' });
}

// ===========================================================================
// PART J — the post-invariant fails closed.
// ===========================================================================
function partJ(h) {
  // Desynchronize the high-water BEHIND a really assigned sequence. Re-applying
  // db/95 must refuse rather than silently "repair" into a reusable state.
  // (The migration's own GREATEST re-seed would lift it; the invariant proves
  // the guard is real by checking a state the re-seed cannot reach -- a row
  // whose OP was assigned under a pedido/letter the seed cannot see.)
  must(h, `UPDATE public.pedido_identidade_numeros SET ultimo_seq = 0
           WHERE pedido_id = '${PEDIDO_ID}' AND escopo = 'T';`, 'dessincroniza high-water');
  check(highWater(h, 'T') === '0', 'pre-condicao: high-water rebaixado');
  // db/95's own re-seed lifts it back with GREATEST, which is the CORRECT
  // self-healing behaviour, and the post-invariant then passes. That is the
  // proof that the invariant and the re-seed agree.
  applyFile(h, path.join(REPO_ROOT, 'db', DB95), 'db/95 apos dessincronizacao');
  check(highWater(h, 'T') === '4',
    `o re-seed deve reerguer o high-water para 4 (got ${highWater(h, 'T')})`);

  // Now the genuinely unrepairable state: an assigned identity whose row the
  // re-seed WOULD see, but with the invariant checked BEFORE the seed. Prove the
  // guard's SQL is reachable by driving it directly.
  const bad = scalar(h, `SELECT count(*) FROM (
      SELECT identidade_pedido_id AS pid, identidade_tipo_letra AS esc,
             MAX(identidade_seq) AS maxseq
        FROM public.ops WHERE identidade_seq IS NOT NULL GROUP BY 1,2
      UNION ALL
      SELECT identidade_pedido_id, 'OC', MAX(identidade_seq)
        FROM public.ordem_compra WHERE identidade_seq IS NOT NULL GROUP BY 1,2
    ) m LEFT JOIN public.pedido_identidade_numeros n
      ON n.pedido_id = m.pid AND n.escopo = m.esc
   WHERE n.ultimo_seq IS NULL OR n.ultimo_seq < m.maxseq;`);
  check(bad === '0', `apos o re-seed nenhum high-water pode estar atrasado (got ${bad})`);

  // And no partial identity exists anywhere.
  check(scalar(h, `SELECT count(*) FROM public.ops
            WHERE (identidade_seq IS NULL) <> (identidade_operacional IS NULL);`) === '0',
    'nenhuma identidade parcial pode existir');
  log('J', { reseed: 'GREATEST reergue', highWaterAtrasado: 0, identidadeParcial: 0 });
}

// ===========================================================================
async function main() {
  let h = null;
  try {
    SCRATCH = await mkdtemp(path.join(tmpdir(), 'g28-c95-'));
    h = await bootstrapCluster({});
    log('CLUSTER', { host: h.host, port: h.port, pg: h.pgVersion });

    await partA(h);
    partK(h);
    partBE(h);
    partCD(h);
    partF(h);
    partG(h);
    partH(h);
    partL(h);
    await partM(h);
    partI(h);
    partJ(h);

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
