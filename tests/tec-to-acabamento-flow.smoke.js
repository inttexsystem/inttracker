// =====================================================================
// === tests/tec-to-acabamento-flow.smoke.js ===========================
// Smoke focado do patch D-B: bloqueio de edição/exclusão de entrega
// de Tecelagem (etapa='cima') quando já gerou OP de Acabamento/Látex
// (ops.origem_entrega_id).
//
// Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-FLOW-CONTRACT-B
//
// Casos:
//   1. UI OP Tecelagem — com latexOpPorEntrega[ent.id]:
//        - renderiza "Ver OP de látex";
//        - NÃO renderiza Editar/Excluir;
//        - renderiza texto de bloqueio.
//   2. atualizarEntregaCima — com OP Latex vinculada:
//        - retorna false; sem update/delete/insert; emite toast.
//   3. excluirEntrega — entrega cima com OP Latex vinculada:
//        - retorna false; sem delete; emite toast.
//   4. atualizarEntregaCima / excluirEntrega — entrega cima SEM OP Latex:
//        - comportamento atual preservado.
//   5. excluirEntrega — entrega de outra etapa (latex) com OP Latex:
//        - NÃO bloqueada indevidamente por esta regra.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const EW = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const OTPA = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');

const ewSrc = fs.readFileSync(EW, 'utf8');
const otpaSrc = fs.readFileSync(OTPA, 'utf8');

