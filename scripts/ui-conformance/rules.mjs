/* ============================================================
   UI CONFORMANCE — SHARED RULE ENGINE

   One rule set, two front-ends. Every rule below reads the neutral
   unit a front-end produces and the closed enums the contract reader
   parsed; none of them knows whether the screen was written as
   markup or as JavaScript, and none of them contains a numeric enum.

   Severity has three levels and they are not interchangeable:
     · blocking — a contract defect; `--enforce` fails on it;
     · debt     — the ratified transitional compatibility block;
     · coverage — the detector could NOT decide. A coverage finding
                  is the opposite of a pass and must never be read
                  as one.
   ============================================================ */

import { classifyToken } from '../ui-foundation/token-parser.mjs';
import { normalizeValue, resolveCssValue } from './contract.mjs';

export const DETECTOR_VERSION = '1.0.5';

export const RULE_NAMES = {
  'UIC-001': 'LITERAL_VISUAL_COLOUR',
  'UIC-002': 'RADIUS_OUTSIDE_ENUM',
  'UIC-003': 'CONTROL_HEIGHT_OUTSIDE_ENUM',
  'UIC-004': 'SHADOW_OUTSIDE_ENUM',
  'UIC-005': 'TYPOGRAPHY_OUTSIDE_ENUM',
  'UIC-006': 'NATIVE_SELECT',
  'UIC-007': 'PILL_RADIUS_ON_BUTTON',
  'UIC-008': 'CARD_ACTION_ALIGNMENT',
  'UIC-009': 'DEPRECATED_TOKEN_REFERENCE',
  'UIC-010': 'SEMANTIC_PILL_RADIUS_MISUSE',
  'UIC-011': 'UNKNOWN_TOKEN_REFERENCE',
};

export const RULE_IDS = Object.keys(RULE_NAMES);

/** Every hex form, longest-first so `#rrggbbaa` is not truncated. */
const HEX_RE = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})\b/g;
const COLOUR_FN_RE = /\b(?:rgba?|hsla?)\s*\(/g;
const TOKEN_REF_RE = /var\(\s*(--rv-[a-z0-9-]+)/g;

const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea']);
const RADIUS_PROPERTIES = new Set([
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
]);

const FONT_WEIGHT_KEYWORDS = new Map([['normal', '400'], ['bold', '700']]);

const CARD_DIVIDER = '1px solid var(--rv-border-soft)';
const CARD_ACTION_PADDING_TOP = '11px';

/* Colour-site classification lives in the front-ends, where the grammar is
   known. This module only reads the regions they produce — see
   colourContextAt() and ruleLiteralColour() below. */

/* ---------- element roles ---------- */

function attr(element, name) {
  return element.attrMap instanceof Map ? element.attrMap.get(name) : undefined;
}

function hasAttr(element, name) {
  return element.attrMap instanceof Map ? element.attrMap.has(name) : false;
}

export function isControl(element) {
  if (!element) return false;
  if (CONTROL_TAGS.has(element.tag)) return true;
  if (hasAttr(element, 'data-ui-control')) return true;
  if (attr(element, 'role') === 'button') return true;
  // An anchor is a control only when it is dressed as one: an explicit height
  // plus a control surface. A plain link with a height is not a control.
  if (element.tag === 'a' && element.decls.has('height')) {
    return element.decls.has('border') || element.decls.has('background');
  }
  return false;
}

/* ---------- UIC-003 generic control-height eligibility ----------

   The ratified generic ladder governs one family of controls: primary,
   secondary and compact actions, single-line fields and field-like popover
   triggers. Three kinds of site are NOT members of that family, and forcing a
   ladder rung onto them would invent geometry the visual contract never
   ratified:

     · specialized native input primitives (checkbox, radio, range, hidden);
     · multiline textareas, whose height is a content behaviour;
     · statically proven visually hidden controls, which have no rendered box.

   Being outside the ladder is NOT a pass. These sites are carried by the
   explicit UI-SPECIALIZED-CONTROL-CONTRACT-GAP inventory, which the phase-5
   pass-3 suite freezes by semantic signature, and a future component-contract
   order owns their real geometry.

   `isControl()` is deliberately left alone: UIC-006, UIC-007 and UIC-010 read
   it, and widening or narrowing it here would move findings under rules this
   pass does not own. */

const SPECIALIZED_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'hidden']);

