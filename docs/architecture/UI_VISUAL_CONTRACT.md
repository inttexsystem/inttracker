# VERSIONED VISUAL CONTRACT — RAVATEX / CONTROLE DE TAPETES

> **Phase:** `G28-P0` / fix `G28-P0-R1` — governance record and fix (docs-only).
> **Origin:** consolidation of the `.claude/design-skill/` skill (`inttex-ui`:
> `SKILL.md` + `README.md`), of the versioned tokens `css/tokens.css` (`--rv-*`), and
> of the two real OP pilots. No new design was invented.
> **Reason:** permanent UI rules **cannot** exist only in `.claude`
> (which is untracked and absent from new worktrees — see `CLAUDE_PROJECT_ASSET_MAP.md` §13).
> This document is the versioned source; the skill remains a generation tool.

Precedence: this contract **prevails over the skill**. A skill can teach how to
apply the pattern, but it cannot contradict the architecture nor this contract.

---

## 0. Real sources

- `css/tokens.css` — canonical versioned tokens (`--rv-*` prefix).
- `.claude/design-skill/README.md` — complete guide (foundations, layout, components, table golden rule).
- `.claude/design-skill/SKILL.md` — summarized non-negotiable rules.
- `.claude/design-skill/tokens/*.css` and `.claude/tokens/*.css` — skill tokens (reference).
- Approved pilots: `js/screens/op-latex-admin.js`, `js/screens/op-tecelagem-producao-admin.js`.
- Verification harness: `.claude/preview/*.html`.

When a point does not have sufficient evidence in the sources above, it is marked
as **OPEN — REQUIRES IALEAD DECISION**.

---

## 0.1 Rule taxonomy

Each rule in this contract has a scope. Before applying or expanding a rule,
check its class:

- **GLOBAL** — general product rule; applies across the whole application.
- **SCREEN-FAMILY** — rule for a family of screens, not the whole application.
- **COMPONENT-SPECIFIC** — rule for a specific component.
- **OBSERVED-PATTERN** — pattern observed in the pilots; needs validation before
  being expanded as a norm.
- **OPEN** — decision not yet closed.

## 0.2 Rule classification

**GLOBAL:**
- `--rv-*` tokens;
- low curvature (card 6px / control 4px);
- avoid pills outside badges/status;
- flat cards;
- pt-BR;
- honest empty states;
- do not fabricate files or badges;
- header/value alignment (table golden rule);
- component reuse;
- functional iconography;
- do not hide the requirement with a simplified replica.

**SCREEN-FAMILY** (administrative detail screens, when compatible):
- two-column cockpit;
- rail;
- sticky rail;
- full-width rail;
- section chips;
- administrative detail layout;
- form pair grids.

