# Design: Supabase Auth User Provisioning

**Fase:** `RAVATEX-TAPETES-AUTH-EDGE-DESIGN-A`  
**Escopo:** docs-only / design-only — sem implementação de Edge Function, sem alteração funcional no app, sem SQL/deploy.  
**Data:** 2026-06-23  
**HEAD de referência:** `88aa4fb`

---

## 1. Contexto e problema

O app **Ravatex Controle de Tapetes** usa duas entidades distintas para identidade:

* **Supabase Auth (`auth.users`)** — autenticação por e-mail/senha, emite JWT.
* **`public.usuarios`** — perfil do app, com campos de domínio (`nome`, `tipo`, `fornecedor_id`).

O vínculo operacional é:

```text
auth.users.id = public.usuarios.id
```

`js/auth.js :: loadCurrentUser()` faz exatamente isso: pega a sessão do Auth, lê `public.usuarios` pelo `session.user.id` e preenche `CURRENT_USER`. Se o perfil não existir, `loadCurrentUser()` retorna `null`, o boot interpreta como "não logado" e o usuário volta para `#/login` — mesmo com login Auth válido. Esse comportamento já ocorreu em staging.

A tela atual `#/cadastros/usuarios` (`screenCadastrosUsuarios` em `js/screens/cadastros.js`) só insere/atualiza `public.usuarios`. O fluxo operacional vigente exige:

1. Criar o usuário manualmente no Supabase Studio (`auth.users`).
2. Copiar o UID gerado.
3. Voltar ao app.
4. Colar o UID na tela de usuários e completar `public.usuarios`.

Isso é fonte de:

* **Inconsistência** — auth user sem perfil (órfão) ou perfil sem auth user.
* **Erro de UX** — login aparentemente correto, mas redirect para `#/login` por falta de perfil.
* **Risco operacional** — dependência de acesso ao Supabase Studio para cada novo usuário.

A solução alvo é uma **Supabase Edge Function server-side** chamada pelo app admin para criar `auth.users` e `public.usuarios` de forma controlada, sem expor `service_role` no browser.

---

## 2. Estado atual do app

### 2.1 Arquivos relevantes

* `js/auth.js` — `login`, `logout`, `loadCurrentUser`, `CURRENT_USER`, helpers `isAdmin`/`isFornecedor`.
* `js/screens/cadastros.js` — tela `screenCadastrosUsuarios` (linhas ~481–585).
* `js/config.js` — URLs/anon keys públicos por ambiente; **não** contém `service_role`.
* `js/supabase-client.js` — client anon + write-guard; **não** contém `service_role`.
* `js/boot.js` / `js/router.js` — redirecionam com base em `CURRENT_USER`.
* `db/01_schema.sql` — `usuarios.id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
* `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
* `db/03_policies.sql` — RLS: admin vê/tudo em `usuarios`; usuário comum vê só o próprio.

### 2.2 Fluxo atual de `screenCadastrosUsuarios`

1. **Listagem** — `SELECT id, email, nome, tipo, fornecedor_id` em `public.usuarios` com join em `fornecedores`, ordenado por e-mail.
2. **Modal de criação** — exige `id` (UID do Auth), `email`, `nome`, `tipo`, `fornecedor_id`.
   * O campo `id` é desabilitado na edição.
   * Validações: `id`, `email`, `nome`, `tipo` obrigatórios; `fornecedor_id` obrigatório quando `tipo = 'fornecedor'`.
   * Inserção direta: `supa.from('usuarios').insert(payload)`.
   * Erros comuns mapeados: `duplicate` → "UID ou e-mail já cadastrado"; `foreign key` → "UID não existe no Supabase Auth — crie lá primeiro".
3. **Edição** — atualiza `email`, `nome`, `tipo`, `fornecedor_id` pelo `id`.
4. **Exclusão** — remove só de `public.usuarios`; mensagem informa que o cadastro no Auth **não** é removido.

### 2.3 Tipos aceitos

* `tipo` limitado a `admin` ou `fornecedor`.
* `fornecedor_id` deve existir em `public.fornecedores` quando `tipo = 'fornecedor'`.
* `fornecedor_id` deve ser `null` quando `tipo = 'admin'`.

