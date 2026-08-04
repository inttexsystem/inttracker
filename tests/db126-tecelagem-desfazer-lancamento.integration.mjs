// tests/db126-tecelagem-desfazer-lancamento.integration.mjs
//
// TECELAGEM-V1-PRODUCTION-ENTRY-RECOVERY — db/126 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase-platform preamble + the accepted 64-row corpus + the full
// db/01..db/126 migration manifest IN NATURAL NUMERIC ORDER), then exercises
// public.desfazer_lancamento_tecelagem AS THE IMPERSONATED SUPPLIER
// (SET request.jwt.claim.sub + SET ROLE authenticated — the pattern already
// established in tests/db123-tecelagem-rolos.integration.mjs and
// tests/db125-tecelagem-saida-acabamento.integration.mjs).
//
// Unlike the db/125 driver, the production registrations here are created by
// the REAL writer public.registrar_producao_tecelagem, not inserted directly:
// the subject of this file is the round trip REGISTER -> UNDO -> REGISTER
// AGAIN, and a hand-inserted batch would not prove that the counter, the
// batch row and the rolls actually come back to a coherent state.
//
// Acceptance criteria proved here (order-numbered):
//   B  a legitimate registration still creates exactly the requested rolls;
//   C  a 10-roll registration whose rolls are all `na_tecelagem` is undone and
//      the weaving state returns to what it was before that registration;
//   D  undo leaves no orphan roll, no phantom count and no registration
//      claiming rolls that no longer exist;
//   E  a registration with ANY roll already sent to finishing REFUSES the
//      normal batch undo and mutates nothing;
//   F  undo changes no Admin lifecycle, no Admin production quantity, no
//      Pedido row and no unrelated weaving record — and never revokes the
//      local production start.
//
// Out of scope by design, and enforced by construction: no remote host, no
// managed backend, no credential, no production contact of any kind. The only
// database this file can reach is the throwaway cluster it starts itself.
//
// Usage:  node tests/db126-tecelagem-desfazer-lancamento.integration.mjs

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 126;

// Supabase re-grants ALL on every newly created public table/sequence by
// default, so every REVOKE in db/01..db/126 has to defeat a LIVE default grant
// here too, exactly as it does in the real project.
const SUPABASE_DEFAULT_ACL_SQL = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

// db/116 onward assert the purchase-order cutover already reached its
// post-cutover resting state, which is operational state no from-scratch
// replay reaches on its own. Applied right after db/116, before db/117.
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

// ---------------------------------------------------------------------------
// Full migration manifest, letter suffixes included and correctly ordered.
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
// Weaving fixture. The LOCAL production start (tecelagem_op_execucao) is
// inserted directly rather than through iniciar_producao_tecelagem: start
// eligibility is already proved by tests/db123-tecelagem-rolos.integration.mjs
// and building the full pedido/lote chain again here would test that instead
// of undo. Everything this file actually measures — registration, undo,
// finishing output — goes through the real writers.
// ---------------------------------------------------------------------------
const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-0000000c6001';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-0000000c6002';
const FORN_TEC_ID     = 930001601;
const FORN_OUTRA_ID   = 930001602;
const OP_ID           = 930001701;
const OP_ITEM_TAPETE  = 930001711;
const MODELO_TAPETE   = 930001721;

const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'db126-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'db126-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'DB126 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'DB126 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'db126-operador@example.invalid', 'Operador DB126',        'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'db126-outro@example.invalid',    'Operador Alheio DB126', 'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930001731, 'DB126-KRAFT'), (930001732, 'DB126-CRU')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
  (${MODELO_TAPETE}, 'DB126-NOITE', 930001731, 930001732, 2.10, 'tapete')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID}, 990126, 2026, 'em_producao', 'tecelagem', NULL)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${OP_ITEM_TAPETE}, ${OP_ID}, ${MODELO_TAPETE}, 4000.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa) VALUES
  (${OP_ID}, ${FORN_TEC_ID}, 'cima')
  ON CONFLICT DO NOTHING;

