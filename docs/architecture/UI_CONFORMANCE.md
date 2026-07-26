# VISUAL CONFORMANCE — INTTRACKER

> Layer 4 of the contract. Screen → archetype → state → fixture.
> **State is filled by the detector, not by eye.**
>
> **Status: PHASE-4 DETECTOR IMPLEMENTED / BASELINE GENERATED / AWAITING ARCHITECT
> ACCEPTANCE.** Every state below is now a mechanical read of
> `tests/fixtures/ui-conformance-baseline.json` — see § Detector provenance for the
> exact rule. Nothing was remediated: phase 4 measures, phase 5 fixes, and phase 5 is
> not authorized.
>
> **Read the three states literally.** `conforming` means the detector evaluated
> every rule and found no blocking finding. `deviation` means it found one.
> `unaudited` means it could **not** decide — either the file is not in this
> repository, or a construct in it could not be decoded. A coverage gap is the
> opposite of a pass and is never counted as one. One conforming screen does not
> ratify an archetype — see § Archetype ratification.
>
> **Forward correction of the classification recorded at `2641a44`.** That commit
> already read `conforming`, and it was premature on three counts: the fixture booted
> its React runtime from a public CDN and therefore rendered a **blank page** with no
> internet access; its status pill kept a borderless `padding: 3px 9px` construction
> instead of §2.6's `height: 18px` bordered form; and its document count badge used a
> literal `font-size: 10px`, below the §5 type-enum floor of `10.5px`. All three are
> corrected. The earlier text is not rewritten — this note supersedes it. The
> classification now rests on four satisfied preconditions: a local offline runtime,
> the canonical status pill, count typography inside the enum, and semantic-radius
> validation (D6.1), with a complete four-image visual-evidence set held outside the
> repository. Phase 3 itself is **not** accepted; that remains the architect's call.

**Generation** (to size effort — see `DESIGN_DECISIONS.md`):
`G1` legacy generic · rebuild — `G2` minimalist with vibrant colour · mechanical pass
— `G3` compact · reference — `SGAA` already retokenised.

**State:** `conforming` · `deviation` (list which) · `rebuild` · `unaudited`

---

## Detector provenance

| Fact | Value |
|---|---|
| Detector | `scripts/validate-ui-conformance.mjs` v1.0.0 |
| Enum source | `UI_VISUAL_CONTRACT.md` §5, block at line 319 |
| §5 blob hash | `f8349e6eeca291fef2edf4d6e30afd628732f00b6495d54eb9273860fa63f1c4` |
| Baseline | `tests/fixtures/ui-conformance-baseline.json`, blob `7591394` |
| Determinism | three consecutive regenerations produced the identical blob |

**The state rule, applied without discretion.** `conforming` ⇔ zero blocking findings
**and** `FULL` coverage. `deviation` ⇔ at least one blocking finding. `unaudited` ⇔
resolution or coverage is incomplete. No row below was set by looking at a screen.

**Two source classes, one rule set.** The prototype front-end reads `.dc.html`; the
application front-end reads `js/screens/*.js`. 67 files were scanned: 28 `FULL`, 39
`PARTIAL`, 0 `UNSUPPORTED`. 3971 findings — 3027 blocking, 323 declared debt, 621
coverage gaps.

**Baseline by rule.** UIC-001 literal colour 2785 · UIC-002 radius 97 · UIC-003
control height 13 (+9 gaps) · UIC-004 shadow 21 (+21 gaps) · UIC-005 typography 80 ·
UIC-006 native `<select>` 15 · UIC-007 pill radius on a button **0** · UIC-008 card
action alignment 0 (+37 gaps) · UIC-009 deprecated token 323 (debt) · UIC-010
semantic-radius misuse 16 (+2 gaps) · UIC-011 unknown token **0**. Cards carrying a
shadow: **0**.

**One disclosed precision limit.** 834 of the 2785 colour findings sit outside any
decoded style declaration or colour attribute — colours held in local variables,
colour maps and ternaries, plus SVG presentation attributes. Each is reported with
that context so phase 5 confirms the site before retokenising. One is a confirmed
false positive: `js/screens/cliente-pedido-form.js:206` matches `#8431` inside the
pt-BR placeholder `Ex.: Pedido #8431`. It is **not** suppressed — this phase may not
create a waiver or ignore-list mechanism — it is disclosed here.

### Editing rule — this file is a detector input

