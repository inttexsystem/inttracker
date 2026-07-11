'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CAD = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const cadSrc = fs.readFileSync(CAD, 'utf8');
const bootSrc = fs.readFileSync(BOOT, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.style = {};
    this.value = '';
    this._attrs = {};
    this._listeners = {};
    this._text = '';
  }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes.flat().filter(Boolean); }
  addEventListener(type, handler) { this._listeners[type] = handler; }
  removeEventListener(type) { delete this._listeners[type]; }
  setAttribute(key, value) { this._attrs[key] = value; }
  remove() { this.removed = true; }
  set innerHTML(_value) { this.firstChild = new Node('svg'); }
  get textContent() { return this.children.length ? this.children.map(textOf).join('') : this._text; }
  set textContent(value) { this._text = String(value); }
}

function textOf(node) {
  return node && node.textContent ? node.textContent : '';
}

function findAll(node, predicate, result = []) {
  if (!node) return result;
  if (predicate(node)) result.push(node);
  for (const child of node.children || []) findAll(child, predicate, result);
  return result;
}

function createHarness(options = {}) {
  const calls = [];
  const toasts = [];
  const rows = options.rows || { clientes: [], fornecedores: [] };
  const writeError = options.writeError || (() => null);
  const document = {
    body: new Node('body'),
    createElement: (tag) => new Node(tag),
    createTextNode: (value) => ({ textContent: String(value), children: [] }),
    addEventListener() {}, removeEventListener() {},
  };
  const sandbox = { console: { error() {} }, document, innerWidth: 1024, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.el = (tag, attrs, ...children) => {
    const node = new Node(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key.startsWith('on')) node[key] = value;
      else if (key === 'innerHTML') node.innerHTML = value;
      else if (key === 'style') node.style.cssText = value;
      else node._attrs[key] = value;
    });
    children.flat().filter((child) => child !== undefined && child !== null && child !== false)
      .forEach((child) => node.appendChild(typeof child === 'string' ? { textContent: child, children: [] } : child));
    return node;
  };
  sandbox.textInput = (attrs = {}) => {
    const node = new Node('input');
    node.value = attrs.value || '';
    node._attrs = attrs;
    return node;
  };
  sandbox.selectInput = (attrs = {}) => {
    const node = new Node('select');
    node.value = attrs.value || '';
    node._attrs = attrs;
    return node;
  };
  sandbox.shellLayout = (_menu, content) => content;
  sandbox.ADMIN_MENU = [];
  sandbox.toast = (message, level) => toasts.push({ message, level });
  sandbox.confirmDialog = () => {};
  sandbox.supa = {
    from(table) {
      calls.push({ op: 'from', table });
      const chain = {
        select(columns) { calls.push({ op: 'select', table, columns }); return chain; },
        order() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        insert(payload) { calls.push({ op: 'insert', table, payload }); chain.write = { op: 'insert', payload }; return chain; },
        update(payload) { calls.push({ op: 'update', table, payload }); chain.write = { op: 'update', payload }; return chain; },
        delete() { calls.push({ op: 'delete', table }); chain.write = { op: 'delete' }; return chain; },
        then(resolve, reject) {
          const error = chain.write ? writeError({ table, ...chain.write }) : null;
          return Promise.resolve({ data: rows[table] || [], error }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(cadSrc, sandbox, { filename: CAD });
  return { sandbox, calls, toasts, document };
}

async function openForm(harness, screenName, buttonText) {
  const root = await harness.sandbox[screenName]();
  const button = findAll(root, (node) => node.tagName === 'BUTTON' && textOf(node) === buttonText)[0];
  assert.ok(button, 'botao do formulario ausente');
  button.onclick();
  const inputs = findAll(harness.document.body, (node) => node.tagName === 'INPUT');
  const save = findAll(harness.document.body, (node) => node.tagName === 'BUTTON' && textOf(node) === 'Salvar')[0];
  assert.ok(save, 'botao Salvar ausente');
  return { inputs, save };
}

function inputByPlaceholder(inputs, placeholder) {
  return inputs.find((node) => node._attrs.placeholder === placeholder);
}

test('helpers normalizam, formatam e validam CNPJ', () => {
  const { sandbox } = createHarness();
  const helpers = sandbox.RAVATEX_SCREENS.cadastros;
  assert.equal(helpers.normalizarCnpj('11.222.333/0001-81'), '11222333000181');
  assert.equal(helpers.formatarCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(helpers.validarCnpjDv('11222333000181').ok, true);
  assert.equal(helpers.validarCnpjDv('11222333000180').ok, false);
});

test('cliente cria e edita usando somente clientes.cnpj', async () => {
  const createHarnessResult = createHarness();
  const create = await openForm(createHarnessResult, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(create.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente direto';
  inputByPlaceholder(create.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  await create.save.onclick();
  const insert = createHarnessResult.calls.find((call) => call.op === 'insert');
  assert.equal(insert.table, 'clientes');
  assert.equal(insert.payload.nome, 'Cliente direto');
  assert.equal(insert.payload.cnpj, '11222333000181');

  const editHarness = createHarness({ rows: { clientes: [{ id: 7, nome: 'Cliente direto', cnpj: '11222333000181' }], fornecedores: [] } });
  const root = await editHarness.sandbox.screenCadastrosClientes();
  const edit = findAll(root, (node) => node.tagName === 'BUTTON' && node._attrs.title === 'Editar cliente')[0];
  edit.onclick();
  const cnpj = inputByPlaceholder(findAll(editHarness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.equal(cnpj.value, '11.222.333/0001-81');
  cnpj.value = '11.444.777/0001-61';
  await findAll(editHarness.document.body, (node) => node.tagName === 'BUTTON' && textOf(node) === 'Salvar')[0].onclick();
  const update = editHarness.calls.find((call) => call.op === 'update');
  assert.equal(update.table, 'clientes');
  assert.equal(update.payload.cnpj, '11444777000161');
  assert.equal(editHarness.calls.some((call) => call.table === 'fornecedores' && call.op === 'update'), false);
});

test('fornecedor cria e edita usando somente fornecedores.cnpj', async () => {
  const createHarnessResult = createHarness();
  const create = await openForm(createHarnessResult, 'screenCadastrosFornecedores', 'Novo fornecedor');
  inputByPlaceholder(create.inputs, 'Ex: Tecelagem Fulano').value = 'Fornecedor direto';
  inputByPlaceholder(create.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  findAll(createHarnessResult.document.body, (node) => node.tagName === 'SELECT')[0].value = 'tecelagem';
  await create.save.onclick();
  const insert = createHarnessResult.calls.find((call) => call.op === 'insert');
  assert.equal(insert.table, 'fornecedores');
  assert.equal(insert.payload.cnpj, '11222333000181');

  const editHarness = createHarness({ rows: { clientes: [], fornecedores: [{ id: 8, nome: 'Fornecedor direto', tipo: 'tecelagem', cnpj: '11222333000181' }] } });
  const root = await editHarness.sandbox.screenCadastrosFornecedores();
  const edit = findAll(root, (node) => node.tagName === 'BUTTON' && node._attrs.title === 'Editar fornecedor')[0];
  edit.onclick();
  const inputs = findAll(editHarness.document.body, (node) => node.tagName === 'INPUT');
  inputByPlaceholder(inputs, '00.000.000/0000-00').value = '11.444.777/0001-61';
  await findAll(editHarness.document.body, (node) => node.tagName === 'BUTTON' && textOf(node) === 'Salvar')[0].onclick();
  const update = editHarness.calls.find((call) => call.op === 'update');
  assert.equal(update.table, 'fornecedores');
  assert.equal(update.payload.cnpj, '11444777000161');
  assert.equal(editHarness.calls.some((call) => call.table === 'clientes' && call.op === 'update'), false);
});

test('DV invalido bloqueia write e duplicidade e tratada por categoria', async () => {
  const invalid = createHarness();
  const form = await openForm(invalid, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(form.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente invalido';
  inputByPlaceholder(form.inputs, '00.000.000/0000-00').value = '11.222.333/0001-80';
  await form.save.onclick();
  assert.equal(invalid.calls.some((call) => call.op === 'insert'), false);
  assert.match(invalid.toasts.at(-1).message, /inválido/i);

  const duplicateClient = createHarness({ writeError: () => ({ code: '23505', message: 'duplicate key value violates unique constraint "clientes_cnpj_uidx"' }) });
  const duplicateClientForm = await openForm(duplicateClient, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(duplicateClientForm.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente duplicado';
  inputByPlaceholder(duplicateClientForm.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  await duplicateClientForm.save.onclick();
  assert.match(duplicateClient.toasts.at(-1).message, /outro Cliente/i);

  const duplicate = createHarness({ writeError: () => ({ code: '23505', message: 'duplicate key value violates unique constraint "fornecedores_cnpj_uidx"' }) });
  const duplicateForm = await openForm(duplicate, 'screenCadastrosFornecedores', 'Novo fornecedor');
  inputByPlaceholder(duplicateForm.inputs, 'Ex: Tecelagem Fulano').value = 'Fornecedor duplicado';
  inputByPlaceholder(duplicateForm.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  findAll(duplicate.document.body, (node) => node.tagName === 'SELECT')[0].value = 'tecelagem';
  await duplicateForm.save.onclick();
  assert.match(duplicate.toasts.at(-1).message, /outro Fornecedor/i);
});

test('CNPJ vazio envia null nos dois formulários', async () => {
  const client = createHarness();
  const clientForm = await openForm(client, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(clientForm.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente sem CNPJ';
  await clientForm.save.onclick();
  assert.equal(client.calls.find((call) => call.op === 'insert').payload.cnpj, null);

  const supplier = createHarness();
  const supplierForm = await openForm(supplier, 'screenCadastrosFornecedores', 'Novo fornecedor');
  inputByPlaceholder(supplierForm.inputs, 'Ex: Tecelagem Fulano').value = 'Fornecedor sem CNPJ';
  findAll(supplier.document.body, (node) => node.tagName === 'SELECT')[0].value = 'tecelagem';
  await supplierForm.save.onclick();
  assert.equal(supplier.calls.find((call) => call.op === 'insert').payload.cnpj, null);
});

test('mesmo CNPJ pode ser enviado nos dois fluxos e as listagens leem a coluna direta', async () => {
  const harness = createHarness({ rows: {
    clientes: [{ id: 1, nome: 'Cliente', cnpj: '11222333000181' }],
    fornecedores: [{ id: 2, nome: 'Fornecedor', tipo: 'tecelagem', cnpj: null }],
  } });
  const clientRoot = await harness.sandbox.screenCadastrosClientes();
  const supplierRoot = await harness.sandbox.screenCadastrosFornecedores();
  assert.match(textOf(clientRoot), /11\.222\.333\/0001-81/);
  assert.match(textOf(supplierRoot), /—/);
  const tables = new Set(harness.calls.filter((call) => call.op === 'from').map((call) => call.table));
  assert.deepEqual([...tables].sort(), ['clientes', 'fornecedores']);
});

test('menu e rotas de cadastro permanecem coerentes; sintaxe valida', () => {
  assert.ok(commonSrc.includes("label: 'Clientes'"));
  assert.ok(commonSrc.includes("label: 'Fornecedores'"));
  assert.ok(bootSrc.includes("'#/cadastros/clientes'"));
  assert.ok(bootSrc.includes("'#/cadastros/fornecedores'"));
  cp.execSync(`node --check "${CAD}"`, { stdio: 'pipe' });
});
