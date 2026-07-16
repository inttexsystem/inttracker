# Auth User Provisioning Runbook

> Documento operacional atual. Descreve como criar usuários do
> **Ravatex Controle de Tapetes** de forma segura após a implantação
> da Edge Function `admin-create-user` e da nova UI em
> `#/cadastros/usuarios`.
>
> **Convenção:** o fluxo manual antigo (criar `auth.users` no Supabase
> Studio, copiar UID, vincular em `public.usuarios`) **não é mais o
> fluxo operacional padrão**. Este runbook substitui aquele procedimento.

---

## 1. Objetivo

Este runbook descreve o procedimento operacional padrão para criar
usuários do app — incluindo admins e fornecedores — garantindo que:

* o vínculo `auth.users.id = public.usuarios.id` seja criado de forma
  atômica;
* o admin não precise acessar o Supabase Studio para provisionar
  contas;
* `service_role` nunca trafegue pelo browser;
* validação de admin seja server-side, não client-side.

Aplicabilidade: **staging** e, após autorização explícita,
**produção**.

---

## 2. Arquitetura resumida

* **Supabase Auth (`auth.users`)** — guarda a conta de login (e-mail
  + senha, JWT). É a fonte da autenticação.
* **`public.usuarios`** — perfil de domínio do app, com
  `nome`, `tipo` (`admin` | `fornecedor`) e `fornecedor_id` quando
  aplicável. É a fonte da autorização e do roteamento por papel.
* **Vínculo obrigatório:** `auth.users.id = public.usuarios.id`.
  Sem perfil, o login Auth é considerado incompleto pelo app
  (`loadCurrentUser()` retorna `null` e o usuário volta para
  `#/login`).
* **Edge Function `admin-create-user`** — função server-side
  (Deno/TypeScript) implantada no Supabase. Cria, no mesmo fluxo
  controlado, o registro em `auth.users` (via `auth.admin.createUser`)
  e em `public.usuarios` (via `from('usuarios').insert(...)`). Se o
  insert do perfil falhar, executa compensação
  (`auth.admin.deleteUser`).
* **Princípio de segurança:** o **browser nunca recebe
  `service_role`**. O front-end apenas invoca a Edge Function via
  `supabase.functions.invoke('admin-create-user', { body })`. A
  `SUPABASE_SERVICE_ROLE_KEY` existe **apenas** como secret da Edge
  Function.

---

## 3. Fluxo operacional principal

**Pré-condição:** operador logado como `admin` no app.

1. Acessar `#/cadastros/usuarios`.
2. Clicar em **+ Novo usuário**.
3. Preencher o modal:
   * **E-mail** — será usado para login no Supabase Auth.
   * **Nome** — nome de exibição.
   * **Tipo** — `admin` ou `fornecedor`.
   * **Fornecedor (se tipo for "fornecedor")** — selecionar o
     fornecedor correspondente. Deixar vazio se o tipo for `admin`.
   * **Senha temporária** — mínimo 8 caracteres + ao menos 1 dígito
     (política vigente desde `A4.1`, `db/58_admin_usuarios_senha_temporaria.sql`).
     Definir conforme procedimento interno; ver seção 6.
4. Clicar em **Salvar**.
5. Aguardar o toast de sucesso (`Usuário criado`) e confirmar que o
   novo usuário aparece na listagem.

O app chama:

```js
const { data, error } = await window.supa.functions.invoke(
  'admin-create-user',
  { body: { email, password, nome, tipo, fornecedor_id } }
);
```

Em sucesso, a função retorna `{ data: { user_id, email, tipo,
fornecedor_id } }` e o modal fecha. Em erro, o modal permanece
aberto e o toast mostra a mensagem da função (ver seção 7).

---

## 4. Regras por tipo de usuário

### Admin
* `tipo = 'admin'`.
* `fornecedor_id` **deve** ser `null`. O modal envia `null`
  automaticamente quando o tipo é admin; o app bloqueia o envio
  se um fornecedor for selecionado.
* Não há amarração a fornecedor.

