# CANONICAL CURRENT STATE

This file is the single source of the **current** operational state: active phase,
next authorizable action, binding decisions in force, live debts, environment facts,
and an index of closed phases. It does **not** hold historical closeout narratives —
those were moved by `PROJECT-STATE-COMPACTION-A` (2026-07-16) and `-B` (2026-07-17) to
`docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`, verbatim; full per-phase closeouts
are in `docs/ledgers/G28_LEDGER.md`. HEAD/working tree/divergence: consult Git directly.

## Active phase and next action

- **Active track:** `PRODUCTION-MIGRATION-M0-M10` — the ordered migration plan
  (new repo + new Supabase project + Vercel) proposed by
  `PRODUCTION-READINESS-DIAGNOSIS-R1` (`ACCEPTED`, 2026-07-17;
  `docs/reports/PRODUCTION_READINESS_DIAGNOSIS_R1_2026-07-17.md`) and registered as
  the **active track** by the ratification order of the same date. **`M0` — `CLOSED
  / ACCEPTED`** (new repo landing, 2026-07-17; see "Binding decisions" and
  "Environment standing facts"). `M1`-`M10` remain `NOT AUTHORIZED`, each pending its
  own individual order; phases do not chain automatically.
- **`BACKLOG FREEZE` in force (2026-07-17):** **no NEW fronts** until after cutover
  (`M10`). Only the **`M0`-`M10` migration plan** and the **canonical residual risk
  register** (12 items, ranked — see "Live debts and candidates") are authorizable
  work. All pre-existing candidate fronts are frozen-in-place as `POST-LAUNCH DEBT`.
- **Next authorizable action:** an individual order for `M1` (new Supabase project
  provisioning) or any other `M2`-`M10` phase. Target coordinates: GitHub
  `inttexsystem/inttracker` (now the production remote, pushed), Supabase
  `gqmpsxkxynrjvidfmojk`, Vercel `vercel.com/inttex`.
- **Post-launch debt pointer (frozen):** the former Camada-3 subphases (`BK5`-`BK8`,
  `CAMADA3-TRIGGER-SELECTION`), the two ex-`PRE-PUBLICATION` asterisks
  (`A2-SERVER-SIDE-ENFORCEMENT`, `A2-CREATE-NIVEL-ACESSO-WIRING`), and
  `A6-GLOBAL-AUDIT-VIEW`/`AUDIT-ACTOR-SNAPSHOT` are now residual-register entries.
  **`G28-CAMADA-2` — TRACK `COMPLETE` / `CLOSED / ACCEPTED`** in staging (full `A1-A7`
  + password policy; narratives archived + in the ledger).
