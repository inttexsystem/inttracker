# Reconciliação de ambiente paralelo — Controle de Tapetes

**Fase:** `RAVATEX-TAPETES-PARALLEL-ENV-RECONCILIATION-A`
**Escopo:** docs-only / reconciliação de taxonomia de ambientes — sem SQL, sem deploy, sem push origin, sem alteração de código.
**Data:** 2026-06-24
**HEAD de referência:** `0be1745`

---

## 1. Taxonomia oficial

A nomenclatura anterior de "production" e "staging" era ambígua e levou a riscos operacionais. A classificação correta e definitiva é:

### 1.1 App original online / Legacy / NÃO TOCAR

| Atributo | Valor |
|---|---|
| Supabase ref | `bhgifjrfagkzubpyqpew` |
| Descrição | App original online, usado por usuários externos via Vercel |
| Frontend | Vercel (não GitHub Pages) |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` |

**Proibido nesta frente:**
- SQL (nenhum tipo)
- Deploy de Edge Functions
- Configuração de secrets
- Smoke/teste automatizado
- Qualquer mutação
- Push para `origin/main`
- Push para Vercel

**Se alguma ação for necessária aqui, requer fase separada com autorização especial.**

### 1.2 Ambiente paralelo de trabalho

| Atributo | Valor |
|---|---|
| Supabase ref | `ucrjtfswnfdlxwtmxnoo` |
| Descrição | Backend paralelo novo, usado pelo frontend local e pela frente atual de evolução |
| Aparece no Dashboard como | `main / Production` (rótulo do Supabase, não reflete a realidade deste projeto) |
| staging/main | `0be1745` |

### 1.3 Frontend atual

| Atributo | Valor |
|---|---|
| Branch | `work/app-next` |
| HEAD | `0be1745` |
| Execução | Local (`run-local.bat` → `http://localhost:8765/`) |
| Backend apontado (local) | `ucrjtfswnfdlxwtmxnoo` (staging no `js/config.js`) |
| Repo staging | `controle-tapetes-staging` |

### 1.4 Origem oficial (intocada)

| Atributo | Valor |
|---|---|
| Repo | `grupoterrabranca/controle-tapetes` |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` |
| GitHub Pages | `grupoterrabranca.github.io/controle-tapetes` |
| PR #2 | Intocado |

---

## 2. Estado do backend paralelo (`ucrjtfswnfdlxwtmxnoo`)

### 2.1 Schema

| Item | Status |
|---|---|
| `db/12_auth_user_disable_schema.sql` | ✅ Aplicado manualmente por HMNlead (2026-06-24) |
| Colunas `ativo`/`desativado_em`/`desativado_por`/`motivo_desativacao` | ✅ Existem em `public.usuarios` |
| `is_admin()` recriada com `ativo IS TRUE` | ✅ |
| `meu_fornecedor_id()` recriada com `ativo IS TRUE` | ✅ |
| Policies `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update` recriadas | ✅ |
| Órfãos (auth sem perfil / perfil sem auth) | ✅ 0/0 |
| Todos os usuários com `ativo = true` | ✅ |

### 2.2 Edge Functions

| Função | Status |
|---|---|
| `admin-create-user` | ✅ Deployada, ativa. Responde 401 sem auth. |
| `admin-disable-user` | ✅ Deployada, ativa. Responde 401 sem auth. |

### 2.3 Secrets

| Secret | Status |
|---|---|
| `SUPABASE_URL` | ✅ Configurado |
| `SUPABASE_ANON_KEY` | ✅ Configurado |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Configurado |

### 2.4 Validação

| Evidência | Status |
|---|---|
| Smoke tests (6 arquivos) | ✅ 163/163 PASS |
| E2E backend runner | ✅ `result: PASS` |
| UI manual staging (HMNlead) | ✅ Fluxo real passou |
| Bloqueio fornecedor (403) | ✅ Confirmado |
| Self-disable bloqueado | ✅ Confirmado |
| Último admin bloqueado | ✅ Confirmado |
| Login bloqueado após desativação | ✅ Confirmado |
| Idempotência | ✅ Confirmada |

---

## 3. Estado do app original (`bhgifjrfagkzubpyqpew`)

| Item | Status |
|---|---|
| Schema `db/12_*` | ❌ Não aplicado |
| Colunas `ativo`/`desativado_*` | ❌ Não existem |
| Edge Functions `admin-create-user` / `admin-disable-user` | ❌ Não deployadas |
| Secrets | ❌ Não configurados |
| Frontend | ❌ Versão pré-refactor |
| Ações realizadas nesta frente | ✅ Nenhuma mutação. Apenas 1 query read-only com anon key pública (`GET /rest/v1/usuarios?select=count` → `count: 0`). Projeto intacto. |

---

## 4. Decisão arquitetural operacional

O caminho correto para esta frente é evoluir o ambiente paralelo, **sem tocar o app original**:

```
frontend local (work/app-next)
    ↓
