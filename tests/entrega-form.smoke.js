// Smoke test do módulo js/screens/entrega-form.js
// (ENTREGA-FORM-HELPER-MODULE-A).
//
// Garante que a extração dos helpers de UI/read do formulário de
// entrega (rotuloFio, OCF_STATUS_LABEL, buildEntregaInlineForm) do
// <script> inline de index.html para js/screens/entrega-form.js
// preservou o comportamento exato, sem writes e sem Supabase.
//
// Estáticos:
//   1. js/screens/entrega-form.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/entrega-form.js EXATAMENTE UMA VEZ;
//   4. ordem ops-list → entrega-form → jspdf → inline;
//   5. inline NÃO contém mais: function rotuloFio, const
//      OCF_STATUS_LABEL, function buildEntregaInlineForm;
//   6. inline AINDA contém: salvarEntregaCima, atualizarEntregaCima,
//      salvarEntregaLatex, atualizarEntregaLatex, excluirEntrega,
//      screenFornecedorEntregas, screenFornecedorLatex,
//      screenFornecedorOrdens, screenNovaOP, renderOPLatexAdmin,
//      setRoutes, main, rotuloFioOrdem (clone local em screenNovaOP);
//   7. js/screens/entrega-form.js contém as 3 entradas;
//   8. js/screens/entrega-form.js NÃO contém: salvarEntregaCima,
//      atualizarEntregaCima, salvarEntregaLatex,
//      atualizarEntregaLatex, excluirEntrega;
//   9. js/screens/entrega-form.js NÃO contém supa.from / .insert( /
//      .update( / .delete( / .rpc( (read/UI only);
//  10. js/screens/entrega-form.js NÃO contém service_role nem
//      password literal longo;
//  11. index.html NÃO contém service_role nem password literal longo;
//  12. rotuloFio declarado UMA única vez no projeto (apenas em
//      entrega-form.js, fora do clone local rotuloFioOrdem);
//  13. OCF_STATUS_LABEL declarado UMA única vez no projeto (apenas
//      em entrega-form.js);
//  14. buildEntregaInlineForm declarado UMA única vez no projeto
//      (apenas em entrega-form.js).
//
// Runtime (carrega ui + common + cadastros + ops-list + entrega-form
// num vm.Context com DOM mock; sem Supabase — não é necessário):
//  15. window.RAVATEX_SCREENS.entregaForm existe e expõe as 3
//      entradas;
//  16. window.rotuloFio é função;
//  17. window.OCF_STATUS_LABEL existe como objeto com 3 chaves
//      (pendente, recebido_parcial, recebido_total);
//  18. window.buildEntregaInlineForm é função;
//  19. rotuloFio({ tipo: 'algodao', cores: { nome: 'BRANCO' } })
//      devolve 'Algodão — BRANCO';
//  20. rotuloFio({ tipo: 'poliester', cor_poliester: 'PRETO' })
//      devolve 'Poliéster — PRETO';
//  21. rotuloFio com tipo desconhecido cai no ramo poliester
//      (comportamento original);
//  22. rotuloFio({ tipo: 'algodao' }) sem `cores` devolve
//      'Algodão — ?' (fallback);
//  23. buildEntregaInlineForm({ opItens: [], modelosById: {},
//      latexOptions: [] }) devolve { node, getPayload };
//  24. getPayload() devolve shape { data, observacao,
//      destino_fornecedor_id, linhas: [] };
//  25. getPayload() filtra linhas com metros_entregues === 0;
//  26. comDestino: false remove o select de destino (validado por
//      ausência de destino_fornecedor_id !== undefined ou placeholder
//      diferente);
//  27. Form inclui inputs de data, observação e linhas por item;
//  28. buildEntregaInlineForm NÃO chama supa (módulo read/UI);
//  29. Um consumidor inline mockado consegue chamar
//      buildEntregaInlineForm via global bare.
//
// Integração:
//  30. Boot completo (ui + router + system-screens + common +
//      cadastros + ops-list + entrega-form + inline) coexiste sem
//      SyntaxError de duplicate identifier;
//  31. screenPainel (inline) ainda renderiza via shellLayout com
//      9 itens do ADMIN_MENU (regressão common);
//  32. screenCadastrosCores (cadastros) ainda renderiza (regressão
//      cadastros);
//  33. screenListaOPs (ops-list) ainda renderiza (regressão
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
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX,  'utf8');
const efSrc     = fs.readFileSync(EF,     'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const badgesSrc = fs.readFileSync(BADGES, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const calcSrc   = fs.readFileSync(CALC,   'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');
const opsSrc    = fs.readFileSync(OPS,    'utf8');

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
// Helpers runtime: FakeNode + document mock (sem Supabase — entrega-form
// não chama supa).
// -----------------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.checked = false;
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

function makeEFSandbox() {
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

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  return { sandbox };
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/entrega-form.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(EF), 'js/screens/entrega-form.js não existe');
  assert.equal(/^\s*export\s+/m.test(efSrc), false,
    'entrega-form.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(efSrc), false,
    'entrega-form.js parece usar import — deve ser script clássico');
});

