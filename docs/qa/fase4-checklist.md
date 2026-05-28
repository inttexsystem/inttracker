# QA — Fase 4: Recebimento de fios + recálculo automático

Pré-requisitos: logado conforme cada item; OP `aberta` com ordens de fio geradas (Fase 3).

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `recalcularOP` fator < 1 escala metros pra baixo e gera saldo.
- [x] 2. `recalcularOP` fator > 1 escala metros pra cima.
- [x] 3. `recalcularOP` fator = 1 não ajusta e não gera saldo.
- [x] 4. Arredondamento: metros 2 casas, sobra 3 casas.

## Fornecedor (manual no site, logado como fornecedor de fios)
- [ ] 5. Menu "Minhas ordens"; tela lista Pendentes e Recebidas.
- [ ] 6. Registrar recebimento (kg + data) move a ordem para Recebidas com status correto (parcial se kg < pedido).
- [ ] 7. Usuário sem fornecedor vinculado vê estado vazio amigável.

## Admin (manual no site, logado como admin)
- [ ] 8. OP `aberta` mostra o bloco "Recebimento de fios" com a tabela das ordens.
- [ ] 9. Com ordens pendentes: aviso "Aguardando recebimento de N fio(s)", sem botões.
- [ ] 10. Todas recebidas: mostra fator, tabela pedido→proposto e sobras.
- [ ] 11. "Aceitar proposta": grava `metros_ajustados = pedido × fator`, `saldo_fios_op`/`saldo_fios`, OP → `em_producao` (conferir no Supabase).
- [ ] 12. "Manter pedido": `metros_ajustados = metros_pedidos`, saldo = `recebido − pedido` (>0), OP → `em_producao`.
- [ ] 13. OP `em_producao` abre o bloco em leitura (metros aplicados, sem botões).

## Resultado
(preencher após execução: X/13)
