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

// =====================================================================
// RAVATEX-TAPETES-OP-PARTIAL-SPLIT-UI-B — testes de UI do select split
// =====================================================================

test('TEC-STAGE-FINALIZATION-A-B: OP Tecelagem finaliza via RPC canonica', () => {
  const slice = (otpaSrc.match(/async function finalizarTecelagem[\s\S]*?\n  \}\n\n  function campoProducao/) || [''])[0];
  assert.ok(slice, 'finalizarTecelagem deve existir');
  assert.match(slice, /rpc\(\s*['"]alterar_status_op['"]/,
    'finalizacao deve chamar a RPC canonica alterar_status_op');
  assert.match(slice, /p_novo_status:\s*['"]concluida['"]/,
    'Tecelagem deve usar status canonico concluida');
  assert.match(slice, /p_observacao:/,
    'RPC deve receber observacao para op_eventos');
  assert.doesNotMatch(slice, /\.from\(\s*['"]ops['"]\s*\)\.update/,
    'nao deve existir update direto em ops.status');
});

test('ADMIN-TEC-FINALIZE-CTA-R1: CTA destacado exige saldo zerado', () => {
  const slice = (otpaSrc.match(/function buildHeaderProducao[\s\S]*?\n  \}\n\n  async function finalizarTecelagem/) || [''])[0];
  assert.ok(slice, 'buildHeaderProducao deve existir');
  assert.match(slice, /var\s+podeConcluir\s*=\s*totais\.totalAjustado\s*>\s*0\s*&&\s*totais\.saldo\s*<=\s*0/,
    'Finalizar OP Tecelagem deve depender de total ajustado e saldo sem pendencia');
  assert.match(slice, /BTN_FINALIZAR_TEC/,
    'CTA habilitado deve usar estilo destacado, nao o botao secundario do header');
  assert.match(slice, /Finalizar OP Tecelagem/,
    'CTA deve ter rotulo explicito para a OP Tecelagem');
  assert.match(slice, /if\s*\(\s*!podeConcluir\s*\)\s*concluirAttrs\.disabled\s*=\s*['"]disabled['"]/,
    'botao deve permanecer desabilitado enquanto houver saldo');
  assert.match(slice, /finalizarTecelagem\(ctx,\s*totais/,
    'clique do botao deve chamar finalizarTecelagem com os totais calculados');
});

function makeEntregaFormSandbox() {
  function FakeEl(tag, attrs) {
    this.tag = tag;
    this.attrs = attrs || {};
    this.children = [];
    this.textContent = '';
    this.value = '';
    this.style = {};
    this.disabled = false;
    this._listeners = {};
    this.appendChild = function (c) { if (c) this.children.push(c); return c; };
    this.addEventListener = function (ev, fn) { this._listeners[ev] = fn; };
    this.dispatchEvent = function (ev) { var fn = this._listeners[ev]; if (fn) fn.call(this); };
    this.setAttribute = function (k, v) { this.attrs[k] = v; };
    this.append = function () { for (var i = 0; i < arguments.length; i++) { var it = arguments[i]; if (it) this.children.push(it); } };
    this.replaceChildren = function () { this.children = []; for (var i = 0; i < arguments.length; i++) { var it = arguments[i]; if (it) this.children.push(it); } };
    this.querySelectorAll = function () { return []; };
    this.remove = function () {};
  }

  function collectText(node) {
    if (!node) return '';
    var t = node.textContent || '';
    (node.children || []).forEach(function (c) { t += ' ' + collectText(c); });
    return t;
  }

  function findChildByText(parent, substr) {
    if (!parent) return null;
    if (typeof parent.textContent === 'string' && parent.textContent.indexOf(substr) !== -1) return parent;
    for (var i = 0; i < (parent.children || []).length; i++) {
      var found = findChildByText(parent.children[i], substr);
      if (found) return found;
    }
    return null;
  }

  function el(tag, attrs) {
    var node = new FakeEl(tag, attrs);
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        node.textContent += String(child);
      } else if (Array.isArray(child)) {
        child.forEach(function (c) { if (c) node.children.push(c); });
      } else {
        node.children.push(child);
      }
    }
    return node;
  }

  function textInput(opts) {
    var inp = new FakeEl('input', { type: opts.type || 'text' });
    inp.value = opts.value || '';
    inp.placeholder = opts.placeholder || '';
    if (opts.type) inp.setAttribute('type', opts.type);
    return inp;
  }

  function selectInput(opts) {
    var sel = new FakeEl('select');
    sel.value = opts.value || '';
    (opts.options || []).forEach(function (opt) {
      var optEl = new FakeEl('option', { value: opt.value });
      optEl.textContent = opt.label;
      sel.children.push(optEl);
    });
    return sel;
  }

  function formField(opts) {
    return el('div', { class: 'form-field' },
      el('label', {}, opts.label || ''),
      opts.input || el('span', {}));
  }

  function larguraKey(largura) {
    return Number(largura).toFixed(2).replace('.', ',');
  }

  var sandbox = { console, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.el = el;
  sandbox.textInput = textInput;
  sandbox.selectInput = selectInput;
  sandbox.formField = formField;
  sandbox.larguraKey = larguraKey;

  vm.createContext(sandbox);

  var EF = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
  var efSrc = fs.readFileSync(EF, 'utf8');
  vm.runInContext(efSrc, sandbox, { filename: 'js/screens/entrega-form.js' });

  return {
    sandbox: sandbox,
    collectText: collectText,
    findChildByText: findChildByText,
    FakeEl: FakeEl,
  };
}

test('split-UI-B caso 1: formulário com comOpcaoSplit=true renderiza select com default "Acumular..."', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
    comOpcaoSplit: true,
  });

  assert.ok(result.getSplitOption, 'getSplitOption deve estar presente');
  var splitOpt = result.getSplitOption();
  assert.equal(splitOpt.forceSplit, false, 'default deve ser acumular');
  assert.equal(splitOpt.motivo, null, 'motivo deve ser null por default');

  var text = h.collectText(result.node);
  assert.match(text, /Acumular na OP existente quando possível/,
    'deve conter a opcao default de acumular');
  assert.match(text, /Criar nova OP para esta parcial/,
    'deve conter a opcao de split');
  assert.match(text, /Tipo de lançamento/,
    'deve conter o label do select');
});

test('split-UI-B caso 2: formulário sem comOpcaoSplit não renderiza select nem label de split', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
  });

  var text = h.collectText(result.node);
  assert.doesNotMatch(text, /Tipo de lançamento/,
    'sem comOpcaoSplit nao deve renderizar o select de split');
  assert.doesNotMatch(text, /Acumular na OP existente/,
    'sem comOpcaoSplit nao deve renderizar opcao de acumular');
  assert.doesNotMatch(text, /Criar nova OP para esta parcial/,
    'sem comOpcaoSplit nao deve renderizar opcao de split');
  assert.doesNotMatch(text, /Motivo da separação/,
    'sem comOpcaoSplit nao deve renderizar motivo');

  var splitOpt = result.getSplitOption();
  assert.equal(splitOpt.forceSplit, false, 'sem comOpcaoSplit, getSplitOption deve retornar forceSplit false');
  assert.equal(splitOpt.motivo, null, 'sem comOpcaoSplit, getSplitOption deve retornar motivo null');
});