/** ≤ 1px, so the element occupies no readable visual box. */
function isHairline(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d*\.?\d+)px$/.exec(value.trim());
  return match ? Number(match[1]) <= 1 : false;
}

/**
 * A visually hidden control, proven structurally rather than by path.
 *
 * Either the ratified `sr-only` class token, or the full inline pattern:
 * absolutely positioned, clipped away, and collapsed to a hairline box. A
 * partial match is NOT accepted — an ordinary 1px button with no clipping
 * stays a defect.
 */
export function isVisuallyHiddenControl(element) {
  if (!element) return false;
  if (element.classes instanceof Set && element.classes.has('sr-only')) return true;
  if (!(element.decls instanceof Map)) return false;
  if (normalizeValue(element.decls.get('position') || '') !== 'absolute') return false;
  if (!element.decls.has('clip') && !element.decls.has('clip-path')) return false;
  return isHairline(element.decls.get('width')) && isHairline(element.decls.get('height'));
}

/** A native primitive whose geometry the generic ladder does not govern. */
export function isSpecializedControl(element) {
  if (!element) return false;
  if (element.tag === 'textarea') return true;
  if (element.tag !== 'input') {
    // A type carried from a statically bound factory element proves the
    // primitive even where the tag itself was assigned after construction.
    return SPECIALIZED_INPUT_TYPES.has(String(attr(element, 'type') || '').toLowerCase());
  }
  return SPECIALIZED_INPUT_TYPES.has(String(attr(element, 'type') || '').toLowerCase());
}

/**
 * Does the ratified generic height ladder govern this element's height?
 *
 * The rungs themselves are never named here — they are read from the contract
 * enum at run time, exactly like every other numeric bound in this module.
 *
 * Order matters and is fixed by the pass-3 ruling: a statically specialized or
 * non-visual site is answered BEFORE role resolution, so a proven checkbox is
 * never reported as an unproven generic control. Everything else falls through
 * to the unchanged `isControl()` semantics.
 */
export function isGenericControlHeightTarget(element) {
  if (!element) return false;
  if (isVisuallyHiddenControl(element)) return false;
  if (isSpecializedControl(element)) return false;
  return isControl(element);
}

export function isButtonLike(element) {
  if (!element) return false;
  if (element.tag === 'button') return true;
  if (attr(element, 'role') === 'button') return true;
  if (hasAttr(element, 'data-ui-control')) return true;
  if (element.tag === 'a' && element.decls.has('cursor') && element.decls.has('height')) return true;
  return false;
}

function backgroundOf(element) {
  return element.decls.get('background') || element.decls.get('background-color') || '';
}

