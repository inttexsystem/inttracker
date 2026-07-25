// tests/pedido-commercial-date-and-number-invariant.mjs
//
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1 disposable-cluster proof of
// db/89_pedido_commercial_date_and_number_control.sql.
//
// ENVIRONMENT: disposable local PostgreSQL 18.4 ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. The Supabase-platform preamble and
// every fixture are rebuilt in OS temp files outside the repository.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   Part A  db/01..db/89 apply cleanly, in order, with two legacy Pedidos planted
//           BEFORE db/89 so the data_pedido backfill has real subjects. The
//           timestamps are chosen so the Brazil projection changes the calendar
//           day: 02:30Z -> previous day in America/Sao_Paulo. A naive
//           `criado_em::date` (UTC) would yield the WRONG day and fail here.
//   Part B  db/89 re-applies with a before/after fingerprint proving zero
//           schema / constraint / trigger / function / grant drift, and the
//           backfill does not rewrite a date the operator already corrected.
//   Part C  data_pedido: default is the Brazil-local date; an explicit value
//           persists verbatim; the column is NOT NULL.
//   Part D  numbering: automatic allocation still works; an available manual
//           number is accepted exactly; a duplicate is rejected; zero and
//           negative are rejected; a manual HIGH number advances the sequence so
//           the next automatic number cannot collide; a manual LOW unused number
//           never moves the sequence backwards.
//   Part E  immutability: any UPDATE changing numero is rejected; a same-value
//           UPDATE is accepted.
//   Part F  concurrency, TWO real distinct psql sessions: two transactions
//           inserting the SAME manual number yield exactly one Pedido, the loser
//           gets 23505, and no duplicated numero exists anywhere.
//   Part Z  mandatory full cluster destruction.
//
// Run:  node tests/pedido-commercial-date-and-number-invariant.mjs
// Exits nonzero on any missing or failed proof.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 89;
const DB89 = '89_pedido_commercial_date_and_number_control.sql';

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
// this order's subject and is present only to let the chain reach db/89.
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

// Two legacy Pedidos planted BEFORE db/89. Their criado_em instants are chosen so
// that the Brazil projection lands on a DIFFERENT calendar day than UTC:
//   2026-03-10 02:30Z -> 2026-03-09 23:30 America/Sao_Paulo -> 2026-03-09
//   2026-03-11 01:00Z -> 2026-03-10 22:00 America/Sao_Paulo -> 2026-03-10
// A naive criado_em::date would give 2026-03-10 / 2026-03-11 and fail Part A.
const LEGACY_PEDIDOS_SQL = `
INSERT INTO public.clientes (id, nome) VALUES (940000101, 'B02-LEGADO-CLIENTE') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pedidos (cliente_id, status, criado_em)
  VALUES (940000101, 'rascunho', TIMESTAMPTZ '2026-03-10 02:30:00+00');
INSERT INTO public.pedidos (cliente_id, status, criado_em)
  VALUES (940000101, 'rascunho', TIMESTAMPTZ '2026-03-11 01:00:00+00');
`;

// ---------------------------------------------------------------------------
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

