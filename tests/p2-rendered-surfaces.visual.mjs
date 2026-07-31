// tests/p2-rendered-surfaces.visual.mjs
//
// P2-C — prova RENDERIZADA das doze superfícies da fase, nos dois viewports
// declarados (1440x900 desktop e 390x844 móvel), com dados MOCKADOS
// determinísticos e identificadores sintéticos.
//
// LIMITE DE EVIDÊNCIA, dito abertamente: este arquivo mede a ÁRVORE
// RENDERIZADA e a geometria declarada — largura mínima exigida, dono de
// rolagem local, alcance do foco, semântica de alerta, contenção de ação e
// composição do modal. Ele NÃO é um navegador: não há layout composto, então
// nenhuma afirmação aqui é sobre pixels pintados. O que ele prova é o que a
// árvore declara; o que ele não prova está registrado no relatório da fase.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const VIEWPORTS = [
  { nome: 'desktop', w: 1440, h: 900 },
  { nome: 'mobile', w: 390, h: 844 },
];

class N {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = []; this._text = null; this._listeners = {};
    this.style = {}; this.disabled = false; this.value = ''; this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; if (k === 'style') this.style.cssText = v; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { this._listeners[t] = fn; }
  removeEventListener(t) { delete this._listeners[t]; }
  replaceChildren(...ns) {
    this.children = [];
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, children: [], appendChild() {}, setAttribute() {} } : n);
    }
  }
  focus() { this._focused = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}
const flat = (n, a = []) => { if (!n) return a; a.push(n); (n.children || []).forEach((c) => flat(c, a)); return a; };
const txt = (n) => flat(n).map((x) => (x && x.textContent) || '').join(' ');
const css = (n) => (n && n.style && n.style.cssText) || (n && n.getAttribute && n.getAttribute('style')) || '';

// Largura mínima DECLARADA de um nó (min-width em px). É o único eixo de
// overflow que uma árvore sem layout pode medir honestamente.
function minWidthPx(n) {
  const m = /min-width:\s*(\d+)px/.exec(css(n));
  return m ? Number(m[1]) : 0;
}
// Um nó é dono de rolagem local quando declara overflow-x:auto ou carrega o
// marcador canônico de rolagem de tabela.
function ehDonoDeRolagem(n) {
  return /overflow-x:\s*auto/.test(css(n))
    || (n.getAttribute && n.getAttribute('data-rv-table-scroll') != null);
}

// Nenhum nó pode exigir mais largura do que o viewport SEM estar dentro de um
// dono de rolagem local. É a definição operável de "sem overflow de documento".
function provarSemOverflowDeDocumento(root, viewport, rotulo) {
  const caminho = [];
  (function anda(n, ancestraisComRolagem) {
    if (!n) return;
    const rolagem = ancestraisComRolagem || ehDonoDeRolagem(n);
    const mw = minWidthPx(n);
    if (mw > viewport.w && !rolagem) {
      caminho.push(rotulo + ' :: nó exige ' + mw + 'px em ' + viewport.w + 'px sem dono de rolagem');
    }
    (n.children || []).forEach((c) => anda(c, rolagem));
  })(root, false);
  assert.deepEqual(caminho, [], rotulo + ' @' + viewport.nome + ': overflow de documento');
}

// Toda ação primária tem de estar presente e alcançável (não escondida atrás
// de um nó com display:none) e nenhuma pode ficar sem rótulo.
function provarAcoesAlcancaveis(root, rotulo) {
  const botoes = flat(root).filter((n) => n.tagName === 'BUTTON');
  for (const b of botoes) {
    assert.doesNotMatch(css(b), /display:\s*none/, rotulo + ': ação escondida');
    const rotulado = (txt(b) || '').trim().length > 0 || b.getAttribute('aria-label');
    assert.ok(rotulado, rotulo + ': ação sem rótulo acessível');
  }
  return botoes;
}

// Um alerta local pertence à superfície que o levantou e é anunciado.
function provarSemanticaDeAlerta(root, rotulo) {
  const alertas = flat(root).filter((n) => n.getAttribute && n.getAttribute('role') === 'alert');
  for (const a of alertas) {
    assert.ok(['assertive', 'polite'].includes(a.getAttribute('aria-live')),
      rotulo + ': alerta sem aria-live');
  }
  return alertas;
}

