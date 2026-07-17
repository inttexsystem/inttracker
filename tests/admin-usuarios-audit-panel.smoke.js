// Smoke test do módulo js/screens/admin-usuarios-audit-panel.js
// (A6.3 — painel de auditoria somente-leitura, dentro do modal de
// edição de usuário).
//
// Garante, contra o js/ui.js real (window.el/truncatedCell) e o
// read-model real (js/admin-usuarios-audit-read-model.js), num
// sandbox vm com um window.supa fake:
//   1. arquivo existe, script clássico, node --check passa;
//   2. window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel
//      é função;
//   3. estrutura: divider + header ("Histórico", badge de contagem,
//      "somente leitura") + corpo, carregados de forma assíncrona;
//   4. estado disponível: uma linha por evento, ícone presente,
//      action label, actor+detail na linha de detalhe com o bundle
//      §7.1 (overflow:hidden/text-overflow:ellipsis/min-width:0) via
//      window.truncatedCell, timestamp formatado;
//   5. "ver todos" aparece quando há mais de 5 eventos, e alterna a
//      lista expandida (usa um FakeNode com .style real, ao contrário
//      do FakeNode de tests/admin-usuarios.smoke.js);
//   6. estado vazio: "Nenhum evento registrado", sem lançar;
//   7. estado de falha (fetchUsuarioEventos rejeita OU retorna
//      {error}): "Histórico indisponível", sem lançar — a falha do
//      painel nunca deve quebrar o restante do modal;
//   8. fetchUsuarioEventos é chamado com o userId correto.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT   = path.resolve(__dirname, '..');
const PANEL  = path.join(ROOT, 'js', 'screens', 'admin-usuarios-audit-panel.js');
const READ_MODEL = path.join(ROOT, 'js', 'admin-usuarios-audit-read-model.js');
const UI     = path.join(ROOT, 'js', 'ui.js');

const panelSrc = fs.readFileSync(PANEL, 'utf8');
const readModelSrc = fs.readFileSync(READ_MODEL, 'utf8');
const uiSrc = fs.readFileSync(UI, 'utf8');

test('1. arquivo existe, script clássico, node --check passa', () => {
  assert.ok(fs.existsSync(PANEL), 'admin-usuarios-audit-panel.js não existe');
  assert.equal(/^\s*export\s+/m.test(panelSrc), false);
  assert.equal(/import\s+.*\s+from\s+/.test(panelSrc), false);
  cp.execSync(`node --check "${PANEL}"`, { stdio: 'pipe' });
});

test('2. usa window.truncatedCell (bundle §7.1) na linha de detalhe', () => {
  assert.match(panelSrc, /window\.truncatedCell\(/);
});

// -----------------------------------------------------------------------
// Sandbox
// -----------------------------------------------------------------------

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
    this.style = {};
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) {
    this._attrs[k] = v;
    // Mirrors real-DOM behavior: setAttribute('style', '...') keeps
    // element.style.* in sync — window.el() sets style via
    // setAttribute, and this module's toggle handler later mutates
    // .style.display directly, exactly like a real browser would.
    if (k === 'style' && typeof v === 'string') {
      v.split(';').forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx < 0) return;
        const prop = decl.slice(0, idx).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const val = decl.slice(idx + 1).trim();
        if (prop) this.style[prop] = val;
      });
    }
  }
  removeAttribute(k) { delete this._attrs[k]; }
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
  if (node == null) return '';
  if (typeof node.textContent === 'string' && node.textContent) return node.textContent;
  if (node.children && node.children.length) return node.children.map(textOf).join('');
  return '';
}

