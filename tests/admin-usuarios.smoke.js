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
//
// CAMADA2-LAST-ACCESS-UI — coluna "Último acesso" (consumo de db/59) (22-25):
//  22. coluna presente no grid: header, formato dd/mm/aaaa hh:mm, fallback
//      "—" para last_sign_in_at nulo;
//  23. RPC admin_usuarios_last_sign_in chamada exatamente 1 vez por
//      reload() (merge client-side por id, nada de chamada por linha);
//  24. falha da RPC não derruba a tela: coluna inteira em "—",
//      console.warn chamado, lista de usuários continua visível;
//  25. ordenação "Último acesso" ativa: mais recente primeiro, nulos
//      (nunca acessou) sempre por último.

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

// Boolean-ish attrs exercised by this screen (disabled/checked). Mirrors
// real DOM semantics for UI-EL-BOOLEAN-ATTR-FIX: an attribute's mere
// presence makes it true regardless of its stringified value — only
// removeAttribute() clears it. A naive el() that still called
// setAttribute(k, false) would make this._attrs.disabled falsy but the
// coerced this.disabled below stays true, so a regression is caught.
const FAKE_NODE_BOOLEAN_ATTRS = new Set(['disabled', 'checked']);

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) {
    this._attrs[k] = v;
    if (FAKE_NODE_BOOLEAN_ATTRS.has(k)) this[k] = true;
  }
  removeAttribute(k) {
    delete this._attrs[k];
    if (FAKE_NODE_BOOLEAN_ATTRS.has(k)) this[k] = false;
  }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); }
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

// A3.2: com ordenação ativa por padrão (Nome A-Z), a posição das linhas no
// grid não é mais previsível pela ordem do fixture. Localiza a linha de um
// usuário pelo conteúdo (cada linha de dados tem exatamente 8 filhos diretos
// DIV desde CAMADA2-LAST-ACCESS-UI: email/nome/tipo/fornecedor/cliente/
// status/último acesso/ações — mesmo formato do headRow, mas o headRow
// nunca contém o texto procurado).
function findRowByText(main, needle) {
  const divs = findAll(main, (n) => n.tagName === 'DIV');
  return divs.find((d) => d.children && d.children.length === 8 && textOf(d).includes(needle));
}

function findByAriaLabel(root, label) {
  return findAll(root, (n) => n._attrs && n._attrs['aria-label'] === label)[0];
}

// Cliente Supabase fake com from().select()/update().eq()/insert() reais
// (encadeáveis + thenable), functions.invoke mockável por nome e
// rpc() mockável por nome (CAMADA2-LAST-ACCESS-UI — admin_usuarios_last_sign_in).
function makeFakeSupabaseClient({ tableData = {}, invokeImpl = {}, rpcImpl = {} } = {}) {
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
    rpc: async (name, params) => {
      calls.push({ op: 'rpc', name, params });
      if (rpcImpl[name]) return rpcImpl[name](params);
      return { data: [], error: null };
    },
    _calls: calls,
  };
}

