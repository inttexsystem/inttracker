# PROJECT_STATE — Archived Closeouts (2026-07)

> Historical closeout narratives moved out of `PROJECT_STATE.md` by
> `PROJECT-STATE-COMPACTION-A` (2026-07-16), verbatim and in their original
> order. This file is **not** a source of current state — the current
> operational state, the binding decisions in force, the live debts and the
> "Closed phases" index live in `PROJECT_STATE.md`. Binding rulings recorded in
> the Architect Decision sections below remain in force and are restated (in
> condensed form) in `PROJECT_STATE.md` §"Binding decisions in force"; in any
> divergence over the wording of a decision, this archive and the pt-BR
> original under `docs/archive/pt-BR/PROJECT_STATE.md` are authoritative.
> Append-only for this batch: do not edit or add new closeouts here.

---

## DOC-LANGUAGE-MIGRATION-L1 — Governance Documents Translated to English — CLOSED / ACCEPTED

- **Front:** `DOC-LANGUAGE-MIGRATION`, batch `L1` (governance and rules) —
  docs-only translation slice. First English-authored state block of the new
  language era.
- **Classification: `CLOSED / ACCEPTED`** (architect acceptance, 2026-07-16).
- **Scope:** translated to English, content only (file names, anchors, paths
  and cross-references unchanged): `docs/architecture/CODE_HEALTH_RULES.md`,
  `docs/governance/SUPERVISION_PROTOCOL.md`,
  `docs/governance/DOCUMENTATION_MODEL.md`, `CLAUDE.md`. Each pt-BR original was
  moved, in the same commit, to `docs/archive/pt-BR/<original-path>`
  (byte-for-byte). The language policy is recorded in the canonical homes
  (`DOCUMENTATION_MODEL.md` §18, `CODE_HEALTH_RULES.md` §19,
  `SUPERVISION_PROTOCOL.md` §3; `CLAUDE.md` pointer-summary). Canonical status
  vocabulary, the architect verbatim handoff block, the gate marker
  `IMPLEMENTAÇÃO VALIDADA / AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`, and
  `DOCUMENTATION_MODEL.md` §17 were preserved verbatim.
- **Audit (separate high-effort pass):** 2 divergences found and corrected —
  `DOCUMENTATION_MODEL.md` H1 title left in Portuguese (audit pass);
  `CLAUDE.md` `**PROIBIDA**` → `**FORBIDDEN**` (resident-executor final
  review). No `[pt: ...]` pending items.
- **Runtime note (accepted by architect):** Sonnet 5 was unavailable in this
  environment; the translate and audit passes ran on the session model — the
  two-pass structure and the medium/high effort split were preserved.
- **Commits:** `cab741c` — `Translate governance documents to English (L1)`;
  plus the follow-up `Record L1 in project state and fix rule counts` (this
  block + CODE_HEALTH rule count 18→19 in `DOCUMENTATION_MODEL.md` §2,
  `CLAUDE.md` and `docs/DOCUMENTATION_INDEX.md`). Consult HEAD with
  `git rev-parse HEAD`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Next authorizable action:** `ARCHITECT DECISION` — batches `L2`/`L3`
  (further canonical-doc translation) are not authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for L1).

## Camada 2 — Administrative Password Reset — A5.1-A5.2

- **Front:** `G28-CAMADA-2`, subphase `A5.1-A5.2` of
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, authorized after
  `A4.2`. `A5.3-A5.4` (reactivation) explicitly **not included** — its own
  future authorization.
- **Classification: `CLOSED / ACCEPTED`** (real e2e in staging `result:
  PASS` 15/15 + flow verified in a real browser by the executor; architect
  visual validation **waived by explicit decision**, covered by the e2e +
  flow-verification combination).
- **Technical HEAD:** `b726717` — `Add admin password reset`
  (`supabase/functions/admin-reset-user-password/index.ts` (new),
  `supabase/functions/admin-reset-user-password/README.md` (new),
  `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`,
  `js/screens/admin-usuarios-modal.js`,
  `scripts/staging/admin-reset-password-e2e.mjs` (new),
  `tests/admin-reset-user-password.smoke.js` (new),
  `tests/admin-usuarios.smoke.js`). **Documentation commit:** this
  closeout (`Close admin password reset phase`). The current HEAD must be
  consulted with `git rev-parse HEAD`.
- **Architect decision incorporated — self-reset BLOCKED:** an
  admin cannot reset their own password via `admin-reset-user-password`
  (`SELF_RESET_FORBIDDEN`) — uses the normal change flow (self-service,
  `A4.2`). Simplifies and avoids the footgun of an admin changing their own
  password to a generated value they themselves did not choose. There is no
  "last admin" guard (resetting a password does not deactivate anyone).
- **Edge Function (`admin-reset-user-password`):** mirror of the
  `admin-disable-user` skeleton — JWT→active admin→payload; temporary
  password generated via `crypto.getRandomValues` (12 characters,
  charset without visual ambiguity, deterministic guarantee of ≥1
  digit — never `Math.random`, never a fixed value);
  `auth.admin.updateUserById(target, {password})`; marks
  `senha_temporaria=true`/`senha_gerada_em=now()`; never logs the password;
  returns the password only once in the success response. Failure of the
  post-reset profile update (password already changed in Auth, with no safe
  compensation possible) returns an explicit error
  (`PROFILE_UPDATE_FAILED`), never silent success.
- **UI:** key-icon button on the users screen (same visual convention
  as the existing buttons) → `confirmDialog` (never
  `window.confirm`) → on success, "Senha gerada" modal with the password
  shown only once, copy button (Clipboard API with graceful fallback)
  and a notice that it will not be shown again. Error → toast, no ambiguous
  state.
- **Deploy in staging (`ucrjtfswnfdlxwtmxnoo`) executed by the
  architect** — outside the credential reach of this session (AI agent
  does not enter password/token/API key in any field, permanent rule).
- **Post-deploy verification — real E2E in staging, `result: PASS`
  (15/15), executed by the architect** via
  `scripts/staging/admin-reset-password-e2e.mjs`
  (`test_user_id 170f8479-e2da-4a6d-b597-080716be9c20`): the
  `SELF_RESET_FORBIDDEN`/`NOT_FOUND` guards confirmed live; real reset
  with flag+`senha_gerada_em` updated; old password confirmed invalid
  after the reset; login with the new temporary password confirms
  `senha_temporaria=true` (gate `A4.2` would fire); `A4.2` self-service
  chained (new change + flag cleared); relogin with the final password
  confirms `senha_temporaria=false` ("next login goes straight through",
  no gate); full cleanup via `admin-delete-user`, zero cleanup confirmed.
- **Local tests:** `node --check` PASS on all touched/new files;
  `tests/admin-reset-user-password.smoke.js` (new, static) **23/23**
  (guards, password rule — real simulation of 1000 samples with
  `crypto.randomBytes`, always 8+ characters with a digit —, never logs
  the password, partial state without silent success);
  `tests/admin-usuarios.smoke.js` extended **29/29** (6 new tests:
  button + self-reset guard, `confirmDialog`, full success flow,
  error flow, isolated write); consolidated regression (9 related suites)
  **268/275**, the 7 that fail are pre-existing debt confirmed identical to
  the baseline (6 from `tests/auth.smoke.js` + 1 from `tests/cadastros-*`,
  none new). `git diff --check` clean.
- **Credential-free visual verification (local preview, no login) —
  accepted as sufficient evidence by the architect, waiving a separate
  visual-validation gate:** full flow exercised in a real browser with
  `window.supa` mocked — button → `confirmDialog` (correct title and
  email) → confirm → `invoke('admin-reset-user-password')` → "Senha
  gerada" modal with password/copy/notice confirmed; self-reset guard
  confirmed with real `.disabled` values in the DOM (not mock).
- **Out-of-scope finding — candidate `UI-EL-BOOLEAN-ATTR-FIX`
  (`NOT AUTHORIZED`, severity `NOT CONFIRMED` — architect verification
  pending):** when adding the new button, the executor observed in a real
  browser that `js/ui.js`'s `el()` does `setAttribute(k, v)` without
  handling boolean — `setAttribute('disabled', false)` marks the attribute
  present (`.disabled` becomes `true`) in any real browser. This
  potentially affects the "Desativar" (`disabled: user.ativo === false`)
  and "Excluir" (`disabled: !!(meId && user.id === meId)`) buttons in
  `js/screens/admin-usuarios.js`, which could be incorrectly disabled in
  the common case (active user / not the admin themselves) — same
  root cause as the residue already fixed once in `expedicao-admin.js`.
  **Treat as a potential active regression until the architect directly
  tests the Desativar/Excluir buttons on the users screen in staging.**
  Not fixed in this phase (outside the `A5.1-A5.2` manifest, which forbids
  touching `admin-disable/delete/create`). The new reset button uses the
  safe pattern (the `disabled` key only enters the object when `true`),
  confirmed live.
- **Out-of-scope finding — decomposition candidate (`CODE-HEALTH-AUDIT-§18-R1`):**
  `js/screens/admin-usuarios-modal.js` reached 576 lines (above the
  "acceptable" 500) to accommodate the 4th modal (same pattern as the 3
  existing ones). Not extracted to a new file in this phase — the order
  explicitly authorized `admin-usuarios-modal.js` as the destination, with
  no new file in the manifest.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** `ARCHITECT DECISION` — candidates:
  `A5.3-A5.4` (reactivation, its own authorization); `UI-EL-BOOLEAN-ATTR-FIX`
  (fix at the root cause of `js/ui.js`'s `el()` + broad regression,
  pending architect confirmation); `A2.1` (`nivel_acesso` schema);
  `A6.1` (audit schema/trigger). No subphase authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — User Reactivation — A5.3-A5.4

- **Front:** `G28-CAMADA-2`, subphase `A5.3-A5.4` of
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, authorized in
  parallel with `A5.1-A5.2` per the subphase/gate table (§ "Subphase\gate").
  Completes the `A5` track (reset + reactivation).
