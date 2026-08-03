// tests/db123-tecelagem-rolos.integration.mjs
//
// TECELAGEM-V1-FIRST-VERTICAL-SLICE — db/123 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase-platform preamble + the accepted 64-row corpus + the db
// migration manifest in exact order), installs a weaving fixture, takes a
// COMPLETE fingerprint of the pre-existing Admin domain, applies db/123, runs
// the acceptance scenarios, and re-takes the fingerprint to prove the weaving
// action changed nothing in the Admin domain.
//
// The complete observable flow is exercised end to end:
//
//   MINHAS OPs -> INICIAR PRODUCAO -> REGISTRAR 10 ROLOS -> VER 10 ROLOS
//
// on an OP the Admin never moved out of 'aberta' — which is what makes the
// isolation claim of this phase measurable rather than merely asserted.
//
// Out of scope by design, and enforced by construction: no remote host, no
// managed backend, no credential, no production contact of any kind. The only
// database this file can reach is the throwaway cluster it starts itself.
//
// Usage:  node tests/db123-tecelagem-rolos.integration.mjs [--terminal=NNN]

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL, ACTORS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();

const terminalArg = process.argv.find((a) => a.startsWith('--terminal='));
const TERMINAL = terminalArg ? Number(terminalArg.split('=')[1]) : 123;

// Synthetic weaving actors. Distinct id space from the P1 harness fixture so
// the two can never collide.
const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-00000000be01';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-00000000be02';
const FORN_TEC_ID     = 930000401;
const FORN_OUTRA_ID   = 930000402;
const OP_ID           = 930000501;   // em_producao no Admin — a OP de trabalho
const OP_PRONTA       = 930000502;   // aberta + pedido confirmado -> pode_iniciar
const OP_BLOQUEADA    = 930000503;   // aberta sem pedido         -> bloqueada
const OP_ITEM_A       = 930000511;
const OP_ITEM_B       = 930000512;
const OP_ITEM_C       = 930000513;   // produto da OP ainda NÃO em produção
const CLIENTE_ID      = 930000701;
const CLIENTE_NOME    = 'Felipe Grandi';
const LOTE_ID         = 930000801;
const PEDIDO_UUID     = '9d1f0000-0000-4000-8000-00000000fe01';

// ---------------------------------------------------------------------------
// Full migration manifest, letter suffixes included and correctly ordered
// (…103, 103b, 104, 105, 106a, 106b, 107…). The P1 harness resolver drops
// letter-suffixed files by design; this slice needs the complete history.
// ---------------------------------------------------------------------------
async function resolveFullManifest() {
  const dbDir = path.join(REPO_ROOT, 'db');
  const entries = await readdir(dbDir);
  return entries
    .filter((f) => /^\d{2,}[a-z]?_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f))
    .map((f) => {
      const m = f.match(/^(\d+)([a-z]?)_/);
      return { n: Number(m[1]), suffix: m[2] || '', file: path.join(dbDir, f), name: f };
    })
    .sort((a, b) => (a.n - b.n) || a.suffix.localeCompare(b.suffix));
}

// ---------------------------------------------------------------------------
// Weaving fixture: a tecelagem supplier bound to an OP at the 'cima' stage,
// two products on that OP, and a SECOND supplier used as the negative actor.
// ---------------------------------------------------------------------------
const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'tec-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'tec-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'TEC-V1 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'TEC-V1 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'tec-operador@example.invalid', 'Operador Tecelagem', 'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'tec-outro@example.invalid',    'Operador Alheio',    'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930000211, 'TEC-V1 KRAFT'),
  (930000212, 'TEC-V1 CRU')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura) VALUES
  (930000221, 'NOITE', 930000211, 930000212, 2.10)
  ON CONFLICT (id) DO NOTHING;

