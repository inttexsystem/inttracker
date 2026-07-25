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

## 17. PHASE-MANTA-B2B implementation record

STATUS: **PHASE-MANTA-B2B — IMPLEMENTED / LOCALLY VERIFIED / PUBLISHED /
AWAITING ARCHITECT TECHNICAL AND VISUAL REVIEW.**

Order `PHASE-MANTA-B2B-ROUTE-AWARE-UI-AND-READ-MODELS-R1` (route activation in
the product surfaces; `js/**`, `index.html`, `tests/*.smoke.js` and the affected
documentation owners only). **Zero migrations; `db/**` byte-unchanged. No
shared-development, staging or production access. No Vercel. No real business
data.** PHASE-MANTA-B2C remains unauthorized.

### 17.1 Root cause of the previous fixed-route UI

The route was never a first-class client fact. Five owners each carried their
own Latex/Tapete premise:

1. `pedido-detail-progress.js` derived the stage from `ops.tipo` and emitted a
   fixed five-stage `stepper` array;
2. `pedido-chain-state.js` carried the same premise plus an unconditional
   `acabamento` in `CLIENT_STEPS` and in `adminStepper`;
3. every expedition read-model attributed metres through `op_latex_id` only, so
   a Manta expedition (`op_tecelagem_id`) was invisible;
4. `expedicao-admin.js` selected and navigated `op_latex_id` only, producing
   `#/ops/null` for a Manta expedition;
5. `js/pedido-tracking-ui.js` published a constant eight-step client list.

The correction makes the route an explicitly derived, shared fact
(`js/product-route.js`, reusing the accepted `deriveProductType`) and makes the
*shape* of the steps a function of that fact everywhere.

### 17.2 New cohesive modules

| Module | Responsibility | Lines |
|---|---|---|
| `js/product-route.js` | route derivation, per-route stage/client-step shapes, expedition-source resolution (pure; no `window.supa`) | 233 |
| `js/screens/pedido-route-sections.js` | per-route section view models and stepper construction, plus the extracted release-availability calculation (pure) | 448 |
| `js/screens/pedido-route-sections-ui.js` | route-section arrangement (stage/connector nodes injected by the render module) | 82 |
| `js/screens/manta-writes.js` | the only Manta write module — the four db/85–87 RPCs, no direct table DML | 216 |
| `js/screens/manta-output-form.js` | measured-output form (pure DOM; no destination selector, no split) | 205 |
| `js/screens/manta-movimento-form.js` | one save path shared by the weaving-OP screen and the Pedido movement modal | 84 |
| `js/screens/manta-expedicao-ui.js` | Manta expedition balances plus the release and reversal action modals | 320 |
| `js/screens/cliente-route-read.js` | client-side route reader over already-readable data | 66 |

### 17.3 Behaviour by surface

- **Manta weaving OP** — records measured output through
  `registrar_entrega_cima_manta` with `op_item_id`, measured metres and an
  explicit defect state; exposes no finishing supplier, no finishing
  destination selector and no `gerar_op_latex`/`_split`; the atomic backend
  `codigo`/`erro` reaches the operator unrewritten; double submission is
  blocked by a per-form latch. The rail offers "Abrir expedição da OP" instead
  of "Enviar para acabamento". Tapete weaving is untouched.
- **Expedition** — the dedicated screen at `#/expedicoes/:id` now selects both
  source columns, states the origin explicitly ("Origem: Tecelagem (Manta)" /
  "Acabamento (Tapete)"), and navigates "Ver OP" to whichever source is
  non-null. For a Manta source it renders planned / measured / released /
  delivered / available per item and in aggregate, with eligibility and
  available balance taken **only** from `consultar_saldo_expedicao_manta`;
  planned quantity is displayed as information and never enters a calculation.
- **Release and reversal** — partial release, additional release and controlled
  reversal call `liberar_expedicao_manta_parcial` and
  `estornar_expedicao_manta_parcial`. Reversal requires a trimmed reason, caps
  each item at `liberado - entregue`, and is hidden entirely when no release is
  reversible. One idempotency key per operator attempt, reused across retries of
  that attempt. Both modals contain the action form only.
- **Pedido route sections** — the fixed five-stage stepper is gone. One section
  per applicable route, each with its own stepper; a homogeneous Pedido
  degenerates to exactly one section and to today's view. Expedition metres are
  attributed by real origin, so neither route advances, completes or blocks the
  other. Pedido completion pendencies became route-symmetric, matching db/87.
- **Client surfaces** — the step *shape* is derived from the route and the
  published *position* remains the curated commercial artefact. Manta omits
  `Acabamento`; Tapete retains it; a mixed Pedido presents the union of its
  applicable routes. `cliente_pedido_summary` (db/30) does not expose
  `modelo_id`, and B2B authorizes no migration, so the route is read client-side
  from `pedido_itens` (policy `pedido_itens_cliente_select`, db/14) joined to
  `modelos` (policy `modelos_read`, db/03) — both already readable by the
  client. No permission is broadened and no administrative control is exposed.
  The reader is a dedicated module precisely because `cliente-pedido-detail.js`
  has a deliberate no-direct-read boundary, which is preserved verbatim.

### 17.4 Structural evidence

`pedido-detail-events.js` 2709 → **2709**; `pedido-detail-progress.js` 988 →
**919**. Neither protected file grew. `pedido-detail-render.js` 1330 → 1333
(+3, a route-explaining comment; the route-section arrangement was extracted
rather than added). `expedicao-admin.js` 462 → 522 and
`op-tecelagem-producao-admin.js` 655 → 782 — both remain single cohesive screens
with local closure, below the exceptional limit, with all route-specific
calculation and action UI extracted to the modules in §17.2. Pure helpers never
touch `window.supa`; render functions perform no insert/update/delete/upsert;
every Manta write goes through `manta-writes.js` and every one of them is an
authoritative RPC. `index.html` stays declarative and every new script carries
cache-busting.

### 17.5 Test and validation evidence