### 2.4 Dependências de `CURRENT_USER`

* `CURRENT_USER.tipo` decide acesso às rotas admin/fornecedor.
* `CURRENT_USER.fornecedor_tipo` (cacheado de `fornecedores.tipo`) direciona fornecedores para `ordens`, `entregas` ou `latex`.

---

## 3. Arquitetura alvo

### 3.1 Edge Function sugerida

| Atributo | Valor |
|---|---|
| Nome | `admin-create-user` |
| Tecnologia | Supabase Edge Function (Deno) |
| Localização futura | `supabase/functions/admin-create-user/index.ts` |
| Segredo | `SUPABASE_SERVICE_ROLE_KEY` via variável de ambiente da Edge Function |
| Cliente interno | `@supabase/supabase-js` construído com `service_role` **somente** dentro da Edge Function |

### 3.2 Responsabilidade

Criar, de forma atômica e com compensação, um usuário em Supabase Auth e o perfil correspondente em `public.usuarios`.

### 3.3 Fluxo de execução

```text
1. Front-end admin chama supabase.functions.invoke('admin-create-user', payload)
2. Edge Function recebe o JWT do chamador no header Authorization
3. Extrai auth.uid() do JWT
4. Consulta public.usuarios e exige tipo = 'admin'
5. Valida payload (email, password, nome, tipo, fornecedor_id)
6. Normaliza email para lower-case
7. Verifica se fornecedor_id existe em public.fornecedores quando tipo = 'fornecedor'
8. Cria auth user via admin API (service_role server-side)
9. Insere public.usuarios com id = authUser.id retornado
10. Se insert falhar, compensa removendo o auth user recém-criado
11. Retorna sucesso ou erro controlado
```

### 3.4 Propriedades desejadas

* **Idempotência parcial:** se o e-mail já existir em `auth.users`, retornar `409 CONFLICT` sem criar duplicata.
* **Compensação:** nunca deixar auth user órfão sem tentativa de remoção.
* **Segurança:** `service_role` nunca transita pelo browser; validação de admin é server-side.

---

## 4. Contrato de entrada

### 4.1 Payload

```json
{
  "email": "usuario@exemplo.com",
  "password": "senha-inicial-ou-temporaria",
  "nome": "Nome do usuário",
  "tipo": "admin" | "fornecedor",
  "fornecedor_id": 123 | null
}
```

### 4.2 Regras de validação

| Campo | Regra |
|---|---|
| `email` | Obrigatório; normalizado para lower-case; deve ser formato de e-mail válido. |
| `password` | Obrigatório na primeira versão; mínimo de caracteres conforme configuração do projeto (padrão: 6). |
| `nome` | Obrigatório; trimmed; não vazio. |
| `tipo` | Obrigatório; apenas `admin` ou `fornecedor`. |
| `fornecedor_id` | Deve ser `null` quando `tipo = 'admin'`. |
| `fornecedor_id` | Obrigatório quando `tipo = 'fornecedor'` e deve existir em `public.fornecedores`. |

### 4.3 Recomendação futura

A fase de UI (`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`) pode optar por:

* senha temporária digitada pelo admin, ou
* invite/magic-link (sem `password` no payload).

Este design assume a **versão com senha temporária** por simplicidade e menor dependência de configuração de SMTP.

---

## 5. Contrato de saída

### 5.1 Sucesso

HTTP `200 OK` ou `201 Created`.

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

### 5.2 Erro

```json
{
  "error": {
    "code": "FORBIDDEN" | "VALIDATION_ERROR" | "AUTH_CREATE_FAILED" | "PROFILE_INSERT_FAILED" | "COMPENSATION_FAILED" | "UNKNOWN",
    "message": "mensagem segura para UI"
  }
}
```

### 5.3 Restrições de resposta

* Nunca retornar `service_role`, JWT secrets, stack traces, SQL internals.
* Mensagens devem ser seguras para exibição na UI.

---

## 6. Códigos HTTP sugeridos

