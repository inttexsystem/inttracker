# VISUAL CONFORMANCE — INTTRACKER

> Layer 4 of the contract. Screen → archetype → state → fixture.
> **State is filled by the detector, not by eye.**
>
> **Status: PHASE-5 PASS 8 AS CORRECTED BY A1 — THE §2.5 TABLE CONTRACT CLOSED OVER
> THE ACCEPTED 41-SURFACE RUNTIME POPULATION, WITH EVERY APPLICABLE OBLIGATION
> EVALUATED PER CLAUSE RATHER THAN PER PRIMARY DISPOSITION / PUBLISHED / AWAITING
> ARCHITECT ACCEPTANCE.** Passes 1-8 have closed `UIC-001`, `UIC-002`, `UIC-003`, `UIC-004`,
> `UIC-005`, `UIC-006`, `UIC-008` and `UIC-010` — **every blocking conformance rule
> is closed** — and pass 8 has now closed the table property, which no rule can
> observe. The aggregate counts under § Detector provenance are a mechanical read of
> `tests/fixtures/ui-conformance-baseline.json`. **The per-screen state column below
> has not been re-derived since pass 2** and is stale for passes 3-8; it is a separate
> documentary concern and no pass so far has been authorized to rewrite it.
>
> **Pass 7 — `CLOSED / ACCEPTED_WITH_NONBLOCKING_VISUAL_EVIDENCE_LIMITATION`,
> checkpoint `52af3c9e34d84472d2138b177b20876265f554f5`.** `UIC-006` is closed and
> stays closed over the 44-site population. The accepted nonblocking limitation is the
> absence of per-route screenshots: no authenticated route could be reached, so naming
> evidence is DOM-level reference integrity plus target text.
>
> **Pass 1 — `CLOSED / ACCEPTED_WITH_NONBLOCKING_PROCESS_DEBT`, checkpoint
> `cabd358c006f692b3aec37d21cf279ab1e81927a`.** `UIC-001` is closed and stays closed.
> The accepted nonblocking debt is `PROTECTED-RESIDUE-CONTENT-DISCLOSURE`: a protected
> path's contents were displayed during an entry gate. It caused no repository mutation.
> Future gates may inspect path, status and hash-equivalence metadata only.
>
> **Phase 4 — `CLOSED / ACCEPTED_WITH_NONBLOCKING_REPORT_SCHEMA_DEBT`, checkpoint
> `9fbb84c1613ffc24f994ad053c812d724bf1ade0`.** The report-schema debt it was accepted
> with — two highlight keys whose names described the pre-correction semantics while
> already carrying the corrected numbers — is **corrected forward in this pass**, not
> reopened: the keys are now `literal_visual_colours_blocking` and
> `literal_colour_context_unproven`, the predicates are unchanged, and the detector is
> `1.0.3`.
>
> **Passes 1-5 have run; the remaining passes are not authorized.** Pass 1 closed literal
> colour ownership (`UIC-001`) and is recorded in `DESIGN_DECISIONS.md` D9. Pass 2
> closed the two radius rules (`UIC-002` `RADIUS_OUTSIDE_ENUM` and `UIC-010`
> `SEMANTIC_PILL_RADIUS_MISUSE`) across all 66 application screens, with `UIC-007`
> held at zero throughout. It changed no token, no enum, no colour and no rule
> semantics.
>
> **Detector `1.0.3` — the one semantic change pass 2 made.** The js-screen front-end
> now transports a statically declared `'data-ui-pill'` attribute into an element's
> `attrMap`, exactly as the `.dc.html` front-end has always done from real markup.
> Without it a JavaScript screen could not state a role at all, so a count badge on a
> neutral surface was unprovable and D6.1 would have forced it to ordinary geometry.
> `isSemanticPill()` is unchanged; no dynamic expression is evaluated; no other role is
> inferred. Measured effect on the whole repository: six `UIC-010` findings removed,
> none added, no other rule touched.
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
| Detector | `scripts/validate-ui-conformance.mjs` v1.0.6 |
| Enum source | `UI_VISUAL_CONTRACT.md` §5, block at line 463 |
| §5 blob hash | `f8349e6eeca291fef2edf4d6e30afd628732f00b6495d54eb9273860fa63f1c4` |
| Baseline | `tests/fixtures/ui-conformance-baseline.json` |
| Determinism | independent regenerations produce a byte-identical blob |

**The state rule, applied without discretion.** `conforming` ⇔ zero blocking findings
**and** `FULL` coverage. `deviation` ⇔ at least one blocking finding. `unaudited` ⇔
resolution or coverage is incomplete. No row below was set by looking at a screen.

**Two source classes, one rule set.** The prototype front-end reads `.dc.html`; the
application front-end reads `js/screens/*.js`. 67 files were scanned: 31 `FULL`, 36
`PARTIAL`, 0 `UNSUPPORTED`. 867 findings — **0 blocking**, 322 declared debt, 545
coverage gaps.

