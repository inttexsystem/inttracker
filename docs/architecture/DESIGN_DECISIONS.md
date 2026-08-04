# DESIGN DECISION LOG — INTTRACKER

> **Append-only.** Never rewrite an entry; add a later one that revokes it.
> This file holds the **why**. What is currently in force lives in
> `UI_VISUAL_CONTRACT.md`.

---

## 2026-07-25 · Round 1 — reconciling the three namespaces

**Context.** The product had three sources of visual truth: the `--rv-*` tokens
declared in contract v1 §4, the `inttex-ui` skill tokens, and the SGAA palette (real
code of the sibling product). They contradicted each other on the central facts, and
because of that no written rule could hold the line — each generation pass picked one
of the three.

**Finding that reoriented the round.** Contract v1 described the generation it was
supposed to replace. It fixed `--rv-color-accent: #2563eb` — the vibrant blue
inherited from the legacy system — and the approved fixture (`OP Detail - Compacto`)
**never used that value**. So the real conflict was never contract vs. SGAA; it was
contract vs. the approved screen. The contract's colour column was discarded whole.

**Root cause.** Contract v1 was written **before** an approved screen existed. It
encoded intent, not fact. v2 is extracted: colour and type from SGAA, geometry
measured in the fixture.

**Method.** Each fact has exactly one origin.
- colour, type, shape, shadow → SGAA;
- shell geometry, density, composition → measured in `OP Detail - Compacto`;
- stage badge, table divider, brand teal → product-specific vocabulary, declared as an
  addition (SGAA does not cover them).

**Evidence.** `evidence/Reconciliação de Tokens.dc.html` — 16 colour facts across the three
sources, all eight decisions rendered at real size in both options, measured geometry.

### Ratified decisions

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D1 | Card radius | **4px** | 6px never existed in app code — it came from the skill. 4px is the real `--radius`. One radius across the system makes the rule trivially checkable. | Cards a shade harder. Imperceptible at 2px. |
| D2 | Card border | **`#d4d8dd` outside, `#e5e8ec` inside** | `#e7eaee` gives 1.07:1 against `#f3f4f6` — with 8 stacked cards the eye loses the boundary. | A slightly more present edge. |
| D3 | Text levels | **4** (`#111827` on the H1 only) | SGAA has 3 because it has no 22px title. The fixture's 7 greys were drift, not hierarchy; 4 is the ceiling. | Two intermediate greys disappear. |
| D4 | Semantic tone | **two families with defined jobs** | Vivid for a bare signal (colour is the sole carrier of meaning); SGAA's muted tones inside a pill (background + border + dot already carry the state). | Two families to maintain — mitigated by written scope. |
| D5 | Control heights | **32 / 34 / 38** | Height carries the action hierarchy in the cockpit. Flattening everything to 32px would erase the difference between "Pausar" and "Transferir p/ acabamento" — the read that makes the screen work. SGAA's 32px becomes the compact rung. | Three values instead of one. Closed enum. |
| D6 | Pill radius | **999px** | Identical rendering; honest value (does not depend on element height). Zero cost. | None. |
| D7 | Positive button | **SGAA `status-positive`** | The three previous values (`#f2fbf5` / `#bfe6cd` / `#15803d`) came from the skill's `--success-btn-*` block and none existed in SGAA. The fill had 3% green chroma — reading as dirty white — against a ~4× more saturated border. | A more present green in the header. |
| D8 | Dropdown list | **own popover; native `<select>` forbidden** | `appearance:none` styles only the closed field; the open list is browser-drawn and accepts no padding, radius, shadow or item colour. No CSS fixes it. SGAA already specifies a popover. | A component to build and maintain. |

**Cross-cutting rule derived from D7** — larger than that one button: background,
border and text of a single element always come from the same status family.
Mismatched chroma between fill and border is the actual defect, and it repeated in the
negative and neutral variants.

**Alignment rule closed in this round.** An action inside a card goes in the block
footer, right-aligned, with `border-top` + `padding-top: 11px`; with an empty state,
text left and action right on the same row. Two exceptions and only two: the rail
(`width:100%`) and the dashed attach button (`width:100%`).

**Incidental consolidations.** Four different popover shadows coexisted (SGAA, skill,
`Acompanhamento B2B`, tokens) → one. Token prefix: `--rv-*` retained (screens already
reference it), with SGAA names and values plus a deprecated-alias block for
breakage-free migration.

