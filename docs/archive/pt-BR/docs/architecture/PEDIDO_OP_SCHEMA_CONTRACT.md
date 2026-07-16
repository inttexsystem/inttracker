# Contrato Técnico — Schema Pedido ↔ OP ↔ Movimentação ↔ Documentos

> **Fase:** `RAVATEX-TAPETES-PEDIDO-OP-SCHEMA-CONTRACT-B` (docs-only)
> **Tipo:** Diagnóstico + contrato técnico read-only no código/schema.
> **HEAD base:** `04613ee` — `work/app-next`
> **Data:** 2026-07-01
> **Dependência:** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (Fase A)

---

## Atualizacao 2026-07-06 - OP Create Requires Pedido Guard B

Fase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`: a criacao de OP
via frontend/persistencia JS passa a exigir Pedido vinculado. Esta fase nao
altera schema, SQL, migrations, RLS ou RPCs.

- `lotes.pedido_id` deixa de ser opcional no caminho canonico de criacao de
  OP por UI: `persistirOP` rejeita `pedidoId` vazio antes de qualquer write.
- `#/ops/nova?pedido_id=<uuid>` permanece o caminho permitido para criar OP.
- `#/ops/nova` sem `pedido_id` e o botao avulso `Nova OP` deixam de iniciar
  uma OP sem Pedido.
- O helper defensivo retorna `step: 'pedido_required'` e nao consome
  `op_numeros`.
- Diagnostico read-only de staging confirmou dados historicos fora do contrato:
  11 OPs cujo `lote.pedido_id` esta NULL e 9 lotes sem Pedido vinculados a OPs.

Decisao registrada: a partir desta fase, OP avulsa nao e mais caminho de
produto pela UI Admin. O contrato anterior que permitia OP avulsa deve ser
tratado como legado/historico para dados ja existentes, nao como comportamento
novo aceitavel.

Pendencia obrigatoria de backend: criar guard em `gerar_op_latex` e funcoes de
split/derivadas para rejeitar origem sem Pedido antes de criar OP filha. A
mitigacao atual e frontend/persistencia JS, nao substitui constraint/RPC.

## Atualizacao 2026-07-06 - OP Create Requires Pedido RPC Guard C

Fase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`: guard backend
preparado em migration versionada `db/33_op_latex_requires_pedido_guard.sql`.

- `gerar_op_latex(BIGINT)` e `gerar_op_latex_split(BIGINT, TEXT)` passam a
  exigir que a OP origem tenha `lote_id` e que `lotes.pedido_id` esteja
  preenchido.
- A validacao ocorre antes de `proximo_numero_op`, evitando consumo de
  numeracao quando a origem e orfa.
- Erro controlado: `Nao e possivel gerar OP de Acabamento/Latex: OP origem nao
  possui Pedido vinculado.`
- Fluxos validos com Pedido preservam assinatura, retorno JSONB,
  `op_latex_entregas`, `op_fornecedores`, `op_itens`, eventos de split e
  filtros `motivo_separacao IS NULL`.
- Nao ha constraint global, trigger, `NOT NULL`, backfill, cleanup, RLS ou
  correcao de dados historicos nesta fase.
- Aplicado em staging `ucrjtfswnfdlxwtmxnoo` pelo usuario; producao intocada. Validacao completa executada em `2026-07-06` (5 diagnosticos OK, testes locais verdes).

O diagnostico de orfaos foi ampliado para listar as 11 OPs historicas sem
Pedido com entregas, movimentacao/expedicao, possibilidade de inferir Pedido e
classificacao preliminar A/B/C/D. A classificacao e informativa; nao autoriza
correcao automatica. Resultado desta rodada em staging: A=6 (`op_id`
1,2,3,4,9,15), B=4 (`op_id` 5,6,7,8), C=0, D=1 (`op_id` 10).

## Atualizacao 2026-07-06 - Admin Wide Expand D

Fase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`: expansao
frontend-only do display operacional de OP para telas Admin com Pedido
resolvivel. O contrato permanece sem schema novo:

