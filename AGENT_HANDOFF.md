# Agent Handoff
<!-- GENERATED_COMPATIBILITY_VIEW: docs/governance/current-state.json via scripts/governance/render-unit4-canonical-views.mjs; NO INDEPENDENT AUTHORITY -->

This generated continuation view owns no rules, state, product semantics, or acceptance.

## Routing

- Repository: `ravatexapps-dotcom/controle-tapetes-staging`
- Workspace: `D:\Programação\controle-tapetes-g28`
- Branch: `dev`
- Publication boundary: `staging/dev`; EXPLICIT_SINGLE_FAST_FORWARD_ONLY

## Current objective

- Status: `IMPLEMENTED / LOCALLY VALIDATED / SHARED-DEVELOPMENT APPLIED AND LIVE VALIDATED / AWAITING ARCHITECT ACCEPTANCE`
- Objective: BATCH-01 and BATCH-02 of Kleber's operational review are implemented and published. BATCH-02 added the commercial Pedido date and controlled Pedido numbering, and moved product-type selection INLINE into the item row. DATABASE: exactly one forward-only migration, db/89_pedido_commercial_date_and_number_control, was applied once to shared development ucrjtfswnfdlxwtmxnoo, moving the terminal from db/88 to db/89. It adds public.pedidos.data_pedido (nullable -> backfill from criado_em projected onto America/Sao_Paulo -> Brazil-local default -> NOT NULL), the pedidos_numero_positivo_chk (numero > 0) constraint, the pedidos_numero_immutability_guard trigger that refuses any UPDATE changing numero while accepting a same-value update, and the pedidos_numero_sequence_sync trigger that advances the identity sequence forward-only when an explicit number exceeds it. Gaps are accepted by design; gapless numbering is NOT attempted; UNIQUE(numero) remains the final concurrency backstop. criado_em is NEVER again read as the commercial date. ENVIRONMENT IDENTITY was proved positively by inet_server_addr 2600:1f18:38df:9501:5625:752d:c0e9:7c06 matching the AAAA record of db.ucrjtfswnfdlxwtmxnoo.supabase.co and negatively against production gqmpsxkxynrjvidfmojk and forbidden bhgifjrfagkzubpyqpew, neither of which was ever connected to. PRE-APPLY: terminal was exactly db/88 with zero partial db/89 objects and the data gate satisfied (zero pedidos with null or non-positive numero). LIVE VALIDATION: one bounded transaction ending in ROLLBACK proved automatic numbering (68 > 67), the Brazil-local data_pedido default, an available manual number accepted exactly, a duplicate refused with 23505, renumbering refused with 23514, and a same-value update accepted; a manual number below the sequence did not move it. ZERO RESIDUE: pedidos returned to its single real row (numero 67), zero synthetic rows, zero null data_pedido. The sequence advanced 67 -> 68, the single accepted gap from the non-transactional automatic insert. UI: the item modal was REMOVED and Tipo/Modelo are now inline dropdowns in the item row (Img | Tipo | Modelo | Cores | Largura | Metragem | Observacao | Acoes); modelos.tipo_produto now FAILS CLOSED on every Pedido surface instead of degrading unknown models to Tapete. STRUCTURAL: the item row was extracted to js/screens/pedido-item-row-editor.js, pedido-form.js fell from 1089 to 708 lines, and the BATCH-01 structural debt is CLOSED. REGRESSION: 4299 tests, 4298 pass / 1 fail, the sole failure being the accepted Category-E tests/g14-c-bridge-smoke.test.js. BOUNDARY: production UNCHANGED and NOT ACCESSED; no Vercel, main, origin or tag action. The only next action is architect acceptance of BATCH-02; no phase chains automatically.
- Next authorizable action: `KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-ARCHITECT-REVIEW` / `ARCHITECT TECHNICAL AND PRODUCT ACCEPTANCE`

## Blockers and decisions

- Blockers/debts: `INGESTOR-DOC-CYCLE-VERIFY-DEFERRED`, `CAMADA3-BK5-BK8`, `DELETE-PROD-GUARD-A`, `CODE-HEALTH-AUDIT-18-R1`, `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`, `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`, `C3D-13-UNMAPPED-ROWS-COMPLETENESS-GATE`, `G14-C-BRIDGE-EXTERNAL-CORPUS-DEPENDENCY`, `DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR`, `DOCUMENTS-CATALOG-METADATA-DRIFT`
- Open architect decisions: Await Kleber's operational review of the application on shared development and then group the reported concrete defects into ONE bounded stabilization order; do not correct them through isolated microphases. | Decide when and under what order the Manta direct-route backend is promoted beyond shared development; production and Vercel remain prohibited without a new explicit order. | Rule on historical saldo_fios provenance before any real receipt cutover. | Resolve native receipt compatibility for multiple purchase-order origins. | Decide whether to retire window.atribuirFornecedorFioOp or restore a legitimate owner/caller. | Decide how the documents-ingestor bridge corpus dependency is satisfied for tests/g14-c-bridge-smoke.test.js. | Order a separate reviewed correction for the docs/governance/catalog/documents.json metadata drift.

## Prohibitions

- NO FURTHER PRODUCT IMPLEMENTATION WITHOUT A NEW ORDER | NO FURTHER DATABASE, SUPABASE, SQL, MIGRATION, ACL/RLS, AUTH, OR ENVIRONMENT ACCESS | NO DEPLOYMENT, ACTIVATION, CUTOVER, PONR, OR PRODUCTION ACTION | NO MAIN, ORIGIN, TAG, ADDITIONAL REF, FORCE, OR SECOND PUBLICATION ATTEMPT | NO CLEANUP, ARCHIVAL, DEPRECATION, PARTITIONING, OR PHYSICAL DELETION | NO MANUAL EDIT OF GENERATED HANDOFF OR OTHER GENERATED OUTPUT OUTSIDE ITS RENDERER | NO ACCESS TO PROTECTED RESIDUE EXCEPT EXPLICIT NON-DISCLOSING HASH EQUALITY | NO AUTOMATIC PRODUCT OR GOVERNANCE PHASE CHAINING | NO ISOLATED MICROPHASE CORRECTION OF KLEBER REVIEW DEFECTS; THEY MUST BE GROUPED INTO ONE BOUNDED STABILIZATION ORDER | NO REAL BUSINESS-FLOW RECREATION WITHOUT A NEW EXPLICIT ORDER | SUPERSEDED UNIT 5A DIRECTION IS CANCELLED

## Task-specific pointers

- `docs/ledgers/G28_LEDGER.md::## 2026-07-25 — KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1 — feat: add Pedido date and controlled numbering`
- `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md::## §R.31 Active Phase-C continuation requirement registry — governance metadata`
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md::### 13.17 Active Phase-C schema requirement registry — governance metadata`
- `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md::# Update 2026-07-22 - C5-DOCUMENTATION-CLOSEOUT-R1 (PHASE-C5 supervisor acceptance and closeout; OC-C5-EMISSION-001 SATISFIED)`
- `docs/governance/traceability/purchase-order-phase-c.json::/requirements`
