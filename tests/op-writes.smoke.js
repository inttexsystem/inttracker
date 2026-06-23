// Smoke test do módulo js/screens/op-writes.js
// (OP-ORDER-WRITE-MODULE-A + OP-FORNECEDOR-WRITE-MODULE-A).
//
// Garante que a extração dos helpers de write
// `registrarRecebimentoOrdemFio` e `atribuirFornecedorFioOp`
// do <script> inline de index.html para js/screens/op-writes.js
// preservou o comportamento exato.
//
// Estáticos:
//   1. js/screens/op-writes.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. index.html carrega op-writes.js exatamente 1 vez, sem
//      type=module;
//   4. ordem: op-form-helpers.js → op-writes.js → jspdf → inline;
//   5. inline AINDA contém buildOrdemPendenteRow;
//   6. inline AINDA contém validação kg > 0;
//   7. inline AINDA contém cálculo de status parcial/total;
//   8. inline NÃO contém mais o write inline específico de
//      recebimento em buildOrdemPendenteRow;
//   9. inline NÃO contém mais function atribuirFornecedorFio
//      (extraído para op-writes.js como atribuirFornecedorFioOp);
//  10. inline AINDA contém persistir;
//  11. inline AINDA contém aplicarRecalculo;
//  12. inline AINDA contém screenNovaOP e renderOPLatexAdmin;
//  13. op-writes.js NÃO contém service_role nem password
//      literal longo;
//  14. index.html NÃO contém service_role nem password literal
//      longo;
//
// Runtime (carrega ui + op-writes num vm.Context com supa
// mockado por tabela):
//  15. window.RAVATEX_SCREENS.opWrites existe;
//  16. window.RAVATEX_SCREENS.opWrites.registrarRecebimentoOrdemFio
//      é função;
//  17. window.registrarRecebimentoOrdemFio (global legado) é
//      função;
//  18. registrarRecebimentoOrdemFio chama supa.from('ordens_compra_fio');
//  19. registrarRecebimentoOrdemFio chama .update com
//      { kg_recebido, data_recebimento, status } usando os
//      argumentos recebidos;
//  20. registrarRecebimentoOrdemFio chama .eq('id', ordemId);
//  21. em caso de erro mockado, retorna { error } sem engolir
//      o erro (propaga o valor original);
//  22. em caso de sucesso mockado, retorna o resultado do update
//      sem sobrescrever nada.
//
// Integração (boot chain completa):
//  23. boot: ui + calculo-op + entrega-form + entrega-writes +
//      fornecedor + op-form-helpers + op-writes + inline coexiste
//      sem SyntaxError de duplicate identifier;
//  24. screenPainel (inline) ainda renderiza via shellLayout com
//      9 itens do ADMIN_MENU (regressão common).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const INDEX  = path.join(ROOT, 'index.html');
const OPW    = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const OPN    = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const EF     = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW     = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const OFH    = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const FORN   = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const BADGES = path.join(ROOT, 'js', 'badges.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const CALC   = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS    = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
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
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
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
// FakeNode mínimo (para boot chain)
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

test('1. js/screens/op-writes.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(OPW), 'js/screens/op-writes.js não existe');
  assert.equal(/^\s*export\s+/m.test(opwSrc), false,
    'op-writes.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(opwSrc), false,
    'op-writes.js parece usar import — deve ser script clássico');
});

test('2. op-writes.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPW}"`, { stdio: 'pipe' });
});

test('3. index.html carrega op-writes.js EXATAMENTE UMA VEZ, sem type=module', () => {
  const re = /<script\s+src="js\/screens\/op-writes\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/screens/op-writes.js">, encontrado ${matches.length}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-writes\.js"[^>]*type=/.test(indexSrc), false,
    'op-writes.js está sendo carregado com type=module');
});

