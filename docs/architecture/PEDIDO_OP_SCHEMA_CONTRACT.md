# Technical Contract — Pedido ↔ OP ↔ Movement ↔ Documents Schema

> **Phase:** `RAVATEX-TAPETES-PEDIDO-OP-SCHEMA-CONTRACT-B` (docs-only)
> **Type:** Diagnosis + technical contract, read-only on code/schema.
> **HEAD base:** `04613ee` — `work/app-next`
> **Date:** 2026-07-01
> **Dependency:** `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (Phase A)

---

## Update 2026-07-06 - OP Create Requires Pedido Guard B

Phase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`: creation of OP
via frontend/JS persistence now requires a linked Pedido. This phase does
not change schema, SQL, migrations, RLS, or RPCs.

- `lotes.pedido_id` is no longer optional in the canonical OP-creation path
  via UI: `persistirOP` rejects an empty `pedidoId` before any write.
- `#/ops/nova?pedido_id=<uuid>` remains the allowed path to create an OP.
- `#/ops/nova` without `pedido_id` and the standalone `Nova OP` button no
  longer start an OP without a Pedido.
- The defensive helper returns `step: 'pedido_required'` and does not
  consume `op_numeros`.
- Read-only staging diagnosis confirmed historical data outside the
  contract: 11 OPs whose `lote.pedido_id` is NULL and 9 lots without a
  Pedido linked to OPs.

Decision recorded: as of this phase, standalone OP is no longer a product
path via the Admin UI. The previous contract that allowed standalone OP
must be treated as legacy/historical for already-existing data, not as
acceptable new behavior.

Mandatory backend pending item: create a guard in `gerar_op_latex` and
split/derived functions to reject an origin without Pedido before creating
a child OP. The current mitigation is frontend/JS persistence, and does not
replace a constraint/RPC.

## Update 2026-07-06 - OP Create Requires Pedido RPC Guard C

Phase `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`: backend
guard prepared in versioned migration `db/33_op_latex_requires_pedido_guard.sql`.

- `gerar_op_latex(BIGINT)` and `gerar_op_latex_split(BIGINT, TEXT)` now
  require the origin OP to have `lote_id` and `lotes.pedido_id` to be
  filled in.
- Validation occurs before `proximo_numero_op`, avoiding number consumption
  when the origin is orphaned.
- Controlled error: `Nao e possivel gerar OP de Acabamento/Latex: OP origem nao
  possui Pedido vinculado.`
- Valid flows with Pedido preserve the signature, JSONB return,
  `op_latex_entregas`, `op_fornecedores`, `op_itens`, split events, and
  `motivo_separacao IS NULL` filters.
- There is no global constraint, trigger, `NOT NULL`, backfill, cleanup,
  RLS, or historical data correction in this phase.
- Applied in staging `ucrjtfswnfdlxwtmxnoo` by the user; production untouched. Full validation executed on `2026-07-06` (5 diagnostics OK, local tests green).

The orphan diagnosis was expanded to list the 11 historical OPs without a
Pedido, with deliveries, movement/expedition, possibility of inferring
Pedido, and preliminary A/B/C/D classification. The classification is
informative; it does not authorize automatic correction. Result of this
round in staging: A=6 (`op_id`
1,2,3,4,9,15), B=4 (`op_id` 5,6,7,8), C=0, D=1 (`op_id` 10).

## Update 2026-07-06 - Admin Wide Expand D

Phase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`: frontend-only
expansion of the OP operational display for Admin screens with resolvable
Pedido. The contract remains without new schema:

- primary identification: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`;
- `tipo`: `T` for weaving, `A` for latex/finishing;
- `seq`: by Pedido+Tipo, ordered by `ops.criado_em` and `ops.id`;
- fallback/legacy: `OP {numero}/{ano}` and secondary display `Nº interno {numero}/{ano}`;
- OP->Pedido resolution continues via `ops.lote_id -> lotes.pedido_id -> pedidos.id`;
- siblings are OPs of the lots belonging to the same Pedido, obtained in memory when already loaded
  or via a lightweight read `lotes do pedido -> ops desses lotes`.

There was no change to `ops.numero`, `ops.ano`, `op_numeros`, RPCs, RLS, PDFs,
fornecedor, database, or migrations.

## 1. Current state validated in the schema

### 1.1. Relevant existing tables

| Table | Migration | Status in staging |
|---|---|---|
| `ops` | `db/01_schema.sql` | Applied |
| `op_itens` | `db/01_schema.sql` | Applied |
| `entregas` | `db/01_schema.sql` | Applied |
| `entrega_itens` | `db/01_schema.sql` | Applied |
| `lotes` | `db/09_fase6_cliente_lote.sql` | Applied |
| `clientes` | `db/09_fase6_cliente_lote.sql` | Applied |
| `pedidos` | `db/13_pedidos_schema.sql` | Applied |
| `pedido_itens` | `db/13_pedidos_schema.sql` | Applied |
| `pedido_eventos` | `db/13_pedidos_schema.sql` | Applied |
| `pedido_cliente_eventos` | `db/15_status_cliente_visual.sql` | Applied |
| `pedido_parciais` | `db/17_pedido_parciais_schema.sql` | Applied |
| `pedido_parcial_itens` | `db/17_pedido_parciais_schema.sql` | Applied |
| `op_eventos` | `db/21_op_lifecycle_status_eventos.sql` | **Applied in staging** `ucrjtfswnfdlxwtmxnoo`. Pending in production. |
| `documentos_operacionais` | — | **Does not exist** |

### 1.2. Validated key columns

#### `lotes` (db/09, changed by db/13)

| Column | Type | Nullable | FK | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `numero` | INTEGER UNIQUE | NOT NULL | | Global sequential |
| `cliente_id` | BIGINT | NOT NULL | → `clientes.id` ON DELETE RESTRICT | Cliente that owns the lot |
| `pedido_id` | UUID | **NULLABLE** | → `pedidos.id` ON DELETE SET NULL | Commercial Pedido that originated the lot |
| `criado_em` | TIMESTAMPTZ | NOT NULL | | |

