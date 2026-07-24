# Manta Direct Route — PHASE-MANTA-B2 Activation Contract

STATUS: PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1 CLOSED / ACCEPTED / DOCUMENTED.
This document is the binding implementation contract for PHASE-MANTA-B2. It
authorizes nothing by itself: PHASE-MANTA-B2A, B2B and B2C each require a
separate explicit order and no phase chains automatically.

Order: `PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1` (read-only architectural
reconciliation; documentation-only).
Predecessors: `MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` (PHASE-MANTA-A, product
identity, db/78–db/80) and `MANTA_DIRECT_ROUTE_PHASE_CONTRACT.md`
(PHASE-MANTA-B1, dormant expedition-source foundation, db/81–db/84, applied and
live-verified on shared development `ucrjtfswnfdlxwtmxnoo`).

This contract owns the **activation semantics** of the Manta direct route. It
does not restate B1's guard semantics; §13 of the predecessor contract remains
the owner of the deployed guard behavior, and `PEDIDO_OP_SCHEMA_CONTRACT.md`
remains the owner of schema shapes.

## 1. Binding product routes

- **TAPETE**: Insumos → Tecelagem → **Acabamento** → Expedição → Entrega
  (expedition source `expedicoes.op_latex_id`).
- **MANTA**: Insumos → Tecelagem → Expedição → Entrega
  (expedition source `expedicoes.op_tecelagem_id`; **no Acabamento**).

Carried forward from the accepted canon and treated as binding here:
`modelos.tipo_produto` is the sole owner of Tapete/Manta identity; Manta width
is 1.40; a Pedido may be mixed; every OP is route-homogeneous (DB-enforced);
Manta never enters finishing; Manta output authority is measured weaving
delivery (`entregas.etapa='cima'` + non-defect `entrega_itens.metros_entregues`);
planned OP quantity is never expedition authority; exactly one expedition source
is mandatory; source, route, item identity and commercial lineage are immutable;
positive expedition consumption freezes the measured source under the normal
flow; no direct source replacement is permitted; entities live on dedicated
screens; transition modals contain actions only.

## 2. Reconciliation of current implementation owners

Established by direct repository and live shared-development reading. "Route
assumption" records the Latex/Tapete-specific premise each owner carries today.

| Owner | Location | Input authority | Locks | Quantity source | Idempotency | Partial | Reversal | Events | UI caller | Route assumption |
|---|---|---|---|---|---|---|---|---|---|---|
| `salvarEntregaCima` | `js/screens/entrega-writes.js:215` | client payload | none | operator-typed `metros_entregues` | none | n/a | compensating `DELETE` of the header only | none | `op-tecelagem-producao-admin.js:401`, `pedido-detail-events.js:1423`, `fornecedor.js:216` | **hard**: rejects a payload without `destino_fornecedor_id`; always calls `gerar_op_latex`/`_split` |
| Delivery header/item persistence | same file, three separate PostgREST round-trips | direct table INSERT under RLS | none | payload | none | n/a | manual `delete` on item failure | none | as above | none, but non-atomic |
| `entregas_destino_cima_chk` | `db/23`-era constraint, live-verified unchanged: `CHECK ((etapa <> 'cima') OR (destino_fornecedor_id IS NOT NULL))` | table CHECK | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **hard**: every `cima` delivery must name a finishing supplier |
| Weaving OP completion | `alterar_status_op` (`db/21`) + `ops_manta_reopen_guard` (`db/81`) | RPC, admin-only | target row | n/a | none | n/a | reopening blocked while consumed | `op_eventos` via `trg_op_evento` | `op-tecelagem-producao-admin.js:228` | route-neutral |
| `liberar_expedicao` | `db/23:177` | RPC, admin-only | none | **planned** `COALESCE(metros_ajustados, metros_pedidos)` | `ON CONFLICT` overwrite | no (terminal, total) | none | none | `op-latex-admin.js:375`, `pedido-detail-events.js:1475` | **hard**: `ops.tipo='latex'` only |
| `liberar_expedicao_latex_parcial` | `db/31:164`, **redefined by `db/32:201`** | RPC, admin-only | source `ops` FOR UPDATE → `op_itens` → `entrega_itens` → `expedicoes` → `expedicao_itens` | measured `cima` received via `op_latex_entregas`, matched **by `modelo_id`**, minus already released | none (additive `ON CONFLICT DO UPDATE … + EXCLUDED`) | yes, additive | none | none | `op-latex-admin.js:395`, `pedido-detail-events.js:1549` | **hard**: `ops.tipo='latex'`, `op_latex_id` lookup |
| "`registrar_movimentacao_direta_expedicao`" | **does not exist** under that name | — | — | — | — | — | — | — | — | the direct-movement writer named by the order is the `db/32` redefinition of `liberar_expedicao_latex_parcial` (see §12 risk R-1) |
| `registrar_entrega_expedicao` | `db/23:269` | RPC, admin-only | `expedicao_itens` row FOR UPDATE per item | `metros_entregues` per expedition item, capped by `metros_liberados` | none | yes | none | none | `expedicao-admin.js:340`, `pedido-detail-events.js:1629` | route-neutral (operates on `expedicao_itens`) |
| Expedition status recalculation | `recalcular_status_expedicao` (`db/23:135`) | derived | none | `SUM(metros_liberados)` vs `SUM(metros_entregues)` | n/a | n/a | n/a | none | via the writers | route-neutral |
| OP status derivation | `ops.status` (stored) + `db/21` transition machine | stored | target row | n/a | n/a | n/a | n/a | `op_eventos` | several | route-neutral |
| Pedido completion | `concluir_pedido_se_pronto` (`db/23:373`) | RPC, admin-only | none | pendency counters | none | n/a | none | `pedido_eventos` | `expedicao-admin.js:403`, `pedido-detail-events.js:246` | **hard and defective**: the "terminal source OP without expedition" check counts only `o.tipo='latex'` joined on `e.op_latex_id` (see §12 risk R-2) |
| Pedido administrative summary / stepper | `js/screens/pedido-detail-progress.js` (`stageKeyForOp` at :16, `liberadoByLatexOp` at :187, fixed 5-stage `stepper` at :571) | derived from loaded rows | n/a | quantity-derived per OP | n/a | n/a | n/a | n/a | `pedido-detail.js` | **hard**: `op.tipo === 'latex' ? 'acabamento' : 'tecelagem'`; expedition attributed only through `op_latex_id` |
| Pedido chain state | `js/screens/pedido-chain-state.js` (`stageKeyForOp` at :60, `liberadoByLatexOp` at :112/:221, fixed `adminStepper` at :353, fixed `CLIENT_STEPS` at :22) | derived | n/a | quantity-derived | n/a | n/a | n/a | n/a | Pedido surfaces | **hard**: same two assumptions; `Acabamento` is an unconditional step |
| Client-facing Pedido summary | `cliente_pedido_summary` (`db/30:16`) | RPC | none | mixed: quantity-derived plus `pedidos.status_cliente_visual` | n/a | n/a | n/a | n/a | `cliente-pedido-detail.js:180` | **hard**: `CASE WHEN t.tipo='latex' THEN 'latex' ELSE 'cima'` and an unconditional `acabamento` etapa row |
| Client tracking steps | `js/pedido-tracking-ui.js:14` | published `status_cliente_visual` / parciais | n/a | published metres | n/a | n/a | n/a | n/a | `cliente-pedido-tracking.js` | **hard**: `CLIENTE_TRACKING_STEPS` always contains `acabamento` |
| Expedition screen | `js/screens/expedicao-admin.js` | reads | n/a | `expedicao_itens` sums | n/a | n/a | n/a | n/a | route `#/expedicoes/:id` (`js/router.js:69`) | **hard**: selects/embeds `op_latex_id` only; "Ver OP" navigates to `#/ops/<op_latex_id>` |
| Event/audit writers | `trg_op_evento` (`db/21:110`), `op_eventos` inserts in `db/29`/`db/33`, `pedido_eventos` in `db/23:472` | triggers/RPCs | n/a | n/a | n/a | n/a | n/a | — | — | route-neutral |
| Grants / RLS / RPC authorization | `db/23` RLS (admin-only `FOR ALL` on all four expedition tables); every expedition RPC `SECURITY DEFINER`, `search_path=public`, `is_admin()` gate, `EXECUTE` to `authenticated` | — | — | — | — | — | — | — | — | route-neutral |