- identificacao principal: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`;
- `tipo`: `T` para tecelagem, `A` para latex/acabamento;
- `seq`: por Pedido+Tipo, ordenado por `ops.criado_em` e `ops.id`;
- fallback/legado: `OP {numero}/{ano}` e exibicao secundaria `Nº interno {numero}/{ano}`;
- resolucao OP->Pedido continua por `ops.lote_id -> lotes.pedido_id -> pedidos.id`;
- siblings sao OPs dos lotes do mesmo Pedido, obtidos em memoria quando ja carregados
  ou por leitura leve `lotes do pedido -> ops desses lotes`.

Nao houve alteracao em `ops.numero`, `ops.ano`, `op_numeros`, RPCs, RLS, PDFs,
fornecedor, banco ou migrations.

## 1. Estado atual validado no schema

### 1.1. Tabelas existentes relevantes

| Tabela | Migração | Status em staging |
|---|---|---|
| `ops` | `db/01_schema.sql` | Aplicado |
| `op_itens` | `db/01_schema.sql` | Aplicado |
| `entregas` | `db/01_schema.sql` | Aplicado |
| `entrega_itens` | `db/01_schema.sql` | Aplicado |
| `lotes` | `db/09_fase6_cliente_lote.sql` | Aplicado |
| `clientes` | `db/09_fase6_cliente_lote.sql` | Aplicado |
| `pedidos` | `db/13_pedidos_schema.sql` | Aplicado |
| `pedido_itens` | `db/13_pedidos_schema.sql` | Aplicado |
| `pedido_eventos` | `db/13_pedidos_schema.sql` | Aplicado |
| `pedido_cliente_eventos` | `db/15_status_cliente_visual.sql` | Aplicado |
| `pedido_parciais` | `db/17_pedido_parciais_schema.sql` | Aplicado |
| `pedido_parcial_itens` | `db/17_pedido_parciais_schema.sql` | Aplicado |
| `op_eventos` | `db/21_op_lifecycle_status_eventos.sql` | **Aplicado em staging** `ucrjtfswnfdlxwtmxnoo`. Pendente em produção. |
| `documentos_operacionais` | — | **Não existe** |

### 1.2. Colunas-chave validadas

#### `lotes` (db/09, alterado por db/13)

| Coluna | Tipo | Nullable | FK | Descrição |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `numero` | INTEGER UNIQUE | NOT NULL | | Sequencial global |
| `cliente_id` | BIGINT | NOT NULL | → `clientes.id` ON DELETE RESTRICT | Cliente dono do lote |
| `pedido_id` | UUID | **NULLABLE** | → `pedidos.id` ON DELETE SET NULL | Pedido comercial que originou o lote |
| `criado_em` | TIMESTAMPTZ | NOT NULL | | |

**Diagnóstico:** `lotes.pedido_id` existe, é nullable por design, mas **nunca é populado** por nenhum código JS hoje. `persistirOP` (js/screens/op-persistir.js) cria/atualiza lotes apenas com `cliente_id`.

#### `ops` (db/01, alterado por db/08, db/09)

| Coluna | Tipo | Nullable | FK | Descrição |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `numero` | INTEGER | NOT NULL | | Numeração por (ano, tipo) |
| `ano` | INTEGER | NOT NULL | | |
| `status` | TEXT | NOT NULL | simulada/aberta/em_producao/pausada/concluida/cancelada/finalizada | Expandido em db/21. `finalizada` = legado látex. `concluida` = canônico. |
| `tipo` | TEXT | NOT NULL | tecelagem/latex | Adicionado em db/08 |
| `lote_id` | BIGINT | NULLABLE | → `lotes.id` ON DELETE SET NULL | Adicionado em db/09 |
| `origem_op_id` | BIGINT | NULLABLE | → `ops.id` ON DELETE SET NULL | OP de tecelagem que originou esta OP de látex (db/08) |
| `origem_entrega_id` | BIGINT | NULLABLE | → `entregas.id` ON DELETE SET NULL | Entrega de tecelagem que originou esta OP de látex (db/08) |
| `observacao` | TEXT | NULLABLE | | Adicionado em db/08 |

**UNIQUE atual:** `(numero, ano, tipo)`.

#### `op_itens` (db/01)

| Coluna | Tipo | Nullable | FK | Descrição |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE CASCADE | |
| `modelo_id` | BIGINT | NOT NULL | → `modelos.id` ON DELETE RESTRICT | |
| `metros_pedidos` | NUMERIC(10,2) | NOT NULL | | |
| `metros_ajustados` | NUMERIC(10,2) | NULLABLE | | Preenchido após recálculo |
| `pedido_item_id` | UUID | **NULLABLE** | → `pedido_itens.id` ON DELETE SET NULL | Migration `db/20_op_itens_pedido_item_link.sql` (Fase C). **Aplicado em staging** `ucrjtfswnfdlxwtmxnoo`. |

#### `entrega_itens` (db/01)

| Coluna | Tipo | Nullable | FK | Descrição |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `entrega_id` | BIGINT | NOT NULL | → `entregas.id` ON DELETE CASCADE | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE RESTRICT | De qual OP |
| `op_item_id` | BIGINT | NULLABLE | → `op_itens.id` ON DELETE RESTRICT | Qual item da OP |
| `modelo_id` | BIGINT | NULLABLE | → `modelos.id` ON DELETE RESTRICT | Fallback se sem op_item |
| `metros_entregues` | NUMERIC(10,2) | NOT NULL | | |
| `defeito` | BOOLEAN | NOT NULL | | DEFAULT FALSE |
| `observacao` | TEXT | NULLABLE | | |

**CHECK:** `op_item_id IS NOT NULL OR modelo_id IS NOT NULL`.

#### `pedidos` (db/13, alterado por db/15, db/17)

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID PK | | |
| `cliente_id` | BIGINT | NOT NULL | → `clientes.id` |
| `numero` | BIGINT | GENERATED BY DEFAULT AS IDENTITY | Sequencial único |
| `status` | TEXT | NOT NULL | rascunho/recebido/confirmado/produzindo/entregue/cancelado |
| `status_cliente_visual` | TEXT | NULLABLE | (db/15) |
| `status_cliente_excecao` | TEXT | NULLABLE | (db/15) |
| `status_cliente_mensagem` | TEXT | NULLABLE | (db/15) |
| `referencia_cliente` | TEXT | NULLABLE | (db/15) |
| `prazo_desejado` | DATE | NULLABLE | (db/15) |
| `tipo_recebimento` | TEXT | NULLABLE | (db/15) |
| `parcial_habilitado` | BOOLEAN | NOT NULL DEFAULT FALSE | (db/17) |
| `metros_total` | NUMERIC(12,2) | NULLABLE | (db/17) |
| `token_acesso` | UUID | UNIQUE | Não usado no MVP |

#### `pedido_itens` (db/13)

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID PK | | |
| `pedido_id` | UUID | NOT NULL | → `pedidos.id` CASCADE |
| `modelo_id` | BIGINT | NOT NULL | → `modelos.id` RESTRICT |
| `metros` | NUMERIC(10,2) | NOT NULL | |
| `largura` | NUMERIC(3,2) | NULLABLE | Override do modelo |
| `cor_1_id` | BIGINT | NULLABLE | Override do modelo |
| `cor_2_id` | BIGINT | NULLABLE | Override do modelo |
| `observacao` | TEXT | NULLABLE | |
| `ordem` | INTEGER | NOT NULL | DEFAULT 0 |

#### `pedido_parciais` + `pedido_parcial_itens` (db/17)

| Tabela | Vínculo principal |
|---|---|
| `pedido_parciais` | `pedido_id` → `pedidos.id` CASCADE |
| `pedido_parcial_itens` | `parcial_id` → `pedido_parciais.id` CASCADE; `pedido_item_id` → `pedido_itens.id` CASCADE |

**Diagnóstico:** `pedido_parcial_itens.pedido_item_id` já referencia `pedido_itens.id`. Mas `op_itens` e `pedido_itens` **não possuem vínculo direto entre si**.

### 1.3. RPCs existentes

| Função | Descrição | Relevante para esta frente |
|---|---|---|
| `gerar_op_latex(BIGINT)` | Cria OP de látex a partir de entrega de tecelagem. Herda `lote_id` da OP origem. | Sim — herda lote mas não popula `lotes.pedido_id` |
| `alterar_status_op(BIGINT, TEXT, TEXT)` | Transiciona status da OP com validação. **Admin-only** (`is_admin()`). `SECURITY DEFINER`. `p_observacao` é vinculada ao evento `status_alterado` correspondente ao novo status. Retorna JSON. | Sim — db/21 (R1: guard admin + vínculo determinístico da observação) |
| `sincronizar_pedido_parciais_resumo(UUID, BOOLEAN)` | Atualiza campos de resumo de parciais em `pedidos`. | Sim — camada comercial |
| `is_admin()` | Verifica se usuário é admin. | Sim — RLS |
| `meu_fornecedor_id()` | Retorna fornecedor_id do usuário logado. | Sim — RLS |
| `meu_cliente_id()` | Retorna cliente_id do usuário logado. | Sim — RLS |

### 1.4. Triggers existentes

| Trigger | Tabela | Evento | Descrição |
|---|---|---|---|
| `pedidos_cliente_visual_insert_guard` | `pedidos` | BEFORE INSERT | Zera campos visuais para não-admin (db/15) |
| `pedidos_cliente_visual_touch` | `pedidos` | BEFORE UPDATE | Atualiza timestamp visual (db/15) |
| `pedido_parciais_touch_updated_at` | `pedido_parciais` | BEFORE UPDATE | Atualiza `atualizado_em` (db/17) |
| `pedido_parciais_after_change_trigger` | `pedido_parciais` | AFTER INSERT/UPDATE/DELETE | Sincroniza resumo (db/17) |
| `trg_op_evento` | `ops` | AFTER UPDATE OF status | Registra evento `status_alterado` em `op_eventos` (db/21). A `p_observacao` da RPC `alterar_status_op` é vinculada ao evento deste trigger correspondente a `status_novo` (R1) |

### 1.5. Tabela `op_eventos` (db/21)

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE CASCADE |
| `tipo_evento` | TEXT | NOT NULL | `status_alterado` ou futuro |
| `status_anterior` | TEXT | NULL | Status antes da transição |
| `status_novo` | TEXT | NULL | Status após a transição |
| `observacao` | TEXT | NULL | Observação opcional |
| `payload` | JSONB | NOT NULL DEFAULT `{}` | Metadados complementares |
| `criado_por` | UUID | NULL | → `auth.users.id` ON DELETE SET NULL |
| `criado_em` | TIMESTAMPTZ | NOT NULL DEFAULT `now()` | |

Índices: `op_eventos_op_id_idx (op_id)`, `op_eventos_criado_em_idx (op_id, criado_em DESC)`.

**Evidência SQL staging aplicada (2026-07-01):**

```json
[
  {
    "op_eventos": "op_eventos",
    "tem_alterar_status_op": true,
    "tem_trg_op_evento": true,
    "status_check": "CHECK ((status = ANY (ARRAY['simulada'::text, 'aberta'::text, 'em_producao'::text, 'pausada'::text, 'concluida'::text, 'cancelada'::text, 'finalizada'::text])))"
  }
]
```

Conclusão: SQL STAGING OK. Constraint de ops.status atualizada. Tabela op_eventos criada. RPC alterar_status_op criada. Trigger trg_op_evento criado. Produção não tocada. Repo ainda sem push.

### 1.6. RLS relevante

| Tabela | Policies | Acesso |
|---|---|---|
| `ops` | `ops_admin`, `ops_fornecedor_read` | Admin ALL; fornecedor SELECT se vinculado |
| `op_itens` | `op_itens_admin`, `op_itens_fornecedor_read` | Admin ALL; fornecedor SELECT se vinculado |
| `entregas` | `entregas_admin`, `entregas_fornecedor_read`, `entregas_fornecedor_insert` | Admin ALL; fornecedor SELECT/INSERT próprio |
| `entrega_itens` | `entrega_itens_admin`, `entrega_itens_fornecedor` | Admin ALL; fornecedor ALL via entrega própria |
| `pedidos` | `pedidos_admin_all`, `pedidos_cliente_select`, `pedidos_cliente_insert` | Admin ALL; cliente SELECT próprio + INSERT em rascunho/recebido |
| `lotes` | `lotes_admin` | Admin ALL |
| `pedido_parciais` | `pedido_parciais_admin_all`, `pedido_parciais_cliente_select` | Admin ALL; cliente SELECT se visível e dono |
| `pedido_cliente_eventos` | `pedido_cliente_eventos_admin_all`, `pedido_cliente_eventos_cliente_select` | Admin ALL; cliente SELECT se visível e dono |
| `op_eventos` | `op_eventos_admin`, `op_eventos_fornecedor_read` | Admin ALL; fornecedor SELECT se vinculado via `op_fornecedores` (db/21) |

### 1.7. Lacunas confirmadas

| Lacuna | Severidade | Detalhe |
|---|---|---|
| `lotes.pedido_id` nunca populado | **Alta** | FK existe, coluna existe, mas código JS nunca preenche. |
| `op_itens.pedido_item_id` não existe | **Média** | Sem vínculo fino entre item comercial e item produtivo. |
| `gerar_op_latex` não herda `pedido_id` no lote da OP filha | **Baixa** | O lote da OP de látex é o mesmo da OP de tecelagem (mesmo `lote_id`). Se `lotes.pedido_id` estiver populado, resolve-se automaticamente. |
| `documentos_operacionais` não existe | **Média** | Tabela a ser criada na Fase G. |
| `entrega_itens` não referencia pedido | **Baixa** | A rastreabilidade hoje é: `entrega_itens → entrega → (op_id) → ops → lote → pedido`. Bastante indireta, mas funcional. |
| Sem constraint de saldo entre etapas | **Alta** (futura) | Fase J. |

---

## 2. Vínculo Pedido → OP

### 2.1. Cadeia de rastreabilidade atual

```
pedidos.id
  └── lotes.pedido_id          (FK existe, NÃO populado)
        └── lotes.id
              └── ops.lote_id   (FK existe, populado por persistirOP)
                    └── ops.id
                          └── entrega_itens.op_id
                                └── entrega_itens.op_item_id → op_itens.id
