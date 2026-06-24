# Auth Delete User Design

**Fase:** `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`  
**Escopo:** docs-only / design-only — sem implementação, sem código, sem SQL, sem Supabase real.  
**Data:** 2026-06-24  
**HEAD de referência:** `3c9c424`

---

## 1. Problema

A criação de usuários agora é consistente entre Auth e perfil — a Edge
Function `admin-create-user` cria `auth.users` e `public.usuarios` no
mesmo fluxo atômico e compensado, garantindo
`auth.users.id = public.usuarios.id`.

Porém, a exclusão/desativação de usuários pelo app ainda não tem
semântica definida. O comportamento atual só remove o perfil de
`public.usuarios`, deixando `auth.users` intacto. Isso pode gerar
usuários Auth órfãos (com login válido, mas sem perfil no app),
reintroduzindo a inconsistência operacional que a Edge Function de
criação resolveu.

Esta fase define a semântica correta de exclusão/desativação para
orientar a implementação futura, sem executar código ou deploy.

---

## 2. Estado atual

### 2.1 Listagem de usuários (`screenCadastrosUsuarios`)

Arquivo: `js/screens/cadastros.js:481-649`

A tela `#/cadastros/usuarios`:

- **Listagem** (linhas 484-490): `SELECT id, email, nome, tipo,
  fornecedor:fornecedor_id(id, nome, tipo)` em `public.usuarios` com
  join em `fornecedores`, ordenado por e-mail.
- **Colunas exibidas**: E-mail, Nome, Tipo, Fornecedor.
- **Ações por linha**: "Editar" e "Excluir vínculo".

### 2.2 Edição de usuário

- **Chama** `window.supa.from('usuarios').update(...)` diretamente,
  alterando `email`, `nome`, `tipo`, `fornecedor_id`.
- **Não** altera `auth.users` (senha, e-mail Auth, etc.).
- **Não** chama nenhuma Edge Function.
- UID exibido como readonly (campo desabilitado).

### 2.3 Exclusão de usuário (comportamento atual)

Arquivo: `js/screens/cadastros.js:633-645`

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

Análise do comportamento atual:

| Aspecto | Estado |
|---|---|
| Rótulo do botão | "Excluir vínculo" (não "Excluir usuário") |
| Rótulo do modal | "Excluir vínculo" |
| Mensagem de confirmação | Avisa que Auth **não** será removido |
| Ação efetiva | `.delete()` apenas em `public.usuarios` |
| Auth user | **Preservado** — permanece ativo e pode autenticar |
| Validação server-side | **Nenhuma** — apenas RLS (`usuarios_admin_all`) |
| Bloqueio de autoexclusão | **Nenhum** — admin pode excluir a si mesmo |
| Confirmação por e-mail | **Nenhuma** — apenas confirmDialog simples |
| Auditoria | **Nenhuma** — delete físico, sem rastro |

### 2.4 Chamadas a Auth Admin no front-end

**Nenhuma.** Confirmado por:

- `tests/cadastros-usuarios-auth-ui.smoke.js:77-79`: assert que
  `cadastros.js` **não** chama `auth.admin`.
- `js/screens/cadastros.js` não contém `auth.admin`, `service_role`,
  `SUPABASE_SERVICE_ROLE_KEY` ou `supabase/functions` (além da chamada
  `admin-create-user` para criação).

### 2.5 Edge Function de exclusão

**Não existe.** A única Edge Function implementada é `admin-create-user`
(`supabase/functions/admin-create-user/index.ts`). Ela usa
`auth.admin.deleteUser` apenas no fluxo de **compensação** (rollback
quando `public.usuarios` insert falha), não como funcionalidade exposta.

### 2.6 Coluna de status/ativo/inativo

**Não existe** em `public.usuarios`. O schema atual (`db/01_schema.sql:26-33`):

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

Não há coluna `ativo`, `status`, `bloqueado` ou `deleted_at`. A
exclusão é sempre física (hard delete), sem soft delete possível.

