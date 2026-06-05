# Status do projeto

## Fase atual: 6 — Cliente, Lote, fios sob demanda, % e PDF ✅ concluída e publicada (2026-06-05)

Fase 6 implementada, mergeada em `main` e publicada em 2026-06-05 (commit `12f881c`); testes 31/31. **SQL `db/09_fase6_cliente_lote.sql` já rodado no Supabase.** Aguarda QA manual do Vinícius — roteiro guiado em `docs/qa/roteiro-teste-fase6.md` (checklist resumido em `docs/qa/fase6-checklist.md`). Sessão pausada com repo limpo; o Vinícius testa na próxima sessão.

## Fases concluídas

### Fase 6 — Cliente, Lote, fios sob demanda, % entregue e PDF ✅ (concluída 2026-06-05)

**5 mudanças na OP:**
- **Fornecedores de fio opcionais** ao abrir (abrir exige só cliente + tecelagem); o admin atribui o fornecedor de fio por tipo depois, no bloco "Recebimento de fios" — grava `fornecedor_id` nas ordens + upsert `op_fornecedores`, e aí o fornecedor logado vê e registra o kg.
- **Cliente** na OP (novo cadastro `#/cadastros/clientes`).
- **Lote** automático sequencial (tabela `lotes`), criado no 1º salvamento de cada OP manual; OPs de látex herdam o lote/cliente (via `gerar_op_latex`).
- **Barra de % entregue** na lista de OPs.
- **PDF de compra de fios** (jsPDF + SRI), separado por Algodão/Poliéster.

**Banco:** `db/09_fase6_cliente_lote.sql` — `clientes`, `lotes`, `ops.lote_id` (nullable), `ordens_compra_fio.fornecedor_id` nullable, RLS admin-only, `gerar_op_latex` herda lote. **Funções puras:** `percentualEntregueOP`, `agruparOrdensCompraFio` (6 testes; 31 total). Checklist: `docs/qa/fase6-checklist.md`.

### Fase 5b — OP de Látex (recebimento do produto final) ✅ (concluída 2026-06-02, QA 22/22)

**Regra:** salvar uma entrega de tecelagem (`etapa='cima'`) gera automaticamente uma **OP de látex** (`ops.tipo='latex'`), independente após criada (snapshot do enviado).

**Implementado:**
- `db/08_fase5b_latex.sql` (rodado no Supabase): `ops` ganhou `tipo`/`origem_op_id`/`origem_entrega_id`/`observacao`; UNIQUE virou `(numero,ano,tipo)`; índice único parcial em `origem_entrega_id` (tipo='latex'); função `gerar_op_latex(p_entrega_id)` `SECURITY DEFINER` (idempotente, valida admin/dono, cria OP+itens+op_fornecedores). RLS genérica já cobre a empresa de látex.
- Front: `salvarEntregaCima` chama a RPC; `buildEntregaInlineForm` ganhou flag `comDestino`; `salvarEntregaLatex`/`atualizarEntregaLatex`; `screenListaOPs` com badge de tipo + filtro; `renderOPLatexAdmin` (detalhe admin com Enviado×Recebido×Falta, navegação ida-e-volta, recebimentos, editar enviado, finalizar, excluir); `screenFornecedorLatex` (`#/fornecedor/latex`). Recebido reusa `totalEntregueCimaPorItem`; testes 25/25.
- Checklist QA: `docs/qa/fase5b-checklist.md` — **22/22 validado**.

### Fase 5a — Tecelagem (parte de cima) ✅ (concluída 2026-05-28; complemento destino-de-látex 2026-06-02)

**Implementado:** função pura `totalEntregueCimaPorItem`; roteamento por tipo de fornecedor; tela `#/fornecedor/entregas` (tecelagem) e bloco admin com Pedido/Ajustado/Entregue/Falta; CRUD de entregas. Complemento (2026-06-02): coluna `entregas.destino_fornecedor_id` + CHECK + policy `fornecedores_latex_read` (`db/07_fase5a_destino_latex.sql`); select "Destino (látex)" no form. Checklist `docs/qa/fase5a-checklist.md` — itens de cálculo (1–5) e destino (22–27) validados.

> ⚠️ Itens 6–21 do `fase5a-checklist.md` (QA manual da tecelagem) não foram formalmente marcados, mas as telas estão em uso em produção desde 2026-05-28.

### Fase 4 — Recebimento de fios + recálculo automático ✅ (concluída 2026-05-28, QA 15/15)

