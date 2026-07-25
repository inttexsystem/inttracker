/* ============================================================
   UI FOUNDATION — INVENTORY

   Filesystem traversal only. One walk per run; the result is the
   single normalized input every rule reads. No rules, no reporting.
   The repository root is injected, never hard-coded.
   ============================================================ */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

export const PATHS = {
  tokens: 'css/tokens.css',
  contract: 'docs/architecture/UI_VISUAL_CONTRACT.md',
  decisions: 'docs/architecture/DESIGN_DECISIONS.md',
  conformance: 'docs/architecture/UI_CONFORMANCE.md',
  sgaa: 'docs/architecture/SGAA_DESIGN_SYSTEM_REFERENCE.md',
  brief: 'docs/architecture/ARCHITECT_BRIEF.md',
  fixtureDir: 'docs/ui/fixtures/op-detail-compacto',
  fixture: 'docs/ui/fixtures/op-detail-compacto/OP Detail - Compacto.dc.html',
  support: 'docs/ui/fixtures/op-detail-compacto/support.js',
  evidenceDir: 'docs/ui/evidence/ui-consolidation',
  evidence: 'docs/ui/evidence/ui-consolidation/Reconciliação de Tokens.dc.html',
  brandDir: 'assets/brand/inttex',
  brandReadme: 'assets/brand/inttex/README.md',
  index: 'index.html',
};

/** Directories that hold application runtime, scanned for token references. */
export const RUNTIME_ROOTS = ['js', 'css'];
export const RUNTIME_FILES = ['index.html'];

const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude', '.codex']);

function walk(absDir, root, out) {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = join(absDir, entry.name);
    if (entry.isDirectory()) walk(abs, root, out);
    else if (entry.isFile()) out.push(toPosix(relative(root, abs)));
  }
  return out;
}

export function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

export function exists(root, relPath) {
  try {
    return statSync(join(root, relPath)).isFile();
  } catch {
    return false;
  }
}

export function read(root, relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

export function sha256(root, relPath) {
  return createHash('sha256')
    .update(readFileSync(join(root, relPath)))
    .digest('hex');
}

/**
 * Build the single normalized inventory the rule set consumes.
 *
 * @param {string} root absolute repository root
 */
export function buildInventory(root) {
  const files = [];
  for (const dir of ['assets', 'css', 'docs', 'js', 'scripts', 'tests']) {
    walk(join(root, dir), root, files);
  }
  for (const f of RUNTIME_FILES) if (exists(root, f)) files.push(f);

  const runtimeFiles = files.filter(
    (f) =>
      RUNTIME_FILES.includes(f) ||
      RUNTIME_ROOTS.some((r) => f.startsWith(`${r}/`)),
  );

  const brandFiles = files
    .filter((f) => f.startsWith(`${PATHS.brandDir}/`))
    .sort();

  return {
    root,
    files,
    runtimeFiles,
    brandSvgs: brandFiles.filter((f) => f.endsWith('.svg')),
    productScreens: files.filter((f) => f.startsWith('js/screens/')),
  };
}
