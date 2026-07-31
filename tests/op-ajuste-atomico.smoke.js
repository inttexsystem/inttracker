// tests/op-ajuste-atomico.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A — ajuste de produção ATÔMICO e
// início de produção do SERVIDOR (§9.9.C e §9.9.D).
//
// Prova, com transporte Supabase MOCKADO e ids sintéticos (nenhuma conexão
// hospedada, nenhuma RPC de mutação real):
//
//   A. o payload de ajuste é ABSOLUTO e COMPLETO — todo op_item da OP entra;
//   B. um item inválido IMPEDE a chamada do escritor (nada é gravado);
//   C. revisão desatualizada trava o Salvar até uma recarga COMPLETA;
//   D. limpar o ajuste passa pelo MESMO escritor atômico (metros null);
//   E. iniciar produção exige status 'aberta';
//   F. uma OP 'simulada' NUNCA é aberta em silêncio;
//   G. a rota e o rótulo devolvidos pelo servidor são consumidos;
//   H. não resta nenhum DML direto de ajuste, status ou snapshot de saldo.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OPR  = path.join(ROOT, 'js', 'screens', 'op-recalculo.js');
const ODU  = path.join(ROOT, 'js', 'screens', 'op-distribuicao-ui.js');

const oprSrc = fs.readFileSync(OPR, 'utf8');
const oduSrc = fs.readFileSync(ODU, 'utf8');

// ---------------------------------------------------------------------
// Harness local (nada de infraestrutura compartilhada de teste)
// ---------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this._text = null;
    this._listeners = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, appendChild() {}, setAttribute() {} } : n);
    }
  }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function flatten(node, acc) {
  acc = acc || [];
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach(function (c) { flatten(c, acc); });
  return acc;
}

// Texto agregado de um nó e de toda a sua descendência: `el()` guarda os
// rótulos como nós-filho de texto, não em node.textContent.
function textOf(node) {
  return flatten(node).map(function (n) { return (n && n.textContent) || ''; }).join(' ');
}

function findBtn(root, re) {
  return flatten(root).find(function (n) {
    return n && n.tagName === 'BUTTON' && re.test(textOf(n));
  }) || null;
}

// Só as linhas EXECUTÁVEIS: uma proibição de mecanismo não pode ser
// satisfeita — nem violada — por um comentário que descreve o passado.
function executavel(src) {
  return src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');
}

