/* ============================================================
   UI COLOUR OWNERSHIP FOUNDATION (D9)

   Guards the ownership layer the phase-5 colour pass rests on:
   the exact set of tokens added, the badge runtime owner, the
   business-colour owner, and the prohibitions that stop a second
   palette re-appearing.

   These are foundation assertions. They do NOT re-measure the
   screens — `tests/ui-conformance-phase5-pass1.test.mjs` does that.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { parseTokenDeclarations } from '../scripts/ui-foundation/token-parser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const TOKENS_CSS = read('css/tokens.css');
const INDEX_HTML = read('index.html');
const CONTRACT = read('docs/architecture/UI_VISUAL_CONTRACT.md');
const DECISIONS = read('docs/architecture/DESIGN_DECISIONS.md');

/**
 * The cache-busting token css/tokens.css currently carries.
 *
 * What test 16 guards is the DELIVERY INVARIANT, not a particular string: the
 * token stylesheet is loaded exactly once, only under a versioned URL, never
 * bare, and before css/responsive.css. Every later pass that edits the sheet
 * must move this token, or a browser could pair new JavaScript with a cached
 * old stylesheet — the exact defect pass 1 was corrected for. Pass 6 added the
 * four typography role tokens, so the value moves with it.
 */
const PASS1_TOKEN = '20260726-ui-p5-pass6-typography-a1-kpi';
const TOKENS_LINK = `<link rel="stylesheet" href="css/tokens.css?v=${PASS1_TOKEN}">`;

const SCREEN_DIR = path.join(ROOT, 'js', 'screens');
const SCREENS = fs.readdirSync(SCREEN_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, rel: `js/screens/${f}`, text: fs.readFileSync(path.join(SCREEN_DIR, f), 'utf8') }));

/** The exact tokens D9 authorized. Nothing else may appear. */
const AUTHORIZED_NEW_TOKENS = [
  '--rv-signal-caution-bg',
  '--rv-signal-caution-border',
  '--rv-text-on-signal',
  '--rv-viz-track',
  '--rv-viz-primary',
  '--rv-viz-secondary',
  '--rv-viz-series-3',
  '--rv-viz-series-4',
  '--rv-overlay-scrim',
];

/**
 * The typography roles the phase-5 pass-6 order ratified. Held apart from the
 * D9 list so `AUTHORIZED_NEW_TOKENS` keeps meaning exactly "what D9 authorized"
 * — these are a later, separately authorized addition, not a widening of D9.
 */
const PASS6_NEW_TOKENS = [
  '--rv-fs-section-heading',   // SECTION_HEADING · 20px
  '--rv-fs-component-heading', // COMPONENT_HEADING · 16px
  '--rv-fs-micro',             // MICRO_COPY · 10px, floor of the scale
  '--rv-icon-glyph-lg',        // icon-only text glyph · 20px
  // Correction A1 restored the numeric hierarchy pass 6 collapsed onto 15px.
  '--rv-fs-kpi-hero',          // KPI_HERO · 30px
  '--rv-fs-kpi-card',          // KPI_CARD · 24px
  '--rv-fs-summary-total',     // SUMMARY_TOTAL · 20px, distinct from the heading
];

