// tests/db129-tecelagem-etiqueta-impressa.integration.mjs
//
// TECELAGEM-V1-CONSOLIDATED-UI-FIXES - db/129 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase preamble + the accepted 64-row corpus + the full
// db/01..db/129 manifest IN NATURAL NUMERIC ORDER), then exercises
// public.marcar_etiquetas_rolo_impressas AS THE IMPERSONATED SUPPLIER.
//
// Proves the roll-label print state is a PERSISTED, INFERENCE-FREE annotation:
//   - a freshly registered roll is NEVER printed - nothing infers it;
//   - printing marks exactly the rolls asked for, and no others;
//   - REPRINTING preserves the FIRST print moment and creates no roll;
//   - a roll already sent to finishing can still be marked (no situation gate);
//   - marking gates nothing: output, deletion and undo behave identically;
//   - another supplier cannot mark this supplier's rolls.
//
// Out of scope by design: no remote host, no managed backend, no credential,
// no production contact. The only database this file reaches is the throwaway
// cluster it starts itself.
//
// Usage:  node tests/db129-tecelagem-etiqueta-impressa.integration.mjs

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 129;

const SUPABASE_DEFAULT_ACL_SQL = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

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
`;

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

const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-0000000c9001';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-0000000c9002';
const FORN_TEC_ID     = 930003001;
const FORN_OUTRA_ID   = 930003002;
const OP_ID           = 930003101;
const OP_ITEM_A       = 930003111;
const OP_ITEM_B       = 930003112;
const MODELO_A        = 930003121;
const MODELO_B        = 930003122;
// A second OP owned by the OTHER supplier, so a cross-supplier selection is real.
const OP_ALHEIA       = 930003201;
const OP_ITEM_ALHEIO  = 930003211;

const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'db129-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'db129-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'DB128 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'DB128 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'db129-operador@example.invalid', 'Operador DB128',        'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'db129-outro@example.invalid',    'Operador Alheio DB128', 'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930003131, 'DB129-KRAFT'), (930003132, 'DB129-CRU')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
  (${MODELO_A}, 'DB129-NOITE',     930003131, 930003132, 2.10, 'tapete'),
  (${MODELO_B}, 'DB129-BARCELONA', 930003131, 930003132, 2.10, 'tapete')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID},     990131, 2026, 'em_producao', 'tecelagem', NULL),
  (${OP_ALHEIA}, 990132, 2026, 'em_producao', 'tecelagem', NULL)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${OP_ITEM_A},      ${OP_ID},     ${MODELO_A}, 4000.00),
  (${OP_ITEM_B},      ${OP_ID},     ${MODELO_B}, 2000.00),
  (${OP_ITEM_ALHEIO}, ${OP_ALHEIA}, ${MODELO_A}, 1000.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa) VALUES
  (${OP_ID},     ${FORN_TEC_ID},   'cima'),
  (${OP_ALHEIA}, ${FORN_OUTRA_ID}, 'cima')
  ON CONFLICT DO NOTHING;

INSERT INTO public.tecelagem_op_execucao (op_id, fornecedor_id, iniciada_por) VALUES
  (${OP_ID},     ${FORN_TEC_ID},   '${TEC_USER_UUID}'),
  (${OP_ALHEIA}, ${FORN_OUTRA_ID}, '${OTHER_USER_UUID}')
  ON CONFLICT (op_id) DO NOTHING;

SET session_replication_role = origin;
`;

let failures = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  log(ok ? 'PASS' : 'FAIL', { caso: name, esperado: expected, obtido: actual });
  return ok;
}

const comoOperador = (sql) =>
  `SET request.jwt.claim.sub = '${TEC_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
const comoOutroOperador = (sql) =>
  `SET request.jwt.claim.sub = '${OTHER_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;

const numerosDoLancamento = (lanc) =>
  `SELECT COALESCE(string_agg(numero::text, ',' ORDER BY numero), '') FROM public.tecelagem_rolos WHERE lancamento_id = ${lanc};`;
const roloDe = (lanc, numero) =>
  `SELECT id FROM public.tecelagem_rolos WHERE lancamento_id = ${lanc} AND numero = ${numero};`;

