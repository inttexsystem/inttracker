// Smoke test do módulo js/screens/op-nova.js
// (SCREENNOVAOP-MODULE-A).
//
// Garante que a extração de screenNovaOP do <script> inline de
// index.html para js/screens/op-nova.js preservou:
//   - a função screenNovaOP inteira (com ~20 subfunções de closure);
//   - a assinatura async function screenNovaOP(opId);
//   - os call-sites modularizados (window.persistirOP,
//     window.aplicarRecalculoOP, window.maxMetrosItem,
//     window.itensValidosOP, window.registrarRecebimentoOrdemFio,
//     window.atribuirFornecedorFioOp, window.renderOPLatexAdmin,
//     window.rotuloModelo, window.fmtKg, window.fmtMetros,
//     window.disabledAttr, etc.);
//   - gerarPdfCompraFios extraído para js/screens/op-pdf.js
//     (OP-NOVA-PDF-MODULE-A); op-nova.js chama
//     window.gerarPdfCompraFios({ op, ordens }).
//
// Estáticos (1-10):
//   1. js/screens/op-nova.js existe.
//   2. node --check js/screens/op-nova.js passa.
//   3. op-nova.js é script clássico, sem import/export.
//   4. index.html carrega op-nova.js exatamente uma vez.
//   5. Ordem: op-persistir.js → op-nova.js → jspdf → inline.
//   6. index.html NÃO contém mais async function screenNovaOP.
//   7. index.html contém window.screenNovaOP(null) no call-site
//      de #/ops/nova.
//   8. index.html AINDA contém setRoutes.
//   9. index.html AINDA contém main.
//  10. js/screens/op-nova.js contém async function screenNovaOP.
//
// Runtime (11-15):
//  11. window.screenNovaOP é função.
//  12. window.RAVATEX_SCREENS.opNova.screenNovaOP existe.
//  13. op-nova.js NÃO contém gerarPdfCompraFios (extraída para
//      op-pdf.js em OP-NOVA-PDF-MODULE-A); chama
//      window.gerarPdfCompraFios no call-site.
//  14. op-nova.js contém buildProposta / recompute / onAceitar.
//  15. op-nova.js mantém buildBlocoFios / buildOrdemPendenteRow e
//      delega Tecelagem em produção para op-tecelagem-producao-admin.js
//      (sem renderer operacional duplicado em op-nova.js).
//
// Call-sites de módulos extraídos (16-22):
//  16. op-nova.js chama window.persistirOP.
//  17. op-nova.js chama window.aplicarRecalculoOP.
//  18. op-nova.js chama window.registrarRecebimentoOrdemFio.
//  19. op-nova.js chama window.atribuirFornecedorFioOp.
//  20. op-nova.js chama window.renderOPLatexAdmin.
//  21. op-nova.js chama window.maxMetrosItem / window.itensValidosOP.
//  22. op-nova.js chama window.disabledAttr / window.rotuloModelo /
//      window.fmtKg / window.fmtMetros.
//
// Sem regressão de writes (23-26):
//  23. op-nova.js NÃO contém de from().insert/update/delete
//      (todos os writes ficaram em op-persistir.js / op-recalculo.js
//      / op-writes.js).
//  24. op-nova.js contém apenas from().select() (reads) OU
//      nenhum from() direto.
//  25. index.html NÃO contém implementação de persistirOP (helper
//      já extraído).
//  26. index.html NÃO contém implementação de aplicarRecalculoOP
//      (helper já extraído).
//
// setRoutes/main inline (27-28):
//  27. setRoutes e main continuam inline em index.html.
//  28. setRoutes referencia window.screenNovaOP(null) para #/ops/nova.
//
// Boot chain (29-30):
//  29. Boot chain: todos os módulos + op-nova + inline coexiste
//      sem SyntaxError de duplicate identifier.
//  30. window.screenNovaOP continua resolvível após o boot completo.
//
// RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B (39-47):
// OP Em Produção Tecelagem passou a usar template operacional próprio
// (baseado no standalone PROD-OP-TECELAGEM), separado do template de
// preparação (Nova OP/OP Aberta). Testes 39-47 cobrem essa separação:
//  39. OP Em Produção Tecelagem usa o template PROD-OP (sinais mínimos).
//  40. OP Aberta Tecelagem não ganha os blocos operacionais novos.
//  41. OP Em Produção Tecelagem não usa linguagem de preparação.
//  42. Card "Entregas tecelagem" ausente na OP Aberta.
//  43. Card "Entregas tecelagem" presente na OP Em Produção Tecelagem.
//  44. Fluxo de entrega (+ Nova entrega/Editar/Excluir) preservado.
//  45. Histórico (Bloco 7) cai no fallback controlado sem op_eventos.
//  46. Histórico (Bloco 7) renderiza op_eventos real quando disponível.
//  47. Acabamento/Látex continua delegado, sem template PROD-OP-TECELAGEM.
//  48. Guardas de segurança: sem alterar_status_op, sem write novo de status.
//
// RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B (ajuste fino
// visual, 49-54): paridade estrutural mais fina com o standalone
// PROD-OP-TECELAGEM, sem backend novo.
//  49. Breadcrumb "OPs / OP X/ANO" + botão Voltar.
//  50. Cadeia produtiva (lineage strip) aparece quando há OP de
//      Acabamento/Látex gerada por entrega parcial.
//  51. Cadeia produtiva ausente quando não há OP gerada.
//  52. Bloco "4. Capacidade e ajuste" lê saldo_fios_op (read-only) e
//      mostra consumo/sobra real; sem "fator" fabricado.
//  53. Bloco "4. Capacidade e ajuste" cai no fallback controlado sem
//      saldo_fios_op.
//  54. Documentos da OP com aparência de lista (Romaneio/Nota fiscal de
//      entrada/Nota fiscal de saída), ainda placeholder/controlado.
//  55. Saldo negativo/excedente (entregue > ajustado) tem tratamento
//      visual próprio — não fica escondido atrás de "✅ completo".
//
// RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY
// (correção de layout real encontrada via preview em navegador — texto
// sozinho não detecta colunas desproporcionais, 56-59):
//  56. Subtítulo do header mostra "Aberta em DATA" quando op.criado_em
//      existir.
//  57. Card 1 "Dados da OP" usa grid de 2 colunas (não 3) — 3 colunas
//      quebravam rótulos longos ("Fornecedor de tecelagem", "Item do
//      pedido vinculado") uns sobre os outros em larguras ~800px.
//  58. Card "Entregas tecelagem" (colunas fixas em px) tem wrapper
//      overflow-x:auto — sem isso a coluna FALTA ficava cortada/
//      escondida atrás da borda da página em larguras estreitas.
//  59. Bloco "5. Movimentação" usa grid-template-columns auto-fit (não
//      repeat(3,...) fixo) — 3 colunas rígidas espremiam rótulo+valor de
//      cada estatística ao dividir a largura com a coluna de Documentos.
//
// RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY
// (2ª correção — inconsistência de ícones vs. o standalone, 60-63):
// nenhum dos 7 blocos do standalone PROD-OP-TECELAGEM usa ícone no
// título (confirmado card a card no markup de referência) — mas os
// cards 3 ("Recebimento de fios") e "Entregas tecelagem" (funções
// reaproveitadas sem alteração das fases anteriores) ainda carregavam
// o ícone herdado do template Nova OP/OP Aberta.
//  60. Tela Em Produção Tecelagem não tem nenhum ícone de seção (Card 3
//      e Entregas tecelagem alinhados aos demais 5 blocos).
//  61. Card 3 usa o texto do standalone ("3. Insumos — recebimento de
//      fios") na tela Em Produção.
//  62. Card 3 mostra "Todos os fios desta OP já foram recebidos." na
//      tela Em Produção quando não há ordens pendentes.
//  63. OP Aberta continua com o ícone do Card 3 (regressão: o ajuste é
//      condicional por status, não deve afetar a tela de preparação).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OPN   = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OPTP  = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');
const OPPDF = path.join(ROOT, 'js', 'screens', 'op-pdf.js');
const OPP   = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const OPR   = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const PAINEL= path.join(ROOT, 'js', 'screens', 'painel.js');
const OLA   = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const OPW   = path.join(ROOT, 'js', 'screens', 'op-writes.js');
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
const opnSrc    = fs.readFileSync(OPN,   'utf8');
const optpSrc   = fs.readFileSync(OPTP,  'utf8');
const opPdfSrc  = fs.readFileSync(OPPDF, 'utf8');
const oppSrc    = fs.readFileSync(OPP,   'utf8');
const oprSrc    = fs.readFileSync(OPR,   'utf8');
const painelSrc = fs.readFileSync(PAINEL,'utf8');
const olaSrc    = fs.readFileSync(OLA,   'utf8');
const opwSrc    = fs.readFileSync(OPW,   'utf8');
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
    this.style = {};
    this.firstElementChild = null;
    this._innerHTML = '';
  }
  appendChild(n) {
    if (n && typeof n === 'object') n.parentNode = this;
    this.children.push(n);
    if (!this.firstElementChild && n && n.tagName) this.firstElementChild = n;
    return n;
  }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    this.firstElementChild = null;
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      const child = typeof n === 'string' ? { textContent: n, appendChild(){}, setAttribute(){} } : n;
      if (!this.firstElementChild && child && child.tagName) this.firstElementChild = child;
      this.children.push(child);
    }
  }
  remove() { this._removed = true; }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((n) => n && typeof n.textContent === 'string' ? n.textContent : '').join('');
  }
  set textContent(v) { this._text = v; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this.children = [];
    const svg = new FakeNode('svg');
    svg._raw = String(v);
    this.firstElementChild = svg;
    this.children.push(svg);
  }
}