**Baseline by rule.** UIC-001 literal colour **0** (+**0** gaps) · UIC-002 radius **0**
(+**0** gaps) · UIC-003 control height **0** (+**0** gaps) · UIC-004 shadow **0**
(+**0** gaps) · UIC-005 typography **0** (+**0** gaps) · UIC-006 native `<select>` **0** · UIC-007 pill
radius on a button **0** · UIC-008 card action alignment **0** (+**0** gaps) · UIC-009
deprecated token 322 (debt) · UIC-010 semantic-radius misuse **0** (+**0** gaps) ·
UIC-011 unknown token **0**. Cards carrying a shadow: **0**. Plus 545 front-end
decoding gaps under `UIC-000`.

**Pass 7 closed the last blocking rule.** `UIC-006` went 15 → **0**: every native
`<select>` on a product surface was replaced by the application-owned select popover
(`js/select-popover.js`), and `js/ui.js::selectInput()` became a thin adapter over it.
Six `UIC-000` gaps disappeared with them — each was an unresolved style expression
attached to a native select or to the facade wrapper around one — so the total moved
886 → **865** and coverage 549 → **543**. No detector source byte changed and no
finding was suppressed. **Every blocking rule is now closed.**

**Pass 8 closed the table property, which no rule can observe.** It added exactly two
`UIC-000` coverage gaps and removed none: both are the Cadastros » Parâmetros derived
width owner, whose track count depends on how many larguras exist and which the
detector therefore cannot decode to a concrete value. Total 865 → **867**, coverage
543 → **545**. Blocking stayed **0**, `UIC-009` debt stayed **322**, coverage `FULL`
31 / `PARTIAL` 36 / `UNSUPPORTED` 0 unchanged, and `table_review_summary` stayed at 8
`MANUAL_REVIEW_REQUIRED` — the five application tables now declare a `<colgroup>`, but
the js-screen front-end never reads one, so its verdict cannot move. Detector `1.0.6`
byte-identical; no rule added, no waiver, no suppression.

`UIC-008` closure covers the **explicitly marked** footer population — four product
rows — and not the absence of every possible unmarked footer in imperative runtime
code. That capability limit is the open debt `UI-ACTION-CONTAINER-CONTAINMENT-GAP`.

**Deltas against the pass-6 entry baseline** (`212972d`, blob `86ef82b` → `702c8a7`):
UIC-005 80 blocking → **0**. Measured semantically — rule, severity, path, property,
values, context and message, with line and column attribution ignored — the delta is
**exactly 80 findings removed and 0 added, all `UIC-005`**; every other rule multiset is
identical: UIC-000 549, UIC-001 0/0, UIC-002 0/0, UIC-003 0/0, UIC-004 0/0, UIC-006 15,
UIC-007 0, UIC-008 0/0, UIC-009 322 debt, UIC-010 0/0, UIC-011 0. Total 966 → **886**.
Coverage `FULL` 31, `PARTIAL` 36, `UNSUPPORTED` 0 — unchanged. Seven surviving
`UIC-009` findings moved COLUMN only, on their own unchanged lines, because a role token
is a longer string than the literal it replaced; that is location movement, not a
semantic change. The detector stays `1.0.6`; the contract hash moves
`f8349e6e` → `2a4fb0ef` because pass 6 was authorized to revise the `font_size` enum
from ten values to thirteen.

**Correction A1 — the numeric hierarchy.** Pass 6 routed every large operational number
to one role, `EMPHASISED_METRIC` at 15px. That was rejected: it erased three real levels.
`KPI_HERO` (`--rv-fs-kpi-hero`, 30px), `KPI_CARD` (`--rv-fs-kpi-card`, 24px) and
`SUMMARY_TOTAL` (`--rv-fs-summary-total`, 20px) are ratified, and the enum grows to
**fifteen** values. `SUMMARY_TOTAL` shares 20px with `SECTION_HEADING` and stays a
separate owner — a total is not a heading. The ten sites pass 6 collapsed are reconciled
as **1 hero · 1 card KPI · 5 summary totals · 3 compact metrics**; eight were
detector-visible and two live in an injected CSS string no rule reaches. A1 carries **no
detector delta at all**: 886 findings, zero semantic and zero location movement.

A1 also gave the shared `pageHeader()` primary action the typography and height it never
owned — it inherited the 16px document default and took a 40px height from `py-2`. It now
declares `--rv-fs-body` and `--rv-h-primary`, computing to **13px × 38px**, a real rung on
the ratified ladder. That is the only control-height movement A1 authorizes.

Typography is **role-based**, not nearest-number replacement. The revised enum admits
`30 · 24 · 22 · 20 · 16 · 15 · 14 · 13.5 · 13 · 12.5 · 12 · 11.5 · 11 · 10.5 · 10px`,
with 10px a hard floor. Three roles were ratified — `SECTION_HEADING` (`--rv-fs-section-heading`,
20px), `COMPONENT_HEADING` (`--rv-fs-component-heading`, 16px) and `MICRO_COPY`
(`--rv-fs-micro`, 10px) — plus a separate owner for an icon-only text glyph,
`--rv-icon-glyph-lg` (20px), which shares the `SECTION_HEADING` value but is neither a
heading nor body copy. `9px`, `14.5px`, `15.5px`, `18px`, `19px`, `21px`, `23px`, `24px`
and `30px` no longer exist in first-party rendered runtime.