> **Do not put a screen table under, or after, an `## Archetype` heading unless its
> rows are that archetype's screens.** `scripts/ui-conformance/inventory.mjs` reads the
> `## Archetype A`–`F` sections to build the prototype inventory, and it bounds each
> archetype block at the **next archetype heading**, not at the next `##` heading of
> any kind. So any 3-or-more-column table placed after `## Archetype F` is read as
> Archetype-F rows.
>
> That is why § Application surface and § Table review sit **above** § Archetype A
> rather than next to the sections they belong beside. Writing the application table
> after Archetype F registered all 66 application files a second time, as archetype F,
> and doubled the scan to 7942 findings. The layout above avoids it; the reader should
> still be hardened to bound at `^## ` so the correctness does not depend on section
> order. That correction is **disclosed, not applied** — `inventory.mjs` shipped in
> this phase's commit 1 and this phase authorizes exactly two commits with no amend,
> so it belongs to the next order. Nothing in the baseline below is affected: the
> published baseline and every count in it were produced with the sections in the
> layout this file now has.

---

## Application surface — `js/screens/*.js`

The tables above are **prototypes**. This is the product, and it is where phase 5
actually runs. 25 of the 26 rows above resolve to nothing in this repository; all 66
rows below resolve to a tracked file, so this is the larger half of the audit and it
had no Layer-4 record until the detector produced one.

**No archetype is assigned.** The contract maps prototypes to archetypes; it has never
mapped an application module to one. Assigning archetypes here is an architect
decision, not a detector output.

**Read `conforming` here with care.** 25 of the 66 files are write, data, helper or
routing modules that declare **no visual value at all**. They are `conforming` because
the rule says zero blocking findings plus `FULL` coverage, and they satisfy it by
absence, not by design. They are marked `— no visual declaration` and are not
evidence that any screen is canonical.

Totals: **25 conforming** (all by absence), **38 deviation**, **3 unaudited**.

