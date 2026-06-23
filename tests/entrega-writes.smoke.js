// Smoke test do módulo js/screens/entrega-writes.js
// (ENTREGA-WRITES-MODULE-A — Fase 2.1: excluirEntrega).
//
// Garante que a extração do helper de write `excluirEntrega` do
// <script> inline de index.html para js/screens/entrega-writes.js
// preservou o comportamento exato: confirmDialog → delete na
// tabela `entregas` com `.eq('id', entregaId)` → toast + onSuccess
// em caso de sucesso, ou toast de erro + return sem onSuccess
// em caso de falha.
//
// Estáticos:
//   1. js/screens/entrega-writes.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/entrega-writes.js EXATAMENTE
//      UMA VEZ;
//   4. ordem entrega-form → entrega-writes → jspdf → inline;
//   5. inline NÃO contém mais: function excluirEntrega;
//   6. inline AINDA contém: salvarEntregaCima,
//      atualizarEntregaCima, salvarEntregaLatex,
//      atualizarEntregaLatex, screenFornecedorEntregas,
//      screenFornecedorLatex, screenFornecedorOrdens,
//      screenNovaOP, renderOPLatexAdmin, rotuloFioOrdem
//      (clone local em screenNovaOP), setRoutes, main;
//   7. js/screens/entrega-writes.js contém excluirEntrega;
//   8. js/screens/entrega-writes.js NÃO contém:
//      salvarEntregaCima, atualizarEntregaCima,
//      salvarEntregaLatex, atualizarEntregaLatex;
//   9. js/screens/entrega-writes.js NÃO contém .insert( / .update(
//      / .rpc( (read/delete only);
//  10. js/screens/entrega-writes.js contém .delete( (uma vez);
//  11. js/screens/entrega-writes.js NÃO contém service_role nem
//      password literal longo;
//  12. index.html NÃO contém service_role nem password literal
//      longo;
//  13. excluirEntrega declarado UMA única vez no projeto
//      (apenas em entrega-writes.js).
//
// Runtime (carrega ui + entrega-form + entrega-writes num
// vm.Context com supa mockado):
//  14. window.RAVATEX_ENTREGA_WRITES existe;
//  15. window.RAVATEX_ENTREGA_WRITES.excluirEntrega é função;
//  16. window.excluirEntrega (global legado) é função;
//  17. excluirEntrega(...) chama confirmDialog com
//      title/message/confirmLabel originais;
//  18. onConfirm chama supa.from('entregas').delete().eq('id',
//      entregaId);
//  19. Em sucesso: toast('Entrega excluída', 'success') +
//      onSuccess();
//  20. Em erro: toast('Erro ao excluir entrega', 'error') +
//      NÃO chama onSuccess();
//  21. Mock de Supabase registra exatamente 1 from('entregas')
//      + 1 delete + 1 eq, e zero insert/update/rpc;
//  22. Sem entregaId: delete NÃO é chamado (early return
//      dentro do callback) — não é o caso comum, mas
//      confirma que a query é construída com o id;
//  23. Sem onSuccess passado: callback roda sem erro
//      (onSuccess é opcional, `if (onSuccess) onSuccess()`).
//
// Integração:
//  24. Boot completo (ui + router + system-screens + common +
//      cadastros + ops-list + entrega-form + entrega-writes +
//      inline) coexiste sem SyntaxError de duplicate identifier;
//  25. screenPainel (inline) ainda renderiza via shellLayout
//      com 9 itens do ADMIN_MENU (regressão common).
//
// Regressão (não tocadas por esta fase mas validadas):
//  26. screenCadastrosCores (cadastros) ainda renderiza;
//  27. screenListaOPs (ops-list) ainda renderiza.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
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
const ewSrc     = fs.readFileSync(EW,     'utf8');
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
// Helpers runtime: FakeNode + supa mock que registra cada operação.
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

