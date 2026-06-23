// Smoke test do módulo js/screens/op-form-helpers.js
// (OP-FORM-HELPERS-MODULE-A).
//
// Garante que a extração dos helpers puros de screenNovaOP
// (rotuloModelo, fmtKg, fmtMetros, disabledAttr) e a unificação
// de rotuloFioOrdem -> rotuloFio do <script> inline de index.html
// para js/screens/op-form-helpers.js preservou o comportamento
// exato. As funções extraídas são puras (sem DOM, sem Supabase,
// sem regra de negócio), mas disabledAttr manipula DOM.
//
// Estáticos:
//   1. js/screens/op-form-helpers.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega op-form-helpers.js exatamente 1 vez;
//   4. ordem: fornecedor.js → op-form-helpers.js → jspdf → inline;
//   5. inline NÃO contém mais: function rotuloFioOrdem,
//      function rotuloModelo, function fmtKg, function fmtMetros,
//      function disabledAttr;
//   6. inline AINDA contém: screenNovaOP, renderOPLatexAdmin,
//      persistir, aplicarRecalculo, buildOrdemPendenteRow;
//   7. namespace: window.RAVATEX_SCREENS.opFormHelpers expõe 4 keys;
//   8. window.rotuloModelo, window.fmtKg, window.fmtMetros,
//      window.disabledAttr são funções;
//   9. window.rotuloFio continua vindo de entrega-form.js;
//  10. index.html inline chama window.rotuloFio (não mais
//      rotuloFioOrdem);
//  11. index.html inline chama window.rotuloModelo (não mais
//      rotuloModelo local);
//  12. index.html inline chama window.fmtKg / window.fmtMetros /
//      disabledAttr(readOnly, ...);
//  13. ordens_compra_fio update continua inline (em
//      buildOrdemPendenteRow);
//
// Runtime:
//  14. rotuloModelo com null → '?';
//  15. rotuloModelo com modelo completo → label formatado;
//  16. fmtKg null → '—';
//  17. fmtKg 1.234567 → '1,235 kg';
//  18. fmtMetros 1.234567 → '1,23 m';
//  19. disabledAttr com disabled=true → setAttribute('disabled');
//  20. disabledAttr com disabled=false → NÃO setAttribute;
//  21. Boot: ui + calculo-op + entrega-form + op-form-helpers +
//      inline coexistem sem SyntaxError;
//  22. screenNovaOP ainda é função e chamável;
//  23. renderOPLatexAdmin resolve window.rotuloModelo.
//
// Regressão:
//  24. screenPainel ainda renderiza via shellLayout com 9 itens
//      do ADMIN_MENU (regressão common);
//  25. screenCadastrosCores ainda renderiza (regressão cadastros);
//  26. screenListaOPs ainda renderiza (regressão ops-list).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const OFH    = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPS,   'utf8');
const ewSrc     = fs.readFileSync(EW,    'utf8');
const fornSrc   = fs.readFileSync(FORN,  'utf8');

// -----------------------------------------------------------------------------
// Helpers estáticos
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
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

// -----------------------------------------------------------------------------
// FakeNode para disabledAttr
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/op-form-helpers.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(OFH), 'js/screens/op-form-helpers.js não existe');
  assert.equal(/^\s*export\s+/m.test(ofhSrc), false,
    'op-form-helpers.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(ofhSrc), false,
    'op-form-helpers.js parece usar import — deve ser script clássico');
});

test('2. op-form-helpers.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OFH}"`, { stdio: 'pipe' });
});

test('3. index.html carrega op-form-helpers.js exatamente 1 vez, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/op-form-helpers\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-form-helpers.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-form-helpers\.js"[^>]*type=/.test(indexSrc), false,
    'op-form-helpers.js está sendo carregado com type=module');
});

