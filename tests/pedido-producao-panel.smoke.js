// tests/pedido-producao-panel.smoke.js
//
// P2-C — painel consolidado de producao do Pedido (#/pedidos/<uuid>/producao).
// O painel CONSOME o dono compartilhado; ele nao reimplementa slider,
// validacao, salvamento nem inicio de producao. Transporte MOCKADO.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PANEL = path.join(ROOT, 'js', 'screens', 'pedido-producao-panel.js');
const ODU   = path.join(ROOT, 'js', 'screens', 'op-distribuicao-ui.js');
const panelSrc = fs.readFileSync(PANEL, 'utf8');
const oduSrc   = fs.readFileSync(ODU, 'utf8');
const panelExec = panelSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

class N {
  constructor(t) { this.tagName = (t + '').toUpperCase(); this.children = []; this._text = null; this._listeners = {}; this.style = {}; this.disabled = false; this.value = ''; this._attrs = {}; }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { this._listeners[t] = fn; }
  removeEventListener(t) { delete this._listeners[t]; }
  replaceChildren(...ns) { this.children = []; for (const n of ns.flat()) { if (n == null || n === false) continue; this.children.push(typeof n === 'string' ? { textContent: n, children: [], appendChild() {}, setAttribute() {} } : n); } }
  focus() { this._focused = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}
function flat(n, a) { a = a || []; if (!n) return a; a.push(n); (n.children || []).forEach((c) => flat(c, a)); return a; }
function txt(n) { return flat(n).map((x) => (x && x.textContent) || '').join(' '); }
function byAttr(root, k, v) { return flat(root).filter((n) => n.getAttribute && n.getAttribute(k) === v); }
function anyAttr(root, k) { return flat(root).filter((n) => n.getAttribute && n.getAttribute(k) != null); }

const OPS = [
  { id: 29, numero: 5, ano: 2026, identidade_operacional: 'OP-A005-1-26', status: 'aberta', ajuste_revisao: 3, tipo: 'tecelagem', lote_id: 5,
    op_itens: [{ id: 100, modelo_id: 1, metros_pedidos: 50, metros_ajustados: 40 }] },
  { id: 31, numero: 6, ano: 2026, identidade_operacional: 'OP-A006-1-26', status: 'simulada', ajuste_revisao: 0, tipo: 'tecelagem', lote_id: 5,
    op_itens: [{ id: 101, modelo_id: 1, metros_pedidos: 30, metros_ajustados: null }] },
];
const DISP = [{ material: 'algodao', cor_id: 10, cor_poliester: null, kg_disponivel: 5000 }];

async function render(opts) {
  const conf = opts || {};
  const rpcCalls = [];
  const tableOps = [];
  const sandbox = { console, setTimeout, clearTimeout, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Set, Date };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.document = { createElement: (t) => new N(t), createTextNode: (t) => ({ textContent: t, children: [] }), querySelector: () => new N('div'), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, body: new N('body') };
  function dataFor(t) {
    if (t === 'pedidos') return { data: { id: 'ped-1', numero: 12, status: 'confirmado', revisao: 4, cliente: { id: 1, nome: 'Cliente' } }, error: null };
    if (t === 'lotes') return { data: [{ id: 5 }], error: null };
    if (t === 'ops') return { data: conf.ops || OPS, error: null };
    if (t === 'modelos') return { data: [{ id: 1, nome: 'Barcelona', largura: 2.10, cor_1: { id: 10, nome: 'PRETO' }, cor_2: { id: 10, nome: 'PRETO' } }], error: null };
    if (t === 'parametros_largura') return { data: [{ largura: 2.10, algodao_por_ml: 0.1, poliester_por_ml: 0.05, valor_x: 1 }], error: null };
    return { data: [], error: null };
  }
  sandbox.supa = {
    from(t) {
      const c = { select: () => c, eq: () => c, in: () => c, order: () => c,
        insert() { tableOps.push({ t, op: 'insert' }); return c; },
        update() { tableOps.push({ t, op: 'update' }); return c; },
        delete() { tableOps.push({ t, op: 'delete' }); return c; },
        maybeSingle: () => Promise.resolve(dataFor(t)), single: () => Promise.resolve(dataFor(t)),
        then: (r, j) => Promise.resolve(dataFor(t)).then(r, j) };
      return c;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      if (fn === 'oc_disponibilidade_op') {
        if (conf.dispErroPara != null && params.p_op_id === conf.dispErroPara) return Promise.resolve({ data: null, error: new Error('boom') });
        return Promise.resolve({ data: DISP, error: null });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    },
  };
  sandbox.el = function (tag, attrs) {
    const n = new N(tag); const rest = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach((k) => { if (k === 'onclick') n._listeners.click = attrs[k]; else n.setAttribute(k, attrs[k]); });
    rest.flat().forEach((c) => { if (c == null || c === false || c === '') return; n.appendChild(typeof c === 'string' ? { textContent: c, children: [], appendChild() {}, setAttribute() {} } : c); });
    return n;
  };
  sandbox.rangeInput = (o) => { const n = new N('input'); Object.assign(n, o || {}); return n; };
  sandbox.textInput = (o) => { const n = new N('input'); n.value = (o && o.value) || ''; return n; };
  sandbox.toast = () => {}; sandbox.navigate = (r) => { sandbox._nav = r; };
  sandbox.shellLayout = (m, node) => node;
  sandbox.ADMIN_MENU = [];
  sandbox.badgeStatus = (s) => { const n = new N('span'); n.textContent = s; return n; };
  sandbox.fmtMetros = (v) => String(v) + ' m'; sandbox.fmtKg = (v) => String(v) + ' kg';
  sandbox.rotuloModelo = (m) => (m && m.nome) || 'Modelo';
  sandbox.larguraKey = (l) => Number(l).toFixed(2);
  sandbox.calcularFiosOP = () => ({ algodaoPorCor: {}, poliester: { PRETO: 0, BRANCO: 0 } });
  sandbox.maxMetrosItem = () => 1000;
  sandbox.RAVATEX_OP_DISPLAY = { formatOpOperationalCode: (op) => op.identidade_operacional };
  vm.createContext(sandbox);
  vm.runInContext(oduSrc, sandbox, { filename: 'js/screens/op-distribuicao-ui.js' });
  vm.runInContext(panelSrc, sandbox, { filename: 'js/screens/pedido-producao-panel.js' });
  const root = await sandbox.screenPedidoProducaoPanel('ped-1');
  return { sandbox, root, rpcCalls, tableOps };
}

test('0. sintaxe JS valida', () => { cp.execSync(`node --check "${PANEL}"`, { stdio: 'pipe' }); });

test('1. e uma pagina propria, nao um modal', async () => {
  const { root } = await render();
  assert.doesNotMatch(panelExec, /window\.modal\(/, 'o painel nao pode ser um modal');
  assert.match(panelExec, /window\.shellLayout\(window\.ADMIN_MENU/, 'monta a shell de pagina');
  assert.ok(root);
});

test('2. carrega identidade do Pedido e a lista de OPs', async () => {
  const { root } = await render();
  const t = txt(root);
  assert.match(t, /Produção do Pedido #12/);
  assert.match(t, /2 OP\(s\)/);
});

test('3. cada OP e identificada pela identidade operacional canonica', async () => {
  const { root } = await render();
  assert.match(txt(root), /OP-A005-1-26/);
  assert.match(txt(root), /OP-A006-1-26/);
});

test('4. carrega a disponibilidade NATIVA de cada OP ajustavel', async () => {
  const { rpcCalls } = await render();
  const disp = rpcCalls.filter((c) => c.fn === 'oc_disponibilidade_op');
  assert.equal(disp.length, 2, 'uma leitura por OP ajustavel');
  assert.deepEqual(disp.map((c) => c.params.p_op_id).sort(), [29, 31]);
});

test('5. a revisao REAL de cada OP e lida e exibida', async () => {
  const { root } = await render();
  assert.match(panelExec, /ajuste_revisao/, 'a revisao entra no select');
  assert.match(txt(root), /revisão de ajuste 3/);
  assert.match(txt(root), /revisão de ajuste 0/);
});

test('6. monta o dono COMPARTILHADO e nao um segundo slider', () => {
  assert.match(panelExec, /api\.buildDistribuicaoBlock\(/);
  assert.match(panelExec, /api\.buildIniciarProducaoButton\(/);
  assert.doesNotMatch(panelExec, /rangeInput/, 'nenhum slider proprio');
  assert.doesNotMatch(panelExec, /salvar_ajuste_producao_op|iniciar_producao_op/,
    'nenhuma persistencia nem inicio proprio');
  assert.doesNotMatch(panelExec, /algumExcede|avaliarDistribuicao/,
    'nenhuma validacao de teto duplicada');
});

test('7. status e elegibilidade de inicio aparecem por OP', async () => {
  const { root } = await render();
  const cards = anyAttr(root, 'data-rv-op-producao');
  assert.equal(cards.length, 2);
  const iniciar = flat(root).filter((n) => n.tagName === 'BUTTON' && /Iniciar produ/.test(txt(n)));
  assert.equal(iniciar.length, 2, 'cada OP tem o seu proprio botao de inicio');
  // A OP aberta com ajuste completo habilita; a simulada nao.
  assert.equal(iniciar[0].disabled, false);
  assert.equal(iniciar[1].disabled, true);
  assert.match(iniciar[1].getAttribute('title') || '', /simulada/i);
});

test('8. a falha de disponibilidade de UMA OP nao corrompe a outra', async () => {
  const { root } = await render({ dispErroPara: 31 });
  const cards = anyAttr(root, 'data-rv-op-producao');
  assert.equal(cards.length, 2, 'as duas OPs continuam renderizadas');
  // A OP 31 cai no estado de recusa do dono compartilhado; a 29 continua util.
  const recusa = anyAttr(root, 'data-rv-contexto-incompleto');
  assert.equal(recusa.length, 1, 'so a OP com falha entra em recusa');
  assert.match(txt(recusa[0]), /Disponibilidade nativa de fio não carregada/);
});

test('9. cada OP tem a sua propria revisao — conflitos sao independentes', () => {
  assert.match(panelExec, /ajusteRevisao:\s*op\.ajuste_revisao/);
  assert.equal((panelExec.match(/ajusteRevisao:\s*op\.ajuste_revisao/g) || []).length, 2,
    'bloco e botao recebem a revisao da PROPRIA OP');
  assert.match(panelExec, /onRecarregar:[\s\S]{0,80}await reload\(\)/,
    'o conflito de uma OP recarrega do servidor, sem remendar estado local');
});

test('10. navegacao de retorno ao Pedido existe', async () => {
  const { root, sandbox } = await render();
  const voltar = flat(root).find((n) => n.tagName === 'BUTTON' && /Voltar ao Pedido/.test(txt(n)));
  assert.ok(voltar);
  voltar._listeners.click();
  assert.equal(sandbox._nav, '#/pedidos/ped-1');
});

test('11. nenhuma DML direta no painel', async () => {
  const { tableOps } = await render();
  assert.deepEqual(tableOps, [], 'o painel so le');
  assert.doesNotMatch(panelExec, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test('12. a rota esta registrada no roteador existente', () => {
  const router = fs.readFileSync(path.join(ROOT, 'js', 'router.js'), 'utf8');
  assert.match(router, /\\\/producao\$/, 'match dinamico ancorado');
  assert.match(router, /window\.screenPedidoProducaoPanel\(/);
  assert.match(router, /roles: \['admin'\]/);
});

test('13. o dono compartilhado exige as duas entradas nativas (fail-closed)', () => {
  assert.match(oduSrc, /function contextoNativoCompleto/);
  assert.match(oduSrc, /return NaN;/, 'revisao ausente nao vira 0');
  // O TETO vem de kg_disponivel da projecao nativa; metros_pedidos e apenas o
  // piso do slider e a metragem do pedido, nunca disponibilidade produtiva.
  assert.match(oduSrc, /kg_disponivel/, 'o teto vem da projecao nativa');
  assert.match(oduSrc, /window\.maxMetrosItem\(c, modelosById, parametrosByLargura, disponibilidade\)/,
    'o teto individual e calculado sobre a disponibilidade nativa');
  // E o cliente dos escritores canonicos nao deriva teto de metragem pedida:
  // maxMetrosItem so consulta linhas de disponibilidade nativa.
  const opr = fs.readFileSync(path.join(ROOT, 'js', 'screens', 'op-recalculo.js'), 'utf8');
  const corpoTeto = (opr.match(/function maxMetrosItem[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(corpoTeto, 'maxMetrosItem nao encontrado');
  assert.match(corpoTeto, /kg_disponivel/);
  assert.doesNotMatch(corpoTeto, /metros_pedidos|kg_recebido/,
    'o calculo de teto nao conhece metragem pedida nem kg recebido plano');
});

test('14. nenhum endpoint hospedado', () => {
  assert.doesNotMatch(fs.readFileSync(__filename, 'utf8'), /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