function makeAdminUsuariosSandbox({ tableData = {}, invokeImpl = {}, rpcImpl = {} } = {}) {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient({ tableData, invokeImpl, rpcImpl });
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
    'detectOptionalColumns', 'fetchUsuariosPageData', 'fetchLastSignIn', 'createUsuario', 'updateUsuario',
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
  for (const label of ['E-MAIL', 'NOME', 'TIPO', 'FORNECEDOR', 'CLIENTE', 'STATUS', 'ULTIMO ACESSO', 'ACOES']) {
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
  // A3.2: ordenação padrão (Nome A-Z) reordena as linhas — não assumir
  // posição fixa. Localiza a linha de Bia (b@b.c) pelo conteúdo.
  const biaRow = findRowByText(main, 'b@b.c');
  assert.ok(biaRow, 'linha de Bia (b@b.c) não encontrada');
  const rowButtons = findAll(biaRow, (n) => n.tagName === 'BUTTON');
  const editBtn = rowButtons.find((b) => b._attrs && b._attrs.title === 'Editar usuario');
  const disableBtn = rowButtons.find((b) => b._attrs && b._attrs.title === 'Desativar usuario');
  assert.ok(editBtn, 'botão Editar da linha de Bia não encontrado');
  assert.ok(disableBtn, 'botão Desativar da linha de Bia não encontrado');
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
// Runtime — A3.2: cards-resumo, toolbar (ordenar/filtro), badges, opacidade
// -----------------------------------------------------------------------------
// Fixture USERS_FIXTURE: me-id (admin, ativo), u-2/Bia (fornecedor, ativo),
// u-3/Carla (admin, inativo). Admin=2 (1 ativo+1 inativo), Fornecedor=1
// (1 ativo), Cliente=0, Inativos=1 (de 3 no total).

test('16. cards-resumo (KPI): 4 cards com contagens corretas', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.match(rendered, /Administradores/);
  assert.match(rendered, /Fornecedores/);
  assert.match(rendered, /Clientes/);
  assert.match(rendered, /Inativos/);
  // Contagens: Admin=2 (1 ativo+1 inativo), Fornecedor=1 (1 ativo+0 inativo),
  // Cliente=0, Inativos=1 (de 3 no total).
  assert.match(rendered, /1 ativos · 1 inativos/, 'card Administradores deveria mostrar 1 ativos · 1 inativos');
  assert.match(rendered, /1 ativos · 0 inativos/, 'card Fornecedores deveria mostrar 1 ativos · 0 inativos');
  assert.match(rendered, /de 3 no total/, 'card Inativos deveria mostrar "de 3 no total"');
});

test('17. toolbar: selects de ordenar e filtro de tipo presentes com as opções certas', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const ordenarSelect = findByAriaLabel(main, 'Ordenar');
  const filtroSelect = findByAriaLabel(main, 'Filtrar por tipo');
  assert.ok(ordenarSelect, 'select "Ordenar" não encontrado');
  assert.ok(filtroSelect, 'select "Filtrar por tipo" não encontrado');
  const ordenarLabels = findAll(ordenarSelect, (n) => n.tagName === 'OPTION').map(textOf);
  assert.deepEqual(ordenarLabels, ['Nome A–Z', 'Nome Z–A', 'Tipo', 'Último acesso']);
  const filtroLabels = findAll(filtroSelect, (n) => n.tagName === 'OPTION').map(textOf);
  assert.deepEqual(filtroLabels, ['Todos', 'Admin', 'Fornecedor', 'Cliente']);
});

test('18. filtro por tipo (client-side, sem query nova): "Fornecedor" mostra só a linha da Bia', async () => {
  const { sandbox, fakeSupa } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const root = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const callsBefore = fakeSupa._calls.length;
  const flex = root.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const filtroSelect = findByAriaLabel(main, 'Filtrar por tipo');
  filtroSelect.value = 'fornecedor';
  filtroSelect._listeners.change({ target: filtroSelect });
  // renderStandalone() reconstrói o conteúdo de MAIN in-place; relê via flex.
  const mainAfter = flex.children.find((c) => c.tagName === 'MAIN');
  const renderedAfter = textOf(mainAfter);
  assert.ok(renderedAfter.includes('b@b.c'), 'linha da Bia deveria continuar visível com filtro Fornecedor');
  assert.ok(!renderedAfter.includes('me@ravatex.com'), 'linha do admin não deveria aparecer com filtro Fornecedor');
  // Nenhuma query nova disparada pelo filtro (é client-side sobre allUsers já carregado).
  assert.equal(fakeSupa._calls.length, callsBefore, 'filtro por tipo não deveria disparar nova chamada a supa');
});

test('19. ordenação "Nome Z–A" inverte a ordem das linhas visíveis', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const root = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = root.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const ordenarSelect = findByAriaLabel(main, 'Ordenar');
  ordenarSelect.value = 'nome-desc';
  ordenarSelect._listeners.change({ target: ordenarSelect });
  const mainAfter = flex.children.find((c) => c.tagName === 'MAIN');
  // Nome Z-A: "Eu Mesmo" (E) deve vir antes de "Bia" (B) em ordem de documento.
  // Linhas de dados têm exatamente 8 filhos diretos DIV (7 células + ações,
  // desde CAMADA2-LAST-ACCESS-UI); o e-mail é sempre a 1ª célula, então
  // basta checar o prefixo (textOf concatena células sem separador — não
  // usar regex de e-mail aqui, o domínio "vazaria" para o texto da célula
  // seguinte).
  const rowDivs = findAll(mainAfter, (n) => n.tagName === 'DIV' && n.children && n.children.length === 8);
  const idxEu = rowDivs.findIndex((d) => textOf(d).startsWith('me@ravatex.com'));
  const idxBia = rowDivs.findIndex((d) => textOf(d).startsWith('b@b.c'));
  assert.ok(idxEu !== -1 && idxBia !== -1, 'linhas de Eu Mesmo e Bia não encontradas');
  assert.ok(idxEu < idxBia, 'com Nome Z–A, "Eu Mesmo" deveria vir antes de "Bia" em ordem de documento');
});

