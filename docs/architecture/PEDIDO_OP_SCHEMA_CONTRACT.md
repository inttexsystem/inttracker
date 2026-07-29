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
| **INSUMOS** | `ordens_compra_fio` **for receipt progress until Phase C** (see note) | `SUM(kg_recebido) / SUM(kg_pedido)` per OP linked to the pedido |
| **TECELAGEM** | `entrega_itens` (cima stage) | `SUM(metros_entregues without defect) / SUM(op_itens.metros_pedidos)` per linked OP |
| **ACABAMENTO** | `entrega_itens` (latex stage) | Same, for látex deliveries |
| **EXPEDIÇÃO** | To be defined (future) | Outbound movement (new stage or entrega with etapa=expedicao) |
| **ENTREGA** | To be defined (future) | Receipt confirmation by the cliente or carrier |

> **Purchase-order refoundation note (updated 2026-07-19, `REFUND-B1-CONTRACT-R2`).**
> The `ordens_compra_fio` entry above is **no longer the sole authority** for the yarn
> purchase-order domain; it is a **per-dimension** authority under the ratified
> refoundation (`docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md`, Part R,
> corrected by §R.22). **Native purchase-order administration** moves to `ordem_compra`
> at `REFUND-B1`, but only as **draft** authority — native **emission** is installed
> but inactive and is deferred to PRE-PROD (§R.22.2/§R.22.5); imported-legacy orders
> keep the db/66 flat path. **Receipt** authority — the `SUM(kg_recebido)/SUM(kg_pedido)`
> used by this INSUMOS row — **remains on `ordens_compra_fio` until Phase C**, when it
> moves to the `ordem_compra_fio_lancamentos` / `ordem_compra_item` ledger; **no native
> receipt path and no flat compatibility shadow exist yet** (bridge deferred, debt
> `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`). So this INSUMOS progress
> formula stays correct through Phase C, but the table's "source of truth" label is
> understood as *receipt-dimension authority during coexistence*, not administrative or
> single-model authority. The refoundation is currently applied on the
> staging/development database (`ucrjtfswnfdlxwtmxnoo`) only; production carries
> `db/01→64`, so a production consumer sees the pre-refoundation flat shape until a
> separately authorized production promotion.
>
> **PRE-PROD-A-R1 update (2026-07-19, `PRE-PROD-A-R1`, §R.23).** The purchasing
> **model per Pedido** becomes explicit and immutable via `pedido_compra_fio_regime`
> (`legacy` for any Pedido with existing flat purchasing evidence, else `native`),
> resolved server-side by `resolver_regime_compra_fio_pedido`. For `native` Pedidos,
> `persistirOP` no longer writes `ordens_compra_fio`; native yarn **needs** are
> assessed/synchronized server-side (`avaliar_necessidades_compra_fio` /
> `sincronizar_necessidades_compra_fio`) from the same canonical demand this INSUMOS
> row uses (`op_itens → modelos → parametros_largura`, eligible `aberta`/`em_producao`
> `tecelagem` OPs), and distributed onto native draft orders through the
> absolute/idempotent allocation writer. **Receipt authority is unchanged** — the
> `SUM(kg_recebido)/SUM(kg_pedido)` progress above **stays on `ordens_compra_fio`
> until Phase C**; PRE-PROD-A activates needs + allocation only, leaves native
> emission inactive, creates no receipt path and no flat shadow (bridge still
> deferred, `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`). Staging
> (`ucrjtfswnfdlxwtmxnoo`) only.
>
> **PRE-PROD-A-R1 closeout update (2026-07-19; not architect acceptance).** The
> authenticated live allocation gate passed, so allocation controls on the dedicated
> order detail are enabled. This does not change the contract above: `persistirOP`
> still uses the native needs writer with no flat fallback; native emission remains
> ungranted/inactive and receipt remains deferred to Phase C. The rollback rehearsal
> revoked/restored the three writers and proved a denied native synchronization maps to
> `necessidades_sync`, never a flat shadow. All fixtures/probes were removed; production
> was not accessed.
>
> **PRE-PROD-A-R1 architect acceptance (2026-07-19).** Status is `CLOSED /
> ACCEPTED_WITH_NONBLOCKING_ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`. Allocation controls
> remain active in staging only for eligible native drafts. The authenticated ACL and live
> T1/T2 gates are accepted; `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved. This does
> not authorize native emission: `emitir_ordem_compra` remains inactive and ungranted.
> Native receipt and Phase C remain pending, and
> `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` remains open. The mobile shell
> debt remains non-blocking. A production diagnosis is mandatory before production work;
> production, `main`, push, PRE-PROD-B, and Phase C implementation remain prohibited.
> UI provenance / modern-visual-language audit is deferred as a separate,
> post-stabilization, non-blocking activity.
>
> **PHASE-C1 native receipt authority update (2026-07-19, §R.24; `CLOSED /
> ACCEPTED`).** Phase C evolves `ordem_compra_fio_lancamentos` into the sole
> canonical physical receipt ledger; events remain audit-only, and all receipt totals,
> order status, and projections become database-derived. An immutable receipt header
> owns origin/document identity, date, actor, stable submission idempotency, and command
> metadata; its lines bind the native item, optional allocation, allocation's derived
> real-or-NULL OP provenance, and ledger entry. Cotton follows a real-OP allocation.
> Shared polyester keeps both need and allocation `op_id IS NULL`; fake or
> representative OPs are forbidden. Excess remains on the same receipt/item and may
> create only a narrow atomic inventory movement. Positive history is immutable;
> reversal appends a source-referencing negative entry under locked remaining-reversible
> limits. Admin and future matching-supplier actors use the same RPC with no table DML;
> supplier reversal permission remains an explicit pre-implementation decision.
> Legacy A/D non-zero balances seed one `import_saldo_inicial` receipt per mapped item;
> B seeds none; C has none. C3 must fence both flat writers, snapshot all 51 mappings,
> import/reconcile, migrate both consumers, switch readers, revoke flat updates, close
> the ACL gap, and remove anonymous update. Native emission stays inactive until C1-C4
> acceptance. This C1 record authorizes no schema implementation, migration, staging
> write, grant, UI, test, or C2 work.
>
> **PHASE-C2 implementation boundary (2026-07-19, §R.25; `CLOSED /
> ACCEPTED`).** Migration `db/70` creates immutable
> `ordem_compra_recebimentos` headers, extend the existing receipt ledger for native
> command/allocation/derived real-or-NULL OP/material identity, create the source-linked
> `ordem_compra_fio_movimentos_estoque` surplus movement object, and install three
> RPCs: multi-line `registrar_recebimento_ordem_compra`, admin-only
> `estornar_recebimento_ordem_compra`, and actor-scoped
> `obter_historico_recebimento_ordem_compra`. Idempotency namespace
> `native_receipt_v1` is unique by actor type + actor UUID + key and compares the
> canonical JSONB payload for exact replay. Receipt lines are either concrete
> allocations (real OP derived server-side for OP-origin, NULL for shared Pedido-origin)
> or explicit excess (no allocation/OP).
> Item received cache and header status are ledger-derived; allocation/excess/
> reversible quantities are projections. Exactly one source-linked movement exists
> per ledger entry, but only derived surplus delta changes the existing multi-origin
> `saldo_fios` cache. Admin or active matching supplier may register; only admin may
> reverse; no direct client DML. The existing INSUMOS source row and both flat
> consumers remain unchanged through C2. Cutover/import/readers/flat ACL are C3; UI
> is C4; emission remains inactive until the later C5 gate.
>
> **C2 staging closeout.** Staging records
> `20260719160518 / 70_ordem_compra_native_receipt_foundation`. The 48/48 focused
> tests, complete rollback-only functional/ACL matrix, five independent-backend
> concurrency scenarios, source-linked inventory reconciliation, immutable guards,
> exact idempotency, cleanup, and dependency-safe rolled-back removal rehearsal all
> passed. Final native receipt/header/ledger/movement residue is zero; legacy
> rows/checksums, `saldo_fios` (5 rows / 2,685.020 kg), flat ACL, and the ungranted
> emission boundary remain unchanged. Full-suite reconciliation fixes the reproducible
> baseline at 3,864 tests / 3,731 pass / 133 identified pre-existing failures: PRE-
> PROD-A `47b8e6a`, C2 baseline `3395f83`, and checkpoint `14ca5c7` have identical
> normalized identities (SHA-256
> `af9246c162a514f1162d845bb129980f9a1e4505c46323966d8def262a48a192`), with zero C2
> regression; the historical 132 aggregate is superseded. C2 is accepted. Flat receipt
> remains productive authority until a separately authorized C3 cutover; no opening-
> balance seed or productive-reader switch occurred. C3/C4/C5 remain unimplemented.

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

## Phase C3A — opening-balance inventory boundary

`import_saldo_inicial` is non-posting immutable ledger type. It is system-owned,
requires NULL actor id, uses `legacy_initial_balance_v1`, and is excluded from reversal
and inventory-movement sources. Productive receipt/reversal retain the source-linked
movement invariant. The later cutover state starts `legacy-active`; C3A must not fence
flat writers in that state. Snapshot/baseline hashes are reconciliation metadata, not
inventory mutation authority.

Staging checkpoint (`CLOSED / TECHNICALLY ACCEPTED`, 2026-07-19; see §13.14):
db/71-db/73 install the inactive
singleton and owner-only JSONB import command. Import entries require the system actor
and NULL physical receipt date; productive/legacy receipt rows retain their prior
actor/date rules. The command validates the frozen source/mapping/item/allocation and
real OP, fingerprints canonical request plus derived provenance, serializes source and
complete identity with transaction advisory locks, returns immutable IDs on exact
retry, and rejects material reuse as `idempotencia_conflitante`. A source-identity
unique index is defense in depth, not the primary concurrency mechanism. Verified
import rows create zero `ordem_compra_fio_movimentos_estoque`, `saldo_fios`, or
`saldo_fios_op` effects and remain non-reversible. Final staging contains no import or
fixture rows and remains `legacy_active`.

## 12. Purchase-order hybrid-origin contract — accepted forward correction

This section records the accepted hybrid-origin addendum and governs any conflicting
purchase-order statement above. It authorizes documentation only.

1. **Need origin.** Native production-specific cotton is `origem_tipo='op'` and
   carries the real OP that calculated consumption; the OP resolves to the same Pedido.
   Native genuinely shared polyester is `origem_tipo='pedido'` with
   `necessidade.op_id IS NULL`. A representative OP is prohibited.
2. **Allocation provenance.** The future writer locks the need and derives provenance:
   OP-origin → `allocation.op_id = necessidade.op_id`; Pedido-origin →
   `allocation.op_id IS NULL`. The caller and UI do not provide, select, replace, or
   override it.
3. **NULL-safe identity.** The current plain `(item_id, necessidade_id, op_id)` unique
   index is not a valid logical identity for shared NULL-OP allocations. A separately
   authorized migration must enforce NULL-safe uniqueness after a duplicate preflight.
4. **Single quantity authority.** `ordem_compra_item.kg_pedido` is derived exclusively
   as `SUM(ordem_compra_item_alocacao.kg_alocado)`. Manual absolute quantity cannot
   coexist as an independent authority; the existing writer is a forward-correction
   target.
5. **Ownership.** Purchase orders belong to Pedido + supplier. Distribution remains
   owned by Pedido → Insumos / `aguardando_fios`; a dedicated route is only a surface,
   not a new stage or OP ownership. One item may consolidate several OP-origin needs
   plus shared Pedido-origin needs.
6. **Phase C compatibility.** Receipt, ledger, movement, and read-model rows may retain
   complete purchase-order/item/need/Pedido/supplier/material/color/quantity/receipt/
   inventory identity while `allocation.op_id IS NULL`. Current non-NULL OP shape
   guards require localized forward correction and focused revalidation. Never fabricate
   OP provenance. Valid excess has no allocation or OP and remains governed by
   `saldo_fios`.

All redo verdicts remain **NO**. The accepted strategy is forward correction; no SQL,
migration, staging write, test change, grant, implementation, or C3A acceptance is
authorized by this section.

## 13. F1 executable database contract R1 — CLOSED / ACCEPTED

Lifecycle specification §R.28 owns the domain/API semantics; this section owns the
corresponding exact schema, identity, ACL, and concurrency realization. The two are
one contract and must be changed together. The architect accepted this contract at
commit `00897f09267fc8304b329ce46ba985d03a57faff` and separately authorized the
forward-only F1 implementation. Environment application remains unauthorized.

### 13.1 RPC parameters and outputs

The sole native distribution writer is
`public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT)
RETURNS JSONB`, with named parameters in this exact order:

| Parameter | Meaning and validation |
|---|---|
| `p_necessidade_id BIGINT` | Native need locked `FOR UPDATE`; derives Pedido, material, color, origin, and OP-or-NULL provenance. |
| `p_fornecedor_id BIGINT` | Existing supplier locked `FOR KEY SHARE`; type must be `fio_algodao` for cotton or `fio_poliester` for polyester. Current schema has no active flag. |
| `p_kg_alocado NUMERIC` | Absolute target `NUMERIC(12,3)` semantics, non-negative, at most three decimals; zero means removal. |
| `p_idempotency_key TEXT` | Trimmed 1-200 key in actor-scoped namespace `native_distribution_v1`. |

The caller supplies none of Pedido, order, item, allocation, material/color, or OP.
The function is `SECURITY DEFINER`, fixed empty `search_path`, internal
`auth.uid()` + `is_admin()`, `authenticated` EXECUTE only.

| Output | JSON type |
|---|---|
| `ok`, `codigo`, `idempotency_key`, `discriminador` | boolean/text; discriminator is `created`, `increased`, `reduced`, `removed`, or `unchanged`. |
| `necessidade_id`, `pedido_id`, `fornecedor_id` | number/string UUID/number. |
| `origem_tipo`, `op_id`, `material`, `cor_id`, `cor_poliester` | text/nullable number/text/nullable number/nullable text. |
| `ordem_compra_id`, `ordem_compra_item_id`, `alocacao_id` | nullable numbers; removal returns the affected deleted IDs, absent zero-target returns NULL. |
| `kg_anterior`, `kg_final`, `item_kg_pedido` | three-decimal numbers; item total NULL after item cleanup. |
| `necessidade_kg_necessario`, `necessidade_kg_alocado`, `necessidade_kg_restante` | three-decimal numbers from locked post-state. |
| `item_removido`, `ordem_removida` | booleans. |

Errors use `{ok:false,codigo,erro}` and the stable taxonomy in §13.8. Only successful
commands enter the immutable command journal.

### 13.2 Idempotency and replay

The future schema object is `public.ordem_compra_distribuicao_comandos`:

| Column/constraint | Exact contract |
|---|---|
| `id BIGSERIAL PRIMARY KEY` | Immutable command identity. |
| `idempotency_namespace TEXT NOT NULL` | CHECK exactly `native_distribution_v1`. |
| `ator_id UUID NOT NULL` | FK `auth.users(id) ON DELETE RESTRICT`. |
| `idempotency_key TEXT NOT NULL` | Trimmed length 1-200. |
| `comando_payload JSONB NOT NULL` | Exact normalized request object. |
| `comando_hash TEXT NOT NULL` | Lowercase 32-hex MD5 of canonical JSON text. |
| `resultado JSONB NOT NULL` | Exact successful return object, including deleted IDs when cleanup occurred. |
| `criado_em TIMESTAMPTZ NOT NULL DEFAULT now()` | Acceptance time only. |
| unique | `(idempotency_namespace, ator_id, idempotency_key)`. |

It has RLS, no client DML, and an owner-only immutable UPDATE/DELETE guard. No FK to
draft order/item/allocation is allowed because successful cleanup must not destroy or
block command history. Retention is permanent.

Canonical request JSON is exactly
`{"namespace":"native_distribution_v1","necessidade_id":N,"fornecedor_id":F,
"kg_alocado":"0.000"}`. JSONB equality decides conflict; hash alone never does.

| Replay case | Result |
|---|---|
| same actor/key/request | Return stored result byte-for-byte; zero business mutation. |
| same actor/key/different request | `idempotencia_conflitante`. |
| intentional later target change | New key required; evaluate current state. |
| same target/new key | Accepted `unchanged` record. |
| failed validation | No command row; a retry revalidates live state. |

### 13.3 Allocation mutation API

Separate increase/reduce/remove RPCs are rejected. The absolute target command is the
only API:

| Current/target | Row operation | Derived quantity/cleanup |
|---|---|---|
| absent / positive | Insert allocation after deriving draft/item/provenance. | Recompute item sum. |
| positive / higher | UPDATE locked allocation `kg_alocado`. | Recompute and cap against need excluding current identity. |
| positive / lower positive | UPDATE locked allocation `kg_alocado`. | Recompute item sum. |
| equal | No business-row write. | Return current totals. |
| positive / zero | DELETE allocation. | Delete empty item, then empty active draft. |
| absent / zero | Create nothing. | Return `unchanged`, NULL entity IDs. |

Every intentional operation uses a new command key; reuse with a changed target is a
conflict. Parent must be native `rascunho`; emitted/cancelled/legacy state is frozen.

### 13.4 Cleanup and derived quantity

| Post-mutation state | Canonical transition |
|---|---|
| allocation remains positive | Retain allocation/item/order; item kg becomes allocation sum. |
| allocation becomes zero | Delete allocation; zero-valued historical rows are prohibited. |
| item has no allocation | Delete the draft item; empty shells are prohibited. |
| active draft has no item | Delete the native draft; later distribution creates new identities. |
| non-draft/history-bearing entity | No cleanup; return `estado_invalido` or `limpeza_conflitante`. |

No lifecycle event is written for deletion of a never-emitted draft; the immutable
command journal is the audit. Exact replay after cleanup returns stored deleted IDs.
The one-active-draft partial unique index remains.

F1 must add a deferred initially-deferred constraint trigger
`trg_item_kg_pedido_derivado_guard` covering item and allocation mutations. At commit,
every surviving item must have at least one allocation and exact
`kg_pedido = SUM(kg_alocado)`. This permits transactional create-before-allocation and
last-allocation-before-item-delete, while rejecting direct/manual divergence. The
writer performs the recompute before commit. Freeze guards must also reject non-draft
supplier/Pedido, item identity/existence, allocation, and quantity mutation.

### 13.5 NULL-safe logical identity

The exact identity is `(item_id, necessidade_id)` for both origins; OP is derived
data and is not an identity input.

| Origin | Stored provenance | Identity enforcement |
|---|---|---|
| native `op` | allocation OP equals non-NULL need OP; OP resolves to need Pedido. | Unique `(item_id, necessidade_id)`. |
| native `pedido` | need OP NULL and allocation OP NULL. | Same unique `(item_id, necessidade_id)`; no NULL semantic gap. |
| imported legacy | Existing real OP retained unchanged. | Same index after duplicate preflight; no conversion. |

The migration hard-stops if `GROUP BY item_id, necessidade_id HAVING count(*)>1`
returns any row, drops/replaces the old nullable-OP identity index, and installs an
owner-only origin guard using `IS NOT DISTINCT FROM`. PostgreSQL `NULLS NOT DISTINCT`
and partial-index alternatives are rejected as unnecessary; the need already carries
the complete origin identity.

### 13.6 ACL disposition

| Function | Disposition | PUBLIC | anon | authenticated | service_role | Legacy/internal dependency |
|---|---|---:|---:|---:|---:|---|
| `definir_alocacao_necessidade_compra_fio(BIGINT,BIGINT,NUMERIC,TEXT)` | create/sole canonical native writer | no | no | yes, internal admin | no | none |
| `definir_item_ordem_compra(UUID,BIGINT,TEXT,BIGINT,TEXT,NUMERIC)` | retain owner-only, deprecated | no | no | no | no | no legacy dependency; later dependency-safe drop |
| `alocar_necessidade_compra_fio(BIGINT,BIGINT,BIGINT,NUMERIC)` | replace, retain owner-only | no | no | no | no | no legacy dependency |
| `remover_item_ordem_compra(BIGINT)` | replace, retain owner-only | no | no | no | no | no legacy dependency |
| `remover_alocacao_compra_fio(BIGINT)` | replace, retain owner-only | no | no | no | no | already rejects legacy |
| `emitir_ordem_compra(BIGINT)` | keep inactive owner-only | no | no | no | no | unchanged |
| `cancelar_ordem_compra(BIGINT)` | keep admin draft lifecycle | no | no | yes | no | unchanged |
| `registrar_recebimento_ordem_compra(...)` | keep/correct shared shape | no | no | yes, existing actor checks | no | no activation/cutover |
| `estornar_recebimento_ordem_compra(...)` | keep | no | no | yes, internal admin | no | unchanged |
| `visualizar_importacao_saldo_inicial_c3a()` | keep read-only preview | no | no | yes | no | C3A unchanged/unaccepted |
| `importar_saldo_inicial_ordem_compra_c3a(JSONB)` plus C3A mutation helpers | keep owner-only | no | no | no | no | Class A/D legacy import only |

Flat db/66/`ordens_compra_fio` authority is untouched. F2 must replace current UI
calls before any operational environment application; F1 contract acceptance does
not authorize F2, implementation, or application.

### 13.7 Phase C native receipt/ledger shapes

| Shape | allocation | need/allocation OP | ledger/movement OP | Required behavior |
|---|---|---|---|---|
| OP-origin allocated | present | same real non-NULL OP | same OP | Validate order/item/need/Pedido/material/color and caps. |
| Pedido-origin shared allocated | present | both NULL | NULL | Preserve all non-OP identities; no fabricated OP. |
| excess | absent | not applicable | NULL | Preserve receipt/item/material/color and source-linked surplus movement. |
| C3A attributed import | present | existing real OP | real OP | Retain db/73 frozen legacy validation; zero inventory posting. |

| Existing object/path | Future F1 change |
|---|---|
| native ledger shape CHECK | Allocated branch requires allocation + zero excess, not non-NULL OP; excess branch remains allocation NULL + OP NULL + full excess. |
| db/70 guard | Compare `v_alloc.op_id IS DISTINCT FROM NEW.op_id`; validate need origin/Pedido. |
| db/71 replacement guard | Same NULL-safe comparison; preserve system import rules. |
| receipt selection | Remove non-NULL filter; accept OP/equal or Pedido/both-NULL shape; line OP remains derived from allocation. |
| quantity caps | Allocation/item caps unchanged. |
| derivation/movement | Carry nullable OP; surplus and `saldo_fios` policy unchanged. |
| reversal | Preserve source with NULL-safe comparisons; shared reversal remains NULL. |
| history/read models | Emit shared rows with `op_id:null`; any OP enrichment is a LEFT join. |
| db/72-db/73 C3A | No change to singleton, import identity/hash, real-OP legacy guard, non-posting, or ACL. |

No data conversion or receipt/ledger history rewrite is required.

### 13.8 Stable error identifiers

| Code | Condition |
|---|---|
| `sem_permissao` | unauthenticated or non-admin actor |
| `idempotencia_invalida` | blank/over-200 key |
| `idempotencia_conflitante` | accepted key reused with different normalized request |
| `necessidade_nao_encontrada` | missing need |
| `necessidade_invalida` | legacy, zero, or non-native need |
| `necessidade_origem_invalida` | invalid material/origin/nullable-OP shape |
| `fornecedor_invalido` | missing supplier |
| `fornecedor_inativo` | reserved but unreachable: current schema has no activity field; F1 adds none |
| `fornecedor_incompativel` | supplier type/material mismatch |
| `kg_invalido` | NULL, negative, scale/range invalid |
| `excede_saldo` | absolute target exceeds need capacity excluding current identity |
| `pedido_incoerente` | need/order/OP Pedido mismatch |
| `op_incoerente` | derived OP differs or shared provenance is non-NULL |
| `estado_invalido` | parent is not native active draft |
| `alocacao_duplicada` | corrected logical identity has duplicates/unique conflict |
| `limpeza_conflitante` | cleanup encounters frozen/history-bearing or unlocked divergent state |
| `alocacao_invalida` | receipt line identity/provenance mismatch |

### 13.9 Exact lock order

| Order | Lock |
|---:|---|
| 1 | command-key transaction advisory lock over namespace + actor + trimmed key |
| 2 | existing immutable command row `FOR UPDATE`, when present |
| 3 | need row `FOR UPDATE` |
| 4 | supplier row `FOR KEY SHARE` |
| 5 | `(Pedido,supplier)` draft transaction advisory lock, then active draft `FOR UPDATE`/insert |
| 6 | compatible item `FOR UPDATE`/insert |
| 7 | logical allocation `FOR UPDATE`/insert |
| 8 | mutation, cache readback, derived quantity, item/draft cleanup |
| 9 | immutable successful-command insert |

Advisory keys are exactly those specified in lifecycle §R.28.8. Single-need calls
cannot form cross-need cycles. Need+draft locks serialize allocation/removal and
cleanup/new-allocation races. Order row locking serializes emission: the loser
re-evaluates committed status/state. Receipt requires emitted state and therefore
cannot be concurrent with an accepted draft mutation.

### 13.10 Implementation and revalidation matrix

| Area | F1 implementation scope | Excluded/later |
|---|---|---|
| Forward migration | command journal; canonical RPC; duplicate preflight/new index; origin, deferred quantity, and freeze guards; exact ACL replacements; localized db/70-db/71 replacements | no rollback/rebuild of db/67-db/73; no data conversion |
| Verification | isolated apply; no-CASCADE rollback; static/focused tests; role matrix; full-suite identity comparison | staging application requires separate authorization |
| Concurrency | same OP need; same shared need; allocation/removal; duplicate key; competing same draft | no production or staging writes in contract phase |
| Phase C | shared NULL-OP receipt/ledger/movement/history/reversal; unchanged OP/excess/C3A regression | later focused Phase C revalidation |
| UI | contract-fixture coherence only | F2 Pedido/Insumos UI migration not authorized |
| Sequence | contract acceptance → separate F1 implementation order → local verification → separately authorized staging validation | PRE-PROD, C3A acceptance, C3B+, production, main, push do not chain |

Status: `F1 EXECUTABLE CONTRACT CLOSURE R1: CLOSED / ACCEPTED` at commit
`00897f09267fc8304b329ce46ba985d03a57faff`. The separate
`F1 FORWARD CORRECTION IMPLEMENTATION R1` phase is authorized.

Implementation checkpoint (2026-07-19): `IMPLEMENTED / VERIFIED LOCALLY / AWAITING
ARCHITECT REVIEW` at technical commits
`463cafbdd4816ff1093b3086dd71d3d6e70b3479` and
`680cff136a3294ae9a345fc8f91f02e246891eef`. The final ACL preserves authenticated
execution of `sincronizar_necessidades_compra_fio(UUID)` and revokes only the
accepted obsolete native mutation paths. Migration
`db/74_ordem_compra_hybrid_origin_forward_correction.sql` installs the exact RPC,
journal, identity/index, quantity/freeze guards, ACL matrix, and shared NULL-OP Phase
C replacements defined by this section. Verification used isolated PostgreSQL 18.4
only; staging was not applied. F2 remains unauthorized and C3A remains unaccepted.

### 13.11 F3 partial staging checkpoint (2026-07-19)

Staging `ucrjtfswnfdlxwtmxnoo` now contains migration
`20260719215401 / 74_ordem_compra_hybrid_origin_forward_correction`. The
`(item_id, necessidade_id)` unique identity, immutable command journal, need-first
absolute-target RPC, provenance/freeze/derived-quantity guards, NULL-OP Phase C
shape correction, and accepted role matrix are live. All pre-existing business
data snapshots remained unchanged. The accepted F2 source was deployed to a Vercel
preview, but authenticated browser validation is blocked by Vercel Authentication.
No fixture was created and no PRE-PROD/Phase C result is claimed. C3A remains
inactive and unaccepted.

### 13.12 F3R1 staging database/API checkpoint (2026-07-19)

Staging revalidation confirms the `db/74` command journal, need-first signature,
allocation identity, derived-quantity/provenance/freeze guards, nullable-OP Phase C
replacements, effective ACLs, and unchanged business-data snapshots. A
rollback-only domain fixture passed OP-origin and shared-origin mutation,
idempotency, cleanup, post-emission freeze, receipt, and reversal with zero
residue. PRE-PROD and targeted Phase C requirements pass on that evidence.

Committed multi-session staging concurrency is still unproved. The accepted
immutable journal must retain every successful actor/key command even after target
zero cleanup; consequently a committed synthetic race cannot be both observable
across sessions and residue-free. No canonical retained staging fixture exists.
This is a validation-policy hard stop, not a schema divergence, ACL divergence, or
authorization to remove journal evidence. C3A remains inactive and unaccepted.

### 13.13 F3R1 acceptance disposition (2026-07-19) — CLOSED / ACCEPTED

The architect accepted the F3R1 staging database/API gate. The isolated F1
eight-case distinct-session concurrency matrix and the F3R1 rollback-only staging
evidence (§13.12) are accepted as sufficient concurrency proof for this gate; the
committed multi-session staging-fixture requirement is **waived for F3R1 only**.
The immutable command journal and the zero-synthetic-residue policy remain binding
and are not relaxed by this waiver. This disposition records acceptance only: no
schema, ACL, error-taxonomy, or lock-order contract changes. PRE-PROD and focused
Phase C revalidation are accepted. C3A remains inactive and unaccepted. Production,
`main`, emission activation, C3A execution, remotes, push, and deployment remain
unauthorized.

### 13.14 PHASE-C3A technical acceptance (2026-07-19) — CLOSED / TECHNICALLY ACCEPTED

PHASE-C3A is accepted. Staging migrations `71`-`74` are present. The cutover
singleton is `id=1`, `legacy_active / not_started`, with every cutover marker
`NULL`. Staging holds zero import headers, import ledger rows, native headers,
inventory movements, and baseline rows. Preview reconstruction shows 39
headers, 44 ledger entries, 20,221.280 kg reconstructed, and 405.980 kg
excess. `saldo_fios` holds 5 rows / 2,685.020 kg; `saldo_fios_op` is zero. The
import command `importar_saldo_inicial_ordem_compra_c3a(jsonb)` is owned by
`postgres`, `SECURITY DEFINER`, fixed empty `search_path`, with no EXECUTE
grant for `PUBLIC`, `anon`, `authenticated`, or `service_role`. The
authenticated read-only preview ACL is intentionally retained under §R.28.5.
The focused acceptance suite passed 66/66. This disposition is recorded by the
technical supervisor acting as delegated project architect and is not
attributed to Kleber. This disposition records acceptance only: no schema,
ACL, error-taxonomy, or lock-order contract changes. It authorizes no real
import, snapshot, fence, reader/writer or flat-ACL switch, native emission,
`C3B`/`C3C`/`C3D`/`C4`/`C5`, production, `main`, remote change, push, or
deployment. `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` remains
nonblocking debt.

### 13.15 PHASE-C3B executable contract closure R1 — CLOSED / ACCEPTED

This section is accepted by the technical supervisor acting as delegated project
architect and is not attributed to Kleber. It is the structural complement to
§R.29. C3B is documentation closure; C3C is separately ordered inactive
implementation; C3D is rehearsal/inactive staging deployment preparation; the
only real activation is a later separately authorized single maintenance window.

#### 13.15.1 Canonical structures and normalized-read authority

The cutover singleton must contain an authoritative `read_authority` (`flat` or
`canonical`), lifecycle state, cutover generation, frozen-source and
inventory-baseline identities/hashes, and `productive_receipt_started_at`.
Canonical reader output must retain nullable `op_id`, distinguish
`kg_recebido_atribuido` from `kg_excesso`, and make Pedido-origin rows visible
once at Pedido scope. Projection consumers cannot read the flat table directly
after activation or independently reconstruct receipt totals.

#### 13.15.2 Exact final effective ACL closure

The following is the required post-window direct authority. “None” means no
direct privilege on flat/canonical receipt tables, sequences, cutover structures,
or internal commands. A table-level `REVOKE` never removes a column grant; both
table-level and every column-level grant must be explicitly revoked.

| Principal | Flat receipt tables / sequences | Canonical receipt tables / sequences | Cutover structures / internal commands | RPC surface |
|---|---|---|---|---|
| `PUBLIC` | none | none | none | no EXECUTE by default |
| `anon` | none | none | none | none |
| `authenticated` | none | none | none | only explicitly authorized receipt/reversal/history RPCs, least privilege |
| `service_role` | none | none | none | none; service-role bypass is not a grant model |
| `admin` | none direct | none direct | none direct | authorized canonical RPCs only, with internal actor/order checks |
| `supplier` | none direct | none direct | none direct | only the expressly authorized canonical receipt RPC for its matching supplier/order, with actor/order checks |

Final closure explicitly revokes legacy table DML and every legacy column DML,
including anon table-level/column `UPDATE` and authenticated receipt-column
`UPDATE`; it also revokes sequence privileges, cutover/internal-command access,
and obsolete RPC EXECUTE. RLS policies for protected tables are removed or
replaced so that no policy targets `PUBLIC`; supplier paths are RPC-authorized and
role/actor/order constrained. Existing excessive anon grants are legacy authority,
not a confirmed exploit, until an empirical role-matrix proof establishes it.

Every `SECURITY DEFINER` function has fixed empty `search_path`, explicit EXECUTE
revocation from `PUBLIC`, `anon`, and `service_role`, no implicit table access,
and only a least-privilege `authenticated` grant where the RPC is expressly
required. Each canonical function validates the internal actor and the permitted
order/supplier relationship before mutation or history disclosure.

#### 13.15.3 Fence, import, and recovery invariants

Database guards enforce `legacy_receipt_fenced` for direct legacy receipt-column
updates and protected source/inventory mutations while state is
`maintenance_fenced` or `canonical_active`. Canonical commands require
`canonical_active` after the window closes. The first successfully committed
non-import canonical receipt after `read_authority = canonical` atomically sets
`productive_receipt_started_at`; this is the exact point of no return.

The frozen import source contains all 51 mappings and the full inventory baseline
with stable ordering, three-decimal quantities, and SHA-256 identities. The
postgres-only import accepts only that snapshot and produces exactly 39 headers,
44 ledger lines, 20,221.280 kg, and 405.980 kg excess with zero inventory
movements. Pre-switch reconciliation proves those counts/totals, snapshot and
inventory hashes, normalized no-double-counting, and zero productive receipts.

Before the point of no return, rollback restores flat reads only after proving
zero productive canonical receipts. It retains legacy fencing and does not restore
flat grants. Flat mutation re-enablement is a distinct recovery authorization
requiring generation/idempotency proof against stale or double-counted immutable
import data. After the point of no return, recovery is forward-only.

### 13.16 PHASE-C3C-A inactive implementation closeout R1 — CLOSED / TECHNICALLY ACCEPTED

`C3C_A_STATUS: CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED / INACTIVE / NOT APPLIED TO STAGING`

`NEXT_AUTHORIZABLE_ACTION: READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`

Recorded status: **`CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED / INACTIVE /
NOT APPLIED TO STAGING`**. The delegated technical supervisor records this
acceptance; it is not attributed to Kleber. Technical chain: `d4dba671` →
`4b7ee13f` → `29913e40` → `89123729`.

The accepted local implementation realizes §13.15 without changing it: inactive
state authority; complete `PUBLIC`-policy membership detection and closure across
the protected 14-table set; replay idempotency and stable
`55000 / idempotencia_conflitante`; canonical row/aggregate SHA-256 plus live
source/inventory drift rejection; exact 51 mappings, 39 headers, 44 scoped lines,
19,815.300 kg attributable, 405.980 kg excess, 20,221.280 kg reconstructed, and
zero import-attributable inventory movements; nullable Pedido-origin provenance,
separate attributable/excess quantities, no fabricated OP, and no double count;
runtime session-lock exclusion and deterministic eight-stage resource locking;
and the accepted pre-/post-PONR recovery behavior. PostgreSQL 18.4 local
apply/reapply leaves the singleton `legacy_active / flat / not_started`.

Only local technical acceptance is recorded. No staging validation or
application, deployment, activation, cutover, or product acceptance is granted.
The single-window cutover, database fence, short-transaction/session-lock
requirements, table- and column-level ACL closure, UI ownership, supplier-UI
deferral, PONR, and recovery boundaries in §§R.29/13.15 remain unchanged.

Unauthorized: C3C-B implementation, C3D, staging application/validation,
activation, deployment, real snapshot/import, fence transition, read switch,
final ACL-closure invocation, cutover, C4, C5, production, `main`, remotes, and
push. **NEXT_AUTHORIZABLE_ACTION: `READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`.**
C3C-B remains the next product implementation lot but is not authorized; the
audit precedes any C3C-B implementation order, and no phase chains automatically.

### 13.17 Active Phase-C schema requirement registry — governance metadata

This registry adds stable schema-requirement metadata without changing §13.15 or
creating operational state or phase authority.

| REQUIREMENT_ID | NORMATIVE_ANCHORS | OWNING_PHASE | REQUIREMENT |
|---|---|---|---|
| `OC-C3D-ACL-001` | `13.15.2` | `C3D` | Rehearse the complete effective ACL closure across table privileges, column privileges, sequences, functions, and RLS policies without invoking the real final closure. |

The complete derived matrix is
`docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md`.

### 13.18 Legacy-compat receipt adapter schema requirements

`ordem_compra_recebimentos.idempotency_namespace` `CHECK` constraints are
additively extended to admit `'legacy_compat_receipt_v1'` alongside the existing
native values (`'native_receipt_v1'`, `'legacy_initial_balance_v1'`). Concretely
this extends both `ordem_compra_recebimentos_c3a_namespace_check` (the IN-list,
db/71) and `ordem_compra_recebimentos_c3c_hash_check` (the namespace/hash-shape
coupling, db/75), using a 32-hex md5 command hash for the new namespace. No
existing row's namespace changes.

The `comando_tipo` `CHECK` is left **unchanged**: legacy-compat receipts reuse
the native command types — `'recebimento'` for an increase and the equal/no-op
record, `'estorno'` for a decrease — and are distinguished **solely** by the
idempotency namespace; no `'recebimento_compat'` command type is introduced or
admitted. This corrects the R2 §34.3 draft (which proposed a `comando_tipo`
extension): the installed native ledger shape guard
(`trg_native_lancamento_shape_guard`, db/71/db/74) couples the header's
`comando_tipo` to each ledger line's `tipo`, so a distinct compat command type is
not viable without modifying that guard, which the frozen manifest forbids
(contract §35, architect ruling).

`db/76` introduces no trigger on `ordens_compra_fio`, no one-time compat-mapping
backfill, no `ordem_compra_item_compat_fio` row, and no modification to any
`db/67` or `db/75` object. The migration is exactly two `SECURITY DEFINER`
functions plus this one additive constraint change.

## Update 2026-07-24 — PHASE-MANTA-A (product variation: Manta)

`db/78_manta_product_identity_and_route_foundation.sql` adds the canonical
product-variation owner and its invariants (governing contract:
`docs/architecture/MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md`):

- `modelos.tipo_produto TEXT NOT NULL DEFAULT 'tapete'`, CHECK `('tapete','manta')`.
  Sole owner of product type; `pedido_itens` and `op_itens` derive it through
  `modelo_id` — no redundant product-type column is added to `pedido_itens`,
  `op_itens`, `ops`, `lotes` or deliveries.
- Manta width invariant: CHECK `tipo_produto <> 'manta' OR largura = 1.40`.
- Model uniqueness replaced with
  `UNIQUE (nome, cor_1_id, cor_2_id, largura, tipo_produto)`.
- `pedido_itens_manta_largura_guard` trigger rejects a non-null `largura` override
  other than 1.40 for a Manta item; Tapete behavior unchanged.
- `op_itens_route_homogeneity_guard` trigger enforces a route-homogeneous OP (only
  Tapete or only Manta).
- `gerar_op_latex` / `gerar_op_latex_split` reject a Manta or non-homogeneous origin
  before reserving an OP number; all other `db/33` behavior, signatures, grants,
  security mode, search_path, locking, events and generated rows are preserved.

Yarn is unchanged and width-keyed: Manta 1.40 reuses `parametros_largura[1.40]` with
no duplicated factor. Direct Manta delivery (`entregas.etapa = 'tecelagem_direto'`)
is deferred to PHASE-MANTA-B and is not part of this schema change.

## Update 2026-07-24 — PHASE-MANTA-A route-invariant correction (db/79)

`db/79_manta_product_identity_invariant_correction.sql` is a forward-only, idempotent
correction of two invariant defects in db/78. It does not edit the published,
byte-stable db/78 (forward-only migration policy, §12); the migration terminal guard
advances 78 → 79 (`tests/ordem-compra-c3d-deploy.smoke.js`). Governing contract:
`docs/architecture/MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` §7.

- **`op_itens_route_homogeneity_guard_fn` is now concurrency-safe.** The BEFORE
  INSERT/UPDATE guard serializes writers on the owning `public.ops` row(s) with
  `FOR UPDATE` before inspecting `op_itens`, so two concurrent first inserts of
  different product types into the same empty OP can no longer both commit. Every
  affected OP identity is locked in deterministic ascending `id` order (the
  destination OP, plus the source OP when an UPDATE moves an item between OPs), which
  composes deadlock-free with the existing db/31/db/32 finishing functions (they lock
  the owning `ops` row `FOR UPDATE` before that op's `op_itens`). Under the canonical
  READ COMMITTED isolation the blocked writer re-reads the committed rows under a
  fresh per-statement snapshot and is rejected. Homogeneity semantics, the derived
  product type (`modelos.tipo_produto` via `modelo_id`; no denormalized column) and
  the no-partial-write BEFORE-trigger contract are all preserved from db/78. Inserts
  into different OPs do not serialize.
- **New `modelos_route_identity_immutability_guard` (BEFORE UPDATE on
  `public.modelos`).** Once a model is referenced by `pedido_itens` or `op_itens`,
  changing `tipo_produto` or `largura` is rejected — the persisted product identity of
  historical Pedidos/OPs (derived through `modelo_id`) is immutable. An unreferenced
  model may still change those fields, subject to the db/78 CHECK constraints; other
  columns (e.g. `nome`) remain editable. Direct SQL and stale UI receive the same
  rejection. The preferred path for a post-use type/width change is a new model SKU.
  `SECURITY DEFINER`, `search_path = public`, grants and security mode match db/78.

Verified on a disposable PostgreSQL 18.4 cluster (`tests/manta-product-identity-invariant.mjs`):
full db/01..79 apply, db/78+db/79 idempotent re-apply with a stable schema fingerprint
(zero schema/grant/trigger/function drift), the db/78 integration test, model
immutability, real two-session route-homogeneity concurrency (one commit + one
controlled rejection, homogeneous OP; same-type both succeed; different OPs
independent; deterministic ascending lock order; no deadlock), finishing-RPC
regression, and the C5 emission integration test. No shared-development apply is
authorized.

## Update 2026-07-24 — PHASE-MANTA-A model-reference concurrency correction (db/80)

`db/80_manta_model_reference_concurrency_correction.sql` is a forward-only,
idempotent correction of the last concurrency gap left by db/79. It does not edit
db/78 or db/79 (forward-only policy, §12); the migration terminal guard advances
79 → 80. Governing contract: `MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` §8.

- **The gap.** Product identity is derived live through `modelo_id`. db/79 serializes
  competing writes to one OP and makes `modelos.tipo_produto`/`largura` immutable once
  referenced, but the item-side guards read those fields WITHOUT locking the model
  row. So the first `pedido_itens`/`op_itens` reference to a model did not serialize
  against a concurrent `modelos` UPDATE of `tipo_produto`/`largura`: an item could be
  validated against one committed identity while a racing model update committed a
  different one.
- **The fix.** `op_itens_route_homogeneity_guard_fn` and
  `pedido_itens_manta_largura_guard_fn` now lock every affected `modelos` row with
  `FOR SHARE`, in ascending `modelo_id` order, BEFORE deriving type/width (INSERT →
  the new model; UPDATE → OLD and NEW models when distinct). `FOR SHARE` conflicts
  with the row lock a `modelos` UPDATE takes (its BEFORE UPDATE row trigger locks the
  target row FOR UPDATE-equivalently, before the immutability guard fires), so a
  reference and a routing-identity change on the same model always serialize: whoever
  commits first is observed by the other, which then rejects (immutability if the
  reference wins; homogeneity/width if the model update wins). `FOR SHARE` is
  compatible with `FOR SHARE`, so concurrent references never block each other.
  `modelos_route_identity_immutability_guard_fn` is preserved unchanged; no
  product-type column is denormalized.
- **Global deterministic lock order** (no db/80 path reverses it; compatible with the
  db/79 OP-movement locks and the db/31/db/32 finishing functions, which lock the
  owning `ops` row before that op's `op_itens` and take no `modelos` lock):
  (1) affected `ops` rows ascending `op_id` (FOR UPDATE); (2) affected `modelos` rows
  ascending `modelo_id` (FOR SHARE); (3) inspect and continue.

Verified on a disposable PostgreSQL 18.4 cluster (`tests/manta-product-identity-invariant.mjs`,
Part G) with real distinct-session `pg_blocking_pids` blocking proofs: OP/Pedido
first-reference wins (racing model change rejected, route/identity stable), model
update wins (item rejected against the committed new identity, invalid Manta width
override rejected), non-contention (same-model references do not serialize; `nome` and
same-value routing updates permitted), and opposing item `modelo_id` moves with
ascending model locks — no `40P01`, both route and identity invariants preserved —
plus db/78/db/79 regression, finishing regression, and C5 emission regression. No
shared-development apply is authorized.

## Update 2026-07-24 — PHASE-MANTA-A shared-development application (db/78–db/80)

Order `PHASE-MANTA-A-SHARED-DEV-APPLY-LIVE-VALIDATION-AND-CLOSEOUT-R1` applied db/78, db/79
and db/80 — once each, in order — to shared development `ucrjtfswnfdlxwtmxnoo`
(PostgreSQL 17.6). This supersedes the "No shared-development apply is authorized" boundary
of the three sections above (which recorded the implementation-phase, local-only scope). No
new product or schema semantics are introduced beyond the already-accepted rules above.

Recorded in shared-development migration history, once and in order:
`78_manta_product_identity_and_route_foundation` (`20260724124419`),
`79_manta_product_identity_invariant_correction` (`20260724124522`),
`80_manta_model_reference_concurrency_correction` (`20260724124616`); terminal 77 → 80.

Verified live and read-only on shared development: `modelos.tipo_produto NOT NULL DEFAULT
'tapete'` with CHECK `('tapete','manta')`; Manta width CHECK
`tipo_produto <> 'manta' OR largura = 1.40`; uniqueness
`(nome, cor_1_id, cor_2_id, largura, tipo_produto)` (base 4-column key dropped); the
informal `MANTA ARABESCO`/1.40 row reclassified to `ARABESCO`/`manta`/1.40 with every other
model `tapete`; the `pedido_itens` Manta-width guard, the concurrency-safe `op_itens`
route-homogeneity guard and the `modelos` route-identity immutability guard present with the
db/80 model-row `FOR SHARE` lock bodies; `gerar_op_latex`/`gerar_op_latex_split` rejecting a
Manta or non-homogeneous origin; signatures, `SECURITY DEFINER`, `search_path=public` and
grants intact. The operational corpus stayed empty and `parametros_largura` and the
purchase-order cutover/config state were unmodified. Governing contract:
`MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` §9.

## Update 2026-07-24 — PHASE-MANTA-B1 (expedition source foundation, db/81)

`db/81_manta_expedition_source_foundation.sql` is a single forward-only, idempotent
migration adding the **dormant** foundation for Manta-sourced expeditions. Governing
contract: `MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md` (which owns the Manta direct-route
semantics; this section records only the schema/technical shapes). Order
`PHASE-MANTA-B1-EXPEDITION-SOURCE-FOUNDATION-R1`. No shared-development apply is
authorized by this order (local disposable clusters only). db/78–db/80 are not edited
(forward-only policy, §12).

Schema:

- `expedicoes.op_tecelagem_id BIGINT NULL REFERENCES public.ops(id) ON DELETE RESTRICT`
  — the second, typed expedition source (the Manta weaving OP).
- `expedicoes.op_latex_id` made **nullable**; its FK and `UNIQUE(op_latex_id)` are
  preserved (NULLs are distinct, so Manta rows may share a NULL `op_latex_id`).
- CHECK `expedicoes_exactly_one_source_chk`:
  `(op_latex_id IS NOT NULL) <> (op_tecelagem_id IS NOT NULL)` — exactly one source,
  never both, never neither. Existing rows (`op_latex_id` non-null) stay valid.
- Partial unique index `expedicoes_op_tecelagem_id_uk` on
  `op_tecelagem_id WHERE op_tecelagem_id IS NOT NULL` — one expedition per Manta
  weaving OP + the lookup path (no separate index added).

Authoritative guards (all `SECURITY DEFINER`, `search_path=public`, BEFORE triggers,
no partial write; the established `app.retificacao_autorizada` escape idiom, db/24/37):

- `expedicoes_source_validation_guard` — `op_latex_id` requires `ops.tipo='latex'`;
  `op_tecelagem_id` requires `ops.tipo='tecelagem'`, a non-empty OP, and every
  `op_item` resolving to `modelos.tipo_produto='manta'` (Tapete/mixed/empty rejected);
  serializes on affected source OP rows `FOR UPDATE` (ascending `op_id`); rejects an
  orphaning source change (except under the escape). Manta derived from
  `tipo_produto`, never a name; source stable under db/78–db/80.
- `expedicao_itens_membership_guard` — every `op_item_id` must belong to the
  expedition's selected source OP; cross-OP injection rejected; locks item OP + source
  OP `FOR UPDATE`, then the expedition. A `metros_entregues`-only UPDATE is untouched.
- `op_itens_expedicao_reference_guard` — rejects relocating (`op_id` change) an
  op_item referenced by an expedition (except under the escape); deletion already
  blocked by `expedicao_itens.op_item_id → op_itens ON DELETE RESTRICT`.
- `entrega_itens_manta_consumo_guard` — after consumption (Manta-sourced expedition,
  `metros_liberados > 0`), rejects UPDATE of `op_id`/`op_item_id`/`metros_entregues`/
  `defeito` and DELETE (except under the escape); composes with the db/24
  `entrega_itens_cima_latex_guard` (Latex-only), filling the Manta gap.
- `entregas_manta_consumo_guard` — rejects UPDATE/DELETE of an `entregas` header that
  owns consumed Manta output (except under the escape).
- `ops_manta_reopen_guard` — rejects a terminal→non-terminal `ops.status` transition
  of a consumed Manta weaving OP (except under the escape); inert before release, so
  db/21 `alterar_status_op` behavior is preserved; Tapete/`op_latex_id` OPs never match.

Lock order (reconciled with db/79/db/80 and db/31/db/32; ascending, no reversal):
`pedidos` → `ops` (`op_id` asc, `FOR UPDATE`) → `modelos` (`modelo_id` asc, `FOR SHARE`,
db/80 — not re-taken here) → `entregas`/`entrega_itens` → `expedicoes` →
`expedicao_itens`. `entregas.etapa='cima'`, `entregas_destino_cima_chk`,
`salvarEntregaCima`, `liberar_expedicao*` and `registrar_entrega_expedicao` are
unchanged; no new `entregas.etapa` value is created; Manta never enters finishing.
Migration terminal advanced 80 → 81 (`tests/ordem-compra-c3d-deploy.smoke.js`). Verified
on a disposable PostgreSQL 18.4 cluster
(`tests/manta-expedition-source.integration.sql`,
`tests/manta-expedition-source-invariant.mjs`): full db/01..81 apply, db/81 idempotent
re-apply with zero drift, all guards, C5/identity/finishing regressions, and
distinct-session concurrency (one expedition per Manta OP; item writes cannot cross
sources or overtake a source change; deterministic lock order, no `40P01`); cluster
destroyed with proof.

## Update 2026-07-24 — PHASE-MANTA-B1 correction (expedition source invariants, db/82)

`db/82_manta_expedition_source_invariant_correction.sql` (order
`PHASE-MANTA-B1-SOURCE-MEMBERSHIP-AND-LOCK-ORDER-CORRECTION-R1`) is a forward-only,
idempotent correction of three db/81 defects, editing neither db/78–db/81 nor any
schema shape (only three guard function bodies + one new trigger). Governing contract:
`MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md` §11. No shared-development apply is authorized
(local disposable clusters only). Migration terminal advanced 81 → 82.

- **Source immutable (A).** `expedicoes_source_validation_guard_fn` now rejects any
  UPDATE that changes `op_latex_id`/`op_tecelagem_id` BEFORE taking any source-OP
  lock, with no `app.retificacao_autorizada` bypass. This removes the
  `expedicoes`-row → `ops`-row lock inversion a source-changing UPDATE caused (the
  BEFORE-UPDATE target-row lock preceded the trigger's `ops` `FOR UPDATE`). The
  INSERT validation (latex XOR homogeneous non-empty Manta tecelagem; lock source OP)
  is unchanged. Status/timestamp/delivery UPDATEs take no lock.
- **Post-lock membership (B).** `expedicao_itens_membership_guard_fn` now locks the
  candidate source OP `FOR UPDATE` FIRST, then re-reads the (immutable) source and the
  current `op_itens.op_id` for `NEW.op_item_id`, validating with post-lock values only
  (an op_item that moved while the guard waited is rejected against its committed OP).
  It no longer locks the `expedicoes` row (the source cannot change), removing that
  row lock from the membership path.
- **Source non-empty (C).** New `op_itens_source_nonempty_guard` (BEFORE DELETE / on
  `op_id` change) locks the affected OP row(s) `FOR UPDATE` ascending, then, if
  `OLD.op_id` is a selected expedition source (`op_latex_id` OR `op_tecelagem_id`),
  rejects an operation that would leave that OP with zero items (counted under the
  lock, excluding the moved/deleted row). No escape for emptying a source. The db/81
  referenced-op_item protection (reference guard + FK `ON DELETE RESTRICT`) is
  retained; the db/37 controlled-delete cascade is unaffected (expedicoes are removed
  before the ops cascade).

Effective lock order (implicit target-row lock reconciled): affected source OP rows
ascending (`FOR UPDATE`) → immutable source read (no `expedicoes` row lock in the
membership guard) → expedition-item write. No source-changing `expedicoes` UPDATE
survives, so no `expedicoes`→`ops` path exists. Verified on a disposable PostgreSQL
18.4 cluster (`tests/manta-expedition-source.integration.sql` run unchanged;
`tests/manta-expedition-source-invariant.mjs` with distinct-session Tests A–H —
item-move-wins post-lock rejection, membership-insert-wins, source-change no-deadlock,
last-item move/delete rejected, concurrent-removal serialization, non-last removal
accepted, and the db/81 regressions): full db/01..82 apply, db/82 idempotent re-apply
zero drift, no `40P01`; cluster destroyed with proof.

## Update 2026-07-24 — PHASE-MANTA-B1 correction (source route + item identity, db/83)

`db/83_manta_expedition_source_identity_correction.sql` (order
`PHASE-MANTA-B1-SOURCE-ROUTE-AND-ITEM-IDENTITY-CORRECTION-R1`) is a forward-only,
idempotent correction completing the dormant B1 database foundation, editing
neither db/78–db/82 nor any schema shape (four guard function bodies + one new
trigger). Governing contract: `MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md` §12. No
shared-development apply is authorized (local disposable clusters only).
Migration terminal advanced 82 → 83.

- **Source OP type immutability (A).** New `ops_source_type_immutability_guard`
  (BEFORE UPDATE on `public.ops`) rejects any `ops.tipo` change while the OP is
  referenced by `expedicoes.op_latex_id` or `op_tecelagem_id`; same-value updates
  permitted; `ops.status` transitions untouched; no `app.retificacao_autorizada`
  bypass.
- **Source product route immutability incl. single-item (B).**
  `op_itens_route_homogeneity_guard_fn` now additionally requires every item of
  an OP already selected as an expedition source to resolve to the source's
  required `tipo_produto` (`op_latex_id`→tapete, `op_tecelagem_id`→manta),
  catching a single-item OP's sole item flipping type — a case the db/78–80
  mixing-only check could not catch (no "other" item to compare against). The
  `expedicoes` read is unlocked and race-free (the destination ops row is
  already held `FOR UPDATE`; a new source selection locks that same row first).
- **Expedition item identity alignment (C).**
  `expedicao_itens_membership_guard_fn`'s early-return now requires
  `op_item_id`/`expedicao_id`/`modelo_id`/`pedido_item_id` all unchanged before
  skipping validation (db/82 only checked the first two). When validation runs,
  it additionally requires `NEW.modelo_id = op_itens.modelo_id` and
  `NEW.pedido_item_id IS NOT DISTINCT FROM op_itens.pedido_item_id` against the
  post-lock op_item re-read — the proven canonical rule per repository evidence
  (every existing writer already sources both fields from the op_item's own
  row).
- **Referenced op_item identity immutability (D).**
  `op_itens_expedicao_reference_guard_fn` now protects `modelo_id` and
  `pedido_item_id` in addition to `op_id`; **no `app.retificacao_autorizada`
  bypass** for these three fields (removed by this correction). The db/37
  controlled-delete cascade is unaffected (it deletes `expedicao_itens` before
  `op_itens` is ever touched; `op_itens` is otherwise only removed via the
  `ops` `ON DELETE CASCADE`, never a direct UPDATE of a referenced row).

Reconciled lock order: affected `ops` rows ascending (`FOR UPDATE`) → affected
`modelos` rows ascending (`FOR SHARE`) → inspect selected expedition-source
references (unlocked, race-free) → validate source route + item identity →
continue the write. `op_itens` BEFORE-trigger firing order (alphabetical,
unchanged): reference guard (D) → route-homogeneity guard (B) →
source-nonempty guard (db/82 C). Blocker A takes no lock beyond the implicit
target-row lock an UPDATE already holds; Blocker D reuses the db/79/80/82
ops-ascending lock, so a concurrent Blocker-C membership insert and a
concurrent Blocker-A/D identity write always serialize on a single ops row —
no cross-guard deadlock is possible. Verified on a disposable PostgreSQL 18.4
cluster (`tests/manta-expedition-source.integration.sql` extended with
sequential proofs 20–36 for Blockers A–D; `tests/manta-expedition-source-invariant.mjs`
with distinct-session Tests I–L — source-model-change-wins,
membership-insert-wins, OP-type-change-vs-membership, two-identity-change
no-deadlock — plus the unchanged db/82 Tests A–H): full db/01..83 apply, db/83
idempotent re-apply zero drift, no `40P01`; cluster destroyed with proof.

## Update 2026-07-24 — PHASE-MANTA-B1 correction (Latex route symmetry + source lineage, db/84)

`db/84_manta_expedition_source_lineage_correction.sql` (order
`PHASE-MANTA-B1-SOURCE-LINEAGE-AND-LATEX-ROUTE-CORRECTION-R1`) is a
forward-only, idempotent correction completing PHASE-MANTA-B1, editing neither
db/78–db/83 nor any schema shape (a pre-flight data-validation DO block + four
guard function bodies + two new triggers). Governing contract:
`MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md` §13. No shared-development apply is
authorized (local disposable clusters only). Migration terminal advanced 83 → 84.

- **Pre-existing data gate.** Before installing the corrected guards, every
  existing `expedicoes` row is validated against the widened invariants
  (source OP existence/type, non-emptiness, required product type, source
  lineage existence/consistency, header lineage match); any violation aborts
  the migration with no repair. Trivial on an empty corpus.
- **Symmetric Latex route (A).** `expedicoes_source_validation_guard_fn`'s
  Latex branch now requires non-emptiness and homogeneous `tipo_produto=
  'tapete'`, mirroring the Manta branch exactly.
- **Source lineage (B).** For either source type, `ops.lote_id` →
  `lotes.pedido_id`/`lotes.cliente_id` → `pedidos.cliente_id` must exist and
  be mutually consistent, and the expedition payload
  (`lote_id`/`pedido_id`/`cliente_id`) must match it exactly (NULL or
  divergent lineage rejected, no silent rewrite).
- **Expedition lineage immutability (C).** `pedido_id`/`lote_id`/`cliente_id`
  join the db/82-immutable source columns: any UPDATE changing any of the five
  is rejected before any lock, no retificacao bypass.
- **Source OP lineage immutability (D).**
  `ops_source_type_immutability_guard_fn` now also protects `ops.lote_id`
  (previously `tipo` only) while the OP is a selected source.
- **Lote lineage immutability (E).** New
  `lotes_source_lineage_immutability_guard_fn` protects `pedido_id`/
  `cliente_id` while the Lote is referenced by a selected-source OP; unlocked
  `EXISTS`, no source-OP lock requested.
- **Pedido client immutability (F).** New
  `pedidos_source_lineage_immutability_guard_fn` protects `cliente_id` while
  the Pedido participates (via a Lote) in a selected-source OP's lineage;
  same unlocked design.

DELETE/FK evidence: `ops.lote_id`/`expedicoes.lote_id` (`ON DELETE SET NULL`
from `lotes`) and `lotes.pedido_id` (`ON DELETE SET NULL` from `pedidos`) are
unchanged — Postgres implements `SET NULL` as a real UPDATE against the
referencing table, so deleting a source Lote/Pedido now fails closed via
D/C/E instead of silently nulling the lineage; the source client stays
blocked by the pre-existing `ON DELETE RESTRICT` FKs. No FK action was
altered. Reconciled lock order: source `ops` (`FOR UPDATE`) → source `lotes`
(`FOR SHARE`) → source `pedidos` (`FOR SHARE`) → affected `modelos` ascending
(`FOR SHARE`) → lineage/route reads → insert; the new Lote/Pedido guards take
no source-OP lock, so no cross-guard deadlock is structurally possible.
Verified on a disposable PostgreSQL 18.4 cluster
(`tests/manta-expedition-source.integration.sql` extended with sequential
proofs 37–57; `tests/manta-expedition-source-invariant.mjs` with
distinct-session Tests M–R — lineage-insert-wins vs Lote/Pedido update,
Lote/Pedido-update-wins, OP-lote-change-vs-insert, independent-source
non-serialization — plus the unchanged db/82/db/83 Tests A–L): full db/01..84
apply, db/84 idempotent re-apply zero drift, no `40P01`; cluster destroyed
with proof.

## Update 2026-07-24 — PHASE-MANTA-B1 applied and verified in shared development (db/81–84)

Order `PHASE-MANTA-B1-SHARED-DEV-APPLY-LIVE-VALIDATION-AND-CLOSEOUT-R1`:
db/81_manta_expedition_source_foundation.sql, db/82_manta_expedition_source_invariant_correction.sql,
db/83_manta_expedition_source_identity_correction.sql and
db/84_manta_expedition_source_lineage_correction.sql were applied once, in
order, to shared development `ucrjtfswnfdlxwtmxnoo` (versions `20260724194841`,
`20260724195045`, `20260724195311`, `20260724195540`; terminal advanced
80 → 84), through the dedicated project-scoped migration mechanism — no file
combined or modified, no shared-dev DDL retry. Governing contract:
`MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md` §14, which owns the full live
schema/guard/lineage evidence, the rolled-back distinct-session-equivalent
validation (8 mandatory proofs), and the zero-business-data/dormant-foundation
evidence. This section records only that the schema shapes and function
bodies described in the db/81–84 update sections above (this file) are now
live and byte-verified on shared development: `pg_get_functiondef` on
`expedicoes_source_validation_guard_fn` matched the committed db/84 source
exactly; all ten guard triggers are present and fire in the documented
alphabetical order on `ops`/`op_itens`/`lotes`/`pedidos`; the operational
corpus stayed empty throughout. No staging or production apply is authorized
by this order.

## Update 2026-07-24 — PHASE-MANTA-B2 activation contract (schema preview, nothing implemented)

Order `PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1` (documentation-only). Governing
owner of the activation semantics:
`docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md`. **No migration
was created or applied**; shared development remains at terminal `84`. This
section records only the schema shapes that PHASE-MANTA-B2A is contracted to
create, so that the shapes have a canonical technical owner before
implementation.

**db/85 — route-conditional `cima` delivery.**

| Object | Exact contract |
|---|---|
| `entregas_destino_cima_chk` | **Dropped.** The route is not derivable from an `entregas` row (no item exists at header INSERT), so no row CHECK can express it. |
| `entrega_itens_cima_route_destino_guard` | BEFORE INSERT, and BEFORE UPDATE of `op_id`/`op_item_id`, on `public.entrega_itens`. `SECURITY DEFINER`, `SET search_path = public`. When the parent `entregas.etapa='cima'`: lock the item's `ops` row FOR UPDATE, resolve the route through `op_itens → modelos.tipo_produto` (never a name), then require `destino_fornecedor_id IS NOT NULL` for `tapete` and `IS NULL` for `manta`. No `app.retificacao_autorizada` bypass. |
| `entregas_cima_destino_route_guard` | BEFORE UPDATE of `destino_fornecedor_id`/`etapa` on `public.entregas`. Re-derives the route from existing items under the same lock order and re-applies the same rule. No bypass. |
| `registrar_entrega_cima_manta(BIGINT, BIGINT, DATE, JSONB, TEXT)` | New admin-only `SECURITY DEFINER` RPC; the only Manta `cima` writer. Locks the weaving OP FOR UPDATE, proves `ops.tipo='tecelagem'` and full Manta homogeneity, writes the header (`etapa='cima'`, `destino_fornecedor_id = NULL`) and its `entrega_itens` atomically, and never calls `gerar_op_latex`/`_split`. |

`salvarEntregaCima`, `gerar_op_latex`, `gerar_op_latex_split`,
`op_latex_entregas` and the whole Tapete `cima` path are unchanged; the guards,
not the writer, make the invariant writer-agnostic.

**db/86 — Manta expedition release.**

| Object | Exact contract |
|---|---|
| `consultar_saldo_expedicao_manta(BIGINT)` | Read RPC mirroring `consultar_saldo_expedicao_latex`, per `op_item`: `previsto` (display only), `recebido`, `liberado`, `entregue`, `disponivel`. |
| `liberar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT)` | Admin-only writer. Availability = non-defect `entrega_itens.metros_entregues` on `entregas.etapa='cima'` joined **`op_item_id`-exact** (never `modelo_id`, unlike the Latex path) minus `SUM(expedicao_itens.metros_liberados)`. Planned `COALESCE(metros_ajustados, metros_pedidos)` is never an authority. Creates or reuses the unique expedition for the OP; upserts items additively on `(expedicao_id, op_item_id)`; copies `modelo_id`/`pedido_item_id` verbatim from the referenced `op_item` so db/83's identity alignment passes by construction; rejects overconsumption; returns per-item before/after balances. |
| `public.expedicao_comandos` | Idempotency/replay table modelled byte-for-byte on §13.2: `id BIGSERIAL PK`; `idempotency_namespace TEXT NOT NULL CHECK (… IN ('manta_release_v1','manta_reversal_v1'))`; `ator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`; `idempotency_key TEXT NOT NULL` (trimmed 1–200); `comando_payload JSONB NOT NULL`; `comando_hash TEXT NOT NULL`; `resultado JSONB NOT NULL`; `criado_em TIMESTAMPTZ NOT NULL DEFAULT now()`; UNIQUE `(idempotency_namespace, ator_id, idempotency_key)`; RLS admin-only; no client DML; immutable after insert; **no FK to expedition rows**; permanent retention. A NULL key preserves the legacy additive behavior and writes no command row. |

**db/87 — reversal and route-symmetric completion.**

| Object | Exact contract |
|---|---|
| `estornar_expedicao_manta_parcial(BIGINT, JSONB, TEXT, TEXT)` | Admin-only. `p_motivo` **mandatory** (rejects NULL/blank, persists `btrim`), per the `db/70` `estornar_recebimento_ordem_compra` precedent. Locks source `ops` → `expedicoes` → `expedicao_itens` ascending. Rejects `requested > metros_liberados` and `metros_liberados - requested < metros_entregues` (the pre-existing `CHECK (metros_entregues <= metros_liberados)` is the storage backstop). Deletes an item reaching zero (the pre-existing `CHECK (metros_liberados > 0)` forbids a zero row); keeps the expedition header, whose source and lineage are immutable and one-per-OP. Never deletes `expedicao_movimentos`/`expedicao_movimento_itens`. |
| `concluir_pedido_se_pronto(UUID)` | **Forward-corrected (mandatory).** Its `v_latex_sem_exp` check currently joins only `o.tipo='latex'` on `e.op_latex_id`, so a Manta-only Pedido with a terminal weaving OP and **no expedition at all** satisfies every pendency and is marked `entregue`. The corrected rule is route-symmetric: every terminal source OP — a `latex` OP for Tapete, a Manta `tecelagem` OP for Manta — must have an expedition through its matching source column, every expedition of the Pedido must be `concluida`, and unreleased non-defect measured Manta output is a pendency. Tapete pendency texts and behavior preserved verbatim. |

No guard installed by db/81–db/84 is relaxed by any of the three migrations, and
no `app.retificacao_autorizada` is granted to any authenticated writer: the
db/81 consumption guards are inert at zero consumption by their own existing
condition, which is what makes correction-after-full-reversal legal without a
schema change.

**Grants/RLS.** `GRANT EXECUTE … TO authenticated` plus `REVOKE EXECUTE … FROM
PUBLIC, anon` on the new functions only (strictly narrower than the existing
Latex RPCs, which are unchanged). RLS unchanged on `expedicoes`,
`expedicao_itens`, `expedicao_movimentos`, `expedicao_movimento_itens`,
`entregas` and `entrega_itens`. No table grant is broadened; no new direct table
write is introduced. `tests/ordem-compra-c3d-deploy.smoke.js` advances
84 → 85 → 86 → 87, one bump per migration commit.

## Update 2026-07-24 — PHASE-MANTA-B2A implemented (db/85, db/86, db/87)

Order `PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1` (bounded backend implementation;
local disposable PostgreSQL only). The three shapes previewed in the preceding
section are now **implemented and locally/concurrently verified**; the owner of
the activation semantics and of the full implementation record is
`docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md` §15. **No migration
was applied to any environment**; shared development `ucrjtfswnfdlxwtmxnoo`
remains at terminal `84`. This section records only the deltas between the
preview and the created objects, so the technical owner stays exact.

**Created exactly as previewed**, with these clarifications:

| Object | Implemented detail worth recording |
|---|---|
| `entrega_itens_cima_route_destino_guard` | Coverage widened, per the B2A order, from `op_id`/`op_item_id` to **also** an `entrega_id`-changing UPDATE — moving an item into another delivery changes its parent route/destination context. It additionally proves the op_item exists, belongs to the declared `op_id`, and that the source OP is non-empty and route-homogeneous, and it rejects a NULL `op_item_id` on a `cima` parent (the route is not derivable without it). It requests an `ops` FOR UPDATE lock **only on INSERT** and an `entregas` FOR SHARE lock **only when the parent changes**; see R-I/R-II below. |
| `entregas_cima_destino_route_guard` | Requests **no** `ops` lock and **no** `entrega_itens` row lock; it re-derives the route from every existing item under plain unlocked committed reads (the db/84 BLOCKER E/F idiom), relying on its own target-row lock conflicting with the item side's explicit FOR SHARE. |
| `registrar_entrega_cima_manta` | Normalizes duplicate payload entries per **`(op_item_id, defeito)`**, not per `op_item_id` alone: the defect flag is part of the measured identity, so collapsing across it would destroy information. The weaving supplier is carried by the existing canonical `entregas.fornecedor_id`; `entrega_itens` has no `pedido_item_id` column, so commercial identity is preserved through `op_item_id` and echoed in the return and event payloads. |
| `public.expedicao_comandos` | Created exactly as contracted, plus an `(ator_id, criado_em DESC, id DESC)` index, an admin-only `SELECT` policy, and `expedicao_comandos_immutable_guard` rejecting UPDATE and DELETE with **no** `app.retificacao_autorizada` bypass. |
| `liberar_expedicao_manta_parcial` / `estornar_expedicao_manta_parcial` | The canonical request JSON is derived **only from the arguments** (namespace, target id, observacao/motivo, and per-`op_item_id` aggregated metres rendered as fixed 2-decimal text), so `20` and `20.00` are the same request. The `pg_advisory_xact_lock` over `(namespace, actor, key)` is taken **before any table row lock**, which is what makes a losing duplicate retain no mutation to discard. |
| `concluir_pedido_se_pronto` | Corrected exactly as contracted and additionally takes the Pedido row `FOR UPDATE` for the completion mutation, locking nothing else. Two new pendency messages: `Ha tecelagem Manta finalizada sem expedicao` and `Ha saida de tecelagem Manta medida sem liberacao para expedicao`. Every existing Tapete message, the return shape, the signature, the authorization and the grants are preserved verbatim. |

**New indexes** (db/86, access paths for the `op_item_id`-exact balance join):
`entrega_itens_op_item_idx` on `public.entrega_itens(op_item_id)` and
`expedicao_itens_op_item_idx` on `public.expedicao_itens(op_item_id)`.

**Lock-order rules now binding on any future writer touching these tables.**
PostgreSQL takes an UPDATE/DELETE target-row lock *before* the BEFORE-ROW trigger
body runs, so a guard that then locks another table inverts the global order.

- **R-I** — no path may hold a `public.entrega_itens` row lock and then request a
  `public.ops` row lock. (This is why the item guard locks `ops` only on INSERT.)
- **R-II** — no path may hold a `public.entregas` row lock and then request a
  `public.ops` row lock.
- Consequently the Manta expedition writers acquire the source `entrega_itens`
  rows **while holding `ops`**, never the reverse, which is what serializes
  release versus output correction in both directions without a cycle.

Global order: `pedidos` FOR UPDATE (completion only, acquires nothing else) →
`ops` asc FOR UPDATE → `lotes` FOR SHARE → `pedidos` FOR SHARE → `modelos` asc
FOR SHARE (always a leaf) → `entregas`/`entrega_itens` → `expedicoes` →
`expedicao_itens` asc; the idempotency advisory lock precedes every table row
lock. Verified on a disposable PostgreSQL 18.4 cluster with fifteen
distinct-session proofs and `pg_stat_database.deadlocks = 0`; all three
migrations re-apply with zero schema, constraint, trigger, index, function-body,
grant and RLS drift.

## Update 2026-07-24 — PHASE-MANTA-B2A forward correction (db/88)

Order `PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-FK-LOCK-CORRECTION-R1`.
`db/88_manta_measured_output_identity_and_fk_lock_correction.sql` forward-corrects
db/85–db/87 without editing them. **No migration was applied to any
environment**; shared development `ucrjtfswnfdlxwtmxnoo` remains at terminal `84`.
Owner of the full record: `MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md` §16.

| Object | Corrected contract |
|---|---|
| `entrega_itens_cima_route_destino_guard_fn` | `modelo_id` becomes a trigger-relevant identity field, so a **modelo_id-only UPDATE no longer escapes the early return**. Route-conditional model rule: on a **Manta** `cima` item `modelo_id` is MANDATORY and must equal `op_itens.modelo_id` exactly; on a **Tapete** `cima` item a SUPPLIED `modelo_id` must equal it exactly while NULL stays valid. `public.entrega_itens.modelo_id` is nullable by design (`CHECK (op_item_id IS NOT NULL OR modelo_id IS NOT NULL)` — the alternative identifier for legacy item-less-op rows, not a mandatory mirror), and the live Tapete writer never sends it, so an unconditional non-null match would reject every Tapete delivery. Identity on `cima` is already fully determined by the `op_item_id` db/85 makes mandatory. Nothing is ever silently rewritten. |
| `op_itens_manta_output_reference_guard` (NEW) | BEFORE UPDATE on `public.op_itens`. While the op_item is referenced by Manta measured output (`entrega_itens` under an `etapa='cima'` header, route derived from the op_item's own `modelos.tipo_produto`), `op_id`, `modelo_id` and `pedido_item_id` are immutable. Same-value and quantity updates stay permitted; unrelated op_items and Tapete are unaffected; no `app.retificacao_autorizada` bypass; DELETE stays covered by the FK `ON DELETE RESTRICT`. It takes the affected OP rows `FOR UPDATE` ascending before inspecting, because op_itens triggers fire alphabetically and it runs before the db/80 guard that would take that lock. |
| `expedicao_itens_membership_guard_fn` | Unchanged db/82 membership and db/83 identity checks, now with the referenced op_item locked `FOR KEY SHARE` **before** the source OP. Protects direct `expedicao_itens` writes as well as the RPC path. |
| `registrar_entrega_cima_manta` | Parses/normalizes without mutation, locks every distinct requested op_item `FOR KEY SHARE` ascending **before** the source OP, then re-reads each one post-OP-lock and proves its exact `op_id`, `modelo_id`, `pedido_item_id` and Manta route. Signature, grants, authorization, return shape and event semantics preserved; still never calls a finishing writer. |
| `liberar_expedicao_manta_parcial` | Advisory lock → op_items `FOR KEY SHARE` ascending → source OP → existing lineage/output/expedition locks → post-lock membership and identity re-read → unchanged release semantics. Balance formula, `op_item_id`-exact measurement, idempotency behavior, return shape, event and grants preserved; Tapete writers untouched. |

**Corrected global lock order (supersedes the db/86 list).** The analysis now
includes the **implicit** `FOR KEY SHARE` row lock taken by
`entrega_itens.op_item_id → op_itens.id` and
`expedicao_itens.op_item_id → op_itens.id`:

```
1. pg_advisory_xact_lock (idempotency identity), when a key is supplied
2. public.op_itens rows, ascending id, FOR KEY SHARE
3. source public.ops rows, ascending id, FOR UPDATE
4. source public.lotes FOR SHARE, then source public.pedidos FOR SHARE
5. public.modelos rows, ascending id, FOR SHARE (always a leaf)
6. public.entregas / public.entrega_itens
7. public.expedicoes
8. public.expedicao_itens, ascending id
```

- **R-III (new, binding)** — every Manta path must acquire the referenced
  `op_itens` row(s) **before** the source `ops` row, in `FOR KEY SHARE`. A DELETE
  or UPDATE of an op_item already owns that row's target lock before its
  BEFORE-ROW triggers request the OP, so `op_item → OP` is fixed by PostgreSQL
  and cannot be reversed; db/85–87 had the opposite direction and were cyclic.
  `FOR KEY SHARE` is the exact mode: it conflicts with `FOR UPDATE` (a concurrent
  DELETE blocks and is then refused) but not with `FOR NO KEY UPDATE` (a non-key
  identity UPDATE proceeds to the shared `ops` serialization point instead of
  deadlocking), and the post-OP-lock re-read decides the winner.
- **R-I and R-II (db/85) stand unchanged**: the item guard still takes `ops` only
  on INSERT, and the header guard still takes neither `ops` nor an
  `entrega_itens` row lock.

**Residual, recorded, not introduced by db/88.** A direct
`UPDATE entrega_itens SET op_item_id = …` (or the same on `expedicao_itens`)
inherently holds its own row lock and then takes the FK's `FOR KEY SHARE` on the
op_item. It cannot cycle with the Manta writers, which hold the op_item only in
`FOR KEY SHARE` — compatible with the FK's own request — and no product writer
re-points `op_item_id`. The pre-existing Tapete writer `db/32` takes
`ops FOR UPDATE` then `op_itens FOR UPDATE`; that is its own accepted behavior on
a non-Manta path and db/88 adds no edge to it.

Verified on a disposable PostgreSQL 18.4 cluster: db/01..88 clean apply; 80
sequential proofs; 21 distinct-session proofs with
`pg_stat_database.deadlocks = 0`; re-applying db/85..db/88 **in order** returns
the fingerprint exactly, and db/88 also re-applies standalone with zero drift.

## Update 2026-07-25 — KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02 (Pedido commercial date and controlled numbering, db/89)

Order `KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1`. Applied once to shared
development `ucrjtfswnfdlxwtmxnoo`, advancing its terminal from `db/88` to `db/89`.
Forward-only; `db/01`–`db/88` are untouched.

### public.pedidos.data_pedido — the commercial order date

```
data_pedido DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
```

`data_pedido` is a BUSINESS fact: the date the operator states for the order, and
which the operator may correct later. It is **not** the technical creation instant.

`criado_em` remains the immutable technical timestamp and **must never again be
read as the commercial date**. Any surface that needs the commercial date reads
`data_pedido` explicitly; deriving it from `criado_em` is prohibited.

Both the default and the backfill project onto the **Brazil business calendar**
(`America/Sao_Paulo`) rather than UTC. This is not cosmetic: a Pedido created at
22:00 in São Paulo is 01:00 the next day in UTC, so `CURRENT_DATE` or
`criado_em::date` would file it under the wrong business day. Existing rows were
backfilled with `(criado_em AT TIME ZONE 'America/Sao_Paulo')::date`, which is the
only interpretation that reproduces the date the operator actually saw. The
backfill statement touches only rows still `NULL`, so re-applying the migration
never overwrites a date an operator has since corrected.

Note the homonym: `public.ordens_compra_fio.data_pedido` (db/01) already exists and
means "yarn purchase-order date". The architect ruled explicitly that this is **not**
a collision — column names are table-scoped and both meanings are clear in their
owning tables. Neither column references the other.

### public.pedidos.numero — controlled commercial identity

`numero` keeps its `GENERATED BY DEFAULT AS IDENTITY` definition and its `UNIQUE`
constraint, so an operator may state a number explicitly at creation. db/89 adds the
three controls that identity alone does not provide:

1. **Positivity** — `pedidos_numero_positivo_chk CHECK (numero > 0)`.
2. **Immutability** — `pedidos_numero_immutability_guard` (BEFORE UPDATE, with
   `WHEN (NEW.numero IS DISTINCT FROM OLD.numero)`) refuses any UPDATE that changes
   `numero`, raising `23514`. A same-value UPDATE does not even fire the trigger.
   There is no bypass GUC: no UI path and no direct DML may renumber an existing
   Pedido.
3. **Sequence synchronization** — `pedidos_numero_sequence_sync` (AFTER INSERT)
   advances the identity sequence when an inserted explicit number exceeds its
   current value.

Why (3) is required: `GENERATED BY DEFAULT AS IDENTITY` lets an INSERT supply its
own value **without consuming the sequence**. An operator who creates Pedido 5000 by
hand therefore leaves the sequence at, say, 41; automatic numbering then walks 42,
43, … and eventually reaches 5000 and fails on `UNIQUE(numero)` — a failure that
surfaces years later, to a different user, with no visible relation to its cause.
Synchronizing forward at insert time converts that latent collision into a gap.

Numbering guarantees, stated explicitly:

- The sequence **never moves backwards**. An explicit LOW unused number leaves it
  untouched, so numbers already issued automatically are never re-issued.
- Numbering is **increasing, not gapless**. Gaps arising from rollback, compensation
  or an explicit high number are accepted by design. Gapless numbering is **not**
  attempted; it would require serializing every Pedido creation.
- `UNIQUE(numero)` remains the **final concurrency backstop**. Two concurrent inserts
  of the same explicit number produce exactly one Pedido; the loser receives `23505`
  regardless of any advisory lock.

The synchronizer takes `pg_advisory_xact_lock` first and locks no table row, so it is
a LEAF in the global lock order established by db/88 and adds no new edge.

### Application boundary

`pedido_itens` is unchanged. It still stores exactly `pedido_id`, `modelo_id`,
`metros`, `ordem` and `observacao`. The product type is **never** persisted
redundantly: `modelo_id` remains the only product identity, and the route continues
to be derived from `modelos.tipo_produto` reached through it.

Consumers must treat the absence of `modelos.tipo_produto` as **fail-closed**: a
model whose type cannot be resolved belongs to no route and must not be offered.
Degrading unknown models to Tapete is prohibited — it would place a Manta on the
finishing route unnoticed.

## Update 2026-07-25 — KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-03 (next Pedido number suggestion, db/90)

Applied once to shared development `ucrjtfswnfdlxwtmxnoo`; terminal advanced
`db/89 -> db/90`. Forward-only; `db/01`-`db/89` untouched.

### Added object

```
public.consultar_proximo_numero_pedido() RETURNS BIGINT
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
```

This migration adds **only** this function. No table, column, constraint,
trigger, policy, existing function, existing grant or row is changed.

### Semantics

The function answers exactly one question: *which number would the next
automatic Pedido receive right now?* It exists so the admin creation screen can
open with that number already visible and editable, instead of an empty
`Automático` placeholder.

The candidate is derived from the identity sequence state:

- `pg_sequence_last_value(pg_get_serial_sequence('public.pedidos','numero'))`;
- `seqincrement` and `seqstart` from `pg_catalog.pg_sequence`.

`pg_catalog.pg_sequence` is read instead of the `pg_sequences` view because the
view filters rows by caller privilege while the catalog returns the real
definition. A sequence that has never been read returns `NULL` from
`pg_sequence_last_value` (`is_called = false`); that case correctly yields
`seqstart`, not `seqstart + seqincrement`.

### `MAX(numero) + 1` is forbidden

`MAX(pedidos.numero) + 1` is **not** authoritative and must never be used as a
substitute, in this function or in any consumer. It is wrong on three paths this
schema deliberately allows:

1. an explicit HIGH manual number advances the sequence through the db/89
   `pedidos_numero_sequence_sync` trigger, so the sequence can sit far ahead of
   any surviving row;
2. a rolled-back or compensated creation consumes a sequence value that no row
   will ever carry, so `MAX(numero)` lags permanently;
3. numbering gaps are accepted by design (db/89), so `MAX+1` would try to refill
   a gap the sequence has already passed — colliding with nothing today and with
   a real Pedido tomorrow.

### Observation only: no reservation, no consumption

The function never calls `nextval`, `setval` or `currval`. Reading the sequence
state does not advance it, so opening the creation form consumes no Pedido
number however many forms are abandoned. N consultations leave the sequence
exactly where 0 consultations would.

The returned value is an **advisory candidate**, not a reservation. Nothing is
locked. `UNIQUE(pedidos.numero)` remains the authority, exactly as established
by db/89, and resolves any race with `23505`.

### Required consumer behavior on conflict

A consumer that submits the suggested number and receives `23505` must not
silently allocate a different one. Two distinct paths are required:

- **the suggestion was not edited** — request a fresh candidate, display it, and
  tell the operator which number became occupied and which replaced it. The
  Pedido is not created; the operator submits again.
- **the operator typed the number** — preserve the typed value and report
  `Este número de pedido já está em uso.`

If the function is unavailable, the consumer must degrade to an empty field and
automatic identity allocation. Falling back to `MAX(numero)` is prohibited.

### Authorization

- `SECURITY DEFINER`, owner `postgres`, `SET search_path = public`;
- the body requires `public.is_admin()` and otherwise raises `42501`;
- `EXECUTE` revoked from `PUBLIC` and from `anon`, granted to `authenticated`.

Applied ACL on shared development:
`postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres`.
`service_role` retains `EXECUTE` from the Supabase project default; it is not an
escape hatch, because the body still requires an admin JWT.

The Pedido number is internal. No client-facing surface may display it or call
this function.

### Fail-closed prerequisites

The migration refuses to install if `public.is_admin()` is absent, if
`public.pedidos.numero` has no identity sequence, or if the db/89
`pedidos_numero_positivo_chk` constraint is absent.

## Update 2026-07-29 — Unified Pedido Editing and Client Change Approval Design R1

Order `PEDIDO-UNIFIED-EDIT-AND-CLIENT-CHANGE-APPROVAL-DESIGN-R1`.
`RISK_CLASS: R3`. `EXECUTION_PROFILE: ASSURANCE`.
Mode: read-only product/schema/security reconciliation plus binding contract.
Nothing in this section is implemented. No migration, RPC, policy, screen or
database object was created, altered or applied by the order that wrote it.

This section is normative for the unified Pedido editors and for the client
change-request and administrative approval workflow. It does not restate,
amend or supersede any earlier section of this document.

### U1. Reconciled current behavior (evidence)

Every statement below was verified against tracked files or against read-only
introspection of the definitive production project `ucrjtfswnfdlxwtmxnoo`
(terminal applied migration `db/91`).

#### U1.1 Routing and screens

| Route | Owner | Roles | Nature |
| --- | --- | --- | --- |
| `#/pedidos/novo` | `js/screens/pedido-form.js` | admin | Complete creation: general data, item table, detailed item modal, quick row, priority panel, instructions, checkout |
| `#/pedidos/<uuid>` | `js/screens/pedido-detail*.js` | admin | Read-oriented hub |
| `#/pedidos/<uuid>/editar` | `js/screens/pedido-edit.js` | admin | **Partial**: one `max-width:768px` card, four writable fields |
| `#/pedidos/<uuid>/itens` | `js/screens/pedido-itens-edit.js` | admin | Separate complete item editor |
| `#/cliente/pedidos/novo` | `js/screens/cliente-pedido-form.js` | cliente | Complete creation |
| `#/cliente/pedidos/<uuid>` | `js/screens/cliente-pedido-detail.js` | cliente | Read-only, plus the priority RPC |

