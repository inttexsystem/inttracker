# VISUAL CONTRACT — INTTRACKER

> **Version** 2.0 · 2026-07-25 · fully replaces v1 (`G28-P0`).
> **Precedence:** this contract prevails over any skill. A skill teaches how to apply
> the pattern; it cannot contradict the contract.
> **Values:** SGAA. **Geometry:** measured in the approved fixture. **Nothing invented.**
>
> **Language:** this document — and all project documentation — is English.
> **All product UI copy is pt-BR.** See §7.

---

## 0. How this document works

Four layers, **one owning file each**. No value exists in two places.

| Layer | Owner | Holds |
|---|---|---|
| 1 · Tokens | `css/tokens.css` | every visual value in the product |
| 2 · Primitives | this file, §2 | the 11 components and their states |
| 3 · Archetypes | this file, §3 | the 6 screen families and their intent |
| 4 · Conformance | `docs/architecture/UI_CONFORMANCE.md` | screen → archetype → state |

Three writing rules, so the document cannot drift again:

1. **Prose is justification, never a source of value.** Every mandatory value lives in
   `tokens.css` or in a §5 enum. If you must interpret a sentence to learn a number,
   the number is in the wrong place.
2. **A reference is a file, not a description.** Every primitive and archetype points
   to a versioned **fixture**. Descriptions drift; files do not.
3. **Facts here, reasons in the log.** This file says what IS. Why and history live in
   `DESIGN_DECISIONS.md`, which is append-only and never rewritten.

---

## 1. Layer 1 — Tokens

**Single source:** `css/tokens.css`. Prefix `--rv-*`, SGAA semantic names, SGAA values.

**Forbidden:**
- literal hex in any screen — always `var(--rv-*)`;
- a second token namespace (`.claude/design-skill/tokens/*` and
  `Inttex UI Skill/tokens/*` are **historical reference**, not sources);
- any shape, height, shadow or type value outside the §5 enums.

**Re-theming** = edit only the `BRAND / ACTION` block of `tokens.css`.

Three colour families coexist with defined jobs — this is deliberate, not accidental:

| Family | Where | Why |
|---|---|---|
| **Bare signal** (`--rv-signal-*`, vivid) | number, icon, button | colour is the sole carrier of meaning |
| **Status pill** (`--rv-pill-*`, muted) | state pill | background + border + dot already carry the state |
| **Stage** (`--rv-stage-*`) | stage badge | stage ≠ status; never the same colour for both |

**Cross-cutting rule:** background, border and text of one element always come from
**the same family**. Mismatched chroma between fill and border is a defect.

---

## 2. Layer 2 — Primitives

**Closed list.** A new component requires a new entry here and in the log.

### 2.1 Button

Three heights (`--rv-h-compact/default/primary`), radius `--rv-radius`,
`font-family: inherit`. Icon on the left, 14–16px, gap 7px. Never a pill.

| Variant | Background | Border | Text | Height |
|---|---|---|---|---|
| Primary | `--rv-brand` | none | `--rv-text-on-brand` | 38px |
| Secondary | `--rv-surface` | `--rv-border-strong` | `--rv-text-secondary` | 34px |
| Positive | `--rv-signal-positive-bg` | `--rv-signal-positive-border` | `--rv-signal-positive` | 34px |
| Destructive | `--rv-surface` | `--rv-signal-negative-border` | `--rv-signal-negative` | 34px |
| Compact | `--rv-surface` | `--rv-border-strong` | `--rv-text-secondary` | 32px |
| Attach (dashed) | `--rv-surface` | `1px dashed --rv-border-strong` | `--rv-text-secondary` | 32px, `width:100%` |

- **One dominant action per decision scope.** A screen may hold independent scopes;
  it may not hold two primaries competing in the same block.
- **Entity-level destructive: icon + text**, always. Single exception: table-row
  action (§2.9).
- **Disabled:** the `disabled` key enters the attribute object **only when the
  condition is `true`** — never as an unconditional boolean expression.
  Opacity `.45`, `cursor: default`.

**Alignment** — closed rule, checkable:
- entity header: bar right-aligned, `align-items: flex-start` (aligns to the **top of
  the title block**), gap 8px, `flex-wrap` on the parent;
- inside a card: **block footer, right-aligned**, with
  `border-top: 1px solid var(--rv-border-soft)` and `padding-top: 11px`;
