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
//
// TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1 (62-70): o novo helper
// definirEmborracharOpItem (db/124 admin write surface) — expõe função,
// chama supa.from('op_itens').update({ emborrachar }).eq('id', opItemId),
// propaga erro/sucesso sem sobrescrever, grava { emborrachar: null } em
// vez de omitir a coluna quando o valor é limpo, e prova que dois op_itens
// do MESMO modelo recebem valores independentes (por op_item.id, nunca por
// modelo_id).

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
const BOOT   = path.join(ROOT, 'js', 'boot.js');
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
const bootSrc   = fs.readFileSync(BOOT,  'utf8');
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
  if (matches.length === 0) {
    // Após ROUTES-BOOT-MODULE-A o <script> inline foi removido.
    // Tests que verificam AUSÊNCIA de coisas no inline passam
    // trivialmente; tests que esperavam PRESENÇA foram
    // atualizados para olhar em js/boot.js.
    return '';
  }
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  // Aceita src com ou sem query string (cache-busting ?v=...).
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/').replace(/\./g, '\\.')}(?:\\?[^"]*)?"\\s*></script>`);
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
    // Pass-7 (§14.1) DOM fidelity: every real element exposes `.style`.
    this.style = {};
    this.disabled = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  // Pass-7 (§14.1) DOM fidelity: every real element exposes these.
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
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
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/op-writes\.js\?v=20260731-native-receipt-p2"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/op-writes\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-writes.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-writes\.js"[^>]*type=/.test(indexSrc), false,
    'op-writes.js está sendo carregado com type=module');
});