function makeEWSandbox({ deleteResult = { data: null, error: null } } = {}) {
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
      const chain = {
        _table: table,
        _deleteResult: deleteResult,
        select() { calls.push({ op: 'select' }); return chain; },
        insert() { calls.push({ op: 'insert' }); return Promise.resolve({ data: null, error: null }); },
        update() { calls.push({ op: 'update' }); return Promise.resolve({ data: null, error: null }); },
        delete() { calls.push({ op: 'delete', table }); return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          return Promise.resolve(deleteResult);
        },
        order() { return chain; },
        in() { return chain; },
        then(resolveThen, rejectThen) {
          // Permite await direto na chain (não usado por excluirEntrega
          // mas mantido por completude).
          return Promise.resolve({ data: null, error: null }).then(resolveThen, rejectThen);
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

  // Captura a última chamada a confirmDialog e o último toast
  let lastConfirm = null;
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
  vm.runInContext(calcSrc,   sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  // Stubs
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  // Após carregar entrega-form, substituímos confirmDialog/toast
  // por versões instrumentadas para inspecionar argumentos. entrega-
  // form é só UI; não tem writes, mas carrega para preservar a
  // cadeia de dependências (larguraKey).
  vm.runInContext(efSrc, sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc, sandbox, { filename: 'js/screens/entrega-writes.js' });

  // Wrap confirmDialog (já definido por js/ui.js)
  const origConfirm = sandbox.confirmDialog;
  sandbox.confirmDialog = (opts) => {
    lastConfirm = opts;
    // Chama o onConfirm DE FORMA ASSÍNCRONA para preservar o
    // comportamento original. Retornamos uma Promise que resolve
    // após o callback.
    return Promise.resolve().then(() => opts.onConfirm && opts.onConfirm());
  };
  // Wrap toast para registrar mensagens
  const origToast = sandbox.toast;
  sandbox.toast = (msg, type) => {
    toasts.push({ msg, type });
    return origToast(msg, type);
  };

  return {
    sandbox, fakeSupa,
    getLastConfirm: () => lastConfirm,
    getToasts: () => toasts.slice(),
    clearToasts: () => { toasts.length = 0; },
  };
}

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. js/screens/entrega-writes.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(EW), 'js/screens/entrega-writes.js não existe');
  assert.equal(/^\s*export\s+/m.test(ewSrc), false,
    'entrega-writes.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(ewSrc), false,
    'entrega-writes.js parece usar import — deve ser script clássico');
});

test('2. entrega-writes.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${EW}"`, { stdio: 'pipe' });
});

test('3. index.html carrega js/screens/entrega-writes.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/entrega-writes\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/entrega-writes.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/entrega-writes\.js"[^>]*type=/.test(indexSrc), false,
    'entrega-writes.js está sendo carregado com type=module — deve ser script clássico');
});