- **Classification: `CLOSED / ACCEPTED`** (real e2e in staging `result:
  PASS`, 13/13 steps, executed by the architect; architect visual
  validation confirmed the Desativar button works correctly on an
  active user).
- **Technical HEAD:** `f886e26` — `Add admin user reactivation`
  (`supabase/functions/admin-reactivate-user/index.ts` (new),
  `supabase/functions/admin-reactivate-user/README.md` (new),
  `js/admin-usuarios-writes.js`, `js/screens/admin-usuarios.js`,
  `js/screens/admin-usuarios-modal.js`,
  `scripts/staging/admin-reactivate-e2e.mjs` (new),
  `tests/admin-reactivate-user.smoke.js` (new),
  `tests/admin-usuarios.smoke.js`). **Documentation commit:** this
  closeout (`Close admin user reactivation phase`). The current HEAD
  must be consulted with `git rev-parse HEAD`.
- **Edge Function (`admin-reactivate-user`):** symmetric counterpart of
  `admin-disable-user` — `ativo=true`, clears `desativado_em`/
  `desativado_por`/`motivo_desativacao`,
  `auth.admin.updateUserById(target, {ban_duration:'none'})`. Guards:
  target must exist (`NOT_FOUND`) and be inactive
  (`REACTIVATE_NOT_INACTIVE` otherwise — deliberately **not**
  idempotent, unlike `admin-disable-user`'s `already_disabled`:
  reactivating an already-active user is a caller error, there is no
  ambiguous "already reactivated" state to collapse into);
  self-reactivation guarded (`SELF_REACTIVATE_FORBIDDEN`) though
  practically unreachable (an inactive target is banned and cannot
  hold a session).
- **Compensation-on-partial-failure design:** if the Auth unban call
  fails after the profile has already been marked `ativo=true`, the
  function reverts to the *exact* previous inactive state —
  `desativado_em`/`desativado_por`/`motivo_desativacao` are read and
  preserved **before** the update, not re-stamped with new values —
  returning `AUTH_UNBAN_FAILED`; if the reversion itself fails,
  `COMPENSATION_FAILED` (manual action required). Same pattern as
  `admin-disable-user`'s compensation.
- **UI:** inactive rows swap the ban icon for a refresh icon in the
  same action slot (`js/screens/admin-usuarios.js`), wired to a new
  `confirmDialog` (non-destructive blue button, `danger:false`) →
  `reativarUsuario(userId)` → success/error toast. Active rows
  unchanged. Safe boolean-attr pattern followed (no `disabled` key on
  this button in either state).
- **Deploy in staging (`ucrjtfswnfdlxwtmxnoo`) executed by the
  architect** — outside the credential reach of this session (AI agent
  does not enter password/token/API key in any field, permanent rule).
- **Post-deploy verification — real E2E in staging, `result: PASS`
  (13/13), executed by the architect** via
  `scripts/staging/admin-reactivate-e2e.mjs`
  (`test_user_id 860b6fea-ac9e-45b1-8b85-9cfa255020e4`): synthetic
  fornecedor created; login confirmed before any deactivation; disabled
  via the existing `admin-disable-user` flow (`ativo=false`,
  `auth_banned=true`); login confirmed blocked (banned); reactivated via
  the new Edge Function (`ativo=true`, `auth_banned=false`); flags
  confirmed cleared in `public.usuarios`
  (`desativado_em`/`desativado_por`/`motivo_desativacao` all `null`);
  login confirmed restored; guard `REACTIVATE_NOT_INACTIVE` confirmed
  on the now-active target; cleanup via `admin-delete-user`, zero
  cleanup confirmed.
- **Local tests:** `node --check` PASS on all touched/new files;
  `tests/admin-reactivate-user.smoke.js` (new, static) **22/22**
  (guards, symmetry with `admin-disable-user`, non-idempotent
  `REACTIVATE_NOT_INACTIVE`, exact-state compensation, never logs a
  secret — there is none to log here); `tests/admin-usuarios.smoke.js`
  extended **35/35** (6 new tests: icon swap by `ativo` state,
  `confirmDialog`, full success flow, error flow, isolated write);
  consolidated regression across the touched suites (`admin-usuarios`,
  `admin-reactivate-user`, `admin-disable-user`,
  `admin-reset-user-password`, `boot`, `cadastros-screens`) **195/195**,
  no regressions. `git diff --check` clean.
- **Architect visual validation:** Desativar button on an active user
  **CONFIRMED WORKING** in staging — this also clears, for this one
  control, the risk flagged in the `A5.1-A5.2` finding below (the
  `A5.3-A5.4` rewrite dropped the vulnerable `disabled: <boolean>` key
  from the Desativar/Reativar button entirely, as a side effect of the
  icon-swap logic — not a deliberate fix of `js/ui.js`). Icon-swap +
  Reativar flow: issue found and diagnosed (see next finding) — not
  itself a defect in the Reativar code delivered this phase; the
  Reativar action, once discoverable, worked as designed in the e2e.
- **Finding — `UI-EL-BOOLEAN-ATTR-FIX` severity updated from
  `NOT CONFIRMED` to `CONFIRMED — ACTIVE REGRESSION`:** while validating
  the Reativar flow, the architect found that a disabled user
  disappears from the Usuários screen and stays gone even with
  "Mostrar inativos" checked — the checkbox "persists marked when
  clicking" (does not visually reflect its real state). Root cause
  diagnosed: `js/screens/admin-usuarios.js`'s toggle passes `checked:
  mostrarInativos` straight into `window.el()`, which calls
  `node.setAttribute('checked', mostrarInativos)` unconditionally;
  since `renderStandalone()` creates a brand-new `<input>` on every
  re-render, the `checked` attribute is always present (`"true"` or
  `"false"` as a string), and HTML boolean attributes are
  true-by-presence regardless of value — so the fresh checkbox always
  renders checked, independent of the actual `mostrarInativos` state.
  Exact same root cause as the `disabled="null"` residue already fixed
  once in `expedicao-admin.js`, now empirically reproduced via a second
  control. The Excluir button in the same file (`disabled: !!(meId &&
  user.id === meId)`) carries the identical pattern and is unconfirmed
  but suspect by the same evidence. **Not fixed in this phase** —
  outside the `A5.3-A5.4` manifest, and mixing this diagnosis with a
  patch here would violate `CODE_HEALTH_RULES.md` §14 (do not mix
  diagnosis with patch). Recorded as the priority `ARCHITECT DECISION`
  candidate.
- **Finding unchanged — decomposition candidate
  (`CODE-HEALTH-AUDIT-§18-R1`):** `js/screens/admin-usuarios-modal.js`
  grew from 576 to 604 lines accommodating the 5th modal
  (`openReativarModal`); already a recorded candidate, no action taken.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** `ARCHITECT DECISION` — candidates:
  `UI-EL-BOOLEAN-ATTR-FIX` (now `CONFIRMED — ACTIVE REGRESSION`,
  recommended priority); `A2.1` (`nivel_acesso` schema); `A6.1` (audit
  schema/trigger). `A3.4` unlocks once the remaining `A2`/`A6`
  subphases close. No subphase authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — Last Access RPC Consumption in the UI — CAMADA2-LAST-ACCESS-UI

- **Front:** `G28-CAMADA-2`, micro-phase of consuming the `db/59` RPC
  (`admin_usuarios_last_sign_in`) on the users screen, authorized after
  `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Classification: `CLOSED / ACCEPTED`** (architect visual validation
  confirmed in local preview on 2026-07-16: column populated with real
  data, correct format, `"—"` for never-logged, sorting with nulls last).
- **Technical HEAD:** `0aff22f` — `Add last sign-in column to user
  admin`. **Documentation commit:** this closeout (`Close last sign-in
  column phase`). The current HEAD must be consulted with `git rev-parse
  HEAD`.
- **Implemented scope:** `js/admin-usuarios-writes.js` gained
  `fetchLastSignIn()` (calls `supa.rpc('admin_usuarios_last_sign_in')`,
  one call per `reload()`, client-side merge by `id`);
  `js/screens/admin-usuarios.js` gained the "ULTIMO ACESSO" column in the
  grid (`dd/mm/aaaa hh:mm`; `"—"` for null/absent/invalid), enabled the
  "Último acesso" sort (most recent first, nulls always last) and handles
  RPC failure without bringing down the screen (whole column as `"—"` +
  `console.warn`, the user list stays visible).
- **Not touched:** no new write, no migration, `index.html` untouched,
  no modal, `js/boot.js` untouched — confirmed by `git status` in the phase.
- **Local tests:** `node --check` PASS; `tests/admin-usuarios.smoke.js`
  extended **23/23** (4 new tests: column/format/null-fallback/
  sorting-with-nulls-last/single RPC call); regression
  `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js` +
  `tests/admin-*.smoke.js` **298/298**, no regression. `git diff
  --check` clean.
- **Verification in local preview (real staging, session already
  authenticated):** column populated with real staging data
  (`ucrjtfswnfdlxwtmxnoo`) — timestamps formatted correctly,
  `"—"` for never-logged users; the "Último acesso" sort applied
  live confirmed correct descending order with all `"—"` grouped last.
  Console with no errors/warnings.
- **Documentation continuity debt closed by this record:** the
  implementation report for this micro-phase remained in `AGUARDANDO
  VALIDAÇÃO VISUAL DO ARQUITETO` while the session proceeded to the
  authorization of `A4.2`; the visual validation and the closeout
  authorization were explicitly confirmed by the architect on 2026-07-16,
  together with the authorization of the next front (`A5.1-A5.2`).
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** already superseded — `A5.1-A5.2` (admin
  password reset) authorized and in progress; see its own section for the
  current state of "next action".
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — Mandatory Password Change Guard — A4.2

