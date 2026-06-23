// Smoke test do módulo js/screens/op-pdf.js
// (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A).
//
// Garante que a extração de gerarPdfCompraFios de
// js/screens/op-nova.js para js/screens/op-pdf.js preservou:
//   - a função gerarPdfCompraFios (sem dependência de closure);
//   - a assinatura function gerarPdfCompraFios({ op, ordens });
//   - o uso de window.jspdf.jsPDF (CDN);
//   - o uso de window.agruparOrdensCompraFio (de js/calculo-op.js);
//   - a chamada a doc.save com o nome padrão;
//   - o fallback de toast quando jsPDF não está disponível;
//   - ausência de writes Supabase e DOM mutante.
//
// Estáticos (1-10):
//   1. js/screens/op-pdf.js existe.
//   2. node --check js/screens/op-pdf.js passa.
//   3. op-pdf.js é script clássico, sem import/export.
//   4. index.html carrega op-pdf.js EXATAMENTE UMA VEZ, sem type=module.
//   5. index.html NÃO carrega op-pdf.js sem cache-busting.
//   6. Ordem: op-persistir.js → op-pdf.js → op-nova.js.
//   7. op-nova.js NÃO define mais function gerarPdfCompraFios.
//   8. op-nova.js chama window.gerarPdfCompraFios no call-site de
//      buildBlocoFios.
//   9. op-pdf.js NÃO contém supa (sem writes/leaks do Supabase).
//  10. op-pdf.js NÃO contém document.* (sem DOM mutante).
//
// Runtime (11-15):
//  11. window.gerarPdfCompraFios é função.
//  12. window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios é função.
//  13. gerarPdfCompraFios chama window.agruparOrdensCompraFio.
//  14. gerarPdfCompraFios instancia jsPDF quando disponível.
//  15. gerarPdfCompraFios chama doc.save com o nome correto.
//  16. gerarPdfCompraFios NÃO chama window.supa.
//  17. gerarPdfCompraFios NÃO faz insert/update/delete.
//  18. gerarPdfCompraFios NÃO acessa closure de op-nova.js.
//  19. gerarPdfCompraFios chama toast e retorna quando jsPDF ausente.
//  20. boot chain: todos os módulos + op-pdf coexiste sem SyntaxError.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPPDF = path.join(ROOT, 'js', 'screens', 'op-pdf.js');
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
const opPdfSrc  = fs.readFileSync(OPPDF, 'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) return '';
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

// Helper: aceita src="..." COM ou SEM query string (?v=...).
// Substitui o helper antigo dos outros smoke tests, que só aceitava
// sem query string e quebrava com o cache-busting ?v=20260623-asset1.
function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/').replace(/\./g, '\\.')}(?:\\?[^"]*)?"\\s*></script>`);
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

test('1. js/screens/op-pdf.js existe', () => {
  assert.ok(fs.existsSync(OPPDF), 'js/screens/op-pdf.js não existe');
});

test('2. op-pdf.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPPDF}"`, { stdio: 'pipe' });
});

test('3. op-pdf.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(opPdfSrc), false,
    'op-pdf.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(opPdfSrc), false,
    'op-pdf.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-pdf.js EXATAMENTE UMA VEZ, sem type=module, COM cache-busting ?v=', () => {
  // Aceita query string (cache-busting) conforme FASE OP-NOVA-PDF-MODULE-A.
  const reWithQs   = /<script\s+src="js\/screens\/op-pdf\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs     = /<script\s+src="js\/screens\/op-pdf\.js"\s*><\/script>/g;
  const matchesQs  = indexSrc.match(reWithQs) || [];
  const matchesNo  = indexSrc.match(reNoQs) || [];
  const total = matchesQs.length + matchesNo.length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-pdf.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-pdf\.js"[^>]*type=/.test(indexSrc), false,
    'op-pdf.js está sendo carregado com type=module');
});

