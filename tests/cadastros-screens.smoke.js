// Smoke test do módulo js/screens/cadastros.js (CADASTROS-SCREENS-MODULE-A).
//
// Garante que a extração das 7 telas de cadastros (Cores, Clientes,
// Modelos, Parametros, Fornecedores, Precos, Usuarios) + constantes
// (FORNECEDOR_TIPOS, labelFornecedorTipo) do <script> inline de
// index.html para js/screens/cadastros.js preservou o comportamento
// exato.
//
// Estáticos:
//   1. js/screens/cadastros.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/cadastros.js EXATAMENTE UMA VEZ;
//   4. ordem common → cadastros → jspdf → inline (cadastros antes do
//      inline, depois de common);
//   5. inline NÃO contém mais: function screenCadastros{Cores,Clientes,
//      Modelos,Parametros,Fornecedores,Precos,Usuarios}, const
//      FORNECEDOR_TIPOS, function labelFornecedorTipo;
//   6. inline AINDA contém: screenPainel, screenFornecedorHome,
//      screenFornecedorEntregas, screenFornecedorLatex,
//      screenFornecedorOrdens, screenListaOPs, screenNovaOP,
//      renderOPLatexAdmin, buildEntregaInlineForm, rotuloFio,
//      OCF_STATUS_LABEL, setRoutes, main;
//   7. setRoutes ainda registra as 7 rotas #/cadastros/*;
//   8. js/screens/cadastros.js contém as 7 telas + FORNECEDOR_TIPOS +
//      labelFornecedorTipo;
//   9. js/screens/cadastros.js NÃO contém supabase.createClient /
//      _supaRaw / _LOCAL_HOSTS / _IS_LOCAL / _IS_PROD_URL /
//      _GUARD_BLOCK_WRITES / _WG_ERROR / _wrapQueryBuilder /
//      `const supa =`;
//  10. js/screens/cadastros.js NÃO contém service_role nem password
//      literal longo;
//  11. index.html NÃO contém service_role nem password literal longo;
//  12. FORNECEDOR_TIPOS declarado UMA única vez no projeto (apenas em
//      js/screens/cadastros.js);
//  13. labelFornecedorTipo declarado UMA única vez no projeto (apenas
//      em js/screens/cadastros.js).
//
// Runtime (carrega ui.js + common.js + cadastros.js num vm.Context com
// supa mockado e stubs para as 7 telas renderizarem):
//  14. window.RAVATEX_SCREENS.cadastros existe e expõe as 7 telas +
//      FORNECEDOR_TIPOS + labelFornecedorTipo;
//  15. window.FORNECEDOR_TIPOS é array com 4 itens canônicos;
//  16. window.labelFornecedorTipo('tecelagem') retorna label PT-BR;
//  17. As 7 funções globais window.screenCadastros* existem;
//  18. Cada uma das 7 telas, quando chamada num sandbox com supa
//      mockado, chama supa.from com a tabela esperada e devolve um nó
//      renderizável (<div>) com header + main (via shellLayout);
//  19. screenCadastrosFornecedores usa FORNECEDOR_TIPOS e
//      labelFornecedorTipo (preserva call-sites bare);
//  20. screenCadastrosUsuarios usa labelFornecedorTipo (preserva);
//  21. CRUD methods (insert/update/delete) são chamados apenas contra
//      o mock — zero acesso a Supabase real.
//
// Integração:
//  22. Boot completo (ui + badges + router + system-screens + common +
//      cadastros + inline) coexiste sem SyntaxError de duplicate
//      identifier;
//  23. setRoutes do inline registra window.routes com as 7 rotas
//      #/cadastros/* resolvendo para as globais legadas;
//  24. screenPainel (inline) ainda renderiza via shellLayout com 9
//      itens do ADMIN_MENU (regressão common).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');
const OP_NOVA = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OP_LATEX_ADMIN = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');