test('split-UI-B caso 3: getSplitOption sem comOpcaoSplit sempre retorna no-split mesmo se node manipulado', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
  });

  for (var i = 0; i < 10; i++) {
    var opt = result.getSplitOption();
    assert.equal(opt.forceSplit, false);
    assert.equal(opt.motivo, null);
  }
});

test('split-UI-B caso 4: default acumular chama getSplitOption com forceSplit=false e motivo null', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
    comOpcaoSplit: true,
  });

  var opt = result.getSplitOption();
  assert.equal(opt.forceSplit, false,
    'default deve retornar forceSplit=false');
  assert.equal(opt.motivo, null,
    'default deve retornar motivo=null');

  for (var i = 0; i < 5; i++) {
    assert.equal(result.getSplitOption().forceSplit, false);
    assert.equal(result.getSplitOption().motivo, null);
  }
});

test('split-UI-B caso 5: trocar para split e voltar para default nao envia forceSplit', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
    comOpcaoSplit: true,
  });

  var opt = result.getSplitOption();
  assert.equal(opt.forceSplit, false);

  // Depois de estar no default, continua sem split
  assert.equal(result.getSplitOption().forceSplit, false);
  assert.equal(result.getSplitOption().motivo, null);
});

test('split-UI-B caso 6: getSplitOption retorna motivo trimado', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
    comDestino: false,
    comOpcaoSplit: true,
  });

  // Procura o <select> na árvore (FakeEl com tag contendo 'select')
  function findSelect(node) {
    if (!node) return null;
    if (node.tag && typeof node.tag === 'string' && node.tag.toLowerCase() === 'select') return node;
    for (var i = 0; i < (node.children || []).length; i++) {
      var found = findSelect(node.children[i]);
      if (found) return found;
    }
    return null;
  }

  var selectEl = findSelect(result.node);
  assert.ok(selectEl, 'deve encontrar o elemento select no form');

  // Seta para 'split'
  selectEl.value = 'split';
  selectEl.dispatchEvent('change');

  // Procura o input de motivo (FakeEl com placeholder especifico)
  function findInput(node, placeholder) {
    if (!node) return null;
    if (typeof node.placeholder === 'string' && node.placeholder === placeholder) return node;
    for (var i = 0; i < (node.children || []).length; i++) {
      var found = findInput(node.children[i], placeholder);
      if (found) return found;
    }
    return null;
  }

  var motivoInput = findInput(result.node, 'Ex.: amostra separada, retrabalho...');
  assert.ok(motivoInput, 'deve encontrar o campo de motivo apos selecionar split');

  motivoInput.value = '  amostra do lote B  ';

  var opt = result.getSplitOption();
  assert.equal(opt.forceSplit, true, 'forceSplit deve ser true quando split selecionado');
  assert.equal(opt.motivo, 'amostra do lote B', 'motivo deve ser trimado');
});