test('4. index.html: ordem op-form-helpers.js → op-writes.js → jspdf → boot.js (último local antes de </head>)', () => {
  const ofhIdx   = findScriptIdx(indexSrc, 'js/screens/op-form-helpers.js');
  const opwIdx   = findScriptIdx(indexSrc, 'js/screens/op-writes.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx  = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(ofhIdx > 0, 'op-form-helpers.js não encontrado');
  assert.ok(opwIdx > 0, 'op-writes.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(ofhIdx < opwIdx, 'op-form-helpers deve vir antes de op-writes');
  assert.ok(opwIdx < jspdfIdx, 'op-writes deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
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
  // O débito que este comentário registrava — helper sem chamador, decisão de
  // produto pendente entre religar a UI ou aposentar — foi DECIDIDO em P2-A:
  // APOSENTAR (fecha DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR). As três
  // asserções de presença viraram asserções de ausência, no arquivo inline e
  // em op-nova.js igualmente: um símbolo retirado não pode reaparecer em
  // superfície nenhuma.
  assert.equal(/function\s+atribuirFornecedorFioOp\s*\(/.test(opwSrc), false,
    'atribuirFornecedorFioOp foi aposentado e não pode voltar a op-writes.js');
  assert.equal(/window\.atribuirFornecedorFioOp\s*=/.test(opwSrc), false,
    'o global legado não pode voltar a ser publicado');
  assert.equal(/atribuirFornecedorFioOp/.test(opnSrc), false,
    'op-nova.js não pode declarar nem citar o helper aposentado');
});

test('10. inline NÃO contém mais persistir (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('11. wrapper aplicarRecalculo aposentado (nem no inline, nem em op-nova.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo');
  assert.doesNotMatch(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não deve mais conter o wrapper aplicarRecalculo (fluxo antigo retirado)');
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

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
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

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
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
  vm.runInContext(bootSrc,   sandbox, { filename: 'js/boot.js' });

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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
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
  // O número era fixo e envelheceu quando o menu admin cresceu por fases
  // já aceitas. A guarda real é "o painel renderiza o menu canônico
  // INTEIRO" — comparar com o dono único (ADMIN_MENU de common.js).
  const esperado = vm.runInContext('window.ADMIN_MENU.length', sandbox);
  assert.ok(esperado > 0, 'ADMIN_MENU canônico não carregou no sandbox');
  assert.ok(links && links.length === esperado,
    `screenPainel não renderizou os ${esperado} itens do ADMIN_MENU (renderizou ${links ? links.length : 0})`);
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
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

// -----------------------------------------------------------------------------
// APOSENTADORIA DE atribuirFornecedorFioOp — P2-A (§9.9.N linha 12)
//
// Os casos 26 a 43 provavam, em dezoito asserções, a EXISTÊNCIA e o
// comportamento passo-a-passo de window.atribuirFornecedorFioOp: os quatro
// argumentos obrigatórios, o UPDATE plano em ordens_compra_fio.fornecedor_id,
// o par DELETE/INSERT em op_fornecedores e os steps 1/2/3 de falha parcial.
//
// O P2-A APOSENTOU esse helper (decisão do supervisor: RETIRE, não "retire ou
// reponte"; fecha DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR). Ele não tinha
// chamador na aplicação, gravava direto no modelo plano em dois writes soltos
// e não transacionais, e a escolha de fornecedor de compra passou a ser feita
// pelo planejamento nativo em Pedido -> Insumos.
//
// Aquelas dezoito asserções descreviam uma IMPLEMENTAÇÃO que deixou de
// existir, e por isso são substituídas — não apagadas — pelo mecanismo
// canônico do P2-A: provar que o símbolo foi retirado inteiro, que os dois
// writes planos sumiram, que nenhum escritor manual de alocação nasceu no
// lugar e que o helper que PERMANECE segue intacto. A cobertura dedicada e
// mais ampla está em tests/op-writes-retirado.smoke.js.
// -----------------------------------------------------------------------------

test('26. após o boot completo, atribuirFornecedorFioOp NÃO existe como global', () => {
  const sandbox = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'undefined',
    'o helper aposentado não pode sobreviver ao boot completo');
});

test('27. a namespace RAVATEX_SCREENS.opWrites não expõe mais o helper aposentado', () => {
  const { sandbox } = makeAtribuirFornSandbox();
  assert.equal(
    vm.runInContext("'atribuirFornecedorFioOp' in window.RAVATEX_SCREENS.opWrites", sandbox), false,
    'a namespace não pode reexpor o helper aposentado');
});

test('28. op-writes.js expõe EXATAMENTE os helpers autorizados: recebimento e emborrachar', () => {
  const { sandbox } = makeAtribuirFornSandbox();
  const chaves = vm.runInContext(
    'Object.keys(window.RAVATEX_SCREENS.opWrites).sort().join(",")', sandbox);
  assert.equal(chaves, 'definirEmborracharOpItem,registrarRecebimentoOrdemFio',
    'op-writes.js tem de expor só o recebimento e o emborrachar (TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1) depois da aposentadoria');
});

test('29. a função aposentada não é redeclarada em lugar nenhum do módulo', () => {
  assert.equal(/function\s+atribuirFornecedorFioOp\s*\(/.test(opwSrc), false,
    'a implementação tem de estar retirada, não apenas desexportada');
});

test('30. os dois writes planos do helper aposentado sumiram', () => {
  // O UPDATE de fornecedor_id em ordens_compra_fio e o par DELETE/INSERT em
  // op_fornecedores eram exclusivos do helper retirado.
  assert.equal(/fornecedor_id:\s*fornecedorId/.test(opwSrc), false,
    'o UPDATE plano de fornecedor tem de sumir');
  assert.equal(/from\(\s*['"]op_fornecedores['"]\s*\)/.test(opwSrc), false,
    'o par DELETE/INSERT em op_fornecedores tem de sumir');
});

// Só as linhas EXECUTÁVEIS: uma proibição de mecanismo não pode ser violada
// por um comentário que registra a aposentadoria.
function apenasExecutavel(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

test('31. nenhum escritor manual de alocação nasceu no lugar', () => {
  assert.equal(/alocacao|alocar|ordem_compra_item_alocacao/i.test(apenasExecutavel(opwSrc)), false,
    'a alocação de compra é do escritor do servidor, não desta tela');
});

test('32. a semântica de falha parcial por steps 1/2/3 desapareceu com o helper', () => {
  assert.equal(/step:\s*[123]/.test(apenasExecutavel(opwSrc)), false,
    'os steps de falha parcial eram do helper retirado e não podem sobreviver');
});

test('33. o helper que PERMANECE continua íntegro e funcional', async () => {
  const { sandbox, fakeSupa } = makeAtribuirFornSandbox();
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function',
    'a aposentadoria não pode ter levado junto o recebimento');
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 10, kgRecebido: 7, dataRecebimento: "2026-07-31", status: "recebido_total" })',
    sandbox);
  assert.equal(result.error, null, 'o recebimento legado tem de continuar funcionando');
  assert.ok(fakeSupa._calls.length > 0, 'o recebimento tem de continuar alcançando o transporte');
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

test('46. wrapper aplicarRecalculo aposentado (nem no inline, nem em op-nova.js) [dup guard]', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo');
  assert.doesNotMatch(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não deve mais conter o wrapper aplicarRecalculo (fluxo antigo retirado)');
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
  assert.equal(threw, false, 'boot lançou SyntaxError de duplicate identifier em op-writes.js');
  // O helper que PERMANECE tem de estar disponível como global; o aposentado
  // não pode ressurgir no boot completo.
  assert.equal(typeof vm.runInContext('window.registrarRecebimentoOrdemFio', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.atribuirFornecedorFioOp', sandbox), 'undefined',
    'o helper aposentado não pode reaparecer depois do boot completo');
});

// -----------------------------------------------------------------------------
// 5. PHASE-C3C-B: registrarRecebimentoOrdemFio canonical-first adaptation
// (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md §32)
// -----------------------------------------------------------------------------

const CUTOVER = path.join(ROOT, 'js', 'screens', 'ordem-compra-receipt-cutover.js');
const cutoverSrc = fs.readFileSync(CUTOVER, 'utf8');

function makeOpWCutoverSandbox({ rpcResult, updateResult = { data: null, error: null } } = {}) {
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
        _table: table, _lastUpdate: null,
        update(payload) { calls.push({ op: 'update', table, args: [payload] }); chain._lastUpdate = payload; return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', col, val });
          if (chain._lastUpdate != null) return Promise.resolve(updateResult);
          return chain;
        },
        select() { return chain; }, delete() { return chain; }, order() { return chain; }, in() { return chain; },
      };
      return chain;
    },
    rpc: (name, params) => {
      calls.push({ op: 'rpc', name, params });
      return Promise.resolve(rpcResult);
    },
    _calls: calls,
  };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode, supa: fakeSupa,
    crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(cutoverSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-cutover.js' });
  vm.runInContext(opwSrc, sandbox, { filename: 'js/screens/op-writes.js' });
  return { sandbox, fakeSupa };
}

test('50. canonical success never performs the flat mutation', async () => {
  const { sandbox, fakeSupa } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: true, codigo: 'ok', recebimento_id: 1, ordem_compra_id: 9 }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.equal(result.error, null);
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 0, 'canonical success must never issue the flat update');
});

test('51. recebimento_compat_inativo falls back to exactly one byte-identical flat update', async () => {
  const { sandbox, fakeSupa } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'recebimento_compat_inativo' }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.equal(result.error, null);
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1, 'inactive fallback must perform exactly one flat mutation');
  // JSON round-trip strips the vm.Context's separate Object realm (see the
  // identical note in tests/ordem-compra-receipt-cutover.smoke.js).
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls[0].args[0])), { kg_recebido: 40, data_recebimento: '2026-07-20', status: 'recebido_parcial' });
  const eqCalls = fakeSupa._calls.filter((c) => c.op === 'eq' && c.col === 'id' && c.val === 42);
  assert.ok(eqCalls.length >= 1);
});

