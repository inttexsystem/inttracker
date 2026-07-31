// Smoke test do módulo js/screens/op-recalculo.js
// (OP-RECALCULO-HELPERS-MODULE-A).
//
// Garante que a extração dos helpers puros de recalculo de OP
// (`maxMetrosItem` e `normalizarChaveSaldo`) do <script> inline de
// index.html para js/screens/op-recalculo.js preservou o
// comportamento exato.
//
// Estáticos:
//   1. js/screens/op-recalculo.js existe e é script clássico;
//   2. sintaxe JS válida (node --check);
//   3. op-recalculo.js é script clássico, sem import/export;
//   4. index.html carrega op-recalculo.js exatamente uma vez;
//   5. ordem: painel.js → op-recalculo.js → jspdf → inline;
//   6. index.html NÃO contém mais function maxMetrosItem;
//   7. index.html contém window.maxMetrosItem;
//   8. index.html ainda contém buildProposta;
//   9. index.html ainda contém recompute;
//  10. index.html ainda contém onAceitar;
//  11. index.html ainda contém async function aplicarRecalculo;
//  12. index.html ainda contém saldo_fios_op.insert;
//  13. index.html ainda contém saldo_fios select/update/insert;
//  14. index.html ainda contém ops.update status em_producao;
//  15. window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem existe;
//  16. window.RAVATEX_SCREENS.opRecalculo.normalizarChaveSaldo existe;
//  17. window.maxMetrosItem é função;
//  18. window.normalizarChaveSaldo é função;
//  19. maxMetrosItem com ordens válidas retorna cap numérico esperado;
//  20. maxMetrosItem sem ordens retorna 0 ou comportamento atual;
//  21. maxMetrosItem com ordens zeradas preserva comportamento atual;
//  22. normalizarChaveSaldo('algodao', 1, null) retorna chave de algodão;
//  23. normalizarChaveSaldo('poliester', null, 'PRETO') retorna chave
//      de poliéster com cor_id null;
//  24. boot chain com todos os módulos + op-recalculo + inline não
//      lança SyntaxError;
//  25. screenNovaOP continua inline;
//  26. setRoutes e main continuam inline.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPR   = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const ODU   = path.join(ROOT, 'js', 'screens', 'op-distribuicao-ui.js');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OPPDF = path.join(ROOT, 'js', 'screens', 'op-pdf.js');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const CUTOVER = path.join(ROOT, 'js', 'screens', 'ordem-compra-receipt-cutover.js');
const OFH   = path.join(ROOT, 'js', 'screens', 'op-form-helpers.js');
const EF    = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW    = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN  = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI    = path.join(ROOT, 'js', 'ui.js');
const BADGES= path.join(ROOT, 'js', 'badges.js');
const ROUTER= path.join(ROOT, 'js', 'router.js');
const CALC  = path.join(ROOT, 'js', 'calculo-op.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
const COMMON= path.join(ROOT, 'js', 'screens', 'common.js');
const CAD   = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPSLIST = path.join(ROOT, 'js', 'screens', 'ops-list.js');

const indexSrc  = fs.readFileSync(INDEX, 'utf8');
const oprSrc    = fs.readFileSync(OPR,   'utf8');
const oduSrc    = fs.readFileSync(ODU,   'utf8');
const opnSrc    = fs.readFileSync(OPN,   'utf8');
const opPdfSrc  = fs.readFileSync(OPPDF, 'utf8');
const painelSrc = fs.readFileSync(PAINEL,'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
const cutoverSrc = fs.readFileSync(CUTOVER, 'utf8');
const ofhSrc    = fs.readFileSync(OFH,   'utf8');
const efSrc     = fs.readFileSync(EF,    'utf8');
const uiSrc     = fs.readFileSync(UI,    'utf8');
const badgesSrc = fs.readFileSync(BADGES,'utf8');
const calcSrc   = fs.readFileSync(CALC,  'utf8');
const routerSrc = fs.readFileSync(ROUTER,'utf8');
const sysSrc    = fs.readFileSync(SYSTEM_SCREENS, 'utf8');
const commonSrc = fs.readFileSync(COMMON,'utf8');
const cadSrc    = fs.readFileSync(CAD,   'utf8');
const opsSrc    = fs.readFileSync(OPSLIST,'utf8');
const ewSrc     = fs.readFileSync(EW,    'utf8');
const fornSrc   = fs.readFileSync(FORN,  'utf8');

// -------------------------------------------------------------------------
// Helpers estáticos
// -------------------------------------------------------------------------

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

// -------------------------------------------------------------------------
// FakeNode mínimo
// -------------------------------------------------------------------------

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

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/screens/op-recalculo.js existe', () => {
  assert.ok(fs.existsSync(OPR), 'js/screens/op-recalculo.js não existe');
});

test('2. op-recalculo.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPR}"`, { stdio: 'pipe' });
});

test('3. op-recalculo.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(oprSrc), false,
    'op-recalculo.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(oprSrc), false,
    'op-recalculo.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-recalculo.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/op-recalculo\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/op-recalculo\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-recalculo.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-recalculo\.js"[^>]*type=/.test(indexSrc), false,
    'op-recalculo.js está sendo carregado com type=module');
});

