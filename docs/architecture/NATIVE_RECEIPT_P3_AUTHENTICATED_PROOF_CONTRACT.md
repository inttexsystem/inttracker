# Native receipt — P3 authenticated proof contract

Canonical execution authority for `NATIVE-RECEIPT-COORDINATED-RELEASE-P3-AUTHENTICATED-PROOF`.

```
P2 CLOSED / ACCEPTED
P3 CLOSED / ACCEPTED
P4 NOT AUTHORIZED
P5 NOT AUTHORIZED
NATIVE RECEIPT INACTIVE
```

**Refoundation R5 (2026-08-01).** This contract was refounded, not amended
again. R1–R4 had layered mechanical overrides on mechanical prose until the
active authority carried a second, stale implementation oracle competing with
the executable owners — which is what produced the R4 scenario-oracle defects.
R1–R4 and their evidence remain reachable as historical, non-normative context
(section 14); they are no longer normative.

**This file owns** purpose, scope, environment and mutation boundaries,
identity and authorization intent, scenario intent, the P3/P4 boundary,
isolation intent, the failure-injection constraint, teardown intent,
production-untouched intent, evidence requirements and classification, and the
acceptance and hard-stop boundaries.

**This file does not own mechanics.** Signatures, argument names and order,
return columns, refusal codes and SQLSTATEs, guard bodies, trigger conditions,
transition graphs, constraint names, cardinalities, hashes, counters and
terminal migration values belong to their executable owners — `db/*.sql`, the
live catalogue of the target cluster, `js/`, `tests/` and `scripts/`. The
executor DERIVES them by direct measurement at execution time and records the
derived value as evidence. Per `docs/governance/AGENT_INSTRUCTIONS.md`
section 13, current direct measurement wins an obsolete dynamic literal, and
prose is never an implementation oracle where an executable owner exists.

It owns no product semantics. The accepted functional specification remains
section 9 (`R1`–`R13`, `D1`–`D7`) and the accepted technical design section 9.9
of `docs/architecture/PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md`, whose
section 9.9.Q owns the authenticated acceptance intent; this file enumerates it
and never contradicts it.

**Authorising this contract does not authorise scenario mutation.** Executing
any part of section 6 or section 7 requires a separate explicit P3 RESUMPTION
order naming the environment and the permitted operation.

---

## 1. P3 purpose

P3 is the authenticated mutation proof of the coordinated native-receipt
release. Every new frontend caller introduced by P2 is exercised through the
canonical P1 server RPCs, under real authenticated identities, against a
**disposable database restored from a production dump** — never against
production rows and never against production itself.

P3 proves that the new callers work, that wrong identities are refused, and
that the isolation between synthetic proof data and copied production data is
total. Production authority is unchanged throughout and the native receipt
remains inactive.

## 2. Scope, environment and mutation boundary

- All P3 mutation occurs **only** against the named disposable clone of
  section 12, verified by `systemIdentifier`, never by port.
- Production `ucrjtfswnfdlxwtmxnoo` may be contacted **only** by separately
  authorized read-only work. No P3 scenario writes to it, and no P3 step
  changes production authority.
- The retired project `gqmpsxkxynrjvidfmojk` is not a target. The forbidden
  project `bhgifjrfagkzubpyqpew` is not accessed at all.
- P3 does **not** activate the receipt and does **not** perform the cutover.
- `db/103b`, `db/104`, `db/106` and `db/110` are RESERVED, uncreated numbers.
  P3 applies none of them.
- The only migration P3 may apply is the forward patch
  `db/112_cutover_snapshot_completeness_invariant.sql`, to the disposable clone
  **only**, and only when measurement shows it absent (section 6.3 step 1).
  Applying it to production is a separate future cutover/P5 authorization and
  is explicitly not part of P3.
- No repository product, test or `db/*.sql` file is modified by a P3 execution.

## 3. RPC inventory under proof

P3 proves exactly the **14 canonical RPCs** introduced or consumed by the
coordinated release: **4 read** and **10 mutation**.

| Class | RPCs | Owner migrations |
|---|---|---|
| read | `oc_disponibilidade_op`, `pedido_elegivel_cancelamento`, `listar_fila_aceite_fornecedor`, `pode_recuperar_op_acabamento` | `db/101`, `db/103`, `db/105`, `db/108` |
| mutation | `salvar_ajuste_producao_op`, `iniciar_producao_op`, `aceitar_ordem_compra`, `rejeitar_ordem_compra`, `alterar_status_pedido`, `cancelar_pedido`, `registrar_entrega_cima_com_acabamento`, `gerar_op_acabamento`, `estornar_expedicao_tapete_parcial`, `corrigir_entrega_expedicao` | `db/102`, `db/103`, `db/105`, `db/108`, `db/109`, `db/111` |

The executor derives from the live catalogue, and records in evidence, for each
of the 14: signature, return shape, volatility, `prosecdef`, `proconfig`,
owner, ACL, and the deterministic refusal identifiers the body actually raises.
**Required intent, not literals:** each is exactly one overload, `SECURITY
DEFINER`, `SET search_path = ''`, owned by `postgres`, executable by
`authenticated` only — `anon`, `service_role` and `PUBLIC` hold no EXECUTE on
any of the 14 — and source-versus-target signature drift is ZERO.
`listar_fila_aceite_fornecedor`, `aceitar_ordem_compra` and
`rejeitar_ordem_compra` are supplier-bound; the other eleven are
administrator-bound.

