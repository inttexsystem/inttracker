/* ============================================================
   UI CONSOLIDATION — PHASE 5, PASS 8 (TABLE CONTRACT)

   Proves the §2.5 GOLDEN RULE closed over the architect-accepted 41-surface
   runtime table population:

     ·  5 direct semantic  <table>  constructions          (S01–S05)
     ·  5 shared dataTable() instances                     (H01–H05)
     · 31 simulated CSS-Grid tables                        (G01–G31)

   Pass 8 creates NO new `UIC-*` rule: the detector's js-screen front-end
   hardcodes `MANUAL_REVIEW_REQUIRED` for every imperatively built table and
   never reads a <colgroup>, so no rule engine can observe this property. The
   contract is therefore pinned HERE, against the real runtime source, and the
   population is frozen so a future pass cannot silently shrink it.

   Three defect populations were corrected, one per §2.5 clause:

     PROVEN_STRUCTURE_GAP          10  no width owner at all
     PROVEN_NUMERIC_ALIGNMENT_GAP  16  header/value alignment or numerals
     PROVEN_OVERFLOW_GAP            8  fixed-px columns with no scroll owner

   plus G05, whose transposed template was corrected after rendered evidence
   proved it wrapped onto an implicit second grid row past two larguras.

   ARCHITECT RULINGS ENCODED HERE (order §6). Identifiers, dates, editable
   numeric inputs, composite progress cells and catalog widths are NOT numeric
   columns. Six surfaces were already conforming and are pinned as
   NOT-a-product-edit-target so a later pass cannot "tidy" them.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const UI = read('js/ui.js');
const INDEX = read('index.html');

/* ============================================================
   1 · THE FROZEN INVENTORY
   ============================================================ */

/** Direct semantic tables: file → number of `el('table'` constructions. */
const DIRECT_SEMANTIC = {
  'js/screens/ordem-compra-render.js': 2,          // S01 list, S02 detail items
  'js/screens/ordem-compra-receipt-render.js': 3,  // S03 saldos, S04 alocações, S05 histórico
};

/** Shared-helper instances: file → number of dataTable() CALL sites. */
const SHARED_HELPER = {
  'js/screens/fornecedor.js': 3,             // H01 entregas, H02 latex, H03 ordens
  'js/screens/op-latex-admin.js': 1,         // H04 concluída/finalizada
  'js/screens/pedido-parciais-admin.js': 1,  // H05 parciais
};

const DIRECT_SEMANTIC_TOTAL = 5;
const SHARED_HELPER_TOTAL = 5;
const SIMULATED_GRID_TOTAL = 31;
const TOTAL_RUNTIME_SURFACES = 41;

test('1.1 the accepted category arithmetic is exactly 5 + 5 + 31 = 41', () => {
  assert.equal(DIRECT_SEMANTIC_TOTAL + SHARED_HELPER_TOTAL + SIMULATED_GRID_TOTAL, TOTAL_RUNTIME_SURFACES);
  assert.equal(
    Object.values(DIRECT_SEMANTIC).reduce((a, b) => a + b, 0),
    DIRECT_SEMANTIC_TOTAL,
    'the direct-semantic row list disagrees with its declared total',
  );
  assert.equal(
    Object.values(SHARED_HELPER).reduce((a, b) => a + b, 0),
    SHARED_HELPER_TOTAL,
    'the shared-helper row list disagrees with its declared total',
  );
});

