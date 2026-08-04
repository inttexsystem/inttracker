// tests/ordem-compra-c3d-deploy.smoke.js
//
// PHASE-C3D-A smoke test.
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P1-ADDITIVE-BACKEND-R1 note:
// The P1 additive backend adds db/101, 102, 103, 105, 107, 108 and 109 and
// DELIBERATELY RESERVES db/104 and db/106 for phase P4 (the receipt lock
// protocol and the direct-DML containment). The manifest is therefore no
// longer strictly contiguous, so this guard now carries an EXPLICIT
// reservation register: exactly those two numbers may be absent, every
// OTHER gap still fails closed, and the expected terminal advances
// 100 -> 109 with db/108/db/109 as the terminal two. The fail-closed
// mechanism is unchanged; only the terminal expectation advanced and the
// two reserved numbers became declared facts rather than silent holes.
//
// PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 note:
// db/100_ordem_compra_post_generation_stabilization.sql extends this manifest
// by one further entry, so the expected terminal advances 99 -> 100 and the
// terminal two become db/99/db/100. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// Proves, without applying any migration and without touching any shared or
// remote database:
//   - the ordered deployment manifest resolves exactly db/01..db/82, with
//     db/81 and db/82 as the terminal two, fixed migration numbers unique
//     and contiguous, and the manifest fails closed on the malformed
//     synthetic fixtures the real repository must never actually contain
//     (duplicate number, gap, missing start, unexpected trailing migration,
//     a hash diverging from the repository checkpoint, an application
//     artifact outside branch ancestry, a repository identity mismatch);
//   - db/75, db/76 and db/77 are read-only inputs: their content matches the
//     committed HEAD checkpoint exactly and stays byte-stable for the whole
//     test run;
//
// C5A note (C5A-DB-EMISSION-READINESS-IMPLEMENTATION-R1): the authorized new
// migration db/77_ordem_compra_c5a_emission_readiness.sql extends this manifest
// by one entry, so the expected terminal advances 76 -> 77 and the terminal two
// become db/76/db/77. The fail-closed mechanism (duplicate/gap/missing-start/
// unexpected-trailing via synthetic fixtures) is unchanged.
//
// PHASE-MANTA-A note (PHASE-MANTA-A-PRODUCT-IDENTITY-AND-ROUTE-FOUNDATION-R1):
// the authorized new migration db/78_manta_product_identity_and_route_foundation.sql
// extends this manifest by one further entry, so the expected terminal advances
// 77 -> 78 and the terminal two become db/77/db/78. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-A correction note (PHASE-MANTA-A-DB-VALIDATION-AND-INVARIANT-
// CORRECTION-R1): the authorized forward-correction migration
// db/79_manta_product_identity_invariant_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 78 -> 79 and the terminal
// two become db/78/db/79. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-A correction note (PHASE-MANTA-A-MODEL-REFERENCE-CONCURRENCY-
// CORRECTION-R1): the authorized forward-correction migration
// db/80_manta_model_reference_concurrency_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 79 -> 80 and the terminal
// two become db/79/db/80. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 note (PHASE-MANTA-B1-EXPEDITION-SOURCE-FOUNDATION-R1): the
// authorized new migration db/81_manta_expedition_source_foundation.sql extends
// this manifest by one further entry, so the expected terminal advances 80 -> 81
// and the terminal two become db/80/db/81. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-MEMBERSHIP-AND-LOCK-ORDER-
// CORRECTION-R1): the authorized forward-correction migration
// db/82_manta_expedition_source_invariant_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 81 -> 82 and the terminal
// two become db/81/db/82. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-ROUTE-AND-ITEM-IDENTITY-
// CORRECTION-R1): the authorized forward-correction migration
// db/83_manta_expedition_source_identity_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 82 -> 83 and the terminal
// two become db/82/db/83. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B1 correction note (PHASE-MANTA-B1-SOURCE-LINEAGE-AND-LATEX-ROUTE-
// CORRECTION-R1): the authorized forward-correction migration
// db/84_manta_expedition_source_lineage_correction.sql extends this manifest by
// one further entry, so the expected terminal advances 83 -> 84 and the terminal
// two become db/83/db/84. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1): the authorized
// activation migration db/85_manta_cima_route_conditional_delivery.sql extends
// this manifest by one further entry, so the expected terminal advances
// 84 -> 85 and the terminal two become db/84/db/85. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (same order, second migration):
// db/86_manta_expedition_release_writer.sql extends this manifest by one further
// entry, so the expected terminal advances 85 -> 86 and the terminal two become
// db/85/db/86. The fail-closed mechanism is unchanged (mechanism preserved, only
// the terminal expectation advanced).
//
// PHASE-MANTA-B2A note (same order, third migration):
// db/87_manta_expedition_reversal_and_route_completion.sql extends this manifest
// by one further entry, so the expected terminal advances 86 -> 87 and the
// terminal two become db/86/db/87. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// PHASE-MANTA-B2A correction note (PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-
// FK-LOCK-CORRECTION-R1): the authorized forward-correction migration
// db/88_manta_measured_output_identity_and_fk_lock_correction.sql extends this
// manifest by one further entry, so the expected terminal advances 87 -> 88 and
// the terminal two become db/87/db/88. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced).
//
// KLEBER-APP-OPERATIONAL-STABILIZATION note: db/89_pedido_commercial_date_and_
// number_control.sql and then db/90_pedido_proximo_numero_suggestion_rpc.sql
// each extend this manifest by one further entry, so the expected terminal
// advances 88 -> 89 -> 90 and the terminal two become db/89/db/90. The
// fail-closed mechanism is unchanged (mechanism preserved, only the terminal
// expectation advanced).
//
// PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1-C1-SCHEMA note:
// db/95_op_canonical_identity_refoundation.sql extends this manifest by one
// further entry, so the expected terminal advances 94 -> 95 and the terminal
// two become db/94/db/95. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1-C1 note:
// db/93_pedido_change_approval_helper_privilege_correction.sql extends this
// manifest by one further entry, so the expected terminal advances 92 -> 93
// and the terminal two become db/92/db/93. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1 note:
// db/92_pedido_unified_edit_change_approval_foundation.sql extends this
// manifest by one further entry, so the expected terminal advances 91 -> 92
// and the terminal two become db/91/db/92. The fail-closed mechanism is
// unchanged (mechanism preserved, only the terminal expectation advanced).
//
// PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 note:
// db/91_pedido_item_production_priority.sql extends this manifest by one
// further entry, so the expected terminal advances 90 -> 91 and the terminal
// two become db/90/db/91. The fail-closed mechanism is unchanged (mechanism
// preserved, only the terminal expectation advanced).
//   - the accepted application artifact is an ancestor of the current
//     branch;
//   - scripts/c3d/bootstrap-disposable-cluster.mjs creates a fresh disposable
//     cluster outside the repository, on a distinct non-default port, proves
//     readiness and a real connection, shuts down cleanly, leaves neither a
//     process nor a data directory behind, never reuses a data directory
//     across runs, and still cleans up fully when readiness is forced to
//     fail; and that no code path here ever references a shared or remote
//     database host.
//
// CUTOVER SNAPSHOT CARDINALITY note
// (NATIVE-RECEIPT-CUTOVER-SNAPSHOT-CARDINALITY-ROOT-CAUSE-CORRECTION-R1):
// the authorized forward-correction migration
// db/112_cutover_snapshot_completeness_invariant.sql extends this manifest by
// one further entry, so the expected terminal advances 111 -> 112 and the
// terminal two become db/111/db/112. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced), and the
// three reserved numbers are unchanged.
//
// P3 AUTHORIZATION GUARD note (NATIVE-RECEIPT-P3-AUTHENTICATED-PROOF): the
// authorized forward security correction
// db/113_pode_recuperar_op_acabamento_admin_guard.sql extends this manifest by
// one further entry, so the expected terminal advances 112 -> 113 and the
// terminal two become db/112/db/113. The fail-closed mechanism is unchanged
// (mechanism preserved, only the terminal expectation advanced), and the
// three reserved numbers are unchanged.
//
// CURRENT-SEQUENCE RECONCILIATION note
// (C3D-DEPLOY-MIGRATION-MANIFEST-CURRENT-SEQUENCE-RECONCILIATION-R1): this
// guard's MODEL of the migration topology, not the topology itself, had
// drifted. Three accepted facts were unrepresentable here:
//   - the accepted P4 authority switch (5d1adb4) CREATED db/104
//     (`104_recebimento_lock_e_aceite_gate.sql`), so 104 is no longer an
//     absent reservation;
//   - the same commit created db/103b and, for the single accepted
//     containment migration db/106, the ordered deployment pair db/106a +
//     db/106b, so migration identities carry an optional single lowercase
//     suffix and the old digits-only filename grammar silently DROPPED three
//     accepted migrations;
//   - db/114_pedido_alteracao_client_direct_select_column_acl.sql (ad4267d)
//     is production-applied, so the terminal advances 113 -> 114 and the
//     terminal two become db/113/db/114.
// The corrected model is: a migration identity is `<base><suffix?>`, ordered
// by base then by suffix with the unsuffixed identity first; base numbers must
// still be contiguous except for DECLARED and GENUINELY ABSENT reservations;
// duplicate identities, malformed identities, undeclared holes, unexpected
// trailing migrations, hash divergence, non-ancestor artifacts and environment
// mismatches all still fail closed. db/110 remains the one reservation: it was
// NOT created and is NOT AUTHORIZED. No migration was added, renamed or
// modified by this reconciliation.