function sandboxBase() {
  const s = {
    console, setTimeout, clearTimeout, Promise, Object, Array, Number, String,
    Math, JSON, Error, Boolean, Set, Date,
  };
  s.window = s; s.globalThis = s;
  s.document = {
    createElement: (t) => new N(t),
    createTextNode: (t) => ({ textContent: t, children: [] }),
    querySelector: () => new N('div'), querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, body: new N('body'),
  };
  s.el = function (tag, attrs) {
    const n = new N(tag); const rest = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'onclick') n._listeners.click = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    rest.flat().forEach((c) => {
      if (c == null || c === false || c === '') return;
      n.appendChild(typeof c === 'string' ? { textContent: c, children: [], appendChild() {}, setAttribute() {} } : c);
    });
    return n;
  };
  s.rangeInput = (o) => { const n = new N('input'); Object.assign(n, o || {}); n.max = o.max; n.value = o.value; return n; };
  s.textInput = (o) => { const n = new N('input'); n.value = (o && o.value) || ''; return n; };
  s.selectInput = (o) => { const n = new N('select'); n.value = (o && o.value) || ''; return n; };
  s.textArea = () => new N('textarea');
  s.formField = (o) => { const w = new N('div'); w.appendChild(o.input); return w; };
  s.toast = () => {}; s.navigate = () => {};
  s.shellLayout = (m, node) => node; s.ADMIN_MENU = [];
  s.badgeStatus = (v) => { const n = new N('span'); n.textContent = String(v); return n; };
  s.fmtMetros = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' m';
  s.fmtKg = (v) => Number(v || 0).toFixed(3).replace('.', ',') + ' kg';
  s.rotuloModelo = (m) => (m && m.nome) || 'Modelo';
  s.larguraKey = (l) => Number(l).toFixed(2);
  s.calcularFiosOP = () => ({ algodaoPorCor: { 10: { corId: 10, kg: 1 } }, poliester: { PRETO: 1, BRANCO: 1 } });
  s.maxMetrosItem = () => 1000;
  s.RAVATEX_OP_DISPLAY = {
    formatOpOperationalCode: (op) => (op && op.identidade_operacional) || 'OP-A005-1-26',
    formatOpIdentityFromMap: (id) => 'OP-A' + id,
    getCanonicalIdentity: (o) => (o && o.identidade_operacional) || null,
  };
  return s;
}

const MODELOS = { 1: { id: 1, nome: 'Barcelona', largura: 2.10, cor_1: { id: 10, nome: 'PRETO' }, cor_2: { id: 10, nome: 'PRETO' } } };
const PARAMS = { '2.10': { algodao_por_ml: 0.1, poliester_por_ml: 0.05, valor_x: 1 } };
const DISP = [
  { material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 5000 },
  { material: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_disponivel: 5000 },
  { material: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_disponivel: 5000 },
];
const OP_ITENS = [{ id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 }];

function ownerSandbox(rpc) {
  const s = sandboxBase();
  s.supa = { from: () => new Proxy({}, { get: () => () => ({}) }), rpc: (fn, p) => Promise.resolve(rpc ? rpc(fn, p) : { data: { ok: true }, error: null }) };
  vm.createContext(s);
  vm.runInContext(read('js/screens/op-recalculo.js'), s, { filename: 'op-recalculo.js' });
  vm.runInContext(read('js/screens/op-distribuicao-ui.js'), s, { filename: 'op-distribuicao-ui.js' });
  return s;
}

// =====================================================================
// As doze superfícies, medidas nos dois viewports.
// =====================================================================

