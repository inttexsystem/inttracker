# ACTIVE OPERATIONAL HANDOFF

- **Staging-only execution boundary in force (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, 2026-07-15):** explicit architect decision — the current operational environment is exclusively staging `ucrjtfswnfdlxwtmxnoo`; the protected/other Supabase project is out of scope; schema migration/promotion in production is postponed until the complete canonical backlog is finished; `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` is no longer a current material blocker, it is `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER`; G28-D publication is `DEFERRED / NOT AUTHORIZED / NOT A CURRENT BLOCKER`; Vercel is a future candidate only, with no decision and no authorization. See `PROJECT_STATE.md` ("Architect Decision — Staging-Only Execution Boundary") and its own section below.
- **No active functional phase.** G28-C is reclassified (2026-07-15, `G28-RECONCILIATION-DECISIONS-A`) as `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING` — see `PROJECT_STATE.md`. G28-D discovery remains `RELEASE CONTRACT DISCOVERY COMPLETE` (evidence preserved); its publication is `DEFERRED BY ARCHITECT / NOT A CURRENT BLOCKER / NOT AUTHORIZED` and does not constitute an active phase. The canonical definition of the publication mapping and of the authorized procedure for migrations 51/52 remains absent from the repository, but this is no longer a current blocker by explicit decision; see `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **Last accepted phase:** `G28-CAMADA-2 / A5.1-A5.2 — Administrative Password Reset — CLOSED / ACCEPTED` (2026-07-16; real e2e in staging `result: PASS` 15/15; architect visual validation waived by explicit decision, covered by e2e + flow verification in a real browser by the executor; see its own section below and `PROJECT_STATE.md`). `A4.2` (mandatory password change guard) and `CAMADA2-LAST-ACCESS-UI` (consumption of RPC `db/59` in the UI, commit `0aff22f`) also `CLOSED / ACCEPTED` (2026-07-16). **No pending documentation closeout debt among these three phases.** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` remains `CLOSED / ACCEPTED` (2026-07-15). `G28-C` remains the last functional phase of G28 proper, now `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING` (reclassification `G28-RECONCILIATION-DECISIONS-A`, 2026-07-15; staging/projections matrix 16/16 technical PASS; historical closeout `a7d7caa`/acceptance `d5ec09f` not rewritten; explicit debt `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`). G28-B8 is `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`.
- **R1 commits completed:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state` (initial R1 documentation closeout); `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state` (correction of R1 textual defects). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Publication criterion (`G28-GOVERNANCE-CONSOLIDATION-A`, 2026-07-15):** binding architect decision — the system only enters production after `G28-CAMADA-2` (full scope `A1-A7`) and `G28-CAMADA-3` (automatic backup) are both `CLOSED / ACCEPTED` in staging. `PUBLICATION-TRACK-REVIEW` is a front conditioned on that criterion, not a current candidate. `G28-CAMADA-3` moves from deferred to `PUBLICATION CRITICAL PATH` (after Camada 2), pending its own spec (the `BK1-BK8` diagnosis is a future phase, `NOT AUTHORIZED`). Candidate front `CODE-HEALTH-AUDIT-§18-R1` (read-only §18 audit, input for decomposition of `cadastros.js`) also recorded `NOT AUTHORIZED`. See `PROJECT_STATE.md` (its own section) and the section below.
- **Next action:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` was implemented, applied and verified in staging — **it must not be routed again** as the next action; it is `CLOSED / ACCEPTED`. The read-only reconciliation of the general backlog (`BACKLOG-RECONCILIATION-READONLY-R1`), the documentation backfill `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` and the recording of the boundary `STAGING-ONLY-EXECUTION-BOUNDARY-A` have also already been completed. **Next front selected:** `G28-CAMADA-2`. The proposed spec was materialized in `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (`CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`). `A3.1` (1:1 extraction of the users screen), `A3.2` (summary cards + toolbar), `A4.1` + `CAMADA2-LAST-ACCESS-RPC`, `CAMADA2-LAST-ACCESS-UI`, `A4.2` (mandatory password change guard) and `A5.1-A5.2` (administrative password reset) are all `CLOSED / ACCEPTED` — see their own sections below. **None of these must be routed again as the next action.** `A5.3-A5.4` (reactivation) explicitly **not included** in `A5.1-A5.2` — own future authorization. **Next authorizable action (2026-07-16): `ARCHITECT DECISION`** among `A5.3-A5.4` (reactivation), `UI-EL-BOOLEAN-ATTR-FIX` (candidate `NOT AUTHORIZED`, severity `NOT CONFIRMED` — potential boolean `setAttribute` bug in `js/ui.js`'s `el()` affecting the Deactivate/Delete buttons of `admin-usuarios.js`, pending direct architect verification in staging), `A2.1` (schema `nivel_acesso`) and `A6.1` (audit schema/trigger). No subphase authorized by this record. The project's supervision protocol is formalized in `docs/governance/SUPERVISION_PROTOCOL.md` (Architect/Reviewer/Resident Executor roles). Hygiene of the `work/app-next` worktree (divergent/dirty) remains authorized as a parallel read-only task in a separate order. `OPEN_ARCHITECT_DECISIONS: NONE` for the current staging cycle. Remaining Client Portal debts are made explicit: `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` and `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`. Recorded baseline/decomposition debts: 6 tests in `tests/auth.smoke.js` with outdated regex (`A4.2`) and `js/screens/admin-usuarios-modal.js` at 576 lines (`A5.1-A5.2`), both candidates for `CODE-HEALTH-AUDIT-§18-R1`. Publication is not the next action and no automatic implementation follows.
- **Workspace / branch / previous HEAD:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28` / `work/g28-document-qualification`. Previous technical/documentation HEAD: `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` (historical G28-D discovery baseline; this documentation record succeeds it).
- **Mandatory reading before routing any order:** `PROJECT_STATE.md`, this handoff, G28 master plan (`docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`), `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`, G28 ledger (`docs/ledgers/G28_LEDGER.md`) and applicable contracts/runtime.
- **Documentation continuity — mandatory paths:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future handoff must relay these paths and expressly instruct the next chat to relay them again in any subsequent handoff. The continuity chain of the plan and of the backlog cannot be interrupted.
- **Runtime boundaries:** Document→Pedido 0..1 and Document→OP 0..N contract; dedicated revision tables; Ingestor retains candidate/event fields; B5 preserved; no `statusOverrides`, dual write, backfill or production.
- **Non-blocking debt:** `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` (the browser has no staging admin application/session).