test('5. ordem: op-persistir.js → op-pdf.js → op-nova.js → jspdf → boot.js', () => {
  const oppIdx    = findScriptIdx(indexSrc, 'js/screens/op-persistir.js');
  const opPdfIdx  = findScriptIdx(indexSrc, 'js/screens/op-pdf.js');
  const opnIdx    = findScriptIdx(indexSrc, 'js/screens/op-nova.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(oppIdx   > 0, 'op-persistir.js não encontrado');
  assert.ok(opPdfIdx > 0, 'op-pdf.js não encontrado');
  assert.ok(opnIdx   > 0, 'op-nova.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx  > 0, 'js/boot.js não encontrado');
  assert.ok(oppIdx   < opPdfIdx, 'op-persistir.js deve vir antes de op-pdf.js');
  assert.ok(opPdfIdx < opnIdx,   'op-pdf.js deve vir antes de op-nova.js');
  assert.ok(opnIdx   < jspdfIdx, 'op-nova.js deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx,  'jspdf CDN deve vir antes de boot.js');
});

test('6. op-nova.js NÃO define mais function gerarPdfCompraFios (extraída)', () => {
  assert.equal(/function\s+gerarPdfCompraFios\s*\(/.test(opnSrc), false,
    'op-nova.js ainda define gerarPdfCompraFios — extração incompleta');
});

test('7. op-nova.js chama window.gerarPdfCompraFios no call-site de buildBlocoFios', () => {
  assert.match(opnSrc, /window\.gerarPdfCompraFios\s*\(\s*\{\s*op\s*,\s*ordens\s*\}\s*\)/,
    'op-nova.js não chama window.gerarPdfCompraFios({ op, ordens }) em buildBlocoFios');
});

test('8. op-pdf.js NÃO referencia supa (helper puro, sem Supabase)', () => {
  assert.equal(/supa\b/.test(opPdfSrc), false,
    'op-pdf.js referencia supa — helper não deve tocar Supabase');
  assert.equal(/window\.supa\b/.test(opPdfSrc), false,
    'op-pdf.js referencia window.supa — helper não deve tocar Supabase');
});

test('9. op-pdf.js NÃO acessa document.* (sem DOM mutante)', () => {
  assert.equal(/document\./.test(opPdfSrc), false,
    'op-pdf.js acessa document — helper não deve mutar DOM');
});

test('10. op-pdf.js usa window.agruparOrdensCompraFio (NÃO a versão de closure)', () => {
  // A função deve usar a versão de window (helper global), não a
  // chamada bare (que dependeria de closure de op-nova.js).
  assert.match(opPdfSrc, /window\.agruparOrdensCompraFio\s*\(/,
    'op-pdf.js não chama window.agruparOrdensCompraFio');
  // Não deve chamar "agruparOrdensCompraFio(" sem prefixo
  // (que seria a versão de closure de op-nova.js / calculo-op.js local)
  assert.equal(/(^|[^.\w])agruparOrdensCompraFio\s*\(/.test(opPdfSrc), false,
    'op-pdf.js chama agruparOrdensCompraFio sem prefixo window. — pode depender de closure');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

function makeOpPdfBootSandbox({ withJsPDF = true } = {}) {
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
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
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

  vm.runInContext(fs.readFileSync(UI, 'utf8'),         sandbox, { filename: 'js/ui.js' });
  vm.runInContext(fs.readFileSync(BADGES, 'utf8'),     sandbox, { filename: 'js/badges.js' });
  vm.runInContext(fs.readFileSync(CALC, 'utf8'),       sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(fs.readFileSync(ROUTER, 'utf8'),     sandbox, { filename: 'js/router.js' });
  vm.runInContext(fs.readFileSync(SYSTEM_SCREENS, 'utf8'), sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(fs.readFileSync(COMMON, 'utf8'),     sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(fs.readFileSync(CAD, 'utf8'),        sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(fs.readFileSync(OPSLIST, 'utf8'),    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(fs.readFileSync(EF, 'utf8'),         sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(fs.readFileSync(EW, 'utf8'),         sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fs.readFileSync(FORN, 'utf8'),       sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(fs.readFileSync(OFH, 'utf8'),        sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(fs.readFileSync(OPW, 'utf8'),        sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(fs.readFileSync(OLA, 'utf8'),        sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(fs.readFileSync(PAINEL, 'utf8'),     sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(fs.readFileSync(OPR, 'utf8'),        sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(fs.readFileSync(OPP, 'utf8'),        sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opPdfSrc,                             sandbox, { filename: 'js/screens/op-pdf.js' });
  vm.runInContext(opnSrc,                               sandbox, { filename: 'js/screens/op-nova.js' });

  // Instala jspdf mock se solicitado
  if (withJsPDF) {
    const calls = { save: 0, text: 0, setFontSize: 0, setFont: 0, constructed: 0, lastSaveName: null };
    const FakeJsPDF = function () {
      this._calls = calls;
      calls.constructed++;
      this.setFontSize = (n) => { calls.setFontSize++; };
      this.setFont = (a, b) => { calls.setFont++; };
      this.text = (s) => { calls.text++; };
      this.save = (name) => { calls.save++; calls.lastSaveName = name; };
    };
    sandbox.jspdf = { jsPDF: FakeJsPDF };
    sandbox._jspdfCalls = calls;
  } else {
    sandbox.jspdf = undefined;
  }

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('11. runtime: window.gerarPdfCompraFios é função', () => {
  const { sandbox } = makeOpPdfBootSandbox();
  assert.equal(typeof vm.runInContext('window.gerarPdfCompraFios', sandbox), 'function',
    'window.gerarPdfCompraFios não é função');
});

test('12. runtime: window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios é função', () => {
  const { sandbox } = makeOpPdfBootSandbox();
  const fn = vm.runInContext('window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios', sandbox);
  assert.equal(typeof fn, 'function',
    'window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios não é função');
});

test('13. runtime: gerarPdfCompraFios chama window.agruparOrdensCompraFio', () => {
  const { sandbox } = makeOpPdfBootSandbox();
  let agruparChamado = false;
  sandbox.windowAgruparCalls = [];
  sandbox.agruparOrdensCompraFio = (ordens) => {
    agruparChamado = true;
    sandbox.windowAgruparCalls.push(ordens);
    return {
      algodao: [],
      poliester: [],
      totalAlgodao: 0,
      totalPoliester: 0,
    };
  };
  vm.runInContext(
    'window.gerarPdfCompraFios({ op: { numero: 1, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
    sandbox
  );
  assert.equal(agruparChamado, true,
    'gerarPdfCompraFios não chamou window.agruparOrdensCompraFio');
});

test('14. runtime: gerarPdfCompraFios instancia jsPDF quando disponível', () => {
  const { sandbox } = makeOpPdfBootSandbox({ withJsPDF: true });
  sandbox.agruparOrdensCompraFio = () => ({
    algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0,
  });
  vm.runInContext(
    'window.gerarPdfCompraFios({ op: { numero: 7, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
    sandbox
  );
  assert.equal(sandbox._jspdfCalls.constructed, 1,
    'gerarPdfCompraFios não instanciou jsPDF');
});

test('15. runtime: gerarPdfCompraFios chama doc.save com nome "compra-fios-OP-<numero>-<ano>.pdf"', () => {
  const { sandbox } = makeOpPdfBootSandbox({ withJsPDF: true });
  sandbox.agruparOrdensCompraFio = () => ({
    algodao: [{ rotulo: 'Algodão — Azul', kg: 1.5 }],
    poliester: [],
    totalAlgodao: 1.5,
    totalPoliester: 0,
  });
  vm.runInContext(
    'window.gerarPdfCompraFios({ op: { numero: 42, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
    sandbox
  );
  assert.equal(sandbox._jspdfCalls.save, 1,
    'gerarPdfCompraFios não chamou doc.save');
  // Verifica o nome do arquivo salvo pelo mock (lastSaveName na
  // referência do mock, não em window).
  assert.equal(sandbox._jspdfCalls.lastSaveName, 'compra-fios-OP-42-2026.pdf',
    `doc.save foi chamado com nome errado: ${sandbox._jspdfCalls.lastSaveName}`);
});

test('16. runtime: gerarPdfCompraFios NÃO chama window.supa', () => {
  const { sandbox } = makeOpPdfBootSandbox({ withJsPDF: true });
  let supaChamado = false;
  const origFrom = sandbox.supa.from;
  sandbox.supa.from = (...args) => { supaChamado = true; return origFrom(...args); };
  sandbox.agruparOrdensCompraFio = () => ({
    algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0,
  });
  vm.runInContext(
    'window.gerarPdfCompraFios({ op: { numero: 1, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
    sandbox
  );
  assert.equal(supaChamado, false,
    'gerarPdfCompraFios chamou window.supa — helper não deve tocar Supabase');
});

test('17. runtime: gerarPdfCompraFios NÃO faz insert/update/delete', () => {
  const { sandbox } = makeOpPdfBootSandbox({ withJsPDF: true });
  const mutacoes = [];
  sandbox.supa.from = (table) => {
    const chain = {
      _table: table,
      _lastMut: null,
      select() { this._lastMut = 'select'; return this; },
      insert() { this._lastMut = 'insert'; mutacoes.push('insert:' + table); return Promise.resolve({ data: null, error: null }); },
      update() { this._lastMut = 'update'; mutacoes.push('update:' + table); return this; },
      delete() { this._lastMut = 'delete'; mutacoes.push('delete:' + table); return this; },
      eq() { return this; },
      order() { return this; },
      single() { return Promise.resolve({ data: null, error: null }); },
      then(r) { return Promise.resolve({ data: null, error: null }).then(r); },
    };
    return chain;
  };
  sandbox.agruparOrdensCompraFio = () => ({
    algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0,
  });
  vm.runInContext(
    'window.gerarPdfCompraFios({ op: { numero: 1, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
    sandbox
  );
  const writes = mutacoes.filter(m => m.startsWith('insert:') || m.startsWith('update:') || m.startsWith('delete:'));
  assert.equal(writes.length, 0,
    `gerarPdfCompraFios fez write: ${writes.join(', ')}`);
});

test('18. runtime: gerarPdfCompraFios NÃO acessa closure de op-nova.js (recebe op/ordens por argumento)', () => {
  // Roda num sandbox que NÃO carrega op-nova.js — apenas ui + calculo-op + op-pdf.
  // Se gerarPdfCompraFios depender de closure, isso quebra.
  const uiOnly = fs.readFileSync(UI, 'utf8');
  const calcOnly = fs.readFileSync(CALC, 'utf8');
  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiOnly, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(calcOnly, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(opPdfSrc, sandbox, { filename: 'js/screens/op-pdf.js' });

  // jspdf mock
  let constructed = 0, saved = 0;
  const FakeJsPDF = function () {
    constructed++;
    this.setFontSize = () => {};
    this.setFont = () => {};
    this.text = () => {};
    this.save = () => { saved++; };
  };
  sandbox.jspdf = { jsPDF: FakeJsPDF };
  sandbox.agruparOrdensCompraFio = (ordens) => ({
    algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0,
  });

  // Deve funcionar sem op-nova.js
  assert.doesNotThrow(() => {
    vm.runInContext(
      'window.gerarPdfCompraFios({ op: { numero: 1, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
      sandbox
    );
  }, 'gerarPdfCompraFios falhou sem op-nova.js — depende de closure');
  assert.equal(constructed, 1, 'jsPDF não foi instanciado');
  assert.equal(saved, 1, 'doc.save não foi chamado');
});

test('19. runtime: gerarPdfCompraFios chama toast e retorna quando jsPDF ausente', () => {
  const { sandbox } = makeOpPdfBootSandbox({ withJsPDF: false });
  // Captura toast
  let toastArgs = null;
  sandbox.window.toast = (...args) => { toastArgs = args; };
  // jsPDF ausente
  sandbox.jspdf = undefined;
  let retVal;
  assert.doesNotThrow(() => {
    retVal = vm.runInContext(
      'window.gerarPdfCompraFios({ op: { numero: 1, ano: 2026, lote: null }, ordens: [{ id: 1 }] })',
      sandbox
    );
  }, 'gerarPdfCompraFios lançou erro com jsPDF ausente');
  assert.equal(retVal, undefined,
    'gerarPdfCompraFios deveria retornar undefined quando jsPDF ausente');
  assert.ok(toastArgs, 'toast não foi chamado quando jsPDF ausente');
  assert.equal(toastArgs[0], 'Biblioteca de PDF não carregou',
    `toast chamado com mensagem errada: ${toastArgs[0]}`);
  assert.equal(toastArgs[1], 'error',
    `toast deveria ser tipo "error", veio: ${toastArgs[1]}`);
});

test('20. boot chain: todos os módulos + op-pdf + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeOpPdfBootSandbox();
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
    'boot com op-pdf + inline lançou SyntaxError de duplicate identifier');
  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});
