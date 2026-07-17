# CANONICAL CURRENT STATE

This file is the single source of the **current** operational state per front:
active phase, next authorizable action, binding decisions in force, live debts,
environment facts and an index of closed phases. It does **not** hold historical
closeout narratives — those were moved by `PROJECT-STATE-COMPACTION-A`
(2026-07-16) to `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`, verbatim and
in their original order, and are indexed under "Closed phases" below.

HEAD, working tree, staging and divergence must be consulted directly in Git
(`git rev-parse HEAD`, `git status --short --untracked-files=all`).

## Active phase and next action

- **Active functional phase:** `NONE`.
- **Next authorizable action:** `ARCHITECT DECISION`. `A5.3-A5.4` (user
  reactivation) is `CLOSED / ACCEPTED` — see "Closed phases" below; the `A5`
  track (reset + reactivation) is now `COMPLETE`. `A6.1` (audit schema/trigger)
  is now `CLOSED / ACCEPTED` — see "Closed phases" below; `A6.2` (Edge Function
  wiring) and `A6.3` (read-only UI panel) remain `NOT AUTHORIZED`. No single,
  unambiguous technical candidate for the current staging cycle. Candidates on
  the table (none authorized by this file): `UI-EL-BOOLEAN-ATTR-FIX` (severity
  `CONFIRMED — ACTIVE REGRESSION`, empirically reproduced by the architect in
  staging via the "Mostrar inativos" checkbox in `js/screens/admin-usuarios.js`
  — recommended as the priority candidate); `A2.1` (schema `nivel_acesso`);
  `A6.2` (Edge Function wiring of `usuarios_eventos`); `DOC-LANGUAGE-MIGRATION-L3`
  (`NOT AUTHORIZED` pending `PROJECT-STATE-COMPACTION-A`). `A3.4` (legacy code
  removal in `cadastros.js`) unlocks once the remaining `A2`/`A6` subphases
  close.
