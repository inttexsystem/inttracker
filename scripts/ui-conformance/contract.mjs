/* ============================================================
   UI CONFORMANCE — CONTRACT READER

   The single place that learns what the detector enforces.

   Numeric enums are NEVER written here: they are read from the
   closed-enum JSON block under UI_VISUAL_CONTRACT.md §5. Mutating
   that block must change detector behaviour without touching a line
   of detector source — that property is asserted by the focused
   suite and is the reason this module exists separately from the
   rule engine.

   Also owns canonical token-value resolution, because "does
   var(--rv-radius) resolve to a value inside the enum?" is a
   contract question, not a rule question. Token CLASSIFICATION
   (canonical / deprecated / unknown) is delegated to
   scripts/ui-foundation/token-parser.mjs — never reimplemented.
   ============================================================ */

import { createHash } from 'node:crypto';

import { PATHS, exists, read } from '../ui-foundation/inventory.mjs';
import { blankComments, parseTokenDeclarations } from '../ui-foundation/token-parser.mjs';

/** Keys the §5 block must declare. A missing key fails closed. */
export const REQUIRED_KEYS = [
  'literal_hex_in_screen',
  'radius',
  'control_h',
  'shadow',
  'font_size',
  'font_weight',
  'text_color',
  'gap',
  'card_padding',
  'shell',
  'pill_radius_on_button',
  'native_select',
];

/** Keys whose value must be a non-empty array of scalars. */
const LIST_KEYS = ['radius', 'control_h', 'shadow', 'font_size', 'font_weight', 'text_color'];

/** A configuration failure. The CLI turns this into exit code 2. */
export class ContractError extends Error {
  constructor(message, path, line) {
    super(message);
    this.name = 'ContractError';
    this.path = path;
    this.line = line ?? null;
  }
}

export function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/* ---------- §5 closed-enum block ---------- */

const SECTION_5_RE = /^##\s+5\.[^\n]*$/m;
const NEXT_SECTION_RE = /^##\s+/m;
const JSON_FENCE_RE = /```json[^\n]*\n([\s\S]*?)\n```/g;

/**
 * Read and validate the closed enums.
 *
 * @param {string} root absolute repository root
 * @param {string} [contractPath] repo-relative contract path
 * @returns {{path: string, sectionLine: number, blockLine: number, hash: string, raw: string, enums: object}}
 */
export function readContract(root, contractPath = PATHS.contract) {
  if (!exists(root, contractPath)) {
    throw new ContractError('Visual contract is not versioned.', contractPath, null);
  }
  const text = read(root, contractPath);

  const head = SECTION_5_RE.exec(text);
  if (!head) {
    throw new ContractError(
      'No "## 5." closed-enum section; the detector has no source of values.',
      contractPath,
      null,
    );
  }
  const sectionStart = head.index;
  const rest = text.slice(sectionStart + head[0].length);
  const next = NEXT_SECTION_RE.exec(rest);
  const section = rest.slice(0, next ? next.index : rest.length);
  const sectionOffset = sectionStart + head[0].length;

  const fences = [...section.matchAll(JSON_FENCE_RE)];
  if (fences.length === 0) {
    throw new ContractError(
      'Section 5 declares no ```json closed-enum block.',
      contractPath,
      lineOf(text, sectionStart),
    );
  }
  if (fences.length > 1) {
    throw new ContractError(
      `Section 5 declares ${fences.length} fenced json blocks; exactly one closed-enum block may exist.`,
      contractPath,
      lineOf(text, sectionOffset + fences[1].index),
    );
  }

  const raw = fences[0][1];
  const blockLine = lineOf(text, sectionOffset + fences[0].index);

  let enums;
  try {
    enums = JSON.parse(raw);
  } catch (err) {
    throw new ContractError(
      `Section 5 closed-enum block is not valid JSON: ${err.message}`,
      contractPath,
      blockLine,
    );
  }
  if (enums === null || typeof enums !== 'object' || Array.isArray(enums)) {
    throw new ContractError(
      'Section 5 closed-enum block must be a JSON object.',
      contractPath,
      blockLine,
    );
  }

  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(enums, key)) {
      throw new ContractError(
        `Section 5 closed-enum block is missing the required key "${key}".`,
        contractPath,
        blockLine,
      );
    }
  }
  for (const key of LIST_KEYS) {
    const value = enums[key];
    if (!Array.isArray(value) || value.length === 0) {
      throw new ContractError(
        `Section 5 key "${key}" must be a non-empty array.`,
        contractPath,
        blockLine,
      );
    }
  }

  return {
    path: contractPath,
    sectionLine: lineOf(text, sectionStart),
    blockLine,
    hash: createHash('sha256').update(raw, 'utf8').digest('hex'),
    raw,
    enums,
  };
}

