# CAMADA 2 — User Administration — Proposed Spec

> **Status:** `PROPOSED` — no subphase authorized by this document.
> **Origin phase:** `CAMADA2-USUARIOS-SPEC-DIAGNOSTIC-R1` (read-only
> cross-repo diagnostic, 2026-07-15), reviewed and incorporated with the
> architect's decisions in `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`.
> **Functional/visual reference:** `D:\OneDrive\Programação\SGAA_clean_baseline`
> (unrelated Flask/SQLite project — see caveat below).
> **Not a source of current state.** Operational state lives in
> `PROJECT_STATE.md`; continuity in `AGENT_HANDOFF.md`; history in
> `docs/ledgers/G28_LEDGER.md`.

---

## CRITICAL CAVEAT — SGAA is not a security reference

The SGAA_clean_baseline (Flask + SQLite, a stack completely distinct from
Supabase/JS) has at least **four practices that this spec explicitly
REJECTS, not adapts**:

1. **Default passwords per role stored and displayed in plain text** on
   the admin screen, including in the `value=` attribute of an
   `<input type="password">` (visible via view-source/devtools) —
   `admin_acesso.html:201-245`, `main.py:499-505`. This is the opposite of
   what the Tapetes master plan already requires (temporary password must
   expire, be single-use, non-recoverable, not reused across users —
   master plan L711-716).
2. **Zero password complexity policy** — no length/character-class
   check anywhere in the SGAA.
3. **Zero auditing** — no table or log of who created/edited/deactivated/
   reset a user.
4. **Destructive confirmation via the browser's native `window.confirm()`**,
   not custom modals — Tapetes already has `confirmDialog()` in
   `js/ui.js:100-111`, visually and functionally superior.

**Correct use of the SGAA in this spec:** reference for **information
architecture and screen organization** (two-axis role+permission model,
summary cards per role, search/sort/filter toolbar, status badges,
icon-per-action) — never for security policy. Where the two conflict, the
stricter standard of the Tapetes master plan prevails.

---

## Tapetes visual baseline (to extend — not to redesign)

`screenCadastrosUsuarios` (`js/screens/cadastros.js:2226-2713`, inside a
2,750-line file with 7 embedded screens) already establishes its own
coherent visual language for this screen: custom CSS grid, status badges
(`#e6f4ec`/`#18794a` active, `#fff1f1`/`#d6403a` inactive), icon-only
action buttons with disabled/opacity states, search with icon, "Mostrar
inativos" toggle, palette `#16203a`/`#8a93a3`/`#2563eb`/`#d8dce2`/
`#eceef1`, low `border-radius` (4-6px). **This is the language to
extend**, not the generic `dataTable()` from `js/ui.js` (which the
current screen itself no longer uses) nor the SGAA's card-list.

From the SGAA, this spec borrows only **organizational ideas**,
redesigned with the tokens above: summary cards per role at the top,
search+sort+filter toolbar, role badge with color per type, icon per
action (Lucide-style, already used in `cadastros.js` via `svgIcon()`).

---

## Architect decisions incorporated (2026-07-15)

These decisions replace the options raised in the original diagnostic —
they are no longer open choices, they are premises of this spec:

- **`nivel_acesso`:** 2 levels (`completo` / `somente_leitura`), simple
  CHECK constraint, expandable later if needed.
- **Override table (`usuarios_permissoes`):** **NOT BUILT** in this
  spec. Recorded as a future option, conditioned on demonstrated real
  need — not speculatively pre-built.
- **A4 (invitation/initial password):** single path = temporary password
  + forced change on first login. **A4.3 (invitation via e-mail/SMTP):
  `NOT AUTHORIZED`** — requires its own Auth risk diagnostic in a
  separate order; not scheduled in this spec.
- **A3.3 (bulk actions):** `DEFERRED` — bulk-write risk disproportionate
  to the current size of the Tapetes user base.

---

## A1 — Authentication diagnostic

