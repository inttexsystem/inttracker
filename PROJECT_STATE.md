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
  / ACCEPTED`** (new repo landing, 2026-07-17), **`M1` — `CLOSED / ACCEPTED`**
  (new Supabase project verification + sanction, 2026-07-17), **`M2` — `CLOSED /
  ACCEPTED`** (schema replay `db/01→db/64` into `gqmpsxkxynrjvidfmojk`, 2026-07-17;
  see "Migration governance" and `docs/reports/M2_SCHEMA_REPLAY_VERIFICATION_2026-07-17.md`),
  and **`M3` — `CLOSED / ACCEPTED`** (production data migration into
  `gqmpsxkxynrjvidfmojk` + `parametros_largura` overwrite from legacy, 2026-07-17;
  see "Migration governance" and `docs/ledgers/G28_LEDGER.md` `M3-DATA` entry), and
  **`M8` — `CLOSED / ACCEPTED`** (Documents Ingestor repoint into
  `gqmpsxkxynrjvidfmojk`, 2026-07-18, executed out of numeric sequence by direct
  architect order; see "Migration governance" and the `M8` ledger entry).
  `M4`-`M7`, `M9`, `M10` remain `NOT AUTHORIZED`, each pending its own individual
  order; phases do not chain automatically.
- **`BACKLOG FREEZE` in force (2026-07-17):** **no NEW fronts** until after cutover
  (`M10`). Only the **`M0`-`M10` migration plan** and the **canonical residual risk
  register** (12 items, ranked — see "Live debts and candidates") are authorizable
  work. All pre-existing candidate fronts are frozen-in-place as `POST-LAUNCH DEBT`.
- **Next authorizable action:** an individual order for `M4` or any other `M5`-`M10`
  phase. Target coordinates: GitHub `inttexsystem/inttracker` (production remote,
  pushed), Supabase `gqmpsxkxynrjvidfmojk` (schema replayed `db/01→64` at `M2` — 64
  registry entries, 40 public tables; production data migrated at `M3`, see below),
  Vercel `vercel.com/inttex`. **Standing reminder: flip the Supabase MCP back to
  read-only** now that `M3`'s write window is closed.
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
- **`M1` (new Supabase project verification + sanction) — `CLOSED / ACCEPTED`
  (2026-07-17, read-only verification + docs record):** confirmed, via the
  read-only Supabase MCP pinned to `gqmpsxkxynrjvidfmojk`, the project is virgin:
  **0 tables in `public`**, **0 rows in the migrations registry**
  (`list_migrations`), **0 storage buckets** (`storage.buckets` count and row
  listing both `0`); `auth` scaffolding present and unmodified (**23 base tables**,
  all `0` rows except `auth.schema_migrations`'s stock seed rows); `storage`
  schema carries only its own stock scaffolding (8 tables, no buckets/objects).
  **Identification evidence:** `claude mcp list` shows the configured connection
  URL as `https://mcp.supabase.com/mcp?project_ref=gqmpsxkxynrjvidfmojk&features=
  database&read_only=true` — this **directly pins both the project ref and the
  `read_only=true` flag in the MCP's own connection string**, a stronger
  confirmation than the order anticipated (the order allowed for config-plus-
  empty-profile as the only available evidence; the ref is in fact directly
  readable from the MCP configuration, not just inferred). No write attempted;
  no table/migration/bucket found — no HARD STOP triggered. **Boundary amendment
  (this order, binding):** the staging-only boundary below is **amended** —
  writes to `gqmpsxkxynrjvidfmojk` are authorized **only within explicitly
  ordered `M`-track phases** (`M2`, `M3`, `M4`, `M9`); `ucrjtfswnfdlxwtmxnoo`
  becomes **read-only legacy** (the `M3` exporter/export-read path is the
  named exception); production `bhgifjrfagkzubpyqpew` **remains PROHIBITED**,
  untouched. **Next authorizable action:** `M2`, own order.
- **`M2` (schema replay into the sanctioned target) — `CLOSED / ACCEPTED`
  (2026-07-17):** the ratified authoritative source (repo `db/`, ordered
  `db/01→db/64`, skip `*.verify.sql`; `setup_completo.sql`/`supabase db push`
  forbidden) was replayed into `gqmpsxkxynrjvidfmojk` one migration at a time via
  MCP `apply_migration`, each registered under its canonical file-stem name, verified
  after each — **64/64 applied, zero errors, no skip/patch/reorder.** **HARD STOP ZERO
  passed** (ref pinned + virgin 0/0/0 pre-state). **Post-replay gate:** (4a) registry
  = **64 entries, order `01→64`, canonical names**; (4c) ACL spot-checks faithful —
  `is_admin_full`/backup-writer RPCs (`db/64`)/evidence-writer (`db/49`) = service_role
  only, document-scan RPCs (`db/38`) = authenticated (admin-gated internally), and
  `is_admin()` broad (PUBLIC/anon/authenticated/service_role) is the **pre-existing
  `IS-ADMIN-ACL-REVIEW` debt reproduced faithfully**, not a new defect; (4d, corrected
  gate) sole residual = **`parametros_largura`=2** (width-calc **configuration** from
  `db/04`, kept by `db/10`/`db/11`) — every `db/04` **test** cadastro wiped by `db/10`
  (confirmed 0), no genuine test data survived, nothing deleted; (4e) storage buckets
  = 0. **New-project profile:** 40 public tables, 0 views, 53 functions, 67 RLS
  policies, 9 triggers. **Data-writing ruling (architect):** faithful `01→64`
  authorized, gate 4d corrected from "all 0" to "residual matches the faithful replay,
  reported per table with origin" (the classifier initially blocked the `db/04` seed;
  the architect ruled Option 1). **`M2` verification report:**
  `docs/reports/M2_SCHEMA_REPLAY_VERIFICATION_2026-07-17.md`. **Open item (4b, parity
  vs staging): NOT EXECUTABLE** — the reconnected management-scoped MCP credential is
  permission-denied on `ucrjtfswnfdlxwtmxnoo`; the parity diff must be run out-of-band
  or the token re-scoped (advisory, non-blocking). **No production access; staging
  only read-attempted for parity (denied), never written.** Next: `M3`.
- **`M3` (production data migration) — `CLOSED / ACCEPTED` (2026-07-17):** production
  data copied from legacy `ucrjtfswnfdlxwtmxnoo` into `gqmpsxkxynrjvidfmojk`.
  **Verification (re-confirmed live at closeout):** auth remap — 24 rows, single
  column (`document_scan_requests.requested_by_user_id`), all remapped to the single
  surviving admin account; FK integrity — dynamic per-constraint orphan scan, **76
  relationships checked, 0 orphans** (13 reference `auth.users` directly, all clean);
  sequence resync — **10/10** populated sequences match `MAX(id)` of their owning
  table exactly. **Exclusion set (test/synthetic data, by design):** `clientes`(2),
  `fornecedores`(1), `lotes`(8), `op_fornecedores`(2), `op_itens`(2), `ops`(6),
  `ordens_compra_fio`(8), `precos_terceirizada`(1), `usuarios`/`auth.users`(9),
  `pedidos`(3), `pedido_itens`(2), `op_eventos`(1), `document_candidates`(3) — not
  carried over; the new database is intentionally smaller than legacy, not
  incompletely migrated. **Architect ruling (a) — `usuarios_eventos` excluded
  entirely (binding):** remapping `ator_id` would fabricate audit history (actors
  who never performed those actions in the new project); legacy retains the
  original 9-row trail as the historical record, the new project's audit trail
  starts empty and truthful from cutover. Same reasoning extends to
  `document_link_revisions`/`document_link_revision_ops` (8/10 rows, also
  actor-keyed canonical history) — excluded for the identical reason. **Architect
  ruling (b) — `parametros_largura` overwritten from legacy (binding):** the `db/04`
  seed (`peso_linear` 1.5000/2.2500, `valor_x` 1.0000) is a bootstrap default; the
  legacy live-tuned configuration (`largura=1.40`→`peso_linear=0.3360`,
  `algodao_por_ml=0.226000`, `poliester_por_ml=0.110000`, `valor_x=0.5000`;
  `largura=2.10`→`peso_linear=0.5370`, `algodao_por_ml=0.366000`,
  `poliester_por_ml=0.171000`, `valor_x=0.5000`) is real operationally-tuned data by
  the same standard as `clientes`/`modelos` and supersedes the seed — applied via
  `UPDATE` against `gqmpsxkxynrjvidfmojk`, matched by `largura`, this closeout.
  **Legacy retention (binding):** `ucrjtfswnfdlxwtmxnoo` retains the original audit
  trail (`usuarios_eventos`/`document_link_revisions`/`document_link_revision_ops`)
  and the excluded test/synthetic rows above — it is the historical record for both
  and **must not be deleted or pruned without a separate, explicit architect
  decision.** Full detail: `docs/ledgers/G28_LEDGER.md` `M3-DATA` entry. **No
  production access; legacy read-only, no writes.** Next: `M4`.
- **`M8` (Documents Ingestor repoint) — `CLOSED / ACCEPTED` (2026-07-18, executed out
  of numeric sequence by direct architect order):** configuration phase — the two
  Ingestor installations (in-repo `services/documents-ingestor/` + standalone
  operational twin at `D:\OneDrive\Programação\Ravatex\documents-ingestor\`, the copy
  the `Ravatex-DocumentScanWatcher-Staging` scheduled task runs) were repointed from
  legacy `ucrjtfswnfdlxwtmxnoo` to `gqmpsxkxynrjvidfmojk`. **Surfaces changed:** both
  `.env` (URL + `PROJECT_REF` → new; `SERVICE_ROLE_KEY` → new-format `sb_secret_` key
  pasted by the architect, never seen/logged/committed by Claude; twin's Google creds
  preserved), both `Start-DocumentScanWatcher.ps1` guards (`$ExpectedProjectRef` → new,
  else the watcher self-refuses to start), both `SUPABASE_WRITER_RUNBOOK.md` (reworded
  to "Sanctioned Target Project Only", cutover-durable). Hermetic tests referencing the
  legacy ref left untouched (fixtures, `§20`). **Schema compatibility verified live**
  (read-only): every table/RPC the Ingestor writes exists in the new project with the
  right `service_role` grants. **Repoint verified by a real watcher cycle:** the
  Ingestor authenticated to the new project with the new key and all five writes landed
  (request `f3c3647e` + scan run `e9287e0e`), zero schema-cache/missing-RPC errors — but
  the Gmail scan failed at `invalid_grant` (expired Google OAuth token, 0 documents), so
  the full Gmail→Drive→DB document demonstration is **deferred**
  (`INGESTOR-DOC-CYCLE-VERIFY-DEFERRED`, gated on token refresh, tied to
  `CAMADA3-OAUTH-GRANT-COUPLING`). **Two order claims corrected against live evidence,
  both architect-withdrawn:** the named CI file `.github/workflows/ingestor-ci.yml` does
  not exist (nothing deleted); the `document_scan_runs` anon-INSERT hole
  (`PRODUCTION-SECURITY-01`) was disproven live and not registered — the real finding is
  `ANON-GRANT-DEFENSE-IN-DEPTH` (27 non-document tables, registered). **Drive/OAuth
  unchanged** (ruling #4). **No Supabase writes issued by Claude** (the watcher wrote via
  the Ingestor's own service_role key; all Claude MCP calls read-only); **no production
  access; no push.** Full detail: `docs/ledgers/G28_LEDGER.md` `M8` entry. Next: `M4`
  (or any `M5`-`M10`), plus the deferred doc-cycle verification.
- **Staging-only execution boundary (`STAGING-ONLY-EXECUTION-BOUNDARY-A`,
  2026-07-15, partially superseded):** operational environment is staging
  `ucrjtfswnfdlxwtmxnoo`; the protected project `bhgifjrfagkzubpyqpew` is `OUT OF
  SCOPE`, **never accessed** — this don't-touch rule stays fully in force. Its
  "Vercel not selected" / production-postponement items are **superseded** by the
  amended criterion + active `M0`-`M10` track (target = the new
  `gqmpsxkxynrjvidfmojk`, not the protected project). **Further amended by `M1`
  (2026-07-17):** `ucrjtfswnfdlxwtmxnoo` is now **read-only legacy** (writes
  authorized only for the named `M`-track phases against `gqmpsxkxynrjvidfmojk`);
  the `bhgifjrfagkzubpyqpew` don't-touch rule is unaffected. Full original in the
  archive.

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
- **`ANON-GRANT-DEFENSE-IN-DEPTH` — `NOT AUTHORIZED`, first-week debt (registered
  `M8`, 2026-07-18):** in `gqmpsxkxynrjvidfmojk` (verified live, read-only), **27
  non-document `public` tables** carry raw table-level `anon`
  `INSERT`/`UPDATE`/`DELETE` grants (`clientes`, `cores`, `entregas`, `entrega_itens`,
  `expedicoes`, `expedicao_itens`, `expedicao_movimentos`, `expedicao_movimento_itens`,
  `fornecedores`, `lotes`, `modelos`, `op_eventos`, `op_fornecedores`, `op_itens`,
  `op_latex_entregas`, `op_numeros`, `ops`, `ordens_compra_fio`, `parametros_largura`,
  `pedidos`, `pedido_itens`, `pedido_cliente_eventos`, `pedido_eventos`,
  `pedido_parciais`, `pedido_parcial_itens`, `precos_terceirizada`, `saldo_fios`,
  `saldo_fios_op`, `usuarios` — RLS enabled on all). **Not a live hole:** every write
  is blocked today because the effective policies gate on
  `is_admin()`/`meu_fornecedor_id()`/`meu_cliente_id()`, all of which evaluate
  false/null for an unauthenticated `anon` session. The defect is that grants and
  policies disagree: a table whose safety rests entirely on policy correctness has no
  second line of defence — a future policy edit that widens a `USING`/`WITH CHECK`
  clause would immediately become an anon write path. **Pre-existing, faithfully
  migrated** from the `db/*` grant statements (same origin as the schema replay), not
  introduced by any `M`-track phase. Fix (its own future order): revoke the anon DML
  grants so grants agree with policies; verify the admin/cliente/fornecedor RLS paths
  still function. **Related to but distinct from `IS-ADMIN-ACL-REVIEW`** (that concerns
  the `is_admin()` anchor function's own `EXECUTE` ACL; this concerns table-level DML
  grants) — cross-referenced, **not merged**. The `document_*` family does **not**
  share this shape (checked: RLS on, `is_admin()`-gated, zero anon grants), so there is
  no document-side sibling. Discovered during the `M8` sibling sweep after the
  originally-suspected `document_scan_runs` anon-INSERT premise was disproven live
  (that premise was withdrawn; `PRODUCTION-SECURITY-01` was not registered).
- **`INGESTOR-DOC-CYCLE-VERIFY-DEFERRED` — `NOT AUTHORIZED`, follow-up (registered
  `M8`, 2026-07-18):** `M8` proved the Ingestor repoint at the Supabase layer (new
  `sb_secret_` key auth + schema compatibility + five real writes landed in
  `gqmpsxkxynrjvidfmojk` — request `f3c3647e` + scan run `e9287e0e`, both finalized
  `failed`), but the full Gmail→Drive→DB document cycle did **not** complete: the real
  scan failed at `invalid_grant` (expired Google OAuth token, 0 documents). Deferred
  by architect decision (M8 close, 2026-07-18). To close: refresh the Google OAuth
  token (interactive login — architect action, coupled to
  `CAMADA3-OAUTH-GRANT-COUPLING`, same client the backup exporter reuses), seed one
  fresh `document_scan_requests` row (the migrated one was consumed as `failed` during
  verification), run the watcher once, and confirm a real document lands with its Drive
  file resolving. Tie to `CAMADA3-OAUTH-GRANT-COUPLING`.
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
  `gqmpsxkxynrjvidfmojk` — **`M2` schema replayed** (`db/01→64`, 64 registry entries,
  40 public tables / 53 functions / 67 policies / 9 triggers / 0 views / 0 buckets;
  see "Migration governance" `M2` record +
  `docs/reports/M2_SCHEMA_REPLAY_VERIFICATION_2026-07-17.md`) and **`M3` production
  data migrated** (auth remap 24 rows/1 column, FK integrity 76/76 relationships
  clean, sequences 10/10 resynced, `parametros_largura` overwritten from legacy
  live values — see "Migration governance" `M3` record) and **`M8` Ingestor
  repointed** (both `.env` copies + both `.ps1` guards + both runbooks → new project;
  new-format `sb_secret_` key pasted by the architect; Supabase-layer write verified
  live, full doc cycle deferred on the expired Google token — see "Migration
  governance" `M8` record). New-format publishable key supplied; the matching secret
  key is now in use by the Ingestor (`.env`, gitignored, out of band). Vercel
  `vercel.com/inttex` (repo-linked, not wired). Remaining wiring (`js/config.js`
  client repoint, Edge Functions, Vercel) `NOT AUTHORIZED` until the relevant
  `M4`-`M7`/`M9`/`M10` order. **Supabase MCP:** flipped to write for `M2`/
  `M3` and now resolves to the **management-scoped** server (explicit `project_id`
  per call); **to be flipped back to read-only** by the architect — standing reminder.
- **Remotes:** `production` = `https://github.com/inttexsystem/inttracker.git`
  (fetch+push, added at `M0`); `origin` = `grupoterrabranca/controle-tapetes`;
  `staging` = `ravatexapps-dotcom/controle-tapetes-staging` (historical backup only,
  no longer a push target). All three present on the local repo; no branch other than
  `main` pushed to `production`.
- **MCP (new project):** Supabase MCP is configured and verified against
  `gqmpsxkxynrjvidfmojk`, **read-only**, its token held **outside the repo**
  (`PROJECT-STATE-COMPACTION-B`, 2026-07-17). **`M1` confirmed directly** (not just
  by profile inference): `claude mcp list` reports the connection URL
  `https://mcp.supabase.com/mcp?project_ref=gqmpsxkxynrjvidfmojk&features=database&
  read_only=true`, pinning both the ref and the read-only flag in the MCP's own
  configuration string. Read-only introspection of the new project is available;
  no write path is authorized outside a specific `M2`-`M10` order.
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
| Documents Ingestor Repoint — `M8` (legacy `ucrjtfswnfdlxwtmxnoo` → `gqmpsxkxynrjvidfmojk`; config only, out of sequence) | `CLOSED / ACCEPTED` | 2026-07-18 | (config: 2×`.env` gitignored + 2×`.ps1` + 2×runbook; docs record) |
| Production Data Migration — `M3` (legacy `ucrjtfswnfdlxwtmxnoo` → `gqmpsxkxynrjvidfmojk` + `parametros_largura` overwrite) | `CLOSED / ACCEPTED` | 2026-07-17 | (Supabase writes: data migration + `parametros_largura` UPDATE + docs record) |
| Schema Replay into Sanctioned Target — `M2` (`db/01→64` → `gqmpsxkxynrjvidfmojk`) | `CLOSED / ACCEPTED` | 2026-07-17 | (Supabase writes: 64 migrations + docs record) |
| Supabase Target Verification + Sanction — `M1` (`gqmpsxkxynrjvidfmojk`) | `CLOSED / ACCEPTED` | 2026-07-17 | (docs, read-only verification) |
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