**Diagnosis:** `lotes.pedido_id` exists, is nullable by design, but is **never populated** by any JS code today. `persistirOP` (js/screens/op-persistir.js) creates/updates lots only with `cliente_id`.

#### `ops` (db/01, changed by db/08, db/09)

| Column | Type | Nullable | FK | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `numero` | INTEGER | NOT NULL | | Numbering by (ano, tipo) |
| `ano` | INTEGER | NOT NULL | | |
| `status` | TEXT | NOT NULL | simulada/aberta/em_producao/pausada/concluida/cancelada/finalizada | Expanded in db/21. `finalizada` = legacy latex. `concluida` = canonical. |
| `tipo` | TEXT | NOT NULL | tecelagem/latex | Added in db/08 |
| `lote_id` | BIGINT | NULLABLE | → `lotes.id` ON DELETE SET NULL | Added in db/09 |
| `origem_op_id` | BIGINT | NULLABLE | → `ops.id` ON DELETE SET NULL | Weaving OP that originated this latex OP (db/08) |
| `origem_entrega_id` | BIGINT | NULLABLE | → `entregas.id` ON DELETE SET NULL | Weaving delivery that originated this latex OP (db/08) |
| `observacao` | TEXT | NULLABLE | | Added in db/08 |

**Current UNIQUE:** `(numero, ano, tipo)`.

#### `op_itens` (db/01)

| Column | Type | Nullable | FK | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE CASCADE | |
| `modelo_id` | BIGINT | NOT NULL | → `modelos.id` ON DELETE RESTRICT | |
| `metros_pedidos` | NUMERIC(10,2) | NOT NULL | | |
| `metros_ajustados` | NUMERIC(10,2) | NULLABLE | | Filled in after recalculation |
| `pedido_item_id` | UUID | **NULLABLE** | → `pedido_itens.id` ON DELETE SET NULL | Migration `db/20_op_itens_pedido_item_link.sql` (Phase C). **Applied in staging** `ucrjtfswnfdlxwtmxnoo`. |

#### `entrega_itens` (db/01)

| Column | Type | Nullable | FK | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL PK | | | |
| `entrega_id` | BIGINT | NOT NULL | → `entregas.id` ON DELETE CASCADE | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE RESTRICT | From which OP |
| `op_item_id` | BIGINT | NULLABLE | → `op_itens.id` ON DELETE RESTRICT | Which item of the OP |
| `modelo_id` | BIGINT | NULLABLE | → `modelos.id` ON DELETE RESTRICT | Fallback if no op_item |
| `metros_entregues` | NUMERIC(10,2) | NOT NULL | | |
| `defeito` | BOOLEAN | NOT NULL | | DEFAULT FALSE |
| `observacao` | TEXT | NULLABLE | | |

**CHECK:** `op_item_id IS NOT NULL OR modelo_id IS NOT NULL`.

#### `pedidos` (db/13, changed by db/15, db/17)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID PK | | |
| `cliente_id` | BIGINT | NOT NULL | → `clientes.id` |
| `numero` | BIGINT | GENERATED BY DEFAULT AS IDENTITY | Unique sequential |
| `status` | TEXT | NOT NULL | rascunho/recebido/confirmado/produzindo/entregue/cancelado |
| `status_cliente_visual` | TEXT | NULLABLE | (db/15) |
| `status_cliente_excecao` | TEXT | NULLABLE | (db/15) |
| `status_cliente_mensagem` | TEXT | NULLABLE | (db/15) |
| `referencia_cliente` | TEXT | NULLABLE | (db/15) |
| `prazo_desejado` | DATE | NULLABLE | (db/15) |
| `tipo_recebimento` | TEXT | NULLABLE | (db/15) |
| `parcial_habilitado` | BOOLEAN | NOT NULL DEFAULT FALSE | (db/17) |
| `metros_total` | NUMERIC(12,2) | NULLABLE | (db/17) |
| `token_acesso` | UUID | UNIQUE | Not used in the MVP |

#### `pedido_itens` (db/13)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID PK | | |
| `pedido_id` | UUID | NOT NULL | → `pedidos.id` CASCADE |
| `modelo_id` | BIGINT | NOT NULL | → `modelos.id` RESTRICT |
| `metros` | NUMERIC(10,2) | NOT NULL | |
| `largura` | NUMERIC(3,2) | NULLABLE | Override of the modelo |
| `cor_1_id` | BIGINT | NULLABLE | Override of the modelo |
| `cor_2_id` | BIGINT | NULLABLE | Override of the modelo |
| `observacao` | TEXT | NULLABLE | |
| `ordem` | INTEGER | NOT NULL | DEFAULT 0 |

#### `pedido_parciais` + `pedido_parcial_itens` (db/17)

| Table | Main link |
|---|---|
| `pedido_parciais` | `pedido_id` → `pedidos.id` CASCADE |
| `pedido_parcial_itens` | `parcial_id` → `pedido_parciais.id` CASCADE; `pedido_item_id` → `pedido_itens.id` CASCADE |

**Diagnosis:** `pedido_parcial_itens.pedido_item_id` already references `pedido_itens.id`. But `op_itens` and `pedido_itens` **do not have a direct link between them**.

### 1.3. Existing RPCs

| Function | Description | Relevant to this front |
|---|---|---|
| `gerar_op_latex(BIGINT)` | Creates a latex OP from a weaving delivery. Inherits `lote_id` from the origin OP. | Yes — inherits the lot but does not populate `lotes.pedido_id` |
| `alterar_status_op(BIGINT, TEXT, TEXT)` | Transitions the OP status with validation. **Admin-only** (`is_admin()`). `SECURITY DEFINER`. `p_observacao` is linked to the `status_alterado` event corresponding to the new status. Returns JSON. | Yes — db/21 (R1: admin guard + deterministic linkage of the observation) |
| `sincronizar_pedido_parciais_resumo(UUID, BOOLEAN)` | Updates parciais summary fields in `pedidos`. | Yes — commercial layer |
| `is_admin()` | Checks whether the user is admin. | Yes — RLS |
| `meu_fornecedor_id()` | Returns fornecedor_id of the logged-in user. | Yes — RLS |
| `meu_cliente_id()` | Returns cliente_id of the logged-in user. | Yes — RLS |