| Cenário | HTTP |
|---|---|
| Sucesso | `200 OK` ou `201 Created` |
| Payload inválido | `400 Bad Request` |
| JWT ausente/inválido | `401 Unauthorized` |
| Chamador não é admin | `403 Forbidden` |
| E-mail já existe em `auth.users` ou conflito em `public.usuarios` | `409 Conflict` |
| Erro interno / falha de compensação | `500 Internal Server Error` |

---

## 7. Segurança

### 7.1 Onde o `service_role` pode viver

* ✅ Variável de ambiente da Edge Function (`SUPABASE_SERVICE_ROLE_KEY`).
* ❌ Nunca em `js/config.js`.
* ❌ Nunca em `index.html`.
* ❌ Nunca em `localStorage` / `sessionStorage`.
* ❌ Nunca no front-end de qualquer forma.
* ❌ Nunca em relatórios, logs ou docs versionados.

### 7.2 Validação de permissões

* A Edge Function **deve** validar o chamador extraindo `auth.uid()` do JWT e consultando `public.usuarios`.
* Exigir `tipo = 'admin'`.
* O front-end não é fonte de confiança para a flag de admin.

### 7.3 RLS

* As políticas RLS existentes continuam válidas, mas **não substituem** a validação da Edge Function.
* A Edge Function, quando usa `service_role`, ignora RLS; por isso a checagem explícita de admin é obrigatória.

### 7.4 Logs e senhas

* Logs da Edge Function não devem conter `password`.
* Senhas temporárias não devem ser registradas em docs/relatórios.
* Recomenda-se forçar troca de senha no primeiro login (flag `email_confirm` + orientação futura).

---

## 8. Estratégia de compensação

### 8.1 Cenário: auth user criado, mas insert em `public.usuarios` falha

1. Tentar `admin.deleteUser(user_id)`.
2. Se `deleteUser` retornar sucesso → retornar erro `PROFILE_INSERT_FAILED`.
3. Se `deleteUser` falhar → retornar erro `COMPENSATION_FAILED`.
   * Incluir `user_id` na resposta para ação manual.
   * Registrar log interno (sem senha) alertando sobre órfão.

### 8.2 Cenário: e-mail já existe em `auth.users`

* Retornar `409 CONFLICT` com mensagem "E-mail já cadastrado".
* Não criar nada.

### 8.3 Cenário: `public.usuarios` já tem e-mail duplicado

* O insert em `public.usuarios` falhará por `UNIQUE` constraint.
* Acionar compensação (8.1).

### 8.4 Cenário: `fornecedor_id` inválido

* Falha na validação antes de tocar no Auth → `400 VALIDATION_ERROR`.

### 8.5 Princípio geral

* Nunca deixar sucesso parcial silencioso.
* Se compensação automática falhar, a resposta deve deixar claro que há um auth user órfão a ser corrigido manualmente.

---

## 9. Impacto na UI

### 9.1 Hoje (`screenCadastrosUsuarios`)

* Botão "+ Vincular usuário".
* Modal exige UID do Auth.
* Banner orienta criar usuário no Supabase Studio primeiro.
* App faz `INSERT` direto em `public.usuarios`.

### 9.2 Depois (fase `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`)

* Botão "+ Novo usuário".
* Modal não pede UID; pede:
  * E-mail
  * Nome
  * Tipo (`admin` / `fornecedor`)
  * Fornecedor (quando tipo = `fornecedor`)
  * Senha temporária (ou opção de convite, se decidido)
* Ao salvar, chama:

```js
const { data, error } = await window.supa.functions.invoke('admin-create-user', {
  body: { email, password, nome, tipo, fornecedor_id }
});
```

* Em sucesso:
  * Toast "Usuário criado".
  * Recarrega lista.
* Em erro:
  * Toast com `error.message` amigável.
  * Não expõe detalhes internos.

### 9.3 Edição

* Edição de perfil (`email`, `nome`, `tipo`, `fornecedor_id`) pode continuar via `public.usuarios` diretamente, com as mesmas validações atuais.
* Alteração de senha e e-mail no Auth ficam fora do escopo desta fase.

### 9.4 Exclusão