**Client-side allowlist posture (P2, `js/supabase-client.js`).**
`_READ_ONLY_RPCS` must contain the 4 read RPCs and **none of the 10 writers**,
and must be proved disjoint from `_P2_RPC_INVENTORY.escrita` as a static source
assertion. A future union there would open a production write path from
localhost/preview, so this is load-bearing.

## 4. Identity and authorization intent

Six identities are represented. `A` synthetic active administrator; `B`
synthetic supplier bound to one supplier; `B′` synthetic supplier bound to a
different supplier; `C` synthetic active authenticated non-admin; `D` `anon`;
`E` `service_role`; `F` `postgres` owner/setup.

**Identity `F` is fixture preparation and teardown only and may never satisfy a
caller-proof scenario.**

**Expected authority.**

| Identity | Must SUCCEED | Must be REFUSED |
|---|---|---|
| `A` | the 3 admin reads and the 8 admin writers | the 3 supplier-bound RPCs |
| `B` | the supplier queue (own orders only) and accept/reject on its own orders | the 8 admin writers and the 3 admin reads |
| `B′` | nothing | accept/reject on `B`'s order; `B`'s rows absent from `B′`'s queue |
| `C` | nothing | all 14 |
| `D` | nothing | all 14, at the **grant** layer |
| `E` | nothing | all 14, at the **grant** layer |

**Application-equivalent proof.** PostgREST executes RPCs as role
`authenticated` with `request.jwt.claims` set from the verified JWT. A P3
scenario must reproduce that interface, not approximate it, and must assert the
effective identity (`current_user`, `auth.uid()`, `auth.role()`, `auth.jwt()`)
**inside the same transaction as the call and before it**, so that a scenario
which silently ran as `postgres` cannot pass. The exact GUC and role mechanics
are derived from the target cluster's own `auth` schema.

**Preamble fidelity is load-bearing.** The `auth.uid()` / `auth.role()` /
`auth.jwt()` bodies in the target cluster must be the production ones, proved
by direct comparison against the captured production definitions. A partial
reimplementation makes every guard refuse for the wrong reason and turns a
false negative into an apparent pass. Recorded as `OSO-2`.

**Owner-only helper unreachability.** Every owner-only helper reachable from the
14 must be proved unreachable from `authenticated`, `anon` and `service_role`,
both by `has_function_privilege` and by a **runtime** `SET LOCAL ROLE` call that
raises at the grant layer. The helper set is derived from the owner migrations
at execution time and recorded in evidence.

## 5. Synthetic namespace and protected data

One namespace, **`P3F`**, entirely synthetic.

- Human-readable labels are prefixed `P3F-`.
- BIGINT surrogate keys occupy the reserved band **`950000000`–`950999999`**,
  disjoint from the C3D `930…` band, the P1 `940…` band and every production
  id.
- UUID surrogate keys are syntactically valid UUIDs taken from a reserved
  synthetic band that cannot collide with any production value. The band and
  the ids actually used are fixture mechanics: they are owned by
  `04-fixtures.json` and derived from it, never restated or re-invented here.
- Idempotency keys are deterministic and literal — `p3f:<scenario-id>:<attempt>`
  — never `Date.now()` and never a random source, so replay and conflict
  scenarios reproduce.

The namespace **already exists on the preserved clone** and must NOT be
rebuilt; its exact composition is owned by the `04-fixtures.json` artifact of
section 11. A fixture a scenario needs and the namespace does not already hold
is created inside the same namespace and band, in foreign-key order derived
from the live schema, and appended to that artifact. Sequence high-water marks
are reconciled with the existing canonical high-water idiom **after** fixture
insert.

Existing production reference rows (models, colours) are read **read-only** and
never mutated.

**Protected Purchase Orders.** `OC-001-3-26` and `OC-001-4-26` are protected and
must never be a scenario fixture or a command target. A preflight assertion
must fail the run if either code, or any `ordem_compra.id` outside the `950…`
band, appears in a scenario parameter.

**Cleanup** is the reverse of creation, inside the disposable clone only, so
that the only-synthetic-rows-changed assertion of section 10 can run against
the restored baseline in the same cluster.

## 6. Productive availability seed

`P3F_FIXTURE_PRODUCTIVE_RECEIPT_SEED` anchors the fixture-only productive
receipt lineage required before any positive adjustment test. The productive
ledger predicate is owned by `db/101` and is derived from it, not restated
here.

The seed:

- is **owner/setup fixture data only** (identity `F`);
- uses synthetic `P3F` rows only and exists only in the disposable clone;
- must **never** invoke the public native receipt writer;
- must **not** set `productive_receipt_started_at`;
- must **not** touch the protected TD1 `saldo_fios` rows;
- must **not** touch `OC-001-3-26` or `OC-001-4-26`;
- must **not** touch any copied non-`P3F` production row.

### 6.1 Why a bounded maintenance excursion is authorized

A productive ledger line requires a receipt header, and the `db/75`/`db/76`
writer fence refuses every receipt-header insert — **including for the table
owner** — outside the states its own trigger admits. This is structural, and
proving it was a correct P3 hard stop, not a product defect. The authorized
harness mechanism is therefore a **bounded pre-PONR maintenance excursion on
the disposable clone only**, performed through the existing canonical `db/107`
cutover functions. It is fixture preparation, never a caller-proof scenario.

