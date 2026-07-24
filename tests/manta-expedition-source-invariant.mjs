// tests/manta-expedition-source-invariant.mjs
//
// PHASE-MANTA-B1 disposable-cluster proof of db/81 + db/82 (source/membership/
// lock-order correction) + db/83 (source route + item identity correction) +
// db/84 (symmetric Latex route + source lineage correction) — full-chain
// apply, idempotent re-apply, the (extended) db/81 schema/guard integration
// test, regression, and distinct-session concurrency (item-move-wins,
// membership-insert-wins, source-change no-deadlock, source non-emptiness,
// source-model-change-wins, referenced-identity-change rejected post-lock,
// OP-type-change-vs-membership, two-identity-change no-deadlock,
// lineage-insert-wins vs Lote/Pedido update, Lote/Pedido-update-wins,
// OP-lote-change-vs-insert, independent-source non-serialization, plus the
// db/81/db/82/db/83 regressions).
//
// Governing contract: docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md.
// Migrations: db/81_manta_expedition_source_foundation.sql,
// db/82_manta_expedition_source_invariant_correction.sql,
// db/83_manta_expedition_source_identity_correction.sql and
// db/84_manta_expedition_source_lineage_correction.sql.
//
// ENVIRONMENT: disposable local PostgreSQL 18.4 ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. The Supabase-platform preamble and all
// fixtures are rebuilt in OS temp files outside the repository and removed on exit.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   Part A  full chain db/01..db/82 applies cleanly, in order (corpus after db/66);
//           db/81+db/82 terminal objects all present (op_tecelagem_id nullable-latex
//           + exactly-one-source CHECK + partial unique index + the seven guard
//           triggers incl. op_itens_source_nonempty_guard).
//   Part B  db/82 re-applies idempotently with a before/after schema fingerprint
//           proving zero schema/constraint/trigger/function/grant drift.
//   Part C  tests/manta-expedition-source.integration.sql passes UNCHANGED against
//           db/01..82 (all db/81 guards; db/82 only strengthens them).
//   Part D  regression: tests/manta-product-identity.integration.sql still passes;
//           the Manta finishing rejection is intact; C5A emission still passes.
//   Part E  distinct-session concurrency (real psql backends, pg_blocking_pids):
//             A item-move-wins: a mover moves an op_item off the source and commits
//               while a membership insert waits on the source-OP lock; the insert
//               re-reads the committed ownership and rejects (no stale-read accept).
//             B membership-insert-wins: an insert commits while a mover waits; the
//               move is then rejected by the reference guard; membership valid.
//             C source-change no-deadlock: a source-changing UPDATE is rejected
//               WITHOUT taking any OP lock (does not block on a held source-OP
//               lock), so it never inverts; a concurrent valid membership insert
//               completes; no 40P01.
//             D last-item move rejected; E last-item delete rejected (source stays
//               non-empty).
//             F concurrent removals from a 2-item source serialize on the source
//               OP: at most one commits, >=1 item remains, no deadlock.
//             G a non-last unreferenced removal is accepted; a referenced item stays
//               FK-protected.
//             H regressions: two creations for one Manta OP -> one commit + one
//               rejection; cross-OP injection rejected; different source OPs do not
//               serialize; a Tapete Latex expedition + item is accepted.
//             I source-model-change-wins (db/83 BLOCKER B): a raw source-type-
//               violating UPDATE holds the source-OP lock in an aborted,
//               uncommitted transaction; a concurrent valid membership insert
//               blocks on it, then completes once rolled back, observing no
//               route flip; no deadlock.
//             J membership-insert-wins (db/83 BLOCKER D): an insert commits while
//               a concurrent op_item.modelo_id change waits on the source-OP
//               lock; the change is then rejected against the freshly committed
//               reference; item and op_item stay aligned.
//             K OP-type-change-vs-membership (db/83 BLOCKER A): a raw
//               type-violating ops UPDATE holds the row lock in an aborted,
//               uncommitted transaction; a concurrent valid membership insert
//               blocks on it, then completes once rolled back; no deadlock/40P01.
//             L two-identity-change no-deadlock (db/83 BLOCKER B): two sessions
//               swap items between two Manta sources in opposing directions;
//               deterministic ascending OP-id lock order serializes them without
//               deadlock; both commit; both sources stay homogeneous Manta.
//             M lineage-insert-wins vs Lote update (db/84 BLOCKER B/E): a valid
//               expedition INSERT holds the source Lote FOR SHARE uncommitted; a
//               concurrent Lote pedido_id change blocks; once the INSERT commits
//               the change is rejected; lineage stays aligned.
//             N Lote-update-wins (db/84 BLOCKER B): a Lote pedido_id change
//               commits before any source is selected; a waiting expedition
//               INSERT (stale payload) re-reads the committed Lote and is
//               rejected; a refreshed, correct payload then succeeds.
//             O lineage-insert-wins vs Pedido update (db/84 BLOCKER B/F): same
//               shape as M, one level up (source Pedido FOR SHARE vs a
//               concurrent cliente_id change).
//             P Pedido-update-wins (db/84 BLOCKER B): a Pedido cliente_id
//               change commits before any source is selected; a waiting
//               expedition INSERT is rejected once it re-reads the (now
//               lineage-inconsistent) committed state.
//             Q OP-lote-change-vs-insert (db/84 BLOCKER B/D): an ops.lote_id
//               change (before selection) commits while a waiting expedition
//               INSERT holds a stale lote_id payload; the insert is rejected
//               post-lock; no split lineage.
//             R independent sources do not serialize (db/84): two expeditions
//               on fully independent OP/Lote/Pedido chains commit concurrently
//               without blocking each other; no deadlock.
//   Part Z  mandatory full cluster destruction (pid absent, port closed, dir
//           absent; no c3d-disposable-pg-* residue from this run).
//
// Run:  node tests/manta-expedition-source-invariant.mjs
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

