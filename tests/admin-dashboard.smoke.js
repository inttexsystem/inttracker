// Smoke test do Dashboard Admin (#/painel) alinhado ao standalone.
//
// Cobre:
//   - screenPainel exposto na rota/admin;
//   - renderizacao imediata sem depender do carregamento assíncrono;
//   - blocos visuais principais do standalone;
//   - leituras reais esperadas, sem chamadas de escrita.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PAINEL = path.join(ROOT, 'js', 'screens', 'painel.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');

const painelSrc = fs.readFileSync(PAINEL, 'utf8');
const uiSrc = fs.readFileSync(UI, 'utf8');
const routerSrc = fs.readFileSync(ROUTER, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const bootSrc = fs.readFileSync(BOOT, 'utf8');

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.className = '';
    this._text = '';
    this._attrs = {};
    this._listeners = {};
  }
  appendChild(node) {
    if (node == null) return node;
    this.children.push(node);
    return node;
  }
  replaceChildren(...nodes) {
    this.children = [];
    nodes.flat().forEach((node) => {
      if (node == null || node === false) return;
      this.children.push(typeof node === 'string' ? { textContent: node, children: [] } : node);
    });
  }
  setAttribute(key, value) {
    this._attrs[key] = value;
    if (key === 'class') this.className = value;
  }
  addEventListener(type, fn) {
    this._listeners[type] = fn;
  }
  removeEventListener(type) {
    delete this._listeners[type];
  }
  remove() {
    this._removed = true;
  }
  get textContent() {
    return this._text || '';
  }
  set textContent(value) {
    this._text = String(value);
  }
}

function textOf(node) {
  if (!node) return '';
  let out = '';
  if (typeof node.textContent === 'string') out += node.textContent + ' ';
  for (const child of node.children || []) out += textOf(child);
  return out;
}

function findByClass(node, className, found = []) {
  if (!node) return found;
  if (String(node.className || '').split(/\s+/).includes(className)) found.push(node);
  for (const child of node.children || []) findByClass(child, className, found);
  return found;
}