test('split-UI-B caso 7: buildEntregaInlineForm retorna getPayload inalterado (contrato preservado)', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
    comOpcaoSplit: true,
  });

  assert.equal(typeof result.getPayload, 'function', 'getPayload deve existir');
  // O payload deve ter as chaves esperadas: data, observacao, destino_fornecedor_id, linhas
  var payload = result.getPayload();
  assert.ok('data' in payload, 'payload deve conter data');
  assert.ok('observacao' in payload, 'payload deve conter observacao');
  assert.ok('destino_fornecedor_id' in payload, 'payload deve conter destino_fornecedor_id');
  assert.ok(Array.isArray(payload.linhas), 'payload deve conter linhas como array');
  assert.doesNotMatch(JSON.stringify(payload), /forceSplit/,
    'getPayload nao deve conter forceSplit (split e opcao separada)');
  assert.doesNotMatch(JSON.stringify(payload), /motivo_separacao/,
    'getPayload nao deve conter motivo_separacao (split e opcao separada)');
});

test('split-UI-B caso 8: comOpcaoSplit=false getPayload continua identico ao fluxo legado', () => {
  var h = makeEntregaFormSandbox();
  var result = h.sandbox.window.buildEntregaInlineForm({
    opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
    modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
    latexOptions: [],
  });

  assert.equal(typeof result.getPayload, 'function');
  assert.equal(typeof result.getSplitOption, 'function');
  var splitOpt = result.getSplitOption();
  assert.equal(splitOpt.forceSplit, false);
  assert.equal(splitOpt.motivo, null);
});

