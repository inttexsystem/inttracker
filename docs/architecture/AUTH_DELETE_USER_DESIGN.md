# Auth Delete User Design

**Phase:** `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`  
**Scope:** docs-only / design-only — no implementation, no code, no SQL, no real Supabase.  
**Date:** 2026-06-24  
**Reference HEAD:** `3c9c424`

---

## 1. Problem

User creation is now consistent between Auth and profile — the Edge
Function `admin-create-user` creates `auth.users` and `public.usuarios` in
the same atomic and compensated flow, guaranteeing
`auth.users.id = public.usuarios.id`.

However, user deletion/deactivation by the app still has no defined
semantics. The current behavior only removes the profile from
`public.usuarios`, leaving `auth.users` intact. This can generate
orphaned Auth users (with valid login, but no profile in the app),
reintroducing the operational inconsistency that the creation Edge
Function solved.

This phase defines the correct deletion/deactivation semantics to
guide future implementation, without executing code or deploy.

---

## 2. Current state

### 2.1 User listing (`screenCadastrosUsuarios`)

File: `js/screens/cadastros.js:481-649`

The `#/cadastros/usuarios` screen:

- **Listing** (lines 484-490): `SELECT id, email, nome, tipo,
  fornecedor:fornecedor_id(id, nome, tipo)` in `public.usuarios` with
  a join on `fornecedores`, ordered by e-mail.
- **Columns displayed**: E-mail, Nome, Tipo, Fornecedor.
- **Row actions**: "Editar" and "Excluir vínculo".

### 2.2 User editing

- **Calls** `window.supa.from('usuarios').update(...)` directly,
  changing `email`, `nome`, `tipo`, `fornecedor_id`.
- **Does not** change `auth.users` (password, Auth e-mail, etc.).
- **Does not** call any Edge Function.
- UID displayed as readonly (disabled field).

### 2.3 User deletion (current behavior)

File: `js/screens/cadastros.js:633-645`

```js
function confirmExcluir(usr) {
  window.confirmDialog({
    title: 'Excluir vínculo',
    message: `Remover "${usr.email}" da tabela de usuários? O cadastro no Supabase Auth NÃO será removido (precisa fazer manual no Studio).`,
    confirmLabel: 'Remover',
    onConfirm: async () => {
      const { error } = await window.supa.from('usuarios').delete().eq('id', usr.id);
      if (error) { window.toast('Erro ao remover', 'error'); console.error(error); return; }
      window.toast('Vínculo removido', 'success');
      reload();
    }
  });
}
```

Analysis of the current behavior:

| Aspect | State |
|---|---|
| Button label | "Excluir vínculo" (not "Excluir usuário") |
| Modal label | "Excluir vínculo" |
| Confirmation message | Warns that Auth will **not** be removed |
| Effective action | `.delete()` only on `public.usuarios` |
| Auth user | **Preserved** — remains active and can authenticate |
| Server-side validation | **None** — only RLS (`usuarios_admin_all`) |
| Self-deletion block | **None** — admin can delete themselves |
| E-mail confirmation | **None** — only simple confirmDialog |
| Auditing | **None** — physical delete, no trace |

### 2.4 Calls to Auth Admin on the front-end

**None.** Confirmed by:

- `tests/cadastros-usuarios-auth-ui.smoke.js:77-79`: asserts that
  `cadastros.js` does **not** call `auth.admin`.
- `js/screens/cadastros.js` does not contain `auth.admin`, `service_role`,
  `SUPABASE_SERVICE_ROLE_KEY` or `supabase/functions` (besides the
  `admin-create-user` call for creation).

### 2.5 Deletion Edge Function

**Does not exist.** The only Edge Function implemented is `admin-create-user`
(`supabase/functions/admin-create-user/index.ts`). It uses
`auth.admin.deleteUser` only in the **compensation** flow (rollback
when the `public.usuarios` insert fails), not as an exposed feature.

### 2.6 Status/active/inactive column

**Does not exist** in `public.usuarios`. The current schema (`db/01_schema.sql:26-33`):

