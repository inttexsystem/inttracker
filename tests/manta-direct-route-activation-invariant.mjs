// tests/manta-direct-route-activation-invariant.mjs
//
// PHASE-MANTA-B2A disposable-cluster proof of db/85 (route-conditional `cima`
// delivery + the Manta output RPC).
//
// Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md
// §3, §8, §9, §10 (B2A) and §11 (B2A test contract).
// Migrations: db/85_manta_cima_route_conditional_delivery.sql.
//
// ENVIRONMENT: disposable local PostgreSQL 18.x ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. The Supabase-platform preamble and all
// fixtures are rebuilt in OS temp files outside the repository and removed on exit.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   Part A  full chain db/01..db/85 applies cleanly, in order (corpus after db/66);
//           every db/85 terminal object present and entregas_destino_cima_chk gone.
//   Part B  db/85 re-applies idempotently with a before/after fingerprint proving
//           zero schema/constraint/trigger/function-body/grant drift.
//   Part C  tests/manta-direct-route-activation.integration.sql passes.
//   Part D  regression: the db/78-80 identity and db/81-84 source integration
//           tests still pass UNCHANGED; the Manta finishing rejection is intact;
//           the Latex expedition/delivery RPCs keep their exact signatures,
//           SECURITY DEFINER mode, search_path and grants; C5A emission passes.
//   Part E  distinct-session concurrency against the db/85 lock-order
//           reconciliation (real psql backends, pg_blocking_pids):
//             E1 header-wins:  a `cima` header destination UPDATE holds the
//                header row; a concurrent item INSERT blocks on it (proved via
//                pg_blocking_pids), then re-validates against the COMMITTED
//                destination and resolves correctly. Proves the explicit
//                FOR SHARE parent lock, not the FK's non-conflicting FOR KEY
//                SHARE, is what serializes the two sides.
//             E2 item-wins:  an item INSERT commits while a concurrent header
//                destination UPDATE waits; the header guard then re-derives the
//                route from the freshly committed item and rejects.
//             E3 no-deadlock: the two opposing paths (item INSERT takes
//                ops -> entregas; header UPDATE takes entregas and requests
//                nothing) run concurrently in both orders with zero 40P01.
//             E4 same-OP output serialization: two registrar_entrega_cima_manta
//                calls on ONE Manta OP serialize on the source `ops` row.
//             E5 independent Manta OPs do not serialize.
//             E6 Tapete regression under concurrency: a Tapete `cima` item
//                INSERT and an unrelated Manta output run fully in parallel.
//   Part F  distinct-session concurrency for db/86 (release writer):
//             F1 two concurrent releases cannot overconsume (both serialize on
//                the source ops row; the loser recomputes post-lock).
//             F2a output correction wins: the release blocks on the corrected
//                entrega_itens row and recomputes against the committed value.
//             F2b release wins: the correction blocks on the release's row lock
//                and db/81's consumption guard then refuses it.
//             F3 two concurrent same-key requests mutate exactly ONCE (the
//                loser blocks on the idempotency advisory lock BEFORE doing any
//                work and replays the stored result).
//             F4 different Manta OPs do not serialize.
//   Part Z  mandatory full cluster destruction (pid absent, port closed, dir
//           absent; no c3d-disposable-pg-* residue from this run).
//
// Run:  node tests/manta-direct-route-activation-invariant.mjs
// Exits nonzero on any missing or failed proof.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootstrapCluster,
  getRepoRoot,
  isPidAlive,
  isPortOpen,
  DATA_DIR_PREFIX,
} from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const TERMINAL_MIGRATION = 86;
const DB85_FILE = '85_manta_cima_route_conditional_delivery.sql';
const DB86_FILE = '86_manta_expedition_release_writer.sql';

// ---------------------------------------------------------------------------
// Supabase-platform preamble a bare PG cluster lacks (applied before db/01).
// ---------------------------------------------------------------------------
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
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text,
  last_sign_in_at    timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  raw_user_meta_data jsonb,
  raw_app_meta_data  jsonb
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
$fn$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
`;

// Classification-faithful 64-row purchase-order corpus (after db/66, before db/67).
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

// Distinct-session concurrency fixtures (committed; planted with triggers OFF so
// the db/78-85 guards do not fire during planting and are exercised live by the
// concurrent sessions). One dedicated OP/header set per test avoids interference.
const CONCURRENCY_FIXTURES_SQL = `
CREATE TABLE IF NOT EXISTS public._b2a_ids (k TEXT PRIMARY KEY, v BIGINT);
CREATE TABLE IF NOT EXISTS public._b2a_uuids (k TEXT PRIMARY KEY, v UUID);
SET session_replication_role = replica;
DO $cf$
DECLARE
  c1 BIGINT; c2 BIGINT; mm BIGINT; mt BIGINT; forn BIGINT; dest BIGINT;
  cli BIGINT; ped UUID; lote BIGINT; adm UUID;
  opE1 BIGINT; itE1 BIGINT; entE1 BIGINT;
  opE2 BIGINT; itE2 BIGINT; entE2 BIGINT;
  opE3 BIGINT; itE3 BIGINT; entE3 BIGINT;
  opE4 BIGINT; itE4 BIGINT;
  opE5a BIGINT; itE5a BIGINT; opE5b BIGINT; itE5b BIGINT;
  opE6t BIGINT; itE6t BIGINT; entE6 BIGINT;
  opE6m BIGINT; itE6m BIGINT;
  opF1 BIGINT; itF1 BIGINT; entF1 BIGINT; eiF1 BIGINT;
  opF2a BIGINT; itF2a BIGINT; entF2a BIGINT; eiF2a BIGINT;
  opF2b BIGINT; itF2b BIGINT; entF2b BIGINT; eiF2b BIGINT;
  opF3 BIGINT; itF3 BIGINT; entF3 BIGINT; eiF3 BIGINT;
  opF4a BIGINT; itF4a BIGINT; entF4a BIGINT; eiF4a BIGINT;
  opF4b BIGINT; itF4b BIGINT; entF4b BIGINT; eiF4b BIGINT;
