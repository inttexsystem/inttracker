# Parallel environment reconciliation — Controle de Tapetes

**Phase:** `RAVATEX-TAPETES-PARALLEL-ENV-RECONCILIATION-A`
**Scope:** docs-only / environment taxonomy reconciliation — no SQL, no deploy, no push to origin, no code changes.
**Date:** 2026-06-24
**Reference HEAD:** `0be1745`

---

## 1. Official taxonomy

The previous "production" and "staging" naming was ambiguous and led to operational risks. The correct and definitive classification is:

### 1.1 Original online app / Legacy / DO NOT TOUCH

| Attribute | Value |
|---|---|
| Supabase ref | `bhgifjrfagkzubpyqpew` |
| Description | Original online app, used by external users via Vercel |
| Frontend | Vercel (not GitHub Pages) |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` |

**Prohibited in this workstream:**
- SQL (any kind)
- Edge Function deploys
- Secret configuration
- Smoke/automated testing
- Any mutation
- Push to `origin/main`
- Push to Vercel

**If any action is needed here, it requires a separate phase with special authorization.**

### 1.2 Parallel work environment

| Attribute | Value |
|---|---|
| Supabase ref | `ucrjtfswnfdlxwtmxnoo` |
| Description | New parallel backend, used by the local frontend and by the current development workstream |
| Appears in the Dashboard as | `main / Production` (Supabase label, does not reflect this project's reality) |
| staging/main | `0be1745` |

### 1.3 Current frontend

| Attribute | Value |
|---|---|
| Branch | `work/app-next` |
| HEAD | `0be1745` |
| Execution | Local (`run-local.bat` → `http://localhost:8765/`) |
| Backend pointed to (local) | `ucrjtfswnfdlxwtmxnoo` (staging in `js/config.js`) |
| Staging repo | `controle-tapetes-staging` |

### 1.4 Official origin (untouched)

| Attribute | Value |
|---|---|
| Repo | `grupoterrabranca/controle-tapetes` |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` |
| GitHub Pages | `grupoterrabranca.github.io/controle-tapetes` |
| PR #2 | Untouched |

---

## 2. Parallel backend state (`ucrjtfswnfdlxwtmxnoo`)

### 2.1 Schema

| Item | Status |
|---|---|
| `db/12_auth_user_disable_schema.sql` | ✅ Manually applied by HMNlead (2026-06-24) |
| Columns `ativo`/`desativado_em`/`desativado_por`/`motivo_desativacao` | ✅ Exist in `public.usuarios` |
| `is_admin()` recreated with `ativo IS TRUE` | ✅ |
| `meu_fornecedor_id()` recreated with `ativo IS TRUE` | ✅ |
| Policies `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update` recreated | ✅ |
| Orphans (auth without profile / profile without auth) | ✅ 0/0 |
| All users with `ativo = true` | ✅ |

### 2.2 Edge Functions

| Function | Status |
|---|---|
| `admin-create-user` | ✅ Deployed, active. Responds 401 without auth. |
| `admin-disable-user` | ✅ Deployed, active. Responds 401 without auth. |

### 2.3 Secrets

| Secret | Status |
|---|---|
| `SUPABASE_URL` | ✅ Configured |
| `SUPABASE_ANON_KEY` | ✅ Configured |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Configured |

### 2.4 Validation

| Evidence | Status |
|---|---|
| Smoke tests (6 files) | ✅ 163/163 PASS |
| E2E backend runner | ✅ `result: PASS` |
| Manual staging UI (HMNlead) | ✅ Real flow passed |
| Supplier block (403) | ✅ Confirmed |
| Self-disable blocked | ✅ Confirmed |
| Last admin blocked | ✅ Confirmed |
| Login blocked after deactivation | ✅ Confirmed |
| Idempotency | ✅ Confirmed |

---

## 3. Original app state (`bhgifjrfagkzubpyqpew`)

| Item | Status |
|---|---|
| Schema `db/12_*` | ❌ Not applied |
| Columns `ativo`/`desativado_*` | ❌ Do not exist |
| Edge Functions `admin-create-user` / `admin-disable-user` | ❌ Not deployed |
| Secrets | ❌ Not configured |
| Frontend | ❌ Pre-refactor version |
| Actions performed in this workstream | ✅ No mutation. Only 1 read-only query with public anon key (`GET /rest/v1/usuarios?select=count` → `count: 0`). Project intact. |

---

## 4. Operational architectural decision

The correct path for this workstream is to evolve the parallel environment, **without touching the original app**:

```
frontend local (work/app-next)
    ↓
publicação paralela separada (GitHub Pages, Vercel paralelo, ou host estático)
    ↓
validação com backend ucrjtfswnfdlxwtmxnoo
    ↓
(somente depois, se desejado) plano de migração do original
```

In this workstream **there is no release for the original app**. The original (`bhgifjrfagkzubpyqpew` + Vercel + `origin/main`) continues operating normally with its current version.

---

## 5. Recommended next step

**Phase:** `RAVATEX-TAPETES-PARALLEL-FRONTEND-PUBLISH-PLAN-A`

**Objective:** decide and plan where to publish the parallel frontend without touching the original Vercel nor `origin/main`.

### Options to evaluate:

1. **GitHub Pages in the staging repo (`controle-tapetes-staging`)**
   - Push to `staging/main` → GitHub Pages publishes automatically.
   - The URL would be `ravatexapps-dotcom.github.io/controle-tapetes-staging/`.
   - `js/config.js` would detect a hostname different from `grupoterrabranca.github.io` → would use the `staging` environment → would point to `ucrjtfswnfdlxwtmxnoo`.
   - ✅ Simple, no cost. Already configured as a public repo.

2. **Separate Vercel connected to the staging repo**
   - Separate deploy, without touching the original Vercel.
   - Optional custom domain.
   - ⚠️ Requires setting up a new Vercel project.

3. **Another static host (Netlify, Cloudflare Pages, etc.)**
   - Total isolation from the original GitHub Pages and Vercel.
   - ⚠️ Requires additional configuration.

### Mandatory criterion:

The published frontend **must** point to `ucrjtfswnfdlxwtmxnoo` and **never** to `bhgifjrfagkzubpyqpew`. This is guaranteed by `detectAppEnvironment()` in `js/config.js`: any hostname other than `grupoterrabranca.github.io` resolves to the `staging` environment → `ucrjtfswnfdlxwtmxnoo`.

---

## 6. Permanent blocks

- 🔴 **Do not** call `ucrjtfswnfdlxwtmxnoo` the "original production" — it is the parallel environment.
- 🔴 **Do not** touch `bhgifjrfagkzubpyqpew` under any circumstance in this workstream.
- 🔴 **Do not** touch the original Vercel.
- 🔴 **Do not** touch `origin/main`.
- 🔴 **Do not** touch PR #2.
- 🔴 **Do not** run destructive SQL.
- 🔴 **Do not** use the service_role key of `bhgifjrfagkzubpyqpew`.

---

## 7. Note on `js/config.js`

The `js/config.js` file still internally uses the "production" and "staging" labels for the environments. This internal code taxonomy **must not** be confused with the operational taxonomy of this document:

| Label in `js/config.js` | Supabase ref | Real meaning |
|---|---|---|
| `production` | `bhgifjrfagkzubpyqpew` | Original online app / Legacy |
| `staging` | `ucrjtfswnfdlxwtmxnoo` | Parallel work environment |

`detectAppEnvironment()` decides which to use based on the hostname. In the local environment (`localhost`), it always resolves to `staging` → `ucrjtfswnfdlxwtmxnoo`.