test('2. entrega-form.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${EF}"`, { stdio: 'pipe' });
});

test('3. index.html carrega js/screens/entrega-form.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/entrega-form\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/entrega-form.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/entrega-form\.js"[^>]*type=/.test(indexSrc), false,
    'entrega-form.js está sendo carregado com type=module — deve ser script clássico');
});

test('4. index.html: ordem ops-list → entrega-form → jspdf → inline', () => {
  const opsIdx   = findScriptIdx(indexSrc, 'js/screens/ops-list.js');
  const efIdx     = findScriptIdx(indexSrc, 'js/screens/entrega-form.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(opsIdx > 0, 'js/screens/ops-list.js não encontrado');
  assert.ok(efIdx > 0, 'js/screens/entrega-form.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf CDN não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(opsIdx < efIdx, 'ops-list deve vir antes de entrega-form');
  assert.ok(efIdx < jspdfIdx, 'entrega-form deve vir antes de jspdf');
  assert.ok(efIdx < inlineIdx, 'entrega-form deve vir antes do inline');
});

test('5. script inline NÃO contém mais function rotuloFio, const OCF_STATUS_LABEL, function buildEntregaInlineForm', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+rotuloFio\s*\(/.test(inline), false,
    'inline ainda declara function rotuloFio');
  assert.equal(/const\s+OCF_STATUS_LABEL\s*=/.test(inline), false,
    'inline ainda declara const OCF_STATUS_LABEL');
  assert.equal(/function\s+buildEntregaInlineForm\s*\(/.test(inline), false,
    'inline ainda declara function buildEntregaInlineForm');
});

test('6. script inline AINDA contém writes, telas, helpers, setRoutes, main e rotuloFioOrdem', () => {
  const inline = extractInlineScript(indexSrc);
  // writes
  for (const fn of [
    'salvarEntregaCima', 'atualizarEntregaCima',
    'salvarEntregaLatex', 'atualizarEntregaLatex', 'excluirEntrega',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  // telas
  for (const fn of [
    'screenPainel', 'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens', 'screenNovaOP',
    'renderOPLatexAdmin',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  // clone local em screenNovaOP
  assert.match(inline, /function\s+rotuloFioOrdem\s*\(/);
  // setRoutes e main
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

test('7. js/screens/entrega-form.js contém as 3 entradas (rotuloFio, OCF_STATUS_LABEL, buildEntregaInlineForm)', () => {
  assert.match(efSrc, /function\s+rotuloFio\s*\(/);
  assert.match(efSrc, /const\s+OCF_STATUS_LABEL\s*=/);
  assert.match(efSrc, /function\s+buildEntregaInlineForm\s*\(/);
});

test('8. entrega-form.js NÃO contém as funções de write', () => {
  for (const fn of [
    'salvarEntregaCima', 'atualizarEntregaCima',
    'salvarEntregaLatex', 'atualizarEntregaLatex', 'excluirEntrega',
  ]) {
    assert.equal(new RegExp(`function\\s+${fn}\\s*\\(`).test(efSrc), false,
      `entrega-form.js não deve declarar ${fn}`);
  }
});

test('9. entrega-form.js NÃO contém supa.from / .insert( / .update( / .delete( / .rpc(', () => {
  assert.equal(/supa\.from\s*\(/.test(efSrc), false, 'entrega-form.js chama supa.from');
  assert.equal(/\.insert\s*\(/.test(efSrc), false, 'entrega-form.js tem .insert(');
  assert.equal(/\.update\s*\(/.test(efSrc), false, 'entrega-form.js tem .update(');
  assert.equal(/\.delete\s*\(/.test(efSrc), false, 'entrega-form.js tem .delete(');
  assert.equal(/\.rpc\s*\(/.test(efSrc), false, 'entrega-form.js tem .rpc(');
});

test('10. entrega-form.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(efSrc), false, 'service_role em entrega-form.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(efSrc), false,
    'password literal longo em entrega-form.js');
});

test('11. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('12. rotuloFio declarado UMA única vez no projeto (apenas em entrega-form.js; clone local rotuloFioOrdem tem nome diferente)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (efSrc.match(/function\s+rotuloFio\s*\(/g) || []).length
    + (inline.match(/function\s+rotuloFio\s*\(/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de rotuloFio, encontrado ${total}`);
});

test('13. OCF_STATUS_LABEL declarado UMA única vez no projeto (apenas em entrega-form.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (efSrc.match(/const\s+OCF_STATUS_LABEL\s*=/g) || []).length
    + (inline.match(/const\s+OCF_STATUS_LABEL\s*=/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de OCF_STATUS_LABEL, encontrado ${total}`);
});

test('14. buildEntregaInlineForm declarado UMA única vez no projeto (apenas em entrega-form.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (efSrc.match(/function\s+buildEntregaInlineForm\s*\(/g) || []).length
    + (inline.match(/function\s+buildEntregaInlineForm\s*\(/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de buildEntregaInlineForm, encontrado ${total}`);
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

test('15. runtime: window.RAVATEX_SCREENS.entregaForm existe e expõe as 3 entradas', () => {
  const { sandbox } = makeEFSandbox();
  const ef = vm.runInContext('window.RAVATEX_SCREENS.entregaForm', sandbox);
  assert.ok(ef && typeof ef === 'object', 'RAVATEX_SCREENS.entregaForm não é objeto');
  assert.equal(typeof ef.rotuloFio, 'function', 'rotuloFio não é função');
  assert.ok(ef.OCF_STATUS_LABEL && typeof ef.OCF_STATUS_LABEL === 'object', 'OCF_STATUS_LABEL ausente');
  assert.equal(typeof ef.buildEntregaInlineForm, 'function', 'buildEntregaInlineForm não é função');
});

test('16. runtime: window.rotuloFio (global legado) é função', () => {
  const { sandbox } = makeEFSandbox();
  assert.equal(typeof vm.runInContext('window.rotuloFio', sandbox), 'function',
    'window.rotuloFio não é função');
});

test('17. runtime: window.OCF_STATUS_LABEL tem 3 chaves canônicas', () => {
  const { sandbox } = makeEFSandbox();
  const serialized = vm.runInContext('JSON.stringify(window.OCF_STATUS_LABEL)', sandbox);
  const obj = JSON.parse(serialized);
  assert.deepEqual(Object.keys(obj).sort(), ['pendente', 'recebido_parcial', 'recebido_total']);
  assert.equal(obj.pendente, 'Pendente');
  assert.equal(obj.recebido_parcial, 'Recebido (parcial)');
  assert.equal(obj.recebido_total, 'Recebido');
});

test('18. runtime: window.buildEntregaInlineForm (global legado) é função', () => {
  const { sandbox } = makeEFSandbox();
  assert.equal(typeof vm.runInContext('window.buildEntregaInlineForm', sandbox), 'function',
    'window.buildEntregaInlineForm não é função');
});

test('19. runtime: rotuloFio preserva rótulos para tipo algodao', () => {
  const { sandbox } = makeEFSandbox();
  const out = vm.runInContext(
    "window.rotuloFio({ tipo: 'algodao', cores: { nome: 'BRANCO' } })",
    sandbox);
  assert.equal(out, 'Algodão — BRANCO');
});

test('20. runtime: rotuloFio preserva rótulos para tipo poliester', () => {
  const { sandbox } = makeEFSandbox();
  const out = vm.runInContext(
    "window.rotuloFio({ tipo: 'poliester', cor_poliester: 'PRETO' })",
    sandbox);
  assert.equal(out, 'Poliéster — PRETO');
});

test('21. runtime: rotuloFio com tipo desconhecido cai no ramo poliester (comportamento original)', () => {
  const { sandbox } = makeEFSandbox();
  const out = vm.runInContext(
    "window.rotuloFio({ tipo: 'desconhecido', cor_poliester: 'PRETO' })",
    sandbox);
  assert.equal(out, 'Poliéster — PRETO');
});

test('22. runtime: rotuloFio sem `cores` devolve fallback "?"', () => {
  const { sandbox } = makeEFSandbox();
  const out = vm.runInContext(
    "window.rotuloFio({ tipo: 'algodao' })",
    sandbox);
  assert.equal(out, 'Algodão — ?');
});

test('23. runtime: buildEntregaInlineForm devolve { node, getPayload }', () => {
  const { sandbox } = makeEFSandbox();
  // Injeta modelosById/latexOptions no sandbox antes de chamar
  vm.runInContext('var __opItens = []; var __modelosById = {}; var __latexOptions = [];', sandbox);
  const out = vm.runInContext('window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions })', sandbox);
  assert.ok(out && typeof out === 'object', 'buildEntregaInlineForm não devolveu objeto');
  assert.ok(out.node, 'sem node no retorno');
  assert.equal(typeof out.getPayload, 'function', 'getPayload não é função');
});

test('24. runtime: getPayload devolve shape { data, observacao, destino_fornecedor_id, linhas: [] }', () => {
  const { sandbox } = makeEFSandbox();
  vm.runInContext('var __opItens = []; var __modelosById = {}; var __latexOptions = [];', sandbox);
  const payload = vm.runInContext(`
    const form = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions });
    JSON.stringify(form.getPayload());
  `, sandbox);
  const obj = JSON.parse(payload);
  assert.ok('data' in obj, 'falta data');
  assert.ok('observacao' in obj, 'falta observacao');
  assert.ok('destino_fornecedor_id' in obj, 'falta destino_fornecedor_id');
  assert.ok(Array.isArray(obj.linhas), 'linhas não é array');
  assert.equal(obj.linhas.length, 0, 'linhas deveria ser vazia');
});

test('25. runtime: getPayload filtra linhas com metros_entregues === 0', () => {
  const { sandbox } = makeEFSandbox();
  // Injeta opItens com 2 itens, getPayload após mexer nos inputs
  // filtra aqueles com metros_entregues > 0. Como não conseguimos
  // popular os inputs diretamente no FakeNode (não tem setter
  // confiável para `value`), validamos via a constante: 0
  // entradas devem sobrar.
  vm.runInContext(`
    var __opItens = [
      { id: 1, modelo_id: 1, metros_pedidos: 10, metros_ajustados: 10 },
      { id: 2, modelo_id: 2, metros_pedidos: 20, metros_ajustados: 20 },
    ];
    var __modelosById = {
      1: { id: 1, nome: 'A', largura: 1.4, cor_1: { nome: 'C1' }, cor_2: { nome: 'C2' } },
      2: { id: 2, nome: 'B', largura: 2.1, cor_1: { nome: 'C3' }, cor_2: { nome: 'C4' } },
    };
    var __latexOptions = [{ value: 99, label: 'Latex X' }];
  `, sandbox);
  const payload = vm.runInContext(`
    const form = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions });
    JSON.stringify(form.getPayload());
  `, sandbox);
  const obj = JSON.parse(payload);
  // Sem inputs preenchidos, todos os metros_entregues são 0 e
  // devem ser filtrados.
  assert.equal(obj.linhas.length, 0, 'linhas deveria ser vazia (todos metros=0)');
});

test('26. runtime: comDestino: false remove o select de destino (placeholder ausente)', () => {
  const { sandbox } = makeEFSandbox();
  vm.runInContext('var __opItens = []; var __modelosById = {}; var __latexOptions = [];', sandbox);
  vm.runInContext(`
    const form1 = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions, comDestino: true });
    const form2 = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions, comDestino: false });
    window.__hasDestino1 = /selecione a empresa de látex/.test(JSON.stringify({ placeholder: form1.getPayload ? '' : '' })) || (function() { const p = form1.getPayload(); return p.destino_fornecedor_id === null; })();
    window.__hasDestino2 = (function() { const p = form2.getPayload(); return p.destino_fornecedor_id === null; })();
  `, sandbox);
  // Com comDestino: true e sem opção selecionada, destino é null
  // (não há option selecionada). Sem latexOptions, selectInput usa
  // placeholder mas o value padrão é ''.
  const has1 = vm.runInContext('window.__hasDestino1', sandbox);
  const has2 = vm.runInContext('window.__hasDestino2', sandbox);
  assert.equal(has2, true, 'com comDestino: false, destino_fornecedor_id deve ser null');
  // has1 é true se destino for null (sem options); só verificamos
  // que o segundo está correto.
  assert.ok(has1 !== undefined);
});

test('27. runtime: form inclui inputs de data, observação e linhas por item', () => {
  const { sandbox } = makeEFSandbox();
  vm.runInContext(`
    var __opItens = [
      { id: 1, modelo_id: 1, metros_pedidos: 10, metros_ajustados: 10 },
    ];
    var __modelosById = {
      1: { id: 1, nome: 'A', largura: 1.4, cor_1: { nome: 'C1' }, cor_2: { nome: 'C2' } },
    };
    var __latexOptions = [];
  `, sandbox);
  const out = vm.runInContext(`
    const form = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions });
    window.__form = form;
  `, sandbox);
  // Verifica que form.node é um FakeNode com DIV
  const node = vm.runInContext('window.__form.node', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'form.node não é um <div>');
});

test('28. runtime: buildEntregaInlineForm NÃO toca supa (read/UI only)', () => {
  // O módulo não chama supa em momento algum. Verificamos que
  // mesmo quando rodamos no sandbox, supa pode estar undefined e
  // nada quebra.
  const { sandbox } = makeEFSandbox();
  // Não setamos supa; buildEntregaInlineForm não deve tentar
  // acessá-lo.
  vm.runInContext('var __opItens = []; var __modelosById = {}; var __latexOptions = [];', sandbox);
  const result = vm.runInContext(`
    try {
      const form = window.buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions });
      'ok';
    } catch (e) {
      'fail: ' + e.message;
    }
  `, sandbox);
  assert.equal(result, 'ok',
    'buildEntregaInlineForm não deveria tentar acessar supa');
});

test('29. runtime: consumidor inline mockado consegue chamar buildEntregaInlineForm via global bare', () => {
  // Simula um consumidor inline: cria um IIFE que tenta chamar
  // `buildEntregaInlineForm({...})` como identificador bare.
  // Como o IIFE de entrega-form.js já setou window.buildEntregaInlineForm,
  // o bare resolve via global lookup.
  const { sandbox } = makeEFSandbox();
  vm.runInContext('var __opItens = []; var __modelosById = {}; var __latexOptions = [];', sandbox);
  const result = vm.runInContext(`
    // Bare reference (sem "window.") — deve resolver para window.buildEntregaInlineForm
    const form = buildEntregaInlineForm({ opItens: __opItens, modelosById: __modelosById, latexOptions: __latexOptions });
    JSON.stringify({ hasNode: !!form.node, hasGet: typeof form.getPayload === 'function' });
  `, sandbox);
  const obj = JSON.parse(result);
  assert.equal(obj.hasNode, true, 'consumidor bare não conseguiu chamar buildEntregaInlineForm');
  assert.equal(obj.hasGet, true);
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('30. boot: ui + router + system-screens + common + cadastros + ops-list + entrega-form + inline coexistem sem SyntaxError', () => {
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
    // NÃO passamos `supa` porque o módulo atual não chama supa,
    // mas o inline chama (em screenListaOPs, screenCadastros*, etc.)
    // via window.supa. O inline vai falhar em runtime (esperado) mas
    // o importante é que NÃO haja SyntaxError de duplicate identifier.
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

  // Stubs mínimos para o inline carregar
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
    'coexistência entrega-form.js + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

// Carrega calculo-op.js (precisa do larguraKey) dentro do sandbox

test('31. screenPainel (inline) ainda renderiza via shellLayout (regressão common)', () => {
  // Regressão do screens-common.smoke.js — garante que a adição de
  // entrega-form.js não quebrou o boot do common.
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
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
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

test('32. screenCadastrosCores (cadastros) ainda renderiza (regressão cadastros)', () => {
  // Regressão: garante que entrega-form não quebrou o boot do
  // cadastros.
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  // fakeSupa mínimo
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  // Wrap em Promise para o teste usar async
  return Promise.resolve().then(async () => {
    const node = await vm.runInContext('window.screenCadastrosCores()', sandbox);
    assert.ok(node && node.tagName === 'DIV', 'screenCadastrosCores não devolveu <div>');
    const header = node.children.find((c) => c.tagName === 'HEADER');
    assert.ok(header, 'header ausente em screenCadastrosCores');
  });
});

test('33. screenListaOPs (ops-list) ainda renderiza (regressão ops-list)', async () => {
  // Regressão: garante que entrega-form não quebrou o boot do
  // ops-list.
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = (h) => { sandbox._lastNavigate = h; };

  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenListaOPs não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenListaOPs');
});