export function isSemanticPill(element) {
  if (/var\(\s*--rv-(?:pill|stage)-/.test(backgroundOf(element))) return true;
  for (const cls of element.classes ?? []) {
    if (/(?:^|[-_])(?:pill|badge|status|stage|chip-count)(?:[-_]|$)/i.test(cls)) return true;
  }
  return hasAttr(element, 'data-ui-pill');
}

export function isTrueCircle(element) {
  const w = element.decls.get('width');
  const h = element.decls.get('height');
  return Boolean(w) && Boolean(h) && normalizeValue(w) === normalizeValue(h);
}

function isCardChip(element) {
  return backgroundOf(element).includes('--rv-chip-bg');
}

/* ---------- value helpers ---------- */

function resolve(tokens, value) {
  return resolveCssValue(tokens, value);
}

function lengthsPx(value) {
  return [...String(value).matchAll(/(-?\d*\.?\d+)px\b/g)].map((m) => Number(m[1]));
}

/* ---------- UIC-004: elevation versus non-elevation (A1 ruling) ---------- */

/** A length that is zero, however it is spelled (`0`, `0px`, `0.00rem`). */
const ZERO_LENGTH_RE = /^[+-]?0+(?:\.0+)?(?:px|em|rem)?$/;
/** A strictly positive length. The unit is required, so a bare `3` is not one. */
const POSITIVE_LENGTH_RE = /^\+?(?:\d+\.?\d*|\.\d+)(?:px|em|rem)$/;

function isZeroLength(part) {
  return ZERO_LENGTH_RE.test(part);
}

function isPositiveLength(part) {
  return POSITIVE_LENGTH_RE.test(part) && Number.parseFloat(part) > 0;
}

function isLengthSlot(part) {
  return isZeroLength(part) || isPositiveLength(part);
}

/**
 * Split one `box-shadow` value into its top-level, whitespace-separated slots.
 *
 * Returns `null` when the value cannot be a SINGLE layer — a top-level comma
 * means a second layer, and `inset` means an inner shadow. Commas inside a
 * function (`rgba(0,0,0,.1)`) are at depth > 0 and do not split.
 */
function singleShadowLayerSlots(value) {
  const text = String(value).trim();
  if (!text) return null;
  if (/(?:^|[\s(])inset(?:[\s)]|$)/i.test(text)) return null;

  const slots = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;

    if (depth === 0 && ch === ',') return null;
    if (depth === 0 && /\s/.test(ch)) {
      if (current) slots.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) slots.push(current);
  return slots;
}

/**
 * A NON-ELEVATION SPREAD RING — a focus indicator or a connector knockout.
 *
 * UIC-004 governs ELEVATION only (A1 ruling §2), so a declaration that
 * statically decodes to exactly one layer with zero horizontal offset, zero
 * vertical offset, zero blur, a positive spread and one colour slot is not
 * measured against the three-value elevation enum. It is carried instead by
 * the exact non-elevation inventory, which is frozen by the focused suite.
 *
 * The test is structural and complete-or-nothing: it names no path, line,
 * token, literal colour or filename, and it is not a suppression mechanism.
 * Anything it cannot decode falls through to the elevation enum unchanged.
 */
function isNonElevationSpreadRing(value) {
  const slots = singleShadowLayerSlots(value);
  if (!slots || slots.length !== 5) return false;

  // The four lengths are contiguous and in order; the single remaining slot
  // is the colour or colour token, at the head or the tail as CSS allows.
  let lengths = null;
  if (!isLengthSlot(slots[4]) && slots.slice(0, 4).every(isLengthSlot)) {
    lengths = slots.slice(0, 4);
  } else if (!isLengthSlot(slots[0]) && slots.slice(1, 5).every(isLengthSlot)) {
    lengths = slots.slice(1, 5);
  }
  if (!lengths) return false;

  const [offsetX, offsetY, blur, spread] = lengths;
  return isZeroLength(offsetX) && isZeroLength(offsetY) && isZeroLength(blur) && isPositiveLength(spread);
}

/** The token that owns pill geometry. Its VALUE is never written here. */
const PILL_RADIUS_TOKEN = '--rv-radius-pill';

/** Rule-7 threshold: a radius this large is pill geometry whatever it spells. */
const PILL_MIN_PX = 20;

/**
 * Is this radius value pill geometry? Either the semantic token, its
 * canonical value as declared in css/tokens.css, or any radius at or above
 * the rule-7 threshold.
 */
function pillRadius(tokens, raw, resolvedValue) {
  if (String(raw).includes(PILL_RADIUS_TOKEN)) return `token ${PILL_RADIUS_TOKEN}`;
  const normalized = normalizeValue(resolvedValue);
  const canonical = tokens.values.get(PILL_RADIUS_TOKEN);
  if (canonical && valueParts(normalized).includes(normalizeValue(canonical))) {
    return `literal ${canonical}`;
  }
  const big = lengthsPx(normalized).filter((n) => n >= PILL_MIN_PX);
  if (big.length > 0) return `literal radius ${big[0]}px, at or above the ${PILL_MIN_PX}px threshold`;
  return null;
}

function valueParts(value) {
  return normalizeValue(value)
    .split('/')
    .join(' ')
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);
}

