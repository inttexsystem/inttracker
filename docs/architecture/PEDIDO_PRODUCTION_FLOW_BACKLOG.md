# Update 2026-07-06 - OP Create Requires Pedido Guard B

Phase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Gap closed in frontend/persistence JS: creating an OP without a Pedido via the
`Nova OP` button, via direct URL `#/ops/nova`, or via `persistirOP` without
`pedidoId` is no longer allowed. The user must start from the Pedido and use
the `#/ops/nova?pedido_id=<uuid>` route.

Result:

| Item | State |
|---|---|
| Standalone `Nova OP` button | Guides with a toast and sends to `#/pedidos`. |
| Direct URL `#/ops/nova` | Renders a block with CTA `Ir para Pedidos`. |
| `persistirOP` without Pedido | Returns `pedido_required` before `op_numeros` or writes. |
| OP with Pedido | Remains allowed and writes `lotes.pedido_id`. |
| Staging diagnostic | New read-only script returns ALERT for orphaned historical data. |

New P1 technical backlog item:

| Field | Value |
|---|---|
| **Item** | `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` |
| **Priority** | P1 |
| **Symptom** | Even with the UI blocked, RPCs such as `gerar_op_latex` still need an explicit backend guard to prevent a child OP from being created from an OP/lote without a Pedido. |
| **Likely files** | migrations/RPCs `gerar_op_latex`, `gerar_op_latex_split`, and related diagnostics. |
| **Acceptance criterion** | RPC rejects an origin without `lotes.pedido_id` with a controlled error; diagnostic proves there is no new path for orphan creation; does not affect valid OPs with a Pedido. |
| **Dependencies** | Explicit authorization for SQL/migration in a separate phase. |

Historical staging data remains without cleanup: `OPs com lote_id NULL: 0`,
`OPs cujo lote.pedido_id IS NULL: 11`, `Lotes com pedido_id IS NULL vinculados
a OPs: 9`. Any real backfill/fix must be its own phase, with a reviewed
script and explicit authorization.

# Update 2026-07-06 - OP Create Requires Pedido RPC Guard C

Phase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`
Status: **STAGING APPLY OK — VERIFIED / CLOSEOUT**

P1 item `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` prepared in
`db/33_op_latex_requires_pedido_guard.sql`.

| Item | State |
|---|---|
| `gerar_op_latex` | Guards `ops.lote_id -> lotes.pedido_id` before numbering/creating the OP. |
| `gerar_op_latex_split` | Same guard before numbering/creating the split. |
| Origin OP without lote/Pedido | Controlled error; no child OP created. |
| Origin OP with Pedido | Flow from `db/29` preserved. |
| Orphan diagnostic | Lists individual context and A/B/C/D classification, read-only. |
| Staging | Migration ready; application still pending. |

Historical data remains only diagnosed: `0` OPs with `lote_id NULL`,
`11` OPs whose `lote.pedido_id IS NULL`, `9` lotes without a Pedido linked
to OPs. This round's classification: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id`
5,6,7,8), C=0, D=1 (`op_id` 10). No cleanup/backfill, no global constraint,
no production.

# Update 2026-07-06 - OP Operational Code Closeout C

# Update 2026-07-06 - OP Operational Code Admin Wide Expand D

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Expansion applied to the operational Admin screens with a resolvable Pedido:
`painel.js`, `ops-list.js`, `op-nova.js`, `op-tecelagem-producao-admin.js`,
`op-latex-admin.js`, and `expedicao-admin.js`.

| Screen | OP -> Pedido | Siblings |
|---|---|---|
| `painel.js` | `lote_id -> lotes.pedido_id -> pedidos` already loaded | `opsByPedido` in memory, zero new query |
| `ops-list.js` | additive SELECT `lote.pedido_id` + `pedido:pedido_id(id,numero,criado_em)` | full list of OPs loaded on the screen |
| `op-nova.js` / `op-tecelagem-producao-admin.js` | `pedidoCtx` (`criadoEm` normalized) | light query `lotes do pedido -> ops desses lotes` |
| `op-latex-admin.js` | `op.lote.pedido_id`; without pedido falls back to legacy | light query for Pedido + siblings when there is a `pedido_id` |
| `expedicao-admin.js` | `pedido:pedido_id(...,criado_em)` | light query by lotes of the Pedido |

Guarantees: the T/A/seq rule remains only in `js/op-display.js`; legacy appears
as `Nº interno {numero}/{ano}` when there is an operational code and as a
fallback when there is no context; no new SQL/migration/real data; does not
change `ops.numero`, `ops.ano`, `op_numeros`, RPCs, PDFs, or fornecedor/RLS.

Required tests and read-only staging diagnostics green. User visual
validation pending.

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`
Status: **OK VISUAL IN SCOPE WITH PEDIDO CONTEXT** (documentary closeout)

User visual acceptance: the operational identification
`OP {pedido}/{ano}-{tipo}{seq}` appeared in the main places and worked.
Appearing "in a few places" is expected: the code only appears where there is
reliable Pedido context; without context, the legacy `OP {numero}/{ano}` is
kept. There is no global display goal for now.

Consolidated rule: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`
(`OP 25/2026-T01`); `T=Tecelagem`, `A=Acabamento/Latex`; `seq` per Pedido+Tipo
by `ops.criado_em`/`ops.id`; fallback `OP {numero}/{ano}`; single formatting
in `js/op-display.js`.

Validated scope: Pedido Detail Admin (linked OPs, related OPs, arrow modals,
hub, `tecPendingAcceptance`, `relatedOpsLabel`, docs/expedicao). Legacy by
decision: PDFs, fornecedor/RLS, toasts, logs, diagnostics, screens without
context (`ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`,
`op-nova`, `expedicao-admin`, `painel`).

Controlled pending item: expand to other screens only when (1) reliable
Pedido context; (2) clear visual need; (3) no migration; (4) no heavy query;
(5) no duplication of formatting outside `js/op-display.js`. Candidates:
`painel.js`, `expedicao-admin.js`. No new functional expansion in this phase.

Documentary closeout: functional test suite already green on commit `d7f57c4`
(op-display 20/20, pedido-detail 163/163, mandatory 337/337); minimal
revalidation for this phase in `op-display.smoke.js` + `pedido-detail.smoke.js`.

# Update 2026-07-06 - OP Operational Code Helper B

Phase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Scope: central helper for OP operational identification and use of that
display on screens with Pedido context. No SQL, no migration, no changes to
data/RPC/`op_numeros`/`ops.id/numero/ano`.

Contract: `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}` (e.g., `OP 21/2026-T01`,
`OP 21/2026-A02`). `pedido_ano = year(pedido.criado_em)`; `T=tecelagem`,
`A=latex/acabamento`; `seq` = 2 digits per Pedido+Tipo, ordered by
`ops.criado_em` asc, tiebreak `ops.id` asc. Mandatory fallback to legacy
`OP {numero}/{ano}` without reliable Pedido context.

| Item | Result |
|---|---|
| Central helper | `js/op-display.js` -> `window.RAVATEX_OP_DISPLAY`; pure; loaded after `js/badges.js`. |
| Pedido Detail | Operational display on linked OPs, related OPs, arrow modals, hub, `tecPendingAcceptance`, `relatedOpsLabel`, and document/expedicao labels. Legacy number/year as secondary reference. |
| Data | `pedido-detail-data.js` selects `ops.criado_em` (additive SELECT). |
| Legacy kept | PDFs, fornecedor/RLS, global toasts, `ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`, `op-nova`, `expedicao-admin`, `painel`. |
| Next increment | `painel.js` + `expedicao-admin.js` (has context; only needs OP->Pedido resolution, no new query). |

Tests: new `tests/op-display.smoke.js` (20/20) and 2 integration cases in
`tests/pedido-detail.smoke.js` (now 163/163). Mandatory set 337/337.
Read-only staging diagnostics OK (0 violations/collisions).

Guarantees: no SQL, no migration, no new real data, no changes to
`op_numeros`/RPC/`ops`, no touching production, no writes to `origin`.

# Update 2026-07-06 - Pedido Flow UI Audit Fix R1

Phase: `RAVATEX-TAPETES-PEDIDO-FLOW-UI-AUDIT-FIX-R1`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Scope of this fix: address the medium misalignments from the read-only audit
of the Pedido flow range without reworking UX or changing product rules.

Result by item:

| Item | Result |
|---|---|
| B2-label | Fixed. Active arrows now use specific, short labels: `Iniciar`, `Receber`, `Transferir`, `Movimentar`, `Entregar`. Modals/CTAs use the contract's explanatory texts. |
| E2-E5 | Proven/covered. Arrow modal writes remain canonical and success re-renders the modal itself via `refreshPedidoTransitionModal(...)`. |
| C3-done | No functional conflict; recorded as safe overlap. `adminStepper` and `applyFormalPendingStage` preserve the rule: `concluido` only without relevant operational balance and without relevant pending OP. Centralization refactor remains a P2 technical item if it resurfaces. |
| D1/D3 | Kept as P2 polish, outside the main patch. |

Final labels of the range:

- `Insumos -> Tecelagem` without OP: arrow `Iniciar`; modal/CTA `Gerar primeira OP`.
- `Insumos -> Tecelagem` with OP: arrow `Receber`; modal
  `Registrar recebimento de insumos`.
- `Tecelagem -> Acabamento`: arrow `Transferir`; modal/CTA
  `Transferir para Acabamento`.
- `Acabamento -> Expedicao`: arrow `Movimentar`; modal/CTA
  `Movimentar para Expedicao`.
- `Expedicao -> Entrega`: arrow `Entregar`; modal `Registrar entrega`.

Guarantees preserved: no SQL, no migration, no new real data, no parallel
write on the Pedido, no direct update to `ops.status`, no touching
production, and no writes to `origin`.