test('1.2 no NEW semantic table appears outside the two accepted owners', () => {
  // js/ui.js owns dataTable()'s single `el('table'`; every other construction
  // must live in one of the two accepted purchase-order render modules.
  const LOCAL = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((src) => !/^https?:|^\/\//.test(src))
    .map((src) => src.split('?')[0]);

  for (const rel of LOCAL) {
    const hits = (read(rel).match(/\bel\(\s*['"`]table['"`]/g) || []).length;
    if (rel === 'js/ui.js') {
      assert.equal(hits, 1, 'js/ui.js must build exactly one table — dataTable()');
      continue;
    }
    const expected = DIRECT_SEMANTIC[rel] || 0;
    assert.equal(hits, expected, `${rel} builds ${hits} semantic tables, the frozen inventory says ${expected}`);
  }
});

test('1.3 the dataTable() call-site population is exactly the five accepted instances', () => {
  const LOCAL = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((src) => !/^https?:|^\/\//.test(src))
    .map((src) => src.split('?')[0]);

  let reachable = 0;
  for (const rel of LOCAL) {
    if (rel === 'js/ui.js') continue;
    const text = read(rel);
    // Only real invocations, never the prose in a comment.
    const hits = text
      .split(/\r?\n/)
      .filter((line) => !/^\s*(\/\/|\*)/.test(line))
      .reduce((n, line) => n + (line.match(/\bdataTable\(\{/g) || []).length, 0);
    const expected = SHARED_HELPER[rel] || 0;
    if (rel === 'js/screens/cadastros.js') {
      // cadastros.js carries ONE extra dataTable() call inside the unreachable
      // screenCadastrosPrecos::render(), proven dead in the A2 inventory (zero
      // call sites; renderStandalone is the only invoked renderer). It is NOT
      // counted and, per the order's prohibitions, NOT removed.
      assert.equal(hits, 1, 'cadastros.js should still carry exactly the one dead render() call site');
      continue;
    }
    assert.equal(hits, expected, `${rel} has ${hits} dataTable() call sites, the frozen inventory says ${expected}`);
    reachable += hits;
  }
  assert.equal(reachable, SHARED_HELPER_TOTAL);
});

/* ============================================================
   2 · S01–S05 — table-layout:fixed + a MATCHING <colgroup>
   ============================================================ */

/** One row per accepted semantic table: its <colgroup> widths, in order. */
const SEMANTIC_GEOMETRY = [
  { id: 'S01', file: 'js/screens/ordem-compra-render.js', columns: 5, widths: ['26%', '30%', '20%', '12%', '12%'] },
  { id: 'S02', file: 'js/screens/ordem-compra-render.js', columns: 4, widths: ['40%', '22%', '22%', '16%'] },
  { id: 'S03', file: 'js/screens/ordem-compra-receipt-render.js', columns: 5, widths: ['36%', '16%', '16%', '16%', '16%'] },
  { id: 'S04', file: 'js/screens/ordem-compra-receipt-render.js', columns: 5, widths: ['28%', '24%', '16%', '16%', '16%'] },
  { id: 'S05', file: 'js/screens/ordem-compra-receipt-render.js', columns: 6, widths: ['24%', '20%', '14%', '14%', '14%', '14%'] },
];

test('2.1 every accepted semantic table declares table-layout:fixed', () => {
  for (const file of Object.keys(DIRECT_SEMANTIC)) {
    const text = read(file);
    const constructions = text.match(/\bel\(\s*['"`]table['"`][^)]*\)/g) || [];
    assert.equal(constructions.length, DIRECT_SEMANTIC[file]);
    for (const c of constructions) {
      assert.match(c, /table-layout:\s*fixed/, `a table in ${file} still has no fixed layout: ${c}`);
    }
  }
});

test('2.2 each semantic table has ONE <colgroup> whose column count matches its contract', () => {
  // Every <col> width is a LITERAL style in both modules. A computed
  // `'width:' + w` would read identically to a human but is undecodable for the
  // conformance detector, and would open a UIC-000 coverage gap over a value
  // that never varies — so the widths are spelled out per column.
  const perFile = {
    'js/screens/ordem-compra-render.js': [SEMANTIC_GEOMETRY[0], SEMANTIC_GEOMETRY[1]],
    'js/screens/ordem-compra-receipt-render.js': [SEMANTIC_GEOMETRY[2], SEMANTIC_GEOMETRY[3], SEMANTIC_GEOMETRY[4]],
  };
  for (const [file, expectedTables] of Object.entries(perFile)) {
    const text = read(file);
    const colgroups = [...text.matchAll(/el\('colgroup', \{\}[\s\S]*?\)\)\);/g)].map((m) => m[0]);
    assert.equal(colgroups.length, expectedTables.length,
      `${file} declares ${colgroups.length} colgroups, expected ${expectedTables.length}`);
    for (const [i, expected] of expectedTables.entries()) {
      const widths = [...colgroups[i].matchAll(/el\('col', \{ style: 'width:([^;]+);' \}\)/g)].map((m) => m[1]);
      assert.equal(widths.length, expected.columns,
        `${expected.id} declares ${widths.length} <col>s, expected ${expected.columns}`);
      assert.deepEqual(widths, expected.widths, `${expected.id} width owner drifted`);
      assert.equal(Math.round(widths.reduce((a, w) => a + parseFloat(w), 0)), 100,
        `${expected.id} widths do not sum to 100%`);
    }
  }
  // No computed width may creep back into either module.
  for (const file of Object.keys(perFile)) {
    assert.doesNotMatch(read(file), /el\('col',\s*\{\s*style:\s*'width:'\s*\+/,
      `${file} builds a <col> width by concatenation`);
  }
});

test('2.3 S05 carries the SIX-column history contract, Ações included', () => {
  const receipt = read('js/screens/ordem-compra-receipt-render.js');
  const block = receipt.slice(receipt.indexOf('function historico('));
  const head = block.match(/theadRow\(\[([\s\S]*?)\]\)\);/);
  assert.ok(head, 'the histórico header row could not be located');
  const labels = ['Fio', 'Origem', 'Kg', 'Kg excesso', 'Reversível'];
  for (const l of labels) assert.ok(head[1].includes(`th('${l}'`), `histórico lost the ${l} column`);
  assert.match(head[1], /showActions \? 'Ações' : ''/, 'the sixth (Ações) header cell is gone');
  assert.equal(SEMANTIC_GEOMETRY[4].columns, 6);
});

test('2.4 the semantic tables keep their pre-existing right-aligned tabular numerals', () => {
  // Pass 8 added the width owner; it must not have cost the numeric contract
  // those two modules already satisfied.
  const render = read('js/screens/ordem-compra-render.js');
  assert.equal((render.match(/text-right[^']*',\s*style:\s*'font-variant-numeric:tabular-nums;'/g) || []).length, 3);
  const receipt = read('js/screens/ordem-compra-receipt-render.js');
  assert.match(receipt, /function tdNum\(value\)[\s\S]*?text-right[\s\S]*?tabular-nums/);
  assert.match(receipt, /function th\(label, right\)[\s\S]*?right \? 'text-right' : 'text-left'/);
});

/* ============================================================
   3 · THE SHARED dataTable() CONTRACT
   ============================================================ */

test('3.1 dataTable() builds a colgroup from ONE resolved layout list, actions included', () => {
  assert.match(UI, /const layout = columns\.map\(\(col\) => \(\{/, 'the single resolved layout list is gone');
  assert.match(UI, /if \(hasActions\) layout\.push\(\{ width: actionsWidth \|\| null, align: 'right', numeric: false \}\);/,
    'the actions column no longer enters the width owner');
  assert.match(UI, /const colgroup = el\('colgroup', \{\}\);/);
  assert.match(UI, /for \(const spec of layout\) \{[\s\S]*?el\('col', \{ style: 'width:' \+ spec\.width/,
    'colgroup no longer walks the resolved layout');
  assert.match(UI, /el\('table', \{ class: 'w-full', style: 'table-layout:fixed;' \}\)/,
    'dataTable() lost table-layout:fixed');
});

test('3.2 dataTable() accepts declarative width / align / numeric metadata', () => {
  assert.match(UI, /function dataTable\(\{ columns, rows, actions = \[\], actionsWidth, minWidth \}\)/);
  assert.match(UI, /align: col\.align \|\| \(col\.numeric \? 'right' : 'left'\)/,
    'alignment is no longer declared per column with a numeric-aware default');
  assert.match(UI, /numeric: col\.numeric === true/, 'numeric must be an explicit boolean, never inferred');
  // The contract is declarative: nothing may sniff the label or the values.
  const body = UI.slice(UI.indexOf('function dataTable('), UI.indexOf('// --- Row-level compact icon button'));
  assert.doesNotMatch(body, /col\.label\s*\.\s*(match|includes|test|toLowerCase)/,
    'dataTable() must not guess numeric-ness from label text');
  assert.doesNotMatch(body, /offsetWidth|getBoundingClientRect|scrollWidth/,
    'dataTable() must not measure runtime content to choose a width');
});

test('3.3 dataTable() repeats each column alignment on BOTH th and td', () => {
  assert.match(UI, /el\('th', \{\s*class: 'px-4 py-3 text-' \+ layout\[i\]\.align/,
    'the header no longer takes its alignment from the resolved layout');
  assert.match(UI, /class: 'px-4 py-3 text-sm text-gray-800 text-' \+ layout\[i\]\.align/,
    'the value cell no longer takes its alignment from the resolved layout');
});

test('3.4 numeric:true puts the canonical numeral owner on the VALUE cell only', () => {
  assert.match(UI, /if \(layout\[i\]\.numeric\) attrs\['data-num'\] = '1';/);
  // `[data-num]` is the tabular-numeral owner declared in css/tokens.css.
  assert.match(read('css/tokens.css'), /\.tnum,\s*\[data-num\]\s*\{\s*font-variant-numeric:\s*tabular-nums;/);
  const body = UI.slice(UI.indexOf('function dataTable('), UI.indexOf('// --- Row-level compact icon button'));
  const actionsCell = body.slice(body.indexOf('if (hasActions) {', body.indexOf('const tbody')));
  assert.doesNotMatch(actionsCell.slice(0, 400), /data-num/,
    'the actions cell must never carry the numeral owner');
});

test('3.5 dataTable() preserves its empty state, its actions and Node-returning renderers', () => {
  assert.match(UI, /if \(rows\.length === 0\) \{[\s\S]*?'Nenhum registro ainda\.'/, 'the empty state changed');
  assert.match(UI, /const lbl = typeof a\.label === 'function' \? a\.label\(row\) : a\.label;/);
  assert.match(UI, /onclick: \(\) => a\.onclick\(row\)/);
  assert.match(UI, /if \(cellValue instanceof Node\) td\.appendChild\(cellValue\); else td\.textContent = String\(cellValue\);/,
    'Node-returning renderers are no longer supported');
  // ACTION-CONTAINMENT-A1 added the `data-rv-table-actions` role to the action
  // column. The alignment, the classes and the label are asserted exactly as
  // before — only the declared role is new, and it is asserted too rather than
  // relaxing the match.
  assert.match(UI, /el\('th', \{ 'data-rv-table-actions': '', class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' \}, 'Ações'\)/,
    'the actions header lost its right alignment or its declared role');
});

test('3.6 a fixed-pixel contract gains the CANONICAL scroll owner, not a second system', () => {
  assert.match(UI, /const hasFixedPx = layout\.some\(\(spec\) => spec\.width && \/px\\s\*\$\/\.test\(spec\.width\)\);/);
  assert.match(UI, /'data-rv-table-scroll': '', style: 'overflow-x:auto;'/,
    'dataTable() does not reuse the canonical data-rv-table-scroll owner');
  assert.match(UI, /if \(minWidth\) table\.style\.minWidth = minWidth;/);
  // The owner itself still lives in css/responsive.css and was not duplicated.
  assert.match(read('css/responsive.css'), /\[data-rv-table-scroll\]\s*\{[\s\S]*?overflow-x:\s*auto;/);
});

test('3.7 dataTable() is still a semantic table — not a CSS Grid', () => {
  const body = UI.slice(UI.indexOf('function dataTable('), UI.indexOf('// --- Row-level compact icon button'));
  assert.doesNotMatch(body, /grid-template-columns/, 'dataTable() must not be converted to a grid');
  for (const tag of ['table', 'colgroup', 'col', 'thead', 'tr', 'th', 'tbody', 'td']) {
    assert.ok(body.includes(`el('${tag}'`), `dataTable() no longer emits <${tag}>`);
  }
});

/* ============================================================
   4 · H01–H05 DECLARE THEIR OWN METADATA
   ============================================================ */

/**
 * Per accepted instance: the declared widths in order, and the labels whose
 * column is declared `numeric: true`. Widths sum to 100% — a percentage
 * contract needs no scroll owner, which is why none of the five triggers one.
 */
const HELPER_CONTRACTS = [
  { id: 'H01', file: 'js/screens/fornecedor.js', anchor: "label: 'Modelo', width: '40%'",
    widths: ['40%', '15%', '15%', '15%', '15%'], numeric: ['Pedido', 'Ajustado', 'Entregue', 'Falta'] },
  { id: 'H02', file: 'js/screens/fornecedor.js', anchor: "label: 'Modelo', width: '46%'",
    widths: ['46%', '18%', '18%', '18%'], numeric: ['Enviado', 'Recebido', 'Falta'] },
  { id: 'H03', file: 'js/screens/fornecedor.js', anchor: "label: 'Lote', width: '16%'",
    widths: ['16%', '26%', '13%', '13%', '16%', '16%'], numeric: ['Pedido', 'Recebido'] },
  { id: 'H04', file: 'js/screens/op-latex-admin.js', anchor: "label: 'Modelo', width: '46%'",
    widths: ['46%', '18%', '18%', '18%'], numeric: ['Enviado', 'Recebido', 'Falta'] },
  { id: 'H05', file: 'js/screens/pedido-parciais-admin.js', anchor: "label: 'Seq.'",
    widths: ['6%', '12%', '9%', '10%', '14%', '19%', '9%', '10.5%', '10.5%'], numeric: ['Metros'] },
];

test('4.1 every accepted dataTable() instance declares a width for EVERY column', () => {
  for (const c of HELPER_CONTRACTS) {
    const text = read(c.file);
    const at = text.indexOf(c.anchor);
    assert.ok(at > 0, `${c.id}: anchor not found in ${c.file}`);
    const block = text.slice(at, text.indexOf('rows:', at));
    const widths = [...block.matchAll(/width: '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(widths, c.widths, `${c.id} width contract drifted`);
    const sum = widths.reduce((a, w) => a + parseFloat(w), 0);
    assert.equal(Math.round(sum), 100, `${c.id} widths sum to ${sum}%, not 100%`);
  }
});

/**
 * Split a `columns: [...]` block into one text chunk per column descriptor, so
 * a label and its `numeric:` flag are read together whether the call site
 * writes them on one line or across several.
 */
function columnChunks(block) {
  return block
    .split(/label:/)
    .slice(1)
    .map((chunk) => {
      const label = /^\s*'([^']+)'/.exec(chunk);
      return { label: label ? label[1] : null, text: chunk.split(/\n\s*\{/)[0] };
    })
    .filter((c) => c.label);
}

test('4.2 exactly the accepted quantity columns are declared numeric', () => {
  for (const c of HELPER_CONTRACTS) {
    const text = read(c.file);
    const at = text.indexOf(c.anchor);
    const block = text.slice(at, text.indexOf('rows:', at));
    const numericLabels = columnChunks('label:' + block.slice(block.indexOf("'")))
      .filter((col) => /numeric: true/.test(col.text))
      .map((col) => col.label);
    assert.deepEqual(numericLabels.sort(), [...c.numeric].sort(), `${c.id} numeric column set drifted`);
  }
});

test('4.3 identifiers and dates are NOT declared numeric (architect rulings 6.1 / 6.2)', () => {
  const forn = read('js/screens/fornecedor.js');
  const at = forn.indexOf("label: 'Lote', width: '16%'");
  const h3 = columnChunks(forn.slice(at - 'label: '.length, forn.indexOf('rows: recebidas', at)));
  for (const l of ['Lote', 'Fio', 'Data', 'Status']) {
    const col = h3.find((c) => c.label === l);
    assert.ok(col, `H03 lost the ${l} column`);
    assert.ok(!/numeric: true/.test(col.text), `${l} is an identifier or a date and must not be numeric`);
  }

  const parciais = read('js/screens/pedido-parciais-admin.js');
  for (const key of ['sequencia', 'data_referencia', 'criado_em', 'atualizado_em']) {
    const keyAt = parciais.indexOf(`key: '${key}'`);
    assert.ok(keyAt > 0, `H05 lost the ${key} column`);
    // Read up to the next descriptor, so the flag of a LATER column cannot leak in.
    const block = parciais.slice(keyAt, parciais.indexOf('render:', keyAt));
    assert.ok(!block.includes('numeric: true'), `${key} is an identifier or a date and must not be numeric`);
  }
});

test('4.4 screenFornecedorHome is still not a table consumer', () => {
  const forn = read('js/screens/fornecedor.js');
  const home = forn.slice(forn.indexOf('function screenFornecedorHome('), forn.indexOf('async function screenFornecedorEntregas('));
  assert.doesNotMatch(home, /dataTable|el\('table'|grid-template-columns/,
    'a table was attached to screenFornecedorHome, which has none');
});

/* ============================================================
   5 · THE 16 NUMERIC-ALIGNMENT SURFACES
   ============================================================ */

/**
 * One entry per accepted numeric surface. `numeralOwner` names the form the
 * tabular-numeral owner takes at that site:
 *
 *   attr      `'data-num': '1'` declared inline in the attribute object;
 *   class     `class: 'tnum'`, the class half of the same tokens.css rule;
 *   decorate  `setAttribute('data-num', '1')` on a node built by the file's
 *             existing value-cell helper — used where building a second
 *             element would have added another style construct the conformance
 *             detector cannot decode, for no extra information.
 */
const NUMERIC_SURFACES = [
  { id: 'G07', file: 'js/screens/cadastros.js', numeralOwner: 'attr', cells: 1 },
  { id: 'G09', file: 'js/screens/cliente-pedido-detail.js', numeralOwner: 'attr', cells: 3 },
  { id: 'G15', file: 'js/screens/expedicao-admin.js', numeralOwner: 'decorate', cells: 1 },
  { id: 'G16', file: 'js/screens/manta-expedicao-ui.js', numeralOwner: 'decorate', cells: 1 },
  { id: 'G17', file: 'js/screens/op-latex-admin.js', numeralOwner: 'attr', cells: 6 },
  { id: 'G20', file: 'js/screens/op-nova.js', numeralOwner: 'attr', cells: 6 },
  { id: 'G24', file: 'js/screens/op-tecelagem-producao-admin.js', numeralOwner: 'class', cells: 11 },
  { id: 'G28', file: 'js/screens/pedido-detail-events.js', numeralOwner: 'attr', cells: 3 },
  { id: 'G29', file: 'js/screens/pedido-detail-render.js', numeralOwner: 'attr', cells: 5 },
];

const OWNER_PATTERN = {
  attr: /'data-num': '1'/g,
  class: /class: 'tnum'/g,
  decorate: /setAttribute\('data-num', '1'\)/g,
};

test('5.1 every numeric-gap file now owns a tabular-numeral declaration', () => {
  for (const s of NUMERIC_SURFACES) {
    const found = (read(s.file).match(OWNER_PATTERN[s.numeralOwner]) || []).length;
    assert.equal(found, s.cells, `${s.file} declares ${found} ${s.numeralOwner} numeral owners, expected ${s.cells}`);
  }
});

test('5.1b the two decorating helpers right-align through the SAME value-cell helper', () => {
  // numValue()/numCell() must reuse value()/cell() rather than fork a second
  // styled element, so the typography and colour contracts cannot drift apart.
  assert.match(read('js/screens/expedicao-admin.js'),
    /function numValue\(text, weight, color\) \{\s*var node = value\(text, weight, color\);\s*node\.style\.textAlign = 'right';\s*node\.setAttribute\('data-num', '1'\);/);
  assert.match(read('js/screens/manta-expedicao-ui.js'),
    /function numCell\(text, weight, color\) \{\s*var node = cell\(text, weight, color\);\s*node\.style\.textAlign = 'right';\s*node\.setAttribute\('data-num', '1'\);/);
});

test('5.2 the dead `.num` class is gone — it resolved to no CSS rule anywhere', () => {
  // op-tecelagem's eleven value cells claimed `class:'num'`, for which neither
  // css/tokens.css nor css/responsive.css declares anything. That was the whole
  // reason the numbers were not tabular despite looking correct in source.
  assert.doesNotMatch(read('js/screens/op-tecelagem-producao-admin.js'), /class: 'num'/,
    'op-tecelagem still uses the no-op .num class');
  for (const css of ['css/tokens.css', 'css/responsive.css']) {
    assert.doesNotMatch(read(css), /^\s*\.num\b/m, `${css} must not gain a .num rule to rescue the old markup`);
  }
});

test('5.3 every numeric VALUE cell that owns numerals is also right-aligned', () => {
  // Read the whole attribute OBJECT, not one line: several call sites spread
  // `'data-num'` and `style` across separate lines.
  for (const s of NUMERIC_SURFACES) {
    if (s.numeralOwner === 'decorate') {
      // These two set the alignment on the very next line, on the same node.
      assert.match(read(s.file), /node\.style\.textAlign = 'right';\s*node\.setAttribute\('data-num', '1'\);/,
        `${s.file}: the decorated numeral cell is not right-aligned`);
      continue;
    }
    const text = read(s.file);
    const owner = s.numeralOwner === 'class' ? "class: 'tnum'" : "'data-num': '1'";
    let from = 0;
    let checked = 0;
    for (;;) {
      const at = text.indexOf(owner, from);
      if (at < 0) break;
      from = at + owner.length;
      const close = text.indexOf('}', at);
      const attrs = text.slice(text.lastIndexOf('{', at), close < 0 ? text.length : close);
      assert.match(attrs, /text-align:right/,
        `${s.file}: a numeral cell is not right-aligned → ${attrs.replace(/\s+/g, ' ').slice(0, 160)}`);
      checked += 1;
    }
    assert.equal(checked, s.cells, `${s.file}: expected ${s.cells} numeral cells, checked ${checked}`);
  }
});

test('5.4 G28 is RIGHT-aligned, never centred (architect ruling 6.6)', () => {
  const text = read('js/screens/pedido-detail-events.js');
  const at = text.indexOf('function buildTransitionPendingTable(');
  const block = text.slice(at, text.indexOf('function buildMovementMetrics(', at));
  assert.equal((block.match(/text-align:center/g) || []).length, 0,
    'the pendências table still centres a quantity column');
  assert.equal((block.match(/text-align:right/g) || []).length, 6,
    'expected three right-aligned headers and three right-aligned values');
  assert.equal((block.match(/'data-num': '1'/g) || []).length, 3);
});

test('5.5 op-latex thRow() no longer right-aligns a header whose value is left', () => {
  const text = read('js/screens/op-latex-admin.js');
  assert.match(text, /function thRow\(colsTemplate, labels, numericCols\)/,
    'thRow() must take an EXPLICIT numeric column list');
  assert.doesNotMatch(text, /idx === labels\.length - 1 \? 'text-align:right;'/,
    'the last-label heuristic is back — it caused the header/value contradiction');
  assert.match(text, /thRow\('1fr 140px 140px', \['MODELO', 'ENVIADO', 'RECEBIDO'\], \[1, 2\]\)/);
});

test('5.6 op-nova thRow() takes an explicit numericCols declaration at every accepted site', () => {
  const text = read('js/screens/op-nova.js');
  assert.match(text, /var numericCols = \(options && options\.numericCols\) \|\| \[\];/);
  assert.match(text, /\['FIO', 'FORNECEDOR', 'QTD \(KG\)', 'SITUAÇÃO'\], \{ numericCols: \[2\] \}/);
  assert.equal((text.match(/\['FIO', 'PEDIDO', 'RECEBIDO', 'STATUS'\], \{ numericCols: \[1, 2\] \}/g) || []).length, 2,
    'both fios branches must declare the same numeric columns');
  assert.match(text, /\['MODELO', 'PEDIDO', 'PRODUÇÃO'\], \{ numericCols: \[1, 2\] \}/);
});

test('5.7 G29 right-aligns the five metre headers and keeps OPs RELACIONADAS left', () => {
  const text = read('js/screens/pedido-detail-render.js');
  for (const l of ['PEDIDO', 'TECELAGEM', 'ACABAMENTO', 'PRONTOS', 'ENTREGUES']) {
    assert.match(text, new RegExp(`th\\('${l}', true\\)`), `${l} header is not right-aligned`);
  }
  assert.match(text, /th\('MODELO \/ CORES'\)/);
  assert.match(text, /th\('OPs RELACIONADAS'\)/);
  // Header and rows must still read the SAME width owner, in both variants:
  // one definition plus exactly two grid-template consumers.
  assert.equal((text.match(/grid-template-columns:' \+ itemColsFor\(showAcabamento\)/g) || []).length, 2,
    'header and rows must both build their template from itemColsFor()');
  assert.equal((text.match(/function itemColsFor\(showAcabamento\)/g) || []).length, 1);
});

test('5.8 the em-dash placeholder survives in every corrected numeric column', () => {
  assert.match(read('js/screens/op-nova.js'), /o\.kg_recebido == null \? '—' : window\.fmtKg\(o\.kg_recebido\)/);
  assert.match(read('js/screens/pedido-detail-render.js'), /isManta \? '—' : ns\.fmtMetrosShort\(metrics\.acabamento\)/);
});

test('5.9 no calculation, precision, separator or unit changed in the numeric files', () => {
  // Pass 8 is a presentation property. These formatters are the only source of
  // the displayed numbers and must be untouched.
  assert.match(read('js/screens/cadastros.js'),
    /Number\(row\.preco_por_metro\)\.toFixed\(2\)\.replace\('\.', ','\)/);
  assert.match(read('js/screens/cadastros.js'),
    /Number\(row\.largura\)\.toFixed\(2\)\.replace\('\.', ','\) \+ ' m'/);
  assert.match(read('js/screens/op-tecelagem-producao-admin.js'), /Math\.round\(\(ajustado - entregue\) \* 100\) \/ 100/);
});

/* ============================================================
   6 · THE 8 OVERFLOW SURFACES
   ============================================================ */

/**
 * Per accepted overflow surface: the declared inner minimum. G03's minimum is
 * DERIVED from its declared column set, because CONTATO and TELEFONE exist only
 * when the schema supports them.
 */
const OVERFLOW_SURFACES = [
  { id: 'G01', file: 'js/screens/admin-usuarios.js', minWidth: 'min-width:1120px;' },
  { id: 'G02', file: 'js/screens/cadastros.js', minWidth: 'min-width:480px;' },
  { id: 'G03', file: 'js/screens/cadastros.js', minWidth: 'derived' },
  { id: 'G04', file: 'js/screens/cadastros.js', minWidth: 'min-width:760px;' },
  { id: 'G06', file: 'js/screens/cadastros.js', minWidth: 'min-width:900px;' },
  { id: 'G08', file: 'js/screens/cliente-dashboard.js', minWidth: 'min-width:690px;' },
  { id: 'G12', file: 'js/screens/cliente-pedido-form.js', minWidth: 'min-width:880px;' },
  { id: 'G19', file: 'js/screens/op-nova.js', minWidth: 'min-width:560px;' },
];

test('6.1 each overflow file declares the canonical scroll owner the accepted number of times', () => {
  const perFile = {};
  for (const s of OVERFLOW_SURFACES) perFile[s.file] = (perFile[s.file] || 0) + 1;
  for (const [file, expected] of Object.entries(perFile)) {
    const text = read(file);
    const found = (text.match(/'data-rv-table-scroll': ''/g) || []).length;
    assert.ok(found >= expected,
      `${file} declares ${found} data-rv-table-scroll owners, the accepted population needs ${expected}`);
  }
});

test('6.2 every declared minimum is present, and G03 declares one per column set', () => {
  for (const s of OVERFLOW_SURFACES) {
    if (s.minWidth === 'derived') continue;
    assert.ok(read(s.file).includes(s.minWidth), `${s.id}: ${s.file} is missing ${s.minWidth}`);
  }

  // G03's column set is 4, 5 or 6 wide depending on schema support, so its
  // minimum is ARITHMETIC, not a guess. The arithmetic below is the source of
  // truth; the four literals in the screen are what the browser reads, because
  // a computed style would be undecodable for the conformance detector.
  const cad = read('js/screens/cadastros.js');
  assert.match(cad, /const COLUMN_MIN_PX = \{ nome: 220, contato: 150, telefone: 130, cnpj: 170, id: 70, acoes: 100 \};/);
  assert.match(cad, /const tableMinWidth = columns\.reduce/);

  const MIN = { nome: 220, contato: 150, telefone: 130, cnpj: 170, id: 70, acoes: 100 };
  const width = (keys) => keys.reduce((s, k) => s + MIN[k], 0) + (keys.length - 1) * 16 + 36;
  const expected = {
    six: width(['nome', 'contato', 'telefone', 'cnpj', 'id', 'acoes']),
    fiveContato: width(['nome', 'contato', 'cnpj', 'id', 'acoes']),
    fiveTelefone: width(['nome', 'telefone', 'cnpj', 'id', 'acoes']),
    four: width(['nome', 'cnpj', 'id', 'acoes']),
  };
  assert.deepEqual(expected, { six: 956, fiveContato: 810, fiveTelefone: 790, four: 644 },
    'the declared per-column minimums no longer produce the four literals in the screen');
  for (const px of Object.values(expected)) {
    assert.ok(cad.includes(`min-width:${px}px;`), `G03 is missing the ${px}px minimum`);
  }
});

test('6.3 header AND rows go inside the same scroll owner, so they scroll together', () => {
  // The bug this closes: a header appended to `card` while rows went into the
  // scroller (or the reverse) would break parity the moment the user scrolled.
  const cases = [
    { file: 'js/screens/admin-usuarios.js', appends: ['grid.appendChild(headRow)', 'grid.appendChild(line)'] },
    { file: 'js/screens/cliente-dashboard.js', appends: ['grid.appendChild(head)', 'grid.appendChild(destaqueRow('] },
    { file: 'js/screens/op-nova.js', appends: ['grid.appendChild(thRow(', 'grid.appendChild(rows)'] },
  ];
  for (const c of cases) {
    const text = read(c.file);
    for (const a of c.appends) assert.ok(text.includes(a), `${c.file} is missing ${a}`);
  }
  const cad = read('js/screens/cadastros.js');
  // Six, not four: G02/G03/G04/G06 were corrected by pass 8, G07 joined them in
  // A1 once the residual overflow gap was ruled binding, and G05 (Parâmetros)
  // independently names its own container `grid` inside the `overflow-x:auto`
  // wrapper it already owned.
  assert.equal((cad.match(/grid\.appendChild\(headRow\)/g) || []).length, 6,
    'a cadastros table stopped putting its header inside its scroll owner');
  assert.equal((cad.match(/grid\.appendChild\(line\)/g) || []).length, 5,
    'the five corrected cadastros tables must each put their rows inside the scroll owner');

  const form = read('js/screens/cliente-pedido-form.js');
  assert.match(form, /window\.el\('div', \{ style: 'min-width:880px;' \}, tableHeader, rowsWrap\)/,
    'G12 must scroll its header and rows together');
});

test('6.4 css/responsive.css is UNCHANGED — Pass 8 reuses the existing owner', () => {
  const css = read('css/responsive.css');
  assert.match(css, /\[data-rv-table-scroll\]\s*\{\s*overflow-x:\s*auto;\s*max-width:\s*100%;\s*min-width:\s*0;/);
  // No second overflow mechanism may appear anywhere in the runtime.
  const LOCAL = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
    .map((m) => m[1]).filter((s) => !/^https?:|^\/\//.test(s)).map((s) => s.split('?')[0]);
  for (const rel of LOCAL) {
    assert.doesNotMatch(read(rel), /data-rv-table-scroll-v2|data-rv-scroll-owner|overflow:\s*overlay/,
      `${rel} introduces a competing overflow system`);
  }
});

/* ============================================================
   7 · G05 — THE TRANSPOSED PARÂMETROS MATRIX
   ============================================================ */

test('7.1 G05 derives its width owner from the real column count', () => {
  const cad = read('js/screens/cadastros.js');
  assert.match(cad, /const paramGridTemplate = `repeat\(\$\{1 \+ orderedRows\.length\}, minmax\(0, 1fr\)\)`;/,
    'the Parâmetros template is no longer derived from the largura count');
  assert.doesNotMatch(cad, /grid-template-columns:1fr 1fr 1fr; gap:0;/,
    'the hardcoded three-track template is back — it wraps past two larguras');
  // Header and value rows must read the SAME owner.
  assert.equal((cad.match(/grid-template-columns:\$\{paramGridTemplate\}/g) || []).length, 2,
    'header and rows must share the single paramGridTemplate owner');
});

/* ============================================================
   8 · THE SIX ALREADY-CONFORMING SURFACES
   ============================================================ */

/**
 * These were proven conforming by the A2 inventory and are explicitly NOT
 * product-edit targets. Their shared width owner and their scroll owner are
 * pinned so a later pass cannot "harmonise" them into a regression, and so
 * nobody reclassifies a composite progress cell as a numeric column.
 */
const CONFORMING = [
  { id: 'G13', file: 'js/screens/cliente-pedidos-list.js', owner: 'TR_COLS' },
  { id: 'G14', file: 'js/screens/documentos-recebidos.js', owner: 'TABLE_GRID' },
  { id: 'G23', file: 'js/screens/op-nova.js', owner: 'rvThRow' },
  { id: 'G27', file: 'js/screens/ops-list.js', owner: 'minmax(130px,1.05fr)' },
  { id: 'G30', file: 'js/screens/pedido-item-row-editor.js', owner: 'GRID_COLS' },
  { id: 'G31', file: 'js/screens/pedidos-list.js', owner: 'TR_COLS' },
];

test('8.1 each conforming surface keeps its shared width owner', () => {
  for (const c of CONFORMING) {
    const text = read(c.file);
    assert.ok(text.includes(c.owner), `${c.id}: ${c.file} lost its ${c.owner} width owner`);
  }
});

test('8.2 the conforming surfaces gained NO numeral owner (rulings 6.1 and 6.4)', () => {
  // Progress bars, "300 / 500" and Pedido numbers are not numeric columns, so
  // these files must not have been swept along with the corrected ones.
  for (const file of [
    'js/screens/cliente-pedidos-list.js',
    'js/screens/documentos-recebidos.js',
    'js/screens/ops-list.js',
    'js/screens/pedidos-list.js',
    'js/screens/pedido-item-row-editor.js',
  ]) {
    assert.doesNotMatch(read(file), /'data-num': '1'|class: 'tnum'/,
      `${file} is a conforming surface and must not be edited by Pass 8`);
  }
});

test('8.3 G23 keeps its pre-existing inline numeral owner untouched', () => {
  assert.match(read('js/screens/op-nova.js'),
    /class: 'num', style: 'font-size:13px;text-align:right;color:var\(--rv-text-primary\);font-variant-numeric:tabular-nums;'/,
    'G23 already owned right-aligned tabular numerals and must be left alone');
});

test('8.4 editable numeric inputs were not restyled (architect ruling 6.3)', () => {
  // G19 and G30 hold a metre <input>. Pass 8 must not touch its alignment,
  // geometry or typography — only the table around it.
  const editor = read('js/screens/pedido-item-row-editor.js');
  assert.match(editor, /var GRID_COLS = '60px \.62fr 1\.28fr 1\.1fr \.8fr \.55fr 1\.2fr 84px';/);
  assert.doesNotMatch(editor, /text-align:right/, 'a row-editor cell acquired a numeric alignment');
  assert.match(read('js/screens/op-nova.js'), /styleInput\(metrosInput, 'padding:7px 10px;font-size:13\.5px;'\)/);
});

/* ============================================================
   9 · WHAT PASS 8 MUST **NOT** HAVE DONE
   ============================================================ */

test('9.1 no <caption>, no ARIA table/grid roles, no accessibility refactor', () => {
  const LOCAL = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
    .map((m) => m[1]).filter((s) => !/^https?:|^\/\//.test(s)).map((s) => s.split('?')[0]);
  for (const rel of LOCAL) {
    const text = read(rel);
    assert.doesNotMatch(text, /el\(\s*['"`]caption['"`]/, `${rel} introduced a <caption>`);
    assert.doesNotMatch(text, /role:\s*['"](table|grid|row|cell|columnheader|rowgroup|gridcell)['"]/,
      `${rel} introduced an ARIA table role`);
  }
});

test('9.2 no grid was converted to a semantic table, and no table to a grid', () => {
  // The category totals are the guard: 5 semantic + 31 grids. 1.2 already pins
  // the semantic side; this pins that the grid files still build grids.
  for (const c of CONFORMING) {
    if (c.id === 'G23') continue;  // shares op-nova with corrected surfaces
    assert.doesNotMatch(read(c.file), /el\(\s*['"`]table['"`]/, `${c.file} was converted to a semantic table`);
  }
});

test('9.3 the detector, its version and the §2.5 contract text are untouched', () => {
  assert.match(read('scripts/ui-conformance/rules.mjs'), /DETECTOR_VERSION = '1\.0\.6'/,
    'Pass 8 creates no rule and must not raise the detector version');
  const contract = read('docs/architecture/UI_VISUAL_CONTRACT.md');
  assert.match(contract, /### 2\.5 Table — golden rule/);
  assert.match(contract, /`table-layout: fixed` \+ `<colgroup>`/);
  assert.match(contract, /`overflow-x: auto` wrapper whenever a column has a fixed px width/);
});

test('9.4 no waiver, ignore list or suppression was introduced', () => {
  // Comments are excluded on purpose: both files DESCRIBE the absence of a
  // waiver mechanism, and matching that prose would fail for the right reason
  // stated the wrong way round.
  const codeOnly = (rel) =>
    read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments, including their continuation lines
      .replace(/^\s*\/\/.*$/gm, ' ');      // line comments
  for (const rel of ['scripts/validate-ui-conformance.mjs', 'scripts/ui-conformance/rules.mjs']) {
    assert.doesNotMatch(codeOnly(rel), /\b(waivers?|ignoreList|ignore_list|suppressions?|suppressed)\b/i,
      `${rel} gained a suppression mechanism`);
  }
});

/* ============================================================
   10 · CACHE-QUERY RETOKENIZATION
   ============================================================ */

const PASS8_TOKEN = '20260727-ui-p5-pass8-table-r1';
const PASS8_A1_TOKEN = '20260727-ui-p5-pass8-table-a1-overflow';

/**
 * The 17 product files Pass 8 changed, split by WHICH pass-8 token invalidates
 * them. A1 changed five of them again to close the residual overflow gaps, so
 * those carry the strictly later A1 token. The population is still 17; only
 * which pass-8 token does the invalidating moved.
 */
const RETOKENIZED_A1 = [
  'js/screens/cadastros.js',
  'js/screens/cliente-pedido-detail.js',
  'js/screens/op-latex-admin.js',
  'js/screens/op-nova.js',
  'js/screens/pedido-detail-events.js',
];
const RETOKENIZED_R1 = [
  'js/ui.js',
  'js/screens/admin-usuarios.js',
  'js/screens/cliente-dashboard.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/expedicao-admin.js',
  'js/screens/fornecedor.js',
  'js/screens/manta-expedicao-ui.js',
  'js/screens/op-tecelagem-producao-admin.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/pedido-parciais-admin.js',
];
const RETOKENIZED = [...RETOKENIZED_R1, ...RETOKENIZED_A1];

/**
 * ACTION-CONTAINMENT-A1 (a LATER, separately authorized order) changed six of
 * the seventeen files above again — five to consume the canonical modal action
 * bar or to declare a shared action owner, and op-nova.js / op-latex-admin.js
 * to take Archetype-A cockpit membership. Their cache token therefore moved
 * strictly forward, off the pass-8 tokens.
 *
 * The pass-8 population is UNCHANGED at seventeen: this list records which of
 * those seventeen a later order superseded, so the guard below still proves
 * every pass-8 file was retokenised once, and additionally proves that a file
 * only ever moves FORWARD to a strictly later token.
 */
const CONTAINMENT_A1_TOKEN = '20260727-ui-action-containment-a1';
const SUPERSEDED_BY_CONTAINMENT_A1 = [
  'js/ui.js',
  'js/screens/cadastros.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/op-latex-admin.js',
  'js/screens/op-nova.js',
  'js/screens/pedido-detail-events.js',
];
/**
 * SPECIALIZED-CONTROLS-B1 (a LATER, separately authorized order) changed seven
 * of the seventeen files again when the five role-specific control primitives
 * landed and their 22 constructions migrated. Four of those seven had already
 * been superseded by ACTION-CONTAINMENT-A1, so their token moves strictly
 * forward once more.
 *
 * The pass-8 population is UNCHANGED at seventeen. A file only ever moves
 * FORWARD to a strictly later token, which is exactly what the guards prove.
 */
const B1_TOKEN = '20260727-ui-specialized-controls-b1';
const SUPERSEDED_BY_B1 = [
  'js/ui.js',
  'js/screens/admin-usuarios.js',
  'js/screens/cadastros.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/expedicao-admin.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-parciais-admin.js',
];
const supersededByB1 = (rel) => SUPERSEDED_BY_B1.includes(rel);

/**
 * PEDIDO-SCREEN-GROUP-1 (a LATER, separately authorized order) consolidated the
 * five Pedido creation and editing screens. ONE of the seventeen —
 * cliente-pedido-form.js — was already superseded by pass-8 A1, containment A1
 * and B1 in turn, so its token moves strictly forward once more.
 *
 * The pass-8 population is UNCHANGED at seventeen. A file only ever moves
 * FORWARD to a strictly later token, which is exactly what the guards prove.
 */
const SCREEN_GROUP_1_TOKEN = '20260727-ui-pedido-screen-group-1';
const SUPERSEDED_BY_SCREEN_GROUP_1 = [
  'js/screens/cliente-pedido-form.js',
];
const supersededBySg1 = (rel) => SUPERSEDED_BY_SCREEN_GROUP_1.includes(rel);
/**
 * PEDIDO-SCREEN-GROUP-2 (a LATER, separately authorized order) consolidated the
 * Pedido DETAIL screen group, the cliente add-item modal frame and stacking,
 * and the two shared action owners. FOUR of the seventeen — js/ui.js,
 * cliente-pedido-form.js, pedido-detail-render.js and pedido-parciais-admin.js
 * — change again, so their token moves strictly forward once more.
 *
 * The pass-8 population is UNCHANGED at seventeen. A file only ever moves
 * FORWARD to a strictly later token, which is exactly what the guards prove.
 */
const SCREEN_GROUP_2_TOKEN = '20260727-ui-pedido-screen-group-2';
const SUPERSEDED_BY_SCREEN_GROUP_2 = [
  'js/ui.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/pedido-parciais-admin.js',
];
const supersededBySg2 = (rel) => SUPERSEDED_BY_SCREEN_GROUP_2.includes(rel);
const superseded = (rel) => SUPERSEDED_BY_CONTAINMENT_A1.includes(rel)
  || supersededByB1(rel) || supersededBySg1(rel) || supersededBySg2(rel);

test('10.1 every changed script carries a Pass-8 token exactly once', () => {
  assert.equal(RETOKENIZED.length, 17, 'the pass-8 changed-asset population must stay seventeen');
  // Every superseded file must really be one of the seventeen — a later order
  // may move a pass-8 token forward, never invent membership in this set.
  for (const rel of SUPERSEDED_BY_CONTAINMENT_A1) {
    assert.ok(RETOKENIZED.includes(rel), `${rel} was never a pass-8 asset`);
  }
  for (const rel of SUPERSEDED_BY_B1) {
    assert.ok(RETOKENIZED.includes(rel), `${rel} was never a pass-8 asset`);
  }
  for (const rel of SUPERSEDED_BY_SCREEN_GROUP_1) {
    assert.ok(RETOKENIZED.includes(rel), `${rel} was never a pass-8 asset`);
  }
  for (const rel of SUPERSEDED_BY_SCREEN_GROUP_2) {
    assert.ok(RETOKENIZED.includes(rel), `${rel} was never a pass-8 asset`);
  }
  for (const rel of RETOKENIZED_R1) {
    if (superseded(rel)) continue;
    assert.ok(INDEX.includes(`"${rel}?v=${PASS8_TOKEN}"`), `${rel} was not retokenised for Pass 8`);
  }
  for (const rel of RETOKENIZED_A1) {
    if (superseded(rel)) continue;
    assert.ok(INDEX.includes(`"${rel}?v=${PASS8_A1_TOKEN}"`), `${rel} must carry the later A1 token`);
    assert.ok(!INDEX.includes(`"${rel}?v=${PASS8_TOKEN}"`), `${rel} kept the superseded R1 token`);
  }
  // A superseded file carries the containment token and NEITHER pass-8 token:
  // a stale token would let a warm cache keep pre-A1 JavaScript.
  for (const rel of SUPERSEDED_BY_CONTAINMENT_A1) {
    if (supersededByB1(rel)) continue;
    assert.ok(INDEX.includes(`"${rel}?v=${CONTAINMENT_A1_TOKEN}"`),
      `${rel} was not retokenised for ACTION-CONTAINMENT-A1`);
    assert.ok(!INDEX.includes(`"${rel}?v=${PASS8_TOKEN}"`), `${rel} kept the superseded pass-8 R1 token`);
    assert.ok(!INDEX.includes(`"${rel}?v=${PASS8_A1_TOKEN}"`), `${rel} kept the superseded pass-8 A1 token`);
  }
  // A B1 arrival carries the B1 token and NO earlier one.
  for (const rel of SUPERSEDED_BY_B1) {
    if (supersededBySg1(rel) || supersededBySg2(rel)) continue;
    assert.ok(INDEX.includes(`"${rel}?v=${B1_TOKEN}"`),
      `${rel} was not retokenised for SPECIALIZED-CONTROLS-B1`);
    assert.ok(!INDEX.includes(`"${rel}?v=${PASS8_TOKEN}"`), `${rel} kept the superseded pass-8 R1 token`);
    assert.ok(!INDEX.includes(`"${rel}?v=${PASS8_A1_TOKEN}"`), `${rel} kept the superseded pass-8 A1 token`);
    assert.ok(!INDEX.includes(`"${rel}?v=${CONTAINMENT_A1_TOKEN}"`),
      `${rel} kept the superseded containment token`);
  }
  // A SCREEN-GROUP-1 arrival carries its token and NO earlier one.
  for (const rel of SUPERSEDED_BY_SCREEN_GROUP_1) {
    if (supersededBySg2(rel)) continue;
    assert.ok(INDEX.includes(`"${rel}?v=${SCREEN_GROUP_1_TOKEN}"`),
      `${rel} was not retokenised for PEDIDO-SCREEN-GROUP-1`);
    for (const stale of [PASS8_TOKEN, PASS8_A1_TOKEN, CONTAINMENT_A1_TOKEN, B1_TOKEN]) {
      assert.ok(!INDEX.includes(`"${rel}?v=${stale}"`), `${rel} kept a superseded token`);
    }
  }
  // A SCREEN-GROUP-2 arrival carries its token and NO earlier one.
  for (const rel of SUPERSEDED_BY_SCREEN_GROUP_2) {
    assert.ok(INDEX.includes(`"${rel}?v=${SCREEN_GROUP_2_TOKEN}"`),
      `${rel} was not retokenised for PEDIDO-SCREEN-GROUP-2`);
    for (const stale of [PASS8_TOKEN, PASS8_A1_TOKEN, CONTAINMENT_A1_TOKEN, B1_TOKEN,
      SCREEN_GROUP_1_TOKEN]) {
      assert.ok(!INDEX.includes(`"${rel}?v=${stale}"`), `${rel} kept a superseded token`);
    }
  }
  // Still exactly one reference per file, superseded or not.
  for (const rel of RETOKENIZED) {
    assert.equal((INDEX.match(new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=', 'g')) || []).length, 1,
      `${rel} is referenced more than once`);
  }
  assert.equal((INDEX.match(new RegExp(PASS8_TOKEN + '(?!-)', 'g')) || []).length,
    RETOKENIZED_R1.filter((rel) => !superseded(rel)).length,
    'the Pass-8 R1 token appears on a file it did not change');
  assert.equal((INDEX.match(new RegExp(PASS8_A1_TOKEN, 'g')) || []).length,
    RETOKENIZED_A1.filter((rel) => !superseded(rel)).length,
    'the Pass-8 A1 token appears on a file A1 did not change');
});

test('10.1b the containment token lands only on the files that order changed', () => {
  // ACTION-CONTAINMENT-A1 changed SEVEN scripts. Six were pass-8 assets; the
  // seventh, admin-usuarios-modal.js, was not, so it is not in the list above
  // but must still carry the token exactly once.
  const CONTAINMENT_A1_ASSETS = [...SUPERSEDED_BY_CONTAINMENT_A1, 'js/screens/admin-usuarios-modal.js'];
  assert.equal(CONTAINMENT_A1_ASSETS.length, 7);
  // SPECIALIZED-CONTROLS-B1 moved FIVE of those seven forward again, so they
  // now carry the strictly later B1 token. The containment population is
  // unchanged at seven; only which token invalidates five of them moved.
  const MOVED_ON_BY_B1 = CONTAINMENT_A1_ASSETS.filter((rel) => supersededByB1(rel)
    || rel === 'js/screens/admin-usuarios-modal.js');
  assert.equal(MOVED_ON_BY_B1.length, 5);
  // PEDIDO-SCREEN-GROUP-1 then moved ONE of those five forward once more. The
  // containment population is still seven; only which token invalidates one of
  // them moved.
  const MOVED_ON_BY_SG1 = CONTAINMENT_A1_ASSETS.filter(supersededBySg1);
  assert.equal(MOVED_ON_BY_SG1.length, 1);
  // PEDIDO-SCREEN-GROUP-2 then moved TWO of them forward once more — js/ui.js,
  // which owns actionButton()'s positioning context and the brand pageHeader
  // action, and cliente-pedido-form.js, which carries the canonical modal frame
  // and stacking. The containment population is still seven; only which token
  // invalidates two of them moved.
  const MOVED_ON_BY_SG2 = CONTAINMENT_A1_ASSETS.filter(supersededBySg2);
  assert.equal(MOVED_ON_BY_SG2.length, 2);
  for (const rel of CONTAINMENT_A1_ASSETS) {
    const expected = MOVED_ON_BY_SG2.includes(rel)
      ? SCREEN_GROUP_2_TOKEN
      : (MOVED_ON_BY_SG1.includes(rel)
        ? SCREEN_GROUP_1_TOKEN
        : (MOVED_ON_BY_B1.includes(rel) ? B1_TOKEN : CONTAINMENT_A1_TOKEN));
    assert.ok(INDEX.includes(`"${rel}?v=${expected}"`), `${rel} missing its containment-or-later token`);
  }
  assert.equal((INDEX.match(new RegExp(CONTAINMENT_A1_TOKEN, 'g')) || []).length,
    CONTAINMENT_A1_ASSETS.length - MOVED_ON_BY_B1.length,
    'the containment token appears on a file that order did not change');
});

test('10.2 UNCHANGED assets keep their previous tokens', () => {
  // css/responsive.css was not touched, so retokenising it would invalidate a
  // warm cache for no reason. css/tokens.css was NOT touched by pass 8 either,
  // but SPECIALIZED-CONTROLS-B1 later added the specialized-control role
  // geometry to it, so it correctly carries that strictly later token.
  assert.match(INDEX, /css\/tokens\.css\?v=20260727-ui-specialized-controls-b1/);
  assert.match(INDEX, /css\/responsive\.css\?v=20260725-pedido-operational-batch3/);
  assert.match(INDEX, /js\/select-popover\.js\?v=20260727-ui-p5-pass7-native-select-a1/);
  // pedido-item-row-editor.js was UNCHANGED by pass 8 and held its pass-7 token
  // through pass 8, containment A1 and B1. PEDIDO-SCREEN-GROUP-1 is the first
  // later order to change it, so it correctly carries that strictly later token
  // and is no longer an example of an unchanged asset.
  assert.match(INDEX, /js\/screens\/pedido-item-row-editor\.js\?v=20260727-ui-pedido-screen-group-1/);
  assert.match(INDEX, /js\/boot\.js\?v=20260623-asset1/);
});

/* ============================================================
   11 · THE OBLIGATION MATRIX — EVERY SURFACE, EVERY APPLICABLE RULE

   Pass 8 filed one PRIMARY disposition per surface and corrected only what that
   label named. That is how nine surfaces kept a fixed-pixel column with no local
   scroll owner while being recorded as closed: their primary label was numeric,
   so the overflow clause of the SAME contract section was never checked.

   A primary label is a reporting convenience. It is not a licence to skip an
   applicable obligation. This matrix evaluates all 41 surfaces against every
   clause of §2.5 that applies to them, independently:

     HAS_FIXED_PX_COLUMN      → then HAS_LOCAL_OVERFLOW_OWNER must be true
     HAS_NUMERIC_COLUMN       → then header AND value alignment must be right,
                                and HAS_NUMERAL_OWNER must be true
     always                   → HAS_WIDTH_PARITY_OWNER must be true

   `fixedPx: false` is a CLAIM, not an exemption: 11.3 re-derives it from the
   declared template and fails if a px column is hiding in a surface that says it
   has none.
   ============================================================ */

/**
 * owner: the exact source token that proves the local scroll owner for this
 * surface. Every entry is `data-rv-table-scroll` or the pre-existing
 * `overflow-x` wrapper the accepted inventory already credited.
 */
const MATRIX = [
  // ---- direct semantic: width parity by <colgroup>, percentages only -------
  { id: 'S01', file: 'js/screens/ordem-compra-render.js', kind: 'table', template: '26%,30%,20%,12%,12%', fixedPx: false, numeric: true, numeralOwner: 'inline' },
  { id: 'S02', file: 'js/screens/ordem-compra-render.js', kind: 'table', template: '40%,22%,22%,16%', fixedPx: false, numeric: true, numeralOwner: 'inline' },
  { id: 'S03', file: 'js/screens/ordem-compra-receipt-render.js', kind: 'table', template: '36%,16%,16%,16%,16%', fixedPx: false, numeric: true, numeralOwner: 'inline' },
  { id: 'S04', file: 'js/screens/ordem-compra-receipt-render.js', kind: 'table', template: '28%,24%,16%,16%,16%', fixedPx: false, numeric: true, numeralOwner: 'inline' },
  { id: 'S05', file: 'js/screens/ordem-compra-receipt-render.js', kind: 'table', template: '24%,20%,14%,14%,14%,14%', fixedPx: false, numeric: true, numeralOwner: 'inline' },

  // ---- shared helper: the owner enforces every clause centrally ------------
  { id: 'H01', file: 'js/screens/fornecedor.js', kind: 'datatable', fixedPx: false, numeric: true, numeralOwner: 'helper' },
  { id: 'H02', file: 'js/screens/fornecedor.js', kind: 'datatable', fixedPx: false, numeric: true, numeralOwner: 'helper' },
  { id: 'H03', file: 'js/screens/fornecedor.js', kind: 'datatable', fixedPx: false, numeric: true, numeralOwner: 'helper' },
  { id: 'H04', file: 'js/screens/op-latex-admin.js', kind: 'datatable', fixedPx: false, numeric: true, numeralOwner: 'helper' },
  { id: 'H05', file: 'js/screens/pedido-parciais-admin.js', kind: 'datatable', fixedPx: false, numeric: true, numeralOwner: 'helper' },

  // ---- simulated grids ----------------------------------------------------
  { id: 'G01', file: 'js/screens/admin-usuarios.js', kind: 'grid', fixedPx: true, owner: 'min-width:1120px;', numeric: false },
  { id: 'G02', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: true, owner: 'min-width:480px;', numeric: false },
  { id: 'G03', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: true, owner: 'min-width:956px;', numeric: false },
  { id: 'G04', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: true, owner: 'min-width:760px;', numeric: false },
  { id: 'G05', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: false, owner: 'overflow-x:auto;', numeric: false },
  { id: 'G06', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: true, owner: 'min-width:900px;', numeric: false },
  { id: 'G07', file: 'js/screens/cadastros.js', kind: 'grid', fixedPx: true, owner: 'min-width:690px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G08', file: 'js/screens/cliente-dashboard.js', kind: 'grid', fixedPx: true, owner: 'min-width:690px;', numeric: false },
  { id: 'G09', file: 'js/screens/cliente-pedido-detail.js', kind: 'grid', fixedPx: false, owner: 'min-width:530px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G10', file: 'js/screens/cliente-pedido-detail.js', kind: 'grid', fixedPx: true, owner: 'min-width:450px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G11', file: 'js/screens/cliente-pedido-detail.js', kind: 'grid', fixedPx: true, owner: 'min-width:450px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G12', file: 'js/screens/cliente-pedido-form.js', kind: 'grid', fixedPx: true, owner: 'min-width:880px;', numeric: false },
  { id: 'G13', file: 'js/screens/cliente-pedidos-list.js', kind: 'grid', fixedPx: true, owner: 'overflow-x:auto;', numeric: false },
  { id: 'G14', file: 'js/screens/documentos-recebidos.js', kind: 'grid', fixedPx: true, owner: 'overflow-x:auto;', numeric: false },
  { id: 'G15', file: 'js/screens/expedicao-admin.js', kind: 'grid', fixedPx: true, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'decorate' },
  { id: 'G16', file: 'js/screens/manta-expedicao-ui.js', kind: 'grid', fixedPx: true, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'decorate' },
  { id: 'G17', file: 'js/screens/op-latex-admin.js', kind: 'grid', fixedPx: false, owner: 'overflow-x:auto;', numeric: true, numeralOwner: 'attr' },
  { id: 'G18', file: 'js/screens/op-latex-admin.js', kind: 'grid', fixedPx: true, owner: 'min-width:550px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G19', file: 'js/screens/op-nova.js', kind: 'grid', fixedPx: true, owner: 'min-width:560px;', numeric: false },
  { id: 'G20', file: 'js/screens/op-nova.js', kind: 'grid', fixedPx: true, owner: 'min-width:660px;', numeric: true, numeralOwner: 'inline', residual: true },
  { id: 'G21', file: 'js/screens/op-nova.js', kind: 'grid', fixedPx: true, owner: 'min-width:660px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G22', file: 'js/screens/op-nova.js', kind: 'grid', fixedPx: true, owner: 'min-width:550px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G23', file: 'js/screens/op-nova.js', kind: 'grid', fixedPx: true, owner: 'overflow-x:auto;', numeric: true, numeralOwner: 'inline' },
  { id: 'G24', file: 'js/screens/op-tecelagem-producao-admin.js', kind: 'grid', fixedPx: false, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'class' },
  { id: 'G25', file: 'js/screens/op-tecelagem-producao-admin.js', kind: 'grid', fixedPx: true, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'class' },
  { id: 'G26', file: 'js/screens/op-tecelagem-producao-admin.js', kind: 'grid', fixedPx: true, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'class' },
  { id: 'G27', file: 'js/screens/ops-list.js', kind: 'grid', fixedPx: true, owner: 'overflow-x:auto;', numeric: false },
  { id: 'G28', file: 'js/screens/pedido-detail-events.js', kind: 'grid', fixedPx: true, owner: 'min-width:480px;', numeric: true, numeralOwner: 'attr', residual: true },
  { id: 'G29', file: 'js/screens/pedido-detail-render.js', kind: 'grid', fixedPx: false, owner: 'data-rv-table-scroll', numeric: true, numeralOwner: 'attr' },
  { id: 'G30', file: 'js/screens/pedido-item-row-editor.js', kind: 'grid', fixedPx: true, owner: 'data-rv-table-scroll', numeric: false, ownerFile: 'js/screens/pedido-form.js' },
  { id: 'G31', file: 'js/screens/pedidos-list.js', kind: 'grid', fixedPx: true, owner: 'overflow-x:auto;', numeric: false },
];

/** The nine surfaces this correction moved from false to true. */
const RESIDUAL_NINE = ['G07', 'G09', 'G10', 'G11', 'G18', 'G20', 'G21', 'G22', 'G28'];
/** The eight Pass-8 originally corrected. They must stay true. */
const ORIGINAL_EIGHT = ['G01', 'G02', 'G03', 'G04', 'G06', 'G08', 'G12', 'G19'];

test('11.1 the matrix evaluates all 41 surfaces, with no duplicate and no omission', () => {
  assert.equal(MATRIX.length, TOTAL_RUNTIME_SURFACES);
  assert.equal(new Set(MATRIX.map((s) => s.id)).size, TOTAL_RUNTIME_SURFACES, 'a surface id is repeated');
  assert.equal(MATRIX.filter((s) => s.kind === 'table').length, DIRECT_SEMANTIC_TOTAL);
  assert.equal(MATRIX.filter((s) => s.kind === 'datatable').length, SHARED_HELPER_TOTAL);
  assert.equal(MATRIX.filter((s) => s.kind === 'grid').length, SIMULATED_GRID_TOTAL);
  // Every surface must carry a verdict for every column of the matrix.
  for (const s of MATRIX) {
    assert.equal(typeof s.fixedPx, 'boolean', s.id + ' has no HAS_FIXED_PX_COLUMN verdict');
    assert.equal(typeof s.numeric, 'boolean', s.id + ' has no HAS_NUMERIC_COLUMN verdict');
    assert.ok(s.file, s.id + ' has no file');
    if (s.numeric) assert.ok(s.numeralOwner, s.id + ' is numeric but declares no numeral owner');
  }
});

test('11.2 EVERY surface with a fixed-pixel column has a local overflow owner', () => {
  // This is the obligation Pass 8 skipped on nine surfaces. It is now checked
  // for all 41 independently of any primary disposition.
  const missing = [];
  for (const s of MATRIX.filter((x) => x.fixedPx)) {
    if (!s.owner) { missing.push(s.id + ' declares no owner'); continue; }
    const text = read(s.ownerFile || s.file);
    const proof = s.ownerVia || s.owner;
    if (!text.includes(proof)) missing.push(s.id + ' owner token absent from ' + (s.ownerFile || s.file));
  }
  assert.deepEqual(missing, [], 'fixed-pixel surfaces without a local overflow owner');
});

test('11.3 a fixedPx:false claim is re-derived, never taken on trust', () => {
  // A surface may not escape 11.2 by mislabelling itself. Percentage-only
  // <colgroup>s and fr-only grid templates are the only legitimate false.
  for (const s of MATRIX.filter((x) => !x.fixedPx)) {
    if (s.kind === 'table') {
      for (const w of s.template.split(',')) {
        assert.match(w, /%$/, s.id + ' claims no fixed px but declares ' + w);
      }
      continue;
    }
    // The grid and dataTable cases are asserted by their own sections: H01-H05
    // widths are percentages (4.1), G05/G17/G24/G29 templates are fr/minmax(0,..)
    // only. Re-assert the dataTable half here so the claim is not free.
    if (s.kind === 'datatable') {
      const text = read(s.file);
      assert.doesNotMatch(text, /width: '\d+px'/, s.id + ': ' + s.file + ' declares a px column width');
    }
  }
});

test('11.4 the nine residual surfaces now own local overflow', () => {
  for (const id of RESIDUAL_NINE) {
    const s = MATRIX.find((x) => x.id === id);
    assert.ok(s, id + ' left the matrix');
    assert.ok(s.residual, id + ' lost its residual marker');
    assert.ok(s.owner, id + ' still has no overflow owner');
    assert.ok(read(s.ownerFile || s.file).includes(s.ownerVia || s.owner), id + ' owner token absent');
  }
  assert.equal(MATRIX.filter((s) => s.residual).length, 9, 'the residual population is frozen at nine');
});

test('11.5 the eight originally corrected surfaces remain corrected', () => {
  for (const id of ORIGINAL_EIGHT) {
    const s = MATRIX.find((x) => x.id === id);
    assert.ok(s.fixedPx, id + ' stopped declaring a fixed-pixel column');
    assert.ok(read(s.ownerFile || s.file).includes(s.ownerVia || s.owner), id + ' lost its overflow owner');
  }
});

test('11.6 every numeric surface owns alignment on BOTH sides and a numeral owner', () => {
  const OWNER_TOKEN = {
    attr: "'data-num': '1'",
    class: "class: 'tnum'",
    decorate: "setAttribute('data-num', '1')",
    inline: 'font-variant-numeric:tabular-nums',
    helper: null, // js/ui.js owns it centrally; asserted by 3.4
  };
  for (const s of MATRIX.filter((x) => x.numeric)) {
    if (s.numeralOwner === 'helper') continue;
    const token = OWNER_TOKEN[s.numeralOwner];
    assert.ok(token, s.id + ' declares an unknown numeral owner: ' + s.numeralOwner);
    assert.ok(read(s.file).includes(token),
      s.id + ': ' + s.file + ' does not carry its declared numeral owner (' + s.numeralOwner + ')');
    // Right alignment is declared one of three equivalent ways: inline in the
    // style string (most grids), as a Tailwind text-right utility (the two
    // purchase-order semantic tables), or as a literal property assignment (the
    // two files whose numeral cell decorates a shared value-cell helper).
    const src = read(s.file);
    assert.ok(/text-align:s*right/.test(src) || /text-right/.test(src) || /style.textAlign = 'right'/.test(src),
      s.id + ': ' + s.file + ' declares no right alignment');
  }
  // The five dataTable instances get both halves from the shared owner.
  assert.match(UI, /if \(layout\[i\]\.numeric\) attrs\['data-num'\] = '1';/);
});

test('11.7 every surface has a width-parity owner', () => {
  for (const s of MATRIX) {
    const text = read(s.file);
    if (s.kind === 'table') {
      assert.match(text, /el\('colgroup', \{\}/, s.id + ': ' + s.file + ' lost its <colgroup>');
      assert.match(text, /table-layout:fixed/, s.id + ': ' + s.file + ' lost table-layout:fixed');
    } else if (s.kind === 'datatable') {
      assert.match(UI, /const colgroup = el\('colgroup', \{\}\);/);
    } else {
      assert.match(text, /grid-template-columns/, s.id + ': ' + s.file + ' lost its grid template');
    }
  }
});

test('11.8 no primary-disposition label can suppress an applicable obligation', () => {
  // The matrix carries NO primary-disposition field, by construction. If one is
  // ever added, this fails — the whole point is that obligations are evaluated
  // per clause, not per label.
  for (const s of MATRIX) {
    assert.ok(!('primary' in s) && !('disposition' in s),
      s.id + ' reintroduced a primary-disposition label into the obligation matrix');
  }
  // And the count of surfaces carrying a fixed-px column must exceed the eight
  // Pass 8 originally corrected — proof the matrix is not just re-stating the
  // old primary-disposition population.
  const fixedPxCount = MATRIX.filter((s) => s.fixedPx).length;
  assert.ok(fixedPxCount > ORIGINAL_EIGHT.length,
    'the fixed-px population collapsed back to the pass-8 primary-disposition list');
  assert.equal(fixedPxCount, 26, 'the fixed-px population moved without explanation');
});

test('11.9 the document is never treated as the table scroll owner', () => {
  // A surface may not satisfy 11.2 by letting the page scroll. Every owner is
  // either the canonical attribute or a local overflow-x wrapper — never <body>,
  // never documentElement, never a global rule.
  for (const s of MATRIX.filter((x) => x.owner)) {
    assert.ok(/data-rv-table-scroll|overflow-x:auto;|min-width:/.test(s.owner),
      s.id + ' owner is not a local container token: ' + s.owner);
  }
  const LOCAL = [...INDEX.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
    .map((m) => m[1]).filter((x) => !/^https?:|^\/\//.test(x)).map((x) => x.split('?')[0]);
  for (const rel of LOCAL) {
    assert.doesNotMatch(read(rel), /document\.body\.style\.overflowX|documentElement\.style\.overflow/,
      rel + ' makes the document the scroll owner');
  }
  assert.doesNotMatch(read('css/responsive.css'), /^\s*body\s*\{[^}]*overflow-x:\s*auto/m);
});

test('11.10 every min-width owner sits inside a data-rv-table-scroll container', () => {
  // A minimum without a scroll owner is worse than neither: it guarantees the
  // overflow it cannot resolve.
  for (const s of MATRIX.filter((x) => x.owner && x.owner.startsWith('min-width:'))) {
    if (s.ownerVia) { assert.match(read(s.file), /'data-rv-table-scroll': ''/, s.id + ': helper owner missing'); continue; }
    const text = read(s.ownerFile || s.file);
    assert.match(text, /'data-rv-table-scroll': ''/,
      s.id + ': ' + s.file + ' declares a minimum with no canonical scroll owner in the file');
  }
});
