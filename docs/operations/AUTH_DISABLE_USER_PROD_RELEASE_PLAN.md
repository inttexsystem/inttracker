# Production release plan — Auth user provisioning/disable

**Phase:** `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-RELEASE-PLAN-A`  
**Scope:** docs-only / release planning — no execution in production, no SQL, no deploy, no push to origin, no code changes.  
**Date:** 2026-06-24  
**Reference HEAD:** `b02a524`

---

## 1. Scope

This plan covers the controlled release of the Auth chain from staging to production:

- **Edge Function `admin-create-user`** — creates a user in `auth.users` + `public.usuarios` atomically, with compensation.
- **Edge Function `admin-disable-user`** — disables a user (soft delete on the profile + Auth ban), with guards against self-disable, disabling the last active admin, and idempotency.
- **Schema `db/12_auth_user_disable_schema.sql`** — columns `ativo`, `desativado_em`, `desativado_por`, `motivo_desativacao` on `public.usuarios`; functions `is_admin()` and `meu_fornecedor_id()` recreated to require `ativo is true`; policies `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update` recreated.
- **Creation/disable UI** at `#/cadastros/usuarios` — `+ Novo usuário` and `Desativar` buttons, confirmation modal, PT-BR error mapping, `Ativo`/`Inativo` Status column.
- **Frontend** — controlled merge from `work/app-next` to `origin/main` (GitHub Pages).

---

## 2. State validated in staging

| Item | Status |
|---|---|
| Supabase staging ref | `ucrjtfswnfdlxwtmxnoo` |
| HEAD / staging/main | `b02a524` |
| Schema `db/12_auth_user_disable_schema.sql` applied | ✅ manually by HMNlead (2026-06-24) |
| Edge Function `admin-create-user` deployed | ✅ validated |
| Edge Function `admin-disable-user` deployed | ✅ validated |
| Backend E2E (runner) | ✅ `result: PASS` |
| Manual staging UI (HMNlead) | ✅ real flow passed |
| Smokes (6 files) | 163/163 PASS |

---

## 3. Production state before the release

Production **has not yet been touched** by this chain:

| Item | Status |
|---|---|
| Supabase production ref | `bhgifjrfagkzubpyqpew` |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` (prior to the Auth chain) |
| Schema `db/12_auth_user_disable_schema.sql` | ❌ **Not applied** |
| Columns `ativo`/`desativado_*` on `public.usuarios` | ❌ **Do not exist** |
| `is_admin()` requires `ativo is true` | ❌ **No** |
| `meu_fornecedor_id()` checks `ativo` | ❌ **No** |
| Edge Function `admin-create-user` | ❌ **Not deployed** |
| Edge Function `admin-disable-user` | ❌ **Not deployed** |
| Secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc.) | ❌ **Not configured** |
| Frontend on GitHub Pages | ❌ **Pre-refactor version** |

---

## 4. Mandatory release order

The order is **sequential and mandatory**. Each step must be validated before proceeding.

### 4.1 Confirm operational backup/snapshot

Before any mutation in production:
- Confirm that HMNlead has access to the production Supabase Dashboard (`bhgifjrfagkzubpyqpew`).
- Check whether automatic backup (Point-in-Time Recovery) is enabled on the production project.
- Document the current state: `select count(*)` of the main tables (`usuarios`, `fornecedores`, `ops`, etc.).
- Note the 3 current users (admin + suppliers) for post-release validation.

### 4.2 Apply schema in production

1. Open the Supabase Dashboard SQL Editor for `bhgifjrfagkzubpyqpew`.
2. Copy and execute the contents of `db/12_auth_user_disable_schema.sql`.
3. **Do not** run `db/10_reset_producao.sql`, `db/11_reset_ops.sql`, or any destructive SQL.
4. The schema is **idempotent** (uses `IF NOT EXISTS` and `CREATE OR REPLACE`); it can be re-run without harm.

### 4.3 Validate production schema

Run **read-only** SQL to confirm:

```sql
-- Colunas novas existem
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuarios'
  AND column_name IN ('ativo', 'desativado_em', 'desativado_por', 'motivo_desativacao');