```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'fornecedor')),
  fornecedor_id BIGINT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

There is no `ativo`, `status`, `bloqueado` or `deleted_at` column. Deletion
is always physical (hard delete), with no soft delete possible.

### 2.7 FK `public.usuarios.id → auth.users.id ON DELETE CASCADE`

File: `db/01_schema.sql:27`

```sql
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
```

Behavior:

- **Deleting `auth.users`** → `public.usuarios` is automatically removed
  by CASCADE.
- **Deleting `public.usuarios`** → `auth.users` is **not** affected
  (FK is unidirectional).
- The delete operation on `auth.users` requires `service_role` or an
  administrative action in the Supabase Dashboard — it is not possible
  via anon client.

### 2.8 Current RLS for `usuarios`

File: `db/03_policies.sql:27-37`

```sql
-- Admin: tudo (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY usuarios_admin_all ON usuarios FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Usuário comum: vê o próprio
CREATE POLICY usuarios_select ON usuarios FOR SELECT
  USING (id = auth.uid() OR is_admin());

-- Self-update: usuário atualiza o próprio perfil, sem mudar tipo
CREATE POLICY usuarios_self_update ON usuarios FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND tipo = (SELECT tipo FROM usuarios WHERE id = auth.uid()));
```

Observations:

- `usuarios_admin_all` covers DELETE — any admin can delete any
  user from `public.usuarios`.
- **There is no self DELETE policy.** A fornecedor cannot delete
  their own profile via RLS (which is desirable).
- RLS **does not validate** anything server-side when the delete is
  performed via `service_role` (Edge Function); therefore the explicit
  check is necessary.

### 2.9 `loadCurrentUser` and impact of a missing profile

File: `js/auth.js:82-101`

```js
async function loadCurrentUser() {
  const { data: { session } } = await window.supa.auth.getSession();
  if (!session) { window.CURRENT_USER = null; return null; }
  const { data, error } = await window.supa.from('usuarios')
    .select('id, email, nome, tipo, fornecedor_id, fornecedores:fornecedor_id(tipo)')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('Erro carregando perfil:', error);
    window.CURRENT_USER = null;
    return null;
  }
  window.CURRENT_USER = data;
  window.CURRENT_USER.fornecedor_tipo = data.fornecedores?.tipo || null;
  return data;
}
```

If `public.usuarios` is deleted but `auth.users` remains active:

1. The user authenticates normally (`signInWithPassword` works).
2. `loadCurrentUser` tries to read `public.usuarios` by `session.user.id`.
3. `.single()` returns an error (record not found).
4. `CURRENT_USER = null`.
5. Boot interprets this as "not logged in" → redirect to `#/login`.
6. Result: **login loop** — Auth OK, but no profile.

This is exactly the bug that the creation Edge Function solved for the
provisioning flow. The current deletion reintroduces the same symptom
through the reverse path.

---

## 3. Risks of the current state

### 3.1 Orphaned Auth user (HIGH risk)

**Scenario:** admin clicks "Excluir vínculo" → `public.usuarios` is
removed → `auth.users` remains active.

**Consequences:**

- The user can authenticate (login/password work).
- The app redirects to `#/login` due to missing profile (loop).
- Admin loses visibility of the user in the listing (already removed
  from `public.usuarios`), but the Auth account still exists.
- To fix it: access to the Supabase Dashboard is required to manually
  delete from `auth.users`.

### 3.2 Hard delete of the profile without hard delete of Auth (HIGH risk)

Same risk as 3.1, aggravated by the fact that the current UI calls this
"Excluir vínculo" and warns that Auth will not be removed — but the
operator may not understand the practical implication (a ghost user who
can log in but cannot access the app).

### 3.3 Delete on `public.usuarios` does not cascade to Auth (MEDIUM risk)

The FK `usuarios.id → auth.users(id) ON DELETE CASCADE` only works in
the Auth → profile direction. Deleting the profile does **not**
propagate to Auth.

To remove `auth.users` it is necessary to use:

- `service_role` (server-side Edge Function), or
- Supabase Dashboard (manual), or
- SQL Admin (`DELETE FROM auth.users WHERE id = '...'`).

None of these paths is available in the current app flow.

### 3.4 Physically deleting harms auditing (MEDIUM risk)

Hard delete permanently removes the record. There is no:

- Soft delete (`ativo = false`).
- `deleted_at` column.
- Log of who deleted, when and why.

If a user is deleted and it later becomes necessary to audit past
actions (e.g. "who created OP X?", "who approved delivery Y?"),
the link to `usuarios.id` is lost — other tables reference
`usuarios.id` but the original row is gone.

### 3.5 Admin can self-delete (HIGH risk)

