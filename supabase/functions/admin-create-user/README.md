# `admin-create-user` — Supabase Edge Function

## Objetivo

Criar, de forma atômica e compensada, um usuário em Supabase Auth
(`auth.users`) e o perfil correspondente em `public.usuarios`.
Chamada pelo app admin via `supabase.functions.invoke('admin-create-user', payload)`.

Contrato completo: `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`.

## Contrato

* **Método:** `POST` (aceita `OPTIONS` para preflight CORS).
* **Header:** `Authorization: Bearer <jwt-do-admin>`.
* **Body (JSON):**

  ```json
  {
    "email": "usuario@exemplo.com",
    "password": "[REDACTED_TEMPORARY_PASSWORD]",
    "nome": "Nome do usuário",
    "tipo": "admin" | "fornecedor",
    "fornecedor_id": 123 | null
  }
  ```

* **Sucesso** (`200` ou `201`):

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

* **Erro** (códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `AUTH_CREATE_FAILED`, `PROFILE_INSERT_FAILED`, `COMPENSATION_FAILED`,
  `CONFLICT`, `UNKNOWN`):

  ```json
  {
    "error": { "code": "FORBIDDEN", "message": "Apenas admins podem criar usuários." }
  }
  ```

## Variáveis de ambiente esperadas

Configuradas via `supabase secrets` (nunca versionadas):

| Nome | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Anon key pública. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (secret; usada **somente** server-side). |

## Segurança

* `service_role` nunca deve aparecer no front-end, em `js/config.js`,
  `index.html`, `localStorage` ou em qualquer arquivo versionado.
* A função valida que o chamador é `admin` consultando
  `public.usuarios` server-side (não confia no payload do front).
* Logs nunca devem conter `password`.
* Senhas temporárias não devem ser registradas em docs/relatórios.

## Compensação

Se o insert em `public.usuarios` falhar após criar o `auth.users`, a
função tenta `auth.admin.deleteUser(user_id)`. Se a compensação
falhar, retorna `COMPENSATION_FAILED` com `user_id` na mensagem para
correção manual. Nunca há sucesso parcial silencioso.

## Deploy (apenas referência — não executar nesta fase)

```bash
supabase functions deploy admin-create-user --project-ref <staging-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref <staging-ref>
supabase secrets set SUPABASE_URL=... --project-ref <staging-ref>
supabase secrets set SUPABASE_ANON_KEY=... --project-ref <staging-ref>
```

O deploy controlado está previsto em
`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`.

## Exemplo de payload (sem senha real)

```json
{
  "email": "novo.usuario@exemplo.com",
  "password": "[REDACTED_TEMPORARY_PASSWORD]",
  "nome": "Novo Usuário",
  "tipo": "fornecedor",
  "fornecedor_id": 1
}
```
