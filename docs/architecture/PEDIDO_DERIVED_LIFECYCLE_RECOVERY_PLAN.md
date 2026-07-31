# Pedido derived lifecycle — recovery plan

STATUS: ACTIVE / WORKING CANONICAL PLAN / DIAGNOSIS ACCEPTED / DESIGN NOT YET ACCEPTED / IMPLEMENTATION NOT AUTHORIZED

## 0. Authority of this document

1. This is the **binding working plan** for the recovery of the Pedido lifecycle
   and every path directly derived from it. It is the persistent document that
   every subsequent diagnosis, design, implementation, verification and closeout
   order in this scope uses and updates, until the lifecycle recovery is fully
   accepted.
2. It **preserves and reconciles the existing product design**. It is not a
   refoundation, not a rewrite and not a general refactor. Where an accepted
   contract already owns a semantic, this document points at that owner and does
   not restate a competing version of it.
3. **Every future order affecting this scope must update this document.** An
   order in this scope that changes nothing here has either changed nothing real
   or has failed to record what it changed.
4. **No phase in this scope may be closed if the next real operational action is
   missing, hidden, inactive, disconnected, or dependent on an unfinished
   cutover.** Phase-local acceptance is not acceptance: the proof obligation is
   the next action a real user can actually take.
5. **The visual graph is derived evidence.** The textual contracts, matrices and
   registers in this document remain authoritative. When the diagram and the text
   disagree, the text wins and the diagram is regenerated.
6. **No additional phase-specific lifecycle document may become a competing
   authority** without explicit supervisor approval. A phase contract may own its
   own migration and screen detail; it may not own the lifecycle graph, the
   backend/frontend matrix, the dependency register or the defect register.

This document does not own: agent behaviour (`docs/governance/AGENT_INSTRUCTIONS.md`),
current operational continuity (`docs/governance/current-state.json`), accepted
history (`docs/ledgers/G28_LEDGER.md`), or the Pedido/OP technical and product
semantics already owned by `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` and
`docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md`.

7. **The target product design lives in §9 and must never be merged with the
   current-state description of §§3–6.** §9 says how the product must work; §§3–6
   say how the code behaves today; §8 and §9.6 hold the delta. Documenting a
   target authorizes no implementation.

Derived visual evidence: [`diagrams/pedido-derived-lifecycle-current.svg`](diagrams/pedido-derived-lifecycle-current.svg).

Target product design: [`diagrams/pedido-derived-lifecycle-target.svg`](diagrams/pedido-derived-lifecycle-target.svg)
and its source [`diagrams/pedido-derived-lifecycle-target.mmd`](diagrams/pedido-derived-lifecycle-target.mmd) — see §9.

---

## 1. Purpose and scope

The scope of this recovery is the complete operational chain below. Every arrow
is in scope, including its refusal, correction, reversal and recovery paths.

```
Pedido
  -> commercial lifecycle (rascunho / recebido / confirmado / produzindo / entregue / cancelado)
  -> purchase planning (necessidade_compra_planejamento)
  -> native Purchase Orders (ordem_compra / ordem_compra_item / ordem_compra_item_alocacao)
  -> supplier acceptance, where applicable (status_aceite, ordem_compra_config.exige_aceite)
  -> receipt and reversal (native receipt writer, ledger, stock projection)
  -> material availability (necessidade_compra_fio.kg_alocado, saldo_fios, saldo_fios_op)
  -> production adjustment (op_itens.metros_ajustados slider, iniciarProducaoOP)
  -> weaving OP (ops tipo tecelagem)
  -> finishing / latex OP (gerar_op_latex, gerar_op_latex_split)
  -> Manta route (direct tecelagem -> expedicao, no acabamento stage)
  -> expedition (expedicoes, expedicao_itens, partial expedition)
  -> delivery (registrar_entrega_expedicao)
  -> Pedido conclusion (pedidos.status = entregue)
  -> customer-facing tracking and partials (status_cliente_visual, pedido_parciais)
  -> cancellation, correction, reversal and recovery at every stage above
```

Explicitly in scope: the two purchasing models and the boundary between them;
the receipt cutover; the material-availability projection consumed by production;
the OP and Pedido production sliders; the customer route; and every reversal.

Explicitly **not** in scope of this document (they remain owned elsewhere and are
only referenced): the unified Pedido edit / client change-approval sequence
(db/92–db/94), the UI conformance track, the governance generator lattice, and the
documents-ingestor bridge.

---

## 2. Repository and accepted baseline

| Fact | Value |
|---|---|
| Repository identity | `inttexsystem/inttracker` |
| Canonical workspace | `D:\Programação\controle-tapetes-g28` |
| Branch | `dev` |
| Accepted diagnostic baseline HEAD | `97d461ef07ddb422db0b22cea6436f593fdc657a` |
| Publication boundary | `staging/dev`, EXPLICIT_SINGLE_FAST_FORWARD_ONLY |
| Production project identifier | `ucrjtfswnfdlxwtmxnoo` (PostgreSQL 17.6, cluster `system_identifier` 7642734024280108049) |
| Terminal migration applied in production | **db/100** — `supabase_migrations` version `20260731033711` (`100_ordem_compra_post_generation_stabilization`), applied exactly once under PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 and re-verified read-only as terminal on 2026-07-31. No later migration exists in production and no db/101+ exists in the repository. |
| Native receipt cutover state | `ordem_compra_cutover` = `legacy_active` / `flat` — **inactive**; db/100 did not activate it |
| Retired project | `gqmpsxkxynrjvidfmojk` (no runtime role) |
| Forbidden project | `bhgifjrfagkzubpyqpew` (never accessed) |
| Protected local residue | `.gitignore` (MODIFIED), `.codex/config.toml` (UNTRACKED), `.mcp.json` (UNTRACKED) — preserved exactly, never opened or displayed |
| Accepted diagnostic order | `PEDIDO-DERIVED-LIFECYCLE-GRAPH-COMPLETION-R2` |
| Date of this baseline | 2026-07-31 |
| Accepted operational checkpoint (unchanged by this document) | `b6bbe4a69c583d255a1f6d993b01988be1646cbd` |

The R2 diagnosis is an **accepted architect input** to this document. Its findings
are recorded here as fixed facts and are not re-derived. Where this document adds
a direct repository citation, that citation was read at the baseline HEAD above.

---

## 3. Problem statement

### 3.1 Structural cause

1. **Two purchasing models remained active at the same time.** The flat model
   (`ordens_compra_fio`, one row per OP/yarn/supplier) and the native model
   (`ordem_compra` + `ordem_compra_item` + `ordem_compra_item_alocacao`) both had
   live writers and live readers, with `ordem_compra_cutover` as the intended
   single switch between them.
2. **db/77 bypassed the receipt-before-emission server gate.** It granted
   `EXECUTE ON public.emitir_ordem_compra(BIGINT) TO authenticated` and derived
   `pode_emitir` / `acoes.emitir` purely from distribution completeness plus
   `exige_aceite = FALSE`. Emission therefore became reachable while the receipt
   surface of the same model was still inactive.
3. **db/99 moved new purchase creation to the native model.** Purchase planning
   became a first-class entity (`necessidade_compra_planejamento`) and Purchase
   Order generation became native and atomic. New purchases stopped being created
   in the flat model.
4. **Receipt and important consumers remained attached to the flat model.**
   Material availability, the OP and Pedido sliders, the supplier queue and the
   Pedido detail purchasing projection continued to read `ordens_compra_fio`,
   which new purchases no longer populate.
5. **db/100 made the receipt refusal honest but did not restore the operational
   continuation.** It subordinated `acoes.receber` to `ordem_compra_cutover`
   (`status = 'canonical_active' AND read_authority = 'canonical'`, fail-closed)
   and returns the stable blocker `recebimento_canonico_inativo` otherwise. The
   cutover was deliberately not activated and the db/75/db/76 writer fence was not
   weakened. The screen now tells the truth; the operator still cannot proceed.
6. **Phase-local acceptance failed to prove the next real action.** Each phase
   proved its own migration, its own tests and its own screen, and none of them
   proved that the operator could take the *next* step afterwards.

### 3.2 Operational consequence

> Native Purchase Orders can be generated and emitted, but **receipt, material
> availability, the production slider and OP progression have no usable input.**

Concretely: an administrator can plan a purchase, generate `OC-001-3-26`, emit it,
cancel it and delete it — and then cannot register its receipt, cannot see the
material arrive in availability, cannot move the production slider against real
arrived material, and cannot progress the weaving OP on that basis. The chain
stops at a document that exists and means nothing downstream.

---

## 4. Accepted current-state graph

Classification vocabulary is defined in section 5. `Evidence` cites the artifact
read at the accepted baseline HEAD.

### 4.1 Pedido commercial lifecycle

| Field | Value |
|---|---|
| Entity | `public.pedidos` |
| Field or event | `status` ∈ {`rascunho`, `recebido`, `confirmado`, `produzindo`, `entregue`, `cancelado`} |
| Writer | Frontend direct `UPDATE` on `pedidos.status` — `js/screens/pedido-detail-events.js::alterarStatus()`; client creation inserts `recebido` (`js/screens/cliente-pedido-form.js`); `entregue` is written server-side by the expedition delivery path (db/23, db/87) |
| Frontend surface | Pedido detail action bar; `js/screens/pedido-chain-state.js` guards the transition |
| Prerequisite | `ns.canTransition(statusAtual, novoStatus)` client-side; db/91 refuses acceptance while a client priority request is pending |
| Next action | `confirmado` opens purchase planning and OP creation |
| Classification | MIXED_AUTHORITY |
| Known defect | `LR-08` — `produzindo` is a declared, contractually valid state with **no writer at all**; the transition table admits it and nothing produces it |
| Evidence | `db/13_pedidos_schema.sql:50,61`; `js/screens/pedido-detail-events.js:150-175`; `js/screens/pedido-chain-state.js`; `js/pedido-ui.js:152` |

### 4.2 Purchase planning (native)

| Field | Value |
|---|---|
| Entity | `public.necessidade_compra_planejamento` |
| Field or event | supplier assignment and planned kg per `necessidade_compra_fio` row; `gerado_em` marks the row as consumed by a generated document |
| Writer | db/99 planning RPCs (server-owned; `authenticated` holds `SELECT` only, no direct DML) |
| Frontend surface | `js/screens/pedido-insumos-distribuicao.js` (Planejamento de compras) |
| Prerequisite | Pedido with computed `necessidade_compra_fio` rows |
| Next action | Generate a native Purchase Order for one supplier |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | none recorded at this stage |
| Evidence | `db/99_planejamento_compra_refoundation.sql`; `necessidade_compra_planejamento_viva_uidx` partial unique `(necessidade_id, fornecedor_id) WHERE gerado_em IS NULL`; `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` §14 |

### 4.3 Native Purchase Order — creation, emission, cancellation, deletion

| Field | Value |
|---|---|
| Entity | `public.ordem_compra`, `ordem_compra_item`, `ordem_compra_item_alocacao` |
| Field or event | `status_administrativo` ∈ {`rascunho`, `emitida`, `cancelada`}; `emitida_em`; `codigo` |
| Writer | `gerar_ordem_compra*` (db/99), `emitir_ordem_compra` (db/68 body, db/77 grant), `cancelar_ordem_compra` and `excluir_ordem_compra` (db/100) |
| Frontend surface | `js/screens/ordem-compra-*.js`; Pedido purchase planning surface |
| Prerequisite | complete distribution (`_distribuicao_completa_ordem`) and `ordem_compra_config.exige_aceite = FALSE` for emission |
| Next action | **Receipt** — currently unreachable (see 4.5) |
| Classification | NATIVE_ONLY / BACKEND_CORRECT_AND_REACHABLE up to emission |
| Known defect | `LR-01` — the chain terminates here because receipt is inactive |
| Evidence | `db/77_ordem_compra_c5a_emission_readiness.sql:67-69,128-130`; `db/100_ordem_compra_post_generation_stabilization.sql` §§1,9 |

### 4.4 Supplier acceptance

| Field | Value |
|---|---|
| Entity | `public.ordem_compra.status_aceite`, `public.ordem_compra_config.exige_aceite` |
| Field or event | acceptance state; `exige_aceite` is structurally seeded `FALSE` with no client write path |
| Writer | none reachable from the application (PHASE-C5B does not exist) |
| Frontend surface | none |
| Prerequisite | n/a |
| Next action | n/a while `exige_aceite = FALSE` |
| Classification | SPECIFIED_BUT_NOT_IMPLEMENTED |
| Known defect | `LR-03` — no native supplier queue exists (section 8) |
| Evidence | `db/65_ordem_compra_lifecycle_schema.sql`; `db/77_...sql:36-45` (`emissao_bloqueada_exige_aceite` is a defensive, currently unreachable blocker); `db/100_...sql` (acceptance semantics deliberately unchanged) |

### 4.5 Receipt and reversal

| Field | Value |
|---|---|
| Entity | native receipt writer + `ordem_compra_cutover` (id = 1) |
| Field or event | `acoes.receber`, `bloqueio_recebimento` |
| Writer | db/70 / db/74 / db/75 / db/76 native receipt writer, fenced; db/100 replaced the read model |
| Frontend surface | `js/screens/ordem-compra-receipt-{cutover,data,events,render}.js` |
| Prerequisite | `ordem_compra_cutover.status = 'canonical_active' AND read_authority = 'canonical'`; **production is `legacy_active` / `flat`** |
| Next action | none — `acoes.receber` is `FALSE` and the server returns `recebimento_canonico_inativo` |
| Classification | VALID_BUT_UNREACHABLE |
| Known defect | `LR-01` (blocking) |
| Evidence | `db/100_...sql:789-845,940`; `db/75_ordem_compra_c3c_inactive_cutover.sql:131,212,256,285`; `js/screens/ordem-compra-receipt-cutover.js` header contract |

Reversal of receipt exists in the native writer surface but has never been
exercised operationally, because receipt itself has never been reachable.

### 4.6 Material availability

| Field | Value |
|---|---|
| Entity | `necessidade_compra_fio.kg_alocado`; `saldo_fios`; `saldo_fios_op`; legacy `ordens_compra_fio.kg_recebido` |
| Field or event | active purchase coverage and arrived material |
| Writer | `public.oc_recalcular_cache_necessidade` is the **sole** cache writer (db/100), reading the single server-owned definition `public.oc_cobertura_ativa(BIGINT)` derived from `ordem_compra.status_administrativo` |
| Frontend surface | `js/screens/pedido-insumos-distribuicao.js` (native); `js/screens/op-nova.js`, `js/screens/op-persistir.js`, `js/screens/fornecedor.js`, `js/screens/pedido-detail-data.js` (flat) |
| Prerequisite | a receipt event that has arrived — which cannot happen (4.5) |
| Next action | production adjustment |
| Classification | MIXED_AUTHORITY |
| Known defect | `LR-02` — availability readers that feed production are still flat-model readers, and new purchases no longer write the flat model |
| Evidence | `db/100_...sql:57-80`; `js/screens/op-nova.js:1287,1293`; `js/screens/pedido-detail-data.js:397-407`; `js/screens/op-persistir.js:306,330-338` |

### 4.7 Production adjustment — the slider

| Field | Value |
|---|---|
| Entity | `public.op_itens.metros_ajustados` |
| Field or event | per-item adjusted metres; then `ops.status -> em_producao` |
| Writer | `window.salvarDistribuicaoOP` — a **frontend per-row `UPDATE` loop**, no RPC, no transaction; `window.iniciarProducaoOP` performs the saldo snapshot and the status transition |
| Frontend surface | `js/screens/op-distribuicao-ui.js:347` |
| Prerequisite | material availability (4.6) |
| Next action | start production on the weaving OP |
| Classification | FRONTEND_PRESENT_BACKEND_DISCONNECTED |
| Known defect | `LR-04` — the loop is non-atomic: a mid-loop failure returns `{ partial: true }` and leaves some items persisted and some not, with no server-side rollback |
| Evidence | `js/screens/op-recalculo.js:194-206` (the loop), `:181` (the `ops` status update), `:223-230` (exports) |

### 4.8 Weaving OP lifecycle

| Field | Value |
|---|---|
| Entity | `public.ops` (tipo `tecelagem`), `public.op_itens` |
| Field or event | `status` ∈ {`simulada`, `aberta`, `em_producao`, `pausada`, `concluida`, `cancelada`, `finalizada`} |
| Writer | `js/screens/op-persistir.js` (direct `UPDATE`), `js/screens/op-recalculo.js:181`, db/21 lifecycle RPCs |
| Frontend surface | `#/ops`, OP detail, `js/screens/op-tecelagem-producao-admin.js` |
| Prerequisite | slider persisted; saldo snapshot taken |
| Next action | weaving delivery (`entregas`, etapa `cima`) |
| Classification | MIXED_AUTHORITY |
| Known defect | `LR-09` — `finalizada` is reachable by no writer in the current application; `concluida` is the canonical terminal |
| Evidence | `db/01_schema.sql:90`; `db/21_op_lifecycle_status_eventos.sql:7,13-15,59,64,208-217`; `js/screens/op-persistir.js:213,268-337` |

### 4.9 Weaving delivery

| Field | Value |
|---|---|
| Entity | `public.entregas`, `public.entrega_itens` |
| Field or event | `etapa = 'cima'`, `destino_fornecedor_id` |
| Writer | `js/screens/entrega-writes.js::salvarEntregaCima` — direct inserts, compensating delete on item-insert failure |
| Frontend surface | `js/screens/entrega-form.js` |
| Prerequisite | weaving OP in production |
| Next action | latex / finishing OP creation |
| Classification | FRONTEND_PRESENT_BACKEND_DISCONNECTED |
| Known defect | `LR-05` (see 4.10); `atualizarEntregaCima` is an explicitly accepted non-transactional delete+insert |
| Evidence | `js/screens/entrega-writes.js:230-282` |

### 4.10 Finishing / latex OP creation