-- Usuários existentes ficaram ativo = true
SELECT count(*) AS total
FROM public.usuarios;

SELECT ativo, count(*) AS qtd
FROM public.usuarios
GROUP BY ativo;

-- Sem órfãos
SELECT count(*) AS auth_sem_perfil
FROM auth.users au
LEFT JOIN public.usuarios pu ON pu.id = au.id
WHERE pu.id IS NULL;

SELECT count(*) AS perfil_sem_auth
FROM public.usuarios pu
LEFT JOIN auth.users au ON au.id = pu.id
WHERE au.id IS NULL;

-- Funções recriadas
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('is_admin', 'meu_fornecedor_id')
  AND pronamespace = 'public'::regnamespace;

-- Policies existem
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'usuarios'
ORDER BY policyname;
```

### 4.4 Configure Edge Function secrets in production

In the production Supabase Dashboard (`bhgifjrfagkzubpyqpew`):

**Settings → API** to obtain:
- `Project URL` → `SUPABASE_URL`
- `anon public` → `SUPABASE_ANON_KEY`
- `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

**Edge Functions → `admin-create-user`** (after deploy, see 4.5) → **Secrets**:
```bash
# Referência apenas — não executar nesta fase
supabase secrets set SUPABASE_URL=<prod_url> --project-ref bhgifjrfagkzubpyqpew
supabase secrets set SUPABASE_ANON_KEY=<prod_anon_key> --project-ref bhgifjrfagkzubpyqpew
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<prod_service_role> --project-ref bhgifjrfagkzubpyqpew
```

Or via Dashboard: **Edge Functions → [function] → Environment variables**.

Also verify that the function deployment automatically pulled the project's `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables. Only `SUPABASE_SERVICE_ROLE_KEY` needs to be configured manually (it is not exposed by default).

### 4.5 Deploy `admin-create-user` in production

```bash
# Referência apenas — não executar nesta fase
supabase functions deploy admin-create-user --project-ref bhgifjrfagkzubpyqpew
```

### 4.6 Validate `admin-create-user` in production

API tests (curl or Supabase CLI):

```bash
# Sem auth → 401
curl -X POST https://bhgifjrfagkzubpyqpew.supabase.co/functions/v1/admin-create-user \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 UNAUTHORIZED

# Com payload inválido → 400
# (testar com admin JWT nas fases seguintes, se autorizado)
```

Optional validations with a disposable user (only if authorized by HMNlead):
1. Admin login -> obtain JWT.
2. Call `admin-create-user` with a valid payload.
3. Confirm `201` with `user_id`, `email`, `tipo`.
4. Confirm the link: `auth.users.id = public.usuarios.id` via read-only SQL.
5. Cleanup: remove the user via Dashboard (Delete user) to avoid polluting production.

### 4.7 Deploy `admin-disable-user` in production

```bash
# Referência apenas — não executar nesta fase
supabase functions deploy admin-disable-user --project-ref bhgifjrfagkzubpyqpew
```

Verify secrets on `admin-disable-user` (the same as `admin-create-user`):
```bash
supabase secrets list --project-ref bhgifjrfagkzubpyqpew
```
Confirm that `SUPABASE_SERVICE_ROLE_KEY` is present.

### 4.8 Validate `admin-disable-user` in production

```bash
# Sem auth → 401
curl -X POST https://bhgifjrfagkzubpyqpew.supabase.co/functions/v1/admin-disable-user \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 UNAUTHORIZED
```

If authorized, validate with a disposable user:
1. Create a disposable supplier via `admin-create-user`.
2. Attempt `admin-disable-user` with supplier JWT → `403 FORBIDDEN`.
3. Admin disables the disposable user → `200 { ativo: false, auth_banned: true }`.
4. Confirm `ativo = false` via read-only SQL.
5. Attempt login of the disposable user → fails (banned).
6. Disable again → `200 { already_disabled: true }`.
7. Self-disable (admin attempts to disable themself) → `403 SELF_DISABLE_FORBIDDEN`.
8. Cleanup via Dashboard.

