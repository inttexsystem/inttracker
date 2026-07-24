# Manta Direct Route — PHASE-MANTA-B Phase Contract

STATUS: PHASE-MANTA-B1 IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED /
AWAITING ARCHITECT REVIEW. PHASE-MANTA-B1 remains open. PHASE-MANTA-B2 (route
activation) is NOT authorized and no phase chains automatically.

Orders (B1): `PHASE-MANTA-B1-EXPEDITION-SOURCE-FOUNDATION-R1` (db/81),
`PHASE-MANTA-B1-SOURCE-MEMBERSHIP-AND-LOCK-ORDER-CORRECTION-R1` (db/82, §11) and
`PHASE-MANTA-B1-SOURCE-ROUTE-AND-ITEM-IDENTITY-CORRECTION-R1` (db/83, §12).
Predecessor: `MANTA_PRODUCT_VARIANT_PHASE_CONTRACT.md` (PHASE-MANTA-A, CLOSED /
ACCEPTED — product identity + route homogeneity, db/78–db/80). This contract owns
the Manta **direct weaving→client route** semantics; PHASE-MANTA-A remains the
owner of Manta product identity. §11 records the db/82 forward correction, §12 the
db/83 forward correction; the db/81 sections below are preserved and read with
§11 and §12 applied.

## 1. Objective and boundary

PHASE-MANTA-B delivers the Manta direct weaving→client route. It is split:

- **PHASE-MANTA-B1 (this migration, db/81)** — the **dormant database
  foundation** for Manta-sourced expeditions: a second authoritative expedition
  source, cross-table source integrity, consumed-output immutability, an OP
  reopening restriction, and concurrency-safe invariants. B1 does **not** make the
  route operationally callable: no UI action, no RPC, and no writer creates a
  Manta expedition after db/81. `entregas.etapa='cima'` and
  `entregas_destino_cima_chk` are unchanged; `salvarEntregaCima` is unchanged; no
  new `entregas.etapa` value is created; Manta never calls `gerar_op_latex` /
  `gerar_op_latex_split`.
- **PHASE-MANTA-B2 (not authorized here)** — activates the route: the Manta
  expedition writer, the route-conditional `cima` destination relaxation, the
  balance-preserving reversal/correction writer, the dynamic Manta stepper, and
  any progress/read-model branch. Each requires a separate explicit order.

## 2. Binding business rulings (implemented in db/81)

**BR-1 — Weaving-output authority.** Manta expedition eligibility derives
**exclusively** from measured weaving output: `public.entregas` +
`public.entrega_itens` with non-defect `metros_entregues`. The OP plan is **not**
expedition authority.

**BR-2 — Delivery token.** `entregas.etapa='cima'` is reused unchanged as the
measured weaving output. `cima` is the output from weaving; a Tapete `cima`
requires a finishing destination, a Manta `cima` has none. **No** new
`entregas.etapa` value is created; Manta never enters finishing. The
route-conditional destination relaxation and the Manta expedition **writer** are
deferred to PHASE-MANTA-B2; B1 does **not** weaken the current Tapete
`entregas_destino_cima_chk`.

**BR-3 — Correction and reopening.** Before any positive expedition release an
authorized administrative correction may alter the measured weaving output, and a
Manta OP may be reopened if the existing state machine (`db/21 alterar_status_op`)
otherwise permits it. After any `expedicao_itens.metros_liberados > 0` through the
OP:

- the Manta weaving output is immutable through normal writes;
- the Manta OP cannot be reopened;
- correction requires an explicit atomic administrative reversal/correction flow;
- `app.retificacao_autorizada` is the only controlled technical escape (no UI
  enables it, no general authenticated writer receives it);
- until a balance-preserving reversal writer exists, the guards **fail closed**.
  B1 implements no reversal/correction writer.

## 3. Expedition-source architecture (accepted)

An expedition has exactly **one typed source**, never both and never neither:

- `expedicoes.op_latex_id` — the **Tapete finishing** source (`ops.tipo='latex'`),
  unchanged from db/23; now nullable, FK and `UNIQUE(op_latex_id)` preserved.
- `expedicoes.op_tecelagem_id` — the **Manta weaving** source (new in db/81),
  `BIGINT NULL REFERENCES public.ops(id) ON DELETE RESTRICT`.

Integrity:

- `expedicoes_exactly_one_source_chk`:
  `(op_latex_id IS NOT NULL) <> (op_tecelagem_id IS NOT NULL)`.