| Field | Value |
|---|---|
| Entity | `public.ops` (tipo `latex` / acabamento) |
| Field or event | created by `public.gerar_op_latex(BIGINT)` / `gerar_op_latex_split(BIGINT, TEXT)` (find-or-accumulate) |
| Writer | server RPC, invoked **best-effort** from the frontend after the delivery insert |
| Frontend surface | `js/screens/entrega-form.js` → `js/screens/entrega-writes.js:263-278` |
| Prerequisite | a weaving delivery with `etapa = 'cima'` |
| Next action | finishing production |
| Classification | BACKEND_CORRECT_FRONTEND_MISSING (the recovery path is missing, not the writer) |
| Known defect | `LR-05` — the RPC failure is caught, toasted (“Gere manualmente”) and the function still returns `true`. There is **no manual generation surface** in the application, so the advertised recovery does not exist |
| Evidence | `js/screens/entrega-writes.js:241-243,263-278`; `db/25_latex_consolidation.sql:170-292`; `db/26_production_flow_invariants.sql:128-130` |

### 4.11 Finishing (acabamento)

| Field | Value |
|---|---|
| Entity | `public.ops` (acabamento), `op_itens` |
| Field or event | finished output, partial release |
| Writer | db/31 partial expedition release, db/32 direct movement |
| Frontend surface | `js/screens/op-latex-admin.js`, `js/screens/manta-output-form.js` |
| Prerequisite | latex OP in `em_producao`, `concluida` or `finalizada` |
| Next action | expedition |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | none newly recorded |
| Evidence | `db/31_acabamento_partial_expedition_flow.sql:213,410`; `db/32_acabamento_expedicao_direct_movement.sql:250-252,456` |

### 4.12 Manta path

| Field | Value |
|---|---|
| Entity | route resolution in `js/product-route.js` |
| Field or event | Manta route = `insumos -> tecelagem -> expedicao -> entrega`; **no acabamento stage** |
| Writer | db/81–db/88 (`manta_*` expedition source, release writer, reversal, measured output identity) |
| Frontend surface | `js/screens/manta-{expedicao-ui,movimento-form,output-form,writes}.js` |
| Prerequisite | product type Manta on the Pedido items |
| Next action | expedition directly from weaving |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | none newly recorded; the reversal path is verified for Manta (db/87) and **not** verified for Tapete (`LR-10`) |
| Evidence | `js/product-route.js:32-45,142,248,268`; `db/85..db/88`; `docs/architecture/MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md` |

### 4.13 Expedition

| Field | Value |
|---|---|
| Entity | `public.expedicoes`, `public.expedicao_itens` |
| Field or event | creation from a finished OP; partial expedition; release |
| Writer | db/23 (`criar/obter expedicao` from a finished latex OP), db/31 (partial), db/86 (Manta release writer), db/87 (Manta reversal) |
| Frontend surface | `js/screens/expedicao-admin.js` |
| Prerequisite | OP status ∈ {`finalizada`, `concluida`} (db/23) or ∈ {`em_producao`, `concluida`, `finalizada`} (db/31, db/32) |
| Next action | delivery |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | `LR-10` — Tapete expedition reversal is not yet verified |
| Evidence | `db/23_expedicao_entrega_flow.sql:204,262,417-440`; `db/87_manta_expedition_reversal_and_route_completion.sql:417-461` |

### 4.14 Transport derivation

| Field | Value |
|---|---|
| Entity | derived from expedition state; no dedicated transport entity |
| Field or event | client step `transporte` in `ROUTE_CLIENT_STEP_KEYS` |
| Writer | none — derived |
| Frontend surface | `js/pedido-tracking-ui.js`, `js/screens/cliente-pedido-tracking.js` |
| Prerequisite | expedition exists |
| Next action | delivery registration |
| Classification | DERIVED_DISPLAY_ONLY |
| Known defect | none |
| Evidence | `js/product-route.js:41-43` |

### 4.15 Delivery

| Field | Value |
|---|---|
| Entity | `public.expedicoes` delivery fields |
| Field or event | `registrar_entrega_expedicao(BIGINT, TEXT, DATE, JSONB, TEXT)` |
| Writer | server RPC, `authenticated` |
| Frontend surface | `js/screens/expedicao-admin.js:414`; `js/screens/pedido-detail-events.js:1655` |
| Prerequisite | an expedition |
| Next action | Pedido conclusion |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | `LR-11` — the reversal of `registrar_entrega_expedicao` is not yet verified |
| Evidence | `db/23_expedicao_entrega_flow.sql:266-365`; `db/81_...sql:252`; `db/82_...sql:177` |

### 4.16 Pedido conclusion

| Field | Value |
|---|---|
| Entity | `public.pedidos` |
| Field or event | `status -> entregue`, with a `pedido_eventos` record |
| Writer | server-side, inside the expedition delivery path |
| Frontend surface | reflected on Pedido detail and `#/pedidos` |
| Prerequisite | expedition fully delivered |
| Next action | terminal |
| Classification | BACKEND_CORRECT_AND_REACHABLE |
| Known defect | none |
| Evidence | `db/23_expedicao_entrega_flow.sql:473` (`'Pedido concluido apos expedicao finalizada'`) |

### 4.17 `status_cliente_visual`

| Field | Value |
|---|---|
| Entity | client-facing published position |
| Field or event | derived read model |
| Writer | db/15, refreshed by db/23, db/30, db/87, db/92 |
| Frontend surface | `js/pedido-tracking-ui.js`, `js/screens/cliente-{dashboard,pedido-detail,pedido-tracking}.js` |
| Prerequisite | Pedido exists |
| Next action | client tracking display |
| Classification | DERIVED_DISPLAY_ONLY |
| Known defect | none newly recorded |
| Evidence | `db/15_status_cliente_visual.sql`; `db/30_cliente_pedido_summary_readmodel.sql:169-170` |

### 4.18 `pedido_parciais`

| Field | Value |
|---|---|
| Entity | `public.pedido_parciais`, `public.pedido_parcial_itens` |
| Field or event | partial deliveries published to the client |
| Writer | db/17 schema; consumed by db/30 read model |
| Frontend surface | client: `js/screens/cliente-{dashboard,pedidos-list}.js` (**mounted**); administrative: `js/screens/pedido-parciais-admin.js` (**NOT mounted**) |
| Prerequisite | partial expedition |
| Next action | none administratively |
| Classification | VALID_BUT_UNREACHABLE (administrative side) |
| Known defect | `LR-07` |
| Evidence | `js/screens/pedido-parciais-admin.js:19,445`; `js/screens/pedido-detail-events.js:63,2835`; `index.html:74` |

### 4.19 Customer route

| Field | Value |
|---|---|
| Entity | client tracking surface |
| Field or event | `ROUTE_CLIENT_STEP_KEYS` — Tapete: `recebido, confirmado, insumos, tecelagem, acabamento, expedicao, transporte, concluido`; Manta: the same without `acabamento` |
| Writer | none — derived from `status_cliente_visual` and partials |
| Frontend surface | `js/screens/cliente-pedido-tracking.js` |
| Prerequisite | Pedido visible to the client |
| Next action | terminal (display) |
| Classification | DERIVED_DISPLAY_ONLY |
| Known defect | `LR-06` — the *administrative* counterpart (`pedido-tracking-admin.js`) is not mounted |
| Evidence | `js/product-route.js:41-43`; `js/screens/pedido-tracking-admin.js:20,332`; `index.html:73` |

---

## 5. Backend/frontend matrix

Classification vocabulary — binding for every future order in this scope:

| Classification | Meaning |
|---|---|
| `BACKEND_CORRECT_AND_REACHABLE` | The server contract is correct and a real user can reach it today. |
| `BACKEND_CORRECT_FRONTEND_MISSING` | The server contract is correct; no application surface reaches it. |
| `FRONTEND_PRESENT_BACKEND_DISCONNECTED` | A surface exists and acts, but its write path is not the authoritative server owner (or there is no server owner). |
| `MIXED_AUTHORITY` | More than one authority writes or reads the same fact. |
| `LEGACY_ONLY` | Only the flat model participates. |
| `NATIVE_ONLY` | Only the native model participates. |
| `VALID_BUT_UNREACHABLE` | The implementation is valid and installed but structurally unreachable (inactive cutover, unmounted surface, missing caller). |
| `DERIVED_DISPLAY_ONLY` | No writer; a projection of other facts. |
| `SPECIFIED_BUT_NOT_IMPLEMENTED` | A contract exists; no implementation does. |
| `NOT_VERIFIED` | Not yet proved either way by this track. |

### 5.1 Current classification table

| Node | Classification | Defect |
|---|---|---|
| Pedido commercial lifecycle | MIXED_AUTHORITY | LR-08 |
| Purchase planning (native) | BACKEND_CORRECT_AND_REACHABLE | — |
| Native Purchase Order (create/emit/cancel/delete) | NATIVE_ONLY | LR-01 (downstream) |
| Supplier acceptance | SPECIFIED_BUT_NOT_IMPLEMENTED | LR-03 |
| Receipt and reversal | VALID_BUT_UNREACHABLE | LR-01 |
| Material availability | MIXED_AUTHORITY | LR-02 |
| Production adjustment (slider) | FRONTEND_PRESENT_BACKEND_DISCONNECTED | LR-04 |
| Weaving OP lifecycle | MIXED_AUTHORITY | LR-09 |
| Weaving delivery | FRONTEND_PRESENT_BACKEND_DISCONNECTED | — |
| Finishing / latex OP creation | BACKEND_CORRECT_FRONTEND_MISSING | LR-05 |
| Finishing (acabamento) | BACKEND_CORRECT_AND_REACHABLE | — |
| Manta path | BACKEND_CORRECT_AND_REACHABLE | — |
| Expedition | BACKEND_CORRECT_AND_REACHABLE | LR-10 |
| Transport derivation | DERIVED_DISPLAY_ONLY | — |
| Delivery | BACKEND_CORRECT_AND_REACHABLE | LR-11 |
| Pedido conclusion | BACKEND_CORRECT_AND_REACHABLE | — |
| `status_cliente_visual` | DERIVED_DISPLAY_ONLY | — |
| `pedido_parciais` (administrative) | VALID_BUT_UNREACHABLE | LR-07 |
| `pedido_parciais` (client) | DERIVED_DISPLAY_ONLY | — |
| Customer route | DERIVED_DISPLAY_ONLY | LR-06 |
| Tapete expedition reversal | NOT_VERIFIED | LR-10 |
| `registrar_entrega_expedicao` reversal | NOT_VERIFIED | LR-11 |

**This matrix must be updated whenever a diagnosis or implementation changes any
classification.** A classification change with no corresponding change-log entry
(section 15) is a defect in the executing order, not in this document.

---

## 6. Legacy/native dependency register

Every known reader or writer of the purchasing entities, with its authority now,
its authority after the coordinated release, and what happens operationally if
the migration does not occur.

### 6.1 `ordens_compra_fio` (flat model)

| Consumer | Current authority | Target authority | Migration requirement | Operational consequence if not migrated | Cutover dependency | Status |
|---|---|---|---|---|---|---|
| `js/calculo-op.js` (payload builder) | LEGACY_ONLY | NATIVE (or retired) | Rebuild the payload against native planning | OP creation keeps materializing flat rows nobody reads | Receipt cutover | OPEN |
| `js/screens/op-persistir.js:330-338` (delete+insert on OP save) | LEGACY_ONLY (writer) | NATIVE via planning | Replace with the native planning writer; note line 306 already branches “Native: no flat `ordens_compra_fio`” | Dual-model divergence on every OP save | Receipt cutover | OPEN |
| `js/screens/op-nova.js:1287,1293` (OP purchasing read) | LEGACY_ONLY (reader) | NATIVE read model | Point at the native projection | New purchases are invisible on the OP screen | Receipt cutover | OPEN |
| `js/screens/op-writes.js:93,122` (supplier assignment) | LEGACY_ONLY (writer) | NATIVE | Decide with DEBT-1 (`window.atribuirFornecedorFioOp` has no caller) | Dead or divergent supplier assignment | Native supplier queue | OPEN |
| `js/screens/fornecedor.js:472,539` (supplier screen read/update) | LEGACY_ONLY | NATIVE supplier queue | Replace with the native queue (LR-03) | The supplier never sees a native order | Native supplier queue | OPEN |
| `js/screens/pedido-detail-data.js:397-407` | MIXED (canonical first, flat fallback) | NATIVE only | Remove the flat fallback after cutover | Pedido detail silently shows the flat projection | Receipt cutover | OPEN |
| `js/screens/ordem-compra-receipt-cutover.js:182-243` (`listar_ordens_compra_fio_compat`) | ADAPTER (db/76) | Retire after cutover | Retire the compat shape once every consumer is native | Permanent shim | Receipt cutover | OPEN |
| `js/delete-helpers.js:82` (controlled delete) | LEGACY_ONLY | NATIVE + LEGACY | Cover both models | Controlled delete leaves native rows behind | Receipt cutover | OPEN |
| `js/supabase-client.js:64,96` (RPC allowlist) | ADAPTER | Update on cutover | Keep the allowlist consistent | Blocked RPC at runtime | Receipt cutover | OPEN |

### 6.2 `ordem_compra`, `ordem_compra_item`, `ordem_compra_item_alocacao` (native model)

| Consumer | Current authority | Target authority | Migration requirement | Operational consequence | Cutover dependency | Status |
|---|---|---|---|---|---|---|
| `js/screens/ordem-compra-*.js` (document surfaces) | NATIVE_ONLY | unchanged | none | — | — | CURRENT |
| `js/screens/pedido-insumos-distribuicao.js` | NATIVE_ONLY | unchanged | none | — | — | CURRENT |
| `obter_ordem_compra_admin` / `listar_ordens_compra_admin` | NATIVE read models (db/77 → db/100) | unchanged | `acoes.receber` unblocks with the cutover | Receipt stays refused | Receipt cutover | OPEN |
| Native receipt writer (db/70/74/75/76) | NATIVE, fenced | NATIVE, active | Activate the cutover under the coordinated release | Receipt unreachable | Receipt cutover | OPEN |
| `public.oc_cobertura_ativa` / `oc_recalcular_cache_necessidade` (db/100) | NATIVE, single owner | unchanged | every balance owner must read this one definition | Divergent coverage | — | CURRENT |

### 6.3 `necessidade_compra_planejamento`

| Consumer | Current authority | Target authority | Migration requirement | Operational consequence | Cutover dependency | Status |
|---|---|---|---|---|---|---|
| db/99 planning RPCs | NATIVE, server-owned | unchanged | none | — | — | CURRENT |
| `js/screens/pedido-insumos-distribuicao.js` | NATIVE reader | unchanged | none | — | — | CURRENT |
| `excluir_ordem_compra` (rascunho branch) | returns planning with db/99 merge semantics | unchanged | none | — | — | CURRENT |

### 6.4 `necessidade_compra_fio` and received/reversed material projections

| Consumer | Current authority | Target authority | Migration requirement | Operational consequence | Cutover dependency | Status |
|---|---|---|---|---|---|---|
| `necessidade_compra_fio.kg_alocado` | NATIVE cache, sole writer `oc_recalcular_cache_necessidade` | unchanged | none | — | — | CURRENT |
| `saldo_fios`, `saldo_fios_op` (snapshot at `iniciarProducaoOP`) | FRONTEND-driven snapshot | server-owned | Fold into the atomic production-adjustment writer | Non-atomic snapshot, silent partial state | Coordinated release | OPEN |
| `ordens_compra_fio.kg_recebido` | LEGACY receipt projection | NATIVE receipt projection | Replace with the native receipt ledger | Receipt never reaches availability | Receipt cutover | OPEN |
| Historical `saldo_fios` provenance | UNKNOWN | must be ruled before any real receipt cutover | Architect ruling | Cannot reconcile pre-cutover balances | Receipt cutover | OPEN — `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` |

### 6.5 `ordem_compra_fio_lancamentos`

| Consumer | Current authority | Target authority | Migration requirement | Operational consequence | Cutover dependency | Status |
|---|---|---|---|---|---|---|
| Receipt ledger entries | NATIVE, zero rows in production at baseline | NATIVE, active | Activate with the receipt cutover | No ledger, so no auditable arrival | Receipt cutover | OPEN |

`ordem_compra_item` and `ordem_compra_item_alocacao` are covered by 6.2;
`ordem_compra` is the parent document of that same row set.

---

## 7. Accepted supervisor rulings

The following are **binding** and may not be reinterpreted by an executor.

### 7.1 `pedidos.produzindo`

- It **will not be retired** during the coordinated receipt release.
- It **remains contractually valid**.
- **db/91 has a live dependency on it** (`db/91_pedido_item_production_priority.sql:621-622`:
  the production-impact confirmation branch tests `v_pedido.status = 'produzindo'`).
- A **canonical server-owned transition must be designed** for it.
- **Direct frontend `UPDATE` authority is not accepted.** The current
  `js/screens/pedido-detail-events.js::alterarStatus()` direct `UPDATE` on
  `pedidos.status` is not the target design.
- Final implementation **remains pending design evidence**.

### 7.2 `ops.finalizada`

- It **will not receive a new writer** in this release.
- It **remains temporarily in the schema** for legacy compatibility (db/21 records
  `concluida` as canonical and `finalizada` as legacy latex).
- It **receives no frontend action**.
- **No existing `concluida` record will be migrated.**
- **Later removal requires zero real records and zero remaining consumers.**

### 7.3 Coordinated deployment boundary

The following **must form one coordinated implementation boundary** and must not
be shipped as independent phases:

1. atomic production-adjustment writer;
2. native receipt and reversal activation;
3. native material-availability readers;
4. OP and Pedido slider reconnection;
5. native supplier queue;
6. receipt cutover;
7. authenticated continuation into production.

> **No intermediate production state may expose receipt while slider persistence
> remains non-atomic.**

### 7.4 Prohibited bridge