**Accepted idempotency canon.** `PEDIDO_OP_SCHEMA_CONTRACT.md` §13.2 owns the
repository's only accepted replay contract (namespaced command table, unique
`(namespace, actor, key)`, JSONB request equality decides conflict, stored
result replayed byte-for-byte, no FK to business rows). No expedition writer
uses it today.

**Accepted mandatory-reason precedent.** `estornar_recebimento_ordem_compra`
(`db/70`) rejects a NULL or blank `p_motivo` and persists `btrim(p_motivo)` into
the audit record. Normal (non-reversing) writers take an optional
`p_observacao`.

## 3. B2-1 — Route-conditional weaving delivery (binding design)

**Ruling: a frontend-only conditional is rejected. Manta `cima` delivery moves
to an authoritative RPC. The Tapete `cima` path is not modified.**

Reason `entregas_destino_cima_chk` cannot simply be made conditional: it is a
row CHECK on `public.entregas`, and the route is only derivable from
`entrega_itens.op_id → op_itens → modelos.tipo_produto`. At header-INSERT time
no item exists, so no header-level CHECK or BEFORE-INSERT trigger can decide the
route. The invariant must therefore be enforced where the route first becomes
knowable — the item write — and the write must be atomic.

**Binding design.**

1. **Constraint evolution.** `entregas_destino_cima_chk` is dropped and replaced
   by a route-aware guard pair. It is not weakened in place, because the
   surviving requirement for Tapete is strictly stronger than the old CHECK (it
   must also reject a *Manta* `cima` that carries a destination).
2. **`entrega_itens_cima_route_destino_guard`** (BEFORE INSERT, and BEFORE
   UPDATE of `op_id`/`op_item_id`, on `public.entrega_itens`; `SECURITY
   DEFINER`, `SET search_path = public`). When the parent `entregas.etapa` is
   `'cima'`: lock the item's `ops` row FOR UPDATE, resolve the OP's product type
   strictly through `op_itens → modelos.tipo_produto` (never a name), then
   require `destino_fornecedor_id IS NOT NULL` for `tapete` and
   `destino_fornecedor_id IS NULL` for `manta`. A mixed or empty OP is rejected
   (db/78–db/80 already make it unreachable). No `app.retificacao_autorizada`
   bypass.
3. **`entregas_cima_destino_route_guard`** (BEFORE UPDATE of
   `destino_fornecedor_id`/`etapa` on `public.entregas`): re-derive the route
   from the delivery's existing items under the same lock order and re-apply the
   same rule, so a destination cannot be added to or removed from an existing
   `cima` delivery in violation of its route.
4. **`registrar_entrega_cima_manta(p_op_id BIGINT, p_fornecedor_id BIGINT,
   p_data DATE, p_itens JSONB, p_observacao TEXT DEFAULT NULL)`** — new
   admin-only `SECURITY DEFINER` RPC, the **only** Manta `cima` writer. It locks
   the weaving OP FOR UPDATE, proves `ops.tipo='tecelagem'` and full Manta
   homogeneity, inserts the `entregas` header with `etapa='cima'` and
   `destino_fornecedor_id = NULL`, inserts every `entrega_itens` row against the
   OP's own `op_itens` (each carrying `op_id` and `op_item_id`, `defeito` and
   `metros_entregues` from the payload), **never** calls `gerar_op_latex` /
   `gerar_op_latex_split`, and returns the resulting per-item measured totals.
   Header, items, route, destination and lineage commit or fail together.
5. **Tapete is untouched.** `salvarEntregaCima`, `gerar_op_latex`,
   `gerar_op_latex_split`, `op_latex_entregas` and the Latex expedition path keep
   their exact current behavior. The new guards leave the Tapete path passing
   unchanged, so the guards — not the writer — are what make the invariant
   writer-agnostic.

**Residual, explicitly accepted.** A `cima` header with zero items escapes the
route rule. It is semantically inert: no measured output exists, so it grants no
expedition eligibility and reaches no balance. Closing it would require a
deferred constraint trigger; that cost is not justified and is recorded here
rather than silently ignored.

**Deferred, explicitly named.** Revoking direct `INSERT`/`UPDATE` on
`public.entregas` / `public.entrega_itens` from `authenticated` (so that *all*
delivery writes pass an RPC) is **not** part of PHASE-MANTA-B2: it would also
remove the Tapete and `etapa='latex'` writers' access and requires its own
order. This contract does not broaden any table grant.

## 4. B2-2 — Manta expedition writer (binding contract)

**Final names and signatures.**

```
public.consultar_saldo_expedicao_manta(p_op_tecelagem_id BIGINT)
  RETURNS JSONB
public.liberar_expedicao_manta_parcial(p_op_tecelagem_id  BIGINT,
                                       p_itens            JSONB,
                                       p_observacao       TEXT DEFAULT NULL,
                                       p_idempotency_key  TEXT DEFAULT NULL)
  RETURNS JSONB
```

The provisional name is retained; `_parcial` is kept for exact symmetry with the
accepted `liberar_expedicao_latex_parcial`, and partial release is the normal
case, not an exception. Both are `SECURITY DEFINER`, `SET search_path = public`,
`is_admin()`-gated.

**Semantics.**

- **Source.** `p_op_tecelagem_id` must be an existing `ops.tipo='tecelagem'` OP,
  non-empty, every `op_item` resolving to `modelos.tipo_produto='manta'`, with
  the exact `OP → lotes → pedidos` lineage required by db/84. Payload
  `pedido_id`/`lote_id`/`cliente_id` are **derived**, never accepted from the
  client.
- **Availability.** For each `op_item`:
  `disponivel = ROUND(GREATEST(recebido - liberado, 0), 2)` where
  `recebido = SUM(entrega_itens.metros_entregues)` over `entregas.etapa='cima'`
  rows with `entrega_itens.op_id = p_op_tecelagem_id`,
  `entrega_itens.op_item_id = op_itens.id`, `COALESCE(defeito,FALSE)=FALSE`, and
  `liberado = SUM(expedicao_itens.metros_liberados)` over the expedition whose
  `op_tecelagem_id = p_op_tecelagem_id`. Unlike the Latex path, the Manta join
  is **`op_item_id`-exact** and never falls back to `modelo_id`, because Manta
  `cima` items are written against the weaving OP's own items.
  `COALESCE(metros_ajustados, metros_pedidos)` is returned as `previsto` for
  display only and is **never** an authority.
- **Quantities.** Explicit positive `{op_item_id, metros}` entries, summed per
  `op_item_id`, each rejected when `NULL`, `<= 0`, not a member of the source
  OP, or greater than that item's availability. Overconsumption returns a
  controlled failure, never a partial write.
- **Expedition.** The unique expedition for the OP is created if absent
  (`op_tecelagem_id` set, `op_latex_id` NULL, status `aguardando_expedicao`) or
  reused; `expedicao_itens` are upserted additively on
  `(expedicao_id, op_item_id)` with `metros_liberados = existing + requested`,
  `modelo_id`/`pedido_item_id` copied verbatim from the referenced `op_item` so
  db/83's identity-alignment guard passes by construction. No identity drift is
  possible: db/82 makes the source immutable and db/83 makes a referenced
  op_item's identity immutable.
