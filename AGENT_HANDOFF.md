# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next @ cac20f9`.
- **staging/main:** `cac20f9` (sincronizado).
- **Working tree esperado:** **limpo**.
- **origin/main oficial:** **intocado** durante todo o refactor.
- **PR #2:** **intocado** durante todo o refactor.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor.
- **Supabase real:** **não acessado** em nenhuma fase de refactor
  (todos os testes rodam com `vm.runInContext` + `fakeSupa` mockado).

## Último marco
**Marco fechado:** writes críticos de `screenNovaOP` extraídos.
`aplicarRecalculo` e `persistir` agora delegam para
`aplicarRecalculoOP` (em `op-recalculo.js`) e `persistirOP` (em
`op-persistir.js`). `screenNovaOP` continua **inline**, mas
concentra majoritariamente UI/estado com writes delegados. Próxima
frente deve ser diagnóstico de UI de `screenNovaOP`.

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
- HEAD != `cac20f9`;
- working tree não estiver limpo;
- `staging/main` != `cac20f9`.

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
8. **Não extrair** `screenNovaOP` sem diagnóstico UI específico
   prévio (UI acoplada a estado local, várias sub-funções).
9. **Não mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explícita.

## Módulos e responsabilidades

### `op-recalculo.js` (`4ce5080`)
- Helpers puros de recalculo: `maxMetrosItem`,
  `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` — executa os 4 writes do
  recalculo (`op_itens.update`, `saldo_fios_op.insert`,
  `saldo_fios` select/update/insert, `ops.update
  status='em_producao'`).

### `op-persistir.js` (`cac20f9`)
- Helpers puros de persistência: `itensValidosOP`,
  `montarPayloadItensOP`, `montarPayloadFornecedoresOP`,
  `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` — executa os 8 writes da persistência
  (ops insert/update, lotes select/insert/update, ops.update
  lote_id, op_itens delete/insert, op_fornecedores delete/insert,
  ordens_compra_fio delete/insert).

### `op-writes.js` (`1429950`)
- `registrarRecebimentoOrdemFio` — atualiza `ordens_compra_fio`
  com kg_recebido.
- `atribuirFornecedorFioOp` — atribui fornecedor de fio a etapa de
  uma OP.

### `op-latex-admin.js` (`69c0036`)
- `renderOPLatexAdmin` — tela de admin de OP de látex (chamada
  quando `op.tipo === 'latex'`).

### `painel.js` (`065a796`)
- `screenPainel` — placeholder de 9 linhas (tela inicial do admin).

## Próxima fase recomendada

**`RAVATEX-TAPETES-SCREENNOVAOP-UI-DIAG-A`**

Foco:
- Avaliar `screenNovaOP` como UI/estado isolada.
- Mapear `buildRight` / `renderRightInto` (montagem do painel
  lateral).
- Mapear `buildProposta` / `recompute` / `onAceitar` (UI de
  proposta + interação com recalculo).
- Mapear `buildOrdemPendenteRow` (UI do input; write já delegado
  para `window.registrarRecebimentoOrdemFio`).
- Mapear `gerarPdfCompraFios` (geração de PDF via jsPDF).
- Avaliar possibilidade de extrair `screenNovaOP` inteira como
  módulo único (`js/screens/screen-nova-op.js`) ou se deve ser
  fatiada em sub-componentes.

## Proibições para próxima fase
- **Não mover** `screenNovaOP` inteira sem diagnóstico UI.
- **Não mexer** em `persistirOP` ou `aplicarRecalculoOP` sem nova
  fase explícita.
- **Não fazer docs + código na mesma fase.**

## Resumo do refactor (18 módulos extraídos)

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
| 13 | `js/screens/op-form-helpers.js` | `c480324` | OP-FORM-HELPERS-MODULE-A |
| 14 | `js/screens/op-writes.js` | `ab79f1c` (+ `1429950`) | OP-ORDER-WRITE-MODULE-A (+ OP-FORNECEDOR-WRITE-MODULE-A) |
| 15 | `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-MODULE-A |
| 16 | `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| 17 | `js/screens/op-recalculo.js` | `c599c21` + `4ce5080` | OP-RECALCULO-HELPERS-MODULE-A + OP-RECALCULO-WRITES-MODULE-A |
| 18 | `js/screens/op-persistir.js` | `8fd4dd2` + `cac20f9` | OP-PERSISTIR-HELPERS-MODULE-A + OP-PERSISTIR-WRITES-MODULE-A |

## Inline remanescente em `index.html`

`screenPainel` foi extraído. `renderOPLatexAdmin` foi extraído.
`screenNovaOP` continua **inline** mas com writes delegados:

- `screenNovaOP` (UI/estado principal, delega writes para
  `aplicarRecalculoOP`, `persistirOP`, `registrarRecebimentoOrdemFio`,
  `atribuirFornecedorFioOp` e `renderOPLatexAdmin`).
- `buildRight` / `renderRightInto` (montagem do painel lateral).
- `buildProposta` / `recompute` / `onAceitar` (UI de proposta).
- `buildOrdemPendenteRow` (UI do input; write delegado para
  `window.registrarRecebimentoOrdemFio`).
- `gerarPdfCompraFios` (geração de PDF).
- `salvarSimulacao` / `abrirOP` (callers de `persistirOP` com
  saving, toast, navigate).
- `setRoutes` (registro de rotas).
- `main` (boot).

## Testes

- **Focados passando (HEAD `cac20f9`):**
  - `painel-screen.smoke.js` — 16/16
  - `op-recalculo.smoke.js` — 59/59
  - `op-persistir.smoke.js` — 65/65
  - `op-writes.smoke.js` — pass
  - `op-latex-admin.smoke.js` — pass
  - `op-form-helpers.smoke.js` — pass
  - `entrega-form.smoke.js` — pass
  - `entrega-writes.smoke.js` — pass
  - `fornecedor-screens.smoke.js` — pass
  - **Total focados:** 255/255
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
node --test tests/op-persistir.smoke.js \
              tests/op-recalculo.smoke.js \
              tests/op-writes.smoke.js \
              tests/op-latex-admin.smoke.js \
              tests/painel-screen.smoke.js \
              tests/op-form-helpers.smoke.js \
              tests/entrega-form.smoke.js \
              tests/entrega-writes.smoke.js \
              tests/fornecedor-screens.smoke.js
```

## O que um agente NÃO deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produção).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatório.
- Extrair `screenNovaOP` sem diagnóstico UI específico prévio.
- Mexer em `persistirOP` ou `aplicarRecalculoOP` sem nova fase
  explícita.
- Tentar mover `renderOPLatexAdmin` para outro módulo
  (já está isolada em `op-latex-admin.js`).
- Tentar mover `screenPainel` (já está isolada em `painel.js`).
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
