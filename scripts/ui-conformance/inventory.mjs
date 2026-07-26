/* ============================================================
   UI CONFORMANCE — INVENTORY

   Decides WHICH files the detector reads, and refuses to guess.

   Two source classes:
     · prototype  — the `.dc.html` rows listed under archetypes A–F
                    in docs/architecture/UI_CONFORMANCE.md;
     · application — every tracked js/screens/*.js.

   A conformance row that cannot be resolved to exactly one file in
   the worktree is reported as UNRESOLVED or AMBIGUOUS. It is never
   silently dropped and never matched by best effort: a screen the
   detector cannot open is not a screen the detector has audited.

   Filesystem traversal is delegated to scripts/ui-foundation/
   inventory.mjs so the two validators can never disagree about what
   exists in the repository.
   ============================================================ */

import { buildInventory, exists, read } from '../ui-foundation/inventory.mjs';

export const CONFORMANCE_DOC = 'docs/architecture/UI_CONFORMANCE.md';

/** Application front-end root. Top-level files only, no nested directories. */
const APP_SCREEN_RE = /^js\/screens\/[^/]+\.js$/;

/** Generated export derivatives — regenerated from source, never audited. */
const DERIVATIVE_RE = /(?:-standalone\.html|-bundle-ready\.html|-print-[^/]*)$/i;

/** Paths that are infrastructure, evidence or vendor code, not screens. */
const EXCLUDED_PREFIXES = [
  'node_modules/',
  'docs/ui/evidence/',
  'docs/ui/fixtures/vendor/',
  'tests/',
  'services/',
];

const EXCLUDED_BASENAMES = new Set(['support.js']);

/** Chrome fragments and documentation pages listed outside the archetypes. */
const NON_SCREEN_NAMES = new Set([
  'Admin - Sidebar.dc.html',
  'Admin - Topbar.dc.html',
  'Inttex - Identidade Visual.dc.html',
  'Setas de transicao - referencia.html',
]);

export function isExcluded(path) {
  if (EXCLUDED_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (DERIVATIVE_RE.test(path)) return true;
  return EXCLUDED_BASENAMES.has(path.split('/').pop());
}

/** Line/column lookup over one source text. */
export function makeLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return function locate(offset) {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  };
}

/* ---------- conformance-document rows ---------- */

const ARCHETYPE_HEADING_RE = /^##\s+Archetype\s+([A-F])\b[^\n]*$/gm;
const ROW_RE = /^\|(.+)\|\s*$/gm;

function cells(rowText) {
  return rowText.split('|').map((c) => c.trim());
}

function screenName(cell) {
  const backticked = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  if (backticked.length === 1) return backticked[0];
  if (backticked.length > 1) return null;
  return null;
}

/**
 * Read the archetype tables and return one row record per listed screen.
 *
 * @returns {{archetype: string, name: string, generation: string, state: string, line: number}[]}
 */
export function readConformanceRows(text) {
  const headings = [...text.matchAll(ARCHETYPE_HEADING_RE)];
  const rows = [];

  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
    const block = text.slice(start, end);
    const archetype = headings[i][1];

    ROW_RE.lastIndex = 0;
    for (const row of block.matchAll(ROW_RE)) {
      const parts = cells(row[1]);
      if (parts.length < 3) continue;
      if (/^-+$/.test(parts[0].replace(/[:\s]/g, '-'))) continue;
      if (parts[0] === 'Screen' || parts[0] === 'File') continue;
      const name = screenName(parts[0]);
      if (!name) continue;
      rows.push({
        archetype,
        name,
        generation: parts[1] ?? '',
        state: parts[2] ?? '',
        line:
          text.slice(0, start + row.index).split('\n').length,
      });
    }
  }
  return rows;
}

/* ---------- resolution ---------- */

/**
 * Build the complete detector inventory.
 *
 * @param {string} root absolute repository root
 * @returns {{
 *   prototypes: {path: string, archetype: string, name: string, declaredState: string}[],
 *   applications: {path: string, archetype: null}[],
 *   unresolved: {name: string, archetype: string, reason: string, line: number, candidates: string[]}[],
 *   excluded: {name: string, path: string, reason: string}[],
 *   nonScreenRows: string[]
 * }}
 */
export function buildConformanceInventory(root) {
  if (!exists(root, CONFORMANCE_DOC)) {
    throw new Error(`Conformance document is not versioned: ${CONFORMANCE_DOC}`);
  }
  const base = buildInventory(root);
  const doc = readConformanceRows(read(root, CONFORMANCE_DOC));

  const byBasename = new Map();
  for (const file of base.files) {
    const name = file.split('/').pop();
    if (!byBasename.has(name)) byBasename.set(name, []);
    byBasename.get(name).push(file);
  }

  const prototypes = [];
  const unresolved = [];
  const excluded = [];
  const nonScreenRows = [];
  const seenPaths = new Set();

  for (const row of doc) {
    if (NON_SCREEN_NAMES.has(row.name)) {
      nonScreenRows.push(row.name);
      continue;
    }
    if (DERIVATIVE_RE.test(row.name) || row.name.includes('*')) {
      excluded.push({ name: row.name, path: '', reason: 'GENERATED_EXPORT_DERIVATIVE' });
      continue;
    }

    const candidates = row.name.includes('/')
      ? base.files.filter((f) => f === row.name)
      : (byBasename.get(row.name) ?? []).slice().sort();

    const usable = candidates.filter((c) => !isExcluded(c));

    if (usable.length === 0) {
      unresolved.push({
        name: row.name,
        archetype: row.archetype,
        reason: candidates.length === 0 ? 'NOT_PRESENT_IN_WORKTREE' : 'ONLY_EXCLUDED_MATCHES',
        line: row.line,
        candidates,
      });
      continue;
    }
    if (usable.length > 1) {
      unresolved.push({
        name: row.name,
        archetype: row.archetype,
        reason: 'AMBIGUOUS_DUPLICATE_FILENAME',
        line: row.line,
        candidates: usable,
      });
      continue;
    }

    const path = usable[0];
    if (seenPaths.has(path)) {
      unresolved.push({
        name: row.name,
        archetype: row.archetype,
        reason: 'DUPLICATE_ROW_FOR_SAME_PATH',
        line: row.line,
        candidates: [path],
      });
      continue;
    }
    seenPaths.add(path);
    prototypes.push({
      path,
      archetype: row.archetype,
      name: row.name,
      declaredState: row.state,
    });
  }

  const applications = base.files
    .filter((f) => APP_SCREEN_RE.test(f) && !isExcluded(f))
    .sort()
    .map((path) => ({ path, archetype: null }));

  prototypes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { prototypes, applications, unresolved, excluded, nonScreenRows };
}
