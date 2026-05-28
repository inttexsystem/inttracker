# Status do projeto

## Fase atual: 5 — Tecelagem e látex

Fase 4 implementada em 2026-05-28, aguardando QA do Vinícius. Próxima: telas das terceirizadas (tecelagem e látex) com entregas parciais e suporte a múltiplos destinos de látex por OP (ver [[project_regra_latex]]).

## Fases concluídas

### Fase 4 — Recebimento de fios + recálculo automático ⏳ (implementada 2026-05-28, aguardando QA)

**Implementado:**
- Função pura `recalcularOP` em `js/calculo-op.js` (fator-gargalo: a cor de fio com menor kg_recebido/kg_pedido define o quanto a OP escala); 6 testes `node --test` passando (15/15 totais)
- Tela do fornecedor `#/fornecedor/ordens` (`screenFornecedorOrdens`) — lista Pendentes e Recebidas, registra `kg_recebido`/`data_recebimento`/`status` por ordem; redirect de login do fornecedor repontado para essa rota
- Bloco "Recebimento de fios" no detalhe da OP (admin): tabela das ordens; aviso "aguardando" enquanto faltam recebimentos; quando todas recebidas, mostra fator + tabela pedido→proposto + sobras + botões **Aceitar proposta** / **Manter pedido**; em `em_producao`/`finalizada` mostra "Metros de produção" em leitura
- `aplicarRecalculo` grava `metros_ajustados` em `op_itens`, insere sobras em `saldo_fios_op`, incrementa `saldo_fios` (read-then-update-or-insert por causa do unique key com colunas nulláveis) e move a OP para `em_producao`
- Checklist QA: `docs/qa/fase4-checklist.md` (itens 1–4 automatizados ✅; itens 5–13 manuais pendentes)

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
- **Fase 5 — Tecelagem e látex** (entregas parciais, defeitos, múltiplos destinos de látex) ← próxima
- Fase 6 — Fechamento de OP, painel inicial, estoque
- Fase 7 — Polimento visual (após screenshots do Max Home)
