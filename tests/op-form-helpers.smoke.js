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
const OPN    = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
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
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
// Builder de distribuição COMPARTILHADO (YARN-BUTTONS-FINAL-CONTRACT).
const oduSrc    = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-distribuicao-ui.js'), 'utf8');
// P2-A: o cliente dos escritores canônicos (salvar_ajuste_producao_op /
// iniciar_producao_op), lido para provar que a delegação termina no servidor.
const oprSrc    = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-recalculo.js'), 'utf8');
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
// FakeNode para disabledAttr
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
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/op-form-helpers\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/op-form-helpers\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-form-helpers.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-form-helpers\.js"[^>]*type=/.test(indexSrc), false,
    'op-form-helpers.js está sendo carregado com type=module');
});

test('4. index.html: ordem fornecedor.js → op-form-helpers.js → jspdf → boot.js (último local antes de </head>)', () => {
  const fornIdx  = findScriptIdx(indexSrc, 'js/screens/fornecedor.js');
  const ofhIdx   = findScriptIdx(indexSrc, 'js/screens/op-form-helpers.js');
  const jspdfIdx = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx  = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(fornIdx > 0, 'fornecedor.js não encontrado');
  assert.ok(ofhIdx > 0, 'op-form-helpers.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(fornIdx < ofhIdx, 'fornecedor deve vir antes de op-form-helpers');
  assert.ok(ofhIdx < jspdfIdx, 'op-form-helpers deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
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

test('10. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  // screenNovaOP inteira foi extraída para op-nova.js (SCREENNOVAOP-MODULE-A)
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
  // O módulo op-nova.js deve definir screenNovaOP
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não define screenNovaOP');
  // renderOPLatexAdmin continua extraído em op-latex-admin.js
  assert.equal(/function\s+renderOPLatexAdmin\s*\(/.test(inline), false,
    'inline não deve mais declarar renderOPLatexAdmin (extraído para op-latex-admin.js)');
  // persistir continua extraído em op-persistir.js
  assert.equal(/function\s+persistir\s*\(/.test(inline), false,
    'inline não deve mais declarar persistir (extraído para op-persistir.js)');
  // Estas continuam em op-nova.js, movidas junto com screenNovaOP.
  for (const fn of ['buildOrdemPendenteRow', 'buildProposta', 'buildBlocoFios']) {
    assert.match(opnSrc, new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(`),
      `op-nova.js perdeu a função ${fn}`);
  }
  // Duas saíram da lista por decisão registrada, não por perda:
  //
  //   - `aplicarRecalculo`: wrapper morto REMOVIDO pelo
  //     YARN-BUTTONS-FINAL-CONTRACT (ledger 2026-07-18, CLOSED/ACCEPTED).
  //     tests/op-writes.smoke.js caso 11 já guarda essa aposentadoria — este
  //     arquivo exigia o oposto, e os dois não podiam estar certos.
  //   - `buildBlocoTecelagem`: era o gêmeo duplicado do bloco de
  //     distribuição; o mesmo contrato unificou os dois builders no módulo
  //     compartilhado js/screens/op-distribuicao-ui.js.
  assert.equal(/function\s+aplicarRecalculo\s*\(/.test(opnSrc), false,
    'o wrapper morto aplicarRecalculo não pode voltar a op-nova.js');

  // P2-A (Emenda 2): `window.aplicarRecalculoOP` foi APOSENTADO por
  // consequência — seu corpo era feito só dos mecanismos que o P2-A elimina
  // (laço de UPDATE item a item, sucesso parcial e o snapshot de saldo), e ele
  // não tinha chamador legítimo depois do repontamento para o escritor
  // atômico.
  //
  // A asserção positiva anterior exigia o nome no fonte de op-nova.js e era
  // satisfeita APENAS por comentários — um guard verde sustentado por texto
  // morto. O que ele realmente devia proteger é a DELEGAÇÃO: op-nova.js não
  // reimplementa ajuste de produção, delega ao dono compartilhado, e o dono
  // compartilhado fala com os escritores canônicos do servidor. É isso que as
  // três asserções abaixo provam.
  assert.doesNotMatch(opnSrc, /aplicarRecalculoOP/,
    'o símbolo aposentado não pode sobreviver em op-nova.js — nem em código, nem em comentário de call-site');
  assert.match(opnSrc, /window\.buildDistribuicaoBlock\(/,
    'op-nova.js tem de DELEGAR o ajuste de produção ao dono compartilhado');
  assert.match(oduSrc, /function buildDistribuicaoBlock/,
    'o bloco de distribuição deve viver no módulo compartilhado');
  assert.match(oduSrc, /window\.salvarDistribuicaoOP\(/,
    'o dono compartilhado tem de usar o caminho canônico de ajuste');
  assert.match(oduSrc, /window\.iniciarProducaoOP\(/,
    'o dono compartilhado tem de usar o caminho canônico de início de produção');
  // E esses dois caminhos canônicos são, de facto, as RPCs do servidor.
  assert.match(oprSrc, /rpc\('salvar_ajuste_producao_op'/,
    'salvarDistribuicaoOP tem de ser um cliente de salvar_ajuste_producao_op');
  assert.match(oprSrc, /rpc\('iniciar_producao_op'/,
    'iniciarProducaoOP tem de ser um cliente de iniciar_producao_op');
});

test('11. op-nova.js usa window.rotuloFio (não rotuloFioOrdem local)', () => {
  assert.match(opnSrc, /window\.rotuloFio\(/,
    'op-nova.js não referencia window.rotuloFio');
  assert.equal(/rotuloFioOrdem/.test(opnSrc), false,
    'op-nova.js ainda referencia rotuloFioOrdem (não window.rotuloFio)');
});

test('12. op-nova.js consome o rotuloModelo compartilhado, sem clone local', () => {
  // O número mínimo de call-sites era 4 e envelheceu: parte deles saiu de
  // op-nova.js junto com os blocos que migraram para módulos próprios
  // (op-latex-admin, op-tecelagem-producao-admin, op-distribuicao-ui). A
  // garantia que importa não é a CONTAGEM, e sim que op-nova.js use o
  // helper compartilhado e não redeclare o seu.
  const count = (opnSrc.match(/window\.rotuloModelo\(/g) || []).length;
  assert.ok(count >= 1, `op-nova.js deve consumir window.rotuloModelo, encontrado ${count}`);
  assert.equal(/function\s+rotuloModelo\s*\(/.test(opnSrc), false,
    'op-nova.js não pode declarar um clone local de rotuloModelo');
});

test('13. op-nova.js usa window.fmtKg e window.fmtMetros e disabledAttr(readOnly, ...)', () => {
  assert.ok((opnSrc.match(/window\.fmtKg\(/g) || []).length >= 1,
    'op-nova.js não referencia window.fmtKg');
  assert.ok((opnSrc.match(/window\.fmtMetros\(/g) || []).length >= 1,
    'op-nova.js não referencia window.fmtMetros');
  assert.ok((opnSrc.match(/disabledAttr\(readOnly,\s*/g) || []).length >= 1,
    'op-nova.js não referencia disabledAttr(readOnly, ...');
});

test('14. ordens_compra_fio read em op-nova.js permanece (writes foram extraídos para op-persistir.js)', () => {
  // Reads de ordens_compra_fio (em screenNovaOP, reloadOrdens, buildBlocoFios) permanecem
  // em op-nova.js (apenas .select). Writes foram para op-persistir.js.
  assert.match(opnSrc, /supa\.from\(['"`]ordens_compra_fio['"`]\)/,
    'op-nova.js perdeu supa.from("ordens_compra_fio") — reads deveriam continuar no módulo');
  // Writes (.update/.insert/.delete) de ordens_compra_fio NÃO devem estar em op-nova.js
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*update\s*\(/.test(opnSrc), false,
    'op-nova.js ainda tem from("ordens_compra_fio").update — write deveria ter sido extraído');
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*insert\s*\(/.test(opnSrc), false,
    'op-nova.js ainda tem from("ordens_compra_fio").insert — write deveria ter sido extraído');
  assert.equal(/from\s*\(\s*['"]ordens_compra_fio['"]\s*\)\s*\.\s*delete\s*\(/.test(opnSrc), false,
    'op-nova.js ainda tem from("ordens_compra_fio").delete — write deveria ter sido extraído');
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

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  // Ordem real de index.html: ui.js -> badges.js -> pedido-ui.js -> tela.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pedido-ui.js'), 'utf8'), sandbox, { filename: 'js/pedido-ui.js' });
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
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
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
    'boot com op-form-helpers + inline lançou SyntaxError de duplicate identifier');

  // Valida rotas (registradas por boot.js)
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  // Ordem real de index.html: ui.js -> badges.js -> pedido-ui.js -> tela.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pedido-ui.js'), 'utf8'), sandbox, { filename: 'js/pedido-ui.js' });
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
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  // Ordem real de index.html: ui.js -> badges.js -> pedido-ui.js -> tela.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pedido-ui.js'), 'utf8'), sandbox, { filename: 'js/pedido-ui.js' });
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  // Ordem real de index.html: ui.js -> badges.js -> pedido-ui.js -> tela.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pedido-ui.js'), 'utf8'), sandbox, { filename: 'js/pedido-ui.js' });
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
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  // Ordem real de index.html: ui.js -> badges.js -> pedido-ui.js -> tela.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pedido-ui.js'), 'utf8'), sandbox, { filename: 'js/pedido-ui.js' });
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
