# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras vinculantes em `docs/architecture/CODE_HEALTH_RULES.md`.
> Índice de fontes canônicas vs. legadas em
> `docs/DOCUMENTATION_INDEX.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B` (edição admin de itens
  existentes do Pedido entregue).
- **HEAD aceito atual:** `2d36077` (após push desta fase, o HEAD
  da fase C3C2B — "Add pedido admin existing items edit").
- **staging/main:** `2d36077` (será atualizado com o push desta fase).
- **Working tree:** limpo após commit.
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` — intocado
- **PR #2:** intocado
- **⚠️ NÃO CHAMAR `ucrjtfswnfdlxwtmxnoo` DE "PRODUÇÃO ORIGINAL".**
  É o ambiente paralelo. O app original online está em
  `bhgifjrfagkzubpyqpew` + Vercel e **não deve ser tocado**.
- **⚠️ NÃO TOCAR `bhgifjrfagkzubpyqpew`.**
- **⚠️ NÃO TOCAR Vercel original.**
- **Schema Pedidos** `db/13_pedidos_schema.sql` aplicado em
  `ucrjtfswnfdlxwtmxnoo`: tabelas `pedidos`, `pedido_itens`,
  `pedido_eventos` e `lotes.pedido_id` (nullable). RLS admin-only.
  Sem policy pública. Sem `pedidos.op_id`.
- **Frontend Pedidos entregue (C1 + C2 + C2-R1 + C3A + C3B +
  C3C1 + C3C2B):** listagem `#/pedidos`, formulário
  `#/pedidos/novo` (cria pedido + itens como `rascunho`),
  correção de bug do preview de cor (slot fixo +
  `updatePreview()`), detalhe read-only `#/pedidos/<uuid>`,
  ações reais RESTRITAS de status (C3B), **edição admin
  RESTRITA dos dados gerais** (C3C1, `#/pedidos/<uuid>/editar`)
  e **edição admin RESTRITA de itens existentes** (C3C2B,
  `#/pedidos/<uuid>/itens`). Helper `pedido-ui.js` com
  status, badges, preview de cor, e `isPedidoEditavel()`
  (`PEDIDO_STATUS_EDITAVEL = ['rascunho', 'recebido']`).
  Na C3B, o detalhe aceita APENAS as transições:
  `rascunho→recebido`, `recebido→confirmado`,
  `rascunho/recebido/confirmado→cancelado` (este último via
  `window.confirmDialog`). Na C3C1, o botão "Editar dados"
  do detalhe é funcional APENAS para status editáveis e
  navega para a tela de edição de dados gerais; a tela
  atualiza APENAS `cliente_id`, `prazo_entrega` e
  `observacao`. Na C3C2B, o botão "Editar itens" do
  detalhe é funcional APENAS para status editáveis e
  navega para a tela de edição de itens; a tela atualiza
  APENAS `modelo_id`, `metros` e `observacao` de itens
  JÁ EXISTENTES (sem add/remove/reordenar, sem overrides
  de largura/cor). Update é APENAS em `pedidos` (C3C1) ou
  em `pedido_itens` (C3C2B), admin-only via RLS. Sem
  insert/update/delete em `pedido_itens` (exceto pelo update
  restrito da C3C2B), sem insert em `pedido_eventos`
  (best-effort fica para fase futura), sem
  `functions.invoke`, sem `token_acesso`, sem
  `service_role`, sem rota pública, sem schema, sem OP, sem
  Edge Function, sem fornecedor.

## Estado operacional atual
- `index.html` está declarativo, sem script inline final, com
  cache-busting `?v=20260623-asset1` em 26 assets locais
  (23 originais + `js/screens/pedido-detail.js` adicionado em C3A).
- `js/boot.js` é o entrypoint oficial; respeita DOM ready
  (`startApp` aguarda `DOMContentLoaded` se
  `document.readyState === 'loading'`).
- `js/router.js` é engine genérica e não foi alterado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` —
  `replaceChildren null` foi eliminado após cache limpo.
- `js/screens/op-pdf.js` foi extraído de `op-nova.js` em
  `7f3c6da` (`RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A`).
- `run-local.bat` é o tooling local para servir o app em
  `http://localhost:8765/`.

## Decisão arquitetural vigente
**REFATORAÇÃO ARQUITETURAL CONGELADA.**

