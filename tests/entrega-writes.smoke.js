// Smoke test do módulo js/screens/entrega-writes.js
// (ENTREGA-WRITES-MODULE-A — Fases 2.1, 2.2 e 2.3 do DIAG).
//
// Garante que a extração dos helpers de write
// `excluirEntrega`, `salvarEntregaLatex`, `atualizarEntregaLatex`,
// `salvarEntregaCima` e `atualizarEntregaCima`
// do <script> inline de index.html para js/screens/entrega-writes.js
// preservou o comportamento exato, incluindo:
//   - a RPC `gerar_op_latex` chamada em modo best-effort por
//     `salvarEntregaCima` (Falha da RPC NÃO desfaz a entrega);
//   - o delete+insert não transacional de `atualizarEntregaCima`
//     (estado inconsistente aceito por design).
//
// Estáticos:
//   1. js/screens/entrega-writes.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega js/screens/entrega-writes.js EXATAMENTE
//      UMA VEZ;
//   4. ordem entrega-form → entrega-writes → jspdf → inline;
//   5. inline NÃO contém mais: function excluirEntrega,
//      function salvarEntregaLatex, function
//      atualizarEntregaLatex, function salvarEntregaCima,
//      function atualizarEntregaCima;
//   6. inline AINDA contém: screenFornecedorEntregas,
//      screenFornecedorLatex, screenFornecedorOrdens,
//      screenNovaOP, renderOPLatexAdmin, rotuloFioOrdem
//      (clone local em screenNovaOP), setRoutes, main;
//   7. js/screens/entrega-writes.js contém excluirEntrega,
//      salvarEntregaLatex, atualizarEntregaLatex,
//      salvarEntregaCima, atualizarEntregaCima;
//   8. js/screens/entrega-writes.js contém `gerar_op_latex` e
//      `.rpc(` (Cima usa rpc best-effort);
//   9. js/screens/entrega-writes.js contém .delete( (uma vez para
//      excluirEntrega, e mais usos para salvar/atualizar Latex/Cima);
//  10. js/screens/entrega-writes.js NÃO contém service_role nem
//      password literal longo;
//  11. index.html NÃO contém service_role nem password literal
//      longo;
//  12. excluirEntrega declarado UMA única vez no projeto
//      (apenas em entrega-writes.js).
//
// Runtime (carrega ui + entrega-form + entrega-writes num
// vm.Context com supa mockado):
//  13. window.RAVATEX_ENTREGA_WRITES existe;
//  14. window.RAVATEX_ENTREGA_WRITES.excluirEntrega é função;
//  15. window.excluirEntrega (global legado) é função;
//  16. excluirEntrega(...) chama confirmDialog com
//      title/message/confirmLabel originais;
//  17. onConfirm chama supa.from('entregas').delete().eq('id',
//      entregaId);
//  18. Em sucesso: toast('Entrega excluída', 'success') +
//      onSuccess();
//  19. Em erro: toast('Erro ao excluir entrega', 'error') +
//      NÃO chama onSuccess();
//  20. Mock de Supabase registra exatamente 1 from('entregas')
//      + 1 delete + 1 eq, e zero insert/update/rpc;
//  21. Sem entregaId: delete NÃO é chamado (early return
//      dentro do callback) — não é o caso comum, mas
//      confirma que a query é construída com o id;
//  22. Sem onSuccess passado: callback roda sem erro
//      (onSuccess é opcional, `if (onSuccess) onSuccess()`).
//
// Runtime — salvarEntregaLatex:
//  23. window.RAVATEX_ENTREGA_WRITES.salvarEntregaLatex é função;
//  24. window.salvarEntregaLatex (global legado) é função;
//  25. window.RAVATEX_ENTREGA_WRITES.atualizarEntregaLatex é função;
//  26. window.atualizarEntregaLatex (global legado) é função;
//  27. salvarEntregaLatex com payload vazio → toast + return false;
//  28. salvarEntregaLatex happy path — 1 insert entregas +
//      1 insert itens + 0 rpc + toast success;
//  29. salvarEntregaLatex rollback — insert entregas OK, insert
//      itens falha → delete entregas;
//  30. salvarEntregaLatex insert entregas falha → toast error +
//      return false (sem rollback);
//  31. atualizarEntregaLatex com payload vazio → toast + return false;
//  32. atualizarEntregaLatex happy path — update + delete + insert;
//  33. atualizarEntregaLatex update falha → toast + return false
//      (sem delete/insert);
//  34. atualizarEntregaLatex insert itens falha → toast +
//      return false (sem rollback, estado inconsistente aceito);
//  35. nenhum helper Latex chama .rpc();
//  36. consumidor inline mockado consegue chamar
//      salvarEntregaLatex via global bare;
//  37. consumidor inline mockado consegue chamar
//      atualizarEntregaLatex via global bare.
//
// Runtime — salvarEntregaCima / atualizarEntregaCima:
//  38. window.RAVATEX_ENTREGA_WRITES.salvarEntregaCima é função;
//  39. window.salvarEntregaCima (global legado) é função;
//  40. window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima é função;
//  41. window.atualizarEntregaCima (global legado) é função;
//  42. salvarEntregaCima com payload vazio → toast + return false;
//  43. salvarEntregaCima sem destino_fornecedor_id → toast +
//      return false;
//  44. salvarEntregaCima happy path — insert entregas etapa='cima'
//      + destino_fornecedor_id + insert itens + rpc gerar_op_latex
//      best-effort + toast success com "OP de látex gerada";
//  45. salvarEntregaCima RPC falhando → entrega é mantida, toast
//      específico de erro da RPC, console.error, return true;
//  46. salvarEntregaCima insert entregas falha → toast error +
//      return false (sem rollback, sem rpc);
//  47. salvarEntregaCima insert itens falha → rollback delete
//      entregas + toast error + return false;
//  48. atualizarEntregaCima com payload vazio → toast + return false;
//  49. atualizarEntregaCima happy path — update (com
//      destino_fornecedor_id) + delete + insert;
//  50. atualizarEntregaCima update falha → toast + return false
//      (sem delete/insert);
//  51. atualizarEntregaCima insert itens falha → toast +
//      return false (sem rollback, estado inconsistente aceito);
//  52. consumidor inline mockado consegue chamar
//      salvarEntregaCima via global bare;
//  53. consumidor inline mockado consegue chamar
//      atualizarEntregaCima via global bare.
//
// Integração:
//  54. Boot completo (ui + router + system-screens + common +
//      cadastros + ops-list + entrega-form + entrega-writes +
//      inline) coexiste sem SyntaxError de duplicate identifier;
//  55. screenPainel (inline) ainda renderiza via shellLayout
//      com 9 itens do ADMIN_MENU (regressão common).
//
// Regressão (não tocadas por esta fase mas validadas):
//  56. screenCadastrosCores (cadastros) ainda renderiza;
//  57. screenListaOPs (ops-list) ainda renderiza.

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