Reaching the maintenance state additionally requires the forward patch
`db/112` on the clone, because the canonical door into it, as shipped in
`db/75`, asserted a frozen legacy dataset cardinality that production no longer
has. The exact states, trigger conditions, function names and assertions are
owned by `db/75`, `db/76`, `db/107` and `db/112` and are derived from them.

### 6.2 Boundary of the excursion — binding

- Production is **never** involved.
- Only the clone named in section 12 may be mutated.
- `canonical_active` and `read_authority = 'canonical'` remain **forbidden**.
- `productive_receipt_started_at` must remain **NULL at every instant**,
  including throughout maintenance preparation. It is the enforced PONR marker;
  `ponr` is not a stored column anywhere. Recorded as `OSO-1`.
- The only temporary state permitted is the maintenance-fenced state with
  `read_authority` still `flat`.
- Only owner/setup identity `F` may perform it, holding the canonical
  owner/session lock the existing `db/107` functions require.

### 6.3 Required ordering intent

1. **derive the current patch state of the identified disposable clone by
   direct measurement, and prove the authorized `db/112` patch is PRESENT
   before any dependent step proceeds.** Whether it is already applied is a
   DYNAMIC fact: a resumed run may inherit a clone that already carries it.
   Measure first; apply only if measurement shows it absent; never reapply
   blindly and never apply more than the authorized patch. Record the measured
   pre-state, whether an application occurred, and the resulting state, by
   repository identity (section 10.4). **Do not invent or insert a
   migration-ledger version.** If the measured state is neither cleanly absent
   nor exactly the authorized patch, that is
   `HARD STOP — UNAUTHORIZED DB112 CATALOGUE DRIFT` (section 10.5);
2. prove the starting cutover state before entering the excursion;
3. enter the bounded maintenance path through the canonical function;
4. **run the canonical generation cleanup BEFORE the persistent P3 seed
   exists.** That cleanup deletes the temporary snapshot and inventory-baseline
   state and every receipt header and ledger line in the namespace it owns;
   running it after the seed would destroy the seed. The executor derives which
   namespace the cleanup owns and proves the seed is outside it;
5. create the P3F synthetic productive lineage under a fixture provenance that
   the cleanup does not own and that the live constraints admit, derived and
   recorded at execution time. **This is fixture provenance only**: it does not
   redefine production semantics and authorizes that combination nowhere
   outside the disposable P3 proof clone;
6. prove the seed touched only `P3F` business rows;
7. resume the legacy state through the canonical function;
8. prove exact restoration of the starting cutover state;
9. only then write `04b-productive-receipt-seed.json`;
10. only then begin `S01`.

### 6.4 Prohibited in every case

- the public native receipt writer;
- disabling a trigger outside an already-owned canonical cleanup function;
- `session_replication_role` bypass;
- direct ad-hoc manipulation of the cutover row;
- `canonical_active`;
- `read_authority = 'canonical'`;
- setting `productive_receipt_started_at`.

### 6.5 Availability proof

After restoration the executor must prove that `oc_disponibilidade_op` returns
the expected **positive** native availability derived from this synthetic
lineage, and record that proof in `04b-productive-receipt-seed.json`. A seed
that cannot reach a positive ceiling is a failed seed, not a passed one.

## 7. Scenario intent — S01–S47

47 scenarios in 6 groups. Each carries setup, caller identity, command,
expected result, expected persisted delta, expected non-delta, an authoritative
postcondition query, cleanup and an evidence artifact.

**The oracle of each scenario is derived, not quoted.** The executor derives the
exact expected refusal identifier, SQLSTATE, return shape, projected columns,
transition graph, fixture type and gate mechanism from the executable owner
before asserting it, and records the derived oracle inside the scenario
artifact. Amendment R4 exists because this contract previously asserted oracles
the canonical product does not and should not produce; **the product is never
changed to match a test.** A scenario whose derived oracle contradicts the
intent below is a finding to report, not a value to adjust silently.

Execute in ascending order within the groups. Where a scenario's fixtures
depend on a prior scenario's outcome, that dependency is derived and recorded.
Console output must use TAP-style stable identifiers (`P3_S17_PASS` /
`not ok - S17: …`) so a failure is greppable and a run cannot report success by
silence.

### 7.1 Group 1 — availability and production (S01–S12), identity `A`

| ID | Must prove |
|---|---|
| S01 | native availability on a `P3F` OP with no productive receipt on its own axis yields a zero OP-origin ceiling; availability scoping (per-OP versus pooled per-Pedido) is derived, not assumed |
| S02 | **TD1**: a non-zero synthetic `saldo_fios` balance contributes to no productive total, proved by attributable component on an axis whose ceiling stays zero |
| S03 | a valid atomic adjustment within the ceiling succeeds and moves exactly the adjustment revision and the adjusted metres, with OP status unchanged |
| S04 | an over-ceiling adjustment is refused with **zero** rows written and the revision unchanged |
| S05 | a stale base revision is refused with zero delta |
| S06 | clearing an adjustment succeeds, revision advances, value becomes NULL |
| S07 | an incomplete payload is refused with zero delta |
| S08 | starting production from the permitted state with all items adjusted succeeds, moves OP status, writes the balance snapshot, recomputes the Pedido and returns the next action |
| S09 | starting production from a non-permitted state is refused, zero delta, no snapshot |
| S10 | starting production with an unadjusted item is refused, zero delta |
| S11 | a replayed start after success is refused and writes **no second snapshot row** |
| S12 | an adjustment on an OP whose Pedido is cancelled is refused, zero delta |

### 7.2 Group 2 — supplier acceptance (S13–S20)