### 1.4. Existing triggers

| Trigger | Table | Event | Description |
|---|---|---|---|
| `pedidos_cliente_visual_insert_guard` | `pedidos` | BEFORE INSERT | Zeroes visual fields for non-admin (db/15) |
| `pedidos_cliente_visual_touch` | `pedidos` | BEFORE UPDATE | Updates visual timestamp (db/15) |
| `pedido_parciais_touch_updated_at` | `pedido_parciais` | BEFORE UPDATE | Updates `atualizado_em` (db/17) |
| `pedido_parciais_after_change_trigger` | `pedido_parciais` | AFTER INSERT/UPDATE/DELETE | Synchronizes summary (db/17) |
| `trg_op_evento` | `ops` | AFTER UPDATE OF status | Records `status_alterado` event in `op_eventos` (db/21). The `p_observacao` of the `alterar_status_op` RPC is linked to this trigger's event corresponding to `status_novo` (R1) |

### 1.5. Table `op_eventos` (db/21)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | BIGSERIAL PK | | |
| `op_id` | BIGINT | NOT NULL | → `ops.id` ON DELETE CASCADE |
| `tipo_evento` | TEXT | NOT NULL | `status_alterado` or future |
| `status_anterior` | TEXT | NULL | Status before the transition |
| `status_novo` | TEXT | NULL | Status after the transition |
| `observacao` | TEXT | NULL | Optional observation |
| `payload` | JSONB | NOT NULL DEFAULT `{}` | Complementary metadata |
| `criado_por` | UUID | NULL | → `auth.users.id` ON DELETE SET NULL |
| `criado_em` | TIMESTAMPTZ | NOT NULL DEFAULT `now()` | |

Indexes: `op_eventos_op_id_idx (op_id)`, `op_eventos_criado_em_idx (op_id, criado_em DESC)`.

**SQL evidence applied in staging (2026-07-01):**

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

Conclusion: SQL STAGING OK. ops.status constraint updated. op_eventos table created. alterar_status_op RPC created. trg_op_evento trigger created. Production not touched. Repo still not pushed.

### 1.6. Relevant RLS

| Table | Policies | Access |
|---|---|---|
| `ops` | `ops_admin`, `ops_fornecedor_read` | Admin ALL; fornecedor SELECT if linked |
| `op_itens` | `op_itens_admin`, `op_itens_fornecedor_read` | Admin ALL; fornecedor SELECT if linked |
| `entregas` | `entregas_admin`, `entregas_fornecedor_read`, `entregas_fornecedor_insert` | Admin ALL; fornecedor SELECT/INSERT own |
| `entrega_itens` | `entrega_itens_admin`, `entrega_itens_fornecedor` | Admin ALL; fornecedor ALL via own delivery |
| `pedidos` | `pedidos_admin_all`, `pedidos_cliente_select`, `pedidos_cliente_insert` | Admin ALL; cliente SELECT own + INSERT in rascunho/recebido |
| `lotes` | `lotes_admin` | Admin ALL |
| `pedido_parciais` | `pedido_parciais_admin_all`, `pedido_parciais_cliente_select` | Admin ALL; cliente SELECT if visible and owner |
| `pedido_cliente_eventos` | `pedido_cliente_eventos_admin_all`, `pedido_cliente_eventos_cliente_select` | Admin ALL; cliente SELECT if visible and owner |
| `op_eventos` | `op_eventos_admin`, `op_eventos_fornecedor_read` | Admin ALL; fornecedor SELECT if linked via `op_fornecedores` (db/21) |

### 1.7. Confirmed gaps

| Gap | Severity | Detail |
|---|---|---|
| `lotes.pedido_id` never populated | **High** | FK exists, column exists, but JS code never fills it in. |
| `op_itens.pedido_item_id` does not exist | **Medium** | No fine-grained link between commercial item and productive item. |
| `gerar_op_latex` does not inherit `pedido_id` in the child OP's lot | **Low** | The latex OP's lot is the same as the weaving OP's (same `lote_id`). If `lotes.pedido_id` is populated, it resolves automatically. |
| `documentos_operacionais` does not exist | **Medium** | Table to be created in Phase G. |
| `entrega_itens` does not reference pedido | **Low** | Traceability today is: `entrega_itens → entrega → (op_id) → ops → lote → pedido`. Quite indirect, but functional. |
| No balance constraint between stages | **High** (future) | Phase J. |

---

## 2. Pedido → OP Link

### 2.1. Current traceability chain

```
pedidos.id
  └── lotes.pedido_id          (FK existe, NÃO populado)
        └── lotes.id
              └── ops.lote_id   (FK existe, populado por persistirOP)
                    └── ops.id
                          └── entrega_itens.op_id
                                └── entrega_itens.op_item_id → op_itens.id
```

### 2.2. Where lotes.pedido_id must be populated

| Moment | Required action |
|---|---|
| **OP creation from the Pedido** (future) | When creating the lot (or linking an existing one), fill in `lotes.pedido_id`. |
| **Standalone OP creation** (current) | `lotes.pedido_id` remains NULL — correct behavior for OPs without a pedido. |
| **`gerar_op_latex`** | The child OP shares the same `lote_id` as the parent OP. If the lot already has `pedido_id`, traceability propagates automatically. |
| **Editing an existing lot** | If the lot is linked to a pedido later, update `lotes.pedido_id`. |

### 2.3. Proposed contract for Phase C

1. **`lotes.pedido_id` as the grouping link Pedido → Lot → OP.**
   - When creating an OP linked to a pedido, fill in `lotes.pedido_id`.
   - On the Pedido Admin screen (Phase D), list OPs via: `ops.lote_id → lotes.pedido_id = pedido.id`.
   - Standalone OP (without pedido) continues with `lotes.pedido_id = NULL`.
