// =====================================================================
// === tests/manta-route-ui.smoke.js ===================================
// PHASE-MANTA-B2B — contrato de teste da rota Manta na UI e nos read
// models (MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md sec.11).
//
// Prova, no minimo:
//   1. a identidade de rota vem de `modelos.tipo_produto`;
//   2. a Manta omite Acabamento;
//   3. o Tapete mantem Acabamento;
//   4. um Pedido misto emite duas secoes de rota independentes;
//   5. a saida Manta nao expoe seletor de acabamento;
//   6. a saida Manta chama `registrar_entrega_cima_manta`;
//   7. o Tapete continua no seu escritor e na geracao de OP de latex;
//   8. a origem da expedicao aceita op_latex_id E op_tecelagem_id;
//   9. "Ver OP" aponta para a origem correta;
//  10. a Manta exibe medido, liberado, entregue e saldo;
//  11. liberacao parcial e adicional usam a RPC Manta;
//  12. o estorno exige motivo e segue as regras de visibilidade;
//  13. nenhuma entidade completa vive dentro de um modal de acao;
//  14. o progresso do cliente usa a forma de etapas por rota.
//
// Estatico + runtime em sandbox `vm`, sem app e sem Supabase.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const NEW_MODULES = [
  'js/product-route.js',
  'js/screens/pedido-route-sections.js',
  'js/screens/pedido-route-sections-ui.js',
  'js/screens/manta-writes.js',
  'js/screens/manta-output-form.js',
  'js/screens/manta-movimento-form.js',
  'js/screens/manta-expedicao-ui.js',
  'js/screens/cliente-route-read.js',
];

const TOUCHED = NEW_MODULES.concat([
  'js/pedido-tracking-ui.js',
  'js/screens/pedido-chain-state.js',
  'js/screens/pedido-detail-data.js',
  'js/screens/pedido-detail-progress.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/expedicao-admin.js',
  'js/screens/op-tecelagem-producao-admin.js',
  'js/screens/cliente-pedido-detail.js',
  'js/screens/cliente-pedido-tracking.js',
]);

const productRoute = read('js/product-route.js');
const routeSections = read('js/screens/pedido-route-sections.js');
const routeSectionsUi = read('js/screens/pedido-route-sections-ui.js');
const mantaWrites = read('js/screens/manta-writes.js');
const mantaOutputForm = read('js/screens/manta-output-form.js');
const mantaMovimentoForm = read('js/screens/manta-movimento-form.js');
const mantaExpedicaoUi = read('js/screens/manta-expedicao-ui.js');
const clienteRouteRead = read('js/screens/cliente-route-read.js');
const chainState = read('js/screens/pedido-chain-state.js');
const opDisplay = read('js/op-display.js');
const trackingUi = read('js/pedido-tracking-ui.js');
const expedicaoAdmin = read('js/screens/expedicao-admin.js');
const opTecelagem = read('js/screens/op-tecelagem-producao-admin.js');
const entregaWrites = read('js/screens/entrega-writes.js');
const detailEvents = read('js/screens/pedido-detail-events.js');
const detailProgress = read('js/screens/pedido-detail-progress.js');
const detailRender = read('js/screens/pedido-detail-render.js');
const clienteTracking = read('js/screens/cliente-pedido-tracking.js');
const indexHtml = read('index.html');

// ---------------------------------------------------------------------
// Sandbox DOM minimo (mesmo padrao dos smokes de tela existentes).
// ---------------------------------------------------------------------
function makeNode(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(),
    attrs: {}, children: [], _listeners: {}, style: { cssText: '' },
    textContent: '', disabled: false, className: '', value: '', checked: false,
    appendChild(c) { this.children.push(c); return c; },
    append() { for (const c of arguments) this.appendChild(c); },
    replaceChildren() { this.children = []; for (const c of arguments) this.appendChild(c); },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'disabled') this.disabled = true; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(ev, fn) { this._listeners[ev] = fn; },
    removeEventListener() {}, remove() {}, focus() {},
    scrollIntoView() {},
  };
}

function makeSandbox(sources) {
  const events = [];
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.document = {
    createElement: (t) => makeNode(t),
    createTextNode: (t) => ({ textContent: String(t), nodeType: 3, children: [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    body: makeNode('body'), addEventListener() {}, removeEventListener() {},
  };
  vm.createContext(sandbox);
  sandbox.window.el = function el(tag, attrs) {
    const n = makeNode(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (k.startsWith('on') && typeof v === 'function') n._listeners[k.slice(2)] = v;
      else if (k === 'class') n.className = String(v);
      else n.setAttribute(k, v);
    });
    Array.prototype.slice.call(arguments, 2).flat(4).forEach((c) => {
      if (c == null || c === '' || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') {
        n.appendChild(sandbox.document.createTextNode(c));
        return;
      }
      n.appendChild(c);
    });
    return n;
  };
  sandbox.window.textInput = (opts) => {
    const n = makeNode('input');
    n.value = (opts && opts.value) || '';
    if (opts && opts.type) n.setAttribute('type', opts.type);
    return n;
  };
  sandbox.window.selectInput = (opts) => {
    const n = makeNode('select');
    n.value = (opts && opts.value) || '';
    n._options = (opts && opts.options) || [];
    return n;
  };
  sandbox.window.formField = ({ label, input }) => sandbox.window.el('div', {}, label, input);
  sandbox.window.fmtMetros = (v) => String(Number(v || 0).toFixed(2)) + ' m';
  sandbox.window.larguraKey = (v) => String(v);
  sandbox.window.toast = (m, t) => events.push('toast:' + t + ':' + m);
  sandbox.window.navigate = (h) => events.push('navigate:' + h);
  sandbox.window.modal = (o) => { events.push('modal:' + (o && o.title)); sandbox.lastModal = o; };
  sandbox.window.crypto = { randomUUID: () => 'fixed-uuid-for-test' };
  sandbox.events = events;
  vm.runInContext(sources.join('\n\n'), sandbox);
  return sandbox;
}

function collectText(node, acc) {
  const out = acc || [];
  if (!node) return out;
  if (node.nodeType === 3) { out.push(String(node.textContent)); return out; }
  (node.children || []).forEach((c) => collectText(c, out));
  return out;
}

function textOf(node) { return collectText(node).join(' '); }

// Objetos criados dentro do sandbox `vm` tem prototipos de outro realm;
// normaliza antes de comparar estrutura.
function plain(value) { return JSON.parse(JSON.stringify(value)); }
// Codigo sem comentarios, para asserçoes estruturais que nao devem ser
// satisfeitas (nem quebradas) por texto de documentacao.
function codeOnly(src) {
  return String(src).replace(/^[ 	]*\/\/.*$/gm, '');
}

function findButtons(node, acc) {
  const out = acc || [];
  if (!node || node.nodeType === 3) return out;
  if (node.tagName === 'BUTTON') out.push(node);
  (node.children || []).forEach((c) => findButtons(c, out));
  return out;
}

// ---------------------------------------------------------------------
// 0. Integridade de carga
// ---------------------------------------------------------------------

test('todos os modulos tocados passam em node --check', () => {
  for (const rel of TOUCHED) {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
  }
});

test('index.html carrega cada novo modulo exatamente uma vez e com cache-busting', () => {
  for (const rel of NEW_MODULES) {
    const hits = indexHtml.match(new RegExp(rel.replace(/[/.]/g, '\\$&') + '\\?v=[^"]+', 'g')) || [];
    assert.equal(hits.length, 1, rel + ' deve ser carregado exatamente uma vez com ?v=');
  }
});

test('nenhum modulo novo/tocado toca db/**', () => {
  for (const rel of TOUCHED) {
    assert.doesNotMatch(read(rel), /\bdb\/\d{2}_/, rel + ' nao deve referenciar arquivos de migracao');
  }
});

// ---------------------------------------------------------------------
// 1. Identidade de rota vem de modelos.tipo_produto
// ---------------------------------------------------------------------

function routeApi() {
  return makeSandbox([opDisplay, productRoute]).window.RAVATEX_PRODUCT_ROUTE;
}

test('1. a rota e derivada de modelos.tipo_produto, por op_itens', () => {
  const api = routeApi();
  const modelosById = { 7: { tipo_produto: 'manta' }, 9: { tipo_produto: 'tapete' } };
  assert.equal(api.routeForOp({ op_itens: [{ modelo_id: 7 }] }, modelosById), 'manta');
  assert.equal(api.routeForOp({ op_itens: [{ modelo_id: 9 }] }, modelosById), 'tapete');
  // Ausencia de metadado resolve para Tapete (default de backfill), nunca
  // para uma rota inventada.
  assert.equal(api.routeForOp({ op_itens: [{ modelo_id: 99 }] }, modelosById), 'tapete');
  assert.equal(api.routeForOp({ op_itens: [] }, modelosById), null);
});

test('1b. a rota NUNCA e inferida de ops.tipo, do nome do modelo nem da largura', () => {
  const api = routeApi();
  // Uma OP `tipo: latex` cujo modelo e manta continua Manta; uma OP
  // `tipo: tecelagem` cujo modelo e tapete continua Tapete: ops.tipo e a
  // ETAPA, nunca a rota.
  const modelosById = { 7: { tipo_produto: 'manta', nome: 'Barcelona', largura: 2.10 }, 9: { tipo_produto: 'tapete', nome: 'Manta Luxo', largura: 1.40 } };
  assert.equal(api.routeForOp({ tipo: 'latex', op_itens: [{ modelo_id: 7 }] }, modelosById), 'manta');
  assert.equal(api.routeForOp({ tipo: 'tecelagem', op_itens: [{ modelo_id: 9 }] }, modelosById), 'tapete');

  // Nenhum modulo de rota/Manta infere a rota por nome ou por largura.
  for (const rel of NEW_MODULES) {
    const src = read(rel);
    assert.doesNotMatch(src, /nome[^\n]*\.(includes|indexOf|match)\([^)]*manta/i, rel);
    assert.doesNotMatch(src, /largura\s*===?\s*1\.40/, rel);
    assert.doesNotMatch(src, /op\.tipo\s*===?\s*['"](manta|tapete)['"]/, rel);
  }
});

test('1c. a superficie do cliente deriva a rota do mesmo dono, por pedido_itens', () => {
  const api = routeApi();
  const modelosById = { 1: { tipo_produto: 'manta' }, 2: { tipo_produto: 'tapete' } };
  assert.deepEqual(plain(api.routesForPedidoItens([{ modelo_id: 1 }], modelosById)), ['manta']);
  assert.deepEqual(plain(api.routesForPedidoItens([{ modelo_id: 1 }, { modelo_id: 2 }], modelosById)), ['tapete', 'manta']);
  assert.match(clienteRouteRead, /tipo_produto/);
  assert.match(clienteRouteRead, /routesForPedidoItens/);
});

// ---------------------------------------------------------------------
// 2/3/4. Forma das secoes por rota
// ---------------------------------------------------------------------

function buildSections(routes, extra) {
  const sandbox = makeSandbox([opDisplay, productRoute, routeSections]);
  const api = sandbox.window.RAVATEX_SCREENS.pedidoRouteSections;
  return api.buildRouteSections(Object.assign({
    routes: routes,
    opSummaries: [],
    expedicoes: [],
    expedicaoItens: [],
    insumoOrdens: [],
    totalPedido: 100,
    deliveredExactTotal: 0,
    chainState: null,
    fmt: { metros: (v) => String(v), kg: (v) => String(v) },
  }, extra || {}));
}

test('2. a secao Manta omite Acabamento', () => {
  const built = buildSections(['manta']);
  assert.equal(built.sections.length, 1);
  const keys = built.sections[0].stepper.map((s) => s.key);
  assert.equal(keys.join(','), 'insumos,tecelagem,expedicao,entrega');
  assert.equal(keys.indexOf('acabamento'), -1, 'Manta nunca emite a etapa acabamento');
  const labels = built.sections[0].stepper.map((s) => s.label).join(' ');
  assert.doesNotMatch(labels, /ACABAMENTO/);
});

test('3. a secao Tapete mantem Acabamento', () => {
  const built = buildSections(['tapete']);
  const keys = built.sections[0].stepper.map((s) => s.key);
  assert.equal(keys.join(','), 'insumos,tecelagem,acabamento,expedicao,entrega');
});

test('4. um Pedido misto emite duas secoes de rota independentes', () => {
  const built = buildSections(['tapete', 'manta'], {
    opSummaries: [
      { id: 1, route: 'tapete', stageKey: 'tecelagem', status: 'concluida', target: 60, done: 60, remaining: 0, op: { id: 1 } },
      { id: 2, route: 'tapete', stageKey: 'acabamento', status: 'em_producao', target: 60, done: 10, remaining: 50, op: { id: 2 } },
      { id: 3, route: 'manta', stageKey: 'tecelagem', status: 'em_producao', target: 40, done: 40, remaining: 0, op: { id: 3 } },
    ],
    expedicoes: [{ id: 4201, op_tecelagem_id: 3 }],
    expedicaoItens: [{ expedicao_id: 4201, metros_liberados: 40, metros_entregues: 40 }],
  });
  assert.equal(built.sections.length, 2, 'duas rotas => duas secoes');
  const tapete = built.sections.find((s) => s.route === 'tapete');
  const manta = built.sections.find((s) => s.route === 'manta');
  assert.ok(tapete && manta);

  // Secoes independentes: a Manta ja entregou tudo, o Tapete continua em
  // acabamento. Uma nao pode concluir nem bloquear a outra.
  assert.equal(manta.stepper.map((s) => s.key).indexOf('acabamento'), -1,
    'a secao Manta do misto nao pode conter Acabamento');
  assert.equal(tapete.stepper.map((s) => s.key).indexOf('acabamento'), 2,
    'a secao Tapete do misto mantem Acabamento');
  assert.equal(manta.metrics.expedicaoEntregue, 40, 'a expedicao Manta pertence a rota Manta');
  assert.equal(tapete.metrics.expedicaoEntregue, 0, 'a expedicao Manta nao pode ser contada no Tapete');
  assert.equal(tapete.stepper.find((s) => s.key === 'entrega').state, 'future',
    'a rota Tapete nao pode ser marcada concluida porque a Manta concluiu');
});

test('4b. a expedicao e atribuida a rota pela ORIGEM real, nunca por op_latex_id presumido', () => {
  const built = buildSections(['tapete', 'manta'], {
    opSummaries: [
      { id: 2, route: 'tapete', stageKey: 'acabamento', status: 'concluida', target: 50, done: 50, remaining: 0, op: { id: 2 } },
      { id: 3, route: 'manta', stageKey: 'tecelagem', status: 'concluida', target: 50, done: 50, remaining: 0, op: { id: 3 } },
    ],
    expedicoes: [{ id: 'eT', op_latex_id: 2 }, { id: 'eM', op_tecelagem_id: 3 }],
    expedicaoItens: [
      { expedicao_id: 'eT', metros_liberados: 50, metros_entregues: 5 },
      { expedicao_id: 'eM', metros_liberados: 50, metros_entregues: 50 },
    ],
  });
  const tapete = built.sections.find((s) => s.route === 'tapete');
  const manta = built.sections.find((s) => s.route === 'manta');
  assert.equal(tapete.metrics.expedicaoEntregue, 5);
  assert.equal(manta.metrics.expedicaoEntregue, 50);
});

test('4c. um stepper fixo de 5 estagios nao sobrevive em pedido-detail-progress.js', () => {
  assert.doesNotMatch(detailProgress, /var stepper = \[/,
    'o array fixo de 5 estagios foi substituido por secoes por rota');
  assert.match(detailProgress, /routeSections/);
  assert.match(detailRender, /routeSections/);
});

test('4d. a grade de render acompanha o numero real de etapas da rota', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, routeSectionsUi]);
  const ui = sandbox.window.RAVATEX_SCREENS.pedidoRouteSectionsUi;
  const ctx = {
    buildStageNode: (stage) => sandbox.window.el('div', {}, stage.label),
    buildTransferButton: () => sandbox.window.el('div', {}, 'seta'),
  };
  const manta = ui.buildSectionGrid({ route: 'manta', stepper: [{ key: 'insumos', label: 'INSUMOS' }, { key: 'tecelagem', label: 'TECELAGEM' }, { key: 'expedicao', label: 'EXPEDICAO' }, { key: 'entrega', label: 'ENTREGA' }] }, ctx);
  assert.equal(manta.getAttribute('style').includes('1fr 104px 1fr 104px 1fr 104px 1fr'), true,
    'Manta: 4 etapas e 3 conectores');
  const tapete = ui.buildSectionGrid({ route: 'tapete', stepper: ['insumos', 'tecelagem', 'acabamento', 'expedicao', 'entrega'].map((k) => ({ key: k, label: k.toUpperCase() })) }, ctx);
  assert.equal(tapete.getAttribute('style').includes('1fr 104px 1fr 104px 1fr 104px 1fr 104px 1fr'), true,
    'Tapete: 5 etapas e 4 conectores');
});

// ---------------------------------------------------------------------
// 5/6/7. Saida medida da Manta x escritor Tapete
// ---------------------------------------------------------------------

test('5. o formulario de saida Manta nao expoe seletor de destino de acabamento', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, mantaOutputForm]);
  const form = sandbox.window.buildMantaOutputForm({
    opItens: [{ id: 10, modelo_id: 7 }],
    modelosById: { 7: { nome: 'Arabesco', largura: 1.4, tipo_produto: 'manta' } },
  });
  const text = textOf(form.node);
  // Nenhum CONTROLE de destino: sem rotulo de destino, sem empresa de
  // latex a escolher e sem nenhum <select> no formulario.
  assert.doesNotMatch(text, /Destino \(l[aá]tex\)/i, 'nao pode existir campo de destino');
  assert.doesNotMatch(text, /selecione a empresa/i, 'nao pode oferecer empresa de latex');
  assert.equal(codeOnly(mantaOutputForm).includes('selectInput'), false,
    'o form Manta nao monta select algum');
  const selects = [];
  (function walk(n) {
    if (!n || n.nodeType === 3) return;
    if (n.tagName === 'SELECT') selects.push(n);
    (n.children || []).forEach(walk);
  })(form.node);
  assert.equal(selects.length, 0, 'o form Manta nao pode conter nenhum seletor');
  assert.match(text, /Metros medidos/);
  assert.match(text, /Defeito/);

  const payload = form.getPayload();
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'destino_fornecedor_id'), false,
    'o payload Manta nunca carrega destino_fornecedor_id');
});

