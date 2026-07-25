# BRAND ASSETS — INTTEX / INTTRACKER

Final approved files. Usage rules are restated below; the rendered brand documentation
(`Inttex - Identidade Visual.dc.html`) lives in the design project, not in this package.

**Inttex** is the company/brand. **Inttracker** is the product.

---

## Files

| File | What it is | Use |
|---|---|---|
| `inttex-logo.svg` | Horizontal wordmark + symbol, full colour. **This is the primary logo** — the primary and the horizontal are the same artwork. | Light backgrounds. Default on screen. |
| `inttex-logo-light.svg` | Horizontal, light variant | On navy or a dark photo. |
| `inttex-logo-mono.svg` | Horizontal, single colour (navy) | Print, PDF, fax, B&W copy. |
| `inttex-symbol.svg` | Symbol only | Collapsed sidebar, system avatar, seal. |
| `inttex-symbol-light.svg` | Symbol only, light variant | Same rule as the light variant. |
| `inttex-favicon.svg` | Symbol, no wordmark, no background | Browser tab, shortcut. Legible at 16px. |

There is no separate "primary vs. horizontal" pair — `inttex-logo.svg` is both.
Do not generate a second file to fill that slot.

---

## Geometry

The `viewBox` is the asset's native coordinate system, as drawn. The rendered size is
a usage recommendation, not the coordinate system — the SVG scales to any box that
preserves the aspect ratio. Never edit a `viewBox` to reach a target size.

| File | Native `viewBox` | Recommended rendered size | Form |
|---|---|---|---|
| `inttex-logo.svg` | `41.02 277.15 194.57 31.56` | 1000 × 162 px | horizontal |
| `inttex-logo-light.svg` | `41.02 277.15 194.57 31.56` | 1000 × 162 px | horizontal |
| `inttex-logo-mono.svg` | `41.02 277.15 194.57 31.56` | 1000 × 162 px | horizontal |
| `inttex-symbol.svg` | `196.21 245.095 88.08 88.08` | 512 × 512 px | symbol-only |
| `inttex-symbol-light.svg` | `196.21 245.095 88.08 88.08` | 512 × 512 px | symbol-only |
| `inttex-favicon.svg` | `196.21 245.095 88.08 88.08` | 32 × 32 px (legible at 16px) | favicon-oriented |

All six assets are transparent-background: they carry no artboard fill and take the
colour of whatever sits behind them. The `-light` variants are drawn for dark
backgrounds; the full-colour variants assume a light background.

## Asset integrity

`inttex-favicon.svg` currently reuses the same vector artwork as `inttex-symbol.svg`.
The separate filenames represent separate intended uses, not separate drawings — their
SHA-256 is identical (`e416f775aaf8543bc23a3c953ed7613b84afa6d0e2a0d8ec444ca40b4ca1a29a`)
and that is intentional and accepted. Keep both filenames: the favicon slot is expected
to diverge if a tab-optimised variant is ever drawn.

This is the only documented duplicate. Any other pair of brand files sharing a SHA-256
is a packaging error, and `scripts/validate-ui-foundation.mjs` fails on it.

---

## Brand colours

| Name | Value | Scope |
|---|---|---|
| Navy | `#003366` | Primary action, avatar, brand surfaces. Reconciled with SGAA `--brand` (decision D1 round, see `DESIGN_DECISIONS.md`). White on navy: 12.6:1. |
| Teal | `#1296a8` | **Brand signature only.** 3.5:1 on white — graphics, never small text. |
| Graphite | `#20242a` | Lives in the wordmark. Interface text uses `--rv-text-*`. |

**Teal rule.** Teal never communicates state. The Acabamento stage already uses a
blue-green (`#0f9488`); if teal also became a badge, users would read brand as status.
Teal appears in exactly three places: the logo, the login rule, and the printed-document
rule. In no badge, no pill, no indicator. It is the one colour outside SGAA and it is
deliberately scoped.

---

## Usage rules

- **Clear space:** free margin on all sides = **half the symbol height**. No text, icon
  or border enters that band.
- **Minimum size:** 18px on screen, 8mm in print. Below that the wordmark closes up —
  use the symbol alone.
- **Never:** distort, place the colour version on a dark background, add a shadow or
  effect, or recolour.

---

## Tokens

The brand colours are already in `css/tokens.css` as `--rv-brand`, `--rv-brand-teal`,
`--rv-brand-teal-ink`, `--rv-brand-teal-light` and `--rv-brand-graphite`.
Reference the token; never the literal hex.