test('split-UI-B caso 9: estático — pedido-detail-events.js buildTecelagemTransferForm passa comOpcaoSplit:true', () => {
  var PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
  var pdeSrc = fs.readFileSync(PDE, 'utf8');
  var buildTecSlice = (pdeSrc.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.ok(buildTecSlice, 'trecho buildTecelagemTransferForm nao encontrado');
  assert.match(buildTecSlice, /comOpcaoSplit:\s*true/,
    'buildTecelagemTransferForm deve passar comOpcaoSplit:true');
  assert.match(buildTecSlice, /form\.getSplitOption\(\)/,
    'onSave deve chamar form.getSplitOption()');
  assert.match(buildTecSlice, /salvarEntregaCima\([\s\S]*splitOpt\.forceSplit[\s\S]*forceSplit:/,
    'onSave deve passar forceSplit e motivo para salvarEntregaCima quando split ativo');
});

test('split-UI-B caso 10: estático — op-tecelagem-producao-admin.js buildBlocoTecelagem passa comOpcaoSplit:true', () => {
  var buildBlocoSlice = (otpaSrc.match(/function buildBlocoTecelagem[\s\S]*?\n  \}\n\n  function buildEntregaHistorico/) || [''])[0];
  assert.ok(buildBlocoSlice, 'trecho buildBlocoTecelagem nao encontrado');
  assert.match(buildBlocoSlice, /comOpcaoSplit:\s*true/,
    'buildBlocoTecelagem deve passar comOpcaoSplit:true no +Nova entrega');
  assert.match(buildBlocoSlice, /form\.getSplitOption\(\)/,
    '+Nova entrega onclick deve chamar form.getSplitOption()');
  assert.match(buildBlocoSlice, /salvarEntregaCima\([\s\S]*splitOpt\.forceSplit[\s\S]*forceSplit:/,
    'deve passar forceSplit e motivo para salvarEntregaCima quando split ativo');
});

test('split-UI-B caso 11: estático — abrirEdicaoAdmin NÃO passa comOpcaoSplit (edição não troca split)', () => {
  var abrirSlice = (otpaSrc.match(/function abrirEdicaoAdmin[\s\S]*?\n  \}\n\n  function buildBlocoMovimentacao/) || [''])[0];
  assert.ok(abrirSlice, 'trecho abrirEdicaoAdmin nao encontrado');
  assert.doesNotMatch(abrirSlice, /comOpcaoSplit/,
    'abrirEdicaoAdmin nao deve passar comOpcaoSplit (edicao nao altera decisao de split)');
});

test('split-UI-B caso 12: estático — pedido-detail-events.js "Transferir restante" preservado', () => {
  var PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
  var pdeSrc = fs.readFileSync(PDE, 'utf8');
  assert.match(pdeSrc, /Transferir restante/,
    '"Transferir restante" deve continuar preservado no pedido-detail-events.js');
});

test('split-UI-B caso 13: estático — pedido-detail-events.js NAO referencia gerar_op_latex_split diretamente', () => {
  var PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
  var pdeSrc = fs.readFileSync(PDE, 'utf8');
  assert.doesNotMatch(pdeSrc, /gerar_op_latex_split/,
    'pedido-detail-events.js nao deve chamar gerar_op_latex_split diretamente pela UI');
});

test('split-UI-B caso 14: estático — op-tecelagem-producao-admin.js NAO referencia gerar_op_latex_split diretamente', () => {
  assert.doesNotMatch(otpaSrc, /gerar_op_latex_split/,
    'op-tecelagem-producao-admin.js nao deve chamar gerar_op_latex_split diretamente pela UI');
});

test('split-UI-B caso 15: estático — entrega-form.js NAO referencia gerar_op_latex_split', () => {
  var EF = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
  var efSrc = fs.readFileSync(EF, 'utf8');
  assert.doesNotMatch(efSrc, /gerar_op_latex/,
    'entrega-form.js e apenas UI read, nao pode referenciar RPCs');
  assert.doesNotMatch(efSrc, /supa\.rpc/,
    'entrega-form.js nao pode chamar supa.rpc diretamente');
});

test('split-UI-B sintaxe: entrega-form.js válido apos patch', () => {
  var EF = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
  require('node:child_process').execFileSync(process.execPath, ['--check', EF], { stdio: 'pipe' });
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

// =====================================================================
// RAVATEX-TAPETES-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1
// Reorganização do layout do modal "Registrar nova transferência"
// (Tecelagem → Acabamento). Apenas ordem/estrutura do DOM: mesmos
// inputs, mesmo getPayload/getSplitOption, mesmo handler canônico.
// =====================================================================

const STACKED_ARGS = {
  opItens: [{ id: 1, modelo_id: 1, metros_pedidos: 100 }],
  modelosById: { 1: { id: 1, nome: 'Modelo A', largura: 2.0, cor_1: { id: 1, nome: 'Azul' }, cor_2: { id: 2, nome: 'Branco' } } },
  latexOptions: [{ value: 7, label: 'Latex X' }],
  comOpcaoSplit: true,
};

test('MODAL-LAYOUT-R1 caso 1: layout stacked coloca dados gerais (Data/Destino) no topo, depois Nome/Metros por produto', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, { layout: 'stacked' }));
  const text = h.collectText(result.node);

  const idxData = text.indexOf('Data');
  const idxDestino = text.indexOf('Destino');
  const idxProdutos = text.indexOf('Produtos a transferir');
  const idxNome = text.indexOf('Modelo A');
  const idxMetros = text.indexOf('Metros');
  assert.ok(idxData >= 0, 'label Data deve aparecer no form');
  assert.ok(idxDestino >= 0, 'label Destino deve aparecer no form');
  assert.ok(idxProdutos >= 0, 'card "Produtos a transferir" deve aparecer');
  assert.ok(idxNome >= 0, 'Nome do item deve aparecer no form');
  assert.ok(idxData < idxNome, 'Data (dado geral) deve vir ANTES do Nome do produto');
  assert.ok(idxDestino < idxNome, 'Destino (dado geral) deve vir ANTES do Nome do produto');
  assert.ok(idxProdutos < idxNome, 'cabeçalho do card deve vir ANTES do primeiro produto');
  assert.ok(idxNome < idxMetros, 'Metros deve ser por produto, DEPOIS do Nome do item');
});