- **Repeatability.** Additive re-release is the normal flow; there is no
  terminal-status gate (parity with db/32).
- **Return.** `{ok, expedicao_id, created, pedido_id, op_tecelagem_id,
  liberado_total, saldo_restante, itens:[{op_item_id, modelo_id,
  pedido_item_id, previsto, recebido, liberado_antes, liberar, liberado_depois,
  saldo_restante, expedicao_item_id, created}]}` — explicit before/after
  balances per item.
- **Errors.** Deterministic stable identifiers in the `db/23`/`db/31`/`db/32`
  shape (`{ok:false, erro:<stable text>, …context}`), not raw `SQLERRM` leakage
  for the validation branches.
- **No bypass.** RLS on `expedicoes`/`expedicao_itens` stays admin-only
  `FOR ALL`, and the db/81–84 guards already reject any direct write that
  violates source, membership, identity or lineage. A direct table writer
  therefore cannot reach a state this RPC would refuse, except for the balance
  rule itself, which remains the RPC's own responsibility exactly as it already
  is for the Latex path.

**Idempotency (exact behavior).** New table
`public.expedicao_comandos`, modelled byte-for-byte on the accepted §13.2
contract: `idempotency_namespace TEXT NOT NULL CHECK (… IN
('manta_release_v1','manta_reversal_v1'))`, `ator_id UUID NOT NULL REFERENCES
auth.users(id) ON DELETE RESTRICT`, `idempotency_key TEXT NOT NULL` (trimmed,
1–200), `comando_payload JSONB NOT NULL` (normalized request),
`comando_hash TEXT NOT NULL`, `resultado JSONB NOT NULL`, `criado_em`, unique
`(idempotency_namespace, ator_id, idempotency_key)`, RLS admin-only, no client
DML, immutable after insert, no FK to expedition rows, permanent retention.

| Submission | Result |
|---|---|
| `p_idempotency_key` NULL | Legacy additive behavior; no command row. Retained so the writer stays callable without a key. |
| same actor/key/normalized request | Stored `resultado` returned byte-for-byte; **zero** business mutation. |
| same actor/key, different request | `{ok:false, erro:'idempotencia_conflitante'}`; zero mutation. |
| new key, same target | Accepted as a new additive release. |
| failed validation | No command row is written; a retry revalidates live state. |

The command row is inserted inside the same transaction as the release, after
validation and before return, so a committed release always has its replay
record and a rolled-back one has none.

## 5. B2-3 — Correction and reversal (binding design)

**Selected: design A — one atomic reversal RPC plus the existing delivery
correction flow.** Designs B and C are rejected.

*Why A is sufficient and minimal.* Every db/81 consumption guard is conditioned
on a Manta-sourced expedition with `metros_liberados > 0` referencing the
`op_item`. They are **inert at zero consumption by their own existing
condition**. Therefore, once a release is fully reversed, the pre-existing
delivery correction path and `alterar_status_op` reopening become legal again
with **no guard relaxation, no schema change to db/81–84, and no
`app.retificacao_autorizada` granted to any authenticated writer**. The escape
stays exactly where B1 left it.

*Why B is rejected.* A combined expedition-and-output correction RPC would have
to re-implement delivery header/item validation inside the expedition writer,
creating a second delivery authority beside `salvarEntregaCima` /
`registrar_entrega_cima_manta` — a duplicated owner, forbidden by the one-fact-
one-owner rule.

*Why C is rejected.* A separate retification RPC plus a shared invariant layer
adds a third writer and a new abstraction to enforce invariants that db/81–84
already enforce authoritatively at the trigger level. It is strictly more
surface for no additional guarantee.

**`estornar_expedicao_manta_parcial(p_expedicao_id BIGINT, p_itens JSONB,
p_motivo TEXT, p_idempotency_key TEXT DEFAULT NULL) RETURNS JSONB`** —
admin-only, `SECURITY DEFINER`, `SET search_path = public`.

- `p_motivo` is **mandatory** (rejects NULL/blank; persists `btrim(p_motivo)`),
  following the accepted `estornar_recebimento_ordem_compra` precedent.
  `p_observacao` on the release writers stays optional.
- Locks the source `ops` row FOR UPDATE first, then the expedition, then the
  affected `expedicao_itens` rows ascending by id.
- Reduces `metros_liberados` by the requested positive amount per item.
- **Cannot reverse below delivered**: rejects when
  `metros_liberados - requested < metros_entregues`. This is additionally
  guaranteed at the storage level by the pre-existing
  `CHECK (metros_entregues <= metros_liberados)`, so the rule fails closed even
  against a direct writer.
- **Cannot produce a negative balance**: rejects `requested > metros_liberados`.
- An item reaching exactly zero is **deleted** (the pre-existing
  `CHECK (metros_liberados > 0)` forbids a zero row). Deleting the last item
  leaves the expedition header in place: its identity, source and lineage are
  immutable and one-per-OP, so the header must survive for future additive
  releases. `recalcular_status_expedicao` then returns `aguardando_expedicao`.
- Never deletes `expedicao_movimentos` / `expedicao_movimento_itens`: delivery
  history is append-only and is what makes `metros_entregues` the floor.
- **Partial graph correction is prevented** by atomicity: quantity reduction,
  zero-row deletion, status recalculation, event and audit writes happen in one
  transaction, or none do.
- **Output correction after release** is therefore: reverse the consumption for
  the affected `op_item` down to zero → the db/81 `entrega_itens` /`entregas`
  consumption guards go inert → correct the measured output through the existing
  delivery correction flow → re-release. Correcting output while a positive
  release remains is **refused**, not silently permitted.
- **OP reopening** requires all dependent consumption for that OP to be reversed
  to zero first; `ops_manta_reopen_guard` enforces this unchanged.
- **History preservation**: reversal appends `op_eventos` and never edits or
  removes any prior event.
- No silent `DELETE` or direct `UPDATE` escape is selected anywhere in this
  design.

## 6. B2-4 — Route-aware progress and completion (binding)

**Route derivation.** A route is resolved **only** from
`modelos.tipo_produto` through `op_itens.modelo_id`, per OP. Every OP is
DB-guaranteed route-homogeneous, so the derivation is total and unambiguous;
`window.RAVATEX_OP_DISPLAY.deriveProductType` (`js/op-display.js:174`) is the
existing accepted client-side helper and must be reused rather than duplicated.
`ops.tipo` (`tecelagem`/`latex`) identifies the **production stage**, never the
product route; the two must never be conflated again.

**Source of truth for every displayed state.**

| Displayed state | Authoritative source | Not to be used |
|---|---|---|
| Route of an OP / of a Pedido section | `modelos.tipo_produto` via `op_itens` | `ops.tipo`, model name |
| Weaving progress (both routes) | non-defect `entrega_itens.metros_entregues` on `entregas.etapa='cima'` for that OP | `ops.status` |
| Finishing progress (Tapete only) | measured `cima` received via `op_latex_entregas`, minus released | planned `op_itens` metres |
| Expedition released | `SUM(expedicao_itens.metros_liberados)` for that expedition | planned metres, `ops.status` |
| Expedition delivered | `SUM(expedicao_itens.metros_entregues)` | `pedidos.status_cliente_visual` |
| Expedition state | `expedicoes.status` as written by `recalcular_status_expedicao` | any client-side recomputation |
| OP formal terminality | `ops.status` | derived quantity |
| Pedido completion | `pedidos.status='entregue'` written only by `concluir_pedido_se_pronto` | any client-side derivation |
| Client-facing step **shape** | derived route (which steps exist) | a fixed step list |
| Client-facing step **position** | published `status_cliente_visual` / parciais | — |