| Screen | State | Coverage | Blocking | Debt | Gaps |
|---|---|---|---|---|---|
| `admin-usuarios-audit-panel.js` | deviation | PARTIAL | 23 | 0 | 3 |
| `admin-usuarios-modal.js` | deviation | PARTIAL | 53 | 0 | 11 |
| `admin-usuarios.js` | deviation | PARTIAL | 61 | 0 | 19 |
| `cadastros.js` | deviation | PARTIAL | 394 | 0 | 54 |
| `cliente-common.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-dashboard.js` | deviation | PARTIAL | 88 | 0 | 24 |
| `cliente-pedido-detail.js` | deviation | PARTIAL | 146 | 0 | 18 |
| `cliente-pedido-form.js` | deviation | PARTIAL | 187 | 0 | 13 |
| `cliente-pedido-tracking.js` | deviation | PARTIAL | 58 | 0 | 14 |
| `cliente-pedidos-list.js` | deviation | PARTIAL | 56 | 0 | 14 |
| `cliente-route-read.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-route-sections-ui.js` | deviation | PARTIAL | 10 | 0 | 4 |
| `common.js` | deviation | PARTIAL | 24 | 0 | 6 |
| `document-link-admin-modal.js` | deviation | PARTIAL | 4 | 0 | 1 |
| `documentos-recebidos-decision-modal.js` | deviation | PARTIAL | 4 | 0 | 3 |
| `documentos-recebidos-queue-ui.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `documentos-recebidos.js` | deviation | PARTIAL | 190 | 0 | 51 |
| `entrega-form.js` | deviation | PARTIAL | 21 | 0 | 14 |
| `entrega-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `expedicao-admin.js` | deviation | PARTIAL | 88 | 0 | 22 |
| `fornecedor.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `manta-expedicao-ui.js` | deviation | PARTIAL | 56 | 0 | 18 |
| `manta-movimento-form.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `manta-output-form.js` | deviation | PARTIAL | 23 | 0 | 10 |
| `manta-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-compra-regime.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-distribuicao-ui.js` | deviation | PARTIAL | 29 | 0 | 9 |
| `op-form-helpers.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-latex-admin.js` | deviation | PARTIAL | 106 | 121 | 47 |
| `op-nova.js` | deviation | PARTIAL | 194 | 55 | 52 |
| `op-pdf.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-persistir.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-recalculo.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-tecelagem-producao-admin.js` | deviation | PARTIAL | 61 | 95 | 44 |
| `op-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ops-list.js` | deviation | PARTIAL | 68 | 0 | 8 |
| `ordem-compra-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-distribuicao.js` | deviation | PARTIAL | 4 | 0 | 3 |
| `ordem-compra-events.js` | unaudited | PARTIAL | 0 | 2 | 1 |
| `ordem-compra-receipt-cutover.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-events.js` | unaudited | PARTIAL | 0 | 5 | 2 |
| `ordem-compra-receipt-render.js` | deviation | PARTIAL | 3 | 33 | 6 |
| `ordem-compra-render.js` | deviation | PARTIAL | 15 | 12 | 4 |
| `ordem-compra.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordens-compra-list.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `painel.js` | deviation | PARTIAL | 104 | 0 | 7 |
| `pedido-chain-state.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-events.js` | deviation | PARTIAL | 301 | 0 | 32 |
| `pedido-detail-progress.js` | deviation | FULL | 18 | 0 | 0 |
| `pedido-detail-render.js` | deviation | PARTIAL | 324 | 0 | 44 |
| `pedido-detail.js` | deviation | PARTIAL | 14 | 0 | 1 |
| `pedido-edit.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-form.js` | deviation | PARTIAL | 93 | 0 | 16 |
| `pedido-insumos-distribuicao.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-item-row-editor.js` | deviation | PARTIAL | 29 | 0 | 8 |
| `pedido-itens-edit.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-numero-sugestao.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-parciais-admin.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-route-sections-ui.js` | deviation | PARTIAL | 6 | 0 | 4 |
| `pedido-route-sections.js` | deviation | FULL | 5 | 0 | 0 |
| `pedido-tracking-admin.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedidos-list.js` | deviation | PARTIAL | 105 | 0 | 11 |
| `system-screens.js` | deviation | PARTIAL | 31 | 0 | 12 |
| `trocar-senha-obrigatoria.js` | deviation | PARTIAL | 31 | 0 | 10 |

**Why 39 files are `PARTIAL`.** The application builds the DOM imperatively, so a
style value is often a ternary, a concatenation or a template substitution whose
running value is undecidable from source; card membership has no static ancestor
chain; and no module marks a `data-card-actions` row. Each of those emits an explicit
coverage gap. `PARTIAL` is a statement about the detector's reach, not a partial pass.

**Zero `UNSUPPORTED`.** Every one of the 66 files lexed completely. Had any failed,
the file would report zero rules evaluated — never zero defects.

## Table review — the one manual pass

Eight tables were inventoried. **None** is machine-proven and none is machine-failed:
all eight are `MANUAL_REVIEW_REQUIRED`, which is what §2.5's golden rule always
implied. Pass 8 stays manual, exactly as `ARCHITECT_BRIEF.md` §7 predicted.

| File | Lines | Why manual |
|---|---|---|
| `docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html` | 140, 168, 195 | No `<colgroup>` and no shared `grid-template-columns`; header/value width parity is not machine-provable. |
| `js/screens/ordem-compra-receipt-render.js` | 138, 156, 226 | Built imperatively; header and value widths share no declared relationship. |
| `js/screens/ordem-compra-render.js` | 137, 270 | Built imperatively; same reason. |

The detector reports `AUTOMATICALLY_PROVEN` only when a `<colgroup>` column count
matches the header cell count, and `AUTOMATICALLY_FAILED` when they contradict each
other. It never reports a pass it cannot demonstrate — including for the reference
fixture, whose three tables are as unproven as the application's.

## Archetype A — Detail cockpit

| Screen | Generation | State | Note |
|---|---|---|---|
| `docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html` | G3 | **fixture** · conforming | **Detector-asserted, `FULL` coverage, zero findings of any severity** — the only file in the repository with that result. Geometry **and** value reference. Loads `css/tokens.css`, 0 literal colours, radius ∈ {`--rv-radius`, `--rv-radius-pill`} scoped by D6.1, heights ∈ the 32/34/38 ladder, cards flat, in-card action row marked `data-card-actions`, status pill per §2.6, every font size inside the §5 enum, 0 deprecated and 0 unknown token references. Renders offline: its React runtime is versioned at `docs/ui/fixtures/vendor/react-18.3.1/`. Guarded by `tests/ui-op-detail-compacto-fixture.test.mjs` (36 tests) **and** now by the general detector. Its 3 tables are `MANUAL_REVIEW_REQUIRED` — see § Table review. |
| `OP Acabamento - Aberta.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate second screen for archetype A; it cannot be audited until it is versioned here. |
| `Admin - Detalhe da OP.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Native `<select>` (D8) was recorded by eye, not by the detector. |
| `Admin - Detalhe da OP (Acabamento).dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Native `<select>` (D8), recorded by eye. |
| `Admin - Detalhe do Pedido.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Native `<select>` (D8), recorded by eye. |
| `Fase B - Tela da OP - Config ON.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Fase B - Tela da OP - Config OFF.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Fase B - Tela da OP - OFF e ON.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Comparison view — may not be a product screen. |
| `Fase B - Ordens na Tela da OP.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Fase B2 - Detalhe da Ordem de Compra.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Native `<select>` (D8), recorded by eye. |

## Archetype B — Work queue

| Screen | Generation | State | Note |
|---|---|---|---|
| `Admin - Lista de OPs.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate fixture. |
| `Admin - Lista de Pedidos.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Admin - Documentos.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** No cockpit — picks the layout review needs. |
| `Admin - Fornecedores.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Cliente - Lista de Pedidos.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** A queue, but under archetype E's content restriction. |