| ID | Identity | Must prove |
|---|---|---|
| S13 | `B` | queue isolation: only `B`'s own pending orders, `B′`'s absent |
| S14 | `B′` | queue isolation from the other side |
| S15 | `A` | an administrator is **not** a supplier and is refused at the guard layer |
| S16 | `B` | accepting its own order succeeds and writes exactly one immutable command row |
| S17 | `B` | rejecting its own order with a reason succeeds and persists the reason |
| S18 | `B` | a blank or whitespace-only reason is refused, zero delta |
| S19 | `B′` | accepting `B`'s order is refused, zero delta, no command row |
| S20 | `B` | replay with the **same** key returns the same canonical result and no second command row; the same key with a **different** payload is refused as a command conflict, zero delta |

### 7.3 Group 3 — Pedido lifecycle (S21–S29)

| ID | Identity | Must prove |
|---|---|---|
| S21 | `A` | a permitted operator transition succeeds, revision advances, an event row is written. The permitted transitions are derived from the writer's own transition graph |
| S22 | `A` | a transition forbidden **by that same graph** is refused, zero delta |
| S23 | `A` | a stale base revision is refused, zero delta |
| S24 | `A` | confirming with a pending client priority request is refused with **zero business delta**. The gate is a table trigger and raises rather than returning the `{ok:false, codigo}` shape the other refusals use; assert the raised form. **The RPC must NOT be changed to normalize it.** The scenario must reach the gate: a transition refused earlier in the graph never exercises it |
| S25 | `A` | cancellation eligibility is true for an eligible Pedido |
| S26 | `A` | cancelling an eligible Pedido succeeds, cancels related OPs, **releases and does not delete** purchase planning, and preserves history |
| S27 | `A` | cancellation eligibility is false for a Pedido with a registered delivery, with the blocking reason |
| S28 | `A` | cancelling that ineligible Pedido anyway is refused, zero delta |
| S29 | `C` | an authenticated non-admin holds no Pedido status authority through the RPC. The direct-table authority is **measured exactly** and classified under section 8; requiring its denial in P3 would contradict section 8 |

### 7.4 Group 4 — delivery and finishing (S30–S38), identity `A`

| ID | Must prove |
|---|---|
| S30 | a successful Tapete delivery persists, creates the finishing OP with its canonical identity and writes **one** command row. The lineage must be a genuine Tapete lineage; the product type is derived from the model, not assumed |
| S31 | replay with the same key and payload returns a byte-identical canonical result, with no second delivery and no second finishing OP |
| S32 | the same key with a different payload is refused as a command conflict, zero delta |
| S33 | a validation refusal produces **no partial persistence** |
| S34 | an injected server-recorded finishing failure leaves the delivery **persisted**, writes a failure attempt row, and creates no finishing OP (see section 9) |
| S35 | recovery is eligible after S34 |
| S36 | recovery creates the finishing OP and is no longer eligible afterwards |
| S37 | recovery is not eligible on a healthy delivery and is refused |
| S38 | the Manta route stays on its own distinct route and the Tapete-only writer refuses it |

### 7.5 Group 5 — expedition (S39–S44), identity `A`

| ID | Must prove |
|---|---|
| S39 | a valid partial Tapete reversal succeeds, reduces the released quantity and increases finished-product availability. The expedition source and item membership are constrained by the live guards and are immutable after creation, so the fixture is **created** to satisfy them, never re-pointed |
| S40 | a reversal above the released quantity is refused, zero delta |
| S41 | a reversal that would drop released below delivered is refused, zero delta |
| S42 | a valid delivery correction succeeds and returns nothing to production |
| S43 | a correction above the released quantity, or negative, is refused, zero delta |
| S44 | a correction that makes the Pedido incomplete recomputes the Pedido backwards, preserves history rows and reconciles output availability |

### 7.6 Group 6 — permission and security (S45–S47), each a sweep over all 14

| ID | Must prove |
|---|---|
| S45 | **Grant sweep.** `authenticated` reaches exactly the 14; `anon` and `service_role` reach none; every owner-only helper reaches none from any client role; every refusal is at the **grant** layer, not a body-level message. Proved both by catalogue privilege and by runtime `SET LOCAL ROLE` |
| S46 | **Wrong-role sweep.** `C` against all 14; `B` against the admin writers; `A` against the supplier-bound RPCs — every one refused with its derived documented code |
| S47 | **Bypass sweep.** Direct table DML as `authenticated`/`anon` on the business tables, the command stores and the balance snapshot; claim spoofing (an admin `sub` while the user record says otherwise, and a forged role claim); role-escalation attempts; and the static `_READ_ONLY_RPCS` assertion. Each DML surface is classified per section 8 from the live grants and RLS and must be **unchanged**, never absent |

**Load-bearing security points.** (1) Denial must occur at the **grant** layer
for `anon`/`service_role`; a body-level message proves the grant is wrong even
when the outcome looks correct. (2) Owner-only helpers must be unreachable at
**runtime**, not merely absent from `proacl`. (3) The claims-spoofing negative
is the sharpest test: admin authority derives from the user table, not from the
claim, so a forged `sub` for a non-admin must not confer admin and a forged
role claim must be inert. (4) Role escalation must be proved structurally
impossible — no client role holds membership on `postgres` — because a
postgres-owned harness session cannot test `SET ROLE postgres` meaningfully.
(5) `_READ_ONLY_RPCS` must be asserted disjoint from `_P2_RPC_INVENTORY.escrita`.

