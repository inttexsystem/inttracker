# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> Snapshot de estado canônico curto. Atualizado em **2026-06-23** (fase
> RAVATEX-TAPETES-REFACTOR-STATE-DOCS-C — após extração dos writes
> críticos de `screenNovaOP`: `screenPainel`, `op-recalculo`
> (helpers + write) e `op-persistir` (helpers + write)).
> Fonte da verdade operacional. Detalhe por fase em
> `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.

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
- **HEAD atual aceito:** `cac20f9` — "Extract OP persistir write helper".
- **staging/main atual:** `cac20f9` (sincronizado com `work/app-next`).
- **origin/main oficial:** **intocado** durante todo o refactor.
- **PR #2:** **intocado** durante todo o refactor.
- **Working tree esperado:** **limpo**.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor.
- **Supabase real:** **não acessado** em nenhuma fase de refactor ou
  teste mockado.

### Commits técnicos desde a última docs-only (REFACTOR-STATE-DOCS-B)
1. `065a796` — Extract painel screen module (SCREENPAINEL-MODULE-A).
2. `c599c21` — Extract OP recalculo pure helpers (OP-RECALCULO-HELPERS-MODULE-A).
3. `4ce5080` — Extract OP recalculo write helper (OP-RECALCULO-WRITES-MODULE-A).
4. `8fd4dd2` — Extract OP persistir pure helpers (OP-PERSISTIR-HELPERS-MODULE-A).
5. `cac20f9` — Extract OP persistir write helper (OP-PERSISTIR-WRITES-MODULE-A).

## Módulos extraídos (ordem cronológica)
1. `js/config.js` (commit `5547e27`, CONFIG-MODULE-A).
2. `js/supabase-client.js` (commit `6d50d08`, SUPABASE-CLIENT-MODULE-A).
3. `js/environment-banner.js` (commit `1f3238d`, ENV-BANNER-MODULE-A).
4. `js/auth.js` (commit `1b56571`, AUTH-MODULE-A).
5. `js/router.js` (commit `6bb203f`, ROUTER-MODULE-A).
6. `js/screens/system-screens.js` (commit `786f6b4`, SYSTEM-SCREENS-MODULE-A).
7. `js/screens/common.js` (commit `ed8e75c`, SCREENS-COMMON-MODULE-A).
8. `js/screens/cadastros.js` (commit `dd24365`, CADASTROS-SCREENS-MODULE-A).
9. `js/screens/ops-list.js` (commit `d7a8d25`, OPS-LIST-SCREEN-MODULE-A).
10. `js/screens/entrega-form.js` (commit `958f244`, ENTREGA-FORM-HELPER-MODULE-A).
11. `js/screens/entrega-writes.js` (commit `7ec1721`,
    ENTREGA-WRITES-MODULE-A; expandido em `e190022` Latex e
    `70635aa` Cima).
12. `js/screens/fornecedor.js` (commit `4b9ca12`,
    FORNECEDOR-SCREENS-MODULE-A).
13. `js/screens/op-form-helpers.js` (commit `c480324`,
    OP-FORM-HELPERS-MODULE-A) — `rotuloModelo`, `fmtKg`,
    `fmtMetros`, `disabledAttr`. Inclui unificação de
    `rotuloFioOrdem` (clone local) com `rotuloFio` de
    `entrega-form.js`.
14. `js/screens/op-writes.js` (commit `ab79f1c`,
    OP-ORDER-WRITE-MODULE-A — `registrarRecebimentoOrdemFio`;
    expandido em `1429950` com `atribuirFornecedorFioOp` na fase
    OP-FORNECEDOR-WRITE-MODULE-A).
15. `js/screens/op-latex-admin.js` (commit `69c0036`,
    OP-LATEX-ADMIN-MODULE-A) — `renderOPLatexAdmin` saiu do inline.
16. `js/screens/painel.js` (commit `065a796`,
    SCREENPAINEL-MODULE-A) — `screenPainel` saiu do inline.
17. `js/screens/op-recalculo.js` (commit `c599c21` + `4ce5080`,
    OP-RECALCULO-HELPERS-MODULE-A + OP-RECALCULO-WRITES-MODULE-A).
18. `js/screens/op-persistir.js` (commit `8fd4dd2` + `cac20f9`,
    OP-PERSISTIR-HELPERS-MODULE-A + OP-PERSISTIR-WRITES-MODULE-A).

## Estado atual dos novos módulos

### `js/screens/painel.js`
- `screenPainel` (placeholder de 9 linhas, extraído em `065a796`).

### `js/screens/op-recalculo.js`
Helpers puros e write helper do fluxo de recalculo de OP, extraídos em
duas fases. Concentra:
- `maxMetrosItem(item, modelosById, parametrosByLargura, ordens)` — cap de
  metros por item para o slider da proposta (adicionado em `c599c21`).
- `normalizarChaveSaldo(tipo, corId, corPoliester)` — forma o objeto
  `{ is, eq }` para query Supabase de `saldo_fios` (adicionado em
  `c599c21`).
- `aplicarRecalculoOP({ opId, resultado, modo, ordens })` — write helper
  que executa os 4 writes do recalculo (`op_itens.update`,
  `saldo_fios_op.insert`, `saldo_fios` select/update/insert,
  `ops.update status='em_producao'`), retornando envelope
  `{ error, step, partial }` (adicionado em `4ce5080`).

### `js/screens/op-persistir.js`
Helpers puros de payload e write helper do fluxo de persistência de
OP, extraídos em duas fases. Concentra:
- `itensValidosOP(itens)` — filtra itens válidos (adicionado em
  `8fd4dd2`).
- `montarPayloadItensOP(itensValidos, opId)` — gera payload de
  `op_itens.insert` (adicionado em `8fd4dd2`).
- `montarPayloadFornecedoresOP(fornSel, opId)` — gera payload de
  `op_fornecedores.insert` (adicionado em `8fd4dd2`).
- `montarPayloadOP({ numero, ano, status })` — gera payload de
  `ops.insert`/`ops.update` (adicionado em `8fd4dd2`).
- `montarPayloadLote({ numero, clienteSel })` — gera payload de
  `lotes.insert` (adicionado em `8fd4dd2`).
- `persistirOP({ status, op, numero, ano, clienteSel, itens, fornSel,
  modelosById, parametrosByLargura })` — write helper que executa os 8
  writes da persistência (ops, lotes, op_itens, op_fornecedores,
  ordens_compra_fio), retornando envelope
  `{ error, step, partial, opId }` (adicionado em `cac20f9`).

## Estado de `screenNovaOP`

`screenNovaOP` continua **inline**. Os writes críticos foram
**extraídos** para módulos dedicados:

- `aplicarRecalculo` no inline agora chama
  `window.aplicarRecalculoOP(...)` em `js/screens/op-recalculo.js`
  (`4ce5080`).
- `persistir` foi **removido** do inline; os callers
  (`salvarSimulacao`, `abrirOP`) agora chamam
  `window.persistirOP(...)` em `js/screens/op-persistir.js` (`cac20f9`).
  Validacoes de formulario (numero, ano, clienteSel, fornSel.cima,
  itens) e UI (saving, toast, navigate) permanecem nos callers inline.
- `renderOPLatexAdmin` em `js/screens/op-latex-admin.js` (`69c0036`).
- `registrarRecebimentoOrdemFio` e `atribuirFornecedorFioOp` em
  `js/screens/op-writes.js` (`ab79f1c` + `1429950`).

O inline agora concentra **principalmente UI**: estado local de
`screenNovaOP`, montagem de tela (`buildLeft`, `buildRight`,
`renderRightInto`), cálculo visual (`buildProposta`, `recompute`,
`onAceitar`), handlers de UI, validações de formulário e roteamento
local.

## Inline remanescente principal em `index.html`

- `screenNovaOP` (UI/estado, delega writes para `op-recalculo.js`,
  `op-persistir.js`, `op-writes.js` e `op-latex-admin.js`).
- `buildRight` / `renderRightInto` (montagem do painel lateral).
- `buildProposta` (sliders + painel de consumo).
- `recompute` (recalculo ao vivo do consumo).
- `onAceitar` (validação + delegação para `aplicarRecalculoOP`).
- `buildOrdemPendenteRow` (UI do input; write delegado para
  `window.registrarRecebimentoOrdemFio`).
- `gerarPdfCompraFios` (geração de PDF).
- `setRoutes` (registro de rotas no router).
- `main` (boot).

`screenPainel` e `renderOPLatexAdmin` foram **extraídos**.

## Riscos principais
- 🔴 **`persistirOP` e `aplicarRecalculoOP` seguem sem transação
  cross-table.** Falha parcial ainda pode deixar `op_itens`,
  `saldo_fios_op`, `saldo_fios` e `ops.status` em estado intermediário.
  Rollback parcial manual existe (reverter status para `'simulada'`,
  deletar OP recém-criada se lote falhar) mas não cobre todos os
  cenários.
- 🔴 **`screenNovaOP` ainda é bloco grande de UI/estado**, mesmo com
  todos os writes delegados. Contém várias sub-funções de UI
  acopladas ao estado local.
- 🟡 **`persistirOP` trata deletes como erro** (mudança controlada
  em relação ao inline antigo, que ignorava erros de delete).
  Testes de regressão cobrem este comportamento.
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de
  `tests/write-guard.smoke.js`) são **pré-existentes** e **não
  atribuídas** ao refactor. Verificadas com `git stash` em commits
  anteriores.

## Comandos seguros
- `node --test tests/calculo-op.test.js` — cálculos puros.
- `node --test tests/<arquivo>.smoke.js` — testes focados por fase.
- Servir local: `python -m http.server 8765` (apenas para
  `index-inline.smoke.js` e parte de `write-guard.smoke.js`).

## Ações PROIBIDAS sem autorização explícita
- `db/10_reset_producao.sql` e `db/11_reset_producao.sql` (DELETE em
  massa de produção).
- Qualquer SQL contra `bhgifjrfagkzubpyqpew` sem backup.
- Push em `origin/main` (= produção).
- Editar `index.html`, `js/**`, `tests/**` durante fase docs-only.
- Tocar `origin/main` ou PR #2.

## Próxima fase recomendada
Após esta docs-only, o próximo alvo deve ser:

**`RAVATEX-TAPETES-SCREENNOVAOP-UI-DIAG-A`** — diagnóstico de UI de
`screenNovaOP`. Com todos os writes críticos já extraídos, a próxima
fronteira a investigar é a extração da UI/estado pura:
`buildRight`, `renderRightInto`, `buildProposta`, `recompute`,
`onAceitar`, `buildOrdemPendenteRow`, `gerarPdfCompraFios`. Avaliar
se `screenNovaOP` pode ser extraída como módulo completo ou se
componentes internos podem ser isolados.

**Não** recomendar extração direta de `screenNovaOP` sem
diagnóstico prévio.

## Pendências de informação
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automático do Supabase? Quem sabe restaurar?
- O backdoor `*@tapetes.test` (ver histórico de D1) já foi removido?
- Há link/projeto Vercel real? (premissa atual: não — app é estático
  no GitHub Pages.)