- **SGAA does:** hand-rolled Flask session (signed cookie), no real
  Flask-Login (imported but dead in the code), no JWT, PBKDF2-SHA256/600k
  iterations hashing, CSRF via Flask-WTF, in-memory rate-limit (not
  multi-worker-safe, documented as such).
- **Already exists in Tapetes:** `auth.users` (Supabase Auth) +
  `public.usuarios` 1:1 by UUID (`auth.users.id = public.usuarios.id`,
  invariant protected by `CODE_HEALTH_RULES.md` §11); `js/auth.js` (151
  lines) — `signInWithPassword`, `getSession`, singleton `CURRENT_USER`;
  RLS via `is_admin()`/`meu_fornecedor_id()`/`meu_cliente_id()` (`db/12`,
  `db/14`).
- **What's missing:** nothing structural — Tapetes is already
  structurally ahead of the SGAA here (JWT + expiration + revocation
  native to Supabase Auth vs. a cookie with no revocation whatsoever in
  the SGAA).
- **Proposal:** no mechanism change. A1 amounts to formally documenting
  what already exists (this document) as a baseline for A2-A7.
- **Modules/files:** none new.
- **Risks (Auth!):** none — no Auth change in this step.
- **Subphase/gate:** A1 = `DIAGNOSED / DECIDED` by this very document;
  does not require implementation.

---

## A2 — Roles and permissions

- **SGAA does:** two axes — `usuarios.tipo` (admin/aluno) + `nivel_acesso`
  (free-form string, 5 values) + granular override table
  `usuarios_permissoes_acesso(usuario_id, recurso, escopo)` with 15
  resources × 4 scopes, merged via `merge_resource_scopes()`.
- **Already exists in Tapetes:** only one axis —
  `usuarios.tipo ∈ {admin,fornecedor,cliente}` (CHECK constraint,
  `db/14:66`), no permissions table (confirmed by exhaustive search in
  `db/*.sql`: zero occurrences). Enforcement = `roles:[...]` per route
  (`js/boot.js`) + RLS.
- **What's missing:** any granularity within `admin` (today it's
  all-or-nothing).
- **Architect's decision:** `nivel_acesso` with **2 levels**
  (`completo`/`somente_leitura`), expandable CHECK; **no** override table
  in this spec.
- **Proposal:**
  1. Keep `usuarios.tipo` untouched (anchor of all existing RLS).
  2. Add `usuarios.nivel_acesso TEXT NOT NULL DEFAULT 'completo'`,
     `CHECK (nivel_acesso IN ('completo', 'somente_leitura'))` — relevant
     only for `tipo='admin'`.
  3. Helper `is_admin_completo()` (or equivalent), same
     `SECURITY DEFINER STABLE` pattern as `is_admin()` (`db/12:59-78`),
     requiring `ativo IS TRUE`.
  4. Future record (not built now): if the architect confirms a real need
     for per-user override, evaluate
     `public.usuarios_permissoes(usuario_id, recurso, escopo)` in the same
     format as the SGAA, sized to the demonstrated real need.
- **Planned modules/files:**
  - `db/5X_admin_nivel_acesso_schema.sql` — column + CHECK + helper
    function (schema/RPC, staging-only, without touching Auth).
  - `js/screens/admin-usuarios-modal.js` (new) — includes a level select
    when `tipo=admin`.
- **Risks (Auth!):** none — pure schema/RLS in `public.`, zero
  `auth.admin.*` calls. **Staging ok.**
- **Subphase/gate:** A2.1 (schema+helper, staging) → A2.2 (wiring in the
  create/edit modal, part of A3.1/A3.2 per schedule) → A2.3 (enforcement
  in at least 1 pilot route before expanding).

---

## A3 — User administration

- **SGAA does:** single list+modal screen (`admin_acesso.html`), 5
  summary cards per role, search/sort/filter toolbar, bulk actions
  (select all/delete/reset/new password), grid row of `<div>` (not
  `<table>`), floating action pill on hover.
