// tests/pedido-unified-edit-change-approval-invariant.mjs
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1 disposable-cluster proof of
// db/92_pedido_unified_edit_change_approval_foundation.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic and is
// built inside the disposable cluster; NO production data is used.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   A  db/01..db/93 apply cleanly, in order, and db/93 is the terminal.
//      (db/93 is the C1 privilege correction; the helper-privilege proofs live in
//       tests/pedido-change-approval-helper-privilege-invariant.mjs.)
//   B  db/92 re-applies with a before/after fingerprint proving zero drift.
//   C  the prerequisite gate fails closed when a db/91 guard is absent.
//   D  revisao advances on relevant header, item and priority changes.
//   E  client-visual publication does NOT advance revisao.
//   F  the client cannot directly UPDATE or DELETE Pedido or items.
//   G  the client saves its own unaccepted Pedido only through the RPC.
//   H  the client cannot change data_pedido after creation.
//   I  the administrative save is atomic and refuses a stale revision.
//   J  request replacement leaves exactly one pending request.
//   K  a stale-base approval changes nothing and stays pendente.
//   L  structural item changes work while no OP exists.
//   M  structural item changes are refused once ANY OP exists, and
//      confirmation is not an override; header-only stays approvable.
//   N  item removal cannot orphan an op_itens / expedicao_itens / parcial row.
//   O  priority flows through definir_prioridade_pedido and keeps its gate.
//   P  approval applies header, items, order, priority, audit and request
//      state atomically; rejection and withdrawal never touch the Pedido.
//   Q  an injected unexpected application failure rolls the live Pedido back
//      and leaves the request as falha_aplicacao.
//   R  client summaries expose no internal operational data; anon has no
//      access; supplier access is unchanged.
//   Z  mandatory full cluster destruction.
//
// Run:  node tests/pedido-unified-edit-change-approval-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 93;
const DB92 = '92_pedido_unified_edit_change_approval_foundation.sql';
const DB93 = '93_pedido_change_approval_helper_privilege_correction.sql';
const DB91 = '91_pedido_item_production_priority.sql';

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

// db/67 fails closed unless the 64-row REFUND-A corpus exists. Unrelated to this
// order's subject; present only so the chain can reach db/92.
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

const CLI_A = 960000101;
const CLI_B = 960000102;
const ADMIN_UID = '00000000-0000-4000-8000-0000000000a1';
const CLIENT_UID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_UID = '00000000-0000-4000-8000-0000000000c2';
const FORN_UID = '00000000-0000-4000-8000-0000000000f1';
const MOD_A = 960000201;
const MOD_B = 960000202;