/* ---------- canonical token values ---------- */

const DECL_VALUE_RE = /(--rv-[a-z0-9-]+)\s*:\s*([^;}]*)/g;

/**
 * Parse `css/tokens.css` into a name → raw value map plus the shared
 * canonical/deprecated classification.
 */
export function readTokens(root, tokensPath = PATHS.tokens) {
  if (!exists(root, tokensPath)) {
    throw new ContractError('Canonical token file is not versioned.', tokensPath, null);
  }
  const css = read(root, tokensPath);
  const parsed = parseTokenDeclarations(css);

  const values = new Map();
  for (const match of blankComments(css).matchAll(DECL_VALUE_RE)) {
    if (!values.has(match[1])) values.set(match[1], match[2].trim());
  }

  return {
    path: tokensPath,
    kinds: parsed.byName,
    values,
    canonical: parsed.canonical,
    deprecated: parsed.deprecated,
  };
}

function splitTopLevel(text, separator) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === separator && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * Substitute every `var(--x)` with its canonical value.
 *
 * @returns {{value: string, unresolved: string[]}} unresolved names are the
 *   token references that do not exist in css/tokens.css.
 */
export function resolveCssValue(tokens, value, seen = new Set()) {
  const unresolved = [];
  let out = '';
  let i = 0;
  const text = String(value);

  while (i < text.length) {
    const at = text.indexOf('var(', i);
    if (at === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at);

    let depth = 0;
    let j = at + 3;
    for (; j < text.length; j += 1) {
      if (text[j] === '(') depth += 1;
      else if (text[j] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (j >= text.length) {
      out += text.slice(at);
      break;
    }

    const parts = splitTopLevel(text.slice(at + 4, j), ',');
    const name = parts[0].trim();
    const fallback = parts.slice(1).join(',').trim();

    if (seen.has(name)) {
      unresolved.push(name);
      out += `var(${name})`;
    } else if (tokens.values.has(name)) {
      const nested = new Set(seen);
      nested.add(name);
      const resolved = resolveCssValue(tokens, tokens.values.get(name), nested);
      out += resolved.value;
      unresolved.push(...resolved.unresolved);
    } else {
      unresolved.push(name);
      if (fallback) out += resolveCssValue(tokens, fallback, seen).value;
      else out += `var(${name})`;
    }
    i = j + 1;
  }

  return { value: out.trim(), unresolved };
}

/**
 * Canonical form for enum comparison: case, whitespace, comma spacing and
 * numeric spelling (`0.10` and `.10` are the same shadow alpha).
 */
export function normalizeValue(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s,(])0+(\.\d)/g, '$1$2')
    .replace(/(\.\d*?)0+(?![0-9])/g, '$1')
    .replace(/\.(?![0-9])/g, '');
}

/**
 * Split a CSS declaration list into `property` / `value` pairs, keeping the
 * byte offset of each part so a finding can name an exact line and column.
 * Parenthesis-aware, so `url(data:…;base64,…)` is not split on its semicolon.
 *
 * @param {string} text declaration list, without the surrounding braces
 * @param {number} [baseOffset] offset of `text` inside the owning file
 */
export function parseDeclarations(text, baseOffset = 0) {
  const out = [];

  const push = (chunk, at) => {
    const colon = chunk.indexOf(':');
    if (colon <= 0) return;
    const property = chunk.slice(0, colon).trim();
    if (!/^[-a-z][-a-z0-9]*$/i.test(property)) return;
    const rawValue = chunk.slice(colon + 1);
    const value = rawValue.trim();
    if (!value) return;
    const valueOffset =
      baseOffset + at + colon + 1 + (rawValue.length - rawValue.trimStart().length);
    out.push({
      property: property.toLowerCase(),
      value,
      offset: baseOffset + at + (chunk.length - chunk.trimStart().length),
      valueOffset,
      valueEnd: valueOffset + value.length,
    });
  };

  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ';' && depth === 0) {
      push(text.slice(start, i), start);
      start = i + 1;
    }
  }
  push(text.slice(start), start);
  return out;
}

/** Build the normalized enum sets the rule engine compares against. */
export function buildEnums(contract) {
  const set = (key) => new Set(contract.enums[key].map((v) => normalizeValue(v)));
  return {
    radius: set('radius'),
    controlHeight: set('control_h'),
    shadow: set('shadow'),
    fontSize: set('font_size'),
    fontWeight: set('font_weight'),
    textColor: new Set(contract.enums.text_color.map((v) => String(v).trim())),
    pillRadiusOnButtonForbidden: contract.enums.pill_radius_on_button === 'forbidden',
    nativeSelectForbidden: contract.enums.native_select === 'forbidden',
    literalHexForbidden: contract.enums.literal_hex_in_screen === 'forbidden',
  };
}