`UIC-005` closure is **wider than the detector inventory**. The runtime ownership guard
in `tests/ui-conformance-phase5-pass6-typography.test.mjs` covers `index.html` and every
local asset it loads — 103 files, including `js/ui.js` and
`js/document-links-surface-ui.js`, which no detector rule reaches — and reports
`OUT_OF_ENUM_RUNTIME_FONT_SIZE_COUNT` **0**, `OUT_OF_ENUM_RUNTIME_FONT_WEIGHT_COUNT`
**0**, `TAILWIND_OUT_OF_ENUM_FONT_SIZE_UTILITY_COUNT` **0**,
`UNRESOLVED_RUNTIME_TYPOGRAPHY_COUNT` **0**, `FONT_SIZE_LITERAL_BELOW_10PX_COUNT` **0**
and `UNKNOWN_TYPOGRAPHY_TOKEN_COUNT` **0**.

**Deltas against the A2 entry baseline** (`2114191`, blob `6d8b305` → `058f0fd` → the
current blob): exactly **five findings added, none removed**, every one of them
`UIC-008` / `coverage` / `ACTION_ROW_UNPROVEN`, on `pedido-edit.js`,
`pedido-insumos-distribuicao.js`, `pedido-itens-edit.js`, `pedido-parciais-admin.js` and
`pedido-tracking-admin.js`. `UIC-008` coverage **37 → 42**; **no other rule moved at
all**. Blocking stays 111, debt stays 322, the inventory stays 66, `UNSUPPORTED` stays 0,
the detector stays `1.0.3` and the contract hash is unchanged. Coverage `FULL` 28 → **23**,
`PARTIAL` 39 → **44**. That movement is the *whole* delta and it is an observability
increase — see the A2 note under the screen table. `tests/ui-conformance-phase5-pass2-radius.test.mjs`
§21 pins it against `2114191` so a sixth gap, a different reason or any other rule
movement fails rather than passing as coverage noise.

**Deltas against the pass-2 entry baseline** (`cabd358`, blob `54ae97e` → `6d8b305`):
UIC-002 93 blocking → **0**; UIC-010 16 blocking + 2 gaps → **0 + 0**. **Every other
rule is byte-identical**: UIC-000 549, UIC-001 0, UIC-003 13 (+9), UIC-004 3 (+8),
UIC-005 80, UIC-006 15, UIC-007 0, UIC-008 0 (+37), UIC-009 322 debt, UIC-011 0.
Coverage `FULL` 28, `PARTIAL` 39, `UNSUPPORTED` 0 — all unchanged. **No rule increased
and nothing outside the radius property moved**, so pass 2 has no incidental decrease
to explain.

**Deltas against the phase-4 entry baseline** (`9fbb84c`, blob `4fb639f` → `9291ce6`),
recorded by pass 1 and kept for continuity: UIC-001 2013 blocking + 771 gaps → **0 + 0**.
Every other rule decreased or held: UIC-002 97 → 93, UIC-004 21 → 3 blocking and 21 → 8
gaps, UIC-009 323 → 322, UIC-000 552 → 549. UIC-003, UIC-005, UIC-006, UIC-008, UIC-010
unchanged. UIC-007 and UIC-011 stayed at zero. Coverage `FULL` 27 → 28, `PARTIAL`
40 → 39, `UNSUPPORTED` 0. **No rule increased.** The decreases outside UIC-001 are
incidental — a card shadow or a radius that disappeared with the literal that carried
it — and were not chased.

### UIC-002 and UIC-010 — closed

The closed enum is `[4px, 999px]`, spelled `var(--rv-radius)` and `var(--rv-radius-pill)`.
Pass 2 resolved **107 detector-visible sites** across 26 screens and, because the
front-end cannot decode an interpolated or concatenated style string, a further **28
detector-invisible sites** in the same files and in three screens added to the boundary
by the A1 amendment (`painel.js`, `op-distribuicao-ui.js`, `ordem-compra-render.js`).
A full source scan of all 66 screens now finds **zero** out-of-enum radius declarations,
so closure does not rest on detector visibility alone.

| Role | Treatment | Sites |
|---|---|---|
| Ordinary surface or control — cards, panels, fields, buttons, chips, alerts, meter tracks, elongated bars, switch tracks | `var(--rv-radius)` | 62 |
| Semantic pill — count and classification badges | `var(--rv-radius-pill)` + a static `data-ui-pill` role marker | 8 |
| True circle — dots, avatars, swatches, medallions, step circles, knobs, rings | `var(--rv-radius-pill)`, with equal declared width and height | 53 |
| Partial-corner or child geometry | canonical radius on the owning parent plus `overflow:hidden`, redundant child radius removed | 21 |

