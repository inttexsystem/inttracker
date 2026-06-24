# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras vinculantes em `docs/architecture/CODE_HEALTH_RULES.md`.
> Índice de fontes canônicas vs. legadas em
> `docs/DOCUMENTATION_INDEX.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next @ 3c9c424`.
- **staging/main:** `3c9c4247ffd9d8f1a710ff17f03340b6d2508f3b`
  (sincronizado).
- **Working tree esperado:** **limpo**.
- **origin/main oficial:** `1047181eba888242c6428de366cbd9fda2f1c72c`
  — **intocado** durante todo o ciclo de refactor/hardening.
- **PR #2:** **intocado** durante todo o ciclo.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor/hardening.
- **Supabase real:** **não acessado** em nenhuma fase de refactor
  (todos os testes rodam com `vm.runInContext` + `fakeSupa` mockado).
  A única leitura real foi uma contagem `select count(*) from
  public.ops` manual em staging (4 OPs).

## Estado operacional atual
- `index.html` está declarativo, sem script inline final, com
  cache-busting `?v=20260623-asset1` em 23 assets locais.
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
- HEAD != `3c9c424`;
- working tree não estiver limpo;
- `staging/main` != `3c9c4247ffd9d8f1a710ff17f03340b6d2508f3b`;
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
**Estado Auth:** design, Edge Function `admin-create-user`, UI
`#/cadastros/usuarios` e runbook operacional
(`docs/operations/AUTH_USER_PROVISIONING_RUNBOOK.md`) concluídos e
validados em staging (`ucrjtfswnfdlxwtmxnoo`). Bloqueio de
fornecedor (403) confirmado.
**Não voltar ao fluxo manual de UID** — o procedimento atual é o do
runbook.
**Delete/disable design:** `RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`
concluído. Recomendação: **desativar** usuários (soft delete no perfil
+ ban no Auth) em vez de deletar fisicamente. Exclusão atual do app
("Excluir vínculo") só remove `public.usuarios` e deixa `auth.users`
ativo — risco de Auth órfão. Botão deve ser restrito até fase de
desativação.
**Próxima fase recomendada:** `RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`
(schema para soft delete) ou `RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`
(contenção imediata na UI).

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
6. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`** *(futura)* —
   schema para coluna `ativo` e políticas RLS.
7. **`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`** *(futura, opcional)* —
   contenção imediata: remover botão "Excluir vínculo" da UI.

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

## Resumo do refactor (21 módulos extraídos)

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
| 15 | `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-MODULE-A |
| 16 | `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| 17 | `js/screens/op-recalculo.js` | `c599c21` (+ `4ce5080`) | OP-RECALCULO-HELPERS-MODULE-A (+ OP-RECALCULO-WRITES-MODULE-A) |
| 18 | `js/screens/op-persistir.js` | `8fd4dd2` (+ `cac20f9`) | OP-PERSISTIR-HELPERS-MODULE-A (+ OP-PERSISTIR-WRITES-MODULE-A) |
| 19 | `js/screens/op-nova.js` | `ce3dd14` | SCREENNOVAOP-MODULE-A |
| 20 | `js/boot.js` | `4c18fe7` | ROUTES-BOOT-MODULE-A |
| 21 | `js/screens/op-pdf.js` | `7f3c6da` | RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A |

## Testes recentes (focados passando)
- `op-pdf.smoke.js` — 20/20
- `op-nova.smoke.js` — 30/30
- `op-recalculo.smoke.js` — 59/59
- `op-persistir.smoke.js` — 65/65
- `op-writes.smoke.js` — 49/49
- `op-latex-admin.smoke.js` — 30/30
- `op-form-helpers.smoke.js` — 36/36
- `boot.smoke.js` — 54/54
- `router.smoke.js` — 34/34
- `painel-screen.smoke.js` — 16/16
- `fornecedor-screens.smoke.js` — 35/35
- **Total:** 388/388

Pré-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
— não relacionadas ao refactor; exigem servidor local
(`.\run-local.bat` ou `python -m http.server 8765`).

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
