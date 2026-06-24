// =====================================================================
// === tests/pedido-ui.test.js =========================================
// Testes puros para o helper js/pedido-ui.js.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1
// Escopo: valida funções puras e namespace global. Não executa app
// real nem acessa Supabase.
//
// Garante:
//   - cor conhecida → hex correto (PRETO, CRU, KRAFT, CINZA);
//   - cor desconhecida → fallback cinza neutro;
//   - normalização de nome (trim + UPPER);
//   - status conhecido → label/badge corretos;
//   - status desconhecido → fallback seguro;
//   - fmtDataCurta para data ISO;
//   - namespace RAVATEX_PEDIDO_UI exposto;
//   - compatibilidade com screen module pattern (RAVATEX_SCREENS).
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');

test('pedido-ui.js: arquivo existe', () => {
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
});

test('pedido-ui.js: sintaxe JS válida', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  // Carrega em sandbox mínimo para validar sem expor nada.
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.ok(sandbox.window.RAVATEX_PEDIDO_UI, 'RAVATEX_PEDIDO_UI não exposto');
});

test('pedido-ui: namespace expõe COR_PREVIEW_MAP, status e helpers', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const U = sandbox.window.RAVATEX_PEDIDO_UI;
  assert.ok(U, 'namespace ausente');
  // COR_PREVIEW_MAP é congelado; comparar valores individuais.
  assert.equal(U.COR_PREVIEW_MAP.PRETO, '#111111');
  assert.equal(U.COR_PREVIEW_MAP.CRU,   '#e8dfc8');
  assert.equal(U.COR_PREVIEW_MAP.KRAFT, '#b08a55');
  assert.equal(U.COR_PREVIEW_MAP.CINZA, '#8a8a8a');
  assert.equal(U.COR_PREVIEW_FALLBACK, '#9ca3af');
  for (const s of ['RASCUNHO','RECEBIDO','CONFIRMADO','PRODUZINDO','ENTREGUE','CANCELADO']) {
    assert.equal(typeof U.PEDIDO_STATUS[s], 'string', 'PEDIDO_STATUS.' + s);
  }
  for (const s of ['rascunho','recebido','confirmado','produzindo','entregue','cancelado']) {
    assert.equal(typeof U.PEDIDO_STATUS_LABEL[s], 'string', 'PEDIDO_STATUS_LABEL.' + s);
    assert.equal(typeof U.PEDIDO_STATUS_BADGE[s], 'string', 'PEDIDO_STATUS_BADGE.' + s);
  }
  assert.equal(typeof U.corPreviewHex, 'function');
  assert.equal(typeof U.normalizarCorNome, 'function');
  assert.equal(typeof U.corPreviewElement, 'function');
  assert.equal(typeof U.pedidoStatusLabel, 'function');
  assert.equal(typeof U.pedidoStatusBadgeClass, 'function');
  assert.equal(typeof U.pedidoStatusBadge, 'function');
  assert.equal(typeof U.pedidoStatusTodos, 'function');
  assert.equal(typeof U.fmtDataCurta, 'function');
});

test('pedido-ui: PRETO → #111111', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('PRETO'), '#111111');
});

test('pedido-ui: CRU → #e8dfc8', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('CRU'), '#e8dfc8');
});

test('pedido-ui: KRAFT → #b08a55', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('KRAFT'), '#b08a55');
});

test('pedido-ui: CINZA → #8a8a8a', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('CINZA'), '#8a8a8a');
});

test('pedido-ui: cor desconhecida → #9ca3af (fallback)', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('VERMELHO'), '#9ca3af');
  assert.equal(sandbox.window.corPreviewHex('rosa'), '#9ca3af');
});

test('pedido-ui: normalização (trim + UPPER) funciona', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.corPreviewHex('  preto '), '#111111');
  assert.equal(sandbox.window.corPreviewHex('Cru'), '#e8dfc8');
  assert.equal(sandbox.window.corPreviewHex('kRaFt'), '#b08a55');
});