/* ---------- finding constructor ---------- */

function makeFinding(unit, meta) {
  return {
    rule_id: meta.rule_id,
    severity: meta.severity,
    path: unit.path,
    line: meta.line,
    column: meta.column ?? null,
    front_end: unit.frontEnd,
    archetype: unit.archetype ?? null,
    property: meta.property ?? null,
    observed_value: meta.observed_value ?? null,
    resolved_value: meta.resolved_value ?? null,
    element_or_context: meta.element_or_context ?? null,
    message: meta.message,
  };
}

/* ---------- rules ---------- */

/**
 * The innermost classified region containing `offset`, or null.
 *
 * Innermost wins, so a colour-bearing attribute inside a markup string beats the
 * string's own copy classification, and a decoded declaration value beats both.
 */
function colourContextAt(unit, offset) {
  let best = null;
  for (const region of unit.colourContexts ?? []) {
    if (offset < region.start || offset >= region.end) continue;
    if (best === null || region.end - region.start < best.end - best.start) best = region;
  }
  return best;
}

/**
 * UIC-001 has three outcomes, decided by SYNTAX and nothing else.
 *
 * A colour-shaped run is blocking only where the front-end proved it is a visual
 * value — a decoded CSS declaration, a style expression bound to a CSS property,
 * a colour-bearing markup attribute, or a JavaScript key that carries a colour.
 * It is silent where the front-end proved the opposite: copy, a placeholder, a
 * label, an identifier, a route, a non-visual attribute, a comment. Where
 * neither is proven it is a COVERAGE GAP, never a defect.
 *
 * There is no path, line or value suppression anywhere in this rule. A given
 * value is silent in a placeholder because the placeholder is a proven
 * non-visual site, and blocking inside `color:` because that is a proven
 * visual one. The value itself never enters the decision.
 */
function ruleLiteralColour(unit, ctx, out) {
  if (!ctx.enums.literalHexForbidden) return;

  for (const source of unit.sources) {
    for (const re of [HEX_RE, COLOUR_FN_RE]) {
      re.lastIndex = 0;
      for (const m of source.text.matchAll(re)) {
        const offset = source.offset + m.index;
        const region = colourContextAt(unit, offset);

        if (region && region.kind === 'nonvisual') continue;

        const at = unit.locate(offset);
        if (!region) {
          out.push(
            makeFinding(unit, {
              rule_id: 'UIC-001',
              severity: 'coverage',
              line: at.line,
              column: at.column,
              property: null,
              observed_value: m[0],
              element_or_context: source.context ?? 'screen source',
              message: `COVERAGE_GAP / VISUAL_COLOUR_CONTEXT_UNPROVEN — "${m[0]}" is colour-shaped but the front-end could prove neither a visual nor a non-visual site for it. It is not counted as a colour defect.`,
            }),
          );
          continue;
        }

        out.push(
          makeFinding(unit, {
            rule_id: 'UIC-001',
            severity: 'blocking',
            line: at.line,
            column: at.column,
            property: region.property,
            observed_value: m[0],
            element_or_context: region.context,
            message: `Literal visual colour "${m[0]}" in a screen. Values are owned by css/tokens.css; reference var(--rv-*).`,
          }),
        );
      }
    }
  }
}