- Partial unique index `expedicoes_op_tecelagem_id_uk` on `op_tecelagem_id WHERE
  op_tecelagem_id IS NOT NULL` — **one expedition per Manta weaving OP** and the
  lookup access path (no separate index needed).
- `op_tecelagem_id` may reference only `ops.tipo='tecelagem'`, a non-empty
  route-homogeneous OP whose every `op_item` resolves to
  `modelos.tipo_produto='manta'`. A Tapete, mixed, empty, or deleted OP is
  rejected. Manta is derived from `modelos.tipo_produto` (db/78), **never** a
  name. Source identity is stable under db/78–db/80 (route homogeneity +
  model-reference immutability).

Existing rows (`op_latex_id` non-null, `op_tecelagem_id` null) remain valid and
unchanged.

## 4. Database (`db/81_manta_expedition_source_foundation.sql`)

Single forward-only, idempotent migration. Authoritative guards (all
`SECURITY DEFINER`, `SET search_path = public`, BEFORE triggers → no partial
write; trigger functions need no EXECUTE grant):

1. `expedicoes_source_validation_guard` (BEFORE INSERT / source-changing UPDATE) —
   serializes on the affected source OP row(s) `FOR UPDATE` (ascending `op_id`)
   before inspecting; validates the source type/route; rejects a source change
   that would orphan existing expedition items (except under the escape).
2. `expedicao_itens_membership_guard` (BEFORE INSERT / membership-changing UPDATE)
   — every `op_item_id` must belong to the expedition's selected source OP
   (`op_latex_id` for Latex, `op_tecelagem_id` for Manta); rejects cross-OP
   injection; locks the item's OP and the source OP `FOR UPDATE`, then the
   expedition, then validates. A `metros_entregues`-only UPDATE (delivery path) is
   untouched.
3. `op_itens_expedicao_reference_guard` (BEFORE UPDATE) — rejects relocating an
   `op_item` (changing `op_id`) while it is referenced by an expedition (except
   under the escape). Deletion is already blocked by
   `expedicao_itens.op_item_id → op_itens ON DELETE RESTRICT`.
4. `entrega_itens_manta_consumo_guard` (BEFORE UPDATE / DELETE) — after consumption
   (a Manta-sourced expedition with `metros_liberados > 0` references the
   `op_item`), rejects UPDATE of `op_id`/`op_item_id`/`metros_entregues`/`defeito`
   and DELETE (except under the escape). Composes with the db/24
   `entrega_itens_cima_latex_guard` (which covers only Latex-linked output; Manta
   `cima` output is never Latex-linked).
5. `entregas_manta_consumo_guard` (BEFORE UPDATE / DELETE) — rejects a header
   mutation of an `entregas` row that owns consumed Manta output (except under the
   escape).
6. `ops_manta_reopen_guard` (BEFORE UPDATE) — rejects a terminal→non-terminal
   `ops.status` transition of a consumed Manta weaving OP (except under the
   escape). Inert before positive release, so `db/21 alterar_status_op` behavior is
   preserved; Tapete/`op_latex_id` OPs never match.

**Global deterministic lock order** (reconciled with db/79/db/80 and the
db/31/db/32 expedition/delivery functions; no db/81 path takes these in reverse):

1. `pedidos` row (only when completion is involved — not in db/81);
2. affected `public.ops` rows, ascending `op_id` (`FOR UPDATE`);
3. affected `public.modelos` rows, ascending `modelo_id` (`FOR SHARE`, db/80 — not
   re-taken by db/81; a source OP's op_item models are immutable once referenced,
   so their `tipo_produto` is read unlocked);
4. `entregas` / `entrega_itens`;
5. `expedicoes`;
6. `expedicao_itens`.

The db/31/db/32 functions already lock the owning `ops` row before that op's
`op_itens`/`entrega_itens`/`expedicoes`, so the new `expedicoes`/`expedicao_itens`
triggers only re-enter locks the caller already holds.

## 5. Correction and reopening policy

`app.retificacao_autorizada = 'on'` (the established db/24/25/36/37 escape idiom,
NULL-safe `current_setting('app.retificacao_autorizada', true)`) is the single
controlled technical escape honored by all four consumption/reopening guards. It
is set only by an explicitly authorized flow (e.g. the db/37 controlled-delete
`remover_op`/`remover_pedido`, which delete consumed rows under the escape); no UI
enables it and no general authenticated writer receives it. A future
balance-preserving reversal/correction writer (PHASE-MANTA-B2) will be the auditable
consumer of the escape for live correction. Until it exists, B1 fails closed.

