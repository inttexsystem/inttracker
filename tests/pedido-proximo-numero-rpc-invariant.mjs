// tests/pedido-proximo-numero-rpc-invariant.mjs
//
// KLEBER-APP-OPERATIONAL-STABILIZATION disposable-cluster proof of
// db/90_pedido_proximo_numero_suggestion_rpc.sql — the admin-only RPC that lets
// the new-Pedido form OPEN with the next number already visible.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. The Supabase-platform preamble and
// every fixture are rebuilt in OS temp files outside the repository.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   Part A  db/01..db/90 apply cleanly, in order, and db/90 is the terminal.
//   Part B  db/90 re-applies with a before/after fingerprint proving zero
//           schema / constraint / trigger / function / grant drift.
//   Part C  ACL: EXECUTE is revoked from PUBLIC and anon and granted to
//           authenticated; a non-admin authenticated caller is refused 42501;
//           an admin caller is answered. anon cannot reach the number at all.
//   Part D  the suggestion is CORRECT: it equals the number the very next
//           automatic INSERT actually receives — and a sequence whose next
//           value is 2 answers exactly 2.
//   Part E  OBSERVATION ONLY: calling it many times does not consume or advance
//           the sequence, and the number it suggested is still the number the
//           next automatic INSERT gets afterwards.
//   Part F  it follows the SEQUENCE, not MAX(numero). Three divergences are
//           built on purpose: a rolled-back creation that burned a sequence
//           value, a deleted high-numbered Pedido, and an accepted gap. In all
//           three MAX(numero)+1 is a DIFFERENT (and wrong) answer, and the RPC
//           does not return it.
//   Part G  the accepted gap is respected: the suggestion never walks backwards
//           into it, and a manual available number is accepted while an
//           occupied one is refused with 23505.
//   Part H  the number is immutable after creation: renumbering is refused.
//   Part Z  mandatory full cluster destruction.
//
// Run:  node tests/pedido-proximo-numero-rpc-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 90;
const DB90 = '90_pedido_proximo_numero_suggestion_rpc.sql';

// Supabase-platform preamble (roles/auth/extensions the repo migrations expect).
const PREAMBLE_SQL = `
DO $preamble$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$preamble$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  raw_user_meta_data jsonb, raw_app_meta_data jsonb);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; $fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text; $fn$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
`;