test('6. script inline AINDA contém as telas, helpers, setRoutes, main, rotuloFioOrdem', () => {
  const inline = extractInlineScript(indexSrc);
  // Todos os writes foram extraídos para js/screens/entrega-writes.js
  // (Fases 2.1, 2.2 e 2.3 do DIAG). O inline NÃO deve mais
  // declarar: excluirEntrega, salvarEntregaLatex,
  // atualizarEntregaLatex, salvarEntregaCima, atualizarEntregaCima.
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

test('7. js/screens/entrega-writes.js contém todos os 5 writes extraídos', () => {
  for (const fn of [
    'excluirEntrega', 'salvarEntregaLatex', 'atualizarEntregaLatex',
    'salvarEntregaCima', 'atualizarEntregaCima',
  ]) {
    assert.match(ewSrc, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `entrega-writes.js deve declarar ${fn}`);
  }
});

test('8. entrega-writes.js contém gerar_op_latex e .rpc( (Cima usa rpc best-effort)', () => {
  // salvarEntregaCima chama RPC `gerar_op_latex` em modo
  // best-effort. A presença do literal e do .rpc( é a única
  // assinatura estática dessa responsabilidade no módulo.
  assert.match(ewSrc, /gerar_op_latex/,
    'entrega-writes.js não tem literal gerar_op_latex — esperado em salvarEntregaCima');
  assert.match(ewSrc, /\.rpc\s*\(/,
    'entrega-writes.js não tem .rpc( — esperado em salvarEntregaCima');
  // A chamada real deve ser feita via supa.rpc() (window.supa)
  const rpcCalls = (ewSrc.match(/supa\.rpc\(/g) || []).length;
  assert.ok(rpcCalls >= 1,
    'entrega-writes.js faz ' + rpcCalls + ' chamada(s) a supa.rpc() — esperado ≥ 1 (Cima)');
});

test('9. entrega-writes.js contém .delete(', () => {
  assert.match(ewSrc, /\.delete\s*\(/, 'entrega-writes.js deve ter .delete( (excluirEntrega)');
});

test('10. entrega-writes.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(ewSrc), false, 'service_role em entrega-writes.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(ewSrc), false,
    'password literal longo em entrega-writes.js');
});

test('11. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('12. excluirEntrega declarado UMA única vez no projeto (apenas em entrega-writes.js)', () => {
  const inline = extractInlineScript(indexSrc);
  const total = (ewSrc.match(/function\s+excluirEntrega\s*\(/g) || []).length
    + (inline.match(/function\s+excluirEntrega\s*\(/g) || []).length;
  assert.equal(total, 1, `esperado 1 declaração de excluirEntrega, encontrado ${total}`);
});

test('13. estático: entrega-writes.js publica as 5 chaves no namespace e nas globais legadas', () => {
  for (const fn of [
    'excluirEntrega', 'salvarEntregaLatex', 'atualizarEntregaLatex',
    'salvarEntregaCima', 'atualizarEntregaCima',
  ]) {
    assert.match(ewSrc, new RegExp(`window\\.RAVATEX_ENTREGA_WRITES\\.${fn}\\s*=`),
      `namespace RAVATEX_ENTREGA_WRITES não publicou ${fn}`);
    assert.match(ewSrc, new RegExp(`window\\.${fn}\\s*=\\s*${fn}`),
      `global legado window.${fn} não foi preservado`);
  }
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
// 2.5. Runtime — salvarEntregaLatex
// -----------------------------------------------------------------------------

// Helper para o sandbox com controle programático do resultado de
// cada operação (insert entregas, insert itens, delete, etc).
// Diferente de excluirEntrega (que sempre deleta), os Latex writes
// fazem insert+insert+delete-rollback OU update+delete+insert.
//
// O mock é uma chain fluente: insert/update/delete devolvem a
// própria chain, e o "terminal" (eq ou single) resolve com o
// resultado configurado. Para o caso `insert().select().single()`
// (usado por salvarEntregaLatex), a chain tem um `single()` que
// resolve com o resultado de entregasInsertResult.

function makeEWLatexSandbox({
  entregasInsertResult = { data: { id: 999 }, error: null },
  entregasItensInsertResult = { data: null, error: null },
  entregasUpdateResult = { data: null, error: null },
  entregasItensDeleteResult = { data: null, error: null },
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
      let pendingResult = null;
      const chain = {
        _table: table,
        _result: null,
        select() {
          calls.push({ op: 'select', table });
          return chain;
        },
        insert(payload) {
          calls.push({ op: 'insert', table, args: [payload] });
          if (table === 'entregas') {
            pendingResult = entregasInsertResult;
          } else if (table === 'entrega_itens') {
            pendingResult = entregasItensInsertResult;
          } else {
            pendingResult = { data: null, error: null };
          }
          return chain;
        },
        update(payload) {
          calls.push({ op: 'update', table, args: [payload] });
          if (table === 'entregas') {
            pendingResult = entregasUpdateResult;
          } else {
            pendingResult = { data: null, error: null };
          }
          return chain;
        },
        delete() {
          calls.push({ op: 'delete', table });
          // delete() chainado: o resultado final vem do terminal
          // (eq). Para entregas, o delete() sem eq também resolve
          // (atualizarEntregaCima tem delete sem eq, mas o eq é
          // chamado em cima — em Latex, é sempre via eq).
          // Para simplificar, delete sem eq devolve success.
          if (table === 'entregas') {
            pendingResult = { data: null, error: null };
          } else {
            pendingResult = entregasItensDeleteResult;
          }
          return chain;
        },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          if (table === 'entrega_itens' && col === 'entrega_id') {
            // atualizarEntregaLatex delete().eq() encadeado
            return Promise.resolve(entregasItensDeleteResult);
          }
          // Para entregas.eq('id', ...) resolve com o
          // pendingResult (que foi setado por update/insert).
          if (table === 'entregas' && col === 'id') {
            return Promise.resolve(pendingResult);
          }
          return Promise.resolve(pendingResult);
        },
        single() {
          calls.push({ op: 'single', table });
          // Resolve com o pendingResult acumulado.
          return Promise.resolve(pendingResult);
        },
        order() { return chain; },
        in() { return chain; },
        then(resolveThen, rejectThen) {
          return Promise.resolve(pendingResult || { data: null, error: null }).then(resolveThen, rejectThen);
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
    Node: FakeNode, supa: fakeSupa,
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
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });

  // Wrap toast para registrar mensagens
  const origToast = sandbox.toast;
  sandbox.toast = (msg, type) => {
    toasts.push({ msg, type });
    return origToast(msg, type);
  };
  // confirmDialog stub (não usado pelos Latex writes, mas presente)
  sandbox.confirmDialog = (opts) => {
    return Promise.resolve().then(() => opts.onConfirm && opts.onConfirm());
  };

  return { sandbox, fakeSupa, getToasts: () => toasts.slice(), clearToasts: () => { toasts.length = 0; } };
}

// Payload válido padrão (1 item com 10m entregues)
const VALID_PAYLOAD = {
  data: '2026-06-01',
  observacao: 'teste',
  destino_fornecedor_id: null,  // Latex não usa destino
  linhas: [
    { op_item_id: 1, metros_entregues: 10, defeito: false, observacao: null },
  ],
};

test('24. runtime: window.RAVATEX_ENTREGA_WRITES.salvarEntregaLatex é função', () => {
  const { sandbox } = makeEWLatexSandbox();
  const fn = vm.runInContext('window.RAVATEX_ENTREGA_WRITES.salvarEntregaLatex', sandbox);
  assert.equal(typeof fn, 'function', 'salvarEntregaLatex não é função');
});

test('25. runtime: window.salvarEntregaLatex (global legado) é função', () => {
  const { sandbox } = makeEWLatexSandbox();
  assert.equal(typeof vm.runInContext('window.salvarEntregaLatex', sandbox), 'function',
    'window.salvarEntregaLatex não é função');
});

test('26. runtime: window.RAVATEX_ENTREGA_WRITES.atualizarEntregaLatex é função', () => {
  const { sandbox } = makeEWLatexSandbox();
  const fn = vm.runInContext('window.RAVATEX_ENTREGA_WRITES.atualizarEntregaLatex', sandbox);
  assert.equal(typeof fn, 'function', 'atualizarEntregaLatex não é função');
});

test('27. runtime: window.atualizarEntregaLatex (global legado) é função', () => {
  const { sandbox } = makeEWLatexSandbox();
  assert.equal(typeof vm.runInContext('window.atualizarEntregaLatex', sandbox), 'function',
    'window.atualizarEntregaLatex não é função');
});

test('28. runtime: salvarEntregaLatex com payload vazio → toast + return false', async () => {
  const { sandbox, getToasts } = makeEWLatexSandbox();
  const result = await vm.runInContext(
    "window.salvarEntregaLatex({ fornecedorId: 1, opId: 1, payload: { data: '2026-06-01', observacao: null, destino_fornecedor_id: null, linhas: [] } })",
    sandbox);
  assert.equal(result, false, 'salvarEntregaLatex deveria retornar false com payload vazio');
  const toasts = getToasts();
  assert.equal(toasts.length, 1, 'esperado 1 toast');
  assert.equal(toasts[0].type, 'error');
  assert.match(toasts[0].msg, /metros recebidos/);
});

test('29. runtime: salvarEntregaLatex happy path — 1 insert entregas + 1 insert itens + 0 rpc + toast success', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox();
  const result = await vm.runInContext(
    'window.salvarEntregaLatex({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, true, 'salvarEntregaLatex deveria retornar true em sucesso');
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const rpcCalls       = fakeSupa._calls.filter(c => c.op === 'rpc');
  assert.equal(insertEntregas.length, 1, 'esperado 1 insert em entregas');
  assert.equal(insertItens.length, 1, 'esperado 1 insert em entrega_itens');
  assert.equal(rpcCalls.length, 0, 'Latex writes NÃO devem chamar rpc');
  // Conteúdo do insert em entregas
  const entInsert = insertEntregas[0].args[0];
  assert.equal(entInsert.etapa, 'latex', 'etapa deve ser latex');
  assert.equal(entInsert.fornecedor_id, 5);
  assert.equal(entInsert.data, '2026-06-01');
  assert.equal(entInsert.observacao, 'teste');
  assert.equal(entInsert.destino_fornecedor_id, undefined,
    'salvarEntregaLatex não seta destino_fornecedor_id no insert entregas');
  // Conteúdo do insert em entrega_itens
  const itemInsert = insertItens[0].args[0];
  assert.equal(Array.isArray(itemInsert), true, 'insert itens é array');
  assert.equal(itemInsert.length, 1, 'esperado 1 item');
  assert.equal(itemInsert[0].entrega_id, 999, 'entrega_id do insert mockado');
  assert.equal(itemInsert[0].op_id, 10);
  assert.equal(itemInsert[0].metros_entregues, 10);
  // Toast de success
  const toasts = getToasts();
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1, 'esperado 1 toast de success');
  assert.equal(successToasts[0].msg, 'Recebimento registrado');
});

test('30. runtime: salvarEntregaLatex rollback — insert entregas OK, insert itens falha → delete entregas', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox({
    entregasItensInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.salvarEntregaLatex({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false, 'salvarEntregaLatex deveria retornar false em rollback');
  // Espera-se: 1 from('entregas') + 1 insert('entregas') + 1 from('entrega_itens')
  // + 1 insert('entrega_itens') (falha) + 1 delete('entregas').eq() (rollback)
  const fromEntregas = fakeSupa._calls.filter(c => c.op === 'from' && c.table === 'entregas');
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const deleteEq       = fakeSupa._calls.filter(c => c.op === 'eq');
  assert.equal(insertEntregas.length, 1, 'esperado 1 insert entregas');
  assert.equal(insertItens.length, 1, 'esperado 1 insert itens');
  assert.equal(deleteEq.length, 1, 'esperado 1 eq (rollback)');
  assert.equal(deleteEq[0].col, 'id', 'rollback deve ser por id');
  assert.equal(deleteEq[0].val, 999, 'rollback deve usar o id do insert mockado');
  // Toasts: 1 de erro (insert itens) + 0 de success
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  const successToasts = getToasts().filter(t => t.type === 'success');
  assert.equal(errorToasts.length, 1, 'esperado 1 toast de error');
  assert.match(errorToasts[0].msg, /itens do recebimento/);
  assert.equal(successToasts.length, 0, 'NÃO deve haver toast de success');
});

test('31. runtime: salvarEntregaLatex insert entregas falha → toast error + return false (sem rollback)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox({
    entregasInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.salvarEntregaLatex({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(insertItens.length, 0, 'NÃO deve tentar insert itens se insert entregas falhou');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /gravar recebimento/);
});

test('32. runtime: atualizarEntregaLatex com payload vazio → toast + return false', async () => {
  const { sandbox, getToasts } = makeEWLatexSandbox();
  const result = await vm.runInContext(
    "window.atualizarEntregaLatex({ entregaId: 1, opId: 1, payload: { data: '2026-06-01', observacao: null, destino_fornecedor_id: null, linhas: [] } })",
    sandbox);
  assert.equal(result, false);
  const toasts = getToasts();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'error');
  assert.match(toasts[0].msg, /metros recebidos/);
});

test('33. runtime: atualizarEntregaLatex happy path — update + delete + insert', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox();
  const result = await vm.runInContext(
    'window.atualizarEntregaLatex({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, true);
  const fromEntregas = fakeSupa._calls.filter(c => c.op === 'from' && c.table === 'entregas');
  const updateEntregas = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'entregas');
  const deleteEntregaItens = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const eqEntregaId = fakeSupa._calls.filter(c => c.op === 'eq' && c.col === 'entrega_id');
  assert.equal(fromEntregas.length, 1, '1 from entregas');
  assert.equal(updateEntregas.length, 1, '1 update entregas');
  assert.equal(deleteEntregaItens.length, 1, '1 delete entrega_itens');
  assert.equal(insertItens.length, 1, '1 insert entrega_itens');
  assert.equal(eqEntregaId.length, 1, '1 eq em entrega_id');
  assert.equal(eqEntregaId[0].val, 7, 'eq deve usar entregaId=7');
  // Conteúdo do update em entregas: NÃO seta destino_fornecedor_id
  const updPayload = updateEntregas[0].args[0];
  assert.equal(updPayload.data, '2026-06-01');
  assert.equal(updPayload.observacao, 'teste');
  assert.equal(updPayload.destino_fornecedor_id, undefined,
    'atualizarEntregaLatex não seta destino_fornecedor_id no update');
  // Conteúdo do insert em entrega_itens
  const itemInsert = insertItens[0].args[0];
  assert.equal(itemInsert[0].entrega_id, 7);
  assert.equal(itemInsert[0].op_id, 10);
  // Toast
  const toasts = getToasts();
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1);
  assert.equal(successToasts[0].msg, 'Recebimento atualizado');
});

test('34. runtime: atualizarEntregaLatex update falha → toast + return false (sem delete/insert)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox({
    entregasUpdateResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.atualizarEntregaLatex({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  // Se update falhou, NÃO deve haver delete nem insert de itens
  const deleteEntregaItens = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(deleteEntregaItens.length, 0, 'NÃO deve fazer delete se update falhou');
  assert.equal(insertItens.length, 0, 'NÃO deve fazer insert se update falhou');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /atualizar recebimento/);
});

test('35. runtime: atualizarEntregaLatex insert itens falha → toast + return false (sem rollback, estado inconsistente aceito)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWLatexSandbox({
    entregasItensInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.atualizarEntregaLatex({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  // A entrega fica sem itens (delete OK, insert falhou). Comentário
  // inline aceita essa inconsistência por design.
  const deleteEntregaItens = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(deleteEntregaItens.length, 1, 'delete acontece antes do insert');
  assert.equal(insertItens.length, 1, 'insert é tentado (e falha)');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /regravar itens do recebimento/);
});

test('36. runtime: nenhum helper Latex chama .rpc()', async () => {
  // Verifica tanto salvarEntregaLatex quanto atualizarEntregaLatex.
  const tests = [
    { fn: 'salvarEntregaLatex', args: { fornecedorId: 5, opId: 10, payload: VALID_PAYLOAD } },
    { fn: 'atualizarEntregaLatex', args: { entregaId: 7, opId: 10, payload: VALID_PAYLOAD } },
  ];
  for (const t of tests) {
    const { sandbox, fakeSupa } = makeEWLatexSandbox();
    await vm.runInContext(
      `window.${t.fn}(${JSON.stringify(t.args)})`, sandbox);
    const rpcCalls = fakeSupa._calls.filter(c => c.op === 'rpc');
    assert.equal(rpcCalls.length, 0, `${t.fn} NÃO deve chamar rpc (chamadas: ${rpcCalls.length})`);
  }
});

test('37. runtime: consumidor inline mockado consegue chamar salvarEntregaLatex via global bare', async () => {
  const { sandbox, fakeSupa } = makeEWLatexSandbox();
  // Bare reference (sem "window.") deve resolver para window.salvarEntregaLatex
  await vm.runInContext(
    'salvarEntregaLatex({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  assert.equal(insertEntregas.length, 1, 'consumidor bare não conseguiu chamar salvarEntregaLatex');
});

test('38. runtime: consumidor inline mockado consegue chamar atualizarEntregaLatex via global bare', async () => {
  const { sandbox, fakeSupa } = makeEWLatexSandbox();
  await vm.runInContext(
    'atualizarEntregaLatex({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(VALID_PAYLOAD) + ' })',
    sandbox);
  const updateEntregas = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'entregas');
  assert.equal(updateEntregas.length, 1, 'consumidor bare não conseguiu chamar atualizarEntregaLatex');
});

// -----------------------------------------------------------------------------
// 2.6. Runtime — salvarEntregaCima / atualizarEntregaCima
// -----------------------------------------------------------------------------
//
// O sandbox Cima é uma variação do sandbox Latex: precisa suportar
// .insert().select().single() (entregas) E controle programático do
// resultado de .rpc() (best-effort, mas com payload) para validar
// o toast "OP de látex gerada" e o ramo de erro da RPC.

function makeEWCimaSandbox({
  entregasInsertResult  = { data: { id: 999 }, error: null },
  entregasItensInsertResult = { data: null, error: null },
  entregasUpdateResult  = { data: null, error: null },
  rpcResult             = { data: { id: 'op-xyz' }, error: null },
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
      let pendingResult = null;
      const chain = {
        _table: table,
        select() { calls.push({ op: 'select', table }); return chain; },
        insert(payload) {
          calls.push({ op: 'insert', table, args: [payload] });
          if (table === 'entregas') pendingResult = entregasInsertResult;
          else if (table === 'entrega_itens') pendingResult = entregasItensInsertResult;
          else pendingResult = { data: null, error: null };
          return chain;
        },
        update(payload) {
          calls.push({ op: 'update', table, args: [payload] });
          if (table === 'entregas') pendingResult = entregasUpdateResult;
          else pendingResult = { data: null, error: null };
          return chain;
        },
        delete() {
          calls.push({ op: 'delete', table });
          pendingResult = { data: null, error: null };
          return chain;
        },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          if (table === 'entrega_itens' && col === 'entrega_id') {
            return Promise.resolve({ data: null, error: null });
          }
          if (table === 'entregas' && col === 'id') {
            return Promise.resolve(pendingResult);
          }
          return Promise.resolve(pendingResult);
        },
        single() {
          calls.push({ op: 'single', table });
          return Promise.resolve(pendingResult);
        },
        order() { return chain; },
        in() { return chain; },
        then(resolveThen, rejectThen) {
          return Promise.resolve(pendingResult || { data: null, error: null }).then(resolveThen, rejectThen);
        },
      };
      return chain;
    },
    rpc: (fnName, params) => {
      calls.push({ op: 'rpc', fn: fnName, params: params || null });
      return Promise.resolve(rpcResult);
    },
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
    Node: FakeNode, supa: fakeSupa,
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
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });

  const origToast = sandbox.toast;
  sandbox.toast = (msg, type) => {
    toasts.push({ msg, type });
    return origToast(msg, type);
  };
  sandbox.confirmDialog = (opts) => Promise.resolve().then(() => opts.onConfirm && opts.onConfirm());

  return { sandbox, fakeSupa, getToasts: () => toasts.slice(), clearToasts: () => { toasts.length = 0; } };
}