### Structural decisions from the same round

**Four layers, one owning file each.** No value in two places. Reason: contract v1
mixed specification, phase governance and ratification records across 354 lines, of
which roughly 120 were specification. Anyone consulting it to design a screen could
not find the value.

**Prose is justification, never a source of value.** 354 lines of prose are 354
interpretation opportunities per session. Every mandatory value moved to `tokens.css`
or to the §5 enums.

**A reference is a file, not a description.** Every primitive and archetype points to
a versioned fixture. Descriptions drift; files do not.

**Archetypes replace the rule taxonomy.** v1 classified *rules*
(`GLOBAL` / `SCREEN-FAMILY` / `COMPONENT-SPECIFIC`); the real need was to classify
*screens*. That is why v1 needed footnotes in §5 and §11 stating where the cockpit
does not apply — a symptom of the wrong axis. Six archetypes, one per screen.

**Remediate by property batch, not by screen.** One pass per property across all
screens. Screen by screen, every screen becomes a fresh judgment call — and fresh
judgment calls are where the three visual generations came from.

**Generation labels**, to size the remediation effort:
- **G1 legacy generic** — rebuild; nothing to preserve;
- **G2 minimalist with vibrant colour** — the problem is *only* tokens + control
  height + radius; a mechanical pass, not a redesign;
- **G3 compact** — the reference (`OP Detail - Compacto`).

**Language convention confirmed.** All project documentation in English; all product
UI copy in pt-BR. The v2 documents were first drafted in pt-BR and rewritten in
English on the same day to match the convention.

### Revoked in this round

- Contract v1 in full (`G28-P0` / `G28-P0-R1`), replaced by v2.
- `--rv-color-accent: #2563eb` and the whole of v1 §4 colour block.
- `--radius-card: 6px` and `--radius-pill: 20px` from the skill.
- The skill's `--success-btn-*` block.
- Phase governance and "OPEN — REQUIRES IALEAD DECISION" inside the contract —
  migrated to this log.

### Still open

| Topic | State | Needs |
|---|---|---|
| Formal WCAG conformance target | open | product decision |
| Breakpoints and rail behaviour on narrow screens | open | decision + prototype |
| Exact modal dimensions and dismiss (ESC / outside click / scroll-lock) | open | modal design |
| Client-portal stepper → promote to a primitive | open | 2 conforming screens |
| Archetypes B–F → ratify | open | 2 screens each, through the detector |
| Where the detector runs (prototypes / app / both) | open | owner decision + repo access |
| Fate of `fixtures/OP Detail - Compacto copy.dc.html` | open | owner: variant or delete |
| Deleting the deprecated `--rv-color-*` aliases | open | detector reporting 0 uses |

---

## 2026-07-25 · D6.1 — what `--rv-radius-pill` owns

**Bounded clarification of D6. The original D6 entry above is not rewritten and its
value `999px` does not change.**

**Context.** Conforming the Archetype-A reference fixture exposed a gap D6 never
answered. D6 was written for the status pill and says `999px`; the closed enum then
allows only `4px` or `999px`. But the screen also contains elements that are round by
nature and are not pills — a 5px status dot, an 8px timeline dot, a 30px avatar. Under
a literal reading of "status / stage / count ONLY" those had **no legal value**:
`--rv-radius` would render them as rounded squares, which is a redesign of an approved
screen, and no third radius may exist.

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D6.1 | Scope of `--rv-radius-pill` | **Semantic pills *and* true circles** | D6's own rationale is "identical rendering; honest value (does not depend on element height)". That rationale is about expressing *circular* without a literal, and it applies to a 5px dot exactly as it applies to an 18px pill. Splitting the two would force either a third radius or a visual regression. | The rule now names two categories instead of one, so the detector needs the element's role, not only its radius value. |

**In force.** Canonical for: status pill, stage badge, count badge, status dot,
timeline dot, avatar. Forbidden for: ordinary button, card, control, section chip,
rectangular decorative box. Everything else takes `--rv-radius`.

**Not granted.** This is not permission to introduce arbitrary pill geometry. A
pill-shaped *button* remains a defect (§6), and a rectangular element does not become
eligible by being small or decorative.