const ADMIN_FINGERPRINT_SQL = `
SELECT md5(
  COALESCE((SELECT string_agg(id || ':' || status || ':' || COALESCE(tipo,'~'), ',' ORDER BY id) FROM public.ops), '')
  || '#' ||
  COALESCE((SELECT string_agg(id || ':' || COALESCE(metros_pedidos::text,'~') || ':' || COALESCE(metros_ajustados::text,'~'), ',' ORDER BY id) FROM public.op_itens), '')
  || '#' ||
  COALESCE((SELECT string_agg(id || ':' || status, ',' ORDER BY id) FROM public.pedidos), '')
  || '#' ||
  COALESCE((SELECT string_agg(id::text, ',' ORDER BY id) FROM public.lotes), '')
);
`;

async function main() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'db129-scratch-'));
  let handle = null;

  try {
    log('BOOT', { alvo: 'cluster local descartavel', terminal: `db/${TERMINAL}` });
    handle = await bootstrapCluster({});
    log('BOOT_OK', { host: handle.host, port: handle.port, db: handle.database });

    const manifest = (await resolveFullManifest()).filter((m) => m.n <= TERMINAL);
    const preamble = await writeTemp(scratch, 'preamble.sql', PREAMBLE_SQL + SUPABASE_DEFAULT_ACL_SQL);
    const cutoverFx = await writeTemp(scratch, 'cutover-fixture.sql', CUTOVER_REHEARSAL_SQL);
    const corpus = await writeTemp(scratch, 'corpus.sql', CORPUS_SQL);
    const fixture = await writeTemp(scratch, 'fixture.sql', FIXTURE_SQL);

    applyFile(handle, preamble, 'preamble');

    let applied = 0;
    for (const m of manifest) {
      applyFile(handle, m.file, m.name);
      applied += 1;
      if (m.n === 66 && m.suffix === '') applyFile(handle, corpus, 'corpus');
      if (m.n === 116) applyFile(handle, cutoverFx, 'cutover rehearsal fixture (pre db/117)');
    }
    log('HISTORICO_APLICADO', { migracoes: applied, ate: `db/${manifest[manifest.length - 1].n}` });

    applyFile(handle, fixture, 'fixture db129');

    const adminAntes = scalar(handle, ADMIN_FINGERPRINT_SQL);

    const lancA = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_A}, 4, NULL)->>'lancamento_id');`));
    check('o lote cria 001..004', scalar(handle, numerosDoLancamento(lancA)), '1,2,3,4');

    const r = (n) => scalar(handle, roloDe(lancA, n));
    const impresso = (n) =>
      scalar(handle, `SELECT etiqueta_impressa_em IS NOT NULL FROM public.tecelagem_rolos WHERE id = ${r(n)};`);

    // === NADA infere impressao =============================================
    check('um rolo recem-registrado NUNCA nasce impresso', scalar(handle,
      `SELECT count(*) FROM public.tecelagem_rolos WHERE etiqueta_impressa_em IS NOT NULL;`), '0');

    // === Autorizacao ========================================================
    const alheio = tryQuery(handle, comoOutroOperador(
      `SELECT public.marcar_etiquetas_rolo_impressas(ARRAY[${r(1)}]::BIGINT[]);`));
    check('outro fornecedor nao pode marcar etiquetas alheias', alheio.ok, false);
    check('a recusa alheia carrega o codigo estavel',
      /TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR/.test(alheio.out) ? 'sim' : alheio.out, 'sim');
    check('e nada foi marcado', impresso(1), 'f');

    // === Marcar exatamente os solicitados ===================================
    check('marcar 2 rolos marca exatamente 2', scalar(handle, comoOperador(
      `SELECT (public.marcar_etiquetas_rolo_impressas(ARRAY[${r(1)}, ${r(3)}]::BIGINT[])->>'marcados');`)), '2');
    check('o rolo 001 ficou impresso', impresso(1), 't');
    check('o rolo 003 ficou impresso', impresso(3), 't');
    check('o rolo 002 NAO foi tocado', impresso(2), 'f');
    check('o rolo 004 NAO foi tocado', impresso(4), 'f');
    check('o autor da impressao foi registrado', scalar(handle,
      `SELECT etiqueta_impressa_por = '${TEC_USER_UUID}' FROM public.tecelagem_rolos WHERE id = ${r(1)};`), 't');

    // === REIMPRESSAO preserva o PRIMEIRO momento ============================
    const momento1 = scalar(handle,
      `SELECT etiqueta_impressa_em FROM public.tecelagem_rolos WHERE id = ${r(1)};`);
    const rolosAntes = scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos;`);
    check('reimprimir um ja impresso marca 0 (e no-op, nao erro)', scalar(handle, comoOperador(
      `SELECT (public.marcar_etiquetas_rolo_impressas(ARRAY[${r(1)}]::BIGINT[])->>'marcados');`)), '0');
    check('e o momento da PRIMEIRA impressao e preservado', scalar(handle,
      `SELECT etiqueta_impressa_em FROM public.tecelagem_rolos WHERE id = ${r(1)};`), momento1);
    check('reimprimir NAO cria rolo nenhum',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos;`), rolosAntes);
    check('reimprimir NAO muda a situacao do rolo',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${r(1)};`), 'na_tecelagem');

    // === Uma selecao mista marca so os que faltavam =========================
    check('uma selecao mista marca apenas os ainda nao impressos', scalar(handle, comoOperador(
      `SELECT (public.marcar_etiquetas_rolo_impressas(ARRAY[${r(1)}, ${r(2)}]::BIGINT[])->>'marcados');`)), '1');
    check('o momento do 001 continua sendo o primeiro', scalar(handle,
      `SELECT etiqueta_impressa_em FROM public.tecelagem_rolos WHERE id = ${r(1)};`), momento1);

    // === SEM PORTAO DE SITUACAO: um rolo enviado ainda pode ser marcado ======
    const r4 = r(4);
    scalar(handle, comoOperador(`SELECT public.enviar_rolos_acabamento(ARRAY[${r4}]::BIGINT[]);`));
    check('o rolo 004 foi enviado ao acabamento',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${r4};`), 'enviado_acabamento');
    check('um rolo JA ENVIADO ainda pode ter a etiqueta marcada como impressa',
      scalar(handle, comoOperador(
        `SELECT (public.marcar_etiquetas_rolo_impressas(ARRAY[${r4}]::BIGINT[])->>'marcados');`)), '1');
    check('e continua enviado ao acabamento - marcar nao e transicao',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${r4};`), 'enviado_acabamento');

    // === O ESTADO NAO PORTEIA NADA ==========================================
    const impresso3Antes = scalar(handle,
      `SELECT etiqueta_impressa_em FROM public.tecelagem_rolos WHERE id = ${r(3)};`);
    check('um rolo com etiqueta impressa continua excluivel', scalar(handle, comoOperador(
      `SELECT (public.excluir_rolos_tecelagem(ARRAY[${r(2)}]::BIGINT[])->>'rolos_removidos');`)), '1');
    check('excluir um rolo nao altera o estado de impressao de outro', scalar(handle,
      `SELECT etiqueta_impressa_em FROM public.tecelagem_rolos WHERE id = ${r(3)};`), impresso3Antes);

    // === PERSISTENCIA: cada scalar() e uma conexao psql NOVA =================
    check('o estado sobrevive a uma nova sessao de banco', scalar(handle,
      `SELECT count(*) FROM public.tecelagem_rolos WHERE etiqueta_impressa_em IS NOT NULL;`), '3');

    // === Isolamento ==========================================================
    check('o dominio Admin inteiro permanece IDENTICO',
      scalar(handle, ADMIN_FINGERPRINT_SQL), adminAntes);
    check('o status Admin da OP permanece inalterado',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`), 'em_producao');

    // === ACL =================================================================
    check('o escritor de impressao e executavel por authenticated', scalar(handle,
      `SELECT has_function_privilege('authenticated','public.marcar_etiquetas_rolo_impressas(bigint[])','EXECUTE');`), 't');
    check('o escritor de impressao NAO e executavel por anon nem service_role', scalar(handle,
      `SELECT has_function_privilege('anon','public.marcar_etiquetas_rolo_impressas(bigint[])','EXECUTE')
           OR has_function_privilege('service_role','public.marcar_etiquetas_rolo_impressas(bigint[])','EXECUTE');`), 'f');
    check('nenhuma role ganhou UPDATE direto em tecelagem_rolos', scalar(handle,
      `SELECT bool_or(has_table_privilege(g, 'public.tecelagem_rolos', 'UPDATE'))
         FROM unnest(ARRAY['anon','authenticated','service_role']) AS g;`), 'f');

    log(failures === 0 ? 'DB129_INTEGRATION_PASS' : 'DB129_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
