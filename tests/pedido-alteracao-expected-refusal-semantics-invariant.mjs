// tests/pedido-alteracao-expected-refusal-semantics-invariant.mjs
//
// PEDIDO-ALTERACAO-EXPECTED-REFUSAL-SEMANTICS-CORRECTION-R1 disposable-cluster
// proof of db/115_pedido_alteracao_expected_refusal_semantics.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic and is
// built inside the disposable cluster; NO production data is used.
//
// THIS IS A CURRENT-TOPOLOGY HARNESS, not a bounded historical one. It applies
// the WHOLE accepted migration identity chain up to the current terminal and
// then proves the correction. tests/pedido-unified-edit-change-approval-
// invariant.mjs remains the bounded db/92+db/93 historical proof and is NOT a
// global-current manifest; it is not touched by this order.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   A   the whole accepted identity chain db/01..db/114 applies in order.
//   BEF the TWO defects reproduce against the PRE-correction function:
//       BEF-1 an approval that needs production-impact confirmation becomes
//             falha_aplicacao;
//       BEF-2 an approval that hits the production-linked item refusal becomes
//             falha_aplicacao.
//   MIG db/115 applies, re-applies with zero drift, and changes NOTHING in the
//       catalogue except the body of aprovar_alteracao_pedido.
//   A'  PROOF A — priority impact: the first approval surfaces
//       PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED as an EXPECTED
//       refusal, the request stays pendente with decidido_em/decidido_por
//       unset and zero live mutation; the explicit retry on the SAME request
//       with p_confirmar_impacto = true then applies normally, exactly once.
//   B'  PROOF B — production-linked item: the refusal identifier surfaces
//       BEFORE the application stage, the request stays pendente, nothing
//       mutates, no success is claimed and no override exists.
//   C'  PROOF C — unexpected failure: an injected fault AFTER validation still
//       rolls back every live change, still records falha_aplicacao with
//       falha_identificador, and remains distinct from the two expected
//       refusals.
//   D'  PROOF D — no regression on stale base/revision, already-decided,
//       terminal Pedido, structural-after-OP and authorization.
//   Z   mandatory full cluster destruction.
//
// Run:  node tests/pedido-alteracao-expected-refusal-semantics-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();

// ---------------------------------------------------------------------------
// Accepted migration topology. Same model as the global deploy manifest owner
// tests/ordem-compra-c3d-deploy.smoke.js: a terminal, a reservation register
// and a suffix register. Restating it here is deliberate — this harness must
// fail closed if the repository topology drifts under it.
// ---------------------------------------------------------------------------
const EXPECTED_TERMINAL = 115;
const RESERVED_MIGRATION_NUMBERS = new Set([110]);
const SUFFIXED_MIGRATION_BASES = new Map([
  [103, ['103', '103b']],
  [106, ['106a', '106b']],
]);
const EXPECTED_MIGRATION_IDENTITIES = Array.from({ length: EXPECTED_TERMINAL }, (_, i) => i + 1)
  .filter((n) => !RESERVED_MIGRATION_NUMBERS.has(n))
  .flatMap((n) => SUFFIXED_MIGRATION_BASES.get(n) || [String(n)]);

const DB115 = '115_pedido_alteracao_expected_refusal_semantics.sql';

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

// db/67 fails closed unless the 64-row REFUND-A corpus exists. Unrelated to
// this order's subject; present only so the chain can reach the terminal.
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
DECLARE v_tot int;
BEGIN
  SELECT count(*) INTO v_tot FROM public.ordens_compra_fio;
  IF v_tot <> 64 THEN
    RAISE EXCEPTION 'corpus mismatch: total=% (expected 64)', v_tot;
  END IF;