**Also settled in this round, without a new decision.** Two questions were raised
against the same fixture and both resolved to *existing* contract text rather than to
new choices, so they are recorded as clarifications in `UI_VISUAL_CONTRACT.md` (§2.5.1
and §5) and not as ratified decisions here: a non-mutating contextual navigation link
may stay in a section header and must not carry `data-card-actions`; and the status
pill follows §2.6's `height: 18px` / `padding: 0 6px` / bordered form, because the
normative component contract prevails over a geometry freeze that was only ever meant
to protect *layout*.

---

## 2026-07-26 · D9 — Phase-5 colour ownership completion

**Bounded completion of the token system. D1–D8 are not rewritten and no value they
ratified changes.**

**Context.** The phase-4 detector produced the first complete census of the application
surface: 2,784 `UIC-001` colour sites. 2,267 mapped cleanly onto existing tokens. The
remaining **517**, grouped into nine repeated patterns, had **no owner at all** — not a
wrong owner, an absent one. The token system was extracted from SGAA plus one approved
cockpit fixture (D1–D8); the application carries state vocabulary, business data,
visualization and overlay roles that the fixture never contained, so no family was ever
declared for them. Pass 1 was hard-stopped before its first write rather than closed by
choosing colours by visual proximity — which is exactly how the three visual generations
were produced.

**Evidence.** `tests/fixtures/ui-conformance-baseline.json` at `9fbb84c`, and the
2,784-row per-site census held outside the repository.

### Ratified decisions

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D9.1 | Lifecycle status mapping (`UA`, 270 sites) | **§2.6 extended to the states the product actually has; unknown → `neutral`** | The table was already declared the single source but covered 15 states while the product persists ~25. An unlisted state silently became whatever the screen author picked that day. | `Recebido` moves blue → green and `Confirmado` becomes neutral: no family was ever ruled for it and inventing one is the failure mode this decision exists to stop. |
| D9.2 | Classification badges (`UA`) | **Always `--rv-pill-neutral-*`, no dot** | A document type is not a state. Colouring types made a format chip look like a status and burned the semantic palette on data with no semantics. | Types lose their individual colours; label and icon carry the difference. |
| D9.3 | Stage vs status (`UC`, 18 sites) | **`Em tecelagem` / `Em acabamento` are stages; `Em produção` stays a caution status** | §2.7 already said stage ≠ status. The screens used orange for acabamento, unrelated to `--rv-stage-acabamento`, while tecelagem already matched its token exactly. | Acabamento goes orange → teal. Visible, and the whole point: stage and status stop sharing a colour. |
| D9.4 | Caution action surface (`UB`, 58 sites) | **Add `--rv-signal-caution-bg` / `-border` aliasing the pill-caution pair; add the §2.1 Caution button variant** | Caution had text but no fill or border, so a caution button had no legal dress and §1's same-family rule was unsatisfiable. Borrowing the muted pill tone beats inventing a second amber. | Two tokens that are aliases, not new values. Amber surfaces converge on one tone. |
| D9.5 | Visualization (`UG`, 26 sites) | **`--rv-viz-track / -primary / -secondary / -series-3 / -series-4`, all composed from existing families** | Progress tracks and chart series are a real role with no owner. Composing them from brand/border/stage keeps re-theming to one block. | Five names for zero new values. |
| D9.6 | Business colour data (`UD`, 113 sites) | **`js/pedido-ui.js` owns it; the richer `cadastros.js` palette is promoted byte-for-byte** | A product's colour is business data, not a design value. Two divergent palettes existed for the same domain fact; the 17-entry one is the real map and the 4-entry one was the accident. | `pedido-ui.js` values change (`PRETO` `#111111`→`#1a1a1a`, `CRU`, `KRAFT`, `CINZA`, default). Pinned tests were updated with it. |
| D9.7 | Overlay scrim (`UF`, 10 sites) | **One `--rv-overlay-scrim`, modal backdrop only** | Four near-identical translucent darks existed. Hover, selection and focus already had owners and were being served by ad-hoc rgba. | None. The promoted value is the one the modals already used. |
| D9.8 | Disabled state (`UI`, 4 sites) | **§2.1's opacity `.45` is binding; no disabled colour token** | A washed-out substitute value is a second palette by another name, and `op-nova.js` was deriving it by `String.replace` on the enabled style. | Disabled controls look slightly different, and the string-replace trick had to be rewritten as explicit declarations. |
| D9.9 | Inverse text on signal (`UK`, 1 site) | **`--rv-text-on-signal`, aliasing `--rv-surface`** | `--rv-text-on-brand` is scoped to brand surfaces; text on a solid green button had no owner. | One more name. Not a fifth text level. |