## Controlled Delete × Document History (Pedido/OP) — CLOSED / ACCEPTED

- **Technical commit:** `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history` (`js/delete-helpers.js`, `tests/controlled-delete.smoke.js`, `db/53`–`db/56`).
- **Documentation commit:** this closeout (`Close controlled delete document history guard`). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Original problem:** controlled physical deletion of Pedido/OP (`db/34`–`db/37`) violated the FK `document_link_revision_ops_op_id_fkey` when attempting to remove an OP still referenced by canonical append-only document history.
- **Root cause and fixes:** `db/53` adds a documentation guard via `SECURITY DEFINER` wrappers that block physical deletion when there is canonical history (`document_link_revisions`/`document_link_revision_ops`), renaming the legacy destructive logic to `*_pre53` (externally inaccessible); `db/54` fixes an emergency security finding (`anon_execute = true` on the public RPCs), restricting `EXECUTE` to `authenticated`; `db/55` fixes `to_jsonb(<literal>)` without an explicit cast (`could not determine polymorphic type`) via a forward-only patch; `db/56` fixes a `jsonb_set` `STRICT` regression that collapsed the diagnosis to `NULL` on eligible targets, using `COALESCE(to_jsonb(v_reason), 'null'::jsonb)`.
- **Local tests:** `node --check js/delete-helpers.js` PASS; `tests/controlled-delete.smoke.js` **53/53**; `tests/document-canonical-links-contract.test.js` **21/21**; `git diff --check` PASS.
- **Staging smokes (`ucrjtfswnfdlxwtmxnoo`, synthetic fixtures, zero cleanup):** Case A1 (eligible OP with dependency, no history) — non-null diagnosis, removal completed; Case A2 (eligible Pedido with dependency, no history) — non-null diagnosis, removal completed; Case B (with document history) — diagnosis blocked, `remover_op`/`remover_pedido` blocked in a controlled manner, all document history preserved without change. `op_numeros` preserved in all cases.
- **Final ACL (verified against the live catalog):** the 4 public RPCs — `authenticated`-only (`PUBLIC`/`anon` without `EXECUTE`); the 4 `*_pre53` functions — `postgres`-only (`PUBLIC`/`anon`/`authenticated` without `EXECUTE`).
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action (per `PROJECT_STATE.md`):** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION`.
- **Full detail:** `PROJECT_STATE.md` (section "Controlled Delete × Document History") and `docs/ledgers/G28_LEDGER.md` (append-only entry).

## Admin/Pedido — Static Residue of the Completion Button (Expedição) — CLOSED / ACCEPTED

- **Technical commit:** `7978e0a4fe021467cc23e0aeed63ac87ba738f1b` — `Fix admin order completion button state` (`js/screens/expedicao-admin.js`, `tests/expedicao-flow.smoke.js`).
- **Documentation commit:** this closeout (`Close admin order completion button residue`). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Original problem:** `js/screens/expedicao-admin.js:405` built `disabled: ready ? null : 'disabled'`; the shared helper `js/ui.js` `el()` calls `setAttribute(k, v)` for every attribute without omitting `null`, materializing `disabled="null"` in the real DOM — a boolean attribute present, disabling the "Concluir pedido" button even when `ready === true`.
- **Root cause and fix:** single occurrence in the repository; fix localized entirely at the call site (`buildConclusao`), without altering `js/ui.js`. `buttonAttrs` built as a variable before the `return`; `disabled` only enters the object when `!ready`. `onclick`, text, styles and structure preserved without semantic change.
- **Local tests:** `node --check js/screens/expedicao-admin.js` PASS; `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js` **12/12**; `git diff --check` PASS.
- **Accesses:** no staging; no production (`bhgifjrfagkzubpyqpew` not accessed); no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED`. This entry does not authorize its execution.
- **Full detail:** `PROJECT_STATE.md` (section "Admin/Pedido — Static Residue of the Completion Button") and `docs/ledgers/G28_LEDGER.md` (append-only entry).

## Client Portal — Order Detail Read Model — CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS

- **Phase:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`. **Documentation commit:** this closeout (`Close client order summary read model staging validation`). No technical commit — the phase changed no files (verification-only). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Result:** `db/30_cliente_pedido_summary_readmodel.sql` **was already applied** in staging (`ucrjtfswnfdlxwtmxnoo`); the function `public.cliente_pedido_summary(uuid)` exists with a body byte-for-byte equivalent to `db/30` (**no drift**), signature/`SECURITY DEFINER`/`STABLE`/`search_path=public`/owner `postgres` per contract; the 16 dependency tables exist.
- **Contract validated:** real RPC called per role — owner client `ok=true` (full DTO), `anon` `ok=false` **fail-closed** (executes, no data), cross-tenant `ok=false`, admin `ok=true`. All fields consumed by `js/screens/cliente-pedido-detail.js` present and typed; empty collections `[]`; nulls handled; no dependence on silent fallback.
- **Divergences recorded (not normalized):** the live ACL grants `EXECUTE` to `PUBLIC`/`anon`/`authenticated`/`service_role` (`db/30` intends only `authenticated`); `db/30` not recorded in `supabase_migrations.schema_migrations`.
- **Non-blocking debts:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` (anon fail-closed, no confirmed exposure); `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` (no test client password).
- **Remediation candidate (not authorized, not started):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `ARCHITECT DECISION REQUIRED`; intended scope = grants-only migration analogous to `db/54` (`REVOKE EXECUTE … FROM PUBLIC, anon`, preserving `authenticated`).
- **Accesses:** Supabase MCP not exposed in the session; the authorized direct PostgreSQL fallback used only for verification (read-only, `BEGIN … ROLLBACK`, zero mutation); temporary tooling outside the repo removed; no secret echoed. Production (`bhgifjrfagkzubpyqpew`) not accessed; no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — no single unambiguous next action; the ACL remediation candidate must not be self-selected.
- **Full detail:** `PROJECT_STATE.md` (section "Client Portal — Order Detail Read Model") and `docs/ledgers/G28_LEDGER.md` (append-only entry).

