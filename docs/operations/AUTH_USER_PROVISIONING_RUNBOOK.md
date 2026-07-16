# Auth User Provisioning Runbook

> Current operational document. Describes how to create users of
> **Ravatex Controle de Tapetes** safely after the deployment
> of the `admin-create-user` Edge Function and the new UI at
> `#/cadastros/usuarios`.
>
> **Convention:** the old manual flow (create `auth.users` in the
> Supabase Studio, copy the UID, link it in `public.usuarios`) **is no
> longer the standard operational flow**. This runbook replaces that
> procedure.

---

## 1. Objective

This runbook describes the standard operational procedure for creating
app users — including admins and suppliers — ensuring that:

* the `auth.users.id = public.usuarios.id` link is created atomically;
* the admin does not need to access the Supabase Studio to provision
  accounts;
* `service_role` never crosses the browser;
* admin validation is server-side, not client-side.

Applicability: **staging** and, after explicit authorization,
**production**.

---

## 2. Summarized architecture

* **Supabase Auth (`auth.users`)** — holds the login account (email
  + password, JWT). It is the source of authentication.
* **`public.usuarios`** — the app's domain profile, with
  `nome`, `tipo` (`admin` | `fornecedor`) and `fornecedor_id` when
  applicable. It is the source of authorization and role-based
  routing.
* **Mandatory link:** `auth.users.id = public.usuarios.id`.
  Without a profile, the Auth login is considered incomplete by the app
  (`loadCurrentUser()` returns `null` and the user is sent back to
  `#/login`).
* **Edge Function `admin-create-user`** — server-side function
  (Deno/TypeScript) deployed on Supabase. It creates, in the same
  controlled flow, the record in `auth.users` (via
  `auth.admin.createUser`) and in `public.usuarios` (via
  `from('usuarios').insert(...)`). If the profile insert fails, it
  runs compensation (`auth.admin.deleteUser`).
* **Security principle:** the **browser never receives
  `service_role`**. The front end only invokes the Edge Function via
  `supabase.functions.invoke('admin-create-user', { body })`. The
  `SUPABASE_SERVICE_ROLE_KEY` exists **only** as a secret of the Edge
  Function.

---

## 3. Main operational flow

**Precondition:** operator logged in as `admin` in the app.

1. Go to `#/cadastros/usuarios`.
2. Click **+ Novo usuário**.
3. Fill in the modal:
   * **E-mail** — will be used to log in to Supabase Auth.
   * **Nome** — display name.
   * **Tipo** — `admin` or `fornecedor`.
   * **Fornecedor (se tipo for "fornecedor")** — select the
     corresponding supplier. Leave empty if the type is `admin`.
   * **Senha temporária** — minimum 8 characters + at least 1 digit
     (policy in effect since `A4.1`, `db/58_admin_usuarios_senha_temporaria.sql`).
     Set it according to the internal procedure; see section 6.
4. Click **Salvar**.
5. Wait for the success toast (`Usuário criado`) and confirm that the
   new user appears in the listing.

The app calls:

```js
const { data, error } = await window.supa.functions.invoke(
  'admin-create-user',
  { body: { email, password, nome, tipo, fornecedor_id } }
);
```

On success, the function returns `{ data: { user_id, email, tipo,
fornecedor_id } }` and the modal closes. On error, the modal stays
open and the toast shows the function's message (see section 7).

---

## 4. Rules by user type

### Admin
* `tipo = 'admin'`.
* `fornecedor_id` **must** be `null`. The modal sends `null`
  automatically when the type is admin; the app blocks the submission
  if a supplier is selected.
* There is no binding to a supplier.

### Fornecedor
* `tipo = 'fornecedor'`.
* `fornecedor_id` **required** and must exist in
  `public.fornecedores`.
* The linked supplier defines the screen permissions (orders,
  deliveries, latex) via `CURRENT_USER.fornecedor_tipo`.

---

## 5. What **not** to do

* **Do not** create a user manually in Supabase Auth as the standard
  flow. The manual path exists only as a documented incident
  contingency, and the user created that way must be migrated to
  the standard flow immediately.
* **Do not** copy the UID manually.
* **Do not** insert a row into `public.usuarios` without a matching
  auth user (origin of an OK Auth login with a redirect to
  `#/login`).
* **Do not** place `service_role` in the front end, in `js/config.js`,
  `index.html`, `localStorage`, `sessionStorage`, or any versioned
  file.
* **Do not** record the temporary password in chat, a report, a
  spreadsheet, or documentation. Treat it as sensitive information.
* **Do not** use production for tests. Staging is the homologation
  environment.

---

## 6. Temporary password

* The temporary password is set by the admin at creation time
  (minimum 8 characters + at least 1 digit per the Edge Function,
  policy in effect since `A4.1`).