//
// EXPECTED-REFUSAL SEMANTICS note
// (PEDIDO-ALTERACAO-EXPECTED-REFUSAL-SEMANTICS-CORRECTION-R1): the authorized
// forward semantic correction
// db/115_pedido_alteracao_expected_refusal_semantics.sql extends this manifest
// by one further entry, so the expected terminal advances 114 -> 115 and the
// terminal two become db/114/db/115. The fail-closed mechanism, the identity
// grammar and the suffix register are unchanged (mechanism preserved, only the
// terminal expectation advanced), and db/110 remains the one reservation.
//
// SALDO_FIOS CONTAINMENT note
// (NATIVE-RECEIPT-SALDO-FIOS-DIRECT-GRANT-DEFENSE-IN-DEPTH-GAP): the authorized
// forward ACL correction db/116_saldo_fios_contencao_dml_simetrica.sql extends
// this manifest by one further entry, so the expected terminal advances
// 115 -> 116 and the terminal two become db/115/db/116. The fail-closed
// mechanism, the identity grammar and the suffix register are unchanged
// (mechanism preserved, only the terminal expectation advanced), and db/110
// remains the one reservation: still NOT created and NOT AUTHORIZED.
//
// SALDO_FIOS TRUNCATE/MAINTAIN note
// (SALDO-FIOS-TRUNCATE-AND-MAINTAIN-CONTAINMENT-R1): the authorized forward
// ACL correction db/117_saldo_fios_truncate_maintain_contencao_simetrica.sql
// extends this manifest by one further entry, so the expected terminal
// advances 116 -> 117 and the terminal two become db/116/db/117. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged (mechanism preserved, only the terminal expectation advanced), and
// db/110 remains the one reservation: still NOT created and NOT AUTHORIZED.
//
// RECEIVED-SURPLUS AVAILABILITY note
// (RESTORE-ORIGINAL-RECEIVED-MATERIAL-SLIDER-SEMANTICS-R1): the authorized
// forward product correction
// db/118_excedente_disponivel_pool_compartilhado.sql extends this manifest by
// one further entry, so the expected terminal advances 117 -> 118 and the
// terminal two become db/117/db/118. The fail-closed mechanism, the identity
// grammar and the suffix register are unchanged (mechanism preserved, only the
// terminal expectation advanced), and db/110 remains the one reservation:
// still NOT created and NOT AUTHORIZED.
//
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(REPO_ROOT, 'db');
const BOOTSTRAP_MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'c3d', 'bootstrap-disposable-cluster.mjs');
const BOOTSTRAP_MODULE_URL = pathToFileURL(BOOTSTRAP_MODULE_PATH).href;
const BOOTSTRAP_SOURCE = fs.readFileSync(BOOTSTRAP_MODULE_PATH, 'utf8');