- **Already exists in Tapetes:** `screenCadastrosUsuarios`
  (`cadastros.js:2226-2713`) already covers: listing (search+toggle
  inactive), creating (`openModal`→Edge `admin-create-user`), editing
  (direct PostgREST `.update()` — no Edge Function, no password field),
  deactivating (`admin-disable-user`), hard deletion (`admin-delete-user`,
  confirms target e-mail).
- **What's missing:** summary cards per role; last-access column; the
  screen lives inside a 2,750-line file with 7 screens — active violation
  of §7 (`CODE_HEALTH_RULES.md`, exceptional limit of 900 lines).
- **Proposal:** extract the user functionality into its own modules
  (outside `cadastros.js`), preserving 100% of the existing visual/grid
  behavior.

### A3.1 — 1:1 extraction + route cutover (revision adjustment)

Unlike the original diagnostic, **A3.1 now ends with the route
cutover**, not just the extraction:

1. Port `screenCadastrosUsuarios` 1:1 (no new feature) to the new
   modules below.
2. Switch the `#/cadastros/usuarios` route handler in `js/boot.js` from
   `screenCadastrosUsuarios` to `screenAdminUsuarios`.
3. **Mandatory architect visual validation** before accepting A3.1 — 1:1
   parity confirmed on the real screen.
4. `screenCadastrosUsuarios` **remains in `cadastros.js` as dead code**
   until A3.4 (not removed yet — refactor vs. cutover isolation, §14).

### A3.2 — Summary cards, toolbar, and last access (mockup gate)

- **Entry gate:** A3.2 **only starts after architect approval of the
  mockup** of the summary cards per role + search/sort/filter toolbar
  (new visual elements, with no direct precedent in the current screen),
  built on the tokens already cited in the Visual Baseline above.
- **Last access — scope included in this subphase:** new read-only
  column in the grid, reading `auth.users.last_sign_in_at` (the exact
  read path — `SECURITY DEFINER` RPC vs. field already exposed via admin
  session — is defined within the subphase itself; no write in any case).
- Summary cards per type (Admin/Fornecedor/Cliente + active/inactive),
  following the `pageHeader()` pattern.
- Search+sort+filter toolbar, same palette as the visual baseline.

### A3.3 — Bulk actions

**`DEFERRED`** by architect decision — bulk-write risk disproportionate
to the current size of the Tapetes user base. Not scheduled; resume only
upon a new explicit decision.

### A3.4 — Final cutover (pure, isolated refactor)

Revision adjustment: A3.4 is no longer the "route cutover" (already
done in A3.1) and becomes **exclusively the removal of the legacy code**
of `screenCadastrosUsuarios` in `cadastros.js` — isolated phase, pure
refactor, no mixing with feature work (§14). Reduces `cadastros.js` by
~490 lines (2226-2713).

- **Planned modules/files:**
  - `js/screens/admin-usuarios.js` (new, orchestration/render, ≤500
    lines) — `screenAdminUsuarios()`, summary cards, search, toggle, grid
    (ported 1:1 from the current visual).
  - `js/screens/admin-usuarios-modal.js` (new, create/edit) — same
    3-file format as the precedent `document-link-admin-modal.js`.
  - `js/admin-usuarios-writes.js` (new, explicit writes — pattern of
    `entrega-writes.js`/`op-writes.js`, §9): encapsulates
    `functions.invoke('admin-create-user'|'admin-disable-user'|'admin-delete-user'|...)`.
  - `js/boot.js` — switches the `#/cadastros/usuarios` route handler
    (A3.1).
  - `index.html` — add `<script src="js/screens/admin-usuarios.js?v=<current version>"></script>`
    and `<script src="js/screens/admin-usuarios-modal.js?v=<current version>"></script>`
    and `<script src="js/admin-usuarios-writes.js?v=<current version>"></script>`
    in the correct dependency order (writes → modal → screen), with the
    cache-busting version current at the time of the phase (§2/§12); no
    `?v=` on CDNs.
- **Risks (Auth!):** none new — reuses the 3 existing, already accepted
  Edge Functions, without touching `auth.admin.*` in any new way.