test('52. bounded 42883 (undefined_function) also falls back to the flat update', async () => {
  const { sandbox, fakeSupa } = makeOpWCutoverSandbox({
    rpcResult: { data: null, error: { code: '42883', message: 'function public.registrar_recebimento_ordem_compra_fio_compat(...) does not exist' } },
  });
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1);
});

test('53. a fail-closed canonical error (sem_permissao) surfaces the error and never issues the flat update', async () => {
  const { sandbox, fakeSupa } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'sem_permissao' }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.ok(result.error, 'expected a surfaced error, not a silent fallback');
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 0, 'fail-closed must never issue the flat mutation');
});

test('54. calls the canonical RPC with the flat row id and the requested absolute kg total', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'recebimento_compat_inativo' }, error: null },
  });
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 77, kgRecebido: 12.5, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  const rpcCall = sandbox.supa._calls.find((c) => c.op === 'rpc' && c.name === 'registrar_recebimento_ordem_compra_fio_compat');
  assert.ok(rpcCall, 'expected a call to registrar_recebimento_ordem_compra_fio_compat');
  assert.equal(rpcCall.params.p_ordens_compra_fio_id, 77);
  assert.equal(rpcCall.params.p_kg_total_absoluto, 12.5);
});

test('55. no adapter loaded (window.RAVATEX_SCREENS.ordemCompraReceiptCutover absent) preserves the pre-phase behavior exactly', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox({ updateResult: { data: { id: 7 }, error: null } });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 7, kgRecebido: 3, dataRecebimento: "2026-06-23", status: "recebido_total" })',
    sandbox);
  assert.equal(result.error, null);
  const rpcCalls = fakeSupa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 0, 'without the adapter module loaded, no rpc must be attempted');
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 1);
});