test('20. badge de papel: cores corretas por tipo (Admin azul, Fornecedor cinza)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const meRow = findRowByText(main, 'me@ravatex.com');
  const biaRow = findRowByText(main, 'b@b.c');
  const meBadge = findAll(meRow, (n) => n.tagName === 'SPAN' && textOf(n) === 'Admin')[0];
  const biaBadge = findAll(biaRow, (n) => n.tagName === 'SPAN' && textOf(n) === 'Fornecedor')[0];
  assert.ok(meBadge, 'badge "Admin" não encontrado na linha do admin');
  assert.ok(biaBadge, 'badge "Fornecedor" não encontrado na linha da Bia');
  assert.match(meBadge._attrs.style, /#2563eb/, 'badge Admin deveria usar a cor #2563eb');
  assert.match(biaBadge._attrs.style, /#5a6472/, 'badge Fornecedor deveria usar a cor #5a6472');
});

test('21. linha inativa (Carla) tem opacidade reduzida (~0.6) quando "Mostrar inativos" está ligado', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  assert.ok(toggleInput, 'checkbox "Mostrar inativos" não encontrado');
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  const mainAfter = flex.children.find((c) => c.tagName === 'MAIN');
  const carlaRow = findRowByText(mainAfter, 'c@c.c');
  assert.ok(carlaRow, 'linha da Carla (inativa) deveria aparecer com "Mostrar inativos" ligado');
  assert.match(carlaRow._attrs.style, /opacity:0\.6/, 'linha inativa deveria ter opacity:0.6');
});

// -----------------------------------------------------------------------------
// Runtime — CAMADA2-LAST-ACCESS-UI: consumo da RPC db/59 (coluna "Último
// acesso"). Fixture USERS_FIXTURE: me-id (admin, ativo), u-2/Bia
// (fornecedor, ativo), u-3/Carla (admin, inativo).
// -----------------------------------------------------------------------------

// Mesma lógica de formatação de js/screens/admin-usuarios.js (formatLastSignIn),
// duplicada aqui só para calcular o valor esperado sem depender do fuso do
// executor do teste divergir do fuso de execução do código sob teste — ambos
// rodam no mesmo processo Node, então o resultado é sempre idêntico.
function expectedLastSignIn(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test('22. coluna "Último acesso": header presente, formato dd/mm/aaaa hh:mm e fallback "—" para nulo', async () => {
  const iso = '2026-07-16T01:43:00.000Z';
  const { sandbox } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    rpcImpl: {
      admin_usuarios_last_sign_in: async () => ({
        data: [
          { id: 'me-id', last_sign_in_at: iso },
          { id: 'u-2', last_sign_in_at: null },
        ],
        error: null,
      }),
    },
  });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.ok(rendered.includes('ULTIMO ACESSO'), 'cabeçalho "ULTIMO ACESSO" ausente');
  const meRow = findRowByText(main, 'me@ravatex.com');
  const biaRow = findRowByText(main, 'b@b.c');
  assert.ok(meRow && textOf(meRow).includes(expectedLastSignIn(iso)), 'linha do admin não mostra o último acesso formatado');
  assert.ok(biaRow && textOf(biaRow).includes('—'), 'linha da Bia (last_sign_in_at nulo) deveria mostrar "—"');
});

test('23. RPC admin_usuarios_last_sign_in é chamada exatamente 1 vez por reload() (não por linha)', async () => {
  const { sandbox, fakeSupa } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    rpcImpl: { admin_usuarios_last_sign_in: async () => ({ data: [], error: null }) },
  });
  await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const rpcCalls = fakeSupa._calls.filter((c) => c.op === 'rpc' && c.name === 'admin_usuarios_last_sign_in');
  assert.equal(rpcCalls.length, 1, 'RPC deveria ser chamada exatamente 1 vez (screenAdminUsuarios chama reload() 1x no boot), não 1x por linha');
});

test('24. falha da RPC não derruba a tela: coluna inteira em "—" e console.warn chamado', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    rpcImpl: { admin_usuarios_last_sign_in: async () => ({ data: null, error: { message: 'RPC indisponível' } }) },
  });
  vm.runInContext(`
    window.__warnCalls = [];
    window.console = Object.assign({}, window.console, {
      warn: function () { window.__warnCalls.push(Array.from(arguments)); }
    });
  `, sandbox);
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const warned = vm.runInContext('window.__warnCalls', sandbox);
  assert.ok(warned && warned.length >= 1, 'console.warn deveria ser chamado quando a RPC falha');
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const rendered = textOf(main);
  assert.ok(rendered.includes('me@ravatex.com'), 'lista de usuários deveria continuar visível mesmo com falha da RPC');
  const meRow = findRowByText(main, 'me@ravatex.com');
  assert.ok(textOf(meRow).includes('—'), 'coluna "Último acesso" deveria cair para "—" quando a RPC falha');
});