**No literal survives as a fallback, and no alias was introduced.** The pre-existing
`4px` literals are inside the enum and were left alone; the `--rv-radius-card` and
`--rv-radius-control` aliases resolve to `var(--rv-radius)` and remain **UIC-009 debt**,
which pass 2 was not authorized to remediate. A button is never a pill: `UIC-007` held
at zero from entry to close, and 117 buttons rendered at 1440×900 measured `0px` or
`4px` computed radius, none pill.

**Residual, disclosed at pass 2 — closed by A2.** Thirteen screens carried **97 Tailwind
utility classes** (`rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`)
that rendered radii outside the enum — `rounded-full` renders ≥ 20px. They were utility
classes, not CSS radius declarations, so neither the detector nor pass 2's source scan
treated them as radius sites, and Tailwind was in practice a **second application-radius
owner** that no metric could see. **A2 removed all 97**, across all 13 screens:
`TAILWIND_RADIUS_UTILITY_COUNT` and `TAILWIND_RADIUS_UTILITY_FILE_COUNT` are both **0**
over all 66 screens, guarded by §20 of the pass-2 focused suite, which also proves itself
non-vacuous against every utility spelling. The two named radius constants in
`pedido-detail-events.js` — `MOVEMENT_MODAL_RADIUS` `'6px'` and `MOVEMENT_SURFACE_RADIUS`
`'4px'` — were canonicalized to `var(--rv-radius)`, so a constant holds a token and never
a literal. **`css/tokens.css` is now the only radius owner inside `js/screens/`.**

**A3 — the shared runtime, and why `js/screens/` was never the surface.** The radius
property is evaluated over the **rendered first-party product surface**, not over the
detector's file inventory. `js/ui.js` is the shared control factory: it manufactures every
`toast`, `modal`, `textInput`, `selectInput` and `dataTable` in the application and renders
on every route, while sitting outside all 66 inventoried screens. Measured in the live
runtime at 1440 × 900 immediately after A2, seven form controls still rendered at **8px**.
No rule, no `--enforce` gate and no "all 66 screens" scan could ever have reached them.

**A3 closed it.** A complete pre-write inventory of the whole first-party runtime — all
100 local scripts `index.html` loads, plus `css/tokens.css`, `css/responsive.css` and
`index.html` itself — found **11** Tailwind radius utilities across **3** shared files and
**2** out-of-enum declarations in two more. All 13 sites were treated: eight in `js/ui.js`
(toast, modal card, modal cancel, modal save, `textInput`, `selectInput`, `dataTable`
wrapper, `pageHeader` action button) → `var(--rv-radius)`; three classification badges in
`js/badges.js` and `js/pedido-ui.js` → `var(--rv-radius)`, **preserving their exact 4px
geometry**; the floating import button in `js/documents-ingestor-import-ui.js`, `6px` →
`var(--rv-radius)`; and the 9 × 9 timeline dot in `js/document-links-surface-ui.js`, a
**true circle**, `50%` → `var(--rv-radius-pill)`. Both stylesheets and `index.html` hold
**zero** `border-radius` declarations and zero utilities — they never were radius owners.

`TAILWIND_RADIUS_UTILITY_COUNT_IN_PRODUCT_RUNTIME`, its file count,
`OUT_OF_ENUM_RUNTIME_RADIUS_COUNT` and `OUT_OF_ENUM_RUNTIME_RADIUS_CONSTANT_COUNT` are all
**0**, guarded by §22 of the pass-2 focused suite over every script the application really
loads. **`css/tokens.css` is now the single application-radius owner.** The detector
baseline is **byte-identical**: A3 changed no finding, no summary and no screen
classification, because none of these files is in the 66-file inventory.

**Three radii remain in the runtime and are deliberately excluded.** `js/environment-banner.js`
(×2) and `js/supabase-client.js` (×1) carry `border-radius:3px` inside DevTools
`console.%c` format strings. They never reach the DOM, and a CSS custom property does not
resolve in console styling, so rewriting them would break the styling rather than
canonicalize it. The guard excludes them by paren-balanced `console.*(…)` detection — never
by path and never by an ignore list — and asserts that exact set of three, so the exclusion
cannot quietly widen.

**A4 — the three shared badge constructors, closed.** A3 left `badgeTipo`, `badgeStatus`
and `pedidoStatusBadge` at ordinary 4px and recorded the question as open. It was not
open: the architect ruled that `badgeStatus` and `pedidoStatusBadge` are **lifecycle
status pills** and `badgeTipo` is a **neutral OP-type classification badge**. All three
now delegate to the canonical badge owner in `js/badges.js`:

| Helper | Delegates to | Result |
|---|---|---|
| `badgeStatus(status)` | `rvStatusPill(OP_STATUS_LABEL[status] \|\| status, status)` | canonical pill, ruled family, 5px dot |
| `pedidoStatusBadge(status)` | `window.rvStatusPill(pedidoStatusLabel(status), status)` | canonical pill, ruled family, 5px dot |
| `badgeTipo(tipo)` | `rvClassificationBadge(OP_TIPO_LABEL[tipo] \|\| tipo)` | canonical pill, neutral, **no dot** |

