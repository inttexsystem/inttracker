# Agent Handoff
<!-- GENERATED_COMPATIBILITY_VIEW: docs/governance/current-state.json via scripts/governance/render-unit4-canonical-views.mjs; NO INDEPENDENT AUTHORITY -->

This generated continuation view owns no rules, state, product semantics, or acceptance.

## Routing

- Repository: `ravatexapps-dotcom/controle-tapetes-staging`
- Workspace: `D:\Programação\controle-tapetes-g28`
- Branch: `dev`
- Publication boundary: `staging/dev`; EXPLICIT_SINGLE_FAST_FORWARD_ONLY

## Current objective

- Status: `CLOSED / ACCEPTED / DOCUMENTED`
- Objective: PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1 (read-only architectural reconciliation, documentation-only) is closed: docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md is now the binding owner of PHASE-MANTA-B2 activation semantics for the dormant db/81-84 foundation. Binding rulings: (1) the route-conditional cima delivery rejects a frontend-only conditional — entregas_destino_cima_chk is dropped (the route is not derivable from an entregas row at header INSERT) and replaced by route-aware entrega_itens/entregas destination guards plus a Manta-only atomic RPC registrar_entrega_cima_manta; the Tapete cima path, salvarEntregaCima and gerar_op_latex/_split stay unchanged. (2) The Manta writer is liberar_expedicao_manta_parcial(p_op_tecelagem_id, p_itens, p_observacao, p_idempotency_key) with consultar_saldo_expedicao_manta; availability is non-defect measured cima output joined op_item_id-exact minus already released; planned quantity is display only; partial and additive releases; replay follows the accepted PEDIDO_OP_SCHEMA_CONTRACT.md section 13.2 canon through a new public.expedicao_comandos table. (3) Correction/reversal selects design A — one atomic estornar_expedicao_manta_parcial with a mandatory motivo plus the existing delivery correction flow — because every db/81 consumption guard is inert at zero consumption by its own existing condition, so no guard is relaxed and no app.retificacao_autorizada is granted to any authenticated writer; designs B and C are rejected as duplicated authority and surplus surface. (4) Progress is route-derived from modelos.tipo_produto only, never ops.tipo; a blocking pre-existing defect was found and its correction is a mandatory B2A acceptance gate: concluir_pedido_se_pronto counts only ops.tipo='latex' joined on expedicoes.op_latex_id, so a Manta-only Pedido with a terminal weaving OP and no expedition at all would today be marked entregue. (5) The mixed-Pedido presentation is route sections, because a per-OP card structurally cannot represent the Tapete route (which spans two OPs) while every OP is DB-guaranteed route-homogeneous. (6) Authorization stays admin-only SECURITY DEFINER RPCs; no table grant is broadened; events are op_eventos manta_saida_registrada / expedicao_manta_liberada / expedicao_manta_estornada. (7) The lock order extends db/81/db/84 with pedidos-first only for completion, which acquires nothing else, so no 40P01 cycle can form. Phasing: B2A backend (exactly three migrations db/85-87, local disposable PostgreSQL only, no js/**), B2B route-aware UI (zero migrations), B2C shared-development apply, live validation and closeout. No database, migration, product code or test changed under this order; shared development ucrjtfswnfdlxwtmxnoo remains at terminal 84 with an empty operational corpus and the Manta route dormant. No staging or production apply is authorized. Business-flow recreation remains paused.
- Next authorizable action: `PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1` / `IMPLEMENTATION`

## Blockers and decisions

- Blockers/debts: `INGESTOR-DOC-CYCLE-VERIFY-DEFERRED`, `CAMADA3-BK5-BK8`, `DELETE-PROD-GUARD-A`, `CODE-HEALTH-AUDIT-18-R1`, `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`, `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`, `C3D-13-UNMAPPED-ROWS-COMPLETENESS-GATE`
- Open architect decisions: Select the next product or governance phase after acceptance. | Rule on historical saldo_fios provenance before any real receipt cutover. | Resolve native receipt compatibility for multiple purchase-order origins.

## Prohibitions

- NO PRODUCT IMPLEMENTATION | NO DATABASE, SUPABASE, SQL, MIGRATION, ACL/RLS, AUTH, OR ENVIRONMENT ACCESS | NO DEPLOYMENT, ACTIVATION, CUTOVER, PONR, OR PRODUCTION ACTION | NO MAIN, ORIGIN, TAG, ADDITIONAL REF, FORCE, OR SECOND PUBLICATION ATTEMPT | NO CLEANUP, ARCHIVAL, DEPRECATION, PARTITIONING, OR PHYSICAL DELETION | NO MANUAL EDIT OF GENERATED HANDOFF OR OTHER GENERATED OUTPUT OUTSIDE ITS RENDERER | NO ACCESS TO PROTECTED RESIDUE EXCEPT EXPLICIT NON-DISCLOSING HASH EQUALITY | NO AUTOMATIC PRODUCT OR GOVERNANCE PHASE CHAINING | SUPERSEDED UNIT 5A DIRECTION IS CANCELLED

## Task-specific pointers

- `docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md::# Manta Direct Route — PHASE-MANTA-B2 Activation Contract`
- `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md::## §R.31 Active Phase-C continuation requirement registry — governance metadata`
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md::### 13.17 Active Phase-C schema requirement registry — governance metadata`
- `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md::# Update 2026-07-22 - C5-DOCUMENTATION-CLOSEOUT-R1 (PHASE-C5 supervisor acceptance and closeout; OC-C5-EMISSION-001 SATISFIED)`
- `docs/governance/traceability/purchase-order-phase-c.json::/requirements`
