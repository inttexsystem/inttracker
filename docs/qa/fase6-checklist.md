# QA — Fase 6: Cliente, Lote, fios sob demanda, % e PDF

Pré-requisitos: rodar `db/09_fase6_cliente_lote.sql` no Supabase; ter ≥1 cliente cadastrado.

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `percentualEntregueOP` (ajustado/pedido, defeito, meta=0, cap 100).
- [x] 2. `agruparOrdensCompraFio` (separação por tipo, soma, ordenação).

## Clientes
- [ ] 3. Cadastro de Clientes (criar/editar/excluir) na barra lateral.

## Cliente + Lote na OP
- [ ] 4. Nova OP exige Cliente para salvar/abrir.
- [ ] 5. Ao salvar a 1ª OP, nasce um lote com número sequencial automático.
- [ ] 6. Cabeçalho da OP mostra "Lote Nº · Cliente".
- [ ] 7. OP de látex gerada herda o mesmo lote/cliente da OP de tecelagem.

## Fios sob demanda
- [ ] 8. Abrir OP NÃO exige fornecedores de fio (só cliente + tecelagem).
- [ ] 9. Ordens de fio nascem sem fornecedor; PDF/lista mostram as ordens.
- [ ] 10. No detalhe, admin atribui fornecedor de algodão e de poliéster.
- [ ] 11. Após atribuir, o fornecedor de fio logado vê a ordem e registra o kg.

## Lista de OPs
- [ ] 12. Colunas Lote e Cliente aparecem.
- [ ] 13. Barra de % entregue bate com entregue ÷ (ajustado/pedido).

## PDF
- [ ] 14. Botão "PDF de compra de fios" baixa o PDF.
- [ ] 15. PDF tem cabeçalho (lote/cliente/OP/data) e seções Algodão e Poliéster com subtotais.

## Resultado
(preencher após execução: X/15)
