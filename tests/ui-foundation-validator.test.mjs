/* ============================================================
   FOCUSED TESTS — UI FOUNDATION VALIDATOR

   Each test scaffolds a throwaway repository root outside the real
   worktree, then mutates exactly one fact. Every critical ownership
   rule has a deliberate failing fixture.

   Parsing is never reimplemented here: the tests import the same
   modules the validator uses.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/validate-ui-foundation.mjs';
import { PATHS } from '../scripts/ui-foundation/inventory.mjs';
import {
  parseTokenDeclarations,
  parseTokenReferences,
} from '../scripts/ui-foundation/token-parser.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const COPY = [
  PATHS.tokens,
  PATHS.contract,
  PATHS.decisions,
  PATHS.conformance,
  PATHS.sgaa,
  PATHS.brief,
  PATHS.fixture,
  PATHS.support,
  PATHS.evidence,
];

/** Build a minimal but genuinely conforming foundation in a temp root. */
function scaffold() {
  const root = mkdtempSync(join(tmpdir(), 'uifound-'));
  for (const rel of COPY) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    cpSync(join(REPO, rel), join(root, rel));
  }
  mkdirSync(join(root, PATHS.brandDir), { recursive: true });
  for (const name of readdirSync(join(REPO, PATHS.brandDir))) {
    cpSync(join(REPO, PATHS.brandDir, name), join(root, PATHS.brandDir, name));
  }
  mkdirSync(join(root, 'js/screens'), { recursive: true });
  writeFileSync(join(root, 'js/screens/stub.js'), 'const a = `color: var(--rv-brand)`;\n');
  writeFileSync(join(root, 'index.html'), '<link rel="stylesheet" href="css/tokens.css">\n');
  return root;
}

