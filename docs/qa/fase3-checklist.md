# QA — Fase 3: Nova OP com cálculo ao vivo

Pré-requisitos: logado como admin; cadastros da Fase 2 populados (seed `db/04_seed.sql`).

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. 1 item 1,40 / 200 m → algodão 0,070 kg por cor; poliéster 0,084 kg PRETO e BRANCO.
- [x] 2. 2 itens de larguras diferentes → soma por cor correta.
- [x] 3. Poliéster sempre lista PRETO e BRANCO (mesmo zero).
- [x] 4. `montarOrdensCompraFio` gera 1 ordem por cor de algodão + PRETO + BRANCO.

## UI / Integração (manual no site)
- [x] 5. Menu "OPs" aparece; `#/ops` lista as OPs (Lote, status, itens, data).
- [x] 6. "Nova OP" sugere número = último do ano + 1.
- [x] 7. Adicionar/editar itens recalcula o painel ao vivo.
- [x] 8. Remover último item zera o painel.
- [x] 9. "Abrir OP" desabilitado até os **3** fornecedores (algodão, poliéster, tecelagem) estarem escolhidos. **Látex NÃO é escolhido na criação da OP** (decidido após a parte de cima — Fase 5).
- [x] 10. "Salvar simulação" grava status `simulada` e **não** gera `ordens_compra_fio`.
- [x] 11. "Abrir OP" grava `aberta` e gera as `ordens_compra_fio` corretas (conferir no Supabase).
- [x] 12. Reabrir uma `simulada` recarrega itens/fornecedores; salvar substitui os filhos.
- [x] 13. OP `aberta`/`em_producao`/`finalizada` abre em leitura (campos desabilitados, sem botões).
- [x] 14. Número/ano duplicado → mensagem "Já existe OP nº X em <ano>".

## Resultado
**14/14** — QA aprovado por Vinícius em 2026-05-27. Fase 3 concluída.