Required tests OK: `pedido-detail` 161/161, `pedido-detail-linked-ops`
7/7, `tec-to-acabamento-flow` 39/39, `expedicao-partial-flow` 12/12,
`expedicao-flow` 8/8, `op-latex-admin` 55/55,
`production-flow-invariants` 11/11. Read-only staging diagnostics OK:
flow invariants, Latex consolidation, and partial expedicao.

# Update 2026-07-05 - Pedido Insumos Tecelagem Modal Parity And Refresh R1

Phase: `RAVATEX-TAPETES-PEDIDO-INSUMOS-TECELAGEM-MODAL-PARITY-AND-REFRESH-R1`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopening: visual validation showed that the `Insumos -> Tecelagem` arrow
still did not respect the "no OP, no material" contract, and that actions
executed inside the arrow modal could leave the content stale or close
before the next operational state.

Parity contract applied:

| Axis | Required reference | Decision applied |
|---|---|---|
| Transition operational modal | Tecelagem -> Acabamento | The arrow modal remains the place for the next action, with a form when there is a real operation and auxiliary context afterward. |
| No OP | Product rule "no OP, no material" | Insumos -> Tecelagem without OP shows no receiving, shows no empty history, and offers `Gerar primeira OP`. |
| Acceptance/proposal | OP Tecelagem screen | Open OP with received insumos shows a real proposal with slider and `Aceitar proposta`, using `aplicarRecalculoOP`. |
| Post-action | Continuous flow in the same modal | Receiving and acceptance call refresh/re-render of the modal itself, without requiring close/reopen. |

Diagnostic matrix:

| Case | Before | After |
|---|---|---|
| Insumos -> Tecelagem without OP | `pedido-detail-progress.js` kept the title `Registrar recebimento de insumos` even without an OP; the modal fell into a context/history state and could induce a nonexistent operation. | Title/detail without OP become creation of the first OP; `openMovementModal` renders a clear block, `Nao e possivel registrar material sem OP vinculada.`, and CTA `Gerar primeira OP`; `buildInsumosTransferForm` has a defensive guard without OP. |
| OP Tecelagem pending acceptance | `buildRelatedOpsSection` already resolved the related OP and `buildTecAcceptanceProposalBlock` already rendered the slider/proposal, but acceptance success did not update the arrow modal. | The proposal receives `onAfterSuccess` and uses `refreshPedidoTransitionModal`, keeping the canonical handler/RPC and removing the stale slider/button after success. |
| After registering receipt | `registrarRecebimentoOrdemFio` was canonical, but the modal closed after success. | Success calls `refreshPedidoTransitionModal`, reloads Pedido/OPs/chain-state, and shows the next state in the same modal. |
| Parity Tecelagem -> Acabamento | Validated flow already had form first, auxiliary related OPs, `Transferir restante`, and `salvarEntregaCima`. | Pattern preserved; technical difference: without an initial OP there is no form because there is neither a source OP nor receivable orders yet. |

Functional files: `js/screens/pedido-detail-events.js`,
`js/screens/pedido-detail-progress.js`. Tests: `tests/pedido-detail.smoke.js`
gained runtime coverage for no OP, open OP with slider/proposal, acceptance
with modal refresh, and receipt with refresh to proposal.

Results: required tests OK (`pedido-detail` 160/160,
`pedido-detail-linked-ops` 7/7, `tec-to-acabamento-flow` 39/39,
`expedicao-partial-flow` 12/12, `expedicao-flow` 8/8,
`op-latex-admin` 55/55, `production-flow-invariants` 11/11). Read-only
staging diagnostics OK: flow invariants, Latex consolidation, and partial
expedicao.

Confirmations: no parallel write on the Pedido, no direct update to
`ops.status`, no SQL, no migration, no new real data, no accepting a real OP,
no registering a real receipt, no finalizing a real OP, no completing a
pedido, production/origin untouched, and `supabase/.temp/` outside the
commit. User visual validation remains pending; do not declare the backlog
zeroed by this phase.

# Update 2026-07-05 - Acabamento Expedicao Modal UX Parity R2

Phase: `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopening: visual validation showed the operational gate was correct, but the
`Acabamento -> Expedicao` modal experience did not follow the pattern already
validated for `Tecelagem -> Acabamento`.

Parity diagnostic:

| Item | Validated Tecelagem -> Acabamento | Acabamento -> Expedicao before | Decision |
|---|---|---|---|
| Main form | `buildEntregaInlineForm` in `layout: 'stacked'` | own form below context/history | align visual order |
| Products | `Produtos a transferir` card + `Preencher restante` | compact grid without the same visual weight | align by parity |
| Related OPs | auxiliary context | standalone `Movimentar` button | replace with selection/loading |
| Canonical write | `salvarEntregaCima` | `liberar_expedicao_latex_parcial` | justified difference, keep |
| Lifecycle | separate finalization | separate finalization | keep |

Fix: the operational form now appears as the center of the modal and before
related OPs, items, history, and documents. Related OP with balance uses
`Carregar nesta movimentacao`, updates the source OP/balance/products in the
modal itself, and does not call the RPC automatically. The movement continues
via the main `Movimentar para Expedicao` button, using
`liberar_expedicao_latex_parcial`.

Remaining differences and justification: the helper/form is not the same as
Tecelagem because the data contract is different (`salvarEntregaCima` creates
a top-side entry and a possible Latex OP; Acabamento -> Expedicao releases
balance to expedicao via a partial RPC). The technical difference was
documented and preserved; the purely visual divergences were aligned.

Tests: `pedido-detail.smoke.js` 156/156 and mandatory complementary suite
132/132. Read-only staging diagnostics OK: flow invariants, Latex
consolidation, and partial expedicao. No SQL, no migration, no new real data,
no parallel write on the Pedido, no requirement to finalize the Latex OP, and
no use of `origin`.

# Update 2026-07-05 - Acabamento Expedicao Modal Move R1

Phase: `RAVATEX-TAPETES-PEDIDO-ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1`
Status: **COMPLETED - PATCH VALIDATED LOCALLY, READ-ONLY STAGING DIAGNOSTICS OK, AND STAGING PUSH DONE**

Reopened item: the `Acabamento -> Expedicao` arrow in Pedido Detail Admin must
allow moving an Acabamento/Latex OP with received balance directly in the
arrow modal, including when the Latex OP is `aberta`. Finalizing the Latex OP
remains a separate action and is not a prerequisite for releasing balance to
Expedicao.

Staging push done on `work/app-next`: `76195b1..fce09b1`.

Root cause: `openMovementModal` only entered transfer mode when
`chainState.actions.releaseExpedicao.mode` was `enabled`. That gate did not
consider a Latex OP `aberta` as movable, even with received balance; because
of this the modal fell back to history/read-only. The related OPs list had a
similar filter and could show "Nenhuma acao contextual..." on the loaded OP.

Scope delivered:

- `js/screens/pedido-chain-state.js`: a Latex OP `aberta` passes the movement
  gate when there is a received/releasable balance.
- `js/screens/pedido-detail-progress.js`: the Acabamento transfer uses the OP
  selected by `releaseExpedicao`, not necessarily the first OP in the list.
- `js/screens/pedido-detail-events.js`: the modal shows the source OP,
  balance, pending products, per-product inputs, the `Transferir restante`
  button, and the effective action `Movimentar para Expedicao`; related OPs
  with balance receive `Movimentar`; the already-loaded OP no longer falls
  into the generic no-action text.
- `tests/pedido-detail.smoke.js`: covers Latex OP `aberta` with balance,
  triggering via the arrow modal, partial payload for
  `liberar_expedicao_latex_parcial`, reload/render after success, and
  blocking of a `simulada` OP.

Preserved contract:

- Movement writes only via the canonical RPC
  `liberar_expedicao_latex_parcial`.
- No parallel write on the Pedido, no requiring `concluida`/`finalizada`, no
  implicitly finalizing the Latex OP, and no creating an OP/Expedicao outside
  the canonical flow.
- The canonical read-only reading of the OP Latex screen remains in
  `consultar_saldo_expedicao_latex`; the Pedido uses its consolidated state to
  render the modal and reloads after saving.

Tests and diagnostics:

- `node --test tests\pedido-detail.smoke.js` = 155/155
- `node --test tests\pedido-detail-linked-ops.smoke.js tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js tests\production-flow-invariants.smoke.js` = 132/132
- Read-only staging OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmations: no SQL, no migration, no new real data, no accepting a real
OP, no finalizing a real OP, no real transfer in staging, no completing a
pedido, no changing OP lifecycle, no `git add .`, `supabase/.temp/` outside
the commit, production/origin untouched. Admin/Pedido backlog should still
not be declared zeroed without user visual validation.

# Update 2026-07-05 - Transition Modal Related Ops Actions R2

Phase: `RAVATEX-TAPETES-PEDIDO-TRANSITION-MODAL-RELATED-OPS-ACTIONS-R2`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL VALIDATION**

Reopened item: the correct behavior of the Pedido Detail Admin arrows is to
open the transition/movement modal. The stage dot opens the stage hub. The
previous failure diverted the `Aguardar` arrow to the hub
(`openStageDetailModal`), copying the dot's behavior and breaking the
original requirement to keep the transition experience in the arrow modal.

Scope delivered:

- `js/screens/pedido-detail-render.js`: rendered arrows/connectors call
  `openMovementModal(stage.transfer)`; dots continue calling
  `openStageDetailModal(stage, view)`.
- `js/screens/pedido-detail-events.js`: `openMovementModal` received the
  `OPs relacionadas` section, with Tecelagem, Acabamento/Latex, and Expedicao
  OPs related to the current transition.
- Contextual actions in the arrow modal: `Abrir OP`, `Movimentar` when there
  is applicable balance, `Finalizar OP` via the canonical handler, and an
  acceptance proposal for an open (`aberta`) OP Tecelagem.
- Tecelagem acceptance: not implemented as a simple button. The real
  acceptance/proposal UI lives in `js/screens/op-nova.js` (`buildProposta`)
  and the canonical write in `js/screens/op-recalculo.js`
  (`aplicarRecalculoOP`). The Pedido reuses the global proposal, slider, and
  recalculation helpers, without creating a parallel `.from('ops').update`.

Tests and diagnostics:

- `node --check js\screens\pedido-detail-events.js`
- `node --check js\screens\pedido-detail-render.js`
- `node --test tests\pedido-detail.smoke.js` = 150/150
- `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7
- `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37
- `node --test tests\op-latex-admin.smoke.js` = 55/55
- `node --test tests\expedicao-partial-flow.smoke.js` = 12/12
- `node --test tests\expedicao-flow.smoke.js` = 8/8
- `node --test tests\production-flow-invariants.smoke.js` = 11/11
- Read-only staging OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmations: no SQL, no migration, no new real data, no accepting a real
OP, no finalizing a real OP, no transfer, no completing a pedido, no changing
OP lifecycle, no changing Acabamento -> Expedicao, no parallel write on the
Pedido, no `git add .`, `supabase/.temp/` outside the commit,
production/origin untouched.

Pending visual criterion: Pedido #13 should show the `Aguardar` arrow opening
the transition modal with `OPs relacionadas` and a real acceptance proposal
when the OP Tecelagem is open (`aberta`); the Tecelagem dot should continue
opening the hub. Pedido #14 should validate Tecelagem -> Acabamento;
Pedido #21 can be used as a general capable flow. Do not declare the
Admin/Pedido backlog zeroed before this visual validation.

# Functional/Architectural Backlog of the Production Flow — Pedido

Phase: `RAVATEX-TAPETES-PRODUCTION-BACKLOG-REGISTER-A`
Date: 2026-07-04
Base: branch `work/app-next`, HEAD `26bf4a14e60c33ce905ebf9b37ff21486ddd87bc`
Previous closed phase: `RAVATEX-TAPETES-PRODUCTION-FLOW-UI-MAP-A`

---

## 1. Proven current operational state

### 1.1 Real path to complete a Pedido

The full production flow of the Pedido is operational. The stepper's 5 stages
(`recebido → confirmado → insumos → tecelagem → acabamento → expedicao → transporte → concluido`,
with `insumos` and `transporte` skippable) are covered by real transitions:

1. **Insumos** — `registrarRecebimentoOrdemFio` (`js/screens/op-writes.js:29`):
   registers kg received in the fio order linked to the Tecelagem OP. Also
   accessible via the canonical call through the Pedido Detail modal
   (`js/screens/pedido-detail-events.js:647`).

2. **Tecelagem → Acabamento** — `salvarEntregaCima` (`js/screens/entrega-writes.js:212`):
   writes an `etapa='cima'` entry + items + calls the `gerar_op_latex` RPC (find-or-accumulate).
   The canonical form is `buildEntregaInlineForm` (`js/screens/entrega-form.js:61`).
   Pedido Detail calls the modal via `openMovementModal` (`js/screens/pedido-detail-events.js:814`).

3. **Acabamento → Expedição** — `liberar_expedicao` (Supabase RPC):
   called in `js/screens/op-latex-admin.js:236`. Creates an expedição linked
   to the finalized latex OP.

4. **Expedição → Entrega** — `registrar_entrega_expedicao` (Supabase RPC):
   called in `js/screens/expedicao-admin.js:272` and
   `js/screens/pedido-detail-events.js:787`. Registers a partial or total
   delivery/pickup; `concluir_pedido_se_pronto` persists the completion when
   there is no balance.

### 1.2 Main routes/screens

| Route | Screen | Function |
|---|---|---|
| `#/pedidos` | Admin — Pedidos List | `pedidos-list.js` |
| `#/pedidos/<uuid>` | Admin — Pedido Detail | `pedido-detail.js` |
| `#/ops` | Admin — OPs List | `ops-list.js` |
| `#/ops/nova?pedido_id=<id>` | Admin — New OP via Pedido | `op-nova.js` |
| `#/ops/<id>` | Admin — OP Detail | `op-nova.js` / `op-latex-admin.js` |
| `#/expedicoes/<id>` | Admin — Expedição | `expedicao-admin.js` |