```

### 2.2. Onde lotes.pedido_id deve ser populado

| Momento | Ação necessária |
|---|---|
| **Criação de OP a partir do Pedido** (futuro) | Ao criar lote (ou vincular existente), preencher `lotes.pedido_id`. |
| **Criação de OP avulsa** (atual) | `lotes.pedido_id` permanece NULL — comportamento correto para OPs sem pedido. |
| **`gerar_op_latex`** | OP filha compartilha o mesmo `lote_id` da OP mãe. Se o lote já tiver `pedido_id`, a rastreabilidade se propaga automaticamente. |
| **Edição de lote existente** | Se o lote for vinculado a um pedido posteriormente, atualizar `lotes.pedido_id`. |

### 2.3. Contrato proposto para Fase C

1. **`lotes.pedido_id` como vínculo de agrupamento Pedido → Lote → OP.**
   - Na criação de OP vinculada a pedido, preencher `lotes.pedido_id`.
   - Na tela de Pedido Admin (Fase D), listar OPs via: `ops.lote_id → lotes.pedido_id = pedido.id`.
   - OP avulsa (sem pedido) continua com `lotes.pedido_id = NULL`.
2. **Não criar `ops.pedido_id`.** O vínculo via lote é suficiente e evita FK redundante.
3. **Não criar `pedidos.op_id`.** Pedido pode ter zero, uma ou várias OPs. Vínculo N:1 no sentido errado.

### 2.4. Contrato proposto para `op_itens.pedido_item_id` (Fase C)

**Recomendação: criar a coluna.**

Justificativa:
- `entrega_itens.op_item_id` → `op_itens.id` existe, mas `op_itens` não sabe de qual `pedido_item` veio.
- `pedido_parcial_itens.pedido_item_id` → `pedido_itens.id` existe (camada comercial).
- Sem `op_itens.pedido_item_id`, não é possível responder: "este item da OP corresponde a qual item do pedido?"
- A coluna permite conciliar: "o pedido pedia 500m do modelo X; a OP produziu 480m; foram entregues 450m".

**Especificação:**

```sql
ALTER TABLE public.op_itens
  ADD COLUMN IF NOT EXISTS pedido_item_id UUID
    REFERENCES public.pedido_itens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.op_itens.pedido_item_id IS
  'Item do pedido comercial que originou este item da OP. NULL se OP avulsa.';