END
$corpus$;
`;

const CLI_A = 970000101;
const CLI_B = 970000102;
const ADMIN_UID = '00000000-0000-4000-8000-0000000000b1';
const CLIENT_UID = '00000000-0000-4000-8000-0000000000b2';
const OTHER_UID = '00000000-0000-4000-8000-0000000000b3';
const MOD_A = 970000201;
const MOD_B = 970000202;

const ATORES_SQL = `
INSERT INTO public.cores (id, nome) VALUES (970000301, 'ERS-COR-1'), (970000302, 'ERS-COR-2')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.clientes (id, nome) VALUES (${CLI_A}, 'ERS-CLIENTE-A'), (${CLI_B}, 'ERS-CLIENTE-B')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modelos (id, nome, largura, cor_1_id, cor_2_id) VALUES
  (${MOD_A}, 'ERS-MODELO-A', 2.10, 970000301, 970000302),
  (${MOD_B}, 'ERS-MODELO-B', 2.10, 970000302, 970000301)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_UID}',  'admin@ers.local'),
  ('${CLIENT_UID}', 'cliente@ers.local'),
  ('${OTHER_UID}',  'outro@ers.local')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, email, nome, tipo, cliente_id, fornecedor_id, ativo) VALUES
  ('${ADMIN_UID}',  'admin@ers.local',   'Admin ERS',   'admin',   NULL,     NULL, TRUE),
  ('${CLIENT_UID}', 'cliente@ers.local', 'Cliente ERS', 'cliente', ${CLI_A}, NULL, TRUE),
  ('${OTHER_UID}',  'outro@ers.local',   'Outro ERS',   'cliente', ${CLI_B}, NULL, TRUE)
  ON CONFLICT (id) DO NOTHING;
