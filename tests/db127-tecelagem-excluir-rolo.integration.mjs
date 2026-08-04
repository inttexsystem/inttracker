// tests/db127-tecelagem-excluir-rolo.integration.mjs
//
// TECELAGEM-V1-INDIVIDUAL-ROLL-DELETION — db/127 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase-platform preamble + the accepted 64-row corpus + the full
// db/01..db/127 migration manifest IN NATURAL NUMERIC ORDER), then exercises
// public.excluir_rolo_tecelagem AS THE IMPERSONATED SUPPLIER
// (SET request.jwt.claim.sub + SET ROLE authenticated).
//
// Every roll here is created by the REAL writer registrar_producao_tecelagem,
// never inserted by hand: the subject is what happens to a REGISTRATION and to
// the surrounding numbering when one of its rolls is removed, and a
// hand-inserted batch would not exercise the allocator at all.
//
// Acceptance criteria proved here:
//   - a 5-roll batch minus roll 003 leaves 001/002/004/005, with those exact
//     numbers: NO renumbering, NO new roll, NO reissue of 003;
//   - the registration stays internally consistent (declared count equals the
//     rolls that exist; no orphan, no phantom count);
//   - a roll already sent to finishing CANNOT be deleted;
//   - deleting a roll of one batch does not touch another batch;
//   - DESFAZER LANÇAMENTO (db/126) still works afterwards, including on a
//     batch that already lost a roll individually;
//   - finishing output (db/125) still works and is unchanged;
//   - deleting the LAST roll of a batch removes the now-empty batch row;
//   - Admin lifecycle, Admin quantities and Pedido state are untouched.
//
// Out of scope by design, and enforced by construction: no remote host, no
// managed backend, no credential, no production contact of any kind. The only
// database this file can reach is the throwaway cluster it starts itself.
//
// Usage:  node tests/db127-tecelagem-excluir-rolo.integration.mjs

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 127;

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

// ---------------------------------------------------------------------------
// Fixture. TWO products on the same OP, so "deleting a roll of one batch does
// not touch another batch" is measurable, and a second supplier for the
// cross-supplier refusal. The local production start is inserted directly:
// start eligibility is proved by tests/db123-tecelagem-rolos.integration.mjs.
// ---------------------------------------------------------------------------
const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-0000000c7001';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-0000000c7002';
const FORN_TEC_ID     = 930001801;
const FORN_OUTRA_ID   = 930001802;
const OP_ID           = 930001901;
const OP_ITEM_A       = 930001911;
const OP_ITEM_B       = 930001912;
const MODELO_A        = 930001921;
const MODELO_B        = 930001922;

const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'db127-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'db127-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'DB127 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'DB127 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'db127-operador@example.invalid', 'Operador DB127',        'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'db127-outro@example.invalid',    'Operador Alheio DB127', 'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930001931, 'DB127-KRAFT'), (930001932, 'DB127-CRU')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
  (${MODELO_A}, 'DB127-NOITE',    930001931, 930001932, 2.10, 'tapete'),
  (${MODELO_B}, 'DB127-BARCELONA',930001931, 930001932, 2.10, 'tapete')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID}, 990127, 2026, 'em_producao', 'tecelagem', NULL)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${OP_ITEM_A}, ${OP_ID}, ${MODELO_A}, 4000.00),
  (${OP_ITEM_B}, ${OP_ID}, ${MODELO_B}, 2000.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa) VALUES
  (${OP_ID}, ${FORN_TEC_ID}, 'cima')
  ON CONFLICT DO NOTHING;

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