// Sandbox com apenas o necessário: os dois módulos do P2-A, um `el` mínimo,
// um rangeInput mínimo e um `supa` cujo .rpc() é totalmente controlado.
function makeSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableCalls = [];
  const toasts = [];

  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };

  const sandbox = {
    document, setTimeout, clearTimeout, console, Math, Number, JSON, Object, Array, String, Boolean, Promise, Error,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  sandbox.supa = {
    // Qualquer acesso por tabela é REGISTRADO: os testes provam que o caminho
    // de ajuste/início não toca tabela nenhuma diretamente.
    from(table) {
      tableCalls.push(table);
      const chain = new Proxy({}, {
        get: () => () => chain,
      });
      return chain;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: null, error: null });
    },
  };

  sandbox.el = function (tag, attrs) {
    const n = new FakeNode(tag);
    const rest = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'onclick') n._listeners.click = attrs[k];
      else n.setAttribute(k, attrs[k]);
      if (k === 'style') n.style.cssText = attrs[k];
    });
    rest.flat().forEach(function (c) {
      if (c == null || c === false || c === '') return;
      n.appendChild(typeof c === 'string' ? { textContent: c, children: [], appendChild() {}, setAttribute() {} } : c);
    });
    return n;
  };
  sandbox.rangeInput = function (opts) {
    const n = new FakeNode('input');
    Object.keys(opts || {}).forEach(function (k) { n[k] = opts[k]; });
    n.max = opts.max; n.min = opts.min; n.value = opts.value;
    return n;
  };
  sandbox.toast = function (msg, kind) { toasts.push({ msg, kind }); };
  sandbox.fmtMetros = (n) => String(n) + ' m';
  sandbox.fmtKg = (n) => String(n) + ' kg';
  sandbox.rotuloModelo = (m) => (m && m.nome) || 'Modelo';
  sandbox.larguraKey = (l) => Number(l).toFixed(2);
  sandbox.calcularFiosOP = function (itens, modelosById, parametrosByLargura) {
    const algodaoPorCor = {}; const poliester = { PRETO: 0, BRANCO: 0 };
    itens.forEach(function (i) {
      const modelo = modelosById[i.modeloId]; if (!modelo) return;
      const p = parametrosByLargura[Number(modelo.largura).toFixed(2)]; if (!p) return;
      const kgAlg = p.algodao_por_ml * p.valor_x * Number(i.metros);
      [modelo.cor_1, modelo.cor_2].forEach(function (cor) {
        if (!algodaoPorCor[cor.id]) algodaoPorCor[cor.id] = { corId: cor.id, kg: 0 };
        algodaoPorCor[cor.id].kg += kgAlg;
      });
      const kgPol = p.poliester_por_ml * p.valor_x * Number(i.metros);
      poliester.PRETO += kgPol; poliester.BRANCO += kgPol;
    });
    return { algodaoPorCor, poliester };
  };

  vm.createContext(sandbox);
  vm.runInContext(oprSrc, sandbox, { filename: 'js/screens/op-recalculo.js' });
  vm.runInContext(oduSrc, sandbox, { filename: 'js/screens/op-distribuicao-ui.js' });

  return { sandbox, rpcCalls, tableCalls, toasts };
}

const MODELOS = {
  1: { id: 1, nome: 'A', largura: 2.10, cor_1: { id: 10, nome: 'PRETO' }, cor_2: { id: 10, nome: 'PRETO' } },
  2: { id: 2, nome: 'B', largura: 2.10, cor_1: { id: 11, nome: 'CRU' }, cor_2: { id: 11, nome: 'CRU' } },
};
const PARAMS = { '2.10': { algodao_por_ml: 0.1, poliester_por_ml: 0.05, valor_x: 1 } };

// Disponibilidade nativa folgada: os testes de payload não devem esbarrar em teto.
const DISPONIBILIDADE = [
  { necessidade_id: 1, origem_tipo: 'op', material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 100000 },
  { necessidade_id: 2, origem_tipo: 'op', material: 'algodao', cor_id: 11, cor_poliester: null, kg_disponivel: 100000 },
  { necessidade_id: 3, origem_tipo: 'pedido', material: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_disponivel: 100000 },
  { necessidade_id: 4, origem_tipo: 'pedido', material: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_disponivel: 100000 },
];

function opItens() {
  return [
    { id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 },
    { id: 101, modelo_id: 2, metros_pedidos: 60, metros_ajustados: 48 },
    { id: 102, modelo_id: 1, metros_pedidos: 20, metros_ajustados: 15 },
  ];
}

function buildBloco(sandbox, ctxOverrides) {
  const ctx = Object.assign({
    op: { id: 900001, status: 'aberta', ajuste_revisao: 7 },
    opItens: opItens(),
    disponibilidade: DISPONIBILIDADE,
    modelosById: MODELOS,
    parametrosByLargura: PARAMS,
    variant: 'full',
  }, ctxOverrides || {});
  return { node: sandbox.buildDistribuicaoBlock(ctx), ctx };
}

// ---------------------------------------------------------------------
// A. Payload absoluto e completo
// ---------------------------------------------------------------------