There is no validation that prevents `CURRENT_USER.id === usr.id`.
If the only admin deletes themselves, the system loses administrative
capacity until another admin is created manually in Supabase Studio.

### 3.6 Fornecedor cannot delete a user (LOW risk)

The current RLS (`usuarios_admin_all`) prevents fornecedor from
deleting any record in `usuarios`. This is correct. The risk is only
that the future design might accidentally allow it.

### 3.7 Indirect impact on other tables (LOW risk)

`usuarios.fornecedor_id` references `fornecedores(id) ON DELETE SET NULL`.
If a fornecedor is deleted, `usuarios.fornecedor_id` becomes NULL — which
would break the fornecedor link but preserve the login.

`usuarios.id` is **not** referenced as an FK by other domain tables
(OPs, entregas, etc.), so deleting the profile does not compromise the
referential integrity of operational data. However, historical
auditing (who created/changed what) may be affected.

### 3.8 RLS does not replace server-side validation (MEDIUM risk)

The future Edge Function will use `service_role`, which **ignores RLS**.
All permission validation (admin, no self-deletion, etc.) needs to be
explicit in the function's code, not delegated to RLS.

---

## 4. Alternatives evaluated

### 4.1 Alternative A — Hard delete only on `public.usuarios` (status quo)

**Description:** keep the current behavior: delete the profile,
preserve Auth. The operator cleans up Auth manually in the Dashboard.

**Advantages:**

- No change necessary (already implemented).
- Simple.

**Disadvantages:**

- Generates an orphaned Auth user (login works, app redirects).
- Operational inconsistency — the same problem that the creation Edge
  Function solved.
- Requires access to the Supabase Dashboard for full cleanup.
- Does not scale.

**Conclusion:** not recommended as the main flow. It can remain as a
low-level contingency, but should not be the default path offered by
the UI.

### 4.2 Alternative B — Hard delete of `auth.users` via Edge Function (`admin-delete-user`)

**Description:** server-side Edge Function that calls
`auth.admin.deleteUser(userId)`, and the `ON DELETE CASCADE` FK
removes `public.usuarios` automatically.

**Advantages:**

- Cleans up Auth + profile atomically (cascade guarantees consistency).
- Server-side operation with `service_role` — secure.
- Leaves no orphans in either direction.

**Disadvantages:**

- **Destructive and irreversible** operation — no soft delete.
- Permanently removes the user's audit history.
- Needs rigorous validations:
  - Block self-deletion.
  - Confirm typed e-mail (double confirmation).
  - Do not allow deletion of the last admin.
- Requires deploying a new Edge Function.
- `auth.admin.deleteUser` is a critical operation — if it fails after
  the profile cascade (unlikely, but possible), the state becomes
  inconsistent.

**Conclusion:** viable for definitive cleanup scenarios (e.g. test,
staging, never-used user), but **risky as the standard flow in
production** because it is irreversible and lacks auditing.

### 4.3 Alternative C — Soft delete / deactivation on the profile

**Description:** add a column `ativo BOOLEAN NOT NULL DEFAULT true`
(or `status TEXT`) to `public.usuarios`. Logical deletion marks
`ativo = false` instead of deleting.

**Advantages:**

- Preserves traceability and auditing.
- Reversible (reactivate user).
- Easy to implement: one column + filter in the queries.
- Does not remove `auth.users` — but prevents access to the app (see
  disadvantage).

**Disadvantages:**

- **The Auth user can still authenticate.** Marking `ativo = false` in
  `public.usuarios` prevents `loadCurrentUser` from loading the
  profile, but the user can still log in to Auth. The app redirects to
  `#/login` (loop), but the Auth session exists. To fully block login,
  it would also be necessary to ban/disable in Auth.
- Requires a schema change (migration).
- Requires updating RLS (filter `ativo = true` in the policies).
- Requires adapting the UI (listing should show/filter inactive users).
- Requires adapting `loadCurrentUser` (only load if `ativo = true`).

**Conclusion:** good for preserving history and allowing reactivation,
but **insufficient on its own** — needs to be combined with a block on
Auth (alternative D) or complemented with a ban Edge Function.

### 4.4 Alternative D — Auth server-side ban/deactivation

**Description:** Edge Function that uses `auth.admin.updateUserById`
to ban the user (Supabase offers `ban` as an option of
`updateUserById`), preventing login, combined with soft delete on the
profile (alternative C).

