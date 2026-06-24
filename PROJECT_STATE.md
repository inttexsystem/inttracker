# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> Snapshot de estado canônico curto. Atualizado em **2026-06-24** (fase
> `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A` — design de semântica de
> exclusão/desativação de usuários; mantém refactor congelado e não
> altera código).
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
- **Staging separado de produção**: 2 repos, 2 refs Supabase.
  - `staging` → `controle-tapetes-staging` + ref `ucrjtfswnfdlxwtmxnoo`.
  - `origin` → `grupoterrabranca/controle-tapetes` + ref `bhgifjrfagkzubpyqpew`.

## Estado atual do refactor
- **Branch operacional:** `work/app-next`.
- **HEAD atual aceito:** `3c9c424` — "Design auth user deletion semantics".
- **staging/main atual:** `3c9c4247ffd9d8f1a710ff17f03340b6d2508f3b`
  (sincronizado com `work/app-next`).
- **origin/main oficial:** `1047181eba888242c6428de366cbd9fda2f1c72c`
  — **intocado** durante todo o ciclo de refactor/hardening.
- **PR #2:** **intocado** durante todo o ciclo.
- **Working tree esperado:** **limpo**.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor/hardening.
- **Supabase real:** **não acessado** em nenhuma fase de refactor
  (todos os testes rodam com `vm.runInContext` + `fakeSupa` mockado).
  A contagem `select count(*) from public.ops` foi feita
  manualmente em homologação contra `ucrjtfswnfdlxwtmxnoo` (staging) e
  confirmou 4 OPs.

### Marco fechado
**Marco fechada: ciclo de refactor arquitetural + hardening + extração
final do `op-pdf.js` está CONGELADO.**

Componentes estáveis:
- `index.html` declarativo, sem script inline final, com cache-busting
  `?v=20260623-asset1` em todos os 23 assets locais; CDNs externos
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
   (`index.html` com `?v=20260623-asset1` em 23 assets locais;
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
- 🟡 Staging mostra log `relation "supabase_migrations.schema_migrations"
  does not exist` (ruído do dashboard, não do app).
- 🟡 Tailwind CDN ainda gera warning de produção (não bloqueante;
  requer mudança de stack se for endereçar).
- 🟡 GitHub Pages staging ainda pode ser tratado depois, se necessário
  para homologação pública.

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
3. Decisão separada sobre merge/release para `origin/main`
   (somente com autorização explícita).
4. Pendências técnicas remanescentes: log de migrations do dashboard
   staging, warning de Tailwind CDN, favicon 404 — não bloqueantes.

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