## Archetype C — Creation form

| Screen | Generation | State | Note |
|---|---|---|---|
| `Novo Pedido.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate fixture. |
| `Admin - Nova OP.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Native `<select>` (D8), recorded by eye. |

## Archetype D — Decision modal

| Screen | Generation | State | Note |
|---|---|---|---|
| `Modal Movimentar Produção.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate fixture. |
| `Modal Adicionar Item.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** |

## Archetype E — Client portal

| Screen | Generation | State | Note |
|---|---|---|---|
| `Detalhe do Pedido v2.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate fixture. |
| `Detalhe do Pedido.dc.html` | G2 | unaudited | **UNRESOLVED — not present in this worktree.** Prior disposition, recorded by eye and preserved: superseded by v2, rebuild or retire. That is a disposition, not a detector state. |
| `Dashboard Cliente.dc.html` | G2 | unaudited | **UNRESOLVED — not present in this worktree.** |
| `Acompanhamento B2B.dc.html` | **G2** | unaudited | **UNRESOLVED — not present in this worktree.** Prior finding, recorded by eye and preserved: `#2563eb` in ~20 places, a 4th popover shadow, its own stepper — furthest screen from canonical. The detector could not confirm it, so the state is `unaudited`, not `deviation`. |

## Archetype F — Configuration

| Screen | Generation | State | Note |
|---|---|---|---|
| `Admin - Parâmetros.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Candidate fixture. |
| `Admin - Cores.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Consumes the 7 alert presets + free colour. |
| `Admin - Login.dc.html` | unaudited | unaudited | **UNRESOLVED — not present in this worktree.** Brand signature point (teal rule). |

## Outside the archetypes — chrome and documentation

| File | Role |
|---|---|
| `Admin - Sidebar.dc.html` · `Admin - Topbar.dc.html` | Shell pieces, not screens. |
| `PainelAdmin.dc.html` | Unaudited; classify. |
| `Inttex - Identidade Visual.dc.html` | **SGAA** · brand documentation. |
| `docs/ui/evidence/ui-consolidation/Reconciliação de Tokens.dc.html` | **SGAA** · round-1 documentation. Evidence, never runtime. |
| `Setas de transicao - referencia.html` | Internal reference. |
| `*-standalone.html` · `*-bundle-ready.html` · `*-print-*` | Export derivatives. **Do not audit or hand-edit** — regenerate from source after the passes. |

---

## Execution order — by property batch

One pass per property across **all** screens, in this order. A pass closes when the
detector reports zero for its rule. Never screen by screen.

| # | Pass | Change | Verification |
|---|---|---|---|
| 1 | Token | literal hex → `var(--rv-*)` | detector: 0 literals |
| 2 | Colour | `#2563eb` / `#14509E` / `#0A326D` → `--rv-brand` / `--rv-accent-blue`; text → 4 levels | detector: 0 out-of-enum colours |
| 3 | Radius | all → `4px`; pills → `999px` | detector: radius ∈ {4px, 999px} |
| 4 | Height | controls → 32 / 34 / 38 | detector: height ∈ enum |
| 5 | Shadow | 4 popover values → 1; cards flat | detector: shadow ∈ enum |
| 6 | Alignment | in-card action → right-aligned footer | detector rule 8 |
| 7 | Popover | native `<select>` → own popover | detector: 0 `<select>` |
| 8 | Tables | header width/alignment identical to values | **manual review** |

Passes 1–7 are mechanical and verifiable. Pass 8 is the only one that needs eyes.
Do not open a pass while the previous one is still failing.

**None of these passes is closed.** Phase 3 applied passes 1–6 to the **reference
fixture alone**, so that the detector has a green baseline instead of flagging the
reference first. That is a single-file exception granted precisely because the
reference cannot be remediated by batch — it is what the batch is measured against.
Every pass still has to run across all screens in phase 5, and a pass closes only
when the phase-4 detector reports zero for its rule repository-wide. The fixture's
conformance is **not** precedent for remediating any other screen individually.