S47 fails on new, broadened or unexpected authority, on claim elevation, on
owner-helper reachability, on role escalation, or on a writer appearing in
`_READ_ONLY_RPCS`. It does **not** fail on an unchanged deferred permission.

## 8. P3/P4 boundary

**P3 proves:**

- the new frontend callers use the canonical RPCs;
- wrong identities are refused;
- owner-only helpers are unreachable from any client role;
- claim spoofing does not elevate authority;
- the read-only allowlist contains no writer;
- current pre-P4 legacy authority remains **unchanged**.

**P3 does NOT require:**

- `db/106` containment;
- final P4 direct-DML revocation;
- P4 `DELETE` revocation;
- final column-level authority restrictions;
- cutover;
- native receipt activation.

A legacy permission explicitly scheduled for P4 containment is classified as:

```
EXPECTED PRE-P4 LEGACY AUTHORITY — UNCHANGED BY P3
```

and **must not** be reported as a P3 defect. A grant present in P3 but absent
from the accepted baseline **is** a P3 failure.

## 9. S34 failure-injection constraint

`S34`–`S36` require a **deterministic, data-only** finishing failure.

Not authorized: DDL; function replacement; trigger disable or manipulation;
constraint modification; a mock writer; any database-code patch.

The mechanism is **not** fixed by this contract. It is discovered by the
execution order under the constraint above and recorded verbatim in the P3
report. A mechanism that produces the right symptom for the wrong reason is not
a valid injection: the executor must prove which gate actually raised.

If no data-only mechanism exists, the executor stops with exactly:

```
P3_BLOCKED_RECOVERY_FAILURE_INJECTION
```

## 10. Isolation and required invariants

### 10.1 Cutover invariant timing

The starting cutover state — legacy, with `read_authority` flat — is asserted
at five points, **not** continuously through seed preparation:

```
A. before the bounded maintenance excursion of section 6;
B. immediately after resuming legacy and before 04b;
C. immediately before S01;
D. after every S01–S47 scenario;
E. at final isolation verification.
```

The section 6.2 excursion is the ONLY window in which the maintenance state may
be read, and `read_authority` never leaves flat. At **all** times, including
maintenance preparation, `productive_receipt_started_at IS NULL` is mandatory
and is asserted alongside every check above.

### 10.2 Preserved across the whole run

- the migration-ledger terminal is **identical on the clone and on production**
  and identical to its value at restore, with the `db/112` forward patch
  recorded separately per section 10.4;
- no `db/103b`, no `db/104`, no `db/106`, no `db/110`;
- the protected TD1 `saldo_fios` rows unchanged — see section 10.3;
- `OC-001-3-26` and `OC-001-4-26` unchanged;
- every copied non-`P3F` production row unchanged — count **and** ordered
  content hash identical before and after;
- the function, policy, table-grant and column-grant catalogue unchanged
  **except for the `db/112` delta of section 10.5**. Apart from that delta P3
  applies **no** DDL after restore, and any other catalogue movement is
  `UNAUTHORIZED CATALOGUE DRIFT` and a hard stop;
- the `db/75`/`db/76` receipt-writer fence unchanged;
- production `ucrjtfswnfdlxwtmxnoo`: **no mutation-capable P3 path**, proved
  structurally. Section 10 does **not** independently mandate a literal final
  production row, catalogue or ledger equality; that measurement is the
  corroborative artifact classified in section 11.1, which is the sole owner of
  the production-untouched evidence split.

**Permitted delta surface (synthetic `P3F` rows only).** The Pedido, OP,
delivery, expedition, purchase-order, need and planning tables together with
their event and identity-numbering tables; the balance snapshot; the four
command/attempt stores; the `P3F` rows of the identity, client, supplier and
balance tables; and the `P3F` receipt header and ledger lines created by the
section 6 seed. The exact table set is enumerated in `06-isolation.json` from
the live schema. The cutover staging tables may hold rows ONLY inside the
section 6.2 excursion and must be back at their copied baseline before `04b`;
the cutover row itself must hash back to its copied baseline after resuming
legacy.

### 10.3 TD1 fingerprints — projections, not invariants

The preserved TD1 rows are a fixed row set with a fixed total. Several
fingerprints of them are on record from earlier phases. They are **not**
several business invariants; they are several serializations of the SAME rows,
each produced by a different projection, ordering and separator.

**Row identity and content equality is the authoritative test.** A hash
comparison is valid ONLY when projection, ordering, separator and session
serialization settings all match, and each recorded fingerprint must be
compared against a re-derivation using ITS OWN algorithm. Comparing two
different projections and reporting a difference is a measurement error, not a
fidelity failure. **Do not invent an additional fingerprint.**

The session serialization settings are pinned to production's own measured
capture conditions and recorded in evidence; timezone is load-bearing because
the row set carries a `timestamptz`.

### 10.4 Migration identity — three distinct facts

"Terminal migration" is ambiguous across three different things and P3 must
never conflate them:

| # | Fact | Owner |
|---|---|---|
| 1 | the production migration ledger | the Supabase apply tooling |
| 2 | the restored clone's inherited ledger — a copy of (1); P3 asserts it stays exactly that | inherited by `pg_restore` |
| 3 | the P3-only forward patch `db/112`, present on the clone post-restore outside that tooling — its presence is MEASURED per section 6.3 step 1, and applied only if measurement shows it absent | this contract |