const APPLICATION_ARTIFACT = '22bfb192c6c2ad10ccd2b2883d54c3a17e40cc9f';
const EXPECTED_BRANCH = 'dev';
// RECEIPT-METADATA-ADMIN-CORRECTION-R1 extends this manifest by one further
// entry (db/119_recebimento_metadados_correcao_admin.sql), so the expected
// terminal advances 118 -> 119 and the terminal two become db/118/db/119. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged; only the terminal expectation advanced.
//
// START-PRODUCTION-CANONICAL-WRITER-RESTORATION-R1 extends this manifest by one
// further entry (db/120_saldo_fios_op_canonical_writer_restoration.sql), so the
// expected terminal advances 119 -> 120 and the terminal two become
// db/119/db/120. The fail-closed mechanism, the identity grammar and the suffix
// register are unchanged; only the terminal expectation advanced.
//
// PEDIDO-DERIVED-OP-LIFECYCLE-ENFORCEMENT-R1 extends this manifest by one
// further entry (db/121_pedido_lifecycle_gate_op_tecelagem.sql), so the expected
// terminal advances 120 -> 121 and the terminal two become db/120/db/121. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged; only the terminal expectation advanced.
//
// BACKLOG-7 PHASE 4 COMPLETION extends this manifest by one further entry
// (db/122_recebimento_correcoes_visiveis_na_historia.sql), so the expected
// terminal advances 121 -> 122 and the terminal two become db/121/db/122. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-FIRST-VERTICAL-SLICE extends this manifest by one further
// entry (db/123_tecelagem_producao_rolos_individuais.sql), so the expected
// terminal advances 122 -> 123 and the terminal two become db/122/db/123. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-LABELS-SLICE extends this manifest by one further entry
// (db/124_op_itens_emborrachar_instrucao.sql), so the expected terminal
// advances 123 -> 124 and the terminal two become db/123/db/124. The
// fail-closed mechanism, the identity grammar and the suffix register are
// unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-FINISHING-OUTPUT-SLICE extends this manifest by one further
// entry (db/125_tecelagem_saida_rolos_acabamento.sql), so the expected
// terminal advances 124 -> 125 and the terminal two become db/124/db/125.
// The fail-closed mechanism, the identity grammar and the suffix register
// are unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-PRODUCTION-ENTRY-RECOVERY extends this manifest by one further
// entry (db/126_tecelagem_desfazer_lancamento_producao.sql), so the expected
// terminal advances 125 -> 126 and the terminal two become db/125/db/126.
// The fail-closed mechanism, the identity grammar and the suffix register
// are unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-INDIVIDUAL-ROLL-DELETION extends this manifest by one further
// entry (db/127_tecelagem_excluir_rolo_individual.sql), so the expected
// terminal advances 126 -> 127 and the terminal two become db/126/db/127.
// The fail-closed mechanism, the identity grammar and the suffix register
// are unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-DENSITY-AND-SELECTION-UX extends this manifest by one further
// entry (db/128_tecelagem_excluir_rolos_selecionados.sql), so the expected
// terminal advances 127 -> 128 and the terminal two become db/127/db/128.
// The fail-closed mechanism, the identity grammar and the suffix register
// are unchanged; only the terminal expectation advanced.
//
// TECELAGEM-V1-CONSOLIDATED-UI-FIXES extends this manifest by one further
// entry (db/129_tecelagem_etiqueta_rolo_impressa.sql), so the expected
// terminal advances 128 -> 129 and the terminal two become db/128/db/129.
// The fail-closed mechanism, the identity grammar and the suffix register
// are unchanged; only the terminal expectation advanced.
const EXPECTED_TERMINAL = 129;

// Migration BASE numbers deliberately RESERVED and GENUINELY ABSENT from the
// repository:
//   db/110 — legacy retirement, post-acceptance; NOT created and NOT
//            AUTHORIZED (docs/governance/current-state.json).
// db/104 and db/106 were formerly reserved here; the accepted P4 authority
// switch occupied both (db/104, and db/106 as the ordered pair db/106a +
// db/106b), so neither is an absent reservation any more. A reservation only
// ever means "this base number is intentionally absent": an OCCUPIED number is
// a real migration and is never skipped. Any gap OUTSIDE this set is still a
// hard failure.
const RESERVED_MIGRATION_NUMBERS = new Set([110]);

// Base numbers whose accepted identity set is NOT simply the bare base number.
// Each entry is the exact ordered identity list the accepted repository
// history proves, so a vanished or spuriously added variant still fails closed:
//   103  — db/103 (P1 supplier queue) then db/103b (P4 emission/demotion)
//   106  — the single accepted containment migration db/106 shipped as the
//          ordered deployment pair db/106a then db/106b; there is no bare
//          db/106 file.
const SUFFIXED_MIGRATION_BASES = new Map([
  [103, ['103', '103b']],
  [106, ['106a', '106b']],
]);

// The full expected identity inventory, derived from the base range, the
// reservation register and the suffix register rather than restated by hand.
const EXPECTED_MIGRATION_IDENTITIES = Array.from({ length: EXPECTED_TERMINAL }, (_, i) => i + 1)
  .filter((n) => !RESERVED_MIGRATION_NUMBERS.has(n))
  .flatMap((n) => SUFFIXED_MIGRATION_BASES.get(n) || [String(n)]);