New `tests/manta-route-ui.smoke.js` — 33 assertions, all green, covering every
numbered requirement of §11. Extended without weakening any existing Tapete
assertion: `tests/pedido-detail.smoke.js`, `tests/entrega-writes.smoke.js`,
`tests/expedicao-flow.smoke.js`, `tests/tec-to-acabamento-flow.smoke.js`. Three
static assertions whose subject moved to an extracted module were realigned to
the new owner with identical semantics (two of them re-expressed as stronger
runtime proofs), and `tests/cliente-pedido-detail.smoke.js` was updated for the
fifth argument of the tracking card; the boundary assertions of that screen were
preserved verbatim rather than relaxed. Full suite: 4203 tests, **zero new
failures relative to `b266131`**, with 27 pre-existing failures incidentally
resolved. Local visual validation was performed against an ephemeral, untracked
in-browser fixture with an in-memory Supabase double — no network, no
environment, no fabricated session — and the fixture was destroyed with proof.
Pixel screenshots could not be captured in the executor's session; the visual
evidence is rendered-structure, computed-geometry and action-state evidence.
**Architect visual acceptance remains pending.**

### 17.6 Next authorizable action

`PHASE-MANTA-B2B-ARCHITECT-TECHNICAL-AND-VISUAL-REVIEW`. PHASE-MANTA-B2C
requires its own separate explicit order; no phase chains automatically.

## 18. PHASE-MANTA-B2B route-semantics and responsive correction — R2

STATUS: **PHASE-MANTA-B2B — CORRECTED / LOCALLY VERIFIED / PUBLISHED /
AWAITING ARCHITECT TECHNICAL AND VISUAL ACCEPTANCE.**

Order `PHASE-MANTA-B2B-ROUTE-SEMANTICS-AND-RESPONSIVE-VISUAL-CORRECTION-R2`
(bounded product correction of the already-published B2B implementation;
`js/**`, `css/**`, `index.html`, `tests/*.smoke.js` and the affected
documentation owners only). **Zero migrations; `db/**` byte-unchanged. No
shared-development, staging or production access. No Vercel. No real
business data.** This record does not self-accept the phase, and
PHASE-MANTA-B2C remains unauthorized.

Defect closure recorded by the order:

| Defect | State |
|---|---|
| D1 — client mixed Pedido rendered one merged stepper | **CLOSED** |
| D2 — client Manta step numbering contained a gap | **CLOSED** |
| D3 — mandatory 375 px surfaces clipped or unusable | **CLOSED FOR THE REQUIRED B2B SURFACES** |
| D4 — Manta surfaces retained false Acabamento metrics, labels and documentary pendencies | **CLOSED** |

### 18.1 Root cause of each defect

1. **D1.** §17 made the *shape* of the client steps route-derived but kept
   one stepper: `filterClientSteps` returns the **union** of the applicable
   routes, and `cliente-pedido-tracking.js` rendered that union as a single
   row. For a mixed Pedido the union necessarily contains `acabamento`, so
   the Manta half of the order was shown a finishing step it does not have.
   The union function was correct for consumers that need the aggregate set;
   it was the wrong input for a surface that *renders* steps.
2. **D2.** `buildStepNode` printed `String(index + 1)` where `index` is the
   **canonical** position in the full eight-step list. After `acabamento`
   was filtered out, a Manta route rendered 1, 2, 3, 4, **6**, 7, 8 — a
   visible gap exactly where the filtered step used to be. The canonical
   index is required for progress comparison and DTO lookup, but it is not
   the visible ordinal.
3. **D3.** Route-neutral platform defect. The global chrome
   (`js/screens/common.js`) is built with **inline** `style` attributes — a
   196 px sidebar, a 62 px topbar and a `flex` row — and the repository had
   **no** media-query infrastructure at all (`css/tokens.css` holds only
   custom properties). An inline declaration outranks any stylesheet rule by
   specificity, so no breakpoint could exist. At 375 px the sidebar consumed
   196 px of a 375 px viewport, leaving the cockpit grid
   `minmax(0,1fr) var(--rv-rail-w)` a **131 px** content column; paragraphs
   collapsed to ~1.2 words per line. Separately,
   `expedicao-admin.js buildItens` appended 720 px-wide rows **directly into
   a card with `overflow:hidden`**, so those columns were clipped with no
   reachable scroll.
4. **D4.** Four distinct false statements, all from conflating the
   production **stage** (`ops.tipo`) with the product **route**
   (`modelos.tipo_produto`) at the *presentation* layer, which §17 corrected
   for structure but not for vocabulary:
   - the weaving-OP rail summary labelled measured output
     `Entregue p/ acabamento` for both routes;
   - the Pedido summary always emitted an `Em acabamento` metric, so a
     Manta-only Pedido asserted "0 m in a stage that does not exist";
   - the item table always emitted an `ACABAMENTO` column, and a Manta
     item's released/delivered metres were computed **only** from `latex`
     op_items, so a released and delivered Manta item read `0`;
   - the OP documentary banner and document row asserted
     `Romaneio tecelagem -> acabamento pendente` /
     `Movimento: Tecelagem -> Acabamento` for a Manta weaving OP — a
     pendency for a transition the route does not contain.

### 18.2 D1 — client route sections

`js/product-route.js` gains `splitClientStepsByRoute(steps, routes)`, which
returns one **independent** list per applicable route (ordered Tapete then
Manta), each entry carrying `displayIndex`/`displayCount` — the route-local
position, contiguous by construction. `filterClientSteps` is **retained
unchanged** for the aggregate consumers; the rendering surfaces switch to
the split.

`js/pedido-tracking-ui.js` gains `getClienteTrackingSectionsForRoutes` and
`getClienteTrackingRoutePosition`. New cohesive module
`js/screens/cliente-route-sections-ui.js` (105 lines) owns **only the
arrangement**: the route-identifying chip (`Rota Tapete` / `Rota Manta`),
the route's real step shape as text, the per-section scroll container, and a
route-local position note. The step nodes are still built by
`cliente-pedido-tracking.js`, which owns the client stepper's visual
vocabulary, and are injected — the same pattern already accepted for
`pedido-route-sections-ui.js`.

Boundaries preserved verbatim: `cliente-pedido-detail.js` performs **no**
direct read and gained no new one; the routes still arrive from the
dedicated reader `cliente-route-read.js`; no administrative datum is
exposed; no permission is broadened. A Tapete-only Pedido renders **one**
section with **no** header — its presentation is unchanged. A Manta-only
Pedido renders one Manta section. Degradation without the arrangement module
still emits one block per route, never the union.

**Accepted limitation, explicitly recorded.** `status_cliente_visual` is a
Pedido-level curated commercial artefact owned by `db/30`, and this order
authorizes **no** migration, so a per-route *published position* does not
exist. What is computed per route is therefore: the step set, the visible
numbering, the per-step state, the connector colours (from route-local
adjacency, never canonical adjacency), the partial-DTO match (by key, and
only within the route that owns the key), and a route-local reached/next
note. A per-route published position would require a new read-model column
and is a separate order.

