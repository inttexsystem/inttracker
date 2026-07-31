// tests/expedicao-tapete-reversal-correction.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-B.4 e P2-B.5 — estorno parcial de
// expedicao Tapete e correcao de entrega (db/109).
//
// As duas acoes sao DISTINTAS e nao se confundem:
//   ESTORNO desfaz LIBERACAO e devolve metros a disponibilidade de produto
//   acabado. CORRECAO conserta quanto foi de fato ENTREGUE ao cliente e nao
//   devolve nada a producao — por isso ela pode fazer um Pedido incompleto e
//   nao cancelado voltar de `entregue` para `produzindo`, e a tela diz isso.
//
// Nenhuma das duas escreve `pedidos.status` nem saldo de estoque: quem
// recalcula e o servidor, dentro do mesmo comando.
//
// Transporte MOCKADO e ids sinteticos. Nenhuma conexao hospedada.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EA = path.join(ROOT, 'js', 'screens', 'expedicao-admin.js');
const eaSrc = fs.readFileSync(EA, 'utf8');

function executavel(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const eaExec = executavel(eaSrc);

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = []; this._text = null; this._listeners = {};
    this.style = {}; this.disabled = false; this.value = ''; this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
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
function flatten(node, acc) {
  acc = acc || [];
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flatten(c, acc));
  return acc;
}
function textOf(node) { return flatten(node).map((n) => (n && n.textContent) || '').join(' '); }
function findBtn(root, re) {
  return flatten(root).find((n) => n && n.tagName === 'BUTTON' && re.test(textOf(n))) || null;
}
function inputs(root) { return flatten(root).filter((n) => n && n.tagName === 'INPUT'); }
function painelPorMarcador(root, marcador) {
  return flatten(root).find((n) => n.getAttribute && n.getAttribute('data-rv-comando-tapete') === marcador) || null;
}

const EXPEDICAO = {
  id: 700, pedido_id: 'ped-1', op_latex_id: 44, op_tecelagem_id: null,
  lote_id: 5, cliente_id: 9, status: 'parcial',
  pedido: { id: 'ped-1', numero: 12 }, op: { id: 44, numero: 3, ano: 2026, tipo: 'latex' },
  lote: { id: 5, numero: 5 }, cliente: { id: 9, nome: 'Cliente' },
};
const ITENS = [
  { id: 801, expedicao_id: 700, modelo_id: 1, metros_liberados: 100, metros_entregues: 40,
    modelo: { id: 1, nome: 'Barcelona', largura: 2.10, cor_1: { id: 1, nome: 'PRETO' }, cor_2: { id: 2, nome: 'CRU' } } },
  { id: 802, expedicao_id: 700, modelo_id: 2, metros_liberados: 60, metros_entregues: 0,
    modelo: { id: 2, nome: 'Noite', largura: 2.10, cor_1: { id: 3, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } } },
];