test('A1. salvar_ajuste_producao_op recebe TODOS os op_itens da OP, cada um uma vez', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true, ajuste_revisao: 8, itens_aplicados: 3 }, error: null }));
  const { node } = buildBloco(sandbox);

  const btn = findBtn(node, /Manter pedido/);
  assert.ok(btn, 'botão "Manter pedido" não encontrado');
  await btn._listeners.click();

  const chamada = rpcCalls.find((c) => c.fn === 'salvar_ajuste_producao_op');
  assert.ok(chamada, 'salvar_ajuste_producao_op não foi chamada');
  const ids = chamada.params.p_itens.map((i) => i.op_item_id).sort();
  assert.deepEqual(ids, [100, 101, 102], 'o payload não é o conjunto absoluto dos op_itens');
  assert.equal(chamada.params.p_itens.length, 3, 'o payload tem de ter exatamente um registro por item');
  assert.equal(new Set(ids).size, 3, 'nenhum item pode aparecer duas vezes no payload absoluto');
});

test('A2. o payload viaja com o ajuste_revisao base, e numa ÚNICA chamada', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true, ajuste_revisao: 8 }, error: null }));
  const { node } = buildBloco(sandbox, { ajusteRevisao: 7 });
  await findBtn(node, /Manter pedido/)._listeners.click();

  const salvas = rpcCalls.filter((c) => c.fn === 'salvar_ajuste_producao_op');
  assert.equal(salvas.length, 1, 'o salvamento tem de ser UMA chamada, não um laço por item');
  assert.equal(salvas[0].params.p_base_ajuste_rev, 7, 'p_base_ajuste_rev não foi submetido');
  assert.equal(salvas[0].params.p_op_id, 900001);
});

test('A3. nenhuma tabela é tocada diretamente no salvamento', async () => {
  const { sandbox, tableCalls } = makeSandbox(() => ({ data: { ok: true, ajuste_revisao: 8 }, error: null }));
  const { node } = buildBloco(sandbox);
  await findBtn(node, /Manter pedido/)._listeners.click();
  assert.deepEqual(tableCalls, [], 'o ajuste não pode fazer DML direto em tabela nenhuma');
});

// ---------------------------------------------------------------------
// B. Um item inválido impede a chamada do escritor
// ---------------------------------------------------------------------

test('B1. um item que excede o teto nativo IMPEDE a chamada do escritor', async () => {
  const { sandbox, rpcCalls, toasts } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  // Teto de algodão cor 10 apertado: "Manter pedido" (50+20 m no modelo 1)
  // consome 7 kg e só há 1 kg.
  const disponibilidadeApertada = [
    { material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 1 },
    { material: 'algodao', cor_id: 11, cor_poliester: null, kg_disponivel: 100000 },
    { material: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_disponivel: 100000 },
    { material: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_disponivel: 100000 },
  ];
  const { node } = buildBloco(sandbox, { disponibilidade: disponibilidadeApertada });

  const btn = findBtn(node, /Manter pedido/);
  await btn._listeners.click();

  assert.equal(rpcCalls.filter((c) => c.fn === 'salvar_ajuste_producao_op').length, 0,
    'com um item inválido o escritor NÃO pode ser chamado');
  assert.ok(toasts.some((t) => t.kind === 'error'), 'o operador tem de ser avisado do excesso');
});

test('B2. a recusa é por PAYLOAD INTEIRO: nenhum item parcial é gravado antes', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const { node } = buildBloco(sandbox, {
    disponibilidade: [{ material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 0 }],
  });
  await findBtn(node, /Manter pedido/)._listeners.click();
  assert.equal(rpcCalls.length, 0, 'nenhuma RPC pode partir');
  assert.deepEqual(tableCalls, [], 'nenhuma escrita parcial por item pode existir');
});

// ---------------------------------------------------------------------
// C. Revisão desatualizada
// ---------------------------------------------------------------------