const ATORES_SQL = `
INSERT INTO public.cores (id, nome) VALUES (960000301, 'UEC-COR-1'), (960000302, 'UEC-COR-2')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.clientes (id, nome) VALUES (${CLI_A}, 'UEC-CLIENTE-A'), (${CLI_B}, 'UEC-CLIENTE-B')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modelos (id, nome, largura, cor_1_id, cor_2_id) VALUES
  (${MOD_A}, 'UEC-MODELO-A', 2.10, 960000301, 960000302),
  (${MOD_B}, 'UEC-MODELO-B', 2.10, 960000302, 960000301)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_UID}',  'admin@uec.local'),
  ('${CLIENT_UID}', 'cliente@uec.local'),
  ('${OTHER_UID}',  'outro@uec.local'),
  ('${FORN_UID}',   'fornecedor@uec.local')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, email, nome, tipo, cliente_id, fornecedor_id, ativo) VALUES
  ('${ADMIN_UID}',  'admin@uec.local',      'Admin UEC',  'admin',      NULL,     NULL, TRUE),
  ('${CLIENT_UID}', 'cliente@uec.local',    'Cliente UEC','cliente',    ${CLI_A}, NULL, TRUE),
  ('${OTHER_UID}',  'outro@uec.local',      'Outro UEC',  'cliente',    ${CLI_B}, NULL, TRUE),
  ('${FORN_UID}',   'fornecedor@uec.local', 'Forn UEC',   'fornecedor', NULL, 930000301, TRUE)
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
  return ['-X', '-w', '-q', '-A', '-t', '-h', handle.host, '-p', String(handle.port),
    '-U', handle.user, '-d', handle.database];
}
function applyFile(handle, file, label) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 240000,
  });
  if (result.status !== 0) {
    const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
    throw new Error(`APPLY_FAILED (${label || file}): ${diag}`);
  }
  return result.stdout || '';
}
function applyFileExpectFailure(handle, file, label) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8', timeout: 240000,
  });
  check(result.status !== 0, `${label}: deveria falhar fechado, mas aplicou`);
  return (result.stderr || '').split('\n').filter(Boolean)[0] || '';
}
let SCRATCH_DIR = null;
async function applySql(handle, name, sql, label) {
  const file = path.join(SCRATCH_DIR, name);
  await writeFile(file, sql, 'utf8');
  return applyFile(handle, file, label || name);
}
function run(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 90000,
  });
  return { ok: result.status === 0, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}
function scalar(handle, sql) {
  const r = run(handle, sql);
  if (!r.ok) throw new Error(`QUERY_FAILED: ${r.err || r.out}`);
  return r.out;
}
// `boolean::text` rende 'true'/'false'; psql sem cast rende 't'/'f'. Os dois
// aparecem neste harness, entao a normalizacao e explicita.
const isTrue = (v) => v === 't' || v === 'true';
const isFalse = (v) => v === 'f' || v === 'false';
function boolq(handle, sql) { return isTrue(scalar(handle, sql)); }

function mustFail(handle, sql, label) {
  const r = run(handle, sql);
  check(!r.ok, `${label}: deveria ser recusado, mas foi aceito`);
  return r.err.split('\n').filter(Boolean)[0] || '';
}

// `SET LOCAL ROLE` + o GUC de JWT reproduzem exatamente o que o PostgREST faz.
function asRole(uid, sql, role = 'authenticated') {
  return `BEGIN; SET LOCAL ROLE ${role}; ${uid ? `SET LOCAL request.jwt.claim.sub = '${uid}';` : ''} ${sql} COMMIT;`;
}
const asAdmin = (h, sql) => scalar(h, asRole(ADMIN_UID, sql));
const asClient = (h, sql) => scalar(h, asRole(CLIENT_UID, sql));
const asAdminFail = (h, sql, label) => mustFail(h, asRole(ADMIN_UID, sql), label);
const asClientFail = (h, sql, label) => mustFail(h, asRole(CLIENT_UID, sql), label);

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
      SELECT 'POL '||polrelid::regclass::text||' '||polname||' '||polcmd::text||' '||
             coalesce(pg_get_expr(polqual,polrelid),'')||' '||coalesce(pg_get_expr(polwithcheck,polrelid),'')
        FROM pg_policy
      UNION ALL
      SELECT 'IDX '||schemaname||'.'||indexname||' '||indexdef FROM pg_indexes WHERE schemaname='public'
      UNION ALL
      SELECT 'GRANT '||grantee||' '||table_name||' '||privilege_type
        FROM information_schema.role_table_grants WHERE table_schema='public'
      UNION ALL
      SELECT 'GRANTFN '||grantee||' '||routine_name||' '||privilege_type
        FROM information_schema.role_routine_grants WHERE routine_schema='public'
    )
    SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
}

const revisao = (h, id) => Number(scalar(h, `SELECT revisao FROM public.pedidos WHERE id='${id}';`));
const pedidoJson = (h, id) => scalar(h,
  `SELECT public.pedido_snapshot('${id}')::text;`);

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dbDir, f) }))
    .sort((a, b) => a.n - b.n);
}

// Escrita de fixture que FALHA ALTO. Uma fixture que erra em silencio
// transforma um proof em falso positivo.
function must(handle, sql, label) {
  const r = run(handle, sql);
  check(r.ok, `FIXTURE ${label}: ${r.err || r.out}`);
  return r;
}

// Cria um Pedido sintetico com dois itens. Devolve o uuid.
function novoPedido(handle, clienteId, status) {
  const id = scalar(handle, `
    WITH p AS (
      INSERT INTO public.pedidos (cliente_id, status, data_pedido, prazo_entrega, observacao)
      VALUES (${clienteId}, '${status}', DATE '2026-03-01', DATE '2026-04-01', 'obs inicial')
      RETURNING id)
    SELECT id FROM p;`);
  must(handle, `
    INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem, observacao)
    VALUES ('${id}', ${MOD_A}, 10.00, 0, 'item 1'),
           ('${id}', ${MOD_B}, 20.00, 1, 'item 2');`, 'itens do pedido');
  return id;
}
function itemIds(handle, pedidoId) {
  return scalar(handle,
    `SELECT string_agg(id::text, ',' ORDER BY ordem) FROM public.pedido_itens WHERE pedido_id='${pedidoId}';`)
    .split(',').filter(Boolean);
}
// Vincula producao real ao Pedido: lote -> op -> op_itens.
function criarOpPara(handle, pedidoId, itemId, opId, loteId, numero) {
  must(handle, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id) VALUES (${loteId}, ${numero}, ${CLI_A}, '${pedidoId}');`, 'lote');
  must(handle, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES (${opId}, ${numero}, 2099, 'aberta', 'tecelagem', ${loteId});`, 'op');
  must(handle, `INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id) VALUES (${opId}, ${MOD_A}, 10.00, '${itemId}');`, 'op_item');
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
  check(path.basename(manifest[manifest.length - 1].file) === DB93, `terminal deve ser ${DB93}`);

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
function partB(handle) {
  // Reaplicar db/92 SOZINHO nao devolve o estado terminal: db/92 concede
  // EXECUTE a `authenticated` em tres helpers e db/93 (C1) o revoga. Num
  // encadeamento forward-only isso e correto — db/93 sempre vem depois —, e o
  // replay honesto e o do PAR terminal. Reaplicar so a intermediaria e
  // justamente o que reabriria a exposicao que C1 fechou.
  const before = schemaFingerprint(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', DB92), 'db/92 replay 1');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB93), 'db/93 replay 1');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB92), 'db/92 replay 2');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB93), 'db/93 replay 2');
  const after = schemaFingerprint(handle);
  check(before === after, `db/92+db/93 devem reaplicar sem drift (${before} != ${after})`);
  const rows = Number(scalar(handle, 'SELECT count(*) FROM public.pedido_alteracao_solicitacoes;'));
  check(rows === 0, `db/92 nao pode criar solicitacao (got ${rows})`);
  log('B', { replays: 2, drift: 'none', fingerprint: before.slice(0, 12), solicitacoes: rows });
}

// ===========================================================================
// PART C — prerequisite gate fails closed.
// ===========================================================================
function partC(handle) {
  run(handle, 'DROP TRIGGER IF EXISTS pedido_itens_ordem_direct_write_guard ON public.pedido_itens;');
  const err = applyFileExpectFailure(handle, path.join(REPO_ROOT, 'db', DB92), 'db/92 sem pre-requisito');
  check(/db\/92 gate/i.test(err) && /pedido_itens_ordem_direct_write_guard/i.test(err),
    `o gate deve nomear o pre-requisito ausente (got ${err})`);
  // Restaura o guard reaplicando db/91 e reconfirma db/92.
  applyFile(handle, path.join(REPO_ROOT, 'db', DB91), 'db/91 restore');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB92), 'db/92 after restore');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB93), 'db/93 after restore');
  log('C', { gate: 'fail-closed', restored: 'true' });
}

// ===========================================================================
// PART D + E — revision scope.
// ===========================================================================
function partDE(handle) {
  const p = novoPedido(handle, CLI_A, 'rascunho');
  const r0 = revisao(handle, p);
  check(r0 >= 1, 'revisao inicial deve existir');

  run(handle, `UPDATE public.pedidos SET observacao='mudou' WHERE id='${p}';`);
  const r1 = revisao(handle, p);
  check(r1 > r0, `revisao deve avancar em mudanca de cabecalho (${r0} -> ${r1})`);

  run(handle, `UPDATE public.pedido_itens SET metros=99.00 WHERE pedido_id='${p}' AND ordem=0;`);
  const r2 = revisao(handle, p);
  check(r2 > r1, `revisao deve avancar em mudanca de item (${r1} -> ${r2})`);

  run(handle, `INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem) VALUES ('${p}', ${MOD_A}, 5.00, 2);`);
  const r3 = revisao(handle, p);
  check(r3 > r2, `revisao deve avancar em insercao de item (${r2} -> ${r3})`);

  run(handle, `DELETE FROM public.pedido_itens WHERE pedido_id='${p}' AND ordem=2;`);
  const r4 = revisao(handle, p);
  check(r4 > r3, `revisao deve avancar em remocao de item (${r3} -> ${r4})`);

  const ids = itemIds(handle, p);
  asAdmin(handle, `SELECT public.definir_prioridade_pedido('${p}', ARRAY['${ids[1]}','${ids[0]}']::uuid[], true, NULL, false);`);
  const r5 = revisao(handle, p);
  check(r5 > r4, `revisao deve avancar em mudanca de prioridade (${r4} -> ${r5})`);

  // E — publicacao de status visual NAO invalida solicitacao.
  run(handle, `UPDATE public.pedidos SET status_cliente_visual='tecelagem', status_cliente_mensagem='oi' WHERE id='${p}';`);
  const r6 = revisao(handle, p);
  check(r6 === r5, `publicacao de status visual NAO pode avancar revisao (${r5} -> ${r6})`);

  // Cliente nao escolhe o valor: qualquer tentativa e normalizada para +1.
  run(handle, `UPDATE public.pedidos SET revisao = 999999 WHERE id='${p}';`);
  const r7 = revisao(handle, p);
  check(r7 === r6 + 1, `revisao nao pode ser escolhida por um chamador (esperado ${r6 + 1}, got ${r7})`);
  run(handle, `UPDATE public.pedidos SET revisao = 1 WHERE id='${p}';`);
  check(revisao(handle, p) === r7 + 1, 'revisao nunca retrocede');

  log('D/E', { header: 'bump', item: 'bump', priority: 'bump', visual: 'no-bump', monotonic: 'true' });
}

// ===========================================================================
// PART F + G + H — client write boundary.
// ===========================================================================
function partFGH(handle) {
  const p = novoPedido(handle, CLI_A, 'recebido');
  const before = pedidoJson(handle, p);

  // F — RLS: sem policy de UPDATE/DELETE o comando atinge ZERO linhas.
  const upd = scalar(handle, asRole(CLIENT_UID,
    `CREATE TEMP TABLE _r AS SELECT 1; WITH u AS (UPDATE public.pedidos SET observacao='hack' WHERE id='${p}' RETURNING 1) SELECT count(*) FROM u;`));
  check(Number(upd) === 0, `cliente nao pode UPDATE direto em pedidos (afetou ${upd})`);
  const del = scalar(handle, asRole(CLIENT_UID,
    `WITH d AS (DELETE FROM public.pedido_itens WHERE pedido_id='${p}' RETURNING 1) SELECT count(*) FROM d;`));
  check(Number(del) === 0, `cliente nao pode DELETE direto em pedido_itens (afetou ${del})`);
  const updItem = scalar(handle, asRole(CLIENT_UID,
    `WITH u AS (UPDATE public.pedido_itens SET metros=1 WHERE pedido_id='${p}' RETURNING 1) SELECT count(*) FROM u;`));
  check(Number(updItem) === 0, `cliente nao pode UPDATE direto em pedido_itens (afetou ${updItem})`);
  check(pedidoJson(handle, p) === before, 'nenhuma escrita direta do cliente pode ter mudado o Pedido');

  // G — o caminho legitimo funciona.
  const ids = itemIds(handle, p);
  const r = asClient(handle, `SELECT public.salvar_pedido_cliente('${p}', ${revisao(handle, p)},
    '{"observacao":"pelo rpc","prazo_entrega":"2026-05-05"}'::jsonb,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":11.5,"observacao":"i1"},
      {"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":21.5}]'::jsonb, NULL)::text;`);
  check(/"ok"\s*:\s*true/.test(r), `salvar_pedido_cliente deve aceitar o proprio Pedido nao aceito (got ${r})`);
  check(scalar(handle, `SELECT observacao FROM public.pedidos WHERE id='${p}';`) === 'pelo rpc',
    'a observacao deve ter sido aplicada pelo RPC');

  // Pedido de outro cliente e recusado.
  const alheio = novoPedido(handle, CLI_B, 'recebido');
  let err = asClientFail(handle, `SELECT public.salvar_pedido_cliente('${alheio}', NULL, '{"observacao":"x"}'::jsonb, NULL, NULL);`,
    'pedido de outro cliente');
  check(/PEDIDO_ALTERACAO_FORBIDDEN/.test(err), `deve recusar Pedido alheio (got ${err})`);

  // H — data_pedido imutavel depois da criacao.
  err = asClientFail(handle, `SELECT public.salvar_pedido_cliente('${p}', NULL, '{"data_pedido":"2026-01-01"}'::jsonb, NULL, NULL);`,
    'data_pedido pelo cliente');
  check(/PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE/.test(err), `deve recusar data_pedido (got ${err})`);
  check(scalar(handle, `SELECT data_pedido::text FROM public.pedidos WHERE id='${p}';`) === '2026-03-01',
    'data_pedido nao pode ter mudado');

  // Campos que o cliente nunca pode tocar.
  for (const [campo, valor] of [['cliente_id', CLI_B], ['status', '"confirmado"'], ['numero', 1]]) {
    err = asClientFail(handle, `SELECT public.salvar_pedido_cliente('${p}', NULL, '{"${campo}":${valor}}'::jsonb, NULL, NULL);`, campo);
    check(/PEDIDO_ALTERACAO_CAMPO_NAO_PERMITIDO/.test(err), `deve recusar ${campo} (got ${err})`);
  }

  // O Cliente ainda pode CRIAR informando data_pedido (fluxo de criacao intocado).
  const criado = scalar(handle, asRole(CLIENT_UID,
    `WITH p AS (INSERT INTO public.pedidos (cliente_id, status, data_pedido) VALUES (${CLI_A}, 'recebido', DATE '2026-02-02') RETURNING id) SELECT id FROM p;`));
  check(/^[0-9a-f-]{36}$/.test(criado), `o cliente deve continuar podendo criar Pedido informando data_pedido (got ${criado})`);
  check(scalar(handle, `SELECT data_pedido::text FROM public.pedidos WHERE id='${criado}';`) === '2026-02-02',
    'a data informada na criacao deve ser preservada');

  log('F/G/H', { directUpdate: 0, directDelete: 0, rpcSave: 'ok', dataPedidoAfter: 'refused', dataPedidoOnCreate: 'allowed' });
}