**Advantages:**

- Prevents login without erasing history.
- Profile remains in `public.usuarios` for auditing.
- Combines security (no login) with traceability.
- Reversible (unban).

**Disadvantages:**

- Need to confirm the availability and exact behavior of the
  `auth.admin.updateUserById` API with `ban: true` in the Supabase
  version used in staging (`ucrjtfswnfdlxwtmxnoo`).
- Requires deploying a new Edge Function.
- Requires a schema change (`ativo`/`status` column).
- More complex than alternatives A or B.

**Conclusion:** the **most complete** and **recommended** alternative
for production. If the ban API is unavailable or inadequate, use
`auth.admin.deleteUser` as a controlled fallback.

### 4.5 Alternative E — Block deletion via the app

**Description:** remove or disable the "Excluir vínculo" button from
the UI until a safe flow is implemented. Keep creation and editing
working.

**Advantages:**

- Zero immediate risk — no user is improperly deleted.
- Trivial implementation (remove button or hide behind a flag).
- Gives time to design and test the final solution.

**Disadvantages:**

- Loss of functionality (admin cannot remove users through the app).
- Staging/production cleanup becomes dependent on the Supabase
  Dashboard.
- Not a definitive solution — only risk containment.

**Conclusion:** recommended as a **short-term measure** while the
final design is implemented. Can be done in the same UI phase as the
deactivation Edge Function.

---
## 5. Architectural recommendation

### Decision: prefer DEACTIVATING over physically DELETING

**Recommendation on two fronts:**

#### Short term (now): Alternative E

- Remove or restrict the "Excluir vínculo" button in the
  `#/cadastros/usuarios` UI.