### 2.7 FK `public.usuarios.id → auth.users.id ON DELETE CASCADE`

Arquivo: `db/01_schema.sql:27`

```sql
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
```

Comportamento:

- **Deletar `auth.users`** → `public.usuarios` é removido automaticamente
  por CASCADE.
- **Deletar `public.usuarios`** → `auth.users` **não** é afetado
  (FK é unidirecional).
- A operação de delete em `auth.users` exige `service_role` ou ação
  administrativa no Supabase Dashboard — não é possível via client anon.

### 2.8 RLS atual para `usuarios`

Arquivo: `db/03_policies.sql:27-37`

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

Observações:

- `usuarios_admin_all` cobre DELETE — qualquer admin pode deletar
  qualquer usuário de `public.usuarios`.
- **Não há política de DELETE para self.** Fornecedor não pode deletar
  o próprio perfil via RLS (o que é desejável).
- RLS **não valida** nada server-side quando o delete é feito via
  `service_role` (Edge Function); por isso a checagem explícita é
  necessária.

### 2.9 `loadCurrentUser` e impacto de perfil ausente

Arquivo: `js/auth.js:82-101`

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

Se `public.usuarios` for deletado mas `auth.users` continuar ativo:

1. Usuário autentica normalmente (`signInWithPassword` funciona).
2. `loadCurrentUser` tenta ler `public.usuarios` pelo `session.user.id`.
3. `.single()` retorna erro (registro não encontrado).
4. `CURRENT_USER = null`.
5. Boot interpreta como "não logado" → redirect para `#/login`.
6. Resultado: **loop de login** — Auth OK, mas sem perfil.

Este é exatamente o bug que a Edge Function de criação resolveu para o
fluxo de provisionamento. A exclusão atual reintroduz o mesmo sintoma
pelo caminho inverso.

---

## 3. Riscos do estado atual

### 3.1 Auth user órfão (risco ALTO)

**Cenário:** admin clica "Excluir vínculo" → `public.usuarios` é
removido → `auth.users` permanece ativo.

**Consequências:**

- Usuário consegue autenticar (login/senha funcionam).
- App redireciona para `#/login` por falta de perfil (loop).
- Admin perde visibilidade do usuário na listagem (já foi removido de
  `public.usuarios`), mas a conta Auth ainda existe.
- Para corrigir: é necessário acesso ao Supabase Dashboard para deletar
  manualmente em `auth.users`.

### 3.2 Hard delete do perfil sem hard delete do Auth (risco ALTO)

Mesmo risco 3.1, agravado pelo fato de que a UI atual chama isso de
"Excluir vínculo" e avisa que o Auth não será removido — mas o
operador pode não entender a implicação prática (usuário fantasma que
consegue logar mas não acessa o app).

### 3.3 Delete em `public.usuarios` não cascateia para Auth (risco MÉDIO)

A FK `usuarios.id → auth.users(id) ON DELETE CASCADE` só funciona no
sentido Auth → perfil. Deletar o perfil **não** propaga para o Auth.

Para remover `auth.users` é necessário:

- `service_role` (Edge Function server-side), ou
- Supabase Dashboard (manual), ou
- SQL Admin (`DELETE FROM auth.users WHERE id = '...'`).

Nenhum desses caminhos está disponível no fluxo atual do app.

### 3.4 Deletar fisicamente prejudica auditoria (risco MÉDIO)

Hard delete remove permanentemente o registro. Não há:

- Soft delete (`ativo = false`).
- Coluna `deleted_at`.
- Log de quem excluiu, quando e por quê.

Se um usuário for excluído e depois for necessário auditar ações
passadas (ex.: "quem criou a OP X?", "quem aprovou a entrega Y?"),
o vínculo com `usuarios.id` se perde — outras tabelas referenciam
`usuarios.id` mas a linha original some.

### 3.5 Admin pode se autoexcluir (risco ALTO)

