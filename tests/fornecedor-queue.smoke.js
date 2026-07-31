// tests/fornecedor-queue.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-B.1 — fila de aceite do fornecedor
// (db/103, secao 9.9.E).
//
// A fila e AUTORITATIVA: vem inteira de listar_fila_aceite_fornecedor, que ja
// resolve o fornecedor do usuario autenticado. Nenhuma consulta generica a
// ordem_compra a substitui ou complementa. Aceitar e rejeitar sao decisoes
// explicitas, com escritores canonicos distintos, e EMISSAO NAO E ACEITE.
//
// Transporte MOCKADO e ids sinteticos. Nenhuma conexao hospedada, nenhuma RPC
// de mutacao real.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FORN = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const fornSrc = fs.readFileSync(FORN, 'utf8');

function executavel(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const fornExec = executavel(fornSrc);

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
function findInput(root) {
  return flatten(root).find((n) => n && n.tagName === 'INPUT') || null;
}

// Sandbox minimo: carrega fornecedor.js com um supa cujo rpc e controlado.
function makeSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableCalls = [];
  const toasts = [];

  const sandbox = {
    console, setTimeout, clearTimeout, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Set, Date,
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

  sandbox.supa = {
    from(table) {
      tableCalls.push(table);
      const chain = new Proxy({}, { get: () => () => chain });
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
  sandbox.textInput = (o) => { const n = new FakeNode('input'); Object.assign(n, o || {}); n.value = (o && o.value) || ''; return n; };
  sandbox.toast = (msg, kind) => { toasts.push({ msg, kind }); };
  sandbox.CURRENT_USER = { nome: 'F', tipo: 'fornecedor', fornecedor_id: 1 };

  vm.createContext(sandbox);
  vm.runInContext(fornSrc, sandbox, { filename: 'js/screens/fornecedor.js' });
  return { sandbox, rpcCalls, tableCalls, toasts };
}

const ORDEM = {
  ordem_compra_id: 4242, codigo: 'OC-001-3-26', identidade_operacional: 'OC-001-3-26',
  fornecedor_id: 1, emitida_em: '2026-07-30T00:00:00Z', status_aceite: 'pendente',
  kg_total: 3769.8, itens: 4,
};

// Constroi uma linha da fila via a API interna exposta no sandbox.
function linha(sandbox, onDecidida) {
  return sandbox.RAVATEX_SCREENS.fornecedor.buildLinhaAceite(ORDEM, onDecidida);
}

test('0. fornecedor.js: sintaxe JS valida', () => {
  cp.execSync(`node --check "${FORN}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// A fila e autoritativa
// ---------------------------------------------------------------------

test('1. a fila e carregada SO por listar_fila_aceite_fornecedor', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeSandbox((fn) => {
    if (fn === 'listar_fila_aceite_fornecedor') return { data: [ORDEM], error: null };
    return { data: null, error: null };
  });
  const fila = await sandbox.RAVATEX_SCREENS.fornecedor.carregarFilaAceite();
  assert.equal(fila.error, null);
  assert.equal(fila.linhas.length, 1);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['listar_fila_aceite_fornecedor']);
  assert.deepEqual(tableCalls, [], 'nenhuma consulta por tabela pode alimentar a fila');
});

test('2. nenhuma consulta generica a ordem_compra substitui a fila', () => {
  assert.doesNotMatch(fornExec, /from\(\s*['"]ordem_compra['"]\s*\)/,
    'a fila nao pode ser montada a partir de uma leitura generica de ordem_compra');
  assert.doesNotMatch(fornExec, /from\(\s*['"]ordem_compra_item['"]\s*\)/);
  assert.match(fornExec, /rpc\('listar_fila_aceite_fornecedor'\)/);
});

test('3. um erro na fila NAO vira lista vazia silenciosa', async () => {
  const { sandbox } = makeSandbox(() => ({ data: null, error: new Error('boom') }));
  const fila = await sandbox.RAVATEX_SCREENS.fornecedor.carregarFilaAceite();
  assert.ok(fila.error, 'o erro tem de ser propagado');
  assert.equal(fila.linhas, null, 'indisponivel nao pode ser confundido com vazio');
});

test('4. a secao distingue INDISPONIVEL de VAZIA', () => {
  const { sandbox } = makeSandbox();
  const api = sandbox.RAVATEX_SCREENS.fornecedor;
  const erro = api.buildFilaAceiteSection({ linhas: null, error: new Error('x') }, null);
  assert.match(textOf(erro), /Nao foi possivel carregar|Não foi possível carregar/);
  const vazia = api.buildFilaAceiteSection({ linhas: [], error: null }, null);
  assert.match(textOf(vazia), /Nenhum Pedido de Compra aguardando/);
});

// ---------------------------------------------------------------------
// Emissao nao e aceite
// ---------------------------------------------------------------------

test('5. EMISSAO nao e tratada como aceite', () => {
  const { sandbox } = makeSandbox();
  const secao = sandbox.RAVATEX_SCREENS.fornecedor.buildFilaAceiteSection({ linhas: [ORDEM], error: null }, null);
  const txt = textOf(secao);
  assert.match(txt, /emitida/i, 'a data de emissao aparece como informacao');
  assert.match(txt, /ainda NAO esta aceita|ainda NÃO está aceita/,
    'a tela tem de dizer explicitamente que emitida nao e aceita');
  // Uma ordem emitida continua exigindo as DUAS acoes de decisao.
  assert.ok(findBtn(secao, /Aceitar/), 'a decisao de aceite continua explicita');
  assert.ok(findBtn(secao, /Rejeitar/), 'a decisao de rejeicao continua explicita');
});

test('6. o comportamento de EMISSAO nao e tocado por esta tela', () => {
  assert.doesNotMatch(fornExec, /emitir_ordem_compra/,
    'a fila de aceite nao pode emitir nem reemitir ordem nenhuma');
  assert.doesNotMatch(fornExec, /exige_aceite/,
    'nenhuma autoridade global de configuracao de aceite e adicionada aqui');
});

// ---------------------------------------------------------------------
// Decisoes: escritores distintos, motivo obrigatorio na rejeicao
// ---------------------------------------------------------------------

test('7. aceitar usa aceitar_ordem_compra', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true, status_aceite: 'aceita' }, error: null }));
  const node = linha(sandbox, null);
  await findBtn(node, /Aceitar/)._listeners.click();
  const escritas = rpcCalls.filter((c) => c.fn !== 'listar_fila_aceite_fornecedor');
  assert.deepEqual(escritas.map((c) => c.fn), ['aceitar_ordem_compra']);
  assert.equal(escritas[0].params.p_ordem_id, 4242);
  assert.ok(escritas[0].params.p_idempotency_key, 'a decisao carrega chave de idempotencia');
});

test('8. rejeitar usa rejeitar_ordem_compra — escritor DISTINTO', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true, status_aceite: 'rejeitada' }, error: null }));
  const node = linha(sandbox, null);
  findInput(node).value = 'fio fora de especificacao';
  await findBtn(node, /Rejeitar/)._listeners.click();
  const escritas = rpcCalls.filter((c) => c.fn !== 'listar_fila_aceite_fornecedor');
  assert.deepEqual(escritas.map((c) => c.fn), ['rejeitar_ordem_compra']);
  assert.equal(escritas[0].params.p_motivo, 'fio fora de especificacao');
});

test('9. rejeitar SEM motivo nao chama escritor nenhum', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const node = linha(sandbox, null);
  findInput(node).value = '   ';
  await findBtn(node, /Rejeitar/)._listeners.click();
  assert.equal(rpcCalls.length, 0, 'sem motivo NENHUM escritor pode ser chamado');
  assert.match(textOf(node), /Informe o motivo/, 'a recusa local tem de ser visivel');
});

// ---------------------------------------------------------------------
// Idempotencia e trava de pendencia
// ---------------------------------------------------------------------

test('10. uma chave estavel por INTENCAO: reenvio ambiguo reusa a chave', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: null, error: new Error('timeout') }));
  const node = linha(sandbox, null);
  const btn = findBtn(node, /Aceitar/);
  await btn._listeners.click();
  await btn._listeners.click();
  const escritas = rpcCalls.filter((c) => c.fn === 'aceitar_ordem_compra');
  assert.equal(escritas.length, 2);
  assert.equal(escritas[0].params.p_idempotency_key, escritas[1].params.p_idempotency_key,
    'a mesma intencao inalterada TEM de reusar a chave apos falha ambigua');
});

test('11. um desfecho DETERMINISTICO fecha a tentativa', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const node = linha(sandbox, null);
  const btn = findBtn(node, /Aceitar/);
  await btn._listeners.click();
  await btn._listeners.click();
  const escritas = rpcCalls.filter((c) => c.fn === 'aceitar_ordem_compra');
  assert.equal(escritas.length, 2);
  assert.notEqual(escritas[0].params.p_idempotency_key, escritas[1].params.p_idempotency_key,
    'apos sucesso, a proxima decisao nasce com chave nova');
});

test('12. clique repetido enquanto o comando esta pendente nao envia um segundo comando', async () => {
  let solta;
  const bloqueio = new Promise((r) => { solta = r; });
  const { sandbox, rpcCalls } = makeSandbox(() => bloqueio);
  const node = linha(sandbox, null);
  const btn = findBtn(node, /Aceitar/);
  const p1 = btn._listeners.click();
  const p2 = btn._listeners.click();          // enquanto o primeiro esta em voo
  assert.equal(btn.disabled, true, 'a acao tem de ficar desabilitada enquanto pendente');
  solta({ data: { ok: true }, error: null });
  await Promise.all([p1, p2]);
  assert.equal(rpcCalls.filter((c) => c.fn === 'aceitar_ordem_compra').length, 1,
    'um clique duplicado nao pode virar dois comandos');
});

// ---------------------------------------------------------------------
// Recusa visivel e recarga autoritativa
// ---------------------------------------------------------------------

test('13. um codigo de recusa do servidor aparece sem mascara', async () => {
  const { sandbox } = makeSandbox(() => ({ data: { ok: false, codigo: 'ACEITE_JA_DECIDIDO' }, error: null }));
  const node = linha(sandbox, null);
  await findBtn(node, /Aceitar/)._listeners.click();
  assert.match(textOf(node), /ACEITE_JA_DECIDIDO/, 'o codigo do servidor fica visivel');
});

test('14. sucesso dispara recarga AUTORITATIVA — a linha nao some localmente', async () => {
  let recarregou = 0;
  const { sandbox } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const node = linha(sandbox, function () { recarregou += 1; });
  await findBtn(node, /Aceitar/)._listeners.click();
  assert.equal(recarregou, 1, 'a decisao bem-sucedida tem de recarregar a fila do servidor');
  assert.doesNotMatch(fornExec, /\.splice\(|filaAceite\.linhas\s*=\s*filaAceite\.linhas\.filter/,
    'a linha decidida nao pode ser removida localmente');
});

test('15. a regiao de erro e acessivel e local a linha', () => {
  const { sandbox } = makeSandbox();
  const node = linha(sandbox, null);
  const alerta = flatten(node).find((n) => n.getAttribute && n.getAttribute('role') === 'alert');
  assert.ok(alerta, 'a linha precisa de uma regiao de alerta propria');
  assert.equal(alerta.getAttribute('aria-live'), 'assertive');
});

test('16. nenhum endpoint hospedado e contatado por este arquivo', () => {
  const meu = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