CREATE INDEX IF NOT EXISTS op_itens_pedido_item_idx
  ON public.op_itens(pedido_item_id);
```

- **NULLABLE:** OPs avulsas não têm pedido_item.
- **ON DELETE SET NULL:** Apagar pedido_item não cascateia OP item.
- **Sem UNIQUE:** Um pedido_item pode gerar múltiplos op_itens (ex.: refação, complemento).
- **População:** Na Fase C, ao criar OP vinculada a pedido, mapear `pedido_item → op_item` e preencher.

---

## 3. Vínculo OP de etapa → OP filha

### 3.1. Estado atual

O encadeamento de OPs hoje funciona exclusivamente para o par **Tecelagem → Látex**:

1. Entrega de tecelagem (`entregas.etapa = 'cima'`) é registrada com `destino_fornecedor_id`.
2. `salvarEntregaCima` chama `gerar_op_latex(entrega_id)` via RPC.
3. `gerar_op_latex` (db/09):
   - Encontra a OP de tecelagem via `entrega_itens.op_id`.
   - Copia `lote_id` da OP de tecelagem para a nova OP de látex.
   - Cria `op_itens` para a OP de látex agrupando por `modelo_id`, somando metros entregues sem defeito.
   - Popula `origem_op_id` e `origem_entrega_id` na OP de látex.
   - Cria `op_fornecedores` com o fornecedor de látex.

### 3.2. Lacuna no `gerar_op_latex`

A função NÃO popula `lotes.pedido_id`. No entanto, como a OP filha herda o mesmo `lote_id` da OP mãe, se o lote já tiver `pedido_id`, a rastreabilidade Pedido → OP filha funciona automaticamente.

**Ação na Fase C:** Garantir que `lotes.pedido_id` seja populado na criação da OP de tecelagem quando vinculada a pedido. Nenhuma alteração necessária em `gerar_op_latex`.

### 3.3. Limitação: somente Tecelagem → Látex

O encadeamento atual cobre apenas 1 transição (tecelagem → látex). Não há suporte nativo para:
- Insumos → Tecelagem (fios não geram OP filha)
- Acabamento → Expedição
- Expedição → Entrega

**Futuro (pós Fase C):** Se o negócio exigir mais etapas encadeadas com OPs dedicadas, o padrão `origem_op_id`/`origem_entrega_id` pode ser estendido. Para o MVP, tecelagem → látex é suficiente.

---

## 4. Documentos operacionais

### 4.1. Desenho da tabela futura (Fase G)

```sql
CREATE TABLE IF NOT EXISTS public.documentos_operacionais (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id         UUID          REFERENCES public.pedidos(id) ON DELETE SET NULL,
  op_id             BIGINT        REFERENCES public.ops(id) ON DELETE SET NULL,
  op_item_id        BIGINT        REFERENCES public.op_itens(id) ON DELETE SET NULL,
  entrega_id        BIGINT        REFERENCES public.entregas(id) ON DELETE SET NULL,
  entrega_item_id   BIGINT        REFERENCES public.entrega_itens(id) ON DELETE SET NULL,
  tipo_documento    TEXT          NOT NULL,
  etapa_origem      TEXT,
  etapa_destino     TEXT,
  fornecedor_id     BIGINT        REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  cliente_id        BIGINT        REFERENCES public.clientes(id) ON DELETE SET NULL,
  data_documento    DATE,
  numero_documento  TEXT,
  chave_nfe         TEXT,
  provider          TEXT,
  external_file_id  TEXT,
  external_url      TEXT,
  external_path     TEXT,
  nome_arquivo      TEXT,
  mime_type         TEXT,
  tamanho_bytes     BIGINT,
  content_hash      TEXT,
  status            TEXT          NOT NULL DEFAULT 'pendente',
  obrigatorio       BOOLEAN       NOT NULL DEFAULT FALSE,
  bloqueante        BOOLEAN       NOT NULL DEFAULT FALSE,
  criado_por        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  metadata          JSONB         NOT NULL DEFAULT '{}'::jsonb
);
```

### 4.2. Tipos de documento (`tipo_documento`)

| Tipo | Descrição |
|---|---|
| `pedido_compra` | Pedido de compra emitido ao fornecedor |
| `nf_entrada` | Nota fiscal de entrada (insumos) |
| `nf_remessa` | Nota fiscal de remessa para terceirizada |
| `nf_retorno` | Nota fiscal de retorno de terceirizada |
| `nf_saida` | Nota fiscal de saída (expedição) |
| `romaneio` | Romaneio de carga/entrega |
| `cte` | Conhecimento de transporte eletrônico |
| `contrato` | Contrato comercial |
| `ordem_servico` | Ordem de serviço |
| `outro` | Outro documento |

### 4.3. Status do documento

| Status | Descrição |
|---|---|
| `pendente` | Documento esperado, ainda não anexado |
| `anexado` | Arquivo carregado, metadados completos |
| `dispensado` | Documento não será necessário (admin dispensou) |
| `erro` | Falha no upload/processamento |

### 4.4. Regras de negócio

1. **Pendência documental começa NÃO bloqueante.** `obrigatorio` e `bloqueante` são flags que podem ser ativadas por regra de negócio futura.
2. **Arquivo pesado fica fora do banco.** `provider` + `external_file_id`/`external_url` apontam para Drive/OneDrive. Banco guarda apenas metadados.
3. **Pedido é índice central.** A tela de Pedido Admin consolida documentos de todos os níveis (pedido, OP, entrega).
4. **Vínculo preferencial:** Documentos operacionais (NF, romaneio) devem ser vinculados ao nível mais granular possível (entrega > OP > pedido). Documentos comerciais podem ser vinculados diretamente ao pedido.
5. **Vínculo múltiplo permitido.** Um mesmo `pedido_id` pode aparecer em vários registros (múltiplos documentos).
6. **Provider:** `google_drive` ou `onedrive`. Campo `provider` identifica qual; `external_file_id` é o ID no provider; `external_url` é o link público (se aplicável); `external_path` é o caminho lógico.

### 4.5. RLS proposto (Fase G)

- Admin: ALL (`documentos_operacionais_admin_all`).
- Fornecedor: SELECT nos documentos vinculados a entregas/OPs onde é fornecedor.
- Cliente: SELECT nos documentos vinculados a pedidos próprios, apenas se `status = 'anexado'` e o admin marcou como visível (campo futuramente em `documentos_operacionais.visivel_cliente`).
- Sem acesso anon.

---

## 5. Movimento produtivo — decisão sobre fonte canônica

### 5.1. Opções

| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| **A)** Reforçar `entregas` / `entrega_itens` | Usar as tabelas existentes como fonte canônica de toda movimentação. | Nenhuma migração; schema já aplicado; fornecedores já escrevem aqui; RLS já cobre. | `entrega_itens` foi desenhada para entregas de terceirizadas (cima/látex). Entradas de insumo e saídas de expedição não se encaixam naturalmente. |
| **B)** Nova tabela `op_movimentos_etapa` | Tabela genérica para qualquer movimentação de etapa. | Modelo limpo; suporta todas as etapas futuras (insumos, tecelagem, acabamento, expedição, entrega). | Nova migration; duplicação inicial de conceito com `entregas`; migração de dados se `entregas` for substituída. |
| **C)** Transição híbrida | Manter `entregas`/`entrega_itens` para cima/látex (já funcionam); criar `op_movimentos_etapa` para novas etapas; unificar em fase posterior. | Sem disrupção; evolutivo. | Duas tabelas com semântica similar; complexidade de consulta (UNION ou view); inconsistência de API. |

### 5.2. Recomendação

**Opção A (reforçar `entregas`/`entrega_itens`) para o MVP.**

Justificativa:
- O schema já está aplicado em staging.
- Fornecedores já usam `entregas`/`entrega_itens` para tecelagem e látex.
- `entrega_itens` já tem `op_id`, `op_item_id`, `modelo_id`, `metros_entregues`, `defeito`, `observacao` — estrutura rica o suficiente.
- Para novas etapas (expedição, entrega ao cliente), um novo valor em `entregas.etapa` (expandindo o CHECK constraint) ou um `tipo_movimento` adicional pode bastar.
- Se no futuro a tabela ficar sobrecarregada, migrar para opção B com a experiência adquirida.

**Ação imediata:** Nenhuma. Na Fase F (operação canônica), reavaliar. A função/módulo de movimentação deve ser desenhada para encapsular a escolha, permitindo trocar a implementação depois sem quebrar consumers.

---

## 6. Stepper do Pedido — contrato UI/dados

### 6.1. Etapas do stepper

```
INSUMOS → TECELAGEM → ACABAMENTO → EXPEDIÇÃO → ENTREGA
```

### 6.2. Fonte de dados por etapa

| Etapa | Fonte de verdade | Como derivar progresso |
|---|---|---|
| **INSUMOS** | `ordens_compra_fio` (fios) | `SUM(kg_recebido) / SUM(kg_pedido)` por OP vinculada ao pedido |
| **TECELAGEM** | `entrega_itens` (etapa cima) | `SUM(metros_entregues sem defeito) / SUM(op_itens.metros_pedidos)` por OP vinculada |
| **ACABAMENTO** | `entrega_itens` (etapa latex) | Idem, para entregas de látex |
| **EXPEDIÇÃO** | A definir (futuro) | Movimentação de saída (nova etapa ou entrega com etapa=expedicao) |
| **ENTREGA** | A definir (futuro) | Confirmação de recebimento pelo cliente ou transportadora |

### 6.3. Regras de UI

1. **Pedido exibe preview consolidado** — cada etapa mostra % concluído calculado a partir das OPs vinculadas.
2. **Botões do Pedido são atalhos** — "Lançar produção" no Pedido abre a tela de OP ou chama a operação canônica.
3. **Atalhos chamam a mesma operação canônica da OP** — implementado na Fase F.
4. **Pedido NÃO vira fonte paralela de movimentação** — todo write de produção passa pela OP.

### 6.4. Rastreabilidade pedido → progresso (query conceitual)

```sql
-- Progresso de tecelagem para um pedido
SELECT
  SUM(ei.metros_entregues) FILTER (WHERE ei.defeito = FALSE) AS entregue,
  SUM(oi.metros_pedidos) AS pedido