test('25. ordenação "Último acesso": mais recente primeiro, nulos (nunca acessou) por último', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    rpcImpl: {
      admin_usuarios_last_sign_in: async () => ({
        data: [
          { id: 'me-id', last_sign_in_at: '2026-07-16T10:00:00.000Z' },
          { id: 'u-2', last_sign_in_at: '2026-07-15T10:00:00.000Z' },
          // u-3 (Carla): sem linha na RPC — tratado como nulo/nunca acessou.
        ],
        error: null,
      }),
    },
  });
  const root = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = root.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  // Precisa exibir Carla (u-3, inativa) para verificar que o nulo dela vai por último.
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const ordenarSelect = findByAriaLabel(main, 'Ordenar');
  ordenarSelect.value = 'ultimo-acesso';
  ordenarSelect._listeners.change({ target: ordenarSelect });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const rowDivs = findAll(main, (n) => n.tagName === 'DIV' && n.children && n.children.length === 8);
  const idxMe = rowDivs.findIndex((d) => textOf(d).startsWith('me@ravatex.com'));
  const idxBia = rowDivs.findIndex((d) => textOf(d).startsWith('b@b.c'));
  const idxCarla = rowDivs.findIndex((d) => textOf(d).startsWith('c@c.c'));
  assert.ok(idxMe !== -1 && idxBia !== -1 && idxCarla !== -1, 'linhas não encontradas para verificar ordenação');
  assert.ok(idxMe < idxBia, 'usuário com acesso mais recente (me-id) deveria vir antes de u-2 (Bia)');
  assert.ok(idxBia < idxCarla, 'usuário sem acesso registrado (Carla, nulo) deveria vir por último');
});

// -----------------------------------------------------------------------------
// Runtime — A5.1-A5.2: reset de senha administrativo (botão, modal de
// confirmação, exibição única da senha gerada, wiring de escrita)
// -----------------------------------------------------------------------------

test('26. namespaces: resetarSenha/friendlyResetMessage (writes) e openResetarSenhaModal/openSenhaGeradaModal (modal) são funções', () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_WRITES.resetarSenha', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_WRITES.friendlyResetMessage', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_MODAL.openResetarSenhaModal', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_MODAL.openSenhaGeradaModal', sandbox), 'function');
});

test('27. botão "Resetar senha" presente por linha; guarda de auto-reset desabilitada na própria linha', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const meRow = findRowByText(main, 'me@ravatex.com');
  const resetBia = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Resetar senha')[0];
  const resetMe = findAll(meRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Nao pode resetar a propria senha')[0];
  assert.ok(resetBia, 'botão "Resetar senha" não encontrado na linha da Bia');
  assert.ok(!resetBia.disabled, 'botão de reset da Bia não deveria estar desabilitado');
  assert.ok(resetMe, 'botão de reset com guarda de auto-reset não encontrado na própria linha');
  assert.ok(resetMe.disabled, 'botão de reset da própria linha deveria estar desabilitado');
});

test('28. clicar em "Resetar senha" abre confirmDialog (modal de ui.js, não window.confirm)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const resetBia = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Resetar senha')[0];
  resetBia._listeners.click();
  const overlays = sandbox.document.body.children;
  const lastOverlay = overlays[overlays.length - 1];
  assert.ok(lastOverlay, 'nenhum modal foi montado em document.body');
  const h2 = findAll(lastOverlay, (n) => n.tagName === 'H2')[0];
  assert.equal(textOf(h2), 'Resetar senha', 'título do modal de confirmação deveria ser "Resetar senha"');
  assert.match(textOf(lastOverlay), /b@b\.c/, 'mensagem de confirmação deveria citar o e-mail do usuário-alvo');
});

