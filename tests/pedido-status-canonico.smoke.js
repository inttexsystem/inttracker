// tests/pedido-status-canonico.smoke.js
//
// P2-C — transicoes de status e cancelamento do Pedido pelos escritores
// canonicos (db/105, secao 9.9.L). Transporte MOCKADO, ids sinteticos.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const src = fs.readFileSync(PDE, 'utf8');
const exec = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('0. sintaxe JS valida', () => { cp.execSync(`node --check "${PDE}"`, { stdio: 'pipe' }); });

test('1. transicoes usam SO alterar_status_pedido', () => {
  assert.match(exec, /rpc\('alterar_status_pedido'/);
});

test('2. cancelamento usa o portao de elegibilidade e o escritor D7', () => {
  assert.match(exec, /rpc\('pedido_elegivel_cancelamento'/);
  assert.match(exec, /rpc\('cancelar_pedido'/);
});

test('3. NENHUM update direto de pedidos.status resta', () => {
  assert.doesNotMatch(exec, /from\(\s*['"]pedidos['"]\s*\)[\s\S]{0,200}update\(\s*\{\s*status:/,
    'o status do Pedido e do servidor');
  assert.doesNotMatch(exec, /update\(\s*\{\s*status:\s*novoStatus/,
    'o UPDATE direto de status foi retirado');
});

test('4. a revisao e preservada e submetida nos dois escritores', () => {
  assert.match(exec, /function revisaoBase/);
  assert.match(exec, /p_base_revisao:\s*revisaoBase\(\)/);
  assert.equal((exec.match(/p_base_revisao:\s*revisaoBase\(\)/g) || []).length, 2,
    'status e cancelamento submetem a revisao');
});

test('5. so as transicoes do contrato do servidor sao oferecidas', () => {
  assert.match(exec, /TRANSICOES_CANONICAS\s*=\s*\{\s*rascunho:\s*\['recebido'\],\s*recebido:\s*\['confirmado'\]\s*\}/);
  assert.match(exec, /var actions = transicoesOferecidas\(/,
    'a lista renderizada vem do contrato canonico, nao do mapa local mais largo');
});

test('6. transicoes DERIVADAS nunca sao enviadas', () => {
  for (const derivada of ['produzindo', 'entregue']) {
    assert.doesNotMatch(exec, new RegExp("p_novo_status:\\s*'" + derivada + "'"),
      derivada + ' e transicao derivada do servidor');
  }
});

test('7. entregue -> cancelado NAO e oferecido como acao direta', () => {
  assert.match(exec, /statusAtual !== 'cancelado' && statusAtual !== 'entregue'/,
    'um Pedido entregue nao recebe a acao de cancelar');
});

test('8. cancelamento exige motivo nao vazio', () => {
  assert.match(exec, /Informe o motivo do cancelamento/);
  assert.match(exec, /if \(!motivo\)/);
});

test('9. erro de elegibilidade e DISTINTO de inelegivel', () => {
  assert.match(exec, /Nao foi possivel verificar se este Pedido pode ser cancelado/,
    'falha de leitura tem mensagem propria');
  assert.match(exec, /Este Pedido nao pode ser cancelado/,
    'inelegibilidade tem mensagem propria');
  assert.match(exec, /g\.elegivel !== true/);
});

test('10. revisao desatualizada pede recarga explicita, sem retry nem merge', () => {
  assert.match(exec, /PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA/);
  assert.match(src, /Recarregue os dados e refaca a acao/);
  assert.doesNotMatch(exec, /setTimeout|setInterval/,
    'nenhuma retentativa automatica');
});

test('11. sucesso recarrega autoritativamente', () => {
  assert.match(exec, /await reload\(\);[\s\S]{0,40}render\(\);/);
});

test('12. codigos de recusa ficam visiveis', () => {
  assert.match(exec, /Mudanca de status recusada: ' \+ \(data\.codigo/);
  assert.match(exec, /Cancelamento recusado: ' \+ \(data\.codigo/);
});

test('13. nenhum parametro de idempotencia e inventado', () => {
  // Nenhuma das duas RPCs aceita chave na assinatura de db/105.
  const bloco = (exec.match(/rpc\('alterar_status_pedido'[\s\S]{0,300}\)/) || [''])[0]
    + (exec.match(/rpc\('cancelar_pedido'[\s\S]{0,300}\)/) || [''])[0];
  assert.doesNotMatch(bloco, /idempotency/i,
    'nao se inventa parametro ausente do contrato');
});

test('14. nenhum endpoint hospedado', () => {
  assert.doesNotMatch(fs.readFileSync(__filename, 'utf8'), /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});

// =====================================================================
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-STABILIZATION-R1 — defeito D-1
//
// A recusa de uma transicao tem de ficar NA superficie que a levantou. As
// provas abaixo sao COMPORTAMENTAIS: a tela real roda num sandbox com
// transporte mockado e o modal e conduzido por cliques de verdade, em vez de
// afirmar a correcao por casamento de texto no fonte.
// =====================================================================

const vm = require('node:vm');

class FakeNode {
  constructor(t) {
    this.tagName = String(t).toUpperCase();
    this.children = []; this._text = null; this._attrs = {}; this._listeners = {};
    this.style = {}; this.disabled = false; this.value = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'style') this.style.cssText = v; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { this._listeners[t] = fn; }
  removeEventListener(t) { delete this._listeners[t]; }
  focus() { this._focused = true; }
  replaceChildren() {
    this.children = [];
    for (const n of Array.prototype.slice.call(arguments).flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, children: [] } : n);
    }
  }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}
const flatten = (n, acc = []) => { if (!n) return acc; acc.push(n); (n.children || []).forEach((c) => flatten(c, acc)); return acc; };
const textOf = (n) => flatten(n).map((x) => (x && x.textContent) || '').join(' ');
const buttonNamed = (n, re) => flatten(n).find((x) => x.tagName === 'BUTTON' && re.test(textOf(x)));
const alertaDe = (m) => flatten(m.body).find((n) => n.getAttribute && n.getAttribute('role') === 'alert'
  && (n.textContent || '').trim().length > 0);
const tick = () => new Promise((r) => setImmediate(r));

// O fake de `modal()` reproduz o contrato REAL de js/ui.js, e o teste D1/1
// prova que esse contrato continua sendo o de la.
function abrirPedidoDetail({ pedido, rpc }) {
  const rpcCalls = []; const tableOps = []; const toasts = []; const modais = [];
  const sandbox = {
    console: { error() {}, warn() {}, log() {} },
    Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Date, Set, Map,
    document: {
      createElement: (t) => new FakeNode(t),
      createTextNode: (t) => ({ textContent: t, children: [] }),
      querySelector: () => new FakeNode('div'),
      querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
      body: new FakeNode('body'),
    },
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.el = function (tag, attrs) {
    const n = new FakeNode(tag);
    const rest = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'onclick') n._listeners.click = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    rest.flat().forEach((c) => {
      if (c == null || c === false || c === '') return;
      n.appendChild(typeof c === 'string' ? { textContent: c, children: [] } : c);
    });
    return n;
  };
  sandbox.textInput = (o) => { const n = new FakeNode('input'); n.value = (o && o.value) || ''; return n; };
  sandbox.selectInput = () => new FakeNode('select');
  sandbox.textArea = () => new FakeNode('textarea');
  sandbox.formField = (o) => { const w = new FakeNode('div'); w.appendChild(o.input); return w; };
  sandbox.toast = (msg, kind) => { toasts.push({ msg, kind }); };
  sandbox.navigate = () => {};
  sandbox.pedidoStatusLabel = (s) => s;
  sandbox.modal = function (conf) {
    const registro = { conf, aberto: true, body: conf.body };
    registro.close = function () {
      if (!registro.aberto) return;
      registro.aberto = false;
      if (typeof conf.onClose === 'function') conf.onClose();
    };
    registro.save = async function () {
      const r = await conf.onSave();
      if (r !== false) registro.close();
      return r;
    };
    modais.push(registro);
    return { close: registro.close };
  };
  sandbox.supa = {
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; },
        insert() { tableOps.push({ table, op: 'insert' }); return chain; },
        update() { tableOps.push({ table, op: 'update' }); return chain; },
        delete() { tableOps.push({ table, op: 'delete' }); return chain; },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej),
      };
      return chain;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpc ? rpc(fn, params) : { data: { ok: true }, error: null });
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'js/screens/pedido-detail-events.js' });
  let recargas = 0;
  const api = sandbox.RAVATEX_SCREENS.pedidoDetail.createPedidoDetailEvents({
    pedidoId: '11111111-2222-4333-8444-555555555555',
    state: { pedido, ops: [], itens: [], parciais: [], entregasById: {}, ordensFio: [] },
    reload: async function () { recargas += 1; },
    render: function () {},
  });
  return { api, modais, rpcCalls, tableOps, toasts, recargas: () => recargas };
}

const PEDIDO_CONFIRMADO = { id: '11111111-2222-4333-8444-555555555555', numero: 4242, status: 'confirmado', revisao: 3 };
const PEDIDO_RECEBIDO = { id: '11111111-2222-4333-8444-555555555555', numero: 4242, status: 'recebido', revisao: 3 };

test('D1/1. o contrato de window.modal() que este teste imita continua sendo o real', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
  assert.match(ui, /function modal\(\{[^}]*onClose[^}]*\}\)/, 'o primitivo aceita onClose');
  assert.match(ui, /if \(result !== false\) close\(\);/, 'onSave que devolve false NAO fecha');
  assert.match(ui, /function close\(\)\s*\{[\s\S]{0,200}if \(onClose\) onClose\(\);/, 'close\(\) chama onClose');
  assert.match(ui, /return \{ close \};/, 'o primitivo devolve { close }');
});

test('D1/2. o fechamento incondicional foi retirado', () => {
  assert.doesNotMatch(exec, /await alterarStatus\([^)]*\);\s*modalRef\.close\(\);/,
    'a superficie nao pode fechar sem saber o desfecho');
  assert.match(exec, /if \(r && r\.ok === true\) \{ modalRef\.close\(\); return; \}/,
    'a superficie so fecha com sucesso EXPLICITO');
});

test('D1/3. cancelamento INELEGIVEL mantem o modal de acoes montado, com o motivo dentro dele', async () => {
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: (fn) => fn === 'pedido_elegivel_cancelamento'
      ? { data: { elegivel: false, codigo: 'PEDIDO_COM_EXPEDICAO_ENTREGUE' }, error: null }
      : { data: { ok: true }, error: null },
  });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  const btn = buttonNamed(acoes.body, /Cancelar pedido/);
  assert.ok(btn, 'a acao de cancelar esta oferecida');
  await btn._listeners.click();

  assert.equal(acoes.aberto, true, 'o modal de acoes CONTINUA montado apos a recusa');
  assert.equal(h.modais.length, 1, 'nenhum modal de cancelamento foi aberto');
  const alerta = alertaDe(acoes);
  assert.ok(alerta, 'a recusa tem um dono de erro DENTRO do modal de origem');
  assert.match(alerta.textContent, /PEDIDO_COM_EXPEDICAO_ENTREGUE/, 'o codigo exato do servidor fica visivel');
  assert.equal(alerta.getAttribute('role'), 'alert');
  assert.equal(alerta.getAttribute('aria-live'), 'assertive');
  assert.equal(alerta.style.display, 'block', 'o alerta e persistente, nao transitorio');
  assert.equal(btn.disabled, false, 'a acao volta a ficar disponivel depois da recusa determinstica');
  assert.deepEqual(h.toasts, [], 'nenhum toast e o dono unico do erro');
  assert.deepEqual(h.tableOps, [], 'nenhum DML direto de Pedido foi introduzido');
  assert.equal(h.rpcCalls.filter((c) => c.fn === 'cancelar_pedido').length, 0, 'o escritor nao foi chamado');
});