2. **Do not create `ops.pedido_id`.** The link via lot is sufficient and avoids a redundant FK.
3. **Do not create `pedidos.op_id`.** A Pedido can have zero, one, or several OPs. N:1 link in the wrong direction.

### 2.4. Proposed contract for `op_itens.pedido_item_id` (Phase C)

**Recommendation: create the column.**

Justification:
- `entrega_itens.op_item_id` → `op_itens.id` exists, but `op_itens` does not know which `pedido_item` it came from.
- `pedido_parcial_itens.pedido_item_id` → `pedido_itens.id` exists (commercial layer).
- Without `op_itens.pedido_item_id`, it is not possible to answer: "which pedido item does this OP item correspond to?"
- The column allows reconciling: "the pedido requested 500m of modelo X; the OP produced 480m; 450m were delivered".

**Specification:**

```sql
ALTER TABLE public.op_itens
  ADD COLUMN IF NOT EXISTS pedido_item_id UUID
    REFERENCES public.pedido_itens(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.op_itens.pedido_item_id IS
  'Item do pedido comercial que originou este item da OP. NULL se OP avulsa.';

CREATE INDEX IF NOT EXISTS op_itens_pedido_item_idx
  ON public.op_itens(pedido_item_id);
```

- **NULLABLE:** Standalone OPs do not have a pedido_item.
- **ON DELETE SET NULL:** Deleting the pedido_item does not cascade to the OP item.
- **No UNIQUE:** A pedido_item can generate multiple op_itens (e.g., rework, complement).
- **Population:** In Phase C, when creating an OP linked to a pedido, map `pedido_item → op_item` and fill it in.

---

## 3. Stage-OP → Child-OP Link

### 3.1. Current state

Today, OP chaining works exclusively for the **Weaving → Latex** pair:

1. A weaving delivery (`entregas.etapa = 'cima'`) is recorded with `destino_fornecedor_id`.
2. `salvarEntregaCima` calls `gerar_op_latex(entrega_id)` via RPC.
3. `gerar_op_latex` (db/09):
   - Finds the weaving OP via `entrega_itens.op_id`.
   - Copies `lote_id` from the weaving OP to the new latex OP.
   - Creates `op_itens` for the latex OP, grouping by `modelo_id`, summing delivered meters without defect.
   - Populates `origem_op_id` and `origem_entrega_id` in the latex OP.
   - Creates `op_fornecedores` with the latex fornecedor.

### 3.2. Gap in `gerar_op_latex`

The function does NOT populate `lotes.pedido_id`. However, since the child OP inherits the same `lote_id` from the parent OP, if the lot already has `pedido_id`, traceability from Pedido → child OP works automatically.

**Action in Phase C:** Ensure that `lotes.pedido_id` is populated when creating the weaving OP when linked to a pedido. No change necessary in `gerar_op_latex`.

### 3.3. Limitation: Weaving → Latex only

The current chaining covers only 1 transition (weaving → latex). There is no native support for:
- Raw materials → Weaving (yarns do not generate a child OP)
- Finishing → Expedição
- Expedição → Delivery

**Future (post Phase C):** If the business requires more chained stages with dedicated OPs, the `origem_op_id`/`origem_entrega_id` pattern can be extended. For the MVP, weaving → latex is sufficient.

---
## 4. Operational documents

### 4.1. Design of the future table (Phase G)

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

### 4.2. Document types (`tipo_documento`)

| Type | Description |
|---|---|
| `pedido_compra` | Purchase order issued to the supplier |
| `nf_entrada` | Incoming invoice (raw materials) |
| `nf_remessa` | Outbound shipment invoice to subcontractor |
| `nf_retorno` | Return invoice from subcontractor |
| `nf_saida` | Outgoing invoice (Expedição) |
| `romaneio` | Cargo/delivery packing list |
| `cte` | Electronic bill of lading |
| `contrato` | Commercial contract |
| `ordem_servico` | Service order |
| `outro` | Other document |

### 4.3. Document status

| Status | Description |
|---|---|
| `pendente` | Document expected, not yet attached |
| `anexado` | File uploaded, metadata complete |
| `dispensado` | Document will not be needed (admin waived it) |
| `erro` | Upload/processing failure |

### 4.4. Business rules

1. **Document pending status starts as NON-blocking.** `obrigatorio` and `bloqueante` are flags that can be activated by a future business rule.
2. **Heavy files stay outside the database.** `provider` + `external_file_id`/`external_url` point to Drive/OneDrive. The database stores only metadata.
3. **Pedido is the central index.** The Pedido Admin screen consolidates documents from all levels (pedido, OP, entrega).
4. **Preferred linkage:** Operational documents (NF, packing list) should be linked to the most granular level possible (entrega > OP > pedido). Commercial documents may be linked directly to the pedido.
5. **Multiple linkage allowed.** The same `pedido_id` can appear in several records (multiple documents).
6. **Provider:** `google_drive` or `onedrive`. The `provider` field identifies which; `external_file_id` is the ID in the provider; `external_url` is the public link (if applicable); `external_path` is the logical path.

### 4.5. Proposed RLS (Phase G)

- Admin: ALL (`documentos_operacionais_admin_all`).
- Fornecedor: SELECT on documents linked to entregas/OPs where it is the fornecedor.
- Cliente: SELECT on documents linked to its own pedidos, only if `status = 'anexado'` and the admin marked it as visible (field to be added later in `documentos_operacionais.visivel_cliente`).
- No anon access.

---

## 5. Production movement — decision on canonical source