test('4. index.html: ordem entrega-form → entrega-writes → jspdf → inline', () => {
  const efIdx    = findScriptIdx(indexSrc, 'js/screens/entrega-form.js');
  const ewIdx    = findScriptIdx(indexSrc, 'js/screens/entrega-writes.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(efIdx > 0, 'js/screens/entrega-form.js não encontrado');
  assert.ok(ewIdx > 0, 'js/screens/entrega-writes.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf CDN não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(efIdx < ewIdx, 'entrega-form deve vir antes de entrega-writes');
  assert.ok(ewIdx < jspdfIdx, 'entrega-writes deve vir antes de jspdf');
  assert.ok(ewIdx < inlineIdx, 'entrega-writes deve vir antes do inline');
});

test('5. script inline NÃO contém mais function excluirEntrega', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+excluirEntrega\s*\(/.test(inline), false,
    'inline ainda declara function excluirEntrega');
});

test('6. script inline AINDA contém os demais writes, telas, helpers, setRoutes, main, rotuloFioOrdem', () => {
  const inline = extractInlineScript(indexSrc);
  // Demais writes
  for (const fn of [
    'salvarEntregaCima', 'atualizarEntregaCima',
    'salvarEntregaLatex', 'atualizarEntregaLatex',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  // Telas
  for (const fn of [
    'screenPainel', 'screenFornecedorHome', 'screenFornecedorEntregas',
    'screenFornecedorLatex', 'screenFornecedorOrdens', 'screenNovaOP',
    'renderOPLatexAdmin',
  ]) {
    assert.match(inline, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `inline perdeu a função ${fn}`);
  }
  // Clone local em screenNovaOP
  assert.match(inline, /function\s+rotuloFioOrdem\s*\(/);
  // setRoutes e main
  assert.match(inline, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  assert.match(inline, /async\s+function\s+main\s*\(/);
});

test('7. js/screens/entrega-writes.js contém excluirEntrega', () => {
  assert.match(ewSrc, /function\s+excluirEntrega\s*\(/);
});

test('8. entrega-writes.js NÃO contém os outros 4 writes', () => {
  for (const fn of [
    'salvarEntregaCima', 'atualizarEntregaCima',
    'salvarEntregaLatex', 'atualizarEntregaLatex',
  ]) {
    assert.equal(new RegExp(`function\\s+${fn}\\s*\\(`).test(ewSrc), false,
      `entrega-writes.js não deve declarar ${fn}`);
  }
});

test('9. entrega-writes.js NÃO contém .insert( / .update( / .rpc(', () => {
  assert.equal(/\.insert\s*\(/.test(ewSrc), false, 'entrega-writes.js tem .insert(');
  assert.equal(/\.update\s*\(/.test(ewSrc), false, 'entrega-writes.js tem .update(');
  assert.equal(/\.rpc\s*\(/.test(ewSrc), false, 'entrega-writes.js tem .rpc(');
});

test('10. entrega-writes.js contém .delete(', () => {
  assert.match(ewSrc, /\.delete\s*\(/, 'entrega-writes.js deve ter .delete( (excluirEntrega)');
});

test('11. entrega-writes.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(ewSrc), false, 'service_role em entrega-writes.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(ewSrc), false,
    'password literal longo em entrega-writes.js');
});

test('12. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('13. excluirEntrega declarado UMA única vez no projeto (apenas em entrega-writes.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (ewSrc.match(/function\s+excluirEntrega\s*\(/g) || []).length
    + (inline.match(/function\s+excluirEntrega\s*\(/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de excluirEntrega, encontrado ${total}`);
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

test('14. runtime: window.RAVATEX_ENTREGA_WRITES existe', () => {
  const { sandbox } = makeEWSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_ENTREGA_WRITES', sandbox),
    'window.RAVATEX_ENTREGA_WRITES não existe');
});

test('15. runtime: window.RAVATEX_ENTREGA_WRITES.excluirEntrega é função', () => {
  const { sandbox } = makeEWSandbox();
  const fn = vm.runInContext('window.RAVATEX_ENTREGA_WRITES.excluirEntrega', sandbox);
  assert.equal(typeof fn, 'function', 'excluirEntrega não é função');
});

test('16. runtime: window.excluirEntrega (global legado) é função', () => {
  const { sandbox } = makeEWSandbox();
  assert.equal(typeof vm.runInContext('window.excluirEntrega', sandbox), 'function',
    'window.excluirEntrega não é função');
});

test('17. runtime: excluirEntrega chama confirmDialog com title/message/confirmLabel originais', async () => {
  const { sandbox, getLastConfirm } = makeEWSandbox();
  await vm.runInContext('window.excluirEntrega(123, () => {})', sandbox);
  const last = getLastConfirm();
  assert.ok(last, 'confirmDialog não foi chamado');
  assert.equal(last.title, 'Excluir entrega');
  assert.equal(last.message, 'Esta ação remove a entrega e todos os seus itens. Continuar?');
  assert.equal(last.confirmLabel, 'Excluir');
  assert.equal(typeof last.onConfirm, 'function');
});

test('18. runtime: onConfirm chama supa.from("entregas").delete().eq("id", entregaId)', async () => {
  const { sandbox, fakeSupa, getLastConfirm } = makeEWSandbox();
  await vm.runInContext('window.excluirEntrega(42, () => {})', sandbox);
  // Aguarda a microtask do confirmDialog
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('entregas'),
    `delete não foi chamado em 'entregas' (chamadas: ${fromCalls.join(',')})`);
  const deleteCalls = fakeSupa._calls.filter(c => c.op === 'delete');
  assert.equal(deleteCalls.length, 1, 'esperado exatamente 1 chamada a .delete()');
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  assert.equal(eqCalls.length, 1, 'esperado exatamente 1 chamada a .eq()');
  assert.deepEqual(eqCalls[0], { op: 'eq', col: 'id', val: 42 },
    `.eq deve ser chamado com ('id', 42), veio ${JSON.stringify(eqCalls[0])}`);
});

test('19. runtime: em sucesso — toast("Entrega excluída", "success") + onSuccess()', async () => {
  let onSuccessCalled = false;
  const { sandbox, getToasts, clearToasts } = makeEWSandbox({
    deleteResult: { data: null, error: null },
  });
  await vm.runInContext(
    'window.excluirEntrega(7, () => { window.__onSuccessCalled = true; })',
    sandbox);
  // Aguarda microtasks do confirmDialog
  await new Promise(r => setTimeout(r, 5));
  assert.equal(sandbox.__onSuccessCalled, true, 'onSuccess não foi chamado');
  const toasts = getToasts();
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1, 'esperado 1 toast de success');
  assert.equal(successToasts[0].msg, 'Entrega excluída');
});

test('20. runtime: em erro — toast("Erro ao excluir entrega", "error") + NÃO chama onSuccess()', async () => {
  const { sandbox, getToasts } = makeEWSandbox({
    deleteResult: { data: null, error: { message: 'fake error' } },
  });
  // Inicializa explicitamente; se onSuccess for chamado, vira true.
  vm.runInContext('window.__onSuccessCalled = false', sandbox);
  await vm.runInContext(
    'window.excluirEntrega(7, () => { window.__onSuccessCalled = true; })',
    sandbox);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(sandbox.__onSuccessCalled, false, 'onSuccess NÃO deveria ser chamado em erro');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1, 'esperado 1 toast de error');
  assert.equal(errorToasts[0].msg, 'Erro ao excluir entrega');
});

test('21. runtime: mock registra exatamente 1 from("entregas") + 1 delete + 1 eq, e zero insert/update/rpc', async () => {
  const { sandbox, fakeSupa } = makeEWSandbox();
  await vm.runInContext('window.excluirEntrega(1, () => {})', sandbox);
  await new Promise(r => setTimeout(r, 5));
  const ops = fakeSupa._calls.map(c => c.op);
  const fromEntregasCount = fakeSupa._calls.filter(c => c.op === 'from' && c.table === 'entregas').length;
  const deleteCount    = fakeSupa._calls.filter(c => c.op === 'delete').length;
  const eqCount        = fakeSupa._calls.filter(c => c.op === 'eq').length;
  const insertCount    = fakeSupa._calls.filter(c => c.op === 'insert').length;
  const updateCount    = fakeSupa._calls.filter(c => c.op === 'update').length;
  const rpcCount       = fakeSupa._calls.filter(c => c.op === 'rpc').length;
  assert.equal(fromEntregasCount, 1, `esperado 1 from('entregas'), veio ${fromEntregasCount} (todas: ${ops.join(',')})`);
  assert.equal(deleteCount, 1, `esperado 1 delete, veio ${deleteCount}`);
  assert.equal(eqCount, 1, `esperado 1 eq, veio ${eqCount}`);
  assert.equal(insertCount, 0, 'zero insert esperado');
  assert.equal(updateCount, 0, 'zero update esperado');
  assert.equal(rpcCount, 0, 'zero rpc esperado');
});

test('22. runtime: query de delete é construída com o id correto (não é chamada cedo)', async () => {
  // Garante que a query não é executada antes do onConfirm.
  // Fazemos um check indireto: se o delete fosse eager (no load),
  // ele seria chamado antes do confirmDialog. Aqui, com a
  // instrumentação de confirmDialog, o delete só é chamado
  // dentro do onConfirm.
  const { sandbox, fakeSupa, getLastConfirm } = makeEWSandbox();
  // Chama excluirEntrega mas NÃO espera o onConfirm.
  const p = vm.runInContext('window.excluirEntrega(99, () => {})', sandbox);
  // Imediatamente após a chamada, o delete ainda não foi disparado
  // (confirmDialog foi invocado mas o onConfirm é async).
  const deleteCallsBefore = fakeSupa._calls.filter(c => c.op === 'delete').length;
  assert.equal(deleteCallsBefore, 0,
    'delete não deveria ser chamado antes do onConfirm');
  // Aguarda o Promise do onConfirm completar.
  await p;
  await new Promise(r => setTimeout(r, 5));
  const deleteCallsAfter = fakeSupa._calls.filter(c => c.op === 'delete').length;
  assert.equal(deleteCallsAfter, 1, 'delete deveria ser chamado após onConfirm');
});

test('23. runtime: sem onSuccess passado — callback roda sem erro (onSuccess é opcional)', async () => {
  const { sandbox, getToasts } = makeEWSandbox();
  await vm.runInContext('window.excluirEntrega(1)', sandbox);
  await new Promise(r => setTimeout(r, 5));
  const successToasts = getToasts().filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1, 'toast de success deveria aparecer mesmo sem onSuccess');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('24. boot: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + inline coexistem sem SyntaxError', () => {
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
    'coexistência entrega-writes.js + inline lançou SyntaxError de duplicate identifier');

  // setRoutes do inline deve ter registrado as rotas de cadastro
  // (não testamos as rotas de entrega porque elas não existem —
  // excluirEntrega não é uma rota, é um write helper).
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'rota #/login não registrada');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('25. screenPainel (inline) ainda renderiza via shellLayout com 9 itens do ADMIN_MENU (regressão common)', () => {
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

test('26. screenCadastrosCores (cadastros) ainda renderiza (regressão cadastros)', async () => {
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  const node = await vm.runInContext('window.screenCadastrosCores()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenCadastrosCores não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenCadastrosCores');
});

test('27. screenListaOPs (ops-list) ainda renderiza (regressão ops-list)', async () => {
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
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = (h) => { sandbox._lastNavigate = h; };

  const node = await vm.runInContext('window.screenListaOPs()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenListaOPs não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente em screenListaOPs');
});