// Sandbox que renderiza a tela real com leituras mockadas por tabela.
async function renderTela(rpcHandler) {
  const rpcCalls = [];
  const tableOps = [];
  const toasts = [];
  const sandbox = {
    console, setTimeout, clearTimeout, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Date,
    document: {
      createElement: (t) => new FakeNode(t),
      createTextNode: (t) => ({ textContent: t, children: [], appendChild() {}, setAttribute() {} }),
      querySelector: () => new FakeNode('div'),
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
      body: new FakeNode('body'),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  function dataFor(table) {
    if (table === 'expedicoes') return { data: EXPEDICAO, error: null };
    if (table === 'expedicao_itens') return { data: ITENS, error: null };
    if (table === 'lotes') return { data: [{ id: 5 }], error: null };
    if (table === 'ops') return { data: [], error: null };
    return { data: [], error: null };
  }
  sandbox.supa = {
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; },
        insert() { tableOps.push({ table, op: 'insert' }); return chain; },
        update() { tableOps.push({ table, op: 'update' }); return chain; },
        delete() { tableOps.push({ table, op: 'delete' }); return chain; },
        maybeSingle() { return Promise.resolve(dataFor(table)); },
        single() { return Promise.resolve(dataFor(table)); },
        then(res, rej) { return Promise.resolve(dataFor(table)).then(res, rej); },
      };
      return chain;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: { ok: true }, error: null });
    },
  };
  sandbox.el = function (tag, attrs) {
    const n = new FakeNode(tag);
    const rest = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'onclick') n._listeners.click = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    rest.flat().forEach((c) => {
      if (c == null || c === false || c === '') return;
      n.appendChild(typeof c === 'string' ? { textContent: c, children: [], appendChild() {}, setAttribute() {} } : c);
    });
    return n;
  };
  sandbox.textInput = (o) => { const n = new FakeNode('input'); n.value = (o && o.value) || ''; return n; };
  sandbox.selectInput = (o) => { const n = new FakeNode('select'); n.value = (o && o.value) || ''; return n; };
  sandbox.textArea = () => new FakeNode('textarea');
  sandbox.toast = (msg, kind) => { toasts.push({ msg, kind }); };
  sandbox.navigate = () => {};
  sandbox.shellLayout = (menu, node) => node;
  sandbox.ADMIN_MENU = [];
  sandbox.fmtMetros = (n) => Number(n || 0).toFixed(2).replace('.', ',') + ' m';
  sandbox.RAVATEX_OP_DISPLAY = { formatOpOperationalCode: () => 'OP-A044-1-26' };
  sandbox.RAVATEX_PRODUCT_ROUTE = {
    resolveExpedicaoSource: (e) => ({ opId: e.op_latex_id, column: 'op_latex_id', route: 'tapete', label: 'Acabamento (Tapete)' }),
  };

  vm.createContext(sandbox);
  vm.runInContext(eaSrc, sandbox, { filename: 'js/screens/expedicao-admin.js' });
  const root = await sandbox.screenExpedicaoAdmin(700);
  return { sandbox, root, rpcCalls, tableOps, toasts };
}