### 18.3 D2 — route-local numbering

`buildStepNode` now prints `pos + 1` — the route-local display position —
in all three circle states, and receives an explicit `prevReached` computed
inside the route so a connector is never coloured by canonical adjacency
(which would join Tecelagem to Expedição *through* an Acabamento the route
lacks). The canonical index is still passed and still decides
`concluido` / `atual` / `futuro` and the DTO lookup. Each node carries
`data-rv-step-key`, `data-rv-step-number` and `data-rv-step-canonical`, so
the divergence is directly assertable. No hidden Acabamento node is
fabricated anywhere. Proved live: Manta renders 1..7 with canonical
`[0,1,2,3,5,6,7]`; Tapete renders 1..8 with canonical `[0..7]`.

The administrative route sections were already route-sized
(`pedido-route-sections-ui.js` builds the grid from the route's own stage
count), and were confirmed to number 1..4 for Manta and 1..5 for Tapete.

### 18.4 D4 — route-correct vocabulary, metrics and documentary logic

- **Weaving-OP summary.** `buildResumo(totais, route)` takes the route
  **explicitly** and selects from a `RESUMO_LABELS` table; it never guesses.
  Manta reads `Saída medida` and "% da saída já medida (segue direto para a
  Expedição)"; Tapete keeps `Entregue p/ acabamento` and its original
  percentage sentence verbatim. The caller passes `isManta ? 'manta' :
  'tapete'`, derived from `modelos.tipo_produto` via the pre-existing
  `opEhManta`.
- **Pedido summary metrics.** `buildPedidoSummaryMetrics(routes,
  opSummaries)` (in `pedido-route-sections.js`) reports `hasAcabamento`,
  `hasManta` and `mantaMedido`. For a Manta-only Pedido the `Em acabamento`
  metric is **suppressed**, not rendered as zero, and is replaced by
  `Saida medida (Manta)`. For a mixed Pedido both metrics appear side by
  side. The aggregate `emAcabamento` is unchanged and continues to sum only
  `stageKey === 'acabamento'` summaries — that is, `ops.tipo='latex'` — where
  no Manta can exist by DB guarantee, so it contains **Tapete values only by
  construction**. Proved on the mixed fixture: `emAcabamento = 300` (the
  Tapete finishing balance) with `mantaMedido = 180` held separately.
- **Item table.** The `ACABAMENTO` column is emitted only when an applicable
  route has the stage; in a mixed Pedido a Manta row renders `—` with an
  explanatory title, never `0`. `itemMetricsById` now carries the item's
  `route`. The Manta released/delivered **values** were corrected: on the
  Manta route the expedition references the op_item of the **weaving** OP,
  so those metres are now accumulated there. Proved: a Manta item with 90 m
  released and 30 m delivered reads `prontos 60 / entregues 30` instead of
  `0 / 0`.
- **OP cards and movement modal.** `OP_CARD_LABELS` selects by
  `summary.route`: a Manta weaving card reads `Saida medida` and opens
  `Movimentar para Expedicao` with destination `Expedicao` and
  `NF de expedicao`; Tapete keeps `Entregue p/ acabamento`,
  `Transferir para Acabamento`, `Acabamento` and `Romaneio e NF` verbatim.
- **Documentary pendencies.** Extracted to `buildOpDocBanner(stageKey,
  route, done)` and `buildOpDocumentRow(summary)` in
  `pedido-route-sections.js`. A Manta weaving OP produces **no pendency**:
  the tone is `neutral` and the text states that the route has no movement
  to finishing — an explanatory note, permitted by §7.3 of the order,
  rather than a manufactured requirement. **No new document type is
  invented**, because the existing document contract defines none for the
  Manta measured output; the false pendency is omitted instead. The
  document row cites the transition the route actually has,
  `Movimento: Tecelagem -> Expedicao`. Every Tapete banner and row string is
  byte-identical to before.

### 18.5 D3 — bounded responsive gate

New `css/responsive.css`, the repository's first media-query
infrastructure, cache-busted from `index.html`, which stays declarative.
Every selector is anchored on a `data-rv-*` **region** attribute; nothing
leaks to the rest of the application. `!important` is deliberate and
necessary: the chrome's competing declarations are inline, so a plain rule
would be inert — the responsive smoke test pins that reasoning.

- **Shell (≤767 px).** `[data-rv-shell]` stacks; `[data-rv-shell-aside]`
  becomes a full-width horizontally scrollable strip carrying the **same**
  navigation items through the **same** `navItem` mechanism. The global
  navigation is not redesigned: no drawer, no hamburger, no overlay. Proved
  live: aside 375×55, main 375 wide, `flex-direction: column`.
- **Cockpit (≤1023 px).** `[data-rv-cockpit]` collapses to one column,
  `[data-rv-rail]` loses `sticky`, `[data-rv-2col]` collapses, and
  `[data-rv-route-stepper]` stacks so no route node is clipped or
  overlapped. Proved live at 375 px: content column 131 px → **347 px**,
  rail `static` and laid out **below** the main column
  (`railTop 1619` vs `mainColTop 305`); at 1440 px the cockpit remains
  `862.8px 300px` with the rail `sticky`.
- **Tables.** `[data-rv-table-scroll]` owns `overflow-x` at every width.
  `expedicao-admin.js buildItens` now appends its rows into such a
  container instead of into the `overflow:hidden` card — the substantive fix
  for the clipped expedition table. The OP capacity table's `min-width` rose
  560 → 700 px, because four 110 px columns plus gaps left the MODELO column
  ~48 px and its label broke to one word per line.
- **Text, controls and modals.** Metric grids drop to two columns and
  fixed-px form grids stack, so no control is unreachable. The client
  stepper scrolls inside `[data-rv-stepper-scroll]` with a legible
  `min-width` instead of compressing labels. The generic modal already fit
  the viewport (`max-w-lg max-h-[90vh]` with an internally scrolling body)
  and was confirmed, not changed.

### 18.6 Measured geometry

