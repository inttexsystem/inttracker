// Smoke test do módulo js/screens/fornecedor.js
// (FORNECEDOR-SCREENS-MODULE-A).
//
// Garante que a extração das 4 telas de fornecedor
// (screenFornecedorHome, screenFornecedorEntregas,
// screenFornecedorLatex, screenFornecedorOrdens) do <script> inline
// de index.html para js/screens/fornecedor.js preservou o
// comportamento exato: o módulo é script clássico, é carregado
// exatamente uma vez, na ordem certa, e as 4 funções estão
// disponíveis no namespace RAVATEX_SCREENS.fornecedor e como globais
// legados.
//
// Estáticos:
//   1. js/screens/fornecedor.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/fornecedor.js EXATAMENTE UMA
//      VEZ, sem type=module;
//   4. ordem: entrega-writes.js → fornecedor.js → jspdf → inline;
//   5. inline NÃO contém mais function screenFornecedorHome,
//      function screenFornecedorEntregas, function
//      screenFornecedorLatex, function screenFornecedorOrdens;
//   6. inline AINDA contém: screenPainel, screenNovaOP,
//      renderOPLatexAdmin, setRoutes, main, rotuloFioOrdem
//      (clone local em screenNovaOP);
//   7. js/screens/fornecedor.js contém as 4 telas;
//   8. js/screens/fornecedor.js NÃO contém service_role nem
//      password literal longo;
//   9. index.html NÃO contém service_role nem password literal
//      longo;
//  10. cada uma das 4 telas declarada UMA única vez no projeto
//      (apenas em fornecedor.js).
//
// Runtime (carrega ui + common + entrega-form + entrega-writes +
// fornecedor num vm.Context com DOM mock; supa mockado por tabela):
//  11. window.RAVATEX_SCREENS.fornecedor existe com as 4 chaves;
//  12. window.RAVATEX_SCREENS.fornecedor.screenFornecedorHome é
//      função;
//  13. window.RAVATEX_SCREENS.fornecedor.screenFornecedorEntregas é
//      função;
//  14. window.RAVATEX_SCREENS.fornecedor.screenFornecedorLatex é
//      função;
//  15. window.RAVATEX_SCREENS.fornecedor.screenFornecedorOrdens é
//      função;
//  16. window.screenFornecedorHome (global legado) é função;
//  17. window.screenFornecedorEntregas (global legado) é função;
//  18. window.screenFornecedorLatex (global legado) é função;
//  19. window.screenFornecedorOrdens (global legado) é função;
//  20. screenFornecedorHome renderiza sem tocar Supabase;
//  21. screenFornecedorHome renderiza <div> via shellLayout com
//      CURRENT_USER.nome;
//  22. screenFornecedorEntregas com fornecedor_id null renderiza
//      aviso "não está vinculado a um fornecedor";
//  23. screenFornecedorEntregas happy path — chama from
//      'op_fornecedores', 'entregas', 'modelos', 'fornecedores' e
//      renderiza container;
//  24. screenFornecedorEntregas consumidor bare consegue chamar
//      salvarEntregaCima / atualizarEntregaCima / excluirEntrega
//      via globais legados;
//  25. screenFornecedorLatex com fornecedor_id null renderiza
//      aviso "não está vinculado a um fornecedor";
//  26. screenFornecedorLatex happy path — chama from
//      'op_fornecedores' (etapa=latex), 'entregas' (etapa=latex),
//      'modelos';
//  27. screenFornecedorLatex consumidor bare consegue chamar
//      salvarEntregaLatex / atualizarEntregaLatex / excluirEntrega
//      via globais legados;
//  28. screenFornecedorOrdens happy path — chama from
//      'ordens_compra_fio' com .order('id') e renderiza container;
//  29. screenFornecedorOrdens update inline: ao registrar
//      recebimento, chama update({ kg_recebido, data_recebimento,
//      status }) onde status = kg < kg_pedido ? 'recebido_parcial'
//      : 'recebido_total';
//  30. screenFornecedorOrdens update com erro: exibe toast de
//      erro e NÃO chama reload (toast.success);
//  31. screenFornecedorOrdens update com kg=0 ou inválido: exibe
//      toast de erro "Informe o kg recebido" e NÃO chama Supabase;
//  32. screenFornecedorOrdens usa rotuloFio e OCF_STATUS_LABEL
//      (helpers de entrega-form.js);
//
// Integração:
//  33. Boot completo: ui + badges + calculo-op + common +
//      cadastros + ops-list + entrega-form + entrega-writes +
//      fornecedor + inline coexiste sem SyntaxError de duplicate
//      identifier;
//  34. screenPainel (inline) ainda renderiza via shellLayout com
//      9 itens do ADMIN_MENU (regressão common);
//  35. screenCadastrosCores (cadastros) ainda renderiza
//      (regressão cadastros);
//  36. screenListaOPs (ops-list) ainda renderiza (regressão
//      ops-list).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');