BEGIN
  INSERT INTO public.cores(nome) VALUES ('B2A-KRAFT') RETURNING id INTO c1;
  INSERT INTO public.cores(nome) VALUES ('B2A-CRU')   RETURNING id INTO c2;
  INSERT INTO public.fornecedores(nome,tipo) VALUES ('B2A-TEC','tecelagem') RETURNING id INTO forn;
  INSERT INTO public.fornecedores(nome,tipo) VALUES ('B2A-LATEX','latex')   RETURNING id INTO dest;
  INSERT INTO public.modelos(nome,cor_1_id,cor_2_id,largura,tipo_produto)
    VALUES ('B2A-MANTA', c1,c2,1.40,'manta')  RETURNING id INTO mm;
  INSERT INTO public.modelos(nome,cor_1_id,cor_2_id,largura,tipo_produto)
    VALUES ('B2A-TAPETE',c1,c2,2.10,'tapete') RETURNING id INTO mt;
  INSERT INTO public.clientes(nome) VALUES ('B2A-CLI') RETURNING id INTO cli;
  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,987001,'confirmado') RETURNING id INTO ped;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (987001,cli,ped) RETURNING id INTO lote;

  INSERT INTO auth.users(email) VALUES ('b2a-admin@example.test') RETURNING id INTO adm;
  INSERT INTO public.usuarios(id,email,nome,tipo,ativo)
    VALUES (adm,'b2a-admin@example.test','B2A Admin','admin',TRUE);

  -- E1 header-wins: Manta source + an item-less cima header WITHOUT destination.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987001,2026,'concluida','tecelagem',lote) RETURNING id INTO opE1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE1,mm,100) RETURNING id INTO itE1;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id)
    VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entE1;

  -- E2 item-wins: Manta source + an item-less cima header WITHOUT destination.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987002,2026,'concluida','tecelagem',lote) RETURNING id INTO opE2;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE2,mm,100) RETURNING id INTO itE2;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id)
    VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entE2;

  -- E3 no-deadlock: Manta source + an item-less cima header WITHOUT destination.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987003,2026,'concluida','tecelagem',lote) RETURNING id INTO opE3;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE3,mm,100) RETURNING id INTO itE3;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id)
    VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entE3;

  -- E4 same-OP output serialization.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987004,2026,'concluida','tecelagem',lote) RETURNING id INTO opE4;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE4,mm,100) RETURNING id INTO itE4;

  -- E5 independent Manta OPs.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987005,2026,'concluida','tecelagem',lote) RETURNING id INTO opE5a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE5a,mm,100) RETURNING id INTO itE5a;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987006,2026,'concluida','tecelagem',lote) RETURNING id INTO opE5b;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE5b,mm,100) RETURNING id INTO itE5b;

  -- E6 Tapete regression under concurrency.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987007,2026,'concluida','tecelagem',lote) RETURNING id INTO opE6t;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE6t,mt,100) RETURNING id INTO itE6t;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id)
    VALUES (forn,'cima',CURRENT_DATE,dest) RETURNING id INTO entE6;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987008,2026,'concluida','tecelagem',lote) RETURNING id INTO opE6m;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE6m,mm,100) RETURNING id INTO itE6m;

  -- db/86 sources: each a homogeneous Manta weaving OP with 100 m of measured,
  -- non-defect cima output already recorded (planted with triggers off).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987011,2026,'concluida','tecelagem',lote) RETURNING id INTO opF1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF1,mm,200) RETURNING id INTO itF1;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF1;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF1,opF1,itF1,mm,100,FALSE) RETURNING id INTO eiF1;

  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987012,2026,'concluida','tecelagem',lote) RETURNING id INTO opF2a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF2a,mm,200) RETURNING id INTO itF2a;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF2a;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF2a,opF2a,itF2a,mm,100,FALSE) RETURNING id INTO eiF2a;

  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987013,2026,'concluida','tecelagem',lote) RETURNING id INTO opF2b;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF2b,mm,200) RETURNING id INTO itF2b;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF2b;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF2b,opF2b,itF2b,mm,100,FALSE) RETURNING id INTO eiF2b;

  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987014,2026,'concluida','tecelagem',lote) RETURNING id INTO opF3;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF3,mm,200) RETURNING id INTO itF3;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF3;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF3,opF3,itF3,mm,100,FALSE) RETURNING id INTO eiF3;

  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987015,2026,'concluida','tecelagem',lote) RETURNING id INTO opF4a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF4a,mm,200) RETURNING id INTO itF4a;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF4a;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF4a,opF4a,itF4a,mm,100,FALSE) RETURNING id INTO eiF4a;

  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (987016,2026,'concluida','tecelagem',lote) RETURNING id INTO opF4b;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF4b,mm,200) RETURNING id INTO itF4b;
  INSERT INTO public.entregas(fornecedor_id,etapa,data,destino_fornecedor_id) VALUES (forn,'cima',CURRENT_DATE,NULL) RETURNING id INTO entF4b;
  INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
    VALUES (entF4b,opF4b,itF4b,mm,100,FALSE) RETURNING id INTO eiF4b;

  INSERT INTO public._b2a_ids(k,v) VALUES
    ('opF1',opF1),('itF1',itF1),('eiF1',eiF1),
    ('opF2a',opF2a),('itF2a',itF2a),('eiF2a',eiF2a),
    ('opF2b',opF2b),('itF2b',itF2b),('eiF2b',eiF2b),
    ('opF3',opF3),('itF3',itF3),('eiF3',eiF3),
    ('opF4a',opF4a),('itF4a',itF4a),('eiF4a',eiF4a),
    ('opF4b',opF4b),('itF4b',itF4b),('eiF4b',eiF4b),
    ('mm',mm),('mt',mt),('forn',forn),('dest',dest),('lote',lote),('cli',cli),
    ('opE1',opE1),('itE1',itE1),('entE1',entE1),
    ('opE2',opE2),('itE2',itE2),('entE2',entE2),
    ('opE3',opE3),('itE3',itE3),('entE3',entE3),
    ('opE4',opE4),('itE4',itE4),
    ('opE5a',opE5a),('itE5a',itE5a),('opE5b',opE5b),('itE5b',itE5b),
    ('opE6t',opE6t),('itE6t',itE6t),('entE6',entE6),('opE6m',opE6m),('itE6m',itE6m);

  INSERT INTO public._b2a_uuids(k,v) VALUES ('ped',ped),('adm',adm);
END
$cf$;
SET session_replication_role = origin;
`;

// ---------------------------------------------------------------------------
// Small utilities (mirror the accepted idiom in the PHASE-MANTA-B1 harness).
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

function applyFile(handle, file, labelForError) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 180000,
  });
  if (result.status !== 0) {
    const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
    throw new Error(`APPLY_FAILED (${labelForError || file}): ${diag}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