Nine surfaces × three viewports (1440 / 785 / 375 px), real browser layout
against a disposable in-browser fixture using the real product modules:
**`documentElement.scrollWidth === clientWidth` on every one — document-level
horizontal overflow 0 px throughout**, including the previously documented
19 px overflow at the 785 px route boundary, which is gone. Every element
still wider than the viewport is inside an owned
`[data-rv-table-scroll]` / `[data-rv-stepper-scroll]` container, which is
what §8.3 of the order permits. The narrowest multi-word text block improved
from **1.2** to **≥2.3** words per line; the remaining minima are short
labels in intentionally narrow table columns, not shell-starved paragraphs.

### 18.7 Structural evidence

`pedido-detail-events.js` 2709 → **2709**. `pedido-detail-progress.js`
919 → **918**. Neither protected file grew; the route-aware documentary and
summary derivations were **extracted** into `pedido-route-sections.js`
(448 → 538) rather than appended. `pedido-detail-render.js` 1333 → 1424 and
`op-tecelagem-producao-admin.js` 782 → 800 remain single cohesive screens
below the exceptional limit. New modules: `css/responsive.css` and
`js/screens/cliente-route-sections-ui.js` (105 lines), both under 500 lines.
No DML in any render module, no new direct table write, every Manta write
still in `manta-writes.js` through an authoritative RPC, `index.html` still
declarative with every changed asset cache-bumped, and
`CODE-HEALTH-AUDIT-18-R1` not enlarged.

### 18.8 Test and validation evidence

`tests/manta-route-ui.smoke.js` extended with fifteen R2 proofs (48
assertions total, all green) covering requirements 1–14 and 18 of the
order's test contract, including runtime rendering of the client card for
Manta-only, Tapete-only and mixed route sets. New
`tests/responsive-layout.smoke.js` — 21 green assertions covering
requirements 15–17 plus the protected-file line ceilings and the
"bounded, not a redesign" scope. Two static assertions were realigned to the
subject that moved and **neither was weakened**:
`tests/expedicao-flow.smoke.js` stopped freezing a literal `?v=` value (the
order mandates a bump on every change) while still requiring the script to
be present and cache-busted, and the `dtoByKey` assertion in
`manta-route-ui` now also **forbids** positional matching outright.

Full suite `node --test tests/**/*.js`: 4239 tests. The set of failing test
names is a strict subset of the `bbd5f85` baseline set — **zero introduced
failures**, verified by name-level diff against a clean detached worktree at
`bbd5f85`. Per-file comparison in the canonical workspace: `pedido-detail`
41 → 41, `tec-to-acabamento-flow` 2 → 2,
`production-flow-invariants` 1 → 1, `screens-common` 8 → 8,
`cliente-portal-visual` 9 → 9, `entrega-writes` 1 → 1 — identical failing
names in every case. No existing Tapete assertion was weakened or removed.

Visual validation used a disposable, untracked in-browser fixture loading
the real product modules with a purely in-memory read double: no network, no
Supabase project, no Vercel, no fabricated session, no real business data.
The fixture and the local static server were destroyed after capture, with
zero repository residue. Pixel captures were taken at 1440 / 785 / 375 px
and directly inspected; they are not committed. **Architect visual and
technical acceptance remains PENDING and is not self-accepted.**

### 18.9 Deferred and out of boundary

- `js/screens/op-nova.js` carries the same cockpit grid for the
  **`aberta`** weaving-OP state and is **outside** this order's authorized
  paths, so it received no `data-rv-cockpit` anchor. That state is not one of
  the order's required B2B surfaces. Closing it needs an order naming that
  file.
- D3 is closed **only** for the surfaces the order enumerates. The
  application is **not** claimed to be globally responsive; screens outside
  that list were not measured and were not corrected.
- A per-route *published* client position remains impossible without a
  read-model change (§18.2).
- No `Liberado para expedição` metric was added to the weaving-OP rail: the
  screen does not load expedition balances, and fabricating the number was
  refused. It is available one click away on the expedition screen.

### 18.10 Environment and next authorizable action

Local only. Shared development `ucrjtfswnfdlxwtmxnoo` remains at terminal
migration `db/84` with the Manta backend dormant and **was not accessed**.
Production `gqmpsxkxynrjvidfmojk` and `bhgifjrfagkzubpyqpew` untouched. The
next authorizable action is
`PHASE-MANTA-B2B-ARCHITECT-TECHNICAL-AND-VISUAL-REVIEW`. PHASE-MANTA-B2A
(db/85–88) still awaits its own architect review, and PHASE-MANTA-B2C
requires a separate explicit order. No phase chains automatically.

## 19. PHASE-MANTA-B2B administrative client-preview route position — R3

STATUS: CORRECTED / LOCALLY VERIFIED / PUBLISHED / AWAITING ARCHITECT
TECHNICAL AND VISUAL ACCEPTANCE. Not self-accepted.

### 19.1 The defect

The administrative block labelled `O QUE O CLIENTE VÊ`
(`buildClienteEvolution`, `js/screens/pedido-detail-render.js`) read its
position **and its denominator** straight from
`getClienteTrackingProgress`, which is defined over the full canonical
eight-step list. It never consulted the route. A Manta-only Pedido at
Tecelagem therefore displayed `Etapa 4 de 8` while the actual client
presentation for that same Pedido published **seven** visible steps — so
the block did not show what the client sees, and the omitted Acabamento
survived inside the visible denominator. The progress bar inherited the
same wrong total.

This was the last open acceptance defect of PHASE-MANTA-B2B, raised by the
architect from the R2 visual evidence.

### 19.2 The correction

`js/pedido-tracking-ui.js` — the owner of the client tracking vocabulary —
gains one pure function, `getClienteTrackingPreviewPosition(routes,
canonicalIndex)`. It **translates** the Pedido-level canonical position
into the applicable *visible* route shape by composing the helpers that
already exist (`getClienteTrackingSectionsForRoutes`,
`getClienteTrackingRoutePosition`, `getClienteTrackingStepIndex`):

- **exactly one applicable route** → the route-local ordinal.
  Manta reads `Etapa 4 de 7`; Tapete keeps `Etapa 4 de 8` verbatim.
- **zero or two applicable routes** → no single route-local ordinal is
  true for both routes, so none is fabricated. The reading is declared to
  be Pedido-level: `Etapa comercial 4 de 8`, plus a per-route local
  reached/next summary derived from the same existing helpers
  (`Rota Tapete: Tecelagem · próxima Acabamento | Rota Manta: Tecelagem ·
  próxima Expedição`).