- **A3.1 gates (revision adjustment, §13):**
  - `node --check` on the new/changed JS files.
  - Module smoke test (`admin-usuarios`, `admin-usuarios-modal`,
    `admin-usuarios-writes`).
  - **Route/boot smoke** (mandatory — `index.html`/`boot.js`/script order
    were changed).
  - **Update of the existing `index.html` smokes** to accept the new
    `?v=` pattern on the 3 new scripts (§13).
  - Architect visual validation (1:1 parity).
- **Consolidated subphase/gate:** A3.1 (extraction + cutover + visual
  validation) → A3.2 (approved mockup → summary cards + toolbar + last
  access) → A3.3 `DEFERRED` → A3.4 (removal of legacy code, isolated
  refactor).

---

## A4 — Invitation / initial password

- **SGAA does:** no invitation at all — the user is created directly by
  the admin with a password (custom or default-per-role), communicated
  out of band; zero e-mail capability in the entire repo.
- **Already exists in Tapetes:** the same model — `admin-create-user`
  requires `password` in the payload (min. 6 chars, `index.ts:36,127`),
  `email_confirm:true` (no e-mail verification), no e-mail sending, no
  "pending/invited" state.
- **What's missing:** mandatory password change on first login; any
  e-mail capability (Supabase Auth SMTP not configured — no
  `supabase/config.toml`, confirmed absent).
- **Architect's decision:** single path = **temporary password +
  forced change** (path 1 of the diagnostic). **A4.3 (e-mail/SMTP): `NOT AUTHORIZED`** — not scheduled, requires its own Auth risk diagnostic in
  a separate order if the architect wants this path in the future.
- **Proposal:**
  - `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` +
    `senha_gerada_em TIMESTAMPTZ`.
  - `admin-create-user` sets `senha_temporaria=TRUE` on creation.
  - Boot guard: if `senha_temporaria=TRUE` (or expired — see Password
    Policy), the app forces a change screen before releasing any route,
    via **self-service** `auth.updateUser({password})` (not an Admin API
    call — low risk).
  - RPC/trigger clears the flag at the moment of a successful change.
- **Planned modules/files:**
  - `db/5Y_admin_usuarios_senha_temporaria.sql` — columns + default
    (also covers the Password Policy, see below).
  - `supabase/functions/admin-create-user/index.ts` — 1 additional line
    in the insert (`senha_temporaria: true`).
  - `js/screens/trocar-senha-obrigatoria.js` (new, ≤150 lines) — forced
    change screen, called from `js/boot.js` (guard after
    `loadCurrentUser`, before navigating to the actual route).
  - `index.html` — add
    `<script src="js/screens/trocar-senha-obrigatoria.js?v=<current version>"></script>`
    in the correct order (after `js/auth.js`, before the main inline
    script that decides navigation), current cache-busting version, no
    `?v=` on CDNs (§2/§12).
- **Risks (Auth!):** **LOW** — self-service `auth.updateUser`, no new
  Admin API, staging ok.
- **Subphase/gate:** A4.1 (schema flag + password policy, staging) →
  A4.2 (boot guard + change screen, self-service Auth, with
  `index.html`/cache-busting update and route/boot smoke) → A4.3 **NOT AUTHORIZED** (no subphase scheduled).

---

## A5 — Reset, blocking, and reactivation

- **SGAA does:** reset to default-password-per-role (plain text,
  **rejected** — see caveat) or bulk custom password; blocking only for
  "aluno" (`status='Inativo'`, and it isn't even checked at login —
  factual finding: it is merely informational, not a real gate); no
  reactivation for the "admin" type (only hard-delete exists for that
  axis).
- **Already exists in Tapetes:** blocking via `admin-disable-user`
  (soft `ativo=false` + Auth ban `876000h`, with self/last-admin guards —
  already more robust than the SGAA). **Password reset: does not exist.
  Reactivation: does not exist.**
- **What's missing:** (a) administrative password reset; (b)
  reactivation (`ativo=true` + reverting the ban).
