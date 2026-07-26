# ARCHITECT BRIEF — UI CONSOLIDATION (INTTRACKER)

> **Audience:** the architect AI, which will direct the executor AI.
> **Status:** plan approved by the product owner. Phases 1 and 2 are DONE (artifacts
> listed in §3). Phase 3 is IMPLEMENTED and awaiting your acceptance (§5). Phases 4
> and 5 are what you still need to direct, and neither is authorized yet.
> **You do not need to re-derive anything.** Every value is already extracted and
> ratified. Your job is sequencing, enforcement, and the skill reconciliation in §6.

---

## 1. The problem, stated precisely

The product carried **three competing sources of visual truth**:

1. `css/tokens.css` — the versioned `--rv-*` tokens.
2. `.claude/design-skill/` (`inttex-ui`) — `SKILL.md`, `README.md`, `tokens/*.css`.
3. The SGAA palette — the real CSS of the sibling product (`modern-style.css`),
   supplied as `docs/architecture/SGAA_DESIGN_SYSTEM_REFERENCE.md`.

They contradicted each other on central facts (primary action colour, card radius,
text ramp, control height). Because three sources existed, **no written rule could
hold the line** — each generation pass picked a different one. That is the mechanical
cause of the product having three visual generations, not designer inconsistency.

### 1.1 The finding that reoriented the work

**The v1 visual contract described the generation it was supposed to replace.**
Its §4 fixed `--rv-color-accent: #2563eb` — the vibrant blue inherited from the
legacy system. The approved pilot screen (`OP Detail - Compacto`) **never used that
value**; it was already navy.

So the real conflict was never *contract vs. SGAA*. It was *contract vs. the screen
the owner had already approved*. The contract's colour column was discarded whole.

### 1.2 Root cause

The v1 contract was written **before an approved screen existed**. It therefore
encoded *intent*. v2 is **extracted**, not authored:

| Kind of fact | Single origin |
|---|---|
| Colour, type, shape, shadow | SGAA reference |
| Shell geometry, density, composition | measured in the approved fixture |
| Stage badge, table divider, brand teal | product-specific, declared as an addition (SGAA does not cover them) |

Nothing was invented. If a value is not traceable to one of those three origins,
it is a defect.

---

## 2. The four generations, and what each one costs

Naming these is what lets you size the remediation instead of treating all screens
as equal work.

| Tag | What it is | Remediation cost |
|---|---|---|
| **G1** | Legacy generic UI, not built by this team. Looks 20+ years old. | **Rebuild.** Nothing to preserve. |
| **G2** | Minimalist, near-square corners — the right direction — but vibrant legacy colours, tall/wide buttons, visually noisy. | **Mechanical only.** Token swap + control heights + radius. Not a redesign. This is the good news. |
| **G3** | `OP Detail - Compacto` family. The approved direction. | Reference. Needs passes 2–6 only. |
| **SGAA** | Already retokenised (the two documentation pages). | Conforming. |

**Do not let the executor treat G2 as a redesign.** It is a find-and-replace plus
three numeric constraints. Misjudging this is the single biggest schedule risk.

---

## 3. What already exists (phases 1–2, done)

| Artifact | Role |
|---|---|
| `css/tokens.css` | **Layer 1.** The only source of visual value. `--rv-*` prefix retained (screens already reference it), SGAA names and values, plus a deprecated-alias block for breakage-free migration. |
| `docs/architecture/UI_VISUAL_CONTRACT.md` | **Layers 2–3.** 11 primitives, 6 screen archetypes, and a closed-enum JSON block (§5) that the detector reads. |
| `docs/architecture/DESIGN_DECISIONS.md` | Append-only log. D1–D8 with **choice, reason, accepted loss**. Never rewritten. |
| `docs/architecture/UI_CONFORMANCE.md` | **Layer 4.** 30 screens mapped to archetypes; the 8-pass batch order. |
| `docs/ui/evidence/ui-consolidation/Reconciliação de Tokens.dc.html` | Visual evidence for phase 1: 16 colour facts across the three sources, all 8 decisions rendered at real size in both options, measured geometry. |

### 3.1 The four architectural rules behind that structure

State these to the executor verbatim; they are what prevents re-drift:

1. **Four layers, one owning file each.** No value exists in two places.
2. **Prose is justification, never a source of value.** Every mandatory value lives
   in `tokens.css` or in a §5 enum. If you must interpret a sentence to learn a
   number, the number is in the wrong place. (v1 was 354 lines of prose — 354
   interpretation opportunities per session.)
3. **A reference is a file, not a description.** Every primitive and archetype points
   to a versioned **fixture**. Descriptions drift; files do not.
4. **Facts in the contract, reasons in the log.** The contract says what IS. The log
   is append-only and says why.

### 3.2 Archetypes replaced the old rule taxonomy