test('C1. AJUSTE_REVISAO_DESATUALIZADA mostra o conflito canônico e trava o Salvar', async () => {
  const { sandbox } = makeSandbox(() => ({
    data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA', ajuste_revisao_atual: 9 }, error: null,
  }));
  const { node } = buildBloco(sandbox, { onRecarregar: async () => true });

  const btnManter = findBtn(node, /Manter pedido/);
  await btnManter._listeners.click();

  assert.match(textOf(node), /ajustada em outra sessão/i, 'o estado de conflito canônico tem de aparecer');
  assert.match(textOf(node), /Nada foi gravado/i, 'o conflito tem de dizer que nada foi gravado');
  assert.ok(findBtn(node, /Recarregar dados/), 'o conflito tem de oferecer "Recarregar dados"');

  assert.equal(findBtn(node, /Salvar distribui/).disabled, true, 'Salvar tem de ficar travado no conflito');
  assert.equal(findBtn(node, /Manter pedido/).disabled, true, 'Manter pedido tem de ficar travado no conflito');
});

test('C2. no conflito, uma nova tentativa de salvar NÃO chama o escritor', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({
    data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA' }, error: null,
  }));
  const { node } = buildBloco(sandbox, { onRecarregar: async () => true });
  const btn = findBtn(node, /Manter pedido/);
  await btn._listeners.click();
  const depoisDoConflito = rpcCalls.length;
  await btn._listeners.click();
  assert.equal(rpcCalls.length, depoisDoConflito,
    'sem recarga completa, o Salvar não pode voltar a chamar o escritor');
});

test('C3. "Recarregar dados" delega ao dono da recarga COMPLETA (sem retry automático)', async () => {
  let recarregou = 0;
  const { sandbox, rpcCalls } = makeSandbox(() => ({
    data: { ok: false, codigo: 'AJUSTE_REVISAO_DESATUALIZADA' }, error: null,
  }));
  const { node } = buildBloco(sandbox, { onRecarregar: async () => { recarregou += 1; return true; } });
  await findBtn(node, /Manter pedido/)._listeners.click();

  const antes = rpcCalls.length;
  await findBtn(node, /Recarregar dados/)._listeners.click();
  assert.equal(recarregou, 1, 'o botão tem de acionar a recarga do chamador');
  assert.equal(rpcCalls.filter((c) => c.fn === 'salvar_ajuste_producao_op').length, antes,
    'recarregar NÃO pode retentar o salvamento automaticamente');
});

test('C4. o conflito é um estado explícito, e não há retry automático no código', () => {
  assert.match(oduSrc, /conflitoRevisao\s*=\s*true/, 'o conflito tem de ser um estado explícito');
  // Uma nova tentativa só pode nascer de uma ação do operador: nenhum
  // temporizador nem repetição automática pode reenviar o ajuste sozinho.
  assert.doesNotMatch(executavel(oduSrc), /setTimeout|setInterval|retry/i,
    'o dono compartilhado não pode reenviar o ajuste automaticamente');
});

// ---------------------------------------------------------------------
// D. Limpeza pelo mesmo escritor
// ---------------------------------------------------------------------

test('D1. limpar o ajuste usa o MESMO escritor atômico, com metros null em todos os itens', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeSandbox(() => ({ data: { ok: true, ajuste_revisao: 8 }, error: null }));
  const { node } = buildBloco(sandbox);

  const btn = findBtn(node, /Limpar ajuste/);
  assert.ok(btn, 'a ação de limpar ajuste não existe');
  await btn._listeners.click();

  const chamada = rpcCalls.find((c) => c.fn === 'salvar_ajuste_producao_op');
  assert.ok(chamada, 'a limpeza tem de passar por salvar_ajuste_producao_op');
  assert.equal(chamada.params.p_itens.length, 3, 'a limpeza também é um payload ABSOLUTO');
  assert.ok(chamada.params.p_itens.every((i) => i.metros_ajustados === null),
    'todo item tem de viajar com metros_ajustados null');
  assert.deepEqual(tableCalls, [], 'a limpeza não pode virar delete/update direto');
});