- card with an empty state: empty text left, action right, same row
  (`justify-content: space-between`);
- **two exceptions, only two:** in the rail every control is `width:100%`; the dashed
  attach button is `width:100%` per document type.

A left-aligned button inside a card is a defect.

### 2.2 Field

Height `--rv-h-compact`, radius `--rv-radius`, border `--rv-border-strong`,
background `--rv-surface`. Hover: background `--rv-surface-subtle`, border
`--rv-accent-blue`. Focus: border `--rv-accent-blue` +
`box-shadow: 0 0 0 3px var(--rv-focus-ring)`. In the rail, `width:100%`.

### 2.3 Popover / dropdown / menu

**Native `<select>` is forbidden on product surfaces.** `appearance:none` styles only
the closed field; the open list is browser-drawn and accepts no padding, radius,
shadow, item colour or selected background. Use an own popover.

Panel: background `--rv-surface`, border `--rv-border-strong`, radius `--rv-radius`,
`box-shadow: var(--rv-shadow-popover)`, `padding: 5px`, `margin-top: 6px`.
Group label: `--rv-fs-thead`/700 uppercase, `--rv-text-tertiary`, `padding: 5px 7px 4px`.
Item: `padding: 7px 8px`, radius `--rv-radius`, `--rv-fs-body`.
Hover: `--rv-surface-subtle`. Selected: `--rv-active-bg` + text `--rv-brand` + 13px check.

The panel's inner inset is what separates this from the legacy look. An item flush
against the panel edge is a defect.

### 2.4 Card and section chip

Card: background `--rv-surface`, border `1px solid --rv-border`, radius `--rv-radius`,
**flat** (`--rv-shadow-none`), padding `--rv-pad-card` (`--rv-pad-card-rail` in the rail).

Every section opens with a **20px icon chip** (radius `--rv-radius`, background
`--rv-chip-bg`, 13px glyph `var(--rv-chip-glyph)`) + `--rv-fs-label`/700 uppercase
`--rv-text-tertiary` label, gap 8px. **A distinct icon per section.**

Forbidden in place of the chip: vertical coloured bar, solid strip, border
pseudo-icon, numbered header ("1. Dados").

### 2.5 Table — golden rule

**The width and alignment of each column's HEADER must be identical to those of its
VALUES.** Guarantee it with `table-layout: fixed` + `<colgroup>` and `text-align`
repeated on `th`/`td`, **or** a `grid-template-columns` shared between header and rows.

Header `--rv-fs-thead`/600 uppercase `--rv-text-tertiary`, `padding: 0 8px 8px`.
Row `border-top: 1px solid --rv-border-soft`, `padding-y` 9–10px, cell `--rv-fs-body`.
Numeric column: `text-align: right` **in the header and in the value**, `.tnum` on
every number. `overflow-x: auto` wrapper whenever a column has a fixed px width.