The last two rows are the precise boundary demanded by the "no manually
maintained duplicated status" rule: the *set of applicable steps* is a hard
product fact owned by `modelos.tipo_produto` and must be derived; the *published
position and message* remain the intentionally curated commercial artefact that
`db/30` and `js/pedido-tracking-ui.js` already own.

**MANTA-ONLY Pedido.** No `Acabamento` step exists at any surface. Expedition
progress = released / measured weaving output. Delivery progress =
`metros_entregues` / `metros_liberados`. A Manta weaving OP that is terminal
with unreleased measured output is "pronto para expedição", never "aguardando
acabamento".

**TAPETE-ONLY Pedido.** Behavior unchanged.

**MIXED Pedido.** The two routes are aggregated and rendered independently.
Manta may reach Expedição while Tapete is still in Acabamento; neither may
advance nor block the other. The Pedido completes only when **every** applicable
route is complete.

**Completion correction (mandatory in B2A).** `concluir_pedido_se_pronto` must
be forward-corrected: its `v_latex_sem_exp` check joins only
`o.tipo='latex'` on `e.op_latex_id`, so a Manta-only Pedido whose weaving OP is
terminal and which has **no expedition at all** currently satisfies every
pendency and would be marked `entregue`. The corrected rule is route-symmetric:
*for each terminal source OP of the Pedido — a `latex` OP for the Tapete route
or a Manta `tecelagem` OP for the Manta route — an expedition must exist through
the matching source column, and every expedition of the Pedido must be
`concluida`.* Additionally, a Manta weaving OP with unreleased non-defect
measured output is a pendency. Tapete pendency texts and behavior are preserved
verbatim.

## 7. B2-5 — UI contract (binding)

**Selected mixed-Pedido presentation: route sections.** Homogeneous OP cards and
"summary plus route detail" are rejected as the primary structure.

*Why route sections is canonical.* The binding product contract defines exactly
two routes; `modelos.tipo_produto` is their sole owner; and every OP is
DB-guaranteed route-homogeneous, so each OP maps to exactly one section with no
derivation ambiguity. Decisively, **a per-OP card structurally cannot represent
the Tapete route**, which spans two OPs (`tecelagem` → `latex`): only a
route-scoped section can carry a complete stepper. Section granularity therefore
matches the granularity of the invariant the database actually enforces. A
homogeneous Pedido degenerates to exactly one section, which is today's view —
so no Tapete-only surface changes shape. The compact Pedido summary required
below supplies the roll-up that the third option would have added.

1. **Pedido detail** — a compact Pedido summary (commercial identity, total
   metres, delivered, remaining, formal status) above one **route section** per
   applicable route. Each section owns its own stepper: Tapete
   `Insumos → Tecelagem → Acabamento → Expedição → Entrega`; Manta
   `Insumos → Tecelagem → Expedição → Entrega`. No fixed global stepper may
   survive: `pedido-chain-state.js:353` (`adminStepper`) and
   `pedido-detail-progress.js:571` (`stepper`) become per-section and must stop
   emitting an `acabamento` stage for a Manta section.
2. **Manta weaving OP screen** — records measured output through
   `registrar_entrega_cima_manta` (no finishing-destination selector), shows
   measured / released / available per item, and navigates to **its dedicated
   expedition screen**. It must expose no finishing action and must not call
   `gerar_op_latex` / `gerar_op_latex_split`.
3. **Expedition** — the existing dedicated entity screen at `#/expedicoes/:id`
   is extended, not duplicated: it must select and render **both** source
   columns, display the source type explicitly ("Origem: Tecelagem (Manta)" /
   "Origem: Acabamento (Tapete)"), navigate "Ver OP" to whichever source is
   present (`expedicao-admin.js:202`/`:232` currently hard-code `op_latex_id`
   and would produce `#/ops/null` for a Manta expedition), and show
   **available / released / delivered / remaining** per item. It gains the
   partial release action for a Manta source and the controlled reversal action
   when eligible (`metros_liberados > metros_entregues`).
4. **Client-facing tracking** — the step list is built from the Pedido's derived
   routes: Manta omits `Acabamento`, Tapete retains it, a mixed Pedido presents
   its two applicable routes separately. `CLIENTE_TRACKING_STEPS`
   (`js/pedido-tracking-ui.js:14`) and the `cliente_pedido_summary` etapa
   builder (`db/30`) must both become route-derived; they are two views of one
   fact and must not diverge.
5. **Modals** — actions only. Release and reversal are confirmation/quantity
   modals launched from the expedition screen; recording measured output is a
   form on the OP screen. No expedition, delivery or other entity may be
   embedded as a full modal.

Structural policy: every new or materially changed file is subject to
`docs/architecture/CODE_HEALTH_RULES.md` §6 (ideal ≤250, acceptable ≤500,
exceptional ≤900 lines with justification; writes confined to explicit write
modules). `pedido-detail-progress.js` (988 lines) and
`pedido-detail-events.js` (2709 lines) are already over the exceptional limit;
B2B must not enlarge them — route-section derivation belongs in a new cohesive
module reusing `pedido-chain-state.js`.

## 8. B2-6 — Authorization, RLS and audit (binding)

| Action | Who | Boundary |
|---|---|---|
| Record Manta weaving output | admin | `registrar_entrega_cima_manta`, `is_admin()` gate |
| Release Manta expedition | admin | `liberar_expedicao_manta_parcial`, `is_admin()` gate |
| Reverse a release | admin | `estornar_expedicao_manta_parcial`, `is_admin()` gate, mandatory `p_motivo` |
| Record final client delivery | admin | `registrar_entrega_expedicao` (existing, unchanged) |
| Read Manta balances | admin | `consultar_saldo_expedicao_manta`, `is_admin()` gate |

- **Grants.** `GRANT EXECUTE … TO authenticated` for each new RPC, plus
  `REVOKE EXECUTE … FROM PUBLIC, anon` on the **new** functions only. This is
  strictly narrower than the existing Latex RPCs (which retain the default
  PUBLIC `EXECUTE` behind their `is_admin()` gate) and alters none of them. No
  table grant is broadened anywhere; no new direct table write is introduced.
- **RLS.** Unchanged for `expedicoes`, `expedicao_itens`,
  `expedicao_movimentos`, `expedicao_movimento_itens` (admin-only `FOR ALL`),
  `entregas` and `entrega_itens`. The new `expedicao_comandos` table is created
  with RLS enabled, admin-only, and no client DML path.
- **Events** (`public.op_eventos`, `op_id` = the Manta weaving OP; existing
  free-form `tipo_evento`, no CHECK to extend):

| `tipo_evento` | When | Payload |
|---|---|---|
| `manta_saida_registrada` | measured `cima` output recorded | `{entrega_id, itens:[{op_item_id, metros_entregues, defeito}], total}` |
| `expedicao_manta_liberada` | positive release committed | `{expedicao_id, itens:[{op_item_id, liberar, liberado_depois, saldo_restante}], liberado_total, observacao, idempotency_key}` |
| `expedicao_manta_estornada` | reversal committed | `{expedicao_id, itens:[{op_item_id, estornar, liberado_depois, entregue}], estornado_total, motivo, idempotency_key}` |

  `criado_por = auth.uid()` on every row. `status_alterado` continues to be
  emitted by the pre-existing `trg_op_evento` and is not duplicated.
- **Audit fields for reversal/retification.** `motivo` (mandatory, trimmed),
  `criado_por`, `criado_em`, the exact before/after balance per item, and the
  `idempotency_key` when supplied — all inside the `op_eventos` payload, plus
  the immutable `expedicao_comandos` row. Nothing is stored in a mutable
  business column.

## 9. B2-7 — Concurrency contract (binding)