function ruleRadius(unit, ctx, out) {
  for (const decl of unit.declarations) {
    if (!RADIUS_PROPERTIES.has(decl.property)) continue;
    if (decl.interpolated) continue;
    const { value: resolved, unresolved } = resolve(ctx.tokens, decl.value);
    const at = unit.locate(decl.valueOffset);
    if (unresolved.length > 0) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-002',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: decl.property,
          observed_value: decl.value,
          resolved_value: null,
          element_or_context: decl.element.context,
          message: `Radius references ${unresolved.join(', ')}, which does not resolve in css/tokens.css, so it cannot be proved inside the enum.`,
        }),
      );
      continue;
    }
    const bad = valueParts(resolved).filter((p) => !ctx.enums.radius.has(p));
    if (bad.length === 0) continue;
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-002',
        severity: 'blocking',
        line: at.line,
        column: at.column,
        property: decl.property,
        observed_value: decl.value,
        resolved_value: resolved,
        element_or_context: decl.element.context,
        message: `Radius ${bad.join(', ')} is outside the contract enum [${[...ctx.enums.radius].join(', ')}].`,
      }),
    );
  }
}

function ruleControlHeight(unit, ctx, out) {
  for (const decl of unit.declarations) {
    if (decl.property !== 'height') continue;
    if (decl.interpolated) continue;
    // (A) A statically proven specialized or visually hidden site is answered
    // before role resolution: the generic ladder does not govern it, so it is
    // neither a defect nor an unproven role. It is carried instead by
    // UI-SPECIALIZED-CONTROL-CONTRACT-GAP.
    if (isVisuallyHiddenControl(decl.element) || isSpecializedControl(decl.element)) continue;
    // (C) Otherwise the role must be resolved before the ladder can be applied.
    if (!decl.element.roleResolved) {
      // A height on an element whose tag the front-end could not recover may
      // or may not be a control height. Reporting neither a pass nor a defect
      // is the only honest answer.
      const where = unit.locate(decl.valueOffset);
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-003',
          severity: 'coverage',
          line: where.line,
          column: where.column,
          property: 'height',
          observed_value: decl.value,
          element_or_context: decl.element.context,
          message: 'COVERAGE_GAP / CONTROL_ROLE_UNPROVEN — a height on an element whose role the detector could not resolve. This is not a pass.',
        }),
      );
      continue;
    }
    // (D) A resolved generic control is measured against the ratified ladder.
    if (!isGenericControlHeightTarget(decl.element)) continue;
    const { value: resolved, unresolved } = resolve(ctx.tokens, decl.value);
    const at = unit.locate(decl.valueOffset);
    if (unresolved.length > 0) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-003',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'height',
          observed_value: decl.value,
          element_or_context: decl.element.context,
          message: `Control height references ${unresolved.join(', ')}, which does not resolve in css/tokens.css.`,
        }),
      );
      continue;
    }
    if (ctx.enums.controlHeight.has(normalizeValue(resolved))) continue;
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-003',
        severity: 'blocking',
        line: at.line,
        column: at.column,
        property: 'height',
        observed_value: decl.value,
        resolved_value: resolved,
        element_or_context: decl.element.context,
        message: `Control height ${resolved} is outside the contract ladder [${[...ctx.enums.controlHeight].join(', ')}].`,
      }),
    );
  }
}

/**
 * UIC-004 — SHADOW_OUTSIDE_ENUM, elevation only (detector 1.0.5, A1 ruling).
 *
 * Evaluation order:
 *   A. a statically proven non-elevation spread ring is excluded and carried
 *      by the non-elevation inventory;
 *   B. otherwise the value is resolved through the canonical tokens;
 *   C. an unresolved value is blocking;
 *   D. a resolved value outside the three-value elevation enum is blocking;
 *   E. a statically proven CARD carrying a non-none elevation shadow is
 *      blocking — cards are flat;
 *   F. otherwise there is no finding.
 *
 * The CARD_MEMBERSHIP_UNPROVEN coverage branch was REMOVED by the A1 ruling.
 * It required every non-none shadow to prove card containment, which the
 * JavaScript front-end can never do — it deliberately exposes no ancestor
 * stack — so it made the rule unclosable rather than informative. "Cards are
 * flat" now applies to the element CARRYING the shadow, not to every
 * descendant that happens to sit inside a card.
 */