## 6. Route sequences and UI ruling (binding)

- **Tapete**: Insumos → Tecelagem → **Acabamento** → Expedição → Entrega
  (source `op_latex_id`).
- **Manta**: Insumos → Tecelagem → Expedição → Entrega (source `op_tecelagem_id`;
  no Acabamento).

UI route ruling (as accepted in PHASE-MANTA-A §9, unchanged and not implemented in
B1): the Manta stepper omits Acabamento entirely; Tapete retains it; a mixed Pedido
represents its two applicable routes separately; a single fixed linear stepper must
not falsely represent a mixed Pedido. The dynamic Manta stepper and any
route-aware progress are **PHASE-MANTA-B2 UI items** — B1 changes no product UI,
stepper, or progress behavior.

## 7. Implementation and activation boundaries (B1 / B2 separation)

After db/81 (dormant foundation requirement):

- no current UI action can create a Manta expedition;
- no existing RPC silently starts accepting Manta (`liberar_expedicao`,
  `liberar_expedicao_latex_parcial`, `registrar_entrega_expedicao` remain
  Latex-only and are unchanged);
- current Tapete expedition behavior is unchanged;
- `entregas_destino_cima_chk` is unchanged; `salvarEntregaCima` is unchanged;
- no direct-route RPC is created; no progress or stepper behavior changes.

PHASE-MANTA-B2 activates the route separately.

## 8. Tests (disposable PostgreSQL 18.4 only)

- `tests/manta-expedition-source.integration.sql` — one-transaction, rolled-back
  proof of every db/81 guard: exactly-one-source (both/neither rejected); valid
  Latex accepted; valid homogeneous Manta accepted; Tapete/empty/mixed weaving
  source rejected; duplicate Manta source rejected; membership accept + cross-OP
  reject (Manta and Latex); orphaning source change rejected; referenced op_item
  move rejected + delete rejected (FK); unconsumed output correctable; consumed
  output UPDATE/DELETE + header mutation rejected; the `app.retificacao_autorizada`
  escape proven inside the rolled-back transaction; Manta reopen after release
  rejected; reopen before release inert; Tapete reopen unaffected.
- `tests/manta-expedition-source-invariant.mjs` — disposable-cluster harness: full
  db/01..81 apply; db/81 idempotent re-apply with zero schema/constraint/trigger/
  function/grant drift; the integration test above; regression (db/78–80 identity
  integration, Manta finishing rejection intact in `gerar_op_latex`/`_split`, C5A
  emission on the reconciled 64/51/51 corpus); and distinct-session concurrency —
  E1 two creations for one Manta OP → one commit + one controlled rejection (loser
  blocks on the source-OP lock), E2 a cross-OP item writer blocks on the source-OP
  lock then is rejected against the committed source (item writes cannot cross
  sources or overtake a source change), E3 different Manta OPs do not serialize and
  no deadlock (`40P01`) — cluster then destroyed with PID/port/dir proof.
- `tests/ordem-compra-c3d-deploy.smoke.js` — migration terminal advanced 80 → 81
  (terminal two `db/80`/`db/81`; db/81 checkpoint-hash + byte-stability added).

The frozen phase `.mjs` harnesses of earlier phases
(`tests/manta-product-identity-invariant.mjs` at terminal 80,
`tests/ordem-compra-c3d-lock-concurrency.mjs` at 76,
`tests/clean-slate-transactional-reset.smoke.mjs` at 77) are intentionally left at
their authoring terminal (the established pattern: db/77–80 did not re-pin older
frozen harnesses); B1 validation is carried by the new harness above.

## 9. Hard stops (honored)

No hard stop was hit: db/78–db/80 were not modified; the established lock order is
compatible (ops→modelos→entregas→expedicoes→expedicao_itens, ascending); no Manta
writer was activated; `entregas_destino_cima_chk` was not relaxed; exactly one
migration was created; source-item membership, consumed-output immutability, and
distinct-session concurrency are all authoritatively proven; no shared-development
access was used; the baseline matched.

## 10. Status and next authorizable action