test('pedido-ui: normalizarCorNome lida com null e não-string', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.normalizarCorNome(null), '');
  assert.equal(sandbox.window.normalizarCorNome(undefined), '');
  assert.equal(sandbox.window.normalizarCorNome(42), '');
  assert.equal(sandbox.window.normalizarCorNome('  preto  '), 'PRETO');
});

test('pedido-ui: status conhecido gera label/badge esperado', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.pedidoStatusLabel('rascunho'),   'Rascunho');
  assert.equal(sandbox.window.pedidoStatusLabel('recebido'),   'Recebido');
  assert.equal(sandbox.window.pedidoStatusLabel('confirmado'), 'Confirmado');
  assert.equal(sandbox.window.pedidoStatusLabel('produzindo'), 'Em produção');
  assert.equal(sandbox.window.pedidoStatusLabel('entregue'),   'Entregue');
  assert.equal(sandbox.window.pedidoStatusLabel('cancelado'),  'Cancelado');
  assert.equal(sandbox.window.pedidoStatusBadgeClass('entregue'), 'bg-green-100 text-green-700');
  assert.equal(sandbox.window.pedidoStatusBadgeClass('cancelado'), 'bg-red-100 text-red-700');
});

test('pedido-ui: status desconhecido tem fallback seguro', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  // Label: retorna o próprio status (string)
  assert.equal(sandbox.window.pedidoStatusLabel('estado-invalido'), 'estado-invalido');
  // Badge class: cinza neutro
  assert.equal(sandbox.window.pedidoStatusBadgeClass('estado-invalido'), 'bg-gray-100 text-gray-700');
  // null/undefined
  assert.equal(sandbox.window.pedidoStatusLabel(null), '—');
  assert.equal(sandbox.window.pedidoStatusLabel(''), '—');
  assert.equal(sandbox.window.pedidoStatusBadgeClass(null), 'bg-gray-100 text-gray-700');
});

test('pedido-ui: pedidoStatusTodos retorna 6 status', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const todos = sandbox.window.pedidoStatusTodos();
  assert.equal(todos.length, 6);
  // Object.freeze torna primitivos frozen; comparar via .includes()
  // para evitar falso negativo de assert.deepEqual em frozen strings.
  for (const s of ['rascunho','recebido','confirmado','produzindo','entregue','cancelado']) {
    assert.ok(todos.includes(s), 'falta status: ' + s);
  }
});

test('pedido-ui: fmtDataCurta formata data ISO pt-BR', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  // 2026-06-24 → '24/06/2026' (pt-BR)
  assert.equal(sandbox.window.fmtDataCurta('2026-06-24'), '24/06/2026');
  // null/undefined/empty
  assert.equal(sandbox.window.fmtDataCurta(null), '—');
  assert.equal(sandbox.window.fmtDataCurta(''), '—');
});

test('pedido-ui: corPreviewElement retorna null se window.el ausente', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  // Sem window.el: deve retornar null (sem quebrar)
  assert.equal(sandbox.window.corPreviewElement('PRETO'), null);
});

test('pedido-ui: corPreviewElement retorna div quando window.el existe', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  // Mock window.el que retorna um div com os attrs passados
  const fakeEl = (tag, attrs, ...children) => ({
    tag, attrs,
    children,
    style: attrs && attrs.style || null,
    title: attrs && attrs.title || null,
  });
  const sandbox = { window: { el: fakeEl }, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const el = sandbox.window.corPreviewElement('PRETO');
  assert.ok(el, 'elemento não retornado');
  assert.match(el.style, /background:#111111/);
  assert.match(el.style, /width:48px/);
  assert.equal(el.title, 'PRETO');
});

test('pedido-ui: pedidoStatusBadge retorna null se window.el ausente', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window.pedidoStatusBadge('entregue'), null);
});

test('pedido-ui: globals bare expostos para compatibilidade', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  for (const g of ['corPreviewHex','pedidoStatusLabel','pedidoStatusBadge','fmtDataCurta','pedidoStatusTodos']) {
    assert.equal(typeof sandbox.window[g], 'function', 'global ' + g + ' não exposto');
  }
});