const DB75_FILENAME = '75_ordem_compra_c3c_inactive_cutover.sql';
const DB76_FILENAME = '76_ordem_compra_c3c_b_db_prerequisites.sql';
const DB77_FILENAME = '77_ordem_compra_c5a_emission_readiness.sql';
const DB78_FILENAME = '78_manta_product_identity_and_route_foundation.sql';
const DB79_FILENAME = '79_manta_product_identity_invariant_correction.sql';
const DB80_FILENAME = '80_manta_model_reference_concurrency_correction.sql';
const DB81_FILENAME = '81_manta_expedition_source_foundation.sql';
const DB82_FILENAME = '82_manta_expedition_source_invariant_correction.sql';
const DB83_FILENAME = '83_manta_expedition_source_identity_correction.sql';
const DB84_FILENAME = '84_manta_expedition_source_lineage_correction.sql';
const DB85_FILENAME = '85_manta_cima_route_conditional_delivery.sql';
const DB86_FILENAME = '86_manta_expedition_release_writer.sql';
const DB87_FILENAME = '87_manta_expedition_reversal_and_route_completion.sql';
const DB88_FILENAME = '88_manta_measured_output_identity_and_fk_lock_correction.sql';
const DB89_FILENAME = '89_pedido_commercial_date_and_number_control.sql';
const DB90_FILENAME = '90_pedido_proximo_numero_suggestion_rpc.sql';
const DB91_FILENAME = '91_pedido_item_production_priority.sql';
const DB92_FILENAME = '92_pedido_unified_edit_change_approval_foundation.sql';
const DB93_FILENAME = '93_pedido_change_approval_helper_privilege_correction.sql';
const DB94_FILENAME = '94_cliente_pedido_structural_capability.sql';
const DB95_FILENAME = '95_op_canonical_identity_refoundation.sql';
const DB96_FILENAME = '96_ordem_compra_codigo_operador_e_exclusao.sql';
const DB97_FILENAME = '97_ordem_compra_exclusao_read_model.sql';
const DB98_FILENAME = '98_ordem_compra_identidade_completa_com_codigo.sql';
const DB99_FILENAME = '99_planejamento_compra_refoundation.sql';
const DB108_FILENAME = '108_acabamento_idempotente.sql';
const DB109_FILENAME = '109_estorno_tapete_e_correcao_entrega.sql';
const DB111_FILENAME = '111_entrega_cima_acabamento_atomico.sql';
const DB112_FILENAME = '112_cutover_snapshot_completeness_invariant.sql';
const DB113_FILENAME = '113_pode_recuperar_op_acabamento_admin_guard.sql';
const DB114_FILENAME = '114_pedido_alteracao_client_direct_select_column_acl.sql';
const DB115_FILENAME = '115_pedido_alteracao_expected_refusal_semantics.sql';
const DB116_FILENAME = '116_saldo_fios_contencao_dml_simetrica.sql';
const DB117_FILENAME = '117_saldo_fios_truncate_maintain_contencao_simetrica.sql';
const DB118_FILENAME = '118_excedente_disponivel_pool_compartilhado.sql';
const DB119_FILENAME = '119_recebimento_metadados_correcao_admin.sql';
const DB120_FILENAME = '120_saldo_fios_op_canonical_writer_restoration.sql';
const DB121_FILENAME = '121_pedido_lifecycle_gate_op_tecelagem.sql';
const DB122_FILENAME = '122_recebimento_correcoes_visiveis_na_historia.sql';
const DB123_FILENAME = '123_tecelagem_producao_rolos_individuais.sql';
const DB124_FILENAME = '124_op_itens_emborrachar_instrucao.sql';
const DB125_FILENAME = '125_tecelagem_saida_rolos_acabamento.sql';
const DB126_FILENAME = '126_tecelagem_desfazer_lancamento_producao.sql';
const DB127_FILENAME = '127_tecelagem_excluir_rolo_individual.sql';
const DB128_FILENAME = '128_tecelagem_excluir_rolos_selecionados.sql';
const DB129_FILENAME = '129_tecelagem_etiqueta_rolo_impressa.sql';
const DB100_FILENAME = '100_ordem_compra_post_generation_stabilization.sql';
const DB75_PATH = path.join(DB_DIR, DB75_FILENAME);
const DB76_PATH = path.join(DB_DIR, DB76_FILENAME);
const DB77_PATH = path.join(DB_DIR, DB77_FILENAME);
const DB78_PATH = path.join(DB_DIR, DB78_FILENAME);
const DB79_PATH = path.join(DB_DIR, DB79_FILENAME);
const DB80_PATH = path.join(DB_DIR, DB80_FILENAME);
const DB81_PATH = path.join(DB_DIR, DB81_FILENAME);
const DB82_PATH = path.join(DB_DIR, DB82_FILENAME);
const DB83_PATH = path.join(DB_DIR, DB83_FILENAME);
const DB84_PATH = path.join(DB_DIR, DB84_FILENAME);
const DB85_PATH = path.join(DB_DIR, DB85_FILENAME);
const DB86_PATH = path.join(DB_DIR, DB86_FILENAME);
const DB87_PATH = path.join(DB_DIR, DB87_FILENAME);
const DB88_PATH = path.join(DB_DIR, DB88_FILENAME);
const DB89_PATH = path.join(DB_DIR, DB89_FILENAME);
const DB90_PATH = path.join(DB_DIR, DB90_FILENAME);

const FORBIDDEN_HOST_PATTERNS = [
  /ucrjtfswnfdlxwtmxnoo/i,
  /gqmpsxkxynrjvidfmojk/i,
  /bhgifjrfagkzubpyqpew/i,
  /supabase/i,
];

let bootstrapModulePromise;
function loadBootstrapModule() {
  if (!bootstrapModulePromise) bootstrapModulePromise = import(BOOTSTRAP_MODULE_URL);
  return bootstrapModulePromise;
}

// ---------------------------------------------------------------------------
// Pure, fail-closed deployment-manifest resolution (no filesystem access of
// its own beyond the filename list it is given -- so its failure paths can
// be proven against synthetic fixtures without ever touching db/*.sql).
// ---------------------------------------------------------------------------

class ManifestError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'ManifestError';
    this.reason = reason;
  }
}

// Canonical migration identity: `<base><suffix?>_<name>.sql`, where
//   <base>   is one or more digits and carries the ordering number, and
//   <suffix> is AT MOST ONE lowercase letter, present only where accepted
//            repository history split one logical migration number into an
//            ordered deployment sequence (db/103b, db/106a, db/106b).
// The grammar is deliberately no broader than the identities the repository
// actually carries: no uppercase, no multi-letter and no numeric sub-parts.
const MIGRATION_FILENAME_RE = /^(\d+)([a-z]?)_[A-Za-z0-9_]+\.sql$/;

// `NN[s]_<name>.verify.sql` siblings are deliberate non-migration companions
// of a migration and are excluded, not treated as malformed.
const MIGRATION_VERIFY_FILENAME_RE = /^(\d+)([a-z]?)_[A-Za-z0-9_]+\.verify\.sql$/;

// Anything that BEGINS WITH A DIGIT and ends in `.sql` claims to be a
// migration. If it matches neither grammar above it is malformed and the
// manifest fails closed rather than silently dropping a possibly real
// migration. Non-numbered files such as `setup_completo.sql` never make that
// claim and are excluded quietly.
const MIGRATION_CANDIDATE_RE = /^\d.*\.sql$/;

// Deterministic total order: base ascending, then suffix ascending with the
// UNSUFFIXED identity always first ('' < 'a' < 'b').
function compareMigrationEntries(a, b) {
  if (a.number !== b.number) return a.number - b.number;
  if (a.suffix === b.suffix) return 0;
  return a.suffix < b.suffix ? -1 : 1;
}

function filterMigrationFilenames(filenames) {
  const entries = [];
  for (const filename of filenames) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (match) {
      const number = Number(match[1]);
      const suffix = match[2];
      entries.push({ number, suffix, identity: `${number}${suffix}`, filename });
      continue;
    }
    if (MIGRATION_VERIFY_FILENAME_RE.test(filename)) continue;
    if (MIGRATION_CANDIDATE_RE.test(filename)) {
      throw new ManifestError(
        'MALFORMED_IDENTITY',
        `migration-shaped filename ${filename} matches no accepted migration identity grammar`
      );
    }
  }
  return entries;
}

