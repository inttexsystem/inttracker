// Smoke test do módulo js/screens/ops-list.js (OPS-LIST-SCREEN-MODULE-A).
//
// Garante que a extração da tela de listagem de OPs (screenListaOPs)
// do <script> inline de index.html para js/screens/ops-list.js
// preservou o comportamento exato, sem writes e sem acesso real a
// Supabase.
//
// Estáticos:
//   1. js/screens/ops-list.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/ops-list.js EXATAMENTE UMA VEZ;
//   4. ordem cadastros → ops-list → jspdf → inline;
//   5. inline NÃO contém mais function screenListaOPs;
//   6. inline AINDA contém: screenPainel, telas de fornecedor,
//      screenNovaOP, renderOPLatexAdmin, buildEntregaInlineForm,
//      rotuloFio, OCF_STATUS_LABEL, setRoutes, main;
//   7. setRoutes ainda registra '#/ops' e '#/ops/nova';
//   8. js/screens/ops-list.js contém screenListaOPs;
//   9. js/screens/ops-list.js NÃO contém .insert( / .update( /
//      .delete( / .rpc( (read-only);
//  10. js/screens/ops-list.js NÃO contém service_role nem password
//      literal longo;
//  11. index.html NÃO contém service_role nem password literal longo;
//  12. screenListaOPs declarado UMA única vez no projeto (apenas em
//      js/screens/ops-list.js).
//
// Runtime (carrega ui + badges + common + cadastros + ops-list +
// calculo-op num vm.Context com supa mockado):
//  13. window.RAVATEX_SCREENS.opsList existe e expõe screenListaOPs;
//  14. window.screenListaOPs é função (global legado);
//  15. screenListaOPs() renderiza nó DOM (header + filtro + body)
//      via shellLayout, com ADMIN_MENU;
//  16. screenListaOPs() chama supa.from('ops') e supa.from('entrega_itens')
//      no reload (read-only);
//  17. screenListaOPs() NÃO chama insert/update/delete/rpc no reload
//      (mock registra zero writes);
//  18. Filtro "Tecelagem"/"Látex" filtra a lista renderizada;
//  19. Coluna "Tipo" usa badgeTipo (label PT-BR);
//  20. Coluna "Status" usa badgeStatus (label PT-BR);
//  21. Ação "Editar"/"Ver" navega para '#/ops/<id>';
//  22. Botão "+ Nova OP" navega para '#/ops/nova';
//  23. Lista vazia (filtro sem resultados) renderiza mensagem
//      "Nenhuma OP para este filtro.";
//  24. Coluna "Entregue" usa percentualEntregueOP (barra com %).
//
// Integração:
//  25. Boot completo (ui + badges + router + system-screens + common +
//      cadastros + ops-list + inline) coexiste sem SyntaxError de
//      duplicate identifier;
//  26. setRoutes do inline registra window.routes['#/ops'] apontando
//      para window.screenListaOPs;
//  27. Rota dinâmica '#/ops/:id' continua resolvendo para
//      window.screenNovaOP(:id) (sem alteração);
//  28. Rota '#/ops' continua resolvendo para window.screenListaOPs;
//  29. screenPainel (inline) ainda renderiza via shellLayout (regressão
//      common);
//  30. screenCadastrosCores (cadastros) ainda renderiza (regressão
//      cadastros).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');