test('D2. sem ajuste salvo não há o que limpar', () => {
  const { sandbox } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const itens = opItens().map((i) => Object.assign({}, i, { metros_ajustados: null }));
  const { node } = buildBloco(sandbox, { opItens: itens });
  assert.equal(findBtn(node, /Limpar ajuste/).disabled, true);
});

// ---------------------------------------------------------------------
// E/F. Início de produção
// ---------------------------------------------------------------------

function buildBotaoIniciar(sandbox, over) {
  return sandbox.buildIniciarProducaoButton(Object.assign({
    op: { id: 900001, status: 'aberta', ajuste_revisao: 7 },
    opItens: opItens(),
    disponibilidade: DISPONIBILIDADE,
    modelosById: MODELOS,
    parametrosByLargura: PARAMS,
    styleEnabled: 'enabled', styleDisabled: 'disabled',
  }, over || {}));
}

test('E1. início de produção habilita com a OP ABERTA e ajuste completo salvo', () => {
  const { sandbox } = makeSandbox();
  assert.equal(buildBotaoIniciar(sandbox).disabled, false);
});

test('E2. uma OP SIMULADA nunca é aberta em silêncio — o botão fica desabilitado e explica', () => {
  const { sandbox } = makeSandbox();
  const btn = buildBotaoIniciar(sandbox, { op: { id: 900001, status: 'simulada', ajuste_revisao: 0 } });
  assert.equal(btn.disabled, true, 'com a OP simulada o início tem de ficar bloqueado');
  assert.match(btn.getAttribute('title') || '', /simulada/i, 'o motivo tem de nomear o estado simulada');
});

test('E3. nenhum estado além de "aberta" habilita o início', () => {
  const { sandbox } = makeSandbox();
  ['simulada', 'em_producao', 'pausada', 'concluida', 'cancelada', null].forEach((status) => {
    const btn = buildBotaoIniciar(sandbox, { op: { id: 900001, status, ajuste_revisao: 7 } });
    assert.equal(btn.disabled, true, 'status ' + status + ' não pode habilitar o início');
  });
});

test('E4. ajuste incompleto bloqueia o início mesmo com a OP aberta', () => {
  const { sandbox } = makeSandbox();
  const itens = opItens(); itens[1].metros_ajustados = null;
  assert.equal(buildBotaoIniciar(sandbox, { opItens: itens }).disabled, true);
});

test('F1. o clique chama iniciar_producao_op com a revisão base, e nada mais', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeSandbox(() => ({
    data: { ok: true, ajuste_revisao: 8, proxima_acao: { rota: '#/ops/900001', rotulo: 'Acompanhar producao' } }, error: null,
  }));
  const btn = buildBotaoIniciar(sandbox, { onIniciado: async () => {} });
  await btn._listeners.click();

  const chamadas = rpcCalls.filter((c) => c.fn === 'iniciar_producao_op');
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].params.p_op_id, 900001);
  assert.equal(chamadas[0].params.p_base_ajuste_rev, 7);
  assert.equal(rpcCalls.length, 1, 'o início não pode disparar nenhuma outra RPC');
  assert.deepEqual(tableCalls, [], 'o início não pode gravar saldo nem status diretamente');
});

test('G1. a tela consome a rota e o rótulo devolvidos pelo SERVIDOR', async () => {
  const recebido = [];
  const { sandbox } = makeSandbox(() => ({
    data: { ok: true, proxima_acao: { rota: '#/pedidos/abc-123/producao', rotulo: 'Revisar producao' } }, error: null,
  }));
  const btn = buildBotaoIniciar(sandbox, { onIniciado: async (proximaAcao) => { recebido.push(proximaAcao); } });
  await btn._listeners.click();

  assert.equal(recebido.length, 1, 'onIniciado tem de receber a próxima ação');
  assert.equal(recebido[0].rota, '#/pedidos/abc-123/producao', 'a ROTA do servidor tem de ser repassada');
  assert.equal(recebido[0].rotulo, 'Revisar producao', 'o RÓTULO do servidor tem de ser repassado');
});

