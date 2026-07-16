# Design: Supabase Auth User Provisioning

**Phase:** `RAVATEX-TAPETES-AUTH-EDGE-DESIGN-A`  
**Scope:** docs-only / design-only — no Edge Function implementation, no functional change in the app, no SQL/deploy.  
**Date:** 2026-06-23  
**Reference HEAD:** `88aa4fb`

---

## 1. Context and problem

The **Ravatex Controle de Tapetes** app uses two distinct entities for identity:

* **Supabase Auth (`auth.users`)** — email/password authentication, issues JWT.
* **`public.usuarios`** — app profile, with domain fields (`nome`, `tipo`, `fornecedor_id`).

The operational link is:

```text
auth.users.id = public.usuarios.id
```

`js/auth.js :: loadCurrentUser()` does exactly this: takes the Auth session, reads `public.usuarios` by `session.user.id` and fills `CURRENT_USER`. If the profile does not exist, `loadCurrentUser()` returns `null`, boot interprets it as "not logged in" and the user goes back to `#/login` — even with a valid Auth login. This behavior has already occurred in staging.

The current screen `#/cadastros/usuarios` (`screenCadastrosUsuarios` in `js/screens/cadastros.js`) only inserts/updates `public.usuarios`. The current operational flow requires:

1. Manually creating the user in Supabase Studio (`auth.users`).
2. Copying the generated UID.
3. Going back to the app.
4. Pasting the UID into the users screen and completing `public.usuarios`.

This is a source of:

* **Inconsistency** — auth user without a profile (orphan) or profile without an auth user.
* **UX error** — login apparently correct, but redirect to `#/login` due to a missing profile.
* **Operational risk** — dependency on Supabase Studio access for every new user.

The target solution is a **server-side Supabase Edge Function** called by the admin app to create `auth.users` and `public.usuarios` in a controlled way, without exposing `service_role` in the browser.

---

## 2. Current app state

### 2.1 Relevant files

* `js/auth.js` — `login`, `logout`, `loadCurrentUser`, `CURRENT_USER`, `isAdmin`/`isFornecedor` helpers.
* `js/screens/cadastros.js` — `screenCadastrosUsuarios` screen (lines ~481–585).
* `js/config.js` — public URLs/anon keys per environment; does **not** contain `service_role`.
* `js/supabase-client.js` — anon client + write-guard; does **not** contain `service_role`.
* `js/boot.js` / `js/router.js` — redirect based on `CURRENT_USER`.
* `db/01_schema.sql` — `usuarios.id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
* `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
* `db/03_policies.sql` — RLS: admin sees/does everything in `usuarios`; regular user sees only their own.

### 2.2 Current `screenCadastrosUsuarios` flow

1. **Listing** — `SELECT id, email, nome, tipo, fornecedor_id` on `public.usuarios` joined with `fornecedores`, ordered by email.
2. **Creation modal** — requires `id` (Auth UID), `email`, `nome`, `tipo`, `fornecedor_id`.
   * The `id` field is disabled on edit.
   * Validations: `id`, `email`, `nome`, `tipo` required; `fornecedor_id` required when `tipo = 'fornecedor'`.
   * Direct insert: `supa.from('usuarios').insert(payload)`.
   * Common mapped errors: `duplicate` → "UID or email already registered"; `foreign key` → "UID does not exist in Supabase Auth — create it there first".
3. **Editing** — updates `email`, `nome`, `tipo`, `fornecedor_id` by `id`.
4. **Deletion** — removes only from `public.usuarios`; the message informs that the Auth record is **not** removed.

### 2.3 Accepted types

* `tipo` limited to `admin` or `fornecedor`.
* `fornecedor_id` must exist in `public.fornecedores` when `tipo = 'fornecedor'`.
* `fornecedor_id` must be `null` when `tipo = 'admin'`.

### 2.4 `CURRENT_USER` dependencies

* `CURRENT_USER.tipo` decides access to admin/fornecedor routes.
* `CURRENT_USER.fornecedor_tipo` (cached from `fornecedores.tipo`) routes fornecedores to `ordens`, `entregas` or `latex`.

---

## 3. Target architecture

### 3.1 Suggested Edge Function

| Attribute | Value |
|---|---|
| Name | `admin-create-user` |
| Technology | Supabase Edge Function (Deno) |
| Future location | `supabase/functions/admin-create-user/index.ts` |
| Secret | `SUPABASE_SERVICE_ROLE_KEY` via Edge Function environment variable |
| Internal client | `@supabase/supabase-js` built with `service_role` **only** inside the Edge Function |

### 3.2 Responsibility

Create, atomically and with compensation, a user in Supabase Auth and the corresponding profile in `public.usuarios`.

### 3.3 Execution flow