- **No native-to-flat dual writing.**
- **No synthetic `ordens_compra_fio` materialization.**
- **No representative OP fabrication for shared purchases.**

A bridge of any of these three shapes is prohibited even as a temporary
compatibility measure and even if it would make a phase pass in isolation.

---

## 8. Open verified defects

Each entry: identifier; severity; blocking status; affected operational actions;
root cause; expected repair boundary; evidence; current disposition. **A debt
identifier is never stored here without its operational consequence.**

### LR-01 — Inactive native receipt cutover

- **Severity**: CRITICAL. **Blocking**: YES.
- **Affected operational actions**: register a receipt; reverse a receipt; see
  arrived material; progress any OP that depends on arrived material.
- **Root cause**: `ordem_compra_cutover` is `legacy_active` / `flat` in
  production; db/100 correctly subordinates `acoes.receber` to it and returns
  `recebimento_canonico_inativo`; the db/75/db/76 writer fence is intact.
- **Expected repair boundary**: the coordinated release (7.3) as a whole.
- **Evidence**: `db/100_...sql:789-845,940`; `db/75_...sql:131,212,256,285`;
  production cutover state recorded as `legacy_active/flat` at the db/100 preflight.
- **Disposition**: OPEN — the primary blocker of this recovery.

### LR-02 — Legacy-dependent OP and Pedido availability readers

- **Severity**: CRITICAL. **Blocking**: YES.
- **Affected operational actions**: OP purchasing view; Pedido detail purchasing
  projection; supplier screen; controlled delete.
- **Root cause**: db/99 moved creation to the native model; these consumers still
  read `ordens_compra_fio`, which new purchases no longer populate.
- **Expected repair boundary**: native material-availability readers + slider
  reconnection, inside the coordinated release.
- **Evidence**: `js/screens/op-nova.js:1287,1293`; `js/screens/pedido-detail-data.js:397-407`;
  `js/screens/fornecedor.js:472,539`; `js/screens/op-persistir.js:306,330-338`.
- **Disposition**: OPEN.

### LR-03 — Missing native supplier queue

- **Severity**: HIGH. **Blocking**: YES for supplier acceptance.
- **Affected operational actions**: a supplier viewing, accepting or acting on a
  native Purchase Order.
- **Root cause**: the supplier surface is flat-model only; the native acceptance
  contract (`status_aceite`, `exige_aceite`) has no reachable implementation and
  PHASE-C5B does not exist.
- **Expected repair boundary**: native supplier queue inside the coordinated release.
- **Evidence**: `js/screens/fornecedor.js:472,539`; `db/77_...sql:36-45`.
- **Disposition**: OPEN.

### LR-04 — Non-atomic `salvarDistribuicaoOP` loop

- **Severity**: HIGH. **Blocking**: YES for the coordinated release (7.3 forbids
  exposing receipt while this stands).
- **Affected operational actions**: saving the production distribution on an OP.
- **Root cause**: a frontend `for` loop issuing one `UPDATE` per `op_itens` row
  with no RPC and no transaction; a mid-loop failure returns `{ partial: true }`
  with some rows persisted.
- **Expected repair boundary**: one atomic server-owned production-adjustment RPC.
- **Evidence**: `js/screens/op-recalculo.js:194-206`; caller `js/screens/op-distribuicao-ui.js:347`.
- **Disposition**: OPEN — DESIGN_PENDING (9.2).

### LR-05 — Best-effort `gerar_op_latex` invocation with no manual recovery surface

- **Severity**: HIGH. **Blocking**: NO (does not block the receipt release).
- **Affected operational actions**: creating the finishing/latex OP after a
  weaving delivery; recovering when that creation fails.
- **Root cause**: the RPC error is caught, toasted as “Gere manualmente” and the
  writer still returns `true`; no manual generation surface exists in the
  application, so the advertised recovery path is fictional.
- **Expected repair boundary**: either a real manual generation surface or a
  server-owned transactional delivery+OP creation.
- **Evidence**: `js/screens/entrega-writes.js:241-243,263-278`.
- **Disposition**: OPEN — DESIGN_PENDING (9.9).

### LR-06 — `pedido-tracking-admin.js` not mounted

- **Severity**: MEDIUM. **Blocking**: NO.
- **Affected operational actions**: an administrator viewing or correcting the
  customer-visible tracking position.
- **Root cause**: `buildTrackingAdmin()` is exposed on a returned object and
  invoked by nothing; the asset is loaded by `index.html` but never reached.
- **Expected repair boundary**: an owning product decision (mount or retire),
  then tracking/partial mounting (9.12).
- **Evidence**: `js/screens/pedido-tracking-admin.js:20,332`;
  `js/screens/pedido-detail-events.js:51,2834`; `index.html:73`.
- **Disposition**: OPEN. Mirrors `PEDIDO-DETAIL-ADMIN-BUILDERS-UNREACHABLE`;
  mounting is currently **prohibited** without an owning product decision.

### LR-07 — `pedido-parciais-admin.js` not mounted

- **Severity**: MEDIUM. **Blocking**: NO.
- **Affected operational actions**: an administrator recording or correcting a
  partial delivery published to the client.
- **Root cause**: identical to LR-06 for `buildParciaisAdmin()`.
- **Expected repair boundary**: same as LR-06.
- **Evidence**: `js/screens/pedido-parciais-admin.js:19,445`;
  `js/screens/pedido-detail-events.js:63,2835`; `index.html:74`.
- **Disposition**: OPEN, same prohibition.

### LR-08 — `pedidos.produzindo` without a writer

- **Severity**: MEDIUM. **Blocking**: NO for the receipt release; YES for any
  claim that the production phase is represented on the Pedido.
- **Affected operational actions**: a Pedido never displays “Em produção”, and
  db/91's production-impact confirmation branch is unreachable.
- **Root cause**: the state is declared in the CHECK constraint and in every
  label map, and nothing writes it.
- **Expected repair boundary**: a canonical server-owned Pedido status writer (9.1).
- **Evidence**: `db/13_pedidos_schema.sql:50,61`; `db/91_...sql:621-622`;
  `js/pedido-ui.js:152,161`; `js/pedido-priority.js:242`.
- **Disposition**: OPEN — ruled in 7.1, DESIGN_PENDING.

### LR-09 — `ops.finalizada` unreachable

- **Severity**: LOW. **Blocking**: NO.
- **Affected operational actions**: none today; it is read by expedition
  eligibility predicates that also accept `concluida`.
- **Root cause**: `concluida` became canonical in db/21; `finalizada` was left as
  legacy latex compatibility and no writer was retained.
- **Expected repair boundary**: none in this release (ruled in 7.2). Removal
  requires zero real records and zero remaining consumers.
- **Evidence**: `db/01_schema.sql:90`; `db/21_...sql:7,13-15,59,64`;
  `db/23_...sql:204,417-440`; `db/31_...sql:213`; `db/32_...sql:250-252`.
- **Disposition**: OPEN / DEFERRED BY RULING.

### LR-10 — Tapete expedition reversal not yet verified

- **Severity**: MEDIUM. **Blocking**: NO for the receipt release; YES for the
  recovery matrix (9.9/9.10).
- **Affected operational actions**: undoing a Tapete expedition created in error.
- **Root cause**: db/87 designed and proved the reversal for the Manta route; the
  equivalent Tapete path has not been verified either way.
- **Expected repair boundary**: verification first; repair only if the
  verification finds a gap.
- **Evidence**: `db/87_manta_expedition_reversal_and_route_completion.sql:417-461`
  (Manta); no equivalent verified for Tapete.
- **Disposition**: OPEN — classification `NOT_VERIFIED`.

### LR-11 — `registrar_entrega_expedicao` reversal not yet verified

- **Severity**: MEDIUM. **Blocking**: NO for the receipt release; YES for the
  recovery matrix.
- **Affected operational actions**: correcting a delivery registered in error,
  including the derived Pedido conclusion it triggers.
- **Root cause**: the delivery writer exists and is reachable; no reversal path
  has been proved, and the delivery also drives `pedidos.status -> entregue`.
- **Expected repair boundary**: verification first, then delivery correction (9.11).
- **Evidence**: `db/23_...sql:266-365,473`; `js/screens/expedicao-admin.js:414`;
  `js/screens/pedido-detail-events.js:1655`.
- **Disposition**: OPEN — classification `NOT_VERIFIED`.

### LR-12 — Production backup/cutover recovery blocker unresolved

- **Severity**: HIGH. **Blocking**: YES for the cutover step of the coordinated
  release.
- **Affected operational actions**: activating the receipt cutover in production
  with a rehearsed recovery position.
- **Root cause**: the canonical backup mechanism depends on architect-supplied
  libpq credentials and on a working local PostgreSQL cluster for restore
  rehearsal. `PRODUCTION-CUTOVER-BACKUP-MECHANISM-UNAVAILABLE` was resolved once
  by forward correction for the db/95 cutover; a **fresh** artifact and a fresh
  rehearsal are required for this cutover, and neither exists.
- **Expected repair boundary**: pre-PONR entry criteria of the coordinated release.
- **Evidence**: `docs/governance/current-state.json` ::
  `PRODUCTION-CUTOVER-BACKUP-MECHANISM-UNAVAILABLE`; `scripts/backup/export-db.mjs`.
- **Disposition**: OPEN — must be satisfied before PONR (9.6).

### 8.1 Related debts already owned elsewhere

These are **not** restated here as new identities; they are load-bearing for this
recovery and are owned by `docs/governance/current-state.json`:

| Identity | Relevance |
|---|---|
| `HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE` | Must be ruled before any real receipt cutover (6.4). |
| `NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED` | Directly gates LR-01. |
| `DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR` | Gates the `op-writes.js` row of 6.1. |
| `PEDIDO-DETAIL-ADMIN-BUILDERS-UNREACHABLE` | Same surfaces as LR-06 / LR-07. |
| `PEDIDO-ITEM-DELETE-ORPHANS-OP-LINK` | Pedido item deletion silently orphans OP and expedition rows. |
| `PEDIDO-ITEM-LARGURA-OVERRIDE-PRESERVATION-RISK` | Latent per-item override loss on any admin item save. |

---

## 9. Target product design

> **READ THIS SECTION AS A SPECIFICATION, NOT AS A REPORT.**
> Section 9 describes how the product **must work after the corrections**.
> Sections 3–6 and 8 describe **what the code does today**. The two must never be
> merged, and the target graph must never be rewritten as a diagram of current
> defects.

### 9.0 The four distinct registers used in this document

| Register | Where it lives | What it means |
|---|---|---|
| **TARGET PRODUCT SPECIFICATION** | §9 and the target diagram | Desired behaviour. A transition without a writer, RPC or screen today still belongs here. |
| **CURRENT IMPLEMENTATION FACTS** | §3, §4, §5, §6, §13 | Measured repository and production reality at the accepted baseline. |
| **IMPLEMENTATION GAPS** | §8 and §9.C | The delta between the two above. A gap is a fact about the code, never a change to the target. |
| **IMPLEMENTATION AUTHORIZATION** | §14 and `current-state.json` | Whether anyone may write product code. **Documenting a target authorizes nothing.** |

### 9.1 Target graph artifacts

| Artifact | Path | Role |
|---|---|---|
| Target graph (visual) | [`diagrams/pedido-derived-lifecycle-target.svg`](diagrams/pedido-derived-lifecycle-target.svg) | 15 lanes + isolated legacy area. Derived evidence; this text is authoritative. |
| Target graph (source) | [`diagrams/pedido-derived-lifecycle-target.mmd`](diagrams/pedido-derived-lifecycle-target.mmd) | Mermaid source for review and correction; carries R1–R13 and D1–D6 in its header. |
| Current-state graph | [`diagrams/pedido-derived-lifecycle-current.svg`](diagrams/pedido-derived-lifecycle-current.svg) | **Historical/current-state evidence only.** Not the target. |

### 9.2 Target lifecycle explanation

**When each entity is born.** The Pedido is born commercially. Confirmation does
**not** create a weaving OP — it makes the explicit **Criar OP de Tecelagem**
action reachable. The OP is born `simulada`, belonging to the Pedido, with its
items and planned metres still reviewable. An explicit operator action opens it
to `aberta`, and only then are purchase requirements synchronized. Requirements
exist before any Purchase Order. Planning decides *who supplies* and creates no
document. The Purchase Order is born only at the explicit **Generate** act, from
planning rows of one supplier. Receipt exists only against an emitted native
Purchase Order.

**What enables the next step.** Receipt → ledger entry → distribution across the
**real allocations** → canonical availability per OP. Availability sets the
slider ceiling. An atomically saved adjustment satisfies the production-start
gate. Partial receipt reduces the ceiling without blocking: partial production is
valid.

**What each step produces.** Requirements produce traceability to
Pedido/OP/item/material/colour. Planning produces the supplier decision without a
document. The Purchase Order produces the commercial commitment. Receipt produces
the physical fact and its auditable history. Availability produces eight
*related* measures — required, planned, purchased, received, reversed, allocated,
committed/consumed, available — never collapsed into one number.

**Shared purchases.** Cotton is a requirement **per OP**; polyester is a
requirement **per Pedido**, shared across OPs. An OP sees only the share actually
allocated to it, never the supplier total. This is why representative-OP
fabrication is prohibited: it would destroy the real allocation.

**Tapete vs Manta.** After weaving, Tapete goes to a finishing/latex OP and only
then to expedition. Manta goes **directly** to expedition. Both converge on the
same expedition entity, but their reversal writers are distinct because their
production sources differ.

**How reversals work.** Every advance has its return. Cancelling a Purchase Order
releases active coverage and returns the requirement to planning. Reversing a
receipt reverses the ledger and recomputes allocations and availability.
Replacing an adjustment reopens the slider. Correcting a movement recomputes the
balance. Reversing an expedition returns quantity to pending. Correcting a
delivery recomputes totals and, per D1, can undo a premature conclusion.

**Two axes always visible.** `Commercial status: Confirmado` +
`Operational stage: Aguardando recebimento` + `Next action: Registrar
recebimento`. The operational axis **projects**; it never replaces the commercial
one.

### 9.3 Binding target rulings R1–R13

| # | Ruling |
|---|---|
| R1 | Weaving OP persisted states are `simulada → aberta → em_producao → pausada / concluida`, plus cancellation by eligibility. Balance or completion percentage establishes **eligibility only**; an explicit **Concluir OP** action validated by the canonical server-owned lifecycle writer performs the transition. "OP planejada" is not a persisted state. |
| R2 | Pedido confirmation does not create a weaving OP. It makes **Criar OP de Tecelagem** reachable. Sequence: confirmado → operator creates → `simulada` → items/metres reviewed → operator opens → `aberta` → requirements synchronized. Duplicate-prevention guards are later implementation design. |
| R3 | "Aguardando recebimento/disponibilidade de insumos" is a **derived condition**, placed after the OP is open and before a valid adjustment can be saved. It admits partial availability. |
| R4 | There is no `nao_aplicavel → pendente` transition. At emission the frozen configuration selects one branch. Only `pendente → aceita` and `pendente → rejeitada` are acceptance decisions. |
| R5 | A rejected or emitted Purchase Order never returns to `rascunho`. Emission freezes the commercial document. Recovery = cancel/close by eligibility → release and replan the requirement → generate a **replacement** Purchase Order with its own identity and number. |
| R6 | The receipt axis is derived from native receipt and reversal facts. No direct manual status editing. |
| R7 | The normal Tapete path is automatic idempotent/transactional finishing-OP creation. A manual action appears only as a recovery surface after a proved automatic failure — never a parallel normal route. |
| R8 | Tapete and Manta expedition reversals are **distinct** paths. They may converge as a business concept but not as one identical persisted transition. |
| R9 | Delivery correction triggers full recomputation of delivered quantities and of the Pedido conclusion condition. |
| R10 | Customer tracking "Em preparação" covers the whole confirmed pre-production interval (OP opening, purchasing, receipt, adjustment). "Em produção" only when production actually begins. Tracking is a projection, never an independent authority. |
| R11 | The eight material quantities are **related measures**, not a mandatory temporal chain. Visual order implies neither calculation order nor independent persistence. Pedido-origin polyester stays visibly shared and distributed through real allocations. |
| R12 | After a saved receipt there is a visible **Revisar produção** continuation. One benefiting OP → that OP's screen anchored at the shared adjustment block; several → the Pedido's consolidated production panel identifying the affected OPs. The complete slider never lives inside the receipt modal. |
| R13 | The coordinated release boundary keeps the corrected Block 1 ordering of §9.5. |

### 9.4 Binding target rulings D1–D6

#### D1 — Pedido state after delivery correction

When correcting or reversing a delivery makes a previously delivered,
non-cancelled Pedido incomplete: **`entregue → produzindo`**.

- cancelled remains cancelled;
- non-cancelled and incomplete becomes `produzindo`;
- fully delivered becomes `entregue`.

The canonical server-side writer owns this recomputation. The delivery-correction
writer must **not** return directly to `confirmado`.

#### D2 — Committed material contract

For this coordinated release, available material for one OP is:

```
net native receipt allocated to the OP
  minus active calculated consumption reserved by other OPs
```

The reservation authority is the **latest atomically saved production
adjustment**.

- simulated/open OP with a saved adjustment: **reserved**;
- in-production/paused/concluded OP: **committed or consumed**;
- the OP being recalculated receives its own current reservation back before its
  new ceiling is computed;
- planned metres alone do not reserve material;
- measured physical yarn consumption is **not** claimed until such an authority
  exists.

#### D3 — Supplier acceptance configuration

`exige_aceite` is configured **per supplier** and defaults to `false`. At
emission its value is copied and frozen on the Purchase Order.

- `false` → `status_aceite = nao_aplicavel`;
- `true` → `status_aceite = pendente`;
- later supplier-setting changes do not mutate emitted Purchase Orders.

#### D4 — Finishing-OP idempotency

Normal automatic creation is idempotent by **`origem_entrega_id`**. For a
legitimate split flow, the identity is `origem_entrega_id` **+ a deterministic
split discriminator**. The idempotency identity must not be the source weaving OP
alone, mutable free text, or execution time.