**Global deterministic lock order** (extends db/81 §4 / db/84 without reversing
any existing path):

1. `pedidos` row FOR UPDATE — **only** in Pedido completion, which acquires
   nothing else;
2. affected `public.ops` rows, ascending `op_id`, FOR UPDATE;
3. source `lotes` row FOR SHARE, then source `pedidos` row FOR SHARE (db/84
   lineage validation, INSERT path only);
4. affected `public.modelos` rows, ascending `modelo_id`, FOR SHARE;
5. `entregas` / `entrega_itens`;
6. `expedicoes`;
7. `expedicao_itens`, ascending `id`.

Per operation: delivery recording 2→5; expedition release 2→3→5→6→7; expedition
reversal 2→6→7; output correction 2→5; OP reopening 2 only; final client
delivery 7 only; Pedido completion 1 only, with every chain read unlocked.

**Required proofs.**

- *Two releases cannot overconsume* — both serialize on the source `ops` row
  taken FOR UPDATE before any balance is read; the loser recomputes
  availability post-lock and is rejected.
- *Release vs output correction cannot split balances* — the correction path
  locks the same `ops` row (step 2) before touching `entrega_itens`; the
  consumption guards then evaluate against committed release rows.
- *Release vs reversal cannot corrupt totals* — both take the source `ops` row
  first, so they strictly serialize; the second recomputes from committed state.
- *Reversal vs client delivery cannot reduce below delivered* — reversal locks
  the `expedicao_itens` rows FOR UPDATE and re-reads `metros_entregues`
  post-lock; `registrar_entrega_expedicao` locks the same rows; the storage
  CHECK is the final backstop.
- *Duplicate submission is deterministic* — the unique
  `(namespace, actor, key)` index turns a concurrent duplicate into a single
  winner; the loser replays the stored result.
- *Different Manta OPs do not serialize* — no shared row is taken; independent
  OP/Lote/Pedido chains are fully parallel (db/84 test R already proves the
  shape).
- *No `40P01`* — Pedido completion holds exactly one resource and requests no
  second; every multi-resource path follows the single ascending order above, so
  no cycle can form.

## 10. B2-8 — Implementation phasing

### PHASE-MANTA-B2A — BACKEND ACTIVATION

- **Objective.** Make the Manta route callable and correctable at the database
  level, with no product UI activation.
- **Authorized file categories.** `db/*.sql` (new migrations only; forward-only,
  never editing db/01–db/84), `tests/*.sql`, `tests/*.mjs`,
  `tests/ordem-compra-c3d-deploy.smoke.js` (terminal bump only), and the
  affected documentation owners. **No** `js/**`, **no** `index.html`.
- **Migration count: exactly 3.**
  - `db/85_manta_cima_route_conditional_delivery.sql` — §3.
  - `db/86_manta_expedition_release_writer.sql` — §4 (including
    `public.expedicao_comandos`).
  - `db/87_manta_expedition_reversal_and_route_completion.sql` — §5 and the §6
    `concluir_pedido_se_pronto` correction.
- **Environment boundary.** Local disposable PostgreSQL only. **No**
  shared-development, staging or production apply.
- **Test contract.** See §11.
- **Acceptance gate.** Every migration idempotent with zero drift on re-apply;
  full db/01..87 apply green; every db/78–84 regression green; Tapete
  expedition/delivery RPC signatures, bodies and grants unchanged except the
  named `concluir_pedido_se_pronto` correction; `entregas_destino_cima_chk`
  replaced exactly as specified; distinct-session concurrency proofs green with
  no `40P01`; the deploy smoke terminal bumped in the same commit as each
  migration.
- **Hard stops.** Any need to edit db/01–db/84; any need to relax a db/81–84
  guard; any required `app.retificacao_autorizada` grant to an authenticated
  writer; any discovered schema change outside the three migrations; any
  environment access.
- **Next action.** Architect review, then a separate B2B order.

### PHASE-MANTA-B2B — ROUTE-AWARE UI AND READ MODELS

- **Objective.** Activate the route in the product surfaces.
- **Authorized file categories.** `js/**`, `css/**`, `index.html` (script tags /
  cache-busting), `tests/*.smoke.js`, and the affected documentation owners.
  **No** `db/**`.
- **Migration count: 0.** Discovering a required schema change is a hard stop.
- **Environment boundary.** Local only.
- **Test contract.** See §11.
- **Acceptance gate.** Manta output action, direct expedition navigation,
  expedition balances and reversal action, route-aware Pedido/OP/client
  progress, and the mixed-Pedido route sections all implemented; every existing
  Tapete smoke test green and unchanged; structural-policy evidence against
  `CODE_HEALTH_RULES.md`; explicit architect visual acceptance after executor
  validation, per `AGENT_INSTRUCTIONS.md` §7.
- **Hard stops.** Any required migration; any Tapete behavior change; any
  entity rendered as a full modal; enlarging
  `pedido-detail-progress.js` / `pedido-detail-events.js` beyond their current
  size.
- **Next action.** Architect review, then a separate B2C order.

### PHASE-MANTA-B2C — SHARED-DEV CONTROLLED FLOW AND CLOSEOUT

- **Objective.** Apply db/85–87 to shared development, validate the live route
  end to end, and close PHASE-MANTA-B2.
- **Authorized file categories.** Documentation owners only.
- **Migration count: 0 new** (apply the three existing).
- **Environment boundary.** Shared development `ucrjtfswnfdlxwtmxnoo` **only**.
  Production `gqmpsxkxynrjvidfmojk` and `bhgifjrfagkzubpyqpew` remain
  prohibited. No Vercel deployment.
- **Test contract.** Precondition gate (terminal 84, corpus empty, protected
  residue, exact baseline) → apply 85, 86, 87 once each in order → live
  schema/guard/grant verification → controlled operational flow → live UI
  validation → zero-residue proof.
- **Acceptance gate.** Each migration recorded exactly once, in order, terminal
  87; deployed function bodies byte-identical to the committed sources; the full
  Manta flow (output → partial release → additive release → partial delivery →
  reversal → correction → re-release → completion) proved live; a mixed Pedido
  proved to advance its routes independently; every fixture removed with
  zero-residue proof if fixtures are explicitly authorized by that order, or the
  whole validation performed in a rolled-back transaction otherwise.
- **Hard stops.** Any baseline mismatch; any non-empty operational corpus that
  the order did not authorize; any deployed body divergence; any need to touch
  production.
- **Next action.** Documentary closeout of PHASE-MANTA-B2.

## 11. Test contract by phase

**B2A** (disposable PostgreSQL cluster only, per the established harness
pattern):

- `tests/manta-direct-route-activation.integration.sql` — one rolled-back
  transaction proving: Tapete `cima` without destination rejected; Tapete `cima`
  with destination accepted; Manta `cima` with a destination rejected; Manta
  `cima` without destination accepted; adding a destination to a Manta `cima` by
  UPDATE rejected; removing it from a Tapete `cima` rejected; release rejected
  above availability; partial then additive release accepted with exact
  balances; planned quantity proved not to be an authority (release limited by
  measured output below `metros_pedidos`); defect metres excluded; reversal
  below delivered rejected; reversal to zero deleting the item and leaving the
  header; output correction rejected while consumed and accepted after full
  reversal; OP reopening rejected while consumed and accepted after full
  reversal; idempotent replay returning the stored result with zero mutation;
  conflicting replay rejected; Manta-only Pedido completion rejected without an
  expedition and accepted after full delivery; mixed Pedido completion rejected
  while the Tapete route is open. Because §3's guards are **immediate**, the
  rolled-back transaction exercises them directly; no `SET CONSTRAINTS` is
  required.