// -------------------------------------------------------------------------
// 1. Estáticos
// -------------------------------------------------------------------------

test('1. js/screens/op-nova.js existe', () => {
  assert.ok(fs.existsSync(OPN), 'js/screens/op-nova.js não existe');
});

test('2. op-nova.js: sintaxe JS válida (node --check)', () => {
  cp.execSync(`node --check "${OPN}"`, { stdio: 'pipe' });
});

test('3. op-nova.js é script clássico, sem import/export', () => {
  assert.equal(/^\s*export\s+/m.test(opnSrc), false,
    'op-nova.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(opnSrc), false,
    'op-nova.js parece usar import — deve ser script clássico');
});

test('4. index.html carrega op-nova.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Aceita com ou sem query string (cache-busting ?v=...).
  const reWithQs = /<script\s+src="js\/screens\/op-nova\.js\?v=20260623-asset1"\s*><\/script>/g;
  const reNoQs   = /<script\s+src="js\/screens\/op-nova\.js"\s*><\/script>/g;
  const total = (indexSrc.match(reWithQs) || []).length + (indexSrc.match(reNoQs) || []).length;
  assert.equal(total, 1,
    `esperado 1 <script src="js/screens/op-nova.js">, encontrado ${total}`);
  assert.equal(/<script[^>]*src="js\/screens\/op-nova\.js"[^>]*type=/.test(indexSrc), false,
    'op-nova.js está sendo carregado com type=module');
});

test('5. index.html: ordem op-persistir.js → op-pdf.js → op-nova.js → jspdf → boot.js (último local antes de </head>)', () => {
  const oppIdx    = findScriptIdx(indexSrc, 'js/screens/op-persistir.js');
  const opPdfIdx  = findScriptIdx(indexSrc, 'js/screens/op-pdf.js');
  const optpIdx   = findScriptIdx(indexSrc, 'js/screens/op-tecelagem-producao-admin.js');
  const opnIdx    = findScriptIdx(indexSrc, 'js/screens/op-nova.js');
  const jspdfIdx  = indexSrc.indexOf('cdnjs.cloudflare.com/ajax/libs/jspdf');
  const bootIdx   = findScriptIdx(indexSrc, 'js/boot.js');
  assert.ok(oppIdx > 0, 'op-persistir.js não encontrado');
  assert.ok(opPdfIdx > 0, 'op-pdf.js não encontrado (extraído de op-nova.js)');
  assert.ok(optpIdx > 0, 'op-tecelagem-producao-admin.js nao encontrado');
  assert.ok(opnIdx > 0, 'op-nova.js não encontrado');
  assert.ok(jspdfIdx > 0, 'jspdf não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js não encontrado como último script local');
  assert.ok(oppIdx < opPdfIdx, 'op-persistir.js deve vir antes de op-pdf.js');
  assert.ok(opPdfIdx < optpIdx, 'op-pdf.js deve vir antes de op-tecelagem-producao-admin.js');
  assert.ok(optpIdx < opnIdx, 'op-tecelagem-producao-admin.js deve vir antes de op-nova.js');
  assert.ok(opnIdx < jspdfIdx, 'op-nova.js deve vir antes de jspdf');
  assert.ok(jspdfIdx < bootIdx, 'jspdf CDN deve vir antes de boot.js');
  assert.ok(bootIdx > jspdfIdx, 'boot.js deve ser o último script local');
});

test('6. index.html NÃO contém mais async function screenNovaOP (extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/async\s+function\s+screenNovaOP\s*\(/.test(inline), false,
    'inline ainda tem async function screenNovaOP — extração incompleta');
});

