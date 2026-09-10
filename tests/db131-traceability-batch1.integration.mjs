// Batch 1 traceability qualification on a fresh local disposable PostgreSQL.
// Applies the complete db/01..db/131 history, proves compatibility and security,
// and destroys the cluster. No shared, remote or managed database is reachable.

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bootstrapCluster, getRepoRoot } from '../scripts/c3d/bootstrap-disposable-cluster.mjs';
import {
  PREAMBLE_SQL, CORPUS_SQL, applyFile, scalar, tryQuery, writeTemp, log,
  openSession, waitFor,
} from '../scripts/c3d/p1-harness.mjs';

const REPO_ROOT = getRepoRoot();
const TERMINAL = 131;
const ADMIN_UID = '9d1f0000-0000-4000-8000-0000000d1001';
const CLIENT_UID = '9d1f0000-0000-4000-8000-0000000d1002';
const OTHER_UID = '9d1f0000-0000-4000-8000-0000000d1003';
const CLIENT_ID = 930013001;
const OTHER_CLIENT_ID = 930013002;
const MODEL_TAPETE = 930013101;
const MODEL_MANTA = 930013102;
const HIST_PEDIDO = '9d1f0000-0000-4000-8000-0000000d1301';
const HIST_ITEM = '9d1f0000-0000-4000-8000-0000000d1302';

const SUPABASE_DEFAULT_ACL_SQL = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

const CUTOVER_REHEARSAL_SQL = `
SET session_replication_role = replica;
UPDATE public.ordem_compra_cutover
   SET status='canonical_active', read_authority='canonical',
       reconciliation_status='reconciled', cutover_generation=COALESCE(cutover_generation,1),
       snapshot_captured_at=COALESCE(snapshot_captured_at, TIMESTAMPTZ '2026-01-01 00:00:00+00'),
       import_started_at=COALESCE(import_started_at, TIMESTAMPTZ '2026-01-01 00:10:00+00'),
       import_completed_at=COALESCE(import_completed_at, TIMESTAMPTZ '2026-01-01 00:20:00+00'),
       final_acl_closed_at=COALESCE(final_acl_closed_at, TIMESTAMPTZ '2026-01-01 00:30:00+00'),
       canonical_activated_at=COALESCE(canonical_activated_at, TIMESTAMPTZ '2026-01-01 00:40:00+00'),
       productive_receipt_started_at=NULL
 WHERE id=1;
SET session_replication_role = origin;
`;

// Installed after db/129 but before db/130 so HIST_ITEM is genuine pre-Batch-1 data.
const PRE_BATCH_FIXTURE_SQL = `
SET session_replication_role = replica;
INSERT INTO public.cores (id, nome) VALUES
  (930013201, 'B1-COR-A'), (930013202, 'B1-COR-B') ON CONFLICT DO NOTHING;
INSERT INTO public.clientes (id, nome) VALUES
  (${CLIENT_ID}, 'B1 Cliente'), (${OTHER_CLIENT_ID}, 'B1 Outro Cliente') ON CONFLICT DO NOTHING;
INSERT INTO public.modelos (id, nome, largura, cor_1_id, cor_2_id, tipo_produto) VALUES
  (${MODEL_TAPETE}, 'B1 Tapete', 2.10, 930013201, 930013202, 'tapete'),
  (${MODEL_MANTA}, 'B1 Manta', 1.40, 930013202, 930013201, 'manta') ON CONFLICT DO NOTHING;
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_UID}', 'b1-admin@example.invalid'),
  ('${CLIENT_UID}', 'b1-client@example.invalid'),
  ('${OTHER_UID}', 'b1-other@example.invalid') ON CONFLICT DO NOTHING;
INSERT INTO public.usuarios (id, email, nome, tipo, cliente_id, ativo) VALUES
  ('${ADMIN_UID}', 'b1-admin@example.invalid', 'B1 Admin', 'admin', NULL, TRUE),
  ('${CLIENT_UID}', 'b1-client@example.invalid', 'B1 Cliente', 'cliente', ${CLIENT_ID}, TRUE),
  ('${OTHER_UID}', 'b1-other@example.invalid', 'B1 Outro', 'cliente', ${OTHER_CLIENT_ID}, TRUE)
  ON CONFLICT DO NOTHING;
INSERT INTO public.pedidos (id, cliente_id, numero, status, data_pedido, observacao)
  VALUES ('${HIST_PEDIDO}', ${CLIENT_ID}, 3, 'recebido', DATE '2026-08-01', 'pre-batch');
SELECT setval(pg_get_serial_sequence('public.pedidos','numero'),
              (SELECT max(numero) FROM public.pedidos), true);
INSERT INTO public.pedido_itens (id, pedido_id, modelo_id, metros, ordem)
  VALUES ('${HIST_ITEM}', '${HIST_PEDIDO}', ${MODEL_TAPETE}, 8.00, 0);
UPDATE public.ops
   SET identidade_pedido_id='${HIST_PEDIDO}', identidade_pedido_numero=3,
       identidade_pedido_ano=2026, identidade_tipo_letra='T', identidade_seq=1
 WHERE id=930000101;
SET session_replication_role = origin;
`;

