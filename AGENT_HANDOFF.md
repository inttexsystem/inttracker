# Agent Handoff
<!-- GENERATED_COMPATIBILITY_VIEW: docs/governance/current-state.json via scripts/governance/render-unit4-canonical-views.mjs; NO INDEPENDENT AUTHORITY -->

This generated continuation view owns no rules, state, product semantics, or acceptance.

## Routing

- Repository: `ravatexapps-dotcom/controle-tapetes-staging`
- Workspace: `D:\Programação\controle-tapetes-g28`
- Branch: `dev`
- Publication boundary: `staging/dev`; EXPLICIT_SINGLE_FAST_FORWARD_ONLY

## Current objective

- Status: `IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED / AWAITING ARCHITECT REVIEW`
- Objective: PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1 (bounded backend implementation, local disposable PostgreSQL only) is implemented and awaits architect review. Exactly three forward-only migrations were created, in three linear commits: db/85_manta_cima_route_conditional_delivery.sql (fail-closed pre-existing data gate; entregas_destino_cima_chk dropped and replaced by the route-aware entrega_itens_cima_route_destino_guard and entregas_cima_destino_route_guard pair, which derive the route only through op_itens.modelo_id to modelos.tipo_produto, require a destination for Tapete and prohibit one for Manta, and offer no app.retificacao_autorizada bypass; registrar_entrega_cima_manta as the only Manta cima writer, atomic over header, items and the manta_saida_registrada event, never calling gerar_op_latex/_split); db/86_manta_expedition_release_writer.sql (public.expedicao_comandos on the accepted section 13.2 canon, RLS on, no client DML, immutable after insert, no FK to expedition rows; consultar_saldo_expedicao_manta and liberar_expedicao_manta_parcial, with availability from non-defect measured cima output joined op_item_id-exact minus released, planned quantity never an authority, additive upsert copying modelo_id/pedido_item_id verbatim, and the full replay contract); db/87_manta_expedition_reversal_and_route_completion.sql (estornar_expedicao_manta_parcial with mandatory trimmed motivo, refusing reversal above released or below delivered, deleting a zero-balance item while retaining the header and never touching movement history; and the route-symmetric forward correction of concluir_pedido_se_pronto that closes the blocking pre-existing defect, requiring an expedition through op_tecelagem_id for every terminal Manta weaving OP and treating unreleased measured output as a pendency, while preserving every Tapete message, the signature, the authorization and the grants verbatim). The mandatory pre-edit lock-order reconciliation was resolved as outcome A, one globally compatible order: because PostgreSQL takes the target-row lock before a BEFORE-ROW trigger body runs, the item guard requests an ops lock only on INSERT and the header guard requests none at all, so no path holds a delivery row lock and then requests an ops row lock; item-versus-header races serialize on an explicit entregas FOR SHARE lock, which the FK's implicit FOR KEY SHARE would not provide, and the loser re-validates totally against committed state. db/01-84 are byte-unchanged, no fourth migration was needed, no js/** file was touched and no environment was accessed. Evidence: db/01..87 clean apply; db/85, db/86 and db/87 each re-applied with zero schema, constraint, trigger, index, function-body, grant and RLS drift; 68 integration proofs in one rolled-back transaction; db/78-80 and db/81-84 regressions, Manta finishing rejection, the Latex expedition/delivery flow and C5A emission all green and unchanged; fifteen distinct-session concurrency proofs with zero 40P01 and proved cluster destruction. Shared development ucrjtfswnfdlxwtmxnoo remains at terminal 84 with the Manta route dormant; no UI is activated; PHASE-MANTA-B2B and PHASE-MANTA-B2C remain unauthorized. Business-flow recreation remains paused.
- Next authorizable action: `PHASE-MANTA-B2A-ARCHITECT-REVIEW` / `REVIEW`

## Blockers and decisions

- Blockers/debts: `INGESTOR-DOC-CYCLE-VERIFY-DEFERRED`, `CAMADA3-BK5-BK8`, `DELETE-PROD-GUARD-A`, `CODE-HEALTH-AUDIT-18-R1`, `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`, `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`, `C3D-13-UNMAPPED-ROWS-COMPLETENESS-GATE`
- Open architect decisions: Select the next product or governance phase after acceptance. | Rule on historical saldo_fios provenance before any real receipt cutover. | Resolve native receipt compatibility for multiple purchase-order origins.

## Prohibitions

- NO PRODUCT IMPLEMENTATION | NO DATABASE, SUPABASE, SQL, MIGRATION, ACL/RLS, AUTH, OR ENVIRONMENT ACCESS | NO DEPLOYMENT, ACTIVATION, CUTOVER, PONR, OR PRODUCTION ACTION | NO MAIN, ORIGIN, TAG, ADDITIONAL REF, FORCE, OR SECOND PUBLICATION ATTEMPT | NO CLEANUP, ARCHIVAL, DEPRECATION, PARTITIONING, OR PHYSICAL DELETION | NO MANUAL EDIT OF GENERATED HANDOFF OR OTHER GENERATED OUTPUT OUTSIDE ITS RENDERER | NO ACCESS TO PROTECTED RESIDUE EXCEPT EXPLICIT NON-DISCLOSING HASH EQUALITY | NO AUTOMATIC PRODUCT OR GOVERNANCE PHASE CHAINING | SUPERSEDED UNIT 5A DIRECTION IS CANCELLED

## Task-specific pointers

- `docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md::## 15. PHASE-MANTA-B2A implementation record`
- `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md::## §R.31 Active Phase-C continuation requirement registry — governance metadata`
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md::### 13.17 Active Phase-C schema requirement registry — governance metadata`
- `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md::# Update 2026-07-22 - C5-DOCUMENTATION-CLOSEOUT-R1 (PHASE-C5 supervisor acceptance and closeout; OC-C5-EMISSION-001 SATISFIED)`
- `docs/governance/traceability/purchase-order-phase-c.json::/requirements`