`db/112` writes no migration-ledger row, so applying it does **not** advance
(2). **No ledger insertion is performed or permitted**: the ledger version is
assigned by the Supabase apply tooling, `db/112` has never been applied through
it, and inventing a version would fabricate provenance. Fact (3) is recorded as
evidence by REPOSITORY identity — path, git blob identity, content digest, byte
count, commit, and the clone it was applied to — measured at execution time and
written to `03b-db112-clone-application.json`.

### 10.5 The authorized `db/112` catalogue delta

Applying `db/112` to the clone is authorized to change the catalogue in exactly
the way `db/112`'s own text implies, and in no other way. The executor derives
the authorized set from `db/112` itself, measures the actual delta with
`scripts/c3d/catalogue-delta.mjs` across the same strict dimensions the
accepted restore-fidelity evidence used, and proves the two equal.

`db/112` is `CREATE OR REPLACE` only: cardinality must not move, no function
may be added or removed, no dimension other than the function-body dimension
may move, and for each replaced function every term other than the body digest
— return type, security, volatility, kind, parameters, strictness, set-return,
language, config, owner and ACL — must be UNCHANGED. That is what proves the
replacement neither widened authority nor altered the callable contract.
Anything else is:

```
HARD STOP — UNAUTHORIZED DB112 CATALOGUE DRIFT
```

**Production is out of scope of this delta.** P3 applies `db/112` to the clone
only and never to production, so production carries no `db/112`. That is a
boundary of section 2 and holds structurally. Any comparison of the production
catalogue against its own restore baseline is the corroborative remeasurement
owned by section 11.1, not an independent requirement of this section.

### 10.6 The one narrow counter exception

A successful canonical finishing-OP creation unavoidably increments exactly one
copied OP-numbering counter row, because the canonical numbering function
advances it and no data-only mechanism can redirect it. That row — and only
that row — may increase, solely as the result of a successful canonical
finishing-OP creation exercised by P3. The row's identity and its baseline
value are **measured at run start**, never quoted from this file.

`06-isolation.json` must report the measured baseline, every increment, the
scenario and RPC that caused each one, the final value, and proof that no
unrelated counter row changed. **The counter must never be reset during cleanup
merely to make an isolation hash pass.** This exception authorizes no other
copied-row mutation.

### 10.7 Isolation reporting — three separated classes

`06-isolation.json` must report three classes SEPARATELY, and must never
compare the post-`db/112` clone catalogue against the pre-`db/112` restore hash
and call the intentional change drift:

| Class | Content | Required verdict |
|---|---|---|
| **A** | inherited production baseline — copied rows, catalogue as restored | unchanged, except the authorized counter behaviour of section 10.6 |
| **B** | the clone-only `db/112` catalogue delta | EXACTLY the section 10.5 authorized set and nothing else |
| **C** | synthetic `P3F` scenario delta | confined to the section 10.2 permitted delta surface |

All three classes are measured **on the disposable clone**. Production is not
one of them: its treatment is owned entirely by section 11.1.

## 11. Evidence requirements and classification

Evidence **may live outside the repository** and currently does (section 12).

| Artifact | Content | Class |
|---|---|---|
| `00-preflight.json` | production identity, terminal migration, cutover row, row counts, protected-row hashes, catalogue hashes — all read-only | LOAD_BEARING |
| `01-dump-manifest.json` | dump command, tool version, byte size, archive digest, timestamps, production read-only session proof | LOAD_BEARING |
| `01b-post-dump-verify.json` | re-measurement of `00` immediately after the dump, diffed to zero | LOAD_BEARING |
| `01c-credential-cleanup.json` | credential acquisition source and post-run clearance; **never** the secret | LOAD_BEARING |
| `02-cluster-boot.json` | disposable `systemIdentifier`, version, port, data dir, and the assertion that the identifier is not production's | LOAD_BEARING |
| `03-restore-verify.json` | post-restore catalogue hashes and row counts against `00`; the 14-RPC signature/ACL re-verification inside the clone | LOAD_BEARING |
| `03b-db112-clone-application.json` | the section 10.4 fact-(3) record and the section 10.5 measured delta, proved equal to the authorized set | LOAD_BEARING |
| `04-fixtures.json` | every `P3F` id created, in creation order | LOAD_BEARING |
| `04b-productive-receipt-seed.json` | the seed lineage and the proved positive availability result | LOAD_BEARING |
| `05-scenarios/S01.json` … `S47.json` | per scenario: identity assertion, the derived oracle, command, verbatim result, delta and non-delta assertions, pass/fail | LOAD_BEARING |
| `06-isolation.json` | before/after count and hash for every copied production table with the `P3F` exclusion applied, in the three classes of section 10.7 | LOAD_BEARING |
| `07-teardown.json` | stop result, port closed, pid absent, directory absent, plus independent filesystem checks for data dir and dump path | LOAD_BEARING |
| `08-production-untouched.json` | post-run read-only re-measurement of `00`, diffed to zero; collected when reachable, otherwise declared `WITHHELD` — see section 11.1 | **CORROBORATIVE** |
| `P3-REPORT.md` | human-readable roll-up, scenario table, failures, stop conditions hit | LOAD_BEARING |

### 11.1 Production-untouched — intent and its two evidence classes

**Intent, unchanged and binding:** this P3 execution must have no
mutation-capable path to production. Production is contacted only by separately
authorized read-only work, and every mutation is confined to the disposable
clone verified by `systemIdentifier`.