const indexSrc  = fs.readFileSync(INDEX,  'utf8');
const fornSrc   = fs.readFileSync(FORN,   'utf8');
const efSrc     = fs.readFileSync(EF,     'utf8');
const ewSrc     = fs.readFileSync(EW,     'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const calcSrc   = fs.readFileSync(CALC,   'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');
const opsSrc    = fs.readFileSync(OPS,    'utf8');
const painelSrc = fs.readFileSync(PAINEL, 'utf8');

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
// Helpers runtime: FakeNode + supa mock com flag por tabela.
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

// Constrói um objeto que satisfaz a interface de Promise (thenable)
// e que SEMPRE devolve o resultado de `fnPromise()` quando awaited
// ou encadeado. Útil para o "terminal" de uma chain (ex: eq() final
// de um update).
function makeThenable(fnPromise) {
  return {
    then(resolveThen, rejectThen) {
      return fnPromise().then(resolveThen, rejectThen);
    },
    // Métodos de chain comuns (eq, order, etc.) que podem ser
    // chamados após o terminal sem efeito — apenas devolvem a si
    // mesmo para não quebrar chains triviais.
    eq() { return this; },
    order() { return this; },
    in() { return this; },
    select() { return this; },
  };
}

// Procura recursivamente o PRIMEIRO handler de click em uma árvore
// DOM (FakeNode).
function findButtonOnClick(node) {
  if (!node || !node.children) return null;
  for (const c of node.children) {
    if (c._listeners && c._listeners.click) return c._listeners.click;
    const r = findButtonOnClick(c);
    if (r) return r;
  }
  return null;
}

// Procura recursivamente o PRIMEIRO <input> em uma árvore DOM
// (FakeNode).
function findInput(node) {
  if (!node || !node.children) return null;
  for (const c of node.children) {
    if (c.tagName === 'INPUT') return c;
    const r = findInput(c);
    if (r) return r;
  }
  return null;
}

// Procura recursivamente o <main> e a partir dele busca o primeiro
// handler de click. Isso evita capturar o botão "Sair" do header
// (shellLayout) antes do conteúdo da tela.
function findButtonOnClickInMain(node) {
  if (!node) return null;
  if (node.tagName === 'MAIN') {
    return findButtonOnClick(node);
  }
  if (!node.children) return null;
  for (const c of node.children) {
    const r = findButtonOnClickInMain(c);
    if (r) return r;
  }
  return null;
}

// Procura recursivamente o <main> e a partir dele busca o primeiro
// <input>.
function findInputInMain(node) {
  if (!node) return null;
  if (node.tagName === 'MAIN') {
    return findInput(node);
  }
  if (!node.children) return null;
  for (const c of node.children) {
    const r = findInputInMain(c);
    if (r) return r;
  }
  return null;
}

function makeFornSandbox({
  // Resultados por tabela. Se ausente, devolve [].
  tableResults = {},
  opfData = [],
  entData = [],
  modelosData = [],
  fornsData = [],
  ocfData = [],
} = {}) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const calls = [];

  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      // Resposta "padrão" por tabela. Subtestes que precisarem de
      // respostas específicas para o terminal usam tableResults.
      const defaultResult = (() => {
        if (table === 'op_fornecedores') return { data: opfData, error: null };
        if (table === 'entregas') return { data: entData, error: null };
        if (table === 'modelos') return { data: modelosData, error: null };
        if (table === 'fornecedores') return { data: fornsData, error: null };
        if (table === 'ordens_compra_fio') return { data: ocfData, error: null };
        return { data: [], error: null };
      })();
      // update().eq() precisa de resultado customizável.
      const updateResult = (table === 'ordens_compra_fio')
        ? (tableResults.ordens_compra_fio_update || { data: null, error: null })
        : { data: null, error: null };

      const chain = {
        _table: table,
        _lastUpdate: null,
        select() { calls.push({ op: 'select', table }); return chain; },
        insert(payload) { calls.push({ op: 'insert', table, args: [payload] }); return chain; },
        update(payload) {
          calls.push({ op: 'update', table, args: [payload] });
          chain._lastUpdate = payload;
          return chain;
        },
        delete() { calls.push({ op: 'delete', table }); return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          // Para ordens_compra_fio, .update().eq() deve resolver
          // com o resultado configurado. O thenable abaixo detecta
          // se for a chamada terminal.
          if (table === 'ordens_compra_fio' && chain._lastUpdate != null) {
            return makeThenable(() => Promise.resolve(updateResult));
          }
          return chain;
        },
        order() { calls.push({ op: 'order', table }); return chain; },
        in() { return chain; },
        single() { return Promise.resolve(defaultResult); },
        // Thenable: quando o código faz `await query` (sem mais
        // chamadas), resolve com defaultResult.
        then(resolveThen, rejectThen) {
          return Promise.resolve(defaultResult).then(resolveThen, rejectThen);
        },
      };
      return chain;
    },
    rpc: () => { calls.push({ op: 'rpc' }); return Promise.resolve({ data: null, error: null }); },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    storage: {},
    _calls: calls,
  };

  const toasts = [];
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
    supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  sandbox.CURRENT_USER = { nome: 'Fornecedor Teste', tipo: 'fornecedor' };
  sandbox.logout = () => {};
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });

  const origToast = sandbox.toast;
  sandbox.toast = (msg, type) => {
    toasts.push({ msg, type });
    return origToast(msg, type);
  };
  sandbox.confirmDialog = (opts) => {
    return Promise.resolve().then(() => opts.onConfirm && opts.onConfirm());
  };
  sandbox.modal = (opts) => {
    // Não invoca onSave automaticamente; teste que precisar chama
    // sandbox.__lastModalOnSave()._call() para disparar o save.
    sandbox.__lastModalOnSave = () => (opts.onSave ? opts.onSave() : Promise.resolve(true));
    return { _opts: opts };
  };

  return {
    sandbox, fakeSupa,
    getToasts: () => toasts.slice(),
    clearToasts: () => { toasts.length = 0; },
  };
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/fornecedor.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(FORN), 'js/screens/fornecedor.js não existe');
  assert.equal(/^\s*export\s+/m.test(fornSrc), false,
    'fornecedor.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(fornSrc), false,
    'fornecedor.js parece usar import — deve ser script clássico');
});