`js/router.js:77-99` resolves `/editar` and `/itens` as two independent
`roles: ['admin']` matches. `js/screens/pedido-detail-events.js:2430-2472`
dispatches to one or the other from the same warning modal, so the
administrative editing intent is already split across two screens at the call
site. There is **no** client edit route of any kind.

#### U1.2 What each editor writes today

`js/screens/pedido-edit.js:403-416` — `UPDATE public.pedidos` with exactly
`cliente_id`, `data_pedido`, `prazo_entrega`, `observacao`. `numero` and
`status` are never in the payload; `numero` is additionally rendered
`readonly` and `disabled` (`js/screens/pedido-edit.js:253-260`).

`js/screens/pedido-itens-edit.js` — `UPDATE` (`modelo_id`, `metros`,
`observacao`, `ordem`), `INSERT` and `DELETE` on `public.pedido_itens`, with
`ordem` normalized to array position inside `salvar()`. It is explicitly
non-transactional: a partial failure leaves earlier steps applied and is not
compensated.

Both screens gate on `window.isPedidoEditavel` (`js/pedido-ui.js:211-216`),
whose editable set is exactly `['rascunho', 'recebido']`.

The client writes nothing after creation except
`public.definir_prioridade_pedido()` through
`js/screens/cliente-pedido-detail.js:887-960`. Neither
`cliente-pedido-detail.js` nor `cliente-pedidos-list.js` contains any
`update`, `insert` or `delete`.