**Also ruled, without a new token.** The synthetic weave illustration in
`cliente-pedido-form.js` (`UE`, 17 sites) is **retired**: it was a decorative gradient
with no product data behind it, and keeping it would have established a decorative
palette outside the token system. Its region now shows the real selected business
swatches, or an honest neutral empty state.

**Not granted.** No new literal design value entered `css/tokens.css` — every token added
here resolves to an existing one, except `--rv-overlay-scrim`, whose value is promoted
from the implementation it replaces. Business colour literals are legitimate **only** in
`js/pedido-ui.js`. This is not permission to add a second palette anywhere else.

### Revoked in this round

- Per-screen status, type and tone colour maps, in all 18 files that carried one.
- The duplicated `getSwatchTone` palette in `cadastros.js` and the synthetic per-model
  palettes in `cliente-pedido-form.js` and `pedido-item-row-editor.js`.
- The four-entry `COR_PREVIEW_MAP` in `js/pedido-ui.js` and its `#9ca3af` default.
- Disabled-state colour substitutions (`#93b7f5`, `#9fb4d6`, `#e1e7f0`).
- The synthetic product illustration and its tan gradient palette.

### Still open after this round

| Topic | State | Needs |
|---|---|---|
| `Confirmado` lifecycle family | resolved to `neutral` by the unknown-state rule | a product decision if a distinct family is wanted |
| Whether `cores` should persist an explicit hex | open | schema decision; the precedence already accepts one |

---

## 2026-07-27 · D10 — the application owns the single-choice control

Phase-5 pass 7 closed `UIC-006`. The product had 44 single-choice sites: 15 native
`<select>` constructions the detector could see, and 29 call sites of the shared
`js/ui.js::selectInput()`. Two of them hid a native `<select>` at `opacity:0` behind a
styled facade — the facade drew the field, the invisible control owned the value.

| Decision | Reason | Accepted loss |
|---|---|---|
| ONE owner, `js/select-popover.js`, exporting `window.createSelectPopover()`; `selectInput()` becomes a thin adapter | a native `<select>` can style its closed field and nothing else — the open list is browser-drawn and refuses padding, radius, shadow, item colour and selected background | we now own keyboard, focus and positioning behaviour the browser used to give us free |
| The trigger is a `<button role="combobox">`, not a styled `<select>` | a facade over a hidden native control means two elements disagree about the truth; one element now owns the value and the presentation | `role="combobox"` does not take its name from content, so every trigger needs an explicit name — see D10.1 |
| No `options` collection, no `selectedIndex`, no `add()`/`remove()`/`replaceChildren()` | emulating `HTMLSelectElement` would invite callers to depend on a DOM we do not own; the repository only ever used `.value` and repopulation | dynamic callers had to move to `setOptions()`, which is a real (small) migration |
| The panel is portaled to `document.body` at `--rv-z-popover` 225 | a list rendered inside a modal, a scroll container or any local stacking context gets clipped; layering it between the modal (200) and the toast (250) is the only arrangement where a field inside a modal works | positioning becomes our problem: we measure, flip and clamp on open, resize and capturing scroll |
| One popover open globally | two open lists is never a state a user asked for | a module-level registry, which is shared mutable state |
| Exactly one site became read-only presentation | Pedido "Status inicial" offered one permanently disabled option — a statement, not a decision | a disabled combobox would have been the lazy answer and would have kept a fake control |
| No search box, no grouping, no multi-select | the proven population needs none of the three, and each would be a contract with no consumer | a future searchable variant is a new decision, not an extension |

### D10.1 — naming is part of the control, not a later polish

Replacing `<select>` with `role="combobox"` moved a burden the browser used to carry.
A `<button>` takes its accessible name from its text; **a combobox does not**. Five
screens rendered their visible label as a SIBLING `<label>` with no `for` and no id —
which named nothing before either, but a native select at least announced its value.
Nineteen triggers therefore reached assistive technology unnamed.