Próxima fase esperada é **homologação / release**, **não** nova
extração em `op-nova.js`. Em particular, **NÃO iniciar** novas fases
como `RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`,
`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A` ou
`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A` sem nova instrução
explícita do dono do projeto: o refactor está fechado e essas
sugestões são **opcionais** (vide `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
seção 9).

## Comandos de verificação (rodar antes de qualquer patch)

```bash
cd "D:\OneDrive\Programação\Ravatex\controle-tapetes"

git status --short
git branch --show-current
git rev-parse --short HEAD
git remote -v
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Abortar e revisar o escopo se:
- branch != `work/app-next`;
- HEAD não estiver em um commit da fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
  (commit "Record auth disable UI validation" no topo, ou
  commit imediatamente posterior a `2d750a5`);
- working tree não estiver limpo;
- `staging/main` não tiver sido atualizado para o commit
  desta fase closeout (antes do push era
  `2d750a5960236d5c28ff750126a69b3bba48a983`);
- `origin/main` != `1047181eba888242c6428de366cbd9fda2f1c72c`
  (qualquer mudança em `origin/main` é regressão grave).

## Regras (NÃO renegocia)

1. **Push autorizado somente para `staging`**, salvo ordem explícita
   futura. Nunca `git push origin` em `work/app-next:main`.
2. **Não tocar `origin/main` oficial.**
3. **Não tocar PR #2.**
4. **Não acessar Supabase real** em refactors/testes mockados. Toda
   validação de chain de Supabase usa `fakeSupa` em `vm.Context`.
5. **Não registrar** em relatório ou doc: `service_role`, senha,
   `JWT secret`, connection string com senha, anon key completa.
6. **Testes focados** por fase (`node --test <arquivo>.smoke.js`).
   Não rodar suíte completa por padrão.
7. **Fase docs-only**: só `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
   `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`,
   `docs/architecture/CODE_HEALTH_RULES.md`,
   `docs/DOCUMENTATION_INDEX.md` e
   `docs/architecture/AUTH_DELETE_USER_DESIGN.md` podem ser
   criados/alterados. Qualquer diff fora desses 6 arquivos reprova.
8. **Não mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explícita.
9. **Não fazer docs + código na mesma fase.**
10. **Não iniciar nova extração em `op-nova.js`** (refactor
    congelado). Próxima ação é homologação/release, não refactor.

## Módulos principais e responsabilidades

### `boot.js` (RAVATEX-TAPETES-ROUTES-BOOT-MODULE-A + 87d4559)
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes` (15 rotas).
- Executa `main()` via `startApp()` (que aguarda `DOMContentLoaded`
  se `document.readyState === 'loading'`).
- Registra `hashchange` listener.
- Carrega usuário atual via `window.loadCurrentUser`.
- Direciona para `navigate('#/login')`, `handleRoute()` ou
  `routeAfterLogin()`.
- Captura erro de boot via `main().catch()` + `toast('Erro ao iniciar o app', 'error')`.

### `op-nova.js` (RAVATEX-TAPETES-SCREENNOVAOP-MODULE-A)
- `screenNovaOP` (closure inteira com `~20` subfunções aninhadas).
- UI/estado da Nova OP.
- Proposta, blocos de fios, tecelagem, wrappers de
  persistência/recálculo.
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- **NÃO** contém mais a função `gerarPdfCompraFios` (extraída em
  `7f3c6da`).
- Mantém read-only em Supabase (apenas `.select()`).
- Writes delegados: `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`.

### `op-pdf.js` (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A)
- `gerarPdfCompraFios({ op, ordens })` — helper puro, sem closure.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Exports: `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- Não toca Supabase, não muta DOM.

### `op-persistir.js` (RAVATEX-TAPETES-OP-PERSISTIR-MODULE-A)
- Helpers puros de persistência: `itensValidosOP`,
  `montarPayloadItensOP`, `montarPayloadFornecedoresOP`,
  `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` — executa 8 writes da persistência
  (ops, lotes, op_itens, op_fornecedores, ordens_compra_fio).
  Retorna envelope `{ error, step, partial, opId }`.

### `op-recalculo.js` (RAVATEX-TAPETES-OP-RECALCULO-MODULE-A)
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` — executa 4 writes do recálculo
  (`op_itens.update`, `saldo_fios_op.insert`, `saldo_fios`
  select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `ui.js` (87d4559 + e0dbfcd)
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`,
  `formField`, `dataTable`, `modal`, `confirmDialog`, `shellLayout`,
  `ADMIN_MENU`.
- `getAppRoot()` — lookup lazy do root `#app`.

## Próxima recomendação operacional

**Refactor arquitetural continua congelado.**
**Pedidos C1 + C2 + C2-R1 + C3A + C3B + C3C1 + C3C2B
entregues:** listagem `#/pedidos`, formulário
`#/pedidos/novo` (cria pedido + itens como `rascunho`),
correção de bug no preview de cor do item (slot fixo +
`updatePreview()` com `replaceChildren`), **detalhe
read-only** `#/pedidos/<uuid>` (`pedido-detail.js` com
`screenPedidoDetalhe`, `js/router.js` estendido com match
dinâmico `^#/pedidos/<uuid>$` admin-only, botão "Visualizar"
da listagem navegando para o detalhe), **ações reais
RESTRITAS de status** (C3B: `rascunho→recebido`,
`recebido→confirmado`, `rascunho/recebido/confirmado→cancelado`
via `window.confirmDialog`; demais status terminais),
**edição admin RESTRITA dos dados gerais** (C3C1, nova
tela `#pedidos/<uuid>/editar` com `pedido-edit.js`;
restringe `cliente_id`/`prazo_entrega`/`observacao`; status
editáveis apenas `rascunho` e `recebido` via
`isPedidoEditavel`; demais status desabilitam campos +
Salvar) e **edição admin RESTRITA de itens existentes**
(C3C2B, nova tela `#/pedidos/<uuid>/itens` com
`pedido-itens-edit.js`; restringe `modelo_id`/`metros`/
`observacao` de itens JÁ EXISTENTES; sem add/remove/reordenar,
sem overrides de largura/cor; demais status desabilitam
campos + Salvar). Update é APENAS em `pedidos` (C3C1) ou
em `pedido_itens` (C3C2B), admin-only via RLS. Sem
insert/update/delete em `pedido_itens` (exceto update
restrito da C3C2B), sem insert em `pedido_eventos`
(best-effort fica para fase futura), sem `functions.invoke`,
sem `token_acesso`, sem `service_role`, sem rota pública,
sem mutação em `lotes`/`pedido_eventos`, sem schema, sem
OP, sem Edge Function, sem fornecedor. Limitação
conhecida do formulário: sem RPC/transação atômica
(compensação manual documentada no código). Add/remove
itens fica para C3C2C.
**Próxima fase:** `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C`
(adicionar/remover itens + recálculo de `ordem` + mínimo
de 1 item), **somente com autorização explícita** do
HMNlead.
**Não iniciar execução sem autorização explícita.**
**NÃO tocar `bhgifjrfagkzubpyqpew`, Vercel original, ou `origin/main`.**

O ciclo de refactor arquitetural + hardening + extração final do
`op-pdf.js` está **congelado**. Antes de iniciar qualquer novo
trabalho:
- Validar a tela Nova OP em homologação staging.
- Confirmar que todos os fluxos de admin e fornecedor continuam
  funcionais.
- Decidir se a próxima publicação vai para `origin/main` (produção)
  ou se há ajustes pendentes.
- Tratar pendências Supabase / cadastro de usuário em fase própria,
  não dentro do refactor.

## Fases de implementação do design Auth (aprovadas para execução)

Design concluído em `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`.
Fases, em ordem:

1. **`RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`** — criar/implementar a
   Edge Function `admin-create-user` (sem UI ainda). **Concluída
   localmente (sem deploy).**
2. **`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`** — deploy controlado
   em staging e validação de permissões. **Concluída em staging.**
3. **`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`** — adaptar
   `screenCadastrosUsuarios` para chamar a Edge Function. **Concluída.**
4. **`RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`** — documentar operação
   final (runbook). **Concluída.**
5. **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** — decidir
   exclusão/desativação de usuários pelo app. **Concluída.**
   Recomendação: desativar (soft delete + ban Auth), não deletar.
   Design em `docs/architecture/AUTH_DELETE_USER_DESIGN.md`.
6. **`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`** — contenção
   imediata: remover `.from('usuarios').delete()` do front-end e
   substituir botão "Excluir vínculo" por placeholder "Em breve".
   **Concluída.** Nenhum write Supabase exposto; nenhum `auth.admin`
   no front; smoke tests 48/48 verdes.
7. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`** — schema
   versionado para desativação (colunas + recriação de funções e
   policies RLS em `public.usuarios`). **Concluída.** Migration em
   `db/12_auth_user_disable_schema.sql`; testes 20/20 em
   `tests/auth-disable-user-schema.smoke.js`. **Aplicada em staging**
   (ver item 8b).
8. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`** — aplicar
   a migration em staging. **Concluída como docs-only (commit
   `8fa924a`).** Orientação e validação local para aplicação em
   staging; smoke 20/20 e regressões 65/65 verdes; SQL limpo
   (sem DELETE/DROP/TRUNCATE/secrets). A execução real do SQL
   ficou pendente de HMNlead e foi registrada na fase 8b.
8b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`**
    *(esta fase, docs-only)* — registro da **aplicação real** de
    `db/12_auth_user_disable_schema.sql` no Supabase **staging**
    `ucrjtfswnfdlxwtmxnoo`, feita manualmente pelo HMNlead no
    SQL Editor do Dashboard. Evidências: 4 colunas novas em
    `public.usuarios`; funções `is_admin`/`meu_fornecedor_id`
    recriadas com checagem de `ativo`; policies
    `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update`
    recriadas; contagem `ativo = true, total = 3`,
    `auth_users_total = 3`, `public_usuarios_total = 3`,
    `auth_sem_perfil = 0`, `perfil_sem_auth = 0`. Nenhum usuário
    foi criado, excluído ou desativado. `db/10_reset_producao.sql`
    e `db/11_reset_ops.sql` não foram rodados. Produção
    `bhgifjrfagkzubpyqpew` não foi tocada. App validado
    manualmente em staging: login OK, `#/cadastros/usuarios`
    carrega, `+ Novo usuário` visível, exclusão insegura segue
    bloqueada como `Em breve`, sem erros críticos de Auth/RLS
    no console. Warnings não bloqueantes: Tailwind CDN,
    `favicon.ico` 404.
9. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`** — Edge Function
   `admin-disable-user` (soft delete no perfil + ban Auth).
   **Concluída localmente (sem deploy).** Implementação em
   `supabase/functions/admin-disable-user/index.ts` (mesmos
   `_shared/cors.ts` e `_shared/response.ts` de `admin-create-user`).
   Validações: JWT no header `Authorization` + `tipo = 'admin' AND
   ativo IS TRUE` em `public.usuarios` server-side; UUID regex
   para `user_id`; `reason` ≤ 500 chars (trim, opcional);
   `SELF_DISABLE_FORBIDDEN` quando `target_id === caller_id`;
   `LAST_ADMIN_FORBIDDEN` quando alvo é o único admin ativo;
   idempotência (`already_disabled: true`) se alvo já está inativo;
   soft delete via `.update({ ativo: false, desativado_em, desativado_por,
   motivo_desativacao })`; ban Auth via
   `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
   compensação (reverte `ativo = true` e limpa campos) se ban
   falhar; `COMPENSATION_FAILED` se a reversão também falhar.
   **Sem `auth.admin.deleteUser` e sem `.delete()`** — apenas soft
   delete. Smoke `tests/admin-disable-user.smoke.js` 39/39 verde.
   Regressões preservadas: `admin-create-user` 17/17,
   `auth-disable-user-schema` 20/20, `cadastros-usuarios-auth-ui`
   16/16, `cadastros-screens` 32/32. **Sem deploy nesta fase.**
   Deploy e validação E2E em staging:
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`
   (próxima fase).
10. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`**
    *(próxima — separada da fase atual)* — deploy controlado de
    `admin-disable-user` em staging e validação manual. A fase
    E2E-AUTO-RUNNER-A abaixo já cria o runner que automatiza a
    validação E2E.
 11. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`**
     *(em andamento, fase atual, repo-only)* — runner local
     automatizado em `scripts/staging/admin-disable-user-e2e.mjs`
     com comandos `setup` (coleta admin_email/admin_password uma
     única vez; detecta staging de `js/config.js`; salva em
     `.ravatex-local/admin-disable-user-e2e.config.json`,
     gitignored) e `run` (carrega config; aborta se URL não for
     `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`;
     login admin; valida `tipo=admin AND ativo=true`; resolve
     `fornecedor_id` config/autodetect; cria fornecedor descartável
     via `admin-create-user`; tenta desativar admin como fornecedor
     esperando `FORBIDDEN`; revalida admin; desativa descartável
     esperando `auth_banned=true`; valida `desativado_em`/
     `desativado_por`/`motivo_desativacao`; tenta login do
     desativado esperando falha; re-desativa esperando
     `already_disabled=true`; tenta self-disable esperando
     `SELF_DISABLE_FORBIDDEN`; imprime resumo sanitizado).
     Smoke estático
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (após `E2E-RUNNER-FIX-A`).
     `.gitignore` agora ignora `.ravatex-local/`. **E2E real
     não foi rerodado após o fix** — fica para a próxima
     (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou similar).
 11b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`**
     *(esta fase, repo-only)* — correção do bug do runner no
     passo `login_blocked`. Execução real do runner em staging
     avançou até `profile_inactive` e falhou com
     `HTTP 400 User is banned` tratado como erro fatal, porque
     `supabaseLogin` chamava `die()`/`process.exit` em qualquer
     HTTP 4xx e usava mensagem hardcoded "Login admin falhou"
     (rótulo incorreto para o usuário descartável desativado).
     Correção: helpers separados `loginExpectSuccess(...)` (fatal,
     rótulo parametrizado: `admin_login failed`,
     `test_user_login failed`, `admin_relogin failed`) e
     `loginExpectFailure(...)` (não-fatal; aceita HTTP 4xx com
     `User is banned`/`banned`/`Banned user`/`User is already
     registered` como falha esperada; retorna
     `{ ok, unexpected, status, detail }` para o caller decidir).
     Camada HTTP crua em `postSupabaseLogin(...)` (sem `die()`).
     Passo `login_blocked` agora imprime `login_blocked: OK` e
     continua para `idempotency` e `self_disable_blocked`. Smoke
     estático
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (4 testes novos: login bloqueado esperado, fluxo continua,
     loginExpectSuccess nos 3 logins, loginExpectFailure com
     substrings banned, loginExpectFailure retorna controle).
     Regressão `admin-disable-user.smoke.js` 39/39. **E2E real
     não foi rerodado nesta fase** — só após autorização do
     HMNlead. **Sem deploy, sem Supabase real, sem SQL, sem
     alteração de UI, sem produção, sem origin/main, sem PR
     #2.**
 11c. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(esta
     fase, repo-only)* — integração da tela
     `#/cadastros/usuarios` com a Edge Function
     `admin-disable-user` (já deployada em staging
     `ucrjtfswnfdlxwtmxnoo`). Botão `Desativar` substitui o
     placeholder `Em breve`; chama
     `window.supa.functions.invoke('admin-disable-user', {
     body: { user_id: usr.id, reason } })`; modal de
     confirmação com campo de motivo opcional (≤ 500 chars,
     default `"Desativação via UI"`); mapeia 8 códigos de erro
     (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/
     `LAST_ADMIN_FORBIDDEN`/`NOT_FOUND`/`AUTH_BAN_FAILED`/
     `COMPENSATION_FAILED`/`VALIDATION_ERROR`/`UNAUTHORIZED`)
     para mensagens PT-BR; guarda de UX para o próprio usuário
     logado e para usuários já inativos (proteção visual, não
     substitui server-side); coluna `Status` na listagem
     (`Ativo`/`Inativo`). Helper top-level
     `friendlyDisableMessage(code, fallback)` no
     `js/screens/cadastros.js`. Preserva `+ Novo usuário` e a
     chamada `admin-create-user`. **Sem deploy, sem Supabase
     real, sem SQL, sem produção, sem origin/main, sem PR
     #2, sem E2E real nesta fase.** E2E real do runner já
     havia passado em `result: PASS` em staging ANTES desta
     fase (evidência sanitizada em LEDGER §5k). Smoke
     `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde
     (+7 testes novos para a fase UI-A: botão `Desativar`
     substitui `Em breve`, chamada `admin-disable-user` com
     payload `user_id`+`reason`, leitura de
     `error.context.json`, tratamento dos 8 códigos, guarda
     de UX para self e inativo, coluna Status, preservação
     de `+ Novo usuário` e `admin-create-user`); regressões
     focais `tests/cadastros-screens.smoke.js` 32/32,
     `tests/admin-disable-user.smoke.js` 39/39,
     `tests/admin-create-user.smoke.js` 17/17,
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 —
     todas verdes.
12. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(futura)* — restaurar
    botão "Desativar" na UI quando Edge Function estiver
    deployada e validada em staging.

## Possíveis fases futuras opcionais (NÃO obrigatórias)

Estas fases **não** fazem parte do fechamento do refactor e **não**
são bloqueadas pelo design Auth. São sugestões para trabalho futuro,
se houver benefício prático **e** autorização explícita do dono do
projeto:

- **`RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`** — diagnosticar
  `buildBlocoFios` (montagem do bloco de recebimento de fios).
- **`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A`** — diagnosticar
  `buildProposta` / `recompute` / `onAceitar` (UI de proposta +
  interação com recálculo).
- **`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A`** — avaliar uso de
  RPC/transações Supabase para `persistirOP` e `aplicarRecalculoOP`
  (risco de produto/dados, não de refactor).

> **Nota:** `RAVATEX-TAPETES-OP-PDF-MODULE-A` foi **executada** em
> `7f3c6da`; não está mais em backlog.

## Proibições operacionais

- **Não tocar `origin/main` nem PR #2 sem autorização explícita.**
- **Não mexer em `persistirOP` ou `aplicarRecalculoOP` sem fase
  específica** (risco transacional residual, documentado em
  `PROJECT_STATE.md` e no LEDGER).
- **Não fazer docs + código na mesma fase.**
- **Não tratar cortes opcionais como obrigatórios** (sugestões acima
  são apenas para futuro).
- **Não iniciar nova extração em `op-nova.js`** (refactor
  congelado em `7f3c6da`).
- **Não remover o cache-busting `?v=20260623-asset1`** de `index.html`
  (proteção contra navegador servindo JS antigo).
- **Não remover `getAppRoot()`** de `js/ui.js` (proteção contra
  `replaceChildren null` no boot).

## Resumo do refactor (24 módulos extraídos)

| # | Módulo | Commit | Fase |
|---|---|---|---|
| 1 | `js/config.js` | `5547e27` | CONFIG-MODULE-A |
| 2 | `js/supabase-client.js` | `6d50d08` | SUPABASE-CLIENT-MODULE-A |
| 3 | `js/environment-banner.js` | `1f3238d` | ENV-BANNER-MODULE-A |
| 4 | `js/auth.js` | `1b56571` | AUTH-MODULE-A |
| 5 | `js/router.js` | `6bb203f` | ROUTER-MODULE-A |
| 6 | `js/screens/system-screens.js` | `786f6b4` | SYSTEM-SCREENS-MODULE-A |
| 7 | `js/screens/common.js` | `ed8e75c` | SCREENS-COMMON-MODULE-A |
| 8 | `js/screens/cadastros.js` | `dd24365` | CADASTROS-SCREENS-MODULE-A |
| 9 | `js/screens/ops-list.js` | `d7a8d25` | OPS-LIST-SCREEN-MODULE-A |
| 10 | `js/screens/entrega-form.js` | `958f244` | ENTREGA-FORM-HELPER-MODULE-A |
| 11 | `js/screens/entrega-writes.js` | `7ec1721` (+ `e190022`, `70635aa`) | ENTREGA-WRITES-MODULE-A (+ LATEX, + CIMA) |
| 12 | `js/screens/fornecedor.js` | `4b9ca12` | FORNECEDOR-SCREENS-MODULE-A |
| 13 | `js/screens/op-form-helpers.js` | `c480324` | OP-FORM-HELPERS-MODULE-A |
| 14 | `js/screens/op-writes.js` | `ab79f1c` (+ `1429950`) | OP-ORDER-WRITE-MODULE-A (+ OP-FORNECEDOR-WRITE-MODULE-A) |
| 15 | `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-SCREEN-MODULE-A |
| 16 | `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| 17 | `js/screens/op-recalculo.js` | `c599c21` (+ `4ce5080`) | OP-RECALCULO-HELPERS-MODULE-A (+ OP-RECALCULO-WRITES-MODULE-A) |
| 18 | `js/screens/op-persistir.js` | `8fd4dd2` (+ `cac20f9`) | OP-PERSISTIR-HELPERS-MODULE-A (+ OP-PERSISTIR-WRITES-MODULE-A) |
| 19 | `js/screens/op-nova.js` | `ce3dd14` | SCREENNOVAOP-MODULE-A |
| 20 | `js/boot.js` | `4c18fe7` | ROUTES-BOOT-MODULE-A |
| 21 | `js/screens/op-pdf.js` | `7f3c6da` | RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A |
| 22 | `js/screens/pedidos-list.js` | `bf960f8` | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 |
| 23 | `js/screens/pedido-form.js` | `62a9f9a` (+ `2de595c`) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (+ C2-R1) |
| 24 | `js/screens/pedido-detail.js` | `7184388` + `d2b5a6a` + (commit desta fase) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (+ C3B: ações reais de status + C3C1: Editar funcional por status) |
| 25 | `js/screens/pedido-edit.js` | `2d36077` C3C1: edição admin dos dados gerais do Pedido |
| 26 | `js/screens/pedido-itens-edit.js` | (commit desta fase) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B: edição admin de itens existentes do Pedido |

## Testes recentes (focados passando)
- `pedido-itens-edit.smoke.js` — 41/41
- `pedido-edit.smoke.js` — 35/35
- `pedido-detail.smoke.js` — 43/43
- `pedido-form.smoke.js` — 35/35
- `pedido-ui.test.js` — 18/18
- `pedidos-list.smoke.js` — 29/29
- `pedidos-schema.smoke.js` — 41/41
- `boot.smoke.js` — 28/28
- `router.smoke.js` — 41/41
- **Total Pedidos (C1+C2+C2-R1+C3A+C3B+C3C1+C3C2B): 311/311** (todos os focados
  passam).

Focados do refactor (mantidos verdes):
- `op-pdf.smoke.js` — 20/20
- `op-nova.smoke.js` — 30/30
- `op-recalculo.smoke.js` — 59/59
- `op-persistir.smoke.js` — 65/65
- `op-writes.smoke.js` — 49/49
- `op-latex-admin.smoke.js` — 30/30
- `op-form-helpers.smoke.js` — 36/36
- `painel-screen.smoke.js` — 16/16
- `fornecedor-screens.smoke.js` — 35/35

Pré-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
— não relacionadas ao refactor; exigem servidor local
(`.\run-local.bat` ou `python -m http.server 8765`).
Falhas pré-existentes em `tests/ops-list-screen.smoke.js` (10/30)
são de testes do refactor monolítico antigo, **fora do escopo**
da fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`.

## Comandos seguros por fase

```bash
# Após mudança em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# Validação focada de regressão completa:
node --test tests/boot.smoke.js \
              tests/router.smoke.js \
              tests/op-nova.smoke.js \
              tests/op-pdf.smoke.js \
              tests/op-persistir.smoke.js \
              tests/op-recalculo.smoke.js \
              tests/op-writes.smoke.js \
              tests/op-form-helpers.smoke.js \
              tests/op-latex-admin.smoke.js \
              tests/painel-screen.smoke.js \
              tests/fornecedor-screens.smoke.js
```

## O que um agente NÃO deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produção).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatório.
- Mexer em `persistirOP` ou `aplicarRecalculoOP` sem nova fase
  explícita.
- Tentar mover `renderOPLatexAdmin` para outro módulo (já está
  isolada em `op-latex-admin.js`).
- Tentar mover `screenPainel` (já está isolada em `painel.js`).
- Tentar mover `gerarPdfCompraFios` (já está isolada em `op-pdf.js`).
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
- Tratar fases opcionais (bloco fios, proposta, transaction risk)
  como obrigatórias.
- Iniciar nova extração em `op-nova.js` (refactor congelado).
- Remover cache-busting `?v=20260623-asset1` de `index.html`.
- Remover `getAppRoot()` de `js/ui.js`.
- Tratar `docs/superpowers/plans/*.md` como playbook executável
  (esses planos foram escritos para o monólito pré-refactor e
  instruem a modificar `index.html` diretamente; devem ser
  adaptados à arquitetura atual antes de qualquer uso).
- Tratar `docs/qa/*.md` como especificação técnica atual
  (checklists históricos; ver `docs/qa/README.md`).