#### U1.3 Live security posture (proved, not assumed)

RLS is enabled on `pedidos`, `pedido_itens`, `pedido_eventos`,
`pedido_cliente_eventos` and `pedido_prioridade_eventos`.

1. **The client has no `UPDATE` policy on `public.pedidos`.** The only client
   policies are `pedidos_cliente_select` (`SELECT`,
   `cliente_id = meu_cliente_id()`) and `pedidos_cliente_insert` (`INSERT`,
   `cliente_id = meu_cliente_id() AND status IN ('rascunho','recebido')`).
2. **The client has exactly one mutation policy on `public.pedido_itens`:**
   `pedido_itens_cliente_insert` (`INSERT`), whose `WITH CHECK` requires the
   parent Pedido to belong to the caller **and** to be in
   `('rascunho','recebido')`. There is **no** client `UPDATE` and **no**
   client `DELETE` policy. A client may therefore append an item to its own
   unaccepted Pedido through the raw API today, but can neither modify nor
   remove one. No UI exposes this; the asymmetry is closed by U9.
3. **No change-request or approval structure exists.** The only tables whose
   names resemble one — `document_link_revisions`,
   `document_link_revision_ops` — belong to the documents domain and carry no
   Pedido revision semantics.
4. Table-level grants on these tables are the broad Supabase role defaults;
   they are **not** the access boundary. RLS is. Every statement in this
   contract about what a client can write is a statement about policies, never
   about grants.