- Cleanup of test/staging users continues via the **Supabase
  Dashboard** (procedure documented in
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` section 9).
- This eliminates the immediate risk of generating orphaned Auth users
  through the app.

#### Long term (future phase): Alternative D + C (DEACTIVATE)

- Implement the `admin-disable-user` Edge Function that:
  - Marks `public.usuarios.ativo = false`.
  - Applies a ban in Auth (`auth.admin.updateUserById` with
    `ban: true`), if the API is available. Otherwise, only the soft
    delete on the profile already blocks access to the app (with the
    documented caveat that Auth login still works).
- Add column `ativo BOOLEAN NOT NULL DEFAULT true` to
  `public.usuarios`.
- Update RLS and `loadCurrentUser` to respect `ativo`.

### Technical justification

1. **Auditability:** production needs traceability. Hard delete
   permanently removes the link between past actions and the user who
   performed them.
2. **Reversibility:** deactivating allows reactivation if there is an
   operational error. Deleting is irreversible without a backup.
3. **Security:** deactivating the profile + banning in Auth blocks
   both app access and login, without destroying data.
4. **Consistency with creation:** if the creation flow is atomic and
   compensated, the deactivation flow should be too — but with
   additional safety (without destruction).
5. **Staging:** test users can continue to be removed via the
   Dashboard with `ON DELETE CASCADE` (already documented and
   functional).

---

## 6. Proposed contract for future phase

### Recommended option: `admin-disable-user`

**Edge Function:** `supabase/functions/admin-disable-user/index.ts`

#### Payload

```json
{
  "user_id": "<uuid>",
  "reason": "texto opcional para auditoria"
}
```

#### Behavior

1. **Validate JWT** — extract `auth.uid()` from the `Authorization`
   header.
2. **Require admin** — query `public.usuarios` and confirm
   `tipo = 'admin'` for the caller.
3. **Block self-deactivation** — `user_id !== callerId`.
4. **Validate that the target user exists** — query `public.usuarios`
   by `id`.
5. **Mark as inactive** — `UPDATE public.usuarios SET ativo = false
   WHERE id = user_id`.
6. **Ban in Auth** — `auth.admin.updateUserById(user_id, { ban: true })`
   (if the API is available; otherwise, skip with a log).
7. **Record log** (no password, no secrets):
   - `callerId`, `targetUserId`, `reason` (if provided), timestamp.
8. **Return final state:**
   ```json
   {
     "data": {
       "user_id": "<uuid>",
       "email": "usuario@exemplo.com",
       "ativo": false,
       "auth_banned": true
     }
   }
   ```

#### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid JWT. |
| `FORBIDDEN` | 403 | Caller is not admin. |
| `SELF_DISABLE` | 403 | Admin attempted to deactivate themselves. |
| `USER_NOT_FOUND` | 404 | `user_id` does not exist in `public.usuarios`. |
| `ALREADY_DISABLED` | 409 | User is already inactive. |
| `VALIDATION_ERROR` | 400 | Invalid payload. |
| `DISABLE_FAILED` | 500 | Failed to update profile or Auth. |
| `UNKNOWN` | 500 | Unclassified error. |

#### Security

- `service_role` **only** server-side (Edge Function environment
  variable, never on the front end).
- Server-side admin validation (does not trust the client).
- Server-side self-deactivation blocking.
- Logs without `password`, `service_role`, or JWTs.

### Secondary option (if hard delete is necessary): `admin-delete-user`

**Edge Function:** `supabase/functions/admin-delete-user/index.ts`

#### Payload

```json
{
  "user_id": "<uuid>",
  "confirm_email": "email@usuario.com"
}
```

#### Behavior

1. Validate JWT + require admin + block self-deletion (same as
   above).
2. **Confirm email:** the `confirm_email` must match the target
   user's email (case-insensitive). This prevents accidental clicks.
3. **Delete Auth user:** `auth.admin.deleteUser(user_id)`.
4. **Cascade removes profile:** `ON DELETE CASCADE` on
   `public.usuarios.id → auth.users.id` removes the profile
   automatically.
5. **Return success** (without exposing `service_role`).
6. If `deleteUser` fails, return an error — **never** delete the
   profile manually before Auth.

---

## 7. Changes needed by layer

### 7.1 Database

- **New column:** `public.usuarios.ativo BOOLEAN NOT NULL DEFAULT true`
  (future schema migration, own phase).
- **New optional columns:** `public.usuarios.desativado_em TIMESTAMPTZ`
  and `public.usuarios.desativado_por UUID` (for auditing).
- **New RLS policies:**
  - `usuarios_select`: filter `WHERE ativo = true OR is_admin()`
    (admin sees everyone, including inactive users).
  - `usuarios_self_update`: add `AND ativo = true` (an inactive user
    cannot self-edit).
- **Impact on `loadCurrentUser`:**
  - Add condition `AND ativo = true` to the profile query.
  - If `ativo = false`, `loadCurrentUser` returns `null` → redirect
    to `#/login` (existing behavior, unchanged).

### 7.2 Edge Function

- **New function:** `admin-disable-user` (recommended) or
  `admin-delete-user` (secondary).
- **Admin validation:** server-side, querying `public.usuarios`.
- **Self-operation blocking:** `user_id !== callerId`.
- **Logs:** without `password`, without `service_role`, without JWTs.
- **Location:** `supabase/functions/admin-disable-user/index.ts`.
- **Deploy:** own phase (`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`).

### 7.3 Front-end (`js/screens/cadastros.js`)

**Short term (Alternative E):**

- Remove or hide the "Excluir vínculo" button from the users table.
- Option: replace with an "Em breve" tooltip or hide it completely.

**Long term (Alternative D+C):**

- "Desativar usuário" (or "Desativar") button in place of "Excluir
  vínculo".
- Strong confirmation modal:
  - Title: "Desativar usuário".
  - Message: "O usuário `<email>` será desativado e perderá acesso ao
    sistema. Esta ação pode ser revertida por outro admin."
  - Optional: reason field.
- Call to the Edge Function:
  ```js
  const { error } = await window.supa.functions.invoke('admin-disable-user', {
    body: { user_id: usr.id, reason: motivo }
  });
  ```
- Error handling:
  - `SELF_DISABLE` → "Você não pode desativar a si mesmo."
  - `ALREADY_DISABLED` → "Usuário já está desativado."
  - `FORBIDDEN` → "Apenas admins podem desativar usuários."
- **Never** call `auth.admin` in the browser.
- **Never** expose `service_role`.

### 7.4 User listing

- **Admin:** sees everyone, including inactive users (with visual
  indicator: gray "Inativo" badge).
- **Fornecedor:** sees only their own profile (existing RLS +
  `ativo = true` filter).
- **"Reativar" button:** available for admin to reverse deactivation
  (future phase).

### 7.5 Runbook

- Update `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md`:
  - Deactivation section (new).
  - Update the cleanup section (keep Dashboard cleanup for staging,
    mention the Edge Function for production).
  - Include troubleshooting for a deactivated user who cannot log in.

---

## 8. Acceptance criteria for future implementation

The implementation (code) phase will only be considered complete
when:

- [ ] No `service_role` is present in the front end, `js/config.js`,
  `index.html`, `localStorage`, or any versioned file on the client.
- [ ] No Auth user is left orphaned after deactivation (profile is
  marked `ativo = false`, Auth user is banned — or remains consistent
  with the profile state).
- [ ] No profile is left orphaned (without a corresponding Auth
  user).
- [ ] Fornecedor cannot deactivate/delete a user (403 from the Edge
  Function + RLS).
- [ ] Admin cannot deactivate/delete themselves (403 `SELF_DISABLE`
  from the Edge Function).
- [ ] Edge Function logs contain no `password`, `service_role`, or
  JWTs.
- [ ] Smoke tests cover:
  - Server-side admin validation.
  - Self-deletion blocking.
  - Fornecedor blocking.
  - Invalid payload.
  - Absence of `service_role` on the front end.
- [ ] E2E test in staging with a disposable user:
  - Create a test user via `admin-create-user`.
  - Deactivate via `admin-disable-user`.
  - Confirm `ativo = false` in `public.usuarios` (read-only SQL).
  - Confirm that login for the deactivated user fails or redirects.
  - Clean up via Dashboard after the test.
- [ ] `loadCurrentUser` respects `ativo = true` (inactive user does
  not load a profile).
- [ ] User listing (admin) shows an inactive indicator.

---

## 9. Pending decisions for HMNlead

The following decisions need to be made by the project owner before
implementation:

1. **Physically delete or deactivate?**
   - Deactivate (recommended): preserves auditability, reversible.
   - Delete: permanently removes, useful only for staging/testing.

2. **Does history/audit trail of who did what need to be kept?**
   - If so, soft delete + `desativado_em` / `desativado_por` columns.

3. **Can test/staging users continue to be removed manually via the
   Dashboard until the dedicated phase?**
   - Recommendation: yes. This is already the procedure documented in
     the runbook.

4. **Should production allow physical deletion, or only
   deactivation?**
   - Recommendation: deactivation only. Physical deletion only via
     the Dashboard during an incident.

5. **Should there be a typed-email confirmation for deletion?**
   - For hard delete: yes (prevents accidental clicks).
   - For deactivation: optional (the action is reversible).

6. **Should deletion/deactivation of the last admin be blocked?**
   - Recommendation: yes. There should always be at least 1 active
     admin.

7. **Is the `auth.admin.updateUserById` API with `ban: true`
   available in the Supabase version used in staging?**
   - Needs technical verification before implementation. If not
     available, use only the soft delete on the profile (with the
     documented caveat that Auth login still works).

---

## 10. Proposed next phase

### Recommended phase: `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`

**Scope:** schema-only, docs-only.

**Objective:** design and validate the schema change needed to
support soft delete (`ativo`, `desativado_em`, `desativado_por`),
before implementing code.

**Deliverables:**
- Proposed SQL migration (read-only, not to be executed).
- Impact on RLS policies.
- Impact on `loadCurrentUser` (`ativo = true` filter).
- Static smoke tests for the new schema.

**Next phase:** `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`
(implementation of the `admin-disable-user` Edge Function).

### Alternative phase (if hard delete is the decision):
`RAVATEX-TAPETES-AUTH-DELETE-USER-EDGE-FUNCTION-A`
(implementation of the `admin-delete-user` Edge Function).

### Immediate containment phase (if you want to block deletion now):
`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`
(remove or hide the "Excluir vínculo" button from the UI).

---

## 11. References

- `js/screens/cadastros.js:481-649` — `screenCadastrosUsuarios`.
- `js/auth.js:82-101` — `loadCurrentUser`.
- `js/auth.js:59-67` — `login`.
- `supabase/functions/admin-create-user/index.ts` — creation Edge
  Function (architecture reference).
- `db/01_schema.sql:26-33` — `usuarios` schema.
- `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
- `db/03_policies.sql:27-37` — `usuarios` RLS.
- `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` — creation
  Edge Function design.
- `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` — operational
  runbook (section 9: test cleanup).
- `docs/architecture/CODE_HEALTH_RULES.md` — architectural health
  rules.
- `tests/cadastros-usuarios-auth-ui.smoke.js` — user UI smoke test.
- `tests/admin-create-user.smoke.js` — creation Edge Function smoke
  test.