### 1.3 Stages that allow partial

- **Tecelagem**: partial deliveries via `salvarEntregaCima` (multiple
  deliveries for the same Tecelagem OP), each accumulating into the
  consolidated Acabamento OP.
- **Expedição**: `registrar_entrega_expedicao` accepts a partial delivery
  with balance tracking.

### 1.4 Manual finalization/completion actions

- **Acabamento finalized**: "Finalizar" button on the OP Látex screen
  (`js/screens/op-latex-admin.js`).
- **Release Expedição**: "Liberar expedição" button on the OP Látex screen.
- **Complete Pedido**: `concluir_pedido_se_pronto` (RPC) — called when
  registering an expedição delivery when there is no pending balance.

### 1.5 Gaps proven by the UI map (phase `PRODUCTION-FLOW-UI-MAP-A`)

| Gap | Detail |
|---|---|
| Ambiguous "Movimentar" buttons | On the OP Látex and Tecelagem screens, "Movimentar" is an anchor/shortcut to the deliveries card, not a real transition action. |
| Arrow modals do not show pending items | The modals opened by the Pedido stepper's arrows do not show what remains to complete between stages. |
| "Transferir restante" does not exist | There is no dedicated action/button to transfer the remaining balance of a stage. |
| Acceptance/adjustment of the OP Tecelagem via the Pedido does not exist | The Pedido offers no interface to review/accept the Tecelagem OP before it enters production. |
| Stepper is not clickable | The Pedido Detail stepper dots are not clickable — only the arrows between stages have handlers. |
| Explicit Tecelagem finalization does not exist | There is no dedicated action to mark Tecelagem as complete. |
| Partial OP↔Pedido visual correlation | The lineage strip exists (production chain in the Tecelagem OP), but the Pedido's visualization of OP links is limited. |
| New requirement: partial split | Exceptionally allow creating a separate OP for a partial, via a select, keeping accumulation as the default. |

---

## 2. Ordered backlog

### A. ACTION-BUTTONS-R1
**Fix ambiguous "Movimentar" buttons/anchors**

- **Problem**: "Movimentar" buttons on the OP Em Produção Tecelagem and OP
  Látex screens work as visual anchors to the deliveries/movement card, not
  as transition actions. This is confusing: the user clicks expecting to
  open a movement modal and instead is scrolled to another card.
- **Scope**: `js/screens/op-tecelagem-producao-admin.js`,
  `js/screens/op-latex-admin.js`.