### 4.9 Release frontend to `origin/main`

**Attention: this step must only be executed after steps 4.2 through 4.8 are complete and validated.**

Procedure:
1. Perform a controlled merge or push from `work/app-next` to `origin/main`:

```bash
# Referência apenas — não executar nesta fase
git push origin work/app-next:main
```

2. GitHub Pages publishes automatically (push to `main` → deploy).
3. Wait for propagation (1-2 minutes).
4. Hard refresh in the browser (Disable cache + Ctrl+F5).

### 4.10 Validate production UI

1. Access `https://grupoterrabranca.github.io/controle-tapetes/`.
2. Log in as admin.
3. Navigate to `#/cadastros/usuarios`.
4. Confirm:
   - The listing loads (columns: E-mail, Nome, Tipo, Fornecedor, Status).
   - `+ Novo usuário` button visible and functional.
   - `Desativar` button visible for active users.
   - Status `Ativo`/`Inativo` correct.
5. If authorized, create a disposable user and disable via the UI.
6. Confirm success/error toasts in PT-BR.
7. Confirm that an already-inactive user displays `"Usuário já está inativo."`.

---

## 5. Validation commands/SQL (read-only)

Only **read-only** SQL for state verification. Never `DELETE`, `DROP`, `TRUNCATE`, `UPDATE`, or `INSERT` without explicit authorization.

### 5.1 Verify columns of `public.usuarios`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuarios'
ORDER BY ordinal_position;
```

### 5.2 Count by `ativo`

```sql
SELECT ativo, count(*) AS quantidade
FROM public.usuarios
GROUP BY ativo;
```

### 5.3 Verify orphans (auth without profile / profile without auth)

```sql
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users_total,
  (SELECT count(*) FROM public.usuarios) AS public_usuarios_total,
  (SELECT count(*) FROM auth.users au
   LEFT JOIN public.usuarios pu ON pu.id = au.id
   WHERE pu.id IS NULL) AS auth_sem_perfil,
  (SELECT count(*) FROM public.usuarios pu
   LEFT JOIN auth.users au ON au.id = pu.id
   WHERE au.id IS NULL) AS perfil_sem_auth;
```

### 5.4 Verify function `is_admin()`

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
```

