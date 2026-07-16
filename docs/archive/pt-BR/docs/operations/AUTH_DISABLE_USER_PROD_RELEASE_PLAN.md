# Plano de release produção — Auth user provisioning/disable

**Fase:** `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-RELEASE-PLAN-A`  
**Escopo:** docs-only / planejamento de release — sem execução em produção, sem SQL, sem deploy, sem push origin, sem alteração de código.  
**Data:** 2026-06-24  
**HEAD de referência:** `b02a524`

---

## 1. Escopo

Este plano cobre a liberação controlada da cadeia Auth do staging para produção:

- **Edge Function `admin-create-user`** — cria usuário em `auth.users` + `public.usuarios` de forma atômica e compensada.
- **Edge Function `admin-disable-user`** — desativa usuário (soft delete no perfil + ban Auth), com bloqueios de auto-desativação, último admin ativo e idempotência.
- **Schema `db/12_auth_user_disable_schema.sql`** — colunas `ativo`, `desativado_em`, `desativado_por`, `motivo_desativacao` em `public.usuarios`; funções `is_admin()` e `meu_fornecedor_id()` recriadas para exigir `ativo is true`; policies `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update` recriadas.
- **UI de criação/desativação** em `#/cadastros/usuarios` — botões `+ Novo usuário` e `Desativar`, modal de confirmação, mapeamento de erros PT-BR, coluna Status `Ativo`/`Inativo`.
- **Frontend** — merge controlado de `work/app-next` para `origin/main` (GitHub Pages).

---

## 2. Estado validado em staging

| Item | Status |
|---|---|
| Supabase staging ref | `ucrjtfswnfdlxwtmxnoo` |
| HEAD / staging/main | `b02a524` |
| Schema `db/12_auth_user_disable_schema.sql` aplicado | ✅ manualmente por HMNlead (2026-06-24) |
| Edge Function `admin-create-user` deployada | ✅ validada |
| Edge Function `admin-disable-user` deployada | ✅ validada |
| Backend E2E (runner) | ✅ `result: PASS` |
| UI manual staging (HMNlead) | ✅ fluxo real passou |
| Smokes (6 arquivos) | 163/163 PASS |

---

## 3. Estado de produção antes do release

Produção **ainda não foi tocada** por esta cadeia:

| Item | Status |
|---|---|
| Supabase produção ref | `bhgifjrfagkzubpyqpew` |
| origin/main | `1047181eba888242c6428de366cbd9fda2f1c72c` (anterior à cadeia Auth) |
| Schema `db/12_auth_user_disable_schema.sql` | ❌ **Não aplicado** |
| Colunas `ativo`/`desativado_*` em `public.usuarios` | ❌ **Não existem** |
| `is_admin()` exige `ativo is true` | ❌ **Não** |
| `meu_fornecedor_id()` verifica `ativo` | ❌ **Não** |
| Edge Function `admin-create-user` | ❌ **Não deployado** |
| Edge Function `admin-disable-user` | ❌ **Não deployado** |
| Secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc.) | ❌ **Não configurados** |
| Frontend em GitHub Pages | ❌ **Versão pré-refactor** |

---

## 4. Ordem obrigatória de release

A ordem é **sequencial e obrigatória**. Cada etapa deve ser validada antes de avançar.

### 4.1 Confirmar backup/snapshot operacional

Antes de qualquer mutação em produção:
- Confirmar que o HMNlead tem acesso ao Supabase Dashboard de produção (`bhgifjrfagkzubpyqpew`).
- Verificar se há backup automático (Point-in-Time Recovery) habilitado no projeto produção.
- Documentar o estado atual: `select count(*)` das tabelas principais (`usuarios`, `fornecedores`, `ops`, etc.).
- Anotar os 3 usuários atuais (admin + fornecedores) para validação pós-release.

### 4.2 Aplicar schema em produção