### Fornecedor
* `tipo = 'fornecedor'`.
* `fornecedor_id` **obrigatório** e deve existir em
  `public.fornecedores`.
* O fornecedor vinculado define as permissões de tela (ordens,
  entregas, látex) via `CURRENT_USER.fornecedor_tipo`.

---

## 5. O que **não** fazer

* **Não** criar usuário manualmente no Supabase Auth como fluxo
  padrão. O caminho manual existe apenas como contingência
  documentada em incidente, e o usuário criado deve ser migrado para
  o fluxo padrão imediatamente.
* **Não** copiar UID manualmente.
* **Não** inserir linha em `public.usuarios` sem auth user
  correspondente (origem de login Auth OK com redirect para
  `#/login`).
* **Não** colocar `service_role` no front-end, em `js/config.js`,
  `index.html`, `localStorage`, `sessionStorage` ou qualquer arquivo
  versionado.
* **Não** registrar senha temporária em chat, relatório, planilha
  ou documentação. Tratar como informação sensível.
* **Não** usar produção para testes. Staging é o ambiente de
  homologação.

---

## 6. Senha temporária

* A senha temporária é definida pelo admin no momento da criação
  (mínimo 8 caracteres + ao menos 1 dígito conforme a Edge Function,
  política vigente desde `A4.1`).
* Toda criação via `admin-create-user` marca o usuário com
  `usuarios.senha_temporaria = TRUE` e `usuarios.senha_gerada_em =
  now()` (`db/58_admin_usuarios_senha_temporaria.sql`). A troca
  obrigatória no primeiro login (guarda de boot + tela de troca,
  self-service `auth.updateUser`) é a subfase futura `A4.2` —
  **não implementada ainda**; a flag hoje só marca o estado, sem
  bloquear o app.
* **Não** registrar a senha em nenhum artefato versionado ou
  relatório.
* O procedimento de comunicação ao usuário e troca da senha é
  definido internamente pelo HMNlead (canal verbal, canal seguro,
  etc.). Este runbook **não** normatiza o canal.
* Não há, nesta fase, fluxo automatizado de convite por e-mail
  ("magic link" / password reset) implementado como padrão. A
  criação usa senha digitada pelo admin. A decisão entre
  senha-digitada vs. invite-link é uma pergunta em aberto do
  design (`docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`,
  seção 12); `A4.3` (convite por e-mail/SMTP) permanece `NOT
  AUTHORIZED`.
* Recomenda-se orientar o usuário a trocar a senha no primeiro
  login. O app **ainda não** força essa troca automaticamente —
  ver `A4.2` acima.

---

## 7. Mensagens de erro esperadas

A Edge Function retorna JSON padronizado:

```json
{ "error": { "code": "<CODE>", "message": "<mensagem segura>" } }
```

| Código | HTTP típico | Causa | Ação do operador |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Payload inválido (e-mail malformado, senha < 8 caracteres ou sem dígito, tipo não permitido, fornecedor inválido/inexistente, admin com fornecedor_id). | Corrigir os campos conforme mensagem e reenviar. |
| `UNAUTHORIZED` | 401 | Sessão expirada/ausente ou JWT inválido. | Pedir login novamente. |
| `FORBIDDEN` | 403 | Usuário logado **não** é `admin` em `public.usuarios`. | Confirmar que a conta logada é admin; se necessário, promover via outro admin. |
| `CONFLICT` | 409 | E-mail já cadastrado em `auth.users`. | Verificar se o usuário já existe; se for duplicata, não recriar. |
| `AUTH_CREATE_FAILED` | 500 | Falha interna do Auth (inesperada). | Acionar suporte técnico com log da chamada. |
| `PROFILE_INSERT_FAILED` | 500 | Auth user criado, mas insert em `public.usuarios` falhou; compensação automática removeu o auth user. | Tentar novamente; se persistir, acionar suporte. |
| `COMPENSATION_FAILED` | 500 | Auth user criado, perfil falhou, **e** `auth.admin.deleteUser` também falhou. Há auth user órfão. | Acionar suporte técnico imediatamente; o `user_id` está na mensagem. Limpar manualmente no Supabase Studio. |
| `UNKNOWN` | 500 | Erro não classificado. | Acionar suporte técnico. |