test('29. sucesso: confirma o reset, chama resetarSenha(userId) e abre "Senha gerada" com a senha, botão copiar e aviso de exibição única', async () => {
  const senhaGerada = 'Xk7pQ2rT9mLv';
  const { sandbox, fakeSupa, toasts } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    invokeImpl: {
      'admin-reset-user-password': async (body) => ({
        data: { user_id: body.user_id, email: 'b@b.c', tipo: 'fornecedor', password: senhaGerada, senha_temporaria: true },
        error: null,
      }),
    },
  });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const resetBia = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Resetar senha')[0];
  resetBia._listeners.click();

  const confirmOverlay = sandbox.document.body.children[sandbox.document.body.children.length - 1];
  const confirmBtn = findAll(confirmOverlay, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Resetar senha')[0];
  assert.ok(confirmBtn, 'botão de confirmação "Resetar senha" não encontrado no modal');
  await confirmBtn._listeners.click();

  const invokeCall = fakeSupa._calls.find((c) => c.op === 'invoke' && c.name === 'admin-reset-user-password');
  assert.ok(invokeCall, 'resetarSenha não invocou admin-reset-user-password');
  assert.equal(invokeCall.body.user_id, 'u-2', 'invoke deveria ser chamado com o user_id da Bia');
  assert.ok(toasts.some((t) => t.type === 'success'), 'toast de sucesso não disparado');

  const senhaOverlay = sandbox.document.body.children.find((o) =>
    findAll(o, (n) => n.tagName === 'H2' && textOf(n) === 'Senha gerada').length > 0);
  assert.ok(senhaOverlay, 'modal "Senha gerada" não foi aberto após o reset');
  const rendered = textOf(senhaOverlay);
  assert.match(rendered, new RegExp(senhaGerada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'senha gerada não aparece no modal');
  assert.match(rendered, /Copiar senha/, 'botão "Copiar senha" ausente');
  assert.match(rendered, /não será exibida novamente/, 'aviso de exibição única ausente');
});

test('30. falha: toast de erro, "Senha gerada" NÃO abre (sem estado ambíguo)', async () => {
  const { sandbox, toasts } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    invokeImpl: {
      'admin-reset-user-password': async () => ({ data: null, error: { message: 'Apenas admins ativos podem resetar senha de usuários.' } }),
    },
  });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const resetBia = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Resetar senha')[0];
  resetBia._listeners.click();
  const confirmOverlay = sandbox.document.body.children[sandbox.document.body.children.length - 1];
  const confirmBtn = findAll(confirmOverlay, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Resetar senha')[0];
  await confirmBtn._listeners.click();

  assert.ok(toasts.some((t) => t.type === 'error'), 'toast de erro não disparado');
  const senhaOverlay = sandbox.document.body.children.find((o) =>
    findAll(o, (n) => n.tagName === 'H2' && textOf(n) === 'Senha gerada').length > 0);
  assert.equal(senhaOverlay, undefined, '"Senha gerada" não deveria abrir após falha (estado ambíguo)');
});