Não há nenhuma validação que impeça `CURRENT_USER.id === usr.id`.
Se o único admin se excluir, o sistema perde capacidade administrativa
até que outro admin seja criado manualmente no Supabase Studio.

### 3.6 Fornecedor não pode excluir usuário (risco BAIXO)

A RLS atual (`usuarios_admin_all`) impede fornecedor de deletar
qualquer registro em `usuarios`. Isso é correto. O risco é apenas de o
futuro design acidentalmente permitir.

### 3.7 Impacto indireto em outras tabelas (risco BAIXO)

`usuarios.fornecedor_id` referencia `fornecedores(id) ON DELETE SET NULL`.
Se um fornecedor for deletado, `usuarios.fornecedor_id` vira NULL — o
que quebraria o vínculo de fornecedor mas preservaria o login.

`usuarios.id` **não** é referenciado como FK por outras tabelas de
domínio (OPs, entregas, etc.), então a exclusão do perfil não
compromete a integridade referencial de dados operacionais. Porém,
auditoria histórica (quem criou/alterou) pode ser afetada.

### 3.8 RLS não substitui validação server-side (risco MÉDIO)

A Edge Function futura usará `service_role`, que **ignora RLS**.
Toda validação de permissão (admin, não-autoexclusão, etc.) precisa
ser explícita no código da função, não delegada ao RLS.

---

## 4. Alternativas avaliadas

### 4.1 Alternativa A — Hard delete só em `public.usuarios` (status quo)

**Descrição:** manter o comportamento atual: deletar perfil, preservar
Auth. Operador limpa Auth manualmente no Dashboard.

**Vantagens:**

- Nenhuma alteração necessária (já está implementado).
- Simples.

**Desvantagens:**

- Gera Auth user órfão (login funciona, app redireciona).
- Inconsistência operacional — mesmo problema que a Edge Function de
  criação resolveu.
- Exige acesso ao Supabase Dashboard para limpeza completa.
- Não escala.

**Conclusão:** não recomendado como fluxo principal. Pode permanecer
como contingência de baixo nível, mas não deve ser o caminho padrão
oferecido pela UI.

### 4.2 Alternativa B — Hard delete de `auth.users` via Edge Function (`admin-delete-user`)

**Descrição:** Edge Function server-side que chama
`auth.admin.deleteUser(userId)`, e a FK `ON DELETE CASCADE` remove
`public.usuarios` automaticamente.

**Vantagens:**

- Limpa Auth + perfil de forma atômica (cascade garante consistência).
- Operação server-side com `service_role` — segura.
- Não deixa órfãos em nenhuma direção.

**Desvantagens:**

- Operação **destrutiva e irreversível** — sem soft delete.
- Remove permanentemente o histórico de auditoria do usuário.
- Precisa de validações rigorosas:
  - Bloquear autoexclusão.
  - Confirmar e-mail digitado (dupla confirmação).
  - Não permitir exclusão do último admin.
- Exige deploy de nova Edge Function.
- `auth.admin.deleteUser` é operação crítica — se falhar após o
  cascade do perfil (improvável, mas possível), o estado fica
  inconsistente.

**Conclusão:** viável para cenários de limpeza definitiva (ex.: teste,
staging, usuário nunca usado), mas **arriscado como fluxo padrão de
produção** por ser irreversível e sem auditoria.

### 4.3 Alternativa C — Soft delete / desativação no perfil

**Descrição:** adicionar coluna `ativo BOOLEAN NOT NULL DEFAULT true`
(ou `status TEXT`) em `public.usuarios`. A exclusão lógica marca
`ativo = false` em vez de deletar.

**Vantagens:**

- Preserva rastreabilidade e auditoria.
- Reversível (reativar usuário).
- Fácil de implementar: uma coluna + filtro nas queries.
- Não remove `auth.users` — mas impede o acesso ao app (ver
  desvantagem).

**Desvantagens:**