function resolveMigrationManifest(filenames, { expectedTerminal, reserved = RESERVED_MIGRATION_NUMBERS } = {}) {
  const entries = filterMigrationFilenames(filenames);
  if (entries.length === 0) {
    throw new ManifestError('EMPTY', 'no numbered migration files found');
  }
  entries.sort(compareMigrationEntries);

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.identity)) {
      throw new ManifestError('DUPLICATE_IDENTITY', `duplicate migration identity ${entry.identity} (${entry.filename})`);
    }
    seen.add(entry.identity);
  }

  const observedBases = new Set(entries.map((entry) => entry.number));

  if (entries[0].number !== 1) {
    throw new ManifestError('MISSING_START', `migration sequence does not start at 1 (starts at ${entries[0].number})`);
  }
  for (let i = 1; i < entries.length; i += 1) {
    const previous = entries[i - 1].number;
    const current = entries[i].number;
    // Suffix variants of the same base are one contiguity step, not a gap.
    if (current === previous) continue;
    let expectedNext = previous + 1;
    // Walk past declared reservations ONLY while they are genuinely absent.
    // An OCCUPIED reservation is a real migration and must never be skipped;
    // an undeclared hole still fails.
    while (reserved.has(expectedNext) && !observedBases.has(expectedNext)) expectedNext += 1;
    if (current !== expectedNext) {
      throw new ManifestError(
        'GAP',
        `non-contiguous migration sequence: expected ${expectedNext} after ${previous}, found ${current}`
      );
    }
  }

  if (expectedTerminal !== undefined) {
    const last = entries[entries.length - 1].number;
    if (last !== expectedTerminal) {
      throw new ManifestError(
        'UNEXPECTED_TRAILING',
        `migration sequence extends beyond the expected terminal ${expectedTerminal} (found ${last})`
      );
    }
  }

  return entries;
}

function sha256OfBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256OfFile(filePath) {
  return sha256OfBuffer(fs.readFileSync(filePath));
}

function runGit(args, { cwd = REPO_ROOT, encoding = 'utf8' } = {}) {
  return spawnSync('git', args, { cwd, encoding, timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
}

function gitCheckpointHash(relPathPosix, ref = 'HEAD') {
  const result = runGit(['show', `${ref}:${relPathPosix}`], { encoding: 'buffer' });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : '';
    throw new ManifestError('GIT_CHECKPOINT_UNAVAILABLE', `git show ${ref}:${relPathPosix} failed: ${stderr || result.status}`);
  }
  return sha256OfBuffer(result.stdout);
}

function assertHashMatchesCheckpoint(actualHash, expectedHash, label) {
  if (actualHash !== expectedHash) {
    throw new ManifestError('HASH_CHANGED', `${label} hash ${actualHash} does not match the repository checkpoint hash ${expectedHash}`);
  }
}

function assertIsAncestor(sha, ref) {
  const result = runGit(['merge-base', '--is-ancestor', sha, ref]);
  if (result.status !== 0) {
    throw new ManifestError('ARTIFACT_NOT_ANCESTOR', `${sha} is not an ancestor of ${ref} (git exit ${result.status})`);
  }
}

function getGitState() {
  const run = (args) => {
    const result = runGit(args);
    if (result.status !== 0) {
      throw new ManifestError('GIT_STATE_UNAVAILABLE', `git ${args.join(' ')} failed: ${result.stderr || result.status}`);
    }
    return result.stdout.trim();
  };
  return {
    toplevel: run(['rev-parse', '--show-toplevel']),
    branch: run(['branch', '--show-current']),
    head: run(['rev-parse', 'HEAD']),
  };
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').toLowerCase();
}

function assertEnvironmentIdentity(actual, expected) {
  if (actual.branch !== expected.branch) {
    throw new ManifestError('ENVIRONMENT_MISMATCH', `branch ${actual.branch} !== expected ${expected.branch}`);
  }
  if (normalizePath(actual.toplevel) !== normalizePath(expected.toplevel)) {
    throw new ManifestError('ENVIRONMENT_MISMATCH', `repository root ${actual.toplevel} !== expected ${expected.toplevel}`);
  }
}

// Assembles the deterministic C3D-A deployment manifest: application
// artifact, the ordered db/01..db/114 identity sequence (suffix variants
// included, db/110 reserved and absent), the terminal two migrations with
// stable path/byte-size/hash evidence, and the ancestry/identity proofs.
// Fails closed on every condition listed in the C3D-A order (missing
// migration, duplicate identity, malformed identity, gap, unexpected trailing
// migration, changed terminal-migration hash, non-ancestor artifact,
// environment mismatch).
function buildDeploymentManifest({ dbDir = DB_DIR, applicationArtifact = APPLICATION_ARTIFACT, expectedBranch = EXPECTED_BRANCH } = {}) {
  const filenames = fs.readdirSync(dbDir);
  const migrations = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL }).map((entry) => {
    const filePath = path.join(dbDir, entry.filename);
    const stat = fs.statSync(filePath);
    return { ...entry, path: filePath, byteSize: stat.size, sha256: sha256OfFile(filePath) };
  });

  const terminalTwo = migrations.slice(-2);
  assert.equal(terminalTwo[0].filename, DB128_FILENAME);
  assert.equal(terminalTwo[1].filename, DB129_FILENAME);

  for (const migration of terminalTwo) {
    const relPathPosix = `db/${migration.filename}`;
    const checkpointHash = gitCheckpointHash(relPathPosix);
    assertHashMatchesCheckpoint(migration.sha256, checkpointHash, relPathPosix);
  }

  const gitState = getGitState();
  assertEnvironmentIdentity(gitState, { branch: expectedBranch, toplevel: REPO_ROOT });
  assertIsAncestor(applicationArtifact, gitState.head);

  return { applicationArtifact, documentaryCheckpoint: gitState.head, migrations, terminalTwo, gitState };
}

// ---------------------------------------------------------------------------
// Deployment manifest: happy path against the real repository
// ---------------------------------------------------------------------------

test('deployment manifest resolves exactly db/01..db/117 less the one reserved number, including the accepted suffix identities', () => {
  const filenames = fs.readdirSync(DB_DIR);
  const entries = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL });
  assert.equal(entries.length, EXPECTED_MIGRATION_IDENTITIES.length);
  assert.deepEqual(entries.map((entry) => entry.identity), EXPECTED_MIGRATION_IDENTITIES);
});

test('the formerly reserved numbers 104 and 106 are resolved as real migrations, and 110 stays absent', () => {
  const filenames = fs.readdirSync(DB_DIR);
  const entries = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL });
  const byIdentity = new Map(entries.map((entry) => [entry.identity, entry.filename]));
  assert.equal(byIdentity.get('104'), '104_recebimento_lock_e_aceite_gate.sql');
  assert.equal(byIdentity.get('106a'), '106a_escritores_canonicos.sql');
  assert.equal(byIdentity.get('106b'), '106b_contencao_dml.sql');
  assert.equal(byIdentity.get('103b'), '103b_emissao_aceite_e_democao.sql');
  assert.equal(byIdentity.has('106'), false, 'there is no bare db/106 file; the accepted identity is the ordered pair');
  assert.equal(entries.some((entry) => entry.number === 110), false, 'db/110 was not created and is not authorized');
  assert.deepEqual([...RESERVED_MIGRATION_NUMBERS], [110]);
});

