'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
// TEST-MOCK-FIDELITY-AUDIT R1 adoption: the cadastros screens are now rendered
// through the REAL js/ui.js el()/textInput()/selectInput()/truncatedCell()
// backed by the shared FaithfulNode/createDocument doubles (tests/_doubles.js),
// so this suite is no longer structurally blind to a boolean-attr defect
// (CODE_HEALTH_RULES.md §20). The old hand-rolled Node/el stored
// `node._attrs[key] = value` with no boolean-attr coercion and would have
// masked a disabled/checked/... regression.
const { FaithfulNode, createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const CAD = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const cadSrc = fs.readFileSync(CAD, 'utf8');
const uiSrc = fs.readFileSync(UI, 'utf8');
const bootSrc = fs.readFileSync(BOOT, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');

// Aggregate the leaf text of a FaithfulNode tree. FaithfulNode's textContent
// getter already walks children, so a bare read is enough (matches the DOM
// textContent the old hand-rolled Node getter emulated).
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
  // Faithful document double: createElement yields FaithfulNodes that model
  // real-DOM boolean-attr semantics (tests/_doubles.js), replacing the old
  // hand-rolled boolean-blind Node/document.
  const document = createDocument();
  const sandbox = { console: { error() {} }, document, innerWidth: 1024, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  // Non-ui.js collaborators the screens resolve at call time. shellLayout and
  // ADMIN_MENU are app collaborators (not ui.js primitives), so they stay
  // hand-stubbed; the `supa` fake stays as-is (migrating it to makeFakeSupa is
  // out of scope for this DOM-double lot).
  sandbox.shellLayout = (_menu, content) => content;
  sandbox.ADMIN_MENU = [];
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
  // Real js/ui.js FIRST: it defines window.el / textInput / selectInput /
  // truncatedCell / TRUNCATE_CELL_STYLE / toast / confirmDialog. el() carries
  // the UI-EL-BOOLEAN-ATTR-FIX, and the screens read every one of these via
  // window.* at call time, so they now render through the real primitives.
  vm.runInContext(uiSrc, sandbox, { filename: UI });
  // Re-override toast/confirmDialog AFTER ui.js: the tests assert on the
  // captured `toasts` array, so the real toast() (which appends to a #toasts
  // DOM node) must be replaced by the spy; confirmDialog is stubbed to a no-op
  // exactly as the old harness did.
  sandbox.toast = (message, level) => toasts.push({ message, level });
  sandbox.confirmDialog = () => {};
  vm.runInContext(cadSrc, sandbox, { filename: CAD });
  return { sandbox, calls, toasts, document };
}

async function openForm(harness, screenName, buttonText) {
  const root = await harness.sandbox[screenName]();
  const button = findAll(root, (node) => node.tagName === 'BUTTON' && textOf(node) === buttonText)[0];
  assert.ok(button, 'botao do formulario ausente');
  // Real el() wires on* handlers via addEventListener, so the primary button's
  // click lives at node._listeners.click (was button.onclick under the stub).
  button._listeners.click();
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

test('formatarCnpj aplica mascara progressiva durante a digitacao', () => {
  const { sandbox } = createHarness();
  const f = sandbox.RAVATEX_SCREENS.cadastros.formatarCnpj;
  assert.equal(f(''), '');
  assert.equal(f('1'), '1');
  assert.equal(f('12'), '12');
  assert.equal(f('123'), '12.3');
  assert.equal(f('12345'), '12.345');
  assert.equal(f('123456'), '12.345.6');
  assert.equal(f('12345678'), '12.345.678');
  assert.equal(f('123456789'), '12.345.678/9');
  assert.equal(f('123456789012'), '12.345.678/9012');
  assert.equal(f('1234567890123'), '12.345.678/9012-3');
  assert.equal(f('12345678901234'), '12.345.678/9012-34');
});

test('formatarCnpj filtra nao numericos e trunca a 14 digitos', () => {
  const { sandbox } = createHarness();
  const f = sandbox.RAVATEX_SCREENS.cadastros.formatarCnpj;
  assert.equal(f('12abc345@678/0001-90'), '12.345.678/0001-90');
  assert.equal(f('abc'), '');
  assert.equal(f('0000000000000012345678'), '00.000.000/0000-00');
});

test('input event de cliente aplica mascara e filtra nao numericos', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '123';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.3');

  cnpjInput.value = '12345678';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678');

  cnpjInput.value = '12345678901234';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');

  cnpjInput.value = 'abc';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '');

  cnpjInput.value = '12345678901234567890';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');
});

test('input event de fornecedor aplica mascara e filtra nao numericos', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosFornecedores', 'Novo fornecedor');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado no fornecedor');

  cnpjInput.value = '11444777000161';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '11.444.777/0001-61');

  cnpjInput.value = 'abc123';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.3');
});