test('4. index.html: ordem fornecedor.js → op-form-helpers.js → jspdf → inline', () => {
  const fornIdx  = findScriptIdx(indexSrc, 'js/screens/fornecedor.js');
  const ofhIdx   = findScriptIdx(indexSrc, 'js/screens/op-form-helpers.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(fornIdx > 0, 'fornecedor.js não encontrado');
  assert.ok(ofhIdx > 0, 'op-form-helpers.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(fornIdx < ofhIdx, 'fornecedor deve vir antes de op-form-helpers');
  assert.ok(ofhIdx < jspdfIdx, 'op-form-helpers deve vir antes de jspdf');
  assert.ok(ofhIdx < inlineIdx, 'op-form-helpers deve vir antes do inline');
});

test('5. script inline NÃO contém mais function rotuloFioOrdem', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+rotuloFioOrdem\s*\(/.test(inline), false,
    'inline ainda declara function rotuloFioOrdem');
});

test('6. script inline NÃO contém mais function rotuloModelo', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+rotuloModelo\s*\(/.test(inline), false,
    'inline ainda declara function rotuloModelo');
});

test('7. script inline NÃO contém mais function fmtKg', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+fmtKg\s*\(/.test(inline), false,
    'inline ainda declara function fmtKg');
});

test('8. script inline NÃO contém mais function fmtMetros', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+fmtMetros\s*\(/.test(inline), false,
    'inline ainda declara function fmtMetros');
});

test('9. script inline NÃO contém mais function disabledAttr', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+disabledAttr\s*\(/.test(inline), false,
    'inline ainda declara function disabledAttr');
});