-- Cliente + pedido confirmado + lote: é por esta cadeia que a superfície de
-- tecelagem enxerga o CLIENTE da OP, e é dela que sai a elegibilidade.
INSERT INTO public.clientes (id, nome) VALUES (${CLIENTE_ID}, '${CLIENTE_NOME}')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pedidos (id, cliente_id, status)
  VALUES ('${PEDIDO_UUID}', ${CLIENTE_ID}, 'confirmado')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
  VALUES (${LOTE_ID}, 990801, ${CLIENTE_ID}, '${PEDIDO_UUID}')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID},        990003, 2026, 'em_producao', 'tecelagem', ${LOTE_ID}),
  (${OP_PRONTA},    990004, 2026, 'aberta',      'tecelagem', ${LOTE_ID}),
  (${OP_BLOQUEADA}, 990005, 2026, 'aberta',      'tecelagem', NULL)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${OP_ITEM_A}, ${OP_ID},     930000221, 4000.00),
  (${OP_ITEM_B}, ${OP_ID},     930000221, 1500.00),
  (${OP_ITEM_C}, ${OP_PRONTA}, 930000221,  800.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa) VALUES
  (${OP_ID},        ${FORN_TEC_ID}, 'cima'),
  (${OP_PRONTA},    ${FORN_TEC_ID}, 'cima'),
  (${OP_BLOQUEADA}, ${FORN_TEC_ID}, 'cima')
  ON CONFLICT DO NOTHING;

SET session_replication_role = origin;
`;

// ---------------------------------------------------------------------------
// Supabase re-grants ALL on every newly created public table and sequence
// through ALTER DEFAULT PRIVILEGES (recorded debt
// SUPABASE-DEFAULT-ACL-REGRANTS-FUTURE-PUBLIC-TABLES).
//
// This is installed in the PREAMBLE, before db/01, because that is how the real
// project has always behaved: every table in db/01..123 is created under a live
// default grant, and the migrations that REVOKE are written on that assumption.
// db/117's ACL verify FAILS without it — measured, not assumed — which is
// itself the proof that the preamble belongs here and not later.
//
// It also keeps db/123's own proof honest: its explicit REVOKE has to defeat a
// LIVE default grant, exactly as it will have to in production.
// ---------------------------------------------------------------------------
const SUPABASE_DEFAULT_ACL_SQL = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

// ---------------------------------------------------------------------------
// C3C CUTOVER STATE — REHEARSAL FIXTURE, NOT A MIGRATION EFFECT.
//
// db/117 onward assert that the purchase-order cutover is already in its
// post-cutover resting state (canonical_active / canonical / reconciled, PONR
// NOT crossed). That state was established by an OPERATIONAL cutover
// transaction, not by any migration, so a from-scratch replay of db/01..122 can
// never reach it on its own: db/117 fails closed without this.
//
// This fixture therefore reproduces the KNOWN production resting state so the
// remaining migrations can be replayed at all. It is a test fixture and is
// reported as one. It asserts the PONR stays NULL, so it cannot silently
// rehearse a crossed point of no return.
// ---------------------------------------------------------------------------
const CUTOVER_REHEARSAL_SQL = `
SET session_replication_role = replica;

UPDATE public.ordem_compra_cutover
   SET status                 = 'canonical_active',
       read_authority         = 'canonical',
       reconciliation_status  = 'reconciled',
       cutover_generation     = COALESCE(cutover_generation, 1),
       snapshot_captured_at   = COALESCE(snapshot_captured_at,  TIMESTAMPTZ '2026-01-01 00:00:00+00'),
       import_started_at      = COALESCE(import_started_at,     TIMESTAMPTZ '2026-01-01 00:10:00+00'),
       import_completed_at    = COALESCE(import_completed_at,   TIMESTAMPTZ '2026-01-01 00:20:00+00'),
       final_acl_closed_at    = COALESCE(final_acl_closed_at,   TIMESTAMPTZ '2026-01-01 00:30:00+00'),
       canonical_activated_at = COALESCE(canonical_activated_at,TIMESTAMPTZ '2026-01-01 00:40:00+00'),
       productive_receipt_started_at = NULL
 WHERE id = 1;

SET session_replication_role = origin;

DO $fx$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ordem_compra_cutover
     WHERE id = 1 AND status = 'canonical_active'
       AND read_authority = 'canonical' AND reconciliation_status = 'reconciled'
       AND productive_receipt_started_at IS NULL
  ) THEN
    RAISE EXCEPTION 'cutover rehearsal fixture did not reach canonical_active with the PONR uncrossed';
  END IF;