test('6. a saida medida Manta chama registrar_entrega_cima_manta com op_item_id, metros e defeito', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, mantaWrites, mantaOutputForm, mantaMovimentoForm]);
  const calls = [];
  sandbox.window.supa = { rpc: async (name, params) => { calls.push({ name, params }); return { data: { ok: true } }; } };
  const form = sandbox.window.RAVATEX_SCREENS.mantaMovimentoForm.buildMantaMovimentoForm({
    op: { id: 33, op_itens: [{ id: 10, modelo_id: 7 }, { id: 11, modelo_id: 7 }] },
    modelosById: { 7: { nome: 'Arabesco', largura: 1.4, tipo_produto: 'manta' } },
    fornecedorId: 5,
  });
  // Preenche o primeiro item com defeito e o segundo sem.
  const inputs = [];
  (function walk(n) {
    if (!n || n.nodeType === 3) return;
    if (n.tagName === 'INPUT') inputs.push(n);
    (n.children || []).forEach(walk);
  })(form.node);
  const numeric = inputs.filter((i) => i.getAttribute('type') === 'number');
  const checkboxes = inputs.filter((i) => i.getAttribute('type') === 'checkbox');
  numeric[0].value = '12.5';
  numeric[1].value = '7';
  checkboxes[0].checked = true;

  return form.onSave().then((ok) => {
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'registrar_entrega_cima_manta');
    assert.equal(calls[0].params.p_op_id, 33);
    assert.equal(calls[0].params.p_fornecedor_id, 5);
    assert.deepEqual(plain(calls[0].params.p_itens), [
      { op_item_id: 10, metros_entregues: 12.5, defeito: true },
      { op_item_id: 11, metros_entregues: 7, defeito: false },
    ]);
    // Nunca o escritor Tapete e nunca a geracao de OP de latex.
    assert.equal(calls.some((c) => /gerar_op/.test(c.name)), false);
  });
});

test('6b. o erro atomico do backend chega intacto e nao vira sucesso', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, mantaWrites]);
  sandbox.window.supa = {
    rpc: async () => ({ data: { ok: false, codigo: 'op_nao_manta', erro: 'OP de tecelagem nao e homogenea de Manta' } }),
  };
  return sandbox.window.RAVATEX_MANTA_WRITES.registrarSaidaMantaCima({
    opId: 1, fornecedorId: 2, itens: [{ op_item_id: 10, metros_entregues: 5 }],
  }).then((res) => {
    assert.equal(res.ok, false);
    assert.equal(res.codigo, 'op_nao_manta');
    assert.match(res.erro, /homogenea de Manta/);
  });
});

test('6c. a submissao dupla nao gera uma segunda saida medida', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, mantaWrites, mantaOutputForm, mantaMovimentoForm]);
  let calls = 0;
  let resolveRpc;
  sandbox.window.supa = {
    rpc: () => new Promise((resolve) => { calls += 1; resolveRpc = () => resolve({ data: { ok: true } }); }),
  };
  const form = sandbox.window.RAVATEX_SCREENS.mantaMovimentoForm.buildMantaMovimentoForm({
    op: { id: 33, op_itens: [{ id: 10, modelo_id: 7 }] },
    modelosById: { 7: { nome: 'A', largura: 1.4 } },
    fornecedorId: 5,
  });
  (function walk(n) {
    if (!n || n.nodeType === 3) return;
    if (n.tagName === 'INPUT' && n.getAttribute('type') === 'number') n.value = '5';
    (n.children || []).forEach(walk);
  })(form.node);

  const first = form.onSave();
  return form.onSave().then((second) => {
    assert.equal(second, false, 'a segunda submissao concorrente e recusada');
    assert.equal(calls, 1, 'apenas uma chamada de escrita foi emitida');
    resolveRpc();
    return first;
  }).then((firstResult) => {
    assert.equal(firstResult, true);
  });
});