function ruleShadow(unit, ctx, out) {
  for (const decl of unit.declarations) {
    if (decl.property !== 'box-shadow') continue;
    if (decl.interpolated) continue;
    // (A) Focus rings and connector knockouts are not elevation.
    if (isNonElevationSpreadRing(decl.value)) continue;
    const { value: resolved, unresolved } = resolve(ctx.tokens, decl.value);
    const at = unit.locate(decl.valueOffset);
    const normalized = normalizeValue(resolved);

    if (unresolved.length > 0) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-004',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'box-shadow',
          observed_value: decl.value,
          element_or_context: decl.element.context,
          message: `Shadow references ${unresolved.join(', ')}, which does not resolve through a canonical token.`,
        }),
      );
      continue;
    }
    if (!ctx.enums.shadow.has(normalized)) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-004',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'box-shadow',
          observed_value: decl.value,
          resolved_value: resolved,
          element_or_context: decl.element.context,
          message: `Shadow ${resolved} is outside the three-value elevation enum.`,
        }),
      );
    }

    if (normalized === 'none') continue;

    // (E) Cards are flat — judged on the element that CARRIES the shadow.
    if (decl.element.isCard) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-004',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'box-shadow',
          observed_value: decl.value,
          resolved_value: resolved,
          element_or_context: decl.element.context,
          message: 'Cards are flat. A card may declare no elevation shadow other than none.',
        }),
      );
    }
  }
}

function ruleTypography(unit, ctx, out) {
  for (const decl of unit.declarations) {
    if (decl.interpolated) continue;
    if (decl.property === 'font-size') {
      const { value: resolved, unresolved } = resolve(ctx.tokens, decl.value);
      const at = unit.locate(decl.valueOffset);
      if (unresolved.length > 0) {
        out.push(
          makeFinding(unit, {
            rule_id: 'UIC-005',
            severity: 'blocking',
            line: at.line,
            column: at.column,
            property: 'font-size',
            observed_value: decl.value,
            element_or_context: decl.element.context,
            message: `Font size references ${unresolved.join(', ')}, which does not resolve in css/tokens.css.`,
          }),
        );
        continue;
      }
      if (ctx.enums.fontSize.has(normalizeValue(resolved))) continue;
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-005',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'font-size',
          observed_value: decl.value,
          resolved_value: resolved,
          element_or_context: decl.element.context,
          message: `Font size ${resolved} is outside the ten-value contract enum.`,
        }),
      );
      continue;
    }
    if (decl.property !== 'font-weight') continue;
    const { value: resolved } = resolve(ctx.tokens, decl.value);
    const normalized = normalizeValue(resolved);
    const weight = FONT_WEIGHT_KEYWORDS.get(normalized) ?? normalized;
    if (ctx.enums.fontWeight.has(weight)) continue;
    const at = unit.locate(decl.valueOffset);
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-005',
        severity: 'blocking',
        line: at.line,
        column: at.column,
        property: 'font-weight',
        observed_value: decl.value,
        resolved_value: resolved,
        element_or_context: decl.element.context,
        message: `Font weight ${resolved} is outside the contract enum [${[...ctx.enums.fontWeight].join(', ')}].`,
      }),
    );
  }
}

function ruleNativeSelect(unit, ctx, out) {
  if (!ctx.enums.nativeSelectForbidden) return;
  for (const hit of unit.selects) {
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-006',
        severity: 'blocking',
        line: hit.line,
        column: hit.column,
        property: null,
        observed_value: hit.context,
        element_or_context: hit.context,
        message: 'Native <select> on a product surface. The open list is browser-drawn; D8 requires an own popover.',
      }),
    );
  }
}