END
$fx$;
`;

// ---------------------------------------------------------------------------
// Admin-domain fingerprint.
//
// Captures, into schema `proof`, BOTH:
//   - the complete catalogue surface of every object that exists before
//     db/123 (tables, columns, constraints, triggers, functions, policies,
//     grants, RLS flags), and
//   - the full CONTENT of every pre-existing public table.
//
// Comparing the two snapshots is what proves criterion 10: the weaving action
// changed nothing that existed beforehand.
// ---------------------------------------------------------------------------
function snapshotSql(label) {
  return `
CREATE SCHEMA IF NOT EXISTS proof;

DROP TABLE IF EXISTS proof.snap_${label};
CREATE TABLE proof.snap_${label} (dominio TEXT, chave TEXT, valor TEXT);

-- Catalogue: columns
INSERT INTO proof.snap_${label}
SELECT 'coluna', table_name || '.' || column_name,
       data_type || '|' || is_nullable || '|' || COALESCE(column_default, '-')
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name NOT LIKE 'tecelagem\\_%';

-- Catalogue: constraints
INSERT INTO proof.snap_${label}
SELECT 'constraint', t.relname || '.' || c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE n.nspname = 'public' AND t.relname NOT LIKE 'tecelagem\\_%';

-- Catalogue: triggers (the single most important isolation surface)
INSERT INTO proof.snap_${label}
SELECT 'trigger', c.relname || '.' || tg.tgname, pg_get_triggerdef(tg.oid)
  FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT tg.tgisinternal AND n.nspname = 'public' AND c.relname NOT LIKE 'tecelagem\\_%';

-- Catalogue: function bodies.
-- The two functions db/123 OWNS are excluded, exactly as its three tables are:
-- the snapshot compares the PRE-EXISTING Admin domain, and a db/123 object
-- appearing is the migration doing its job, not drift. Everything else in
-- public is compared by body hash, so a single changed line in any existing
-- function would show up here.
INSERT INTO proof.snap_${label}
SELECT 'funcao', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       md5(pg_get_functiondef(p.oid))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'f'
   AND p.proname NOT IN ('registrar_producao_tecelagem', 'iniciar_producao_tecelagem',
                         '_tecelagem_op_pode_iniciar', 'tecelagem_minhas_ops');

-- Catalogue: RLS policies
INSERT INTO proof.snap_${label}
SELECT 'policy', tablename || '.' || policyname,
       COALESCE(qual, '-') || '|' || COALESCE(with_check, '-') || '|' || cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename NOT LIKE 'tecelagem\\_%';

-- Catalogue: table grants
INSERT INTO proof.snap_${label}
SELECT 'grant', table_name || '.' || grantee || '.' || privilege_type, 'y'
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name NOT LIKE 'tecelagem\\_%';

-- Catalogue: RLS enabled flags
INSERT INTO proof.snap_${label}
SELECT 'rls', c.relname, c.relrowsecurity::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE 'tecelagem\\_%';