1. Abrir SQL Editor do Supabase Dashboard para `bhgifjrfagkzubpyqpew`.
2. Copiar e executar o conteúdo de `db/12_auth_user_disable_schema.sql`.
3. **Não** rodar `db/10_reset_producao.sql`, `db/11_reset_ops.sql` ou qualquer SQL destrutivo.
4. O schema é **idempotente** (usa `IF NOT EXISTS` e `CREATE OR REPLACE`), pode ser reexecutado sem dano.

### 4.3 Validar schema produção

Executar SQL **read-only** para confirmar:

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

### 4.4 Configurar secrets das Edge Functions em produção

No Supabase Dashboard de produção (`bhgifjrfagkzubpyqpew`):

**Settings → API** para obter:
- `Project URL` → `SUPABASE_URL`
- `anon public` → `SUPABASE_ANON_KEY`
- `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

**Edge Functions → `admin-create-user`** (após deploy, ver 4.5) → **Secrets**:
```bash
# Referência apenas — não executar nesta fase
supabase secrets set SUPABASE_URL=<prod_url> --project-ref bhgifjrfagkzubpyqpew
supabase secrets set SUPABASE_ANON_KEY=<prod_anon_key> --project-ref bhgifjrfagkzubpyqpew
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<prod_service_role> --project-ref bhgifjrfagkzubpyqpew
```

Ou via Dashboard: **Edge Functions → [function] → Environment variables**.

Verificar também que o deployment das funções puxou automaticamente as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` do projeto. Apenas `SUPABASE_SERVICE_ROLE_KEY` precisa ser configurada manualmente (não é exposta por padrão).

### 4.5 Deployar `admin-create-user` em produção

```bash
# Referência apenas — não executar nesta fase
supabase functions deploy admin-create-user --project-ref bhgifjrfagkzubpyqpew
```

### 4.6 Validar `admin-create-user` em produção

Testes de API (curl ou Supabase CLI):

```bash
# Sem auth → 401
curl -X POST https://bhgifjrfagkzubpyqpew.supabase.co/functions/v1/admin-create-user \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 UNAUTHORIZED

# Com payload inválido → 400
# (testar com admin JWT nas fases seguintes, se autorizado)
```

Validações opcionais com usuário descartável (somente se autorizado pelo HMNlead):
1. Login admin -> obter JWT.
2. Chamar `admin-create-user` com payload válido.
3. Confirmar `201` com `user_id`, `email`, `tipo`.
4. Confirmar vínculo: `auth.users.id = public.usuarios.id` via SQL read-only.
5. Cleanup: remover usuário via Dashboard (Delete user) para não poluir produção.

### 4.7 Deployar `admin-disable-user` em produção

```bash
# Referência apenas — não executar nesta fase
supabase functions deploy admin-disable-user --project-ref bhgifjrfagkzubpyqpew
```

Verificar secrets em `admin-disable-user` (as mesmas de `admin-create-user`):
```bash
supabase secrets list --project-ref bhgifjrfagkzubpyqpew
```
Confirmar que `SUPABASE_SERVICE_ROLE_KEY` está presente.

### 4.8 Validar `admin-disable-user` em produção

```bash
# Sem auth → 401
curl -X POST https://bhgifjrfagkzubpyqpew.supabase.co/functions/v1/admin-disable-user \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 UNAUTHORIZED
```

Se autorizado, validar com descartável:
1. Criar fornecedor descartável via `admin-create-user`.
2. Tentar `admin-disable-user` com JWT de fornecedor → `403 FORBIDDEN`.
3. Admin desativa descartável → `200 { ativo: false, auth_banned: true }`.
4. Confirmar `ativo = false` via SQL read-only.
5. Tentar login do descartável → falha (banned).
6. Re-desativar → `200 { already_disabled: true }`.
7. Self-disable (admin tenta desativar a si mesmo) → `403 SELF_DISABLE_FORBIDDEN`.
8. Cleanup via Dashboard.

### 4.9 Liberar frontend para `origin/main`

**Atenção: esta etapa só deve ser executada após as etapas 4.2 a 4.8 estarem concluídas e validadas.**