- **Open architect decisions:** `NONE` blocking the current staging cycle. Two
  non-blocking naming/consistency points from `DOC-LANGUAGE-MIGRATION-L2` were
  ruled on and applied (documentation-term unification; phase-ID naming rule).
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`.
  **Branch:** `work/g28-document-qualification`. **Allowed remote:** none — no
  push without express authorization in this chain.

## Binding decisions in force

Condensed statements of the rulings that constrain future work. Full recorded
decisions (verbatim) are in `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`
(Architect Decision sections) and in `docs/archive/pt-BR/PROJECT_STATE.md`.

- **Staging-only execution boundary (`STAGING-ONLY-EXECUTION-BOUNDARY-A`,
  2026-07-15):** the current operational environment is exclusively the staging
  Supabase `ucrjtfswnfdlxwtmxnoo`; the protected/other project
  `bhgifjrfagkzubpyqpew` is `OUT OF SCOPE` and must not be accessed; production
  schema migration/promotion is postponed until the full canonical backlog is
  complete. Current-cycle policy: (1) implement/validate the remaining backlog
  only against staging; (2) do not access the protected project; (3) do not
  plan/prepare/simulate/execute production migrations; (4) do not let the
  missing production mapping block staging work; (5) do not authorize G28-D
  publication; (6) revisit migration/publication only after the backlog is
  reconciled and completed; (7) Vercel may be evaluated later, not selected now.
- **Publication criterion (`G28-GOVERNANCE-CONSOLIDATION-A`, 2026-07-15,
  binding):** the system enters production only after **both** `G28-CAMADA-2`
  (full scope `A1-A7`) and `G28-CAMADA-3` (automated backup) are
  `CLOSED / ACCEPTED` in staging. `PUBLICATION-TRACK-REVIEW` is `CONDITIONED` on
  this criterion and is not a current candidate.
- **`G28-CAMADA-3`:** reclassified from `DEFERRED` to `PUBLICATION CRITICAL PATH`
  (after `G28-CAMADA-2`), pending its own spec; the `BK1-BK8` diagnosis is a
  future phase, `NOT AUTHORIZED`.
- **`G28-CAMADA-2` classification (`G28-RECONCILIATION-DECISIONS-A`,
  2026-07-15):** `PRE-EXISTING PARTIAL CAPABILITY` (user CRUD, disable/ban,
  single role `usuarios.tipo`, client/supplier link) `+ FULL SCOPE A1-A7
  DEFERRED`; `NOT ACCEPTED AS A DEDICATED PHASE`. Functional/visual reference
  for the full scope, when authorized: `D:\OneDrive\Programação\SGAA_clean_baseline`.
- **`G28-C`:** `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION
  PENDING` (technical/staging acceptance separated from the architect's
  functional validation and the authenticated browser smoke, never executed).
  `G28-B8` is `TECHNICALLY COMPLETED / ACCEPTANCE SUBSUMED BY G28-C`.
- **`PROJECT-CONTROL-BASELINE-R1` (ChatGPT):** `REJECTED / NOT RATIFIED`;
  its correction `CANCELLED / ABSORBED / SUPERSEDED` by
  `BACKLOG-RECONCILIATION-READONLY-R1` (the adopted reference baseline).
- **Supervision governance:** progress/continuity/scope/authorizations/phases/
  documentation are held by Claude (chat) + Claude Code (resident); ChatGPT is
  a process consultant **without state custody and without authority to issue
  orders**. The supervision protocol (`docs/governance/SUPERVISION_PROTOCOL.md`)
  requires a `STRUCTURAL POLICY COMPLIANCE` section in every implementation
  phase report.
- **Admin password auto-reset BLOCKED (`A5.1-A5.2`):** an admin cannot reset
  their own password (`SELF_RESET_FORBIDDEN`) — they use the normal self-service
  change flow (`A4.2`).
- **`UI-EL-BOOLEAN-ATTR-FIX` — CONFIRMED as an active regression (`A5.3-A5.4`
  closeout, 2026-07-16):** `js/ui.js`'s `el()` calls `setAttribute(k, v)`
  unconditionally, including for boolean attrs (`disabled`, `checked`) — the
  attribute's mere presence makes it true in a real browser regardless of the
  string value, so `setAttribute('checked', false)`/`setAttribute('disabled',
  false)` still render as checked/disabled. The architect reproduced this live
  in staging via the "Mostrar inativos" checkbox in
  `js/screens/admin-usuarios.js` (`checked: mostrarInativos` passed
  unconditionally): the checkbox always renders checked after each re-render
  regardless of the actual toggle state, making inactive users effectively
  undiscoverable through that control. The `A5.3-A5.4` rewrite of the
  Desativar/Reativar button incidentally dropped the vulnerable `disabled:
  <boolean>` pattern for that one control (confirmed working by the architect),
  but the Excluir button in the same file (`disabled: !!(meId && user.id ===
  meId)`) still carries the identical pattern and is unconfirmed but suspect.
  Same root cause as the residue already fixed once in `expedicao-admin.js`.
  Not fixed in this phase (outside every manifest to date) — recommended as
  the priority `ARCHITECT DECISION` candidate.
- **Controlled Delete × document history:** physical deletion of Pedido/OP is
  blocked when canonical document history exists (`document_link_revisions`/
  `document_link_revision_ops`, append-only, never deleted); the permanent
  contract is recorded in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`.
- **Language policy:** English for canonical state documents, reports and new
  code/comments/commit messages; pt-BR for user-facing UI text; architect orders
  may be issued in Portuguese but are recorded in English in the canonical
  documents (original wording preserved in the ledger or archive); phase IDs and
  their embedded terms (e.g. `Camada N` ↔ `G28-CAMADA-N`) are never translated.
  Homes: `docs/governance/DOCUMENTATION_MODEL.md` §18,
  `docs/architecture/CODE_HEALTH_RULES.md` §19,
  `docs/governance/SUPERVISION_PROTOCOL.md` §3; `CLAUDE.md` pointer-summary.

## Live debts and candidates

