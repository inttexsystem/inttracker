# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> Snapshot de estado canônico curto. Atualizado em **2026-06-23** (fase
> RAVATEX-TAPETES-REFACTOR-STATE-DOCS-A — após extração de fornecedor).
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
- **HEAD atual:** `4b9ca12` — "Extract fornecedor screens module".
- **staging/main atual:** `4b9ca12` (sincronizado com `work/app-next`).
- **origin/main oficial:** **intocado** durante todo o refactor.
- **PR #2:** **intocado** durante todo o refactor.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor.
- **Supabase real:** **não acessado** em nenhuma fase de refactor ou
  teste mockado.

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

## Inline remanescente em `index.html`
Após o refactor, o `<script>` inline de `index.html` ainda contém:
- `screenPainel` (placeholder).
- `screenNovaOP` (854 linhas, 12 tabelas Supabase, 4 `single`).
- `renderOPLatexAdmin` (180 linhas, acoplada a `screenNovaOP` via
  `await renderOPLatexAdmin(op.id)` na linha 161).
- `setRoutes` (registro de rotas).
- `main` (boot).
- `rotuloFioOrdem` (clone local de `rotuloFio`, dentro de `screenNovaOP`).
- `rotuloModelo` (helper de `screenNovaOP`).

## Riscos principais
- 🔴 **`screenNovaOP` ainda é o maior bloco inline** (854 linhas) e o
  mais sensível do cluster. Concentra 12 tabelas, 4 `.single()`, 13+
  writes.
- 🔴 **`renderOPLatexAdmin` segue acoplado a `screenNovaOP`** — quebra
  estrutural se um for extraído sem o outro (ou se o global legado
  `window.renderOPLatexAdmin` for removido).
- 🔴 **`screenNovaOP` chama `renderOPLatexAdmin` via bare/global** —
  a extração futura deve preservar `window.renderOPLatexAdmin` como
  global legado até que `screenNovaOP` também saia do inline.
- 🟡 Falhas de smoke dependentes de `http.server :8765`
  (`tests/index-inline.smoke.js`, parte de `tests/write-guard.smoke.js`)
  são **pré-existentes** e **não atribuídas** à extração fornecedor.
  Verificadas com `git stash` no commit anterior.

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
Após esta docs-only, o próximo alvo técnico provável é
**OP-FORM-DIAG-A** ou **OP-LATEX-ADMIN-DIAG-A**, antes de qualquer
extração de `screenNovaOP` / `renderOPLatexAdmin`. A extração dessas
duas telas exige diagnóstico específico devido ao acoplamento
mútuo, à quantidade de tabelas Supabase tocadas e ao volume de writes.

## Pendências de informação
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automático do Supabase? Quem sabe restaurar?
- O backdoor `*@tapetes.test` (ver histórico de D1) já foi removido?
- Há link/projeto Vercel real? (premissa atual: não — app é estático
  no GitHub Pages.)