### 5.1. Options

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A)** Reinforce `entregas` / `entrega_itens` | Use the existing tables as the canonical source for all movement. | No migration; schema already applied; fornecedores already write here; RLS already covers it. | `entrega_itens` was designed for subcontractor deliveries (cima/látex). Raw-material inbound and expedição outbound don't naturally fit. |
| **B)** New table `op_movimentos_etapa` | Generic table for any stage movement. | Clean model; supports all future stages (insumos, tecelagem, acabamento, expedição, entrega). | New migration; initial concept duplication with `entregas`; data migration if `entregas` is replaced. |
| **C)** Hybrid transition | Keep `entregas`/`entrega_itens` for cima/látex (already working); create `op_movimentos_etapa` for new stages; unify in a later phase. | No disruption; evolutionary. | Two tables with similar semantics; query complexity (UNION or view); API inconsistency. |

### 5.2. Recommendation

**Option A (reinforce `entregas`/`entrega_itens`) for the MVP.**

Justification:
- The schema is already applied in staging.
- Fornecedores already use `entregas`/`entrega_itens` for tecelagem and látex.
- `entrega_itens` already has `op_id`, `op_item_id`, `modelo_id`, `metros_entregues`, `defeito`, `observacao` — a rich enough structure.
- For new stages (expedição, delivery to the cliente), a new value in `entregas.etapa` (expanding the CHECK constraint) or an additional `tipo_movimento` may suffice.
- If the table becomes overloaded in the future, migrate to option B with the experience gained.

**Immediate action:** None. Reassess in Phase F (canonical operation). The movement function/module should be designed to encapsulate the choice, allowing the implementation to be swapped later without breaking consumers.

---

## 6. Pedido stepper — UI/data contract

### 6.1. Stepper stages

```
INSUMOS → TECELAGEM → ACABAMENTO → EXPEDIÇÃO → ENTREGA
```

### 6.2. Data source per stage

| Stage | Source of truth | How to derive progress |
|---|---|---|
| **INSUMOS** | `ordens_compra_fio` (yarns) | `SUM(kg_recebido) / SUM(kg_pedido)` per OP linked to the pedido |
| **TECELAGEM** | `entrega_itens` (cima stage) | `SUM(metros_entregues without defect) / SUM(op_itens.metros_pedidos)` per linked OP |
| **ACABAMENTO** | `entrega_itens` (latex stage) | Same, for látex deliveries |
| **EXPEDIÇÃO** | To be defined (future) | Outbound movement (new stage or entrega with etapa=expedicao) |
| **ENTREGA** | To be defined (future) | Receipt confirmation by the cliente or carrier |

### 6.3. UI rules

1. **Pedido displays a consolidated preview** — each stage shows % complete calculated from the linked OPs.
2. **Pedido buttons are shortcuts** — "Lançar produção" on the Pedido opens the OP screen or calls the canonical operation.
3. **Shortcuts call the same canonical operation as the OP** — implemented in Phase F.
4. **Pedido does NOT become a parallel movement source** — every production write goes through the OP.

### 6.4. Pedido → progress traceability (conceptual query)

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

## 7. Balance per stage — future rule (Phase J)

### 7.1. Concept

- **First stage** (insumos/tecelagem): limited by capacity, planned meters, or yarn availability.
- **Subsequent stages**: limited by the balance received from the previous stage.
  - E.g.: can only send to acabamento what was actually delivered by tecelagem (without defect).
  - E.g.: can only ship (expedir) what was received from acabamento.

### 7.2. Future implementation

- **Real blocking must be in the backend** (RPC or trigger).
- **Frontend only improves UX** (shows available balance, disables input if exceeded).
- Do not implement blocking only on the frontend — high risk of bypass.

### 7.3. Prerequisites

- `lotes.pedido_id` populated (Phase C).
- Canonical movement operation (Phase F).
- Item traceability (`op_itens.pedido_item_id` or equivalent).

---

## 8. RLS / RPC / Security

### 8.1. Mapped risks

| Risk | Mitigation |
|---|---|
| Cliente sees OP/lote/fornecedor data | Current policies already isolate this: cliente only has SELECT on its own `pedidos`/`pedido_itens`/`pedido_parciais`/`pedido_cliente_eventos`. No access to `ops`, `lotes`, `entregas`, `entrega_itens`. |
| Fornecedor sees pedidos from other clientes | Fornecedor has no policy on `pedidos`. It only accesses `ops`/`entregas` where it is linked via `op_fornecedores` or `fornecedor_id`. |
| Document exposed to unauthorized party | When `documentos_operacionais` is created (Phase G), RLS should follow the same pattern: admin ALL, fornecedor sees docs from its entregas/OPs, cliente sees published docs from its pedidos. |
| Gmail/Drive/OneDrive automation with excessive privilege | Future Edge Functions must use `service_role` only for the necessary operations and validate the caller's permission. |

### 8.2. New policies needed (future phases)

| Phase | Policy |
|---|---|
| G | `documentos_operacionais_admin_all`, `documentos_operacionais_fornecedor_select`, `documentos_operacionais_cliente_select` |
| F | If the canonical operation is an RPC, ensure `SECURITY DEFINER` with caller permission validation. |

---

## 9. Future phases — updated sequence

> Based on Phase A §5, confirmed and detailed by this contract.