function ruleRadiusRoles(unit, ctx, out) {
  for (const decl of unit.declarations) {
    if (decl.property !== 'border-radius') continue;
    if (decl.interpolated) continue;
    const { value: resolved } = resolve(ctx.tokens, decl.value);
    const pill = pillRadius(ctx.tokens, decl.value, resolved);
    if (!pill) continue;
    const element = decl.element;
    const at = unit.locate(decl.valueOffset);

    if (ctx.enums.pillRadiusOnButtonForbidden && isButtonLike(element)) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-007',
          severity: 'blocking',
          line: at.line,
          column: at.column,
          property: 'border-radius',
          observed_value: decl.value,
          resolved_value: resolved,
          element_or_context: element.context,
          message: `Pill radius (${pill}) on a button or button-equivalent control. Never a pill (§2.1, §6).`,
        }),
      );
      continue;
    }

    if (!element.roleResolved) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-010',
          severity: 'coverage',
          line: at.line,
          column: at.column,
          property: 'border-radius',
          observed_value: decl.value,
          resolved_value: resolved,
          element_or_context: element.context,
          message: 'COVERAGE_GAP / PILL_ROLE_UNPROVEN — pill radius on an element whose role the detector could not resolve. D6.1 cannot be decided here.',
        }),
      );
      continue;
    }

    if (isSemanticPill(element) || isTrueCircle(element)) continue;

    const why = isCardChip(element)
      ? 'a section icon chip'
      : element.isCard
        ? 'a card'
        : isControl(element)
          ? 'a control'
          : 'an ordinary rectangular container';
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-010',
        severity: 'blocking',
        line: at.line,
        column: at.column,
        property: 'border-radius',
        observed_value: decl.value,
        resolved_value: resolved,
        element_or_context: element.context,
        message: `D6.1: --rv-radius-pill is limited to semantic pills and true circles; this is ${why}.`,
      }),
    );
  }
}

function ruleCardActions(unit, ctx, out) {
  const allowed = ['flex-end', 'space-between'];

  for (const row of unit.actionRows) {
    const justify = row.decls.get('justify-content');
    if (!justify) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-008',
          severity: 'blocking',
          line: row.line,
          column: row.column,
          property: 'justify-content',
          observed_value: null,
          element_or_context: row.context,
          message: 'A row marked data-card-actions declares no justify-content; alignment is undefined.',
        }),
      );
      continue;
    }
    if (!allowed.includes(normalizeValue(justify))) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-008',
          severity: 'blocking',
          line: row.line,
          column: row.column,
          property: 'justify-content',
          observed_value: justify,
          element_or_context: row.context,
          message: `Card action row is ${justify}; the contract allows only flex-end or space-between.`,
        }),
      );
    }

    if (row.insideCard !== true) continue;

    const divider = row.decls.get('border-top');
    const dividerOk =
      divider !== undefined &&
      normalizeValue(resolve(ctx.tokens, divider).value) ===
        normalizeValue(resolve(ctx.tokens, CARD_DIVIDER).value);
    if (!dividerOk) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-008',
          severity: 'blocking',
          line: row.line,
          column: row.column,
          property: 'border-top',
          observed_value: divider ?? null,
          element_or_context: row.context,
          message: `An in-card action row must carry the canonical footer divider ${CARD_DIVIDER}.`,
        }),
      );
    }
    const padTop = row.decls.get('padding-top');
    if (padTop === undefined || normalizeValue(padTop) !== normalizeValue(CARD_ACTION_PADDING_TOP)) {
      out.push(
        makeFinding(unit, {
          rule_id: 'UIC-008',
          severity: 'blocking',
          line: row.line,
          column: row.column,
          property: 'padding-top',
          observed_value: padTop ?? null,
          element_or_context: row.context,
          message: `An in-card action row must carry padding-top: ${CARD_ACTION_PADDING_TOP}.`,
        }),
      );
    }
  }

  if (unit.actionRows.length === 0 && unit.declarations.length > 0) {
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-008',
        severity: 'coverage',
        line: 1,
        column: 1,
        property: 'justify-content',
        observed_value: null,
        element_or_context: 'file',
        message: 'COVERAGE_GAP / ACTION_ROW_UNPROVEN — this screen declares visual values but marks no data-card-actions row, so in-card action alignment could not be evaluated. This is not a pass.',
      }),
    );
  }
}