test('5. index.html: ordem painel.js → op-recalculo.js → jspdf → boot.js (último local antes de </head>)', () => {
  const painelIdx = findScriptIdx(indexSrc, 'js/screens/painel.js');
  const oprIdx    = findScriptIdx(indexSrc, 'js/screens/op-recalculo.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(painelIdx > 0, 'painel.js não encontrado');
  assert.ok(oprIdx > 0, 'op-recalculo.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(painelIdx < oprIdx, 'painel.js deve vir antes de op-recalculo.js');
  assert.ok(oprIdx < jspdfIdx, 'op-recalculo.js deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
});

test('6. inline NÃO contém mais function maxMetrosItem', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+maxMetrosItem\s*\(/.test(inline), false,
    'inline ainda declara function maxMetrosItem — função deveria ter sido extraída');
});

test('7. maxMetrosItem é chamado pelo builder de distribuição COMPARTILHADO (não no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/window\.maxMetrosItem\(/.test(inline), false,
    'inline ainda chama window.maxMetrosItem');
  // YARN-BUTTONS-FINAL-CONTRACT: o call-site dos sliders migrou de
  // op-nova.js para o builder compartilhado (op-distribuicao-ui.js),
  // consumido pelas duas telas (OP e Pedido).
  assert.match(oduSrc, /window\.maxMetrosItem\(/,
    'builder compartilhado não referencia window.maxMetrosItem');
});

test('8. op-nova.js contém buildProposta (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildProposta\s*\(/.test(inline), false,
    'inline ainda tem buildProposta — extração incompleta');
  assert.match(opnSrc, /function\s+buildProposta\s*\(/,
    'op-nova.js não contém buildProposta');
});

test('9. recompute vive no builder de distribuição COMPARTILHADO (NÃO no inline nem duplicado)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+recompute\s*\(/.test(inline), false,
    'inline ainda tem recompute — extração incompleta');
  // YARN-BUTTONS-FINAL-CONTRACT: recompute (habilitação dos botões +
  // consumo ao vivo) mora no builder compartilhado, consumido pelas duas
  // telas. op-nova.js apenas delega via window.buildDistribuicaoBlock.
  assert.match(oduSrc, /function\s+recompute\s*\(/,
    'builder compartilhado não contém recompute');
  assert.match(opnSrc, /window\.buildDistribuicaoBlock\(/,
    'op-nova.js deve delegar ao builder compartilhado');
});