PHASE-MANTA-B1 is IMPLEMENTED / LOCALLY AND CONCURRENTLY VERIFIED / AWAITING
ARCHITECT REVIEW; it remains open. db/81, db/82 and db/83 are versioned in the
repository and applied only to disposable local clusters — **no shared-development,
staging, or production apply** is authorized by these orders. The next
authorizable action is architect review of PHASE-MANTA-B1 (db/81 + the db/82 and
db/83 corrections); PHASE-MANTA-B2 (route activation) requires a new explicit
order and does not chain automatically.

## 11. Forward correction — db/82 (source immutability, post-lock membership, source non-emptiness)

`db/82_manta_expedition_source_invariant_correction.sql` (order
`PHASE-MANTA-B1-SOURCE-MEMBERSHIP-AND-LOCK-ORDER-CORRECTION-R1`) forward-corrects
three defects in db/81 without editing db/78–db/81 (forward-only policy). The three
db/81 guards it touches are read with these corrections applied; §3–§5 above stand
otherwise unchanged. Migration terminal advanced 81 → 82.

1. **Source identity immutability (lock-inversion removal).** db/81's
   `expedicoes_source_validation_guard` permitted a source-changing UPDATE (rejecting
   only an orphaning one). Such an UPDATE has PostgreSQL take the `expedicoes`
   target-row lock BEFORE the trigger, which then acquired source-OP locks — an
   `expedicoes`-row → `ops`-row inversion of the canonical order. db/82 makes the
   selected source **immutable after INSERT**: any UPDATE changing `op_latex_id` or
   `op_tecelagem_id` fails closed BEFORE any source-OP lock, with **no
   `app.retificacao_autorizada` bypass**. A future source correction is a separately
   designed atomic RPC + migration, never a direct UPDATE. No normal source-changing
   UPDATE exists after db/82, so the inversion is structurally impossible. Ordinary
   status/timestamp/delivery-progress UPDATEs are unaffected and take no lock.

2. **Membership validated after lock acquisition (stale-read removal).** db/81's
   `expedicao_itens_membership_guard` read `op_itens.op_id` for `NEW.op_item_id`
   BEFORE waiting on the OP lock, so a concurrent op_item move that committed while
   the guard waited was validated against stale ownership. db/82 resolves the source
   as a candidate, locks the source OP `FOR UPDATE`, and only AFTER the lock re-reads
   both the (now immutable) source and the CURRENT `op_itens.op_id`, validating with
   post-lock values only — an item that moved is rejected against its newly committed
   OP. Because the source is immutable, the guard no longer locks the `expedicoes`
   row (removing that row lock from the membership path entirely).

3. **Source OP must remain non-empty.** New `op_itens_source_nonempty_guard` (BEFORE
   DELETE, and BEFORE UPDATE that changes `op_id`) locks the affected OP row(s) `FOR
   UPDATE` ascending FIRST (serialising concurrent removals and concurrent expedition
   creation on the same OP), then, if `OLD.op_id` is a selected expedition source
   (`op_latex_id` OR `op_tecelagem_id` — uniform for Latex and Manta), rejects the
   operation when it would leave that OP with zero items (counted under the lock,
   excluding the row being moved/deleted). No `app.retificacao_autorizada` bypass for
   emptying a source. The stronger db/81 rule (a referenced op_item cannot
   move/delete) is retained (reference guard + FK ON DELETE RESTRICT). The
   controlled-delete cascade (db/37) is unaffected: it removes the referencing
   expedicoes before the ops cascade, so `OLD.op_id` is no longer a source when the
   op_itens cascade-delete fires.

**Effective lock order after db/82** (reconciling the implicit BEFORE-UPDATE
target-row lock, not only explicit `FOR UPDATE`): affected source OP rows ascending
(`FOR UPDATE`) → immutable source read (no `expedicoes` row lock in the membership
guard) → expedition-item write. No source-changing `expedicoes` UPDATE survives, so
no `expedicoes`-row → `ops`-row path exists; all op_itens guards (db/79/80/81/82) lock
ops rows ascending; db/31/db/32 lock the owning ops row first. No path is reversed.