test('D1/4. ERRO de transporte no portao tambem mantem o modal montado', async () => {
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: (fn) => fn === 'pedido_elegivel_cancelamento'
      ? { data: null, error: { message: 'transporte sintetico' } }
      : { data: { ok: true }, error: null },
  });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  await buttonNamed(acoes.body, /Cancelar pedido/)._listeners.click();
  assert.equal(acoes.aberto, true);
  assert.match(alertaDe(acoes).textContent, /Nao foi possivel verificar se este Pedido pode ser cancelado/);
});

test('D1/5. REVISAO DESATUALIZADA no cancelamento mantem as duas superficies abertas', async () => {
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: (fn) => {
      if (fn === 'pedido_elegivel_cancelamento') return { data: { elegivel: true }, error: null };
      if (fn === 'cancelar_pedido') return { data: { ok: false, codigo: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA' }, error: null };
      return { data: { ok: true }, error: null };
    },
  });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  buttonNamed(acoes.body, /Cancelar pedido/)._listeners.click();
  await tick();
  const cancelamento = h.modais[1];
  assert.ok(cancelamento, 'o modal de cancelamento abriu');

  flatten(cancelamento.body).find((n) => n.tagName === 'INPUT').value = 'motivo sintetico';
  await cancelamento.save();

  assert.equal(cancelamento.aberto, true, 'o modal de cancelamento continua aberto');
  assert.equal(acoes.aberto, true, 'o modal de acoes tambem continua montado');
  assert.match(alertaDe(cancelamento).textContent, /Recarregue os dados e refaca a acao/);
  assert.equal(h.recargas(), 0, 'nada foi recarregado, porque nada foi gravado');
});