test('4. index.html: ordem op-form-helpers.js → op-writes.js → jspdf → inline', () => {
  const ofhIdx   = findScriptIdx(indexSrc, 'js/screens/op-form-helpers.js');
  const opwIdx   = findScriptIdx(indexSrc, 'js/screens/op-writes.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(ofhIdx > 0, 'op-form-helpers.js não encontrado');
  assert.ok(opwIdx > 0, 'op-writes.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(inlineIdx > 0, 'inline não encontrado');
  assert.ok(ofhIdx < opwIdx, 'op-form-helpers deve vir antes de op-writes');
  assert.ok(opwIdx < jspdfIdx, 'op-writes deve vir antes de jspdf');
  assert.ok(opwIdx < inlineIdx, 'op-writes deve vir antes do inline');
});

test('5. buildOrdemPendenteRow foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildOrdemPendenteRow\s*\(/.test(inline), false,
    'inline ainda tem function buildOrdemPendenteRow — extração incompleta');
  // A função foi movida para op-nova.js
  assert.match(opnSrc, /function\s+buildOrdemPendenteRow\s*\(/,
    'op-nova.js não contém buildOrdemPendenteRow');
});

test('6. op-nova.js contém validação kg > 0 em buildOrdemPendenteRow', () => {
  // A regra "Informe o kg recebido" + "kg > 0" é da UI, não do write.
  assert.match(opnSrc, /Informe o kg recebido/,
    'op-nova.js perdeu a mensagem de validação de kg');
  // Garantia da regra: a expressão "kg > 0" ou "!(kg > 0)" deve estar presente
  assert.match(opnSrc, /!.*kg\s*>\s*0/,
    'op-nova.js perdeu a validação "kg > 0"');
});

test('7. op-nova.js contém cálculo de status parcial/total', () => {
  assert.match(opnSrc, /recebido_parcial/,
    'op-nova.js perdeu literal "recebido_parcial"');
  assert.match(opnSrc, /recebido_total/,
    'op-nova.js perdeu literal "recebido_total"');
});

test('8. inline NÃO contém mais o write inline específico de recebimento', () => {
  // A tripla (supa.from('ordens_compra_fio').update({ kg_recebido, ...
  // data_recebimento, status }) + .eq('id', ordem.id)) era o write
  // movido. Após a extração, o call-site em buildOrdemPendenteRow
  // (agora em op-nova.js) deve usar window.registrarRecebimentoOrdemFio.
  const inline = extractInlineScript(indexSrc);
  // Buscamos especificamente a forma inline que existia:
  //   supa.from('ordens_compra_fio').update({ kg_recebido: kg, data_recebimento: dataRec, status }).eq('id', ordem.id)
  const oldInlineWriteRe = /supa\.from\(['"`]ordens_compra_fio['"`]\)\s*\.update\(\s*\{\s*kg_recebido\s*:\s*kg\s*,\s*data_recebimento\s*:\s*dataRec\s*,\s*status\s*\}\s*\)\s*\.eq\(['"`]id['"`]\s*,\s*ordem\.id\s*\)/;
  assert.equal(oldInlineWriteRe.test(inline), false,
    'inline ainda tem o write inline de recebimento');
  // E deve usar o novo helper: agora em op-nova.js (não no inline)
  assert.match(opnSrc, /window\.registrarRecebimentoOrdemFio\(/,
    'op-nova.js não usa window.registrarRecebimentoOrdemFio — call-site não foi atualizado');
});

test('9. inline NÃO contém mais function atribuirFornecedorFio (extraído para op-writes.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+atribuirFornecedorFio\s*\(/.test(inline), false,
    'inline ainda declara atribuirFornecedorFio — função deveria ter sido extraída');
  // O novo helper window.atribuirFornecedorFioOp é referenciado
  // por op-nova.js (não pelo inline)
  assert.match(opnSrc, /window\.atribuirFornecedorFioOp\(/,
    'op-nova.js não referencia window.atribuirFornecedorFioOp — call-site não atualizado');
});

test('10. inline NÃO contém mais persistir (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('11. aplicarRecalculo foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  // A função foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não contém aplicarRecalculo');
});

test('12. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
  // renderOPLatexAdmin continua extraído em op-latex-admin.js
  assert.equal(/function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline não deve mais declarar renderOPLatexAdmin (extraído para op-latex-admin.js)');
  // A função foi movida para op-nova.js
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('13. op-writes.js NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(opwSrc), false, 'service_role em op-writes.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(opwSrc), false,
    'password literal longo em op-writes.js');
});