5. `service_role` is not exposed to any application surface, and no `anon`
   path reaches Pedido mutation.

#### U1.4 Existing guards this design must not duplicate or bypass

| Guard | Object | Effect |
| --- | --- | --- |
| `pedidos_numero_immutability_guard` | `pedidos` | Rejects any `UPDATE` changing `numero` (`23514`). No bypass GUC. |
| `pedidos_numero_positivo_chk` | `pedidos` | `numero > 0` |
| `pedidos_numero_sequence_sync` | `pedidos` | Forward-only identity sequence sync after `INSERT` |
| `pedidos_prioridade_direct_write_guard` | `pedidos` | Priority columns writable **only** through `definir_prioridade_pedido()` (`42501`) |
| `pedido_itens_ordem_direct_write_guard` | `pedido_itens` | `ordem` writable only through `definir_prioridade_pedido()`; `is_admin()` and non-`anon`/`authenticated` roles are exempt |
| `pedidos_prioridade_acceptance_gate` | `pedidos` | Refuses the transition **to** `confirmado` while `prioridade_status = 'solicitada'` |
| `assert_pedido_prioridade_revisada()` | function | Refuses OP generation while a priority request is unreviewed |
| `pedidos_source_lineage_immutability_guard` | `pedidos` | `cliente_id` immutable once a lote of the Pedido feeds an expedition-source OP. No bypass. |
| `pedido_itens_manta_largura_guard` | `pedido_itens` | Manta width invariant |
| `pedido_itens_largura_check` | `pedido_itens` | `largura IN (1.40, 2.10)` or NULL |
| `pedido_itens_metros_check` | `pedido_itens` | `metros > 0` |