v1 classified *rules* (`GLOBAL` / `SCREEN-FAMILY` / `COMPONENT-SPECIFIC`). The actual
need was to classify *screens*. That is why v1 required footnotes in §5 and §11
explaining where the cockpit does not apply — a symptom of the wrong axis.

Six archetypes now exist, each declaring **intent, density, who owns the dominant
action, and whether it has a rail**. Every screen belongs to exactly one.
Only archetype **A (detail cockpit)** is ratified. B–F are `CANDIDATE` and
**may not be cited as precedent** until two of their screens pass the detector.

---

## 4. The eight ratified decisions

Full reasoning in `DESIGN_DECISIONS.md`. Summary for enforcement:

| # | Decision | Ruling |
|---|---|---|
| D1 | Card radius | **4px** everywhere. 6px never existed in app code — it came from the skill. One radius makes the rule trivially checkable. |
| D2 | Card border | **`#d4d8dd`** outside, **`#e5e8ec`** for inner dividers. The old `#e7eaee` gives 1.07:1 against the page — with 8 stacked cards the eye loses the boundary. |
| D3 | Text levels | **4**, hard ceiling (`#111827` for the 22px H1 only). The fixture used **7** greys for 4 roles; that was drift, not hierarchy. |
| D4 | Semantic tone | **Two families with defined jobs.** Vivid for a bare signal (colour is the sole carrier of meaning); SGAA's muted tones inside a status pill (background + border + dot already carry the state). |
| D5 | Control heights | **32 / 34 / 38**, closed set. Height carries the action hierarchy in the cockpit; flattening to a single 32px erases the read that makes the screen work. SGAA's 32px becomes the *compact* rung. |
| D6 | Pill radius | **999px**. Identical rendering, honest value, zero cost. |
| D7 | Positive button | **SGAA `status-positive`** (`#e9f5e7` / `#b9d7b5` / `#1f5a3c`). The previous trio came from the skill's `--success-btn-*` and none of it existed in SGAA: a 3%-chroma green fill reading as dirty white against a ~4× more saturated border. |
| D8 | Dropdown list | **Own popover. Native `<select>` forbidden** on product surfaces. `appearance:none` styles only the closed field; the open list is browser-drawn and accepts no padding, radius, shadow, item colour or selected background. No CSS fixes it. |

### 4.1 Two cross-cutting rules derived from the above

- **From D7 — same-family rule:** background, border and text of one element always
  come from the same status family. Mismatched chroma between fill and border is the
  actual defect, and it repeated in the negative and neutral variants too.
- **Action alignment (closed):** action inside a card goes in the **block footer,
  right-aligned**, with `border-top: 1px solid var(--rv-border-soft)` and
  `padding-top: 11px`. With an empty state, the empty text sits left and the action
  right on the same row. **Two exceptions, only two:** in the rail every control is
  `width:100%`; the dashed attach button is `width:100%` per document type.
  Left-aligned button inside a card is a defect.

### 4.2 Incidental consolidations

Four different popover shadows coexisted (SGAA, skill, `Acompanhamento B2B`, tokens)
→ one: `0 12px 28px rgba(0,0,0,.10)`.

---

## 5. Phases 3–5 — what to direct

### Phase 3 — bring the fixture into conformance — **CORRECTED, AWAITING ARCHITECT ACCEPTANCE**

The contradiction this phase existed to remove is gone: the fixture
`docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html` no longer carries
deviations D1–D8, so the detector will not flag the reference first and a green
baseline now exists to diff against.

- **Scope:** one file, plus its focused test. Passes 1–6 applied to that file only.
- **Delivered:** loads `css/tokens.css` as the single token owner and declares none of
  its own; 201 literal colours → 0; radius ∈ {`--rv-radius`, `--rv-radius-pill`};
  control heights ∈ {`--rv-h-compact`, `--rv-h-default`, `--rv-h-primary`}; cards flat
  via `--rv-shadow-none`; the in-card action row carries `data-card-actions` and is
  `space-between`; the root carries `data-ui-archetype="detail-cockpit"`.
- **Preserved:** the ratified geometry is byte-exact — header 60, sidebar 190, rail 300,
  content max 1600, main padding `18px 32px 40px`, card padding `15px 17px` /
  `16px 17px`, stack gap 14, column gap 16 — all now expressed through their tokens.
  No layout, density, composition or copy change; the structural projection of the
  file differs only in the value-ownership edits listed above.