test('D1/6. motivo vazio nao chama escritor nenhum e o modal permanece', async () => {
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: (fn) => fn === 'pedido_elegivel_cancelamento' ? { data: { elegivel: true }, error: null } : { data: { ok: true }, error: null },
  });
  h.api.openStatusActions();
  buttonNamed(h.modais[0].body, /Cancelar pedido/)._listeners.click();
  await tick();
  const cancelamento = h.modais[1];
  await cancelamento.save();
  assert.equal(cancelamento.aberto, true);
  assert.match(alertaDe(cancelamento).textContent, /Informe o motivo do cancelamento/);
  assert.equal(h.rpcCalls.filter((c) => c.fn === 'cancelar_pedido').length, 0);
});

test('D1/7. SUCESSO fecha as duas superficies, e so depois da recarga autoritativa', async () => {
  const ordem = [];
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: (fn) => {
      ordem.push(fn);
      if (fn === 'pedido_elegivel_cancelamento') return { data: { elegivel: true }, error: null };
      return { data: { ok: true }, error: null };
    },
  });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  buttonNamed(acoes.body, /Cancelar pedido/)._listeners.click();
  await tick();
  const cancelamento = h.modais[1];
  flatten(cancelamento.body).find((n) => n.tagName === 'INPUT').value = 'motivo sintetico';
  await cancelamento.save();
  await tick();

  assert.equal(cancelamento.aberto, false, 'o modal de cancelamento fechou');
  assert.equal(acoes.aberto, false, 'o modal de acoes fechou');
  assert.equal(h.recargas(), 1, 'a recarga autoritativa aconteceu');
  assert.deepEqual(ordem, ['pedido_elegivel_cancelamento', 'cancelar_pedido']);
  assert.deepEqual(h.toasts.map((t) => t.kind), ['success']);
});

