// tests/db125-tecelagem-saida-acabamento.integration.mjs
//
// TECELAGEM-V1-FINISHING-OUTPUT-SLICE — db/125 integration driver.
//
// Reconstructs the schema on a fresh, isolated, disposable local PostgreSQL
// cluster (Supabase-platform preamble + the accepted 64-row corpus + the full
// db/01..db/125 migration manifest IN NATURAL NUMERIC ORDER — unlike
// tests/db123-tecelagem-rolos.integration.mjs, this driver does not skip and
// re-apply db/123 later: that special case existed only to snapshot the
// Admin domain around db/123's OWN introduction and is not needed here.
//
// Exercises public.enviar_rolos_acabamento AS THE IMPERSONATED SUPPLIER
// (SET request.jwt.claim.sub + SET ROLE authenticated, the same pattern
// already established in tests/db123-tecelagem-rolos.integration.mjs), not
// merely by inspecting the migration's own self-verify block:
//
//   - a partial, valid selection moves exactly those rolls and no others;
//   - an already-sent roll cannot be sent again (whole call refused, no
//     partial mutation);
//   - a roll belonging to another supplier is refused;
//   - a Manta roll is refused server-side, independent of any UI omission;
//   - roll identity (op_id, op_item_id, numero, comprimento_m) is preserved
//     across the transition.
//
// Out of scope by design, and enforced by construction: no remote host, no
// managed backend, no credential, no production contact of any kind. The only
// database this file can reach is the throwaway cluster it starts itself.
//
// Usage:  node tests/db125-tecelagem-saida-acabamento.integration.mjs

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL,
  applyFile, scalar, tryQuery, writeTemp, log,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 125;

// Mirrors tests/db123-tecelagem-rolos.integration.mjs exactly: Supabase
// re-grants ALL on every newly created public table/sequence by default, so
// every REVOKE in db/01..db/125 has to defeat a LIVE default grant here too,
// exactly as it does in the real project.
const SUPABASE_DEFAULT_ACL_SQL = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

// Mirrors tests/db123-tecelagem-rolos.integration.mjs exactly: db/116 onward
// assert the purchase-order cutover already reached its post-cutover resting
// state, which is operational state no from-scratch replay reaches on its
// own. Applied right after db/116, before db/117.
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
// Minimal weaving fixture. enviar_rolos_acabamento authorizes purely from
// tecelagem_rolos.fornecedor_id (set at roll-creation time) and re-derives
// applicability from op_itens.modelo_id -> modelos.tipo_produto: it needs no
// pedido, no lote and no OP-start eligibility chain at all, so none is built
// here — unlike tests/db123-tecelagem-rolos.integration.mjs, which fixtures
// the full pedido/lote chain because IT proves OP-start eligibility.
// ---------------------------------------------------------------------------
const TEC_USER_UUID   = '9d1f0000-0000-4000-8000-0000000c5001';
const OTHER_USER_UUID = '9d1f0000-0000-4000-8000-0000000c5002';
const FORN_TEC_ID     = 930001401;
const FORN_OUTRA_ID   = 930001402;
const OP_ID           = 930001501;
const OP_ITEM_TAPETE  = 930001511; // NOITE — vai para o acabamento
const OP_ITEM_MANTA   = 930001512; // ARABESCO — NAO vai para o acabamento
const MODELO_TAPETE   = 930001221;
const MODELO_MANTA    = 930001222;