const CIMA_VALID_PAYLOAD = {
  data: '2026-06-01',
  observacao: 'lote 1',
  destino_fornecedor_id: 77,
  linhas: [
    { op_item_id: 1, metros_entregues: 12, defeito: false, observacao: null },
  ],
};

test('39. runtime: window.RAVATEX_ENTREGA_WRITES.salvarEntregaCima é função', () => {
  const { sandbox } = makeEWCimaSandbox();
  const fn = vm.runInContext('window.RAVATEX_ENTREGA_WRITES.salvarEntregaCima', sandbox);
  assert.equal(typeof fn, 'function', 'salvarEntregaCima não é função');
});

test('40. runtime: window.salvarEntregaCima (global legado) é função', () => {
  const { sandbox } = makeEWCimaSandbox();
  assert.equal(typeof vm.runInContext('window.salvarEntregaCima', sandbox), 'function',
    'window.salvarEntregaCima não é função');
});

test('41. runtime: window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima é função', () => {
  const { sandbox } = makeEWCimaSandbox();
  const fn = vm.runInContext('window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima', sandbox);
  assert.equal(typeof fn, 'function', 'atualizarEntregaCima não é função');
});

test('42. runtime: window.atualizarEntregaCima (global legado) é função', () => {
  const { sandbox } = makeEWCimaSandbox();
  assert.equal(typeof vm.runInContext('window.atualizarEntregaCima', sandbox), 'function',
    'window.atualizarEntregaCima não é função');
});