FROM entrega_itens ei
JOIN entregas e ON e.id = ei.entrega_id AND e.etapa = 'cima'
JOIN ops o ON o.id = ei.op_id
JOIN lotes l ON l.id = o.lote_id
WHERE l.pedido_id = :pedido_id;
```

---

## 7. Saldo por etapa — regra futura (Fase J)

### 7.1. Conceito

- **Primeira etapa** (insumos/tecelagem): limitada por capacidade, metros planejados ou disponibilidade de fio.
- **Etapas seguintes**: limitadas pelo saldo recebido da etapa anterior.
  - Ex.: só pode enviar para acabamento o que foi efetivamente entregue pela tecelagem (sem defeito).
  - Ex.: só pode expedir o que foi recebido do acabamento.

### 7.2. Implementação futura

- **Bloqueio real deve ser no backend** (RPC ou trigger).
- **Frontend apenas melhora UX** (mostra saldo disponível, desabilita input se exceder).
- Não implementar bloqueio só no frontend — risco alto de bypass.

### 7.3. Pré-requisitos

- `lotes.pedido_id` populado (Fase C).
- Operação canônica de movimentação (Fase F).
- Rastreabilidade de itens (`op_itens.pedido_item_id` ou equivalente).

---

## 8. RLS / RPC / Segurança

### 8.1. Riscos mapeados

| Risco | Mitigação |
|---|---|
| Cliente vê dados de OP/lote/fornecedor | As políticas atuais já isolam: cliente só tem SELECT em `pedidos`/`pedido_itens`/`pedido_parciais`/`pedido_cliente_eventos` próprios. Sem acesso a `ops`, `lotes`, `entregas`, `entrega_itens`. |
| Fornecedor vê pedidos de outros clientes | Fornecedor não tem policy em `pedidos`. Só acessa `ops`/`entregas` onde está vinculado via `op_fornecedores` ou `fornecedor_id`. |
| Documento exposto a não autorizado | Quando `documentos_operacionais` for criada (Fase G), RLS deve seguir o mesmo padrão: admin ALL, fornecedor vê docs das suas entregas/OPs, cliente vê docs publicados dos seus pedidos. |
| Automação Gmail/Drive/OneDrive com privilégio excessivo | Edge Functions futuras devem usar `service_role` apenas para operações necessárias e validar permissão do chamador. |

### 8.2. Novas policies necessárias (fases futuras)

| Fase | Policy |
|---|---|
| G | `documentos_operacionais_admin_all`, `documentos_operacionais_fornecedor_select`, `documentos_operacionais_cliente_select` |
| F | Se a operação canônica for uma RPC, garantir `SECURITY DEFINER` com validação de permissão do chamador. |

---

## 9. Fases futuras — sequência atualizada

> Baseado na Fase A §5, confirmado e detalhado por este contrato.

| Fase | Descrição | Status |
|---|---|---|
| **A** | Plano persistente Pedido ↔ OP ↔ Movimentação ↔ Documentos | **[x] Concluída** (`04613ee`) |
| **B** | Contrato arquitetura/schema detalhado (este documento) | **[x] Concluída** (esta fase) |
| **C** | Vínculo Pedido → OP: popular `lotes.pedido_id`; criar `op_itens.pedido_item_id` | **[x] Concluída** (Fase C: migration `db/20_*` + `op-persistir.js` + `op-nova.js` + `boot.js`) |
| **D** | OPs vinculadas no detalhe do Pedido Admin | **Entregue** através do trabalho de fluxo produtivo aceito. O Pedido Detail Admin lista as OPs vinculadas com status, progresso e link para a OP. Ver `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.2/§9.4 (§2 item H resolvido). |
| **E** | Stepper/preview produtivo no Pedido Admin | **Entregue** através do trabalho de fluxo produtivo aceito. Stepper/preview com progresso real derivado das OPs via `derivePedidoChainState`. Ver `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.4 (§2 item F) e §9.7 (hub R2). |
| **F** | Operação canônica de movimentação | **Entregue** através do trabalho de fluxo produtivo aceito. O Pedido reutiliza as operações canônicas da OP (`salvarEntregaCima`, `liberar_expedicao_latex_parcial`, `registrar_entrega_expedicao`, `registrarRecebimentoOrdemFio`), sem write paralelo. Ver `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.1 e §9.5. |
| **G** | Pendência documental (`documentos_operacionais`) | **Superada** pela pipeline documental canônica G28. `documentos_operacionais` não foi criada; o vínculo documental usa `document_link_revisions`/`document_link_revision_ops` (db/51/52). Ver `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **H** | Integração Drive/OneDrive | **Superada** pela pipeline documental canônica G28. Referências de arquivo externo passam pelo modelo de documentos G28 (Documents Ingestor + candidato/evidência); a camada de anexo Drive na UI permanece visual-only. Ver `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **I** | Automação por e-mail/PDF/XML | **Superada** pela pipeline documental canônica G28: ingestão Gmail + detecção/classificação técnica + fila de validação humana (Documents Ingestor / G28-B1…C aceitos). Ver `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **J** | Saldo inteligente por etapa e bloqueio transacional | **Futura / não sequenciada / não iniciada / não autorizada.** Bloqueio transacional de saldo por etapa (backend RPC/trigger; ver §7). Nenhuma implementação autorizada; `NEXT_AUTHORIZABLE_ACTION: NONE` até seleção explícita de arquiteto. |
| **L** | Lifecycle de OP backend (status expandido, `op_eventos`, trigger, RPC `alterar_status_op` admin-only) | **[x] Concluída** (db/21, backend-only; R1 hardening) |

> **Reconciliação `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1` (docs-only):** os status correntes das Fases D–J acima foram reconciliados com as autoridades correntes — D/E/F **entregues** via fluxo produtivo aceito; G/H/I **superadas** pela pipeline documental canônica G28 (`document_link_revisions`/`document_link_revision_ops`; `documentos_operacionais` nunca criada); J **futura/não sequenciada/não iniciada/não autorizada**. Nenhum código, runtime ou comportamento mudou. O desenho arquitetural original (§4 `documentos_operacionais`, §7 saldo por etapa) e as seções datadas históricas permanecem preservados como intenção/registro. `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pendente de seleção explícita de arquiteto.