- `tests/manta-direct-route-activation-invariant.mjs` — disposable-cluster
  harness: full db/01..87 apply; idempotent re-apply of db/85, db/86 and db/87
  with zero schema/constraint/trigger/function/grant drift; the integration test
  above; regressions (db/78–84 identity and source integration, Manta finishing
  rejection in `gerar_op_latex`/`_split`, Latex expedition/delivery unchanged,
  C5A emission on the reconciled corpus); and distinct-session concurrency
  covering each proof in §9, ending with cluster destruction and PID/port/dir
  proof.
- `tests/ordem-compra-c3d-deploy.smoke.js` — terminal advanced 84 → 85 → 86 → 87,
  one bump per migration commit.

**B2B** (Node smoke tests, existing pattern):

- New `tests/manta-route-ui.smoke.js` — route derivation from
  `modelos.tipo_produto`; Manta section omits `Acabamento`; Tapete section
  retains it; mixed Pedido emits two independent sections; the Manta OP screen
  exposes no finishing action and no destination selector; the expedition screen
  renders either source and navigates to the correct OP; reversal action
  visibility rules; no entity embedded as a full modal.
- Extended `tests/pedido-detail.smoke.js`, `tests/entrega-writes.smoke.js`,
  `tests/expedicao-admin` coverage and `tests/tec-to-acabamento-flow.smoke.js` —
  every existing Tapete assertion must remain green **unchanged**.

**B2C**: live evidence only; no new automated test.

## 12. Risks and hard stops carried into implementation

- **R-1 — naming.** No database object named
  `registrar_movimentacao_direta_expedicao` exists. The direct-movement writer
  is the `db/32` redefinition of `liberar_expedicao_latex_parcial`. Any order or
  test referring to the former name must be read as referring to the latter.
- **R-2 — pre-existing completion defect (blocking for B2A).**
  `concluir_pedido_se_pronto` would mark a Manta-only Pedido `entregue` with no
  expedition at all. §6 makes its correction mandatory in db/87; activating the
  Manta route without it would ship a silent completion bug.
- **R-3 — non-atomic legacy delivery.** `salvarEntregaCima` performs three
  independent round-trips with a manual compensating delete. It is left
  unchanged by explicit ruling (§3.5); the Manta path avoids the pattern rather
  than inheriting it.
- **R-4 — item-less `cima` header.** Accepted residual, recorded in §3.
- **R-5 — file size.** `pedido-detail-events.js` (2709) and
  `pedido-detail-progress.js` (988) already exceed the exceptional limit; B2B
  must extract rather than extend.
- **R-6 — `CODE-HEALTH-AUDIT-18-R1`** remains open and non-blocking; B2B must
  not add to it.

Hard stops for every B2 phase: any contradiction between canonical owners; any
required path, environment or action outside the phase's authorized scope; any
rewrite of accepted history or protected residue; any migration, ACL/RLS, Auth,
rollback, cutover or PONR semantics left incomplete; any validation that would
require fabricated data, authority or provenance.

## 13. Business-rule gate

`BUSINESS_RULE_REQUIRED` is **not** returned. Every decision above was
resolvable from the accepted canon: route shapes and the Manta output authority
from PHASE-MANTA-A/B1; the release writer shape from `db/31`/`db/32`;
idempotency from `PEDIDO_OP_SCHEMA_CONTRACT.md` §13.2; the mandatory reversal
reason from `db/70`; the delivered-quantity floor from the pre-existing
`expedicao_itens` CHECK constraints; screen/modal separation from
`UI_VISUAL_CONTRACT.md` and `CODE_HEALTH_RULES.md`. No unresolved product
decision materially changes data ownership or user-visible behavior.

## 14. Status and next authorizable action

PHASE-MANTA-B2-ACTIVATION-CONTRACT-R1 is CLOSED / ACCEPTED / DOCUMENTED. The
next authorizable action was `PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1`, which has
now been executed — see §15.

## 15. PHASE-MANTA-B2A implementation record

STATUS: **PHASE-MANTA-B2A — IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED /
AWAITING ARCHITECT REVIEW.**

Order `PHASE-MANTA-B2A-BACKEND-ACTIVATION-R1` (bounded backend implementation;
local disposable PostgreSQL only). Exactly three forward-only migrations, three
linear commits, one `staging/dev` publication. **No shared-development, staging
or production apply. No product UI or JavaScript change. No business data.**
PHASE-MANTA-B2B and PHASE-MANTA-B2C remain unauthorized.

### 15.1 Migrations

| Migration | Owns | Contract clause |
|---|---|---|
| `db/85_manta_cima_route_conditional_delivery.sql` | pre-existing data gate; `entregas_destino_cima_chk` dropped; the route-aware guard pair; `registrar_entrega_cima_manta` | §3 |
| `db/86_manta_expedition_release_writer.sql` | `public.expedicao_comandos`; `consultar_saldo_expedicao_manta`; `liberar_expedicao_manta_parcial` | §4 |
| `db/87_manta_expedition_reversal_and_route_completion.sql` | `estornar_expedicao_manta_parcial`; the `concluir_pedido_se_pronto` route-symmetric forward correction | §5, §6 |

`db/01`–`db/84` are byte-unchanged. No fourth migration was required.

### 15.2 Exact RPC signatures, guards and triggers

```
public.registrar_entrega_cima_manta(p_op_id BIGINT, p_fornecedor_id BIGINT,
        p_data DATE, p_itens JSONB, p_observacao TEXT DEFAULT NULL) RETURNS JSONB
public.consultar_saldo_expedicao_manta(p_op_tecelagem_id BIGINT) RETURNS JSONB
public.liberar_expedicao_manta_parcial(p_op_tecelagem_id BIGINT, p_itens JSONB,
        p_observacao TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL) RETURNS JSONB
public.estornar_expedicao_manta_parcial(p_expedicao_id BIGINT, p_itens JSONB,
        p_motivo TEXT, p_idempotency_key TEXT DEFAULT NULL) RETURNS JSONB
public.concluir_pedido_se_pronto(p_pedido_id UUID) RETURNS JSONB   -- signature preserved
```

Guards/triggers created: `entrega_itens_cima_route_destino_guard`
(`entrega_itens_cima_route_destino_guard_fn`, BEFORE INSERT OR UPDATE on
`public.entrega_itens`), `entregas_cima_destino_route_guard`
(`entregas_cima_destino_route_guard_fn`, BEFORE UPDATE on `public.entregas`) and
`expedicao_comandos_immutable_guard`
(`expedicao_comandos_immutable_guard_fn`, BEFORE UPDATE OR DELETE on
`public.expedicao_comandos`). All ten db/81–84 guards survive unchanged.

### 15.3 Lock-order reconciliation (the mandatory pre-edit proof)

PostgreSQL acquires the target-row lock **before** a BEFORE-ROW trigger body
runs (`GetTupleForTrigger`), so the naive design would have created both
`OP → entrega` (item write) and `entrega → OP` (header UPDATE). Outcome **A** of
the order was implemented — one globally compatible order — through two
structural rules, recorded in the db/85 header:

- **R-I.** `entrega_itens_cima_route_destino_guard` requests an `ops` FOR UPDATE
  lock **only on INSERT** (the one path holding no pre-existing `entrega_itens`
  row lock). On an `entrega_id`-changing UPDATE it locks only
  `entregas(NEW.entrega_id)` FOR SHARE — by construction a different header from
  the one whose `ON DELETE CASCADE` could compete for the item row. On an
  `op_id`/`op_item_id`-only UPDATE it takes no lock at all. DELETE is not
  covered (removing an item cannot create a route violation, and covering it
  would put `entregas → entrega_itens → ops` on the cascade path).
  ⇒ **no path holds an `entrega_itens` row lock and then requests an `ops` row.**