- **`NOT AUTHORIZED` candidate fronts:** `CODE-HEALTH-AUDIT-§18-R1` (read-only
  §18 audit; input for `cadastros.js` decomposition and baseline test-debt
  triage); `PUBLICATION-TRACK-REVIEW` (conditioned on the publication
  criterion); `UI-EL-BOOLEAN-ATTR-FIX` (severity `CONFIRMED — ACTIVE
  REGRESSION`, not yet fixed — see "Binding decisions in force" note below);
  `G28-D` publication (`DEFERRED / NOT AUTHORIZED / NOT A CURRENT BLOCKER`);
  `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` (`DEFERRED UNTIL
  GLOBAL BACKLOG COMPLETION`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`;
  `G28-CAMADA-4`. `A4.3` (email/SMTP invites) remains `NOT AUTHORIZED`.
- **Open non-blocking debts:** `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` /
  `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` (G28-C/D/B7/Client Portal);
  `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (object applied+verified in
  staging, no drift; no history row fabricated); production application of the
  staging-only stack (`db/12`, `db/21`, `db/30`, `db/49`–`db/57`); 6 tests in
  `tests/auth.smoke.js` with an outdated `<script src="js/auth.js">` regex
  (candidate for `CODE-HEALTH-AUDIT-§18-R1`); `js/screens/admin-usuarios-modal.js`
  at 576 lines (decomposition candidate).
- **Documentation candidate:** review of the legacy `docs/AI_AGENT_RULES.md`
  (partially legacy; contains stale counts/context — not authorized, not
  started).
- **`UI-ACTION-BUTTON` track:** phase `i` (contract amendment —
  `docs/architecture/UI_VISUAL_CONTRACT.md` §8.1 row-level compact icon
  button carve-out, ratified values) `CLOSED / ACCEPTED` (commit
  `f30aa0d`). Phase `ii` (`actionButton()` helper in `js/ui.js`,
  additive, zero screens migrated) `CLOSED / ACCEPTED` (commit
  `bbfd58c`). Phase `iii` lot `1` (`UI-ACTION-BUTTON-MIGRATION-1` —
  `pedidos-list.js` + `cliente-pedidos-list.js`) `CLOSED / ACCEPTED`
  (commit `31b66af`; architect visual validation confirmed both
  `#/pedidos` and `#/cliente/pedidos` against the Clients reference).
  Two judgments ratified at this closeout, standing for all remaining
  lots: existing domain-specific confirmation flows (e.g.
  `excluirPedidoComFluxo`'s `showDeleteConfirmation`) satisfy the §8.1
  destructive guard without a redundant `confirmDialog` wrapper; §8.1
  dimension/sr-only/disabled correctness is proven once at the
  `actionButton()` primitive level, screen-level tests assert call-site
  routing only. Phase `iii` lot `2` (`UI-ACTION-BUTTON-MIGRATION-2` —
  `admin-usuarios.js` users screen + `ops-list.js`) `CLOSED / ACCEPTED`
  (commit `abfb95e`; architect visual validation confirmed the users
  screen against the Clients reference — the original complaint's own
  test — plus a spot-check of `#/ops`). Includes the `ops-list.js`
  sr-only `display:none` a11y fix (now the correct clip-rect pattern)
  and the users-screen ACOES column-width fix from the architect's
  addendum: the column was hardcoded `102px` but 4 `actionButton()`s
  need `30×4 + 6×3 = 138px` — widened via the one grid-template value.
  `ops-list.js`'s Excluir OP also gained `danger` (red) styling,
  matching every other Excluir action (was neutral gray before).
  Separate follow-up `UI-USERS-GRID-TEXT-OVERFLOW` (users grid text
  cells — E-MAIL/NOME/FORNECEDOR/CLIENTE — single-line ellipsis +
  `title` tooltip; E-MAIL widened `1.3fr`→`2fr`) `CLOSED / ACCEPTED`
  (commit `3e95e86`). Any further lot beyond `2` (`cadastros.js`, lot
  `3`) — `NOT AUTHORIZED`, pending its own order. Registered
  candidates, not started:
  `MODAL-BUTTON-CSS-CHECK` (read-only —
  `document-link-admin-modal.js`/`documentos-recebidos-decision-modal.js`
  render buttons with no inline style, deferred to external CSS classes
  not found in the repo); `fornecedor.js` visual redesign (separate
  future track, out of this one).
- **`UI-GRID-TEXT-OVERFLOW` track:** contract amendment (`UI_VISUAL_CONTRACT.md`
  §7.1, grid/list text-cell overflow rule — variable-length identifier-style
  fields single-line ellipsis + `title` tooltip, explicitly exempting
  free-text notes/badges/dates/numerics) `CLOSED / ACCEPTED` (docs-only).
  Helper promotion (`truncatedCell`/`TRUNCATE_CELL_STYLE` → `js/ui.js`,
  `admin-usuarios.js` migrated to the shared version, behavior-neutral)
  `CLOSED / ACCEPTED`. Lot A (`cadastros.js` Clientes NOME/CONTATO +
  Fornecedores NOME/EMAIL, legacy Usuarios duplicate explicitly excluded)
  `CLOSED / ACCEPTED` (commit `0a1457b`; Fornecedores EMAIL widened
  `1fr`→`1.6fr`, Clientes fractions unchanged; architect visual gate
  `CONFIRMED` — nome/email conformant on both grids). Lot B
  (`pedidos-list.js` / `ops-list.js` CLIENTE column) and Lot C
  (`painel.js` `.rv-adm-ref`/`.rv-adm-mini`) `CLOSED / ACCEPTED`
  (commit `cfa8b4b`; no width change on either grid — both already had
  a horizontal-scroll fallback, judged not visibly starved; architect
  visual gate pending). This closes the `UI-GRID-TEXT-OVERFLOW` track's
  authorized scope; remaining candidates (`UI-FIXED-FORMAT-COLUMN-
  WIDTHS`, `UI-DOCUMENTOS-RECEBIDOS-LAYOUT-FIX`) are separate fronts,
  `NOT AUTHORIZED`, registered below.
  **Finding registered:** the read-only diagnosis found the legacy
  `screenCadastrosUsuarios` duplicate in `cadastros.js` (lines ~2226-2381)
  carries the identical unconstrained-text-cell defect (NOME/FORNECEDOR/
  CLIENTE, no ellipsis/tooltip) that this fix track deliberately excludes
  from scope — the architect ruled it out of Lot A because the route
  already points to `admin-usuarios.js` since `A3.1`, making this screen
  dead code pending removal. This confirms `A3.4` (legacy code removal in
  `cadastros.js`) is overdue: live defects are accumulating in code no
  longer reachable by routing but not yet deleted.
  **New findings from the Lot A architect visual gate (`NOT AUTHORIZED`
  candidates, registered per architect instruction):**
  1. `UI-FIXED-FORMAT-COLUMN-WIDTHS` — the Fornecedores grid's CNPJ
     column (`110px`) wraps an 18-char formatted CNPJ. The diagnosis
     correctly classified fixed-format fields (CNPJ, dates, numerics) as
     not overflow-prone (§7.1 does not apply — a CNPJ must never be
     truncated), but did not check column width against actual content
     length. This is a §7 golden-rule sizing defect, not a §7.1
     truncation gap. Candidate scope: audit every fixed-format column
     (CNPJ, CPF, dates, phone) app-wide for wrap, size to content.
  2. `UI-DOCUMENTOS-RECEBIDOS-LAYOUT-FIX` — **HIGH SEVERITY.** `CLOSED /
     ACCEPTED` (commit `90726dd`). Read-only diagnosis
     (`UI-DOCUMENTOS-RECEBIDOS-LAYOUT-DIAGNOSIS`) found the mechanism:
     `pedidoCell()` rendered `doc.pedido` (a raw, unbounded identifier)
     as a direct flex item with only `white-space:nowrap` — its
     automatic min-content width was never capped, so long tokens
     painted past the PEDIDO column into DATAS; `buildActionButtons()`'s
     `wrap` div could hold both the source-file-unavailable label and up
     to 3 decision icon buttons (two independently-gated branches) with
     no `flex-wrap`, overflowing the fixed 148px AÇÕES column. Fix:
     `pedidoCell()` (both branches) and the defensive `stateSpan()`
     gained the full §7.1 bundle (`overflow:hidden;text-overflow:
     ellipsis;min-width:0`) plus a `title` tooltip on the linked branch;
     `buildActionButtons()`'s `wrap` gained `flex-wrap:wrap` (a §7
     column-sizing fix, not truncation — nothing there should ever be
     cut). Architect visual gate: `CONFIRMED`.
  3. `TEST-MOCK-FIDELITY-AUDIT` — suites that hand-mock `js/ui.js`
     primitives instead of loading the real module are structurally
     blind to primitive-level defects. Precedent: the
     `UI-EL-BOOLEAN-ATTR-FIX` regression class, and this chain's own
     `tests/direct-cnpj-screens.smoke.js`, whose hand-rolled mock had no
     `truncatedCell` stand-in and broke silently-invisible (would have
     stayed green with a stale/wrong mock had the gap not surfaced as an
     immediate crash) until patched during `UI-GRID-TEXT-LOT-A`.
     Candidate scope: inventory every test file that hand-mocks `ui.js`
     primitives rather than loading the real source, assess drift risk.

## Environment and worktree standing facts

- **Staging Supabase:** `ucrjtfswnfdlxwtmxnoo` (authorized). **Protected/other:**
  `bhgifjrfagkzubpyqpew` (`OUT OF SCOPE`, never accessed).
- **Migrations 49 and 50:** applied and verified in staging; not applied in
  production by this chain. The staging-only stack is not applied in production.
- **Worktree `work/app-next`:** divergent from `staging/work/app-next` and
  dirty; hygiene authorized only as a read-only parallel task in a separate
  order.
- **Publication provider:** not selected (Vercel a future candidate only).
- **Push:** not authorized in this chain. **Production:** never accessed.
- **`supabase/.temp/`:** local untracked Supabase CLI cache; not part of any
  commit.

## Closed phases

Full closeout narratives are archived, verbatim, in
`docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md` (same order as below; the
phase title matches the archived section heading). Commit SHAs are the accepted
technical commits; documentation-only phases show `(docs)`. Consult the current
HEAD with `git rev-parse HEAD`.

| Phase | Status | Date | Commit(s) |
|---|---|---|---|
| Camada 2 — User Audit Trail Schema + Trigger — `A6.1` | `CLOSED / ACCEPTED` | 2026-07-16 | `ee0e77b` |
| Users Grid — Text Overflow Ellipsis — `UI-USERS-GRID-TEXT-OVERFLOW` | `CLOSED / ACCEPTED` | 2026-07-16 | `3e95e86` |
| UI Action Button — Users and Ops Screens Migration — `UI-ACTION-BUTTON-MIGRATION-2` (phase iii, lot 2) | `CLOSED / ACCEPTED` | 2026-07-16 | `abfb95e` |
| UI Action Button — Order Lists Migration — `UI-ACTION-BUTTON-MIGRATION-1` (phase iii, lot 1) | `CLOSED / ACCEPTED` | 2026-07-16 | `31b66af` |
| UI Action Button — Helper Primitive — `UI-ACTION-BUTTON-HELPER` (phase ii) | `CLOSED / ACCEPTED` | 2026-07-16 | `bbfd58c` |
| UI Visual Contract — Row-Level Icon Button Amendment — `UI-ACTION-BUTTON-CONTRACT-AMENDMENT` (phase i) | `CLOSED / ACCEPTED` | 2026-07-16 | (docs) |
| `DOC-LANGUAGE-MIGRATION-L1` — Governance documents translated to English | `CLOSED / ACCEPTED` | 2026-07-16 | `cab741c`, `ce4b693` |
| Camada 2 — Administrative Password Reset — `A5.1-A5.2` | `CLOSED / ACCEPTED` | 2026-07-16 | `b726717` |
| Camada 2 — User Reactivation — `A5.3-A5.4` | `CLOSED / ACCEPTED` | 2026-07-16 | `f886e26` |
| Camada 2 — Last Access RPC Consumption in the UI — `CAMADA2-LAST-ACCESS-UI` | `CLOSED / ACCEPTED` | 2026-07-16 | `0aff22f` |
| Camada 2 — Mandatory Password Change Guard — `A4.2` | `CLOSED / ACCEPTED` | 2026-07-16 | `6c624ef` |
| Camada 2 — Temporary Password and Last Access Read Model — `A4.1 + CAMADA2-LAST-ACCESS-RPC` | `CLOSED / ACCEPTED` | 2026-07-16 | `bf0d522`, `c6289f8` |
| Architect Decision — Publication Criterion and Candidate Fronts — `G28-GOVERNANCE-CONSOLIDATION-A` | `CLOSED / ACCEPTED` | 2026-07-15 | (docs) |
| Architect Decision — Staging-Only Execution Boundary — `STAGING-ONLY-EXECUTION-BOUNDARY-A` | recorded | 2026-07-15 | (docs) |
| Architect Decision — Backlog Reconciliation and Supervision Governance — `G28-RECONCILIATION-DECISIONS-A` | recorded | 2026-07-15 | (docs) |
| Camada 2 — User Administration — Proposed Spec — `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1` | `PROPOSED` | 2026-07-15 | (docs) |
| Camada 2 — User Screen Extraction — `CAMADA2-USUARIOS-A3-1` | `CLOSED / ACCEPTED` | 2026-07-15 | `4f01101` |
| Camada 2 — Summary Cards and Toolbar — `CAMADA2-USUARIOS-A3-2` | `CLOSED / ACCEPTED` | 2026-07-15 | `b4a6238`, `3198570` |
| Document Qualification / Documents Ingestor — G28 (G28-C / G28-D discovery) | `G28-C: CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING` | 2026-07 | `271761c`, `edaf0b4` |
| Controlled Delete × Document History (Pedido/OP) | `CLOSED / ACCEPTED` | 2026-07 | `707a37b` |
| Admin/Pedido — Static Residue of the Completion Button (Expedição) | `CLOSED / ACCEPTED` | 2026-07 | `7978e0a` |
| Client Portal — Order Detail Read Model — `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` | `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS` | 2026-07-15 | (verification-only) |
| Canonical Documentation — Consistency Backfill — `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A` | `CLOSED / ACCEPTED` | 2026-07-15 | (docs) |
| Client Portal — ACL Grants Hardening — `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` | `CLOSED / ACCEPTED` | 2026-07-15 | `82f5ba7` |
| Canonical Documentation — Status Consistency of the Legacy Pedido↔OP Plans — `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1` | `CLOSED / ACCEPTED` | 2026-07-15 | (docs) |

> `DOC-LANGUAGE-MIGRATION-L2` (state files translated to English, `632f103`) and
> `PROJECT-STATE-COMPACTION-A` (this phase) are recorded in
> `docs/ledgers/G28_LEDGER.md`, not as blocks here.

## Relevant standing debts (Documents front)

- Migrations 49 and 50 — applied and verified in staging; not applied in
  production by this chain.
- Later UI/runtime evolutions, the destination of the legacy RPC and any
  linking/revocation require a new architectural decision.
- Push — not authorized in this chain.

## Mandatory links

- Documentation governance model: `docs/governance/DOCUMENTATION_MODEL.md`
- Documentation authority arbiter: `docs/DOCUMENTATION_INDEX.md`
- G28 master plan: `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
- Pedido/OP/Movimentação/Documentos plan: `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
- Ingestor local state (technical context): `services/documents-ingestor/PROJECT_STATE.md`
- Closed-phase closeouts (archive): `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`

## Historical reference

- Pre-model preservation: `docs/legacy/pre-model/MANIFEST.md`
- G28 front ledger: `docs/ledgers/G28_LEDGER.md`
- Archived PROJECT_STATE closeouts (2026-07): `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`
- pt-BR pre-translation original: `docs/archive/pt-BR/PROJECT_STATE.md`

The complete historical content that existed in this file before the first
compaction was preserved, byte for byte, in
`docs/legacy/pre-model/PROJECT_STATE_FULL_SNAPSHOT.md` (integrity manifest
`docs/legacy/pre-model/MANIFEST.md`; snapshot origin commit
`08b9af5e251de48e938600e5e4b4214e4d1e824e`; SHA-256
`7cacddd59c5b2fe9bae1add1a54a3433c370ccdad713bbd4010a1d11f1b39a98`). That
snapshot is not a source of current state and must not be edited nor receive
new closeouts.