async function resolveManifest() {
  const entries = await readdir(path.join(REPO_ROOT, 'db'));
  return entries
    .filter((f) => /^\d{2,}[a-z]?_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f))
    .map((f) => {
      const m = f.match(/^(\d+)([a-z]?)_/);
      return { n: Number(m[1]), suffix: m[2] || '', name: f, file: path.join(REPO_ROOT, 'db', f) };
    })
    .sort((a, b) => (a.n - b.n) || a.suffix.localeCompare(b.suffix));
}

let failures = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  log(ok ? 'PASS' : 'FAIL', { caso: name, esperado: expected, obtido: actual });
  return ok;
}
const roleSql = (uid, sql, role = 'authenticated') =>
  `BEGIN; SET LOCAL ROLE ${role}; SET LOCAL request.jwt.claim.sub='${uid}'; ${sql} COMMIT;`;
const asAdmin = (h, sql) => scalar(h, roleSql(ADMIN_UID, sql));
const asClient = (h, sql) => scalar(h, roleSql(CLIENT_UID, sql));
const failAs = (h, uid, sql) => tryQuery(h, roleSql(uid, sql));
const revision = (h, pedido) => scalar(h, `SELECT revisao FROM public.pedidos WHERE id='${pedido}';`);
const itemId = (h, pedido) => scalar(h, `SELECT id FROM public.pedido_itens WHERE pedido_id='${pedido}' ORDER BY ordem LIMIT 1;`);
const itemState = (h, pedido) => scalar(h, `SELECT coalesce(requires_finishing::text,'NULL')||'|'||coalesce(requires_finishing_origin,'NULL')||'|'||requires_finishing_revision FROM public.pedido_itens WHERE pedido_id='${pedido}' ORDER BY ordem LIMIT 1;`);
const sessionRole = (uid) => `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${uid}';`;

const adminCreate = (h, requiresPart, model = MODEL_TAPETE) => asAdmin(h, `
  SELECT (public.criar_pedido_admin(
    '{"cliente_id":${CLIENT_ID},"data_pedido":"2026-09-01"}'::jsonb,
    '[{"modelo_id":${model},"metros":10${requiresPart}}]'::jsonb,
    NULL)->'pedido'->>'id');`);
const clientCreate = (h, requiresPart, model = MODEL_TAPETE) => asClient(h, `
  SELECT (public.criar_pedido_cliente(
    '{"cliente_id":${CLIENT_ID},"data_pedido":"2026-09-02"}'::jsonb,
    '[{"modelo_id":${model},"metros":12${requiresPart}}]'::jsonb,
    NULL)->'pedido'->>'id');`);

