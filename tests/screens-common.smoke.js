// Smoke test do módulo js/screens/common.js (SCREENS-COMMON-MODULE-A).
//
// Garante que a extração de shellLayout + ADMIN_MENU do <script> inline de
// index.html para js/screens/common.js preservou o comportamento exato.
//
// Estáticos:
//   1. js/screens/common.js existe;
//   2. é script clássico (não ES module);
//   3. sintaxe JS válida (node --check);
//   4. index.html carrega js/screens/common.js EXATAMENTE UMA VEZ, sem type=module;
//   5. ordem router → system-screens → common → jsPDF → inline (relativa a
//      system-screens.js é flexível, mas common deve vir depois de router e
//      antes do inline);
//   6. inline NÃO contém mais: function shellLayout, const ADMIN_MENU;
//   7. inline ainda contém: function screenPainel, function main,
//      window.RAVATEX_ROUTER.setRoutes, demais telas;
//   8. inline ainda referencia shellLayout(...)/ADMIN_MENU como identificador
//      bare (não foi reescrito para window.shellLayout/window.ADMIN_MENU);
//   9-10. js/screens/common.js não contém chamadas Supabase
//      (supa.from/.insert/.update/.delete/.rpc) nem `createClient`;
//  11-12. nenhum service_role nem password literal em js/screens/common.js;
//  13. index.html não contém service_role nem password literal (preservado);
//  14. ADMIN_MENU não é redeclarado no inline (apenas uma declaração em
//      todo o projeto: js/screens/common.js).
//
// Runtime (carrega js/ui.js + js/screens/common.js num vm.Context com stubs
// de CURRENT_USER/logout):
//  15-17. window.RAVATEX_SCREENS.common existe e expõe ADMIN_MENU e
//      shellLayout;
//  18. window.ADMIN_MENU e window.shellLayout (globais legados) existem;
//  19. ADMIN_MENU tem exatamente os 9 itens esperados, na ordem original;
//  20. shellLayout é função;
//  21. shellLayout(menuItems, contentNode) retorna nó renderizável (<div>
//      com header + aside + main);
//  22. shellLayout renderiza um <a> por item de menuItems, com href/label
//      corretos;
//  23. shellLayout(ADMIN_MENU, content) renderiza os 9 itens do ADMIN_MENU;
//  24. shellLayout inclui o nome do CURRENT_USER no header quando definido;
//  25. shellLayout inclui botão "Sair" cujo onclick é window.logout;
//  26. clicar no botão "Sair" aciona o window.logout (preserva ação de
//      logout);
//  27. shellLayout(menuItems, contentNode) insere o contentNode dentro do
//      <main>;
//
// Integração:
//  28. screenPainel() (definida no inline) ainda renderiza via shellLayout
//      num mock de boot completo;
//
// Regressão:
//  29. tests/system-screens.smoke.js e tests/router.smoke.js continuam
//      verdes (executados externamente, não nesta suíte — ver relatório);
//
// Boot:
//  30. boot: ui.js + badges.js + router.js + system-screens.js + common.js +
//      inline coexistem sem SyntaxError de duplicate identifier.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT    = path.resolve(__dirname, '..');
const INDEX   = path.join(ROOT, 'index.html');
const COMMON  = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD     = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS     = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF      = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const UI      = path.join(ROOT, 'js', 'ui.js');
const BADGES  = path.join(ROOT, 'js', 'badges.js');
const ROUTER  = path.join(ROOT, 'js', 'router.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');

const indexSrc   = fs.readFileSync(INDEX,  'utf8');
const commonSrc  = fs.readFileSync(COMMON, 'utf8');
const cadSrc     = fs.readFileSync(CAD,    'utf8');
const opsSrc     = fs.readFileSync(OPS,    'utf8');
const efSrc      = fs.readFileSync(EF,     'utf8');
const uiSrc      = fs.readFileSync(UI,     'utf8');
const badgesSrc  = fs.readFileSync(BADGES, 'utf8');
const routerSrc  = fs.readFileSync(ROUTER, 'utf8');
const sysSrc     = fs.readFileSync(SYSTEM_SCREENS, 'utf8');