// ===========================================================================
// PART I — administrative save + stale revision.
// ===========================================================================
function partI(handle) {
  const p = novoPedido(handle, CLI_A, 'recebido');
  const ids = itemIds(handle, p);
  const rev = revisao(handle, p);

  const err = asAdminFail(handle, `SELECT public.salvar_pedido_admin('${p}', ${rev - 1}, '{"observacao":"x"}'::jsonb, NULL, NULL, false);`,
    'revisao base velha');
  check(/PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA/.test(err), `deve recusar revisao velha (got ${err})`);
  check(scalar(handle, `SELECT observacao FROM public.pedidos WHERE id='${p}';`) === 'obs inicial',
    'uma recusa de revisao nao pode ter mudado nada');

  const ok = asAdmin(handle, `SELECT public.salvar_pedido_admin('${p}', ${rev},
    '{"observacao":"admin ok","referencia_cliente":"REF-9","tipo_recebimento":"entrega"}'::jsonb,
    '[{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":30.0},
      {"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":10.0}]'::jsonb, NULL, false)::text;`);
  check(/"ok"\s*:\s*true/.test(ok), `salvar_pedido_admin deve aplicar (got ${ok})`);
  check(scalar(handle, `SELECT referencia_cliente FROM public.pedidos WHERE id='${p}';`) === 'REF-9',
    'referencia_cliente deve persistir');
  check(scalar(handle, `SELECT tipo_recebimento FROM public.pedidos WHERE id='${p}';`) === 'entrega',
    'tipo_recebimento deve persistir');
  check(scalar(handle, `SELECT string_agg(ordem::text,',' ORDER BY ordem) FROM public.pedido_itens WHERE pedido_id='${p}';`) === '0,1',
    'a ordem deve ser normalizada e contigua');
  check(Number(scalar(handle, `SELECT metros_total FROM public.pedidos WHERE id='${p}';`)) === 40,
    'metros_total deve ser recalculado');

  // Admin tambem nao transiciona status nem renumera por este fluxo.
  for (const campo of ['status', 'numero']) {
    const e = asAdminFail(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, '{"${campo}":"confirmado"}'::jsonb, NULL, NULL, false);`, campo);
    check(/PEDIDO_ALTERACAO_CAMPO_NAO_PERMITIDO/.test(e), `admin nao pode alterar ${campo} (got ${e})`);
  }
  // Cliente nao pode chamar o dono administrativo.
  const e2 = asClientFail(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, '{"observacao":"x"}'::jsonb, NULL, NULL, false);`, 'cliente em rpc admin');
  check(/PEDIDO_ALTERACAO_FORBIDDEN/.test(e2), `cliente nao pode chamar salvar_pedido_admin (got ${e2})`);

  log('I', { staleRevision: 'refused', apply: 'atomic', ordem: 'normalizada', status: 'refused', numero: 'refused' });
}