test('G2. INICIO_OP_ESTADO_INVALIDO do servidor não é engolido', async () => {
  const { sandbox, toasts } = makeSandbox(() => ({
    data: { ok: false, codigo: 'INICIO_OP_ESTADO_INVALIDO', status: 'simulada' }, error: null,
  }));
  let continuou = false;
  const btn = buildBotaoIniciar(sandbox, { onIniciado: async () => { continuou = true; } });
  await btn._listeners.click();
  assert.equal(continuou, false, 'a continuação não pode rodar depois de uma recusa');
  assert.ok(toasts.some((t) => t.kind === 'error' && /aberta/i.test(t.msg)));
});

// ---------------------------------------------------------------------
// H. Nada de DML direto sobrou
// ---------------------------------------------------------------------

test('H1. op-recalculo.js não faz mais NENHUM DML direto', () => {
  const exec = executavel(oprSrc);
  assert.doesNotMatch(exec, /from\(\s*['"]op_itens['"]\s*\)/, 'não pode restar update direto em op_itens');
  assert.doesNotMatch(exec, /from\(\s*['"]saldo_fios_op['"]\s*\)/, 'não pode restar insert direto em saldo_fios_op');
  assert.doesNotMatch(exec, /from\(\s*['"]saldo_fios['"]\s*\)/, 'não pode restar escrita direta em saldo_fios');
  assert.doesNotMatch(exec, /from\(\s*['"]ops['"]\s*\)/, 'não pode restar update direto em ops');
  assert.doesNotMatch(exec, /em_producao/, 'a transição de status é do servidor, não desta tela');
});

test('H2. os mecanismos aposentados sumiram de op-recalculo.js', () => {
  assert.doesNotMatch(oprSrc, /function\s+snapshotSaldoEIniciarProducao/, 'snapshotSaldoEIniciarProducao tem de estar aposentado');
  assert.doesNotMatch(oprSrc, /function\s+aplicarRecalculoOP/, 'aplicarRecalculoOP tem de estar aposentado');
  assert.doesNotMatch(oprSrc, /function\s+normalizarChaveSaldo/, 'normalizarChaveSaldo era só chave de saldo_fios');
  assert.doesNotMatch(executavel(oprSrc), /partial\s*:/, 'a semântica de sucesso PARCIAL tem de sumir');
});

test('H3. o dono compartilhado não faz DML direto de ajuste, status ou saldo', () => {
  assert.doesNotMatch(oduSrc, /from\(\s*['"]op_itens['"]\s*\)/);
  assert.doesNotMatch(oduSrc, /from\(\s*['"]ops['"]\s*\)/);
  assert.doesNotMatch(oduSrc, /from\(\s*['"]saldo_fios(_op)?['"]\s*\)/);
});

test('H4. nenhum caminho ativo do P2-A lê ordens_compra_fio', () => {
  const executavel = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.doesNotMatch(executavel(oprSrc), /ordens_compra_fio/, 'op-recalculo.js não pode ler o modelo plano');
  assert.doesNotMatch(executavel(oduSrc), /ordens_compra_fio/, 'o dono compartilhado não pode ler o modelo plano');
});

test('H5. os escritores canônicos são exatamente os do P2-A', () => {
  assert.match(oprSrc, /rpc\('oc_disponibilidade_op'/, 'a disponibilidade tem de vir da projeção nativa');
  assert.match(oprSrc, /rpc\('salvar_ajuste_producao_op'/, 'o ajuste tem de ser do escritor atômico');
  assert.match(oprSrc, /rpc\('iniciar_producao_op'/, 'o início tem de ser do escritor do servidor');
});

test('H6. sintaxe válida dos dois módulos', () => {
  cp.execSync(`node --check "${OPR}"`, { stdio: 'pipe' });
  cp.execSync(`node --check "${ODU}"`, { stdio: 'pipe' });
});
