// Smoke test do módulo js/screens/op-nova.js
// (SCREENNOVAOP-MODULE-A).
//
// Garante que a extração de screenNovaOP do <script> inline de
// index.html para js/screens/op-nova.js preservou:
//   - a função screenNovaOP inteira (com ~20 subfunções de closure);
//   - a assinatura async function screenNovaOP(opId);
//   - os call-sites modularizados (window.persistirOP,
//     window.aplicarRecalculoOP, window.maxMetrosItem,
//     window.itensValidosOP, window.registrarRecebimentoOrdemFio,
//     window.atribuirFornecedorFioOp, window.renderOPLatexAdmin,
//     window.rotuloModelo, window.fmtKg, window.fmtMetros,
//     window.disabledAttr, etc.);
//   - gerarPdfCompraFios dentro do módulo (NÃO extraído para
//     op-pdf.js nesta fase).
//
// Estáticos (1-10):
//   1. js/screens/op-nova.js existe.
//   2. node --check js/screens/op-nova.js passa.
//   3. op-nova.js é script clássico, sem import/export.
//   4. index.html carrega op-nova.js exatamente uma vez.
//   5. Ordem: op-persistir.js → op-nova.js → jspdf → inline.
//   6. index.html NÃO contém mais async function screenNovaOP.
//   7. index.html contém window.screenNovaOP(null) no call-site
//      de #/ops/nova.
//   8. index.html AINDA contém setRoutes.
//   9. index.html AINDA contém main.
//  10. js/screens/op-nova.js contém async function screenNovaOP.
//
// Runtime (11-15):
//  11. window.screenNovaOP é função.
//  12. window.RAVATEX_SCREENS.opNova.screenNovaOP existe.
//  13. op-nova.js contém gerarPdfCompraFios (não extraído).
//  14. op-nova.js contém buildProposta / recompute / onAceitar.
//  15. op-nova.js contém buildBlocoFios / buildBlocoTecelagem /
//      buildOrdemPendenteRow.
//
// Call-sites de módulos extraídos (16-22):
//  16. op-nova.js chama window.persistirOP.
//  17. op-nova.js chama window.aplicarRecalculoOP.
//  18. op-nova.js chama window.registrarRecebimentoOrdemFio.
//  19. op-nova.js chama window.atribuirFornecedorFioOp.
//  20. op-nova.js chama window.renderOPLatexAdmin.
//  21. op-nova.js chama window.maxMetrosItem / window.itensValidosOP.
//  22. op-nova.js chama window.disabledAttr / window.rotuloModelo /
//      window.fmtKg / window.fmtMetros.
//
// Sem regressão de writes (23-26):
//  23. op-nova.js NÃO contém de from().insert/update/delete
//      (todos os writes ficaram em op-persistir.js / op-recalculo.js
//      / op-writes.js).
//  24. op-nova.js contém apenas from().select() (reads) OU
//      nenhum from() direto.
//  25. index.html NÃO contém implementação de persistirOP (helper
//      já extraído).
//  26. index.html NÃO contém implementação de aplicarRecalculoOP
//      (helper já extraído).
//
// setRoutes/main inline (27-28):
//  27. setRoutes e main continuam inline em index.html.
//  28. setRoutes referencia window.screenNovaOP(null) para #/ops/nova.
//
// Boot chain (29-30):
//  29. Boot chain: todos os módulos + op-nova + inline coexiste
//      sem SyntaxError de duplicate identifier.
//  30. window.screenNovaOP continua resolvível após o boot completo.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OPP   = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const OPR   = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OFH   = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const EF    = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW    = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN  = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI    = path.join(ROOT, 'js', 'ui.js');
const BADGES= path.join(ROOT, 'js', 'badges.js');
const ROUTER= path.join(ROOT, 'js', 'router.js');
const CALC  = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON= path.join(ROOT, 'js', 'screens', 'common.js');
const CAD   = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPSLIST = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
const oppSrc    = fs.readFileSync(OPP,   'utf8');
const oprSrc    = fs.readFileSync(OPR,   'utf8');
const painelSrc = fs.readFileSync(PAINEL,'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES,'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER,'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON,'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPSLIST,'utf8');
const ewSrc     = fs.readFileSync(EW,    'utf8');
const fornSrc   = fs.readFileSync(FORN,  'utf8');

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) {
    // Após ROUTES-BOOT-MODULE-A o <script> inline foi removido.
    // Tests que verificam AUSÊNCIA de coisas no inline passam
    // trivialmente; tests que esperavam PRESENÇA foram
    // atualizados para olhar em js/boot.js.
    return '';
  }
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, appendChild(){}, setAttribute(){} } : n);
    }
  }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/screens/op-nova.js existe', () => {
  assert.ok(fs.existsSync(OPN), 'js/screens/op-nova.js não existe');
});