**Tests (db/82).** `tests/manta-expedition-source.integration.sql` is run UNCHANGED
against db/01..82 (its source-change and referenced-move/delete rejections now come
from the stronger db/82 guards; still rejected). `tests/manta-expedition-source-invariant.mjs`
applies db/01..82, re-applies db/82 idempotently (zero drift), runs that integration
test + the db/78–80 / finishing / C5A regressions, and adds distinct-session Tests
A–H: A item-move-wins (insert rejected post-lock, zero invalid items), B
membership-insert-wins (later move rejected by the reference guard), C source-change
rejected without taking an OP lock (no block on a held source-OP lock; concurrent
membership insert completes; no `40P01`), D last-item move rejected, E last-item
delete rejected, F concurrent 2-item-source removals serialize (one commits, ≥1
remains), G non-last unreferenced removal accepted + referenced item FK-protected, H
db/81 regressions (one-expedition-per-Manta-OP, cross-OP injection rejected,
different-OP non-serialization, Tapete Latex expedition accepted) — cluster destroyed
with PID/port/dir proof. `tests/ordem-compra-c3d-deploy.smoke.js` advanced 81 → 82
(terminal two `db/81`/`db/82`).

## 12. Forward correction — db/83 (source route + item identity)

`db/83_manta_expedition_source_identity_correction.sql` (order
`PHASE-MANTA-B1-SOURCE-ROUTE-AND-ITEM-IDENTITY-CORRECTION-R1`) completes the
dormant B1 database foundation by making the selected source OP's route identity
and each expedition item's redundant identity authoritative and stable,
forward-correcting db/81/db/82 without editing db/78–db/82 (forward-only policy).
Migration terminal advanced 82 → 83. Final invariants: (1) a selected Manta
weaving source remains a Manta weaving source; (2) a selected Latex source
remains a Latex/Tapete finishing source; (3) an expedition item identifies
exactly the same model and Pedido item as its referenced op_item; (4) an op_item
already referenced by an expedition cannot silently change that identity.

1. **Source OP type immutability (BLOCKER A).** New
   `ops_source_type_immutability_guard` (BEFORE UPDATE on `public.ops`): while an
   OP is referenced by `expedicoes.op_latex_id` or `op_tecelagem_id` (either
   column), changing `ops.tipo` is rejected; same-value updates remain permitted;
   `ops.status` transitions are untouched (db/21 `alterar_status_op` and the
   db/81 `ops_manta_reopen_guard` preserved). No `app.retificacao_autorizada`
   bypass; a source-type conversion requires a separate atomic design. Sufficient
   as a single any-column check because `ops.tipo` only ever takes two values
   (db/08 `ops_tipo_chk`) and the source-validation guard already ties each
   source column to its required type at INSERT (db/81), immutable thereafter
   (db/82 A).

