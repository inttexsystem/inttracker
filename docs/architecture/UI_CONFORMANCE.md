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
> **Phase 3 — `CLOSED / ACCEPTED`, checkpoint `ded162ec38f30ec7ddf0ab73988fa24bff93967e`.**
> The Archetype-A reference fixture's conformance is accepted. Accepted with the
> disclosure that the four screenshots were held outside the repository and were not
> independently inspected by the architect; published code and deterministic evidence
> were accepted. The classification rests on four satisfied preconditions — a local
> offline runtime, the canonical §2.6 status pill, count typography inside the §5 enum,
> and semantic-radius validation (D6.1) — and the general detector now confirms it
> independently, with zero findings of any severity.

**Generation** (to size effort — see `DESIGN_DECISIONS.md`):
`G1` legacy generic · rebuild — `G2` minimalist with vibrant colour · mechanical pass
— `G3` compact · reference — `SGAA` already retokenised.

**State:** `conforming` · `deviation` (list which) · `rebuild` · `unaudited`

---

## Detector provenance

| Fact | Value |
|---|---|
| Detector | `scripts/validate-ui-conformance.mjs` v1.0.1 |
| Enum source | `UI_VISUAL_CONTRACT.md` §5, block at line 319 |
| §5 blob hash | `f8349e6eeca291fef2edf4d6e30afd628732f00b6495d54eb9273860fa63f1c4` |
| Baseline | `tests/fixtures/ui-conformance-baseline.json` |
| Determinism | independent regenerations produce a byte-identical blob |

**The state rule, applied without discretion.** `conforming` ⇔ zero blocking findings
**and** `FULL` coverage. `deviation` ⇔ at least one blocking finding. `unaudited` ⇔
resolution or coverage is incomplete. No row below was set by looking at a screen.

**Two source classes, one rule set.** The prototype front-end reads `.dc.html`; the
application front-end reads `js/screens/*.js`. 67 files were scanned: 27 `FULL`, 40
`PARTIAL`, 0 `UNSUPPORTED`. 3970 findings — 2255 blocking, 323 declared debt, 1392
coverage gaps.

**Baseline by rule.** UIC-001 literal colour 2013 (+771 gaps) · UIC-002 radius 97 ·
UIC-003 control height 13 (+9 gaps) · UIC-004 shadow 21 (+21 gaps) · UIC-005
typography 80 · UIC-006 native `<select>` 15 · UIC-007 pill radius on a button **0** ·
UIC-008 card action alignment 0 (+37 gaps) · UIC-009 deprecated token 323 (debt) ·
UIC-010 semantic-radius misuse 16 (+2 gaps) · UIC-011 unknown token **0**. Cards
carrying a shadow: **0**. Plus 552 front-end decoding gaps under `UIC-000`.

### UIC-001 — a colour-shaped run is classified by syntax, in three states

A hex or functional colour form is **not** a defect because of how it looks. It is a
defect only where the front-end can prove it is a visual value. There are exactly
three outcomes, and the same value can reach any of them:

| Outcome | When | Severity |
|---|---|---|
| Proven visual | a decoded CSS declaration; a style expression bound to a CSS property; a colour-bearing HTML/SVG attribute (`fill`, `stroke`, `color`, `stop-color`, …); a JavaScript key that is a colour-valued CSS property or ends in `-color`/`Color`; `setAttribute` on such an attribute | **blocking** |
| Proven non-visual | copy and labels; a `placeholder`, `title`, `alt`, `label`, `href`, `class` or other non-visual attribute or key; markup text content; a text child of `el()`; a route fragment or identifier; a comment; a regular-expression literal | **no finding** |
| Neither proven | a bare variable initialiser, an ambiguous map key such as `bg`, an array element, a call argument, an undecodable attribute | **coverage** — `COVERAGE_GAP / VISUAL_COLOUR_CONTEXT_UNPROVEN` |

Counts: **2013** proven visual, **771** unproven, and one run proven non-visual.
An unproven run is **not** counted as a colour defect; it is work phase 5 must
classify before it can retokenise. There is no path, line or value suppression
anywhere in the detector — asserted textually and proved behaviourally, since the
identical value is blocking under `color:` and silent under `placeholder:`.

The 2013 proven-visual sites break down as 1570 decoded CSS declarations, 255
concatenated style expressions, 70 colour-bearing SVG attributes inside string
literals, 67 JavaScript colour keys, 32 style expressions and 19 `.style.*`
assignments.

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

Totals: **25 conforming** (all by absence), **36 deviation**, **5 unaudited**.

The five `unaudited` files have **zero** blocking findings but incomplete coverage —
every colour-shaped run in them is unproven, or their only findings are declared debt.
They are not clean; they are unmeasured. `ordem-compra-render.js` and
`pedido-detail-progress.js` moved from `deviation` to `unaudited` under the corrected
`UIC-001` semantics, which is the honest outcome: what looked like a proven colour
defect was a run the detector could not place.