**Supervisor decision — the evidence for that intent splits in two.** This
section is the SOLE owner of the split; section 10 defers to it and mandates no
literal production equality of its own.

- `EVIDENCE_LOAD_BEARING` — the **structural** proof that the execution held no
  mutation-capable production path: the read-only session proof of
  `01-dump-manifest.json` with its negative controls, the distinct-cluster
  assertion of `02-cluster-boot.json` proving the mutation target is not
  production, and the clone-confined mutation surface of `06-isolation.json`.
  This may not be waived; its absence blocks acceptance.
- `EVIDENCE_CORROBORATIVE` — `08-production-untouched.json`, the final
  read-only remeasurement showing literal zero production row, catalogue and
  ledger delta.

**Literal final production equality is therefore NOT independently mandatory
when `08` is WITHHELD.** If `08` is obtainable under a separately authorized
read-only operation, collect it and report it. If it is not, declare it
`WITHHELD` with its reason and rely only on the load-bearing structural
evidence named above, per `docs/governance/AGENT_INSTRUCTIONS.md` section 13.5.
A withheld corroborative artifact does not by itself block acceptance; a
missing load-bearing structural proof does.

`08` **present and showing a non-zero delta** is a different matter: that is a
P3 failure and a hard stop, not a withheld artifact.

**This grants no production access and no production mutation** and relaxes no
boundary of section 2. It classifies evidence; it authorizes nothing.

### 11.2 Teardown and the acceptance sequence

**Teardown is an acceptance criterion, not housekeeping.** If any teardown step
fails, the run is reported FAILED even if all 47 scenarios passed. Teardown
covers the P3 clone and the superseded rehearsal cluster of section 12. Whether
either still exists is remeasured at run time, not assumed from this file; both
must be proved ABSENT when teardown reports.

**Teardown runs AFTER supervisor evidence approval, never before.** The
sequence is binding and ordered:

1. execute the proof and preserve every load-bearing evidence artifact;
2. **preserve the disposable proof environment AND its production-derived
   restore source**;
3. submit the completed evidence bundle to supervisor review;
4. only after supervisor evidence approval may teardown be **separately
   authorized**;
5. final P3 acceptance occurs only after that teardown is proved complete.

**Why the order is binding.** Teardown destroys the clone and its restore
source together. If any evidence gap is found after teardown, no scenario can
be re-run: rebuilding the clone requires the production-derived capture, and
re-capturing requires production access that a P3 order does not grant. An
execution order that mandates both teardown and pending acceptance is
CONTRADICTORY; the executor reports the conflict and preserves the environment
rather than resolving it by destroying the only recovery path.

A rebuilt-from-migrations cluster is **not** a substitute proof environment for
authorization evidence: deployed privileges are not always what the migrations
declare, so such a cluster measures the declared posture rather than the
deployed one.

## 12. Preserved execution state

```
external_execution_root:
  D:\p3-work\runs\p3-a0e2331-20260801T030008Z
external_evidence_root:
  D:\p3-work\evidence\p3\p3-a0e2331-20260801T030008Z
cluster_pointer:
  D:\p3-work\runs\p3-a0e2331-20260801T030008Z\scratch\cluster.json
run_id:
  p3-a0e2331-20260801T030008Z
```

**Preserved clone — do NOT rebuild.** `systemIdentifier 7668905723812930636`.
Verify by `systemIdentifier`, never by port.

**Superseded rehearsal cluster.** `D:\p3-work\rehearsal-JhFKAI`,
`systemIdentifier 7668897191668365016`. It is **never** a valid P3 target and
must never be used for any P3 step.

**Liveness is a dynamic fact and this file asserts none.** Whether either
cluster is currently running, listening, stopped or already gone is not stated
here and must not be inferred from here. The resumption run REMEASURES the
liveness and identity of both, by `systemIdentifier` and never by port, before
any mutation, and records the measurement in evidence. The rehearsal cluster
must be **absent at final teardown**, and the P3 clone must be absent once its
own teardown completes.

**Fixture state.** The clone already holds the complete validated `P3F`
namespace, recorded in `04-fixtures.json`. A resumption order starts at
section 6.3, not at section 5.

**Scenario state — historical attempt exists; the authoritative matrix does
not.** A first execution of the section 7 matrix ran **34 scenarios and
produced 21 PASS / 13 FAIL**, and proved **no product defect**: some failures
were executor errors and others were defects in this contract's own oracles,
which is why section 7 now requires derived oracles. Those **34 artifacts are
preserved as historical evidence under a separate attempt namespace** and must
not be mixed with, promoted into, or counted towards the authoritative final
matrix. **The authoritative final P3 matrix is INCOMPLETE: no scenario result
is accepted, and no P3 result of any kind is claimed.** Any statement that no
scenario has ever been executed is stale and is superseded by this paragraph.

**Phase 1 — production read-only dump: ACCEPTED FOR P3 ENTRY.** Production
identity proved by cluster system identifier; read-only posture proved by two
negative controls; production proved unchanged across the dump on all tables,
the catalogue, the cutover row, both protected Purchase Orders and the
protected TD1 rows; no secret in any evidence file.