## Canonical Documentation — Consistency Backfill — DOCS-CANONICAL-CONSISTENCY-BACKFILL-A — CLOSED / ACCEPTED

- **Phase:** `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. **Documentation commit:** this closeout (`Backfill canonical migration documentation`). Docs-only — no code, test, SQL, migration, staging or production changed. The current HEAD must be consulted with `git rev-parse HEAD`.
- **Gaps closed:** (1) `db/37_controlled_delete_expedicao_cascade.sql` without its own `D-DEL` entry — added `D-DEL14` in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10; (2) `db/34`–`db/37` and `db/53`–`db/56` absent from `docs/DOCUMENTATION_INDEX.md` §4 — 8 lines added; (3) status of `db/30` in the index, corrected from "not yet applied" to applied/verified in staging with a broader ACL than the canonical contract retained as an explicit debt.
- **Debts preserved as open (not closed by this backfill):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`; `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; authenticated smoke debts (G28-C/D/B7/Client Portal); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D`; production application of the staging-only stack; `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-2/3/4`.
- **Accesses:** no staging; no production (`bhgifjrfagkzubpyqpew` not accessed); no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED` — `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`. This backfill does not authorize any technical phase.
- **Full detail:** `PROJECT_STATE.md` (section "Canonical Documentation — Consistency Backfill") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Architect Decision — Staging-Only Execution Boundary — STAGING-ONLY-EXECUTION-BOUNDARY-A

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

- **Phase:** `STAGING-ONLY-EXECUTION-BOUNDARY-A`. **Documentation commit:** this record (`Record staging-only execution boundary`). Docs-only — no code, test, SQL, migration, Supabase, staging, production or Vercel accessed/changed. The current HEAD must be consulted with `git rev-parse HEAD`.
- **Binding decision recorded:** the current operational environment is exclusively staging `ucrjtfswnfdlxwtmxnoo`; the protected/other Supabase project is out of scope; schema migration/promotion in production postponed until the complete canonical backlog is finished; a production publication mapping is not required for the current work in staging; publication of G28-D remains postponed, not authorized and does not constitute a current blocker; the publication provider (incl. Vercel) is not selected — a future candidate only.
- **Reclassification:** `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` is no longer recorded as a current material blocker or a required next architect decision; it becomes `DEFERRED BY ARCHITECT UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED`. It was not discovered, defined, tested or finished — only intentionally postponed. Discovery evidence preserved, not rewritten, in `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **Next technical candidate:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` was authorized, implemented, applied and verified in staging on 2026-07-15 (`CLOSED / ACCEPTED` — see its own section below). There is no single subsequent technical candidate; `NEXT_AUTHORIZABLE_ACTION: NONE`.
- **Accesses:** no Supabase/MCP/staging/production/Vercel access in this phase; no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Full detail:** `PROJECT_STATE.md` (section "Architect Decision — Staging-Only Execution Boundary") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Architect Decision — Backlog Reconciliation and Supervision Governance — G28-RECONCILIATION-DECISIONS-A

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

- **Phase:** `G28-RECONCILIATION-DECISIONS-A`. **Documentation commit:** this record (`Record architect reconciliation decisions`). Docs-only — no code, test, SQL, migration, Supabase, staging, production or Vercel accessed/changed. The current HEAD must be consulted with `git rev-parse HEAD`.
- **Read-only baseline underpinning this decision:** `BACKLOG-RECONCILIATION-READONLY-R1` (`docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md`), executed after reading the 9 canonical paths + the ChatGPT closeout (`docs/handoffs/CHATGPT_CLOSEOUT_2026-07-15.md`).
- **`PROJECT-CONTROL-BASELINE-R1` (ChatGPT):** `REJECTED / NOT RATIFIED` — materially incorrect classification of Camada 2 (treated partial capability as accepted implementation). External artifact, never canonical. Its proposed correction (`PROJECT-CONTROL-BASELINE-R1-CORRECTION`) is `CANCELLED / ABSORBED / SUPERSEDED` by the diagnosis `BACKLOG-RECONCILIATION-READONLY-R1`, adopted as the current reference baseline.
- **G28-CAMADA-2 reclassified:** `PRE-EXISTING PARTIAL CAPABILITY` (user CRUD, deactivation/ban via Edge Functions, single role `usuarios.tipo`, client/supplier link — a byproduct of `AUTH-DISABLE-USER` and of the Client Portal) `+ FULL SCOPE A1-A7 DEFERRED` (password reset/recovery, invitations, roles/permissions matrix, full audit, full password policy, reactivation — none of these found in the real code). Not accepted as a dedicated phase; no implementation authorized by this record. Functional/visual reference for the full scope, when authorized: `D:\OneDrive\Programação\SGAA_clean_baseline`.
- **G28-C reclassified in the current state:** `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`, separating technical/staging acceptance (16/16 matrix, migrations applied/verified) from the architect's functional/personal validation (not recorded) and from the authenticated browser smoke (`AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, never executed). The historical closeout (`a7d7caa`/acceptance `d5ec09f`) **is not rewritten**; this is a new and linked entry in the G28 ledger.
- **Supervision governance:** tracking of progress, continuity, scope, authorizations, phases and documentation passes to Claude (chat) and Claude Code (resident). ChatGPT remains available as a process consultant, **with no custody of state and no authority to issue orders**.
- **Next front selected:** `G28-CAMADA-2`, starting with a comparative read-only diagnosis in a subsequent order of its own — **not authorized by this record**.
- **Authorized parallel task:** hygiene of the `work/app-next` worktree (11 commits behind `staging/work/app-next`, dirty worktree) — **read-only**, separate order.
- **Accesses:** no Supabase/MCP/staging/production/Vercel access in this phase; no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Full detail:** `PROJECT_STATE.md` (section "Architect Decision — Backlog Reconciliation and Supervision Governance") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Camada 2 — User Administration — Proposed Spec — CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1