test('43. runtime: salvarEntregaCima com payload vazio → toast + return false', async () => {
  const { sandbox, getToasts } = makeEWCimaSandbox();
  const result = await vm.runInContext(
    "window.salvarEntregaCima({ fornecedorId: 1, opId: 1, payload: { data: '2026-06-01', observacao: null, destino_fornecedor_id: 77, linhas: [] } })",
    sandbox);
  assert.equal(result, false);
  const toasts = getToasts();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'error');
  assert.match(toasts[0].msg, /metros entregues/);
});

test('44. runtime: salvarEntregaCima sem destino_fornecedor_id → toast + return false', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox();
  const result = await vm.runInContext(
    "window.salvarEntregaCima({ fornecedorId: 1, opId: 1, payload: { data: '2026-06-01', observacao: null, destino_fornecedor_id: null, linhas: [{ metros_entregues: 5, defeito: false, observacao: null }] } })",
    sandbox);
  assert.equal(result, false);
  const toasts = getToasts();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'error');
  assert.match(toasts[0].msg, /l\u00e1tex de destino/);
  // Não deve ter chamado Supabase
  const allCalls = fakeSupa._calls.filter(c => c.op !== 'from' || c.table);
  assert.equal(allCalls.length, 0, 'NÃO deve chamar Supabase sem destino');
});