- **Front:** `G28-CAMADA-2`, subphase `A4.2` of
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`, authorized after
  `A4.1` + `CAMADA2-LAST-ACCESS-RPC`.
- **Classification: `CLOSED / ACCEPTED`** (mockup gate satisfied +
  architect manual validation confirmed in staging with a synthetic user).
- **Technical HEAD:** `6c624ef` — `Add mandatory password change gate`
  (`js/auth.js`, `js/boot.js`, `js/trocar-senha-writes.js` (new),
  `js/screens/trocar-senha-obrigatoria.js` (new),
  `scripts/staging/trocar-senha-obrigatoria-e2e.mjs` (new, tooling),
  `index.html`, `tests/auth.smoke.js`, `tests/boot.smoke.js`,
  `tests/trocar-senha-obrigatoria.smoke.js` (new)). **Documentation
  commit:** this closeout (`Close mandatory password change
  phase`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Hard stop resolved in this phase (explicit architect decision —
  Option A):** the designed guard (`CURRENT_USER.senha_temporaria`) did not
  work because `js/auth.js` (`loadCurrentUser()`) was not selecting
  `senha_temporaria`/`senha_gerada_em` — fields added by `db/58` in
  `A4.1`, but never read anywhere in the repository
  (confirmed by grep before the stop). `js/auth.js` was not in the
  original manifest of this order; the architect expanded the manifest by 1
  file, exclusively for the `select` of `loadCurrentUser()` — no other
  line of `auth.js` touched (`§11` preserved, Auth mechanism untouched).
- **Guard (`js/boot.js`):** `isSenhaTemporariaExpirada(geradaEm)`
  (pure, 7 days, testable in isolation) + `guardedHandleRoute()`
  (wraps `window.handleRoute` from `js/router.js` **without altering it** —
  `router.js` remains untouched) used both in the `hashchange` listener and
  in the initial decision of `main()`, post-`loadCurrentUser()` and
  pre-G24-C bootstrap. Exported only for testing in
  `window.RAVATEX_BOOT_GUARD`.
- **Self-service write (`js/trocar-senha-writes.js`, new module):**
  `trocarSenhaObrigatoria(userId, novaSenha)` — `supabase.auth.
  updateUser({password})` (self-service, no Admin API) and, on
  success, `UPDATE usuarios SET senha_temporaria=false WHERE id=userId`
  via PostgREST. Returns `{ok:false, stage:'auth'|'flag', error}` to
  distinguish a real partial state (password changed but flag not cleared) —
  reported explicitly by the screen, never silent.
- **RLS/grants verified in staging before coding (read-only, live
  catalog):** policy `usuarios_self_update` on
  `public.usuarios` (`USING id=auth.uid() AND ativo IS TRUE`,
  `WITH CHECK` preserves `tipo`) + `authenticated` with explicit
  `UPDATE` on `senha_temporaria`/`senha_gerada_em` — no new policy,
  no loosening.
- **Screen (`js/screens/trocar-senha-obrigatoria.js`, new, 243 lines):**
  centered card without shell, padlock icon, live checklist (minimum 8
  characters / 1 digit / passwords match — gray `#8a93a3` pending,
  green `#18794a` satisfied), button enabled only with the 3 criteria,
  eye toggle on both fields, "Sair da conta" link (real logout). `expired`
  mode (`senha_gerada_em` > 7 days): no fields, expiration message +
  "Sair da conta" as the primary button. Mockup approved by the
  architect on 2026-07-16.
- **Local tests:** `node --check` PASS on the 5 touched/new JS/`.mjs`
  files; `tests/trocar-senha-obrigatoria.smoke.js` (new)
  **14/14**; `tests/boot.smoke.js` extended **44/44** (13 new tests,
  incl. real integration via `main()` with a mocked authenticated
  session, flag true/false/expired); `tests/auth.smoke.js` extended
  **37/43** (3 new tests + 1 fixed; the 6 that fail are pre-existing debt
  confirmed identical via `git stash`, unrelated to this phase — see the
  debt recorded below); consolidated regression
  (`boot`+`auth`+`trocar-senha-obrigatoria`+`admin-usuarios`+
  `cadastros-screens`) **150/156**, same pre-existing debt count.
  `git diff --check` clean.
- **Credential-free visual verification (local preview, no login):**
  real screen rendered via a diagnostic overlay — checklist reacts to
  a real keypress with correct computed colors (`rgb(24,121,74)`=`#18794a`
  satisfied / `rgb(138,147,163)`=`#8a93a3` pending), button disables/
  enables correctly, eye toggle `password↔text` confirmed,
  `expired` mode with no fields/form. Console with no errors.
- **Validation of the authenticated leg — confirmed by the architect
  (manual validation in staging, `ucrjtfswnfdlxwtmxnoo`):** synthetic
  user created via the new flow (temporary password), gate shown on the
  first login, checklist reacted, change performed, `senha_temporaria`
  flag cleared, second login went straight through without the gate.
  Test user removed. Equivalent automated runner
  available at `scripts/staging/trocar-senha-obrigatoria-e2e.mjs`
  (same skeleton/guarantees as `admin-create-user-password-policy-
  e2e.mjs` — login with a real password only by a human, never by the AI
  agent; synthetic password generated by the script itself) for future
  re-execution, not executed in this phase (the validation used was the
  manual one).
- **Debt recorded in this phase (non-blocking, candidate for
  `CODE-HEALTH-AUDIT-§18-R1`):** the 6 pre-existing tests in
  `tests/auth.smoke.js` that fail checking `<script src="js/
  auth.js">` tags without `?v=` (regex outdated since cache-busting was
  added to `auth.js`, prior to this phase) — confirmed identical
  to the baseline via `git stash`, not fixed here (outside the scope of this
  order). See the section "Candidate front `CODE-HEALTH-AUDIT-§18-R1`"
  below.
- **Documentation continuity debt (not closed by this phase):** the
  `CAMADA2-LAST-ACCESS-UI` micro-phase (consuming the `db/59` RPC — "Último
  acesso" column in `js/screens/admin-usuarios.js`, technical commit
  `0aff22f` — `Add last sign-in column to user admin`) had its
  implementation report delivered (`IMPLEMENTAÇÃO VALIDADA /
  AGUARDANDO VALIDAÇÃO VISUAL DO ARQUITETO`) but the session proceeded
  directly to the authorization of `A4.2` without an explicit `OK` nor a
  closeout order recorded for that micro-phase specifically.
  The technical commit is already in history and the feature is
  implemented; only the formal documentation record (`CLOSED / ACCEPTED`) is
  missing — pending the architect's own order.
- **Not implemented (out of scope, not started):** `A4.3` (email
  invitation, `NOT AUTHORIZED`); `A2.1` (`nivel_acesso` schema); `A6.1`
  (audit schema/trigger); `A5.1-A5.2` (admin password reset).
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** `ARCHITECT DECISION` — candidates:
  `A5.1-A5.2` (password reset — Edge Function + staging verify); `A2.1`
  (`nivel_acesso` schema); `A6.1` (audit schema/trigger).
  No subphase authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — Temporary Password and Last Access Read Model — A4.1 + CAMADA2-LAST-ACCESS-RPC

- **Front:** `G28-CAMADA-2`, subphase `A4.1` (`senha_temporaria` schema /
  password policy) grouped with the `CAMADA2-LAST-ACCESS-RPC` micro-phase
  ("last access" RPC), per the architect decision recorded in the closeout
  of `A3.2` and the explicit authorization of this phase.
- **Classification: `CLOSED / ACCEPTED`** (Edge Function deploy executed
  by the architect + real E2E verification in staging `result:
  PASS` 9/9, evidence below).
- **Technical HEADs:** `bf0d522` — `Add temporary password schema and
  last sign-in read model`; `c6289f8` — `Add password-policy E2E
  verification runner for admin-create-user`. **Documentation commit:**
  this closeout (`Close temporary password schema phase`). The current HEAD
  must be consulted with `git rev-parse HEAD`.
- **Schema (`db/58_admin_usuarios_senha_temporaria.sql`, applied and
  verified in staging `ucrjtfswnfdlxwtmxnoo`, registry
  `20260716014338 / 58_admin_usuarios_senha_temporaria`):**
  `usuarios.senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE` +
  `usuarios.senha_gerada_em TIMESTAMPTZ NULL`. The 10 pre-existing
  users preserved with no retroactive effect.
- **RPC (`db/59_admin_last_sign_in_readmodel.sql`, applied and
  verified in staging, registry `20260716014358 /
  59_admin_last_sign_in_readmodel`):** `public.admin_usuarios_last_sign_in()`
  — `SECURITY DEFINER`, `STABLE`, `search_path=public,auth`, `is_admin()`
  guard (`db/12` pattern), exposes only `id`+`last_sign_in_at`. Explicit
  grants: `authenticated`-only. Empirical role matrix
  (`BEGIN…ROLLBACK`): `anon` → `42501` at the ACL boundary; non-admin
  `authenticated` → business `42501` (`RAISE EXCEPTION` inside the function);
  admin `authenticated` → `ok`, minimal DTO confirmed. Closes the HARD
  STOP of the "Último acesso" column recorded in the `A3.2` closeout.
- **Edge Function `admin-create-user` (targeted extension):**
  `PASSWORD_MIN_LENGTH` 6→8 + `PASSWORD_DIGIT_RE` (≥1 digit); insert into
  `public.usuarios` now sets `senha_temporaria: true`,
  `senha_gerada_em: now()`.
- **Deploy:** executed by the architect directly in staging
  (`ucrjtfswnfdlxwtmxnoo`) — outside the credential/tooling reach
  of this session (AI agent does not enter password/token/API key in any
  field, permanent rule).
- **Post-deploy verification — real E2E in staging (`result: PASS`,
  9/9), executed by the architect** via
  `scripts/staging/admin-create-user-password-policy-e2e.mjs` (same
  skeleton/guarantees as the accepted `admin-disable-user-e2e.mjs`):
  7-character password rejected (length message); 8-character password
  without a digit rejected (digit message); valid password accepted with
  `senha_temporaria=true`/`senha_gerada_em` filled confirmed via REST in
  `public.usuarios`; cleanup via `admin-delete-user` (existing flow) with
  zero cleanup verified (profile absent after delete).