- **Proposal:**
  1. **Reset:** new Edge Function `admin-reset-user-password`, same
     skeleton as `admin-create-user` (JWT→admin→payload validation),
     generates a random temporary password (not a fixed
     default-per-role — avoids the SGAA anti-pattern), calls
     `auth.admin.updateUserById(target_id, {password: novaSenhaAleatoria})`,
     sets `usuarios.senha_temporaria=TRUE` (reuses A4.1), never echoes
     the password in logs, returns the password once in the HTTP
     response.
  2. **Reactivation:** new Edge Function `admin-reactivate-user`,
     symmetric to `admin-disable-user` — `ativo=true`, clears
     `desativado_em/por/motivo`, `auth.admin.updateUserById(target_id, {ban_duration: 'none'})`.
- **Planned modules/files:**
  - `supabase/functions/admin-reset-user-password/index.ts` (new,
    mirrors the existing skeleton).
  - `supabase/functions/admin-reactivate-user/index.ts` (new, mirrors
    `admin-disable-user`).
  - `js/admin-usuarios-writes.js` — 2 new wrapper functions (same file
    already planned in A3, no new module).
  - `js/screens/admin-usuarios.js` — 2 new action buttons (reset icon /
    reactivate icon), reusing the already-existing icon-button style.
- **Risks (Auth!):** **MEDIUM** — both use
  `auth.admin.updateUserById`, a surface already used in the repo (for
  ban), but with a new parameter (`password` / `ban_duration:'none'`)
  never exercised. Requires dedicated staging verification (synthetic
  fixtures, role matrix) equivalent to what `admin-disable-user`
  received. **Staging ok, with dedicated verification.**
- **Explicit scope — session revocation (revision adjustment):** **OUT
  OF SCOPE** for this spec. The ban applied by `admin-disable-user`
  already covers the critical case (deactivated user loses access).
  Explicit revocation of a specific active session (without deactivating
  the account) is not built here; reopening requires its own architect
  decision.
- **Subphase/gate:** A5.1 (reset — Edge Function + local tests) → A5.2
  (staging verify of the `updateUserById({password})` call) → A5.3
  (reactivation — Edge Function + tests) → A5.4 (symmetric staging
  verify).

---

## A6 — Auditing

- **SGAA does:** nothing — confirmed by exhaustive search, zero
  table/column for auditing administrative actions. The only log is
  technical (login failure, rotating file, no UI).
- **Already exists in Tapetes:** only
  `desativado_em/desativado_por/motivo_desativacao` (`db/12:38-42`) —
  only for deactivation.
- **What's missing:** an audit trail for all administrative actions on
  users.