test('14. index.html NÃO contém service_role nem password literal longo', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

// -----------------------------------------------------------------------------
// 2. Runtime
// -----------------------------------------------------------------------------

function makeOpWSandbox({ updateResult = { data: null, error: null } } = {}) {
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
        _lastUpdate: null,
        select() { calls.push({ op: 'select', table }); return chain; },
        insert() { calls.push({ op: 'insert', table }); return Promise.resolve({ data: null, error: null }); },
        update(payload) {
          calls.push({ op: 'update', table, args: [payload] });
          chain._lastUpdate = payload;
          return chain;
        },
        delete() { calls.push({ op: 'delete', table }); return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          // Em op-writes.js, o .update().eq() é terminal — retorna a
          // Promise com o resultado configurado.
          if (chain._lastUpdate != null) {
            return Promise.resolve(updateResult);
          }
          return chain;
        },
        order() { return chain; },
        in() { return chain; },
        single() { return Promise.resolve(updateResult); },
        then(resolveThen, rejectThen) {
          return Promise.resolve(updateResult).then(resolveThen, rejectThen);
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
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
    supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,   sandbox, { filename: 'js/ui.js' });
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(opwSrc,  sandbox, { filename: 'js/screens/op-writes.js' });

  return { sandbox, fakeSupa };
}

test('15. runtime: window.RAVATEX_SCREENS.opWrites existe', () => {
  const { sandbox } = makeOpWSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opWrites', sandbox),
    'window.RAVATEX_SCREENS.opWrites não existe');
});

test('16. runtime: window.RAVATEX_SCREENS.opWrites.registrarRecebimentoOrdemFio é função', () => {
  const { sandbox } = makeOpWSandbox();
  const fn = vm.runInContext('window.RAVATEX_SCREENS.opWrites.registrarRecebimentoOrdemFio', sandbox);
  assert.equal(typeof fn, 'function', 'registrarRecebimentoOrdemFio não é função');
});

test('17. runtime: window.registrarRecebimentoOrdemFio (global legado) é função', () => {
  const { sandbox } = makeOpWSandbox();
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function',
    'window.registrarRecebimentoOrdemFio não é função');
});

test('18. runtime: registrarRecebimentoOrdemFio chama supa.from("ordens_compra_fio")', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 99, kgRecebido: 5, dataRecebimento: "2026-06-23", status: "recebido_parcial" })',
    sandbox);
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('ordens_compra_fio'),
    `helper não chamou from('ordens_compra_fio') (tabelas: ${fromCalls.join(',')})`);
});

test('19. runtime: registrarRecebimentoOrdemFio chama .update com { kg_recebido, data_recebimento, status } dos argumentos', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 99, kgRecebido: 5, dataRecebimento: "2026-06-23", status: "recebido_parcial" })',
    sandbox);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1, 'esperado 1 update em ordens_compra_fio');
  const payload = updateCalls[0].args[0];
  assert.equal(payload.kg_recebido, 5, 'payload kg_recebido não bate');
  assert.equal(payload.data_recebimento, '2026-06-23', 'payload data_recebimento não bate');
  assert.equal(payload.status, 'recebido_parcial', 'payload status não bate');
});

test('20. runtime: registrarRecebimentoOrdemFio chama .eq("id", ordemId)', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 99, kgRecebido: 5, dataRecebimento: "2026-06-23", status: "recebido_parcial" })',
    sandbox);
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  assert.ok(eqCalls.length >= 1, 'esperado ao menos 1 eq()');
  const idEq = eqCalls.find(c => c.col === 'id');
  assert.ok(idEq, 'esperado eq("id", ...)');
  assert.equal(idEq.val, 99, 'eq("id", ...) deve usar ordemId do argumento');
});