`Látex` is deliberately **not** routed through `rvStageBadge` — it is an OP *type*, not the
contract's `acabamento` stage key, so it takes the neutral classification badge and carries
its meaning in the label rather than in a per-type indigo or amber treatment.

**No local map decides rendering any more.** `OP_STATUS_BADGE`, `OP_TIPO_BADGE`,
`PEDIDO_STATUS_BADGE` and `pedidoStatusBadgeClass()` are retained **byte-identical** for
their existing compatibility consumers, but no rendered constructor reads them, no new
consumer was added and no new family map was created. Public names and call signatures are
unchanged, so none of the six screen call sites was edited.

Measured in the live runtime at 1440 × 900, DPR 1, cold and warm: every badge resolves to
`999px` at **18px** height; every lifecycle status carries exactly **one 5 × 5** dot and
every classification badge **none**; families resolve `simulada` neutral, `aberta` info,
`em_producao` caution, `finalizada` positive, `rascunho` neutral, `recebido` positive,
`confirmado` neutral, `produzindo` caution (through the accepted `em producao` alias),
`entregue` positive, `cancelado` negative, both OP types neutral, and any unknown value
neutral rather than an invented family. **The pass-2 semantic-pill property is now closed
across both the 66 screens and the shared runtime.**

### UIC-001 — closed

A hex or functional colour form is **not** a defect because of how it looks. It is a
defect only where the front-end can prove it is a visual value. The three-state model
accepted at phase 4 is unchanged:

| Outcome | When | Severity |
|---|---|---|
| Proven visual | a decoded CSS declaration; a style expression bound to a CSS property; a colour-bearing HTML/SVG attribute (`fill`, `stroke`, `color`, `stop-color`, …); a JavaScript key that is a colour-valued CSS property or ends in `-color`/`Color`; `setAttribute` on such an attribute | **blocking** |
| Proven non-visual | copy and labels; a `placeholder`, `title`, `alt`, `label`, `href`, `class` or other non-visual attribute or key; markup text content; a text child of `el()`; a route fragment or identifier; a comment; a regular-expression literal | **no finding** |
| Neither proven | a bare variable initialiser, an ambiguous map key such as `bg`, an array element, a call argument, an undecodable attribute | **coverage** — `COVERAGE_GAP / VISUAL_COLOUR_CONTEXT_UNPROVEN` |

**Counts: 0 proven visual, 0 unproven, 0 total.** The 771 unproven sites were **not**
waived and the rule was **not** narrowed — reaching zero on `--enforce` alone would have
left them, which is why the pass was not declared closed until the coverage count also
reached zero. Each was resolved by removing the literal: into a token, into
`js/badges.js`, or into `js/pedido-ui.js`. There is still no path, line or value
suppression anywhere in the detector.

**Where the 2,784 sites went.** 2,267 mapped onto tokens that already existed. The other
517 had no owner and were hard-stopped for an architect ruling before any write; D9
supplied the owners and they were then resolved:

| Group | Sites | Resolution |
|---|---|---|
| Status / type / route chips | 270 | `js/badges.js` — §2.6 mapping, §2.6.1 neutral classifications |
| Product-colour swatch data | 113 | `js/pedido-ui.js` — 17-entry business palette |
| Caution surfaces | 58 | `--rv-signal-caution-bg` / `-border`, §2.1 Caution variant |
| Progress / track / series | 26 | `--rv-viz-*` |
| Stage vs status | 18 | stage badges; acabamento orange → teal |
| Synthetic illustration | 17 | retired; real swatches or an honest empty state |
| Modal scrim / tint | 10 | `--rv-overlay-scrim` |
| Disabled state | 4 | §2.1 opacity `.45` |
| Text on a signal surface | 1 | `--rv-text-on-signal` |

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

**Read `conforming` here with care.** 22 of the 66 files are write, data, helper or
routing modules that declare **no visual value at all**. They are `conforming` because
the rule says zero blocking findings plus `FULL` coverage, and they satisfy it by
absence, not by design. They are marked `— no visual declaration` and are not
evidence that any screen is canonical.

Totals: **22 conforming** (all by absence), **25 deviation**, **19 unaudited**.

The nineteen `unaudited` files have **zero** blocking findings but incomplete coverage —
their remaining findings are declared debt or front-end decoding gaps. They are not
clean; they are unmeasured. Six moved into this state during pass 1 because the only
blocking findings they carried were literal colours, and **six more moved during pass 2**
because the only blocking findings they carried were radius:
`admin-usuarios-audit-panel.js`, `cliente-route-sections-ui.js`, `entrega-form.js`,
`manta-output-form.js`, `ordem-compra-receipt-render.js`, `pedido-route-sections-ui.js`.
**Five more moved during A2** — `pedido-edit.js`, `pedido-insumos-distribuicao.js`,
`pedido-itens-edit.js`, `pedido-parciais-admin.js`, `pedido-tracking-admin.js` — for a
different reason, recorded below. No file moved the other way.