// db/67 fails closed unless the 64-row REFUND-A corpus exists, so it is planted
// after db/66 exactly as the accepted C3D/Manta harnesses do. It is unrelated to
// this order's subject and is present only to let the chain reach db/90.
const CORPUS_SQL = `
INSERT INTO public.cores (id, nome) VALUES (930000201, 'C3D-CORPUS-COR-ALGODAO')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (930000301, 'C3D-CORPUS-FORN-A (matching)', 'fio_algodao'),
  (930000302, 'C3D-CORPUS-FORN-B (control)',  'fio_algodao')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ops (id, numero, ano) VALUES (930000101, 990001, 2099)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.saldo_fios (tipo, cor_id, cor_poliester, kg_total)
  VALUES ('algodao', 930000201, NULL, 100.000)
  ON CONFLICT DO NOTHING;

INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester,
   kg_pedido, kg_recebido, data_pedido, data_recebimento,
   status, status_administrativo, status_aceite, status_recebimento,
   legado_recebimento_automatico)
VALUES
  (930000311, 930000101, 930000301, 'algodao', 930000201, NULL,
   15.500, 5.000, DATE '2026-01-05', NULL,
   'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE),
  (930000312, 930000101, 930000302, 'algodao', 930000201, NULL,
   12.000, NULL, DATE '2026-01-05', NULL,
   'pendente', 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE);

INSERT INTO public.ordens_compra_fio
  (id, op_id, fornecedor_id, tipo, cor_id, cor_poliester,
   kg_pedido, kg_recebido, data_pedido, data_recebimento,
   status, status_administrativo, status_aceite, status_recebimento,
   legado_recebimento_automatico)
SELECT
  gs, 930000101, 930000301, 'algodao', 930000201, NULL,
  10.000,
  CASE WHEN cls.status = 'recebido_total' THEN 10.000 ELSE NULL END,
  DATE '2026-01-01',
  CASE WHEN cls.status = 'recebido_total' THEN DATE '2026-02-01' ELSE NULL END,
  cls.status, cls.status_administrativo, 'nao_aplicavel', cls.status_recebimento, FALSE
FROM generate_series(930000313, 930000374) AS gs
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN gs BETWEEN 930000313 AND 930000349 THEN 'emitida' ELSE 'rascunho' END AS status_administrativo,
    CASE
      WHEN gs BETWEEN 930000313 AND 930000322 THEN 'pendente'
      WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido_total'
      WHEN gs BETWEEN 930000350 AND 930000362 THEN 'pendente'
      ELSE 'recebido_total'
    END AS status,
    CASE
      WHEN gs BETWEEN 930000323 AND 930000349 THEN 'recebido'
      WHEN gs BETWEEN 930000363 AND 930000374 THEN 'recebido'
      ELSE 'nao_recebido'
    END AS status_recebimento
) AS cls;

DO $corpus$
DECLARE v_a int; v_b int; v_c int; v_d int; v_tot int;
BEGIN
  SELECT count(*) FILTER (WHERE status_administrativo='emitida'  AND status='recebido_total'),
         count(*) FILTER (WHERE status_administrativo='emitida'  AND status='pendente'),
         count(*) FILTER (WHERE status_administrativo='rascunho' AND status='pendente'),
         count(*) FILTER (WHERE status_administrativo='rascunho' AND status='recebido_total'),
         count(*)
    INTO v_a, v_b, v_c, v_d, v_tot FROM public.ordens_compra_fio;
  IF v_tot <> 64 OR v_a <> 27 OR v_b <> 12 OR v_c <> 13 OR v_d <> 12 THEN
    RAISE EXCEPTION 'corpus mismatch: total=%, A=%, B=%, C=%, D=% (expected 64/27/12/13/12)', v_tot, v_a, v_b, v_c, v_d;
  END IF;
END
$corpus$;
`;

const CLI = 950000101;
const ADMIN_UID = '00000000-0000-4000-8000-000000000a11';
const PLAIN_UID = '00000000-0000-4000-8000-000000000b22';

// One real admin and one real non-admin, so the is_admin() gate is proved with
// both a positive and a negative subject rather than by inspection.
const ATORES_SQL = `
INSERT INTO public.clientes (id, nome) VALUES (${CLI}, 'PREFILL-CLIENTE') ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_UID}', 'admin@prefill.local'),
  ('${PLAIN_UID}', 'comum@prefill.local')
  ON CONFLICT (id) DO NOTHING;
-- O nao-admin e um fornecedor REAL e ATIVO: a recusa tem de vir do gate de
-- admin, nao de um usuario invalido ou desativado.
INSERT INTO public.usuarios (id, email, nome, tipo, fornecedor_id, ativo) VALUES
  ('${ADMIN_UID}', 'admin@prefill.local', 'Admin Prefill', 'admin', NULL, TRUE),
  ('${PLAIN_UID}', 'comum@prefill.local', 'Comum Prefill', 'fornecedor', 930000301, TRUE)
  ON CONFLICT (id) DO NOTHING;
`;