test('45. runtime: salvarEntregaCima happy path — insert etapa=cima + destino + rpc best-effort + toast "OP de látex gerada"', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox();
  const result = await vm.runInContext(
    'window.salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, true);
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const rpcCalls       = fakeSupa._calls.filter(c => c.op === 'rpc');
  assert.equal(insertEntregas.length, 1, '1 insert entregas');
  assert.equal(insertItens.length, 1, '1 insert itens');
  assert.equal(rpcCalls.length, 1, '1 rpc gerar_op_latex');
  // Conteúdo do insert entregas
  const entInsert = insertEntregas[0].args[0];
  assert.equal(entInsert.etapa, 'cima');
  assert.equal(entInsert.fornecedor_id, 5);
  assert.equal(entInsert.destino_fornecedor_id, 77);
  assert.equal(entInsert.data, '2026-06-01');
  assert.equal(entInsert.observacao, 'lote 1');
  // Conteúdo do insert itens
  const itemInsert = insertItens[0].args[0];
  assert.equal(itemInsert[0].entrega_id, 999);
  assert.equal(itemInsert[0].op_id, 10);
  assert.equal(itemInsert[0].metros_entregues, 12);
  // RPC com payload original
  assert.equal(rpcCalls[0].fn, 'gerar_op_latex');
  assert.equal(JSON.stringify(rpcCalls[0].params), JSON.stringify({ p_entrega_id: 999 }),
    'RPC deve receber { p_entrega_id: 999 }');
  // Toast de success com "OP de látex gerada" (rpc.data truthy)
  const toasts = getToasts();
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1);
  assert.equal(successToasts[0].msg, 'Entrega registrada · OP de látex gerada');
});

