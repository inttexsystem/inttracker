// tests/db128-tecelagem-excluir-selecao.integration.mjs
//
// TECELAGEM-V1-DENSITY-AND-SELECTION-UX — db/128 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase-platform preamble + the accepted 64-row corpus + the full
// db/01..db/128 migration manifest IN NATURAL NUMERIC ORDER), then exercises
// public.excluir_rolos_tecelagem AS THE IMPERSONATED SUPPLIER.
//
// Proves:
//   - deleting a SELECTION (003 + 005) leaves 001/002/004/006 with their own
//     numbers: no renumbering, no reissue of a freed number;
//   - one selected roll works through the same writer;
//   - a selection containing an already-sent roll refuses the WHOLE call and
//     mutates NOTHING — never a silent narrowing to the eligible remainder;
//   - a selection containing another supplier's roll is refused;
//   - each touched batch keeps its declared count equal to its remaining rolls,
//     and a batch emptied by the selection is removed;
//   - a selection spanning TWO batches is applied to both, atomically;
//   - db/125 finishing output, db/126 batch undo and db/127 single-roll
//     deletion all still work afterwards;
//   - Admin lifecycle, Admin quantities and Pedido state are untouched.
//
// Out of scope by design: no remote host, no managed backend, no credential,
// no production contact. The only database this file reaches is the throwaway
// cluster it starts itself.
//
// Usage:  node tests/db128-tecelagem-excluir-selecao.integration.mjs

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 128;

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

const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-0000000c8001';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-0000000c8002';
const FORN_TEC_ID     = 930002001;
const FORN_OUTRA_ID   = 930002002;
const OP_ID           = 930002101;
const OP_ITEM_A       = 930002111;
const OP_ITEM_B       = 930002112;
const MODELO_A        = 930002121;
const MODELO_B        = 930002122;
// A second OP owned by the OTHER supplier, so a cross-supplier selection is real.
const OP_ALHEIA       = 930002201;
const OP_ITEM_ALHEIO  = 930002211;

