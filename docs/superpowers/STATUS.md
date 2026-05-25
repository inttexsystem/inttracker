# Status do projeto

## Fase atual: 4 — Fornecedor de fios + recálculo automático

Fase 3 implementada em 2026-05-25, aguardando QA do Vinícius. Próxima: tela do fornecedor de fios com recálculo automático.

## Fases concluídas

### Fase 3 — Admin: Nova OP com cálculo ao vivo ⏳ (implementada 2026-05-25, aguardando QA)

**Implementado:**
- Tela Lista de OPs (`#/ops`): tabela com status, modelo, largura, datas e ações
- Tela Nova OP (`#/ops/nova`, `#/ops/:id`): layout página-única com painel lateral de cálculo de fio (kg por cor) ao vivo
- Salvar como simulação (`simulada`, sem ordens de compra) ou Abrir OP (`aberta`, gera registros em `ordens_compra_fio`)
- Modo leitura para OPs não-simuladas (campos travados, botões ocultos)
- Lógica de cálculo extraída para `js/calculo-op.js` (funções puras `calcularFiosOP` + `montarOrdensCompraFio`)
- Testes automatizados com `node --test`: **9/9 passando** (`tests/calculo-op.test.js`)
- Checklist QA: `docs/qa/fase3-checklist.md` (itens 1–4 automatizados ✅; itens 5–14 manuais pendentes)

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

- **Fase 4 — Fornecedor de fios + recálculo automático** ← próxima
- Fase 5 — Tecelagem e látex (entregas parciais, defeitos)
- Fase 6 — Fechamento de OP, painel inicial, estoque
- Fase 7 — Polimento visual (após screenshots do Max Home)