test('31. write: resetarSenha(userId) invoca admin-reset-user-password com { user_id }', async () => {
  const { sandbox, fakeSupa } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.resetarSenha('u-2')`, sandbox);
  const invokeCall = fakeSupa._calls.find((c) => c.op === 'invoke' && c.name === 'admin-reset-user-password');
  assert.ok(invokeCall, 'resetarSenha não invocou admin-reset-user-password');
  assert.equal(invokeCall.body.user_id, 'u-2');
});

// -----------------------------------------------------------------------------
// Runtime — A5.3-A5.4: reativação administrativa (ícone trocado em linhas
// inativas, confirmDialog, wiring de escrita)
// -----------------------------------------------------------------------------

test('32. namespaces: reativarUsuario/friendlyReactivateMessage (writes) e openReativarModal (modal) são funções', () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_WRITES.reativarUsuario', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_WRITES.friendlyReactivateMessage', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_MODAL.openReativarModal', sandbox), 'function');
});

test('33. linha inativa (Carla, com "Mostrar inativos" ligado): botão "Reativar usuario" no lugar de "Desativar usuario"', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const carlaRow = findRowByText(main, 'c@c.c');
  assert.ok(carlaRow, 'linha da Carla (inativa) não encontrada');
  const reativarBtn = findAll(carlaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Reativar usuario')[0];
  const desativarBtn = findAll(carlaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Desativar usuario')[0];
  assert.ok(reativarBtn, 'botão "Reativar usuario" ausente na linha inativa');
  assert.ok(!reativarBtn.disabled, 'botão "Reativar usuario" não deveria estar desabilitado');
  assert.equal(desativarBtn, undefined, 'linha inativa não deveria mostrar o botão "Desativar usuario"');

  const biaRow = findRowByText(main, 'b@b.c');
  const biaDesativar = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Desativar usuario')[0];
  const biaReativar = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Reativar usuario')[0];
  assert.ok(biaDesativar, 'linha ativa (Bia) deveria continuar mostrando "Desativar usuario"');
  assert.equal(biaReativar, undefined, 'linha ativa não deveria mostrar o botão "Reativar usuario"');
});

test('34. clicar em "Reativar usuario" abre confirmDialog citando o e-mail do alvo', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const carlaRow = findRowByText(main, 'c@c.c');
  const reativarBtn = findAll(carlaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Reativar usuario')[0];
  reativarBtn._listeners.click();
  const overlays = sandbox.document.body.children;
  const lastOverlay = overlays[overlays.length - 1];
  assert.ok(lastOverlay, 'nenhum modal foi montado em document.body');
  const h2 = findAll(lastOverlay, (n) => n.tagName === 'H2')[0];
  assert.equal(textOf(h2), 'Reativar usuário', 'título do modal de confirmação deveria ser "Reativar usuário"');
  assert.match(textOf(lastOverlay), /c@c\.c/, 'mensagem de confirmação deveria citar o e-mail do usuário-alvo');
});

test('35. sucesso: confirma a reativação, chama reativarUsuario(userId) e dispara toast de sucesso', async () => {
  const { sandbox, fakeSupa, toasts } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    invokeImpl: {
      'admin-reactivate-user': async (body) => ({
        data: { user_id: body.user_id, email: 'c@c.c', tipo: 'admin', ativo: true, auth_banned: false },
        error: null,
      }),
    },
  });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const carlaRow = findRowByText(main, 'c@c.c');
  const reativarBtn = findAll(carlaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Reativar usuario')[0];
  reativarBtn._listeners.click();

  const confirmOverlay = sandbox.document.body.children[sandbox.document.body.children.length - 1];
  const confirmBtn = findAll(confirmOverlay, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Reativar')[0];
  assert.ok(confirmBtn, 'botão de confirmação "Reativar" não encontrado no modal');
  await confirmBtn._listeners.click();

  const invokeCall = fakeSupa._calls.find((c) => c.op === 'invoke' && c.name === 'admin-reactivate-user');
  assert.ok(invokeCall, 'reativarUsuario não invocou admin-reactivate-user');
  assert.equal(invokeCall.body.user_id, 'u-3', 'invoke deveria ser chamado com o user_id da Carla');
  assert.ok(toasts.some((t) => t.type === 'success'), 'toast de sucesso não disparado');
});

test('36. falha: toast de erro amigável (código mapeado por friendlyReactivateMessage)', async () => {
  const { sandbox, toasts } = makeAdminUsuariosSandbox({
    tableData: USERS_FIXTURE,
    invokeImpl: {
      'admin-reactivate-user': async () => ({ data: null, error: { message: 'Usuário não está inativo.' } }),
    },
  });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const carlaRow = findRowByText(main, 'c@c.c');
  const reativarBtn = findAll(carlaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Reativar usuario')[0];
  reativarBtn._listeners.click();
  const confirmOverlay = sandbox.document.body.children[sandbox.document.body.children.length - 1];
  const confirmBtn = findAll(confirmOverlay, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Reativar')[0];
  await confirmBtn._listeners.click();
  assert.ok(toasts.some((t) => t.type === 'error'), 'toast de erro não disparado');
});

test('37. write: reativarUsuario(userId) invoca admin-reactivate-user com { user_id }', async () => {
  const { sandbox, fakeSupa } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  await vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_WRITES.reativarUsuario('u-3')`, sandbox);
  const invokeCall = fakeSupa._calls.find((c) => c.op === 'invoke' && c.name === 'admin-reactivate-user');
  assert.ok(invokeCall, 'reativarUsuario não invocou admin-reactivate-user');
  assert.equal(invokeCall.body.user_id, 'u-3');
});

// -----------------------------------------------------------------------------
// Runtime — UI-EL-BOOLEAN-ATTR-FIX: verified fixes for the two call sites
// confirmed/suspected by the architect (checkbox "Mostrar inativos" +
// botão Excluir). Uses hasAttribute() — presence, not raw setAttribute
// value — to actually exercise the real-DOM boolean-coercion class of bug
// (see tests/ui-el-boolean-attrs.smoke.js for the primitive-level suite).
// -----------------------------------------------------------------------------

test('38. checkbox "Mostrar inativos": renders WITHOUT the checked attribute on initial render (mostrarInativos=false)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  assert.ok(toggleInput, 'checkbox "Mostrar inativos" não encontrado');
  assert.equal(toggleInput.hasAttribute('checked'), false,
    'checkbox deveria renderizar SEM o atributo checked quando mostrarInativos=false (pré-fix: sempre presente, independente do estado)');
  assert.equal(toggleInput.checked, false);
});