### U2. Authoritative acceptance boundary

**`public.pedidos.status = 'confirmado'` is the administrative-acceptance
boundary.** This is not an interpretation of convenience; four independent
owners already encode it:

1. `pedidos_prioridade_acceptance_gate` fires precisely on
   `NEW.status = 'confirmado' AND OLD.status IS DISTINCT FROM 'confirmado'`
   and names the event *"antes de aceitar o Pedido"*.
2. `definir_prioridade_pedido()` raises `PEDIDO_PRIORITY_CLIENT_LOCKED` —
   *"o Pedido ja foi aceito pela equipe"* — for any client call where
   `status <> 'recebido'`.
3. `pedidos_cliente_insert` and `pedido_itens_cliente_insert` both stop
   admitting client rows once `status` leaves `('rascunho','recebido')`.
4. `window.isPedidoEditavel` opens editing for exactly
   `('rascunho','recebido')`.

`status_cliente_visual` is **not** the acceptance boundary and must never be
read as one; per `PORTAL_B2B_ARCHITECTURE_RULES.md` §3 it is the published
external communication field and is deliberately decoupled from the
operational status.

The declared lifecycle is
`rascunho → recebido → confirmado → produzindo → entregue | cancelado`
(`pedidos_status_check`). `entregue` and `cancelado` are terminal.

### U3. Canonical expected-delivery field

**`public.pedidos.prazo_entrega` is the authoritative expected-delivery
field. `public.pedidos.prazo_desejado` is dormant legacy.**

Evidence:

- Both creation screens persist `prazo_entrega`
  (`js/screens/pedido-form.js:745`, `js/screens/cliente-pedido-form.js:1010`),
  both under the visible label *"Prazo desejado"*.
- No file under `js/` writes `prazo_desejado`. Its only appearances are in
  `SELECT` lists and in the read fallback
  `pedido.prazo_desejado || pedido.prazo_entrega`
  (`js/screens/pedido-detail-render.js:162,281`).
- Live production: `prazo_desejado` is populated on **0** Pedido rows;
  `prazo_entrega` is populated on every row.
- `cliente_pedido_summary()` returns both, which is why the column cannot
  simply be assumed gone.

**Binding rules.** Both columns remain physically present; no migration in
this design drops, renames or backfills either. Every editor —
administrative and client — binds the single visible expected-delivery
control to `prazo_entrega` and to nothing else. The
`prazo_desejado || prazo_entrega` read fallback must not be replicated into
any new surface, because a future write to the dormant column would silently
take precedence over the field the editors actually own. Retiring
`prazo_desejado` is out of scope here and is recorded as
`PEDIDO-PRAZO-DESEJADO-DORMANT-COLUMN` in U12.

### U4. Field and lifecycle matrix (binding)

> **Amended 2026-07-29 by the supervisor rulings of
> `PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1`.** The lifecycle gate for a
> STRUCTURAL item change is no longer "production started"; it is **the
> existence of any related OP, in any status**. The columns below are relabelled
> accordingly and U5 is rewritten to match. Every other cell is unchanged.

Legend: `DIRECT_EDIT` — saved straight onto the live Pedido.
`CHANGE_REQUEST` — the editor accepts the value but persists it only as a
proposed revision. `READ_ONLY` — visible, not editable. `NOT_VISIBLE` — never
rendered or returned to that actor. `CONDITIONALLY_ALLOWED` — permitted only
when the stated condition holds; every condition is spelled out below the
tables.

A **structural item change** is exactly one of: changing `modelo_id`, changing
`metros`, inserting an item, removing an item. Item observation, item order and
every header field are **not** structural.

Administrative columns. `Aceito, sem OP` means `status = 'confirmado'` (or
beyond) with **no** related OP. `Com OP` means at least one related OP exists,
in any status — including `simulada` and `cancelada`.