// PHASE-C3C-B §34 (supervisor correction): the real UI closure must own and
// retain the receipt-attempt object across retries of unchanged intent.
// These tests prove registrarRecebimentoOrdemFio's half of that contract:
// it accepts a caller-owned attempt, uses it verbatim, and reports whether
// the outcome was ambiguous (server commit status unknown) so the caller
// knows whether to retain or close its tracker. Attempt ownership/retention
// itself is exercised at the real call-sites (tests/op-nova.smoke.js,
// tests/pedido-detail.smoke.js, tests/fornecedor-screens.smoke.js).

test('56. a caller-supplied attempt is used verbatim as the idempotency key', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'recebimento_compat_inativo' }, error: null },
  });
  sandbox.__attempt = { token: 'caller-owned-token-123' };
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial", attempt: __attempt })',
    sandbox);
  const rpcCall = sandbox.supa._calls.find((c) => c.op === 'rpc' && c.name === 'registrar_recebimento_ordem_compra_fio_compat');
  assert.equal(rpcCall.params.p_idempotency_key, 'caller-owned-token-123');
});

test('57. retrying with the exact same caller-supplied attempt sends the identical idempotency key both times', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'erro_interno' }, error: null },
  });
  sandbox.__attempt = { token: 'retry-token-456' };
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial", attempt: __attempt })',
    sandbox);
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial", attempt: __attempt })',
    sandbox);
  const rpcCalls = sandbox.supa._calls.filter((c) => c.op === 'rpc' && c.name === 'registrar_recebimento_ordem_compra_fio_compat');
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[0].params.p_idempotency_key, 'retry-token-456');
  assert.equal(rpcCalls[1].params.p_idempotency_key, 'retry-token-456');
});

test('58. an ambiguous transport failure (server commit status unknown) surfaces ambiguous:true and never issues the flat fallback', async () => {
  const { sandbox, fakeSupa } = makeOpWCutoverSandbox({
    // status:0 is the exact, finite signal @supabase/postgrest-js uses for
    // "fetch() never received an HTTP response" (§35 correction).
    rpcResult: { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0, statusText: '' },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.ok(result.error, 'expected the transport error to be surfaced');
  assert.equal(result.ambiguous, true, 'an ambiguous transport failure must be flagged so the caller retains its attempt');
  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'ordens_compra_fio');
  assert.equal(updateCalls.length, 0, 'ambiguous failure must never trigger the flat fallback');
});

test('59. a deterministic outcome (canonical success) reports ambiguous:false', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: true, codigo: 'ok', recebimento_id: 1, ordem_compra_id: 9 }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.equal(result.ambiguous, false);
});

test('60. a deterministic hard failure (recognized server rejection) reports ambiguous:false', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'sem_permissao' }, error: null },
  });
  const result = await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  assert.equal(result.ambiguous, false, 'a deterministic server rejection is not ambiguous — the next submission may mint a new token');
});

test('61. without a caller-supplied attempt, an internal one is still created (backward compatibility)', async () => {
  const { sandbox } = makeOpWCutoverSandbox({
    rpcResult: { data: { ok: false, codigo: 'recebimento_compat_inativo' }, error: null },
  });
  await vm.runInContext(
    'window.registrarRecebimentoOrdemFio({ ordemId: 42, kgRecebido: 40, dataRecebimento: "2026-07-20", status: "recebido_parcial" })',
    sandbox);
  const rpcCall = sandbox.supa._calls.find((c) => c.op === 'rpc' && c.name === 'registrar_recebimento_ordem_compra_fio_compat');
  assert.ok(rpcCall.params.p_idempotency_key, 'expected an internally-generated idempotency key when no attempt is supplied');
});