- **Auth user ainda pode autenticar.** Marcar `ativo = false` em
  `public.usuarios` impede `loadCurrentUser` de carregar o perfil, mas
  o usuário ainda consegue fazer login no Auth. O app redireciona para
  `#/login` (loop), mas a sessão Auth existe. Para bloquear
  completamente o login, seria necessário também banir/desabilitar no
  Auth.
- Exige alteração de schema (migration).
- Exige atualização de RLS (filtrar `ativo = true` nas policies).
- Exige adaptação da UI (listagem deve mostrar/filtrar inativos).
- Exige adaptação de `loadCurrentUser` (só carregar se `ativo = true`).

**Conclusão:** boa para preservar histórico e permitir reativação, mas
**insuficiente sozinha** — precisa ser combinada com bloqueio no Auth
(alternativa D) ou complementada com Edge Function de ban.

### 4.4 Alternativa D — Ban/desativação Auth server-side

**Descrição:** Edge Function que usa `auth.admin.updateUserById` para
banir o usuário (Supabase oferece `ban` como opção de
`updateUserById`), impedindo login, combinado com soft delete no perfil
(alternativa C).

**Vantagens:**

- Impede login sem apagar histórico.
- Perfil permanece em `public.usuarios` para auditoria.
- Combina segurança (sem login) com rastreabilidade.
- Reversível (desbanir).

**Desvantagens:**

- Precisa confirmar disponibilidade e comportamento exato da API
  `auth.admin.updateUserById` com `ban: true` na versão do Supabase
  usada em staging (`ucrjtfswnfdlxwtmxnoo`).
- Exige deploy de nova Edge Function.
- Exige alteração de schema (coluna `ativo`/`status`).
- Mais complexa que as alternativas A ou B.

**Conclusão:** alternativa **mais completa** e **recomendada** para
produção. Se a API de ban não estiver disponível ou for inadequada,
usar `auth.admin.deleteUser` como fallback controlado.

### 4.5 Alternativa E — Bloquear exclusão pelo app

**Descrição:** remover ou desabilitar o botão "Excluir vínculo" da UI
até que um fluxo seguro seja implementado. Manter criação e edição
funcionando.

**Vantagens:**

- Risco zero imediato — nenhum usuário é excluído indevidamente.
- Implementação trivial (remover botão ou esconder atrás de flag).
- Dá tempo para projetar e testar a solução definitiva.

**Desvantagens:**

- Perda de funcionalidade (admin não consegue remover usuários pelo
  app).
- Limpeza de staging/produção fica dependente do Supabase Dashboard.
- Não é solução definitiva — apenas contenção de risco.

**Conclusão:** recomendada como **medida de curto prazo** enquanto o
design final é implementado. Pode ser feita na mesma fase de UI da
Edge Function de desativação.

---

## 5. Recomendação arquitetural

### Decisão: preferir DESATIVAR a DELETAR fisicamente

**Recomendação em duas frentes:**

#### Curto prazo (agora): Alternativa E

- Remover ou restringir o botão "Excluir vínculo" da UI
  `#/cadastros/usuarios`.