- **Local tests:** `admin-usuarios-senha-temporaria-schema.smoke.js`
  7/7; `admin-last-sign-in-readmodel.smoke.js` 9/9; `admin-create-user.smoke.js`
  extended (password policy with real validation extracted from the source)
  25/25; `db/` allow-list in `document-decision-command-contract.test.js`
  extended to `db/58`/`db/59`; regression `tests/admin-*.smoke.js` +
  `boot.smoke.js` 263/263, no regression. `git diff --check` clean.
- **Documentation corrected in this phase:**
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (outdated password
  policy corrected to 8+digit, note about
  `senha_temporaria`/mandatory change planned in `A4.2`).
- **Not implemented (out of scope, not started):** consumption of the RPC
  `db/59` in the UI ("Último acesso" column in
  `js/screens/admin-usuarios.js`); `A4.2` (boot guard + mandatory change
  screen); `A4.3` (email invitation, `NOT AUTHORIZED`).
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** `ARCHITECT DECISION` — candidates:
  micro-phase of consuming the `db/59` RPC in the UI ("Último acesso"
  column, under mockup gate if it involves a new visual element); `A4.2`
  (boot guard + mandatory change screen, visual gate). No subphase
  authorized by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Architect Decision — Publication Criterion and Candidate Fronts — G28-GOVERNANCE-CONSOLIDATION-A

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

Living and permanent record of the architect's decisions (2026-07-15) that
consolidate the supervision protocol (`docs/governance/SUPERVISION_PROTOCOL.md`)
and record two candidate fronts `NOT AUTHORIZED`, plus the architect
criterion that conditions publication to production.

```text
CODE-HEALTH-AUDIT-§18-R1:
NOT AUTHORIZED / CANDIDATE

PUBLICATION-TRACK-REVIEW:
NOT AUTHORIZED / CONDITIONED — NOT A CURRENT CANDIDATE

PUBLICATION CRITERION (ARCHITECT DECISION 2026-07-15):
PRODUCTION ENTRY REQUIRES G28-CAMADA-2 (FULL SCOPE A1-A7) AND
G28-CAMADA-3 (AUTOMATED BACKUP) BOTH CLOSED / ACCEPTED IN STAGING

G28-CAMADA-3:
RECLASSIFIED FROM DEFERRED TO PUBLICATION CRITICAL PATH (AFTER CAMADA 2)
PENDING OWN SPEC (BK1-BK8 DIAGNOSIS IS A FUTURE PHASE)

STAGING-ONLY-EXECUTION-BOUNDARY-A:
UNCHANGED / REMAINS IN FORCE
```

- **Candidate front `NOT AUTHORIZED`: `CODE-HEALTH-AUDIT-§18-R1`** —
  read-only post-Camada 2 audit (`docs/architecture/CODE_HEALTH_RULES.md`
  §18), input for the incremental decomposition of `cadastros.js` (~2,200
  lines, 6 embedded screens remaining after the `A3.1` extraction) and
  triage of the baseline test debts. Not started; no
  implementation authorized by this record. **Concrete debt
  recorded in phase `A4.2` (2026-07-16):** the 6 tests in
  `tests/auth.smoke.js` that check `<script src="js/auth.js">` without
  considering the cache-busting `?v=` (regex outdated since before
  `A4.2`, confirmed identical to the baseline via `git stash`) — a fix
  candidate when this audit is authorized. **Concrete debt
  recorded in phase `A5.1-A5.2` (2026-07-16):**
  `js/screens/admin-usuarios-modal.js` reached 576 lines (above the
  "acceptable" 500) to accommodate the 4th modal — a decomposition candidate
  when this audit is authorized.
- **Candidate front `NOT AUTHORIZED`, severity `NOT CONFIRMED`:
  `UI-EL-BOOLEAN-ATTR-FIX`** — recorded in phase `A5.1-A5.2`
  (2026-07-16). `js/ui.js`'s `el()` does `setAttribute(k, v)` without handling
  booleans; `setAttribute('disabled', false)` marks the attribute present
  in any real browser, potentially affecting the
  "Desativar"/"Excluir" buttons in `js/screens/admin-usuarios.js` (they could
  end up incorrectly disabled in the common case) — the same
  root cause as the residue already fixed once in `expedicao-admin.js`.
  **Treat as a potential active regression until direct verification by the
  architect on the Desativar/Excluir buttons in staging.** Not
  confirmed/reproduced by the architect yet; not started; no
  implementation authorized by this record.
- **Conditioned front `NOT AUTHORIZED`: `PUBLICATION-TRACK-REVIEW`** —
  review of the staging-only boundary + `DEPLOYMENT_MAPPING_AND_PRODUCTION_
  MIGRATION_PROCEDURE` + G28-D + production application of the migrations that
  are today staging-only + `DELETE-PROD-GUARD-A`, as a prerequisite for real
  users. Becomes `CONDITIONED` by the publication criterion below — it is not a
  current candidate, even after the remaining general backlog is
  reconciled.
- **Binding architect decision — publication criterion (2026-07-15):**
  the system only enters production after `G28-CAMADA-2` (full scope `A1-A7`,
  today only `PRE-EXISTING PARTIAL CAPABILITY` + `FULL SCOPE DEFERRED` —
  see `G28-RECONCILIATION-DECISIONS-A` below) and `G28-CAMADA-3` (automated
  backup) are both `CLOSED / ACCEPTED` in staging.
  `PUBLICATION-TRACK-REVIEW` is conditioned on this criterion. The
  `STAGING-ONLY-EXECUTION-BOUNDARY-A` boundary remains in force unchanged.
- **Recorded consequence:** `G28-CAMADA-3` is no longer treated merely
  as a deferred front and becomes `PUBLICATION CRITICAL PATH` (after
  `G28-CAMADA-2`), pending its own spec — the `BK1-BK8` diagnosis is a
  future phase, not authorized by this record.
- **Supervision protocol:** `docs/governance/SUPERVISION_PROTOCOL.md`
  received an appendix "Supervision handoff — standard block" (verbatim text
  from the architect, for opening new reviewer/supervisor sessions) and
  now requires a `STRUCTURAL POLICY COMPLIANCE` section in the report of every
  implementation phase (applicable rules from `CODE_HEALTH_RULES.md`
  cited + evidence + line size of the files touched).
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  decision).

## Architect Decision — Staging-Only Execution Boundary — STAGING-ONLY-EXECUTION-BOUNDARY-A

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

Living and permanent record of the project's current cycle (2026-07-15). This
block prevails over any earlier mention of `DEPLOYMENT_MAPPING_AND_
PRODUCTION_MIGRATION_PROCEDURE` as a current material blocker in
any historical section below.

```text
ACTIVE FUNCTIONAL PHASE:
NONE

CURRENT ENVIRONMENT POLICY:
STAGING ONLY

AUTHORIZED SUPABASE PROJECT:
ucrjtfswnfdlxwtmxnoo

PRODUCTION / OTHER SUPABASE:
OUT OF SCOPE

DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE:
DEFERRED UNTIL GLOBAL BACKLOG COMPLETION

G28-D:
DEFERRED / NOT AUTHORIZED / NOT A CURRENT BLOCKER

CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1:
CLOSED / ACCEPTED

MIGRATION:
db/57_cliente_pedido_summary_acl_grants.sql

STAGING REGISTRY:
20260715190627 / 57_cliente_pedido_summary_acl_grants

ACL DEBT:
RESOLVED IN STAGING

DB30 MIGRATION-HISTORY DEBT:
OPEN

ACTIVE FUNCTIONAL PHASE:
NONE

NEXT AUTHORIZABLE TECHNICAL CANDIDATE:
NONE
ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION
STAGING ONLY
```

- **Binding architect decision:** the current operational environment is
  exclusively the staging Supabase `ucrjtfswnfdlxwtmxnoo`. The protected/other
  Supabase project (`bhgifjrfagkzubpyqpew`) remains out of scope
  and must not be accessed.
- **Production schema migration or promotion:** postponed until the
  completion of the full canonical backlog. Production publication mapping
  is not required for the current work in staging.
- **`DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`:** is no longer
  recorded as a current material blocker or as the next required architect
  decision. Reclassified as `DEFERRED BY ARCHITECT UNTIL
  GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT STARTED`.
  Not discovered, defined, tested, or completed — only intentionally
  postponed. Discovery evidence preserved, not rewritten, in
  `docs/releases/G28_D_RELEASE_CANDIDATE.md`.
- **G28-D:** publication `DEFERRED, NOT AUTHORIZED, NOT A CURRENT BLOCKER`.
- **Frontend/publication:** publication provider not selected. Vercel
  remains a future candidate only; this is not a decision nor an
  authorization.
- **Current execution policy (permanent for this cycle):**
  1. continue implementing and validating the remaining canonical backlog
     exclusively against staging;
  2. do not access the protected Supabase project;
  3. do not plan, prepare, simulate, or execute production migrations;
  4. do not let the missing production mapping block the work in
     staging;
  5. do not authorize the publication of G28-D;
  6. revisit migration and publication only after the full canonical
     backlog is reconciled and completed;
  7. Vercel may be evaluated later, but is not currently selected.
- **Next technical candidate:** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`
  was authorized, implemented, applied, and verified in staging on
  2026-07-15 (`CLOSED / ACCEPTED` — see its own section "Client Portal — ACL
  Grants Hardening" below). There is no single, unambiguous technical candidate
  for the current staging cycle; the next action depends on reconciliation
  of the remaining general backlog.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed. **Vercel:** not accessed.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  decision).

## Architect Decision — Backlog Reconciliation and Supervision Governance — G28-RECONCILIATION-DECISIONS-A

*(translated from the architect's original Portuguese; original in docs/archive/pt-BR/)*

Living and permanent record of the architect's decisions (2026-07-15) about the
read-only diagnosis `BACKLOG-RECONCILIATION-READONLY-R1`
(`docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md`). This block
prevails over any earlier classification of the
`PROJECT-CONTROL-BASELINE-R1` report (ChatGPT) regarding Camada 2 and the acceptance of
the Documents section.

```text
PROJECT-CONTROL-BASELINE-R1 (ChatGPT):
REJECTED / NOT RATIFIED — materially incorrect classification of Camada 2.
External artifact, never canonical.