test('39. checkbox "Mostrar inativos": após ligar, o novo nó renderizado tem o atributo checked presente', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  let main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleInput = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  toggleInput.checked = true;
  toggleInput._listeners.change({ target: toggleInput });
  main = flex.children.find((c) => c.tagName === 'MAIN');
  const toggleAfter = findAll(main, (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox')[0];
  assert.ok(toggleAfter, 'checkbox re-renderizado não encontrado');
  assert.equal(toggleAfter.hasAttribute('checked'), true,
    'checkbox re-renderizado deveria ter o atributo checked presente após ligar (mostrarInativos=true)');
  assert.equal(toggleAfter.checked, true);
});

test('40. botão "Excluir usuario": NÃO carrega o atributo disabled para uma linha que não é a própria (regressão do bug confirmado pelo arquiteto)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const excluirBia = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Excluir usuario')[0];
  assert.ok(excluirBia, 'botão Excluir da linha da Bia não encontrado');
  assert.equal(excluirBia.hasAttribute('disabled'), false,
    'botão Excluir de uma linha que não é a própria NÃO deveria ter o atributo disabled (pré-fix: sempre presente, bloqueando todo mundo)');
  assert.equal(excluirBia.disabled, false);
});

test('41. botão "Excluir usuario": carrega o atributo disabled apenas na própria linha (guarda de auto-proteção preservada)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const meRow = findRowByText(main, 'me@ravatex.com');
  const excluirMe = findAll(meRow, (n) => n.tagName === 'BUTTON' && n._attrs && n._attrs.title === 'Nao pode excluir o proprio usuario')[0];
  assert.ok(excluirMe, 'botão Excluir com guarda de auto-proteção não encontrado na própria linha');
  assert.equal(excluirMe.hasAttribute('disabled'), true, 'botão Excluir da própria linha deveria ter o atributo disabled presente');
  assert.equal(excluirMe.disabled, true);
});

// -----------------------------------------------------------------------------
// Runtime — UI-ACTION-BUTTON-MIGRATION-2: all 4 row actions now built via
// window.actionButton() (UI_VISUAL_CONTRACT.md §8.1). Dimensions/hover/
// safe-disabled are unit-proven in tests/ui-action-button.smoke.js; these
// tests verify the sr-only label is actually present per row button (the
// concrete proof the migration happened, since window.el() alone never
// produced one) and the ACOES column was widened to fit 4 buttons.
// -----------------------------------------------------------------------------

test('42. todos os 4 botões de ação da linha (Editar/Resetar/Desativar/Excluir) têm rótulo sr-only via padrão clip-rect', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const rowButtons = findAll(biaRow, (n) => n.tagName === 'BUTTON');
  assert.equal(rowButtons.length, 4, 'linha da Bia deveria ter exatamente 4 botões de ação');
  for (const btn of rowButtons) {
    const srSpan = btn.children[btn.children.length - 1];
    assert.ok(srSpan && srSpan.tagName === 'SPAN', `botão "${btn._attrs.title}" deveria ter um SPAN sr-only como último filho`);
    assert.match(srSpan._attrs.style || '', /clip:rect\(0,0,0,0\)/, `sr-only do botão "${btn._attrs.title}" deveria usar o padrão clip-rect`);
  }
});

test('43. botão Excluir usuario usa danger (cor #d6403a); botão Desativar/Reativar permanece neutro (#8a93a3, sem mudança de comportamento)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const biaRow = findRowByText(main, 'b@b.c');
  const excluirBtn = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs.title === 'Excluir usuario')[0];
  const desativarBtn = findAll(biaRow, (n) => n.tagName === 'BUTTON' && n._attrs.title === 'Desativar usuario')[0];
  assert.match(excluirBtn._attrs.style, /color:#d6403a/, 'Excluir deveria manter a cor danger');
  assert.match(desativarBtn._attrs.style, /color:#8a93a3/, 'Desativar deveria permanecer neutro (mesmo comportamento pré-migração)');
});

test('44. coluna ACOES: grid-template widened to 138px (4 buttons × 30px + 3 gaps × 6px)', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const gridUsers = findAll(main, (n) => n._attrs && n._attrs.style && /grid-template-columns:2fr/.test(n._attrs.style));
  assert.ok(gridUsers.length > 0, 'nenhum elemento com grid-template-columns encontrado');
  for (const el of gridUsers) {
    assert.match(el._attrs.style, /138px/, 'grid-template-columns deveria terminar em 138px (coluna ACOES)');
    assert.doesNotMatch(el._attrs.style, /102px/, 'a largura antiga (102px, insuficiente para 4 botões) não deveria mais aparecer');
  }
});

// -----------------------------------------------------------------------------
// Runtime — UI-USERS-GRID-TEXT-OVERFLOW: E-MAIL/NOME/FORNECEDOR/CLIENTE cells
// truncate with an ellipsis instead of wrapping/overflowing, each carrying a
// `title` tooltip with the full value. Grid template report:
//   '2fr 1fr 110px 1fr 1fr 90px 130px 138px'
//   (E-MAIL / NOME / TIPO / FORNECEDOR / CLIENTE / STATUS / ULTIMO ACESSO / ACOES)
// -----------------------------------------------------------------------------