| Phase | Description | Status |
|---|---|---|
| **A** | Persistent plan Pedido ↔ OP ↔ Movement ↔ Documents | **[x] Completed** (`04613ee`) |
| **B** | Detailed architecture/schema contract (this document) | **[x] Completed** (this phase) |
| **C** | Pedido → OP link: populate `lotes.pedido_id`; create `op_itens.pedido_item_id` | **[x] Completed** (Phase C: migration `db/20_*` + `op-persistir.js` + `op-nova.js` + `boot.js`) |
| **D** | Linked OPs in the Pedido Admin detail | **Delivered** via the accepted production flow work. Pedido Detail Admin lists the linked OPs with status, progress, and a link to the OP. See `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.2/§9.4 (§2 item H resolved). |
| **E** | Production stepper/preview in the Pedido Admin | **Delivered** via the accepted production flow work. Stepper/preview with real progress derived from the OPs via `derivePedidoChainState`. See `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9.4 (§2 item F) and §9.7 (hub R2). |
| **F** | Canonical movement operation | **Delivered** via the accepted production flow work. Pedido reuses the canonical OP operations (`salvarEntregaCima`, `liberar_expedicao_latex_parcial`, `registrar_entrega_expedicao`, `registrarRecebimentoOrdemFio`), with no parallel write. See `PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §1.1 and §9.5. |
| **G** | Document pending status (`documentos_operacionais`) | **Superseded** by the canonical G28 documentation pipeline. `documentos_operacionais` was never created; the document link uses `document_link_revisions`/`document_link_revision_ops` (db/51/52). See `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **H** | Drive/OneDrive integration | **Superseded** by the canonical G28 documentation pipeline. External file references go through the G28 document model (Documents Ingestor + candidate/evidence); the Drive attachment layer in the UI remains visual-only. See `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **I** | Email/PDF/XML automation | **Superseded** by the canonical G28 documentation pipeline: Gmail ingestion + technical detection/classification + human validation queue (Documents Ingestor / G28-B1…C accepted). See `DOCUMENTOS_VALIDACAO_VINCULOS_E_EVOLUCAO_PLANO.md`. |
| **J** | Smart balance per stage and transactional blocking | **Future / not sequenced / not started / not authorized.** Transactional balance blocking per stage (backend RPC/trigger; see §7). No implementation authorized; `NEXT_AUTHORIZABLE_ACTION: NONE` until explicit architect selection. |
| **L** | Backend OP lifecycle (expanded status, `op_eventos`, trigger, admin-only `alterar_status_op` RPC) | **[x] Completed** (db/21, backend-only; R1 hardening) |

> **Reconciliation `DOCS-PEDIDO-OP-LEGACY-PLAN-STATUS-CONSISTENCY-R1` (docs-only):** the current statuses of Phases D–J above were reconciled with the current authorities — D/E/F **delivered** via the accepted production flow; G/H/I **superseded** by the canonical G28 documentation pipeline (`document_link_revisions`/`document_link_revision_ops`; `documentos_operacionais` never created); J **future/not sequenced/not started/not authorized**. No code, runtime, or behavior changed. The original architectural design (§4 `documentos_operacionais`, §7 balance per stage) and the historical dated sections remain preserved as intent/record. `ACTIVE_PHASE: NONE`; `NEXT_AUTHORIZABLE_ACTION: NONE` pending explicit architect selection.

---

## 10. Decisions recorded in this effort

### Phase B

| # | Decision | Rationale |
|---|---|---|
| D-B01 | `lotes.pedido_id` is the Pedido → OP grouping link. Do not create `ops.pedido_id` or `pedidos.op_id`. | Already exists; avoids a redundant FK; respects N:1 cardinality. |
| D-B02 | Create `op_itens.pedido_item_id` (NULLABLE, ON DELETE SET NULL, no UNIQUE). | Enables fine-grained traceability between the commercial and production item, needed for reconciliation and balance. |
| D-B03 | `gerar_op_latex` does not need changes for this effort. | The child OP inherits `lote_id` from the parent; if the lote has `pedido_id`, it resolves automatically. |
| D-B04 | Reinforce `entregas`/`entrega_itens` as the canonical movement source for the MVP (Option A). | Schema already applied; fornecedores already use it; avoids a new migration now. Reassess in Phase F. |
| D-B05 | Table `documentos_operacionais` designed (§4). Implementation in Phase G. | Contract ready; no migration now. |
| D-B06 | Stepper with 5 stages: INSUMOS → TECELAGEM → ACABAMENTO → EXPEDIÇÃO → ENTREGA. | Aligned with the Phase A plan. |
| D-B07 | Balance per stage requires a backend RPC/trigger. Never frontend-only. | Security rule. Phase J. |
| D-B08 | `pedido_parciais` remains a commercial layer. Do not use it as a production movement source. | Already decided in Phase A; reinforced here. |

### Phase L

| # | Decision | Rationale |
|---|---|---|
| D-L01 | `ops.status` CHECK expanded: `simulada\|aberta\|em_producao\|pausada\|concluida\|cancelada\|finalizada`. `concluida` = canonical, `finalizada` = legacy. | Preserves the existing látex OP without breaking `op-latex-admin.js`. |
| D-L02 | Table `op_eventos` created for OP event history. Trigger `trg_op_evento` automatically records every change to `ops.status`. | OP audit. Single source of truth. |
| D-L03 | RPC `alterar_status_op` validates status transitions in the backend. Final states (`concluida`, `cancelada`, `finalizada`) are terminal. | Real blocking in the backend, not just the frontend. |
| D-L03-R1 | `alterar_status_op` is **admin-only** in this phase (`is_admin()`); fornecedor has no WRITE on `ops` and cannot transition status. | R1 hardening: align with the `gerar_op_latex` pattern (db/08/09) and fix the imprecision in D-L03, which did not declare the caller guard. |
| D-L03-R1b | `p_observacao` is linked to the `status_alterado` event corresponding to `status_novo` (filtered by `status_novo = p_novo_status`, ordered by `criado_em DESC, id DESC`). | R1 hardening: reduce the risk of the observation landing on the wrong event under concurrency. Does not create a second event; does not implement `SET LOCAL` in this phase. |
| D-L04 | `concluida` fills `finalizada_em` if null. `cancelada` does not fill it. | Correct semantics of completion vs. cancellation. |
| D-L05 | `gerar_op_latex()` was not changed. The látex OP still starts as `em_producao`. | Compatibility; transition to `concluida` via RPC in a future frontend. |
| D-L06 | RLS on `op_eventos` follows the `ops` pattern: admin ALL, fornecedor SELECT if linked via `op_fornecedores`. | Consistency with existing policies. |
| D-L07 | No JS file changed in this phase. UI will come in a later phase. | Backend/UI separation. |

### Phase OP-OPERATIONAL-CODE-HELPER-B (operational display, no schema)

> Phase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`. **Does not alter schema, RPC, `op_numeros`, `ops.id/numero/ano`, or data.** Calculated display only.