PROJECT-CONTROL-BASELINE-R1-CORRECTION (ChatGPT):
CANCELLED / ABSORBED / SUPERSEDED BY BACKLOG-RECONCILIATION-READONLY-R1

ADOPTED REFERENCE BASELINE:
BACKLOG-RECONCILIATION-READONLY-R1
(docs/reports/BACKLOG_RECONCILIATION_R1_2026-07-15.md)

G28-CAMADA-2:
PRE-EXISTING PARTIAL CAPABILITY (byproduct of AUTH-DISABLE-USER and Client
Portal) / FULL SCOPE A1-A7 DEFERRED / NOT ACCEPTED AS A DEDICATED PHASE
FUNCTIONAL/VISUAL REFERENCE FOR THE FULL SCOPE:
D:\OneDrive\Programação\SGAA_clean_baseline

G28-C:
CLOSED / TECHNICALLY ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING
(reclassification of the current state; historical ledger `a7d7caa`/`d5ec09f`
NOT rewritten; new append-only entry in the G28 ledger)
RECORDED DEBT: AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED (pending)

SUPERVISION GOVERNANCE:
Tracking and opinions transferred to Claude (chat) + Claude Code
(resident). ChatGPT becomes a consultant without state custody and without
issuing orders.

NEXT SELECTED FRONT:
G28-CAMADA-2 — starting with a comparative read-only diagnosis (its own
subsequent order, not authorized by this record)

AUTHORIZED PARALLEL TASK:
Hygiene of the `work/app-next` worktree — read-only, separate order
```

- **Binding architect decision:** the ChatGPT report `PROJECT-CONTROL-BASELINE-R1`
  is `REJECTED / NOT RATIFIED` regarding the Camada 2 classification;
  its correction (`PROJECT-CONTROL-BASELINE-R1-CORRECTION`) is `CANCELLED /
  ABSORBED / SUPERSEDED` by the diagnosis `BACKLOG-RECONCILIATION-READONLY-R1`,
  adopted as the current reference baseline.
- **G28-CAMADA-2** is reclassified as `PRE-EXISTING PARTIAL CAPABILITY`
  (user CRUD, disable/ban, single role `usuarios.tipo`, client/supplier
  linkage — byproduct of `AUTH-DISABLE-USER` and the Client Portal,
  not of a dedicated Camada-2 phase) plus `FULL SCOPE A1-A7 DEFERRED`
  (password reset/recovery, invites, role/permission matrix,
  create/edit/delete auditing, full password policy, reactivation).
  Not accepted as a phase; no implementation authorized by this record.
  Functional/visual reference for the full scope, when authorized:
  `D:\OneDrive\Programação\SGAA_clean_baseline`.
- **G28-C** is reclassified in the current state as `CLOSED / TECHNICALLY
  ACCEPTED — ARCHITECT PRODUCT VALIDATION PENDING`, explicitly separating
  technical/staging acceptance (16/16 matrix, migrations applied and verified)
  from the architect's functional/personal validation (not recorded) and from the
  authenticated browser smoke (never executed, `AUTHENTICATED_BROWSER_SMOKE_
  NOT_EXECUTED`). The historical closeout (`a7d7caa`/acceptance `d5ec09f`) is not
  rewritten; this reclassification is recorded as a new, linked entry
  in the G28 ledger.
- **Supervision governance:** the tracking of progress, continuity,
  scope, authorizations, phases, and documentation passes to Claude (chat) and
  Claude Code (resident). ChatGPT remains available as a consultant,
  without state custody and without authority to issue orders.
- **Next front:** `G28-CAMADA-2`, starting with a comparative read-only
  diagnosis in its own subsequent order (not authorized by this
  record). Hygiene of the `work/app-next` worktree (divergent from the remote and
  with uncommitted changes) authorized as a read-only parallel task,
  in a separate order.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed in this phase.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  decision).

## Camada 2 — User Administration — Proposed Spec — CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1

- **Front:** `G28-CAMADA-2`, selected as the next front in
  `G28-RECONCILIATION-DECISIONS-A` (see section above).
- **Phase:** `CAMADA2-USUARIOS-SPEC-MATERIALIZE-R1`. Docs-only — no
  code, test, SQL, migration, Supabase, staging, production or Vercel
  accessed/altered. **Status: `PROPOSED`.**
- **Document created:** `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`
  — spec `A1-A7` + password policy, with evidenced comparison
  Tapetes × `D:\OneDrive\Programação\SGAA_clean_baseline` (external
  read-only reference, unrelated Flask/SQLite project), consolidated
  module plan, per-item Auth risk classification and subphase order
  with gates.
- **Architect decisions incorporated in the spec:** `nivel_acesso` with 2
  levels (`completo`/`somente_leitura`); permission-overrides table
  **not built** (future option conditioned on real need); A4 = single
  temporary-password-with-forced-change path,
  email/SMTP invitation `NOT AUTHORIZED`; bulk actions (A3.3)
  `DEFERRED`.
- **Review adjustments applied:** route cutover moved up to A3.1
  (with architect visual validation); A3.4 restricted to isolated
  removal of the legacy code; "último acesso" included in A3.2; explicit
  session revocation out of scope; mandatory mockup gate before
  A3.2; `index.html`/cache-busting edits and route/boot smokes addressed
  per subphase; `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
  included in the A3.1/A3.4 closeout.
- **Security caveat:** the spec explicitly rejects 4 SGAA practices used as
  reference (default passwords in plain text in the UI, absence of
  complexity policy, absence of auditing, confirmation via native
  `window.confirm()`) — used only for information architecture/screen
  organization.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Next authorizable action:** `A3.1` was authorized and completed — see
  its own section below. Next subphase: `A3.2`, under mockup gate
  (see `CAMADA2_USUARIOS_SPEC_PROPOSED.md`), **not authorized**.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — User Screen Extraction — CAMADA2-USUARIOS-A3-1

- **Front:** `G28-CAMADA-2`, subphase `A3.1` of
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Phase:** `CAMADA2-USUARIOS-A3-1`. Pure refactor (§14
  `CODE_HEALTH_RULES.md`) — no new feature, no change in visual or
  functional behavior. **Classification: `CLOSED /
  ACCEPTED`** (explicit architect authorization + manual visual
  validation confirmed on the real screen in local staging app).
- **Technical HEAD:** `4f01101143a512c8018d58ce9e523064c38a145f` —
  `Extract user administration screen modules`.
- **Scope:** 1:1 extraction of `screenCadastrosUsuarios`
  (`js/screens/cadastros.js:2226-2713`, a 2,750-line file with 7
  embedded screens — active violation of the §7 size limit) into 3
  dedicated modules: `js/admin-usuarios-writes.js` (pure I/O, no toast/
  DOM, `op-writes.js`/`entrega-writes.js` pattern), `js/screens/
  admin-usuarios-modal.js` (3 modals: create/edit, disable,
  delete), `js/screens/admin-usuarios.js` (orchestration/render).
  Route cutover moved up (spec review adjustment): `js/boot.js`
  rewired (`#/cadastros/usuarios` → `window.screenAdminUsuarios`);
  `index.html` with the 3 new scripts (order writes→modal→screen,
  cache-busting `?v=20260715-camada2-a31`).
- **Coupling resolved:** `cadastros.js` is an IIFE that does not expose in
  `window.*` the 8 form helpers used by the screen (only
  `window.labelFornecedorTipo` is global). Since the order forbade touching
  `cadastros.js`, the helpers (pure functions, depending only on `window.el`/
  `window.supa`) were duplicated locally in `admin-usuarios-modal.js`,
  renamed with an `adminUsuarios` prefix and an origin comment.
- **Recorded scope decision:** the original `render()` function
  (`cadastros.js:2266-2317`, generic dataTable) was never called —
  `reload()` only called `renderStandalone()`. Dead/unreachable code,
  **not ported**: omitting it does not change any observable behavior.
- **Not altered:** `js/screens/cadastros.js`, `js/ui.js`, `js/auth.js`
  — untouched, confirmed by `git status`.
  `screenCadastrosUsuarios`/`window.screenCadastrosUsuarios` remain
  in `cadastros.js`, as dead code, until isolated removal in `A3.4`
  (its own phase, pure refactor, no mixing with feature).
- **Tests (§13 gate):** `node --check` on the 3 new files + `boot.js`
  PASS; `tests/admin-usuarios.smoke.js` (new) **13/13**; `tests/
  boot.smoke.js` **32/32** (2 new tests: route cutover, order/
  cache-busting); `tests/cadastros-screens.smoke.js` **32/32** (boot
  sandbox adjusted to load the 3 new modules — without that fix
  test 22 broke as an indirect consequence of the route switch, not
  from any change in `cadastros.js`); broad regression of 28 additional
  suites: **1207 pass / 89 fail — count identical to the baseline
  before the phase**, confirmed via `git stash`/`stash pop` (the 89
  failures are pre-existing debt, `:8765` server not running and
  old inline-script extraction; none new). `git diff --check`
  clean.
- **Visual validation:** confirmed by the architect on the
  `#/cadastros/usuarios` route in local app (`http://localhost:8765`,
  `.claude/launch.json` created in this phase), staging `ucrjtfswnfdlxwtmxnoo`
  — 1:1 parity accepted.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Documentation updated:** `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
  (§16 — new structural module + route change; new row in the
  phase table §4 and in the canonical module list §6).
- **Next authorizable action:** `A3.2` was authorized and completed — see
  its own section below.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Camada 2 — Summary Cards and Toolbar — CAMADA2-USUARIOS-A3-2

- **Front:** `G28-CAMADA-2`, subphase `A3.2` of
  `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
