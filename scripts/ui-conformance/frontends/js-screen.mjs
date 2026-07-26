/* ============================================================
   UI CONFORMANCE — APPLICATION FRONT-END (js/screens/*.js)

   The application screens are classic `window.*` scripts that build
   the DOM through `el(tag, attrs, ...)`. Every visual value therefore
   lives inside a JavaScript string, and a text-only scan would read
   values out of comments and regular expressions as readily as out
   of markup. So this module lexes.

   No npm parser is authorized and Node exposes none, so the lexer
   below is deliberately narrow: it classifies comments, strings,
   template literals and regular-expression literals, and nothing
   more. It is written to FAIL rather than to guess — an unterminated
   construct, a `/` it cannot classify with certainty, or a style
   value it cannot decode marks the file PARTIAL or UNSUPPORTED. A
   file the lexer could not fully read is never reported as
   conforming.
   ============================================================ */

import { parseDeclarations } from '../contract.mjs';
import { makeLocator } from '../inventory.mjs';

export const FRONT_END = 'js-screen';

/**
 * Placeholder standing in for a `${...}` substitution. One character per
 * source character, so every offset inside a template literal still maps to
 * its real line and column.
 */
const INTERP = String.fromCharCode(1);
const INTERP_RUN_RE = new RegExp(`${INTERP}+`, 'g');

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;

/** After these, a `/` opens a regular expression rather than dividing. */
const REGEX_AFTER_KEYWORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);

const NO_REGEX_AFTER_PUNCT = new Set([')', ']', '}', '++', '--']);

const PUNCTUATORS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=',
  '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
];

export class LexError extends Error {
  constructor(message, offset) {
    super(message);
    this.name = 'LexError';
    this.offset = offset;
  }
}

/** Element factories whose first argument names the tag. */
const FACTORIES = new Set(['el', 'createElement', 'h']);

/* ---------- colour-site classification ----------
   A colour-shaped run in JavaScript is classified by the SYNTAX around it, never
   by the value itself and never by path or line. Three outcomes only: a proven
   visual site, a proven non-visual site, or neither — and "neither" is reported
   as a coverage gap by the rule engine rather than counted as a defect. */

/** CSS properties whose value carries a colour. Kebab-cased keys are matched. */
const COLOUR_CSS_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color', 'border-top', 'border-right', 'border-bottom',
  'border-left', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'border-block-color',
  'border-inline-color', 'outline', 'outline-color', 'box-shadow',
  'text-shadow', 'text-decoration', 'text-decoration-color', 'caret-color',
  'accent-color', 'column-rule', 'column-rule-color',
  'fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color',
]);

/**
 * Object keys that are proven NOT to carry a colour. Deliberately conservative:
 * an ambiguous key such as `text`, `value` or `bg` is left unclassified so the
 * site becomes a coverage gap instead of being absolved or accused.
 */
const NONVISUAL_KEYS = new Set([
  'placeholder', 'title', 'alt', 'href', 'src', 'srcset', 'id', 'name',
  'type', 'for', 'html-for', 'target', 'rel', 'download', 'pattern',
  'autocomplete', 'label', 'aria-label', 'aria-labelledby',
  'aria-describedby', 'class-name', 'class', 'role', 'tab-index',
  'view-box', 'points', 'd', 'transform', 'data-testid', 'key', 'route',
  'hash', 'url', 'path', 'accept', 'lang', 'dir', 'inputmode',
]);

/** Markup and setAttribute attributes that carry a colour value directly. */
const COLOUR_ATTRIBUTES = new Set([
  'fill', 'stroke', 'color', 'bgcolor', 'stop-color',
  'flood-color', 'lighting-color',
]);

/** Is this object key or attribute name a proven colour-bearing site? */
function isVisualKey(rawKey) {
  if (/colou?r$/i.test(rawKey)) return true;
  const kebabKey = kebab(rawKey);
  return COLOUR_CSS_PROPERTIES.has(kebabKey) || COLOUR_ATTRIBUTES.has(kebabKey);
}

/** Is this object key a proven non-colour site? */
function isNonvisualKey(rawKey) {
  return NONVISUAL_KEYS.has(kebab(rawKey).toLowerCase());
}

/* ---------- lexer ---------- */

/**
 * @param {string} text
 * @returns {{type: string, value?: string, start: number, end: number,
 *            contentStart?: number, contentEnd?: number,
 *            chunks?: {start: number, end: number}[]}[]}
 */