```text
1. Front-end admin chama supabase.functions.invoke('admin-create-user', payload)
2. Edge Function recebe o JWT do chamador no header Authorization
3. Extrai auth.uid() do JWT
4. Consulta public.usuarios e exige tipo = 'admin'
5. Valida payload (email, password, nome, tipo, fornecedor_id)
6. Normaliza email para lower-case
7. Verifica se fornecedor_id existe em public.fornecedores quando tipo = 'fornecedor'
8. Cria auth user via admin API (service_role server-side)
9. Insere public.usuarios com id = authUser.id retornado
10. Se insert falhar, compensa removendo o auth user recém-criado
11. Retorna sucesso ou erro controlado
```

### 3.4 Desired properties

* **Partial idempotency:** if the email already exists in `auth.users`, return `409 CONFLICT` without creating a duplicate.
* **Compensation:** never leave an orphan auth user without an attempt at removal.
* **Security:** `service_role` never transits through the browser; admin validation is server-side.

---

## 4. Input contract

### 4.1 Payload

```json
{
  "email": "usuario@exemplo.com",
  "password": "senha-inicial-ou-temporaria",
  "nome": "Nome do usuário",
  "tipo": "admin" | "fornecedor",
  "fornecedor_id": 123 | null
}
```

### 4.2 Validation rules

| Field | Rule |
|---|---|
| `email` | Required; normalized to lower-case; must be a valid email format. |
| `password` | Required in the first version; minimum length per project configuration (default: 6). |
| `nome` | Required; trimmed; not empty. |
| `tipo` | Required; only `admin` or `fornecedor`. |
| `fornecedor_id` | Must be `null` when `tipo = 'admin'`. |
| `fornecedor_id` | Required when `tipo = 'fornecedor'` and must exist in `public.fornecedores`. |

### 4.3 Future recommendation

The UI phase (`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`) may choose:

* a temporary password typed by the admin, or
* invite/magic-link (without `password` in the payload).

This design assumes the **temporary password version** for simplicity and lower dependency on SMTP configuration.

---

## 5. Output contract

### 5.1 Success

HTTP `200 OK` or `201 Created`.

```json
{
  "data": {
    "user_id": "<uuid>",
    "email": "usuario@exemplo.com",
    "tipo": "admin",
    "fornecedor_id": null
  }
}
```

### 5.2 Error

```json
{
  "error": {
    "code": "FORBIDDEN" | "VALIDATION_ERROR" | "AUTH_CREATE_FAILED" | "PROFILE_INSERT_FAILED" | "COMPENSATION_FAILED" | "UNKNOWN",
    "message": "mensagem segura para UI"
  }
}
```

### 5.3 Response constraints

* Never return `service_role`, JWT secrets, stack traces, SQL internals.
* Messages must be safe for display in the UI.

---

## 6. Suggested HTTP codes

| Scenario | HTTP |
|---|---|
| Success | `200 OK` or `201 Created` |
| Invalid payload | `400 Bad Request` |
| Missing/invalid JWT | `401 Unauthorized` |
| Caller is not admin | `403 Forbidden` |
| Email already exists in `auth.users` or conflict in `public.usuarios` | `409 Conflict` |
| Internal error / compensation failure | `500 Internal Server Error` |

---

## 7. Security

### 7.1 Where `service_role` may live

* ✅ Edge Function environment variable (`SUPABASE_SERVICE_ROLE_KEY`).
* ❌ Never in `js/config.js`.
* ❌ Never in `index.html`.
* ❌ Never in `localStorage` / `sessionStorage`.
* ❌ Never in the front-end in any form.
* ❌ Never in reports, logs, or versioned docs.

### 7.2 Permission validation

* The Edge Function **must** validate the caller by extracting `auth.uid()` from the JWT and querying `public.usuarios`.
* Require `tipo = 'admin'`.
* The front-end is not a trusted source for the admin flag.

### 7.3 RLS

* The existing RLS policies remain valid, but **do not replace** the Edge Function's validation.
* The Edge Function, when using `service_role`, bypasses RLS; hence explicit admin checking is mandatory.

### 7.4 Logs and passwords

* Edge Function logs must not contain `password`.
* Temporary passwords must not be recorded in docs/reports.
* It is recommended to force a password change on first login (`email_confirm` flag + future guidance).

---

## 8. Compensation strategy

### 8.1 Scenario: auth user created, but insert into `public.usuarios` fails

1. Try `admin.deleteUser(user_id)`.
2. If `deleteUser` returns success → return error `PROFILE_INSERT_FAILED`.
3. If `deleteUser` fails → return error `COMPENSATION_FAILED`.
   * Include `user_id` in the response for manual action.
   * Log internally (without password) warning about the orphan.

### 8.2 Scenario: email already exists in `auth.users`

* Return `409 CONFLICT` with the message "Email already registered".
* Create nothing.

### 8.3 Scenario: `public.usuarios` already has a duplicate email

* The insert into `public.usuarios` will fail due to the `UNIQUE` constraint.
* Trigger compensation (8.1).

### 8.4 Scenario: invalid `fornecedor_id`

* Validation failure before touching Auth → `400 VALIDATION_ERROR`.

