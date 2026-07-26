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

## How to record the next round

Header with date and name. Context in two sentences. One line per decision with
**choice, reason and accepted loss** — a decision without a declared loss is usually a
decision not taken. A "Revoked" section naming what died. Never edit above.