function comoOperador(sql) {
  return `SET request.jwt.claim.sub = '${TEC_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}
function comoOutroOperador(sql) {
  return `SET request.jwt.claim.sub = '${OTHER_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}

const numerosDoLancamento = (lanc) =>
  `SELECT COALESCE(string_agg(numero::text, ',' ORDER BY numero), '') FROM public.tecelagem_rolos WHERE lancamento_id = ${lanc};`;

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
  const scratch = await mkdtemp(path.join(tmpdir(), 'db127-scratch-'));
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

    applyFile(handle, fixture, 'fixture db127');

    const adminAntes = scalar(handle, ADMIN_FINGERPRINT_SQL);

    // === O cenário exato da ordem: um lançamento de 5 rolos ================
    const lancA = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_A}, 5, NULL)->>'lancamento_id');`));
    check('o lançamento cria 001..005', scalar(handle, numerosDoLancamento(lancA)), '1,2,3,4,5');

    // Um SEGUNDO lançamento, de outro produto da mesma OP: nada que aconteça
    // ao primeiro pode tocá-lo.
    const lancB = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_B}, 2, NULL)->>'lancamento_id');`));
    check('o segundo lançamento cria 006..007', scalar(handle, numerosDoLancamento(lancB)), '6,7');

    const rolo003 = scalar(handle,
      `SELECT id FROM public.tecelagem_rolos WHERE lancamento_id = ${lancA} AND numero = 3;`);
    const contadorAntes = scalar(handle,
      `SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID};`);
    const rolosTotaisAntes = scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos;`);

    // === Autorização — excluir rolo alheio é recusado ======================
    const alheio = tryQuery(handle, comoOutroOperador(
      `SELECT public.excluir_rolo_tecelagem(${rolo003});`));
    check('um rolo de OUTRO fornecedor não pode ser excluído', alheio.ok, false);
    check('a recusa de rolo alheio carrega o código estável',
      /TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR/.test(alheio.out) ? 'sim' : alheio.out, 'sim');
    check('nada foi removido pela tentativa alheia',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos;`), rolosTotaisAntes);

    // === ACEITAÇÃO — excluir 003 ==========================================
    const resultado = scalar(handle, comoOperador(
      `SELECT (public.excluir_rolo_tecelagem(${rolo003})->>'numero');`));
    check('o escritor devolve o NÚMERO do rolo excluído, não um id técnico', resultado, '3');

    check('sobram exatamente 001, 002, 004 e 005 — sem renumeração',
      scalar(handle, numerosDoLancamento(lancA)), '1,2,4,5');
    check('o rolo 003 deixou de existir',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos WHERE lancamento_id = ${lancA} AND numero = 3;`), '0');
    check('nenhum rolo novo foi criado',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos;`), String(Number(rolosTotaisAntes) - 1));

    // === O lançamento continua internamente consistente ====================
    check('a contagem declarada do lançamento acompanha os rolos que existem',
      scalar(handle, `SELECT quantidade_rolos FROM public.tecelagem_producao_lancamentos WHERE id = ${lancA};`), '4');
    check('nenhum lançamento reivindica mais rolos do que contém',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_producao_lancamentos l
                       WHERE l.quantidade_rolos <> (SELECT count(*) FROM public.tecelagem_rolos r WHERE r.lancamento_id = l.id);`), '0');
    check('nenhum rolo órfão existe',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos r
                       WHERE NOT EXISTS (SELECT 1 FROM public.tecelagem_producao_lancamentos l WHERE l.id = r.lancamento_id);`), '0');

    // === NUMERAÇÃO É IDENTIDADE: o número liberado não volta a ser emitido ==
    check('o contador da OP NÃO foi rebobinado',
      scalar(handle, `SELECT proximo FROM public.tecelagem_rolo_sequencia WHERE op_id = ${OP_ID};`), contadorAntes);
    const lancC = scalar(handle, comoOperador(
      `SELECT (public.registrar_producao_tecelagem(${OP_ITEM_A}, 1, NULL)->>'lancamento_id');`));
    check('um registro posterior NÃO reemite o número 003 (a lacuna é permanente)',
      scalar(handle, numerosDoLancamento(lancC)), '8');

    // === O outro lote não foi tocado =======================================
    check('o lançamento do OUTRO produto permanece intacto',
      scalar(handle, numerosDoLancamento(lancB)), '6,7');
    check('a contagem declarada do outro lançamento permanece intacta',
      scalar(handle, `SELECT quantidade_rolos FROM public.tecelagem_producao_lancamentos WHERE id = ${lancB};`), '2');

    // === Um rolo já enviado ao acabamento NÃO pode ser excluído ============
    const rolo006 = scalar(handle,
      `SELECT id FROM public.tecelagem_rolos WHERE lancamento_id = ${lancB} AND numero = 6;`);
    scalar(handle, comoOperador(`SELECT public.enviar_rolos_acabamento(ARRAY[${rolo006}]::BIGINT[]);`));
    check('o rolo 006 foi enviado ao acabamento (db/125 segue funcionando)',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${rolo006};`), 'enviado_acabamento');

    const enviado = tryQuery(handle, comoOperador(
      `SELECT public.excluir_rolo_tecelagem(${rolo006});`));
    check('um rolo JÁ ENVIADO ao acabamento não pode ser excluído', enviado.ok, false);
    check('a recusa de rolo enviado carrega o código estável',
      /TECELAGEM_ROLO_JA_ENVIADO/.test(enviado.out) ? 'sim' : enviado.out, 'sim');
    check('o rolo enviado continua existindo, intacto',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = ${rolo006};`), 'enviado_acabamento');

    // === Um rolo inexistente é recusado, não ignorado =======================
    const inexistente = tryQuery(handle, comoOperador(
      `SELECT public.excluir_rolo_tecelagem(999000127);`));
    check('um rolo inexistente é recusado', inexistente.ok, false);
    check('a recusa de inexistente carrega o código estável',
      /TECELAGEM_ROLO_NAO_ENCONTRADO/.test(inexistente.out) ? 'sim' : inexistente.out, 'sim');

    // === DESFAZER LANÇAMENTO continua funcionando (db/126 preservado) =======
    // E funciona para um lote que JÁ PERDEU um rolo individualmente — é
    // exatamente aí que uma contagem declarada desatualizada o quebraria.
    check('o read model de recuperação ainda oferece o desfazer do lote reduzido',
      scalar(handle, comoOperador(
        `SELECT pode_desfazer || '/' || quantidade_rolos
           FROM public.tecelagem_lancamentos_recentes(${OP_ITEM_A}) WHERE lancamento_id = ${lancA};`)),
      'true/4');
    const undo = scalar(handle, comoOperador(
      `SELECT (public.desfazer_lancamento_tecelagem(${lancA})->>'rolos_removidos');`));
    check('desfazer um lote que perdeu um rolo remove os 4 restantes', undo, '4');
    check('o lote desfeito desapareceu',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_producao_lancamentos WHERE id = ${lancA};`), '0');
    check('o lote do outro produto sobreviveu ao desfazer do primeiro',
      scalar(handle, numerosDoLancamento(lancB)), '6,7');

    // === Excluir o ÚLTIMO rolo de um lote remove o lote vazio ===============
    const roloUnico = scalar(handle,
      `SELECT id FROM public.tecelagem_rolos WHERE lancamento_id = ${lancC};`);
    check('excluir o último rolo remove também o lançamento agora vazio',
      scalar(handle, comoOperador(
        `SELECT (public.excluir_rolo_tecelagem(${roloUnico})->>'lancamento_removido');`)), 'true');
    check('o lançamento vazio não sobrou',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_producao_lancamentos WHERE id = ${lancC};`), '0');
    check('e nenhum rolo órfão ficou para trás',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos r
                       WHERE NOT EXISTS (SELECT 1 FROM public.tecelagem_producao_lancamentos l WHERE l.id = r.lancamento_id);`), '0');

    // === Isolamento ========================================================
    check('o INÍCIO LOCAL da produção sobreviveu a todas as exclusões',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_op_execucao WHERE op_id = ${OP_ID};`), '1');
    check('o status Admin da OP permanece inalterado (em_producao)',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`), 'em_producao');
    check('o domínio Admin inteiro permanece IDÊNTICO ao de antes da tecelagem',
      scalar(handle, ADMIN_FINGERPRINT_SQL), adminAntes);
    check('nenhuma expedição/entrega foi criada pela tecelagem',
      scalar(handle, `SELECT (SELECT count(*) FROM public.expedicoes) = 0
                         AND (SELECT count(*) FROM public.entrega_itens) = 0;`), 't');

    // === ACL ================================================================
    check('nenhuma role ganhou DELETE direto em tecelagem_rolos',
      scalar(handle, `SELECT bool_or(has_table_privilege(r, 'public.tecelagem_rolos', 'DELETE'))
                         FROM unnest(ARRAY['anon','authenticated','service_role']) AS r;`), 'f');
    check('o escritor de exclusão é executável por authenticated',
      scalar(handle, `SELECT has_function_privilege('authenticated','public.excluir_rolo_tecelagem(bigint)','EXECUTE');`), 't');
    check('o escritor de exclusão NÃO é executável por anon nem service_role',
      scalar(handle, `SELECT has_function_privilege('anon','public.excluir_rolo_tecelagem(bigint)','EXECUTE')
                          OR has_function_privilege('service_role','public.excluir_rolo_tecelagem(bigint)','EXECUTE');`), 'f');
    check('o dono da elegibilidade de exclusão permanece owner-only',
      scalar(handle, `SELECT has_function_privilege('authenticated','public._tecelagem_rolo_pode_excluir(bigint,bigint)','EXECUTE')
                          OR has_function_privilege('anon','public._tecelagem_rolo_pode_excluir(bigint,bigint)','EXECUTE')
                          OR has_function_privilege('service_role','public._tecelagem_rolo_pode_excluir(bigint,bigint)','EXECUTE');`), 'f');

    log(failures === 0 ? 'DB127_INTEGRATION_PASS' : 'DB127_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