test('21. runtime: em caso de erro, retorna { error } sem engolir o erro', async () => {
  const { sandbox } = makeOpWSandbox({
    updateResult: { data: null, error: { message: 'fake error' } },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 1, kgRecebido: 2, dataRecebimento: "2026-06-23", status: "recebido_total" })',
    sandbox);
  assert.ok(result, 'helper não devolveu resultado');
  assert.ok(result.error, 'helper não devolveu error');
  assert.equal(result.error.message, 'fake error', 'error.message propagado incorretamente');
});

test('22. runtime: em caso de sucesso, retorna o resultado do update sem sobrescrever', async () => {
  const { sandbox } = makeOpWSandbox({
    updateResult: { data: { id: 7, kg_recebido: 3 }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 7, kgRecebido: 3, dataRecebimento: "2026-06-23", status: "recebido_total" })',
    sandbox);
  assert.ok(result, 'helper não devolveu resultado');
  assert.equal(result.error, null, 'helper em sucesso não devolve error');
  assert.deepEqual(result.data, { id: 7, kg_recebido: 3 }, 'helper em sucesso não propaga data');
});

// -----------------------------------------------------------------------------
// 3. Integração: boot completo
// -----------------------------------------------------------------------------

test('23. boot: ui + calculo-op + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + inline coexiste sem SyntaxError', () => {
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
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

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
    'boot com op-writes + inline lançou SyntaxError de duplicate identifier');

  // Valida rotas
  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/login'], 'rota #/login não registrada');
  assert.ok(routes && routes['#/ops'], 'rota #/ops não registrada');
  assert.ok(routes && routes['#/fornecedor/home'], 'rota #/fornecedor/home não registrada');

  // window.registrarRecebimentoOrdemFio deve existir após o boot
  const fn = vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox);
  assert.equal(typeof fn, 'function',
    'window.registrarRecebimentoOrdemFio não é função após o boot completo');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('24. screenPainel (inline) ainda renderiza via shellLayout com 9 itens do ADMIN_MENU (regressão common)', () => {
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
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
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

// -----------------------------------------------------------------------------
// 4. Atribuir fornecedor fio (OP-FORNECEDOR-WRITE-MODULE-A)
// -----------------------------------------------------------------------------

// This sandbox loads ALL modules (ui + calculo-op + entrega-form +
// entrega-writes + fornecedor + op-form-helpers + op-writes + inline)
// to verify that window.atribuirFornecedorFioOp is available at boot.
function makeFullBootSandbox() {
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
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  return sandbox;
}

// Sandbox específico para testes unitários de atribuirFornecedorFioOp
// (carrega apenas ui + calculo-op + op-writes, sem o boot completo).
function makeAtribuirFornSandbox({
  ordensUpdateResult = { data: null, error: null },
  opFornecedoresDeleteResult = { data: null, error: null },
  opFornecedoresInsertResult = { data: null, error: null },
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
  let updateResult = ordensUpdateResult;
  let deleteResult = opFornecedoresDeleteResult;
  let insertResult = opFornecedoresInsertResult;
  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      let lastMutation = null; // 'update' | 'delete' | 'insert'
      const chain = {
        _table: table,
        _lastUpdate: null,
        update(payload) {
          calls.push({ op: 'update', table, args: [payload] });
          chain._lastUpdate = payload;
          lastMutation = 'update';
          return chain;
        },
        delete() {
          calls.push({ op: 'delete', table });
          lastMutation = 'delete';
          return chain;
        },
        insert(payload) {
          calls.push({ op: 'insert', table, args: [payload] });
          lastMutation = 'insert';
          return chain;
        },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          // eq() returns chain for further chaining; resolution happens
          // via then() which uses the last mutation's result.
          return chain;
        },
        select() { calls.push({ op: 'select', table }); return chain; },
        order() { return chain; },
        in() { return chain; },
        single() { return this; },
        then(resolveThen, rejectThen) {
          // Resolve with the result of the last mutation called.
          if (lastMutation === 'update') {
            return Promise.resolve(updateResult).then(resolveThen, rejectThen);
          }
          if (lastMutation === 'delete') {
            return Promise.resolve(deleteResult).then(resolveThen, rejectThen);
          }
          if (lastMutation === 'insert') {
            return Promise.resolve(insertResult).then(resolveThen, rejectThen);
          }
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
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode, supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc,  sandbox, { filename: 'js/ui.js' });
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(opwSrc, sandbox, { filename: 'js/screens/op-writes.js' });
  return { sandbox, fakeSupa };
}

test('25. op-writes.js ainda expõe registrarRecebimentoOrdemFio', () => {
  const sandbox = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function',
    'registrarRecebimentoOrdemFio não é função após boot completo');
});

test('26. op-writes.js expõe atribuirFornecedorFioOp', () => {
  const sandbox = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'function',
    'atribuirFornecedorFioOp não é função após boot completo');
});

test('27. window.RAVATEX_SCREENS.opWrites.atribuirFornecedorFioOp existe', () => {
  const { sandbox } = makeAtribuirFornSandbox();
  const fn = vm.runInContext('window.RAVATEX_SCREENS.opWrites.atribuirFornecedorFioOp', sandbox);
  assert.equal(typeof fn, 'function', 'opWrites.atribuirFornecedorFioOp não é função');
});

test('28. window.atribuirFornecedorFioOp é função', () => {
  const { sandbox } = makeAtribuirFornSandbox();
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'function');
});