- **Proposal:** follow the precedent already accepted and tested in
  this repo — `document_link_revisions`/`document_link_revision_ops`
  (G28-B5) and `op_eventos`+trigger (`db/21`, Phase L) are exactly this
  pattern (append-only event table + automatic trigger).
  - Table `public.usuarios_eventos(id, usuario_id, tipo_evento, ator_id, payload JSONB, criado_em)`
    — same design as `op_eventos`.
  - Trigger `trg_usuario_evento` on relevant changes to `usuarios`
    (ativo, tipo, nivel_acesso) — single source of truth.
  - Actions via Edge Function (create/delete/reset/reactivate, which use
    `service_role` and don't always go through a direct `UPDATE`)
    explicitly write one row each.
  - UI: read-only audit panel in the user edit modal (mirroring the
    pattern already approved in `document-link-admin-modal.js`).
- **Planned modules/files:**
  - `db/5Z_usuarios_auditoria_schema.sql` — table + trigger + admin-only
    RLS.
  - `js/admin-usuarios-audit-read-model.js` (new, pure — mirror of
    `document-link-audit-read-model.js`, ≤200 lines).
  - `js/screens/admin-usuarios-audit-panel.js` (new, read-only render,
    ≤200 lines).
  - The 3 existing Edge Functions + the 2 new ones (A5) each gain 1
    insert into `usuarios_eventos`.
  - `index.html` — add
    `<script src="js/admin-usuarios-audit-read-model.js?v=<current version>"></script>`
    and `<script src="js/screens/admin-usuarios-audit-panel.js?v=<current version>"></script>`
    in the correct order (read-model before the panel), current version,
    no `?v=` on CDNs.
- **Risks (Auth!):** none — pure schema/trigger/RLS in `public.`, no
  new `auth.admin.*` calls. **Staging ok.**
- **Subphase/gate:** A6.1 (schema+trigger, staging) → A6.2 (wiring of
  the existing Edge Functions) → A6.3 (read-only panel in the UI, with
  `index.html`/cache-busting update and route/boot smoke).

---

## A7 — Preparation for external users

- **SGAA does:** the `aluno` axis is completely isolated, zero
  administrative RBAC access, "only my data" scope via ad hoc
  `aluno_id=?` in each view.
- **Already exists in Tapetes:** already implemented and more mature
  than the SGAA on this point — `usuarios.cliente_id`/`fornecedor_id`
  with an exclusive-link constraint (`db/14:109-117`), RLS via
  `meu_cliente_id()`/`meu_fornecedor_id()` (not scattered ad hoc checks),
  full Client Portal (`#/cliente/*`).
- **What's missing:** essentially nothing structural.
- **Proposal:** no new implementation required. A7 is documented as
  `SATISFIED BY EXISTING ARCHITECTURE`.
- **Planned modules/files:** none new.
- **Risks (Auth!):** none.
- **Subphase/gate:** A7 = `DIAGNOSED / ALREADY SATISFIED` — no
  implementation subphase.

---
## Password policy (cross-cutting A4/A5)

- **SGAA does:** no complexity rule at all; fixed default password
  reused per role, in plain text; PBKDF2-SHA256/600k hashing
  (reasonable, but no action here — managed internally by Supabase
  Auth).
- **Already exists in Tapetes:** only a minimum of 6 characters
  (`admin-create-user/index.ts:36`), no expiration, no single-use, no
  prevention of reuse across users.
- **What's missing:** the 4 requirements from the master plan
  (L711-716): expire, single-use, non-recoverable, not reused across
  users.
- **Proposal:**
  - **Single-use / expire:** resolved by the `senha_temporaria` flag
    (A4.1) — once changed, it stops being "the current password" by
    definition; `senha_gerada_em` allows checking expiration (e.g., 7
    days) at boot, forcing a reset via A5 if expired.
  - **Non-recoverable:** already satisfied — Edge Functions never
    persist the password in plain text anywhere (not even in logs),
    they only return it once in the HTTP response.
  - **Not reused across users:** generate a random temporary password
    per call, never a fixed value per role — eliminates the SGAA
    anti-pattern at the root.
  - **Minimum complexity:** raise from 6 to 8 characters + at least 1
    digit, trivial to satisfy automatically for a system-generated
    password.
- **Planned modules/files:** incorporated into A4.1/A5.1 (same
  migration/Edge Functions, no dedicated extra file).
- **Risks (Auth!):** **LOW** — validation policy change in
  `public.`/Edge Function, without touching the Supabase project's
  Auth configuration.

---

## Consolidated module plan (updated with `index.html`/cache-busting)

| File | Type | Covers | Estimated lines |
|---|---|---|---|
| `db/5X_admin_nivel_acesso_schema.sql` | Migration | A2 | ~80 |
| `db/5Y_admin_usuarios_senha_temporaria.sql` | Migration | A4, Password policy | ~40 |
| `db/5Z_usuarios_auditoria_schema.sql` | Migration | A6 | ~120 |
| `supabase/functions/admin-reset-user-password/index.ts` | Edge Function (new) | A5 | ~200 (mirrors the existing one) |
| `supabase/functions/admin-reactivate-user/index.ts` | Edge Function (new) | A5 | ~180 (mirrors the existing one) |
| `supabase/functions/admin-create-user/index.ts` | Edge Function (existing, targeted extension) | A4 | +5 lines |
| `js/screens/admin-usuarios.js` | Screen (new) | A3 | ≤500 |
| `js/screens/admin-usuarios-modal.js` | Modal (new) | A2, A3 | ≤500 (mirrors `document-link-admin-modal.js`) |
| `js/admin-usuarios-writes.js` | Writes (new) | A3, A5 | ≤250 |
| `js/admin-usuarios-audit-read-model.js` | Pure (new) | A6 | ≤200 (mirrors `document-link-audit-read-model.js`) |
| `js/screens/admin-usuarios-audit-panel.js` | UI (new) | A6 | ≤200 |
| `js/screens/trocar-senha-obrigatoria.js` | Screen (new) | A4 | ≤150 |
| `js/boot.js` | Existing, targeted edit | A3.1 (route cutover), A4 | +a few lines |
| `index.html` | Existing, targeted edit | A3.1, A4.2, A6.3 | +8 `<script>` lines (3+1+2 tags, current cache-busting version) |

No new file exceeds the "acceptable" limit (§7, 500 lines); all
follow the domain naming convention (§6).

**Location of pure/writes modules at the root of `js/` (not under
`js/screens/`):** `js/admin-usuarios-writes.js` and
`js/admin-usuarios-audit-read-model.js` follow the already
established and accepted precedent of the
`document-link-admin-controller.js` / `document-link-audit-read-model.js`
trio (both at the root of `js/`, not under `js/screens/`) — a
conscious decision to keep consistency with that recent precedent,
not a deviation from §6 (which governs the content of `js/screens/`,
not the location of cross-cutting pure/controller modules).

---

## Auth risk classification — summary

| Item | Touches new `auth.admin.*`? | Touches project Auth config? | Classification |
|---|---|---|---|
| A1 | No | No | No risk |
| A2 | No | No | **Staging ok** |
| A3 | No (reuses existing ones) | No | **Staging ok** |
| A4.1-A4.2 (temp. password) | No (self-service `updateUser`) | No | **Staging ok, low risk** |
| A4.3 (email invite) | Yes (`generateLink`) | **Yes (SMTP)** | **NOT AUTHORIZED — own risk diagnostic required, not included in this spec** |
| A5 (reset/reactivation) | **Yes, new parameter** (`password`, `ban_duration:'none'`) | No | **Medium — staging ok with dedicated verification** |
| A6 | No | No | **Staging ok** |
| A7 | No | No | No risk (already satisfied) |
| Password policy | No | No | **Staging ok** |

---

## Recommended subphase order with gates (updated)

| # | Subfase | Depende de | Gate de saída |
|---|---|---|---|
| 1 | A1 — documentation consolidation | — | `DIAGNOSED/DECIDED` (satisfied by this document) |
| 2 | A2.1 — `nivel_acesso` schema (2 levels) + helper | A1 | Staging applied + verified |
| 3 | A3.1 — 1:1 extraction + **route cutover** (`boot.js`) + `index.html`/cache-busting + route/boot smoke test + architect visual validation | — (parallel to A2.1) | Regression tests + boot smoke green; visual parity confirmed by the architect |
| 4 | A4.1 — `senha_temporaria`/`senha_gerada_em` schema + password policy | — | Staging applied |
| 5 | A4.2 — boot guard + mandatory change screen + `index.html`/cache-busting + route/boot smoke test | A4.1, A3.1 | Local test + staging smoke |
| 6 | A2.2/A2.3 — `nivel_acesso` wiring in the modal + 1 pilot route | A2.1, A3.1 | Staging verified |
| 7 | **Mockup gate** — architect approval for summary cards + toolbar | A3.1 | Mockup approved |
| 8 | A3.2 — summary cards, toolbar, **last access** (`last_sign_in_at`) | Mockup gate (7) | Staging verified + visual validation |
| 9 | A5.1-A5.2 — password reset (Edge Function + staging verify) | A4.1 | Role matrix in staging (mirrors `admin-disable-user`) |
| 10 | A5.3-A5.4 — reactivation (Edge Function + staging verify) | — (parallel to A5.1-2) | Role matrix in staging |
| 11 | A6.1-A6.3 — audit (schema+trigger, wiring, UI panel + `index.html`/cache-busting + route/boot smoke test) | A3.1 (for the panel) | Staging verified + UI smoke |
| — | A3.3 — bulk actions | — | **`DEFERRED`** by architect decision; not scheduled |
| 12 | A3.4 — removal of legacy code in `cadastros.js` (pure, isolated refactor) | All previous ones accepted | Isolated phase, docs-only + minimal diff |
| — | A4.3 — email/SMTP invite | Separate architect decision | **`NOT AUTHORIZED`** — requires its own Auth risk diagnostic |
| — | A7 | — | `ALREADY SATISFIED`, no subphase |
| — | Explicit session revocation | Separate architect decision | **Out of scope** for this spec |

None of these subphases are authorized by this document — each one
requires explicit, individual architect authorization at its own
time (permanent project rule: phases do not chain automatically).

---

## Refactor governance (§16 CODE_HEALTH_RULES.md)

`docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` becomes part of the
mandatory closeout artifacts for **A3.1** (new structural module:
screen extraction + route cutover) and **A3.4** (structural change:
removal of legacy code from `cadastros.js`). The remaining subphases
(A2, A4-A6) do not introduce a new structural module in the sense of
§16 (they are additive schema/Edge Function/panel changes) and do not
require an entry in this ledger — only the standard closeout artifacts
(`PROJECT_STATE.md`, `AGENT_HANDOFF.md`, G28 ledger).

---

## STRUCTURAL POLICY COMPLIANCE

- **Canonical files read:** `docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md` §1,
  `docs/architecture/CODE_HEALTH_RULES.md` (in full, 18 rules),
  `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`
  (Camada 2 §688-728), `PROJECT_STATE.md`/`AGENT_HANDOFF.md`.
- **Applicable invariants:** `auth.users.id = public.usuarios.id` (§11)
  — preserved, no proposal touches it; file size limit
  (§7) — all new modules sized below the acceptable ceiling;
  screen/writes/pure separation (§6, §8, §9) — explicitly respected
  in the module plan; cache-busting (§2, §12) — explicitly addressed
  for every subphase that changes `index.html`; tests proportional to
  risk (§13) — A3.1/A4.2/A6.3 gates include route/boot smoke tests;
  refactor governance (§16) — refactor ledger addressed for A3.1/A3.4.
- **Rejected proposals:** SGAA's 15-resource matrix (over-
  engineering); fixed default password per role (vulnerability);
  confirmation via native `window.confirm()` (visual regression);
  permission overrides table (not built — no real need demonstrated);
  bulk actions (deferred); email invite (not authorized); explicit
  session revocation (out of scope).