// ---------------------------------------------------------------------------
let FAILURES = 0;
function check(cond, msg) {
  if (cond) return true;
  FAILURES += 1;
  throw new Error(`PROOF FAILED: ${msg}`);
}
function log(tag, obj) {
  const body = obj && typeof obj === 'object'
    ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('|')
    : String(obj ?? '');
  console.log(body ? `${tag}|${body}` : tag);
}
function psqlBinary(handle) {
  return path.join(handle.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
}
function baseArgs(handle) {
  return ['-X', '-w', '-q', '-A', '-t', '-h', handle.host, '-p', String(handle.port), '-U', handle.user, '-d', handle.database];
}

function applyFile(handle, file, label) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 180000,
  });
  if (result.status !== 0) {
    const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
    throw new Error(`APPLY_FAILED (${label || file}): ${diag}`);
  }
  return result.stdout || '';
}

let SCRATCH_DIR = null;
async function applySql(handle, name, sql, label) {
  const file = path.join(SCRATCH_DIR, name);
  await writeFile(file, sql, 'utf8');
  return applyFile(handle, file, label || name);
}

function run(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 60000,
  });
  return { ok: result.status === 0, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}
function scalar(handle, sql) {
  const r = run(handle, sql);
  if (!r.ok) throw new Error(`QUERY_FAILED: ${r.err || r.out}`);
  return r.out;
}
function mustFail(handle, sql, label) {
  const r = run(handle, sql);
  check(!r.ok, `${label}: deveria ser recusado, mas foi aceito`);
  return r.err.split('\n')[0];
}

