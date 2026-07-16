# Persistent Plan — Pedido ↔ OP ↔ Movement ↔ Documentos

> **Phase:** `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A` (docs-only)
> **Type:** Docs/architecture/state, no functional patch.
> **Base HEAD:** `3e8e78f` — `work/app-next`
> **Date:** 2026-07-01

---

## Update 2026-07-06 - OP Create Requires Pedido Guard B

Phase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B` updates the Pedido
-> OP front without changing the schema: creating a new OP now requires a
linked Pedido in the UI and in JS persistence.

New decisions:

| # | Decision | Rationale |
|---|---|---|
| D-GUARD01 | Standalone OP is no longer a product path via the Admin UI. | The production chain and the operational display depend on a reliable Pedido. |
| D-GUARD02 | `persistirOP` must refuse a missing `pedidoId` before consuming numbering or writing to `ops`/`lotes`. | Avoids creating new orphans and avoids improper consumption of `op_numeros`. |
| D-GUARD03 | Historical data without a Pedido is treated as legacy/alert, not fixed in this phase. | There was no authorization for SQL write/backfill. |
| D-GUARD04 | Backend guard in Latex/split RPCs is left as the next P1 phase. | Frontend does not replace a transactional lock. |

Read-only staging evidence: `scripts/staging/ops-without-pedido-diag.mjs`
returned an ALERT with 11 OPs whose batch has no Pedido and 9 batches without
a Pedido linked to OPs; no real data was changed.

Recommended next step for this front: `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C`
to block, in the backend, the generation of a child OP when the origin does
not have `lotes.pedido_id`.

## Update 2026-07-06 - OP Create Requires Pedido RPC Guard C

Phase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C` prepares the
backend guard to prevent Weaving -> Finishing/Latex movement from
propagating an orphan OP.

New decisions:

| # | Decision | Rationale |
|---|---|---|
| D-GUARD05 | Latex/split RPCs must block a source OP without `lotes.pedido_id`. | The backend needs to protect transactional paths that do not go through the visual lock. |
| D-GUARD06 | The guard runs before reserving a number in `op_numeros`. | An invalid origin must not consume operational numbering. |
| D-GUARD07 | Orphan historical data remains only diagnosed. | The relationship with Pedido may require a product decision; no backfill in this phase. |
| D-GUARD08 | Global constraint is left for a later phase. | It is first necessary to triage the 11 historical OPs and validate the impact. |

Artifacts: `db/33_op_latex_requires_pedido_guard.sql` and the expanded
diagnostic `scripts/staging/ops-without-pedido-diag.mjs`. Staging
classification of the 11 orphan OPs: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id`
5,6,7,8), C=0, D=1 (`op_id` 10). Application in staging pending; production
untouched.

## 1. Entry state

| Item | Value |
|---|---|
| **Branch** | `work/app-next` |
| **Base HEAD** | `3e8e78f` |
| **Previous phase closed** | `RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A-R1` |
| **Previous commit** | `3e8e78f` — "Record admin novo pedido visual alignment" |
| **Known residual** | `M js/screens/pedidos-list.js` — pre-existing dirty diff of the Admin `#/pedidos` list, out of scope |
| **Allowed residual** | `?? supabase/.temp/` — allowed residual, external origin |

The **Admin → Novo Pedido** phase was closed and approved: the visual core of `#/pedidos/novo` is aligned with the homologated Cliente → Novo Pedido base, without turning the flow into a Cliente-exclusive flow. Admin behavior preserved: Cliente selection, initial status `rascunho`, real payload `pedidos` + `pedido_itens`, validations, compensation, toast, and navigation.

Before touching schema, RPC, screens, OPs, pedidos, movement, documentos, or external integrations, this plan records the target architecture and the decisions that will guide the entire evolution of this front.

---

## 2. Architectural decisions already made

These decisions were consolidated during the business model analysis and homologated for this front. Any future implementation must respect them. If a revision is needed, the plan must be updated beforehand.

### 2.1. Domain hierarchy

1. **Pedido is the commercial origin.** The Cliente requests; the admin receives, confirms, and converts it into production.
2. **OP is production execution.** Each OP represents a manufacturing stage (weaving, latex/finishing).
3. **Production movement belongs to the OP.** Production entries (inflows, outflows, partial deliveries) are made inside the OP screen.
4. **Pedido consolidates production** and may have a preview/shortcuts for quick viewing.
5. **Cliente sees simplified progress** — never internal operational data (OP, batch, Fornecedor, NF, delivery note, cost, margin).