`buildClienteEvolution` consumes that result for the label, the
denominator **and** the percentage, and reproduces no route-shape array of
its own. The route arrives as `view.pedidoRoutes`, already derived from
`modelos.tipo_produto`; the render never infers it from `ops.tipo`, names,
width or suppliers. The position span carries
`data-rv-preview-position="route-local|pedido-level"` and the mixed note
carries `data-rv-preview-route-note`, so both are directly assertable.

### 19.3 What did not change

No migration, no `db/**` delta, no SQL, no RPC, no ACL/RLS/Auth change.
`status_cliente_visual` remains the single Pedido-level authority and is
neither written nor reinterpreted; **no per-route position is persisted**,
so the accepted limitation of §18.2 stands unchanged. The actual client
route sections are untouched — the R3 captures of the client Manta and
client mixed surfaces are **byte-identical** (equal SHA-256) to their R2
counterparts. No administrative datum is exposed to the client: the block
is administrative and remains administrative. D1–D4 behaviour is
unchanged. No new module and therefore no `index.html` change.

### 19.4 Evidence

`tests/manta-route-ui.smoke.js` extended with eight R3 proofs (48 → 56
green): Manta denominator seven and `4 de 7`; Tapete retained at eight;
mixed refusing a single route-local total while summarising each route;
degradation to Pedido level without a reliable route; the whole Manta
route walked as a contiguous `1/7…7/7` (D2 preserved); the render
consuming the helper and duplicating no step list; no `db/**` delta; and
the structural gates. `tests/pedido-detail.smoke.js` and the full
`node --test tests/**/*.js` sweep show the failing-test-name set
**identical** to the `3ed9c4a` baseline — 41 and 126 respectively, zero
introduced failures, no Tapete assertion weakened.

Structural gates held exactly: `pedido-detail-events.js` 2709 and
`pedido-detail-progress.js` 918, neither enlarged. No DML in a render
module.

Visual evidence: ten captures from a disposable local fixture loading the
real product modules with no network, no Supabase, no Vercel and no real
business data — full pages plus close-ups of the corrected block at 1440px
and 375px — packaged outside the repository as
`PHASE-MANTA-B2B-R3-VISUAL-EVIDENCE.zip`. Document-level horizontal
overflow is zero on every full-page capture and nothing is lost to a
clipping container. The fixture and its browser profile were destroyed.

### 19.5 Next authorizable action

`PHASE-MANTA-B2B-ARCHITECT-TECHNICAL-AND-VISUAL-ACCEPTANCE`. Architect
acceptance is **not** claimed. PHASE-MANTA-B2A (db/85–88) still awaits its
own architect review; PHASE-MANTA-B2C requires a separate explicit order.
No phase chains automatically.

### 19.6 R3 cache-token blocker — CLOSED

`PHASE-MANTA-B2B-R3-CACHE-BUST-CLOSEOUT-R1` closed the one deferral R3 had
recorded. Both assets R3 changed now carry a single R3-specific token in
`index.html`:

```
<script src="js/pedido-tracking-ui.js?v=20260725-manta-b2b-r3"></script>
<script src="js/screens/pedido-detail-render.js?v=20260725-manta-b2b-r3"></script>
```

Declarative invalidation only: both JavaScript files are byte-identical to
`4532f76` (equal git blob ids), no other asset token moved, and the asset
order and paths of `index.html` are unchanged. A returning browser now
fetches the corrected assets. No behaviour, CSS, module, migration or `db/**`
change. `tests/manta-route-ui.smoke.js` gained seven focused proofs
(56 → 63 green), verified non-vacuous against a deliberately reverted token.

**No cache-bump decision remains pending for R3.**

## 20. PHASE-MANTA-B2B final architect acceptance and documentary closeout

STATUS: **PHASE-MANTA-B2B — CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT.**

Order `PHASE-MANTA-B2B-DOCUMENTARY-CLOSEOUT-R1` (documentation-only acceptance
closeout). The architect recorded **technical acceptance: ACCEPTED** and
**visual acceptance: ACCEPTED**. This section is the single consolidated
acceptance record of the phase; §17–§19 remain the untouched implementation and
correction records and are not rewritten. No product, test, harness, CSS,
JavaScript, `index.html`, migration, SQL, RPC, ACL/RLS, Auth or environment
change was authorized or made by this closeout.

### 20.1 Final accepted checkpoint

| Fact | Value |
|---|---|
| Final accepted checkpoint | `13f9dedc17da6324aa66a1271c3d07bbb7f11c11` |
| Parent | `0da96f0a333a194d2afb2c5c05470cf74ac97164` |
| Branch / publication boundary | `dev` / `staging/dev` |

### 20.2 B2B implementation and correction chain

| Commit | Order | Record | Nature |
|---|---|---|---|
| `bbd5f85` | `PHASE-MANTA-B2B-ROUTE-AWARE-UI-AND-READ-MODELS-R1` | §17 | route activation in the product surfaces; zero migrations |
| `3ed9c4a` | `PHASE-MANTA-B2B-ROUTE-SEMANTICS-AND-RESPONSIVE-VISUAL-CORRECTION-R2` | §18 | D1, D2, D4 closed; D3 closed for the required B2B surfaces |
| `4532f76` | `PHASE-MANTA-B2B-ADMIN-CLIENT-PREVIEW-ROUTE-POSITION-CORRECTION-R3` | §19.1–§19.5 | administrative client-preview route position |
| `0da96f0` | `PHASE-MANTA-B2B-R3-CACHE-BUST-CLOSEOUT-R1` | §19.6 | declarative asset invalidation only |
| `13f9ded` | final integrated quality sweep | this section | **test and harness only**; `js/**`, `css/**`, `index.html` and `db/**` byte-identical to `0da96f0` |

`13f9ded` carried no product change. It corrected the test corpus itself —
CRLF-versus-LF source reading (new `tests/_app-source.js`), slice boundaries
that required an adjacent sibling function, and ~50 assertions still calling
`extractInlineScript` after the boot entrypoint moved to `js/boot.js` — and
realigned stale contracts to their accepted owners by strengthening rather than
relaxing them. Structural gates held: `pedido-detail-events.js` 2709 lines,
`pedido-detail-progress.js` 918.

### 20.3 Final accepted route semantics

```
TAPETE:        INSUMOS → TECELAGEM → ACABAMENTO → EXPEDIÇÃO → ENTREGA
MANTA:         INSUMOS → TECELAGEM → EXPEDIÇÃO → ENTREGA
MIXED PEDIDO:  independent Tapete and Manta route sections
```