publicação paralela separada (GitHub Pages, Vercel paralelo, ou host estático)
    ↓
validação com backend ucrjtfswnfdlxwtmxnoo
    ↓
(somente depois, se desejado) plano de migração do original
```

Nesta frente **não há release para o app original**. O original (`bhgifjrfagkzubpyqpew` + Vercel + `origin/main`) continua operando normalmente com sua versão atual.

---

## 5. Próxima etapa recomendada

**Fase:** `RAVATEX-TAPETES-PARALLEL-FRONTEND-PUBLISH-PLAN-A`

**Objetivo:** decidir e planejar onde publicar o frontend paralelo sem tocar o Vercel original nem `origin/main`.

### Opções a avaliar:

1. **GitHub Pages no repo staging (`controle-tapetes-staging`)**
   - Push para `staging/main` → GitHub Pages publica automaticamente.
   - URL seria `ravatexapps-dotcom.github.io/controle-tapetes-staging/`.
   - `js/config.js` detectaria hostname diferente de `grupoterrabranca.github.io` → usaria ambiente `staging` → apontaria para `ucrjtfswnfdlxwtmxnoo`.
   - ✅ Simples, sem custo. Já está configurado como repo público.

2. **Vercel separado conectado ao repo staging**
   - Deploy separado, sem tocar o Vercel original.
   - Domínio personalizado opcional.
   - ⚠️ Requer configuração de projeto Vercel novo.

3. **Outro host estático (Netlify, Cloudflare Pages, etc.)**
   - Isolamento total do GitHub Pages e Vercel originais.
   - ⚠️ Requer configuração adicional.

### Critério obrigatório:

O frontend publicado **deve** apontar para `ucrjtfswnfdlxwtmxnoo` e **nunca** para `bhgifjrfagkzubpyqpew`. Isso é garantido pelo `detectAppEnvironment()` em `js/config.js`: qualquer hostname que não seja `grupoterrabranca.github.io` resolve para o ambiente `staging` → `ucrjtfswnfdlxwtmxnoo`.

---

## 6. Bloqueios permanentes

- 🔴 **Não** chamar `ucrjtfswnfdlxwtmxnoo` de "produção original" — é o ambiente paralelo.
- 🔴 **Não** tocar `bhgifjrfagkzubpyqpew` em nenhuma circunstância nesta frente.
- 🔴 **Não** tocar Vercel original.
- 🔴 **Não** tocar `origin/main`.
- 🔴 **Não** tocar PR #2.
- 🔴 **Não** rodar SQL destrutivo.
- 🔴 **Não** usar o service_role key de `bhgifjrfagkzubpyqpew`.

---

## 7. Nota sobre `js/config.js`

O arquivo `js/config.js` ainda usa os rótulos "production" e "staging" internamente para os ambientes. Esta taxonomia interna do código **não** deve ser confundida com a taxonomia operacional deste documento:

| Rótulo em `js/config.js` | Ref Supabase | Significado real |
|---|---|---|
| `production` | `bhgifjrfagkzubpyqpew` | App original online / Legacy |
| `staging` | `ucrjtfswnfdlxwtmxnoo` | Ambiente paralelo de trabalho |

O `detectAppEnvironment()` decide qual usar pelo hostname. No ambiente local (`localhost`), sempre resolve para `staging` → `ucrjtfswnfdlxwtmxnoo`.