test('D1/8. transicao NAO-cancelamento recusada mantem o modal e mostra o codigo dentro dele', async () => {
  const h = abrirPedidoDetail({
    pedido: PEDIDO_RECEBIDO,
    rpc: (fn) => fn === 'alterar_status_pedido'
      ? { data: { ok: false, codigo: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA' }, error: null }
      : { data: { ok: true }, error: null },
  });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  const btn = buttonNamed(acoes.body, /confirmado/);
  assert.ok(btn, 'a transicao canonica recebido -> confirmado esta oferecida');
  await btn._listeners.click();
  assert.equal(acoes.aberto, true, 'a superficie sobrevive a recusa');
  assert.match(alertaDe(acoes).textContent, /Recarregue os dados e refaca a acao/);
  assert.equal(btn.disabled, false, 'a acao volta a ficar disponivel');
});

test('D1/9. transicao NAO-cancelamento bem sucedida fecha a superficie', async () => {
  const h = abrirPedidoDetail({ pedido: PEDIDO_RECEBIDO, rpc: () => ({ data: { ok: true }, error: null }) });
  h.api.openStatusActions();
  const acoes = h.modais[0];
  await buttonNamed(acoes.body, /confirmado/)._listeners.click();
  assert.equal(acoes.aberto, false);
  assert.equal(h.recargas(), 1);
});

test('D1/10. um segundo clique so e possivel depois que a recusa determinstica termina', async () => {
  let liberar;
  const espera = new Promise((r) => { liberar = r; });
  const h = abrirPedidoDetail({
    pedido: PEDIDO_CONFIRMADO,
    rpc: async (fn) => {
      if (fn === 'pedido_elegivel_cancelamento') {
        await espera;
        return { data: { elegivel: false, codigo: 'PEDIDO_COM_EXPEDICAO_ENTREGUE' }, error: null };
      }
      return { data: { ok: true }, error: null };
    },
  });
  h.api.openStatusActions();
  const btn = buttonNamed(h.modais[0].body, /Cancelar pedido/);
  const primeiro = btn._listeners.click();
  await tick();
  await btn._listeners.click();                    // clique repetido EM VOO
  assert.equal(h.rpcCalls.filter((c) => c.fn === 'pedido_elegivel_cancelamento').length, 1,
    'o clique repetido nao virou um segundo comando');
  liberar();
  await primeiro;
  await btn._listeners.click();                    // agora sim, apos o desfecho
  await tick();
  assert.equal(h.rpcCalls.filter((c) => c.fn === 'pedido_elegivel_cancelamento').length, 2,
    'depois do desfecho a acao volta a aceitar comando');
});

test('D1/11. o portao e as transicoes permitidas nao mudaram', () => {
  assert.match(exec, /TRANSICOES_CANONICAS\s*=\s*\{\s*rascunho:\s*\['recebido'\],\s*recebido:\s*\['confirmado'\]\s*\}/);
  assert.match(exec, /rpc\('pedido_elegivel_cancelamento',\s*\{ p_pedido_id: pedidoId \}\)/);
  assert.equal((exec.match(/p_base_revisao:\s*revisaoBase\(\)/g) || []).length, 2);
});
