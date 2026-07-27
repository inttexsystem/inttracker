/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 6, CORRECTION A1
   KPI HIERARCHY AND PAGE-HEADER ACTION

   Pass 6 closed UIC-005 correctly and collapsed every large operational number
   onto one role, EMPHASISED_METRIC at 15px. That erased three real hierarchy
   levels. A1 restores them as SEMANTIC ROLES, not as restored numbers:

     KPI_HERO       30px  dashboard primary KPI, dominant content of its card
     KPI_CARD       24px  card-level KPI, prominent but subordinate to the hero
     SUMMARY_TOTAL  20px  operational aggregate or total — emphasis, not a heading

   SUMMARY_TOTAL shares 20px with SECTION_HEADING and stays a SEPARATE owner.
   A total is not a heading, however equal the two computed values are.

   A1 also gives the shared pageHeader() primary action the typography and
   height it never owned: it inherited the 16px document default and took a
   40px height from `py-2`, which is off the canonical control ladder.

   WHAT THIS SUITE DOES NOT DO. It does not re-derive the 80-finding pass-6
   classification, which is accepted. It owns the ten sites pass 6 routed to
   --rv-fs-metric, and the one shared action primitive.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DETECTOR_VERSION } from '../scripts/ui-conformance/rules.mjs';
import { readContract, readTokens } from '../scripts/ui-conformance/contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BASELINE = JSON.parse(read('tests/fixtures/ui-conformance-baseline.json'));
const rule = (id) => BASELINE.summary_by_rule[id] || { blocking: 0, debt: 0, coverage_gaps: 0, total: 0 };

/* ============================================================
   0 · the ratified numeric-emphasis ladder
   ============================================================ */

const KPI_HERO = ['--rv-fs-kpi-hero', '30px'];
const KPI_CARD = ['--rv-fs-kpi-card', '24px'];
const SUMMARY_TOTAL = ['--rv-fs-summary-total', '20px'];
const COMPACT_METRIC = ['--rv-fs-metric', '15px'];
const SECTION_HEADING = ['--rv-fs-section-heading', '20px'];
const ICON_GLYPH = ['--rv-icon-glyph-lg', '20px'];

/** Tokens that may never carry a heading, a label or body copy. */
const KPI_TOKENS = [KPI_HERO[0], KPI_CARD[0], SUMMARY_TOTAL[0]];

/* ============================================================
   1 · THE EXACT POPULATION

   Ten sites — not eight. Pass 6 routed eight DETECTOR-VISIBLE findings to
   --rv-fs-metric plus two sites in `painel.js` that live inside an injected
   CSS string and that no detector rule can see. Both counts are stated so the
   difference is a recorded fact rather than a silent correction.

   Frozen by semantic signature, never by line number.
   ============================================================ */