- **Guard:** `tests/ui-op-detail-compacto-fixture.test.mjs` (fixture-specific, 36 tests).
- **Corrected after the first submission.** Three defects were found and fixed, and the
  fixture's `conforming` classification only holds with them:
  1. **It did not render offline.** `support.js` fetched React from a public CDN, so with
     no internet the fixture was a blank page. React and ReactDOM 18.3.1 (MIT) are now
     versioned at `docs/ui/fixtures/vendor/react-18.3.1/` and loaded first; `support.js`
     short-circuits on the existing globals and was not modified. Custody and digests
     live in that directory's `README.md`. They are immutable third-party assets, exempt
     from `CODE_HEALTH_RULES.md` §7, and the product runtime must never import them.
  2. **The status pill was not canonical.** It now follows §2.6 — `height: 18px`,
     `padding: 0 6px`, bordered — because the normative component contract prevails over
     a geometry freeze meant to protect layout.
  3. **The count badge sat below the type floor.** `font-size: 10px` → the canonical
     `var(--rv-fs-thead)` (10.5px), inside the §5 enum.
  Two normative clarifications carry them: **D6.1** scopes `--rv-radius-pill` to semantic
  pills *and* true circles, and `UI_VISUAL_CONTRACT.md` §2.5.1 rules that a non-mutating
  contextual navigation link may stay in a section header. Neither invents a token or a
  value.
- **NOT delivered:** architect acceptance. The executor does not self-accept.

### Phase 4 — the detector — **BLOCKED, NOT AUTHORIZED**

Phase 4 requires its own explicit order. Phase 3 being implemented does not authorize
it, and the fixture being conforming is a precondition, not a trigger. Do not start
the detector before the architect accepts phase 3.

A deterministic script. It does **not** need design judgment; it reads the closed
enums in `UI_VISUAL_CONTRACT.md` §5 and reports violations with file and line.

Rules to implement, in this priority order:

1. literal hex in a screen (any `#rrggbb` outside `css/tokens.css`);
2. `border-radius` not in {`4px`, `999px`};
3. control `height` not in {`32px`, `34px`, `38px`};
4. `box-shadow` not in the 3-value enum; any shadow on a card;
5. `font-size` not in the 10-value enum; `font-weight` not in {400,500,600,700,800};
6. a `<select>` element on a product surface;
7. `border-radius: 999px` (or ≥ 20px) on a `<button>`;
8. in-card action row whose `justify-content` is not `flex-end` / `space-between`;
9. reference to a deprecated `--rv-color-*` alias (drives alias deletion).

**Decide with the owner where it runs.** The prototypes in the design project are
`.dc.html`; the app is `js/screens/*.js`. The rule set is identical; only the parser
differs. Write one detector with two front-ends rather than two detectors.

Rule 8 and table alignment are the weak spots — see §7.

### Phase 5 — batch remediation, by property

**Enforce this hard: one pass per property across all screens, never screen by
screen.** Screen-by-screen turns every screen into a fresh judgment call, and fresh
judgment calls are precisely where the three generations came from.

| # | Pass | Change | Verification |
|---|---|---|---|
| 1 | Token | literal hex → `var(--rv-*)` | detector: 0 literals |
| 2 | Colour | `#2563eb` / `#14509E` / `#0A326D` → `--rv-brand` / `--rv-accent-blue`; text → 4 levels | detector: 0 out-of-enum colours |
| 3 | Radius | all → `4px`; pills → `999px` | detector: radius ∈ enum |
| 4 | Height | controls → 32 / 34 / 38 | detector: height ∈ enum |
| 5 | Shadow | 4 popover values → 1; cards flat | detector: shadow ∈ enum |
| 6 | Alignment | in-card action → right-aligned footer | detector rule 8 |
| 7 | Popover | native `<select>` → own popover component | detector: 0 `<select>` |
| 8 | Tables | header width/alignment identical to values | **manual review** |

Passes 1–7 are mechanical and verifiable. Pass 8 is the only one that needs eyes.

Each pass closes when the detector reports zero for that rule. Do not start the next
pass with the previous one open — overlapping passes reintroduce judgment.

---

## 6. Reconciling the `.claude` skill

The app has a generation skill at `.claude/design-skill/` (`inttex-ui`:
`SKILL.md`, `README.md`, `tokens/*.css`). It must be reconciled, not deleted.

### 6.1 The structural argument

`.claude` is untracked and absent from fresh worktrees — v1's own §0 flagged this,
citing `CLAUDE_PROJECT_ASSET_MAP.md` §13. Therefore:

> **The skill may never hold a value that the build depends on.**

That single sentence resolves the whole reconciliation.

### 6.2 Required changes