test('46. runtime: salvarEntregaCima RPC falhando → entrega mantida, toast específico da RPC, return true', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox({
    rpcResult: { data: null, error: { message: 'rpc timeout' } },
  });
  const result = await vm.runInContext(
    'window.salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  // Best-effort: falha da RPC NÃO desfaz a entrega. Return true.
  assert.equal(result, true, 'salvarEntregaCima deve retornar true mesmo com RPC falhando');
  // A entrega (insert) e os itens já foram commitados antes da RPC
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(insertEntregas.length, 1, 'insert entregas mantido');
  assert.equal(insertItens.length, 1, 'insert itens mantido');
  // Nenhum rollback/cleanup
  const deleteCalls = fakeSupa._calls.filter(c => c.op === 'delete');
  assert.equal(deleteCalls.length, 0, 'NÃO deve haver rollback quando a RPC falha');
  // Toast específico de erro da RPC
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1, 'esperado 1 toast de error');
  assert.match(errorToasts[0].msg, /Entrega salva/);
  assert.match(errorToasts[0].msg, /falhou ao gerar a OP de l\u00e1tex/);
  assert.match(errorToasts[0].msg, /Gere manualmente/);
  // Zero success
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 0, 'NÃO deve haver toast de success');
});

test('47. runtime: salvarEntregaCima insert entregas falha → toast error + return false (sem rollback, sem rpc)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox({
    entregasInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const rpcCalls    = fakeSupa._calls.filter(c => c.op === 'rpc');
  assert.equal(insertItens.length, 0, 'NÃO deve tentar insert itens se insert entregas falhou');
  assert.equal(rpcCalls.length, 0, 'NÃO deve chamar RPC se insert entregas falhou');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /gravar entrega/);
});