const METRIC_POPULATION = [
  {
    id: 'painel-admin-dashboard-hero-kpi',
    path: 'js/screens/painel.js',
    owner: '.rv-adm-kpi-value, inside .rv-adm-kpi cards in the .rv-adm-kpis strip',
    label: 'the five admin dashboard KPI numbers',
    originalValue: '30px',
    role: 'KPI_HERO',
    detectorVisible: false,
    route: '#/painel',
    signature: /\.rv-adm-kpi-value\{font-size:var\(--rv-fs-kpi-hero\);font-weight:800;[^}]*line-height:\.95;\}/,
  },
  {
    id: 'cliente-dashboard-card-kpi',
    path: 'js/screens/cliente-dashboard.js',
    owner: 'kpiCard(), the value between its 14px label and its 11px sub',
    label: 'client dashboard KPI cards',
    originalValue: '24px',
    role: 'KPI_CARD',
    detectorVisible: true,
    route: '#/cliente/dashboard',
    signature: /font-size:var\(--rv-fs-kpi-card\);font-weight:800;[^']*line-height:1;margin:1px 0;/,
  },
  {
    id: 'expedicao-resumo-liberado',
    path: 'js/screens/expedicao-admin.js',
    owner: 'buildResumo(), LIBERADO',
    label: 'LIBERADO',
    originalValue: '20px',
    role: 'SUMMARY_TOTAL',
    detectorVisible: true,
    route: '#/expedicao',
    signature: /font-size:var\(--rv-fs-summary-total\);font-weight:800;color:var\(--rv-text-primary\);' \}, fmtMetros\(totalLiberado\)\)/,
  },
  {
    id: 'expedicao-resumo-entregue',
    path: 'js/screens/expedicao-admin.js',
    owner: 'buildResumo(), ENTREGUE / COLETADO',
    label: 'ENTREGUE / COLETADO',
    originalValue: '20px',
    role: 'SUMMARY_TOTAL',
    detectorVisible: true,
    route: '#/expedicao',
    signature: /font-size:var\(--rv-fs-summary-total\);font-weight:800;color:var\(--rv-signal-positive\);' \}, fmtMetros\(totalEntregue\)\)/,
  },
  {
    id: 'expedicao-resumo-saldo',
    path: 'js/screens/expedicao-admin.js',
    owner: 'buildResumo(), SALDO',
    label: 'SALDO',
    originalValue: '20px',
    role: 'SUMMARY_TOTAL',
    detectorVisible: true,
    route: '#/expedicao',
    signature: /font-size:var\(--rv-fs-summary-total\);font-weight:800;color:' \+ \(saldo > 0/,
  },
  {
    id: 'manta-expedicao-saldo-totals',
    path: 'js/screens/manta-expedicao-ui.js',
    owner: 'metric(label, value, color) — PREVISTO, MEDIDO, LIBERADO, ENTREGUE, SALDO',
    label: 'Manta expedition *_total aggregates',
    originalValue: '18px',
    role: 'SUMMARY_TOTAL',
    detectorVisible: true,
    route: '#/manta (expedition surface)',
    signature: /font-size:var\(--rv-fs-summary-total\);font-weight:800;color:' \+ \(color \|\| 'var\(--rv-text-primary\)'\)/,
  },
  {
    id: 'pedido-detail-summary-totals',
    path: 'js/screens/pedido-detail-render.js',
    owner: 'buildSummaryMetric(title, value, color) — Total do pedido, Em tecelagem, …',
    label: 'pedido-level aggregates',
    originalValue: '19px',
    role: 'SUMMARY_TOTAL',
    detectorVisible: true,
    route: '#/pedidos/:id',
    signature: /font-size:var\(--rv-fs-summary-total\);font-weight:800;color:' \+ color/,
  },
  {
    id: 'pedido-movement-metric-card',
    path: 'js/screens/pedido-detail-events.js',
    owner: 'movementMetricCard(label, value, accent), inside the 520px movement modal',
    label: 'Planejado na OP / Ja movimentado / Restante na origem',
    originalValue: '16px',
    role: 'COMPACT_METRIC',
    detectorVisible: true,
    route: '#/pedidos/:id (movement modal)',
    signature: /font-size:var\(--rv-fs-metric\);font-weight:800;color:' \+ \(accent \|\| 'var\(--rv-text-primary\)'\)/,
  },
  {
    id: 'painel-stage-count',
    path: 'js/screens/painel.js',
    owner: '.rv-adm-stage-count, under an 11.5px uppercase stage title',
    label: 'per-stage counters in the admin dashboard stage strip',
    originalValue: '16px',
    role: 'COMPACT_METRIC',
    detectorVisible: false,
    route: '#/painel',
    signature: /\.rv-adm-stage-count\{font-size:var\(--rv-fs-metric\);font-weight:800;/,
  },
  {
    id: 'admin-usuarios-generated-password',
    path: 'js/screens/admin-usuarios-modal.js',
    owner: 'openSenhaGeradaModal(), the one-time monospace password box',
    label: 'the generated password, shown once',
    originalValue: '16px',
    role: 'COMPACT_METRIC',
    detectorVisible: true,
    route: '#/admin/usuarios (reset password modal)',
    signature: /font-family:ui-monospace[^']*font-size:var\(--rv-fs-metric\); font-weight:700;/,
  },
];

const TOKEN_FOR = {
  KPI_HERO: KPI_HERO[0],
  KPI_CARD: KPI_CARD[0],
  SUMMARY_TOTAL: SUMMARY_TOTAL[0],
  COMPACT_METRIC: COMPACT_METRIC[0],
};

const countOf = (role) => METRIC_POPULATION.filter((s) => s.role === role).length;

const KPI_HERO_SITE_COUNT = countOf('KPI_HERO');
const KPI_CARD_SITE_COUNT = countOf('KPI_CARD');
const SUMMARY_TOTAL_SITE_COUNT = countOf('SUMMARY_TOTAL');
const COMPACT_METRIC_SITE_COUNT = countOf('COMPACT_METRIC');

/* ============================================================
   2 · the correction did not disturb the detector
   ============================================================ */

test('1 · the detector was NOT changed by this correction', () => {
  assert.equal(DETECTOR_VERSION, '1.0.6');
  assert.equal(BASELINE.detector_version, '1.0.6');
});

test('2 · UIC-005 remains zero and no rule moved', () => {
  assert.equal(rule('UIC-005').total, 0);
  assert.equal(rule('UIC-005').blocking, 0);
  assert.equal(rule('UIC-005').coverage_gaps, 0);
  // A2 (PASS-6-RUNTIME-INVENTORY-FORWARD-CORRECTION-A2): current repository
  // state. Phase-5 pass 7 closed UIC-006 (15 -> 0) and incidentally removed
  // the six UIC-000 gaps that described style expressions ON the deleted
  // native selects (549 -> 543): 886 - 21 = 865. A1's own result, UIC-005 at
  // zero with the KPI hierarchy intact, is asserted above and unchanged.
  // Phase-5 pass 8 then added two UIC-000 gaps for the Cadastros »
  // Parâmetros derived width owner: 865 -> 867.
  assert.equal(BASELINE.findings.length, 867);
  assert.equal(rule('UIC-000').coverage_gaps, 545);
  assert.equal(rule('UIC-006').blocking, 0);
  assert.equal(rule('UIC-006').total, 0);
  assert.equal(rule('UIC-009').debt, 322);
  assert.equal(BASELINE.coverage_summary.FULL, 31);
  assert.equal(BASELINE.coverage_summary.PARTIAL, 36);
  assert.equal(BASELINE.coverage_summary.UNSUPPORTED, 0);
});

test('3 · passes 1 to 5 remain closed', () => {
  for (const id of ['UIC-001', 'UIC-002', 'UIC-003', 'UIC-004', 'UIC-008', 'UIC-010']) {
    assert.equal(rule(id).blocking, 0, `${id} reopened`);
    assert.equal(rule(id).coverage_gaps, 0, `${id} gained a coverage gap`);
  }
  for (const id of ['UIC-007', 'UIC-011']) assert.equal(rule(id).total, 0, `${id} reopened`);
});

/* ============================================================
   3 · the ratified ladder
   ============================================================ */

test('4 · the closed enum contains exactly the fifteen ratified values', () => {
  const contract = readContract(ROOT);
  assert.deepEqual(
    contract.enums.font_size,
    ['30px', '24px', '22px', '20px', '16px', '15px', '14px', '13.5px', '13px',
      '12.5px', '12px', '11.5px', '11px', '10.5px', '10px'],
  );
  assert.equal(contract.enums.font_size.length, 15);
  assert.equal(new Set(contract.enums.font_size).size, 15);
});

test('5 · KPI_HERO is 30px, KPI_CARD is 24px and SUMMARY_TOTAL is 20px', () => {
  const tokens = readTokens(ROOT);
  assert.equal(tokens.values.get(KPI_HERO[0]), '30px');
  assert.equal(tokens.values.get(KPI_CARD[0]), '24px');
  assert.equal(tokens.values.get(SUMMARY_TOTAL[0]), '20px');
  assert.equal(tokens.values.get(COMPACT_METRIC[0]), '15px');
});

test('6 · SECTION_HEADING also computes to 20px, through a DISTINCT token', () => {
  const tokens = readTokens(ROOT);
  assert.equal(tokens.values.get(SECTION_HEADING[0]), '20px');
  assert.equal(tokens.values.get(SUMMARY_TOTAL[0]), '20px');
  assert.notEqual(SECTION_HEADING[0], SUMMARY_TOTAL[0]);
  // Three owners at 20px, each with its own meaning.
  const at20 = [...tokens.values]
    .filter(([n]) => /^--rv-(fs|icon-glyph)-/.test(n))
    .filter(([, v]) => v === '20px').map(([n]) => n).sort();
  assert.deepEqual(at20, ['--rv-fs-section-heading', '--rv-fs-summary-total', '--rv-icon-glyph-lg']);
});

test('7 · 30px and 24px have exactly one typography owner each', () => {
  const tokens = readTokens(ROOT);
  const at = (v) => [...tokens.values]
    .filter(([n]) => /^--rv-(fs|icon-glyph)-/.test(n))
    .filter(([, val]) => val === v).map(([n]) => n);
  assert.deepEqual(at('30px'), [KPI_HERO[0]]);
  assert.deepEqual(at('24px'), [KPI_CARD[0]]);
});

/* ============================================================
   4 · KPI and heading tokens are not interchangeable

   The semantic guard, exercised on constructed input so the zero in section 5
   means something.
   ============================================================ */

/** @param {{token: string|null, kind: string}} site */
function kpiRoleViolations(site) {
  const out = [];
  const isKpi = KPI_TOKENS.includes(site.token);
  if (isKpi && (site.kind === 'heading' || site.kind === 'body' || site.kind === 'label')) {
    out.push('KPI_TOKEN_ON_NON_NUMERIC_ROLE');
  }
  if (site.token === SECTION_HEADING[0] && site.kind === 'total') out.push('HEADING_TOKEN_ON_TOTAL');
  if (site.token === COMPACT_METRIC[0] && (site.value === '24px' || site.value === '30px')) {
    out.push('COMPACT_METRIC_AT_KPI_SIZE');
  }
  if (site.kind === 'compact-metric' && isKpi) out.push('COMPACT_METRIC_USES_KPI_TOKEN');
  return out;
}

test('8 · no heading may use a KPI token', () => {
  for (const token of KPI_TOKENS) {
    assert.deepEqual(kpiRoleViolations({ token, kind: 'heading' }), ['KPI_TOKEN_ON_NON_NUMERIC_ROLE']);
  }
  assert.deepEqual(kpiRoleViolations({ token: SECTION_HEADING[0], kind: 'heading' }), []);
});

test('9 · no body copy or label may use a KPI token', () => {
  for (const token of KPI_TOKENS) {
    assert.deepEqual(kpiRoleViolations({ token, kind: 'body' }), ['KPI_TOKEN_ON_NON_NUMERIC_ROLE']);
    assert.deepEqual(kpiRoleViolations({ token, kind: 'label' }), ['KPI_TOKEN_ON_NON_NUMERIC_ROLE']);
  }
});

test('10 · a total may not take the heading token, and a heading may not take the total token', () => {
  assert.deepEqual(kpiRoleViolations({ token: SECTION_HEADING[0], kind: 'total' }),
    ['HEADING_TOKEN_ON_TOTAL']);
  assert.deepEqual(kpiRoleViolations({ token: SUMMARY_TOTAL[0], kind: 'total' }), []);
  assert.deepEqual(kpiRoleViolations({ token: SUMMARY_TOTAL[0], kind: 'heading' }),
    ['KPI_TOKEN_ON_NON_NUMERIC_ROLE']);
});

test('11 · no ordinary compact metric reaches 24px or 30px', () => {
  assert.deepEqual(kpiRoleViolations({ token: COMPACT_METRIC[0], value: '24px', kind: 'compact-metric' }),
    ['COMPACT_METRIC_AT_KPI_SIZE']);
  assert.deepEqual(kpiRoleViolations({ token: COMPACT_METRIC[0], value: '30px', kind: 'compact-metric' }),
    ['COMPACT_METRIC_AT_KPI_SIZE']);
  assert.deepEqual(kpiRoleViolations({ token: KPI_HERO[0], kind: 'compact-metric' }),
    ['COMPACT_METRIC_USES_KPI_TOKEN']);
  assert.deepEqual(kpiRoleViolations({ token: COMPACT_METRIC[0], value: '15px', kind: 'compact-metric' }), []);
});

/* ============================================================
   5 · the real population, reconciled
   ============================================================ */

test('12 · the exact former compact-metric population is reconciled by role', () => {
  assert.equal(METRIC_POPULATION.length, 10, 'the population changed size');
  assert.equal(KPI_HERO_SITE_COUNT, 1);
  assert.equal(KPI_CARD_SITE_COUNT, 1);
  assert.equal(SUMMARY_TOTAL_SITE_COUNT, 5);
  assert.equal(COMPACT_METRIC_SITE_COUNT, 3);
  assert.equal(
    KPI_HERO_SITE_COUNT + KPI_CARD_SITE_COUNT + SUMMARY_TOTAL_SITE_COUNT + COMPACT_METRIC_SITE_COUNT,
    METRIC_POPULATION.length,
  );
  // Eight were detector-visible; two live in an injected CSS string that no
  // rule can reach. Both facts are asserted, not rounded to one number.
  assert.equal(METRIC_POPULATION.filter((s) => s.detectorVisible).length, 8);
  assert.equal(METRIC_POPULATION.filter((s) => !s.detectorVisible).length, 2);
});

test('13 · every site in the population carries the token its role requires', () => {
  for (const site of METRIC_POPULATION) {
    const src = read(site.path);
    assert.match(src, site.signature, `${site.id} (${site.path}) lost its ratified signature`);
    const expected = TOKEN_FOR[site.role];
    assert.ok(site.signature.source.includes(expected.replace(/-/g, '\\-')) ||
      site.signature.source.includes(expected),
    `${site.id} signature does not pin ${expected}`);
  }
});

test('14 · KPI_ROLE_MISMATCH_COUNT is zero across the whole runtime', () => {
  // Every use of a KPI token anywhere in the loaded runtime must belong to a
  // site this suite has classified. A new one appearing is a hard failure, not
  // a silent pass.
  const mismatches = [];
  for (const rel of SCAN_SET) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const token of KPI_TOKENS) {
        if (!line.includes(`var(${token})`)) continue;
        const owned = METRIC_POPULATION.some((s) => s.path === rel && TOKEN_FOR[s.role] === token);
        if (!owned) mismatches.push(`${rel}:${i + 1} ${token}`);
      }
    });
  }
  assert.deepEqual(mismatches, []);
});