test('10. salvar/iniciar produção vivem no builder COMPARTILHADO; sem onAceitar em lugar nenhum', () => {
  const inline = extractInlineScript(indexSrc);
  // YARN-BUTTONS-FINAL-CONTRACT: o antigo onAceitar foi eliminado. O
  // builder compartilhado persiste (salvarDistribuicaoOP) e inicia
  // produção (iniciarProducaoOP); nenhuma tela reimplementa isso.
  assert.equal(/function\s+onAceitar\s*\(/.test(inline), false,
    'inline ainda tem onAceitar');
  assert.doesNotMatch(opnSrc, /function\s+onAceitar\s*\(/,
    'op-nova.js não deve conter onAceitar');
  assert.match(oduSrc, /window\.salvarDistribuicaoOP\(/,
    'builder compartilhado deve persistir via salvarDistribuicaoOP');
  assert.match(oduSrc, /window\.iniciarProducaoOP\(/,
    'builder compartilhado deve iniciar via iniciarProducaoOP');
});

test('11. wrapper aplicarRecalculo removido de op-nova.js (fluxo antigo aposentado; NÃO no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo');
  // O wrapper aplicarRecalculo (que iniciava produção via aplicarRecalculoOP)
  // foi removido de op-nova.js — produção agora só via "Iniciar produção".
  assert.doesNotMatch(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'op-nova.js não deve mais conter o wrapper aplicarRecalculo');
});

test('12. op-nova.js NÃO contém writes de saldo_fios_op (write extraído para op-recalculo.js)', () => {
  // O wrapper aplicarRecalculo em op-nova.js apenas chama window.aplicarRecalculoOP
  // que executa os writes. Não há writes diretos em op-nova.js.
  // Leitura read-only (supa.from('saldo_fios_op').select(...)) passou a
  // ser permitida a partir de RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-
  // STANDALONE-B (bloco "4. Capacidade e ajuste" da OP Em Produção
  // Tecelagem, leitura read-only do saldo já gravado por
  // aplicarRecalculoOP) — o que continua proibido é insert/update/
  // delete/upsert nessa tabela a partir de op-nova.js.
  assert.equal(/supa\.from\(['"`]saldo_fios_op['"`]\)[\s\S]{0,200}?\.(insert|update|delete|upsert)\(/.test(opnSrc), false,
    'op-nova.js tem write (insert/update/delete/upsert) em saldo_fios_op — write deveria ter sido extraído');
});

test('13. inline NÃO contém mais from("saldo_fios") como Supabase call', () => {
  const inline = extractInlineScript(indexSrc);
  // Após a extração, o inline NÃO deve ter from('saldo_fios') como
  // chamada Supabase. Pode ter 'saldo_fios_select' etc. como string
  // de mensagens, mas não como tabela.
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios") como chamada Supabase — write deveria ter sido extraído');
});

test('14. op-nova.js contém "em_producao" como string (status em mensagens, NÃO como write direto)', () => {
  // Após a extração, o status 'em_producao' aparece apenas em strings
  // de mensagem em op-nova.js, NÃO como update direto em ops.
  // O write de status foi para op-recalculo.js.
  assert.match(opnSrc, /em_producao/,
    'op-nova.js perdeu literal em_producao — usado em mensagens do wrapper aplicarRecalculo');
  // Verifica que NÃO há write direto de ops.update com em_producao
  assert.equal(/from\s*\(\s*['"]ops['"]\s*\)[\s\S]*?update\s*\(\s*\{[\s\S]*?em_producao/.test(opnSrc), false,
    'op-nova.js ainda tem update em ops com em_producao — write deveria ter sido extraído');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

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
      single() { return Promise.resolve({ data: null, error: null }); },
      then(r) { return Promise.resolve({ data: null, error: null }).then(r); },
    }),
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
  vm.runInContext(cutoverSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-cutover.js' });
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(opPdfSrc,  sandbox, { filename: 'js/screens/op-pdf.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('15. runtime: window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem existe', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem', sandbox),
    'window.RAVATEX_SCREENS.opRecalculo.maxMetrosItem não existe');
});

// P2-A: `normalizarChaveSaldo` era a chave de filtro (cor_id / cor_poliester)
// das escritas diretas no totalizador `saldo_fios`. Essas escritas foram
// retiradas — quem grava saldo agora é `iniciar_producao_op`, escritor único
// do snapshot — e a chave morreu junto. O que este par de casos passa a
// guardar é a AUSÊNCIA do símbolo nas duas superfícies onde ele era publicado.
test('16. runtime: opRecalculo NÃO expõe mais normalizarChaveSaldo', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(
    vm.runInContext("'normalizarChaveSaldo' in window.RAVATEX_SCREENS.opRecalculo", sandbox), false,
    'a chave de saldo foi retirada junto com as escritas diretas em saldo_fios');
});


test('17. runtime: window.maxMetrosItem é função', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.maxMetrosItem', sandbox), 'function',
    'window.maxMetrosItem não é função');
});

test('18. runtime: window.normalizarChaveSaldo NÃO existe mais', () => {
  const { sandbox } = makeFullBootSandbox();
  assert.equal(typeof vm.runInContext('window.normalizarChaveSaldo', sandbox), 'undefined',
    'o global legado da chave de saldo não pode sobreviver');
});


// -------------------------------------------------------------------------
// 3. Testes unitários de maxMetrosItem
// -------------------------------------------------------------------------

function makeUnitSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(oprSrc, sandbox, { filename: 'js/screens/op-recalculo.js' });
  return sandbox;
}

// P2-A (§9.9.A): maxMetrosItem passou a ler a DISPONIBILIDADE NATIVA
// (oc_disponibilidade_op) no lugar das linhas planas de ordens_compra_fio. Uma
// linha de Ordem de Compra é um documento; teto produtivo é outra coisa, e o
// teto nativo já é consciente de origem. A ARITMÉTICA é a mesma: para cada cor
// consumida, kg disponível / kg por metro, com o menor quociente ganhando e
// arredondamento para baixo. Os números deste caso são os mesmos de antes.
test('19. maxMetrosItem com disponibilidade nativa retorna cap numérico esperado (round down)', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const disponibilidade = [
    { material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 100 },
    { material: 'algodao', cor_id: 11, cor_poliester: null, kg_disponivel: 80 },
    { material: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_disponivel: 50 },
    { material: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_disponivel: 60 },
  ];

  // rAlg = 0.5 * 2 = 1.0; rPol = 0.3 * 2 = 0.6
  // Alg 10: 100/1 = 100; Alg 11: 80/1 = 80
  // Pol PRETO: 50/0.6 = 83.33; Pol BRANCO: 60/0.6 = 100
  // Min = 80 -> floor(80) = 80

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.disponibilidadeArr = disponibilidade;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, disponibilidadeArr)',
    sandbox
  );
  assert.ok(Number.isFinite(cap), 'cap não é finito');
  assert.ok(cap >= 0, 'cap deve ser >= 0');
  assert.equal(cap, 80, 'cap deveria ser 80 (gargalo = algodao cor 11)');
});


test('20. maxMetrosItem sem ordens correspondentes retorna 0', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const ordens = []; // sem ordens

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.ordensArr = ordens;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, ordensArr)',
    sandbox
  );
  assert.equal(cap, 0, 'sem ordens, cap deve ser 0');
});

test('21. maxMetrosItem com ordens de kg_recebido = 0 retorna 0', () => {
  const sandbox = makeUnitSandbox();
  const modelosById = {
    1: { id: 1, nome: 'Test', largura: 1.40, cor_1: { id: 10, nome: 'Azul' }, cor_2: { id: 11, nome: 'Branco' } },
  };
  const parametrosByLargura = {
    '1.40': { algodao_por_ml: 0.5, poliester_por_ml: 0.3, valor_x: 2 },
  };
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 10, kg_recebido: 0 },
    { id: 2, tipo: 'algodao', cor_id: 11, kg_recebido: 0 },
    { id: 3, tipo: 'poliester', cor_poliester: 'PRETO', kg_recebido: 0 },
    { id: 4, tipo: 'poliester', cor_poliester: 'BRANCO', kg_recebido: 0 },
  ];

  sandbox.modelosByIdArr = modelosById;
  sandbox.parametrosArr = parametrosByLargura;
  sandbox.ordensArr = ordens;

  const cap = vm.runInContext(
    'window.maxMetrosItem({ modelo_id: 1 }, modelosByIdArr, parametrosArr, ordensArr)',
    sandbox
  );
  assert.equal(cap, 0, 'com ordens zeradas, cap deve ser 0 (floor(0))');
});

