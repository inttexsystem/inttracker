// tests/acabamento-recovery-ui.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-B.3 — recuperacao de OP de acabamento
// APOS FALHA PROVADA pelo servidor.
//
// Divisao de propriedade que este arquivo guarda:
//   * js/screens/entrega-form.js e dono de UI e NAO e dono de RPC de mutacao.
//     A linha "NAO faz insert / update / delete / rpc" do seu cabecalho e um
//     contrato negativo real, e a recuperacao nao abre excecao nele.
//   * js/screens/entrega-writes.js e o dono canonico do escritor.
//
// A superficie so aparece quando pode_recuperar_op_acabamento devolve true.
// Ausencia, erro, dado malformado ou false NAO renderizam a acao — nunca se
// infere elegibilidade de um resultado guardado no cliente.
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
const EF = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const efSrc = fs.readFileSync(EF, 'utf8');
const ewSrc = fs.readFileSync(EW, 'utf8');

function executavel(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

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

function makeSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableOps = [];
  const sandbox = { console, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Date };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = {
    from(table) {
      const chain = {
        insert() { tableOps.push({ table, op: 'insert' }); return chain; },
        update() { tableOps.push({ table, op: 'update' }); return chain; },
        delete() { tableOps.push({ table, op: 'delete' }); return chain; },
        select() { return chain; }, eq() { return chain; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(res, rej) { return Promise.resolve({ data: null, error: null }).then(res, rej); },
      };
      return chain;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: null, error: null });
    },
  };
  sandbox.toast = () => {};
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
  sandbox.formField = (o) => o.input;
  sandbox.larguraKey = (l) => Number(l).toFixed(2);
  sandbox.RAVATEX_OP_DISPLAY = { getCanonicalIdentity: (o) => (o && o.identidade_operacional) || null };

  vm.createContext(sandbox);
  vm.runInContext(ewSrc, sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(efSrc, sandbox, { filename: 'js/screens/entrega-form.js' });
  return { sandbox, rpcCalls, tableOps };
}