/** Canonical token set at the phase-4 checkpoint 9fbb84c, before D9. */
const BASELINE_CANONICAL = [
  '--rv-bg', '--rv-surface', '--rv-surface-subtle',
  '--rv-border', '--rv-border-strong', '--rv-border-soft',
  '--rv-text-title', '--rv-text-primary', '--rv-text-secondary', '--rv-text-tertiary',
  '--rv-brand', '--rv-brand-strong', '--rv-brand-light', '--rv-accent-blue',
  '--rv-active-bg', '--rv-active-bg-solid', '--rv-chip-bg', '--rv-chip-glyph',
  '--rv-focus-ring', '--rv-text-on-brand',
  '--rv-brand-teal', '--rv-brand-teal-ink', '--rv-brand-teal-light', '--rv-brand-graphite',
  '--rv-signal-negative', '--rv-signal-negative-border', '--rv-signal-positive',
  '--rv-signal-positive-bg', '--rv-signal-positive-border', '--rv-signal-caution',
  '--rv-pill-positive-bg', '--rv-pill-positive-border', '--rv-pill-positive-text', '--rv-pill-positive-dot',
  '--rv-pill-neutral-bg', '--rv-pill-neutral-border', '--rv-pill-neutral-text', '--rv-pill-neutral-dot',
  '--rv-pill-caution-bg', '--rv-pill-caution-border', '--rv-pill-caution-text', '--rv-pill-caution-dot',
  '--rv-pill-negative-bg', '--rv-pill-negative-border', '--rv-pill-negative-text', '--rv-pill-negative-dot',
  '--rv-pill-info-bg', '--rv-pill-info-border', '--rv-pill-info-text', '--rv-pill-info-dot',
  '--rv-stage-tecelagem', '--rv-stage-tecelagem-bg', '--rv-stage-acabamento', '--rv-stage-acabamento-bg',
  '--rv-alert-azul-bg', '--rv-alert-azul-border', '--rv-alert-amarelo-bg', '--rv-alert-amarelo-border',
  '--rv-alert-verde-bg', '--rv-alert-verde-border', '--rv-alert-laranja-bg', '--rv-alert-laranja-border',
  '--rv-alert-vermelho-bg', '--rv-alert-vermelho-border', '--rv-alert-roxo-bg', '--rv-alert-roxo-border',
  '--rv-alert-ciano-bg', '--rv-alert-ciano-border',
  '--rv-radius', '--rv-radius-pill',
  '--rv-shadow-none', '--rv-shadow-sm', '--rv-shadow-popover',
  '--rv-h-compact', '--rv-h-default', '--rv-h-primary',
  '--rv-font-sans', '--rv-fs-title', '--rv-fs-metric', '--rv-fs-metric-rail', '--rv-fs-value',
  '--rv-fs-body', '--rv-fs-sm', '--rv-fs-xs', '--rv-fs-2xs', '--rv-fs-label', '--rv-fs-thead',
  '--rv-tracking-title', '--rv-tracking-label', '--rv-tracking-thead',
  '--rv-header-h', '--rv-sidebar-w', '--rv-rail-w', '--rv-content-max', '--rv-main-pad',
  '--rv-gap-stack', '--rv-gap-cols', '--rv-pad-card', '--rv-pad-card-rail', '--rv-cell-pad-x',
  '--rv-z-modal', '--rv-z-toast',
];

/* ---------- a browser-shaped sandbox for the two runtime owners ---------- */

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this._text = null;
    this.style = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this.attrs[k] = v; if (k === 'style') this.style = v; }
  addEventListener() {}
  removeEventListener() {}
  replaceChildren(...nodes) {
    this.children = [];
    for (const n of nodes.flat()) {
      if (n === null || n === undefined || n === false) continue;
      this.children.push(typeof n === 'string' ? new FakeText(n) : n);
    }
  }
  get textContent() {
    if (this._text !== null) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this._text = v; this.children = []; }
}
class FakeText extends FakeNode {
  constructor(t) { super('#text'); this._text = t; }
}

/** A status dot is an element child painted from a `*-dot` token. */
function hasDot(node) {
  return node.children.some((c) => /-dot\)/.test((c.attrs && c.attrs.style) || ''));
}