for (const vp of VIEWPORTS) {
  test(`[${vp.nome} ${vp.w}x${vp.h}] 1+3+4+5. bloco de ajuste compartilhado: conflito, Limpar ajuste e elegibilidade de início`, () => {
    // (3) Estado de conflito de revisão.
    const sConf = ownerSandbox(() => ({ data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA' }, error: null }));
    const blocoConf = sConf.buildDistribuicaoBlock({
      op: { id: 29, status: 'aberta', ajuste_revisao: 7 }, opItens: OP_ITENS,
      disponibilidade: DISP, modelosById: MODELOS, parametrosByLargura: PARAMS,
      variant: 'full', onRecarregar: async () => true,
    });
    provarSemOverflowDeDocumento(blocoConf, vp, 'bloco de ajuste');
    provarAcoesAlcancaveis(blocoConf, 'bloco de ajuste');
    // (4) A ação de limpar existe e é alcançável.
    const limpar = flat(blocoConf).find((n) => n.tagName === 'BUTTON' && /Limpar ajuste/.test(txt(n)));
    assert.ok(limpar, 'Limpar ajuste presente @' + vp.nome);
    // Um slider por item, com o teto declarado.
    const sliders = flat(blocoConf).filter((n) => n.tagName === 'INPUT' && n.max != null);
    assert.equal(sliders.length, OP_ITENS.length, 'um slider por item @' + vp.nome);

    // (5) OP simulada versus aberta.
    const sInit = ownerSandbox();
    const aberta = sInit.buildIniciarProducaoButton({
      op: { id: 29, status: 'aberta', ajuste_revisao: 7 }, opItens: OP_ITENS,
      disponibilidade: DISP, modelosById: MODELOS, parametrosByLargura: PARAMS,
      styleEnabled: 'x', styleDisabled: 'y',
    });
    const simulada = sInit.buildIniciarProducaoButton({
      op: { id: 30, status: 'simulada', ajuste_revisao: 0 }, opItens: OP_ITENS,
      disponibilidade: DISP, modelosById: MODELOS, parametrosByLargura: PARAMS,
      styleEnabled: 'x', styleDisabled: 'y',
    });
    assert.equal(aberta.disabled, false, 'OP aberta habilita @' + vp.nome);
    assert.equal(simulada.disabled, true, 'OP simulada NÃO abre em silêncio @' + vp.nome);
    assert.match(simulada.getAttribute('title') || '', /simulada/i);
  });

  test(`[${vp.nome} ${vp.w}x${vp.h}] 3b. conflito de revisão renderiza alerta e trava o salvamento`, async () => {
    const s = ownerSandbox(() => ({ data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA' }, error: null }));
    const bloco = s.buildDistribuicaoBlock({
      op: { id: 29, status: 'aberta', ajuste_revisao: 7 }, opItens: OP_ITENS,
      disponibilidade: DISP, modelosById: MODELOS, parametrosByLargura: PARAMS,
      variant: 'full', onRecarregar: async () => true,
    });
    const manter = flat(bloco).find((n) => n.tagName === 'BUTTON' && /Manter pedido/.test(txt(n)));
    await manter._listeners.click();
    const alertas = provarSemanticaDeAlerta(bloco, 'conflito');
    assert.ok(alertas.length >= 1, 'o conflito é anunciado @' + vp.nome);
    assert.match(txt(bloco), /Recarregar dados/);
    assert.equal(flat(bloco).find((n) => n.tagName === 'BUTTON' && /Salvar distribui/.test(txt(n))).disabled, true);
    provarSemOverflowDeDocumento(bloco, vp, 'conflito');
  });

  test(`[${vp.nome} ${vp.w}x${vp.h}] 6. fila do fornecedor com aceitar/rejeitar`, () => {
    const s = sandboxBase();
    s.supa = { from: () => new Proxy({}, { get: () => () => ({}) }), rpc: () => Promise.resolve({ data: { ok: true }, error: null }) };
    s.CURRENT_USER = { nome: 'F', tipo: 'fornecedor', fornecedor_id: 1 };
    s.dataTable = () => new N('div'); s.pageHeader = () => new N('h1');
    vm.createContext(s);
    vm.runInContext(read('js/screens/fornecedor.js'), s, { filename: 'fornecedor.js' });
    const secao = s.RAVATEX_SCREENS.fornecedor.buildFilaAceiteSection(
      { linhas: [{ ordem_compra_id: 4242, identidade_operacional: 'OC-SINT-9-99', kg_total: 1234.5, itens: 4, emitida_em: '2026-07-30T00:00:00Z' }], error: null },
      null);
    const botoes = provarAcoesAlcancaveis(secao, 'fila de aceite');
    assert.ok(botoes.some((b) => /Aceitar/.test(txt(b))));
    assert.ok(botoes.some((b) => /Rejeitar/.test(txt(b))));
    provarSemanticaDeAlerta(secao, 'fila de aceite');
    provarSemOverflowDeDocumento(secao, vp, 'fila de aceite');
    assert.match(txt(secao), /ainda NÃO está aceita/, 'emissão não é aceite @' + vp.nome);
  });

  test(`[${vp.nome} ${vp.w}x${vp.h}] 8. entrega salva com acabamento falho expõe recuperação`, () => {
    const s = sandboxBase();
    s.supa = { from: () => new Proxy({}, { get: () => () => ({}) }), rpc: () => Promise.resolve({ data: { ok: true }, error: null }) };
    vm.createContext(s);
    vm.runInContext(read('js/screens/entrega-writes.js'), s, { filename: 'entrega-writes.js' });
    vm.runInContext(read('js/screens/entrega-form.js'), s, { filename: 'entrega-form.js' });
    const bloco = s.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
    assert.ok(bloco, 'a recuperação aparece após falha provada @' + vp.nome);
    assert.match(txt(bloco), /OP de acabamento não foi criada/);
    provarAcoesAlcancaveis(bloco, 'recuperação');
    provarSemanticaDeAlerta(bloco, 'recuperação');
    provarSemOverflowDeDocumento(bloco, vp, 'recuperação');
    // (9) Sem falha provada, a superfície não existe.
    assert.equal(s.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: false }), null);
  });

  test(`[${vp.nome} ${vp.w}x${vp.h}] 10+11. estorno e correção Tapete: tetos visíveis e controles distintos`, async () => {
    const s = sandboxBase();
    const ITENS = [{ id: 801, modelo_id: 1, metros_liberados: 100, metros_entregues: 40, modelo: MODELOS[1] }];
    function dataFor(t) {
      if (t === 'expedicoes') return { data: { id: 700, pedido_id: 'ped-1', op_latex_id: 44, status: 'parcial', pedido: { id: 'ped-1', numero: 12 }, op: { id: 44 }, lote: { numero: 5 }, cliente: { nome: 'C' } }, error: null };
      if (t === 'expedicao_itens') return { data: ITENS, error: null };
      if (t === 'lotes') return { data: [{ id: 5 }], error: null };
      return { data: [], error: null };
    }
    s.supa = {
      from(t) { const c = { select: () => c, eq: () => c, in: () => c, order: () => c, maybeSingle: () => Promise.resolve(dataFor(t)), single: () => Promise.resolve(dataFor(t)), then: (r, j) => Promise.resolve(dataFor(t)).then(r, j) }; return c; },
      rpc: () => Promise.resolve({ data: { ok: true }, error: null }),
    };
    s.RAVATEX_PRODUCT_ROUTE = { resolveExpedicaoSource: (e) => ({ opId: e.op_latex_id, column: 'op_latex_id', route: 'tapete', label: 'Acabamento (Tapete)' }) };
    vm.createContext(s);
    vm.runInContext(read('js/screens/expedicao-admin.js'), s, { filename: 'expedicao-admin.js' });
    const root = await s.screenExpedicaoAdmin(700);
    const estorno = flat(root).find((n) => n.getAttribute && n.getAttribute('data-rv-comando-tapete') === 'estorno');
    const correcao = flat(root).find((n) => n.getAttribute && n.getAttribute('data-rv-comando-tapete') === 'correcao');
    assert.ok(estorno && correcao && estorno !== correcao, 'dois controles distintos @' + vp.nome);
    assert.match(txt(estorno), /Liberado: 100,00 m/);
    assert.match(txt(estorno), /Estorno maximo: 60,00 m/);
    assert.match(txt(correcao), /Valido: 0 ate 100,00 m/);
    assert.match(txt(correcao), /NAO e um estorno/);
    provarAcoesAlcancaveis(estorno, 'estorno');
    provarAcoesAlcancaveis(correcao, 'correção');
    provarSemanticaDeAlerta(root, 'expedição Tapete');
    provarSemOverflowDeDocumento(root, vp, 'expedição Tapete');
  });

  test(`[${vp.nome} ${vp.w}x${vp.h}] 2. painel consolidado com várias OPs`, async () => {
    const s = sandboxBase();
    const OPS = [
      { id: 29, identidade_operacional: 'OP-A005-1-26', status: 'aberta', ajuste_revisao: 3, tipo: 'tecelagem', lote_id: 5, op_itens: OP_ITENS },
      { id: 31, identidade_operacional: 'OP-A006-1-26', status: 'aberta', ajuste_revisao: 1, tipo: 'tecelagem', lote_id: 5, op_itens: OP_ITENS },
    ];
    function dataFor(t) {
      if (t === 'pedidos') return { data: { id: 'ped-1', numero: 12, status: 'confirmado', revisao: 4, cliente: { nome: 'C' } }, error: null };
      if (t === 'lotes') return { data: [{ id: 5 }], error: null };
      if (t === 'ops') return { data: OPS, error: null };
      if (t === 'modelos') return { data: [MODELOS[1]], error: null };
      if (t === 'parametros_largura') return { data: [{ largura: 2.10, algodao_por_ml: 0.1, poliester_por_ml: 0.05, valor_x: 1 }], error: null };
      return { data: [], error: null };
    }
    s.supa = {
      from(t) { const c = { select: () => c, eq: () => c, in: () => c, order: () => c, maybeSingle: () => Promise.resolve(dataFor(t)), single: () => Promise.resolve(dataFor(t)), then: (r, j) => Promise.resolve(dataFor(t)).then(r, j) }; return c; },
      rpc: (fn) => Promise.resolve(fn === 'oc_disponibilidade_op' ? { data: DISP, error: null } : { data: { ok: true }, error: null }),
    };
    vm.createContext(s);
    vm.runInContext(read('js/screens/op-recalculo.js'), s, { filename: 'op-recalculo.js' });
    vm.runInContext(read('js/screens/op-distribuicao-ui.js'), s, { filename: 'op-distribuicao-ui.js' });
    vm.runInContext(read('js/screens/pedido-producao-panel.js'), s, { filename: 'pedido-producao-panel.js' });
    const root = await s.screenPedidoProducaoPanel('ped-1');
    const cards = flat(root).filter((n) => n.getAttribute && n.getAttribute('data-rv-op-producao') != null);
    assert.equal(cards.length, 2, 'uma superfície por OP @' + vp.nome);
    assert.match(txt(root), /OP-A005-1-26/);
    assert.match(txt(root), /OP-A006-1-26/);
    // O slider compartilhado é o MESMO nos dois cartões.
    const sliders = flat(root).filter((n) => n.tagName === 'INPUT' && n.max != null);
    assert.equal(sliders.length, 2, 'um slider por OP, do dono compartilhado @' + vp.nome);
    provarAcoesAlcancaveis(root, 'painel');
    provarSemanticaDeAlerta(root, 'painel');
    provarSemOverflowDeDocumento(root, vp, 'painel');
    // É página, não modal.
    assert.ok(flat(root).every((n) => !(n.getAttribute && n.getAttribute('role') === 'dialog')));
  });
}

// =====================================================================
// Provas que não dependem de viewport
// =====================================================================

test('7+12. entrega Tapete com sucesso e cancelamento de Pedido: nenhuma entidade completa em modal de transição', () => {
  const pde = read('js/screens/pedido-detail-events.js');
  // O modal de cancelamento carrega motivo + ação; ele NÃO edita o Pedido.
  const bloco = (pde.match(/async function cancelarPedido[\s\S]*?\n    \}/) || [''])[0];
  assert.ok(bloco);
  assert.match(bloco, /saveLabel: 'Cancelar pedido'/);
  assert.doesNotMatch(bloco, /buildEntregaInlineForm|buildDistribuicaoBlock|dataTable/,
    'um modal de transição não hospeda entidade completa');
  // A continuação pós-recebimento também carrega só a ação.
  const rec = read('js/screens/ordem-compra-receipt-events.js');
  const cont = (rec.match(/function abrirContinuacaoProducao[\s\S]*?\n    \}/) || [''])[0];
  assert.ok(cont);
  assert.match(cont, /saveLabel: 'Revisar produção'/);
  assert.doesNotMatch(cont, /rangeInput|buildDistribuicaoBlock/,
    'o slider completo nunca aparece no modal de recebimento');
});

test('9. rota Manta permanece sem acabamento', () => {
  const mw = read('js/screens/manta-writes.js');
  assert.match(mw, /registrar_entrega_cima_manta/);
  assert.doesNotMatch(mw, /gerar_op_acabamento|gerar_op_latex|registrar_entrega_cima_com_acabamento/);
});

test('foco visível e tokens compartilhados: nenhuma família de token nova foi criada', () => {
  const novos = read('js/screens/pedido-producao-panel.js');
  const tokens = Array.from(novos.matchAll(/var\(--([a-z0-9-]+)\)/g)).map((m) => m[1]);
  const tokensCss = read('css/tokens.css');
  const desconhecidos = Array.from(new Set(tokens)).filter((t) => tokensCss.indexOf('--' + t) === -1);
  assert.deepEqual(desconhecidos, [], 'todo token usado já existe em css/tokens.css');
  // Nenhum outline:none — o anel de foco canônico não é removido.
  assert.doesNotMatch(novos, /outline:\s*none/);
});

test('nenhum dado de produção e nenhum endpoint hospedado', () => {
  const meu = read('tests/p2-rendered-surfaces.visual.mjs');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(meu, /OC-001-[34]-26/, 'nenhuma das duas Ordens de Compra reais é fixture');
});