test('15 · the compact metric token survives only on the three compact sites', () => {
  const holders = [];
  for (const rel of SCAN_SET) {
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/font-size\s*:\s*var\(\s*--rv-fs-metric\s*\)/.test(line)) holders.push(rel);
    });
  }
  const expected = METRIC_POPULATION.filter((s) => s.role === 'COMPACT_METRIC').map((s) => s.path);
  assert.deepEqual(holders.sort(), expected.sort());
});

/* ============================================================
   6 · the shared page-header primary action
   ============================================================ */

const UI_JS = read('js/ui.js');
const PAGE_HEADER = /function pageHeader\([\s\S]*?\n}/.exec(UI_JS)[0];

test('16 · the pageHeader action owns --rv-fs-body and --rv-h-primary', () => {
  assert.match(PAGE_HEADER, /font-size:var\(--rv-fs-body\)/,
    'the primary page action does not own its font size');
  assert.match(PAGE_HEADER, /height:var\(--rv-h-primary\)/,
    'the primary page action does not own its height');
  const tokens = readTokens(ROOT);
  assert.equal(tokens.values.get('--rv-fs-body'), '13px');
  assert.equal(tokens.values.get('--rv-h-primary'), '38px');
});

test('17 · the pageHeader action carries NO vertical padding utility', () => {
  const cls = /class: '([^']*)'/.exec(PAGE_HEADER.slice(PAGE_HEADER.indexOf('actWrap.appendChild')));
  assert.ok(cls, 'the action button lost its class attribute');
  assert.ok(!/\bpy-\d/.test(cls[1]), `vertical padding utility survived: ${cls[1]}`);
  assert.ok(!/\bp-\d/.test(cls[1]), `shorthand padding utility survived: ${cls[1]}`);
  assert.match(PAGE_HEADER, /padding-top:0; padding-bottom:0;/,
    'vertical padding is not explicitly zeroed');
  // The horizontal 16px equivalent is preserved exactly.
  assert.match(cls[1], /\bpx-4\b/, 'the horizontal 16px padding was not preserved');
});