### 2.2. OP structure

6. **OPs can exist per stage.** Examples: weaving OP, latex/finishing OP.
7. **OPs per stage must be chained.** The completion of one stage feeds the next.
8. **The chain of OPs must be tied to the Pedido.** Every batch linked to the pedido (`lotes.pedido_id`) allows tracing OPs → pedido.
9. **The Pedido must display its linked OPs.** The Pedido Admin detail screen must list the associated OPs.

### 2.3. Stepper / production preview

10. **Pedido can have a stepper/preview** with stages: `INSUMOS > TECELAGEM > ACABAMENTO > EXPEDIÇÃO > ENTREGA`.
11. **Shortcut buttons in the Pedido must call the same canonical operation as the OP.** E.g.: "Lançar produção" in the Pedido invokes the same function/RPC for movement as the OP screen.
12. **There can be no double entry.** Entering data in the OP and re-entering it manually in the Pedido is forbidden. The source of truth for production movement is the OP.

### 2.4. Partials

13. **`pedido_parciais` is a commercial/Cliente layer**, not a production source.
14. Partials serve to inform the Cliente about progress (e.g., "Tecelagem: 300m de 500m concluídos"). They do not replace or duplicate the OP's real movement.

### 2.5. Documentos

15. **Fiscal documentos/delivery notes must be linkable** to movements, OPs, and to the Pedido.
16. **Heavy files must stay outside the database**, preferably Google Drive or OneDrive.
17. **The database must store metadata and external pointers** (URL, name, type, size, hash, upload date).
18. **A document attachment starts as a non-blocking pendency.** Production movement must not be locked by the absence of a document.
19. **In the future, emails received at `eddiravazio@gmail.com`** may feed automated reading/classification of PDF/XML/delivery notes, with initial human review.

---

## 3. Target model

```
Pedido
  ├── pedido_itens           (itens solicitados pelo cliente)
  ├── lote/pedido_id         (lotes vinculados ao pedido)
  ├── ops                    (OPs vinculadas via lote)
  │     └── op_itens/pedido_item_id    (rastreabilidade item↔OP)
  ├── entregas/movimentos    (movimentações produtivas das OPs)
  ├── documentos_operacionais (metadados de arquivos fiscais/romaneios)
  ├── resumo do pedido       (visão consolidada admin)
  └── evolução cliente       (visão simplificada, read-only)
```

### 3.1. Key links to establish

| Link | Source | Target | Current status |
|---|---|---|---|
| Batch → Pedido | `lotes.pedido_id` | `pedidos.id` | Column exists (nullable), population pending |
| OP Item → Pedido Item | `op_itens.pedido_item_id` | `pedido_itens.id` | To evaluate/create if necessary |
| Documento → Movement | `documentos_operacionais.movimento_id` | movements table | To create |
| Documento → OP | `documentos_operacionais.op_id` | `ops.id` | To create |
| Documento → Pedido | `documentos_operacionais.pedido_id` | `pedidos.id` | To create |

---

## 4. Role of the screens

### 4.1. OP screen
- **Operational workbench** for production movement.
- Real production is entered here: inflows, outflows, partial deliveries.
- It is the **source of truth** for movement. No other screen duplicates this function.

### 4.2. Pedido Admin screen
- **Consolidated view** of the pedido.
- Lists linked OPs with status and progress.
- **Preview/stepper** with shortcuts to canonical operations (which delegate to the OP).
- **Consolidated documentos:** central index of all documentos linked to the pedido, its OPs, and movements.

### 4.3. Cliente screen
- **Simplified progress** (stepper, partials, timeline).
- **Never** sees OP, batch, Fornecedor, NF, delivery note, cost, or margin.
- The Cliente pedido detail must consume a public read model
  (`cliente_pedido_summary`) and must not query internal operational
  tables directly. The RPC may consolidate the chain in the backend, but
  its payload must publish only simplified and safe data.
- Documentos visible only if the admin publishes them (e.g., delivery note).

### 4.4. Documentos

| Context | Rule |
|---|---|
| General commercial documentos (e.g., purchase order, contract) | Can be attached directly to the **Pedido**. |
| Operational documentos (e.g., shipping NF, delivery note) | Should preferably be linked to the **movement/OP** and appear consolidated in the **Pedido**. |
| The Pedido is the **central index** of documentos. | The Pedido Admin screen must display all documentos, regardless of link level. |