* Every creation via `admin-create-user` flags the user with
  `usuarios.senha_temporaria = TRUE` and `usuarios.senha_gerada_em =
  now()` (`db/58_admin_usuarios_senha_temporaria.sql`). The mandatory
  change on first login (boot guard + change screen, self-service
  `auth.updateUser`) is the future subphase `A4.2` —
  **not implemented yet**; today the flag only marks the state, without
  blocking the app.
* **Do not** record the password in any versioned artifact or
  report.
* The procedure for communicating with the user and changing the
  password is defined internally by the HMNlead (verbal channel,
  secure channel, etc.). This runbook **does not** mandate the
  channel.
* At this stage, there is no automated email invite flow
  ("magic link" / password reset) implemented as standard. Creation
  uses a password typed by the admin. The choice between
  typed-password vs. invite-link is an open design question
  (`docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`,
  section 12); `A4.3` (email/SMTP invite) remains `NOT AUTHORIZED`.
* It is recommended to instruct the user to change the password on
  first login. The app **does not yet** enforce this change
  automatically — see `A4.2` above.

---

## 7. Expected error messages

The Edge Function returns standardized JSON:

```json
{ "error": { "code": "<CODE>", "message": "<mensagem segura>" } }
```

| Code | Typical HTTP | Cause | Operator action |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid payload (malformed email, password < 8 characters or no digit, disallowed type, invalid/nonexistent supplier, admin with fornecedor_id). | Fix the fields per the message and resubmit. |
| `UNAUTHORIZED` | 401 | Expired/missing session or invalid JWT. | Ask for a new login. |
| `FORBIDDEN` | 403 | Logged-in user is **not** `admin` in `public.usuarios`. | Confirm the logged-in account is admin; promote via another admin if needed. |
| `CONFLICT` | 409 | Email already registered in `auth.users`. | Check whether the user already exists; if it's a duplicate, do not recreate it. |
| `AUTH_CREATE_FAILED` | 500 | Internal Auth failure (unexpected). | Escalate to technical support with the call log. |
| `PROFILE_INSERT_FAILED` | 500 | Auth user created, but the insert into `public.usuarios` failed; automatic compensation removed the auth user. | Retry; if it persists, escalate to support. |
| `COMPENSATION_FAILED` | 500 | Auth user created, profile failed, **and** `auth.admin.deleteUser` also failed. There is an orphan auth user. | Escalate to technical support immediately; the `user_id` is in the message. Clean up manually in the Supabase Studio. |
| `UNKNOWN` | 500 | Unclassified error. | Escalate to technical support. |

The UI maps the most likely codes to friendly messages in
`js/screens/cadastros.js` (see the error-handling helper of
`openModal` in `screenCadastrosUsuarios`).

---

## 8. Read-only technical validation

After a creation, the operator/admin can validate the link by running
the following **read-only** SQL in the SQL Editor of the Supabase
project (staging or production as appropriate), replacing
`<EMAIL_DO_USUARIO>` with the real email:

```sql
select
  au.id as auth_id,
  au.email as auth_email,
  pu.id as perfil_id,
  pu.email as perfil_email,
  pu.nome,
  pu.tipo,
  pu.fornecedor_id,
  case
    when pu.id is null then 'SEM_PERFIL'
    when au.id = pu.id then 'OK_AUTH_ID_IGUAL_PERFIL_ID'
    else 'ID_DIVERGENTE'
  end as status_vinculo
from auth.users au
left join public.usuarios pu
  on pu.id = au.id
where au.email = '<EMAIL_DO_USUARIO>';
```

**Expected:** `status_vinculo = OK_AUTH_ID_IGUAL_PERFIL_ID`.

* `SEM_PERFIL` indicates a critical inconsistency (Auth login without
  a profile): the user will be able to authenticate but the app will
  redirect them to `#/login`. Escalate to support.
* `ID_DIVERGENTE` indicates a UUID mismatch between Auth and the
  profile; a serious inconsistency. Escalate to support.

---

## 9. Test-user cleanup

For disposable tests in **staging**:

1. Delete the user in the **Supabase Dashboard** → staging project
   (`ucrjtfswnfdlxwtmxnoo`) → **Authentication** → **Users** →
   locate by email → **Delete user**.
   * The `public.usuarios.id REFERENCES auth.users(id) ON
     DELETE CASCADE` constraint removes the profile automatically.
2. Validate the cleanup with **read-only** SQL:

   ```sql
   select count(*) as auth_restante
   from auth.users
   where email = '<EMAIL_TESTE>';
   ```

   ```sql
   select count(*) as perfil_restante
   from public.usuarios
   where email = '<EMAIL_TESTE>';
   ```

   **Expected:** `auth_restante = 0` **and** `perfil_restante = 0`.

