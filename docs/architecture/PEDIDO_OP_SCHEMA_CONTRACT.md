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
