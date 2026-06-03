# QA — Fase 5b: OP de Látex

Pré-requisitos: rodar `db/08_fase5b_latex.sql` no Supabase; ter ao menos 1 empresa de látex cadastrada; uma OP de tecelagem `em_producao` com fornecedor de tecelagem.

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `totalEntregueCimaPorItem` soma o recebido de látex (mesma forma de dados).
- [x] 2. Recebido de látex ignora itens com defeito.

## Criação automática (RPC `gerar_op_latex`)
- [x] 3. Salvar uma entrega de tecelagem (com destino) cria 1 OP `tipo='latex'`.
- [x] 4. A OP de látex tem número próprio sequencial (não colide com as de tecelagem).
- [x] 5. Os `op_itens` da OP de látex = enviado por modelo (soma sem defeito).
- [x] 6. `op_fornecedores` da OP de látex aponta para a empresa de látex (destino).
- [x] 7. Editar a entrega de tecelagem NÃO altera a OP de látex (independente).
- [x] 8. Salvar a MESMA entrega de novo não duplica a OP de látex (idempotência).
- [x] 9. Entrega só com defeito não gera OP de látex.

## Lista de OPs (admin)
- [x] 10. Coluna "Tipo" mostra badge Tecelagem/Látex.
- [x] 11. Filtro Todas/Tecelagem/Látex funciona.

## Detalhe da OP de látex (admin)
- [x] 12. Tabela Enviado × Recebido × Falta por modelo bate.
- [x] 13. Botão "Ir para OP de tecelagem" navega para a OP de origem.
- [x] 14. Na OP de tecelagem, "Ver OP de látex" navega para a OP de látex gerada.
- [x] 15. Admin lança/edita/exclui recebimento; Recebido e Falta atualizam.
- [x] 16. Admin edita o "enviado" (op_itens) manualmente e o valor persiste.
- [x] 17. Admin finaliza a OP de látex (status `finalizada`); bloco vira leitura.
- [x] 18. Admin exclui a OP de látex (bloqueada se houver recebimentos).

## Empresa de látex (logada)
- [x] 19. Login da empresa de látex cai em `#/fornecedor/latex`.
- [x] 20. Vê apenas as próprias OPs de látex em produção (RLS).
- [x] 21. Registra recebimento por modelo (sem campo de destino) e vê no histórico.
- [x] 22. Editar/excluir os próprios recebimentos funciona.

## Resultado
22/22 ✅ — validado por Vinícius em 2026-06-02.