function ruleTokenReferences(unit, ctx, out) {
  for (const source of unit.sources) {
    TOKEN_REF_RE.lastIndex = 0;
    for (const m of source.text.matchAll(TOKEN_REF_RE)) {
      const token = m[1];
      const kind = classifyToken(ctx.tokens.kinds, token);
      if (kind === 'canonical') continue;
      const at = unit.locate(source.offset + m.index);
      if (kind === 'deprecated') {
        out.push(
          makeFinding(unit, {
            rule_id: 'UIC-009',
            severity: 'debt',
            line: at.line,
            column: at.column,
            property: null,
            observed_value: token,
            element_or_context: source.context ?? 'screen source',
            message: `var(${token}) references the approved deprecated compatibility block. Remove in the property-based remediation phase.`,
          }),
        );
      } else {
        out.push(
          makeFinding(unit, {
            rule_id: 'UIC-011',
            severity: 'blocking',
            line: at.line,
            column: at.column,
            property: null,
            observed_value: token,
            element_or_context: source.context ?? 'screen source',
            message: `var(${token}) does not resolve to any declaration in css/tokens.css.`,
          }),
        );
      }
    }
  }
}

/* ---------- coverage ---------- */

/**
 * FULL means every rule was fully evaluated for this file — not merely that
 * the file parsed. A front-end construct that could not be decoded, or a rule
 * that could not reach a verdict, degrades the file to PARTIAL.
 *
 * @param {object} unit
 * @param {object[]} [findings] result of `runRules` for the same unit
 */
export function coverageOf(unit, findings = []) {
  if (unit.lexError) return 'UNSUPPORTED';
  if (unit.indeterminate.length > 0) return 'PARTIAL';
  return findings.some((f) => f.severity === 'coverage') ? 'PARTIAL' : 'FULL';
}

/**
 * Run every rule against one front-end unit.
 *
 * @param {object} unit output of a front-end `analyse()`
 * @param {{tokens: object, enums: object}} ctx
 */
export function runRules(unit, ctx) {
  const out = [];

  if (unit.lexError) {
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-000',
        severity: 'coverage',
        line: unit.lexError.line,
        column: unit.lexError.column,
        property: null,
        observed_value: null,
        element_or_context: 'file',
        message: `UNSUPPORTED — ${unit.lexError.message} No rule was evaluated for this file; it is NOT conforming.`,
      }),
    );
    return out;
  }

  ruleLiteralColour(unit, ctx, out);
  ruleRadius(unit, ctx, out);
  ruleControlHeight(unit, ctx, out);
  ruleShadow(unit, ctx, out);
  ruleTypography(unit, ctx, out);
  ruleNativeSelect(unit, ctx, out);
  ruleRadiusRoles(unit, ctx, out);
  ruleCardActions(unit, ctx, out);
  ruleTokenReferences(unit, ctx, out);

  for (const gap of unit.indeterminate) {
    out.push(
      makeFinding(unit, {
        rule_id: 'UIC-000',
        severity: 'coverage',
        line: gap.line,
        column: gap.column,
        property: null,
        observed_value: null,
        element_or_context: gap.context,
        message: `COVERAGE_GAP / ${gap.reason} — this construct could not be decoded to a concrete value, so no rule was applied to it.`,
      }),
    );
  }

  return out;
}

/** Stable order: path, line, column, rule, observed value. */
export function sortFindings(findings) {
  const key = (f) => [
    f.path,
    String(f.line ?? 0).padStart(9, '0'),
    String(f.column ?? 0).padStart(9, '0'),
    f.rule_id,
    String(f.observed_value ?? ''),
    String(f.property ?? ''),
    f.message,
    // U+0000 cannot occur in any field, so it separates without colliding.
  ].join('\u0000');
  return findings.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export function isBlocking(finding) {
  return finding.severity === 'blocking';
}