function makeSandbox() {
  const calls = [];
  const writes = [];
  const fixtures = {
    pedidos: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        numero: 11,
        status: 'recebido',
        cliente_id: 1,
        criado_em: '2026-07-03T10:00:00Z',
        atualizado_em: '2026-07-03T10:00:00Z',
        metros_total: 18000
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        numero: 7,
        status: 'entregue',
        cliente_id: 2,
        criado_em: '2026-06-20T10:00:00Z',
        atualizado_em: '2026-07-02T10:00:00Z',
        metros_total: 9000
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        numero: 10,
        status: 'confirmado',
        cliente_id: 2,
        criado_em: '2026-07-02T10:00:00Z',
        atualizado_em: '2026-07-02T11:00:00Z',
        metros_total: 12000
      }
    ],
    clientes: [
      { id: 1, nome: 'Encanta Lar' },
      { id: 2, nome: 'Móveis Aurora' }
    ],
    lotes: [
      { id: 101, numero: 1, pedido_id: '33333333-3333-4333-8333-333333333333', cliente_id: 2 },
      { id: 102, numero: 2, pedido_id: '22222222-2222-4222-8222-222222222222', cliente_id: 2 }
    ],
    ops: [
      {
        id: 8,
        numero: 8,
        ano: 2026,
        status: 'finalizada',
        tipo: 'tecelagem',
        lote_id: 101,
        criado_em: '2026-07-01T10:00:00Z',
        atualizado_em: '2026-07-03T12:00:00Z',
        op_itens: [{ id: 1, metros_pedidos: 12000, metros_ajustados: 12000 }]
      },
      {
        id: 9,
        numero: 3,
        ano: 2026,
        status: 'aberta',
        tipo: 'latex',
        lote_id: 101,
        criado_em: '2026-07-03T11:00:00Z',
        atualizado_em: '2026-07-03T11:00:00Z',
        op_itens: [{ id: 2, metros_pedidos: 12000, metros_ajustados: 12000 }]
      },
      {
        id: 10,
        numero: 4,
        ano: 2026,
        status: 'finalizada',
        tipo: 'latex',
        lote_id: 102,
        criado_em: '2026-07-01T11:00:00Z',
        atualizado_em: '2026-07-04T11:00:00Z',
        op_itens: [{ id: 3, metros_pedidos: 9000, metros_ajustados: 9000 }]
      }
    ],
    expedicoes: [
      {
        id: 5,
        pedido_id: '33333333-3333-4333-8333-333333333333',
        op_latex_id: 9,
        status: 'parcial',
        criado_em: '2026-07-04T10:00:00Z',
        atualizado_em: '2026-07-04T12:00:00Z'
      }
    ],
    expedicao_itens: [
      { id: 1, expedicao_id: 5, metros_liberados: 12000, metros_entregues: 6000 }
    ],
    pedido_cliente_eventos: [
      {
        id: 1,
        pedido_id: '33333333-3333-4333-8333-333333333333',
        status: 'expedicao',
        titulo: 'Expedição parcial',
        mensagem: 'Entrega parcial liberada para o cliente.',
        criado_em: '2026-07-04T12:30:00Z'
      }
    ]
  };

  function chainFor(table) {
    const chain = {
      selectArg: null,
      select(arg) {
        calls.push({ table, op: 'select', arg });
        chain.selectArg = arg;
        return chain;
      },
      order(column, opts) {
        calls.push({ table, op: 'order', column, opts });
        return chain;
      },
      insert(payload) {
        writes.push({ table, op: 'insert', payload });
        return chain;
      },
      update(payload) {
        writes.push({ table, op: 'update', payload });
        return chain;
      },
      delete() {
        writes.push({ table, op: 'delete' });
        return chain;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: fixtures[table] || [], error: null }).then(resolve, reject);
      }
    };
    return chain;
  }

  const document = {
    createElement: (tag) => new FakeNode(tag),
    createTextNode: (text) => ({ textContent: String(text), children: [] }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body')
  };

  const sandbox = {
    document,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    location: { hash: '#/painel' },
    CURRENT_USER: { nome: 'Admin Teste', tipo: 'admin' },
    logout: () => {},
    supa: {
      from(table) {
        calls.push({ table, op: 'from' });
        return chainFor(table);
      },
      rpc(name, payload) {
        writes.push({ table: 'rpc', op: name, payload });
        return Promise.resolve({ data: null, error: null });
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
  return { sandbox, calls, writes };
}

test('painel.js: sintaxe valida', () => {
  cp.execSync(`node --check "${PAINEL}"`, { stdio: 'pipe' });
});

test('painel.js: expõe screenPainel no namespace e global legado', () => {
  assert.match(painelSrc, /window\.RAVATEX_SCREENS\.painel/);
  assert.match(painelSrc, /window\.screenPainel\s*=\s*screenPainel/);
});

test('boot.js: rota #/painel continua admin e usa window.screenPainel', () => {
  assert.match(
    bootSrc,
    /'#\/painel'\s*:\s*\{\s*render\s*:\s*window\.screenPainel,\s*roles\s*:\s*\[\s*'admin'\s*\]\s*\}/
  );
});

test('painel.js: consulta fontes reais esperadas e nao contem writes', () => {
  for (const table of ['pedidos', 'clientes', 'lotes', 'ops', 'expedicoes', 'expedicao_itens', 'pedido_cliente_eventos']) {
    assert.match(painelSrc, new RegExp("queryRows\\('" + table + "'"), `select de ${table} ausente`);
  }
  assert.doesNotMatch(painelSrc, /\.insert\s*\(/);
  assert.doesNotMatch(painelSrc, /\.update\s*\(/);
  assert.doesNotMatch(painelSrc, /\.delete\s*\(/);
  assert.doesNotMatch(painelSrc, /\.rpc\s*\(/);
});

test('runtime: renderiza imediatamente com shellLayout e blocos do standalone', () => {
  const { sandbox } = makeSandbox();
  const root = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(root && root.tagName === 'DIV');
  assert.ok(root.children.length >= 2, 'shellLayout deve montar header + corpo');

  const text = textOf(root);
  for (const label of [
    'Dashboard',
    'Pedidos em aberto',
    'OPs em preparação',
    'Aguardando expedição',
    'Entregas pendentes',
    'Fila de ações',
    'Alertas',
    'Cadeia produtiva',
    'Atividade recente'
  ]) {
    assert.match(text, new RegExp(label), `label ausente: ${label}`);
  }
});

test('runtime: após carregar dados monta ações, pipeline e nao escreve', async () => {
  const { sandbox, calls, writes } = makeSandbox();
  const root = vm.runInContext('window.screenPainel()', sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const text = textOf(root);
  assert.match(text, /Abrir OP de Tecelagem/);
  assert.match(text, /Transferir para Acabamento/);
  assert.match(text, /Confirmar entrada em Acabamento/);
  assert.match(text, /Registrar entrega parcial/);
  assert.match(text, /Encanta Lar/);
  assert.match(text, /Móveis Aurora/);
  assert.ok(findByClass(root, 'rv-adm-kpi').length >= 5, 'deve renderizar 5 KPI cards');
  assert.ok(findByClass(root, 'rv-adm-stage').length >= 6, 'deve renderizar 6 etapas da cadeia produtiva');
  assert.deepEqual(writes, [], 'dashboard admin não deve chamar insert/update/delete/rpc');

  const selectedTables = calls.filter((call) => call.op === 'select').map((call) => call.table);
  for (const table of ['pedidos', 'clientes', 'lotes', 'ops', 'expedicoes', 'expedicao_itens', 'pedido_cliente_eventos']) {
    assert.ok(selectedTables.includes(table), `select runtime de ${table} ausente`);
  }
});
