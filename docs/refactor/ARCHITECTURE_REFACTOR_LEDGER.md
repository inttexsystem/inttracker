# Architecture Refactor Ledger — Ravatex Controle de Tapetes

> Ledger de fases do refactor arquitetural de
> `D:\OneDrive\Programação\Ravatex\controle-tapetes`.
> Última atualização: 2026-06-23 (HEAD `4b9ca12`,
> fase `RAVATEX-TAPETES-REFACTOR-STATE-DOCS-A`).

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
| REFACTOR-STATE-DOCS-A | (a criar) | `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` | docs-only | esta fase |

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

## 7. Inline remanescente em `index.html` (após `4b9ca12`)

- `screenPainel` (placeholder, 9 linhas).
- `screenNovaOP` (854 linhas, 12 tabelas Supabase, 4 `.single()`,
  13+ writes).
- `renderOPLatexAdmin` (180 linhas, acoplada a `screenNovaOP`).
- `setRoutes` (registro de rotas).
- `main` (boot).
- `rotuloFioOrdem` (clone local de `rotuloFio`, dentro de `screenNovaOP`).
- `rotuloModelo` (helper de `screenNovaOP`).

## 8. Próximos cortes recomendados

1. **OP-FORM-DIAG-A** — diagnóstico específico de `screenNovaOP` +
   `renderOPLatexAdmin` antes de qualquer extração.
2. Decidir se `renderOPLatexAdmin` deve sair antes, junto ou depois
   de `screenNovaOP`. Acoplamento via
   `await renderOPLatexAdmin(op.id)` em `screenNovaOP:161` exige
   decisão coordenada.
3. Só então extrair módulos de OP-form/admin. A extração de
   `screenNovaOP` é o último grande corte do refactor arquitetural.

## 9. Riscos residuais do refactor (após `4b9ca12`)

- 🔴 **`screenNovaOP` é o maior bloco inline remanescente** (854
  linhas) e o mais sensível. Concentra 12 tabelas Supabase, 4
  `.single()`, 13+ writes.
- 🔴 **`renderOPLatexAdmin` segue acoplado a `screenNovaOP`** —
  quebra estrutural se um for extraído sem o outro (a menos que
  `window.renderOPLatexAdmin` permaneça como global legado).
- 🔴 **`screenNovaOP` chama `renderOPLatexAdmin` via bare/global** —
  a extração futura deve preservar `window.renderOPLatexAdmin` como
  global legado até que `screenNovaOP` também saia do inline.
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e não
  atribuídas à extração de fornecedor.
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