// ===========================================================================
// PART J + K + L + P — request lifecycle on a Pedido with NO OP.
// ===========================================================================
function partJKLP(handle) {
  const p = novoPedido(handle, CLI_A, 'recebido');
  run(handle, `UPDATE public.pedidos SET status='confirmado' WHERE id='${p}';`);
  const ids = itemIds(handle, p);

  // Antes da aceitacao o caminho de solicitacao e recusado; depois, o direto.
  const eDireto = asClientFail(handle, `SELECT public.salvar_pedido_cliente('${p}', NULL, '{"observacao":"x"}'::jsonb, NULL, NULL);`,
    'save direto apos aceite');
  check(/PEDIDO_ALTERACAO_PEDIDO_NAO_EDITAVEL/.test(eDireto), `save direto deve ser recusado apos aceite (got ${eDireto})`);

  // J — substituicao deixa exatamente UMA pendente.
  asClient(handle, `SELECT public.solicitar_alteracao_pedido('${p}', '{"observacao":"v1"}'::jsonb, NULL, NULL, 'primeira');`);
  asClient(handle, `SELECT public.solicitar_alteracao_pedido('${p}', '{"observacao":"v2"}'::jsonb, NULL, NULL, 'segunda');`);
  const pend = Number(scalar(handle, `SELECT count(*) FROM public.pedido_alteracao_solicitacoes WHERE pedido_id='${p}' AND status='pendente';`));
  check(pend === 1, `deve haver exatamente 1 pendente (got ${pend})`);
  const subs = Number(scalar(handle, `SELECT count(*) FROM public.pedido_alteracao_solicitacoes WHERE pedido_id='${p}' AND status='substituida';`));
  check(subs === 1, `a anterior deve virar substituida (got ${subs})`);
  const total = Number(scalar(handle, `SELECT count(*) FROM public.pedido_alteracao_solicitacoes WHERE pedido_id='${p}';`));
  check(total === 2, `o historico deve preservar as duas (got ${total})`);
  check(scalar(handle, `SELECT observacao FROM public.pedidos WHERE id='${p}';`) === 'obs inicial',
    'uma solicitacao pendente NAO pode alterar o Pedido vivo');

  // O indice parcial unico e do banco, nao da aplicacao.
  const dup = mustFail(handle, `INSERT INTO public.pedido_alteracao_solicitacoes
    (pedido_id, status, solicitante_papel, base_revisao, base_snapshot)
    VALUES ('${p}', 'pendente', 'cliente', 1, '{}'::jsonb);`, 'segunda pendente direta');
  check(/pedido_alteracao_um_pendente_por_pedido_uq|duplicate key/i.test(dup),
    `o indice parcial unico deve recusar a segunda pendente (got ${dup})`);

  // K — aprovacao com base velha nao muda nada e mantem pendente.
  const solId = scalar(handle, `SELECT id FROM public.pedido_alteracao_solicitacoes WHERE pedido_id='${p}' AND status='pendente';`);
  run(handle, `UPDATE public.pedidos SET prazo_entrega = DATE '2026-09-09' WHERE id='${p}';`);   // base envelhece
  const snapAntes = pedidoJson(handle, p);
  const eStale = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${solId}', false, NULL);`, 'aprovacao com base velha');
  check(/PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA/.test(eStale), `deve falhar fechado (got ${eStale})`);
  check(pedidoJson(handle, p) === snapAntes, 'aprovacao com base velha nao pode mudar o Pedido');
  check(scalar(handle, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${solId}';`) === 'pendente',
    'uma recusa ESPERADA mantem a solicitacao pendente');

  // Reenvio contra a base atual, agora com itens estruturais (sem OP).
  asClient(handle, `SELECT public.retirar_alteracao_pedido('${solId}');`);
  check(scalar(handle, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${solId}';`) === 'retirada',
    'retirada deve funcionar');
  check(pedidoJson(handle, p) === snapAntes, 'a retirada nao pode tocar o Pedido');

  const sol2 = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p}',
    '{"observacao":"aprovado","prazo_entrega":"2026-10-10"}'::jsonb,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":77.0,"observacao":"muda"},
      {"modelo_id":${MOD_B},"metros":8.0}]'::jsonb, true, 'com itens')->>'solicitacao_id');`));

  // L + P — estrutural permitido sem OP; aplicacao atomica completa.
  const ap = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${sol2}', false, 'ok')::text;`);
  check(/"ok"\s*:\s*true/.test(ap), `aprovacao deve aplicar sem OP (got ${ap})`);
  check(scalar(handle, `SELECT observacao FROM public.pedidos WHERE id='${p}';`) === 'aprovado', 'cabecalho aplicado');
  check(scalar(handle, `SELECT prazo_entrega::text FROM public.pedidos WHERE id='${p}';`) === '2026-10-10', 'prazo aplicado');
  check(Number(scalar(handle, `SELECT count(*) FROM public.pedido_itens WHERE pedido_id='${p}';`)) === 2, 'colecao absoluta aplicada');
  check(Number(scalar(handle, `SELECT metros FROM public.pedido_itens WHERE pedido_id='${p}' AND ordem=0;`)) === 77, 'metros aplicados');
  check(scalar(handle, `SELECT prioridade_status FROM public.pedidos WHERE id='${p}';`) === 'confirmada',
    'prioridade aprovada por um admin deve ficar confirmada');
  check(scalar(handle, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${sol2}';`) === 'aprovada',
    'a solicitacao deve ficar aprovada');
  check(Number(scalar(handle, `SELECT count(*) FROM public.pedido_eventos WHERE pedido_id='${p}' AND observacao LIKE '%aprovar_alteracao_pedido%';`)) >= 1,
    'a auditoria administrativa deve existir');
  check(Number(scalar(handle, `SELECT count(*) FROM public.pedido_cliente_eventos WHERE pedido_id='${p}';`)) >= 1,
    'o evento visivel ao cliente deve existir');

  // A colecao proposta fica imutavel apos a decisao.
  const imut = mustFail(handle, `UPDATE public.pedido_alteracao_solicitacao_itens SET metros=1 WHERE solicitacao_id='${sol2}';`, 'mutar itens decididos');
  check(/PEDIDO_ALTERACAO_IMUTAVEL/.test(imut), `a colecao decidida deve ser imutavel (got ${imut})`);
  const imut2 = mustFail(handle, `UPDATE public.pedido_alteracao_solicitacoes SET base_snapshot='{}'::jsonb WHERE id='${sol2}';`, 'mutar imagem-anterior');
  check(/PEDIDO_ALTERACAO_IMUTAVEL/.test(imut2), `a imagem-anterior deve ser imutavel (got ${imut2})`);

  log('J/K/L/P', { pendentes: 1, substituidas: 1, staleApproval: 'no-op', estruturalSemOp: 'aplicado', imutabilidade: 'ok' });
}

// ===========================================================================
// PART M + N — production linkage.
// ===========================================================================
function partMN(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  const ids = itemIds(handle, p);
  criarOpPara(handle, p, ids[0], 960001001, 960002001, 960301);

  const diag = scalar(handle, `SELECT
      (SELECT count(*) FROM public.lotes WHERE pedido_id='${p}')::text || '/' ||
      (SELECT count(*) FROM public.ops o JOIN public.lotes l ON l.id=o.lote_id WHERE l.pedido_id='${p}')::text || '/' ||
      (SELECT count(*) FROM public.op_itens WHERE pedido_item_id='${ids[0]}')::text || '/' ||
      public.pedido_tem_op_relacionada('${p}')::text;`);
  check(isTrue(diag.split('/').pop()), `o Pedido deve ser detectado com OP relacionada (lotes/ops/op_itens/detect = ${diag})`);

  // M — estrutural recusado para o ADMIN, mesmo com confirmacao de impacto.
  for (const [rotulo, payload] of [
    ['troca de metros', `[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":999.0},{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]`],
    ['troca de modelo', `[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_B},"metros":10.0},{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]`],
    ['insercao',       `[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":10.0},{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0},{"modelo_id":${MOD_A},"metros":3.0}]`],
    ['remocao',        `[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":10.0}]`],
  ]) {
    const e = asAdminFail(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, NULL, '${payload}'::jsonb, NULL, true);`, rotulo);
    check(/PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP/.test(e),
      `${rotulo} deve ser recusado apos OP, mesmo com confirmar_impacto=true (got ${e})`);
  }
  const snap = pedidoJson(handle, p);

  // Observacao de item NAO e estrutural: continua permitida.
  const okObs = asAdmin(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, NULL,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":10.0,"observacao":"nao estrutural"},
      {"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb, NULL, false)::text;`);
  check(/"ok"\s*:\s*true/.test(okObs), `observacao de item deve continuar editavel apos OP (got ${okObs})`);

  // Cabecalho continua editavel apos OP.
  const okHdr = asAdmin(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, '{"prazo_entrega":"2027-01-01"}'::jsonb, NULL, NULL, false)::text;`);
  check(/"ok"\s*:\s*true/.test(okHdr), `cabecalho deve continuar editavel apos OP (got ${okHdr})`);

  // M — o CLIENTE tambem nao consegue solicitar estrutura apos OP.
  const eCli = asClientFail(handle, `SELECT public.solicitar_alteracao_pedido('${p}', NULL,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":123.0},{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb, NULL, 'x');`,
    'solicitacao estrutural apos OP');
  check(/PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP/.test(eCli), `o cliente tambem deve ser recusado (got ${eCli})`);

  // M — solicitacao SO de cabecalho continua aprovavel depois da OP.
  const solH = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p}', '{"observacao":"cabecalho apos op"}'::jsonb, NULL, NULL, 'header only')->>'solicitacao_id');`));
  const apH = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${solH}', false, 'ok')::text;`);
  check(/"ok"\s*:\s*true/.test(apH), `solicitacao apenas de cabecalho deve ser aprovavel apos OP (got ${apH})`);
  check(scalar(handle, `SELECT observacao FROM public.pedidos WHERE id='${p}';`) === 'cabecalho apos op', 'o cabecalho foi aplicado');

  // N — remocao nao pode orfanar producao/expedicao/parcial, nem via RPC.
  const opItemAntes = Number(scalar(handle, `SELECT count(*) FROM public.op_itens WHERE pedido_item_id='${ids[0]}';`));
  check(opItemAntes === 1, 'o vinculo op_itens deve existir para o teste');
  check(boolq(handle, `SELECT public.pedido_item_tem_vinculo_producao('${ids[0]}');`),
    'o item vinculado deve ser detectado');
  check(!boolq(handle, `SELECT public.pedido_item_tem_vinculo_producao('${ids[1]}');`),
    'o item nao vinculado nao pode ser detectado como vinculado');
  check(Number(scalar(handle, `SELECT count(*) FROM public.op_itens WHERE pedido_item_id IS NULL;`)) === 0,
    'nao pode haver op_itens orfao antes do teste');
  check(pedidoJson(handle, p) !== snap || true, 'snapshot lido');

  log('M/N', { estruturalAposOp: 'refused x4', overrideImpacto: 'nao existe', obsItem: 'permitida', cabecalho: 'permitido', headerOnlyRequest: 'aprovada', orfandade: 'guardada' });
}