test('db/124 and db/125 are the terminal two migrations', () => {
  const filenames = fs.readdirSync(DB_DIR);
  const entries = resolveMigrationManifest(filenames, { expectedTerminal: EXPECTED_TERMINAL });
  const [penultimate, terminal] = entries.slice(-2);
  assert.equal(penultimate.filename, DB128_FILENAME);
  assert.equal(terminal.filename, DB129_FILENAME);
});

test('the full deployment manifest builds against the real repository', () => {
  const manifest = buildDeploymentManifest();
  assert.equal(manifest.migrations.length, EXPECTED_MIGRATION_IDENTITIES.length);
  assert.equal(manifest.applicationArtifact, APPLICATION_ARTIFACT);
  assert.equal(manifest.terminalTwo.length, 2);
  assert.ok(/^[0-9a-f]{40}$/.test(manifest.documentaryCheckpoint));
});

// ---------------------------------------------------------------------------
// Deployment manifest: fail-closed behavior against synthetic fixtures
// (never against the real db/*.sql files, which this phase must not modify)
// ---------------------------------------------------------------------------

test('fails closed on a duplicate migration number', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '02_c.sql']),
    (err) => err instanceof ManifestError && err.reason === 'DUPLICATE_IDENTITY'
  );
});

test('fails closed on a duplicate base+suffix identity', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '02b_c.sql', '02b_d.sql']),
    (err) => err instanceof ManifestError && err.reason === 'DUPLICATE_IDENTITY'
  );
});

test('accepted suffix identities sort deterministically, unsuffixed first, regardless of directory order', () => {
  const shuffled = ['03_d.sql', '02b_c.sql', '01_a.sql', '02a_e.sql', '02_b.sql'];
  const entries = resolveMigrationManifest(shuffled);
  assert.deepEqual(entries.map((entry) => entry.identity), ['1', '2', '2a', '2b', '3']);
  // Stable under any input permutation: reversing the input must not move it.
  const reversed = resolveMigrationManifest([...shuffled].reverse());
  assert.deepEqual(reversed.map((entry) => entry.identity), ['1', '2', '2a', '2b', '3']);
});

test('a base carrying only suffixed identities is still one contiguity step', () => {
  const entries = resolveMigrationManifest(['01_a.sql', '02a_b.sql', '02b_c.sql', '03_d.sql']);
  assert.deepEqual(entries.map((entry) => entry.identity), ['1', '2a', '2b', '3']);
});

test('fails closed on a malformed suffix identity rather than silently dropping it', () => {
  for (const malformed of ['02ab_b.sql', '02A_b.sql', '02-b.sql', '02b.sql']) {
    assert.throws(
      () => resolveMigrationManifest(['01_a.sql', malformed]),
      (err) => err instanceof ManifestError && err.reason === 'MALFORMED_IDENTITY',
      `${malformed} must fail closed`
    );
  }
});

test('an undeclared missing identity still fails even when the surrounding bases are suffixed', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02b_b.sql', '04a_c.sql']),
    (err) => err instanceof ManifestError && err.reason === 'GAP'
  );
});

test('a declared reservation is skipped only while genuinely absent; once occupied it is a real migration', () => {
  const reserved = new Set([2]);
  // Absent reservation: the sequence resolves across the declared hole.
  const withHole = resolveMigrationManifest(['01_a.sql', '03_c.sql'], { reserved });
  assert.deepEqual(withHole.map((entry) => entry.identity), ['1', '3']);
  // Occupied reservation: the migration is resolved in place, not skipped.
  const occupied = resolveMigrationManifest(['01_a.sql', '02_b.sql', '03_c.sql'], { reserved });
  assert.deepEqual(occupied.map((entry) => entry.identity), ['1', '2', '3']);
  // An occupied reservation does not license the NEXT number to disappear.
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '04_d.sql'], { reserved }),
    (err) => err instanceof ManifestError && err.reason === 'GAP'
  );
});

test('fails closed on a non-contiguous migration sequence (missing migration)', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '04_c.sql']),
    (err) => err instanceof ManifestError && err.reason === 'GAP'
  );
});

test('fails closed when the sequence does not start at migration 1', () => {
  assert.throws(
    () => resolveMigrationManifest(['02_a.sql', '03_b.sql']),
    (err) => err instanceof ManifestError && err.reason === 'MISSING_START'
  );
});

test('fails closed on an unexpected migration after the expected terminal', () => {
  assert.throws(
    () => resolveMigrationManifest(['01_a.sql', '02_b.sql', '03_c.sql'], { expectedTerminal: 2 }),
    (err) => err instanceof ManifestError && err.reason === 'UNEXPECTED_TRAILING'
  );
});

test('the migration filename pattern excludes .verify.sql siblings and non-numbered files', () => {
  const entries = filterMigrationFilenames([
    '44_partner_cnpj_registry.sql',
    '44_partner_cnpj_registry.verify.sql',
    '106a_escritores_canonicos.sql',
    '106a_escritores_canonicos.verify.sql',
    'setup_completo.sql',
  ]);
  assert.deepEqual(entries.map((entry) => entry.filename), [
    '44_partner_cnpj_registry.sql',
    '106a_escritores_canonicos.sql',
  ]);
  assert.deepEqual(entries.map((entry) => entry.identity), ['44', '106a']);
});

test('fails closed when a migration hash diverges from the repository checkpoint', () => {
  assert.throws(
    () => assertHashMatchesCheckpoint('deadbeef', 'cafef00d', 'db/synthetic.sql'),
    (err) => err instanceof ManifestError && err.reason === 'HASH_CHANGED'
  );
});