---

## 5. Suggested future phases

> Recommended order. Each phase is atomic and traceable.

| Phase | Description | Dependency | Status |
|---|---|---|---|
| **B** | Detailed architecture/schema contract: validate existing columns, design new ones (`documentos_operacionais`, FK `op_itens.pedido_item_id`), validate indexes and constraints. | Plan A (this doc) | **[x] Completed** (`docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`) |
| **C** | Pedido → OP link: populate `lotes.pedido_id` on batch creation/editing; migration `op_itens.pedido_item_id`. | B | **[x] Completed** (`bbc57b2`; migration `db/20_*` applied in staging `ucrjtfswnfdlxwtmxnoo`) |
| **D** | OPs linked in the Pedido Admin detail: list the pedido's OPs with status, progress, and link to the OP screen. | C | **Delivered** via the accepted production flow (Pedido Detail lists linked OPs; see `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.4 and `PEDIDO_OP_SCHEMA_CONTRACT.md` §9). |
| **E** | Production stepper/preview in the Pedido Admin: graphical view of the stages with real progress derived from the OPs. | D | **Delivered** via the accepted production flow (stepper/preview in the Pedido Detail; `derivePedidoChainState`; see §9.4/§9.7). |
| **F** | Canonical movement operation: module/function reused by the OP screen and the Pedido shortcuts. | D | **Delivered** via the accepted production flow (Pedido reuses the OP's canonical operations, without a parallel write; see §1.1/§9.5). |
| **G** | Document pendency per movement: `documentos_operacionais` table, metadata upload, link with movement/OP/Pedido. No file upload yet. | B | **Superseded** by the canonical G28 documentation pipeline (`document_link_revisions`/`document_link_revision_ops`; `documentos_operacionais` not created). |
| **H** | Drive/OneDrive integration: real file upload, external storage, database pointers. | G | **Superseded** by the canonical G28 documentation pipeline (external file handled in the G28 documentos model; Drive attachment in the UI is visual-only). |
| **I** | Future automation via email/PDF/XML: reading `eddiravazio@gmail.com`, classification, automatic attachment with human review. | H | **Superseded** by the canonical G28 documentation pipeline (Gmail ingestion + human validation; see `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`). |
| **J** | Smart balance per stage and transactional lock: prevent one stage from consuming more than the previous one produced. | F | **Future / not sequenced / not started / not authorized** (transactional balance lock per stage; see `PEDIDO_OP_SCHEMA_CONTRACT.md` §7). |
| **L** | OP backend lifecycle: expanded status (`pausada`/`concluida`/`cancelada`), `op_eventos` table, event trigger, RPC `alterar_status_op` (admin-only, R1). Migration `db/21_op_lifecycle_status_eventos.sql` applied in staging `ucrjtfswnfdlxwtmxnoo`. | — | **[x] Completed** (backend applied in staging; next: OP lifecycle UI) |

> **Reconciliation `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1` (docs-only):** the Status column of Phases D–J was reconciled with the current authorities — D/E/F **delivered** via the accepted production flow; G/H/I **superseded** by the canonical G28 documentation pipeline; J **future/not sequenced/not started/not authorized**. No change to code, runtime, or behavior; dated decisions and historical records remain preserved. `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE`.

---

## 6. Permanent obligation

> **BINDING RULE FOR ALL EVOLUTION OF THIS FRONT.**

Whenever there is evolution, a decision, a block, a partial conclusion, or the closing of a stage in the **Pedido ↔ OP ↔ Movement ↔ Documentos** front, the executor (human or AI) must:

1. **Consult this plan** before starting any action.
2. **Update this plan** at the end of the stage, recording:
   - New decisions made.
   - Completed phases (mark `[x]`).
   - Identified pendencies.
   - New or mitigated risks.
   - Recommended next step.
3. **Update `PROJECT_STATE.md`** with the record of the completed phase.
4. **Update `AGENT_HANDOFF.md`** with the summary for the next session.
5. **Expose in the handoff** that the next chat must consult this plan before any action.
6. **Never** implement without first consulting this plan.
7. **Never** close a stage without updating this plan.

### 6.1. Phase L decisions — OP Lifecycle (backend)

| # | Decision | Rationale |
|---|---|---|
| D-L01 | `ops.status` expanded to accept `pausada`, `concluida`, `cancelada`. `finalizada` kept as legacy. | Not breaking existing latex OP; `concluida` is the new canonical value. |
| D-L02 | `op_eventos` table created for the OP's event history. | Necessary for future OP audit and timeline. |
| D-L03 | Trigger `trg_op_evento` automatically records every status change. | Single source of truth; avoids duplication with the RPC. |
| D-L04 | RPC `alterar_status_op` validates transitions and applies the change. | Invalid transitions are rejected in the backend. |
| D-L05 | `concluida` fills `finalizada_em` if null. `cancelada` does not fill it. | Correct semantics of completion vs. cancellation. |
| D-L06 | `gerar_op_latex` not changed in this phase. Latex OP continues to be born `em_producao`. | Preserves compatibility; transition to concluida will come later via the RPC. |
| D-L07 | RLS of `op_eventos` follows the `ops` pattern: admin ALL, Fornecedor SELECT on linked rows. | Consistency with the rest of the project. |
| D-L08-R1 | `alterar_status_op` is **admin-only** in this phase (`is_admin()`). Fornecedor has no WRITE on `ops` and cannot transition status. | Hardening R1: explicit caller guard, following the `gerar_op_latex` pattern (db/08/09). Do not promise Fornecedor permission. |
| D-L09-R1 | The RPC's `p_observacao` is linked to the `status_alterado` event corresponding to `status_novo` (filter `status_novo = p_novo_status` + ordering `criado_em DESC, id DESC`). The trigger remains the single source of the event (no second `INSERT`). | Hardening R1: reduce the risk of the observation landing on the wrong event under concurrency. `SET LOCAL/current_setting` is left for a future phase. |

### 6.2. Cliente Order Summary Readmodel phase decisions

| # | Decision | Rationale |
|---|---|---|
| D-COS01 | The Client Portal must read the pedido detail via `public.cliente_pedido_summary(UUID)`, not via direct joins on operational tables in the frontend. | Maintains the Cliente/Admin boundary and reduces coupling with OP, batch, Fornecedor, and internal documentos. |
| D-COS02 | The RPC is `SECURITY DEFINER`, `STABLE`, `search_path = public`, with access for admin or the owning Cliente, and grants only to `authenticated`. | Allows server-side consolidation without opening internal tables to the Cliente or to `anon`. |
| D-COS03 | The public payload does not include internal keys such as OP, batch, Fornecedor, NF, delivery note, cost, margin, split, or catalog IDs. | Complies with the Cliente screen's simplified-progress rule. |
| D-COS04 | `pedido_parciais` and `pedido_cliente_eventos` enter the summary only when `visivel_cliente IS TRUE`. | Preserves the commercial/Cliente role of the partials and avoids publishing administrative events. |
| D-COS05 | The Cliente Dashboard remained outside the change because it already read public data; Admin/Pedido Detail was also left out of scope. | Limits the phase's blast radius to the P1 internal-read issue in the Cliente detail. |
| D-COS06 | Staging verification 2026-07-15 (`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`): `db/30` found already applied in `ucrjtfswnfdlxwtmxnoo` without drift; contract validated via real RPC (owning Cliente `ok`, `anon` fail-closed, cross-tenant denied, admin `ok`). The live ACL also grants `EXECUTE` to `PUBLIC`/`anon`/`service_role` besides `authenticated` (diverging from D-COS02); `db/30` not registered in `supabase_migrations.schema_migrations`. Divergences retained as debt (anon fail-closed, no confirmed exposure); candidate remediation `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (grants-only, analogous to `db/54`) remains `ARCHITECT DECISION REQUIRED`, not authorized. | Records the staging validation without silently normalizing the ACL or reapplying the migration. |
| D-COS07 | ACL remediation applied and verified in staging 2026-07-15 (`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`, `CLOSED / ACCEPTED`): forward grants-only migration `db/57_cliente_pedido_summary_acl_grants.sql` (record `20260715190627` in `ucrjtfswnfdlxwtmxnoo`) revokes `EXECUTE` from `PUBLIC`, `anon`, and `service_role` and keeps only `authenticated` on `public.cliente_pedido_summary(uuid)`, resolving the ACL divergence recorded in `D-COS06`. Body, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, and signature remain byte-for-byte unchanged (identical definition hash before/after the migration). `anon` is now rejected at the ACL boundary (`42501 permission denied for function cliente_pedido_summary`) before any function execution — no longer just fail-closed after execution. `authenticated` owner/cross-tenant/admin behavior unchanged (empirical matrix revalidated). `service_role` is also rejected at the ACL boundary: its platform attribute `rolbypassrls` (RLS bypass on tables) is a mechanism distinct from function `EXECUTE` and does not restore access. | Closes `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` without changing the RPC's functional contract. `db/30` remains unregistered in `supabase_migrations.schema_migrations` (separate provenance debt, preserved, not repaired) and the authenticated browser smoke test remains pending. Applied and verified only in staging `ucrjtfswnfdlxwtmxnoo`; production `bhgifjrfagkzubpyqpew` not accessed; no push. |

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Duplicating movement in Pedido and OP | **High** | Single canonical operation (Phase F); Pedido only consumes/shortcuts. |
| Treating `pedido_parciais` as a production source | **High** | Partials = commercial layer; production source = OP. |
| Attaching documentos without classification | **Medium** | `documentos_operacionais` table with mandatory type, origin, and link. |
| Storing heavy files in the database | **High** | Metadata in the database; files in Drive/OneDrive (Phase H). |
| Creating Drive/Gmail/OneDrive integration before the contract | **Medium** | Phase H only after the schema contract (Phase B) and the document pendency (Phase G). |
| Populating Pedido→OP incorrectly (batch without pedido_id) | **High** | Validate `lotes.pedido_id` on batch and OP creation/editing. |
| Creating a balance lock only in the frontend | **High** | The transactional lock must be in the backend (RPC/trigger). |
| Implementing an RPC without canonical steps | **Medium** | Every movement RPC must be unique and reusable. |
| Ignoring the existing dirty diff in `js/screens/pedidos-list.js` | **Low** | Known residual; do not include in commits of this front. |

---

## 8. Mandatory evidence per phase

Every phase of this front must record upon closing:

- Branch used.
- Initial and final HEAD.
- Initial and final `git status --short`.
- `git diff --stat` (if there are changes).
- Files read.
- Files changed/created.
- Decisions recorded.
- This plan updated.
- `PROJECT_STATE.md` updated.
- `AGENT_HANDOFF.md` updated.
- Recommended next steps.

---

## 9. Next step

**`CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS` (2026-07-15).**

`db/30_cliente_pedido_summary_readmodel.sql` was found **already applied** in
staging (`ucrjtfswnfdlxwtmxnoo`), without drift: `public.cliente_pedido_summary(uuid)`
exists with a body byte-for-byte equivalent to `db/30`. The Client Portal reads the
detail via `cliente_pedido_summary` with contract validated via real RPC (owning
Cliente `ok`, `anon` fail-closed, cross-tenant denied, admin `ok`) and without
direct reads of internal OP/batch/Fornecedor/documentos in the frontend.

Debts identified in this closeout (see `D-COS06`): live ACL broader than
the canonical contract (`PUBLIC`/`anon`/`service_role` with `EXECUTE`, anon
fail-closed, no confirmed exposure), `db/30` not registered in
`supabase_migrations.schema_migrations`, and the authenticated browser smoke
test not executed.

**`CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `CLOSED / ACCEPTED` (2026-07-15).**

The ACL debt above was closed (see `D-COS07`): `db/57_cliente_pedido_summary_acl_grants.sql`
was created, applied, and verified in staging `ucrjtfswnfdlxwtmxnoo` (record
`20260715190627`), revoking `EXECUTE` from `PUBLIC`/`anon`/`service_role` and
keeping only `authenticated`. The RPC's functional contract, body, and signature
remain unchanged; `anon` is now rejected at the ACL boundary before
execution. `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` is **resolved**.

Debts preserved as open (not closed by this phase):
`DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` and
`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`. No migration-history record
was fabricated for `db/30`; `db/57` is classified as applied only in
staging. See `PROJECT_STATE.md` and `docs/ledgers/G28_LEDGER.md`.

**Next step: `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION`** —
after removing the ACL phase from the open backlog, the reconciliation of the
remaining general backlog remains pending an architect decision. Production
must only be discussed in a separate phase, with explicit authorization.

---

> **This plan is the canonical source for the Pedido ↔ OP ↔ Movement ↔ Documentos front.**
> Must be consulted before any action and updated at the end of each stage.
> Indexed in `docs/DOCUMENTATION_INDEX.md` §1.
## Update 2026-07-06 - Pedido/OP Controlled Delete B

Phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B` creates a controlled
cleanup gate for test data without changing the production contract:

| # | Decision | Rationale |
|---|---|---|
| D-DEL01 | Pedido/OP deletion is centralized in a transactional RPC. | Avoids direct deletes scattered across the UI and respects FKs/triggers. |
| D-DEL02 | The UI always calls diagnostics and shows the impact before removing. | The user sees the affected OPs, batches, deliveries, and expedições before the final action. |
| D-DEL03 | Delivery/expedição block deletion. | Production data and operational documentos cannot be deleted in this phase. |
| D-DEL04 | A Pedido with an OP without movement requires `EXCLUIR` and removes linked OPs/batches. | Test cleanup must not leave an orphan batch nor an OP linked to a deleted Pedido. |
| D-DEL05 | A parent OP with a child blocks individual deletion. | Avoids leaving an orphan finishing OP; the user must delete the child first. |
| D-DEL06 | `op_numeros` is not changed. | Numbering and operational history remain monotonically preserved. |
| D-DEL07 | In staging/test, a numbered OP without real blockers can be removed via the controlled RPC. | `db/34` removes/bypasses the legacy trigger `ops_numeradas_no_delete`; the number is not recycled because `op_numeros` remains high-water. |
| D-DEL08 | In staging/test, a chain with a delivery/child OP without expedição requires `EXCLUIR TUDO` and can be removed in a transactional cascade. | `db/35` distinguishes `requires_cascade_confirmation` from `blocked`; expedição remains a blocker and future production requires audit/soft-delete. |
| D-DEL09 | Before deleting an OP, the cascade must zero out `entrega_itens` by `op_id` and by `op_item_id`, and DELETE guards must return `OLD`. | `db/36` fixes the FK order and avoids silent cancellation by the `BEFORE DELETE` trigger; a real synthetic test validated Pedido #29/OPs 45-46 in staging without changing `op_numeros`. |
| D-DEL10 | Physical deletion of Pedido/OP is blocked when there is linked canonical document history (`document_link_revisions`/`document_link_revision_ops`); the legacy destructive logic is isolated in `_pre53` functions with no public API. | `db/53` renames the four legacy RPCs to `*_pre53` (revoking `EXECUTE` from all roles) and recreates `SECURITY DEFINER` wrappers that diagnose document history and block before delegating; it never deletes `document_link_revisions`/`document_link_revision_ops`/`op_numeros`. |
| D-DEL11 | The four public RPCs keep `EXECUTE` only for `authenticated`. | A post-`db/53` inspection found `anon_execute = true` on the public RPCs (emergency security finding); `db/54` revokes `PUBLIC`/`anon`, keeping `authenticated`, without changing the body/cascade. |
| D-DEL12 | The document policy literal in the diagnostic JSON uses an explicit `::TEXT` cast. | The first staging smoke test of `db/53` failed with `could not determine polymorphic type` due to `to_jsonb(<literal>)` without a cast; `db/55` fixes it via a forward-only patch on the two diagnostics already applied. |
| D-DEL13 | The public diagnostic never returns raw `NULL`; a missing `reason` is serialized as JSON `null`. | `jsonb_set` is `STRICT` and collapsed the entire return to `NULL` for any eligible (not blocked) target; `db/56` fixes this with `COALESCE(to_jsonb(v_reason), 'null'::jsonb)` in the two diagnostics, without changing `remover_*`/`*_pre53`/grants. |

Button/flow added to the main Pedido and OP screens via
`window.RAVATEX_DELETE`. The old direct `excluirOpLatex` was replaced by the
central helper. Admin password, soft-delete, and permanent audit are left for
the future production phase.

Phase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` (+ `-GRANTS-54`,
`-POLICY-CAST-55`, `-DIAGNOSTICS-NULL-SAFE-56`, decisions D-DEL10-D-DEL13
above): `CLOSED / ACCEPTED`, technical commit
`707a37bd1d2c4728ab2a17433b6441049bd88062`. Validated in staging
`ucrjtfswnfdlxwtmxnoo` with synthetic fixtures (eligible-OP,
eligible-Pedido, and blocked-by-history cases), zero cleanup, and `op_numeros`
preserved; production not accessed; no push. See
`docs/ledgers/G28_LEDGER.md`. Note: `db/37_controlled_delete_expedicao_
cascade.sql` (Expedição Cascade) never received its own `D-DEL` entry
(pre-existing gap, out of scope for this closeout).