function bootRuntime() {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => new FakeText(t),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = { document, console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/ui.js'), sandbox, { filename: 'js/ui.js' });
  vm.runInContext(read('js/badges.js'), sandbox, { filename: 'js/badges.js' });
  vm.runInContext(read('js/pedido-ui.js'), sandbox, { filename: 'js/pedido-ui.js' });
  return sandbox;
}

/* ============================================================
   1 · every authorized token exists and resolves
   ============================================================ */

test('1 · every D9 token is declared canonical and resolves through the token graph', () => {
  const { byName } = parseTokenDeclarations(TOKENS_CSS);

  for (const token of AUTHORIZED_NEW_TOKENS) {
    const decl = byName.get(token);
    assert.ok(decl, `${token} is not declared in css/tokens.css`);
    assert.equal(decl.kind, 'canonical', `${token} must be canonical, not ${decl.kind}`);
  }

  // Resolve each one to a concrete value: follow var() chains to ground.
  const valueOf = new Map();
  for (const m of TOKENS_CSS.matchAll(/(--rv-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!valueOf.has(m[1])) valueOf.set(m[1], m[2].trim());
  }
  const ground = (token, seen = new Set()) => {
    assert.ok(!seen.has(token), `${token} resolves in a cycle`);
    seen.add(token);
    const raw = valueOf.get(token);
    assert.ok(raw, `${token} has no value`);
    const ref = raw.match(/^var\(\s*(--rv-[a-z0-9-]+)\s*\)$/);
    return ref ? ground(ref[1], seen) : raw;
  };
  for (const token of AUTHORIZED_NEW_TOKENS) {
    const v = ground(token);
    assert.ok(v.length > 0, `${token} resolves to nothing`);
    assert.doesNotMatch(v, /var\(/, `${token} did not fully resolve: ${v}`);
  }
});

test('1b · the composed tokens resolve to the family they claim', () => {
  const valueOf = new Map();
  for (const m of TOKENS_CSS.matchAll(/(--rv-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!valueOf.has(m[1])) valueOf.set(m[1], m[2].trim());
  }
  assert.equal(valueOf.get('--rv-signal-caution-bg'), 'var(--rv-pill-caution-bg)');
  assert.equal(valueOf.get('--rv-signal-caution-border'), 'var(--rv-pill-caution-border)');
  assert.equal(valueOf.get('--rv-text-on-signal'), 'var(--rv-surface)');
  assert.equal(valueOf.get('--rv-viz-track'), 'var(--rv-border-soft)');
  assert.equal(valueOf.get('--rv-viz-primary'), 'var(--rv-brand)');
  assert.equal(valueOf.get('--rv-viz-secondary'), 'var(--rv-accent-blue)');
  assert.equal(valueOf.get('--rv-viz-series-3'), 'var(--rv-stage-tecelagem)');
  assert.equal(valueOf.get('--rv-viz-series-4'), 'var(--rv-stage-acabamento)');
  // The scrim is the one promoted literal, and it is the value the modals used.
  assert.equal(valueOf.get('--rv-overlay-scrim'), 'rgba(15, 23, 42, .42)');
});

/* ============================================================
   2 · no token beyond the authorized list was added
   ============================================================ */

test('2 · no canonical token exists beyond the phase-4 baseline plus the D9 list', () => {
  const { canonical, deprecated } = parseTokenDeclarations(TOKENS_CSS);
  const allowed = new Set([...BASELINE_CANONICAL, ...AUTHORIZED_NEW_TOKENS, ...PASS6_NEW_TOKENS]);
  const unexpected = canonical.filter((t) => !allowed.has(t));
  assert.deepEqual(unexpected, [], `unauthorized canonical token(s): ${unexpected.join(', ')}`);

  const missing = BASELINE_CANONICAL.filter((t) => !canonical.includes(t));
  assert.deepEqual(missing, [], `phase-4 token(s) removed: ${missing.join(', ')}`);

  assert.equal(
    canonical.length,
    BASELINE_CANONICAL.length + AUTHORIZED_NEW_TOKENS.length + PASS6_NEW_TOKENS.length,
  );
  // The deprecated compatibility block is untouched by this pass.
  assert.equal(deprecated.length, 26, 'the LEGACY COMPATIBILITY block changed size');
});

test('2b · D9 introduced exactly one new literal value, the scrim', () => {
  const { byName } = parseTokenDeclarations(TOKENS_CSS);
  const valueOf = new Map();
  for (const m of TOKENS_CSS.matchAll(/(--rv-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!valueOf.has(m[1])) valueOf.set(m[1], m[2].trim());
  }
  const literalNew = AUTHORIZED_NEW_TOKENS.filter((t) => !/^var\(/.test(valueOf.get(t) || ''));
  assert.deepEqual(literalNew, ['--rv-overlay-scrim']);
  assert.ok(byName.get('--rv-overlay-scrim'));
});

/* ============================================================
   3 · lifecycle normalization and family mapping are exact
   ============================================================ */

test('3 · lifecycle normalization collapses case, accents, underscores and whitespace', () => {
  const { window: w } = bootRuntime();
  assert.equal(w.rvNormalizeStateKey('Em produção'), 'em producao');
  assert.equal(w.rvNormalizeStateKey('em_producao'), 'em producao');
  assert.equal(w.rvNormalizeStateKey('EM  PRODUCAO'), 'em producao');
  assert.equal(w.rvNormalizeStateKey('  Não   Aplicável '), 'nao aplicavel');
  assert.equal(w.rvNormalizeStateKey('Pronto p/ retirada'), 'pronto p retirada');
  assert.equal(w.rvNormalizeStateKey(null), '');
  assert.equal(w.rvNormalizeStateKey(undefined), '');
  assert.equal(w.rvNormalizeStateKey(42), '42');
});

test('3b · every ruled state maps to its ruled family', () => {
  const { window: w } = bootRuntime();
  const ruled = {
    positive: ['Deferida', 'Ativo', 'Conectado', 'Resolvido', 'Concluído', 'Aceito',
      'Recebido', 'Entregue', 'Finalizada', 'Pronto p/ retirada', 'Pronto p/ envio'],
    caution: ['Pendente', 'Em análise', 'Reconectar', 'Em produção', 'Em transporte', 'Parcial'],
    negative: ['Indeferida', 'Encerrada', 'Cancelado', 'Cancelada', 'Rejeitado', 'Atrasado'],
    info: ['Devolvida', 'Emitida', 'Aberta', 'Atrelado'],
    neutral: ['Inativo', 'Desconectado', 'Trancado', 'Rascunho', 'Simulada', 'Não aplicável'],
  };
  for (const [family, states] of Object.entries(ruled)) {
    for (const state of states) {
      assert.equal(w.rvStatusFamily(state), family, `${state} -> ${family}`);
    }
  }
});

test('3c · an unrecognised state is neutral, never an invented family', () => {
  const { window: w } = bootRuntime();
  for (const unknown of ['xyz', 'confirmado', 'whatever', '', null, undefined, 'unknown']) {
    assert.equal(w.rvStatusFamily(unknown), 'neutral', String(unknown));
  }
  const { RV_STATUS_FAMILY, RV_STATUS_FAMILIES } = w.RV_BADGES;
  for (const [state, family] of Object.entries(RV_STATUS_FAMILY)) {
    assert.ok(RV_STATUS_FAMILIES.includes(family), `${state} has family ${family}`);
  }
});

test('3d · persisted keys whose label is a ruled state resolve to that state', () => {
  const { window: w } = bootRuntime();
  assert.equal(w.rvStatusFamily('produzindo'), 'caution');   // label "Em produção"
  assert.equal(w.rvStatusFamily('pending'), 'caution');      // label "Pendente"
  assert.equal(w.rvStatusFamily('assigned'), 'info');        // label "Atrelado"
  assert.equal(w.rvStatusFamily('accepted'), 'positive');    // label "Aceito"
  assert.equal(w.rvStatusFamily('rejected'), 'negative');    // label "Rejeitado"
});

/* ============================================================
   4 · classifications are neutral and carry no dot
   ============================================================ */

test('4 · a classification badge is neutral, dotless and tokenized', () => {
  const { window: w } = bootRuntime();
  const style = w.rvClassificationBadgeStyle();
  assert.match(style, /background:var\(--rv-pill-neutral-bg\)/);
  assert.match(style, /border:1px solid var\(--rv-pill-neutral-border\)/);
  assert.match(style, /color:var\(--rv-pill-neutral-text\)/);
  assert.doesNotMatch(style, /#[0-9a-f]{3,8}/i);

  for (const label of ['Admin', 'Fornecedor', 'Cliente', 'NF-e', 'Romaneio',
    'Entrada', 'Saída', 'PDF', 'XML', 'JSONL', 'Manta', 'Tapete', 'Nativa', 'Legado']) {
    const node = w.rvClassificationBadge(label);
    assert.equal(node.tagName, 'SPAN');
    assert.equal(node.textContent, label);
    assert.ok(!hasDot(node), `${label} must not carry a status dot`);
    assert.equal(node.attrs.style, style, `${label} must not get its own colour`);
  }
});

/* ============================================================
   5 · stages are stage badges, without a status dot
   ============================================================ */

test('5 · tecelagem and acabamento are stages, not statuses', () => {
  const { window: w } = bootRuntime();
  assert.equal(w.rvStageOf('Tecelagem'), 'tecelagem');
  assert.equal(w.rvStageOf('em_tecelagem'), 'tecelagem');
  assert.equal(w.rvStageOf('Acabamento'), 'acabamento');
  assert.equal(w.rvStageOf('Em acabamento'), 'acabamento');
  assert.equal(w.rvStageOf('em_acabamento'), 'acabamento');
  // a lifecycle status is not a stage
  assert.equal(w.rvStageOf('Em produção'), null);
  assert.equal(w.rvStageOf('entregue'), null);
  // ... and stays a caution status, independent of stage
  assert.equal(w.rvStatusFamily('Em produção'), 'caution');
});

test('5b · a stage badge uses the stage family, has no dot and no literal', () => {
  const { window: w } = bootRuntime();
  for (const [stage, token] of [['tecelagem', 'tecelagem'], ['acabamento', 'acabamento']]) {
    const style = w.rvStageBadgeStyle(stage);
    assert.match(style, new RegExp(`background:var\\(--rv-stage-${token}-bg\\)`));
    assert.match(style, new RegExp(`color:var\\(--rv-stage-${token}\\)`));
    assert.doesNotMatch(style, /#[0-9a-f]{3,8}/i);
    const node = w.rvStageBadge('Acabamento', stage);
    assert.ok(!hasDot(node), 'a stage badge carries no dot');
  }
  // §2.7: stage and status never share a colour.
  const stageStyles = ['tecelagem', 'acabamento'].map((s) => w.rvStageBadgeStyle(s));
  const statusStyles = ['positive', 'caution', 'negative', 'info', 'neutral']
    .map((f) => w.rvStatusPillStyle(f === 'neutral' ? 'rascunho' : f === 'positive' ? 'entregue'
      : f === 'caution' ? 'pendente' : f === 'negative' ? 'cancelado' : 'emitida'));
  for (const s of stageStyles) {
    for (const p of statusStyles) assert.notEqual(s, p);
  }
});

test('5c · a status pill carries its dot and only pill-family tokens', () => {
  const { window: w } = bootRuntime();
  const node = w.rvStatusPill('Em produção', 'produzindo');
  assert.equal(node.tagName, 'SPAN');
  assert.equal(node.textContent, 'Em produção');
  assert.equal(node.children.length, 2, 'dot + label');
  assert.match(node.children[0].attrs.style, /background:var\(--rv-pill-caution-dot\)/);
  assert.match(node.attrs.style, /var\(--rv-pill-caution-bg\)/);
  assert.doesNotMatch(node.attrs.style, /#[0-9a-f]{3,8}/i);
});

/* ============================================================
   6 · caution surfaces use only the signal-caution family
   ============================================================ */

test('6 · a caution ACTION surface uses --rv-signal-caution-*, never pill tokens', () => {
  // The pill family dresses pills. What the contract forbids is reaching into
  // it for something that is not one — a button, a banner, a KPI surface. Those
  // are identifiable by carrying a control affordance in the same declaration.
  const CONTROL = /cursor:\s*pointer|font-family:\s*inherit|height:\s*3[248]px/;
  const offenders = [];
  for (const s of SCREENS) {
    s.text.split(/\r?\n/).forEach((line, i) => {
      if (!/var\(--rv-pill-caution-(bg|border)\)/.test(line)) return;
      if (!CONTROL.test(line)) return;
      offenders.push(`${s.rel}:${i + 1} ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [],
    `a caution action surface must use --rv-signal-caution-bg/-border:\n${offenders.join('\n')}`);

  assert.match(CONTRACT, /\| Caution \| `--rv-signal-caution-bg` \| `--rv-signal-caution-border` \| `--rv-signal-caution` \|/);
});

test('6b · the caution action family is actually reachable and used', () => {
  const users = SCREENS.filter((s) => /var\(--rv-signal-caution-(bg|border)\)/.test(s.text));
  assert.ok(users.length > 0, 'no screen uses the caution action family');
});

/* ============================================================
   7 · modal overlays use the scrim token
   ============================================================ */

test('7 · every full-screen overlay uses --rv-overlay-scrim and nothing else', () => {
  const offenders = [];
  for (const s of SCREENS) {
    const lines = s.text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/position:\s*fixed/.test(line) || !/inset:\s*0/.test(line)) return;
      if (!/background/.test(line)) return;
      if (/var\(--rv-overlay-scrim\)/.test(line)) return;
      if (/background:\s*(transparent|none)/.test(line)) return;
      offenders.push(`${s.rel}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `overlay without the scrim token:\n${offenders.join('\n')}`);
});

test('7b · the scrim is not used for hover, selection, focus or a badge', () => {
  for (const s of SCREENS) {
    for (const m of s.text.matchAll(/[^\n]*var\(--rv-overlay-scrim\)[^\n]*/g)) {
      const line = m[0];
      assert.doesNotMatch(line, /:hover|border-radius:var\(--rv-radius-pill\)|outline|box-shadow/,
        `${s.rel}: scrim used outside a modal backdrop -> ${line.trim()}`);
    }
  }
});

/* ============================================================
   8 · visualization has no independent palette
   ============================================================ */

test('8 · gradients compose tokens and carry no literal colour stop', () => {
  const offenders = [];
  for (const s of SCREENS) {
    for (const m of s.text.matchAll(/[a-z-]*gradient\([^)]*(?:\([^)]*\)[^)]*)*\)/gi)) {
      if (/#[0-9a-f]{3,8}\b/i.test(m[0]) || /\brgba?\s*\(/i.test(m[0])) {
        offenders.push(`${s.rel}: ${m[0].slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `literal colour stop in a gradient:\n${offenders.join('\n')}`);
});

test('8b · the visualization tokens are the only chart/track vocabulary', () => {
  const { canonical } = parseTokenDeclarations(TOKENS_CSS);
  const viz = canonical.filter((t) => t.startsWith('--rv-viz-'));
  assert.deepEqual(viz.sort(), [
    '--rv-viz-primary', '--rv-viz-secondary', '--rv-viz-series-3',
    '--rv-viz-series-4', '--rv-viz-track',
  ]);
});

/* ============================================================
   9 · rvTokenValue is conditional — and is not required here
   ============================================================ */

test('9 · no non-CSS colour consumer exists, so no token-resolution helper was added', () => {
  // The order authorizes `rvTokenValue` in js/ui.js ONLY for a consumer that
  // cannot read var(...) — canvas or an equivalent API. Prove there is none,
  // which is why the helper is absent rather than unused.
  const consumers = [];
  for (const s of [...SCREENS, { rel: 'js/ui.js', text: read('js/ui.js') },
    { rel: 'js/badges.js', text: read('js/badges.js') },
    { rel: 'js/pedido-ui.js', text: read('js/pedido-ui.js') }]) {
    if (/getContext\s*\(|fillStyle|strokeStyle|new\s+Chart\b/.test(s.text)) consumers.push(s.rel);
  }
  assert.deepEqual(consumers, [], `non-CSS colour consumer found: ${consumers.join(', ')}`);

  const ui = read('js/ui.js');
  assert.doesNotMatch(ui, /rvTokenValue/,
    'rvTokenValue must not exist while no consumer requires it');

  // If it is ever added, it must fail closed and carry no fallback.
  assert.match(CONTRACT, /never by hard-coding a\s*\n?fallback value/);
});

/* ============================================================
   10-11 · the business palette and its precedence
   ============================================================ */

test('10 · js/pedido-ui.js owns the exact 17-entry business palette', () => {
  const { window: w } = bootRuntime();
  const U = w.RAVATEX_PEDIDO_UI;
  assert.deepEqual({ ...U.COR_PREVIEW_MAP }, {
    AMARELO: '#facc15', AREIA: '#d6c3a1', AZUL: '#2563eb', AZUL_CLARO: '#60a5fa',
    BEGE: '#d6b98c', BRANCO: '#f8fafc', CINZA: '#8a93a3', CRU: '#e8dcc8',
    GRAFITE: '#4b5563', KRAFT: '#b5722e', LARANJA: '#f97316', MARINHO: '#1e3a5f',
    PRETO: '#1a1a1a', ROSA: '#ec4899', ROXO: '#7c3aed', VERDE: '#16a34a',
    VERMELHO: '#dc2626',
  });
  assert.equal(U.COR_PREVIEW_SUBSTRING.length, 13);
  assert.equal(U.COR_PREVIEW_FALLBACK, '#cbd5e1');
  // substring order is behaviour, not decoration
  assert.equal(U.COR_PREVIEW_SUBSTRING[0][0], 'AZUL');
  assert.equal(w.corPreviewHex('AZUL CLARO'), '#2563eb');
  assert.equal(w.corPreviewHex('AZUL_CLARO'), '#60a5fa');
});

test('11 · an explicit valid record value outranks the name', () => {
  const { window: w } = bootRuntime();
  assert.equal(w.corPreviewHex('PRETO', '#ABCDEF'), '#abcdef');
  assert.equal(w.corPreviewHex({ nome: 'PRETO', cor_hex: '#123456' }), '#123456');
  assert.equal(w.corPreviewHex({ nome: 'PRETO', hex: '#654321' }), '#654321');
  // invalid explicit values never hijack the precedence
  for (const bad of ['', 'azul', '#12345', 'rgb(1,2,3)', null, undefined, 42]) {
    assert.equal(w.corPreviewHex('PRETO', bad), '#1a1a1a', String(bad));
  }
  // and the chain still ends at the canonical default
  assert.equal(w.corPreviewHex('cor inexistente'), '#cbd5e1');
});

/* ============================================================
   12 · no screen carries a second product palette
   ============================================================ */

test('12 · no screen declares a product-colour palette or substring fallback', () => {
  // A thin wrapper that delegates to the owner is fine; a screen-local PALETTE
  // is what D9 revoked. The two are told apart by whether the screen still
  // holds the values.
  const offenders = [];
  for (const s of SCREENS) {
    if (/\bAMARELO\s*:|\bKRAFT\s*:|\bMARINHO\s*:|\bAZUL_CLARO\s*:|\bGRAFITE\s*:/.test(s.text)) {
      offenders.push(`${s.rel}: product colour palette literal`);
    }
    if (/\.includes\(\s*'(AZUL|CINZA|CRU|KRAFT|MARINHO|PRETO|BRANCO|VERDE|VERMELHO|ROSA|ROXO|AMARELO|LARANJA)'/.test(s.text)) {
      offenders.push(`${s.rel}: product colour substring fallback`);
    }
    if (/palette\s*=\s*\[\s*'#/.test(s.text)) {
      offenders.push(`${s.rel}: literal swatch palette array`);
    }
  }
  assert.deepEqual(offenders, [], `screen-local business palette:\n${offenders.join('\n')}`);
});

test('12c · every swatch resolver in a screen delegates to the owner', () => {
  for (const s of SCREENS) {
    for (const name of ['getSwatchTone', 'swatchColor']) {
      const m = s.text.match(new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n  \\}`));
      if (!m) continue;
      assert.match(m[1], /window\.corPreviewHex/,
        `${s.rel}: ${name}() must delegate to the business-colour owner`);
      assert.doesNotMatch(m[1], /#[0-9a-f]{3,8}/i,
        `${s.rel}: ${name}() still holds a literal colour`);
    }
  }
});

test('12b · screens reach product colour only through corPreviewHex', () => {
  const consumers = SCREENS.filter((s) => /corPreviewHex/.test(s.text));
  assert.ok(consumers.length > 0, 'no screen consumes the business-colour owner');
  for (const s of consumers) {
    assert.match(s.text, /window\.corPreviewHex/,
      `${s.rel} must consume the global owner, not a local copy`);
  }
});

/* ============================================================
   13 · disabled styling uses opacity, not replacement colours
   ============================================================ */

test('13 · no disabled-state replacement colour survives', () => {
  const banned = ['#93b7f5', '#9fb4d6', '#e1e7f0'];
  const offenders = [];
  for (const s of SCREENS) {
    for (const value of banned) {
      if (s.text.toLowerCase().includes(value)) offenders.push(`${s.rel}: ${value}`);
    }
    if (/\.replace\(\s*['"]var\(--rv-[a-z0-9-]+\)['"]/.test(s.text)) {
      offenders.push(`${s.rel}: disabled style derived by string replacement`);
    }
  }
  assert.deepEqual(offenders, [], `disabled colour substitution:\n${offenders.join('\n')}`);
  assert.match(CONTRACT, /A disabled control keeps its enabled colours/);
});

/* ============================================================
   14 · the synthetic decorative illustration is gone
   ============================================================ */

test('14 · the synthetic product illustration was retired', () => {
  const form = SCREENS.find((s) => s.name === 'cliente-pedido-form.js');
  assert.ok(form, 'cliente-pedido-form.js missing');
  assert.doesNotMatch(form.text, /repeating-linear-gradient/,
    'the synthetic weave gradient is still present');
  assert.doesNotMatch(form.text, /#c9b98a|#d9caa0|#c8b680|#ddd0a8|#c4b47c|#d4c9a8/i,
    'the decorative tan palette is still present');
  for (const s of SCREENS) {
    assert.doesNotMatch(s.text, /repeating-linear-gradient/, `${s.rel}`);
  }
});

/* ============================================================
   15 · inverse text on a solid signal surface
   ============================================================ */

test('15 · text on a solid signal surface uses --rv-text-on-signal', () => {
  const offenders = [];
  const signalFill = /background:\s*var\(--rv-signal-(positive|caution|negative)\)/;
  for (const s of SCREENS) {
    const lines = s.text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!signalFill.test(line)) return;
      if (!/color:/.test(line)) return;
      if (/color:\s*var\(--rv-text-on-signal\)/.test(line)) return;
      offenders.push(`${s.rel}:${i + 1} ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [], `inverse text on a signal surface:\n${offenders.join('\n')}`);
  assert.match(CONTRACT, /`--rv-text-on-signal`/);
});

test('15b · --rv-text-on-brand stays scoped to brand surfaces', () => {
  assert.match(CONTRACT, /`--rv-text-on-brand` stays restricted to brand\/action surfaces/);
  const { window: w } = bootRuntime();
  assert.ok(w);
});

/* ============================================================
   16 · the token stylesheet is delivered cache-coherently

   D9 added nine tokens to `css/tokens.css`, and the pass stamped
   the changed JavaScript with the pass-1 cache-busting token. A
   bare `href="css/tokens.css"` would let a client hold a cached
   pre-D9 stylesheet while receiving JavaScript that references
   the new variables, so the ownership layer would resolve to
   nothing at runtime. The token stylesheet carries the same
   pass-1 token as the assets that depend on it.
   ============================================================ */

test('16 · index.html loads the token stylesheet under the pass-1 cache-busting token', () => {
  assert.ok(INDEX_HTML.includes(TOKENS_LINK),
    `index.html must load the token stylesheet as ${TOKENS_LINK}`);

  const refs = INDEX_HTML.match(/href="css\/tokens\.css(?:\?[^"]*)?"/g) || [];
  assert.deepEqual(refs, [`href="css/tokens.css?v=${PASS1_TOKEN}"`],
    'the token stylesheet must be loaded exactly once, and only under the versioned URL');

  // A bare URL anywhere would reintroduce the incoherent delivery.
  assert.doesNotMatch(INDEX_HTML, /href="css\/tokens\.css"/,
    'no bare token stylesheet URL may survive');
});

test('16b · the token stylesheet still precedes css/responsive.css', () => {
  const tokensAt = INDEX_HTML.indexOf('href="css/tokens.css?v=');
  const responsiveAt = INDEX_HTML.indexOf('href="css/responsive.css?v=');
  assert.notEqual(tokensAt, -1, 'token stylesheet link not found');
  assert.notEqual(responsiveAt, -1, 'responsive stylesheet link not found');
  assert.ok(tokensAt < responsiveAt,
    'the token stylesheet must be loaded before css/responsive.css, which consumes the tokens');
});

/* ============================================================
   D9 is recorded, and D1-D8 were not rewritten
   ============================================================ */

test('D9 is appended to the decision log and D1-D8 are intact', () => {
  assert.match(DECISIONS, /## 2026-07-26 · D9 — Phase-5 colour ownership completion/);
  for (const d of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
    assert.match(DECISIONS, new RegExp(`\\| ${d} \\|`), `${d} missing from the log`);
  }
  assert.match(DECISIONS, /## 2026-07-25 · Round 1 — reconciling the three namespaces/);
  assert.match(DECISIONS, /## 2026-07-25 · D6\.1 — what `--rv-radius-pill` owns/);
  // D9 must sit after D6.1: the log is append-only.
  assert.ok(DECISIONS.indexOf('· D9 —') > DECISIONS.indexOf('· D6.1 —'));
});

test('the contract records every D9 ownership', () => {
  assert.match(CONTRACT, /the 13 components/);
  assert.match(CONTRACT, /### 2\.6\.1 Classification badge/);
  assert.match(CONTRACT, /### 2\.12 Progress, range and chart/);
  assert.match(CONTRACT, /`js\/pedido-ui\.js` \| product-colour preview values \(D9\)/);
  assert.match(CONTRACT, /Owner: `js\/badges\.js`/);
  assert.match(CONTRACT, /production stages\*\*,\s*\n?not lifecycle statuses/);
});
