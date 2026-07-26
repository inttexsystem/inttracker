/* ============================================================
   UI CONFORMANCE — PROTOTYPE FRONT-END (.dc.html)

   Turns one Design Component prototype into the neutral unit the
   shared rule engine consumes. It owns markup grammar and NOTHING
   else: no enum, no threshold and no verdict is decided here.

   Two declaration sources are read — inline `style` / `style-hover`
   attributes and `<style>` rule blocks — because the reference
   fixture uses both and a detector that read only one of them would
   report a clean screen while half its values went unexamined.
   ============================================================ */

import { parseDeclarations } from '../contract.mjs';
import { makeLocator } from '../inventory.mjs';

export const FRONT_END = 'dc-html';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Attributes that carry a colour value directly. Everything else in markup is a
 * non-visual attribute, and the text between tags is copy — so a colour-shaped
 * run in markup is classified by where it sits, never by what it looks like.
 */
export const COLOUR_ATTRIBUTES = new Set([
  'fill', 'stroke', 'color', 'bgcolor', 'stop-color',
  'flood-color', 'lighting-color', 'style', 'style-hover',
]);

const TAG_RE = /<(\/?)([a-zA-Z][-a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE = /([-a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const RAW_TEXT_RE = /<(script|style)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

function blank(text, re) {
  return text.replace(re, (match) => match.replace(/[^\n]/g, ' '));
}

function parseAttributes(raw) {
  const map = new Map();
  ATTR_RE.lastIndex = 0;
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (map.has(name)) continue;
    map.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return map;
}

function classTokens(attrMap) {
  return new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
}

function isCardElement(tag, attrMap) {
  if (tag === 'section') return true;
  if (attrMap.has('data-ui-card')) return true;
  return classTokens(attrMap).has('card');
}

/** The offset of a declaration list inside a `style`-like attribute. */
function attributeValueOffset(raw, tagOffset, attrName) {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(["'])`, 'i');
  const m = re.exec(raw);
  if (!m) return null;
  return tagOffset + m.index + m[0].length;
}

/* ---------- <style> rule blocks ---------- */

function collectStyleRules(text, locate, out) {
  RAW_TEXT_RE.lastIndex = 0;
  for (const block of text.matchAll(RAW_TEXT_RE)) {
    if (block[1].toLowerCase() !== 'style') continue;
    const body = block[3];
    // `<` + tag + attributes + `>` precedes the body; computing the offset from
    // the match groups keeps it exact even for an empty rule block.
    const bodyOffset = block.index + 1 + block[1].length + (block[2] || '').length + 1;
    walkRules(body, bodyOffset, out, locate);
  }
}

function walkRules(css, base, out, locate) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    let depth = 1;
    let j = open + 1;
    for (; j < css.length; j += 1) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const selector = css.slice(i, open).trim();
    const body = css.slice(open + 1, j);
    if (selector.startsWith('@')) {
      walkRules(body, base + open + 1, out, locate);
    } else if (selector) {
      const element = ruleElement(selector);
      for (const decl of parseDeclarations(body, base + open + 1)) {
        out.push({ ...decl, element, source: 'css-rule', interpolated: false, locate });
      }
    }
    i = j + 1;
  }
}

function ruleElement(selector) {
  const last = selector.split(',')[0].trim().split(/\s+|>/).filter(Boolean).pop() || '';
  const tagMatch = /^([a-zA-Z][-a-zA-Z0-9]*)/.exec(last);
  return {
    tag: tagMatch ? tagMatch[1].toLowerCase() : null,
    context: `css rule "${selector.replace(/\s+/g, ' ')}"`,
    attrMap: new Map(),
    decls: new Map(),
    isCard: false,
    insideCard: null,
    roleResolved: Boolean(tagMatch),
  };
}

/* ---------- main ---------- */

/**
 * Analyse one prototype file.
 *
 * @param {string} path repo-relative path, used only for attribution
 * @param {string} text file contents
 * @returns {object} neutral unit for scripts/ui-conformance/rules.mjs
 */
export function analyse(path, text) {
  const locate = makeLocator(text);
  const scannable = blank(text, HTML_COMMENT_RE);
  // Tag scanning must not descend into <script>/<style> bodies; their content
  // is not markup and `a < b` inside a script is not an open tag.
  const markup = blank(scannable, RAW_TEXT_RE);

  const elements = [];
  const declarations = [];
  const indeterminate = [];
  const selects = [];
  const actionRows = [];
  const cards = [];
  const colourContexts = [];
  const tagRanges = [];
  const stack = [];

  TAG_RE.lastIndex = 0;
  for (const m of markup.matchAll(TAG_RE)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const rawAttrs = m[3] || '';
    tagRanges.push([m.index, m.index + m[0].length]);

    if (closing) {
      for (let k = stack.length - 1; k >= 0; k -= 1) {
        if (elements[stack[k]].tag === tag) {
          elements[stack[k]].end = m.index;
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const attrMap = parseAttributes(rawAttrs);
    const { line, column } = locate(m.index);
    const isCard = isCardElement(tag, attrMap);
    const insideCard = stack.some((k) => elements[k].isCard);

    const element = {
      tag,
      line,
      column,
      offset: m.index,
      end: null,
      attrMap,
      classes: classTokens(attrMap),
      decls: new Map(),
      isCard,
      insideCard,
      roleResolved: true,
      context: `<${tag}>`,
      parents: stack.slice(),
    };

    const attrsOffset = m.index + 1 + m[2].length;

    // Every attribute value is a classified region: a colour-bearing attribute
    // is a visual site, anything else in markup is not. Declaration values
    // inside a style attribute are emitted below and, being narrower, win.
    for (const [attrName, rawValue] of attrMap) {
      if (rawValue === '') continue;
      const base = attributeValueOffset(rawAttrs, attrsOffset, attrName);
      if (base === null) continue;
      colourContexts.push({
        start: base,
        end: base + rawValue.length,
        kind: COLOUR_ATTRIBUTES.has(attrName) ? 'visual' : 'nonvisual',
        property: attrName,
        context: `<${tag}> attribute "${attrName}"`,
      });
    }

    for (const attrName of ['style', 'style-hover']) {
      const raw = attrMap.get(attrName);
      if (raw === undefined) continue;
      const base = attributeValueOffset(rawAttrs, attrsOffset, attrName);
      const offset = base === null ? m.index : base;
      for (const decl of parseDeclarations(raw, offset)) {
        if (attrName === 'style') element.decls.set(decl.property, decl.value);
        declarations.push({
          ...decl,
          element,
          source: attrName === 'style' ? 'style-attr' : 'style-hover-attr',
          interpolated: /\{\{|\$\{/.test(decl.value),
          locate,
        });
      }
    }

    const index = elements.push(element) - 1;
    if (isCard) cards.push(element);
    if (tag === 'select') selects.push({ line, column, context: '<select>' });
    if (attrMap.has('data-card-actions')) actionRows.push(element);
    if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rawAttrs)) stack.push(index);
  }

  collectStyleRules(scannable, locate, declarations);

  // A CSS declaration value is a proven visual site, wherever it came from.
  for (const decl of declarations) {
    colourContexts.push({
      start: decl.valueOffset,
      end: decl.valueEnd,
      kind: 'visual',
      property: decl.property,
      context: `style declaration "${decl.property}" on ${decl.element.context}`,
    });
  }

  // Text between tags is copy. `<script>`/`<style>` bodies are deliberately NOT
  // covered: a hex run there is neither markup copy nor a decoded declaration,
  // so it stays unproven rather than being silently absolved.
  RAW_TEXT_RE.lastIndex = 0;
  const covered = tagRanges.concat(
    [...scannable.matchAll(RAW_TEXT_RE)].map((b) => [b.index, b.index + b[0].length]),
  ).sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  for (const [start, end] of covered) {
    if (start > cursor) {
      colourContexts.push({
        start: cursor,
        end: start,
        kind: 'nonvisual',
        property: null,
        context: 'markup text content',
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) {
    colourContexts.push({
      start: cursor,
      end: text.length,
      kind: 'nonvisual',
      property: null,
      context: 'markup text content',
    });
  }

  for (const decl of declarations) {
    if (decl.interpolated) {
      const { line, column } = locate(decl.valueOffset);
      indeterminate.push({
        line,
        column,
        reason: 'TEMPLATE_INTERPOLATED_VALUE',
        context: `${decl.property}: ${decl.value}`,
      });
    }
  }

  return {
    path,
    frontEnd: FRONT_END,
    archetype: null,
    locate,
    elements,
    declarations,
    selects,
    actionRows,
    cards,
    tables: collectTables(markup, elements, locate),
    // HTML comments are blanked so a colour named in a comment is not read as
    // a screen value; offsets are preserved, so attribution is unaffected.
    sources: [{ text: scannable, offset: 0, context: 'markup' }],
    // Markup carries no expression sites: every declaration is literal.
    expressionSites: [],
    colourContexts,
    indeterminate,
    lexError: null,
  };
}

/* ---------- tables ---------- */

function collectTables(markup, elements, locate) {
  const out = [];
  for (const el of elements) {
    if (el.tag !== 'table') continue;
    const end = el.end ?? markup.length;
    const body = markup.slice(el.offset, end);
    const cols = (body.match(/<col\b/gi) || []).length;
    const firstRow = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/i.exec(body);
    const headerCells = firstRow ? (firstRow[1].match(/<t[hd]\b/gi) || []).length : 0;
    const fixed = /table-layout\s*:\s*fixed/i.test(body) ||
      el.decls.get('table-layout') === 'fixed';

    let verdict = 'MANUAL_REVIEW_REQUIRED';
    let reason = 'No <colgroup> and no shared grid-template-columns; header/value width parity is not machine-provable.';
    if (cols > 0 && headerCells > 0) {
      if (cols === headerCells) {
        verdict = 'AUTOMATICALLY_PROVEN';
        reason = `<colgroup> declares ${cols} columns and the header declares ${headerCells} cells${fixed ? ' with table-layout: fixed' : ''}.`;
      } else {
        verdict = 'AUTOMATICALLY_FAILED';
        reason = `<colgroup> declares ${cols} columns but the header declares ${headerCells} cells.`;
      }
    }
    out.push({ line: el.line, column: el.column, verdict, reason, context: '<table>' });
  }
  return out;
}