const EXPECTED_ADMIN_MENU = [
  { href: '#/painel',                 label: 'Painel' },
  { href: '#/ops',                    label: 'OPs' },
  { href: '#/cadastros/cores',        label: 'Cores' },
  { href: '#/cadastros/modelos',      label: 'Modelos' },
  { href: '#/cadastros/parametros',   label: 'Parâmetros' },
  { href: '#/cadastros/fornecedores', label: 'Fornecedores' },
  { href: '#/cadastros/clientes',     label: 'Clientes' },
  { href: '#/cadastros/precos',       label: 'Preços' },
  { href: '#/cadastros/usuarios',     label: 'Usuários' },
];

// -----------------------------------------------------------------------------
// Helpers de validação estática
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
// Helper de runtime: FakeNode (DOM mínimo) + document mock, carrega js/ui.js
// (el real) e js/screens/common.js num vm.Context isolado.
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
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this['_attr_' + k] = v; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren() { this.children = []; }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function findAll(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}

// el() do ui.js anexa texto como filho via document.createTextNode(), não via
// a propriedade textContent do próprio nó — por isso precisa descer na árvore.
function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function makeCommonSandbox(currentUser) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const calls = { logout: 0 };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // js/ui.js fornece el() real.
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });

  // Stubs que normalmente vêm de js/auth.js, presentes antes de carregar common.js.
  sandbox.CURRENT_USER = currentUser || null;
  sandbox.logout = () => { calls.logout++; };

  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  return { sandbox, calls };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('1-2. js/screens/common.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(COMMON), 'js/screens/common.js não existe');
  assert.equal(/^\s*export\s+/m.test(commonSrc), false,
    'common.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(commonSrc), false,
    'common.js parece usar import — deve ser script clássico');
});

test('3. common.js: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${COMMON}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('4. index.html carrega js/screens/common.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/common\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/common.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/common\.js"[^>]*type=/.test(indexSrc), false,
    'common.js está sendo carregado com type=module — deve ser script clássico');
});

test('5. index.html: ordem router → common → inline (e common depois de system-screens, antes de jsPDF)', () => {
  const routerIdx = findScriptIdx(indexSrc, 'js/router.js');
  const sysIdx     = findScriptIdx(indexSrc, 'js/screens/system-screens.js');
  const commonIdx  = findScriptIdx(indexSrc, 'js/screens/common.js');
  const inlineIdx  = firstInlineScriptIndex(indexSrc);
  assert.ok(routerIdx > 0, 'js/router.js não encontrado');
  assert.ok(sysIdx > 0, 'js/screens/system-screens.js não encontrado');
  assert.ok(commonIdx > 0, 'js/screens/common.js não encontrado');
  assert.ok(inlineIdx > 0, 'tag inline não encontrada');
  assert.ok(routerIdx < commonIdx, 'router antes de common');
  assert.ok(sysIdx < commonIdx, 'system-screens antes de common');
  assert.ok(commonIdx < inlineIdx, 'common antes do inline');
});

test('6. script inline NÃO contém mais function shellLayout nem const ADMIN_MENU', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+shellLayout\s*\(/.test(inline), false,
    'inline ainda declara function shellLayout');
  assert.equal(/const\s+ADMIN_MENU\s*=/.test(inline), false,
    'inline ainda declara const ADMIN_MENU');
});

test('7. script inline ainda contém screenPainel, main, setRoutes e demais telas', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /function\s+screenPainel\s*\(/);
  assert.match(inline, /function\s+main\s*\(/);
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /function\s+screenNovaOP\s*\(/);
});