test('10. script inline AINDA contém screenNovaOP, persistir, aplicarRecalculo, buildOrdemPendenteRow (renderOPLatexAdmin extraído para op-latex-admin.js)', () => {
  const inline = extractInlineScript(indexSrc);
  for (const fn of [
    'screenNovaOP',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  assert.equal(/function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline não deve mais declarar renderOPLatexAdmin (extraído para op-latex-admin.js)');
  for (const fn of [
    'persistir', 'aplicarRecalculo', 'buildOrdemPendenteRow',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
});

test('11. inline usa window.rotuloFio (não mais rotuloFioOrdem local)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.ok(inline.includes('window.rotuloFio(') || inline.includes('window.rotuloFio'),
    'inline não referencia window.rotuloFio');
  assert.equal(/rotuloFioOrdem/.test(inline), false,
    'inline ainda referencia rotuloFioOrdem (não window.rotuloFio)');
});

test('12. inline usa window.rotuloModelo nos call-sites de screenNovaOP e renderOPLatexAdmin', () => {
  const inline = extractInlineScript(indexSrc);
  const count = (inline.match(/window\.rotuloModelo\(/g) || []).length;
  assert.ok(count >= 4, `esperado >= 4 chamadas a window.rotuloModelo, encontrado ${count}`);
});

test('13. inline usa window.fmtKg e window.fmtMetros e disabledAttr(readOnly, ...)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.ok((inline.match(/window\.fmtKg\(/g) || []).length >= 1,
    'inline não referencia window.fmtKg');
  assert.ok((inline.match(/window\.fmtMetros\(/g) || []).length >= 1,
    'inline não referencia window.fmtMetros');
  assert.ok((inline.match(/disabledAttr\(readOnly,\s*/g) || []).length >= 1,
    'inline não referencia disabledAttr(readOnly, ...');
});

test('14. ordens_compra_fio persistente com update inline permanece no inline', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /supa\.from\(['"`]ordens_compra_fio['"`]\)/,
    'inline perdeu supa.from("ordens_compra_fio")');
  assert.match(inline, /\.update\(/,
    'inline perdeu .update() — buildOrdemPendenteRow deveria ter update inline');
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

function makeOpFormSandbox() {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });

  return sandbox;
}

test('15. runtime: window.RAVATEX_SCREENS.opFormHelpers existe com 4 keys', () => {
  const sandbox = makeOpFormSandbox();
  const ns = vm.runInContext('window.RAVATEX_SCREENS.opFormHelpers', sandbox);
  assert.ok(ns, 'window.RAVATEX_SCREENS.opFormHelpers não existe');
  for (const k of ['rotuloModelo', 'fmtKg', 'fmtMetros', 'disabledAttr']) {
    assert.equal(typeof ns[k], 'function', `RAVATEX_SCREENS.opFormHelpers.${k} não é função`);
  }
});

test('16. runtime: window.rotuloModelo é função', () => {
  const sandbox = makeOpFormSandbox();
  assert.equal(typeof vm.runInContext('window.rotuloModelo', sandbox), 'function');
});

test('17. runtime: window.fmtKg é função', () => {
  const sandbox = makeOpFormSandbox();
  assert.equal(typeof vm.runInContext('window.fmtKg', sandbox), 'function');
});

test('18. runtime: window.fmtMetros é função', () => {
  const sandbox = makeOpFormSandbox();
  assert.equal(typeof vm.runInContext('window.fmtMetros', sandbox), 'function');
});

test('19. runtime: window.disabledAttr é função', () => {
  const sandbox = makeOpFormSandbox();
  assert.equal(typeof vm.runInContext('window.disabledAttr', sandbox), 'function');
});

test('20. runtime: window.rotuloFio continua vindo de entrega-form.js', () => {
  const sandbox = makeOpFormSandbox();
  assert.equal(typeof vm.runInContext('window.rotuloFio', sandbox), 'function',
    'window.rotuloFio não é função (entrega-form.js deveria exportá-lo)');
});

// --- rotuloModelo ---

test('21. runtime: rotuloModelo com null → retorna "?"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.rotuloModelo(null)', sandbox);
  assert.equal(result, '?');
});

test('22. runtime: rotuloModelo com modelo completo → label formatado', () => {
  const sandbox = makeOpFormSandbox();
  const modelo = {
    nome: 'Conforto',
    largura: 1.40,
    cor_1: { nome: 'BRANCO' },
    cor_2: { nome: 'PRETO' },
  };
  sandbox._m = modelo;
  const result = vm.runInContext('window.rotuloModelo(window._m)', sandbox);
  assert.equal(result, 'Conforto 1.40m · BRANCO/PRETO');
});

test('23. runtime: rotuloModelo com modelo sem cor_2.nome → fallback "?"', () => {
  const sandbox = makeOpFormSandbox();
  const modelo = {
    nome: 'Simples',
    largura: 2.10,
    cor_1: { nome: 'VERMELHO' },
    cor_2: null,
  };
  sandbox._m = modelo;
  const result = vm.runInContext('window.rotuloModelo(window._m)', sandbox);
  assert.equal(result, 'Simples 2.10m · VERMELHO/?');
});

// --- fmtKg ---

test('24. runtime: fmtKg com null → retorna "—"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtKg(null)', sandbox);
  assert.equal(result, '—');
});

test('25. runtime: fmtKg com 0 → retorna "0,000 kg"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtKg(0)', sandbox);
  assert.equal(result, '0,000 kg');
});

test('26. runtime: fmtKg com 1.234567 → retorna "1,235 kg"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtKg(1.234567)', sandbox);
  assert.equal(result, '1,235 kg');
});

test('27. runtime: fmtKg com undefined → retorna "—"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtKg(undefined)', sandbox);
  assert.equal(result, '—');
});

// --- fmtMetros ---

test('28. runtime: fmtMetros com 0 → retorna "0,00 m"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtMetros(0)', sandbox);
  assert.equal(result, '0,00 m');
});

test('29. runtime: fmtMetros com 1.234567 → retorna "1,23 m"', () => {
  const sandbox = makeOpFormSandbox();
  const result = vm.runInContext('window.fmtMetros(1.234567)', sandbox);
  assert.equal(result, '1,23 m');
});

// --- disabledAttr ---