test('29. atribuirFornecedorFioOp rejeita opId ausente sem chamar supa', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ etapa: "fio_algodao", tipo: "algodao", fornecedorId: 1 })',
    sandbox);
  assert.ok(result.error, 'deveria retornar error');
  assert.equal(result.step, 0);
  assert.equal(fakeSupa._calls.length, 0, 'não deve chamar supa');
});

test('30. atribuirFornecedorFioOp rejeita etapa ausente', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, tipo: "algodao", fornecedorId: 1 })',
    sandbox);
  assert.ok(result.error);
  assert.equal(result.step, 0);
  assert.equal(fakeSupa._calls.length, 0);
});

test('31. atribuirFornecedorFioOp rejeita tipo ausente', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", fornecedorId: 1 })',
    sandbox);
  assert.ok(result.error);
  assert.equal(result.step, 0);
  assert.equal(fakeSupa._calls.length, 0);
});

test('32. atribuirFornecedorFioOp rejeita fornecedorId ausente', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao" })',
    sandbox);
  assert.ok(result.error);
  assert.equal(result.step, 0);
  assert.equal(fakeSupa._calls.length, 0);
});

test('33. sucesso: chama ordens_compra_fio.update({ fornecedor_id })', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1, 'esperado 1 update em ordens_compra_fio');
  assert.equal(updateCalls[0].args[0].fornecedor_id, 5, 'payload deve ter fornecedor_id=5');
});

test('34. sucesso: filtra ordens_compra_fio por .eq("op_id", opId)', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  // First eqs are for the update (op_id + tipo)
  const opIdEq = eqCalls.find(c => c.col === 'op_id' && c.val === 10);
  assert.ok(opIdEq, 'update deve filtrar por op_id=10');
});

test('35. sucesso: filtra ordens_compra_fio por .eq("tipo", tipo)', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  const tipoEq = eqCalls.find(c => c.col === 'tipo' && c.val === 'algodao');
  assert.ok(tipoEq, 'update deve filtrar por tipo="algodao"');
});

test('36. sucesso: chama op_fornecedores.delete()', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const deleteCalls = fakeSupa._calls.filter(c => c.op === 'delete' && c.table === 'op_fornecedores');
  assert.equal(deleteCalls.length, 1, 'esperado 1 delete em op_fornecedores');
});

test('37. sucesso: filtra delete por .eq("op_id", opId)', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  const deleteOpIdEq = eqCalls.filter(c => c.col === 'op_id' && c.val === 10);
  // Pelo menos 2 calls eq com op_id=10: uma do update e uma do delete
  assert.ok(deleteOpIdEq.length >= 2, `esperado >= 2 eq op_id=10, encontrado ${deleteOpIdEq.length}`);
});

test('38. sucesso: filtra delete por .eq("etapa", etapa)', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq');
  const etapaEq = eqCalls.find(c => c.col === 'etapa' && c.val === 'fio_algodao');
  assert.ok(etapaEq, 'delete deve filtrar por etapa="fio_algodao"');
});