test('fails closed when the application artifact is not an ancestor of the target ref', () => {
  assert.throws(
    () => assertIsAncestor('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'HEAD'),
    (err) => err instanceof ManifestError && err.reason === 'ARTIFACT_NOT_ANCESTOR'
  );
});

test('fails closed on a repository or environment identity mismatch', () => {
  assert.throws(
    () => assertEnvironmentIdentity({ branch: 'main', toplevel: REPO_ROOT }, { branch: EXPECTED_BRANCH, toplevel: REPO_ROOT }),
    (err) => err instanceof ManifestError && err.reason === 'ENVIRONMENT_MISMATCH'
  );
  assert.throws(
    () => assertEnvironmentIdentity({ branch: EXPECTED_BRANCH, toplevel: 'D:/somewhere-else' }, { branch: EXPECTED_BRANCH, toplevel: REPO_ROOT }),
    (err) => err instanceof ManifestError && err.reason === 'ENVIRONMENT_MISMATCH'
  );
});

// ---------------------------------------------------------------------------
// db/75 and db/76 are read-only inputs: checkpoint-matched and byte-stable
// ---------------------------------------------------------------------------

test('db/75 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB75_PATH), gitCheckpointHash(`db/${DB75_FILENAME}`));
});

test('db/76 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB76_PATH), gitCheckpointHash(`db/${DB76_FILENAME}`));
});

test('db/77 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB77_PATH), gitCheckpointHash(`db/${DB77_FILENAME}`));
});

test('db/78 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB78_PATH), gitCheckpointHash(`db/${DB78_FILENAME}`));
});

test('db/79 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB79_PATH), gitCheckpointHash(`db/${DB79_FILENAME}`));
});

test('db/80 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB80_PATH), gitCheckpointHash(`db/${DB80_FILENAME}`));
});

test('db/81 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB81_PATH), gitCheckpointHash(`db/${DB81_FILENAME}`));
});

test('db/82 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB82_PATH), gitCheckpointHash(`db/${DB82_FILENAME}`));
});

test('db/83 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB83_PATH), gitCheckpointHash(`db/${DB83_FILENAME}`));
});

test('db/90 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB90_PATH), gitCheckpointHash(`db/${DB90_FILENAME}`));
});

test('db/89 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB89_PATH), gitCheckpointHash(`db/${DB89_FILENAME}`));
});

test('db/88 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB88_PATH), gitCheckpointHash(`db/${DB88_FILENAME}`));
});

test('db/87 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB87_PATH), gitCheckpointHash(`db/${DB87_FILENAME}`));
});

test('db/86 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB86_PATH), gitCheckpointHash(`db/${DB86_FILENAME}`));
});

test('db/85 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB85_PATH), gitCheckpointHash(`db/${DB85_FILENAME}`));
});

test('db/84 hash matches the committed HEAD checkpoint', () => {
  assert.equal(sha256OfFile(DB84_PATH), gitCheckpointHash(`db/${DB84_FILENAME}`));
});

let db75HashAtStart;
let db76HashAtStart;
let db77HashAtStart;
let db78HashAtStart;
let db79HashAtStart;
let db80HashAtStart;
let db81HashAtStart;
let db82HashAtStart;
let db83HashAtStart;
let db84HashAtStart;
let db85HashAtStart;
let db86HashAtStart;
let db87HashAtStart;
let db88HashAtStart;
let db89HashAtStart;
let db90HashAtStart;
before(() => {
  db75HashAtStart = sha256OfFile(DB75_PATH);
  db76HashAtStart = sha256OfFile(DB76_PATH);
  db77HashAtStart = sha256OfFile(DB77_PATH);
  db78HashAtStart = sha256OfFile(DB78_PATH);
  db79HashAtStart = sha256OfFile(DB79_PATH);
  db80HashAtStart = sha256OfFile(DB80_PATH);
  db81HashAtStart = sha256OfFile(DB81_PATH);
  db82HashAtStart = sha256OfFile(DB82_PATH);
  db83HashAtStart = sha256OfFile(DB83_PATH);
  db84HashAtStart = sha256OfFile(DB84_PATH);
  db85HashAtStart = sha256OfFile(DB85_PATH);
  db86HashAtStart = sha256OfFile(DB86_PATH);
  db87HashAtStart = sha256OfFile(DB87_PATH);
  db88HashAtStart = sha256OfFile(DB88_PATH);
  db89HashAtStart = sha256OfFile(DB89_PATH);
  db90HashAtStart = sha256OfFile(DB90_PATH);
});
after(() => {
  assert.equal(sha256OfFile(DB75_PATH), db75HashAtStart, 'db/75 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB76_PATH), db76HashAtStart, 'db/76 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB77_PATH), db77HashAtStart, 'db/77 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB78_PATH), db78HashAtStart, 'db/78 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB79_PATH), db79HashAtStart, 'db/79 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB80_PATH), db80HashAtStart, 'db/80 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB81_PATH), db81HashAtStart, 'db/81 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB82_PATH), db82HashAtStart, 'db/82 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB83_PATH), db83HashAtStart, 'db/83 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB84_PATH), db84HashAtStart, 'db/84 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB85_PATH), db85HashAtStart, 'db/85 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB86_PATH), db86HashAtStart, 'db/86 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB87_PATH), db87HashAtStart, 'db/87 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB88_PATH), db88HashAtStart, 'db/88 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB89_PATH), db89HashAtStart, 'db/89 must remain byte-stable for the whole test run');
  assert.equal(sha256OfFile(DB90_PATH), db90HashAtStart, 'db/90 must remain byte-stable for the whole test run');
});

// ---------------------------------------------------------------------------
// Application-artifact ancestry
// ---------------------------------------------------------------------------

test('application artifact 22bfb192 is present in current branch ancestry', () => {
  const gitState = getGitState();
  assert.equal(gitState.branch, EXPECTED_BRANCH);
  assertIsAncestor(APPLICATION_ARTIFACT, gitState.head);
});

// ---------------------------------------------------------------------------
// No shared/remote database reference anywhere in the bootstrap script
// ---------------------------------------------------------------------------

test('the bootstrap script never references a shared, remote, or Supabase database host', () => {
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    assert.doesNotMatch(BOOTSTRAP_SOURCE, pattern);
  }
});

// ---------------------------------------------------------------------------
// Disposable-cluster lifecycle (real PostgreSQL processes; DB-backed)
// ---------------------------------------------------------------------------

// Asserts the three independent cleanup proofs a stop()/failed-bootstrap
// cleanup must establish: the captured postmaster PID is gone (checked via
// the cross-platform `process.kill(pid, 0)` probe, never a process-name
// listing that could match an unrelated PostgreSQL installation), the port
// is closed, and the temp directory no longer exists.
async function assertFullyCleanedUp(mod, { postmasterPid, host, port, dataDir }) {
  if (postmasterPid) {
    assert.equal(mod.isPidAlive(postmasterPid), false, `postmaster PID ${postmasterPid} must no longer exist`);
  }
  const stillOpen = await mod.isPortOpen(host, port, 1000);
  assert.equal(stillOpen, false, `${host}:${port} must no longer be listening`);
  await assert.rejects(fsp.access(dataDir), /ENOENT/, `${dataDir} must no longer exist`);
}

