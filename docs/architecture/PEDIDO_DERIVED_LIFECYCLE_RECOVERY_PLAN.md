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
| 17 | Pedido → Produzindo derived (D1/R2) | no writer at all | **ausente** | `db/13:50`; `db/91:621-622` | canonical server-owned status writer |
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

Every product choice ruled by R1–R13 and D1–D6 has been removed from this list.
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

### 9.8 Authorization status of this section

**Documenting this target authorizes no implementation.** Section 9 is a
specification awaiting supervisor review. No migration, RPC, screen or
configuration change is authorized by its existence. Implementation authorization
lives only in `docs/governance/current-state.json` and §14.

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

DESIGN:
NOT YET ACCEPTED

IMPLEMENTATION:
NOT AUTHORIZED

CURRENT BLOCKING WORK:
NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1

NEXT ACCEPTANCE GATE:
One implementation-ready coordinated design with exact manifests, invariants,
cutover state machine, PONR, recovery matrix, authenticated acceptance plan,
and resolution of the remaining Tapete/expedition/delivery edges.

TARGET DESIGN:
DOCUMENTED / AWAITING SUPERVISOR REVIEW (section 9, rulings R1-R13 and D1-D7).
NOT ACCEPTED. IMPLEMENTATION REMAINS UNAUTHORIZED.

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

**Every future executor report must identify the exact sections changed here.**
</content>
</invoke>