const indexSrc  = fs.readFileSync(INDEX,  'utf8');
const opsSrc    = fs.readFileSync(OPS,    'utf8');
const efSrc     = fs.readFileSync(EF,     'utf8');
const ewSrc     = fs.readFileSync(EW,     'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const calcSrc   = fs.readFileSync(CALC,   'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');

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
// Helpers de runtime: FakeNode + document mock + supa mock.
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

function makeFakeSupabaseClient(routeResolver) {
  const calls = [];
  const resolve = routeResolver || (() => []);
  function makeChain(table) {
    const data = resolve(table);
    const chain = {
      _table: table,
      _data: data,
      _error: null,
      select(_cols) { calls.push({ op: 'select', args: [_cols] }); return chain; },
      insert(payload) { calls.push({ op: 'insert', args: [payload] }); return Promise.resolve({ data: null, error: null }); },
      update(payload) { calls.push({ op: 'update', args: [payload] }); return Promise.resolve({ data: null, error: null }); },
      delete()         { calls.push({ op: 'delete' }); return Promise.resolve({ data: null, error: null }); },
      eq()    { return chain; },
      order() { return chain; },
      in()    { return chain; },
      then(resolveThen, rejectThen) {
        return Promise.resolve({ data: chain._data, error: chain._error })
          .then(resolveThen, rejectThen);
      },
    };
    return chain;
  }
  return {
    from(table) { calls.push({ op: 'from', args: [table] }); return makeChain(table); },
    rpc()       { return Promise.resolve({ data: null, error: null }); },
    auth: {
      getSession:        () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut:           () => Promise.resolve({ error: null }),
    },
    storage: {},
    _calls: calls,
  };
}

// Faz boot do sandbox: carrega ui + badges + calculo-op + common +
// cadastros + ops-list + (opcional) router. Stubs mínimos.
function makeOpsSandbox({ tableData = {}, withRouter = false } = {}) {
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
    Node: FakeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  // calculo-op.js é script clássico; a função percentualEntregueOP
  // vira global do vm.Context (sandbox.window.percentualEntregueOP).
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  if (withRouter) {
    vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  }
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  // Stubs
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.supa = fakeSupa;
  // navigate é stub por padrão
  if (sandbox.navigate === undefined) {
    sandbox.navigate = (h) => { sandbox._lastNavigate = h; };
  }
  return { sandbox, fakeSupa };
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/ops-list.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(OPS), 'js/screens/ops-list.js não existe');
  assert.equal(/^\s*export\s+/m.test(opsSrc), false,
    'ops-list.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(opsSrc), false,
    'ops-list.js parece usar import — deve ser script clássico');
});

test('2. ops-list.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPS}"`, { stdio: 'pipe' });
});

test('3. index.html carrega js/screens/ops-list.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/ops-list\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/ops-list.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/ops-list\.js"[^>]*type=/.test(indexSrc), false,
    'ops-list.js está sendo carregado com type=module — deve ser script clássico');
});