| Field / collection | Admin Rascunho | Admin Recebido | Admin Aceito, sem OP | Admin Com OP | Admin Terminal |
| --- | --- | --- | --- | --- | --- |
| `cliente_id` (client identity) | `DIRECT_EDIT` | `DIRECT_EDIT` | `CONDITIONALLY_ALLOWED` (A1) | `CONDITIONALLY_ALLOWED` (A1) | `READ_ONLY` |
| `numero` (Pedido number) | `READ_ONLY` | `READ_ONLY` | `READ_ONLY` | `READ_ONLY` | `READ_ONLY` |
| `data_pedido` (Pedido date) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| `prazo_entrega` (expected delivery) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| `referencia_cliente` (client reference) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| `tipo_recebimento` (receiving method) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| `observacao` (general observation) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| item `observacao` (item observation) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` |
| item `modelo_id` (item model) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` (A2) | `READ_ONLY` |
| item `metros` (item metres) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` (A2) | `READ_ONLY` |
| add item (item insertion) | `DIRECT_EDIT` | `DIRECT_EDIT` | `DIRECT_EDIT` | `READ_ONLY` (A2) | `READ_ONLY` |
| remove item (item removal) | `DIRECT_EDIT` (A3) | `DIRECT_EDIT` (A3) | `DIRECT_EDIT` (A3) | `READ_ONLY` (A2) | `READ_ONLY` |
| item order and production priority | `DIRECT_EDIT` (A4) | `DIRECT_EDIT` (A4) | `DIRECT_EDIT` (A4) | `CONDITIONALLY_ALLOWED` (A5) | `READ_ONLY` |
| `status` (lifecycle status) | `READ_ONLY` (A6) | `READ_ONLY` (A6) | `READ_ONLY` (A6) | `READ_ONLY` (A6) | `READ_ONLY` (A6) |

Client columns. `Recebido, not yet accepted` covers `rascunho` and `recebido`;
a client-created Pedido always enters at `recebido`
(`js/screens/cliente-pedido-form.js:1007`).

| Field / collection | Client Recebido (not accepted) | Client Aceito, sem OP | Client Com OP | Client Terminal |
| --- | --- | --- | --- | --- |
| `cliente_id` (client identity) | `NOT_VISIBLE` | `NOT_VISIBLE` | `NOT_VISIBLE` | `NOT_VISIBLE` |
| `numero` (Pedido number) | `NOT_VISIBLE` (C1) | `NOT_VISIBLE` (C1) | `NOT_VISIBLE` (C1) | `NOT_VISIBLE` (C1) |
| `data_pedido` (Pedido date) | `READ_ONLY` (C2) | `READ_ONLY` (C2) | `READ_ONLY` (C2) | `READ_ONLY` (C2) |
| `prazo_entrega` (expected delivery) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `CHANGE_REQUEST` | `READ_ONLY` |
| `referencia_cliente` (client reference) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `CHANGE_REQUEST` | `READ_ONLY` |
| `tipo_recebimento` (receiving method) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `CHANGE_REQUEST` | `READ_ONLY` |
| `observacao` (general observation) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `CHANGE_REQUEST` | `READ_ONLY` |
| item `observacao` (item observation) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `CHANGE_REQUEST` | `READ_ONLY` |
| item `modelo_id` (item model) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `READ_ONLY` (C3) | `READ_ONLY` |
| item `metros` (item metres) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `READ_ONLY` (C3) | `READ_ONLY` |
| add item (item insertion) | `DIRECT_EDIT` | `CHANGE_REQUEST` | `READ_ONLY` (C3) | `READ_ONLY` |
| remove item (item removal) | `DIRECT_EDIT` (A3) | `CHANGE_REQUEST` (A3) | `READ_ONLY` (C3) | `READ_ONLY` |
| item order and production priority | `DIRECT_EDIT` (C4) | `CHANGE_REQUEST` (C5) | `CHANGE_REQUEST` (C5) | `READ_ONLY` |
| `status` (lifecycle status) | `READ_ONLY` (C6) | `READ_ONLY` (C6) | `READ_ONLY` (C6) | `READ_ONLY` (C6) |
| OP, lote, supplier, purchase order, fiscal, cost, internal metadata | `NOT_VISIBLE` | `NOT_VISIBLE` | `NOT_VISIBLE` | `NOT_VISIBLE` |

**Administrative conditions.**

- **A1** — `cliente_id` is editable only while
  `pedidos_source_lineage_immutability_guard` does not refuse it, that is,
  while no lote of the Pedido feeds an OP selected as an expedition source. The
  guard is the authority; the UI disables the control when the condition is
  already known and surfaces the guard's refusal verbatim otherwise.
- **A2** — once ANY related OP exists, in any status, a structural item change
  is refused by both generic write flows and by approval, with
  `PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP`. **Impact confirmation is not
  an override:** no parameter unlocks it, and none is offered. Production
  reconciliation is a separate flow, and no operation in this design changes,
  recreates, deletes or reconciles `op_itens`.
- **A3** — an item removal is additionally refused, at every lifecycle point,
  when the item is referenced by an `op_itens`, `expedicao_itens` or
  `pedido_parcial_itens` row. See U5.3: the database does **not** refuse this on
  its own.
- **A4** — item order and production priority reach the database only through
  `definir_prioridade_pedido()`. No parallel implementation may exist.
- **A5** — priority keeps its **existing** owner and its existing gate:
  `definir_prioridade_pedido()` requires `p_confirmar_impacto_producao = true`
  when `status = 'produzindo'`
  (`PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED`). That contract is
  reused unchanged and is **not** re-implemented here. Reordering is not a
  structural change and is therefore not blocked by A2.
- **A6** — status transitions stay owned by the Pedido detail lifecycle
  controls. No editor, and no approval operation, writes `status`.

**Client conditions.**

- **C1** — the Pedido number is internal. The `db/90` section of this document
  already states that no client-facing surface may display it. The client
  editor identifies the Pedido by `referencia_cliente` and by date.
- **C2** — the Client **may** provide `data_pedido` during initial Pedido
  creation, through the existing creation flow, which this design does not
  change. Once the Pedido exists, `data_pedido` is read-only to the Client at
  every lifecycle point: `salvar_pedido_cliente(...)` rejects any payload
  attempting to change it and `solicitar_alteracao_pedido(...)` rejects any
  proposal over it, both with
  `PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE`. It never appears as a
  proposed field in a client change request. The existing client creation
  policies and creation UI are **not** removed or altered by this phase.
- **C3** — once ANY related OP exists, the Client cannot even submit a
  structural proposal: `solicitar_alteracao_pedido(...)` refuses it at
  submission time rather than accepting a request that could never be approved.
  Header fields, observations and priority preference remain proposable.
- **C4** — pre-acceptance the client's priority preference already reaches
  `definir_prioridade_pedido()` directly and lands as `solicitada`. That
  existing path is preserved unchanged and is **not** routed through the
  change-request model.
- **C5** — after acceptance `definir_prioridade_pedido()` already refuses the
  client (`PEDIDO_PRIORITY_CLIENT_LOCKED`). The proposed sequence therefore
  travels inside the change request, and only the approval operation calls
  `definir_prioridade_pedido()` — under the administrator's own identity, so
  the result is `confirmada`, which is the correct outcome for a sequence an
  administrator has just approved.
- **C6** — the client never writes `status` and never sees the operational
  status. It sees the sanitized visual status produced by
  `cliente_pedido_summary()`.

No cell is left to implementation discretion.

### U5. Production-impact rules

> **Rewritten 2026-07-29.** The graded A–E impact ladder of R1 is superseded.
> The binding rule is a single, verifiable boundary: **does any related OP
> exist?** A graded ladder implied that some structural changes stay safe deep
> into production; the supervisor ruled otherwise, and a rule an executor can
> evaluate wrongly is worse than a stricter rule it cannot.

#### U5.1 The boundary

`public.pedido_tem_op_relacionada(p_pedido_id)` is the single owner of the
question. It returns TRUE when any of the following holds:

- an `ops` row reaches the Pedido through `lotes.pedido_id`;
- an `expedicoes` row carries the Pedido;
- an `op_itens` row references one of the Pedido's items;
- an `expedicao_itens` row references one of the Pedido's items.

OP status is deliberately **not** consulted: `simulada` and `cancelada` count.
A cancelled OP still records that production planning consumed this Pedido, and
distinguishing statuses would reintroduce the graded ladder this ruling removed.

#### U5.2 Disposition

| Proposed change | No related OP | Any related OP | Terminal Pedido |
| --- | --- | --- | --- |
| expected delivery date (`prazo_entrega`) | allow | allow | refuse |
| `referencia_cliente` | allow | allow | refuse |
| `tipo_recebimento` | allow | allow | refuse |
| general observation | allow | allow | refuse |
| item observation | allow | allow | refuse |
| `data_pedido` (administrative only) | allow | allow | refuse |
| reorder / production priority | allow | allow, through the existing `definir_prioridade_pedido()` gate (A5) | refuse |
| change `metros` | allow | **refuse** | refuse |
| change `modelo_id` | allow | **refuse** | refuse |
| add an item | allow | **refuse** | refuse |
| remove an item | allow, unless the item is linked (U5.3) | **refuse** | refuse |

`allow` — applied with no extra step.
`refuse` — fails closed with a stable identifier; the live Pedido is untouched
and, for an approval, the request stays `pendente` so the reviewer can reject it
with a reason the client can read.

There is **no** confirmation flag that converts a `refuse` into an `allow` for a
structural change. Administrative approval alone never makes a structurally
dangerous item mutation safe.

#### U5.3 The item-removal hazard (unchanged finding, now enforced)

`op_itens.pedido_item_id` and `expedicao_itens.pedido_item_id` are both
`FOREIGN KEY ... ON DELETE SET NULL`, and `pedido_parcial_itens.pedido_item_id`
is `ON DELETE CASCADE`. Deleting a `pedido_itens` row therefore **succeeds today
and silently orphans** the OP item and the expedition item while discarding the
partial-delivery detail — no constraint, trigger or check reports it.

`public.pedido_item_tem_vinculo_producao(p_item_id)` is the owner of that
question, and `public.pedido_itens_reconciliar(...)` evaluates it **before** any
delete, raising `PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP`. This is a new invariant
created by this contract; no implementation may assume the foreign key will stop
it. Whether the foreign keys themselves should become `RESTRICT` remains out of
scope and is recorded as `PEDIDO-ITEM-DELETE-ORPHANS-OP-LINK` in U12.

#### U5.4 No quantity reconciliation in this design

R1 proposed a controlled `metros` reconciliation against recorded deliveries.
That is **withdrawn**: under U5.2 a metre change is refused outright once any
OP exists, so there is no reachable state in which it would run. The stable
identifiers `PEDIDO_ALTERACAO_METROS_ABAIXO_DO_ENTREGUE` and
`PEDIDO_ALTERACAO_MODELO_BLOQUEADO_EM_PRODUCAO` are withdrawn with it. The OP
remains the official record of movement, and quantity changes in production stay
with the existing *Movimentar* flow.

### U6. Change-request data model

**Selected model: C — justified hybrid.** A relational request header and
relational proposed item rows, plus one immutable JSONB before-image carried
on the header.

#### U6.1 Why hybrid, and what was rejected

*Rejected — A, purely relational.* A relational model alone cannot preserve a
faithful before-image. The "current" side of a decided request would have to
be recomputed from live data, so a request reviewed last month would render
against this month's Pedido, and a request whose item was later deleted would
render an incomplete comparison. That destroys the auditability U6.3
requires.

*Rejected — B, header plus a complete JSONB proposed snapshot.* Proposed item
rows must be validated as rows: `modelo_id` must reference `modelos`,
`metros > 0` must hold, and the Manta width invariant
(`pedido_itens_manta_largura_guard`, `pedido_itens_largura_check`) must be
enforceable at submission rather than at approval. A JSONB blob defers every
one of those to application code and lets an unapprovable request be
accepted, converting a validation failure into an approval-time surprise.

*Selected — C.* Proposed items are rows, so the database validates them at
submission. The before-image is JSONB, so the comparison stays stable
forever. Each half is used for the thing it is actually good at.

#### U6.2 Shape

`public.pedido_alteracao_solicitacoes` — request header, one row per request.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `pedido_id` | `uuid` NOT NULL | FK → `pedidos(id)` `ON DELETE CASCADE` |
| `status` | `text` NOT NULL | closed enum, U6.4 |
| `solicitante_id` | `uuid` | FK → `auth.users(id)` `ON DELETE SET NULL` |
| `solicitante_papel` | `text` NOT NULL | `CHECK (IN ('cliente','admin'))` |
| `base_revisao` | `bigint` NOT NULL | Pedido revision the request was built from, U7 |
| `base_snapshot` | `jsonb` NOT NULL | immutable before-image: header fields, ordered item rows with ids, priority state |
| `proposto_prazo_entrega` | `date` | meaningful only when named in `campos_alterados` |
| `proposto_referencia_cliente` | `text` | idem |
| `proposto_tipo_recebimento` | `text` | idem; same `CHECK` domain as `pedidos` |
| `proposto_observacao` | `text` | idem |
| `proposto_prioridade_habilitada` | `boolean` NOT NULL | default `false` |
| `campos_alterados` | `text[]` NOT NULL | explicit list; distinguishes "proposed as NULL" from "not proposed" |
| `mensagem_cliente` | `text` | free-text justification from the requester |
| `criado_em` | `timestamptz` NOT NULL | `now()` |
| `atualizado_em` | `timestamptz` NOT NULL | `now()`, trigger-maintained |
| `decidido_em` | `timestamptz` | NULL until decided |
| `decidido_por` | `uuid` | FK → `auth.users(id)` `ON DELETE SET NULL` |
| `decisao_motivo` | `text` | mandatory on rejection |
| `falha_identificador` | `text` | stable identifier when application failed |

`public.pedido_alteracao_solicitacao_itens` — the complete proposed item
collection. The set is **absolute, not a delta**: it always describes the
Pedido's items as the requester wants them to end up.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `solicitacao_id` | `uuid` NOT NULL | FK → header `ON DELETE CASCADE` |
| `pedido_item_id` | `uuid` | FK → `pedido_itens(id)` `ON DELETE SET NULL`; NULL means a newly proposed item |
| `modelo_id` | `bigint` NOT NULL | FK → `modelos(id)` `ON DELETE RESTRICT` |
| `metros` | `numeric` NOT NULL | `CHECK (metros > 0)` |
| `largura` | `numeric` | same `CHECK` domain as `pedido_itens` |
| `observacao` | `text` | |
| `ordem` | `integer` NOT NULL | position in the proposed collection |

Removal is expressed by **absence**: a live `pedido_itens.id` that no proposed
row references is a proposed removal. This is precisely why the set must be
absolute — a delta encoding cannot express "remove" without a tombstone row,
and a tombstone row cannot be validated as an item.

Required indexes: a unique partial index enforcing at most one pending request
per Pedido (U6.5); `(pedido_id, criado_em DESC)` for history;
`(solicitacao_id, ordem)` for the item collection.

#### U6.3 Coverage

The model supports, by construction: one authoritative current Pedido (the
live rows, never touched while a request is pending); a complete proposed
revision; before/after comparison (`base_snapshot` against the proposed
columns and rows); item insertion (`pedido_item_id IS NULL`), modification
(matching `pedido_item_id`), deletion (absent `pedido_item_id`) and
reordering (`ordem`); proposed priority (`proposto_prioridade_habilitada`
plus the proposed `ordem` sequence); request status; requester identity and
role; creation and decision timestamps; reviewer identity; approval or
rejection reason; optimistic concurrency (`base_revisao`, U7); auditability
(append-only decision fields plus `pedido_eventos`); and safe cancellation or
replacement by the client (U6.5).

#### U6.4 Closed request-status enum

`CHECK (status IN ('pendente','aprovada','rejeitada','retirada','substituida','falha_aplicacao'))`

| Value | Meaning |
| --- | --- |
| `pendente` | awaiting administrative review; the only active state |
| `aprovada` | applied atomically to the live Pedido |
| `rejeitada` | reviewed and refused; `decisao_motivo` mandatory |
| `retirada` | withdrawn by the requester before any decision |
| `substituida` | replaced by a newer request from the same requester |
| `falha_aplicacao` | approval was attempted and failed; the live Pedido is unchanged and `falha_identificador` carries the stable reason |

The enum is closed. No further value may be introduced without an owning
decision recorded in this document.

#### U6.5 At most one pending request per Pedido

**Binding rule: at most one active pending request may exist per Pedido.**
Enforced by a unique partial index on `(pedido_id) WHERE status = 'pendente'`,
not by an application check alone.

A client submitting a new request while one is pending does not create a
second row and does not silently overwrite the first: the submit RPC
transitions the existing request to `substituida` and inserts the replacement
in the same transaction, so the superseded request stays in the history with
its own timestamps. Withdrawal (`retirada`) is available to the requester at
any time before a decision.

Rationale for rejecting concurrent requests: two pending requests built from
the same base would each be a complete absolute item collection, so approving
both in sequence would silently discard the first one's changes, and
approving them in either order would produce a different result. A queue
whose outcome depends on approval order is not reviewable.

### U7. Concurrency contract

**`pedidos.atualizado_em` must not be used as the version owner.** Live
introspection proves it is not maintained: no trigger on `public.pedidos`
writes it — the only `BEFORE UPDATE` toucher,
`touch_pedido_cliente_visual_update`, writes `status_cliente_atualizado_em`
and nothing else — no screen includes it in an update payload, and on the
production project `atualizado_em = criado_em` on **every** Pedido row. Its
`now()` default fires at `INSERT` and never again. Treating it as a version
would make every optimistic check pass.

**The version owner is a new column `public.pedidos.revisao BIGINT NOT NULL
DEFAULT 1`,** maintained by a `BEFORE UPDATE` trigger on `pedidos` and by an
`AFTER INSERT OR UPDATE OR DELETE` trigger on `pedido_itens` that bumps the
parent. The revision must move for header changes, item changes and priority
changes alike, because a change request spans all three; a version that
tracked only the header would let an approved header change land on top of a
concurrently rewritten item collection.

Rules:

1. A request stores `base_revisao` at submission.
2. Approval re-reads the Pedido `FOR UPDATE`, then compares.
3. If `pedidos.revisao <> base_revisao`, approval **fails closed** with
   `PEDIDO_ALTERACAO_BASE_DESATUALIZADA`, changes nothing, and leaves the
   request `pendente`. There is no silent merge, no partial application and no
   field-level three-way reconciliation.
4. The client reopens the editor against the latest accepted state and
   resubmits. The resubmission takes the U6.5 replacement path, so the stale
   request becomes `substituida` rather than lingering.
5. Approval takes `FOR UPDATE` on the Pedido row first, then on
   `pedido_itens` ordered by `id` — the same lock order
   `definir_prioridade_pedido()` already uses. No new edge is introduced into
   the global lock order established by `db/88`.

`atualizado_em` being unmaintained is itself a defect with a wider blast
radius than this design; it is recorded as
`PEDIDO-ATUALIZADO-EM-NOT-MAINTAINED` in U12 and is not repaired here.

### U8. RPC and transactional contract

**Eight** functions, shipped by `db/92`. All are `SECURITY DEFINER`,
`SET search_path = public, auth`, with `EXECUTE` revoked from `PUBLIC` and from
`anon` and granted only to `authenticated`. Each authorizes internally from
`is_admin()` and `meu_cliente_id()`; none accepts a caller-supplied role or
client identity. Every Pedido-mutating function locks `public.pedidos`
`FOR UPDATE` first and `public.pedido_itens ORDER BY id FOR UPDATE` second — the
order `definir_prioridade_pedido()` already established, so no new edge enters
the global lock order of `db/88`.

| Function | Caller | Responsibility |
| --- | --- | --- |
| `salvar_pedido_cliente(p_pedido_id, p_base_revisao, p_header, p_itens, p_prioridade)` | client | Pre-acceptance safe write: applies the client's direct edits to its own still-unaccepted Pedido in one transaction, re-checking ownership and `status IN ('rascunho','recebido')` under `FOR UPDATE`. `data_pedido`, `cliente_id`, `numero` and `status` are refused. |
| `salvar_pedido_admin(p_pedido_id, p_base_revisao, p_header, p_itens, p_prioridade, p_confirmar_impacto)` | admin | The administrative transactional owner: `is_admin()`, lock the Pedido, check the expected revision, evaluate live OP impact, validate the absolute proposed item collection, apply permitted header changes, reconcile permitted item changes, normalize item order, call `definir_prioridade_pedido()` when priority changes, record audit evidence, commit together. It never transitions `status` and never makes a structural item change once any OP exists. |
| `solicitar_alteracao_pedido(p_pedido_id, p_header, p_itens, p_prioridade, p_mensagem)` | client | Accepted, non-terminal own Pedido only. Captures `base_revisao` and `base_snapshot`, supersedes any pending request atomically, rejects fields the client may never propose, and rejects a structural item proposal when any OP already exists. |
| `retirar_alteracao_pedido(p_solicitacao_id)` | client | Transitions the caller's own `pendente` request to `retirada`. Refuses any decided request. Never touches the Pedido. |
| `aprovar_alteracao_pedido(p_solicitacao_id, p_confirmar_impacto, p_motivo)` | admin | The atomic application of U8.1, with the failure contract of U8.3. |
| `rejeitar_alteracao_pedido(p_solicitacao_id, p_motivo)` | admin | Transitions `pendente` to `rejeitada`; `p_motivo` mandatory; records the audit event. Never touches the Pedido. |
| `cliente_alteracao_resumo(p_pedido_id)` | client | Sanitized client-safe summary of that client's own request state. Explicit whitelist: no OP, lote, supplier, purchase-order, fiscal, cost or internal metadata, and no `pedidos.numero`. |
| `admin_alteracao_comparacao(p_solicitacao_id)` | admin | The full comparison payload of U10.4: before-image, current state, proposed header and item collection, author, timestamps and live impact. Read-only. |

Supporting owners, not public API and not granted to `anon`:
`pedido_tem_op_relacionada`, `pedido_item_tem_vinculo_producao`,
`pedido_snapshot`, `pedido_itens_payload_normalizar`,
`pedido_itens_payload_e_estrutural`, `pedido_itens_reconciliar`,
`pedido_itens_sequencia`, `pedido_header_validar`, `pedido_header_aplicar`,
`pedido_prioridade_aplicar`.

Direct client `UPDATE` or `DELETE` against live `pedidos` and `pedido_itens`
remains prohibited. The pre-acceptance path is a transactional RPC, not a
relaxed policy.

Direct client `UPDATE` or `DELETE` against live `pedidos` and `pedido_itens`
remains prohibited. The pre-acceptance path is a transactional RPC, not a
relaxed policy.

#### U8.1 Approval, in order, in one transaction

1. Lock the request row `FOR UPDATE`; refuse unless `status = 'pendente'`.
2. Lock the Pedido `FOR UPDATE`; validate `revisao = base_revisao`, otherwise
   `PEDIDO_ALTERACAO_BASE_DESATUALIZADA`.
3. Compute the live impact level (U5.1) and validate every proposed change
   against U5.2, including the U5.3 removal refusal and the U5.4
   reconciliation. A `confirm` disposition without `p_confirmar_impacto`
   returns `PEDIDO_ALTERACAO_IMPACTO_CONFIRMACAO_REQUERIDA` and changes
   nothing.
4. Apply the permitted header changes named by `campos_alterados`. `numero`,
   `status`, `cliente_id` and `data_pedido` are never in that set for a
   client-originated request.
5. Reconcile item rows: `UPDATE` matched `pedido_item_id`, `INSERT` proposed
   rows whose `pedido_item_id IS NULL`, `DELETE` live rows absent from the
   proposed set — after step 3 has already cleared them.
6. Normalize `ordem` to the proposed sequence, contiguous from 0.
7. Apply or remove priority **through `definir_prioridade_pedido()` only**. No
   second priority implementation may exist; the guards
   `pedidos_prioridade_direct_write_guard` and
   `pedido_itens_ordem_direct_write_guard` would make any alternative fail
   anyway, and this contract forbids attempting one.
8. Record audit events: one `pedido_eventos` row for the applied revision and,
   where the client should see it, one `pedido_cliente_eventos` row.
9. Set the request to `aprovada` with `decidido_em` and `decidido_por`.
10. Commit. Any failure rolls the whole operation back; the caller then marks
    the request `falha_aplicacao` with `falha_identificador` in a separate
    transaction, or leaves it `pendente` if even that fails. The live Pedido
    is unchanged in both cases.

A failed application never leaves the Pedido header, the item set, the item
ordering, the production priority, the request status or the audit events
partially updated.

#### U8.2 Stable error identifiers

Shipped by `db/92`:

`PEDIDO_ALTERACAO_FORBIDDEN`, `PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND`,
`PEDIDO_ALTERACAO_PEDIDO_TERMINAL`, `PEDIDO_ALTERACAO_PEDIDO_NAO_ACEITO`,
`PEDIDO_ALTERACAO_PEDIDO_NAO_EDITAVEL`,
`PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND`,
`PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA`,
`PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA`,
`PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP`,
`PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE`,
`PEDIDO_ALTERACAO_CAMPO_NAO_PERMITIDO`,
`PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP`,
`PEDIDO_ALTERACAO_ITEM_SET_INVALIDO`,
`PEDIDO_ALTERACAO_MOTIVO_OBRIGATORIO`,
`PEDIDO_ALTERACAO_IMUTAVEL`,
`PEDIDO_ALTERACAO_FALHA_APLICACAO`.

Withdrawn from the R1 draft, because the states that would raise them are now
unreachable under U5.2: `PEDIDO_ALTERACAO_BASE_DESATUALIZADA` (renamed
`..._REVISAO_DESATUALIZADA`), `PEDIDO_ALTERACAO_IMPACTO_CONFIRMACAO_REQUERIDA`
(no structural change is ever confirmable),
`PEDIDO_ALTERACAO_METROS_ABAIXO_DO_ENTREGUE` and
`PEDIDO_ALTERACAO_MODELO_BLOQUEADO_EM_PRODUCAO`.

These follow the `PEDIDO_PRIORITY_*` convention already established by
`db/91` and already consumed by `js/pedido-priority.js`. `db/91`'s own
identifiers — notably `PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED`
and `PEDIDO_PRIORITY_CLIENT_LOCKED` — continue to surface unchanged through the
priority path.

#### U8.3 Approval failure ownership

An **expected** validation refusal — any identifier above raised before the
application stage — returns the stable identifier, leaves the request
`pendente`, and changes no live Pedido row. It is never recorded as an
application failure.

An **unexpected** failure during the application stage is owned by the database,
not by a caller. `aprovar_alteracao_pedido(...)` runs the application work
inside a PL/pgSQL `BEGIN ... EXCEPTION WHEN OTHERS` block, which is a real
subtransaction:

1. every live Pedido, item, priority and audit change from that block is rolled
   back;
2. in the surviving outer transaction the request is set to `falha_aplicacao`;
3. `falha_identificador` is populated with `SQLSTATE` and the truncated message;
4. the immutable before-image is preserved;
5. the function returns a stable
   `{"ok": false, "erro": "PEDIDO_ALTERACAO_FALHA_APLICACAO", ...}` result.

No frontend, and no separate direct-DML caller, owns this transition. All
expected refusals are raised **before** the subtransaction opens, precisely so a
refusal can never be misfiled as an application failure; the static guard
`tests/pedido-unified-edit-change-approval-schema.smoke.js` asserts that
ordering in source.

### U9. RLS and security contract

| Requirement | Mechanism |
| --- | --- |
| Client reads only its own Pedido and its own requests | `SELECT` policy `EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND p.cliente_id = meu_cliente_id())` on both new tables |
| Client submits, replaces or withdraws only its own permitted request | No client `INSERT`, `UPDATE` or `DELETE` policy at all; the only path is the `SECURITY DEFINER` RPCs of U8, which re-derive the caller |
| Client cannot approve or reject | `aprovar_*` and `rejeitar_*` require `is_admin()` and raise `42501` otherwise |
| Client cannot directly update an accepted Pedido or its items | Unchanged: no client `UPDATE` or `DELETE` policy exists on `pedidos` or `pedido_itens`, and none is added |
| Admin can review and decide | `is_admin()` `ALL` policy on both new tables, matching the existing `*_admin_all` pattern |
| Direct DML on the request tables is closed to every application role | `REVOKE ALL ... FROM PUBLIC, anon, authenticated` then `GRANT SELECT ... TO authenticated`. This revoke is load-bearing: the Supabase project carries `ALTER DEFAULT PRIVILEGES` granting full DML on every new `public` table to `anon`, `authenticated` and `service_role`, which is why `pedidos` and `pedido_itens` show `DELETE/INSERT/UPDATE` for both roles. Without it an administrator could write requests and decisions by raw DML, bypassing the RPCs, the before-image immutability and the single-pending index. |
| Sanitized client readers never expose internal production data | `cliente_alteracao_resumo()` returns an explicit whitelist; no `SELECT *`, per `PORTAL_B2B_ARCHITECTURE_RULES.md` §8 |
| `service_role` is not exposed | No new surface receives it; the RPC bodies still require a real admin or client JWT |
| No anonymous access is introduced | `EXECUTE` revoked from `anon` on every new function; no `anon` policy on either new table; no `anon` table privilege |
| Existing client creation policies are preserved | `pedidos_cliente_insert` and `pedido_itens_cliente_insert` are **not** dropped, replaced or narrowed by this phase, and `db/92`'s prerequisite gate refuses to install if either is absent |

**Correction to the R1 draft.** R1 stated that the raw-API client item append
would be "closed" by replacing `pedido_itens_cliente_insert`. That is
**withdrawn**: the supervisor ruled that the existing client creation policies
and creation UI are not touched in this phase, and `db/92` therefore leaves both
insert policies exactly as they were. The finding
`PEDIDO-ITENS-CLIENT-INSERT-WITHOUT-UI` stays OPEN as out-of-scope debt in U12
and needs its own order.

The B2B separation of `PORTAL_B2B_ARCHITECTURE_RULES.md` §2 holds: the client
requests, the administrator decides and publishes, the supplier is untouched
by this design.

### U10. UI architecture contract

#### U10.1 Reusable seams

Reuse is required where a genuine owner already exists, and forbidden where it
would only shorten a file (`CODE_HEALTH_RULES.md` §7).

| Concern | Existing owner | Disposition |
| --- | --- | --- |
| Detailed item modal | `js/screens/pedido-item-modal.js` (`RAVATEX_PEDIDO_ITEM_MODAL`) | Reuse as-is |
| Quick item row and the Tipo-before-Modelo rule | `js/screens/pedido-item-row-editor.js` (`RAVATEX_PEDIDO_ITEM_ROW`) | Reuse as-is |
| Priority panel, sequence editor, impact modal, RPC call | `js/pedido-priority.js` (`RAVATEX_PEDIDO_PRIORITY`) | Reuse as-is; `definir_prioridade_pedido()` stays the sole owner |
| Status label, badge, editability, date format, business colour | `js/pedido-ui.js` (`RAVATEX_PEDIDO_UI`) | Reuse as-is |
| Controls, cards, action footers, modals, tables, responsive regions | `js/ui.js`, `css/tokens.css`, `css/responsive.css` | Consume; never extend `css/responsive.css` for a screen |
| Item draft state (`novoItem`, totals, per-item validation) | private to `pedido-form.js`, already duplicated in `cliente-pedido-form.js` | **Extract** to a new shared owner |
| General-data field block | duplicated across the two creation screens | **Extract** to a new shared owner |

Two extractions are authorized, because each has a real reusable seam and
would otherwise be duplicated a third and a fourth time:

- **`js/pedido-draft.js`** — the local item-draft contract: `novoItem`,
  totals, per-item validation, the absolute item collection, and the
  projection into the priority owner's shape. Both creation screens, both
  editors and the approval screen consume it.
- **`js/pedido-fields.js`** — the general-data field block, declared once with
  a per-role, per-lifecycle capability descriptor derived from the U4 matrix.
  Neither editor re-implements the matrix; both read it.

The business rules of U4 and U5 are declared exactly once — in
`js/pedido-fields.js` and in the RPCs respectively. Duplicating them across
the administrative and the client screen is prohibited. Copying
`pedido-form.js` wholesale is prohibited. No abstraction is introduced solely
to reduce line count.

#### U10.2 Administrative editor — `#/pedidos/<uuid>/editar`