`;

// ---------------------------------------------------------------------------
// plumbing
// ---------------------------------------------------------------------------
let FAILURES = 0;
let SCRATCH_DIR = null;

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
    encoding: 'utf8', timeout: 300000,
  });
  if (result.status !== 0) {
    const diag = result.error ? result.error.message : (result.stderr || result.stdout || `exit ${result.status}`);
    throw new Error(`APPLY_FAILED (${label || file}): ${diag}`);
  }
  return result.stdout || '';
}
async function applySql(handle, name, sql, label) {
  const file = path.join(SCRATCH_DIR, name);
  await writeFile(file, sql, 'utf8');
  return applyFile(handle, file, label || name);
}
function run(handle, sql) {
  const result = spawnSync(psqlBinary(handle), [...baseArgs(handle), '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', timeout: 120000,
  });
  return { ok: result.status === 0, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}
function scalar(handle, sql) {
  const r = run(handle, sql);
  if (!r.ok) throw new Error(`QUERY_FAILED: ${r.err || r.out}`);
  return r.out;
}
function must(handle, sql, label) {
  const r = run(handle, sql);
  check(r.ok, `FIXTURE ${label}: ${r.err || r.out}`);
  return r;
}
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

// A catalogue fingerprint PER OBJECT LINE, so a drift check can name exactly
// which lines changed instead of only reporting that something did.
const CATALOGUE_SQL = `
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
      SELECT 'RLS '||c.relname||' '||c.relrowsecurity::text
        FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
      UNION ALL
      SELECT 'IDX '||schemaname||'.'||indexname||' '||indexdef FROM pg_indexes WHERE schemaname='public'
      UNION ALL
      SELECT 'GRANT '||grantee||' '||table_name||' '||privilege_type
        FROM information_schema.role_table_grants WHERE table_schema='public'
      UNION ALL
      SELECT 'COLGRANT '||grantee||' '||table_name||' '||column_name||' '||privilege_type
        FROM information_schema.column_privileges WHERE table_schema='public'
      UNION ALL
      SELECT 'GRANTFN '||grantee||' '||routine_name||' '||privilege_type
        FROM information_schema.role_routine_grants WHERE routine_schema='public'
    )
    SELECT line FROM t ORDER BY line`;

function catalogueLines(handle) {
  return scalar(handle, CATALOGUE_SQL).split('\n').filter(Boolean);
}
function diffLines(before, after) {
  const A = new Set(before);
  const B = new Set(after);
  return {
    removed: before.filter((l) => !B.has(l)),
    added: after.filter((l) => !A.has(l)),
  };
}

const snapshot = (h, id) => scalar(h, `SELECT public.pedido_snapshot('${id}')::text;`);
const revisao = (h, id) => Number(scalar(h, `SELECT revisao FROM public.pedidos WHERE id='${id}';`));
const prioridade = (h, id) => scalar(h,
  `SELECT coalesce(prioridade_status,'-')||'/'||coalesce(prioridade_observacao,'-')||'/'||
          (prioridade_confirmada_em IS NOT NULL)::text FROM public.pedidos WHERE id='${id}';`);
const solRow = (h, sol) => scalar(h,
  `SELECT status||'|'||coalesce(decidido_em::text,'-')||'|'||coalesce(decidido_por::text,'-')||'|'||
          coalesce(falha_identificador,'-') FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`);
const eventCounts = (h) => scalar(h, `
  SELECT (SELECT count(*) FROM public.pedido_eventos)||'/'||
         (SELECT count(*) FROM public.pedido_cliente_eventos)||'/'||
         (SELECT count(*) FROM public.pedido_prioridade_eventos)||'/'||
         (SELECT count(*) FROM public.pedido_itens);`);

// A complete "nothing moved" probe for one Pedido plus the global audit shape.
function liveState(handle, pedidoId) {
  return [snapshot(handle, pedidoId), revisao(handle, pedidoId),
    prioridade(handle, pedidoId), eventCounts(handle)].join('~~');
}

async function resolveManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d+[a-z]?_[A-Za-z0-9_]+\.sql$/.test(f) && !/\.verify\.sql$/.test(f))
    .map((f) => {
      const m = f.match(/^(\d+)([a-z]?)_/);
      return { n: Number(m[1]), suffix: m[2] || '', identity: `${Number(m[1])}${m[2] || ''}`, file: path.join(dbDir, f) };
    })
    .sort((a, b) => (a.n - b.n) || a.suffix.localeCompare(b.suffix));
}

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
// Move o Pedido para `produzindo` SEM passar por gatilho de transicao: o
// assunto desta prova e a aprovacao, nao a maquina de estados de db/105.
function forcarStatus(handle, pedidoId, status) {
  must(handle, `SET session_replication_role = replica;
    UPDATE public.pedidos SET status='${status}' WHERE id='${pedidoId}';
    SET session_replication_role = origin;`, `status ${status}`);
}
// Vincula o item a uma ENTREGA PARCIAL. Isto e o unico vinculo de producao que
// pedido_tem_op_relacionada NAO enxerga, entao e exatamente o caminho pelo qual
// PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP e alcancavel sem que
// PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP dispare antes.
function vincularParcial(handle, pedidoId, itemId) {
  const parcial = scalar(handle, `
    WITH p AS (
      INSERT INTO public.pedido_parciais (pedido_id, situacao, metros, titulo)
      VALUES ('${pedidoId}', 'em_tecelagem', 5.00, 'ERS parcial')
      RETURNING id)
    SELECT id FROM p;`);
  must(handle, `
    INSERT INTO public.pedido_parcial_itens (parcial_id, pedido_item_id, metros)
    VALUES ('${parcial}', '${itemId}', 5.00);`, 'parcial item');
  const vinculado = scalar(handle, `SELECT public.pedido_item_tem_vinculo_producao('${itemId}')::text;`);
  check(vinculado === 'true' || vinculado === 't',
    'o item deve ficar vinculado a producao pela parcial');
  const temOp = scalar(handle, `SELECT public.pedido_tem_op_relacionada('${pedidoId}')::text;`);
  check(temOp === 'false' || temOp === 'f',
    'o Pedido NAO pode ter OP relacionada, senao a recusa estrutural dispararia antes');
  return parcial;
}
function criarOpPara(handle, pedidoId, itemId, opId, loteId, numero) {
  must(handle, `INSERT INTO public.lotes (id, numero, cliente_id, pedido_id) VALUES (${loteId}, ${numero}, ${CLI_A}, '${pedidoId}');`, 'lote');
  must(handle, `INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES (${opId}, ${numero}, 2099, 'aberta', 'tecelagem', ${loteId});`, 'op');
  must(handle, `INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id) VALUES (${opId}, ${MOD_A}, 10.00, '${itemId}');`, 'op_item');
}

// Cenario canonico da PROVA A: Pedido em producao, dois itens, solicitacao do
// Cliente que muda o cabecalho E pede prioridade.
function cenarioPrioridade(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  forcarStatus(handle, p, 'produzindo');
  const sol = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p}',
    '{"observacao":"prioridade por favor"}'::jsonb, NULL, TRUE, 'urgente')->>'solicitacao_id');`));
  check(sol && sol.length === 36, `a solicitacao de prioridade deve existir (got ${sol})`);
  return { p, sol };
}
// Cenario canonico da PROVA B: remocao de um item ja vinculado a uma parcial.
function cenarioItemVinculado(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  const ids = itemIds(handle, p);
  vincularParcial(handle, p, ids[0]);
  const sol = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p}',
    NULL,
    '[{"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb,
    NULL, 'remover item 1')->>'solicitacao_id');`));
  check(sol && sol.length === 36, `a solicitacao de remocao deve existir (got ${sol})`);
  return { p, sol, removido: ids[0] };
}

// ===========================================================================
// PART A — the whole accepted identity chain applies.
// ===========================================================================
async function partA(handle) {
  const manifest = await resolveManifest();
  const identities = manifest.map((m) => m.identity);
  check(JSON.stringify(identities) === JSON.stringify(EXPECTED_MIGRATION_IDENTITIES),
    `topologia de migracao divergente.\n  esperado: ${EXPECTED_MIGRATION_IDENTITIES.join(',')}\n  medido:   ${identities.join(',')}`);
  check(path.basename(manifest[manifest.length - 1].file) === DB115,
    `o terminal deve ser ${DB115}`);

  const preTerminal = manifest.slice(0, -1);
  await applySql(handle, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of preTerminal) {
    if (n === 67) await applySql(handle, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
    applyFile(handle, file, path.basename(file));
  }
  await applySql(handle, 'atores.sql', ATORES_SQL, 'atores');
  log('A', { identities: identities.length, applied: preTerminal.length, terminalAplicado: '114', db115: 'ainda nao' });
}

// ===========================================================================
// PART BEF — the TWO defects reproduce against the PRE-correction function.
// ===========================================================================
function partBefore(handle) {
  // BEF-1 impacto de prioridade -> falha_aplicacao (a divida medida).
  const a = cenarioPrioridade(handle);
  const antesA = liveState(handle, a.p);
  const resA = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${a.sol}', false, 'tentativa')::text;`);
  check(/"ok"\s*:\s*false/.test(resA) && /PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(resA),
    `BEF-1: a pre-correcao deveria devolver falha de aplicacao (got ${resA})`);
  const rowA = solRow(handle, a.sol);
  check(rowA.startsWith('falha_aplicacao|'),
    `BEF-1: a solicitacao deveria virar falha_aplicacao (got ${rowA})`);
  check(/PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED/.test(rowA),
    `BEF-1: a causa registrada deve ser a confirmacao de impacto (got ${rowA})`);
  check(liveState(handle, a.p) === antesA,
    'BEF-1: a subtransacao deve ter desfeito toda a aplicacao mesmo na pre-correcao');
  // E a retentativa desenhada em U10.4 e INALCANCAVEL — este e o dano.
  const retry = asAdminFail(handle,
    `SELECT public.aprovar_alteracao_pedido('${a.sol}', true, 'tentativa');`, 'BEF-1 retentativa');
  check(/PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA/.test(retry),
    `BEF-1: a retentativa com confirmacao deveria bater em JA_DECIDIDA (got ${retry})`);

  // BEF-2 item vinculado -> falha_aplicacao (a divida medida).
  const b = cenarioItemVinculado(handle);
  const antesB = liveState(handle, b.p);
  const resB = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${b.sol}', false, 'tentativa')::text;`);
  check(/"ok"\s*:\s*false/.test(resB) && /PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(resB),
    `BEF-2: a pre-correcao deveria devolver falha de aplicacao (got ${resB})`);
  const rowB = solRow(handle, b.sol);
  check(rowB.startsWith('falha_aplicacao|') && /PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/.test(rowB),
    `BEF-2: a solicitacao deveria virar falha_aplicacao pelo vinculo de item (got ${rowB})`);
  check(liveState(handle, b.p) === antesB,
    'BEF-2: a subtransacao deve ter desfeito toda a aplicacao mesmo na pre-correcao');

  log('BEF', { prioridade: 'falha_aplicacao', item: 'falha_aplicacao', retentativa: 'inalcancavel' });
}