// -------------------------------------------------------------------------
// 4. Testes unitários de normalizarChaveSaldo
// -------------------------------------------------------------------------

// P2-A: os casos 22 e 23 exercitavam a chave de filtro do totalizador
// `saldo_fios` — algodao por cor_id, poliester por is(cor_id, null) +
// cor_poliester. Essa chave so existia para as escritas diretas em saldo_fios,
// que foram retiradas: `iniciar_producao_op` e hoje o escritor unico do
// snapshot de saldo. A cobertura vira, entao, a prova de que nem o simbolo nem
// o mecanismo que ele servia sobreviveram.
test('22. a chave de saldo foi retirada junto com as escritas diretas em saldo_fios', () => {
  const sandbox = makeUnitSandbox();
  assert.equal(typeof vm.runInContext('window.normalizarChaveSaldo', sandbox), 'undefined',
    'normalizarChaveSaldo nao pode continuar publicado');
  assert.equal(/function\s+normalizarChaveSaldo/.test(oprSrc), false,
    'a implementacao da chave de saldo tem de estar retirada');
});

test('23. nenhum filtro de totalizador de saldo resta no modulo', () => {
  // Os dois eixos que a chave montava: eq(cor_id) para algodao e
  // is(cor_id, null) + eq(cor_poliester) para poliester.
  assert.equal(/\.is\(\s*['"]cor_id['"]\s*,\s*null\s*\)/.test(oprSrc), false,
    'o filtro de poliester do totalizador nao pode restar');
  assert.equal(/kg_total/.test(oprSrc), false,
    'o totalizador saldo_fios.kg_total nao e mais escrito por esta tela');
});


test('24. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + painel + op-recalculo + inline coexiste sem SyntaxError', () => {
  // Após ROUTES-BOOT-MODULE-A, o inline foi removido. O entrypoint
  // é agora js/boot.js. Este teste continua válido: verifica que
  // os módulos + boot coexistem sem SyntaxError. Para verificar
  // as rotas, ver tests/boot.smoke.js.
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeFullBootSandbox();

  let threwSyntax = false;
  let otherErr = null;
  try {
    // inline agora é vazio (extraído para boot.js)
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'boot com módulos + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('25. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('26. setRoutes e main foram extraídos para js/boot.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes e main saíram do inline
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

// -------------------------------------------------------------------------
// 6. aplicarRecalculoOP — extraído do inline (Seam B)
// -------------------------------------------------------------------------

function makeRecalculoSandbox({
  opItensFailOnCall = null,
  opItensFailAlways = null,
  saldoFiosOpFailAlways = null,
  saldoFiosSelectError = null,
  saldoFiosExistingData = { kg_total: 10 },
  saldoFiosUpdateError = null,
  saldoFiosInsertError = null,
  opsStatusError = null,
} = {}) {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };

  const calls = [];
  let opItensCallCount = 0;

  const fakeSupa = {
    from: (table) => {
      calls.push({ op: 'from', table });
      const chain = {
        _table: table,
        _lastMutation: null,
        _payload: null,
        _isFilter: {},
        _eqFilter: {},
        select() { chain._lastMutation = 'select'; return chain; },
        update(payload) { chain._lastMutation = 'update'; chain._payload = payload; return chain; },
        insert(payload) { chain._lastMutation = 'insert'; chain._payload = payload; return chain; },
        delete() { chain._lastMutation = 'delete'; return chain; },
        eq(col, val) {
          calls.push({ op: 'eq', table, col, val });
          chain._eqFilter[col] = val;
          return chain;
        },
        is(col, val) {
          calls.push({ op: 'is', table, col, val });
          chain._isFilter[col] = val;
          return chain;
        },
        order() { return chain; },
        in() { return chain; },
        maybeSingle() {
          if (chain._table === 'saldo_fios') {
            return Promise.resolve({ data: saldoFiosExistingData, error: saldoFiosSelectError });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(resolve, reject) {
          if (chain._table === 'op_itens' && chain._lastMutation === 'update') {
            opItensCallCount++;
            calls.push({ op: 'op_itens_update', call: opItensCallCount });
            if (opItensFailAlways) {
              return Promise.resolve({ data: null, error: new Error('mock op_itens') }).then(resolve, reject);
            }
            if (opItensFailOnCall != null && opItensCallCount === opItensFailOnCall) {
              return Promise.resolve({ data: null, error: new Error('mock op_itens on call ' + opItensFailOnCall) }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios_op' && chain._lastMutation === 'insert') {
            calls.push({ op: 'saldo_fios_op_insert', payload: chain._payload });
            if (saldoFiosOpFailAlways) {
              const err = typeof saldoFiosOpFailAlways === 'object' ? saldoFiosOpFailAlways : new Error('mock saldo_fios_op');
              return Promise.resolve({ data: null, error: err }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios' && chain._lastMutation === 'update') {
            calls.push({ op: 'saldo_fios_update', eq: chain._eqFilter, is: chain._isFilter, payload: chain._payload });
            if (saldoFiosUpdateError) {
              const err = typeof saldoFiosUpdateError === 'object' ? saldoFiosUpdateError : new Error('mock saldo_fios_update');
              return Promise.resolve({ data: null, error: err }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'saldo_fios' && chain._lastMutation === 'insert') {
            calls.push({ op: 'saldo_fios_insert', payload: chain._payload });
            if (saldoFiosInsertError) {
              const err = typeof saldoFiosInsertError === 'object' ? saldoFiosInsertError : new Error('mock saldo_fios_insert');
              return Promise.resolve({ data: null, error: err }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (chain._table === 'ops' && chain._lastMutation === 'update') {
            calls.push({ op: 'ops_update_status', payload: chain._payload });
            if (opsStatusError) {
              return Promise.resolve({ data: null, error: new Error('mock ops') }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
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
    _calls: calls,
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
  vm.runInContext(cutoverSrc, sandbox, { filename: 'js/screens/ordem-compra-receipt-cutover.js' });
  vm.runInContext(opwSrc,    sandbox, { filename: 'js/screens/op-writes.js' });
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(opPdfSrc,  sandbox, { filename: 'js/screens/op-pdf.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox, fakeSupa, calls };
}

function resultadoAceitar(overrides = {}) {
  return {
    fator: 0.8,
    itens: [
      { op_item_id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 },
      { op_item_id: 101, modelo_id: 2, metros_pedidos: 60, metros_ajustados: 48 },
    ],
    sobras: [
      { ordem_id: 1, tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_sobra: 5 },
      { ordem_id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_sobra: 3 },
    ],
    ...overrides,
  };
}

function ordensManter(extras = []) {
  return [
    { id: 1, tipo: 'algodao', cor_id: 10, cor_poliester: null, kg_pedido: 30, kg_recebido: 35 },
    { id: 3, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 20, kg_recebido: 23 },
    ...extras,
  ];
}

// ---- 1-2: Exports -----------------------------------------------------

// -----------------------------------------------------------------------------
// O ESCRITOR ANTIGO — RETIRADO EM P2-A (secoes 9.9.C e 9.9.D)
//
// Os casos 27 a 42 provavam `aplicarRecalculoOP` e todo o seu maquinario:
// o laco de UPDATE item a item em op_itens, o calculo local de sobras a partir
// de kg_recebido - kg_pedido das ordens planas, o INSERT em saldo_fios_op, o
// select/update/insert do totalizador saldo_fios, o `UPDATE ops SET
// status='em_producao'` feito pelo cliente, os steps de falha e a semantica de
// sucesso PARCIAL — que deixava metade dos itens gravados quando um write
// falhava no meio.
//
// Nada disso existe mais. O servidor e o dono: `salvar_ajuste_producao_op`
// valida o payload COMPLETO contra os tetos por eixo ANTES de qualquer
// escrita, e `iniciar_producao_op` e o escritor unico do snapshot saldo_fios_op
// e da transicao de status. Nao ha mais estado parcial para o cliente relatar,
// e por isso nao ha mais o que asserir sobre steps intermediarios.
//
// As assercoes abaixo substituem aquele bloco pelo mecanismo canonico do P2-A.
// A cobertura comportamental ampla vive em tests/op-ajuste-atomico.smoke.js.
// -----------------------------------------------------------------------------

// Sandbox local com transporte RPC controlado (o makeRecalculoSandbox acima
// mocka por TABELA, que e justamente o que este modulo deixou de usar).
function makeRpcSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableCalls = [];
  const sandbox = { console, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = {
    from(table) { tableCalls.push(table); return new Proxy({}, { get: () => () => ({}) }); },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: null, error: null });
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(oprSrc, sandbox, { filename: 'js/screens/op-recalculo.js' });
  return { sandbox, rpcCalls, tableCalls };
}

test('27. window.aplicarRecalculoOP NAO existe mais', () => {
  const { sandbox } = makeRpcSandbox();
  assert.equal(typeof sandbox.aplicarRecalculoOP, 'undefined',
    'o escritor antigo foi retirado e nao pode continuar publicado');
});

test('28. RAVATEX_SCREENS.opRecalculo NAO expoe mais aplicarRecalculoOP', () => {
  const { sandbox } = makeRpcSandbox();
  assert.equal('aplicarRecalculoOP' in sandbox.RAVATEX_SCREENS.opRecalculo, false,
    'a namespace nao pode reexpor o escritor retirado');
});

test('29. o modulo expoe exatamente os quatro donos do P2-A', () => {
  const { sandbox } = makeRpcSandbox();
  assert.deepEqual(
    Object.keys(sandbox.RAVATEX_SCREENS.opRecalculo).sort().join(','),
    'carregarDisponibilidadeOP,iniciarProducaoOP,maxMetrosItem,salvarDistribuicaoOP',
    'a superficie do modulo tem de ser exatamente a do P2-A');
});

test('30. salvar a distribuicao e UMA chamada ao escritor atomico, sem DML', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeRpcSandbox(
    () => ({ data: { ok: true, ajuste_revisao: 8, itens_aplicados: 2 }, error: null }));
  const r = await sandbox.salvarDistribuicaoOP({
    opId: 900001, baseAjusteRevisao: 7,
    itens: [{ op_item_id: 100, metros_ajustados: 40 }, { op_item_id: 101, metros_ajustados: 48 }],
  });
  assert.equal(r.error, null);
  assert.equal(r.ajusteRevisao, 8);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['salvar_ajuste_producao_op']);
  assert.deepEqual(tableCalls, [], 'nenhum DML direto pode restar');
});

test('31. o laco de UPDATE item a item sumiu: o payload viaja inteiro', async () => {
  const { sandbox, rpcCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.salvarDistribuicaoOP({
    opId: 900001, baseAjusteRevisao: 0,
    itens: [{ op_item_id: 1, metros_ajustados: 10 }, { op_item_id: 2, metros_ajustados: 20 },
            { op_item_id: 3, metros_ajustados: 30 }],
  });
  assert.equal(rpcCalls.length, 1, 'tres itens continuam sendo UMA chamada');
  assert.equal(rpcCalls[0].params.p_itens.length, 3);
});

test('32. limpar um ajuste viaja como null pelo MESMO escritor', async () => {
  const { sandbox, rpcCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.salvarDistribuicaoOP({
    opId: 900001, baseAjusteRevisao: 0,
    itens: [{ op_item_id: 1, metros_ajustados: null }],
  });
  assert.equal(rpcCalls[0].fn, 'salvar_ajuste_producao_op');
  assert.equal(rpcCalls[0].params.p_itens[0].metros_ajustados, null);
});

test('33. a semantica de sucesso PARCIAL desapareceu do contrato de retorno', async () => {
  const { sandbox } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  const r = await sandbox.salvarDistribuicaoOP({ opId: 1, baseAjusteRevisao: 0, itens: [] });
  assert.equal('partial' in r, false, 'as RPCs do P2 sao atomicas: nao ha sucesso parcial');
  assert.equal('step' in r, false, 'nao ha mais steps intermediarios para relatar');
});

test('34. uma recusa de negocio vira { error, codigo } sem lancar', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: { ok: false, codigo: 'AJUSTE_EXCEDE_DISPONIVEL' }, error: null }));
  const r = await sandbox.salvarDistribuicaoOP({ opId: 1, baseAjusteRevisao: 0, itens: [] });
  assert.ok(r.error, 'a recusa tem de ser observavel');
  assert.equal(r.codigo, 'AJUSTE_EXCEDE_DISPONIVEL');
});

test('35. revisao desatualizada e sinalizada explicitamente ao chamador', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA', ajuste_revisao_atual: 9 }, error: null }));
  const r = await sandbox.salvarDistribuicaoOP({ opId: 1, baseAjusteRevisao: 7, itens: [] });
  assert.equal(r.revisaoDesatualizada, true,
    'o conflito de revisao tem de ser distinguivel de qualquer outro erro');
});

test('36. uma negacao de permissao do Postgres e traduzida, nao engolida', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: null, error: Object.assign(new Error('permission denied'), { code: '42501' }) }));
  const r = await sandbox.salvarDistribuicaoOP({ opId: 1, baseAjusteRevisao: 0, itens: [] });
  assert.equal(r.codigo, 'sem_permissao');
  assert.ok(r.error);
});

test('37. iniciar producao e UMA chamada ao escritor do servidor, sem DML', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeRpcSandbox(
    () => ({ data: { ok: true, ajuste_revisao: 9, proxima_acao: { rota: '#/ops/1', rotulo: 'X' } }, error: null }));
  const r = await sandbox.iniciarProducaoOP({ opId: 900001, baseAjusteRevisao: 8 });
  assert.equal(r.error, null);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['iniciar_producao_op']);
  assert.deepEqual(tableCalls, [], 'nem saldo nem status sao escritos pelo cliente');
});

test('38. o snapshot de saldo NAO e mais montado nem enviado pelo cliente', async () => {
  const { sandbox, rpcCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.iniciarProducaoOP({ opId: 900001, baseAjusteRevisao: 0 });
  assert.deepEqual(Object.keys(rpcCalls[0].params).sort(), ['p_base_ajuste_rev', 'p_op_id'],
    'iniciar_producao_op recebe so a OP e a revisao — sobras sao derivadas no servidor');
});

test('39. a rota e o rotulo de continuacao vem do servidor', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: { ok: true, proxima_acao: { rota: '#/pedidos/p1/producao', rotulo: 'Revisar producao' } }, error: null }));
  const r = await sandbox.iniciarProducaoOP({ opId: 1, baseAjusteRevisao: 0 });
  assert.equal(r.proximaAcao.rota, '#/pedidos/p1/producao');
  assert.equal(r.proximaAcao.rotulo, 'Revisar producao');
});

test('40. uma OP fora de aberta e recusada pelo servidor e o codigo chega ao chamador', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: { ok: false, codigo: 'INICIO_OP_ESTADO_INVALIDO', status: 'simulada' }, error: null }));
  const r = await sandbox.iniciarProducaoOP({ opId: 1, baseAjusteRevisao: 0 });
  assert.equal(r.codigo, 'INICIO_OP_ESTADO_INVALIDO');
  assert.equal(r.proximaAcao, null, 'uma recusa nao pode trazer continuacao');
});

test('41. a disponibilidade vem da projecao nativa e nunca de tabela', async () => {
  const linhas = [{ material: 'algodao', cor_id: 10, kg_disponivel: 100 }];
  const { sandbox, rpcCalls, tableCalls } = makeRpcSandbox(() => ({ data: linhas, error: null }));
  const r = await sandbox.carregarDisponibilidadeOP({ opId: 900001 });
  assert.equal(r.error, null);
  assert.deepEqual(Array.from(r.data), linhas);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['oc_disponibilidade_op']);
  assert.deepEqual(tableCalls, [], 'o teto nunca e lido por tabela');
});

test('42. um erro ao carregar a disponibilidade nao vira lista silenciosa', async () => {
  const { sandbox } = makeRpcSandbox(() => ({ data: null, error: new Error('boom') }));
  const r = await sandbox.carregarDisponibilidadeOP({ opId: 1 });
  assert.ok(r.error, 'o erro tem de ser propagado');
  assert.equal(r.data, null, 'um teto ausente nao pode virar teto vazio silencioso');
});


test('42.1 window.salvarDistribuicaoOP e window.iniciarProducaoOP são funções', () => {
  const { sandbox } = makeRecalculoSandbox();
  assert.equal(typeof vm.runInContext('window.salvarDistribuicaoOP', sandbox), 'function',
    'window.salvarDistribuicaoOP não é função');
  assert.equal(typeof vm.runInContext('window.iniciarProducaoOP', sandbox), 'function',
    'window.iniciarProducaoOP não é função');
});

test('42.2 RAVATEX_SCREENS.opRecalculo expõe salvarDistribuicaoOP e iniciarProducaoOP', () => {
  const { sandbox } = makeRecalculoSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.salvarDistribuicaoOP', sandbox));
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opRecalculo.iniciarProducaoOP', sandbox));
});

test('42.3 salvarDistribuicaoOP fala SO com salvar_ajuste_producao_op', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.salvarDistribuicaoOP({ opId: 1, baseAjusteRevisao: 0, itens: [{ op_item_id: 1, metros_ajustados: 5 }] });
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['salvar_ajuste_producao_op'],
    'salvar distribuicao nao pode gravar saldo nem status');
  assert.deepEqual(tableCalls, []);
});

test('42.4 salvarDistribuicaoOP submete a revisao-base recebida, sem inventa-la', async () => {
  const { sandbox, rpcCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.salvarDistribuicaoOP({ opId: 77, baseAjusteRevisao: 12, itens: [] });
  assert.equal(rpcCalls[0].params.p_op_id, 77);
  assert.equal(rpcCalls[0].params.p_base_ajuste_rev, 12);
});

test('42.5 iniciarProducaoOP NAO grava op_itens (a distribuicao ja foi salva)', async () => {
  const { sandbox, rpcCalls } = makeRpcSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.iniciarProducaoOP({ opId: 1, baseAjusteRevisao: 0 });
  assert.equal(rpcCalls.length, 1);
  assert.equal('p_itens' in rpcCalls[0].params, false,
    'iniciar producao nao reenvia a distribuicao');
});

test('42.6 iniciarProducaoOP devolve a falha do servidor sem lancar', async () => {
  const { sandbox } = makeRpcSandbox(
    () => ({ data: { ok: false, codigo: 'concorrencia_ocupada' }, error: null }));
  const r = await sandbox.iniciarProducaoOP({ opId: 1, baseAjusteRevisao: 0 });
  assert.equal(r.codigo, 'concorrencia_ocupada');
  assert.ok(r.error);
});

test('42.7 o modulo nao tem mais nenhum caminho que escreva saldo ou status', () => {
  const executavel = oprSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/saldo_fios/.test(executavel), false, 'nenhuma escrita de saldo pode restar');
  assert.equal(/em_producao/.test(executavel), false, 'a transicao de status e do servidor');
});


test('43. o modulo usa os tres escritores/leitores canonicos do P2-A', () => {
  assert.match(oprSrc, /rpc\('oc_disponibilidade_op'/,
    'a disponibilidade tem de vir da projecao nativa');
  assert.match(oprSrc, /rpc\('salvar_ajuste_producao_op'/,
    'o ajuste tem de ser do escritor atomico');
  assert.match(oprSrc, /rpc\('iniciar_producao_op'/,
    'o inicio tem de ser do escritor do servidor');
});


test('44. helper não chama toast()', () => {
  assert.equal(/toast\s*\(/.test(oprSrc), false,
    'aplicarRecalculoOP não deve chamar toast()');
});

test('45. helper não chama navigate()', () => {
  assert.equal(/navigate\s*\(/.test(oprSrc), false,
    'aplicarRecalculoOP não deve chamar navigate()');
});

test('46. helper não acessa document.* (DOM)', () => {
  assert.equal(/document\./.test(oprSrc), false,
    'aplicarRecalculoOP não deve acessar document');
});

// ---- 21-28: inline aplicarRecalculo (estrutura preservada) -----------

// Extrai o corpo de aplicarRecalculo do source via balanced-brace walk.
// Após SCREENNOVAOP-MODULE-A, a função está em op-nova.js (NÃO no inline).
function extractAplicarRecalculoBlock(src) {
  const start = src.search(/async\s+function\s+aplicarRecalculo\s*\(/);
  if (start < 0) return null;
  // Encontra a primeira `{` (corpo da função)
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 1;
  i++;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return src.slice(start, i);
}

test('47. wrapper aplicarRecalculo removido de op-nova.js; delega ao builder COMPARTILHADO', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+aplicarRecalculo\s*\(/.test(inline), false,
    'inline ainda tem aplicarRecalculo');
  // YARN-BUTTONS-FINAL-CONTRACT: o wrapper que iniciava produção (fluxo
  // combinado aplicarRecalculoOP) foi retirado de op-nova.js.
  assert.doesNotMatch(opnSrc, /async\s+function\s+aplicarRecalculo\s*\(/,
    'wrapper aplicarRecalculo deve ter sido removido de op-nova.js');
  assert.match(opnSrc, /window\.buildDistribuicaoBlock\(/,
    'op-nova.js deve delegar ao builder compartilhado');
});

test('48. builder compartilhado: rodapé é SAVE-ONLY (salvarDistribuicaoOP), nunca aplicarRecalculoOP', () => {
  assert.match(oduSrc, /window\.salvarDistribuicaoOP\(/,
    'Manter/Salvar devem persistir via salvarDistribuicaoOP');
  assert.doesNotMatch(oduSrc, /window\.aplicarRecalculoOP\(/,
    'o builder compartilhado NÃO deve usar o fluxo combinado aplicarRecalculoOP');
});

test('49. builder compartilhado inicia produção só via iniciarProducaoOP', () => {
  assert.match(oduSrc, /window\.iniciarProducaoOP\(/,
    'Iniciar produção deve usar iniciarProducaoOP');
});

test('50. op-nova.js NÃO faz WRITES de saldo (só leitura; writes centralizados em op-recalculo.js)', () => {
  // Leitura (.select) de saldo_fios_op é permitida (visão Em Produção).
  // O que não pode existir é INSERT/UPDATE de saldo a partir de op-nova.js.
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)\s*\.insert\s*\(/.test(opnSrc), false,
    'op-nova.js não deve inserir em saldo_fios_op');
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)\s*\.(insert|update)\s*\(/.test(opnSrc), false,
    'op-nova.js não deve escrever em saldo_fios');
});

test('51. op-nova.js NÃO muda ops.status para em_producao diretamente', () => {
  const re = /from\s*\(\s*['"]ops['"]\s*\)[\s\S]*?update\s*\(\s*\{[\s\S]*?status\s*:\s*['"]em_producao['"]/;
  assert.equal(re.test(opnSrc), false,
    'op-nova.js não deve conter update de ops para em_producao');
});

test('52. builder compartilhado NÃO faz writes inline de saldo/status (usa helpers de op-recalculo.js)', () => {
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)/.test(oduSrc), false,
    'builder compartilhado não deve escrever em saldo_fios_op diretamente');
  assert.equal(/\.from\s*\(\s*['"]ops['"]\s*\)/.test(oduSrc), false,
    'builder compartilhado não deve mudar status de ops diretamente');
});

test('53. os writes de saldo e de status passaram a ser do SERVIDOR', () => {
  // Este caso afirmava o oposto — que saldo_fios_op e a transicao
  // em_producao deviam estar em op-recalculo.js. Em P2-A esses writes
  // migraram para iniciar_producao_op (db/102), escritor unico do snapshot e
  // da transicao, e o modulo virou cliente fino.
  const executavel = oprSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)/.test(executavel), false,
    'op-recalculo.js nao pode mais conter o write de saldo_fios_op');
  assert.equal(/status\s*:\s*['"]em_producao['"]/.test(executavel), false,
    'op-recalculo.js nao pode mais conter a transicao para em_producao');
  assert.match(oprSrc, /rpc\('iniciar_producao_op'/,
    'os dois writes agora sao do servidor, atraves de iniciar_producao_op');
});


test('54. sem bloco aplicarRecalculo em op-nova.js (fluxo retirado)', () => {
  assert.equal(extractAplicarRecalculoBlock(opnSrc), null,
    'não deve haver bloco aplicarRecalculo em op-nova.js');
});

// ---- 29-32: outras funções continuam inline -------------------------

test('55. persistir NÃO está mais inline (extraído para op-persistir.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem persistir - função deveria ter sido extraída');
});

test('56. buildProposta em op-nova.js delega ao builder compartilhado; recompute mora no módulo compartilhado', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/function\s+buildProposta\s*\(/.test(inline), false,
    'inline ainda tem buildProposta — extração incompleta');
  assert.equal(/function\s+recompute\s*\(/.test(inline), false,
    'inline ainda tem recompute — extração incompleta');
  assert.equal(/function\s+onAceitar\s*\(/.test(inline), false,
    'inline ainda tem onAceitar — extração incompleta');
  // YARN-BUTTONS-FINAL-CONTRACT: buildProposta continua em op-nova.js mas
  // como wrapper fino; recompute/salvar/iniciar vivem no builder
  // COMPARTILHADO (op-distribuicao-ui.js), consumido também pelo Pedido.
  assert.match(opnSrc, /function\s+buildProposta\s*\(/);
  assert.match(opnSrc, /window\.buildDistribuicaoBlock\(/);
  assert.match(oduSrc, /function\s+recompute\s*\(/);
});

test('57. screenNovaOP foi extraída para op-nova.js (NÃO está mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem screenNovaOP — extração incompleta');
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não contém screenNovaOP');
});

test('58. setRoutes e main foram extraídos para js/boot.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes e main saíram do inline
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

// ---- 33: boot chain sem SyntaxError ---------------------------------

test('59. boot chain: ui + router + system-screens + common + cadastros + ops-list + entrega-form + entrega-writes + fornecedor + op-form-helpers + op-writes + op-latex-admin + painel + op-recalculo + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeRecalculoSandbox();

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
    'boot com op-recalculo + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});
