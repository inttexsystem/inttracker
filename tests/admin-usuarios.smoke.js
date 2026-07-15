// Smoke test dos módulos js/admin-usuarios-writes.js,
// js/screens/admin-usuarios-modal.js e js/screens/admin-usuarios.js
// (fase CAMADA2-USUARIOS-A3-1 — extração 1:1 de screenCadastrosUsuarios
// em js/screens/cadastros.js:2226-2713, sem alteração de comportamento).
//
// Garante PARIDADE com a tela anterior: mesmos elementos visuais
// (grid, badges, busca, toggle "Mostrar inativos", botões de ação por
// ícone), mesmas ações (criar/editar/desativar/excluir) e mesmo wiring
// de escrita (Edge Functions admin-create-user/admin-disable-user/
// admin-delete-user + PostgREST update em observações).
//
// Estáticos (1-4):
//   1. os 3 arquivos existem e são scripts clássicos (sem import/export);
//   2. node --check passa nos 3;
//   3. window.RAVATEX_ADMIN_USUARIOS_WRITES expõe as funções esperadas;
//   4. window.RAVATEX_ADMIN_USUARIOS_MODAL expõe as 3 funções de modal;
//      window.screenAdminUsuarios é função.
//
// Runtime — paridade visual (5-9):
//   5. screenAdminUsuarios() devolve <div> com shellLayout (header/aside/main);
//   6. render contém "+ Novo usuario", busca, toggle "Mostrar inativos",
//      cabeçalho de grid (E-MAIL/NOME/TIPO/FORNECEDOR/CLIENTE/STATUS/ACOES);
//   7. linha do usuário mostra email/nome/tipo/badge de status;
//   8. botão "Desativar" presente (não placeholder antigo); botões de
//      ação (editar/desativar/excluir) com título e ícone corretos;
//   9. guardas de auto-proteção: usuário não pode desativar/excluir a
//      si mesmo (botão disabled/opacity reduzida).
//
// Runtime — wiring de escrita (10-14):
//  10. clique em "+ Novo usuario" chama RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal
//      com (null, forns, clients, columnSupport, {onSaved});
//  11. clique em "Editar" chama openUsuarioModal com o usuário certo;
//  12. clique em "Desativar" (guardas OK) chama openDesativarModal;
//  13. clique em "Excluir" (guardas OK) chama openExcluirModal;
//  14. writes: createUsuario/updateUsuario/disableUsuario/deleteUsuario
//      chamam window.supa nas tabelas/Edge Functions certas com o
//      payload certo (unit, sem passar pela UI do modal).
//
// Não-regressão (15):
//  15. cadastros.js não foi alterado por esta fase (screenCadastrosUsuarios
//      continua presente, intocado, até a remoção isolada em A3.4).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const WRITES = path.join(ROOT, 'js', 'admin-usuarios-writes.js');
const MODAL  = path.join(ROOT, 'js', 'screens', 'admin-usuarios-modal.js');
const SCREEN = path.join(ROOT, 'js', 'screens', 'admin-usuarios.js');
const UI     = path.join(ROOT, 'js', 'ui.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD    = path.join(ROOT, 'js', 'screens', 'cadastros.js');

const writesSrc = fs.readFileSync(WRITES, 'utf8');
const modalSrc  = fs.readFileSync(MODAL,  'utf8');
const screenSrc = fs.readFileSync(SCREEN, 'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const cadSrc    = fs.readFileSync(CAD,    'utf8');

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. os 3 arquivos existem e são scripts clássicos (sem import/export)', () => {
  for (const [label, p, src] of [
    ['js/admin-usuarios-writes.js', WRITES, writesSrc],
    ['js/screens/admin-usuarios-modal.js', MODAL, modalSrc],
    ['js/screens/admin-usuarios.js', SCREEN, screenSrc],
  ]) {
    assert.ok(fs.existsSync(p), `${label} não existe`);
    assert.equal(/^\s*export\s+/m.test(src), false, `${label} parece usar export`);
    assert.equal(/import\s+.*\s+from\s+/.test(src), false, `${label} parece usar import`);
  }
});

test('2. node --check passa nos 3 arquivos', () => {
  for (const p of [WRITES, MODAL, SCREEN]) {
    cp.execSync(`node --check "${p}"`, { stdio: 'pipe' });
  }
});