**Implementado:**
- Funções puras em `js/calculo-op.js`: `recalcularOP` (fator-gargalo — a cor de fio com menor `kg_recebido/kg_pedido` define o quanto a OP escala) e `consumoPorOrdem` (consumo/sobra por ordem para metros livres, usada pela proposta com sliders); 7 testes `node --test` passando (17/17 totais)
- Tela do fornecedor `#/fornecedor/ordens` (`screenFornecedorOrdens`) — lista Pendentes e Recebidas, registra `kg_recebido`/`data_recebimento`/`status` por ordem; redirect de login do fornecedor repontado para essa rota
- Bloco "Recebimento de fios" no detalhe da OP (admin): Pendentes como formulário inline (o admin também pode dar baixa), Recebidas em tabela; aviso "aguardando" enquanto faltam recebimentos; quando todas recebidas, mostra a proposta com **um slider por item** (0 → máximo individual), painel **"Consumo de fio"** recalculado ao vivo, botão **↺ Voltar à proposta proporcional** e botões **Aceitar proposta** / **Manter pedido**; em `em_producao`/`finalizada` mostra "Metros de produção" em leitura
- `aplicarRecalculo` grava `metros_ajustados` em `op_itens` (valor exato do slider quando "Aceitar"), insere sobras em `saldo_fios_op`, incrementa `saldo_fios` (read-then-update-or-insert por causa do unique key com colunas nulláveis) e move a OP para `em_producao`. Em erros pós-escrita, navega pra lista pra evitar re-aplicação de saldo
- Modelos exibidos no padrão `Nome 1.40m · COR1/COR2` em todo o admin (helper `rotuloModelo`)
- Checklist QA: `docs/qa/fase4-checklist.md` — **15/15 aprovado**

### Fase 3 — Admin: Nova OP com cálculo ao vivo ✅ (concluída 2026-05-27, QA 14/14)

**Implementado:**
- Tela Lista de OPs (`#/ops`): tabela com Lote (nº/ano), status (badge), nº de itens, data de criação e ação "Abrir"
- Tela Nova OP (`#/ops/nova`, `#/ops/:id`): layout página-única com painel lateral de cálculo de fio (kg por cor) ao vivo
- Salvar como simulação (`simulada`, sem ordens de compra) ou Abrir OP (`aberta`, gera registros em `ordens_compra_fio`)
- Modo leitura para OPs não-simuladas (campos travados, botões ocultos)
- Lógica de cálculo extraída para `js/calculo-op.js` (funções puras `calcularFiosOP` + `montarOrdensCompraFio`)
- Testes automatizados com `node --test`: **9/9 passando** (`tests/calculo-op.test.js`)
- Checklist QA: `docs/qa/fase3-checklist.md` — **14/14 aprovado** (1–4 automatizados, 5–14 manuais)
- Correção no QA: látex removido da criação da OP (abrir exige só 3 fornecedores: algodão, poliéster, tecelagem). Látex é decidido após a parte de cima e pode ter vários destinos por OP → Fase 5.

### Fase 2 — Admin Cadastros ✅ (concluída 2026-05-19)

QA rodado em 2026-05-19: **9/9 cenários** do `docs/qa/fase2-checklist.md` passaram. Tudo no ar em https://viniciuscgiansante.github.io/controle-tapetes/.

**Implementado:**
- Helpers compartilhados: `modal`, `confirmDialog`, `formField`, `textInput`, `selectInput`, `dataTable`, `pageHeader`
- Menu lateral admin com 7 itens (`ADMIN_MENU`)
- `handleRoute()` agora suporta telas async
- 6 telas de cadastro: Cores, Modelos, Parâmetros, Fornecedores, Preços, Usuários
- Tela de Usuários em modo "vincular UID" (criação no Supabase Auth continua manual)
- Checklist QA com 9 cenários

**Bugs pendentes (decisão de adiar):** ver `docs/qa/fase2-bugs-pendentes.md`. Resumo: o select de Largura não vem preenchido ao editar Preço (tentativa de fix em `76bf39c` não confirmada).

### Fase 1 — Fundação ✅ (concluída em 2026-05-18)

- Repo GitHub criado e GitHub Pages ativo: https://viniciuscgiansante.github.io/controle-tapetes/
- Projeto Supabase ativo: `bhgifjrfagkzubpyqpew` (https://bhgifjrfagkzubpyqpew.supabase.co)
- 14 tabelas + RLS + GRANTs + 2 funções (`is_admin`, `meu_fornecedor_id`) aplicadas via `db/setup_completo.sql`
- Seed de cadastros base aplicado (3 cores, 4 fornecedores, 2 modelos, 2 parâmetros, 4 preços)
- 4 usuários de teste criados e vinculados (1 admin + 3 fornecedores)
- Login funcional com redirecionamento por perfil
- Checklist QA Fase 1: **8/8 cenários passando**

**Aprendizados importantes (registrados em `db/setup_completo.sql` e memory):**
- Sempre usar JWT anon key (`eyJ...`) — a publishable key nova (`sb_publishable_*`) causa PGRST002
- Evitar Restart/Pause/Resume consecutivos no Supabase (corrompe schema cache do PostgREST)
- Todas as tabelas precisam de PRIMARY KEY explícita
- Funções RLS devem usar plpgsql + SECURITY DEFINER + EXCEPTION WHEN OTHERS

## Próximas fases

- **Fase 4 — Fornecedor de fios + recálculo automático** ✅
- **Fase 5a — Tecelagem (parte de cima)** ✅ (+ complemento destino de látex)
- **Fase 5b — Látex (OP de Látex)** ✅
- **Fase 6 — Cliente, Lote, fios sob demanda, % e PDF** ✅ (aguarda QA manual do Vinícius)
- Fechamento de OP, painel inicial, estoque — futuro
- Polimento visual (após screenshots do Max Home) — futuro
- **Próxima sessão (2026-06-05+):** Vinícius testa a Fase 6 (`docs/qa/roteiro-teste-fase6.md`); depois, mais ajustes a definir.