**A2 — five screens stopped being `conforming` by absence.** Those five held their whole
geometry in Tailwind class tokens, so `declaration_sites` was **0** and the detector had
nothing to evaluate. `FULL` there never meant conforming; it meant invisible. A2 moved
that geometry into canonical declarations, the five now declare between 6 and 16 visual
values each, and each honestly produces the one property that still cannot be evaluated:
a single `UIC-008` `ACTION_ROW_UNPROVEN` coverage gap. **This is an increase in
observability, not a product, detector or radius regression.** No blocking finding
appeared, no rule other than `UIC-008` moved, and the geometry they now declare is
inside the closed enum.

**`conforming` still means conforming by absence.** All 22 declare **no visual value at
all** (`declaration_sites: 0`) — they are write, data, helper or routing modules. Closing
UIC-001 and then the two radius rules did **not** make any screen conforming by design:
every screen that declares visual values and still deviates carries at least one blocking
finding from native `<select>`. Height (pass 3), shadow (pass 4), card action alignment
(pass 5) and typography (pass 6) have since run and are closed; `UIC-006` is the only
blocking rule left. The per-screen rows below are **not** re-derived by this pass — no
order has authorized that — so a row may still show a blocking count that predates a
later pass's closure. The aggregate figures above and the detector are the current
owners of that number.

| Screen | State | Coverage | Blocking | Debt | Gaps |
|---|---|---|---|---|---|
| `admin-usuarios-audit-panel.js` | unaudited | PARTIAL | 0 | 0 | 3 |
| `admin-usuarios-modal.js` | deviation | PARTIAL | 7 | 0 | 11 |
| `admin-usuarios.js` | deviation | PARTIAL | 2 | 0 | 17 |
| `cadastros.js` | deviation | PARTIAL | 12 | 0 | 51 |
| `cliente-common.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-dashboard.js` | deviation | PARTIAL | 6 | 0 | 24 |
| `cliente-pedido-detail.js` | deviation | PARTIAL | 2 | 0 | 18 |
| `cliente-pedido-form.js` | deviation | PARTIAL | 11 | 0 | 9 |
| `cliente-pedido-tracking.js` | deviation | PARTIAL | 2 | 0 | 14 |
| `cliente-pedidos-list.js` | deviation | PARTIAL | 2 | 0 | 14 |
| `cliente-route-read.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `cliente-route-sections-ui.js` | unaudited | PARTIAL | 0 | 0 | 4 |
| `common.js` | deviation | PARTIAL | 3 | 0 | 6 |
| `document-link-admin-modal.js` | deviation | PARTIAL | 1 | 0 | 1 |
| `documentos-recebidos-decision-modal.js` | deviation | PARTIAL | 1 | 0 | 3 |
| `documentos-recebidos-queue-ui.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `documentos-recebidos.js` | deviation | PARTIAL | 7 | 0 | 51 |
| `entrega-form.js` | unaudited | PARTIAL | 0 | 0 | 13 |
| `entrega-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `expedicao-admin.js` | deviation | PARTIAL | 8 | 0 | 22 |
| `fornecedor.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `manta-expedicao-ui.js` | deviation | PARTIAL | 3 | 0 | 18 |
| `manta-movimento-form.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `manta-output-form.js` | unaudited | PARTIAL | 0 | 0 | 9 |
| `manta-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-compra-regime.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-distribuicao-ui.js` | unaudited | PARTIAL | 0 | 0 | 9 |
| `op-form-helpers.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-latex-admin.js` | deviation | PARTIAL | 2 | 121 | 47 |
| `op-nova.js` | deviation | PARTIAL | 4 | 54 | 52 |
| `op-pdf.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-persistir.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-recalculo.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `op-tecelagem-producao-admin.js` | deviation | PARTIAL | 1 | 95 | 44 |
| `op-writes.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ops-list.js` | deviation | PARTIAL | 2 | 0 | 8 |
| `ordem-compra-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-distribuicao.js` | unaudited | PARTIAL | 0 | 0 | 3 |
| `ordem-compra-events.js` | unaudited | PARTIAL | 0 | 2 | 1 |
| `ordem-compra-receipt-cutover.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordem-compra-receipt-events.js` | unaudited | PARTIAL | 0 | 5 | 2 |
| `ordem-compra-receipt-render.js` | unaudited | PARTIAL | 0 | 33 | 6 |
| `ordem-compra-render.js` | unaudited | PARTIAL | 0 | 12 | 4 |
| `ordem-compra.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `ordens-compra-list.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `painel.js` | unaudited | PARTIAL | 0 | 0 | 7 |
| `pedido-chain-state.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-data.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-events.js` | deviation | PARTIAL | 3 | 0 | 32 |
| `pedido-detail-progress.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-detail-render.js` | deviation | PARTIAL | 17 | 0 | 44 |
| `pedido-detail.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedido-edit.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedido-form.js` | deviation | PARTIAL | 8 | 0 | 9 |
| `pedido-insumos-distribuicao.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedido-item-row-editor.js` | deviation | PARTIAL | 2 | 0 | 8 |
| `pedido-itens-edit.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedido-numero-sugestao.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-parciais-admin.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedido-route-sections-ui.js` | unaudited | PARTIAL | 0 | 0 | 4 |
| `pedido-route-sections.js` | conforming — no visual declaration | FULL | 0 | 0 | 0 |
| `pedido-tracking-admin.js` | unaudited | PARTIAL | 0 | 0 | 1 |
| `pedidos-list.js` | deviation | PARTIAL | 3 | 0 | 11 |
| `system-screens.js` | deviation | PARTIAL | 1 | 0 | 12 |
| `trocar-senha-obrigatoria.js` | deviation | PARTIAL | 1 | 0 | 10 |