**Phase 2 — restore fidelity: ACCEPTED FOR P3 ENTRY.** Restored into a
disposable cluster whose system identifier differs from production's; identical
terminal migration on both sides; all 14 RPCs matching production including
body digest and ACL with zero drift; zero row-count and row-hash drift; every
strict catalogue dimension byte-equal; cutover state matching production; no
production mutation. The declared PostgreSQL 17→18 reconciliations —
materialized `NOT NULL` constraints, compacted dropped-column ordinals,
owner-only `relacl` compared by effective privilege, and one CHECK constraint
deparsed with one fewer redundant parenthesis group, reconciled only because
both token equivalence and a behavioural probe hold — are part of that
acceptance. A differing relation absent from the captured production
definitions is a hard stop, so that path cannot absorb an unexamined
difference.

Both phases' measured values are owned by their artifacts (`00`, `01`, `01b`,
`01c`, `02`, `03`) and by the ledger entry of section 14, not by this file.

**Cluster liveness is not assumed.** The execution order must re-verify the
clone before any mutation and refuse any cluster whose `systemIdentifier` is
not the preserved one.

## 13. Acceptance and hard stops

P3 is accepted only by the architect, only on evidence, and **never by the
executor**. P3 must not self-accept. Completion of the scenario matrix
authorizes nothing further: P4 and P5 remain NOT AUTHORIZED and nothing chains
from a P3 result.

**Acceptance requires** every `EVIDENCE_LOAD_BEARING` artifact of section 11
present and directly proved; the 47 scenarios executed in order with derived
oracles recorded; the section 10 invariants held on the clone at every asserted
point; the isolation report in its three separated classes; and the
production-untouched intent of section 11.1 satisfied **at its declared
evidence classes** — the structural load-bearing proof present, with `08`
collected when reachable and declared `WITHHELD` when not. A withheld `08`
alone does not block acceptance.

Teardown is required for acceptance but is sequenced by section 11.2: it
follows supervisor evidence approval under its own authorization, and final
acceptance follows the proved teardown. Evidence approval and teardown are
therefore two distinct supervisor acts, and neither may be inferred from the
other.

**A sweep scenario is satisfied only by the coverage its intent states**, not by
the probes a harness happens to define. An oracle of the form "every probe was
denied" is vacuous over an incomplete probe set: the executor must enumerate the
full required matrix, record it, and prove each element. A PASS that rests on an
absent probe, or on an error raised for an unrelated mechanical reason, is not a
PASS.

**Hard stop, report and do not continue, when:**

- the cutover state, the PONR marker, or the `db/75`/`db/76` fence is anything
  other than section 10 requires at an asserted point;
- catalogue movement outside the authorized `db/112` delta is measured;
- a copied non-`P3F` row changes outside the section 10.6 counter exception;
- a protected Purchase Order or a protected TD1 row is reached by any command;
- a scenario would need production, the retired project, or the forbidden
  project;
- a scenario would need DDL, a function or trigger patch, or a
  `session_replication_role` bypass;
- the target cluster's `systemIdentifier` is not the preserved one;
- identity `F` would be needed to satisfy a caller-proof scenario;
- no data-only S34 mechanism exists (`P3_BLOCKED_RECOVERY_FAILURE_INJECTION`);
- a required piece of evidence proves unreachable — report it as a contract
  defect under `AGENT_INSTRUCTIONS.md` section 13.4, do not approximate it;
- removing or reinterpreting an active statement of this contract would need a
  new human decision on product intent, acceptance, architecture, security or a
  phase boundary.

A derived mechanic that contradicts stale prose is **not** a hard stop: it is
`MECHANICAL_DOCUMENT_DRIFT` under `AGENT_INSTRUCTIONS.md` section 13.3 —
measure, correct, report.

## 14. Historical record — non-normative

The following are preserved as history and are **not** normative. They are not
rewritten, and this refoundation withdraws none of the accepted evidence they
carry.

| Record | Reachable at |
|---|---|
| original activation of this contract, with the full 14-RPC signature tables, the literal `S01`–`S47` oracle matrix, the fixture content list and the original evidence schema | commit `e74680d` |
| **Amendment R1** — bounded maintenance excursion, observed `S24` refusal shape, invariant timing, TD1 fingerprint algorithms, `op_numeros` exception bounds | commit `f3d2457` |
| **Amendment R2** — the `db/112` root-cause correction of the frozen cutover cardinalities and its consequences for P3 | commit `f3d2457`, migration at `b817510` |
| **Amendment R3** — R3.1 catalogue-invariant reconciliation by measurement, R3.2 the three migration-identity facts, R3.3 schema-enforced one-flat-row-one-mapping | commit `1c43442` |
| **Amendment R4** — scenario-oracle reconciliation after the 21 PASS / 13 FAIL first attempt | commit `aee48b4` |
| accepted Phase 1 and Phase 2 measured evidence, the P3 activation record and the protected-residue incident | `docs/ledgers/G28_LEDGER.md` :: `## 2026-08-01 — NATIVE-RECEIPT-COORDINATED-RELEASE-P3-CANONICAL-ACTIVATION-R1 — docs: activate P3 authenticated proof` |
| the 34 historical scenario artifacts of the first attempt | the separate attempt namespace under the external evidence root of section 12 |

Where a historical record and this file disagree, **this file governs** for
active execution, and the historical record stands unaltered as evidence of
what was decided and measured at the time.

## 15. Provenance

The scenario intent, identity model, fixture model, delta/non-delta surfaces
and evidence schema in this file are the canonicalisation of the reviewed
`P3 DIAGNOSIS AND EXECUTION PLANNING` report, sections 3, 5, 10, 11, 12, 13, 14
and 15, as refounded here. Section 9.9.Q of
`docs/architecture/PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md` remains the owner
of the authenticated acceptance intent; this file enumerates it and does not
override it.