Procedimento:
1. Fazer merge ou push controlado de `work/app-next` para `origin/main`:

```bash
# Referência apenas — não executar nesta fase
git push origin work/app-next:main
```

2. GitHub Pages publica automaticamente (push para `main` → deploy).
3. Aguardar propagação (1-2 minutos).
4. Hard refresh no navegador (Disable cache + Ctrl+F5).

### 4.10 Validar UI produção

1. Acessar `https://grupoterrabranca.github.io/controle-tapetes/`.
2. Fazer login como admin.
3. Navegar para `#/cadastros/usuarios`.
4. Confirmar:
   - Listagem carregando (colunas: E-mail, Nome, Tipo, Fornecedor, Status).
   - Botão `+ Novo usuário` visível e funcional.
   - Botão `Desativar` visível para usuários ativos.
   - Status `Ativo`/`Inativo` correto.
5. Se autorizado, criar usuário descartável e desativar via UI.
6. Confirmar toasts de sucesso/erro em PT-BR.
7. Confirmar que usuário já inativo exibe `"Usuário já está inativo."`.

---

## 5. Comandos/SQL de validação (read-only)

Apenas SQL **read-only** para verificação de estado. Nunca `DELETE`, `DROP`, `TRUNCATE`, `UPDATE` ou `INSERT` sem autorização explícita.

### 5.1 Verificar colunas de `public.usuarios`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuarios'
ORDER BY ordinal_position;
```

### 5.2 Contagem por `ativo`

```sql
SELECT ativo, count(*) AS quantidade
FROM public.usuarios
GROUP BY ativo;
```

### 5.3 Verificar órfãos (auth sem perfil / perfil sem auth)

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

### 5.4 Verificar função `is_admin()`

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
```