The route is derived from `modelos.tipo_produto` through `js/product-route.js`
and is never inferred from `ops.tipo`, names, width or suppliers. A homogeneous
Pedido degenerates to exactly one section. Neither route advances, completes or
blocks the other.

### 20.4 Final evidence package

Recorded by hash only. The archive, the screenshots and the external JSON
evidence files are **not** committed to this repository.

| Artefact | SHA-256 |
|---|---|
| `PHASE-MANTA-B2B-FINAL-VISUAL-EVIDENCE.zip` | `ca060772028040bf66e0187847ed7418bfaaa6999a7fa2098a69d4fe57ac7830` |
| `manifest.json` | `04848f401098552ea2b8c3226f1cb10789201a8bc2e488ee7937f0a6c2e3c928` |
| `failure-classification.json` | `a4e6e34645ce8926675bbb471b4e80fea3418e63fed2a997d9cf235fba8dd614` |

Accepted evidence results:

- 25 visual surfaces; 25/25 PNG hashes verified;
- 12/12 required visual proofs accepted;
- 0 document-level horizontal overflow;
- 0 console errors;
- 0 unreachable controls or required information;
- 0 B2B regressions;
- 0 relevant unresolved product defects.

The full 25-screenshot manifest is not reproduced here; the manifest hash above
is its identity.

### 20.5 Test and harness sweep result

`node --test tests/**/*.js` with the documented local static-server
prerequisite active: **4255 passing tests, 1 failure**. The sole failure is
`tests/g14-c-bridge-smoke.test.js`, classified **Category-E — external
repository**: it asserts a sibling-repository artefact
`D:\Programação\documents-ingestor\data\exports\documentos-mapeados.jsonl`
that does not exist in this workspace. No fixture was fabricated and the
failure is not suppressed. B2B impact: **none**.

### 20.6 Architect ruling on clipping and owned horizontal scrolling

`[data-rv-table-scroll]` and `[data-rv-stepper-scroll]` elements wider than
their containers are **accepted**, because their content remains reachable
through the scrolling those elements own. Local `text-overflow: ellipsis`
occurrences are **accepted** for the reviewed B2B surfaces, because no required
action, metric or route state is made inaccessible.

The accepted claim is therefore exactly:

- zero document-level overflow;
- zero unreachable required content.

The phase explicitly does **not** claim:

- zero elements with `scrollWidth > clientWidth`;
- global responsiveness across every application screen.

### 20.7 Accepted limitations

- **D3 is closed only for the B2B surfaces explicitly covered by the evidence
  contract.** The application is not accepted as globally responsive.
- **No per-route published position exists.** `status_cliente_visual` remains a
  Pedido-level curated commercial artefact owned by `db/30`; the accepted
  limitation recorded in §18.2 stands unchanged. A per-route *published*
  position would require a new read-model column and a separate order.

### 20.8 Nonblocking debts accepted with the phase

Recorded, not corrected. Neither debt blocks PHASE-MANTA-B2B.

**`G14-C-BRIDGE-EXTERNAL-CORPUS-DEPENDENCY`** — OPEN / NONBLOCKING FOR
PHASE-MANTA-B2B. Owner: documents-ingestor integration domain. Evidence:
`tests/g14-c-bridge-smoke.test.js`. Cause: requires the sibling-repository
artefact `D:\Programação\documents-ingestor\data\exports\documentos-mapeados.jsonl`.
B2B impact: none. No fixture may be fabricated and the failure may not be
silently suppressed.

**`DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR`** — OPEN / NONBLOCKING FOR
PHASE-MANTA-B2B. Owner: OP / yarn procurement domain. Symbol:
`window.atribuirFornecedorFioOp`, declared and exported by
`js/screens/op-writes.js` with no current application caller. Required future
decision: retire the helper or restore a legitimate owner/caller. It was
neither reconnected nor deleted by this closeout.

### 20.9 Environment state

Shared development `ucrjtfswnfdlxwtmxnoo` was **not accessed** at any point in
the B2B chain and remains at terminal `db/84` with the Manta backend dormant.
`db/85`–`db/88` remain **unapplied** to shared development. No staging
database, no production, no Supabase and no Vercel action occurred. B2B
introduced zero migrations and `db/**` is byte-unchanged across the whole chain.

### 20.10 Final phase status and next authorizable action

```
PHASE-MANTA-B2B:            CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT
FINAL ACCEPTED CHECKPOINT:  13f9dedc17da6324aa66a1271c3d07bbb7f11c11
SHARED DEVELOPMENT:         ucrjtfswnfdlxwtmxnoo at terminal db/84
PHASE-MANTA-B2C:            UNAUTHORIZED
```

The next authorizable action is `PHASE-MANTA-B2A-ARCHITECT-REVIEW` — a **review
action only**, over the db/85–db/88 record of §15 and §16, which still awaits
its own architect review. PHASE-MANTA-B2A is **not** accepted by this closeout.
PHASE-MANTA-B2C (shared-development apply of db/85–db/88, live validation and
closeout) remains unauthorized and requires its own separate explicit order. No
phase chains automatically.

## 21. PHASE-MANTA-B2A architect acceptance

STATUS: **PHASE-MANTA-B2A — CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT.**

The architect reviewed the db/85–db/88 record of §15 and §16 and issued the
binding ruling:

```
PHASE-MANTA-B2A:            ACCEPTED_WITH_NONBLOCKING_DEBT
PHASE-MANTA-B2C:            AUTHORIZED FOR SHARED DEVELOPMENT ONLY
TARGET:                     ucrjtfswnfdlxwtmxnoo
EXPECTED START TERMINAL:    db/84
AUTHORIZED FINAL TERMINAL:  db/88
```

§15 and §16 remain the untouched implementation and forward-correction records
and are not rewritten. The acceptance carries the two nonblocking debts already
recorded with PHASE-MANTA-B2B — `G14-C-BRIDGE-EXTERNAL-CORPUS-DEPENDENCY` and
`DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR` — neither of which was corrected
here. The ruling authorized shared development only; it did not authorize
production, Vercel, `main`, another Supabase project, or business-flow
recreation.

## 22. PHASE-MANTA-B2C shared-development activation, live validation and closeout

STATUS: **PHASE-MANTA-B2C — CLOSED / ACCEPTED.**