test('cnpjInput aceita colagem de valor cru sem pontuacao', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12345678000190';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/0001-90');
});

test('cnpjInput aceita colagem de valor ja pontuado', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12.345.678/0001-90';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/0001-90');
});

test('cnpjInput filtra letras e simbolos mantendo digitos', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12abc345-678/0001XX90!!!!';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/0001-90');

  cnpjInput.value = 'abc';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '');
});

test('cnpjInput trunca apos 14 digitos na colagem', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12345678901234567890';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');
});

test('cnpjInput backspace mantem mascara corretamente', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12345678901234';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');

  cnpjInput.value = '1234567890123';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-3');

  cnpjInput.value = '12345678901';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/901');

  cnpjInput.value = '12345678';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678');

  cnpjInput.value = '12';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12');

  cnpjInput.value = '';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '');
});

test('cnpjInput reposiciona cursor apos mascara', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12345678901234';
  cnpjInput.selectionStart = 14;
  cnpjInput.selectionEnd = 14;
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');
  assert.ok(cnpjInput.selectionStart >= 14, 'cursor deve avancar com insercao de pontuacao');

  cnpjInput.value = '123';
  cnpjInput.selectionStart = 3;
  cnpjInput.selectionEnd = 3;
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.3');
  assert.ok(cnpjInput.selectionStart >= 3, 'cursor deve ser ajustado apos mascara');
});

