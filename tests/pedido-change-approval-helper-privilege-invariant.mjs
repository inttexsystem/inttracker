// tests/pedido-change-approval-helper-privilege-invariant.mjs
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1-C1 disposable-cluster proof of
// db/93_pedido_change_approval_helper_privilege_correction.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic; NO
// production data is used.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   A  db/01..db/93 apply in order and db/93 is the terminal.
//   B  db/93 re-applies idempotently with zero privilege drift.
//   C  db/93 fails closed when db/92 is absent.
//   D  the db/92 inventory is exactly 22 functions: 8 public, 14 internal.
//   E  BEFORE db/93 every internal helper is directly callable by
//      authenticated — the defect is reproduced, not assumed — including the
//      cross-tenant READ and the cross-tenant WRITE primitives.
//   F  AFTER db/93 every internal helper denies anon, authenticated and
//      service_role, and the owner still executes.
//   G  a client cannot read, mutate or reorder another client's Pedido through
//      any helper.
//   H  all eight RPCs still work and still enforce their own role/ownership.
//   I  helpers still work THROUGH their owning RPCs, and revision triggers
//      still fire.
//   J  no table DML privilege was restored and no policy changed.
//   Z  mandatory full cluster destruction.
//
// Run:  node tests/pedido-change-approval-helper-privilege-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const EXPECTED_TERMINAL = 93;
const DB92 = '92_pedido_unified_edit_change_approval_foundation.sql';
const DB93 = '93_pedido_change_approval_helper_privilege_correction.sql';

// The parent harness already owns the platform preamble, the db/67 corpus and
// the actor fixture. Reusing its literals keeps ONE definition of each and
// guarantees this suite cannot silently drift from the phase it corrects.
const parent = fs.readFileSync(
  path.join(REPO_ROOT, 'tests', 'pedido-unified-edit-change-approval-invariant.mjs'), 'utf8');
const between = (open, close) => parent.split(open)[1].split(close)[0];
const PREAMBLE_SQL = between('const PREAMBLE_SQL = `', '`;');
const CORPUS_SQL = between('const CORPUS_SQL = `', '`;');
const ATORES_SQL = between('const ATORES_SQL = `', '`;')
  .replace(/\$\{CLI_A\}/g, '960000101').replace(/\$\{CLI_B\}/g, '960000102')
  .replace(/\$\{MOD_A\}/g, '960000201').replace(/\$\{MOD_B\}/g, '960000202')
  .replace(/\$\{ADMIN_UID\}/g, '00000000-0000-4000-8000-0000000000a1')
  .replace(/\$\{CLIENT_UID\}/g, '00000000-0000-4000-8000-0000000000c1')
  .replace(/\$\{OTHER_UID\}/g, '00000000-0000-4000-8000-0000000000c2')
  .replace(/\$\{FORN_UID\}/g, '00000000-0000-4000-8000-0000000000f1');

const CLI_A = 960000101;
const CLI_B = 960000102;
const MOD_A = 960000201;
const MOD_B = 960000202;
const ADMIN_UID = '00000000-0000-4000-8000-0000000000a1';
const CLIENT_UID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_UID = '00000000-0000-4000-8000-0000000000c2';

// The binding inventory. A drift here is a contract change, not a test detail.
const RPCS = [
  ['salvar_pedido_cliente', 'uuid,bigint,jsonb,jsonb,boolean'],
  ['salvar_pedido_admin', 'uuid,bigint,jsonb,jsonb,boolean,boolean'],
  ['solicitar_alteracao_pedido', 'uuid,jsonb,jsonb,boolean,text'],
  ['retirar_alteracao_pedido', 'uuid'],
  ['aprovar_alteracao_pedido', 'uuid,boolean,text'],
  ['rejeitar_alteracao_pedido', 'uuid,text'],
  ['cliente_alteracao_resumo', 'uuid'],
  ['admin_alteracao_comparacao', 'uuid'],
];
const HELPERS = [
  ['pedidos_revisao_normalize_fn', ''],
  ['pedido_itens_revisao_bump_fn', ''],
  ['pedido_tem_op_relacionada', 'uuid'],
  ['pedido_item_tem_vinculo_producao', 'uuid'],
  ['pedido_alteracao_imutabilidade_guard_fn', ''],
  ['pedido_alteracao_itens_imutabilidade_guard_fn', ''],
  ['pedido_snapshot', 'uuid'],
  ['pedido_itens_payload_normalizar', 'uuid,jsonb'],
  ['pedido_itens_payload_e_estrutural', 'uuid,jsonb'],
  ['pedido_itens_reconciliar', 'uuid,jsonb'],
  ['pedido_itens_sequencia', 'uuid'],
  ['pedido_header_validar', 'jsonb,text'],
  ['pedido_header_aplicar', 'uuid,jsonb'],
  ['pedido_prioridade_aplicar', 'uuid,boolean,boolean'],
];
const sig = ([n, a]) => `public.${n}(${a})`;

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
// null when the call was ACCEPTED (which for a helper is the defect).
function callAs(h, uid, sql, role = 'authenticated') {
  const r = run(h, asRole(uid, sql, role));
  return r.ok ? null : (r.err.split('\n').filter(Boolean)[0] || 'error');
}