- **Open architect decisions:** `NONE` blocking the active migration track. Part-1
  decisions of this order (key regime, launch user model, standing pre-launch items)
  are ruled and recorded under "Binding decisions in force".
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`.
  **Branch:** `work/g28-document-qualification`. **Allowed remote:** none — no push
  without express authorization in this chain.

## Binding decisions in force

Condensed statements of the rulings that constrain future work. Full recorded
decisions (verbatim) are in `docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md`
(Architect Decision + `PROJECT-STATE-COMPACTION-B` sections) and in
`docs/archive/pt-BR/PROJECT_STATE.md`.

### Pre-migration decisions (`PROJECT-STATE-COMPACTION-B` order, 2026-07-17)

- **Key regime — new format (binding):** the new project standardizes on the
  **new-format keys** (`sb_publishable_…` + a matching secret key). No legacy
  `anon`/`service_role` JWTs. The regime is applied consistently across
  `js/config.js`, `scripts/backup/*`, `scripts/staging/*`, the Ingestor (both the
  in-repo `services/documents-ingestor/` copy and the standalone twin at
  `D:\OneDrive\Programação\Ravatex\documents-ingestor\`), and the asserting tests.
  **The secret key never appears in chat or the repo** — `supabase secrets` /
  Vercel env / GitHub Actions secrets only.
- **Launch user model — full-trust admins only (binding):** **no `somente_leitura`
  admin may be created in production** until `A2-SERVER-SIDE-ENFORCEMENT` closes.
  The constraint **is** the mitigation — the underlying risk is unchanged; exposure
  is zero **only while the constraint holds**. Consequently
  `A2-SERVER-SIDE-ENFORCEMENT` and `A2-CREATE-NIVEL-ACESSO-WIRING` rank **FIRST-WEEK**
  (not before-first-user) in the residual risk register.
- **Standing PRE-LAUNCH items (ratified from the diagnosis):** `DELETE-PROD-GUARD-A`;
  the backup trigger via **GitHub Actions** + the **`BK7` restore runbook**; and the
  **auth-restore rehearsal into a throwaway Supabase project before `M3`**. These are
  the before-first-user set the architect holds standing; the register's other
  before-first-user framings are advisory.

### Migration governance

- **`PRODUCTION-READINESS-DIAGNOSIS-R1` — `ACCEPTED` / ratified reference report
  (2026-07-17):** `docs/reports/PRODUCTION_READINESS_DIAGNOSIS_R1_2026-07-17.md`. Its
  residual risk register (12 items) is canonical; its `M0`-`M10` plan is the active
  track. Read-only — authorizes no implementation by itself.
- **Amended publication criterion (2026-07-17 — supersedes
  `G28-GOVERNANCE-CONSOLIDATION-A`):** publication **proceeds with Camada 3 at
  `BK4.2`** (exporter proven + restore-smoke passed); remaining Camada-3 scope + the
  two ex-asterisks (`A2-SERVER-SIDE-ENFORCEMENT`, `A2-CREATE-NIVEL-ACESSO-WIRING`)
  become `POST-LAUNCH DEBT` with production consequences. The reviewer objection
  (minimum pre-launch set) is **recorded and overruled** — the architect decides which
  items close before cutover. The superseded original (`both` Camada-2 and full
  Camada-3 CLOSED in staging) is preserved verbatim in the archive
  (`PROJECT-STATE-COMPACTION-B` batch); in any wording divergence, the archive wins.
- **`BACKLOG FREEZE` (2026-07-17, binding):** no NEW fronts authorizable until after
  cutover (`M10`); only the `M0`-`M10` plan and the residual register survive.
- **Canon correction (2026-07-17):** branch `work/g28-document-qualification` commit
  count was **749** at diagnosis time (not "~555"); **753** at the `M0` push
  (2026-07-17, 4 subsequent docs commits) — see `M0` record below.
- **`M0` (new repo landing) — `CLOSED / ACCEPTED` (2026-07-17, single-use push
  authorization):** full-history push, no force/tags, HEAD `7b2ab7d7aaca44edf27
  81b24eb5aeecf8ba63c50` (**753** commits) → `inttexsystem/inttracker`, branch
  mapping `work/g28-document-qualification:main`. Pre-flight: clean tree; sensitive
  paths ignored (`supabase/.temp`, `.ravatex-local`, `backups`; `.mcp.json` absent
  from the tree entirely — not a gap); tracked-file secrets sweep clean (`sb_secret`/
  `service_role`/connection-string patterns — one doc hit was a `[SENHA]` placeholder;
  the only `eyJ` hits are the pre-existing public `anon`-role keys in `js/config.js`,
  by design RLS-gated, not a secret). Destination confirmed empty before push
  (`git fetch`/`ls-remote` → no branches). Post-push: `git rev-list --left-right
  --count production/main...HEAD` = **`0 0`** (exact match). New remote `production`
  = `https://github.com/inttexsystem/inttracker.git` (fetch+push). `origin`
  (`grupoterrabranca/controle-tapetes`) and `staging`
  (`ravatexapps-dotcom/controle-tapetes-staging`) **retained, unchanged** — `staging`
  is now historical backup only, no longer a push target.
- **Staging-only execution boundary (`STAGING-ONLY-EXECUTION-BOUNDARY-A`,
  2026-07-15, partially superseded):** operational environment is staging
  `ucrjtfswnfdlxwtmxnoo`; the protected project `bhgifjrfagkzubpyqpew` is `OUT OF
  SCOPE`, **never accessed** — this don't-touch rule stays fully in force. Its
  "Vercel not selected" / production-postponement items are **superseded** by the
  amended criterion + active `M0`-`M10` track (target = the new
  `gqmpsxkxynrjvidfmojk`, not the protected project). Full original in the archive.

### Standing product / process rulings

- **`G28-CAMADA-3` status:** at `BK4.2` — `BK4.1` (`backup_runs` schema, `d39a848`)
  and `BK4.2` (exporter, `4831ca3` + fixes; real staging run
  `ae55e714-…`, bundle `83378` bytes, restore-smoke 63/63 tables incl.
  `auth.identities=8`) both `CLOSED / ACCEPTED` in staging. Remaining subphases +
  trigger are `POST-LAUNCH DEBT`. A live `CAMADA3-OAUTH-GRANT-COUPLING` debt is
  registered (see below). Full BK narrative archived; contract at
  `docs/architecture/CAMADA3_BACKUP_CONTRACT.md`.
- **`G28-CAMADA-2` classification — `CLOSED / ACCEPTED`, track `COMPLETE`
  (2026-07-17):** entered classified `PRE-EXISTING PARTIAL CAPABILITY + FULL SCOPE
  A1-A7 DEFERRED` (`G28-RECONCILIATION-DECISIONS-A`); exits `CLOSED / ACCEPTED` with
  full `A1-A7` + password policy delivered. Functional reference during the build:
  `D:\OneDrive\Programação\SGAA_clean_baseline`. Full narrative archived.
- **`G28-C`:** `CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`;
  `G28-B8` `SUBSUMED BY G28-C`.
- **`PROJECT-CONTROL-BASELINE-R1` (ChatGPT):** `REJECTED / NOT RATIFIED`, superseded by
  `BACKLOG-RECONCILIATION-READONLY-R1` (the adopted reference baseline).
- **Supervision governance:** state/authorizations/phases held by Claude (chat) +
  Claude Code (resident); ChatGPT is a process consultant **without state custody or
  authority to issue orders**. `docs/governance/SUPERVISION_PROTOCOL.md` requires a
  `STRUCTURAL POLICY COMPLIANCE` section in every implementation phase report.
- **Admin password auto-reset BLOCKED (`A5.1-A5.2`):** an admin cannot reset their own
  password (`SELF_RESET_FORBIDDEN`) — they use the self-service change flow (`A4.2`).
- **User audit trail design (`A6.1`/`A6.1-B`/`A6.2`, canonical):**
  `public.usuarios_eventos` has two mutually-exclusive write paths keyed on
  `auth.uid()` — `trg_usuario_evento` (`db/60`, authenticated-admin `UPDATE`s) and the
  five admin Edge Functions (`service_role`, explicit). Both fill the `db/61` identity
  snapshot; `usuario_id` is `ON DELETE SET NULL` so events survive delete. Detail:
  `docs/DOCUMENTATION_INDEX.md` §4.
- **`UI-EL-BOOLEAN-ATTR-FIX` — OPEN active regression (register #9):** `js/ui.js`'s
  `el()` sets boolean attrs unconditionally, so `disabled`/`checked` `false` still
  render true; `admin-usuarios.js`'s Excluir button still carries the pattern
  (suspect). Not yet fixed. Full narrative archived.
- **`TEST-MOCK-FIDELITY-AUDIT` — `CLOSED / ACCEPTED` (2026-07-17):** zero confirmed (c)
  blind doubles; `tests/_doubles.js` `APPROVED`, `§20` added to `CODE_HEALTH_RULES.md`,
  lots `L1`/`L2` `CLOSED / ACCEPTED`. Report
  `docs/reports/TEST_MOCK_FIDELITY_AUDIT_2026-07-17.md`; full narrative archived.
- **Controlled Delete × document history:** physical deletion of Pedido/OP is blocked
  when canonical document history exists (`document_link_revisions`/
  `document_link_revision_ops`, append-only); permanent contract in
  `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`.
- **Language policy:** English for canonical docs/reports/new code + commit messages;
  pt-BR for UI text; architect orders may be issued in Portuguese, recorded in English
  (original preserved in ledger/archive); phase IDs never translated. Homes:
  `DOCUMENTATION_MODEL.md` §18, `CODE_HEALTH_RULES.md` §19, `SUPERVISION_PROTOCOL.md`
  §3; `CLAUDE.md` pointer-summary.

## Live debts and candidates

- **CANONICAL RESIDUAL RISK REGISTER (12 items, ranked — `PRODUCTION-READINESS-
  DIAGNOSIS-R1` §4, 2026-07-17):** authoritative list with per-item consequence in
  the report §4. Ranked, timing as amended by this order's Part-1 decisions:
  (1) `A2-SERVER-SIDE-ENFORCEMENT` — FIRST-WEEK; (2) `DELETE-PROD-GUARD-A` —
  **BEFORE-FIRST-USER** (data-loss); (3) Camada 3 incomplete (`BK5`-`BK8`, no
  trigger/retention/runbook/drill) — **trigger (GitHub Actions) + `BK7` runbook
  BEFORE-FIRST-USER**, rest first-week; (4) `CAMADA3-OAUTH-GRANT-COUPLING` —
  first-week; (5) `A2-CREATE-NIVEL-ACESSO-WIRING` — FIRST-WEEK;
  (6) `IS-ADMIN-ACL-REVIEW`; (7) `A6-GLOBAL-AUDIT-VIEW`; (8) `AUDIT-ACTOR-SNAPSHOT`;
  (9) `UI-EL-BOOLEAN-ATTR-FIX` (active regression) — first-week;
  (10) `CODE-HEALTH-AUDIT-§18-R1`; (11) `DELETE-AUDIT-LOG-A`; (12) `G28-CAMADA-4`
  (6-12 deferrable except where noted). All 12 are `POST-LAUNCH DEBT`; the standing
  before-first-user set is in "Standing PRE-LAUNCH items" above.
- **`NOT AUTHORIZED` candidate fronts (all frozen by the backlog freeze):**
  `CODE-HEALTH-AUDIT-§18-R1`; `PUBLICATION-TRACK-REVIEW`; `UI-EL-BOOLEAN-ATTR-FIX`
  (`ACTIVE REGRESSION`, not fixed); `G28-D` publication;
  `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` (superseded by `M0`-`M10`);
  `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; `G28-CAMADA-4`; `A4.3` (email/SMTP
  invites).
- **`CAMADA3-TRIGGER-SELECTION` — `NOT AUTHORIZED` (`BK3`; register #3):** the
  automated-backup scheduler; mechanism resolved — **GitHub Actions, not Vercel cron**
  (the exporter shells out to `pg_dump`/`psql`). Contract:
  `docs/architecture/CAMADA3_BACKUP_CONTRACT.md`.
- **`CAMADA3-OAUTH-GRANT-COUPLING` — `NOT AUTHORIZED`, live debt (`BK4.2`,
  2026-07-17; register #4):** the exporter's first real run used the **Documents
  Ingestor's own OAuth client** (confirmed via Google's `tokeninfo`), not a dedicated
  grant; rotating/revoking that grant would also break backups. Decision: formalize
  the reuse (contract §4) or build a separate client. Detail:
  `docs/architecture/CAMADA3_BACKUP_CONTRACT.md` §4 amendment.
- **`CAMADA3-DRIVE-ACTIVATION` — partially exercised, `NOT AUTHORIZED` as a standing
  capability (`BK4.2`):** one real manual `google_drive` upload succeeded in staging
  (`ae55e714-…`); not yet repeated/scheduled/production-standing.
- **`A2-SERVER-SIDE-ENFORCEMENT` (#1) + `A2-CREATE-NIVEL-ACESSO-WIRING` (#5) —
  `NOT AUTHORIZED`, `POST-LAUNCH DEBT` / FIRST-WEEK:** RLS and the admin Edge
  Functions key exclusively on `usuarios.tipo`; `nivel_acesso='somente_leitura'` is
  client-side only, bypassable via direct API from a `tipo='admin'` JWT;
  `is_admin_full()` (`db/62`) exists and is unused; `admin-create-user`'s fixed
  column list drops `nivel_acesso` (new admins land `completo`; wiring needs an Edge
  Function change). **Both moot at launch** under the full-trust-admins-only
  constraint (no `somente_leitura` admin in production until #1 closes).
- **`IS-ADMIN-ACL-REVIEW` — `NOT AUTHORIZED` (registered `A2.1-B`, 2026-07-17;
  register #6):** `public.is_admin()` grants `EXECUTE` to
  `PUBLIC`/`anon`/`authenticated`/`service_role` — broader than the db/54/57
  least-privilege standard; tightening touches every RLS policy that calls it, so it
  needs its own read-only diagnosis. Not a current exposure (`is_admin()` is `false`
  for anon via `auth.uid()`).
- **Small code-health debts (frozen, folded into `CODE-HEALTH-AUDIT-§18-R1`):**
  `cadastrosModalGrid` dead helper; `tests/auth.smoke.js` outdated `<script>` regex
  (6 tests); `admin-usuarios-modal.js` at 576 lines; `tec-to-acabamento-flow`'s 2
  stale static-slice assertions; legacy `docs/AI_AGENT_RULES.md` review.
- **Stale git-worktree registrations (2, `NOT AUTHORIZED` cleanup):**
  `tapetes-baseline-check` + `baseline-check-a34` (missing `gitdir`, prunable;
  auto-prune blocked by an OneDrive/AV `Permission denied` lock — harmless, no commit
  impact). Await one authorized `git worktree prune`.
- **Open non-blocking debts:** `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`/`…_BLOCKED_BY_TOOLING`;
  `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (applied+verified in staging, no
  drift); production application of the staging-only stack (`db/12`/`21`/`30`/`49`–`57`).
- **UI tracks — `CLOSED / ACCEPTED` in their authorized scope, full narratives
  archived:** `UI-ACTION-BUTTON` (phases i/ii, lots 1/2 + `UI-USERS-GRID-TEXT-
  OVERFLOW`; lot 3 `cadastros.js` frozen; frozen candidates `MODAL-BUTTON-CSS-CHECK`,
  `fornecedor.js` redesign) and `UI-GRID-TEXT-OVERFLOW` (contract + helper + Lots
  A/B/C; frozen candidate `UI-FIXED-FORMAT-COLUMN-WIDTHS` — §7 CNPJ/date/phone column
  wrap; `UI-DOCUMENTOS-RECEBIDOS-LAYOUT-FIX` already `CLOSED / ACCEPTED`, `90726dd`).
- **Test baseline (RESOLVED, historical):** the "~87 / 11 failures" figures were
  stale artifacts (fixed-port `:8765` + removed inline `<script>` assertions), fixed
  by `L2` (`2c9a4c2`). Full note archived.

## Environment and worktree standing facts

- **Staging Supabase:** `ucrjtfswnfdlxwtmxnoo` (authorized). **Protected/other:**
  `bhgifjrfagkzubpyqpew` (`OUT OF SCOPE`, never accessed).
- **Migration targets:** GitHub `inttexsystem/inttracker` — **`M0` pushed**, no longer
  empty (main = the full history, see "Migration governance" `M0` record); Supabase
  `gqmpsxkxynrjvidfmojk` (empty, new-format publishable key supplied; matching secret
  key to be obtained out of band); Vercel `vercel.com/inttex` (repo-linked, not wired).
  Remaining wiring `NOT AUTHORIZED` until the relevant `M1`-`M10` order.
- **Remotes:** `production` = `https://github.com/inttexsystem/inttracker.git`
  (fetch+push, added at `M0`); `origin` = `grupoterrabranca/controle-tapetes`;
  `staging` = `ravatexapps-dotcom/controle-tapetes-staging` (historical backup only,
  no longer a push target). All three present on the local repo; no branch other than
  `main` pushed to `production`.
- **MCP (new project):** Supabase MCP is configured and verified against
  `gqmpsxkxynrjvidfmojk`, **read-only**, its token held **outside the repo**
  (`PROJECT-STATE-COMPACTION-B`, 2026-07-17). Read-only introspection of the new
  project is available; no write path is authorized outside a specific `M0`-`M10`
  order.
- **Publication provider:** **Vercel selected** (per the amended publication
  criterion, 2026-07-17); GitHub Pages remains the live provider until cutover.
- **Branch commit count:** `work/g28-document-qualification` = **753** commits
  (749 at diagnosis time + 4 docs commits; pushed to `production/main` at `M0`).
- **Migrations 49 and 50 (and the staging-only stack):** applied and verified in
  staging; not applied in production by this chain.
- **Worktree topology:** `controle-tapetes-g28` is a linked worktree of
  `controle-tapetes/.git` (alongside `-g27`, `-controlled-delete-gate`, and main
  `work/app-next` — divergent from `staging/work/app-next` and dirty). Two stale
  registrations remain (see "Live debts").
- **Push:** the `M0` push to `production` (2026-07-17) was a single-use explicit
  authorization for that order only; no further push is authorized by it. Push to
  `origin`/`staging` remains not authorized in this chain. **Production Supabase
  `bhgifjrfagkzubpyqpew`:** never accessed.
- **`supabase/.temp/`:** local Supabase CLI cache, **gitignored** since commit
  `be6f081` (was leaking the project ref + pooler URL).

## Closed phases

Full closeout narratives are archived, verbatim, in
`docs/closeouts/PROJECT_STATE_ARCHIVE_2026-07.md` (compaction A + B batches, same
order as below) and in `docs/ledgers/G28_LEDGER.md`. Commit SHAs are the accepted
technical commits; documentation-only phases show `(docs)`. Consult HEAD with
`git rev-parse HEAD`.

| Phase | Status | Date | Commit(s) |
|---|---|---|---|
| Repository Migration — `M0` (push to `inttexsystem/inttracker`) | `CLOSED / ACCEPTED` | 2026-07-17 | `7b2ab7d` pushed (git-only) + record commit |
| Ratify Production Readiness Diagnosis + Backlog Freeze — `PRODUCTION-READINESS-DIAGNOSIS-R1` (ratification) | `CLOSED / ACCEPTED` | 2026-07-17 | `be6f081`, `9566837` (docs) |
| Production Readiness Diagnosis (read-only) — `PRODUCTION-READINESS-DIAGNOSIS-R1` | `ACCEPTED` | 2026-07-17 | (report) |
| Camada 3 — Exporter First Real Run + Restore-Smoke — `BK4.2` | `CLOSED / ACCEPTED` | 2026-07-17 | `4831ca3`, `75f8ff9`, `153b2a2`, `51c4633`, `e11d05e` |
| Camada 3 — Backup Runs Schema — `BK4.1` | `CLOSED / ACCEPTED` | 2026-07-17 | `d39a848` |
| Camada 3 — Backup Diagnosis (read-only) + Backup Contract — `G28-CAMADA-3-DIAGNOSIS-R1` + `BK3` | `CLOSED / ACCEPTED` | 2026-07-17 | (docs) |
| Camada 2 — Legacy User Screen Removal — `A3.4` (closes `G28-CAMADA-2` track) | `CLOSED / ACCEPTED` | 2026-07-17 | `32e466a` |
| Camada 2 — Admin Access Level Modal Wiring + Pilot Enforcement — `A2.2` + `A2.3` | `CLOSED / ACCEPTED` | 2026-07-17 | `09eb2a0` |
| Camada 2 — Admin Access Level Schema + ACL Correction — `A2.1` + `A2.1-B` | `CLOSED / ACCEPTED` | 2026-07-17 | `f108c45` |
| Test-Double Shared Module + Stale-Assertion Cleanup — `L1` + `L2` | `CLOSED / ACCEPTED` | 2026-07-17 | `54ee8aa`,`4d2f304`,`520c9a6`,`2c9a4c2` |
| Test Mock Fidelity Audit (read-only) — `TEST-MOCK-FIDELITY-AUDIT` | `CLOSED / ACCEPTED` | 2026-07-17 | (docs) |
| Admin Edge Function Response Envelope Fix — `UI-INVOKE-ENVELOPE-FIX` | `CLOSED / ACCEPTED` | 2026-07-17 | `7b37e8e` |
| Camada 2 — User Audit Panel (read-only) — `A6.3` | `CLOSED / ACCEPTED` | 2026-07-17 | `e31f269` |
| Camada 2 — Audit Trail Wiring (Edge Functions) — `A6.2` | `CLOSED / ACCEPTED` | 2026-07-17 | `b67b126`, `7309349` |
| **2026-07-16 phases (16, collapsed) — see ledger/archive:** `A6.1`/`A6.1-B`, `A4.1`/`A4.2`, `A5.1-A5.2`/`A5.3-A5.4`, `CAMADA2-LAST-ACCESS-UI`, `UI-ACTION-BUTTON` i/ii + lots 1/2 + `UI-USERS-GRID-TEXT-OVERFLOW`, `UI-GRID-TEXT-OVERFLOW`, `UI-DOCUMENTOS-RECEBIDOS-LAYOUT-FIX`, `DOC-LANGUAGE-MIGRATION-L1` | `CLOSED / ACCEPTED` | 2026-07-16 | `ee0e77b`,`fa8e1b9`,`bf0d522`,`c6289f8`,`6c624ef`,`0aff22f`,`b726717`,`f886e26`,`bbfd58c`,`31b66af`,`abfb95e`,`3e95e86`,`0a1457b`,`cfa8b4b`,`90726dd`,`cab741c`,`ce4b693` |
| **2026-07-15 & earlier phases (13, collapsed) — see ledger/archive:** `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1` (`PROPOSED`), `A3.1`/`A3.2`, governance decisions `G28-GOVERNANCE-CONSOLIDATION-A` (superseded 2026-07-17) / `STAGING-ONLY-EXECUTION-BOUNDARY-A` (amended) / `G28-RECONCILIATION-DECISIONS-A`, `G28-C` (`TECHNICALLY ACCEPTED`), Controlled Delete × Document History, Static Residue Expedição, Client Portal read-model + ACL grants, docs consistency (`DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`, `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1`) | mixed `CLOSED / ACCEPTED` | 2026-07-15 / 2026-07 | `4f01101`,`b4a6238`,`3198570`,`271761c`,`edaf0b4`,`707a37b`,`7978e0a`,`82f5ba7` (+ docs/verification-only) |

> `DOC-LANGUAGE-MIGRATION-L2` (`632f103`), `PROJECT-STATE-COMPACTION-A` and
> `PROJECT-STATE-COMPACTION-B` (this phase) are recorded in
> `docs/ledgers/G28_LEDGER.md`, not as blocks here.

## Relevant standing debts (Documents front)

- Migrations 49 and 50 — applied and verified in staging; not applied in production
  by this chain.
- Later UI/runtime evolutions, the destination of the legacy RPC and any linking/
  revocation require a new architectural decision.
- Push — not authorized in this chain.

## Mandatory links

- Documentation governance model: `docs/governance/DOCUMENTATION_MODEL.md`
- Documentation authority arbiter: `docs/DOCUMENTATION_INDEX.md`
- Migration diagnosis (active track): `docs/reports/PRODUCTION_READINESS_DIAGNOSIS_R1_2026-07-17.md`
- Backup contract: `docs/architecture/CAMADA3_BACKUP_CONTRACT.md`
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
`7cacddd59c5b2fe9bae1add1a54a3433c370ccdad713bbd4010a1d11f1b39a98`). That snapshot
is not a source of current state and must not be edited nor receive new closeouts.