- **R-II.** `entregas_cima_destino_route_guard` requests no `ops` lock and no
  `entrega_itens` row lock (the db/84 BLOCKER E/F unlocked-EXISTS idiom).
  ⇒ **no path holds an `entregas` row lock and then requests an `ops` row.**

Correctness without the header-side OP lock is a **fail-closed serialization**
argument, not an absence of protection: every route-changing item write takes
`public.entregas(parent)` **FOR SHARE**, which conflicts with the FOR NO KEY
UPDATE a header route/destination change holds (the FK's implicit FOR KEY SHARE
would **not** — which is exactly why the guard takes an explicit lock). The two
sides therefore strictly serialize on the parent row and the loser re-validates
totally against committed state. For an `op_id`/`op_item_id`-only UPDATE the
parent is necessarily non-empty and the two guards' accepting transitions are
mutually exclusive, so no interleaving accepts a violating pair.

The consequent obligation this places on db/86/db/87 — the Manta writers acquire
the source `entrega_itens` rows **while holding `ops`**, never the reverse — is
what makes `release vs. output correction` serialize in both directions with no
cycle.

Final global order: `pedidos` FOR UPDATE (completion only, acquires nothing
else) → `ops` asc FOR UPDATE → `lotes` FOR SHARE → `pedidos` FOR SHARE →
`modelos` asc FOR SHARE (always a leaf) → `entregas`/`entrega_itens` →
`expedicoes` → `expedicao_itens` asc, with the idempotency
`pg_advisory_xact_lock` taken **before any table row lock** in both idempotent
writers.

### 15.4 Idempotency

`public.expedicao_comandos` implements §13.2 of `PEDIDO_OP_SCHEMA_CONTRACT.md`
verbatim. Proved behavior: NULL key → legacy additive execution, no command row;
new actor/key/request → executed once, result persisted atomically; identical
replay → stored result returned byte-for-byte with zero business mutation
(including numeric normalization, so `20` and `20.00` are the same request);
same key with a changed request → `idempotencia_conflitante` with zero mutation;
failed validation → no command row. Concurrency produces exactly one business
mutation: the advisory lock is taken before any work, so a losing duplicate has
nothing to discard.

### 15.5 Completion correction

Risk **R-2** is closed. `concluir_pedido_se_pronto` keeps its signature,
authorization, grants, return shape and every existing Tapete pendency message
verbatim, and adds two route-symmetric pendencies derived from
`modelos.tipo_produto` (never `ops.tipo`): `Ha tecelagem Manta finalizada sem
expedicao` and `Ha saida de tecelagem Manta medida sem liberacao para
expedicao`. It now locks only the Pedido row, and nothing else.

### 15.6 Authorization, RLS and grants

Every new RPC is `SECURITY DEFINER`, `SET search_path = public`, `is_admin()`
gated, with `REVOKE EXECUTE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO
authenticated` on the new functions only. No existing RPC grant, table grant or
RLS policy changed. `public.expedicao_comandos` has RLS enabled, an admin-only
read policy, every client table grant revoked, and an immutability trigger that
rejects UPDATE and DELETE with no `app.retificacao_autorizada` bypass. **No
authenticated writer receives `app.retificacao_autorizada`, and no db/81–84
guard was relaxed** — proved directly by asserting that no db/85–87 writer body
even references the GUC.

### 15.7 Tests and concurrency evidence

- `tests/manta-direct-route-activation.integration.sql` — 68 proofs in one
  rolled-back transaction (route rule both ways, `entrega_id` bypass,
  header-side add/remove, atomic Manta output with no Latex side effect, exact
  balances, defect exclusion, plan-is-not-authority, partial and additive
  release, expedition reuse, identity copy, overconsumption, every replay case,
  command immutability, full reversal semantics, the output-correction and
  OP-reopening boundaries, all six completion cases, and grants/RLS).
- `tests/manta-direct-route-activation-invariant.mjs` — one disposable
  PostgreSQL 18.4 cluster: db/01..87 clean apply; db/85, db/86 and db/87 each
  re-applied with a fingerprint proving zero schema/constraint/trigger/index/
  function-body/grant/RLS drift; db/78–80 and db/81–84 regressions unchanged;
  Manta finishing rejection intact; Latex RPC surface unchanged; C5A emission
  green; **fifteen distinct-session concurrency proofs** (E1–E6, F1–F4, G1–G4)
  covering every §9 requirement, with `pg_stat_database.deadlocks = 0` and
  proved cluster destruction (PID absent, port closed, directory removed).
- `tests/ordem-compra-c3d-deploy.smoke.js` — terminal advanced 84 → 85 → 86 → 87,
  one bump per migration commit.

### 15.8 Known consequence, corrected by db/88

`tests/manta-expedition-source-invariant.mjs` (the PHASE-MANTA-B1 harness) still
asserted `manifest.length === 84` and terminal `84` in its Part A after db/85–87,
so it failed that assertion. It was outside that order's authorized manifest and
was left byte-unchanged at the time. `PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-
AND-FK-LOCK-CORRECTION-R1` realigned it — see §16.6. The harness is green again.

### 15.9 Environment and next authorizable action

Local disposable PostgreSQL only. Shared development `ucrjtfswnfdlxwtmxnoo`
remains at terminal `84` with the Manta route dormant; **no** environment was
accessed or mutated. The next authorizable action is architect review of
PHASE-MANTA-B2A, then a separate `PHASE-MANTA-B2B` order. No phase chains
automatically.

## 16. PHASE-MANTA-B2A forward correction — db/88

STATUS: **PHASE-MANTA-B2A — IMPLEMENTED AND CORRECTED / LOCALLY AND
CONCURRENTLY VERIFIED / AWAITING ARCHITECT REVIEW.**

Order `PHASE-MANTA-B2A-MEASURED-OUTPUT-IDENTITY-AND-FK-LOCK-CORRECTION-R1`
(bounded forward database correction; one migration; one commit; local
disposable PostgreSQL only). `db/88_manta_measured_output_identity_and_fk_lock_correction.sql`
forward-corrects db/85–db/87 without editing them. No shared-development,
staging or production apply; no `js/**`; no business data; B2B remains
unauthorized.

### 16.1 Delivery-item exact model identity (Blocker A)

`entrega_itens_cima_route_destino_guard_fn` now treats `modelo_id` as a
trigger-relevant identity field, so a **modelo_id-only UPDATE no longer escapes
through the early return**. On every INSERT or relevant UPDATE of a `cima` item
it proves, from post-lock values only: the op_item exists, belongs to
`NEW.op_id`, resolves to a model with a `tipo_produto`, and that the source OP is
non-empty and route-homogeneous; then it applies the route-conditional
destination rule. The model rule is **route-conditional**, and that is a
deliberate, recorded decision rather than an omission:

- **Manta** `cima` item — `modelo_id` is **mandatory** and must equal
  `op_itens.modelo_id` exactly.
- **Tapete** `cima` item — a **supplied** `modelo_id` must equal
  `op_itens.modelo_id` exactly; a NULL remains valid.

`public.entrega_itens.modelo_id` is nullable by design, with
`CHECK (op_item_id IS NOT NULL OR modelo_id IS NOT NULL)`: it is the
*alternative* identifier for legacy rows carrying no op_item, not a mandatory
mirror. The live Tapete writer (`salvarEntregaCima` via
`js/screens/entrega-form.js` `getPayload`) sends only
`{op_item_id, metros_entregues, defeito, observacao}` and **never** sends
`modelo_id`, so an unconditional non-null match would reject every Tapete
delivery the product writes — a Tapete behavior change this order forbids and a
listed hard stop. The route-conditional rule loses nothing: the only Manta writer
always copies `modelo_id` from the op_item, so objective 1 is met with no gap,
including against a direct table write. Nothing is ever silently rewritten and no
name is ever inferred.