test('7. o Tapete continua no seu escritor e na geracao de OP de latex (sem alteracao)', () => {
  assert.match(entregaWrites, /async function salvarEntregaCima/);
  assert.match(entregaWrites, /if \(!payload\.destino_fornecedor_id\)/,
    'o Tapete continua exigindo a empresa de latex de destino');
  assert.match(entregaWrites, /forceSplit \? 'gerar_op_latex_split' : 'gerar_op_latex'/);
  // O caminho Tapete do modal do Pedido continua chamando salvarEntregaCima.
  assert.match(detailEvents, /window\.salvarEntregaCima\(/);
  assert.match(detailEvents, /key === 'Tecelagem>Acabamento'\) return buildTecelagemTransferForm/);
  // E a transicao da rota Manta usa o caminho Manta.
  assert.match(detailEvents, /key === 'Tecelagem>Expedicao'\) return buildMantaSaidaForm/);
});

test('7b. a tela da OP de tecelagem separa os dois caminhos por rota', () => {
  assert.match(opTecelagem, /function opEhManta/);
  assert.match(opTecelagem, /deriveProductType/);
  // Tapete: bloco de entregas + rail de acabamento apenas quando NAO e Manta.
  assert.match(opTecelagem, /if \(ctx\.cimaFornecedorId && !isManta\) railKids\.push\(buildEnviarAcabamento/);
  // Manta: bloco de saida medida + rail de expedicao.
  assert.match(opTecelagem, /buildBlocoSaidaManta/);
  assert.match(opTecelagem, /buildEnviarExpedicaoManta/);
  assert.doesNotMatch(opTecelagem, /buildBlocoSaidaManta[\s\S]{0,4000}?salvarEntregaCima/,
    'o bloco Manta nunca chama o escritor Tapete');
});

// ---------------------------------------------------------------------
// 8/9. Origem da expedicao e navegacao "Ver OP"
// ---------------------------------------------------------------------

test('8. a origem da expedicao aceita op_latex_id E op_tecelagem_id', () => {
  const api = routeApi();
  const tapete = api.resolveExpedicaoSource({ op_latex_id: 42, op_tecelagem_id: null });
  assert.equal(tapete.opId, 42);
  assert.equal(tapete.column, 'op_latex_id');
  assert.equal(tapete.route, 'tapete');
  assert.match(tapete.label, /Acabamento \(Tapete\)/);

  const manta = api.resolveExpedicaoSource({ op_latex_id: null, op_tecelagem_id: 77 });
  assert.equal(manta.opId, 77);
  assert.equal(manta.column, 'op_tecelagem_id');
  assert.equal(manta.route, 'manta');
  assert.match(manta.label, /Tecelagem \(Manta\)/);

  const nenhuma = api.resolveExpedicaoSource({});
  assert.equal(nenhuma.opId, null);
});

test('9. "Ver OP" aponta para a origem realmente nao nula (nunca #/ops/null)', () => {
  // A tela le as DUAS colunas e navega pela origem resolvida.
  assert.match(expedicaoAdmin, /op_tecelagem_id/);
  assert.match(expedicaoAdmin, /op_tecelagem:op_tecelagem_id\(/);
  assert.match(expedicaoAdmin, /function sourceOf/);
  assert.match(expedicaoAdmin, /navigate\('#\/ops\/' \+ src\.opId\)/);
  assert.doesNotMatch(expedicaoAdmin, /navigate\('#\/ops\/' \+ exp\.op_latex_id\)/,
    'nenhuma navegacao pode continuar hard-coded em op_latex_id');
  assert.match(expedicaoAdmin, /Origem: /, 'a origem deve ser declarada explicitamente');
});

// ---------------------------------------------------------------------
// 10/11/12/13. Saldos e acoes da expedicao Manta
// ---------------------------------------------------------------------

const SALDO = {
  ok: true,
  expedicao_id: 4201,
  previsto_total: 100, recebido_total: 80, liberado_total: 50, entregue_total: 20, disponivel_total: 30,
  itens: [
    { op_item_id: 10, modelo_id: 7, previsto: 100, recebido: 80, liberado: 50, entregue: 20, disponivel: 30 },
  ],
};

function mantaPanel(saldo) {
  const sandbox = makeSandbox([opDisplay, productRoute, mantaWrites, mantaExpedicaoUi]);
  const ui = sandbox.window.RAVATEX_SCREENS.mantaExpedicaoUi;
  const node = ui.buildMantaExpedicaoPanel({
    saldo: saldo,
    opTecelagemId: 77,
    expedicaoId: 4201,
    modeloById: { 7: { nome: 'Arabesco', largura: 1.4, tipo_produto: 'manta' } },
    reload: async () => {},
  });
  return { sandbox, node };
}

test('10. a expedicao Manta exibe previsto, medido, liberado, entregue e saldo', () => {
  const { node } = mantaPanel(SALDO);
  const text = textOf(node);
  for (const label of ['PREVISTO', 'MEDIDO', 'LIBERADO', 'ENTREGUE', 'SALDO']) {
    assert.match(text, new RegExp(label), 'falta o agregado ' + label);
  }
  assert.match(text, /80\.00 m/, 'o medido deve aparecer');
  assert.match(text, /50\.00 m/, 'o liberado deve aparecer');
  assert.match(text, /20\.00 m/, 'o entregue deve aparecer');
  assert.match(text, /30\.00 m/, 'o saldo disponivel deve aparecer');
  assert.match(text, /previsto e o planejamento da OP e nunca autoriza|previsto é o planejamento/i,
    'o previsto deve ser declarado informativo');
});

test('10b. o saldo/elegibilidade vem da RPC e a formula do backend nao e reproduzida em JS', () => {
  assert.match(mantaWrites, /consultar_saldo_expedicao_manta/);
  assert.match(expedicaoAdmin, /consultarSaldoExpedicaoManta/);
  // O painel nunca recalcula disponivel a partir do previsto/planejado.
  assert.doesNotMatch(mantaExpedicaoUi, /previsto\s*[-]\s*/, 'o previsto nunca entra num calculo de saldo');
  assert.match(mantaExpedicaoUi, /item\.disponivel/, 'o disponivel vem do payload da RPC');
});

test('11. liberacao parcial e adicional usam a RPC Manta, com chave de idempotencia estavel', () => {
  const { sandbox, node } = mantaPanel(SALDO);
  const calls = [];
  sandbox.window.supa = { rpc: async (name, params) => { calls.push({ name, params }); return { data: { ok: true, liberado_total: 30 } }; } };
  const btn = findButtons(node).find((b) => /Liberar adicional/.test(textOf(b)));
  assert.ok(btn, 'com liberado > 0 o rotulo deve ser "Liberar adicional"');
  btn._listeners.click({});
  assert.ok(sandbox.lastModal, 'a acao abre um modal');
  return sandbox.lastModal.onSave().then((ok) => {
    assert.equal(ok, true);
    assert.equal(calls[0].name, 'liberar_expedicao_manta_parcial');
    assert.equal(calls[0].params.p_op_tecelagem_id, 77);
    assert.deepEqual(plain(calls[0].params.p_itens), [{ op_item_id: 10, metros: 30 }]);
    assert.ok(calls[0].params.p_idempotency_key, 'a tentativa carrega chave de idempotencia');
    // Retentativa da MESMA tentativa reusa a mesma chave.
    return sandbox.lastModal.onSave().then(() => {
      assert.equal(calls[1].params.p_idempotency_key, calls[0].params.p_idempotency_key);
    });
  });
});

test('11b. a primeira liberacao usa o rotulo de liberacao inicial e nada e liberado sem saldo', () => {
  const primeira = mantaPanel(Object.assign({}, SALDO, { liberado_total: 0, itens: [Object.assign({}, SALDO.itens[0], { liberado: 0, entregue: 0, disponivel: 80 })] }));
  assert.ok(findButtons(primeira.node).some((b) => /Liberar para expedi/.test(textOf(b))));

  const semSaldo = mantaPanel(Object.assign({}, SALDO, { disponivel_total: 0, itens: [Object.assign({}, SALDO.itens[0], { disponivel: 0 })] }));
  const btn = findButtons(semSaldo.node).find((b) => /Liberar para expedi/.test(textOf(b)));
  assert.ok(btn && btn.disabled, 'sem saldo disponivel a liberacao fica desabilitada');
});

test('12. o estorno exige motivo trimado e respeita o teto liberado-entregue', () => {
  const { sandbox, node } = mantaPanel(SALDO);
  const calls = [];
  sandbox.window.supa = { rpc: async (name, params) => { calls.push({ name, params }); return { data: { ok: true, estornado_total: 30 } }; } };
  const btn = findButtons(node).find((b) => /Estornar/.test(textOf(b)));
  assert.ok(btn, 'com liberado > entregue o estorno deve estar visivel');
  btn._listeners.click({});
  const modal = sandbox.lastModal;
  assert.equal(modal.danger, true);
  assert.match(textOf(modal.body), /Motivo do estorno \(obrigat/);

  // Sem motivo: recusa antes de qualquer escrita.
  return modal.onSave().then((semMotivo) => {
    assert.equal(semMotivo, false);
    assert.equal(calls.length, 0, 'nenhuma escrita sem motivo');
    assert.ok(sandbox.events.some((e) => /toast:error:Informe o motivo/.test(e)));

    // Motivo apenas com espacos tambem e recusado (trim).
    const inputs = [];
    (function walk(n) {
      if (!n || n.nodeType === 3) return;
      if (n.tagName === 'INPUT') inputs.push(n);
      (n.children || []).forEach(walk);
    })(modal.body);
    const motivo = inputs[inputs.length - 1];
    motivo.value = '   ';
    return modal.onSave();
  }).then((soEspacos) => {
    assert.equal(soEspacos, false);
    assert.equal(calls.length, 0);
    return null;
  });
});

test('12b. o estorno com motivo usa estornar_expedicao_manta_parcial e limita ao teto do item', () => {
  const { sandbox, node } = mantaPanel(SALDO);
  const calls = [];
  sandbox.window.supa = { rpc: async (name, params) => { calls.push({ name, params }); return { data: { ok: true, estornado_total: 30 } }; } };
  findButtons(node).find((b) => /Estornar/.test(textOf(b)))._listeners.click({});
  const modal = sandbox.lastModal;
  const inputs = [];
  (function walk(n) {
    if (!n || n.nodeType === 3) return;
    if (n.tagName === 'INPUT') inputs.push(n);
    (n.children || []).forEach(walk);
  })(modal.body);
  const quantidade = inputs[0];
  const motivo = inputs[inputs.length - 1];
  motivo.value = '  lancado na OP errada  ';

  // Acima do teto (liberado 50 - entregue 20 = 30): recusado sem escrita.
  quantidade.value = '31';
  return modal.onSave().then((acima) => {
    assert.equal(acima, false);
    assert.equal(calls.length, 0);
    quantidade.value = '30';
    return modal.onSave();
  }).then((ok) => {
    assert.equal(ok, true);
    assert.equal(calls[0].name, 'estornar_expedicao_manta_parcial');
    assert.equal(calls[0].params.p_expedicao_id, 4201);
    assert.equal(calls[0].params.p_motivo, 'lancado na OP errada', 'o motivo e trimado');
    assert.deepEqual(plain(calls[0].params.p_itens), [{ op_item_id: 10, metros: 30 }]);
  });
});

test('12c. o estorno fica oculto quando cruzaria a quantidade entregue', () => {
  const tudoEntregue = Object.assign({}, SALDO, {
    itens: [{ op_item_id: 10, modelo_id: 7, previsto: 100, recebido: 80, liberado: 50, entregue: 50, disponivel: 30 }],
  });
  const { node } = mantaPanel(tudoEntregue);
  assert.equal(findButtons(node).some((b) => /Estornar/.test(textOf(b))), false,
    'sem liberacao estornavel a acao nao e oferecida');
});

test('13. os modais de acao contem apenas o formulario da acao — nenhuma entidade completa', () => {
  const { sandbox, node } = mantaPanel(SALDO);
  sandbox.window.supa = { rpc: async () => ({ data: { ok: true } }) };
  for (const rotulo of [/Liberar adicional/, /Estornar/]) {
    findButtons(node).find((b) => rotulo.test(textOf(b)))._listeners.click({});
    const text = textOf(sandbox.lastModal.body);
    // Nenhum bloco de entidade: sem historico de movimentos, sem itens da
    // expedicao, sem cadeia do Pedido, sem dados da OP, sem conclusao.
    for (const proibido of [/Hist[oó]rico/i, /Itens da expedi/i, /Cadeia:/i, /Ver pedido/i, /Ver OP/i, /Conclus[aã]o/i, /Dados da OP/i]) {
      assert.doesNotMatch(text, proibido, 'modal de acao nao pode conter ' + proibido);
    }
  }
  // A entidade permanece na sua tela dedicada.
  assert.match(expedicaoAdmin, /buildMantaPainel/);
  assert.match(expedicaoAdmin, /buildItens\(\)/);
});

test('13b. nenhuma funcao de render escreve; a escrita fica nos modulos de escrita', () => {
  for (const [rel, src] of [
    ['js/screens/manta-output-form.js', mantaOutputForm],
    ['js/screens/pedido-route-sections.js', routeSections],
    ['js/screens/pedido-route-sections-ui.js', routeSectionsUi],
    ['js/product-route.js', productRoute],
  ]) {
    assert.doesNotMatch(codeOnly(src), /window\.supa/, rel + ' deve ser puro (sem window.supa)');
  }
  for (const [rel, src] of [
    ['js/screens/manta-writes.js', mantaWrites],
    ['js/screens/manta-expedicao-ui.js', mantaExpedicaoUi],
    ['js/screens/manta-movimento-form.js', mantaMovimentoForm],
  ]) {
    assert.doesNotMatch(codeOnly(src), /\.insert\(|\.update\(|\.delete\(|\.upsert\(/,
      rel + ' nao pode escrever direto em tabela; so RPC autoritativa');
  }
});

// ---------------------------------------------------------------------
// 14. Progresso do cliente por rota
// ---------------------------------------------------------------------

test('14. as etapas do cliente sao derivadas da rota (Manta sem Acabamento)', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, trackingUi]);
  const api = sandbox.window.RavatexPedidoTracking;
  const manta = api.getClienteTrackingStepsForRoutes(['manta']).map((s) => s.key);
  assert.equal(manta.indexOf('acabamento'), -1, 'o cliente Manta nao ve Acabamento');
  assert.equal(manta.join(','), 'recebido,confirmado,insumos,tecelagem,expedicao,transporte,concluido');

  const tapete = api.getClienteTrackingStepsForRoutes(['tapete']).map((s) => s.key);
  assert.equal(tapete.indexOf('acabamento'), 4, 'o cliente Tapete mantem Acabamento');

  // Misto: a uniao das rotas aplicaveis (o Acabamento existe pela Tapete).
  const misto = api.getClienteTrackingStepsForRoutes(['tapete', 'manta']).map((s) => s.key);
  assert.equal(misto.length, 8);

  // Sem rota conhecida a lista canonica completa e preservada (legado).
  assert.equal(api.getClienteTrackingStepsForRoutes([]).length, api.CLIENTE_TRACKING_STEPS.length);
});

test('14b. o chain state do cliente emite os passos da rota derivada', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, chainState]);
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const mantaState = derive({
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    itens: [{ modelo_id: 7 }],
    modelosById: { 7: { tipo_produto: 'manta' } },
    ops: [{ id: 1, tipo: 'tecelagem', status: 'em_producao', op_itens: [{ id: 10, modelo_id: 7, metros_pedidos: 100 }] }],
  });
  assert.deepEqual(plain(mantaState.routes), ['manta']);
  assert.equal(mantaState.clientSteps.map((s) => s.key).indexOf('acabamento'), -1);

  const tapeteState = derive({
    pedido: { id: 'p2', status: 'confirmado', metros_total: 100 },
    itens: [{ modelo_id: 9 }],
    modelosById: { 9: { tipo_produto: 'tapete' } },
    ops: [{ id: 2, tipo: 'tecelagem', status: 'em_producao', op_itens: [{ id: 20, modelo_id: 9, metros_pedidos: 100 }] }],
  });
  assert.deepEqual(plain(tapeteState.routes), ['tapete']);
  assert.ok(tapeteState.clientSteps.map((s) => s.key).indexOf('acabamento') >= 0);
});

test('14c. uma OP Manta terminal com saida medida nao liberada fica "pronto para expedicao"', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, chainState]);
  const derive = sandbox.window.RAVATEX_SCREENS.pedidoChainState.derivePedidoChainState;
  const st = derive({
    pedido: { id: 'p1', status: 'confirmado', metros_total: 100 },
    itens: [{ modelo_id: 7 }],
    modelosById: { 7: { tipo_produto: 'manta' } },
    ops: [{ id: 1, tipo: 'tecelagem', status: 'concluida', op_itens: [{ id: 10, modelo_id: 7, metros_pedidos: 100 }] }],
    entregaItens: [{ op_id: 1, op_item_id: 10, entrega_id: 'e1', metros_entregues: 100, defeito: false }],
    entregasById: { e1: { id: 'e1', etapa: 'cima' } },
    expedicoes: [], expedicaoItens: [],
  });
  assert.equal(st.stage, 'pronto_expedicao');
  assert.equal(st.clientStep, 'expedicao');
  assert.doesNotMatch(st.displayStatus, /acabamento/i,
    'a rota Manta nunca pode exibir um estado de acabamento');
  assert.equal(st.actions.registrarSaidaManta.visible, true);
  assert.equal(st.actions.releaseExpedicaoManta.mode, 'enabled');
});

