// tests/pedido-alteracao-client-direct-select-acl-invariant.mjs
//
// PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS-R1 disposable-cluster
// proof of db/114_pedido_alteracao_client_direct_select_column_acl.sql.
//
// ENVIRONMENT: disposable local PostgreSQL ONLY
// (scripts/c3d/bootstrap-disposable-cluster.mjs). This harness NEVER connects to
// any shared/remote/managed host, contains no credential/token/project URL, and
// destroys its cluster before process exit. Every fixture is synthetic and is
// built inside the disposable cluster; NO production data is used and NO
// production request is ever created.
//
// SCOPE OF THE APPLIED CHAIN. This proof applies db/01..db/94 and then db/114.
// db/95..db/113 are deliberately NOT applied: none of them creates, alters or
// reads the two request tables through an application role, and db/114 declares
// db/92 (tables, RLS, RPCs) and db/94 (cliente_alteracao_resumo) as its only
// dependencies. The repository-wide contiguity of the migration manifest is
// owned by tests/ordem-compra-c3d-deploy.smoke.js, not by this focused proof.
//
// WHAT THIS PROVES, on ONE fresh disposable cluster (then destroyed, Part Z):
//   A  db/01..db/94 apply cleanly, in order, and the PRE-correction ACL shape
//      is exactly the measured debt: table-level SELECT to authenticated on
//      BOTH request tables and zero column-level grants.
//   B  the DEFECT IS REPRODUCED, not assumed: before db/114 a Client that owns
//      the request row directly reads base_snapshot, base_revisao,
//      solicitante_id and falha_identificador through a plain SELECT, and
//      directly reads the whole proposed item collection.
//   C  db/114 applies and no table-level authenticated SELECT survives.
//   D  ONLY the four approved columns are directly selectable by authenticated
//      on pedido_alteracao_solicitacoes, and NOTHING at all on
//      pedido_alteracao_solicitacao_itens.
//   E  every named internal column is DENIED to authenticated — measured as a
//      real refused SELECT, not only as a catalogue fact.
//   F  the Admin bounded pending-request discovery of js/screens/
//      pedido-detail-data.js still returns its exact three columns under its
//      exact two filters.
//   G  the Client sanctioned read cliente_alteracao_resumo() still works and
//      still carries the sanitized payload.
//   H  admin_alteracao_comparacao() remains usable by the admin authority and
//      still refuses a non-admin.
//   I  the server-owned writers still work end to end (submit, withdraw,
//      submit, reject) with the caller holding only column-level SELECT.
//   J  RLS row scope is UNCHANGED: a Client sees its own request row through
//      the granted columns and sees nothing of another Client's.
//   K  no mutation privilege was introduced, anon gains nothing, and
//      service_role/postgres keep the access the SECURITY DEFINER owners need.
//   L  db/114 replays with zero ACL drift, and its gate fails closed on a
//      materially different topology.
//   Z  mandatory full cluster destruction.
//
// Run:  node tests/pedido-alteracao-client-direct-select-acl-invariant.mjs
// Exits nonzero on any missing or failed proof.

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';

const REPO_ROOT = getRepoRoot();
const CHAIN_TERMINAL = 94;
const DB114 = '114_pedido_alteracao_client_direct_select_column_acl.sql';

// THE BINDING MINIMUM. A drift here is a contract change, not a test detail:
// it is the exact set derived from the active direct-consumer call graph in
// js/screens/pedido-detail-data.js and nothing else.
const APROVADAS = ['criado_em', 'id', 'pedido_id', 'status']; // sorted
// Columns the accepted Phase 4 Client information boundary keeps server-side.
const INTERNAS = [
  'base_snapshot', 'base_revisao', 'solicitante_id', 'solicitante_papel',
  'falha_identificador', 'decidido_por', 'decisao_motivo', 'decidido_em',
  'atualizado_em', 'mensagem_cliente', 'campos_alterados', 'itens_propostos',
  'proposto_prazo_entrega', 'proposto_referencia_cliente',
  'proposto_tipo_recebimento', 'proposto_observacao',
  'proposto_prioridade_habilitada',
];