- **Phase:** `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`. **Documentation commit:** this record (`Add Camada 2 user administration spec`). Docs-only — no code, test, SQL, migration, Supabase, staging, production or Vercel accessed/changed. **Status: `PROPOSED`.** The current HEAD must be consulted with `git rev-parse HEAD`.
- **Document created:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`. Mandatory reading before routing any order on `G28-CAMADA-2`.
- **Content:** `A1-A7` + password policy, each item with file:line evidence of what SGAA_clean_baseline does (external read-only reference), what already exists in Tapetes, what is missing, an adapted proposal, foreseen modules/files, Auth risk and subphase/gate. Includes a consolidated module plan, an Auth risk table and the order of subphases.
- **Architect decisions already incorporated (do not reopen without a new decision):** `nivel_acesso` 2 levels (`completo`/`somente_leitura`); permissions override table not built; A4 = temporary-password-with-forced-change only, email/SMTP `NOT AUTHORIZED`; bulk actions (A3.3) `DEFERRED`; explicit session revocation out of scope.
- **Next authorizable action:** `A3.1` was authorized, executed and accepted — see the section "Camada 2 — User Screen Extraction" below. The next subphase is `A3.2`, under a mockup gate.
- **Accesses:** no Supabase/MCP/staging/production/Vercel access; strictly read-only reading of `D:\OneDrive\Programação\SGAA_clean_baseline` (unrelated external project, no file touched); no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — User Administration — Proposed Spec") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted. For work on `G28-CAMADA-2` specifically, add `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` as the tenth mandatory path.

## Camada 2 — User Screen Extraction — CAMADA2-USUARIOS-A3-1 — CLOSED / ACCEPTED

- **Technical commit:** `4f01101143a512c8018d58ce9e523064c38a145f` — `Extract user administration screen modules` (`js/admin-usuarios-writes.js`, `js/screens/admin-usuarios-modal.js`, `js/screens/admin-usuarios.js`, `index.html`, `js/boot.js`, `tests/admin-usuarios.smoke.js`, `tests/boot.smoke.js`, `tests/cadastros-screens.smoke.js`).
- **Documentation commit:** this closeout (`Close Camada 2 user administration screen extraction`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Scope:** pure refactor — 1:1 extraction of `screenCadastrosUsuarios` (`js/screens/cadastros.js:2226-2713`) into 3 own modules, no new feature, no behavior change. Route cutover brought forward (spec revision adjustment): `js/boot.js` rewired to `window.screenAdminUsuarios`; `index.html` with the 3 new scripts.
- **Coupling resolved:** form helpers from `cadastros.js` (IIFE, not exposed on `window.*`) duplicated locally in `admin-usuarios-modal.js` — identical behavior, without touching `cadastros.js`.
- **Scope decision:** the original `render()` function (dead code, never called) not ported — no observable impact.
- **Not changed:** `cadastros.js`, `js/ui.js`, `js/auth.js` untouched. `screenCadastrosUsuarios` remains in `cadastros.js` until isolated removal in `A3.4`.
- **Tests:** `admin-usuarios.smoke.js` (new) 13/13; `boot.smoke.js` 32/32; `cadastros-screens.smoke.js` 32/32; broad regression of 28 suites: 1207/1296, identical to the baseline (`git stash` compared). `git diff --check` clean.
- **Visual validation:** confirmed by the architect on the route `#/cadastros/usuarios`, local app (`http://localhost:8765`) pointing to staging `ucrjtfswnfdlxwtmxnoo` — 1:1 parity accepted.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action:** `A3.2` was authorized and completed — see its own section below.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — User Screen Extraction"), `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (§4/§6) and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (work on `G28-CAMADA-2`)
  Every future chat or agent must relay these ten paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Camada 2 — Summary Cards and Toolbar — CAMADA2-USUARIOS-A3-2 — CLOSED / ACCEPTED

