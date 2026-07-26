/* ============================================================
   UI FOUNDATION — RULES

   Foundation ownership and package integration only.
   This is NOT the phase-4 screen-conformance detector: no rule here
   inspects a product screen's colours, radii, heights or controls.

   Every rule reads the single inventory built by inventory.mjs and
   the single token parse from token-parser.mjs. Reporting lives in
   scripts/validate-ui-foundation.mjs.
   ============================================================ */

import {
  PATHS,
  exists,
  read,
  sha256,
  toPosix,
} from './inventory.mjs';
import {
  LEGACY_MARKER,
  parseTokenDeclarations,
  parseTokenReferences,
} from './token-parser.mjs';

/**
 * The transitional compatibility names ratified by the architect for
 * UI-CONSOLIDATION-FOUNDATION-INTAKE-R1. Nothing may be added here without a
 * ruling: the block is debt, and an unlisted name means a silent expansion.
 */
export const APPROVED_DEPRECATED = [
  '--rv-color-accent',
  '--rv-color-subtle-bg',
  '--rv-color-title',
  '--rv-color-text',
  '--rv-color-value',
  '--rv-color-muted',
  '--rv-color-surface',
  '--rv-color-line-100',
  '--rv-color-line-200',
  '--rv-color-input-border',
  '--rv-color-danger',
  '--rv-color-success',
  '--rv-color-warning',
  '--rv-radius-card',
  '--rv-radius-control',
  '--rv-font-size-label',
  '--rv-font-size-body',
  '--rv-color-chip-glyph',
  '--rv-color-section-label',
  '--rv-color-bg-header',
  '--rv-color-chip-bg',
  '--rv-status-prep',
  '--rv-status-prep-bg',
  '--rv-status-prod',
  '--rv-status-prod-bg',
  '--rv-status-prod-dot',
];

const ARCHITECTURE_DOCS = [
  PATHS.contract,
  PATHS.decisions,
  PATHS.conformance,
  PATHS.sgaa,
  PATHS.brief,
];

// Every CSS hex form, longest-first so #rrggbbaa is not truncated to #rrggbb.
// Six-digit-only matching let the shorthand `#fff` sit in the contract's
// primary-button row unnoticed.
const HEX_RE = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})\b/g;
const LOCAL_REF_RE = /(?:src|href)="([^"#][^"]*)"/g;

const finding = (rule_id, severity, path, line_or_location, message) => ({
  rule_id,
  severity,
  path,
  line_or_location,
  message,
});

/* ---------- Layer 1 — token ownership ---------- */

function tokenRules(inv, out) {
  const { root } = inv;
  if (!exists(root, PATHS.tokens)) {
    out.push(
      finding('UIF-001', 'error', PATHS.tokens, 'file', 'Canonical token file is missing.'),
    );
    return null;
  }

  const css = read(root, PATHS.tokens);
  const parsed = parseTokenDeclarations(css);

  for (const file of inv.files) {
    if (file === PATHS.tokens) continue;
    if (!/\.(css|js|mjs|html)$/.test(file)) continue;
    // Tests carry deliberate negative fixtures; they ship nothing and own nothing.
    if (file.startsWith('tests/')) continue;
    const decls = parseTokenDeclarations(read(root, file));
    if (decls.byName.size > 0) {
      out.push(
        finding(
          'UIF-001',
          'error',
          file,
          `line ${[...decls.byName.values()][0].line}`,
          `Declares ${decls.byName.size} --rv-* token(s). Only ${PATHS.tokens} may own token values.`,
        ),
      );
    }
  }

  if (!css.includes(LEGACY_MARKER)) {
    out.push(
      finding('UIF-003', 'error', PATHS.tokens, 'file',
        `Missing the "${LEGACY_MARKER}" block marker; canonical and deprecated declarations are indistinguishable.`),
    );
  } else if (parsed.canonical.length === 0 || parsed.deprecated.length === 0) {
    out.push(
      finding('UIF-003', 'error', PATHS.tokens, 'file',
        'Canonical or deprecated partition is empty; the block marker is misplaced.'),
    );
  }

  const approved = new Set(APPROVED_DEPRECATED);
  for (const name of parsed.deprecated) {
    if (!approved.has(name)) {
      out.push(
        finding('UIF-004', 'error', PATHS.tokens, `line ${parsed.byName.get(name).line}`,
          `"${name}" is in the compatibility block but is not an approved transitional name.`),
      );
    }
  }
  for (const name of APPROVED_DEPRECATED) {
    if (!parsed.deprecated.includes(name)) {
      out.push(
        finding('UIF-004', 'error', PATHS.tokens, 'compatibility block',
          `Approved transitional name "${name}" is absent from the compatibility block.`),
      );
    }
  }

  const chipGlyph = parsed.byName.get('--rv-chip-glyph');
  if (!chipGlyph || chipGlyph.kind !== 'canonical') {
    out.push(
      finding('UIF-005', 'error', PATHS.tokens, 'canonical block',
        '--rv-chip-glyph must exist as a canonical token; the contract references it.'),
    );
  }

  for (const file of inv.runtimeFiles) {
    for (const { token, line } of parseTokenReferences(read(root, file))) {
      const kind = parsed.byName.get(token)?.kind ?? 'unknown';
      if (kind === 'unknown') {
        out.push(
          finding('UIF-002', 'error', file, `line ${line}`,
            `var(${token}) does not resolve to any declaration in ${PATHS.tokens}.`),
        );
      } else if (kind === 'deprecated') {
        out.push(
          finding('UIF-006', 'debt', file, `line ${line}`,
            `var(${token}) uses a deprecated compatibility token. Permitted during intake; remove in property-based remediation.`),
        );
      }
    }
  }

  return parsed;
}

