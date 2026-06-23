# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto:
> `PROJECT_STATE.md` e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Convenção: **tudo em português brasileiro**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next @ 4c18fe7`.
- **staging/main:** `4c18fe7` (sincronizado).
- **Working tree esperado:** **limpo**.
- **origin/main oficial:** **intocado** durante todo o refactor.
- **PR #2:** **intocado** durante todo o refactor.
- **Produção (grupoterrabranca.github.io):** **preservada** — não
  recebeu nenhum push de refactor.
- **Supabase real:** **não acessado** em nenhuma fase de refactor
  (todos os testes rodam com `vm.runInContext` + `fakeSupa` mockado).

## Estado operacional atual
- `index.html` está declarativo e sem script inline final.
- `js/boot.js` é o entrypoint oficial do app.
- `js/router.js` é engine genérica e não foi alterado na fase de boot.

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
- HEAD != `4c18fe7`;
- working tree não estiver limpo;
- `staging/main` != `4c18fe7`.

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
7. **Fase docs-only**: só `PROJECT_STATE.md`, `AGENT_HANDOFF.md` e
   `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md` podem ser
   alterados. Qualquer diff fora desses 3 arquivos reprova.
8. **Não mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explícita.
9. **Não fazer docs + código na mesma fase.**

## Módulos principais e responsabilidades

### `boot.js` (RAVATEX-TAPETES-ROUTES-BOOT-MODULE-A)
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes` (15 rotas).
- Executa `main()`.
- Registra `hashchange` listener.
- Carrega usuário atual via `window.loadCurrentUser`.
- Direciona para `navigate('#/login')`, `handleRoute()` ou
  `routeAfterLogin()`.
- Captura erro de boot via `main().catch()` + `toast('Erro ao iniciar o app', 'error')`.

### `op-nova.js` (RAVATEX-TAPETES-SCREENNOVAOP-MODULE-A)
- `screenNovaOP` (closure inteira com `~20` subfunções aninhadas).
- UI/estado da Nova OP.
- Proposta, blocos de fios, tecelagem, PDF, wrappers de
  persistência/recálculo.
- Mantém read-only em Supabase (apenas `.select()`).
- Writes delegados: `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`.

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

## Próxima recomendação operacional

**Não iniciar novo refactor funcional imediatamente.**
**Próxima fase recomendada: revisão/validação final ou decisão de
publicação/homologação em staging.**

O refactor arquitetural principal está concluído. Antes de iniciar
qualquer novo trabalho:
- Validar a tela Nova OP em homologação staging.
- Confirmar que todos os fluxos de admin e fornecedor continuam
  funcionais.
- Decidir se a próxima publicação vai para `origin/main` (produção) ou
  se há ajustes pendentes.

## Possíveis fases futuras opcionais (NÃO obrigatórias)

Estas fases **não** fazem parte do fechamento do refactor. São
apenas sugestões para trabalho futuro, se houver benefício prático:

- **`RAVATEX-TAPETES-OP-PDF-MODULE-A`** — extrair `gerarPdfCompraFios`
  para `js/screens/op-pdf.js`. Benefício: isola a dependência de jsPDF.
- **`RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`** — diagnosticar
  `buildBlocoFios` (montagem do bloco de recebimento de fios).
- **`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A`** — diagnosticar
  `buildProposta` / `recompute` / `onAceitar` (UI de proposta +
  interação com recálculo).
- **`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A`** — avaliar uso de
  RPC/transações Supabase para `persistirOP` e `aplicarRecalculoOP`
  (risco de produto/dados, não de refactor).

## Proibições operacionais

- **Não tocar `origin/main` nem PR #2 sem autorização explícita.**
- **Não mexer em `persistirOP` ou `aplicarRecalculoOP` sem fase
  específica** (risco transacional residual, documentado em
  `PROJECT_STATE.md` e no LEDGER).
- **Não fazer docs + código na mesma fase.**
- **Não tratar cortes opcionais como obrigatórios** (sugestões acima
  são apenas para futuro).

## Resumo do refactor (20 módulos extraídos)

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

## Testes recentes (focados passando)
- `painel-screen.smoke.js` — 16/16
- `op-recalculo.smoke.js` — 59/59
- `op-persistir.smoke.js` — 65/65
- `op-writes.smoke.js` — 49/49
- `op-latex-admin.smoke.js` — 30/30
- `op-form-helpers.smoke.js` — 36/36
- `op-nova.smoke.js` — 30/30
- `boot.smoke.js` — 20/20
- `router.smoke.js` — 34/34
- `fornecedor-screens.smoke.js` — 29/29
- **Total:** 368/368

Pré-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
— não relacionadas ao refactor; exigem servidor local.

## Comandos seguros por fase

```bash
# Após mudança em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# Validação focada de regressão completa:
node --test tests/boot.smoke.js \
              tests/router.smoke.js \
              tests/op-nova.smoke.js \
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
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
- Tratar fases opcionais (PDF, bloco fios, proposta, transaction
  risk) como obrigatórias.