> **This runbook does not instruct direct `DELETE` SQL against
> `auth.users` or `public.usuarios` as a standard procedure.** Deletion
> via the Dashboard is the recommended path; `DELETE` SQL should be
> used only by technical support during an incident.

---

## 10. Cache / old-UI troubleshooting

**Observed incident:** one browser profile kept showing the old UI
("Vincular usuário" button and UID field) while another profile
correctly showed the new UI ("+ Novo usuário"). Most likely cause:
asset caching (old `cadastros.js`), `localStorage`, or a Service
Worker from a previous version.

### Diagnostic procedure

1. **Hard refresh with cache disabled:**
   * DevTools open (F12) → **Network** tab → check **Disable
     cache**.
   * `Ctrl + F5` (or `Ctrl + Shift + R`).

2. **Clear site storage:**
   * DevTools → **Application** → **Storage** → **Clear site data**.

3. **Confirm the served version of `cadastros.js`:**
   In the browser console:

   ```js
   await fetch('/js/screens/cadastros.js?v=debug-' + Date.now())
     .then(r => r.text())
     .then(t => ({
       temEdgeFunction: t.includes("admin-create-user"),
       temNovoUsuario:  t.includes("Novo usuário"),
       temVincular:     t.includes("Vincular"),
       temUid:          t.includes("UID")
     }));
   ```

   **Expected:** `{ temEdgeFunction: true, temNovoUsuario: true,
   temVincular: false, temUid: false }`.

   * If `temVincular: true` or `temUid: true`, the served asset is
     the old version. Repeat the hard refresh / clear storage; if it
     persists, escalate to technical support (may be a proxy/CDN with
     aggressive caching).
   * If `temEdgeFunction: false`, the current `cadastros.js` does not
     contain the call to the Edge Function — confirm that phase
     `RAVATEX-TAPETES-AUTH-ADMIN-UI-A` was deployed.

4. **Confirm the app is pointing to the correct environment:**
   * The environment banner should indicate `STAGING` or `PRODUÇÃO` as
     expected. In case of mismatch, review `js/config.js`
     (read-only) and the environment flag.

---

## 11. Security and limits

* **Admin validation is server-side.** The Edge Function queries
  `public.usuarios` and requires `tipo = 'admin'` regardless of
  what the front end sends.
* **The block test (supplier) was executed** and is documented: a
  call attempt by an authenticated `fornecedor` user returned
  `403 Forbidden`. The behavior is covered by the static tests in
  `tests/cadastros-usuarios-auth-ui.smoke.js` and by the Edge
  Function.
* **RLS does not replace the Edge Function's validation.** RLS
  remains active and relevant for direct reads/writes by the app, but
  user creation via `service_role` bypasses RLS — hence the explicit
  admin check being mandatory.
* **Logs and secrets.** Edge Function logs **must not** contain
  `password`, `service_role`, or JWTs. Temporary passwords **must
  not** appear in logs, reports, chat, spreadsheets, or versioned
  docs.
* **`service_role` is an Edge Function secret**, configured via
  Supabase Secrets. It is not and must never be read by the front
  end.

---

## 12. Future pending items

* **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** — decide whether
  user deletion by the app should remove only `public.usuarios`
  or also `auth.users`, and whether this should be done via another
  Edge Function. **Not implemented** in this phase.
* **Email invite/reset** — decide between the admin-typed password
  (current) and an invite/magic-link flow. Open question in the
  design (section 12 of `AUTH_PROVISIONING_EDGE_DESIGN.md`).
* **Tailwind CDN warning** — separate technical pending item, not
  related to Auth provisioning.
* **Favicon 404** — separate cosmetic pending item.
* **Production test** — requires its own authorization and release
  plan; this runbook covers the procedure, but promotion to
  production depends on HMNlead approval.

---

## 13. Validation history (sanitized)

* **Edge Function `admin-create-user` deployed on Supabase
  staging** (`ucrjtfswnfdlxwtmxnoo`).
* **Function ACTIVE, version 1.**
* Call without `Authorization` → `401` confirmed.
* Call with invalid payload (admin with `fornecedor_id`) →
  `400 VALIDATION_ERROR` confirmed.
* Real creation via the function (admin) → `201` confirmed.
* **E2E UI in staging approved:** creation of a disposable supplier
  via `+ Novo usuário` confirmed; `auth.users.id =
  public.usuarios.id` confirmed by read-only SQL; test user
  removed via the Supabase Dashboard; post-cleanup `auth_restante = 0`
  and `perfil_restante = 0`.
* **Supplier block:** a call attempt by an authenticated supplier
  user returned `403 Forbidden` as expected.
* **Logs verified** with no `password`, no `service_role`, no JWTs.
* The temporary password was **not** recorded in any artifact.
* No change to `db/**`, RLS, policies, or the front end was
  necessary for this phase.