A UI mapeia os códigos mais prováveis para mensagens amigáveis em
`js/screens/cadastros.js` (ver helper de tratamento de erro do
`openModal` em `screenCadastrosUsuarios`).

---

## 8. Validação técnica read-only

Após uma criação, o operador/admin pode validar o vínculo executando
o seguinte SQL **read-only** no SQL Editor do projeto Supabase
(staging ou produção conforme contexto), substituindo `<EMAIL_DO_USUARIO>`
pelo e-mail real:

```sql
select
  au.id as auth_id,
  au.email as auth_email,
  pu.id as perfil_id,
  pu.email as perfil_email,
  pu.nome,
  pu.tipo,
  pu.fornecedor_id,
  case
    when pu.id is null then 'SEM_PERFIL'
    when au.id = pu.id then 'OK_AUTH_ID_IGUAL_PERFIL_ID'
    else 'ID_DIVERGENTE'
  end as status_vinculo
from auth.users au
left join public.usuarios pu
  on pu.id = au.id
where au.email = '<EMAIL_DO_USUARIO>';
```

**Esperado:** `status_vinculo = OK_AUTH_ID_IGUAL_PERFIL_ID`.

* `SEM_PERFIL` indica inconsistência crítica (login Auth sem
  perfil): o usuário conseguirá autenticar mas o app o redirecionará
  para `#/login`. Acionar suporte.
* `ID_DIVERGENTE` indica divergência de UUID entre Auth e perfil;
  inconsistência grave. Acionar suporte.

---

## 9. Limpeza de usuário de teste

Para testes descartáveis em **staging**:

1. Apagar o usuário no **Supabase Dashboard** → projeto staging
   (`ucrjtfswnfdlxwtmxnoo`) → **Authentication** → **Users** →
   localizar pelo e-mail → **Delete user**.
   * A constraint `public.usuarios.id REFERENCES auth.users(id) ON
     DELETE CASCADE` remove o perfil automaticamente.
2. Validar a limpeza com SQL **read-only**:

   ```sql
   select count(*) as auth_restante
   from auth.users
   where email = '<EMAIL_TESTE>';
   ```

   ```sql
   select count(*) as perfil_restante
   from public.usuarios
   where email = '<EMAIL_TESTE>';
   ```

   **Esperado:** `auth_restante = 0` **e** `perfil_restante = 0`.

> **Este runbook não instrui `DELETE` SQL direto em `auth.users` ou
> `public.usuarios` como procedimento padrão.** A exclusão pelo
> Dashboard é o caminho recomendado; `DELETE` SQL deve ser usado
> apenas por suporte técnico em incidente.

---

## 10. Troubleshooting de cache / UI antiga

**Incidente observado:** um perfil de navegador continuou mostrando a
UI antiga (botão "Vincular usuário" e campo UID) enquanto outro
perfil mostrava a UI nova ("+ Novo usuário") corretamente. Causa
mais provável: cache de assets (`cadastros.js` antigo), `localStorage`
ou Service Worker de uma versão anterior.

### Procedimento de diagnóstico

1. **Hard refresh com cache desabilitado:**
   * DevTools aberto (F12) → aba **Network** → marcar **Disable
     cache**.
   * `Ctrl + F5` (ou `Ctrl + Shift + R`).

2. **Limpar storage do site:**
   * DevTools → **Application** → **Storage** → **Clear site data**.