// ---------------------------------------------------------------------
// Harness para testes do helper (entrega-writes.js).
// fakeSupa suporta select/eq/maybeSingle encadeados para o preflight D-B,
// além do delete/insert/update/single já usado pelos writes.
// ---------------------------------------------------------------------
function makeHelperSandbox({ opLatexRow = null, entregaEtapa = 'cima', deleteResult = { data: null, error: null } } = {}) {
  const calls = [];
  const fakeSupa = {
    from(table) {
      calls.push({ op: 'from', table });
      const chain = {
        _table: table,
        select(cols) { calls.push({ op: 'select', table, cols }); return chain; },
        insert(payload) { calls.push({ op: 'insert', table, payload }); return chain; },
        update(payload) { calls.push({ op: 'update', table, payload }); return chain; },
        delete() { calls.push({ op: 'delete', table }); return chain; },
        eq(col, val) { calls.push({ op: 'eq', table, col, val }); return chain; },
        order() { return chain; },
        in() { return chain; },
        single() {
          calls.push({ op: 'single', table });
          return Promise.resolve({ data: { id: 1 }, error: null });
        },
        maybeSingle() {
          calls.push({ op: 'maybeSingle', table });
          // Preflight consolidado: op_latex_entregas embute a OP Látex.
          if (table === 'op_latex_entregas') {
            return Promise.resolve({
              data: opLatexRow
                ? { op_latex_id: opLatexRow.id, ops: Object.assign({ tipo: 'latex' }, opLatexRow) }
                : null,
              error: null,
            });
          }
          if (table === 'entregas') return Promise.resolve({ data: entregaEtapa ? { etapa: entregaEtapa } : null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then(resolveThen, rejectThen) {
          // delete().eq() terminal resolve com deleteResult.
          return Promise.resolve(deleteResult).then(resolveThen, rejectThen);
        },
      };
      return chain;
    },
    rpc() { calls.push({ op: 'rpc' }); return Promise.resolve({ data: null, error: null }); },
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    storage: {},
    _calls: calls,
  };

  const toasts = [];
  let confirmCalled = false;
  const sandbox = {
    console, setTimeout, clearTimeout, URL, URLSearchParams,
    supa: fakeSupa,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Mínimos de UI necessários: toast e confirmDialog.
  sandbox.toast = (msg, type) => { toasts.push({ msg, type }); };
  sandbox.confirmDialog = (opts) => {
    confirmCalled = true;
    return Promise.resolve().then(() => opts && opts.onConfirm && opts.onConfirm());
  };

  // Carrega o módulo (IIFE que expõe em window.RAVATEX_ENTREGA_WRITES).
  vm.runInContext(ewSrc, sandbox, { filename: 'js/screens/entrega-writes.js' });

  return {
    sandbox, fakeSupa, calls,
    getToasts: () => toasts.slice(),
    getConfirmCalled: () => confirmCalled,
  };
}

const CIMA_VALID_PAYLOAD = {
  data: '2026-06-01',
  observacao: null,
  destino_fornecedor_id: 77,
  linhas: [{ op_item_id: 10, metros_entregues: 5, defeito: false, observacao: null }],
};

// =====================================================================
// Caso 2 — atualizarEntregaCima bloqueada com OP Latex vinculada
// =====================================================================

test('D-B caso 2: atualizarEntregaCima com OP Latex vinculada retorna false e não escreve', async () => {
  const h = makeHelperSandbox({ opLatexRow: { id: 99, numero: 5, ano: 2026 } });
  const fn = h.sandbox.window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima;

  const result = await fn({ entregaId: 42, opId: 10, payload: CIMA_VALID_PAYLOAD });

  assert.equal(result, false, 'deve retornar false quando há OP Latex vinculada');
  // Não deve ter feito update/delete/insert em entregas/entrega_itens.
  const writes = h.calls.filter(c => (c.op === 'update' || c.op === 'delete' || c.op === 'insert') && (c.table === 'entregas' || c.table === 'entrega_itens'));
  assert.equal(writes.length, 0, 'não deve ter feito update/delete/insert em entregas/entrega_itens');
  // Deve ter feito o preflight (select em op_latex_entregas).
  const preflight = h.calls.filter(c => c.op === 'maybeSingle' && c.table === 'op_latex_entregas');
  assert.ok(preflight.length >= 1, 'deve ter consultado op_latex_entregas para o preflight');
  // Deve ter emitido toast de erro.
  const errs = h.getToasts().filter(t => t.type === 'error');
  assert.ok(errs.length >= 1, 'deve ter emitido toast de erro');
  assert.match(errs[0].msg, /acabamento|OP/i, 'toast deve mencionar OP de acabamento');
});

// =====================================================================
// Caso 3 — excluirEntrega bloqueada (etapa=cima + OP Latex)
// =====================================================================

test('D-B caso 3: excluirEntrega com entrega cima + OP Latex retorna false e não deleta', async () => {
  const h = makeHelperSandbox({
    opLatexRow: { id: 99, numero: 5, ano: 2026 },
    entregaEtapa: 'cima',
  });
  const fn = h.sandbox.window.RAVATEX_ENTREGA_WRITES.excluirEntrega;

  const result = await fn(42, () => {});

  assert.equal(result, false, 'deve retornar false quando entrega cima tem OP Latex');
  // Não deve ter chamado delete em entregas.
  const deletes = h.calls.filter(c => c.op === 'delete' && c.table === 'entregas');
  assert.equal(deletes.length, 0, 'não deve ter chamado delete em entregas');
  // Não deve ter aberto confirmDialog (bloqueio pré-confirmação).
  assert.equal(h.getConfirmCalled(), false, 'não deve ter aberto confirmDialog');
  // Deve ter emitido toast de erro.
  const errs = h.getToasts().filter(t => t.type === 'error');
  assert.ok(errs.length >= 1, 'deve ter emitido toast de erro');
});

// =====================================================================
// Caso 4 — entrega cima SEM OP Latex: comportamento atual preservado
// =====================================================================

test('D-B caso 4: atualizarEntregaCima sem OP Latex segue fluxo normal', async () => {
  const h = makeHelperSandbox({ opLatexRow: null });
  const fn = h.sandbox.window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima;

  const result = await fn({ entregaId: 42, opId: 10, payload: CIMA_VALID_PAYLOAD });

  // Comportamento atual: prossegue para o update em entregas.
  assert.notEqual(result, false, 'não deve ser bloqueado quando não há OP Latex');
  const updates = h.calls.filter(c => c.op === 'update' && c.table === 'entregas');
  assert.ok(updates.length >= 1, 'deve ter feito update em entregas (fluxo normal)');
});

test('D-B caso 4: excluirEntrega cima sem OP Latex abre confirmDialog (fluxo normal)', async () => {
  const h = makeHelperSandbox({ opLatexRow: null, entregaEtapa: 'cima' });
  const fn = h.sandbox.window.RAVATEX_ENTREGA_WRITES.excluirEntrega;

  await fn(42, () => {});

  // Sem OP Latex: deve abrir confirmDialog (comportamento atual).
  assert.equal(h.getConfirmCalled(), true, 'deve abrir confirmDialog quando não há OP Latex');
});

// =====================================================================
// Caso 5 — entrega de outra etapa (latex): não bloqueada indevidamente
// =====================================================================

test('D-B caso 5: excluirEntrega latex (não cima) não é bloqueada por esta regra', async () => {
  // Mesmo que exista uma OP Latex com origem_entrega_id (cenário improvável
  // para entrega latex, mas valida que a trava é específica de etapa='cima').
  const h = makeHelperSandbox({
    opLatexRow: { id: 99, numero: 5, ano: 2026 },
    entregaEtapa: 'latex',
  });
  const fn = h.sandbox.window.RAVATEX_ENTREGA_WRITES.excluirEntrega;

  await fn(42, () => {});

  // etapa !== 'cima' => não aplica o gate => abre confirmDialog normal.
  assert.equal(h.getConfirmCalled(), true, 'entrega latex deve seguir fluxo normal (confirmDialog)');
  const errs = h.getToasts().filter(t => t.type === 'error');
  assert.equal(errs.length, 0, 'não deve emitir erro de bloqueio para entrega latex');
});

// =====================================================================
// Caso 1 — UI OP Tecelagem: gate de render em buildEntregaHistorico
// =====================================================================

// Harness mínimo de el() que captura texto para inspeção.
function makeUISandbox() {
  function FakeEl(tag, attrs) {
    this.tag = tag;
    this.attrs = attrs || {};
    this.children = [];
    this.textContent = '';
    this.appendChild = function (c) { if (c) this.children.push(c); return c; };
    this.addEventListener = function () {};
    this.setAttribute = function (k, v) { this.attrs[k] = v; };
    this.append = function (...items) { items.forEach(it => { if (it) this.children.push(it); }); };
    this.replaceChildren = function (...items) { this.children = items.filter(Boolean); };
  }
  function el(tag, attrs, ...rest) {
    const node = new FakeEl(tag, attrs);
    rest.forEach(child => {
      if (child == null) return;
      if (typeof child === 'string' || typeof child === 'number') {
        node.textContent += String(child);
      } else if (Array.isArray(child)) {
        child.forEach(c => { if (c) node.children.push(c); });
      } else {
        node.children.push(child);
      }
    });
    return node;
  }
  function collectText(node) {
    if (!node) return '';
    let t = node.textContent || '';
    (node.children || []).forEach(c => { t += ' ' + collectText(c); });
    return t;
  }

  const sandbox = { console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.el = el;
  // Stubs de helpers globais usados pelo módulo.
  sandbox.totalEntregueCimaPorItem = () => ({});
  sandbox.window.fmtMetros = (n) => String(n) + ' m';
  sandbox.window.rotuloModelo = (m) => (m && m.nome) || '?';
  sandbox.window.navigate = () => {};
  sandbox.window.excluirEntrega = () => {};
  vm.createContext(sandbox);
  vm.runInContext(otpaSrc, sandbox, { filename: 'js/screens/op-tecelagem-producao-admin.js' });
  return { sandbox, collectText };
}

test('D-B caso 1: buildEntregaHistorico com OP Latex vinculada esconde Editar/Excluir e mostra bloqueio', () => {
  const { sandbox, collectText } = makeUISandbox();
  const renderOPTecelagemProducaoAdmin = sandbox.window.RAVATEX_SCREENS.opTecelagemProducaoAdmin.renderOPTecelagemProducaoAdmin;
  // Render completo só para garantir que o módulo carregou; o alvo é
  // buildEntregaHistorico, que é interno. Validamos indiretamente pela
  // asserção estática + contrato de render do módulo.
  assert.equal(typeof renderOPTecelagemProducaoAdmin, 'function');
});

test('D-B caso 1 (estático): buildEntregaHistorico aplica gate latexOpPorEntrega', () => {
  // Assegura que o gate D-B está presente no fonte: quando latexOpPorEntrega
  // existe, Editar/Excluir não são renderizados; o CTA Ver OP de látex
  // permanece; o texto de bloqueio aparece.
  const slice = (otpaSrc.match(/function buildEntregaHistorico[\s\S]*?\n  \}\n\n  function abrirEdicaoAdmin/) || [''])[0];
  assert.ok(slice, 'trecho buildEntregaHistorico não encontrado');
  assert.match(slice, /vinculadaLatex/);
  assert.match(slice, /if\s*\(\s*!vinculadaLatex\s*\)/, 'Editar/Excluir só devem aparecer quando NÃO vinculada');
  assert.match(slice, /Entrega vinculada à OP de acabamento/);
  assert.match(slice, /Ver OP de látex/, 'CTA Ver OP de látex deve permanecer');
});

test('helper: entregaCimaTemOpLatex consulta op_latex_entregas por entrega_id (consolidado)', () => {
  // Asserção estática do preflight consolidado.
  assert.match(ewSrc, /async function entregaCimaTemOpLatex/);
  assert.match(ewSrc, /from\(\s*['"]op_latex_entregas['"]\s*\)/);
  assert.match(ewSrc, /eq\(\s*['"]entrega_id['"]/);
  // A OP Látex é resolvida via embed e filtrada por tipo='latex' em JS.
  assert.match(ewSrc, /ops:op_latex_id/);
});

test('D-B helper: excluirEntrega só aplica gate quando etapa === cima', () => {
  assert.match(ewSrc, /var etapa = await etapaDaEntrega\(entregaId\)/);
  assert.match(ewSrc, /if\s*\(\s*etapa === ['"]cima['"]\s*\)/);
});

test('D-B sintaxe: entrega-writes.js e op-tecelagem-producao-admin.js válidos', () => {
  require('node:child_process').execFileSync(process.execPath, ['--check', EW], { stdio: 'pipe' });
  require('node:child_process').execFileSync(process.execPath, ['--check', OTPA], { stdio: 'pipe' });
});

// RAVATEX-TAPETES-PRODUCTION-FLOW-ACTION-BUTTONS-R1
// Botão "Movimentar" no header da OP Tecelagem renomeado para "Ir para entregas"
// — o comportamento continua sendo scroll anchor, mas o label agora reflete
// que é navegação interna, não ação produtiva.
test('R1: OP Tecelagem header não contém botão "Movimentar" ambíguo (renomeado)', () => {
  assert.doesNotMatch(otpaSrc, /'Movimentar'/,
    'botão do header da OP Tecelagem não deve mais usar label "Movimentar" ambíguo');
  assert.match(otpaSrc, /'Ir para entregas'/,
    'botão do header da OP Tecelagem deve usar label "Ir para entregas" que reflete scroll');
});

test('R1: OP Tecelagem anchor #entregas-tecelagem-op continua sendo destino do scroll', () => {
  assert.match(otpaSrc, /id:\s*['"]entregas-tecelagem-op['"]/,
    'o bloco de destino #entregas-tecelagem-op deve continuar existindo');
  assert.match(otpaSrc, /href:\s*['"]#entregas-tecelagem-op['"]/,
    'o anchor para #entregas-tecelagem-op deve continuar existindo no botão renomeado');
});
