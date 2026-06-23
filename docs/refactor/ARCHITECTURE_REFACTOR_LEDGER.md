# Architecture Refactor Ledger — Ravatex Controle de Tapetes

> Ledger de fases do refactor arquitetural de
> `D:\OneDrive\Programação\Ravatex\controle-tapetes`.
> Última atualização: 2026-06-23 (HEAD `cac20f9`,
> fase `RAVATEX-TAPETES-REFACTOR-STATE-DOCS-C`).

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
  secret, connection string com senha, anon key completa são
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
| REFACTOR-STATE-DOCS-C | (a criar) | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | esta fase |

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

## 7. Inline remanescente em `index.html` (após `cac20f9`)

- `screenNovaOP` (UI/estado principal, delega writes para
  `aplicarRecalculoOP`, `persistirOP`, `registrarRecebimentoOrdemFio`,
  `atribuirFornecedorFioOp` e `renderOPLatexAdmin`).
- `buildRight` / `renderRightInto` (montagem do painel lateral).
- `buildProposta` / `recompute` / `onAceitar` (UI de proposta + recalculo).
- `buildOrdemPendenteRow` (UI do input; write delegado).
- `gerarPdfCompraFios` (geração de PDF via jsPDF).
- `salvarSimulacao` / `abrirOP` (callers de `persistirOP` com saving,
  toast, navigate, validações de formulário).
- `setRoutes` (registro de rotas no router).
- `main` (boot).

`screenPainel` foi extraída para `js/screens/painel.js`.
`renderOPLatexAdmin` foi extraída para `js/screens/op-latex-admin.js`.
`aplicarRecalculo` e `persistir` foram **removidos** do inline; seus
writes agora são executados por `aplicarRecalculoOP` e `persistirOP`
respectivamente.

## 8. Próximos cortes recomendados

1. **`SCREENNOVAOP-UI-DIAG-A`** — diagnosticar extração da UI
   grande de `screenNovaOP`.
2. **`SCREENNOVAOP-MODULE-A`** ou **`SCREENNOVAOP-UI-MODULE-A`**
   — apenas após diagnóstico UI.
3. **`ROUTES-MAIN-CLOSEOUT-A`** — fechamento de `setRoutes`/`main`
   (último pedaço de bootstrap inline).
4. **`REFACTOR-STATE-DOCS-D`** — docs final após fechamento do
   inline.

## 9. Riscos residuais do refactor (após `cac20f9`)

- 🔴 **`persistirOP` e `aplicarRecalculoOP` seguem sem transação
  cross-table.** Falha parcial ainda pode deixar `op_itens`,
  `saldo_fios_op`, `saldo_fios` e `ops.status` em estado
  intermediário. Rollback parcial manual existe (reverter status
  para `'simulada'`, deletar OP recém-criada se lote falhar) mas
  não cobre todos os cenários.
- 🔴 **`screenNovaOP` ainda é bloco grande de UI/estado**, mesmo
  com todos os writes delegados. Contém várias sub-funções de UI
  acopladas ao estado local.
- 🟡 **`persistirOP` trata deletes como erro** (mudança controlada
  em relação ao inline antigo, que ignorava erros de delete).
  Testes de regressão cobrem este comportamento.
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e não
  atribuídas ao refactor.
- 🟡 O backdoor `*@tapetes.test` (ver histórico de D1 em
  `PROJECT_STATE.md`) ainda depende de ação do dono para remoção.

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