const FIXTURE_SQL = `
SET session_replication_role = replica;

INSERT INTO auth.users(id, email) VALUES
  ('${TEC_USER_UUID}',   'db125-operador@example.invalid'),
  ('${OTHER_USER_UUID}', 'db125-outro@example.invalid')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_TEC_ID},   'DB125 Tecelagem Alvo',   'tecelagem'),
  (${FORN_OUTRA_ID}, 'DB125 Tecelagem Alheia', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios(id, email, nome, tipo, fornecedor_id, ativo, nivel_acesso) VALUES
  ('${TEC_USER_UUID}',   'db125-operador@example.invalid', 'Operador DB125', 'fornecedor', ${FORN_TEC_ID},   TRUE, 'completo'),
  ('${OTHER_USER_UUID}', 'db125-outro@example.invalid',    'Operador Alheio DB125', 'fornecedor', ${FORN_OUTRA_ID}, TRUE, 'completo')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cores (id, nome) VALUES
  (930001211, 'DB125-KRAFT'), (930001212, 'DB125-CRU'),
  (930001213, 'DB125-AZUL'),  (930001214, 'DB125-BEGE')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto) VALUES
  (${MODELO_TAPETE}, 'DB125-NOITE',    930001211, 930001212, 2.10, 'tapete'),
  (${MODELO_MANTA},  'DB125-ARABESCO', 930001213, 930001214, 1.40, 'manta')
  ON CONFLICT (id) DO NOTHING;

-- lote_id NULL: enviar_rolos_acabamento reads no Pedido/lote chain, so none
-- is fixtured. ops.tipo/lote_id already accept NULL in the accepted db/123
-- fixture (OP_BLOQUEADA), reused here for the same reason.
INSERT INTO public.ops (id, numero, ano, status, tipo, lote_id) VALUES
  (${OP_ID}, 990125, 2026, 'em_producao', 'tecelagem', NULL)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (${OP_ITEM_TAPETE}, ${OP_ID}, ${MODELO_TAPETE}, 4000.00),
  (${OP_ITEM_MANTA},  ${OP_ID}, ${MODELO_MANTA},  2000.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa) VALUES
  (${OP_ID}, ${FORN_TEC_ID}, 'cima')
  ON CONFLICT DO NOTHING;

-- Rolls inserted DIRECTLY (bypassing registrar_producao_tecelagem, exactly as
-- tests/db123-tecelagem-rolos.integration.mjs already does for ITS fixture):
-- this driver's subject is enviar_rolos_acabamento, not roll creation, which
-- is already proven elsewhere.
INSERT INTO public.tecelagem_rolo_sequencia (op_id, proximo) VALUES (${OP_ID}, 100)
  ON CONFLICT (op_id) DO NOTHING;

INSERT INTO public.tecelagem_producao_lancamentos
    (id, op_id, op_item_id, fornecedor_id, quantidade_rolos)
  VALUES
    (930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 5),
    (930001602, ${OP_ID}, ${OP_ITEM_MANTA},  ${FORN_TEC_ID}, 1)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tecelagem_rolos
    (id, lancamento_id, op_id, op_item_id, fornecedor_id, numero, comprimento_m, situacao, enviado_acabamento_em) VALUES
  -- Cinco rolos do produto Tapete, todos na_tecelagem, um já com comprimento.
  (930001701, 930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 1, 28.40, 'na_tecelagem',       NULL),
  (930001702, 930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 2, NULL,  'na_tecelagem',       NULL),
  (930001703, 930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 3, NULL,  'na_tecelagem',       NULL),
  (930001704, 930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 4, NULL,  'na_tecelagem',       NULL),
  -- Um rolo já enviado antes deste teste começar (para a prova de "já enviado").
  -- situacao e enviado_acabamento_em têm de nascer JUNTOS: é exatamente essa
  -- coerência que tecelagem_rolos_enviado_coerente (db/125) exige sempre.
  (930001705, 930001601, ${OP_ID}, ${OP_ITEM_TAPETE}, ${FORN_TEC_ID}, 5, 29.20, 'enviado_acabamento', now()),
  -- Um rolo de MANTA, na_tecelagem: nunca pode ser aceito por este escritor.
  (930001706, 930001602, ${OP_ID}, ${OP_ITEM_MANTA},  ${FORN_TEC_ID}, 6, NULL,  'na_tecelagem',       NULL)
  ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
`;

let failures = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  log(ok ? 'PASS' : 'FAIL', { caso: name, esperado: expected, obtido: actual });
  return ok;
}

