# `admin-reset-user-password` — Supabase Edge Function

## Objetivo

Resetar a senha de um usuário-alvo para uma senha temporária gerada
aleatoriamente (via `crypto.getRandomValues`, nunca valor fixo), via
`auth.admin.updateUserById(target_id, { password })`. Em sucesso, marca
`public.usuarios.senha_temporaria=true` / `senha_gerada_em=now()` no
perfil alvo — o usuário verá o gate de troca obrigatória (`A4.2`) no
próximo login. Chamada pelo app admin via
`supabase.functions.invoke('admin-reset-user-password', payload)`.

Contrato completo: `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`
(subfase `A5.1-A5.2`).

## Contrato

* **Método:** `POST` (aceita `OPTIONS` para preflight CORS).
* **Header:** `Authorization: Bearer <jwt-do-admin>`.
* **Body (JSON):**

  ```json
  {
    "user_id": "<uuid-do-usuario-alvo>"
  }
  ```

* **Sucesso** (`200`):

  ```json
  {
    "data": {
      "user_id": "<uuid>",
      "email": "usuario@exemplo.com",
      "tipo": "fornecedor",
      "password": "[REDACTED_TEMPORARY_PASSWORD]",
      "senha_temporaria": true
    }
  }
  ```

  A senha é retornada **uma única vez**, nesta resposta. O front deve
  exibi-la uma vez (modal com botão copiar) e nunca persisti-la ou
  logá-la.

* **Erro** (códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `SELF_RESET_FORBIDDEN`, `NOT_FOUND`, `AUTH_RESET_FAILED`,
  `PROFILE_UPDATE_FAILED`, `UNKNOWN`):

  ```json
  {
    "error": { "code": "FORBIDDEN", "message": "Apenas admins ativos podem resetar senha de usuários." }
  }
  ```

## Guardas

* **Auto-reset bloqueado (`SELF_RESET_FORBIDDEN`):** um admin não pode
  resetar a própria senha por esta função — usa o fluxo normal de
  troca de senha (self-service, `A4.2`). Decisão explícita do
  arquiteto: simplifica e evita o footgun de um admin trocar a própria
  senha por um valor que ele mesmo não escolheu.
* **Chamador precisa ser admin ATIVO** (`tipo='admin' AND ativo=true`
  em `public.usuarios`), verificado server-side — não confia no
  payload do front.
* Não há guarda de "último admin" (diferente de `admin-disable-user`)
  — resetar senha não desativa ninguém, não há risco de o sistema
  ficar sem admin.

## Régua de senha

Mesma régua de `A4.1` (`db/58_admin_usuarios_senha_temporaria.sql` +
`admin-create-user`): mínimo 8 caracteres, ao menos 1 dígito. A senha é
gerada aleatoriamente (12 caracteres, charset sem ambiguidade visual
`0`/`O`, `1`/`l`/`I`, via `crypto.getRandomValues` — nunca
`Math.random`, nunca valor fixo/por-papel). Garantia determinística de
ao menos 1 dígito, não apenas probabilística.

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
* A função valida que o chamador é `admin` ativo consultando
  `public.usuarios` server-side.
* **Logs nunca contêm a senha gerada** — em qualquer branch de erro,
  apenas `user_id`/mensagem de erro são logados via `console.error`.
* A senha é retornada uma única vez, na resposta HTTP de sucesso. O
  front não deve persisti-la em `localStorage`, histórico, nem
  reexibi-la após o fechamento do modal.

## Estado parcial (sem compensação segura)

O reset toca `auth.admin.updateUserById` **antes** do update em
`public.usuarios`. Se o reset no Auth tiver sucesso mas o update do
perfil falhar (`PROFILE_UPDATE_FAILED`), a senha antiga já não é mais
válida e não há como recuperá-la ou revertê-la com segurança — a
função retorna erro explícito (nunca sucesso silencioso) e orienta a
tentar o reset novamente (idempotente: cada chamada gera uma senha nova
e independente do estado anterior).

## Deploy (apenas referência — não executar nesta fase)

```bash
supabase functions deploy admin-reset-user-password --project-ref <staging-ref>
```

As secrets (`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`/
`SUPABASE_ANON_KEY`) já estão configuradas em staging pelas fases
anteriores (`admin-create-user`/`admin-disable-user`/`admin-delete-user`
compartilham o mesmo projeto).

Deploy controlado **pelo arquiteto** — fora do alcance de
credenciais/ferramentas desta sessão (agente IA não entra senha/
token/API key em nenhum campo, regra permanente).

## Exemplo de payload

```json
{
  "user_id": "11111111-2222-3333-4444-555555555555"
}
```