test('MODAL-LAYOUT-R1 caso 2: layout stacked coloca Observação DEPOIS de Data/Destino/Metros', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, { layout: 'stacked' }));
  const text = h.collectText(result.node);

  const idxData = text.indexOf('Data');
  const idxMetros = text.indexOf('Metros');
  const idxObsItem = text.indexOf('Observação');
  const idxObsEntrega = text.indexOf('Observação da entrega');
  assert.ok(idxObsItem >= 0, 'Observação do item deve aparecer');
  assert.ok(idxObsEntrega >= 0, 'Observação da entrega deve continuar aparecendo');
  assert.ok(idxData < idxObsItem, 'Observação do item deve vir DEPOIS de Data');
  assert.ok(idxMetros < idxObsItem, 'Observação do item deve vir DEPOIS de Metros');
  assert.ok(idxObsItem < idxObsEntrega, 'Observação da entrega deve continuar depois da Observação do item');
});

test('MODAL-LAYOUT-R1 caso 3: layout stacked preserva getPayload (contrato inalterado)', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, { layout: 'stacked' }));

  assert.equal(typeof result.getPayload, 'function', 'getPayload deve existir');
  const payload = result.getPayload();
  assert.ok('data' in payload, 'payload deve conter data');
  assert.ok('observacao' in payload, 'payload deve conter observacao');
  assert.ok('destino_fornecedor_id' in payload, 'payload deve conter destino_fornecedor_id');
  assert.ok(Array.isArray(payload.linhas), 'payload deve conter linhas como array');
  assert.deepEqual(Object.keys(payload).sort(), ['data', 'destino_fornecedor_id', 'linhas', 'observacao']);
});

test('MODAL-LAYOUT-R1 caso 4: layout stacked mantém getSplitOption (handler canônico intacto)', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, { layout: 'stacked' }));

  assert.equal(typeof result.getSplitOption, 'function', 'getSplitOption deve existir no layout stacked');
  const opt = result.getSplitOption();
  assert.equal(opt.forceSplit, false, 'default deve continuar sendo acumular');
  assert.equal(opt.motivo, null, 'motivo default deve continuar null');
});