A free-text cell sharing a column with fixed-width siblings renders single-line with
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0` plus a
`title` carrying the untruncated value — omitted when the displayed value is the
placeholder `—`. Long free-text fields (observação, mensagem) wrap; this does not apply.

### 2.6 Status pill

`height: 18px`, `padding: 0 6px`, radius `--rv-radius-pill`, border + background +
text from the `--rv-pill-*` family, 5px dot before. `--rv-fs-2xs`/600.
State is never communicated by colour alone — dot **and** label.

Semantic mapping (single source; do not duplicate in templates):

| Domain state | Family |
|---|---|
| Deferida, Ativo, Conectado, Resolvido, Concluído | `positive` |
| Pendente, Em análise, Reconectar | `caution` |
| Indeferida, Encerrada, Cancelado | `negative` |
| Devolvida | `info` |
| Inativo, Desconectado, Trancado, unknown | `neutral` |

### 2.7 Stage badge

Soft pill `--rv-stage-*-bg` + text `--rv-stage-*`, `padding: 3px 9px`,
`--rv-fs-2xs`/600. No dot (the dot belongs to status).
**Stage and status never share a colour.**

### 2.8 File chip and document slots

Slots **per type** (Romaneio, NF de entrada, NF de saída), multiple files per type:
label + count badge, `width:100%` chips (background `--rv-surface-subtle`, border
`--rv-border-soft`, PDF icon `--rv-signal-negative`, name with ellipsis, size·date,
× to remove), dashed "Anexar" button per type.

Honest empty state ("Nenhum arquivo anexado."). **A fabricated file name or fake
badge without a backend is forbidden.**

### 2.9 Table-row action

A distinct component from entity-header actions. **Exempt** from
"destructive always icon + text" — an icon-only button is accepted here, with three
mandatory guards, all of them:

1. `title` **and** `aria-label` stating the full action ("Excluir usuário");
2. a visually-hidden label using the clip-rect pattern — never `display: none`;
3. a destructive row action opens a confirmation before executing — never fires on a
   single click.

Values: 30×30px, radius `--rv-radius`, border `--rv-border-soft`, background
`--rv-surface`, colour `--rv-text-secondary` (or `--rv-signal-negative`), 14px icon,
6px gap between buttons in a group.

### 2.10 Modal

Layer `--rv-z-modal` (toast `--rv-z-toast`). Inherits typography, radius, flat cards
and the one-dominant-action-per-scope rule. Shadow `--rv-shadow-popover`. Focus
management mandatory.

When technical evidence and human input appear in the same modal, the two blocks are
**visually separated**: evidence read-only, human fields editable, conditional fields
per type, explicit actions.

### 2.11 Empty state and alert

Empty: short honest sentence, `--rv-fs-sm` `--rv-text-tertiary`. Never invented data.

Alert: `min-height: 26px`, `padding: 0 12px`, radius `--rv-radius`,
`box-shadow: var(--rv-shadow-sm)`; background and border come **from the record**
(`--rv-alert-*` or the user's free hex), never hardcoded in the template.
Free colour → derived border: luminance `(0.299R + 0.587G + 0.114B) / 255`;
`> 0.72` mixes 18% black, otherwise 26% white.

---

## 3. Layer 3 — Screen archetypes

An archetype declares **intent**, not appearance. It is what prevents replicating the
cockpit where it does not serve. Every screen belongs to exactly one.

### A · Detail cockpit — `RATIFIED FIXTURE`

**Fixture:** `docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html`
**Intent:** operate a single entity. Read state and act on it in the same screen.
**Density:** maximum. **Dominant action:** flow action, in the rail, 38px.
**Layout:** `grid-template-columns: minmax(0,1fr) var(--rv-rail-w)`, rail
`position: sticky; top: 0`. Content and tables on the left; summary, metrics and the
flow action in the rail. **Never repeat the same datum on both sides.**
**Rail rule:** everything vertical and `width:100%`. A fixed-column grid inside the
rail is forbidden.
**Header:** breadcrumb → H1 + stage badge + status pill → metadata line; state-action
bar right-aligned, 34px.
**Primitives:** 2.1 2.4 2.5 2.6 2.7 2.8 2.10

### B · Work queue — `CANDIDATE`

**Candidate fixture:** `Admin - Lista de OPs.dc.html` (conformance pending)
**Intent:** triage volume and pick the next item. Read many rows, act little.
**Density:** maximum. **Dominant action:** "new", in the header. **Rail: no.**
**Layout:** full width up to `--rv-content-max`. Filters above the table; per-row
action per §2.9. No cockpit — there is no single entity to summarise.
**Primitives:** 2.1 2.2 2.3 2.5 2.6 2.9

### C · Creation form — `CANDIDATE`

**Candidate fixture:** `Novo Pedido.dc.html`
**Intent:** compose a new record. Progress and validation, not reading.
**Density:** medium — fields need air. **Dominant action:** confirm, at the end of the
flow. **Rail:** optional, only for running totals.
**Layout:** one card per logical block; label/value pairs in `repeat(3,1fr)`,
gap `13px 18px`. Fields appear according to the selected type.
**Primitives:** 2.1 2.2 2.3 2.4 2.5 2.11

### D · Decision modal — `CANDIDATE`

**Candidate fixture:** `Modal Movimentar Produção.dc.html`
**Intent:** one decision, closed scope, without leaving context.
**Density:** medium. **Dominant action:** footer, right. **Rail: no.**
**Primitives:** 2.1 2.2 2.3 2.10 2.11

### E · Client portal — `CANDIDATE`

**Candidate fixture:** `Detalhe do Pedido v2.dc.html`
**Intent:** inform someone who does not know the process. Reading, confidence, zero
operation.
**Density:** LOW — the only archetype that breathes. Type one rung larger.
**Dominant action:** none, or exactly one. **Rail: no.**
**Content restriction, not a style one:** never display OP, lot, supplier, latex
company, purchase order, invoice, packing list, cost or margin. See
`RELATORIO_COMPATIBILIZACAO.md` §3.1.
**Primitives:** 2.4 2.6 2.11 (+ stepper, not yet promoted to a primitive)

### F · Configuration — `CANDIDATE`

**Candidate fixture:** `Admin - Parâmetros.dc.html`
**Intent:** adjust the system. Low frequency, high consequence.
**Density:** medium. **Dominant action:** save, per block. **Rail: no.**
**Primitives:** 2.1 2.2 2.3 2.4 2.11

> **An archetype becomes `RATIFIED` only when two of its screens pass the detector.**
> Until then it is `CANDIDATE` and may not be cited as precedent.

---

## 4. Layer 4 — Conformance

`docs/architecture/UI_CONFORMANCE.md`. Screen → archetype → state → fixture.
State is filled **by the detector**, not by eye.

**Remediate by property batch, never by screen.** One colour pass across all screens,
then radius, then height, then alignment. Screen by screen turns every screen into a
fresh judgment call — and fresh judgment calls are where the three visual generations
came from.

---

## 5. Closed enums

What the detector enforces. A value outside these lists is a defect, with no
discretionary exception.

```json
{
  "literal_hex_in_screen": "forbidden",
  "radius":        ["4px", "999px"],
  "control_h":     ["32px", "34px", "38px"],
  "shadow":        ["none", "0 1px 3px rgba(0,0,0,.10)", "0 12px 28px rgba(0,0,0,.10)"],
  "font_size":     ["22px","15px","14px","13.5px","13px","12.5px","12px","11.5px","11px","10.5px"],
  "font_weight":   [400, 500, 600, 700, 800],
  "text_color":    ["--rv-text-title","--rv-text-primary","--rv-text-secondary","--rv-text-tertiary"],
  "gap":           { "stack": "14px", "cols": "16px", "actions": "8px", "row_actions": "6px" },
  "card_padding":  ["15px 17px", "16px 17px"],
  "shell":         { "header": "60px", "sidebar": "190px", "rail": "300px",
                     "content_max": "1600px", "main_pad": "18px 32px 40px" },
  "pill_radius_on_button": "forbidden",
  "native_select":         "forbidden"
}
```

---

## 6. Prohibitions

Any simplified replica that does not meet the real requirement is forbidden:

- literal hex; a second token namespace;
- native `<select>`; popover item flush against the panel edge;
- bar or strip in place of the icon chip; numbered header;
- fixed-column grid inside the rail;
- narrow `max-width` leaving lateral gaps;
- pill radius on a button; shadow on a card; any shadow outside the enum;
- left-aligned button inside a card (outside the two exceptions);
- mismatched chroma between an element's fill and border;
- fabricated badge or file without a backend;
- table header misaligned with its values;
- emoji as a substitute for functional iconography;
- brand teal in a state, badge, pill or indicator.

---

## 7. Language and lexicon

**Documentation is English. Product UI copy is pt-BR.** Do not translate the interface.

pt-BR copy: objective and operational. Short labels in Title Case ("Fornecedor de
acabamento", "Saldo em tecelagem"); section labels UPPERCASE. Short neutral state
messages ("Nenhuma entrega registrada ainda.").

Numbers: decimal comma, explicit unit (`1.000,00 m`, `183,000 kg`), `.tnum` always.
Dates `DD/MM/AAAA`. Icons: Lucide, stroke 1.8–2 — nav 16px, chip 13px, action 14–16px.
No filled icons, no PNG, no emoji.

---

## 8. Accessibility

Mandatory today: keyboard operation on the main actions; visible focus
(`--rv-focus-ring`); programmatic labels on every control; state never conveyed by
colour alone; target sizes consistent with control height; focus management in modals.

**OPEN:** the formal WCAG conformance target. See `DESIGN_DECISIONS.md`.

---

## 9. Validation

All UI passes through **real rendering in an authorised harness**, in addition to
functional tests — do not rely on screenshots alone or tests alone. No phase may
depend exclusively on an untracked file absent from the worktree. Smoke tests that
encode the old visual (numbered headers, strips, fixed grids) are updated to the
canonical form, preserving their **functional** assertions.

---

> Read alongside `css/tokens.css`, `UI_CONFORMANCE.md` and `DESIGN_DECISIONS.md`.
> Update when a decision closes or an archetype is ratified — and record it in the log.
