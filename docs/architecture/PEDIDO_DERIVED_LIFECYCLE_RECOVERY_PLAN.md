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

Derived visual evidence: [`diagrams/pedido-derived-lifecycle-current.svg`](diagrams/pedido-derived-lifecycle-current.svg).

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
| Terminal migration applied in production at baseline | db/99 (`supabase_migrations` 20260730190104); db/100 applied under PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1 |
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

## 9. Target architecture — pending design

Every item below is `DESIGN_PENDING`. **No contract is invented here to fill the
section.** Each entry states only the problem the design must solve and the
constraints already ruled.

### 9.1 Canonical Pedido status writer — `DESIGN_PENDING`
Must own every `pedidos.status` transition server-side, including `produzindo`
(7.1). Direct frontend `UPDATE` authority is not accepted. Must remain compatible
with db/91's pending-priority refusal and with db/92's revision concurrency owner.

### 9.2 Atomic slider RPC — `DESIGN_PENDING`
Must replace the per-row loop in `salvarDistribuicaoOP` with one atomic
server-owned write, and must decide whether the `saldo_fios` / `saldo_fios_op`
snapshot of `iniciarProducaoOP` folds into the same boundary.

### 9.3 Native material-availability projection — `DESIGN_PENDING`
Must give every availability reader one native source derived from
`oc_cobertura_ativa` plus the native receipt ledger, replacing every
`ordens_compra_fio` read listed in 6.1.

### 9.4 Native supplier queue — `DESIGN_PENDING`
Must give a supplier a reachable native surface and decide whether supplier
acceptance is activated in this release or stays `exige_aceite = FALSE`.

### 9.5 Receipt cutover state machine — `DESIGN_PENDING`
Must define the exact transitions of `ordem_compra_cutover`
(`legacy_active/flat` → maintenance fence → `canonical_active/canonical`), the
lock and concurrency boundary, reconciliation, and observability.

### 9.6 PONR — `DESIGN_PENDING`
Must be explicitly identified. LR-12 (fresh verified backup) is an entry criterion.

### 9.7 Pre-PONR rollback — `DESIGN_PENDING`
Must be rehearsed and evidenced before the PONR is crossed.

### 9.8 Post-PONR forward recovery — `DESIGN_PENDING`
Must be a forward action. Simulating rollback by rewriting accepted history is
prohibited.

### 9.9 Tapete recovery paths — `DESIGN_PENDING`
Depends on LR-10 verification. Must cover expedition reversal and the finishing
OP recovery gap of LR-05.

### 9.10 Manta recovery paths — `DESIGN_PENDING`
db/87 already owns the Manta expedition reversal; the design must state what, if
anything, changes and must not silently re-specify it.

### 9.11 Expedition correction — `DESIGN_PENDING`
### 9.12 Delivery correction — `DESIGN_PENDING`
Depends on LR-11 verification, including the derived `pedidos.status -> entregue`
that the delivery writes.

### 9.13 Tracking and partial-delivery mounting — `DESIGN_PENDING`
Depends on the owning product decision for LR-06 / LR-07. Mounting is currently
prohibited without it.

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
```

`NATIVE-RECEIPT-COORDINATED-RELEASE-DESIGN-R1` **must update this document**
rather than producing another competing lifecycle plan.

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

**Every future executor report must identify the exact sections changed here.**
</content>
</invoke>