async function main() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'db131-batch1-'));
  let handle = null;
  try {
    log('BOOT', { alvo: 'INNTRACKER_TRACEABILITY_BATCH1_LOCAL_DISPOSABLE' });
    handle = await bootstrapCluster({});
    check('disposable binds loopback only', handle.host, '127.0.0.1');

    const manifest = (await resolveManifest()).filter((m) => m.n <= TERMINAL);
    check('terminal migration identity', manifest.at(-1).name, '131_pedido_external_identifiers.sql');
    const preamble = await writeTemp(scratch, 'preamble.sql', PREAMBLE_SQL + SUPABASE_DEFAULT_ACL_SQL);
    const corpus = await writeTemp(scratch, 'corpus.sql', CORPUS_SQL);
    const cutover = await writeTemp(scratch, 'cutover.sql', CUTOVER_REHEARSAL_SQL);
    const fixture = await writeTemp(scratch, 'pre-batch-fixture.sql', PRE_BATCH_FIXTURE_SQL);
    applyFile(handle, preamble, 'preamble');
    for (const m of manifest) {
      if (m.n === 130) applyFile(handle, fixture, 'pre-Batch-1 fixture');
      applyFile(handle, m.file, m.name);
      if (m.n === 66 && m.suffix === '') applyFile(handle, corpus, 'corpus');
      if (m.n === 116) applyFile(handle, cutover, 'cutover rehearsal fixture');
    }
    log('FULL_HISTORY_APPLIED', { migrations: manifest.length, terminal: TERMINAL });

    // Historical compatibility: no UPDATE/backfill occurred.
    check('historical row remains unresolved', itemState(handle, HIST_PEDIDO), 'NULL|NULL|0');
    check('historical row created no applicability event', scalar(handle,
      `SELECT count(*) FROM public.pedido_item_applicability_events WHERE pedido_item_id='${HIST_ITEM}';`), '0');
    asAdmin(handle, `SELECT public.salvar_pedido_admin('${HIST_PEDIDO}', ${revision(handle, HIST_PEDIDO)},
      '{"observacao":"legacy header edit"}'::jsonb, NULL, NULL, false);`);
    check('historical unresolved survives unrelated edit', itemState(handle, HIST_PEDIDO), 'NULL|NULL|0');
    asAdmin(handle, `SELECT public.salvar_pedido_admin('${HIST_PEDIDO}', ${revision(handle, HIST_PEDIDO)}, NULL,
      '[{"pedido_item_id":"${HIST_ITEM}","modelo_id":${MODEL_MANTA},"metros":8}]'::jsonb, NULL, false);`);
    check('historical unresolved survives old-payload model edit', itemState(handle, HIST_PEDIDO), 'NULL|NULL|0');
    check('historical old payload still fabricates no audit event', scalar(handle,
      `SELECT count(*) FROM public.pedido_item_applicability_events WHERE pedido_item_id='${HIST_ITEM}';`), '0');

    // Canonical creation accepts explicit YES, explicit NO and old payloads.
    const yes = adminCreate(handle, ',"requires_finishing":true');
    const no = adminCreate(handle, ',"requires_finishing":false');
    const old = adminCreate(handle, '', MODEL_MANTA);
    const clientPedido = clientCreate(handle, ',"requires_finishing":true');
    check('admin explicit YES is human-owned', itemState(handle, yes), 'true|EXPLICIT_HUMAN|1');
    check('admin explicit NO is distinct, not numeric zero', itemState(handle, no), 'false|EXPLICIT_HUMAN|1');
    check('old payload receives model default', itemState(handle, old), 'false|MODEL_DEFAULT|1');
    check('client canonical writer accepts explicit YES', itemState(handle, clientPedido), 'true|EXPLICIT_HUMAN|1');
    check('one append-only event per created item', scalar(handle,
      `SELECT count(*) FROM public.pedido_item_applicability_events WHERE pedido_item_id IN ('${itemId(handle, yes)}','${itemId(handle, no)}','${itemId(handle, old)}','${itemId(handle, clientPedido)}');`), '4');

    // Old payload preservation, model-change preservation and dedicated correction.
    const yesItem = itemId(handle, yes);
    asAdmin(handle, `SELECT public.salvar_pedido_admin('${yes}', ${revision(handle, yes)}, '{"observacao":"header only"}'::jsonb, NULL, NULL, false);`);
    check('header-only save preserves applicability', itemState(handle, yes), 'true|EXPLICIT_HUMAN|1');
    asAdmin(handle, `SELECT public.salvar_pedido_admin('${yes}', ${revision(handle, yes)}, NULL,
      '[{"pedido_item_id":"${yesItem}","modelo_id":${MODEL_MANTA},"metros":11}]'::jsonb, NULL, false);`);
    check('model change without field preserves applicability', itemState(handle, yes), 'true|EXPLICIT_HUMAN|1');
    const beforeCorrection = itemState(handle, yes);
    const ordinaryCorrection = failAs(handle, ADMIN_UID, `SELECT public.salvar_pedido_admin('${yes}', ${revision(handle, yes)}, NULL,
      '[{"pedido_item_id":"${yesItem}","modelo_id":${MODEL_MANTA},"metros":11,"requires_finishing":false}]'::jsonb, NULL, false);`);
    check('ordinary correction is refused at authority boundary', /DEDICATED_COMMAND_REQUIRED/.test(ordinaryCorrection.out), true);
    const ordinaryReasoned = failAs(handle, ADMIN_UID, `SELECT public.salvar_pedido_admin('${yes}', ${revision(handle, yes)}, NULL,
      '[{"pedido_item_id":"${yesItem}","modelo_id":${MODEL_MANTA},"metros":11,"requires_finishing":false,"requires_finishing_reason":"confirmed by operator"}]'::jsonb, NULL, false);`);
    check('reason does not let ordinary writer cross authority boundary', /DEDICATED_COMMAND_REQUIRED/.test(ordinaryReasoned.out), true);
    check('refused ordinary corrections are atomic', itemState(handle, yes), beforeCorrection);

    const applicabilityCommand = '9d1f0000-0000-4000-8000-0000000d1351';
    check('dedicated correction advances applicability revision', asAdmin(handle, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',false,1,'${applicabilityCommand}','confirmed by operator')->>'revision';`), '2');
    check('dedicated identical command replays', asAdmin(handle, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',false,1,'${applicabilityCommand}','confirmed by operator')->>'replay';`), 'true');
    check('dedicated replay adds no applicability event', scalar(handle, `
      SELECT count(*) FROM public.pedido_item_applicability_events WHERE command_id='${applicabilityCommand}';`), '1');
    const changedApplicabilityIntent = failAs(handle, ADMIN_UID, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',true,1,'${applicabilityCommand}','confirmed by operator');`);
    check('dedicated command changed intent conflicts', /COMMAND_CONFLICT/.test(changedApplicabilityIntent.out), true);
    const staleApplicability = failAs(handle, ADMIN_UID, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',true,1,'9d1f0000-0000-4000-8000-0000000d1352','stale correction');`);
    check('different applicability command with stale revision is refused', /STALE_REVISION/.test(staleApplicability.out), true);
    check('stale applicability command changes nothing', itemState(handle, yes), 'false|CORRECTION|2');
    const unauthorizedApplicability = failAs(handle, CLIENT_UID, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',true,2,'9d1f0000-0000-4000-8000-0000000d1353','unauthorized');`);
    check('non-admin cannot use dedicated applicability command', /FORBIDDEN/.test(unauthorizedApplicability.out), true);
    check('correction audit captures before/after/reason', scalar(handle, `
      SELECT previous_value::text||'>'||new_value::text||'|'||new_origin||'|'||reason
        FROM public.pedido_item_applicability_events WHERE pedido_item_id='${yesItem}' ORDER BY applicability_revision DESC LIMIT 1;`),
      'true>false|CORRECTION|confirmed by operator');

    const unresolvedOrdinary = failAs(handle, ADMIN_UID, `SELECT public.salvar_pedido_admin('${HIST_PEDIDO}', ${revision(handle, HIST_PEDIDO)}, NULL,
      '[{"pedido_item_id":"${HIST_ITEM}","modelo_id":${MODEL_MANTA},"metros":8,"requires_finishing":true}]'::jsonb, NULL, false);`);
    check('ordinary writer cannot classify historical unresolved state', /DEDICATED_COMMAND_REQUIRED/.test(unresolvedOrdinary.out), true);
    check('dedicated command classifies historical unresolved state', asAdmin(handle, `
      SELECT public.definir_requires_finishing_pedido_item('${HIST_ITEM}',true,0,'9d1f0000-0000-4000-8000-0000000d1354','historical classification')->>'origin';`), 'EXPLICIT_HUMAN');

    // Change requests are ordinary flows and cannot smuggle a correction.
    scalar(handle, `SET session_replication_role=replica; UPDATE public.pedidos SET status='confirmado' WHERE id='${clientPedido}'; SET session_replication_role=origin;`);
    const clientItem = itemId(handle, clientPedido);
    const requestCorrection = failAs(handle, CLIENT_UID, `SELECT public.solicitar_alteracao_pedido('${clientPedido}', NULL,
      '[{"pedido_item_id":"${clientItem}","modelo_id":${MODEL_TAPETE},"metros":12,"requires_finishing":false,"requires_finishing_reason":"client correction"}]'::jsonb,
      NULL, 'correct finishing applicability');`);
    check('change-request flow cannot become correction authority', /DEDICATED_COMMAND_REQUIRED/.test(requestCorrection.out), true);
    check('rejected change request preserves applicability', itemState(handle, clientPedido), 'true|EXPLICIT_HUMAN|1');

    // Canonical production linkage changes the ordinary rejection class.
    const productionOpItem = scalar(handle, `SET session_replication_role=replica;
      INSERT INTO public.op_itens(op_id,modelo_id,metros_pedidos,pedido_item_id)
      VALUES (930000101,${MODEL_MANTA},11,'${yesItem}') RETURNING id;
      SET session_replication_role=origin;`);
    const productionOrdinary = failAs(handle, ADMIN_UID, `SELECT public.salvar_pedido_admin('${yes}', ${revision(handle, yes)}, NULL,
      '[{"pedido_item_id":"${yesItem}","modelo_id":${MODEL_MANTA},"metros":11,"requires_finishing":true}]'::jsonb, NULL, false);`);
    check('ordinary correction with production evidence gets production refusal', /PRODUCTION_EVIDENCE_DEDICATED_COMMAND_REQUIRED/.test(productionOrdinary.out), true);
    check('dedicated correction remains governed production path', asAdmin(handle, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',true,2,'9d1f0000-0000-4000-8000-0000000d1355','production-reviewed correction')->>'revision';`), '3');
    const productionLaunch = scalar(handle, `SET session_replication_role=replica;
      INSERT INTO public.tecelagem_producao_lancamentos(op_id,op_item_id,fornecedor_id,quantidade_rolos)
      VALUES (930000101,${productionOpItem},930000301,1) RETURNING id;
      SET session_replication_role=origin;`);
    scalar(handle, `SET session_replication_role=replica;
      INSERT INTO public.tecelagem_rolos(lancamento_id,op_id,op_item_id,fornecedor_id,numero,situacao,enviado_acabamento_em)
      VALUES (${productionLaunch},930000101,${productionOpItem},930000301,1,'enviado_acabamento',now());
      SET session_replication_role=origin;`);
    const downstreamConflict = failAs(handle, ADMIN_UID, `
      SELECT public.definir_requires_finishing_pedido_item('${yesItem}',false,3,'9d1f0000-0000-4000-8000-0000000d1356','would contradict sent roll');`);
    check('dedicated false correction rejects sent finishing evidence', /DOWNSTREAM_FINISHING_EVIDENCE_CONFLICT/.test(downstreamConflict.out), true);
    check('downstream conflict is atomic', itemState(handle, yes), 'true|CORRECTION|3');

    // Writer and audit boundaries.
    const auditCountBeforeDirect = scalar(handle,
      `SELECT count(*) FROM public.pedido_item_applicability_events WHERE pedido_item_id='${yesItem}';`);
    const directCount = asClient(handle,
      `WITH u AS (UPDATE public.pedido_itens SET requires_finishing=true WHERE id='${yesItem}' RETURNING 1) SELECT count(*) FROM u;`);
    check('client direct applicability DML affects zero rows', directCount, '0');
    check('client direct applicability DML changes nothing', itemState(handle, yes), 'true|CORRECTION|3');
    const adminDirect = tryQuery(handle, `BEGIN;
      ${sessionRole(ADMIN_UID)}
      UPDATE public.pedido_itens
         SET requires_finishing=false, requires_finishing_origin='CORRECTION'
       WHERE id='${yesItem}';
      ROLLBACK;`);
    check('admin direct applicability DML is denied by the authority trigger',
      /PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN/.test(adminDirect.out), true);
    const oldGucSpoof = tryQuery(handle, `BEGIN;
      ${sessionRole(ADMIN_UID)}
      SELECT set_config('app.traceability_applicability_writer','on',true);
      UPDATE public.pedido_itens
         SET requires_finishing=false, requires_finishing_origin='CORRECTION'
       WHERE id='${yesItem}';
      ROLLBACK;`);
    check('old caller-controlled writer GUC cannot authorize direct applicability DML',
      /PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN/.test(oldGucSpoof.out), true);
    const metadataSpoof = tryQuery(handle, `BEGIN;
      ${sessionRole(ADMIN_UID)}
      SELECT set_config('request.jwt.claim.role','postgres',true);
      SELECT set_config('app.traceability_process','pedido_itens_reconciliar',true);
      SELECT set_config('app.traceability_command_id','9d1f0000-0000-4000-8000-0000000d13ff',true);
      SELECT set_config('app.traceability_reason','spoofed authority',true);
      UPDATE public.pedido_itens
         SET requires_finishing=false, requires_finishing_origin='CORRECTION'
       WHERE id='${yesItem}';
      ROLLBACK;`);
    check('request and audit metadata cannot authorize direct applicability DML',
      /PEDIDO_ITEM_APPLICABILITY_DIRECT_WRITE_FORBIDDEN/.test(metadataSpoof.out), true);
    check('all rejected direct applicability attempts preserve state', itemState(handle, yes), 'true|CORRECTION|3');
    check('all rejected direct applicability attempts create no audit event', scalar(handle,
      `SELECT count(*) FROM public.pedido_item_applicability_events WHERE pedido_item_id='${yesItem}';`), auditCountBeforeDirect);
    const immutable = tryQuery(handle,
      `UPDATE public.pedido_item_applicability_events SET reason='tamper' WHERE pedido_item_id='${yesItem}';`);
    check('applicability history is immutable', /APPLICABILITY_AUDIT_IMMUTABLE/.test(immutable.out), true);

    // Exact typed external identifiers, explicit correction and revocation.
    const opIdentityBefore = scalar(handle, `
      SELECT md5(string_agg(id::text||':'||coalesce(identidade_operacional,'NULL'),',' ORDER BY id)) FROM public.ops;`);
    check('internal identity fixture is canonical OP-T003-1-26', scalar(handle,
      `SELECT identidade_operacional FROM public.ops WHERE id=930000101;`), 'OP-T003-1-26');
    const pedidoNumeroBefore = scalar(handle, `SELECT numero FROM public.pedidos WHERE id='${yes}';`);
    const cmdMap = '9d1f0000-0000-4000-8000-0000000d1401';
    const cmdCorrection = '9d1f0000-0000-4000-8000-0000000d1402';
    const cmdRevoke = '9d1f0000-0000-4000-8000-0000000d1403';
    check('initial external mapping is explicit MAP', asAdmin(handle,
      `SELECT public.mapear_identificador_externo_pedido('legacy','00226','${yes}',0,'${cmdMap}',NULL)->>'action';`), 'MAP');
    check('exact lookup resolves mapped Pedido', asClient(handle,
      `SELECT public.buscar_pedido_por_identificador_externo('legacy','00226');`), yes);
    check('case/literal mismatch does not resolve', asClient(handle,
      `SELECT coalesce(public.buscar_pedido_por_identificador_externo('legacy','00226 ' )::text,'NULL');`), 'NULL');
    check('namespace mismatch does not heuristically resolve', asClient(handle,
      `SELECT coalesce(public.buscar_pedido_por_identificador_externo('t_series','00226')::text,'NULL');`), 'NULL');
    asAdmin(handle, `SELECT public.mapear_identificador_externo_pedido('t_series','T002-26','${no}',0,'9d1f0000-0000-4000-8000-0000000d1411',NULL);`);
    asAdmin(handle, `SELECT public.mapear_identificador_externo_pedido('legacy','00326','${old}',0,'9d1f0000-0000-4000-8000-0000000d1412',NULL);`);
    asAdmin(handle, `SELECT public.mapear_identificador_externo_pedido('t_series','T003-26','${clientPedido}',0,'9d1f0000-0000-4000-8000-0000000d1413',NULL);`);
    const opLiteralAsPedido = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('t_series','OP-T003-1-26','${yes}',0,'9d1f0000-0000-4000-8000-0000000d1414',NULL);`);
    check('OP-form literal is rejected from Pedido T-series namespace', /LITERAL_INVALID_FOR_NAMESPACE/.test(opLiteralAsPedido.out), true);
    check('00226 and T002-26 coexist distinctly', scalar(handle, `
      SELECT count(*)=2 AND count(DISTINCT literal_value)=2 FROM public.pedido_external_identifiers
       WHERE (namespace,literal_value) IN (('legacy','00226'),('t_series','T002-26'));`), 't');
    check('00326 and T003-26 coexist distinctly', scalar(handle, `
      SELECT count(*)=2 AND count(DISTINCT literal_value)=2 FROM public.pedido_external_identifiers
       WHERE (namespace,literal_value) IN (('legacy','00326'),('t_series','T003-26'));`), 't');
    check('T003-26 remains separate from OP-T003-1-26', scalar(handle, `
      SELECT i.literal_value <> o.identidade_operacional
        FROM public.pedido_external_identifiers i CROSS JOIN public.ops o
       WHERE i.namespace='t_series' AND i.literal_value='T003-26' AND o.id=930000101;`), 't');
    const unauthMap = failAs(handle, CLIENT_UID,
      `SELECT public.mapear_identificador_externo_pedido('legacy','T002-26','${yes}',0,'9d1f0000-0000-4000-8000-0000000d1499',NULL);`);
    check('client cannot map external identifiers', /FORBIDDEN/.test(unauthMap.out), true);
    const duplicateActive = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('legacy','00226','${yes}',1,'9d1f0000-0000-4000-8000-0000000d1498',NULL);`);
    check('duplicate active mapping is rejected', /ALREADY_MAPPED/.test(duplicateActive.out), true);
    const correctionNoReason = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('legacy','00226','${no}',1,'${cmdCorrection}',NULL);`);
    check('mapping correction requires a reason', /CORRECTION_REASON_REQUIRED/.test(correctionNoReason.out), true);
    check('failed mapping correction preserves target', asAdmin(handle,
      `SELECT public.buscar_pedido_por_identificador_externo('legacy','00226');`), yes);
    check('reasoned mapping correction advances revision', asAdmin(handle,
      `SELECT public.mapear_identificador_externo_pedido('legacy','00226','${no}',1,'${cmdCorrection}','source correction')->>'revision';`), '2');
    const staleMapping = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('legacy','00226','${yes}',1,'9d1f0000-0000-4000-8000-0000000d1497','stale target');`);
    check('stale mapping revision is rejected', /STALE_REVISION/.test(staleMapping.out), true);
    check('mapping history exact semantic shape', scalar(handle, `
      SELECT count(*)=2 AND bool_or(e.action='MAP' AND e.previous_pedido_id IS NULL AND e.new_pedido_id='${yes}')
             AND bool_or(e.action='CORRECTION' AND e.previous_pedido_id='${yes}' AND e.new_pedido_id='${no}')
        FROM public.pedido_external_identifier_events e
        JOIN public.pedido_external_identifiers i ON i.id=e.external_identifier_id
       WHERE i.namespace='legacy' AND i.literal_value='00226';`), 't');
    check('revocation advances revision', asAdmin(handle,
      `SELECT public.revogar_identificador_externo_pedido('legacy','00226',2,'${cmdRevoke}','retired source')->>'revision';`), '3');
    check('revoked identifier no longer resolves', asAdmin(handle,
      `SELECT coalesce(public.buscar_pedido_por_identificador_externo('legacy','00226')::text,'NULL');`), 'NULL');
    check('idempotent command replay adds no event', asAdmin(handle,
      `SELECT public.revogar_identificador_externo_pedido('legacy','00226',2,'${cmdRevoke}','retired source')->>'replay';`), 'true');
    check('mapping event count remains six', scalar(handle,
      `SELECT count(*) FROM public.pedido_external_identifier_events;`), '6');
    const commandConflict = failAs(handle, ADMIN_UID,
      `SELECT public.revogar_identificador_externo_pedido('legacy','00226',2,'${cmdRevoke}','different payload');`);
    check('command id reuse with changed payload is rejected', /COMMAND_CONFLICT/.test(commandConflict.out), true);

    // Real two-session overlap: B observes no receipt before waiting on A's row
    // lock, then must recheck after that lock and return the same logical result.
    const concurrentCommand = '9d1f0000-0000-4000-8000-0000000d1450';
    const sessionA = openSession(handle);
    const sessionB = openSession(handle);
    try {
      sessionA.send(`BEGIN;
${sessionRole(ADMIN_UID)}
SELECT 'A_RESULT|'||public.mapear_identificador_externo_pedido('t_series','T001-26','${old}',0,'${concurrentCommand}',NULL)::text;
\\echo A_LOCKED`);
      check('concurrency session A acquired transition lock', await waitFor(() => sessionA.all().includes('A_LOCKED'), 10000), true);
      sessionB.send(`BEGIN;
${sessionRole(ADMIN_UID)}
SELECT 'B_RESULT|'||public.mapear_identificador_externo_pedido('t_series','T001-26','${old}',0,'${concurrentCommand}',NULL)::text;
\\echo B_RETURNED
COMMIT;
\\echo B_DONE`);
      await new Promise((resolve) => setTimeout(resolve, 400));
      check('concurrency session B waits before A commits', sessionB.all().includes('B_RETURNED'), false);
      sessionA.send('COMMIT;\n\\echo A_DONE');
      check('concurrency session A committed', await waitFor(() => sessionA.all().includes('A_DONE'), 10000), true);
      check('concurrency session B returned after post-lock recheck', await waitFor(() => sessionB.all().includes('B_DONE'), 10000), true);
      check('first concurrent caller performs transition', /A_RESULT\|.*"replay": false/.test(sessionA.all()), true);
      check('waiting concurrent caller returns replay success', /B_RESULT\|.*"replay": true/.test(sessionB.all()), true);
    } finally {
      sessionA.close();
      sessionB.close();
    }
    check('concurrent command creates one logical transition', scalar(handle, `
      SELECT count(*)||'/'||max(revision) FROM public.pedido_external_identifier_events
       WHERE command_id='${concurrentCommand}';`), '1/1');
    const concurrentChanged = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('t_series','T001-26','${yes}',0,'${concurrentCommand}',NULL);`);
    check('concurrent command changed payload still conflicts', /COMMAND_CONFLICT/.test(concurrentChanged.out), true);
    const concurrentStale = failAs(handle, ADMIN_UID,
      `SELECT public.mapear_identificador_externo_pedido('t_series','T001-26','${old}',0,'9d1f0000-0000-4000-8000-0000000d1451',NULL);`);
    check('different concurrent command with stale revision is distinct', /STALE_REVISION/.test(concurrentStale.out), true);
    const historyTamper = tryQuery(handle,
      `DELETE FROM public.pedido_external_identifier_events WHERE command_id='${cmdMap}';`);
    check('mapping history is immutable', /HISTORY_IMMUTABLE/.test(historyTamper.out), true);

    // RLS/grants and non-interference with internal/canonical identities.
    check('RLS enabled on both mapping tables', scalar(handle, `SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.pedido_external_identifiers'::regclass,'public.pedido_external_identifier_events'::regclass);`), 't');
    check('authenticated has no mapping-table DML', scalar(handle, `SELECT bool_or(has_table_privilege('authenticated', c, p)) FROM unnest(ARRAY['public.pedido_external_identifiers','public.pedido_external_identifier_events']) c CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE']) p;`), 'f');
    check('authenticated retains the pre-existing pedido_itens table UPDATE grant', scalar(handle,
      `SELECT has_table_privilege('authenticated','public.pedido_itens','UPDATE');`), 't');
    check('pedido_itens RLS and admin-all policy remain intact', scalar(handle, `SELECT
      (SELECT relrowsecurity FROM pg_class WHERE oid='public.pedido_itens'::regclass) AND
      EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname='public' AND tablename='pedido_itens'
                 AND policyname='pedido_itens_admin_all' AND cmd='ALL');`), 't');
    check('internal applicability helpers remain owner-only', scalar(handle, `SELECT
      has_function_privilege('authenticated','public.pedido_itens_payload_normalizar(uuid,jsonb)','EXECUTE') OR
      has_function_privilege('authenticated','public.pedido_itens_reconciliar(uuid,jsonb)','EXECUTE') OR
      has_function_privilege('authenticated','public.pedido_external_identifier_literal_valid(text,text)','EXECUTE');`), 'f');
    check('dedicated applicability writer is authenticated-only at grant boundary', scalar(handle, `SELECT
      has_function_privilege('authenticated','public.definir_requires_finishing_pedido_item(uuid,boolean,bigint,uuid,text)','EXECUTE') AND
      NOT has_function_privilege('anon','public.definir_requires_finishing_pedido_item(uuid,boolean,bigint,uuid,text)','EXECUTE') AND
      NOT has_function_privilege('service_role','public.definir_requires_finishing_pedido_item(uuid,boolean,bigint,uuid,text)','EXECUTE');`), 't');
    check('authority trigger is invoker-rights while canonical writers are owner-rights', scalar(handle, `SELECT
      NOT prep.prosecdef AND prep_owner.rolname='postgres' AND
      reconcile.prosecdef AND reconcile_owner.rolname='postgres' AND
      correction.prosecdef AND correction_owner.rolname='postgres'
      FROM pg_proc prep
      JOIN pg_roles prep_owner ON prep_owner.oid=prep.proowner
      JOIN pg_proc reconcile ON reconcile.oid='public.pedido_itens_reconciliar(uuid,jsonb)'::regprocedure
      JOIN pg_roles reconcile_owner ON reconcile_owner.oid=reconcile.proowner
      JOIN pg_proc correction ON correction.oid='public.definir_requires_finishing_pedido_item(uuid,boolean,bigint,uuid,text)'::regprocedure
      JOIN pg_roles correction_owner ON correction_owner.oid=correction.proowner
      WHERE prep.oid='public.pedido_item_applicability_prepare_fn()'::regprocedure;`), 't');
    check('authenticated cannot assume the canonical writer owner role', scalar(handle,
      `SELECT pg_has_role('authenticated','postgres','MEMBER');`), 'f');
    check('external writers are authenticated-only at the grant boundary', scalar(handle, `SELECT
      has_function_privilege('authenticated','public.mapear_identificador_externo_pedido(text,text,uuid,bigint,uuid,text)','EXECUTE') AND
      NOT has_function_privilege('anon','public.mapear_identificador_externo_pedido(text,text,uuid,bigint,uuid,text)','EXECUTE') AND
      NOT has_function_privilege('service_role','public.mapear_identificador_externo_pedido(text,text,uuid,bigint,uuid,text)','EXECUTE');`), 't');
    check('another client sees no current identifiers or history', scalar(handle, roleSql(OTHER_UID, `SELECT
      (SELECT count(*) FROM public.pedido_external_identifiers)||'/'||
      (SELECT count(*) FROM public.pedido_external_identifier_events);`)), '0/0');
    check('external work did not mutate canonical Pedido numero', scalar(handle,
      `SELECT numero FROM public.pedidos WHERE id='${yes}';`), pedidoNumeroBefore);
    check('external work leaves every internal OP identity unchanged', scalar(handle, `
      SELECT md5(string_agg(id::text||':'||coalesce(identidade_operacional,'NULL'),',' ORDER BY id)) FROM public.ops;`), opIdentityBefore);

    const rowsBeforeReplay = scalar(handle, `SELECT
      (SELECT count(*) FROM public.pedido_item_applicability_events)||'/'||
      (SELECT count(*) FROM public.pedido_external_identifiers)||'/'||
      (SELECT count(*) FROM public.pedido_external_identifier_events);`);
    applyFile(handle, path.join(REPO_ROOT, 'db', '130_pedido_item_finishing_applicability.sql'), 'db/130 replay');
    applyFile(handle, path.join(REPO_ROOT, 'db', '131_pedido_external_identifiers.sql'), 'db/131 replay');
    check('Batch 1 migration replay preserves all evidence rows', scalar(handle, `SELECT
      (SELECT count(*) FROM public.pedido_item_applicability_events)||'/'||
      (SELECT count(*) FROM public.pedido_external_identifiers)||'/'||
      (SELECT count(*) FROM public.pedido_external_identifier_events);`), rowsBeforeReplay);
    check('Batch 1 migration replay preserves corrected applicability', itemState(handle, yes), 'true|CORRECTION|3');
    check('Batch 1 migration replay preserves revoked mapping', asAdmin(handle,
      `SELECT coalesce(public.buscar_pedido_por_identificador_externo('legacy','00226')::text,'NULL');`), 'NULL');

    log(failures === 0 ? 'BATCH1_DISPOSABLE_PASS' : 'BATCH1_DISPOSABLE_FAIL', { falhas: failures });
  } finally {
    if (handle) {
      try { await handle.stop(); log('TEARDOWN_OK'); }
      catch (e) { failures += 1; log('TEARDOWN_FAIL', { erro: e.message }); }
    }
    await rm(scratch, { recursive: true, force: true });
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('BATCH1_DRIVER_ERROR:', e.message); process.exit(2); });