| # | Decision | Rationale |
|---|---|---|
| D-OC01 | OP operational code is a **calculated display**, not a column. Format `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}`. Central helper `js/op-display.js` (`window.RAVATEX_OP_DISPLAY`). | Avoids migration/backfill/trigger; `numero/ano` is display-only (navigation uses `ops.id`). |
| D-OC02 | `pedido_ano = year(pedido.criado_em)`. `pedidos` has no `ano` column (`numero` is a global IDENTITY). | Contract approved; derives from the Pedido's only temporal field. |
| D-OC03 | Letters `T=tecelagem`, `A=latex/acabamento`. The prefix disambiguates the `numero/ano` collision between types (UNIQUE is `(numero, ano, tipo)`; `op_numeros` counts per `(tipo, ano)`). | The user flow calls the stage "Acabamento"; `A` approved. |
| D-OC04 | `seq` = 2-digit sequence per **Pedido + Tipo**, ordered by `ops.criado_em` asc, tiebreak `ops.id` asc. Independent of the legacy `numero`. | Both fields exist and are monotonic by creation. |
| D-OC05 | Mandatory fallback to the legacy `OP {numero}/{ano}` without a known `pedido.numero`/`pedido.criado_em`/siblings/tipo, and wherever there is no Pedido context (PDF, fornecedor/RLS, toasts, `ops-list`, standalone OP screens). | Do not invent an incomplete code; respect the fornecedor's RLS. |
| D-OC06 | `pedido-detail-data.js` selects `ops.criado_em` (additive SELECT, no write) for the sequence. | The OP base already loaded by `lote_id`; only the ordering field was missing. |
| D-OC07 | Applied in this phase only to screens with Pedido context (Pedido Detail Admin). `painel.js`/`expedicao-admin.js` are left for the next increment (they have context, but require resolving OP→Pedido without a new query). | Mandatory initial scope + risk management. |
| D-OC08 | **User visual acceptance recorded (phase `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`):** OK within the scope with Pedido context. Appearing "in few places" is expected — the operational code is intentionally **not global**. | The code only appears where there is reliable Pedido context; outside that, legacy. |
| D-OC09 | **Controlled pending item** — expand to other screens only when: (1) there is reliable Pedido context; (2) there is a clear visual need; (3) it does not require a migration; (4) it does not create a heavy query; (5) it does not duplicate formatting outside `js/op-display.js`. | Avoids global expansion without a validated need; formatting remains centralized. |

### Phase Controlled Delete — Expedição Cascade (db/37)

> Documentation backfill (`DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`, docs-only): closes the gap recorded in `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (phase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B`, note alongside decisions `D-DEL10`–`D-DEL13`), which identified `db/37_controlled_delete_expedicao_cascade.sql` without its own `D-DEL` entry. Numbering continues from `D-DEL13` (the last existing one) to avoid colliding with the decisions already recorded in that plan.