// -----------------------------------------------------------------------------
// TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1 — definirEmborracharOpItem
//
// db/124 added op_itens.emborrachar (Ravatex-defined finishing instruction,
// per op_item, never per model) but shipped no admin editing surface on
// purpose. This is that surface's write helper: a direct, admin-only
// update() on ONE op_itens row (no RPC — op_itens_admin already grants
// unrestricted UPDATE to is_admin(), the same mechanism the pre-existing
// metros_pedidos edit in op-latex-admin.js relies on).
// -----------------------------------------------------------------------------

test('62. window.RAVATEX_SCREENS.opWrites.definirEmborracharOpItem é função', () => {
  const { sandbox } = makeOpWSandbox();
  const fn = vm.runInContext('window.RAVATEX_SCREENS.opWrites.definirEmborracharOpItem', sandbox);
  assert.equal(typeof fn, 'function', 'definirEmborracharOpItem não é função');
});

test('63. window.definirEmborracharOpItem (global) é função', () => {
  const { sandbox } = makeOpWSandbox();
  assert.equal(typeof vm.runInContext('window.definirEmborracharOpItem', sandbox), 'function',
    'window.definirEmborracharOpItem não é função');
});

test('64. runtime: definirEmborracharOpItem chama supa.from("op_itens")', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: "PRETO" })', sandbox);
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from').map(c => c.table);
  assert.ok(fromCalls.includes('op_itens'),
    `helper não chamou from('op_itens') (tabelas: ${fromCalls.join(',')})`);
});

test('65. runtime: definirEmborracharOpItem chama .update({ emborrachar: valor }) com o valor informado', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: "PRETO" })', sandbox);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'op_itens');
  assert.equal(updateCalls.length, 1, 'esperado 1 update em op_itens');
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls[0].args[0])), { emborrachar: 'PRETO' }, 'payload do update não bate');
});

test('66. runtime: definirEmborracharOpItem chama .eq("id", opItemId)', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: "PRETO" })', sandbox);
  const idEq = fakeSupa._calls.find(c => c.op === 'eq' && c.col === 'id');
  assert.ok(idEq, 'esperado eq("id", ...)');
  assert.equal(idEq.val, 501, 'eq("id", ...) deve usar opItemId do argumento');
});

test('67. runtime: valor null grava { emborrachar: null } — reset explícito para "não definido"', async () => {
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: null })', sandbox);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'op_itens');
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls[0].args[0])), { emborrachar: null }, 'reset para null deve gravar { emborrachar: null }, nunca omitir a coluna');
});

test('68. runtime: em caso de erro, retorna { error } sem engolir o erro', async () => {
  const { sandbox } = makeOpWSandbox({
    updateResult: { data: null, error: { message: 'fake error' } },
  });
  const result = await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: "PRETO" })', sandbox);
  assert.ok(result.error, 'helper não devolveu error');
  assert.equal(result.error.message, 'fake error', 'error.message propagado incorretamente');
});

test('69. runtime: em caso de sucesso, retorna o resultado do update sem sobrescrever', async () => {
  const { sandbox } = makeOpWSandbox({
    updateResult: { data: { id: 501, emborrachar: 'PRETO' }, error: null },
  });
  const result = await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 501, valor: "PRETO" })', sandbox);
  assert.equal(result.data.id, 501);
  assert.equal(result.data.emborrachar, 'PRETO');
  assert.equal(result.error, null);
});

test('70. runtime: dois op_itens do MESMO modelo recebem valores independentes (nunca por modelo)', async () => {
  // Prova a cardinalidade do db/124: dois op_itens (601, 602) que
  // referenciam o mesmo modelo_id podem carregar valores de emborrachar
  // diferentes, porque o escritor grava por op_item.id, nunca por modelo_id.
  const { sandbox, fakeSupa } = makeOpWSandbox();
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 601, valor: "PRETO" })', sandbox);
  await vm.runInContext(
    'window.definirEmborracharOpItem({ opItemId: 602, valor: "CRU" })', sandbox);
  const updateCalls = fakeSupa._calls.filter(c => c.op === 'update' && c.table === 'op_itens');
  const eqCalls = fakeSupa._calls.filter(c => c.op === 'eq' && c.col === 'id');
  assert.equal(updateCalls.length, 2, 'esperado 1 update por op_item');
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls[0].args[0])), { emborrachar: 'PRETO' });
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls[1].args[0])), { emborrachar: 'CRU' });
  assert.equal(eqCalls[0].val, 601);
  assert.equal(eqCalls[1].val, 602);
});