| File | Action |
|---|---|
| `.claude/design-skill/tokens/*.css` | **Delete**, or reduce to `@import` of `css/tokens.css`. Never a second declaration. Currently they declare `--radius-card: 6px`, `--radius-pill: 20px`, `--success-btn-*` and a 5-level text ramp — all revoked by D1, D3, D6, D7. |
| `.claude/design-skill/SKILL.md` | Strip **every literal value**. It currently hard-codes "card 6px / control 4px", "1600px", the table golden rule wording, and the destructive-button rule. Replace with: precedence statement, a pointer to the contract and to `tokens.css`, and the fixture list. |
| `.claude/design-skill/README.md` | Same. Keep the *snippets*, but every value inside them becomes `var(--rv-*)`. A snippet with a literal hex is now a defect the detector will catch in generated output. |
| `.claude/tokens/*.css` | Delete. Third namespace. |
| `tailwind-preset.js` | Keep, but it must map to `--rv-*` names, not to its own scale. |

### 6.3 The precedence statement to paste into the skill

> This skill is a **generation tool**. It teaches how to apply the pattern; it does
> not define the pattern. `docs/architecture/UI_VISUAL_CONTRACT.md` and
> `css/tokens.css` prevail over anything written here. If this file and the contract
> disagree, the contract wins and this file is the defect. Never declare a colour,
> radius, height, shadow or font size here — reference the token.

### 6.4 Third-party skills

The owner asked about **Impeccable** (a Claude Code design skill). Assessment:

- Its `audit` / `critique` / `polish` commands and deterministic detector rules are
  genuinely useful — that is the "find inconsistency" half we lack.
- **But:** its `init` writes its own `PRODUCT.md` / `DESIGN.md`, which would create a
  *fourth* source of truth. If adopted, point its config at our contract; do not let
  it generate its own opinion.
- **And:** its font procedure actively rejects overused typefaces including Inter —
  which is mandatory here. It will fight the contract.
- It performs best as a finisher on existing work, not from a blank page.

**Recommendation:** adopt *after* phases 3–5 close, for polish only, with its config
subordinated to the contract. Do not adopt before the tokens are consolidated.

---

## 7. Known weak spots — flag these to the executor

- **Table golden rule is not fully machine-checkable.** A detector can verify that a
  `<colgroup>` or a shared `grid-template-columns` exists; it cannot verify the
  header *reads* as aligned. Pass 8 stays manual.
- **Detector rule 8 (in-card action alignment)** needs a reliable way to identify
  "the action row of a card". Suggest requiring an explicit marker
  (e.g. `data-card-actions`) on that row so the check is exact rather than heuristic.
- **Archetype E (client portal) has a content restriction, not a style one.** Never
  expose OP, lot, supplier, latex company, purchase order, invoice, packing list,
  cost or margin. See `RELATORIO_COMPATIBILIZACAO.md` §3.1. A visual detector will
  not catch a leak here — it needs its own check.
- **The stepper** in the client portal is not yet a primitive. Do not promote it
  until two conforming screens use it.
- **Export derivatives** (`*-standalone.html`, `*-bundle-ready.html`, `*-print-*`)
  must **not** be audited or hand-edited. Regenerate them from source after the passes.

---

## 8. Language convention

- **All project documentation is English.** The four architecture documents and this
  brief are English. Any new architecture doc is English.
- **All product UI copy is pt-BR.** Labels, empty states, messages, section labels.
  Do not "fix" the interface into English.
- Number format is pt-BR: decimal comma, explicit unit (`1.000,00 m`, `183,000 kg`),
  `tabular-nums` always. Dates `DD/MM/AAAA`.

---

## 9. Naming

- **Product: Inttracker.** Formerly "OptiControl" — discontinued, do not reintroduce.
- **Company / brand: Inttex.**
- `--rv-brand-teal` is brand signature only: logo, login rule, printed-document rule.
  Never in a state, badge, pill or indicator. It is the one colour outside SGAA, and
  it is deliberately scoped.

---

## 10. Open items requiring an architect or owner decision

| Item | Needs |
|---|---|
| Where the detector runs (prototypes, app, or both) | owner decision + repo access |
| ~~Fate of `fixtures/OP Detail - Compacto copy.dc.html`~~ — **ruled** | Closed at foundation intake: byte-identical to the primary, so it was not versioned. See `UI_CONFORMANCE.md` § Versioned fixture provenance. |
| Formal WCAG conformance target | product decision |
| Breakpoints and rail behaviour on narrow screens | decision + prototype |
| Modal dimensions and dismiss behaviour (ESC / outside click / scroll-lock) | modal design |
| Ratifying archetypes B–F | two conforming screens each |
| Deleting the deprecated `--rv-color-*` aliases | detector reporting 0 uses |

---

## 11. What NOT to do

- Do not rewrite the contract from opinion. It is extracted; changes require a new
  log entry with choice, reason and accepted loss.
- Do not add a value to the skill, `CLAUDE.md`, or a README. Values live in
  `tokens.css` only.
- Do not remediate screen by screen.
- Do not treat G2 screens as redesigns.
- Do not run the detector before the fixture is conforming.
- Do not cite a `CANDIDATE` archetype as precedent.
- Do not edit export derivatives.
