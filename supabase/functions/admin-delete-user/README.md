# `admin-delete-user` — Supabase Edge Function

## Objetivo

Excluir **permanentemente** um usuário do app:

1. Remove `public.usuarios` (perfil).
2. Remove `auth.users` via `auth.admin.deleteUser`.

Diferente de `admin-disable-user`, esta função é **hard delete** (sem soft delete, sem `ban_duration`). A ação é destrutiva e exige confirmação por e-mail.

Contrato e justificativa de design: `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (seções 4.2, 5, 6 e 7.2).

## Contrato

* **Método:** `POST` (aceita `OPTIONS` para preflight CORS).
* **Header:** `Authorization: Bearer <jwt-do-admin-ativo>`.
* **Body (JSON):**

  ```json
  {
    "user_id": "<uuid>",
    "confirm_email": "email-do-usuario@exemplo.com"
  }
  ```

* **Sucesso** (`200`):

  ```json
  {
    "data": {
      "ok": true,
      "deleted": true,
      "user_id": "<uuid>",
      "email": "email-do-usuario@exemplo.com"
    }
  }
  ```

* **Erro** (códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFIRM_EMAIL_MISMATCH`, `SELF_DELETE_FORBIDDEN`,
  `LAST_ADMIN_FORBIDDEN`, `USER_HAS_REFERENCES`,
  `AUTH_DELETE_FAILED`, `COMPENSATION_FAILED`, `UNKNOWN`):

  ```json
  { "error": { "code": "USER_HAS_REFERENCES", "message": "..." } }
  ```

  | Código | HTTP | Significado |
  |---|---|---|
  | `VALIDATION_ERROR` | 400 | Payload inválido (user_id ausente/inválido, confirm_email ausente/inválido, JSON inválido, método não POST). |
  | `UNAUTHORIZED` | 401 | JWT ausente ou inválido. |
  | `FORBIDDEN` | 403 | Chamador não é admin ativo em `public.usuarios`. |
  | `NOT_FOUND` | 404 | `user_id` não existe em `public.usuarios`. |
  | `CONFIRM_EMAIL_MISMATCH` | 400 | `confirm_email` difere do e-mail do usuário alvo. |
  | `SELF_DELETE_FORBIDDEN` | 403 | Admin tentou excluir a si mesmo. |
  | `LAST_ADMIN_FORBIDDEN` | 403 | Tentativa de excluir o último admin ativo. |
  | `USER_HAS_REFERENCES` | 409 | Existem registros vinculados no banco (FK em outra tabela). Remova os vínculos antes de excluir. Auth não foi tocado. |
  | `AUTH_DELETE_FAILED` | 500 | Auth delete falhou; perfil foi restaurado. |
  | `COMPENSATION_FAILED` | 500 | Auth delete falhou **e** a reinserção do perfil também falhou. Requer ação manual. |
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
  versionado no client. Esta função valida o chamador **server-side**.
* Validação de admin é **server-side**: a função extrai o `auth.uid()`
  do JWT no header `Authorization` e consulta `public.usuarios` para
  exigir `tipo = 'admin' AND ativo IS TRUE`.
* RLS não substitui essa validação. A função usa `service_role`, que
  ignora RLS; a checagem explícita é obrigatória.
* Logs nunca devem conter `password`, `service_role`, JWT, ou a
  `SUPABASE_SERVICE_ROLE_KEY`.

## Bloqueios server-side

* **Autoexclusão** (`SELF_DELETE_FORBIDDEN`): se
  `target_user_id === caller_user_id`, a função recusa antes de tocar
  no banco.
* **Último admin** (`LAST_ADMIN_FORBIDDEN`): se o alvo é `admin` e é o
  único `admin` com `ativo = true`, a função recusa. Isso garante que
  sempre haja pelo menos 1 admin operacional.
* **Confirmação por e-mail** (`CONFIRM_EMAIL_MISMATCH`): o
  `confirm_email` enviado deve ser igual ao e-mail do usuário alvo
  (case-insensitive). Isso previne clique acidental.
* **Validação de UUID**: `user_id` é validado por regex antes de
  qualquer operação de banco.

## Hard delete + compensação (sem soft delete)

A ordem de operações é:

1. Validar JWT e exigir admin ativo (chamador).
2. Validar payload (`user_id` UUID, `confirm_email` formato, normalizado).
3. Bloquear autoexclusão.
4. Buscar perfil alvo em `public.usuarios`.
5. Exigir `confirm_email` igual ao email do alvo.
6. Se alvo for admin, contar admins ativos. Se ≤ 1, recusar.
7. Remover `public.usuarios` (`DELETE FROM public.usuarios WHERE id = $1`).
   - Se falhar por FK/referência em outra tabela → `USER_HAS_REFERENCES`
     (Auth intocado).
8. Chamar `auth.admin.deleteUser(target_id)`.
9. Se Auth delete falhar: tentar compensação (reinserir perfil com
   dados originais). Se a reinserção funcionar, retornar
   `AUTH_DELETE_FAILED`. Se falhar, `COMPENSATION_FAILED` (requer
   ação manual).
10. Retornar `200 { ok: true, deleted: true, user_id, email }`.

**Esta função NÃO usa** `updateUserById`, `ban_duration`, `soft
delete`, nem `auth.admin.deleteUser` apenas como compensação de
criação (caso da `admin-create-user`). Ela usa `deleteUser` como
operação primária e intencional.

## Deploy

```bash
# Referência — executado SOMENTE em ambiente paralelo ucrjtfswnfdlxwtmxnoo
supabase functions deploy admin-delete-user --project-ref ucrjtfswnfdlxwtmxnoo
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref ucrjtfswnfdlxwtmxnoo
supabase secrets set SUPABASE_URL=... --project-ref ucrjtfswnfdlxwtmxnoo
supabase secrets set SUPABASE_ANON_KEY=... --project-ref ucrjtfswnfdlxwtmxnoo
```

**NÃO** deployar em `bhgifjrfagkzubpyqpew` (legacy prod). Esta função
só é deployada em `ucrjtfswnfdlxwtmxnoo` (paralelo de trabalho).

## Validação esperada em staging (ucrjtfswnfdlxwtmxnoo)

Após o deploy, a validação inclui:

* Admin ativo exclui fornecedor descartável via UI →
  `admin-delete-user` retorna `200 { ok: true, deleted: true, ... }`.
* `public.usuarios` do alvo não existe mais.
* `auth.users` do alvo não existe mais (ou está banido, conforme
  comportamento padrão de `deleteUser`).
* Login do alvo não é mais possível.
* Reexcluir → `404 NOT_FOUND`.
* Autoexclusão (admin tenta excluir a si mesmo) → `403 SELF_DELETE_FORBIDDEN`.
* Último admin (único admin) → `403 LAST_ADMIN_FORBIDDEN`.
* `confirm_email` errado → `400 CONFIRM_EMAIL_MISMATCH`.
* Usuário com referências em outras tabelas → `409 USER_HAS_REFERENCES`
  (perfil permanece, Auth intocado).

## Exemplo de payload (sem dados sensíveis)

```json
{
  "user_id": "00000000-0000-0000-0000-000000000000",
  "confirm_email": "fornecedor.descartavel@exemplo.com"
}
```