- **Proposal**: Rename the anchors to an explicit label (e.g., "Ir para
  movimentação") or replace them with a CTA that opens the canonical
  transition modal (`openMovementModal`) directly, without scrolling.
- **Risk**: Low — local label/behavior change, no new writes.
- **Acceptance criterion**: The "Movimentar" button on the OP Tecelagem and
  OP Látex screens is no longer an anchor; it opens the transition modal or
  has a label that makes clear it is internal navigation.

### B. PEDIDO-TRANSITION-MODAL-GAPS-B
**Arrow modals must show the full picture of pending items between steppers**

- **Problem**: The arrows between stages of the Pedido Detail stepper open
  transition modals (`openMovementModal`), but these modals do not show the
  full picture of pending items — totals per product, already moved,
  missing, related OPs, blockers, and next action.
- **Scope**: `js/screens/pedido-detail-events.js` (transition modal render),
  possibly `pedido-detail-render.js`.
- **Proposal**: Enrich each modal with a summary of pending items calculated
  from the same canonical source (`derivePedidoChainState` in
  `pedido-chain-state.js`), not duplicated.
- **See §4** for the detailed requirement.
- **Risk**: Medium — requires new UI in each modal, but no new writes.
- **Acceptance criterion**: Each arrow modal shows: totals per product,
  already moved, missing, related OPs, blockers (if any), and the next
  action's CTA.

### C. PEDIDO-TRANSFER-REMAINING-B
**"Transferir restante" button/action**

- **Problem**: When a partial transfer has already been made, there is no
  explicit action to transfer the remaining balance at once. The user must
  create another delivery manually.
- **Scope**: `js/screens/pedido-detail-events.js` (new handler in the
  transition modal), possibly reusing `salvarEntregaCima` with a payload
  calculated from the balance.
- **Proposal**: Add a "Transferir restante" CTA to the transition modal that
  pre-fills the form with each item's pending balance.
- **Risk**: Medium — real write, but reuses an existing canonical operation.
- **Acceptance criterion**: "Transferir restante" button visible when there
  is a pending balance; clicking it pre-fills the form with the balance and
  executes the canonical operation.

### D. PEDIDO-TEC-ACCEPTANCE-B
**Acceptance/adjustment of the OP Tecelagem via the Pedido**

- **Problem**: The Tecelagem OP, when created from the Pedido, does not go
  through a review/acceptance stage in the Pedido's context. The admin must
  navigate to the OP screen to adjust it.
- **Scope**: New component/modal in `pedido-detail.js` that allows reviewing
  the items of the linked Tecelagem OP, adjusting quantities (within the
  pedido's balance), and confirming the start of production.
- **Risk**: High — involves Pedido↔OP consistency validation and a possible
  write to `op_itens`.
- **Acceptance criterion**: The admin can review and adjust the linked
  Tecelagem OP directly from the Pedido detail, without navigating to the OP
  screen.

### E. LATEX-SPLIT-PARTIAL-POLICY-A
**Diagnostic/architecture for the partial-split select**

- **Problem**: The current rule is to always accumulate into the existing
  latex OP (`gerar_op_latex` with find-or-accumulate). The new requirement
  demands exceptionally allowing the creation of a separate OP for a
  specific partial.
- **Scope**: Schema diagnostic, indexes, `gerar_op_latex` RPC, `ops`,
  `entregas`, `entrega_itens` tables.
- **See §3** for the detailed requirement.
- **Risk**: High — changes the consolidation rule; requires a new grouping
  key, trail/history, and must not reintroduce automatic "one OP per
  partial".
- **Acceptance criterion**: Documented diagnostic with: affected tables,
  existing indexes, current RPC signature, proposed new grouping key, RLS
  impact, and UI contract for the select.

### F. PEDIDO-STEPPER-STAGE-MODALS-B
**Clickable stepper dots and per-stage modals**

- **Problem**: The Pedido Detail stepper dots (8 stages:
  recebido/confirmado/insumos/tecelagem/acabamento/expedicao/transporte/
  concluido) are not clickable. Only the arrows between stages open
  transition modals.
- **Scope**: `js/screens/pedido-detail-render.js` (stepper render),
  `js/screens/pedido-detail-progress.js` (state logic).
- **Proposal**: Make each dot clickable, opening an informational modal with
  that stage's state: aggregated data, linked OPs, progress,
  events/history.
- **Risk**: Low — read-only, no new writes.
- **Acceptance criterion**: Each stepper dot is clickable and opens a modal
  with information for the corresponding stage.

### G. TEC-STAGE-FINALIZATION-A
**Decision/implementation of explicit Tecelagem finalization**

- **Problem**: There is no explicit action to mark the Tecelagem stage as
  complete. The transition to Acabamento happens via delivery
  (`salvarEntregaCima`), but the Tecelagem OP itself has no explicit
  terminal state ("completed") separate from the last delivery.
- **Scope**: Architectural decision first: is Tecelagem completed
  automatically when the entire balance has been transferred, or does it
  require an explicit action? Then, UI implementation (OP Tecelagem and/or
  Pedido Detail).
- **Risk**: Medium — involves an OP lifecycle decision and possible use of
  `alterar_status_op`.
- **Acceptance criterion**: Decision documented; if an explicit action, a
  "Concluir Tecelagem" button visible and functional; if automatic, a clear
  indicator that the stage was completed.

### H. OP-PEDIDO-LINEAGE-UX-B
**Standardize Pedido↔OP visual correlation**

- **Problem**: The visual correlation between the Pedido and its linked OPs
  is partial. The lineage strip exists on the Tecelagem OP (shows the
  consolidated Acabamento OP), but on the Pedido Detail the listing of
  linked OPs is basic and does not show the full chain.
- **Scope**: `js/screens/pedido-detail-render.js` (linked OPs block),
  `pedido-detail-progress.js` (aggregated data).
- **Proposal**: Create a lineage visualization in the Pedido Detail:
  cards/timeline showing OP Tecelagem → OP Acabamento → Expedição, with
  status, progress, and quick actions.
- **Risk**: Medium — read-only, but requires new UI with already-loaded
  data.
- **Acceptance criterion**: In the Pedido detail, the OPs section shows the
  full production chain with status, progress, and navigation to each OP.

---
## 3. New partial-split requirement (LATEX-SPLIT-PARTIAL-POLICY-A)

### 3.1 Default rule (do not change)

- **Accumulate in the same OP** when the following coincide: same origin
  weaving OP (`origem_op_id`) + same latex supplier
  (`destino_fornecedor_id`).
- The `gerar_op_latex` RPC implements find-or-accumulate: if a latex OP with
  status `aberta` or `em_producao` already exists for this combination, it
  accumulates the new delivery's items into it; otherwise, it creates a new
  one.
- This behavior is the default and **must not be changed**.

### 3.2 Exception (new requirement)

- Allow, **explicitly and via select**, creating a **new, separate latex OP**
  for a specific partial delivery, even when a consolidated latex OP already
  exists for the same origin+supplier combination.
- The exception **must not be the default** — the default remains
  accumulation.
- The exception **must be explicit** via a select/binary control in the
  delivery form (`buildEntregaInlineForm`) or at the moment of calling
  `salvarEntregaCima`.
- The exception **must require a trail/history**: the new OP must record the
  specific `origem_entrega_id` and the reason for the separation.

### 3.3 Absolute restrictions

- **DO NOT** reintroduce "one OP per partial" as automatic behavior.
- **DO NOT** break the idempotency of `gerar_op_latex` for the default case.
- **DO NOT** create a migration or alter the schema in this diagnostic phase
  (`LATEX-SPLIT-PARTIAL-POLICY-A` is diagnostic/architecture, not
  implementation).

### 3.4 Required diagnosis (before implementing)

1. **Map `gerar_op_latex`**: current signature, parameters,
   find-or-accumulate logic, return value.
2. **Map affected tables**: `ops`, `op_itens`, `entregas`,
   `entrega_itens`, `lotes`.
3. **Map existing indexes**: `ops.origem_op_id`, `ops.origem_entrega_id`,
   `ops.tipo`, `ops.status`.
4. **Define new grouping key**: how does the RPC decide whether to
   accumulate or create? The current key is
   `(origem_op_id, destino_fornecedor_id, tipo='latex')`. The exception needs
   a new discriminator (e.g., a `forcar_nova_op` flag passed as a parameter).
5. **Define UI contract**: where and how the select/binary control appears
   in the delivery form.
6. **Assess RLS impact**: the new OP inherits the same policies as `ops`
   with `tipo='latex'`.

---

## 4. Transition modal requirement (PEDIDO-TRANSITION-MODAL-GAPS-B)

### 4.1 Mandatory content of each modal

Each modal opened by the stepper arrows in the Pedido Detail must display:

| Information | Source |
|---|---|
| Totals per product (order meters) | `pedido_itens` |
| Already moved in the current stage | `entrega_itens` aggregated by `op_item_id` |
| Missing to complete the transition | `total - movimentado` |
| OPs related to the stage | `ops` linked to the pedido (via `lotes.pedido_id`) |
| Blockers (if any) | E.g.: destination OP not confirmed, pending supplier |
| Next action (CTA) | "Transferir", "Transferir restante", "Liberar expedição", etc. |

### 4.2 Canonical calculation source

- The calculation source **must be shared**, not duplicated per modal.
- The `derivePedidoChainState` matrix (`js/screens/pedido-chain-state.js:146`)
  already computes each stage's state with gates and actions.
- The modals must consume this same matrix, complemented with granular
  (per-item) data when needed.
- **Forbidden**: each modal recalculating totals independently with its own
  logic.

### 4.3 Visual states

- **Active (blue)**: label "Transferir", clickable arrow → opens transition
  modal.
- **Completed (green/neutral)**: label "Concluído", clickable arrow → opens
  transition history with partials.
- **Waiting (gray/muted)**: label "Aguardar", non-clickable arrow.
- **View/Edit**: short integrated label, opens context when allowed.

---

## 5. General implementation criteria

1. **One phase per problem group**: each backlog item (A-H) is an
   independent phase. Do not group multiple items into a single phase.
2. **No large patch without diagnosis**: items marked "diagnosis/architecture
   first" (E, G) require a design document before code.
3. **No closeout without tests/evidence**: each phase must have a dedicated
   smoke test or documented visual evidence.
4. **Keep production untouched**: `bhgifjrfagkzubpyqpew` and `origin/main`
   are never a push target.
5. **Selective staging**: `git add` only the phase's files; never
   `git add .`.
6. **Update `AGENT_HANDOFF.md` at the end** of each phase, recording the
   post-phase state, changed files, tests, and next step.
7. **Push only to `staging`**: `git push staging work/app-next`.
8. **Branch**: always `work/app-next`.
9. **Allowed residual**: `?? supabase/.temp/` — never committed.

---

## 6. Technical implementation order

| # | Item | Dependencies | Risk | Type |
|---|---|---|---|---|
| 1 | A. ACTION-BUTTONS-R1 | None | Low | UI |
| 2 | B. PEDIDO-TRANSITION-MODAL-GAPS-B | None | Medium | UI |
| 3 | C. PEDIDO-TRANSFER-REMAINING-B | B (reuses modal) | Medium | UI + Write |
| 4 | F. PEDIDO-STEPPER-STAGE-MODALS-B | None | Low | UI |
| 5 | H. OP-PEDIDO-LINEAGE-UX-B | None | Medium | UI |
| 6 | D. PEDIDO-TEC-ACCEPTANCE-B | H (lineage) | High | UI + Write |
| 7 | E. LATEX-SPLIT-PARTIAL-POLICY-A | None (diagnosis) | High | Architecture |
| 8 | G. TEC-STAGE-FINALIZATION-A | D, E (lifecycle decisions) | Medium | Architecture + UI |

### Rationale for the order

1. **A** first: simple fix, low risk, removes immediate confusion.
2. **B** next: enriches the existing modals without changing writes.
3. **C** depends on B: the "Transferir restante" button lives in the
   enriched modal.
4. **F** is independent and low-risk: read-only UI only.
5. **H** is independent and improves the navigation experience.
6. **D** depends on H for the visual lineage context; it is the first item
   that involves new writes.
7. **E** is pure diagnosis: it does not change code, it only documents the
   path to implementing the partial split.
8. **G** is last: it depends on the decisions from D (Tecelagem lifecycle)
   and E (split policy) to define whether finalization is automatic or
   explicit.

---

## 7. Mapped risks

| Risk | Affected items | Mitigation |
|---|---|---|
| Latex consolidation rule broken | E | Diagnosis before code; do not change `gerar_op_latex` without a regression test. |
| Inconsistent write between Pedido and OP | C, D | Reuse canonical operations (`salvarEntregaCima`, `alterar_status_op`); never write directly. |
| Divergence of totals between modals | B | Single source: `derivePedidoChainState` + `entrega_itens`. |
| Stepper out of sync | F, G | Consume `chainState` from the canonical matrix, do not recompute. |
| "One OP per partial" reintroduced | E | Absolute restriction documented; review mandatory. |

---

## 8. References

- `js/screens/pedido-chain-state.js` — Canonical state matrix (`derivePedidoChainState`)
- `js/screens/pedido-detail-progress.js` — Render of the `Progresso produtivo` block
- `js/screens/pedido-detail-render.js` — Render of the stepper and connectors
- `js/screens/pedido-detail-events.js` — Transition modal handlers (`openMovementModal`)
- `js/screens/entrega-writes.js` — `salvarEntregaCima` (canonical Tecelagem→Acabamento write)
- `js/screens/entrega-form.js` — `buildEntregaInlineForm` (canonical delivery form)
- `js/screens/op-tecelagem-producao-admin.js` — OP Em Produção Tecelagem screen
- `js/screens/op-latex-admin.js` — OP Látex/Acabamento screen
- `js/screens/expedicao-admin.js` — Expedição screen
- `tests/production-flow-invariants.smoke.js` — Production flow invariants
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` — Architectural plan
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` — Schema contract
- `PROJECT_STATE.md` — Full phase history
- `AGENT_HANDOFF.md` — Current state and binding rules
## 9. Admin Backlog — Operational Validation

Phase: `RAVATEX-TAPETES-ADMIN-FLOW-BACKLOG-SYNC-A`
Date: 2026-07-05
Type: docs-only, read-only documentation patch. Consolidates observations
from validation of the Admin flow without implementing UI, JS, SQL, or migration.

### 9.1 Registered items (recommended order)

#### 1. PEDIDO-CONCLUIR-ACTION-R1

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | The action to complete/conclude the Pedido via `concluir_pedido_se_pronto` has no explicit CTA visible in the Pedido Detail Admin header when all completion conditions are satisfied. The user depends on the side effect of an expedicao delivery to trigger completion. |
| **Affected flow** | Pedido Detail Admin — Pedido completion |
| **Likely cause** | The completion CTA became coupled to the Expedição → Entrega flow (`registrar_entrega_expedicao`). When there is no pending expedicao but the Pedido is ready by other criteria, there is no visible CTA. |
| **Likely files** | `js/screens/pedido-detail.js`, `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js` |
| **Acceptance criteria** | "Concluir Pedido" button visible in the Pedido Detail header/actions when `concluir_pedido_se_pronto` is eligible; confirmation before the write; success/error feedback. |
| **Dependencies** | None (the RPC `concluir_pedido_se_pronto` already exists in db/23). |
| **Recommended phase** | `ADMIN-PEDIDO-CONCLUIR-CTA-R1` |
| **Order** | 1 |

#### 2. PEDIDO-STAGE-ACTION-HUB-B

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | The stepper arrows are the only transition-action point in the Pedido Detail. There is no unified hub/center that aggregates all pending actions per stage, with blocker explanations and links to related OPs. |
| **Affected flow** | Pedido Detail Admin — all stage transitions |
| **Likely cause** | The arrow modals were enriched incrementally (phases B/C), but each one is still isolated. A panel/hub is missing that consolidates: what is blocked at each stage, why, which OPs are involved, and what to do. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js`, `js/screens/pedido-detail-progress.js` |
| **Acceptance criteria** | Action hub/center in the Pedido Detail that, for each active/blocked stage: shows status, blockers with a short explanation + expandable detail, related OPs with links, CTA for the next canonical action. Single source: `derivePedidoChainState`. |
| **Dependencies** | None (uses already-loaded data + `derivePedidoChainState`). |
| **Recommended phase** | `ADMIN-PEDIDO-STAGE-ACTION-HUB-B` |
| **Order** | 2 |

**Items absorbed by PEDIDO-STAGE-ACTION-HUB-B:**

| Item absorvido | Como é absorvido |
|---|---|
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | The textual explanation of each blocker now lives in the hub, with short visible text and detail in a tooltip/expansion. The arrow keeps a short label; the hub concentrates the explanation. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | The links to OPs related to each stage are now displayed in the hub, not as inline text on the arrows. |
| Part of `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | The hub shows whether the linked Tecelagem OP still needs acceptance/adjustment, with a CTA to the acceptance modal. The acceptance modal itself is implemented separately (item 3). |
| Part of `PEDIDO-STAGE-MODAL-WIDTH-R1` | The hub uses an expanded width by default (not a narrow modal), resolving the truncation problem for dense information. |

#### 3. TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | Accepting/adjusting the Tecelagem OP requires navigating to the OP screen (`#/ops/<id>`). The Pedido Detail offers no inline interface to review and accept the linked tecelagem OP. |
| **Affected flow** | Pedido Detail Admin — Insumos → Tecelagem or Tecelagem → Acabamento transition |
| **Likely cause** | Creating a Tecelagem OP from the Pedido (Phase C) populated `lotes.pedido_id` and `op_itens.pedido_item_id`, but the acceptance/adjustment cycle still has no screen in the Pedido context. The current transition modal only knows how to open the OP. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js` |
| **Acceptance criteria** | Inline modal in the Pedido Detail that: lists Tecelagem OP items with adjusted vs. ordered quantities, allows adjustments within the Pedido's balance, shows width parameters, displays the OP status, and has a "Confirmar e iniciar produção" CTA that calls `alterar_status_op(..., 'em_producao')`. |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B` (the hub exposes the CTA for this modal). |
| **Recommended phase** | `ADMIN-TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` |
| **Order** | 3 |

#### 4. OP-NOVA-METRAGEM-INPUT-FOCUS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | When adding items on the New OP screen (Tecelagem or Acabamento), focus does not move automatically to the metragem field after selecting the model, forcing a manual click or Tab. |
| **Affected flow** | Admin — New OP (`#/ops/nova`) |
| **Likely cause** | The model select fires `onchange`, which updates the item state (colors, derived width), but there is no programmatic `focus()` on the metragem input after the selection. |
| **Likely files** | `js/screens/op-nova.js` |
| **Acceptance criteria** | When a model is selected in the New OP item select, focus moves automatically to the corresponding metragem field. |
| **Dependencies** | None. |
| **Recommended phase** | `ADMIN-OP-NOVA-METRAGEM-FOCUS-R1` |
| **Order** | 4 |

#### 5. PEDIDO-FIRST-OP-CTA-PLACEMENT-R1

| Campo | Valor |
|---|---|
| **Priority** | P1 |
| **Symptom** | When a Pedido has no linked OP, the "Criar OP" / "Lançar produção" CTA is absent or positioned without prominence in the Pedido Detail. The user must know to navigate manually to `#/ops/nova?pedido_id=<id>`. |
| **Affected flow** | Pedido Detail Admin — Pedido without OP |
| **Likely cause** | The linked-OPs block in the Pedido Detail only appears when there are OPs. The "no OP" state has no visible contextual CTA to create the first OP from the Pedido. |
| **Likely files** | `js/screens/pedido-detail-render.js`, `js/screens/pedido-detail.js` |
| **Acceptance criteria** | In the Pedido Detail without OPs, a visible block with a prominent "Criar OP de produção" CTA that navigates to `#/ops/nova?pedido_id=<id>` with the Pedido's items pre-filled. |
| **Dependencies** | None (the `#/ops/nova?pedido_id=` route has existed since Phase C). |
| **Recommended phase** | `ADMIN-PEDIDO-FIRST-OP-CTA-R1` |
| **Order** | 5 |

#### 6. TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | The Tecelagem → Acabamento transition modal (`openMovementModal`) displays the delivery form (`buildEntregaInlineForm`) with a layout that can become compressed at smaller resolutions, especially the split select and the reason field. |
| **Affected flow** | Pedido Detail Admin — Tecelagem → Acabamento arrow |
| **Likely cause** | `buildEntregaInlineForm` was designed for the OP screen (full width), but in the Pedido Detail modal the available width is smaller (~520px), compressing fields, the split select, and the amber warning. |
| **Likely files** | `js/screens/pedido-detail-events.js`, `js/screens/entrega-form.js` |
| **Acceptance criteria** | Tecelagem → Acabamento modal with responsive layout: fields in a flexible grid, split select and reason field with adequate width, legible amber warning, and pending-items table without horizontal truncation. |
| **Dependencies** | `PEDIDO-STAGE-MODAL-WIDTH-R1` (the standardized base modal width also benefits this item). |
| **Recommended phase** | `ADMIN-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` |
| **Order** | 6 |

#### 7. PEDIDO-STAGE-MODAL-WIDTH-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | The stage-transition modals use a narrow fixed width (~520px), truncating totals information, pending-items tables, and related-OPs lists. |
| **Affected flow** | Pedido Detail Admin — all arrow modals |
| **Likely cause** | Fixed width inherited from simple modals; the modals were enriched with more data across phases, but the base width was not adjusted. |
| **Likely files** | `js/screens/pedido-detail-events.js` |
| **Acceptance criteria** | Transition modals with a minimum width of 640px (or responsive `min(90vw, 720px)`); internal tables without forced horizontal scroll; totals and related-OPs information fully visible. |
| **Dependencies** | None. Partially absorbed by `PEDIDO-STAGE-ACTION-HUB-B` (the hub uses an expanded panel, not a narrow modal). |
| **Recommended phase** | `ADMIN-PEDIDO-STAGE-MODAL-WIDTH-R1` |
| **Order** | 7 |

#### 8. LATEX-ADMIN-COMPACT-BUTTONS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 |
| **Symptom** | On the OP Latex Admin screen (`op-latex-admin.js`), the action buttons (Movimentar para Expedição, Finalizar OP) and the summary cards occupy excessive vertical space, forcing frequent scrolling on OPs with many items. |
| **Affected flow** | Admin — OP Latex/Acabamento (`#/ops/<id>` with tipo=latex) |
| **Likely cause** | Layout inherited from the standalone screen with generously sized cards and buttons; with the new canonical summary cards (Recebido/Movimentado/Disponível/Entregue/Saldo) and the items table, vertical density increased but the buttons were not compacted proportionally. |
| **Likely files** | `js/screens/op-latex-admin.js` |
| **Acceptance criteria** | Action buttons and summary cards with reduced height (compact padding/margin); "Movimentar para Expedição" and "Finalizar OP" CTAs visible without scrolling on most OPs; items table preserved. |
| **Dependencies** | None. |
| **Recommended phase** | `ADMIN-LATEX-COMPACT-BUTTONS-R1` |
| **Order** | 8 |

### 9.2 Absorbed items (do not implement in isolation)

These items are resolved as part of `PEDIDO-STAGE-ACTION-HUB-B` (item 2 above):

#### PEDIDO-STAGE-BLOCKER-EXPLANATION-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 (absorbed) |
| **Symptom** | The stepper arrows in the Pedido Detail show only a short label ("Aguardar", "Transferir", "Concluído") without explaining the reason for the blocker when a stage is in "Aguardar". |
| **Affected flow** | Pedido Detail Admin — stepper between stages |
| **Likely cause** | Product decision: short labels on the arrows to avoid visual clutter. The blocker explanation needs a separate location. |
| **Acceptance criteria** | Blockers explained in the action hub (`PEDIDO-STAGE-ACTION-HUB-B`), with short visible text + expandable detail. Arrows keep short labels. |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Recommended phase** | Absorbed by `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

#### PEDIDO-STAGE-RELATED-OPS-LINKS-R1

| Campo | Valor |
|---|---|
| **Priority** | P2 (absorbed) |
| **Symptom** | The transition modals do not display direct links to the OPs related to the stage. The user must leave the modal, find the linked-OPs block, and click there. |
| **Affected flow** | Pedido Detail Admin — transition modals |
| **Likely cause** | The modals evolved to show totals and pending items, but not navigation links to the OPs. |
| **Acceptance criteria** | The action hub (`PEDIDO-STAGE-ACTION-HUB-B`) displays, for each stage, clickable links to the related OPs (`#/ops/<id>`). |
| **Dependencies** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Recommended phase** | Absorbed by `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

### 9.3 Recommended implementation sequence

| # | Item | Absorbs | Risk |
|---|---|---|---|
| 1 | PEDIDO-CONCLUIR-ACTION-R1 | — | Low |
| 2 | PEDIDO-STAGE-ACTION-HUB-B | BLOCKER-EXPLANATION-R1, RELATED-OPS-LINKS-R1, part of TEC-ACCEPTANCE, part of MODAL-WIDTH | Medium |
| 3 | TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B | — | Medium |
| 4 | OP-NOVA-METRAGEM-INPUT-FOCUS-R1 | — | Low |
| 5 | PEDIDO-FIRST-OP-CTA-PLACEMENT-R1 | — | Low |
| 6 | TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1 | — | Low |
| 7 | PEDIDO-STAGE-MODAL-WIDTH-R1 | — | Low |
| 8 | LATEX-ADMIN-COMPACT-BUTTONS-R1 | — | Low |

### 9.4 Relationship with the production backlog (§2)

The Admin backlog (§9) is complementary to the production-flow backlog (§2).
The items in §2 (A-H) cover transition mechanics and the production chain;
the items in §9 cover usability, clarity of actions, and visual
organization of the already-existing Admin interface.

Resolved overlaps:
- §2 item D (`PEDIDO-TEC-ACCEPTANCE-B`) ≈ §9 item 3 (`TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`): item §9.3 details inline acceptance in the Pedido. Both converge on the same implementation.
- §2 item B (`PEDIDO-TRANSITION-MODAL-GAPS-B`) ≈ §9 item 2 (`PEDIDO-STAGE-ACTION-HUB-B`): the action hub is the natural evolution of the enriched arrow modals.
- §9 items 6 and 7 (`TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`, `PEDIDO-STAGE-MODAL-WIDTH-R1`) are layout adjustments that benefit the §2.B modals.

Items from §2 already implemented and outside the Admin backlog: C, F, H, A, G, E (all resolved in earlier phases per `PROJECT_STATE.md`).

### 9.5 Binding rules

1. **Do not implement absorbed items in isolation.** `BLOCKER-EXPLANATION-R1`
   and `RELATED-OPS-LINKS-R1` only make sense inside the hub.
2. **Canonical calculation source:** `derivePedidoChainState` for any
   stage, blocker, or progress data. Do not duplicate logic.
3. **Writes only via existing canonical operations:** `alterar_status_op`,
   `salvarEntregaCima`, `liberar_expedicao_latex_parcial`,
   `concluir_pedido_se_pronto`. Never write directly to tables.
4. **One phase per item.** Do not group multiple items into a single phase.
5. **Selective staging.** `git add` only the files of the phase.
6. **Production untouched.** `bhgifjrfagkzubpyqpew` and `origin/main` are
   never a push target.

### 9.6 Admin/Pedido visual closeout - 2026-07-05

Phase: `RAVATEX-TAPETES-ADMIN-BACKLOG-VISUAL-CLOSEOUT-A`

Status: **BLOCKED**. The Admin/Pedido backlog **is not zeroed out** in real
staging.

Binding premise: a technical report and local tests are not enough to close
a UX/flow backlog. Each item must be classified by real behavior in
staging: Visual OK, Partial, Failed, Reopen R2, or Not validatable without
manual action.

Audited environment:

| Campo | Valor |
|---|---|
| Branch | `work/app-next` |
| Initial HEAD | `57719298dcbd370cb7b1a0ca3ff1365c30ca8fb9` |
| Remote staging | `staging/work/app-next` at the same commit |
| Visual frontend | `http://localhost:8765/` with `APP_ENV=staging` |
| Supabase staging | `ucrjtfswnfdlxwtmxnoo` |
| Production | `bhgifjrfagkzubpyqpew` untouched |
| Cache/assets | cache mitigated with `?audit=...`; the served `pedido-detail-render.js` matches the local SHA-256 |

Closeout table:

| Item | Previously reported status | Real visual status | Evidence | Decision | Next phase |
|---|---|---|---|---|---|
| `PEDIDO-CONCLUIR-ACTION-R1/R2` | OK per R2/tests | Visual OK | Pedido #20 shows `Concluido` / `Comercial: Entregue`, `Pedido concluido` button with `disabled="disabled"`; eligible Pedido #21 shows `Concluir pedido` enabled, without `disabled`; no `disabled="null"` on the Pedido Detail buttons. | Closed for the Pedido Detail. | None for the Pedido Detail; assess the static residue in `expedicao-admin.js` if it enters scope. |
| `PEDIDO-STAGE-ACTION-HUB-B` | OK per test/harness | Failed | Pedido #21 opens the Entrega hub, but Pedido #13 with an open Tecelagem OP crashes when clicking the stage/arrow: `TypeError: Failed to execute 'appendChild' on 'Node'` at `pedido-detail-events.js:1726`. | Reopen R2. | Fix the hub and revalidate in a real browser. |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | OK/absorbed by the hub | Failed | Arrows keep the short `Aguardar` text, but the click on Pedido #13 does not open the explanation because of the hub crash. | Reopen R2. | Same R2 as the hub. |
| `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` | OK | Visual OK | Pedido #1 without an OP shows `Gerar primeira OP` highlighted on the right of the `OPs vinculadas` block; empty and explanatory card. | Closed. | None. |
| `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` | OK | Visual OK | New OP opened from Pedido #1; the empty `metros` field kept accepting `1000` continuously and retained focus; no OP was saved. | Closed. | None. |
| `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` | OK | Visual OK | Pedido #14 opened the Tecelagem -> Acabamento modal; visual order: item name, Data/Destino/Metros, Observacao; `Itens envolvidos` legible; no transfer saved. | Closed. | None. |
| `LATEX-ADMIN-COMPACT-BUTTONS-R1` | OK | Visual OK | OP Latex #27 / OP 9/2026 in production shows short, separate `Finalizar OP` and `Movimentar` buttons; does not show `Confirmar entrada / iniciar acabamento`. | Closed. | None. |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | OK per test/harness | Failed | Pedido #13 has an open Tecelagem OP (OP 10/2026), but the Tecelagem hub crashes before showing `Aceitar OP`; the main card does not expose acceptance. | Reopen R2. | Fix the hub and validate `Aceitar OP` without accepting a real OP. |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | OK/partial via hub | Partial | The Pedido #14 movement modal is legible and does not squeeze `Itens envolvidos`; the stage hub cannot be validated in Tecelagem due to the crash. | Revalidate after R2. | Visual retest of the fixed hub. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | OK/absorbed by the hub | Partial / Reopen R2 | Main cards show `Abrir OP`; expedicoes show `Abrir expedicao`; links inside the Tecelagem hub are not validatable because the hub crashes. | Reopen together with the hub. | Visual retest of the fixed hub. |

Mandatory observations:

- Pedido #20 was completed previously in staging and must now appear as
  delivered/completed. Do not use Pedido #20 as a draft/eligible Pedido.
- Pedido #21 was only inspected as an eligible Pedido; no click on
  `Concluir pedido` was executed.
- No new Pedido was created; no real OP was accepted; no transfer was
  saved; no New OP was saved.
- A static search found `disabled: ready ? null : 'disabled'` in
  `js/screens/expedicao-admin.js:361`. The served Pedido Detail, however, does
  not contain the old pattern and did not render `disabled="null"` in the
  audited cases.

Tests/diagnostics from this audit:

| Type | Result |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 147/147 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

### 9.7 Real R2 of the stage hub - 2026-07-05

Phase: `RAVATEX-TAPETES-PEDIDO-STAGE-HUB-R2-REAL-STAGING`

Status: **OK** for the reopened hub items.

Reason for R2: the real visual audit of `2026-07-05` reopened the hub
because Pedido #13, Tecelagem stage, broke on the dot/`Aguardar` click with:

`TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'`

Stack observed in the real browser: `js/ui.js:19` ->
`js/screens/pedido-detail-events.js:1726` -> `buildStageDetailBody` ->
`openStageDetailModal`.

Diagnosis:

| Campo | Resultado |
|---|---|
| Reproduction Pedido | Pedido #13 |
| Stage | Tecelagem |
| Related OP | OP 10/2026, type `tecelagem`, status `aberta` |
| Invalid value | Plain object `summary.docBanner` (`{ tone, text }`) |
| Root cause | The hub passed the whole object as a child of `window.el(...)`; the real DOM tried to attach the object via `appendChild`. |
| Why the earlier test did not catch it | The runtime harness accepted invalid children and flattened lists more permissively than `js/ui.js`. |

Fix applied:

- `js/screens/pedido-detail-events.js`: `docBannerRow(...)` converts the
  documentation banner into valid text/Node before calling `window.el(...)`.
- `tests/pedido-detail.smoke.js`: the runtime harness now rejects a plain
  object in `appendChild`, mimicking the real DOM, and includes a case
  equivalent to Pedido #13/Tecelagem/Aguardar.

Real post-fix validation:

| Clique | Resultado |
|---|---|
| `Ver detalhes da etapa TECELAGEM` | Hub opens without error; shows OP 10/2026, `Abrir OP`, `Aceitar OP`, reason, and `Sem movimentacao para acabamento registrada ainda`. |
| `Movimentar Tecelagem -> Acabamento` / `Aguardar` | Hub opens with the same content, no error in the console/pageerror. |

Post-R2 classification:

| Item | Status |
|---|---|
| `PEDIDO-STAGE-ACTION-HUB-B` | Closed |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | Closed |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | Closed |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | Closed |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | Closed for the validated hub |

Tests/diagnostics:

| Type | Result |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 148/148 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node --test tests\expedicao-flow.smoke.js` | OK, 8/8 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

Confirmations: production `bhgifjrfagkzubpyqpew` untouched; no SQL, no
migration, no new real data, no real OP accepted, no real Pedido completed,
no real transfer, no parallel write on the Pedido, and no change to the
Acabamento -> Expedicao flow or OP lifecycle.

Backlog note: the reopened hub items are zeroed out in this R2. The general
Admin/Pedido backlog must not be declared zeroed out without addressing or
explicitly removing from scope the static residue `disabled: ready ? null :
'disabled'` in `js/screens/expedicao-admin.js:361`.
# Update 2026-07-06 - Pedido/OP Controlled Delete B

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`
Status: **TECHNICAL PATCH READY - AWAITING USER VISUAL/TECHNICAL VALIDATION**

Technical patch for cleaning up validation data in the test environment:
`db/34_controlled_delete_pedido_op.sql` creates diagnostics and transactional
removal; `js/delete-helpers.js` concentrates the visual flow and prevents
direct delete in screens.

Current policy: delete Pedido/OP without entrega/expedicao; require
`EXCLUIR` when there are non-blocking OP/dependencies; block entrega,
expedicao, and child OP; do not alter `op_numeros`, do not renumber OPs, and
do not recycle numbers. Production future: strong password/admin,
soft-delete, and permanent audit trail.

Backlog residual:

| Item | Priority | Description |
|---|---|---|
| `DELETE-PROD-GUARD-A` | P1 future | Replace the temporary physical delete with a production flow using admin password, soft-delete, and permanent audit trail before releasing to production. |
| `DELETE-AUDIT-LOG-A` | P2 future | Log requester, approved impact, and final result in an auditable trail. |
## Update 2026-07-06 - Controlled Delete Policy Fix C

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`

- In staging/test, the controlled physical deletion needs to override the
  future policy of `db/26` that blocked any numbered OP.
- `db/34_controlled_delete_pedido_op.sql` removes the trigger/function
  `ops_numeradas_no_delete` to allow a numbered OP without real blockers.
- Future production must still return to an audited policy: soft-delete,
  permanent trail and strong authorization before any real deletion.
- `op_numeros` remains high-water; do not reduce, do not recycle and do not
  renumber OPs.

## Update 2026-07-06 - Controlled Delete Cascade Test D

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`

- Staging/test now accepts controlled physical cascade for Pedido/OP with
  delivery and child OP, provided there is no Expedição.
- The confirmation becomes `EXCLUIR TUDO` for the productive cascade.
- Expedição remains a blocker at this stage.
- Production backlog remains open: replace physical cascade with soft-delete,
  permanent audit and strong authorization.

## Update 2026-07-06 - Controlled Delete FK Order Fix E

Phase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`

- `db/36_controlled_delete_fk_order_fix.sql` fixes the physical order of the
  test cascade: `op_latex_entregas` -> `entrega_itens` by `op_id`/`op_item_id`
  -> empty deliveries -> verification of zero `entrega_itens` -> child OPs ->
  root OPs -> lotes/pedido.
- Delivery guards return `OLD` on authorized DELETE so as not to silently
  cancel the removal.
- Real synthetic test in staging validated Pedido #29, OPs 45/46 and delivery
  21 removed by the RPC with `EXCLUIR TUDO`, without altering `op_numeros`.
- Production backlog continues: replace physical deletion with an audited
  flow, strong authorization and a permanent policy before any production use.

## Update 2026-07-15 - Controlled Delete Document Link Guard: CLOSED / ACCEPTED

Phase `RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B` (+ `-GRANTS-54`,
`-POLICY-CAST-55`, `-DIAGNOSTICS-NULL-SAFE-56`). Technical commit
`707a37bd1d2c4728ab2a17433b6441049bd88062`.

- Original defect: physical deletion of an OP referenced by canonical
  documentation history (`document_link_revisions` / `document_link_revision_
  ops`) failed with a raw FK violation (`document_link_revision_ops_op_id_
  fkey`).
- `db/53` adds a documentation guard via wrappers that block physical
  deletion when canonical history exists, fully preserving the previous
  destructive logic (renamed `*_pre53`, no public API). `db/54`
  fixes an emergency ACL (`anon` had `EXECUTE`). `db/55` fixes a
  polymorphic cast. `db/56` fixes a diagnostic that collapsed to `NULL` on
  eligible targets.
- Validated in staging `ucrjtfswnfdlxwtmxnoo`: eligible OP/Pedido with real
  dependency (no documentation history) remain removable; OP/
  Pedido with documentation history are blocked in a controlled way, without
  FK exception and without partial mutation; documentation history preserved
  in 100% of cases; `op_numeros` unchanged; synthetic fixtures with cleanup
  zero.
- **Status: `CLOSED / ACCEPTED`** for the specific documentation guard.
  This does not close the general production backlog of this section: `DELETE-PROD-GUARD-A`
  (replace the temporary physical deletion with a production flow with admin
  password, soft-delete and permanent audit) and `DELETE-AUDIT-LOG-A` (auditable
  trail of requester/impact/result) remain `P1 future` /
  `P2 future`, not started.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; no push. See
  `docs/ledgers/G28_LEDGER.md` for complete evidence.

## Update 2026-07-15 - Admin Pedido Static Residue: CLOSED / ACCEPTED

Phase `RAVATEX-TAPETES-ADMIN-PEDIDO-STATIC-RESIDUE-A`. Technical commit
`7978e0a4fe021467cc23e0aeed63ac87ba738f1b` -- `Fix admin order completion
button state`.

- Item closed: `ADMIN-PEDIDO-STATIC-RESIDUE`, identified by the visual
  audit of `2026-07-05` (SS9.6/9.7 above) and reconfirmed as the only item
  still open in the Admin/Pedido/Production backlog in the read-only
  reconciliation of `2026-07-15`.
- Original defect: `js/screens/expedicao-admin.js:405` (`buildConclusao`)
  built `disabled: ready ? null : 'disabled'`. The shared helper
  `el()` (`js/ui.js:10-22`) calls `setAttribute(k, v)` for every attribute
  without omitting `null` (unlike the handling of children, which skips
  `null`/`false`); the real DOM materialized this as `disabled="null"` --
  boolean attribute present -- disabling the "Concluir pedido" button on the
  Expedicao Admin screen even when `ready === true`.
- Single occurrence in the repository (confirmed by `git grep`); no other
  screen reproduced the same pattern.
- Fix located entirely at the call site: `buttonAttrs` came to be
  built as a variable before the `return`; the `disabled` key only enters the
  object when `!ready`, never as `null`. `onclick`, text, styles and
  button structure preserved without semantic change; the guard
  `if (!ready) return;` inside `onclick` was kept. The global helper
  `js/ui.js` was not changed.
- Regression test: `tests/expedicao-flow.smoke.js` gained a new
  static test that forbids the original pattern, forbids the inverted variant
  (`disabled: !ready ? 'disabled' : null`) and requires the correct conditional
  pattern.
- Local tests: `node --check js/screens/expedicao-admin.js` PASS;
  `tests/expedicao-flow.smoke.js` **9/9**; `tests/expedicao-partial-flow.smoke.js`
  **12/12** (no regression); `git diff --check` PASS.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; staging not accessed; no
  push.
- **Status: `CLOSED / ACCEPTED`** for this specific static residue. The
  Admin/Pedido block reconciled by the `2026-07-05` audit (SS9.6/9.7)
  no longer has any known open item. This does not close the general
  production backlog, does not constitute publication, is not production
  readiness, does not accept G28-D and does not conclude
  `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`,
  `DELETE-PROD-GUARD-A`, `DELETE-AUDIT-LOG-A`, `G28-CAMADA-2`, `G28-CAMADA-3`
  or `G28-CAMADA-4`, which remain unchanged.
- See `docs/ledgers/G28_LEDGER.md` for complete evidence.

# Update 2026-07-15 - Cliente Order Summary Read Model Staging Validation

Phase `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`. No technical commit --
the phase did not change files (verification-only). Documentation closeout.

- Objective: apply `db/30_cliente_pedido_summary_readmodel.sql` in staging
  (`ucrjtfswnfdlxwtmxnoo`) only if not yet applied, and validate the contract
  of the public read model `public.cliente_pedido_summary(uuid)` consumed by
  `js/screens/cliente-pedido-detail.js` (~line 180).
- Central finding: `db/30` **was already applied**. The function exists with
  signature `cliente_pedido_summary(p_pedido_id uuid)`, `RETURNS jsonb`,
  `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner `postgres`; the body
  (`pg_get_functiondef`) is byte-for-byte equivalent to `db/30` (they only differ
  in line endings CRLF vs LF) -- **no drift**. The 16 dependency tables exist.
  Mode changed to `VERIFICATION-ONLY`; nothing was reapplied.
- Provenance: `db/30` **not registered** in
  `supabase_migrations.schema_migrations` (object exists without a history row).
- Live ACL: `EXECUTE` granted to `PUBLIC`, `anon`, `authenticated` and
  `service_role`; `db/30` intends only `authenticated`. Divergence retained
  as hygiene debt (not normalized in this closeout).
- Empirical behavior (read-only, each RPC in `BEGIN ... ROLLBACK`, zero
  mutation): owner cliente `ok=true` (complete DTO); `anon` on the same Pedido
  `ok=false` **fail-closed** (executes, no data -- no confirmed exposure);
  cross-tenant `ok=false`; admin `ok=true`.
- Contract with the frontend: all consumed fields present and typed;
  empty collections `[]` (COALESCE); nulls (`tipo_recebimento`, `observacao`)
  handled; `loadingError` branches outside the happy path -- no dependency on
  silent fallback.
- Portal validation level: `STATIC_CONTRACT_WITH_REAL_RPC_PAYLOAD`. Authenticated
  browser smoke not executed (no test cliente password) -- non-blocking
  debt.
- Local gates: `node --check js/screens/cliente-pedido-detail.js` PASS;
  `git diff --check` clean; `git status --short` empty.
- Access: Supabase MCP not exposed in the session; authorized direct
  PostgreSQL fallback used only for verification; temporary tooling outside the repo
  removed; no secret echoed. Production (`bhgifjrfagkzubpyqpew`) not
  accessed; no push.
- **Status: `CLOSED / ACCEPTED_WITH_NONBLOCKING_DEBTS`.** Debts:
  `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` (anon fail-closed, no confirmed
  exposure), `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`,
  `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`.
- Remediation candidate (not authorized, not started):
  `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` -- `ARCHITECT DECISION
  REQUIRED`; intended scope = grants-only migration analogous to `db/54`
  (`REVOKE EXECUTE ... FROM PUBLIC, anon`, preserving `authenticated`).
- Next authorizable action: `ARCHITECT DECISION REQUIRED AFTER BACKLOG
  RECONCILIATION`; the ACL candidate must not be auto-selected. Does not close
  the general backlog, is not publication, is not production readiness and
  does not accept G28-D.
- See `docs/ledgers/G28_LEDGER.md` for complete evidence.

# Update 2026-07-15 - Docs Canonical Consistency Backfill A: CLOSED / ACCEPTED

Phase `DOCS-CANONICAL-CONSISTENCY-BACKFILL-A`. Docs-only; no code, test,
SQL, migration, staging or production changed.

- Closes three documentation gaps confirmed in the read-only reconciliation of
  `2026-07-15`: (1) `db/37_controlled_delete_expedicao_cascade.sql` without its own
  `D-DEL` entry (now `D-DEL14` in
  `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` SS10); (2) `db/34`-`db/37`
  and `db/53`-`db/56` missing from `docs/DOCUMENTATION_INDEX.md` SS4; (3) status
  of `db/30` in the same index still described as "not yet applied",
  diverging from the closeout `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`
  above (applied and verified in staging since before this reconciliation).
- No historical entry of this backlog was rewritten; the gap
  remains recorded as it occurred, with the documentation correction attached
  as a new append/update section.
- Technical and environmental debts remain open and unchanged:
  `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` (`ARCHITECT DECISION
  REQUIRED`), `DB30_NOT_RECORDED_IN_SUPABASE_MIGRATION_HISTORY`, the debts
  of authenticated smoke (G28-C/D/B7/Client Portal),
  `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`, `DELETE-PROD-
  GUARD-A`, `DELETE-AUDIT-LOG-A`, G28-D and all the G28-CAMADA-2/3/4 fronts.
- Next material action follows `ARCHITECT DECISION REQUIRED`
  (`DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE`). This backfill
  does not authorize any subsequent technical phase.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; no push. See
  `docs/ledgers/G28_LEDGER.md` for the append-only entry of this phase.

# Update 2026-07-15 - Staging-Only Execution Boundary A: ARCHITECT DECISION RECORDED

Phase `STAGING-ONLY-EXECUTION-BOUNDARY-A`. Docs-only; no code, test, SQL,
migration, Supabase, staging, production or Vercel accessed/changed.

- Binding architect decision: the current operational environment is
  exclusively staging `ucrjtfswnfdlxwtmxnoo`; the protected/other Supabase
  project is out of scope; production schema migration/promotion is
  postponed until the canonical backlog is
  complete; production publication mapping is not required for the
  current work in staging; G28-D publication remains postponed,
  not authorized and does not constitute a current blocker; publication
  provider (incl. Vercel) not selected -- future candidate only.
- `DEPLOYMENT_MAPPING_AND_PRODUCTION_MIGRATION_PROCEDURE` is no longer
  recorded as a current material blocker or a required next architect
  decision; reclassified as `DEFERRED BY ARCHITECT UNTIL
  GLOBAL BACKLOG COMPLETION / NOT A CURRENT STAGING BLOCKER / NOT
  STARTED`. It was not discovered, defined, tested or completed --
  only intentionally postponed.
- Next staging-only technical candidate (not started, not authorized
  by this record): `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1` --
  `READY FOR EXPLICIT ARCHITECT AUTHORIZATION`. Reason: the documentation
  backfill is closed; the staging-vs-production scope ambiguity
  was resolved by this decision; the live ACL in staging remains
  broader than the canonical contract (`D-COS02`); anonymous behavior
  is fail-closed with no confirmed exposure; the remediation continues to be a
  separate grants-only migration (analogous to `db/54`); this record does not
  authorize nor create that migration.
- No historical entry of this backlog was rewritten; the
  previous items describing `DEPLOYMENT_MAPPING_AND_PRODUCTION_
  MIGRATION_PROCEDURE` as a material gate remain recorded as
  they occurred, with this section attached as a correction/update of
  the current state.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; protected Supabase not
  accessed; Vercel not accessed; no push. See `docs/ledgers/G28_LEDGER.md`
  for the append-only entry of this decision.

# Update 2026-07-15 - Cliente Order Summary ACL Grants R1: CLOSED / ACCEPTED

Phase `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`. Technical commit
`82f5ba70ace2e74c51b7c0295d1ecf8e319954be` -- `Restrict client order summary
RPC grants`. Documentation commit: this closeout (`Close client order summary
RPC grant hardening`).

- Closes the technical candidate recorded in the previous section
  (`STAGING-ONLY-EXECUTION-BOUNDARY-A`, "Next staging-only technical
  candidate"), which listed `CLIENTE-ORDER-SUMMARY-READMODEL-ACL-GRANTS-R1`
  as `READY FOR EXPLICIT ARCHITECT AUTHORIZATION`. That entry remains
  recorded as it occurred at that moment; this section replaces the current state
  of the item, which leaves the open/ready backlog.
- Migration `db/57_cliente_pedido_summary_acl_grants.sql` --
  grants-only, forward-only, idempotent -- created, applied exactly once via
  Supabase MCP (tracked migration operation) and verified in staging
  `ucrjtfswnfdlxwtmxnoo`; record `20260715190627 /
  57_cliente_pedido_summary_acl_grants` confirmed in the catalog.
- Final ACL: `PUBLIC` without `EXECUTE`; `anon` without `EXECUTE`; `authenticated`
  with `EXECUTE`; `service_role` without explicit `EXECUTE` (no real consumer
  found in the full repository search). Owner `postgres`
  retains inherent privilege. Function contract (signature, return
  `jsonb`, `SECURITY DEFINER`, `STABLE`, `search_path=public`, owner,
  body) remains byte-for-byte unchanged.
- Empirical matrix (staging, read-only, `BEGIN ... ROLLBACK`, no
  fixtures): `anon` rejected at the ACL boundary (`42501 permission denied`)
  before execution; `authenticated` owner `ok=true`; `authenticated`
  cross-tenant `ok=false` fail-closed; `authenticated` admin `ok=true`;
  `service_role` via direct `SET ROLE` also rejected (`rolbypassrls` of
  RLS is a distinct mechanism from function `EXECUTE`).
- `js/screens/cliente-pedido-detail.js` remains the only real consumer,
  standard authenticated path; no frontend change necessary.
- Local tests: `tests/cliente-pedido-summary-acl-grants.smoke.js` (new)
  + `tests/cliente-pedido-summary-readmodel.smoke.js` (existing) --
  **21/21 PASS**; `git diff --check` clean. No data mutation.
- Debt closed: `ACL_GRANTS_BROADER_THAN_CANONICAL_CONTRACT` --
  `RESOLVED IN STAGING`.
- Debts preserved as open: `DB30_NOT_RECORDED_IN_SUPABASE_
  MIGRATION_HISTORY` (no history record fabricated or repaired
  for `db/30`); `AUTHENTICATED_BROWSER_SMOKE_NOT_EXECUTED`; production
  application of the staging-only stack (incl. `db/57`) remains postponed by
  `STAGING-ONLY-EXECUTION-BOUNDARY-A`; `DEPLOYMENT_MAPPING_AND_
  PRODUCTION_MIGRATION_PROCEDURE` remains deferred.
- Not automatically selected by this closeout: production/deployment,
  G28-D, Vercel, repair of `db/30` migration history, authenticated
  browser smoke, Controlled Delete production guard.
- Reconciliation of the remaining backlog after removing this item: no
  other single, unambiguous technical candidate was identified in this
  documentation pass.
  `NEXT_AUTHORIZABLE_ACTION: NONE`. `ARCHITECT_DECISION_REQUIRED:`
  explicit reconciliation of the remaining general backlog (production,
  authenticated smoke, `db/30` history, or a new front) requires an architect
  decision; none was auto-selected.
- Production (`bhgifjrfagkzubpyqpew`) not accessed; Vercel not accessed; no
  push. See `docs/ledgers/G28_LEDGER.md` for the append-only entry of this
  phase.