test('48. runtime: salvarEntregaCima insert itens falha → rollback delete entregas + toast + return false', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox({
    entregasItensInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  // Espera-se: insert entregas OK, insert itens falha, delete
  // entregas (rollback) por id, sem RPC
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const deleteEq       = fakeSupa._calls.filter(c => c.op === 'eq' && c.col === 'id' && c.val === 999);
  const rpcCalls       = fakeSupa._calls.filter(c => c.op === 'rpc');
  assert.equal(insertEntregas.length, 1);
  assert.equal(insertItens.length, 1);
  assert.equal(deleteEq.length, 1, 'rollback deve usar eq id=999');
  assert.equal(rpcCalls.length, 0, 'NÃO deve chamar RPC após rollback');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /itens da entrega/);
});

test('49. runtime: atualizarEntregaCima com payload vazio → toast + return false', async () => {
  const { sandbox, getToasts } = makeEWCimaSandbox();
  const result = await vm.runInContext(
    "window.atualizarEntregaCima({ entregaId: 1, opId: 1, payload: { data: '2026-06-01', observacao: null, destino_fornecedor_id: 77, linhas: [] } })",
    sandbox);
  assert.equal(result, false);
  const toasts = getToasts();
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].type, 'error');
  assert.match(toasts[0].msg, /metros entregues/);
});