test('2. fornecedor.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${FORN}"`, { stdio: 'pipe' });
});

test('3. index.html carrega js/screens/fornecedor.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/fornecedor\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/fornecedor.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/fornecedor\.js"[^>]*type=/.test(indexSrc), false,
    'fornecedor.js está sendo carregado com type=module — deve ser script clássico');
});

test('4. index.html: ordem entrega-writes → fornecedor → jspdf → inline', () => {
  const ewIdx     = findScriptIdx(indexSrc, 'js/screens/entrega-writes.js');
  const fornIdx   = findScriptIdx(indexSrc, 'js/screens/fornecedor.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(ewIdx > 0, 'js/screens/entrega-writes.js não encontrado');
  assert.ok(fornIdx > 0, 'js/screens/fornecedor.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf CDN não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(ewIdx < fornIdx, 'entrega-writes deve vir antes de fornecedor');
  assert.ok(fornIdx < jspdfIdx, 'fornecedor deve vir antes de jspdf');
  assert.ok(fornIdx < inlineIdx, 'fornecedor deve vir antes do inline');
});

test('5. script inline NÃO contém mais as 4 funções de fornecedor', () => {
  const inline = extractInlineScript(indexSrc);
  for (const fn of [
    'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens',
  ]) {
    assert.equal(new RegExp(`function\\s+${fn}\\s*\\(`).test(inline), false,
      `inline ainda declara function ${fn}`);
  }
});

test('6. screenNovaOP foi extraída para op-nova.js; setRoutes e main continuam inline', () => {
  const inline = extractInlineScript(indexSrc);
  // screenNovaOP foi extraída para op-nova.js (SCREENNOVAOP-MODULE-A)
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
  // renderOPLatexAdmin foi extraído para op-latex-admin.js
  assert.equal(/function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline não deve mais declarar renderOPLatexAdmin (extraído para op-latex-admin.js)');
  // rotuloFioOrdem (clone local) foi unificado com rotuloFio
  // em OP-FORM-HELPERS-MODULE-A
  assert.equal(/function\s+rotuloFioOrdem\s*\(/.test(inline), false,
    'inline não deve mais declarar rotuloFioOrdem (unificado com rotuloFio)');
  // setRoutes e main permanecem inline
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

test('7. js/screens/fornecedor.js contém as 4 telas', () => {
  for (const fn of [
    'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens',
  ]) {
    assert.match(fornSrc, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `fornecedor.js deve declarar ${fn}`);
  }
});

test('8. fornecedor.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(fornSrc), false, 'service_role em fornecedor.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(fornSrc), false,
    'password literal longo em fornecedor.js');
});

test('9. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('10. cada uma das 4 telas declarada UMA única vez no projeto (apenas em fornecedor.js)', () => {
  const inline = extractInlineScript(indexSrc);
  for (const fn of [
    'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens',
  ]) {
    const total = (fornSrc.match(new RegExp(`function\\s+${fn}\\s*\\(`, 'g')) || []).length
      + (inline.match(new RegExp(`function\\s+${fn}\\s*\\(`, 'g')) || []).length;
    assert.equal(total, 1, `esperado 1 declaração de ${fn}, encontrado ${total}`);
  }
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

test('11. runtime: window.RAVATEX_SCREENS.fornecedor existe com as 4 chaves', () => {
  const { sandbox } = makeFornSandbox();
  const ns = vm.runInContext('window.RAVATEX_SCREENS.fornecedor', sandbox);
  assert.ok(ns, 'window.RAVATEX_SCREENS.fornecedor não existe');
  for (const k of [
    'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens',
  ]) {
    assert.equal(typeof ns[k], 'function', `RAVATEX_SCREENS.fornecedor.${k} não é função`);
  }
});

test('12-15. runtime: cada window.screenFornecedor* (global legado) é função', () => {
  const { sandbox } = makeFornSandbox();
  for (const k of [
    'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens',
  ]) {
    assert.equal(typeof vm.runInContext(`window.${k}`, sandbox), 'function',
      `window.${k} não é função`);
  }
});

test('20. runtime: screenFornecedorHome renderiza sem tocar Supabase', () => {
  const { sandbox, fakeSupa } = makeFornSandbox();
  const root = vm.runInContext('window.screenFornecedorHome()', sandbox);
  assert.ok(root, 'screenFornecedorHome não devolveu nó');
  assert.equal(root.tagName, 'DIV');
  // Não deve tocar Supabase
  assert.equal(fakeSupa._calls.length, 0, 'screenFornecedorHome tocou Supabase');
});

test('21. runtime: screenFornecedorHome usa shellLayout com menu próprio', () => {
  const { sandbox } = makeFornSandbox();
  const root = vm.runInContext('window.screenFornecedorHome()', sandbox);
  // Esperado: div principal > header + (flex > aside + main)
  const flex = root.children.find((c) => c.tagName === 'DIV');
  assert.ok(flex, 'flex container ausente');
  const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
  assert.ok(aside, 'aside ausente em screenFornecedorHome');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, 1, `esperado 1 link no menu, encontrado ${links.length}`);
  assert.match(links[0]._attr_href || '', /#\/fornecedor\/home/);
});

test('22. runtime: screenFornecedorEntregas com fornecedor_id null renderiza aviso', async () => {
  const { sandbox, fakeSupa, getToasts } = makeFornSandbox();
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor" }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorEntregas()', sandbox);
  assert.ok(root, 'screenFornecedorEntregas não devolveu nó');
  // Não deve tocar Supabase
  assert.equal(fakeSupa._calls.length, 0, 'screenFornecedorEntregas tocou Supabase com fornecedor_id null');
  // Container deve ter o aviso
  const allText = JSON.stringify(root.children);
  assert.match(allText, /n\u00e3o est\u00e1 vinculado a um fornecedor/);
});

test('23. runtime: screenFornecedorEntregas happy path — chama from das 4 tabelas', async () => {
  const { sandbox, fakeSupa } = makeFornSandbox({
    opfData: [{ ops: { id: 1, numero: 100, ano: 2026, status: 'em_producao',
      op_itens: [{ id: 11, modelo_id: 101, metros_pedidos: 50, metros_ajustados: 50 }] } }],
    entData: [], modelosData: [{ id: 101, nome: 'M1', largura: 2, cor_1: { nome: 'A' }, cor_2: { nome: 'B' } }], fornsData: [{ id: 1, nome: 'Latex X' }],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorEntregas()', sandbox);
  assert.ok(root, 'screenFornecedorEntregas não devolveu nó');
  const tables = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  for (const t of ['op_fornecedores', 'entregas', 'modelos', 'fornecedores']) {
    assert.ok(tables.includes(t), `screenFornecedorEntregas não chamou from('${t}') (tabelas: ${tables.join(',')})`);
  }
});

test('24. runtime: screenFornecedorEntregas — consumidores bare acham salvarEntregaCima/atualizarEntregaCima/excluirEntrega', async () => {
  // Garante que os globais legados de entrega-writes foram
  // preservados (eles são consumidos via call-sites bare dentro
  // do módulo de fornecedor).
  const { sandbox } = makeFornSandbox();
  for (const k of ['salvarEntregaCima', 'atualizarEntregaCima', 'excluirEntrega']) {
    assert.equal(typeof vm.runInContext(`window.${k}`, sandbox), 'function',
      `window.${k} não é função — globals legados de entrega-writes não estão disponíveis`);
  }
});

test('25. runtime: screenFornecedorLatex com fornecedor_id null renderiza aviso', async () => {
  const { sandbox, fakeSupa } = makeFornSandbox();
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor" }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorLatex()', sandbox);
  assert.ok(root, 'screenFornecedorLatex não devolveu nó');
  assert.equal(fakeSupa._calls.length, 0, 'screenFornecedorLatex tocou Supabase com fornecedor_id null');
  const allText = JSON.stringify(root.children);
  assert.match(allText, /n\u00e3o est\u00e1 vinculado a um fornecedor/);
});

test('26. runtime: screenFornecedorLatex happy path — chama from das 3 tabelas', async () => {
  const { sandbox, fakeSupa } = makeFornSandbox({
    opfData: [{ ops: { id: 2, numero: 200, ano: 2026, status: 'em_producao', tipo: 'latex',
      op_itens: [{ id: 21, modelo_id: 201, metros_pedidos: 30 }] } }],
    entData: [], modelosData: [{ id: 201, nome: 'M2', largura: 3, cor_1: { nome: 'A' }, cor_2: { nome: 'B' } }],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorLatex()', sandbox);
  assert.ok(root, 'screenFornecedorLatex não devolveu nó');
  const tables = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  for (const t of ['op_fornecedores', 'entregas', 'modelos']) {
    assert.ok(tables.includes(t), `screenFornecedorLatex não chamou from('${t}') (tabelas: ${tables.join(',')})`);
  }
});

test('27. runtime: screenFornecedorLatex — consumidores bare acham salvarEntregaLatex/atualizarEntregaLatex/excluirEntrega', async () => {
  const { sandbox } = makeFornSandbox();
  for (const k of ['salvarEntregaLatex', 'atualizarEntregaLatex', 'excluirEntrega']) {
    assert.equal(typeof vm.runInContext(`window.${k}`, sandbox), 'function',
      `window.${k} não é função`);
  }
});

test('28. runtime: screenFornecedorOrdens happy path — chama from ordens_compra_fio com order', async () => {
  const { sandbox, fakeSupa } = makeFornSandbox({
    ocfData: [
      { id: 1, tipo: 'algodao', cor_poliester: null, kg_pedido: 10, kg_recebido: null,
        data_recebimento: null, status: 'pendente', ops: { numero: 100, ano: 2026 },
        cores: { id: 1, nome: 'BRANCO' } },
    ],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorOrdens()', sandbox);
  assert.ok(root, 'screenFornecedorOrdens não devolveu nó');
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('ordens_compra_fio'),
    `screenFornecedorOrdens não chamou from('ordens_compra_fio') (tabelas: ${fromCalls.join(',')})`);
  const orderCalls = fakeSupa._calls.filter(c => c.op === 'order');
  assert.ok(orderCalls.length >= 1, 'esperado ao menos 1 .order() em screenFornecedorOrdens');
});

test('29. runtime: screenFornecedorOrdens update inline — status = recebido_parcial quando kg < kg_pedido', async () => {
  const { sandbox, fakeSupa } = makeFornSandbox({
    ocfData: [
      { id: 7, tipo: 'algodao', cor_poliester: null, kg_pedido: 10, kg_recebido: null,
        data_recebimento: null, status: 'pendente', ops: { numero: 100, ano: 2026 },
        cores: { id: 1, nome: 'BRANCO' } },
    ],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorOrdens()', sandbox);

  const handler = findButtonOnClickInMain(root);
  assert.ok(handler, 'handler de Registrar não encontrado em screenFornecedorOrdens (main)');

  // kg = 5 < kg_pedido = 10 → status esperado: 'recebido_parcial'
  const inp = findInputInMain(root);
  assert.ok(inp, 'input de kg não encontrado em screenFornecedorOrdens (main)');
  inp.value = '5';
  await handler();

  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1, 'esperado 1 update em ordens_compra_fio');
  const payload = updateCalls[0].args[0];
  assert.equal(payload.kg_recebido, 5);
  assert.equal(payload.status, 'recebido_parcial', 'status deve ser recebido_parcial quando kg < kg_pedido');
  assert.ok(payload.data_recebimento, 'data_recebimento deve estar setada');
  // eq com id=7
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq' && c.val === 7);
  assert.equal(eqCalls.length, 1, 'esperado 1 eq com id=7');
});

test('30. runtime: screenFornecedorOrdens update com erro: exibe toast de erro', async () => {
  const { sandbox, fakeSupa, getToasts } = makeFornSandbox({
    ocfData: [
      { id: 8, tipo: 'algodao', cor_poliester: null, kg_pedido: 10, kg_recebido: null,
        data_recebimento: null, status: 'pendente', ops: { numero: 100, ano: 2026 },
        cores: { id: 1, nome: 'BRANCO' } },
    ],
    tableResults: {
      ordens_compra_fio_update: { data: null, error: { message: 'fk fail' } },
    },
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorOrdens()', sandbox);

  const handler = findButtonOnClickInMain(root);
  const inp = findInputInMain(root);
  inp.value = '10';
  await handler();

  const errorToasts = getToasts().filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1, 'esperado 1 toast de error');
  assert.match(errorToasts[0].msg, /registrar recebimento/);
  // NÃO deve haver success
  const successToasts = getToasts().filter(t => t.type === 'success');
  assert.equal(successToasts.length, 0, 'NÃO deve haver toast de success em erro');
});

test('31. runtime: screenFornecedorOrdens update com kg=0: exibe toast "Informe o kg recebido" e NÃO chama Supabase', async () => {
  const { sandbox, fakeSupa, getToasts } = makeFornSandbox({
    ocfData: [
      { id: 9, tipo: 'algodao', cor_poliester: null, kg_pedido: 10, kg_recebido: null,
        data_recebimento: null, status: 'pendente', ops: { numero: 100, ano: 2026 },
        cores: { id: 1, nome: 'BRANCO' } },
    ],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorOrdens()', sandbox);

  const updateCallsBefore = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ordens_compra_fio').length;
  const handler = findButtonOnClickInMain(root);
  const inp = findInputInMain(root);
  inp.value = '0';
  await handler();

  const updateCallsAfter = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ordens_compra_fio').length;
  assert.equal(updateCallsAfter, updateCallsBefore, 'NÃO deve chamar update com kg=0');
  const errorToasts = getToasts().filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /Informe o kg recebido/);
});

test('32. runtime: screenFornecedorOrdens usa rotuloFio e OCF_STATUS_LABEL de entrega-form', async () => {
  const { sandbox } = makeFornSandbox({
    ocfData: [
      // Pendente
      { id: 1, tipo: 'algodao', cor_poliester: null, kg_pedido: 10, kg_recebido: null,
        data_recebimento: null, status: 'pendente', ops: { numero: 100, ano: 2026 },
        cores: { id: 1, nome: 'BRANCO' } },
      // Recebida
      { id: 2, tipo: 'poliester', cor_poliester: 'PRETO', kg_pedido: 5, kg_recebido: 5,
        data_recebimento: '2026-06-01', status: 'recebido_total', ops: { numero: 100, ano: 2026 },
        cores: null },
    ],
  });
  vm.runInContext('window.CURRENT_USER = { nome: "X", tipo: "fornecedor", fornecedor_id: 1 }', sandbox);
  const root = await vm.runInContext('window.screenFornecedorOrdens()', sandbox);

  // Verifica que rotuloFio e OCF_STATUS_LABEL estão disponíveis
  // como globais legados (entrega-form.js) e que o render acontece
  // sem erro.
  assert.equal(typeof vm.runInContext('window.rotuloFio', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.OCF_STATUS_LABEL', sandbox), 'object');
  const status = vm.runInContext('window.OCF_STATUS_LABEL', sandbox);
  assert.equal(status.pendente, 'Pendente');
  assert.equal(status.recebido_total, 'Recebido');
  assert.equal(status.recebido_parcial, 'Recebido (parcial)');
  assert.ok(root, 'render não devolveu nó');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('33. boot: ui + badges + calculo-op + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + inline coexistem sem SyntaxError', () => {
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
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });

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
    'coexistência entrega-writes + fornecedor + inline lançou SyntaxError de duplicate identifier');

  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'rota #/login não registrada');
  // Rotas de fornecedor devem estar registradas pelo setRoutes inline
  assert.ok(routes && routes['#/fornecedor/home'], 'rota #/fornecedor/home não registrada');
  assert.ok(routes && routes['#/fornecedor/entregas'], 'rota #/fornecedor/entregas não registrada');
  assert.ok(routes && routes['#/fornecedor/latex'], 'rota #/fornecedor/latex não registrada');
  assert.ok(routes && routes['#/fornecedor/ordens'], 'rota #/fornecedor/ordens não registrada');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

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
  const fakeSupa = {
    from: (t) => ({
      _table: t,
      select() { return this; },
      order() { return this; },
      then(r) { return Promise.resolve({ data: [], error: null }).then(r); },
    }),
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
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
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
  const calls = [];
  const qb = () => {
    const chain = {
      select() { calls.push({ op: 'select' }); return chain; },
      order() { calls.push({ op: 'order' }); return chain; },
      then(r) { return Promise.resolve({ data: [{ id: 1, nome: 'VERMELHO' }], error: null }).then(r); },
    };
    return chain;
  };
  const fakeSupa = { from: (t) => { calls.push({ op: 'from', table: t }); return qb(); } };
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
  const fakeSupa = {
    from: () => ({
      select() { return this; },
      order() { return this; },
      then(r) { return Promise.resolve({ data: [], error: null }).then(r); },
    }),
  };
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = (h) => { sandbox._lastNavigate = h; };

  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenListaOPs não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenListaOPs');
});