const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'db128-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'db128-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'DB128 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'DB128 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'db128-operador@example.invalid', 'Operador DB128',        'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'db128-outro@example.invalid',    'Operador Alheio DB128', 'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930002131, 'DB128-KRAFT'), (930002132, 'DB128-CRU')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
  (${MODELO_A}, 'DB128-NOITE',     930002131, 930002132, 2.10, 'tapete'),
  (${MODELO_B}, 'DB128-BARCELONA', 930002131, 930002132, 2.10, 'tapete')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID},     990128, 2026, 'em_producao', 'tecelagem', NULL),
  (${OP_ALHEIA}, 990129, 2026, 'em_producao', 'tecelagem', NULL)
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
  const scratch = await mkdtemp(path.join(tmpdir(), 'db128-scratch-'));
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

    applyFile(handle, fixture, 'fixture db128');

    const adminAntes = scalar(handle, ADMIN_FINGERPRINT_SQL);

    // 6 rolos no produto A (001..006) e 2 no produto B (007..008).
    const lancA = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_A}, 6, NULL)->>'lancamento_id');`));
    const lancB = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_B}, 2, NULL)->>'lancamento_id');`));
    check('o lote A cria 001..006', scalar(handle, numerosDoLancamento(lancA)), '1,2,3,4,5,6');
    check('o lote B cria 007..008', scalar(handle, numerosDoLancamento(lancB)), '7,8');

    const r003 = scalar(handle, roloDe(lancA, 3));
    const r005 = scalar(handle, roloDe(lancA, 5));
    const contadorAntes = scalar(handle,
      `SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID};`);

    // === Seleção alheia é recusada ========================================
    const alheio = tryQuery(handle, comoOutroOperador(
      `SELECT public.excluir_rolos_tecelagem(ARRAY[${r003}, ${r005}]::BIGINT[]);`));
    check('uma seleção de rolos de OUTRO fornecedor é recusada', alheio.ok, false);
    check('a recusa alheia carrega o código estável',
      /TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR/.test(alheio.out) ? 'sim' : alheio.out, 'sim');
    check('nada foi removido pela tentativa alheia',
      scalar(handle, numerosDoLancamento(lancA)), '1,2,3,4,5,6');

    // === ACEITAÇÃO — excluir a seleção 003 + 005 ==========================
    check('a seleção de 2 rolos remove exatamente 2',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolos_tecelagem(ARRAY[${r003}, ${r005}]::BIGINT[])->>'rolos_removidos');`)), '2');
    check('sobram 001, 002, 004 e 006 — sem renumeração',
      scalar(handle, numerosDoLancamento(lancA)), '1,2,4,6');
    check('a contagem declarada do lote acompanha os rolos que restam',
      scalar(handle, `SELECT quantidade_rolos FROM public.tecelagem_producao_lancamentos WHERE id = ${lancA};`), '4');
    check('o contador da OP NÃO foi rebobinado', scalar(handle,
      `SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID};`), contadorAntes);

    const lancC = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_A}, 1, NULL)->>'lancamento_id');`));
    check('um registro posterior NÃO reemite 003 nem 005 (as lacunas são permanentes)',
      scalar(handle, numerosDoLancamento(lancC)), '9');

    // === Um único rolo pelo mesmo escritor =================================
    const r001 = scalar(handle, roloDe(lancA, 1));
    check('a mesma ação funciona com UM rolo selecionado',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolos_tecelagem(ARRAY[${r001}]::BIGINT[])->>'rolos_removidos');`)), '1');
    check('sobram 002, 004 e 006', scalar(handle, numerosDoLancamento(lancA)), '2,4,6');

    // === Seleção com um rolo JÁ ENVIADO recusa a chamada INTEIRA ============
    const r007 = scalar(handle, roloDe(lancB, 7));
    const r008 = scalar(handle, roloDe(lancB, 8));
    scalar(handle, comoOperador(`SELECT public.enviar_rolos_acabamento(ARRAY[${r007}]::BIGINT[]);`));
    check('o rolo 007 foi enviado ao acabamento (db/125 preservado)',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${r007};`), 'enviado_acabamento');

    const misto = tryQuery(handle, comoOperador(
      `SELECT public.excluir_rolos_tecelagem(ARRAY[${r007}, ${r008}]::BIGINT[]);`));
    check('uma seleção contendo um rolo já enviado recusa a chamada inteira', misto.ok, false);
    check('a recusa de já-enviado carrega o código estável',
      /TECELAGEM_ROLO_JA_ENVIADO/.test(misto.out) ? 'sim' : misto.out, 'sim');
    check('NENHUM rolo elegível da seleção recusada foi removido (sem estreitamento silencioso)',
      scalar(handle, numerosDoLancamento(lancB)), '7,8');

    // === Seleção atravessando DOIS lotes, atômica ==========================
    const r002 = scalar(handle, roloDe(lancA, 2));
    check('uma seleção que atravessa dois lançamentos remove os dois',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolos_tecelagem(ARRAY[${r002}, ${r008}]::BIGINT[])->>'rolos_removidos');`)), '2');
    check('o lote A ficou com 004 e 006', scalar(handle, numerosDoLancamento(lancA)), '4,6');
    check('o lote B ficou só com o rolo enviado 007', scalar(handle, numerosDoLancamento(lancB)), '7');
    check('a contagem declarada do lote B acompanhou',
      scalar(handle, `SELECT quantidade_rolos FROM public.tecelagem_producao_lancamentos WHERE id = ${lancB};`), '1');

    // === Esvaziar um lote remove o lote ====================================
    const r009 = scalar(handle, roloDe(lancC, 9));
    check('excluir o último rolo de um lote remove o lote agora vazio',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolos_tecelagem(ARRAY[${r009}]::BIGINT[])->>'lancamentos_removidos');`)), '1');
    check('o lote vazio não sobrou',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_producao_lancamentos WHERE id = ${lancC};`), '0');

    // === Consistência global ===============================================
    check('nenhum rolo órfão existe', scalar(handle,
      `SELECT count(*) FROM public.tecelagem_rolos r
        WHERE NOT EXISTS (SELECT 1 FROM public.tecelagem_producao_lancamentos l WHERE l.id = r.lancamento_id);`), '0');
    check('nenhum lançamento reivindica mais rolos do que contém', scalar(handle,
      `SELECT count(*) FROM public.tecelagem_producao_lancamentos l
        WHERE l.quantidade_rolos <> (SELECT count(*) FROM public.tecelagem_rolos r WHERE r.lancamento_id = l.id);`), '0');

    // === Os vizinhos aceitos continuam funcionando =========================
    const r004 = scalar(handle, roloDe(lancA, 4));
    check('db/127 (exclusão de UM rolo) continua funcionando',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolo_tecelagem(${r004})->>'numero');`)), '4');
    check('db/126 (desfazer lançamento) continua funcionando para o lote restante',
      scalar(handle, comoOperador(
        `SELECT (public.desfazer_lancamento_tecelagem(${lancA})->>'rolos_removidos');`)), '1');

    // === Isolamento ========================================================
    check('o INÍCIO LOCAL da produção sobreviveu a tudo',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_op_execucao WHERE op_id = ${OP_ID};`), '1');
    check('o status Admin da OP permanece inalterado',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`), 'em_producao');
    check('o domínio Admin inteiro permanece IDÊNTICO',
      scalar(handle, ADMIN_FINGERPRINT_SQL), adminAntes);

    // === ACL ================================================================
    check('o escritor de seleção é executável por authenticated', scalar(handle,
      `SELECT has_function_privilege('authenticated','public.excluir_rolos_tecelagem(bigint[])','EXECUTE');`), 't');
    check('o escritor de seleção NÃO é executável por anon nem service_role', scalar(handle,
      `SELECT has_function_privilege('anon','public.excluir_rolos_tecelagem(bigint[])','EXECUTE')
           OR has_function_privilege('service_role','public.excluir_rolos_tecelagem(bigint[])','EXECUTE');`), 'f');
    check('nenhuma role ganhou DELETE direto em tecelagem_rolos', scalar(handle,
      `SELECT bool_or(has_table_privilege(g, 'public.tecelagem_rolos', 'DELETE'))
         FROM unnest(ARRAY['anon','authenticated','service_role']) AS g;`), 'f');

    log(failures === 0 ? 'DB128_INTEGRATION_PASS' : 'DB128_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