// ---------------------------------------------------------------------------
// Supabase-platform preamble a bare PG 18.4 cluster lacks (applied before db/01).
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
// the db/78-82 guards do not fire during planting and are exercised live by the
// concurrent sessions). One dedicated OP set per test avoids interference.
const CONCURRENCY_FIXTURES_SQL = `
CREATE TABLE IF NOT EXISTS public._b2_ids (k TEXT PRIMARY KEY, v BIGINT);
CREATE TABLE IF NOT EXISTS public._b2_uuids (k TEXT PRIMARY KEY, v UUID);
SET session_replication_role = replica;
DO $cf$
DECLARE
  c1 BIGINT; c2 BIGINT; mm BIGINT; mt BIGINT; forn BIGINT; dest BIGINT;
  cli BIGINT; ped UUID; lote BIGINT;
  opA BIGINT; opAt BIGINT; iA1 BIGINT; iA2 BIGINT; expA BIGINT;
  opB BIGINT; opBt BIGINT; iB1 BIGINT; iB2 BIGINT; expB BIGINT;
  opC BIGINT; iC1 BIGINT; expC BIGINT;
  opD BIGINT; opDt BIGINT; itD BIGINT; expD BIGINT;
  opE BIGINT; iE BIGINT; expE BIGINT;
  opF BIGINT; iF1 BIGINT; iF2 BIGINT; expF BIGINT;
  opG BIGINT; iG1 BIGINT; iG2 BIGINT; expG BIGINT;
  opH BIGINT; iH BIGINT;
  opHx BIGINT; iHx BIGINT; expHx BIGINT;
  opH3a BIGINT; iH3a BIGINT; opH3b BIGINT; iH3b BIGINT;
  opLx BIGINT; iLx BIGINT;
  opI BIGINT; iI BIGINT; expI BIGINT;
  opJ BIGINT; iJ BIGINT; expJ BIGINT;
  opK BIGINT; iK BIGINT; expK BIGINT;
  opM1 BIGINT; iM1a BIGINT; iM1b BIGINT; expM1 BIGINT;
  opM2 BIGINT; iM2a BIGINT; iM2b BIGINT; expM2 BIGINT;
  cli2 BIGINT;
  pedMv UUID; pedMaltv UUID; loteM BIGINT; opM BIGINT; iM BIGINT;
  pedNav UUID; pedNbv UUID; loteN BIGINT; opN BIGINT; itN BIGINT;
  pedOv UUID; loteO BIGINT; opO BIGINT; iO BIGINT;
  pedPv UUID; loteP BIGINT; opP BIGINT; iP BIGINT;
  pedQv UUID; loteQ BIGINT; loteQ2 BIGINT; opQ BIGINT; iQ BIGINT;
  pedR1v UUID; loteR1 BIGINT; opR1 BIGINT; iR1 BIGINT;
  pedR2v UUID; loteR2 BIGINT; opR2 BIGINT; iR2 BIGINT;
BEGIN
  INSERT INTO public.cores(nome) VALUES ('B2-KRAFT') RETURNING id INTO c1;
  INSERT INTO public.cores(nome) VALUES ('B2-CRU')   RETURNING id INTO c2;
  INSERT INTO public.fornecedores(nome,tipo) VALUES ('B2-TEC','tecelagem') RETURNING id INTO forn;
  INSERT INTO public.fornecedores(nome,tipo) VALUES ('B2-LATEX','latex')   RETURNING id INTO dest;
  INSERT INTO public.modelos(nome,cor_1_id,cor_2_id,largura,tipo_produto) VALUES ('B2-MANTA',  c1,c2,1.40,'manta')  RETURNING id INTO mm;
  INSERT INTO public.modelos(nome,cor_1_id,cor_2_id,largura,tipo_produto) VALUES ('B2-TAPETE', c1,c2,2.10,'tapete') RETURNING id INTO mt;
  INSERT INTO public.clientes(nome) VALUES ('B2-CLI') RETURNING id INTO cli;
  INSERT INTO public.clientes(nome) VALUES ('B2-CLI-2') RETURNING id INTO cli2;
  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986001,'confirmado') RETURNING id INTO ped;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986001,cli,ped) RETURNING id INTO lote;

  -- A: source opA (2 items), empty target opAt, header expA (no items).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986001,2026,'concluida','tecelagem',lote) RETURNING id INTO opA;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986002,2026,'concluida','tecelagem',lote) RETURNING id INTO opAt;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opA,mm,50) RETURNING id INTO iA1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opA,mm,50) RETURNING id INTO iA2;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opA,lote,cli) RETURNING id INTO expA;

  -- B: source opB (2 items), empty target opBt, header expB (no items).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986003,2026,'concluida','tecelagem',lote) RETURNING id INTO opB;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986004,2026,'concluida','tecelagem',lote) RETURNING id INTO opBt;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opB,mm,50) RETURNING id INTO iB1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opB,mm,50) RETURNING id INTO iB2;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opB,lote,cli) RETURNING id INTO expB;

  -- C: source opC (1 item), header expC (no items).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986005,2026,'concluida','tecelagem',lote) RETURNING id INTO opC;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opC,mm,50) RETURNING id INTO iC1;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opC,lote,cli) RETURNING id INTO expC;

  -- D: source opD (1 item), empty target opDt, header expD.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986006,2026,'concluida','tecelagem',lote) RETURNING id INTO opD;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986007,2026,'concluida','tecelagem',lote) RETURNING id INTO opDt;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opD,mm,50) RETURNING id INTO itD;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opD,lote,cli) RETURNING id INTO expD;

  -- E: source opE (1 item), header expE.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986008,2026,'concluida','tecelagem',lote) RETURNING id INTO opE;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opE,mm,50) RETURNING id INTO iE;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opE,lote,cli) RETURNING id INTO expE;

  -- F: source opF (2 items), header expF.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986009,2026,'concluida','tecelagem',lote) RETURNING id INTO opF;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF,mm,50) RETURNING id INTO iF1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opF,mm,50) RETURNING id INTO iF2;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opF,lote,cli) RETURNING id INTO expF;

  -- G: source opG (2 items), header expG referencing iG2.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986010,2026,'concluida','tecelagem',lote) RETURNING id INTO opG;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opG,mm,50) RETURNING id INTO iG1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opG,mm,50) RETURNING id INTO iG2;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opG,lote,cli) RETURNING id INTO expG;
  INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (expG,iG2,mm,50);

  -- H1: opH (1 item), no expedition yet (two sessions race to create).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986011,2026,'concluida','tecelagem',lote) RETURNING id INTO opH;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opH,mm,50) RETURNING id INTO iH;

  -- H2: opHx (1 item) with header expHx (cross-OP injection target).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986012,2026,'concluida','tecelagem',lote) RETURNING id INTO opHx;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opHx,mm,50) RETURNING id INTO iHx;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opHx,lote,cli) RETURNING id INTO expHx;

  -- H3: two independent Manta OPs (different-OP non-serialization).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986013,2026,'concluida','tecelagem',lote) RETURNING id INTO opH3a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opH3a,mm,50) RETURNING id INTO iH3a;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986014,2026,'concluida','tecelagem',lote) RETURNING id INTO opH3b;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opH3b,mm,50) RETURNING id INTO iH3b;

  -- H4: a Latex OP + item for the Tapete Latex expedition regression.
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986015,2026,'finalizada','latex',lote) RETURNING id INTO opLx;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opLx,mt,50) RETURNING id INTO iLx;

  -- I: db/83 source-model-change-wins -- Manta source opI (1 item iI), header
  -- expI (no items yet).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986016,2026,'concluida','tecelagem',lote) RETURNING id INTO opI;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opI,mm,50) RETURNING id INTO iI;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opI,lote,cli) RETURNING id INTO expI;

  -- J: db/83 membership-insert-wins -- Manta source opJ (1 item iJ), header
  -- expJ (no items yet).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986017,2026,'concluida','tecelagem',lote) RETURNING id INTO opJ;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opJ,mm,50) RETURNING id INTO iJ;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opJ,lote,cli) RETURNING id INTO expJ;

  -- K: db/83 OP-type-change-vs-membership -- Manta source opK (1 item iK),
  -- header expK (no items yet).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986018,2026,'concluida','tecelagem',lote) RETURNING id INTO opK;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opK,mm,50) RETURNING id INTO iK;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opK,lote,cli) RETURNING id INTO expK;

  -- M: db/83 two-identity-change no-deadlock -- two Manta sources, each with 2
  -- items (opM1 < opM2, so the ascending lock order is identical for both
  -- opposing item moves).
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986019,2026,'concluida','tecelagem',lote) RETURNING id INTO opM1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opM1,mm,50) RETURNING id INTO iM1a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opM1,mm,50) RETURNING id INTO iM1b;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opM1,lote,cli) RETURNING id INTO expM1;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986020,2026,'concluida','tecelagem',lote) RETURNING id INTO opM2;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opM2,mm,50) RETURNING id INTO iM2a;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opM2,mm,50) RETURNING id INTO iM2b;
  INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES (ped,opM2,lote,cli) RETURNING id INTO expM2;

  -- db/84 lineage fixtures: each test gets its own isolated Pedido/Lote/OP
  -- chain (source not yet selected -- no expedicoes row planted here) so
  -- concurrent lineage mutation and expedition-insertion races are exercised
  -- live, never pre-empted by the triggers-off planting itself.
  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986002,'confirmado') RETURNING id INTO pedMv;
  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986003,'confirmado') RETURNING id INTO pedMaltv;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986002,cli,pedMv) RETURNING id INTO loteM;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986021,2026,'concluida','tecelagem',loteM) RETURNING id INTO opM;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opM,mm,50) RETURNING id INTO iM;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986004,'confirmado') RETURNING id INTO pedNav;
  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986005,'confirmado') RETURNING id INTO pedNbv;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986003,cli,pedNav) RETURNING id INTO loteN;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986022,2026,'concluida','tecelagem',loteN) RETURNING id INTO opN;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opN,mm,50) RETURNING id INTO itN;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986006,'confirmado') RETURNING id INTO pedOv;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986004,cli,pedOv) RETURNING id INTO loteO;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986023,2026,'concluida','tecelagem',loteO) RETURNING id INTO opO;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opO,mm,50) RETURNING id INTO iO;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986007,'confirmado') RETURNING id INTO pedPv;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986005,cli,pedPv) RETURNING id INTO loteP;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986024,2026,'concluida','tecelagem',loteP) RETURNING id INTO opP;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opP,mm,50) RETURNING id INTO iP;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986008,'confirmado') RETURNING id INTO pedQv;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986006,cli,pedQv) RETURNING id INTO loteQ;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986007,cli,pedQv) RETURNING id INTO loteQ2;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986025,2026,'concluida','tecelagem',loteQ) RETURNING id INTO opQ;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opQ,mm,50) RETURNING id INTO iQ;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986009,'confirmado') RETURNING id INTO pedR1v;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986008,cli,pedR1v) RETURNING id INTO loteR1;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986026,2026,'concluida','tecelagem',loteR1) RETURNING id INTO opR1;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opR1,mm,50) RETURNING id INTO iR1;

  INSERT INTO public.pedidos(cliente_id,numero,status) VALUES (cli,986010,'confirmado') RETURNING id INTO pedR2v;
  INSERT INTO public.lotes(numero,cliente_id,pedido_id) VALUES (986009,cli,pedR2v) RETURNING id INTO loteR2;
  INSERT INTO public.ops(numero,ano,status,tipo,lote_id) VALUES (986027,2026,'concluida','tecelagem',loteR2) RETURNING id INTO opR2;
  INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos) VALUES (opR2,mm,50) RETURNING id INTO iR2;

  INSERT INTO public._b2_ids(k,v) VALUES
    ('mm',mm),('mt',mt),('lote',lote),('cli',cli),
    ('opA',opA),('opAt',opAt),('iA1',iA1),('iA2',iA2),('expA',expA),
    ('opB',opB),('opBt',opBt),('iB1',iB1),('iB2',iB2),('expB',expB),
    ('opC',opC),('iC1',iC1),('expC',expC),
    ('opD',opD),('opDt',opDt),('itD',itD),('expD',expD),
    ('opE',opE),('iE',iE),('expE',expE),
    ('opF',opF),('iF1',iF1),('iF2',iF2),('expF',expF),
    ('opG',opG),('iG1',iG1),('iG2',iG2),('expG',expG),
    ('opH',opH),('iH',iH),
    ('opHx',opHx),('iHx',iHx),('expHx',expHx),
    ('opH3a',opH3a),('iH3a',iH3a),('opH3b',opH3b),('iH3b',iH3b),
    ('opLx',opLx),('iLx',iLx),
    ('opI',opI),('iI',iI),('expI',expI),
    ('opJ',opJ),('iJ',iJ),('expJ',expJ),
    ('opK',opK),('iK',iK),('expK',expK),
    ('opM1',opM1),('iM1a',iM1a),('iM1b',iM1b),('expM1',expM1),
    ('opM2',opM2),('iM2a',iM2a),('iM2b',iM2b),('expM2',expM2),
    ('cli2',cli2),
    ('loteM',loteM),('opM',opM),('iM',iM),
    ('loteN',loteN),('opN',opN),('iN',itN),
    ('loteO',loteO),('opO',opO),('iO',iO),
    ('loteP',loteP),('opP',opP),('iP',iP),
    ('loteQ',loteQ),('loteQ2',loteQ2),('opQ',opQ),('iQ',iQ),
    ('loteR1',loteR1),('opR1',opR1),('iR1',iR1),
    ('loteR2',loteR2),('opR2',opR2),('iR2',iR2);

  INSERT INTO public._b2_uuids(k,v) VALUES
    ('ped',ped),
    ('pedM',pedMv),('pedMalt',pedMaltv),
    ('pedNa',pedNav),('pedNb',pedNbv),
    ('pedO',pedOv),
    ('pedP',pedPv),
    ('pedQ',pedQv),
    ('pedR1',pedR1v),
    ('pedR2',pedR2v);
END
$cf$;
SET session_replication_role = origin;
`;

