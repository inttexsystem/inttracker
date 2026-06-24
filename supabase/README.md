# `supabase/`

Diretório versionado das Supabase Edge Functions do projeto
Ravatex Controle de Tapetes.

> As funções aqui **não estão deployadas** automaticamente. O
> deploy é manual e controlado, em fase própria
> (`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`).

## Funções

| Função | Descrição |
|---|---|
| `admin-create-user` | Cria `auth.users` + perfil `public.usuarios` de forma atômica/compensada, chamada pelo app admin. |

Ver `supabase/functions/admin-create-user/README.md` para o contrato
completo e `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md` para
o design.

## Segredos

Nenhum segredo é versionado. `SUPABASE_SERVICE_ROLE_KEY` e demais
variáveis sensíveis são configurados via `supabase secrets` no
ambiente Supabase (staging/produção).