- **Phase:** `CAMADA2-USUARIOS-A3-2`. Additive UI feature (§14
  `CODE_HEALTH_RULES.md`) over the module extracted in `A3.1` — no
  refactor, no new write, no Auth. **Classification: `CLOSED /
  ACCEPTED`** (mockup gate satisfied + manual visual validation
  confirmed, including post-validation adjustment).
- **Technical HEADs:** `b4a6238c34afb683ec7a973d230330b7266c99f2` —
  `Add user admin summary cards and toolbar`; `3198570c04b08bef83605f64bc9ae1c5ece8b873`
  — `Align summary card background with dashboard`.
- **Mockup gate:** `SATISFIED` — approved by the architect on
  2026-07-15 (summary cards with KPI icon + toolbar + role badge by
  color); final values recorded in
  `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`.
- **Scope implemented (order items 1, 2, 3, 5):** summary cards (4:
  Administradores/Fornecedores/Clientes/Inativos, counts over
  already-loaded `allUsers`, no new query); toolbar (search + Ordenar
  select + Filtrar por tipo select + "Mostrar inativos" toggle,
  client-side); colored role badge in the Tipo column; `0.6` opacity
  on inactive rows.
- **Item 4 (the "Último acesso" column) — NOT implemented, HARD STOP
  confirmed:** `auth.users.last_sign_in_at` is not read anywhere
  in the repository and no RPC/view exposes it; any read path
  requires a new migration. **Architect decision: chosen path
  = admin-only `SECURITY DEFINER` RPC, `is_admin()` pattern.**
  Recorded as future micro-phase `CAMADA2-LAST-ACCESS-RPC` —
  `NOT AUTHORIZED`, candidate to group with the `A4.1` migration. The
  "Último acesso" option exists in the Ordenar select (UI, item 2) but is
  inert until the RPC exists.
- **Post-validation adjustment:** standard cards background (Administradores/
  Fornecedores/Clientes) changed from `#f4f6f9` to `#fff` — same tone
  as `.rv-adm-card` in `js/screens/painel.js` (admin dashboard). The
  Inativos card keeps `#fff8f8` (intentional alert tone, unchanged).
- **Not altered:** `index.html` (no new script); `js/admin-usuarios-writes.js`;
  `js/screens/admin-usuarios-modal.js`; `js/screens/cadastros.js`;
  `js/ui.js`; `js/auth.js`.
  `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` **received no
  entry in this phase** — no new structural module, no
  route change (§16 does not apply).
- **Tests:** `node --check` PASS; `tests/admin-usuarios.smoke.js`
  **20/20** (7 new tests); `tests/boot.smoke.js` + `tests/cadastros-screens.smoke.js`
  **64/64** (no regression); `git diff --check` clean.
- **Visual validation:** confirmed by the architect on the
  `#/cadastros/usuarios` route, local app (`http://localhost:8765`) pointing
  to staging `ucrjtfswnfdlxwtmxnoo`, including the card background adjustment
  applied before closeout.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not
  executed.
- **Documentation created/updated:** `docs/design/CAMADA2_A32_MOCKUP_APPROVED.md`
  (new); `docs/governance/SUPERVISION_PROTOCOL.md` (new, supervision
  protocol — Architect/Reviewer/Resident Executor roles,
  onboarding, order format, gates); `docs/DOCUMENTATION_INDEX.md`
  (2 new entries).
- **Recorded debt (non-blocking, at the time):** `CAMADA2-LAST-ACCESS-RPC` —
  `NOT AUTHORIZED`, candidate to group with `A4.1`. **Closed on
  2026-07-16** — see the "Camada 2 — Temporary Password and Last-Access
  Read Model — A4.1 + CAMADA2-LAST-ACCESS-RPC" section at the top of this
  file.
- **Next authorizable action (at the time; `A4.1` + `CAMADA2-LAST-ACCESS-RPC`
  already `CLOSED / ACCEPTED` — see its own section at the top of this file):**
  remaining candidates without unambiguous priority: `A2.1` (`nivel_acesso`
  schema), `A6.1` (audit schema/trigger). `A3.3` (bulk
  actions) remains `DEFERRED`. `A3.4` (legacy code removal)
  depends on the other accepted A3.x subphases. No subphase authorized
  by this record.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this
  phase).

## Active front block

### Document Qualification / Documents Ingestor — G28

