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
- **Next authorizable action:** `A3.4` (legacy code removal in `cadastros.js`)
  — pending its own architect order. `G28-CAMADA-2 / A2` track (`A2.1` +
  `A2.1-B` + `A2.2` + `A2.3`) is now `COMPLETE`.
  - **`A2.2` (modal wiring) + `A2.3` (pilot route enforcement) — `CLOSED /
    ACCEPTED`** (technical commit `09eb2a0` — `Wire admin access level into
    user admin`; architect visual gate `CONFIRMED`): `js/screens/
    admin-usuarios-modal.js` gained a "Nível de acesso" select, shown only
    when editing an existing `tipo='admin'` row (hidden via `display:none`,
    same convention as the existing `wrapperForn`/`wrapperCli` fields, for
    fornecedor/cliente — never removed from the DOM, never sent). **HARD
    STOP confirmed and honored:** `supabase/functions/admin-create-user/
    index.ts`'s `INSERT` uses a fixed column list that does not carry
    `nivel_acesso` — the field is never rendered on the create form and the
    create payload never carries the key (a new admin lands at the schema
    default `completo`; its level is set via a follow-up edit, which works
    because `updateUsuario` is a raw PostgREST update, not an Edge Function,
    and `usuarios_admin_all`/`is_admin()`-based RLS already allows it).
    Grid badge (`js/screens/admin-usuarios.js`) gained a quiet suffix —
    `"Admin · leitura"` for `somente_leitura`, plain `"Admin"` for
    `completo` (no new column). **A2.3 pilot route = the users screen
    itself:** "Novo usuário" and all 4 row `actionButton()`s render
    `disabled` (safe boolean pattern) with an explanatory title when the
    acting admin's own row (`tipo='admin' && nivel_acesso='somente_leitura'`)
    is found in the already-fetched user list (no new query); every write
    helper in `js/admin-usuarios-writes.js` also takes a trailing `readOnly`
    boolean and refuses with `CLIENT_READONLY_FORBIDDEN` before touching
    `window.supa`, threaded from the screen through the modal's
    `options.readOnly` — defense-in-depth if a disabled control were ever
    bypassed. **Explicitly client-side only:** a `somente_leitura` admin
    whose JWT still says `tipo='admin'` can call the Edge Functions/
    PostgREST directly — RLS does not check `nivel_acesso` (`is_admin_full()`
    exists since `db/62` but is not consumed by any policy). Tests: +6 in
    `tests/admin-usuarios.smoke.js` (56/56); fixed a `FakeNode` fidelity gap
    in the same suite (`<select>.value` didn't follow a selected `<option>`,
    `.style` wasn't mirrored) while touching it for this phase, per `§20`.
    Full regression unchanged (138 pre-existing failures, identical before/
    after via `git stash`/`pop`, zero new failures, +6 passing).
  - **Registered candidates (`NOT AUTHORIZED`, both flagged
    `PRE-PUBLICATION`):** `A2-SERVER-SIDE-ENFORCEMENT` — RLS/Edge Functions
    still key exclusively on `tipo='admin'`; `somente_leitura` is UI-only and
    bypassable via direct API calls; `is_admin_full()` (`db/62`) exists and is
    unused by any policy — required before any real read-only admin is
    trusted in production. `A2-CREATE-NIVEL-ACESSO-WIRING` —
    `admin-create-user`'s fixed column list drops `nivel_acesso`; new admins
    always land at `completo` and require a follow-up edit to set
    `somente_leitura`.
  - **`A2.1` (nivel_acesso schema) + `A2.1-B` (ACL correction) — `CLOSED /
    ACCEPTED`** (technical commit `f108c45`): `db/62` adds
    `public.usuarios.nivel_acesso` (`TEXT NOT NULL DEFAULT 'completo'`, CHECK
    `completo`/`somente_leitura`; all 10 existing users defaulted `completo`, no
    silent privilege change) and the `is_admin_full()` helper (`SECURITY
    DEFINER STABLE`; `ativo AND tipo='admin' AND nivel_acesso='completo'`).
    `usuarios.tipo` and `is_admin()` untouched (ratified: `tipo` anchors all RLS).
    Applied+verified in staging (registry `20260717093122 / 62_admin_nivel_acesso_schema`).
    Role matrix all green — incl. the critical regression **`is_admin()` stays
    true for a `somente_leitura` admin** — and the `db/60` trigger records a
    `nivel_acesso` change with the correct `perfil_alterado` payload.
    **Hard-stop encountered + ruled:** `db/62`'s ACL left `service_role` with
    `EXECUTE` (Supabase default privilege), diverging from the db/57
    authenticated-only standard; architect ruled **Option 3** → forward-only
    grants-only correction **`db/63`** (registry `20260717101401 /
    63_is_admin_full_grants`, precedent db/57), which states the complete
    intended ACL. **Final ACL verified: `EXECUTE` for `authenticated` only;
    PUBLIC/anon/service_role denied** (`has_function_privilege`: authenticated
    true, anon/service_role false; service_role runtime call → `42501`
    unreachable). `A2.2` (modal wiring) and `A2.3` (route enforcement) were
    separate orders — now `CLOSED / ACCEPTED` (see above).
  - **`TEST-DOUBLE-SHARED-MODULE` Lot `L1` — `CLOSED / ACCEPTED`:** shared
    `tests/_doubles.js` (`FaithfulNode` with real DOM boolean coercion + fake
    `supa` with double-envelope `invoke`/single-level `rpc`/single-vs-array) +
    16 meta-tests (commit `54ee8aa`); adopted in **all 5** `R1` suites —
    `cliente-pedido-tracking`, `pedido-detail-linked-documents`,
    `direct-cnpj-screens`, `pedido-form` (commit `4d2f304`) and
    `tec-to-acabamento-flow` (commit `520c9a6`) — each with a demonstration test
    proving the old raw-store double would have masked a boolean-attr
    regression; `R2` fail-unsafe drift fixed in `fornecedor-screens`/
    `painel-screen`; `FaithfulNode` widened for select→value reflection. No
    existing assertion weakened; the 2 pre-existing `tec-to-acabamento-flow`
    static-slice failures preserved intact.
  - **`TEST-DOUBLE-STALE-ASSERTION-CLEANUP` Lot `L2` — `CLOSED / ACCEPTED`**
    (commit `2c9a4c2`): the stale inline-`<script>` assertions in
    `index-inline`/`config`/`supabase-client` rewritten to the
    post-modularization structure (no content-bearing inline script; extracted
    logic asserted in its module; `?v=` cache-buster tolerated; `js/boot.js`
    entrypoint as the ordering boundary); `index-inline`'s fixed `:8765` fetch
    replaced by an ephemeral `listen(0)` server; `fornecedor-screens`'s stale
    hardcoded menu-count (`10` vs the 11-item `ADMIN_MENU`) made dynamic. All
    four suites green. **The historical "~87 / 11 failures" baseline debt is now
    resolved.** Registered follow-up (`NOT AUTHORIZED`, same stale class, out of
    L2's named scope): `tec-to-acabamento-flow`'s 2 static-slice assertions
    (caso 9, MODAL caso 6) are false-red brittle `buildTecelagemTransferForm`
    slice regexes — the source content they check (`comOpcaoSplit:true`,
    `layout:'stacked'`) is present; a trivial regex-anchor fix.
  - **`TEST-MOCK-FIDELITY-AUDIT` — `CLOSED / ACCEPTED`** (read-only audit,
    architect ratification 2026-07-17; report
    `docs/reports/TEST_MOCK_FIDELITY_AUDIT_2026-07-17.md`): all 124 `tests/`
    suites inventoried; **zero confirmed (c) structurally-blind doubles that
    mask a live bug** — the three triggering defects were fixed and their
    doubles corrected into the faithful seed. Substantive finding is
    structural: fidelity is accidental/per-suite (residual classes `R1`
    quarantined boolean-blindness, `R2` fail-unsafe copy-drift, `R3` legacy
    coverage gap) — `R1`/`R2` now closed by `L1`. Shared-double module
    `APPROVED as proposed` (additive, opt-in, phased, mandatory meta-tests).
    `§20` (test-double fidelity) added to `CODE_HEALTH_RULES.md`.
    `UI-EL-BOOLEAN-ATTR-FIX` is subsumed: the live regression it named is
    already fixed in `el()`; the audit confirms the fix's doubles are faithful
    and the latent siblings (`R1`) are now converted to the shared faithful
    double.
  - **`TEST-MOCK-FIDELITY-AUDIT` — `CLOSED / ACCEPTED`** (read-only audit,
    architect ratification 2026-07-17; report
    `docs/reports/TEST_MOCK_FIDELITY_AUDIT_2026-07-17.md`): all 124 `tests/`
    suites inventoried; **zero confirmed (c) structurally-blind doubles that
    mask a live bug** — the three triggering defects were fixed and their
    doubles corrected into the faithful seed. Substantive finding is
    structural: fidelity is accidental/per-suite (residual classes `R1`
    quarantined boolean-blindness, `R2` fail-unsafe copy-drift, `R3` legacy
    coverage gap). Shared-double module `APPROVED as proposed` (additive,
    opt-in, phased, mandatory meta-tests). `§20` (test-double fidelity) added
    to `CODE_HEALTH_RULES.md`. `UI-EL-BOOLEAN-ATTR-FIX` is subsumed: the live
    regression it named is already fixed in `el()`; the audit confirms the
    fix's doubles are faithful and locates the latent siblings (`R1`).
  - **`G28-CAMADA-2 / A6` track — COMPLETE** (`A6.1` + `A6.1-B` + `A6.2` +
    `A6.3`, all `CLOSED / ACCEPTED` — see "Closed phases" below). `A6.3`'s
    architect visual gate passed. Real E2E in staging
    (`scripts/staging/usuarios-audit-e2e.mjs`) passed `15/15`,
    `result: PASS`, `2026-07-17`, against the five Edge Functions deployed
    by the architect.
  - **`UI-INVOKE-ENVELOPE-FIX` — `CLOSED / ACCEPTED`** (root-cause fix,
    `2026-07-17`): the A6.3 visual gate surfaced a live defect (reset
    succeeded but the generated password wasn't shown) traced to a
    pre-existing (since `A5.1-A5.2`) client-side double-unwrap of the
    `functions.invoke()`/`jsonResponse()` envelope, invisible to tests
    because the fake Supabase client's `invoke()` mock didn't model the
    real double envelope. Fixed at the single central unwrap point
    (`invokeAdminFunction()`, `js/admin-usuarios-writes.js`); the identical
    bug in the frozen legacy `screenCadastrosUsuarios`
    (`js/screens/cadastros.js`) was reported, not fixed — one more
    justification for `A3.4`. Architect-confirmed working: reset shows the
    password, create-with-observações saves correctly.
  - **Candidates registered, `NOT AUTHORIZED`:** `A6-GLOBAL-AUDIT-VIEW`
    (`usuario_excluido` events are unreachable from the per-user panel by
    construction — the panel only opens for an existing profile, and a
    deleted user has none; an admin-level, cross-user audit view is
    recommended before publication); `AUDIT-ACTOR-SNAPSHOT` (the audit
    panel resolves actor identity live via a join to `public.usuarios`; if
    the acting admin is later deleted, the actor line goes blank while the
    event subject's own identity snapshot — `db/61` — survives; proposed
    fix mirrors `db/61`'s pattern onto `ator_email`/`ator_nome` columns).
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
- **User audit trail design (`A6.1`/`A6.1-B`/`A6.2`, canonical):**
  `public.usuarios_eventos` has exactly two write paths, mutually exclusive by
  the `auth.uid()` condition — (1) `trg_usuario_evento` (`db/60`) records
  direct-`UPDATE` changes to `ativo`/`tipo`/`nivel_acesso`/`senha_temporaria`
  made by an authenticated admin session (`auth.uid() IS NOT NULL`); (2) each
  of the five admin Edge Functions records its own action explicitly, since
  they run under `service_role` where `auth.uid() IS NULL` excludes the
  trigger by design. Both paths populate the identity snapshot columns
  (`usuario_email`/`usuario_nome`/`usuario_tipo`, `db/61`) — the trigger from
  `NEW`, the Edge Functions explicitly. `usuario_id` is `ON DELETE SET NULL`
  (`db/61`, corrective over `db/60`'s original `CASCADE`) so events survive
  `admin-delete-user`. Full detail: `docs/DOCUMENTATION_INDEX.md` §4
  (`db/60`/`db/61` rows and the `A6.1`/`A6.1-B`/`A6.2` narrative entry).
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
- **`TEST-MOCK-FIDELITY-AUDIT` — `CLOSED / ACCEPTED` (read-only audit,
  architect ratification 2026-07-17):** all 124 `tests/` suites inventoried and
  classified against the real behavior each double imitates (report
  `docs/reports/TEST_MOCK_FIDELITY_AUDIT_2026-07-17.md`). Result: **zero
  confirmed (c) structurally-blind doubles that mask a live bug** — the three
  triggering defects (`UI-EL-BOOLEAN-ATTR-FIX` boolean-`setAttribute`,
  hand-mocked `js/ui.js` primitives, `UI-INVOKE-ENVELOPE-FIX` flat-`invoke()`)
  were genuine (c) at the time and are now fixed with their doubles corrected
  into the faithful seed (`admin-usuarios.smoke.js` is the crown jewel: real
  `js/ui.js` + double-wrapped `invoke` + presence-tracking `FakeNode`; only that
  one suite runtime-fakes `functions.invoke`). Substantive finding is
  **structural** — fidelity is accidental/per-suite: `R1` (quarantined
  boolean-blind hand-mock `el()` in `direct-cnpj-screens`/`pedido-form`/
  `cliente-pedido-tracking`/`pedido-detail-linked-documents`/
  `tec-to-acabamento-flow`, benign only because those screens have no
  boolean/ternary attr today), `R2` (fail-unsafe raw-store `FakeNode`
  copy-drift; loads real `el()`, so crashes rather than false-greens),
  `R3` (legacy-dead-code invoke coverage gap, resolved by `A3.4`). **Ratified
  rulings:** shared-double `tests/_doubles.js` `APPROVED as proposed` (additive,
  opt-in, phased, mandatory meta-tests, seeded from the three corrected
  doubles); `§20` (test-double fidelity) added to `CODE_HEALTH_RULES.md`; lots
  `L1` (shared module + `R1` adoption + `R2` fix) and `L2` (stale inline-`<script>`
  cleanup) `AUTHORIZED`; `L3` `NO ACTION` (subsumed by `A3.4`, its fourth
  justification).
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
- **`A2-SERVER-SIDE-ENFORCEMENT` — `NOT AUTHORIZED` candidate, flagged
  `PRE-PUBLICATION` (registered at the `A2.2`/`A2.3` closeout, 2026-07-17):**
  RLS and the admin Edge Functions still key exclusively on `usuarios.tipo`;
  `nivel_acesso='somente_leitura'` is enforced client-side only in
  `js/screens/admin-usuarios.js`/`js/admin-usuarios-writes.js` and is
  bypassable via direct API calls from a JWT that still carries
  `tipo='admin'`. `is_admin_full()` (`db/62`) already exists and is unused by
  any policy. **Required before any real read-only admin is trusted in
  production.**
- **`A2-CREATE-NIVEL-ACESSO-WIRING` — `NOT AUTHORIZED` candidate, flagged
  `PRE-PUBLICATION` (registered at the `A2.2`/`A2.3` closeout, 2026-07-17):**
  `admin-create-user`'s `INSERT` uses a fixed column list that does not carry
  `nivel_acesso` — every new admin lands at the schema default (`completo`)
  regardless of what the (edit-only) modal select would otherwise send;
  setting `somente_leitura` on a newly created admin requires a follow-up
  edit. Wiring the create path requires an Edge Function change.
- **`IS-ADMIN-ACL-REVIEW` — `NOT AUTHORIZED` candidate (registered at the `A2.1-B`
  closeout, 2026-07-17):** the RLS anchor `public.is_admin()` grants `EXECUTE`
  to `PUBLIC`/`anon`/`authenticated`/`service_role` — more permissive than the
  db/54/57 least-privilege standard (which `db/63` applied to `is_admin_full()`).
  Tightening `is_admin()`'s ACL touches **every** RLS policy that calls it, so it
  needs its own read-only diagnosis before any change. Not a current exposure
  (`is_admin()` returns `false` for anon/unauthenticated via `auth.uid()`), but
  registered for a dedicated review.
- **`tec-to-acabamento-flow` stale static-slice assertions — follow-up (same
  class as `L2`, out of its named scope):** the suite's 2 pre-existing failures
  (caso 9, MODAL caso 6) are false-red brittle `buildTecelagemTransferForm` slice
  regexes; the source content they check (`comOpcaoSplit:true`, `layout:'stacked'`,
  `js/screens/pedido-detail-events.js:1691`) is present. A trivial regex-anchor
  fix, `NOT AUTHORIZED`, folded here per the `A2.1-B` order.
- **Open non-blocking debts:** `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` /
  `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING` (G28-C/D/B7/Client Portal);
  `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (object applied+verified in
  staging, no drift; no history row fabricated); production application of the
  staging-only stack (`db/12`, `db/21`, `db/30`, `db/49`–`db/57`); 6 tests in
  `tests/auth.smoke.js` with an outdated `<script src="js/auth.js">` regex
  (candidate for `CODE-HEALTH-AUDIT-§18-R1`); `js/screens/admin-usuarios-modal.js`
  at 576 lines (decomposition candidate).
- **Test baseline re-grounded then RESOLVED (`TEST-MOCK-FIDELITY-AUDIT` L0 +
  `TEST-DOUBLE-STALE-ASSERTION-CLEANUP` L2, 2026-07-17):** the historical
  "~87 http.server/index.html failures" and "11 index-inline failures" figures
  were **stale baseline artifacts** resolving into two non-mock-fidelity buckets
  — (1) fixed-port `:8765` environment dependency; (2) stale inline-`<script>`
  assertions against a block the modularization removed (`index.html` now 79/79
  `<script src=…>`, zero inline). **Both are now fixed by `L2`** (commit
  `2c9a4c2`): `index-inline` 6/6, `config` 28/28, `supabase-client` 26/26,
  `fornecedor-screens` 30/30. The only remaining pre-existing failures in the
  touched set are `tec-to-acabamento-flow`'s 2 static-slice assertions
  (false-red brittle regexes; registered follow-up, `NOT AUTHORIZED`).
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
- **Worktree topology (read-only finding, 2026-07-17):** `controle-tapetes-g28`
  is a linked worktree of the main repo (`controle-tapetes/.git`, alongside
  `controle-tapetes-g27` and `controle-tapetes-controlled-delete-gate`). A
  **stale worktree registration `tapetes-baseline-check`** exists under
  `controle-tapetes/.git/worktrees/` — not locked, empty `gitdir`, its target
  directory **missing on disk** (prunable). Git's auto-prune on every commit
  fails to delete that metadata folder (`Permission denied` — likely a OneDrive
  sync lock), producing a harmless recurring warning that does **not** affect
  commits. Cleanup (`git worktree prune`, or manual removal of the metadata
  folder after freeing the OneDrive/AV lock) is a **candidate pending explicit
  authorization** — NOT pruned unilaterally.
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
| Camada 2 — Admin Access Level Modal Wiring + Pilot Enforcement — `A2.2` + `A2.3` | `CLOSED / ACCEPTED` | 2026-07-17 | `09eb2a0` |
| Camada 2 — Admin Access Level Schema + ACL Correction — `A2.1` + `A2.1-B` | `CLOSED / ACCEPTED` | 2026-07-17 | `f108c45` |
| Test-Double Shared Module + Stale-Assertion Cleanup — `L1` + `L2` | `CLOSED / ACCEPTED` | 2026-07-17 | `54ee8aa`,`4d2f304`,`520c9a6`,`2c9a4c2` |
| Test Mock Fidelity Audit (read-only) — `TEST-MOCK-FIDELITY-AUDIT` | `CLOSED / ACCEPTED` | 2026-07-17 | (docs) |
| Admin Edge Function Response Envelope Fix — `UI-INVOKE-ENVELOPE-FIX` | `CLOSED / ACCEPTED` | 2026-07-17 | `7b37e8e` |
| Camada 2 — User Audit Panel (read-only) — `A6.3` | `CLOSED / ACCEPTED` | 2026-07-17 | `e31f269` |
| Camada 2 — Audit Trail Wiring (Edge Functions) — `A6.2` | `CLOSED / ACCEPTED` | 2026-07-17 | `b67b126`, `7309349` |
| Camada 2 — Preserve User Audit Events on Profile Deletion — `A6.1-B` | `CLOSED / ACCEPTED` | 2026-07-16 | `fa8e1b9` |
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