// Order-stable schema fingerprint. ORDER BY the line text makes it independent
// of catalog/OID ordering, so it detects drift and nothing else.
function schemaFingerprint(handle) {
  return scalar(handle, `
    WITH t AS (
      SELECT 'COL '||table_schema||'.'||table_name||'.'||column_name||' '||data_type||' '||is_nullable||' '||coalesce(column_default,'') AS line
        FROM information_schema.columns WHERE table_schema='public'
      UNION ALL
      SELECT 'CON '||conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid)
        FROM pg_constraint WHERE connamespace='public'::regnamespace
      UNION ALL
      SELECT 'TRG '||tgrelid::regclass::text||' '||tgname||' '||pg_get_triggerdef(oid)
        FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'public.%'
      UNION ALL
      SELECT 'FN '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid))
        FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      UNION ALL
      SELECT 'GRANT '||grantee||' '||table_name||' '||privilege_type
        FROM information_schema.role_table_grants WHERE table_schema='public'
      UNION ALL
      SELECT 'GRANTFN '||grantee||' '||routine_name||' '||privilege_type
        FROM information_schema.role_routine_grants WHERE routine_schema='public'
    )
    SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
}

const seqLast = (handle) => scalar(handle,
  `SELECT coalesce(pg_sequence_last_value(pg_get_serial_sequence('public.pedidos','numero')::regclass)::text, 'NULL');`);
const maxNumero = (handle) => scalar(handle,
  `SELECT coalesce(max(numero)::text, 'NULL') FROM public.pedidos;`);

// A sugestao SEMPRE e lida como o admin, porque e o unico papel autorizado.
// `SET LOCAL ROLE` + o GUC de JWT reproduzem exatamente o que o PostgREST faz.
function sugestaoComoAdmin(handle) {
  return scalar(handle, `
    BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claim.sub = '${ADMIN_UID}';
      SELECT public.consultar_proximo_numero_pedido();
    COMMIT;`);
}

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

// ===========================================================================
// PART A — full chain apply.
// ===========================================================================
async function partA(handle) {
  const manifest = await resolveManifest();
  check(manifest.length === EXPECTED_TERMINAL,
    `manifest deve ser db/01..db/${EXPECTED_TERMINAL} (got ${manifest.length})`);
  check(manifest[manifest.length - 1].n === EXPECTED_TERMINAL,
    `migration terminal deve ser db/${EXPECTED_TERMINAL}`);
  check(path.basename(manifest[manifest.length - 1].file) === DB90, `terminal deve ser ${DB90}`);

  await applySql(handle, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(handle, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
    applyFile(handle, file, path.basename(file));
  }
  await applySql(handle, 'atores.sql', ATORES_SQL, 'atores');
  log('A', { migrations: manifest.length, terminal: EXPECTED_TERMINAL, applied: 'clean' });
}

// ===========================================================================
// PART B — idempotent re-apply, zero drift.
// ===========================================================================
async function partB(handle) {
  const before = schemaFingerprint(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', DB90), 'db/90 replay');
  const after = schemaFingerprint(handle);
  check(before === after, `db/90 deve reaplicar sem drift (${before} != ${after})`);
  log('B', { drift: 'NONE' });
}

// ===========================================================================
// PART C — ACL and the admin gate.
// ===========================================================================
async function partC(handle) {
  const priv = (role) => scalar(handle,
    `SELECT has_function_privilege('${role}', 'public.consultar_proximo_numero_pedido()', 'EXECUTE');`);
  check(priv('authenticated') === 't', 'authenticated deve ter EXECUTE');
  check(priv('anon') === 'f', 'anon NAO pode ter EXECUTE');

  const acl = scalar(handle, `
    SELECT coalesce(array_to_string(proacl, ','), 'NULL') FROM pg_proc
     WHERE oid = 'public.consultar_proximo_numero_pedido()'::regprocedure;`);
  check(!/^=X/.test(acl) && !/,=X/.test(acl), `PUBLIC nao pode ter EXECUTE (acl=${acl})`);
  check(/anon=/.test(acl) === false, `anon nao pode aparecer com privilegio (acl=${acl})`);

  // Autenticado NAO-admin: recusado 42501 (403 no PostgREST).
  const negado = mustFail(handle, `
    BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claim.sub = '${PLAIN_UID}';
      SELECT public.consultar_proximo_numero_pedido();
    COMMIT;`, 'autenticado nao-admin');
  check(/acesso negado/i.test(negado), `a recusa deve vir do gate de admin (got ${negado})`);

  // Autenticado sem JWT algum: tambem recusado (auth.uid() nulo).
  const semJwt = mustFail(handle, `
    BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT public.consultar_proximo_numero_pedido();
    COMMIT;`, 'autenticado sem JWT');
  check(/acesso negado/i.test(semJwt), `sem JWT tambem deve ser recusado (got ${semJwt})`);

  // anon: recusado ja no privilegio de EXECUTE, antes do corpo.
  const anonErr = mustFail(handle, `
    BEGIN;
      SET LOCAL ROLE anon;
      SELECT public.consultar_proximo_numero_pedido();
    COMMIT;`, 'anon');
  check(/permission denied|permissao negada|permissão negada/i.test(anonErr),
    `anon deve ser barrado por privilegio (got ${anonErr})`);

  // Admin: respondido.
  const valor = sugestaoComoAdmin(handle);
  check(/^\d+$/.test(valor) && Number(valor) > 0, `o admin deve receber um inteiro positivo (got ${valor})`);
  log('C', { authenticated: 'EXECUTE', anon: 'DENIED', naoAdmin: '42501', admin: valor });
}

// ===========================================================================
// PART D — the suggestion equals what the next automatic INSERT really gets.
// ===========================================================================
async function partD(handle) {
  // Sequencia virgem: nenhum Pedido foi criado ainda nesta base.
  check(seqLast(handle) === 'NULL', 'a sequencia deve estar virgem no inicio da parte D');
  const primeira = sugestaoComoAdmin(handle);
  check(primeira === '1', `numa sequencia virgem a sugestao deve ser 1 (got ${primeira})`);

  const real1 = scalar(handle, `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`);
  check(real1 === primeira, `a sugestao ${primeira} tem de ser o numero realmente alocado (got ${real1})`);

  // PROVA EXIGIDA: uma sequencia cujo proximo valor e 2 responde exatamente 2.
  const segunda = sugestaoComoAdmin(handle);
  check(segunda === '2', `com a sequencia em 1 a sugestao deve ser 2 (got ${segunda})`);
  const real2 = scalar(handle, `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`);
  check(real2 === '2', `o proximo automatico deve ser 2 (got ${real2})`);

  log('D', { virgem: primeira, alocado1: real1, sugestao2: segunda, alocado2: real2 });
}

// ===========================================================================
// PART E — observation only: consulting never consumes or advances.
// ===========================================================================
async function partE(handle) {
  const seqAntes = seqLast(handle);
  const respostas = [];
  for (let i = 0; i < 5; i += 1) respostas.push(sugestaoComoAdmin(handle));
  const seqDepois = seqLast(handle);

  check(seqAntes === seqDepois,
    `consultar NAO pode mover a sequencia (${seqAntes} -> ${seqDepois})`);
  check(new Set(respostas).size === 1,
    `5 consultas seguidas devem devolver o MESMO candidato (got ${respostas.join(',')})`);

  // E o candidato continua correto depois de todas as consultas: abrir o
  // formulario 5 vezes nao queimou 5 numeros.
  const alocado = scalar(handle, `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`);
  check(alocado === respostas[0],
    `apos 5 consultas o proximo automatico ainda deve ser ${respostas[0]} (got ${alocado})`);
  log('E', { seq: seqAntes, consultas: respostas.join(','), alocado });
}

// ===========================================================================
// PART F — follows the SEQUENCE, never MAX(numero).
// ===========================================================================
async function partF(handle) {
  // F1. Uma criacao REVERTIDA consome um valor da sequencia que nenhuma linha
  //     vai carregar. MAX(numero)+1 passa a apontar para um numero que a
  //     sequencia ja deixou para tras.
  scalar(handle, `BEGIN; INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}); ROLLBACK;`);
  const seqAposRollback = Number(seqLast(handle));
  const maxAposRollback = Number(maxNumero(handle));
  check(seqAposRollback > maxAposRollback,
    `o rollback deve deixar a sequencia (${seqAposRollback}) a frente de MAX (${maxAposRollback})`);
  const sug1 = Number(sugestaoComoAdmin(handle));
  check(sug1 === seqAposRollback + 1,
    `a sugestao deve seguir a sequencia (${seqAposRollback + 1}), got ${sug1}`);
  check(sug1 !== maxAposRollback + 1,
    `a sugestao NAO pode ser MAX(numero)+1 (${maxAposRollback + 1})`);
  log('F1', { seq: seqAposRollback, max: maxAposRollback, sugestao: sug1, maxMais1: maxAposRollback + 1 });

  // F2. Um numero manual ALTO avanca a sequencia (db/89); apagar essa linha
  //     derruba MAX mas nao a sequencia. A divergencia fica enorme e obvia.
  const alto = 5000;
  scalar(handle, `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${alto});`);
  check(Number(seqLast(handle)) === alto, `o numero manual alto deve avancar a sequencia para ${alto}`);
  scalar(handle, `DELETE FROM public.pedidos WHERE numero = ${alto};`);
  const maxAposDelete = Number(maxNumero(handle));
  check(maxAposDelete < alto, `apagar o Pedido ${alto} deve derrubar MAX (got ${maxAposDelete})`);
  const sug2 = Number(sugestaoComoAdmin(handle));
  check(sug2 === alto + 1, `a sugestao deve continuar seguindo a sequencia (${alto + 1}), got ${sug2}`);
  check(sug2 !== maxAposDelete + 1,
    `a sugestao NAO pode retroceder para MAX(numero)+1 (${maxAposDelete + 1})`);

  // E ela esta certa: o proximo automatico e exatamente esse numero.
  const real = Number(scalar(handle, `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`));
  check(real === sug2, `o proximo automatico deve ser ${sug2} (got ${real})`);
  log('F2', { seq: alto, max: maxAposDelete, sugestao: sug2, alocado: real });
}

// ===========================================================================
// PART G — accepted gaps, manual numbers, conflict.
// ===========================================================================
async function partG(handle) {
  // A lacuna deixada pelo rollback e pelo delete continua vazia e a sugestao
  // NUNCA anda para tras para tenta-la: lacunas sao aceitas por projeto.
  const lacunas = scalar(handle, `
    SELECT count(*) FROM generate_series(1, (SELECT max(numero) FROM public.pedidos)) n
     WHERE NOT EXISTS (SELECT 1 FROM public.pedidos p WHERE p.numero = n);`);
  check(Number(lacunas) > 0, 'a montagem desta prova exige pelo menos uma lacuna aceita');
  const sug = Number(sugestaoComoAdmin(handle));
  const maior = Number(maxNumero(handle));
  check(sug > maior, `a sugestao (${sug}) nao pode cair dentro de uma lacuna abaixo de MAX (${maior})`);

  // Um numero manual DISPONIVEL (dentro de uma lacuna) e aceito exatamente.
  const livre = Number(scalar(handle, `
    SELECT min(n) FROM generate_series(1, (SELECT max(numero) FROM public.pedidos)) n
     WHERE NOT EXISTS (SELECT 1 FROM public.pedidos p WHERE p.numero = n);`));
  const aceito = Number(scalar(handle,
    `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${livre}) RETURNING numero;`));
  check(aceito === livre, `um numero manual livre deve persistir exatamente (got ${aceito})`);
  // Preencher uma lacuna baixa nao pode mover a sugestao.
  check(Number(sugestaoComoAdmin(handle)) === sug,
    'preencher uma lacuna baixa nao pode alterar a sugestao');

  // Um numero manual OCUPADO e recusado pelo UNIQUE — a autoridade final.
  const dupErr = mustFail(handle,
    `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${livre});`, 'numero ocupado');
  check(/unic|uniqu/i.test(dupErr), `um numero ocupado deve falhar por UNIQUE (got ${dupErr})`);

  log('G', { lacunas, sugestao: sug, max: maior, manualLivre: aceito, duplicado: 'rejeitado' });
}

// ===========================================================================
// PART H — the number is immutable after creation.
// ===========================================================================
async function partH(handle) {
  const alvo = Number(maxNumero(handle));
  const err = mustFail(handle,
    `UPDATE public.pedidos SET numero = numero + 100000 WHERE numero = ${alvo};`, 'renumeracao');
  check(/imutavel/i.test(err), `a recusa deve vir do guard de imutabilidade (got ${err})`);
  const same = run(handle, `UPDATE public.pedidos SET numero = ${alvo} WHERE numero = ${alvo};`);
  check(same.ok, `UPDATE de mesmo valor deve ser aceito (got ${same.err})`);
  check(Number(maxNumero(handle)) === alvo, 'o numero nao pode ter mudado');
  log('H', { renumerar: 'rejeitado', mesmoValor: 'aceito' });
}

// ===========================================================================
async function main() {
  let handle = null;
  try {
    SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'g28-prefill-'));
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pg: handle.pgVersion });

    await partA(handle);
    await partB(handle);
    await partC(handle);
    await partD(handle);
    await partE(handle);
    await partF(handle);
    await partG(handle);
    await partH(handle);

    console.log(`\nALL PROOFS PASSED (failures=${FAILURES})`);
  } catch (error) {
    FAILURES += 1;
    console.error(`\nHARNESS ERROR: ${error.message}`);
  } finally {
    // PART Z — mandatory destruction.
    if (handle) {
      try {
        const proof = await handle.stop();
        log('Z', { destroyed: 'true', pidAbsent: proof?.pidAbsent ?? 'n/a', portClosed: proof?.portClosed ?? 'n/a' });
      } catch (e) {
        FAILURES += 1;
        console.error(`CLUSTER DESTRUCTION FAILED: ${e.message}`);
      }
    }
    if (SCRATCH_DIR) await rm(SCRATCH_DIR, { recursive: true, force: true });
  }
  process.exit(FAILURES === 0 ? 0 : 1);
}

await main();