test('0. expedicao-admin.js: sintaxe JS valida', () => {
  cp.execSync(`node --check "${EA}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// Duas acoes distintas
// ---------------------------------------------------------------------

test('1. estorno e correcao sao CONTROLES distintos', async () => {
  const { root } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  const correcao = painelPorMarcador(root, 'correcao');
  assert.ok(estorno, 'o estorno Tapete tem de existir');
  assert.ok(correcao, 'a correcao de entrega tem de existir');
  assert.notEqual(estorno, correcao, 'sao dois controles distintos');
  assert.ok(findBtn(estorno, /Estornar expedicao/));
  assert.ok(findBtn(correcao, /Corrigir entrega/));
});

test('2. sao CAMINHOS DE COMANDO distintos', async () => {
  const { root, rpcCalls } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '10';
  inputs(estorno)[2].value = 'devolucao';   // ultimo input do bloco = motivo
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();

  const correcao = painelPorMarcador(root, 'correcao');
  inputs(correcao)[0].value = '30';
  inputs(correcao)[2].value = 'conferencia';
  await findBtn(correcao, /Corrigir entrega/)._listeners.click();

  const nomes = rpcCalls.map((c) => c.fn);
  assert.ok(nomes.includes('estornar_expedicao_tapete_parcial'));
  assert.ok(nomes.includes('corrigir_entrega_expedicao'));
});

test('3. a correcao NAO se apresenta como estorno', async () => {
  const { root } = await renderTela();
  const txt = textOf(painelPorMarcador(root, 'correcao'));
  assert.match(txt, /NAO e um estorno|NÃO é um estorno/i,
    'a correcao tem de dizer explicitamente que nao e estorno');
  assert.match(txt, /entregue/i);
});

test('4. a UI diz que um Pedido incompleto pode voltar de entregue para produzindo', async () => {
  const { root } = await renderTela();
  const txt = textOf(painelPorMarcador(root, 'correcao'));
  assert.match(txt, /volta de "entregue" para "produzindo"|volta de entregue para produzindo/i,
    'a consequencia real da correcao tem de ser dita, nao escondida');
});

// ---------------------------------------------------------------------
// Tetos visiveis ANTES da confirmacao
// ---------------------------------------------------------------------

test('5. o estorno mostra liberado, ja entregue e o maximo estornavel', async () => {
  const { root } = await renderTela();
  const txt = textOf(painelPorMarcador(root, 'estorno'));
  assert.match(txt, /Liberado: 100,00 m/);
  assert.match(txt, /Ja entregue: 40,00 m/);
  assert.match(txt, /Estorno maximo: 60,00 m/);
});

test('6. a correcao mostra o entregue atual e o intervalo valido 0..liberado', async () => {
  const { root } = await renderTela();
  const txt = textOf(painelPorMarcador(root, 'correcao'));
  assert.match(txt, /Entregue hoje: 40,00 m/);
  assert.match(txt, /Valido: 0 ate 100,00 m/);
});

// ---------------------------------------------------------------------
// Quantidades e motivo obrigatorios
// ---------------------------------------------------------------------

test('7. estorno sem motivo nao chama escritor', async () => {
  const { root, rpcCalls } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '10';
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
  assert.match(textOf(estorno), /Informe o motivo/);
});

test('8. estorno sem quantidade nenhuma nao chama escritor', async () => {
  const { root, rpcCalls } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[2].value = 'motivo';
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
  assert.match(textOf(estorno), /ao menos uma quantidade/i);
});

test('9. correcao sem motivo nao chama escritor', async () => {
  const { root, rpcCalls } = await renderTela();
  const correcao = painelPorMarcador(root, 'correcao');
  inputs(correcao)[0].value = '10';
  await findBtn(correcao, /Corrigir entrega/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
});

// ---------------------------------------------------------------------
// Tetos nao sao mascarados por copia generica
// ---------------------------------------------------------------------

test('10. estorno ACIMA do liberado e recusado nomeando o teto', async () => {
  const { root, rpcCalls } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '150';
  inputs(estorno)[2].value = 'motivo';
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
  const txt = textOf(estorno);
  assert.match(txt, /passa do liberado/i);
  assert.match(txt, /100,00 m/, 'o teto real aparece na recusa');
});

test('11. estorno que deixaria liberado ABAIXO do entregue e recusado', async () => {
  const { root, rpcCalls } = await renderTela();
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '80';   // 100 - 80 = 20 < 40 ja entregues
  inputs(estorno)[2].value = 'motivo';
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
  assert.match(textOf(estorno), /abaixo do ja entregue/i);
});

test('12. correcao acima do liberado e recusada nomeando o teto', async () => {
  const { root, rpcCalls } = await renderTela();
  const correcao = painelPorMarcador(root, 'correcao');
  inputs(correcao)[0].value = '120';
  inputs(correcao)[2].value = 'motivo';
  await findBtn(correcao, /Corrigir entrega/)._listeners.click();
  assert.equal(rpcCalls.length, 0);
  assert.match(textOf(correcao), /passa do liberado/i);
});

test('13. correcao para ZERO e valida (0 <= entregue <= liberado)', async () => {
  const { root, rpcCalls } = await renderTela();
  const correcao = painelPorMarcador(root, 'correcao');
  inputs(correcao)[0].value = '0';
  inputs(correcao)[2].value = 'devolucao total';
  await findBtn(correcao, /Corrigir entrega/)._listeners.click();
  const chamada = rpcCalls.find((c) => c.fn === 'corrigir_entrega_expedicao');
  assert.ok(chamada, 'zero e um valor valido de correcao');
  assert.equal(chamada.params.p_itens[0].metros_entregues, 0);
});

// ---------------------------------------------------------------------
// Idempotencia, trava e recusa visivel
// ---------------------------------------------------------------------

test('14. a chave sobrevive a um reenvio ambiguo da mesma intencao', async () => {
  const { root, rpcCalls } = await renderTela(() => ({ data: null, error: new Error('timeout') }));
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '10';
  inputs(estorno)[2].value = 'motivo';
  const btn = findBtn(estorno, /Estornar expedicao/);
  await btn._listeners.click();
  await btn._listeners.click();
  const cmds = rpcCalls.filter((c) => c.fn === 'estornar_expedicao_tapete_parcial');
  assert.equal(cmds.length, 2);
  assert.equal(cmds[0].params.p_idempotency_key, cmds[1].params.p_idempotency_key);
});

test('15. clique repetido pendente nao envia um segundo comando', async () => {
  let solta;
  const bloqueio = new Promise((r) => { solta = r; });
  const { root, rpcCalls } = await renderTela(() => bloqueio);
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '10';
  inputs(estorno)[2].value = 'motivo';
  const btn = findBtn(estorno, /Estornar expedicao/);
  const p1 = btn._listeners.click();
  const p2 = btn._listeners.click();
  assert.equal(btn.disabled, true);
  solta({ data: { ok: true }, error: null });
  await Promise.all([p1, p2]);
  assert.equal(rpcCalls.filter((c) => c.fn === 'estornar_expedicao_tapete_parcial').length, 1);
});

test('16. um codigo de recusa do servidor aparece sem mascara', async () => {
  const { root } = await renderTela(() => ({ data: { ok: false, codigo: 'ESTORNO_ACIMA_DO_LIBERADO' }, error: null }));
  const estorno = painelPorMarcador(root, 'estorno');
  inputs(estorno)[0].value = '10';
  inputs(estorno)[2].value = 'motivo';
  await findBtn(estorno, /Estornar expedicao/)._listeners.click();
  assert.match(textOf(estorno), /ESTORNO_ACIMA_DO_LIBERADO/);
});

test('17. sucesso dispara recarga AUTORITATIVA da expedicao', async () => {
  const { root, tableOps, rpcCalls } = await renderTela(() => ({ data: { ok: true }, error: null }));
  const antes = rpcCalls.length;
  const correcao = painelPorMarcador(root, 'correcao');
  inputs(correcao)[0].value = '30';
  inputs(correcao)[2].value = 'motivo';
  await findBtn(correcao, /Corrigir entrega/)._listeners.click();
  // A recarga rele expedicoes / expedicao_itens / movimentos do servidor.
  assert.ok(rpcCalls.length > antes);
  assert.equal(tableOps.filter((o) => o.op !== 'select').length, 0,
    'a recarga nao pode escrever nada');
});

// ---------------------------------------------------------------------
// Nenhuma DML direta de status ou estoque
// ---------------------------------------------------------------------

test('18. nenhum update direto em pedidos.status', () => {
  assert.doesNotMatch(eaExec, /from\(\s*['"]pedidos['"]\s*\)/,
    'a tela nunca escreve o Pedido diretamente');
  assert.doesNotMatch(eaExec, /status:\s*['"](entregue|produzindo)['"]/);
});

test('19. nenhum saldo de produto acabado e editado', () => {
  assert.doesNotMatch(eaExec, /saldo_fios|saldo_acabado|estoque_acabado/);
});

test('20. nenhuma DML substitui as RPCs de estorno/correcao', () => {
  assert.doesNotMatch(eaExec, /from\(\s*['"]expedicao_itens['"]\s*\)[\s\S]{0,120}\.(insert|update|delete)\(/);
  assert.doesNotMatch(eaExec, /from\(\s*['"]expedicoes['"]\s*\)[\s\S]{0,120}\.(insert|update|delete)\(/);
  assert.match(eaExec, /rpc\(conf\.rpc/, 'os dois comandos passam pelo mesmo caminho de RPC');
});

test('21. o painel Tapete nao aparece numa expedicao de rota Manta', () => {
  assert.match(eaExec, /src\.route !== 'tapete'/,
    'o painel Tapete e condicionado a rota Tapete');
  assert.match(eaExec, /src\.route !== 'manta'/,
    'o painel Manta continua condicionado a rota Manta');
});

test('22. nenhum endpoint hospedado e contatado por este arquivo', () => {
  const meu = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