- **Technical commits:** `b4a6238c34afb683ec7a973d230330b7266c99f2` — `Add user admin summary cards and toolbar`; `3198570c04b08bef83605f64bc9ae1c5ece8b873` — `Align summary card background with dashboard`.
- **Documentation commit:** this closeout (`Close user admin summary cards phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Scope:** additive UI feature over `js/screens/admin-usuarios.js` (extracted in `A3.1`) — summary cards (4, KPI), toolbar (search+sort+type filter+toggle), colored role badge, inactive-row opacity. Mockup gate satisfied (approved by the architect on 2026-07-15); final values in `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`.
- **Item 4 blocked (HARD STOP confirmed, not implemented):** the "Último acesso" column requires reading `auth.users.last_sign_in_at`, nonexistent today (no RPC/view exposes it). **Architect decision: admin-only `SECURITY DEFINER` RPC, `is_admin()` pattern.** Recorded `CAMADA2-LAST-ACCESS-RPC` — `NOT AUTHORIZED`, candidate to group with the `A4.1` migration.
- **Post-validation adjustment:** card background standard `#f4f6f9` → `#fff` (same tone as `.rv-adm-card` in `js/screens/painel.js`); Inactive card keeps `#fff8f8`.
- **Not changed:** `index.html` (no new script); `js/admin-usuarios-writes.js`; `js/screens/admin-usuarios-modal.js`; `cadastros.js`; `js/ui.js`; `js/auth.js`. `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` received no entry (no new module/route change).
- **Tests:** `admin-usuarios.smoke.js` 20/20 (7 new); `boot.smoke.js` + `cadastros-screens.smoke.js` 64/64 (no regression); `git diff --check` clean.
- **Visual validation:** confirmed by the architect on the route `#/cadastros/usuarios`, local app (`http://localhost:8765`) pointing to staging `ucrjtfswnfdlxwtmxnoo`, including the background adjustment.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Governance:** supervision protocol formalized in `docs/governance/SUPERVISION_PROTOCOL.md` in this phase (Architect/Reviewer/Resident Executor roles, onboarding, order format, gates).
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED` among `A4.1`, `A2.1`, `A6.1` (see the section above). `A3.3` `DEFERRED`. `A3.4` depends on the other A3.x subphases. This entry does not authorize its execution.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — Summary Cards and Toolbar") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (work on `G28-CAMADA-2`)
  Every future chat or agent must relay these ten paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Client Portal — ACL Grants Hardening — CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1 — CLOSED / ACCEPTED

- **Technical commit:** `82f5ba70ace2e74c51b7c0295d1ecf8e319954be` — `Restrict client order summary RPC grants` (`db/57_cliente_pedido_summary_acl_grants.sql`, `tests/cliente-pedido-summary-acl-grants.smoke.js`). **Documentation commit:** this closeout (`Close client order summary RPC grant hardening`). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Original problem:** the live ACL of `public.cliente_pedido_summary(uuid)` in staging granted `EXECUTE` also to `PUBLIC`, `anon` and `service_role`, besides `authenticated`, diverging from the canonical contract `D-COS02` (`authenticated`-only).
- **Fix:** `db/57` grants-only, forward-only, idempotent, restricted to the exact signature of the function — `REVOKE EXECUTE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated`. Applied exactly once via Supabase MCP (tracked migration operation) in staging `ucrjtfswnfdlxwtmxnoo`; record `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmed.
- **Final ACL:** `PUBLIC` without `EXECUTE`; `anon` without `EXECUTE`; `authenticated` with `EXECUTE`; `service_role` without explicit `EXECUTE`. Owner `postgres` retains inherent privilege.
- **Function contract unchanged:** signature, return `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, body — definition hash identical before/after.
- **Empirical matrix (staging, read-only, `BEGIN … ROLLBACK`, no fixtures):** `anon` → `ERROR 42501: permission denied` at the ACL boundary before execution; `authenticated` owner → `ok=true` full DTO; `authenticated` cross-tenant → `ok=false` fail-closed with no third-party data; `authenticated` admin → `ok=true` full DTO; `service_role` via direct `SET ROLE` → `ERROR 42501` (object grant successfully revoked; `rolbypassrls` is a distinct RLS mechanism, it does not restore `EXECUTE`).
- **Frontend:** `js/screens/cliente-pedido-detail.js` remains the only real consumer (standard authenticated path); no change needed.
- **Local tests:** `tests/cliente-pedido-summary-acl-grants.smoke.js` (new) + `tests/cliente-pedido-summary-readmodel.smoke.js` (existing) — **21/21 PASS**; `git diff --check` clean.
- **Debt closed:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — `RESOLVED IN STAGING`.
- **Debts preserved as open:** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (no history record fabricated for `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; production application of the staging-only stack (incl. `db/57`) remains postponed by `STAGING-ONLY-EXECUTION-BOUNDARY-A`.
- **Accesses:** Supabase MCP connected and used only for catalog reading and the tracked application of the migration in staging `ucrjtfswnfdlxwtmxnoo`; production (`bhgifjrfagkzubpyqpew`) not accessed; Vercel not accessed; no push.
- **Final worktree state:** clean; staging empty; zero untracked.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — `NEXT_AUTHORIZABLE_ACTION: NONE` until a new reconciliation of the remaining general backlog.
- **Full detail:** `PROJECT_STATE.md` (section "Client Portal — ACL Grants Hardening") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Canonical Documentation — Status Consistency of the Legacy Pedido↔OP Plans — DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1 — CLOSED / ACCEPTED

- **Phase:** `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1`. **Documentation commit:** this closeout (`Reconcile legacy Pedido OP plan phase statuses`). Docs-only — no code, runtime, test, SQL, migration, Supabase, MCP, staging, production or Vercel accessed/changed. The current HEAD must be consulted with `git rev-parse HEAD`.
- **Fix:** the current status lines of legacy Phases D–J were reconciled in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §9 and `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` §5.
- **Mandatory routing for the next agent:** legacy Phases **D, E, F** were **delivered** through the accepted production-flow work and must **not** be routed as open implementation phases. Legacy Phases **G, H, I** were **superseded** by the canonical G28 documentation pipeline (`document_link_revisions`/`document_link_revision_ops`; `documentos_operacionais` never created) and also must **not** be routed as open phases. **Phase J** remains exclusively as `FUTURE / UNSEQUENCED / NOT STARTED / NOT AUTHORIZED`.
- **State unchanged:** `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pending explicit architect selection. All open debts and deferred fronts remain unchanged (`DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`, production application of the staging-only stack, `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, G28-D/Vercel, `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2/3/4`).
- **Accesses:** no staging; no production (`bhgifjrfagkzubpyqpew` not accessed); no Supabase/MCP; no Vercel; no push.
- **Full detail:** `PROJECT_STATE.md` (section "Canonical Documentation — Status Consistency of the Legacy Pedido↔OP Plans") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  Every future chat or agent must relay these nine paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Architect Decision — Publication Criterion and Candidate Fronts — G28-GOVERNANCE-CONSOLIDATION-A — CLOSED / ACCEPTED

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