Order `PHASE-MANTA-B2C-SHARED-DEVELOPMENT-ACTIVATION-AND-LIVE-CLOSEOUT-R1`. The
accepted Manta direct-route backend is now **active on shared development**.
Exactly four forward-only migrations were applied, once each, in order, from
their canonical files. No product, test, harness, `js/**`, `css/**`,
`index.html` or `db/**` change was authorized or made. No production, staging
database, Vercel, `main`, `origin` or tag action occurred.

### 22.1 Target environment identity

| Fact | Value |
|---|---|
| Project | `ucrjtfswnfdlxwtmxnoo` (shared development) |
| Database / role | `postgres` / `postgres` |
| PostgreSQL | 17.6 |
| Positive identity proof | `inet_server_addr()` = `2600:1f18:38df:9501:5625:752d:c0e9:7c06` = AAAA of `db.ucrjtfswnfdlxwtmxnoo.supabase.co` |
| Negative identity proof | production `gqmpsxkxynrjvidfmojk` resolves to `2600:1f11:c29:8b01:…`, forbidden `bhgifjrfagkzubpyqpew` to `2600:1f1e:dbb:f602:…` — both distinct, neither ever connected to |
| Starting terminal | `db/84`; `db/85`–`db/88` absent; no partial B2A object set |
| Final terminal | `db/88` |

### 22.2 Pre-apply gates

The db/85 route/destination gate and the db/88 identity gate were reproduced
read-only before any mutation: **zero violations on every clause** — unresolved
`op_item_id`, dangling `op_item_id`, cross-OP `op_item`, unresolved
`modelos.tipo_produto`, mixed Tapete/Manta items, Tapete `cima` without
destination, Manta `cima` with destination, `modelo_id` divergent from its
`op_item`, and Manta `cima` with null `modelo_id`. Shared development held
**zero** `entregas.etapa = 'cima'` rows, so both gates were satisfied vacuously
and no row was repaired or reinterpreted.

The accepted db/81–db/84 object baseline was present in full — expedition source
exclusivity (`expedicoes_exactly_one_source_chk`,
`expedicoes_op_tecelagem_id_uk`), source identity and lineage guards
(`expedicoes_source_validation_guard`, `expedicao_itens_membership_guard`,
`op_itens_expedicao_reference_guard`), the Manta consumption freeze guards
(`entrega_itens_manta_consumo_guard`, `entregas_manta_consumo_guard`),
route-homogeneity protection (`op_itens_route_homogeneity_guard`,
`op_itens_source_nonempty_guard`) and the expected RLS and grants.
`entregas_destino_cima_chk` was still in place. The DDL window was clean: 0
blocked locks, 0 idle-in-transaction sessions, 0 other active sessions, 0
deadlocks. No session was terminated.

One benign pre-existing condition is recorded rather than treated as drift:
`entrega_itens_op_item_idx` already existed from db/31 as
`btree (op_id, op_item_id)`, so db/86's `CREATE INDEX IF NOT EXISTS … (op_item_id)`
is a no-op by name. This is identical on the accepted local cluster, where db/31
also precedes db/86, and the composite index still serves the
`op_item_id`-exact join because `op_id` is always constrained alongside it.

### 22.3 Apply mechanism and byte fidelity

Applied through the repository's canonical mechanism — Supabase MCP
`apply_migration`, one canonical file-stem per call, exactly once, stop-on-error,
no retry, no reordering, no rewritten or combined migration, nothing marked
applied without executing, and no `execute_sql` used for DDL.

Because the tool takes SQL as a string, each payload was proved byte-identical to
its canonical file **before** the apply (empty `diff` and identical SHA-256), and
after each apply the server-stored
`supabase_migrations.schema_migrations.statements` were whitespace-normalized and
md5-compared against the same normalization of the canonical file.

| Migration | Version | Result | Normalized md5 (stored = file) |
|---|---|---|---|
| `85_manta_cima_route_conditional_delivery` | `20260725145618` | SUCCESS | `d7950cc2a26c8ac9ff1508f4ecc37c65` |
| `86_manta_expedition_release_writer` | `20260725150126` | SUCCESS | `35d9868579e7060de71ab78ce95f4e3c` |
| `87_manta_expedition_reversal_and_route_completion` | `20260725150529` | SUCCESS | `28a8a17e11485e6c9ce8ed936b45fb22` |
| `88_manta_measured_output_identity_and_fk_lock_correction` | `20260725151405` | SUCCESS | `2e21d988c6cb08bbc8363b461f39036f` |

### 22.4 Post-apply object validation

**db/85** — `entregas_destino_cima_chk` removed; both route-aware triggers
(`entrega_itens_cima_route_destino_guard`, `entregas_cima_destino_route_guard`)
installed; Manta `cima` requires no destination and Tapete `cima` still requires
one; mixed and unresolved source rejected; the Manta output writer is atomic and
creates no Latex state — its body contains no `gerar_op_latex`,
`gerar_op_latex_split` or `op_latex_entregas` reference.

**db/86** — `public.expedicao_comandos` exists; unique identity is
`(idempotency_namespace, ator_id, idempotency_key)`; command rows are immutable
via `expedicao_comandos_immutable_guard` (BEFORE UPDATE OR DELETE); RLS enabled;
the admin read policy `expedicao_comandos_admin_read` is present; `anon`,
`authenticated` and `PUBLIC` hold **no** table privilege;
`consultar_saldo_expedicao_manta` installed; release authority is measured output
by exact `op_item_id`; the plan is display-only; additive partial release and
replay behavior preserved.

**db/87** — `estornar_expedicao_manta_parcial(bigint, jsonb, text, text)`
installed; blank reason rejected; reversal cannot go below delivered metres; the
release and reversal command namespaces remain separate by CHECK;
`concluir_pedido_se_pronto` retains its single `(p_pedido_id uuid)` overload,
authorization and Tapete behavior with the pendency messages verbatim; Manta
completion pendencies are route-symmetric.

**db/88** — the terminal function bodies are the db/88 versions; Manta
measured-output `modelo_id` is exact and mandatory; the referenced `op_item`
identity is frozen after measured output by
`op_itens_manta_output_reference_guard`; both Manta writers pre-lock the affected
`op_itens` ascending `FOR KEY SHARE` and re-read identity post-lock; the direct
expedition-item membership guard uses the corrected order.

### 22.5 Security and authorization

Every new public RPC is `SECURITY DEFINER` with `search_path = public` and an
`is_admin()` gate; `EXECUTE` is held only by `authenticated` (plus the Supabase
default `service_role`) with **no** `PUBLIC` and **no** `anon` grant. The
`expedicao_comandos_immutable_guard_fn` uses `search_path = ''` and is revoked
from every client role.

