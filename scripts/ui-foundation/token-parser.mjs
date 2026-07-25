/* ============================================================
   UI FOUNDATION — TOKEN PARSER

   Parsing only. No filesystem access, no rules, no reporting.
   Shared by scripts/ui-foundation/rules.mjs and by the focused
   tests, so token parsing is never reimplemented per consumer.
   ============================================================ */

/** Comment that opens the transitional compatibility block. */
export const LEGACY_MARKER = 'LEGACY COMPATIBILITY';

const DECLARATION_RE = /--rv-[a-z0-9-]+\s*:/g;
const REFERENCE_RE = /var\(\s*(--rv-[a-z0-9-]+)/g;
const COMMENT_RE = /\/\*[\s\S]*?\*\//g;

/**
 * Blank out CSS comments while preserving byte offsets and newlines, so a
 * declaration's offset still maps to its real line and to its position
 * relative to LEGACY_MARKER.
 */
export function blankComments(css) {
  return css.replace(COMMENT_RE, (match) =>
    match.replace(/[^\n]/g, ' '),
  );
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Parse `--rv-*` declarations from a token stylesheet.
 *
 * Handles several declarations on one physical line (the stage and pill
 * blocks ship that way) and never mistakes a `var(--rv-x)` reference for a
 * declaration, because references are removed before matching.
 *
 * @returns {{canonical: string[], deprecated: string[], byName: Map<string, {kind: string, line: number}>}}
 */
export function parseTokenDeclarations(css) {
  const markerOffset = css.indexOf(LEGACY_MARKER);
  const source = blankComments(css).replace(REFERENCE_RE, (match) =>
    ' '.repeat(match.length),
  );

  const byName = new Map();
  const canonical = [];
  const deprecated = [];

  for (const match of source.matchAll(DECLARATION_RE)) {
    const name = match[0].replace(/\s*:$/, '');
    if (byName.has(name)) continue;

    const isDeprecated = markerOffset !== -1 && match.index > markerOffset;
    const kind = isDeprecated ? 'deprecated' : 'canonical';
    byName.set(name, { kind, line: lineAt(css, match.index) });
    (isDeprecated ? deprecated : canonical).push(name);
  }

  return { canonical, deprecated, byName };
}

/**
 * Collect every `var(--rv-*)` reference in a source file, with line numbers.
 *
 * @returns {{token: string, line: number}[]}
 */
export function parseTokenReferences(text) {
  const references = [];
  for (const match of text.matchAll(REFERENCE_RE)) {
    references.push({ token: match[1], line: lineAt(text, match.index) });
  }
  return references;
}

/**
 * Classify a referenced token against a parsed declaration inventory.
 *
 * @returns {'canonical'|'deprecated'|'unknown'}
 */
export function classifyToken(byName, token) {
  return byName.get(token)?.kind ?? 'unknown';
}