A **pre-existing data gate** aborts the whole migration if any item-bearing
`cima` delivery already violates any of this (divergent `op_id`, divergent
supplied `modelo_id`, Manta without `modelo_id`, missing op_item or model,
unresolved or mixed route, Tapete without destination, Manta with destination).
No repair, no reinterpretation. The item-less-header residual stays accepted.

### 16.2 Measured-output op_item identity freeze (Blocker B)

New `op_itens_manta_output_reference_guard` (BEFORE UPDATE on `public.op_itens`,
function `op_itens_manta_output_reference_guard_fn`). While an op_item is
referenced by Manta measured output — an `entrega_itens` row whose parent has
`etapa='cima'` and whose route derives from the op_item's own model — its
`op_id`, `modelo_id` and `pedido_item_id` are immutable, so a later identity
change can never retro-actively rewrite what the recorded output means.
Same-value updates and quantity updates (`metros_pedidos`, `metros_ajustados`)
remain permitted and governed by the pre-existing rules; unrelated op_items and
the whole Tapete route are unaffected; there is **no**
`app.retificacao_autorizada` bypass. Correction requires removing or correcting
the delivery reference first, and after positive expedition consumption db/81
remains the stronger guard and refuses even that. DELETE is not duplicated here —
`entrega_itens.op_item_id → op_itens.id ON DELETE RESTRICT` already refuses it.

The guard takes the affected OP rows `FOR UPDATE` (ascending) before inspecting
the reference. That is required for correctness, not decoration: op_itens trigger
functions fire alphabetically, so this guard runs *before*
`op_itens_route_homogeneity_guard` would take that lock, and without taking it
the reference check would read a pre-serialization snapshot and a concurrent
output writer could commit its delivery row unseen.

### 16.3 Foreign-key row-lock order (Blocker C)

The accepted lock analysis now includes the **implicit** `FOR KEY SHARE` row lock
that `entrega_itens.op_item_id → op_itens.id` and
`expedicao_itens.op_item_id → op_itens.id` take on the referenced op_item.
db/85–87 acquired the source `ops` row first and only then wrote those child
rows, giving `OP → op_item`; every pre-existing op_itens guard (db/80, db/81,
db/82) runs as a BEFORE-ROW trigger *after* the statement already owns the
op_item's target-row lock and then requests the OP, giving `op_item → OP`. That
was a real cycle. Corrected global order:

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

`FOR KEY SHARE` is the exact required mode: it conflicts with `FOR UPDATE` so a
concurrent op_item DELETE blocks (and is then refused); it does **not** conflict
with `FOR NO KEY UPDATE` so a non-key identity UPDATE continues to the shared
`ops` serialization point instead of deadlocking; the post-OP-lock re-read then
decides the winner; and it is the same lock the FK itself would take moments
later, so taking it explicitly adds no edge — it only makes the acquisition
deterministic and puts validation under the lock.

Corrected paths: `entrega_itens_cima_route_destino_guard_fn` (op_item first;
`ops` still only on INSERT, so db/85's rule R-I stands and the UPDATE path
introduces no `entrega_item → OP` acquisition); `registrar_entrega_cima_manta`
(parse and normalize without mutation → lock every distinct requested op_item
ascending → lock the source OP → re-read every requested op_item and prove its
exact `op_id`, `modelo_id`, `pedido_item_id` and Manta route → existing atomic
write); `liberar_expedicao_manta_parcial` (advisory → op_items ascending → source
OP → existing lineage/output/expedition locks → post-lock membership and identity
re-read → unchanged release semantics); and
`expedicao_itens_membership_guard_fn` (op_item before the source OP, preserving
every db/82 membership and db/83 identity check), which also protects **direct**
expedition-item writes.

**Residual, explicitly recorded, not introduced here.** A direct
`UPDATE entrega_itens SET op_item_id = …` (or the same on `expedicao_itens`)
inherently holds its own row lock and then takes the FK's `FOR KEY SHARE` on the
op_item — a descending acquisition PostgreSQL performs with or without db/88. It
cannot cycle with the Manta writers, which hold the op_item only in
`FOR KEY SHARE`, a mode compatible with the FK's own request, so neither waits on
the other for that resource; and no product writer ever re-points `op_item_id`.
Separately, the pre-existing Tapete writer `db/32`
(`liberar_expedicao_latex_parcial`) takes `ops FOR UPDATE` and only then
`op_itens … FOR UPDATE`. That is db/32's own accepted behavior on a non-Manta
path, db/01–db/87 are frozen by this order, and db/88 adds no edge to it: the
corrected membership guard re-enters locks db/32 already holds.

### 16.4 Concurrency evidence

Six new distinct-session proofs, on top of the fifteen from db/85–87 (21 total),
all with `pg_stat_database.deadlocks = 0`:

| Proof | Result |
|---|---|
| A output insert wins vs op_item DELETE | DELETE blocks on the writer's `FOR KEY SHARE` (`pg_blocking_pids`), output commits, DELETE then refused (`fk_on_delete_restrict`), op_item survives |
| B op_item DELETE wins vs output insert | writer waits on the op_item **before** taking the OP, DELETE commits, writer re-reads and returns `item_fora_da_op`; no partial delivery (`0/0`) |
| C release wins vs op_item DELETE | DELETE blocks, release commits exactly once (60.00), DELETE then refused (`db82_source_nonempty_guard`) |
| D op_item DELETE wins vs release | release waits on the op_item, then returns `item_fora_da_op`; no expedition remains (`0/0`) |
| E1 identity change wins | output insert waits on the OP, re-reads committed identity, rejects the stale payload; nothing persists |
| E2 output insert wins | identity change waits on the OP, then refused by `op_itens_manta_output_reference_guard`; op_item identity unchanged |

Which accepted rule refuses a DELETE is reported rather than asserted, because
several fail-closed rules legitimately apply depending on fixture state; the
proof is that the DELETE blocked on the pre-lock and was then refused.

### 16.5 Idempotency

Under a forward-only chain, idempotency is a property of the chain: db/88
supersedes two objects db/85 also defines, so re-applying db/85 *alone* at the
end would correctly reinstate the superseded bodies. The harness therefore
re-applies `db/85 → db/86 → db/87 → db/88` **in order** and requires the
fingerprint (columns, constraints, triggers, **indexes**, function bodies,
grants, RLS) to return exactly to its pre-re-apply value, and additionally
re-applies **db/88 standalone** — the terminal owner of every object it defines —
with zero drift. Both are green.

### 16.6 B1 harness realignment

`tests/manta-expedition-source-invariant.mjs` no longer hard-codes an eternal
manifest length of 84. It applies the **complete current chain**, asserts that
`db/01..db/84` is a contiguous prefix and that the whole manifest stays
contiguous from `db/01`, and keeps every db/81–84 object, invariant and
concurrency assertion **unweakened**, still running the unchanged B1 substantive
integration payload. It passes under db/01..88 (`failures=0`), and stays useful
as later forward migrations are added.

### 16.7 Regression and environment

Full validation on one fresh disposable PostgreSQL 18.4 cluster: db/01..88 clean
apply; the complete B2A integration test (80 sequential proofs) green; the
corrected B1 invariant harness green; the B1 substantive integration payload
green and unchanged; all previous B2A distinct-session proofs green; db/78–84
identity and source regressions, Manta finishing rejection, the Tapete
`cima → gerar_op_latex → op_latex_entregas` chain, the Latex saldo → partial
release → client delivery flow, release/reversal idempotency, the completion
correction and C5A emission all green and unchanged; cluster destroyed with PID,
port and directory proof. Shared development `ucrjtfswnfdlxwtmxnoo` remains at
terminal `84`; no environment was accessed. PHASE-MANTA-B2A remains **awaiting
architect review**; B2B and B2C stay unauthorized.