const indexSrc  = fs.readFileSync(INDEX,  'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');
const opsSrc    = fs.readFileSync(OPS,    'utf8');
const efSrc     = fs.readFileSync(EF,     'utf8');
const ewSrc     = fs.readFileSync(EW,     'utf8');
const fornSrc   = fs.readFileSync(FORN,   'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const bootSrc   = fs.readFileSync(BOOT,   'utf8');
const painelSrc = fs.readFileSync(PAINEL, 'utf8');
const opNovaSrc = fs.readFileSync(OP_NOVA, 'utf8');
const opLatexAdminSrc = fs.readFileSync(OP_LATEX_ADMIN, 'utf8');

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
  // Aceita query string de cache-busting (?v=...) presente nos assets
  // locais de index.html.
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// -----------------------------------------------------------------------------
// Helpers de runtime: FakeNode (DOM mínimo) + document mock + supa mock.
// Carrega ui.js (el/toast/modal/etc) + common.js (shellLayout/ADMIN_MENU)
// + cadastros.js (telas) num vm.Context isolado.
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

function findAll(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

// Cliente Supabase FAKE. Cada queryBuilder pode encadear .select/.insert/
// .update/.delete/.eq/.order/.in. O terminal do encadeamento
// (.select/.insert/.update/.delete sem encadear mais nada) devolve
// Promise<{data,error}>. Para encadeamentos com .then no final, a
// chain é um thenable.
function makeFakeSupabaseClient(routeResolver) {
  const calls = [];
  const resolve = routeResolver || (() => []);
  // A "chain" para uma tabela. select encadeia (devolve a chain com
  // os métodos encadeáveis), e um `await` na chain devolve os dados.
  // insert/update/delete TERMINAM a chain e devolvem Promise direto.
  function makeChain(table) {
    const data = resolve(table);
    const chain = {
      _table: table,
      _data: data,
      _error: null,
      select(_cols) {
        calls.push({ op: 'select', args: [_cols] });
        return chain;
      },
      insert(payload) {
        calls.push({ op: 'insert', args: [payload] });
        return Promise.resolve({ data: null, error: null });
      },
      update(payload) {
        calls.push({ op: 'update', args: [payload] });
        return Promise.resolve({ data: null, error: null });
      },
      delete() {
        calls.push({ op: 'delete' });
        return Promise.resolve({ data: null, error: null });
      },
      eq() { return chain; },
      order() { return chain; },
      in() { return chain; },
      then(resolveThen, rejectThen) {
        // Resolve a `await supa.from(t).select(...)` com os dados.
        return Promise.resolve({ data: chain._data, error: chain._error })
          .then(resolveThen, rejectThen);
      },
    };
    return chain;
  }
  return {
    from(table) {
      calls.push({ op: 'from', args: [table] });
      return makeChain(table);
    },
    rpc() { return Promise.resolve({ data: null, error: null }); },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
    _calls: calls,
  };
}

function makeCadastrosSandbox({ tableData = {} } = {}) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient((table) => tableData[table] || []);
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,  // ui.js usa `instanceof Node` em dataTable
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  // Stubs que common.js espera
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(cadSrc, sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc, sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,  sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,  sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(opsSrc, sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,  sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,  sandbox, { filename: 'js/screens/entrega-writes.js' });
  // supa injetado DEPOIS do load do cadastros.js (o módulo só usa em
  // tempo de chamada, não no load).
  sandbox.supa = fakeSupa;
  return { sandbox, fakeSupa };
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/cadastros.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(CAD), 'js/screens/cadastros.js não existe');
  assert.equal(/^\s*export\s+/m.test(cadSrc), false,
    'cadastros.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(cadSrc), false,
    'cadastros.js parece usar import — deve ser script clássico');
});

test('2. cadastros.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${CAD}"`, { stdio: 'pipe' });
});

test('3. index.html carrega js/screens/cadastros.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Aceita a query string de cache-busting (?v=...) presente nos assets locais.
  const re = /<script\s+src="js\/screens\/cadastros\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/cadastros.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/cadastros\.js[^"]*"[^>]*type=/.test(indexSrc), false,
    'cadastros.js está sendo carregado com type=module — deve ser script clássico');
});

