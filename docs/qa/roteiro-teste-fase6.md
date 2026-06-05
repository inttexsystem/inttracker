# Roteiro de testes — Fase 6 (guiado)

Feito para o Vinícius executar no app publicado. Antes de começar:
- Abra o site numa **aba anônima** (ou Cmd+Shift+R) pra furar o cache do GitHub Pages.
- Confirme que rodou o `db/09_fase6_cliente_lote.sql` no Supabase (já foi feito em 2026-06-05).
- Se algo der "Erro ao carregar" ou comportar estranho, abra o console (F12) e me mande a mensagem.

Marque cada item: ✅ funcionou / ❌ deu problema (anote o que viu).

## 1. Cadastro de Clientes
- [ ] 1.1 Na barra lateral aparece o item **Clientes**.
- [ ] 1.2 Criar um cliente novo (ex.: "LOJA TESTE") — salva e aparece na lista.
- [ ] 1.3 Editar o nome do cliente — persiste.
- [ ] 1.4 (Opcional) Tentar excluir um cliente que já está em uso por um lote → deve dar aviso e não excluir.

## 2. Nova OP com Cliente + Lote
- [ ] 2.1 Abrir **Nova OP**. Tem o campo **Cliente** (select).
- [ ] 2.2 Tentar salvar/abrir **sem cliente** → bloqueia pedindo o cliente.
- [ ] 2.3 Escolher cliente + adicionar itens (modelo × metros) + escolher **fornecedor de tecelagem**. Repare que **não há mais** campos de fornecedor de algodão/poliéster aqui.
- [ ] 2.4 Salvar simulação → reabrir a OP: cabeçalho mostra **"OP Nº x/ano · Lote Nº N · Cliente"**.
- [ ] 2.5 O **Lote Nº** foi gerado automático (sequencial).
- [ ] 2.6 Criar uma segunda OP (outro cliente ou o mesmo) → o lote dela é o **próximo número** (sequência).

## 3. Abrir OP só com cliente + tecelagem
- [ ] 3.1 Numa OP com cliente + tecelagem escolhidos, o botão **Abrir OP** fica habilitado (sem precisar de fornecedores de fio).
- [ ] 3.2 Abrir a OP → ela gera as **ordens de compra de fio** (aparecem no bloco "Recebimento de fios"), ainda **sem fornecedor**.

## 4. Atribuir fornecedor de fio depois
- [ ] 4.1 No detalhe da OP aberta, no topo do bloco "Recebimento de fios", há os selects **Fornecedor de algodão** e **Fornecedor de poliéster** (conforme os fios da OP).
- [ ] 4.2 Escolher um fornecedor de algodão + **Atribuir** → confirma ("Fornecedor atribuído").
- [ ] 4.3 Fazer o mesmo pro poliéster (se houver).
- [ ] 4.4 **Sair (logout) e logar como o fornecedor de fio** atribuído → ele vê a(s) ordem(ns) dele e consegue **registrar o kg recebido**.
- [ ] 4.5 Voltar como admin: o kg aparece como recebido.

## 5. Lista de OPs (colunas + barra de %)
- [ ] 5.1 Na lista de OPs há as colunas **Lote** e **Cliente**.
- [ ] 5.2 Há uma **barra de % entregue** por OP.
- [ ] 5.3 Numa OP que já teve entrega, a % bate com o esperado (entregue ÷ pedido/ajustado). OP sem entrega = 0%.
- [ ] 5.4 O filtro Todas / Tecelagem / Látex continua funcionando (a barra não some ao filtrar).

## 6. PDF de compra de fios
- [ ] 6.1 No detalhe de uma OP aberta, botão **"📄 PDF de compra de fios"**.
- [ ] 6.2 Clicar baixa um PDF `compra-fios-OP-<numero>-<ano>.pdf`.
- [ ] 6.3 O PDF tem cabeçalho (**Lote Nº · Cliente · OP · data**) e seções **Algodão** e **Poliéster** com os fios por cor + **subtotal** de cada.

## 7. Látex herda lote/cliente (integração com Fase 5b)
- [ ] 7.1 Numa OP de tecelagem `em_producao` com fornecedor de tecelagem, registrar uma **entrega de tecelagem** com destino de látex.
- [ ] 7.2 A **OP de látex** gerada automaticamente aparece na lista com o **mesmo Lote/Cliente** da OP de tecelagem.
- [ ] 7.3 No detalhe da OP de látex, o cabeçalho mostra "Lote Nº · Cliente".

---

**Resultado:** ___ / 7 blocos OK. Anotações:
```
(escreva aqui o que falhou, se algo)
```