// ---------------------------------------------------------------------------
// Small utilities (mirror the accepted idiom in the Manta identity harness).
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
    encoding: 'utf8', timeout: 120000,
  });
  if (result.status !== 0) {
    const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
    throw new Error(`APPLY_FAILED (${labelForError || file}): ${diag}`);
  }
  return result.stdout || '';
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
    send(sql) { assert.equal(closed, false, `${name} is already closed`); child.stdin.write(`${sql}\n`); },
    waitFor(predicate, timeoutMs = 20000) {
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

async function waitForBlock(handle, subjectPid, blockerPid, attempts = 200) {
  for (let i = 0; i < attempts; i += 1) {
    const row = await scalar(handle,
      `SELECT array_to_string(pg_catalog.pg_blocking_pids(${subjectPid}), ',');`);
    if (row.split(',').includes(String(blockerPid))) return row;
    await delay(50);
  }
  throw new Error(`backend ${subjectPid} did not block on ${blockerPid}`);
}
async function blockingPids(handle, subjectPid) {
  return scalar(handle, `SELECT array_to_string(pg_catalog.pg_blocking_pids(${subjectPid}), ',');`);
}

// Run a single autocommit statement inside a DO block and return 'OK' (the
// statement committed) or 'REJECTED|<sqlerrm>' (it raised and rolled back). Unlike
// a DO block that RAISEs after a successful op, this never rolls back a wrongly
// accepted op — so an 'OK' outcome is a genuine, persisted acceptance.
async function attempt(handle, name, opSql) {
  const s = openSession(handle, name);
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
// PART A — full chain apply + db/81..db/84 terminal-object presence.
//
// PHASE-MANTA-B2A realignment (db/88): this harness owns the PHASE-MANTA-B1
// invariants, NOT the repository's migration terminal. It therefore applies the
// COMPLETE current chain and asserts that db/01..db/84 is an unbroken, contiguous
// PREFIX of it and that every db/81-84 object and invariant is still present.
// It deliberately does not hard-code an eternal manifest length, so it stays
// useful as later forward migrations are added; none of the B1 assertions below
// is weakened by that change.
// ===========================================================================
const B1_TERMINAL = 84;

async function partA(handle) {
  const manifest = await resolveManifest();
  check(manifest.length >= B1_TERMINAL,
    `manifest must contain at least db/01..db/${B1_TERMINAL} (got ${manifest.length})`);
  const prefix = manifest.slice(0, B1_TERMINAL);
  check(prefix.every((entry, i) => entry.n === i + 1),
    `db/01..db/${B1_TERMINAL} must be a contiguous prefix of the manifest (got ${prefix.map((e) => e.n).join(',')})`);
  check(manifest.every((entry, i) => entry.n === i + 1),
    `the whole manifest must stay contiguous from db/01 (got terminal ${manifest[manifest.length - 1].n} over ${manifest.length} files)`);

  await applySql(handle, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    applyFile(handle, file, path.basename(file));
    if (n === 66) await applySql(handle, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
  }

  const objs = await scalar(handle, `
    SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='expedicoes' AND column_name='op_tecelagem_id') || '/' ||
           (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='expedicoes' AND column_name='op_latex_id') || '/' ||
           (SELECT count(*) FROM pg_constraint WHERE conname='expedicoes_exactly_one_source_chk') || '/' ||
           (SELECT count(*) FROM pg_class WHERE relname='expedicoes_op_tecelagem_id_uk' AND relkind='i') || '/' ||
           (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
              'expedicoes_source_validation_guard','expedicao_itens_membership_guard',
              'op_itens_expedicao_reference_guard','entrega_itens_manta_consumo_guard',
              'entregas_manta_consumo_guard','ops_manta_reopen_guard','op_itens_source_nonempty_guard',
              'ops_source_type_immutability_guard','lotes_source_lineage_immutability_guard',
              'pedidos_source_lineage_immutability_guard'));`);
  check(objs === '1/YES/1/1/10', `db/81+db/82+db/83+db/84 terminal objects must all exist (tec_col/latex_nullable/chk/uk/triggers = ${objs})`);
  log('PART_A', {
    migrations: manifest.length,
    b1_terminal: B1_TERMINAL,
    repository_terminal: manifest[manifest.length - 1].n,
    objects: objs,
    clean_apply: true,
  });
}

// ===========================================================================
// PART B — db/84 idempotent re-apply with zero drift.
// ===========================================================================
async function partB(handle) {
  const before = await schemaFingerprint(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', '84_manta_expedition_source_lineage_correction.sql'), 'db/84 re-apply');
  const after = await schemaFingerprint(handle);
  check(before === after, `idempotent re-apply of db/84 must cause zero schema drift (before=${before}, after=${after})`);
  log('PART_B', { fingerprint_stable: true, reapply: 'db/84', drift: 'none' });
}

// ===========================================================================
// PART C — the db/81/db/82/db/83 guards + the db/84 Latex-route/lineage
// proofs, in the same integration test, against db/01..84.
// ===========================================================================
async function partC(handle) {
  const file = path.join(HERE, 'manta-expedition-source.integration.sql');
  const out = applyFile(handle, file, 'manta-expedition-source.integration.sql');
  check(/MANTA_EXPEDITION_SOURCE_INTEGRATION_PASS/.test(out),
    `db/81/db/82/db/83/db/84 integration test must pass under db/84 (got: ${out.trim().split(/\r?\n/).slice(-3).join(' / ')})`);
  log('PART_C', { integration_test: 'manta-expedition-source.integration.sql', result: 'PASS' });
}

// ===========================================================================
// PART D — regression: identity guards, finishing rejection, C5A emission.
// ===========================================================================
async function partD(handle) {
  const idOut = applyFile(handle, path.join(HERE, 'manta-product-identity.integration.sql'), 'manta-product-identity.integration.sql');
  check(/MANTA_PRODUCT_IDENTITY_INTEGRATION_PASS/.test(idOut),
    `db/78-80 identity integration test must still pass (got: ${idOut.trim().split(/\r?\n/).slice(-3).join(' / ')})`);

  const fin = await scalar(handle, `
    SELECT (CASE WHEN pg_get_functiondef('public.gerar_op_latex(bigint)'::regprocedure) LIKE '%e de Manta%' THEN 'latex_ok' ELSE 'latex_MISSING' END)
        || '/' ||
           (CASE WHEN pg_get_functiondef('public.gerar_op_latex_split(bigint,text)'::regprocedure) LIKE '%e de Manta%' THEN 'split_ok' ELSE 'split_MISSING' END);`);
  check(fin === 'latex_ok/split_ok', `Manta finishing rejection must remain in gerar_op_latex/_split (got ${fin})`);

  const recon = await scalar(handle, `
    SELECT (SELECT count(*) FROM public.ordens_compra_fio) || '/' ||
           (SELECT count(*) FROM public.ordem_compra) || '/' ||
           (SELECT count(*) FROM public.ordem_compra_item);`);
  check(recon.startsWith('64/51/51'), `C5 corpus must be reconciled 64/51/51 (got ${recon})`);
  const c5 = applyFile(handle, path.join(HERE, 'ordem-compra-c5a-emission-readiness.integration.sql'), 'ordem-compra-c5a-emission-readiness.integration.sql');
  check(/C5A_EMISSION_READINESS_INTEGRATION_PASS/.test(c5),
    `C5A emission test must still pass (got: ${c5.trim().split(/\r?\n/).slice(-3).join(' / ')})`);
  log('PART_D', { identity_regression: 'PASS', finishing_rejection: fin, c5_reconciliation: recon.split(' ')[0], c5a_emission: 'PASS' });
}

// ===========================================================================
// PART E — distinct-session concurrency (Tests A–H).
// ===========================================================================
async function partE(handle) {
  await applySql(handle, 'concurrency-fixtures.sql', CONCURRENCY_FIXTURES_SQL, 'concurrency fixtures');
  const id = {};
  const keys = ['mm', 'mt', 'lote', 'cli', 'opA', 'opAt', 'iA1', 'iA2', 'expA', 'opB', 'opBt', 'iB1', 'iB2', 'expB',
    'opC', 'iC1', 'expC', 'opD', 'opDt', 'itD', 'expD', 'opE', 'iE', 'expE', 'opF', 'iF1', 'iF2', 'expF',
    'opG', 'iG1', 'iG2', 'expG', 'opH', 'iH', 'opHx', 'iHx', 'expHx', 'opH3a', 'iH3a', 'opH3b', 'iH3b', 'opLx', 'iLx',
    'opI', 'iI', 'expI', 'opJ', 'iJ', 'expJ', 'opK', 'iK', 'expK',
    'opM1', 'iM1a', 'iM1b', 'expM1', 'opM2', 'iM2a', 'iM2b', 'expM2',
    'cli2', 'loteM', 'opM', 'iM', 'loteN', 'opN', 'iN', 'loteO', 'opO', 'iO',
    'loteP', 'opP', 'iP', 'loteQ', 'loteQ2', 'opQ', 'iQ', 'loteR1', 'opR1', 'iR1', 'loteR2', 'opR2', 'iR2'];
  for (const k of keys) {
    id[k] = Number(await scalar(handle, `SELECT v FROM public._b2_ids WHERE k='${k}';`));
    check(Number.isInteger(id[k]) && id[k] > 0, `fixture id ${k} must resolve (got ${id[k]})`);
  }
  const ped = await scalar(handle, `SELECT pedido_id FROM public.expedicoes WHERE id=${id.expA};`);
  check(/^[0-9a-f-]{36}$/.test(ped), `fixture pedido must resolve (got ${ped})`);

  const uid = {};
  const uuidKeys = ['pedM', 'pedMalt', 'pedNa', 'pedNb', 'pedO', 'pedP', 'pedQ', 'pedR1', 'pedR2'];
  for (const k of uuidKeys) {
    uid[k] = await scalar(handle, `SELECT v FROM public._b2_uuids WHERE k='${k}';`);
    check(/^[0-9a-f-]{36}$/.test(uid[k]), `fixture uuid ${k} must resolve (got ${uid[k]})`);
  }

  // ---- A: item move wins (post-lock ownership re-read; no stale accept) -------
  {
    const mover = openSession(handle, 'A-mover');
    mover.send('BEGIN;');
    mover.send(`SELECT 'MPID|' || pg_backend_pid();`);
    const mpid = Number((await mover.waitFor((l) => l.startsWith('MPID|'))).split('|')[1]);
    // Move the SECOND (unreferenced) item off opA -> opAt (opA keeps iA1: non-empty).
    mover.send(`UPDATE public.op_itens SET op_id=${id.opAt} WHERE id=${id.iA2}; SELECT 'MOVE_DONE';`);
    await mover.waitFor((l) => l === 'MOVE_DONE');   // holds opA (+opAt) locks, uncommitted

    const ins = openSession(handle, 'A-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`CREATE TEMP TABLE _a(v text);`);
    ins.send(`DO $$ BEGIN
        INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expA}, ${id.iA2}, ${id.mm}, 10);
        INSERT INTO _a VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _a VALUES ('REJECTED|'||SQLERRM); END $$;`);
    ins.send(`SELECT 'IRES|' || v FROM _a;`);
    await waitForBlock(handle, ipid, mpid);   // insert waits on opA lock held by the mover
    log('A', { mover_pid: mpid, ins_pid: ipid, ins_blocked_by_mover: true });

    mover.send(`COMMIT; SELECT 'MCOMMIT';`);
    await mover.waitFor((l) => l === 'MCOMMIT');
    const res = await ins.waitFor((l) => l.startsWith('IRES|'));
    ins.send('ROLLBACK;');
    check(/REJECTED\|/.test(res) && /(cross-OP|nao pertence)/i.test(res),
      `A: after the move commits, the membership insert must re-read ownership and reject (got ${res})`);
    check(!/deadlock|40P01/i.test(mover.stderr + ins.stderr), 'A: no deadlock');
    await mover.close();
    await ins.close();

    const invalid = await scalar(handle, `
      SELECT count(*) FROM public.expedicao_itens xi JOIN public.op_itens oi ON oi.id=xi.op_item_id
       WHERE xi.expedicao_id=${id.expA} AND oi.op_id <> ${id.opA};`);
    check(Number(invalid) === 0, `A: zero invalid expedition item may remain (got ${invalid})`);
    log('A', { outcome: 'item_move_wins__insert_rejected_post_lock', invalid_items: invalid });
  }

  // ---- B: membership insert wins; later move rejected by the reference guard --
  {
    const ins = openSession(handle, 'B-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expB}, ${id.iB2}, ${id.mm}, 10); SELECT 'INS_DONE';`);
    await ins.waitFor((l) => l === 'INS_DONE');   // holds opB lock, uncommitted

    const mover = openSession(handle, 'B-mover');
    mover.send('BEGIN;');
    mover.send(`SELECT 'MPID|' || pg_backend_pid();`);
    const mpid = Number((await mover.waitFor((l) => l.startsWith('MPID|'))).split('|')[1]);
    mover.send(`CREATE TEMP TABLE _b(v text);`);
    mover.send(`DO $$ BEGIN
        UPDATE public.op_itens SET op_id=${id.opBt} WHERE id=${id.iB2};
        INSERT INTO _b VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _b VALUES ('REJECTED|'||SQLERRM); END $$;`);
    mover.send(`SELECT 'MRES|' || v FROM _b;`);
    await waitForBlock(handle, mpid, ipid);   // mover waits on opB lock held by the insert
    log('B', { ins_pid: ipid, mover_pid: mpid, mover_blocked_by_ins: true });

    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    const res = await mover.waitFor((l) => l.startsWith('MRES|'));
    mover.send('ROLLBACK;');
    check(/REJECTED\|/.test(res) && /referenciad/i.test(res),
      `B: the move of a now-referenced op_item must be rejected by the reference guard (got ${res})`);
    check(!/deadlock|40P01/i.test(mover.stderr + ins.stderr), 'B: no deadlock');
    await ins.close();
    await mover.close();

    const stillA = await scalar(handle, `SELECT op_id FROM public.op_itens WHERE id=${id.iB2};`);
    check(Number(stillA) === id.opB, `B: membership must remain valid (item still in opB, got ${stillA})`);
    log('B', { outcome: 'membership_insert_wins__move_rejected' });
  }

  // ---- C: source-change UPDATE takes no OP lock (no inversion), insert proceeds --
  {
    const holder = openSession(handle, 'C-holder');
    holder.send('BEGIN;');
    holder.send(`SELECT 'HPID|' || pg_backend_pid();`);
    const hpid = Number((await holder.waitFor((l) => l.startsWith('HPID|'))).split('|')[1]);
    holder.send(`SELECT 1 FROM public.ops WHERE id=${id.opC} FOR UPDATE; SELECT 'HOLD_READY';`);
    await holder.waitFor((l) => l === 'HOLD_READY');   // holds opC FOR UPDATE

    // A source-changing UPDATE must be rejected WITHOUT requesting the opC lock,
    // so it does NOT block on the holder — it returns a rejection immediately.
    const chg = openSession(handle, 'C-chg');
    chg.send(`CREATE TEMP TABLE _c(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.expedicoes SET op_tecelagem_id=${id.opA} WHERE id=${id.expC};
        INSERT INTO _c VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _c VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _c;`);
    const cres = await chg.waitFor((l) => l.startsWith('CRES|'), 8000);   // must NOT hang on opC
    await chg.close();
    check(/REJECTED\|/.test(cres) && /imutavel/i.test(cres),
      `C: a source-changing UPDATE must be rejected as immutable without blocking (got ${cres})`);

    // A real membership insert into expC DOES take the opC lock, so it blocks on
    // the holder, then proceeds once released — proving the OP lock is the only
    // contention and there is no deadlock.
    const ins = openSession(handle, 'C-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expC}, ${id.iC1}, ${id.mm}, 10); SELECT 'INS_DONE';`);
    await waitForBlock(handle, ipid, hpid);
    holder.send(`ROLLBACK; SELECT 'HDONE';`);
    await holder.waitFor((l) => l === 'HDONE');
    await ins.waitFor((l) => l === 'INS_DONE');
    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    check(!/deadlock|40P01/i.test(holder.stderr + chg.stderr + ins.stderr), 'C: no deadlock/40P01');
    await holder.close();
    await ins.close();
    log('C', { source_change_rejected_no_block: true, membership_insert_completed: true, no_deadlock: true });
  }

  // ---- D: last-item move rejected; E: last-item delete rejected ---------------
  {
    const mv = await attempt(handle, 'D-move', `UPDATE public.op_itens SET op_id=${id.opDt} WHERE id=${id.itD}`);
    check(/REJECTED\|/.test(mv) && /sem itens|nao pode ficar/i.test(mv), `D: last-item move must be rejected (got ${mv})`);
    const remD = await scalar(handle, `SELECT count(*) FROM public.op_itens WHERE op_id=${id.opD};`);
    const stillD = await scalar(handle, `SELECT op_id FROM public.op_itens WHERE id=${id.itD};`);
    check(Number(remD) === 1 && Number(stillD) === id.opD, `D: source opD must remain non-empty with its item (items=${remD}, item_op=${stillD})`);
    log('D', { last_item_move: 'rejected', opD_items: remD });

    const del = await attempt(handle, 'E-del', `DELETE FROM public.op_itens WHERE id=${id.iE}`);
    check(/REJECTED\|/.test(del) && /sem itens|nao pode ficar/i.test(del), `E: last-item delete must be rejected (got ${del})`);
    const remE = await scalar(handle, `SELECT count(*) FROM public.op_itens WHERE op_id=${id.opE};`);
    check(Number(remE) === 1, `E: source opE must remain non-empty (got ${remE})`);
    log('E', { last_item_delete: 'rejected', opE_items: remE });
  }

  // ---- F: concurrent removals from a 2-item source serialize; >=1 remains -----
  {
    const s1 = openSession(handle, 'F-s1');
    s1.send('BEGIN;');
    s1.send(`SELECT 'S1PID|' || pg_backend_pid();`);
    const s1pid = Number((await s1.waitFor((l) => l.startsWith('S1PID|'))).split('|')[1]);
    s1.send(`DELETE FROM public.op_itens WHERE id=${id.iF1}; SELECT 'S1DEL_DONE';`);
    await s1.waitFor((l) => l === 'S1DEL_DONE');   // holds opF lock, uncommitted (leaves iF2)

    const s2 = openSession(handle, 'F-s2');
    s2.send('BEGIN;');
    s2.send(`SELECT 'S2PID|' || pg_backend_pid();`);
    const s2pid = Number((await s2.waitFor((l) => l.startsWith('S2PID|'))).split('|')[1]);
    s2.send(`CREATE TEMP TABLE _f(v text);`);
    s2.send(`DO $$ BEGIN DELETE FROM public.op_itens WHERE id=${id.iF2};
        INSERT INTO _f VALUES ('DELETED'); EXCEPTION WHEN OTHERS THEN INSERT INTO _f VALUES ('REJECTED|'||SQLERRM); END $$;`);
    s2.send(`SELECT 'S2RES|' || v FROM _f;`);
    await waitForBlock(handle, s2pid, s1pid);   // serialize on opF

    s1.send(`COMMIT; SELECT 'S1COMMIT';`);
    await s1.waitFor((l) => l === 'S1COMMIT');
    const res = await s2.waitFor((l) => l.startsWith('S2RES|'));
    s2.send(`COMMIT; SELECT 'S2COMMIT';`);
    await s2.waitFor((l) => l === 'S2COMMIT');
    check(/REJECTED\|/.test(res) && /sem itens|nao pode ficar/i.test(res),
      `F: the second removal must be rejected (would empty opF; got ${res})`);
    check(!/deadlock|40P01/i.test(s1.stderr + s2.stderr), 'F: no deadlock');
    await s1.close();
    await s2.close();
    const remF = await scalar(handle, `SELECT count(*) FROM public.op_itens WHERE op_id=${id.opF};`);
    check(Number(remF) >= 1, `F: source opF must retain >=1 item (got ${remF})`);
    log('F', { outcome: 'serialized_one_commit', opF_items: remF, no_deadlock: true });
  }

  // ---- G: non-last unreferenced removal accepted; referenced item FK-protected -
  {
    // iG1 is unreferenced and non-last (opG also has iG2) -> delete accepted.
    const g1res = await attempt(handle, 'G-del1', `DELETE FROM public.op_itens WHERE id=${id.iG1}`);
    check(g1res === 'OK', `G: a non-last unreferenced item must be deletable (got ${g1res})`);
    const g1 = await scalar(handle, `SELECT count(*) FROM public.op_itens WHERE id=${id.iG1};`);
    check(Number(g1) === 0, `G: the unreferenced item must be gone (still present: ${g1})`);
    // iG2 is referenced by expG's item -> delete rejected by the FK RESTRICT.
    const g2res = await attempt(handle, 'G-del2', `DELETE FROM public.op_itens WHERE id=${id.iG2}`);
    check(/REJECTED\|/.test(g2res), `G: a referenced item delete must be rejected (got ${g2res})`);
    const remG = await scalar(handle, `SELECT count(*) FROM public.op_itens WHERE op_id=${id.opG};`);
    check(Number(remG) === 1, `G: opG must retain the referenced item (got ${remG})`);
    log('G', { non_last_unreferenced_delete: 'accepted', referenced_delete: 'rejected', opG_items: remG });
  }

  // ---- H: regressions --------------------------------------------------------
  {
    // H1 two creations for one Manta OP (opH) -> one commit + one rejection.
    const s1 = openSession(handle, 'H1-s1');
    s1.send('BEGIN;');
    s1.send(`SELECT 'S1PID|' || pg_backend_pid();`);
    const s1pid = Number((await s1.waitFor((l) => l.startsWith('S1PID|'))).split('|')[1]);
    s1.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${ped}', ${id.opH}, ${id.lote}, ${id.cli}); SELECT 'S1INS_DONE';`);
    await s1.waitFor((l) => l === 'S1INS_DONE');
    const s2 = openSession(handle, 'H1-s2');
    s2.send('BEGIN;');
    s2.send(`SELECT 'S2PID|' || pg_backend_pid();`);
    const s2pid = Number((await s2.waitFor((l) => l.startsWith('S2PID|'))).split('|')[1]);
    s2.send(`CREATE TEMP TABLE _h(v text);`);
    s2.send(`DO $$ BEGIN INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${ped}', ${id.opH}, ${id.lote}, ${id.cli});
        INSERT INTO _h VALUES ('UNEXPECTED_OK'); EXCEPTION WHEN OTHERS THEN INSERT INTO _h VALUES ('REJECTED|'||SQLERRM); END $$;`);
    s2.send(`SELECT 'HRES|' || v FROM _h;`);
    await waitForBlock(handle, s2pid, s1pid);
    s1.send(`COMMIT; SELECT 'S1COMMIT';`);
    await s1.waitFor((l) => l === 'S1COMMIT');
    const hres = await s2.waitFor((l) => l.startsWith('HRES|'));
    s2.send('ROLLBACK;');
    check(/REJECTED\|/.test(hres) && /(unique|duplicate|única|expedicoes_op_tecelagem_id_uk)/i.test(hres),
      `H1: second creation for the same Manta OP must be rejected (got ${hres})`);
    await s1.close();
    await s2.close();
    const ctH = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opH};`);
    check(Number(ctH) === 1, `H1: exactly one expedition for opH (got ${ctH})`);

    // H2 cross-OP injection: an op_item of a different OP (itD in opD) into expHx.
    const injRes = await attempt(handle, 'H2-inj', `INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expHx}, ${id.itD}, ${id.mm}, 10)`);
    check(/REJECTED\|/.test(injRes) && /(cross-OP|nao pertence)/i.test(injRes), `H2: cross-OP injection must be rejected (got ${injRes})`);
    const inj = await scalar(handle, `SELECT count(*) FROM public.expedicao_itens WHERE expedicao_id=${id.expHx};`);
    check(Number(inj) === 0, `H2: no cross-OP item may persist (got ${inj})`);

    // H3 different Manta OPs do not serialize.
    const t1 = openSession(handle, 'H3-t1');
    t1.send('BEGIN;');
    t1.send(`SELECT 'T1PID|' || pg_backend_pid();`);
    const t1pid = Number((await t1.waitFor((l) => l.startsWith('T1PID|'))).split('|')[1]);
    t1.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${ped}', ${id.opH3a}, ${id.lote}, ${id.cli}); SELECT 'T1INS_DONE';`);
    await t1.waitFor((l) => l === 'T1INS_DONE');
    const t2 = openSession(handle, 'H3-t2');
    t2.send('BEGIN;');
    t2.send(`SELECT 'T2PID|' || pg_backend_pid();`);
    const t2pid = Number((await t2.waitFor((l) => l.startsWith('T2PID|'))).split('|')[1]);
    t2.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${ped}', ${id.opH3b}, ${id.lote}, ${id.cli}); SELECT 'T2INS_DONE';`);
    await t2.waitFor((l) => l === 'T2INS_DONE', 10000);
    const blk = await blockingPids(handle, t2pid);
    check(!blk.split(',').includes(String(t1pid)), `H3: different Manta OPs must not serialize (blockers=${blk})`);
    t2.send(`COMMIT; SELECT 'T2COMMIT';`);
    await t2.waitFor((l) => l === 'T2COMMIT');
    t1.send(`COMMIT; SELECT 'T1COMMIT';`);
    await t1.waitFor((l) => l === 'T1COMMIT');
    await t1.close();
    await t2.close();

    // H4 Tapete Latex expedition + item still accepted.
    const latex = await scalar(handle, `
      WITH e AS (
        INSERT INTO public.expedicoes(pedido_id,op_latex_id,lote_id,cliente_id) VALUES ('${ped}', ${id.opLx}, ${id.lote}, ${id.cli}) RETURNING id
      ), i AS (
        INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados)
          SELECT e.id, ${id.iLx}, ${id.mt}, 25 FROM e RETURNING id
      )
      SELECT (SELECT count(*) FROM i)::text;`);
    check(Number(latex) === 1, `H4: a Tapete Latex expedition + item must still be accepted (got ${latex})`);
    log('H', { two_expeditions_one_op: '1_commit_1_reject', cross_op_injection: 'rejected', different_ops_serialize: false, latex_expedition: 'accepted' });
  }

  // ---- I: db/83 source-model-change-wins (BLOCKER B) --------------------------
  // Holder pattern (mirrors the proven db/82 Test C): a dedicated session
  // holds the source-OP lock so both the model-change attempt and the
  // membership insert genuinely queue behind it, instead of racing a raw
  // failing statement's transaction-lifetime lock retention.
  {
    const holder = openSession(handle, 'I-holder');
    holder.send('BEGIN;');
    holder.send(`SELECT 'HPID|' || pg_backend_pid();`);
    const hpid = Number((await holder.waitFor((l) => l.startsWith('HPID|'))).split('|')[1]);
    holder.send(`SELECT 1 FROM public.ops WHERE id=${id.opI} FOR UPDATE; SELECT 'HOLD_READY';`);
    await holder.waitFor((l) => l === 'HOLD_READY');

    const chg = openSession(handle, 'I-chg');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`CREATE TEMP TABLE _i(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.op_itens SET modelo_id=${id.mt} WHERE id=${id.iI};
        INSERT INTO _i VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _i VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _i;`);
    await waitForBlock(handle, cpid, hpid);

    const ins = openSession(handle, 'I-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expI}, ${id.iI}, ${id.mm}, 10); SELECT 'INS_DONE';`);
    // chg already queued for the same row lock (confirmed above), so per
    // Postgres's FIFO same-mode wait-queue semantics ins reports as blocked
    // by chg (its direct queue predecessor), not directly by holder.
    await waitForBlock(handle, ipid, cpid);
    log('I', { holder_pid: hpid, chg_pid: cpid, ins_pid: ipid, chg_and_ins_queued_on_holder: true });

    holder.send(`ROLLBACK; SELECT 'HDONE';`);
    await holder.waitFor((l) => l === 'HDONE');

    const [cres] = await Promise.all([
      chg.waitFor((l) => l.startsWith('CRES|'), 15000),
      ins.waitFor((l) => l === 'INS_DONE', 15000),
    ]);
    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    check(/REJECTED\|/.test(cres) && /fonte de expedicao Manta/i.test(cres),
      `I: the modelo_id change must be rejected by the db/83 BLOCKER B source-route check (got ${cres})`);
    check(!/deadlock|40P01/i.test(holder.stderr + chg.stderr + ins.stderr), 'I: no deadlock');
    await holder.close();
    await chg.close();
    await ins.close();

    const tipoAfter = await scalar(handle, `SELECT tipo_produto FROM public.modelos m JOIN public.op_itens oi ON oi.modelo_id=m.id WHERE oi.id=${id.iI};`);
    check(tipoAfter === 'manta', `I: iI must not have observed a route flip (got ${tipoAfter})`);
    const inserted = await scalar(handle, `SELECT count(*) FROM public.expedicao_itens WHERE expedicao_id=${id.expI} AND op_item_id=${id.iI};`);
    check(Number(inserted) === 1, `I: the concurrent membership insert must have completed (got ${inserted})`);
    log('I', { outcome: 'source_model_change_rejected__membership_insert_completed', no_route_flip: true });
  }

  // ---- J: db/83 membership-insert-wins (BLOCKER D) -----------------------------
  {
    const ins = openSession(handle, 'J-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expJ}, ${id.iJ}, ${id.mm}, 10); SELECT 'INS_DONE';`);
    await ins.waitFor((l) => l === 'INS_DONE');   // holds opJ lock, uncommitted

    const chg = openSession(handle, 'J-chg');
    chg.send('BEGIN;');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`CREATE TEMP TABLE _j(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.op_itens SET modelo_id=${id.mt} WHERE id=${id.iJ};
        INSERT INTO _j VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _j VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _j;`);
    await waitForBlock(handle, cpid, ipid);   // change waits on opJ, held by the insert
    log('J', { ins_pid: ipid, chg_pid: cpid, chg_blocked_by_ins: true });

    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    const res = await chg.waitFor((l) => l.startsWith('CRES|'));
    chg.send('ROLLBACK;');
    check(/REJECTED\|/.test(res) && /referenciado por expedicao_itens/i.test(res),
      `J: the modelo_id change on a now-referenced op_item must be rejected (got ${res})`);
    check(!/deadlock|40P01/i.test(ins.stderr + chg.stderr), 'J: no deadlock');
    await ins.close();
    await chg.close();

    const stillMM = await scalar(handle, `SELECT modelo_id FROM public.op_itens WHERE id=${id.iJ};`);
    const xiModelo = await scalar(handle, `SELECT modelo_id FROM public.expedicao_itens WHERE expedicao_id=${id.expJ} AND op_item_id=${id.iJ};`);
    check(Number(stillMM) === id.mm && Number(xiModelo) === id.mm,
      `J: item and op_item must remain aligned (op_item=${stillMM}, expedicao_item=${xiModelo})`);
    log('J', { outcome: 'membership_insert_wins__identity_change_rejected' });
  }

  // ---- K: db/83 OP-type-change-vs-membership (BLOCKER A) -----------------------
  // Same holder pattern as Test I: the ops-row target-row lock a type-changing
  // UPDATE needs is the same lock a membership insert needs, so both queue
  // behind an explicit holder deterministically.
  {
    const holder = openSession(handle, 'K-holder');
    holder.send('BEGIN;');
    holder.send(`SELECT 'HPID|' || pg_backend_pid();`);
    const hpid = Number((await holder.waitFor((l) => l.startsWith('HPID|'))).split('|')[1]);
    holder.send(`SELECT 1 FROM public.ops WHERE id=${id.opK} FOR UPDATE; SELECT 'HOLD_READY';`);
    await holder.waitFor((l) => l === 'HOLD_READY');

    const chg = openSession(handle, 'K-chg');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`CREATE TEMP TABLE _k(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.ops SET tipo='latex' WHERE id=${id.opK};
        INSERT INTO _k VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _k VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _k;`);
    await waitForBlock(handle, cpid, hpid);

    const ins = openSession(handle, 'K-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicao_itens(expedicao_id,op_item_id,modelo_id,metros_liberados) VALUES (${id.expK}, ${id.iK}, ${id.mm}, 10); SELECT 'INS_DONE';`);
    // chg already queued for the same row lock (confirmed above), so per
    // Postgres's FIFO same-mode wait-queue semantics ins reports as blocked
    // by chg (its direct queue predecessor), not directly by holder.
    await waitForBlock(handle, ipid, cpid);
    log('K', { holder_pid: hpid, chg_pid: cpid, ins_pid: ipid, chg_and_ins_queued_on_holder: true });

    holder.send(`ROLLBACK; SELECT 'HDONE';`);
    await holder.waitFor((l) => l === 'HDONE');

    const [cres] = await Promise.all([
      chg.waitFor((l) => l.startsWith('CRES|'), 15000),
      ins.waitFor((l) => l === 'INS_DONE', 15000),
    ]);
    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    check(/REJECTED\|/.test(cres) && /imutave.*fonte de expedicao/i.test(cres),
      `K: the ops.tipo change must be rejected by db/83 BLOCKER A (widened by db/84 BLOCKER D to also cover lote_id; got ${cres})`);
    check(!/deadlock|40P01/i.test(holder.stderr + chg.stderr + ins.stderr), 'K: no deadlock');
    await holder.close();
    await chg.close();
    await ins.close();

    const tipoAfter = await scalar(handle, `SELECT tipo FROM public.ops WHERE id=${id.opK};`);
    check(tipoAfter === 'tecelagem', `K: opK.tipo must remain tecelagem (got ${tipoAfter})`);
    const inserted = await scalar(handle, `SELECT count(*) FROM public.expedicao_itens WHERE expedicao_id=${id.expK} AND op_item_id=${id.iK};`);
    check(Number(inserted) === 1, `K: the concurrent membership insert must have completed (got ${inserted})`);
    log('K', { outcome: 'op_type_change_rejected__membership_insert_completed' });
  }

  // ---- L: db/83 two-identity-change no-deadlock (BLOCKER B lock order) --------
  {
    const s1 = openSession(handle, 'L-s1');
    s1.send('BEGIN;');
    s1.send(`SELECT 'S1PID|' || pg_backend_pid();`);
    const s1pid = Number((await s1.waitFor((l) => l.startsWith('S1PID|'))).split('|')[1]);
    s1.send(`UPDATE public.op_itens SET op_id=${id.opM2} WHERE id=${id.iM1a}; SELECT 'S1MOVE_DONE';`);
    await s1.waitFor((l) => l === 'S1MOVE_DONE');   // holds opM1 then opM2 locks, uncommitted

    const s2 = openSession(handle, 'L-s2');
    s2.send('BEGIN;');
    s2.send(`SELECT 'S2PID|' || pg_backend_pid();`);
    const s2pid = Number((await s2.waitFor((l) => l.startsWith('S2PID|'))).split('|')[1]);
    s2.send(`CREATE TEMP TABLE _l(v text);`);
    s2.send(`DO $$ BEGIN UPDATE public.op_itens SET op_id=${id.opM1} WHERE id=${id.iM2a};
        INSERT INTO _l VALUES ('MOVED'); EXCEPTION WHEN OTHERS THEN INSERT INTO _l VALUES ('REJECTED|'||SQLERRM); END $$;`);
    s2.send(`SELECT 'S2RES|' || v FROM _l;`);
    // Both sessions compute the SAME ascending lock order [opM1, opM2] (opM1 <
    // opM2), so s2 always waits on opM1 first -- never the opposite -- proving
    // the deterministic order (not accidental luck) prevents the deadlock.
    await waitForBlock(handle, s2pid, s1pid);

    s1.send(`COMMIT; SELECT 'S1COMMIT';`);
    await s1.waitFor((l) => l === 'S1COMMIT');
    const res = await s2.waitFor((l) => l.startsWith('S2RES|'));
    s2.send(`COMMIT; SELECT 'S2COMMIT';`);
    await s2.waitFor((l) => l === 'S2COMMIT');
    check(res === 'S2RES|MOVED', `L: the second (opposing) move must also commit once serialized (got ${res})`);
    check(!/deadlock|40P01/i.test(s1.stderr + s2.stderr), 'L: no deadlock');
    await s1.close();
    await s2.close();

    const m1 = await scalar(handle, `
      SELECT string_agg(DISTINCT m.tipo_produto, ',') || '|' || count(*)
        FROM public.op_itens oi JOIN public.modelos m ON m.id=oi.modelo_id
       WHERE oi.op_id=${id.opM1};`);
    const m2 = await scalar(handle, `
      SELECT string_agg(DISTINCT m.tipo_produto, ',') || '|' || count(*)
        FROM public.op_itens oi JOIN public.modelos m ON m.id=oi.modelo_id
       WHERE oi.op_id=${id.opM2};`);
    check(m1 === 'manta|2', `L: opM1 must stay homogeneous Manta with 2 items (got ${m1})`);
    check(m2 === 'manta|2', `L: opM2 must stay homogeneous Manta with 2 items (got ${m2})`);
    log('L', { outcome: 'opposing_moves_serialized_ascending__both_committed', opM1: m1, opM2: m2 });
  }

  // ---- M: db/84 lineage-insert-wins vs Lote update (BLOCKER B/E) ---------------
  {
    const ins = openSession(handle, 'M-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedM}', ${id.opM}, ${id.loteM}, ${id.cli}); SELECT 'INS_DONE';`);
    await ins.waitFor((l) => l === 'INS_DONE');   // holds loteM FOR SHARE (+ opM/pedM), uncommitted

    const chg = openSession(handle, 'M-chg');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`CREATE TEMP TABLE _m(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.lotes SET pedido_id='${uid.pedMalt}' WHERE id=${id.loteM};
        INSERT INTO _m VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _m VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _m;`);
    await waitForBlock(handle, cpid, ipid);
    log('M', { ins_pid: ipid, chg_pid: cpid, chg_blocked_by_ins: true });

    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    const res = await chg.waitFor((l) => l.startsWith('CRES|'));
    chg.send('ROLLBACK;');
    check(/REJECTED\|/.test(res), `M: the Lote pedido_id change must be rejected once the expedition insert commits (got ${res})`);
    check(!/deadlock|40P01/i.test(ins.stderr + chg.stderr), 'M: no deadlock');
    await ins.close();
    await chg.close();

    const lotePedido = await scalar(handle, `SELECT pedido_id FROM public.lotes WHERE id=${id.loteM};`);
    check(lotePedido === uid.pedM, `M: loteM.pedido_id must remain aligned (got ${lotePedido})`);
    const expCt = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opM};`);
    check(Number(expCt) === 1, `M: exactly one expedition for opM (got ${expCt})`);
    log('M', { outcome: 'expedition_insert_wins__lote_update_rejected' });
  }

  // ---- N: db/84 Lote-update-wins (BLOCKER B) -----------------------------------
  {
    const chg = openSession(handle, 'N-chg');
    chg.send('BEGIN;');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`UPDATE public.lotes SET pedido_id='${uid.pedNb}' WHERE id=${id.loteN}; SELECT 'CHG_DONE';`);
    await chg.waitFor((l) => l === 'CHG_DONE');   // holds loteN lock, uncommitted (Blocker E inert: no source yet)

    const ins = openSession(handle, 'N-ins');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`CREATE TEMP TABLE _n(v text);`);
    ins.send(`DO $$ BEGIN
        INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedNa}', ${id.opN}, ${id.loteN}, ${id.cli});
        INSERT INTO _n VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _n VALUES ('REJECTED|'||SQLERRM); END $$;`);
    ins.send(`SELECT 'IRES|' || v FROM _n;`);
    await waitForBlock(handle, ipid, cpid);
    log('N', { chg_pid: cpid, ins_pid: ipid, ins_blocked_by_chg: true });

    chg.send(`COMMIT; SELECT 'CCOMMIT';`);
    await chg.waitFor((l) => l === 'CCOMMIT');
    const res = await ins.waitFor((l) => l.startsWith('IRES|'));
    check(/REJECTED\|/.test(res), `N: the stale-payload expedition insert must be rejected against the committed Lote (got ${res})`);
    check(!/deadlock|40P01/i.test(chg.stderr + ins.stderr), 'N: no deadlock');
    await chg.close();
    await ins.close();

    const refreshed = await attempt(handle, 'N-refresh',
      `INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedNb}', ${id.opN}, ${id.loteN}, ${id.cli})`);
    check(refreshed === 'OK', `N: a correctly refreshed payload must succeed (got ${refreshed})`);
    const expCt = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opN};`);
    check(Number(expCt) === 1, `N: exactly one expedition for opN (got ${expCt})`);
    log('N', { outcome: 'lote_update_wins__stale_insert_rejected__refreshed_insert_accepted' });
  }

  // ---- O: db/84 lineage-insert-wins vs Pedido update (BLOCKER B/F) ------------
  {
    const ins = openSession(handle, 'O-ins');
    ins.send('BEGIN;');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedO}', ${id.opO}, ${id.loteO}, ${id.cli}); SELECT 'INS_DONE';`);
    await ins.waitFor((l) => l === 'INS_DONE');

    const chg = openSession(handle, 'O-chg');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`CREATE TEMP TABLE _o(v text);`);
    chg.send(`DO $$ BEGIN
        UPDATE public.pedidos SET cliente_id=${id.cli2} WHERE id='${uid.pedO}';
        INSERT INTO _o VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _o VALUES ('REJECTED|'||SQLERRM); END $$;`);
    chg.send(`SELECT 'CRES|' || v FROM _o;`);
    await waitForBlock(handle, cpid, ipid);
    log('O', { ins_pid: ipid, chg_pid: cpid, chg_blocked_by_ins: true });

    ins.send(`COMMIT; SELECT 'ICOMMIT';`);
    await ins.waitFor((l) => l === 'ICOMMIT');
    const res = await chg.waitFor((l) => l.startsWith('CRES|'));
    chg.send('ROLLBACK;');
    check(/REJECTED\|/.test(res), `O: the Pedido cliente_id change must be rejected once the expedition insert commits (got ${res})`);
    check(!/deadlock|40P01/i.test(ins.stderr + chg.stderr), 'O: no deadlock');
    await ins.close();
    await chg.close();

    const pedCliente = await scalar(handle, `SELECT cliente_id FROM public.pedidos WHERE id='${uid.pedO}';`);
    check(Number(pedCliente) === id.cli, `O: pedO.cliente_id must remain aligned (got ${pedCliente})`);
    log('O', { outcome: 'expedition_insert_wins__pedido_update_rejected' });
  }

  // ---- P: db/84 Pedido-update-wins (BLOCKER B) ---------------------------------
  {
    const chg = openSession(handle, 'P-chg');
    chg.send('BEGIN;');
    chg.send(`SELECT 'CPID|' || pg_backend_pid();`);
    const cpid = Number((await chg.waitFor((l) => l.startsWith('CPID|'))).split('|')[1]);
    chg.send(`UPDATE public.pedidos SET cliente_id=${id.cli2} WHERE id='${uid.pedP}'; SELECT 'CHG_DONE';`);
    await chg.waitFor((l) => l === 'CHG_DONE');   // Blocker F inert: no source yet

    const ins = openSession(handle, 'P-ins');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`CREATE TEMP TABLE _p(v text);`);
    ins.send(`DO $$ BEGIN
        INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedP}', ${id.opP}, ${id.loteP}, ${id.cli});
        INSERT INTO _p VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _p VALUES ('REJECTED|'||SQLERRM); END $$;`);
    ins.send(`SELECT 'IRES|' || v FROM _p;`);
    await waitForBlock(handle, ipid, cpid);
    log('P', { chg_pid: cpid, ins_pid: ipid, ins_blocked_by_chg: true });

    chg.send(`COMMIT; SELECT 'CCOMMIT';`);
    await chg.waitFor((l) => l === 'CCOMMIT');
    const res = await ins.waitFor((l) => l.startsWith('IRES|'));
    check(/REJECTED\|/.test(res), `P: the expedition insert must be rejected once the Pedido client is committed (got ${res})`);
    check(!/deadlock|40P01/i.test(chg.stderr + ins.stderr), 'P: no deadlock');
    await chg.close();
    await ins.close();

    const expCt = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opP};`);
    check(Number(expCt) === 0, `P: no expedition may have been created for opP (got ${expCt})`);
    log('P', { outcome: 'pedido_update_wins__stale_insert_rejected' });
  }

  // ---- Q: db/84 OP-lote-change-vs-insert (BLOCKER B/D) -------------------------
  {
    const mover = openSession(handle, 'Q-mover');
    mover.send('BEGIN;');
    mover.send(`SELECT 'MPID|' || pg_backend_pid();`);
    const mpid = Number((await mover.waitFor((l) => l.startsWith('MPID|'))).split('|')[1]);
    mover.send(`UPDATE public.ops SET lote_id=${id.loteQ2} WHERE id=${id.opQ}; SELECT 'MOVE_DONE';`);
    await mover.waitFor((l) => l === 'MOVE_DONE');   // Blocker D inert: no source yet

    const ins = openSession(handle, 'Q-ins');
    ins.send(`SELECT 'IPID|' || pg_backend_pid();`);
    const ipid = Number((await ins.waitFor((l) => l.startsWith('IPID|'))).split('|')[1]);
    ins.send(`CREATE TEMP TABLE _q(v text);`);
    ins.send(`DO $$ BEGIN
        INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedQ}', ${id.opQ}, ${id.loteQ}, ${id.cli});
        INSERT INTO _q VALUES ('UNEXPECTED_OK');
      EXCEPTION WHEN OTHERS THEN INSERT INTO _q VALUES ('REJECTED|'||SQLERRM); END $$;`);
    ins.send(`SELECT 'IRES|' || v FROM _q;`);
    await waitForBlock(handle, ipid, mpid);
    log('Q', { mover_pid: mpid, ins_pid: ipid, ins_blocked_by_mover: true });

    mover.send(`COMMIT; SELECT 'MCOMMIT';`);
    await mover.waitFor((l) => l === 'MCOMMIT');
    const res = await ins.waitFor((l) => l.startsWith('IRES|'));
    check(/REJECTED\|/.test(res), `Q: the stale-lote insert must be rejected against the committed ops.lote_id (got ${res})`);
    check(!/deadlock|40P01/i.test(mover.stderr + ins.stderr), 'Q: no deadlock');
    await mover.close();
    await ins.close();

    const opLote = await scalar(handle, `SELECT lote_id FROM public.ops WHERE id=${id.opQ};`);
    check(Number(opLote) === id.loteQ2, `Q: opQ.lote_id must remain the committed value (got ${opLote})`);
    const expCt = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opQ};`);
    check(Number(expCt) === 0, `Q: no split-lineage expedition may exist for opQ (got ${expCt})`);
    log('Q', { outcome: 'op_lote_change_wins__stale_insert_rejected__no_split_lineage' });
  }

  // ---- R: db/84 independent sources do not serialize ---------------------------
  {
    const t1 = openSession(handle, 'R-t1');
    t1.send('BEGIN;');
    t1.send(`SELECT 'T1PID|' || pg_backend_pid();`);
    const t1pid = Number((await t1.waitFor((l) => l.startsWith('T1PID|'))).split('|')[1]);
    t1.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedR1}', ${id.opR1}, ${id.loteR1}, ${id.cli}); SELECT 'T1INS_DONE';`);
    await t1.waitFor((l) => l === 'T1INS_DONE');

    const t2 = openSession(handle, 'R-t2');
    t2.send('BEGIN;');
    t2.send(`SELECT 'T2PID|' || pg_backend_pid();`);
    const t2pid = Number((await t2.waitFor((l) => l.startsWith('T2PID|'))).split('|')[1]);
    t2.send(`INSERT INTO public.expedicoes(pedido_id,op_tecelagem_id,lote_id,cliente_id) VALUES ('${uid.pedR2}', ${id.opR2}, ${id.loteR2}, ${id.cli}); SELECT 'T2INS_DONE';`);
    await t2.waitFor((l) => l === 'T2INS_DONE', 10000);
    const blk = await blockingPids(handle, t2pid);
    check(!blk.split(',').includes(String(t1pid)), `R: independent sources must not serialize (blockers=${blk})`);
    t2.send(`COMMIT; SELECT 'T2COMMIT';`);
    await t2.waitFor((l) => l === 'T2COMMIT');
    t1.send(`COMMIT; SELECT 'T1COMMIT';`);
    await t1.waitFor((l) => l === 'T1COMMIT');
    await t1.close();
    await t2.close();

    const ct1 = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opR1};`);
    const ct2 = await scalar(handle, `SELECT count(*) FROM public.expedicoes WHERE op_tecelagem_id=${id.opR2};`);
    check(Number(ct1) === 1 && Number(ct2) === 1, `R: both independent expeditions must commit (opR1=${ct1}, opR2=${ct2})`);
    log('R', { outcome: 'independent_sources_no_serialization', no_deadlock: true });
  }
}

// ===========================================================================
// PART Z — mandatory full cluster destruction.
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
  log('PART_Z', { pid_absent: true, port_closed: true, dir_absent: true, postmasterPid, port });
}

// ===========================================================================
// Runner.
// ===========================================================================
async function main() {
  SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'b2-expedition-scratch-'));
  let handle = null;
  try {
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pgVersion: handle.pgVersion, pid: handle.postmasterPid });
    await partA(handle);
    await partB(handle);
    await partC(handle);
    await partD(handle);
    await partE(handle);
    await partZ(handle);
    handle = null;   // destroyed by partZ
    log('RESULT', { failures: FAILURES, status: FAILURES === 0 ? 'ALL_PROOFS_PASSED' : 'FAILED' });
  } finally {
    if (handle) { try { await handle.stop(); } catch { /* best effort */ } }
    if (SCRATCH_DIR) { try { await rm(SCRATCH_DIR, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  if (FAILURES > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