/* ---------- Layer 2 — contract and document custody ---------- */

function documentRules(inv, out) {
  const { root } = inv;
  for (const doc of ARCHITECTURE_DOCS) {
    if (!exists(root, doc)) {
      out.push(finding('UIF-008', 'error', doc, 'file', 'Required architecture document is missing.'));
    }
  }

  const present = ARCHITECTURE_DOCS.filter((d) => exists(root, d));
  const seen = new Map();
  for (const doc of present) {
    const hash = sha256(root, doc);
    if (seen.has(hash)) {
      out.push(
        finding('UIF-008', 'error', doc, 'file',
          `Byte-identical to ${seen.get(hash)}; the five documents must stay distinct owners.`),
      );
    }
    seen.set(hash, doc);
  }

  if (exists(root, PATHS.contract)) {
    const contract = read(root, PATHS.contract);
    contract.split('\n').forEach((text, i) => {
      const hits = text.match(HEX_RE);
      if (hits) {
        out.push(
          finding('UIF-007', 'error', PATHS.contract, `line ${i + 1}`,
            `Literal colour ${hits.join(', ')} in the normative contract. Values are owned by ${PATHS.tokens}; reference var(--rv-*).`),
        );
      }
    });
  }

  if (exists(root, 'HANDOFF.md')) {
    out.push(
      finding('UIF-017', 'error', 'HANDOFF.md', 'file',
        'A second root handoff exists. AGENT_HANDOFF.md is the only root handoff; the intake HANDOFF.md must not be promoted.'),
    );
  }
}

/* ---------- Fixtures and evidence ---------- */