function privilegeFingerprint(h) {
  return scalar(h, `
    WITH t AS (
      SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||
             r.rolname||'='||has_function_privilege(r.rolname, p.oid, 'EXECUTE')::text AS line
        FROM pg_proc p
        CROSS JOIN (SELECT unnest(ARRAY['anon','authenticated','service_role','postgres']) AS rolname) r
       WHERE p.pronamespace='public'::regnamespace
         AND p.proname IN (${[...RPCS, ...HELPERS].map(([n]) => `'${n}'`).join(',')})
    ) SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
}
function tableGrantFingerprint(h) {
  return scalar(h, `
    WITH t AS (
      SELECT grantee||' '||table_name||' '||privilege_type AS line
        FROM information_schema.role_table_grants
       WHERE table_schema='public'
         AND table_name IN ('pedidos','pedido_itens','pedido_alteracao_solicitacoes','pedido_alteracao_solicitacao_itens')
         AND grantee IN ('anon','authenticated','service_role','PUBLIC')
      UNION ALL
      SELECT 'POL '||polrelid::regclass::text||' '||polname||' '||polcmd::text FROM pg_policy
       WHERE polrelid::regclass::text IN ('pedidos','pedido_itens','pedido_alteracao_solicitacoes','pedido_alteracao_solicitacao_itens')
    ) SELECT md5(string_agg(line, E'\\n' ORDER BY line)) FROM t;`);
}

async function resolveManifest() {
  const dir = path.join(REPO_ROOT, 'db');
  return (await readdir(dir))
    .filter(f => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map(f => ({ n: Number(f.match(/^(\d+)_/)[1]), file: path.join(dir, f) }))
    .sort((a, b) => a.n - b.n);
}

function novoPedido(h, clienteId, status) {
  const id = scalar(h, `
    WITH p AS (INSERT INTO public.pedidos (cliente_id, status, data_pedido, prazo_entrega, observacao)
      VALUES (${clienteId}, '${status}', DATE '2026-03-01', DATE '2026-04-01', 'obs inicial') RETURNING id)
    SELECT id FROM p;`);
  must(h, `INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem, observacao)
    VALUES ('${id}', ${MOD_A}, 10.00, 0, 'item 1'), ('${id}', ${MOD_B}, 20.00, 1, 'item 2');`, 'itens');
  return id;
}
const itemIds = (h, p) => scalar(h,
  `SELECT string_agg(id::text, ',' ORDER BY ordem) FROM public.pedido_itens WHERE pedido_id='${p}';`)
  .split(',').filter(Boolean);
const snapshotOf = (h, p) => scalar(h, `SELECT public.pedido_snapshot('${p}')::text;`);

// ===========================================================================
// PART A — chain apply through db/93.
// ===========================================================================
async function partA(h) {
  const manifest = await resolveManifest();
  check(manifest.length === EXPECTED_TERMINAL,
    `manifest deve ser db/01..db/${EXPECTED_TERMINAL} (got ${manifest.length})`);
  check(path.basename(manifest.at(-1).file) === DB93, `terminal deve ser ${DB93}`);

  await applySql(h, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(h, 'corpus.sql', CORPUS_SQL, 'corpus');
    if (n === 93) {
      // PART E runs on the db/92 state, immediately BEFORE db/93 is applied.
      await applySql(h, 'atores.sql', ATORES_SQL, 'atores');
      partE(h);
    }
    applyFile(h, file, path.basename(file));
  }
  log('A', { migrations: manifest.length, terminal: EXPECTED_TERMINAL, applied: 'clean' });
}

// ===========================================================================
// PART E — reproduce the db/92 defect BEFORE the correction.
// ===========================================================================
let DEFECT = {};
function partE(h) {
  const alheio = novoPedido(h, CLI_B, 'confirmado');
  const ids = itemIds(h, alheio);
  const antes = snapshotOf(h, alheio);

  // Every helper is reachable by authenticated under db/92 alone.
  const abertos = HELPERS.filter(f => canExecute(h, 'authenticated', sig(f)));
  DEFECT.helpersAbertos = abertos.length;
  check(abertos.length === HELPERS.length,
    `db/92 deve expor TODOS os ${HELPERS.length} helpers a authenticated (got ${abertos.length})`);

  // Cross-tenant READ: client A reads client B's complete Pedido.
  const leitura = scalar(h, asRole(CLIENT_UID, `SELECT public.pedido_snapshot('${alheio}')::text;`));
  DEFECT.leituraCruzada = /"pedido_id"/.test(leitura);
  check(DEFECT.leituraCruzada,
    'db/92: pedido_snapshot deve vazar o Pedido de outro cliente (defeito reproduzido)');

  // Cross-tenant WRITE: client A rewrites client B's header.
  const escrita = callAs(h, CLIENT_UID,
    `SELECT public.pedido_header_aplicar('${alheio}', '{"observacao":"INVASAO"}'::jsonb);`);
  DEFECT.escritaCruzada = escrita === null
    && scalar(h, `SELECT observacao FROM public.pedidos WHERE id='${alheio}';`) === 'INVASAO';
  check(DEFECT.escritaCruzada,
    'db/92: pedido_header_aplicar deve permitir escrita cruzada (defeito reproduzido)');

  // Cross-tenant ITEM mutation: client A rewrites client B's item collection.
  const itens = callAs(h, CLIENT_UID,
    `SELECT public.pedido_itens_reconciliar('${alheio}',
       '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":999.0,"ordem":0}]'::jsonb);`);
  DEFECT.itensCruzados = itens === null
    && Number(scalar(h, `SELECT count(*) FROM public.pedido_itens WHERE pedido_id='${alheio}';`)) === 1;
  check(DEFECT.itensCruzados,
    'db/92: pedido_itens_reconciliar deve permitir mutacao cruzada (defeito reproduzido)');

  // Restore the victim so later parts start from a clean state.
  must(h, `DELETE FROM public.pedidos WHERE id='${alheio}';`, 'limpar vitima');
  check(antes.length > 0, 'snapshot lido');
  log('E', { defeito: 'REPRODUZIDO', helpersAbertos: abertos.length,
    leituraCruzada: DEFECT.leituraCruzada, escritaCruzada: DEFECT.escritaCruzada,
    itensCruzados: DEFECT.itensCruzados });
}

// ===========================================================================
// PART B — idempotent replay, zero privilege drift.
// ===========================================================================
function partB(h) {
  const before = privilegeFingerprint(h);
  const tBefore = tableGrantFingerprint(h);
  applyFile(h, path.join(REPO_ROOT, 'db', DB93), 'db/93 replay 1');
  applyFile(h, path.join(REPO_ROOT, 'db', DB93), 'db/93 replay 2');
  check(privilegeFingerprint(h) === before, 'db/93 deve reaplicar sem drift de privilegio');
  check(tableGrantFingerprint(h) === tBefore, 'db/93 nao pode mudar grant de tabela nem politica');
  log('B', { replays: 2, privDrift: 'none', tableDrift: 'none' });
}

// ===========================================================================
// PART C — db/93 fails closed without db/92.
// ===========================================================================
function partC(h) {
  must(h, 'DROP FUNCTION IF EXISTS public.pedido_snapshot(UUID) CASCADE;', 'drop pedido_snapshot');
  const err = applyFileExpectFailure(h, path.join(REPO_ROOT, 'db', DB93), 'db/93 sem db/92');
  check(/db\/93 gate/i.test(err) && /pedido_snapshot/i.test(err),
    `o gate deve nomear o pre-requisito ausente (got ${err})`);
  applyFile(h, path.join(REPO_ROOT, 'db', DB92), 'db/92 restore');
  applyFile(h, path.join(REPO_ROOT, 'db', DB93), 'db/93 after restore');
  log('C', { gate: 'fail-closed', restored: 'true' });
}

// ===========================================================================
// PART D + F — inventory and post-correction privilege state.
// ===========================================================================
function partDF(h) {
  const total = Number(scalar(h, `SELECT count(*) FROM pg_proc
     WHERE pronamespace='public'::regnamespace
       AND proname IN (${[...RPCS, ...HELPERS].map(([n]) => `'${n}'`).join(',')});`));
  check(total === 22, `o inventario de db/92 deve ser 22 funcoes (got ${total})`);
  check(RPCS.length === 8 && HELPERS.length === 14, 'o inventario deve ser 8 publicas + 14 internas');

  for (const f of RPCS) {
    check(canExecute(h, 'authenticated', sig(f)), `RPC ${f[0]} deve permanecer executavel por authenticated`);
    check(!canExecute(h, 'anon', sig(f)), `RPC ${f[0]} NAO pode ser executavel por anon`);
    check(canExecute(h, 'postgres', sig(f)), `RPC ${f[0]} deve continuar executavel pelo dono`);
  }
  for (const f of HELPERS) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      check(!canExecute(h, role, sig(f)), `helper ${f[0]} NAO pode ser executavel por ${role}`);
    }
    check(canExecute(h, 'postgres', sig(f)), `helper ${f[0]} deve continuar executavel pelo dono`);
  }
  // PUBLIC must hold nothing on any of the 22.
  const pub = Number(scalar(h, `SELECT count(*) FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace
       AND p.proname IN (${[...RPCS, ...HELPERS].map(([n]) => `'${n}'`).join(',')})
       AND array_to_string(coalesce(p.proacl,'{}')::text[], ',') LIKE '%=X/%'
       AND array_to_string(coalesce(p.proacl,'{}')::text[], ',') LIKE '%"=X/%';`));
  check(pub === 0, `nenhuma das 22 funcoes pode conceder EXECUTE a PUBLIC (got ${pub})`);
  log('D/F', { inventario: 22, publicas: 8, internas: 14, helpersFechados: HELPERS.length, donoOk: true });
}

// ===========================================================================
// PART G — direct helper calls are denied, cross-tenant included.
// ===========================================================================
function partG(h) {
  const meu = novoPedido(h, CLI_A, 'confirmado');
  const alheio = novoPedido(h, CLI_B, 'confirmado');
  const idsAlheio = itemIds(h, alheio);
  const snapAlheio = snapshotOf(h, alheio);
  const snapMeu = snapshotOf(h, meu);

  const chamadas = [
    ['pedido_snapshot', `SELECT public.pedido_snapshot('${alheio}');`],
    ['pedido_tem_op_relacionada', `SELECT public.pedido_tem_op_relacionada('${alheio}');`],
    ['pedido_item_tem_vinculo_producao', `SELECT public.pedido_item_tem_vinculo_producao('${idsAlheio[0]}');`],
    ['pedido_itens_sequencia', `SELECT public.pedido_itens_sequencia('${alheio}');`],
    ['pedido_itens_payload_normalizar', `SELECT public.pedido_itens_payload_normalizar('${alheio}', '[]'::jsonb);`],
    ['pedido_itens_payload_e_estrutural', `SELECT public.pedido_itens_payload_e_estrutural('${alheio}', '[]'::jsonb);`],
    ['pedido_header_validar', `SELECT public.pedido_header_validar('{}'::jsonb, 'admin');`],
    ['pedido_header_aplicar', `SELECT public.pedido_header_aplicar('${alheio}', '{"observacao":"INVASAO"}'::jsonb);`],
    ['pedido_itens_reconciliar', `SELECT public.pedido_itens_reconciliar('${alheio}', '[{"modelo_id":${MOD_A},"metros":5.0,"ordem":0}]'::jsonb);`],
    ['pedido_prioridade_aplicar', `SELECT public.pedido_prioridade_aplicar('${alheio}', true, false);`],
    ['pedidos_revisao_normalize_fn', 'SELECT public.pedidos_revisao_normalize_fn();'],
    ['pedido_itens_revisao_bump_fn', 'SELECT public.pedido_itens_revisao_bump_fn();'],
    ['pedido_alteracao_imutabilidade_guard_fn', 'SELECT public.pedido_alteracao_imutabilidade_guard_fn();'],
    ['pedido_alteracao_itens_imutabilidade_guard_fn', 'SELECT public.pedido_alteracao_itens_imutabilidade_guard_fn();'],
  ];
  check(chamadas.length === HELPERS.length, 'cada helper interno precisa de uma chamada direta provada');

  for (const [nome, sql] of chamadas) {
    for (const [uid, role] of [[CLIENT_UID, 'authenticated'], [null, 'anon'], [null, 'service_role']]) {
      const err = callAs(h, uid, sql, role);
      check(err !== null, `${nome}: chamada direta como ${role} deveria ser NEGADA`);
      check(/permission denied|permissao negada|permiss/i.test(err),
        `${nome} como ${role}: a recusa deve ser de permissao (got ${err})`);
    }
  }

  // And nothing leaked or changed.
  check(snapshotOf(h, alheio) === snapAlheio, 'nenhuma chamada direta pode ter mudado o Pedido alheio');
  check(snapshotOf(h, meu) === snapMeu, 'nenhuma chamada direta pode ter mudado o proprio Pedido');
  check(scalar(h, `SELECT observacao FROM public.pedidos WHERE id='${alheio}';`) === 'obs inicial',
    'o cabecalho alheio deve permanecer intacto');
  check(Number(scalar(h, `SELECT count(*) FROM public.pedido_itens WHERE pedido_id='${alheio}';`)) === 2,
    'a colecao de itens alheia deve permanecer intacta');
  log('G', { helpersNegados: chamadas.length, papeis: 3, leituraCruzada: 'negada', escritaCruzada: 'negada' });
}

// ===========================================================================
// PART H + I — the eight RPCs still work, through their internal helpers.
// ===========================================================================
function partHI(h) {
  // salvar_pedido_cliente: own unaccepted Pedido, exercising normalizar +
  // e_estrutural + reconciliar + header_aplicar + revisao triggers.
  const meu = novoPedido(h, CLI_A, 'recebido');
  const ids = itemIds(h, meu);
  const rev0 = Number(scalar(h, `SELECT revisao FROM public.pedidos WHERE id='${meu}';`));
  const okCli = scalar(h, asRole(CLIENT_UID, `SELECT public.salvar_pedido_cliente('${meu}', ${rev0},
    '{"observacao":"via rpc"}'::jsonb,
    '[{"pedido_item_id":"${ids[0]}","modelo_id":${MOD_A},"metros":33.0},
      {"pedido_item_id":"${ids[1]}","modelo_id":${MOD_B},"metros":20.0}]'::jsonb, NULL)::text;`));
  check(/"ok"\s*:\s*true/.test(okCli), `salvar_pedido_cliente deve continuar funcionando (got ${okCli})`);
  check(Number(scalar(h, `SELECT metros FROM public.pedido_itens WHERE pedido_id='${meu}' AND ordem=0;`)) === 33,
    'o helper de reconciliacao deve ter funcionado atraves da RPC');
  const rev1 = Number(scalar(h, `SELECT revisao FROM public.pedidos WHERE id='${meu}';`));
  check(rev1 > rev0, `os gatilhos de revisao devem continuar disparando (${rev0} -> ${rev1})`);

  // Ownership still enforced by the RPC itself.
  const alheio = novoPedido(h, CLI_B, 'recebido');
  const errDono = callAs(h, CLIENT_UID,
    `SELECT public.salvar_pedido_cliente('${alheio}', NULL, '{"observacao":"x"}'::jsonb, NULL, NULL);`);
  check(errDono && /PEDIDO_ALTERACAO_FORBIDDEN/.test(errDono),
    `a RPC deve continuar validando propriedade (got ${errDono})`);

  // salvar_pedido_admin + role check.
  const okAdm = scalar(h, asRole(ADMIN_UID,
    `SELECT public.salvar_pedido_admin('${meu}', NULL, '{"referencia_cliente":"REF-C1"}'::jsonb, NULL, NULL, false)::text;`));
  check(/"ok"\s*:\s*true/.test(okAdm), `salvar_pedido_admin deve continuar funcionando (got ${okAdm})`);
  const errAdm = callAs(h, CLIENT_UID, `SELECT public.salvar_pedido_admin('${meu}', NULL, NULL, NULL, NULL, false);`);
  check(errAdm && /PEDIDO_ALTERACAO_FORBIDDEN/.test(errAdm), `a RPC admin deve continuar recusando cliente (got ${errAdm})`);

  // Request lifecycle: submission captures the snapshot INTERNALLY, admin
  // comparison obtains its data internally, approval and rejection unchanged.
  must(h, `UPDATE public.pedidos SET status='confirmado' WHERE id='${meu}';`, 'aceitar');
  const sol = scalar(h, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${meu}', '{"observacao":"pedido c1"}'::jsonb, NULL, NULL, 'm')->>'solicitacao_id');`));
  check(/^[0-9a-f-]{36}$/.test(sol), `solicitar_alteracao_pedido deve continuar funcionando (got ${sol})`);
  const snapGravado = scalar(h,
    `SELECT (base_snapshot ? 'itens')::text FROM public.pedido_alteracao_solicitacoes WHERE id='${sol}';`);
  check(isTrue(snapGravado), 'a submissao deve continuar capturando a imagem-anterior internamente');

  const cmp = scalar(h, asRole(ADMIN_UID, `SELECT public.admin_alteracao_comparacao('${sol}')::text;`));
  check(/"ok"\s*:\s*true/.test(cmp) && /"antes"/.test(cmp) && /"atual"/.test(cmp) && /"tem_op_relacionada"/.test(cmp),
    'a comparacao administrativa deve continuar obtendo antes, atual e impacto internamente');

  const resumo = scalar(h, asRole(CLIENT_UID, `SELECT public.cliente_alteracao_resumo('${meu}')::text;`));
  check(/"ok"\s*:\s*true/.test(resumo), 'cliente_alteracao_resumo deve continuar funcionando');

  const ap = scalar(h, asRole(ADMIN_UID, `SELECT public.aprovar_alteracao_pedido('${sol}', false, 'ok')::text;`));
  check(/"ok"\s*:\s*true/.test(ap), `aprovar_alteracao_pedido deve continuar funcionando (got ${ap})`);
  check(scalar(h, `SELECT observacao FROM public.pedidos WHERE id='${meu}';`) === 'pedido c1',
    'a aprovacao deve continuar aplicando pelo helper de cabecalho');

  const sol2 = scalar(h, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${meu}', '{"observacao":"rejeitar"}'::jsonb, NULL, NULL, 'r')->>'solicitacao_id');`));
  const antesRej = snapshotOf(h, meu);
  scalar(h, asRole(ADMIN_UID, `SELECT public.rejeitar_alteracao_pedido('${sol2}', 'nao');`));
  check(scalar(h, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${sol2}';`) === 'rejeitada',
    'rejeitar_alteracao_pedido deve continuar funcionando');
  check(snapshotOf(h, meu) === antesRej, 'a rejeicao deve continuar sem tocar o Pedido');

  const sol3 = scalar(h, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${meu}', '{"observacao":"retirar"}'::jsonb, NULL, NULL, 'w')->>'solicitacao_id');`));
  scalar(h, asRole(CLIENT_UID, `SELECT public.retirar_alteracao_pedido('${sol3}');`));
  check(scalar(h, `SELECT status FROM public.pedido_alteracao_solicitacoes WHERE id='${sol3}';`) === 'retirada',
    'retirar_alteracao_pedido deve continuar funcionando');

  check(alheio.length === 36, 'fixture alheia criada');
  log('H/I', { rpcs: 8, reconciliar: 'ok via rpc', snapshot: 'ok via rpc', gatilhos: 'ok',
    propriedade: 'validada', papelAdmin: 'validado' });
}

// ===========================================================================
// PART J — no table DML privilege restored.
// ===========================================================================
function partJ(h) {
  for (const t of ['pedido_alteracao_solicitacoes', 'pedido_alteracao_solicitacao_itens']) {
    for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
      check(!isTrue(scalar(h, `SELECT has_table_privilege('authenticated', 'public.${t}', '${priv}');`)),
        `authenticated NAO pode ${priv} direto em ${t}`);
      check(!isTrue(scalar(h, `SELECT has_table_privilege('anon', 'public.${t}', '${priv}');`)),
        `anon NAO pode ${priv} direto em ${t}`);
    }
    check(isTrue(scalar(h, `SELECT has_table_privilege('authenticated', 'public.${t}', 'SELECT');`)),
      `authenticated deve manter SELECT em ${t}`);
  }
  const pols = Number(scalar(h, `SELECT count(*) FROM pg_policy
     WHERE polrelid IN ('public.pedidos'::regclass,'public.pedido_itens'::regclass,
       'public.pedido_alteracao_solicitacoes'::regclass,'public.pedido_alteracao_solicitacao_itens'::regclass);`));
  check(pols === 10, `o conjunto de politicas deve permanecer 10 (3+3+2+2), got ${pols}`);
  log('J', { dmlRestaurado: 'nenhum', politicas: pols });
}

// ===========================================================================
async function main() {
  let h = null;
  try {
    SCRATCH = await mkdtemp(path.join(tmpdir(), 'g28-c1-'));
    h = await bootstrapCluster({});
    log('CLUSTER', { host: h.host, port: h.port, pg: h.pgVersion });

    await partA(h);
    partB(h);
    partC(h);
    partDF(h);
    partG(h);
    partHI(h);
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