---

## 10. Decisões registradas nesta frente

### Fase B

| # | Decisão | Fundamentação |
|---|---|---|
| D-B01 | `lotes.pedido_id` é o vínculo de agrupamento Pedido → OP. Não criar `ops.pedido_id` nem `pedidos.op_id`. | Já existe; evita FK redundante; respeita cardinalidade N:1. |
| D-B02 | Criar `op_itens.pedido_item_id` (NULLABLE, ON DELETE SET NULL, sem UNIQUE). | Permite rastreabilidade fina entre item comercial e produtivo, necessária para conciliação e saldo. |
| D-B03 | `gerar_op_latex` não precisa de alteração para esta frente. | OP filha herda `lote_id` da mãe; se lote tiver `pedido_id`, resolve-se automaticamente. |
| D-B04 | Reforçar `entregas`/`entrega_itens` como fonte canônica de movimentação para o MVP (Opção A). | Schema já aplicado; fornecedores já usam; evita nova migration agora. Reavaliar na Fase F. |
| D-B05 | Tabela `documentos_operacionais` desenhada (§4). Implementação na Fase G. | Contrato pronto; sem migration agora. |
| D-B06 | Stepper com 5 etapas: INSUMOS → TECELAGEM → ACABAMENTO → EXPEDIÇÃO → ENTREGA. | Alinhado ao plano Fase A. |
| D-B07 | Saldo por etapa exige RPC/trigger no backend. Nunca só frontend. | Regra de segurança. Fase J. |
| D-B08 | `pedido_parciais` permanece camada comercial. Não usar como fonte de movimentação produtiva. | Já decidido na Fase A; reforçado aqui. |

### Fase L

| # | Decisão | Fundamentação |
|---|---|---|
| D-L01 | `ops.status` CHECK expandido: `simulada\|aberta\|em_producao\|pausada\|concluida\|cancelada\|finalizada`. `concluida` = canônico, `finalizada` = legado. | Preserva OP de látex existente sem quebrar `op-latex-admin.js`. |
| D-L02 | Tabela `op_eventos` criada para histórico de eventos da OP. Trigger `trg_op_evento` registra automaticamente toda mudança de `ops.status`. | Auditoria da OP. Fonte única de verdade. |
| D-L03 | RPC `alterar_status_op` valida transições de status no backend. Estados finais (`concluida`, `cancelada`, `finalizada`) são terminais. | Bloqueio real no backend, não só no frontend. |
| D-L03-R1 | `alterar_status_op` é **admin-only** nesta fase (`is_admin()`); fornecedor não tem WRITE em `ops` e não pode transitar status. | Hardening R1: alinhar ao padrão `gerar_op_latex` (db/08/09) e corrigir a imprecisão de D-L03, que não declarava o guard de caller. |
| D-L03-R1b | `p_observacao` é vinculada ao evento `status_alterado` correspondente a `status_novo` (filtro por `status_novo = p_novo_status`, ordenação `criado_em DESC, id DESC`). | Hardening R1: reduzir risco de observação cair em evento errado sob concorrência. Não cria segundo evento; não implementa `SET LOCAL` nesta fase. |
| D-L04 | `concluida` preenche `finalizada_em` se null. `cancelada` não preenche. | Semântica correta de conclusão vs cancelamento. |
| D-L05 | `gerar_op_latex()` não foi alterado. OP de látex continua nascendo `em_producao`. | Compatibilidade; transição para `concluida` via RPC no frontend futuro. |
| D-L06 | RLS de `op_eventos` segue padrão `ops`: admin ALL, fornecedor SELECT se vinculado via `op_fornecedores`. | Consistência com políticas existentes. |
| D-L07 | Nenhum arquivo JS alterado nesta fase. UI virá em fase posterior. | Separação backend/UI. |

### Fase OP-OPERATIONAL-CODE-HELPER-B (display operacional, sem schema)