function resolveRelative(fromFile, ref) {
  const base = fromFile.split('/').slice(0, -1);
  for (const part of ref.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return base.join('/');
}

function fixtureRules(inv, out) {
  const { root } = inv;

  if (!exists(root, PATHS.fixture)) {
    out.push(finding('UIF-009', 'error', PATHS.fixture, 'file', 'Primary OP Detail fixture is not versioned.'));
  }

  const opDetail = inv.files.filter((f) => /OP Detail - Compacto.*\.dc\.html$/i.test(f));
  for (const f of opDetail) {
    if (f !== PATHS.fixture) {
      out.push(
        finding('UIF-010', 'error', f, 'file',
          'A second OP Detail fixture is versioned. Only the primary fixture may exist; the byte-identical copy was ruled out of the repository.'),
      );
    }
  }

  const supports = inv.files.filter((f) => f.endsWith('/support.js') || f === 'support.js');
  if (supports.length !== 1 || supports[0] !== PATHS.support) {
    out.push(
      finding('UIF-011', 'error', PATHS.support, 'file',
        `Expected exactly one shared support.js at ${PATHS.support}; found ${supports.length}: ${supports.join(', ') || 'none'}.`),
    );
  }

  for (const doc of [PATHS.fixture, PATHS.evidence]) {
    if (!exists(root, doc)) {
      if (doc === PATHS.evidence) {
        out.push(finding('UIF-009', 'error', doc, 'file', 'Evidence document is not versioned.'));
      }
      continue;
    }
    const html = read(root, doc);
    let sawSupport = false;
    for (const match of html.matchAll(LOCAL_REF_RE)) {
      const ref = match[1];
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue;
      const resolved = resolveRelative(doc, ref);
      if (resolved.endsWith('support.js')) {
        sawSupport = true;
        if (resolved !== PATHS.support) {
          out.push(
            finding('UIF-011', 'error', doc, `ref "${ref}"`,
              `Resolves to ${resolved}; must load the single shared ${PATHS.support}.`),
          );
        }
      }
      if (!exists(root, resolved)) {
        out.push(
          finding('UIF-012', 'error', doc, `ref "${ref}"`,
            `Local dependency does not resolve (${resolved}).`),
        );
      }
    }
    if (!sawSupport) {
      out.push(finding('UIF-012', 'error', doc, 'file', 'Does not reference the shared support.js.'));
    }
  }

  const runtimeMarkers = ['docs/ui/fixtures', 'docs/ui/evidence', 'support.js', 'OP Detail - Compacto'];
  for (const file of inv.runtimeFiles) {
    const text = read(root, file);
    for (const marker of runtimeMarkers) {
      if (text.includes(marker)) {
        out.push(
          finding('UIF-013', 'error', file, `match "${marker}"`,
            'Application runtime references fixture or evidence infrastructure. Fixtures must never enter the product bundle.'),
        );
      }
    }
  }
}

/* ---------- Brand assets ---------- */

function brandRules(inv, out) {
  const { root, brandSvgs } = inv;

  if (brandSvgs.length !== 6) {
    out.push(
      finding('UIF-014', 'error', PATHS.brandDir, 'directory',
        `Expected exactly 6 canonical brand SVG files; found ${brandSvgs.length}.`),
    );
  }

  if (!exists(root, PATHS.brandReadme)) {
    out.push(finding('UIF-014', 'error', PATHS.brandReadme, 'file', 'Brand README is missing.'));
    return;
  }
  const readme = read(root, PATHS.brandReadme);

  const byHash = new Map();
  for (const svg of brandSvgs) {
    const text = read(root, svg);
    const rootTag = text.match(/<svg\b[^>]*>/i);
    if (!rootTag) {
      out.push(finding('UIF-015', 'error', svg, 'file', 'No valid root <svg> element.'));
    } else if (!/\bviewBox\s*=\s*"[^"]+"/i.test(rootTag[0])) {
      out.push(finding('UIF-015', 'error', svg, '<svg>', 'Root <svg> has no viewBox.'));
    }

    const hash = sha256(root, svg);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(svg);
  }

  for (const [hash, group] of byHash) {
    if (group.length < 2) continue;
    const names = group.map((g) => g.split('/').pop());
    const documented =
      readme.includes(hash) && names.every((n) => readme.includes(n));
    if (!documented) {
      out.push(
        finding('UIF-016', 'error', PATHS.brandDir, names.join(' == '),
          `Brand assets share SHA-256 ${hash} but the README does not document the duplicate (it must name every file and the hash).`),
      );
    }
  }
}

/* ---------- Boundaries ---------- */

function boundaryRules(inv, out) {
  const { root } = inv;

  // Markup resolves assets; modules resolve specifiers. Matching the wrong
  // form per file type turns a quoted test fixture into a false positive.
  const MARKUP_CLAUDE = /(?:src|href)\s*=\s*["'][^"']*\.claude\//;
  const MODULE_CLAUDE = /(?:\bfrom\s*|\brequire\(\s*|\bimport\(\s*)["'][^"']*\.claude\//;

  for (const file of inv.files) {
    const markup = /\.(css|html)$/.test(file);
    const module = /\.(js|mjs)$/.test(file);
    if (!markup && !module) continue;
    if (file.startsWith('docs/')) continue;
    const text = read(root, file);
    if ((markup ? MARKUP_CLAUDE : MODULE_CLAUDE).test(text)) {
      out.push(
        finding('UIF-018', 'error', file, 'import',
          '.claude is untracked and absent from fresh worktrees; no build dependency may point into it.'),
      );
    }
  }

  for (const screen of inv.productScreens) {
    const text = read(root, screen);
    const decls = parseTokenDeclarations(text);
    if (decls.byName.size > 0) {
      out.push(
        finding('UIF-019', 'error', screen, `line ${[...decls.byName.values()][0].line}`,
          'Product screen declares a --rv-* token. Screens consume tokens; they never own values.'),
      );
    }
    if (/docs\/ui\/(fixtures|evidence)/.test(text)) {
      out.push(
        finding('UIF-019', 'error', screen, 'reference',
          'Product screen references fixture or evidence infrastructure.'),
      );
    }
  }
}

/**
 * Run every foundation rule against one inventory.
 * @returns {{rule_id: string, severity: string, path: string, line_or_location: string, message: string}[]}
 */
export function runRules(inv) {
  const out = [];
  tokenRules(inv, out);
  documentRules(inv, out);
  fixtureRules(inv, out);
  brandRules(inv, out);
  boundaryRules(inv, out);
  return out;
}

export { toPosix };