### 5.5 Verificar função `meu_fornecedor_id()`

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'meu_fornecedor_id' AND pronamespace = 'public'::regnamespace;
```

### 5.6 Verificar policies de `public.usuarios`

```sql
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'usuarios'
ORDER BY policyname;
```

---

## 6. Bloqueios

- 🔴 **Não liberar frontend antes do backend produção.** Publicar `origin/main` antes das Edge Functions e schema estarem prontos quebra a UI (chama funções inexistentes, schema sem coluna `ativo`).
- 🔴 **Não rodar `db/10_reset_producao.sql`** — DELETE em massa de produção sem autorização.
- 🔴 **Não rodar `db/11_reset_ops.sql`** — DELETE em massa de OPs sem autorização.
- 🔴 **Não usar SQL destrutivo** (DELETE, DROP, TRUNCATE) sem autorização explícita do HMNlead.
- 🔴 **Não hard deletar usuários** — usar sempre soft delete (desativação) como fluxo padrão.
- 🔴 **Não expor `service_role`** no front-end, `js/config.js`, `index.html`, localStorage ou logs.
- 🔴 **Não tocar `origin/main` sem autorização explícita** do HMNlead.
- 🔴 **Não pular etapas** — a ordem 4.1 → 4.10 é obrigatória e sequencial.
- 🟡 **Não reaplicar schema em staging** — staging já está correto. Schema é idempotente, mas não há necessidade.
- 🟡 **Não modificar `admin-create-user` ou `admin-disable-user`** nesta fase — o código já está validado em staging.

---

## 7. Rollback

### 7.1 Se schema falhar (etapa 4.2)

- Parar antes de qualquer deploy de Edge Function.
- O schema é idempotente — reexecutar não causa dano adicional.
- Se houver erro de constraint ou conflito, cancelar e reportar ao HMNlead.
- Não avançar para 4.4.

### 7.2 Se Edge Function falhar (etapas 4.5-4.8)

- Não liberar frontend (etapa 4.9).
- Corrigir, redeployar e revalidar em staging primeiro.
- Se necessário, redeployar versão anterior da função (se houver).

### 7.3 Se frontend falhar após release (etapa 4.9)

- Opção A: Reverter `origin/main` para o commit anterior (`1047181eba888242c6428de366cbd9fda2f1c72c`):

```bash
# Referência apenas — não executar sem autorização
git push origin --force <commit-anterior>:main
```

- Opção B: Hotfix no `work/app-next`, revalidar em staging, push para `origin/main`.
- GitHub Pages propaga a reversão imediatamente (push → deploy).

### 7.4 Limpeza de usuário descartável em produção (se criado)

- Usar **Authentication → Users → Delete user** no Supabase Dashboard de produção (`bhgifjrfagkzubpyqpew`).
- A FK `ON DELETE CASCADE` remove o perfil de `public.usuarios` automaticamente.
- **Nunca** improvisar SQL destrutivo. Seguir procedimento do runbook (`docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` seção 9).

---

## 8. Critérios de GO/NO-GO

### GO (pode liberar) somente se TODOS:

- [ ] Schema `db/12_auth_user_disable_schema.sql` aplicado em produção e validado (SQL read-only confirma colunas, funções, policies).
- [ ] Contagens pós-schema: `auth_users_total = public_usuarios_total`, `auth_sem_perfil = 0`, `perfil_sem_auth = 0`.
- [ ] Secrets configurados em produção (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- [ ] Edge Function `admin-create-user` deployada em produção e responde 401 sem auth, 400/201 com payload válido.
- [ ] Edge Function `admin-disable-user` deployada em produção e responde 401 sem auth, 403 para fornecedor.
- [ ] Smokes backend produção passam (se executados).
- [ ] Staging continua operacional (não foi degradado pelo release).
- [ ] Autorização explícita do HMNlead para cada etapa.

### NO-GO (não liberar) se QUALQUER:

- [ ] Schema ausente ou incompleto em produção.
- [ ] Edge Function `admin-create-user` ausente ou falhando.
- [ ] Edge Function `admin-disable-user` ausente ou falhando.
- [ ] Secrets `SUPABASE_SERVICE_ROLE_KEY` não confirmados.
- [ ] Erro Auth/RLS/policy em produção.
- [ ] Risco de quebrar login ou admin existente.
- [ ] Sem autorização explícita do HMNlead.

---

## 9. Próximas fases de execução

### Fase A: `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-BACKEND-RELEASE-A`

**Escopo:** executar apenas backend produção.
- Aplicar schema (`db/12_auth_user_disable_schema.sql`) em `bhgifjrfagkzubpyqpew`.
- Configurar secrets.
- Deployar `admin-create-user` e `admin-disable-user`.
- Validar com smokes backend (curl e SQL read-only).
- **Não tocar frontend / origin/main.**

### Fase B: `RAVATEX-TAPETES-AUTH-DISABLE-USER-FRONTEND-RELEASE-A`

**Escopo:** liberar frontend após backend produção confirmado.
- Push/merge `work/app-next` para `origin/main`.
- Validar UI produção.
- **Executar somente após Fase A concluída e autorizada.**

### Fase C (se aplicável): `RAVATEX-TAPETES-AUTH-DISABLE-USER-PROD-SMOKE-E2E-A`

**Escopo:** validação E2E opcional em produção com usuário descartável, se autorizado pelo HMNlead.
- Rodar runner adaptado para produção (ou versão manual do roteiro).
- Limpeza controlada após teste.

---

## 10. Referências

- `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` — design da Edge Function de criação.
- `docs/architecture/AUTH_DELETE_USER_DESIGN.md` — design de desativação.
- `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` — runbook operacional de criação.
- `db/12_auth_user_disable_schema.sql` — schema versionado para desativação.
- `supabase/functions/admin-create-user/README.md` — documentação da Edge Function de criação.
- `supabase/functions/admin-disable-user/README.md` — documentação da Edge Function de desativação.
- `scripts/staging/admin-disable-user-e2e.mjs` — runner E2E de staging (referência para produção).
- `PROJECT_STATE.md` — snapshot canônico do projeto.
- `AGENT_HANDOFF.md` — estado aceito para retomada.