**Why 39 of the 66 application files are `PARTIAL`.** The application builds the DOM
imperatively, so a style value is often a ternary, a concatenation or a template
substitution whose running value is undecidable from source; a colour is often held in
a local variable or an ambiguously named map key; card membership has no static
ancestor chain; and no module marks a `data-card-actions` row. Each of those emits an
explicit coverage gap. `PARTIAL` is a statement about the detector's reach, not a
partial pass.

**Zero `UNSUPPORTED`.** Every one of the 66 files lexed completely. Had any failed,
the file would report zero rules evaluated — never zero defects.

## Table review — the one manual pass, now CLOSED

Eight tables are inventoried by the detector. **None** is machine-proven and none is
machine-failed: all eight remain `MANUAL_REVIEW_REQUIRED`, which is what §2.5's golden
rule always implied. Pass 8 was manual, exactly as `ARCHITECT_BRIEF.md` §7 predicted.

| File | Lines | Why still manual |
|---|---|---|
| `docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html` | 140, 168, 195 | No `<colgroup>` and no shared `grid-template-columns`; header/value width parity is not machine-provable. |
| `js/screens/ordem-compra-receipt-render.js` | 3 tables | Built imperatively. These now DO declare a `<colgroup>`, but the js-screen front-end never reads one, so its verdict cannot move. |
| `js/screens/ordem-compra-render.js` | 2 tables | Built imperatively; same reason. |

The detector reports `AUTOMATICALLY_PROVEN` only when a `<colgroup>` column count
matches the header cell count, and `AUTOMATICALLY_FAILED` when they contradict each
other. It never reports a pass it cannot demonstrate — including for the reference
fixture, whose three tables are as unproven as the application's.

### What pass 8 actually closed

**The detector's eight-table inventory is not the product surface.** Independent
verification found **41** reachable runtime table surfaces, and only five of them are
`<table>` elements the detector can even see:

| Category | Count | What it is |
|---|---|---|
| Direct semantic | **5** | `el('table')` in the two purchase-order render modules |
| Shared-helper instances | **5** | `dataTable()` call sites; the helper in `js/ui.js` is the owner and is counted apart |
| Simulated grids | **31** | CSS-Grid tables — a header row and value rows sharing one `grid-template-columns` |
| **Total** | **41** | |

Dispositions at entry, one primary per surface: `PROVEN_STRUCTURE_GAP` **10**,
`PROVEN_NUMERIC_ALIGNMENT_GAP` **16**, `PROVEN_OVERFLOW_GAP` **8**,
`MANUAL_VISUAL_EVIDENCE_REQUIRED` **1**, `STRUCTURALLY_CONFORMING` **6**.

`js/ui.js::dataTable()` is now the single width and numeric owner for its five
instances: one resolved layout list drives the `<colgroup>`, the header and the values,
`table-layout:fixed` is declared, alignment is repeated on `th` and `td`, and
`numeric: true` implies right/right plus `data-num` — the tabular-numeral owner in
`css/tokens.css`. Nothing infers numeric-ness from label text and nothing measures
content to choose a width.

Two defects were invisible to source reading and only a real read exposed them:
`op-tecelagem-producao-admin.js` gave eleven value cells `class:'num'`, for which **no
CSS rule exists anywhere** — right-aligned in source, never tabular in the browser; and
`op-latex-admin.js::thRow()` right-aligned the LAST header whatever its value cell did.
A third, `G05` Cadastros » Parâmetros, was only provable by rendering: its transposed
matrix hardcoded three tracks and wrapped onto an implicit second grid row past two
larguras.

**Ruled NOT numeric columns** (architect, pass-8 order §6): entity IDs, sequence
identifiers, CNPJ and lot/OP/Pedido numbers; dates and timestamps; editable numeric
`<input>`s; composite progress cells such as a bar with `45%` or `300 / 500`; and a
catalog width rendered as a badge.

Pass 8 raised `UIC-000` by exactly **two** coverage gaps — both the G05 derived
template, both `TEMPLATE_INTERPOLATED_VALUE` in `js/screens/cadastros.js` — and removed
none. Blocking stayed 0 and `UIC-009` debt stayed 322. The property is pinned by
`tests/ui-conformance-phase5-pass8-table.test.mjs` (53 tests), not by a rule.