// ===========================================================================
// PART MIG — db/115 applies, replays without drift, and touches ONE function.
// ===========================================================================
function partMigracao(handle) {
  const antes = catalogueLines(handle);
  applyFile(handle, path.join(REPO_ROOT, 'db', DB115), 'db/115');
  const depois = catalogueLines(handle);

  const d = diffLines(antes, depois);
  const alvo = (l) => /^FN aprovar_alteracao_pedido\(/.test(l);
  check(d.removed.length === 1 && alvo(d.removed[0]),
    `db/115 nao pode remover nada alem do corpo antigo (removidos: ${d.removed.join(' ; ')})`);
  check(d.added.length === 1 && alvo(d.added[0]),
    `db/115 nao pode adicionar nada alem do corpo novo (adicionados: ${d.added.join(' ; ')})`);

  // Replay: converge byte a byte.
  applyFile(handle, path.join(REPO_ROOT, 'db', DB115), 'db/115 replay 1');
  applyFile(handle, path.join(REPO_ROOT, 'db', DB115), 'db/115 replay 2');
  const replay = catalogueLines(handle);
  const dr = diffLines(depois, replay);
  check(dr.removed.length === 0 && dr.added.length === 0,
    `db/115 deve reaplicar sem drift (removidos: ${dr.removed.join(' ; ')} | adicionados: ${dr.added.join(' ; ')})`);

  // Nenhuma linha de negocio migrada.
  const solicitacoes = Number(scalar(handle, 'SELECT count(*) FROM public.pedido_alteracao_solicitacoes;'));
  check(solicitacoes === 2, `db/115 nao pode criar nem apagar solicitacao (got ${solicitacoes})`);

  // Assinatura, dono, seguranca e privilegio inalterados.
  const meta = scalar(handle, `
    SELECT pg_get_function_identity_arguments(oid)||'|'||pg_get_userbyid(proowner)||'|'||prosecdef::text||'|'||
           coalesce(array_to_string(proconfig,','),'-')||'|'||
           has_function_privilege('authenticated', oid, 'EXECUTE')::text||'|'||
           has_function_privilege('service_role', oid, 'EXECUTE')::text||'|'||
           has_function_privilege('anon', oid, 'EXECUTE')::text
      FROM pg_proc WHERE oid = to_regprocedure('public.aprovar_alteracao_pedido(uuid,boolean,text)');`);
  check(meta === 'p_solicitacao_id uuid, p_confirmar_impacto boolean, p_motivo text|postgres|true|search_path=public, auth|true|true|false',
    `metadados da funcao alvo mudaram: ${meta}`);

  log('MIG', { catalogoDelta: '1 FN', replay: 'sem drift', assinatura: 'inalterada', linhasDeNegocio: 'intocadas' });
}

// ===========================================================================
// PROOF A — priority impact becomes an EXPECTED refusal, and the retry works.
// ===========================================================================
function proofA(handle) {
  const { p, sol } = cenarioPrioridade(handle);
  const antes = liveState(handle, p);
  const rev0 = revisao(handle, p);

  const err = asAdminFail(handle,
    `SELECT public.aprovar_alteracao_pedido('${sol}', false, 'primeira tentativa');`,
    "PROOF A primeira aprovacao");
  check(/PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED/.test(err),
    `PROOF A: o identificador estavel deve aflorar como RECUSA (got ${err})`);
  check(!/PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(err),
    'PROOF A: a recusa esperada nunca pode ser apresentada como falha de aplicacao');

  const row = solRow(handle, sol);
  check(row === 'pendente|-|-|-',
    `PROOF A: a solicitacao deve continuar pendente, sem carimbo de decisao (got ${row})`);
  check(liveState(handle, p) === antes,
    'PROOF A: nenhuma linha viva de Pedido, item, prioridade ou auditoria pode mudar');

  // Retentativa EXPLICITA sobre a MESMA solicitacao.
  const ok = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${sol}', true, 'confirmado')::text;`);
  check(/"ok"\s*:\s*true/.test(ok) && /"status"\s*:\s*"aprovada"/.test(ok),
    `PROOF A: a retentativa confirmada deve aplicar normalmente (got ${ok})`);

  const aprovadas = Number(scalar(handle,
    `SELECT count(*) FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}' AND status='aprovada';`));
  check(aprovadas === 1, `PROOF A: a solicitacao deve ficar aprovada exatamente uma vez (got ${aprovadas})`);
  const rowOk = solRow(handle, sol);
  check(rowOk.startsWith('aprovada|'), `PROOF A: estado final inesperado (${rowOk})`);
  check(rowOk.split('|')[3] === '-',
    `PROOF A: uma aprovacao bem-sucedida nao pode registrar falha_identificador (${rowOk})`);
  check(rowOk.split('|')[1] !== '-', 'PROOF A: decidido_em deve ser carimbado na aprovacao');
  check(scalar(handle, `SELECT decidido_por::text FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`) === ADMIN_UID,
    'PROOF A: decidido_por deve ser o administrador que confirmou');

  const obs = scalar(handle, `SELECT coalesce(observacao,'-') FROM public.pedidos WHERE id='${p}';`);
  check(obs === 'prioridade por favor', `PROOF A: o cabecalho proposto deve estar aplicado (got ${obs})`);
  const pri = prioridade(handle, p);
  check(pri.startsWith('confirmada/'),
    `PROOF A: a prioridade deve resolver para confirmada sob identidade administrativa (got ${pri})`);
  check(revisao(handle, p) > rev0, 'PROOF A: a revisao deve avancar com a aplicacao');

  // Uma segunda tentativa sobre a solicitacao ja aprovada continua recusada.
  const dup = asAdminFail(handle,
    `SELECT public.aprovar_alteracao_pedido('${sol}', true, 'de novo');`, 'PROOF A segunda aplicacao');
  check(/PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA/.test(dup),
    `PROOF A: nao se aplica duas vezes (got ${dup})`);

  log("A'", { primeira: 'recusa esperada', solicitacao: 'pendente', mutacao: 'zero',
    retentativa: 'aprovada 1x', prioridade: pri.split('/')[0] });
}

// ===========================================================================
// PROOF B — production-linked item refusal happens BEFORE application.
// ===========================================================================
function proofB(handle) {
  const { p, sol, removido } = cenarioItemVinculado(handle);
  const antes = liveState(handle, p);

  const err = asAdminFail(handle,
    `SELECT public.aprovar_alteracao_pedido('${sol}', false, 'tentativa');`, 'PROOF B aprovacao');
  check(/PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/.test(err),
    `PROOF B: o identificador estavel deve aflorar como RECUSA (got ${err})`);
  check(!/PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(err),
    'PROOF B: a recusa esperada nunca pode ser apresentada como falha de aplicacao');

  const row = solRow(handle, sol);
  check(row === 'pendente|-|-|-',
    `PROOF B: a solicitacao deve continuar pendente, sem carimbo de decisao (got ${row})`);
  check(liveState(handle, p) === antes,
    'PROOF B: nenhuma linha viva de Pedido, item, prioridade ou auditoria pode mudar');
  check(Number(scalar(handle, `SELECT count(*) FROM public.pedido_itens WHERE id='${removido}';`)) === 1,
    'PROOF B: o item vinculado continua vivo');

  // NAO existe override: confirmar impacto nao destrava o vinculo de item.
  const comConfirmacao = asAdminFail(handle,
    `SELECT public.aprovar_alteracao_pedido('${sol}', true, 'com confirmacao');`, 'PROOF B override');
  check(/PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/.test(comConfirmacao),
    `PROOF B: p_confirmar_impacto nao pode virar override do vinculo de item (got ${comConfirmacao})`);
  check(solRow(handle, sol) === 'pendente|-|-|-',
    'PROOF B: a solicitacao continua pendente apos a segunda recusa');

  // A rede defensiva do escritor dono CONTINUA ativa.
  const defensiva = mustFail(handle,
    `SELECT public.pedido_itens_reconciliar('${p}',
       '[{"pedido_item_id":"${itemIds(handle, p)[1]}","modelo_id":${MOD_B},"metros":20.0,"ordem":0}]'::jsonb);`,
    'PROOF B rede defensiva');
  check(/PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/.test(defensiva),
    `PROOF B: pedido_itens_reconciliar deve continuar recusando por conta propria (got ${defensiva})`);

  log("B'", { recusa: 'antes da aplicacao', solicitacao: 'pendente', mutacao: 'zero',
    override: 'inexistente', redeDefensiva: 'ativa' });
}

// ===========================================================================
// PROOF C — an injected UNEXPECTED failure is still falha_aplicacao.
// ===========================================================================
function proofC(handle) {
  const p = novoPedido(handle, CLI_A, 'confirmado');
  const sol = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p}',
    '{"observacao":"nunca deve aparecer"}'::jsonb, NULL, NULL, 'falha')->>'solicitacao_id');`));
  const antes = liveState(handle, p);

  // A injecao roda no ULTIMO passo da APLICACAO: a validacao ja passou, entao
  // isto e exatamente uma falha INESPERADA.
  must(handle, `
    CREATE OR REPLACE FUNCTION public._ers_injetar_falha() RETURNS TRIGGER LANGUAGE plpgsql AS $f$
    BEGIN RAISE EXCEPTION 'ERS_FALHA_INJETADA'; END $f$;
    CREATE TRIGGER _ers_falha BEFORE INSERT ON public.pedido_cliente_eventos
      FOR EACH ROW EXECUTE FUNCTION public._ers_injetar_falha();`, 'injecao');
  const res = asAdmin(handle, `SELECT public.aprovar_alteracao_pedido('${sol}', false, 'tentativa')::text;`);
  must(handle, 'DROP TRIGGER IF EXISTS _ers_falha ON public.pedido_cliente_eventos; DROP FUNCTION IF EXISTS public._ers_injetar_falha();', 'limpeza');

  check(/"ok"\s*:\s*false/.test(res) && /PEDIDO_ALTERACAO_FALHA_APLICACAO/.test(res),
    `PROOF C: a falha inesperada deve devolver o resultado estavel (got ${res})`);
  const row = solRow(handle, sol);
  check(row.startsWith('falha_aplicacao|'), `PROOF C: a solicitacao deve virar falha_aplicacao (got ${row})`);
  check(/ERS_FALHA_INJETADA/.test(row), `PROOF C: falha_identificador deve registrar a causa (got ${row})`);
  check(liveState(handle, p) === antes,
    'PROOF C: a subtransacao deve desfazer TODA a aplicacao no Pedido vivo');
  check(scalar(handle, `SELECT (base_snapshot IS NOT NULL)::text FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`).startsWith('t'),
    'PROOF C: a imagem-anterior deve sobreviver a falha');

  // E a distincao continua real: uma recusa esperada NAO produz este estado.
  const b = cenarioItemVinculado(handle);
  asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${b.sol}', false, 'x');`, 'PROOF C contraste');
  check(solRow(handle, b.sol) === 'pendente|-|-|-',
    'PROOF C: a recusa esperada continua distinta da falha inesperada');

  log("C'", { falhaInjetada: 'rollback', status: 'falha_aplicacao', identificador: 'gravado', distincao: 'preservada' });
}