#### D5 — Proved automatic failure

The recovery surface is reachable only when server-owned evidence proves all of:

1. the weaving delivery committed successfully;
2. no canonical finishing OP exists for the expected identity;
3. an automatic attempt is recorded as failed.

The failure record or event must identify the source delivery, failure code,
time, execution actor/process, and result. The recovery action **retries the same
canonical idempotent writer**; it is not a free-form manual OP-creation path.

#### D6 — Tapete expedition reversal

The Tapete reversal writer operates on **expedition items** and records a
reversal movement. It must:

- reduce released metres by item;
- reject reversal above released quantity;
- reject any result below already delivered quantity;
- preserve source and commercial lineage;
- recompute finished-output availability.

Finished-output availability is derived from **measured finished output minus
currently released expedition quantity**. A standalone "finished stock balance"
is never edited directly.

#### D7 — Cancellation eligibility in the target product

**Pedido cancellation.** The target shows one **server-owned cancellation-eligibility
gate** reachable from `rascunho`, `recebido`, `confirmado` and `produzindo`.

An `entregue` Pedido **may not transition directly to `cancelado`**. Where
cancellation is required after delivery, the delivery must first be corrected or
reversed under **D1**, causing the canonical recomputation.

Cancellation:

- preserves the Pedido and every historical operational and commercial fact;
- never means physical deletion;
- does not erase OPs, Purchase Orders, receipts, movements, expeditions,
  deliveries or their provenance;
- leaves the exact compensation ordering to the coordinated technical design.

**OP cancellation.** The eligibility gate is reachable from `simulada`, `aberta`,
`em_producao` and `pausada`.

A `concluida` OP **may not transition directly to `cancelada`**. It must first be
removed from its terminal condition through an authorized correction or reversal.
`finalizada` remains legacy compatibility and receives no new action or writer.

**Pedido `produzindo` label.** `produzindo` does not arise only from an initial
production start. Its target meaning is:

```
Produzindo
iniciado pela produção ou restaurado pela recomputação D1
```

### 9.5 Coordinated implementation blocks

**Block 1 — receipt → production continuity (indivisible; the §7.3 boundary).**
No intermediate production state may expose receipt while slider persistence is
non-atomic, and no surface may remain operationally dependent on the flat model
when the canonical cutover is activated.

1. **Repoint every active flat-model consumer** (§6.1) — supplier, Pedido, OP,
   slider, availability, delete, receipt and purchasing surfaces.
2. Native material-availability projection implementing **D2**.
3. Repoint the slider ceiling to that projection.
4. Atomic production-adjustment RPC (all items or none).
5. **Native supplier queue and acceptance/rejection writers**, implementing **D3**.
6. Activate native receipt and reversal.
7. Perform the canonical cutover.
8. Prove authenticated continuation into production, including the **R12**
   post-receipt navigation.

Physical removal of `ordens_compra_fio` remains later. Operational dependency on
it does not.

**Block 2 — Pedido operational status.** Two separate obligations:

- the canonical server-owned `pedidos.status` writer covering `produzindo` — owned
  by **§7.1** and **D1** (D1 also restores `produzindo` when a delivery correction
  makes a delivered Pedido incomplete);
- routing production start through the OP lifecycle writer — owned by **R1**.

R2 is not part of Block 2. R2 owns exclusively the explicit
*Pedido confirmed → create weaving OP* sequence of §9.3.

**Block 3 — Tapete finishing continuity.** Idempotent automatic finishing-OP
creation (**D4**), the proved-failure recovery surface (**D5**), and transactional
weaving movement correction.

**Block 4 — reversal symmetry.** Tapete expedition reversal (**D6**) and delivery
correction with conclusion undo (**D1**).

**Block 5 — legacy retirement.** Physical removal of `ordens_compra_fio` and the
flat compatibility shims, only after Block 1.

Tracking/partials administrative mounting (LR-06 / LR-07) stays outside these
blocks pending the owning product decision.

### 9.6 Target-versus-current gap matrix

Classification: **já implementada** · **parcial** · **ausente** · **conflitante**
· **dependente de decisão**.

| # | Target element | Current situation | Gap | Affected files | Correction |
|---|---|---|---|---|---|
| 1 | OP exists before purchases | `persistirOP` inserts `ops`, then items, then syncs requirements only when `status='aberta'` | **já implementada** | `js/screens/op-persistir.js:220,295-313` | none — the old graph was wrong, not the code |
| 2 | Operator creates then opens the OP (R2) | Creation and opening exist, but confirmation-gating and duplicate guards are not modelled | **parcial** | `js/screens/op-persistir.js`, `js/screens/op-nova.js` | make the two acts explicit and gated |
| 3 | OP states + explicit Concluir OP (R1) | `alterar_status_op` holds the matrix; production start bypasses it with a direct `UPDATE` | **parcial** | `db/21_op_lifecycle_status_eventos.sql:129`; `js/screens/op-recalculo.js:181` | route every transition through the canonical writer |
| 4 | Requirements derived from OP items | cotton per OP, polyester per Pedido | **já implementada** | `db/67_ordem_compra_refoundation_schema.sql:71-110` | none |
| 5 | Planning creates no document | db/99 two-stage model | **já implementada** | `db/99_planejamento_compra_refoundation.sql` | none |
| 6 | Three orthogonal OC axes | all three columns exist | **já implementada** | `db/67:187-192` | none |
| 7 | Acceptance branch frozen at emission (D3) | `status_aceite` exists; no writer; `exige_aceite` has no per-supplier configuration and no write path | **ausente** | `db/65`, `db/77:36-45` | per-supplier setting + freeze-on-emission + acceptance/rejection writers |
| 8 | Rejected OC → replacement OC (R5) | no rejection, closure or replacement writer | **ausente** | — | cancel/close + replan + generate replacement |
| 9 | Register receipt | `registrar_recebimento_ordem_compra` exists | **implementada, inalcançável** | `db/70:458`; `db/100:789-845` | activate the cutover |
| 10 | Reverse receipt | `estornar_recebimento_ordem_compra` exists | **implementada, inalcançável** | `db/70:805` | same activation |
| 11 | Ledger + allocation distribution | tables exist, zero rows | **implementada, inalcançável** | `db/70:17,144` | same activation |
| 12 | Canonical availability of received material (D2) | `oc_cobertura_ativa` measures **purchase coverage**, not received material; no reservation concept | **ausente** | `db/100:60-137` | native projection implementing D2 |
| 13 | Slider ceiling reads native availability | reads `ord.kg_recebido` from flat `ordens_compra_fio`, today **0 rows** ⇒ ceiling 0 | **conflitante** | `js/screens/op-recalculo.js` (`maxMetrosItem`) | repoint to the D2 projection |
| 14 | Slider shared OP + Pedido | one builder, two mounts, one writer | **já implementada** | `js/screens/op-distribuicao-ui.js`; `op-nova.js:1601`; `pedido-detail-events.js:933,950` | none |
| 15 | Atomic all-or-nothing save | per-row `UPDATE` loop returning `{partial:true}` | **ausente** | `js/screens/op-recalculo.js:194-206` | one atomic RPC |
| 16 | Post-receipt "Revisar produção" (R12) | no continuation after receipt | **ausente** | receipt screens | continuation + 1-OP / N-OPs routing |
| 17 | Pedido → Produzindo derived (§7.1/D1) | no writer at all | **ausente** | `db/13:50`; `db/91:621-622` | canonical server-owned status writer |
| 18 | Weaving movements + correction | exist; `atualizarEntregaCima` is a non-transactional delete+insert | **parcial** | `js/screens/entrega-writes.js` | transactional writer |
| 19 | Automatic idempotent finishing OP (D4) | `gerar_op_latex` is best-effort; idempotency identity not the delivery | **conflitante** | `entrega-writes.js:241-278`; `db/25:177` | idempotent by `origem_entrega_id` |
| 20 | Proved-failure recovery surface (D5) | toast says "gere manualmente"; **no such surface exists**; no failure record | **ausente** | `entrega-writes.js:241-243` | failure record + gated retry surface |
| 21 | Manta direct route | correct | **já implementada** | `js/product-route.js:32-34`; `db/86` | none |
| 22 | Expedition creation/partial | three release writers | **já implementada** | `db/23:177`, `db/31:164`, `db/86:306` | none |
| 23 | Manta expedition reversal | writer + screen exist | **já implementada** | `db/87:64`; `manta-writes.js:194` | none |
| 24 | Tapete expedition reversal (D6) | **no writer exists** (full `estornar_*` sweep) | **ausente** | — | writer per D6 + screen |
| 25 | Register delivery | exists | **já implementada** | `db/23:269` | none |
| 26 | Conclusion derived from delivery | `concluir_pedido_se_pronto` already derives it | **já implementada** | `db/23:373`; `db/87:369` | none |
| 27 | Delivery correction undoing conclusion (D1) | **no writer exists** | **ausente** | — | correction writer + `entregue → produzindo` |
| 28 | Customer tracking projection (R10) | client surfaces mounted; "Em preparação" anchoring undefined | **parcial** | `status_cliente_visual`; `js/screens/cliente-*` | widen to the confirmed pre-production interval |
| 29 | Admin tracking/partials surfaces | not mounted | **dependente de decisão** | `pedido-tracking-admin.js:332`; `pedido-parciais-admin.js:445` | owning product decision |
| 30 | Pedido cancellation eligibility gate from the four non-terminal states (D7) | frontend `canTransition` table only; no server-owned eligibility gate; no rule forbidding `entregue → cancelado` | **ausente** | `js/screens/pedido-chain-state.js`; `js/screens/pedido-detail-events.js:150-175` | server-owned gate + D1 precondition after delivery |
| 31 | OP cancellation eligibility gate from the four non-terminal states (D7) | `alterar_status_op` already refuses transitions out of `concluida`/`cancelada`/`finalizada` and admits cancellation from `simulada`/`aberta`/`em_producao`/`pausada` | **já implementada** | `db/21_op_lifecycle_status_eventos.sql:129-215` | none — the target matches the existing writer |
| 32 | Legacy outside the flow | six consumers still read/write the flat model | **conflitante** | `op-nova.js:1287,1293`; `op-persistir.js:330-338`; `fornecedor.js:472,539`; `pedido-detail-data.js:397-407`; `op-writes.js:93,122`; `delete-helpers.js:82` | repoint in Block 1; retire in Block 5 |

**Reversal coverage against the target:**

| Reversal | Status |
|---|---|
| Pedido cancellation (D7) | parcial — frontend transition only; no server-owned eligibility gate and no `entregue` guard |
| OP cancellation (D7) | já implementada — `alterar_status_op` already matches the D7 gate |
| Purchase Order cancellation | já implementada (`cancelar_ordem_compra`, db/100) |
| Receipt reversal | implementada, inalcançável (cutover inactive) |
| Production-adjustment replacement | parcial (overwrites, not atomic) |
| Weaving movement correction | parcial (non-transactional) |
| Manta expedition reversal | já implementada |
| Tapete expedition reversal | **ausente** |
| Delivery correction | **ausente** |

### 9.7 Remaining assumptions

Every product choice ruled by R1–R13 and D1–D7 has been removed from this list.
What remains are **technical design details**, not product decisions:

1. Physical shape of the D2 projection — materialized view, table with triggers,
   or on-demand function — and its concurrency/locking boundary under simultaneous
   adjustments of two OPs sharing polyester.
2. Exact signature and payload of the atomic adjustment RPC, and whether the
   `saldo_fios` / `saldo_fios_op` snapshot of `iniciarProducaoOP` folds into the
   same transaction.
3. Storage of the D5 failure record — new table, reuse of an existing event
   table, or an attempt column on the delivery — and its retention.
4. Concrete form of the D4 deterministic split discriminator.
5. Cutover state machine transitions, lock boundary, reconciliation and
   observability (§9.5 step 7), plus PONR, pre-PONR rollback rehearsal and
   post-PONR forward recovery.
6. Whether the D6 Tapete reversal reuses the db/87 Manta command/event shape or
   needs its own, given the different production source.
7. Route and layout of the R12 consolidated Pedido production panel.

### 9.8 Acceptance and authorization status of this section

**The TARGET FUNCTIONAL PRODUCT DESIGN of this section is
`CLOSED / ACCEPTED AS THE TARGET FUNCTIONAL PRODUCT SPECIFICATION`**, accepted by
the supervisor at commit `a41a3db98372a3976635d8ffbd27a7832bb168a4` under
`PEDIDO-DERIVED-LIFECYCLE-TARGET-FUNCTIONAL-DESIGN-ACCEPTANCE-R1`.

Accepted scope: rulings **R1–R13** and **D1–D7**; the 15-lane target lifecycle;
the separation between commercial and operational state; explicit creation and
opening of the weaving OP before receipt; two-stage purchase planning and
Purchase Order generation; the three orthogonal Purchase Order axes; native
receipt, reversal and allocation semantics; native availability feeding the
shared slider; atomic production adjustment; post-receipt continuation; Tapete
and Manta route separation; finishing recovery; expedition and delivery
reversals; and Pedido and OP cancellation eligibility.

**What this acceptance means:** the diagram and this section correctly state how
the product must function after correction.

**What it explicitly does NOT mean:**

- it does **not** accept an implementation-ready technical design;
- it does **not** authorize implementation;
- it does **not** authorize the native receipt cutover;
- it does **not** accept the db/100 supervisor review, which remains outstanding.

The residual technical details of §9.7 remain open and are the subject of
`NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1`, which is **DESIGN ONLY**.
Implementation authorization lives only in `docs/governance/current-state.json`
and §14.

## 9.9 Proposed implementation-ready coordinated technical design

```
PROPOSED / AWAITING SUPERVISOR REVIEW
IMPLEMENTATION NOT AUTHORIZED
CUTOVER NOT AUTHORIZED
```

Revision C1 applied the twelve supervisor corrections of
`NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1-C1`. This section converts the
**accepted** functional specification of §9.1–§9.8 into an exact implementation
plan and does not modify it.

### 9.9.0 Measured facts this design rests on

| # | Fact (measured read-only 2026-07-31) | Consequence |
|---|---|---|
| F1 | `registrar_recebimento_ordem_compra(p_ordem_id, p_idempotency_key, p_recebido_em, p_documento_ref, p_origem_tipo, p_origem_ref, p_linhas)` and `estornar_recebimento_ordem_compra(p_ordem_id, p_idempotency_key, p_estornado_em, p_motivo, p_linhas)` already exist and are complete. | No new receipt writer. |
| F2 | `ordem_compra_fio_lancamentos` carries `ordem_compra_item_alocacao_id`, `op_id`, `material`, `cor_id`, `cor_poliester`, `kg_excesso`, `estorno_de_id`, signed `kg_recebido`. | Multi-origin lineage is structural. |
| F3 | Receipt distribution is **explicit operator allocation** (`destination ∈ {alocacao, excesso}`), guarded per allocation by `excede_alocacao`. | Mechanism selected, not invented. |
| F4 | `trg_native_lancamento_derive_state` sets `ordem_compra_item.kg_recebido = SUM(l.kg_recebido)` over **all** lines of the item, and routes `kg_excesso` separately into `saldo_fios` and `ordem_compra_fio_movimentos_estoque`. A surplus line therefore has `kg_recebido = kg_excesso = kg`; an allocation line has `kg_excesso = 0`. | The availability predicate must **select allocation-destined lines**, not subtract two columns (§9.9.A). |
| F5 | The db/75 cutover machine exists; `ordem_compra_c3c_pre_ponr_rollback` restores `maintenance_fenced` / `flat` and refuses once `productive_receipt_started_at` is set. **No function anywhere restores `legacy_active`.** | §9.9.G reclassifies "reversible" honestly and adds the missing operation. |
| F6 | `ordem_compra.aceite_exigido_na_emissao` exists; both live orders hold `false` / `nao_aplicavel`. | No backfill, no reclassification. |
| F7 | `public.op_eventos(op_id, tipo_evento, status_anterior, status_novo, observacao, payload, criado_por, criado_em)` already owns OP operational history. | Adjustment events go here, never to `ordem_compra_eventos`. |
| F8 | `alterar_status_op` reads `SELECT * INTO v_op FROM ops WHERE id = p_op_id` with **no `FOR UPDATE`**. | It must be corrected to join the lock protocol (§9.9.B). |
| F9 | `authenticated` holds **table-level UPDATE** on `public.pedidos` plus column UPDATE on every column including `status`. | A column REVOKE alone cannot contain direct DML (§9.9.L). |
| F10 | `public.expedicao_comandos(idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado)` exists, 0 rows. `expedicao_itens` carries `metros_liberados` and `metros_entregues`. | Named as the idempotency owner for §9.9.K. |
| F11 | `saldo_fios` = 5 rows / 2685.020 kg; `saldo_fios_op` = 0; ledger, flat corpus, receipts and movements all 0. | §9.9.H — closed by supervisor ruling **TD1**: preserved historical global stock, never productive OP availability. |

---

### 9.9.A Availability authority — origin-scope aware (C1)

**Two authorities, not one subtraction.** Availability depends on the *origin* of
the need, because cotton needs are OP-owned and polyester needs are Pedido-owned.

#### A.1 Exact ledger predicate for productive receipt

A ledger line is **productive** (allocation-destined) exactly when:

```sql
l.recebimento_id IS NOT NULL             -- a real receipt/reversal command line
AND l.ordem_compra_item_alocacao_id IS NOT NULL
AND l.kg_excesso = 0                     -- surplus lines carry kg_excesso <> 0
```

Productive net for a set of allocations is `SUM(l.kg_recebido)` over those lines.
Reversal rows need no special case: they carry `tipo='estorno'`, negative
`kg_recebido`, `kg_excesso = 0` when their source was allocation-destined, and are
therefore included with the correct sign.

**Surplus is selected separately and never enters an OP ceiling:**

