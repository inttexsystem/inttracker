// Smoke test dos módulos js/trocar-senha-writes.js e
// js/screens/trocar-senha-obrigatoria.js (CAMADA2-A4.2 — guarda de troca
// de senha obrigatória).
//
// Garante:
//
// Estáticos (1-3):
//   1. os 2 arquivos existem e são scripts clássicos (sem import/export);
//   2. node --check passa nos 2;
//   3. window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria e
//      window.screenTrocarSenhaObrigatoria são funções.
//
// Write (js/trocar-senha-writes.js) (4-6):
//   4. sucesso: chama supa.auth.updateUser({password}) e depois
//      supa.from('usuarios').update({senha_temporaria:false}).eq('id', userId);
//   5. falha em updateUser: devolve { ok:false, stage:'auth' }, NÃO chama
//      o update do perfil (nada de estado parcial silencioso);
//   6. updateUser OK mas update do perfil falha: devolve
//      { ok:false, stage:'flag' } — sinaliza o estado parcial real.
//
// Tela — modo normal (7-12):
//   7. render: título, texto, 2 campos de senha, checklist com os 3
//      itens, botão "Definir nova senha" desabilitado, link "Sair da conta";
//   8. checklist reage por tecla: 8+ caracteres com dígito mas senhas
//      diferentes → 2 critérios satisfeitos, botão continua desabilitado;
//   9. senhas coincidindo + 8+ caracteres + dígito → os 3 critérios
//      satisfeitos, botão habilitado;
//  10. toggle de visibilidade alterna type password↔text;
//  11. submit com sucesso: chama trocarSenhaObrigatoria(userId, senha),
//      toast de sucesso, loadCurrentUser + routeAfterLogin chamados;
//  12. submit com falha 'auth'/'flag': toast de erro, loadCurrentUser/
//      routeAfterLogin NÃO chamados (sem navegação silenciosa).
//
// Tela — modo expirado (13):
//  13. sem campos/checklist/botão de submit; mensagem de expiração;
//      "Sair da conta" como botão primário, chama window.logout().
//
// Sair da conta (14):
//  14. em qualquer modo, "Sair da conta" chama window.logout() (fluxo
//      real, não um atalho novo).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const WRITES = path.join(ROOT, 'js', 'trocar-senha-writes.js');
const SCREEN = path.join(ROOT, 'js', 'screens', 'trocar-senha-obrigatoria.js');
const UI     = path.join(ROOT, 'js', 'ui.js');

const writesSrc = fs.readFileSync(WRITES, 'utf8');
const screenSrc = fs.readFileSync(SCREEN, 'utf8');
const uiSrc     = fs.readFileSync(UI,     'utf8');

// -----------------------------------------------------------------------------
// 1. Estáticos
// -----------------------------------------------------------------------------

test('1. os 2 arquivos existem e são scripts clássicos (sem import/export)', () => {
  for (const [label, p, src] of [
    ['js/trocar-senha-writes.js', WRITES, writesSrc],
    ['js/screens/trocar-senha-obrigatoria.js', SCREEN, screenSrc],
  ]) {
    assert.ok(fs.existsSync(p), `${label} não existe`);
    assert.equal(/^\s*export\s+/m.test(src), false, `${label} parece usar export`);
    assert.equal(/import\s+.*\s+from\s+/.test(src), false, `${label} parece usar import`);
  }
});

test('2. node --check passa nos 2 arquivos', () => {
  for (const p of [WRITES, SCREEN]) {
    cp.execSync(`node --check "${p}"`, { stdio: 'pipe' });
  }
});

// -----------------------------------------------------------------------------
// Helpers de runtime: FakeNode (com .style, diferente do FakeNode mínimo de
// outros smokes — este módulo mutila .style.opacity/.style.color em resposta
// a eventos 'input', então precisa de um objeto real ali) + document mock +
// supa mock (auth.updateUser + from().update().eq()).
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
    this.type = '';
    this.style = {};
    this._attrs = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'disabled') this.disabled = v; if (k === 'type') this.type = v; }
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