// ===========================================================================
// PROOF D — no regression on the other expected refusals.
// ===========================================================================
function proofD(handle) {
  // D1 base/revisao desatualizada.
  const p1 = novoPedido(handle, CLI_A, 'confirmado');
  const s1 = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p1}', '{"observacao":"a"}'::jsonb, NULL, NULL, 'm')->>'solicitacao_id');`));
  must(handle, `UPDATE public.pedidos SET observacao='mudou por fora' WHERE id='${p1}';`, 'drift de revisao');
  const e1 = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${s1}', false, NULL);`, 'D1');
  check(/PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA/.test(e1), `D1 (got ${e1})`);
  check(solRow(handle, s1) === 'pendente|-|-|-', 'D1: a solicitacao continua pendente');

  // D2 solicitacao ja decidida.
  const p2 = novoPedido(handle, CLI_A, 'confirmado');
  const s2 = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p2}', '{"observacao":"b"}'::jsonb, NULL, NULL, 'm')->>'solicitacao_id');`));
  asAdmin(handle, `SELECT public.rejeitar_alteracao_pedido('${s2}', 'nao aprovado');`);
  const e2 = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${s2}', false, NULL);`, 'D2');
  check(/PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA/.test(e2), `D2 (got ${e2})`);

  // D3 Pedido terminal.
  const p3 = novoPedido(handle, CLI_A, 'confirmado');
  const s3 = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p3}', '{"observacao":"c"}'::jsonb, NULL, NULL, 'm')->>'solicitacao_id');`));
  forcarStatus(handle, p3, 'cancelado');
  const e3 = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${s3}', false, NULL);`, 'D3');
  check(/PEDIDO_ALTERACAO_PEDIDO_TERMINAL/.test(e3), `D3 (got ${e3})`);
  check(solRow(handle, s3) === 'pendente|-|-|-', 'D3: a solicitacao continua pendente');

  // D4 estrutural apos OP — a OP nasce DEPOIS da solicitacao, por isso a
  //    submissao passa e a recusa pertence a aprovacao.
  const p4 = novoPedido(handle, CLI_A, 'confirmado');
  const ids4 = itemIds(handle, p4);
  const s4 = scalar(handle, asRole(CLIENT_UID, `SELECT (public.solicitar_alteracao_pedido('${p4}', NULL,
    '[{"pedido_item_id":"${ids4[0]}","modelo_id":${MOD_A},"metros":99.0},
      {"pedido_item_id":"${ids4[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb, NULL, 'm')->>'solicitacao_id');`));
  criarOpPara(handle, p4, ids4[0], 970000401, 970000501, 970401);
  const antes4 = liveState(handle, p4);
  const e4 = asAdminFail(handle, `SELECT public.aprovar_alteracao_pedido('${s4}', false, NULL);`, 'D4');
  check(/PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP/.test(e4), `D4 (got ${e4})`);
  check(!/PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/.test(e4),
    'D4: a recusa estrutural conserva a propria identidade e precedencia');
  check(solRow(handle, s4) === 'pendente|-|-|-', 'D4: a solicitacao continua pendente');
  check(liveState(handle, p4) === antes4, 'D4: nada muda');

  // D5 autorizacao.
  const p5 = novoPedido(handle, CLI_A, 'confirmado');
  const s5 = scalar(handle, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${p5}', '{"observacao":"e"}'::jsonb, NULL, NULL, 'm')->>'solicitacao_id');`));
  const e5 = mustFail(handle, asRole(CLIENT_UID, `SELECT public.aprovar_alteracao_pedido('${s5}', false, NULL);`), 'D5');
  check(/PEDIDO_ALTERACAO_FORBIDDEN/.test(e5), `D5 (got ${e5})`);
  check(solRow(handle, s5) === 'pendente|-|-|-', 'D5: a solicitacao continua pendente');

  log("D'", { stale: 'ok', jaDecidida: 'ok', terminal: 'ok', estruturalAposOp: 'ok', autorizacao: 'ok' });
}

async function main() {
  let handle = null;
  try {
    SCRATCH_DIR = await mkdtemp(path.join(tmpdir(), 'g28-ers-'));
    handle = await bootstrapCluster({});
    log('CLUSTER', { host: handle.host, port: handle.port, pg: handle.pgVersion });

    await partA(handle);
    partBefore(handle);
    partMigracao(handle);
    proofA(handle);
    proofB(handle);
    proofC(handle);
    proofD(handle);

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