// The db/92 phase harness already owns the platform preamble, the db/67 corpus
// and the actor fixture. Reusing its literals keeps ONE definition of each and
// guarantees this suite cannot silently drift from the phase it corrects.
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

const ATORES_SQL = between('const ATORES_SQL = `', '`;')
  .replace(/\$\{CLI_A\}/g, String(CLI_A)).replace(/\$\{CLI_B\}/g, String(CLI_B))
  .replace(/\$\{MOD_A\}/g, String(MOD_A)).replace(/\$\{MOD_B\}/g, String(MOD_B))
  .replace(/\$\{ADMIN_UID\}/g, ADMIN_UID)
  .replace(/\$\{CLIENT_UID\}/g, CLIENT_UID)
  .replace(/\$\{OTHER_UID\}/g, OTHER_UID)
  .replace(/\$\{FORN_UID\}/g, FORN_UID);

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
  return (r.stderr || '').split('\n').filter(Boolean).join(' ');
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

// Runs sql under an application role. Returns { ok, out, err }.
function tryAs(h, uid, sql, role = 'authenticated') {
  return run(h, asRole(uid, sql, role));
}
// Runs sql under an application role and REQUIRES it to be refused. Returns the
// first error line. A silently accepted read is the defect, so it fails loud.
function denied(h, uid, sql, label, role = 'authenticated') {
  const r = tryAs(h, uid, sql, role);
  check(!r.ok, `${label}: deveria ser NEGADO, mas foi aceito (out=${r.out})`);
  return r.err.split('\n').filter(Boolean)[0] || 'error';
}
// Runs sql under an application role and REQUIRES it to succeed.
function allowed(h, uid, sql, label, role = 'authenticated') {
  const r = tryAs(h, uid, sql, role);
  check(r.ok, `${label}: deveria ser PERMITIDO, mas foi negado (${r.err || r.out})`);
  return r.out;
}

const SOL = 'public.pedido_alteracao_solicitacoes';
const ITENS = 'public.pedido_alteracao_solicitacao_itens';

// Privilege is measured with the documented inquiry functions, never with
// aclexplode: aclexplode REFUSES an empty ACL array, and `attacl` is NULL for
// every column that carries no column-level grant. `has_table_privilege` is
// TABLE-level only; `has_any_column_privilege` is the union of table and
// column. Part C proves that distinction at runtime rather than assuming it.
const ROLES_PRIV_TABELA = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
const ROLES_PRIV_COLUNA = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];