function withScaffold(fn) {
  const root = scaffold();
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const ids = (result) => result.errors.map((f) => f.rule_id);
const edit = (root, rel, fn) =>
  writeFileSync(join(root, rel), fn(readFileSync(join(root, rel), 'utf8')));

/* ---------- baseline ---------- */

test('conforming foundation passes with zero errors', () => {
  withScaffold((root) => {
    const result = validate(root);
    assert.equal(result.status, 'PASS', JSON.stringify(result.errors, null, 2));
    assert.equal(result.errors.length, 0);
  });
});

test('every finding carries the structured shape', () => {
  withScaffold((root) => {
    for (const f of validate(root).findings) {
      for (const key of ['rule_id', 'severity', 'path', 'line_or_location', 'message']) {
        assert.ok(f[key], `finding missing ${key}: ${JSON.stringify(f)}`);
      }
    }
  });
});

/* ---------- deliberate failures ---------- */

test('UIF-002 — unknown runtime token fails', () => {
  withScaffold((root) => {
    writeFileSync(join(root, 'js/screens/stub.js'), 'x = `color: var(--rv-does-not-exist)`;\n');
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-002'));
  });
});

test('UIF-006 — deprecated reference is reported as debt, not failure', () => {
  withScaffold((root) => {
    writeFileSync(join(root, 'js/screens/stub.js'), 'x = `color: var(--rv-color-accent)`;\n');
    const result = validate(root);
    assert.equal(result.status, 'PASS');
    assert.ok(result.debt.some((f) => f.rule_id === 'UIF-006'));
  });
});

test('UIF-001 — a second token declaration site fails', () => {
  withScaffold((root) => {
    writeFileSync(join(root, 'js/screens/stub.js'), ':root { --rv-brand: #123456; }\n');
    assert.ok(ids(validate(root)).includes('UIF-001'));
  });
});

test('UIF-004 — an unapproved name in the compatibility block fails', () => {
  withScaffold((root) => {
    edit(root, PATHS.tokens, (css) => {
      const anchor = '--rv-status-prod-dot:';
      assert.ok(css.includes(anchor), 'compatibility block anchor missing');
      return css.replace(anchor, '--rv-color-smuggled: #ff0000;\n  ' + anchor);
    });
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-004'));
  });
});

test('UIF-005 — removing canonical --rv-chip-glyph fails', () => {
  withScaffold((root) => {
    edit(root, PATHS.tokens, (css) => css.replace(/\s*--rv-chip-glyph:[^;]*;/, ''));
    assert.ok(ids(validate(root)).includes('UIF-005'));
  });
});

test('UIF-007 — a contract literal where a token is required fails', () => {
  withScaffold((root) => {
    edit(root, PATHS.contract, (md) =>
      md.replace('var(--rv-chip-glyph)', '#64748b'),
    );
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(result.errors.some((f) => f.rule_id === 'UIF-007' && f.message.includes('#64748b')));
  });
});

test('UIF-008 — two architecture documents with identical bytes fail', () => {
  withScaffold((root) => {
    cpSync(join(root, PATHS.contract), join(root, PATHS.brief));
    assert.ok(ids(validate(root)).includes('UIF-008'));
  });
});

test('UIF-010 — a duplicate OP Detail fixture fails', () => {
  withScaffold((root) => {
    cpSync(
      join(root, PATHS.fixture),
      join(root, `${PATHS.fixtureDir}/OP Detail - Compacto copy.dc.html`),
    );
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-010'));
  });
});

test('UIF-011 — a copied support.js fails', () => {
  withScaffold((root) => {
    cpSync(join(root, PATHS.support), join(root, `${PATHS.evidenceDir}/support.js`));
    assert.ok(ids(validate(root)).includes('UIF-011'));
  });
});

test('UIF-012 — a missing support dependency fails', () => {
  withScaffold((root) => {
    rmSync(join(root, PATHS.support));
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-012'));
  });
});

test('UIF-013 — fixture infrastructure imported by runtime fails', () => {
  withScaffold((root) => {
    writeFileSync(
      join(root, 'index.html'),
      '<script src="docs/ui/fixtures/op-detail-compacto/support.js"></script>\n',
    );
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-013'));
  });
});

test('UIF-014 — a seventh brand SVG fails', () => {
  withScaffold((root) => {
    writeFileSync(
      join(root, `${PATHS.brandDir}/inttex-extra.svg`),
      '<svg viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>\n',
    );
    assert.ok(ids(validate(root)).includes('UIF-014'));
  });
});

test('UIF-015 — an SVG without a viewBox fails', () => {
  withScaffold((root) => {
    edit(root, `${PATHS.brandDir}/inttex-logo-mono.svg`, (svg) =>
      svg.replace(/viewBox="[^"]*"/, ''),
    );
    assert.ok(ids(validate(root)).includes('UIF-015'));
  });
});

test('UIF-016 — an undocumented duplicate SVG fails', () => {
  withScaffold((root) => {
    edit(root, PATHS.brandReadme, (md) =>
      md.replace('e416f775aaf8543bc23a3c953ed7613b84afa6d0e2a0d8ec444ca40b4ca1a29a', 'REDACTED'),
    );
    const result = validate(root);
    assert.equal(result.status, 'FAIL');
    assert.ok(ids(result).includes('UIF-016'));
  });
});

test('UIF-016 — the documented duplicate is accepted', () => {
  withScaffold((root) => {
    assert.ok(!ids(validate(root)).includes('UIF-016'));
  });
});

test('UIF-017 — a second root handoff fails', () => {
  withScaffold((root) => {
    writeFileSync(join(root, 'HANDOFF.md'), '# intake handoff\n');
    assert.ok(ids(validate(root)).includes('UIF-017'));
  });
});

test('UIF-018 — a build dependency on .claude fails', () => {
  withScaffold((root) => {
    writeFileSync(join(root, 'index.html'), '<script src=".claude/design-skill/x.js"></script>\n');
    assert.ok(ids(validate(root)).includes('UIF-018'));
  });
});

/* ---------- parser unit coverage ---------- */

test('parser splits canonical from deprecated declarations', () => {
  const parsed = parseTokenDeclarations(readFileSync(join(REPO, PATHS.tokens), 'utf8'));
  assert.equal(parsed.byName.get('--rv-brand').kind, 'canonical');
  assert.equal(parsed.byName.get('--rv-chip-glyph').kind, 'canonical');
  assert.equal(parsed.byName.get('--rv-status-prep').kind, 'deprecated');
  assert.equal(parsed.byName.get('--rv-color-accent').kind, 'deprecated');
});

test('parser reads several declarations on one physical line', () => {
  const parsed = parseTokenDeclarations(
    ':root{ --rv-a: #111; --rv-b: #222; --rv-c: #333; }',
  );
  assert.deepEqual(parsed.canonical, ['--rv-a', '--rv-b', '--rv-c']);
});

test('parser never mistakes a var() reference for a declaration', () => {
  const parsed = parseTokenDeclarations('a { color: var(--rv-brand); }');
  assert.equal(parsed.byName.size, 0);
});

test('parser ignores token names that only appear inside comments', () => {
  const parsed = parseTokenDeclarations('/* --rv-ghost: #000; */\n:root{ --rv-real: #fff; }');
  assert.deepEqual(parsed.canonical, ['--rv-real']);
});

test('reference parser reports accurate line numbers', () => {
  const refs = parseTokenReferences('a{}\nb{ color: var(--rv-brand); }\n');
  assert.deepEqual(refs, [{ token: '--rv-brand', line: 2 }]);
});