let SCRATCH_DIR = null;
async function applySql(handle, name, sql, label) {
  const file = path.join(SCRATCH_DIR, name);
  await writeFile(file, sql, 'utf8');
  return applyFile(handle, file, label || name);
}

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
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => { closeError = error; });
  const completion = new Promise((resolve, reject) => {
    child.on('close', (code) => {
      closed = true;
      if (pending) publish(pending);
      const err = closeError || (code === 0 ? null : new Error(`${name} psql exited ${code}: ${stderr}`));
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
    // Bounded close: a backend still blocked on a lock cannot read `\q`, so the
    // child is killed after a grace period rather than pinning the event loop
    // (the harness must always reach Part Z and destroy its cluster).
    async close(graceMs = 10000) {
      if (closed) return completion;
      try { child.stdin.end('\\q\n'); } catch { /* ignore */ }
      const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } }, graceMs);
      try { return await completion; } catch { return { lines, stderr }; } finally { clearTimeout(timer); }
    },
  };
}

async function query(handle, sql) {
  const s = openSession(handle, 'query');
  const collected = [];
  s.send(sql);
  s.send(`SELECT 'Q_DONE';`);
  await s.waitFor((l) => { if (l !== 'Q_DONE') collected.push(l); return l === 'Q_DONE'; });
  await s.close();
  return collected;
}
async function scalar(handle, sql) { const [row = ''] = await query(handle, sql); return row; }

async function waitForBlock(handle, subjectPid, blockerPid, attempts = 300) {
  for (let i = 0; i < attempts; i += 1) {
    const row = await scalar(handle,
      `SELECT array_to_string(pg_catalog.pg_blocking_pids(${subjectPid}), ',');`);
    if (row.split(',').includes(String(blockerPid))) return row;
    await delay(50);
  }
  throw new Error(`backend ${subjectPid} did not block on ${blockerPid}`);
}

// Run a single autocommit statement inside a DO block and return 'OK' (the
// statement committed) or 'REJECTED|<sqlerrm>' (it raised and rolled back).
async function attempt(handle, name, opSql, actorUuid) {
  const s = openSession(handle, name);
  if (actorUuid) s.send(`SELECT set_config('request.jwt.claim.sub', '${actorUuid}', false);`);
  s.send(`CREATE TEMP TABLE _att(v text);`);
  s.send(`DO $$ BEGIN ${opSql}; INSERT INTO _att VALUES ('OK'); EXCEPTION WHEN OTHERS THEN INSERT INTO _att VALUES ('REJECTED|'||SQLERRM); END $$;`);
  s.send(`SELECT 'ATT|' || v FROM _att;`);
  const r = await s.waitFor((l) => l.startsWith('ATT|'));
  await s.close();
  return r.slice(4);
}