test('39. sucesso: chama op_fornecedores.insert([{ op_id, fornecedor_id, etapa }])', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert' && c.table === 'op_fornecedores');
  assert.equal(insertCalls.length, 1, 'esperado 1 insert em op_fornecedores');
  const payload = insertCalls[0].args[0];
  assert.ok(Array.isArray(payload), 'insert em op_fornecedores deve ser array');
  assert.equal(payload.length, 1);
  assert.equal(payload[0].op_id, 10);
  assert.equal(payload[0].fornecedor_id, 5);
  assert.equal(payload[0].etapa, 'fio_algodao');
});

test('40. falha no step 1 retorna { error, step: 1 } e não executa steps 2/3', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox({
    ordensUpdateResult: { data: null, error: { message: 'fake fail' } },
  });
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  assert.ok(result.error, 'deveria retornar error');
  assert.equal(result.step, 1);
  assert.equal(result.error.message, 'fake fail');
  const deleteCalls = fakeSupa._calls.filter(c => c.op === 'delete');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.equal(deleteCalls.length, 0, 'não deve chamar delete se step 1 falhou');
  assert.equal(insertCalls.length, 0, 'não deve chamar insert se step 1 falhou');
});

test('41. falha no step 2 retorna { error, step: 2 } e não executa step 3', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox({
    opFornecedoresDeleteResult: { data: null, error: { message: 'delete fail' } },
  });
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  assert.ok(result.error, 'deveria retornar error');
  assert.equal(result.step, 2);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.equal(updateCalls.length, 1, 'step 1 update deve ter sido chamado');
  assert.equal(insertCalls.length, 0, 'não deve chamar insert se step 2 falhou');
});

test('42. falha no step 3 retorna { error, step: 3 }', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox({
    opFornecedoresInsertResult: { data: null, error: { message: 'insert fail' } },
  });
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  assert.ok(result.error, 'deveria retornar error');
  assert.equal(result.step, 3);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update');
  const deleteCalls = fakeSupa._calls.filter(c => c.op === 'delete');
  assert.equal(updateCalls.length, 1, 'step 1 update deve ter sido chamado');
  assert.equal(deleteCalls.length, 1, 'step 2 delete deve ter sido chamado');
});

test('43. sucesso retorna { error: null, step: 0 }', async () => {
  const { sandbox } = makeAtribuirFornSandbox();
  const result = await vm.runInContext(
    'window.atribuirFornecedorFioOp({ opId: 10, etapa: "fio_algodao", tipo: "algodao", fornecedorId: 5 })',
    sandbox);
  assert.equal(result.error, null);
  assert.equal(result.step, 0);
});

test('44. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('45. persistir NÃO está mais inline (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('46. aplicarRecalculo foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não contém aplicarRecalculo');
});

test('47. buildOrdemPendenteRow foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildOrdemPendenteRow\s*\(/.test(inline), false,
    'inline ainda tem buildOrdemPendenteRow — extração incompleta');
  assert.match(opnSrc, /function\s+buildOrdemPendenteRow\s*\(/,
    'op-nova.js não contém buildOrdemPendenteRow');
});

test('48. renderOPLatexAdmin NÃO está mais inline (extraído para op-latex-admin.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline não deve mais declarar renderOPLatexAdmin — foi extraído para op-latex-admin.js');
  // O call-site agora está em op-nova.js
  assert.match(opnSrc, /window\.renderOPLatexAdmin\(/,
    'op-nova.js deve referenciar window.renderOPLatexAdmin (call-site de screenNovaOP)');
});

test('49. boot chain com todos os helpers não lança SyntaxError', () => {
  const sandbox = makeFullBootSandbox();
  const inline = extractInlineScript(indexSrc);
  let threw = false;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threw = true;
    }
  }
  assert.equal(threw, false, 'boot lançou SyntaxError de duplicate identifier com atribuirFornecedorFioOp');
  // Valida que ambas as funções estão disponíveis como globais
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'function');
});