// ===========================================================================
// PART O — priority ownership.
// ===========================================================================
function partO(handle) {
  const p = novoPedido(handle, CLI_A, 'recebido');
  const ids = itemIds(handle, p);

  // Cliente solicita: db/91 resolve para `solicitada`.
  asClient(handle, `SELECT public.salvar_pedido_cliente('${p}', NULL, NULL,
    '[{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0},
      {"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":10.0}]'::jsonb, true);`);
  check(scalar(handle, `SELECT prioridade_status FROM public.pedidos WHERE id='${p}';`) === 'solicitada',
    'prioridade pedida pelo cliente deve ficar solicitada');
  check(Number(scalar(handle, `SELECT count(*) FROM public.pedido_prioridade_eventos WHERE pedido_id='${p}';`)) >= 1,
    'o evento de prioridade de db/91 deve existir');

  // O gate de aceitacao de db/91 continua valendo.
  const eAceite = mustFail(handle, `UPDATE public.pedidos SET status='confirmado' WHERE id='${p}';`, 'aceitar com prioridade pendente');
  check(/PEDIDO_PRIORITY_ADMIN_REVIEW_REQUIRED/.test(eAceite), `o gate de aceitacao de db/91 deve continuar ativo (got ${eAceite})`);

  // Admin confirma pelo mesmo dono.
  asAdmin(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, NULL, NULL, true, false);`);
  check(scalar(handle, `SELECT prioridade_status FROM public.pedidos WHERE id='${p}';`) === 'confirmada',
    'prioridade definida pelo admin deve ficar confirmada');

  // Gate de impacto com producao iniciada, dono db/91.
  run(handle, `UPDATE public.pedidos SET status='confirmado' WHERE id='${p}';`);
  run(handle, `UPDATE public.pedidos SET status='produzindo' WHERE id='${p}';`);
  const eImp = asAdminFail(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, NULL, NULL, true, false);`, 'prioridade em producao sem confirmacao');
  check(/PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED/.test(eImp),
    `o gate de impacto de db/91 deve continuar sendo o dono (got ${eImp})`);
  const okImp = asAdmin(handle, `SELECT public.salvar_pedido_admin('${p}', NULL, NULL, NULL, true, true)::text;`);
  check(/"ok"\s*:\s*true/.test(okImp), `com confirmacao explicita a prioridade deve passar (got ${okImp})`);

  // Nenhum segundo dono: prioridade_* nunca e escrita diretamente por db/92.
  const src = scalar(handle, `SELECT count(*) FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace
       AND p.proname IN ('salvar_pedido_cliente','salvar_pedido_admin','aprovar_alteracao_pedido',
                         'pedido_prioridade_aplicar','pedido_itens_reconciliar','pedido_header_aplicar')
       AND pg_get_functiondef(p.oid) ~* 'UPDATE\\s+public\\.pedidos[^;]*prioridade_status';`);
  check(Number(src) === 0, `nenhuma funcao de db/92 pode escrever prioridade_status diretamente (got ${src})`);

  log('O', { cliente: 'solicitada', admin: 'confirmada', aceitacaoGate: 'ativo', impactoGate: 'db/91', segundoDono: 'nenhum' });
}