- **Front:** Document Qualification / Documents Ingestor — G28
- **Workspace:** `D:\OneDrive\Programação\Ravatex\controle-tapetes-g28`
- **Branch:** `work/g28-document-qualification`
- **Allowed remote:** none — no push without express authorization in this chain
- **Previous technical/documentation HEAD:** `b27e79fdba1ed8fb8a6232d8e0b8ca4b37ac3a2c` (historical baseline of G28-D discovery; this documentation record succeeds it).
- **Initial R1 documentation commit completed:** `271761c3de20427b2cc9059d5ff7cc3727545e6d` — `G28: reconcile canonical phase state` (initial R1 documentation closeout; already created and recorded).
- **Current action:** R1 documentation correction completed (docs-only, no code, tests, staging, production or push). Corrective commit `edaf0b4d36f24aa7b9490e51a42624cc70d45963` — `G28: correct canonical reconciliation state`. The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Last accepted phase:** `G28-C — CLOSED / ACCEPTED_WITH_NONBLOCKING_AUTHENTICATED_BROWSER_SMOKE_DEBT` (explicit architectural decision). Basis: staging/projections matrix 16/16, no material defect, zero cleanup and append-only ledger; production not accessed.
- **Active functional phase:** `NONE`. G28-C is `CLOSED`. G28-D discovery is `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION` and does not constitute an active functional phase; its publication is `NOT STARTED / NOT ACCEPTED / NOT AUTHORIZED`.
- **Next functional phase:** not named. After this documentation reconciliation, a read-only reconciliation of the general backlog (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md` and other fronts) will define the next front.
- **Schema/RPC (additive migration `db/52_document_link_correction_revocation_restoration.sql`, APPLIED in staging):** registry entry `20260715024449 / 52_document_link_correction_revocation_restoration` in `ucrjtfswnfdlxwtmxnoo`; `restored_from_revision_id UUID`, self-reference FK `ON DELETE RESTRICT`, partial index, writer evolved with `p_reason`/`p_restored_from_revision_id` DEFAULT NULL and `restaurar_vinculos_documento` were verified in catalog. B6 positional 5-argument calls and the B5 RPCs remained compatible/unchanged. Additive: no backfill, no touching candidates/events/decisions.
- **Runtime/UI:** `js/documents-supabase-links.js` (+`loadDocumentLinkRevisionHistory` read-only fail-closed; +`restoreDocumentLinksInCloud`; `registerDocumentLinksInCloud` loads optional `reason` preserving the 5-param shape); new pure modules `js/document-link-audit-read-model.js` (ordered trail + uniqueness of the active one) and `js/document-link-admin-controller.js` (correction/revocation/restoration orchestration; command-id reuse on retry with the RPC as idempotency authority; optimistic concurrency; outcome→UI mapping); new modal `js/screens/document-link-admin-modal.js` (inspects actives + history, corrects, unlinks, restores; mandatory reason; stale/conflict/unavailable fail-closed). Wired only in the central Documentos queue (`js/screens/documentos-recebidos.js`: guarded `handleLinkAdmin` + row action "Histórico e vínculos"); read-only Pedido/OP surfaces not touched. `index.html` loads the three new modules.
- **Direct staging verification:** Hermes applied migration 52 and approved structure/RPC/grants and the `G28-B8-VERIFY` authenticated matrix 18/18; B6 five-arguments and B5 intact were confirmed. The browser has no admin app/session: `LIVE_B8_MODAL_SMOKE_BLOCKED_BY_TOOLING`.
- **Local tests (LF, exit 0):** `document-link-correction-restoration-contract` 13/13; `document-link-audit-read-model` 11/11; `document-link-admin-controller` 18/18; `document-link-admin-modal.smoke` 12/12; `documents-supabase-links` 25/25 (12 new B8). Documentation battery B4–B8 (26 files) **831/831**. `node --check` on the 5 changed/new JS files; `git diff --check` clean (only informational LF→CRLF). `db/` allow-list in `document-decision-command-contract` extended to `db/52` (git manifest gate), consistent with the `db/51` precedent.
- **Pre-existing debts unchanged vs B7 baseline:** `pedido-detail.smoke.js` 140/41 (CRLF); `ops-list-screen.smoke.js` 19/11, `op-form-helpers.smoke.js` 33/3, `op-writes.smoke.js` 48/1 (strict index.html regex over untouched files); `documents-ingestor.test.js` 2; `g14-c-bridge-smoke.test.js` 15.
- **G28-D state:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`. A current canonical definition of the production publication mapping and of the authorized procedure for migrations 51/52 is missing; see `docs/releases/G28_D_RELEASE_CANDIDATE.md`. No push; production forbidden. Non-blocking debt: `AUTHENTICATED_BROWSER_SMOKE_BLOCKED_BY_TOOLING`.
- **B6/B8 contract preserved:** Document→Pedido 0..1; Document→OP 0..N; typed/versioned append-only canonical revision; `document_candidates.pedido_id`/`document_events.pedido_id` under Ingestor ownership; `pedido_manual` remains a suggestion; correction/revocation/restoration never erase history nor touch decision/suggestion.
- **OPEN_ARCHITECT_DECISIONS:** `NONE` for the current staging cycle (see "Architect Decision — Staging-Only Execution Boundary" at the top of this file). `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` is `DEFERRED UNTIL GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER`.
- **Later phases:** not authorized. G28-D was neither accepted nor published; this limited authorization does not authorize publication or later phases.
- **Reconciled master plan:** `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` (G28-PLAN-R1 2026-07-14)
- **Accepted B5-D5 subphases:** B5-B1 (idempotent decision command contract), B5-B2 (migration applied/verified staging), D4-R1 (canonical runtime modules loaded), D5-A (source boundary diagnosis), D5-B1 (explicit source classification), D5-B2 (source-gated local decision helpers), D5-B3 (statusOverrides removal), D5-B4 (legacy decision RPC runtime removal), D5 (consolidated regression GREEN). See ledger G28 for commit details and validation.
- **Push:** not executed
- **Production:** project `bhgifjrfagkzubpyqpew` not accessed
- **Runtime boundaries:** canonical register/undo adapters and RPCs preserved; SQL `decidir_documento` preserved (not removed, not migrated); no `statusOverrides` or parallel state; no `decideDocumentInCloud`; explicit manual/legacy local domain temporarily supported; Supabase/unknown/absent/null/invalid/g22-auto fail-closed; no migration, conversion, or removal of legacy domain authorized.

### Controlled Delete × Document History (Pedido/OP) — RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD

- **Front:** Controlled Delete (Pedido/OP, test/staging) × canonical G28 document history.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `707a37bd1d2c4728ab2a17433b6441049bd88062` — `Guard controlled delete against document link history`.
- **Classification:** `CLOSED / ACCEPTED`.
- **Original problem:** the controlled physical deletion of Pedido/OP (`db/34`–`db/37`) failed with an FK violation (`document_link_revision_ops_op_id_fkey`) when attempting to remove an OP still referenced by canonical document history (`document_link_revisions` / `document_link_revision_ops`), which is append-only and cannot be deleted merely to allow the deletion.
- **Root cause and fix (migrations `db/53`–`db/56`, applied and verified in staging `ucrjtfswnfdlxwtmxnoo`):**
  - `db/53_controlled_delete_document_link_guard.sql` — renames the four legacy `db/37` RPCs to `*_pre53` (revokes `EXECUTE` from all roles) and recreates the public signatures (`diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`) as `SECURITY DEFINER` wrappers: they diagnose and enrich with documentation counts, block when there is canonical history and delegate to `*_pre53` only when eligible.
  - `db/54_controlled_delete_document_link_grants.sql` — fixes an emergency security finding (`anon_execute = true` on the 4 public post-53 RPCs); revokes `PUBLIC`/`anon`, keeps `authenticated`.
  - `db/55_controlled_delete_document_link_policy_cast.sql` — fixes `to_jsonb(<literal>)` without explicit cast (error `could not determine polymorphic type`) via a forward-only `DO` that locates and replaces the policy literal in the two diagnostics already applied.
  - `db/56_controlled_delete_document_link_diagnostics_null_safe.sql` — fixes a regression introduced by `db/53`: `jsonb_set(...)` is `STRICT` and collapsed the entire return to `NULL` whenever the target was not blocked by document history (`reason` null). Fixed with `COALESCE(to_jsonb(v_reason), 'null'::jsonb)`, preserving the JSON schema.
- **Functional validation in staging (synthetic fixtures, zero cleanup, `op_numeros` preserved):**
  - Case A1 (eligible OP, with real dependency, without document history): non-null diagnosis, `remover_op(...)` completed the removal.
  - Case A2 (eligible Pedido, with real dependency, without document history): non-null diagnosis, `remover_pedido(...)` completed removal of the complete chain.
  - Case B (with document history in `document_link_revisions`/`document_link_revision_ops`): blocked diagnosis (`classification=blocked`, `documentary_history_blocker=true`); `remover_op`/`remover_pedido` returned controlled block (`ok=false`); Pedido, OP, `document_candidates`, `document_link_revisions` and `document_link_revision_ops` preserved without any change.
- **Final ACL (catalog verified live):** the 4 public RPCs — `PUBLIC` without `EXECUTE`, `anon` without `EXECUTE`, `authenticated` with `EXECUTE`. The 4 `*_pre53` functions — `PUBLIC`/`anon`/`authenticated` without `EXECUTE` (only `postgres`).
- **Final local tests:** `node --check js/delete-helpers.js` PASS; `tests/controlled-delete.smoke.js` **53/53**; `tests/document-canonical-links-contract.test.js` **21/21**; `git diff --check` PASS.
- **Permanent contract recorded:** physical deletion of Pedido/OP is blocked when canonical document history exists; `document_link_revisions`/`document_link_revision_ops` are never deleted by Controlled Delete; public wrappers always diagnose before delegating; internal destructive functions (`*_pre53`) do not constitute a public API; in the absence of document history, the prior deletion policy (`db/34`–`db/37`) remains in force unchanged; document history remains append-only. See `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`.
- **Production:** project `bhgifjrfagkzubpyqpew` not accessed.
- **Push:** not executed.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this fix).
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — multiple candidate fronts without unambiguous priority (G28-D publication blocked by `OPEN_ARCHITECT_DECISIONS: DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; general production backlog not yet reconciled). This read-only reconciliation remains pending and is not automatically assumed by this closeout.

### Admin/Pedido — Static Residue of the Completion Button (Expedição) — ADMIN-PEDIDO-STATIC-RESIDUE

- **Front:** static residue identified by the Admin/Pedido visual audit of `2026-07-05` (`PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.6/§9.7) and reconfirmed as the only open item in the read-only reconciliation of the general backlog of `2026-07-15`.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `7978e0a4fe021467cc23e0aeed63ac87ba738f1b` — `Fix admin order completion button state`.
- **Classification:** `CLOSED / ACCEPTED`.
- **Original problem:** `js/screens/expedicao-admin.js:405` (`buildConclusao`) constructed `disabled: ready ? null : 'disabled'`. The shared helper `el()` (`js/ui.js:10-22`) calls `setAttribute(k, v)` for every attribute of the object without omitting `null` (unlike the handling of children, which skips `null`/`false`); the real DOM materialized this as `disabled="null"` — a boolean attribute present — disabling the "Concluir pedido" button even when `ready === true`.
- **Confirmed root cause:** behavior of `el()`, not changed by this fix; single occurrence in the repository (confirmed by `git grep`), with no other screen reproducing the same pattern.
- **Fix applied:** located entirely at the call site. `buttonAttrs` is now built as a variable before the `return`; the `disabled` key is only added to the object when `!ready` (`buttonAttrs.disabled = 'disabled'`), never as `null`. `onclick` (including the `if (!ready) return;` guard), text, styles and button structure preserved with no semantic change. The global helper `js/ui.js` was not changed.
- **Regression test:** `tests/expedicao-flow.smoke.js` gained a new static test that forbids the original pattern, forbids the inverted variant (`disabled: !ready ? 'disabled' : null`) and requires the correct conditional pattern.
- **Local tests:** `node --check js/screens/expedicao-admin.js` PASS; `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js` **12/12** (no regression); `git diff --check` PASS.
- **Production:** project `bhgifjrfagkzubpyqpew` not accessed.
- **Staging:** not accessed; patch validated only locally.
- **Push:** not executed.
- **Closeout scope:** this closeout specifically closes the static residue above. It does not close Controle de Tapetes globally, does not constitute publication, is not production readiness, does not accept G28-D and does not conclude `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`, `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3` or `G28-CAMADA-4`, which remain unchanged.
- **Next authorizable action:** `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` — `READY FOR EXPLICIT ARCHITECT AUTHORIZATION` / `NOT STARTED`. This record does not authorize its execution.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this closeout).

### Client Portal — Order Detail Read Model — CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A

- **Front:** public read model of the Pedido detail in the Client Portal (`public.cliente_pedido_summary(uuid)`), consumed by `js/screens/cliente-pedido-detail.js` (~line 180, `supa.rpc('cliente_pedido_summary', { p_pedido_id })`).
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** not applicable — the phase did not change files (verification-only). **Documentation commit:** this closeout (`Close client order summary read model staging validation`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Classification:** `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS` (explicit architectural decision 2026-07-15).
- **Object in staging (`ucrjtfswnfdlxwtmxnoo`, PostgreSQL 17.6):** `db/30_cliente_pedido_summary_readmodel.sql` **was already applied**. The function exists with signature `cliente_pedido_summary(p_pedido_id uuid)`, `RETURNS jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, `plpgsql`; the body (`pg_get_functiondef`) is byte-for-byte equivalent to `db/30` (differing only in CRLF vs LF line endings) — **no schema drift**. The 16 dependency tables exist.
- **Migration provenance:** `db/30` **is not recorded** in `supabase_migrations.schema_migrations` (the tracked history begins at `document_technical_evidences`/`document_decision_command`/`52`…`56`; `db/30` predates that tracking). Object exists without a history row; provenance kept explicit.
- **Live ACL (divergent from the canonical contract):** `EXECUTE` granted to `PUBLIC`, `anon`, `authenticated` and `service_role`. `db/30` (and decision `D-COS02`) intend **only** `authenticated`. The extra grants are an artifact of Supabase default privileges — same class as the `db/54` finding. **Not silently normalized**: retained as governance/hygiene debt.
- **Empirical behavior (read-only; each RPC in `BEGIN … ROLLBACK`; `STABLE`/read-only function; zero data mutation):** T1 test client (`tipo='cliente'`, `cliente_id=3`) on its own Pedido (`numero 33`, `rascunho`) → `ok=true`, full DTO; T2 `anon` on the same Pedido → `ok=false`, "Pedido nao encontrado ou sem permissao" (**fail-closed**: executes but receives no data — **no confirmed exposure**); T3 client 3 on a third-party Pedido (`cliente_id=22`) → `ok=false` (cross-tenant denial); T4 admin on a third-party Pedido → `ok=true` (admin path).
- **Contract with the frontend:** all consumed fields present with the correct type (top-level `ok/pedido/itens/parciais/entregas/pendencias/chain_state/timeline/status/status_label/progresso_percentual`; `pedido.*`; `chain_state.{isOperationalOverride,displayStatus}`; `entregas[]{descricao,data,quantidade}`; `timeline[]{data,titulo,descricao,status}`; `itens[]{modelo,largura,cor_1,cor_2,metros}`). Empty collections come as `[]` (COALESCE) and nulls (`tipo_recebimento`, `observacao`) are handled without error by the consumer; `loadingError` branches are not on the happy path — **no dependency on silent fallback**.
- **Portal validation level:** `STATIC_CONTRACT_WITH_REAL_RPC_PAYLOAD`. Authenticated browser smoke not executed (no test client password) — non-blocking debt.
- **Local gates:** `node --check js/screens/cliente-pedido-detail.js` PASS; `git diff --check` clean; `git status --short` empty; HEAD unchanged during the technical verification.
- **Access and tooling:** Supabase MCP **not exposed in the session** (no `.mcp.json`, no installed connector); `supabase` CLI not installed. The **authorized direct PostgreSQL fallback** was used only for verification; the temporary out-of-repo tooling (pg driver + guarded runner + credentials file) was removed afterward; no secret echoed in command/log/report/Git. Production (`bhgifjrfagkzubpyqpew`) not accessed; the runner internally refuses the production ref.
- **No changes in the verification:** no schema mutation, no data mutation, no fixtures, no code/SQL change, no new migration, no ACL remediation, no commit, no push.
- **Non-blocking debts:** (1) `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — `PUBLIC`/`anon` still with `EXECUTE`, anon fail-closed, no confirmed exposure, remediation requires a grants-only migration authorized in its own phase; (2) `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` — object exists, no drift, explicit provenance; (3) `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED` — blocked by absence of a test client password; real RPC and frontend contract validated.
- **ACL remediation candidate (recorded, not authorized, not started):** `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` — `ARCHITECT DECISION REQUIRED`. Intended scope, if authorized: forward grants-only migration analogous to `db/54` (`REVOKE EXECUTE … FROM PUBLIC, anon`, preserving `authenticated`). Not created in this closeout.
- **Closeout scope:** specifically closes this staging validation of the read model. Does not close Controle de Tapetes globally, is not publication, is not production readiness, does not accept G28-D and does not alter `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3`, `G28-CAMADA-4`.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — no single unambiguous next action; the ACL remediation candidate must not be self-selected.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this closeout).