-- CONTENT of every pre-existing public table, row-hashed and order-independent.
DO $content$
DECLARE
  r RECORD;
  v_hash TEXT;
  v_count BIGINT;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname NOT LIKE 'tecelagem\\_%'
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'SELECT count(*), COALESCE(md5(string_agg(h, '''' ORDER BY h)), ''vazio'') FROM (SELECT md5(t.*::text) AS h FROM public.%I t) s',
      r.relname
    ) INTO v_count, v_hash;
    INSERT INTO proof.snap_${label} VALUES ('conteudo', r.relname, v_count || ':' || v_hash);
  END LOOP;
END
$content$;
`;
}

const COMPARE_SQL = `
SELECT COALESCE(string_agg(linha, E'\\n'), 'IDENTICO') FROM (
  SELECT COALESCE(a.dominio, d.dominio) || ' ' || COALESCE(a.chave, d.chave) || ' :: ' ||
         COALESCE(a.valor, '<ausente antes>') || ' -> ' || COALESCE(d.valor, '<ausente depois>') AS linha
    FROM proof.snap_antes a
    FULL OUTER JOIN proof.snap_depois d
      ON d.dominio = a.dominio AND d.chave = a.chave
   WHERE a.valor IS DISTINCT FROM d.valor
   ORDER BY 1
) x;
`;

// ---------------------------------------------------------------------------

let failures = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  log(ok ? 'PASS' : 'FAIL', { caso: name, esperado: expected, obtido: actual });
  return ok;
}

async function main() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'db123-scratch-'));
  let handle = null;

  try {
    log('BOOT', { alvo: 'cluster local descartavel', terminal: `db/${TERMINAL}` });
    handle = await bootstrapCluster({});
    log('BOOT_OK', { host: handle.host, port: handle.port, db: handle.database });

    const manifest = (await resolveFullManifest()).filter((m) => m.n <= TERMINAL);
    const preamble = await writeTemp(scratch, 'preamble.sql', PREAMBLE_SQL + SUPABASE_DEFAULT_ACL_SQL);
    const cutoverFx = await writeTemp(scratch, 'cutover-fixture.sql', CUTOVER_REHEARSAL_SQL);
    const corpus = await writeTemp(scratch, 'corpus.sql', CORPUS_SQL);
    const actors = await writeTemp(scratch, 'actors.sql', ACTORS_SQL);
    const fixture = await writeTemp(scratch, 'fixture.sql', FIXTURE_SQL);
    const snapAntes = await writeTemp(scratch, 'snap-antes.sql', snapshotSql('antes'));
    const snapDepois = await writeTemp(scratch, 'snap-depois.sql', snapshotSql('depois'));

    applyFile(handle, preamble, 'preamble');

    let applied = 0;
    for (const m of manifest) {
      if (m.n === 123) continue;             // db/123 is applied after the snapshot
      applyFile(handle, m.file, m.name);
      applied += 1;
      if (m.n === 66 && m.suffix === '') applyFile(handle, corpus, 'corpus');
      if (m.n === 116) applyFile(handle, cutoverFx, 'cutover rehearsal fixture (pre db/117)');
    }
    log('HISTORICO_APLICADO', { migracoes: applied, ate: `db/${manifest[manifest.length - 1].n}` });

    applyFile(handle, actors, 'actors');
    applyFile(handle, fixture, 'fixture tecelagem');

    // ---- BEFORE ----
    applyFile(handle, snapAntes, 'snapshot antes');
    const linhasAntes = scalar(handle, 'SELECT count(*) FROM proof.snap_antes;');
    log('SNAPSHOT_ANTES', { linhas: linhasAntes });

    // ---- db/123, applied under the live Supabase default-privilege grant ----
    const db123 = manifest.find((m) => m.n === 123);
    if (!db123) throw new Error('db/123 not found in the manifest');
    const out = applyFile(handle, db123.file, db123.name);
    log('DB123_APLICADA', { verify: /db\/123 verify: OK/.test(out) ? 'OK' : 'SEM_NOTICE' });

    // The default grant must have been defeated by the explicit REVOKE.
    check('default-ACL derrotada (sem INSERT para authenticated)',
      scalar(handle, `SELECT has_table_privilege('authenticated','public.tecelagem_rolos','INSERT');`),
      'f');

    // ---- ACCEPTANCE SCENARIOS ----
    const cenarios = applyFile(handle,
      path.join(REPO_ROOT, 'tests', 'db123-tecelagem-rolos.integration.sql'),
      'db123 acceptance scenarios');
    check('cenarios de aceitacao emitiram PASS',
      /DB123_ACCEPTANCE_PASS/.test(cenarios), true);

    // ---- AFTER ----
    applyFile(handle, snapDepois, 'snapshot depois');
    const diff = scalar(handle, COMPARE_SQL);
    check('dominio Admin inalterado pela acao de tecelagem', diff, 'IDENTICO');
    if (diff !== 'IDENTICO') {
      console.log('--- DIFERENCAS ---\n' + diff);
    }

    // ---- Independent re-measurement of the HEADLINE scenario ----
    // Scoped to the FIRST registration on product A (the "register 10" action),
    // measured from outside the scenario file so the proof does not depend on
    // the same statements that produced it.
    const primeiro = scalar(handle,
      `SELECT min(id) FROM public.tecelagem_producao_lancamentos WHERE op_item_id = ${OP_ITEM_A};`);

    check('a registracao de 10 declarou 10 rolos',
      scalar(handle, `SELECT quantidade_rolos FROM public.tecelagem_producao_lancamentos WHERE id = ${primeiro};`),
      '10');
    check('a registracao de 10 materializou 10 rolos individuais',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE lancamento_id = ${primeiro};`),
      '10');
    check('os 10 rolos tem identidade propria e distinta',
      scalar(handle, `SELECT count(DISTINCT id) FROM public.tecelagem_rolos WHERE lancamento_id = ${primeiro};`),
      '10');
    check('nenhum dos 10 exigiu comprimento',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE lancamento_id = ${primeiro} AND comprimento_m IS NULL;`),
      '10');
    check('os 10 estao visiveis em Ver rolos (na tecelagem)',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE lancamento_id = ${primeiro} AND situacao = 'na_tecelagem';`),
      '10');
    check('total do produto A apos as duas registracoes (10 + 5)',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE op_item_id = ${OP_ITEM_A};`),
      '15');

    // Regra ratificada: numeração sequencial DENTRO DA OP, medida de fora.
    check('nenhum numero visivel se repete dentro da OP',
      scalar(handle, `SELECT count(*) = count(DISTINCT numero) FROM public.tecelagem_rolos WHERE op_id = ${OP_ID};`),
      't');
    check('a OP tem 2 produtos e uma unica sequencia continua',
      scalar(handle, `SELECT count(DISTINCT op_item_id) || '/' || min(numero) || '-' || max(numero)
                        FROM public.tecelagem_rolos WHERE op_id = ${OP_ID};`),
      '2/1-20');

    // ---- O INÍCIO LOCAL, medido de fora dos cenários que o produziram ----
    // A afirmação central desta fatia é que a tecelagem produz SEM que o ciclo
    // de vida do Admin se mova. A OP 930000502 está 'aberta' na fixture e
    // continua 'aberta' depois de ser iniciada e produzida na tecelagem.
    check('a OP produzida pela tecelagem continua aberta no Admin',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_PRONTA};`),
      'aberta');
    check('a OP de trabalho nao teve o status do Admin alterado',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`),
      'em_producao');
    check('a OP bloqueada nunca foi iniciada',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_op_execucao WHERE op_id = ${OP_BLOQUEADA};`),
      '0');
    check('exatamente as duas OPs elegiveis foram iniciadas localmente',
      scalar(handle, `SELECT string_agg(op_id::text, ',' ORDER BY op_id) FROM public.tecelagem_op_execucao;`),
      `${OP_ID},${OP_PRONTA}`);
    check('o inicio local ficou atribuido ao fornecedor que o fez',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_op_execucao WHERE fornecedor_id <> ${FORN_TEC_ID};`),
      '0');
    check('a OP aberta materializou 10 rolos individuais, numerados do 1',
      scalar(handle, `SELECT count(*) || '/' || min(numero) || '-' || max(numero)
                        FROM public.tecelagem_rolos WHERE op_id = ${OP_PRONTA};`),
      '10/1-10');

    // O cliente definido pela Ravatex chega ao fornecedor, sem lhe dar
    // leitura direta de clientes ou lotes.
    check('o cliente da OP chega pela projecao de tecelagem',
      scalar(handle, `SET request.jwt.claim.sub = '${TEC_USER_UUID}'; SET ROLE authenticated;
                      SELECT cliente_nome FROM public.tecelagem_minhas_ops() WHERE op_id = ${OP_ID};`),
      CLIENTE_NOME);
    check('o fornecedor NAO ganhou SELECT direto em clientes',
      scalar(handle, `SELECT has_table_privilege('authenticated','public.clientes','SELECT')
                             AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes'
                                          AND policyname ILIKE '%tecelagem%');`),
      'f');

    log(failures === 0 ? 'DB123_INTEGRATION_PASS' : 'DB123_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
