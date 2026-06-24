# Architecture Refactor Ledger — Ravatex Controle de Tapetes

> Ledger de fases do refactor arquitetural de
> `D:\OneDrive\Programação\Ravatex\controle-tapetes`.
> Última atualização: 2026-06-24 (HEAD `eb5d2e0`,
> fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A` —
> runner local automatizado para E2E de `admin-disable-user` em
> staging `ucrjtfswnfdlxwtmxnoo`; **sem deploy, sem Supabase real,
> sem SQL, sem UI, sem produção, sem origin/main** nesta fase;
> `js/**`, `index.html`, `db/**` e Edge Functions intocados).
> E2E real ainda não foi executado.

## 1. Premissas corrigidas
- **App estático**, não Next/Vercel.
- `index.html` único + JS clássico + Supabase.
- **Staging separado de produção** (2 repos, 2 refs Supabase).
- GitHub Pages publica no push em `origin/main` (produção).

## 2. Invariantes operacionais
- **Produção só por hostname oficial explícito** (grupoterrabranca.github.io).
- **Staging por padrão** fora de produção (qualquer outro hostname).
- **Write-guard preservado** (`_GUARD_BLOCK_WRITES` em
  `js/supabase-client.js`).
- **Supabase real não acessado em refactors** (todos os testes usam
  `vm.runInContext` + `fakeSupa` mockado).
- **Push só para `staging`** (`git push staging work/app-next:main`).
- **`origin/main` e PR #2 intocados** durante todo o refactor.
- **Sem segredo em relatório/doc** (`service_role`, senha, JWT
  secret, connection string com senha ou anon key completa são
  proibidos de aparecer em qualquer artefato versionado).
- **Testes focados por fase** (não rodar suíte completa por padrão).
- **Stage seletivo** em commits (proibido `git add .`).

## 3. Estado inicial do refactor
- **Branch operacional inicial:** `work/app-next` em `e190022` (antes
  do refactor arquitetural o repo já estava em um estado pós-D1 com
  baseline documental, monólito `index.html` intacto).
- **Staging repo:** `ravatexapps-dotcom/controle-tapetes-staging` (ref
  Supabase `ucrjtfswnfdlxwtmxnoo`).
- **Origin repo:** `grupoterrabranca/controle-tapetes` (ref Supabase
  `bhgifjrfagkzubpyqpew`, **produção**).
- **Produção preservada** durante todo o refactor (nenhum push em
  `origin/main`).

## 4. Tabela de fases

| Fase | Commit | Arquivos principais | Testes | Status |
|---|---|---|---|---|
| CONFIG-MODULE-A | `5547e27` | `js/config.js` | focados | aceito |
| SUPABASE-CLIENT-MODULE-A | `6d50d08` | `js/supabase-client.js` | focados | aceito |
| ENV-BANNER-MODULE-A | `1f3238d` | `js/environment-banner.js` | focados | aceito |
| AUTH-MODULE-A | `1b56571` | `js/auth.js` | focados | aceito |
| ROUTER-MODULE-A | `6bb203f` | `js/router.js` | focados | aceito |
| SYSTEM-SCREENS-MODULE-A | `786f6b4` | `js/screens/system-screens.js` | focados | aceito |
| SCREENS-COMMON-MODULE-A | `ed8e75c` | `js/screens/common.js` | focados | aceito |
| CADASTROS-SCREENS-MODULE-A | `dd24365` | `js/screens/cadastros.js` | 295/295 | aceito |
| OPS-LIST-SCREEN-MODULE-A | `d7a8d25` | `js/screens/ops-list.js` | 325/325 | aceito |
| ENTREGA-FORM-HELPER-MODULE-A | `958f244` | `js/screens/entrega-form.js` | 358/358 | aceito |
| ENTREGA-WRITES-MODULE-A | `7ec1721` | `js/screens/entrega-writes.js` | 385/385 | aceito |
| ENTREGA-LATEX-WRITES-MODULE-A | `e190022` | `js/screens/entrega-writes.js` | 400/400 | aceito |
| ENTREGA-CIMA-WRITES-MODULE-A | `70635aa` | `js/screens/entrega-writes.js` | 416/416 | aceito |
| FORNECEDOR-SCREENS-DIAG-A | `70635aa` | read-only (sem commit) | 268/268 | aceito |
| FORNECEDOR-SCREENS-MODULE-A | `4b9ca12` | `js/screens/fornecedor.js` | 290/290 | aceito com ressalvas |
| REFACTOR-STATE-DOCS-A | `3a301cf` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| OP-FORM-DIAG-A | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-LATEX-ADMIN-DIAG-A | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-FORM-HELPERS-MODULE-A | `c480324` | `js/screens/op-form-helpers.js` | 36/36 + 24/24 + regressão (163/163) | aceito com ressalva leve |
| OP-ORDER-WRITE-MODULE-A | `ab79f1c` | `js/screens/op-writes.js` | 24/24 + regressão focada | aceito com ressalva leve (contagem de testes reportada inconsistente) |
| OP-FORNECEDOR-WRITE-DIAG-B | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-FORNECEDOR-WRITE-MODULE-A | `1429950` | `js/screens/op-writes.js` | 49/49 + regressão focada | aceito com ressalva leve (contagem de testes reportada inconsistente) |
| OP-LATEX-ADMIN-WRITES-DIAG-A | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-LATEX-ADMIN-MODULE-A | `69c0036` | `js/screens/op-latex-admin.js` | 30/30 + regressão focada (172/172) | aceito com ressalva leve (push teve timeout, concluído com retry) |
| REFACTOR-STATE-DOCS-B | `29c260b` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| SCREENPAINEL-MODULE-A | `065a796` | `js/screens/painel.js` | 167/167 | aceito |
| OP-RECALCULO-DIAG-B | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-RECALCULO-HELPERS-MODULE-A | `c599c21` | `js/screens/op-recalculo.js` | 186/186 | aceito |
| OP-RECALCULO-WRITES-DIAG-C | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-RECALCULO-WRITES-MODULE-A | `4ce5080` | `js/screens/op-recalculo.js` | 190/190 | aceito com ressalva transacional |
| OP-PERSISTIR-DIAG-B | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-PERSISTIR-HELPERS-MODULE-A | `8fd4dd2` | `js/screens/op-persistir.js` | 220/220 | aceito |
| OP-PERSISTIR-WRITES-DIAG-C | (read-only) | `index.html` (análise) | n/a | aceito |
| OP-PERSISTIR-WRITES-MODULE-A | `cac20f9` | `js/screens/op-persistir.js` | 255/255 | aceito com ressalva transacional |
| REFACTOR-STATE-DOCS-C | `78cd93d` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| SCREENNOVAOP-MODULE-A | `ce3dd14` | `js/screens/op-nova.js` | 314/314 | aceito |
| ROUTES-BOOT-MODULE-A | `4c18fe7` | `js/boot.js` | 368/368 | aceito |
| REFACTOR-FINAL-DOCS-A | (após `4c18fe7`) | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| ADD-LOCAL-RUN-SCRIPT | `d5db6c7` | `run-local.bat` (tooling) | n/a | aceito |
| DELAY-APP-BOOT-DOM-READY | `87d4559` | `js/boot.js` (startApp + DOMContentLoaded) | 368/368 | aceito |
| RESOLVE-APP-ROOT-LOOKUP | `e0dbfcd` | `js/ui.js` (getAppRoot) | 368/368 | aceito |
| CACHE-BUSTING-LOCAL-ASSETS | `5d5b395` | `index.html` (?v=20260623-asset1) + smokes | 368/368 | aceito |
| OP-NOVA-SEAMS-DIAG-A | (read-only) | `js/screens/op-nova.js` (análise) | n/a | aceito |
| OP-NOVA-PDF-MODULE-A | `7f3c6da` | `js/screens/op-pdf.js` | 388/388 | aceito |
| REFACTOR-FINAL-DOCS-B | `e64d1cc` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| CODE-HEALTH-RULES | (a criar) | `docs/architecture/CODE_HEALTH_RULES.md` | docs-only | aceito |
| AUTH-EDGE-DESIGN-A | `88aa4fb` | `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| AUTH-EDGE-FUNCTION-A | `f6ac19b` | `supabase/functions/admin-create-user/index.ts`, `supabase/functions/admin-create-user/README.md`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/response.ts`, `supabase/README.md`, `tests/admin-create-user.smoke.js` | 17/17 smoke | aceito (sem deploy) |
| AUTH-ADMIN-UI-A | (a criar) | `js/screens/cadastros.js`, `tests/cadastros-usuarios-auth-ui.smoke.js`, `tests/cadastros-screens.smoke.js` (assert de banner) | 12/12 + 17/17 | aceito |
| AUTH-PROVISIONING-DOCS-A | `d9d08be` | `docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md`, `docs/DOCUMENTATION_INDEX.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md` | docs-only | aceito |
| AUTH-DELETE-USER-DESIGN-A | `3c9c424` | `docs/architecture/AUTH_DELETE_USER_DESIGN.md`, `docs/DOCUMENTATION_INDEX.md`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | aceito |
| AUTH-DELETE-UI-GUARD-A | `d99bcda` | `js/screens/cadastros.js` (remove `.from('usuarios').delete()` + placeholder "Em breve"), `tests/cadastros-usuarios-auth-ui.smoke.js`, `tests/cadastros-screens.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | 16/16 + 32/32 | aceito |
| AUTH-DISABLE-USER-SCHEMA-A | `77bcc6b` | `db/12_auth_user_disable_schema.sql`, `tests/auth-disable-user-schema.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md` | 20/20 + 17/17 + 16/16 + 32/32 | aceito (schema/RLS versionado; aplicado em staging em EVIDENCE-A) |
| AUTH-DISABLE-USER-SCHEMA-APPLY-A | `8fa924a` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` (registro da fase; SQL real executado por HMNlead no Supabase Dashboard staging e confirmado em EVIDENCE-A) | 20/20 + 65/65 (regressão leve) | aceito (docs-only; aplicação real confirmada em EVIDENCE-A) |
| AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A | `1a35e1d` | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md` (registro da aplicação real de `db/12_auth_user_disable_schema.sql` no Supabase staging `ucrjtfswnfdlxwtmxnoo`; execução manual pelo HMNlead; nenhuma execução de SQL por IAexec) | n/a (docs-only) | aceito (docs-only; aplicação real confirmada) |
| AUTH-DISABLE-USER-EDGE-A | `eb5d2e0` | `supabase/functions/admin-disable-user/index.ts` (criado), `supabase/functions/admin-disable-user/README.md` (criado), `tests/admin-disable-user.smoke.js` (criado), `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md` (Edge Function `admin-disable-user` — soft delete no perfil + ban Auth; **sem deploy**; sem Supabase real; sem alteração de UI; `js/**`, `index.html`, `db/**` e `admin-create-user` intocados) | 39/39 smoke + 17/17 + 20/20 + 16/16 + 32/32 (regressões focais) | aceito (local-only; deploy/validação staging em `...-EDGE-STAGING-DEPLOY-A`) |
| AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A | (HEAD da fase) | `scripts/staging/admin-disable-user-e2e.mjs` (criado), `tests/admin-disable-user-e2e-runner.smoke.js` (criado), `.gitignore` (atualizado: `.ravatex-local/`), `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`, `docs/DOCUMENTATION_INDEX.md` (runner local automatizado para E2E staging; **sem Supabase real, sem SQL, sem deploy, sem UI, sem produção, sem origin/main**; `admin-disable-user` intocado; **E2E real ainda não executado**) | 28/28 smoke + 39/39 + 17/17 (regressões focais) | aceito (local-only; E2E real em fase futura) |
| AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A | (futura) | Deploy controlado de `admin-disable-user` em staging + validação E2E | — | pendente (depende de EDGE-A local aceito) |
| AUTH-DISABLE-USER-UI-A | (futura) | `js/screens/cadastros.js` (botão "Desativar" via Edge Function deployada) | — | pendente (depende de EDGE-STAGING-DEPLOY-A) |

## 5. Ressalvas processuais aceitas em `FORNECEDOR-SCREENS-MODULE-A` (commit `4b9ca12`)

- **Escopo de testes ampliado para boot chain** em
  `tests/screens-common.smoke.js`, `tests/system-screens.smoke.js`
  e `tests/router.smoke.js`. Todos esses testes precisaram carregar
  o novo `fornecedor.js` no boot para que o `setRoutes` inline
  (que referencia `screenFornecedor*` como bare) não quebrasse com
  `ReferenceError`. A mudança é puramente de boot helpers; nenhuma
  asserção de comportamento foi enfraquecida.
- **Contagem de arquivos no relatório final** da fase
  `FORNECEDOR-SCREENS-MODULE-A` (anterior a este docs-only) estava
  inconsistente quanto ao número total de arquivos alterados
  versus criados. Este ledger registra a contagem corrigida:
  - **2 arquivos criados** (`js/screens/fornecedor.js`,
    `tests/fornecedor-screens.smoke.js`).
  - **8 arquivos modificados** (`index.html`, `tests/entrega-writes.smoke.js`,
    `tests/entrega-form.smoke.js`, `tests/ops-list-screen.smoke.js`,
    `tests/cadastros-screens.smoke.js`, `tests/screens-common.smoke.js`,
    `tests/system-screens.smoke.js`, `tests/router.smoke.js`).
  - **Total:** 10 arquivos (2 criados + 8 modificados) no commit
    `4b9ca12`.
- **Falhas em `tests/index-inline.smoke.js` e parte de
  `tests/write-guard.smoke.js` dependentes de `http.server :8765`**
  verificadas como **pré-existentes** (commits anteriores ao refactor
  arquitetural). Confirmado com `git stash` no commit `70635aa`:
  mesmas 6 falhas em `index-inline` e 17 em `write-guard`. Não
  atribuídas à extração de fornecedor.

## 5b. Ressalvas processuais aceitas em fases recentes (pós-`4b9ca12`)

- **`OP-FORM-HELPERS-MODULE-A` (commit `c480324`)**: o helper
  `disabledAttr` mudou de assinatura de `(node)` para
  `(disabled, node)` para que pudesse viver fora da closure de
  `screenNovaOP` e acessar a flag `readOnly` via parâmetro. Todos os
  call-sites inline foram atualizados para
  `disabledAttr(readOnly, ...)` e os 163 testes focados passaram
  (36 do op-form-helpers, 24 do op-writes inicial, e regressão).
- **`OP-ORDER-WRITE-MODULE-A` (commit `ab79f1c`) e
  `OP-FORNECEDOR-WRITE-MODULE-A` (commit `1429950`)**: o relatório
  final dessas fases teve **contagem de testes reportada de forma
  inconsistente** — usou-se uma "soma geral" em vez da contagem
  exata por suíte. As suítes individuais
  (`tests/op-writes.smoke.js`) passaram individualmente (24/24 e
  49/49 respectivamente, mais regressão focada 100%). Não bloqueante
  para a aceitação das fases.
- **`OP-LATEX-ADMIN-MODULE-A` (commit `69c0036`)**: o push para
  `staging` teve **timeout na primeira tentativa** e foi concluído
  com **retry** usando timeout maior. Conteúdo do commit e
  contagem de testes (30/30 + 172/172 regressão) estavam corretos.
  4 testes em arquivos de regressão
  (`tests/op-writes.smoke.js`, `tests/op-form-helpers.smoke.js`,
  `tests/entrega-writes.smoke.js`, `tests/fornecedor-screens.smoke.js`)
  precisaram ser adaptados para refletir a extração de
  `renderOPLatexAdmin` do inline (esperado, mudança no escopo
  permitido).
- **`OP-RECALCULO-WRITES-MODULE-A` (commit `4ce5080`)**: isolou os
  writes de recalculo (`op_itens.update`, `saldo_fios_op.insert`,
  `saldo_fios` select/update/insert, `ops.update status='em_producao'`)
  em `aplicarRecalculoOP` no módulo `op-recalculo.js`. **Não
  resolveu** a ausência de transação cross-table. O envelope de
  retorno (`{ error, step, partial }`) documenta o step de falha
  mas não compensa. Toasts no caller inline continuam dizendo
  "verifique no Supabase" em caso de falha intermediária.
- **`OP-PERSISTIR-WRITES-MODULE-A` (commit `cac20f9`)**: isolou os
  writes de persistência (ops insert/update, lotes
  select/insert/update, op_itens delete/insert, op_fornecedores
  delete/insert, ordens_compra_fio delete/insert) em `persistirOP`
  no módulo `op-persistir.js`. Mudança controlada: **deletes
  passaram a ser tratados como steps de erro** (anteriormente eram
  `await` sem tratamento). Rollback parcial existente (reverter
  status para `'simulada'` em falhas de 'aberta', deletar OP recém-
  criada se lote falhar) foi preservado dentro do helper. Risco
  transacional residual permanece.
- **`SCREENNOVAOP-MODULE-A` (commit `ce3dd14`)**: extraiu
  `screenNovaOP` inteira como módulo clássico IIFE, preservando a
  closure inteira (estado local + `~20` subfunções aninhadas). O
  call-site `#/ops/nova` em `setRoutes` foi atualizado de bare
  `screenNovaOP(null)` para `window.screenNovaOP(null)`.
  314/314 testes focados passaram.
- **`ROUTES-BOOT-MODULE-A` (commit `4c18fe7`)**: extraiu
  `setRoutes` + `main` + `main().catch` do inline para
  `js/boot.js`. Removido o último `<script>` inline final de
  `index.html` (47 linhas declarativas após a extração). O call-site
  em `setRoutes` foi atualizado para todas as referências
  `window.screen*`. O `js/router.js` (engine genérica) não foi
  alterado. 2 falhas pré-existentes em `tests/router.smoke.js` foram
  corrigidas (teste 6 sobre `screenPainel` inline e teste 34 sobre
  boot chain com `screenPainel` carregado). 368/368 testes focados
  passaram.

## 5c. Ressalvas processuais aceitas no ciclo de hardening + extração final (pós-`4c18fe7`)

- **`ADD-LOCAL-RUN-SCRIPT` (commit `d5db6c7`)**: adicionou
  `run-local.bat` para servir o app via
  `python -m http.server 8765` (com fallback `py -3`). Tooling
  opcional; sem alteração funcional no app. Pré-condição para
  validar a UI localmente após mudanças de boot.
- **`DELAY-APP-BOOT-DOM-READY` (commit `87d4559`)**: corrigiu o bug
  em que `main()` era executado no top-level de `js/boot.js` antes
  de `DOMContentLoaded`, gerando `replaceChildren` em `null` quando
  `setApp` ainda não havia resolvido o root. Mudança: `main()` foi
  movido para `startApp()`, que checa
  `document.readyState === 'loading'` e adiciona um listener
  `DOMContentLoaded` se necessário. staging/main recebeu o patch;
  origin/main intocado.
- **`RESOLVE-APP-ROOT-LOOKUP` (commit `e0dbfcd`)**: `setApp` em
  `js/ui.js` foi refatorado para fazer lookup lazy do root `#app`
  via `getAppRoot()`. Após o cache limpo do navegador (Disable cache
  + Ctrl+F5), o erro `replaceChildren null` desapareceu. origin/main
  intocado.
- **`CACHE-BUSTING-LOCAL-ASSETS` (commit `5d5b395`)**: `index.html`
  passou a versionar 23 assets locais com `?v=20260623-asset1`.
  CDNs externos (Tailwind, Google Fonts, Supabase, jspdf) foram
  preservados **sem** `?v=`. Os smoke tests `boot.smoke.js` e
  `router.smoke.js` foram adaptados para aceitar a query string.
  staging/main recebeu o patch; origin/main intocado.
- **`OP-NOVA-SEAMS-DIAG-A` (read-only)**: diagnóstico das seams
  de `js/screens/op-nova.js`. Achados:
  - 831 linhas; sem writes Supabase diretos.
  - Writes já estavam em `op-persistir`, `op-recalculo`,
    `op-writes`.
  - `gerarPdfCompraFios` foi a **única** extração de baixo risco
    identificada.
  - `buildBlocoFios`, `buildBlocoTecelagem` e `buildProposta`
    foram classificadas como acoplamento médio-alto/alto à
    closure, **não recomendadas** para extração neste ciclo.
  - Recomendação: extrair apenas o PDF e congelar o refactor.
- **`OP-NOVA-PDF-MODULE-A` (commit `7f3c6da`)**: criou
  `js/screens/op-pdf.js` com `gerarPdfCompraFios({ op, ordens })`,
  sem dependência da closure de `op-nova.js`. Exports:
  `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`. O call-site em
  `buildBlocoFios` foi atualizado para
  `window.gerarPdfCompraFios({ op, ordens })`. `index.html` carrega
  `op-pdf.js` antes de `op-nova.js` (e depois de
  `op-persistir.js`). 8 smoke tests foram corrigidos para aceitar
  o cache-busting `?v=`. 388/388 testes focados passaram. staging
  recebeu o patch; origin/main intocado.

## 5d. Decisão arquitetural — congelamento do refactor

A partir de `7f3c6da`, o ciclo de refactor + hardening + extração
final está **CONGELADO**.

Justificativa:
- `index.html` está declarativo, com cache-busting local.
- `js/boot.js` é o entrypoint e respeita DOM ready.
- `js/router.js` é engine genérica.
- `js/ui.js` tem root lookup seguro (`getAppRoot`).
- Telas e writes críticos estão modularizados.
- `op-pdf.js` foi extraído.
- `op-nova.js` ainda é grande (~800 linhas), mas **sem writes
  Supabase diretos** e com closure aceitável.
- Extrair `buildBlocoFios`, `buildBlocoTecelagem` ou
  `buildProposta` agora **deslocaria complexidade** para a fronteira
  da closure sem ganho proporcional, e **aumentaria risco**.

Próxima fase esperada: **homologação / release**, não nova
extração.

## 5e. Regras de saúde arquitetural (`CODE-HEALTH-RULES`)

Fase docs-only para criação de `docs/architecture/CODE_HEALTH_RULES.md`,
documento vinculante com 18 regras de saúde arquitetural que toda nova
fase deve respeitar.

Regras cobrem:

- Princípio central (app simples, estático, modular).
- `index.html` declarativo e `js/boot.js` como entrypoint.
- Separação de responsabilidades (`router.js`, `ui.js`, screens).
- Limites de tamanho para arquivos e funções.
- Helpers puros, writes Supabase, reads Supabase.
- Autenticação e perfil (`auth.users.id = public.usuarios.id`).
- Cache-busting obrigatório em assets locais.
- Testes proporcionais ao risco.
- Fases com escopo único (não misturar diagnóstico, refactor, feature, docs).
- Regras de Git (push seletivo, sem `git add .`, sem `origin` sem autorização).
- Critérios de bloqueio arquitetural.
- Auditoria periódica read-only.

Documentos principais atualizados para referenciar `CODE_HEALTH_RULES.md`:
`PROJECT_STATE.md`, `AGENT_HANDOFF.md` e este LEDGER.

## 5f. Saneamento documental (`DOCS-SANITIZE-A`)

Fase docs-only para saneamento da documentação legada, evitando que
IAexec/ChatGPT use `docs/superpowers`, `docs/qa` ou docs antigos da
raiz de `docs/` como fonte da verdade após o refactor/hardening.

Ações:

- Criado `docs/DOCUMENTATION_INDEX.md` (índice de fontes canônicas
  vs. legadas, com regra explícita de prevalência).
- Criado `docs/superpowers/README.md` (banner de conteúdo
  legado/histórico; `plans/` marcados como **PERIGOSO PARA IA**).
- Criado `docs/qa/README.md` (banner de checklist histórico; aviso
  de credenciais).
- Senhas de teste em `docs/qa/fase1-checklist.md` e
  `fase2-checklist.md` foram **substituídas** por
  `[REDACTED_TEST_PASSWORD]` (e-mails preservados para histórico).
- Banners adicionados em `docs/DEPLOYMENT.md`,
  `docs/AI_AGENT_RULES.md`, `docs/BACKUP_AND_RESTORE.md`,
  `docs/HANDOFF.md` e `docs/superpowers/STATUS.md`.
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` e este LEDGER foram
  atualizados para registrar a fase, apontar para
  `DOCUMENTATION_INDEX.md` e listar as ações de saneamento.

A regra de prevalência é: em caso de divergência,
`PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
`docs/architecture/CODE_HEALTH_RULES.md`,
`docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` e
`Guide-and-governance-rules.stxt` prevalecem sobre
`docs/superpowers/`, `docs/qa/` e docs legados na raiz de
`docs/`.

## 5g. Ressalva processual — `AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`

A fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A` (commit
`8fa924a`) registrou a **orientação** e a validação local para
aplicação de `db/12_auth_user_disable_schema.sql` no Supabase
staging, mas marcou a execução real do SQL como pendente de HMNlead
no Dashboard. A fase
`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A` (esta
fase) **não rodou SQL** e **não acessou o Supabase** — é
exclusivamente **docs-only** e registra a **aplicação real** feita
manualmente pelo HMNlead no SQL Editor do Supabase **staging**
`ucrjtfswnfdlxwtmxnoo` em `2026-06-24`.

Evidências registradas:

- **Baseline pré-aplicação** (HMNlead, SQL read-only no staging):
  colunas existentes em `public.usuarios` = `id`, `email`, `nome`,
  `tipo`, `fornecedor_id`, `criado_em`;
  `auth_users_total = 3`, `public_usuarios_total = 3`,
  `auth_sem_perfil = 0`, `perfil_sem_auth = 0`;
  policies `usuarios_admin_all` e `usuarios_select` no estado
  original; `is_admin()` consultava apenas `tipo`; `meu_fornecedor_id()`
  retornava `fornecedor_id` sem checar `ativo`.
- **Aplicação real**: `db/12_auth_user_disable_schema.sql` aplicado
  manualmente pelo HMNlead no SQL Editor do Dashboard. Nenhum SQL
  destrutivo foi aplicado. `db/10_reset_producao.sql` e
  `db/11_reset_ops.sql` **não** foram rodados. Produção
  `bhgifjrfagkzubpyqpew` **não** foi tocada.
- **Pós-aplicação** (HMNlead, SQL read-only): 4 colunas novas em
  `public.usuarios` (`ativo boolean NOT NULL DEFAULT TRUE`,
  `desativado_em timestamptz NULL`, `desativado_por uuid NULL`,
  `motivo_desativacao text NULL`); funções `is_admin()` e
  `meu_fornecedor_id()` recriadas com checagem de `ativo`;
  policies `usuarios_select`, `usuarios_admin_all` e
  `usuarios_self_update` recriadas; `ativo = true, total = 3`;
  `auth_users_total = 3`; `public_usuarios_total = 3`;
  `auth_sem_perfil = 0`; `perfil_sem_auth = 0`. **Nenhum usuário
  foi criado, excluído ou desativado** durante a aplicação.
- **Validação manual do app pós-schema** (HMNlead, em staging):
  login/admin OK; `#/cadastros/usuarios` carrega; `+ Novo usuário`
  visível; exclusão insegura continua bloqueada como `Em breve`;
  console sem erros críticos de Auth/RLS/listagem. Avisos não
  bloqueantes: warning de Tailwind CDN; `favicon.ico` 404.

A correção do LEDGER §4 nesta fase ajustou três referências
anteriormente desalinhadas: `AUTH-DELETE-UI-GUARD-A` agora aponta
para `d99bcda`; `AUTH-DISABLE-USER-SCHEMA-A` agora aponta para
`77bcc6b`; `AUTH-DISABLE-USER-SCHEMA-APPLY-A` agora aponta para
`8fa924a`. A entrada `AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`
foi adicionada.

Regra de continuidade: **não reaplicar**
`db/12_auth_user_disable_schema.sql` sem necessidade (a migration é
idempotente, mas o estado esperado já está aplicado em staging);
**não avançar** para produção `bhgifjrfagkzubpyqpew` sem
autorização explícita do HMNlead; próxima fase liberada é
`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (Edge Function
`admin-disable-user`).

## 5h. Ressalva processual — `AUTH-DISABLE-USER-EDGE-A`

A fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (esta fase) criou
**localmente no repo** a Edge Function `admin-disable-user` em
`supabase/functions/admin-disable-user/index.ts` + `README.md`,
mais o smoke estático `tests/admin-disable-user.smoke.js`. **Sem
deploy, sem Supabase real, sem SQL, sem alteração de UI.**

Resumo da implementação:

* **Método:** `POST` (aceita `OPTIONS` para preflight CORS).
* **Validação do chamador:** JWT no header `Authorization` →
  `callerClient.auth.getUser` → consulta `public.usuarios`
  exigindo `tipo = 'admin' AND ativo IS TRUE`. Em falha:
  `UNAUTHORIZED` (401) ou `FORBIDDEN` (403).
* **Validação do payload:** `user_id` (obrigatório, regex UUID),
  `reason` (opcional, trim, ≤ 500 chars). Em falha:
  `VALIDATION_ERROR` (400).
* **Bloqueio de auto-desativação:** `target_id === caller_id` →
  `SELF_DISABLE_FORBIDDEN` (403).
* **Bloqueio do último admin ativo:** se `target.tipo === 'admin'`,
  conta `count(ativo = true AND tipo = 'admin')` em
  `public.usuarios`; se `<= 1` → `LAST_ADMIN_FORBIDDEN` (403).
* **Idempotência:** se `target.ativo === false`, retorna `200` com
  `{ ..., already_disabled: true }` sem reexecutar.
* **Soft delete no perfil:** `update({ ativo: false, desativado_em,
  desativado_por, motivo_desativacao })` via `service_role` server-side.
  Não usa `.delete()`. Em falha: `PROFILE_UPDATE_FAILED` (500).
* **Ban Auth:** `auth.admin.updateUserById(target_id, { ban_duration:
  '876000h' })` server-side via `service_role`. **Não usa
  `auth.admin.deleteUser`** (sem hard delete).
* **Compensação:** se o ban falhar, tenta `update({ ativo: true,
  desativado_em: null, desativado_por: null, motivo_desativacao: null })`
  para reverter o soft delete. Se a reversão também falhar:
  `COMPENSATION_FAILED` (500, requer ação manual).
* **Resposta de sucesso:** `200` com
  `{ user_id, email, tipo, ativo: false, auth_banned: true }`.

Validação estática: `tests/admin-disable-user.smoke.js` 39/39 verde.
Regressões focais preservadas: `admin-create-user.smoke.js` 17/17,
`auth-disable-user-schema.smoke.js` 20/20,
`cadastros-usuarios-auth-ui.smoke.js` 16/16,
`cadastros-screens.smoke.js` 32/32.

Não-regras (verificadas por assert):

* `js/**`, `index.html`, `db/**` e `admin-create-user` **intocados**.
* `cadastros.js` continua chamando `functions.invoke('admin-create-user')`
  apenas; `functions.invoke('admin-disable-user')` **não** foi
  adicionado à UI (placeholder `Em breve` permanece).
* `index.html` **não** referencia `admin-disable-user` (Edge
  Function é invocada por `supabase.functions.invoke`, sem
  `<script>`).
* Sem hardcoded secrets: `service_role`, `SUPABASE_SERVICE_ROLE_KEY`,
  JWTs (`eyJ...eyJ...`) — todos ausentes.
* `_shared/cors.ts` e `_shared/response.ts` reusados sem
  alteração; nenhum helper novo foi introduzido.

Limitação de validação nesta fase: **Deno não está disponível
localmente**, então `deno check` não foi executado (não instalar
sem autorização). A validação TypeScript fica para fase de deploy
em staging (`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`).

Regra de continuidade: **não deployar** sem fase dedicada; **não
alterar UI** antes do deploy ser validado em staging; **não avançar**
para produção `bhgifjrfagkzubpyqpew` sem autorização explícita do
HMNlead. Próxima fase:
`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`.

## 5i. Ressalva processual — `AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`

A fase `RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A` (esta
fase) criou **localmente no repo** o runner automatizado para E2E
de `admin-disable-user` em staging. **Sem deploy, sem Supabase real,
sem SQL, sem alteração de UI, sem produção.**

Arquivos criados:

* `scripts/staging/admin-disable-user-e2e.mjs` (ESM, sem deps
  externas; usa `fetch` nativo do Node 18+).
* `tests/admin-disable-user-e2e-runner.smoke.js` (smoke estático
  28/28 verde).

Arquivo alterado:

* `.gitignore` — adicionado `.ravatex-local/` para isolar a config
  do runner.

Arquivos docs-only atualizados: `PROJECT_STATE.md`,
`AGENT_HANDOFF.md`, este LEDGER, `docs/DOCUMENTATION_INDEX.md`.

Comandos:

* `node scripts/staging/admin-disable-user-e2e.mjs setup` — detecta
  staging automaticamente de `js/config.js` (URL + anon key já
  públicas); aborta se URL contiver `bhgifjrfagkzubpyqpew` (ref
  de produção); pede admin email + admin password uma única vez;
  opcionalmente `fornecedor_id` ou autodetect; salva em
  `.ravatex-local/admin-disable-user-e2e.config.json` (gitignored);
  nunca imprime a senha em cleartext.
* `node scripts/staging/admin-disable-user-e2e.mjs run` — carrega
  config; aborta se URL não for staging; login admin via
  `/auth/v1/token?grant_type=password`; valida `tipo=admin AND
  ativo=true` em `public.usuarios`; resolve `fornecedor_id` (config
  ou autodetect via `GET /rest/v1/fornecedores?order=id&limit=1`);
  gera email descartável `disable-edge-e2e-<ts>@tapetes.test` e
  senha em memória; cria descartável via
  `POST /functions/v1/admin-create-user`; valida perfil criado;
  login como descartável; tenta desativar admin esperando
  `FORBIDDEN`; revalida admin ativo; re-login admin; desativa
  descartável esperando `ativo=false`, `auth_banned=true`,
  `already_disabled=false`; valida `desativado_em`/`desativado_por`/
  `motivo_desativacao` em `public.usuarios`; tenta login do
  desativado esperando falha; re-desativa esperando
  `already_disabled=true`; tenta self-disable esperando
  `SELF_DISABLE_FORBIDDEN`; imprime resumo sanitizado.

Garantias:

* **Anti-produção:** guard explícito aborta se URL contiver
  `bhgifjrfagkzubpyqpew`. URL deve conter `ucrjtfswnfdlxwtmxnoo`
  senão aborta.
* **Anti-secret:** nunca imprime password, anon key, JWT, refresh
  token, access token, cookie ou `service_role`. Helper
  `sanitize()` mascara tokens/JWTs/passwords em mensagens de erro.
  Senha de teste só existe em memória.
* **Sem SQL manual:** runner usa apenas HTTP (`/rest/v1`,
  `/functions/v1`, `/auth/v1`).
* **Sem `.delete()`:** runner não chama
  `.from('usuarios').delete()` nem `auth.admin.deleteUser`.
* **Sem `.env`:** runner não cria nem lê `.env`; usa diretório
  gitignored `.ravatex-local/`.

Validação estática: `node --test
tests/admin-disable-user-e2e-runner.smoke.js` 28/28 verde.
Regressões focais preservadas: `admin-create-user.smoke.js` 17/17,
`admin-disable-user.smoke.js` 39/39.

Limitação: Deno não está disponível localmente; `deno check` não
foi executado. A validação TypeScript do `.ts` da Edge Function
fica para a fase de deploy. O runner é JS puro e foi validado com
`node --check` + `node --test` no smoke.

Regra de continuidade: **não rodar o E2E real** (`run`) sem
revisão do runner e sem autorização; **não versionar** o arquivo
`.ravatex-local/admin-disable-user-e2e.config.json`; **não
avançar** para produção `bhgifjrfagkzubpyqpew` sem autorização
explícita do HMNlead. Próxima fase:
`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` (rodar o `run` real
após revisão).

## 6. Módulos extraídos (lista canônica)

| Módulo | Commit de extração | Fase |
|---|---|---|
| `js/config.js` | `5547e27` | CONFIG-MODULE-A |
| `js/supabase-client.js` | `6d50d08` | SUPABASE-CLIENT-MODULE-A |
| `js/environment-banner.js` | `1f3238d` | ENV-BANNER-MODULE-A |
| `js/auth.js` | `1b56571` | AUTH-MODULE-A |
| `js/router.js` | `6bb203f` | ROUTER-MODULE-A |
| `js/screens/system-screens.js` | `786f6b4` | SYSTEM-SCREENS-MODULE-A |
| `js/screens/common.js` | `ed8e75c` | SCREENS-COMMON-MODULE-A |
| `js/screens/cadastros.js` | `dd24365` | CADASTROS-SCREENS-MODULE-A |
| `js/screens/ops-list.js` | `d7a8d25` | OPS-LIST-SCREEN-MODULE-A |
| `js/screens/entrega-form.js` | `958f244` | ENTREGA-FORM-HELPER-MODULE-A |
| `js/screens/entrega-writes.js` | `7ec1721` (+ `e190022`, `70635aa`) | ENTREGA-WRITES-MODULE-A (+ LATEX, + CIMA) |
| `js/screens/fornecedor.js` | `4b9ca12` | FORNECEDOR-SCREENS-MODULE-A |
| `js/screens/op-form-helpers.js` | `c480324` | OP-FORM-HELPERS-MODULE-A |
| `js/screens/op-writes.js` | `ab79f1c` (+ `1429950`) | OP-ORDER-WRITE-MODULE-A (+ OP-FORNECEDOR-WRITE-MODULE-A) |
| `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-MODULE-A |
| `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| `js/screens/op-recalculo.js` | `c599c21` (+ `4ce5080`) | OP-RECALCULO-HELPERS-MODULE-A (+ OP-RECALCULO-WRITES-MODULE-A) |
| `js/screens/op-persistir.js` | `8fd4dd2` (+ `cac20f9`) | OP-PERSISTIR-HELPERS-MODULE-A (+ OP-PERSISTIR-WRITES-MODULE-A) |
| `js/screens/op-nova.js` | `ce3dd14` | SCREENNOVAOP-MODULE-A |
| `js/boot.js` | `4c18fe7` | ROUTES-BOOT-MODULE-A |
| `js/screens/op-pdf.js` | `7f3c6da` | RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A |

## 7. Inline remanescente em `index.html` (após `7f3c6da`)

**NENHUM.** `index.html` agora é puramente declarativo: HTML +
ordem de scripts. Não há `<script>` inline final. Todos os 23 assets
locais carregam com `?v=20260623-asset1` (cache-busting); CDNs
externos (Tailwind, Google Fonts, Supabase, jspdf) permanecem sem
`?v=`.

`screenPainel` foi extraída para `js/screens/painel.js`.
`renderOPLatexAdmin` foi extraída para `js/screens/op-latex-admin.js`.
`screenNovaOP` foi extraída para `js/screens/op-nova.js`.
`aplicarRecalculo` e `persistir` foram **removidos** do inline; seus
writes agora são executados por `aplicarRecalculoOP` e `persistirOP`
respectivamente.
`setRoutes` e `main` foram extraídos para `js/boot.js`.
`gerarPdfCompraFios` foi extraída para `js/screens/op-pdf.js`.

Ordem de scripts (relevante): `op-persistir.js` → `op-pdf.js` →
`op-nova.js` → `jspdf CDN` → `boot.js`.

## 8. Fechamento do ciclo de refactor + hardening + extração final

### Marcos
- **Marco:** `index.html` sem inline final (declarativo) e com
  cache-busting `?v=20260623-asset1` em 23 assets locais.
- **Marco:** `js/boot.js` é o entrypoint e respeita DOM ready
  (`startApp` aguarda `DOMContentLoaded` se
  `document.readyState === 'loading'`).
- **Marco:** `js/router.js` é engine genérica, intocado no ciclo.
- **Marco:** `js/ui.js` tem root lookup seguro (`getAppRoot`).
- **Marco:** rotas e bootstrap extraídos para `js/boot.js`.
- **Marco:** `tests/router.smoke.js` corrigido para nova arquitetura,
  34/34 pass.
- **Marco:** `op-pdf.js` extraído de `op-nova.js` (única extração
  recomendada pelo `OP-NOVA-SEAMS-DIAG-A`).
- **Marco:** app estático agora tem separação clara entre HTML, boot,
  router, screens, writes e cálculo.
- **Marco:** refactor + hardening + extração final **CONGELADO**
  em `7f3c6da` (vide seção 5d).

### Estrutura final
- **`index.html`** — HTML declarativo + ordem de scripts + cache-busting
  local.
- **`js/boot.js`** — setRoutes + main + startApp + main().catch
  (entrypoint, respeita DOM ready).
- **`js/router.js`** — engine genérica de roteamento.
- **`js/ui.js`** — helpers de UI com `getAppRoot` (lookup lazy).
- **`js/screens/`** — telas e writes auxiliares.
- **`js/calculo-op.js`** — cálculo de domínio.
- **`js/auth.js`, `js/config.js`, `js/supabase-client.js`,
  `js/environment-banner.js`, `js/badges.js`** — infraestrutura de
  suporte.

### Ressalvas
- `op-nova.js` permanece grande (`~800` linhas) e com closure
  complexa, mas agora isolado em módulo próprio e **sem writes
  Supabase diretos**. Continua funcional. **Extração adicional de
  fios/tecelagem/proposta não está recomendada neste ciclo**
  (vide seção 5d).
- `persistirOP` e `aplicarRecalculoOP` continuam sem transação
  cross-table. A ausência de transação é **risco de
  produto/dados**, **não** regressão do refactor.
- `persistirOP` trata deletes como erro (mudança controlada em
  relação ao inline antigo). Testes de regressão cobrem este
  comportamento.
- Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e **não
  atribuídas** ao refactor. Verificadas com `git stash` em commits
  anteriores.
- O backdoor `*@tapetes.test` (ver histórico de D1) ainda depende
  de ação do dono para remoção.
- Staging mostra log `relation
  "supabase_migrations.schema_migrations" does not exist` (ruído do
  dashboard, não do app).
- Tailwind CDN ainda gera warning de produção (não bloqueante).

## 9. Próximos passos recomendados

1. **Validação/homologação staging** — validar a tela Nova OP e
   fluxos críticos em homologação. Confirmar que
   `replaceChildren null` não voltou.
2. **Decisão sobre publicar/habilitar staging via GitHub Pages** —
   se necessário para homologação pública, em fase própria.
3. **Merge/release para `origin/main`** — somente com aprovação
   explícita do dono do projeto. Em fase própria, **não** automática.
4. **Design Auth concluído:** executar
   `RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A` →
   `RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A` →
   `RAVATEX-TAPETES-AUTH-ADMIN-UI-A` →
   `RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`.
5. **Futuro opcional:** `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A` —
   decidir se exclusão remove só `public.usuarios` ou também
   `auth.users`.
6. **Futuro opcional:** `RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A` —
   diagnosticar `buildBlocoFios` (somente se houver benefício
   prático e autorização explícita).
7. **Futuro opcional:** `RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A` —
   diagnosticar `buildProposta` / `recompute` / `onAceitar`
   (idem).
8. **Futuro opcional:** `RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A` —
   avaliar RPC/transações Supabase para `persistirOP` e
   `aplicarRecalculoOP` (idem).

**Nota:** os itens 6-8 são **opcionais** e **não** devem ser tratados
como continuação obrigatória do refactor. O ciclo de refactor +
hardening + extração final está **congelado** em `7f3c6da`
(vide seção 5d). O item `RAVATEX-TAPETES-OP-PDF-MODULE-A` foi
**executado** em `7f3c6da`; não está mais em backlog.

**Auth:** `RAVATEX-TAPETES-AUTH-EDGE-DESIGN-A`,
`RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`,
`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`,
`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`,
`RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A` (runbook),
`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A` (design de exclusão),
`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A` (contenção de UI),
`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A` (schema de desativação
versionado), `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`
(orientação para apply, commit `8fa924a`),
`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`
(registro da aplicação real, commit `1a35e1d`),
`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A` (Edge Function
`admin-disable-user` criada localmente, **sem deploy**, commit
`eb5d2e0`) e
`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A` (runner
local de E2E, **sem E2E real ainda**) estão **concluídos (local)**.
Teste fornecedor 403 confirmado em staging. UI guard removeu
`.from('usuarios').delete()` do front-end; schema de desativação
**aplicado e validado em staging** (fase `EVIDENCE-A`): 4 colunas
novas em `public.usuarios`; funções `is_admin`/`meu_fornecedor_id`
e policies `usuarios_select`/`usuarios_admin_all`/
`usuarios_self_update` recriadas com checagem de `ativo`; todos os
3 perfis existentes ficaram `ativo = true`; nenhum usuário foi
criado, excluído ou desativado durante a aplicação; produção
`bhgifjrfagkzubpyqpew` não foi tocada. Edge Function
`admin-disable-user` (fase `EDGE-A`) criada em
`supabase/functions/admin-disable-user/index.ts` + `README.md` +
`tests/admin-disable-user.smoke.js` (39/39 verde); valida admin
ativo server-side; bloqueia auto-desativação e último admin;
soft delete + ban Auth via `auth.admin.updateUserById(target_id,
{ ban_duration: '876000h' })`; compensa (reativa perfil) se ban
falhar; **sem `auth.admin.deleteUser` e sem `.delete()`**; UI
continua com placeholder `Em breve`. Runner local de E2E (fase
`E2E-AUTO-RUNNER-A`) em `scripts/staging/admin-disable-user-e2e.mjs`
+ `tests/admin-disable-user-e2e-runner.smoke.js` (28/28 verde);
detecta staging de `js/config.js`; aborta se URL não for
`ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`; sem
variáveis de ambiente manuais; sem secrets versionados; config
em `.ravatex-local/admin-disable-user-e2e.config.json` (gitignored).
**E2E real ainda não foi executado.** Próximas fases:
`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A` (deploy
controlado em staging e validação manual) →
`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` (rodar o `run` real
contra staging) → `RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`
(restaurar botão "Desativar" na UI).
**Pendência de decisão do HMNlead:** 7 perguntas listadas na seção 9
do design (`docs/architecture/AUTH_DELETE_USER_DESIGN.md`) ainda
abertas. **Não avançar** para produção sem autorização explícita.
**Não reaplicar** `db/12_auth_user_disable_schema.sql` em staging
sem necessidade: a migration é idempotente, mas o estado esperado
já está aplicado. **Não deployar** `admin-disable-user` sem
fase dedicada de staging deploy. **Não versionar** o config do
runner (`.ravatex-local/`).

## 10. Política de updates deste ledger

- Este ledger é atualizado em **fase docs-only** após cada fase
  arquitetural significativa.
- Cada entrada nova na tabela de fases inclui: fase, commit, arquivos
  principais, testes, status.
- Cada ressalva processual é registrada explicitamente na seção 5
  (Ressalvas processuais aceitas em `<FASE>`).
- O ledger **NÃO** inclui `service_role`, senhas, JWT secrets,
  connection strings com senha ou anon key completa. Apenas refs
  públicos do Supabase (`bhgifjrfagkzubpyqpew` para produção,
  `ucrjtfswnfdlxwtmxnoo` para staging) são mencionados, porque
  aparecem também em `js/config.js` e já são públicos via
  `STAGING_BASELINE.md`.