### Canonical Documentation — Consistency Backfill — DOCS-CANONICAL-CONSISTENCY-BACKFILL-A

- **Front:** closes 3 documentation gaps identified by the read-only reconciliation of the general backlog of `2026-07-15`. Docs-only: no code, test, SQL, migration, staging or production altered.
- **Branch:** `work/g28-document-qualification`.
- **Documentation commit:** this closeout (`Backfill canonical migration documentation`). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Classification:** `CLOSED / ACCEPTED`.
- **Gaps closed:**
  1. `db/37_controlled_delete_expedicao_cascade.sql` had never received its own `D-DEL` entry (gap recorded in `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` alongside decisions `D-DEL10`–`D-DEL13`) — `D-DEL14` added in `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §10 ("Controlled Delete Phase — Expedição Cascade (db/37)"), derived from the real `db/37` file and the `db/34`–`db/36` sequence.
  2. `db/34`–`db/37` and `db/53`–`db/56` missing from `docs/DOCUMENTATION_INDEX.md` §4 — 8 rows added with a description derived from the real content of each migration file.
  3. `db/30` status in the same index still described as "not yet applied" — corrected to: applied and functionally verified in staging (`ucrjtfswnfdlxwtmxnoo`), no schema drift confirmed, not recorded in `supabase_migrations.schema_migrations`, live ACL broader than the canonical `authenticated`-only intent (`D-COS02`), empirically fail-closed `anon` behavior, no confirmed client data exposure, ACL remediation as a separate architect decision, authenticated browser smoke as non-blocking debt.
- **Not altered:** no historical closeout entry was rewritten to make the previous omission disappear; `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` and `docs/architecture/DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md` were read and remained unchanged (no materially incorrect current-state assertion found); no code, test, SQL, migration, staging or production touched; `git diff --check` clean.
- **Debts preserved as open** (neither closed nor resolved by this backfill): `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (`ARCHITECT DECISION REQUIRED`); `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`; authenticated smoke debts (G28-C/D/B7/Client Portal); `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`; `G28-D` (publication); production application of the staging-only migrations (`db/12`, `db/21`, `db/30`, `db/49`–`db/56`); `DELETE-PROD-GUARD-A`; `DELETE-AUDIT-LOG-A`; fronts `G28-CAMADA-2/3/4`.
- **Production:** project `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED` — `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` remains the only material gate of the backlog. This documentation backfill does not authorize any later technical phase.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this closeout).

### Client Portal — ACL Grants Hardening — CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1

- **Front:** ACL remediation of the public read model `public.cliente_pedido_summary(uuid)`, closing the `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` debt recorded in the `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` closeout.
- **Branch:** `work/g28-document-qualification`.
- **Technical HEAD:** `82f5ba70ace2e74c51b7c0295d1ecf8e319954be` — `Restrict client order summary RPC grants`. **Documentation commit:** this closeout (`Close client order summary RPC grant hardening`). The current HEAD must be consulted directly with `git rev-parse HEAD`.
- **Classification:** `CLOSED / ACCEPTED`.
- **Migration:** `db/57_cliente_pedido_summary_acl_grants.sql`, grants-only, forward-only, idempotent. Applied exactly once via Supabase MCP (tracked migration operation) in staging `ucrjtfswnfdlxwtmxnoo`; registry `20260715190627 / 57_cliente_pedido_summary_acl_grants` confirmed in the migrations catalog.
- **Final ACL (verified live):** `PUBLIC` without `EXECUTE`; `anon` without `EXECUTE`; `authenticated` with `EXECUTE`; `service_role` without explicit `EXECUTE` (no real consumer found in the full repository search — only the authenticated frontend client in `js/screens/cliente-pedido-detail.js`). Owner `postgres` retains inherent owner privilege.
- **Function contract preserved unchanged:** name, signature `cliente_pedido_summary(uuid)`, `jsonb` return, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`, body — definition hash identical before/after the migration (verified via `pg_get_functiondef`).
- **Empirical role matrix (staging, read-only, `BEGIN … ROLLBACK`):** `anon` now receives `ERROR 42501: permission denied for function cliente_pedido_summary` at the ACL boundary, before any execution of the function (upgrade relative to the previous post-execution fail-closed); `authenticated` owner → `ok=true`, full DTO; `authenticated` cross-tenant → `ok=false` (business denial, fail-closed, no third-party data); `authenticated` admin → `ok=true`, full DTO; `service_role` via direct `SET ROLE` → `ERROR 42501` (object grant successfully revoked; `service_role`'s `rolbypassrls` platform attribute is an RLS-bypass mechanism on tables, distinct and unrelated to function `EXECUTE`, and does not restore access).
- **Frontend:** `js/screens/cliente-pedido-detail.js` remains the only real consumer, via `window.supa.rpc('cliente_pedido_summary', ...)` on the standard authenticated path; no frontend change was necessary or made.
- **Local tests:** `tests/cliente-pedido-summary-acl-grants.smoke.js` (new, 13 assertions) + `tests/cliente-pedido-summary-readmodel.smoke.js` (existing) — **21/21 PASS**; `git diff --check` clean.
- **No data mutation:** all empirical checks ran in `BEGIN … ROLLBACK` transactions; no fixture created; pre-existing real records reused (pedido 33/cliente_id 3, pedido 34/cliente_id 22, existing admin/client users).
- **Debt closed:** `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` — **RESOLVED IN STAGING**.
- **Debts preserved as open (not closed by this phase):** `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY` (no migration-history record fabricated or repaired for `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; production application of the staging-only stack (`db/57` included) remains deferred by `STAGING-ONLY-EXECUTION-BOUNDARY-A`.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed. **Vercel:** not accessed.
- **Closeout scope:** specifically closes the ACL remediation of this RPC. Does not authorize production, publication, G28-D, repair of the `db/30` migration history, authenticated browser smoke or Controlled Delete production guard.
- **Next authorizable action:** `ARCHITECT DECISION REQUIRED AFTER BACKLOG RECONCILIATION` — no single unambiguous technical candidate after removing this phase from the open backlog.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this closeout).

### Canonical Documentation — Status Consistency of the Legacy Pedido↔OP Plans — DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1

- **Front:** reconciles the materially outdated status lines of the legacy Phases D–J in the two technical plans of the Pedido ↔ OP ↔ Movimentação ↔ Documentos front. Docs-only: no code, runtime, test, SQL, migration, staging or production altered.
- **Branch:** `work/g28-document-qualification`.
- **Documentation commit:** this closeout (`Reconcile legacy Pedido OP plan phase statuses`). The current HEAD must be consulted with `git rev-parse HEAD`.
- **Classification:** `CLOSED / ACCEPTED`.
- **Fix applied** (`docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §9 and `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` §5):
  - Phases **D/E/F** no longer appear as `Pendente`/blank and become **Entregue** through the accepted production-flow work (Pedido Detail lists linked OPs; stepper/preview via `derivePedidoChainState`; Pedido reuses canonical OP operations without a parallel write). Basis: `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.1/§1.2/§9.4/§9.5/§9.7.
  - Phases **G/H/I** become **Superada** through the canonical G28 documentation pipeline (`document_link_revisions`/`document_link_revision_ops`, db/51/52; `documentos_operacionais` never created). Basis: `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`, G28-B1…C accepted.
  - Phase **J** remains visible as `Futura / não sequenciada / não iniciada / não autorizada` (per-stage transactional balance blocking; `PEDIDO_OP_SCHEMA_CONTRACT.md` §7).
- **Not altered:** no dated historical section rewritten; the original architectural design (`documentos_operacionais` §4, per-stage balance §7) preserved as intent; no code/test/SQL/migration/runtime touched; no implementation phase authorized.
- **State unchanged by this fix:** `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pending explicit architect selection of a new front. Debts and deferred fronts remain open and unchanged.
- **Production:** `bhgifjrfagkzubpyqpew` not accessed. **Push:** not executed. **Supabase/MCP/staging/Vercel:** not accessed.
- **Ledger:** `docs/ledgers/G28_LEDGER.md` (append-only entry for this closeout).