* Fora do escopo desta fase.
* Decisão pendente: remover só `public.usuarios` ou também `auth.users`.
* Possível fase futura: `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`.

---

## 10. Alternativas rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| Trigger cego em `auth.users` que insere `public.usuarios` | Não resolve quem define `tipo` e `fornecedor_id`; criaria perfis incompletos/órfãos com dados errados. |
| Self-healing no front que cria perfil automaticamente se ausente | Quebra a regra arquitetural de não mascarar ausência de perfil; expõe lógica sensível no cliente. |
| `service_role` no front | Violação grave de segurança; permitiria qualquer usuário criar admins. |
| Criação manual permanente como fluxo final | Fonte de inconsistência; não escala; depende de acesso ao Supabase Studio. |
| Criar todo usuário como `admin` por padrão | Violação de princípio de menor privilégio; requer correção manual posterior. |

---

## 11. Fases futuras propostas

### 11.1 `RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`

* Criar estrutura `supabase/functions/admin-create-user/`.
* Implementar a Edge Function conforme este design.
* Testes estáticos / smoke locais.
* Instruções de deploy em staging.
* **Sem UI ainda.**

### 11.2 `RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`

* Deploy manual/controlado no Supabase staging.
* Validar secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
* Validar chamada com usuário admin → sucesso.
* Validar bloqueio com usuário fornecedor → `403 FORBIDDEN`.

### 11.3 `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`

* Adaptar `screenCadastrosUsuarios`:
  * Trocar fluxo "vincular UID" por "criar usuário".
  * Remover campo UID do modal de criação.
  * Adicionar campo senha temporária.
  * Chamar `supabase.functions.invoke('admin-create-user')`.
* Manter listagem e edição.
* Adicionar smoke tests.

### 11.4 `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`

* Documentar operação final para admins.
* Runbook de criação de usuário.

### 11.5 Opcional: `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`

* Decidir se exclusão remove só `public.usuarios` ou também `auth.users`.
* Avaliar se deve ser feita por outra Edge Function.

---

## 12. Perguntas em aberto

Estas dúvidas precisam de decisão do HMNlead antes das fases de implementação:

1. **Senha temporária vs. convite/magic-link:** o admin digitará uma senha temporária ou prefere enviar invite por e-mail reset?
2. **`email_confirm`:** deve ser `true` na criação (usuário já pode logar) ou `false` (obriga confirmação de e-mail)?
3. **Troca de senha:** fornecedor poderá trocar a própria senha depois? (Hoje não há tela de "minha conta".)
4. **Exclusão:** ao excluir um usuário no app, deve remover também `auth.users` ou apenas `public.usuarios`?
5. **Produção:** produção terá os mesmos fornecedores/usuários de staging ou será reconfigurada do zero?
6. **Deploy da Edge Function:** será via Supabase CLI local, dashboard ou outro fluxo (CI/CD)?

---

## 13. Critérios de aceite do design

Este design só é considerado aceito se:

* [ ] Não expõe `service_role` no front.
* [ ] Mantém validação de admin server-side na Edge Function.
* [ ] Elimina a necessidade de copiar UID manualmente.
* [ ] Preserva `auth.users.id = public.usuarios.id`.
* [ ] Prevê compensação para sucesso parcial.
* [ ] Preserva a arquitetura modular do app (sem lógica de negócio no `index.html`).
* [ ] Define fases pequenas e sequenciais.
* [ ] Não implementa código, SQL, deploy ou criação de usuários nesta fase.

---

## 14. Referências

* `js/auth.js` — sessão, perfil e `loadCurrentUser`.
* `js/screens/cadastros.js` — `screenCadastrosUsuarios`.
* `js/config.js` / `js/supabase-client.js` — client anon, sem `service_role`.
* `js/boot.js` / `js/router.js` — redirecionamento baseado em `CURRENT_USER`.
* `db/01_schema.sql` — schema de `public.usuarios`.
* `db/02_functions.sql` — `is_admin()`, `meu_fornecedor_id()`.
* `db/03_policies.sql` — políticas RLS de `usuarios`.
* `docs/architecture/CODE_HEALTH_RULES.md` — regras de saúde arquitetural vigentes.