2. **Source product route immutability, incl. single-item (BLOCKER B).**
   Forward-corrects `op_itens_route_homogeneity_guard_fn` (db/78/79/80), which
   only rejected MIXING two product types within one OP — a single-item OP has
   no "other" item to compare against, so flipping that sole item's product type
   was not caught when the OP is already a selected source. This correction
   adds, after the existing ops-ascending/modelos-ascending locks: if the
   destination `op_id` is currently selected as an `op_tecelagem_id` source,
   every item must resolve to `tipo_produto='manta'`; if selected as an
   `op_latex_id` source, every item must resolve to `tipo_produto='tapete'`.
   Applies to INSERT and UPDATE of `op_id`/`modelo_id`. Product type is still
   derived only through `modelos.tipo_produto`, never a name. The db/79/80
   mixing check and lock order are otherwise unchanged. The `expedicoes` read is
   unlocked and race-free: the ops row for the destination is already held `FOR
   UPDATE`, and the only way an OP becomes newly selected as a source
   (`expedicoes_source_validation_guard_fn`'s INSERT path) locks that same ops
   row `FOR UPDATE` first.

3. **Expedition item identity alignment (BLOCKER C).** Forward-corrects
   `expedicao_itens_membership_guard_fn` (db/81/82). The db/82 early-return only
   inspected `op_item_id`/`expedicao_id`, so a delivery-path-shaped UPDATE that
   also changed `modelo_id` or `pedido_item_id` skipped validation entirely.
   This correction widens the early-return to require all four identity columns
   unchanged before skipping (a genuine quantity/timestamp-only UPDATE stays
   untouched), and, after the db/82 post-lock OP-membership re-read, additionally
   re-reads the current op_item's `modelo_id`/`pedido_item_id` and requires
   `NEW.modelo_id = op_itens.modelo_id` and `NEW.pedido_item_id IS NOT DISTINCT
   FROM op_itens.pedido_item_id` (exact mirror, including NULL=NULL). Repository
   evidence (db/23 `liberar_expedicao`, db/31
   `liberar_expedicao_latex_parcial`, db/32 direct-movement RPC) shows every
   existing writer already sources both fields directly from the op_item's own
   row with no divergent case, so strict equality is the proven canonical
   compatibility rule. The guard rejects inconsistent input; it does not rewrite
   the payload.

4. **Referenced op_item identity immutability (BLOCKER D).** Forward-corrects
   `op_itens_expedicao_reference_guard_fn` (db/81), which only protected
   `op_id`. This correction widens the protected fields to `op_id`, `modelo_id`
   and `pedido_item_id`: while an op_item is referenced by any
   `expedicao_itens` row, a change to any of the three is rejected (same-value
   updates permitted; any other column, e.g. `metros_pedidos`, untouched);
   protects both Latex- and Manta-sourced expeditions uniformly. **No
   `app.retificacao_autorizada` bypass for these identity fields in B1**
   (removed by this correction) — a future correction must update the complete
   expedition/source graph atomically. The db/37 controlled-delete cascade is
   unaffected: it DELETEs the owning `expedicao_itens` rows before `op_itens`
   is ever touched, and `op_itens` is only ever removed via the `ops` `ON
   DELETE CASCADE`, never a direct UPDATE of a still-referenced row.

**Reconciled lock order (db/83).** 1. affected `public.ops` rows, ascending
`op_id` (`FOR UPDATE`); 2. affected `public.modelos` rows, ascending
`modelo_id` (`FOR SHARE`, db/80); 3. inspect selected expedition-source
references (`public.expedicoes`; unlocked, race-free per BLOCKER B); 4. validate
source route (B) and expedition-item identity (C/D); 5. continue the row write.
Trigger firing order on `public.op_itens` (BEFORE, alphabetical, unchanged):
`op_itens_expedicao_reference_guard` (D) → `op_itens_route_homogeneity_guard`
(B) → `op_itens_source_nonempty_guard` (db/82 C) — D rejects an identity change
on a referenced item before B's route check ever runs for that row. On
`public.ops`: `ops_manta_reopen_guard` (db/81) → `ops_source_type_immutability_guard`
(A) — independent columns, no interaction. Blocker A takes no lock beyond the
implicit target-row lock an UPDATE already holds; Blocker D takes the same
ops-ascending lock as db/79/80/82, so a concurrent Blocker-C membership insert
and a concurrent Blocker-A/D identity write always serialize on that single ops
row — no second resource is ever acquired by either side, so no cross-guard
deadlock is possible.

**Tests (db/83).** `tests/manta-expedition-source.integration.sql` is extended
(not left unchanged, per the order's discretion) with sequential proofs 20–36 in
the same rolled-back transaction: selected Manta/Latex source `ops.tipo` change
rejected incl. no retificacao bypass, same-value permitted; single-item Manta/Latex
source model flip rejected; multi-item Manta source receiving a Tapete item
rejected; unreferenced-OP same-route model change stays permitted; a correctly
aligned expedition item accepted; wrong `modelo_id`, wrong `pedido_item_id` on a
correct op_item, an arbitrary non-null `pedido_item_id` on a NULL-origin item, and
a NULL `pedido_item_id` on a non-null-origin item all rejected; a quantity-only
expedition-item update stays accepted; a referenced op_item's `modelo_id`/
`pedido_item_id`/`op_id` change rejected incl. no retificacao bypass; a
non-identity column update on a referenced item stays accepted.
`tests/manta-expedition-source-invariant.mjs` applies db/01..83, re-applies db/83
idempotently (zero drift), runs the extended integration test + the db/78–80 /
finishing / C5A regressions and the (unchanged) db/82 distinct-session Tests A–H,
and adds four more: I source-model-change-wins (a holder session serializes both
the model-change attempt and a concurrent membership insert; the change is
rejected, the insert completes observing no route flip), J membership-insert-wins
(a real insert commits while a concurrent `modelo_id` change waits on the source
OP; the change is then rejected against the freshly committed reference), K
OP-type-change-vs-membership (same holder pattern on the `ops` row; the type
change is rejected, the membership insert completes, no `40P01`), L
two-identity-change no-deadlock (two sessions swap items between two Manta
sources in opposing directions; deterministic ascending OP-id lock order
serializes them without deadlock; both commit; both sources stay homogeneous
Manta) — cluster destroyed with PID/port/dir proof. `tests/ordem-compra-c3d-deploy.smoke.js`
advanced 82 → 83 (terminal two `db/82`/`db/83`).