```sql
surplus_net = SUM(l.kg_excesso) WHERE l.recebimento_id IS NOT NULL
```

reported as its own column and reconciled against
`ordem_compra_fio_movimentos_estoque`.

`SUM(kg_recebido - kg_excesso)` is **withdrawn**: it would be arithmetically equal
only while the invariant `kg_excesso ∈ {0, kg_recebido}` holds, and the design must
not depend on an invariant no constraint enforces.

#### A.2 OP-origin material (currently cotton)

For needs with `origem_tipo='op'` and `op_id = <target OP>`:

```
ceiling_op_origin(OP, material, colour)
  = productive_net over allocations whose necessidade_id resolves to a need with
    origem_tipo='op' AND op_id = OP
```

**Sibling OP reservations do not reduce this quantity**, even for the same colour —
the material is committed to that OP by its own need. Only the target OP's own
current reservation is returned before a replacement adjustment is validated,
which is achieved by validating the *replacement* payload against the raw ceiling
rather than against `ceiling − own_reservation`.

#### A.3 Pedido-origin shared material (currently polyester)

For needs with `origem_tipo='pedido'` and `op_id IS NULL`:

```
pool(Pedido, material, colour)
  = productive_net over allocations whose necessidade_id resolves to a need with
    origem_tipo='pedido' AND pedido_id = Pedido

ceiling_pedido_origin(OP, material, colour)
  = pool(Pedido, material, colour)
  − active_reservation_of_OTHER_OPs(Pedido, material, colour, exclude => OP)
```

No representative OP is created and the pool is never pre-split into per-OP
allocations.

#### A.4 The nine reported quantities

| Quantity | Source |
|---|---|
| required | `necessidade_compra_fio.kg_necessario` |
| planned | `SUM(necessidade_compra_planejamento.kg) WHERE gerado_em IS NULL` |
| purchased under active coverage | `SUM(ordem_compra_item_alocacao.kg_alocado)` where `public.oc_cobertura_ativa(ordem_id)` (db/100, reused) |
| net received (productive) | A.1 predicate |
| reversed | `-SUM(l.kg_recebido) WHERE l.tipo='estorno'`, reported only |
| surplus | A.1 surplus expression, reported only |
| allocated to OP | productive net restricted per A.2 / A.3 |
| reserved / committed-consumed | `oc_reserva_ativa`, split by OP status |
| available ceiling | A.2 or A.3 by origin |

**Reservation authority (D2):** `op_itens.metros_ajustados` where NOT NULL,
converted through `parametros_largura` keyed by `modelos.largura`.
`simulada`/`aberta` → *reserved*; `em_producao`/`pausada`/`concluida` →
*committed/consumed*; `cancelada` → nothing; `metros_pedidos` never reserves.
Measured physical consumption is not claimed.

#### A.5 Function security (explicit, not "RLS through SECURITY DEFINER")

| Object | Kind | Security | Grants | Authorization inside |
|---|---|---|---|---|
| `public._oc_disponibilidade_calc(p_op_id BIGINT)` | `STABLE`, **SECURITY DEFINER**, `SET search_path=''` | internal | `REVOKE ALL FROM PUBLIC, anon, authenticated, service_role` — **owner-only** | none needed; unreachable by clients |
| `public.oc_disponibilidade_op(p_op_id BIGINT)` | `STABLE`, **SECURITY INVOKER** | public entry | `REVOKE ALL FROM PUBLIC, anon, service_role`; `GRANT EXECUTE TO authenticated` | first statement: `IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE='42501'; END IF;` then calls the internal function |
| `public.oc_reserva_ativa(p_pedido_id UUID, p_excluir_op_id BIGINT)` | `STABLE`, SECURITY DEFINER | internal | owner-only | unreachable by clients |

SECURITY DEFINER is used **only** on owner-only internals that no client role can
execute. The single client-facing function is SECURITY INVOKER and performs an
explicit `is_admin()` check, so no row policy is bypassed on the caller's behalf.

**`vw_disponibilidade_op` exact shape.** A parameterized function cannot be a view
without either exposing every OP or leaking through a definer. The view is
therefore defined over the **base tables**, not over the function, and carries its
own row restriction:

```sql
CREATE VIEW public.vw_disponibilidade_op
WITH (security_invoker = true) AS
SELECT o.id AS op_id, d.material, d.cor_id, d.cor_poliester,
       d.kg_necessario, d.kg_planejado, d.kg_comprado_ativo,
       d.kg_recebido_produtivo, d.kg_estornado, d.kg_excedente,
       d.kg_alocado_op, d.kg_reservado_outras, d.kg_disponivel
  FROM public.ops o
  CROSS JOIN LATERAL public._oc_disponibilidade_linhas(o.id) d
 WHERE public.is_admin();
```

`security_invoker = true` (PG 15+; production is 17.6) makes the view honour the
caller's own policies on `ops`, and the trailing `WHERE public.is_admin()`
fail-closes for any non-admin. `_oc_disponibilidade_linhas` is the owner-only
set-returning internal; it is reachable only through this view and through the
guarded entry function.

---

### 9.9.B One concurrency domain — lock matrix by writer (C2)

Every writer that can **reduce or release productive availability** joins one
protocol. Global order: **`pedidos` → `ops` (ASC id) → `op_itens` (ASC id) →
`ordem_compra_item` (ASC id) → `ordem_compra_item_alocacao` (ASC id)**.
`SET LOCAL lock_timeout = '5s'` in every one.

| Writer | First lock | Subsequent locks | Ascending | Timeout | Conflict result |
|---|---|---|---|---|---|
| `salvar_ajuste_producao_op` (new) | `pedidos` row `FOR UPDATE` | `ops` of the Pedido, then `op_itens` of the target OP | yes | 5s | `concorrencia_ocupada`, zero writes |
| `iniciar_producao_op` (new, §9.9.D) | `pedidos` row `FOR UPDATE` | `ops` of the Pedido, then `op_itens` of the OP | yes | 5s | `concorrencia_ocupada`, zero writes |
| `estornar_recebimento_ordem_compra` (**modified**) | `pedidos` row of `ordem_compra.pedido_id` `FOR UPDATE` | `ops` of the Pedido, then `ordem_compra_item`, then the ledger source rows | yes | 5s | `concorrencia_ocupada`, zero writes |
| `registrar_recebimento_ordem_compra` (**modified**) | same as reversal | same | yes | 5s | same |
| `alterar_status_op` (**modified**, F8) | `pedidos` row of the OP's Pedido `FOR UPDATE` | the `ops` row `FOR UPDATE` | yes | 5s | `concorrencia_ocupada` |
| OP cancellation | via `alterar_status_op` | idem | yes | 5s | idem |
| Adjustment replacement / clearing | via `salvar_ajuste_producao_op` | idem | yes | 5s | idem |
| `alterar_status_pedido` / `_pedido_status_recalcular` (§9.9.L) | `pedidos` row `FOR UPDATE` | `ops` of the Pedido | yes | 5s | `concorrencia_ocupada` |
| `corrigir_entrega_expedicao` (§9.9.K) | `pedidos` row `FOR UPDATE` | `expedicoes`, then `expedicao_itens` ASC | yes | 5s | `concorrencia_ocupada` |
| `estornar_expedicao_tapete_parcial` (§9.9.K) | `pedidos` row `FOR UPDATE` | `expedicoes`, then `expedicao_itens` ASC | yes | 5s | `concorrencia_ocupada` |
| `cancelar_ordem_compra` / `excluir_ordem_compra` (db/100, **modified**) | `pedidos` row `FOR UPDATE` | `ordem_compra`, then allocations ASC | yes | 5s | `concorrencia_ocupada` |

The Pedido row is the serialization point wherever the shared polyester pool can be
touched. **Every writer named above appears in the manifest of §9.9.N** — the claim
and the manifest are consistent.

---

### 9.9.C Atomic production-adjustment RPC (C3)

```sql
public.salvar_ajuste_producao_op(
  p_op_id            BIGINT,
  p_base_ajuste_rev  INTEGER,
  p_itens            JSONB      -- absolute set [{op_item_id, metros_ajustados|null}]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
```

**Revision model — decided.** A **narrowly named adjustment revision**:
`ops.ajuste_revisao INTEGER NOT NULL DEFAULT 0`, owned **only** by
`salvar_ajuste_producao_op` and `iniciar_producao_op`. A general `ops.revisao`
is **rejected**, because unrelated writers (`alterar_status_op`, latex creation,
lote linking) would silently bypass it and produce false confidence.
`alterar_status_op` does **not** increment it; it takes the same locks, so it
cannot interleave dangerously.

**Ordered execution — locks precede revision acceptance:**

1. authorize (`auth.uid()` + `is_admin()`);
2. validate payload shape;
3. resolve the Pedido from the OP;
4. **acquire locks** (`pedidos` → `ops` ASC → `op_itens` ASC);
5. **reload** the OP row inside the lock;
6. validate current state (`simulada`|`aberta`);
7. validate `p_base_ajuste_rev` against the freshly reloaded value;
8. compute ceilings per §9.9.A (origin-aware);
9. validate the **complete** payload, every item, against its ceiling;
10. write `op_itens`, bump `ops.ajuste_revisao`, append one `public.op_eventos` row
    (`tipo_evento = 'ajuste_producao_salvo'`).

Full validation precedes any write, so the known non-atomic-`RETURN` hazard cannot
occur.

| Aspect | Contract |
|---|---|
| Grants | `REVOKE ALL FROM PUBLIC, anon, service_role`; `GRANT EXECUTE TO authenticated` |
| Tables written | `op_itens`, `ops.ajuste_revisao`, **`op_eventos`** — never `ordem_compra_eventos` |
| Transaction membership | IN: adjusted metres, `ajuste_revisao`, `op_eventos`. OUT: `saldo_fios`, `saldo_fios_op`, eligibility snapshot (derived on read). Reservation is derived, never persisted. |
| Errors | `sem_permissao`, `AJUSTE_PAYLOAD_INCOMPLETO`, `AJUSTE_OP_ESTADO_INVALIDO`, `AJUSTE_REVISAO_DESATUALIZADA`, `AJUSTE_EXCEDE_DISPONIVEL`, `concorrencia_ocupada` |
| Reload contract | On `AJUSTE_REVISAO_DESATUALIZADA` the screen offers explicit **Recarregar dados**; Save stays disabled until a fully successful reload |
| Both surfaces | OP screen and Pedido panel call this one RPC |

---

### 9.9.D Server-owned production start (C4)

```sql
public.iniciar_producao_op(
  p_op_id           BIGINT,
  p_base_ajuste_rev INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
```

Atomic sequence: authorize → locks in the global order → reload state and
`ajuste_revisao` → prove every `op_itens` row has `metros_ajustados IS NOT NULL` →
revalidate availability per §9.9.A (a receipt reversal may have lowered the ceiling
since the adjustment was saved) → **write the authoritative `saldo_fios_op` start
snapshot** (retained: it is the historical record of what was available at start,
and it has one writer only, this function) → transition the OP to `em_producao`
through the internal lifecycle helper `_op_status_aplicar` → recompute the Pedido
to `produzindo` through the internal helper `_pedido_status_recalcular`
(§9.9.L) → append `op_eventos` and `pedido_eventos` → return
`{ok, ajuste_revisao, proxima_acao:{rota, rotulo}}`.

`js/screens/op-recalculo.js::iniciarProducaoOP` and its
`snapshotSaldoEIniciarProducao` frontend sequence, plus the direct
`UPDATE ops SET status='em_producao'` at `op-recalculo.js:181`, are **deleted**;
the module becomes a thin client of this RPC.

---

### 9.9.E Supplier acceptance configuration (C5)

**Decided rule: the supplier column is the sole authority; the global singleton is
deterministically migrated and then retired from authority.**

1. `ALTER TABLE public.fornecedores ADD COLUMN exige_aceite BOOLEAN NOT NULL DEFAULT false;`
2. In the **same migration**, deterministically seed it from the current global
   value: `UPDATE public.fornecedores SET exige_aceite = (SELECT exige_aceite FROM public.ordem_compra_config WHERE id = 1);`
   — today that value is `false`, so all 6 rows receive `false`, asserted by the
   migration.
3. `public.ordem_compra_config.exige_aceite` becomes **read-only and
   non-authoritative**: a `BEFORE UPDATE` trigger raises
   `config_aceite_descontinuada`, and its column comment records the demotion. The
   column is **not dropped** in this release.
4. No "row predates the column" fallback exists or is referenced — `NOT NULL
   DEFAULT false` makes it impossible.

**Emission freeze:** `emitir_ordem_compra` copies `fornecedores.exige_aceite` into
`ordem_compra.aceite_exigido_na_emissao` and sets `status_aceite` accordingly.
**Live orders are asserted unchanged** (`false` / `nao_aplicavel`).

**Idempotency storage for acceptance commands:** a new
`public.ordem_compra_aceite_comandos`, shaped after the proven
`expedicao_comandos`:

```
id, idempotency_namespace TEXT NOT NULL CHECK (= 'oc_aceite_v1'),
ator_id UUID NOT NULL, idempotency_key TEXT NOT NULL,
ordem_compra_id BIGINT NOT NULL, decisao TEXT CHECK (decisao IN ('aceita','rejeitada')),
comando_payload JSONB NOT NULL, comando_hash TEXT NOT NULL, resultado JSONB NOT NULL,
criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (idempotency_namespace, ator_id, idempotency_key)
```

Duplicate call with the same key and identical payload returns the stored
`resultado`; same key with a different payload is refused as conflicting reuse.

---

### 9.9.F Receipt and reversal activation

No new receipt writer (F1). This release **activates** the existing ones and adds:
the acceptance guard (`recebimento_aceite_pendente` when
`aceite_exigido_na_emissao IS TRUE AND status_aceite <> 'aceita'`), and the lock
protocol of §9.9.B. `status_recebimento` stays derived (`net = 0 → nao_recebido`;
`0 < net < total → parcial`; `net = total → recebido`). No status is ever edited
directly. **No receipt is fabricated against real orders**; all proofs run on the
disposable cluster.

---

### 9.9.G Cutover, honest rollback, and the safe deployment sequence (C6)

**Correction.** `ordem_compra_c3c_pre_ponr_rollback` restores
`maintenance_fenced` / `flat`. That is **not** an operational rollback: the fence
keeps business writes blocked. **No existing function restores `legacy_active`**
(F5). The previous claim that steps 1–8 are "fully reversible" is **withdrawn**.

**Missing operation, proposed:** `public.ordem_compra_c3c_resume_legacy(p_generation BIGINT)`
— `postgres`-only, advisory-lock gated, `UPDATE ordem_compra_cutover SET status='legacy_active', read_authority='flat', cutover_generation=NULL, canonical_activated_at=NULL WHERE id=1 AND status='maintenance_fenced' AND productive_receipt_started_at IS NULL`, raising `forward_recovery_only` otherwise. Only with this
operation is service restoration before PONR real.

| State | Reversible? |
|---|---|
| Steps 1–7 (fence → canonical read → final ACL) | reversible via `pre_ponr_rollback` **then** `resume_legacy` |
| Step 8 (`activate`) | reversible the same way while `productive_receipt_started_at IS NULL` |
| **First productive receipt = PONR** | **irreversible; forward recovery only** |

**Safe deployment sequence (prepare → deploy → prove → close → activate).**
The old UI must not break between migration and asset publication, so **no
authority is narrowed before its new caller is live**:

| Phase | Action | Old UI still works? |
|---|---|---|
| P1 | Apply additive server objects only (availability functions, `ajuste_revisao`, new RPCs, new tables, supplier column). **No grant is revoked. No existing writer's behaviour changes.** | yes — nothing it uses changed |
| P2 | Deploy the new assets. New callers use the new RPCs; server-side gates stay inactive; `acoes.receber` still returns `recebimento_canonico_inativo`. | yes |
| P3 | Authenticated proof of every new caller in the safe environment. | yes |
| P4 | Apply the **containment** migration: narrow `pedidos` UPDATE (§9.9.L), install the direct-DML fence, retire the flat consumers' code paths, demote `ordem_compra_config`. | **only the new UI runs — and it is already proved in P3** |
| P5 | Run the cutover (fence → … → activate) under the coordinated boundary. | maintenance window |
| P6 | First productive receipt = PONR. | native |

No dual write and no flat bridge at any phase.

---

### 9.9.H Historical stock — CLOSED by supervisor ruling TD1

> **TD1 — BINDING SUPERVISOR RULING.**
> The existing `saldo_fios` balance of 2685.020 kg is
> **PRESERVED HISTORICAL GLOBAL STOCK — NOT PRODUCTIVE OP AVAILABILITY.**
> This ruling **closes** the historical-stock product decision for this design.

**Binding consequences, each with its exact technical effect:**

| # | TD1 consequence | Technical effect in this design |
|---|---|---|
| 1 | Preserve all five existing rows unchanged | No migration, writer or backfill touches `public.saldo_fios`. The five rows are asserted unchanged in the db/101 and cutover invariants. |
| 2 | Capture them verbatim in the cutover inventory baseline | `ordem_compra_c3c_fence_and_snapshot` copies them into `ordem_compra_cutover_inventory_baseline` and hashes them into `inventory_baseline_hash` (§9.9.G step 1). |
| 3 | No retroactive assignment to a Pedido, need, allocation or OP | No `necessidade_compra_fio`, `ordem_compra_item_alocacao` or ledger row is created from them. |
| 4 | Excluded from every OP production ceiling | The §9.9.A predicate reaches only `ordem_compra_fio_lancamentos`; `saldo_fios` is not a term in `ceiling_op_origin` or `ceiling_pedido_origin`. |
| 5 | Excluded from the native received-material pool | The productive predicate requires `recebimento_id IS NOT NULL AND ordem_compra_item_alocacao_id IS NOT NULL AND kg_excesso = 0`. A `saldo_fios` row satisfies none of these — it is not a ledger row at all. |
| 6 | Kept visible as historical/global stock | `saldo_fios` remains readable on the stock surfaces and is reported in §9.9.A as its own column, never merged into availability. |
| 7 | Productive OP availability only from native ledger lines with valid allocation lineage | Exactly the §9.9.A.1 predicate. No other source can raise a ceiling. |
| 8 | No automatic or silent allocation mechanism | None is designed, and none may be added under this release. |
| 9 | Any future audited allocation is separately authorized work | Recorded here as **outside the current coordinated release**; it needs its own order naming the mechanism, its audit trail and its acceptance evidence. |