test('0. os dois modulos tem sintaxe JS valida', () => {
  cp.execSync(`node --check "${EF}"`, { stdio: 'pipe' });
  cp.execSync(`node --check "${EW}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// Divisao de propriedade
// ---------------------------------------------------------------------

test('1. entrega-form.js NAO e dono de RPC nem de DML — contrato negativo intacto', () => {
  const exec = executavel(efSrc);
  assert.doesNotMatch(exec, /\.rpc\(/, 'o formulario nao pode chamar RPC diretamente');
  assert.doesNotMatch(exec, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/,
    'o formulario nao pode abrir caminho de escrita proprio');
  assert.doesNotMatch(exec, /window\.supa/, 'o formulario nao toca o client Supabase');
});

test('2. o formulario DELEGA ao escritor canonico', () => {
  assert.match(efSrc, /RAVATEX_ENTREGA_WRITES/,
    'a recuperacao tem de delegar ao dono canonico');
  assert.match(efSrc, /recuperarOpAcabamento/);
});

test('3. o escritor canonico vive em entrega-writes.js e chama SO gerar_op_acabamento', () => {
  assert.match(ewSrc, /function\s+recuperarOpAcabamento/);
  assert.match(ewSrc, /rpc\('gerar_op_acabamento'/);
});

// ---------------------------------------------------------------------
// Elegibilidade: so apos falha provada
// ---------------------------------------------------------------------

test('4. elegibilidade TRUE monta a superficie', () => {
  const { sandbox } = makeSandbox();
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  assert.ok(node, 'com falha provada a acao tem de existir');
  assert.ok(findBtn(node, /Recuperar OP de acabamento/));
});

test('5. elegibilidade FALSE, AUSENTE ou MALFORMADA nao monta nada', () => {
  const { sandbox } = makeSandbox();
  for (const v of [false, undefined, null, 0, '', 'true', 1, {}, []]) {
    const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: v });
    assert.equal(node, null, 'elegivel=' + JSON.stringify(v) + ' nao pode renderizar a acao');
  }
});

test('6. a elegibilidade e do SERVIDOR e estritamente booleana', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: true, error: null }));
  const r = await sandbox.RAVATEX_ENTREGA_WRITES.podeRecuperarOpAcabamento(999);
  assert.equal(r.elegivel, true);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['pode_recuperar_op_acabamento']);
  assert.equal(rpcCalls[0].params.p_entrega_id, 999);
});

test('7. um valor nao-booleano do servidor NAO e elegibilidade', async () => {
  for (const v of ['true', 1, {}, [], null]) {
    const { sandbox } = makeSandbox(() => ({ data: v, error: null }));
    const r = await sandbox.RAVATEX_ENTREGA_WRITES.podeRecuperarOpAcabamento(999);
    assert.equal(r.elegivel, false, JSON.stringify(v) + ' nao pode virar elegivel');
  }
});

test('8. erro na checagem NAO habilita a recuperacao', async () => {
  const { sandbox } = makeSandbox(() => ({ data: null, error: new Error('boom') }));
  const r = await sandbox.RAVATEX_ENTREGA_WRITES.podeRecuperarOpAcabamento(999);
  assert.equal(r.elegivel, false);
  assert.ok(r.error, 'o erro continua observavel');
});

// ---------------------------------------------------------------------
// Comando de recuperacao
// ---------------------------------------------------------------------

test('9. a recuperacao chama SO gerar_op_acabamento, sem DML', async () => {
  const { sandbox, rpcCalls, tableOps } = makeSandbox(() => ({ data: { ok: true, op_latex_id: 44 }, error: null }));
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  await findBtn(node, /Recuperar/)._listeners.click();
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['gerar_op_acabamento']);
  assert.deepEqual(tableOps, [], 'nenhuma DML pode existir no caminho de recuperacao');
});

test('10. NENHUM dado livre de OP e aceito — so entrega, chave e motivo', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  await findBtn(node, /Recuperar/)._listeners.click();
  assert.deepEqual(Object.keys(rpcCalls[0].params).sort(),
    ['p_entrega_id', 'p_idempotency_key', 'p_motivo'],
    'a recuperacao nao aceita numero, ano, tipo nem qualquer campo de OP');
});

test('11. clique repetido pendente nao cria um segundo comando', async () => {
  let solta;
  const bloqueio = new Promise((r) => { solta = r; });
  const { sandbox, rpcCalls } = makeSandbox(() => bloqueio);
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  const btn = findBtn(node, /Recuperar/);
  const p1 = btn._listeners.click();
  const p2 = btn._listeners.click();
  assert.equal(btn.disabled, true, 'a acao fica desabilitada enquanto pendente');
  solta({ data: { ok: true }, error: null });
  await Promise.all([p1, p2]);
  assert.equal(rpcCalls.length, 1);
});

test('12. a chave sobrevive a um reenvio ambiguo da mesma intencao', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: null, error: new Error('timeout') }));
  const api = sandbox.RAVATEX_ENTREGA_WRITES;
  const rastreador = api.criarRastreadorComando();
  await api.recuperarOpAcabamento({ entregaId: 999, motivo: 'x', rastreador });
  await api.recuperarOpAcabamento({ entregaId: 999, motivo: 'x', rastreador });
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[0].params.p_idempotency_key, rpcCalls[1].params.p_idempotency_key);
});

test('13. um desfecho deterministico fecha a tentativa', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  const api = sandbox.RAVATEX_ENTREGA_WRITES;
  const rastreador = api.criarRastreadorComando();
  await api.recuperarOpAcabamento({ entregaId: 999, motivo: 'x', rastreador });
  await api.recuperarOpAcabamento({ entregaId: 999, motivo: 'x', rastreador });
  assert.notEqual(rpcCalls[0].params.p_idempotency_key, rpcCalls[1].params.p_idempotency_key);
});

test('14. sucesso identifica a OP de acabamento canonica e recarrega', async () => {
  const recebidos = [];
  const { sandbox } = makeSandbox(() => ({ data: { ok: true, op_latex_id: 44, identidade_operacional: 'OP-A005-2-26' }, error: null }));
  const node = sandbox.buildAcabamentoRecoveryBlock({
    entregaId: 999, elegivel: true,
    onRecuperado: async (r) => { recebidos.push(r); },
  });
  await findBtn(node, /Recuperar/)._listeners.click();
  assert.equal(recebidos.length, 1, 'a recarga autoritativa do chamador tem de ser acionada');
  assert.equal(recebidos[0].rotulo, 'OP-A005-2-26');
});

test('15. um codigo de recusa do servidor fica visivel', async () => {
  const { sandbox } = makeSandbox(() => ({ data: { ok: false, codigo: 'ACABAMENTO_JA_EXISTE' }, error: null }));
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  await findBtn(node, /Recuperar/)._listeners.click();
  assert.match(textOf(node), /ACABAMENTO_JA_EXISTE/);
});

test('16. a regiao de erro e acessivel e local a superficie', () => {
  const { sandbox } = makeSandbox();
  const node = sandbox.buildAcabamentoRecoveryBlock({ entregaId: 999, elegivel: true });
  const alerta = flatten(node).find((n) => n.getAttribute && n.getAttribute('role') === 'alert');
  assert.ok(alerta);
  assert.equal(alerta.getAttribute('aria-live'), 'assertive');
});

test('17. a recuperacao NAO e disparada automaticamente pela entrega normal', () => {
  const exec = executavel(ewSrc);
  // salvarEntregaCima nao pode chamar o escritor de recuperacao.
  const corpo = (exec.match(/async function salvarEntregaCima[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(corpo, 'corpo de salvarEntregaCima nao encontrado');
  assert.doesNotMatch(corpo, /gerar_op_acabamento/,
    'a entrega normal nunca chama a recuperacao automaticamente');
  assert.doesNotMatch(corpo, /recuperarOpAcabamento/);
});

test('18. nenhum endpoint hospedado e contatado por este arquivo', () => {
  const meu = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