function tableSelect(h, rel, role) {
  return isTrue(scalar(h, `SELECT has_table_privilege('${role}','${rel}','SELECT');`));
}
// Columns actually READABLE by a role. While the table-level grant survives
// this is every column, which is exactly the PRE-correction description.
function readableColumns(h, rel, role) {
  const out = scalar(h, `
    SELECT coalesce(string_agg(attname, ',' ORDER BY attname), '')
      FROM pg_attribute
     WHERE attrelid = '${rel}'::regclass AND attnum > 0 AND NOT attisdropped
       AND has_column_privilege('${role}', '${rel}', attname, 'SELECT');`);
  return out ? out.split(',') : [];
}
// Columns carrying an explicit column-level GRANT of any kind. NULL-safe and
// aclexplode-free.
function columnGrants(h, rel) {
  const out = scalar(h, `
    SELECT coalesce(string_agg(attname, ',' ORDER BY attname), '')
      FROM pg_attribute
     WHERE attrelid = '${rel}'::regclass AND attnum > 0 AND NOT attisdropped
       AND attacl IS NOT NULL;`);
  return out ? out.split(',') : [];
}
// Every privilege type a role holds on a relation, table-level or column-level.
function allPrivileges(h, rel, role) {
  const tbl = ROLES_PRIV_TABELA.map(p => `has_table_privilege('${role}','${rel}','${p}') AS t_${p}`);
  const col = ROLES_PRIV_COLUNA.map(p => `has_any_column_privilege('${role}','${rel}','${p}') AS c_${p}`);
  const row = scalar(h, `SELECT ${[...tbl, ...col].join(', ')};`).split('|');
  const names = [...ROLES_PRIV_TABELA.map(p => `TABLE_${p}`), ...ROLES_PRIV_COLUNA.map(p => `COLUMN_${p}`)];
  return names.filter((_, i) => isTrue(row[i]));
}
// The full ACL + RLS fingerprint of both request tables. Used for drift.
function aclFingerprint(h) {
  const probes = [];
  for (const rel of [SOL, ITENS]) {
    for (const role of ['anon', 'authenticated', 'service_role', 'postgres']) {
      for (const p of ROLES_PRIV_TABELA) {
        probes.push(`'T ${rel} ${role} ${p}='||has_table_privilege('${role}','${rel}','${p}')::text`);
      }
      for (const p of ROLES_PRIV_COLUNA) {
        probes.push(`'A ${rel} ${role} ${p}='||has_any_column_privilege('${role}','${rel}','${p}')::text`);
      }
    }
  }
  return scalar(h, `
    WITH t AS (
      SELECT unnest(ARRAY[${probes.join(',')}]) AS line
      UNION ALL
      SELECT 'C '||attrelid::regclass::text||'.'||attname||' '||attacl::text
        FROM pg_attribute
       WHERE attrelid IN ('${SOL}'::regclass, '${ITENS}'::regclass)
         AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL
      UNION ALL
      SELECT 'POL '||polrelid::regclass::text||' '||polname||' '||polcmd::text||' '||
             coalesce(pg_get_expr(polqual, polrelid), '')
        FROM pg_policy WHERE polrelid IN ('${SOL}'::regclass, '${ITENS}'::regclass)
      UNION ALL
      SELECT 'RLS '||relname||' '||relrowsecurity::text FROM pg_class
       WHERE oid IN ('${SOL}'::regclass, '${ITENS}'::regclass)
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
    WITH p AS (
      INSERT INTO public.pedidos (cliente_id, status, data_pedido, prazo_entrega, observacao)
      VALUES (${clienteId}, '${status}', DATE '2026-03-01', DATE '2026-04-01', 'obs inicial')
      RETURNING id)
    SELECT id FROM p;`);
  must(h, `
    INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, ordem, observacao)
    VALUES ('${id}', ${MOD_A}, 10.00, 0, 'item 1'),
           ('${id}', ${MOD_B}, 20.00, 1, 'item 2');`, 'itens do pedido');
  return id;
}

// ===========================================================================
// PART A — chain apply and the PRE-correction ACL shape.
// ===========================================================================
async function partA(h) {
  const manifest = (await resolveManifest()).filter(m => m.n <= CHAIN_TERMINAL);
  check(manifest.at(-1).n === CHAIN_TERMINAL,
    `a cadeia base deve terminar em db/${CHAIN_TERMINAL}`);
  check(fs.existsSync(path.join(REPO_ROOT, 'db', DB114)), `${DB114} deve existir no repositorio`);

  await applySql(h, 'preamble.sql', PREAMBLE_SQL, 'preamble');
  for (const { n, file } of manifest) {
    if (n === 67) await applySql(h, 'corpus.sql', CORPUS_SQL, 'corpus (after db/66, before db/67)');
    applyFile(h, file, path.basename(file));
  }
  await applySql(h, 'atores.sql', ATORES_SQL, 'atores');

  // A ACL de entrada e EXATAMENTE a divida medida em producao.
  check(tableSelect(h, SOL, 'authenticated'), 'PRE: authenticated deve ter SELECT de TABELA no cabecalho');
  check(tableSelect(h, ITENS, 'authenticated'), 'PRE: authenticated deve ter SELECT de TABELA nos itens');
  check(columnGrants(h, SOL).length === 0, 'PRE: nao pode haver GRANT de coluna no cabecalho');
  check(columnGrants(h, ITENS).length === 0, 'PRE: nao pode haver GRANT de coluna nos itens');
  // Com o grant de TABELA vivo, TODAS as colunas sao legiveis. E a divida.
  const legiveisPre = readableColumns(h, SOL, 'authenticated');
  check(legiveisPre.length === 21 && legiveisPre.includes('base_snapshot'),
    `PRE: todas as 21 colunas devem ser legiveis (got ${legiveisPre.length})`);
  log('A', {
    migrations: manifest.length, terminal: CHAIN_TERMINAL,
    pre_sol: 'TABLE_SELECT', pre_itens: 'TABLE_SELECT',
    pre_colunas_grant: 0, pre_colunas_legiveis: legiveisPre.length,
  });
}