-- The LOCAL production start: the gate registrar_producao_tecelagem enforces.
INSERT INTO public.tecelagem_op_execucao (op_id, fornecedor_id, iniciada_por)
  VALUES (${OP_ID}, ${FORN_TEC_ID}, '${TEC_USER_UUID}')
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

// Runs `sql` impersonating a supplier operator. SET/RESET emit nothing under
// psql -At, so a single trailing SELECT yields a single clean value.
function comoOperador(sql) {
  return `SET request.jwt.claim.sub = '${TEC_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}
function comoOutroOperador(sql) {
  return `SET request.jwt.claim.sub = '${OTHER_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}

// The whole weaving state of this OP in one comparable string: registrations,
// rolls, their numbers and situations, and the allocator high-water mark. This
// is what "returns the weaving state to what it was before that registration"
// is measured against — not a roll count alone.
const ESTADO_TECELAGEM_SQL = `
SELECT
  (SELECT count(*) FROM public.tecelagem_producao_lancamentos WHERE op_id = ${OP_ID})
  || '|' ||
  (SELECT count(*) FROM public.tecelagem_rolos WHERE op_id = ${OP_ID})
  || '|' ||
  COALESCE((SELECT string_agg(numero || ':' || situacao, ',' ORDER BY numero)
              FROM public.tecelagem_rolos WHERE op_id = ${OP_ID}), '')
  || '|' ||
  -- COALESCE: the allocator row does not exist until the first registration,
  -- so without it the whole concatenation would collapse to NULL and the
  -- pre-registration state would not be comparable at all.
  COALESCE((SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID})::text, '0');
`;

// The Admin domain this slice must never touch. Deliberately WIDER than the
// weaving OP: it also covers the pre-existing 64-row corpus, so a stray write
// anywhere in the Admin domain shows up as a fingerprint change.
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
  const scratch = await mkdtemp(path.join(tmpdir(), 'db126-scratch-'));
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

    applyFile(handle, fixture, 'fixture db126');

    // The Admin domain BEFORE any weaving activity at all.
    const adminAntes = scalar(handle, ADMIN_FINGERPRINT_SQL);
    // The weaving state BEFORE the registration that will later be undone.
    const estadoZero = scalar(handle, ESTADO_TECELAGEM_SQL);
    check('estado inicial da tecelagem: nenhum lancamento, nenhum rolo, contador zerado',
      estadoZero, '0|0||0');

    // === B — a legitimate registration creates exactly the requested rolls ==
    const lancA = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_TAPETE}, 10, NULL)->>'lancamento_id');`));
    check('registro legitimo de 10 rolos cria exatamente 10 rolos individuais',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE lancamento_id = ${lancA};`), '10');
    check('os numeros visiveis vao de 001 a 010',
      scalar(handle, `SELECT min(numero) || '-' || max(numero) FROM public.tecelagem_rolos WHERE lancamento_id = ${lancA};`),
      '1-10');

    // Estado imediatamente ANTES do lancamento que sera desfeito (criterio C).
    const estadoAntesDeB = scalar(handle, ESTADO_TECELAGEM_SQL);

    const lancB = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_TAPETE}, 3, NULL)->>'lancamento_id');`));
    check('o segundo lancamento continua a numeracao da OP (011-013)',
      scalar(handle, `SELECT min(numero) || '-' || max(numero) FROM public.tecelagem_rolos WHERE lancamento_id = ${lancB};`),
      '11-13');

    // === Read model — o operador reconhece o lancamento por fatos de negocio =
    check('o read model devolve os dois lancamentos do produto',
      scalar(handle, comoOperador(
        `SELECT count(*) FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE});`)), '2');
    check('o read model descreve o lote pela faixa de rolos, nao por id tecnico',
      scalar(handle, comoOperador(
        `SELECT quantidade_rolos || '/' || numero_inicial || '-' || numero_final
           FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE}) WHERE lancamento_id = ${lancB};`)),
      '3/11-13');
    check('ambos os lancamentos estao desfaziveis enquanto todos os rolos estao na tecelagem',
      scalar(handle, comoOperador(
        `SELECT bool_and(pode_desfazer) FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE});`)), 't');
    check('o read model de OUTRO fornecedor nao enxerga estes lancamentos',
      scalar(handle, comoOutroOperador(
        `SELECT count(*) FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE});`)), '0');

    // === Autorizacao — desfazer lancamento alheio e recusado ================
    const alheio = tryQuery(handle, comoOutroOperador(
      `SELECT public.desfazer_lancamento_tecelagem(${lancB});`));
    check('um lancamento de OUTRO fornecedor nao pode ser desfeito', alheio.ok, false);
    check('a recusa de lancamento alheio carrega o codigo estavel',
      /TECELAGEM_LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR/.test(alheio.out) ? 'sim' : alheio.out, 'sim');
    check('nada foi removido pela tentativa alheia',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE op_id = ${OP_ID};`), '13');

    // === C — desfazer devolve a tecelagem ao estado anterior ao lancamento ==
    const undoB = scalar(handle, comoOperador(
      `SELECT (public.desfazer_lancamento_tecelagem(${lancB})->>'rolos_removidos');`));
    check('desfazer um lancamento de 3 rolos remove exatamente 3 rolos', undoB, '3');
    check('o estado da tecelagem volta a ser EXATAMENTE o anterior ao lancamento',
      scalar(handle, ESTADO_TECELAGEM_SQL), estadoAntesDeB);

    // === D — nenhum dano oculto ============================================
    check('nenhum rolo orfao sobreviveu ao desfazer',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos r
                       WHERE NOT EXISTS (SELECT 1 FROM public.tecelagem_producao_lancamentos l WHERE l.id = r.lancamento_id);`),
      '0');
    check('nenhum lancamento sobrou reivindicando rolos inexistentes',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_producao_lancamentos l
                       WHERE l.quantidade_rolos <> (SELECT count(*) FROM public.tecelagem_rolos r WHERE r.lancamento_id = l.id);`),
      '0');
    check('o lancamento desfeito desapareceu do read model',
      scalar(handle, comoOperador(
        `SELECT count(*) FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE}) WHERE lancamento_id = ${lancB};`)),
      '0');

    // O contador foi rebobinado: o registro CORRETO nao comeca num numero
    // fantasma. Este e o teste que uma contagem de linhas sozinha nao faria.
    const lancC = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_TAPETE}, 3, NULL)->>'lancamento_id');`));
    check('o registro corrigido reaproveita a numeracao liberada (011-013), sem numero fantasma',
      scalar(handle, `SELECT min(numero) || '-' || max(numero) FROM public.tecelagem_rolos WHERE lancamento_id = ${lancC};`),
      '11-13');

    // === Um lancamento inexistente e recusado, nao ignorado =================
    const inexistente = tryQuery(handle, comoOperador(
      `SELECT public.desfazer_lancamento_tecelagem(999000126);`));
    check('um lancamento inexistente e recusado', inexistente.ok, false);
    check('a recusa de inexistente carrega o codigo estavel',
      /TECELAGEM_LANCAMENTO_NAO_ENCONTRADO/.test(inexistente.out) ? 'sim' : inexistente.out, 'sim');

    // === E — lote que ja progrediu recusa o desfazer normal =================
    const roloEnviado = scalar(handle,
      `SELECT id FROM public.tecelagem_rolos WHERE lancamento_id = ${lancC} ORDER BY numero LIMIT 1;`);
    scalar(handle, comoOperador(
      `SELECT public.enviar_rolos_acabamento(ARRAY[${roloEnviado}]::BIGINT[]);`));
    check('um rolo do lote C foi enviado para o acabamento',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${roloEnviado};`),
      'enviado_acabamento');

    check('o read model deixa de oferecer o desfazer do lote que progrediu',
      scalar(handle, comoOperador(
        `SELECT pode_desfazer || '/' || motivo_bloqueio
           FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE}) WHERE lancamento_id = ${lancC};`)),
      'false/LANCAMENTO_COM_ROLOS_JA_ENVIADOS');
    check('o lote que NAO progrediu continua desfazivel',
      scalar(handle, comoOperador(
        `SELECT pode_desfazer FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_TAPETE}) WHERE lancamento_id = ${lancA};`)),
      't');

    const estadoAntesDaRecusa = scalar(handle, ESTADO_TECELAGEM_SQL);
    const progrediu = tryQuery(handle, comoOperador(
      `SELECT public.desfazer_lancamento_tecelagem(${lancC});`));
    check('um lote com rolo ja enviado ao acabamento RECUSA o desfazer normal', progrediu.ok, false);
    check('a recusa de lote progredido carrega o codigo estavel',
      /TECELAGEM_LANCAMENTO_JA_PROGREDIU/.test(progrediu.out) ? 'sim' : progrediu.out, 'sim');
    check('a recusa nao mutou NADA (nem os rolos ainda na tecelagem do mesmo lote)',
      scalar(handle, ESTADO_TECELAGEM_SQL), estadoAntesDaRecusa);

    // === O desfazer continua valido para o lote que nao progrediu ===========
    const undoA = scalar(handle, comoOperador(
      `SELECT (public.desfazer_lancamento_tecelagem(${lancA})->>'rolos_removidos');`));
    check('o lote intacto (10 rolos, todos na tecelagem) ainda pode ser desfeito', undoA, '10');
    check('sobram exatamente os 3 rolos do lote que progrediu',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE op_id = ${OP_ID};`), '3');
    check('o contador fica ACIMA do maior numero sobrevivente (a lacuna nao e reutilizada)',
      scalar(handle, `SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID};`), '14');

    // === F — isolamento =====================================================
    check('o INICIO LOCAL da producao sobreviveu a todos os desfazeres',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_op_execucao WHERE op_id = ${OP_ID};`), '1');
    check('o status Admin da OP permanece inalterado (em_producao)',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`), 'em_producao');
    check('o dominio Admin inteiro permanece IDENTICO ao de antes da tecelagem',
      scalar(handle, ADMIN_FINGERPRINT_SQL), adminAntes);
    check('nenhuma expedicao/entrega foi criada pela tecelagem',
      scalar(handle, `SELECT (SELECT count(*) FROM public.expedicoes) = 0
                         AND (SELECT count(*) FROM public.entrega_itens) = 0;`), 't');

    // === ACL — o escritor continua sendo o unico caminho ====================
    check('nenhuma role ganhou DELETE direto em tecelagem_rolos',
      scalar(handle, `SELECT bool_or(has_table_privilege(r, 'public.tecelagem_rolos', 'DELETE'))
                         FROM unnest(ARRAY['anon','authenticated','service_role']) AS r;`), 'f');
    check('nenhuma role ganhou DELETE direto em tecelagem_producao_lancamentos',
      scalar(handle, `SELECT bool_or(has_table_privilege(r, 'public.tecelagem_producao_lancamentos', 'DELETE'))
                         FROM unnest(ARRAY['anon','authenticated','service_role']) AS r;`), 'f');
    check('o escritor de desfazer e executavel por authenticated',
      scalar(handle, `SELECT has_function_privilege('authenticated','public.desfazer_lancamento_tecelagem(bigint)','EXECUTE');`), 't');
    check('o escritor de desfazer NAO e executavel por anon nem service_role',
      scalar(handle, `SELECT has_function_privilege('anon','public.desfazer_lancamento_tecelagem(bigint)','EXECUTE')
                          OR has_function_privilege('service_role','public.desfazer_lancamento_tecelagem(bigint)','EXECUTE');`), 'f');
    check('o dono da elegibilidade de desfazer permanece owner-only',
      scalar(handle, `SELECT has_function_privilege('authenticated','public._tecelagem_lancamento_pode_desfazer(bigint,bigint)','EXECUTE')
                          OR has_function_privilege('anon','public._tecelagem_lancamento_pode_desfazer(bigint,bigint)','EXECUTE')
                          OR has_function_privilege('service_role','public._tecelagem_lancamento_pode_desfazer(bigint,bigint)','EXECUTE');`), 'f');

    log(failures === 0 ? 'DB126_INTEGRATION_PASS' : 'DB126_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