test('14d. o tracking do cliente casa o dto por CHAVE, nunca por posicao', () => {
  assert.match(clienteTracking, /dtoByKey\[(?:step|entry)\.key\]/,
    'as listas podem ter tamanhos diferentes entre rotas');
  assert.match(clienteTracking, /getClienteTrackingStepsForRoutes|applicableSteps|applicableSections/);
  assert.match(clienteTracking, /getClienteTrackingStepIndex/,
    'o estado da etapa continua comparado pelo indice canonico');
  assert.doesNotMatch(clienteTracking, /dtoByKey\[\s*i\s*\]|stepsComPercentual\[\s*i\s*\]/,
    'o dto nunca pode ser casado por posicao');
});

// =====================================================================
// PHASE-MANTA-B2B-ROUTE-SEMANTICS-AND-RESPONSIVE-VISUAL-CORRECTION-R2
// Provas das correcoes D1 (secoes de rota do cliente), D2 (numeracao
// contigua por rota) e D4 (vocabulario e pendencia documental de rota).
// =====================================================================

// Coleta nos por atributo atravessando a arvore do sandbox (o FakeNode
// dos testes nao implementa querySelectorAll).
function findByAttr(node, attr, acc) {
  const out = acc || [];
  if (!node || node.nodeType === 3) return out;
  if (node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, attr)) out.push(node);
  (node.children || []).forEach((c) => findByAttr(c, attr, out));
  return out;
}

function clientTrackingSandbox() {
  return makeSandbox([opDisplay, productRoute, trackingUi, chainState,
    read('js/screens/cliente-route-sections-ui.js'), clienteTracking]);
}

// Renderiza o card de acompanhamento do cliente para um conjunto de rotas
// e devolve as secoes com as etapas realmente exibidas.
function renderClientCard(routes, pedidoOver) {
  const sandbox = clientTrackingSandbox();
  const pedido = Object.assign({
    id: 'p1', numero: 77, status: 'produzindo', metros_total: 100,
    status_cliente_visual: 'tecelagem',
  }, pedidoOver || {});
  const card = sandbox.window.buildClientePedidoTrackingCard(pedido, [], [], null, routes);
  const sections = findByAttr(card, 'data-rv-client-route-section').map((sec) => ({
    route: sec.getAttribute('data-rv-client-route-section'),
    steps: findByAttr(sec, 'data-rv-step-key').map((n) => ({
      key: n.getAttribute('data-rv-step-key'),
      shown: Number(n.getAttribute('data-rv-step-number')),
      canonical: Number(n.getAttribute('data-rv-step-canonical')),
    })),
    steppers: findByAttr(sec, 'data-rv-client-stepper').length,
  }));
  return { sandbox, card, sections, text: textOf(card) };
}

test('R2/1. a rota Manta do cliente omite Acabamento', () => {
  const { sections } = renderClientCard(['manta']);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].route, 'manta');
  assert.equal(sections[0].steps.some((s) => s.key === 'acabamento'), false,
    'a rota Manta nao pode conter a etapa acabamento');
  assert.deepEqual(sections[0].steps.map((s) => s.key),
    ['recebido', 'confirmado', 'insumos', 'tecelagem', 'expedicao', 'transporte', 'concluido']);
});

test('R2/2. a numeracao visivel da Manta e CONTIGUA (sem buraco onde o Acabamento saiu)', () => {
  const { sections } = renderClientCard(['manta']);
  const shown = sections[0].steps.map((s) => s.shown);
  assert.deepEqual(shown, [1, 2, 3, 4, 5, 6, 7], 'a Manta deve exibir 1..7 sem lacuna');
  // O indice canonico continua saltando o acabamento (3 -> 5): o numero
  // exibido e a posicao LOCAL da rota, nunca o indice canonico.
  const canonical = sections[0].steps.map((s) => s.canonical);
  assert.deepEqual(canonical, [0, 1, 2, 3, 5, 6, 7]);
  assert.notDeepEqual(shown.map((n) => n - 1), canonical,
    'a correcao D2 exige justamente que visivel divirja do canonico apos o filtro');
});

