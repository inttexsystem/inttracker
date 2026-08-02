# Purchase Order (Ordem de Compra de Fio) Lifecycle — Specification

> **REFOUNDATION STATUS (2026-07-18):** `RATIFIED / ACCEPTED` by architect order,
> against baseline `f2261ec`, after the final read-only verification returned
> `RATIFIABLE`. **Part R (below) is the governing model** — hardened through **two**
> read-only ratification audits (both `REQUIRES_SPEC_PATCH_BEFORE_RATIFICATION`,
> accepted): the design-gate patch closed the alternatives, and the final structural
> patch closed the structural contracts (legacy source-row identity; exactly two
> native material/origin combinations + DB ownership guard; separate native/legacy
> uniqueness; allocation RPC/trigger split; ledger sign/reversal + append-only;
> explicit `ordem_compra_item_compat_fio` mapping; event-derived `saldo_fios`;
> cutover point-of-no-return; native receipt gate). **Every migration-critical
> decision is CLOSED; no open alternatives remain.** — a four-layer
> refoundation (`necessidade_compra_fio → ordem_compra → ordem_compra_item →
> ordem_compra_item_alocacao`) that **supersedes the flat three-dimension
> `ordens_compra_fio` model** in §0–§8 and the shipped foundation of Phase `A`
> (`db/65`) and Phase `B1` (`db/66`). §0–§11 are **retained for provenance**;
> where they conflict with Part R, **Part R governs**. The ratified decisions
> (three dimensions as header properties, config + freeze-at-emission, decisions
> (a)–(g), per-order supplier, reassignment-blocked, the UI result-check lesson,
> immutable events, future-requirements alignment) **transfer** into Part R
> unless amended there. Part R cites the read-only legacy evidence in
> `docs/reports/ORDEM_COMPRA_LEGACY_DIAGNOSIS_2026-07-18.md` (diagnosis commit
> `de62b16`, architect-ratified conversion counts). Acceptance chain: initial
> proposed-spec commit `c49f369`; design-gate commit `c10e959`; final structural-
> contract commit and acceptance baseline `f2261ec`. **No implementation is
> authorized** — `REFUND-A` and every phase remain `NOT AUTHORIZED` pending their
> own architect orders. The historical acceptance of Phase `A`/`B1` is
> **preserved, not erased**; their flat foundation is superseded, not deleted.
>
> **STRUCTURAL CLARIFICATION (2026-07-18, `REFUND-A PRE-ORDER STRUCTURAL
> CLARIFICATION`):** a REFUND-A pre-order reconciliation found canonical
> contradictions between Part R's earlier "clean re-point of empty event/ledger
> tables" language and the live flat writers that still depend on those tables.
> The architect ruled the migration boundaries: **additive dual-reference** event
> and ledger transition (no destructive re-point), REFUND-A as **schema-and-seed
> only**, a **complete** (byte/count-equivalent) rollback contract, and mandatory
> **MCP-capability** and **Pedido-ownership** read-only preflights. These rulings
> are recorded in the new **§R.20** and applied surgically to §R.3, §R.8, §R.12,
> §R.15, and §R.17. **Part R's historical acceptance is preserved**; this
> clarification refines migration mechanics only.
>
> **IMPLEMENTATION RESULT (2026-07-19, factual annotation, contract unchanged):**
> `REFUND-A` is `CLOSED / ACCEPTED_WITH_BLOCKING_FUTURE_ACTIVATION_DEBT`.
> Migration `db/67_ordem_compra_refoundation_schema.sql` (technical commit
> `eb84071`, staging migration-history identifier `20260719012036 /
> 67_ordem_compra_refoundation_schema`) applied §R.3's four layers +
> `ordem_compra_item_compat_fio` and §R.20's additive dual-reference transition to
> staging `ucrjtfswnfdlxwtmxnoo` only, seeding the ratified conversion exactly (64
> needs / 51 headers / 51 items / 51 allocations / 51 mappings). Flat
> administrative/receipt authority remains on `ordens_compra_fio`, unchanged; no
> reader/writer switched; no production access. The live two-session T1/T2
> allocation-concurrency test (§R.4/§20 of the execution order) was
> architect-waived for this phase and not executed; structural + sequential
> evidence was accepted instead, and **`LIVE_ALLOCATION_T1_T2_TEST_PENDING`** is
> registered as a HARD STOP before PRE-PROD activates allocation (not before
> REFUND-A itself). **New Phase-C activation obligation (this closeout):** the
> canonical receipt writer must enforce the remaining reversible quantity for
> partial/repeated `estorno` reversals (§R.8 Ruling 8) before ledger authority is
> activated — REFUND-A's guards enforce shape/relationship only, not magnitude, by
> design. **`REFUND-B1` is the next authorizable phase, NOT authorized by this
> annotation** — its own separate order is required; `PRE-PROD` and later phases
> remain `NOT AUTHORIZED`. Full record: `docs/ledgers/G28_LEDGER.md` REFUND-A
> staging-verification and acceptance-closeout entries. This annotation records
> facts only; it does not alter any ratified rule, column, constraint, or phase
> gate above.
>
> **REFUND-B1-CONTRACT-R1 (2026-07-19, documentation-only design closure):** the
> first REFUND-B1 native-administrative-authority contract is in **§R.21** below. It
> was **`NOT ACCEPTED AS WRITTEN`** — see **§R.22 (REFUND-B1-CONTRACT-R2)**, which
> governs over the corrected parts of §R.21 (three defects: emission-without-allocation,
> non-idempotent item writer, premature incomplete bridge). **Read §R.22 first** for
> the binding REFUND-B1 boundary: native **draft** administrative authority only —
> **absolute/idempotent** `definir_item_ordem_compra`, `remover_item_ordem_compra`,
> **active** draft `cancelar_ordem_compra`, native `emitir_ordem_compra` **installed
> but granted to no client role** (full-allocation precondition, activatable only in
> PRE-PROD), **no** compatibility bridge (debt
> `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`), a mandatory five-file
> dedicated `#/ordens-compra/:id` screen split, and `db/68_ordem_compra_native_draft_admin.sql`.
> §R.22 also carries the implementation authorization, conditional on its documentation
> gate passing exactly. **`REFUND-B1` is now `CLOSED / ACCEPTED_WITH_RECORDED_FUTURE_GATES`
> (§R.22.18, 2026-07-19)** — implemented, staging-verified, and architect-accepted (visual
> qualification accepted; out-of-manifest test-fixture sync qualified/acceptable;
> `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT` recorded non-blocking). `PRE-PROD` is the next
> authorizable track but is **NOT authorized** by this closeout.
>
> **Status (flat model, superseded on persistence — ratified decisions transfer):**
> `RATIFIED` (2026-07-18, `ORDEM-COMPRA-LIFECYCLE-SPEC-
> RATIFICATION-R1`) — the model, Finding 1's correction (§4/§6/§7(e)), and
> decisions (a)-(g) (§7) are ratified per the architect's ruling recorded in
> §11. Ratification of the model authorizes **no implementation**: no
> schema application, no staging/production action. Phase: `ORDEM-COMPRA-
> SPEC` (docs-only). **Phase A remains `NOT AUTHORIZED`, pending its own
> order.**
> **Precedent:** ratified per the accepted `PURCHASE-ORDER-FOUNDATION-AUDIT`
> and the consolidated architect decisions carried in this track's order.
> **Open governance item (not yet resolved by this ratification):** an
> exhaustive repository/git-history search found no document named
> `PURCHASE-ORDER-FOUNDATION-AUDIT` anywhere in this repo
> (`ORDEM-COMPRA-LIFECYCLE-SPEC-RATIFICATION-R1` review, 2026-07-18). The
> architect is retrieving the original source for verbatim persistence as
> `docs/reports/PURCHASE_ORDER_FOUNDATION_AUDIT_R1_2026-07-18.md`; if
> reported unrecoverable, this banner's "Precedent" line is corrected
> instead to cite the architect's in-chat authorization directly. See §11.
> **Scope of this document:** schema, semantics, gate definition, event
> vocabulary, legacy marking, UI-surface description (conceptual, no mockup —
> mockup gate is the architect's reviewer, now that the model is ratified),
> and phasing for the purchase-order (`ordens_compra_fio`) lifecycle.
> Production gate activation (Phase D) is **specified, not implemented**
> here.
> **Classification:** Contract (design, ratified) — same category as
> `docs/architecture/CAMADA3_BACKUP_CONTRACT.md` and
> `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`. Classification is
> owned by `docs/governance/catalog/documents.json`;
> `docs/DOCUMENTATION_INDEX.md` is its generated compatibility view.
>
> **AMENDED 2026-07-18 (`ORDEM-COMPRA SPEC AMENDMENT`, architect decision):**
> §6 (UI surface) and §8 (phasing) carry an architect amendment — receipt
> registration moves to the purchase order's own detail screen and the
> OP-screen section becomes a **reader**; Phase B is split into **B1** (OP
> reader section + `emitir`/`cancelar` RPCs + RLS revoke), **B2** (order detail
> screen), and **B3** (orders list screen). See the dated amendment blocks in
> §6 and §8. The ratified model (§1), the write-path contracts (§4), the gate
> definition (§5), and the freeze rule (§2.3) are **unchanged** by this
> amendment.

---

## Part R — REFOUNDATION (four-layer persistence model) — RATIFIED / ACCEPTED

> Governing model. Cites `docs/reports/ORDEM_COMPRA_LEGACY_DIAGNOSIS_2026-07-18.md`
> (diagnosis commit `de62b16`) for all legacy facts and the architect-ratified
> conversion counts (64 needs / 51 headers / 51 items / 51 allocations).

### R.1 Domain ownership (Pedido / purchase order / OP)

- **Pedido owns the purchase order.** A purchase order (`ordem_compra`) belongs
  to exactly one Pedido and one supplier (`fornecedor`). Resolution stays on the
  ratified chain — `ordens_compra_fio.op_id → ops.lote_id → lotes.pedido_id`
  (`PEDIDO_OP_SCHEMA_CONTRACT.md` D-B01) — but the header is keyed on
  `pedido_id` directly, not on any single OP.
- **OP does not own the purchase order.** A single OP's yarn requirement is one
  or more *needs*; a purchase order may satisfy needs originating in **several
  OPs of the same Pedido**. Therefore **OP origin is item/allocation-level, never
  header-level** (Flaw 1 / Rule §R.4). Consistent with D-B01 (no `ops.pedido_id`,
  no `pedidos.op_id`).
- **No new commercial FK on OP.** The purchase order references `pedido_id` and
  `fornecedor_id`; OP linkage is carried by the allocation layer.

### R.2 The three internal acts of the Insumos stage

The `insumos` stepper stage (unchanged as a stage) internally comprises three
acts; each is a distinct responsibility with its own surface:

1. **Assessment (apuração).** Compute the Pedido's consolidated yarn requirement
   per material/color and **persist it as `necessidade_compra_fio`** with hybrid
   origin: production-specific cotton remains attached to the real OP that
   calculated its consumption, while genuinely shared polyester belongs to the
   Pedido and carries no OP. Source of the requirement is the existing
   `calcularFiosOP`/`montarOrdensCompraFio` computation — Part R only persists it
   as a first-class need instead of leaving it implicit.
2. **Purchase distribution.** Allocate slices of the need to purchase orders per
   supplier (`ordem_compra_item` + `ordem_compra_item_alocacao`). The
   distribution screen reads `necessidade_compra_fio` and decrements against it;
   allocations make double-distribution structurally impossible (§R.4).
3. **Order lifecycle.** Draft → emit → (accept) → receive → cancel on the
   `ordem_compra` header (three dimensions, §R.6–R.8), on the purchase order's own
   detail screen.

### R.3 Four-layer persistence model (ratified design; not implemented)

All four layers are mandatory (Flaw 1). **All design sub-decisions are CLOSED by
the architect design-gate rulings (2026-07-18); no alternatives remain.** DDL is
ratified as a contract; this document applies no schema.

**Layer 1 — `necessidade_compra_fio`** (Model A — atomic need per origin;
Rulings 1–5). There is **no** `necessidade_compra_fio_origem` child table and
**no** JSONB origin store; each need carries its own single origin, and an
**imported legacy need is identified by its source row**, never by a native
logical key:

```sql
CREATE TABLE public.necessidade_compra_fio (
  id             BIGSERIAL PRIMARY KEY,
  pedido_id      UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,      -- NOT NULL for native (CHECK); NULL only for orphan legacy (OP1/OP2)
  origem_tipo    TEXT NOT NULL CHECK (origem_tipo IN ('op','pedido')),
  op_id          BIGINT REFERENCES public.ops(id) ON DELETE RESTRICT,       -- set iff origem_tipo='op'
  material       TEXT NOT NULL CHECK (material IN ('algodao','poliester')),
  cor_id         BIGINT REFERENCES public.cores(id),                        -- cotton axis
  cor_poliester  TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),          -- polyester axis
  kg_necessario  NUMERIC(12,3) NOT NULL CHECK (kg_necessario >= 0),
  kg_alocado     NUMERIC(12,3) NOT NULL DEFAULT 0
                   CHECK (kg_alocado >= 0 AND kg_alocado <= kg_necessario),  -- §R.4 running cache (trigger-maintained)
  legado         BOOLEAN NOT NULL DEFAULT FALSE,
  legado_origem_ordem_compra_fio_id BIGINT REFERENCES public.ordens_compra_fio(id),  -- Ruling 2: imported-need canonical identity
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT necessidade_origem_shape CHECK (
       (origem_tipo = 'op'     AND op_id IS NOT NULL)
    OR (origem_tipo = 'pedido' AND op_id IS NULL)),
  CONSTRAINT necessidade_um_eixo_cor CHECK ((cor_id IS NOT NULL) <> (cor_poliester IS NOT NULL)),
  CONSTRAINT necessidade_pedido_native CHECK (legado = TRUE OR pedido_id IS NOT NULL),   -- native always has a Pedido
  CONSTRAINT necessidade_legado_ref CHECK (                                              -- source-ref present iff legacy (Ruling 2)
       (legado = FALSE AND legado_origem_ordem_compra_fio_id IS NULL)
    OR (legado = TRUE  AND legado_origem_ordem_compra_fio_id IS NOT NULL)),
  CONSTRAINT necessidade_material_origem CHECK (   -- Ruling 3: exactly TWO native combos; Pedido-origin cotton forbidden; OP-origin polyester legacy-only
       (legado = FALSE AND material = 'algodao'   AND origem_tipo = 'op')       -- native cotton = OP-origin
    OR (legado = FALSE AND material = 'poliester' AND origem_tipo = 'pedido')   -- native polyester = Pedido-origin (shared)
    OR (legado = TRUE  AND origem_tipo = 'op')                                  -- legacy import = OP-origin (cotton or polyester)
    OR (legado = TRUE  AND origem_tipo = 'pedido' AND material = 'poliester'))  -- (legacy Pedido-level polyester, if ever)
);
```
**Native persistence permits exactly two material/origin combinations:**
`(algodao, op)` and `(poliester, pedido)`. **Pedido-origin cotton is forbidden**
(native and legacy); **OP-origin polyester is legacy-only** (every diagnosed legacy
polyester row is per-OP). Any future native combination is a separate architect
decision + schema phase. There is **no** parent-total/child-total invariant
(Ruling 1). `pedido_id` is NULL **only** for the orphan null-Pedido legacy OPs
(OP1/OP2) — §R.10.7.

**Write authority & ownership (Ruling 5).** `authenticated`/`anon` receive **no**
direct `INSERT`/`UPDATE`/`DELETE` on `necessidade_compra_fio`; the canonical
`SECURITY DEFINER` writers (native assessment/recalculation; controlled legacy
import) are the only application write surface. A **database ownership guard**
(constraint trigger) verifies transactionally, on every INSERT and relevant UPDATE
**regardless of caller** (including `service_role`/migration), that a native
OP-origin need satisfies `op_id → ops.lote_id → lotes.pedido_id =
necessidade_compra_fio.pedido_id` — **RPC validation alone is insufficient**.
Legacy exception: `legado=TRUE`, `op_id` present, `legado_origem_ordem_compra_fio_id`
present, `pedido_id` NULL only when import resolved no Pedido; if a legacy need
carries a `pedido_id`, its OP/Pedido relationship must also pass the guard.

**Need identity (Rulings 2 & 4) — native and legacy uniqueness are SEPARATE:**

```sql
-- NATIVE cotton: one per (pedido, op, cor)
CREATE UNIQUE INDEX necessidade_native_algodao   ON public.necessidade_compra_fio
  (pedido_id, op_id, cor_id)
  WHERE legado = FALSE AND material = 'algodao'   AND origem_tipo = 'op';
-- NATIVE shared polyester: one per (pedido, cor_poliester), op_id NULL
CREATE UNIQUE INDEX necessidade_native_poliester ON public.necessidade_compra_fio
  (pedido_id, cor_poliester)
  WHERE legado = FALSE AND material = 'poliester' AND origem_tipo = 'pedido';
-- LEGACY import: identity IS the source row (never nullable-Pedido equality)
CREATE UNIQUE INDEX necessidade_legado_origem    ON public.necessidade_compra_fio
  (legado_origem_ordem_compra_fio_id)
  WHERE legado = TRUE;
```
- **No native logical-identity index exists for OP-origin polyester or
  Pedido-origin cotton** (they cannot be created natively). **Legacy duplicate
  prevention derives from source-row uniqueness**, not nullable-Pedido equality —
  so the OP1/OP2 null-Pedido rows can neither duplicate nor collapse (each keyed by
  its unique `ordens_compra_fio` source id), and two historical rows that happen to
  share OP/material/color/supplier/state are **not** merged.
- **Cotton** = one native need per (Pedido, OP, color); two OPs of the same Pedido,
  same cotton color = **two** needs (CASE 1), aggregated only in a read
  model/view/UI (CASE 2 = one need, two allocations to two suppliers).
- **Shared polyester** = one native need per (Pedido, color), `op_id NULL` (CASE 3);
  a later shared acquisition reconciles the same row or a distinct color row (CASE 4).
- **Recalculation** locates and updates the existing **native** logical need (never
  a duplicate); `kg_necessario` cannot drop below `kg_alocado` (RPC HARD-STOP + the
  `kg_alocado <= kg_necessario` CHECK); **imported legacy quantities are not
  silently recalculated as native requirements.**
- **Legacy conversion unchanged — 64 needs:** each of the 64 diagnosed source rows
  imports as one atomic need keyed by its `ordens_compra_fio` source id (§R.10).

**Layer 2 — `ordem_compra`** (header):

```sql
CREATE TABLE public.ordem_compra (
  id                          BIGSERIAL PRIMARY KEY,
  pedido_id                   UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,   -- NULL only for null-pedido legacy
  fornecedor_id               BIGINT REFERENCES public.fornecedores(id),             -- NULL only for grandfathered legacy (§R.10.4)
  status_administrativo       TEXT NOT NULL DEFAULT 'rascunho'
                                CHECK (status_administrativo IN ('rascunho','emitida','cancelada')),
  status_aceite               TEXT NOT NULL DEFAULT 'nao_aplicavel'
                                CHECK (status_aceite IN ('nao_aplicavel','pendente','aceita','rejeitada')),
  status_recebimento          TEXT NOT NULL DEFAULT 'nao_recebido'
                                CHECK (status_recebimento IN ('nao_recebido','parcial','recebido')),
  aceite_exigido_na_emissao   BOOLEAN,                       -- frozen config snapshot at emission
  legado                      BOOLEAN NOT NULL DEFAULT FALSE,
  legado_provenance           TEXT CHECK (legado_provenance IN
                                ('emitido_recebido','emitido_nao_recebido','recebido_sem_emissao')),  -- Ruling 4 domain; NULL for native
  emitida_em TIMESTAMPTZ, emitida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelada_em TIMESTAMPTZ, cancelada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aceite_decidida_em TIMESTAMPTZ, aceite_decidida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aceite_motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ruling 4: provenance only on legacy; a NATIVE header can never be the
  -- unemitted-yet-received anomaly (Class D is representable only as legado=TRUE).
  -- Coexistence-compatible: a native header's status_recebimento stays
  -- 'nao_recebido' while receipt is read from the flat compatibility source
  -- (§R.11), so this CHECK never fires on a live native draft.
  CONSTRAINT ordem_compra_provenance_scope
    CHECK (legado = TRUE OR legado_provenance IS NULL),
  CONSTRAINT ordem_compra_no_native_anomaly
    CHECK (legado = TRUE
        OR NOT (status_administrativo = 'rascunho' AND status_recebimento <> 'nao_recebido'))
);
-- Rule 1 uniqueness — one NATIVE active draft per (pedido, fornecedor); legacy/null-supplier excluded:
CREATE UNIQUE INDEX ordem_compra_um_rascunho_ativo
  ON public.ordem_compra (pedido_id, fornecedor_id)
  WHERE status_administrativo = 'rascunho' AND legado = FALSE AND fornecedor_id IS NOT NULL;
```

**Layer 3 — `ordem_compra_item`** (a header's material/color line):

```sql
CREATE TABLE public.ordem_compra_item (
  id             BIGSERIAL PRIMARY KEY,
  ordem_id       BIGINT NOT NULL REFERENCES public.ordem_compra(id) ON DELETE CASCADE,
  material       TEXT NOT NULL CHECK (material IN ('algodao','poliester')),
  cor_id         BIGINT REFERENCES public.cores(id),
  cor_poliester  TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  kg_pedido      NUMERIC(12,3) NOT NULL CHECK (kg_pedido > 0),
  kg_recebido    NUMERIC(12,3) NOT NULL DEFAULT 0,     -- transitional cache during coexistence; ledger-derived post-Phase C (Rule 2)
  CHECK ((cor_id IS NOT NULL) <> (cor_poliester IS NOT NULL))
);
```

**Layer 4 — `ordem_compra_item_alocacao`** (item-slice → need; mandatory):

```sql
CREATE TABLE public.ordem_compra_item_alocacao (
  id              BIGSERIAL PRIMARY KEY,
  item_id         BIGINT NOT NULL REFERENCES public.ordem_compra_item(id) ON DELETE CASCADE,
  necessidade_id  BIGINT NOT NULL REFERENCES public.necessidade_compra_fio(id) ON DELETE RESTRICT,
  op_id           BIGINT REFERENCES public.ops(id) ON DELETE RESTRICT,   -- OP-origin of the satisfied need-share (Flaw 1)
  kg_alocado      NUMERIC(12,3) NOT NULL CHECK (kg_alocado > 0)
);
```

The receipt ledger (`ordem_compra_fio_lancamentos`, ratified §3.2) and the event
table (`ordem_compra_eventos`, ratified §3.4) are **NOT re-pointed in REFUND-A**.
Their existing legacy references to `ordens_compra_fio` are **retained** (the live
`emitir_ordem_compra_fio`/`cancelar_ordem_compra_fio` writers still write
legacy-referenced events); REFUND-A **adds** a nullable new-model reference to each
(`ordem_compra_id` on the event table, `ordem_compra_item_id` on the ledger) under
an **exactly-one-model** constraint, and switches no writer. The final switch of
each reference to the new model happens in a later explicitly authorized phase
(events at REFUND-B1, ledger at Phase C); the legacy reference is dropped only in a
still-later, separately authorized cleanup after reconciliation. See the additive
event transition (§R.20.1) and receipt-ledger transition (§R.20.2) contracts. No
historical row is rewritten or silently re-pointed (§R.12).

### R.4 Allocation invariants — double-distribution enforcement (Ruling 3, single design)

**Canonical write surface.** `authenticated`/`anon` receive **no** direct
`INSERT`/`UPDATE`/`DELETE` on `ordem_compra_item_alocacao`. All allocation change
occurs through canonical `SECURITY DEFINER` RPCs — at minimum
`alocar_necessidade_compra_fio(item_id, need_id, kg)` and
`remover_alocacao_compra_fio(alocacao_id)`; the future corrected writer derives
allocation provenance from the locked need and accepts no caller-selected OP;
no generic table mutation is exposed. Allocation **UPDATE is not a public
operation** — a quantity change is a controlled remove + insert inside the writer.
Allocation insert/remove are permitted **only while the parent `ordem_compra` is
an active draft**; **after issuance, allocations are immutable**.

**RPC responsibility (Ruling 6), in order.** The canonical `SECURITY DEFINER`
allocation RPC: (1) `SELECT … FOR UPDATE` on the `necessidade_compra_fio` row;
(2) locks or verifies the parent `ordem_compra`; (3) confirms it is **native, an
active draft, and eligible** for allocation mutation; (4) validates the requested
semantic operation; (5) **inserts or deletes** the allocation row; (6) returns the
resulting state. Multi-need semantic operations lock needs in **ascending `id`
order** (deterministic, deadlock-safe).

**Trigger responsibility — sole `kg_alocado` maintainer.**
`necessidade_compra_fio.kg_alocado` is maintained **solely** by the allocation
trigger, guarded by `CHECK (kg_alocado >= 0 AND kg_alocado <= kg_necessario)`. On
each allocation INSERT/DELETE the trigger **does not** create/modify/delete the
allocation row; it applies the delta (`+kg` insert, `−kg` removal) to `kg_alocado`,
using the need-row lock the RPC already holds (or acquiring the same row lock
defensively), lets the CHECK reject over-allocation or a negative result, and runs
in the **same transaction** as the allocation mutation — so any failure rolls back
both. **Neither the RPC nor application code writes `kg_alocado` directly** — one
sole maintainer, no double-maintenance.

**Write-skew rule (the T1/T2 race, explicitly).** T1 and T2 each try to allocate
the same remaining 50 kg of one need. Both must take that **need row's lock**
(step 1); one wins, the other **blocks** until the first commits, then
**re-evaluates** against the committed `kg_alocado` and **fails the CHECK**
(`50 + 50 > 50`). **Rejected** (Ruling 3): application-only validation; a bare
trigger doing `SUM(...)` without locking the need row; any aggregate query without
row serialization. Only the locked-cache design prevents write skew, not merely
sequential over-allocation — making **double distribution structurally
impossible**.

**Cache integrity.** The trigger/function is the only normal maintainer of
`kg_alocado`. A blocking audit compares `kg_alocado` against `SUM(kg_alocado of
active allocations)` per need; any drift is an invariant **violation** (blocking);
any repair is an **explicitly authorized maintenance operation**, never a silent
application correction.

**Item integrity & hybrid origin.** `item.kg_pedido = SUM(item's allocations.
kg_alocado)` is the only authoritative item quantity (physical over-receipt is
receipt-time, routed to `saldo_fios` §R.9, never an allocation). An OP-origin
allocation carries exactly the need's real OP. A Pedido-origin shared allocation
carries `op_id IS NULL`; its Pedido/material/color traceability remains complete
through the need and allocation. One item may consolidate allocations from several
OP-origin needs and from shared Pedido-origin needs; the header and item carry no
exclusive OP ownership.

### R.5 Native accumulating drafts (Rule 1) + new draft after emission

- **One native active draft per `(pedido, fornecedor)`** (partial unique index,
  §R.3). New distributed slices for the same `(pedido, fornecedor)` **accumulate
  as items into that one open draft**.
- **After emission**, the draft closes; a **new** draft for the same
  `(pedido, fornecedor)` may then be opened — Rule 1 constrains only the *active
  draft*, not the historical count (multiple emitted orders for the same
  `(pedido, fornecedor)` are legitimate).
- **Native supplier requirement:** a native draft/order **must** have a
  `fornecedor_id`; emission requires it (carried from the ratified B1 `emitir`
  precondition). `NULL fornecedor_id` is allowed **only** for grandfathered legacy
  headers (§R.10.4) and those **do not** participate in this uniqueness rule
  (index `WHERE … fornecedor_id IS NOT NULL AND legado = FALSE`).
- **Rule 1 is a draft-accumulation rule, not a historical-identity rule** — it
  never merges converted legacy headers and never establishes that two legacy
  rows were one historical order (§R.13, Flaw 2).

### R.6 Issuance freeze + immutable emitted order + cancel-and-replace

- **Emission freezes** the order's `fornecedor_id`, its item set + `kg_pedido`
  quantities, and the acceptance policy snapshot (`aceite_exigido_na_emissao`
  ← live `ordem_compra_config.exige_aceite`, ratified freeze rule §2.3).
- **An emitted order's contents are immutable.** No in-place edit of supplier,
  items, or quantities after `emitida` (ratified decision (f)).
- **Correction path = cancel + replace**, never edit: cancel the emitted order
  and open a new draft (ratified decisions (d)/(f); reassignment-after-emission
  blocked, ratified B1). This keeps the `ordem_compra_eventos` trail honest.

### R.7 Acceptance lifecycle

Transfers unchanged from ratified §2.2/§4/§7: config-gated at emission
(`nao_aplicavel` when `exige_aceite=false`; `pendente` when true), then
`aceita`/`rejeitada` by explicit decision; admin-on-behalf always allowed
(decision (b)); admin override of a rejection via a distinct
`aceite_override_admin` event with mandatory motive (decision (c)); no undo
(decision (d)); receipt blocked until `status_aceite IN ('nao_aplicavel','aceita')`
(Finding 1). Now attaches to `ordem_compra` (header) instead of the flat row.

### R.8 Item-level receipt — immutable ledger + derived state (Rulings 5 & 6)

**Single ledger-derived model after Phase C.** After Phase C,
`ordem_compra_item.kg_recebido` and `ordem_compra.status_recebimento` derive
**exclusively** from the ledger; there is **no** `kg_recebido_inicial` column in
the permanent derivation (Ruling 5).

**Canonical receipt ledger contract** (append-only; the new-model
`ordem_compra_item_id` reference is **added nullable** in REFUND-A and becomes the
sole applicable parent only at Phase C — the legacy `ordens_compra_fio` reference is
retained through coexistence, exactly-one-parent enforced, §R.20.2), with
**structural sign & reversal invariants (Rulings 7–8):**
- `item_id` FK → `ordem_compra_item` (the new-model parent, applicable post-Phase-C);
- `tipo ∈ {recebimento, import_saldo_inicial, estorno}`;
- **sign CHECKs:** `recebimento` ⇒ `kg > 0` and `estorno_de_id IS NULL`;
  `import_saldo_inicial` ⇒ `kg > 0` and `estorno_de_id IS NULL`; `estorno` ⇒
  `kg < 0` and `estorno_de_id IS NOT NULL`;
- `estorno_de_id` FK → the reversed entry, which **must be a positive
  `recebimento`/`import_saldo_inicial` of the SAME `item_id`** — an estorno may not
  reference another item's entry, another estorno, or itself;
- **append-only enforced two ways:** `REVOKE UPDATE, DELETE` **and** a database
  mutation guard (trigger) rejecting UPDATE/DELETE even from privileged paths;
- `idempotency_key TEXT NOT NULL UNIQUE` — retrying the same receipt/correction
  creates no second row;
- `origem_tipo` + `origem_ref`; optional document/event reference; `criado_por`;
  `criado_em`.
`kg_recebido = SUM(ledger.kg)` per item; `status_recebimento` derived (`0` →
`nao_recebido`, `< kg_pedido` → `parcial`, `>= kg_pedido` → `recebido`).

**Partial & repeated reversals (Ruling 8).** Multiple `estorno` rows may reference
the same positive entry, provided `SUM(ABS(valid estornos of the entry)) <=
original positive kg`. Before inserting an estorno the canonical writer: (1) locks
the referenced positive entry; (2) locks the item receipt-state serialization row;
(3) computes remaining reversible quantity; (4) **rejects over-reversal**;
(5) inserts the compensating negative entry. Invariants: cumulative ledger-derived
`kg_recebido` **cannot go negative**; mutation never replaces compensation; a full
reversal is where the compensating sum equals the original.

**Native receipt lifecycle gate (Ruling 12).** Canonical native receipt is
permitted **only** when `status_administrativo = 'emitida'` (**not** `rascunho`,
**not** `cancelada`) **and** `status_aceite IN ('nao_aplicavel','aceita')`
(Finding 1) — items, allocations, and supplier are frozen at emission (§R.6).
**Receipt before issuance is prohibited.** Class-D imported physical receipt is a
*legacy import* exception (import ledger entry) and does **not** authorize native
receipt against its historical draft state.

**No opening balance during REFUND-A.** While the old writers are live, **no**
opening ledger entry is created from a snapshot that may still change (Ruling 5);
the new model **reads** legacy receipt through the compatibility mapping (§R.11); no
receipt is counted from both the flat snapshot and the ledger.

**Phase-C cutover — one controlled maintenance window (Ruling 10):**
1. **fence** both legacy receipt writers; the fence is **verified by write-denial
   evidence** (no new flat receipt mutation accepted);
2. take the **final** authoritative receipt snapshot from every mapped source row;
3. create **exactly one** immutable `import_saldo_inicial` entry per **nonzero**
   mapped balance (zero balances create none), `idempotency_key` derived from
   **mapping identity + item identity + cutover identifier** (re-run inserts
   nothing);
4. migrate **both** consumers to the canonical ledger writer;
5. **reconcile** ledger-derived totals against the frozen snapshots;
6. switch receipt **reads** to the ledger;
7. revoke direct `kg_recebido` `UPDATE`;
8. close `ORDEM-COMPRA-B1-KG-RECEBIDO-ACL-GAP` **only after** reconciliation passes.
**Point of no return = the first accepted canonical receipt write after read
authority switches (step 6).** **Before** it: rollback returns to flat reads with
legacy writers kept fenced (re-enabled only after proving no canonical receipt
write was accepted); direct flat `UPDATE` stays unreleased. **After** it: recovery
is **forward-only** — never silently return to mutable flat authority; keep legacy
writers fenced; correct via idempotent import completion, reconciliation, and
compensating ledger entries. An `import_saldo_inicial` entry is an explicitly-typed
import, **not** a fabricated emission/acceptance; imported Class-A/D receipt
survives without double-counting (Rule 2).

### R.9 Over-receipt → saldo_fios (event-derived reconciliation, Ruling 11)

Physical receipt may exceed `kg_pedido`; the ledger records the **full** physical
quantity. The split is derived per item from the immutable ledger, never
double-counted:
- **attributable receipt** = `min( cumulative_received , kg attributable to the
  item's (immutable, issued) allocations )`;
- **surplus** = `max( cumulative_received − attributable , 0 )` → `saldo_fios`.
The same kilogram is never both need-satisfaction and general stock. Because
allocations are **immutable after issuance** (§R.4) and native receipt is gated to
post-emission (§R.8), attributable capacity is **stable** during receipt
processing. **Saldo is credited per ledger EVENT, not by recomputing a mutable
total:** for each receipt-ledger entry, `surplus_delta = surplus_after_entry −
surplus_before_entry`, written as one stock movement through the canonical saldo
writer, with:
- the source **receipt-ledger entry id** stored on the movement;
- movement identity **UNIQUE by (source ledger entry, movement type)** — repeated
  processing of the same entry creates **no duplicate credit**;
- positive `recebimento`/`import_saldo_inicial` entries → **positive** surplus
  movement; `estorno` entries → **negative** surplus movement, so **stale surplus
  after an estorno is corrected**, never left credited;
- ledger entry and saldo movement written **transactionally**, or via an
  explicitly-defined **resumable idempotent outbox** in the implementing phase;
- total stock movements for an item **reconcile** to its current derived surplus.
The exact `saldo_fios` writer belongs to its authorized phase, but this immutable
source-event + idempotency + reconciliation contract is fixed now. The diagnosed
**+405.98 kg** proves the surplus path is required.

### R.10 Legacy conversion (architect-RATIFIED)

**Ratified rule:** every header-bearing legacy source row converts **1:1** into
its own legacy `ordem_compra` header; **no legacy rows are ever auto-merged**;
Class C converts to needs only.

**Ratified counts (from diagnosis `de62b16`):** **64 needs / 51 headers /
51 items / 51 allocations.**

| Class | Rows | Needs | Headers | Items | Alloc | Conversion |
|---|---:|---:|---:|---:|---:|---|
| A legacy emitted+received | 27 | 27 | 27 | 27 | 27 | 1:1 header, `emitida`+`recebido`, `legado`, `fornecedor` NULL, received frozen |
| B legacy emitted, unreceived | 12 | 12 | 12 | 12 | 12 | 1:1 header, `emitida`, `legado`, NULL supplier grandfathered |
| C clean draft | 13 | 13 | 0 | 0 | 0 | **needs only**, no header |
| D draft, direct-write received | 12 | 12 | 12 | 12 | 12 | 1:1 header, receipt preserved, provenance `recebido_sem_emissao` |
| **Total** | **64** | **64** | **51** | **51** | **51** | |

- **R.10.4 Supplier-null legacy exception:** `fornecedor_id` may be NULL **only**
  for grandfathered converted legacy headers whose source lacked a supplier
  (60/64 rows). These are excluded from Rule 1's uniqueness. NULL is **never a
  legacy merge key** (Flaw 2).
- **R.10.5 Class-D provenance (received-without-emission) — Ruling 4:** the
  `legado_provenance` domain is **constrained** (CHECK, §R.3 `ordem_compra`), not
  free text. Enumerated header provenances: `'emitido_recebido'` (A),
  `'emitido_nao_recebido'` (B), `'recebido_sem_emissao'` (D). **Class C gets no
  header** (needs-only) → **no** header provenance value for it. Class-D rows:
  `legado=TRUE`, `legado_provenance='recebido_sem_emissao'`, retain the original
  `rascunho` administrative provenance **and** the physical receipt fact; they
  **cannot** accumulate native items, be edited as native drafts, be emitted, or
  fabricate emission/acceptance events (excluded by the partial-unique index
  `WHERE legado=FALSE`; rejected by the native write RPCs). The table invariant
  `ordem_compra_no_native_anomaly` (§R.3) forbids a **native** row from being
  `rascunho` with nonzero receipt — the anomaly is representable **only** as
  legacy; it is coexistence-compatible because a native header's
  `status_recebimento` stays `nao_recebido` while receipt is read from the flat
  compatibility source (§R.11).
- **R.10.6 OP36 — legacy vs native (kept distinct):** LEGACY conversion → **4
  headers** (rows 137→f4, 138→f5, 139→f22, 140→f22, each its own header, no shared
  historical identity). FUTURE NATIVE (same distribution created new) → **3
  headers** (f4:1 item, f5:1 item, f22: one header, 2 items — Rule-1 accumulation).
  Migration preserves historical identity; native creation follows the
  accumulator. The two are never conflated.
- **R.10.7 Null-Pedido legacy import (OP1/OP2) — Ruling 2:** the 11 diagnosed
  null-Pedido rows (OP1/OP2, all Class A) import as legacy headers (`legado=TRUE`,
  `fornecedor_id` NULL) with needs `origem_tipo='op'`, `op_id` set, **each keyed by
  its unique `legado_origem_ordem_compra_fio_id`** (source-row identity — **not**
  nullable-Pedido equality), so they can neither duplicate nor collapse. If
  `ops.lote_id → lotes.pedido_id` resolves a Pedido it is used; the diagnosis showed
  these two are **orphan test OPs with no Pedido**, so their needs carry
  `pedido_id = NULL` under the `legado=TRUE` exception (CHECK
  `necessidade_pedido_native`; the `legado` branch of `necessidade_material_origem`).
  They never participate in native accumulation. **Reporting:** these rows group
  under an explicit **legacy-unresolved-Pedido bucket** while retaining OP and
  source-row identity — they are **never** presented as Pedido-level shared needs.
  Count unchanged — 11 within Class A's 27 (11 needs / 11 headers / 11 items /
  11 allocations). A REFUND-A import-migration detail; **no native (non-`legado`)
  need may have a NULL `pedido_id`.**

### R.11 Coexistence authority (per dimension) + Phase-C cutover (Ruling 7, Flaw 3)

Authority is **split by dimension and explicitly reconciled** — the two models are
**never** equal authorities.

| Phase | Admin authority | Receipt authority | Compat bridge | Notes |
|---|---|---|---|---|
| **REFUND-A** | flat `ordens_compra_fio` | flat | built, **inactive** | New schema + legacy mapping only; no live writer switched; no production. |
| **REFUND-B1** | **`ordem_compra`** (new) | flat | **active** | New model authoritative for administrative identity/lifecycle; legacy rows keep an explicit source mapping; flat admin columns are **mirrors, not competing authority**. |
| **PRE-PROD / B2** | `ordem_compra` (new) | flat | **active** | Admin writes originate in the new model and mirror only the compat fields the old consumers need; receipt writers mutate only the flat receipt snapshot. |
| **C** | `ordem_compra` (new) | **→ canonical ledger** | retiring | Fence flat receipt → import snapshots → migrate both consumers → reconcile → switch reads → revoke flat UPDATE → retire compat receipt path (§R.8). |
| **after C** | `ordem_compra` (new) | canonical ledger (new) | read-only/temporary | Flat table is **no longer a live receipt authority**; any residual projection is read-only and explicitly temporary. |

**Explicit one-to-one compatibility mapping (Ruling 9)** — a dedicated table, not a
prose promise:

```sql
CREATE TABLE public.ordem_compra_item_compat_fio (
  ordem_compra_item_id  BIGINT NOT NULL UNIQUE REFERENCES public.ordem_compra_item(id),
  ordens_compra_fio_id  BIGINT NOT NULL UNIQUE REFERENCES public.ordens_compra_fio(id),
  origem                TEXT NOT NULL CHECK (origem IN ('imported_legacy','native_bridge')),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por            UUID REFERENCES auth.users(id) ON DELETE SET NULL   -- or migration provenance
);
```
The **two `UNIQUE` constraints establish one-to-one in both directions.** The
mapping is **immutable** — neither id changes, and it is **not** deleted when the
order is cancelled (historical mappings stay auditable). **Creation timing:**
- **REFUND-A** — Class A/B/D imported items map to their **exact original**
  `ordens_compra_fio` source rows (`origem='imported_legacy'`; the same row the item
  was imported from — deterministic). **Class C creates no item → no mapping.**
- **REFUND-B1 / PRE-PROD / B2** — before a native item becomes visible to either
  legacy receipt writer, one canonical transactional bridge (1) creates its flat
  compatibility row, (2) creates the one-to-one mapping (`origem='native_bridge'`),
  (3) commits both. **A receivable native item cannot exist in a bridge-dependent
  phase without an active mapping.**
The two existing receipt writers (`registrarRecebimentoOrdemFio`,
`op-writes.js:29-43`; `screenFornecedorOrdens`, `fornecedor.js:461-463` — the
`SUPPLIER_RECEIPT_WRITE_PATH_DISCOVERED` writer) locate the flat row **through this
explicit mapping, not by material/color inference**, and mutate **only** the flat
receipt snapshot until Phase C. Read models compose **administrative state from the
new model** and **receipt state from the mapped flat source**; the flat admin
columns are **compatibility data, not competing authority**. Direct flat
`kg_recebido` `UPDATE` is revoked **only after** both consumers migrate (Phase C);
`ORDEM-COMPRA-B1-KG-RECEBIDO-ACL-GAP` closes only then, after reconciliation. This
is **not** two equal authoritative models — authority is split by dimension.

### R.12 Immutable events (Flaw 4)

`ordem_compra_eventos` rows are immutable historical facts — never silently
re-pointed, deleted-and-recreated, rewritten, or synthesized to conceal an
inconsistent source. REFUND-A does **not** re-point the existing
`ordens_compra_fio` reference at all: it **adds** a nullable new-model reference
alongside it and switches no writer (§R.20.1). The existing legacy reference and
every original column are preserved; historical rows are never re-pointed. Staging
currently holds **0 events and 0 ledger rows** (diagnosis §1), but the additive
transition does not rely on emptiness — even a populated event table keeps its
legacy references intact, because the new reference is nullable and the exactly-one-
model constraint admits legacy-only rows. **This does not weaken the rule** and
**must not be generalized to production** — a contemporaneous production diagnosis
is mandatory (§R.14) before any production event/ledger touch.

### R.13 Native vs legacy identity semantics

- **Native identity:** `(pedido, fornecedor)` is the *active-draft accumulation*
  key (Rule 1) — a forward-looking rule for new orders.
- **Legacy identity:** each converted legacy header stands alone (1:1). A shared
  `(pedido, fornecedor)` among legacy rows proves only that they *would* have
  accumulated natively — **not** that they were one historical order (no shared
  order id / issuance / receipt / document). The two semantics are never merged
  (Flaw 2).

### R.14 Production diagnosis precondition (binding)

Production's current `ordens_compra_fio` row-set was **not** revalidated this
session and is **UNKNOWN for migration purposes**. "Started empty" history
(M3 exclusion set) **does not** replace a contemporaneous diagnosis. **A complete
read-only production diagnosis is mandatory immediately before any production
promotion or migration in this track.** Production access remains prohibited now.

### R.15 Migration safety & rollback boundaries

- **Seed-only, additive:** the refoundation migration creates the four new tables +
  the compatibility mapping table and seeds them from `ordens_compra_fio` in one
  transaction; it **adds** only nullable transitional references (plus their
  constraints/indexes/triggers/functions) to the event and ledger tables; it
  **alters no existing column, drops nothing, and switches no writer**.
  `ordens_compra_fio` remains the live source of truth through cutover.
- **Complete rollback contract (replaces the earlier "drop the four tables"
  boundary; Ruling 4, detailed in §R.20.4):** a REFUND-A rollback must restore the
  **exact** pre-migration schema and data state by (1) dropping all four newly
  created four-layer tables; (2) dropping the compatibility mapping table
  (`ordem_compra_item_compat_fio`); (3) removing **only** the additive event and
  ledger columns, constraints, indexes, triggers and functions introduced by
  REFUND-A; (4) preserving every original event/ledger column and the legacy writer
  contract; and (5) proving `ordens_compra_fio` and all existing flat data are
  **byte/count equivalent** to the pre-migration snapshot. **No destructive
  transformation is permitted in REFUND-A.**
- **No production in scope:** every count/rule here derives from the staging
  corpus; production migration is a separate, later, diagnosis-gated act (§R.14).
- **No silent merge, no fabricated event, no double-counted receipt** (Flaws 2/4,
  Rule 2) — enforced by the conversion rules above.

### R.16 Permanent UI governance

- **Transition modals contain actions only** — the `insumos` (and every)
  transition modal exposes the next canonical action, not entity CRUD.
- **Every entity lives on its own dedicated screen** — the purchase order's home
  is its detail screen (route `#/ordens-compra/:id`, Phase B2); receipt
  registration and event history live there, not in a transition modal. The OP
  screen keeps the reader + distribution + `Iniciar produção` only.

### R.17 Rephased track — per-phase gates (none authorized)

Authority per dimension is the matrix in §R.11. **No phase implies simultaneous
equal authority, receipt-writer revocation before both consumers migrate, an
unapproved production migration, or automatic authorization of the next phase.**
Each phase requires its **own migration authorization** where it touches schema,
and its **own architect UI validation** where it touches UI.

- **REFUND-A** — *Responsibility:* schema-and-seed only (§R.20.3) — create the four
  layers + the compatibility mapping table; **add** the nullable transitional
  event/ledger references (no re-point, §R.20.1/§R.20.2); seed from
  `ordens_compra_fio` per the ratified 1:1 conversion (64/51/51/51); build the
  compatibility mapping **inactive**. Leaves all live admin + receipt authority on
  `ordens_compra_fio`; switches no reader/writer; revokes no flat privilege; creates
  no opening receipt balance. *Preflights (read-only, HARD STOP on failure):*
  MCP-capability fingerprint of `ucrjtfswnfdlxwtmxnoo` + write-capability/role check
  (§R.20.5); Pedido-ownership verification (§R.20.6). *Authority:* flat (admin +
  receipt). *Writers:* migration only; no live business writer switched. *Rollback:*
  the complete byte/count-equivalent rollback contract (§R.15/§R.20.4) — drop the
  four seeded tables + the mapping table, remove **only** the additive event/ledger
  objects, prove flat data unchanged; zero impact on live flat flows. *Entry:*
  ratification of Part R + architect review of the §R.20 clarification + own
  migration order. *Exit:* conversion reconciles to 64/51/51/51 exactly, invariants
  verified, flat flows unchanged, architect acceptance. *Migration auth:*
  **required.** *UI validation:* no.
- **REFUND-B1** — *Responsibility:* re-base the B1 reader + `emitir`/`cancelar` on
  `ordem_compra`; native accumulation (Rule 1); legacy headers inert. *Authority:*
  admin→**new**, receipt→flat, bridge **active** (flat admin columns mirror only).
  *Writers:* native admin RPCs on the new model; flat receipt writers unchanged.
  *Rollback:* revert admin writes to the flat path (new tables retained, inert).
  *Entry:* REFUND-A accepted + own order. *Exit:* native emit/cancel correct,
  legacy inert, architect **visual validation**. *Migration auth:* required.
  *UI validation:* **yes.**
- **PRE-PROD** — *Responsibility:* assessment→`necessidade` (Act 1) + purchase-
  distribution screen (Act 2) decrementing needs via the canonical allocation RPC
  (§R.4). *Authority:* admin→new, receipt→flat, bridge active. *Rollback:* disable
  the distribution writer; needs/allocations are additive. *Exit:* distribution
  cannot over-allocate (structural, T1/T2), end-to-end correct, architect
  acceptance. *Migration auth:* required. *UI validation:* **yes.**
- **B2** — *Responsibility:* purchase-order detail screen (`#/ordens-compra/:id`):
  dimensions, per-order supplier assignment (+`op_fornecedores` projection),
  receipt UI (wired in C), event history. *Authority:* unchanged from PRE-PROD.
  *Exit:* screen live, supplier assignment writes header + projection, architect
  **visual validation**. *Migration auth:* if any. *UI validation:* **yes.**
- **C** — *Responsibility:* ledger-based `registrar_recebimento_ordem_compra_fio`
  + the §R.8 cutover **in one controlled maintenance window** (fence [verified by
  write-denial] → snapshot → idempotent import → migrate both consumers → reconcile
  → switch reads → revoke → close `KG-RECEBIDO-ACL-GAP`). *Authority:* admin→new,
  **receipt→ledger (new)**, bridge retiring. *Rollback:* **point of no return = the
  first accepted canonical receipt write after the read switch (§R.8)** — before it,
  roll back to flat reads with legacy writers kept fenced; after it, recovery is
  **forward-only** (never return to mutable flat authority). If reconciliation fails
  before the switch, **do not revoke; stay on flat.** *Exit:* both writers on the
  RPC, direct UPDATE revoked, reconciliation passes, `saldo_fios` confirmation done,
  architect acceptance. *Migration auth:* **required.** *UI validation:* yes
  (receipt UI).
- **D** — *Responsibility:* server-side production gate on "Iniciar produção" (§5,
  SECURITY DEFINER) reading availability from allocations/receipts. *Exit:*
  insufficient yarn blocks production start server-side, architect acceptance.
  *Migration auth:* required. *UI validation:* yes.
- **E** — *Responsibility:* dormant-acceptance verification checkpoint (no code);
  **production migration executed only after a contemporaneous read-only production
  diagnosis (§R.14).** *Exit:* acceptance dimension proven dormant-correct,
  production precondition satisfied, architect acceptance. *Production:* the only
  phase that may touch production, and only post-diagnosis.

Ratification accepts the governing model but authorizes none of these phases.
**REFUND-A remains `NOT AUTHORIZED`** pending its own architect order.

### R.18 Verification against the four structural flaws (CONTEXT SUPPLEMENT)

- **Flaw 1 (missing needs + allocations):** RESOLVED — all four layers present
  (§R.3, Model A atomic need); each `necessidade_compra_fio` row carries its own
  origin (`origem_tipo`/`op_id`) with no child/JSONB store; native persistence is
  restricted to **two** material/origin combinations (cotton=OP-origin,
  polyester=Pedido-origin) with a DB ownership guard (`op → lote → pedido`), and
  imported legacy needs are identified by their source row
  (`legado_origem_ordem_compra_fio_id`, separate legacy uniqueness);
  `ordem_compra_item_alocacao` preserves which purchased kg satisfy which need and
  from which OP; the sole-maintainer locked-cache `kg_alocado <= kg_necessario`
  invariant (§R.4) prevents double distribution under concurrency (T1/T2 proof).
- **Flaw 2 (unsafe legacy grouping):** RESOLVED — 1:1 conversion, no auto-merge,
  Class C → needs only, ratified 64/51/51/51 (§R.10); NULL supplier never a merge
  key (§R.10.4); the native accumulator is explicitly *not* a historical-identity
  rule (§R.13).
- **Flaw 3 (premature read-only cutover):** RESOLVED — `ordens_compra_fio` stays
  writable; **both** receipt writers (admin `registrarRecebimentoOrdemFio` **and**
  supplier `screenFornecedorOrdens`) stay operational until Phase C; consumers
  migrate to the canonical writer **before** direct UPDATE is revoked;
  `KG-RECEBIDO-ACL-GAP` closes only then (§R.11).
- **Flaw 4 (immutable events):** RESOLVED — events never re-pointed/deleted/
  rewritten/synthesized; REFUND-A **adds** a nullable new-model reference and
  **retains** the legacy `ordens_compra_fio` reference (additive dual-reference,
  §R.20.1), so no existing event row is re-pointed; the exactly-one-model constraint
  preserves history regardless of table population; rule not weakened and not
  generalized to production; production diagnosis mandatory first (§R.12/§R.14).

### R.19 Verification against the two additional rules

- **Rule 1 (single native active draft per pedido+fornecedor):** modeled by the
  partial unique index (§R.3/§R.5); applies to native drafts only; excludes
  legacy and NULL-supplier headers; a new draft is allowed after emission; it does
  **not** merge legacy headers or establish historical identity.
- **Rule 2 (kg_recebido semantic transition):** two explicit periods (§R.8) —
  during coexistence receipt is authoritative on the flat source and **read** by the
  new model via the explicit compatibility mapping (§R.11); at Phase C (one
  controlled maintenance window) the flat snapshot becomes exactly one idempotent
  `import_saldo_inicial` ledger entry, both consumers migrate, reconciliation
  passes, then direct UPDATE is revoked and reads switch to the ledger (point of no
  return defined). The append-only ledger enforces sign CHECKs + compensating
  `estorno` (no over-reversal, no negative cumulative); native receipt is gated to
  `emitida` + accepted (receipt-before-issuance prohibited); saldo is credited per
  immutable ledger event (idempotent, estorno-reversible); imported Class-A/D
  receipt survives **without** double-counting and **without** a fabricated
  emission/acceptance event.

### R.20 REFUND-A pre-order structural clarification — migration boundaries (2026-07-18)

A REFUND-A pre-order reconciliation found that Part R's earlier "clean re-point of
empty event/ledger tables" language contradicted the fact that the live flat writers
still depend on those tables. The architect resolved the contradiction with the
seven rulings below. They **refine migration mechanics only** — Part R's historical
acceptance is preserved, and **REFUND-A remains `NOT AUTHORIZED`**; its next step is
architect review of this clarification, then a separate REFUND-A migration order.

**§R.20.1 Event coexistence (additive dual-reference; Ruling 1).** REFUND-A must
**not** destructively re-point `ordem_compra_eventos`. Use an additive dual-reference
transition:
- **retain** the current legacy `ordens_compra_fio` reference required by the live
  `emitir_ordem_compra_fio`/`cancelar_ordem_compra_fio` writers;
- **add** the new `ordem_compra` reference as **nullable**;
- **enforce** that an event identifies **exactly one** purchase-order model (a CHECK
  constraint: precisely one of the legacy/new references is non-NULL);
- existing flat writers **continue writing legacy-referenced events** unchanged;
- **REFUND-B1** switches administrative writers to new-order events;
- the legacy reference is **removed only** in a later, explicitly authorized cleanup
  after reconciliation.

No historical event may be rewritten or silently re-pointed.

**§R.20.2 Receipt-ledger coexistence (additive dual-reference; Ruling 2).** REFUND-A
must **not** destructively re-point `ordem_compra_fio_lancamentos` while flat receipt
authority remains live. Use the same additive transition:
- **retain** the existing legacy item/order reference (`ordens_compra_fio`);
- **add** `ordem_compra_item_id` as **nullable**;
- **enforce** exactly one applicable parent reference;
- **no** opening-balance ledger entries in REFUND-A;
- **Phase C** performs the final receipt snapshot import, switches both receipt
  writers, and makes the item ledger authoritative;
- the legacy reference is **removed only** after the Phase-C reconciliation and a
  separately authorized cleanup.

**§R.20.3 REFUND-A authority (schema-and-seed only; Ruling 3).** REFUND-A is
schema-and-seed only:
- create the four new persistence layers (`necessidade_compra_fio → ordem_compra →
  ordem_compra_item → ordem_compra_item_alocacao`);
- create the explicit compatibility mapping (`ordem_compra_item_compat_fio`);
- seed the ratified **64 / 51 / 51 / 51** conversion (§R.10);
- add transitional references to events and ledger (§R.20.1/§R.20.2);
- **leave all live administrative and receipt authority on `ordens_compra_fio`**;
- **switch no reader or writer**;
- **revoke no existing flat privilege**;
- **create no opening receipt balance.**

**§R.20.4 Complete rollback (Ruling 4; replaces the incomplete boundary in §R.15).**
A REFUND-A rollback must restore the **exact** pre-migration schema and data state by:
- dropping all newly created four-layer tables;
- dropping the compatibility mapping table (`ordem_compra_item_compat_fio`);
- removing **only** the additive event and ledger columns, constraints, indexes,
  triggers and functions introduced by REFUND-A;
- preserving every original event/ledger column and legacy writer contract;
- proving `ordens_compra_fio` and all existing flat data are **byte/count
  equivalent** to the pre-migration snapshot.

**No destructive transformation is permitted in REFUND-A.**

**§R.20.5 MCP capability (Ruling 5).** Canonical documents must **not** assert that
the currently configured MCP is both read-only and write-ready. Record:
- current effective **write capability is UNKNOWN** until runtime preflight;
- the future REFUND-A order must **fingerprint the target as `ucrjtfswnfdlxwtmxnoo`**;
- it must **verify the actual tool capability and database role before any write**;
- a **read-only MCP or ambiguous target is a HARD STOP**;
- production and `bhgifjrfagkzubpyqpew` remain **prohibited**.

**§R.20.6 Pedido ownership preflight (Ruling 6).** Because canonical documents
disagree about the current population of `lotes.pedido_id`, the future REFUND-A order
must run a **read-only** preflight that verifies:
- column existence and constraints;
- actual population / null counts;
- OP → lote → Pedido consistency;
- whether OP1/OP2 remain unresolved legacy exceptions (§R.10.7).

Any result inconsistent with the ratified conversion is a **HARD STOP** before
migration.

**§R.20.7 Current-state correction (Ruling 7).** `PROJECT_STATE.md` is corrected so
it no longer says phases still await Part R ratification. The canonical current state
is: **Part R is `RATIFIED / ACCEPTED`; REFUND-A is blocked pending this structural
clarification and its explicit migration order; no implementation has begun.**

---

## §R.21 REFUND-B1-CONTRACT-R1 — Native administrative authority design closure

> **Order:** `REFUND-B1-CONTRACT-R1 — NATIVE ADMIN AUTHORITY DESIGN CLOSURE`
> (2026-07-19, documentation-only). **Baseline:** `dev @
> 6a1066e80f0f470f7355b7bb3f38c6438da59ee7` (REFUND-A accepted).
> **Type:** architecture contract clarification. **Authorizes no implementation.**
> This section closes the design gaps the accepted REFUND-B1 pre-order
> reconciliation surfaced, so that migration `db/68` and the application changes can
> later be authorized against a settled contract. It refines Part R's REFUND-B1 row
> (§R.11/§R.17); it does not alter any ratified column, constraint, or conversion.
> Where this section and the pre-REFUND-A §6/§8 B1/B2 split diverge on **UI
> ownership**, this section governs REFUND-B1 (see §R.21.12).

### §R.21.0 Binding phase boundary (restates the order §4)

REFUND-B1 changes **administrative authority only**. After REFUND-B1:

| Concern | Authority after REFUND-B1 |
|---|---|
| Administrative authority — **native** orders | `ordem_compra` (new model), via the native RPCs below |
| Administrative authority — **imported legacy** orders | legacy flat path (`ordens_compra_fio` + db/66 RPCs) remains available **only** for the imported-legacy model |
| Receipt authority | `ordens_compra_fio` remains authoritative until **Phase C** — unchanged |
| Allocation authority | **inactive**; no business grant; no application call; `alocar_necessidade_compra_fio` stays granted to no role |
| Opening receipt ledger | none |
| Production | none (`gqmpsxkxynrjvidfmojk` prohibited) |

`LIVE_ALLOCATION_T1_T2_TEST_PENDING` does **not** block REFUND-B1, and **no
REFUND-B1 design element may activate, grant, or depend on allocation mutation**
(§R.21.5 proves separability).

**Load-bearing coexistence fact (design constraint).** The refoundation
(`db/65`/`db/66`/`db/67`) exists **only** on the staging/development database
`ucrjtfswnfdlxwtmxnoo`. Production `gqmpsxkxynrjvidfmojk` carries `db/01→64` only —
none of the lifecycle columns, the emit/cancel RPCs, or the four new layers. This is
why `fetchOrdensCompraFio` (`js/screens/op-nova.js`) already degrades on a `42703`
undefined-column error. **Every REFUND-B1 read-model and UI element MUST degrade
gracefully on a database that lacks the new tables/functions** (function-not-found
`PGRST202` / column-not-found `42703` → fall back to the legacy flat reader), so the
same application can run against production-before-promotion without error. This is a
binding requirement, not an optimization (§R.21.11/§R.21.12).

### §R.21.5 Native draft-origination + accumulation contract (order §5)

**Canonical writer (ONE):** `public.adicionar_item_ordem_compra(` `p_pedido_id UUID,
p_fornecedor_id BIGINT, p_material TEXT, p_cor_id BIGINT, p_cor_poliester TEXT,
p_kg_pedido NUMERIC` `) RETURNS JSONB`.

- **Option decision (explicit, per order §5): B — the writer creates the native
  `ordem_compra` header (create-or-get) AND the `ordem_compra_item` line, atomically,
  in one call.** It does **not** create or mutate `necessidade_compra_fio` or
  `ordem_compra_item_alocacao`. A native draft is born with its first item; empty
  drafts are never created.
- **Security:** `SECURITY DEFINER`, `SET search_path = public`, internal
  `is_admin()` gate (returns `{ok:false, codigo:'sem_permissao'}` otherwise).
- **Locking order:** at entry, take a transaction-level advisory lock keyed on
  `hashtextextended(p_pedido_id::text || ':' || p_fornecedor_id::text, 0)` to
  serialize get-or-create for the same `(pedido, fornecedor)`; the partial unique
  index `ordem_compra_um_rascunho_ativo` (§R.3) is the structural backstop (a losing
  concurrent INSERT re-selects the winner's draft). No allocation rows are touched,
  so no cross-need lock ordering applies in this phase.
- **Supplier validation:** `p_fornecedor_id` is **required** (native supplier
  requirement, §R.5) and must exist in `fornecedores`; NULL or unknown →
  `{ok:false, codigo:'fornecedor_invalido'}`.
- **Pedido validation:** `p_pedido_id` must exist in `pedidos` →
  else `{ok:false, codigo:'pedido_invalido'}`. (Native item→need→OP→Pedido ownership
  is not checkable in REFUND-B1 because no allocations exist; it is enforced by the
  §R.3 ownership guard when PRE-PROD creates needs/allocations.)
- **Active-draft reuse:** if a `rascunho`, `legado=FALSE`, non-null-supplier header
  already exists for `(pedido, fornecedor)`, reuse it; else insert one
  (`legado=FALSE`, `status_administrativo='rascunho'`,
  `status_recebimento='nao_recebido'`, `legado_provenance=NULL`).
- **Prior emitted/cancelled orders** for the same `(pedido, fornecedor)` are
  **ignored** — Rule 1 constrains only the active draft (§R.5); a new draft after a
  prior emission is legitimate.
- **Item accumulation (native identity, §R.21.6):** within the draft, an item is
  keyed by `(material, color)`. If a matching line exists, **add** `p_kg_pedido` to
  its `kg_pedido`; else insert a new `ordem_compra_item`. Never a duplicate line for
  the same material/color.
- **Idempotency:** accumulation is **additive by design, not idempotent** — a naive
  retry double-adds. **Determination:** the UI must gate against double-submit
  (in-flight disable); a `p_idempotency_key` parameter is an accepted future
  hardening, deferred unless a caller demonstrably needs it (no alias/param added
  speculatively).
- **Event behavior:** origination/accumulation writes **no** `ordem_compra_eventos`
  row — drafts are mutable working state; only `emitir`/`cancelar` are audited
  transitions (mirrors the flat model, where the first event was `emitida`).
- **Grants:** `REVOKE ALL` from `PUBLIC`/`anon`/`service_role`; `GRANT EXECUTE` to
  `authenticated` only.
- **Return (success):** `{ok:true, ordem_id, item_id, header_criado:<bool>,
  kg_pedido_item:<numeric>}`.

**Binding invariant:** at most one active native draft per `(pedido, supplier)`;
repeated origination accumulates into it.

### §R.21.6 Native item identity (order §6)

- **Identity:** `ordem_compra_item` is identified by `(ordem_id, material, color)`
  — one line per material+color per header. `material ∈ {algodao, poliester}`; color
  is exactly one of `cor_id` (cotton) xor `cor_poliester` (polyester), per the table
  CHECK. The item layer carries **no `op_id` and no need reference** — OP/need
  provenance lives on the allocation layer (§R.4), by design.
- **Ordered-quantity source:** `kg_pedido` = the accumulated admin-entered quantity
  for that material/color (§R.21.5). `kg_recebido` stays 0 in REFUND-B1 (native
  receipt is Phase C).
- **One item may represent multiple needs and multiple OP origins** — because
  need/OP linkage is expressed only later, through (multiple) allocation rows in
  PRE-PROD. The item itself is need-agnostic and OP-agnostic. **Do not infer item
  identity from the flat legacy model** (which is one row per OP+material+color).
- **Adding the same material/color twice** → accumulate into the existing item, not a
  second item (§R.21.5).
- **Quantity immutability after emission:** on `emitir`, quantities freeze; no
  post-emission item writer exists in REFUND-B1 (correction path = cancel + new draft,
  §R.21.9), consistent with the ratified "emission locks quantities" precedent.
- **Relationship to the future allocation sum:** at PRE-PROD, `SUM(allocations for
  the item)` reconciles against `item.kg_pedido` (`≤`; any excess ordered surfaces as
  `saldo_fios` per §R.8, never as a silent over-allocation). This reconciliation is
  **PRE-PROD's**, not REFUND-B1's — a native item emitted in REFUND-B1 is
  administratively complete but **not yet need-reconciled** (an accepted, explicit
  consequence of the phase boundary).

### §R.21.7 Compatibility bridge contract (order §7) — DEFINED, activation DEFERRED to PRE-PROD

**Canonical bridge (ONE):** `public.criar_ponte_compat_ordem_compra_item(`
`p_item_id BIGINT` `) RETURNS JSONB` — creates the flat `ordens_compra_fio` shadow
row for a native item **and** the `ordem_compra_item_compat_fio` mapping
(`origem='native_bridge'`) in one transaction; one-to-one in both directions
(the two `UNIQUE` constraints are the backstop); idempotent (returns the existing
mapping if present, creates nothing new). `SECURITY DEFINER`, internal `is_admin()`.

- **Caller / exposure:** **internal-only.** In REFUND-B1 it is **granted to no client
  role and never called** — no native item is receivable in REFUND-B1 (receipt is
  entirely flat/legacy until Phase C), so there is nothing to bridge. PRE-PROD (which
  first makes native items receivable-during-coexistence) is the phase that grants and
  invokes it, as an internal step of a larger writer — never exposed directly to a
  client.
- **Locks / idempotency / rollback:** advisory lock on `p_item_id`; the mapping
  `UNIQUE`s guarantee no duplicate shadow/mapping; rollback of the enclosing
  transaction removes both or neither (never a half-bridge). **Receipt authority stays
  on the flat shadow until Phase C** — the bridge sets up the flat row; it does not
  move receipt authority.

**Why activation is deferred (separability proof).** The bridge must fill the flat
row's `op_id`, and `ordens_compra_fio.op_id` is **`NOT NULL`** (verified live in
staging). The item's `op_id` is knowable only from its **allocations** — which are
PRE-PROD. Therefore the bridge cannot run before allocation exists; it belongs to
PRE-PROD. This is also why REFUND-B1 can create native items without activating
allocation: items are OP-free (§R.21.6); only the *bridge* needs an OP, and the bridge
is deferred.

**Field determination + the four mandated cases (order §7).** For a native item whose
(future) allocations resolve its provenance, the bridge fills:
`fornecedor_id ← header.fornecedor_id`; `tipo ← item.material`;
`cor_id/cor_poliester ← item.color`; `kg_pedido ← item.kg_pedido`; Pedido ownership
via `op_id → ops.lote_id → lotes.pedido_id` must equal `header.pedido_id`; and
`op_id ←` the item's OP origin. Then:

1. **Item backed by exactly one OP-origin need (single-OP cotton):** `op_id` = that
   need's `op_id`. **Representable** — one flat shadow, one mapping. ✓
2. **Item backed by multiple OP-origin needs (multi-OP cotton):** the flat `op_id` is
   scalar and the mapping is one-to-one, so one item cannot map to multiple flat rows,
   and no single `op_id` is correct. **HARD STOP — the bridge MUST NOT fabricate,
   pick a "first"/"representative" OP.** Such an item is **not flat-bridgeable**; its
   receipt is served only by the **Phase-C native ledger**.
3. **Pedido-origin shared polyester (`op_id` NULL at the need layer):** the flat
   schema requires a non-null `op_id`, so no flat shadow can be created without
   **fabricating an OP**. **HARD STOP** — not flat-bridgeable; **Phase-C native
   ledger only.**
4. **Item whose future allocations span multiple OPs:** identical to case 2 — **HARD
   STOP**, not flat-bridgeable, Phase-C native ledger.

**Binding consequence (surfaced now, for PRE-PROD/Phase-C planning).** The flat
compat bridge is viable **only** for the degenerate single-OP-origin case (case 1);
the general native case (cases 2–4) is receivable **only** from Phase C via the native
ledger. Because REFUND-B1 activates none of this, cases 2–4 are **not** REFUND-B1
blockers — but they are a standing **HARD STOP for PRE-PROD**: if PRE-PROD produces a
native item that must be receivable during coexistence yet is not flat-representable,
that requires an explicit architect decision (accept "not receivable until Phase C",
or bring Phase C forward for that item), **never** an OP fabrication.

### §R.21.8 Native emit contract (order §8)

**RPC:** `public.emitir_ordem_compra(p_ordem_id BIGINT) RETURNS JSONB`.

- Targets `ordem_compra.id`. **Rejects `legado=TRUE`** (`codigo:'ordem_legado'`).
- Requires `status_administrativo='rascunho'` (`codigo:'estado_invalido'`),
  `fornecedor_id IS NOT NULL` (`codigo:'sem_fornecedor'`), and the **minimum valid
  item state = at least one `ordem_compra_item`** (`codigo:'sem_itens'`). Each item's
  `kg_pedido>0` is already a table CHECK.
- **Allocations are NOT required to emit in REFUND-B1** (they do not exist yet);
  need-coverage is reconciled at PRE-PROD (§R.21.6). Explicit determination.
- Freezes the issuance snapshot: `aceite_exigido_na_emissao ←
  ordem_compra_config.exige_aceite`; sets `status_aceite` (`pendente` if required else
  `nao_aplicavel`); sets `emitida_em=now()`, `emitida_por=auth.uid()` — all atomically
  → `status_administrativo='emitida'`.
- Writes **one** `ordem_compra_eventos` row using **`ordem_compra_id`**, leaving
  `ordem_compra_fio_id` **NULL** (the exactly-one-parent CHECK is satisfied).
- **Flat compatibility administrative mirror:** in the same transaction, mirror
  `status_administrativo`/`status_aceite`/`emitida_em` onto any `native_bridge` flat
  shadow rows of this order's items. **No-op in REFUND-B1** (no shadows exist); defined
  for forward-compatibility. The mirror is **administrative-only, write-from-native,
  never receipt** — it preserves flat receipt authority and is not a competing
  authority (§R.11).
- **Security/ACL:** `SECURITY DEFINER`, internal `is_admin()`; `GRANT EXECUTE` to
  `authenticated` only; `REVOKE` `PUBLIC`/`anon`/`service_role`.
- **Error contract:** `{ok:false, erro:<pt-BR message>, codigo:<slug>}` with codes
  `sem_permissao | nao_encontrada | ordem_legado | estado_invalido | sem_fornecedor |
  sem_itens`. **Idempotency:** re-emitting an already-`emitida` order returns
  `{ok:false, codigo:'estado_invalido'}` with no second event (retry-safe).

### §R.21.9 Native cancel contract (order §9)

**RPC:** `public.cancelar_ordem_compra(p_ordem_id BIGINT) RETURNS JSONB`.

- Targets `ordem_compra.id`. **Rejects `legado=TRUE`** (`codigo:'ordem_legado'`).
- **Permitted source states:** `rascunho | emitida → cancelada` (terminal).
- **Received-quantity rule:** in REFUND-B1 no native order can carry received
  quantity (native receipt is Phase C), so this is moot for the phase. **Determination
  (binding from Phase C onward):** once native receipt exists, **any received quantity
  blocks cancellation** — the correction path is a ledger `estorno`, not order cancel
  (consistent with §7g "receipt entries never reverse"). In REFUND-B1 the guard is
  authored but structurally unreachable.
- **Preserves receipt history; never deletes** items, allocations, mappings, flat
  shadows, or events. Sets `cancelada_em/por`.
- Writes **one** `ordem_compra_id`-referenced `ordem_compra_eventos` row.
- Mirrors the cancelled administrative state to `native_bridge` flat shadows in the
  same transaction (no-op in REFUND-B1).
- Same security/ACL posture as §R.21.8. **Do not copy db/66 mechanically** where
  native semantics differ (legado guard, id target, the received-quantity rule).
- **Error contract:** codes `sem_permissao | nao_encontrada | ordem_legado |
  estado_invalido | possui_recebimento` (the last reachable only from Phase C).

### §R.21.10 Legacy coexistence (order §10)

- **Discriminator:** `ordem_compra.legado` (`TRUE` = imported legacy, `FALSE` =
  native). Flat shadows are `ordens_compra_fio` rows reachable only via
  `ordem_compra_item_compat_fio` (`origem`: `imported_legacy` vs `native_bridge`).
- **Imported legacy headers (51) remain inert in the new model** — native RPCs reject
  `legado=TRUE`; they are read-only historical records under `ordem_compra`.
- **Native RPCs cannot act on `legado=TRUE`** (explicit guard, §R.21.8/§R.21.9).
- **Legacy RPCs remain available only for the imported-legacy flat model.** The db/66
  `emitir_ordem_compra_fio`/`cancelar_ordem_compra_fio` operate on
  `ordens_compra_fio.id` and stay the admin path for the original flat rows. They must
  **never** become an alternate writer for a native order. **Enforcement obligation
  (PRE-PROD, inert in REFUND-B1):** when `native_bridge` shadows first exist, the db/66
  RPCs must be guarded to **reject any `ordens_compra_fio` row that carries a
  `native_bridge` mapping** — administrative authority for anything native is
  exclusively the native RPCs. In REFUND-B1 no such shadow exists, so the guard is not
  yet needed; it is recorded here so PRE-PROD does not miss it.
- **No double presentation:** the read model (§R.21.11) surfaces a native order
  **once**, from `ordem_compra`; its `native_bridge` flat shadow is an internal
  receipt-compat record and is **never** listed as an independent order.

### §R.21.11 Administrative read model (order §11)

**Choice: `SECURITY DEFINER` RPC pair** (not a SQL view + RLS). Rationale: it composes
header+items+provenance server-side so the client never reconstructs authority from
unrelated tables; it uniformly excludes `native_bridge` shadows so an order is never
shown twice; and it degrades cleanly (a database without the function returns
`PGRST202`, letting the client fall back to the legacy flat reader — §R.21.0).

- `public.listar_ordens_compra_admin(p_pedido_id UUID DEFAULT NULL) RETURNS JSONB` —
  array of orders (optionally filtered by Pedido), each: header (id, pedido, supplier,
  three lifecycle states, `emitida_em`, `legado`, `legado_provenance`), items
  (material, color, `kg_pedido`, `kg_recebido`), a **model discriminator**
  `modelo ∈ {'nativo','legado'}`, server-derived **allowed actions**
  (`emitir` when `rascunho` + supplier + `≥1` item; `cancelar` when `rascunho|emitida`;
  none when `cancelada`/`legado`/inert), and compatibility state (whether a flat shadow
  exists).
- `public.obter_ordem_compra_admin(p_ordem_id BIGINT) RETURNS JSONB` — one order in
  full, plus its `ordem_compra_eventos` history.
- **Security:** `SECURITY DEFINER`, internal `is_admin()`, `GRANT EXECUTE` to
  `authenticated` only; `REVOKE` `PUBLIC`/`anon`/`service_role`.
- **Prevents:** duplicate native/shadow display (shadows excluded); client-side
  authority reconstruction (composition is server-side); mistaking a flat mirror for
  native authority (mirrors are never returned as orders — only as a compat flag).

### §R.21.12 Dedicated-screen / UI ownership (order §12) — governs over the earlier B1/B2 split

- **Route (detail):** `#/ordens-compra/:id` (numeric — `ordem_compra.id` is
  `BIGSERIAL`). The app has **no generic `:id` router support**; every parameterized
  route is a hand-written regex branch in `js/router.js`. So the detail route is a
  **new regex branch** `^#/ordens-compra/(\d+)$ → screenOrdemCompra(Number(id))`.
- **Route (list) + entry point:** static `#/ordens-compra` registered in
  `js/boot.js`, plus an **`Ordens de Compra`** item in `ADMIN_MENU`
  (`js/screens/common.js`).
- **Dedicated screen** `screenOrdemCompra(id)` (async, param-driven — the
  `pedido-detail.js` template): full header/items/lifecycle/supplier/Pedido/provenance
  + event history; **`Emitir`/`Cancelar` as actions on this screen**; loads via the
  §R.21.11 RPC through a dedicated `ordem-compra-data.js` loader
  (`window.RAVATEX_SCREENS.ordemCompra` namespace).
- **OP screen becomes summary + navigation.** `buildOrdensReaderSection`
  (`op-nova.js`) stays as a **compact contextual summary** but its inline
  `Emitir`/`Cancelar` actions (`ocfAcoes`/`emitirOrdemCompra`/`cancelarOrdemCompra`)
  are **removed**; it gains a "ver ordem" link that navigates to
  `#/ordens-compra/:id`. Governance: transition modals hold **actions only**; a
  purchase order is an entity and its full CRUD/lifecycle lives on its dedicated
  screen — never confined to `op-nova.js` or a modal.
- **Phasing reconciliation (binding):** the pre-REFUND-A §6/§8 amendment placed the
  detail screen in "B2". This contract **pulls the dedicated administrative Ordem de
  Compra screen (list + detail + emit/cancel actions) into REFUND-B1**, because
  admin authority (REFUND-B1's core) cannot be exposed governance-compliantly from a
  reader section or modal. The residual "B2" scope (per-order supplier-assignment UI
  relocation off the OP screen; receipt UI wiring — Phase C) remains later.
- **UI validation is mandatory** at REFUND-B1 implementation (architect visual
  walk of native emit/cancel + legacy-inert render).

### §R.21.13 Rollback contract (order §13) — routing/authority, non-destructive (architect ruling)

If rollback is required after native use has begun:

1. **Revert application administrative writes to the prior flat path** (unpublish the
   native admin UI / stop calling the native writers).
2. **Revoke/disable native business-writer exposure** — `REVOKE EXECUTE` on
   `adicionar_item_ordem_compra`, `emitir_ordem_compra`, `cancelar_ordem_compra`
   (and the bridge, if it was granted) from `authenticated`; functions and tables
   remain.
3. **Retain** all native headers, items, mappings, flat compatibility rows, events,
   recorded lifecycle state, and receipt snapshots.
4. **Retained native records become inert/read-only** until forward repair: the read
   model returns them with **allowed-actions = `[]`** and an `inert` flag; the
   dedicated screen renders them read-only. Events are append-only, so the historical
   trail stays truthful.

**Never:** delete native orders created while REFUND-B1 was active; rewrite/remove
events; merge native and legacy records; discard flat compat rows that may carry
receipt history; or fabricate reverse administrative events to simulate rollback.

### §R.21.14 Function-naming drift resolution (order §14)

- Installed inactive function (db/67): `alocar_necessidade_compra_fio(p_item_id
  BIGINT, p_necessidade_id BIGINT, p_op_id BIGINT, p_kg NUMERIC)`.
- §R.4 prose: `alocar_necessidade(need_id, item_id, kg)`.
- **Ruling: accepted installed name; the §R.4 prose is corrected on naming.** The
  canonical name for future **PRE-PROD** allocation work is the installed
  `alocar_necessidade_compra_fio(p_item_id, p_necessidade_id, p_op_id, p_kg)`. REFUND-B1
  **does not rename, expose, alias, or grant** it (PRE-PROD owns activation); no caller
  requires an alias, so none is created. §R.4's shorter prose signature is superseded
  on naming by this ruling and retained as historical.

### §R.21.15 ACL contract (order §15)

| Object | Security | EXECUTE grant | Revokes |
|---|---|---|---|
| `adicionar_item_ordem_compra` | `SECURITY DEFINER`, `is_admin()` | `authenticated` | `PUBLIC`/`anon`/`service_role` |
| `emitir_ordem_compra` | `SECURITY DEFINER`, `is_admin()` | `authenticated` | `PUBLIC`/`anon`/`service_role` |
| `cancelar_ordem_compra` | `SECURITY DEFINER`, `is_admin()` | `authenticated` | `PUBLIC`/`anon`/`service_role` |
| `criar_ponte_compat_ordem_compra_item` | `SECURITY DEFINER`, `is_admin()` | **none in REFUND-B1** (PRE-PROD grants) | `PUBLIC`/`anon`/`service_role` |
| `listar_ordens_compra_admin`, `obter_ordem_compra_admin` | `SECURITY DEFINER`, `is_admin()` | `authenticated` | `PUBLIC`/`anon`/`service_role` |

- **No direct client DML on the new model** — `ordem_compra`/`ordem_compra_item`
  keep `SELECT`-only to `authenticated` (already so from REFUND-A) with admin-only RLS;
  the RPCs are the sole writers.
- **Do not reproduce the `ordens_compra_fio` anon-grant gap.** The flat table still
  carries a stale table-level `UPDATE` grant to `anon` (pre-existing
  `ANON-GRANT-DEFENSE-IN-DEPTH`, inert behind RLS). REFUND-A's five new tables have
  **zero** anon DML — hold that bar; the `db/68` migration must add **no** anon grant,
  and its verification must re-confirm zero anon DML on `ordem_compra`/
  `ordem_compra_item`.
- **No allocation RPC grant. No receipt-authority change** (`kg_recebido` stays
  flat-writable until Phase C — `KG-RECEBIDO-ACL-GAP` unchanged).

### §R.21.16 Exact implementation manifest (order §16) — REFUND-B1 (projected; NOT authorized)

- **Migration:** `db/68_ordem_compra_native_admin.sql` — `adicionar_item_ordem_compra`,
  `emitir_ordem_compra`, `cancelar_ordem_compra`, `criar_ponte_compat_ordem_compra_item`
  (defined, **inactive** — granted to no role), `listar_ordens_compra_admin`,
  `obter_ordem_compra_admin`; the ACL of §R.21.15; **no** allocation grant, **no**
  receipt change, **no** db/66 replacement (the db/66 native-guard is a PRE-PROD
  obligation, §R.21.10).
- **New RPCs/read-model objects:** the six functions above (read model = the two
  admin RPCs; **no** SQL view).
- **New dedicated-screen files:** `js/screens/ordens-compra-list.js`,
  `js/screens/ordem-compra.js`, `js/screens/ordem-compra-data.js`; and, if the render
  or event logic exceeds the CODE_HEALTH §7 size guidance,
  `js/screens/ordem-compra-render.js` and `js/screens/ordem-compra-events.js` (the
  `pedido-detail*` split). Minimum required: screen + data loader.
- **Modified application files:** `js/router.js` (list + `(\d+)` detail branches);
  `js/boot.js` (register `#/ordens-compra`); `js/screens/common.js` (`ADMIN_MENU`
  item + `MENU_ICONS` entry); `js/screens/op-nova.js` (reader → summary + "ver ordem"
  link; remove inline `emitir`/`cancelar` handlers); `index.html` (new `<script>`
  tags with current cache-busting `?v=`, before `js/boot.js`).
- **Routing/navigation files:** `js/router.js`, `js/boot.js`, `js/screens/common.js`,
  `index.html` (as above).
- **Tests:** `tests/ordem-compra.smoke.js` (dedicated-screen render harness, incl.
  business-rejection and transport-error paths, per §20 double-fidelity);
  `tests/ordem-compra-admin.matrix.sql` (or an equivalent DB matrix) for the writers;
  additions to `tests/op-nova.smoke.js` asserting the reader is summary-only (no inline
  emit/cancel) and links out.
- **Canonical closeout owners:** `docs/governance/current-state.json`,
  `docs/ledgers/G28_LEDGER.md`, and this spec. `PROJECT_STATE.md` and
  `AGENT_HANDOFF.md` are regenerated compatibility views.
- **`PEDIDO_OP_SCHEMA_CONTRACT.md` §6.2:** corrected in **this** contract phase
  (REFUND-B1-CONTRACT-R1), not deferred — see the §6.2 edit.

### §R.21.17 Test & UI-validation matrix (order §17)

- **Database:** one active native draft per `(pedido, supplier)`; additive
  accumulation into the existing draft; native emit success; emit rejection matrix
  (`sem_permissao`/`ordem_legado`/`estado_invalido`/`sem_fornecedor`/`sem_itens`);
  cancel success; cancel rejection matrix (+`possui_recebimento` reachable only from
  Phase C); `legado=TRUE` rejection on both writers; exactly-one-parent event
  enforcement (native events carry `ordem_compra_id`, never `ordem_compra_fio_id`);
  bridge idempotency + one-to-one (exercised where case 1 applies; cases 2–4 assert the
  HARD-STOP refusal to fabricate an OP); flat administrative-mirror equality (no-op in
  REFUND-B1, asserted no shadow written); ACL negative tests (anon/authenticated direct
  DML denied on `ordem_compra`/`ordem_compra_item`; RPCs reject non-admin);
  **no allocation activation** (allocation RPC still granted to no role; no allocation
  row created by any REFUND-B1 writer); rollback rehearsal (revoke EXECUTE → native
  writers inert, all rows retained).
- **Legacy regression (must stay byte-identical):** db/66 `emitir`/`cancelar` flat
  path; the two direct flat receipt writers (`registrarRecebimentoOrdemFio`,
  `screenFornecedorOrdens`); the OP reader; the Pedido Insumos transition; supplier
  receipt; `ordens_compra_fio` row fingerprint unchanged.
- **UI:** dedicated entity screen renders; native order render; imported-legacy render
  (inert, no actions); no duplicate native/shadow display; action availability by
  state; transport-error handling; business-rejection handling (`res.data.ok !== true`
  → error toast, per the `275ede2` lesson); emit/cancel success refresh; OP summary →
  detail navigation; modal action-only compliance; **graceful degradation on a
  database lacking `db/65–67`** (PGRST202/42703 → legacy reader, no crash); architect
  visual validation.

**Nothing in §R.21 is authorized for implementation.** REFUND-B1 remains
`NOT AUTHORIZED` pending its own separate architect order.

---

## §R.22 REFUND-B1-CONTRACT-R2 — Activation-boundary correction (governs over the corrected parts of §R.21)

> **Order:** `REFUND-B1-CONTRACT-R2 + REFUND-B1 IMPLEMENTATION ORDER` (2026-07-19,
> Opus 4.8). **Baseline:** `dev @ 39d35f7`. **§R.21 (REFUND-B1-CONTRACT-R1) was
> `NOT ACCEPTED AS WRITTEN`.** This §R.22 is the binding correction; where §R.22 and
> §R.21 diverge, **§R.22 governs**. §R.22 also carries the implementation
> authorization (conditional on the R2 documentation gate passing exactly).

### §R.22.1 Why R1 was corrected — three material defects (architect findings)

- **Defect 1 — emission without allocation.** §R.21.8 allowed a native order to be
  emitted with items but **no allocations**. Invalid: allocation carries need/OP
  provenance and becomes immutable after issuance, so an order emitted without
  allocations could never acquire the required provenance later — defeating the
  four-layer refoundation.
- **Defect 2 — non-idempotent item writer.** §R.21.5's `adicionar_item_ordem_compra`
  was **additive** and leaned on UI double-submit prevention. UI gating is **not** an
  idempotency mechanism; network/browser/concurrent retries could raise `kg_pedido`
  more than once.
- **Defect 3 — premature incomplete bridge.** §R.21.7's
  `criar_ponte_compat_ordem_compra_item` could not validly represent Pedido-origin
  shared polyester, multi-OP cotton, or items allocated across multiple OPs without
  fabricating an `op_id`. **No function that fabricates/chooses/guesses an `op_id` may
  be created; an inactive-but-structurally-incomplete bridge is not authorized.**

### §R.22.2 Binding activation boundary — native **draft** administrative authority only

REFUND-B1 activates **native draft administrative authority, not native emission
authority.**

| Bucket | Elements |
|---|---|
| **ACTIVE** (client, `authenticated`) | create-or-obtain a native draft; define **absolute** item quantities; edit native draft items; remove native draft items; **cancel a native draft**; list native + imported-legacy orders; open the dedicated purchase-order entity screen |
| **INSTALLED BUT INACTIVE** | the native emission RPC (`emitir_ordem_compra`) — **no client grant**; the emission UI action (disabled, never calls the RPC) |
| **NOT CREATED** | the compatibility bridge writer (no bridge RPC, no `native_bridge` rows, no flat shadow, no synthetic `op_id`) |
| **INACTIVE** (unchanged from REFUND-A) | the allocation writer; the receipt ledger; any native receipt path; any flat-shadow creation for native items |

**Native emission becomes activatable only during PRE-PROD, after:** complete
need/item allocation is possible; `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved;
every item is fully reconciled to allocations; and the emission precondition can be
proven against real allocations. **PRE-PROD is `NOT AUTHORIZED`.**

### §R.22.3 Item **definition** writer (replaces §R.21.5; operationally superseded for future origination by §R.27)

The installed REFUND-B1 writer below remains historical/current implementation
evidence, but it is **not** the canonical future origination authority. Its manual
absolute quantity is a localized forward-correction target: future purchasing flow
must derive `item.kg_pedido` exclusively from allocation totals under Pedido / Insumos
ownership. Do not use this section to create a second quantity authority.

**`public.definir_item_ordem_compra(p_pedido_id UUID, p_fornecedor_id BIGINT,
p_material TEXT, p_cor_id BIGINT, p_cor_poliester TEXT, p_kg_pedido NUMERIC) RETURNS
JSONB`** — the name `adicionar_item_ordem_compra` is **withdrawn**.

- Creates or returns the single active native draft for `(pedido, supplier)`; creates
  or **updates** the unique `(material, color)` item.
- **`p_kg_pedido` is the ABSOLUTE desired item quantity, not an increment.** Repeating
  the same call with the same arguments produces the **same resulting state**
  (idempotent) — the item's `kg_pedido` is *set*, never accumulated.
- No allocation created; no need inferred; no OP selected; **no event** written for
  draft item definition.
- Emitted/cancelled orders are **never reused**; only an active `rascunho` native
  draft may be mutated.
- `(material, color)` must satisfy the canonical identity rule (`cor_id` xor
  `cor_poliester`; native material/origin per §R.3); `p_kg_pedido > 0`; supplier and
  Pedido must exist.
- Transaction-level advisory lock on `(pedido, supplier)`; the partial unique index
  `ordem_compra_um_rascunho_ativo` is the DB backstop.
- `SECURITY DEFINER`, internal `is_admin()`, `GRANT EXECUTE` to `authenticated` only,
  `REVOKE` `PUBLIC`/`anon`/`service_role`.
- **Return:** `{ok, codigo, ordem_compra_id, ordem_compra_item_id, criado_ordem,
  criado_item, kg_pedido_final}`.

### §R.22.4 Item **removal** writer (new)

**`public.remover_item_ordem_compra(p_item_id BIGINT) RETURNS JSONB`** — requires a
native active `rascunho` draft; rejects `legado=TRUE`; rejects emitted/cancelled
orders; **rejects removal when any allocation exists** for the item; deletes only the
draft item; **never** deletes the parent order automatically (an empty draft may
remain, receive another item later, or be cancelled); writes **no** lifecycle event;
same security/ACL posture as §R.22.3.

### §R.22.5 Native emission — **installed but inactive** (replaces §R.21.8)

**`public.emitir_ordem_compra(p_ordem_id BIGINT) RETURNS JSONB`** — created by the
migration but **granted to no client role** (no `authenticated`/`anon`/`service_role`/
`PUBLIC` EXECUTE). Only `postgres`/the database owner may execute it, for rollback-safe
tests. It **rejects emission unless ALL hold:** the order is native (`legado=FALSE`);
`status_administrativo='rascunho'`; `fornecedor_id` present; `≥1` item; **every item
has ≥1 allocation**; **for every item `SUM(active allocation kg) = item.kg_pedido`**;
every allocation belongs to a need with matching Pedido ownership; every allocation
satisfies the immutable material/color identity; no item has an unresolved allocation
deficit or excess; the acceptance snapshot can be frozen. On success it freezes
issuance fields, sets lifecycle states atomically, inserts **one** `ordem_compra_eventos`
row using **`ordem_compra_id`** (`ordem_compra_fio_id` NULL), and **never** fabricates
OP provenance or creates a flat compatibility shadow. **Post-emission immutability of
items/allocations is enforced by construction** — the draft writers (§R.22.3/§R.22.4)
reject any non-`rascunho` order and the allocation writer is ungranted, so no active
writer can mutate an emitted order's items/allocations (no separate immutability
trigger is added). **Because allocation is inactive in REFUND-B1, no ordinary
UI-created draft can satisfy this precondition — intentional.**

### §R.22.6 Emission UI behavior

The dedicated screen **must not expose a working emit action in REFUND-B1**. The read
model returns, for ordinary native drafts, **`pode_emitir=false`** and
**`bloqueio_emissao='distribuicao_necessidades_pendente'`**. The screen may render a
**disabled** action showing that reason, but must **never** call `emitir_ordem_compra`;
no `authenticated` EXECUTE grant exists on it. PRE-PROD owns the later authorization to
resolve the live T1/T2 debt, activate allocation, enable the emission grant, and enable
the UI action.

### §R.22.7 Draft cancel writer (replaces §R.21.9 for REFUND-B1)

**`public.cancelar_ordem_compra(p_ordem_id BIGINT) RETURNS JSONB`** — **active** for
REFUND-B1 client use, operating on native **drafts**: rejects `legado=TRUE`; requires
`status_administrativo='rascunho'`; sets `status_administrativo='cancelada'`; **retains
all items, deletes nothing**; inserts one `ordem_compra_id` administrative event;
terminal; rejects repeated cancellation with a stable business error; `SECURITY
DEFINER`, `is_admin()`, EXECUTE `authenticated` only, revoke `PUBLIC`/`anon`/
`service_role`. **Cancellation of an emitted native order is NOT activated in
REFUND-B1** (native emission is not active); the emitted-order cancellation contract
(receipt/estorno rules) is a PRE-PROD-or-later concern.

### §R.22.8 Compatibility bridge — **NOT created** (replaces §R.21.7)

Do **not** create `criar_ponte_compat_ordem_compra_item`, `native_bridge` rows, new
flat `ordens_compra_fio` shadows, synthetic `op_id` values, first-OP/representative-OP
mappings, bridge grants, or bridge triggers. **Registered debt:
`NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`** — blocks any attempt to route
native receipts through the flat legacy writers; does **not** block native draft
administration. PRE-PROD must decide, from **actual allocations**, whether a native
item is single-OP (temporarily bridgeable) or multi-OP/Pedido-origin
(native-ledger-only); **no bridge is permitted before that decision.**

### §R.22.9 Legacy authority (refines §R.21.10)

The db/66 flat `emitir_ordem_compra_fio`/`cancelar_ordem_compra_fio` RPCs remain
**unchanged** and continue to serve imported-legacy flat orders. REFUND-B1 must not
repoint them, restrict them based on `native_bridge` rows (**none exist**), revoke
their grants, change their event parent, or alter existing flat data. Imported-legacy
`ordem_compra` headers remain inert/read-only in the new model; native writers reject
`legado=TRUE`.

### §R.22.10 Read model (refines §R.21.11)

`listar_ordens_compra_admin(p_pedido_id UUID) RETURNS JSONB` and
`obter_ordem_compra_admin(p_ordem_id BIGINT) RETURNS JSONB` — both `SECURITY DEFINER`,
`is_admin()`, EXECUTE `authenticated` only, revoke `PUBLIC`/`anon`/`service_role`;
server-compose the administrative model; model discriminator; native orders once;
imported-legacy orders once; exclude any duplicate compatibility representation; derive
allowed actions server-side; never infer receipt authority from client joins. **Native
draft allowed actions in REFUND-B1:** `editar_itens=true`, `remover_itens=true`,
`cancelar=true`, `emitir=false`, `receber=false` (with `pode_emitir=false` +
`bloqueio_emissao='distribuicao_necessidades_pendente'`, §R.22.6). Imported-legacy
allowed actions derive from the existing flat administrative state.

### §R.22.11 Dedicated screen (refines §R.21.12) — mandatory file split

Routes `#/ordens-compra/:id` (detail) and `#/ordens-compra` (list). **The full entity
must not reside in `op-nova.js`.** Required screen files (all five):
`js/screens/ordens-compra-list.js`, `js/screens/ordem-compra.js`,
`js/screens/ordem-compra-data.js`, `js/screens/ordem-compra-render.js`,
`js/screens/ordem-compra-events.js`. Routing/navigation: `js/router.js`, `js/boot.js`,
`js/screens/common.js`, `index.html`. **`op-nova.js` scope is strictly limited to** a
compact purchase-order summary (status, order count / concise rows), a "Ver ordem"
navigation link, and **removal of the inline emit/cancel entity actions** — no full
item editing, lifecycle rendering, event history, detailed orchestration, or new large
helper blocks. Because `op-nova.js` is the frozen size exception (CODE_HEALTH §7), the
change must be **net-reductive**; report before/after line count. Transition modals
hold actions only; the entity + its item collection live on the dedicated screen.

### §R.22.12 Exact PRE-PROD activation gates (deferred; NOT authorized)

Native emission (and the receipt/bridge decisions) activate only in PRE-PROD, after:
(1) `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved by a real two-session test;
(2) the allocation writer is granted + the purchase-distribution path is built so
every item can be fully allocated; (3) the emission precondition (§R.22.5) can be
proven against real allocations; (4) the `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`
per-item single-OP-vs-native-ledger decision is made. Native **receipt** authority
remains a **Phase C** concern. A contemporaneous read-only **production** diagnosis
remains mandatory before any production promotion (§R.14).

### §R.22.13 Migration + ACL manifest (replaces §R.21.15/§R.21.16 object list)

**Migration `db/68_ordem_compra_native_draft_admin.sql`.** Authorized objects only:
`definir_item_ordem_compra`, `remover_item_ordem_compra`, `emitir_ordem_compra`
(installed, **no client grant**), `cancelar_ordem_compra`, `listar_ordens_compra_admin`,
`obter_ordem_compra_admin`, and supporting constraints/indexes **only if strictly
required** by those functions. **Not authorized:** the bridge RPC; any allocation grant;
allocation schema redesign; receipt-ledger activation; flat-shadow creation; opening
balances; production-compatibility work; unrelated table changes. **ACL:** all client
writers/readers `SECURITY DEFINER` + `is_admin()` + EXECUTE `authenticated` only, with
`PUBLIC`/`anon`/`service_role` revoked; `emitir_ordem_compra` granted to **no** role;
**no** new anon DML on `ordem_compra`/`ordem_compra_item` (hold REFUND-A's clean bar,
not the stale `ordens_compra_fio` anon-`UPDATE` gap); the allocation RPC stays granted
to no role; no receipt-authority change (`KG-RECEBIDO-ACL-GAP` unchanged).

**Nothing above authorizes PRE-PROD.** REFUND-B1 implementation is authorized under the
R2 order **only after the R2 documentation gate passes exactly** (order §13);
`PRE-PROD` remains `NOT AUTHORIZED`.

### §R.22.18 REFUND-B1 — ARCHITECT ACCEPTANCE CLOSEOUT (2026-07-19)

> **Order:** `REFUND-B1 — ARCHITECT ACCEPTANCE CLOSEOUT` (documentation-only).
> **Baseline:** `dev @ 7a2c04c`. **Ruling: `REFUND-B1: CLOSED /
> ACCEPTED_WITH_RECORDED_FUTURE_GATES`.**

- **Technical commits accepted:** `231f17a` (Correct REFUND-B1 activation
  boundaries), `82f6247` (Add native purchase-order draft administration),
  `d4d7533` (Add dedicated native purchase-order administration), `7a2c04c`
  (Record REFUND-B1 staging verification).
- **Staging migration:** `20260719025055 /
  68_ordem_compra_native_draft_admin`.
- **Visual qualification: `ACCEPTED`.** The architect reviewed the supplied
  contact sheet and accepted: dedicated purchase-order list and entity screens;
  native/legacy distinction; item editing confined to the dedicated entity;
  action-only cancellation modal; native emission visibly disabled with the
  PRE-PROD explanation; the OP screen reduced to contextual summary +
  navigation; no duplicate native/flat-shadow representation; desktop and
  tablet layouts acceptable.
- **Out-of-manifest test fixture synchronization: `QUALIFIED / ACCEPTABLE`.**
  The changes in `tests/boot.smoke.js`, `tests/screens-common.smoke.js`,
  `tests/cadastros-screens.smoke.js`, `tests/documentos-recebidos.smoke.js` are
  accepted as mechanical, coverage-preserving synchronization caused by the new
  route, menu entry, and screen registration — no assertion weakening or
  unrelated behavioral change identified.
- **Non-blocking UI debt — `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`:** the
  390px evidence shows severe content compression caused by the pre-existing
  fixed-width administrative sidebar. App-wide, **not** introduced by
  REFUND-B1, non-blocking for this acceptance, **not authorized for
  correction in this closeout** — must be handled as a separate global UI
  phase, not an ordem-compra-specific patch.
- **Future blocking gates, restated as binding:**
  1. **`LIVE_ALLOCATION_T1_T2_TEST_PENDING`** — blocks allocation business
     activation, authenticated allocation grants, application allocation
     calls, and production promotion involving allocation.
  2. **`NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`** — blocks flat
     receipt shadows that would require a fabricated/arbitrary `op_id`, and
     native receipt routing through legacy writers for shared-polyester or
     multi-OP items.
  3. **Native emission** remains inactive and ungranted; activation belongs to
     PRE-PROD only after allocation activation is valid, live concurrency
     evidence passes, every item is fully reconciled to allocations, and the
     emission preconditions (§R.22.5) pass.
  4. **Native receipt authority** remains deferred to Phase C.
  5. **Production:** a contemporaneous read-only production diagnosis remains
     mandatory before any production migration or promotion.
- **B2 residual scope** (per-order supplier-assignment relocation off the OP
  screen; Phase-C receipt UI wiring) remains governed by this updated canonical
  plan.
- **Scope discipline:** documentation-only; no database access; `db/68`
  unmodified; no application code; no test changed; production, `main`, and
  push untouched.
- **Status:** `REFUND-B1` is `CLOSED / ACCEPTED_WITH_RECORDED_FUTURE_GATES`.
  **`PRE-PROD` is now the next authorizable track but is NOT authorized by this
  closeout.**

## §R.23 PRE-PROD-A-R1 — Native needs, allocation, and live concurrency (governs the corrected/activated parts of §R.17/§R.22 for PRE-PROD-A only)

> **Order:** `PRE-PROD-A-R1 — NATIVE NEEDS, ALLOCATION AND LIVE CONCURRENCY`
> (2026-07-19, Opus 4.8). **Baseline:** `dev @ 51f31dd` (REFUND-B1 accepted).
> **Type:** binding contract closure + conditional staging implementation
> authorization. This section closes the PRE-PROD-A contracts and authorizes the
> PRE-PROD-A implementation (migration `db/69` + the dedicated distribution UI)
> **conditionally**, on this documentation gate matching the order exactly. It
> refines §R.17's `PRE-PROD` phase row and §R.22.12's activation gates for the
> **PRE-PROD-A slice only**. Where this section and §R.17/§R.22 diverge on
> PRE-PROD-A scope, **§R.23 governs**; §R.22 continues to govern REFUND-B1.
> **Nothing here authorizes native emission, native receipt, PRE-PROD-B, or
> Phase C** — those remain `NOT AUTHORIZED`.

### §R.23.0 Accepted phase split and emission-after-Phase-C sequence

The PRE-PROD split is ratified. **PRE-PROD-A owns:** explicit Pedido
purchasing-model classification; native need assessment and synchronization;
native draft allocation and allocation removal; allocation coherence and
draft-status enforcement; the dedicated allocation UI; real authenticated
T1/T2 concurrency testing; closure of `LIVE_ALLOCATION_T1_T2_TEST_PENDING`.

**PRE-PROD-A does NOT own:** native emission activation; an authenticated grant
on `emitir_ordem_compra`; native receipt; flat compatibility shadows; receipt
ledger activation; emitted-order cancellation; supplier-assignment relocation
(B2); production promotion.

**Binding phase sequence.** PRE-PROD-A may activate native needs and allocation
while native emission stays inactive. **Phase C must establish native receipt
authority before any client-facing native emission may be activated.** The
former PRE-PROD-B emission step becomes a **post-Phase-C activation gate**, not
the immediate successor of PRE-PROD-A. PRE-PROD-A acceptance does not
automatically authorize B2, Phase C, or emission activation. `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`
remains open; no bridge and no receipt work is performed in PRE-PROD-A.

### §R.23.1 Pedido-level purchasing regime — no mixed authority per Pedido

A Pedido must not silently mix legacy-flat and native purchasing authority. An
explicit **immutable** Pedido-level regime is introduced.

- **Table `public.pedido_compra_fio_regime`** — `pedido_id UUID PRIMARY KEY`
  (FK `pedidos`), `modelo TEXT CHECK (modelo IN ('legacy','native'))`,
  `origem TEXT`, `definido_em TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `definido_por UUID` nullable (FK `auth.users`). One regime row per Pedido;
  no client UPDATE/DELETE path. RLS: `SELECT` to `authenticated` under
  `is_admin()`; no client DML policy.
- **Immutability guard.** A `BEFORE UPDATE OR DELETE` trigger raises, so no
  application writer (even an owner-bypassing one) can mutate or remove a regime
  row through the client surface.
- **Seeding / classification rule.** A Pedido carrying **any** legacy purchasing
  evidence — any `ordens_compra_fio` row on its OPs, any `legado=TRUE`
  `necessidade_compra_fio`, any imported `ordem_compra_item_compat_fio` mapping,
  or any imported legacy `ordem_compra` header — is classified **`legacy`**.
  Unresolved NULL-Pedido OP1/OP2 rows create no regime row. A Pedido **without**
  existing legacy purchasing evidence becomes **`native`** on its first
  purchasing-model resolution. Once `native`, no new flat `ordens_compra_fio`
  purchasing row may be created for that Pedido; once `legacy`, native need
  synchronization must reject it.
- **`resolver_regime_compra_fio_pedido(p_pedido_id UUID) RETURNS JSONB`** —
  transactional; serializes first resolution (advisory lock on the Pedido);
  returns an existing regime if present; detects historical legacy evidence
  before creating `native`; creates `native` only when no legacy evidence
  exists; idempotent; `SECURITY DEFINER`, internal `is_admin()`; EXECUTE to
  `authenticated` only, `PUBLIC`/`anon`/`service_role` revoked.

### §R.23.2 `persistirOP` cutover — regime-gated, no silent fallback

`persistirOP` must consult the **server-resolved** Pedido regime before touching
`ordens_compra_fio`. The client must not decide the regime locally; it consumes
the server response.

- **`modelo='legacy'`** — preserve the existing flat-row creation/deletion
  (`op-persistir.js` step 5, `status='aberta'`) and all legacy readers/writers
  exactly.
- **`modelo='native'`** — do **not** create new `ordens_compra_fio` rows; do not
  delete existing historical flat rows; synchronize native needs through the
  canonical server writer (§R.23.4); create no order headers, items, or
  allocations automatically; create no flat compatibility shadow.
- **No silent fallback.** A native Pedido may not fall back to flat purchasing
  after an RPC/synchronization failure; the failure stops the operation and
  surfaces a business error.

### §R.23.3 Authoritative need-assessment source (PROVEN, §8 hard stop cleared)

Native kg requirements are computed **server-side** from canonical
production-demand data — never from client-supplied totals, never from
`ordens_compra_fio` as the source (flat rows are a **parity oracle** only).

- **Source tables / joins.** `op_itens` → `modelos` (`cor_1_id`, `cor_2_id`,
  `largura`) → `parametros_largura` (matched on `round(largura,2)`), scoped to
  the Pedido via `ops.lote_id → lotes.pedido_id`.
- **Eligible OP states.** `ops.status IN ('aberta','em_producao')`. `simulada`
  is excluded (it produces no flat rows). `ops.tipo` must be `tecelagem`;
  latex/acabamento OPs consume no yarn and are excluded.
- **kg formula (exact replica of `js/calculo-op.js`).** Cotton per op_item:
  `algodao_por_ml · valor_x · metros_pedidos`, **added to both `cor_1_id` and
  `cor_2_id`** (including the double-add when they are equal — faithful to the
  code), aggregated per (OP, `cor_id`). Polyester per op_item:
  `poliester_por_ml · valor_x · metros_pedidos`, applied to both `PRETO` and
  `BRANCO`. Rounded to 3 decimals (`round3`); rows with `kg ≤ 0` are dropped.
- **Native identity re-grouping.** Cotton need = per (Pedido, OP, cotton color).
  Shared polyester need = per (Pedido, polyester color), aggregating the same
  per-OP polyester quantities across the Pedido's eligible OPs — a
  parity-preserving `SUM` of already-proven per-OP blocks.
- **Ownership / relationship.** Pedido-ownership is enforced by the
  `necessidade_compra_fio` op→lote→pedido guard trigger (§R.3). The formula is
  the SQL image of `calcularFiosOP` + `montarOrdensCompraFio`.
- **Parity evidence (recorded).** The SQL assessment reconstructed against the
  live staging corpus (`ucrjtfswnfdlxwtmxnoo`) reproduces the 64-row flat
  corpus **exactly** when restricted to eligible OP states: 64 calc rows, 0
  unmatched keys, **0.000 kg drift**, cotton and polyester both matched. The §8
  hard stop is cleared; the full fixture parity is re-run at db/69 authoring.

### §R.23.4 Native need-assessment RPCs

- **`avaliar_necessidades_compra_fio(p_pedido_id UUID) RETURNS JSONB`** —
  read-only preview.
- **`sincronizar_necessidades_compra_fio(p_pedido_id UUID) RETURNS JSONB`** —
  canonical writer.

Both require `modelo='native'`, enforce Pedido existence and ownership, use only
server-derived demand, are `SECURITY DEFINER` + internal `is_admin()`, EXECUTE
to `authenticated` only (`PUBLIC`/`anon`/`service_role` revoked).

**Native need identity.** Cotton: one need per (Pedido, OP, cotton color),
`origem_tipo='op'`, `op_id` required. Shared polyester: one need per (Pedido,
polyester color), `origem_tipo='pedido'`, `op_id` NULL, demand aggregated across
the Pedido's eligible OPs.

**Synchronization semantics.** All-or-nothing per Pedido; idempotent (repeated
identical sync creates no new rows); never mutate `legado=TRUE` needs; never
convert a legacy need to native; create missing native needs; update
`kg_necessario` **absolutely**; delete an obsolete native need only when
`kg_alocado=0` and no allocation rows reference it; **reject** the whole sync if
a decrease would make `kg_necessario < kg_alocado`, or if an affected allocation
belongs to a non-draft order; return `created`/`updated`/`deleted`/`unchanged`/
`conflicts` separately; leave `kg_alocado` maintenance to the installed trigger
(§R.4). No orders or items are created during need synchronization.

### §R.23.5 Absolute, idempotent allocation semantics — qualified by the hybrid-origin addendum

The installed `alocar_necessidade_compra_fio(p_item_id, p_necessidade_id,
p_op_id, p_kg)` is retained as implementation history but is a localized
forward-correction target. The future writer must remove caller authority over
`op_id`: it locks the need first and derives allocation provenance from that row.

- **Absolute quantity.** `p_kg` is the **absolute** desired allocation for the
  logical identity `(ordem_compra_item_id, necessidade_compra_fio_id, derived
  op_id)` — not an
  increment. Repeated calls with the same identity and `p_kg` reproduce the same
  state without increasing the quantity.
- **Null-safe uniqueness.** The logical identity must treat NULL derived provenance
  as equal. The current plain unique index on `(item_id, necessidade_id, op_id)` is
  insufficient because PostgreSQL permits multiple NULLs; future correction must
  enforce one logical shared allocation without changing legacy rows. **Preflight:**
  existing allocations must be duplicate-free under the corrected NULL-safe
  identity — HARD STOP otherwise.
- **Validation (before insert/update).** Lock the `necessidade` row
  `FOR UPDATE`; lock/validate the existing identity; load item + parent order;
  require `ordem_compra.legado=FALSE` and parent `status_administrativo='rascunho'`;
  require item and need to share the same Pedido; require material identity
  equality; require cotton/polyester color equality; require `p_kg > 0`; enforce
  the **total need cap** after replacing the existing identity quantity;
  `kg_alocado` maintenance stays exclusively with the installed trigger.
  OP-origin need: derive `allocation.op_id = necessidade.op_id` after locking the
  need; the caller cannot choose, replace, or override it. Shared Pedido-origin
  need: require `necessidade.op_id IS NULL` and derive `allocation.op_id IS NULL`;
  never select, infer, or fabricate an OP. The need-level total is the authoritative
  cap.
- **Return.** `ok`, `codigo`, allocation id, `created|updated|unchanged`
  discriminator, previous kg, final kg, need total, allocated total, remaining
  total.

### §R.23.6 Allocation removal

**`remover_alocacao_compra_fio(p_alocacao_id BIGINT) RETURNS JSONB`** — loads and
locks the allocation and its need; requires a **native** parent order in
`status='rascunho'`; rejects imported legacy allocations; deletes only the
target allocation (the trigger recomputes `kg_alocado`); returns a stable
not-found result for an already-absent allocation without fabricating success;
`SECURITY DEFINER` + `is_admin()`; EXECUTE to `authenticated` only.

### §R.23.7 Post-emission immutability backstop (database-level)

Beyond RPC discipline, `db/69` installs a database-level backstop: no INSERT/
UPDATE/DELETE of an allocation, and no item-quantity mutation, survives when its
parent order is not `rascunho`. Triggers (or equivalent constraints) prevent an
owner-bypassing writer from accidentally changing emitted/cancelled orders. The
backstop preserves imported legacy rows and REFUND-A seed data.

### §R.23.8 Distribution read model

**`obter_distribuicao_ordem_compra(p_ordem_id BIGINT) RETURNS JSONB`** —
server-composes order + Pedido identity; items; compatible native needs; current
allocation identities with per-allocation OP attribution; kg required/allocated/
remaining; item ordered qty, allocation total, and reconciliation difference;
Pedido-level distribution completeness; reasons preventing distribution/future
emission; allowed allocation/edit/removal actions. The client never reconstructs
authority by joining tables.

`obter_ordem_compra_admin` (and, where required, `listar_ordens_compra_admin`)
expose `distribuicao_completa`, `pronta_para_emissao`, `pode_emitir=false`, and
`bloqueio_emissao`:
- `'recebimento_nativo_ainda_inativo'` when distribution is **complete** (the
  block is Phase-C native receipt, not distribution);
- `'distribuicao_necessidades_pendente'` when distribution is **incomplete**.

The server computes readiness; it does **not** authorize emission.

### §R.23.9 Emission remains inactive

`db/69` does not grant `emitir_ordem_compra` to `authenticated`, does not wire
the emit button, does not call the emission RPC from application code, creates no
emitted native order outside rollback-only owner fixtures, and changes no receipt
authority. The UI renders **Emitir** as disabled; when distribution is complete
its explanation states that emission **awaits native receipt activation
(Phase C)**, not that distribution is incomplete.

### §R.23.10 Distribution UI surface, Pedido / Insumos ownership, no new route

Purchasing distribution belongs to the existing **Pedido → Insumos /
`aguardando_fios`** context; it is not a new stepper stage and is not owned by an OP.
The dedicated Ordem de Compra detail is an allowed focused surface for the action,
not a transfer of domain ownership. The implemented child module
**`js/screens/ordem-compra-distribuicao.js`** remains under the existing detail
screen; regime resolution is factored into **`js/screens/op-compra-regime.js`**.
Authorized application files: `js/screens/op-persistir.js`,
`js/screens/op-compra-regime.js` (new), `js/screens/ordem-compra.js`,
`js/screens/ordem-compra-data.js`, `js/screens/ordem-compra-render.js`,
`js/screens/ordem-compra-events.js`, `js/screens/ordem-compra-distribuicao.js`
(new), `index.html`. No allocation orchestration is added to `op-nova.js`, Pedido
detail, the supplier screen, transition modals, or unrelated screens.

The existing route `#/ordens-compra/:id` is reused; **no** new route, and no
change to `router.js`/`boot.js`/`common.js` (recon confirmed a child module wires
purely via an `index.html` script tag self-registering on
`window.RAVATEX_SCREENS.ordemCompra`). If any of those three files turns out
required, that is a HARD STOP with a reported reason.

### §R.23.11 Migration `db/69` object manifest + ACL

**`db/69_ordem_compra_preprod_allocation.sql`** — authorized objects only:
`pedido_compra_fio_regime`; the regime immutability guard;
`resolver_regime_compra_fio_pedido`; `avaliar_necessidades_compra_fio`;
`sincronizar_necessidades_compra_fio`; the hardened absolute
`alocar_necessidade_compra_fio`; `remover_alocacao_compra_fio`; the allocation
identity uniqueness index; the post-emission item/allocation mutation guards;
`obter_distribuicao_ordem_compra`; the required read-model replacements; and the
exact grants/revocations. **Not authorized:** emission grant; bridge function;
flat shadow generation; receipt-ledger activation; `saldo_fios` movement; native
receipt; any unrelated schema change. Every new client RPC is `SECURITY DEFINER`
with internal `is_admin()`, EXECUTE to `authenticated` only,
`PUBLIC`/`anon`/`service_role` revoked; new tables get no client DML policy.

### §R.23.12 Concurrency mechanism, live T1/T2 test, grant-activation order

**Mechanism.** The canonical allocation writer locks the target
`necessidade_compra_fio` row with `SELECT … FOR UPDATE`; callers touching
multiple needs in one transaction lock in ascending `necessidade_id` order.

**Live test.** `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is closed only by a **real**
two-session test using authenticated concurrent PostgREST requests from a
logged-in staging admin **browser** session (never the service channel; no
plaintext password is requested/handled). A transient staging-only probe
(`preprod_a_allocation_concurrency_probe`, `SECURITY DEFINER`, `is_admin()`,
temporarily granted to `authenticated`, calling the real writer and capturing
`pg_backend_pid()` + timing) is authorized **outside** the committed migration
and dropped immediately after; it is never committed. Required proof: distinct
backend PIDs; T2 waits on T1's need-row lock, then re-evaluates the remaining
balance and returns a business rejection; exactly one 60 kg allocation survives
against a `kg_necessario=100` need with two draft orders; `kg_alocado=60`,
`SUM(allocations)=60`, no cache drift, no over-allocation, no partial residue.

**Grant-activation order.** (1) install `db/69` with active allocation grants;
(2) keep the application allocation controls feature-disabled; (3) run
owner-level + authenticated negative tests; (4) run the live T1/T2 test; (5) on
pass, enable the allocation controls in application code; (6) on fail, revoke the
allocation/need-writer grants immediately, do not enable the UI, clean fixtures,
HARD STOP. The transient staging grants during this controlled test are
authorized and are not production activation.

### §R.23.13 Rollback contract

Rollback rehearsal: revoke all PRE-PROD-A writer grants; disable the allocation
UI; restore native-mode `persistirOP` to a **safe blocked state** rather than
silently reverting to flat; retain native regimes/needs/allocations as inert
read-only data; delete only test fixtures; drop `db/69` functions/triggers/
indexes/table in dependency-safe order during rehearsal; confirm `db/67`/`db/68`
intact; preserve all legacy flat data, events, and mappings; never auto-convert
native Pedidos to legacy. A production rollback must never silently reintroduce
mixed authority.

### §R.23.14 Debts and closeout vocabulary

`LIVE_ALLOCATION_T1_T2_TEST_PENDING` is the debt PRE-PROD-A closes (via the live
test). **Kept open:** `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`;
native emission inactive; native receipt authority deferred to Phase C;
contemporaneous read-only production diagnosis mandatory before any production
promotion; `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`. On full-gate pass the
executor records `PRE-PROD-A: IMPLEMENTED / VERIFIED IN STAGING / LIVE
CONCURRENCY PASS / AWAITING ARCHITECT VISUAL VALIDATION AND ACCEPTANCE` and does
not self-accept. **`PRE-PROD-B` and `Phase C` remain `NOT AUTHORIZED`.**

### §R.23.15 PRE-PROD-A-R1 staging closeout evidence (2026-07-19; not architect acceptance)

The live authenticated T1/T2 gate **passed** and resolves
`LIVE_ALLOCATION_T1_T2_TEST_PENDING`: T1 backend PID `2272591` acquired the real
need row lock first (`2026-07-19T14:07:12.423433+00:00`), published advisory
readiness before T2 launched, held, and committed an absolute 60 kg allocation.
T2 PID `2272590` started at `...14:07:13.362084+00`, waited, acquired the row lock
at `...14:07:14.962558+00`, re-evaluated the 40 kg remainder, and returned
`excede_saldo` for its absolute 60 kg request. The final allocation and cache were
60 kg, with no over-allocation.

The authenticated ACL matrix retained its executed runtime evidence; the current
catalog additionally confirms the eight authorized native admin RPCs are
`SECURITY DEFINER`, `authenticated`-only, and denied to `anon`/`PUBLIC`.
`emitir_ordem_compra` remains ungranted/inactive. Allocation UI activation is
limited to `ALLOCATION_ENABLED=true`; native emission and receipt remain inactive.

The staging rollback rehearsal disabled the allocation UI, revoked the three
PRE-PROD-A writer grants, proved the native `persistirOP` sync-denial path returns
`necessidades_sync` with no flat fallback, and restored UI/grants. The transient
probe catalog count, run-key advisory locks, active probe activity, and all test
fixtures are zero. Browser evidence was collected at desktop, tablet, and mobile;
the 390px result reproduces the pre-existing `ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`.
PRE-PROD-A is **awaiting architect visual validation and acceptance**; this record
does not self-accept it.

### §R.23.16 Architect acceptance (2026-07-19)

The architect ruled `PRE-PROD-A-R1` **`CLOSED /
ACCEPTED_WITH_NONBLOCKING_ADMIN_SHELL_MOBILE_RESPONSIVENESS_DEBT`**. This accepts
the staging migration `20260719120036 / 69_ordem_compra_preprod_allocation`, the
live T1/T2 evidence in §R.23.15, the authenticated ACL matrix, allocation UI
activation for eligible native drafts, rollback rehearsal, and desktop/tablet
visual evidence. `LIVE_ALLOCATION_T1_T2_TEST_PENDING` is resolved. Native emission
remains inactive and ungranted; native receipt and Phase C remain pending;
`NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` remains open. The mobile
shell debt remains open and non-blocking. A contemporaneous production diagnosis is
mandatory before any production work; production, `main`, and push remain
prohibited. No PRE-PROD-B or Phase C implementation is authorized by this
acceptance. UI provenance / modern-visual-language audit is deferred as a separate,
post-stabilization, non-blocking activity.

## §R.24 PHASE-C1 — Native receipt authority contract (CLOSED / ACCEPTED)

> **Order:** `PHASE C1 — NATIVE RECEIPT AUTHORITY CONTRACT` (2026-07-19).
> **Baseline:** `dev @ 47b8e6a6bc8dea0cd0fe053fef2ef9f2f16f14fa`.
> **Scope:** documentation-only contract closure. This section authorizes no
> implementation, migration, staging write, grant, UI, test, production operation,
> push, or Phase C2 work. Where earlier receipt projections diverge, this section
> governs Phase C.

### §R.24.1 Canonical physical authority

`ordem_compra_fio_lancamentos` evolves in place as the **sole canonical physical
receipt ledger**. Phase C must not create a competing ledger or preserve
`ordens_compra_fio.kg_recebido` as parallel authority. Receipt events remain an
immutable audit trail only; they do not authorize or calculate physical stock.

The database derives item received quantity, order/header receipt status, receipt
progress, and every projection from the canonical ledger. Clients receive no direct
`INSERT`, `UPDATE`, or `DELETE` authority on receipt headers, lines, ledger entries,
derived totals, or inventory movements.

### §R.24.2 Immutable receipt header and lines

Each physical submission creates or reuses an immutable receipt header containing:

- receipt/document identity and origin;
- effective receipt date;
- authenticated actor identity and actor class;
- one stable submission idempotency key in a defined namespace; and
- immutable command metadata sufficient to reproduce and audit the accepted command.

Each receipt line binds the header to exactly one native purchase-order item and its
canonical ledger entry. When the line satisfies a need, it also binds the concrete
allocation and preserves that allocation's hybrid provenance: the derived real OP for
OP-origin needs, or NULL for genuinely shared Pedido-origin needs. One header may
contain multiple items, allocations, real OPs, and shared NULL-OP allocations. Header
and line history is immutable;
correction uses reversal, never mutation or deletion.

### §R.24.3 Cotton, shared polyester, and excess

- **Cotton / OP-origin:** receipt follows a concrete allocation whose
  `allocation.op_id` equals the locked need's real OP.
- **Shared polyester / Pedido-origin:** both `necessidade.op_id` and
  `allocation.op_id` remain NULL. The receipt preserves Pedido, supplier, material,
  color, quantity, receipt identity, and inventory identity without inventing an OP.
- **Excess:** quantity above allocated need remains on the same receipt and item. It
  must not create a fake need or allocation. The canonical writer may create only the
  narrowly scoped transactional inventory movement required for that excess, in the
  same transaction as the receipt.

### §R.24.4 Native receipt writer

The future multi-line native receipt writer must:

1. accept only native orders that are emitted, non-cancelled, and otherwise eligible
   for physical acceptance;
2. lock the order and addressed items, then lock concrete allocations in deterministic
   ascending allocation-ID order;
3. re-evaluate all eligibility and balances after locks are acquired;
4. enforce a stable idempotency key: an exact repeat returns the original header,
   lines, ledger entries, and result; a conflicting payload under the same key rejects;
5. enforce cumulative canonical receipt against an allocation at or below
   `kg_alocado`;
6. reject missing, foreign, removed, invalid-state, mismatched-item, or
   provenance-inconsistent allocations and every negative/zero quantity not belonging
   to reversal semantics; NULL shared provenance is valid and must not be replaced;
7. write header, lines, canonical positive ledger entries, derived projections, and
   any narrow excess inventory movement atomically; and
8. preserve receipt history immutably.

The exact public signature/result contract and full lock order remain a C2 design
decision, but they must preserve the rules above and support one submission spanning
multiple items, allocations, real OPs, and shared NULL-OP provenance.

### §R.24.5 Reversal writer

Reversal never edits or deletes a positive entry. It appends an immutable negative
ledger entry that references the positive source and records its own actor, reason,
date, metadata, and stable idempotency key. The writer locks the positive source and
its reversals, computes the remaining reversible quantity under lock, rejects any
excess, and guarantees that canonical item/allocation/order totals cannot become
negative. An exact idempotent repeat returns the original reversal result; a key/payload
conflict rejects. Any paired inventory movement reverses atomically and by reference.

### §R.24.6 Actors and ACL

The admin workflow and a future matching-supplier workflow must call the **same
canonical RPC**. Supplier authority, if later activated, is restricted to an order
whose supplier matches the authenticated supplier identity. Neither admin nor supplier
clients receive table DML. Supplier reversal permission is deliberately unresolved and
must be decided explicitly before implementation; it cannot be inferred from receipt
permission. Supplier UI is deferred and is not part of the first admin receipt UI.

### §R.24.7 Legacy import classes

The cutover migration applies the reconciled legacy classes as follows:

| Class | Canonical seed rule |
|---|---|
| A | One `import_saldo_inicial` receipt, mapped to the corresponding native item, for each non-zero observed receipt balance. |
| B | No receipt seed. |
| C | No legacy rows exist; no seed. |
| D | One `import_saldo_inicial` receipt per mapped item for the non-zero observed balance; preserve received-without-emission provenance without inventing emission or other fake events. |

Imported entries remain distinguishable by origin and immutable after acceptance. No
class may be made representable by a fake need, fake allocation, or fake OP.

### §R.24.8 Cutover, consumers, ACL closure, and rollback

The Phase C cutover must execute under a write fence for **both** direct flat receipt
writers and must prove both are denied before import. It then must, in a controlled and
reconcilable order:

1. snapshot and validate all **51** legacy-to-native mappings;
2. create the required canonical imports and reconcile counts/quantities exactly;
3. migrate both current receipt consumers to the canonical writer;
4. switch receipt readers and projections to the canonical ledger;
5. revoke flat receipt updates;
6. close the identified receipt ACL gap; and
7. remove anonymous update authority.

Rollback to flat authority is permitted only before the first post-switch canonical
receipt and only when the proof shows **zero canonical writes** after the switch. Once
any post-switch canonical receipt exists, recovery is forward-only; canonical history
must not be discarded or rewritten.

### §R.24.9 UI placement

The first receipt UI is admin-only and belongs on `#/ordens-compra/:id`, in a persistent
**Recebimentos** section. Creation/reversal actions open a dedicated modal and call the
canonical RPC. Receipt input must not appear in the OP screen, Pedido screen, production
transition modal, or supplier-assignment modal. Supplier receipt UI remains deferred.

### §R.24.10 Binding delivery sequence and emission gate

1. **C1:** this documentation-only authority contract.
2. **C2:** inactive foundation, receipt/reversal writers, and narrowly scoped excess
   inventory movement/reconciliation.
3. **C3:** writer fencing, 51-mapping snapshot, legacy import, both-consumer migration,
   reader switch, reconciliation, flat-update revocation, and ACL closure.
4. **C4:** admin receipt UI; a later separately authorized supplier UI may reuse the
   same RPC subject to its actor/permission contract.
5. **C5:** separate native emission activation gate.

Native emission stays inactive and ungranted until **C1 through C4 are each accepted**.
No phase chains automatically, and no part of this C1 acceptance authorizes C2.

### §R.24.11 C2 design questions that remain open

Before C2 implementation authorization, the architect must accept:

- the exact header schema, receipt/document identity rules, and idempotency namespace;
- whether a matching supplier may reverse receipts, and under which explicit policy;
- the exact excess inventory movement object and its reconciliation authority;
- the multi-line RPC request/result shape and complete deterministic lock order; and
- the migration split between inactive foundation and the later cutover/import.

`NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` is resolved at the authority
level by the single-ledger, explicit-origin, multi-line contract above; the named C2
physical schema decisions remain open. **Status:** `PHASE-C1` is `CLOSED / ACCEPTED`.

## §R.25 PHASE-C2 — Native receipt implementation boundaries

> **Order:** `PHASE C2 — NATIVE RECEIPT FOUNDATION, WRITER, REVERSAL AND
> NARROW INVENTORY INTEGRATION` (2026-07-19).
> **Baseline:** `dev @ 3395f83df0eb7db604df9a80d4a43a0601bc8b6c`.
> **Status:** `CLOSED / ACCEPTED`.
> This section resolves every C2 question left by §R.24.11 and governs migration
> `db/70_ordem_compra_native_receipt_foundation.sql`. It does not authorize C3,
> C4, C5, production, `main`, or push.

### §R.25.1 Immutable command header and idempotency identity

Create `public.ordem_compra_recebimentos`, one immutable header per accepted
receipt or reversal command. Its concrete persisted identity is:

- `id BIGSERIAL PRIMARY KEY`;
- `ordem_compra_id BIGINT NOT NULL`;
- `comando_tipo IN ('recebimento','estorno')`;
- `idempotency_namespace TEXT NOT NULL`, fixed to `native_receipt_v1` in C2;
- `idempotency_key TEXT NOT NULL`;
- `ator_id UUID NOT NULL` and `ator_tipo IN ('admin','fornecedor')`;
- `ocorrido_em TIMESTAMPTZ NOT NULL` and `criado_em TIMESTAMPTZ NOT NULL`;
- optional `documento_ref`, required explicit `origem_tipo`, optional `origem_ref`;
- immutable canonical `comando_payload JSONB`, `comando_hash`, and
  `resultado_metadata JSONB` sufficient to reconstruct the exact result.

The unique command identity is `(idempotency_namespace, ator_tipo, ator_id,
idempotency_key)`. Admin and supplier keys therefore cannot collide accidentally,
and separate authenticated actors have independent key spaces. Canonical JSONB
payload equality defines an exact retry: exact equality returns the original
header and its immutable ledger result; any same-identity payload difference rejects
with `idempotencia_conflitante`. Header UPDATE/DELETE is denied by privilege and an
immutable guard trigger. Failed commands roll back the header with the transaction.

### §R.25.2 Ledger extension

Evolve `public.ordem_compra_fio_lancamentos` additively, preserving its existing
legacy parent columns and append-only/sign constraints. Add nullable transition
columns which are mandatory for native `recebimento`/`estorno` rows:

- `recebimento_id` → immutable command header;
- `ordem_compra_id` → native order header;
- `ordem_compra_item_alocacao_id` → concrete allocation when the line is allocated;
- `op_id` → derived provenance copied from that allocation: real OP for OP-origin,
  NULL for shared Pedido-origin;
- immutable `material`, `cor_id`, and `cor_poliester` reconciliation identity;
- signed `kg_excesso` (zero for allocated lines, equal to signed ledger kg for an
  explicit excess line);
- `ator_tipo`; and
- stable `linha_indice` within the command.

A positive native line is explicitly one of two shapes: `alocacao`, requiring a
concrete allocation and preserving its derived real-or-NULL provenance, or `excesso`, requiring no allocation and no
fabricated OP. A reversal copies the source line's attribution and classification,
uses negative kg, and references the positive source through `estorno_de_id`.
`import_saldo_inicial` remains blocked in C2 and is neither created nor assigned a
reversal policy here.

### §R.25.3 Canonical receipt RPC

The sole C2 writer is:

```text
registrar_recebimento_ordem_compra(
  p_ordem_id BIGINT,
  p_idempotency_key TEXT,
  p_recebido_em TIMESTAMPTZ,
  p_documento_ref TEXT,
  p_origem_tipo TEXT,
  p_origem_ref TEXT,
  p_linhas JSONB
) -> JSONB
```

`p_linhas` is a non-empty JSON array. Each object has `item_id`, `destino`
(`alocacao` or `excesso`), positive absolute command quantity `kg`, and
`alocacao_id` only for `alocacao`. One command may span multiple items,
allocations, real OPs, and shared NULL-OP allocations. The RPC is transactional, `SECURITY DEFINER`, fixed safe
search path, and callable only by `authenticated` after revoking `PUBLIC`, `anon`,
and `service_role`.

The server identifies the actor from `auth.uid()`. An active admin may receive any
eligible native order. An active supplier may receive only when its
`usuarios.fornecedor_id` equals the order's frozen `fornecedor_id`. The server
rejects every other actor and never trusts client actor, supplier, order totals,
material/color, OP provenance, or derived balance.

Eligibility is native/non-legacy, `status_administrativo='emitida'`, not cancelled,
and `status_aceite IN ('nao_aplicavel','aceita')`; draft, acceptance-pending,
rejected, cancelled, legacy, foreign item/allocation, and mismatched identity reject.
Allocated cumulative receipt cannot exceed `kg_alocado`; non-excess cumulative item
receipt cannot exceed `kg_pedido`; any quantity above ordered/allocated capacity must
be an explicit `excesso` line. Partial and successive commands are permitted.

### §R.25.4 Administrator-only reversal RPC

The sole reversal writer is:

```text
estornar_recebimento_ordem_compra(
  p_ordem_id BIGINT,
  p_idempotency_key TEXT,
  p_estornado_em TIMESTAMPTZ,
  p_motivo TEXT,
  p_linhas JSONB
) -> JSONB
```

Each line identifies one original positive native `recebimento` ledger entry and a
positive absolute quantity to reverse. The RPC requires `is_admin()`; matching
suppliers are explicitly denied reversal. It locks sources and existing reversals,
computes remaining reversible quantity, rejects over-reversal, and appends negative
immutable rows. It never edits/deletes a source and cannot make item, allocation,
excess, or stock totals negative. Its idempotency uses the same header namespace and
exact-payload rule. C2 refuses reversal of future `import_saldo_inicial` entries.

### §R.25.5 Deterministic lock order

Both writers use this complete order and re-evaluate all caps after locks:

1. native `ordem_compra` header;
2. affected `ordem_compra_item` rows by ascending `id`;
3. affected `ordem_compra_item_alocacao` rows by ascending `id`;
4. scoped `ordem_compra_recebimentos` idempotency identity;
5. relevant positive/reversal ledger rows by ascending `id`;
6. affected inventory identities in deterministic `(material, cor_id,
   cor_poliester)` order.

Inventory identity serialization may use transaction advisory locks plus row locks,
provided the key is derived only from the stable material/color identity. Command
line insertion is stable by item/allocation/line index. Lock waits must end in
post-wait balance re-evaluation, never stale validation.

### §R.25.6 Derived caches and read model

The append-only ledger remains authority. Canonical database logic alone maintains
`ordem_compra_item.kg_recebido` and `ordem_compra.status_recebimento`. Item remaining,
allocation received/remaining, reversible quantity, and physical excess are computed
projections. No client writes a derived cache.

The verification read model is
`obter_historico_recebimento_ordem_compra(p_ordem_id BIGINT) -> JSONB`. It exposes
immutable headers, positive/negative entries, allocation and derived real-or-NULL OP attribution,
item totals, excess, remaining reversible quantity, inventory movement linkage, and
actor-specific allowed actions. It is callable only by an active admin or the active
matching supplier, through `authenticated`; it grants no mutation.

### §R.25.7 Narrow inventory movement authority

The current inventory inspection found `saldo_fios` as a multi-origin aggregate
cache, written by the existing OP recalculation path, and no structurally adequate
source-linked receipt movement authority. C2 therefore creates only
`public.ordem_compra_fio_movimentos_estoque`, an immutable, receipt-source-specific
movement table. It is not a second physical-receipt ledger and is not a general
inventory redesign.

Exactly one movement row exists per native receipt ledger entry, unique by
`lancamento_id`. It carries native order/item/allocation/derived real-or-NULL OP and material/color
identity plus signed `kg_excedente_delta`, surplus before/after, actor, and timestamp.
Allocated receipt/reversal rows may legitimately record zero stock delta; explicit
excess produces a positive surplus delta and reversal produces the corresponding
non-positive delta. This preserves §R.9: only ledger-derived **surplus delta** changes
`saldo_fios`; the same kg is never both allocated need satisfaction and general stock.
Ledger row, source-linked movement, and `saldo_fios` cache delta are one transaction.
The cache cannot become negative, retries cannot duplicate movement, and a
reconciliation compares item ledger surplus with summed source-linked movement.

The intended material/color uniqueness of `saldo_fios` is enforced for nullable
color axes before C2 writes it; no unrelated saldo table, OP recalculation writer, or
general stock contract is redesigned.

### §R.25.8 ACL and rollback

All C2 tables enable RLS. `PUBLIC`, `anon`, and `authenticated` receive no table
mutation; no client receives UPDATE/DELETE. Only the three named RPCs receive the
minimum `authenticated` EXECUTE grant; the reversal function still denies supplier
actors internally. `service_role` receives no explicit EXECUTE. Native
`emitir_ordem_compra` remains inactive and ungranted. Flat receipt UPDATE ACL remains
unchanged until C3.

C2 rollback is safe only while no real canonical receipt exists: revoke C2 RPC
grants, prove no productive reader depends on C2, remove test fixtures, and rehearse
dependency-safe removal of only C2 objects in a transaction that is rolled back or
equivalently controlled. db/67-db/69, legacy data/readers/writers, and flat ACL remain
intact. Once any real immutable canonical receipt exists, destructive rollback is
forbidden and recovery becomes forward-only.

### §R.25.9 Explicit exclusions and phase gate

C2 creates no legacy opening balance, import, cutover fence, flat-consumer migration,
productive-reader switch, flat UPDATE revocation, receipt UI, supplier UI, native
emission activation, or emission grant. C3 owns cutover/import/readers/ACL; C4 owns
admin UI and any later supplier UI; C5 is the separate emission gate. No phase chains.

### §R.25.10 Implementation and staging verification

Migration `20260719160518 / 70_ordem_compra_native_receipt_foundation` installed the
exact C2 contract on staging `ucrjtfswnfdlxwtmxnoo`. The focused native purchase-order
suite passed 48/48. Rollback-only functional evidence covered partial, successive,
multi-item, multi-allocation, real-OP attribution, explicit excess, supplier scope,
administrator reversal, exact replay/conflict, state rejection, allocation caps,
immutable guards, read scope, ledger/cache derivation, and source-linked stock delta.

Five independent database-backend scenarios verified same-allocation contention,
duplicate idempotency, receipt/reversal collision, the then-current shared-polyester
real-OP allocation shape, and same-item excess/cache serialization. These results
remain accepted evidence for C2 but do **not** prove the new shared NULL-OP shape;
focused forward revalidation is mandatory after the localized correction. Waiting transactions
re-evaluated balances under lock. The dependency-safe rollback rehearsal removed all
C2 objects inside a transaction and then rolled back, proving restoration without
CASCADE or damage to db/67-db/69 or flat ACL.

All marked fixtures and temporary concurrency infrastructure were removed. Final
staging state has zero native order, receipt-header, receipt-ledger, or movement rows;
no cron, dblink, probe schema/function, disabled trigger, or orphan remains;
`saldo_fios` is restored to 5 rows / 2,685.020 kg. Native emission remains ungranted,
flat ACL is unchanged, and C3/C4/C5 remain unimplemented. The reproducible full-suite
baseline is 3,864 tests / 3,731 pass / 133 identified pre-existing failures. PRE-PROD-A
`47b8e6a`, C2 baseline `3395f83`, and C2 checkpoint `14ca5c7` have identical normalized
failure identities (SHA-256
`af9246c162a514f1162d845bb129980f9a1e4505c46323966d8def262a48a192`): zero baseline-
only/current-only or unstable identities, and zero C2 regression. The historical 132
aggregate is superseded. Architect technical acceptance closes C2; flat receipt remains
productive authority until a separately authorized C3 cutover, with no opening-balance
seed or productive-reader switch performed. The next authorizable action is a fresh
read-only C3 pre-cutover reconciliation and implementation-boundary diagnosis.

---

## 0. Current state (evidenced, read-only inventory) — SUPERSEDED on the persistence model by Part R (retained for provenance)

- **Table `public.ordens_compra_fio`** (`db/01_schema.sql:119-138`): one row
  per fio type/color per OP (`tipo IN ('algodao','poliester')`, `cor_id` for
  cotton, `cor_poliester IN ('PRETO','BRANCO')` for polyester — mutually
  exclusive by CHECK). Today's `status` column conflates what this spec
  treats as the **receipt** dimension only: `pendente` /
  `recebido_parcial` / `recebido_total`. There is **no administrative
  dimension** (no draft/emitted/cancelled distinction — a row is
  immediately actionable the instant it is inserted) and **no acceptance
  dimension** at all.
- **Generation site:** `js/screens/op-persistir.js:218-236` —
  `persistirOP` generates one `ordens_compra_fio` row per fio requirement
  (via `window.calcularFiosOP`/`window.montarOrdensCompraFio`,
  `js/calculo-op.js`) at **Abrir OP** (`status === 'aberta'`), with
  `fornecedor_id: null` and `status: 'pendente'`. This is the flow the
  [[yarn-po-generation-open-decision]] memory flags as deferred — this
  spec's Phase A/B answer that question: rows are still generated at Abrir
  OP, but now born `rascunho` (ratified point 5), not implicitly active.
- **Fornecedor assignment:** `atribuirFornecedorFioOp`
  (`js/screens/op-writes.js:50-86`) sets `fornecedor_id` on all rows of a
  given `tipo` for an OP, and upserts the matching `op_fornecedores` row.
  Unaffected by this spec.
- **The single shared receipt writer:** `registrarRecebimentoOrdemFio`
  (`js/screens/op-writes.js:29-43`) — a direct
  `.update({ kg_recebido, data_recebimento, status })` on
  `ordens_compra_fio`, called from two surfaces:
  - `js/screens/op-nova.js:937-960` (`buildOrdemPendenteRow`, inside
    `buildBlocoFios`, the "Insumos — recebimento de fios" card shown on the
    OP screen itself when `op.status === 'aberta'` or `'em_producao'`);
  - `js/screens/pedido-detail-events.js:1587-1676`
    (`buildInsumosTransferForm`), the form rendered **inside the Pedido
    hub's transition modal for the `insumos` stepper stage**
    (`js/screens/pedido-chain-state.js:14,25` — stage key `insumos`, the
    stage this order calls "`aguardando_fios`"). This is the existing
    sub-panel host named in ratified point 9 — it already renders as a
    stacked form (`node`/`saveLabel`/`onSave`) inside the generic
    transition-modal machinery in `pedido-detail-events.js`, not a
    dedicated screen. Both call sites pass the *current* aggregate
    (`kg_pedido`/`kg_recebido`) and both write straight to the mutable
    `status`/`kg_recebido` columns — there is **no ledger of individual
    physical receipts today**, only a running total.
- **No purchase-order event table exists.** `public.op_eventos`
  (`db/21_op_lifecycle_status_eventos.sql:71-81`) and
  `public.usuarios_eventos` (`db/60`/`db/61`) are the two precedent
  append-only audit tables this spec's `ordem_compra_eventos` (§3.4)
  mirrors — same shape (`tipo_evento`, before/after, `payload jsonb`,
  `criado_por`/`criado_em`).
- **No global boolean-config table exists.** The closest precedent is
  `public.parametros_largura` (per-`largura` row config, `db/04`/`db/10`/
  `db/11`), which is not a singleton pattern. §3.5 proposes a dedicated,
  narrowly-scoped singleton table — not a generic config/feature-flag
  engine (Rule 7 of the ratified model explicitly forbids that).
- **Production gate today: none.** "Iniciar produção" is
  `iniciarProducaoOP` / `snapshotSaldoEIniciarProducao`
  (`js/screens/op-recalculo.js:108-163`), which ends in a **direct
  client-side** `supa.from('ops').update({ status: 'em_producao' })`
  (line 163) — no RPC, no server-side check against yarn receipt. Phase D
  (§6) specifies where the gate attaches; it does not change this code.
- **Pedido linkage for the polyester-per-pedido gate:** an OP does not
  carry `pedido_id` directly. The chain is
  `ordens_compra_fio.op_id → ops.lote_id → lotes.pedido_id`
  (`lotes.pedido_id`, set in `montarPayloadLote`,
  `js/screens/op-persistir.js:72-77`). §5.2 uses this join.
- **Supplier write access:** `public.usuarios.fornecedor_id` and
  `meu_fornecedor_id()` already exist (`db/01_schema.sql:60-70`, RLS
  helper per `docs/architecture/CODE_HEALTH_RULES.md` precedent) — this
  spec does **not** grant suppliers any new write (ratified point 10); it
  only avoids schema choices that would preclude wiring that RLS path
  later (open decision (a), §7).

---

## 1. The ratified model — three orthogonal dimensions

A purchase order's state is **not** a single linear status. It is three
independent axes, each with its own vocabulary and its own write path:

| Dimension | Values | Who/what sets it |
|---|---|---|
| **Administrative cycle** | `rascunho` / `emitida` / `cancelada` | Explicit admin action (`emitir`, `cancelar`) |
| **Acceptance** | `nao_aplicavel` / `pendente` / `aceita` / `rejeitada` | Config-gated at emission; then supplier/admin decision |
| **Receipt** | `nao_recebido` / `parcial` / `recebido` | **Derived**, never written directly — computed from the sum of physical registration entries (`ordem_compra_fio_lancamentos`, §3.2) against `kg_pedido` |

These three axes are independently queryable and independently
transition-audited (§3.4). A row's overall "is this actionable" question is
always answered by combining axes, never by a fourth composite status
column — this avoids reintroducing the linear-state-machine shape the
audit rejected.

---

## 2. Dimension semantics

### 2.1 Administrative cycle

- **`rascunho`** — the order's birth state. Created by `persistirOP` at
  Abrir OP (unchanged trigger point), inheriting the calculated
  `kg_pedido`/`tipo`/`cor_*` exactly as today. A `rascunho` order is not
  receivable and not visible to any supplier-facing surface (none exists
  today, but the rule holds for future Phase E). It has no acceptance
  requirement yet (`status_aceite = 'nao_aplicavel'` until emitted) and no
  receipt activity is possible against it.
- **`emitida`** — set by an explicit `emitir` action (admin-only, no
  supplier self-service in this track). Emission is the **single point**
  where the acceptance-config snapshot is taken (§2.2) and is the
  precondition for any registration under §2.3. Irreversible other than
  via `cancelada`.
- **`cancelada`** — set by an explicit `cancelar` action. A cancelled
  order is terminal: no further emission, no further receipt registration.
  §7g covers cancellation with partial receipts already on file.

Transitions: `rascunho → emitida`, `rascunho → cancelada`,
`emitida → cancelada`. No transition returns to `rascunho`.

### 2.2 Acceptance

- **`nao_aplicavel`** — the default, and the permanent value for any order
  whose `aceite_exigido_na_emissao` snapshot (§2.3) was `false`. Never
  transitions away from `nao_aplicavel`.
- **`pendente`** — set automatically the moment an order transitions
  `rascunho → emitida` **if** the config was `true` at that instant
  (§2.3's freeze rule). Blocks receipt registration (Rule 2: an order
  cannot receive while acceptance is outstanding).
- **`aceita`** — reached via an explicit acceptance decision. Unblocks
  receipt registration.
- **`rejeitada`** — reached via an explicit rejection decision. Does
  **not** by itself cancel the administrative cycle (`emitida` stands);
  §7c covers whether an admin override can move a rejected order forward
  without a fresh acceptance.

Transitions: `pendente → aceita`, `pendente → rejeitada`. Whether
`rejeitada → aceita` is reachable (an override) is an open decision
(§7c), not ratified.

### 2.3 Config semantics and the freeze rule

`public.ordem_compra_config` (§3.5) holds exactly one row, `exige_aceite
BOOLEAN NOT NULL DEFAULT FALSE`, surfaced in the admin UI with the label
**"Exigir aceite antes do recebimento da ordem de compra"**.

- **OFF (default):** emission sets `status_aceite = 'nao_aplicavel'`;
  every emitted order can receive immediately.
- **ON:** emission sets `status_aceite = 'pendente'`; receipt is blocked
  until an explicit acceptance.
- **Freeze rule (Rule 4, binding):** the `emitir` action reads
  `ordem_compra_config.exige_aceite` **at the instant of emission** and
  writes it verbatim into `ordens_compra_fio.aceite_exigido_na_emissao`
  (§3.1). That column, not the live config row, governs the order's
  acceptance requirement for its entire remaining lifecycle. Toggling the
  global config **never** retroactively blocks or unblocks an
  already-emitted order — it only changes the snapshot taken by future
  `emitir` calls. A `rascunho` order is unaffected by any config value
  until the moment it is actually emitted (not at draft-creation time).

### 2.4 Receipt (derived)

- **`nao_recebido`** — no `ordem_compra_fio_lancamentos` row exists yet
  for this order (`SUM(kg_recebido) = 0` or no rows).
- **`parcial`** — `0 < SUM(kg_recebido) < kg_pedido`.
- **`recebido`** — `SUM(kg_recebido) >= kg_pedido`.
- Receipt is **never** set by any write path directly — it is maintained
  by a trigger on `ordem_compra_fio_lancamentos` (§3.2) that recomputes
  the parent row's `kg_recebido` (cache) and `status_recebimento`
  (derived enum) after every insert. No configuration, migration, or
  admin action auto-receives an order (Rule 2) — the only way a receipt
  entry is created is the explicit physical-registration writer (§4,
  Phase C).

---

## 3. Schema (PROPOSED)

All changes below are additive/forward-only. Nothing in this section
alters an existing column's type, drops a column, or rewrites existing
row data beyond the one-time legacy-marking backfill in §3.6. Every
column is nullable or defaulted so existing readers keep working
unmodified through Phase A (§6).

### 3.1 `public.ordens_compra_fio` — new columns

```sql
ALTER TABLE public.ordens_compra_fio
  ADD COLUMN status_administrativo TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status_administrativo IN ('rascunho', 'emitida', 'cancelada')),
  ADD COLUMN status_aceite TEXT NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (status_aceite IN ('nao_aplicavel', 'pendente', 'aceita', 'rejeitada')),
  ADD COLUMN aceite_exigido_na_emissao BOOLEAN,           -- NULL until emitted; frozen snapshot
  ADD COLUMN emitida_em TIMESTAMPTZ,
  ADD COLUMN emitida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN cancelada_em TIMESTAMPTZ,
  ADD COLUMN cancelada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN aceite_decidida_em TIMESTAMPTZ,
  ADD COLUMN aceite_decidida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN aceite_motivo TEXT,                          -- rejection reason / override justification
  ADD COLUMN status_recebimento TEXT NOT NULL DEFAULT 'nao_recebido'
    CHECK (status_recebimento IN ('nao_recebido', 'parcial', 'recebido')),
  ADD COLUMN legado_recebimento_automatico BOOLEAN NOT NULL DEFAULT FALSE;
```

- `status_recebimento` is the **replacement vocabulary** for today's
  `status` column (`pendente`/`recebido_parcial`/`recebido_total`). The
  existing `status` column is **not dropped** in Phase A — it is frozen
  read-only compatibility surface until Phase C's writer swap, at which
  point new writes stop touching it (dead-column removal, if ever, is its
  own future decision, out of this track's scope).
- `kg_recebido` (existing column) becomes a trigger-maintained cache,
  authoritative source moves to `ordem_compra_fio_lancamentos` (§3.2).

### 3.2 `public.ordem_compra_fio_lancamentos` (new — physical receipt ledger)

```sql
CREATE TABLE public.ordem_compra_fio_lancamentos (
  id                   BIGSERIAL PRIMARY KEY,
  ordem_compra_fio_id  BIGINT NOT NULL REFERENCES public.ordens_compra_fio(id) ON DELETE CASCADE,
  kg_recebido          NUMERIC(10,3) NOT NULL CHECK (kg_recebido > 0),
  data_recebimento     DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao           TEXT,
  criado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ordem_compra_fio_lancamentos_ordem_idx
  ON public.ordem_compra_fio_lancamentos(ordem_compra_fio_id);
```

Append-only by convention (same posture as `document_link_revisions`): no
`UPDATE`/`DELETE` RPC is specified for this table in this track. A
mis-registered receipt is corrected by a compensating future decision,
not by mutating history — out of scope here, flagged for §7 if it
recurs as a real operational need.

A trigger (`AFTER INSERT`) recomputes on the parent row:

```sql
kg_recebido       := (SELECT COALESCE(SUM(kg_recebido), 0)
                      FROM ordem_compra_fio_lancamentos
                      WHERE ordem_compra_fio_id = NEW.ordem_compra_fio_id);
status_recebimento := CASE
  WHEN kg_recebido <= 0            THEN 'nao_recebido'
  WHEN kg_recebido <  kg_pedido    THEN 'parcial'
  ELSE                                  'recebido'
END;
```

### 3.3 `legado_recebimento_automatico` interaction with the ledger

Rows flagged `legado_recebimento_automatico = TRUE` (§3.6) keep their
pre-existing `kg_recebido`/`status_recebimento` values **as a frozen
snapshot** — no retroactive `ordem_compra_fio_lancamentos` rows are
fabricated for them (no invented ledger entries, no rewritten history).
If a legacy order later receives a *new* physical entry (e.g. a
previously-partial legacy order gets a further delivery), that new entry
goes through the same trigger as any other row and the aggregate becomes
ledger-derived **from that point forward**, additively on top of the
frozen legacy baseline (the trigger's `SUM` naturally includes both the
legacy baseline — carried as an implicit opening balance, not a fabricated
row — and any new entries; the exact backfill mechanics are a Phase A
migration-authoring detail, not a semantic change).

### 3.4 `public.ordem_compra_eventos` (new — transition audit, `op_eventos`/`usuarios_eventos` pattern)

```sql
CREATE TABLE public.ordem_compra_eventos (
  id                   BIGSERIAL PRIMARY KEY,
  ordem_compra_fio_id  BIGINT NOT NULL REFERENCES public.ordens_compra_fio(id) ON DELETE CASCADE,
  dimensao             TEXT NOT NULL CHECK (dimensao IN ('administrativo', 'aceite', 'recebimento')),
  tipo_evento          TEXT NOT NULL,   -- e.g. 'emitida', 'cancelada', 'aceite_solicitado',
                                         -- 'aceite_aceito', 'aceite_rejeitado',
                                         -- 'aceite_override_admin', 'recebimento_registrado'
  valor_anterior       TEXT,
  valor_novo           TEXT,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,  -- incl. policy-in-force snapshot at emission
  criado_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ordem_compra_eventos_ordem_idx
  ON public.ordem_compra_eventos(ordem_compra_fio_id);
```

Every write path in §4 inserts exactly one row here (or one per
`ordem_compra_fio_lancamentos` insert, for the `recebimento` dimension).
Implementation is **specific to purchase orders** — no shared/generic
gate or event engine is introduced (Rule 7); the shape is copied, not
abstracted into a reusable module, so it does not block or complicate
future reuse for an unrelated domain.

### 3.5 `public.ordem_compra_config` (new — singleton config)

```sql
CREATE TABLE public.ordem_compra_config (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  exige_aceite   BOOLEAN NOT NULL DEFAULT FALSE,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.ordem_compra_config (id, exige_aceite) VALUES (1, FALSE);
```

Deliberately a dedicated one-row table, not a generic key-value
config/feature-flag store — consistent with Rule 7 ("build no generic
gate engine") and with this project's existing preference for typed,
purpose-built tables over generic engines (`parametros_largura` is the
nearest precedent, itself not generic).

### 3.6 Legacy marking (backfill, Phase A, one-time)

```sql
UPDATE public.ordens_compra_fio
SET status_administrativo         = 'emitida',
    status_aceite                 = 'nao_aplicavel',
    status_recebimento            = CASE status
                                       WHEN 'pendente'         THEN 'nao_recebido'
                                       WHEN 'recebido_parcial' THEN 'parcial'
                                       WHEN 'recebido_total'   THEN 'recebido'
                                     END,
    legado_recebimento_automatico  = TRUE
WHERE status_administrativo = 'rascunho';  -- i.e. every pre-existing row, run once
```

Every row that existed before this migration is recognized as already
`emitida`/`nao_aplicavel` (the historical flow had no draft/acceptance
concept — every row was born immediately actionable, which is the closest
honest equivalent of "already emitted"). **No row's `kg_recebido` value is
rewritten** — only the new `status_recebimento` vocabulary is derived
from the old `status` value, once, and the legacy flag is set. No
retroactive rewriting of history beyond this one vocabulary mapping.

---

## 4. Write paths (specified; Phase B/C implement)

| Action | Dimension | Precondition | Effect |
|---|---|---|---|
| `emitir_ordem_compra_fio(id)` | administrativo | `status_administrativo = 'rascunho'` | reads `ordem_compra_config.exige_aceite`, snapshots it into `aceite_exigido_na_emissao`, sets `status_administrativo = 'emitida'`, `status_aceite` per §2.3, `emitida_em`/`emitida_por`; inserts `ordem_compra_eventos` |
| `cancelar_ordem_compra_fio(id)` | administrativo | `status_administrativo IN ('rascunho','emitida')` | sets `status_administrativo = 'cancelada'`, `cancelada_em`/`cancelada_por`; inserts `ordem_compra_eventos`; §7g governs partial-receipt interaction |
| `decidir_aceite_ordem_compra_fio(id, decisao, motivo?)` | aceite | `status_aceite = 'pendente'` | sets `aceita`/`rejeitada`, `aceite_decidida_em`/`_por`, `aceite_motivo`; inserts `ordem_compra_eventos` |
| `registrar_recebimento_ordem_compra_fio(id, kg, data, obs?)` | recebimento | `status_administrativo = 'emitida'` **and** `status_aceite IN ('nao_aplicavel', 'aceita')` | inserts `ordem_compra_fio_lancamentos` row (trigger derives §2.4); inserts `ordem_compra_eventos` |

**Corrected 2026-07-18 (Finding 1, `ORDEM-COMPRA-LIFECYCLE-SPEC-
RATIFICATION-R1`):** the receipt precondition originally read
`status_aceite != 'pendente'`, which is also true for `rejeitada` —
a rejected order would have passed the precondition and been able to
receive yarn, directly contradicting ratified point 3 ("receipt blocked
until `aceita`"). Corrected to the explicit allow-list
`status_aceite IN ('nao_aplicavel', 'aceita')` above. The identical wording
in §6's UI-disablement rule is corrected to match (see §6).

All four are the **specific, non-generic** writers this track builds.
`registrar_recebimento_ordem_compra_fio` is the single shared writer
referenced throughout this spec — Phase B introduces it with the
precondition check (still writing the old aggregate columns directly
internally); Phase C swaps its internal implementation to the ledger +
trigger of §3.2/§3.3 without changing its external signature, so nothing
that calls it needs to change between B and C.

---

## 5. Gate query definition (Phase D specifies; does not activate)

"Iniciar produção" (`iniciarProducaoOP`/`snapshotSaldoEIniciarProducao`,
`js/screens/op-recalculo.js:108-163`) is the single attach point. Two
independent sub-gates, both must pass:

### 5.1 Cotton — per-OP

For the OP attempting the transition, for every `cor_id` required by its
saved item distribution:

```sql
SELECT cor_id, SUM(kg_recebido) AS recebido_kg
FROM public.ordens_compra_fio
WHERE op_id = :op_id
  AND tipo = 'algodao'
  AND status_administrativo != 'cancelada'
GROUP BY cor_id;
-- gate passes for a color when recebido_kg >= required_kg_for_that_color
```

`required_kg_for_that_color` is the OP's own saved distribution
requirement (the same figure `calcularFiosOP`/the recalculo snapshot
already compute today) — this spec does not change that calculation, only
gates on its comparison against the derived receipt aggregate above.

### 5.2 Polyester — per-Pedido (shared PRETO/BRANCO orders gate all the pedido's OPs together)

```sql
SELECT ocf.cor_poliester, SUM(ocf.kg_recebido) AS recebido_kg
FROM public.ordens_compra_fio ocf
JOIN public.ops   ON ops.id = ocf.op_id
JOIN public.lotes ON lotes.id = ops.lote_id
WHERE lotes.pedido_id = :pedido_id
  AND ocf.tipo = 'poliester'
  AND ocf.status_administrativo != 'cancelada'
GROUP BY ocf.cor_poliester;
-- gate passes for a color when recebido_kg >= SUM of required_kg for that
-- color across every tecelagem OP under this pedido (architect decision:
-- option (a) — shared PRETO/BRANCO orders gate all the pedido's OPs together)
```

Because this is a shared, pedido-wide pool, a single OP's "Iniciar
produção" for polyester can be blocked by another OP under the same
pedido still awaiting its share of a shared PRETO/BRANCO order — this is
the ratified behavior (option (a)), not a bug to fix later.

**Enforcement note (flagged, not resolved by this spec):** the current
`iniciarProducaoOP` call site is a direct client-side
`supa.from('ops').update(...)` with no RPC in front of it. Wiring the gate
only in the UI (disabling the button) would repeat the shape of the
already-registered `A2-SERVER-SIDE-ENFORCEMENT` debt (client-side-only
enforcement, bypassable from a direct API call). Phase D should wire the
gate behind a `SECURITY DEFINER` RPC (or extend `alterar_status_op`'s
existing transition-validation path) rather than only disabling the
button — this is a Phase D implementation decision, recorded here so it
is not silently dropped when D is authorized.

---

## 6. UI surface (conceptual — mockup gate is the architect's reviewer, after ratification)

> **AMENDED 2026-07-18 (`ORDEM-COMPRA SPEC AMENDMENT`, architect decision).**
> The single-section UI-surface description below is **superseded** on the
> question of *where receipt registration lives and what the OP screen shows*.
> The ratified three-dimension model (§1), the write-path contracts (§4), the
> gate definition (§5), and the freeze rule (§2.3) are **unchanged**. The
> original bullets are retained below for provenance; where they conflict with
> this block, **this block governs**.
>
> **Separation of responsibilities (the ruling).**
> - **Receipt registration (`lançamentos`: quantity, date, partial deliveries)
>   lives on the purchase order's own detail screen** — receipt is a fact about
>   the *purchase*, not the production. This also future-proofs supplier
>   acceptance (their own surface) and multi-OP / `saldo` sharing (received
>   quantity on a shared PRETO/BRANCO order is not owned by any single OP).
> - **The OP screen's section becomes a reader.** It shows the linked orders
>   with their administrative/dimension badges and the available yarn per color
>   (sum of received across the linked orders + `saldo`). **It registers
>   nothing.**
> - **Distribution sliders, `Salvar distribuição`, and `Iniciar produção` stay
>   on the OP screen** (production decisions). The production gate (Phase D)
>   reads availability from the orders' received totals (§5), not from any input
>   on the OP screen.
>
> **Three surfaces (replacing the single-section description below).**
> - **(a) OP detail screen section (reader + admin-cycle actions)** — Phase
>   **B1**. One row per linked order: material—cor, fornecedor (`— não
>   atribuído` when unset), quantity (received/ordered when partial), the three
>   dimension badges, and the administrative actions (Emitir on `rascunho`,
>   Cancelar on `rascunho`/`emitida`; `cancelada`/legacy rows carry no action).
>   **No receipt registration in this section.** Materials are cotton and
>   polyester only.
> - **(b) Purchase order detail screen** (route `#/ordens-compra/:id`) — the
>   entity's home: full dimensions, emitir/cancelar, receipt registration +
>   `lançamento` history, event history; future home of supplier acceptance.
>   Phase **B2** builds the screen (emitir/cancelar actions live there too; the
>   receipt-registration UI is present but wired in Phase C).
> - **(c) Purchase orders list screen** (sidebar menu, all orders, filterable)
>   — Phase **B3**, later.
>
> **The single shared writer is unchanged in kind** — receipt registration is
> still one writer (§4's `registrar_recebimento_ordem_compra_fio`); the
> amendment only moves its *entry point* from the `insumos` sub-panel to the
> purchase order detail screen (Phase C). Until Phase C swaps it, the existing
> `insumos` receipt inputs (`buildOrdemPendenteRow` / `buildInsumosTransferForm`)
> remain as-is.

No mockup is produced here (Supervision Protocol gate: approved mockup
precedes new visual elements). This section states *where* and *what*,
not final visuals.

- **Host:** the existing `insumos` transition-modal sub-panel
  (`buildInsumosTransferForm`, `pedido-detail-events.js:1587-1676`) and
  the OP-screen twin (`buildBlocoFios`, `op-nova.js:975-...`,
  `buildOrdemPendenteRow`, `op-nova.js:937-960`). **Not** a new pedido
  stage — the `insumos` stepper stage (`pedido-chain-state.js:14,25`)
  is unchanged; **not** a detached CRUD screen.
- **New affordances, control-panel language** (reusing the existing pill/
  badge tokens already in use elsewhere — `PILL_BASE`,
  `--rv-status-*`/`--rv-stage-*` tokens seen in
  `op-tecelagem-producao-admin.js` — rather than inventing new visual
  language, per the Future Requirements section's standing instruction):
  - an administrative-cycle badge (`Rascunho`/`Emitida`/`Cancelada`) per
    order row;
  - an "Emitir" action on `rascunho` rows, a "Cancelar" action on
    `rascunho`/`emitida` rows;
  - when `aceite_exigido_na_emissao = true`, an acceptance badge
    (`Aguardando aceite`/`Aceita`/`Rejeitada`) and the accept/reject
    affordance (admin-on-behalf per open decision (b), §7);
  - the existing receipt-registration inputs
    (`buildOrdemPendenteRow`/`buildInsumosTransferForm`'s per-row kg
    input) become disabled with an explanatory label whenever
    `status_administrativo != 'emitida'` or
    `status_aceite NOT IN ('nao_aplicavel', 'aceita')` (corrected 2026-07-18,
    Finding 1 — the original `status_aceite = 'pendente'` wording left a
    `rejeitada` order's input enabled), instead of silently accepting the
    write as today.
- **Client Portal (`cliente_pedido_summary`) unaffected** — purchase-order
  detail is an internal/admin concern; the ratified model does not add
  any new field to the client-facing DTO. Stage list the client sees is
  unchanged.

---

## 7. Open architect decisions (for ratification — each with a recommendation)

**(a) Fornecedor accepts own order (future) — precedence rules.**
Recommendation: out of scope for this track (Rule 10 — no supplier write
access here). When authorized, precedence should be "supplier decision is
authoritative unless overridden by admin" (mirrors (b)/(c) below), decided
in its own future track once `meu_fornecedor_id()`-gated RLS is designed
for `ordens_compra_fio`.
**Ratified 2026-07-18 — deferral confirmed;** the future precedent as
specced (supplier authoritative unless admin overrides) is recorded as
guidance for that future track, not a binding rule of this one.

**(b) Admin accepts on supplier's behalf — always allowed?**
Recommendation: yes, always allowed in this track, since no supplier
self-service path exists yet — admin-on-behalf is the *only* acceptance
path until (a) is built. This is not really open under current scope; it
becomes a real question only once (a) exists.
**Ratified YES, 2026-07-18 — unconditionally.** Hard dependency
acknowledged: until (a) ships, 100% of acceptance events are
admin-authored, and the audit trail showing that is **correct, not a
smell.**

**(c) Admin overriding a rejection — allowed? audited how?**
Recommendation: allow via a distinct `aceite_override_admin` event type
(already in §3.4's vocabulary) rather than silently re-running
`decidir_aceite_ordem_compra_fio` — the override must record
`aceite_motivo` as mandatory (not optional) when overriding a prior
`rejeitada`, so the audit trail distinguishes "first decision" from
"admin overrode a rejection."
**Ratified as recommended, 2026-07-18.** A wrongly-rejected order needs a
recovery path; the distinct event keeps first-decision and override
distinguishable forever.

**(d) Who can undo an acceptance, and until when.**
Recommendation: no undo path in this track. An accepted order that turns
out wrong should be handled via cancellation (§2.1) plus a new
replacement order, not a reversible acceptance — mirrors this project's
existing preference for append-only correction over in-place rewrite
(`document_link_revisions`, `ordem_compra_fio_lancamentos` itself).
**Ratified as recommended, 2026-07-18** — no undo path; cancel + new
draft.

**(e) Acceptance after partial receipt — permitted?**
Recommendation: cannot arise under this spec's own gate
(`registrar_recebimento_ordem_compra_fio` requires
`status_aceite IN ('nao_aplicavel', 'aceita')` before any receipt
registration, §4 — corrected 2026-07-18, Finding 1), so a partial receipt
implies acceptance already happened (or was never required). No separate
rule needed unless a future track changes the precondition ordering.
**Ratified as recommended, 2026-07-18, contingent on Finding 1's
correction being applied** (it is, as of this ratification).

**(f) Order modification after emission — invalidates acceptance?
invalidates receipts? or emission locks quantities?**
Recommendation: **emission locks quantities** (`kg_pedido` becomes
immutable once `status_administrativo != 'rascunho'`) — no in-place
modification of an emitted order. A quantity change after emission is a
cancellation + new draft, not an edit. This keeps the freeze rule (§2.3)
and the receipt gate (§5) simple: an emitted order's `kg_pedido` is a
fixed target for the remainder of its life.
**Ratified as recommended, 2026-07-18 — ruled now, not deferred:**
changing this after Phase B ships would break the `emitir` RPC's contract,
so it is decided as part of this ratification rather than left open.

**(g) Cancellation with partial receipts — what happens to the received
quantity in `saldo_fios`?**
Recommendation: cancellation does not reverse or delete already-recorded
`ordem_compra_fio_lancamentos` rows (append-only, §3.2) — physically
received yarn already exists in the warehouse regardless of the
paperwork's administrative state. `saldo_fios`/`saldo_fios_op` (existing
tables, out of this schema's direct scope) should continue to reflect the
received kg as-is; cancellation only stops *further* registration
(`registrar_recebimento_ordem_compra_fio`'s precondition already blocks
`cancelada` rows via `status_administrativo = 'emitida'` in §4). This
needs explicit confirmation from whoever owns the `saldo_fios` write path
before Phase C ships, since this spec does not audit that table's own
triggers.
**Ratified as recommended, 2026-07-18** — ledger entries never reverse;
`saldo_fios` reflects physically received kg regardless of administrative
state (the physical world does not un-happen because paperwork changed).
The still-open `saldo_fios` write-path confirmation is folded into the
Phase C order as an explicit verification step; the architect pre-confirms
the principle here and retains the ruling on that confirmation's outcome.

---

## 8. Phasing — each phase shippable to production alone

| Phase | Content | Blast radius |
|---|---|---|
| **A — Schema + config** | §3.1-§3.6: additive columns (all defaulted/nullable), two new tables (`ordem_compra_fio_lancamentos`, `ordem_compra_eventos`), one new singleton (`ordem_compra_config`, seeded `exige_aceite=false`), one-time legacy-marking backfill (§3.6). No trigger wired yet (§3.2's trigger ships in Phase C, not A — see below), no RPC, no UI, no JS change. **Binding requirement (ratified 2026-07-18, gap 1):** the `ALTER TABLE` and the §3.6 legacy backfill `UPDATE` MUST execute in one migration file, one transaction — no window may exist for a live draft row (created between the two statements) to be mislabeled `emitida`/legacy by the backfill's `WHERE status_administrativo = 'rascunho'` clause. | Schema-only. Zero behavior change: `registrarRecebimentoOrdemFio` keeps writing the old `status`/`kg_recebido` columns exactly as today; every existing reader is unaffected. Safe to ship and sit unused. |
| **B — Panel visibility + administrative writes** | `emitir_ordem_compra_fio`/`cancelar_ordem_compra_fio` RPCs (§4); `op-persistir.js` continues generating rows unchanged (they land `rascunho` by Phase A's column default — no code change needed there); a minimal precondition guard added to `registrar_recebimento_ordem_compra_fio` (new RPC, still writing the old aggregate columns internally, not yet ledger-based) so an unemitted order cannot receive; UI badges + Emitir/Cancelar actions in the `insumos` sub-panel (§6). **Binding requirement (ratified 2026-07-18, gap 2):** this order MUST also revoke direct `UPDATE` on `kg_recebido`/`status_recebimento`/`status_administrativo`/`status_aceite` from `authenticated` — the four RPCs in §4 (`SECURITY DEFINER`) become the only writers of these columns. "Single shared writer" must be an **enforced invariant**, not a convention, per the `ANON-GRANT-DEFENSE-IN-DEPTH` lesson. | **Behavior change, contained:** newly opened OPs' yarn orders now require an explicit "Emitir" before they are receivable — this is the ratified behavior (Rule 5), but it is a real workflow change for whoever registers receipts today, and must be called out to the architect/operations before shipping, not just to code review. No change to already-emitted legacy rows (§3.6 marks them `emitida` already). |
| **C — Receipt rework via the single shared writer** | `ordem_compra_fio_lancamentos` trigger (§3.2) goes live; `registrar_recebimento_ordem_compra_fio`'s internal implementation swaps from direct aggregate-column writes to ledger inserts (external signature unchanged from Phase B — callers do not change); `js/screens/op-writes.js`'s `registrarRecebimentoOrdemFio` becomes a thin client-side wrapper calling the RPC instead of `.update()` directly. Carries forward Phase B's gap-2 RLS-revoke requirement if not already applied. **Includes, per decision (g)'s ratification:** an explicit verification step confirming the `saldo_fios`/`saldo_fios_op` write path's behavior on cancellation-with-partial-receipts matches the ratified principle (ledger entries never reverse). | Additive schema (new table + trigger) + one internal JS rewrite behind an unchanged call signature. No caller (`op-nova.js`, `pedido-detail-events.js`) needs to change. Legacy rows (§3.3) are unaffected until/unless a new entry is registered against one. |
| **D — Gate activation** | Wires §5's two gate queries into the "Iniciar produção" path (`op-recalculo.js:108-163`), per the server-side-enforcement note in §5. | **Behavior change:** OPs/pedidos with insufficient received yarn can no longer start production, where today the client-side flow does not check this at all. Requires explicit before/after operational confirmation (production-flow-affecting) — recommended as its own authorization, not bundled with C. |
| **E — Dormant acceptance structure** | No new code shipped. This phase is a checkpoint: confirms `status_aceite`/`aceite_exigido_na_emissao`/`ordem_compra_eventos` are exercised end-to-end with `exige_aceite=false` (the default), so the acceptance dimension is proven dormant-but-correct before any future track turns the config on or builds supplier-side acceptance (open decision (a)). | None — verification-only, read-only against Phases A-D's already-shipped state. |

Each phase is independently authorizable, per this project's standing rule
that phases do not chain automatically
(`docs/governance/SUPERVISION_PROTOCOL.md` §3). Ratification of this
document authorizes none of them by itself.

### Amendment 2026-07-18 (`ORDEM-COMPRA SPEC AMENDMENT`) — Phase B split into B1/B2/B3; receipt entry point relocated

Per the §6 ruling above, the single **Phase B** row of the table is
**superseded** by the following breakdown. The ratified per-phase blast-radius
reasoning is unchanged; only the surface allocation and the receipt entry point
move. Phases **D** and **E** are **unchanged** from the table above.

| Phase | Content | Notes |
|---|---|---|
| **B1 — OP section (reader) + administrative RPCs + RLS revoke** | `emitir_ordem_compra_fio` / `cancelar_ordem_compra_fio` RPCs (§4): `emitir` snapshots `ordem_compra_config.exige_aceite` into `aceite_exigido_na_emissao`, sets `emitida`, writes an `ordem_compra_eventos` row, and carries a **fornecedor-assigned precondition** (an order with no supplier assigned cannot be emitted — additive to §4's `status_administrativo = 'rascunho'` precondition, not a change to it); `cancelar` writes an event row. The OP detail screen section becomes the **reader** described in §6 (badges + Emitir/Cancelar admin actions, no receipt registration). The gap-2 RLS **REVOKE** of direct `UPDATE` on `kg_recebido` / `status_recebimento` / `status_administrativo` / `status_aceite` from `authenticated` (migration `db/66`). The existing `insumos` receipt inputs remain untouched (removed in Phase C). | Carries §8's gap-2 binding requirement (RLS revoke). The receipt precondition guard formerly bundled into "Phase B" moves to the receipt RPC in Phase C. Receipt wording anywhere is `status_aceite IN ('nao_aplicavel','aceita')` (Finding 1). |
| **B2 — Purchase order detail screen** (route `#/ordens-compra/:id`) | Builds the entity's home screen: full dimensions, emitir/cancelar actions (also available here), the receipt-registration UI **present but wired in Phase C**, and event history; future home of supplier acceptance. | The OP section's "ver ordem" affordance (B1) may navigate here; until B2 the route may 404-stub or be omitted. |
| **B3 — Purchase orders list screen** | Sidebar-menu screen listing all orders, filterable. | Later; no receipt logic. |
| **C — Receipt `lançamentos` via the single shared writer** | Unchanged from the table's Phase C, with one clarification: the **entry point** for `registrar_recebimento_ordem_compra_fio` is the **purchase order detail screen** (B2's receipt UI), and the OP section (B1) reflects received totals automatically. The receipt precondition guard (`status_administrativo = 'emitida'` **and** `status_aceite IN ('nao_aplicavel','aceita')`) lives on this RPC. | Also swaps `registrarRecebimentoOrdemFio` to call the RPC and lands the §3.2 trigger, per the table above. |

Phases **D** (gate activation) and **E** (dormant acceptance checkpoint)
remain exactly as in the table above.

---

## 9. Future-requirements alignment (design-shaping constraints honored)

- **Supplier acceptance across OP transitions (tecelagem/acabamento) with
  admin override:** nothing in §3/§4 assumes a single acceptance actor —
  `criado_por`/`aceite_decidida_por` on every event row already
  distinguishes admin-on-behalf from a future supplier-originated
  decision without a schema change; only RLS/UI need to grow later.
- **Identification labels at tecelagem/acabamento exits (future
  transition points):** this track does not touch the stepper
  (`pedido-chain-state.js`) or add a new stage — the `insumos` stage stays
  the sub-panel host, so a future exit-labeling feature is unaffected by
  this spec's schema or UI choices.
- **Control-panel language:** §6 explicitly reuses existing visual tokens
  rather than introducing a new component language.

---

## 10. What this document does not do

- Does not create any table, column, RPC, trigger, or RLS policy.
- Does not touch staging or production Supabase.
- Does not modify any `.js` file.
- Does not authorize Phase A (or any phase). Ratification of the model
  (§11) is a separate act from authorizing implementation — **Phase A
  remains `NOT AUTHORIZED`, pending its own order.**

---

## 11. Ratification record

**`ORDEM-COMPRA-LIFECYCLE-SPEC-RATIFICATION-R1` — 2026-07-18.** The
architect ratified this spec following an independent read-only
architecture review (same date) that validated it against the ratified
model and flagged one confirmed defect and two implementation gaps.

- **Finding 1 (confirmed defect) — corrected.** The receipt precondition
  in §4 and §6 read `status_aceite != 'pendente'`, which also admits
  `rejeitada` — a rejected order could have registered a receipt,
  contradicting the ratified rule that receipt is blocked until `aceita`.
  Corrected in both places to `status_aceite IN ('nao_aplicavel',
  'aceita')`; §7(e)'s citation corrected to match.
- **Decisions (a)-(g) — all ratified**, per the annotations inline in §7:
  (a) deferral confirmed; (b) ratified YES, unconditionally (acknowledged
  hard dependency: 100% admin-authored acceptance until (a) ships is
  correct, not a smell); (c) ratified as recommended (`aceite_override_admin`
  event, mandatory `aceite_motivo`); (d) ratified as recommended (no undo
  path); (e) ratified as recommended, contingent on Finding 1 (satisfied);
  (f) ratified as recommended, **ruled now rather than deferred** — emission
  locking quantities cannot change after Phase B ships without breaking the
  `emitir` RPC contract; (g) ratified as recommended — ledger entries never
  reverse, with the `saldo_fios` write-path confirmation folded into the
  Phase C order as an explicit verification step.
- **Two new gaps, both accepted and folded forward as binding requirements**
  (§8's Phase A and Phase B rows amended accordingly):
  1. Phase A's migration must apply the `ALTER TABLE` and the legacy
     backfill in one transaction, closing the window for a live draft to
     be mislabeled.
  2. Phase B/C's migration must revoke direct `UPDATE` on the four
     dimension-bearing columns from `authenticated`, making the
     `SECURITY DEFINER` RPCs the sole writers — "single shared writer" as
     an enforced invariant, not a convention.
- **Phantom-audit governance item — not resolved by this ratification.**
  The architect's hard stop on reconstructing `PURCHASE-ORDER-FOUNDATION-
  AUDIT` without source was confirmed correct. The architect is retrieving
  the original source for verbatim persistence as
  `docs/reports/PURCHASE_ORDER_FOUNDATION_AUDIT_R1_2026-07-18.md`; if
  reported unrecoverable, the fallback is an honest citation correction
  (spec banner + `PROJECT_STATE.md` cite the architect's in-chat
  authorization directly, no separate artifact claimed). **Neither branch
  has executed yet — this remains open,** tracked in `PROJECT_STATE.md`
  and the ledger, separate from the decisions ratified above.
- **What ratification does and does not authorize:** the model, Finding 1's
  correction, and decisions (a)-(g) are now `RATIFIED` — this is the
  authoritative reference for any future phase order. It does **not**
  authorize Phase A or any other phase; each remains `NOT AUTHORIZED`
  pending its own order, per this project's standing rule that phases do
  not chain automatically.

## §R.26 PHASE-C3A — Legacy opening-balance and inactive cutover foundation

`PHASE-C3A` separates receipt-state reconstruction from physical inventory. At the
future cutover transaction, observed `saldo_fios` per material/color is the
authoritative opening inventory baseline. `import_saldo_inicial` is immutable
historical reconstruction, not a physical receipt: it creates no
`ordem_compra_fio_movimentos_estoque` row and does not alter `saldo_fios` or
`saldo_fios_op`. The 405.980 kg historical excess is neither credited nor debited.

The future identity is `cutover_id + flat_row_id + mapping_id + item_id` in namespace
`legacy_initial_balance_v1`. Exact replay returns its immutable result; mismatch
rejects. It is system-owned (`ator_tipo='sistema'`, NULL actor id), preserves Class-D
`recebido_sem_emissao`, and fabricates no emission, acceptance, document, or actor.
There will be 39 headers and 44 ledger rows: 39 allocation-attributed entries plus
five item-level excess entries, 20,221.280 kg reconstructed and 405.980 kg excess.
It is non-reversible. One source-linked inventory movement exists only for productive
receipt/reversal ledger entries.

`HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` is nonblocking historical debt and
cannot justify stock mutation without a separate physical inventory reconciliation.
C3A may create inactive `legacy-active` cutover/snapshot/baseline-hash metadata and an
owner-only read-only preview. It does not authorize real seed, final snapshot, fence,
reader/writer switch, flat ACL change, native emission, or C3B/C3C/C3D execution.

### §R.26.1 C3A implementation checkpoint (awaiting architect acceptance)

Staging migrations `20260719172749 / 71`, `20260719174006 / 72`, and
`20260719175732 / 73` implement the inactive foundation, protected singleton, and
owner-only maintenance command. The command uses the complete documented identity,
canonical three-decimal quantities, immutable semantic fingerprints, source plus
full-identity transaction advisory locks, exact immutable replay, and
`idempotencia_conflitante` for payload reuse. It accepts only frozen Class A/D source
shape while `maintenance_fenced/previewed`, records Class-D
`recebido_sem_emissao`, uses no physical receipt date/document/human actor, creates
allocation plus optional item-level excess entries, and never posts inventory or
permits reversal.

Rollback-controlled staging behavior, four distinct-backend scenarios, db/73-only
and full db/71-db/73 no-CASCADE rollback rehearsals, 56 focused tests, and stable
detached full-suite identity comparison passed. Final staging remains the inactive
`legacy_active/not_started` singleton with zero imported data and the unchanged
39/44 preview and inventory hash. This checkpoint is not architect acceptance and
does not authorize real import, fence activation, reader/writer or ACL switch,
emission, C3B/C3C/C3D, production, `main`, or push.

## §R.27 Purchase-order hybrid-origin addendum — CLOSED / ACCEPTED

> **Decision date:** 2026-07-19. The architect accepted the purchase-order impact
> audit and this addendum. This section governs every earlier order-first,
> item-first, allocation, receipt, and UI-ownership statement that conflicts with
> it. The audit found localized forward-correction work; every phase redo verdict
> remains **NO**. No implementation, migration, grant, environment write, or C3A
> acceptance is authorized by this documentation correction. Documentation
> Correction R2 was accepted at commit
> `840dcb19b6bc6ffd8543a3f79bcae07516738bf6`; the separately authorized next
> technical phase is `PURCHASE-ORDER HYBRID ORIGIN — FORWARD CORRECTION F1`, scoped
> to database authority and compatibility only. UI correction remains outside F1.

### §R.27.1 Binding hybrid origin and ownership

- Production-specific native needs originate from the real OP that calculated
  consumption. For native cotton, `origem_tipo='op'`, the need's `op_id` is that
  real OP, and the OP belongs to the same Pedido.
- Genuinely shared native needs originate from the Pedido. For shared polyester,
  `origem_tipo='pedido'` and `necessidade.op_id IS NULL`; no representative,
  synthetic, convenience, first, or arbitrary OP exists.
- Purchasing distribution belongs to **Pedido → Insumos / `aguardando_fios`**.
  A dedicated screen or route is allowed as a focused surface, but does not create
  a new stepper stage or transfer ownership to the purchase-order detail or OP.
- A native purchase order belongs to **Pedido + supplier**, never exclusively to
  one OP. OP traceability lives in the need/allocation layers; one item may
  consolidate allocations from multiple OP-specific needs plus shared Pedido needs.

### §R.27.2 Allocation provenance, identity, and quantity authority

- For `origem_tipo='op'`, the future writer locks the need and derives
  `allocation.op_id = necessidade.op_id`. The UI/caller cannot choose, replace, or
  override it.
- For `origem_tipo='pedido'`, both `necessidade.op_id` and `allocation.op_id` are
  NULL. The system must not select or infer an OP.
- Shared allocation identity is NULL-safe. The current plain uniqueness semantics
  must be corrected forward so NULL cannot permit duplicate logical allocations.
- `ordem_compra_item.kg_pedido = SUM(ordem_compra_item_alocacao.kg_alocado)` is
  the sole authoritative item quantity. Manual absolute item quantity is not an
  independent authority.

### §R.27.3 Phase C compatibility qualification

Phase C is reusable and is **not** restarted. Localized receipt/ledger assumptions
that require non-NULL OP provenance must be corrected and focusedly revalidated. A
line associated with a shared Pedido allocation may preserve purchase order, item,
need, Pedido, supplier, material, color, quantity, receipt identity, and inventory
identity while `allocation.op_id IS NULL`. No receipt, ledger, movement, projection,
or validation rule may fabricate an OP to satisfy shape. Valid excess remains governed
by `saldo_fios`; it has no allocation and acquires no artificial OP.

### §R.27.4 Superseded operational paths and forward sequence

The following installed or described paths are not canonical origination authorities
and require a separately authorized forward implementation to supersede or restrict
them: independent **Nova ordem**; `definir_item_ordem_compra` as an origination
writer; item-first `alocar_necessidade_compra_fio`; caller-controlled `p_op_id`;
manual authoritative item quantity; allocation writes owned by purchase-order detail;
supplier assignment owned by the OP surface; and any receipt/ledger rule that requires
an artificial OP for shared Pedido allocation.

The selected strategy is: canonical documentation correction → localized forward
corrective implementation → focused staging validation → PRE-PROD revalidation →
Phase C shared-allocation revalidation → later architect disposition of unaccepted
C3A → only then C3B and subsequent phases. No step chains automatically.

## §R.28 F1 executable contract closure R1 — CLOSED / ACCEPTED

This section closes the executable database contract that §R.27 intentionally left
at the invariant level. It supersedes the future-operation portions of §R.4,
§R.22.3-§R.22.4, and §R.23.5-§R.23.6 where they retain order-first, item-first,
caller-selected-OP, manual-quantity, or manual-cleanup authority. It authorizes no
SQL, migration, grant, application change, test change, environment write, or F1
implementation by itself. The architect accepted this contract at commit
`00897f09267fc8304b329ce46ba985d03a57faff` and separately authorized
`PURCHASE-ORDER HYBRID ORIGIN — F1 FORWARD CORRECTION IMPLEMENTATION R1`.

### §R.28.1 Canonical need-first command

The one canonical native purchasing-distribution mutation command is:

```sql
public.definir_alocacao_necessidade_compra_fio(
  p_necessidade_id  BIGINT,
  p_fornecedor_id   BIGINT,
  p_kg_alocado      NUMERIC,
  p_idempotency_key TEXT
) RETURNS JSONB
```

It is `SECURITY DEFINER`, uses `SET search_path = ''`, requires `auth.uid()` and
`public.is_admin()`, and is executable only by `authenticated`. `PUBLIC`, `anon`, and
`service_role` have no `EXECUTE`. The caller supplies only the need, supplier,
absolute target allocation quantity, and command key. The caller cannot supply
Pedido, material, color, order, item, allocation, or OP identity.

| Parameter | PostgreSQL type | Exact contract |
|---|---|---|
| `p_necessidade_id` | `BIGINT` | Existing native need. The writer locks this row and derives every purchasing identity from it. |
| `p_fornecedor_id` | `BIGINT` | Existing yarn supplier. Cotton requires `fornecedores.tipo='fio_algodao'`; polyester requires `fio_poliester`. The current schema has no supplier-active column, so F1 invents no activity state. |
| `p_kg_alocado` | `NUMERIC` | Absolute target for this supplier/item/need identity, from `0.000` through the need's available cap, with at most three decimal places. Zero is the removal command. |
| `p_idempotency_key` | `TEXT` | Trimmed caller command key, length 1-200, scoped to the authenticated administrator and namespace `native_distribution_v1`. |

Validation order is fixed: authenticate and authorize; validate scalar key and
three-decimal non-negative quantity; serialize/check the command identity; lock and
validate the native need; validate origin and real-OP/Pedido ownership; lock and
validate the supplier and material compatibility; serialize and lock/create the
active native `(pedido_id, fornecedor_id)` draft; lock/create the derived
material/color item; lock the logical allocation; enforce the absolute need cap;
apply the mutation; recompute the need cache and item quantity; execute cleanup;
persist the immutable successful-command record; return the result. A zero target
for an absent allocation does not create a draft or item.

Successful results have this exact JSONB field contract:

| Field | Type | Meaning |
|---|---|---|
| `ok`, `codigo` | boolean, text | Always `true`, `ok` for an accepted command. |
| `idempotency_key` | text | Trimmed accepted key. |
| `discriminador` | text | Exactly `created`, `increased`, `reduced`, `removed`, or `unchanged`. |
| `necessidade_id`, `pedido_id`, `fornecedor_id` | bigint, uuid, bigint | Locked need and derived commercial ownership. |
| `origem_tipo`, `op_id` | text, bigint or null | Locked need origin and server-derived real OP or shared NULL. |
| `material`, `cor_id`, `cor_poliester` | text, bigint or null, text or null | Identity derived from the need. |
| `ordem_compra_id`, `ordem_compra_item_id`, `alocacao_id` | bigint or null | Created/reused or removed identities. Removed identities remain in the immutable result; an absent zero-target no-op returns NULL identities. |
| `kg_anterior`, `kg_final` | numeric(12,3) | Logical allocation before and after. |
| `item_kg_pedido` | numeric(12,3) or null | Post-command allocation sum; NULL when the item was removed or never existed. |
| `necessidade_kg_necessario`, `necessidade_kg_alocado`, `necessidade_kg_restante` | numeric(12,3) | Post-command need totals. |
| `item_removido`, `ordem_removida` | boolean | Exact cleanup outcome. |

Failures return `{ok:false,codigo:<stable identifier>,erro:<text>}` plus only the
context fields named by the error table below. Failed validation is not recorded as
an accepted idempotent command and makes no mutation.

### §R.28.2 Idempotency and allocation mutation

F1 uses both command-key idempotency and logical allocation identity. The future
migration creates immutable `public.ordem_compra_distribuicao_comandos` with:
`id BIGSERIAL`, namespace fixed to `native_distribution_v1`, `ator_id UUID NOT NULL
REFERENCES auth.users(id) ON DELETE RESTRICT`, trimmed key, canonical request JSONB,
32-character lowercase MD5 fingerprint, immutable result JSONB, and `criado_em`.
The exact uniqueness is `(idempotency_namespace, ator_id, idempotency_key)`. The
table has RLS, no client DML, and an owner-only trigger rejecting UPDATE/DELETE.
It intentionally stores entity IDs inside immutable JSON rather than cleanup-blocking
FKs to draft order/item/allocation rows. Successful command records are permanent.

The normalized request is exactly
`{"namespace":"native_distribution_v1","necessidade_id":N,"fornecedor_id":F,
"kg_alocado":"0.000"}` with keys in that order and kg formatted to three decimals.
Material conflict comparison is JSONB equality; MD5 is an indexed/fingerprint aid,
not a substitute for equality.

| Situation | Required key | Exact outcome |
|---|---|---|
| First accepted command | New key | Apply once and store normalized request plus exact result. |
| Exact transport retry | Same actor/key and byte-equivalent normalized request | Return the stored result byte-for-byte; perform no business mutation. |
| Conflicting retry | Same actor/key, different need, supplier, or target | `idempotencia_conflitante`; no mutation. |
| Intentional increase/reduction/removal | New key | Re-evaluate current locked state and apply the new absolute target. |
| Same target, new key | New key | Record an accepted `unchanged` command with the current deterministic identities/totals. |
| Concurrent first commands, different keys | Different keys | Need/draft/item/allocation locks serialize; each re-evaluates the committed current target and cap. |

One absolute-target command is canonical; separate increase/reduce/remove commands
are rejected. Mutation semantics are:

| Target/current state | Mutation | Result discriminator |
|---|---|---|
| target `>0`, allocation absent | Create the derived draft/item as needed and insert one allocation. | `created` |
| target `> current` | Update only `kg_alocado` on the locked allocation after cap validation. | `increased` |
| `0 < target < current` | Update only `kg_alocado`; recompute item total. | `reduced` |
| target `= current` | No business-row mutation. | `unchanged` |
| target `=0`, allocation present | Delete the allocation and execute cleanup in the same transaction. | `removed` |
| target `=0`, allocation absent | Create nothing and return the current need totals. | `unchanged` |

### §R.28.3 Cleanup and quantity state machine

Draft entities are consequences of active distribution. Therefore zero-allocation
shells are not retained:

| Transition | Allocation | Item | Active draft | Audit/replay consequence |
|---|---|---|---|---|
| Positive reduction | Retain with positive target. | Retain; set `kg_pedido` to the sum of all remaining allocations. | Retain. | Command record is permanent. |
| Allocation reaches zero | Delete the allocation row. | Recompute; delete if it has no allocation. | Delete if it has no item after item cleanup. | Removed IDs remain only in the immutable command result. |
| Item has no allocations | No allocation remains. | Delete the draft item. | Retain only if another item remains. | No lifecycle event: the order was never emitted; command journal is the audit. |
| Draft has no items | No rows remain below it. | No rows remain. | Delete the native active draft. | A later new-key distribution creates a new order identity; replay of an old key still returns the original stored result. |
| Emitted/cancelled/legacy parent | No mutation allowed. | No mutation or cleanup. | Never delete or rewrite. | Return `estado_invalido` or `limpeza_conflitante`; preserve history. |

The one-active-draft partial unique index remains the structural backstop. Empty
active drafts are not reachable after a successful canonical command. A deferred,
initially-deferred constraint trigger named
`trg_item_kg_pedido_derivado_guard` must validate at transaction end that every
surviving item has at least one allocation and
`kg_pedido = SUM(allocation.kg_alocado)`. The canonical writer recomputes the value
inside the transaction; the deferred guard rejects owner/direct/manual divergence
while allowing create-before-allocation and last-allocation-before-item-delete
ordering. Existing post-emission guards are expanded to freeze supplier/Pedido,
item identity/existence, allocations, and derived quantity.

### §R.28.4 Logical allocation identity and provenance

Because a locked need itself determines OP or shared-NULL provenance, the canonical
logical identity for both origins is exactly `(item_id, necessidade_id)`. F1 must
preflight `GROUP BY item_id, necessidade_id HAVING count(*)>1` and hard-stop on any
duplicate. It then replaces `ordem_compra_item_alocacao_identidade` with a unique
index on `(item_id, necessidade_id)`. This works on every PostgreSQL version supported
by the repository and does not depend on `NULLS NOT DISTINCT`.

| Need origin | Logical identity | Stored `allocation.op_id` | Structural rule |
|---|---|---|---|
| `op` | `(derived item, locked need)` | Exactly `necessidade.op_id`, non-NULL. | Need OP must resolve to the same Pedido. |
| `pedido` | `(derived item, locked need)` | NULL. | Both need and allocation OP remain NULL. |
| Imported legacy | Existing `(item, need)` after duplicate preflight. | Existing real OP retained. | No row rewrite or conversion. |

An owner-only allocation-origin guard on INSERT/UPDATE validates the stored OP with
`IS NOT DISTINCT FROM` against the locked need shape. A uniqueness exception after
the preflight is reported as `alocacao_duplicada`; it is never treated as replay.

### §R.28.5 ACL and obsolete-writer disposition

All entries below state the complete intended execution ACL after F1, not a delta.
The owner retains inherent PostgreSQL ownership privilege.

| Function | Disposition | PUBLIC | anon | authenticated | service_role | Internal/legacy boundary and timing |
|---|---|---:|---:|---:|---:|---|
| `definir_alocacao_necessidade_compra_fio(BIGINT,BIGINT,NUMERIC,TEXT)` | New canonical writer; internal `is_admin()`. | no | no | yes | no | Native distribution only; sole client mutation API after F1. |
| `definir_item_ordem_compra(UUID,BIGINT,TEXT,BIGINT,TEXT,NUMERIC)` | Retain definition temporarily but revoke client execution; deprecated/owner-only. | no | no | no | no | No legacy dependency. Remove only in later dependency-confirmed cleanup after F2 migration. |
| `alocar_necessidade_compra_fio(BIGINT,BIGINT,BIGINT,NUMERIC)` | Replaced; retained owner-only for catalog/rollback comparison. | no | no | no | no | No legacy dependency; caller-selected OP prohibited. Later dependency-confirmed removal. |
| `remover_item_ordem_compra(BIGINT)` | Replaced by target-zero cleanup; retained owner-only. | no | no | no | no | No legacy dependency; later dependency-confirmed removal. |
| `remover_alocacao_compra_fio(BIGINT)` | Replaced by target-zero command; retained owner-only. | no | no | no | no | Rejects legacy already; later dependency-confirmed removal. |
| `emitir_ordem_compra(BIGINT)` | Keep inactive and owner-only unchanged. | no | no | no | no | No native emission activation in F1. |
| `cancelar_ordem_compra(BIGINT)` | Keep native draft cancellation. | no | no | yes | no | Internal `is_admin()`; nonempty draft lifecycle action remains valid. |
| `registrar_recebimento_ordem_compra(...)` | Keep authenticated execution and existing admin/matching-supplier authorization; correct shared shape only. | no | no | yes | no | Phase C native receipt API; no activation or flat cutover. |
| `estornar_recebimento_ordem_compra(...)` | Keep authenticated execution and admin-only internal authorization. | no | no | yes | no | Body/ACL unchanged except shared-NULL regression qualification. |
| `visualizar_importacao_saldo_inicial_c3a()` | Keep existing authenticated read-only preview ACL unchanged. | no | no | yes | no | No C3A activation or acceptance. |
| `importar_saldo_inicial_ordem_compra_c3a(JSONB)` and C3A mutation/trigger helpers | Keep owner-only unchanged. | no | no | no | no | Legacy Class A/D real-OP import only; no client or service execution. |

Flat `ordens_compra_fio` regime writers and db/66 coexistence authority are unchanged;
F1 revokes only obsolete native order-first/item-first authority. F2 must migrate the
UI before any environment applies F1 as an operational release. F1 itself does not
authorize F2 or any environment application.

### §R.28.6 Phase C shared-allocation shape

| Line shape | Allocation | Need origin | Ledger/movement `op_id` | Required traceability |
|---|---|---|---|---|
| OP-origin allocated receipt/reversal | required | `op`, real OP | same non-NULL real OP | order, supplier, Pedido, item, need, allocation, material/color, quantity, command, ledger, movement |
| Pedido-origin shared allocated receipt/reversal | required | `pedido`, need OP NULL | NULL | same complete traceability; OP is deliberately absent, never fabricated |
| Excess receipt/reversal | absent | not applicable | NULL | order, supplier, Pedido, item, material/color, quantity, command, ledger, movement; `saldo_fios` surplus policy |
| C3A legacy import | required for attributed line | imported legacy real-OP | existing non-NULL real OP | Existing frozen source/mapping/item/allocation identity; unchanged and non-posting |

Future F1 disposition is exact:

| Object/path | Required correction |
|---|---|
| Native ledger shape constraint | Allocated lines require allocation and zero excess but permit nullable OP; excess still requires allocation NULL, OP NULL, and `kg_excesso=kg_recebido`. |
| db/70 `trg_native_lancamento_shape_guard` | Replace the non-NULL test with `v_alloc.op_id IS DISTINCT FROM NEW.op_id`; also validate the allocation's need origin/Pedido relationship. |
| db/71 replacement guard | Apply the same NULL-safe allocation/ledger comparison while preserving system-import actor/type rules. |
| Native receipt allocation selection | Remove `a.op_id IS NOT NULL`; accept exactly OP-origin/equal-real-OP or Pedido-origin/both-NULL shape. Continue deriving line OP from the allocation. |
| Receipt/item caps | Keep allocation and item caps unchanged; NULL OP does not weaken quantity authority. |
| Derivation and inventory movement | Carry the nullable OP unchanged into ledger and source-linked movement; surplus computation and `saldo_fios` delta remain unchanged. |
| Reversal | Keep source attribution comparison with `IS DISTINCT FROM`; a shared source reverses with NULL OP. |
| History/read models | Return `op_id:null` for shared lines and use nullable/left OP enrichment; never drop a shared row through an inner OP join. |
| C3A db/73 command/import | Keep its legacy one-allocation, real-OP validation and non-posting behavior unchanged. db/72 and import identity/hash remain unchanged. |

No existing receipt, ledger, movement, import, or staging row requires conversion.
C3A stays inactive and unaccepted.

### §R.28.7 Stable error taxonomy

| `codigo` | Exact condition |
|---|---|
| `sem_permissao` | Missing authenticated administrator or failed `is_admin()`. |
| `idempotencia_invalida` | Blank/over-200 command key. |
| `idempotencia_conflitante` | Same actor/key already accepted with different normalized request. |
| `necessidade_nao_encontrada` | Need id absent. |
| `necessidade_invalida` | Legacy, zero/inactive-equivalent, or otherwise non-native need cannot be distributed. |
| `necessidade_origem_invalida` | Need origin/material/nullable-OP shape violates the accepted hybrid model. |
| `fornecedor_invalido` | Supplier is NULL/absent. |
| `fornecedor_inativo` | Reserved stable identifier for a future canonical supplier-inactive predicate; unreachable in F1 because the current real schema has no activity column and F1 must not invent one. |
| `fornecedor_incompativel` | Supplier type does not match the need material. |
| `kg_invalido` | NULL, negative, over three decimals, or outside `NUMERIC(12,3)` range. |
| `excede_saldo` | Absolute target exceeds `kg_necessario - (kg_alocado excluding this identity)`. |
| `pedido_incoerente` | Need Pedido missing or inconsistent with the derived OP/order. |
| `op_incoerente` | OP-origin need has missing/wrong real OP or shared need/allocation carries an OP. |
| `estado_invalido` | Existing parent is legacy, emitted, or cancelled; mutation is draft-only. |
| `alocacao_duplicada` | Corrected logical identity preflight/unique backstop finds more than one row. |
| `limpeza_conflitante` | Cleanup encounters a non-draft/history-bearing entity or state changed outside the locked canonical order. |
| `alocacao_invalida` | Phase C receipt line does not match allocation, need, item, Pedido, material/color, or derived real-or-NULL OP. |

### §R.28.8 Lock order and concurrency

| Order | Lock | Purpose |
|---:|---|---|
| 1 | Transaction advisory lock on the command key defined below. | Serialize exact/conflicting reuse of one actor command key. |
| 2 | Existing command row `FOR UPDATE`, if present | Return exact replay or conflict before business mutation. |
| 3 | `necessidade_compra_fio` row `FOR UPDATE` | Serialize cap, provenance, allocation, removal, and cache decisions for one need. |
| 4 | Supplier row `FOR KEY SHARE` | Stabilize existence/type during the command. |
| 5 | Draft advisory lock defined below, then active draft `FOR UPDATE` or insert. | Prevent duplicate active drafts and serialize cleanup/new allocation across different needs of one Pedido+supplier. |
| 6 | Compatible item row `FOR UPDATE` or insert | Serialize derived item quantity and item cleanup. |
| 7 | Logical allocation row `FOR UPDATE` or insert | Prevent lost target updates and duplicate first allocation. |
| 8 | Mutation, need-cache readback, item recompute, item/draft cleanup | Produce one atomic post-state under all business locks. |
| 9 | Immutable command-row insert | Publish the accepted key/request/result in the same transaction. |

The advisory inputs are exact:

```sql
hashtextextended(
  'native_distribution_v1|command|' || auth.uid()::TEXT || '|' || btrim(p_idempotency_key),
  0
)
hashtextextended(
  'native_distribution_v1|draft|' || v_pedido_id::TEXT || '|' || p_fornecedor_id::TEXT,
  0
)
```

The command is single-need; no multi-need RPC exists. Different needs for the same
draft cannot deadlock because each command takes only its own need before the common
draft lock. Allocation/removal and cleanup/new-allocation races serialize on need and
draft. Emission must lock the order row: if distribution wins, emission observes the
committed derived state; if emission wins, distribution wakes to a non-draft order and
returns `estado_invalido`. Receipt cannot race with draft mutation because receipt
requires an emitted order and uses the same order/item/allocation identities.

### §R.28.9 Implementation and revalidation scope

| Scope | F1 implementation obligation | Later/separate obligation |
|---|---|---|
| Migration | One forward-only next-number migration containing the command journal, writer, identity preflight/index, provenance and deferred quantity guards, freeze backstops, ACL matrix, and localized db/70-db/71 replacements. No db/67-db/73 rollback or data conversion. | Environment application requires a separate order. |
| Database tests | Static contract tests, isolated apply/rollback without `CASCADE`, command/replay/conflict/cleanup/ACL tests, and distinct-backend concurrency for same need, shared need, removal race, duplicate key, and draft creation. | Focused staging validation separately authorized. |
| Phase C | Shared NULL-OP receipt/ledger/movement/history/reversal regression plus unchanged OP-origin, excess, and C3A legacy import behavior. | Phase C shared-allocation revalidation after F1 validation. |
| Application/UI | Only fixture/contract coherence strictly required by changed RPC availability; no distribution UI migration. | F2 migrates Pedido/Insumos UI and removes independent Nova ordem/order-detail ownership. Not authorized here. |
| Broader proof | Canonical full-suite before/after failure-identity comparison. | PRE-PROD revalidation, C3A disposition, and later C3 phases each remain separate. |

Status of this section: `F1 EXECUTABLE CONTRACT CLOSURE R1: CLOSED / ACCEPTED` at
commit `00897f09267fc8304b329ce46ba985d03a57faff`. Implementation is governed by
the separately authorized `F1 FORWARD CORRECTION IMPLEMENTATION R1` order.

Implementation checkpoint (2026-07-19): `IMPLEMENTED / VERIFIED LOCALLY / AWAITING
ARCHITECT REVIEW` at technical commits
`463cafbdd4816ff1093b3086dd71d3d6e70b3479` and
`680cff136a3294ae9a345fc8f91f02e246891eef`. The latter preserves the existing
authenticated `sincronizar_necessidades_compra_fio(UUID)` authority while the
accepted obsolete writers remain owner-only. Forward migration `db/74` implements
this section without modifying db/67-db/73 or converting environment data. Isolated
PostgreSQL 18.4 apply/reapply, rollback-scoped functional/ACL/Phase-C tests, and the
required distinct-session race matrix passed. F2 and staging application remain
separately unauthorized; C3A remains unaccepted.

### §R.28.10 F3 partial staging checkpoint (2026-07-19)

F3 readiness passed and the accepted forward correction was applied to staging as
`20260719215401 / 74_ordem_compra_hybrid_origin_forward_correction`. Pre/post
business snapshots remained identical; the need-first writer and accepted ACL
matrix are live while native emission and C3A import remain owner-only. Committed
source `8214ab7b4e7c185d6f4501a593fcaa836ad65d1b` was deployed without push to
Vercel preview `dpl_7QGBHzW8MoE4sPVVuGdFrv9Ci7iP`. Authenticated validation
hard-stopped because Vercel Authentication protects every preview alias and the
controlled browser has no authenticated Vercel session. No fixture was created;
PRE-PROD and Phase C revalidation remain pending. This checkpoint is not F3
completion or C3A acceptance.

### §R.28.11 F3R1 staging database/API and Phase C checkpoint (2026-07-19)

The applied `db/74` identity, live objects, guards, accepted execution matrix, and
stable business-data snapshots match the accepted F1 contract. A rollback-only
canonical-domain fixture passed OP-origin and shared Pedido-origin need-first
mutation, replay/conflict, quantity derivation, cleanup, freeze, receipt, reversal,
and nullable-OP Phase C behavior without persistent residue. PRE-PROD hybrid-origin
and targeted Phase C revalidation pass on read-only and rollback evidence.

F3R1 remains incomplete only at committed multi-session staging concurrency. The
permanent actor/key journal deliberately survives zero-target cleanup, so any
successful committed synthetic command leaves immutable journal residue; no
canonical retained staging fixture exists. The zero-residue validation policy
therefore precludes that proof without a new architect decision. The next
authorizable action is architect disposition of this evidence boundary, not C3A
disposition. Vercel/browser validation is not part of F3R1. C3A remains inactive
and unaccepted.

### §R.28.12 F3R1 acceptance disposition (2026-07-19) — CLOSED / ACCEPTED

The architect accepted the F3R1 gate. The isolated F1 eight-case distinct-session
concurrency matrix (§R.28.9) together with the F3R1 staging database/API runtime
and rollback-only evidence (§R.28.11) are accepted as sufficient concurrency proof
for this gate. The committed multi-session staging-fixture requirement is **waived
for F3R1 only** and creates no precedent for later gates. Immutable
command-journal integrity and the zero-synthetic-residue validation policy remain
mandatory and are not relaxed: the waiver authorizes no journal-residue policy and
no retained synthetic fixture. PRE-PROD hybrid-origin and focused Phase C
revalidation are accepted. C3A remains inactive and unaccepted. Production, `main`,
native emission activation, C3A execution, remotes, push, and deployment remain
unauthorized. The next authorizable action is the architect's technical-acceptance
disposition for C3A only.

### §R.28.13 PHASE-C3A technical acceptance (2026-07-19) — CLOSED / TECHNICALLY ACCEPTED

PHASE-C3A is accepted on the staging evidence recorded in §13.14: staging
migrations `71`-`74` present; cutover singleton `id=1`, `legacy_active /
not_started`, all cutover markers `NULL`; zero import headers, import ledger
rows, native headers, inventory movements, and baseline rows; preview 39
headers / 44 ledger entries / 20,221.280 kg reconstructed / 405.980 kg excess;
`saldo_fios` 5 rows / 2,685.020 kg; `saldo_fios_op` zero; the import command
owner `postgres`, `SECURITY DEFINER`, fixed empty `search_path`, no EXECUTE for
`PUBLIC`/`anon`/`authenticated`/`service_role`; the authenticated read-only
preview ACL intentionally retained under §R.28.5; focused suite 66/66 passed.
This disposition is recorded by the technical supervisor acting as delegated
project architect and is not attributed to Kleber. It is documentation-only and
authorizes no real import, snapshot, fence, reader/writer or flat-ACL switch,
native emission, `C3B`/`C3C`/`C3D`/`C4`/`C5`, production, `main`, remote
change, push, or deployment. `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`
remains nonblocking debt. No phase chains automatically from this closeout.

## §R.29 PHASE-C3B — Executable Phase-C3 contract closure R1 — CLOSED / ACCEPTED

**Authority and packaging.** This contract is accepted by the technical
supervisor acting as delegated project architect; the acceptance wording is not
attributed to Kleber. C3B is this documentation-only closure. C3C is inactive
implementation and must preserve legacy behavior while the cutover state is
`legacy_active`. C3D is rehearsal and inactive staging deployment preparation.
Neither C3B, C3C, nor C3D creates a real cutover window. A real cutover is one
later, separately authorized maintenance window in which the eight steps below
run contiguously; there is no soak period between the read switch and ACL
closure.

| Package | Artifacts and permitted result |
|---|---|
| C3B contract closure | §§R.29/13.15, the dependency and ACL matrices, state/lock/fence/import/recovery specification, and acceptance records only. |
| C3C inactive implementation | Migrations and internal database objects, canonical reader/writer adapters, state-aware compatibility adapters, and tests; all remain inactive while `legacy_active`. |
| C3D rehearsal/deployment preparation | Deployment manifest, rehearsal procedures and empirical fence/role-matrix proof against isolated rehearsal scope; no real cutover state change, import, or ACL closure. |
| Later real cutover window | The session lock, state transition, frozen live snapshot, deterministic import/reconciliation, canonical-read activation, final ACL/policy closure, and final verification in §R.29.5. |

The supervisor-supplied live staging evidence for project
`ucrjtfswnfdlxwtmxnoo` is the starting fact for this contract: singleton `id=1`
is `legacy_active / not_started` with all markers `NULL`; import, native, and
baseline counts are zero; the import RPC is postgres-only; receipt/reversal/
history RPCs have authenticated EXECUTE; and the flat table retains broad legacy
grants and `PUBLIC`-targeted RLS policies. This is supervisor-supplied evidence,
not a query performed by the documentation closeout.

### §R.29.1 Authority and dependency matrix

| Class | Artifact / consumer | Current dependency and C3 contract |
|---|---|---|
| Direct flat writer | `js/screens/op-writes.js` | Writes flat receipt state (`kg_recebido`, `data_recebimento`, `status`); replace internally with the canonical receipt command before activation. |
| Direct flat writer/reader | `js/screens/fornecedor.js` | Reads and mutates receipt fields inline; route to canonical reader/command or disable at cutover. |
| Direct flat source writer | `js/screens/op-persistir.js` | Deletes/inserts flat purchase-order source rows; remains legacy-only and is fenced from receipt/source mutation during cutover. |
| Direct flat readers | `js/screens/pedido-detail-data.js`, `js/screens/op-nova.js` | Query flat order/receipt state directly; consume the normalized canonical projection before activation. |
| Receipt command caller / derived projection | `js/screens/pedido-detail-events.js` | Calls the legacy write path and derives receipt state; become a non-visual compatibility adapter or disabled surface, never new C3 UX. |
| Derived receipt/progress projections | `js/screens/pedido-detail-progress.js`, `js/screens/pedido-chain-state.js`, `js/calculo-op.js`, `js/screens/op-recalculo.js` | Derive progress, chain state, and material balances from receipt quantities; consume normalized canonical fields only. `op-recalculo.js` must not globally credit `saldo_fios` from `kg_recebido - kg_pedido`. |
| Derived operational/admin views | `js/screens/op-distribuicao-ui.js`, `js/screens/op-tecelagem-producao-admin.js`, `js/screens/ordem-compra-data.js`, `js/screens/ordem-compra-render.js`, `js/screens/op-pdf.js`, `js/screens/pedido-insumos-distribuicao.js` | Read derived order, allocation, receipt, or production state; use the normalized projection and cannot independently reconstruct receipt authority. |
| Flat lifecycle/delete dependency | `js/delete-helpers.js` | Includes `ordens_compra_fio` in controlled OP deletion; must observe cutover state and cannot bypass canonical commands or the database fence. |
| Canonical authority | receipt, reversal, history RPCs; import command; cutover structures | Only explicitly authorized RPC surfaces may mutate/read protected receipt state after closure. The import command remains postgres-only. |

This is the complete discovered dependency boundary: direct database readers and
writers are separated above from projection consumers. Every listed consumer must
be deployed with canonical-read compatibility before activation; no undiscovered
flat receipt read or write may remain on the activation manifest.

### §R.29.2 Normalized canonical read contract

One canonical reader projection is the sole post-switch source for all receipt
state. It returns stable header, allocation, Pedido, material, supplier, receipt,
reversal, and history identity plus, at minimum,
`op_id`, `origem_tipo`, `kg_recebido_atribuido`, and `kg_excesso`.

- Pedido-origin rows preserve `op_id = NULL`; no representative or fabricated OP
  is introduced.
- `kg_recebido_atribuido` is allocated receipt quantity. `kg_excesso` is a
  separate allocation-free quantity. Aggregates must not add either field twice
  through a header and a child row.
- Pedido-level consumers show shared rows once at Pedido scope. OP-level
  consumers include only real OP-attributable quantities; they do not absorb
  Pedido-origin or excess quantities.
- Only a canonical source-linked surplus event may affect global `saldo_fios`.
  OP-local `saldo_fios_op` derives only canonical attributable quantity. Import
  posts zero inventory movements.

### §R.29.3 Cutover state machine and database-owned fence

The cutover row is the authoritative state machine; application flags are
consumers only.

| State | Read authority | Receipt/source writers | Permitted transition |
|---|---|---|---|
| `legacy_active` | flat | legacy behavior | controlled maintenance entry only |
| `maintenance_fenced` | flat or canonical for verification | both legacy receipt writers and protected legacy source/inventory mutations denied | snapshot, import, reconciliation, read switch, closure, or pre-PONR rollback |
| `canonical_active` | canonical | canonical commands only | forward recovery only after PONR |

The database fence is implemented by database-owned guards on direct flat receipt
columns (`kg_recebido`, `data_recebimento`, `status`) and protected flat
source/inventory mutation paths. In `maintenance_fenced` and `canonical_active`,
they reject both known legacy receipt writers with stable
`legacy_receipt_fenced`; no UI flag can bypass them. C3D must empirically prove
denial using the actual authorized admin path and a matching-supplier path, while
proving unchanged source/inventory hashes. Canonical receipt/reversal commands
check state, actor, and order authorization; a successful non-import canonical
receipt after canonical reads are active atomically records
`productive_receipt_started_at`.

The exact point of no return is the first successfully committed non-import
canonical receipt after the canonical read switch, not the switch itself.

### §R.29.4 Snapshot, import, and pre-switch reconciliation

After fencing and before import, a short database transaction captures a frozen
source snapshot of all **51 mappings**, including zero-quantity mappings, sorted
by stable semantic identity and canonical three-decimal kg formatting. It also
captures the complete `saldo_fios` inventory baseline. Each snapshot records
count, total, canonical serialization, and SHA-256; later work reads that frozen
snapshot, never live flat rows.

The postgres-only deterministic orchestrator takes only the frozen snapshot and
produces exactly **39 headers**, **44 immutable ledger lines**,
**20,221.280 kg** reconstructed, and **405.980 kg** excess with **zero inventory
movements**. Its deterministic ordering is flat source, mapping, canonical order
item, allocation, then ledger identity. It is idempotent only for the exact
frozen snapshot/hash and rejects any mismatch without inserting another header or
line.

Before the reader switch, reconciliation in short transactions must prove all of:

1. frozen mapping count is 51 and complete, and source plus inventory hashes are
   unchanged after fencing;
2. canonical import counts and totals equal 39 / 44 / 20,221.280 kg / 405.980 kg;
3. import created zero inventory movements and did not change the inventory
   baseline;
4. normalized projection totals reconcile attributable and excess quantity without
   a fabricated OP or double count; and
5. no productive canonical receipt exists.

### §R.29.5 Lock and single-window execution contract

The cutover coordinator first obtains a session-level advisory lock identified by
the cutover generation. The deterministic resource-lock order is: cutover row,
frozen source/mapping rows, inventory baseline rows, canonical header/allocation
identities, then affected order rows. Every database transaction is short; no
transaction remains open across client probes, UI operations, deployment checks,
or any external call.

The later real window executes exactly this contiguous sequence:

1. Obtain the session advisory lock and deterministic row locks; transition from
   `legacy_active` to `maintenance_fenced`.
2. Empirically prove both legacy receipt writers are denied and source/inventory
   hashes remain unchanged.
3. Freeze the 51-mapping source snapshot and complete inventory baseline.
4. Verify the already-deployed inactive canonical writers and every dependency in
   §R.29.1 has canonical-reader compatibility or a state-driven disablement.
5. Run the deterministic import and pre-switch reconciliation in §R.29.4.
6. Set read authority to canonical while remaining fenced; run canonical reader
   and projection checks.
7. Explicitly close final ACLs and RLS policies as §13.15; there is no soak
   interval before this closure.
8. Repeat fence-denial, catalog/ACL, and reconciliation checks; activate
   `canonical_active`, then release the advisory lock.

### §R.29.6 Rollback, recovery, and UI boundary

Before the point of no return, rollback may restore flat reads only after a
database proof that zero post-switch productive canonical receipts were accepted.
Base rollback retains the database fence on legacy writers and does **not**
restore flat grants. Re-enabling flat mutation requires a separate recovery
authorization plus a generation/idempotency plan proving that the committed
immutable import cannot become stale or double-counted.

After the first productive canonical receipt commits, recovery is forward-only:
repair canonical commands/projections, reconcile immutable history and inventory,
and preserve the closed flat authority. No return to flat reads or writers is
permitted.

C3 creates no visual UI. C4 exclusively owns the new admin receipt UI at
`#/ordens-compra/:id`; supplier UI is deferred. Existing compatibility surfaces
may receive non-visual state-driven adapters or be disabled at cutover, but may
not become new UX.

### §R.29.7 Legacy-compat database prerequisites

A canonical order-catalog projection (listar_ordens_compra_fio_compat) and an
atomic legacy receipt-intent adapter (registrar_recebimento_ordem_compra_fio_compat)
operate on legacy-compat orders (ordem_compra.legado = TRUE). Both are installed
before the real cutover and are inactive unless the cutover singleton is
status='canonical_active' AND read_authority='canonical'. Before canonical
activation the projection raises the defined inactive-reader signal
(listar_compat_inativo, SQLSTATE 55000) and the adapter returns its defined
inactive-writer response ({ok:false, codigo:'recebimento_compat_inativo'}); the
future application read/write adapters fall back to the flat table during
legacy_active/maintenance_fenced, byte-identical to today. After canonical
activation, the adapter's first successful non-import receipt participates in
the existing §R.29.3 productive_receipt_started_at point of no return; no second
PONR is created. Legacy-compat receipt decrease is admin-only; reversal source
selection is deterministic LIFO over eligible tipo='recebimento' lançamentos,
capped at each line's remaining reversible balance; the imported opening balance
(tipo='import_saldo_inicial') is an immutable floor that no decrease may reduce.
Legacy-compat receipt eligibility is status_administrativo <> 'cancelada' (not
the native-only 'emitida' requirement) and status_aceite IN ('nao_aplicavel',
'aceita'). The projection's OP-attributable grain is item × OP, allocations
aggregated within the requested OP. The implementation binds to the
compat-mapped fixed corpus supported by the existing db/75 cutover; corpus
completeness, freeze, and any re-baseline are a later real-cutover/C3D
precondition, outside these RPCs' scope. Compat identity is carried by the
idempotency namespace legacy_compat_receipt_v1; the adapter reuses the native
command types (recebimento for increase and the equal/no-op record, estorno for
decrease) and introduces no new comando_tipo — the installed native ledger shape
guard couples comando_tipo to each ledger line's tipo (contract §35 correction).

## §R.30 PHASE-C3C-A inactive implementation closeout R1 — CLOSED / TECHNICALLY ACCEPTED

`C3C_A_STATUS: CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED / INACTIVE / NOT APPLIED TO STAGING`

`NEXT_AUTHORIZABLE_ACTION: READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`

**Recorded status:** `CLOSED / TECHNICALLY ACCEPTED — LOCALLY VERIFIED /
INACTIVE / NOT APPLIED TO STAGING`. The delegated technical supervisor records
this acceptance; it is not attributed to Kleber. Accepted technical chain:
`d4dba671c07ec25f23e385e7786cbe90209816f3` →
`4b7ee13fe35a830e9a3cb1cc182679c81034ce73` →
`29913e40fa06eda009b5a2e8f058209cde90da11` →
`89123729b3529fff6e4a2336bfec2907c4b94b4c`.

This closeout accepts locally: the inactive database contract; complete
14-table `PUBLIC`-policy detection and closure; exact import replay and stable
`55000 / idempotencia_conflitante` identity conflicts; canonical snapshot and
live-state SHA-256 verification; exact 51-mapping / 39-header / 44-line /
19,815.300 kg attributable / 405.980 kg excess / 20,221.280 kg reconstructed /
zero-import-movement reconciliation; nullable Pedido-origin `op_id`, attributable
versus excess separation, no fabricated OP, and no double counting; session
advisory-lock exclusion plus deterministic eight-stage resource locking,
release/reacquisition, zero deadlocks, and an idle final backend; pre-PONR
rollback; and post-PONR forward-only recovery. Local PostgreSQL 18.4
apply/reapply preserved `legacy_active / flat / not_started`.

§R.29 remains unchanged and governing: one later contiguous maintenance window,
database-owned fencing, short transactions, the session advisory lock, complete
table/column ACL closure, C3's no-visual-UI boundary, C4 ownership of the new
admin receipt UI, deferred supplier UI, the PONR definition, and both recovery
boundaries are neither reinterpreted nor broadened here.

Only local technical acceptance is granted. Staging validation, staging
application, deployment, activation, cutover, and product acceptance are distinct
and not granted. C3C-B implementation, C3D, staging application/validation,
activation, deployment, real snapshot/import, fence transition, read switch,
final ACL-closure invocation, cutover, C4, C5, production, `main`, remotes, and
push remain unauthorized.

**NEXT_AUTHORIZABLE_ACTION: `READ-ONLY GOVERNANCE AND SPEC-CUSTODY AUDIT`.**
C3C-B remains the next product implementation lot but is not authorized. The
audit must precede any C3C-B implementation order; no product phase chains from
this closeout.

## §R.31 Active Phase-C continuation requirement registry — governance metadata

This registry adds stable identifiers to already accepted semantics. It does not
rewrite, expand, or reinterpret §R.29 or create operational state or phase
authority. Detailed disposition is derived in
`docs/architecture/ORDEM_COMPRA_C3_TRACEABILITY.md`.

| REQUIREMENT_ID | NORMATIVE_ANCHORS | OWNING_PHASE | REQUIREMENT |
|---|---|---|---|
| `OC-C3-READ-001` | `§R.29.2` | `C3C-B` | Consume the normalized canonical read contract. |
| `OC-C3-WRITE-001` | `§R.29.1`; `§R.29.3` | `C3C-B` | Route legacy callers to canonical commands or disable them by state. |
| `OC-C3-COMPAT-001` | `§R.29.1` | `C3C-B` | Give every discovered dependency canonical compatibility or disablement before activation. |
| `OC-C3-NOUI-001` | `§R.29.6` | `C3C-B` | Create no visual UI in C3. |
| `OC-C3D-DEPLOY-001` | `§R.29` | `C3D` | Limit C3D to rehearsal and inactive staging deployment preparation. |
| `OC-C3D-FENCE-001` | `§R.29.3` | `C3D` | Prove admin and matching-supplier fence denial with unchanged hashes. |
| `OC-C3D-LOCK-001` | `§R.29.5` | `C3D` | Prove session exclusion, deterministic resource locks, short transactions, and release. |
| `OC-CUTOVER-001` | `§R.29.5` | `REAL_CUTOVER` | Execute one contiguous eight-step maintenance window. |
| `OC-CUTOVER-PONR-001` | `§R.29.6` | `REAL_CUTOVER` | Preserve the exact PONR and pre-/post-PONR recovery boundaries. |
| `OC-C4-ADMIN-001` | `§R.29.6` | `C4` | Own the admin receipt UI at `#/ordens-compra/:id`. |
| `OC-C4-SUPPLIER-001` | `§R.29.6` | `C4` | Keep supplier receipt UI deferred. |
| `OC-C5-EMISSION-001` | `§R.24.10` | `C5` | Keep native emission behind the separate post-C4 gate. |

---

## §R.32 Post-generation lifecycle — binding amendment (db/100)

`PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1`, applied as
`db/100_ordem_compra_post_generation_stabilization.sql`. This section is a
FORWARD CORRECTION: it supersedes the named sentences below and rewrites no
prior section. Everything not named here is unchanged.

### §R.32.1 Active purchasing coverage has ONE server-owned definition

`public.oc_cobertura_ativa(p_ordem_id BIGINT) RETURNS BOOLEAN` is the single
definition of *"this planning row / this allocation still consumes purchasing
balance"*. It is DERIVED from `ordem_compra.status_administrativo`: planning
that carries no document yet is active, a document is active until it is
`cancelada`, and a non-existent document covers nothing.

No second lifecycle status, marker column or parallel authority exists, and
none may be introduced. Every balance owner reads this one definition:

- `necessidade_compra_fio.kg_alocado` (through
  `public.oc_recalcular_cache_necessidade`, now the sole writer of that cache,
  called by the db/67 allocation trigger and by cancellation);
- the deferred planning ceiling `trg_planejamento_saldo_guard`;
- the planning read model `obter_planejamento_compra_pedido`
  (`kg_planejado` / `kg_restante` / `kg_gerado`, plus the new `kg_cancelado`
  and the per-row `ativo` marker);
- the planning writers `definir_planejamento_compra`,
  `substituir_planejamento_compra_necessidade` and
  `aplicar_planejamento_rapido`;
- the locked ceiling revalidation inside `gerar_ordem_compra_do_planejamento`;
- every productive gate that consumes the need cache, which is corrected
  automatically because the cache itself became coverage-aware.

The historical Purchase Order keeps and still displays all of its original
allocations and planning links. Being historical is a property of the parent
document, never a deletion of the child rows.

### §R.32.2 Cancellation — supersedes the temporary draft-only restriction

`§R.22.7` already declared the permitted source states as
`rascunho | emitida → cancelada`. db/68 implemented only the draft half and
returned `estado_invalido` for everything else, describing that narrowing as
deferred to `PRE-PROD/Phase C`. **That deferral is now closed.** An emitted
native Purchase Order with no irreversible history is cancellable.

- `public.oc_elegivel_cancelamento(p_ordem_id BIGINT) RETURNS JSONB` is the
  SINGLE eligibility owner. It is read by `public.cancelar_ordem_compra` and
  projected into `obter_ordem_compra_admin.acoes.cancelar` (plus
  `bloqueio_cancelamento`), so the screen never restates the rule.
- Eligible: native `rascunho`, native `emitida`. Ineligible: `legado`
  (`ordem_legado`), already cancelled (`ja_cancelada`), any receipt, yarn
  ledger entry or stock movement (`historico_irreversivel`). The §R.22.7
  determination that received quantity blocks cancellation — the correction
  path being an `estorno` — is preserved verbatim and is now reachable.
- **Immediate release.** Cancellation stops that order from consuming active
  purchasing balance at the moment of the transition, not at deletion.
  Because the release is DERIVED, it is structurally irrepeatable: no
  "returned quantity" is recorded anywhere that could be returned again.
- Cancellation preserves the complete historical graph — header, visible code,
  items, allocations, planning rows and administrative events — sets
  `cancelada_em` / `cancelada_por`, writes EXACTLY one cancellation event, and
  returns the released quantities with the affected need identities. A second
  cancellation returns `ja_cancelada` and mutates nothing.
- Supplier acceptance semantics are UNCHANGED by this amendment. No acceptance
  rule was added to cancellation.

### §R.32.3 Permanent deletion — eligibility corrected

db/96/db/97 carried an absolute rule, `emitida_em IS NOT NULL → ordem_emitida`,
which contradicted the very next clause admitting `cancelada`: an order
cancelled AFTER being emitted keeps `emitida_em` forever and was therefore
permanently ineligible, with no product path out. **That rule is withdrawn.**

Eligibility is now governed by the CURRENT lifecycle state plus irreversible
history: status `rascunho` or `cancelada`, `legado = FALSE`, no decided
supplier acceptance (`aceite_decidido`, preserved from db/96 unchanged), and
zero receipts, yarn ledger entries or stock movements. An `emitida` order is
still not directly deletable — its status excludes it by the first rule, and
the path is cancel-then-delete.

`public.excluir_ordem_compra` branches explicitly by lifecycle state:

- **`rascunho`** — its coverage was never released, so deletion RETURNS the
  generated planning quantities to the live planning state with the exact
  db/99 merge semantics (merge into an existing live row of the same
  `(necessidade, fornecedor)` pair, otherwise revive the row in place).
- **`cancelada`** — cancellation already released the coverage, so the
  historical planning rows are REMOVED with the document and nothing is
  returned a second time.

Both branches remain atomic, keep the canonical lock order
(necessidade → planejamento → order-graph children), leave zero orphans, leave
every need balance correct and touch no other Purchase Order. Purchase Order
numbering is never rewound; a cancelled code stays reserved while the order
exists and is released only when an eligible order is permanently deleted.

### §R.32.4 Cancellation and permanent deletion are different acts

- **Cancel** keeps a real document in history and frees its balance.
- **Delete** removes a document that should not exist.

Deletion is never a substitute for cancellation, and cancellation is never a
substitute for an `estorno` once physical consequence exists.

### §R.32.5 Receipt registration follows the cutover

`acoes.receber` in `obter_historico_recebimento_ordem_compra` is now
subordinate to `ordem_compra_cutover`: it may be true only when
`status = 'canonical_active'` AND `read_authority = 'canonical'`. While the
cutover is inactive the projection returns
`bloqueio_recebimento = 'recebimento_canonico_inativo'` and the surface renders
an honest read-only explanation instead of an actionable control. The writer
fence of `§R.29` / db/75 / db/76 is INDEPENDENT and unchanged; this amendment
only stops the read model from offering an action the writer would refuse.

### §R.32.6 Planning ownership is unchanged

`Pedido › Planejamento de compras` (db/99) remains the sole authority over
supplier and quantity. The Purchase Order detail gained a READ-ONLY
provenance projection and no allocation-editing authority.

### §R.32.7 Supervisor acceptance

`PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1` is CLOSED / ACCEPTED at
checkpoint `97d461ef07ddb422db0b22cea6436f593fdc657a` (parent
`921236527155d7a8dd4207bf5d85d58a048798f7`). The acceptance scope is owned by
`docs/governance/current-state.json` `accepted_checkpoints`; it is not
restated here. The later `canonical_active`/`canonical` receipt availability
introduced by `NATIVE-RECEIPT-COORDINATED-RELEASE-P5-CUTOVER-R1` is EXPECTED
EVOLUTION of §R.32.5's cutover-subordination predicate, not a contradiction
of it: the predicate itself is unchanged, only the cutover state it reads
moved. Likewise, `NATIVE-RECEIPT-COORDINATED-RELEASE-P4-AUTHORITY-SWITCH-R1`
joining `cancelar_ordem_compra` and `excluir_ordem_compra` to the 9.9.B lock
protocol preserved the §R.32.2/§R.32.3 bodies byte-exactly and did not amend
this section's semantics.

---

## §R.33 Native-receipt provenance and multi-origin ruling — CLOSED / ACCEPTED

`NATIVE-RECEIPT-P6-PROVENANCE-AND-MULTI-ORIGIN-BLOCKER-RESOLUTION-R1` completed
as a READ-ONLY reconciliation against the definitive production project
`ucrjtfswnfdlxwtmxnoo` (cluster `system_identifier 7642734024280108049`,
PostgreSQL 17.6, terminal migration `20260802130337 / db/115`), with no
repository and no production mutation. This section records the supervisor
ruling it produced. It closes two canonical blockers and states one binding
architecture boundary. It rewrites no prior section; everything not named here
is unchanged.

### §R.33.1 `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` — RESOLVED BY ARCHITECTURE RULING

The causal provenance of the historical `public.saldo_fios` population is
PERMANENTLY UNKNOWABLE from surviving evidence, and that is a measured fact
rather than an unfinished investigation. `saldo_fios` carries no source, actor,
order or OP dimension — its identity is `(tipo, cor_id | cor_poliester)` and its
only payload is `kg_total` — it has no audit or event sibling, the flat model
holds zero rows with a cutover source snapshot of zero, and the client-side
writers that historically touched it were retired in
`NATIVE-RECEIPT-COORDINATED-RELEASE-P2`. The balances therefore cannot be
attributed to historical purchase-order receipts even in principle.

The ruling is that this provenance is NOT REQUIRED for native-receipt
correctness. What is known is preserved as an accepted invariant in
`ordem_compra_cutover`: `inventory_baseline_count`, `inventory_baseline_total_kg`
and `inventory_baseline_hash`, with a per-row serialization.

NO SYNTHETIC PURCHASE RECEIPT, ORDER, OP, ALLOCATION OR ADJUSTMENT HISTORY MAY
EVER BE INVENTED TO EXPLAIN THESE BALANCES.

### §R.33.2 `saldo_fios` IS NOT AN AVAILABILITY AUTHORITY — BINDING BOUNDARY

`public.saldo_fios` is a multi-origin cache of free material. It is NOT an
availability authority, and no current or future code may use its aggregate
historical-plus-native-surplus balance as OP material availability WITHOUT A NEW
EXPLICIT ARCHITECT DECISION and an explicit migration or product order.

OP material availability continues to derive from the canonical native
need/allocation/ledger authority: `_oc_disponibilidade_linhas`,
`_oc_material_recebido_liquido` and `oc_disponibilidade_op`. None of them reads
`saldo_fios`, and no view, materialized view or front-end consumer reads it
either.

### §R.33.3 Forward-only provenance boundary

PRE-PONR. The historical `saldo_fios` balances are preserved EXACTLY as
historical state. Their causal provenance is UNKNOWN / UNRECOVERABLE and stays
that way.

POST-PONR. Every native receipt kilogram is represented by the canonical native
receipt and ledger model. Allocation-bearing kilograms carry the real
allocation / need / OP relationship; surplus kilograms carry NO fabricated
allocation and NO fabricated OP. `saldo_fios` may receive the native surplus
delta through its accepted trigger `trg_native_lancamento_derive_state`, under
the boundary of §R.33.2.

The two sets are STRUCTURALLY DISJOINT, and the disjointness is enforced by a
database constraint rather than by convention. `ordem_compra_fio_lancamentos_native_shape`
admits exactly two shapes for a native line — `ordem_compra_item_alocacao_id IS
NOT NULL AND kg_excesso = 0`, or `ordem_compra_item_alocacao_id IS NULL AND
op_id IS NULL AND kg_excesso = kg_recebido` — the availability ceiling reads only
the first, and `saldo_fios` receives only the second. Direct mutation of
`saldo_fios` outside that nested trigger path is refused by
`trg_c3c_protected_mutation_guard` with SQLSTATE `55000` while the cutover is
`canonical_active`.

### §R.33.4 `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` — RESOLVED BY EXECUTABLE FACT

- Native `algodao` with an OP-origin allocation is SUPPORTED.
- Native `poliester` with a Pedido-origin allocation is SUPPORTED.
- Receipt identity is LINE AND ALLOCATION BASED, never one OP per order:
  `p_linhas` carries one line per `(item_id, destino, alocacao_id)` and `op_id`
  is derived per line from that line's allocation.
- Multiple allocations are represented as INDEPENDENT RECEIPT LINES, subject to
  the existing allocation and item invariants (`excede_alocacao` per allocation,
  `excede_item` for the allocated total against `kg_pedido`).
- Surplus REQUIRES NO OP.
- Representative-OP fabrication is FORBIDDEN, and the `native_shape` constraint
  makes it structurally impossible on a surplus line.
- Flat compatibility is NOT REQUIRED for native P6.
- Native and flat receipt parentage remain STRUCTURALLY EXCLUSIVE
  (`ordem_compra_fio_lancamentos_um_pai_apenas`, and `ordem_compra_fio_id IS
  NULL` on every native line).

The origin classes are determined by material rather than chosen:
`necessidade_material_origem` requires native `algodao` to be OP-origin and
native `poliester` to be Pedido-origin.

THIS RULING COVERS THE ACCEPTED NATIVE MODEL AND THE ORIGIN TOPOLOGY IT
STRUCTURALLY REPRESENTS. It does NOT state that every hypothetical future
purchase-order architecture is supported.

### §R.33.5 Outside the current native model

One purchase shared across MULTIPLE Pedidos is outside the current native model:
`ordem_compra` carries a single `pedido_id` and the receipt command scopes
allocation provenance to it. No production instance exists and no business
requirement was established. A future requirement needs a separate product and
architecture decision; it is NOT a receipt defect and it does NOT justify a
representative OP.

### §R.33.6 Supervisor acceptance and P6 state

Both blockers are CLOSED and removed from the OPEN blocking debt set, with their
historical existence preserved in `docs/governance/current-state.json` and in
`docs/ledgers/G28_LEDGER.md`. Two nonblocking debts were opened by supervisor
classification: `NATIVE-RECEIPT-SALDO-FIOS-DIRECT-GRANT-DEFENSE-IN-DEPTH-GAP`
and `NATIVE-OC-PEDIDO-ID-NULLABILITY-ENFORCEMENT-GAP`. No grant, constraint,
trigger, migration, product or test file was changed by the ruling.

P6 TECHNICAL READINESS IS READY. P6 EXECUTION IS NOT AUTHORIZED BY THIS RULING:
it remains a separately authorized real-business event whose Purchase Order,
material/item/allocation destination, received quantity and document or origin
reference must be supplied by Kleber from a genuine business receipt. A
supervisor or executor must not choose them. THE PONR IS NOT CROSSED
(`productive_receipt_started_at IS NULL`), and `db/110` remains ABSENT and NOT
AUTHORIZED.
