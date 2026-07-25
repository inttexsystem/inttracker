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
  assert.match(clienteTracking, /dtoByKey\[step\.key\]/,
    'as listas podem ter tamanhos diferentes entre rotas');
  assert.match(clienteTracking, /getClienteTrackingStepsForRoutes|applicableSteps/);
  assert.match(clienteTracking, /getClienteTrackingStepIndex/,
    'o estado da etapa continua comparado pelo indice canonico');
});