3. **Confirmar a versão servida de `cadastros.js`:**
   No console do navegador:

   ```js
   await fetch('/js/screens/cadastros.js?v=debug-' + Date.now())
     .then(r => r.text())
     .then(t => ({
       temEdgeFunction: t.includes("admin-create-user"),
       temNovoUsuario:  t.includes("Novo usuário"),
       temVincular:     t.includes("Vincular"),
       temUid:          t.includes("UID")
     }));
   ```

   **Esperado:** `{ temEdgeFunction: true, temNovoUsuario: true,
   temVincular: false, temUid: false }`.

   * Se `temVincular: true` ou `temUid: true`, o asset servido é a
     versão antiga. Repetir o hard refresh / clear storage; se
     persistir, acionar suporte técnico (pode ser proxy/CDN com
     cache agressivo).
   * Se `temEdgeFunction: false`, o `cadastros.js` atual não contém
     a chamada à Edge Function — confirmar que a fase
     `RAVATEX-TAPETES-AUTH-ADMIN-UI-A` foi deployada.

4. **Confirmar que o app está apontando para o ambiente correto:**
   * Banner de ambiente deve indicar `STAGING` ou `PRODUÇÃO` conforme
     o esperado. Em caso de divergência, revisar `js/config.js`
     (apenas leitura) e a flag de ambiente.

---

## 11. Segurança e limites

* **Validação de admin é server-side.** A Edge Function consulta
  `public.usuarios` e exige `tipo = 'admin'` independentemente do
  que o front-end envia.
* **Teste de bloqueio (fornecedor) foi executado** e está
  documentado: tentativa de chamada por usuário `fornecedor`
  autenticado retornou `403 Forbidden`. O comportamento está
  coberto pelos testes estáticos em `tests/cadastros-usuarios-auth-ui.smoke.js`
  e pela Edge Function.
* **RLS não substitui a validação da Edge Function.** A RLS continua
  ativa e relevante para reads/writes diretos do app, mas a criação
  de usuários via `service_role` ignora RLS — daí a checagem
  explícita de admin ser obrigatória.
* **Logs e segredos.** Logs da Edge Function **não devem** conter
  `password`, `service_role` ou JWTs. Senhas temporárias **não**
  devem aparecer em logs, relatórios, chat, planilhas ou docs
  versionados.
* **`service_role` é secret da Edge Function**, configurado via
  Supabase Secrets. Não é e nunca deve ser lido pelo front-end.

---

## 12. Pendências futuras

* **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** — decidir se a
  exclusão de usuários pelo app deve remover só `public.usuarios`
  ou também `auth.users`, e se isso deve ser feito por outra Edge
  Function. **Não implementado** nesta fase.
* **Convite/reset por e-mail** — decidir entre senha digitada pelo
  admin (atual) e fluxo de invite/magic-link. Pergunta em aberto no
  design (seção 12 do `AUTH_PROVISIONING_EDGE_DESIGN.md`).
* **Tailwind CDN warning** — pendência técnica separada, não
  relacionada ao Auth provisioning.
* **Favicon 404** — pendência cosmética separada.
* **Teste em produção** — exige autorização própria e plano de
  release; este runbook cobre o procedimento, mas a promoção para
  produção depende de aprovação do HMNlead.

---

## 13. Histórico de validação (sanitizado)

* **Edge Function `admin-create-user` implantada no Supabase
  staging** (`ucrjtfswnfdlxwtmxnoo`).
* **Função ACTIVE, versão 1.**
* Chamada sem `Authorization` → `401` confirmado.
* Chamada com payload inválido (admin com `fornecedor_id`) →
  `400 VALIDATION_ERROR` confirmado.
* Criação real via função (admin) → `201` confirmado.
* **E2E UI em staging aprovado:** criação de fornecedor descartável
  via `+ Novo usuário` confirmada; `auth.users.id =
  public.usuarios.id` confirmado por SQL read-only; usuário teste
  removido via Supabase Dashboard; pós-limpeza `auth_restante = 0`
  e `perfil_restante = 0`.
* **Bloqueio de fornecedor:** tentativa de chamada por usuário
  fornecedor autenticado retornou `403 Forbidden` conforme esperado.
* **Logs verificados** sem `password`, sem `service_role`, sem JWTs.
* Senha temporária **não** foi registrada em nenhum artefato.
* Nenhuma alteração de `db/**`, RLS, policies ou front-end foi
  necessária para esta fase.