// -----------------------------------------------------------------------------
// Helpers de runtime: FakeNode + document mock + supa mock completo
// (com functions.invoke e update().eq() encadeável, diferente do mock
// mais simples usado pelos testes read-only de cadastros-screens.smoke.js).
// -----------------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren(...ns) {
    this.children = [];
    for (const n of ns.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? { textContent: n, appendChild(){}, setAttribute(){} } : n);
    }
  }
  classList = { add() {}, remove() {} };
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function findAll(node, pred, out) {
  out = out || [];
  if (!node) return out;
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

// Cliente Supabase fake com from().select()/update().eq()/insert() reais
// (encadeáveis + thenable) e functions.invoke mockável por nome.
function makeFakeSupabaseClient({ tableData = {}, invokeImpl = {} } = {}) {
  const calls = [];
  function makeChain(table) {
    const chain = {
      _table: table,
      select(cols) { calls.push({ op: 'select', table, cols }); return chain; },
      order() { return chain; },
      update(payload) {
        calls.push({ op: 'update', table, payload });
        return {
          eq(col, val) {
            calls.push({ op: 'eq', table, col, val });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      eq() { return chain; },
      then(resolve, reject) {
        return Promise.resolve({ data: tableData[table] || [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  }
  return {
    from(table) { calls.push({ op: 'from', table }); return makeChain(table); },
    functions: {
      invoke: async (name, opts) => {
        calls.push({ op: 'invoke', name, body: opts && opts.body });
        if (invokeImpl[name]) return invokeImpl[name](opts && opts.body);
        return { data: { user_id: 'new-user-id' }, error: null };
      },
    },
    _calls: calls,
  };
}

function makeAdminUsuariosSandbox({ tableData = {}, invokeImpl = {} } = {}) {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient({ tableData, invokeImpl });
  const toasts = [];
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  sandbox.CURRENT_USER = { id: 'me-id', nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' }); // expõe window.labelFornecedorTipo
  vm.runInContext(writesSrc, sandbox, { filename: 'js/admin-usuarios-writes.js' });
  vm.runInContext(modalSrc,  sandbox, { filename: 'js/screens/admin-usuarios-modal.js' });
  vm.runInContext(screenSrc, sandbox, { filename: 'js/screens/admin-usuarios.js' });

  // toast espião — sobrescreve o de ui.js para capturar chamadas nos testes de wiring.
  sandbox.toast = (message, type) => { toasts.push({ message, type }); };

  sandbox.supa = fakeSupa;
  return { sandbox, fakeSupa, toasts };
}

// -----------------------------------------------------------------------------
// Namespaces
// -----------------------------------------------------------------------------

test('3. window.RAVATEX_ADMIN_USUARIOS_WRITES expõe as funções esperadas', () => {
  const { sandbox } = makeAdminUsuariosSandbox();
  for (const fn of [
    'detectOptionalColumns', 'fetchUsuariosPageData', 'createUsuario', 'updateUsuario',
    'updateUsuarioObservacoes', 'disableUsuario', 'deleteUsuario', 'parseEdgeFunctionError',
    'friendlyDisableMessage', 'friendlyDeleteMessage',
  ]) {
    assert.equal(typeof vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.${fn}`, sandbox), 'function',
      `RAVATEX_ADMIN_USUARIOS_WRITES.${fn} não é função`);
  }
});

test('4. window.RAVATEX_ADMIN_USUARIOS_MODAL expõe os 3 modais; window.screenAdminUsuarios é função', () => {
  const { sandbox } = makeAdminUsuariosSandbox();
  for (const fn of ['openUsuarioModal', 'openDesativarModal', 'openExcluirModal']) {
    assert.equal(typeof vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_MODAL.${fn}`, sandbox), 'function',
      `RAVATEX_ADMIN_USUARIOS_MODAL.${fn} não é função`);
  }
  assert.equal(typeof vm.runInContext('window.screenAdminUsuarios', sandbox), 'function',
    'window.screenAdminUsuarios não é função');
});

// -----------------------------------------------------------------------------
// Runtime — paridade visual
// -----------------------------------------------------------------------------

const USERS_FIXTURE = {
  usuarios: [
    { id: 'me-id', email: 'me@ravatex.com', nome: 'Eu Mesmo', tipo: 'admin', ativo: true, fornecedor: null, cliente: null },
    { id: 'u-2', email: 'b@b.c', nome: 'Bia', tipo: 'fornecedor', ativo: true,
      fornecedor: { id: 'f-1', nome: 'Tec X', tipo: 'tecelagem' }, cliente: null },
    { id: 'u-3', email: 'c@c.c', nome: 'Carla', tipo: 'admin', ativo: false, fornecedor: null, cliente: null },
  ],
  fornecedores: [{ id: 'f-1', nome: 'Tec X', tipo: 'tecelagem' }],
  clientes: [],
};

test('5. screenAdminUsuarios() devolve <div> com shellLayout (header/aside/main)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  assert.ok(node && node.tagName === 'DIV', 'screenAdminUsuarios não devolveu <div>');
  const header = node.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'sem header (shellLayout não aplicado)');
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const aside = flex && flex.children.find((c) => c.tagName === 'ASIDE');
  const main  = flex && flex.children.find((c) => c.tagName === 'MAIN');
  assert.ok(aside, 'sem aside');
  assert.ok(main, 'sem main');
});

test('6. render contém "+ Novo usuario", busca, toggle e cabeçalho de grid', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.match(rendered, /Novo usuario/);
  assert.match(rendered, /Mostrar inativos/);
  for (const label of ['E-MAIL', 'NOME', 'TIPO', 'FORNECEDOR', 'CLIENTE', 'STATUS', 'ACOES']) {
    assert.ok(rendered.includes(label), `cabeçalho de grid "${label}" ausente`);
  }
});

test('7. linha do usuário mostra email/nome/tipo e badge de status', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.ok(rendered.includes('b@b.c'));
  assert.ok(rendered.includes('Bia'));
  assert.match(rendered, /Ativo/);
  // Carla é inativa e só aparece com "Mostrar inativos" — por padrão
  // (mostrarInativos=false) não deve estar na lista.
  assert.ok(!rendered.includes('Carla'), 'usuário inativo apareceu sem "Mostrar inativos" marcado');
});

test('8. botão "Desativar" presente (não placeholder antigo); ações com título correto', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const buttons = findAll(main, (n) => n.tagName === 'BUTTON');
  const titles = buttons.map((b) => b._attrs && b._attrs.title).filter(Boolean);
  assert.ok(titles.includes('Editar usuario'), 'botão Editar ausente');
  assert.ok(titles.includes('Desativar usuario'), 'botão Desativar ausente');
  assert.ok(titles.includes('Excluir usuario'), 'botão Excluir ausente');
  assert.equal(titles.some((t) => /Em breve/i.test(t)), false, 'placeholder antigo "Em breve" não deve aparecer');
});

test('9. guardas de auto-proteção: usuário logado não pode desativar/excluir a si mesmo', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const buttons = findAll(main, (n) => n.tagName === 'BUTTON');
  const excluirMe = buttons.find((b) => b._attrs && /proprio usuario/i.test(b._attrs.title || ''));
  assert.ok(excluirMe, 'botão de excluir com guarda de auto-proteção não encontrado');
  assert.equal(excluirMe.disabled, true, 'botão de excluir o próprio usuário deveria estar disabled');
});

// -----------------------------------------------------------------------------
// Runtime — wiring de escrita (spies sobre RAVATEX_ADMIN_USUARIOS_MODAL)
// -----------------------------------------------------------------------------

test('10. clique em "+ Novo usuario" chama openUsuarioModal(null, forns, clients, columnSupport, {onSaved})', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  vm.runInContext(`
    window.__calls = [];
    window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal = function () {
      window.__calls.push(Array.from(arguments));
    };
  `, sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const buttons = findAll(main, (n) => n.tagName === 'BUTTON');
  const novoBtn = buttons.find((b) => /Novo usuario/.test(textOf(b)));
  assert.ok(novoBtn, 'botão "+ Novo usuario" não encontrado');
  novoBtn._listeners.click();
  const calls = vm.runInContext('window.__calls', sandbox);
  assert.equal(calls.length, 1, 'openUsuarioModal não foi chamado exatamente 1 vez');
  assert.equal(calls[0][0], null, 'primeiro argumento deveria ser null (criação)');
  assert.equal(typeof calls[0][4].onSaved, 'function', 'options.onSaved deveria ser função');
});

test('11-13. cliques em Editar/Desativar/Excluir chamam os modais certos', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  vm.runInContext(`
    window.__editCalls = [];
    window.__disableCalls = [];
    window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal = function (usr) { window.__editCalls.push(usr); };
    window.RAVATEX_ADMIN_USUARIOS_MODAL.openDesativarModal = function (usr) { window.__disableCalls.push(usr); };
  `, sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const buttons = findAll(main, (n) => n.tagName === 'BUTTON');
  // Linhas visíveis (mostrarInativos=false) preservam a ordem do fixture:
  // [0]=me@ravatex.com, [1]=b@b.c (Carla/u-3 é inativa e fica oculta).
  // O 2º botão "Editar usuario"/"Desativar usuario" em ordem de documento
  // corresponde à linha de Bia.
  const editBtn = buttons.filter((b) => b._attrs && b._attrs.title === 'Editar usuario')[1];
  const disableBtn = buttons.filter((b) => b._attrs && b._attrs.title === 'Desativar usuario')[1];
  assert.ok(editBtn, 'botão Editar da 2ª linha (Bia) não encontrado');
  assert.ok(disableBtn, 'botão Desativar da 2ª linha (Bia) não encontrado');
  editBtn._listeners.click();
  disableBtn._listeners.click();
  const editCalls = vm.runInContext('window.__editCalls', sandbox);
  const disableCalls = vm.runInContext('window.__disableCalls', sandbox);
  assert.equal(editCalls.length, 1, 'openUsuarioModal (editar) não foi chamado');
  assert.equal(editCalls[0].email, 'b@b.c', 'openUsuarioModal chamado com usuário errado');
  assert.equal(disableCalls.length, 1, 'openDesativarModal não foi chamado');
  assert.equal(disableCalls[0].email, 'b@b.c', 'openDesativarModal chamado com usuário errado');
});

test('14. writes: createUsuario/updateUsuario/disableUsuario/deleteUsuario chamam supa corretamente', async () => {
  const { sandbox, fakeSupa } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });

  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.createUsuario({ email: 'x@x.c', password: '123456', nome: 'X', tipo: 'admin' })`, sandbox);
  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.updateUsuario('u-2', { email: 'b@b.c', nome: 'Bia 2', tipo: 'fornecedor' })`, sandbox);
  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.disableUsuario('u-2', 'motivo teste')`, sandbox);
  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.deleteUsuario('u-2', 'b@b.c')`, sandbox);

  const invokeCalls = fakeSupa._calls.filter((c) => c.op === 'invoke');
  assert.ok(invokeCalls.some((c) => c.name === 'admin-create-user' && c.body.email === 'x@x.c'),
    'createUsuario não invocou admin-create-user com o payload certo');
  assert.ok(invokeCalls.some((c) => c.name === 'admin-disable-user' && c.body.user_id === 'u-2' && c.body.reason === 'motivo teste'),
    'disableUsuario não invocou admin-disable-user com o payload certo');
  assert.ok(invokeCalls.some((c) => c.name === 'admin-delete-user' && c.body.user_id === 'u-2' && c.body.confirm_email === 'b@b.c'),
    'deleteUsuario não invocou admin-delete-user com o payload certo');

  const updateCalls = fakeSupa._calls.filter((c) => c.op === 'update' && c.table === 'usuarios');
  assert.ok(updateCalls.some((c) => c.payload.nome === 'Bia 2'),
    'updateUsuario não chamou supa.from("usuarios").update com o payload certo');
});

// -----------------------------------------------------------------------------
// Não-regressão
// -----------------------------------------------------------------------------

test('15. cadastros.js não foi alterado por esta fase (screenCadastrosUsuarios intocado)', () => {
  assert.match(cadSrc, /function\s+screenCadastrosUsuarios\s*\(/,
    'cadastros.js deveria continuar declarando screenCadastrosUsuarios (remoção é escopo de A3.4, não A3.1)');
  assert.match(cadSrc, /window\.screenCadastrosUsuarios\s*=\s*screenCadastrosUsuarios/,
    'window.screenCadastrosUsuarios deveria continuar exposto (remoção é escopo de A3.4)');
});