### A1 — a primary disposition never suppresses an applicable obligation

Pass-8 R1 was published `CHANGES_REQUIRED`, not accepted. It filed one PRIMARY
disposition per surface and corrected only what that label named, so **nine surfaces
whose primary was numeric kept a fixed-pixel column with no local scroll owner** and
were nevertheless recorded as closed: `G07`, `G09`–`G11`, `G18`, `G20`–`G22`, `G28`.
The label is a reporting convenience, not an exemption.

All nine now own the canonical `data-rv-table-scroll` container from
`css/responsive.css` — which is **unchanged** — with the header and every data row
inside the SAME owner, and an explicit minimum derived from their real columns:

| Surface | Minimum | Surface | Minimum |
|---|---|---|---|
| `G07` Preços | 690px | `G18` OP Látex aberta | 550px |
| `G09` Parciais | 530px | `G20` Ordens de compra | 660px |
| `G10` Itens | 450px | `G21` Fios | 660px |
| `G11` Entregas | 450px | `G22` Metros de produção | 550px |
| `G28` Pendências | 480px | | |

`G09` declares **no** fixed-pixel column and is included deliberately: four `fr`
columns in a 390px viewport leave roughly 80px each. That is stated, not disguised
as an obligation the contract imposed.

**The guard no longer trusts a label.** The focused suite now carries an OBLIGATION
MATRIX over all 41 surfaces that evaluates every applicable clause independently —
fixed-px, overflow owner, numeric column, header and value alignment, numeral owner,
width-parity owner. It re-derives a `fixedPx: false` claim from the declared template
rather than accepting it, **fails if a primary-disposition field is ever reintroduced**
into the matrix, fails if the 26-surface fixed-px population collapses back to the
eight R1 corrected, and forbids the document itself being treated as a table's scroll
owner. A1 moved the detector by **zero** findings: 0 added, 0 removed.

**Still open, and not a table gap.** `js/screens/op-latex-admin.js` builds its page
cockpit without the `data-rv-cockpit` attribute, so the ≤1023px stacking rule never
applies there and `G18` renders inside a 45px column at 390px. The table scrolls
locally as required; the cockpit is a separate responsive-layout gap needing its own
order.

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
| 8 | Tables | header width/alignment identical to values | **manual review** — CLOSED over 41 surfaces |

Passes 1–7 are mechanical and verifiable. Pass 8 was the only one that needed eyes,
and it is now closed — by rendering, not by rule. Do not open a pass while the
previous one is still failing.

**Passes 1-8 are closed.** Phase 3 applied passes 1–6 to the **reference
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
| 1–2 | `UIC-001` | **CLOSED** — 0 (+0 gaps) | `node scripts/validate-ui-conformance.mjs --rule UIC-001 --enforce` exits 0 |
| 3 | `UIC-002`, `UIC-010` | 93 + 16 | `--rule UIC-002 --enforce`, then `--rule UIC-010 --enforce` |
| 4 | `UIC-003` | **CLOSED** — 0 (+0 gaps) | `--rule UIC-003 --enforce` exits 0 |
| 5 | `UIC-004` | **CLOSED** — 0 (+0 gaps) | `--rule UIC-004 --enforce` exits 0 |
| 6 | `UIC-008` | **CLOSED** — 0 (+0 gaps) | `--rule UIC-008 --enforce` exits 0 — marked rows only |
| 7 | `UIC-006` | **CLOSED** — 0 (+0 gaps) | `--rule UIC-006 --enforce` exits 0 |
| 8 | — | **CLOSED** — manual | the detector only inventories eight tables; the real population is 41 runtime surfaces, pinned by `tests/ui-conformance-phase5-pass8-table.test.mjs` |
| type | `UIC-005` | **CLOSED** — 0 (+0 gaps) | `--rule UIC-005 --enforce` exits 0 |
| alias deletion | `UIC-009` | 322 (debt) | `--rule UIC-009` reporting 0 unblocks deleting the aliases |

`UIC-007` (pill radius on a button) and `UIC-011` (unknown token) are at zero
repository-wide, and `UIC-001`, `UIC-002`, `UIC-003`, `UIC-004`, `UIC-005`, `UIC-008` and
`UIC-010` now join them. **A coverage gap must be closed before its rule can close.**
That standard was applied to `UIC-008`: its 42 `ACTION_ROW_UNPROVEN` gaps were resolved
before the rule was allowed to report zero, not reported around. `UIC-005` never carried
a coverage gap of its own, and pass 6 nonetheless proved the property over the whole
loaded runtime rather than over the detector inventory alone.
Pass 1 was held to exactly that standard: `--rule UIC-001 --enforce` reaching zero would
still have left 771 colour-shaped runs whose site the detector could not prove, so the
pass was not closed until those were resolved too and the coverage count also reached
zero.

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