No unrelated table grant or RLS policy changed: the `anon`/`authenticated`
grants on `entregas`, `entrega_itens`, `op_itens`, `expedicoes` and
`expedicao_itens` and the per-table policy counts are byte-identical to the
pre-apply baseline, and `is_admin`, `recalcular_status_expedicao`,
`entrega_itens_manta_consumo_guard_fn` and `op_itens_route_homogeneity_guard_fn`
carry unchanged definition hashes. The Latex writers `gerar_op_latex`,
`liberar_expedicao_latex_parcial` and `consultar_saldo_expedicao_latex` are not
targeted by any statement in db/85–db/88 and are unchanged.

No `app.retificacao_autorizada` path was granted to any writer: db/85–db/88
contain **zero** `current_setting()` calls and every occurrence of that string is
a comment or an error message asserting the absence of a bypass.

`concluir_pedido_se_pronto` retains the broad pre-existing `EXECUTE` grants it
has carried since db/23. db/87 issues no `GRANT`/`REVOKE` on it and
`CREATE OR REPLACE` preserves privileges, so those grants are unchanged by
construction and the function remains gated internally by `is_admin()`.

### 22.6 Live synthetic validation

One bounded validation ran inside an explicit transaction ending in `ROLLBACK`,
using unique synthetic identifiers only (`B2C SYN …`, `numero` 900001–900005,
`…@example.invalid`) and an authenticated admin actor simulated through a
transaction-local `request.jwt.claims`. **20 of 20 required proofs passed**, with
no fatal error:

1. Manta measured output registered with no finishing destination (`ok=true`,
   `destino_fornecedor_id` NULL).
2. The Manta output created no Latex OP and no `op_latex_entregas` relationship.
3. Tapete `cima` without finishing destination rejected by the item guard.
4. Tapete's existing valid destination path still accepted.
5. Manta balance computed by exact `op_item_id` (40.00 and 25.00 held separate).
6. Defective measured output excluded (`+15` defect left `recebido` at 40.00).
7. Planned metres did not raise the available balance (`previsto` 100.00 versus
   `disponivel` 40.00).
8. Partial release succeeded (`liberado_total` 10.00).
9. A further release was additive (10.00 → 25.00 in the same expedition).
10. Over-release rejected (`excede_disponivel`).
11. An identical replay returned the byte-identical result with zero mutation
    (command rows 1 → 1, released metres 30 → 30).
12. The same key with a changed request rejected (`idempotencia_conflitante`).
13. Blank reversal reason rejected (`motivo_obrigatorio`).
14. Reversal below delivered metres rejected (`abaixo_do_entregue`).
15. A valid reversal reconciled balances (`liberado` 15.00, `disponivel` 25.00).
16. A Manta-only Pedido could not conclude and reported both Manta pendencies.
17. Tapete completion behavior unchanged (`Ha acabamento finalizado sem
    expedicao` verbatim).
18. A mixed Pedido reported the Manta and Tapete pendencies independently.
19. Non-admin calls rejected with `sem_permissao` on all four new RPCs.
20. The rollback left zero synthetic business rows and zero command rows.

Shared-development concurrency drills were **not** run — the accepted
PHASE-MANTA-B2A disposable-cluster evidence owns concurrency validation — and no
persistent fixture was created to reproduce the local concurrency suite.

### 22.7 Zero-residue proof

After the rollback, shared development holds **zero** rows in `entregas`,
`entrega_itens`, `expedicoes`, `expedicao_itens`, `expedicao_comandos`,
`pedidos`, `lotes`, `ops`, `op_itens`, `op_eventos` and `pedido_eventos`; the
synthetic-identifier sweep returns zero on every pattern; and the reference data
is unchanged (`modelos` 12, `fornecedores` 6, `clientes` 4, `usuarios` 10,
`auth.users` 10). Deadlocks and blocked locks remain 0. No real business row was
created, edited, migrated or repaired at any point, and no historical production
flow was recreated.

### 22.8 Regression validation

| Command | Exit | Result |
|---|---|---|
| `node tests/manta-direct-route-activation-invariant.mjs` | 0 | `MANTA_DIRECT_ROUTE_ACTIVATION_INVARIANT_PASS` (proofs A, B, C, D, E1, E2; 0 server-reported deadlocks) |
| `node tests/manta-expedition-source-invariant.mjs` | 0 | `failures=0 / ALL_PROOFS_PASSED` |
| `node tests/ordem-compra-c3d-deploy.smoke.js` | 0 | 36/36 pass |
| `node --test tests/**/*.js` | 1 | **4256 tests / 4255 pass / 1 fail** |

The sole failure is `tests/g14-c-bridge-smoke.test.js`, the accepted
`G14-C-BRIDGE-EXTERNAL-CORPUS-DEPENDENCY` Category-E external-repository
dependency. **No new failure.** The documented local server prerequisite on port
`8765` was active for the full sweep.

### 22.9 Nonblocking debts

Both debts accepted with PHASE-MANTA-B2B and carried by the PHASE-MANTA-B2A
acceptance remain open and uncorrected:
`G14-C-BRIDGE-EXTERNAL-CORPUS-DEPENDENCY` (documents-ingestor integration
domain) and `DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR` (OP / yarn procurement
domain). Each requires its own separate order. The
`docs/governance/catalog/documents.json` metadata drift remains a separate
nonblocking governance debt and, per the order, did not delay activation and was
not touched.

### 22.10 Final phase status and next authorizable action

```
PHASE-MANTA-B2A:      CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBT
PHASE-MANTA-B2C:      CLOSED / ACCEPTED
SHARED DEVELOPMENT:   ucrjtfswnfdlxwtmxnoo at terminal db/88
                      Manta direct-route backend ACTIVE
PRODUCTION:           UNCHANGED / NOT ACCESSED
NEXT ACTION:          KLEBER-APP-OPERATIONAL-REVIEW
MODE:                 HUMAN PRODUCT REVIEW / DEFECT INTAKE
```

The next action is **not** a broad refactor. Kleber will use the application and
report concrete operational defects; those defects will later be grouped into one
bounded stabilization order rather than corrected through isolated microphases.
Production, Vercel, `main`, `origin`, tags, any further migration and any
additional publication each require a new explicit order. No phase chains
automatically.