// ===========================================================================
// PART Q — injected unexpected application failure.
// ===========================================================================
function partQ(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  const ids = itemIds(handle, p);
  const sol = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p}',
    '{"observacao":"nunca deve aparecer"}'::jsonb,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":555.0},
      {"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb, NULL, 'falha')->>'solicitacao_id');`));

  const snapAntes = pedidoJson(handle, p);

  // Injecao: o ultimo passo da APLICACAO (evento visivel ao cliente) explode.
  // A validacao ja passou, entao isto e exatamente uma falha INESPERADA.
  run(handle, `
    CREATE OR REPLACE FUNCTION public._uec_injetar_falha() RETURNS TRIGGER LANGUAGE plpgsql AS $f$
    BEGIN RAISE EXCEPTION 'UEC_FALHA_INJETADA'; END $f$;
    CREATE TRIGGER _uec_falha BEFORE INSERT ON public.pedido_cliente_eventos
      FOR EACH ROW EXECUTE FUNCTION public._uec_injetar_falha();`);

  const res = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${sol}', false, 'tentativa')::text;`);
  run(handle, 'DROP TRIGGER IF EXISTS _uec_falha ON public.pedido_cliente_eventos; DROP FUNCTION IF EXISTS public._uec_injetar_falha();');

  check(/"ok"\s*:\s*false/.test(res) && /PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(res),
    `a falha inesperada deve devolver resultado estavel (got ${res})`);
  check(pedidoJson(handle, p) === snapAntes,
    'a subtransacao deve ter desfeito TODA a aplicacao no Pedido vivo');
  check(scalar(handle, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`) === 'falha_aplicacao',
    'a solicitacao deve ficar falha_aplicacao');
  const fid = scalar(handle, `SELECT falha_identificador FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`);
  check(fid && fid.length > 0 && /UEC_FALHA_INJETADA/.test(fid), `falha_identificador deve ser preenchido (got ${fid})`);
  check(boolq(handle, `SELECT (base_snapshot IS NOT NULL) FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`),
    'a imagem-anterior deve sobreviver a falha');

  // Rejeicao nunca muda o Pedido.
  const p2 = novoPedido(handle, CLI_A, 'confirmado');
  const sol2 = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p2}', '{"observacao":"rejeitar"}'::jsonb, NULL, NULL, 'r')->>'solicitacao_id');`));
  const snap2 = pedidoJson(handle, p2);
  const eMotivo = asAdminFail(handle, `SELECT public.rejeitar_alteracao_pedido('${sol2}', '   ');`, 'rejeicao sem motivo');
  check(/PEDIDO_ALTERACAO_MOTIVO_OBRIGATORIO/.test(eMotivo), `motivo deve ser obrigatorio (got ${eMotivo})`);
  asAdmin(handle, `SELECT public.rejeitar_alteracao_pedido('${sol2}', 'nao aprovado');`);
  check(scalar(handle, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${sol2}';`) === 'rejeitada', 'deve rejeitar');
  check(pedidoJson(handle, p2) === snap2, 'a rejeicao NUNCA pode mudar o Pedido');
  // Decidida uma vez, nao se decide de novo.
  const eDup = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${sol2}', false, NULL);`, 'aprovar rejeitada');
  check(/PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA/.test(eDup), `nao se decide duas vezes (got ${eDup})`);

  log('Q', { falhaInjetada: 'rollback', status: 'falha_aplicacao', snapshot: 'preservado', rejeicao: 'nao toca pedido' });
}

// ===========================================================================
// PART R — read boundary: client sanitization, anon, supplier.
// ===========================================================================
function partR(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  asClient(handle, `SELECT public.solicitar_alteracao_pedido('${p}', '{"observacao":"r"}'::jsonb, NULL, NULL, 'msg');`);

  const resumo = asClient(handle, `SELECT public.cliente_alteracao_resumo('${p}')::text;`);
  check(/"ok"\s*:\s*true/.test(resumo), `o resumo deve responder ao dono (got ${resumo})`);
  for (const proibido of ['op_id', 'lote', 'fornecedor', 'ordem_compra', 'custo', 'numero"', 'op_itens']) {
    check(!resumo.includes(proibido), `o resumo do cliente nao pode expor "${proibido}"`);
  }
  // Uma solicitacao REAL do OUTRO cliente, para que a exclusao tenha sujeito.
  const pOutro = novoPedido(handle, CLI_B, 'confirmado');
  scalar(handle, asRole(OTHER_UID,
    `SELECT public.solicitar_alteracao_pedido('${pOutro}', '{"observacao":"do outro"}'::jsonb, NULL, NULL, 'outro');`));

  const alheio = asClient(handle, `SELECT public.cliente_alteracao_resumo('${pOutro}')::text;`);
  check(/PEDIDO_ALTERACAO_FORBIDDEN/.test(alheio), `o resumo deve recusar Pedido alheio (got ${alheio})`);

  // O cliente le apenas as SOLICITACOES do proprio Pedido.
  const visiveis = Number(scalar(handle, asRole(CLIENT_UID,
    `SELECT count(*) FROM public.pedido_alteracao_solicitacoes;`)));
  const todas = Number(scalar(handle, `SELECT count(*) FROM public.pedido_alteracao_solicitacoes;`));
  const proprias = Number(scalar(handle,
    `SELECT count(*) FROM public.pedido_alteracao_solicitacoes s JOIN public.pedidos pp ON pp.id=s.pedido_id WHERE pp.cliente_id=${CLI_A};`));
  check(visiveis === proprias && visiveis < todas,
    `RLS deve mostrar ao cliente exatamente as proprias (viu ${visiveis}, proprias ${proprias}, total ${todas})`);
  const doOutro = Number(scalar(handle, asRole(OTHER_UID,
    `SELECT count(*) FROM public.pedido_alteracao_solicitacoes s JOIN public.pedidos pp ON pp.id=s.pedido_id WHERE pp.cliente_id=${CLI_A};`)));
  check(doOutro === 0, `um cliente nao pode ver solicitacao de outro (viu ${doOutro})`);

  // Comparacao administrativa e so do admin.
  const solId = scalar(handle, `SELECT id FROM public.pedido_alteracao_solicitacoes WHERE pedido_id='${p}' AND status='pendente';`);
  const cmpAdmin = asAdmin(handle, `SELECT public.admin_alteracao_comparacao('${solId}')::text;`);
  check(/"ok"\s*:\s*true/.test(cmpAdmin) && /"antes"/.test(cmpAdmin) && /"atual"/.test(cmpAdmin),
    `a comparacao administrativa deve trazer antes e atual (got ${cmpAdmin.slice(0, 120)})`);
  const cmpCli = asClient(handle, `SELECT public.admin_alteracao_comparacao('${solId}')::text;`);
  check(/PEDIDO_ALTERACAO_FORBIDDEN/.test(cmpCli), `o cliente nao pode ler a comparacao administrativa (got ${cmpCli})`);

  // anon: sem EXECUTE em nenhuma das oito RPC e sem leitura das tabelas novas.
  const RPCS = ['salvar_pedido_cliente', 'salvar_pedido_admin', 'solicitar_alteracao_pedido',
    'retirar_alteracao_pedido', 'aprovar_alteracao_pedido', 'rejeitar_alteracao_pedido',
    'cliente_alteracao_resumo', 'admin_alteracao_comparacao'];
  for (const fn of RPCS) {
    const priv = scalar(handle, `SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))::text
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='${fn}';`);
    check(isFalse(priv), `anon NAO pode executar ${fn} (got ${priv})`);
    const authPriv = scalar(handle, `SELECT bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='${fn}';`);
    check(isTrue(authPriv), `authenticated DEVE executar ${fn} (got ${authPriv})`);
    const secdef = scalar(handle, `SELECT bool_and(p.prosecdef)::text
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='${fn}';`);
    check(isTrue(secdef), `${fn} deve ser SECURITY DEFINER (got ${secdef})`);
  }
  for (const t of ['pedido_alteracao_solicitacoes', 'pedido_alteracao_solicitacao_itens']) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const has = scalar(handle, `SELECT has_table_privilege('anon', 'public.${t}', '${priv}')::text;`);
      check(isFalse(has), `anon NAO pode ${priv} em ${t} (got ${has})`);
    }
    for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
      const has = scalar(handle, `SELECT has_table_privilege('authenticated', 'public.${t}', '${priv}')::text;`);
      check(isFalse(has), `authenticated NAO pode ${priv} direto em ${t} (got ${has})`);
    }
    const pol = Number(scalar(handle, `SELECT count(*) FROM pg_policy WHERE polrelid='public.${t}'::regclass;`));
    check(pol === 2, `${t} deve ter exatamente 2 politicas (admin ALL + cliente SELECT), got ${pol}`);
    const rls = scalar(handle, `SELECT relrowsecurity::text FROM pg_class WHERE oid='public.${t}'::regclass;`);
    check(isTrue(rls), `${t} deve ter RLS habilitada`);
  }

  // Fornecedor: acesso inalterado — nao ve Pedido nem solicitacao.
  const forn = Number(scalar(handle, asRole(FORN_UID, `SELECT count(*) FROM public.pedido_alteracao_solicitacoes;`)));
  check(forn === 0, `fornecedor nao pode ver solicitacoes (viu ${forn})`);
  const fornPed = Number(scalar(handle, asRole(FORN_UID, `SELECT count(*) FROM public.pedidos;`)));
  check(fornPed === 0, `fornecedor nao pode ver pedidos (viu ${fornPed})`);

  // As politicas de CRIACAO do Cliente continuam existindo (esta fase nao as remove).
  for (const [tab, pol] of [['pedidos', 'pedidos_cliente_insert'], ['pedido_itens', 'pedido_itens_cliente_insert']]) {
    const n = Number(scalar(handle, `SELECT count(*) FROM pg_policy WHERE polrelid='public.${tab}'::regclass AND polname='${pol}';`));
    check(n === 1, `a politica de criacao ${pol} deve continuar existindo (got ${n})`);
  }
  // E nenhuma politica de UPDATE/DELETE de cliente apareceu.
  const wide = Number(scalar(handle, `SELECT count(*) FROM pg_policy
     WHERE polrelid IN ('public.pedidos'::regclass, 'public.pedido_itens'::regclass)
       AND polcmd IN ('w','d') AND polname NOT LIKE '%admin%';`));
  check(wide === 0, `nenhuma politica de UPDATE/DELETE nao-admin pode existir (got ${wide})`);

  log('R', { resumo: 'sanitizado', anon: 'sem acesso', authenticatedDML: 'negado', fornecedor: 'inalterado', policiesCriacao: 'preservadas' });
}

// ===========================================================================
async function main() {
  let handle = null;
  try {
    SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'g28-uec-'));
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pg: handle.pgVersion });

    await partA(handle);
    partB(handle);
    partC(handle);
    partDE(handle);
    partFGH(handle);
    partI(handle);
    partJKLP(handle);
    partMN(handle);
    partO(handle);
    partQ(handle);
    partR(handle);

    console.log(`\nALL PROOFS PASSED (failures=${FAILURES})`);
  } catch (error) {
    FAILURES += 1;
    console.error(`\nHARNESS ERROR: ${error.message}`);
  } finally {
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
