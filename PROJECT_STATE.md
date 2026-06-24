# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> Snapshot de estado canônico curto. Atualizado em **2026-06-24** (fase
> `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1` — adicionar novo item
> ao Pedido pela tela de edição de itens).
> **Frontend adicionar item.** Tela `#/pedidos/<uuid>/itens` agora
> também permite ADICIONAR novos itens ao Pedido (além de editar
> itens existentes da C3C2B). Itens novos são criados no estado
> local com flag `isNew: true`; botão "+ Adicionar item" (visível
> apenas para status editáveis); botão "Descartar novo item" para
> cada item novo (descarta apenas local, antes de salvar); insert
> em `pedido_itens` com 5 chaves: `pedido_id`, `modelo_id`,
> `metros`, `observacao`, `ordem` (ordem calculada como
> `existingItems.length + i`, novos vão para o fim). Sem
> remover, sem reordenar manualmente, sem editar
> `largura`/`cor_1_id`/`cor_2_id` (overrides opcionais ficam
> para C3C2D). Schema `db/13_*` permanece aplicado em
> `ucrjtfswnfdlxwtmxnoo`.
> Fonte da verdade operacional. Detalhe por fase em
> `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras de saúde arquitetural em
> `docs/architecture/CODE_HEALTH_RULES.md`.
> Índice de documentação em `docs/DOCUMENTATION_INDEX.md`.

## Produto
SPA web para controlar a produção de tapetes, do pedido de fio até o
recebimento do látex. Perfis: **admin** (operação) e **fornecedor**
(fio / tecelagem / látex).

## Stack real (confirmada)
- Frontend: `index.html` único + `js/**` (JS clássico, sem build) +
  Tailwind via CDN.
- Cálculo: `js/calculo-op.js` — funções puras, testadas com `node --test`.
- Backend: Supabase + Auth e-mail/senha + RLS. Plano free.
- Hospedagem: **GitHub Pages** (publica no push pra `main`). **Não é
  Vercel. Não é Next.js.**

## Arquitetura
- **App estático `index.html` + JS clássico + Supabase.**
- **2 ambientes Supabase, 2 repos:**
  - **Legacy / original online** (`bhgifjrfagkzubpyqpew`) — app no Vercel com usuários externos. **Não tocar.**
  - **Paralelo de trabalho** (`ucrjtfswnfdlxwtmxnoo`) — backend novo, usado pelo frontend local `work/app-next`.
- **2 repos:**
  - `origin` → `grupoterrabranca/controle-tapetes` (oficial, intocado, `origin/main`).
  - `staging` → `controle-tapetes-staging` (paralelo, `staging/main`).
- **Taxonomia oficial:** ver `docs/operations/PARALLEL_ENVIRONMENT_RECONCILIATION.md`.
- **`bhgifjrfagkzubpyqpew` NÃO é alvo desta frente.** Nenhuma ação deve mirá-lo.

## Estado atual do refactor
- **Branch operacional:** `work/app-next`.
- **HEAD atual aceito:** commit desta fase — "Add pedido admin
  item append" (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1`).
  Antes desta fase: `acc96c3` (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B`).
- **staging/main:** `acc96c3` (será atualizado com o push desta fase).
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` — **intocado.**
- **PR #2:** **intocado.**
- **Working tree:** **limpo.**
- **Ambiente paralelo (`ucrjtfswnfdlxwtmxnoo`):** backend completo:
  schema `db/12_*` aplicado (HMNlead, 2026-06-24), Edge Functions
  `admin-create-user` e `admin-disable-user` deployadas e validadas,
  secrets configurados, UI validada manualmente, smokes 163/163,
  E2E PASS.
- **App original (`bhgifjrfagkzubpyqpew`):** **intocado.** Apenas
  1 query read-only com anon key pública nesta frente, sem mutação.

### Marco fechado
**Marco fechada: ciclo de refactor arquitetural + hardening + extração
final do `op-pdf.js` está CONGELADO.**

Componentes estáveis:
- `index.html` declarativo, sem script inline final, com cache-busting
  `?v=20260623-asset1` em todos os 26 assets locais; CDNs externos
  permanecem sem `?v=`.
- `js/boot.js` é o entrypoint oficial e respeita `DOM ready`
  (aguarda `DOMContentLoaded` quando `document.readyState === 'loading'`,
  e chama `startApp()` em `js/boot.js`; `main()` não é mais executado
  no top-level).
- `js/router.js` é engine genérica de roteamento, intocado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` —
  erro `replaceChildren null` foi eliminado após cache limpo do
  navegador.
- `run-local.bat` é o tooling local para servir o app em
  `http://localhost:8765/`.
- Telas e writes críticos (admin / fornecedor / OP / entrega / látex)
  estão modularizados.
- `js/screens/op-pdf.js` foi extraído de `op-nova.js` contendo
  `gerarPdfCompraFios`.

### Commits técnicos e eventos desde o último docs-only (`5fec054`)
1. `d5db6c7` — Add local run script
   (`run-local.bat`, `http://localhost:8765/`).
2. `87d4559` — Delay app boot until DOM ready
   (`js/boot.js` passa a executar `main()` via `startApp`,
   aguardando `DOMContentLoaded`).
3. `e0dbfcd` — Resolve app root lookup after DOM ready
   (`js/ui.js` introduz `getAppRoot()` para lookup lazy do `#app`).
4. `5d5b395` — Add cache busting to local app assets
   (`index.html` com `?v=20260623-asset1` em 26 assets locais;
   CDNs externos preservados sem `?v=`).
5. `RAVATEX-TAPETES-OP-NOVA-SEAMS-DIAG-A` (read-only, sem commit) —
   diagnóstico das seams de `op-nova.js`. Concluiu que
   `gerarPdfCompraFios` é a única extração de baixo risco e que
   `buildBlocoFios` / `buildBlocoTecelagem` / `buildProposta` devem
   permanecer na closure por acoplamento.
6. `7f3c6da` — Extract OP PDF helper
   (`js/screens/op-pdf.js` criado; `gerarPdfCompraFios` removida de
   `op-nova.js`; call-site atualizado para
   `window.gerarPdfCompraFios({ op, ordens })`; 388/388 testes
   focados passaram).
7. Commits intermediários do ciclo de Auth (`e64d1cc`,
   `4f7c16f`, `0d5ef7b`, `88aa4fb`, `f6ac19b`, `c365020`,
   `0bc67f6`, `3c9c424`/`d9d08be`, `42ffc91`, `d99bcda`,
   `77bcc6b`) — ver LEDGER §4. Fecham: refactor closeout docs,
   `CODE_HEALTH_RULES`, governança, saneamento documental, design
   e implementação da Edge Function `admin-create-user`, UI
   `#/cadastros/usuarios`, runbook operacional, design de
   desativação, UI guard, schema de desativação versionado.
8. `8fa924a` — `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`
   (docs-only): registro da orientação e validação local para
   aplicação de `db/12_auth_user_disable_schema.sql` no Supabase
   **staging** `ucrjtfswnfdlxwtmxnoo`. A execução real do SQL
   ficou pendente de HMNlead no Dashboard e foi registrada em
   fase própria (`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`,
   esta fase).

## Decisão arquitetural
**REFATORAÇÃO ARQUITETURAL CONGELADA.**

Justificativa:
- `index.html` está declarativo e com cache-busting local.
- `js/boot.js` é o entrypoint; respeita DOM ready.
- `js/router.js` é engine genérica.
- `js/ui.js` tem root lookup seguro.
- assets locais têm cache-busting.
- telas e writes críticos estão modularizados.
- `op-pdf.js` foi extraído.
- `op-nova.js` ainda é grande (~800 linhas), mas **sem writes
  diretos Supabase** e com closure aceitável, isolada em módulo
  próprio.
- extrações adicionais de `buildBlocoFios`, `buildBlocoTecelagem` e
  `buildProposta` **não são recomendadas** neste ciclo: deslocariam
  complexidade para a fronteira da closure sem ganho proporcional e
  aumentariam risco.

A próxima etapa é **homologação / release**, não nova extração.

## Validação funcional registrada
- Servidor local em `http://localhost:8765/` abriu corretamente após
  cache limpo do navegador (Disable cache + Ctrl+F5).
- `replaceChildren null` no boot **não voltou** após a limpeza de
  cache.
- Login aparentemente OK.
- Supabase staging (`ucrjtfswnfdlxwtmxnoo`) tem 4 OPs:
  `select count(*) as total_ops from public.ops;` → `4`.
- Pendência não bloqueante: log `relation
  "supabase_migrations.schema_migrations" does not exist` permanece
  em staging (não bloqueante; é ruído do dashboard, não do app).

## Evidência da aplicação manual do schema em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A` —
2026-06-24. Esta seção é **docs-only**; nenhum SQL foi rodado por
IAexec nesta fase. Toda a execução e validação foi feita manualmente
pelo HMNlead no Supabase Dashboard.)*

### Aplicação
- `db/12_auth_user_disable_schema.sql` foi aplicado manualmente pelo
  HMNlead no SQL Editor do Supabase **staging** `ucrjtfswnfdlxwtmxnoo`.
- Nenhum SQL destrutivo foi aplicado. Os arquivos
  `db/10_reset_producao.sql` e `db/11_reset_ops.sql` **não** foram
  executados. **Produção `bhgifjrfagkzubpyqpew` não foi tocada.**
- **Nenhum usuário foi criado, excluído ou desativado** durante a
  aplicação. Todas as mutações foram apenas de schema e de funções
  `SECURITY DEFINER`.

### Estado pós-aplicação
- Novas colunas em `public.usuarios`:
  `ativo boolean NOT NULL DEFAULT TRUE`,
  `desativado_em timestamptz NULL`,
  `desativado_por uuid NULL`,
  `motivo_desativacao text NULL`.
- Contagem pós-aplicação: `ativo = true, total = 3`;
  `auth_users_total = 3`; `public_usuarios_total = 3`;
  `auth_sem_perfil = 0`; `perfil_sem_auth = 0`.
- `is_admin()` agora exige `tipo = 'admin' AND ativo IS TRUE`.
- `meu_fornecedor_id()` agora consulta `fornecedor_id`, `tipo` e
  `ativo`; retorna `NULL` se `ativo` não for `TRUE` ou se `tipo`
  não for `'fornecedor'`.
- `usuarios_admin_all` permanece com `USING/WITH CHECK is_admin()`
  (a nova `is_admin()` já considera `ativo`).
- `usuarios_select` agora usa
  `((id = auth.uid()) AND (ativo IS TRUE)) OR is_admin()`.
- `usuarios_self_update` exige `id = auth.uid()`, `ativo IS TRUE`
  e preserva `tipo` no `WITH CHECK`.

### Validação manual do app pós-schema (HMNlead)
- Login/admin aparentou OK.
- Tela `#/cadastros/usuarios` carregou.
- Botão `+ Novo usuário` continuou visível.
- Exclusão insegura continuou bloqueada como `Em breve` (placeholder
  injetado na fase `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`).
- Console não mostrou erro crítico de Auth/RLS/listagem.
- Avisos não bloqueantes observados: warning de Tailwind CDN;
  `favicon.ico` 404.

### Estado final
- Schema de desativação **aplicado e validado** em staging.
- Nenhum usuário foi criado, excluído ou desativado durante a
  aplicação. Todos os usuários atuais ficaram `ativo = true`.
- Próxima fase liberada:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (Edge Function
  `admin-disable-user`).

## Evidência da validação manual da UI em staging
*(Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
— 2026-06-24. Esta seção é **docs-only**; nenhum código, SQL,
deploy ou execução automatizada foi feita por IAexec nesta
fase. A validação foi feita manualmente pelo HMNlead no app em
staging `ucrjtfswnfdlxwtmxnoo`.)*

### Itens validados
- Tela `#/cadastros/usuarios` carregou em staging.
- Botão `Desativar` apareceu para usuários ativos; placeholder
  `Em breve` substituído pela chamada real à Edge Function
  `admin-disable-user`.
- **Guarda de usuário já inativo:** ao tentar `Desativar` um
  usuário com `ativo = false`, a UI exibiu a mensagem
  `"Usuário já está inativo."` **sem** chamar a Edge Function
  (proteção visual, server-side continua sendo a barreira real).
- **Fluxo real de desativação:** fornecedor descartável ativo foi
  criado pela UI e, em seguida, desativado via botão
  `Desativar` → modal de confirmação (motivo preenchido) →
  toast de sucesso → status `Inativo` na listagem.
- Console sem erros críticos de Auth/RLS/listagem.
- Warnings não bloqueantes, se presentes, continuam: warning
  de Tailwind CDN, `favicon.ico` 404.

### Estado final
- UI `#/cadastros/usuarios` validada em staging pelo HMNlead.
- **Produção `bhgifjrfagkzubpyqpew` intocada.**
- **`origin/main` intocado** (`1047181eba888242c6428de366cbd9fda2f1c72c`).
- **PR #2 intocado.**
- Próxima etapa: **decisão de release** para
  `origin/main`/produção, **somente com autorização explícita**
  do HMNlead (em fase separada).

## Pendências não bloqueantes
- 🟡 `op-nova.js` ainda tem cerca de 800 linhas; `buildBlocoFios`,
  `buildBlocoTecelagem` e `buildProposta` continuam na closure
  **por decisão arquitetural** (vide seção "Decisão arquitetural").
- 🟡 `persistirOP` e `aplicarRecalculoOP` ainda não são transacionais
  entre múltiplas tabelas (risco de produto/dados, não regressão do
  refactor).
- 🟢 **Auth provisioning concluído.** Edge Function `admin-create-user`
  deployada e validada em staging (`ucrjtfswnfdlxwtmxnoo`); UI
  `#/cadastros/usuarios` adaptada em `js/screens/cadastros.js`
  para chamar a função via `supabase.functions.invoke` (fase
  `RAVATEX-TAPETES-AUTH-ADMIN-UI-A`); E2E UI staging aprovada
  (criação de fornecedor descartável, `auth.users.id =
  public.usuarios.id` confirmado por SQL read-only, usuário teste
  removido); bloqueio de fornecedor (403) confirmado em staging;
  runbook operacional publicado em
  `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md` (fase
  `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`).
- 🟡 **Auth delete/disable design concluído.** Design de semântica de
  exclusão/desativação documentado em
  `docs/architecture/AUTH_DELETE_USER_DESIGN.md` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`). Recomendação:
  **desativar** (soft delete no perfil + ban no Auth) em vez de
  deletar fisicamente. Próxima fase:
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (schema) ou
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A` (contenção imediata).
- 🟡 **UI guard aplicada.** Exclusão insegura de usuário
  (`.from('usuarios').delete()`) foi removida do front-end em
  `js/screens/cadastros.js` (fase
  `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`). O botão "Excluir vínculo"
  foi substituído por placeholder "Em breve" que exibe toast
  informativo orientando a usar o Supabase Auth Dashboard para limpeza
  de testes. Delete/disable seguro via Edge Function ainda não
  implementado.
- 🟢 **Auth disable schema aplicado em staging.** Migration
  `db/12_auth_user_disable_schema.sql` foi aplicada manualmente pelo
  HMNlead no SQL Editor do Supabase **staging**
  `ucrjtfswnfdlxwtmxnoo` e validada pós-aplicação (fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`).
  Adiciona colunas `ativo`, `desativado_em`, `desativado_por`,
  `motivo_desativacao` em `public.usuarios`; recria `is_admin()` e
  `meu_fornecedor_id()` para exigir `ativo is true`; recria policies
  `usuarios_select`, `usuarios_admin_all`, `usuarios_self_update`.
  Validação pós-aplicação: `ativo = true` em todos os 3 perfis
  (`auth_users_total = 3`, `public_usuarios_total = 3`,
  `auth_sem_perfil = 0`, `perfil_sem_auth = 0`); nenhuma coluna
  destrutiva foi rodada; `db/10_reset_producao.sql` e
  `db/11_reset_ops.sql` não foram executados; produção não foi
  tocada. Compatibilidade preservada: `ativo` tem `DEFAULT TRUE`,
  então `admin-create-user` continua funcionando sem alteração (a
  Edge Function insere apenas id/email/nome/tipo/fornecedor_id e o
  default preenche `ativo`).
- 🟡 **Apply staging confirmado (não executado por IAexec).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (docs-only,
  `8fa924a`) preparou a orientação; fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`
  (esta) registra a aplicação real feita por HMNlead no Dashboard.
  Validações locais (smoke 20/20 + regressões 65/65 + ausência de
  DELETE/DROP/TRUNCATE/secrets) passaram **antes** da aplicação.
  **Nenhum SQL foi rodado por IAexec em qualquer fase.** A execução
  do SQL no Supabase staging é e continua sendo responsabilidade
  exclusiva do HMNlead no Dashboard (project ref
  `ucrjtfswnfdlxwtmxnoo`).
- 🟡 **Edge Function `admin-disable-user` criada localmente (sem
  deploy).** Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`.
  Implementação em `supabase/functions/admin-disable-user/index.ts`
  segue o padrão estrutural de `admin-create-user` (mesmos
  `_shared/cors.ts` e `_shared/response.ts`); valida admin ativo
  server-side; bloqueia auto-desativação e último admin ativo; faz
  soft delete no perfil + ban Auth via
  `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
  compensa (reativa perfil) se o ban falhar; não usa `.delete()` nem
  `auth.admin.deleteUser`. Smoke estático
  `tests/admin-disable-user.smoke.js` 39/39 verde. Regressões
  focais preservadas. **Sem deploy, sem Supabase real, sem
  alteração de UI** — `js/**`, `index.html`, `db/**` e
  `admin-create-user` intocados. UI de `#/cadastros/usuarios`
  continua com placeholder `Em breve` para exclusão. Deploy e
  validação E2E em staging ficam para
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`.
- 🟡 **Runner local de E2E staging criado (sem E2E real).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`.
  Implementação em
  `scripts/staging/admin-disable-user-e2e.mjs` (ESM, sem
  dependências externas) com comandos `setup` e `run`. `setup`
  detecta staging automaticamente de `js/config.js` (URL + anon
  key já públicas) e pede admin email/senha uma vez, salvando
  em `.ravatex-local/admin-disable-user-e2e.config.json`
  (gitignored). `run` carrega o config, aborta se URL !=
  `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`,
  faz login admin, valida `tipo=admin AND ativo=true`, resolve
  `fornecedor_id` (config ou autodetect), cria fornecedor
  descartável via `admin-create-user`, valida perfil criado,
  tenta `admin-disable-user` como fornecedor (espera
  `FORBIDDEN`), revalida admin ativo, re-login admin, desativa
  o descartável (espera `ativo=false`, `auth_banned=true`),
  valida `desativado_em`/`desativado_por`/`motivo_desativacao`
  em `public.usuarios`, tenta login do desativado (espera
  falha), re-desativa (espera `already_disabled=true`), tenta
  self-disable (espera `SELF_DISABLE_FORBIDDEN`), imprime
  resumo sanitizado. Smoke estático
  `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
  (após `E2E-RUNNER-FIX-A`); regressões focais preservadas
  (`admin-create-user` 17/17, `admin-disable-user` 39/39).
  **E2E real ainda não foi rerodado** após o fix — fica para
  a próxima (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou
  similar).
- 🟡 **Bug do runner no login bloqueado corrigido.** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`
  (esta fase). Quando o runner real foi executado em staging
  avançou até `profile_inactive` e falhou com
  `HTTP 400 User is banned` no passo `login_blocked`. A falha
  era o **resultado esperado** do teste, mas foi tratada como
  erro fatal porque `supabaseLogin` chamava `die()`/
  `process.exit` em qualquer HTTP 4xx e usava a mensagem
  hardcoded "Login admin falhou" (rótulo incorreto para o
  usuário descartável desativado). Correção: runner agora
  separa os helpers `loginExpectSuccess(...)` (fatal, com
  rótulo parametrizado como `admin_login failed`) e
  `loginExpectFailure(...)` (não-fatal, retorna
  `{ ok, unexpected, status, detail }`; aceita HTTP 4xx com
  `User is banned`/`banned`/`Banned user`/`User is already
  registered` como falha esperada). Passo `login_blocked`
  agora imprime `login_blocked: OK` e continua para
  `idempotency` e `self_disable_blocked`. Smoke estático
  `tests/admin-disable-user-e2e-runner.smoke.js` expandido
  para 32/32 verde (4 testes novos: login bloqueado esperado,
  fluxo continua, loginExpectSuccess em 3 logins,
  loginExpectFailure com substrings banned, loginExpectFailure
  retorna controle).   `admin-disable-user.smoke.js` 39/39
  verde. **E2E real não foi rerodado nesta fase** — só após
  autorização do HMNlead.
- 🟡 **UI `#/cadastros/usuarios` integrada com `admin-disable-user`.**
  Fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`. Botão
  `Desativar` substitui o placeholder `Em breve`; chama
  `window.supa.functions.invoke('admin-disable-user', { body: {
  user_id, reason } })`; modal de confirmação com campo de
  motivo opcional (até 500 chars); mapeia códigos de erro
  (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/`LAST_ADMIN_FORBIDDEN`/
  `NOT_FOUND`/`AUTH_BAN_FAILED`/`COMPENSATION_FAILED`/
  `VALIDATION_ERROR`/`UNAUTHORIZED`) para mensagens PT-BR; guarda
  de UX para o próprio usuário logado e para usuários já
  inativos (proteção visual, não substitui server-side); coluna
  `Status` na listagem mostra `Ativo`/`Inativo`. E2E real do
  runner backend já havia passado em `result: PASS` em staging
  (`ucrjtfswnfdlxwtmxnoo`) — ver LEDGER §5k para evidência
  sanitizada. Smoke estático
  `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde;
  regressões focais todas verdes.
- 🟢 **Validação manual da UI de desativação em staging
  (HMNlead).** Fase
  `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`
  (esta fase, docs-only). Tela `#/cadastros/usuarios` aberta em
  staging `ucrjtfswnfdlxwtmxnoo`; botão `Desativar` confirmado
  visível; guarda de UX para usuário já inativo exibiu a
  mensagem `"Usuário já está inativo"` (sem chamada à Edge
  Function); fornecedor descartável ativo foi criado pela UI e
  em seguida desativado via botão `Desativar`; fluxo real
  passou. Warnings não bloqueantes, se presentes, continuam:
  Tailwind CDN, `favicon.ico` 404. **Produção
  `bhgifjrfagkzubpyqpew` e `origin/main` intocados.**
  Detalhes em "Evidência da validação manual da UI em staging"
  abaixo.
- 🟡 Staging mostra log `relation "supabase_migrations.schema_migrations"
  does not exist` (ruído do dashboard, não do app).
- 🟡 Tailwind CDN ainda gera warning de produção (não bloqueante;
  requer mudança de stack se for endereçar).
- 🟡 GitHub Pages staging ainda pode ser tratado depois, se necessário
  para homologação pública.
- 🟢 **Detalhe admin read-only do Pedido (`#/pedidos/<uuid>`)**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`): nova tela
  `js/screens/pedido-detail.js` com `screenPedidoDetalhe(pedidoId)`;
  resolve via match dinâmico estendido em `js/router.js`
  (`^#/pedidos/<uuid>$`, admin-only, sem `public: true`);
  carregado em `index.html` após `pedido-form.js` e antes de
  `boot.js`; botão "Visualizar" de `js/screens/pedidos-list.js`
  navega para `#/pedidos/<id>`. Conteúdo: cabeçalho com
  número/status badge/cliente/prazo/criado em, dados gerais
  (observação + atualizado em), tabela de itens com modelo, cor_1
  /cor_2, largura, preview 48x48, metros e observação do item.
  Ações: Voltar (funcional), Editar/Cancelar/Receber (placeholders
  `disabled` com `title="Em breve"`). SELECT-only em `pedidos`
  (com join aninhado `cliente:cliente_id(id, nome)`), `pedido_itens`,
  `modelos`, `cores`. Sem insert/update/delete/rpc, sem
  `functions.invoke`, sem `token_acesso`, sem `service_role`, sem
  rota pública, sem mutação em `lotes`/`pedido_eventos`, sem
  schema/SQL, sem OP, sem Edge Function, sem fornecedor.
  Smoke estático `tests/pedido-detail.smoke.js` 30/30 verde.
  Regressões focadas: `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 22/22
  (com 2 testes novos: `matchRoute('#/pedidos/<uuid>')` resolve
  para `screenPedidoDetalhe` admin-only; IDs não-UUID não casam),
  `router` 34/34. **Total: 209/209 verdes** (focados).
  Falhas pré-existentes em `tests/ops-list-screen.smoke.js` (10/30)
  são de testes do refactor monolítico antigo, **fora do escopo**
  desta fase. **Sem deploy, sem Supabase real, sem SQL, sem
  produção, sem origin/main, sem PR #2 nesta fase.** Próxima fase
  recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B` (adição de
  ações reais de status/edição/cancelamento), **somente com
  autorização explícita** do HMNlead.
- 🟢 **Ações reais RESTRITAS de status no detalhe do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B`, esta). `pedido-detail.js`
  agora define `TRANSITIONS` (rascunho→recebido, recebido→
  confirmado, rascunho/recebido/confirmado→cancelado; produzindo
  /entregue/cancelado terminais), `ACTION_LABEL` e função interna
  `alterarStatus(novoStatus, btn)`. Ações reais: "Marcar como
  recebido" (rascunho), "Confirmar pedido" (recebido) e "Cancelar
  pedido" (qualquer dos 3 estados iniciais — exige
  `window.confirmDialog`). Update é APENAS em `pedidos.status`
  com `.eq('id', pedidoId)` (admin-only via RLS). Após sucesso,
  atualiza `state.pedido.status` e chama `render()`. Para
  status terminais (cancelado/produzindo/entregue), exibe
  mensagem informativa em vez de botões. Editar continua
  placeholder (`disabled` com `title="Em breve"`) — fica para
  C3C. Sem insert/update/delete em `pedido_itens`, sem insert em
  `pedido_eventos` (decisão C3B: best-effort fica para fase
  futura), sem mexer em `lotes`/`pedido_eventos`, sem OP, sem
  Edge Function, sem RPC, sem schema, sem token público.
  Smoke estático `tests/pedido-detail.smoke.js` 42/42 verde
  (12 testes novos: 5 transições permitidas, 2 transições
  proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus`, update restrito a `status` apenas, sem
  insert em `pedido_eventos`, uso de `confirmDialog` apenas
  para cancelar, botões reais vs placeholder Editar, re-render
  após sucesso). Regressões focadas preservadas: `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 22/22, `router` 34/34. **Total: 221/221
  verdes** (focados). Falhas pré-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) são do refactor
  monolítico antigo, **fora do escopo**. **Sem deploy, sem
  Supabase real, sem SQL, sem produção, sem origin/main, sem
  PR #2 nesta fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C` (edição de campos
  editáveis do Pedido + itens), **somente com autorização
  explícita** do HMNlead.
- 🟢 **Edição admin RESTRITA dos dados gerais do Pedido** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1`, esta). Nova tela
  `js/screens/pedido-edit.js` com `screenPedidoEditar(pedidoId)`;
  resolve via match dinâmico estendido em `js/router.js`
  (`^#/pedidos/<uuid>/editar$`, admin-only, sem `public: true`).
  Carregado em `index.html` após `pedido-detail.js` e antes de
  `boot.js`. Botão "Editar" de `js/screens/pedido-detail.js`
  navega para `#/pedidos/<id>/editar` APENAS para status
  editáveis (`rascunho` / `recebido`); para os demais status,
  fica como placeholder desabilitado com `title` explicativo.
  Helper `isPedidoEditavel(status)` adicionado em
  `js/pedido-ui.js` (`PEDIDO_STATUS_EDITAVEL = ['rascunho',
  'recebido']`). Conteúdo da tela: cabeçalho com número do
  pedido, banner de status com nota de editabilidade, form
  com `cliente_id` (select obrigatório), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional); botão
  Cancelar volta para o detalhe; botão Salvar aplica update.
  Em status não editável, campos e Salvar ficam desabilitados
  e o banner mostra o motivo. Write APENAS em `pedidos` com
  payload restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`); sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem OP, sem Edge
  Function, sem RPC, sem schema, sem token público, sem
  service_role. Após sucesso, navega de volta para o detalhe.
  Smoke estático `tests/pedido-edit.smoke.js` 35/35 verde.
  `tests/pedido-detail.smoke.js` atualizado (42/42) — botão
  Editar é controlado por `isPedidoEditavel` (funcional para
  rascunho/recebido, placeholder para os demais); C3B status
  actions preservadas. `tests/boot.smoke.js` 25/25 (3 testes
  novos: rota de edição admin-only, rejeita IDs não-UUID,
  distingue detalhe vs edição). `tests/router.smoke.js` 38/38
  (4 testes novos para a nova rota dinâmica). **Total:
  263/263 verdes** (focados). **Sem deploy, sem Supabase real,
  sem SQL, sem produção, sem origin/main, sem PR #2 nesta
  fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2` (edição de itens
  do Pedido), **somente com autorização explícita** do HMNlead.
- 🟢 **Edição admin RESTRITA de itens existentes do Pedido**
  (fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2B`, esta).
  Nova tela `js/screens/pedido-itens-edit.js` com
  `screenPedidoItensEditar(pedidoId)`; resolve via match
  dinâmico em `js/router.js`
  (`^#/pedidos/<uuid>/itens$`, admin-only, sem `public: true`).
  Carregado em `index.html` após `pedido-edit.js` e antes de
  `boot.js`. Botão "Editar itens" de `js/screens/pedido-detail.js`
  (helper `buildEditItensButton()`) navega para
  `#/pedidos/<id>/itens` APENAS para status editáveis
  (`rascunho` / `recebido`, via `window.isPedidoEditavel`);
  para os demais status, fica como placeholder desabilitado.
  Conteúdo: cabeçalho com número do pedido, banner de status
  com nota de editabilidade, lista de itens existentes com
  select de modelo (`modelos`), input number de metros e
  input de observação; sem controles de add/remove/reordenar
  (C3C2C) e sem overrides de largura/cor (C3C2D). Write
  APENAS em `pedido_itens` com payload restrito a 3 chaves
  (`modelo_id`, `metros`, `observacao`); sem update em
  `pedidos`, sem update/insert/delete em `pedido_itens`, sem
  insert em `pedido_eventos`, sem mexer em `lotes`, sem OP,
  sem Edge Function, sem RPC, sem schema, sem token público,
  sem service_role, sem rota pública. Sem compensação
  automática nesta fase (limitação documentada: se um update
  falhar, os anteriores permanecem; usuário re-edita).
  Após sucesso, navega de volta para o detalhe.
  Smoke estático `tests/pedido-itens-edit.smoke.js` 41/41
  verde (17 seções de cobertura: existência, sintaxe,
  namespace, ordem de scripts, router dinâmico, SELECTs,
  write restrito, payload de 3 chaves, ausência de campos
  proibidos, ausência de insert/delete, ausência de update
  em `pedidos`, ausência de `pedido_eventos`/`lotes`,
  ausência de Edge Function, ausência de OP, ausência de
  token_acesso/service_role, ausência de rota pública,
  ausência de controles de add/remove/reordenar, mensagem
  "Pedido sem itens", botão "Editar itens" no detalhe).
  `tests/pedido-detail.smoke.js` atualizado (43/43) — botão
  "Editar itens" controlado por `isPedidoEditavel`
  (C3C2B); C3B status actions e C3C1 edição de dados gerais
  preservadas. `tests/router.smoke.js` atualizado (41/41) —
  3 testes novos para a nova rota. `tests/boot.smoke.js`
  atualizado (28/28) — 3 testes novos para a nova rota.
  **Total: 311/311 verdes** (focados). **Sem deploy, sem
  Supabase real, sem SQL, sem produção, sem origin/main, sem
  PR #2 nesta fase.** Próxima fase recomendada:
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C` (adicionar/remover
  itens + recálculo de ordem + mínimo de 1 item), **somente
  com autorização explícita** do HMNlead.
- 🟢 **Adicionar novo item ao Pedido pela tela de edição** (fase
  `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1`, esta).
  `js/screens/pedido-itens-edit.js` (já existente) foi estendido
  para permitir ADICIONAR novos itens além de editar os
  existentes (C3C2B). Comportamento: botão "+ Adicionar item"
  visível apenas para status editáveis; ao clicar, novo item
  é criado no estado local com flag `isNew: true` (campos
  vazios para preenchimento: `modelo_id` obrigatório, `metros`
  > 0, `observacao` opcional); botão "Descartar novo item" em
  cada item novo para descarte apenas local (não remove
  item existente). Itens novos têm visual distinto (borda
  tracejada + label "Novo (não salvo)"). `salvar()` separa
  `existingItems` (update sequencial, 3 chaves no payload)
  de `newItems` (insert em batch com 5 chaves:
  `pedido_id`, `modelo_id`, `metros`, `observacao`, `ordem`,
  onde `ordem = existingItems.length + i` — novos vão para o
  fim). Ordem recomendada: updates primeiro, depois insert.
  Sem delete/upsert em `pedido_itens`, sem remover item
  existente (C3C2C2), sem drag-and-drop, sem reordenar
  manualmente, sem editar `largura`/`cor_1_id`/`cor_2_id`
  (C3C2D), sem update em `pedidos`, sem `pedido_eventos`/
  `lotes`, sem OP, sem Edge Function, sem RPC, sem schema, sem
  token público, sem `service_role`, sem rota pública.
  `tests/pedido-itens-edit.smoke.js` atualizado (46/46
  verde) — 5 testes novos (botão "+ Adicionar item" existe,
  insert de novos itens com 5 chaves permitidas, insert NÃO
  contém campos proibidos, ordem calculada automaticamente,
  botão "Descartar novo item" apenas para isNew) + 1 teste
  atualizado (insert permitido, delete/upsert proibidos) +
  1 teste invertido ("TEM botão Adicionar item" em vez de
  "NÃO tem"). `tests/pedido-detail.smoke.js` preservado
  (43/43). `tests/boot.smoke.js` e `tests/router.smoke.js`
  preservados (28/28 e 41/41). **Total: 316/316 verdes**
  (focados). **Sem deploy, sem Supabase real, sem SQL, sem
  produção, sem origin/main, sem PR #2 nesta fase.** Próxima
  fase recomendada: `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2`
  (remover item existente do Pedido), **somente com
  autorização explícita** do HMNlead.

## Próximo passo recomendado
1. **Auth provisioning fechado em staging:** Edge Function
   `admin-create-user`, UI `#/cadastros/usuarios` e runbook
   operacional publicados e validados. Bloqueio de fornecedor (403)
   confirmado.
2. **Auth delete/disable design concluído:**
   `docs/architecture/AUTH_DELETE_USER_DESIGN.md`. Recomendação:
   desativar usuários (soft delete + ban Auth) em vez de deletar
   fisicamente. Botão "Excluir vínculo" atual deve ser restrito
   (Alternativa E) até Edge Function de desativação ser implementada.
3. **UI guard aplicada** (fase
   `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`): botão "Excluir vínculo"
   substituído por placeholder "Em breve" que exibe toast informativo.
   Caminho `.from('usuarios').delete()` removido do front-end.
4. **Schema de desativação aplicado em staging** (fases
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` +
   `...-SCHEMA-APPLY-A` + `...-SCHEMA-APPLY-EVIDENCE-A`):
   `db/12_auth_user_disable_schema.sql` aplicado manualmente por
   HMNlead no SQL Editor do Supabase staging (`ucrjtfswnfdlxwtmxnoo`)
   em `2026-06-24`. Colunas, funções (`is_admin`, `meu_fornecedor_id`)
   e policies (`usuarios_select`, `usuarios_admin_all`,
   `usuarios_self_update`) recriadas com sucesso. Todos os 3
   perfis existentes ficaram `ativo = true`. Nenhum usuário foi
   criado, excluído ou desativado durante a aplicação.
5. **Edge Function de desativação criada localmente** (fase
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`): `supabase/functions/
   admin-disable-user/index.ts` implementa soft delete no perfil
   (`ativo = false`, `desativado_em`, `desativado_por`,
   `motivo_desativacao`) + ban Auth via
   `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`,
   com validação de admin ativo server-side, bloqueio de
   auto-desativação (`SELF_DISABLE_FORBIDDEN`), bloqueio do último
   admin ativo (`LAST_ADMIN_FORBIDDEN`), idempotência para alvo já
   inativo, e compensação (reativar perfil) se o ban falhar.
   Validação estática em `tests/admin-disable-user.smoke.js`
   (39/39 verdes). Regressões preservadas: `admin-create-user` 17/17,
   `auth-disable-user-schema` 20/20, `cadastros-usuarios-auth-ui`
   16/16, `cadastros-screens` 32/32. **Sem deploy nesta fase**;
   `js/**`, `index.html`, `db/**` e `admin-create-user` intocados;
   UI permanece com placeholder `Em breve`.
6. **Runner local de E2E staging criado** (fase
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`):
   `scripts/staging/admin-disable-user-e2e.mjs` com comandos
   `setup` e `run`. `setup` detecta staging de `js/config.js`
   e salva config em `.ravatex-local/admin-disable-user-e2e.config.json`
   (gitignored). `run` executa E2E completo: login admin,
   `tipo=admin AND ativo=true`, resolve `fornecedor_id`
   (config ou autodetect), cria descartável via
   `admin-create-user`, tenta desativar admin como fornecedor
   (`FORBIDDEN`), desativa descartável (`auth_banned=true`),
   valida `desativado_em`/`desativado_por`/`motivo_desativacao`,
   tenta login do desativado (falha esperada), re-desativa
   (`already_disabled=true`), tenta self-disable
   (`SELF_DISABLE_FORBIDDEN`), imprime resumo sanitizado. Sem
   variáveis de ambiente manuais; sem secrets versionados;
   aborta se URL não for `ucrjtfswnfdlxwtmxnoo` ou se for
   `bhgifjrfagkzubpyqpew`. Smoke estático
   `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
   (após `E2E-RUNNER-FIX-A`). **E2E real não foi rerodado
   após o fix** — fica para a próxima
   (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou similar).
7. **Bug do runner no login bloqueado corrigido** (fase
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`,
   esta). Execução real do runner em staging avançou até
   `profile_inactive` e falhou em `login_blocked` com
   `HTTP 400 User is banned` tratado como erro fatal.
   Causa: `supabaseLogin` chamava `die()`/`process.exit` em
   qualquer HTTP 4xx e usava mensagem hardcoded "Login admin
   falhou" (rótulo incorreto para usuário descartável).
   Correção: helpers `loginExpectSuccess` (fatal, rótulo
   parametrizado) e `loginExpectFailure` (não-fatal, aceita
   `User is banned`/`banned`/`Banned user`/`User is already
   registered`). Fluxo continua para `idempotency` e
   `self_disable_blocked`. Smoke 32/32; regressão
   `admin-disable-user.smoke.js` 39/39.
8. **UI `#/cadastros/usuarios` integrada com `admin-disable-user`**
   (fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`, esta). Botão
   `Desativar` substitui placeholder `Em breve`; chama
   `admin-disable-user` via `window.supa.functions.invoke`;
   modal de confirmação com motivo opcional (≤ 500 chars);
   mapeia `FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/
   `LAST_ADMIN_FORBIDDEN`/`NOT_FOUND`/`AUTH_BAN_FAILED`/
   `COMPENSATION_FAILED`/`VALIDATION_ERROR`/`UNAUTHORIZED`
   para mensagens PT-BR; guarda de UX para self e inativos
   (proteção visual). Coluna `Status` na listagem. **E2E real
   do runner já havia passado em `result: PASS` em staging
   ANTES desta fase** (evidência sanitizada em LEDGER §5k;
   descartável `disable-edge-e2e-20260624-115027@tapetes.test`
   / `d12b005e-d455-4f78-b401-59ebd9f971c5` desativado, login
   bloqueado confirmado; execução parcial anterior
   `11c48a08-a8a6-48fb-8ddb-a6af1dba1667`). Smoke
   `cadastros-usuarios-auth-ui.smoke.js` 23/23 verde;
   regressões `cadastros-screens.smoke.js` 32/32,
   `admin-disable-user.smoke.js` 39/39,
   `admin-create-user.smoke.js` 17/17,
   `admin-disable-user-e2e-runner.smoke.js` 32/32 — todas
   verdes. **Sem deploy, sem Supabase real, sem SQL, sem
   produção, sem origin/main, sem PR #2 nesta fase.**
   Próxima fase: validação manual/automatizada da UI em
   staging.
9. **Validação manual da UI de desativação em staging
   registrada** (fase
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-VALIDATION-CLOSEOUT-A`,
   esta). HMNlead validou manualmente no app/staging
   `ucrjtfswnfdlxwtmxnoo`: tela `#/cadastros/usuarios`, botão
   `Desativar`, guarda de usuário já inativo, criação de
   fornecedor descartável ativo, desativação via UI — fluxo
   real passou. Produção `bhgifjrfagkzubpyqpew` e
   `origin/main` intocados. Detalhes em "Evidência da
   validação manual da UI em staging" acima.
 10. **Próxima etapa: decisão de release** para `origin/main` /
     produção, **somente com autorização explícita** do HMNlead
     (em fase separada). Pendências técnicas remanescentes:
     log de migrations do dashboard staging, warning de
     Tailwind CDN, favicon 404 — não bloqueantes.
 11. **Detalhe admin read-only do Pedido entregue** (fase
     `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`, esta). Nova tela
     `js/screens/pedido-detail.js` com `screenPedidoDetalhe(pedidoId)`;
     `js/router.js` estendido com match dinâmico `^#/pedidos/<uuid>$`
     admin-only; `index.html` carrega o módulo após `pedido-form.js`
     e antes de `boot.js`; botão "Visualizar" da listagem
     `#/pedidos` navega para o detalhe. Conteúdo: cabeçalho
     (número/status/cliente/prazo/criado em), dados gerais
     (observação/atualizado em) e tabela de itens (modelo, cor_1
     /cor_2, largura, preview 48x48, metros, observação do item).
     Ações Voltar (real) e Editar/Cancelar/Receber (placeholders
     `disabled` com `title="Em breve"`). Estritamente read-only:
     sem insert/update/delete/rpc, sem `functions.invoke`, sem
     `token_acesso`, sem `service_role`, sem rota pública, sem
     mutação em `lotes`/`pedido_eventos`, sem schema, sem OP, sem
     Edge Function, sem fornecedor. **Próxima fase recomendada**:
     `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B` (adição de ações
     reais: editar/cancelar/confirmar/receber), **somente com
     autorização explícita** do HMNlead.

## Estrutura final de responsabilidades

### `index.html` — HTML declarativo + ordem de scripts
- Apenas HTML + script tags com cache-busting local.
- Não contém mais `<script>` inline final.
- Carrega módulos clássicos e jsPDF via CDN.
- Ordem relevante de scripts: `op-persistir.js` → `op-pdf.js` →
  `op-nova.js` → `jspdf CDN` → `boot.js`.

### `js/boot.js` — setRoutes + main + startApp + main().catch
- Entrypoint do app.
- `startApp()` aguarda DOM ready se `document.readyState === 'loading'`.
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes`.
- Executa `main()` (hashchange, loadCurrentUser, direcionamento).
- Captura erro de boot via `main().catch()`.

### `js/router.js` — engine de roteamento
- `setRoutes`, `getRoutes`, `navigate`, `matchRoute`, `handleRoute`,
  `routeAfterLogin`.
- Engine genérica; não conhece as telas nem o estado da app.

### `js/ui.js` — helpers de UI com root lookup seguro
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`, `formField`,
  `dataTable`, `modal`, `confirmDialog`, `shellLayout`, `ADMIN_MENU`,
  `getAppRoot()` (lookup lazy do `#app`).
- O root é resolvido sob demanda, eliminando o erro `replaceChildren
  null` quando o boot era executado antes do `DOMContentLoaded`.

### `js/screens/op-nova.js` — screenNovaOP e UI/estado da Nova OP
- Closure inteira de `screenNovaOP` (com `~20` subfunções aninhadas).
- Proposta, blocos de fios, tecelagem, wrappers de persistência
  e recálculo.
- **Não** contém mais `gerarPdfCompraFios` (extraída em `7f3c6da`).
- Mantém read-only em Supabase (apenas `.select()`).

### `js/screens/op-pdf.js` — geração de PDF de compra de fios
- `gerarPdfCompraFios({ op, ordens })` (helper puro, sem closure).
- Exporta `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Não toca Supabase, não muta DOM.

### `js/screens/op-persistir.js` — helpers de persistência + persistirOP
- Helpers puros: `itensValidosOP`, `montarPayloadItensOP`,
  `montarPayloadFornecedoresOP`, `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` (8 writes da persistência).

### `js/screens/op-recalculo.js` — helpers de recálculo + aplicarRecalculoOP
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` (4 writes do recálculo).

### `js/screens/op-writes.js` — writes auxiliares de OP/fio/fornecedor
- `registrarRecebimentoOrdemFio` — atualiza `ordens_compra_fio`.
- `atribuirFornecedorFioOp` — atribui fornecedor de fio a etapa de OP.

### `js/screens/op-latex-admin.js` — tela admin de OP látex
- `renderOPLatexAdmin` — chamada quando `op.tipo === 'latex'`.

### `js/screens/painel.js` — tela painel
- `screenPainel` (placeholder inicial do admin).

### `js/screens/fornecedor.js` — telas de fornecedor
- `screenFornecedorHome`, `screenFornecedorEntregas`,
  `screenFornecedorLatex`, `screenFornecedorOrdens`.

### `js/screens/ops-list.js` — listagem de OPs
- `screenListaOPs` (read-only).

### `js/screens/cadastros.js` — cadastros
- 7 telas de cadastro + constantes `FORNECEDOR_TIPOS`,
  `labelFornecedorTipo`.

### `js/screens/pedidos-list.js` — listagem de Pedidos (admin)
- `screenPedidosLista` (read-only, com filtro por status).
- Botão "Visualizar" navega para `#/pedidos/<id>` (C3A).

### `js/screens/pedido-form.js` — formulário de criação de Pedido
- `screenPedidoNovo` (criação admin de rascunho).
- Composição: `pedidos.insert` + `pedido_itens.insert` (sem
  transação atômica, compensação manual em caso de falha).
- Preview de cor do item via slot fixo + `updatePreview()` (C2-R1).

### `js/screens/pedido-detail.js` — detalhe admin do Pedido
- `screenPedidoDetalhe(pedidoId)` (C3A).
- Resolve via match dinâmico em `js/router.js`:
  `^#/pedidos/<uuid>$, admin-only, sem public: true`.
- Carrega `pedidos` (com join aninhado `cliente:cliente_id(id, nome)`),
  `pedido_itens`, `modelos` e `cores` (consultas separadas para
  evitar joins frágeis no PostgREST).
- **Ações reais de status (C3B):** `TRANSITIONS` define a matriz
  restrita (rascunho→recebido, recebido→confirmado, rascunho
  /recebido/confirmado→cancelado; produzindo/entregue/cancelado
  terminais). Função interna `alterarStatus(novoStatus, btn)`
  valida via `canTransition`, executa `update` em `pedidos`
  (apenas campo `status`, com `.eq('id', pedidoId)`), atualiza
  `state.pedido.status` e chama `render()`. Cancelar usa
  `window.confirmDialog`. Para status terminais, exibe mensagem
  informativa.
- **Botão Editar (C3C1):** navega para `#/pedidos/<id>/editar`
  APENAS para status editáveis (rascunho / recebido, via
  `window.isPedidoEditavel`). Para os demais status, fica
  desabilitado (placeholder) com `title` explicativo.
- **Write mínimo (C3B):** APENAS `update` em `pedidos.status`
  (admin-only via RLS). Sem insert/update/delete em
  `pedido_itens`, sem insert em `pedido_eventos` (decisão C3B:
  best-effort fica para fase futura), sem mutação em
  `lotes`/`pedido_eventos`, sem `functions.invoke`, sem
  `token_acesso`, sem `service_role`, sem rota pública, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/pedido-edit.js` — edição admin dos dados gerais do Pedido
- `screenPedidoEditar(pedidoId)` (C3C1).
- Resolve via match dinâmico em `js/router.js`:
  `^#/pedidos/<uuid>/editar$, admin-only, sem public: true`.
- Carrega `pedidos` (campos editáveis) e `clientes` (para o
  select). Valida status editável via `window.isPedidoEditavel`
  (rascunho / recebido). Se não editável, exibe banner
  informativo, desabilita campos e botão Salvar.
- Form: `cliente_id` (select obrigatório), `prazo_entrega`
  (date opcional), `observacao` (textarea opcional).
- Após salvar (com sucesso), navega de volta para
  `#/pedidos/<id>`.
- **Write mínimo:** APENAS `update` em `pedidos` com payload
  restrito a 3 chaves (`cliente_id`, `prazo_entrega`,
  `observacao`). Sem update em `status`/`numero`, sem
  update/insert/delete em `pedido_itens`, sem insert em
  `pedido_eventos`, sem mexer em `lotes`, sem `functions.invoke`,
  sem `token_acesso`, sem `service_role`, sem rota pública, sem
  schema, sem OP, sem Edge Function, sem fornecedor, sem RPC.

### `js/screens/system-screens.js` — telas sistêmicas/login
- `screenLogin`, `screenNotFound`, `screenForbidden`.

### `js/screens/common.js` — componentes comuns de tela
- `shellLayout`, `ADMIN_MENU`.

### `js/calculo-op.js` — cálculo de domínio
- `larguraKey`, `calcularFiosOP`, `montarOrdensCompraFio`, `recalcularOP`,
  `consumoPorOrdem`, `totalEntregueCimaPorItem`, `percentualEntregueOP`,
  `agruparOrdensCompraFio`.

### Demais módulos de suporte
- `js/config.js` — configuração Supabase refs.
- `js/supabase-client.js` — client Supabase + write-guard.
- `js/environment-banner.js` — banner de ambiente.
- `js/auth.js` — `login`, `logout`, `loadCurrentUser`,
  `CURRENT_USER`.
- `js/badges.js` — `badgeTipo`, `badgeStatus`.

## Módulos extraídos (ordem cronológica completa)
1. `js/config.js` (commit `5547e27`, CONFIG-MODULE-A).
2. `js/supabase-client.js` (commit `6d50d08`, SUPABASE-CLIENT-MODULE-A).
3. `js/environment-banner.js` (commit `1f3238d`, ENV-BANNER-MODULE-A).
4. `js/auth.js` (commit `1b56571`, AUTH-MODULE-A).
5. `js/router.js` (commit `6bb203f`, ROUTER-MODULE-A).
6. `js/screens/system-screens.js` (commit `786f6b4`, SYSTEM-SCREENS-MODULE-A).
7. `js/screens/common.js` (commit `ed8e75c`, SCREENS-COMMON-MODULE-A).
8. `js/screens/cadastros.js` (commit `dd24365`, CADASTROS-SCREENS-MODULE-A).
9. `js/screens/ops-list.js` (commit `d7a8d25`, OPS-LIST-SCREEN-MODULE-A).
10. `js/screens/entrega-form.js` (commit `958f244`,
    ENTREGA-FORM-HELPER-MODULE-A).
11. `js/screens/entrega-writes.js` (commit `7ec1721`,
    ENTREGA-WRITES-MODULE-A; expandido em `e190022` Latex e
    `70635aa` Cima).
12. `js/screens/fornecedor.js` (commit `4b9ca12`,
    FORNECEDOR-SCREENS-MODULE-A).
13. `js/screens/op-form-helpers.js` (commit `c480324`,
    OP-FORM-HELPERS-MODULE-A).
14. `js/screens/op-writes.js` (commit `ab79f1c`,
    OP-ORDER-WRITE-MODULE-A; expandido em `1429950` com
    `atribuirFornecedorFioOp`).
15. `js/screens/op-latex-admin.js` (commit `69c0036`,
    OP-LATEX-ADMIN-MODULE-A).
16. `js/screens/painel.js` (commit `065a796`,
    SCREENPAINEL-MODULE-A).
17. `js/screens/op-recalculo.js` (commits `c599c21` + `4ce5080`,
    OP-RECALCULO-HELPERS-MODULE-A + OP-RECALCULO-WRITES-MODULE-A).
18. `js/screens/op-persistir.js` (commits `8fd4dd2` + `cac20f9`,
    OP-PERSISTIR-HELPERS-MODULE-A + OP-PERSISTIR-WRITES-MODULE-A).
19. `js/screens/op-nova.js` (commit `ce3dd14`,
    SCREENNOVAOP-MODULE-A).
20. `js/boot.js` (commit `4c18fe7`, ROUTES-BOOT-MODULE-A).
21. `js/screens/op-pdf.js` (commit `7f3c6da`,
    RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A).
22. `js/screens/pedidos-list.js` (commit `bf960f8`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1).
23. `js/screens/pedido-form.js` (commit `62a9f9a`,
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2; corrigido em `2de595c`
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1).
24. `js/screens/pedido-detail.js` (`7184388` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A
    + `d2b5a6a` RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B com
    `TRANSITIONS`, `ACTION_LABEL`, `canTransition`/`nextActionsForStatus`
    e função interna `alterarStatus` + commit desta fase
    RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 com botão Editar
    controlado por `isPedidoEditavel`).
25. `js/screens/pedido-edit.js` (`2d36077` C3C1: edição admin dos
    dados gerais do Pedido com `screenPedidoEditar`,
    `isPedidoEditavel`, payload restrito a 3 chaves).
26. `js/screens/pedido-itens-edit.js` (`acc96c3` C3C2B: edição
    admin de itens existentes com `screenPedidoItensEditar`,
    payload restrito a 3 chaves em `pedido_itens`, sem
    add/remove/reordenar + commit desta fase C3C2C1: também
    permite ADICIONAR novos itens com flag `isNew: true`,
    insert em batch com 5 chaves `pedido_id`/`modelo_id`/
    `metros`/`observacao`/`ordem`; sem delete/upsert, sem
    remover existente, sem drag-and-drop).

## Estado dos módulos críticos (após `7f3c6da`)

### `js/screens/op-nova.js`
- `screenNovaOP` (com closure inteira: `~20` subfunções).
- `buildBlocoFios`, `buildBlocoTecelagem`, `buildProposta`/`recompute`/`onAceitar`.
- `salvarSimulacao` / `abrirOP` (callers de `window.persistirOP`).
- `aplicarRecalculo` (caller de `window.aplicarRecalculoOP`).
- `buildOrdemPendenteRow` (caller de `window.registrarRecebimentoOrdemFio`).
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- Mantém read-only em Supabase (apenas `.select()`).
- Writes delegados para `op-persistir.js`, `op-recalculo.js`,
  `op-writes.js` e `op-latex-admin.js`.

### `js/screens/op-pdf.js`
- `gerarPdfCompraFios({ op, ordens })` — recebe `op` e `ordens` por
  argumento; **não depende** da closure de `op-nova.js`.
- Usa `window.jspdf.jsPDF` (CDN), `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Gera PDF e chama `doc.save("compra-fios-OP-{numero}-{ano}.pdf")`.
- Fallback `toast('Biblioteca de PDF não carregou', 'error')` se
  `window.jspdf.jsPDF` ausente.

### `js/screens/op-persistir.js`
- `persistirOP({ status, op, numero, ano, clienteSel, itens, fornSel,
  modelosById, parametrosByLargura })` — executa 8 writes da
  persistência (ops, lotes, op_itens, op_fornecedores,
  ordens_compra_fio). Retorna envelope
  `{ error, step, partial, opId }`.

### `js/screens/op-recalculo.js`
- `aplicarRecalculoOP({ opId, resultado, modo, ordens })` — executa 4
  writes do recálculo (`op_itens.update`, `saldo_fios_op.insert`,
  `saldo_fios` select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `js/boot.js`
- `window.RAVATEX_ROUTER.setRoutes({...})` — registra 15 rotas do app.
- `main()` — registra `hashchange`, carrega `CURRENT_USER`, direciona
  para `navigate('#/login')`, `handleRoute()` ou `routeAfterLogin()`.
- `startApp()` — aguarda DOM ready se
  `document.readyState === 'loading'`.
- `main().catch()` — toast de erro se o boot falhar.

### `js/ui.js`
- `getAppRoot()` — lookup lazy do root `#app` (substitui
  `document.getElementById('app')` direto).

## Riscos residuais
- 🔴 **`persistirOP` e `aplicarRecalculoOP` continuam sem transação
  cross-table.** Falhas parciais ainda podem deixar `op_itens`,
  `saldo_fios_op`, `saldo_fios` e `ops.status` em estado intermediário.
  Rollback parcial manual existe (reverter status para `'simulada'`,
  deletar OP recém-criada se lote falhar) mas não cobre todos os
  cenários.
- 🔴 **`op-nova.js` é um módulo grande (~800 linhas) com closure
  complexa** (`screenNovaOP` + `~20` subfunções aninhadas). Continua
  funcional e isolado em módulo próprio, mas é candidato a
  fatiamento futuro. **Extração adicional de fios/tecelagem/proposta
  não está recomendada neste ciclo** (vide "Decisão arquitetural").
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e **não
  atribuídas** ao refactor. Verificadas com `git stash` em commits
  anteriores.
- 🟡 O backdoor `*@tapetes.test` (ver histórico de D1) ainda depende
  de ação do dono para remoção.

## Testes recentes
- **SCREENNOVAOP-MODULE-A (`ce3dd14`):** 314/314 pass.
- **ROUTES-BOOT-MODULE-A (`4c18fe7`):** 368/368 pass.
- **RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A (`7f3c6da`):** 388/388 pass
  (regressão completa do refactor + novo `tests/op-pdf.smoke.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 (`bf960f8`):** testes focados
  passando (listagem admin de Pedidos + helper `pedido-ui.js`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (`62a9f9a`):** testes focados
  passando (formulário admin de criação de Pedido, sem RPC).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2-R1 (`2de595c`):** testes focados
  passando (correção do bug do preview de cor: slot fixo +
  `updatePreview()` com `replaceChildren`).
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (`7184388`):** 209/209
  pass nos testes focados (`pedido-detail` 30/30, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). Falhas pré-existentes em
  `ops-list-screen.smoke.js` (10/30) são do refactor monolítico
  antigo, fora do escopo.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B (commit desta fase):** 221/221
  pass nos testes focados (`pedido-detail` 42/42, `pedido-form` 35/35,
  `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema` 41/41,
  `boot` 22/22, `router` 34/34). 12 testes novos no
  `pedido-detail.smoke.js` cobrem: 5 transições permitidas,
  2 proibidas para produzindo/entregue, terminal de cancelado,
  `alterarStatus` definido e usado, update restrito a `status`
  (payload de 1 chave apenas), sem insert em `pedido_eventos`,
  `confirmDialog` apenas para cancelar (case-insensitive),
  botões reais com labels "Marcar como recebido"/"Confirmar
  pedido"/"Cancelar pedido", placeholder Editar via
  `placeholderButton(...)`, remoção do placeholder "Confirmar /
  Receber", re-render via `render()` após sucesso.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1 (commit desta fase):**
  263/263 pass nos testes focados (`pedido-edit` 35/35,
  `pedido-detail` 42/42, `pedido-form` 35/35, `pedido-ui` 18/18,
  `pedidos-list` 29/29, `pedidos-schema` 41/41, `boot` 25/25,
  `router` 38/38). 35 testes novos no `pedido-edit.smoke.js`
  cobrem: existência/sintaxe/namespace, ordem de scripts,
  match dinâmico admin-only `#/pedidos/<uuid>/editar` no
  router, SELECT em `pedidos`+`clientes`, UPDATE restrito a
  `pedidos` com payload de 3 chaves (`cliente_id`,
  `prazo_entrega`, `observacao`), ausência de update em
  `status`/`numero`, ausência de toque em
  `pedido_itens`/`pedido_eventos`/`lotes`, ausência de
  `functions.invoke`/Edge Function/token_acesso/service_role,
  validação de status editável via `isPedidoEditavel`,
  navegação de volta para o detalhe após sucesso, e
  atualização de `pedido-detail.js` para Editar funcional por
  status. 4 testes novos no `router.smoke.js` validam o
  match dinâmico da nova rota (admin-only, distinção vs
  detalhe, rejeição de IDs não-UUID, mock `screenPedidoEditar`).
  3 testes novos no `boot.smoke.js` validam a nova rota no
  boot chain. `pedidos-list.smoke.js` exigiu reescrita do
  teste `pedido-ui.js: não referencia OP` (não-strip-comments)
  após mudança em `pedido-ui.js`. Falhas pré-existentes em
  `tests/ops-list-screen.smoke.js` (10/30) continuam **fora
  do escopo**.
- **RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1 (commit desta fase):**
  316/316 pass nos testes focados (`pedido-itens-edit` 46/46,
  `pedido-edit` 35/35, `pedido-detail` 43/43, `pedido-form`
  35/35, `pedido-ui` 18/18, `pedidos-list` 29/29, `pedidos-schema`
  41/41, `boot` 28/28, `router` 41/41). 5 testes novos no
  `pedido-itens-edit.smoke.js` (C3C2C1): botão "+ Adicionar
  item" existe e chama `adicionarItem()`; insert de novos
  itens com 5 chaves permitidas (`pedido_id`, `modelo_id`,
  `metros`, `observacao`, `ordem`); insert NÃO contém campos
  proibidos (`id`, `largura`, `cor_1_id`, `cor_2_id`,
  `criado_em`); ordem calculada como `existingItems.length + i`;
  botão "Descartar novo item" apenas para `isNew`. 1 teste
  atualizado: insert permitido, delete/upsert ainda
  proibidos. 1 teste invertido: "TEM botão + Adicionar item"
  (em vez de "NÃO tem"). 1 teste renomeado: "NÃO tem
  'Remover' / 'removeBtn'" (remoção é C3C2C2). C3B status
  actions, C3C1 edição de dados gerais e C3C2B edição de
  itens existentes preservadas. Sem `git add .` (stage
  seletivo). Falhas pré-existentes em `tests/ops-list-screen.smoke.js`
  (10/30) continuam **fora do escopo**.

## Comandos seguros
- `node --test tests/<arquivo>.smoke.js` — testes focados por fase.
- `node --test tests/boot.smoke.js tests/router.smoke.js
  tests/op-nova.smoke.js tests/op-pdf.smoke.js tests/op-persistir.smoke.js
  tests/op-recalculo.smoke.js tests/op-writes.smoke.js
  tests/op-form-helpers.smoke.js tests/op-latex-admin.smoke.js
  tests/painel-screen.smoke.js tests/fornecedor-screens.smoke.js`
  — regressão completa do refactor.
- Servir local: `.\run-local.bat` (ou
  `python -m http.server 8765`) para `index-inline.smoke.js` e
  parte de `write-guard.smoke.js`.

## Documentação e prevalência

A hierarquia de fontes canônicas está em
`docs/DOCUMENTATION_INDEX.md`. Resumo:

- **Fontes canônicas (prevalecem):** `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`, `docs/architecture/CODE_HEALTH_RULES.md`,
  `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`,
  `Guide-and-governance-rules.stxt`.
- **Docs legadas (NÃO prevalecem):** `docs/superpowers/`,
  `docs/qa/`, `docs/DEPLOYMENT.md`, `docs/AI_AGENT_RULES.md`,
  `docs/BACKUP_AND_RESTORE.md`, `docs/HANDOFF.md` (todas
  carregam banner de aviso após `RAVATEX-TAPETES-DOCS-SANITIZE-A`).
- Em caso de divergência, as fontes canônicas prevalecem.

Senhas de teste antigas em `docs/qa/fase1-checklist.md` e
`docs/qa/fase2-checklist.md` foram anonimizadas em
`RAVATEX-TAPETES-DOCS-SANITIZE-A` (substituídas por
`[REDACTED_TEST_PASSWORD]`).

## Ações PROIBIDAS sem autorização explícita
- `db/10_reset_producao.sql` e `db/11_reset_producao.sql` (DELETE em
  massa de produção).
- Qualquer SQL contra `bhgifjrfagkzubpyqpew` sem backup.
- Push em `origin/main` (= produção).
- Editar `index.html`, `js/**`, `tests/**` durante fase docs-only.
- Tocar `origin/main` ou PR #2.
- Iniciar nova extração em `op-nova.js` (refactor congelado).

## Pendências de informação
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automático do Supabase? Quem sabe restaurar?
- O backdoor `*@tapetes.test` (ver histórico de D1) já foi removido?
- Há link/projeto Vercel real? (premissa atual: não — app é estático
  no GitHub Pages.)