test('50. runtime: atualizarEntregaCima happy path — update (com destino) + delete + insert + toast success', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox();
  const result = await vm.runInContext(
    'window.atualizarEntregaCima({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, true);
  const updateEntregas = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'entregas');
  const deleteItens    = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens    = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  const eqEntregaId    = fakeSupa._calls.filter(c => c.op === 'eq' && c.col === 'entrega_id');
  const rpcCalls       = fakeSupa._calls.filter(c => c.op === 'rpc');
  assert.equal(updateEntregas.length, 1, '1 update entregas');
  assert.equal(deleteItens.length, 1, '1 delete entrega_itens');
  assert.equal(insertItens.length, 1, '1 insert entrega_itens');
  assert.equal(eqEntregaId.length, 1);
  assert.equal(eqEntregaId[0].val, 7);
  assert.equal(rpcCalls.length, 0, 'atualizarEntregaCima NÃO chama rpc (só salvar)');
  // Conteúdo do update
  const updPayload = updateEntregas[0].args[0];
  assert.equal(updPayload.data, '2026-06-01');
  assert.equal(updPayload.observacao, 'lote 1');
  assert.equal(updPayload.destino_fornecedor_id, 77,
    'atualizarEntregaCima seta destino_fornecedor_id no update');
  // Toast
  const toasts = getToasts();
  const successToasts = toasts.filter(t => t.type === 'success');
  assert.equal(successToasts.length, 1);
  assert.equal(successToasts[0].msg, 'Entrega atualizada');
});

test('51. runtime: atualizarEntregaCima update falha → toast + return false (sem delete/insert)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox({
    entregasUpdateResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.atualizarEntregaCima({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  const deleteItens = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(deleteItens.length, 0, 'NÃO deve fazer delete se update falhou');
  assert.equal(insertItens.length, 0, 'NÃO deve fazer insert se update falhou');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /atualizar entrega/);
});

test('52. runtime: atualizarEntregaCima insert itens falha → toast + return false (sem rollback, estado inconsistente aceito)', async () => {
  const { sandbox, fakeSupa, getToasts } = makeEWCimaSandbox({
    entregasItensInsertResult: { data: null, error: { message: 'fk fail' } },
  });
  const result = await vm.runInContext(
    'window.atualizarEntregaCima({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  assert.equal(result, false);
  // A entrega fica sem itens (delete OK, insert falhou). Decisão
  // aceita por design (single-admin / baixo volume).
  const deleteItens = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entrega_itens');
  const insertItens = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entrega_itens');
  assert.equal(deleteItens.length, 1, 'delete acontece antes do insert');
  assert.equal(insertItens.length, 1, 'insert é tentado (e falha)');
  // Nenhum rollback: a entrega fica sem itens
  const deleteEntregas = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'entregas');
  assert.equal(deleteEntregas.length, 0, 'NÃO deve fazer rollback em entregas');
  const toasts = getToasts();
  const errorToasts = toasts.filter(t => t.type === 'error');
  assert.equal(errorToasts.length, 1);
  assert.match(errorToasts[0].msg, /regravar itens da entrega/);
});

test('53. runtime: consumidor inline mockado consegue chamar salvarEntregaCima via global bare', async () => {
  const { sandbox, fakeSupa } = makeEWCimaSandbox();
  await vm.runInContext(
    'salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  const insertEntregas = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'entregas');
  assert.equal(insertEntregas.length, 1, 'consumidor bare não conseguiu chamar salvarEntregaCima');
});

test('54. runtime: consumidor inline mockado consegue chamar atualizarEntregaCima via global bare', async () => {
  const { sandbox, fakeSupa } = makeEWCimaSandbox();
  await vm.runInContext(
    'atualizarEntregaCima({ entregaId: 7, opId: 10, payload: ' + JSON.stringify(CIMA_VALID_PAYLOAD) + ' })',
    sandbox);
  const updateEntregas = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'entregas');
  assert.equal(updateEntregas.length, 1, 'consumidor bare não conseguiu chamar atualizarEntregaCima');
});

// -----------------------------------------------------------------------------
// 3. Integração
// -----------------------------------------------------------------------------

test('55. boot: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + inline coexistem sem SyntaxError', () => {
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

test('56. screenPainel (inline) ainda renderiza via shellLayout com 9 itens do ADMIN_MENU (regressão common)', () => {
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

test('57. screenCadastrosCores (cadastros) ainda renderiza (regressão cadastros)', async () => {
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

test('58. screenListaOPs (ops-list) ainda renderiza (regressão ops-list)', async () => {
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