> Fase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`. **Não altera schema, RPC,
> `op_numeros`, `ops.id/numero/ano` nem dados.** Apenas display calculado.

| # | Decisão | Fundamentação |
|---|---|---|
| D-OC01 | Código operacional de OP é **display calculado**, não coluna. Formato `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}`. Helper central `js/op-display.js` (`window.RAVATEX_OP_DISPLAY`). | Evita migration/backfill/trigger; `numero/ano` é display-only (navegação usa `ops.id`). |
| D-OC02 | `pedido_ano = year(pedido.criado_em)`. `pedidos` não tem coluna `ano` (`numero` é IDENTITY global). | Contrato aprovado; deriva do único campo temporal do Pedido. |
| D-OC03 | Letras `T=tecelagem`, `A=latex/acabamento`. O prefixo desambigua a colisão `numero/ano` entre tipos (UNIQUE é `(numero, ano, tipo)`; `op_numeros` conta por `(tipo, ano)`). | Fluxo do usuário chama a etapa de Acabamento; `A` aprovado. |
| D-OC04 | `seq` = sequencial de 2 dígitos por **Pedido + Tipo**, ordenado por `ops.criado_em` asc, desempate `ops.id` asc. Independente do `numero` legado. | Ambos campos existem e são monotônicos por criação. |
| D-OC05 | Fallback obrigatório ao legado `OP {numero}/{ano}` sem `pedido.numero`/`pedido.criado_em`/irmãs/tipo conhecido, e onde não há contexto de Pedido (PDF, fornecedor/RLS, toasts, `ops-list`, telas de OP standalone). | Não inventar código incompleto; respeitar RLS do fornecedor. |
| D-OC06 | `pedido-detail-data.js` seleciona `ops.criado_em` (SELECT aditivo, sem write) para o sequencial. | Base de OPs já carregava por `lote_id`; só faltava o campo de ordenação. |
| D-OC07 | Aplicado nesta fase apenas em telas com contexto de Pedido (Pedido Detail Admin). `painel.js`/`expedicao-admin.js` ficam para o próximo incremento (têm contexto, exigem resolver OP→Pedido sem query nova). | Escopo inicial obrigatório + gestão de risco. |
| D-OC08 | **Aceite visual do usuário registrado (fase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`):** OK no escopo com contexto de Pedido. A aparição "em poucos lugares" é esperada — o código operacional é intencionalmente **não-global**. | O código só aparece onde há contexto confiável de Pedido; fora disso, legado. |
| D-OC09 | **Pendência controlada** — expandir a outras telas só quando: (1) houver contexto confiável de Pedido; (2) houver necessidade visual clara; (3) não exigir migration; (4) não criar query pesada; (5) não duplicar formatação fora de `js/op-display.js`. | Evita expansão global sem necessidade validada; formatação permanece central. |

### Fase Controlled Delete — Expedição Cascade (db/37)

> Backfill documental (`DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`, docs-only):
> fecha a lacuna registrada em
> `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (fase
> `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B`, nota junto às
> decisões `D-DEL10`–`D-DEL13`), que identificou `db/37_controlled_delete_
> expedicao_cascade.sql` sem entrada `D-DEL` própria. Numeração continua a
> partir de `D-DEL13` (última existente) para não colidir com as decisões
> já registradas naquele plano.

| # | Decisão | Fundamentação |
|---|---|---|
| D-DEL14 | Em staging/teste, expedição deixa de ser bloqueador incondicional da exclusão física de Pedido/OP e passa a integrar a cascata `EXCLUIR TUDO`: `expedicao_movimento_itens` → `expedicao_movimentos` → `expedicao_itens` → `expedicoes` são removidos antes de OPs/entregas/lotes/pedido, sem alterar `op_numeros`. | `db/37_controlled_delete_expedicao_cascade.sql` (fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2`) substitui o bloqueio incondicional de expedição herdado de `db/34`–`db/36` (onde expedição sempre classificava `blocked`) por alvos FK explícitos (`expedicao_ids`, `expedicao_item_ids`, `expedicao_movimento_ids`), preservando a confirmação textual `EXCLUIR TUDO` e a ordem transacional corrigida pela `db/36`. Aplicada e validada somente em staging `ucrjtfswnfdlxwtmxnoo`; produção `bhgifjrfagkzubpyqpew` intocada. Desde `db/53`, as quatro funções desta migration foram renomeadas para `diagnosticar_impacto_pedido_pre53`/`diagnosticar_impacto_op_pre53`/`remover_pedido_pre53`/`remover_op_pre53` (sem `EXECUTE` público) e passaram a ser chamadas pelos wrappers públicos do guard documental (ver "Atualização 2026-07-15 — Controlled Delete Document Link Guard" abaixo) somente quando o diagnóstico documental classifica o alvo como elegível. |

###

---

## 11. Lacunas que ainda exigem decisão do dono do projeto

| Lacuna | Contexto |
|---|---|
| Etapas "EXPEDIÇÃO" e "ENTREGA" não têm representação no schema atual | `entregas.etapa` aceita `cima`/`latex`. Para expedição/entrega, será necessário expandir o CHECK ou criar nova estrutura. |
| Envio de fios para tecelagem não gera movimentação rastreável | Hoje `ordens_compra_fio` controla pedido/recebimento de fio, mas o envio físico para a tecelagem não é registrado como movimento. |
| Documentos visíveis ao cliente | Definir quais tipos de documento o cliente pode ver (ex.: romaneio de entrega sim; NF de compra de fio não). Campo `visivel_cliente` precisa ser adicionado em `documentos_operacionais`. |
| Múltiplos pedidos no mesmo lote | Hoje `lotes.pedido_id` é 1:1. Se um lote puder atender múltiplos pedidos, o modelo precisará de revisão (tabela `lote_pedidos` N:N). |

---

> **Este contrato é fonte canônica para implementação das Fases C a J.**
> Deve ser consultado antes de qualquer migration, RPC ou alteração de schema nesta frente.
> Indexado em `docs/DOCUMENTATION_INDEX.md` §1.
## Atualizacao 2026-07-06 - Pedido/OP Controlled Delete B

Fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`: adiciona exclusao
fisica controlada somente para testes/admin, concentrada em RPC transacional e
helper JS unico.

- Novas RPCs versionadas em `db/34_controlled_delete_pedido_op.sql`:
  `diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`,
  `remover_op`.
- Aplicado e validado somente em staging `ucrjtfswnfdlxwtmxnoo`; producao
  `bhgifjrfagkzubpyqpew` permanece intocada.
- Diagnostico classifica `safe`, `requires_confirmation` e `blocked`, sempre
  retornando relatorio de impacto antes da remocao.
- Pedido seguro: sem OP/entrega/expedicao. Pedido com OP sem movimento exige
  `EXCLUIR` e remove tambem lotes/OPs sem movimento vinculados ao Pedido.
- Bloqueadores: entrega vinculada, expedicao vinculada, OP filha nao tratada e
  FKs restritivas conhecidas do fluxo produtivo.
- OP individual: bloqueia com entrega, expedicao ou OP filha; OP sem
  bloqueadores pode ser removida com confirmacao quando ha dependencias
  nao bloqueadoras.
- `op_numeros` nao e alterado, numeros nao sao reciclados e OPs nao sao
  renumeradas.
- A exclusao fisica e temporaria para validacao; producao futura deve usar
  senha/admin forte, soft-delete e auditoria permanente.

### Fix C - politica de OP numerada em staging/teste

Para a fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`, a
porta controlada de teste remove/bypassa o trigger legado
`ops_numeradas_no_delete` da `db/26`. A regra atual do produto em staging e:
OP numerada pode ser removida fisicamente pela RPC controlada quando nao possui
entrega, expedicao ou OP filha e quando o usuario confirma `EXCLUIR` nos casos
de impacto. O numero apagado nao e reciclado porque `op_numeros` continua
high-water e nao e reduzido.

