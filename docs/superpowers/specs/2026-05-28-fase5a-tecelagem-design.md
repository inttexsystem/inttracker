# Design — Fase 5a: Tecelagem (parte de cima)

Data: 2026-05-28
Fase: 5a (Fase 5 decomposta em 5a-tecelagem e 5b-látex futura)

## 1. Objetivo

Permitir que o fornecedor de **tecelagem** (parte de cima) registre suas **entregas parciais** de cada OP em produção, com defeitos identificados por linha; e que o **admin** acompanhe pelo detalhe da OP e possa lançar entregas em nome da tecelagem.

A OP **continua em `em_producao`** ao longo de toda a Fase 5a — a transição para `finalizada` depende do látex (Fase 5b).

## 2. Decisões de design (do brainstorming)

- **Decomposição**: Fase 5 dividida em **5a (tecelagem)** e **5b (látex com múltiplos destinos)**; este spec cobre só 5a.
- **Quem registra**: tecelagem + admin (espelha a baixa de fios da Fase 4).
- **Defeitos**: ficam registrados mas **não contam** no total entregue. Tecelagem precisa reentregar os metros bons.
- **1 entrega = 1 OP**. Cenário raro de itens de OPs diferentes no mesmo dia → lançam duas entregas separadas no mesmo dia.
- **Admin no OP detail**: **resumo por item** + **lista cronológica** de entregas.
- **Tela do fornecedor**: lista de OPs em produção com **formulário inline expansível** por OP (mesmo padrão da Fase 4).
- **Excesso de entrega**: permitido; "Falta" vira negativo (visível).
- **Editar/excluir entregas**: dentro do escopo do MVP (botões na lista; tanto fornecedor quanto admin).
- **Roteamento por tipo de fornecedor**: ao logar, busca `fornecedores.tipo` e direciona pra `#/fornecedor/ordens` (fios) ou `#/fornecedor/entregas` (tecelagem/látex).

## 3. Fluxo

```
OP em 'em_producao' (Fase 4 já liberou a produção)
        │
        ▼
[TECELAGEM]  #/fornecedor/entregas
   lista suas OPs em produção; em cada card vê pedido/ajustado/entregue/falta
   → "+ Nova entrega" abre form inline (data + linha por item: metros + defeito + obs)
   → grava entrega + entrega_itens (linhas com metros > 0)
   → pode editar / excluir entregas próprias
        │
        ▼
[ADMIN]  #/ops/:id  (bloco "Entregas tecelagem")
   resumo por item (Modelo · Pedido · Ajustado · Entregue · Falta)
   + lista cronológica de entregas (data, linhas, defeitos destacados)
   + "+ Nova entrega" lança no lugar da tecelagem (mesmo form, fornecedor_id = op_fornecedores.cima)
   + editar/excluir entregas
```

A OP permanece `em_producao` durante toda a fase. Nenhuma transição de status nesta fase.

## 4. Função pura

Nova função em `js/calculo-op.js`: `totalEntregueCimaPorItem(itens)`.

```
totalEntregueCimaPorItem(itens)
  itens: [{ op_item_id, metros_entregues, defeito }]
  Retorna: { [op_item_id]: kg_total_sem_defeito }   // 2 casas decimais
```

Regras:
- Soma apenas linhas com `defeito === false`.
- Linhas sem `op_item_id` são ignoradas (cenário cross-OP raro, fora do MVP).
- Arredonda a 2 casas (`Math.round(x * 100) / 100`).
- Sem itens → retorna `{}`.

Usada pela tela do fornecedor (calcular "Falta" por item) e pelo bloco admin no OP detail (montar o resumo).

## 5. Tela do fornecedor de tecelagem — `#/fornecedor/entregas`

Nova função `screenFornecedorEntregas()`. Roteada por `tipo === 'tecelagem'` (Seção 7).

**Carga:**
- OPs em produção do tecelagem: `ops.status='em_producao'` joined com `op_fornecedores` onde `fornecedor_id = CURRENT_USER.fornecedor_id AND etapa='cima'`.
- Para cada OP: `op_itens(id, modelo_id, metros_pedidos, metros_ajustados)` + soma agregada de `entrega_itens` agrupada por `op_item_id` (excluindo defeitos) → calcula "Entregue" por item.
- Histórico: `entregas` próprias com `entrega_itens` para listagem cronológica.

**Layout — um card por OP em produção:**
- Header: **Lote Nº/AAAA** + status badge.
- Tabela dos itens: **Modelo** (`Nome 1.40m · COR1/COR2`) · **Pedido** · **Ajustado** · **Entregue** · **Falta** (vermelho se negativo, verde `✅ completo` se Entregue ≥ Ajustado).
- Botão **"+ Nova entrega"** expande um formulário inline dentro do card:
  - **Data** (default hoje).
  - Uma linha por `op_item`: `metros` (input number, vazio = não entrega esse item agora), `defeito` (checkbox), `observação` (texto curto).
  - **Salvar entrega** / **Cancelar**.
  - Validação: ao menos 1 linha com `metros > 0`.

**Seção "Histórico de entregas"** abaixo: lista (cards ou tabela) das entregas próprias em ordem cronológica reversa, mostrando data, OP (lote), total entregue (sem defeito), número de linhas, com defeito destacado. Cada entrega tem botões **Editar** e **Excluir** (`confirmDialog`).

**Estado vazio:** sem OPs em produção atribuídas → mensagem amigável ("Nenhuma OP em produção atribuída a você no momento.").