**Choice.** Bind the existing visible label through `aria-labelledby`, at the owning
field helper, using a deterministic per-module id sequence. Never overwrite an explicit
name. Never bind a non-combobox.
**Accepted loss.** Five screen helpers now know about the canonical marker — a small,
explicit coupling we preferred to nineteen one-off patches.

One row-level control had no individual label at all: it is a grid cell. **Choice.**
name it by its own column header, the same real node the table already renders.
**Accepted loss.** many rows share one id, so the id must be minted per render.

### D10.2 — a wrapper may not restyle the trigger

`op-nova.js styleSelect()` replaced the whole inline style with a native-`<select>`
padding box. Applied to the canonical trigger it produced 41px instead of 32px, 14px
text, 9px vertical padding and `inline-block` — silently, at three real sites, while
every static guard stayed green.

**Choice.** the primitive is the sole owner of combobox geometry; `styleSelect()`
returns a canonical trigger untouched before any mutation, and keeps its previous
behaviour for legacy controls.
**Accepted loss.** the rule is a guard inside a screen helper rather than something the
type system or the detector can enforce — so it is written down here.

**Revoked.** The hidden-native-`<select>`-behind-a-facade pattern (`ops-list.js`,
`pedidos-list.js`). No product surface may carry a native `<select>` again.

---

## 2026-07-28 · D11 — the Switch is an ordinary control, and its knob is not a circle

**Context.** `SPECIALIZED-CONTROLS-B1` moved the switch's track and knob out of two
screens into one shared owner and kept, byte for byte, the geometry the product already
rendered — including a knob at `var(--rv-radius-pill)`. Preserving the existing
appearance was the right call for a migration, but it silently **promoted historical
geometry into a shared primitive without ever ratifying it in the visual contract**: §2
had no Switch entry, so nothing in the closed list ever said the knob was legal. The gap
was recorded as `UI-SWITCH-TRACK-GEOMETRY-DEBT` and deferred. The user then rejected the
circular knob explicitly, twice.

D6.1 already answered this and was not read as answering it. It scopes
`--rv-radius-pill` to semantic pills **and true circles** — status dot, timeline dot,
avatar — and closes with "**Not granted.** This is not permission to introduce arbitrary
pill geometry… a rectangular element does not become eligible by being small or
decorative." A switch knob is not a pill and not a true circle. It was never in scope.

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D11 | Switch radius | **`var(--rv-radius)` on track *and* knob** | A switch is an ordinary interactive control, and D6.1 puts every ordinary control on the ordinary radius. The circular knob was an unratified inheritance, not a decision; keeping it would have required either widening D6.1 to cover rectangular controls — which D6.1 explicitly refuses — or a third radius, which D6 forbids. | The control no longer resembles a generic mobile pill switch. That resemblance was never a project decision, and the restrained 4px corner is what every other control in the system already uses. |
| D11.1 | Switch enters the closed primitive list | **new §2.13; count 13 → 14** | A shared primitive whose geometry no contract entry owns cannot be conformance-checked. The entry is what makes the knob radius observable rather than a matter of opinion. | One more contract entry to keep current. |

**Unchanged.** Dimensions (40×22 track, 18×18 knob, 2px inset, 18px travel), the
`brand` / `caution` tone enum, declarative `:checked` state, the collapsed focusable
checkbox as the sole state owner, keyboard and Space activation, the focus-visible ring,
the disabled treatment, and every caller's business state and handlers. No caller was
rewritten: none declared switch geometry, so all three inherit the correction from the
shared owner.

**Not granted.** D6.1 is not weakened and true-circle ownership is not redefined: the
status dot, timeline dot and avatar keep `--rv-radius-pill`. This decision moves exactly
one element — the switch knob — out of a scope it was never in.

**Process.** The order that shipped the unratified geometry, and the later order that
built new UI on top of it, both omitted `UI_VISUAL_CONTRACT.md` from their mandatory
reads. `AGENT_INSTRUCTIONS.md` §5 now makes that omission a defect in the order itself.

---

## 2026-07-28 · D11.2 — the off switch has to be visible, and the knob has to sit straight