### 8.5 General principle

* Never leave a silent partial success.
* If automatic compensation fails, the response must make clear that there is an orphan auth user to be fixed manually.

---

## 9. UI impact

### 9.1 Today (`screenCadastrosUsuarios`)

* "+ Link user" button.
* Modal requires the Auth UID.
* Banner instructs to create the user in Supabase Studio first.
* App performs a direct `INSERT` into `public.usuarios`.

### 9.2 After (phase `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`)

* "+ New user" button.
* Modal does not ask for the UID; it asks for:
  * Email
  * Name
  * Type (`admin` / `fornecedor`)
  * Fornecedor (when tipo = `fornecedor`)
  * Temporary password (or invite option, if decided)
* On save, calls:

```js
const { data, error } = await window.supa.functions.invoke('admin-create-user', {
  body: { email, password, nome, tipo, fornecedor_id }
});
```

* On success:
  * Toast "User created".
  * Reloads the list.
* On error:
  * Toast with friendly `error.message`.
  * Does not expose internal details.

### 9.3 Editing

* Editing the profile (`email`, `nome`, `tipo`, `fornecedor_id`) may continue directly via `public.usuarios`, with the same current validations.
* Changing password and email in Auth are out of scope for this phase.

### 9.4 Deletion

* Out of scope for this phase.
* Pending decision: remove only `public.usuarios` or also `auth.users`.
* Possible future phase: `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`.

---

## 10. Rejected alternatives

| Alternative | Reason for rejection |
|---|---|
| Blind trigger on `auth.users` that inserts `public.usuarios` | Does not resolve who defines `tipo` and `fornecedor_id`; would create incomplete/orphaned profiles with wrong data. |
| Front-end self-healing that automatically creates the profile if absent | Breaks the architectural rule of not masking a missing profile; exposes sensitive logic on the client. |
| `service_role` in the front-end | Serious security violation; would allow any user to create admins. |
| Permanent manual creation as the final flow | Source of inconsistency; does not scale; depends on Supabase Studio access. |
| Creating every user as `admin` by default | Violates the principle of least privilege; requires later manual correction. |

---

## 11. Proposed future phases

### 11.1 `RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`

* Create the `supabase/functions/admin-create-user/` structure.
* Implement the Edge Function per this design.
* Static tests / local smoke tests.
* Staging deploy instructions.
* **No UI yet.**

### 11.2 `RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`

* Manual/controlled deploy on Supabase staging.
* Validate secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
* Validate call with admin user → success.
* Validate blocking with fornecedor user → `403 FORBIDDEN`.

### 11.3 `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`

* Adapt `screenCadastrosUsuarios`:
  * Replace the "link UID" flow with "create user".
  * Remove the UID field from the creation modal.
  * Add a temporary password field.
  * Call `supabase.functions.invoke('admin-create-user')`.
* Keep listing and editing.
* Add smoke tests.

### 11.4 `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`

* Document the final operation for admins.
* User creation runbook.

### 11.5 Optional: `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`

* Decide whether deletion removes only `public.usuarios` or also `auth.users`.
* Assess whether it should be done by another Edge Function.

---

## 12. Open questions

These questions need a decision from the HMNlead before the implementation phases:

1. **Temporary password vs. invite/magic-link:** will the admin type a temporary password or would they prefer to send a reset invite by email?
2. **`email_confirm`:** should it be `true` on creation (user can already log in) or `false` (forces email confirmation)?
3. **Password change:** will a fornecedor be able to change their own password later? (Today there is no "my account" screen.)
4. **Deletion:** when a user is deleted in the app, should it also remove `auth.users` or only `public.usuarios`?
5. **Production:** will production have the same fornecedores/users as staging or will it be reconfigured from scratch?
6. **Edge Function deploy:** will it be via local Supabase CLI, dashboard, or another flow (CI/CD)?

---

## 13. Design acceptance criteria

This design is only considered accepted if:

* [ ] Does not expose `service_role` in the front-end.
* [ ] Maintains server-side admin validation in the Edge Function.
* [ ] Eliminates the need to copy the UID manually.
* [ ] Preserves `auth.users.id = public.usuarios.id`.
* [ ] Provides compensation for partial success.
* [ ] Preserves the app's modular architecture (no business logic in `index.html`).
* [ ] Defines small, sequential phases.
* [ ] Does not implement code, SQL, deploy, or user creation in this phase.

---

## 14. References

* `js/auth.js` — session, profile, and `loadCurrentUser`.
* `js/screens/cadastros.js` — `screenCadastrosUsuarios`.
* `js/config.js` / `js/supabase-client.js` — anon client, without `service_role`.
* `js/boot.js` / `js/router.js` — redirection based on `CURRENT_USER`.
* `db/01_schema.sql` — `public.usuarios` schema.
* `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
* `db/03_policies.sql` — RLS policies for `usuarios`.
* `docs/architecture/CODE_HEALTH_RULES.md` — current architectural health rules.