- **Phase:** `G28-GOVERNANCE-CONSOLIDATION-A`. **Documentation commit:** this record (`Consolidate supervision protocol and register publication criteria`). Docs-only — no code, test, SQL, migration, Supabase, staging, production or Vercel accessed/changed. The current HEAD must be consulted with `git rev-parse HEAD`.
- **Supervision protocol:** `docs/governance/SUPERVISION_PROTOCOL.md` received an appendix "Supervision handoff — standard block" (verbatim text from the architect, to open any new reviewer/supervisor session) and now requires a `STRUCTURAL POLICY COMPLIANCE` section in the report format of every implementation phase (applicable rules of `docs/architecture/CODE_HEALTH_RULES.md` cited + evidence + line size of the touched files).
- **Candidate fronts recorded in `PROJECT_STATE.md`:** `CODE-HEALTH-AUDIT-§18-R1` (read-only post-Camada 2 audit, §18 of `CODE_HEALTH_RULES.md`, input for the incremental decomposition of `cadastros.js` and triage of test debts) — `NOT AUTHORIZED`; `PUBLICATION-TRACK-REVIEW` (staging-only boundary + `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` + G28-D + production application of the staging-only migrations + `DELETE-PROD-GUARD-A`) — `NOT AUTHORIZED / CONDITIONED`.
- **Binding architect decision — publication criterion (2026-07-15):** the system only enters production after `G28-CAMADA-2` (full scope `A1-A7`) and `G28-CAMADA-3` (automatic backup) are both `CLOSED / ACCEPTED` in staging. `PUBLICATION-TRACK-REVIEW` is conditioned on that criterion, is not a current candidate even after reconciliation of the general backlog. The `STAGING-ONLY-EXECUTION-BOUNDARY-A` boundary remains in force unchanged.
- **Recorded consequence:** `G28-CAMADA-3` moves from a deferred front to `PUBLICATION CRITICAL PATH` (after `G28-CAMADA-2`), pending its own spec; the `BK1-BK8` diagnosis is a future phase, `NOT AUTHORIZED` by this record.
- **Not changed:** no code, test, SQL, migration, runtime touched; no subphase of `G28-CAMADA-2`/`G28-CAMADA-3` authorized; `STAGING-ONLY-EXECUTION-BOUNDARY-A` not rewritten, only referenced as unchanged.
- **Accesses:** no staging; no production (`bhgifjrfagkzubpyqpew` not accessed); no Supabase/MCP; no Vercel; no push.
- **Final worktree state:** clean; selective staging by literal path; zero untracked after the commit.
- **Next authorizable action:** unchanged — `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` among `A4.1`, `A2.1`, `A6.1` of `G28-CAMADA-2` (see their own sections above). This record does not authorize any subphase.
- **Full detail:** `PROJECT_STATE.md` (section "Architect Decision — Publication Criterion and Candidate Fronts") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (work on `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (order format, gates, standard supervision handoff block)
  Every future chat or agent must relay these eleven paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Camada 2 — Temporary Password and Last Access Read Model — A4.1 + CAMADA2-LAST-ACCESS-RPC — CLOSED / ACCEPTED

- **Technical commits:** `bf0d522` — `Add temporary password schema and last sign-in read model` (`db/58_admin_usuarios_senha_temporaria.sql`, `db/59_admin_last_sign_in_readmodel.sql`, `supabase/functions/admin-create-user/index.ts`, `supabase/functions/admin-create-user/README.md`, 4 new/extended smoke tests); `c6289f8` — `Add password-policy E2E verification runner for admin-create-user` (`scripts/staging/admin-create-user-password-policy-e2e.mjs`, `docs/DOCUMENTATION_INDEX.md`).
- **Documentation commit:** this closeout (`Close temporary password schema phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Schema/RPC applied and verified in staging (`ucrjtfswnfdlxwtmxnoo`), via Supabase MCP:** `db/58` (record `20260716014338`) adds `usuarios.senha_temporaria`/`usuarios.senha_gerada_em`, with no retroactive effect on the 10 existing users; `db/59` (record `20260716014358`) creates `public.admin_usuarios_last_sign_in()` — `SECURITY DEFINER`/`STABLE`, `is_admin()` guard, exposes only `id`+`last_sign_in_at`, `authenticated`-only grants. Empirical role matrix confirmed: `anon` → `42501` (ACL); non-admin `authenticated` → `42501` (business, `RAISE EXCEPTION`); admin → `ok`.
- **Edge Function `admin-create-user`:** password policy 6→8 characters + ≥1 digit; the insert now sets `senha_temporaria=true`/`senha_gerada_em=now()`.
- **Staging deploy executed by the architect** (outside the credential reach of this session — the AI agent does not enter password/token/API key into any field, a permanent rule that cannot be bypassed by authorization).
- **Post-deploy verification — real E2E in staging, `result: PASS` (9/9), executed by the architect** via `scripts/staging/admin-create-user-password-policy-e2e.mjs`: 7 chars rejected (length); 8 chars without a digit rejected (digit); valid password accepted with `senha_temporaria=true`/`senha_gerada_em` filled, confirmed via REST; cleanup via `admin-delete-user` with zero cleanup confirmed.
- **Local tests:** 4 new/extended smoke suites totaling 71/71 (schema db/58, RPC db/59, `admin-create-user` password policy, extended `db/` allow-list); regression `tests/admin-*.smoke.js` + `boot.smoke.js` 263/263 with no regression. `git diff --check` clean.
- **Documentation corrected:** `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (outdated password policy → 8+digit, note on `senha_temporaria`/mandatory future change in `A4.2`); `docs/DOCUMENTATION_INDEX.md` (entries for `db/58`/`db/59` + classification of the E2E runner as verification tooling, same treatment as `admin-disable-user-e2e.mjs`).
- **Not implemented (out of scope):** consumption of the RPC in the UI (the "Último acesso" column); `A4.2` (boot guard + mandatory change screen); `A4.3` (`NOT AUTHORIZED`).
- **Accesses:** Supabase MCP used to apply/verify the two migrations in staging; production (`bhgifjrfagkzubpyqpew`) not accessed; no push.
- **Final worktree state:** clean; staging empty; zero untracked (`supabase/.temp/` is a local untracked cache of the Supabase CLI, generated by the architect's action).
- **Next authorizable action:** `ARCHITECT DECISION` — candidates: micro-phase to consume the `db/59` RPC in the UI (the "Último acesso" column in `js/screens/admin-usuarios.js`, under a mockup gate if it involves a new visual element); `A4.2` (boot guard + mandatory change screen, visual gate); `A2.1`/`A6.1` of `G28-CAMADA-2` remain candidates with no unambiguous priority. This entry does not authorize its execution.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — Temporary Password and Last Access Read Model") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (work on `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (order format, gates, standard supervision handoff block)
  Every future chat or agent must relay these eleven paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Camada 2 — Mandatory Password Change Guard — A4.2 — CLOSED / ACCEPTED

- **Technical commit:** `6c624ef` — `Add mandatory password change gate` (`js/auth.js`, `js/boot.js`, `js/trocar-senha-writes.js` (new), `js/screens/trocar-senha-obrigatoria.js` (new), `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (new, tooling), `index.html`, `tests/auth.smoke.js`, `tests/boot.smoke.js`, `tests/trocar-senha-obrigatoria.smoke.js` (new)). **Documentation commit:** this closeout (`Close mandatory password change phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Hard stop resolved (Option A, explicit architect decision):** `js/auth.js` extends only the `select` of `loadCurrentUser()` (`+senha_temporaria, +senha_gerada_em`) — no other line touched, §11 preserved. The guard lives entirely in `js/boot.js` (`isSenhaTemporariaExpirada`, `guardedHandleRoute`) without touching `js/router.js`.
- **RLS/grants verified in staging before coding:** `usuarios_self_update` + `authenticated` with `UPDATE` on `senha_temporaria`/`senha_gerada_em` — self-update works without a new policy.
- **Self-service write (`js/trocar-senha-writes.js`):** `trocarSenhaObrigatoria(userId, novaSenha)` — `auth.updateUser({password})` + `UPDATE usuarios SET senha_temporaria=false`; `{ok:false, stage:'auth'|'flag'}` reports partial state explicitly.
- **Screen (`js/screens/trocar-senha-obrigatoria.js`, 243 lines):** shell-less card, live checklist (8+ characters / 1 digit / passwords match), button enabled only with the 3 criteria, eye toggle, "Sair da conta"; `expired` mode (>7 days) without fields. Mockup approved by the architect on 2026-07-16.
- **Tests:** `tests/trocar-senha-obrigatoria.smoke.js` (new) 14/14; `tests/boot.smoke.js` extended 44/44 (13 new, incl. integration via real `main()`); `tests/auth.smoke.js` extended 37/43 (3 new + 1 corrected; the 6 that fail are pre-existing debt confirmed via `git stash`, not from this phase). `git diff --check` clean.
- **Verification without credentials (local preview):** the real screen rendered via a diagnostic overlay — the checklist reacts to keystrokes with correct computed colors, the button disables/enables, the eye toggle confirmed, `expired` mode without fields. Console without errors.
- **Authenticated leg validation — CONFIRMED BY THE ARCHITECT (manual validation in staging `ucrjtfswnfdlxwtmxnoo`):** synthetic user created through the new flow, gate shown at first login, checklist reacted, change performed, `senha_temporaria` zeroed, second login entered directly without a gate. Test user removed. Equivalent automated runner (`scripts/staging/trocar-senha-obrigatoria-e2e.mjs`) created for future re-execution — not executed in this phase (login with a real password is an exclusively human action, never the AI agent's, a permanent rule).
- **Debt recorded (candidate for `CODE-HEALTH-AUDIT-§18-R1`):** the 6 pre-existing tests in `tests/auth.smoke.js` with an outdated `<script src="js/auth.js">` regex (not accounting for `?v=`) — not fixed here, out of scope.
- **Documentation continuity debt — RESOLVED on 2026-07-16:** the micro-phase `CAMADA2-LAST-ACCESS-UI` (technical commit `0aff22f` — `Add last sign-in column to user admin`) had its implementation report delivered (`AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`) but the session proceeded directly to `A4.2` without an explicit `OK` or a closeout order for that micro-phase specifically. The architect confirmed the visual validation and authorized the formal closeout together with the authorization of `A5.1-A5.2` — see the section "Camada 2 — Last Access RPC Consumption in the UI — CAMADA2-LAST-ACCESS-UI" below.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked (`supabase/.temp/` pre-existing, not from this session).
- **Next authorizable action:** `ARCHITECT DECISION` among `A2.1` (schema `nivel_acesso`), `A6.1` (audit schema/trigger) and `A5.1-A5.2` (admin password reset). This entry does not authorize its execution.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — Mandatory Password Change Guard — A4.2") and `docs/ledgers/G28_LEDGER.md` (append-only entry).
- **Mandatory documentation continuity — relay in every future handoff:**
  1. `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  2. `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  3. `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  4. `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  5. `PROJECT_STATE.md`
  6. `AGENT_HANDOFF.md`
  7. `docs/ledgers/G28_LEDGER.md`
  8. `docs/DOCUMENTATION_INDEX.md`
  9. `docs/governance/DOCUMENTATION_MODEL.md`
  10. `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md` (work on `G28-CAMADA-2`)
  11. `docs/governance/SUPERVISION_PROTOCOL.md` (order format, gates, standard supervision handoff block)
  Every future chat or agent must relay these eleven paths and expressly instruct the next continuity to relay them again. The continuity chain of the plan and of the backlog cannot be interrupted.

## Camada 2 — Last Access RPC Consumption in the UI — CAMADA2-LAST-ACCESS-UI — CLOSED / ACCEPTED

- **Technical commit:** `0aff22f` — `Add last sign-in column to user admin` (`js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `tests/admin-usuarios.smoke.js`). **Documentation commit:** this closeout (`Close last sign-in column phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Scope:** `fetchLastSignIn()` (one call per `reload()`, client-side merge by `id`) + "ULTIMO ACESSO" column in the grid (`dd/mm/aaaa hh:mm`; `"—"` for null) + "Último acesso" sorting (most recent first, nulls last) + fail-closed in case of RPC failure (entire column `"—"` + `console.warn`, the list stays visible).
- **Tests:** `tests/admin-usuarios.smoke.js` extended 23/23; regression `boot`+`cadastros-screens`+`admin-*` 298/298. `git diff --check` clean.
- **Visual validation — CONFIRMED BY THE ARCHITECT on 2026-07-16 (local preview, staging `ucrjtfswnfdlxwtmxnoo`):** column populated with real data, correct format, `"—"` for the never-logged-in, sorting with nulls last.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked (`supabase/.temp/` pre-existing, not from this session).
- **Next authorizable action:** already superseded — `A5.1-A5.2` authorized and in progress; see its own section.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — Last Access RPC Consumption in the UI") and `docs/ledgers/G28_LEDGER.md` (append-only entry).

## Camada 2 — Administrative Password Reset — A5.1-A5.2 — CLOSED / ACCEPTED

- **Technical commit:** `b726717` — `Add admin password reset` (`supabase/functions/admin-reset-user-password/index.ts` (new), `supabase/functions/admin-reset-user-password/README.md` (new), `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`, `js/screens/admin-usuarios-modal.js`, `scripts/staging/admin-reset-password-e2e.mjs` (new), `tests/admin-reset-user-password.smoke.js` (new), `tests/admin-usuarios.smoke.js`). **Documentation commit:** this closeout (`Close admin password reset phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Architect decision — self-reset BLOCKED:** an admin cannot reset their own password (`SELF_RESET_FORBIDDEN`) — they use the normal change flow (self-service, `A4.2`). No "last admin" guard (resetting a password deactivates no one).
- **Edge Function `admin-reset-user-password`:** mirror of `admin-disable-user`; temporary password via `crypto.getRandomValues` (12 chars, no visual ambiguity, ≥1 digit guaranteed); `auth.admin.updateUserById(target, {password})`; marks `senha_temporaria=true`/`senha_gerada_em=now()`; never logs the password; returns the password a single time. A post-reset failure in the profile update (with no safe compensation possible) returns an explicit error (`PROFILE_UPDATE_FAILED`).
- **UI:** key-icon button → `confirmDialog` (never `window.confirm`) → success: "Senha gerada" modal (password shown once, copy button, non-re-display warning). Error → toast, no ambiguous state.
- **Staging deploy executed by the architect** (outside the credential reach of this session, a permanent rule).
- **Post-deploy verification — real E2E in staging, `result: PASS` (15/15), executed by the architect** via `scripts/staging/admin-reset-password-e2e.mjs` (`test_user_id 170f8479-e2da-4a6d-b597-080716be9c20`): guards `SELF_RESET_FORBIDDEN`/`NOT_FOUND`; real reset with flag+timestamp updated; old password invalidated; login with the new temporary one confirms `senha_temporaria=true`; `A4.2` self-service chained (new change + flag zeroed); relogin without a gate; zero cleanup.
- **Tests:** `tests/admin-reset-user-password.smoke.js` (new) 23/23; `tests/admin-usuarios.smoke.js` extended 29/29 (6 new); consolidated regression 268/275 (7 = pre-existing debt confirmed, none new). `git diff --check` clean.
- **Architect visual validation — WAIVED BY EXPLICIT DECISION**, covered by the combination of e2e `PASS` + flow verification in a real browser by the executor (button → `confirmDialog` → password modal with single display/copy/warning; self-reset guard confirmed with real `.disabled` values in the DOM).
- **Finding recorded — candidate `UI-EL-BOOLEAN-ATTR-FIX` (`NOT AUTHORIZED`, severity `NOT CONFIRMED`):** `js/ui.js`'s `el()` does not handle a boolean in `setAttribute` — potentially affects the Deactivate/Delete buttons in `admin-usuarios.js` (same root cause as the residue already fixed in `expedicao-admin.js`). Treat as a potential active regression until the architect verifies it directly in staging. Not fixed (outside the `A5.1-A5.2` manifest).
- **Finding recorded — decomposition candidate (`CODE-HEALTH-AUDIT-§18-R1`):** `js/screens/admin-usuarios-modal.js` at 576 lines (above the acceptable 500) after accommodating the 4th modal.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Final worktree state:** clean; staging empty; zero untracked (`supabase/.temp/` pre-existing, not from this session).
- **Next authorizable action:** `ARCHITECT DECISION` among `A5.3-A5.4` (reactivation), `UI-EL-BOOLEAN-ATTR-FIX`, `A2.1` (access level) and `A6.1` (audit). This entry does not authorize its execution.
- **Full detail:** `PROJECT_STATE.md` (section "Camada 2 — Administrative Password Reset — A5.1-A5.2") and `docs/ledgers/G28_LEDGER.md` (append-only entry).

# HANDOFF HISTORY — ARCHIVED

The complete historical content of the previous handoffs was preserved,
byte for byte, in:

`docs/legacy/pre-model/AGENT_HANDOFF_FULL_SNAPSHOT.md`

Integrity manifest:

`docs/legacy/pre-model/MANIFEST.md`

Snapshot origin commit:

`08b9af5e251de48e938600e5e4b4214e4d1e824e`

SHA-256 of the complete snapshot:

`386810890675714527fc349fa29ddab3fe977dd80c0b270899a7b1a2b3a24b4d`

The snapshot is exclusively historical. It does not represent the active handoff,
must not be edited and must not receive new closeouts.

This section must not accumulate new historical content.