**Context.** D11 corrected the knob radius and shipped. The architect then could not find
the control on the screen: the off track is `--rv-surface-subtle` (#f8fafc) with no
border, which is invisible on a `--rv-surface` card (#ffffff). Adding a 1px border fixed
the visibility and immediately exposed a second fault — with `box-sizing: border-box` the
border consumed 2px of the inner box, so the 2px knob inset left 0px at the bottom and
0px at the end of the travel, and the knob rendered visibly crooked.

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D11.2 | Off-state visibility | **1px `--rv-border-strong` on the track** | The off fill and the card surface are the same colour family, so fill alone cannot describe a control. This is the border the Field primitive (§2.2) already uses. | The off switch is slightly heavier than a pure fill. |
| D11.3 | Knob inset | **2px → 1px** | With a 1px border the inner box is 38x20; a 1px inset centres the knob exactly — 1+18+1 vertically and 1+18+18+1 horizontally. The outer box stays the ratified 40x22. | None; it restores the symmetry the border broke. |
| D11.4 | Switch radius | **`--rv-switch-radius` 3px, track and knob** | At 4px inside a 1px border the knob read rounder than its own track. One rung tighter nests correctly. It is a role token in the specialized-control block, which already owns switch geometry — not a fourth global radius. | The closed shape enum no longer describes every radius in the product by itself; the specialized-control block owns this one, as it already owns switch height and travel. |

**Found by looking, not by measuring.** D11 was validated with `getComputedStyle`:
radius, width, height and travel all returned the ratified values while the control was
invisible and crooked on screen. A computed-style probe cannot see that a control and its
background share a colour, nor that a knob is off-centre. Rendered inspection is not
optional for a visual change.

---

## 2026-07-28 · D11.5 — the ratified Switch geometry, after review

**Supersedes the VALUES of D11.2, D11.3 and D11.4. Those entries are not rewritten:
they record what was tried and why it failed, which is the useful part.**

**Context.** D11.2–D11.4 were written from measurement, not from looking. Reviewed on
screen, the control was still wrong three times running: invisible when off, knob
crooked, then knob still lost inside the track. Each round the architect looked at the
rendered switch and named the defect; each round my own validation had passed.

**What D11.2 got wrong.** It treated the off state as a MISSING EDGE and added a border.
The defect was never the edge — it was that the knob (`--rv-surface`, #ffffff) and the
track (`--rv-surface-subtle`, #f8fafc) were the same colour, 1.05:1. The control had no
interior. A border cannot fix an interior, and the follow-up attempt at `--rv-border-strong`
(#cbd5e1, 1.48:1) was still one white shape.

### Ratified — this is the standard for this control type

| Part | Token | Value |
|---|---|---|
| Track | `--rv-switch-track-w` / `-track-h` | 40 × 22 |
| Knob | `--rv-switch-knob` | 18 × 18 |
| Knob inset, vertical | `--rv-switch-knob-inset` | 1px |
| Knob inset, horizontal | `--rv-switch-knob-inset-x` | 2px |
| Knob travel | `--rv-switch-knob-travel` | 16px |
| Track radius | `--rv-switch-radius` | 2px |
| Knob radius | `--rv-switch-knob-radius` | 1px |
| OFF fill and border | `--rv-text-tertiary` | #9ca3af |
| ON fill and border | `--rv-viz-primary` / `--rv-signal-caution` | by tone |

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D11.5 | Off-state fill | **`--rv-text-tertiary` (#9ca3af), fill AND border** | 2.54:1 against the white knob and 2.43:1 against the panel. An off switch is a grey track carrying a white knob; that reading needs a real grey, not a near-white. | A text token is used as a fill — see the disclosure below. |
| D11.6 | Knob inset | **1px vertical, 2px horizontal, travel 16px** | The inner box is 38×20 against an 18px knob: vertically only 1px fits on each side, horizontally 2px does. The knob stops 2px from each end in BOTH positions, so the two ends read alike. | The vertical and horizontal insets are different numbers and need two tokens. |
| D11.7 | Radii | **track 2px, knob 1px** | The knob nests inside the track instead of competing with its corner. | Two more role tokens in the specialized-control block. |

**DISCLOSED — a real gap, not a preference.** `--rv-text-tertiary` is a TEXT token being
used as a control FILL. The ramp has no neutral control-fill grey in this range. A
dedicated token is the clean answer and requires its own authorization; until then this
use is the exception, not a precedent for filling controls with text tokens.

**The method lesson, stated once more because it produced every defect above.**
`getComputedStyle` returned the ratified numbers on all three broken versions. It cannot
see that two elements share a colour, nor that a knob is off-centre. **A visual change is
not validated until the rendered result is looked at.**

---

## 2026-07-29 · D12 — a standalone notice is its own information surface, full width

Kleber's direct review of the published admin dashboard found `rv-adm-warning` rendered
inline beside the title block, sized to its own text rather than to the page.

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D12 | Standalone notice width | **Full width of the containing content region, as a card** | A notice inline with a title reads as an annotation of the title, not as its own signal; a text-width banner produces inconsistent hierarchy across screens because its size tracks copy length, not layout. A full-width card gives the notice a stable scanning position and keeps its semantic family (background, border, icon, text) as the one visible ownership. | A short message now occupies a full row of vertical space it does not visually need. |

This is a **global** rule (`UI_VISUAL_CONTRACT.md` §2.11), not a dashboard-only fix: it
governs every standalone warning, caution, error, information, or positive notice in page
content. It does not reach field validation, toasts, lifecycle-status pills, persisted
alert records, or modal confirmation copy — each keeps its own existing owner.

---

## How to record the next round

Header with date and name. Context in two sentences. One line per decision with
**choice, reason and accepted loss** — a decision without a declared loss is usually a
decision not taken. A "Revoked" section naming what died. Never edit above.

---

## 2026-08-04 · D13 — density is a product requirement on operational surfaces

Kleber reviewed the two published weaving screens against the real operation and found
both too sparse to work with: the OP screen showed very few products because every
product card carried a full action footer, and Ver rolos showed very few rolls because
each physical roll occupied a whole table row. He ruled the header of the roll section
must NOT grow at all to accommodate its new actions, and that the contract should be
adjusted rather than the header.

| # | Decision | Choice | Reason | Accepted loss |
|---|---|---|---|---|
| D13.1 | Repeated record card actions | **Top row, right-aligned; no action footer** | A footer costs `border-top` + 11px padding + a button rung PER RECORD. On a list of records that cost is paid N times and is precisely what stops the operator seeing the list. The identity line already occupies that row and is mostly empty on its right. | The card-footer rule now has two cases, so "where do actions go" is no longer answerable without asking whether the card is a repeated record or a single entity. |
| D13.2 | Inline action rung | **New `--rv-h-inline` = 20px, admissible ONLY on a section-chip header line** | The section chip is 20px. Any control taller than that grows the header, and the requirement was explicitly zero growth. Matching the chip exactly is the only value that satisfies it. | The control-height ladder is no longer three rungs, and a 20px control has a smaller pointer target than the 32px floor everywhere else. Scoping it to one placement is what keeps that from spreading. |
| D13.3 | Roll presentation | **Selectable unit chip (§2.14), grouped by production date** | The operator recognises a physical roll by number and meterage; everything else in the row was structure, not information. Chips let one line carry many rolls instead of one. | The per-roll situation pill is gone from the default view: a roll's state is now carried by its chip state and by grouping, not by a pill per row. |
| D13.4 | Chip actions | **None per chip; bulk actions on the current selection** | A print and a delete icon on every chip reproduce, at chip scale, exactly the clutter the chip replaced. | Acting on ONE roll now takes two gestures (select, then act) instead of one. |
| D13.5 | Selection is shared | **One selection model consumed by delete, print and finishing output** | Two competing selection paradigms on one screen is how an operator learns to distrust both. The finishing-output modal previously rebuilt its own independent checkbox list of the same rolls. | The finishing-output action is no longer self-contained: it now depends on a selection made elsewhere on the screen. |

**Revoked.** The finishing-output modal's own roll checkbox list (db/125 UI, 2026-08-03)
is withdrawn. Its product rules are unchanged and still enforced by the server; only the
duplicate selection surface dies.

**Not a precedent.** D13.1 does not authorize moving actions upward on single-entity
detail cards, and D13.2 does not authorize a 20px control anywhere except a section-chip
header line. Both are written into `UI_VISUAL_CONTRACT.md` with their scope attached,
because a rung without a scope is a rung that spreads.