async function schemaFingerprint(handle) {
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
      UNION ALL
      SELECT 'RLS '||c.relname||' '||c.relrowsecurity::text||' '||coalesce(pol.polname,'')||' '||coalesce(pg_get_expr(pol.polqual, pol.polrelid),'')
        FROM pg_class c
        LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
       WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
      UNION ALL
      SELECT 'IDX '||schemaname||'.'||tablename||' '||indexname||' '||indexdef
        FROM pg_indexes WHERE schemaname='public'
    )
    SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
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
// PART A — full chain apply + terminal-object presence.
// ===========================================================================
async function partA(handle) {
  const manifest = await resolveManifest();
  check(manifest.length === TERMINAL_MIGRATION,
    `manifest must be db/01..db/${TERMINAL_MIGRATION} (got ${manifest.length})`);
  check(manifest[manifest.length - 1].n === TERMINAL_MIGRATION,
    `terminal migration must be db/${TERMINAL_MIGRATION} (got ${manifest[manifest.length - 1].n})`);

  await applySql(handle, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    applyFile(handle, file, path.basename(file));
    if (n === 66) await applySql(handle, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
  }

  const objs = await scalar(handle, `
    SELECT (SELECT count(*) FROM pg_constraint WHERE conname='entregas_destino_cima_chk') || '/' ||
           (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
              'entrega_itens_cima_route_destino_guard','entregas_cima_destino_route_guard')) || '/' ||
           (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (
              'entrega_itens_cima_route_destino_guard_fn','entregas_cima_destino_route_guard_fn',
              'registrar_entrega_cima_manta'));`);
  check(objs === '0/2/3',
    `db/85 terminal objects: dropped CHECK / 2 route triggers / 3 functions (got ${objs})`);

  const db86 = await scalar(handle, `
    SELECT (SELECT count(*) FROM pg_class WHERE oid='public.expedicao_comandos'::regclass) || '/' ||
           (SELECT relrowsecurity::text FROM pg_class WHERE oid='public.expedicao_comandos'::regclass) || '/' ||
           (SELECT count(*) FROM pg_constraint
             WHERE conrelid='public.expedicao_comandos'::regclass AND conname='expedicao_comandos_idempotencia') || '/' ||
           (SELECT count(*) FROM pg_trigger
             WHERE NOT tgisinternal AND tgname='expedicao_comandos_immutable_guard') || '/' ||
           (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (
              'consultar_saldo_expedicao_manta','liberar_expedicao_manta_parcial',
              'expedicao_comandos_immutable_guard_fn'));`);
  check(db86 === '1/true/1/1/3',
    `db/86 terminal objects: command table / RLS / unique key / immutability trigger / 3 functions (got ${db86})`);

  // Every db/81-84 guard survives untouched.
  const legacy = await scalar(handle, `
    SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
      'expedicoes_source_validation_guard','expedicao_itens_membership_guard',
      'op_itens_expedicao_reference_guard','entrega_itens_manta_consumo_guard',
      'entregas_manta_consumo_guard','ops_manta_reopen_guard','op_itens_source_nonempty_guard',
      'ops_source_type_immutability_guard','lotes_source_lineage_immutability_guard',
      'pedidos_source_lineage_immutability_guard');`);
  check(legacy === '10', `every db/81-84 guard must survive db/85 (got ${legacy})`);

  log('PART_A', { migrations: manifest.length, terminal: TERMINAL_MIGRATION, objects: objs, legacy_guards: legacy, clean_apply: true });
}

// ===========================================================================
// PART B — db/85 idempotent re-apply with zero drift.
// ===========================================================================
async function partB(handle) {
  const before = await schemaFingerprint(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', DB85_FILE), 'db/85 re-apply');
  const afterDb85 = await schemaFingerprint(handle);
  check(before === afterDb85,
    `idempotent re-apply of db/85 must cause zero schema/constraint/trigger/index/function/grant/RLS drift (before=${before}, after=${afterDb85})`);

  applyFile(handle, path.join(REPO_ROOT, 'db', DB86_FILE), 'db/86 re-apply');
  const afterDb86 = await schemaFingerprint(handle);
  check(afterDb85 === afterDb86,
    `idempotent re-apply of db/86 must cause zero schema/constraint/trigger/index/function/grant/RLS drift (before=${afterDb85}, after=${afterDb86})`);

  log('PART_B', { reapply: 'db/85+db/86', fingerprint: afterDb86, drift: 'none' });
}

// ===========================================================================
// PART C — the db/85 integration proof.
// ===========================================================================
async function partC(handle) {
  const file = path.join(HERE, 'manta-direct-route-activation.integration.sql');
  const out = applyFile(handle, file, 'manta-direct-route-activation.integration.sql');
  check(/MANTA_DIRECT_ROUTE_ACTIVATION_INTEGRATION_PASS/.test(out),
    `db/85 integration test must pass (got: ${out.trim().split(/\r?\n/).slice(-3).join(' / ')})`);
  log('PART_C', { integration_test: 'manta-direct-route-activation.integration.sql', result: 'PASS' });
}

// ===========================================================================
// PART D — regressions.
// ===========================================================================
async function partD(handle) {
  const idOut = applyFile(handle, path.join(HERE, 'manta-product-identity.integration.sql'), 'manta-product-identity.integration.sql');
  check(/MANTA_PRODUCT_IDENTITY_INTEGRATION_PASS/.test(idOut),
    `db/78-80 identity integration test must still pass (got: ${idOut.trim().split(/\r?\n/).slice(-3).join(' / ')})`);

  const srcOut = applyFile(handle, path.join(HERE, 'manta-expedition-source.integration.sql'), 'manta-expedition-source.integration.sql');
  check(/MANTA_EXPEDITION_SOURCE_INTEGRATION_PASS/.test(srcOut),
    `db/81-84 source integration test must still pass UNCHANGED (got: ${srcOut.trim().split(/\r?\n/).slice(-3).join(' / ')})`);

  const fin = await scalar(handle, `
    SELECT (CASE WHEN pg_get_functiondef('public.gerar_op_latex(bigint)'::regprocedure) LIKE '%e de Manta%' THEN 'latex_ok' ELSE 'latex_MISSING' END)
        || '/' ||
           (CASE WHEN pg_get_functiondef('public.gerar_op_latex_split(bigint,text)'::regprocedure) LIKE '%e de Manta%' THEN 'split_ok' ELSE 'split_MISSING' END);`);
  check(fin === 'latex_ok/split_ok', `Manta finishing rejection must remain in gerar_op_latex/_split (got ${fin})`);

  // Latex expedition/delivery RPC surface untouched by db/85.
  const latexAcl = await scalar(handle, `
    SELECT string_agg(x, '/' ORDER BY x) FROM (
      SELECT p.proname || ':' || p.prosecdef::text || ':' ||
             has_function_privilege('authenticated', p.oid, 'EXECUTE')::text AS x
        FROM pg_proc p
       WHERE p.oid IN (
         'public.liberar_expedicao(bigint)'::regprocedure,
         'public.liberar_expedicao_latex_parcial(bigint,jsonb,text)'::regprocedure,
         'public.consultar_saldo_expedicao_latex(bigint)'::regprocedure,
         'public.registrar_entrega_expedicao(bigint,text,date,jsonb,text)'::regprocedure,
         'public.recalcular_status_expedicao(bigint)'::regprocedure)
    ) t;`);
  check(
    latexAcl === 'consultar_saldo_expedicao_latex:true:true/liberar_expedicao:true:true/liberar_expedicao_latex_parcial:true:true/recalcular_status_expedicao:true:true/registrar_entrega_expedicao:true:true',
    `Latex expedition/delivery RPC signatures, SECURITY DEFINER mode and grants must be unchanged (got ${latexAcl})`);

  const recon = await scalar(handle, `
    SELECT (SELECT count(*) FROM public.ordens_compra_fio) || '/' ||
           (SELECT count(*) FROM public.ordem_compra) || '/' ||
           (SELECT count(*) FROM public.ordem_compra_item);`);
  check(recon.startsWith('64/51/51'), `C5 corpus must be reconciled 64/51/51 (got ${recon})`);
  const c5 = applyFile(handle, path.join(HERE, 'ordem-compra-c5a-emission-readiness.integration.sql'), 'ordem-compra-c5a-emission-readiness.integration.sql');
  check(/C5A_EMISSION_READINESS_INTEGRATION_PASS/.test(c5),
    `C5A emission test must still pass (got: ${c5.trim().split(/\r?\n/).slice(-3).join(' / ')})`);

  log('PART_D', {
    identity_regression: 'PASS', source_regression: 'PASS', finishing_rejection: fin,
    latex_rpc_surface: 'UNCHANGED', c5_reconciliation: recon, c5a_emission: 'PASS',
  });
}

// ===========================================================================
// PART E — distinct-session concurrency against the db/85 lock reconciliation.
// ===========================================================================
async function partE(handle) {
  await applySql(handle, 'concurrency-fixtures.sql', CONCURRENCY_FIXTURES_SQL, 'db/85 concurrency fixtures');
  const id = {};
  for (const k of ['mm', 'mt', 'forn', 'dest', 'lote', 'cli',
    'opE1', 'itE1', 'entE1', 'opE2', 'itE2', 'entE2', 'opE3', 'itE3', 'entE3',
    'opE4', 'itE4', 'opE5a', 'itE5a', 'opE5b', 'itE5b',
    'opE6t', 'itE6t', 'entE6', 'opE6m', 'itE6m',
    'opF1', 'itF1', 'eiF1', 'opF2a', 'itF2a', 'eiF2a', 'opF2b', 'itF2b', 'eiF2b',
    'opF3', 'itF3', 'eiF3', 'opF4a', 'itF4a', 'eiF4a', 'opF4b', 'itF4b', 'eiF4b']) {
    id[k] = Number(await scalar(handle, `SELECT v FROM public._b2a_ids WHERE k='${k}';`));
    check(Number.isInteger(id[k]) && id[k] > 0, `fixture id ${k} must resolve (got ${id[k]})`);
  }
  const adm = await scalar(handle, `SELECT v FROM public._b2a_uuids WHERE k='adm';`);
  check(/^[0-9a-f-]{36}$/.test(adm), `admin actor must resolve (got ${adm})`);

  // ---- E1: header-wins ---------------------------------------------------
  // The header UPDATE holds public.entregas(entE1) FOR NO KEY UPDATE. A
  // concurrent Manta item INSERT must BLOCK on that row (its explicit FOR SHARE
  // conflicts; the FK's FOR KEY SHARE would not), then re-validate against the
  // committed destination and be REJECTED (Manta may not carry a destination).
  {
    const header = openSession(handle, 'E1-header');
    header.send('BEGIN;');
    header.send(`SELECT 'HPID|' || pg_backend_pid();`);
    const hpid = Number((await header.waitFor((l) => l.startsWith('HPID|'))).split('|')[1]);
    header.send(`UPDATE public.entregas SET destino_fornecedor_id=${id.dest} WHERE id=${id.entE1}; SELECT 'H_DONE';`);
    await header.waitFor((l) => l === 'H_DONE');

    const item = openSession(handle, 'E1-item');
    item.send('BEGIN;');
    item.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await item.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    item.send(`INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
               VALUES (${id.entE1},${id.opE1},${id.itE1},${id.mm},40,FALSE); SELECT 'I_DONE';`);

    const blockers = await waitForBlock(handle, ipid, hpid);
    header.send(`COMMIT; SELECT 'H_COMMIT';`);
    await header.waitFor((l) => l === 'H_COMMIT');
    await item.waitFor((l) => l === 'I_DONE' || /ERRO|ERROR/i.test(l), 30000).catch(() => {});
    item.send(`ROLLBACK; SELECT 'I_END';`);
    await item.waitFor((l) => l === 'I_END');
    const itemErr = item.stderr;
    await header.close(); await item.close();

    check(/blocking_pids|,|^\d+$/.test(blockers) && blockers.includes(String(hpid)),
      `E1 the item INSERT must block on the header row lock (blockers=${blockers})`);
    check(/rota Manta nao admite destino/.test(itemErr),
      `E1 the item INSERT must be rejected against the COMMITTED destination (stderr=${itemErr.slice(0, 400)})`);
    check(!/40P01|deadlock/i.test(itemErr), `E1 must not deadlock (stderr=${itemErr.slice(0, 400)})`);
    const persisted = await scalar(handle, `SELECT count(*) FROM public.entrega_itens WHERE entrega_id=${id.entE1};`);
    check(persisted === '0', `E1 no item may persist (got ${persisted})`);
    log('E1', { blocked_on_header: true, blockers, outcome: 'REJECTED_POST_LOCK', deadlock: false });
  }

  // ---- E2: item-wins -----------------------------------------------------
  // The item INSERT commits while a concurrent header destination UPDATE waits;
  // the header guard then re-derives the route from the freshly committed Manta
  // item and REJECTS the destination.
  {
    const item = openSession(handle, 'E2-item');
    item.send('BEGIN;');
    item.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await item.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    item.send(`INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
               VALUES (${id.entE2},${id.opE2},${id.itE2},${id.mm},40,FALSE); SELECT 'I_DONE';`);
    await item.waitFor((l) => l === 'I_DONE');

    const header = openSession(handle, 'E2-header');
    header.send('BEGIN;');
    header.send(`SELECT 'HPID|' || pg_backend_pid();`);
    const hpid = Number((await header.waitFor((l) => l.startsWith('HPID|'))).split('|')[1]);
    header.send(`UPDATE public.entregas SET destino_fornecedor_id=${id.dest} WHERE id=${id.entE2}; SELECT 'H_DONE';`);

    const blockers = await waitForBlock(handle, hpid, ipid);
    item.send(`COMMIT; SELECT 'I_COMMIT';`);
    await item.waitFor((l) => l === 'I_COMMIT');
    await header.waitFor((l) => l === 'H_DONE' || /ERRO|ERROR/i.test(l), 30000).catch(() => {});
    header.send(`ROLLBACK; SELECT 'H_END';`);
    await header.waitFor((l) => l === 'H_END');
    const headerErr = header.stderr;
    await header.close(); await item.close();

    check(blockers.includes(String(ipid)),
      `E2 the header UPDATE must block on the item writer's parent FOR SHARE (blockers=${blockers})`);
    check(/rota Manta nao admite destino/.test(headerErr),
      `E2 the header UPDATE must be rejected against the freshly committed item (stderr=${headerErr.slice(0, 400)})`);
    check(!/40P01|deadlock/i.test(headerErr), `E2 must not deadlock (stderr=${headerErr.slice(0, 400)})`);
    const dest = await scalar(handle, `SELECT coalesce(destino_fornecedor_id::text,'NULL') FROM public.entregas WHERE id=${id.entE2};`);
    check(dest === 'NULL', `E2 the Manta header must keep a NULL destination (got ${dest})`);
    log('E2', { blocked_on_item: true, blockers, outcome: 'REJECTED_POST_LOCK', deadlock: false });
  }

  // ---- E3: no-deadlock in both orders ------------------------------------
  // The two opposing paths run concurrently: the item INSERT takes
  // ops -> entregas; the header UPDATE takes only its own entregas row and
  // requests nothing. No cycle can form, in either interleaving.
  {
    for (const order of ['item-first', 'header-first']) {
      const [a, b] = await Promise.all([
        attempt(handle, `E3-${order}-item`,
          `INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
           VALUES (${id.entE3},${id.opE3},${id.itE3},${id.mm},10,FALSE)`),
        attempt(handle, `E3-${order}-header`,
          `UPDATE public.entregas SET observacao='E3-${order}' WHERE id=${id.entE3}`),
      ]);
      check(!/40P01|deadlock/i.test(`${a}${b}`), `E3 (${order}) must produce no 40P01 (a=${a}, b=${b})`);
      await query(handle, `DELETE FROM public.entrega_itens WHERE entrega_id=${id.entE3};`);
    }
    log('E3', { deadlock: false, orders: 'item-first+header-first' });
  }

  // ---- E4: same-OP Manta output serializes on the source ops row ----------
  {
    const s1 = openSession(handle, 'E4-a');
    s1.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    s1.send('BEGIN;');
    s1.send(`SELECT 'PID|' || pg_backend_pid();`);
    const p1 = Number((await s1.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    s1.send(`SELECT 'R1|' || (public.registrar_entrega_cima_manta(${id.opE4}, ${id.forn}, CURRENT_DATE,
              jsonb_build_array(jsonb_build_object('op_item_id',${id.itE4},'metros_entregues',30,'defeito',false)))->>'ok');`);
    await s1.waitFor((l) => l.startsWith('R1|'));

    const s2 = openSession(handle, 'E4-b');
    s2.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    s2.send('BEGIN;');
    s2.send(`SELECT 'PID|' || pg_backend_pid();`);
    const p2 = Number((await s2.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    s2.send(`SELECT 'R2|' || (public.registrar_entrega_cima_manta(${id.opE4}, ${id.forn}, CURRENT_DATE,
              jsonb_build_array(jsonb_build_object('op_item_id',${id.itE4},'metros_entregues',20,'defeito',false)))->>'ok');`);

    const blockers = await waitForBlock(handle, p2, p1);
    s1.send(`COMMIT; SELECT 'C1';`);
    await s1.waitFor((l) => l === 'C1');
    const r2 = await s2.waitFor((l) => l.startsWith('R2|'));
    s2.send(`COMMIT; SELECT 'C2';`);
    await s2.waitFor((l) => l === 'C2');
    const err = `${s1.stderr}${s2.stderr}`;
    await s1.close(); await s2.close();

    check(blockers.includes(String(p1)),
      `E4 the second Manta output must serialize on the source ops row (blockers=${blockers})`);
    check(r2 === 'R2|true', `E4 the second output must succeed after the first commits (got ${r2})`);
    check(!/40P01|deadlock/i.test(err), `E4 must not deadlock (stderr=${err.slice(0, 400)})`);
    const total = await scalar(handle, `
      SELECT coalesce(sum(ei.metros_entregues),0)::text
        FROM public.entrega_itens ei JOIN public.entregas e ON e.id = ei.entrega_id
       WHERE ei.op_id=${id.opE4} AND e.etapa='cima';`);
    check(Number(total) === 50, `E4 both measured outputs must persist (got ${total})`);
    log('E4', { serialized_on_source_op: true, blockers, total_measured: total, deadlock: false });
  }

  // ---- E5: independent Manta OPs do not serialize -------------------------
  {
    const s1 = openSession(handle, 'E5-a');
    s1.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    s1.send('BEGIN;');
    s1.send(`SELECT 'PID|' || pg_backend_pid();`);
    const p1 = Number((await s1.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    s1.send(`SELECT 'R1|' || (public.registrar_entrega_cima_manta(${id.opE5a}, ${id.forn}, CURRENT_DATE,
              jsonb_build_array(jsonb_build_object('op_item_id',${id.itE5a},'metros_entregues',30,'defeito',false)))->>'ok');`);
    await s1.waitFor((l) => l.startsWith('R1|'));

    const s2 = openSession(handle, 'E5-b');
    s2.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    s2.send('BEGIN;');
    s2.send(`SELECT 'PID|' || pg_backend_pid();`);
    const p2 = Number((await s2.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    s2.send(`SELECT 'R2|' || (public.registrar_entrega_cima_manta(${id.opE5b}, ${id.forn}, CURRENT_DATE,
              jsonb_build_array(jsonb_build_object('op_item_id',${id.itE5b},'metros_entregues',30,'defeito',false)))->>'ok');`);
    const r2 = await s2.waitFor((l) => l.startsWith('R2|'), 15000);   // must NOT wait for s1
    const blockers = await scalar(handle, `SELECT array_to_string(pg_catalog.pg_blocking_pids(${p2}), ',');`);
    s1.send(`COMMIT; SELECT 'C1';`); await s1.waitFor((l) => l === 'C1');
    s2.send(`COMMIT; SELECT 'C2';`); await s2.waitFor((l) => l === 'C2');
    const err = `${s1.stderr}${s2.stderr}`;
    await s1.close(); await s2.close();

    check(r2 === 'R2|true', `E5 the independent Manta OP must complete without waiting (got ${r2})`);
    check(!blockers.includes(String(p1)), `E5 independent Manta OPs must not serialize (blockers=${blockers})`);
    check(!/40P01|deadlock/i.test(err), `E5 must not deadlock (stderr=${err.slice(0, 400)})`);
    log('E5', { independent: true, blockers: blockers || '(none)', deadlock: false });
  }

  // ---- E6: Tapete regression under concurrency ---------------------------
  {
    const [tap, manta] = await Promise.all([
      attempt(handle, 'E6-tapete',
        `INSERT INTO public.entrega_itens(entrega_id,op_id,op_item_id,modelo_id,metros_entregues,defeito)
         VALUES (${id.entE6},${id.opE6t},${id.itE6t},${id.mt},60,FALSE)`),
      attempt(handle, 'E6-manta',
        `PERFORM public.registrar_entrega_cima_manta(${id.opE6m}, ${id.forn}, CURRENT_DATE,
           jsonb_build_array(jsonb_build_object('op_item_id',${id.itE6m},'metros_entregues',25,'defeito',false)))`,
        adm),
    ]);
    check(tap === 'OK', `E6 the Tapete cima write must still be accepted unchanged (got ${tap})`);
    check(manta === 'OK', `E6 the concurrent Manta output must be accepted (got ${manta})`);
    check(!/40P01|deadlock/i.test(`${tap}${manta}`), `E6 must not deadlock`);
    const rows = await scalar(handle, `
      SELECT (SELECT count(*) FROM public.entrega_itens WHERE entrega_id=${id.entE6}) || '/' ||
             (SELECT count(*) FROM public.entrega_itens WHERE op_id=${id.opE6m});`);
    check(rows === '1/1', `E6 both writes must persist (got ${rows})`);
    log('E6', { tapete: tap, manta, rows, deadlock: false });
  }

  log('PART_E', { proofs: 'E1..E6' });
  return { id, adm };
}

// ===========================================================================
// PART F — distinct-session concurrency for db/86 (release writer).
// ===========================================================================
const RELEASE = (op, item, metros, key = null, obs = null) =>
  `public.liberar_expedicao_manta_parcial(${op}, jsonb_build_array(jsonb_build_object('op_item_id',${item},'metros',${metros})), ${obs === null ? 'NULL' : `'${obs}'`}, ${key === null ? 'NULL' : `'${key}'`})`;

async function partF(handle, ctx) {
  const { id, adm } = ctx;

  // ---- F1: two concurrent releases cannot overconsume ---------------------
  // Both serialize on the source `ops` row taken FOR UPDATE before any balance
  // is read; the loser recomputes availability post-lock and is rejected.
  {
    const a = openSession(handle, 'F1-a');
    a.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    a.send('BEGIN;');
    a.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pa = Number((await a.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    a.send(`SELECT 'A|' || ((${RELEASE(id.opF1, id.itF1, 60)})->>'ok');`);
    await a.waitFor((l) => l.startsWith('A|'));

    const b = openSession(handle, 'F1-b');
    b.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    b.send('BEGIN;');
    b.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pb = Number((await b.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    b.send(`SELECT 'B|' || COALESCE((${RELEASE(id.opF1, id.itF1, 60)})->>'codigo', 'ok');`);

    const blockers = await waitForBlock(handle, pb, pa);
    a.send(`COMMIT; SELECT 'CA';`); await a.waitFor((l) => l === 'CA');
    const rb = await b.waitFor((l) => l.startsWith('B|'));
    b.send(`COMMIT; SELECT 'CB';`); await b.waitFor((l) => l === 'CB');
    const err = `${a.stderr}${b.stderr}`;
    await a.close(); await b.close();

    check(blockers.includes(String(pa)), `F1 the second release must serialize on the source ops row (blockers=${blockers})`);
    check(rb === 'B|excede_disponivel', `F1 the loser must be rejected post-lock (got ${rb})`);
    const total = await scalar(handle, `
      SELECT coalesce(sum(xi.metros_liberados),0)::text FROM public.expedicao_itens xi
        JOIN public.expedicoes ex ON ex.id = xi.expedicao_id WHERE ex.op_tecelagem_id=${id.opF1};`);
    check(Number(total) === 60, `F1 exactly one release may persist, never overconsumption (got ${total} of 100 measured)`);
    check(!/40P01|deadlock/i.test(err), `F1 must not deadlock (${err.slice(0, 300)})`);
    log('F1', { serialized: true, blockers, loser: rb, total_released: total, deadlock: false });
  }

  // ---- F2a: output correction wins; the release recomputes post-lock ------
  {
    const corr = openSession(handle, 'F2a-correcao');
    corr.send('BEGIN;');
    corr.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pc = Number((await corr.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    corr.send(`UPDATE public.entrega_itens SET metros_entregues=50 WHERE id=${id.eiF2a}; SELECT 'C_DONE';`);
    await corr.waitFor((l) => l === 'C_DONE');

    const rel = openSession(handle, 'F2a-release');
    rel.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    rel.send('BEGIN;');
    rel.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pr = Number((await rel.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    rel.send(`SELECT 'R|' || COALESCE((${RELEASE(id.opF2a, id.itF2a, 80)})->>'codigo', 'ok');`);

    const blockers = await waitForBlock(handle, pr, pc);
    corr.send(`COMMIT; SELECT 'CC';`); await corr.waitFor((l) => l === 'CC');
    const rr = await rel.waitFor((l) => l.startsWith('R|'));
    rel.send(`COMMIT; SELECT 'CR';`); await rel.waitFor((l) => l === 'CR');
    const err = `${corr.stderr}${rel.stderr}`;
    await corr.close(); await rel.close();

    check(blockers.includes(String(pc)),
      `F2a the release must block on the correction's entrega_itens row lock (blockers=${blockers})`);
    check(rr === 'R|excede_disponivel',
      `F2a the release must recompute against the CORRECTED measured output and be rejected (got ${rr})`);
    check(!/40P01|deadlock/i.test(err), `F2a must not deadlock (${err.slice(0, 300)})`);
    // And 50 (the corrected quantity) is now releasable.
    const ok = await attempt(handle, 'F2a-after', `PERFORM ${RELEASE(id.opF2a, id.itF2a, 50)}`, adm);
    check(ok === 'OK', `F2a the corrected quantity must then be releasable (got ${ok})`);
    log('F2a', { correction_wins: true, blockers, release: rr, deadlock: false });
  }

  // ---- F2b: release wins; the correction is then refused by db/81 ---------
  {
    const rel = openSession(handle, 'F2b-release');
    rel.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    rel.send('BEGIN;');
    rel.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pr = Number((await rel.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    rel.send(`SELECT 'R|' || ((${RELEASE(id.opF2b, id.itF2b, 60)})->>'ok');`);
    await rel.waitFor((l) => l.startsWith('R|'));

    const corr = openSession(handle, 'F2b-correcao');
    corr.send('BEGIN;');
    corr.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pc = Number((await corr.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    corr.send(`UPDATE public.entrega_itens SET metros_entregues=50 WHERE id=${id.eiF2b}; SELECT 'C_DONE';`);

    const blockers = await waitForBlock(handle, pc, pr);
    rel.send(`COMMIT; SELECT 'CR';`); await rel.waitFor((l) => l === 'CR');
    await corr.waitFor((l) => l === 'C_DONE' || /ERRO|ERROR/i.test(l), 30000).catch(() => {});
    corr.send(`ROLLBACK; SELECT 'CC';`); await corr.waitFor((l) => l === 'CC');
    const corrErr = corr.stderr;
    const err = `${rel.stderr}${corrErr}`;
    await rel.close(); await corr.close();

    check(blockers.includes(String(pr)),
      `F2b the correction must block on the release's entrega_itens row lock (blockers=${blockers})`);
    check(/ja consumida por expedicao/.test(corrErr),
      `F2b db/81's consumption guard must refuse the correction after the release commits (stderr=${corrErr.slice(0, 400)})`);
    check(!/40P01|deadlock/i.test(err), `F2b must not deadlock (${err.slice(0, 300)})`);
    const measured = await scalar(handle, `SELECT metros_entregues::text FROM public.entrega_itens WHERE id=${id.eiF2b};`);
    check(Number(measured) === 100, `F2b the measured output must be unchanged (got ${measured})`);
    log('F2b', { release_wins: true, blockers, correction: 'REFUSED_BY_DB81', deadlock: false });
  }

  // ---- F3: two concurrent same-key requests create exactly ONE release ----
  // The loser blocks on the idempotency advisory lock BEFORE performing any
  // work, so it retains no mutation to discard; on wake-up it observes the
  // committed command row and replays the stored result byte-for-byte.
  {
    const a = openSession(handle, 'F3-a');
    a.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    a.send('BEGIN;');
    a.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pa = Number((await a.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    a.send(`SELECT 'A|' || ((${RELEASE(id.opF3, id.itF3, 40, 'CONC-1')})->>'expedicao_id');`);
    const ra = await a.waitFor((l) => l.startsWith('A|'));

    const b = openSession(handle, 'F3-b');
    b.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    b.send('BEGIN;');
    b.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pb = Number((await b.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    b.send(`SELECT 'B|' || ((${RELEASE(id.opF3, id.itF3, 40, 'CONC-1')})->>'expedicao_id');`);

    const blockers = await waitForBlock(handle, pb, pa);
    a.send(`COMMIT; SELECT 'CA';`); await a.waitFor((l) => l === 'CA');
    const rb = await b.waitFor((l) => l.startsWith('B|'));
    b.send(`COMMIT; SELECT 'CB';`); await b.waitFor((l) => l === 'CB');
    const err = `${a.stderr}${b.stderr}`;
    await a.close(); await b.close();

    check(blockers.includes(String(pa)),
      `F3 the duplicate submission must block on the idempotency advisory lock (blockers=${blockers})`);
    const expA = ra.split('|')[1];
    const expB = rb.split('|')[1];
    check(expA && expA === expB,
      `F3 both submissions must resolve to the SAME expedition (a=${ra}, b=${rb})`);
    const state = await scalar(handle, `
      SELECT (SELECT coalesce(sum(xi.metros_liberados),0)::text FROM public.expedicao_itens xi
                JOIN public.expedicoes ex ON ex.id = xi.expedicao_id WHERE ex.op_tecelagem_id=${id.opF3}) || '/' ||
             (SELECT count(*)::text FROM public.expedicao_comandos
               WHERE idempotency_namespace='manta_release_v1' AND idempotency_key='CONC-1') || '/' ||
             (SELECT count(*)::text FROM public.op_eventos
               WHERE op_id=${id.opF3} AND tipo_evento='expedicao_manta_liberada');`);
    check(state === '40.00/1/1',
      `F3 exactly one business mutation, one command row and one event (got ${state})`);
    check(!/40P01|deadlock/i.test(err), `F3 must not deadlock (${err.slice(0, 300)})`);
    log('F3', { blocked_on_advisory: true, blockers, same_expedition: true, state, deadlock: false });
  }

  // ---- F4: different Manta OPs do not serialize ---------------------------
  {
    const a = openSession(handle, 'F4-a');
    a.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    a.send('BEGIN;');
    a.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pa = Number((await a.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    a.send(`SELECT 'A|' || ((${RELEASE(id.opF4a, id.itF4a, 40, 'IND-A')})->>'ok');`);
    await a.waitFor((l) => l.startsWith('A|'));

    const b = openSession(handle, 'F4-b');
    b.send(`SELECT set_config('request.jwt.claim.sub', '${adm}', false);`);
    b.send('BEGIN;');
    b.send(`SELECT 'PID|' || pg_backend_pid();`);
    const pb = Number((await b.waitFor((l) => l.startsWith('PID|'))).split('|')[1]);
    b.send(`SELECT 'B|' || ((${RELEASE(id.opF4b, id.itF4b, 40, 'IND-B')})->>'ok');`);
    const rb = await b.waitFor((l) => l.startsWith('B|'), 15000);   // must NOT wait for a
    const blockers = await scalar(handle, `SELECT array_to_string(pg_catalog.pg_blocking_pids(${pb}), ',');`);
    a.send(`COMMIT; SELECT 'CA';`); await a.waitFor((l) => l === 'CA');
    b.send(`COMMIT; SELECT 'CB';`); await b.waitFor((l) => l === 'CB');
    const err = `${a.stderr}${b.stderr}`;
    await a.close(); await b.close();

    check(rb === 'B|true', `F4 the independent Manta OP must release without waiting (got ${rb})`);
    check(!blockers.includes(String(pa)), `F4 different Manta OPs must not serialize (blockers=${blockers})`);
    check(!/40P01|deadlock/i.test(err), `F4 must not deadlock (${err.slice(0, 300)})`);
    log('F4', { independent: true, blockers: blockers || '(none)', deadlock: false });
  }

  // Global 40P01 sweep across every backend touched by Parts E and F.
  const deadlocks = await scalar(handle, `
    SELECT deadlocks::text FROM pg_stat_database WHERE datname = current_database();`);
  check(deadlocks === '0', `no deadlock may have been detected by the server (pg_stat_database.deadlocks = ${deadlocks})`);
  log('PART_F', { proofs: 'F1,F2a,F2b,F3,F4', deadlocks_reported_by_server: deadlocks });
}

// ===========================================================================
// PART Z — mandatory cluster destruction proof.
// ===========================================================================
async function partZ(handle) {
  const { postmasterPid, host, port, dataDir } = handle;
  const proof = await handle.stop();
  check(proof.stopResult.ok === true, 'Z: pg_ctl stop must report success');
  check(proof.pidAbsent === true, 'Z: postmaster PID must be absent');
  check(proof.portClosed === true, 'Z: port must be closed');
  check(proof.dirAbsent === true, 'Z: data directory must be removed');

  check(isPidAlive(postmasterPid) === false, `Z: postmaster PID ${postmasterPid} must no longer exist`);
  check((await isPortOpen(host, port, 1000)) === false, `Z: ${host}:${port} must no longer listen`);
  await assert.rejects(access(dataDir, fsConstants.F_OK), /ENOENT/, `Z: ${dataDir} must no longer exist`);

  const leftover = (await readdir(tmpdir())).filter((n) => n.startsWith(DATA_DIR_PREFIX) && dataDir.includes(n));
  check(leftover.length === 0, `Z: no ${DATA_DIR_PREFIX}* directory from this run may remain (${leftover.join(',')})`);
  log('PART_Z', { pid_absent: true, port_closed: true, dir_absent: true, postmasterPid, port, dataDir });
}

// ===========================================================================
async function main() {
  SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'manta-b2a-'));
  let handle = null;
  let stopped = false;
  try {
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pgVersion: handle.pgVersion, pid: handle.postmasterPid, dataDir: handle.dataDir });
    await partA(handle);
    await partB(handle);
    await partC(handle);
    await partD(handle);
    const ctx = await partE(handle);
    await partF(handle, ctx);
    await partZ(handle);
    stopped = true;
    console.log('MANTA_DIRECT_ROUTE_ACTIVATION_INVARIANT_PASS');
  } finally {
    if (handle && !stopped) { try { await handle.stop(); } catch { /* already reported */ } }
    if (SCRATCH_DIR) await rm(SCRATCH_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