- Limpeza de usuários de teste/staging continua via **Supabase
  Dashboard** (procedimento documentado em
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` seção 9).
- Isso elimina o risco imediato de gerar Auth users órfãos pelo app.

#### Longo prazo (fase futura): Alternativa D + C (DESATIVAR)

- Implementar Edge Function `admin-disable-user` que:
  - Marca `public.usuarios.ativo = false`.
  - Aplica ban no Auth (`auth.admin.updateUserById` com `ban: true`),
    se a API estiver disponível. Caso contrário, apenas o soft delete
    no perfil já bloqueia o acesso ao app (com a ressalva documentada
    de que o login Auth ainda funciona).
- Adicionar coluna `ativo BOOLEAN NOT NULL DEFAULT true` em
  `public.usuarios`.
- Atualizar RLS e `loadCurrentUser` para respeitar `ativo`.

### Justificativa técnica

1. **Auditoria:** produção precisa de rastreabilidade. Hard delete
   remove permanentemente o vínculo entre ações passadas e o usuário
   que as executou.
2. **Reversibilidade:** desativar permite reativar se houver erro
   operacional. Deletar é irreversível sem backup.
3. **Segurança:** desativar no perfil + banir no Auth impede tanto o
   acesso ao app quanto o login, sem destruir dados.
4. **Consistência com criação:** se o fluxo de criação é atômico e
   compensado, o fluxo de desativação também deve ser — mas com
   segurança adicional (sem destruição).
5. **Staging:** usuários de teste podem continuar sendo removidos via
   Dashboard com `ON DELETE CASCADE` (já documentado e funcional).

---

## 6. Contrato proposto para fase futura

### Opção recomendada: `admin-disable-user`

**Edge Function:** `supabase/functions/admin-disable-user/index.ts`

#### Payload

```json
{
  "user_id": "<uuid>",
  "reason": "texto opcional para auditoria"
}
```

#### Comportamento

1. **Validar JWT** — extrair `auth.uid()` do header `Authorization`.
2. **Exigir admin** — consultar `public.usuarios` e confirmar
   `tipo = 'admin'` para o chamador.
3. **Bloquear autodesativação** — `user_id !== callerId`.
4. **Validar se usuário alvo existe** — consultar `public.usuarios`
   por `id`.
5. **Marcar como inativo** — `UPDATE public.usuarios SET ativo = false
   WHERE id = user_id`.
6. **Banir no Auth** — `auth.admin.updateUserById(user_id, { ban: true })`
   (se API disponível; caso contrário, pular com log).
7. **Registrar log** (sem password, sem secrets):
   - `callerId`, `targetUserId`, `reason` (se fornecida), timestamp.
8. **Retornar estado final:**
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

#### Códigos de erro

| Código | HTTP | Significado |
|---|---|---|
| `UNAUTHORIZED` | 401 | JWT ausente/inválido. |
| `FORBIDDEN` | 403 | Chamador não é admin. |
| `SELF_DISABLE` | 403 | Admin tentou desativar a si mesmo. |
| `USER_NOT_FOUND` | 404 | `user_id` não existe em `public.usuarios`. |
| `ALREADY_DISABLED` | 409 | Usuário já está inativo. |
| `VALIDATION_ERROR` | 400 | Payload inválido. |
| `DISABLE_FAILED` | 500 | Falha ao atualizar perfil ou Auth. |
| `UNKNOWN` | 500 | Erro não classificado. |

#### Segurança

- `service_role` **apenas** server-side (variável de ambiente da Edge
  Function, nunca no front).
- Validação de admin server-side (não confia no client).
- Bloqueio de autodesativação server-side.
- Logs sem `password`, `service_role` ou JWTs.

### Opção secundária (se hard delete for necessário): `admin-delete-user`

**Edge Function:** `supabase/functions/admin-delete-user/index.ts`

#### Payload

```json
{
  "user_id": "<uuid>",
  "confirm_email": "email@usuario.com"
}
```

#### Comportamento

1. Validar JWT + exigir admin + bloquear autoexclusão (igual acima).
2. **Confirmar e-mail:** o `confirm_email` deve ser igual ao e-mail do
   usuário alvo (case-insensitive). Isso previne clique acidental.
3. **Deletar Auth user:** `auth.admin.deleteUser(user_id)`.
4. **Cascade remove perfil:** `ON DELETE CASCADE` em
   `public.usuarios.id → auth.users.id` remove o perfil
   automaticamente.
5. **Retornar sucesso** (sem expor `service_role`).
6. Se `deleteUser` falhar, retornar erro — **nunca** deletar perfil
   manualmente antes do Auth.

---

## 7. Mudanças necessárias por camada

### 7.1 Database

- **Nova coluna:** `public.usuarios.ativo BOOLEAN NOT NULL DEFAULT true`
  (schema migration futura, fase própria).
- **Nova coluna opcional:** `public.usuarios.desativado_em TIMESTAMPTZ`
  e `public.usuarios.desativado_por UUID` (para auditoria).
- **Novas policies RLS:**
  - `usuarios_select`: filtrar `WHERE ativo = true OR is_admin()`
    (admin vê todos, inclusive inativos).
  - `usuarios_self_update`: adicionar `AND ativo = true` (usuário
    inativo não pode se autoeditar).
- **Impacto em `loadCurrentUser`:**
  - Adicionar condição `AND ativo = true` na query do perfil.
  - Se `ativo = false`, `loadCurrentUser` retorna `null` → redirect
    para `#/login` (comportamento existente, sem alteração).

### 7.2 Edge Function

- **Nova função:** `admin-disable-user` (recomendada) ou
  `admin-delete-user` (secundária).
- **Validação admin:** server-side, consultando `public.usuarios`.
- **Bloqueio de auto-operação:** `user_id !== callerId`.
- **Logs:** sem `password`, sem `service_role`, sem JWTs.
- **Localização:** `supabase/functions/admin-disable-user/index.ts`.
- **Deploy:** fase própria (`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`).

### 7.3 Front-end (`js/screens/cadastros.js`)

**Curto prazo (Alternativa E):**

- Remover ou ocultar botão "Excluir vínculo" da tabela de usuários.
- Opção: substituir por tooltip "Em breve" ou esconder completamente.

**Longo prazo (Alternativa D+C):**

- Botão "Desativar usuário" (ou "Desativar") no lugar de "Excluir
  vínculo".
- Modal de confirmação forte:
  - Título: "Desativar usuário".
  - Mensagem: "O usuário `<email>` será desativado e perderá acesso ao
    sistema. Esta ação pode ser revertida por outro admin."
  - Opcional: campo de motivo.
- Chamada à Edge Function:
  ```js
  const { error } = await window.supa.functions.invoke('admin-disable-user', {
    body: { user_id: usr.id, reason: motivo }
  });
  ```
- Tratamento de erros:
  - `SELF_DISABLE` → "Você não pode desativar a si mesmo."
  - `ALREADY_DISABLED` → "Usuário já está desativado."
  - `FORBIDDEN` → "Apenas admins podem desativar usuários."
- **Nunca** chamar `auth.admin` no browser.
- **Nunca** expor `service_role`.

### 7.4 Listagem de usuários

- **Admin:** vê todos, inclusive inativos (com indicador visual:
  badge "Inativo" cinza).
- **Fornecedor:** vê apenas o próprio perfil (RLS existente +
  filtro `ativo = true`).
- **Botão "Reativar":** disponível para admin reverter desativação
  (fase futura).

### 7.5 Runbook

- Atualizar `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md`:
  - Seção de desativação (nova).
  - Atualizar seção de limpeza (manter limpeza via Dashboard para
    staging, mencionar Edge Function para produção).
  - Incluir troubleshooting de usuário desativado que não consegue
    logar.

---

## 8. Critérios de aceite para implementação futura

A fase de implementação (código) só será considerada concluída quando:

- [ ] Nenhum `service_role` está presente no front-end, `js/config.js`,
  `index.html`, `localStorage` ou qualquer arquivo versionado no
  client.
- [ ] Nenhum Auth user fica órfão após desativação (perfil fica
  marcado `ativo = false`, Auth user é banido — ou permanece
  consistente com o estado do perfil).
- [ ] Nenhum perfil fica órfão (sem Auth user correspondente).
- [ ] Fornecedor não pode desativar/excluir usuário (403 da Edge
  Function + RLS).
- [ ] Admin não pode desativar/excluir a si mesmo (403 `SELF_DISABLE`
  da Edge Function).
- [ ] Logs da Edge Function não contêm `password`, `service_role` ou
  JWTs.
- [ ] Smoke tests cobrem:
  - Validação de admin server-side.
  - Bloqueio de autoexclusão.
  - Bloqueio de fornecedor.
  - Payload inválido.
  - Ausência de `service_role` no front-end.
- [ ] Teste E2E em staging com usuário descartável:
  - Criar usuário de teste via `admin-create-user`.
  - Desativar via `admin-disable-user`.
  - Confirmar `ativo = false` em `public.usuarios` (SQL read-only).
  - Confirmar que login do usuário desativado falha ou redireciona.
  - Limpar via Dashboard após teste.
- [ ] `loadCurrentUser` respeita `ativo = true` (usuário inativo não
  carrega perfil).
- [ ] Listagem de usuários (admin) mostra indicador de inativo.

---

## 9. Pendências e decisões para HMNlead

As seguintes decisões precisam ser tomadas pelo dono do projeto antes
da implementação:

1. **Excluir fisicamente ou desativar?**
   - Desativar (recomendado): preserva auditoria, reversível.
   - Excluir: remove permanentemente, útil apenas para staging/teste.

2. **Precisa manter histórico/auditoria de quem fez o quê?**
   - Se sim, soft delete + colunas `desativado_em` / `desativado_por`.

3. **Usuários de teste/staging podem continuar sendo removidos
   manualmente pelo Dashboard até a fase própria?**
   - Recomendação: sim. Já é o procedimento documentado no runbook.

4. **Produção deve permitir exclusão física ou apenas desativação?**
   - Recomendação: apenas desativação. Exclusão física somente via
     Dashboard em incidente.

5. **Deve haver confirmação por e-mail digitado para excluir?**
   - Para hard delete: sim (previne clique acidental).
   - Para desativar: opcional (a ação é reversível).

6. **Deve bloquear exclusão/desativação do último admin?**
   - Recomendação: sim. Sempre deve haver pelo menos 1 admin ativo.

7. **API `auth.admin.updateUserById` com `ban: true` está disponível
   na versão do Supabase em staging?**
   - Precisa de verificação técnica antes de implementar. Se não
     estiver, usar apenas soft delete no perfil (com ressalva
     documentada de que login Auth ainda funciona).

---

## 10. Próxima fase proposta

### Fase recomendada: `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`

**Escopo:** schema-only, docs-only.

**Objetivo:** projetar e validar a alteração de schema necessária para
suportar soft delete (`ativo`, `desativado_em`, `desativado_por`),
antes de implementar código.

**Entregas:**
- Proposta de migration SQL (read-only, não executar).
- Impacto nas policies RLS.
- Impacto em `loadCurrentUser` (filtro `ativo = true`).
- Smoke tests estáticos para o novo schema.

**Fase seguinte:** `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`
(implementação da Edge Function `admin-disable-user`).

### Fase alternativa (se hard delete for a decisão):
`RAVATEX-TAPETES-AUTH-DELETE-USER-EDGE-FUNCTION-A`
(implementação da Edge Function `admin-delete-user`).

### Fase de contenção imediata (se quiser bloquear exclusão já):
`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`
(remover ou ocultar botão "Excluir vínculo" da UI).

---

## 11. Referências

- `js/screens/cadastros.js:481-649` — `screenCadastrosUsuarios`.
- `js/auth.js:82-101` — `loadCurrentUser`.
- `js/auth.js:59-67` — `login`.
- `supabase/functions/admin-create-user/index.ts` — Edge Function de
  criação (referência de arquitetura).
- `db/01_schema.sql:26-33` — schema de `usuarios`.
- `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
- `db/03_policies.sql:27-37` — RLS de `usuarios`.
- `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` — design da
  Edge Function de criação.
- `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` — runbook
  operacional (seção 9: limpeza de teste).
- `docs/architecture/CODE_HEALTH_RULES.md` — regras de saúde
  arquitetural.
- `tests/cadastros-usuarios-auth-ui.smoke.js` — smoke da UI de
  usuários.
- `tests/admin-create-user.smoke.js` — smoke da Edge Function de
  criação.