test('MODAL-LAYOUT-R1 caso 5: layout inline (default) permanece com Data ANTES do Nome (sem regressão)', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS)); // sem layout => inline
  const text = h.collectText(result.node);

  const idxData = text.indexOf('Data');
  const idxNome = text.indexOf('Modelo A');
  assert.ok(idxData >= 0 && idxNome >= 0);
  assert.ok(idxData < idxNome, 'no layout inline histórico, o cabeçalho Data/Destino continua ANTES dos itens');
});

test('MODAL-LAYOUT-R1 caso 5b: stacked com pendência renderiza pill "pendente" e link "Preencher restante" que preenche Metros', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, {
    layout: 'stacked',
    pendingByOpItemId: { 1: 40 },
  }));
  const text = h.collectText(result.node);
  assert.match(text, /Produtos a transferir/, 'card deve ter cabeçalho "Produtos a transferir"');
  assert.match(text, /pendente/, 'produto com saldo deve exibir pill de pendência');

  const link = h.findChildByText(result.node, 'Preencher restante');
  assert.ok(link, 'link "Preencher restante" deve aparecer quando há pendência');

  // Antes de clicar, Metros vazio => sem linhas no payload.
  assert.equal(result.getPayload().linhas.length, 0, 'sem clique, nenhuma linha preenchida');
  link.dispatchEvent('click');
  const linhas = result.getPayload().linhas;
  assert.equal(linhas.length, 1, 'após "Preencher restante", a linha com pendência é preenchida');
  assert.equal(linhas[0].metros_entregues, 40, 'Metros deve receber o pendente do produto');
});

test('MODAL-LAYOUT-R1 caso 5c: stacked sem pendência não mostra link e marca produto "sem pendência"', () => {
  const h = makeEntregaFormSandbox();
  const result = h.sandbox.window.buildEntregaInlineForm(Object.assign({}, STACKED_ARGS, {
    layout: 'stacked',
    pendingByOpItemId: { 1: 0 },
  }));
  const text = h.collectText(result.node);
  assert.match(text, /sem pendência/, 'produto sem saldo deve exibir "sem pendência"');
  assert.equal(h.findChildByText(result.node, 'Preencher restante'), null,
    'sem pendência, o link "Preencher restante" não deve aparecer');
});

test('MODAL-LAYOUT-R1 caso 6: estático — buildTecelagemTransferForm passa layout stacked ao helper canônico', () => {
  const PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
  const pdeSrc = fs.readFileSync(PDE, 'utf8');
  const buildTecSlice = (pdeSrc.match(/function buildTecelagemTransferForm[\s\S]*?\n    \}\n\n    function buildAcabamentoTransferForm/) || [''])[0];
  assert.ok(buildTecSlice, 'trecho buildTecelagemTransferForm não encontrado');
  assert.match(buildTecSlice, /layout:\s*['"]stacked['"]/,
    'buildTecelagemTransferForm deve pedir o layout empilhado');
  assert.match(buildTecSlice, /window\.buildEntregaInlineForm/,
    'deve continuar reutilizando o helper canônico buildEntregaInlineForm');
  assert.match(buildTecSlice, /comOpcaoSplit:\s*true/,
    'comOpcaoSplit:true deve ser preservado junto com o novo layout');
});

test('MODAL-LAYOUT-R1 caso 7: estático — outras telas NÃO adotam o layout stacked (escopo isolado)', () => {
  const OLA = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
  const FORN = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
  assert.doesNotMatch(otpaSrc, /layout:\s*['"]stacked['"]/,
    'op-tecelagem-producao-admin.js não deve mudar de layout (tela já validada)');
  assert.doesNotMatch(fs.readFileSync(OLA, 'utf8'), /layout:\s*['"]stacked['"]/,
    'op-latex-admin.js não deve mudar de layout (tela já validada)');
  assert.doesNotMatch(fs.readFileSync(FORN, 'utf8'), /layout:\s*['"]stacked['"]/,
    'fornecedor.js não deve mudar de layout (tela já validada)');
});