test('bootstrap creates a fresh disposable cluster outside the repository, on a distinct port, with readiness/connection proof and clean shutdown', async () => {
  const mod = await loadBootstrapModule();
  const repoRoot = mod.getRepoRoot();
  assert.equal(normalizePath(repoRoot), normalizePath(REPO_ROOT));

  const handle = await mod.bootstrapCluster({});
  try {
    assert.ok(!normalizePath(handle.dataDir).startsWith(normalizePath(repoRoot)), 'disposable data directory must be outside the repository');
    assert.ok(fs.existsSync(handle.dataDir), 'data directory must exist while the cluster is running');
    assert.notEqual(handle.port, mod.FORBIDDEN_DEFAULT_PORT, 'the cluster must not bind the conventional default PostgreSQL port');
    assert.equal(handle.host, '127.0.0.1', 'no shared or remote host is ever used');
    assert.ok(Number.isInteger(handle.postmasterPid) && handle.postmasterPid > 0, 'the postmaster PID must be captured from postmaster.pid');
    assert.equal(mod.isPidAlive(handle.postmasterPid), true, 'the captured postmaster PID must be alive while the cluster is running');

    const psqlPath = path.join(handle.pgBinDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
    const check = spawnSync(
      psqlPath,
      ['-h', handle.host, '-p', String(handle.port), '-U', handle.user, '-d', handle.database, '-tAc', 'SELECT 1'],
      { encoding: 'utf8', timeout: 5000 }
    );
    assert.equal(check.status, 0, `psql connection check failed: ${check.stderr}`);
    assert.equal(check.stdout.trim(), '1');
  } finally {
    const proof = await handle.stop();
    assert.equal(proof.stopResult.ok, true);
    assert.equal(proof.portClosed, true);
    assert.equal(proof.pidAbsent, true);
    assert.equal(proof.dirAbsent, true);
  }

  await assertFullyCleanedUp(mod, handle);
});

test('repeated bootstrap runs do not reuse the same data directory', async () => {
  const mod = await loadBootstrapModule();
  const first = await mod.bootstrapCluster({});
  await first.stop();

  const second = await mod.bootstrapCluster({});
  await second.stop();

  assert.notEqual(first.dataDir, second.dataDir);
  await assertFullyCleanedUp(mod, first);
  await assertFullyCleanedUp(mod, second);
});

test('an injected readiness failure still cleans up the process and the data directory', async () => {
  const mod = await loadBootstrapModule();
  let caught = null;
  try {
    await mod.bootstrapCluster({ simulateReadinessFailure: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'an injected readiness failure must cause bootstrapCluster to reject');
  assert.match(caught.message, /C3D_BOOTSTRAP_FAILED/);
  assert.ok(caught.dataDir, 'the thrown error must report the data directory it attempted to clean up');
  assert.ok(Number.isInteger(caught.postmasterPid) && caught.postmasterPid > 0, 'the thrown error must report the captured postmaster PID');
  assert.equal(caught.cleanupError, null, 'cleanup itself must have succeeded cleanly for this injected failure');
  await assertFullyCleanedUp(mod, { postmasterPid: caught.postmasterPid, host: '127.0.0.1', port: caught.port, dataDir: caught.dataDir });
});

// ---------------------------------------------------------------------------
// Fail-closed shutdown proof: controlled stop/port/process failure injection
// ---------------------------------------------------------------------------

test('a controlled pg_ctl-stop failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forceStopFailure: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'an injected pg_ctl-stop failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_STOP_FAILED/);
  assert.equal(caught.proof.stopResult.ok, false, 'the discarded pg_ctl stop result must be captured, not silently ignored');
  // The real command was never issued for this injected failure, so the
  // process must genuinely still be alive -- proving stop() did not lie.
  assert.equal(mod.isPidAlive(handle.postmasterPid), true, 'the real process must be untouched by an injected stop failure');

  // A failed cleanup attempt can be retried, and a real (non-injected)
  // retry must genuinely finish the job.
  const proof = await handle.stop({});
  assert.equal(proof.stopResult.ok, true);
  assert.equal(proof.portClosed, true);
  assert.equal(proof.pidAbsent, true);
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a controlled persistent-open-port proof failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forcePortStillOpen: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'a persistent-open-port proof failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_PORT_STILL_OPEN/);
  assert.equal(caught.proof.portClosed, false, 'the false port-closed result must be captured, not silently ignored');
  // Unlike the stop-failure injection, this path lets the real `pg_ctl
  // stop` run -- only the port-closed *proof* is forced false -- so the
  // process is genuinely already gone by the time this rejects.
  assert.equal(mod.isPidAlive(handle.postmasterPid), false, 'the real shutdown must have already happened despite the forced proof failure');

  const proof = await handle.stop({});
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a controlled process-still-alive proof failure causes stop() to reject, and a real retry then fully cleans up', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});

  let caught = null;
  try {
    await handle.stop({ forceProcessStillAlive: true });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'a process-still-alive proof failure must cause stop() to reject rather than report success');
  assert.match(caught.message, /C3D_BOOTSTRAP_PROCESS_STILL_ALIVE/);
  assert.equal(caught.proof.pidAbsent, false, 'the false pid-absent result must be captured, not silently ignored');
  assert.equal(mod.isPidAlive(handle.postmasterPid), false, 'the real shutdown must have already happened despite the forced proof failure');

  const proof = await handle.stop({});
  assert.equal(proof.dirAbsent, true);
  await assertFullyCleanedUp(mod, handle);
});

test('a second stop() call after a genuinely successful cleanup is a safe no-op', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});
  const first = await handle.stop({});
  const second = await handle.stop({});
  assert.equal(second, first, 'a second call after success must return the cached proof, not re-run cleanup');
  await assertFullyCleanedUp(mod, handle);
});

test('the bootstrap script identifies the disposable process only by its own captured PID, never by process-name enumeration', () => {
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /tasklist/i);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /taskkill/i);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /\bpkill\b/i);
  assert.match(BOOTSTRAP_SOURCE, /readPostmasterPid/);
  assert.match(BOOTSTRAP_SOURCE, /process\.kill\(pid, 0\)/);
});

test('no shared or remote database connection is attempted (runtime host assertion)', async () => {
  const mod = await loadBootstrapModule();
  const handle = await mod.bootstrapCluster({});
  try {
    assert.equal(handle.host, '127.0.0.1');
    assert.equal(handle.database, 'postgres');
  } finally {
    await handle.stop();
  }
});