**Sem `fornecedor_id` vinculado** → estado vazio amigável (igual à tela de fios).

## 6. Bloco "Entregas tecelagem" no detalhe da OP (admin)

Novo helper `buildBlocoTecelagem()` em `screenNovaOP`. Aparece quando `op.status !== 'simulada'` e existe `op_fornecedores` etapa='cima'. Posicionado **logo abaixo** do "Recebimento de fios" (Fase 4).

**Conteúdo:**
1. **Resumo por item** (tabela): Modelo · Pedido · Ajustado · Entregue · Falta (negativo permitido; ✅ completo quando Entregue ≥ Ajustado).
2. Em `em_producao`: botão **"+ Nova entrega"** abre o mesmo form inline da Seção 5. O `fornecedor_id` da `entregas` é o `op_fornecedores.fornecedor_id` etapa='cima' (a tecelagem atribuída).
3. **Lista cronológica de entregas**: cada entrega como sub-card com data + nome do fornecedor + linhas (modelo, metros, **DEFEITO** em vermelho, observação). Botões **Editar** e **Excluir** ao lado.

Em `finalizada` o bloco também aparece, em leitura (sem botões).

## 7. Roteamento por tipo de fornecedor

Hoje (Fase 4): o redirect de login do fornecedor vai direto pra `#/fornecedor/ordens`.

Mudança: depois do login, se `usuarios.tipo === 'fornecedor'`, buscar `fornecedores.tipo` por `fornecedor_id` e direcionar:
- `fio_algodao` ou `fio_poliester` → `#/fornecedor/ordens` (Fase 4).
- `tecelagem` → `#/fornecedor/entregas` (Fase 5a, nova).
- `latex` → `#/fornecedor/entregas` como fallback (a Fase 5b ajustará para sua tela própria).

A rota `#/fornecedor/entregas` é registrada com `roles: ['fornecedor']`.

## 8. Persistência

**Nova entrega** (`salvarEntrega`):
1. Bloqueia se nenhuma linha tem `metros > 0`.
2. `INSERT INTO entregas (fornecedor_id, etapa='cima', data, observacao)` → captura `id`.
3. `INSERT INTO entrega_itens (entrega_id, op_id, op_item_id, metros_entregues, defeito, observacao)` para cada linha com metros > 0.
4. Se algum passo falhar: `DELETE FROM entregas WHERE id = ?` (filhos caem por cascade) e toast de erro.

**Editar entrega** (`editarEntrega`):
1. `UPDATE entregas` (data, observacao).
2. `DELETE FROM entrega_itens WHERE entrega_id = ?`.
3. Reinsere as `entrega_itens` com os novos valores (mesma estratégia de "substitui filhos" da Fase 3).
4. Erros — toast e log.

**Excluir entrega** (`excluirEntrega`):
1. `confirmDialog`.
2. `DELETE FROM entregas WHERE id = ?` (entrega_itens caem por cascade).

## 9. RLS

Já está pronto em `db/03_policies.sql` (`entregas_admin`, `entregas_fornecedor_read`, `entregas_fornecedor_insert`, `entrega_itens_admin`, `entrega_itens_fornecedor`). Tecelagem pode ler/inserir suas próprias `entregas`; fornecedor de tecelagem pode dar `UPDATE`/`DELETE` em `entrega_itens` via a relação com `entregas`. Admin: FOR ALL.

**Lacuna a confirmar no plano:** o `entregas_fornecedor_insert` permite INSERT, mas `entregas_fornecedor_update`/`delete` não existem explicitamente — só o INSERT. Tecelagem editando/excluindo a própria entrega pode precisar de policies adicionais. O plano deve verificar e, se faltar, adicionar SQL (sem Restart no Supabase).

## 10. Erros e bordas

- Entrega sem nenhuma linha com `metros > 0` → bloqueia salvar com toast.
- Excesso (total entregue > ajustado) → permitido; "Falta" fica negativo.
- Linha com defeito ainda exige `metros_entregues > 0` (schema CHECK).
- Edição que esvazia todas as linhas → bloqueia (mesma regra do salvar).
- Fornecedor sem `fornecedor_id` vinculado → estado vazio amigável.

## 11. Testes

**Automatizados (`node --test tests/calculo-op.test.js`):**
- `totalEntregueCimaPorItem`: soma normal; ignora defeito; item sem entregas (chave ausente); arredondamento a 2 casas; vazio retorna `{}`.

**QA manual** — novo `docs/qa/fase5a-checklist.md`:
- Tecelagem (logado como fornecedor de tecelagem): ver OPs em produção; criar entrega; ver no histórico; editar; excluir; estado vazio.
- Admin: bloco "Entregas tecelagem" no detalhe da OP (resumo + lista); criar entrega no lugar do tecelagem; editar; excluir.
- Login: usuário tecelagem cai em `#/fornecedor/entregas`; usuário de fios continua em `#/fornecedor/ordens`.
- Excesso: permitido, mostra Falta negativo.
- Defeito não conta no "Entregue" mas aparece no histórico.

## 12. Fora de escopo

- Látex e múltiplos destinos → Fase 5b.
- Transição automática da OP para `finalizada` → Fase 5b/6 (depende do látex).
- Entrega cruzando múltiplas OPs no mesmo registro → fallback é criar duas entregas separadas no mesmo dia.
- Bloqueio por concorrência (tecelagem + admin editando ao mesmo tempo) — aceita risco no MVP.