**COMPONENT-SPECIFIC:**
- badge;
- file chip;
- destructive button;
- row-level compact icon button (§8.1; exempt from the destructive
  button's icon+text rule, entity-level header actions excluded);
- modal;
- table;
- document slots.

**OBSERVED-PATTERN** (pilot values; do not promote without validation):
- 62px header;
- 196px sidebar;
- 300px rail;
- 1600px width;
- exact gaps;
- exact pilot dimensions;
- any value not confirmed as an applicable global token.

**OPEN:**
- complete modal;
- breakpoints;
- narrow-screen behavior;
- formal accessibility target.

---

## 1. Visual language

Dense, clean and sober — "tool padding, not landing-page padding", but with breathing
room (gap ~14–16px between cards). **Flat** cards (no shadow), hairline border.
Portuguese (pt-BR), objective and operational. **Do not use emoji as a substitute for
functional iconography** in operational interfaces — use the approved icon set
(see §13). This does **not** create an absolute ban on emoji in future
textual content.

## 2. Typography

**Inter** font. Dense scale (`--rv-font-size-*` tokens):

- Page title 22px/800, tracking `-.02em`;
- Metric value 15px/700;
- Cell/value 13–13,5px (`--rv-font-size-body` 13px, `--rv-color-value` #26303f);
- Metric label ~12,5px (`--rv-font-size-value`);
- Section label 11px/700 UPPERCASE, tracking `.06em` (`--rv-tracking-label`);
- Table header 10,5px/600 UPPERCASE.

Nothing below 10,5px. **Every number** uses `font-variant-numeric: tabular-nums`
(`.tnum`) and decimal comma with unit (`1000,00 m`, `183,000 kg`). Dates `DD/MM/AAAA`.

## 3. Shape, corners and shadow

- **Radii (low curvature):** card **6px** (`--rv-radius-card`), control
  **4px** (`--rv-radius-control`), **pill** badge (`--rv-radius-pill` 999px).
  Never round a button like a card.
- **Pill is exclusive to badge/stage/status** — do not use in buttons, inputs or cards.
- **Shadow** only in menus/popovers; cards are flat. Avoid heavy shadows.
- Hairline border `1px solid var(--rv-color-line-200)`.

## 4. Colors (semantic aliases — `css/tokens.css`)

- Text: title/body `--rv-color-title`/`--rv-color-text` #16203a; muted `--rv-color-muted`; strong value `--rv-color-value`.
- Accent (blue): `--rv-color-accent` #2563eb; soft background `--rv-color-subtle-bg` #eaf1fd.
- Surfaces: `--rv-color-surface` #fff; header `--rv-color-bg-header`.
- Lines: `--rv-color-line-100` (table), `--rv-color-line-200` (card), `--rv-color-input-border`.
- Semantic: `--rv-color-danger` #d6403a, `--rv-color-success` #18794a, `--rv-color-warning` #c2610c — each reads as a status; use sparingly.
- **Stage:** Tecelagem purple `--rv-stage-tecelagem`; Acabamento teal `--rv-stage-acabamento` (each with a `-bg`).
- **Status:** Preparação blue `--rv-status-prep`; Em produção amber `--rv-status-prod` + dot `--rv-status-prod-dot`.
- **Stage ≠ status:** never the same color for stage and status.

Re-theming = edit only the base scale and the accent in the tokens; cards/buttons/badges/tables inherit.

## 5. Layout (shell + cockpit)

- **Shell:** fixed header ~62px (`--rv-header-h`) + sidebar ~196px (`--rv-sidebar-w`;
  active item `bg-accent-soft text-accent`, radius 4px) + scrollable main.
- **Content:** full width up to **1600px**, centered; padding `18px 32px 40px`.
  Never a narrow central band with lateral leftover space.
- **2-column cockpit — `SCREEN-FAMILY`** (administrative detail screens,
  when compatible with the content): `grid-template-columns: minmax(0,1fr)
  var(--rv-rail-w)` with a right rail **300px** (`--rv-rail-w`) `position:sticky;top:0`.
  Content/tables on the left; summary, metrics and the dominant action in the rail. Do not
  repeat the same data on both sides.
- **The cockpit/rail is NOT mandatory** for the Documentos queue, listings,
  modals, simple screens or portal surfaces — those choose the layout
  suited to their content.
- **Rail rule (when there is a rail):** everything in the rail is vertical/full-width
  (stacked metrics, inputs and buttons `width:100%`). **Forbidden**: fixed-column
  grid inside the rail.

## 6. Cards and sections

Every section opens with an **icon chip** 20–22px (radius 4px, `--rv-color-chip-bg`,
glyph 13px `--rv-color-chip-glyph`) + 11px UPPERCASE label. Discreet icon,
**distinct per section**. **Forbidden:** vertical blue bar, solid strip,
border pseudo-icon, dominant numbered header ("1. Dados", "2. Itens").

## 7. Tables — golden rule

**The width and alignment of the HEADER of each column MUST be identical to
those of the VALUES.** Ensure this via `<table style="table-layout:fixed">` + `<colgroup>`
with `text-align` repeated on `th`/`td`, **or** a shared `grid-template-columns`
between the header and all rows. Numeric columns `text-right` in the
header and in the values; `.tnum` on every number; `overflow-x:auto` wrapper on tables
with fixed px columns so the last column never disappears.

## 8. Buttons

- **One dominant action per decision scope**, filled (`bg-accent text-white`,
  radius 4px, ~38px), next to the context. A screen may contain independent
  contexts, as long as there is no visual competition between primary actions in the
  same decision block. The dominant action **does not need** to be in the rail.
- Secondary: surface + border, discreet (~34px), icon + text.
- Positive (e.g.: Finalizar): soft greens.
- **Destructive (Excluir): always icon + text**, discreet red — never icon only.
- No redundancy: do not repeat at the top a shortcut/data that already exists as a link/section.

### 8.1 Row-level compact icon button — `COMPONENT-SPECIFIC`

Table/grid row actions (Editar, Ver, Ativar/Desativar, Resetar, Excluir,
etc., inside a list row) are a distinct component from the entity-level
header actions above and are **exempt** from the "destructive always
icon + text" rule — an icon-only button is accepted here. Ratified
against the Clients screen reference (`js/screens/cadastros.js`,
`screenCadastrosClientes`'s `makeIconButton`).

**The icon + text destructive rule remains binding for entity-level
header actions** (e.g. Finalizar OP / Excluir OP, as built in the two
approved pilots `op-latex-admin.js` / `op-tecelagem-producao-admin.js`)
— this carve-out does not extend there.

**Mandatory guards** — an icon-only row button is exempt from icon+text
only when ALL three hold:

1. **Title tooltip:** the native `title` attribute (and matching
   `aria-label`) states the action in full (e.g. `"Excluir usuário"`,
   never just an icon with no accessible name).
2. **Screen-reader label:** a visually-hidden text label using the
   clip-rect sr-only pattern — never `display:none` (which also hides
   it from assistive tech, defeating the purpose).
3. **Confirmation on destructive actions:** any destructive row action
   (Excluir, Rejeitar, etc.) opens `confirmDialog` (`js/ui.js`) before
   executing — never fires on a single click.

**Ratified values:**

- **Size:** 30×30px.
- **Radius:** `--rv-radius-control` (4px).
- **Border:** `1px solid #eceef1` (rest state).
- **Background:** `#fff` (rest state).
- **Color:** `#8a93a3` (neutral) / `#d6403a` (danger), rest state.
- **Icon:** 14px, per §13 (Feather/Lucide, stroke 1.8–2).
- **Gap** between buttons in the same row-actions group: **6px**.
- **Hover — neutral:** `border-color:#d0d5de; color:#3f4757`.
- **Hover — danger:** `border-color:#fca5a5; background:#fff1f1; color:#c53030`.
- **Disabled:** the safe boolean pattern — the `disabled` key is present
  in the attrs object **only when the condition is `true`**, never
  `disabled: <boolean expression>` unconditionally (see
  `UI-EL-BOOLEAN-ATTR-FIX`); opacity `0.45`, `cursor:default` while
  disabled.

## 9. Forms

- Label/value pair grid: `grid-cols-3`, gap `13px 18px`; 11,5px muted label
  + strong 13,5px/600 value. Links in accent.
- Inputs radius 4px (`--rv-radius-control`), border `--rv-color-input-border`.
- In the rail, inputs `width:100%`.
- Fields appear according to the selected type (e.g.: "Validar e vincular" modal,
  fields per document type).

## 10. Badges — status and stage

Pill ~11,5px/600. **Status** with dot (Preparação blue; Em produção amber).
**Stage** by color (Tecelagem purple; Acabamento teal), always in a soft pill.
When the section header carries a badge on the right, use the chip variant **without
`margin-bottom`** inside `flex align-items:center; justify-content:space-between`.

## 11. Documentos / Attachments

**`COMPONENT-SPECIFIC`** — the slots per type are the attachment component of the
Pedido/OP surfaces (or compatible screens), **not** a requirement of the
central Documentos queue, which chooses the presentation suited to review.

Slots **per type** (Romaneio, NF de entrada, NF de saída — multiple files per
type): label + count badge; full-width file chips (`--rv-color-subtle-bg`,
border `--rv-color-line-100`, red PDF icon + name with ellipsis + size·date
+ remove ×); dashed "Anexar" button per type, `width:100%`. Honest empty
state ("Nenhum arquivo anexado.") — **no fabricated file names nor fake
badges** when the backend does not exist yet; the "Anexar" only signals.

## 12. Modals

Layer above the content (`--rv-z-modal` 200; toast `--rv-z-toast` 250). They inherit
typography, corners (card 6px / control 4px), flat cards and the dominant-action-per-scope
rule. The "Validar e vincular" modal (phase G28-B6) must display
**technical evidence** (read-only) separate from the **human fields**
(editable), with conditional fields per type and explicit actions (validar e
vincular / rejeitar / ignorar / cancelar).

**OPEN — REQUIRES IALEAD DECISION:** exact dimensions, overlay behavior
(scroll-lock, dismiss by outside click/ESC), maximum width and mobile responsiveness
of the modal are not specified in the current sources and must be closed in the design
of G28-B6. The modal's **focus management** is already mandatory (see §15).

## 13. Iconography

**Feather / Lucide** style (stroke 1.8–2, rounded corners). Sizes: nav
16px, section chip 13px, actions 14–16px; default glyph `--rv-color-chip-glyph`.
No heavy filled icons, no emoji, no PNG. Decorative icon is noise —
every chip has a purposeful icon.

## 14. Responsiveness

Full width up to 1600px; cockpit occupies the monitor; fixed-column tables in
`overflow-x:auto`. **OPEN — REQUIRES IALEAD DECISION:** formal breakpoints and
cockpit/rail behavior on narrow screens (stacking the rail below the
content) are not yet fixed.

## 15. Accessibility

Minimum **already mandatory** across the whole UI:

- keyboard operation on the main actions;
- visible focus;
- programmatic labels on controls;
- status not communicated by color alone (dot + label);
- sufficient contrast for status text even in light palettes;
- dark title (`--rv-color-title`) for legibility;
- targets consistent with control height (34–38px);
- the modal will have **focus management**, to be closed in the design of G28-B6.

**OPEN — REQUIRES IALEAD DECISION:** only the **formal conformance target**
(target WCAG level) and the final modal details.

## 16. Terminology

pt-BR. Short labels in Title Case ("Fornecedor de acabamento", "Saldo em
tecelagem"); section labels in UPPERCASE. Short, neutral state messages
("Nenhuma entrega registrada ainda."). Do not use emoji as a substitute for
functional iconography (see §1 and §13).

## 17. Component reuse and Documentos/Pedido/OP continuity

New screens (Documentos, queue, modal, Pedido/OP surfaces) must be born with
the same tokens, cards, tables, badges and the cockpit already used in the OP pilots —
without reinventing color, type, spacing or component. The Documentos section and the
display surfaces in Pedido and OP must consume the same patterns and the
same canonical link.

## 18. Visual validation (mandatory)

All UI must pass through **real rendering in an authorized harness**, in addition to focused
functional tests — do not rely only on screenshot nor only on tests. Rules:

- when `.claude/preview` is available and applicable, use it;
- when it is not available in the worktree, use a versioned harness or
  an explicitly authorized equivalent, and **record the evidence**;
- **no phase may depend exclusively on an untracked file absent from the
  worktree** (see `CLAUDE_PROJECT_ASSET_MAP.md` §13).

Smoke tests that encode the old visual (numbered headers, strips, fixed
grids) must be updated to the new canonical, preserving the **functional**
assertions.

## 19. Prohibitions (simplified solutions)

Any simplified replica that does not fulfill the real requirement is prohibited:
bars/strips in place of icon chip; fixed-column grids in the rail;
narrow `max-width` with lateral gaps; numbered header; pill on button; heavy
shadow; fabricated badges/files without backend; table header misaligned
with the values.

---

> **This is the versioned visual contract.** Consult before any UI phase,
> together with `css/tokens.css` and (when present) the `.claude/design-skill` skill.
> Update when an `OPEN` point is decided by the IAlead or when a new
> pattern is approved in the pilots.