test('30. runtime: disabledAttr com disabled=true → setAttribute("disabled", "disabled")', () => {
  const sandbox = makeOpFormSandbox();
  const node = vm.runInContext('window.disabledAttr(true, new Node("button"))', sandbox);
  assert.equal(node._attrs.disabled, 'disabled', 'disabled=true deveria setar disabled');
});

test('31. runtime: disabledAttr com disabled=false → NÃO setAttribute disabled', () => {
  const sandbox = makeOpFormSandbox();
  const node = vm.runInContext('window.disabledAttr(false, new Node("button"))', sandbox);
  assert.equal(node._attrs.disabled, undefined, 'disabled=false NÃO deveria setar disabled');
});

// -----------------------------------------------------------------------------
// 3. Integração: boot completo
// -----------------------------------------------------------------------------

test('32. boot: ui + calculo-op + entrega-form + op-form-helpers + inline coexistem sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
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
    from: (t) => {
      const chain = {
        _table: t,
        select() { return chain; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        update() { return Promise.resolve({ data: null, error: null }); },
        delete() { return chain; },
        eq() { return Promise.resolve({ data: null, error: null }); },
        order() { return chain; },
        in() { return chain; },
        then(r) { return Promise.resolve({ data: null, error: null }).then(r); },
      };
      return chain;
    },
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
    location: { hash: '' },
    supa: fakeSupa,
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

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

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
    'boot com op-form-helpers + inline lançou SyntaxError de duplicate identifier');

  // Valida rotas
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'rota #/login não registrada');
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');
  assert.ok(routes && routes['#/fornecedor/home'], 'rota #/fornecedor/home não registrada');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('33. runtime: screenNovaOP ainda é função e acessível via window', () => {
  const inline = extractInlineScript(indexSrc);
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
      select() { return this; }, order() { return this; }, eq() { return this; },
      then(r) { return Promise.resolve({ data: [], error: null }).then(r); },
    }),
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (!(e instanceof SyntaxError && /already been declared/.test(e.message))) {
      console.log('(esperado) inline runtime err:', e.message.slice(0, 80));
    }
  }
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função');
});

// -----------------------------------------------------------------------------
// 4. Regressão
// -----------------------------------------------------------------------------

test('34. screenPainel (inline) ainda renderiza via shellLayout com 9 itens do ADMIN_MENU (regressão common)', () => {
  const inline = extractInlineScript(indexSrc);
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = { from: () => ({ select() { return this; }, order() { return this; }, then(r) { return Promise.resolve({ data: [], error: null }).then(r); } }) };
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared/.test(e.message)) {
      throw new Error('duplicate-identifier SyntaxError no boot: ' + e.message);
    }
  }
  const root = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenPainel não devolveu <div>');
  const flex = root.children.find((c) => c.tagName === 'DIV');
  const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
  const links = aside && aside.children.filter((c) => c.tagName === 'A');
  assert.ok(links && links.length === 9,
    `screenPainel não renderizou 9 itens do ADMIN_MENU (renderizou ${links ? links.length : 0})`);
});

test('35. screenCadastrosCores (cadastros) ainda renderiza (regressão cadastros)', async () => {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = { from: () => ({ select() { return this; }, order() { return this; }, then(r) { return Promise.resolve({ data: [{ id: 1, nome: 'VERMELHO' }], error: null }).then(r); } }) };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode, supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  const node = await vm.runInContext('window.screenCadastrosCores()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenCadastrosCores não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenCadastrosCores');
});

test('36. screenListaOPs (ops-list) ainda renderiza (regressão ops-list)', async () => {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = { from: () => ({ select() { return this; }, order() { return this; }, then(r) { return Promise.resolve({ data: [], error: null }).then(r); } }) };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode, supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(ofhSrc,    sandbox, { filename: 'js/screens/op-form-helpers.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = () => {};
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenListaOPs não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenListaOPs');
});
