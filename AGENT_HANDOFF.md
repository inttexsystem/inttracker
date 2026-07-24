# Agent Handoff
<!-- GENERATED_COMPATIBILITY_VIEW: docs/governance/current-state.json via scripts/governance/render-unit4-canonical-views.mjs; NO INDEPENDENT AUTHORITY -->

This generated continuation view owns no rules, state, product semantics, or acceptance.

## Routing

- Repository: `ravatexapps-dotcom/controle-tapetes-staging`
- Workspace: `D:\Programação\controle-tapetes-g28`
- Branch: `dev`
- Publication boundary: `staging/dev`; EXPLICIT_SINGLE_FAST_FORWARD_ONLY

## Current objective

- Status: `IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED / AWAITING ARCHITECT REVIEW / OPEN`
- Objective: PHASE-MANTA-B1 (Manta direct-route expedition-source foundation, db/81, the db/82 source-immutability / post-lock-membership / source-non-emptiness correction, and the db/83 source-route / item-identity correction) is implemented and locally + concurrently verified on a disposable PostgreSQL cluster, awaiting architect review; the phase remains open. db/81 adds a dormant second typed expedition source expedicoes.op_tecelagem_id (the Manta weaving OP) mutually exclusive with op_latex_id (exactly-one-source CHECK; one expedition per Manta OP via a partial unique index), with authoritative source-route validation (tecelagem, non-empty, homogeneous Manta), expedition-item membership, consumed-output immutability and a Manta OP reopening restriction. db/82 forward-corrects three db/81 defects without editing db/78-81: the expedition source is now immutable after INSERT (any op_latex_id/op_tecelagem_id change is rejected before any lock, removing the expedicoes->ops lock inversion, no retificacao bypass); expedition-item membership is validated only AFTER locking the source OP (post-lock re-read of the op_item owner, no stale-read accept, no expedicoes row lock); and a new op_itens_source_nonempty_guard forbids emptying a selected expedition source (Latex or Manta) via last-item delete/move. db/83 forward-corrects four remaining defects without editing db/78-82: a new ops_source_type_immutability_guard rejects ops.tipo changes while an OP is a selected expedition source (no retificacao bypass); op_itens_route_homogeneity_guard_fn now requires every item of a selected source OP to match the source's required product type, catching a single-item OP's sole item flipping type (a gap the mixing-only homogeneity check could not catch); expedicao_itens_membership_guard_fn now requires an expedition item's modelo_id and pedido_item_id to mirror its referenced op_item exactly (including NULL=NULL), with the delivery-only early-return widened to all four identity columns; and op_itens_expedicao_reference_guard_fn now protects modelo_id and pedido_item_id in addition to op_id for a referenced op_item, with no retificacao bypass for any of the three. The route stays dormant: no UI/RPC/writer creates a Manta expedition; entregas.etapa='cima', entregas_destino_cima_chk, salvarEntregaCima and the Latex expedition/delivery path are unchanged; no new entregas.etapa value is created; Manta never enters finishing. db/81, db/82 and db/83 are applied only to disposable local clusters; no shared-development, staging or production apply is authorized. PHASE-MANTA-B2 (route activation: the Manta writer, the route-conditional cima destination relaxation, the balance-preserving reversal/correction writer, the dynamic Manta stepper and route-aware progress) is not authorized. Business-flow recreation remains paused.
- Next authorizable action: `PHASE-MANTA-B1-ARCHITECT-REVIEW` / `ARCHITECT_DECISION`

## Blockers and decisions

- Blockers/debts: `INGESTOR-DOC-CYCLE-VERIFY-DEFERRED`, `CAMADA3-BK5-BK8`, `DELETE-PROD-GUARD-A`, `CODE-HEALTH-AUDIT-18-R1`, `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`, `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`, `C3D-13-UNMAPPED-ROWS-COMPLETENESS-GATE`
- Open architect decisions: Select the next product or governance phase after acceptance. | Rule on historical saldo_fios provenance before any real receipt cutover. | Resolve native receipt compatibility for multiple purchase-order origins.

## Prohibitions

- NO PRODUCT IMPLEMENTATION | NO DATABASE, SUPABASE, SQL, MIGRATION, ACL/RLS, AUTH, OR ENVIRONMENT ACCESS | NO DEPLOYMENT, ACTIVATION, CUTOVER, PONR, OR PRODUCTION ACTION | NO MAIN, ORIGIN, TAG, ADDITIONAL REF, FORCE, OR SECOND PUBLICATION ATTEMPT | NO CLEANUP, ARCHIVAL, DEPRECATION, PARTITIONING, OR PHYSICAL DELETION | NO MANUAL EDIT OF GENERATED HANDOFF OR OTHER GENERATED OUTPUT OUTSIDE ITS RENDERER | NO ACCESS TO PROTECTED RESIDUE EXCEPT EXPLICIT NON-DISCLOSING HASH EQUALITY | NO AUTOMATIC PRODUCT OR GOVERNANCE PHASE CHAINING | SUPERSEDED UNIT 5A DIRECTION IS CANCELLED

## Task-specific pointers

- `docs/architecture/MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md::# Manta Direct Route — PHASE-MANTA-B Phase Contract`
- `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md::## §R.31 Active Phase-C continuation requirement registry — governance metadata`
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md::### 13.17 Active Phase-C schema requirement registry — governance metadata`
- `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md::# Update 2026-07-22 - C5-DOCUMENTATION-CLOSEOUT-R1 (PHASE-C5 supervisor acceptance and closeout; OC-C5-EMISSION-001 SATISFIED)`
- `docs/governance/traceability/purchase-order-phase-c.json::/requirements`