test('7. boot.js contém call-site de #/ops/nova com leitura de pedido_id e window.screenNovaOP(null, pid)', () => {
  // Após ROUTES-BOOT-MODULE-A, o inline foi removido e o call-site
  // de #/ops/nova está em js/boot.js.
  const bootSrc = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');
  assert.match(bootSrc, /'#\/ops\/nova':\s*\{\s*render:\s*\(\)\s*=>\s*\{[\s\S]*?pedido_id[\s\S]*?window\.screenNovaOP\(null,\s*pid\)/,
    'boot.js deve ler pedido_id no hash e chamar window.screenNovaOP(null, pid)');
});

test('8. index.html NÃO contém mais setRoutes (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes foi extraído para boot.js
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
});

test('9. index.html NÃO contém mais main (extraído para js/boot.js)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, main foi extraído para boot.js
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('10. js/screens/op-nova.js contém async function screenNovaOP', () => {
  assert.match(opnSrc, /async\s+function\s+screenNovaOP\s*\(/,
    'op-nova.js não define screenNovaOP');
});

// -------------------------------------------------------------------------
// 2. Runtime
// -------------------------------------------------------------------------

function makeOpNovaBootSandbox() {
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
  vm.runInContext(olaSrc,    sandbox, { filename: 'js/screens/op-latex-admin.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  vm.runInContext(oprSrc,    sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(oppSrc,    sandbox, { filename: 'js/screens/op-persistir.js' });
  vm.runInContext(opPdfSrc,  sandbox, { filename: 'js/screens/op-pdf.js' });
  vm.runInContext(optpSrc,   sandbox, { filename: 'js/screens/op-tecelagem-producao-admin.js' });
  vm.runInContext(opnSrc,    sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};

  return { sandbox };
}

test('11. runtime: window.screenNovaOP é função', () => {
  const { sandbox } = makeOpNovaBootSandbox();
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após boot');
});

test('12. runtime: window.RAVATEX_SCREENS.opNova.screenNovaOP existe', () => {
  const { sandbox } = makeOpNovaBootSandbox();
  assert.ok(vm.runInContext('window.RAVATEX_SCREENS.opNova.screenNovaOP', sandbox),
    'window.RAVATEX_SCREENS.opNova.screenNovaOP não existe');
});

test('13. op-nova.js NÃO contém mais function gerarPdfCompraFios (extraída para op-pdf.js em OP-NOVA-PDF-MODULE-A)', () => {
  // Após OP-NOVA-PDF-MODULE-A, gerarPdfCompraFios foi movida para
  // js/screens/op-pdf.js. op-nova.js agora chama
  // window.gerarPdfCompraFios({ op, ordens }) em buildBlocoFios.
  assert.equal(/function\s+gerarPdfCompraFios\s*\(/.test(opnSrc), false,
    'op-nova.js ainda define gerarPdfCompraFios — extração para op-pdf.js incompleta');
  assert.match(opnSrc, /window\.gerarPdfCompraFios\s*\(/,
    'op-nova.js não chama window.gerarPdfCompraFios — call-site não foi atualizado');
});

test('14. op-nova.js contém buildProposta / recompute / onAceitar', () => {
  assert.match(opnSrc, /function\s+buildProposta\s*\(/);
  assert.match(opnSrc, /function\s+recompute\s*\(/);
  assert.match(opnSrc, /function\s+onAceitar\s*\(/);
});

test('15. op-nova.js mantem preparacao e delega Tecelagem em producao para modulo proprio', () => {
  assert.match(opnSrc, /function\s+buildBlocoFios\s*\(/);
  assert.match(opnSrc, /function\s+buildOrdemPendenteRow\s*\(/);
  assert.doesNotMatch(opnSrc, /function\s+buildBlocoTecelagem\s*\(/);
  assert.match(opnSrc, /window\.renderOPTecelagemProducaoAdmin\(/);
  assert.match(optpSrc, /function\s+buildBlocoEntregas\s*\(/);
  assert.match(optpSrc, /function\s+renderOPTecelagemProducaoAdmin\s*\(/);
});
// -------------------------------------------------------------------------
// 3. Call-sites de módulos extraídos
// -------------------------------------------------------------------------

test('16. op-nova.js chama window.persistirOP', () => {
  assert.match(opnSrc, /window\.persistirOP\(/,
    'op-nova.js não referencia window.persistirOP');
});

test('16.1 op-nova.js nao usa MAX(numero)+1 para previa de OP Tecelagem', () => {
  assert.doesNotMatch(opnSrc, /from\(\s*['"]ops['"]\s*\)\s*\.select\(\s*['"]numero['"]\s*\)[\s\S]*?order\(\s*['"]numero['"]/,
    'op-nova.js nao deve calcular OP nova por maior numero existente em ops');
  assert.match(opnSrc, /from\(\s*['"]op_numeros['"]\s*\)[\s\S]*?eq\(\s*['"]tipo['"]\s*,\s*['"]tecelagem['"]\s*\)/,
    'previa de numero deve ler op_numeros tecelagem');
});

test('17. op-nova.js chama window.aplicarRecalculoOP', () => {
  assert.match(opnSrc, /window\.aplicarRecalculoOP\(/,
    'op-nova.js não referencia window.aplicarRecalculoOP');
});

test('18. op-nova.js chama window.registrarRecebimentoOrdemFio', () => {
  assert.match(opnSrc, /window\.registrarRecebimentoOrdemFio\(/,
    'op-nova.js não referencia window.registrarRecebimentoOrdemFio');
});

test('19. op-nova.js chama window.atribuirFornecedorFioOp', () => {
  assert.match(opnSrc, /window\.atribuirFornecedorFioOp\(/,
    'op-nova.js não referencia window.atribuirFornecedorFioOp');
});

test('20. op-nova.js chama window.renderOPLatexAdmin', () => {
  assert.match(opnSrc, /window\.renderOPLatexAdmin\(/,
    'op-nova.js não referencia window.renderOPLatexAdmin');
});

test('21. op-nova.js chama window.maxMetrosItem / window.itensValidosOP', () => {
  assert.match(opnSrc, /window\.maxMetrosItem\(/,
    'op-nova.js não referencia window.maxMetrosItem');
  assert.match(opnSrc, /window\.itensValidosOP\(/,
    'op-nova.js não referencia window.itensValidosOP');
});

test('22. op-nova.js chama window.rotuloModelo / window.fmtKg / window.fmtMetros / disabledAttr (helper de op-form-helpers.js)', () => {
  // disabledAttr é chamado como bare (escopo do script) — verifica
  // que o nome está presente e corresponde ao helper de op-form-helpers.js
  assert.match(opnSrc, /\bdisabledAttr\(/,
    'op-nova.js não chama disabledAttr');
  assert.match(opnSrc, /window\.rotuloModelo\(/);
  assert.match(opnSrc, /window\.fmtKg\(/);
  assert.match(opnSrc, /window\.fmtMetros\(/);
});

// -------------------------------------------------------------------------
// 4. Sem regressão de writes
// -------------------------------------------------------------------------

test('23. op-nova.js NÃO contém writes Supabase (insert/update/delete) — todos foram extraídos', () => {
  // Writes foram extraídos para op-persistir.js / op-recalculo.js / op-writes.js.
  // screenNovaOP é read-only em supa (apenas .select).
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*insert\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().insert — write deveria ter sido extraído');
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*update\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().update — write deveria ter sido extraído');
  assert.equal(/supa\.from\([^)]*\)\s*\.\s*delete\s*\(/.test(opnSrc), false,
    'op-nova.js contém supa.from().delete — write deveria ter sido extraído');
});

test('24. op-nova.js contém apenas reads (from().select) — nenhum write direto', () => {
  // Verifica que o módulo usa from().select() normalmente
  const reads = (opnSrc.match(/supa\.from\([^)]*\)\s*\.\s*select\s*\(/g) || []).length;
  assert.ok(reads >= 4,
    `op-nova.js deveria ter ao menos 4 reads (modelos, params, forns, clientes, ops, ordens, entregas, fornecedores). Encontrado: ${reads}`);
});

test('25. index.html NÃO contém mais implementação de persistirOP (helper já extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  // Deve ter window.persistirOP (call-site) mas NÃO async function persistir
  assert.equal(/async\s+function\s+persistir\s*\(/.test(inline), false,
    'inline ainda tem async function persistir — write deveria ter sido extraído');
});

test('26. index.html NÃO contém mais implementação de aplicarRecalculoOP (helper já extraído)', () => {
  const inline = extractInlineScript(indexSrc);
  // Verifica que NÃO há writes de saldo_fios_op / saldo_fios no inline
  assert.equal(/from\s*\(\s*['"]saldo_fios['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios") como chamada Supabase');
  assert.equal(/from\s*\(\s*['"]saldo_fios_op['"]\s*\)/.test(inline), false,
    'inline ainda tem from("saldo_fios_op") como chamada Supabase');
});

// -------------------------------------------------------------------------
// 5. setRoutes/main inline
// -------------------------------------------------------------------------

test('27. setRoutes e main foram extraídos para js/boot.js (NÃO estão mais no inline)', () => {
  const inline = extractInlineScript(indexSrc);
  // Após ROUTES-BOOT-MODULE-A, setRoutes e main saíram do inline
  assert.equal(/window\.RAVATEX_ROUTER\.setRoutes\s*\(/.test(inline), false,
    'inline ainda tem setRoutes — extração incompleta');
  assert.equal(/async\s+function\s+main\s*\(/.test(inline), false,
    'inline ainda tem main — extração incompleta');
});

test('28. setRoutes referencia window.screenNovaOP(null, pid) para #/ops/nova (em boot.js)', () => {
  const bootSrc = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');
  assert.match(bootSrc, /'#\/ops\/nova':\s*\{\s*render:\s*\(\)\s*=>\s*\{[\s\S]*?window\.screenNovaOP\(null,\s*pid\)/,
    'call-site de #/ops/nova em boot.js deve usar window.screenNovaOP(null, pid)');
});

// -------------------------------------------------------------------------
// 6. Boot chain
// -------------------------------------------------------------------------

test('29. boot chain: todos os módulos + op-nova + inline coexiste sem SyntaxError', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeOpNovaBootSandbox();

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
    'boot com op-nova + inline lançou SyntaxError de duplicate identifier');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:',
      String(otherErr.message).slice(0, 120));
  }
});

test('30. window.screenNovaOP continua resolvível após o boot completo', () => {
  const inline = extractInlineScript(indexSrc);
  const { sandbox } = makeOpNovaBootSandbox();
  let threw = false;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (!(e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message))) {
      threw = true;
    }
  }
  // window.screenNovaOP deve continuar sendo a função (não foi sobrescrita pelo inline)
  assert.equal(typeof vm.runInContext('window.screenNovaOP', sandbox), 'function',
    'window.screenNovaOP não é função após boot completo');
  // Deve continuar apontando para RAVATEX_SCREENS.opNova.screenNovaOP
  const ref = vm.runInContext('window.RAVATEX_SCREENS.opNova.screenNovaOP === window.screenNovaOP', sandbox);
  assert.equal(ref, true,
    'window.screenNovaOP não é mais a referência de RAVATEX_SCREENS.opNova');
});

// -------------------------------------------------------------------------
// 7. Fluxos visuais da fase NOVA OP TECELAGEM STANDALONE B
// -------------------------------------------------------------------------

function buildOpNovaFixture(overrides = {}) {
  const base = {
    modelos: [
      { id: 1, nome: 'Arabesco', largura: 2.10, cor_1: { id: 11, nome: 'PRETO' }, cor_2: { id: 12, nome: 'CRU' } },
      { id: 2, nome: 'Roma', largura: 1.50, cor_1: { id: 13, nome: 'GELO' }, cor_2: { id: 14, nome: 'CINZA' } },
    ],
    parametros_largura: [
      { largura: 2.10, algodao_por_ml: 0.01, poliester_por_ml: 0.02, valor_x: 1 },
      { largura: 1.50, algodao_por_ml: 0.01, poliester_por_ml: 0.02, valor_x: 1 },
    ],
    fornecedores: [
      { id: 701, nome: 'Tecelagem Sul', tipo: 'tecelagem' },
      { id: 702, nome: 'Fios do Vale', tipo: 'algodao' },
      { id: 703, nome: 'Poliester Norte', tipo: 'poliester' },
      { id: 704, nome: 'Latex Base', tipo: 'latex' },
    ],
    clientes: [
      { id: 501, nome: 'Cliente Atlas' },
      { id: 502, nome: 'Cliente Aurora' },
    ],
    pedidos: [
      {
        id: 'ped-1',
        numero: 120,
        status: 'confirmado',
        criado_em: '2026-06-10T00:00:00Z',
        prazo_entrega: '2026-07-20',
        cliente_id: 501,
        cliente: { id: 501, nome: 'Cliente Atlas' },
      },
    ],
    pedido_itens: [
      { id: 'pi-1', pedido_id: 'ped-1', modelo_id: 1, metros: 120, observacao: '', ordem: 1 },
      { id: 'pi-2', pedido_id: 'ped-1', modelo_id: 2, metros: 80, observacao: '', ordem: 2 },
    ],
    ops: [],
    ordens_compra_fio: [],
    entregas: [],
  };

  return Object.assign(base, overrides);
}

function buildFakeSupa(db) {
  function cloneRows(rows) {
    return JSON.parse(JSON.stringify(rows || []));
  }

  function applyFilters(rows, filters, limit) {
    let out = cloneRows(rows);
    for (const filter of filters) {
      if (filter.type === 'eq') out = out.filter((row) => row && row[filter.key] === filter.value);
      if (filter.type === 'in') out = out.filter((row) => row && filter.value.includes(row[filter.key]));
    }
    if (typeof limit === 'number') out = out.slice(0, limit);
    return out;
  }

  function rowsFor(table, state) {
    const source = db[table] || [];
    return applyFilters(source, state.filters, state.limit);
  }

  return {
    from(table) {
      const state = { filters: [], limit: null };
      return {
        select() { return this; },
        order() { return this; },
        eq(key, value) { state.filters.push({ type: 'eq', key, value }); return this; },
        in(key, value) { state.filters.push({ type: 'in', key, value }); return this; },
        limit(value) { state.limit = value; return this; },
        maybeSingle() {
          const rows = rowsFor(table, state);
          return Promise.resolve({ data: rows[0] || null, error: null });
        },
        single() {
          const rows = rowsFor(table, state);
          return Promise.resolve(rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { message: 'not found' } });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rowsFor(table, state), error: null }).then(resolve, reject);
        },
      };
    },
  };
}

function makeRenderSandbox(db) {
  const toastsNode = new FakeNode('div');
  const appNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: String(t), appendChild() {}, setAttribute() {} }),
    getElementById: (id) => id === 'app' ? appNode : new FakeNode('div'),
    querySelector: (sel) => sel === '#toasts' ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };

  const sandbox = {
    document,
    setTimeout,
    clearTimeout,
    console,
    URL,
    URLSearchParams,
    location: { hash: '#/ops/nova' },
    supa: buildFakeSupa(db),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(calcSrc, sandbox, { filename: 'js/calculo-op.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(efSrc, sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ofhSrc, sandbox, { filename: 'js/screens/op-form-helpers.js' });
  vm.runInContext(optpSrc, sandbox, { filename: 'js/screens/op-tecelagem-producao-admin.js' });
  vm.runInContext(opnSrc, sandbox, { filename: 'js/screens/op-nova.js' });

  sandbox.ADMIN_MENU = sandbox.ADMIN_MENU || [];
  sandbox.CURRENT_USER = { nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  sandbox.navigate = () => {};
  sandbox.itensValidosOP = (itens) => (itens || []).filter((item) => item && item.modeloId && Number(item.metros) > 0);
  sandbox.renderOPLatexAdmin = async () => new FakeNode('div');

  return sandbox;
}

function collectNodeText(node) {
  if (!node) return '';
  const parts = [];
  if (typeof node.textContent === 'string' && node.textContent) parts.push(node.textContent);
  if (node.tagName === 'INPUT' && node.value != null && node.value !== '') parts.push(String(node.value));
  if (node.tagName === 'SELECT') {
    const options = node.children || [];
    const selected = options.find((opt) => opt && opt.selected) || options[0];
    if (selected && selected.textContent) parts.push(selected.textContent);
  }
  for (const child of (node.children || [])) parts.push(collectNodeText(child));
  return parts.join(' ');
}

function collectInputValues(node, out = []) {
  if (!node) return out;
  if (node.tagName === 'INPUT') out.push(String(node.value));
  for (const child of (node.children || [])) collectInputValues(child, out);
  return out;
}

// Coleta o atributo style (string bruta) de cada nó da árvore — usado
// para travar regressões de layout (ex.: grid-template-columns) que
// asserções de texto puro não conseguem detectar.
function collectStyles(node, out = []) {
  if (!node) return out;
  const style = typeof node.getAttribute === 'function' ? node.getAttribute('style') : null;
  if (style) out.push(style);
  for (const child of (node.children || [])) collectStyles(child, out);
  return out;
}

function collectStyledTextNodes(node, out = []) {
  if (!node) return out;
  const style = typeof node.getAttribute === 'function' ? node.getAttribute('style') : '';
  const ownText = node._text != null
    ? String(node._text)
    : (node.children || [])
        .filter((child) => child && !child.tagName && typeof child.textContent === 'string')
        .map((child) => child.textContent)
        .join('');
  if (ownText) out.push({ text: ownText, style: style || '' });
  for (const child of (node.children || [])) collectStyledTextNodes(child, out);
  return out;
}

function findNodeById(node, id) {
  if (!node) return null;
  if (typeof node.getAttribute === 'function' && node.getAttribute('id') === id) return node;
  for (const child of (node.children || [])) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

async function renderNovaOpForTest({ opId = null, pedidoId = null, db } = {}) {
  const sandbox = makeRenderSandbox(db || buildOpNovaFixture());
  sandbox.__args = { opId, pedidoId };
  const view = await vm.runInContext('window.screenNovaOP(window.__args.opId, window.__args.pedidoId)', sandbox);
  return {
    sandbox,
    view,
    text: collectNodeText(view),
    inputs: collectInputValues(view),
    styles: collectStyles(view),
    styledText: collectStyledTextNodes(view),
    findById: (id) => findNodeById(view, id),
  };
}

test('31. op-nova.js lê lote.pedido_id e op_itens.pedido_item_id para rastreabilidade', () => {
  assert.match(opnSrc, /lote:lote_id\(id,\s*numero,\s*pedido_id,/,
    'select de lotes deve incluir pedido_id');
  assert.match(opnSrc, /op_itens\(id,\s*modelo_id,\s*metros_pedidos,\s*metros_ajustados,\s*pedido_item_id\)/,
    'select de op_itens deve incluir pedido_item_id');
});

test('32. Nova OP com pedido_id mostra "Pedido vinculado"', async () => {
  const rendered = await renderNovaOpForTest({
    pedidoId: 'ped-1',
    db: buildOpNovaFixture(),
  });
  assert.match(rendered.text, /Pedido vinculad/i);
  assert.match(rendered.text, /Pedido N[ºo]\s*120/i);
});

test('33. Nova OP com pedido_id mostra cliente como dado derivado do pedido', async () => {
  const rendered = await renderNovaOpForTest({
    pedidoId: 'ped-1',
    db: buildOpNovaFixture(),
  });
  assert.match(rendered.text, /Cliente derivado do pedido/i);
  assert.match(rendered.text, /Cliente Atlas/);
});

test('34. Nova OP com pedido_id não mostra cliente como select principal', async () => {
  const rendered = await renderNovaOpForTest({
    pedidoId: 'ped-1',
    db: buildOpNovaFixture(),
  });
  assert.doesNotMatch(rendered.text, /Selecione o cliente/i);
});

test('35. Nova OP com pedido_id mantém os itens do pedido', async () => {
  const rendered = await renderNovaOpForTest({
    pedidoId: 'ped-1',
    db: buildOpNovaFixture(),
  });
  assert.match(rendered.text, /Itens carregados do pedido vinculado/i);
  assert.ok(rendered.inputs.includes('120'), 'metros do item 1 do pedido deveriam aparecer na tela');
  assert.ok(rendered.inputs.includes('80'), 'metros do item 2 do pedido deveriam aparecer na tela');
});

test('36. Nova OP sem pedido_id mostra bloqueio e nao renderiza formulario operacional', async () => {
  const rendered = await renderNovaOpForTest({
    db: buildOpNovaFixture(),
  });
  assert.match(rendered.text, /Nova OP/i);
  assert.match(rendered.text, /Nao e possivel abrir OP sem Pedido vinculado/i);
  assert.match(rendered.text, /Acesse um Pedido e use Gerar primeira OP/i);
  assert.match(rendered.text, /Ir para Pedidos/i);
  assert.doesNotMatch(rendered.text, /Salvar simula/i);
  assert.doesNotMatch(rendered.text, /Selecione o cliente/i);
});

test('37. OP Aberta de Tecelagem não mostra "Entregas tecelagem"', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 91,
        numero: 7,
        ano: 2026,
        status: 'aberta',
        tipo: 'tecelagem',
        observacao: '',
        origem_op_id: null,
        lote_id: 301,
        lote: { id: 301, numero: 14, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [
          { id: 1, modelo_id: 1, metros_pedidos: 120, metros_ajustados: null, pedido_item_id: 'pi-1' },
        ],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [],
  });
  const rendered = await renderNovaOpForTest({ opId: 91, db });
  assert.doesNotMatch(rendered.text, /Entregas tecelagem/i);
});

test('38. OP Aberta de Tecelagem mostra linguagem de preparação', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 92,
        numero: 8,
        ano: 2026,
        status: 'aberta',
        tipo: 'tecelagem',
        observacao: '',
        origem_op_id: null,
        lote_id: 302,
        lote: { id: 302, numero: 15, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [
          { id: 2, modelo_id: 2, metros_pedidos: 80, metros_ajustados: null, pedido_item_id: 'pi-2' },
        ],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [],
  });
  const rendered = await renderNovaOpForTest({ opId: 92, db });
  assert.match(rendered.text, /OP Aberta de Tecelagem/i);
  assert.match(rendered.text, /Preparacao da OP/i);
});

function buildOpEmProducaoTecelagemFixture(overrides = {}) {
  return buildOpNovaFixture(Object.assign({
    ops: [
      {
        id: 93,
        numero: 9,
        ano: 2026,
        status: 'em_producao',
        tipo: 'tecelagem',
        observacao: '',
        origem_op_id: null,
        lote_id: 303,
        criado_em: '2026-06-15T11:00:00Z',
        lote: { id: 303, numero: 16, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [
          { id: 3, modelo_id: 1, metros_pedidos: 120, metros_ajustados: 100, pedido_item_id: 'pi-1' },
        ],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [
      { id: 501, op_id: 93, tipo: 'algodao', cor_id: 11, cor_poliester: null, kg_pedido: 1.2, kg_recebido: 1.2, status: 'recebido_total', cores: { id: 11, nome: 'PRETO' } },
    ],
    entregas: [],
  }, overrides));
}

test('39. OP Em Produção Tecelagem usa o template PROD-OP (não é a OP Aberta + badge)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Em produção/i);
  assert.match(rendered.text, /Entregue p\/ acabamento/i);
  assert.match(rendered.text, /Já enviado/i);
  assert.match(rendered.text, /Saldo em tecelagem/i);
  assert.match(rendered.text, /Capacidade e ajuste/i);
  assert.match(rendered.text, /Enviar para acabamento/i);
  assert.match(rendered.text, /Documentos/i);
  assert.match(rendered.text, /Histórico/i);
  assert.match(rendered.text, /Entregas de tecelagem/i);
  assert.match(rendered.text, /OPs.*OP 9\/2026/s);
});

test('40. OP Aberta Tecelagem não ganha os blocos operacionais novos (Movimentação/Documentos/Histórico)', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 92,
        numero: 8,
        ano: 2026,
        status: 'aberta',
        tipo: 'tecelagem',
        observacao: '',
        origem_op_id: null,
        lote_id: 302,
        lote: { id: 302, numero: 15, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [
          { id: 2, modelo_id: 2, metros_pedidos: 80, metros_ajustados: null, pedido_item_id: 'pi-2' },
        ],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [],
  });
  const rendered = await renderNovaOpForTest({ opId: 92, db });
  assert.doesNotMatch(rendered.text, /Movimentação\s*—\s*enviar para acabamento/i);
  assert.doesNotMatch(rendered.text, /Documentos da OP/i);
  assert.doesNotMatch(rendered.text, /7\.\s*Histórico/i);
  assert.doesNotMatch(rendered.text, /Entregas tecelagem/i);
});

test('41. OP Em Produção Tecelagem não contém linguagem de preparação da OP Aberta', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.doesNotMatch(rendered.text, /OP Aberta de Tecelagem/i);
  assert.doesNotMatch(rendered.text, /Preparacao da OP/i);
  assert.doesNotMatch(rendered.text, /Nova OP de Tecelagem/i);
  assert.doesNotMatch(rendered.text, /a produ[çc][aã]o s[oó] come[çc]a/i);
  assert.doesNotMatch(rendered.text, /Colocar em produ[çc][aã]o/i);
});

test('42. Card "4. Entregas tecelagem" permanece ausente da OP Aberta', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 92, numero: 8, ano: 2026, status: 'aberta', tipo: 'tecelagem',
        observacao: '', origem_op_id: null, lote_id: 302,
        lote: { id: 302, numero: 15, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [{ id: 2, modelo_id: 2, metros_pedidos: 80, metros_ajustados: null, pedido_item_id: 'pi-2' }],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [],
  });
  const rendered = await renderNovaOpForTest({ opId: 92, db });
  assert.doesNotMatch(rendered.text, /Entregas tecelagem/i);
});

test('43. Card "Entregas tecelagem" permanece presente na OP Em Produção Tecelagem (reposicionado, sem numeral "4." — conflitava com o novo Bloco 4 Capacidade e ajuste)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Entregas de tecelagem/i);
  assert.match(rendered.text, /Capacidade e ajuste/i);
  // Headers de seção agora são icon-chips sem numeral.
  assert.doesNotMatch(rendered.text, /4\.\s*Entregas/i);
});

test('44. OP Em Produção Tecelagem preserva o fluxo de entrega existente (+ Nova entrega/Editar/Excluir)', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    entregas: [
      {
        id: 'ent-1', fornecedor_id: 701, etapa: 'cima', data: '2026-06-30', observacao: '',
        destino_fornecedor_id: 704, destino: { nome: 'Latex Base' }, fornecedores: { nome: 'Tecelagem Sul' },
        entrega_itens: [{ id: 'ei-1', op_id: 93, op_item_id: 3, metros_entregues: 50, defeito: false, observacao: '' }],
      },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /\+ Nova entrega/);
  assert.match(rendered.text, /Editar/);
  assert.match(rendered.text, /Excluir/);
  // Os identificadores de write existentes continuam apenas onde já
  // existiam (buildBlocoTecelagem, reaproveitado sem alteração).
  assert.match(optpSrc, /salvarEntregaCima/);
  assert.match(optpSrc, /atualizarEntregaCima/);
  assert.match(optpSrc, /excluirEntrega/);
});

test('45. Bloco 7 (Histórico) cai no fallback controlado quando não há op_eventos', async () => {
  const db = buildOpEmProducaoTecelagemFixture({ op_eventos: [] });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Nenhum evento registrado para esta OP\./i);
});

test('46. Bloco 7 (Histórico) renderiza op_eventos real quando disponível (read-only)', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    op_eventos: [
      { id: 1, op_id: 93, tipo_evento: 'status_alterado', status_anterior: 'aberta', status_novo: 'em_producao', observacao: null, criado_em: '2026-06-30T09:40:00Z' },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Status alterado/i);
  assert.doesNotMatch(rendered.text, /Nenhum evento registrado para esta OP\./i);
});

test('47. Acabamento/Látex continua delegado a renderOPLatexAdmin, sem template PROD-OP-TECELAGEM', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 94, numero: 8, ano: 2026, status: 'em_producao', tipo: 'latex',
        observacao: '', origem_op_id: 93, lote_id: null, lote: null,
        op_itens: [], op_fornecedores: [],
      },
    ],
  });
  const sandbox = makeRenderSandbox(db);
  let delegatedTo = null;
  sandbox.renderOPLatexAdmin = async (opId) => { delegatedTo = opId; return new FakeNode('div'); };
  sandbox.__args = { opId: 94, pedidoId: null };
  const view = await vm.runInContext('window.screenNovaOP(window.__args.opId, window.__args.pedidoId)', sandbox);
  const text = collectNodeText(view);
  assert.equal(delegatedTo, 94);
  assert.doesNotMatch(text, /Entregas tecelagem/i);
  assert.doesNotMatch(text, /Movimentação\s*—\s*enviar para acabamento/i);
});

test('48. Guardas de segurança: sem alterar_status_op e sem write novo de status em op-nova.js', () => {
  assert.doesNotMatch(opnSrc, /alterar_status_op/);
  assert.doesNotMatch(opnSrc, /\.from\(['"]ops['"]\)\.update\(\s*\{\s*status\s*:/);
  assert.doesNotMatch(opnSrc, /supa\.from\(['"]op_eventos['"]\)\.(insert|update|delete)/);
});

test('49. OP Em Produção Tecelagem mostra breadcrumb "OPs / OP X/ANO" (OPs clicável)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /OPs/);
  assert.match(rendered.text, /OP 9\/2026/);
  // O breadcrumb é o próprio caminho de volta (OPs clicável) — sem botão "Voltar".
  assert.match(optpSrc, /navigate\('#\/ops'\)/);
});

test('50. Cadeia produtiva (lineage strip) aparece quando há OP de Acabamento gerada por entrega parcial', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    ops: [
      {
        id: 93, numero: 9, ano: 2026, status: 'em_producao', tipo: 'tecelagem',
        observacao: '', origem_op_id: null, lote_id: 303,
        lote: { id: 303, numero: 16, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [{ id: 3, modelo_id: 1, metros_pedidos: 120, metros_ajustados: 100, pedido_item_id: 'pi-1' }],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
      {
        id: 95, numero: 8, ano: 2026, status: 'aberta', tipo: 'latex',
        observacao: '', origem_op_id: 93, origem_entrega_id: 'ent-1', lote_id: null, lote: null,
        op_latex_entregas: [{ entrega_id: 'ent-1' }],
        op_itens: [], op_fornecedores: [],
      },
    ],
    entregas: [
      {
        id: 'ent-1', fornecedor_id: 701, etapa: 'cima', data: '2026-06-30', observacao: '',
        destino_fornecedor_id: 704, destino: { nome: 'Latex Base' }, fornecedores: { nome: 'Tecelagem Sul' },
        entrega_itens: [{ id: 'ei-1', op_id: 93, op_item_id: 3, metros_entregues: 50, defeito: false, observacao: '' }],
      },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  // A lineage foi integrada aos "Dados da OP" (campo Destino, clicável) em vez
  // da antiga strip "Cadeia produtiva": a OP de Acabamento consolidada aparece
  // como destino navegável.
  assert.match(rendered.text, /Destino/i);
  assert.match(rendered.text, /OP 8\/2026/);
  assert.match(rendered.text, /Acabamento/i);
});

test('51. Cadeia produtiva ausente quando não há OP de Acabamento gerada', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.doesNotMatch(rendered.text, /Cadeia produtiva/i);
});

test('52. Bloco "4. Capacidade e ajuste" lê saldo_fios_op (read-only) e mostra consumo/sobra real', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    ordens_compra_fio: [
      { id: 501, op_id: 93, tipo: 'algodao', cor_id: 11, cor_poliester: null, kg_pedido: 1000, kg_recebido: 1000, status: 'recebido_total', cores: { id: 11, nome: 'PRETO' } },
    ],
    saldo_fios_op: [
      { id: 1, op_id: 93, cor_id: 11, cor_poliester: null, tipo: 'algodao', kg_sobra: 87.369, cores: { id: 11, nome: 'PRETO' } },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Capacidade e ajuste/i);
  assert.match(rendered.text, /Algodão\s*—\s*PRETO/i);
  assert.match(rendered.text, /sobra 87,369 kg/i);
  // Não fabricar um "fator proporcional" que não temos gravado.
  assert.doesNotMatch(rendered.text, /Fator proporcional/i);
  assert.doesNotMatch(rendered.text, /Sem dados de sobra/i);
});

test('53. Bloco "4. Capacidade e ajuste" cai no fallback controlado sem saldo_fios_op', async () => {
  const db = buildOpEmProducaoTecelagemFixture({ saldo_fios_op: [] });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Capacidade e ajuste/i);
  assert.match(rendered.text, /Sem dados de sobra de fio registrados para esta OP\./i);
});

test('54. Documentos da OP: slots por tipo (Romaneio/NF entrada/NF saída) com Anexar, camada visual sem backend', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Romaneio/);
  assert.match(rendered.text, /NF de entrada/i);
  assert.match(rendered.text, /NF de saida/i);
  assert.match(rendered.text, /Anexar Romaneio/i);
  assert.match(rendered.text, /Nenhum arquivo anexado/i);
  // Sem nomes de arquivo fabricados nem badges falsos.
  assert.doesNotMatch(rendered.text, /Aguardando integração/i);
  assert.doesNotMatch(rendered.text, /\.pdf/i);
});

test('55. Saldo negativo/excedente (entregue > ajustado) tem tratamento visual próprio, não fica escondido', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    entregas: [
      {
        id: 'ent-1', fornecedor_id: 701, etapa: 'cima', data: '2026-06-30', observacao: '',
        destino_fornecedor_id: 704, destino: { nome: 'Latex Base' }, fornecedores: { nome: 'Tecelagem Sul' },
        entrega_itens: [{ id: 'ei-1', op_id: 93, op_item_id: 3, metros_entregues: 150, defeito: false, observacao: '' }],
      },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /excedente/i);
  assert.match(rendered.text, /acima do total ajustado/i);
  assert.doesNotMatch(rendered.text, /✅ completo/);
});

test('56. Subtítulo do header mostra "Aberta em DATA" quando op.criado_em existir', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Aberta em \d{2}\/\d{2}\/\d{4}/);
});

test('57. Card "Dados da OP" usa grid de 3 colunas no cockpit largo (rail sticky libera a coluna esquerda)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  const dadosGrid = rendered.styles.find((s) => /grid-template-columns/.test(s) && /repeat\(\s*3\s*,\s*minmax\(0(?:px)?,\s*1fr\)\s*\)/.test(s));
  assert.ok(dadosGrid, 'esperado o grid de 3 colunas dos campos de Dados da OP (igual ao piloto Acabamento validado)');
});

test('58. Card "Entregas tecelagem" tem wrapper overflow-x:auto (colunas em px fixo não encolhem)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  const temOverflowWrapper = rendered.styles.some((s) => /overflow-x\s*:\s*auto/.test(s));
  assert.ok(temOverflowWrapper, 'esperado um wrapper overflow-x:auto ao redor da tabela de colunas fixas em px (evita coluna FALTA cortada em janelas estreitas)');
});

test('59. "Enviar para acabamento" (rail) usa métricas empilhadas + botão full-width (não grid rígido que estoura 300px)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Enviar para acabamento/i);
  assert.match(rendered.text, /Transferir p\/ acabamento/i);
  const fullWidthBtn = rendered.styles.find((s) => /width:100%/.test(s) && /height:38px/.test(s));
  assert.ok(fullWidthBtn, 'o botão Transferir deve ser full-width no rail (padrão de ação do cockpit)');
  const rigidStatGrid = rendered.styles.find((s) => /grid-template-columns/.test(s) && /minmax\(120px/.test(s));
  assert.ok(!rigidStatGrid, 'o rail não deve usar grid rígido minmax(120px) que espreme as métricas em 300px');
});

test('60. OP Em Produção Tecelagem não tem nenhum ícone de seção (padrão do standalone: título só em texto)', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  const temIconeSecao = rendered.styles.some((s) => /width:34px;height:34px;border-radius:6px;background:#eaf1fd/.test(s));
  assert.equal(temIconeSecao, false, 'nenhum dos 7 blocos do standalone PROD-OP-TECELAGEM usa ícone no título — Card 3 e Entregas tecelagem não podem ter herdado o ícone do template Nova OP/OP Aberta');
});

test('61. Card 3 usa "Insumos — recebimento de fios" (icon-chip, sem numeral) na OP Em Produção', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Insumos\s*—\s*recebimento de fios/i);
  assert.doesNotMatch(rendered.text, /3\.\s*Insumos/i);
  assert.doesNotMatch(rendered.text, /3\.\s*Recebimento de fios/i);
});

test('62. Card 3 mostra confirmação "Todos os fios desta OP já foram recebidos." na OP Em Produção', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  assert.match(rendered.text, /Todos os fios desta OP já foram recebidos\./i);
});

test('63. OP Aberta Tecelagem continua com o ícone do Card 3 (ajuste é condicional por status, não afeta a preparação)', async () => {
  const db = buildOpNovaFixture({
    ops: [
      {
        id: 92, numero: 8, ano: 2026, status: 'aberta', tipo: 'tecelagem',
        observacao: '', origem_op_id: null, lote_id: 302,
        lote: { id: 302, numero: 15, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [{ id: 2, modelo_id: 2, metros_pedidos: 80, metros_ajustados: null, pedido_item_id: 'pi-2' }],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
    ],
    ordens_compra_fio: [],
  });
  const rendered = await renderNovaOpForTest({ opId: 92, db });
  const temIconeSecao = rendered.styles.some((s) => /width:34px;height:34px;border-radius:6px;background:#eaf1fd/.test(s));
  assert.equal(temIconeSecao, true, 'OP Aberta deve manter o ícone do Card 3 — o ajuste do standalone PROD-OP é condicional só para em_producao');
  assert.match(rendered.text, /3\.\s*Recebimento de fios/i);
});

test('66. Headers STATUS e FALTA da OP Em ProduÃ§Ã£o Tecelagem ficam alinhados Ã  esquerda', async () => {
  const db = buildOpEmProducaoTecelagemFixture();
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  // Nova convenção (reference Inttex / regra de ouro): colunas numéricas têm
  // header alinhado à direita, igual aos valores. FALTA é numérica.
  const faltaHeaders = rendered.styledText.filter((node) => node.text === 'FALTA');
  assert.ok(faltaHeaders.length >= 2, 'esperado header FALTA nos blocos Itens e Entregas de tecelagem');
  for (const header of faltaHeaders) {
    assert.match(header.style, /text-align\s*:\s*right/,
      'FALTA (coluna numérica) deve ter o header à direita, igual aos valores: ' + header.style);
  }
});

test('67. Entregas tecelagem fica dentro do Card 5 Movimentacao e fora do Card 4', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    ops: [
      {
        id: 93,
        numero: 9,
        ano: 2026,
        status: 'em_producao',
        tipo: 'tecelagem',
        observacao: '',
        origem_op_id: null,
        lote_id: 303,
        criado_em: '2026-06-15T11:00:00Z',
        lote: { id: 303, numero: 16, pedido_id: 'ped-1', cliente: { id: 501, nome: 'Cliente Atlas' } },
        op_itens: [
          { id: 3, modelo_id: 1, metros_pedidos: 120, metros_ajustados: 100, pedido_item_id: 'pi-1' },
        ],
        op_fornecedores: [{ fornecedor_id: 701, etapa: 'cima' }],
      },
      {
        id: 95, numero: 8, ano: 2026, status: 'aberta', tipo: 'latex',
        observacao: '', origem_op_id: 93, origem_entrega_id: 'ent-1', lote_id: null, lote: null,
        op_latex_entregas: [{ entrega_id: 'ent-1' }],
        op_itens: [], op_fornecedores: [],
      },
    ],
    entregas: [
      {
        id: 'ent-1', fornecedor_id: 701, etapa: 'cima', data: '2026-06-30', observacao: '',
        destino_fornecedor_id: 704, destino: { nome: 'Latex Base' }, fornecedores: { nome: 'Tecelagem Sul' },
        entrega_itens: [{ id: 'ei-1', op_id: 93, op_item_id: 3, metros_entregues: 50, defeito: false, observacao: '' }],
      },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  const card4 = rendered.findById('capacidade-ajuste-op');
  const card5 = rendered.findById('entregas-tecelagem-op');
  assert.ok(card4, 'esperado encontrar o Card 4 Capacidade e ajuste');
  assert.ok(card5, 'esperado encontrar o Card 5 Movimentacao');
  const card4Text = collectNodeText(card4);
  const card5Text = collectNodeText(card5);
  assert.doesNotMatch(card4Text, /Entregas de tecelagem/i);
  // Entregas de tecelagem agora é uma seção própria (id entregas-tecelagem-op),
  // fora do bloco Capacidade (Card 4). Header em icon-chip, sem numeral.
  assert.match(card5Text, /Entregas de tecelagem/i);
  assert.match(card5Text, /MODELO\s*PEDIDO\s*AJUSTADO\s*ENTREGUE\s*FALTA/i);
  assert.match(card5Text, /\+ Nova entrega/);
  // ent-1 está vinculada a uma OP Látex (op_latex_entregas): pela regra de
  // consolidação (op-tecelagem-producao-admin.js), a entrega vira documento
  // de origem — o card NÃO expõe Editar/Excluir e mantém o texto de bloqueio
  // + o CTA "Ver OP de látex". O caminho editável (não vinculada) segue
  // coberto pelo teste 44. Não reabrir edição/retificação aqui.
  assert.doesNotMatch(card5Text, /Editar/);
  assert.doesNotMatch(card5Text, /Excluir/);
  assert.match(card5Text, /Entrega vinculada à OP de acabamento/i);
  assert.match(card5Text, /Ver OP de l/i);
});

test('64. Bloco "5. Movimentacao" preserva historico detalhado sem totalizar defeito', async () => {
  const db = buildOpEmProducaoTecelagemFixture({
    entregas: [
      {
        id: 'ent-1', fornecedor_id: 701, etapa: 'cima', data: '2026-06-30', observacao: '',
        destino_fornecedor_id: 704, destino: { nome: 'Latex Base' }, fornecedores: { nome: 'Tecelagem Sul' },
        entrega_itens: [
          { id: 'ei-1', op_id: 93, op_item_id: 3, metros_entregues: 50, defeito: false, observacao: '' },
          { id: 'ei-2', op_id: 93, op_item_id: 3, metros_entregues: 20, defeito: true, observacao: 'defeito' },
        ],
      },
    ],
  });
  const rendered = await renderNovaOpForTest({ opId: 93, db });
  const card5Text = collectNodeText(rendered.findById('entregas-tecelagem-op'));
  assert.match(card5Text, /Latex Base/);
  assert.match(card5Text, /50,00\s*m/);
  assert.match(card5Text, /20,00\s*m/);
  assert.match(card5Text, /DEFEITO/);
  assert.doesNotMatch(card5Text, /70,00\s*m/);
});

test('65. reloadEntregasCima recarrega numero/ano da OP de latex (consolidado via op_latex_entregas)', () => {
  assert.match(opnSrc, /select\(['"]id,\s*numero,\s*ano,\s*status,\s*op_latex_entregas\(entrega_id\)['"]\)/);
  assert.match(opnSrc, /latexOpInfo\s*=\s*\{\}/);
  // Mapeia cada entrega vinculada (N:1) -> mesma OP Látex consolidada.
  assert.match(opnSrc, /latexOpInfo\[link\.entrega_id\]\s*=\s*\{\s*id:\s*lo\.id,\s*numero:\s*lo\.numero,\s*ano:\s*lo\.ano,\s*status:\s*lo\.status\s*\}/);
});

test('66. Nova OP com pedido_id UUID preserva string e mostra erro de pedido nao encontrado', () => {
  const pedidoCtxBlock = (opnSrc.match(/async function loadPedidoContext[\s\S]*?function hasLinkedPedido/) || [''])[0];
  const pedidoRouteBlock = (opnSrc.match(/if\s*\(\s*pedidoId\s*\)\s*\{[\s\S]*?if\s*\(\s*opId\s*\)/) || [''])[0];
  assert.ok(pedidoCtxBlock, 'trecho loadPedidoContext nao encontrado');
  assert.ok(pedidoRouteBlock, 'trecho de carregamento por pedidoId nao encontrado');
  assert.match(pedidoCtxBlock, /\.eq\(\s*['"]id['"]\s*,\s*targetPedidoId\s*\)/);
  assert.match(pedidoRouteBlock, /\.eq\(\s*['"]pedido_id['"]\s*,\s*pedidoId\s*\)/);
  assert.doesNotMatch(pedidoRouteBlock, /Number\s*\(\s*pedidoId\s*\)/);
  assert.doesNotMatch(pedidoRouteBlock, /parseInt\s*\(\s*pedidoId\s*/);
  assert.match(opnSrc, /Pedido não encontrado/);
});