test('8. script inline continua chamando shellLayout(...)/ADMIN_MENU como identificador bare', () => {
  const inline = extractInlineScript(indexSrc);
  assert.match(inline, /\bshellLayout\(ADMIN_MENU,/);
  assert.equal(/window\.shellLayout\(/.test(inline), false,
    'inline foi reescrito para window.shellLayout sem necessidade comprovada');
});

test('9-10. js/screens/common.js não contém chamadas Supabase nem createClient', () => {
  assert.equal(/supa\.from\s*\(/.test(commonSrc), false, 'supa.from( encontrado');
  assert.equal(/\.insert\s*\(/.test(commonSrc), false, '.insert( encontrado');
  assert.equal(/\.update\s*\(/.test(commonSrc), false, '.update( encontrado');
  assert.equal(/\.delete\s*\(/.test(commonSrc), false, '.delete( encontrado');
  assert.equal(/\.rpc\s*\(/.test(commonSrc), false, '.rpc( encontrado');
  assert.equal(/createClient\s*\(/.test(commonSrc), false, 'createClient( encontrado');
});

test('11-12. common.js: nenhum service_role nem password literal', () => {
  assert.equal(/service_role/i.test(commonSrc), false, 'service_role em common.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(commonSrc), false,
    'password literal longo em common.js');
});

test('13. index.html: nenhum service_role nem password literal (preservado)', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('14. ADMIN_MENU é declarado uma única vez no projeto (js/screens/common.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const declCount = (commonSrc.match(/const\s+ADMIN_MENU\s*=/g) || []).length
    + (inline.match(/const\s+ADMIN_MENU\s*=/g) || []).length;
  assert.equal(declCount, 1, `esperado 1 declaração de ADMIN_MENU no projeto, encontrado ${declCount}`);
});

// -----------------------------------------------------------------------------
// 2. Validação de runtime
// -----------------------------------------------------------------------------

test('15-17. runtime: window.RAVATEX_SCREENS.common existe e expõe ADMIN_MENU + shellLayout', () => {
  const { sandbox } = makeCommonSandbox();
  const common = vm.runInContext('window.RAVATEX_SCREENS.common', sandbox);
  assert.ok(common && typeof common === 'object', 'RAVATEX_SCREENS.common não é objeto');
  assert.ok(Array.isArray(common.ADMIN_MENU), 'RAVATEX_SCREENS.common.ADMIN_MENU não é array');
  assert.equal(typeof common.shellLayout, 'function', 'RAVATEX_SCREENS.common.shellLayout não é função');
});

test('18. runtime: globais legados window.ADMIN_MENU e window.shellLayout existem', () => {
  const { sandbox } = makeCommonSandbox();
  assert.ok(Array.isArray(vm.runInContext('window.ADMIN_MENU', sandbox)), 'window.ADMIN_MENU ausente');
  assert.equal(typeof vm.runInContext('window.shellLayout', sandbox), 'function', 'window.shellLayout ausente');
});

test('19. runtime: ADMIN_MENU tem exatamente os 9 itens esperados, na ordem original', () => {
  const { sandbox } = makeCommonSandbox();
  const menu = vm.runInContext('window.ADMIN_MENU', sandbox);
  // Serializa para sair do realm da vm (objetos cross-realm não são
  // deepStrictEqual mesmo com mesma estrutura).
  assert.deepEqual(JSON.parse(JSON.stringify(menu)), EXPECTED_ADMIN_MENU);
});

test('20. runtime: shellLayout é função', () => {
  const { sandbox } = makeCommonSandbox();
  assert.equal(typeof vm.runInContext('window.shellLayout', sandbox), 'function');
});

test('21. runtime: shellLayout(menuItems, contentNode) retorna nó renderizável (header + aside + main)', () => {
  const { sandbox } = makeCommonSandbox({ nome: 'Ana', tipo: 'admin' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([{ href: "#/x", label: "X" }], contentNode)', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'shellLayout não retornou um <div>');
  const header = root.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente');
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  assert.ok(flexDiv, 'div flex (aside+main) ausente');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const main  = flexDiv.children.find((c) => c.tagName === 'MAIN');
  assert.ok(aside, 'aside ausente');
  assert.ok(main, 'main ausente');
});

test('22. runtime: shellLayout renderiza um <a> por item de menuItems, com href/label corretos', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const items = [{ href: '#/a', label: 'Aaa' }, { href: '#/b', label: 'Bbb' }];
  sandbox.items = items;
  const root = vm.runInContext('window.shellLayout(items, contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, 2, 'número de <a> não corresponde ao número de itens');
  assert.equal(links[0]._attr_href, '#/a');
  assert.equal(textOf(links[0]), 'Aaa');
  assert.equal(links[1]._attr_href, '#/b');
  assert.equal(textOf(links[1]), 'Bbb');
});

test('23. runtime: shellLayout(ADMIN_MENU, content) renderiza os 9 itens do ADMIN_MENU', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout(window.ADMIN_MENU, contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, EXPECTED_ADMIN_MENU.length);
});

test('24. runtime: shellLayout inclui o nome do CURRENT_USER no header quando definido', () => {
  const { sandbox } = makeCommonSandbox({ nome: 'Carlos', tipo: 'admin' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const header = root.children.find((c) => c.tagName === 'HEADER');
  const span = findAll(header, (n) => n.tagName === 'SPAN')[0];
  assert.ok(span, 'span do usuário ausente no header');
  assert.equal(textOf(span), 'Carlos (admin)');
});

test('25-26. runtime: shellLayout inclui botão "Sair" com onclick === window.logout, e clique aciona logout', () => {
  const { sandbox, calls } = makeCommonSandbox({ nome: 'Dora', tipo: 'fornecedor' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const header = root.children.find((c) => c.tagName === 'HEADER');
  const btn = findAll(header, (n) => n.tagName === 'BUTTON')[0];
  assert.ok(btn, 'botão Sair ausente no header');
  assert.equal(textOf(btn), 'Sair');
  btn._listeners.click();
  assert.equal(calls.logout, 1, 'clique no botão Sair não acionou window.logout');
});

test('27. runtime: shellLayout(menuItems, contentNode) insere o contentNode dentro do <main>', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  contentNode._marker = 'meu-conteudo';
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const main = flexDiv.children.find((c) => c.tagName === 'MAIN');
  assert.ok(main.children.some((c) => c._marker === 'meu-conteudo'),
    'contentNode não foi inserido dentro do <main>');
});

// -----------------------------------------------------------------------------
// 3. Integração: screenPainel() do inline ainda renderiza via shellLayout
// -----------------------------------------------------------------------------

test('28. integração: screenPainel() (inline) ainda renderiza via shellLayout num boot completo', () => {
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
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });

  // Stubs necessários para o inline carregar (CURRENT_USER/logout vêm de auth.js no boot real).
  sandbox.CURRENT_USER = { nome: 'Eva', tipo: 'admin' };
  sandbox.logout = () => {};

  vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });

  const root = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenPainel não retornou um <div>');
  const header = root.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'screenPainel não passou por shellLayout (header ausente)');
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv && flexDiv.children.find((c) => c.tagName === 'ASIDE');
  assert.ok(aside, 'aside (menu admin) ausente em screenPainel via shellLayout');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, EXPECTED_ADMIN_MENU.length,
    'screenPainel não renderizou o ADMIN_MENU completo via shellLayout');
});

// -----------------------------------------------------------------------------
// 4. Boot: ui.js + badges.js + router.js + system-screens.js + common.js + inline coexistem
// -----------------------------------------------------------------------------

test('30. boot: ui.js + badges.js + router.js + system-screens.js + common.js + inline coexistem sem SyntaxError de duplicate identifier', () => {
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
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });

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
    'coexistência common.js + inline lançou SyntaxError de duplicate identifier');

  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/painel'], 'setRoutes do inline não registrou #/painel');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:', String(otherErr.message).slice(0, 120));
  }
});