**Accepted operational consequence.** The first productive ceilings after cutover
**may begin at zero** until native receipts are registered. This is expected
behaviour under TD1, not a defect: an OP becomes productive when material is
received against its allocation, not because global stock exists.

The five rows remain not reconstructable (ledger and flat corpus empty) and not
removable; they are an immutable preserved opening balance.

---

### 9.9.I Multi-origin native receipt

Explicit operator allocation (F3). Per-allocation guard `excede_alocacao`;
item-level aggregate guard; duplicated receipt structurally impossible (scoped
unique idempotency plus `UNIQUE` ledger `idempotency_key`); shared-polyester
lineage preserved by keeping Pedido-origin allocations Pedido-level; all
quantities `NUMERIC(12,3)` with **no server-side rounding**, therefore no residual;
reversal deterministic LIFO with `estorno_de_id`, never driving a source line
negative.

---

### 9.9.J Finishing OP — transaction and replay identity (C7)

**No autonomous transaction is used anywhere.** Exact structure:

```
BEGIN (outer, the delivery writer)
  INSERT entregas; INSERT entrega_itens;          -- persisted
  <inner PL/pgSQL BEGIN ... EXCEPTION WHEN OTHERS>
      attempt finishing-OP creation                -- own subtransaction
  EXCEPTION WHEN OTHERS THEN
      capture SQLSTATE/MESSAGE;                    -- inner subtransaction rolled back
  END;
  INSERT op_acabamento_tentativas (sucesso | falha, with the captured code);
COMMIT                                             -- delivery + evidence commit together
```

Outcome: on failure the finishing OP does not exist, the **delivery survives**, and
the failure row commits with it. On success both commit.

**Replay-stable `split_seq`.** `MAX(split_seq)+1` is **rejected** as
non-deterministic under replay. Instead a command table
`public.op_acabamento_comandos` (same shape as `expedicao_comandos`,
`idempotency_namespace='op_acabamento_v1'`, `UNIQUE (idempotency_namespace, ator_id, idempotency_key)`)
persists the split identity, and `split_seq` is assigned **once**, inside a
`FOR UPDATE` lock on the `entregas` row, as the next value for that delivery, and
**stored in the command row**. A replay of the same idempotency key returns the
stored `split_seq` and creates nothing.

| Object | Contract |
|---|---|
| `ops.origem_entrega_id BIGINT REFERENCES entregas(id)`, `ops.split_seq SMALLINT NOT NULL DEFAULT 0` | server-owned; never client-supplied |
| `CREATE UNIQUE INDEX ops_acabamento_origem_uidx ON public.ops(origem_entrega_id, split_seq) WHERE tipo IN ('latex','acabamento') AND origem_entrega_id IS NOT NULL` | a second attempt collides and returns the existing OP |
| `public.gerar_op_acabamento(p_entrega_id BIGINT, p_idempotency_key TEXT, p_motivo TEXT DEFAULT NULL)` | the single canonical writer; normal path passes no motive |
| Existing `gerar_op_latex_split(BIGINT, TEXT)` | **retained with its exact signature** as a compatibility wrapper delegating to the new writer with a derived idempotency key; not dropped in this release |
| `public.pode_recuperar_op_acabamento(p_entrega_id BIGINT)` | true only when delivery committed **and** no canonical OP for the identity **and** a `falha` attempt row exists |
| Recovery surface | calls the **same** canonical writer; no free-form manual creation |
| `public.op_acabamento_tentativas` | `origem_entrega_id, split_seq, resultado ('sucesso'|'falha'), codigo_falha, mensagem, ator_id, processo, tentativa_seq, op_id, ocorrido_em`; append-only; admin SELECT |

---

### 9.9.K Expedition reversal and delivery correction — exact contracts (C10)

**Shared internal primitive:** `public._expedicao_estorno_aplicar(p_expedicao_id, p_linhas, p_motivo, p_rota)` — owner-only, carries the invariants for both routes.

```sql
public.estornar_expedicao_tapete_parcial(
  p_expedicao_id BIGINT, p_itens JSONB, p_motivo TEXT, p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
```

| Aspect | Contract |
|---|---|
| Internal primitive | `_expedicao_estorno_aplicar` |
| Command/idempotency table | **`public.expedicao_comandos`** (existing, F10), `idempotency_namespace='expedicao_estorno_tapete_v1'`, unique `(idempotency_namespace, ator_id, idempotency_key)` |
| Duplicate call | same key + identical payload → returns the stored `resultado`, writes nothing; conflicting payload → `comando_conflitante` |
| Event | one `op_eventos` row per affected OP plus the `expedicao_comandos.resultado` record |
| Released guard | `metros > expedicao_itens.metros_liberados` → `ESTORNO_ACIMA_DO_LIBERADO` |
| Delivered guard | `metros_liberados - metros < metros_entregues` → `ESTORNO_ABAIXO_DO_ENTREGUE` |
| Measured-output source | the finishing OP's measured output for that `op_item_id`; finished availability = **measured output − `SUM(expedicao_itens.metros_liberados)` currently released**. No standalone stock balance is edited. |
| Locks | §9.9.B row |

```sql
public.corrigir_entrega_expedicao(
  p_expedicao_id BIGINT, p_itens JSONB, p_motivo TEXT, p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
```

| Aspect | Contract |
|---|---|
| Correction/event table | `public.expedicao_comandos` with `idempotency_namespace='expedicao_entrega_correcao_v1'`; the prior per-item `metros_entregues` is stored in `comando_payload` so history is preserved |
| Delivered total projection | `expedicao_itens.metros_entregues` remains the projection, rewritten by this writer only, then the Pedido completion condition is recomputed from the full item set |
| Idempotency scope | `(idempotency_namespace, ator_id, idempotency_key)` |
| Duplicate / conflicting | identical payload → stored result; different payload → `comando_conflitante` |
| Guards | `< 0` or `> metros_liberados` → `CORRECAO_QUANTIDADE_INVALIDA` |
| Pedido recomputation | via `_pedido_status_recalcular` (D1): cancelled stays cancelled; complete → `entregue`; incomplete non-cancelled → `produzindo`; never `confirmado` |
| Lock order | identical to the reversal writer and to cancellation, so the three serialize on the same `pedidos` row |

---

### 9.9.L Pedido status — public/internal separation and DML containment (C8)

**Two functions, not one.**

```sql
-- PUBLIC: operator-requested transitions only
public.alterar_status_pedido(p_pedido_id UUID, p_novo_status TEXT,
                             p_base_revisao INTEGER, p_motivo TEXT DEFAULT NULL)
  -- accepts ONLY: rascunho→recebido, recebido→confirmado,
  --               and cancellation through the D7 gate
  -- SECURITY INVOKER; REVOKE ALL FROM PUBLIC, anon, service_role;
  -- GRANT EXECUTE TO authenticated; internal is_admin() check
```

```sql
-- INTERNAL: derived transitions only
public._pedido_status_recalcular(p_pedido_id UUID, p_causa TEXT)
  -- owns confirmado→produzindo (production start),
  --      produzindo→entregue (complete delivery),
  --      entregue→produzindo (D1 correction)
  -- SECURITY DEFINER; REVOKE ALL FROM PUBLIC, anon, authenticated, service_role
  -- => NOT executable by authenticated. Called only by iniciar_producao_op,
  --    registrar_entrega_expedicao and corrigir_entrega_expedicao.
```

An authenticated client therefore **cannot** invoke a derived transition.

**Direct-DML containment — grant matrix (F9).** A column REVOKE is insufficient
while the table-level UPDATE grant exists, so both are applied:

```sql
REVOKE UPDATE ON TABLE public.pedidos FROM authenticated, anon;
GRANT  UPDATE (cliente_id, data_pedido, prazo_entrega, observacao,
               referencia_cliente, tipo_recebimento, metros_total,
               parcial_habilitado, parcial_atualizado_em, atualizado_em)
       ON TABLE public.pedidos TO authenticated;
-- status, revisao, prioridade_*, status_cliente_* deliberately excluded
```

plus a **fail-closed fence**: `BEFORE UPDATE ON public.pedidos` raising
`pedido_status_writer_required` when `NEW.status IS DISTINCT FROM OLD.status` and
the session is not inside an authorized writer (signalled by a transaction-local
custom GUC set by the two functions above). Grants alone are not trusted.

`js/screens/pedido-detail-events.js::alterarStatus()` is repointed to
`alterar_status_pedido`. **`pedidos.produzindo` is not retired; no writer is added
for `ops.finalizada`.**

---

### 9.9.M D7 cancellation compensation — defined now, not deferred (C9)

`public.cancelar_pedido(p_pedido_id UUID, p_base_revisao INTEGER, p_motivo TEXT)`
executes **one transaction** in this deterministic order:

| Step | Entity | Action | History |
|---|---|---|---|
| 1 | eligibility | `pedido_elegivel_cancelamento` must return `elegivel` | — |
| 2 | locks | `pedidos` → `ops` ASC → `ordem_compra` ASC | — |
| 3 | active OPs (`simulada`,`aberta`,`em_producao`,`pausada`) | **cancelled** through `_op_status_aplicar` | `op_eventos` per OP |
| 4 | their reservations | **released implicitly** — cancelled OPs contribute nothing to `oc_reserva_ativa` (§9.9.A). No row is deleted. | — |
| 5 | saved adjustments | **preserved verbatim** in `op_itens.metros_ajustados`; they simply stop reserving | — |
| 6 | live planning (`gerado_em IS NULL`) | **released** — planning rows deleted by the existing db/99 release semantics so the need returns to free balance | planning event |
| 7 | `rascunho` Purchase Orders | **cancelled** via `cancelar_ordem_compra` (db/100), which releases coverage | `ordem_compra_eventos` |
| 8 | `emitida` Purchase Orders | **cancelled** via the same writer; the document, its number, items and provenance are preserved | idem |
| 9 | accepted Purchase Orders (`status_aceite='aceita'`) | **cancelled as well** — acceptance does not bar cancellation (db/100 ruled acceptance semantics are not a cancellation rule); recorded with the acceptance history intact | idem |
| 10 | existing receipts | **untouched**. Received material stays received; its ledger is append-only. Coverage release does not un-receive anything. | — |
| 11 | expedition and delivery facts | **untouched and preserved** | — |
| 12 | Pedido | `cancelado` via `_pedido_status_recalcular` | `pedido_eventos` |

**Writers blocked after cancellation:** `salvar_ajuste_producao_op`,
`iniciar_producao_op`, OP creation, planning assignment, Purchase Order
generation, emission, and receipt registration for that Pedido — each returns
`PEDIDO_CANCELADO`.

**`pedido_elegivel_cancelamento(p_pedido_id)`** returns
`{elegivel: boolean, codigo: TEXT}`:

| Condition | `codigo` |
|---|---|
| status ∈ {rascunho, recebido, confirmado, produzindo} and none below | `elegivel` |
| status = `entregue` | `PEDIDO_CANCELAMENTO_APOS_ENTREGA` (correct the delivery under D1 first) |
| status = `cancelado` | `PEDIDO_JA_CANCELADO` |
| any expedition with `metros_entregues > 0` | `PEDIDO_COM_ENTREGA_REGISTRADA` |
| a pending client change request | `PEDIDO_COM_SOLICITACAO_PENDENTE` |
| a pending priority review (db/91) | `ADMIN_REVIEW_REQUIRED` |

---

### 9.9.N Exact implementation manifest (C11)

**Block 1 — receipt → production continuity (indivisible)**

| # | Path | New/Mod | Purpose | Owner | Tests | Phase |
|---|---|---|---|---|---|---|
| 1 | `db/101_disponibilidade_nativa.sql` | new | `_oc_disponibilidade_calc`, `_oc_disponibilidade_linhas`, `oc_reserva_ativa`, `oc_disponibilidade_op`, `vw_disponibilidade_op`, grants | A | `tests/db101-disponibilidade-origem.integration.sql` | P1 |
| 2 | `db/102_ajuste_atomico_e_inicio_producao.sql` | new | `ops.ajuste_revisao`, `salvar_ajuste_producao_op`, `iniciar_producao_op`, `_op_status_aplicar`, **`alterar_status_op` lock correction** | B, C, D | `tests/db102-ajuste-concorrencia.integration.sql` | P1 |
| 3 | `db/103_fila_fornecedor_e_aceite.sql` | new | `fornecedores.exige_aceite` + deterministic seed, `ordem_compra_config` demotion trigger, `ordem_compra_aceite_comandos`, accept/reject RPCs, queue, emission freeze | E | `tests/db103-aceite.integration.sql` | P1 |
| 4 | `db/104_recebimento_lock_e_aceite_gate.sql` | new | lock protocol added to `registrar_recebimento_ordem_compra` and `estornar_recebimento_ordem_compra`; acceptance gate; `cancelar_ordem_compra`/`excluir_ordem_compra` lock alignment | B, F | `tests/db104-recebimento-lock.integration.sql` | P1 |
| 5 | `db/105_status_pedido_e_cancelamento.sql` | new | `alterar_status_pedido`, `_pedido_status_recalcular`, `cancelar_pedido`, `pedido_elegivel_cancelamento` | L, M | `tests/db105-status-cancelamento.integration.sql` | P1 |
| 6 | `js/screens/op-recalculo.js` | mod | delete the per-row loop **and** `snapshotSaldoEIniciarProducao`; call `salvar_ajuste_producao_op` and `iniciar_producao_op`; `maxMetrosItem` reads `vw_disponibilidade_op` | A–D | `tests/op-ajuste-atomico.smoke.js` | P2 |
| 7 | `js/screens/op-distribuicao-ui.js` | mod | consume the native projection; revision-conflict reload; start button calls the RPC | C, D | same | P2 |
| 8 | `js/screens/op-nova.js` | mod | **REPOINT** `:1287`,`:1293` to the native projection | A | `tests/op-nova-nativo.smoke.js` | P2 |
| 9 | `js/screens/op-persistir.js` | mod | **REPOINT**: delete the legacy flat branch `:330-338`; native sync only | A | `tests/op-persistir-nativo.smoke.js` | P2 |
| 10 | `js/screens/fornecedor.js` | mod | **REPOINT** `:472`,`:539` to the native supplier queue | E | `tests/fornecedor-queue.smoke.js` | P2 |
| 11 | `js/screens/pedido-detail-data.js` | mod | **REPOINT**: remove the flat fallback `:397-407` | A | `tests/pedido-detail-nativo.smoke.js` | P2 |
| 12 | `js/screens/op-writes.js` | mod | **RETIRE** `window.atribuirFornecedorFioOp` and its two flat writes `:93`,`:122` — it has no caller (closes DEBT-1). Decision is RETIRE, not "retire or repoint". | A | `tests/op-writes-retirado.smoke.js` | P2 |
| 13 | `js/calculo-op.js` | mod | **REPOINT**: `montarOrdensCompraFio` is renamed `montarNecessidadesCompra` and stops emitting flat payloads; the recipe maths is unchanged. §6.1 row updated accordingly. | A | `tests/calculo-op-nativo.smoke.js` | P2 |
| 14 | `js/delete-helpers.js` | mod | **REPOINT** `:82` to cover native tables | A | `tests/delete-nativo.smoke.js` | P2 |
| 15 | `js/supabase-client.js` | mod | allowlist every new RPC `:64`,`:96` | all | existing guard | P2 |
| 16 | `js/screens/ordem-compra-receipt-events.js` | mod | post-receipt **Revisar produção** continuation | — | `tests/pos-recebimento-navegacao.smoke.js` | P2 |
| 17 | `js/screens/pedido-producao-panel.js` | **new** | consolidated multi-OP panel `#/pedidos/<id>/producao` | — | `tests/pedido-producao-panel.smoke.js` | P2 |
| 18 | `js/router.js` | mod | register the route | — | same | P2 |
| 19 | `index.html` | mod | mount the new asset + `?v=` token | — | cache-token guards | P2 |
| 20 | `js/screens/pedido-detail-events.js` | mod | `alterarStatus()` → `alterar_status_pedido`; cancellation → `cancelar_pedido` | L, M | `tests/pedido-status-canonico.smoke.js` | P2 |
| 21 | `db/106_contencao_dml_pedido.sql` | new | narrow `pedidos` UPDATE grant; install the status fence trigger | L | `tests/db106-contencao.integration.sql` | **P4** |
| 22 | cutover runbook (documentation) | new | fence → … → activate, plus `ordem_compra_c3c_resume_legacy`; **TD1: assert the five `saldo_fios` rows captured verbatim into the inventory baseline and unchanged afterwards** | G, H | rehearsal | P5 |
| 23 | `db/107_cutover_resume_legacy.sql` | new | the missing `ordem_compra_c3c_resume_legacy` operation | G | `tests/db107-resume-legacy.integration.sql` | P1 |

**Block 2 — finishing continuity**

| # | Path | New/Mod | Purpose | Owner |
|---|---|---|---|---|
| 24 | `db/108_acabamento_idempotente.sql` | new | `ops.origem_entrega_id/split_seq` + unique index, `op_acabamento_comandos`, `op_acabamento_tentativas`, `gerar_op_acabamento`, `pode_recuperar_op_acabamento`, `gerar_op_latex_split` wrapper | J |
| 25 | `js/screens/entrega-writes.js` | mod | transactional delivery + finishing creation; delete the best-effort path | J |
| 26 | `js/screens/entrega-form.js` | mod | proved-failure recovery surface | J |

**Block 3 — reversal symmetry**