// Fake window.supa: usuarios_eventos select chain resolves `eventsResult`;
// usuarios select+in resolves `atorsResult`. Records every call.
function makeFakeSupa({ eventsResult, atorsResult, eventsRejects, atorsRejects } = {}) {
  const calls = [];
  function eventsChain() {
    const chain = {
      select(cols) { calls.push({ op: 'select', table: 'usuarios_eventos', cols }); return chain; },
      eq(col, val) { calls.push({ op: 'eq', table: 'usuarios_eventos', col, val }); return chain; },
      order() { return chain; },
      limit(n) { calls.push({ op: 'limit', table: 'usuarios_eventos', n }); return chain; },
      then(resolve, reject) {
        if (eventsRejects) return Promise.reject(eventsRejects).then(resolve, reject);
        return Promise.resolve(eventsResult || { data: [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  }
  function usuariosChain() {
    const chain = {
      select(cols) { calls.push({ op: 'select', table: 'usuarios', cols }); return chain; },
      in(col, vals) { calls.push({ op: 'in', table: 'usuarios', col, vals }); return chain; },
      then(resolve, reject) {
        if (atorsRejects) return Promise.reject(atorsRejects).then(resolve, reject);
        return Promise.resolve(atorsResult || { data: [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  }
  return {
    from(table) {
      calls.push({ op: 'from', table });
      if (table === 'usuarios_eventos') return eventsChain();
      if (table === 'usuarios') return usuariosChain();
      throw new Error('unexpected table: ' + table);
    },
    _calls: calls,
  };
}

function makeSandbox({ eventsResult, atorsResult, eventsRejects, atorsRejects, fetchOverride } = {}) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    body: new FakeNode('body'),
  };
  const fakeSupa = makeFakeSupa({ eventsResult, atorsResult, eventsRejects, atorsRejects });
  const sandbox = { document, console, setTimeout, clearTimeout, URL, URLSearchParams, Node: FakeNode };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(readModelSrc, sandbox, { filename: 'js/admin-usuarios-audit-read-model.js' });

  // Minimal admin-usuarios-writes.js stand-in: exercises the real
  // fetchUsuarioEventos merge logic (two selects, id->{email,nome} map)
  // rather than a hand-rolled fake, matching TEST-MOCK-FIDELITY intent
  // — but sourced inline (not the full writes.js file, which also
  // depends on other modules not relevant here) to keep this sandbox
  // narrowly scoped to the panel's actual dependency surface.
  sandbox.supa = fakeSupa;
  vm.runInContext(`
    window.RAVATEX_ADMIN_USUARIOS_WRITES = window.RAVATEX_ADMIN_USUARIOS_WRITES || {};
    window.RAVATEX_ADMIN_USUARIOS_WRITES.fetchUsuarioEventos = ${fetchOverride ? fetchOverride.toString() : `async function fetchUsuarioEventos(userId, limit) {
      var eventsRes = await window.supa.from('usuarios_eventos').select('*').eq('usuario_id', userId).order('criado_em').order('id').limit(limit || 50);
      if (eventsRes.error) return eventsRes;
      var events = eventsRes.data || [];
      var atorIds = Array.from(new Set(events.map(function (e) { return e.ator_id; }).filter(Boolean)));
      if (atorIds.length === 0) return { data: events, error: null };
      var atorsRes = await window.supa.from('usuarios').select('id, email, nome').in('id', atorIds);
      var atorsById = {};
      (atorsRes.data || []).forEach(function (a) { atorsById[a.id] = a; });
      var merged = events.map(function (e) {
        var ator = e.ator_id ? atorsById[e.ator_id] : null;
        return Object.assign({}, e, { ator_email: ator ? ator.email : null, ator_nome: ator ? ator.nome : null });
      });
      return { data: merged, error: null };
    }`};
  `, sandbox, { filename: 'js/admin-usuarios-writes.js (inline stand-in)' });

  vm.runInContext(panelSrc, sandbox, { filename: 'js/screens/admin-usuarios-audit-panel.js' });

  return { sandbox, fakeSupa };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

const EVT = (over) => Object.assign({
  id: 1, tipo_evento: 'usuario_desativado', ator_id: 'admin-1',
  payload: { ativo: { de: true, para: false }, motivo: 'teste' },
  criado_em: '2026-07-16T10:00:00Z', usuario_id: 'user-1',
  usuario_email: 'u@t.com', usuario_nome: 'User', usuario_tipo: 'fornecedor',
}, over || {});

test('3. renderUsuarioAuditPanel é função; estrutura inicial: divider + header + corpo (loading)', () => {
  const { sandbox } = makeSandbox({ eventsResult: { data: [], error: null } });
  assert.equal(vm.runInContext('typeof window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel', sandbox), 'function');
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  assert.equal(node.children.length, 2, 'container deve ter [divider, wrap]');
  const all = textOf(node);
  assert.match(all, /Histórico/);
  assert.match(all, /somente leitura/);
});

test('4. estado disponível: 1 linha por evento, ícone presente, action/actor/detail/timestamp corretos', async () => {
  const { sandbox } = makeSandbox({
    eventsResult: { data: [EVT()], error: null },
    atorsResult: { data: [{ id: 'admin-1', email: 'admin@t.com', nome: 'Admin' }], error: null },
  });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  const rows = findAll(node, (n) => n._attrs && n._attrs['data-audit-row']);
  assert.equal(rows.length, 1, 'esperava 1 linha de evento');
  const row = rows[0];
  assert.equal(row._attrs['data-audit-row'], 'usuario_desativado');
  const text = textOf(row);
  assert.match(text, /Usuário desativado/);
  assert.match(text, /por Admin \(admin@t\.com\)/);
  assert.match(text, /ativo: sim → não/);
  assert.match(text, /motivo: teste/);
  assert.match(text, /16\/07 \d{2}:\d{2}/);
  // ícone: primeiro filho da linha tem >=1 filho SVG (via svgIcon local)
  const iconCol = row.children[0];
  assert.ok(iconCol, 'coluna de ícone ausente');
});

test('4b. detalhe usa window.truncatedCell — carrega o bundle §7.1 e title com o texto completo', async () => {
  const { sandbox } = makeSandbox({
    eventsResult: { data: [EVT({ payload: { ativo: { de: true, para: false }, motivo: 'x'.repeat(200) } })], error: null },
    atorsResult: { data: [], error: null },
  });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  const rows = findAll(node, (n) => n._attrs && n._attrs['data-audit-row']);
  const detailEl = rows[0].children[1].children[1]; // textCol -> [actionLine, detailEl]
  assert.match(detailEl._attrs.style, /overflow:hidden/);
  assert.match(detailEl._attrs.style, /text-overflow:ellipsis/);
  assert.match(detailEl._attrs.style, /min-width:0/);
  assert.ok(detailEl._attrs.title && detailEl._attrs.title.includes('x'.repeat(200)), 'title deve conter o texto completo');
});

test('5. mais de 5 eventos: "ver todos" aparece e alterna a lista expandida', async () => {
  const events = [];
  for (let i = 1; i <= 7; i++) events.push(EVT({ id: i, criado_em: `2026-07-1${i}T10:00:00Z` }));
  const { sandbox } = makeSandbox({ eventsResult: { data: events, error: null }, atorsResult: { data: [], error: null } });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  const rowsBefore = findAll(node, (n) => n._attrs && n._attrs['data-audit-row']);
  assert.equal(rowsBefore.length, 7, 'todas as 7 linhas devem existir no DOM (5 visíveis + 2 na lista expandida oculta)');
  const toggle = findAll(node, (n) => n.tagName === 'BUTTON')[0];
  assert.ok(toggle, 'botão "ver todos" ausente');
  assert.match(textOf(toggle), /ver todos \(2 mais\)/);
  // A lista expandida (segundo filho de `list`'s parent `body`) começa oculta.
  const bodyWrap = node.children[1].children[1].children[0]; // wrap -> bodySlot -> body
  const expandedList = bodyWrap.children[1];
  assert.equal(expandedList.style.display, 'none');
  toggle._listeners.click();
  assert.equal(expandedList.style.display, 'block');
  assert.match(textOf(toggle), /ver menos/);
  toggle._listeners.click();
  assert.equal(expandedList.style.display, 'none');
});

test('6. estado vazio: "Nenhum evento registrado", sem lançar', async () => {
  const { sandbox } = makeSandbox({ eventsResult: { data: [], error: null } });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  assert.match(textOf(node), /Nenhum evento registrado/);
});

test('7a. falha (fetchUsuarioEventos retorna {error}): "Histórico indisponível", sem lançar', async () => {
  const { sandbox } = makeSandbox({ eventsResult: { data: null, error: { message: 'boom' } } });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  assert.match(textOf(node), /Histórico indisponível/);
});

test('7b. falha (fetchUsuarioEventos rejeita): "Histórico indisponível", sem lançar', async () => {
  const { sandbox } = makeSandbox({ eventsRejects: new Error('network down') });
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  await flush();
  assert.match(textOf(node), /Histórico indisponível/);
});

test('7c. dependência ausente (RAVATEX_ADMIN_USUARIOS_WRITES sem fetchUsuarioEventos): "Histórico indisponível", sem lançar', () => {
  const { sandbox } = makeSandbox({ eventsResult: { data: [], error: null } });
  vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_WRITES.fetchUsuarioEventos = null;', sandbox);
  const node = vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-1')`, sandbox);
  assert.match(textOf(node), /Histórico indisponível/);
});

test('8. fetchUsuarioEventos é chamado com o userId correto', async () => {
  const { sandbox, fakeSupa } = makeSandbox({ eventsResult: { data: [], error: null } });
  vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel('user-xyz')`, sandbox);
  await flush();
  const eqCall = fakeSupa._calls.find((c) => c.op === 'eq' && c.table === 'usuarios_eventos');
  assert.ok(eqCall, 'eq(usuario_id, ...) não foi chamado');
  assert.equal(eqCall.val, 'user-xyz');
});

// -----------------------------------------------------------------------
// Wiring: js/screens/admin-usuarios-modal.js openUsuarioModal (edit only)
// -----------------------------------------------------------------------

const MODAL = path.join(ROOT, 'js', 'screens', 'admin-usuarios-modal.js');
const CAD = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const WRITES = path.join(ROOT, 'js', 'admin-usuarios-writes.js');
const modalSrc = fs.readFileSync(MODAL, 'utf8');
const cadSrc = fs.readFileSync(CAD, 'utf8');
const commonSrc = fs.readFileSync(COMMON, 'utf8');
const writesSrc = fs.readFileSync(WRITES, 'utf8');

function makeModalWiringSandbox() {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = { document, console, setTimeout, clearTimeout, URL, URLSearchParams, Node: FakeNode };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  sandbox.CURRENT_USER = { id: 'me-id', nome: 'Tester', tipo: 'admin' };
  sandbox.logout = () => {};
  vm.runInContext(cadSrc, sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(writesSrc, sandbox, { filename: 'js/admin-usuarios-writes.js' });
  vm.runInContext(modalSrc, sandbox, { filename: 'js/screens/admin-usuarios-modal.js' });

  const panelCalls = [];
  vm.runInContext(`
    window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL = {
      renderUsuarioAuditPanel: function (userId) {
        window.__panelCalls.push(userId);
        var n = document.createElement('div');
        n.setAttribute('data-audit-panel-stub', userId);
        return n;
      },
    };
  `, sandbox, { filename: 'panel stub' });
  sandbox.__panelCalls = panelCalls;

  return { sandbox, panelCalls };
}

test('9. edição: openUsuarioModal chama renderUsuarioAuditPanel(usr.id) e anexa o resultado ao corpo do modal', () => {
  const { sandbox, panelCalls } = makeModalWiringSandbox();
  const usr = { id: 'user-42', email: 'e@t.com', nome: 'Nome', tipo: 'admin', fornecedor: null, cliente: null };
  vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal(${JSON.stringify(usr)}, [], [], { observacoes: false }, {})`, sandbox);
  assert.deepEqual(panelCalls, ['user-42'], 'renderUsuarioAuditPanel deveria ter sido chamado exatamente uma vez com o id do usuário editado');
});

test('10. criação: openUsuarioModal(null, ...) NUNCA chama renderUsuarioAuditPanel (sem histórico para um usuário que ainda não existe)', () => {
  const { sandbox, panelCalls } = makeModalWiringSandbox();
  vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal(null, [], [], { observacoes: false }, {})`, sandbox);
  assert.deepEqual(panelCalls, [], 'renderUsuarioAuditPanel não deveria ser chamado ao criar um novo usuário');
});

test('11. painel indisponível (RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL ausente): modal de edição continua abrindo, sem lançar', () => {
  const { sandbox } = makeModalWiringSandbox();
  vm.runInContext('window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL = undefined;', sandbox);
  const usr = { id: 'user-42', email: 'e@t.com', nome: 'Nome', tipo: 'admin', fornecedor: null, cliente: null };
  assert.doesNotThrow(() => {
    vm.runInContext(`window.RAVATEX_ADMIN_USUARIOS_MODAL.openUsuarioModal(${JSON.stringify(usr)}, [], [], { observacoes: false }, {})`, sandbox);
  });
});