Full width. The same information architecture as `#/pedidos/novo`, in order:

1. header and Pedido identity — number read-only, status badge, back to detail;
2. general data — `cliente_id`, `numero` read-only, `data_pedido`,
   `prazo_entrega`, `referencia_cliente`, `tipo_recebimento`, each with the
   capability the U4 matrix assigns;
3. complete item editing — inline table with edit, remove and reorder;
4. **`Adicionar item`** — opens the detailed item modal;
5. **`Adicionar linha`** — the discreet quick-entry action, lower right of the
   item card;
6. production-priority control, through `RAVATEX_PEDIDO_PRIORITY`;
7. general instructions;
8. summary and save action.

The dual item-entry contract is preserved exactly: both paths converge into
the same item state and the same persistence contract, per the accepted
checkpoint `PEDIDO-ADMINISTRATIVE-DUAL-ITEM-ENTRY`. The current
`max-width:768px` general-data-only card is retired; the administrative edit
screen must not remain limited to a partial-width general-data card.

#### U10.3 Client editor — `#/cliente/pedidos/<uuid>/editar`

The same structural composition, with the client boundary applied by the U4
client matrix. It identifies the Pedido by `referencia_cliente` and date
rather than by `numero`; `data_pedido` is read-only context; the single
expected-delivery control is bound to `prazo_entrega`. It never renders OP,
lote, supplier, purchase-order, fiscal-document, internal-cost or other
internal production data.

Two save modes, decided by lifecycle rather than by a separate screen:

- before administrative acceptance — **Salvar alterações**, through
  `salvar_pedido_cliente(...)`, updating the unaccepted Pedido directly;
- after administrative acceptance — **Enviar solicitação de alteração**,
  through `solicitar_alteracao_pedido(...)`, with a standalone notice card
  (`UI_VISUAL_CONTRACT.md` §2.11) stating that the accepted Pedido and its
  items are unchanged and that the request awaits administrative review.

The editor always opens against the current accepted values. Terminal Pedidos
do not open it at all.

#### U10.4 Approval screen — `#/pedidos/<uuid>/alteracoes/<request-id>`

A change request is an entity and gets a dedicated route. It is **not** a
transition modal: the complete request, the Pedido editor and the
before/after comparison must not be placed inside one. A modal is used only to
confirm the final approve or reject action.

Composition: header with request identity and status pill; current accepted
values; proposed values; field-level differences; current and proposed item
collections with inserted, changed, removed and reordered rows marked
individually; current and proposed priority through
`RAVATEX_PEDIDO_PRIORITY.buildSequence`; request author, role and timestamps;
a production-impact notice card carrying the live impact level and every
`confirm` or `refuse` disposition from U5.2; and a card action footer with
**Rejeitar** and **Aprovar**.

The comparison data comes from `admin_alteracao_comparacao()`. The screen
computes no business rule of its own.

#### U10.5 Disposition of `#/pedidos/<uuid>/itens`

**The route becomes a compatibility redirect to `#/pedidos/<uuid>/editar`, and
`js/screens/pedido-itens-edit.js` is retired once the unified editor is
accepted.** Two competing complete item editors are not acceptable, and the
unified editor is a strict superset: it does everything
`pedido-itens-edit.js` does, transactionally, plus the header fields and the
priority panel. The redirect exists so that a bookmarked or in-flight link
does not break; it is removed by a later cleanup order, not by this sequence.

`js/screens/pedido-detail-events.js:2430-2472` collapses to a single
destination. The Pedido detail screens remain read-oriented hubs and gain the
entry point to a pending change request.

### U11. Bounded implementation sequence

Six phases. Each requires its own explicit authorization; none is chained.
Schema and frontend are never mixed in one phase
(`PORTAL_B2B_ARCHITECTURE_RULES.md` §7).

**Phase 1 — contract acceptance.**
*Objective:* supervisor ratification of this section, including the open
decisions of U13. *Authorized paths:* none. *Prerequisites:* this section
published and canonical state updated. *Invariants:* nothing is implemented.
*Validation:* architect decision. *Stop conditions:* any change to the U4
matrix, to the acceptance boundary or to the canonical expected-delivery
field requires this section to be revised before anything proceeds.
*Next action:* Phase 2, only if separately ordered.

**Phase 2 — migration, RPCs, RLS and focused database validation. COMPLETE.**
Executed by `PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1`; evidence in U14.
*Objective:* `db/92`, creating the two request tables, `pedidos.revisao` and its
triggers, the **eight** RPCs of U8, the supporting owners, the policies and the
grants. *Authorized paths:* `db/`, `tests/`, this document. *Prerequisites:*
Phase 1 accepted; a separate order naming `ucrjtfswnfdlxwtmxnoo` and the
permitted operation before any apply. *Invariants:* no frontend file changes;
`definir_prioridade_pedido()` is not redefined; no existing policy is widened;
the existing client creation policies are preserved; the migration terminal
guard in `tests/ordem-compra-c3d-deploy.smoke.js` advances `91 → 92` in the same
commit. *Validation:* disposable-cluster run of the whole `db/01..db/92` chain,
plus positive and negative effective-access cases for client, admin, supplier
and anon. *Stop conditions:* any need to alter an existing guard; any client
`UPDATE` policy appearing on `pedidos` or `pedido_itens`. *Next action:* Phase
3, only if separately ordered.

> The R1 draft said this phase would also add a database refusal of a
> client-supplied `data_pedido` at creation. That is **withdrawn** by the
> supervisor ruling recorded in U13.1: the Client may provide `data_pedido` at
> creation, and the creation flow is untouched. The immutability that ships is
> post-creation only, enforced by the two client RPCs.

**Phase 3 — unified administrative editor.**
*Objective:* `#/pedidos/<uuid>/editar` becomes the complete full-width editor;
`js/pedido-draft.js` and `js/pedido-fields.js` are extracted;
`#/pedidos/<uuid>/itens` becomes a redirect. *Authorized paths:* `js/`,
`index.html`, `tests/`. *Prerequisites:* Phase 2 applied and verified.
*Invariants:* dual item entry preserved; priority only through
`RAVATEX_PEDIDO_PRIORITY`; no edit to `css/responsive.css`; the applicable
visual contract read before the first visible-UI edit. *Validation:* the
existing `pedido-edit`, `pedido-itens-edit`, `pedido-detail`, `router` and
`boot` smoke suites, plus rendered validation of the affected surfaces.
*Stop conditions:* any guard whose correction would require a business-rule
change. *Next action:* Phase 4.

**Phase 4 — client editor and request submission.**
*Objective:* `#/cliente/pedidos/<uuid>/editar` with both save modes; the
client `data_pedido` control removed; `referencia_cliente` and
`tipo_recebimento` begin to persist. *Authorized paths:* `js/`, `index.html`,
`tests/`. *Prerequisites:* Phase 3 accepted. *Invariants:* the client
boundary of U4 and U9; no internal production data on a client surface; the
administrative and client flows are not forced to match. *Validation:* the
client smoke suites plus rendered validation. *Stop conditions:* any internal
field appearing on a client surface. *Next action:* Phase 5.

**Phase 5 — administrative comparison and approval screen.**
*Objective:* `#/pedidos/<uuid>/alteracoes/<request-id>` and its entry point on
the Pedido detail hub. *Authorized paths:* `js/`, `index.html`, `tests/`.
*Prerequisites:* Phase 4 accepted. *Invariants:* no complete entity inside a
transition modal; the screen computes no business rule; approval and
rejection travel only through the RPCs. *Validation:* approval, rejection,
stale-base conflict and impact-refusal paths exercised end to end.
*Stop conditions:* any observable partial application. *Next action:* Phase 6.

**Phase 6 — cross-role integration, rendered validation and closeout.**
*Objective:* a full client-to-admin round trip on real data, rendered
evidence, retirement of `js/screens/pedido-itens-edit.js`, and ledger and
current-state closeout. *Authorized paths:* `js/`, `tests/`, `docs/`,
`AGENT_HANDOFF.md`. *Prerequisites:* Phase 5 accepted. *Invariants:*
append-only history; no protected-residue change. *Validation:* the
phase-specific manifest, plus a system health gate if separately authorized.
*Stop conditions:* any unresolved `BLOCKING` finding. *Next action:*
supervisor acceptance and closeout.

### U12. Out-of-scope findings recorded by this design

| ID | Classification | Evidence | Impact and disposition |
| --- | --- | --- | --- |
| `PEDIDO-ATUALIZADO-EM-NOT-MAINTAINED` | `NONBLOCKING_MATERIAL_DEBT` | No trigger writes `pedidos.atualizado_em`; `atualizado_em = criado_em` on every production row | Any consumer treating it as a modification time is wrong. U7 routes around it rather than repairing it. Needs its own order. |
| `PEDIDO-ITEM-DELETE-ORPHANS-OP-LINK` | `NONBLOCKING_MATERIAL_DEBT` | `op_itens.pedido_item_id` and `expedicao_itens.pedido_item_id` are `ON DELETE SET NULL` | A `pedido_itens` delete silently orphans production and expedition rows. U5.3 forbids it in the new path; the foreign-key disposition needs its own order. |
| `PEDIDO-CLIENT-FIELDS-COLLECTED-NEVER-PERSISTED` | `NONBLOCKING_MATERIAL_DEBT` | `js/screens/cliente-pedido-form.js` binds `state.referencia` and `state.recebimento` but omits both from the insert payload; `referencia_cliente` and `tipo_recebimento` are populated on 0 production rows while three administrative screens read them | The client fills two fields that are silently discarded. Phase 4 closes it. |
| `PEDIDO-PRAZO-DESEJADO-DORMANT-COLUMN` | `NONBLOCKING_MATERIAL_DEBT` | `prazo_desejado` is written by nothing, populated on 0 rows, yet read first in a `||` fallback | A future write would silently override the field the editors own. Retirement needs its own order. |
| `PEDIDO-ITENS-CLIENT-INSERT-WITHOUT-UI` | `NONBLOCKING_MATERIAL_DEBT` | `pedido_itens_cliente_insert` admits raw-API appends to an unaccepted Pedido with no UI behind it | Narrowed by U9 in Phase 2. |
| `PEDIDO-ITENS-EDIT-NON-TRANSACTIONAL` | `ACCEPTED_BASELINE` | The limitation is declared in the header of `js/screens/pedido-itens-edit.js` | Superseded by the retirement in U10.5. No separate repair. |