| # | Path | New/Mod | Purpose | Owner |
|---|---|---|---|---|
| 27 | `db/109_estorno_tapete_e_correcao_entrega.sql` | new | `_expedicao_estorno_aplicar`, `estornar_expedicao_tapete_parcial`, `corrigir_entrega_expedicao` | K |
| 28 | `js/screens/expedicao-admin.js` | mod | both surfaces | K |

**Block 4 — legacy retirement (separate authorization, post-acceptance)**

| # | Path | Purpose |
|---|---|---|
| 29 | `db/110_retirada_modelo_plano.sql` | drop flat objects and the `listar_ordens_compra_fio_compat` adapter |
| 30 | `js/screens/ordem-compra-receipt-cutover.js` | **RETIRE** the compat adapter after the cutover |

Every §6.1 flat consumer now has an exact RETIRE or REPOINT decision. No entry
says "or", "later decide" or "reuse where possible".

### 9.9.O Migration topology

Ten migrations, db/101–db/110, each `BEGIN/COMMIT`, each re-appliable as a
byte-identical no-op, each declaring grants explicitly (never relying on the
authenticated-by-default trap). db/101–105, 107, 108, 109 are **additive and
reversible** and land in P1. **db/106 is the only authority-narrowing migration
and lands in P4, after P3 proves the new callers.** db/110 is post-acceptance.
The PONR is outside every migration (§9.9.G).

### 9.9.P Recovery matrix

| Case | Detection | Persisted state | User-visible | Action | Writes blocked | Evidence to resume |
|---|---|---|---|---|---|---|
| Before P1 | not applied | unchanged | unchanged | none | no | — |
| During P1 | migration aborts | rolled back | unchanged | fix, re-apply | no | clean disposable apply |
| During P2 (assets) | smoke/console | DB ahead, additive | old UI still valid | redeploy previous assets | no | asset sha256 |
| During P3 (proof fails) | authenticated scenario fails | additive only | old UI valid | fix, redeploy; **do not enter P4** | no | scenario evidence |
| During P4 (containment) | migration aborts or UI errors | grants may be narrowed | new UI only | re-apply db/106 rollback block restoring the prior grant | status writes only | grant matrix diff |
| During reconciliation | `assert_import_reconciled` raises | `maintenance_fenced` | maintenance | `pre_ponr_rollback` **then** `resume_legacy` | yes (fence) | reconciliation deltas |
| Immediately before PONR | preflight fails | `canonical_active`, no receipt | receipt offered | `pre_ponr_rollback` + `resume_legacy` | no | fingerprints + backup |
| During PONR | receipt RPC error | header may exist | in-modal code | idempotent retry, same key | no | ledger vs header |
| After PONR | any | native | native | **forward only** | no | forward runbook |
| Stale frontend asset | ETag/console | DB native, UI old | wrong ceiling | hard reload (assets answer `must-revalidate` + ETag) | no | measured headers |
| PostgREST cache stale | `PGRST202` | fine | RPC missing | schema reload; verify by contrast | no | contrast probe |
| Supplier acceptance race | `comando_conflitante` / `ACEITE_JA_DECIDIDO` | first decision | honest refusal | none | no | command row |
| Concurrent OP adjustments | `AJUSTE_REVISAO_DESATUALIZADA` / `concorrencia_ocupada` | winner only | explicit reload | operator reload | loser writes nothing | revision + availability |
| Partial receipt failure | `{ok:false}` | none | in-modal code | correct and retry | no | ledger unchanged |
| Reversal failure | `{ok:false}` | none | in-modal code | retry | no | ledger unchanged |
| Production-start failure | `{ok:false}` | none | in-modal code | reload, retry | no | `ajuste_revisao` unchanged |
| Finishing-OP creation failure | `op_acabamento_tentativas.resultado='falha'` | delivery kept, no OP | honest state + gated retry | same idempotent writer | no | failure row |
| Tapete reversal failure | guard code | none | in-modal code | correct quantities | no | released/delivered totals |
| Delivery-correction failure | guard code | none | in-modal code | correct quantities | no | delivered totals |
| Pedido cancellation partial failure | transaction aborts | nothing applied | in-modal code | retry | no | all twelve steps atomic |
| Historical stock altered during cutover (TD1 violation) | baseline hash mismatch against `saldo_fios` | fence held | maintenance | `pre_ponr_rollback` + `resume_legacy`; investigate before retry | yes (fence) | the five rows re-measured against `inventory_baseline_hash` |

### 9.9.Q Authenticated acceptance plan

**Static:** grants verified with `has_function_privilege` for `anon`,
`authenticated`, `service_role` on every new function; the `pedidos` table/column
grant matrix asserted; `_pedido_status_recalcular` proved **not** executable by
`authenticated`; zero active flat consumers; no dual write; RLS on new tables;
terminal migration identity; asset tokens.

**Disposable cluster:** clean apply and no-op re-apply of db/101–109; origin-scope
availability proofs (sibling cotton does **not** reduce a peer's ceiling; shared
polyester does); **TD1 proof: a non-zero `saldo_fios` row raises no OP ceiling
and appears in no productive-receipt total**; two-session shared-polyester adjustment with
`deadlock_40P01 = false`; lock-order proof across adjustment, receipt reversal, OP
cancellation and delivery correction; stale-revision refusal; partial receipt then
partial reversal; multi-origin allocation; production start atomicity; finishing
failure and gated retry with a replayed idempotency key returning the same
`split_seq`; Tapete reversal guards; delivery correction returning `produzindo`;
full cancellation compensation; cutover rehearsal with `pre_ponr_rollback` **and**
`resume_legacy`; post-PONR forward recovery.

**Production preflight, read-only:** cluster identity; terminal migration; row
counts; the two OC fingerprints; **no receipt fabrication**; the five `saldo_fios`
rows re-measured and asserted **unchanged** under TD1 (§9.9.H) and proved absent
from every OP ceiling; cutover state; backup and restore-rehearsal evidence (LR-12).

**Authenticated scenarios:** each must end in a *reachable next action* — emitted
OC eligibility; supplier queue when acceptance is required; partial receipt;
receipt reversal; availability reload; one-OP post-receipt navigation; multi-OP
panel; atomic slider save (all or none); start production; Tapete finishing path;
Manta direct route; both expedition reversals; delivery correction returning the
Pedido to `produzindo`; Pedido and OP cancellation gates; customer tracking.

### 9.9.R Remaining blockers

**LR-12 is the only genuine blocker.**

1. **LR-12 — no fresh verified production backup exists.** It is a hard **entry
   criterion for cutover execution**: the cutover may not be run until a fresh
   backup exists and its restore rehearsal passes. Closing it needs
   architect-supplied credentials for one gated read-only export, a repaired local
   cluster for the rehearsal, or an explicit ruling that a named alternative
   artifact satisfies the precondition.

**LR-12 does not block acceptance of this technical design.** It is an execution
prerequisite, not a design gap: the design is complete and reviewable as it
stands, and LR-12 is discharged immediately before the cutover run of phase P5
(§9.9.G). **This section may therefore be accepted while LR-12 remains open**,
provided no cutover is executed until it is discharged.

The historical-stock question is **no longer a blocker**: supervisor ruling **TD1**
closed it (§9.9.H). No other unresolved alternative remains in this section.

```
PROPOSED / AWAITING SUPERVISOR REVIEW
IMPLEMENTATION NOT AUTHORIZED
CUTOVER NOT AUTHORIZED
```

---

## 10. Real-data protection

Permanent, binding for every order in this scope:

1. **`OC-001-3-26` must be preserved** (4 items, 3.769,800 kg).
2. **`OC-001-4-26` must be preserved** (2 items, 1.761,300 kg).
3. **Existing Pedidos must be preserved.**
4. **Existing OPs must be preserved.**
5. **Existing planning and allocation rows must be preserved.**
6. **No silent backfill.**
7. **No cancellation, recreation or renumbering** of any existing document.
8. **Receipt events are entered by the user, not fabricated by smoke tests.**

A validation that would require fabricating a receipt, a Purchase Order, a
Pedido, an OP or a balance is a hard stop, not a test fixture.

### 10.1 Current read-only state of the two protected Purchase Orders

Measured directly against production `ucrjtfswnfdlxwtmxnoo` on **2026-07-31**
under `PEDIDO-LIFECYCLE-RECOVERY-CANONICAL-STATE-CORRECTION-R1`, with identity
proved by cluster `system_identifier` 7642734024280108049 on PostgreSQL 17.6.
This is the **current** state; it does not replace the historical preflight
measurement preserved in 13.6.

| Code | `status_administrativo` | `emitida_em` | `status_recebimento` | `status_aceite` | `legado` | Items |
|---|---|---|---|---|---|---|
| `OC-001-3-26` | `emitida` | set | `nao_recebido` | `nao_aplicavel` | `false` | 4 |
| `OC-001-4-26` | `emitida` | set | `nao_recebido` | `nao_aplicavel` | `false` | 2 |

**Drift against 13.6, stated not inferred:** both orders were `rascunho` at the
db/100 preflight and are `emitida` now. The operator emitted them after that
preflight.

**Emission is not receipt and not acceptance.** `status_recebimento` is
`nao_recebido` on both and `ordem_compra_fio_lancamentos` holds **0 rows**, so no
receipt has occurred. `status_aceite` is `nao_aplicavel` on both, which reflects
`exige_aceite = FALSE` and is not evidence of a supplier acceptance decision.
Neither state may be derived from `status_administrativo`.

**Operational significance for this recovery:** both protected orders are now
sitting at exactly the point where the chain breaks (section 3.2). They are
emitted, they consume active purchasing coverage, and their receipt is refused by
`recebimento_canonico_inativo` (LR-01). This is the live instance of the defect,
not a hypothetical one.

---

## 11. Acceptance model

Migrations, tests, hashes, commits, pushes and deployments are **necessary but
insufficient**. They prove that code exists and ran; they do not prove that the
product works.

Every implementation boundary in this scope must prove the full chain:

```
user action
  -> authoritative writer
  -> persisted state
  -> reload
  -> visible result
  -> reachable next action
  -> reversal or recovery
```

A boundary that cannot demonstrate a **reachable next action** after the reload is
not accepted, regardless of test results.

### 11.1 Mandatory authenticated scenarios (current, from the accepted R2 direction)

As an authenticated administrator against the real application:

1. Plan a purchase on a real Pedido, generate a native Purchase Order, and emit it.
2. **Register its receipt**, reload, and see the arrived material in availability.
3. **Reverse that receipt**, reload, and see availability return to its prior value.
4. Move the **production slider** against the arrived material and reload; every
   item persisted or none.
5. **Start production** on the weaving OP and confirm the next action is reachable.
6. Record a weaving delivery and confirm the **finishing/latex OP is created**, or
   that a real manual recovery surface exists when it is not.
7. Carry a **Tapete** Pedido through expedition and delivery, and reverse each step.
8. Carry a **Manta** Pedido through its direct route (no acabamento) to delivery.
9. Confirm the **client tracking position and partials** reflect each step.
10. Cancel and correct at each stage and confirm the recorded reversal behaviour.

Any scenario that cannot be exercised must be reported as
`AUTHENTICATED_SMOKE_NOT_AVAILABLE` with the exact step, never silently omitted.

---

## 12. Decision ledger

| # | Date | Order | Decision | Evidence | Status | Consequence | Supersedes |
|---|---|---|---|---|---|---|---|
| D1 | (pre-db/77) | ORDEM_COMPRA Phase-C contract | Receipt must precede emission in the native model (receipt-before-emission invariant). | `docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md` §R.22.5 | SUPERSEDED IN PRACTICE BY D2 | The native model was specified as receipt-first. | — |
| D2 | 2026-07 (db/77) | PHASE-C5A-DB-EMISSION-READINESS | Grant `EXECUTE` on `emitir_ordem_compra` to `authenticated` and derive `pode_emitir` from distribution completeness + `exige_aceite = FALSE`. | `db/77_...sql:11,67-69,128-130` | ACCEPTED AT THE TIME / **IDENTIFIED AS THE GATE BYPASS** | Emission became reachable while receipt stayed inactive. | D1 in practice |
| D3 | 2026-07-30 (db/99) | PURCHASE-PLANNING-REFOUNDATION-R1 | Purchase planning becomes a first-class entity and **new purchase creation moves to the native model**. | `db/99_planejamento_compra_refoundation.sql`; production `supabase_migrations` 20260730190104 | ACCEPTED / APPLIED IN PRODUCTION | Flat rows stopped being created; flat readers went blind. | — |
| D4 | 2026-07-31 (db/100) | PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 | Subordinate `acoes.receber` to `ordem_compra_cutover`, fail-closed, returning `recebimento_canonico_inativo`. Do **not** activate the cutover; do **not** weaken the db/75/db/76 writer fence. | `db/100_...sql:789-845,940,2065-2068` | IMPLEMENTED / AWAITING SUPERVISOR REVIEW | The refusal became honest; the continuation was not restored. | — |
| D5 | 2026-07-31 | PEDIDO-DERIVED-LIFECYCLE-GRAPH-COMPLETION-R2 | The R2 lifecycle diagnosis is **ACCEPTED** as the current-state baseline at HEAD `97d461e`. | This document, sections 3–6 | ACCEPTED | Sections 3–6 are fixed inputs, not to be re-derived. | — |
| D6 | 2026-07-31 | Supervisor ruling | `pedidos.produzindo` is not retired; it stays contractually valid; db/91 depends on it; a canonical server-owned transition must be designed; direct frontend `UPDATE` authority is rejected. | Section 7.1; `db/91_...sql:621-622` | BINDING | LR-08 becomes a design obligation, not a removal. | — |
| D7 | 2026-07-31 | Supervisor ruling | `ops.finalizada` receives no new writer, stays in the schema for legacy compatibility, receives no frontend action, and no `concluida` record is migrated. | Section 7.2; `db/21_...sql:13-15` | BINDING | LR-09 is deferred by ruling, not by omission. | — |
| D8 | 2026-07-31 | Supervisor ruling | The seven items of section 7.3 form **one** coordinated implementation boundary; no intermediate production state may expose receipt while slider persistence is non-atomic. | Section 7.3 | BINDING | Phase-by-phase shipping of the receipt path is prohibited. | — |
| D9 | 2026-07-31 | Supervisor ruling | **Rejection of the flat bridge**: no native-to-flat dual writing, no synthetic `ordens_compra_fio` materialization, no representative OP fabrication for shared purchases. | Section 7.4 | BINDING | The compatibility shortcut is closed permanently. | — |
| D10 | 2026-07-31 | PEDIDO-LIFECYCLE-RECOVERY-CANONICAL-DOCUMENT-R1 | This document becomes the single working canonical plan for the scope of section 1. | This document | ACTIVE | Every future order in this scope updates this file. | — |

---

## 13. Evidence ledger

Load-bearing evidence read at HEAD `97d461ef07ddb422db0b22cea6436f593fdc657a`.
Full reports are referenced, not duplicated.

### 13.1 Migrations read

| Migration | Load-bearing finding |
|---|---|
| `db/01_schema.sql` | `ops.status` CHECK includes `finalizada`; `finalizada_em` column exists. |
| `db/13_pedidos_schema.sql` | `pedidos.status` CHECK includes `produzindo`; the column comment enumerates the six states. |
| `db/21_op_lifecycle_status_eventos.sql` | `concluida` is canonical, `finalizada` is legacy latex; no data migration performed. |
| `db/23_expedicao_entrega_flow.sql` | Expedition from a finished OP; `registrar_entrega_expedicao`; Pedido conclusion written server-side. |
| `db/25`, `db/26` | `gerar_op_latex` find-or-accumulate and its operational return flags. |
| `db/31`, `db/32` | Partial expedition and direct movement accept `em_producao`/`concluida`/`finalizada`. |
| `db/75_ordem_compra_c3c_inactive_cutover.sql` | The cutover state machine and its `legacy_active`/`flat` initial state; the receipt writer fence. |
| `db/76_...` | The two canonical RPC names and the `listar_ordens_compra_fio_compat` adapter shape. |
| `db/77_ordem_compra_c5a_emission_readiness.sql` | **The gate bypass**: the `authenticated` grant on `emitir_ordem_compra` and the completeness-only `pode_emitir` derivation; `acoes.receber` hardcoded `false`. |
| `db/81`–`db/88` | Manta expedition source, release writer, reversal and route completion. |
| `db/91_pedido_item_production_priority.sql` | The live dependency on `pedidos.status = 'produzindo'`. |
| `db/99_planejamento_compra_refoundation.sql` | Native planning entity; the partial unique index on live planning rows. |
| `db/100_ordem_compra_post_generation_stabilization.sql` | `oc_cobertura_ativa` as the single coverage owner; `oc_recalcular_cache_necessidade` as the sole cache writer; `acoes.receber` subordinated to the cutover; the cutover explicitly not activated. |

### 13.2 Application files read

`js/product-route.js`; `js/pedido-ui.js`; `js/pedido-priority.js`;
`js/calculo-op.js`; `js/delete-helpers.js`; `js/supabase-client.js`;
`js/screens/op-recalculo.js`; `js/screens/op-distribuicao-ui.js`;
`js/screens/op-persistir.js`; `js/screens/op-nova.js`; `js/screens/op-writes.js`;
`js/screens/entrega-writes.js`; `js/screens/fornecedor.js`;
`js/screens/expedicao-admin.js`; `js/screens/pedido-detail-events.js`;
`js/screens/pedido-detail-data.js`; `js/screens/pedido-tracking-admin.js`;
`js/screens/pedido-parciais-admin.js`; `js/screens/ordem-compra-receipt-cutover.js`;
`js/screens/pedido-insumos-distribuicao.js`; `index.html` (asset mounting).

### 13.3 RPCs inspected