test('R2/3. a numeracao visivel do Tapete continua contigua e completa', () => {
  const { sections } = renderClientCard(['tapete']);
  assert.deepEqual(sections[0].steps.map((s) => s.shown), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(sections[0].steps.map((s) => s.canonical), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('R2/4. um Pedido misto do cliente renderiza DUAS secoes de rota', () => {
  const { sections } = renderClientCard(['tapete', 'manta']);
  assert.equal(sections.length, 2, 'um Pedido misto tem duas rotas independentes');
  assert.deepEqual(sections.map((s) => s.route), ['tapete', 'manta']);
  assert.equal(sections[0].steppers, 1);
  assert.equal(sections[1].steppers, 1);
});

test('R2/5. um Pedido misto NAO renderiza a uniao das rotas num stepper unico', () => {
  const { card, sections } = renderClientCard(['tapete', 'manta']);
  const steppers = findByAttr(card, 'data-rv-client-stepper');
  assert.equal(steppers.length, 2, 'dois steppers, um por rota — nunca um so');
  const total = sections.reduce((acc, s) => acc + s.steps.length, 0);
  assert.equal(total, 15, 'Tapete 8 + Manta 7; a uniao num stepper unico daria 8');
  assert.notEqual(sections[0].steps.length, sections[1].steps.length,
    'as duas rotas tem formas diferentes e nao podem compartilhar um stepper');
});

test('R2/6. a secao Tapete do misto contem Acabamento', () => {
  const { sections } = renderClientCard(['tapete', 'manta']);
  const tapete = sections.find((s) => s.route === 'tapete');
  assert.equal(tapete.steps.some((s) => s.key === 'acabamento'), true);
});

test('R2/7. a secao Manta do misto NAO contem Acabamento', () => {
  const { sections } = renderClientCard(['tapete', 'manta']);
  const manta = sections.find((s) => s.route === 'manta');
  assert.equal(manta.steps.some((s) => s.key === 'acabamento'), false);
  assert.deepEqual(manta.steps.map((s) => s.shown), [1, 2, 3, 4, 5, 6, 7]);
});

test('R2/8. a conclusao de uma rota nao completa nem avanca a outra', () => {
  // Posicao publicada em `acabamento`: existe SO na rota Tapete. A secao
  // Manta nao ganha nenhuma etapa de acabamento e conserva a sua propria
  // forma e numeracao — o avanco do Tapete nao avanca a Manta.
  const { sections } = renderClientCard(['tapete', 'manta'], { status_cliente_visual: 'acabamento' });
  const tapete = sections.find((s) => s.route === 'tapete');
  const manta = sections.find((s) => s.route === 'manta');
  assert.equal(tapete.steps.some((s) => s.key === 'acabamento' && s.canonical === 4), true);
  assert.equal(manta.steps.some((s) => s.key === 'acabamento'), false);
  assert.deepEqual(manta.steps.map((s) => s.shown), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(manta.steps.length, 7);
  assert.equal(tapete.steps.length, 8);
});

test('R2/9. o dto de parciais e casado por CHAVE e so dentro da rota que possui a chave', () => {
  const api = makeSandbox([opDisplay, productRoute]).window.RAVATEX_PRODUCT_ROUTE;
  const steps = [{ key: 'tecelagem' }, { key: 'acabamento' }, { key: 'expedicao' }];
  const split = api.splitClientStepsByRoute(steps, ['tapete', 'manta']);
  const mantaKeys = split.find((s) => s.route === 'manta').steps.map((s) => s.key);
  assert.equal(mantaKeys.indexOf('acabamento'), -1,
    'a chave acabamento nunca entra na secao Manta, logo o seu dto nunca e casado la');
  assert.deepEqual(split.find((s) => s.route === 'tapete').steps.map((s) => s.key),
    ['tecelagem', 'acabamento', 'expedicao']);
  // displayIndex e contiguo dentro de cada rota, por construcao.
  split.forEach((sec) => {
    sec.steps.forEach((entry, i) => { assert.equal(entry.displayIndex, i); });
  });
});

test('R2/10. o resumo da OP de tecelagem Manta nao contem "Entregue p/ acabamento"', () => {
  const src = codeOnly(opTecelagem);
  assert.match(src, /RESUMO_LABELS/, 'os rotulos do resumo passam a ser por rota');
  assert.match(src, /manta:[\s\S]{0,200}entregue: 'Sa[ií]da medida'/,
    'a rota Manta usa vocabulario de saida medida');
  assert.match(src, /buildResumo\(totais, isManta \? 'manta' : 'tapete'\)/,
    'a rota e passada EXPLICITAMENTE — o builder nunca a adivinha');
  assert.match(src, /function buildResumo\(totais, route\)/);
});

test('R2/11. o resumo da OP de tecelagem Tapete mantem o vocabulario de Acabamento', () => {
  const src = codeOnly(opTecelagem);
  assert.match(src, /tapete:[\s\S]{0,200}entregue: 'Entregue p\/ acabamento'/,
    'o Tapete permanece verbatim');
});

test('R2/12. a pendencia documental da Manta nao cita a transicao Tecelagem -> Acabamento', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, routeSections]);
  const api = sandbox.window.RAVATEX_SCREENS.pedidoRouteSections;

  const mantaCom = api.buildOpDocBanner('tecelagem', 'manta', 210);
  const mantaSem = api.buildOpDocBanner('tecelagem', 'manta', 0);
  for (const b of [mantaCom, mantaSem]) {
    assert.doesNotMatch(b.text, /romaneio/i, 'nenhum romaneio tecelagem->acabamento na Manta');
    assert.doesNotMatch(b.text, /pendente/i, 'a Manta nao ganha uma pendencia fabricada');
    assert.doesNotMatch(b.text, /Sem movimenta[çc][ãa]o para acabamento/i,
      'afirmar "sem movimentacao para acabamento" implica que a etapa existe na rota');
    assert.equal(b.tone, 'neutral', 'sem tom de alerta: nao ha exigencia documental a cobrar');
    // O contrato (sec.7.3) permite citar Acabamento SO como nota explicativa
    // de que a rota nao o contem; nunca como transicao aplicavel.
    if (/acabamento/i.test(b.text)) {
      assert.match(b.text, /n[ãa]o tem[^.]*acabamento/i,
        'se o Acabamento e citado, tem de ser na forma negada e explicativa');
    }
  }
  // Tapete verbatim.
  assert.equal(api.buildOpDocBanner('tecelagem', 'tapete', 210).text,
    'Romaneio tecelagem -> acabamento pendente');
  assert.equal(api.buildOpDocBanner('tecelagem', 'tapete', 0).text,
    'Sem movimentacao para acabamento registrada ainda');
  assert.equal(api.buildOpDocBanner('acabamento', 'tapete', 210).text, 'NF de expedicao pendente');

  // Linha documental: a transicao citada e a que a rota realmente tem.
  const rowManta = api.buildOpDocumentRow({ stageKey: 'tecelagem', route: 'manta', label: 'OP X', done: 210 });
  assert.match(rowManta.label, /Tecelagem -> Expedicao/);
  assert.doesNotMatch(rowManta.label, /Acabamento/);
  const rowTapete = api.buildOpDocumentRow({ stageKey: 'tecelagem', route: 'tapete', label: 'OP Y', done: 210 });
  assert.equal(rowTapete.label, 'Movimento: Tecelagem -> Acabamento · OP Y');
});

test('R2/13. num Pedido misto o total de Acabamento contem SO valores Tapete', () => {
  const sandbox = makeSandbox([opDisplay, productRoute, routeSections]);
  const api = sandbox.window.RAVATEX_SCREENS.pedidoRouteSections;
  const opSummaries = [
    { stageKey: 'tecelagem', route: 'tapete', done: 400, remaining: 0 },
    { stageKey: 'acabamento', route: 'tapete', done: 100, remaining: 300 },
    { stageKey: 'tecelagem', route: 'manta', done: 180, remaining: 120 },
  ];
  const misto = plain(api.buildPedidoSummaryMetrics(['tapete', 'manta'], opSummaries));
  assert.equal(misto.hasAcabamento, true, 'o misto mantem a metrica de Acabamento');
  assert.equal(misto.hasManta, true);
  assert.equal(misto.mantaMedido, 180, 'a saida medida da Manta vive na sua propria metrica');

  // Manta-only: a metrica de Acabamento e SUPRIMIDA, nao exibida como zero.
  const soManta = plain(api.buildPedidoSummaryMetrics(['manta'],
    [{ stageKey: 'tecelagem', route: 'manta', done: 210, remaining: 90 }]));
  assert.equal(soManta.hasAcabamento, false);
  assert.equal(soManta.hasManta, true);
  assert.equal(soManta.mantaMedido, 210);

  // Tapete-only: inalterado.
  const soTapete = plain(api.buildPedidoSummaryMetrics(['tapete'], opSummaries));
  assert.equal(soTapete.hasAcabamento, true);
  assert.equal(soTapete.hasManta, false);

  // O agregado `emAcabamento` do view model soma SO OPs de acabamento
  // (ops.tipo='latex'), onde nenhuma Manta pode existir por garantia do
  // banco — portanto contem apenas valores Tapete por construcao.
  const prog = codeOnly(detailProgress);
  assert.match(prog, /acabamentoSummaries = opSummaries\.filter\(function \(row\) \{ return row\.stageKey === 'acabamento'; \}\)/);
  assert.match(prog, /emAcabamento = ns\.round2\(acabamentoSummaries\.reduce/);
  assert.match(prog, /function stageKeyForOp\(op\) \{\s*return op && op\.tipo === 'latex' \? 'acabamento' : 'tecelagem';/);
});

test('R2/14. linhas de item e cards de OP Manta usam vocabulario e valores de rota', () => {
  const src = codeOnly(detailRender);
  // Card de OP por rota.
  assert.match(src, /OP_CARD_LABELS/);
  assert.match(src, /manta:[\s\S]{0,240}entregue: 'Saida medida'/);
  assert.match(src, /manta:[\s\S]{0,240}movTitle: 'Movimentar para Expedicao'/);
  assert.match(src, /tapete:[\s\S]{0,240}entregue: 'Entregue p\/ acabamento'/);
  assert.doesNotMatch(src, /summary\.stageKey === 'tecelagem' \? 'Transferir para Acabamento'/,
    'o titulo do modal nao pode mais ser decidido por stageKey sozinho');
  // Linha de item: a coluna Acabamento nao se aplica a Manta.
  assert.match(src, /data-rv-item-acabamento/);
  assert.match(src, /isManta \? '—' : ns\.fmtMetrosShort\(metrics\.acabamento\)/);
  assert.match(src, /showAcabamento \? th\('ACABAMENTO'\) : null/);
  // Valores de rota: o liberado/entregue da Manta vem do op_item da propria
  // OP de tecelagem, nunca de uma OP de acabamento inexistente.
  const prog = codeOnly(detailProgress);
  assert.match(prog, /routeForOp\(row\.op, state\.modelosById\) === 'manta'[\s\S]{0,240}liberadoByLatexOpItem\[row\.opItem\.id\]/);
  assert.match(prog, /route: routeApi\(\) \? routeApi\(\)\.routeForPedidoItem\(item, state\.modelosById\)/);
});

test('R2/18. a correcao R2 nao introduz delta de banco nem migracao', () => {
  const changed = execFileSync('git', ['diff', '--name-only', 'bbd5f85'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  // O sujeito deste guard e a correcao que ele acompanha. Uma migracao
  // AUTORIZADA POSTERIOR (BATCH-02: db/89) nao pertence a esse sujeito e nao
  // pode ser lida como delta desta correcao; a garantia original — esta
  // correcao nao toca o banco — segue integral.
  const POSTERIOR_AUTORIZADO = [
    /^db\/89_pedido_commercial_date_and_number_control\.sql$/,
    /^db\/90_pedido_proximo_numero_suggestion_rpc\.sql$/,
  ];
  for (const rel of changed.concat(untracked)) {
    if (POSTERIOR_AUTORIZADO.some((re) => re.test(rel))) continue;
    assert.equal(/^db\//.test(rel), false, 'nenhum arquivo db/** pode mudar: ' + rel);
    assert.equal(/\.sql$/.test(rel), false, 'nenhum .sql pode mudar: ' + rel);
  }
});

// ---------------------------------------------------------------------
// 19. PHASE-MANTA-B2B-R3 — pre-visualizacao administrativa do cliente
//     ("O QUE O CLIENTE VE") alinhada a forma da rota.
// ---------------------------------------------------------------------

// Indice canonico de `tecelagem` na lista completa de etapas do cliente.
function canonicalTecelagemIndex(api) {
  return api.getClienteTrackingStepIndex('tecelagem');
}

test('R3/19a. Manta-only: a pre-visualizacao usa denominador SETE e ordinal local', () => {
  const api = makeSandbox([opDisplay, productRoute, trackingUi]).window.RavatexPedidoTracking;
  const idx = canonicalTecelagemIndex(api);
  assert.equal(idx, 3, 'Tecelagem e a 4a etapa canonica');

  const pos = api.getClienteTrackingPreviewPosition(['manta'], idx);
  assert.equal(pos.mode, 'route-local');
  assert.equal(pos.visibleTotal, 7, 'a Manta publica 7 etapas visiveis');
  assert.equal(pos.visibleIndex, 4);
  assert.equal(pos.label, 'Etapa 4 de 7');
  assert.doesNotMatch(pos.label, /de 8/, 'o Acabamento omitido nao pode ficar no denominador');
});

test('R3/19b. Tapete-only: a pre-visualizacao permanece em OITO etapas', () => {
  const api = makeSandbox([opDisplay, productRoute, trackingUi]).window.RavatexPedidoTracking;
  const pos = api.getClienteTrackingPreviewPosition(['tapete'], canonicalTecelagemIndex(api));
  assert.equal(pos.mode, 'route-local');
  assert.equal(pos.visibleTotal, 8, 'o Tapete mantem 8 etapas visiveis');
  assert.equal(pos.visibleIndex, 4);
  assert.equal(pos.label, 'Etapa 4 de 8');
});

test('R3/19c. Pedido misto NAO afirma um total local unico', () => {
  const api = makeSandbox([opDisplay, productRoute, trackingUi]).window.RavatexPedidoTracking;
  const pos = api.getClienteTrackingPreviewPosition(['tapete', 'manta'], canonicalTecelagemIndex(api));
  assert.equal(pos.mode, 'pedido-level');
  assert.equal(pos.route, null, 'um Pedido misto nao tem uma rota unica');
  assert.match(pos.label, /^Etapa comercial 4 de 8$/,
    'o ordinal do misto e declaradamente de nivel Pedido');
  // A posicao LOCAL de cada rota e resumida, sem virar denominador exibido.
  assert.equal(pos.routePositions.length, 2);
  const byRoute = Object.fromEntries(pos.routePositions.map((p) => [p.route, p]));
  assert.equal(byRoute.manta.visibleTotal, 7);
  assert.equal(byRoute.tapete.visibleTotal, 8);
  assert.equal(byRoute.manta.nextLabel, 'Expedição', 'a proxima da Manta e Expedicao, nunca Acabamento');
  assert.equal(byRoute.tapete.nextLabel, 'Acabamento');
});

test('R3/19d. sem rota confiavel a pre-visualizacao degrada para o nivel Pedido', () => {
  const api = makeSandbox([opDisplay, productRoute, trackingUi]).window.RavatexPedidoTracking;
  const pos = api.getClienteTrackingPreviewPosition([], canonicalTecelagemIndex(api));
  assert.equal(pos.mode, 'pedido-level');
  assert.equal(pos.visibleTotal, api.CLIENTE_TRACKING_STEPS.length);
  assert.equal(pos.routePositions.length, 0, 'sem rota nao se resume rota nenhuma');
});

test('R3/19e. a Manta percorre a rota inteira sem lacuna no ordinal visivel', () => {
  const api = makeSandbox([opDisplay, productRoute, trackingUi]).window.RavatexPedidoTracking;
  const seen = api.getClienteTrackingStepsForRoutes(['manta']).map((entry) => {
    const pos = api.getClienteTrackingPreviewPosition(['manta'], api.getClienteTrackingStepIndex(entry.key));
    return pos.visibleIndex + '/' + pos.visibleTotal;
  });
  // D2: numeracao visivel contigua 1..7, sem repetir nem saltar.
  assert.equal(seen.join(' '), '1/7 2/7 3/7 4/7 5/7 6/7 7/7');
});

test('R3/19f. o render consome o helper de rota e nao duplica listas de etapas', () => {
  const src = codeOnly(detailRender);
  assert.match(src, /getClienteTrackingPreviewPosition\(view\.pedidoRoutes, currentIndex\)/,
    'a pre-visualizacao deve derivar a posicao pelo helper de rota');
  assert.doesNotMatch(src, /'Etapa ' \+ \(currentIndex \+ 1\) \+ ' de ' \+ totalSteps,/,
    'o rotulo canonico cru nao pode mais ser o exibido');
  // O render nao pode reproduzir a forma da rota localmente.
  assert.doesNotMatch(src, /ROUTE_CLIENT_STEP_KEYS/);
  assert.doesNotMatch(src, /'recebido',\s*'confirmado'/);
  // O helper vive no dono do vocabulario de tracking, nao no render.
  assert.match(codeOnly(trackingUi), /function getClienteTrackingPreviewPosition/);
  // Nada de posicao por rota persistida e nada de tocar status_cliente_visual.
  assert.doesNotMatch(codeOnly(trackingUi).split('function getClienteTrackingPreviewPosition')[1].slice(0, 2600),
    /status_cliente_visual\s*=/);
});

test('R3/19g. a correcao R3 nao introduz delta de banco nem migracao', () => {
  const changed = execFileSync('git', ['diff', '--name-only', '3ed9c4a'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  // O sujeito deste guard e a correcao que ele acompanha. Uma migracao
  // AUTORIZADA POSTERIOR (BATCH-02: db/89) nao pertence a esse sujeito e nao
  // pode ser lida como delta desta correcao; a garantia original — esta
  // correcao nao toca o banco — segue integral.
  const POSTERIOR_AUTORIZADO = [
    /^db\/89_pedido_commercial_date_and_number_control\.sql$/,
    /^db\/90_pedido_proximo_numero_suggestion_rpc\.sql$/,
  ];
  for (const rel of changed.concat(untracked)) {
    if (POSTERIOR_AUTORIZADO.some((re) => re.test(rel))) continue;
    assert.equal(/^db\//.test(rel), false, 'nenhum arquivo db/** pode mudar: ' + rel);
    assert.equal(/\.sql$/.test(rel), false, 'nenhum .sql pode mudar: ' + rel);
  }
});

test('R3/19h. gates estruturais preservados (nenhum arquivo gated cresceu)', () => {
  const lines = (rel) => read(rel).split('\n').length - (read(rel).endsWith('\n') ? 1 : 0);
  assert.ok(lines('js/screens/pedido-detail-events.js') <= 2709,
    'pedido-detail-events.js deve permanecer <= 2709 linhas');
  assert.ok(lines('js/screens/pedido-detail-progress.js') <= 918,
    'pedido-detail-progress.js deve permanecer <= 918 linhas');
});

// ---------------------------------------------------------------------
// 20. PHASE-MANTA-B2B-R3-CACHE-BUST — invalidacao declarativa dos dois
//     assets alterados por R3. Nenhuma mudanca de comportamento.
// ---------------------------------------------------------------------

// Os dois unicos assets que R3 alterou; ambos DEVEM compartilhar o mesmo
// token novo, para que um browser que retorna nao sirva o asset pre-R3.
const R3_ASSETS = ['js/pedido-tracking-ui.js', 'js/screens/pedido-detail-render.js'];
const R2_TOKEN = '20260725-manta-b2b-r2';

// UI-CONSOLIDATION-PHASE-5-PASS-1-LITERAL-COLOUR-OWNERSHIP-R1 retokenizou os
// assets que a passada de cor realmente alterou, mais os dois donos canonicos
// promovidos (js/badges.js e js/pedido-ui.js). A intencao original de R3/20c2,
// R3/20c e R3/20e continua valendo e nao foi enfraquecida: estes assets saem da
// comparacao com 4532f76 apenas sob um token declarado, verificado literalmente
// por PASS1/20c7 e proibido em qualquer outro asset.
// A correcao de coerencia de cache acrescentou `css/tokens.css` a esse conjunto:
// D9 alterou a folha de tokens, e servi-la sem token de versao permitiria a um
// browser combinar JavaScript novo com a folha pre-D9 em cache. Ela e um asset
// que a passada 1 realmente alterou, entao entra pela mesma porta declarada.
const PASS1_TOKEN = '20260726-ui-p5-pass1';
const PASS1_ASSETS = [
  'css/tokens.css',
  'js/badges.js',
  'js/pedido-ui.js',
  'js/screens/pedido-route-sections.js',
  'js/screens/pedido-route-sections-ui.js',
  'js/screens/system-screens.js',
  'js/screens/trocar-senha-obrigatoria.js',
  'js/screens/common.js',
  'js/screens/cadastros.js',
  'js/screens/admin-usuarios-audit-panel.js',
  'js/screens/admin-usuarios-modal.js',
  'js/screens/admin-usuarios.js',
  'js/screens/ops-list.js',
  'js/screens/pedidos-list.js',
  'js/screens/documentos-recebidos-decision-modal.js',
  'js/screens/document-link-admin-modal.js',
  'js/screens/documentos-recebidos.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/pedido-form.js',
  'js/screens/pedido-detail.js',
  'js/screens/pedido-detail-progress.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/ordem-compra-distribuicao.js',
  'js/screens/op-distribuicao-ui.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/painel.js',
  'js/screens/cliente-dashboard.js',
  'js/screens/cliente-pedidos-list.js',
  'js/screens/cliente-route-sections-ui.js',
  'js/screens/cliente-pedido-tracking.js',
  'js/screens/cliente-pedido-detail.js',
  'js/screens/cliente-pedido-form.js',
  'js/screens/entrega-form.js',
  'js/screens/op-latex-admin.js',
  'js/screens/manta-output-form.js',
  'js/screens/manta-expedicao-ui.js',
  'js/screens/expedicao-admin.js',
  'js/screens/painel.js',
  'js/screens/op-distribuicao-ui.js',
  'js/screens/op-tecelagem-producao-admin.js',
  'js/screens/op-nova.js'
];

// UI-CONSOLIDATION-PHASE-5-PASS-2-RADIUS-AND-SEMANTIC-PILL-R1 retokenizou as 26
// telas que a passada de raio realmente alterou. Todas ja pertenciam a passada 1,
// entao PASS2_ASSETS e um subconjunto estrito de PASS1_ASSETS e o token da
// passada 1 sobrevive apenas nos assets que a passada 2 nao tocou — o mesmo
// padrao que R3/20c3 e PASS1/20c7 ja aplicaram aos lotes anteriores. A intencao
// original de R3/20c2, R3/20c e R3/20e continua valendo e nao foi enfraquecida.
const PASS2_TOKEN = '20260726-ui-p5-pass2';
const PASS2_ASSETS = [
  'js/screens/admin-usuarios-audit-panel.js',
  'js/screens/admin-usuarios-modal.js',
  'js/screens/admin-usuarios.js',
  'js/screens/cadastros.js',
  'js/screens/cliente-dashboard.js',
  'js/screens/cliente-pedido-detail.js',
  'js/screens/cliente-pedido-tracking.js',
  'js/screens/cliente-pedidos-list.js',
  'js/screens/cliente-route-sections-ui.js',
  'js/screens/common.js',
  'js/screens/documentos-recebidos.js',
  'js/screens/entrega-form.js',
  'js/screens/expedicao-admin.js',
  'js/screens/manta-output-form.js',
  'js/screens/op-latex-admin.js',
  'js/screens/op-nova.js',
  'js/screens/op-tecelagem-producao-admin.js',
  'js/screens/op-distribuicao-ui.js',
  'js/screens/ops-list.js',
  'js/screens/ordem-compra-receipt-render.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/painel.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-detail-render.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/pedido-route-sections-ui.js',
  'js/screens/pedidos-list.js',
  'js/screens/system-screens.js',
  'js/screens/trocar-senha-obrigatoria.js'
];
// A2 removeu a SEGUNDA fonte de raio — os utilitarios Tailwind `rounded*` — das
// telas abaixo, que passam a declarar a geometria canonica inline. Elas carregam o
// token de correcao da A2; todas as demais conservam o token da ordem que as
// alterou por ultimo. A garantia original nao muda: um asset alterado e invalidado
// exatamente uma vez, sob um token declarado, e esse token nao vaza.
const PASS2_A2_TOKEN = '20260726-ui-p5-pass2-a2';
const PASS2_A2_ASSETS = [
  'js/screens/cliente-pedido-detail.js',
  'js/screens/common.js',
  'js/screens/fornecedor.js',
  'js/screens/op-latex-admin.js',
  'js/screens/ordem-compra-distribuicao.js',
  'js/screens/ordem-compra-render.js',
  'js/screens/pedido-detail-events.js',
  'js/screens/pedido-edit.js',
  'js/screens/pedido-insumos-distribuicao.js',
  'js/screens/pedido-itens-edit.js',
  'js/screens/pedido-parciais-admin.js',
  'js/screens/pedido-tracking-admin.js',
  'js/screens/system-screens.js'
];
const PASS2_ASSETS_AINDA_EM_PASS2 = PASS2_ASSETS.filter((a) => !PASS2_A2_ASSETS.includes(a));
const PASS1_ASSETS_AINDA_EM_PASS1 = PASS1_ASSETS
  .filter((a) => !PASS2_ASSETS.includes(a))
  .filter((a) => !PASS2_A2_ASSETS.includes(a));

// R3 alterou dois assets. A passada 1 retokenizou UM deles
// (pedido-detail-render.js), entao o token de R3 sobrevive apenas no outro —
// o mesmo padrao que R3/20c3 ja aplicou ao token do lote 1.
const R3_ASSETS_AINDA_EM_R3 = R3_ASSETS.filter((a) => !PASS1_ASSETS.includes(a));


// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-01-R1: o lote de defeitos
// operacionais alterou js/screens/pedido-form.js, entao esse asset PRECISA
// receber um token novo — 4532f76 deixou de ser a referencia congelada para
// ele. A intencao original de R3/20c2 ("um cache-bust nao pode vazar para
// asset NAO relacionado") continua valendo e nao foi enfraquecida: o asset
// so sai da comparacao com 4532f76 sob um token declarado, que R3/20c3
// abaixo verifica literalmente e proibe de aparecer em qualquer outro asset.
const BATCH1_ASSETS = ['js/screens/pedido-form.js'];
const BATCH1_TOKEN = '20260725-pedido-operational-batch1';

// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1 retokenizou seis superficies
// de Pedido e ADICIONOU um modulo novo (a linha de item extraida). A intencao
// original de R3/20c2 e R3/20e — um CACHE-BUST nao pode vazar token nem
// adicionar/remover/reordenar asset — continua valendo: os assets abaixo saem
// da comparacao com 4532f76 apenas sob um token declarado, que R3/20c4 verifica
// literalmente e proibe em qualquer outro asset.
const BATCH2_TOKEN = '20260725-pedido-operational-batch2';
const BATCH2_ADDED_ASSETS = ['js/screens/pedido-item-row-editor.js'];
const BATCH2_RETOKENED_ASSETS = [
  'js/screens/pedido-form.js',
  'js/screens/pedido-detail-data.js',
  'js/screens/pedido-edit.js',
  'js/screens/pedido-itens-edit.js',
  'js/screens/cliente-pedido-form.js',
];
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-03-R1 (sugestao de numero de
// Pedido + layout operacional compacto) ADICIONOU um modulo novo (o contrato de
// numeracao extraido) e retokenizou tres assets que ele realmente alterou:
// pedido-form.js (sugestao + grade unica), pedido-item-row-editor.js (densidade
// da linha) e css/responsive.css (breakpoints de `data-rv-pedido-dados`).
// A intencao original de R3/20c2 e R3/20e continua valendo: os assets abaixo
// saem da comparacao com 4532f76 apenas sob um token declarado, que R3/20c5
// verifica literalmente e proibe em qualquer outro asset.
const BATCH3_TOKEN = '20260725-pedido-operational-batch3';
const BATCH3_ADDED_ASSETS = ['js/screens/pedido-numero-sugestao.js'];
const BATCH3_RETOKENED_ASSETS = [
  'js/screens/pedido-form.js',
  'js/screens/pedido-item-row-editor.js',
  'css/responsive.css',
];
const BATCH3_ASSETS_DECLARADOS = BATCH3_ADDED_ASSETS.concat(BATCH3_RETOKENED_ASSETS);
const BATCH3_ASSETS = BATCH3_ASSETS_DECLARADOS.filter((a) => !PASS1_ASSETS.includes(a));

// Os assets que o lote 3 retokenizou saem do conjunto do lote 2; eles continuam
// listados em BATCH2_* porque, em relacao a 4532f76, seguem sendo assets
// legitimamente retokenizados (R3/20c2).
const BATCH2_ASSETS = BATCH2_ADDED_ASSETS.concat(BATCH2_RETOKENED_ASSETS)
  .filter((asset) => !PASS2_A2_ASSETS.includes(asset))
  .filter((asset) => !BATCH3_ASSETS.includes(asset))
  .filter((asset) => !PASS1_ASSETS.includes(asset));

// Todo asset acrescentado depois de 4532f76 por uma ordem autorizada.
const ADDED_SINCE_4532F76 = BATCH2_ADDED_ASSETS.concat(BATCH3_ADDED_ASSETS);

// Parsing literal, sem regex: um `?v=` num padrao escapado a mao e uma
// fonte de erro silencioso (o `?` volta a ser quantificador e o teste
// passa a nao encontrar nada).
function assetRefs(src) {
  const out = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1];
    const at = raw.indexOf('?v=');
    out.push({ path: at === -1 ? raw : raw.slice(0, at), token: at === -1 ? null : raw.slice(at + 3) });
  }
  return out;
}

function tokenFor(rel) {
  const hit = assetRefs(indexHtml).filter((r) => r.path === rel);
  assert.equal(hit.length, 1, rel + ' deve aparecer exatamente uma vez em index.html');
  return hit[0].token;
}

test('R3/20a. os dois assets alterados por R3 seguem invalidados', () => {
  const tokens = R3_ASSETS.map(tokenFor);
  for (let i = 0; i < R3_ASSETS.length; i++) {
    assert.ok(tokens[i], R3_ASSETS[i] + ' deve ser carregado com ?v=');
    assert.notEqual(tokens[i], R2_TOKEN,
      R3_ASSETS[i] + ' nao pode voltar ao token de R2, senao o cache nao e invalidado');
  }
  // O asset que a passada 1 nao tocou conserva o token especifico de R3.
  for (const rel of R3_ASSETS_AINDA_EM_R3) {
    assert.match(tokenFor(rel), /r3$/, rel + ' deve manter o token especifico de R3');
  }
  // O asset que a passada 1 retokenizou carrega o token da ULTIMA passada que o
  // alterou: a passada 2 tambem tocou pedido-detail-render.js.
  for (const rel of R3_ASSETS.filter((a) => PASS1_ASSETS.includes(a))) {
    const esperado = PASS2_ASSETS.includes(rel) ? PASS2_TOKEN : PASS1_TOKEN;
    assert.equal(tokenFor(rel), esperado,
      rel + ' deve carregar o token declarado da passada que o alterou por ultimo');
  }
});

test('R3/20b. nenhum dos dois assets retem o token de R2', () => {
  for (const rel of R3_ASSETS) {
    assert.notEqual(tokenFor(rel), R2_TOKEN, rel + ' nao pode continuar com o token de R2');
  }
});

test('R3/20c. o token de R3 nao vaza para nenhum asset nao relacionado', () => {
  const r3Token = tokenFor(R3_ASSETS_AINDA_EM_R3[0]);
  const carriers = assetRefs(indexHtml).filter((r) => r.token === r3Token).map((r) => r.path);
  assert.deepEqual(carriers.sort(), R3_ASSETS_AINDA_EM_R3.slice().sort(),
    'exatamente os assets de R3 que a passada 1 nao tocou podem carregar o token de R3');
});

test('R3/20c3. o token do lote operacional 1 foi superseded e nao vaza para asset algum', () => {
  // O lote 2 retokenizou pedido-form.js, entao NENHUM asset pode continuar
  // carregando o token do lote 1 — senao um browser serviria o arquivo pre-lote-2.
  const carriers = assetRefs(indexHtml).filter((r) => r.token === BATCH1_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers, [],
    'o token do lote 1 foi superseded pelo lote 2 e nao pode sobreviver em asset algum');
});

test('R3/20c4. os assets do lote operacional 2 carregam exatamente o token declarado, e ele nao vaza', () => {
  for (const rel of BATCH2_ASSETS) {
    assert.equal(tokenFor(rel), BATCH2_TOKEN,
      rel + ' deve carregar exatamente o token declarado do lote operacional 2');
  }
  const carriers = assetRefs(indexHtml).filter((r) => r.token === BATCH2_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers.sort(), BATCH2_ASSETS.slice().sort(),
    'exatamente os assets do lote operacional 2 podem carregar o token do lote');
  assert.notEqual(BATCH2_TOKEN, tokenFor(R3_ASSETS[0]),
    'o token do lote operacional 2 tem de diferir do token de R3');
  assert.notEqual(BATCH2_TOKEN, BATCH1_TOKEN);
});

test('R3/20c5. os assets do lote operacional 3 carregam exatamente o token declarado, e ele nao vaza', () => {
  for (const rel of BATCH3_ASSETS) {
    assert.equal(tokenFor(rel), BATCH3_TOKEN,
      rel + ' deve carregar exatamente o token declarado do lote operacional 3');
  }
  const carriers = assetRefs(indexHtml).filter((r) => r.token === BATCH3_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers.sort(), BATCH3_ASSETS.slice().sort(),
    'exatamente os assets do lote 3 podem carregar o token do lote 3');
  // Um cache-bust que reusa um token anterior nao invalida cache algum.
  assert.notEqual(BATCH3_TOKEN, BATCH2_TOKEN);
  assert.notEqual(BATCH3_TOKEN, BATCH1_TOKEN);
  assert.notEqual(BATCH3_TOKEN, R2_TOKEN);
  assert.notEqual(BATCH3_TOKEN, tokenFor(R3_ASSETS[0]));
});

// Todo asset que o lote 3 NAO tocou conserva o token que tinha: um cache-bust
// nao pode se espalhar por arrasto.
test('R3/20c6. o lote 3 nao retokenizou nenhum asset que nao alterou', () => {
  // Cada asset e comparado ao token do lote que o alterou POR ULTIMO: o lote 3
  // continua proibido de arrastar assets, e a passada 1 declara os seus.
  const intocados = [
    ['js/screens/pedido-detail-data.js', BATCH2_TOKEN],
    ['js/screens/pedido-edit.js', PASS2_A2_TOKEN],
    ['js/screens/pedido-itens-edit.js', PASS2_A2_TOKEN],
    ['js/screens/cliente-pedido-form.js', PASS1_TOKEN],
    ['js/screens/common.js', PASS2_A2_TOKEN],
    ['js/product-route.js', R2_TOKEN],
  ];
  for (const [rel, esperado] of intocados) {
    assert.equal(tokenFor(rel), esperado, rel + ' nao foi alterado pelo lote 3');
  }
});

test('R3/20c2. todo asset nao relacionado conserva o token que tinha em 4532f76', () => {
  const before = assetRefs(execFileSync('git', ['show', '4532f76:index.html'], { cwd: ROOT, encoding: 'utf8' }));
  // Cada ordem autorizada acrescentou um modulo declarado; eles saem da
  // comparacao posicional e sao verificados por R3/20c4 e R3/20c5. Todo o
  // resto continua pinado a 4532f76.
  const after = assetRefs(indexHtml).filter((r) => !ADDED_SINCE_4532F76.includes(r.path));
  assert.equal(after.length, before.length, 'nenhum asset pode ser adicionado ou removido');
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i].path, before[i].path, 'ordem/caminho preservados na posicao ' + i);
    if (R3_ASSETS.includes(before[i].path)) continue;
    if (BATCH1_ASSETS.includes(before[i].path)) continue;
    if (BATCH2_RETOKENED_ASSETS.includes(before[i].path)) continue;
    if (BATCH3_RETOKENED_ASSETS.includes(before[i].path)) continue;
    if (PASS1_ASSETS.includes(before[i].path)) continue;
    if (PASS2_ASSETS.includes(before[i].path)) continue;
    if (PASS2_A2_ASSETS.includes(before[i].path)) continue;
    assert.equal(after[i].token, before[i].token,
      before[i].path + ' e um asset nao relacionado e nao pode ter o token alterado');
  }
});

test('R3/20d. o cache-bust nao alterou os dois arquivos JavaScript', () => {
  // Autoridade de modificacao e o proprio git: o id de blob da arvore de
  // trabalho (com o filtro clean aplicado) contra o blob commitado em
  // 4532f76 — o commit da correcao R3 de comportamento.
  // A passada 1 de cor alterou pedido-detail-render.js sob ordem explicita, entao
  // a invariante "um cache-bust nao altera o JS" vale para o asset que ela nao tocou.
  assert.ok(R3_ASSETS_AINDA_EM_R3.length > 0, 'ao menos um asset de R3 deve seguir intocado');
  for (const rel of R3_ASSETS_AINDA_EM_R3) {
    const committed = execFileSync('git', ['rev-parse', '4532f76:' + rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(worktree, committed, rel + ' deve permanecer byte-identico a 4532f76');
  }
});

test('R3/20e. ordem e caminhos dos assets de index.html inalterados', () => {
  const refs = (src) => (src.match(/(?:src|href)="[^"]+"/g) || [])
    .map((s) => s.replace(/^(?:src|href)="/, '').replace(/"$/, '').replace(/\?v=.*$/, ''));
  const before = refs(execFileSync('git', ['show', '4532f76:index.html'], { cwd: ROOT, encoding: 'utf8' }));
  // Excluidas as adicoes declaradas das ordens posteriores, a lista tem de
  // bater exatamente: um CACHE-BUST continua proibido de adicionar, remover
  // ou reordenar asset.
  const after = refs(indexHtml).filter((r) => !ADDED_SINCE_4532F76.includes(r));
  assert.deepEqual(after, before,
    'nenhum asset pode ser adicionado, removido ou reordenado por um cache-bust');
});

test('R3/20f. o cache-bust nao introduz delta de banco nem toca css', () => {
  const changed = execFileSync('git', ['diff', '--name-only', '4532f76'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  // O sujeito deste guard e a correcao que ele acompanha. Uma migracao
  // AUTORIZADA POSTERIOR (BATCH-02: db/89) nao pertence a esse sujeito e nao
  // pode ser lida como delta desta correcao; a garantia original — esta
  // correcao nao toca o banco — segue integral.
  // BATCH-03 acrescentou os breakpoints de `data-rv-pedido-dados` a folha
  // responsiva. Essa alteracao pertence ao lote 3, nao a correcao R3, e e
  // provada por tests/responsive-layout.smoke.js (B3/4). A garantia original —
  // o cache-bust de R3 nao toca css — segue integral.
  // UI-CONSOLIDATION-FOUNDATION-INTAKE-R1 promoveu os tokens canonicos em
  // `css/tokens.css`. Essa alteracao pertence a esse lote separadamente
  // autorizado, nao ao sujeito historico R3 (Manta responsivo) guardado aqui,
  // e e provada por scripts/validate-ui-foundation.mjs. A garantia original —
  // o cache-bust de R3 nao toca css — segue integral.
  const POSTERIOR_AUTORIZADO = [
    /^db\/89_pedido_commercial_date_and_number_control\.sql$/,
    /^db\/90_pedido_proximo_numero_suggestion_rpc\.sql$/,
    /^css\/responsive\.css$/,
    /^css\/tokens\.css$/,
  ];
  for (const rel of changed) {
    if (POSTERIOR_AUTORIZADO.some((re) => re.test(rel))) continue;
    assert.equal(/^db\//.test(rel), false, 'nenhum arquivo db/** pode mudar: ' + rel);
    assert.equal(/\.sql$/.test(rel), false, 'nenhum .sql pode mudar: ' + rel);
    assert.equal(/^css\//.test(rel), false, 'nenhum css pode mudar neste pedido: ' + rel);
  }
});

// A passada 1 de cor declara os seus assets e o seu token; nenhum outro asset
// pode carrega-lo, e ele tem de diferir de todo token anterior.
test('PASS1/20c7. os assets da passada 1 de cor carregam exatamente o token declarado, e ele nao vaza', () => {
  // A passada 2 retokenizou 26 destes assets; o token da passada 1 sobrevive
  // apenas nos que ela nao tocou, e PASS2/20c8 verifica os outros literalmente.
  for (const rel of PASS1_ASSETS_AINDA_EM_PASS1) {
    assert.equal(tokenFor(rel), PASS1_TOKEN,
      rel + ' deve carregar exatamente o token declarado da passada 1 de cor');
  }
  const carriers = assetRefs(indexHtml).filter((r) => r.token === PASS1_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers.sort(), PASS1_ASSETS_AINDA_EM_PASS1.slice().sort(),
    'exatamente os assets da passada 1 que a passada 2 nao tocou podem carregar o token da passada 1');
  for (const anterior of [BATCH1_TOKEN, BATCH2_TOKEN, BATCH3_TOKEN, R2_TOKEN]) {
    assert.notEqual(PASS1_TOKEN, anterior,
      'reusar um token anterior nao invalidaria cache algum');
  }
  // A folha de tokens continua carregada antes da folha responsiva, que consome
  // os tokens: o cache-bust nao pode reordenar a cascata.
  const ordem = assetRefs(indexHtml).map((r) => r.path);
  assert.ok(ordem.indexOf('css/tokens.css') !== -1 && ordem.indexOf('css/responsive.css') !== -1);
  assert.ok(ordem.indexOf('css/tokens.css') < ordem.indexOf('css/responsive.css'),
    'css/tokens.css tem de preceder css/responsive.css');
  // A passada 2 nao tocou a folha de tokens: ela conserva o token da passada 1.
  assert.equal(tokenFor('css/tokens.css'), PASS1_TOKEN,
    'css/tokens.css nao foi alterado pela passada 2 e conserva o token da passada 1');
});

// A passada 2 de raio declara os seus assets e o seu token; nenhum outro asset
// pode carrega-lo, e ele tem de diferir de todo token anterior.
test('PASS2/20c8. os assets da passada 2 de raio carregam exatamente o token declarado, e ele nao vaza', () => {
  for (const rel of PASS2_ASSETS_AINDA_EM_PASS2) {
    assert.equal(tokenFor(rel), PASS2_TOKEN,
      rel + ' deve carregar exatamente o token declarado da passada 2 de raio');
  }
  const carriers = assetRefs(indexHtml).filter((r) => r.token === PASS2_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers.sort(), PASS2_ASSETS_AINDA_EM_PASS2.slice().sort(),
    'exatamente os assets da passada 2 que a A2 nao tocou podem carregar o token da passada 2');
  for (const anterior of [PASS1_TOKEN, BATCH1_TOKEN, BATCH2_TOKEN, BATCH3_TOKEN, R2_TOKEN]) {
    assert.notEqual(PASS2_TOKEN, anterior,
      'reusar um token anterior nao invalidaria cache algum');
  }
  // Um asset retokenizado tem de ter mudado de fato: um cache-bust vazio
  // invalidaria cache sem motivo e mascararia um arrasto.
  for (const rel of PASS2_ASSETS) {
    const committed = execFileSync('git', ['rev-parse', 'cabd358:' + rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.notEqual(worktree, committed, rel + ' foi retokenizado, entao tem de ter mudado desde cabd358');
  }
  // Todo asset da passada 1 que a passada 2 NAO declarou tem de estar
  // byte-identico a cabd358: a passada 2 nao pode arrastar asset algum.
  for (const rel of PASS1_ASSETS_AINDA_EM_PASS1) {
    const committed = execFileSync('git', ['rev-parse', 'cabd358:' + rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(worktree, committed, rel + ' nao foi declarado pela passada 2 e deve seguir byte-identico a cabd358');
  }
});

// A correcao A2 declara os seus assets e o seu token; nenhum outro asset pode
// carrega-lo, e ele tem de diferir de todo token anterior.
test('A2/20c9. os assets da correcao A2 carregam exatamente o token declarado, e ele nao vaza', () => {
  for (const rel of PASS2_A2_ASSETS) {
    assert.equal(tokenFor(rel), PASS2_A2_TOKEN,
      rel + ' deve carregar exatamente o token declarado da correcao A2');
  }
  const carriers = assetRefs(indexHtml).filter((r) => r.token === PASS2_A2_TOKEN).map((r) => r.path);
  assert.deepEqual(carriers.sort(), PASS2_A2_ASSETS.slice().sort(),
    'exatamente os assets da A2 podem carregar o token da A2');
  for (const anterior of [PASS2_TOKEN, PASS1_TOKEN, BATCH1_TOKEN, BATCH2_TOKEN, BATCH3_TOKEN, R2_TOKEN]) {
    assert.notEqual(PASS2_A2_TOKEN, anterior,
      'reusar um token anterior nao invalidaria cache algum');
  }
  // Um asset retokenizado tem de ter mudado de fato desde o checkpoint publicado.
  for (const rel of PASS2_A2_ASSETS) {
    const committed = execFileSync('git', ['rev-parse', '2114191:' + rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.notEqual(worktree, committed, rel + ' foi retokenizado, entao tem de ter mudado desde 2114191');
  }
  // E nenhum asset NAO declarado pela A2 pode ter mudado.
  const declarados = new Set(PASS2_A2_ASSETS);
  for (const ref of assetRefs(indexHtml)) {
    if (!ref.path.startsWith('js/screens/') || declarados.has(ref.path)) continue;
    const committed = execFileSync('git', ['rev-parse', '2114191:' + ref.path], { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', ref.path], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(worktree, committed, ref.path + ' nao foi declarado pela A2 e deve seguir byte-identico a 2114191');
  }
});
