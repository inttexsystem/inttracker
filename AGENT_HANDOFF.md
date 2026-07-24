# Agent Handoff
<!-- GENERATED_COMPATIBILITY_VIEW: docs/governance/current-state.json via scripts/governance/render-unit4-canonical-views.mjs; NO INDEPENDENT AUTHORITY -->

This generated continuation view owns no rules, state, product semantics, or acceptance.

## Routing

- Repository: `ravatexapps-dotcom/controle-tapetes-staging`
- Workspace: `D:\Programação\controle-tapetes-g28`
- Branch: `dev`
- Publication boundary: `staging/dev`; EXPLICIT_SINGLE_FAST_FORWARD_ONLY

## Current objective

- Status: `CLOSED / ACCEPTED / APPLIED TO SHARED DEVELOPMENT / LIVE DATABASE VERIFIED`
- Objective: PHASE-MANTA-B1 (Manta direct-route expedition-source foundation, db/81, the db/82 source-immutability / post-lock-membership / source-non-emptiness correction, the db/83 source-route / item-identity correction, and the db/84 symmetric-Latex-route / source-lineage correction) is closed and accepted: db/81, db/82, db/83 and db/84 were applied once, in order, to shared development ucrjtfswnfdlxwtmxnoo and live-validated (contract section 14). db/81 adds a dormant second typed expedition source expedicoes.op_tecelagem_id (the Manta weaving OP) mutually exclusive with op_latex_id (exactly-one-source CHECK; one expedition per Manta OP via a partial unique index), with authoritative source-route validation, expedition-item membership, consumed-output immutability and a Manta OP reopening restriction. db/82 makes the selected source immutable after INSERT, validates expedition-item membership only after locking the source OP, and forbids emptying a selected expedition source via last-item delete/move. db/83 makes ops.tipo immutable while referenced as a source, closes the single-item route-homogeneity gap, aligns expedition-item modelo_id/pedido_item_id to their referenced op_item exactly, and makes a referenced op_item's identity fully immutable. db/84 makes the Latex source branch symmetric to the Manta branch (non-empty, homogeneous tipo_produto), derives and requires the exact source OP->Lote->Pedido->Cliente lineage on INSERT, makes expedicoes.pedido_id/lote_id/cliente_id immutable alongside the source columns, and protects a selected source's OP lote_id, Lote pedido_id/cliente_id and participating Pedido cliente_id — all behind a pre-existing-data gate and with no app.retificacao_autorizada bypass for any of these identity/lineage fields. Live validation proved: migration history recorded exactly once each, in order, terminal 84; all ten guard triggers present and firing in the documented order; the deployed expedicoes_source_validation_guard_fn body matches the committed db/84 source byte-for-byte; existing Latex RPC signatures and grants unchanged; no Manta expedition writer exists anywhere in the schema; entregas_destino_cima_chk unchanged; a rolled-back validation transaction proved all 8 mandatory behaviors with zero persistent rows; the operational corpus stayed empty throughout. The route stays dormant: no UI/RPC/writer creates a Manta expedition; entregas.etapa='cima', entregas_destino_cima_chk, salvarEntregaCima and the Latex expedition/delivery path are unchanged; no new entregas.etapa value is created; Manta never enters finishing. No staging or production apply is authorized. PHASE-MANTA-B2 (route activation: the Manta writer, the route-conditional cima destination relaxation, the balance-preserving reversal/correction writer, the dynamic Manta stepper and route-aware progress) is not authorized. Business-flow recreation remains paused.
- Next authorizable action: `PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1` / `ARCHITECT_DECISION`

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