function makeFakeSupabaseClient({ updateUserImpl, updateProfileImpl } = {}) {
  const calls = [];
  return {
    auth: {
      updateUser: async (payload) => {
        calls.push({ op: 'auth.updateUser', payload });
        if (updateUserImpl) return updateUserImpl(payload);
        return { error: null };
      },
    },
    from: (table) => ({
      update: (payload) => {
        calls.push({ op: 'update', table, payload });
        return {
          eq: (col, val) => {
            calls.push({ op: 'eq', table, col, val });
            if (updateProfileImpl) return updateProfileImpl(payload);
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    }),
    _calls: calls,
  };
}

function makeSandbox({ updateUserImpl, updateProfileImpl } = {}) {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupabaseClient({ updateUserImpl, updateProfileImpl });
  const toasts = [];
  const calls = { loadCurrentUser: 0, routeAfterLogin: 0, logout: 0 };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
    Node: FakeNode,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  sandbox.toast = (message, type) => { toasts.push({ message, type }); };
  sandbox.CURRENT_USER = { id: 'u1', tipo: 'admin' };
  sandbox.loadCurrentUser = async () => { calls.loadCurrentUser++; };
  sandbox.routeAfterLogin = async () => { calls.routeAfterLogin++; };
  sandbox.logout = async () => { calls.logout++; };
  sandbox.supa = fakeSupa;

  vm.runInContext(writesSrc, sandbox, { filename: 'js/trocar-senha-writes.js' });
  vm.runInContext(screenSrc, sandbox, { filename: 'js/screens/trocar-senha-obrigatoria.js' });

  return { sandbox, fakeSupa, toasts, calls };
}

// -----------------------------------------------------------------------------
// 3. Namespaces
// -----------------------------------------------------------------------------

test('3. window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria e window.screenTrocarSenhaObrigatoria são funções', () => {
  const { sandbox } = makeSandbox();
  assert.equal(typeof vm.runInContext('window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window.screenTrocarSenhaObrigatoria', sandbox), 'function');
});

// -----------------------------------------------------------------------------
// Write — js/trocar-senha-writes.js
// -----------------------------------------------------------------------------

test('4. sucesso: chama auth.updateUser({password}) e depois usuarios.update({senha_temporaria:false}).eq(id, userId)', async () => {
  const { sandbox, fakeSupa } = makeSandbox();
  const result = await vm.runInContext(`window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria('u1', 'novaSenha123')`, sandbox);
  assert.equal(result.ok, true);
  const authCall = fakeSupa._calls.find((c) => c.op === 'auth.updateUser');
  assert.ok(authCall, 'auth.updateUser não foi chamado');
  assert.equal(authCall.payload.password, 'novaSenha123');
  const updateCall = fakeSupa._calls.find((c) => c.op === 'update' && c.table === 'usuarios');
  assert.ok(updateCall, 'usuarios.update não foi chamado');
  assert.equal(updateCall.payload.senha_temporaria, false);
  assert.equal(Object.keys(updateCall.payload).length, 1, 'payload do update deveria conter só senha_temporaria');
  const eqCall = fakeSupa._calls.find((c) => c.op === 'eq');
  assert.equal(eqCall.col, 'id');
  assert.equal(eqCall.val, 'u1');
});

test('5. falha em updateUser: devolve { ok:false, stage:"auth" } e NÃO chama o update do perfil', async () => {
  const boom = { message: 'weak password' };
  const { sandbox, fakeSupa } = makeSandbox({ updateUserImpl: async () => ({ error: boom }) });
  const result = await vm.runInContext(`window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria('u1', 'x')`, sandbox);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'auth');
  const updateCall = fakeSupa._calls.find((c) => c.op === 'update');
  assert.equal(updateCall, undefined, 'não deveria ter chamado usuarios.update após falha em updateUser');
});

test('6. updateUser OK mas update do perfil falha: devolve { ok:false, stage:"flag" } (estado parcial real)', async () => {
  const boom = { message: 'RLS denied' };
  const { sandbox } = makeSandbox({ updateProfileImpl: async () => ({ data: null, error: boom }) });
  const result = await vm.runInContext(`window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria('u1', 'x')`, sandbox);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'flag');
});

// -----------------------------------------------------------------------------
// Tela — modo normal
// -----------------------------------------------------------------------------

function renderNormal(sandbox) {
  return vm.runInContext('window.screenTrocarSenhaObrigatoria()', sandbox);
}

test('7. modo normal: título, texto, 2 campos, checklist com 3 itens, botão desabilitado, "Sair da conta"', () => {
  const { sandbox } = makeSandbox();
  const root = renderNormal(sandbox);
  const rendered = textOf(root);
  assert.match(rendered, /Troca de senha obrigatória/);
  assert.match(rendered, /Sua senha atual é temporária/);
  assert.match(rendered, /Mínimo de 8 caracteres/);
  assert.match(rendered, /Ao menos 1 dígito/);
  assert.match(rendered, /As duas senhas coincidem/);
  assert.match(rendered, /Sair da conta/);
  const inputs = findAll(root, (n) => n.tagName === 'INPUT');
  assert.equal(inputs.length, 2, 'deveria ter 2 campos de senha');
  assert.ok(inputs.every((i) => i.type === 'password'), 'campos deveriam iniciar como type=password');
  const submitBtn = findAll(root, (n) => n.tagName === 'BUTTON' && n._attrs.type === 'submit')[0];
  assert.ok(submitBtn, 'botão de submit não encontrado');
  assert.ok(submitBtn.disabled, 'botão deveria iniciar desabilitado');
});

test('8. checklist reage por tecla: senha forte mas confirmação diferente → 2/3 critérios, botão continua desabilitado', () => {
  const { sandbox } = makeSandbox();
  const root = renderNormal(sandbox);
  const inputs = findAll(root, (n) => n.tagName === 'INPUT');
  const [novaInput, confirmInput] = inputs;
  novaInput.value = 'senha1234';
  novaInput._listeners.input({ target: novaInput });
  confirmInput.value = 'diferente1';
  confirmInput._listeners.input({ target: confirmInput });

  const submitBtn = findAll(root, (n) => n.tagName === 'BUTTON' && n._attrs.type === 'submit')[0];
  assert.equal(submitBtn.disabled, true, 'botão deveria continuar desabilitado com senhas diferentes');

  const rows = findAll(root, (n) => n.tagName === 'SPAN' && /caracteres|dígito|coincidem/.test(textOf(n)));
  const lengthRow = rows.find((r) => /caracteres/.test(textOf(r)));
  const digitRow = rows.find((r) => /dígito/.test(textOf(r)));
  const matchRow = rows.find((r) => /coincidem/.test(textOf(r)));
  assert.equal(lengthRow.style.color, '#18794a', '"Mínimo de 8 caracteres" deveria estar satisfeito (verde)');
  assert.equal(digitRow.style.color, '#18794a', '"Ao menos 1 dígito" deveria estar satisfeito (verde)');
  assert.equal(matchRow.style.color, '#8a93a3', '"As duas senhas coincidem" deveria continuar pendente (cinza)');
});

test('9. senhas coincidindo + 8+ caracteres + dígito → os 3 critérios satisfeitos, botão habilitado', () => {
  const { sandbox } = makeSandbox();
  const root = renderNormal(sandbox);
  const [novaInput, confirmInput] = findAll(root, (n) => n.tagName === 'INPUT');
  novaInput.value = 'senha1234';
  novaInput._listeners.input({ target: novaInput });
  confirmInput.value = 'senha1234';
  confirmInput._listeners.input({ target: confirmInput });

  const submitBtn = findAll(root, (n) => n.tagName === 'BUTTON' && n._attrs.type === 'submit')[0];
  assert.equal(submitBtn.disabled, false, 'botão deveria estar habilitado com os 3 critérios satisfeitos');
  const rows = findAll(root, (n) => n.tagName === 'SPAN' && /caracteres|dígito|coincidem/.test(textOf(n)));
  for (const r of rows) assert.equal(r.style.color, '#18794a', `"${textOf(r)}" deveria estar satisfeito (verde)`);
});

test('10. toggle de visibilidade alterna type password↔text', () => {
  const { sandbox } = makeSandbox();
  const root = renderNormal(sandbox);
  const [novaInput] = findAll(root, (n) => n.tagName === 'INPUT');
  const toggleBtn = findAll(root, (n) => n.tagName === 'BUTTON' && n._attrs['aria-label'] === 'Mostrar senha')[0];
  assert.ok(toggleBtn, 'botão de mostrar/ocultar senha não encontrado');
  toggleBtn._listeners.click();
  assert.equal(novaInput.type, 'text', 'após 1 clique, o campo deveria virar type=text');
  assert.equal(toggleBtn._attrs['aria-label'], 'Ocultar senha');
  toggleBtn._listeners.click();
  assert.equal(novaInput.type, 'password', 'após 2 cliques, o campo deveria voltar a type=password');
});

test('11. submit com sucesso: chama trocarSenhaObrigatoria, toast de sucesso, loadCurrentUser + routeAfterLogin chamados', async () => {
  const { sandbox, calls, toasts, fakeSupa } = makeSandbox();
  const root = renderNormal(sandbox);
  const [novaInput, confirmInput] = findAll(root, (n) => n.tagName === 'INPUT');
  novaInput.value = 'senha1234';
  novaInput._listeners.input({ target: novaInput });
  confirmInput.value = 'senha1234';
  confirmInput._listeners.input({ target: confirmInput });
  const form = findAll(root, (n) => n.tagName === 'FORM')[0];
  await form._listeners.submit({ preventDefault() {} });

  assert.ok(fakeSupa._calls.some((c) => c.op === 'auth.updateUser' && c.payload.password === 'senha1234'));
  assert.ok(toasts.some((t) => t.type === 'success'), 'toast de sucesso não disparado');
  assert.equal(calls.loadCurrentUser, 1, 'loadCurrentUser deveria ter sido chamado 1x após sucesso');
  assert.equal(calls.routeAfterLogin, 1, 'routeAfterLogin deveria ter sido chamado 1x após sucesso');
});

test('12. submit com falha "auth"/"flag": toast de erro, loadCurrentUser/routeAfterLogin NÃO chamados', async () => {
  const { sandbox, calls, toasts } = makeSandbox({ updateUserImpl: async () => ({ error: { message: 'boom' } }) });
  const root = renderNormal(sandbox);
  const [novaInput, confirmInput] = findAll(root, (n) => n.tagName === 'INPUT');
  novaInput.value = 'senha1234';
  novaInput._listeners.input({ target: novaInput });
  confirmInput.value = 'senha1234';
  confirmInput._listeners.input({ target: confirmInput });
  const form = findAll(root, (n) => n.tagName === 'FORM')[0];
  await form._listeners.submit({ preventDefault() {} });

  assert.ok(toasts.some((t) => t.type === 'error'), 'toast de erro não disparado');
  assert.equal(calls.loadCurrentUser, 0, 'loadCurrentUser NÃO deveria ser chamado após falha');
  assert.equal(calls.routeAfterLogin, 0, 'routeAfterLogin NÃO deveria ser chamado após falha (sem navegação silenciosa)');
});

// -----------------------------------------------------------------------------
// Tela — modo expirado
// -----------------------------------------------------------------------------

test('13. modo expirado: sem campos/checklist/botão de submit; mensagem de expiração; "Sair da conta" primário', () => {
  const { sandbox } = makeSandbox();
  const root = vm.runInContext('window.screenTrocarSenhaObrigatoria({ expired: true })', sandbox);
  const rendered = textOf(root);
  assert.match(rendered, /Senha expirada/);
  assert.match(rendered, /Contate um administrador/);
  assert.equal(findAll(root, (n) => n.tagName === 'INPUT').length, 0, 'não deveria ter campos no modo expirado');
  assert.equal(findAll(root, (n) => n.tagName === 'FORM').length, 0, 'não deveria ter formulário no modo expirado');
  const sairBtn = findAll(root, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Sair da conta')[0];
  assert.ok(sairBtn, 'botão "Sair da conta" não encontrado no modo expirado');
});

// -----------------------------------------------------------------------------
// Sair da conta
// -----------------------------------------------------------------------------

test('14. "Sair da conta" chama window.logout() (normal e expirado)', async () => {
  const { sandbox: sbNormal, calls: callsNormal } = makeSandbox();
  const rootNormal = renderNormal(sbNormal);
  const sairNormal = findAll(rootNormal, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Sair da conta')[0];
  await sairNormal._listeners.click();
  assert.equal(callsNormal.logout, 1, 'logout deveria ter sido chamado no modo normal');

  const { sandbox: sbExpired, calls: callsExpired } = makeSandbox();
  const rootExpired = vm.runInContext('window.screenTrocarSenhaObrigatoria({ expired: true })', sbExpired);
  const sairExpired = findAll(rootExpired, (n) => n.tagName === 'BUTTON' && textOf(n) === 'Sair da conta')[0];
  await sairExpired._listeners.click();
  assert.equal(callsExpired.logout, 1, 'logout deveria ter sido chamado no modo expirado');
});