export function lex(text) {
  const tokens = [];
  const templates = [];
  let braceDepth = 0;
  let i = 0;
  const n = text.length;

  const previous = () => {
    for (let k = tokens.length - 1; k >= 0; k -= 1) {
      if (tokens[k].type !== 'comment') return tokens[k];
    }
    return null;
  };

  const regexAllowed = () => {
    const p = previous();
    if (!p) return true;
    if (p.type === 'name') return REGEX_AFTER_KEYWORD.has(p.value);
    if (p.type === 'punct') return !NO_REGEX_AFTER_PUNCT.has(p.value);
    return false;
  };

  const scanRegexEnd = () => {
    let j = i + 1;
    let inClass = false;
    while (j < n) {
      const c = text[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '\n') return -1;
      if (inClass) {
        if (c === ']') inClass = false;
      } else if (c === '[') inClass = true;
      else if (c === '/') break;
      j += 1;
    }
    if (j >= n || text[j] !== '/') return -1;
    let k = j + 1;
    while (k < n && ID_PART.test(text[k])) k += 1;
    return k;
  };

  while (i < n) {
    const open = templates[templates.length - 1];
    if (open && open.scanning) {
      let j = i;
      let closed = false;
      while (j < n) {
        const c = text[j];
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === '`') {
          open.chunks.push({ start: open.chunkStart, end: j });
          tokens.push({
            type: 'template',
            start: open.start,
            end: j + 1,
            contentStart: open.start + 1,
            contentEnd: j,
            chunks: open.chunks,
          });
          templates.pop();
          i = j + 1;
          closed = true;
          break;
        }
        if (c === '$' && text[j + 1] === '{') {
          open.chunks.push({ start: open.chunkStart, end: j });
          open.scanning = false;
          open.exprBaseDepth = braceDepth;
          i = j + 2;
          closed = true;
          break;
        }
        j += 1;
      }
      if (!closed) throw new LexError('Unterminated template literal.', open.start);
      continue;
    }

    const c = text[i];

    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\v') {
      i += 1;
      continue;
    }

    if (c === '/' && text[i + 1] === '/') {
      let j = i + 2;
      while (j < n && text[j] !== '\n') j += 1;
      tokens.push({ type: 'comment', start: i, end: j });
      i = j;
      continue;
    }

    if (c === '/' && text[i + 1] === '*') {
      const j = text.indexOf('*/', i + 2);
      if (j === -1) throw new LexError('Unterminated block comment.', i);
      tokens.push({ type: 'comment', start: i, end: j + 2 });
      i = j + 2;
      continue;
    }

    if (c === '/' && regexAllowed()) {
      const end = scanRegexEnd();
      if (end === -1) {
        throw new LexError(
          'A "/" in regular-expression position has no same-line terminator; the grammar is ambiguous here.',
          i,
        );
      }
      tokens.push({ type: 'regex', start: i, end });
      i = end;
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      let terminated = false;
      while (j < n) {
        const d = text[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (d === '\n') break;
        if (d === c) {
          terminated = true;
          break;
        }
        j += 1;
      }
      if (!terminated) throw new LexError('Unterminated string literal.', i);
      tokens.push({
        type: 'string',
        start: i,
        end: j + 1,
        contentStart: i + 1,
        contentEnd: j,
        value: text.slice(i + 1, j),
      });
      i = j + 1;
      continue;
    }

    if (c === '`') {
      templates.push({ start: i, chunkStart: i + 1, chunks: [], scanning: true });
      i += 1;
      continue;
    }

    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(text[j])) j += 1;
      tokens.push({ type: 'name', value: text.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && /[0-9a-zA-Z_.]/.test(text[j])) {
        if (/[eE]/.test(text[j]) && /[+-]/.test(text[j + 1] || '')) j += 1;
        j += 1;
      }
      tokens.push({ type: 'number', value: text.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    if (c === '{') {
      braceDepth += 1;
      tokens.push({ type: 'punct', value: '{', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (c === '}') {
      const top = templates[templates.length - 1];
      if (top && !top.scanning && braceDepth === top.exprBaseDepth) {
        top.scanning = true;
        top.chunkStart = i + 1;
        i += 1;
        continue;
      }
      braceDepth -= 1;
      tokens.push({ type: 'punct', value: '}', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    const punct = PUNCTUATORS.find((p) => text.startsWith(p, i)) ?? c;
    tokens.push({ type: 'punct', value: punct, start: i, end: i + punct.length });
    i += punct.length;
  }

  if (templates.length > 0) {
    throw new LexError('Unterminated template literal.', templates[0].start);
  }
  tokens.sort((a, b) => a.start - b.start);
  return tokens;
}

/* ---------- literal decoding ---------- */

/** Literal content with `${...}` substitutions masked, offsets preserved. */
function literalContent(text, token) {
  if (token.type === 'string') {
    return { content: token.value, start: token.contentStart };
  }
  const start = token.contentStart;
  const chars = new Array(token.contentEnd - token.contentStart).fill(INTERP);
  for (const chunk of token.chunks) {
    for (let k = chunk.start; k < chunk.end; k += 1) {
      chars[k - start] = text[k];
    }
  }
  return { content: chars.join(''), start };
}

function displayValue(value) {
  return value.replace(INTERP_RUN_RE, '${...}');
}

/* ---------- structural helpers ---------- */

function isPunct(token, value) {
  return Boolean(token) && token.type === 'punct' && token.value === value;
}

function isName(token, value) {
  return Boolean(token) && token.type === 'name' && token.value === value;
}

/**
 * The innermost call whose `(` is still open at token `k`.
 * @returns {{openIndex: number, calleeIndex: number}|null}
 */
function enclosingCall(tokens, k) {
  let depth = 0;
  for (let j = k - 1; j >= 0; j -= 1) {
    const t = tokens[j];
    if (t.type !== 'punct') continue;
    if (t.value === ')' || t.value === ']' || t.value === '}') depth += 1;
    else if (t.value === '(' || t.value === '[' || t.value === '{') {
      if (depth === 0) return t.value === '(' ? { openIndex: j, calleeIndex: j - 1 } : null;
      depth -= 1;
    }
  }
  return null;
}

/** Zero-based argument position of token `k` inside the call opened at `open`. */
function argumentIndex(tokens, open, k) {
  let depth = 0;
  let index = 0;
  for (let j = open + 1; j < k; j += 1) {
    const t = tokens[j];
    if (t.type !== 'punct') continue;
    if (t.value === '(' || t.value === '[' || t.value === '{') depth += 1;
    else if (t.value === ')' || t.value === ']' || t.value === '}') depth -= 1;
    else if (t.value === ',' && depth === 0) index += 1;
  }
  return index;
}

/** The object-literal key immediately preceding a `key: <literal>` value. */
function precedingKey(tokens, k) {
  if (!isPunct(tokens[k - 1], ':')) return null;
  const key = tokens[k - 2];
  if (!key) return null;
  if (key.type === 'name') return key.value;
  if (key.type === 'string') return key.value;
  return null;
}

/** Index of the `{` that directly encloses token `k`, or -1. */
function enclosingObject(tokens, k) {
  let depth = 0;
  for (let j = k - 1; j >= 0; j -= 1) {
    const t = tokens[j];
    if (t.type !== 'punct') continue;
    if (t.value === '}' || t.value === ')' || t.value === ']') depth += 1;
    else if (t.value === '{' || t.value === '(' || t.value === '[') {
      if (depth === 0) return t.value === '{' ? j : -1;
      depth -= 1;
    }
  }
  return -1;
}

/** `el('button', { ... })` -> "button". */
function factoryTag(tokens, objectIndex) {
  if (objectIndex < 4) return null;
  if (!isPunct(tokens[objectIndex - 1], ',')) return null;
  const literal = tokens[objectIndex - 2];
  if (!literal || literal.type !== 'string') return null;
  if (!isPunct(tokens[objectIndex - 3], '(')) return null;
  const callee = tokens[objectIndex - 4];
  if (!callee || callee.type !== 'name' || !FACTORIES.has(callee.value)) return null;
  return literal.value.toLowerCase();
}

/** Map every `x = el('tag'...)` / `x = document.createElement('tag')` binding. */
function bindingTags(tokens) {
  const map = new Map();
  for (let k = 0; k + 4 < tokens.length; k += 1) {
    const target = tokens[k];
    if (target.type !== 'name') continue;
    if (!isPunct(tokens[k + 1], '=')) continue;
    let c = k + 2;
    if ((isName(tokens[c], 'document') || isName(tokens[c], 'window')) && isPunct(tokens[c + 1], '.')) c += 2;
    const callee = tokens[c];
    if (!callee || callee.type !== 'name' || !FACTORIES.has(callee.value)) continue;
    if (!isPunct(tokens[c + 1], '(')) continue;
    const literal = tokens[c + 2];
    if (!literal || literal.type !== 'string') continue;
    if (!map.has(target.value)) map.set(target.value, literal.value.toLowerCase());
  }
  return map;
}

/**
 * Map every `x = [window.]el('input', { … type: '<literal>' … })` binding to that
 * literal `type`.
 *
 * UIC-003 (phase-5 pass-3) asks whether a control is one of the specialized
 * input primitives the generic height ladder does not govern. That question is
 * answered by an attribute the source already states literally; a `.dc.html`
 * prototype has always transported it, and a JavaScript screen had no path to
 * it at all. This closes that front-end parity gap for exactly one attribute.
 *
 * Deliberately narrow: the tag must be the literal `input`, the key must be the
 * bare name `type`, and the value must be a quoted static string. A computed,
 * concatenated or otherwise non-literal type stays UNPROVEN — it is not guessed
 * and it gets no exception. Nothing else is transported: no `role`, no
 * `data-ui-control`, no ancestor and no interaction semantics, so no rule other
 * than UIC-003 can observe this map.
 *
 * Unlike `bindingTags`, a leading `window.` is accepted here. That is safe
 * because this map never resolves a tag or a role — it only reports an
 * already-literal input type — whereas widening tag resolution would move
 * findings across every rule.
 */
function bindingInputTypes(tokens) {
  const map = new Map();
  for (let k = 0; k + 6 < tokens.length; k += 1) {
    const target = tokens[k];
    if (target.type !== 'name') continue;
    if (!isPunct(tokens[k + 1], '=')) continue;
    let c = k + 2;
    if (
      (isName(tokens[c], 'document') || isName(tokens[c], 'window')) &&
      isPunct(tokens[c + 1], '.')
    ) {
      c += 2;
    }
    const callee = tokens[c];
    if (!callee || callee.type !== 'name' || !FACTORIES.has(callee.value)) continue;
    if (!isPunct(tokens[c + 1], '(')) continue;
    const literal = tokens[c + 2];
    if (!literal || literal.type !== 'string') continue;
    if (literal.value.toLowerCase() !== 'input') continue;
    if (!isPunct(tokens[c + 3], ',')) continue;
    if (!isPunct(tokens[c + 4], '{')) continue;
    const type = literalTypeInObject(tokens, c + 4);
    if (type && !map.has(target.value)) map.set(target.value, type);
  }
  return map;
}

/** `{ type: 'checkbox', … }` -> "checkbox", reading only the object's own depth. */
function literalTypeInObject(tokens, openIndex) {
  let depth = 0;
  for (let j = openIndex; j < tokens.length; j += 1) {
    const t = tokens[j];
    if (t.type === 'punct') {
      if (t.value === '{' || t.value === '(' || t.value === '[') depth += 1;
      else if (t.value === '}' || t.value === ')' || t.value === ']') {
        depth -= 1;
        if (depth === 0) return null;
      }
      continue;
    }
    if (depth !== 1) continue;
    if (t.type !== 'name' || t.value !== 'type') continue;
    if (!isPunct(tokens[j + 1], ':')) continue;
    const value = tokens[j + 2];
    if (!value || value.type !== 'string') return null;
    return value.value.toLowerCase();
  }
  return null;
}

/**
 * Carry the literal input `type` of a statically bound factory element onto a
 * later `.style.*` / `.style.cssText` / `setAttribute('style', …)` site on the
 * same variable. Without this a hidden checkbox styled after construction would
 * look like an anonymous element, and UIC-003 would have to treat a specialized
 * primitive as an unproven generic control.
 */
function carryLiteralInputType(element, receiver, bindingTypes) {
  if (!receiver || receiver.type !== 'name') return;
  const type = bindingTypes.get(receiver.value);
  if (type) element.attrMap.set('type', type);
}

function kebab(property) {
  return property.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function makeElement(tag, context, at) {
  return {
    tag,
    context,
    line: at.line,
    column: at.column,
    attrMap: new Map(),
    classes: new Set(),
    decls: new Map(),
    // `<section>` is the card element in the ratified fixture; the same
    // meaning holds when a screen builds one imperatively. Containment
    // (`insideCard`) stays unknown — a JavaScript screen does not expose a
    // static ancestor chain, and guessing one would fabricate a verdict.
    isCard: tag === 'section',
    insideCard: null,
    roleResolved: Boolean(tag),
  };
}

/**
 * End offset of the expression starting at token `from`: the first `;` or `,`
 * at the expression's own nesting depth. Used to attribute a colour inside a
 * ternary or a concatenation to the property it is assigned to, without
 * pretending to know which branch runs.
 */
function expressionEnd(tokens, from) {
  let depth = 0;
  for (let j = from; j < tokens.length; j += 1) {
    const t = tokens[j];
    if (t.type !== 'punct') continue;
    if (t.value === '(' || t.value === '[' || t.value === '{') depth += 1;
    else if (t.value === ')' || t.value === ']' || t.value === '}') {
      if (depth === 0) return t.start;
      depth -= 1;
    } else if ((t.value === ';' || t.value === ',') && depth === 0) return t.start;
  }
  return tokens.length > 0 ? tokens[tokens.length - 1].end : 0;
}

const LITERAL_TAG_STYLE_RE =
  /<([a-zA-Z][-a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?)style\s*=\s*"([^"]*)"/g;

const LITERAL_TAG_RE = /<([a-zA-Z][-a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const LITERAL_ATTR_RE =
  /([-a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Classify the colour-bearing regions inside one string or template literal that
 * carries markup. Attribute values are classified by attribute name; the text
 * between tags is copy. Literals with no markup at all get no text region, so a
 * bare string stays unproven instead of being absolved.
 */
function markupRegions(content, base) {
  const regions = [];
  const tagRanges = [];
  LITERAL_TAG_RE.lastIndex = 0;
  for (const tag of content.matchAll(LITERAL_TAG_RE)) {
    const tagName = tag[1].toLowerCase();
    tagRanges.push([tag.index, tag.index + tag[0].length]);
    const attrsOffset = tag.index + 1 + tag[1].length;
    LITERAL_ATTR_RE.lastIndex = 0;
    for (const attr of (tag[2] || '').matchAll(LITERAL_ATTR_RE)) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? '';
      if (value === '') continue;
      const start = attrsOffset + attr.index + attr[0].length - value.length - 1;
      regions.push({
        start: base + start,
        end: base + start + value.length,
        kind: COLOUR_ATTRIBUTES.has(name) || name === 'style' ? 'visual' : 'nonvisual',
        property: name,
        context: `literal <${tagName}> attribute "${name}"`,
      });
    }
  }
  if (tagRanges.length === 0) return regions;

  let cursor = 0;
  for (const [start, end] of tagRanges) {
    if (start > cursor) {
      regions.push({
        start: base + cursor,
        end: base + start,
        kind: 'nonvisual',
        property: null,
        context: 'literal markup text content',
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < content.length) {
    regions.push({
      start: base + cursor,
      end: base + content.length,
      kind: 'nonvisual',
      property: null,
      context: 'literal markup text content',
    });
  }
  return regions;
}

/* ---------- main ---------- */

/**
 * Analyse one application screen.
 *
 * @param {string} path repo-relative path, used only for attribution
 * @param {string} text file contents
 */
export function analyse(path, text) {
  const locate = makeLocator(text);

  let tokens;
  try {
    tokens = lex(text);
  } catch (err) {
    if (!(err instanceof LexError)) throw err;
    const at = locate(err.offset ?? 0);
    return {
      path,
      frontEnd: FRONT_END,
      archetype: null,
      locate,
      elements: [],
      declarations: [],
      selects: [],
      actionRows: [],
      cards: [],
      tables: [],
      sources: [],
      expressionSites: [],
      colourContexts: [],
      indeterminate: [],
      lexError: { message: err.message, line: at.line, column: at.column },
    };
  }

  const bindings = bindingTags(tokens);
  const bindingTypes = bindingInputTypes(tokens);
  const declarations = [];
  const elements = [];
  const indeterminate = [];
  const selects = [];
  const actionRows = [];
  const tables = [];
  const sources = [];
  const literals = [];
  const expressionSites = [];
  const colourContexts = [];
  const setAttributeRoles = new Map();
  /** Attribute objects that carried a decodable `style`, keyed by their `{`. */
  const objectElements = new Map();

  const noteExpression = (from, property, context) => {
    if (from >= tokens.length) return;
    expressionSites.push({
      property,
      context,
      start: tokens[from].start,
      end: expressionEnd(tokens, from),
    });
  };

  const addDeclarations = (token, element, source) => {
    const { content, start } = literalContent(text, token);
    for (const decl of parseDeclarations(content, start)) {
      const interpolated = decl.value.includes(INTERP);
      const value = displayValue(decl.value);
      element.decls.set(decl.property, value);
      declarations.push({
        property: decl.property,
        value,
        offset: decl.offset,
        valueOffset: decl.valueOffset,
        valueEnd: decl.valueEnd,
        element,
        source,
        interpolated,
      });
    }
  };

  for (let k = 0; k < tokens.length; k += 1) {
    const token = tokens[k];

    if (token.type === 'string' || token.type === 'template') {
      literals.push({ token, index: k });
    }

    /* setAttribute('<name>', <literal>) — the attribute name proves the role */
    if (
      isName(token, 'setAttribute') &&
      isPunct(tokens[k + 1], '(') &&
      tokens[k + 2] &&
      tokens[k + 2].type === 'string' &&
      isPunct(tokens[k + 3], ',')
    ) {
      const attr = tokens[k + 2].value.toLowerCase();
      const value = tokens[k + 4];
      if (value && (value.type === 'string' || value.type === 'template')) {
        setAttributeRoles.set(value.start, attr);
      }
    }

    /* style: '...' inside an element-factory attribute object */
    if (isName(token, 'style') && isPunct(tokens[k + 1], ':')) {
      const before = tokens[k - 1];
      if (!isPunct(before, '{') && !isPunct(before, ',')) continue;
      const value = tokens[k + 2];
      const objectIndex = enclosingObject(tokens, k);
      const tag = objectIndex === -1 ? null : factoryTag(tokens, objectIndex);
      const at = locate(token.start);
      const element = makeElement(
        tag,
        tag ? `el('${tag}', { style })` : 'attribute object { style }',
        at,
      );
      elements.push(element);
      if (objectIndex !== -1) objectElements.set(objectIndex, element);

      if (value && (value.type === 'string' || value.type === 'template')) {
        addDeclarations(value, element, 'js-style-prop');
        if (isPunct(tokens[k + 3], '+')) {
          indeterminate.push({
            line: at.line,
            column: at.column,
            reason: 'CONCATENATED_STYLE_EXPRESSION',
            context: "style: '...' + <expression>",
          });
          noteExpression(k + 2, 'style', 'concatenated style expression');
        }
      } else {
        indeterminate.push({
          line: at.line,
          column: at.column,
          reason: 'NON_LITERAL_STYLE_VALUE',
          context: 'style: <expression>',
        });
        noteExpression(k + 2, 'style', 'style expression');
      }
      continue;
    }

    /* node.style.prop = '...'  and  node.style.cssText = '...' */
    if (isName(token, 'style') && isPunct(tokens[k - 1], '.') && isPunct(tokens[k + 1], '.')) {
      const propToken = tokens[k + 2];
      if (!propToken || propToken.type !== 'name') continue;
      if (!isPunct(tokens[k + 3], '=')) continue;
      const value = tokens[k + 4];
      const receiver = tokens[k - 2];
      const tag =
        receiver && receiver.type === 'name' ? bindings.get(receiver.value) ?? null : null;
      const at = locate(token.start);
      const element = makeElement(
        tag,
        `${receiver && receiver.type === 'name' ? receiver.value : '<expression>'}.style`,
        at,
      );
      carryLiteralInputType(element, receiver, bindingTypes);
      elements.push(element);

      if (!value || (value.type !== 'string' && value.type !== 'template')) {
        indeterminate.push({
          line: at.line,
          column: at.column,
          reason: 'NON_LITERAL_STYLE_ASSIGNMENT',
          context: `.style.${propToken.value} = <expression>`,
        });
        noteExpression(
          k + 4,
          kebab(propToken.value),
          `.style.${propToken.value} = <expression>`,
        );
        continue;
      }

      if (propToken.value === 'cssText') {
        addDeclarations(value, element, 'js-css-text');
      } else {
        const { content, start } = literalContent(text, value);
        const property = kebab(propToken.value);
        const display = displayValue(content);
        element.decls.set(property, display);
        declarations.push({
          property,
          value: display,
          offset: token.start,
          valueOffset: start,
          valueEnd: start + content.length,
          element,
          source: 'js-style-assign',
          interpolated: content.includes(INTERP),
        });
      }
      continue;
    }

    /* setAttribute('style', '...') */
    if (
      isName(token, 'setAttribute') &&
      isPunct(tokens[k + 1], '(') &&
      tokens[k + 2] &&
      tokens[k + 2].type === 'string' &&
      tokens[k + 2].value === 'style' &&
      isPunct(tokens[k + 3], ',')
    ) {
      const value = tokens[k + 4];
      const receiver = isPunct(tokens[k - 1], '.') ? tokens[k - 2] : null;
      const tag =
        receiver && receiver.type === 'name' ? bindings.get(receiver.value) ?? null : null;
      const at = locate(token.start);
      const element = makeElement(
        tag,
        `${receiver && receiver.type === 'name' ? receiver.value : '<expression>'}.setAttribute('style')`,
        at,
      );
      carryLiteralInputType(element, receiver, bindingTypes);
      elements.push(element);
      if (value && (value.type === 'string' || value.type === 'template')) {
        addDeclarations(value, element, 'js-set-attribute');
      } else {
        indeterminate.push({
          line: at.line,
          column: at.column,
          reason: 'NON_LITERAL_STYLE_ASSIGNMENT',
          context: "setAttribute('style', <expression>)",
        });
        noteExpression(k + 4, 'style', "setAttribute('style', <expression>)");
      }
      continue;
    }

    /* el('select') / createElement('select') / el('table') */
    if (
      token.type === 'name' &&
      FACTORIES.has(token.value) &&
      isPunct(tokens[k + 1], '(') &&
      tokens[k + 2] &&
      tokens[k + 2].type === 'string'
    ) {
      const tag = tokens[k + 2].value.toLowerCase();
      const at = locate(token.start);
      if (tag === 'select') {
        selects.push({ line: at.line, column: at.column, context: `${token.value}('select')` });
      }
      if (tag === 'table') {
        tables.push({
          line: at.line,
          column: at.column,
          verdict: 'MANUAL_REVIEW_REQUIRED',
          reason:
            'Table built imperatively; header and value widths share no declared relationship the detector can read.',
          context: `${token.value}('table')`,
        });
      }
    }
  }

  /* `'data-card-actions': …` declared as an attribute-object key */
  let markerKeys = 0;
  for (let k = 0; k < tokens.length; k += 1) {
    const token = tokens[k];
    if (token.type !== 'string' || token.value !== 'data-card-actions') continue;
    if (!isPunct(tokens[k + 1], ':')) continue;
    markerKeys += 1;
    const objectIndex = enclosingObject(tokens, k);
    const element = objectIndex === -1 ? null : objectElements.get(objectIndex);
    if (element) {
      actionRows.push(element);
    } else {
      const at = locate(token.start);
      indeterminate.push({
        line: at.line,
        column: at.column,
        reason: 'CARD_ACTION_ROW_UNDECODED',
        context: 'data-card-actions key whose row declares no decodable style',
      });
    }
  }

  /* `'data-ui-pill': '…'` declared as an attribute-object key.

     D6.1 asks the rules for an element's ROLE, and `isSemanticPill()` reads that
     role from `attrMap`. A `.dc.html` prototype fills `attrMap` from real markup
     attributes; a JavaScript screen had no path to it at all, so a screen could
     not state "this span is a count badge" even when it plainly is.

     This transports exactly one proven marker and nothing else. The key must be
     a quoted static string and its value must be a literal: an expression is
     unproven, so it is recorded as indeterminate rather than fabricated as
     present. No tag, control, ancestor or runtime role is inferred here, and
     `isSemanticPill()` itself is unchanged — it simply now sees a marker a
     JavaScript screen was always allowed to declare. */
  for (let k = 0; k < tokens.length; k += 1) {
    const token = tokens[k];
    if (token.type !== 'string' || token.value !== 'data-ui-pill') continue;
    if (!isPunct(tokens[k + 1], ':')) continue;
    const at = locate(token.start);
    const value = tokens[k + 2];
    if (!value || value.type !== 'string') {
      indeterminate.push({
        line: at.line,
        column: at.column,
        reason: 'PILL_MARKER_NOT_STATIC',
        context: 'data-ui-pill whose value is not a literal; the role stays unproven',
      });
      continue;
    }
    const objectIndex = enclosingObject(tokens, k);
    const element = objectIndex === -1 ? null : objectElements.get(objectIndex);
    if (element) {
      element.attrMap.set('data-ui-pill', value.value);
    } else {
      indeterminate.push({
        line: at.line,
        column: at.column,
        reason: 'PILL_MARKER_UNDECODED',
        context: 'data-ui-pill key whose element declares no decodable style',
      });
    }
  }

  /* `type: '<literal>'` on an `el('input', { … })` attribute object.

     The companion of `bindingInputTypes()` for the common case where the style
     and the type are declared in the SAME attribute object, so no binding has
     to be followed. Same three conditions: the factory tag must be the literal
     `input`, the key must be the bare name `type`, and the value must be a
     quoted static string. A non-literal type is left unproven rather than
     guessed, and no other attribute is read. */
  for (let k = 0; k + 2 < tokens.length; k += 1) {
    const token = tokens[k];
    if (token.type !== 'name' || token.value !== 'type') continue;
    if (!isPunct(tokens[k + 1], ':')) continue;
    const before = tokens[k - 1];
    if (!isPunct(before, '{') && !isPunct(before, ',')) continue;
    const value = tokens[k + 2];
    if (!value || value.type !== 'string') continue;
    const objectIndex = enclosingObject(tokens, k);
    if (objectIndex === -1) continue;
    if (factoryTag(tokens, objectIndex) !== 'input') continue;
    const element = objectElements.get(objectIndex);
    if (element) element.attrMap.set('type', value.value.toLowerCase());
  }

  /* markup and colours carried inside string literals */
  for (const { token, index } of literals) {
    const { content, start } = literalContent(text, token);
    sources.push({ text: content, offset: start, context: 'string literal' });

    /* --- classify this literal as a colour site, by syntax only --- */
    const attr = setAttributeRoles.get(token.start);
    const key = attr === undefined ? precedingKey(tokens, index) : attr;
    let kind = null;
    let property = null;
    let why = null;
    if (key !== null && key !== undefined) {
      if (isVisualKey(key)) {
        kind = 'visual';
        property = kebab(key);
        why = attr === undefined ? `property "${key}"` : `setAttribute("${key}")`;
      } else if (isNonvisualKey(key)) {
        kind = 'nonvisual';
        why = attr === undefined ? `property "${key}"` : `setAttribute("${key}")`;
      }
    }
    if (kind === null) {
      const call = enclosingCall(tokens, index);
      const callee = call ? tokens[call.calleeIndex] : null;
      if (
        callee && callee.type === 'name' && FACTORIES.has(callee.value) &&
        argumentIndex(tokens, call.openIndex, index) >= 2
      ) {
        kind = 'nonvisual';
        why = `text child of ${callee.value}()`;
      }
    }
    if (kind !== null) {
      colourContexts.push({
        start: token.contentStart,
        end: token.contentEnd,
        kind,
        property,
        context: `${kind === 'visual' ? 'visual' : 'non-visual'} ${why}`,
      });
    }

    colourContexts.push(...markupRegions(content, start));

    for (const m of content.matchAll(/<select\b/gi)) {
      const at = locate(start + m.index);
      selects.push({ line: at.line, column: at.column, context: 'literal "<select"' });
    }
    for (const m of content.matchAll(/<table\b/gi)) {
      const at = locate(start + m.index);
      tables.push({
        line: at.line,
        column: at.column,
        verdict: 'MANUAL_REVIEW_REQUIRED',
        reason:
          'Table emitted as markup inside a string literal; column parity is not machine-provable here.',
        context: 'literal "<table"',
      });
    }
    LITERAL_TAG_STYLE_RE.lastIndex = 0;
    let markedRows = 0;
    for (const m of content.matchAll(LITERAL_TAG_STYLE_RE)) {
      const tag = m[1].toLowerCase();
      const at = locate(start + m.index);
      const element = makeElement(tag, `literal <${tag} style>`, at);
      elements.push(element);
      if (/\bdata-card-actions\b/.test(m[0])) {
        actionRows.push(element);
        markedRows += 1;
      }
      const valueStart = start + m.index + m[0].length - m[3].length - 1;
      for (const decl of parseDeclarations(m[3], valueStart)) {
        const interpolated = decl.value.includes(INTERP);
        const value = displayValue(decl.value);
        element.decls.set(decl.property, value);
        declarations.push({
          property: decl.property,
          value,
          offset: decl.offset,
          valueOffset: decl.valueOffset,
          valueEnd: decl.valueEnd,
          element,
          source: 'js-literal-markup',
          interpolated,
        });
      }
    }
    const marker = content.indexOf('data-card-actions');
    if (marker !== -1 && markedRows === 0 && markerKeys === 0) {
      const at = locate(start + marker);
      indeterminate.push({
        line: at.line,
        column: at.column,
        reason: 'CARD_ACTION_ROW_UNDECODED',
        context: 'data-card-actions marker with no decodable style declaration',
      });
    }
  }

  // A decoded CSS declaration value, and a style expression bound to a CSS
  // property, are both proven visual sites. They are narrower than any literal
  // region, so they win wherever they overlap one.
  for (const decl of declarations) {
    if (decl.valueEnd === undefined) continue;
    colourContexts.push({
      start: decl.valueOffset,
      end: decl.valueEnd,
      kind: 'visual',
      property: decl.property,
      context: `style declaration "${decl.property}" on ${decl.element.context}`,
    });
  }
  for (const site of expressionSites) {
    colourContexts.push({
      start: site.start,
      end: site.end,
      kind: 'visual',
      property: site.property,
      context: `${site.context} for "${site.property}"`,
    });
  }

  for (const decl of declarations) {
    if (!decl.interpolated) continue;
    const at = locate(decl.valueOffset);
    indeterminate.push({
      line: at.line,
      column: at.column,
      reason: 'TEMPLATE_INTERPOLATED_VALUE',
      context: `${decl.property}: ${decl.value}`,
    });
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
    cards: [],
    tables,
    sources,
    expressionSites,
    colourContexts,
    indeterminate,
    lexError: null,
  };
}