// Runs `sql` impersonating the target weaving operator, exactly like
// tests/db123-tecelagem-rolos.integration.mjs's established pattern.
function comoOperador(handle, sql) {
  return `SET request.jwt.claim.sub = '${TEC_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}
function comoOutroOperador(handle, sql) {
  return `SET request.jwt.claim.sub = '${OTHER_USER_UUID}'; SET ROLE authenticated;\n${sql}\nRESET ROLE;`;
}

async function main() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'db125-scratch-'));
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

    applyFile(handle, fixture, 'fixture db125');

    // === Admin-domain snapshot (lightweight: row counts + key columns) =====
    const antesOps = scalar(handle, `SELECT count(*) || '|' || string_agg(status, ',' ORDER BY id) FROM public.ops WHERE id NOT IN (${OP_ID});`);

    // === Scenario C — already-sent roll refused, whole call refused ========
    const jaEnviadoErro = tryQuery(handle, comoOperador(handle,
      `SELECT public.enviar_rolos_acabamento(ARRAY[930001705, 930001701]::BIGINT[]);`));
    check('rolo ja enviado no lote recusa a chamada inteira (nenhuma mutacao)', jaEnviadoErro.ok, false);
    check('a recusa de ja-enviado carrega o codigo estavel',
      /TECELAGEM_ROLO_NAO_ELEGIVEL_PARA_SAIDA/.test(jaEnviadoErro.out) ? 'sim' : jaEnviadoErro.out, 'sim');
    check('apos a recusa, o rolo 701 continua na_tecelagem (nenhuma mutacao parcial)',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = 930001701;`), 'na_tecelagem');

    // === Scenario: cross-supplier roll refused ==============================
    const alheioErro = tryQuery(handle, comoOutroOperador(handle,
      `SELECT public.enviar_rolos_acabamento(ARRAY[930001701]::BIGINT[]);`));
    check('um rolo de OUTRO fornecedor e recusado', alheioErro.ok, false);
    check('a recusa de rolo alheio carrega o codigo estavel',
      /TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR/.test(alheioErro.out) ? 'sim' : alheioErro.out, 'sim');

    // === Scenario E — Manta refused server-side ==============================
    const mantaErro = tryQuery(handle, comoOperador(handle,
      `SELECT public.enviar_rolos_acabamento(ARRAY[930001706]::BIGINT[]);`));
    check('um rolo de MANTA e recusado pelo servidor, independente da UI', mantaErro.ok, false);
    check('a recusa de Manta carrega o codigo estavel',
      /TECELAGEM_MANTA_NAO_VAI_PARA_ACABAMENTO/.test(mantaErro.out) ? 'sim' : mantaErro.out, 'sim');
    check('o rolo de manta continua na_tecelagem apos a recusa',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = 930001706;`), 'na_tecelagem');

    // === Scenario A/B — partial output, identity preserved =================
    scalar(handle, comoOperador(handle,
      `SELECT public.enviar_rolos_acabamento(ARRAY[930001701, 930001702, 930001703]::BIGINT[]);`));

    check('exatamente os 3 selecionados mudaram de situacao',
      scalar(handle, `SELECT count(*) FROM public.tecelagem_rolos
                        WHERE id IN (930001701,930001702,930001703) AND situacao = 'enviado_acabamento';`),
      '3');
    check('o rolo NAO selecionado (704) permanece na_tecelagem',
      scalar(handle, `SELECT situacao FROM public.tecelagem_rolos WHERE id = 930001704;`),
      'na_tecelagem');
    check('a identidade do rolo (op_id/op_item_id/numero) e preservada',
      scalar(handle, `SELECT op_id || '/' || op_item_id || '/' || numero FROM public.tecelagem_rolos WHERE id = 930001701;`),
      `${OP_ID}/${OP_ITEM_TAPETE}/1`);
    check('o comprimento de tecelagem registrado e preservado (nao apagado pela saida)',
      scalar(handle, `SELECT comprimento_m FROM public.tecelagem_rolos WHERE id = 930001701;`),
      '28.40');
    check('a ausencia de comprimento tambem e preservada para um rolo sem medida',
      scalar(handle, `SELECT comprimento_m IS NULL FROM public.tecelagem_rolos WHERE id = 930001702;`),
      't');
    check('o momento da saida foi registrado (auditoria)',
      scalar(handle, `SELECT enviado_acabamento_em IS NOT NULL FROM public.tecelagem_rolos WHERE id = 930001701;`),
      't');
    check('o autor da saida foi registrado (auditoria)',
      scalar(handle, `SELECT enviado_acabamento_por = '${TEC_USER_UUID}' FROM public.tecelagem_rolos WHERE id = 930001701;`),
      't');

    // Re-selecting an already-sent roll (930001701, just sent above) is
    // refused, proving Scenario C end to end through the writer itself, not
    // only against the pre-seeded fixture roll.
    const reenvioErro = tryQuery(handle, comoOperador(handle,
      `SELECT public.enviar_rolos_acabamento(ARRAY[930001701]::BIGINT[]);`));
    check('um rolo recem-enviado nao pode ser reenviado', reenvioErro.ok, false);

    // === Scenario F — Admin isolation (lightweight) =========================
    check('a tabela ops (fora da OP de trabalho) permanece inalterada',
      scalar(handle, `SELECT count(*) || '|' || string_agg(status, ',' ORDER BY id) FROM public.ops WHERE id NOT IN (${OP_ID});`),
      antesOps);
    check('nenhum evento/registro administrativo de acabamento foi criado',
      scalar(handle, `SELECT to_regclass('public.expedicoes') IS NULL OR
                             (SELECT count(*) FROM public.expedicoes) = 0;`),
      't');
    check('a OP de trabalho continua com o status Admin inalterado (em_producao)',
      scalar(handle, `SELECT status FROM public.ops WHERE id = ${OP_ID};`),
      'em_producao');

    // === Writer/table ACL shape (mirrors db/123's own proof style) =========
    check('nenhuma role ganhou UPDATE direto em tecelagem_rolos',
      scalar(handle, `SELECT bool_or(has_table_privilege(r, 'public.tecelagem_rolos', 'UPDATE'))
                         FROM unnest(ARRAY['anon','authenticated','service_role']) AS r;`),
      'f');
    check('o escritor de saida e executavel por authenticated',
      scalar(handle, `SELECT has_function_privilege('authenticated','public.enviar_rolos_acabamento(bigint[])','EXECUTE');`),
      't');
    check('o escritor de saida NAO e executavel por anon',
      scalar(handle, `SELECT has_function_privilege('anon','public.enviar_rolos_acabamento(bigint[])','EXECUTE');`),
      'f');

    log(failures === 0 ? 'DB125_INTEGRATION_PASS' : 'DB125_INTEGRATION_FAIL', { falhas: failures });
  } finally {
    if (handle) { try { await handle.stop(); log('TEARDOWN_OK'); } catch (e) { log('TEARDOWN_ERRO', { erro: e.message }); } }
    await rm(scratch, { recursive: true, force: true });
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER_ERRO:', e.message); process.exit(2); });