| # | Decision | Rationale |
|---|---|---|
| D-DEL14 | In staging/test, expedição stops being an unconditional blocker for the physical deletion of Pedido/OP and starts to be part of the `EXCLUIR TUDO` cascade: `expedicao_movimento_itens` → `expedicao_movimentos` → `expedicao_itens` → `expedicoes` are removed before OPs/entregas/lotes/pedido, without altering `op_numeros`. | `db/37_controlled_delete_expedicao_cascade.sql` (phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2`) replaces the unconditional expedição block inherited from `db/34`–`db/36` (where expedição always classified as `blocked`) with explicit FK targets (`expedicao_ids`, `expedicao_item_ids`, `expedicao_movimento_ids`), preserving the `EXCLUIR TUDO` text confirmation and the transactional order fixed by `db/36`. Applied and validated only in staging `ucrjtfswnfdlxwtmxnoo`; production `bhgifjrfagkzubpyqpew` untouched. Since `db/53`, the four functions of this migration were renamed to `diagnosticar_impacto_pedido_pre53`/`diagnosticar_impacto_op_pre53`/`remover_pedido_pre53`/`remover_op_pre53` (no public `EXECUTE`) and are now called by the document guard's public wrappers (see "Update 2026-07-15 — Controlled Delete Document Link Guard" below) only when the document diagnosis classifies the target as eligible. |

###

---

## 11. Gaps that still require a decision from the project owner

| Gap | Context |
|---|---|
| "EXPEDIÇÃO" and "ENTREGA" stages have no representation in the current schema | `entregas.etapa` accepts `cima`/`latex`. For expedição/entrega, it will be necessary to expand the CHECK or create a new structure. |
| Sending yarns to tecelagem does not generate a traceable movement | Today `ordens_compra_fio` controls yarn ordering/receipt, but the physical shipment to tecelagem is not recorded as a movement. |
| Documents visible to the cliente | Define which document types the cliente can see (e.g.: delivery packing list yes; yarn purchase NF no). Field `visivel_cliente` needs to be added to `documentos_operacionais`. |
| Multiple pedidos in the same lote | Today `lotes.pedido_id` is 1:1. If a lote can serve multiple pedidos, the model will need revision (`lote_pedidos` N:N table). |

---

> **This contract is the canonical source for implementing Phases C through J.**
> Must be consulted before any migration, RPC, or schema change in this effort.
> Indexed in `docs/DOCUMENTATION_INDEX.md` §1.
## Update 2026-07-06 - Pedido/OP Controlled Delete B

Phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`: adds physical controlled deletion for tests/admin only, concentrated in a transactional RPC and a single JS helper.

- New versioned RPCs in `db/34_controlled_delete_pedido_op.sql`: `diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`.
- Applied and validated only in staging `ucrjtfswnfdlxwtmxnoo`; production `bhgifjrfagkzubpyqpew` remains untouched.
- The diagnosis classifies as `safe`, `requires_confirmation`, and `blocked`, always returning an impact report before removal.
- Safe Pedido: no OP/entrega/expedicao. Pedido with an OP without movement requires `EXCLUIR` and also removes lotes/OPs without movement linked to the Pedido.
- Blockers: linked entrega, linked expedicao, unhandled child OP, and known restrictive FKs from the production flow.
- Individual OP: blocks with entrega, expedicao, or child OP; an OP with no blockers can be removed with confirmation when there are non-blocking dependencies.
- `op_numeros` is not altered, numbers are not recycled, and OPs are not renumbered.
- The physical deletion is temporary for validation; future production must use a strong password/admin, soft-delete, and permanent audit.

### Fix C - numbered OP policy in staging/test

For phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`, the controlled test gate removes/bypasses the legacy trigger `ops_numeradas_no_delete` from `db/26`. The current product rule in staging is: a numbered OP can be physically removed by the controlled RPC when it has no entrega, expedicao, or child OP, and when the user confirms `EXCLUIR` in impact cases. The deleted number is not recycled because `op_numeros` remains high-water and is not decreased.

### Cascade Test D - controlled physical cascade in staging

In phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`, the test policy starts allowing removal of a production chain with entrega and child OP when there is no expedicao. The diagnosis returns `requires_cascade_confirmation`, `cascade_required=true`, `cascade_reason`, and `confirmation_required='EXCLUIR TUDO'`.

Expedicao remains a blocker in this phase. Future production must replace this mode with a strong password/admin, soft-delete, and permanent audit. The numbering rule remains invariant: `op_numeros` does not change, OPs are not renumbered, and numbers are not recycled.

### FK Order Fix E - physical order of the test cascade

In phase `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`, the controlled cascade must consider two `entrega_itens` FK paths before any `DELETE FROM ops`: `entrega_itens.op_id -> ops.id` and `entrega_itens.op_item_id -> op_itens.id`. The RPC assembles explicit targets (`target_ops`, `target_op_itens`, `target_entregas`, `target_op_latex_links`, `target_child_ops`, `target_child_op_itens`), removes `op_latex_entregas`, removes `entrega_itens` by `op_id` or `op_item_id`, removes empty entregas, and only then deletes child OPs before roots.

`db/36_controlled_delete_fk_order_fix.sql` also fixes the entrega guards to return `OLD` on an authorized `DELETE`. Without this, a `BEFORE DELETE` that returns `NEW` silently cancels the removal. Expedicao remains a blocker; `op_numeros` remains untouched.

### Update 2026-07-15 - Controlled Delete Document Link Guard (CLOSED / ACCEPTED)

Phase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` (+ `-GRANTS-54`, `-POLICY-CAST-55`, `-DIAGNOSTICS-NULL-SAFE-56`). Technical commit `707a37bd...`. Records the permanent contract between the physical controlled test deletion (Pedido/OP, `db/34`-`db/37`) and the canonical G28 document history (`document_link_revisions` / `document_link_revision_ops`):

- Physical deletion of Pedido/OP is blocked when there is canonical document history linked to any OP in the target chain (`document_link_revision_ops.op_id`) or, in the case of Pedido, linked directly to the Pedido (`document_link_revisions.pedido_id`).
- `document_link_revisions` and `document_link_revision_ops` are never deleted, altered, or reactivated by the Controlled Delete, in any scenario, blocked or not.
- The public RPCs (`diagnosticar_impacto_pedido`, `diagnosticar_impacto_op`, `remover_pedido`, `remover_op`) always call the document diagnosis before any destructive delegation; the delegation only occurs when the diagnosis classifies the target as eligible (`blocked=false`).
- The legacy destructive logic from `db/34`-`db/37` was renamed to `diagnosticar_impacto_pedido_pre53`, `diagnosticar_impacto_op_pre53`, `remover_pedido_pre53`, `remover_op_pre53`. These four functions do not constitute a public API: `EXECUTE` is revoked from `PUBLIC`, `anon`, and `authenticated` (only `postgres`/owner).
- The four public RPCs keep `EXECUTE` only for `authenticated` (`PUBLIC` and `anon` without `EXECUTE`).
- In the absence of document history, the previous physical deletion policy (`db/34`-`db/37`: blocking by entrega/expedicao/child OP, cascade with `EXCLUIR`/`EXCLUIR TUDO`, `op_numeros` untouched) remains in effect and unchanged.
- Document history is append-only; this guard does not introduce any automatic unlinking mechanism. Link correction, when necessary, occurs through the human document flow (`js/document-link-admin-controller.js` / `document-link-admin-modal.js`), never through physical test deletion.

Validated in staging `ucrjtfswnfdlxwtmxnoo` with synthetic fixtures (eligible-OP, eligible-Pedido, and blocked-by-history cases), zero cleanup, and `op_numeros` preserved. Production not accessed; no push. See `docs/ledgers/G28_LEDGER.md` for complete evidence.

## Update 2026-07-15 - Docs Canonical Consistency Backfill A (CLOSED / ACCEPTED)

Phase `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. Docs-only; no code, test, SQL, migration, staging, or production changed.

- Closes the documentation gap identified in `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` (note alongside decisions `D-DEL10`-`D-DEL13`, Controlled Delete Document Link Guard phase, 2026-07-15): `db/37_controlled_delete_expedicao_cascade.sql` had never received its own `D-DEL` entry.
- Added `D-DEL14` (section "Phase Controlled Delete - Expedicao Cascade (db/37)", SS10 above), derived from the actual `db/37` file and the `db/34`-`db/36` sequence: expedicao stops blocking unconditionally and starts being part of the `EXCLUIR TUDO` cascade in staging/test.
- `docs/DOCUMENTATION_INDEX.md` SS4 received the missing lines for `db/34`-`db/37` and `db/53`-`db/56`, and the status of `db/30` was corrected from "not yet applied" to the precise state already accepted in `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A` (applied and verified in staging, no drift, not recorded in `supabase_migrations.schema_migrations`, live ACL broader than the canonical contract, no confirmed exposure).
- Does not normalize or resolve `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`, `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, the authenticated smoke debts, or `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, which remain `ARCHITECT DECISION REQUIRED`/open.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; no push. See `docs/ledgers/G28_LEDGER.md` for the append-only entry of this phase.