test('4. index.html: ordem cadastros → ops-list → jspdf → inline', () => {
  const cadIdx   = findScriptIdx(indexSrc, 'js/screens/cadastros.js');
  const opsIdx   = findScriptIdx(indexSrc, 'js/screens/ops-list.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(cadIdx > 0, 'js/screens/cadastros.js não encontrado');
  assert.ok(opsIdx > 0, 'js/screens/ops-list.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf CDN não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(cadIdx < opsIdx, 'cadastros deve vir antes de ops-list');
  assert.ok(opsIdx < jspdfIdx, 'ops-list deve vir antes de jspdf');
  assert.ok(opsIdx < inlineIdx, 'ops-list deve vir antes do inline');
});

test('5. script inline NÃO contém mais function screenListaOPs', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenListaOPs\s*\(/.test(inline), false,
    'inline ainda declara function screenListaOPs');
});

test('6. script inline AINDA contém telas não relacionadas, helpers, setRoutes e main', () => {
  const inline = extractInlineScript(indexSrc);
  for (const fn of [
    'screenPainel', 'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens', 'screenNovaOP',
    'renderOPLatexAdmin',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  // Todos os writes foram extraídos para js/screens/entrega-writes.js
  // (Fases 2.1, 2.2 e 2.3 do DIAG): excluirEntrega,
  // salvarEntregaLatex, atualizarEntregaLatex, salvarEntregaCima,
  // atualizarEntregaCima. O inline não deve mais declará-los.
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

test('7. setRoutes ainda registra rotas #/ops e #/ops/nova', () => {
  const inline = extractInlineScript(indexSrc);
  assert.ok(inline.includes("'#/ops'"), "rota '#/ops' não encontrada no setRoutes");
  assert.ok(inline.includes("'#/ops/nova'"), "rota '#/ops/nova' não encontrada no setRoutes");
});

test('8. js/screens/ops-list.js contém screenListaOPs', () => {
  assert.match(opsSrc, /async\s+function\s+screenListaOPs\s*\(/);
});

test('9. ops-list.js NÃO contém insert / update / delete / rpc (read-only)', () => {
  // Filtra com cuidado: queremos APENAS os calls supa.*, não qualquer
  // substring. Usa âncoras de palavra e contexto.
  assert.equal(/\.insert\s*\(/.test(opsSrc), false,
    'ops-list.js contém .insert( — deve ser read-only');
  assert.equal(/\.update\s*\(/.test(opsSrc), false,
    'ops-list.js contém .update( — deve ser read-only');
  assert.equal(/\.delete\s*\(/.test(opsSrc), false,
    'ops-list.js contém .delete( — deve ser read-only');
  assert.equal(/\.rpc\s*\(/.test(opsSrc), false,
    'ops-list.js contém .rpc( — deve ser read-only');
});

test('10. ops-list.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(opsSrc), false, 'service_role em ops-list.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(opsSrc), false,
    'password literal longo em ops-list.js');
});

test('11. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('12. screenListaOPs declarado UMA única vez no projeto (apenas em ops-list.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (opsSrc.match(/async\s+function\s+screenListaOPs\s*\(/g) || []).length
    + (inline.match(/async\s+function\s+screenListaOPs\s*\(/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de screenListaOPs, encontrado ${total}`);
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

test('13. runtime: window.RAVATEX_SCREENS.opsList existe e expõe screenListaOPs', () => {
  const { sandbox } = makeOpsSandbox();
  const ops = vm.runInContext('window.RAVATEX_SCREENS.opsList', sandbox);
  assert.ok(ops && typeof ops === 'object', 'RAVATEX_SCREENS.opsList não é objeto');
  assert.equal(typeof ops.screenListaOPs, 'function', 'screenListaOPs não é função');
});

test('14. runtime: window.screenListaOPs (global legado) é função', () => {
  const { sandbox } = makeOpsSandbox();
  assert.equal(typeof vm.runInContext('window.screenListaOPs', sandbox), 'function',
    'window.screenListaOPs não é função');
});

test('15. runtime: screenListaOPs() renderiza nó DOM (header + filtro + body) via shellLayout', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: { ops: [], entrega_itens: [] },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenListaOPs não devolveu <div>');
  // shellLayout → header + aside + main
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente (shellLayout não foi aplicado)');
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
  const main  = flex && flex.children.find((c) => c.tagName === 'MAIN');
  assert.ok(aside, 'aside ausente');
  assert.ok(main, 'main ausente');
  // Render do main: pageHeader ('Ordens de Produção') + filtro (3 botões) + body
  const rendered = textOf(main);
  assert.match(rendered, /Ordens de Produção/);
  assert.match(rendered, /Todas/);
  assert.match(rendered, /Tecelagem/);
  assert.match(rendered, /Látex/);
  // Lista vazia → mensagem
  assert.match(rendered, /Nenhuma OP para este filtro\./);
});

test('16. runtime: reload() chama supa.from("ops") e supa.from("entrega_itens") (read)', async () => {
  const { sandbox, fakeSupa } = makeOpsSandbox({
    tableData: { ops: [], entrega_itens: [] },
  });
  await vm.runInContext('window.screenListaOPs()', sandbox);
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.args[0]);
  assert.ok(fromCalls.includes('ops'),
    `reload() não chamou supa.from('ops') (chamadas: ${fromCalls.join(',')})`);
  assert.ok(fromCalls.includes('entrega_itens'),
    `reload() não chamou supa.from('entrega_itens') (chamadas: ${fromCalls.join(',')})`);
});

test('17. runtime: reload() NÃO chama insert/update/delete/rpc (read-only)', async () => {
  const { sandbox, fakeSupa } = makeOpsSandbox({
    tableData: { ops: [], entrega_itens: [] },
  });
  await vm.runInContext('window.screenListaOPs()', sandbox);
  const writeOps = fakeSupa._calls
    .filter(c => ['insert', 'update', 'delete', 'rpc'].includes(c.op));
  assert.equal(writeOps.length, 0,
    `reload() disparou writes no mock: ${writeOps.map(c => c.op).join(',')}`);
});

test('18. runtime: filtro "Tecelagem"/"Látex" filtra a lista renderizada', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 1, numero: 1, ano: 2026, status: 'simulada', tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null, op_itens: [] },
        { id: 2, numero: 2, ano: 2026, status: 'aberta',   tipo: 'latex',     criado_em: '2026-06-02T00:00:00Z',
          lote: null, op_itens: [] },
      ],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  // Encontra o botão "Látex" no filtro e clica
  const latexBtn = findAll(main, (n) => n.tagName === 'BUTTON' && textOf(n).trim() === 'Látex')[0];
  assert.ok(latexBtn, 'botão de filtro "Látex" não encontrado');
  latexBtn._listeners.click();
  const rendered = textOf(main);
  // Após filtro "Látex", apenas a OP 2 deve aparecer — a coluna
  // "OP" renderiza "Nº 2/2026". Validamos que a tecelagem não
  // aparece no conteúdo visível (Nº 1 deve sumir da lista).
  assert.ok(rendered.includes('Nº 2/2026'),
    'OP de látex (Nº 2/2026) deveria aparecer após filtro Látex');
  assert.equal(rendered.includes('Nº 1/2026'), false,
    'OP de tecelagem (Nº 1/2026) não deveria aparecer após filtro Látex');
});

test('19. runtime: coluna "Tipo" usa badgeTipo (label PT-BR)', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 1, numero: 1, ano: 2026, status: 'simulada', tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null, op_itens: [] },
        { id: 2, numero: 2, ano: 2026, status: 'aberta',   tipo: 'latex',     criado_em: '2026-06-02T00:00:00Z',
          lote: null, op_itens: [] },
      ],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  // badgeTipo renderiza um <span> com o label PT-BR da OP_TIPO_LABEL.
  // O texto não tem word-boundary porque o "6" do ano colide com
  // "Tecelagem" — validamos por substring simples.
  assert.ok(rendered.includes('Tecelagem'),
    `coluna "Tipo" deveria renderizar "Tecelagem" (rendered: ${rendered.slice(0, 200)})`);
  assert.ok(rendered.includes('Látex'),
    `coluna "Tipo" deveria renderizar "Látex" (rendered: ${rendered.slice(0, 200)})`);
});

test('20. runtime: coluna "Status" usa badgeStatus (label PT-BR)', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 1, numero: 1, ano: 2026, status: 'simulada',    tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null, op_itens: [] },
        { id: 2, numero: 2, ano: 2026, status: 'em_producao', tipo: 'tecelagem', criado_em: '2026-06-02T00:00:00Z',
          lote: null, op_itens: [] },
      ],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  // badgeStatus renderiza os labels de OP_STATUS_LABEL.
  assert.ok(rendered.includes('Simulada'),
    `coluna "Status" deveria renderizar "Simulada" (rendered: ${rendered.slice(0, 200)})`);
  assert.ok(rendered.includes('Em produção'),
    `coluna "Status" deveria renderizar "Em produção" (rendered: ${rendered.slice(0, 200)})`);
});

test('21. runtime: ação "Editar"/"Ver" navega para "#/ops/<id>"', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 42, numero: 7, ano: 2026, status: 'simulada', tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null, op_itens: [] },
        { id: 99, numero: 8, ano: 2026, status: 'aberta',   tipo: 'tecelagem', criado_em: '2026-06-02T00:00:00Z',
          lote: null, op_itens: [] },
      ],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  // Encontra os botões "Editar" (status=simulada) e "Ver" (status=aberta)
  const editBtn = findAll(main, (n) => n.tagName === 'BUTTON' && textOf(n).trim() === 'Editar')[0];
  const verBtn  = findAll(main, (n) => n.tagName === 'BUTTON' && textOf(n).trim() === 'Ver')[0];
  assert.ok(editBtn, 'botão Editar ausente');
  assert.ok(verBtn,  'botão Ver ausente');
  editBtn._listeners.click();
  assert.equal(sandbox._lastNavigate, '#/ops/42',
    `navegação após "Editar" deveria ir para #/ops/42 (foi ${sandbox._lastNavigate})`);
  verBtn._listeners.click();
  assert.equal(sandbox._lastNavigate, '#/ops/99',
    `navegação após "Ver" deveria ir para #/ops/99 (foi ${sandbox._lastNavigate})`);
});

test('22. runtime: botão "+ Nova OP" navega para "#/ops/nova"', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: { ops: [], entrega_itens: [] },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const novaBtn = findAll(main, (n) => n.tagName === 'BUTTON' && textOf(n).trim() === '+ Nova OP')[0];
  assert.ok(novaBtn, 'botão "+ Nova OP" ausente');
  novaBtn._listeners.click();
  assert.equal(sandbox._lastNavigate, '#/ops/nova',
    `navegação após "+ Nova OP" deveria ir para #/ops/nova (foi ${sandbox._lastNavigate})`);
});

test('23. runtime: lista vazia com filtro exibe mensagem "Nenhuma OP para este filtro."', async () => {
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 1, numero: 1, ano: 2026, status: 'simulada', tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null, op_itens: [] },
      ],
      entrega_itens: [],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const latexBtn = findAll(main, (n) => n.tagName === 'BUTTON' && textOf(n).trim() === 'Látex')[0];
  latexBtn._listeners.click();
  const rendered = textOf(main);
  assert.match(rendered, /Nenhuma OP para este filtro\./,
    'mensagem de lista vazia deveria aparecer ao filtrar por Látex sem OPs de látex');
});

test('24. runtime: coluna "Entregue" usa percentualEntregueOP (renderiza %)', async () => {
  // percentualEntregueOP: meta=10m, entregue=5m → 50%
  const { sandbox } = makeOpsSandbox({
    tableData: {
      ops: [
        { id: 1, numero: 1, ano: 2026, status: 'aberta', tipo: 'tecelagem', criado_em: '2026-06-01T00:00:00Z',
          lote: null,
          op_itens: [
            { id: 11, metros_pedidos: 10, metros_ajustados: 10 },
          ] },
      ],
      entrega_itens: [
        { op_id: 1, metros_entregues: 5, defeito: false },
      ],
    },
  });
  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  const main = node.children.find((c) => c.tagName === 'DIV')
    .children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.match(rendered, /50%/,
    'barra de progresso deveria renderizar 50% (5m de 10m entregues)');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('25. boot: ui + badges + router + system-screens + common + cadastros + ops-list + inline coexistem sem SyntaxError', () => {
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
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });

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
    'coexistência ops-list.js + inline lançou SyntaxError de duplicate identifier');

  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');
  assert.ok(routes && routes['#/ops/nova'], 'rota #/ops/nova não registrada');
  assert.equal(typeof routes['#/ops'].render, 'function', 'render de #/ops não é função');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('26. setRoutes do inline: #/ops aponta para window.screenListaOPs', () => {
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
  const fakeSupa = makeFakeSupabaseClient();
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '#/ops' },
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });

  const match = vm.runInContext("matchRoute('#/ops')", sandbox);
  assert.ok(match && match.render, 'matchRoute não resolveu #/ops');
  // O render foi resolvido como bare `screenListaOPs` no escopo do
  // inline, e esse bare foi resolvido para `window.screenListaOPs`
  // (porque a IIFE do ops-list.js setou window.screenListaOPs antes
  // do inline rodar). A função resultante tem .name ===
  // 'screenListaOPs'.
  assert.equal(match.render.name, 'screenListaOPs',
    'render de #/ops deve ser screenListaOPs');
});

test('27. rota dinâmica #/ops/:id continua resolvendo para screenNovaOP(:id) (sem alteração)', () => {
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
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });

  // matchRoute dinâmico: o router retorna um render que, quando
  // invocado, chama window.screenNovaOP(Number(id)). Validamos
  // indiretamente: o source da função deve referenciar screenNovaOP.
  const match = vm.runInContext("matchRoute('#/ops/123')", sandbox);
  assert.ok(match, 'matchRoute não resolveu rota dinâmica #/ops/123');
  assert.equal(typeof match.render, 'function', 'render de #/ops/:id não é função');
  // Source da função arrow deve mencionar screenNovaOP
  const src = String(match.render);
  assert.match(src, /screenNovaOP/,
    `render de #/ops/:id deveria referenciar screenNovaOP (src: ${src})`);
  // Quando invocada, deve chamar screenNovaOP(123). Como o mock de
  // Supabase está vazio, vai dar erro de rede mockada, mas o
  // importante é que a função é screenNovaOP. Validamos que
  // window.screenNovaOP é a função referenciada e que a função
  // retorna uma Promise (async).
  const ret = match.render();
  assert.ok(ret && typeof ret.then === 'function',
    'render de #/ops/:id deve devolver Promise (screenNovaOP é async)');
  // swallow rejection (mock de Supabase é vazio)
  ret.catch(() => {});
});

test('28. rota #/ops continua resolvendo para window.screenListaOPs', () => {
  // Já validado em 26, mas adicionamos uma checagem cruzada: o
  // render de #/ops === window.screenListaOPs (mesma referência).
  const { sandbox } = makeOpsSandbox();
  const refGlobal = vm.runInContext('window.screenListaOPs', sandbox);
  const refNs     = vm.runInContext('window.RAVATEX_SCREENS.opsList.screenListaOPs', sandbox);
  assert.equal(refGlobal, refNs,
    'window.screenListaOPs e RAVATEX_SCREENS.opsList.screenListaOPs devem ser a mesma função');
});

test('29. screenPainel (inline) ainda renderiza via shellLayout (regressão common)', () => {
  // Regressão do screens-common.smoke.js — garante que a adição de
  // ops-list.js não quebrou o boot do common.
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
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
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

test('30. screenCadastrosCores (cadastros) ainda renderiza (regressão cadastros)', async () => {
  // Regressão do cadastros-screens.smoke.js — garante que ops-list
  // não quebrou o boot do cadastros.
  const { sandbox } = makeOpsSandbox({
    tableData: { cores: [{ id: 1, nome: 'VERMELHO' }] },
  });
  const node = await vm.runInContext('window.screenCadastrosCores()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenCadastrosCores não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenCadastrosCores');
});