test('2. op-nova.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPN}"`, { stdio: 'pipe' });
});

test('3. op-nova.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(opnSrc), false,
    'op-nova.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(opnSrc), false,
    'op-nova.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-nova.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/op-nova\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-nova.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-nova\.js"[^>]*type=/.test(indexSrc), false,
    'op-nova.js está sendo carregado com type=module');
});

test('5. index.html: ordem op-persistir.js → op-nova.js → jspdf → boot.js (último local antes de </head>)', () => {
  const oppIdx    = findScriptIdx(indexSrc, 'js/screens/op-persistir.js');
  const opnIdx    = findScriptIdx(indexSrc, 'js/screens/op-nova.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(oppIdx > 0, 'op-persistir.js não encontrado');
  assert.ok(opnIdx > 0, 'op-nova.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(oppIdx < opnIdx, 'op-persistir.js deve vir antes de op-nova.js');
  assert.ok(opnIdx < jspdfIdx, 'op-nova.js deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
});

test('6. index.html NÃO contém mais async function screenNovaOP (extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
});

test('7. boot.js contém window.screenNovaOP(null) no call-site de #/ops/nova', () => {
  // Após ROUTES-BOOT-MODULE-A, o inline foi removido e o call-site
  // de #/ops/nova está em js/boot.js.
  const bootSrc = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');
  assert.match(bootSrc, /'#\/ops\/nova':\s*\{\s*render:\s*\(\)\s*=>\s*window\.screenNovaOP\(null\)/,
    'boot.js deve ter call-site de #/ops/nova com window.screenNovaOP(null)');
});

test('8. index.html NÃO contém mais setRoutes (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes foi extraído para boot.js
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
});

test('9. index.html NÃO contém mais main (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, main foi extraído para boot.js
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('10. js/screens/op-nova.js contém async function screenNovaOP', () => {
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não define screenNovaOP');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

function makeOpNovaBootSandbox() {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = {
    from: () => ({
      select() { return this; },
      order() { return this; },
      eq() { return this; },
      single() { return Promise.resolve({ data: null, error: null }); },
      then(r) { return Promise.resolve({ data: null, error: null }).then(r); },
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
  };
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' }, supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(oppSrc,    sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('11. runtime: window.screenNovaOP é função', () => {
  const { sandbox } = makeOpNovaBootSandbox();
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após boot');
});

test('12. runtime: window.RAVATEX_SCREENS.opNova.screenNovaOP existe', () => {
  const { sandbox } = makeOpNovaBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opNova.screenNovaOP', sandbox),
    'window.RAVATEX_SCREENS.opNova.screenNovaOP não existe');
});

test('13. op-nova.js contém gerarPdfCompraFios (NÃO extraído para op-pdf.js nesta fase)', () => {
  assert.match(opnSrc, /function\s+gerarPdfCompraFios\s*\(/,
    'op-nova.js perdeu gerarPdfCompraFios — função deveria estar dentro de op-nova.js');
});

test('14. op-nova.js contém buildProposta / recompute / onAceitar', () => {
  assert.match(opnSrc, /function\s+buildProposta\s*\(/);
  assert.match(opnSrc, /function\s+recompute\s*\(/);
  assert.match(opnSrc, /function\s+onAceitar\s*\(/);
});

test('15. op-nova.js contém buildBlocoFios / buildBlocoTecelagem / buildOrdemPendenteRow', () => {
  assert.match(opnSrc, /function\s+buildBlocoFios\s*\(/);
  assert.match(opnSrc, /function\s+buildBlocoTecelagem\s*\(/);
  assert.match(opnSrc, /function\s+buildOrdemPendenteRow\s*\(/);
});

// -------------------------------------------------------------------------
// 3. Call-sites de módulos extraídos
// -------------------------------------------------------------------------

test('16. op-nova.js chama window.persistirOP', () => {
  assert.match(opnSrc, /window\.persistirOP\(/,
    'op-nova.js não referencia window.persistirOP');
});

test('17. op-nova.js chama window.aplicarRecalculoOP', () => {
  assert.match(opnSrc, /window\.aplicarRecalculoOP\(/,
    'op-nova.js não referencia window.aplicarRecalculoOP');
});

test('18. op-nova.js chama window.registrarRecebimentoOrdemFio', () => {
  assert.match(opnSrc, /window\.registrarRecebimentoOrdemFio\(/,
    'op-nova.js não referencia window.registrarRecebimentoOrdemFio');
});

test('19. op-nova.js chama window.atribuirFornecedorFioOp', () => {
  assert.match(opnSrc, /window\.atribuirFornecedorFioOp\(/,
    'op-nova.js não referencia window.atribuirFornecedorFioOp');
});

test('20. op-nova.js chama window.renderOPLatexAdmin', () => {
  assert.match(opnSrc, /window\.renderOPLatexAdmin\(/,
    'op-nova.js não referencia window.renderOPLatexAdmin');
});

test('21. op-nova.js chama window.maxMetrosItem / window.itensValidosOP', () => {
  assert.match(opnSrc, /window\.maxMetrosItem\(/,
    'op-nova.js não referencia window.maxMetrosItem');
  assert.match(opnSrc, /window\.itensValidosOP\(/,
    'op-nova.js não referencia window.itensValidosOP');
});

test('22. op-nova.js chama window.rotuloModelo / window.fmtKg / window.fmtMetros / disabledAttr (helper de op-form-helpers.js)', () => {
  // disabledAttr é chamado como bare (escopo do script) — verifica
  // que o nome está presente e corresponde ao helper de op-form-helpers.js
  assert.match(opnSrc, /\bdisabledAttr\(/,
    'op-nova.js não chama disabledAttr');
  assert.match(opnSrc, /window\.rotuloModelo\(/);
  assert.match(opnSrc, /window\.fmtKg\(/);
  assert.match(opnSrc, /window\.fmtMetros\(/);
});

// -------------------------------------------------------------------------
// 4. Sem regressão de writes
// -------------------------------------------------------------------------

test('23. op-nova.js NÃO contém writes Supabase (insert/update/delete) — todos foram extraídos', () => {
  // Writes foram extraídos para op-persistir.js / op-recalculo.js / op-writes.js.
  // screenNovaOP é read-only em supa (apenas .select).
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*insert\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().insert — write deveria ter sido extraído');
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*update\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().update — write deveria ter sido extraído');
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*delete\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().delete — write deveria ter sido extraído');
});

test('24. op-nova.js contém apenas reads (from().select) — nenhum write direto', () => {
  // Verifica que o módulo usa from().select() normalmente
  const reads = (opnSrc.match(/supa\.from\([^)]*\)\s*\.\s*select\s*\(/g) || []).length;
  assert.ok(reads >= 4,
    `op-nova.js deveria ter ao menos 4 reads (modelos, params, forns, clientes, ops, ordens, entregas, fornecedores). Encontrado: ${reads}`);
});

test('25. index.html NÃO contém mais implementação de persistirOP (helper já extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  // Deve ter window.persistirOP (call-site) mas NÃO async function persistir
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem async function persistir — write deveria ter sido extraído');
});

test('26. index.html NÃO contém mais implementação de aplicarRecalculoOP (helper já extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  // Verifica que NÃO há writes de saldo_fios_op / saldo_fios no inline
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios") como chamada Supabase');
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios_op") como chamada Supabase');
});

// -------------------------------------------------------------------------
// 5. setRoutes/main inline
// -------------------------------------------------------------------------

test('27. setRoutes e main foram extraídos para js/boot.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes e main saíram do inline
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('28. setRoutes referencia window.screenNovaOP(null) para #/ops/nova (em boot.js)', () => {
  const bootSrc = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');
  assert.match(bootSrc, /'#\/ops\/nova':\s*\{\s*render:\s*\(\)\s*=>\s*window\.screenNovaOP\(null\)/,
    'call-site de #/ops/nova em boot.js deve usar window.screenNovaOP(null)');
});

// -------------------------------------------------------------------------
// 6. Boot chain
// -------------------------------------------------------------------------

test('29. boot chain: todos os módulos + op-nova + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeOpNovaBootSandbox();

  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'boot com op-nova + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('30. window.screenNovaOP continua resolvível após o boot completo', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeOpNovaBootSandbox();
  let threw = false;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (!(e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message))) {
      threw = true;
    }
  }
  // window.screenNovaOP deve continuar sendo a função (não foi sobrescrita pelo inline)
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após boot completo');
  // Deve continuar apontando para RAVATEX_SCREENS.opNova.screenNovaOP
  const ref = vm.runInContext('window.RAVATEX_SCREENS.opNova.screenNovaOP === window.screenNovaOP', sandbox);
  assert.equal(ref, true,
    'window.screenNovaOP não é mais a referência de RAVATEX_SCREENS.opNova');
});
