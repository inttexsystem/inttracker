# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Branch:** `work/app-next`.
- **HEAD:** `4b9ca12` — "Extract fornecedor screens module".
- **staging/main:** `4b9ca12` (sincronizado).
- **Working tree esperado:** **limpo**.
- **origin/main oficial:** **intocado** durante todo o refactor.
- **PR #2:** **intocado** durante todo o refactor.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor.
- **Supabase real:** **não acessado** em nenhuma fase de refactor
  (todos os testes rodam com `vm.runInContext` + `fakeSupa` mockado).

## Comandos de verificação (rodar antes de qualquer patch)

```bash
cd "D:\OneDrive\Programação\Ravatex\controle-tapetes"

git status --short
git branch --show-current
git rev-parse --short HEAD
git remote -v
git ls-remote --heads staging main
```

Abortar e revisar o escopo se:
- branch != `work/app-next`;
- HEAD != `4b9ca12`;
- working tree não estiver limpo;
- `staging/main` != `4b9ca12`.

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
7. **Fase docs-only** desta entrega: só `PROJECT_STATE.md`,
   `AGENT_HANDOFF.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
   podem ser alterados. Qualquer diff fora desses 3 arquivos reprova.
8. **Não extrair** `screenNovaOP` ou `renderOPLatexAdmin` sem
   diagnóstico específico prévio (acoplamento mútuo, 12+ tabelas
   Supabase, 13+ writes).

## Resumo do refactor (12 módulos extraídos)

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
| 11 | `js/screens/entrega-writes.js` | `7ec1721` | ENTREGA-WRITES-MODULE-A |
| 12 | `js/screens/fornecedor.js` | `4b9ca12` | FORNECEDOR-SCREENS-MODULE-A |

## Inline remanescente em `index.html`

`screenPainel`, `screenNovaOP` (854 linhas), `renderOPLatexAdmin`
(180 linhas), `setRoutes`, `main`, `rotuloFioOrdem` (clone local),
`rotuloModelo` (helper de `screenNovaOP`).

## Próximo fluxo recomendado

1. **Fechar esta fase docs-only** (commit + push para `staging`).
2. **Depois**, diagnosticar `OP-form` / `renderOPLatexAdmin` antes
   de qualquer extração (`OP-FORM-DIAG-A` ou `OP-LATEX-ADMIN-DIAG-A`).
3. **Não iniciar** extração de `screenNovaOP` sem diagnóstico
   específico (acoplamento `screenNovaOP` ↔ `renderOPLatexAdmin` via
   `await renderOPLatexAdmin(op.id)` em `screenNovaOP:161`).

## Testes

- **Focados passando:** 290/290 (`entrega-writes`, `entrega-form`,
  `ops-list-screen`, `cadastros-screens`, `screens-common`,
  `system-screens`, `router`, `auth`, `fornecedor-screens`).
- **Pré-existentes dependentes de `http.server :8765`:** 6 falhas em
  `tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
  — não relacionadas ao refactor; exigem servidor local.

## Comandos seguros por fase

```bash
# Após mudança em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# Após mudança em index.html:
node "C:\Users\klebe\AppData\Local\Temp\opencode\extract-inline.js" \
     "D:\OneDrive\Programação\Ravatex\controle-tapetes\index.html" \
     "C:\Users\klebe\AppData\Local\Temp\opencode\index-inline-check.js"

# Validação focada em boot completo:
node --test tests/entrega-writes.smoke.js \
              tests/entrega-form.smoke.js \
              tests/ops-list-screen.smoke.js \
              tests/cadastros-screens.smoke.js \
              tests/screens-common.smoke.js \
              tests/system-screens.smoke.js \
              tests/router.smoke.js \
              tests/auth.smoke.js \
              tests/fornecedor-screens.smoke.js
```

## O que um agente NÃO deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produção).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatório.
- Extrair `screenNovaOP` ou `renderOPLatexAdmin` sem diagnóstico
  específico.
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