`emitir_ordem_compra`, `cancelar_ordem_compra`, `excluir_ordem_compra`,
`obter_ordem_compra_admin`, `listar_ordens_compra_admin`,
`oc_cobertura_ativa`, `necessidade_kg_planejado_ativo`,
`oc_recalcular_cache_necessidade`, `oc_elegivel_cancelamento`,
`listar_ordens_compra_fio_compat`, `gerar_op_latex`, `gerar_op_latex_split`,
`registrar_entrega_expedicao`, `definir_prioridade_pedido`.

### 13.4 Routes and components inspected

`#/pedidos`, `#/pedidos/<uuid>`, `#/pedidos/<uuid>/editar`, `#/ops`, OP detail and
distribution, purchase planning on Pedido insumos, Purchase Order detail, supplier
screen, expedition administration, client tracking.

### 13.5 Git evidence

| Commit | Meaning |
|---|---|
| `1025a01` | db/99 purchase-planning refoundation, published. |
| `9212365` | Purchase planning repaint fix (parent-negative reference for db/100). |
| `97d461e` | **Accepted diagnostic baseline HEAD.** db/100 post-generation stabilization. |

### 13.6 Production SELECT evidence (read-only, at the db/100 preflight)

`pedidos` = 5; `pedido_itens` = 36; `ops` = 1; `necessidade_compra_fio` = 6;
`necessidade_compra_planejamento` = 6; two real Purchase Orders created after the
db/99 cutover (`OC-001-3-26`: 4 items, 3.769,800 kg; `OC-001-4-26`: 2 items,
1.761,300 kg; both `rascunho`); zero receipts; zero ledger entries; zero stock
movements; zero cancelled orders; need fingerprint 5531.100/5531.100 with
`cache_drift` = 0; cutover state `legacy_active`/`flat`.

**This block is historical and is not overwritten.** It records the state
*before* db/100 was applied. For the current state see 13.6.1 and 10.1.

### 13.6.1 Production SELECT evidence (read-only, current, 2026-07-31)

Measured under `PEDIDO-LIFECYCLE-RECOVERY-CANONICAL-STATE-CORRECTION-R1`.
Identity proved by cluster `system_identifier` 7642734024280108049 on
PostgreSQL 17.6, never by connector label.

| Fact | Value |
|---|---|
| Terminal applied migration | `20260731033711` (`100_ordem_compra_post_generation_stabilization`) |
| Later migration present | none — db/100 is terminal; repository has no db/101+ |
| db/100 functions present | 4 of 4 measured (`oc_cobertura_ativa`, `necessidade_kg_planejado_ativo`, `oc_recalcular_cache_necessidade`, `oc_elegivel_cancelamento`) |
| `ordem_compra_cutover` | `status` = `legacy_active`, `read_authority` = `flat` — **receipt inactive** |
| `ordem_compra_fio_lancamentos` | 0 rows — **no receipt has occurred** |
| `ordens_compra_fio` (flat model) | 0 rows |
| `pedidos` / `ops` / `necessidade_compra_planejamento` | 5 / 1 / 6 |
| `OC-001-3-26`, `OC-001-4-26` | both `emitida`, both `nao_recebido` — see 10.1 |

Repository and production migration history **agree**: db/100 is terminal in both,
and `tests/ordem-compra-c3d-deploy.smoke.js` declares `EXPECTED_TERMINAL = 100`.

### 13.7 Unresolved evidence

1. Tapete expedition reversal — never exercised (LR-10).
2. `registrar_entrega_expedicao` reversal — never exercised (LR-11).
3. Historical `saldo_fios` provenance — unavailable
   (`HISTORICAL_SALDO_FIOS_PROVENANCE_UNAVAILABLE`).
4. Native receipt compatibility for multiple purchase-order origins — unresolved
   (`NATIVE_RECEIPT_COMPATIBILITY_MULTI_ORIGIN_UNRESOLVED`).
5. A fresh verified production backup for this cutover — does not exist (LR-12).
6. No authenticated administrator session has exercised the db/99 or db/100
   end-to-end user flows against production.

---

## 14. Current checkpoint

```
DIAGNOSIS:
ACCEPTED

TARGET FUNCTIONAL PRODUCT DESIGN:
CLOSED / ACCEPTED

COORDINATED IMPLEMENTATION-READY TECHNICAL DESIGN:
NOT YET ACCEPTED

IMPLEMENTATION:
NOT AUTHORIZED

NATIVE RECEIPT CUTOVER:
NOT AUTHORIZED

db/100 SUPERVISOR REVIEW:
STILL OUTSTANDING

CURRENT BLOCKING WORK:
NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1 (DESIGN ONLY)

NEXT ACCEPTANCE GATE:
One implementation-ready coordinated design with exact manifests, invariants,
cutover state machine, PONR, recovery matrix, authenticated acceptance plan,
and resolution of the remaining Tapete/expedition/delivery edges.

ACCEPTED FUNCTIONAL-DESIGN CHECKPOINT:
a41a3db98372a3976635d8ffbd27a7832bb168a4 — the corrected target-design content of
section 9 and the two target graph artifacts, accepted under
PEDIDO-DERIVED-LIFECYCLE-TARGET-FUNCTIONAL-DESIGN-ACCEPTANCE-R1.
Rulings R1-R13 and D1-D7 are accepted and are NOT rewritten or compacted.
The acceptance covers the FUNCTIONAL specification only.

PRODUCTION POSITION (verified read-only 2026-07-31):
db/100 APPLIED (20260731033711) AND TERMINAL; PUBLISHED THROUGH staging/dev.
NATIVE RECEIPT STILL INACTIVE (ordem_compra_cutover = legacy_active / flat).
PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 REMAINS AWAITING SUPERVISOR
REVIEW AND ACCEPTANCE; THIS DOCUMENT DOES NOT ACCEPT IT.
```

`NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1` **must update this document**
rather than producing another competing lifecycle plan. It remains **design
only**; implementation is **not authorized** and is not chained to this
correction.

---

## 15. Future update protocol

- **Diagnosis orders** update section 4 (current-state findings), section 5
  (classifications) and section 13 (evidence).
- **Design orders** update section 9 (target architecture), section 7 and 12
  (decisions), section 6 (manifests and dependencies) and the risks they surface.
- **Implementation orders** update section 4, section 5, section 8 (defect
  dispositions), section 13 (evidence) and section 15 (change log).
- **Review orders** update section 8 (residual defects) and section 14
  (acceptance status).
- **Closeout** compacts resolved detail but **preserves decisions, invariants and
  operational consequences**. A compaction that loses an operational consequence
  is a defect.
- `PROJECT_STATE.md` remains concise and is a generated pointer only.
- `AGENT_HANDOFF.md` is refreshed **through its renderer** at every accepted
  checkpoint.
- This working document **remains ACTIVE until final lifecycle acceptance**.

---

## 16. Change log (append-only)

| Date | Order | Sections changed | Note |
|---|---|---|---|
| 2026-07-31 | `PEDIDO-LIFECYCLE-RECOVERY-CANONICAL-DOCUMENT-R1` | 0–16 (created) | Document established from the accepted `PEDIDO-DERIVED-LIFECYCLE-GRAPH-COMPLETION-R2` diagnosis at HEAD `97d461e`. Baseline visual graph added. Documentation-only; no product, migration, test or configuration file changed. |
| 2026-07-31 | `PEDIDO-LIFECYCLE-RECOVERY-CANONICAL-STATE-CORRECTION-R1` | 2, 10 (new 10.1), 13 (new 13.6.1), 14, 16 | Reconciled the operational facts with independently re-verified read-only production state. Section 2 now records db/100 (`20260731033711`) as the terminal applied migration and the inactive cutover instead of db/99. New 10.1 records the **current** administrative status of both protected Purchase Orders (`OC-001-3-26` and `OC-001-4-26` are now `emitida`, not `rascunho`), explicitly distinguished from the historical db/100 preflight evidence in 13.6, which is preserved unchanged. New 13.6.1 records the current production measurement. Section 14 now states the verified production position and that PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 remains unaccepted. No lifecycle redesign; no defect, ruling, classification or decision changed. Documentation-only. |
| 2026-07-31 | `PEDIDO-DERIVED-LIFECYCLE-TARGET-DESIGN-FINALIZATION-R1` | 0, 9 (replaced), 14, 16 | Section 9 replaced: was a list of DESIGN_PENDING placeholders, now the complete TARGET PRODUCT DESIGN — artifacts, lifecycle explanation, binding rulings R1-R13 and D1-D6, coordinated implementation blocks, the 30-row target-versus-current gap matrix, the residual technical-design assumptions, and the four-register distinction (target spec / current facts / gaps / authorization). Section 0 gained the clause forbidding the target and the current-state description from being merged. Section 14 records TARGET DESIGN DOCUMENTED / AWAITING SUPERVISOR REVIEW. Target graph added as SVG + Mermaid. Documentation-only; design is NOT accepted and implementation remains unauthorized. |
| 2026-07-31 | `PEDIDO-DERIVED-LIFECYCLE-TARGET-DESIGN-REVIEW-CORRECTION-R1` | 9.4 (new D7), 9.5 (Block 2), 9.6 (gap matrix), 14, 16 | Corrects four defects found on direct supervisor review of the published target design. (1) The section-16 row for TARGET-DESIGN-FINALIZATION-R1 had been inserted BEFORE the earlier CANONICAL-STATE-CORRECTION-R1 row, breaking commit chronology and the append-only presentation; the rows are reordered with no change to either entry content. (2) Gap-matrix row 8 cited D4 for the rejected-Purchase-Order recovery; D4 owns finishing-OP idempotency, so the citation is now R5 alone. (3) Block 2 cited R2 for the canonical pedidos.status writer; that writer is owned by section 7.1 and D1, production-start routing is owned by R1, and R2 owns exclusively the Pedido-confirmed to create-weaving-OP sequence. (4) New binding ruling D7 adds the server-owned cancellation-eligibility gates: Pedido cancellation reachable from rascunho/recebido/confirmado/produzindo with entregue barred until a D1 correction, OP cancellation reachable from simulada/aberta/em_producao/pausada with concluida barred until an authorized reversal, finalizada left as legacy without action or writer, cancellation defined as preserving every historical fact and never physical deletion, and the produzindo label widened to "iniciado pela producao OU restaurado pela recomputacao D1". Documentation-only; the design is NOT accepted and implementation remains unauthorized. |
| 2026-07-31 | `PEDIDO-DERIVED-LIFECYCLE-TARGET-FUNCTIONAL-DESIGN-ACCEPTANCE-R1` | 9.6, 9.7, 9.8, 14, 16 | SUPERVISOR ACCEPTANCE CLOSEOUT. The TARGET FUNCTIONAL PRODUCT DESIGN of section 9 and the two target graph artifacts are CLOSED / ACCEPTED AS THE TARGET FUNCTIONAL PRODUCT SPECIFICATION at commit a41a3db98372a3976635d8ffbd27a7832bb168a4. Accepted scope: rulings R1-R13 and D1-D7, the 15-lane target lifecycle, the commercial/operational state separation, explicit creation and opening of the weaving OP before receipt, two-stage purchase planning and Purchase Order generation, the three orthogonal Purchase Order axes, native receipt/reversal/allocation semantics, native availability feeding the shared slider, atomic production adjustment, post-receipt continuation, Tapete and Manta route separation, finishing recovery, expedition and delivery reversals, and Pedido and OP cancellation eligibility. The acceptance states that the diagram and section 9 correctly describe how the product must function after correction; it does NOT accept an implementation-ready technical design, does NOT authorize implementation, does NOT authorize the native receipt cutover, and does NOT accept the still-outstanding db/100 supervisor review of PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1. Two editorial corrections applied and no other target-design semantic change: gap-matrix row 17 now cites (§7.1/D1) instead of (D1/R2), because R2 owns only the explicit Pedido-confirmed to create-weaving-OP sequence; and the section 9.7 introduction now reads D1-D7 instead of D1-D6. R1-R13 and D1-D7 are neither rewritten nor compacted. Documentation-only. |
| 2026-07-31 | `NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1` | 9.9 (new), 16 | PROPOSED implementation-ready coordinated technical design added as section 9.9, marked PROPOSED / AWAITING SUPERVISOR REVIEW. The accepted functional specification of sections 9.1-9.8 and rulings R1-R13 / D1-D7 are unchanged. Repository and read-only production reconciliation established five findings that reduced the design: the native receipt architecture (registrar/estornar_recebimento_ordem_compra) already exists complete; the ledger already carries allocation, OP, material and colour lineage; receipt distribution is already explicit operator allocation; the db/75 cutover state machine already exists with productive_receipt_started_at as the enforced PONR; and ordem_compra.aceite_exigido_na_emissao already exists as the D3 frozen field with both live orders already correct, so no backfill is required. Closes every section 9.7 item: availability as server-side calculation functions with no new cache (A); shared-polyester serialization by Pedido-row lock plus ascending ops/op_itens order with ops.revisao optimistic concurrency (A); salvar_ajuste_producao_op as the single atomic writer with an explicit transaction-membership table (B); post-receipt Revisar producao continuation with 1-OP and N-OP routing (C); per-supplier exige_aceite with emission freeze and accept/reject writers (D); receipt activation without a new writer (E); the exact eight-step cutover sequence with the PONR identified as the first productive receipt (F); the five saldo_fios rows classified as preserved historical snapshot captured into the inventory baseline and explicitly excluded from OP ceilings (G); explicit operator allocation for multi-origin receipt (H); finishing idempotency by origem_entrega_id plus split_seq with an op_acabamento_tentativas failure record (I); estornar_expedicao_tapete_parcial over a shared primitive (J); corrigir_entrega_expedicao returning an incomplete non-cancelled Pedido to produzindo (K); and alterar_status_pedido with the D7 gates (L). Adds the 23-item implementation manifest with every flat consumer given an exact target owner, the five-migration topology with the PONR outside every migration, the 17-case recovery matrix and the authenticated acceptance plan. Two genuine blockers reported and not invented around: LR-12 (no fresh verified production backup) and the 2685.020 kg of lineage-less saldo_fios that cannot become productive availability without a separate ruling. No commit, no push, no database mutation, no implementation authorization. |
| 2026-07-31 | `NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1-C1` | 9.9 (rewritten) | Applies the twelve supervisor corrections found on direct review of the proposed technical design. C1 availability is now ORIGIN-SCOPE AWARE: OP-origin cotton is not reduced by sibling reservations, Pedido-origin polyester is, and the productive-receipt predicate selects allocation-destined ledger lines (alocacao_id NOT NULL AND kg_excesso = 0) instead of the withdrawn SUM(kg_recebido - kg_excesso); surplus is reported separately and never enters a ceiling; function security is explicit with owner-only SECURITY DEFINER internals behind one SECURITY INVOKER entry point and a security_invoker view. C2 one concurrency domain with an eleven-writer lock matrix, every writer in the manifest. C3 locks precede revision acceptance; a narrow ops.ajuste_revisao replaces a general ops.revisao; adjustment events go to op_eventos, never ordem_compra_eventos; alterar_status_op is corrected to take locks. C4 adds the server-owned atomic iniciar_producao_op. C5 removes the impossible predates-the-column fallback and makes the supplier column the sole authority with a deterministic seed and a demotion trigger. C6 withdraws the false full-reversibility claim, adds the missing ordem_compra_c3c_resume_legacy, and replaces the topology with a P1-P6 prepare/deploy/prove/contain/cutover/PONR sequence so the old UI never breaks. C7 removes the autonomous-transaction claim and makes split_seq replay-stable through a persisted command identity. C8 splits public alterar_status_pedido from owner-only _pedido_status_recalcular and adds the real grant matrix plus a fail-closed status fence, since authenticated holds table-level UPDATE on pedidos. C9 defines the twelve-step cancellation compensation and the eligibility refusal codes. C10 names expedicao_comandos, the shared primitive, idempotency scopes and duplicate behaviour. C11 makes every manifest entry an exact RETIRE or REPOINT. C12 keeps the historical-stock ruling explicitly OPEN. No commit, no push, no database mutation, no implementation authorization. |
| 2026-07-31 | `NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1-C2` | 9.9.0 (F11), 9.9.H, 9.9.N, 9.9.P, 9.9.Q, 9.9.R | Applies binding supervisor ruling TD1, which CLOSES the historical-stock product decision: the existing saldo_fios balance of 2685.020 kg is PRESERVED HISTORICAL GLOBAL STOCK and NOT PRODUCTIVE OP AVAILABILITY. Section 9.9.H is rewritten from an open architect ruling into TD1 with its nine binding consequences mapped one-to-one onto their exact technical effect: the five rows are preserved unchanged and touched by no migration or writer; they are captured verbatim into ordem_compra_cutover_inventory_baseline and hashed; they receive no retroactive Pedido, need, allocation or OP assignment; they are excluded from every OP ceiling because the section 9.9.A predicate reaches only ordem_compra_fio_lancamentos rows carrying recebimento_id, an allocation id and kg_excesso = 0, which no saldo_fios row can satisfy; they are excluded from the native received-material pool; they stay visible as historical global stock reported in its own column; productive availability comes only from native ledger lines with valid allocation lineage; no automatic or silent allocation mechanism is designed or permitted; and any future audited allocation is explicitly separately authorized work outside this coordinated release. The accepted operational consequence is recorded: the first productive ceilings after cutover may begin at zero until native receipts are registered. Historical stock is removed from the blocker list, leaving LR-12 as the ONLY genuine blocker, now classified as a cutover-execution prerequisite rather than a design gap, with the explicit statement that this technical design may be accepted while LR-12 remains open provided no cutover runs until it is discharged. The acceptance plan gains a TD1 disposable-cluster proof that a non-zero saldo_fios row raises no OP ceiling and appears in no productive-receipt total, and a production preflight assertion that the five rows are unchanged and absent from every ceiling; the manifest cutover runbook gains the TD1 baseline-capture assertion; the recovery matrix gains a TD1-violation row keyed on a baseline hash mismatch. Sections 9.1-9.8 are byte-identical. No commit, no push, no database mutation, no implementation authorization. |

**Every future executor report must identify the exact sections changed here.**