**Each pass now has a number and a command.** `--rule` scopes enforcement to one
property without hiding the rest of the baseline, which is exactly the batch discipline
this table demands:

| # | Rule | Baseline blocking | Close with |
|---|---|---|---|
| 1–2 | `UIC-001` | 2785 | `node scripts/validate-ui-conformance.mjs --rule UIC-001 --enforce` |
| 3 | `UIC-002`, `UIC-010` | 97 + 16 | `--rule UIC-002 --enforce`, then `--rule UIC-010 --enforce` |
| 4 | `UIC-003` | 13 (+9 gaps) | `--rule UIC-003 --enforce` |
| 5 | `UIC-004` | 21 (+21 gaps) | `--rule UIC-004 --enforce` |
| 6 | `UIC-008` | 0 (+37 gaps) | `--rule UIC-008 --enforce` — the gaps must close first |
| 7 | `UIC-006` | 15 | `--rule UIC-006 --enforce` |
| 8 | — | — | manual; the detector only inventories the eight tables |
| type | `UIC-005` | 80 | `--rule UIC-005 --enforce` |
| alias deletion | `UIC-009` | 323 (debt) | `--rule UIC-009` reporting 0 unblocks deleting the aliases |

`UIC-007` (pill radius on a button) and `UIC-011` (unknown token) are already at zero
repository-wide. **A coverage gap must be closed before its rule can close.** Pass 6
cannot be declared clean while 37 screens cannot even be evaluated for it; the honest
first step is marking the action rows, not reporting zero.

---

## Versioned fixture provenance

The external intake contained `OP Detail - Compacto copy.dc.html`. Its SHA-256 was
identical to the primary fixture
(`852cd0e7631dfe1622bbf520885533a9036144f5029e9e37bc9aa7dd2034dd26`), so it was not
promoted. Only the primary fixture is the versioned reference.

Versioning two byte-identical files would have created a second citable precedent for
archetype A while adding no information — and two copies of the fixture is how the
third visual generation started. The copy remains in the external intake package,
untouched; it is not a precedent and must not be cited as one.

One `support.js` is versioned, at `docs/ui/fixtures/op-detail-compacto/support.js`.
The evidence document loads that same instance. It is fixture infrastructure only:
no product bundle, no application file and no `index.html` entry may reference it.

### Vendored fixture runtime — immutable third-party assets

`support.js` boots with `loadReactUmd().then(init)`. While that runtime came from a
public CDN the fixture rendered a blank page whenever the origin was unreachable, so
the reference only existed with internet access. React **18.3.1** and ReactDOM
**18.3.1** (MIT) are therefore versioned at
`docs/ui/fixtures/vendor/react-18.3.1/`, promoted byte-for-byte from the official npm
packages, and loaded before `support.js`, which short-circuits when the globals are
already present. `support.js` itself was not modified. Custody — package, version,
license, registry integrity, per-file digests and byte counts — is recorded in
`docs/ui/fixtures/vendor/react-18.3.1/README.md`, and the digests also reproduce the
Subresource Integrity values `support.js` already pinned for the CDN copies, which is
independent proof nothing was substituted or rebuilt.

They are **immutable third-party fixture runtime assets**: not project-authored
source, exempt from the `CODE_HEALTH_RULES.md` §7 size thresholds, never edited, never
imported by the product runtime, and no precedent for minified code as project source,
for further vendored dependencies or for a version upgrade. Changing the versions
requires a separate explicit order.

## Archetype ratification

`CANDIDATE` → `RATIFIED` when **two** screens of that archetype pass the detector with
no deviation. Until then the archetype may not be cited as precedent for a new screen.
Record the ratification in `DESIGN_DECISIONS.md`.

**Archetype A is NOT ratified, and phase 4 does not ratify it.** The detector now
exists and has run, so one of the two missing preconditions is satisfied. The other is
not: ratification needs **two** screens of the archetype passing the detector, and
exactly **one** does — `OP Detail - Compacto.dc.html`. The candidate second screen,
`OP Acabamento - Aberta.dc.html`, is not present in this worktree and therefore cannot
be audited at all.

Archetypes B–F remain `CANDIDATE`. Every one of their candidate fixtures is
`UNRESOLVED`, so none has a single detector-passing screen, let alone two.

**No archetype is `RATIFICATION_ELIGIBLE`.** That marker is recorded only when two
screens of one archetype appear eligible. No archetype reaches two. Nothing here
requires an architect ruling on ratification; what it requires is a decision on how
the external prototypes reach this repository, since 25 of the 26 conformance rows
cannot be audited until they do.

**No archetype was ratified automatically, and none may be cited as precedent.**