- **Conflicts found:** none among the Tapetes canonical documents; one
  practice conflict between SGAA and the Tapetes master plan (password
  policy) — resolved in favor of the stricter standard already
  required by the Tapetes canonical documents.
- **Decisions reserved for the architect:** mockup approval (gate
  before A3.2); individual authorization of each subphase in the table
  above; any future review of permission overrides, email invite, or
  session revocation, each as a separate decision.

## VISUAL POLICY COMPLIANCE

- **Files/skills consulted:** `js/ui.js` (in full),
  `js/screens/cadastros.js:2226-2426` (current grid/badges/icons),
  `js/screens/document-link-admin-modal.js` (modern 3-file pattern,
  structural reference).
- **Reused patterns:** row grid already in use on the users screen
  (not swapped for the generic `dataTable()`); already consolidated
  palette and tokens; `confirmDialog()`/`modal()` from `js/ui.js` for
  every new confirmation (not `window.confirm()`).
- **Proposed visual deviations:** summary cards per role and
  search+sort+filter toolbar (new, but following `pageHeader()`/the
  already used palette) — **mandatory mockup gate before building**
  (see A3.2).
- **Adherence evidence:** cited by file:line in each section above.
- **Visual validation required:** yes, mandatory before acceptance of
  A3.1 (1:1 parity) and of A3.2 (mockup + implementation of the new
  elements).

---

**PROPOSED — no subphase authorized; each one requires explicit,
individual architect authorization.**