test('18 · the pageHeader action preserves colour, weight, radius and behaviour', () => {
  assert.match(PAGE_HEADER, /bg-blue-700 hover:bg-blue-800 text-white font-semibold/);
  assert.match(PAGE_HEADER, /border-radius:var\(--rv-radius\)/);
  assert.match(PAGE_HEADER, /onclick: a\.onclick/);
  assert.match(PAGE_HEADER, /\}, a\.label\)\)/);
  // The title is untouched by A1.
  assert.match(PAGE_HEADER, /el\('h1', \{ style: 'font-size:var\(--rv-fs-title\);'/);
});

test('19 · no OTHER control height moved in this correction', () => {
  // A1 authorizes exactly ONE control-height correction: the page-header action
  // gains var(--rv-h-primary). Every literal height js/ui.js already carried is
  // frozen here by value, so a second, unauthorized height change fails.
  //
  //   1px  — the divider rule
  //   30px — the role-specific table-row action square that phase-5 pass 3
  //          ruled OUT of the generic 32/34/38 ladder. It is NOT a rung and it
  //          is not reopened here.
  const literals = [...UI_JS.matchAll(/height\s*:\s*(\d[\d.]*px)/g)].map((m) => m[1]).sort();
  assert.deepEqual(literals, ['1px', '30px'],
    'js/ui.js gained or lost a literal height; only the page-header action was authorized');
  assert.equal((UI_JS.match(/height:var\(--rv-h-primary\)/g) || []).length, 1,
    'exactly one canonical control height was introduced');
});