| Screen | State | Coverage | Blocking | Debt | Gaps |
|---|---|---|---|---|---|
| `admin-usuarios-audit-panel.js` | deviation | PARTIAL | 22 | 0 | 4 |
| `admin-usuarios-modal.js` | deviation | PARTIAL | 53 | 0 | 11 |
| `admin-usuarios.js` | deviation | PARTIAL | 38 | 0 | 42 |
| `cadastros.js` | deviation | PARTIAL | 312 | 0 | 136 |
| `cliente-common.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-dashboard.js` | deviation | PARTIAL | 60 | 0 | 52 |
| `cliente-pedido-detail.js` | deviation | PARTIAL | 115 | 0 | 49 |
| `cliente-pedido-form.js` | deviation | PARTIAL | 179 | 0 | 20 |
| `cliente-pedido-tracking.js` | deviation | PARTIAL | 32 | 0 | 40 |
| `cliente-pedidos-list.js` | deviation | PARTIAL | 47 | 0 | 23 |
| `cliente-route-read.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-route-sections-ui.js` | deviation | PARTIAL | 4 | 0 | 10 |
| `common.js` | deviation | PARTIAL | 24 | 0 | 6 |
| `document-link-admin-modal.js` | deviation | PARTIAL | 1 | 0 | 4 |
| `documentos-recebidos-decision-modal.js` | deviation | PARTIAL | 1 | 0 | 6 |
| `documentos-recebidos-queue-ui.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `documentos-recebidos.js` | deviation | PARTIAL | 87 | 0 | 154 |
| `entrega-form.js` | deviation | PARTIAL | 17 | 0 | 18 |
| `entrega-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `expedicao-admin.js` | deviation | PARTIAL | 74 | 0 | 36 |
| `fornecedor.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `manta-expedicao-ui.js` | deviation | PARTIAL | 34 | 0 | 40 |
| `manta-movimento-form.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `manta-output-form.js` | deviation | PARTIAL | 19 | 0 | 14 |
| `manta-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-compra-regime.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-distribuicao-ui.js` | deviation | PARTIAL | 19 | 0 | 19 |
| `op-form-helpers.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-latex-admin.js` | deviation | PARTIAL | 69 | 121 | 84 |
| `op-nova.js` | deviation | PARTIAL | 138 | 55 | 108 |
| `op-pdf.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-persistir.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-recalculo.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-tecelagem-producao-admin.js` | deviation | PARTIAL | 46 | 95 | 59 |
| `op-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ops-list.js` | deviation | PARTIAL | 58 | 0 | 18 |
| `ordem-compra-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-distribuicao.js` | deviation | PARTIAL | 4 | 0 | 3 |
| `ordem-compra-events.js` | unaudited | PARTIAL | 0 | 2 | 1 |
| `ordem-compra-receipt-cutover.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-events.js` | unaudited | PARTIAL | 0 | 5 | 2 |
| `ordem-compra-receipt-render.js` | deviation | PARTIAL | 3 | 33 | 6 |
| `ordem-compra-render.js` | unaudited | PARTIAL | 0 | 12 | 19 |
| `ordem-compra.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordens-compra-list.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `painel.js` | deviation | PARTIAL | 8 | 0 | 103 |
| `pedido-chain-state.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-events.js` | deviation | PARTIAL | 267 | 0 | 66 |
| `pedido-detail-progress.js` | unaudited | PARTIAL | 0 | 0 | 18 |
| `pedido-detail-render.js` | deviation | PARTIAL | 263 | 0 | 105 |
| `pedido-detail.js` | deviation | PARTIAL | 14 | 0 | 1 |
| `pedido-edit.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-form.js` | deviation | PARTIAL | 88 | 0 | 21 |
| `pedido-insumos-distribuicao.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-item-row-editor.js` | deviation | PARTIAL | 19 | 0 | 18 |
| `pedido-itens-edit.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-numero-sugestao.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-parciais-admin.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-route-sections-ui.js` | deviation | PARTIAL | 2 | 0 | 8 |
| `pedido-route-sections.js` | deviation | FULL | 5 | 0 | 0 |
| `pedido-tracking-admin.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedidos-list.js` | deviation | PARTIAL | 77 | 0 | 39 |
| `system-screens.js` | deviation | PARTIAL | 31 | 0 | 12 |
| `trocar-senha-obrigatoria.js` | deviation | PARTIAL | 25 | 0 | 16 |

**Why 39 of the 66 application files are `PARTIAL`.** The application builds the DOM
imperatively, so a style value is often a ternary, a concatenation or a template
substitution whose running value is undecidable from source; a colour is often held in
a local variable or an ambiguously named map key; card membership has no static
ancestor chain; and no module marks a `data-card-actions` row. Each of those emits an
explicit coverage gap. `PARTIAL` is a statement about the detector's reach, not a
partial pass.

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
| 1–2 | `UIC-001` | 2013 (+771 gaps) | `node scripts/validate-ui-conformance.mjs --rule UIC-001 --enforce` |
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
first step is marking the action rows, not reporting zero. The same holds for pass 1:
`--rule UIC-001 --enforce` reaching zero would still leave **771** colour-shaped runs
whose site the detector could not prove, and those must be classified — by moving the
value into a declaration, a token or a clearly named key — not left unproven.

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