None of these is directly caused by this order, which changed no product,
migration or database path.

### U13. Ratified supervisor rulings

The four decisions R1 left open were decided by the supervisor on 2026-07-29 in
`PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1`. They are binding, and the
recommendation R1 offered is recorded beside each so the divergences stay
visible.

**U13.1 — `data_pedido` at client creation. RULED: creation allowed,
post-creation immutable.**
The Client **may** provide `data_pedido` during initial Pedido creation, through
the existing creation flow. After the Pedido exists it is read-only to the
Client: `salvar_pedido_cliente(...)` rejects any payload attempting to change
it, `solicitar_alteracao_pedido(...)` rejects any proposal over it, and it never
appears as a proposed field in a change request. The existing client creation
policies and creation UI are not removed or altered.
*R1 had recommended* removing the creation control entirely and enforcing the
refusal at the database. That recommendation is **not** adopted: the ruling
keeps a legitimate commercial capability the client already had, and confines
the immutability to the phase where it actually protects an accepted order.

**U13.2 — structural item changes against existing OPs. RULED: stricter than
recommended.**
Structural item change means changing `modelo_id`, changing `metros`, inserting
an item or removing an item. While no related OP exists, structurally valid
changes may be applied. Once **any** related OP exists — in any status,
including `simulada` and `cancelada` — structural changes are refused by the
generic administrative save, by client submission and by approval, with
`PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP`. Approval confirmation is not an
override and no parameter unlocks it. No RPC in this phase changes, recreates,
deletes or reconciles `op_itens`. Header fields, general observation and item
observation remain editable by lifecycle; priority continues through
`definir_prioridade_pedido()` with its existing impact confirmation.

**FORWARD CORRECTION (2026-07-29 — `PEDIDO-ITEM-MENTION-OBSERVATION-UX-DESIGN-R1`).**
The clause immediately above is **amended** for the administrative surfaces.
Its binding meaning is now: header fields and the Pedido-level general
observation remain editable by lifecycle; administrative **per-item observation
creation and editing are retired**; any existing per-item observation is
preserved as **read-only compatibility data**; structural item fields remain
governed by the post-OP block stated above; and this amendment neither deletes
nor reinterprets stored historical data. The original sentence is retained
above as accepted history and is not rewritten. See
`## Update 2026-07-29 — Pedido item mention and general observation ruling`.
*R1 had recommended* a graded A–E ladder allowing `metres` and add-item under
explicit impact confirmation at production level C, and a reconciliation at
level D. That is **withdrawn** in full. The ruling replaces a five-level
judgement an executor could evaluate wrongly with one boundary a query answers.

**U13.3 — retirement of `#/pedidos/<uuid>/itens`. RULED as recommended.**
Compatibility redirect to `#/pedidos/<uuid>/editar` in Phase 3; the screen is
retired in Phase 6. Two competing complete item editors are not acceptable.

**U13.4 — scope of `pedidos.revisao`. RULED as recommended.**
One revision covering header, item collection and priority. An unrelated
concurrent item edit therefore invalidates a pending header-only request, which
the client resubmits against the latest accepted state. Purely external
client-visual publication fields do not advance it.

**U13.5 — also ratified without amendment.**
`pedidos.status = 'confirmado'` as the administrative-acceptance boundary;
`prazo_entrega` as the sole expected-delivery owner; `prazo_desejado` as dormant
legacy, unchanged in this phase; the justified hybrid request model; at most one
pending request per Pedido; and the dedicated approval screen with modal use
limited to the final confirmation.

### U14. Schema implementation evidence

Bounded record of what `PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1` actually
shipped. It records evidence, not authority: the semantics above own the
contract.

**Migration.** `db/92_pedido_unified_edit_change_approval_foundation.sql`.
Forward-only, one `BEGIN`/`COMMIT`, idempotent, `db/01..db/91` untouched.
It fails closed on a named prerequisite list — tables, `is_admin()`,
`meu_cliente_id()`, `definir_prioridade_pedido(...)`,
`recalcular_pedido_metros_total(...)`, the four `db/89`/`db/91` guards, the
Pedido↔production linkage columns, and both client creation policies — and
repairs nothing.

**Objects created.**

- `public.pedidos.revisao BIGINT NOT NULL DEFAULT 1`, with
  `pedidos_revisao_normalize` (BEFORE UPDATE on `pedidos`, the sole writer, which
  overwrites any caller-supplied value so the column is monotonic by
  construction and cannot be chosen) and `pedido_itens_revisao_bump` (AFTER
  INSERT/UPDATE/DELETE on `pedido_itens`). Header, item and priority changes
  advance it; `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem` and `status_cliente_atualizado_em` deliberately do
  not, so publishing external status never invalidates a pending request. There
  is no recursion: the item trigger's `SET revisao = revisao + 1` lands in the
  normalizer's "touched but nothing relevant changed" branch and resolves once.
- `public.pedido_alteracao_solicitacoes` and
  `public.pedido_alteracao_solicitacao_itens`, per U6.2, with the closed status
  CHECK, the decision-coherence and rejection-reason CHECKs, the
  `pedido_alteracao_um_pendente_por_pedido_uq` unique partial index, and the two
  immutability triggers that freeze the before-image, the base revision and the
  proposed collection after submission.
- The eight RPCs of U8 plus the ten supporting owners.

**Disposable-cluster validation.**
`tests/pedido-unified-edit-change-approval-invariant.mjs`, one fresh PostgreSQL
18.4 cluster per run, destroyed in Part Z. Proves: `db/01..db/92` apply in order
with `92` terminal; `db/92` replays twice with an identical schema/policy/index/
grant fingerprint and creates zero request rows; the prerequisite gate fails
closed naming the missing object; revision scope and monotonicity; the client
cannot `UPDATE` or `DELETE` Pedido or items directly; the client path works only
through the RPC; `data_pedido` is refused after creation and accepted at
creation; stale-revision saves and approvals change nothing; replacement leaves
exactly one pending request and the unique index refuses a second; structural
change applies with no OP and is refused four ways once an OP exists, including
with `p_confirmar_impacto = true`; item observation and header stay editable
after an OP; a header-only request stays approvable after an OP; removal cannot
orphan a linked row; priority resolves `solicitada` for the client and
`confirmada` for the admin and keeps `db/91`'s acceptance and impact gates; an
injected unexpected failure rolls the live Pedido back and leaves the request
`falha_aplicacao` with the before-image intact; rejection and withdrawal never
touch the Pedido; the client summary exposes no internal field; `anon` has no
execute or table privilege; `authenticated` has no direct DML; and the supplier
sees nothing.

**Static validation.**
`tests/pedido-unified-edit-change-approval-schema.smoke.js` reads files only and
guards the RPC inventory, the `SECURITY DEFINER`/`search_path`/ACL discipline,
the lock order, the absence of a second priority owner, the absence of any write
to production tables, the absence of any change to the `pedidos` and
`pedido_itens` policies, and the ordering that keeps expected refusals outside
the application subtransaction.

**Not done in this phase, by design.** No frontend file was touched. No OP,
`op_itens`, expedition, delivery or business row was created, rewritten,
backfilled or reinterpreted. `prazo_desejado` was not removed. The client
creation policies were not removed. `definir_prioridade_pedido()` was not
redefined.

### U15. Security correction C1 — internal helper execution (db/93)

Order `PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1-C1`. `RISK_CLASS: R3`.
Forward correction of a defect introduced by `db/92` and found on supervisor
review. This subsection amends `U8` and `U9`; it rewrites no historical section.

#### U15.1 The defect

`db/92` called fourteen of its twenty-two functions "supporting owners, not
public API" but never removed their execution privilege from `authenticated`.
The Supabase project carries `ALTER DEFAULT PRIVILEGES` granting `EXECUTE` on
**every** new function in `public` to `authenticated` and `service_role`.
`db/92` revoked only from `PUBLIC` and from `anon`, and in three cases
(`pedido_snapshot`, `pedido_tem_op_relacionada`,
`pedido_item_tem_vinculo_producao`) additionally granted `authenticated`
explicitly.

Measured on production before the correction, **all 22 functions carried
`authenticated=X/postgres`**. Every internal helper was therefore directly
callable by any authenticated user. Because almost all are `SECURITY DEFINER`
and **none of them performs a caller check** — authorization lives entirely in
the eight public RPCs — row-level security on `pedidos` and `pedido_itens`
protected nothing against them: a `SECURITY DEFINER` function executes as the
owner `postgres` and the policy is never consulted.

The exposure was not read-only:

| Helper | Reachable effect for any authenticated caller |
| --- | --- |
| `pedido_snapshot(uuid)` | complete Pedido header + item collection of **any** tenant |
| `pedido_tem_op_relacionada(uuid)` | production existence for any Pedido |
| `pedido_item_tem_vinculo_producao(uuid)` | production linkage for any item |
| `pedido_itens_sequencia(uuid)` | item identifiers of any Pedido |
| `pedido_itens_payload_normalizar(uuid,jsonb)` | validation against another tenant's items |
| `pedido_itens_payload_e_estrutural(uuid,jsonb)` | structural comparison against another tenant's items |
| **`pedido_header_aplicar(uuid,jsonb)`** | **`UPDATE` of any Pedido header** |
| **`pedido_itens_reconciliar(uuid,jsonb)`** | **`INSERT`/`UPDATE`/`DELETE` of any Pedido's item collection** |
| **`pedido_prioridade_aplicar(uuid,boolean,boolean)`** | **production priority of any Pedido** |

The three bolded rows are cross-tenant **write** primitives. This was a
cross-tenant read *and* write exposure, materially broader than a disclosure
path. It is reproduced, not asserted, by Part E of
`tests/pedido-change-approval-helper-privilege-invariant.mjs`, which drives the
attack against `db/92` alone before applying the correction.

**Root cause, stated plainly.** `U9` already recorded that the `authenticated`
revoke is load-bearing for the two request **tables**. The same reasoning was
not applied to **functions**. Default privileges are the rule, not the
exception, and a "REVOKE from PUBLIC and anon" is not a restriction on this
platform.

#### U15.2 Binding rule — the authenticated API is a closed allowlist

Exactly these eight `db/92` functions are executable by `authenticated`:

`salvar_pedido_cliente`, `salvar_pedido_admin`, `solicitar_alteracao_pedido`,
`retirar_alteracao_pedido`, `aprovar_alteracao_pedido`,
`rejeitar_alteracao_pedido`, `cliente_alteracao_resumo`,
`admin_alteracao_comparacao`.

Every other `db/92` function is **owner-only**: `PUBLIC`, `anon`,
`authenticated` and `service_role` all hold no `EXECUTE`. The owner `postgres`
retains it, so the `SECURITY DEFINER` RPCs still call their helpers and the
triggers still fire — PostgreSQL checks `EXECUTE` on a trigger function when
the trigger is created, not on every fire.

The final privilege state is **declared explicitly** by `db/93` for all 22
functions. Nothing relies on a default privilege, in either direction.

**Standing rule for every future migration in this domain.** A function that
performs no caller authorization must never be granted to an application role,
and a migration that introduces one must revoke `PUBLIC`, `anon`,
`authenticated` **and** `service_role` by name. Revoking only `PUBLIC` and
`anon` leaves the function open on this platform.

#### U15.3 Correction to U8 and U9

`U8`'s "Supporting owners, not public API and not granted to `anon`" is
**amended**: the operative property is not "not granted to `anon`", it is
**owner-only**. `U9`'s table row about the `authenticated` revoke now applies
identically to functions. No RPC signature, function body, business rule, table,
column, policy, index or trigger changed; `db/93` is privilege-only.

#### U15.4 Evidence

**Migration.** `db/93_pedido_change_approval_helper_privilege_correction.sql`,
forward-only, idempotent, one transaction, self-verifying: a terminal `DO` block
re-reads `has_function_privilege` for all 22 functions across `anon`,
`authenticated`, `service_role` and the owner, and raises if the intended state
was not reached. Its prerequisite gate fails closed unless `db/92` is present in
full and resolves to exactly 22 functions.

**Disposable-cluster validation.**
`tests/pedido-change-approval-helper-privilege-invariant.mjs`, one fresh
PostgreSQL 18.4 cluster, destroyed in Part Z. Proves: `db/01..db/93` apply in
order with `93` terminal; the defect reproduced under `db/92` alone (14 helpers
open, cross-tenant read, cross-tenant header write, cross-tenant item mutation);
`db/93` idempotent across two replays with zero privilege and zero table-grant
drift; the gate failing closed without `db/92`; the inventory resolving to
exactly 8 public + 14 internal; every internal helper denying `anon`,
`authenticated` and `service_role` while the owner retains execution; all 14
helpers refusing direct invocation with a permission error under all three roles
and leaving both the foreign and the own Pedido byte-identical; all eight RPCs
still functioning; ownership and admin-role checks still enforced by the RPCs
themselves; submission still capturing the before-image internally; the
administrative comparison still assembling `antes`/`atual`/`impacto` internally;
approval, rejection and withdrawal unchanged; revision triggers still firing;
and no table DML privilege restored, with the policy set still at ten.

**Production application.** Preflight recorded the complete 22-function
privilege inventory, terminal `db/92`, no `db/93`, zero request rows and a frozen
table-grant fingerprint. Applied once. Post-apply: terminal is
`93_pedido_change_approval_helper_privilege_correction`; the 14 helpers report
`anon/authenticated/service_role = false` and owner `true`; the 8 RPCs report
`anon = false`, `authenticated = true`, `service_role = true`, owner `true`; a
live `SET LOCAL ROLE authenticated` call of `pedido_snapshot` is refused with
`insufficient_privilege`; the table-grant fingerprint is byte-identical to
preflight; the policy count is unchanged at ten; and
`pedidos=5`, `pedido_itens=36`, `ops=0`, `op_itens=0`, `expedicoes=0`,
`pedido_eventos=0`, `pedido_cliente_eventos=0` and both request tables at zero
are identical to preflight, with every Pedido still at `revisao=1`. No business
row, request row or synthetic row was created, altered or removed.

## Update 2026-07-29 — Pedido item mention and general observation ruling (PEDIDO-ITEM-MENTION-OBSERVATION-UX-DESIGN-R1)

**Status.** RATIFIED product ruling. Binding on the administrative Pedido
surfaces. Recorded as the accepted product contract
`PEDIDO-ITEM-MENTION-OBSERVATION-UX` in `docs/governance/current-state.json`.
This ruling authorizes no implementation by itself; the implementation phase
`PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1` is a separate authorization.

**A. Option selected.** Option A is accepted. The administrative Pedido item
table will no longer expose an editable per-item Observation column. The normal
administrative observation-writing surface is the Pedido-level general
observation field.

**B. Administrative surfaces.** The decision applies to `#/pedidos/novo` and
`#/pedidos/<uuid>/editar`. It does **not** apply to the client Pedido creation
or editing surfaces in this phase.

**C. Item table.** Seven columns, in order: `Img`, `Tipo`, `Modelo`, `Cores`,
`Largura`, `Metragem`, `Ações`. Approved target layout:

- `GRID_COLS` = `60px .70fr 1.45fr 1.15fr .80fr .90fr 92px`
- minimum row/table content width = `790px`

The Observation column is removed. Document-level horizontal overflow remains
**prohibited**; the item table keeps local horizontal scrolling where required.

**D. Administrative Add item modal.** The detailed `Adicionar item` modal
remains part of the accepted dual entry contract and is **not** removed or
replaced. Its per-item observation input is **retired** from the administrative
flow. The modal continues to collect the actual item identity and quantity
fields, and must not create an item observation that becomes invisible
immediately after confirmation.

**E. General observation.** The visible administrative field is identified as
**Observações gerais**. It continues to persist through `pedidos.observacao`.
It remains editable in every non-terminal lifecycle state allowed by the
existing Pedido rules, **including when structural item controls are locked due
to production linkage**.

**F. Mention action.** Each administrative item row receives one discreet
mention action inside `Ações`, **before** the destructive Remove action.
Approved control: `@` icon; canonical owner `window.actionButton`; canonical
30 × 30 action target; non-destructive neutral/accent treatment; `title` =
`Mencionar item {n} nas observações gerais`; accessible label containing the
readable item identity; **disabled** when no model is selected; **available**
when structural controls are locked; **absent or disabled** in terminal
read-only rendering.

**G. Inserted text.** The exact reference format is:

```
@Item {1-based position} — {modelo} · {cor_1}/{cor_2} · {largura}:
```

Example: `@Item 3 — Noite · KRAFT/CRU · 2,10 m: `

Rules: no UUID; no `pedido_item_id`; no database identifier; do **not** include
item metragem; use the current local item state and model projection; format
width in pt-BR; leave the caret after the trailing colon and space.

**H. Text insertion.** On activation: insert at the current selection/caret if
the general observation field has an active usable selection, otherwise append
at the end; add a newline before the mention when needed; focus the general
observation textarea; place the caret after `": "`; update the existing field
state through its normal input path; autosize and bring the field into view when
necessary; do not show a large toast for this local action. Repeated clicks
**deliberately** insert repeated references — deduplication and navigation to an
earlier mention are prohibited.

**I. Snapshot semantics.** The mention is plain text. After insertion it belongs
to the operator's written observation. The application must **not** automatically
rewrite, renumber or remove an existing mention if the item model changes, the
item order changes, the item is removed, or the Pedido is reloaded. Silent
rewriting of operator-written text is prohibited.

**J. Structural lock and persistence.** Mentioning an item is **non-structural**.
After an OP or another production linkage exists: structural item controls remain
locked; the mention action remains available; `Observações gerais` remains
editable; a mention/general-observation-only save must send `p_header`; and
`p_itens` must remain `NULL` when no actual item collection field changed. The
mention interaction must never call an internal helper or a second write path.

**K. Item observation compatibility.** `pedido_itens.observacao` **remains in the
schema**. No migration, data deletion, column removal, RPC signature change or
payload contract change is authorized. The five-key administrative item payload
remains `pedido_item_id`, `modelo_id`, `metros`, `observacao`, `ordem`; the
implementation may continue sending `observacao` as `NULL` when `p_itens` is
legitimately sent. The administrative UI will no longer create or edit per-item
observations. If a loaded item contains a non-empty legacy observation, the
administrative row must expose it through a compact neutral **read-only
compatibility hint** that is visible and keyboard/screen-reader accessible,
preserves the entire text, appears only when a non-empty legacy value exists,
consumes no permanent table column, allows no editing, and is not confusable with
the mention action.

**L. Client surfaces.** `js/screens/cliente-pedido-form.js`, the future client
editor, client change-request submission and the approval screen remain outside
this decision's implementation boundary. Client-created per-item observations, if
any appear in the future, must remain readable to the administrator through the
legacy compatibility hint until a separate cross-role ruling changes that
behaviour.

**M. Contract amendment.** This ruling amends the U13.2 sentence stating that
item observation remains editable by lifecycle; the forward correction is
recorded inline at that sentence, which is retained as accepted history. The
replacement meaning: header fields and the Pedido-level general observation
remain editable according to lifecycle; administrative per-item observation
creation/editing is retired; any existing per-item observation is preserved as
read-only compatibility data; structural item fields remain governed by the
existing post-OP block; and this ruling does not delete or reinterpret stored
historical data. The rest of the accepted design checkpoint is **not** rewritten.

**Evidence supporting the decision.** Measured in a read-only design diagnosis,
not asserted: the existing layout is eight columns at a `920px` minimum width, in
which the Observation column consumed approximately `192px` at desktop and
approximately `144px` at the minimum-width layout; the proposed layout is seven
columns at a `790px` minimum width, in which the `Metragem` column widens
materially; local horizontal scrolling with zero document-level overflow remains
the intended contract at every measured viewport; and production contained
**zero** non-empty `pedido_itens.observacao` values at diagnosis time, which
justifies the UI retirement but does not authorize deleting the column.