### Cascade Test D - cascata fisica controlada em staging

Na fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`, a
politica de teste passa a permitir remover cadeia produtiva com entrega e OP
filha quando nao houver expedicao. O diagnostico retorna
`requires_cascade_confirmation`, `cascade_required=true`,
`cascade_reason` e `confirmation_required='EXCLUIR TUDO'`.

Expedicao permanece bloqueador nesta fase. Producao futura deve substituir
este modo por senha/admin forte, soft-delete e auditoria permanente. A regra de
numeracao permanece invariavel: `op_numeros` nao muda, OPs nao sao renumeradas
e numeros nao sao reciclados.

### FK Order Fix E - ordem fisica da cascata de teste

Na fase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`, a
cascata controlada deve considerar dois caminhos FK de `entrega_itens` antes de
qualquer `DELETE FROM ops`: `entrega_itens.op_id -> ops.id` e
`entrega_itens.op_item_id -> op_itens.id`. A RPC monta alvos explicitos
(`target_ops`, `target_op_itens`, `target_entregas`,
`target_op_latex_links`, `target_child_ops`, `target_child_op_itens`), remove
`op_latex_entregas`, remove `entrega_itens` por `op_id` ou `op_item_id`,
remove entregas vazias e so entao apaga OPs filhas antes das raizes.

A `db/36_controlled_delete_fk_order_fix.sql` tambem corrige os guards de
entrega para retornar `OLD` em `DELETE` autorizado. Sem isso, um `BEFORE
DELETE` que retorna `NEW` cancela silenciosamente a remocao. Expedicao segue
bloqueador; `op_numeros` segue intocado.

### Atualizacao 2026-07-15 - Controlled Delete Document Link Guard (CLOSED / ACCEPTED)

Fase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` (+ `-GRANTS-54`,
`-POLICY-CAST-55`, `-DIAGNOSTICS-NULL-SAFE-56`). Commit tecnico `707a37bd...`.
Registra o contrato permanente entre a exclusao fisica controlada de teste
(Pedido/OP, `db/34`-`db/37`) e o historico documental canonico G28
(`document_link_revisions` / `document_link_revision_ops`):

- Exclusao fisica de Pedido/OP e bloqueada quando existir historico
  documental canonico vinculado a alguma OP da cadeia alvo (`document_link_
  revision_ops.op_id`) ou, no caso de Pedido, vinculado diretamente ao Pedido
  (`document_link_revisions.pedido_id`).
- `document_link_revisions` e `document_link_revision_ops` nunca sao
  apagados, alterados ou reativados pelo Controlled Delete, em nenhum
  cenario, bloqueado ou nao.
- As RPCs publicas (`diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`,
  `remover_pedido`, `remover_op`) sempre chamam a diagnostica documental
  antes de qualquer delegacao destrutiva; a delegacao so ocorre quando o
  diagnostico classifica como elegivel (`blocked=false`).
- A logica destrutiva legada de `db/34`-`db/37` foi renomeada para
  `diagnosticar_impacto_pedido_pre53`, `diagnosticar_impacto_op_pre53`,
  `remover_pedido_pre53`, `remover_op_pre53`. Essas quatro funcoes nao
  constituem API publica: `EXECUTE` e revogado de `PUBLIC`, `anon` e
  `authenticated` (somente `postgres`/owner).
- As quatro RPCs publicas mantem `EXECUTE` apenas para `authenticated`
  (`PUBLIC` e `anon` sem `EXECUTE`).
- Na ausencia de historico documental, a politica de exclusao fisica
  anterior (`db/34`-`db/37`: bloqueio por entrega/expedicao/OP filha,
  cascata com `EXCLUIR`/`EXCLUIR TUDO`, `op_numeros` intocado) permanece
  vigente e inalterada.
- Historico documental e append-only; este guard nao introduz nenhum
  mecanismo de desvinculo automatico. Correcao de vinculo, quando
  necessaria, ocorre pelo fluxo documental humano (`js/document-link-
  admin-controller.js` / `document-link-admin-modal.js`), nunca pela
  exclusao fisica de teste.

Validado em staging `ucrjtfswnfdlxwtmxnoo` com fixtures sinteticas
(casos elegivel-OP, elegivel-Pedido e bloqueado-por-historico), cleanup
zero e `op_numeros` preservado. Producao nao acessada; sem push. Ver
`docs/ledgers/G28_LEDGER.md` para evidencia completa.

## Atualizacao 2026-07-15 - Docs Canonical Consistency Backfill A (CLOSED / ACCEPTED)

Fase `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. Docs-only; sem codigo, teste,
SQL, migration, staging ou producao alterados.

- Fecha a lacuna documental identificada em
  `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (nota junto
  as decisoes `D-DEL10`-`D-DEL13`, fase Controlled Delete Document Link
  Guard, 2026-07-15): `db/37_controlled_delete_expedicao_cascade.sql` nunca
  havia recebido entrada `D-DEL` propria.
- Adicionada `D-DEL14` (secao "Fase Controlled Delete - Expedicao Cascade
  (db/37)", SS10 acima), derivada do arquivo `db/37` real e da sequencia
  `db/34`-`db/36`: expedicao deixa de bloquear incondicionalmente e passa a
  integrar a cascata `EXCLUIR TUDO` em staging/teste.
- `docs/DOCUMENTATION_INDEX.md` SS4 recebeu as linhas ausentes de `db/34`-
  `db/37` e `db/53`-`db/56`, e o status de `db/30` foi corrigido de "ainda
  nao aplicado" para o estado preciso ja aceito em
  `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` (aplicada e verificada
  em staging, sem drift, nao registrada em
  `supabase_migrations.schema_migrations`, ACL ao vivo mais ampla que o
  contrato canonico, sem exposicao confirmada).
- Nao normaliza nem resolve `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`,
  `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, os debitos de smoke
  autenticado ou `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`,
  que seguem `ARCHITECT DECISION REQUIRED`/abertos.
- Producao (`bhgifjrfagkzubpyqpew`) nao acessada; sem push. Ver
  `docs/ledgers/G28_LEDGER.md` para a entrada append-only desta fase.
