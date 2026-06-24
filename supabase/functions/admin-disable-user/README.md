# `admin-disable-user` — Supabase Edge Function

## Objetivo

Desativar um usuário do app de forma segura, **sem hard delete**,
usando o schema já aplicado em staging:

* `public.usuarios.ativo` (`boolean not null default true`)
* `public.usuarios.desativado_em` (`timestamptz`)
* `public.usuarios.desativado_por` (`uuid references auth.users`)
* `public.usuarios.motivo_desativacao` (`text`)

Após o soft delete do perfil, a função tenta banir o `auth.users`
correspondente via `auth.admin.updateUserById(user_id, { ban_duration:
'876000h' })` (100 anos), de modo a impedir login residual.

Contrato completo e justificativa de design:
`docs/architecture/AUTH_DELETE_USER_DESIGN.md` (seções 4.4, 5, 6 e 7.2).
Schema: `db/12_auth_user_disable_schema.sql` (aplicado em staging
`ucrjtfswnfdlxwtmxnoo` na fase
`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`).

## Contrato

* **Método:** `POST` (aceita `OPTIONS` para preflight CORS).
* **Header:** `Authorization: Bearer <jwt-do-admin-ativo>`.
* **Body (JSON):**

  ```json
  {
    "user_id": "<uuid>",
    "reason": "texto opcional, até 500 caracteres"
  }
  ```

* **Sucesso** (`200`):

  ```json
  {
    "data": {
      "user_id": "<uuid>",
      "email": "usuario@exemplo.com",
      "tipo": "admin" | "fornecedor",
      "ativo": false,
      "auth_banned": true
    }
  }
  ```

  Quando o usuário já está `ativo = false`, a função é **idempotente**:
  retorna `200` com o estado atual e o flag extra
  `"already_disabled": true`.

* **Erro** (códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `SELF_DISABLE_FORBIDDEN`, `LAST_ADMIN_FORBIDDEN`,
  `PROFILE_UPDATE_FAILED`, `AUTH_BAN_FAILED`, `COMPENSATION_FAILED`,
  `UNKNOWN`):

  ```json
  {
    "error": { "code": "FORBIDDEN", "message": "Apenas admins ativos podem desativar usuários." }
  }
  ```

  | Código | HTTP | Significado |
  |---|---|---|
  | `VALIDATION_ERROR` | 400 | Payload inválido (user_id ausente, UUID inválido, reason > 500 chars, JSON inválido, método não POST). |
  | `UNAUTHORIZED` | 401 | JWT ausente ou inválido. |
  | `FORBIDDEN` | 403 | Chamador não é admin ativo em `public.usuarios`. |
  | `NOT_FOUND` | 404 | `user_id` não existe em `public.usuarios`. |
  | `SELF_DISABLE_FORBIDDEN` | 403 | Admin tentou desativar a si mesmo. |
  | `LAST_ADMIN_FORBIDDEN` | 403 | Tentativa de desativar o último admin ativo. |
  | `PROFILE_UPDATE_FAILED` | 500 | Falha ao atualizar `public.usuarios`. |
  | `AUTH_BAN_FAILED` | 500 | Falha ao banir Auth user; perfil revertido para `ativo = true`. |
  | `COMPENSATION_FAILED` | 500 | Ban falhou **e** a reversão do perfil também falhou. Requer ação manual. |
  | `UNKNOWN` | 500 | Erro não classificado. |

## Variáveis de ambiente esperadas

Configuradas via `supabase secrets` (nunca versionadas):

| Nome | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Anon key pública. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (secret; usada **somente** server-side). |

## Segurança

* `service_role` **nunca** deve aparecer no front-end, em
  `js/config.js`, `index.html`, `localStorage` ou em qualquer arquivo
  versionado no client. Esta função valida o chamador **server-side**,
  não confia em payload do front.
* Validação de admin é **server-side**: a função extrai o `auth.uid()`
  do JWT no header `Authorization` e consulta `public.usuarios` para
  exigir `tipo = 'admin' AND ativo IS TRUE`.
* RLS não substitui essa validação. A função usa `service_role`, que
  ignora RLS; a checagem explícita é obrigatória.
* Logs nunca devem conter `password`, `service_role`, JWT, ou a
  `SUPABASE_SERVICE_ROLE_KEY`.

## Bloqueios server-side

* **Auto-desativação** (`SELF_DISABLE_FORBIDDEN`): se
  `target_user_id === caller_user_id`, a função recusa antes de tocar
  no banco.
* **Último admin** (`LAST_ADMIN_FORBIDDEN`): se o alvo é `admin` e é o
  único `admin` com `ativo = true`, a função recusa. Isso garante que
  sempre haja pelo menos 1 admin operacional.
* **Validação de UUID**: `user_id` é validado por regex antes de
  qualquer operação de banco.

## Soft delete + ban Auth (com compensação)

A ordem de operações é:

1. Validar JWT e exigir admin ativo (chamador).
2. Validar payload (`user_id` UUID, `reason` ≤ 500 chars, normalizado).
3. Bloquear auto-desativação.
4. Buscar perfil alvo em `public.usuarios`.
5. Se já inativo, retornar estado atual (`already_disabled: true`).
6. Se alvo for admin, contar admins ativos. Se ≤ 1, recusar.
7. Atualizar `public.usuarios`:
   `ativo = false`, `desativado_em = now`,
   `desativado_por = caller_id`, `motivo_desativacao = reason`.
8. Chamar `auth.admin.updateUserById(target_id, { ban_duration:
   '876000h' })`.
9. Se o ban falhar: tentar reverter o perfil para `ativo = true` e
   limpar os campos de desativação. Se a reversão também falhar,
   retornar `COMPENSATION_FAILED` (requer ação manual).
10. Retornar `200` com estado final.

A compensação evita o estado intermediário "perfil inativo + Auth
ativo" sem reportar. Se a compensação falhar, a função ainda falha com
código claro para investigação manual.

## Deploy (apenas referência — não executar nesta fase)

```bash
supabase functions deploy admin-disable-user --project-ref <staging-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref <staging-ref>
supabase secrets set SUPABASE_URL=... --project-ref <staging-ref>
supabase secrets set SUPABASE_ANON_KEY=... --project-ref <staging-ref>
```

O deploy controlado está previsto em fase futura
(`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`),
**não nesta**.

## Validação futura em staging (referência)

Após o deploy em staging, a validação E2E esperada (fase futura)
inclui:

* Admin ativo desativa fornecedor descartável via UI →
  `admin-disable-user` retorna `200` com `auth_banned: true`;
* `public.usuarios.ativo` do alvo vira `false` (verificado por SQL
  read-only);
* `auth.users.banned_until` reflete o `ban_duration` aplicado;
* `loadCurrentUser` do alvo retorna `null` no app
  (`auth.uid() = id AND ativo IS TRUE` falha);
* Login Auth do alvo falha com `banned` (não consegue nem entrar);
* Reativação via SQL read-only restaura o acesso (reversibilidade);
* Compensação: se `ban_duration` forçado a falhar, perfil deve voltar
  para `ativo = true` e resposta deve ser `AUTH_BAN_FAILED`.

## Exemplo de payload (sem dados sensíveis)

```json
{
  "user_id": "00000000-0000-0000-0000-000000000000",
  "reason": "Fornecedor descartável de teste E2E"
}
```