// ===========================================================================
// PART B — the defect is REPRODUCED before it is corrected.
// ===========================================================================
function partB(h) {
  const pedido = novoPedido(h, CLI_A, 'confirmado');
  const sol = scalar(h, asRole(CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${pedido}',
       '{"observacao":"proposta do cliente"}'::jsonb,
       '[{"modelo_id":${MOD_A},"metros":11.0},{"modelo_id":${MOD_B},"metros":22.0}]'::jsonb,
       NULL, 'justificativa')->>'solicitacao_id');`));
  check(/^[0-9a-f-]{36}$/.test(sol), `a fixture deve criar uma solicitacao (got ${sol})`);

  // O Cliente DONO da linha le colunas internas por SELECT direto. Esta e a
  // divida PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS.
  const snap = allowed(h, CLIENT_UID,
    `SELECT (base_snapshot ? 'itens')::text FROM ${SOL} WHERE id='${sol}';`,
    'PRE: leitura direta de base_snapshot');
  check(isTrue(snap), `PRE: base_snapshot deve ser legivel e conter itens (got ${snap})`);
  allowed(h, CLIENT_UID, `SELECT base_revisao FROM ${SOL} WHERE id='${sol}';`,
    'PRE: leitura direta de base_revisao');
  allowed(h, CLIENT_UID, `SELECT solicitante_id FROM ${SOL} WHERE id='${sol}';`,
    'PRE: leitura direta de solicitante_id');
  allowed(h, CLIENT_UID, `SELECT falha_identificador FROM ${SOL} WHERE id='${sol}';`,
    'PRE: leitura direta de falha_identificador');
  const nItens = allowed(h, CLIENT_UID,
    `SELECT count(*)::text FROM ${ITENS} WHERE solicitacao_id='${sol}';`,
    'PRE: leitura direta da colecao proposta');
  check(Number(nItens) === 2, `PRE: a colecao proposta deve ser legivel (got ${nItens})`);

  log('B', { defeito: 'REPRODUZIDO', base_snapshot: 'LEGIVEL', itens_propostos_lidos: nItens });
  return { pedido, sol };
}

// ===========================================================================
// PART C + D — db/114 applies; table SELECT gone, exact column set present.
// ===========================================================================
function partCD(h) {
  applyFile(h, path.join(REPO_ROOT, 'db', DB114), 'db/114');

  check(!tableSelect(h, SOL, 'authenticated'), 'C: nenhum SELECT de TABELA pode sobreviver no cabecalho');
  check(!tableSelect(h, ITENS, 'authenticated'), 'C: nenhum SELECT de TABELA pode sobreviver nos itens');

  // A distincao load-bearing, medida e nao presumida: has_table_privilege caiu
  // para false enquanto has_column_privilege continua true nas quatro colunas.
  // Se has_table_privilege incluisse grant de coluna, esta checagem falharia.
  const cols = readableColumns(h, SOL, 'authenticated');
  check(JSON.stringify(cols) === JSON.stringify(APROVADAS),
    `D: colunas legiveis devem ser exatamente ${APROVADAS.join(',')} (got ${cols.join(',')})`);
  const grants = columnGrants(h, SOL);
  check(JSON.stringify(grants) === JSON.stringify(APROVADAS),
    `D: GRANT de coluna deve cobrir exatamente ${APROVADAS.join(',')} (got ${grants.join(',')})`);
  const itCols = readableColumns(h, ITENS, 'authenticated');
  check(itCols.length === 0, `D: os itens propostos nao podem ser legiveis (got ${itCols.join(',')})`);
  check(columnGrants(h, ITENS).length === 0, 'D: os itens propostos nao podem ter GRANT de coluna');

  log('C+D', {
    table_select: 'REVOGADO', colunas_legiveis: cols.join(','),
    colunas_grant: grants.length, itens: 'NENHUMA',
  });
}

// ===========================================================================
// PART E — every internal column is really refused, measured one by one.
// ===========================================================================
function partE(h, sol) {
  const negadas = [];
  for (const col of INTERNAS) {
    const err = denied(h, CLIENT_UID, `SELECT ${col} FROM ${SOL} WHERE id='${sol}';`,
      `E: coluna interna ${col}`);
    check(/permission denied|permissao negada|permissão negada/i.test(err),
      `E: ${col} deve ser negada por privilegio, nao por outro erro (got ${err})`);
    negadas.push(col);
  }
  // SELECT * e' a forma mais provavel de uma consulta a mao. Tambem negada.
  denied(h, CLIENT_UID, `SELECT * FROM ${SOL} WHERE id='${sol}';`, 'E: SELECT *');
  // A colecao proposta inteira desaparece do alcance direto.
  const errIt = denied(h, CLIENT_UID, `SELECT count(*) FROM ${ITENS} WHERE solicitacao_id='${sol}';`,
    'E: colecao proposta');
  check(/permission denied|permissao negada|permissão negada/i.test(errIt),
    `E: a colecao proposta deve ser negada por privilegio (got ${errIt})`);
  // Um filtro sobre coluna interna tambem e' negado: WHERE conta como leitura.
  denied(h, CLIENT_UID, `SELECT id FROM ${SOL} WHERE base_revisao > 0;`,
    'E: filtro sobre coluna interna');

  log('E', { internas_negadas: negadas.length, select_star: 'NEGADO', itens: 'NEGADO', where_interno: 'NEGADO' });
}

// ===========================================================================
// PART F — the Admin bounded discovery still works, byte for byte.
// ===========================================================================
function partF(h, pedido, sol) {
  // A consulta EXATA de js/screens/pedido-detail-data.js: projecao id/status/
  // criado_em, filtros pedido_id e status, limite 1.
  const out = allowed(h, ADMIN_UID,
    `SELECT id::text||'|'||status||'|'||(criado_em IS NOT NULL)::text
       FROM ${SOL} WHERE pedido_id='${pedido}' AND status='pendente' LIMIT 1;`,
    'F: descoberta administrativa limitada');
  check(out === `${sol}|pendente|true`,
    `F: a descoberta deve devolver a solicitacao pendente (got ${out})`);

  // O admin tambem passa por `authenticated`: a ACL de coluna vale para ele, e
  // nao existe desvio administrativo de navegador.
  denied(h, ADMIN_UID, `SELECT base_snapshot FROM ${SOL} WHERE id='${sol}';`,
    'F: o admin tambem nao le coluna interna por SELECT direto');
  log('F', { descoberta: 'OK', admin_coluna_interna: 'NEGADA' });
}

// ===========================================================================
// PART G + H — the sanctioned server-owned readers still work.
// ===========================================================================
function partGH(h, pedido, sol) {
  const resumo = allowed(h, CLIENT_UID,
    `SELECT public.cliente_alteracao_resumo('${pedido}')::text;`, 'G: cliente_alteracao_resumo');
  check(/"ok"\s*:\s*true/.test(resumo), `G: o resumo do cliente deve responder ok (got ${resumo})`);
  check(/"solicitacao_id"\s*:\s*"/.test(resumo) && /"status"\s*:\s*"pendente"/.test(resumo),
    'G: o resumo deve continuar entregando a solicitacao pendente sanitizada');
  // O contorno sanitizado continua sendo o contorno: nada interno vaza por ele.
  check(!/base_snapshot|base_revisao|falha_identificador|solicitante_id/.test(resumo),
    'G: o resumo sanitizado nao pode passar a expor coluna interna');

  const comp = allowed(h, ADMIN_UID,
    `SELECT public.admin_alteracao_comparacao('${sol}')::text;`, 'H: admin_alteracao_comparacao');
  check(/"ok"\s*:\s*true/.test(comp), `H: a comparacao administrativa deve responder ok (got ${comp})`);
  // A autoridade continua sendo do servidor: o Cliente nao a alcanca. A RPC
  // recusa com um payload estavel `{ok:false, erro:...}` em vez de levantar
  // excecao, entao a prova mede a RECUSA, nao o modo de falha.
  const compCli = allowed(h, CLIENT_UID, `SELECT public.admin_alteracao_comparacao('${sol}')::text;`,
    'H: comparacao administrativa pedida pelo cliente');
  check(/"ok"\s*:\s*false/.test(compCli) && /FORBIDDEN/.test(compCli),
    `H: o cliente deve receber recusa explicita da comparacao administrativa (got ${compCli})`);
  check(!/base_snapshot|"antes"/.test(compCli),
    'H: a recusa nao pode carregar payload de comparacao');

  log('G+H', { resumo_cliente: 'OK', sanitizado: 'PRESERVADO', comparacao_admin: 'OK', cliente_na_comparacao: 'NEGADO' });
}

// ===========================================================================
// PART I — the server-owned writers still work under column-level SELECT.
// ===========================================================================
function partI(h, pedido, sol) {
  allowed(h, CLIENT_UID, `SELECT public.retirar_alteracao_pedido('${sol}');`, 'I: retirada pelo cliente');
  check(scalar(h, `SELECT status FROM ${SOL} WHERE id='${sol}';`) === 'retirada',
    'I: a retirada deve decidir a solicitacao');

  const sol2 = allowed(h, CLIENT_UID,
    `SELECT (public.solicitar_alteracao_pedido('${pedido}',
       '{"observacao":"segunda proposta"}'::jsonb, NULL, NULL, 'de novo')->>'solicitacao_id');`,
    'I: nova submissao pelo cliente');
  check(/^[0-9a-f-]{36}$/.test(sol2), `I: a submissao deve devolver um id (got ${sol2})`);

  allowed(h, ADMIN_UID, `SELECT public.rejeitar_alteracao_pedido('${sol2}', 'motivo do teste');`,
    'I: rejeicao pelo admin');
  check(scalar(h, `SELECT status FROM ${SOL} WHERE id='${sol2}';`) === 'rejeitada',
    'I: a rejeicao deve decidir a solicitacao');

  // O escritor servidor grava a coluna interna que o chamador NAO consegue ler.
  check(isTrue(scalar(h, `SELECT (decisao_motivo IS NOT NULL)::text FROM ${SOL} WHERE id='${sol2}';`)),
    'I: o dono servidor deve continuar gravando as colunas internas');
  log('I', { retirada: 'OK', submissao: 'OK', rejeicao: 'OK', escrita_interna: 'PRESERVADA' });
}

// ===========================================================================
// PART J — RLS row scope is unchanged.
// ===========================================================================
function partJ(h, pedido) {
  const meus = allowed(h, CLIENT_UID,
    `SELECT count(*)::text FROM ${SOL} WHERE pedido_id='${pedido}';`,
    'J: o cliente le as proprias linhas pelas colunas concedidas');
  check(Number(meus) >= 2, `J: o cliente deve enxergar o proprio historico (got ${meus})`);

  const alheios = allowed(h, OTHER_UID,
    `SELECT count(*)::text FROM ${SOL} WHERE pedido_id='${pedido}';`,
    'J: outro cliente consulta as linhas alheias');
  check(Number(alheios) === 0, `J: outro cliente nao pode enxergar linha alguma (got ${alheios})`);

  // O corte de coluna nao substituiu o corte de linha: os dois valem juntos.
  denied(h, OTHER_UID, `SELECT base_snapshot FROM ${SOL} WHERE pedido_id='${pedido}';`,
    'J: outro cliente pedindo coluna interna');
  log('J', { proprias: meus, alheias: alheios, rls: 'INALTERADA' });
}

// ===========================================================================
// PART K — no write privilege, no anon, server owners intact.
// ===========================================================================
function partK(h, sol) {
  for (const rel of [SOL, ITENS]) {
    const privs = allPrivileges(h, rel, 'authenticated');
    check(privs.every(p => p.endsWith('_SELECT')),
      `K: authenticated nao pode ter privilegio nao-SELECT em ${rel} (got ${privs.join(',')})`);
    check(!privs.includes('TABLE_SELECT'),
      `K: authenticated nao pode reter SELECT de TABELA em ${rel}`);
    const anonPrivs = allPrivileges(h, rel, 'anon');
    check(anonPrivs.length === 0,
      `K: anon nao pode ter privilegio algum em ${rel} (got ${anonPrivs.join(',')})`);
    for (const role of ['service_role', 'postgres']) {
      check(isTrue(scalar(h,
        `SELECT has_table_privilege('${role}','${rel}','SELECT,INSERT,UPDATE,DELETE');`)),
        `K: ${role} deve manter acesso completo a ${rel}`);
    }
  }
  // Escrita direta continua recusada na pratica, nao so no catalogo.
  denied(h, CLIENT_UID, `UPDATE ${SOL} SET status='aprovada' WHERE id='${sol}';`,
    'K: UPDATE direto pelo cliente');
  denied(h, ADMIN_UID, `UPDATE ${SOL} SET status='aprovada' WHERE id='${sol}';`,
    'K: UPDATE direto pelo admin');
  denied(h, ADMIN_UID, `INSERT INTO ${ITENS} (solicitacao_id, modelo_id, metros, ordem)
    VALUES ('${sol}', ${MOD_A}, 1.0, 99);`, 'K: INSERT direto pelo admin');
  denied(h, null, `SELECT count(*) FROM ${SOL};`, 'K: leitura anonima', 'anon');
  log('K', { escrita: 'NEGADA', anon: 'SEM_ACESSO', service_role: 'INTACTO', postgres: 'INTACTO' });
}

// ===========================================================================
// PART L — idempotent replay and fail-closed gate.
// ===========================================================================
function partL(h) {
  const before = aclFingerprint(h);
  applyFile(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 replay 1');
  applyFile(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 replay 2');
  const after = aclFingerprint(h);
  check(before === after, `L: db/114 deve reaplicar sem drift (${before} != ${after})`);

  // O gate recusa uma topologia materialmente diferente e NOMEIA o motivo.
  must(h, `GRANT SELECT (base_snapshot) ON ${SOL} TO authenticated;`, 'drift artificial');
  const err = applyFileExpectFailure(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 sobre drift');
  check(/db\/114 gate: forma de ACL inesperada/.test(err),
    `L: o gate deve nomear a forma inesperada (got ${err})`);
  must(h, `REVOKE SELECT (base_snapshot) ON ${SOL} FROM authenticated;`, 'desfaz drift artificial');

  // Depois de desfeito o drift, a migracao volta a aplicar e o estado converge.
  applyFile(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 apos reparo do drift');
  check(aclFingerprint(h) === before, 'L: o estado deve convergir para o mesmo fingerprint');

  // E o gate tambem recusa quando a RLS foi desabilitada.
  must(h, `ALTER TABLE ${SOL} DISABLE ROW LEVEL SECURITY;`, 'desabilita RLS');
  const errRls = applyFileExpectFailure(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 sem RLS');
  check(/db\/114 gate: ROW LEVEL SECURITY/.test(errRls),
    `L: o gate deve recusar sem RLS (got ${errRls})`);
  must(h, `ALTER TABLE ${SOL} ENABLE ROW LEVEL SECURITY;`, 'restaura RLS');
  applyFile(h, path.join(REPO_ROOT, 'db', DB114), 'db/114 apos restaurar RLS');
  check(aclFingerprint(h) === before, 'L: o estado final deve ser o mesmo fingerprint');

  log('L', { replays: 2, drift: 'none', gate_acl: 'FAIL_CLOSED', gate_rls: 'FAIL_CLOSED', fingerprint: before.slice(0, 12) });
}

// ===========================================================================
async function main() {
  let handle = null;
  SCRATCH = await mkdtemp(path.join(tmpdir(), 'pedido-alteracao-acl-'));
  try {
    handle = await bootstrapCluster();
    log('CLUSTER', { host: handle.host, port: handle.port, disposable: true });

    await partA(handle);
    const { pedido, sol } = partB(handle);
    partCD(handle);
    partE(handle, sol);
    partF(handle, pedido, sol);
    partGH(handle, pedido, sol);
    partI(handle, pedido, sol);
    partJ(handle, pedido);
    partK(handle, sol);
    partL(handle);

    log('RESULT', { failures: FAILURES, status: FAILURES === 0 ? 'ALL_PROOFS_PASSED' : 'FAILED' });
  } finally {
    // Z — destruicao obrigatoria do cluster, aconteca o que acontecer.
    if (handle) {
      await handle.stop();
      log('Z', { cluster: 'DESTROYED' });
    }
    await rm(SCRATCH, { recursive: true, force: true });
  }
  if (FAILURES > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
