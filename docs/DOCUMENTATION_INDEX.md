# Documentation Index — Ravatex Controle de Tapetes

> Documentation index. Every new AI session or person must
> start from the **authority list** in §1, which is the sole
> active list of documentary authority in the project. The
> **legacy docs** have been preserved as historical context and
> **must not guide execution** after the refactor/hardening cycle.
>
> **Convention:** this directory is docs-only. No changes to
> code, tests, or `index.html` are made here.

## 0. Role of this index and documentary governance contract

As of `G28-DOCS-B1` (additive phase, no migration), this file
is formally recognized as the project's **sole arbiter of
documentary authority and canonical paths**. It answers:

- what is the **order of authority** among documents;
- what is the **classification** of each document (canonical,
  operational, contract, runbook, legacy, diagnostic,
  governance);
- what are the **canonical paths**;
- which documents are **legacy** and pending reconciliation;
- what is the **responsibility** of each document category.

This index is **not** the source of the current phase, next
action, HEAD, working tree, operational status, or closeout
history. Those facts belong to `PROJECT_STATE.md`, Git, and the
front ledger, per the contract in
[`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md).

The **documentary governance model** that governs ownership,
duplication, per-phase updates, minimum documentary transaction,
compaction, and treatment of Git/migrations/HEAD is
`docs/governance/DOCUMENTATION_MODEL.md`. In case of conflict
between any project document and this model, the model prevails,
unless the revision is recorded in this index and in the
respective ledger.

The competing lists of "canonical sources (fontes canônicas)",
"functional precedence", and "required documents" that existed
in other files (§2 of this index,
`docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`,
`Guide-and-governance-rules.stxt`) were reconciled in
`G28-DOCS-B3-E1`: they now point to §1 of this index as the
sole active list of authority. No other competing list should
be created.

## 1. Canonical documentary authority (single list)

This is the **sole active list of documentary authority** in
the project. Any other document describing authority,
prevalence, precedence, or "required documents" must point to
this section, not repeat the list.

| Document | Role |
|---|---|
| `docs/DOCUMENTATION_INDEX.md` (this file) | Classifies the documents and defines their roles. |
| `docs/governance/DOCUMENTATION_MODEL.md` | Defines the governance model and the rules for per-phase documentary updates. Content in English since `DOC-LANGUAGE-MIGRATION-L1`; pt-BR original archived at `docs/archive/pt-BR/` (see §7). |
| `docs/governance/SUPERVISION_PROTOCOL.md` | Defines the roles of the supervision process (Architect/Reviewer/Resident Executor), onboarding of a new reviewer, order format, and gates (visual validation, approved mockup, migration as its own gate, Auth risk kept separate). Does not define state or documentary organization rules — that is `DOCUMENTATION_MODEL.md`. Content in English since `DOC-LANGUAGE-MIGRATION-L1`; pt-BR original archived at `docs/archive/pt-BR/` (see §7). |
| `PROJECT_STATE.md` (root) | Sole owner of the current operational state per front. Content in English since `DOC-LANGUAGE-MIGRATION-L2`; pt-BR original archived at `docs/archive/pt-BR/PROJECT_STATE.md` (see §7). |
| `AGENT_HANDOFF.md` (root) | Sole active operational handoff. Content in English since `DOC-LANGUAGE-MIGRATION-L2`; pt-BR original archived at `docs/archive/pt-BR/AGENT_HANDOFF.md` (see §7). |
| `docs/ledgers/G28_LEDGER.md` | Structured append-only history of the G28 front. |
| `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | History exclusive to the refactor front. |
| `docs/legacy/pre-model/MANIFEST.md` | Immutable pre-model preservation; not operational. |
| Git | Commits, diffs, manifests, branch, HEAD, staging, and divergence — consult directly. |

> These roles **do not overlap**. In divergence between
> documents with distinct roles, the document whose role
> matches the question resolves it (state → `PROJECT_STATE.md`;
> update rule → `DOCUMENTATION_MODEL.md`; authority/classification
> → this index; commit/diff → Git). The detailed per-phase update
> matrix is in
> [`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md) §11.

### Classificatory inventory (documents by category)

The documents below have a legitimate classificatory or
contractual function; they are **not** a second prevalence
list. In divergence with §1, resolve by the role of each one.

| Document | Category | Purpose |
|---|---|---|
| `docs/architecture/CODE_HEALTH_RULES.md` | Architectural contract | 19 binding architectural health rules (18 modularization + rule 19, on language). Every new phase must comply. Content in English since `DOC-LANGUAGE-MIGRATION-L1`; pt-BR original archived at `docs/archive/pt-BR/` (see §7). |
| `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` | Architectural contract | Rules for the Portal B2B/Pedidos front: separates client/admin/supplier, operational vs. visual status, common components, phase decomposition. |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | Persistent plan | Plan for the Pedido ↔ OP ↔ Movimentação ↔ Documentos front: entry state, decisions, target model, screen roles, future phases (B through J), evidence template. |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | Technical contract | Schema contract for Pedido ↔ OP ↔ Movimentação ↔ Documentos: validates tables, FKs, RPCs, triggers, RLS; establishes the Pedido→OP link, canonical movement, stepper, per-stage balance. |
| `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` | Backlog | Backlog of the Pedido production flow (§1-8) + Admin backlog (§9). 8 production items (A-H) + 10 Admin items (P1/P2). Mandatory reading before implementation in the production flow. |
| `docs/architecture/AUTH_DELETE_USER_DESIGN.md` | Design | Semantics of user deletion/deactivation: deactivate (soft delete + Auth ban) instead of physically deleting. |
| `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` | Proposed spec (design) | Spec for Camada 2 (user administration, A1-A7 + password policy): evidenced comparison Tapetes × SGAA_clean_baseline (external functional/visual reference, read-only), module plan, Auth risk classification, and order of subphases with gates. **Status: `PROPOSED`. Authority conditioned on explicit architect acceptance per subphase** — not an authorized source of implementation until each individual subphase is approved. |
| `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` | Design (approved) | Approved visual specification for `A3.2` (summary/KPI cards, toolbar, role badge, inactive-row opacity): final color/spacing/typography values, implemented in `js/screens/admin-usuarios.js`. Explicitly documents what was left out of scope ("Last access" column, blocked by migration HARD STOP; A5 icons; A3.3 bulk actions). **Status: `CLOSED / ACCEPTED`** (architect visual validation confirmed 2026-07-15). |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` | Asset inventory | Map of components, entry points, contracts, and `.claude` structure. **Not a source of current state nor an authority arbiter.** |
| `Guide-and-governance-rules.stxt` (root) | Agent governance | Stable operational rules for the Architect/IAexec agent (Git, scope, decomposition, routing). **Does not repeat this authority list.** |

### Operational runbooks (complement, do not replace)

Runbooks describe **how to execute** approved procedures. They
do not replace §1 authority; in divergence, §1 prevails.

| Document | Purpose |
|---|---|
| `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` | Standard operational procedure for creating users (admin/supplier) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Replaces the manual flow of creating an Auth user in Studio and copying the UID. |
| `docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | Operational release plan for taking the Auth chain from staging to production. Required order, GO/NO-GO criteria, rollback, read-only validations. |
| `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md` | Official taxonomy of the environments: `bhgifjrfagkzubpyqpew` = Legacy (do not touch), `ucrjtfswnfdlxwtmxnoo` = working parallel. State of each environment, architectural decision, next steps. |

## 1b. UI diagnostic documents (non-normative, non-executable)

Documents in this section **compare** approved mockups against
the current implementation, to scope future phases of visual
adjustment. **Not a canonical source**, they do not by
themselves authorize implementation and do not replace the §1
authority list.

| Document | Purpose | Phase |
|---|---|---|
| `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` | Read-only inventory of divergences between the 5 mockups of the B2B Client Portal (Dashboard, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido, Acompanhamento) and the current `js/screens/cliente-*.js` screens. Per-screen matrix, detailed gaps, operational particulars still TBD, and proposal of future phases (`UI-GAP-FIX-*`, `UI-OPERATIONS-RULES-A`). Implements or fixes nothing. | `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` |
| `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` | Docs-only operational matrix for the B2B Client Portal UI. Consolidates decisions already closed, records pending items `OP-001` through `OP-012`, technical recommendations, per-screen impact, and the future sequence (`UI-GAP-FIX-NOVO-PEDIDO-A` through `UI-GAP-FIX-SHELL-A`). Does not implement UI nor change code/schema/Supabase. | `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` |

## 1c. Structured history and per-front preservation

Classificatory detail of the history/preservation roles
declared in §1. Not a second authority list.

- `docs/ledgers/G28_LEDGER.md` — append-only; not a source of current state;
  does not replace Git; does not automatically reconstruct pre-model history.
- `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` — history ledger
  exclusive to the refactor front; stays at its current path; must not be
  copied into `docs/legacy/`.
- `docs/legacy/pre-model/MANIFEST.md` — index of the complete and
  immutable snapshots prior to compaction; snapshots are not sources of
  current state; snapshots receive no new closeouts; content preserved for
  audit, not for operational routing.
- `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md` — closeout narratives
  of phases moved from `PROJECT_STATE.md` by `PROJECT-STATE-COMPACTION-A`
  (2026-07-16), verbatim and in original order. **Not a source of current
  state** (that is `PROJECT_STATE.md`, now current-state-only); archived
  phases are indexed in the "Closed phases" table of `PROJECT_STATE.md`.
  Append-only for this batch; the architect decisions recorded there
  remain in force and are condensed in `PROJECT_STATE.md` §"Binding
  decisions in force".

## 1d. Diagnostic and reconciliation reports, and external supervision artifacts (non-normative)

Documents in this section record read-only diagnostics or
external supervision artifacts. They are not a canonical source
of state, do not by themselves authorize implementation, and do
not replace the §1 authority list. Architect decisions derived
from these documents are recorded in `PROJECT_STATE.md` and in
the ledger of the applicable front, not in the documents
themselves.

| Document | Purpose | Phase |
|---|---|---|
| `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` | Read-only diagnostic of the general backlog: inventory in the actual code of Camada 2 (user administration) and Camada 3 (backup), worktree audit, factual evidence of the Documents section validation (without classifying acceptance), a single table of remaining backlog, and divergences between canonical/code/ChatGPT closeout. Does not change state; decisions derived are recorded in `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`). | `BACKLOG-RECONCILIATION-READONLY-R1` |
| `docs/reports/TEST_MOCK_FIDELITY_AUDIT_2026-07-17.md` | Read-only fidelity audit of every test double in `tests/` (124 suites) against the real behavior it imitates (DOM/`el()` boolean coercion, `functions.invoke()` double envelope, `.rpc()`/PostgREST envelopes, `js/ui.js` primitives): per-suite verdicts, the zero-live-(c) result, the structural residual classes (`R1`/`R2`/`R3`), the shared-double `tests/_doubles.js` assessment, prioritized lots (`L0`–`L3`), and the known-debt re-grounding (fixed-port `:8765` + stale inline-`<script>` assertions). Does not change state; decisions derived (shared-double approval, `§20`, lot authorizations) are recorded in `PROJECT_STATE.md` and `docs/ledgers/G28_LEDGER.md`. | `TEST-MOCK-FIDELITY-AUDIT` |
| `docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md` | Closeout record of ChatGPT's supervision: state per its own record, orders issued but not closed, decisions discussed outside canonical files, and pending items awaiting architect decision. External, non-canonical artifact; its `PROJECT-CONTROL-BASELINE-R1` report was evaluated and rejected (`REJECTED / NOT RATIFIED`) in `PROJECT_STATE.md` (`G28-RECONCILIATION-DECISIONS-A`). | External handoff (ChatGPT), not numbered as a project phase |
| `CLAUDE.md` (root) | Harness pointer automatically loaded by Claude Code agents. **Authority: NONE** — not a source of state, rule, or classification; points to `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`, `docs/governance/DOCUMENTATION_MODEL.md`, and this index. In conflict with any canonical document, the canonical one prevails. Content in English since `DOC-LANGUAGE-MIGRATION-L1` (includes a pointer-summary of the language policy, pointing to the canonical homes); pt-BR original archived at `docs/archive/pt-BR/CLAUDE.md` (see §7). | `Add CLAUDE.md agent entrypoint` |
| `.claude/launch.json` | Harness config to start the local static server (`python -m http.server 8765`) used in the architect's visual validation gates (A3.1 and future Camada 2 subphases touching UI: A3.2, A4.2, A6.3). **Authority: NONE** — not a source of state, rule, or classification; contains no credential, URL, or secret (inspected before commit). Same treatment as `CLAUDE.md`: tooling pointer, not canonical. | `Add local preview launch config` |

## 2. Prevalence rule

The sole active list of documentary authority is in **§1** of
this index. The prevalence rule is: resolve the question by the
document's **role** (state → `PROJECT_STATE.md`; update rule →
`docs/governance/DOCUMENTATION_MODEL.md`; classification/authority
→ §1 of this index; commit/diff/HEAD/staging/divergence → Git).

The detailed matrix of **which document to update per type of
phase event** is in
[`docs/governance/DOCUMENTATION_MODEL.md`](governance/DOCUMENTATION_MODEL.md)
§11 ("Update rule per phase") and §12 ("Minimum documentary
transaction").

The numbered prevalence list that existed in this section was
removed in `G28-DOCS-B3-E1` for being a competitor of §1. Legacy
docs (`docs/superpowers`, `docs/qa`, old docs at the root of
`docs/`) continue to **not** guide execution.

## 3. Current operational runbooks

Folder `docs/operations/`. They document **how to execute**
procedures approved by the canonical sources. When there is
divergence between a runbook and a canonical source, the
canonical sources prevail.

| File | Procedure | Phase |

| File | Procedure | Phase |
|---|---|---|
| `AUTH_USER_PROVISIONING_RUNBOOK.md` | Creation of users (admin/supplier) via Edge Function `admin-create-user` + UI `#/cadastros/usuarios`. Replaces the manual flow of creating an Auth user in Studio and copying the UID. | `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A` |
| `AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | Production release plan — schema, secrets, Edge Functions, frontend. Required order, rollback, GO/NO-GO. | `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-RELEASE-PLAN-A` |
| `PARALLEL_ENVIRONMENT_RECONCILIATION.md` | Official environment taxonomy. Legacy vs. parallel, state of each, blockers. | `RAVATEX-TAPETES-PARALLEL-ENV-RECONCILIATION-A` |

Convention: these runbooks are **docs-only** and
**operational**. Updates must be made in dedicated docs-only
phases.

## 4. Schema / versioned migrations (Supabase)

The `db/` folder contains the canonical schema and the
migrations applied (partially) in staging and production.
**Schema-only** migrations (no destructive deletes) are created
in their own phases and validated by smoke tests before any
application to Supabase. When a migration has **not yet been
applied**, this is explicitly recorded in the file header and
in `PROJECT_STATE.md`.

| File | Purpose | Phase | Status |
|---|---|---|---|
| `db/01_schema.sql` | Base schema for the app's tables. | `RAVATEX-TAPETES-FASE-1` | applied in staging/production |
| `db/02_functions.sql` | Original auxiliary RLS functions (`is_admin`, `meu_fornecedor_id`). | `RAVATEX-TAPETES-FASE-1` | applied (replaced in production by `db/05_fix_pgrst.sql`) |
| `db/03_policies.sql` | RLS policies for all tables. | `RAVATEX-TAPETES-FASE-1` | applied in staging/production |
| `db/04_seed.sql` | Registration seeds. | `RAVATEX-TAPETES-FASE-1` | applied in staging |
| `db/05_fix_pgrst.sql` | PGRST fix + recreation of `is_admin`/`meu_fornecedor_id` with `EXCEPTION`. | `RAVATEX-TAPETES-FASE-5A` | applied in staging/production |
| `db/06_fase5a_policies.sql` | Additional policies for supplier deliveries. | `RAVATEX-TAPETES-FASE-5A` | applied in staging/production |
| `db/07_fase5a_destino_latex.sql` | Latex destination columns in deliveries. | `RAVATEX-TAPETES-FASE-5A` | applied in staging |
| `db/08_fase5b_latex.sql` | Support for latex OP (type, origin, latex supplier). | `RAVATEX-TAPETES-FASE-5B` | applied in staging |
| `db/09_fase6_cliente_lote.sql` | Tables `clientes` and `lotes`, function `gerar_op_latex`. | `RAVATEX-TAPETES-FASE-6` | applied in staging |
| `db/10_reset_producao.sql` | Destructive production reset (bulk DELETE). | — | **DO NOT run** without authorization. |
| `db/11_reset_ops.sql` | Destructive OP reset (bulk DELETE). | — | **DO NOT run** without authorization. |
| `db/12_auth_user_disable_schema.sql` | Support for user deactivation: columns `ativo`, `desativado_em`, `desativado_por`, `motivo_desativacao`; recreation of `is_admin` and `meu_fornecedor_id` to require `ativo is true`; recreation of policies `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update`. | `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (+ `...-SCHEMA-APPLY-A` + `...-SCHEMA-APPLY-EVIDENCE-A`) | **Applied in staging** (`ucrjtfswnfdlxwtmxnoo`) on `2026-06-24`, manually by HMNlead in the SQL Editor. Post-application validation: `ativo = true, total = 3`; no destructive column run; `db/10_reset_producao.sql` and `db/11_reset_ops.sql` were not executed; production `bhgifjrfagkzubpyqpew` was not touched. Validated by `tests/auth-disable-user-schema.smoke.js` (20/20) **before** application. |
| `db/13_pedidos_schema.sql` | Client Pedido schema/RLS: tables `pedidos`, `pedido_itens`, `pedido_eventos`; column `lotes.pedido_id` (nullable); admin-only RLS on all 3 tables; indexes on `cliente_id`, `status`, `token_acesso`, `pedido_id`. **Does not** create `pedidos.op_id`. **Does not** create a public policy. | `RAVATEX-TAPETES-PEDIDOS-SCHEMA-RLS-A` (+ `...-SCHEMA-APPLY-UCR-A` + `...-SCHEMA-APPLY-RECORD-A`) | **Applied in ucr** (`ucrjtfswnfdlxwtmxnoo`) on `2026-06-24` via Management API. Post-application validation: 3 tables created, RLS enabled, admin-only policies, indexes OK, `pedidos.op_id` absent, `lotes.pedido_id` present. Validated by `tests/pedidos-schema.smoke.js` (41/41). Frontend implemented (C1 + C2 + C2-R1 + C3A): listing `#/pedidos`, form `#/pedidos/novo` (admin creation as `rascunho`), color-preview fix (C2-R1), and read-only detail `#/pedidos/<uuid>` (C3A). Focused frontend validation: `pedido-detail.smoke.js` 30/30, `pedido-form.smoke.js` 35/35, `pedido-ui.test.js` 18/18, `pedidos-list.smoke.js` 29/29. **Strictly read-only** in the detail view (no insert/update/delete/rpc, no `functions.invoke`, no `token_acesso`, no public route, no mutation on `lotes`/`pedido_eventos`). |
| `db/14_cliente_perfil_schema.sql` | Authenticated client profile: role `cliente` in `usuarios.tipo` (constraint `usuarios_tipo_check`), column `usuarios.cliente_id` (FK → `public.clientes`), constraint `usuarios_vinculo_exclusivo_check` (admin/supplier/client with exclusive links), function `public.meu_cliente_id()` (SECURITY DEFINER, STABLE; requires `tipo='cliente' AND ativo=true AND cliente_id NOT NULL`; returns NULL on failure), minimal RLS policies for client SELECT/INSERT on `clientes`, `pedidos`, and `pedido_itens`. **Does not** grant client UPDATE/DELETE. **Does not** expose a public token. **Does not** create an anon policy. `pedido_eventos` remains admin-only (internal audit). | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1` + `B2` + `B2-RECORD-A` | **Applied in staging** (`ucrjtfswnfdlxwtmxnoo`) via Management API on `2026-06-24` (phase B2). Status 201, 33 statements. Post validations 23/23: `usuarios_tipo_check` with `cliente`, `usuarios.cliente_id` + FK, `usuarios_vinculo_exclusivo_check`, `meu_cliente_id()` (SECURITY DEFINER, grants OK), 5 client SELECT/INSERT policies, 0 client UPDATE/DELETE policies, 0 anon/token policies, 0 constraint violations. **Gap:** `admin-create-user` and the UI accept only `admin`/`fornecedor`; client-user provisioning pending. |
| `db/15_status_cliente_visual.sql` | Versioned base for B2B client visual tracking: new visual columns on `public.pedidos` (`status_cliente_visual`, `status_cliente_excecao`, `status_cliente_mensagem`, `status_cliente_atualizado_em`, `referencia_cliente`, `prazo_desejado`, `tipo_recebimento`); idempotent TEXT + CHECK checks; table `public.pedido_cliente_eventos`; admin-only RLS on this new table; INSERT guard trigger to prevent the client from publishing visual state; touch trigger for `status_cliente_atualizado_em` on visual updates. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` + `...-SCHEMA-B` | **Applied and validated in staging** (`ucrjtfswnfdlxwtmxnoo`) on `2026-06-26`. Structural validations completed: 7 new columns in `pedidos`, 10 columns in `pedido_cliente_eventos`, 4 constraints, 2 triggers, 2 functions, 1 index, `pedido_cliente_eventos = 0`. Client frontend already reads the real `status_cliente_visual`, but does not yet expose `pedido_cliente_eventos`. |
| `db/16_pedido_cliente_eventos_cliente_select.sql` | Versioned RLS policy to grant client-only `SELECT` on `public.pedido_cliente_eventos`, restricted to rows with `visivel_cliente = true` belonging to orders whose `cliente_id = public.meu_cliente_id()`. Preserves the existing admin policy and creates no writes, view, RPC, or trigger. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A` | **Versioned in the repo, not yet applied** in Supabase. Prepares the following staging-apply phase and the client's future read-only timeline. |
| `db/30_cliente_pedido_summary_readmodel.sql` | Public RPC `cliente_pedido_summary(UUID)` for the Pedido detail view in the Client Portal. Encapsulates the internal operational tables behind `SECURITY DEFINER`, authorizes admin or the owning client, returns a simplified JSONB DTO (`pedido`, `itens`, `parciais`, `timeline`, `entregas`, `pendencias`, `etapas`, `chain_state`) and does not publish OP/lot/supplier/invoice/waybill/cost/margin/catalog IDs. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` (+ `...-APPLY-STAGING-A` + `...-ACL-GRANTS-R1`) | **Function applied and functionally verified in staging** (`ucrjtfswnfdlxwtmxnoo`), confirmed on `2026-07-15` (`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS`). `public.cliente_pedido_summary(uuid)` exists with a body byte-for-byte equivalent to the file (**no schema drift**). **`db/30` itself remains absent** from `supabase_migrations.schema_migrations` (provenance debt preserved, `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, not repaired). Execution ACL **no broader than the canonical contract**: remediated on `2026-07-15` by the grants-only migration `db/57_cliente_pedido_summary_acl_grants.sql` (see its own row below, phase `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`), which revoked `EXECUTE` from `PUBLIC`/`anon`/`service_role`, keeping only `authenticated`. Authenticated browser smoke remains a non-blocking debt (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, no test client password). |
| `db/34_controlled_delete_pedido_op.sql` | RPCs for controlled test/staging physical deletion of Pedido and OP: `diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`. Removes the legacy trigger `ops_numeradas_no_delete` (db/26) to allow removing a numbered OP without real blockers. Blocks when there is an untreated delivery, Expedição, or child OP; requires `EXCLUIR` confirmation for non-blocking dependencies. `op_numeros` is never altered. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B` (+ `...-POLICY-FIX-C`) | **Applied and validated only in staging** (`ucrjtfswnfdlxwtmxnoo`); production `bhgifjrfagkzubpyqpew` untouched. Destructive logic renamed to `*_pre53` by `db/53` (see below); no public API under the original name since then. |
| `db/35_controlled_delete_test_cascade.sql` | Replaces the four `db/34` RPCs with versions that accept a controlled physical cascade (delivery + child OP) when there is no linked Expedição, requiring textual confirmation `EXCLUIR TUDO` (`requires_cascade_confirmation`). Expedição remains a blocker in this migration. `op_numeros` unchanged. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D` | **Applied and validated only in staging** (`ucrjtfswnfdlxwtmxnoo`); production untouched. Functionally replaced by `db/36`/`db/37` in the same Controlled Delete phase; renamed to `*_pre53` by `db/53`. |
| `db/36_controlled_delete_fk_order_fix.sql` | Fixes the transactional order of the `db/35` cascade: builds explicit FK targets (`target_ops`, `target_op_itens`, `target_entregas`, `target_op_latex_links`, `target_child_ops`, `target_child_op_itens`), zeroes `entrega_itens` by `op_id` and by `op_item_id` before removing OPs, and fixes the guards `entrega_cima_latex_guard_fn`/`entrega_itens_cima_latex_guard_fn` to return `OLD` on authorized `DELETE` (avoids silent cancellation). Expedição remains a blocker. `op_numeros` unchanged. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E` | **Applied and validated only in staging** (`ucrjtfswnfdlxwtmxnoo`) with a real synthetic test (Pedido #29, OPs 45/46, delivery 21); production untouched. Renamed to `*_pre53` by `db/53`. |
| `db/37_controlled_delete_expedicao_cascade.sql` | Replaces the four `db/36` RPCs (same delivery guards): Expedição stops being an unconditional blocker and becomes part of the `EXCLUIR TUDO` cascade (`expedicao_movimento_itens` → `expedicao_movimentos` → `expedicao_itens` → `expedicoes`, removed before OPs/deliveries/lots/Pedido). `op_numeros` unchanged. See decision `D-DEL14` in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10. | `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2` | **Applied and validated only in staging** (`ucrjtfswnfdlxwtmxnoo`); production untouched. Since `db/53`, renamed to `diagnosticar_impacto_pedido_pre53`/`diagnosticar_impacto_op_pre53`/`remover_pedido_pre53`/`remover_op_pre53` (`EXECUTE` revoked from all roles); logic preserved and called by the documentary guard's public wrappers only when eligible. |
| `db/53_controlled_delete_document_link_guard.sql` | Permanent documentary guard between the controlled test physical deletion (Pedido/OP) and the G28 canonical documentary history (`document_link_revisions`/`document_link_revision_ops`). Renames the four `db/37` legacy functions to `*_pre53` (revokes `EXECUTE` from `PUBLIC`/`anon`/`authenticated`/`service_role`) and recreates the original public signatures as `SECURITY DEFINER` wrappers that diagnose documentary history, block when there is a canonical link, and delegate to `*_pre53` only when eligible. Never deletes/alters `document_link_revisions`/`document_link_revision_ops`/`op_numeros`. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` | **Applied and validated in staging** (`ucrjtfswnfdlxwtmxnoo`), technical commit `707a37bd1d2c4728ab2a17433b6441049bd88062`. `CLOSED / ACCEPTED`. Production untouched. See `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` (decisions `D-DEL10`-`D-DEL13`). |
| `db/54_controlled_delete_document_link_grants.sql` | Staging-only emergency security fix: after `db/53`, the four public RPCs still had `EXECUTE` granted to `PUBLIC`/`anon` from earlier/default grants. Revokes those grants and restricts `EXECUTE` to `authenticated`, without changing the body, `SECURITY DEFINER`, or tables. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GRANTS-54` | **Applied and validated in staging** (`ucrjtfswnfdlxwtmxnoo`), part of the same technical commit `707a37bd...`. `CLOSED / ACCEPTED`. Production untouched. |
| `db/55_controlled_delete_document_link_policy_cast.sql` | Staging-only emergency fix for the already-applied `db/53`: `to_jsonb(<literal>)` without an explicit cast failed with `could not determine polymorphic type`. Forward-only patch (`DO $repair$`) locates and replaces the documentary-policy literal with `to_jsonb(<literal>::TEXT)` in the two already-applied public diagnostic functions. Does not change rules, grants, or cascades. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-POLICY-CAST-55` | **Applied and validated in staging** (`ucrjtfswnfdlxwtmxnoo`), part of the same technical commit `707a37bd...`. `CLOSED / ACCEPTED`. Production untouched. |
| `db/56_controlled_delete_document_link_diagnostics_null_safe.sql` | Staging-only emergency fix for a `db/53` regression: `jsonb_set(...)` is `STRICT`, so the entire return of the public diagnostic functions collapsed to `NULL` whenever the target was not blocked by documentary history (`reason` null). Fixed with `COALESCE(to_jsonb(v_reason), 'null'::jsonb)` in the final `jsonb_set` of each diagnostic function, preserving the JSON schema without changing the guard/ACL/`remover_*`/`*_pre53`. | `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-DIAGNOSTICS-NULL-SAFE-56` | **Applied and validated in staging** (`ucrjtfswnfdlxwtmxnoo`), part of the same technical commit `707a37bd...`. `CLOSED / ACCEPTED`. Production untouched. |
| `db/57_cliente_pedido_summary_acl_grants.sql` | Grants-only, forward-only, idempotent migration for `public.cliente_pedido_summary(UUID)`: `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated`. Does not recreate or alter the function's body, `SECURITY DEFINER`, volatility, `search_path`, owner, signature, or return type. Resolves the ACL divergence recorded in `D-COS06` (`docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`), closing it in `D-COS07`. | `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` | **Applied and verified only in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-15`, via a tracked Supabase MCP migration operation; record `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmed in the catalog. `CLOSED / ACCEPTED`. Final ACL verified live: `PUBLIC` without `EXECUTE`, `anon` without `EXECUTE`, `authenticated` with `EXECUTE`, `service_role` without explicit `EXECUTE` (owner `postgres` retains inherent privilege). Function contract (signature `cliente_pedido_summary(uuid)`, return `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, body) confirmed byte-for-byte unchanged (identical definition hash before/after). Production (`bhgifjrfagkzubpyqpew`) untouched; no push. |
| `db/58_admin_usuarios_senha_temporaria.sql` | Additive, forward-only, idempotent migration (`ADD COLUMN IF NOT EXISTS`) for phase `A4.1` (`docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`): `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` + `usuarios.senha_gerada_em TIMESTAMPTZ NULL`. Basis for the single path decided for A4 (temporary password + forced change on first login, A4.2 still `NOT AUTHORIZED`). | `A4.1` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`, via Supabase MCP; record `20260716014338 / 58_admin_usuarios_senha_temporaria` confirmed in the catalog. `CLOSED / ACCEPTED`. Columns confirmed live with the file's type/nullability/default; the 10 existing users preserved with no retroactive effect (`senha_temporaria=false`, `senha_gerada_em=NULL` for all). Production untouched; no push. |
| `db/59_admin_last_sign_in_readmodel.sql` | RPC `public.admin_usuarios_last_sign_in()` — admin-only read model (`SECURITY DEFINER`, `STABLE`, `search_path=public,auth`), guarded by `is_admin()` (`db/12` pattern) with `RAISE EXCEPTION ... ERRCODE 42501` for a non-admin caller. Returns only `id`+`last_sign_in_at` from `auth.users` for the users visible in `public.usuarios` — does not expose email/password/metadata. Explicit grants: `REVOKE FROM PUBLIC, anon, service_role; GRANT TO authenticated`. Closes the "Last access" column HARD STOP recorded in the `A3.2` closeout. | `CAMADA2-LAST-ACCESS-RPC` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`, via Supabase MCP; record `20260716014358 / 59_admin_last_sign_in_readmodel` confirmed in the catalog. `CLOSED / ACCEPTED`. Empirical role matrix (`BEGIN...ROLLBACK`): `anon` → `42501` at the ACL boundary (before execution); non-admin `authenticated` → business `42501` (RAISE EXCEPTION inside the function); admin `authenticated` → `ok`, minimal DTO confirmed (only `id`+`last_sign_in_at`). UI consumption (the "Last access" column in `js/screens/admin-usuarios.js`) is its own future micro-phase, `NOT AUTHORIZED` by this record. Production untouched; no push. |
| `db/60_usuarios_auditoria_schema.sql` | Append-only audit table `public.usuarios_eventos` (mirrors `op_eventos`, `db/21`) + trigger `trg_usuario_evento` on `public.usuarios` (`AFTER UPDATE`), recording `ativo`/`tipo`/`nivel_acesso`/`senha_temporaria` diffs as `perfil_alterado` events. Admin-only RLS `SELECT`; no client writes (write path is the `SECURITY DEFINER` trigger only). **Canonical audit-trail design (recorded here, binding):** two write paths reach `usuarios_eventos`, mutually exclusive by the `auth.uid()` condition — (1) the trigger records direct-`UPDATE` changes made by an authenticated admin session (`auth.uid() IS NOT NULL`); (2) the five admin Edge Functions (`db/61`-era, `A6.2`) record their own actions explicitly, since they run under `service_role` where `auth.uid() IS NULL` excludes the trigger by design. Both paths populate the identity snapshot columns (`usuario_email`/`usuario_nome`/`usuario_tipo`, added by `db/61`) — the trigger from `NEW`, the Edge Functions explicitly (no automatic path populates them under `service_role`). | `A6.1` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`; record `20260717002523 / 60_usuarios_auditoria_schema` confirmed in the catalog. `CLOSED / ACCEPTED`. Role matrix in `BEGIN...ROLLBACK`: trigger fires once per changed watched field, no-op on same-value updates, no double-recording under a simulated `service_role` context; `anon` → `42501`; non-admin `authenticated` → 0 rows (RLS); admin `authenticated` → reads. Production untouched; no push. |
| `db/61_usuarios_eventos_preserve_on_delete.sql` | Corrective migration over `db/60` (not edited — applied, immutable): `usuarios_eventos.usuario_id` FK changed from `ON DELETE CASCADE` to `ON DELETE SET NULL`; adds identity snapshot columns `usuario_email`/`usuario_nome`/`usuario_tipo`; `trigger_usuario_evento()` updated in place to populate them from `NEW`. Root cause: `admin-delete-user` hard-deletes `public.usuarios`, and the original `CASCADE` would destroy an event in the same statement that deletes its subject — architect ruling rejected both `CASCADE` (destroys the trail) and dropping the FK (loses integrity while the subject lives). | `A6.1-B` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-16`; record `20260717003652 / 61_usuarios_eventos_preserve_on_delete` confirmed in the catalog. `CLOSED / ACCEPTED`. Full `db/60` role matrix re-verified green under the new schema, plus the delete-survival case: a synthetic profile's event survives its own profile's deletion with `usuario_id` NULL and the identity snapshot intact. Production untouched; no push. |
| `db/62_admin_nivel_acesso_schema.sql` | Additive, forward-only, idempotent (`A2.1`): `public.usuarios.nivel_acesso TEXT NOT NULL DEFAULT 'completo'` + named CHECK `usuarios_nivel_acesso_check (nivel_acesso IN ('completo','somente_leitura'))` (two levels only; NO overrides table, ratified). Helper `public.is_admin_full()` (`plpgsql SECURITY DEFINER STABLE search_path=public,auth`, `EXCEPTION -> FALSE`) requires `ativo IS TRUE AND tipo='admin' AND nivel_acesso='completo'` — same shape as `db/12`'s `is_admin()`, NOT consumed by any policy (modal wiring `A2.2` / route enforcement `A2.3` are separate). `usuarios.tipo` and `is_admin()` untouched (`tipo` anchors all RLS). ACL in-migration (revoke PUBLIC/anon, grant authenticated) — corrected for `service_role` by `db/63`. | `A2.1` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-17`; record `20260717093122 / 62_admin_nivel_acesso_schema`. `CLOSED / ACCEPTED`. All 10 existing users defaulted `completo` (no silent privilege change); role matrix green incl. the regression `is_admin()` stays true for a `somente_leitura` admin; `db/60` trigger records the `nivel_acesso` change (`perfil_alterado`, correct payload); CHECK rejects invalid values. Production untouched; no push. |
| `db/63_is_admin_full_grants.sql` | Grants-only, forward-only, idempotent ACL correction over `db/62` (`A2.1-B`, precedent `db/57`). Root cause: `db/62` left `service_role` with `EXECUTE` via Supabase default function privileges, diverging from the db/54/57 authenticated-only standard on that row (harmless — `service_role` is server-only, bypasses RLS, `is_admin_full()` returns FALSE under it). States the COMPLETE intended ACL: `REVOKE ALL FROM PUBLIC, anon, service_role; GRANT EXECUTE TO authenticated`. Encountered as the architect-named hard stop ("ACL diverging"); ruled Option 3 (forward-only new migration). | `A2.1-B` | **Applied and verified in staging** (`ucrjtfswnfdlxwtmxnoo`), `2026-07-17`; record `20260717101401 / 63_is_admin_full_grants`. `CLOSED / ACCEPTED`. Final catalog ACL `[postgres, authenticated]` only; `has_function_privilege` → authenticated `true`, anon/service_role `false`; runtime `service_role` call → `42501` (helper unreachable); authenticated admin path unchanged. Production untouched; no push. |

### Static smoke tests for versioned schema

| File | Purpose | Phase |
|---|---|---|
| `tests/cliente-tracking-schema.smoke.js` | Static validation of `db/15_status_cliente_visual.sql`: new columns, visual taxonomy, exceptions, `pedido_cliente_eventos`, admin-only RLS, INSERT guard trigger, UPDATE touch trigger, and absence of destructive commands/secrets. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` |
| `tests/cliente-events-rls-schema.smoke.js` | Static validation of `db/16_pedido_cliente_eventos_cliente_select.sql`: file existence, policy `pedido_cliente_eventos_cliente_select`, `FOR SELECT`, filter `visivel_cliente = true`, ownership via `public.pedidos` + `public.meu_cliente_id()`, absence of client writes, and absence of improper scope. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-EVENTS-RLS-A` |
| `tests/cliente-tracking-steps.smoke.js` | Static and sandboxed validation of `js/pedido-tracking-ui.js`: global namespace, 8 main steps, 4 exceptions, pure helpers, fallback to `recebido`, absence of forbidden internal terms, and absence of query/write. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `tests/admin-pedido-tracking-control.smoke.js` | Static validation of the admin control for publishing visual tracking: new module `js/screens/pedido-tracking-admin.js`, integration with `pedido-detail.js`, use of the shared taxonomy, writes to `pedidos.status_cliente_*` and `pedido_cliente_eventos`, separation from operational status, and absence of functional changes in the client/supplier screens. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `tests/pedido-parciais-admin-control.smoke.js` | Static validation of the manual admin control for partials: new module `js/screens/pedido-parciais-admin.js`, integration with `pedido-detail.js`, explicit SELECT and controlled insert into `pedido_parciais`, reuse of the shared catalog `CLIENTE_PARCIAL_SITUACOES`, absence of mandatory use of `pedido_parcial_itens`, and absence of functional changes in the client screens. | `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A` |
| `tests/cliente-dashboard.smoke.js` | Static validation of the read-only Client Dashboard: existence of the module `js/screens/cliente-dashboard.js`, route `#/cliente/dashboard` (client role), "Início" menu, explicit SELECT on pedidos restricted to allowed fields, `pedido_cliente_eventos` with only safe columns, absence of `metadata`/`criado_por`/`origem`/`pedido_eventos`, use of the `window.RavatexPedidoTracking` taxonomy, rendering of KPIs/recent pedidos/updates, and absence of writes/`service_role`/internal data. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |
| `tests/cliente-pedido-summary-readmodel.smoke.js` | Static validation of the public RPC `cliente_pedido_summary(UUID)`: permission for admin or the owning client, `SECURITY DEFINER`, `search_path`, grant only to `authenticated`, public DTO, absence of forbidden internal keys, partials/timeline only with `visivel_cliente IS TRUE`, and absence of destructive writes. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` |

### Frontend modules for visual tracking

| File | Role | Phase |
|---|---|---|
| `js/pedido-tracking-ui.js` | Shared layer of visual taxonomy and pure helpers for status, message, and progress of client tracking. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A` |
| `js/screens/pedido-tracking-admin.js` | Admin card to publish the status visible to the client, with preview and auditable writes to `pedidos.status_cliente_*` and `pedido_cliente_eventos`. | `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A` |
| `js/screens/pedido-parciais-admin.js` | Admin card to list and manually register Pedido partials in `pedido_parciais`, reusing the shared catalog `CLIENTE_PARCIAL_SITUACOES` and a simple technical preview via `buildPedidoAcompanhamentoParcial`, with no client read and without activating `pedido_parcial_itens`. | `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A` |
| `js/screens/cliente-dashboard.js` | Read-only Client Dashboard (`#/cliente/dashboard`, `screenClienteDashboard`): the B2B portal's home page. Locally derived cards/KPIs, recent pedidos, and latest updates. Explicit SELECT on `pedidos` (safe fields) and `pedido_cliente_eventos` (`id, pedido_id, status, titulo, mensagem, criado_em`). No writes, no `metadata`/`criado_por`/`origem`, no `pedido_eventos`, no exposure of `OP`/`lote`/`fornecedor`/`NF`/`romaneio`/`custo`/`margem`. | `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A` |
| `js/screens/cliente-pedido-detail.js` | Pedido detail view in the Client Portal. As of `CLIENTE-ORDER-SUMMARY-READMODEL-A-B`, consumes only `supa.rpc('cliente_pedido_summary')` and does not directly query internal operational tables such as `ops`, `lotes`, `op_itens`, `entregas`, `expedicoes`, or `ordens_compra_fio`. | `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B` |

> The design justifying the schema migration is in
> `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (phase
> `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`). The migration
> `db/12_auth_user_disable_schema.sql` was applied in staging
> (`ucrjtfswnfdlxwtmxnoo`) on `2026-06-24` — see phases
> `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (guidance,
> commit `8fa924a`) and `...-SCHEMA-APPLY-EVIDENCE-A` (record of
> the actual application, commit `1a35e1d`) in the LEDGER. The Edge
> Function `admin-disable-user` was created locally in the repo in
> phase `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`, commit `eb5d2e0`
> (see `supabase/functions/admin-disable-user/README.md`);
> deployed to staging `ucrjtfswnfdlxwtmxnoo` (phase
> `...-EDGE-STAGING-DEPLOY-A`, see LEDGER). An **automated local
> runner** for E2E was created at
> `scripts/staging/admin-disable-user-e2e.mjs` (phase
> `...-E2E-AUTO-RUNNER-A`) and the handling of the expected blocked
> login was fixed in `...-E2E-RUNNER-FIX-A`. **Real E2E in staging
> already passed with `result: PASS`** (see LEDGER §5k for
> sanitized evidence of the disposable
> `disable-edge-e2e-20260624-115027@tapetes.test`,
> user_id `d12b005e-d455-4f78-b401-59ebd9f971c5`,
> deactivated in staging, blocked login confirmed). The
> **`#/cadastros/usuarios` screen was integrated** with
> `admin-disable-user` in phase `...-UI-A` (the `Desativar`
> button replaces the `Em breve` placeholder; calls
> `window.supa.functions.invoke('admin-disable-user', { body:
> { user_id, reason } })`; modal with optional reason; maps
> `FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/`LAST_ADMIN_FORBIDDEN`/
> `NOT_FOUND`/`AUTH_BAN_FAILED`/`COMPENSATION_FAILED`/
> `VALIDATION_ERROR`/`UNAUTHORIZED` to PT-BR messages;
> UX guard for self/inactive). **Manual validation of the
> deactivation UI in staging recorded** in phase
> `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
> (HMNlead, app/staging `ucrjtfswnfdlxwtmxnoo`): screen
> `#/cadastros/usuarios`, `Desativar` button, guard for an
> already-inactive user, creation of a disposable active
> supplier, and deactivation via the UI — the real flow passed.
> Details in `PROJECT_STATE.md`. **Production `bhgifjrfagkzubpyqpew`
> and `origin/main` untouched.** Next step: release decision
> for `origin/main`/production, only with explicit
> authorization from HMNlead (in a separate phase).

> **A4.1 + `CAMADA2-LAST-ACCESS-RPC` (`2026-07-16`):** the Edge
> Function `admin-create-user` was extended — password policy
> 6→8 characters + requirement of ≥1 digit (`PASSWORD_MIN_LENGTH`,
> `PASSWORD_DIGIT_RE`), and the insert into `public.usuarios` now
> sets `senha_temporaria: true` / `senha_gerada_em: now()` (see
> `supabase/functions/admin-create-user/README.md`). **Deploy to
> staging (`ucrjtfswnfdlxwtmxnoo`) executed by the architect.** An
> **automated local E2E runner**, same skeleton and same security
> guarantees as `admin-disable-user-e2e.mjs` (login with a real
> password performed by a human, never by the AI agent; secret
> sanitization; staging-only guard; gitignored local config), was
> created at `scripts/staging/admin-create-user-password-policy-e2e.mjs`.
> **Real E2E in staging passed with `result: PASS` (9/9 steps)**,
> covering: 7-character password rejected (length message), 8-character
> password without a digit rejected (digit message), valid password
> accepted with `senha_temporaria=true` and `senha_gerada_em` filled
> confirmed via REST, cleanup via `admin-delete-user` (existing flow)
> with zero-cleanup verified. Consumption of the "Last access" column
> in the UI (`js/screens/admin-usuarios.js`, via `db/59`) and `A4.2`
> (boot guard + mandatory-change screen) remain `NOT AUTHORIZED`,
> candidates for `ARCHITECT DECISION`. Production `bhgifjrfagkzubpyqpew`
> not accessed; no push.
>
> **Update (`2026-07-16`, superseded above):** consumption of the
> "Last access" column was implemented and closed (`CAMADA2-LAST-ACCESS-UI`
> — `CLOSED / ACCEPTED`, technical commit `0aff22f` — `Add last
> sign-in column to user admin`; architect visual validation
> confirmed in preview: column populated with real data, correct
> format, `"—"` for never-logged-in users, sorting with nulls last).
> **`A4.2` (mandatory password-change guard) — `CLOSED / ACCEPTED`
> (2026-07-16).** `js/auth.js` gained `senha_temporaria`/`senha_gerada_em`
> in the `select` of `loadCurrentUser()` (the only change, explicit
> architect decision — Option A of a hard stop raised in session);
> `js/boot.js` gained the guard (`isSenhaTemporariaExpirada` +
> `guardedHandleRoute`, without touching `js/router.js`);
> `js/trocar-senha-writes.js` (new) does the self-service
> `auth.updateUser({password})` + `UPDATE usuarios SET
> senha_temporaria=false`; `js/screens/trocar-senha-obrigatoria.js`
> (new) is the screen (shell-less card, live checklist, `expired`
> mode after 7 days). An **automated local E2E runner**, same
> skeleton and same security guarantees as the previous runners
> (login with a real password only by a human, never by the AI
> agent; synthetic password generated by the script itself; secret
> sanitization; staging-only guard; gitignored local config), was
> created at `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` —
> **not run in this phase**; the evidence used for the closeout was
> the **architect's manual validation in staging**: synthetic user
> created, gate displayed, checklist reacted, change made,
> `senha_temporaria` cleared, second login entered directly without
> the gate, user removed. Debt recorded (candidate for
> `CODE-HEALTH-AUDIT-§18-R1`, not fixed in this phase): 6 pre-existing
> tests in `tests/auth.smoke.js` with an outdated regex regarding the
> cache-busting `?v=` on `<script src="js/auth.js">`. `A4.3` (email
> invitation) remains `NOT AUTHORIZED`. Production `bhgifjrfagkzubpyqpew`
> not accessed; no push.
>
> **`A5.1-A5.2` (`2026-07-16`) — `CLOSED / ACCEPTED`:** new Edge
> Function `admin-reset-user-password` (mirror of `admin-disable-user`)
> — `auth.admin.updateUserById(target, {password})` with a temporary
> password generated via `crypto.getRandomValues` (never `Math.random`,
> never a fixed value), self-reset **blocked** (`SELF_RESET_FORBIDDEN`,
> architect decision), sets `senha_temporaria=true`/`senha_gerada_em=now()`,
> password returned only once, never logged (see
> `supabase/functions/admin-reset-user-password/README.md`). UI: key-icon
> button in `js/screens/admin-usuarios.js` →
> `confirmDialog` → "Password generated" modal (password/copy/one-time
> display warning) in `js/screens/admin-usuarios-modal.js`. **Deploy to
> staging (`ucrjtfswnfdlxwtmxnoo`) executed by the architect.** An
> **automated local E2E runner**, 4th of the same pattern as the
> previous ones (`admin-disable-user-e2e.mjs`,
> `admin-create-user-password-policy-e2e.mjs`,
> `trocar-senha-obrigatoria-e2e.mjs` — login with a real password only
> by a human, never by the AI agent; synthetic passwords generated by
> the script itself/by the Edge Function; secret sanitization;
> staging-only guard; gitignored local config), was created at
> `scripts/staging/admin-reset-password-e2e.mjs`. **Real E2E in
> staging passed with `result: PASS` (15/15 steps)**, covering:
> `SELF_RESET_FORBIDDEN`/`NOT_FOUND` guards live, real reset with
> flag+timestamp updated, old password invalidated, login with the new
> temporary password, `A4.2` self-service chained (new change + flag
> cleared), re-login without the gate ("next login goes straight in"),
> zero cleanup. Architect visual validation **waived by explicit
> decision**, covered by the combination of e2e + real-browser flow
> verification by the executor. Findings recorded as `NOT AUTHORIZED`
> candidates: `UI-EL-BOOLEAN-ATTR-FIX` (potential boolean `setAttribute`
> bug in `js/ui.js`'s `el()`, severity **not confirmed** — pending
> architect verification on the Desativar/Excluir buttons of
> `admin-usuarios.js`) and decomposition of `admin-usuarios-modal.js`
> (576 lines, candidate for `CODE-HEALTH-AUDIT-§18-R1`). `A5.3-A5.4`
> (reactivation) remains `NOT AUTHORIZED`, its own future authorization.
> Production `bhgifjrfagkzubpyqpew` not accessed; no push.
>
> **`A5.3-A5.4` (`2026-07-16`) — `CLOSED / ACCEPTED`:** new Edge
> Function `admin-reactivate-user` (symmetric counterpart of
> `admin-disable-user`) — `ativo=true`, clears `desativado_em`/
> `desativado_por`/`motivo_desativacao`,
> `auth.admin.updateUserById(target, {ban_duration:'none'})`; guards the
> target exists (`NOT_FOUND`) and is inactive (`REACTIVATE_NOT_INACTIVE`
> otherwise — deliberately not idempotent, unlike `admin-disable-user`'s
> `already_disabled`); compensates to the *exact* prior inactive state
> (preserved before the update, not re-stamped) if the unban call fails
> (see `supabase/functions/admin-reactivate-user/README.md`). UI:
> inactive rows in `js/screens/admin-usuarios.js` swap the ban icon for
> a refresh icon → `confirmDialog` (non-destructive) →
> `reativarUsuario(userId)`. **Deploy to staging
> (`ucrjtfswnfdlxwtmxnoo`) executed by the architect.** An **automated
> local E2E runner**, 5th of the same pattern as the previous ones
> (`admin-disable-user-e2e.mjs`,
> `admin-create-user-password-policy-e2e.mjs`,
> `trocar-senha-obrigatoria-e2e.mjs`, `admin-reset-password-e2e.mjs` —
> login with a real password only by a human, never by the AI agent;
> secret sanitization; staging-only guard; gitignored local config),
> was created at `scripts/staging/admin-reactivate-e2e.mjs`. **Real E2E
> in staging passed with `result: PASS` (13/13 steps)**, covering:
> disable→login-blocked→reactivate→flags-cleared→login-restored chain,
> plus the `REACTIVATE_NOT_INACTIVE` guard on the now-active target and
> zero-cleanup verification. Architect visual validation confirmed the
> Desativar button works on an active user. **Finding —
> `UI-EL-BOOLEAN-ATTR-FIX` severity updated from `NOT CONFIRMED` to
> `CONFIRMED — ACTIVE REGRESSION`:** the architect reproduced the
> boolean-`setAttribute` bug live via the "Mostrar inativos" checkbox
> in `admin-usuarios.js` (always renders checked regardless of the
> actual toggle state, same root cause as the `expedicao-admin.js`
> residue); the Excluir button in the same file carries the identical
> vulnerable pattern and is unconfirmed but suspect; not fixed in this
> phase, recorded as the priority `ARCHITECT DECISION` candidate. The
> `A5` track (reset + reactivation) is now `COMPLETE`. Production
> `bhgifjrfagkzubpyqpew` not accessed; no push.
>
> **`A6.1`/`A6.1-B`/`A6.2` — user audit trail (`db/60`, `db/61`,
> `CLOSED / ACCEPTED`):** append-only `public.usuarios_eventos` +
> trigger `trg_usuario_evento` (see `db/60`/`db/61` rows above for
> the canonical two-write-paths design and the delete-survival fix).
> `A6.2` wires the five admin Edge Functions
> (`admin-create-user`/`admin-disable-user`/`admin-reactivate-user`/
> `admin-reset-user-password`/`admin-delete-user`) with an explicit
> `usuarios_eventos` insert each (`tipo_evento`:
> `usuario_criado`/`usuario_desativado`/`usuario_reativado`/
> `senha_resetada`/`usuario_excluido`), `ator_id` from the caller's
> validated JWT (never `auth.uid()`, `NULL` under `service_role`),
> identity snapshot populated explicitly on every insert. Payloads
> never carry passwords or tokens (`admin-reset-user-password`'s
> payload is an empty object by design). For
> create/disable/reactivate/reset-password the insert is the last
> step, only on the fully-committed success path. `admin-delete-user`
> is the one exception, by architect ruling: its insert precedes the
> `public.usuarios` delete (the `db/61` FK is only satisfiable while
> the row still exists), so `ON DELETE SET NULL` lets the event
> survive; if the delete subsequently fails or is compensated, the
> event remains as a recorded but not literally accurate "attempted"
> entry — an accepted trade-off, no compensation invented for the
> audit table itself. An **automated local E2E runner**, 6th of the
> same pattern as the five before it (`admin-disable-user-e2e.mjs`,
> `admin-create-user-password-policy-e2e.mjs`,
> `trocar-senha-obrigatoria-e2e.mjs`, `admin-reset-password-e2e.mjs`,
> `admin-reactivate-e2e.mjs`), was created at
> `scripts/staging/usuarios-audit-e2e.mjs`. **Real E2E in staging
> passed with `result: PASS` (15/15 steps)**, `2026-07-17`, synthetic
> user `c0d5da9c-471c-459f-b0c4-02110fa81709`: one event per action
> across all five functions, no double-entry, password absent from
> the `senha_resetada` payload, and 5/5 accumulated events surviving
> the profile deletion with `usuario_id` NULL and identity snapshot
> intact. Five functions deployed to staging
> (`ucrjtfswnfdlxwtmxnoo`) by the architect. Production
> `bhgifjrfagkzubpyqpew` not accessed; no push.
## 4. Legacy docs (DOES NOT GUIDE EXECUTION (NÃO GUIAM EXECUÇÃO))

Preserved for historical context. Each folder or file carries its own
banner. If used, **adapt to the current architecture** and confirm
against canonical sources.

### `docs/superpowers/`

Content from project phases 1-7. Includes `STATUS.md`, `specs/` and
`plans/`.

| Type | Classification | Note |
|---|---|---|
| `STATUS.md` | Historical | Phases 1-6 listed; assumes pre-refactor architecture. |
| `specs/*.md` (9 files) | Obsolete | Designs written for the monolithic `index.html`. The architecture has since been modularized. |
| `plans/*.md` (9 files) | **DANGEROUS FOR AI (PERIGOSO PARA IA)** | Instructs modifying `index.html` directly, with inline Supabase writes and `git add .`. **Do not follow literally.** |

> Before using any spec/plan here as a functional requirement,
> adapt it to the current modular architecture
> (`js/boot.js`, `js/router.js`, `js/ui.js`, `js/screens/*`,
> `js/calculo-op.js`).
> See `docs/superpowers/README.md` for details.

### `docs/qa/`

QA checklists and scripts from phases 1-6 + Phase 6 script.

| Type | Classification | Note |
|---|---|---|
| `fase1-checklist.md`, `fase2-checklist.md` | Historical + anonymized credentials | Could contain test passwords; anonymized in `RAVATEX-TAPETES-DOCS-SANITIZE-A`. |
| Remaining checklists (`fase3`-`fase6`, `fase5a`, `fase5b`) | Historical | Useful as a QA record, not as a technical specification. |
| `roteiro-teste-fase6.md` | Historical | Manual script for Vinícius. |
| `fase2-bugs-pendentes.md` | Historical | Pending bug from Phase 2. Needs current verification before any action. |

> See `docs/qa/README.md` for details.

### `docs/` root (old docs)

| File | Classification | Note |
|---|---|---|
| `DEPLOYMENT.md` | Partially obsolete | Written before the staging/origin split. Today there is staging; `origin/main` is protected. See banner at top. |
| `AI_AGENT_RULES.md` | Partially legacy | Some rules remain useful, but the D1/D1A/D2 context is not the current phase. See banner at top. |
| `BACKUP_AND_RESTORE.md` | Partially current | Runbook is correct, but backup status may be outdated. See note at top. |
| `HANDOFF.md` | Historical/partially legacy | Mixes old architecture with post-staging practices. See banner at top. |
| `STAGING_BASELINE.md` | **Current** | Well-detailed staging checkpoint. Refs and environment rule still apply. |

## 5. Critical warnings

### Plans in `docs/superpowers/plans/`

The plans describe direct modifications to `index.html`, inline
Supabase writes, `git add .`, and a workflow without staging.
**Following them literally would reintroduce the pre-refactor
monolith**, violating `docs/architecture/CODE_HEALTH_RULES.md` §2
and §6.

> Treat the plans as a **historical record of intent** from the old
> phases, not as an executable playbook.

### Old credentials in `docs/qa/`

`docs/qa/fase1-checklist.md` and `docs/qa/fase2-checklist.md`
contained test passwords (e.g. `Admin123!`, `Fornec123!`). They
were **anonymized** in `RAVATEX-TAPETES-DOCS-SANITIZE-A`, replaced
with `[REDACTED_TEST_PASSWORD]`. Do not trust any credential found
in legacy docs; rotate if necessary.

### `docs/DEPLOYMENT.md` and `docs/AI_AGENT_RULES.md`

Both docs were written in a context prior to the `staging`/`origin`
split and modularization. Today there is:

- remote `staging` (`controle-tapetes-staging`), the default push
  destination on `work/app-next`;
- remote `origin` (`grupoterrabranca/controle-tapes`), which is
  production and has been **untouched** since the refactor phase;
- Supabase staging ref `ucrjtfswnfdlxwtmxnoo`;
- Supabase production ref `bhgifjrfagkzubpyqpew`.

The current rule is in `AGENT_HANDOFF.md` (rules 1, 2, 3, 15) and in
`docs/architecture/CODE_HEALTH_RULES.md` §15.

## 6. Policy for updating this index

- Update this index when there is a change to the authority list
  in §1, a new classificatory document (enters the §1 inventory), a
  new runbook (enters §3), or a new category of legacy docs (enters
  §4).
- §1 is the only active documentary-authority list; no other
  section of this index and no other file should keep a competing
  list of "canonical sources", "prevalence", or "precedence".
- Phase: docs-only. No functional change.
- Updating the index is governed by the **update matrix by phase**
  in `docs/governance/DOCUMENTATION_MODEL.md` §11 and by the
  **minimum documentary transaction** §12 of the same model.
  Changes to authority, classification, or paths require a review
  of this index; cosmetic changes should be avoided.
- The competing lists that existed in the former §2 "Prevalence
  rule" of this index, in
  `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md`, and in
  `Guide-and-governance-rules.stxt` were reconciled in
  `G28-DOCS-B3-E1`: they now point to §1. The history of this
  reconciliation is in `docs/ledgers/G28_LEDGER.md`.

## 7. Documentation language migration (DOC-LANGUAGE-MIGRATION) and pt-BR archive

The `DOC-LANGUAGE-MIGRATION` track progressively translates the
canonical documentation into English, in batches authorized by their
own order. Each translated file has its pt-BR original **moved**, in
the same commit, to `docs/archive/pt-BR/<original-path>`
(byte-for-byte preservation; not operational, historical reference
only). File names, anchors, paths and cross-references remain
**unchanged** — only the content is translated. The canonical status
vocabulary (`CLOSED`, `ACCEPTED`, `NOT AUTHORIZED`, `DEFERRED`,
`PROPOSED`, `HARD STOP`, `READ-ONLY` etc.) remains verbatim. Starting
with `DOC-LANGUAGE-MIGRATION-L2`, architect decisions and blocks
previously kept in Portuguese in the canonical homes also start being
translated into English, marked with a provenance note
(`translated from the architect's original Portuguese; original in
docs/archive/pt-BR/`); the original pt-BR wording preserved in the
file remains authoritative in any dispute over nuance. Ledgers and
`docs/handoffs/` are **not** translated.

The current language policy is recorded in the canonical homes:
`docs/governance/DOCUMENTATION_MODEL.md` (§18, "Language policy"),
`docs/architecture/CODE_HEALTH_RULES.md` (§19, "Rule for language") and
`docs/governance/SUPERVISION_PROTOCOL.md` (§3, language line in the
order format). `CLAUDE.md` keeps a pointer summary pointing to these
homes.

### Batch `DOC-LANGUAGE-MIGRATION-L1`

| Canonical path (now in English) | Archived pt-BR original |
|---|---|
| `docs/architecture/CODE_HEALTH_RULES.md` | `docs/archive/pt-BR/docs/architecture/CODE_HEALTH_RULES.md` |
| `docs/governance/SUPERVISION_PROTOCOL.md` | `docs/archive/pt-BR/docs/governance/SUPERVISION_PROTOCOL.md` |
| `docs/governance/DOCUMENTATION_MODEL.md` | `docs/archive/pt-BR/docs/governance/DOCUMENTATION_MODEL.md` |
| `CLAUDE.md` | `docs/archive/pt-BR/CLAUDE.md` |

### Batch `DOC-LANGUAGE-MIGRATION-L2`

| Canonical path (now in English) | Archived pt-BR original |
|---|---|
| `PROJECT_STATE.md` | `docs/archive/pt-BR/PROJECT_STATE.md` |
| `AGENT_HANDOFF.md` | `docs/archive/pt-BR/AGENT_HANDOFF.md` |

In `L2`, besides the translation, the language policy was adjusted:
architect orders can be issued in Portuguese, but once recorded in the
canonical documents they are written in English, with the original
wording preserved in the ledger or archive file.
`docs/governance/DOCUMENTATION_MODEL.md` §18, `CLAUDE.md` and the
language line of `docs/governance/SUPERVISION_PROTOCOL.md` §3 were
updated in the same commit; the supervision handoff appendix block
(template, not a signed decision) was translated into English, with
the pt-BR original preserved in the `L1` file.

### Batch `DOC-LANGUAGE-MIGRATION-L3`

| Canonical path (now in English) | Archived pt-BR original |
|---|---|
| `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` | `docs/archive/pt-BR/docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` |
| `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` | `docs/archive/pt-BR/docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` |
| `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` | `docs/archive/pt-BR/docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` |
| `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` | `docs/archive/pt-BR/docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` |
| `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` | `docs/archive/pt-BR/docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` |
| `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` | `docs/archive/pt-BR/docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` |
| `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` | `docs/archive/pt-BR/docs/design/CAMADA2_A32_MOCKUP_APPROVED.md` |
| `docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` | `docs/archive/pt-BR/docs/operations/AUTH_DISABLE_USER_PROD_RELEASE_PLAN.md` |
| `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` | `docs/archive/pt-BR/docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` |
| `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md` | `docs/archive/pt-BR/docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md` |
| `docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` | `docs/archive/pt-BR/docs/architecture/CLAUDE_PROJECT_ASSET_MAP.md` |
| `docs/architecture/AUTH_DELETE_USER_DESIGN.md` | `docs/archive/pt-BR/docs/architecture/AUTH_DELETE_USER_DESIGN.md` |
| `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` | `docs/archive/pt-BR/docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` |
| `docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` | `docs/archive/pt-BR/docs/architecture/DOCUMENTS_INGESTOR_CONSUMER_DESIGN.md` |
| `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` | `docs/archive/pt-BR/docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` |
| `docs/architecture/UI_VISUAL_CONTRACT.md` | `docs/archive/pt-BR/docs/architecture/UI_VISUAL_CONTRACT.md` |
| `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` | `docs/archive/pt-BR/docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` |
| `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` | `docs/archive/pt-BR/docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md` |
| `docs/DOCUMENTATION_INDEX.md` (this file) | `docs/archive/pt-BR/docs/DOCUMENTATION_INDEX.md` |

In `L3`, the remaining active specs, plans, contracts, reports, and
runbooks were translated (19 files) — the last lot of documents still
in Portuguese, closing the `DOC-LANGUAGE-MIGRATION` track for
currently-scoped canonical documents. Explicitly excluded from L3, by
architect ruling, as historical/quarantined and left in Portuguese:
`docs/qa/*`, `docs/superpowers/*`, the root `docs/*.md` legacy files
listed in §4 (`DEPLOYMENT.md`, `AI_AGENT_RULES.md`,
`BACKUP_AND_RESTORE.md`, `HANDOFF.md`, `STAGING_BASELINE.md`), and the
byte-immutable `docs/legacy/pre-model/` snapshots. Ledgers and
`docs/handoffs/` remain untranslated per standing policy. Phase IDs
and their embedded terms (e.g. `Camada N`) are never translated, per
`docs/governance/DOCUMENTATION_MODEL.md` §18.

The files under `docs/archive/pt-BR/` are immutable preservation (not
operational); in case of divergence, the canonical English file
prevails.