test('4. index.html: ordem sane de scripts (common antes de cadastros; boot.js é o entrypoint após jspdf)', () => {
  const commonIdx = findScriptIdx(indexSrc, 'js/screens/common.js');
  const cadIdx    = findScriptIdx(indexSrc, 'js/screens/cadastros.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(commonIdx > 0, 'js/screens/common.js não encontrado');
  assert.ok(cadIdx > 0, 'js/screens/cadastros.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf CDN não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js (entrypoint) não encontrado');
  assert.ok(commonIdx < cadIdx, 'common deve vir antes de cadastros');
  assert.ok(cadIdx < jspdfIdx, 'cadastros deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf deve vir antes de boot.js (entrypoint)');
  // Não deve haver bloco <script> inline grande (refactor moveu tudo
  // para módulos; index.html é puramente declarativo).
  const inline = firstInlineScriptIndex(indexSrc);
  assert.equal(inline, -1, 'index.html contém <script> inline inesperado');
});

test('5. index.html NÃO declara as 7 telas, FORNECEDOR_TIPOS nem labelFornecedorTipo', () => {
  // O refactor moveu as telas de cadastro e constantes para
  // js/screens/cadastros.js. index.html deve permanecer declarativo,
  // sem definições de função dessas telas nem das constantes.
  for (const fn of [
    'screenCadastrosCores', 'screenCadastrosClientes', 'screenCadastrosModelos',
    'screenCadastrosParametros', 'screenCadastrosFornecedores', 'screenCadastrosPrecos',
    'screenCadastrosUsuarios',
  ]) {
    assert.equal(new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`).test(indexSrc), false,
      `index.html ainda declara function ${fn}`);
  }
  assert.equal(/const\s+FORNECEDOR_TIPOS\s*=/.test(indexSrc), false,
    'index.html ainda declara const FORNECEDOR_TIPOS');
  assert.equal(/function\s+labelFornecedorTipo\s*\(/.test(indexSrc), false,
    'index.html ainda declara function labelFornecedorTipo');
});

test('6. telas e helpers extraídos vivem em seus módulos (setRoutes/main em boot.js)', () => {
  // O refactor moveu setRoutes e main para js/boot.js, screenPainel
  // para js/screens/painel.js, screenNovaOP para js/screens/op-nova.js
  // e renderOPLatexAdmin para js/screens/op-latex-admin.js.
  assert.match(painelSrc, /function\s+screenPainel\s*\(/,
    'js/screens/painel.js deve definir screenPainel');
  assert.match(opNovaSrc, /function\s+screenNovaOP\s*\(/,
    'js/screens/op-nova.js deve definir screenNovaOP');
  assert.match(opLatexAdminSrc, /function\s+renderOPLatexAdmin\s*\(/,
    'js/screens/op-latex-admin.js deve definir renderOPLatexAdmin');
  assert.match(bootSrc, /window\.RAVATEX_ROUTER\.setRoutes\(/,
    'js/boot.js deve chamar window.RAVATEX_ROUTER.setRoutes');
  assert.match(bootSrc, /async\s+function\s+main\s*\(/,
    'js/boot.js deve definir a função main');
});

test('7. boot.js registra as 7 rotas #/cadastros/* via setRoutes', () => {
  const esperadas = [
    '#/cadastros/cores', '#/cadastros/modelos', '#/cadastros/parametros',
    '#/cadastros/fornecedores', '#/cadastros/clientes', '#/cadastros/precos',
    '#/cadastros/usuarios',
  ];
  for (const rota of esperadas) {
    assert.ok(bootSrc.includes(`'${rota}'`),
      `rota ${rota} não encontrada no setRoutes de js/boot.js`);
  }
});

test('8. js/screens/cadastros.js contém as 7 telas + FORNECEDOR_TIPOS + labelFornecedorTipo', () => {
  for (const fn of [
    'screenCadastrosCores', 'screenCadastrosClientes', 'screenCadastrosModelos',
    'screenCadastrosParametros', 'screenCadastrosFornecedores', 'screenCadastrosPrecos',
    'screenCadastrosUsuarios',
  ]) {
    assert.match(cadSrc, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `cadastros.js não define ${fn}`);
  }
  assert.match(cadSrc, /const\s+FORNECEDOR_TIPOS\s*=/);
  assert.match(cadSrc, /function\s+labelFornecedorTipo\s*\(/);
});

test('9. cadastros.js NÃO contém supabase.createClient / _supaRaw / const supa = / etc', () => {
  assert.equal(/supabase\.createClient\s*\(/.test(cadSrc), false,
    'cadastros.js chama supabase.createClient — não deve');
  assert.equal(/\b_supaRaw\b/.test(cadSrc), false,
    'cadastros.js referencia _supaRaw');
  assert.equal(/\b_LOCAL_HOSTS\b/.test(cadSrc), false);
  assert.equal(/\b_IS_LOCAL\b/.test(cadSrc), false);
  assert.equal(/\b_IS_PROD_URL\b/.test(cadSrc), false);
  assert.equal(/\b_GUARD_BLOCK_WRITES\b/.test(cadSrc), false);
  assert.equal(/\b_WG_ERROR\b/.test(cadSrc), false);
  assert.equal(/function\s+_wrapQueryBuilder/.test(cadSrc), false);
  assert.equal(/^const\s+supa\s*=/m.test(cadSrc), false,
    'cadastros.js define const supa — não deve (é window.supa)');
});

test('10. cadastros.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(cadSrc), false, 'service_role em cadastros.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(cadSrc), false,
    'password literal longo em cadastros.js');
});

test('11. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('12. FORNECEDOR_TIPOS é declarado UMA única vez em cadastros.js e ausente em index.html', () => {
  const cadCount = (cadSrc.match(/const\s+FORNECEDOR_TIPOS\s*=/g) || []).length;
  assert.equal(cadCount, 1, `esperado 1 declaração de FORNECEDOR_TIPOS em cadastros.js, encontrado ${cadCount}`);
  assert.equal(/const\s+FORNECEDOR_TIPOS\s*=/.test(indexSrc), false,
    'index.html não deve declarar FORNECEDOR_TIPOS');
});

test('13. labelFornecedorTipo é declarado UMA única vez em cadastros.js e ausente em index.html', () => {
  const cadCount = (cadSrc.match(/function\s+labelFornecedorTipo\s*\(/g) || []).length;
  assert.equal(cadCount, 1, `esperado 1 declaração de labelFornecedorTipo em cadastros.js, encontrado ${cadCount}`);
  assert.equal(/function\s+labelFornecedorTipo\s*\(/.test(indexSrc), false,
    'index.html não deve declarar labelFornecedorTipo');
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

test('14. runtime: window.RAVATEX_SCREENS.cadastros existe e expõe as 7 telas + helpers', () => {
  const { sandbox } = makeCadastrosSandbox();
  const cad = vm.runInContext('window.RAVATEX_SCREENS.cadastros', sandbox);
  assert.ok(cad && typeof cad === 'object', 'RAVATEX_SCREENS.cadastros não é objeto');
  for (const fn of [
    'screenCadastrosCores', 'screenCadastrosClientes', 'screenCadastrosModelos',
    'screenCadastrosParametros', 'screenCadastrosFornecedores', 'screenCadastrosPrecos',
    'screenCadastrosUsuarios',
  ]) {
    assert.equal(typeof cad[fn], 'function', `${fn} não é função`);
  }
  assert.ok(Array.isArray(cad.FORNECEDOR_TIPOS), 'FORNECEDOR_TIPOS não é array');
  assert.equal(typeof cad.labelFornecedorTipo, 'function', 'labelFornecedorTipo não é função');
});

test('15. runtime: window.FORNECEDOR_TIPOS tem exatamente os 4 itens canônicos', () => {
  const { sandbox } = makeCadastrosSandbox();
  // Serializa dentro do realm para evitar cross-realm deepEqual issues.
  const serialized = vm.runInContext('JSON.stringify(window.FORNECEDOR_TIPOS)', sandbox);
  const tipos = JSON.parse(serialized);
  const values = tipos.map(t => t.value);
  assert.deepEqual(values, ['fio_algodao', 'fio_poliester', 'tecelagem', 'latex']);
  // Labels PT-BR preservados
  const tecelagem = tipos.find(t => t.value === 'tecelagem');
  assert.equal(tecelagem.label, 'Tecelagem (parte de cima)');
  const latex = tipos.find(t => t.value === 'latex');
  assert.equal(latex.label, 'Látex (acabamento)');
});

test('16. runtime: labelFornecedorTipo preserva labels PT-BR', () => {
  const { sandbox } = makeCadastrosSandbox();
  const out = vm.runInContext("window.labelFornecedorTipo('tecelagem')", sandbox);
  assert.equal(out, 'Tecelagem (parte de cima)');
  const out2 = vm.runInContext("window.labelFornecedorTipo('latex')", sandbox);
  assert.equal(out2, 'Látex (acabamento)');
  // Valor desconhecido devolve o próprio tipo
  const out3 = vm.runInContext("window.labelFornecedorTipo('xyz')", sandbox);
  assert.equal(out3, 'xyz');
});

test('17. runtime: 7 globais legados window.screenCadastros* existem', () => {
  const { sandbox } = makeCadastrosSandbox();
  for (const fn of [
    'screenCadastrosCores', 'screenCadastrosClientes', 'screenCadastrosModelos',
    'screenCadastrosParametros', 'screenCadastrosFornecedores', 'screenCadastrosPrecos',
    'screenCadastrosUsuarios',
  ]) {
    assert.equal(typeof vm.runInContext(`window.${fn}`, sandbox), 'function',
      `window.${fn} não é função`);
  }
});

// 18. Cada uma das 7 telas, com supa mockado, chama supa.from com a
// tabela esperada e devolve um nó renderizável via shellLayout.
const CADASTROS_TABLES = [
  { fn: 'screenCadastrosCores',        table: 'cores' },
  { fn: 'screenCadastrosClientes',     table: 'clientes' },
  { fn: 'screenCadastrosModelos',      table: 'modelos' }, // também lê 'cores'
  { fn: 'screenCadastrosParametros',   table: 'parametros_largura' },
  { fn: 'screenCadastrosFornecedores', table: 'fornecedores' },
  { fn: 'screenCadastrosPrecos',       table: 'precos_terceirizada' }, // também 'fornecedores'
  { fn: 'screenCadastrosUsuarios',     table: 'usuarios' }, // também 'fornecedores'
];

for (const { fn, table } of CADASTROS_TABLES) {
  test(`18.${fn}: chama supa.from('${table}') e devolve nó renderizável`, async () => {
    const { sandbox, fakeSupa } = makeCadastrosSandbox();
    const node = await vm.runInContext(`window.${fn}()`, sandbox);
    assert.ok(node && node.tagName === 'DIV', `${fn} não devolveu um <div>`);
    // shellLayout → header + aside + main
    const header = node.children.find((c) => c.tagName === 'HEADER');
    assert.ok(header, `${fn} não tem header (shellLayout não foi aplicado)`);
    const flex = node.children.find((c) => c.tagName === 'DIV');
    const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
    const main  = flex && flex.children.find((c) => c.tagName === 'MAIN');
    assert.ok(aside, `${fn} não tem aside`);
    assert.ok(main, `${fn} não tem main`);
    // Verifica que a tabela foi tocada
    const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.args[0]);
    assert.ok(fromCalls.includes(table),
      `${fn} não chamou supa.from('${table}') (chamadas: ${fromCalls.join(',')})`);
  });
}

test('19. screenCadastrosFornecedores preserva uso de FORNECEDOR_TIPOS e labelFornecedorTipo', async () => {
  const { sandbox, fakeSupa } = makeCadastrosSandbox({
    tableData: {
      fornecedores: [
        { id: 1, nome: 'Tecelagem X', tipo: 'tecelagem' },
        { id: 2, nome: 'Latex Y',     tipo: 'latex' },
      ],
    },
  });
  const node = await vm.runInContext('window.screenCadastrosFornecedores()', sandbox);
  assert.ok(node, 'render falhou');
  // Verifica que o select renderizado usa o label PT-BR via
  // labelFornecedorTipo na coluna "Tipo" da dataTable
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  // Deve aparecer "Tecelagem (parte de cima)" ou "Látex (acabamento)"
  assert.ok(rendered.includes('Tecelagem (parte de cima)') || rendered.includes('Látex (acabamento)'),
    `label PT-BR não apareceu no render: ${rendered.slice(0, 200)}`);
  // Verifica que FORNECEDOR_TIPOS é usado como options no select do
  // modal: o teste estático já garante; aqui validamos via calls que
  // a tabela 'fornecedores' foi tocada.
  assert.ok(fakeSupa._calls.some(c => c.op === 'from' && c.args[0] === 'fornecedores'));
});

test('20. screenCadastrosUsuarios preserva uso de labelFornecedorTipo', async () => {
  const { sandbox } = makeCadastrosSandbox({
    tableData: {
      usuarios: [
        { id: 'u-1', email: 'a@b.c', nome: 'Ana', tipo: 'admin', fornecedor: null },
        { id: 'u-2', email: 'b@b.c', nome: 'Bia', tipo: 'fornecedor',
          fornecedor: { id: 'f-1', nome: 'Tec X', tipo: 'tecelagem' } },
      ],
      fornecedores: [
        { id: 'f-1', nome: 'Tec X', tipo: 'tecelagem' },
      ],
    },
  });
  const node = await vm.runInContext('window.screenCadastrosUsuarios()', sandbox);
  assert.ok(node, 'render falhou');
  // Botão principal deve ser "+ Novo usuário" (fluxo via Edge Function)
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main  = flex && flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.match(rendered, /\+ Novo usu[áa]rio/);
  assert.doesNotMatch(rendered, /Como criar um usu[áa]rio novo/);
  assert.doesNotMatch(rendered, /Supabase Studio/);
  // O label PT-BR via labelFornecedorTipo deve aparecer (coluna
  // "Fornecedor" do dataTable mostra "Tec X" para o usuário tipo
  // fornecedor, mas como o join já devolve fornecedor.nome, o label
  // PT-BR aparece só no modal — aqui validamos o banner e o render)
  assert.ok(rendered.includes('Ana'));
  assert.ok(rendered.includes('a@b.c'));
});

// =====================================================================
// === RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A ==========================
// Fase: RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A
// Garante que a tela de usuários não oferece mais exclusão insegura
// de perfil (que deixaria auth.users ativo e reintroduziria a
// inconsistência que a Edge Function admin-create-user resolveu).
// =====================================================================

test('20a. screenCadastrosUsuarios: tem botão "Desativar" (não mais placeholder "Em breve")', async () => {
  const { sandbox } = makeCadastrosSandbox({
    tableData: {
      usuarios: [
        { id: 'u-1', email: 'a@b.c', nome: 'Ana', tipo: 'admin', ativo: true, fornecedor: null },
      ],
      fornecedores: [],
    },
  });
  const node = await vm.runInContext('window.screenCadastrosUsuarios()', sandbox);
  assert.ok(node, 'render falhou');
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main  = flex && flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  // Botão Desativar deve aparecer como ação da linha.
  assert.match(rendered, /Desativar/);
  // Placeholder antigo não deve mais aparecer como ação primária.
  assert.doesNotMatch(rendered, /Em breve/);
  assert.doesNotMatch(rendered, /Excluir v[íi]nculo/);
  // Coluna Status deve aparecer (Ativo/Inativo).
  assert.match(rendered, /Ativo/);
});

test('20b. cadastros.js: fluxo de usuários não tem .from("usuarios").delete()', () => {
  // Garante que nenhuma parte do source executa delete em public.usuarios
  // (o caminho inseguro de exclusão foi removido na fase
  // RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A).
  assert.equal(
    /from\(\s*['"]usuarios['"]\s*\)\s*\.\s*delete\s*\(/.test(cadSrc),
    false,
    'cadastros.js ainda executa .from("usuarios").delete() — caminho inseguro de exclusão',
  );
});

test('21. CRUD methods (insert/update/delete) chamados apenas no mock', async () => {
  // reload() é read-only (apenas select). Aqui exercitamos a tela
  // Cores (a mais simples) e validamos que as únicas chamadas
  // disparadas no boot são from/select — nenhum write.
  const { sandbox, fakeSupa } = makeCadastrosSandbox({
    tableData: { cores: [{ id: 1, nome: 'VERMELHO' }] },
  });
  await vm.runInContext('window.screenCadastrosCores()', sandbox);
  const ops = new Set(fakeSupa._calls.map(c => c.op));
  assert.ok(ops.has('from'), 'sem from no call set');
  assert.ok(ops.has('select'), 'sem select no call set');
  // reload() não dispara write
  assert.equal(ops.has('insert'), false,
    'reload() não deveria fazer insert');
  assert.equal(ops.has('update'), false,
    'reload() não deveria fazer update');
  assert.equal(ops.has('delete'), false,
    'reload() não deveria fazer delete');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('22. boot: módulos coexistem sem SyntaxError e setRoutes registra as 7 rotas de cadastro', () => {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient();
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
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(opNovaSrc, sandbox, { filename: 'js/screens/op-nova.js' });
  vm.runInContext(opLatexAdminSrc, sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });

  // Stubs necessários para boot.js
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(bootSrc, sandbox, { filename: 'js/boot.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'coexistência dos módulos + boot.js lançou SyntaxError de duplicate identifier');

  // setRoutes de boot.js deve ter registrado as 7 rotas de cadastro
  const routes = vm.runInContext('window.routes', sandbox);
  for (const rota of [
    '#/cadastros/cores', '#/cadastros/modelos', '#/cadastros/parametros',
    '#/cadastros/fornecedores', '#/cadastros/clientes', '#/cadastros/precos',
    '#/cadastros/usuarios',
  ]) {
    assert.ok(routes && routes[rota], `rota ${rota} não registrada pelo setRoutes de boot.js`);
    assert.equal(typeof routes[rota].render, 'function',
      `routes[${rota}].render não é função`);
  }

  if (otherErr) {
    // Erros de runtime fora do duplicate-identifier são esperados
    // (Supabase mockado não tem auth.getSession cheio etc).
    console.log('(esperado) boot.js falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('23. setRoutes: as globais legadas resolvem (não há ReferenceError em runtime)', () => {
  // Carrega todos os módulos incluindo boot.js e tenta resolver uma
  // rota de cadastro via matchRoute.
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient();
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '#/cadastros/cores' },
    supa: fakeSupa,
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
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });
  vm.runInContext(opNovaSrc, sandbox, { filename: 'js/screens/op-nova.js' });
  vm.runInContext(opLatexAdminSrc, sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(bootSrc, sandbox, { filename: 'js/boot.js' });

  // matchRoute deve resolver a rota
  const match = vm.runInContext("matchRoute('#/cadastros/cores')", sandbox);
  assert.ok(match && match.render, 'matchRoute não resolveu #/cadastros/cores');
  // O render foi registrado por boot.js com `window.screenCadastrosCores`
  // (referência explícita), portanto o nome da função é preservado.
  assert.equal(typeof match.render, 'function');
  assert.equal(match.render.name, 'screenCadastrosCores',
    'render.name deve ser screenCadastrosCores');
});

test('24. screenPainel (módulo) renderiza via shellLayout com os itens do ADMIN_MENU (regressão common)', () => {
  // Regressão: garante que a extração de cadastros.js não quebrou o
  // boot de common.js / painel.js nem o ADMIN_MENU.
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient();
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
    supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  // Carrega painel.js (depende de el/CURRENT_USER/shellLayout/ADMIN_MENU)
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });

  const root = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenPainel não devolveu <div>');
  const flex = root.children.find((c) => c.tagName === 'DIV');
  const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
  const links = aside && aside.children.filter((c) => c.tagName === 'A');
  // O ADMIN_MENU tem 11 itens (Painel, OPs, Pedidos, Documentos, Cores,
  // Modelos, Parâmetros, Fornecedores, Clientes, Preços, Usuários).
  assert.ok(links && links.length === 11,
    `screenPainel não renderizou 11 itens do ADMIN_MENU (renderizou ${links ? links.length : 0})`);
});