// Interactive line-sentinel psql session (accepted idiom from the C3D lock harness).
function openSession(handle, name) {
  const child = spawn(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=0'], {
    env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = [];
  const waiters = [];
  let pending = '';
  let stderr = '';
  let closed = false;
  let closeError;
  function publish(line) {
    const value = line.trim();
    if (!value) return;
    lines.push(value);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(value)) {
        clearTimeout(waiter.timer);
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(value);
      }
    }
  }
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    pending += chunk;
    const complete = pending.split(/\r?\n/);
    pending = complete.pop() || '';
    complete.forEach(publish);
  });
  child.stderr.on('data', (chunk) => { stderr += chunk; publish(chunk); });
  child.on('error', (error) => { closeError = error; });
  const completion = new Promise((resolve, reject) => {
    child.on('close', (code) => {
      closed = true;
      if (pending) publish(pending);
      const err = closeError || null;
      for (const waiter of waiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(err || new Error(`${name} closed early`)); }
      if (err) reject(err); else resolve({ lines, stderr });
    });
  });
  completion.catch(() => {});
  return {
    name,
    get closed() { return closed; },
    get stderr() { return stderr; },
    get lines() { return lines; },
    send(sql) { assert.equal(closed, false, `${name} is already closed`); child.stdin.write(`${sql}\n`); },
    waitFor(predicate, timeoutMs = 30000) {
      const existing = lines.find(predicate);
      if (existing) return Promise.resolve(existing);
      if (closed) return Promise.reject(closeError || new Error(`${name} closed`));
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, reject };
        waiter.timer = setTimeout(() => {
          const i = waiters.indexOf(waiter); if (i >= 0) waiters.splice(i, 1);
          reject(new Error(`${name} timed out; output=${lines.join(' | ')}; stderr=${stderr}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    async close() { if (!closed) { try { child.stdin.end('\\q\n'); } catch { /* ignore */ } } return completion; },
  };
}

async function waitForBlock(handle, subjectPid, blockerPid, attempts = 200) {
  for (let i = 0; i < attempts; i += 1) {
    const row = scalar(handle, `SELECT array_to_string(pg_catalog.pg_blocking_pids(${subjectPid}), ',');`);
    if (row.split(',').includes(String(blockerPid))) return row;
    await delay(50);
  }
  throw new Error(`backend ${subjectPid} did not block on ${blockerPid}`);
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
const CLI = 940000101;

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

// ===========================================================================
// PART A — full chain apply + Brazil-local backfill (proofs 1 and 3).
// ===========================================================================
async function partA(handle) {
  const manifest = await resolveManifest();
  check(manifest.length === EXPECTED_TERMINAL,
    `manifest deve ser db/01..db/${EXPECTED_TERMINAL} (got ${manifest.length})`);
  check(manifest[manifest.length - 1].n === EXPECTED_TERMINAL,
    `migration terminal deve ser db/${EXPECTED_TERMINAL}`);
  check(path.basename(manifest[manifest.length - 1].file) === DB89, `terminal deve ser ${DB89}`);

  await applySql(handle, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(handle, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
    if (n === 89) await applySql(handle, 'legacy.sql', LEGACY_PEDIDOS_SQL, 'legacy pedidos (before db/89)');
    applyFile(handle, file, path.basename(file));
  }
  log('A1', { migrations: manifest.length, terminal: EXPECTED_TERMINAL, applied: 'clean' });

  const dates = scalar(handle,
    `SELECT string_agg(data_pedido::text, ',' ORDER BY numero) FROM public.pedidos WHERE cliente_id=${CLI};`);
  check(dates === '2026-03-09,2026-03-10',
    `backfill deve projetar criado_em em America/Sao_Paulo (esperado 2026-03-09,2026-03-10; obtido ${dates})`);
  const nulls = scalar(handle, `SELECT count(*) FROM public.pedidos WHERE data_pedido IS NULL;`);
  check(Number(nulls) === 0, `nenhum data_pedido pode restar nulo (got ${nulls})`);
  log('A2', { backfill: dates, nulls });
}

// ===========================================================================
// PART B — idempotent re-apply, zero drift (proof 2).
// ===========================================================================
async function partB(handle) {
  // Uma data ja corrigida pelo operador nao pode ser reescrita por um replay.
  scalar(handle, `UPDATE public.pedidos SET data_pedido = DATE '2020-01-02' WHERE numero = 1;`);

  const before = schemaFingerprint(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', DB89), 'db/89 replay');
  const after = schemaFingerprint(handle);
  check(before === after, `db/89 deve reaplicar sem drift (${before} != ${after})`);

  const corrected = scalar(handle, `SELECT data_pedido FROM public.pedidos WHERE numero = 1;`);
  check(corrected === '2020-01-02',
    `o replay nao pode reescrever uma data ja corrigida (got ${corrected})`);
  log('B', { drift: 'NONE', correctedDatePreserved: corrected });
}

// ===========================================================================
// PART C — data_pedido default / explicit / NOT NULL (proofs 4 and 5).
// ===========================================================================
async function partC(handle) {
  const brDate = scalar(handle, `SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text;`);
  const auto = scalar(handle,
    `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING data_pedido::text;`);
  check(auto === brDate, `default deve ser a data local do Brasil (esperado ${brDate}, obtido ${auto})`);

  const explicit = scalar(handle,
    `INSERT INTO public.pedidos (cliente_id, data_pedido) VALUES (${CLI}, DATE '2026-01-15') RETURNING data_pedido::text;`);
  check(explicit === '2026-01-15', `data_pedido explicita deve persistir verbatim (got ${explicit})`);

  mustFail(handle,
    `INSERT INTO public.pedidos (cliente_id, data_pedido) VALUES (${CLI}, NULL);`,
    'data_pedido NULL');
  log('C', { default: auto, explicit, notNull: 'enforced' });
}

// ===========================================================================
// PART D — numbering (proofs 6, 7, 8, 9, 10, 11, 12).
// ===========================================================================
async function partD(handle) {
  // 6. automatic numbering still works and consumes the sequence.
  const beforeAuto = seqLast(handle);
  const autoNum = Number(scalar(handle,
    `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`));
  check(autoNum > Number(beforeAuto), `numeracao automatica deve avancar (${beforeAuto} -> ${autoNum})`);

  // 7. an available manual number is accepted EXACTLY as supplied.
  const manualHigh = 5000;
  const got = Number(scalar(handle,
    `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${manualHigh}) RETURNING numero;`));
  check(got === manualHigh, `numero manual disponivel deve persistir exatamente (got ${got})`);

  // 10. the manual HIGH number advanced the sequence.
  check(Number(seqLast(handle)) === manualHigh,
    `numero manual alto deve avancar a sequencia para ${manualHigh} (got ${seqLast(handle)})`);

  // 12. the next automatic number does not collide with the manual one.
  const next = Number(scalar(handle,
    `INSERT INTO public.pedidos (cliente_id) VALUES (${CLI}) RETURNING numero;`));
  check(next === manualHigh + 1, `proximo automatico deve ser ${manualHigh + 1} (got ${next})`);

  // 11. a manual LOW unused number must not move the sequence backwards.
  const seqBefore = Number(seqLast(handle));
  // Menor numero AINDA LIVRE abaixo da sequencia corrente — calculado, nunca
  // fixado, para a prova nao depender de quantas linhas as partes anteriores
  // criaram.
  const lowUnused = Number(scalar(handle, `
    SELECT min(n) FROM generate_series(1, ${seqBefore}) n
     WHERE NOT EXISTS (SELECT 1 FROM public.pedidos p WHERE p.numero = n);`));
  check(Number.isFinite(lowUnused) && lowUnused > 0 && lowUnused < seqBefore,
    `deve existir um numero baixo livre abaixo da sequencia (got ${lowUnused}, seq ${seqBefore})`);
  scalar(handle, `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${lowUnused});`);
  check(Number(seqLast(handle)) === seqBefore,
    `numero manual baixo nao pode mover a sequencia (${seqBefore} -> ${seqLast(handle)})`);

  // 8. duplicate manual number rejected.
  const dupErr = mustFail(handle,
    `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${manualHigh});`, 'numero duplicado');
  check(/unic|uniqu/i.test(dupErr), `duplicado deve falhar por UNIQUE (got ${dupErr})`);

  // 9. zero and negative rejected.
  const zeroErr = mustFail(handle, `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, 0);`, 'numero zero');
  const negErr = mustFail(handle, `INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, -7);`, 'numero negativo');
  check(/pedidos_numero_positivo_chk/.test(zeroErr), `zero deve violar pedidos_numero_positivo_chk (got ${zeroErr})`);
  check(/pedidos_numero_positivo_chk/.test(negErr), `negativo deve violar pedidos_numero_positivo_chk (got ${negErr})`);

  log('D', { auto: autoNum, manual: got, nextAfterManual: next, seq: seqLast(handle), lowUnusedNoMove: seqBefore });
}

// ===========================================================================
// PART E — numero immutability (proofs 13 and 14).
// ===========================================================================
async function partE(handle) {
  const err = mustFail(handle,
    `UPDATE public.pedidos SET numero = numero + 100000 WHERE numero = 5000;`, 'renumeracao');
  check(/imutavel/i.test(err), `a recusa deve vir do guard de imutabilidade (got ${err})`);

  const same = run(handle, `UPDATE public.pedidos SET numero = 5000 WHERE numero = 5000;`);
  check(same.ok, `UPDATE de mesmo valor deve ser aceito (got ${same.err})`);

  // Nem mesmo um UPDATE de outra coluna pode arrastar numero junto.
  const still = scalar(handle, `SELECT count(*) FROM public.pedidos WHERE numero = 5000;`);
  check(Number(still) === 1, `o Pedido 5000 deve continuar existindo exatamente uma vez (got ${still})`);
  log('E', { renumber: 'rejected', sameValue: 'accepted' });
}

// ===========================================================================
// PART F — concurrency (proofs 15 and 16). Two REAL distinct psql sessions.
// ===========================================================================
async function partF(handle) {
  const target = 7777;
  const a = openSession(handle, 'A');
  const b = openSession(handle, 'B');
  try {
    a.send(`SELECT 'A_PID='||pg_backend_pid();`);
    const aPid = (await a.waitFor((l) => l.startsWith('A_PID='))).split('=')[1];
    b.send(`SELECT 'B_PID='||pg_backend_pid();`);
    const bPid = (await b.waitFor((l) => l.startsWith('B_PID='))).split('=')[1];

    a.send('BEGIN;');
    a.send(`INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${target});`);
    a.send(`SELECT 'A_INSERTED';`);
    await a.waitFor((l) => l === 'A_INSERTED');

    // B tenta o MESMO numero manual: deve bloquear no indice unico ate A decidir.
    b.send('BEGIN;');
    b.send(`INSERT INTO public.pedidos (cliente_id, numero) VALUES (${CLI}, ${target});`);
    b.send(`SELECT 'B_DONE';`);
    await waitForBlock(handle, bPid, aPid);
    log('F1', { blocked: `${bPid} on ${aPid}` });

    a.send('COMMIT;');
    a.send(`SELECT 'A_COMMITTED';`);
    await a.waitFor((l) => l === 'A_COMMITTED');

    await b.waitFor((l) => l === 'B_DONE' || /duplicar|duplicate|unique|unic/i.test(l));
    const bFailed = b.lines.some((l) => /duplicar|duplicate|unique|unic/i.test(l));
    check(bFailed, `a sessao perdedora deve receber violacao de unicidade; linhas=${b.lines.join(' | ')}`);
    b.send('ROLLBACK;');
    b.send(`SELECT 'B_ROLLED';`);
    await b.waitFor((l) => l === 'B_ROLLED');
  } finally {
    await a.close().catch(() => {});
    await b.close().catch(() => {});
  }

  const count = scalar(handle, `SELECT count(*) FROM public.pedidos WHERE numero=${target};`);
  check(Number(count) === 1, `uso concorrente do mesmo numero manual deve produzir exatamente 1 Pedido (got ${count})`);

  const dups = scalar(handle,
    `SELECT count(*) FROM (SELECT numero FROM public.pedidos GROUP BY numero HAVING count(*) > 1) d;`);
  check(Number(dups) === 0, `nao pode existir numero duplicado (got ${dups})`);
  log('F2', { pedidosComNumeroAlvo: count, duplicados: dups });
}

// ===========================================================================
async function main() {
  let handle = null;
  try {
    SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'g28-b02-'));
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pg: handle.pgVersion });

    await partA(handle);
    await partB(handle);
    await partC(handle);
    await partD(handle);
    await partE(handle);
    await partF(handle);

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