/* ============================================================
   7 · runtime ownership counters
   ============================================================ */

const INDEX = read('index.html');
const LOADED_ASSETS = [...new Set(
  [...INDEX.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1]).filter((u) => !/^https?:|^\/\//.test(u)).map((u) => u.split('?')[0]),
)];
const SCAN_SET = [...new Set([
  ...LOADED_ASSETS,
  ...fs.readdirSync(path.join(ROOT, 'js/screens')).filter((f) => /\.m?js$/.test(f)).map((f) => `js/screens/${f}`),
  'css/tokens.css', 'css/responsive.css', 'index.html',
])].sort();

const ENUM = new Set(['30px', '24px', '22px', '20px', '16px', '15px', '14px', '13.5px',
  '13px', '12.5px', '12px', '11.5px', '11px', '10.5px', '10px']);
const TAILWIND_PX = {
  'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px',
  'text-xl': '20px', 'text-2xl': '24px', 'text-3xl': '30px', 'text-4xl': '36px',
  'text-5xl': '48px', 'text-6xl': '60px', 'text-7xl': '72px', 'text-8xl': '96px',
  'text-9xl': '128px',
};

test('20 · every required A1 runtime counter is zero', () => {
  const tokens = readTokens(ROOT);
  const WEIGHTS = new Set(['400', '500', '600', '700', '800', 'normal', 'bold', 'inherit']);
  const outSize = []; const outWeight = []; const outTw = [];
  const below = []; const unresolved = []; const unknown = [];
  let inEnumLiteral = 0;

  for (const rel of SCAN_SET) {
    read(rel).split(/\r?\n/).forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      for (const m of line.matchAll(/font-size\s*:\s*([^;'"`)}]+)/g)) {
        const v = m[1].trim();
        if (/^var\(/.test(v)) continue;
        if (ENUM.has(v)) inEnumLiteral += 1; else outSize.push(`${at} = ${v}`);
        if (/px$/.test(v) && parseFloat(v) < 10) below.push(`${at} = ${v}`);
      }
      for (const m of line.matchAll(/\bfont-weight\s*:\s*([^;'"`)}]+)/g)) {
        const v = m[1].trim();
        if (!/^var\(/.test(v) && !WEIGHTS.has(v)) outWeight.push(`${at} = ${v}`);
      }
      for (const m of line.matchAll(/\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/g)) {
        const c = `text-${m[1]}`;
        if (!ENUM.has(TAILWIND_PX[c])) outTw.push(`${at} ${c}`);
      }
      for (const m of line.matchAll(/var\(\s*(--rv-(?:fs|font-size|icon-glyph)-[a-z0-9-]+)/g)) {
        const name = m[1];
        if (!tokens.values.has(name)) { unknown.push(`${at} ${name}`); continue; }
        const resolved = tokens.values.get(name);
        if (!/var\(/.test(resolved) && !ENUM.has(resolved)) unresolved.push(`${at} ${name} -> ${resolved}`);
      }
    });
  }

  assert.deepEqual(outSize, [], 'OUT_OF_ENUM_RUNTIME_FONT_SIZE_COUNT');
  assert.deepEqual(outWeight, [], 'OUT_OF_ENUM_RUNTIME_FONT_WEIGHT_COUNT');
  assert.deepEqual(outTw, [], 'TAILWIND_OUT_OF_ENUM_FONT_SIZE_UTILITY_COUNT');
  assert.deepEqual(unresolved, [], 'UNRESOLVED_RUNTIME_TYPOGRAPHY_COUNT');
  assert.deepEqual(below, [], 'FONT_SIZE_LITERAL_BELOW_10PX_COUNT');
  assert.deepEqual(unknown, [], 'UNKNOWN_TYPOGRAPHY_TOKEN_COUNT');
  assert.ok(Number.isInteger(inEnumLiteral), 'IN_ENUM_RUNTIME_TYPOGRAPHY_LITERAL_COUNT is informational');
});

test('21 · UNOWNED_PAGE_HEADER_ACTION_TYPOGRAPHY_COUNT is zero', () => {
  const body = PAGE_HEADER.slice(PAGE_HEADER.indexOf('for (const a of actions)'));
  assert.match(body, /font-size:var\(--rv-fs-body\)/);
  // No competing size utility may sit on the same element.
  const cls = /class: '([^']*)'/.exec(body)[1];
  assert.ok(!/\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/.test(cls),
    `a Tailwind size utility competes with the token: ${cls}`);
});

test('22 · NONCANONICAL_PAGE_HEADER_ACTION_HEIGHT_COUNT is zero', () => {
  const body = PAGE_HEADER.slice(PAGE_HEADER.indexOf('for (const a of actions)'));
  assert.match(body, /height:var\(--rv-h-primary\)/);
  const tokens = readTokens(ROOT);
  // 38px is a real rung on the ratified 32/34/38 ladder, not a new value.
  assert.equal(tokens.values.get('--rv-h-primary'), '38px');
  for (const rung of ['--rv-h-compact', '--rv-h-default', '--rv-h-primary']) {
    assert.ok(tokens.values.has(rung), `${rung} disappeared from the ladder`);
  }
});

/* ============================================================
   8 · the accepted pass-6 classifications are stable
   ============================================================ */

test('23 · the four accepted 14.5px heading classifications are unchanged', () => {
  const render = read('js/screens/pedido-detail-render.js');
  // Exactly the count published at e771baf. A1 moved buildSummaryMetric() from
  // the metric token to the total token and touched no heading in this file.
  const componentHeadings = (render.match(/font-size:var\(--rv-fs-component-heading\)/g) || []).length;
  assert.equal(componentHeadings, 12,
    `pedido-detail-render component headings moved: ${componentHeadings}`);
  // The two nested-card titles and the two empty-state headings specifically.
  assert.match(render, /font-size:var\(--rv-fs-component-heading\);font-weight:700;color:var\(--rv-accent-blue\);/);
  assert.match(render, /font-size:var\(--rv-fs-component-heading\);font-weight:700;color:var\(--rv-text-primary\);margin-bottom:6px;' \}, 'Nenhuma expedicao liberada'/);
});

test('24 · the topbar section label remains BODY_CONTROL_CELL', () => {
  const common = read('js/screens/common.js');
  assert.match(common, /font-size:var\(--rv-fs-body\);color:var\(--rv-text-tertiary\);font-weight:500;/);
  assert.match(common, /font-weight:800;font-size:var\(--rv-fs-section-heading\);/);
});

test('25 · the modal close glyph remains the icon-glyph owner', () => {
  assert.match(UI_JS, /style: 'font-size:var\(--rv-icon-glyph-lg\);'[\s\S]{0,140}'×'/);
  for (const rel of ['js/screens/admin-usuarios-modal.js', 'js/screens/cadastros.js']) {
    assert.match(read(rel), /font-size:var\(--rv-icon-glyph-lg\)/, `${rel} lost its close glyph token`);
  }
});

test('26 · no path, line or value suppression exists in this guard', () => {
  const self = read('tests/ui-conformance-phase5-pass6-typography-a1-kpi.test.mjs');
  const code = self.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const FORBIDDEN = [['eslint', '-disable'], ['t', '.skip'], ['IGNORE', '_PATHS'],
    ['ALLOW', 'LIST'], ['WAI', 'VER'], ['todo', ': true']];
  for (const [a, b] of FORBIDDEN) assert.ok(!code.includes(a + b), `${a}${b} appears in the guard`);
  const rules = read('scripts/ui-conformance/rules.mjs').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const w of ['waiver', 'ignoreList', 'suppress', 'allowlist']) {
    assert.ok(!new RegExp(w, 'i').test(rules), `the detector gained a ${w} mechanism`);
  }
});

test('27 · every changed runtime asset carries the A1 cache token', () => {
  const TOKEN = '20260726-ui-p5-pass6-typography-a1-kpi';
  const PASS7_TOKEN = '20260727-ui-p5-pass7-native-select-a1';
  // A2: A1 changed seven assets. Phase-5 pass 7 later changed two of them
  // again — css/tokens.css gained the popover layer/height tokens and js/ui.js
  // became the select adapter — so those two now carry the LATER pass-7 token.
  // The invariant this test owns is intact: every asset A1 changed is still
  // invalidated, and no asset A1 left alone was retokenised by A1.
  const CHANGED_BY_A1_THEN_PASS7 = ['css/tokens.css'];
  // Pass-7 correction A4 bound expedicao-admin's visible label to its combobox,
  // so that asset moved on again — to the A4 token.
  const PASS7_A4 = '20260727-ui-p5-pass7-native-select-a4-a11y-geometry';
  const CHANGED_BY_A1_THEN_PASS7_A4 = [];
  /*
   * PASS-8-TABLE-CONTRACT-FORWARD-CORRECTION
   *
   * Phase-5 pass 8 changed four of A1's seven assets again — js/ui.js for the
   * dataTable() contract, and the three screens whose tables gained a numeral,
   * alignment or scroll owner. A pass-8 token is strictly LATER than an A1 or
   * pass-7 one, so A1's invariant is intact: every asset A1 changed is still
   * invalidated, and no asset A1 left alone was retokenised BY A1.
   */
  const PASS8 = '20260727-ui-p5-pass8-table-r1';
  const CHANGED_BY_A1_THEN_PASS8 = [
    'js/screens/cliente-dashboard.js',
    'js/screens/expedicao-admin.js', 'js/screens/manta-expedicao-ui.js',
    'js/screens/pedido-detail-render.js',
  ];
  /*
   * ACTION-CONTAINMENT-A1 FORWARD CORRECTION
   *
   * That order made js/ui.js the owner of the modal action bar, the
   * page-header action group and the table-row action column, so it changed
   * again and moved to a strictly later token. A1's invariant is unchanged:
   * every asset A1 changed is still invalidated, and no asset A1 left alone
   * was retokenised BY A1. Only which later token invalidates js/ui.js moved.
   */
  const CONTAINMENT_A1 = '20260727-ui-action-containment-a1';
  const CHANGED_BY_A1_THEN_CONTAINMENT_A1 = ['js/ui.js'];
  const CHANGED = ['js/screens/painel.js'];
  assert.equal(CHANGED.length + CHANGED_BY_A1_THEN_PASS7.length
    + CHANGED_BY_A1_THEN_PASS7_A4.length + CHANGED_BY_A1_THEN_PASS8.length
    + CHANGED_BY_A1_THEN_CONTAINMENT_A1.length, 7,
    'the A1 changed-asset population must stay seven');
  for (const rel of CHANGED) {
    assert.ok(INDEX.includes(`"${rel}?v=${TOKEN}"`), `${rel} was not retokenised`);
  }
  for (const rel of CHANGED_BY_A1_THEN_PASS7) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS7_TOKEN}"`),
      `${rel} must carry the later pass-7 token`);
  }
  for (const rel of CHANGED_BY_A1_THEN_PASS7_A4) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS7_A4}"`),
      `${rel} must carry the later pass-7 A4 token`);
  }
  for (const rel of CHANGED_BY_A1_THEN_PASS8) {
    assert.ok(INDEX.includes(`"${rel}?v=${PASS8}"`), `${rel} must carry the later pass-8 token`);
  }
  for (const rel of CHANGED_BY_A1_THEN_CONTAINMENT_A1) {
    assert.ok(INDEX.includes(`"${rel}?v=${CONTAINMENT_A1}"`),
      `${rel} must carry the later action-containment A1 token`);
  }
  assert.equal((INDEX.match(new RegExp(TOKEN, 'g')) || []).length, CHANGED.length,
    'an asset that did not change was retokenised');
});