test('45. grid-template report: E-MAIL widened to 2fr; NOME/FORNECEDOR/CLIENTE unchanged at 1fr', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const gridUsers = findAll(main, (n) => n._attrs && n._attrs.style && /grid-template-columns:2fr/.test(n._attrs.style));
  assert.ok(gridUsers.length > 0, 'nenhum elemento com grid-template-columns encontrado');
  for (const el of gridUsers) {
    assert.match(el._attrs.style, /grid-template-columns:2fr 1fr 110px 1fr 1fr 90px 130px 138px/,
      'grid-template-columns deveria ser exatamente "2fr 1fr 110px 1fr 1fr 90px 130px 138px"');
  }
});

test('46. célula E-MAIL: nowrap + ellipsis + min-width:0 + title com o valor completo', async () => {
  const longEmail = 'usuario.com.nome.bem.longo.para.testar.truncamento@empresa-exemplo.com.br';
  const fixture = {
    usuarios: [{ id: 'u-x', email: longEmail, nome: 'Longo', tipo: 'admin', ativo: true, fornecedor: null, cliente: null }],
    fornecedores: [], clientes: [],
  };
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: fixture });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const emailCell = findAll(main, (n) => n._attrs && n._attrs.title === longEmail)[0];
  assert.ok(emailCell, 'célula E-MAIL com title completo não encontrada');
  assert.match(emailCell._attrs.style, /white-space:nowrap/);
  assert.match(emailCell._attrs.style, /overflow:hidden/);
  assert.match(emailCell._attrs.style, /text-overflow:ellipsis/);
  assert.match(emailCell._attrs.style, /min-width:0/);
  assert.equal(textOf(emailCell), longEmail, 'o texto completo continua no DOM (o corte é só visual via CSS)');
});

test('47. células NOME/FORNECEDOR/CLIENTE: mesmo tratamento de truncamento; título ausente quando valor é "—"', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const meRow = findRowByText(main, 'me@ravatex.com');
  // me-id (admin) tem nome "Eu Mesmo" mas fornecedor/cliente nulos ("—").
  const nomeCell = findAll(meRow, (n) => n._attrs && n._attrs.title === 'Eu Mesmo')[0];
  assert.ok(nomeCell, 'célula NOME com title não encontrada');
  assert.match(nomeCell._attrs.style, /white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;/);
  const dashCells = findAll(meRow, (n) => n.tagName === 'DIV' && textOf(n) === '—');
  assert.ok(dashCells.length >= 2, 'deveria haver ao menos 2 células "—" (fornecedor/cliente) na linha do admin');
  for (const cell of dashCells) {
    assert.equal(cell._attrs.title, undefined, 'célula com valor "—" não deveria ter title (evita tooltip inútil)');
  }
});

test('48. cabeçalho: E-MAIL/NOME/FORNECEDOR/CLIENTE usam o mesmo tratamento de truncamento; TIPO/STATUS/ULTIMO ACESSO permanecem sem ellipsis', async () => {
  const { sandbox } = makeAdminUsuariosSandbox({ tableData: USERS_FIXTURE });
  const node = await vm.runInContext('window.screenAdminUsuarios()', sandbox);
  const flex = node.children.find((c) => c.tagName === 'DIV');
  const main = flex.children.find((c) => c.tagName === 'MAIN');
  const headCells = findAll(main, (n) => n.tagName === 'DIV' && n._attrs && /font-weight:700/.test(n._attrs.style || '') && /letter-spacing:\.04em/.test(n._attrs.style || ''));
  const byLabel = {};
  headCells.forEach((c) => { byLabel[textOf(c)] = c; });
  for (const label of ['E-MAIL', 'NOME', 'FORNECEDOR', 'CLIENTE']) {
    assert.ok(byLabel[label], `cabeçalho "${label}" não encontrado`);
    assert.match(byLabel[label]._attrs.style, /overflow:hidden; text-overflow:ellipsis; min-width:0;/, `cabeçalho "${label}" deveria ter o tratamento de truncamento`);
  }
  for (const label of ['TIPO', 'STATUS']) {
    assert.ok(byLabel[label], `cabeçalho "${label}" não encontrado`);
    assert.doesNotMatch(byLabel[label]._attrs.style, /text-overflow:ellipsis/, `cabeçalho "${label}" não deveria ter ellipsis`);
  }
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