test('cnpjInput edicao no meio preserva digitos', async () => {
  const harness = createHarness();
  await openForm(harness, 'screenCadastrosClientes', 'Novo cliente');
  const cnpjInput = inputByPlaceholder(findAll(harness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.ok(cnpjInput, 'input CNPJ encontrado');

  cnpjInput.value = '12345678901234';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.678/9012-34');

  cnpjInput.value = '12.345.999/9012-34';
  cnpjInput._listeners.input();
  assert.equal(cnpjInput.value, '12.345.999/9012-34');

  const clean = harness.sandbox.RAVATEX_SCREENS.cadastros.normalizarCnpj(cnpjInput.value);
  assert.equal(clean, '12345999901234');
});

test('cliente cria e edita usando somente clientes.cnpj', async () => {
  const createHarnessResult = createHarness();
  const create = await openForm(createHarnessResult, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(create.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente direto';
  inputByPlaceholder(create.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  await create.save._listeners.click();
  const insert = createHarnessResult.calls.find((call) => call.op === 'insert');
  assert.equal(insert.table, 'clientes');
  assert.equal(insert.payload.nome, 'Cliente direto');
  assert.equal(insert.payload.cnpj, '11222333000181');

  const editHarness = createHarness({ rows: { clientes: [{ id: 7, nome: 'Cliente direto', cnpj: '11222333000181' }], fornecedores: [] } });
  const root = await editHarness.sandbox.screenCadastrosClientes();
  const edit = findAll(root, (node) => node.tagName === 'BUTTON' && node._attrs.title === 'Editar cliente')[0];
  edit._listeners.click();
  const cnpj = inputByPlaceholder(findAll(editHarness.document.body, (node) => node.tagName === 'INPUT'), '00.000.000/0000-00');
  assert.equal(cnpj.value, '11.222.333/0001-81');
  cnpj.value = '11.444.777/0001-61';
  await findAll(editHarness.document.body, (node) => node.tagName === 'BUTTON' && textOf(node) === 'Salvar')[0]._listeners.click();
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
  await create.save._listeners.click();
  const insert = createHarnessResult.calls.find((call) => call.op === 'insert');
  assert.equal(insert.table, 'fornecedores');
  assert.equal(insert.payload.cnpj, '11222333000181');

  const editHarness = createHarness({ rows: { clientes: [], fornecedores: [{ id: 8, nome: 'Fornecedor direto', tipo: 'tecelagem', cnpj: '11222333000181' }] } });
  const root = await editHarness.sandbox.screenCadastrosFornecedores();
  const edit = findAll(root, (node) => node.tagName === 'BUTTON' && node._attrs.title === 'Editar fornecedor')[0];
  edit._listeners.click();
  const inputs = findAll(editHarness.document.body, (node) => node.tagName === 'INPUT');
  inputByPlaceholder(inputs, '00.000.000/0000-00').value = '11.444.777/0001-61';
  await findAll(editHarness.document.body, (node) => node.tagName === 'BUTTON' && textOf(node) === 'Salvar')[0]._listeners.click();
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
  await form.save._listeners.click();
  assert.equal(invalid.calls.some((call) => call.op === 'insert'), false);
  assert.match(invalid.toasts.at(-1).message, /inválido/i);

  const duplicateClient = createHarness({ writeError: () => ({ code: '23505', message: 'duplicate key value violates unique constraint "clientes_cnpj_uidx"' }) });
  const duplicateClientForm = await openForm(duplicateClient, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(duplicateClientForm.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente duplicado';
  inputByPlaceholder(duplicateClientForm.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  await duplicateClientForm.save._listeners.click();
  assert.match(duplicateClient.toasts.at(-1).message, /outro Cliente/i);

  const duplicate = createHarness({ writeError: () => ({ code: '23505', message: 'duplicate key value violates unique constraint "fornecedores_cnpj_uidx"' }) });
  const duplicateForm = await openForm(duplicate, 'screenCadastrosFornecedores', 'Novo fornecedor');
  inputByPlaceholder(duplicateForm.inputs, 'Ex: Tecelagem Fulano').value = 'Fornecedor duplicado';
  inputByPlaceholder(duplicateForm.inputs, '00.000.000/0000-00').value = '11.222.333/0001-81';
  findAll(duplicate.document.body, (node) => node.tagName === 'SELECT')[0].value = 'tecelagem';
  await duplicateForm.save._listeners.click();
  assert.match(duplicate.toasts.at(-1).message, /outro Fornecedor/i);
});

test('CNPJ vazio envia null nos dois formulários', async () => {
  const client = createHarness();
  const clientForm = await openForm(client, 'screenCadastrosClientes', 'Novo cliente');
  inputByPlaceholder(clientForm.inputs, 'Ex: LOJA CENTRAL').value = 'Cliente sem CNPJ';
  await clientForm.save._listeners.click();
  assert.equal(client.calls.find((call) => call.op === 'insert').payload.cnpj, null);

  const supplier = createHarness();
  const supplierForm = await openForm(supplier, 'screenCadastrosFornecedores', 'Novo fornecedor');
  inputByPlaceholder(supplierForm.inputs, 'Ex: Tecelagem Fulano').value = 'Fornecedor sem CNPJ';
  findAll(supplier.document.body, (node) => node.tagName === 'SELECT')[0].value = 'tecelagem';
  await supplierForm.save._listeners.click();
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

// TEST-MOCK-FIDELITY-AUDIT R1 demonstration: proves the faithful adoption
// catches what the old hand-rolled el() would have masked. That stub stored
// `node._attrs[key] = value` with no boolean-attr coercion, so disabled:false
// and disabled:true — and a raw setAttribute(k, false) regression — all
// rendered as an attribute present with a stringy value and could pass green
// (CODE_HEALTH_RULES.md §20). The real js/ui.js el() + FaithfulNode do not.
test('CNPJ screens: real el() + FaithfulNode catch a boolean-attr regression the old hand-mock masked (R1 demo)', () => {
  const { sandbox } = createHarness();
  const el = sandbox.el;
  // Fix path: real el() omits a falsy boolean attribute (UI-EL-BOOLEAN-ATTR-FIX),
  // verified through the faithful double.
  assert.equal(el('button', { disabled: false }).hasAttribute('disabled'), false,
    'disabled:false must be ABSENT');
  assert.equal(el('button', { disabled: true }).hasAttribute('disabled'), true,
    'disabled:true must be present');
  // Regression path: a raw setAttribute(k, false) (the pre-fix bug shape) still
  // renders PRESENT in a real-DOM-faithful node, so the bug class is caught —
  // the old hand-mock stored `_attrs[k] = false` and could not model this.
  const raw = new FaithfulNode('button');
  raw.setAttribute('disabled', false);
  assert.equal(raw.hasAttribute('disabled'), true,
    'setAttribute(k, false) renders present in the faithful node — the double catches the bug class');
});