### 5.5 Verify function `meu_fornecedor_id()`

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'meu_fornecedor_id' AND pronamespace = 'public'::regnamespace;
```

### 5.6 Verify policies of `public.usuarios`

```sql
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'usuarios'
ORDER BY policyname;
```

---

## 6. Blockers

- 🔴 **Do not release the frontend before the production backend.** Publishing `origin/main` before the Edge Functions and schema are ready breaks the UI (calls nonexistent functions, schema missing the `ativo` column).
- 🔴 **Do not run `db/10_reset_producao.sql`** — mass DELETE of production without authorization.
- 🔴 **Do not run `db/11_reset_ops.sql`** — mass DELETE of OPs without authorization.
- 🔴 **Do not use destructive SQL** (DELETE, DROP, TRUNCATE) without explicit authorization from HMNlead.
- 🔴 **Do not hard-delete users** — always use soft delete (disable) as the standard flow.
- 🔴 **Do not expose `service_role`** in the front-end, `js/config.js`, `index.html`, localStorage, or logs.
- 🔴 **Do not touch `origin/main` without explicit authorization** from HMNlead.
- 🔴 **Do not skip steps** — the order 4.1 → 4.10 is mandatory and sequential.
- 🟡 **Do not reapply the schema in staging** — staging is already correct. The schema is idempotent, but there is no need.
- 🟡 **Do not modify `admin-create-user` or `admin-disable-user`** in this phase — the code is already validated in staging.

---

## 7. Rollback

### 7.1 If the schema fails (step 4.2)

- Stop before any Edge Function deploy.
- The schema is idempotent — re-running it causes no additional harm.
- If there is a constraint error or conflict, cancel and report to HMNlead.
- Do not proceed to 4.4.

### 7.2 If an Edge Function fails (steps 4.5-4.8)

- Do not release the frontend (step 4.9).
- Fix, redeploy, and revalidate in staging first.
- If necessary, redeploy the previous version of the function (if one exists).

### 7.3 If the frontend fails after release (step 4.9)

- Option A: Revert `origin/main` to the previous commit (`1047181eba888242c6428de366cbd9fda2f1c72c`):

```bash
# Referência apenas — não executar sem autorização
git push origin --force <commit-anterior>:main
```

- Option B: Hotfix on `work/app-next`, revalidate in staging, push to `origin/main`.
- GitHub Pages propagates the revert immediately (push → deploy).

### 7.4 Cleanup of disposable user in production (if created)

- Use **Authentication → Users → Delete user** in the production Supabase Dashboard (`bhgifjrfagkzubpyqpew`).
- The `ON DELETE CASCADE` FK automatically removes the profile from `public.usuarios`.
- **Never** improvise destructive SQL. Follow the runbook procedure (`docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` section 9).

---

## 8. GO/NO-GO criteria

### GO (may release) only if ALL:

- [ ] Schema `db/12_auth_user_disable_schema.sql` applied in production and validated (read-only SQL confirms columns, functions, policies).
- [ ] Post-schema counts: `auth_users_total = public_usuarios_total`, `auth_sem_perfil = 0`, `perfil_sem_auth = 0`.
- [ ] Secrets configured in production (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- [ ] Edge Function `admin-create-user` deployed in production and responds 401 without auth, 400/201 with a valid payload.
- [ ] Edge Function `admin-disable-user` deployed in production and responds 401 without auth, 403 for a supplier.
- [ ] Backend production smokes pass (if executed).
- [ ] Staging remains operational (was not degraded by the release).
- [ ] Explicit authorization from HMNlead for each step.

### NO-GO (do not release) if ANY:

- [ ] Schema missing or incomplete in production.
- [ ] Edge Function `admin-create-user` missing or failing.
- [ ] Edge Function `admin-disable-user` missing or failing.
- [ ] Secrets `SUPABASE_SERVICE_ROLE_KEY` not confirmed.
- [ ] Auth/RLS/policy error in production.
- [ ] Risk of breaking login or an existing admin.
- [ ] No explicit authorization from HMNlead.

---

## 9. Next execution phases

### Phase A: `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-BACKEND-RELEASE-A`

**Scope:** execute production backend only.
- Apply schema (`db/12_auth_user_disable_schema.sql`) on `bhgifjrfagkzubpyqpew`.
- Configure secrets.
- Deploy `admin-create-user` and `admin-disable-user`.
- Validate with backend smokes (curl and read-only SQL).
- **Do not touch frontend / origin/main.**

### Phase B: `RAVATEX-TAPETES-AUTH-DISABLE-USER-FRONTEND-RELEASE-A`

**Scope:** release the frontend after production backend is confirmed.
- Push/merge `work/app-next` to `origin/main`.
- Validate production UI.
- **Execute only after Phase A is completed and authorized.**

### Phase C (if applicable): `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-SMOKE-E2E-A`

**Scope:** optional E2E validation in production with a disposable user, if authorized by HMNlead.
- Run a runner adapted for production (or a manual version of the script).
- Controlled cleanup after the test.

---

## 10. References

- `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` — design of the creation Edge Function.
- `docs/architecture/AUTH_DELETE_USER_DESIGN.md` — design of the disable feature.
- `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` — operational runbook for creation.
- `db/12_auth_user_disable_schema.sql` — versioned schema for disabling.
- `supabase/functions/admin-create-user/README.md` — documentation of the creation Edge Function.
- `supabase/functions/admin-disable-user/README.md` — documentation of the disable Edge Function.
- `scripts/staging/admin-disable-user-e2e.mjs` — staging E2E runner (reference for production).
- `PROJECT_STATE.md` — canonical project snapshot.
- `AGENT_HANDOFF.md` — accepted state for resumption.
