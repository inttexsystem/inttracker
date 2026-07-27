// =====================================================================
// === tests/pedido-form.smoke.js ======================================
// Smoke estático para o formulário admin js/screens/pedido-form.js
// (`screenPedidoNovo`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2
// Escopo: valida que a UI é de criação admin de Pedido, sem mexer em
// OP, sem Edge Function, sem geração de OP, sem cliente público, sem
// token, sem service_role. Garante:
//   - arquivo existe e sintaxe JS válida;
//   - index.html carrega pedido-form.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedidos-list → pedido-form → boot;
//   - boot.js registra rota #/pedidos/novo com role admin;
//   - pedidos-list.js navega para #/pedidos/novo no botão Novo;
//   - pedido-form.js usa tabelas `pedidos` e `pedido_itens`;
//   - pedido-form.js faz INSERT em pedidos e pedido_itens;
//   - pedido-form.js NÃO referencia op-nova/op-persistir/entrega;
//   - pedido-form.js NÃO chama Edge Function (functions.invoke);
//   - pedido-form.js NÃO usa service_role / service_role_key;
//   - pedido-form.js NÃO cria lote nem altera schema;
//   - pedido-form.js NÃO consulta token_acesso;
//   - pedido-form.js usa window.corPreviewElement (preview de cor);
//   - pedido-form.js oferece CTA pós-save por hash route para gerar OP.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// TEST-MOCK-FIDELITY-AUDIT R1 adoption: the runtime form is now rendered
// through the REAL js/ui.js el() (which carries UI-EL-BOOLEAN-ATTR-FIX)
// backed by the shared FaithfulNode double (tests/_doubles.js), so this suite
// is no longer structurally blind to a boolean-attr defect
// (CODE_HEALTH_RULES.md §20). The old hand-rolled runtimeEl/RuntimeNode set
// node.disabled=true for ANY `disabled` key (regardless of value) and stored
// the raw attribute, so a boolean-attr coercion bug rendered green.
const { FaithfulNode, createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-form.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const LIST   = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');
const UI     = path.join(ROOT, 'js', 'ui.js');
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-01-R1: os dois helpers aceitos
// que POSSUEM a derivacao de rota. Carrega-los no sandbox faz a suite provar
// a derivacao REAL de `modelos.tipo_produto` em vez de um duplo local.
const OPDISP = path.join(ROOT, 'js', 'op-display.js');
const PROUTE = path.join(ROOT, 'js', 'product-route.js');
// BATCH-02: a linha de item e a regra Tipo-antes-de-Modelo migraram para
// este modulo; as provas que antes liam `screen` agora leem `rowEditor`.
const ROWEDIT = path.join(ROOT, 'js', 'screens', 'pedido-item-row-editor.js');
// Pre-preenchimento do numero: o contrato de numeracao (candidato, deteccao de
// ocupado, textos) foi extraido para este modulo, carregado no sandbox para que
// as provas exercitem o codigo REAL e nao um duplo local.
const NUMSUG = path.join(ROOT, 'js', 'screens', 'pedido-numero-sugestao.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const helper = readOrFail(HELPER);
const boot   = readOrFail(BOOT);
const list   = readOrFail(LIST);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);
const uiSrc  = readOrFail(UI);
const opDispSrc = readOrFail(OPDISP);
const pRouteSrc = readOrFail(PROUTE);
const rowEditor = readOrFail(ROWEDIT);
const numSug = readOrFail(NUMSUG);

// ---------------------------------------------------------------------
// PedidoFormNode — the shared FaithfulNode widened with an attribute-aware
// querySelectorAll. FaithfulNode ships a tag-only querySelectorAll (a
// documented simplification); both this screen's updateItensSummary() and
// this suite select nodes by [data-*] attribute, a capability every real
// browser has. Widening the double toward real-DOM semantics is a
// STRENGTHENING (never a weakening) and lives here so the shared module
// stays untouched. Everything else — including the boolean-attr coercion
// that makes this suite non-blind — is inherited from FaithfulNode.
// ---------------------------------------------------------------------
class PedidoFormNode extends FaithfulNode {
  // Real DOM coerces EVERY attribute value to a string, and a freshly created
  // <input>/<option> reflects its `value` content attribute into the `.value`
  // IDL property. The shared double stores the raw value and skips that
  // reflection, so `el('option', { value: 7 })` reads back as the number 7 and
  // `el('input', { value: '77' }).value` reads as ''. Both are exactly what a
  // suite asserting on rendered item rows must see. Widening toward real-DOM
  // semantics is a STRENGTHENING (CODE_HEALTH_RULES.md §20) and lives here so
  // the shared module stays untouched.
  setAttribute(name, value) {
    const coerced = (name === 'style' || typeof value === 'string') ? value : String(value);
    super.setAttribute(name, coerced);
    if (name === 'value') this.value = coerced;
  }

  querySelectorAll(sel) {
    const attr = typeof sel === 'string'
      ? sel.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/)
      : null;
    if (!attr) return super.querySelectorAll(sel);
    const out = [];
    (function walk(node) {
      for (const child of (node.children || [])) {
        if (child && child._attrs) {
          const actual = child._attrs[attr[1]];
          if (actual != null && (attr[2] == null || String(actual) === attr[2])) out.push(child);
        }
        if (child && child.children) walk(child);
      }
    })(this);
    return out;
  }
}

function allByTag(root, tag) {
  const wanted = String(tag).toUpperCase();
  const out = [];
  function walk(node) {
    if (!node || !node.children) return;
    if (node.tagName === wanted) out.push(node);
    node.children.forEach(walk);
  }
  walk(root);
  return out;
}

function containsNode(root, target) {
  if (root === target) return true;
  if (!root || !root.children) return false;
  return root.children.some((child) => containsNode(child, target));
}

function findButton(root, re) {
  return allByTag(root, 'button').find((button) => re.test(button.textContent));
}

// ---------------------------------------------------------------------
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-01-R1 fixture.
//
// Three synthetic models, chosen so the Tipo assertions cannot pass by
// accident:
//   - Paris            tapete, KRAFT/CRU     (the order's Tapete example)
//   - Manta Barcelona  manta,  PRETO/CRU     (the order's Manta example)
//   - Manta Legado     TAPETE despite a name starting with "Manta", and the
//                      SAME 1,40 m width as the Manta — so any derivation
//                      from the model NAME or from the WIDTH renders a wrong
//                      label and the suite fails. Only modelos.tipo_produto
//                      produces the right answer.
// ---------------------------------------------------------------------
const MODELOS_FIXTURE = [
  { id: 1, nome: 'Paris', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' }, tipo_produto: 'tapete' },
  { id: 2, nome: 'Manta Barcelona', largura: 1.4, cor_1: { id: 3, nome: 'PRETO' }, cor_2: { id: 2, nome: 'CRU' }, tipo_produto: 'manta' },
  { id: 3, nome: 'Manta Legado', largura: 1.4, cor_1: { id: 4, nome: 'BEGE' }, cor_2: { id: 2, nome: 'CRU' }, tipo_produto: 'tapete' },
];

// Walks a FaithfulNode tree collecting nodes carrying `name` (optionally with
// an exact value). Works on any node, including document.body.
function findByAttr(root, name, value) {
  const out = [];
  (function walk(node) {
    for (const child of (node.children || [])) {
      if (child && child._attrs && Object.prototype.hasOwnProperty.call(child._attrs, name)
        && (value == null || String(child._attrs[name]) === value)) out.push(child);
      if (child && child.children) walk(child);
    }
  })(root);
  return out;
}

// Pass-7 (UIC-006): the option inventory of a canonical select popover
// lives in the portaled listbox panel, which exists only while the control
// is open. Opening and closing is a pure read — neither emits a change
// event — so these helpers report exactly what the operator would see.
// The assertions built on them are unchanged: same values, same labels,
// same order.
let popoverProbeDocument = null;

function popoverItems(control) {
  const doc = popoverProbeDocument;
  assert.ok(doc, 'popoverProbeDocument must be set by the boot helper');
  assert.equal(control.getAttribute('data-rv-select-popover'), '1',
    'the control under test is not a canonical select popover');
  control.open();
  const out = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c && c.getAttribute && c.getAttribute('role') === 'option') {
        out.push({ value: c.getAttribute('data-rv-option-value'), text: c.textContent });
      }
      if (c && c.children) walk(c);
    }
  })(doc.body);
  control.close({ focus: false });
  return out;
}

function optionTexts(control) { return popoverItems(control).map((o) => o.text); }

function optionValues(control) { return popoverItems(control).map((o) => o.value); }

// Every canonical select popover under a root, in DOM order.
function selectPopovers(root) { return findByAttr(root, 'data-rv-select-popover'); }

function makePedidoFormRuntime() {
  const calls = {
    pedidoInsert: null, pedidoItensInsert: null, pedidoDelete: 0, selects: [],
    // Toda chamada de RPC, em ordem, e todo payload de INSERT em `pedidos`.
    // A primeira prova que abrir a tela consulta a sugestao exatamente uma vez
    // e nao escreve; a segunda prova que um conflito nao reinsere em silencio.
    rpcs: [], pedidoInserts: [],
  };
  const opts = (arguments.length && arguments[0]) || {};
  const failItensInsert = opts.failItensInsert;
  // BATCH-02: um numero manual ocupado chega como 23505 na constraint
  // pedidos_numero_key — exatamente o envelope que o PostgREST devolve.
  const numeroDuplicado = opts.numeroDuplicado;
  // BATCH-02: ambiente onde `modelos.tipo_produto` nao pode ser lido.
  const failTipoProduto = opts.failTipoProduto;
  // Pre-preenchimento: fila de respostas de `consultar_proximo_numero_pedido()`.
  // A primeira e a sugestao da abertura; as seguintes sao renovacoes apos
  // conflito. `null` representa a RPC indisponivel (sem permissao, offline, ou
  // db/90 ainda nao aplicado) — nunca um numero.
  const proximoNumeroFila = Object.prototype.hasOwnProperty.call(opts, 'proximoNumero')
    ? [].concat(opts.proximoNumero)
    : [69];
  // Document double from the shared module; createElement is widened to the
  // attribute-aware PedidoFormNode (see above). createTextNode / body / the
  // #toasts node all come straight from _doubles.js. addEventListener is
  // widened to RECORD the handler (the shared double no-ops it) so the suite
  // can fire a real Escape at the item modal — a browser capability the modal
  // genuinely depends on. Widening toward real-DOM semantics, never a
  // weakening (CODE_HEALTH_RULES.md §20).
  const document = createDocument();
  document.createElement = (tag) => new PedidoFormNode(tag);
  document._listeners = {};
  document.addEventListener = (type, fn) => { (document._listeners[type] = document._listeners[type] || []).push(fn); };
  document.removeEventListener = (type, fn) => {
    document._listeners[type] = (document._listeners[type] || []).filter((h) => h !== fn);
  };
  function tableData(table, cols) {
    if (table === 'clientes') return [{ id: 501, nome: 'Cliente Atlas' }];
    if (table === 'modelos') {
      // Faithful PostgREST projection: the BASE query does not select
      // tipo_produto, so it must not come back. The screen can only know a
      // model's type by issuing the separate `id, tipo_produto` augmentation
      // — which makes the Tipo proofs non-vacuous instead of free-riding on
      // an over-generous double.
      if (/tipo_produto/.test(String(cols || ''))) {
        return MODELOS_FIXTURE.map((m) => ({ id: m.id, tipo_produto: m.tipo_produto }));
      }
      return MODELOS_FIXTURE.map((m) => ({
        id: m.id, nome: m.nome, largura: m.largura, cor_1: m.cor_1, cor_2: m.cor_2,
      }));
    }
    return [];
  }
  function chain(table) {
    let mutation = null;
    let payload = null;
    let cols = null;
    const api = {
      select(value) { if (cols == null) { cols = value; calls.selects.push({ table, cols: value }); } return api; },
      order() { return api; },
      eq() { return api; },
      insert(value) {
        mutation = 'insert';
        payload = value;
        if (table === 'pedidos') { calls.pedidoInsert = value; calls.pedidoInserts.push(value); }
        if (table === 'pedido_itens') calls.pedidoItensInsert = value;
        return api;
      },
      delete() { mutation = 'delete'; if (table === 'pedidos') calls.pedidoDelete += 1; return api; },
      single() {
        if (table === 'pedidos' && mutation === 'insert') {
          // `numeroDuplicado` como NUMERO significa "as N primeiras insercoes
          // colidem"; como `true`, todas colidem. Modela o numero tomado por
          // outro Pedido entre a sugestao e o envio.
          const aindaColide = typeof numeroDuplicado === 'number'
            ? calls.pedidoInserts.length <= numeroDuplicado
            : Boolean(numeroDuplicado);
          if (aindaColide) {
            return Promise.resolve({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "pedidos_numero_key"',
                details: 'Key (numero)=(5000) already exists.',
              },
            });
          }
          return Promise.resolve({ data: { id: 'ped-1', numero: 7, status: 'rascunho', data_pedido: '2026-07-25' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        let result;
        if (table === 'modelos' && failTipoProduto && /tipo_produto/.test(String(cols || ''))) {
          result = { data: null, error: { message: 'column modelos.tipo_produto does not exist', code: '42703' } };
        } else if (table === 'pedido_itens' && mutation === 'insert') {
          result = failItensInsert
            ? { data: null, error: { message: 'itens insert falhou' } }
            : { data: [{ id: 'pi-1' }], error: null };
        } else if (table === 'pedidos' && mutation === 'delete') {
          result = { data: null, error: null };
        } else {
          result = { data: tableData(table, cols), error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  }
  const sandbox = {
    window: {},
    document,
    console,
    Node: FaithfulNode,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  // Faithful PostgREST RPC envelope. `consultar_proximo_numero_pedido()` is
  // SECURITY DEFINER + is_admin()-gated in db/90, so a refused call arrives as
  // an ERROR envelope (403/42501) and never as a number — modelled by a `null`
  // entry in the queue. Once the queue is drained the last answer repeats, so a
  // test only declares the values it actually reasons about.
  sandbox.supa = {
    from: (table) => chain(table),
    rpc: (fn, params) => {
      calls.rpcs.push({ fn, params });
      if (fn !== 'consultar_proximo_numero_pedido') {
        return Promise.resolve({ data: null, error: { message: 'rpc inesperada: ' + fn } });
      }
      const value = proximoNumeroFila.length > 1 ? proximoNumeroFila.shift() : proximoNumeroFila[0];
      if (value === null || value === undefined) {
        return Promise.resolve({
          data: null,
          error: { code: '42501', message: 'acesso negado: consultar_proximo_numero_pedido() exige admin' },
        });
      }
      return Promise.resolve({ data: value, error: null });
    },
  };
  // NOTE: no sandbox.el here — the REAL js/ui.js el() (loaded below) is the
  // renderer, so the boolean-attr fix is exercised instead of a boolean-blind
  // stub. Non-ui.js collaborators are kept exactly as before (rule 4).
  sandbox.ADMIN_MENU = [];
  sandbox.shellLayout = (_menu, content) => content;
  sandbox.navigate = () => {};
  sandbox.requestAnimationFrame = (fn) => fn();
  sandbox.corPreviewElement = () => new FaithfulNode('div');
  vm.createContext(sandbox);
  // Load real js/ui.js FIRST so window.el is the boolean-aware primitive, then
  // the screen (proven pattern: tests/cliente-pedido-tracking.smoke.js).
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  // The REAL route helpers, in their index.html order (op-display owns
  // deriveProductType; product-route delegates to it). Loading them means the
  // Tipo proofs exercise the accepted derivation, not a suite-local copy.
  vm.runInContext(opDispSrc, sandbox, { filename: 'js/op-display.js' });
  vm.runInContext(pRouteSrc, sandbox, { filename: 'js/product-route.js' });
  vm.runInContext(rowEditor, sandbox, { filename: 'js/screens/pedido-item-row-editor.js' });
  vm.runInContext(numSug, sandbox, { filename: 'js/screens/pedido-numero-sugestao.js' });
  // js/ui.js also defines a real toast() that appends to #toasts and arms a
  // setTimeout; the runtime test never asserts on toast, so re-override it with
  // a no-op AFTER ui.js (representation translation, rule 4).
  sandbox.toast = () => {};
  vm.runInContext(screen, sandbox, { filename: 'js/screens/pedido-form.js' });
  return { sandbox, calls, document };
}

// ---------------------------------------------------------------------
// Batch-01 runtime helpers — boot the screen and drive the item modal
// exactly as a user would (buttons, selects, Escape), never by poking
// internal state.
// ---------------------------------------------------------------------
async function bootPedidoForm(options) {
  const rt = makePedidoFormRuntime(options);
  popoverProbeDocument = rt.document;
  const root = await vm.runInContext('window.screenPedidoNovo()', rt.sandbox);
  await flushRuntime();
  await flushRuntime();
  return { ...rt, root };
}

function currentModal(document) {
  const overlays = (document.body.children || []).filter((n) => !n._removed);
  return overlays.length ? overlays[overlays.length - 1] : null;
}

function openAddModal(root, document) {
  findButton(root, /^Adicionar item$/)._listeners.click();
  return currentModal(document);
}

function editIconOf(root, rowIndex) {
  return findByAttr(findByAttr(root, 'data-uid')[rowIndex], 'title', 'Editar item')[0];
}

function openEditModal(root, document, rowIndex) {
  editIconOf(root, rowIndex)._listeners.click();
  return currentModal(document);
}

// The trash icon sits next to the pencil in the row's action cell.
function removeRow(root, rowIndex) {
  editIconOf(root, rowIndex).parentNode.children[1]._listeners.click();
}

// The item table header — the single node whose first cell reads 'Img'.
function itensHeader(root) {
  let found = null;
  (function walk(node) {
    for (const child of (node.children || [])) {
      if (!found && child.children && child.children.length >= 8
        && child.children[0] && child.children[0].textContent === 'Img') found = child;
      if (child.children) walk(child);
    }
  })(root);
  return found;
}

function modalTipoSelect(modal) { return findByAttr(modal, 'data-item-modal-tipo')[0]; }
function modalModeloSelect(modal) { return findByAttr(modal, 'data-item-modal-modelo')[0]; }

function pickTipo(modal, value) {
  const sel = modalTipoSelect(modal);
  sel.value = value;
  sel._listeners.change();
}

function pickModelo(modal, value) {
  const sel = modalModeloSelect(modal);
  sel.value = value;
  sel._listeners.change();
}

function setModalMetragem(modal, value) {
  const input = allByTag(modal, 'input').find((i) => i.getAttribute('placeholder') === '0,00');
  input.value = value;
  input._listeners.input();
  return input;
}

function setModalObservacao(modal, value) {
  const ta = allByTag(modal, 'textarea')[0];
  ta.value = value;
  ta._listeners.input();
  return ta;
}

function confirmModal(modal, re) {
  findButton(modal, re)._listeners.click();
}

// Snapshot of the local draft items, read from the RENDERED rows (uid +
// model + metragem + observacao) — never from screen internals.
function snapshotItens(root) {
  return findByAttr(root, 'data-uid').map((row) => {
    const inputs = allByTag(row, 'input');
    return {
      uid: row.getAttribute('data-uid'),
      modeloId: selectPopovers(row)[1].value,
      tipo: findByAttr(row, 'data-item-tipo')[0].textContent,
      metros: inputs.find((i) => i.getAttribute('placeholder') === '0,00').value,
      observacao: inputs.find((i) => i.getAttribute('placeholder') === '-').value,
    };
  });
}

function gridTracks(node) {
  const m = String(node.style.cssText).match(/grid-template-columns:([^;]+)/);
  return m ? m[1].trim().split(/\s+/) : null;
}

function flushRuntime() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('pedido-form: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-form.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-form: sintaxe JS válida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('pedido-form: expõe screenPedidoNovo no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(screen, sandbox);
  assert.equal(typeof sandbox.window.screenPedidoNovo, 'function',
    'window.screenPedidoNovo deve estar exposto como função');
  assert.ok(sandbox.window.RAVATEX_SCREENS, 'RAVATEX_SCREENS ausente');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoForm, 'object');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoForm.screenPedidoNovo, 'function');
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedido-form.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedido-form\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-form.js deve ser carregado exatamente 1 vez');
});

test('index.html: pedido-form.js vem antes de boot.js', () => {
  const idxForm = index.indexOf('js/screens/pedido-form.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxForm < idxBoot, 'pedido-form.js deve vir antes de boot.js');
});

test('index.html: pedido-form.js vem depois de pedido-ui.js e pedidos-list.js', () => {
  const idxHelper = index.indexOf('js/pedido-ui.js');
  const idxList = index.indexOf('js/screens/pedidos-list.js');
  const idxForm = index.indexOf('js/screens/pedido-form.js');
  assert.ok(idxHelper > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxList > 0, 'pedidos-list.js deve estar no <head>');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxHelper < idxForm, 'pedido-form.js deve vir depois de pedido-ui.js');
  assert.ok(idxList < idxForm, 'pedido-form.js deve vir depois de pedidos-list.js');
});

// ---------------------------------------------------------------------
// 4. boot.js registra rota #/pedidos/novo
// ---------------------------------------------------------------------

test('boot.js: registra rota #/pedidos/novo com role admin', () => {
  assert.match(
    boot,
    /'#\/pedidos\/novo'\s*:\s*\{\s*render\s*:\s*window\.screenPedidoNovo[^}]*roles\s*:\s*\[\s*['"]admin['"]\s*\]/i,
    "rota #/pedidos/novo deve ser registrada com role admin e render=screenPedidoNovo"
  );
});

// ---------------------------------------------------------------------
// 5. pedidos-list.js navega para o form
// ---------------------------------------------------------------------

test('pedidos-list.js: botão "Novo pedido" navega para #/pedidos/novo', () => {
  // Deve haver um bloco com "Novo pedido" e navigate('#/pedidos/novo')
  // no mesmo callback.
  assert.match(list, /navigate\(\s*['"]#\/pedidos\/novo['"]\s*\)/);
  assert.match(list, /['"]Novo pedido['"]/);
});

test('pedidos-list.js: NÃO tem mais toast "próxima fase" no botão Novo', () => {
  // Após a fase C2, o toast placeholder "Formulário será implementado
  // na próxima fase" deve ter sido substituído pela navegação real.
  assert.doesNotMatch(
    list,
    /Formul[áa]rio ser[áa] implementado na pr[óo]xima fase/i,
    "toast placeholder 'Formulário será implementado na próxima fase' deve ter sido removido"
  );
});

// ---------------------------------------------------------------------
// 6. pedido-form.js usa tabelas corretas
// ---------------------------------------------------------------------

test('pedido-form: usa tabela `pedidos` para insert', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.insert\s*\(/);
});

test('pedido-form: usa tabela `pedido_itens` para insert', () => {
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"]\s*\)\s*\.insert\s*\(/);
});

test('pedido-form: compensa (DELETE pedidos) se itens falharem', () => {
  // Comentário + lógica de compensação: insert pedido → se itens falharem
  // → delete pedido criado.
  assert.match(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.delete\s*\(\s*\)\s*\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/);
  assert.match(screen, /Compensa[çc][ãa]o|compensar/);
});

test('pedido-form: NÃO referencia tabelas de OP/lote/entrega', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens)['"]/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]lotes['"]/);
});

// ---------------------------------------------------------------------
// 7. pedido-form.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-form: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
});

test('pedido-form: NÃO usa service_role / service_role key', () => {
  // Comentários podem mencionar (documentam proibição). Verificar
  // ausência de USO real (chamadas, variáveis, .from, etc).
  // Heurística: remove linhas de comentário e verifica o resto.
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(codeOnly, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 8. pedido-form.js não consulta token público
// ---------------------------------------------------------------------

test('pedido-form: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  // Comentários podem mencionar "token" no contexto de proibição.
  // Verificar ausência de USO real (insert/update/select com token).
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

// ---------------------------------------------------------------------
// 9. pedido-form.js não mexe em arquivos críticos de OP
// ---------------------------------------------------------------------

test('pedido-form: NÃO referencia op-nova.js', () => {
  assert.doesNotMatch(screen, /op-nova\.js/);
  assert.doesNotMatch(screen, /screenNovaOP/);
  assert.doesNotMatch(screen, /window\.screenNovaOP/);
});

test('pedido-form: NÃO referencia op-persistir.js / op-latex-admin.js', () => {
  assert.doesNotMatch(screen, /op-persistir\.js/);
  assert.doesNotMatch(screen, /persistirOP/);
  assert.doesNotMatch(screen, /op-latex-admin\.js/);
  assert.doesNotMatch(screen, /renderOPLatexAdmin/);
});

test('pedido-form: NÃO referencia entrega-writes.js / entrega-form.js', () => {
  assert.doesNotMatch(screen, /entrega-writes\.js/);
  assert.doesNotMatch(screen, /entrega-form\.js/);
});

test('pedido-form: NÃO referencia cadastros.js', () => {
  assert.doesNotMatch(screen, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});

// ---------------------------------------------------------------------
// 10. pedido-form.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-form: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(screen, /CREATE\s+POLICY/i);
  assert.doesNotMatch(screen, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(screen, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 11. pedido-form.js não gera OP
// ---------------------------------------------------------------------

test('pedido-form: NÃO chama generate_op / criar_lote / op_fornecedores', () => {
  assert.doesNotMatch(screen, /gerar_op_latex/);
  assert.doesNotMatch(screen, /op_fornecedores/);
  assert.doesNotMatch(screen, /gerar_op_pedido/);
  assert.doesNotMatch(screen, /criar_lote/);
});

// ---------------------------------------------------------------------
// 12. pedido-form.js usa preview de cor
// ---------------------------------------------------------------------

test('pedido-form: usa window.corPreviewElement para preview 48x48', () => {
  assert.match(rowEditor, /window\.corPreviewElement/);
});

test('pedido-form: usa helpers de pedido-ui (status)', () => {
  // Se o form usa badge de status (não estritamente necessário no form
  // de criação, mas é um sinal de que consome o helper).
  const usaHelper = /window\.RAVATEX_PEDIDO_UI|window\.pedidoStatus|window\.corPreview/i.test(screen + rowEditor);
  assert.ok(usaHelper, 'form deve consumir helpers de js/pedido-ui.js');
});

// C2-R1: correção do preview — slot fixo + updatePreview(), sem insertBefore

test('pedido-form: NÃO usa row.insertBefore(previewSlot, metrosInput) (bug C2 corrigido)', () => {
  // O bug original usava row.insertBefore(previewSlot, metrosInput)
  // mas metrosInput está em wrapper, não é filho direto de row.
  assert.doesNotMatch(
    rowEditor,
    /row\.insertBefore\s*\(\s*previewSlot\s*,\s*metrosInput\s*\)/,
    "não deve usar row.insertBefore(previewSlot, metrosInput) — bug C2"
  );
});

test('pedido-form: NÃO usa insertBefore genérico para o preview (slot fixo)', () => {
  // Garantia mais ampla: nenhum insertBefore envolvendo o previewSlot
  // e metrosInput (em qualquer ordem).
  assert.doesNotMatch(
    rowEditor,
    /insertBefore\s*\(\s*previewSlot/,
    "previewSlot não deve ser alvo de insertBefore (deve ser slot fixo)"
  );
});

test('pedido-form: usa slot fixo de preview (data-preview-slot)', () => {
  // Slot fixo deve ser criado UMA vez e permanecer no row.
  assert.match(
    rowEditor,
    /window\.el\(\s*['"]div['"]\s*,\s*\{\s*['"]data-preview-slot['"]\s*:\s*['"]1['"]/,
    "deve criar slot fixo com atributo data-preview-slot"
  );
});

test('pedido-form: usa updatePreview() para atualizar o slot de preview', () => {
  // Função updatePreview() deve ser definida e usada.
  assert.match(
    rowEditor,
    /function\s+updatePreview\s*\(\s*\)\s*\{/,
    "deve definir função updatePreview()"
  );
  // updatePreview deve usar replaceChildren para limpar.
  assert.match(
    rowEditor,
    /updatePreview\s*\(\s*\)\s*\{[\s\S]*?replaceChildren\s*\(/,
    "updatePreview deve usar replaceChildren para limpar o slot"
  );
  // updatePreview deve ser chamado no change do modelo.
  // BATCH-02: o change do Modelo chama refreshDerived(), que atualiza cores,
  // largura E preview de uma vez. Provamos a CADEIA inteira em vez de um
  // literal adjacente — a garantia e a mesma, declarada explicitamente.
  assert.match(
    rowEditor,
    /modeloSelect\.addEventListener\(\s*['"]change['"][\s\S]*?refreshDerived\s*\(\s*\)/,
    "o change do select de modelo deve disparar refreshDerived()"
  );
  assert.match(
    rowEditor,
    /function\s+refreshDerived\s*\(\s*\)\s*\{[\s\S]*?updatePreview\s*\(\s*\)/,
    "refreshDerived() deve atualizar o preview"
  );
  // updatePreview deve ser chamado na inicialização (modelo pré-selecionado).
  const updateCount = (rowEditor.match(/updatePreview\s*\(\s*\)/g) || []).length;
  assert.ok(updateCount >= 2,
    'updatePreview deve ser chamado ao menos 2x (init + change); encontrado: ' + updateCount);
});

test('pedido-form: previewSlot é filho direto de row (appendChild, não insertBefore)', () => {
  // Slot fixo deve ser anexado com appendChild (não insertBefore).
  assert.match(
    rowEditor,
    /row\.appendChild\s*\(\s*previewSlot\s*\)/,
    "previewSlot deve ser filho direto de row via appendChild"
  );
});

// ---------------------------------------------------------------------
// 13. pedido-form.js status inicial
// ---------------------------------------------------------------------

test('pedido-form: status inicial é "rascunho"', () => {
  // O literal 'rascunho' aparece como argumento do salvar()
  // e como valor do parâmetro status da função.
  assert.match(screen, /salvar\s*\(\s*saveBtn\s*,\s*['"]rascunho['"]/);
  // O literal 'rascunho' é passado como status em algum momento.
  assert.match(screen, /['"]rascunho['"]/);
});

test('pedido-form: NÃO hardcoda status de "recebido" ou "confirmado" na criação', () => {
  // Garantir que o status inicial de um novo pedido é sempre "rascunho"
  // e não "recebido", "confirmado" ou "produzindo".
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  // Buscar o primeiro uso de status como literal (pode estar no payload ou
  // como argumento). Não deve conter "recebido" / "confirmado" / etc.
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]recebido['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]confirmado['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]produzindo['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]entregue['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]cancelado['"]/);
});

// ---------------------------------------------------------------------
// 14. pedido-form.js não navega para rota de OP
// ---------------------------------------------------------------------

test('pedido-form: pós-save admin mostra resumo e CTA "Abrir OP de Tecelagem"', () => {
  assert.match(screen, /function\s+buildPostSaveResumo\s*\(/);
  assert.match(screen, /Pedido salvo com sucesso/);
  assert.match(screen, /Abrir OP de Tecelagem/);
  assert.match(screen, /Ver pedido/);
  assert.match(screen, /Novo pedido/);
  assert.match(screen, /data-post-save-summary['"]\s*:\s*['"]admin['"]/);
});

test('pedido-form: CTA "Abrir OP de Tecelagem" usa hash route com pedido_id', () => {
  assert.match(
    screen,
    /window\.location\.hash\s*=\s*['"]#\/ops\/nova\?pedido_id=['"]\s*\+\s*pedido\.id/,
    'CTA deve setar window.location.hash para #/ops/nova?pedido_id=<id>'
  );
});

test('pedido-form: ações pós-save ficam alinhadas à direita', () => {
  assert.match(screen, /data-post-save-actions['"]\s*:\s*['"]right['"]/);
  assert.match(screen, /justify-content:flex-end/);
});

test('pedido-form: NÃO usa rota física para /ops/nova', () => {
  assert.doesNotMatch(screen, /location\.href\s*=\s*['"]\/ops\/nova/);
  assert.doesNotMatch(screen, /location\.assign\s*\(\s*['"]\/ops\/nova/);
  assert.doesNotMatch(screen, /href\s*:\s*['"]\/ops\/nova/);
});

// ---------------------------------------------------------------------
// 15. pedido-form.js tem compensação documentada
// ---------------------------------------------------------------------

test('pedido-form: tem LIMITACAO documentada (sem RPC/transação atômica)', () => {
  // Comentário explícito sobre limitação conhecida
  assert.match(screen, /[Ll]imita[çc][ãa]o|atomic|transa[çc][ãa]o|compensar/i);
});

test('pedido-form: usa .single() para retornar o pedido inserido', () => {
  // Para obter o id do pedido criado para uso na compensação.
  assert.match(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.insert\([\s\S]*?\)\s*\.select\([\s\S]*?\)\s*\.single\s*\(\s*\)/);
});

// ---------------------------------------------------------------------
// 16. Schema 13_* não foi alterado
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C2', () => {
  // Estrutura esperada mantida
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  // RLS continua admin-only
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

test('pedido-form: CTA post-save aceita pedido_id UUID sem Number/parseInt', () => {
  const postSave = (screen.match(/function\s+buildPostSaveResumo\s*\([\s\S]*?\n    async function salvar/) || [''])[0];
  assert.ok(postSave, 'trecho buildPostSaveResumo nao encontrado');
  assert.match(postSave, /#\/ops\/nova\?pedido_id=['"]\s*\+\s*pedido\.id/);
  assert.doesNotMatch(postSave, /Number\s*\(\s*pedido\.id\s*\)/);
  assert.doesNotMatch(postSave, /parseInt\s*\(\s*pedido\.id\s*/);
});

test('pedido-form: input de metragem atualiza resumo sem render global', () => {
  // Ancora reapontada pelo lote 2: buildItemRow virou buildRow(options) e
  // mudou de arquivo (js/screens/pedido-item-row-editor.js). A assercao segue
  // identica: digitar metragem nao pode reconstruir a tela.
  const buildItemRow = (rowEditor.match(/function\s+buildRow\s*\(options\)\s*\{[\s\S]*?\n  function buildHeader/) || [''])[0];
  assert.ok(buildItemRow, 'trecho buildItemRow nao encontrado');
  const inputHandler = (buildItemRow.match(/metrosInput\.addEventListener\(\s*['"]input['"]\s*,\s*function\s*\(\)\s*\{[\s\S]*?\n    \}\);/) || [''])[0];
  assert.ok(inputHandler, 'handler input de metros nao encontrado');
  assert.match(inputHandler, /item\.metros\s*=\s*metrosInput\.value/);
  assert.match(inputHandler, /onChange\s*\(\s*item\s*\)/,
    'handler deve notificar a tela para recalcular totais/resumo localmente');
  assert.doesNotMatch(inputHandler, /render\s*\(\s*\)/,
    'handler de metragem nao pode reconstruir a tela a cada digito');
  assert.match(screen, /function\s+updateItensSummary\s*\(\)\s*\{/);
  assert.match(screen, /data-pedido-total-metros/);
  assert.match(screen, /data-pedido-checkout-summary/);
});

test('pedido-form runtime: digitar 1000 preserva o mesmo input e salva metragem correta', async () => {
  const { sandbox, calls } = makePedidoFormRuntime();
  const root = await vm.runInContext('window.screenPedidoNovo()', sandbox);
  await flushRuntime();
  // BATCH-02 adiciona a segunda consulta de tipo_produto: o render final so
  // acontece depois dela.
  await flushRuntime();

  // Pass-7: Cliente, Tipo and Modelo are canonical select popovers; Status
  // is now a read-only field presentation and is asserted separately.
  const selects = selectPopovers(root);
  assert.ok(selects.length >= 3, 'popovers de cliente/tipo/modelo nao renderizados');
  selects[0].value = '501';
  selects[0]._listeners.change();
  // BATCH-02: a linha exige Tipo ANTES de Modelo, e ambos sao inline.
  const tipoSel = findByAttr(root, 'data-item-tipo-select')[0];
  const modeloSel = findByAttr(root, 'data-item-modelo-select')[0];
  tipoSel.value = 'tapete';
  tipoSel._listeners.change();
  modeloSel.value = '1';
  modeloSel._listeners.change();

  // Real el() stores placeholder via setAttribute (a real DOM attribute), not
  // as a reflected `.placeholder` property, so read it through getAttribute.
  const metrosInput = allByTag(root, 'input').find((input) => input.getAttribute('placeholder') === '0,00');
  assert.ok(metrosInput, 'input de metragem do item inicial nao encontrado');

  for (const value of ['1', '10', '100', '1000']) {
    metrosInput.value = value;
    metrosInput._listeners.input();
    assert.equal(containsNode(root, metrosInput), true,
      'input de metragem foi recriado durante a digitacao');
  }

  assert.equal(metrosInput.value, '1000');
  const totalLabel = (1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  assert.equal(root.querySelectorAll('[data-pedido-total-metros]')[0].textContent, totalLabel);
  assert.match(root.querySelectorAll('[data-pedido-checkout-summary]')[0].textContent, /1000|1\.000,00|1,000\.00/);

  const saveBtn = findButton(root, /^Salvar rascunho$/);
  assert.ok(saveBtn, 'botao Salvar rascunho nao encontrado');
  saveBtn._listeners.click();
  await flushRuntime();
  await flushRuntime();

  assert.ok(Array.isArray(calls.pedidoItensInsert), 'insert de pedido_itens nao chamado');
  assert.equal(calls.pedidoItensInsert[0].metros, 1000);
});

// TEST-MOCK-FIDELITY-AUDIT R1 demonstration: proves the faithful adoption
// catches what the old runtimeEl would have masked. The old runtimeEl stored
// attributes raw with no boolean coercion, so a disabled/checked coercion bug
// in the form would have passed green; the real el() + FaithfulNode do not.
test('pedido-form: FaithfulNode + real el() catch a boolean-attr regression the old runtimeEl masked (R1 demo)', () => {
  const { sandbox } = makePedidoFormRuntime();
  const el = sandbox.window.el;
  // Fix path: real el() omits a falsy boolean attribute.
  assert.equal(el('button', { disabled: false }).hasAttribute('disabled'), false,
    'disabled:false must be ABSENT (the UI-EL-BOOLEAN-ATTR-FIX), verified through the faithful double');
  assert.equal(el('button', { disabled: true }).hasAttribute('disabled'), true,
    'disabled:true must be present');
  // Regression path: a raw setAttribute(k,false) still renders PRESENT in a
  // real-DOM-faithful node, so the bug class is caught — the old runtimeEl
  // stored the raw value and could not distinguish present from absent.
  const raw = new FaithfulNode('button');
  raw.setAttribute('disabled', false);
  assert.equal(raw.hasAttribute('disabled'), true,
    'setAttribute(k,false) renders present in the faithful node — the double catches the bug class');
});

// =====================================================================
// 17. KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1
//
// Order date, optional order number, and INLINE product-type selection.
//
// The architect ruled that Tipo-before-Modelo inside a modal does NOT
// satisfy the requested placement: on #/pedidos/novo both must be inline
// in the item row, and the full item entity must not live in a modal.
// These proofs are therefore behavioural — they boot the screen and drive
// the real inline controls.
//
// The fixture keeps the Tapete model NAMED "Manta Legado" carrying the
// Manta's 1,40 m width, so a name-based or width-based route derivation
// cannot pass.
// =====================================================================

function rowsOf(root) { return findByAttr(root, 'data-uid'); }
function rowTipo(row) { return findByAttr(row, 'data-item-tipo-select')[0]; }
function rowModelo(row) { return findByAttr(row, 'data-item-modelo-select')[0]; }
function pick(select, value) { select.value = value; select._listeners.change(); }

function setRowMetragem(row, value) {
  const input = allByTag(row, 'input').find((i) => i.getAttribute('placeholder') === '0,00');
  input.value = value;
  input._listeners.input();
  return input;
}

// Preenche o primeiro item com uma combinacao valida e escolhe o cliente.
async function fillOneValidItem(root) {
  // Pass-7: Cliente is a canonical select popover, located by its
  // accessible name rather than by a native tag.
  const cliente = findByAttr(root, 'aria-label', 'Cliente')[0];
  cliente.value = '501';
  cliente._listeners.change();
  const row = rowsOf(root)[0];
  pick(rowTipo(row), 'tapete');
  pick(rowModelo(row), '1');
  setRowMetragem(row, '10');
}

// Rotulos de campo na ordem do DOM, para que "X aparece antes de Y" seja uma
// afirmacao sobre o que o operador VE, e nao sobre a ordem do codigo-fonte.
function labelOrder(root) {
  const out = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c.tagName === 'LABEL' && c.textContent) out.push(c.textContent.replace(/\s*\*\s*$/, '').trim());
      if (c.children) walk(c);
    }
  })(root);
  return out;
}

test('batch2/1. o cabecalho e Número do pedido -> Data do pedido -> Prazo desejado', async () => {
  const { root } = await bootPedidoForm();
  const labels = labelOrder(root);
  const iNum = labels.indexOf('Número do pedido');
  const iData = labels.indexOf('Data do pedido');
  const iPrazo = labels.indexOf('Prazo desejado');
  assert.ok(iNum >= 0, 'campo "Número do pedido" ausente');
  assert.ok(iData >= 0, 'campo "Data do pedido" ausente');
  assert.ok(iPrazo >= 0, 'campo "Prazo desejado" ausente');
  assert.ok(iNum < iData, 'Número do pedido deve vir antes de Data do pedido');
  assert.ok(iData < iPrazo, 'Data do pedido deve vir imediatamente antes de Prazo desejado');
});

// A sugestao so pode faltar quando a RPC nega/falha. Nesse caso o campo nasce
// vazio e a alocacao volta a ser da coluna de identidade.
test('batch2/2+3. sem sugestao disponivel o campo nasce vazio e usa alocacao automatica', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: null });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  assert.ok(numeroInput, 'input de numero ausente');
  assert.equal(numeroInput.getAttribute('type'), 'number');
  assert.equal(numeroInput.getAttribute('min'), '1');
  assert.equal(numeroInput.value, '', 'sem sugestao o numero nasce em branco');

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();

  assert.ok(calls.pedidoInsert, 'INSERT em pedidos nao ocorreu');
  assert.equal(Object.prototype.hasOwnProperty.call(calls.pedidoInsert, 'numero'), false,
    'numero em branco NAO pode ir no payload — a alocacao e da coluna de identidade');
});

test('batch2/2b. um Número informado e persistido EXATAMENTE como digitado', async () => {
  const { root, calls } = await bootPedidoForm();
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  numeroInput.value = '5000';
  numeroInput._listeners.input();

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();

  assert.equal(calls.pedidoInsert.numero, 5000, 'o numero digitado deve ir verbatim no payload');
});

test('batch2/2c. Número zero ou negativo e recusado antes de qualquer escrita', async () => {
  for (const invalido of ['0', '-7']) {
    const { root, calls } = await bootPedidoForm();
    const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
    numeroInput.value = invalido;
    numeroInput._listeners.input();
    await fillOneValidItem(root);
    findButton(root, /^Salvar rascunho$/)._listeners.click();
    await flushRuntime();
    assert.equal(calls.pedidoInsert, null, `numero ${invalido} nao pode chegar ao banco`);
  }
});

test('batch2/4. um Número ocupado mostra erro controlado em portugues e NAO renumera', async () => {
  const { root, calls } = await bootPedidoForm({ numeroDuplicado: true });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  numeroInput.value = '5000';
  numeroInput._listeners.input();

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();

  const erro = findByAttr(root, 'data-pedido-numero-erro')[0];
  assert.equal(erro.textContent, 'Este número de pedido já está em uso.');
  assert.equal(findByAttr(root, 'data-pedido-numero')[0].value, '5000',
    'o valor digitado sobrevive: nunca e trocado por um automatico em silencio');
  assert.equal(calls.pedidoItensInsert, null, 'nenhum item pode ser inserido apos a recusa');
  assert.equal(calls.pedidoDelete, 0, 'a recusa do numero nao deve disparar compensacao');
});

// ---------------------------------------------------------------------
// Pre-preenchimento do Número do pedido (db/90).
// ---------------------------------------------------------------------

test('prefill/1. abrir a tela exibe uma SUGESTAO NUMERICA dentro do input editavel', async () => {
  const { root } = await bootPedidoForm({ proximoNumero: 69 });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  assert.equal(numeroInput.value, '69', 'o input deve abrir com o candidato numerico');
  assert.match(numeroInput.value, /^\d+$/, 'o valor exibido deve ser numerico');
  assert.equal(numeroInput.getAttribute('disabled'), null, 'a sugestao tem de ser editavel');
  assert.equal(numeroInput.getAttribute('readonly'), null, 'a sugestao tem de ser editavel');
  assert.equal(numeroInput.getAttribute('data-pedido-numero-sugerido'), '1');
});

// A prosa dos cabecalhos CITA o placeholder removido; o sujeito aqui e o que a
// tela EXIBE, entao a verificacao estatica corre sobre o codigo sem comentarios.
const semComentarios = (src) => src.replace(/^\s*\/\/.*$/gm, '');

test('prefill/2. a palavra "Automático" desapareceu do campo', async () => {
  const { root } = await bootPedidoForm({ proximoNumero: 69 });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  assert.equal(numeroInput.getAttribute('placeholder'), null,
    'o placeholder "Automático" nao pode sobreviver');
  assert.doesNotMatch(semComentarios(screen), /Automático/,
    'a tela nao pode mais exibir a palavra Automático');
  assert.doesNotMatch(semComentarios(numSug), /Automático/);
});

test('prefill/3. o texto de ajuda declara que a sugestao e alteravel', async () => {
  const { root } = await bootPedidoForm({ proximoNumero: 69 });
  const ajuda = findByAttr(root, 'data-pedido-numero-ajuda')[0];
  assert.equal(ajuda.textContent, 'Sugestão automática. Você pode alterar antes de salvar.');
});

// A prova de que abrir a tela nao consome numero, no lado do cliente: a unica
// coisa que a abertura faz e UMA leitura pela RPC declarada — nenhuma escrita,
// nenhum nextval, nenhuma insercao especulativa. O lado SQL (a sequencia
// realmente nao se move) e provado em
// tests/pedido-proximo-numero-rpc-invariant.mjs.
test('prefill/4. abrir a tela consulta a RPC uma unica vez e nao escreve nada', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: 69 });
  assert.ok(root, 'tela nao renderizou');
  const consultas = calls.rpcs.filter((c) => c.fn === 'consultar_proximo_numero_pedido');
  assert.equal(consultas.length, 1, 'a sugestao deve ser consultada exatamente uma vez na abertura');
  assert.equal(calls.pedidoInsert, null, 'abrir a tela nao pode inserir Pedido algum');
  assert.equal(calls.pedidoItensInsert, null, 'abrir a tela nao pode inserir item algum');
  assert.equal(calls.pedidoDelete, 0, 'abrir a tela nao pode apagar nada');
});

test('prefill/5. uma sequencia cujo proximo valor e 2 exibe 2', async () => {
  const { root } = await bootPedidoForm({ proximoNumero: 2 });
  assert.equal(findByAttr(root, 'data-pedido-numero')[0].value, '2');
});

// A autoridade e a sequencia de identidade. MAX(numero)+1 e proibido porque um
// numero manual alto ja avancou a sequencia, uma validacao revertida ja
// consumiu valores, e as lacunas sao aceitas (db/89).
test('prefill/6. a sugestao vem da RPC de sequencia, nunca de MAX(numero)+1', () => {
  assert.match(numSug, /RPC_PROXIMO_NUMERO = 'consultar_proximo_numero_pedido'/,
    'o modulo deve declarar a RPC autoritativa');
  assert.match(numSug, /supa\.rpc\(RPC_PROXIMO_NUMERO\)/,
    'o modulo deve consultar a RPC declarada');
  for (const [nome, bruto] of [['pedido-form.js', screen], ['pedido-numero-sugestao.js', numSug]]) {
    const src = semComentarios(bruto);
    assert.doesNotMatch(src, /max\s*\(\s*['"]?numero/i, nome + ' nao pode derivar o numero de MAX');
    assert.doesNotMatch(src, /order\(\s*'numero'[^)]*desc/i,
      nome + ' nao pode derivar o numero do maior numero existente');
    assert.doesNotMatch(src, /nextval/i, nome + ' nao pode consumir a sequencia');
  }
});

// Conflito CONTROLADO: a sugestao NAO e reserva. Se outro Pedido tomar o numero
// entre a abertura e o envio, a tela nao pode alocar outro numero em silencio —
// ela pede uma sugestao nova, mostra-a, e avisa o operador.
test('prefill/7. uma sugestao tomada por outro pedido e RENOVADA, nunca trocada em silencio', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: [69, 70], numeroDuplicado: 1 });
  assert.equal(findByAttr(root, 'data-pedido-numero')[0].value, '69');

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  await flushRuntime();

  // O numero tentado foi EXATAMENTE o que estava visivel.
  assert.equal(calls.pedidoInserts.length, 1, 'a tela nao pode reinserir sozinha apos o conflito');
  assert.equal(calls.pedidoInserts[0].numero, 69);

  // O campo passou a mostrar o candidato NOVO...
  assert.equal(findByAttr(root, 'data-pedido-numero')[0].value, '70',
    'o campo deve receber a sugestao nova');
  // ...e o operador foi informado de qual numero se perdeu e qual entrou.
  const aviso = findByAttr(root, 'data-pedido-numero-ajuda')[0];
  assert.match(aviso.textContent, /69/, 'o aviso deve nomear o numero perdido');
  assert.match(aviso.textContent, /Nova sugestão: 70\./, 'o aviso deve nomear a sugestao nova');
  assert.equal(findByAttr(root, 'data-pedido-numero-erro')[0].textContent, '',
    'uma sugestao renovada nao e erro do operador');
  assert.equal(calls.pedidoItensInsert, null, 'nenhum item pode ser inserido apos o conflito');
  assert.equal(calls.pedidoDelete, 0, 'o conflito nao dispara compensacao');
});

// Contraste com prefill/7: quando o numero foi DIGITADO, o valor do operador e
// preservado e a mensagem e a de numero em uso — nao uma renovacao.
test('prefill/8. um numero DIGITADO e ocupado preserva o valor e nao recebe sugestao nova', async () => {
  const { root } = await bootPedidoForm({ proximoNumero: [69, 70], numeroDuplicado: true });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  numeroInput.value = '4242';
  numeroInput._listeners.input();

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  await flushRuntime();

  assert.equal(findByAttr(root, 'data-pedido-numero')[0].value, '4242',
    'o valor digitado tem de sobreviver ao conflito');
  assert.equal(findByAttr(root, 'data-pedido-numero-erro')[0].textContent,
    'Este número de pedido já está em uso.');
  assert.doesNotMatch(findByAttr(root, 'data-pedido-numero-ajuda')[0].textContent, /Nova sugestão/,
    'um numero digitado nao pode ser substituido por uma sugestao');
});

test('prefill/9. o numero VISIVEL e o numero tentado, mesmo sem o operador tocar no campo', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: 69 });
  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  assert.equal(calls.pedidoInsert.numero, 69,
    'o numero exibido deve ir verbatim no payload');
});

test('prefill/10. o operador pode substituir a sugestao por outro numero livre', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: 69 });
  const numeroInput = findByAttr(root, 'data-pedido-numero')[0];
  numeroInput.value = '1234';
  numeroInput._listeners.input();
  assert.equal(numeroInput.getAttribute('data-pedido-numero-sugerido'), '1',
    'o atributo so e recalculado no proximo render; o estado interno e que muda');

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  assert.equal(calls.pedidoInsert.numero, 1234);
});

// A RPC e admin-only (db/90). Se ela negar, criar Pedido continua possivel: o
// campo fica vazio, o texto explica, e a coluna de identidade aloca.
test('prefill/11. sugestao negada nao bloqueia a criacao e nao reintroduz "Automático"', async () => {
  const { root, calls } = await bootPedidoForm({ proximoNumero: null });
  const ajuda = findByAttr(root, 'data-pedido-numero-ajuda')[0];
  assert.match(ajuda.textContent, /Sugestão indisponível/);
  assert.doesNotMatch(ajuda.textContent, /Automático/);

  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  assert.equal(Object.prototype.hasOwnProperty.call(calls.pedidoInsert, 'numero'), false);
});

test('prefill/12. a superficie de cliente NAO expoe o numero interno nem a RPC', () => {
  const clienteForm = fs.readFileSync(
    path.join(ROOT, 'js', 'screens', 'cliente-pedido-form.js'), 'utf8');
  assert.doesNotMatch(clienteForm, /consultar_proximo_numero_pedido/,
    'a tela de cliente nao pode consultar o numero interno');
  assert.doesNotMatch(clienteForm, /data-pedido-numero/,
    'a tela de cliente nao pode ter o campo de numero');
  assert.doesNotMatch(clienteForm, /RAVATEX_PEDIDO_NUMERO/);
});

test('prefill/13. db/90 cria a RPC admin-only, sem nextval e sem MAX', () => {
  const db90 = readOrFail(path.join(ROOT, 'db', '90_pedido_proximo_numero_suggestion_rpc.sql'));
  assert.match(db90, /CREATE OR REPLACE FUNCTION public\.consultar_proximo_numero_pedido\(\)/);
  assert.match(db90, /RETURNS BIGINT/);
  assert.match(db90, /SECURITY DEFINER/);
  assert.match(db90, /SET search_path = public/);
  assert.match(db90, /IF NOT public\.is_admin\(\) THEN/,
    'a RPC tem de exigir is_admin()');
  assert.match(db90, /REVOKE ALL\s+ON FUNCTION public\.consultar_proximo_numero_pedido\(\) FROM PUBLIC/);
  assert.match(db90, /REVOKE ALL\s+ON FUNCTION public\.consultar_proximo_numero_pedido\(\) FROM anon/);
  assert.match(db90, /GRANT\s+EXECUTE ON FUNCTION public\.consultar_proximo_numero_pedido\(\) TO\s+authenticated/);
  assert.match(db90, /pg_sequence_last_value/, 'a leitura tem de ser de estado da sequencia');
  // O CORPO da funcao — nao os comentarios nem o COMMENT ON, que citam
  // nominalmente o que ela se proibe de fazer — nao pode consumir a sequencia
  // nem derivar de MAX.
  const corpo = (db90.match(/AS \$\$([\s\S]*?)\$\$;/) || [])[1];
  assert.ok(corpo, 'corpo da funcao nao encontrado em db/90');
  const exec = corpo.replace(/--.*$/gm, '');
  assert.doesNotMatch(exec, /nextval/i, 'a consulta NAO pode consumir a sequencia');
  assert.doesNotMatch(exec, /setval/i);
  assert.doesNotMatch(exec, /currval/i);
  assert.doesNotMatch(exec, /max\s*\(/i, 'MAX() nao e autoridade');
});

test('batch2/5+6. Data do pedido nasce hoje, e obrigatoria e vai no payload', async () => {
  const { root, calls } = await bootPedidoForm();
  const dataInput = findByAttr(root, 'data-pedido-data')[0];
  assert.ok(dataInput, 'input de data do pedido ausente');
  const d = new Date();
  const hoje = d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
  assert.equal(dataInput.value, hoje, 'a data deve nascer com o dia LOCAL de hoje');

  dataInput.value = '';
  dataInput._listeners.change();
  await fillOneValidItem(root);
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  assert.equal(calls.pedidoInsert, null, 'sem data do pedido nao pode salvar');

  const dataAgora = findByAttr(root, 'data-pedido-data')[0];
  dataAgora.value = '2026-01-15';
  dataAgora._listeners.change();
  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  assert.equal(calls.pedidoInsert.data_pedido, '2026-01-15');
  assert.equal(Object.prototype.hasOwnProperty.call(calls.pedidoInsert, 'criado_em'), false,
    'criado_em jamais pode ser usado como data comercial');
});

test('batch2/7. a tabela e Img -> Tipo -> Modelo -> Cores -> Largura -> Metragem -> Observacao -> Acoes', async () => {
  const { root } = await bootPedidoForm();
  const header = findByAttr(root, 'data-itens-header')[0];
  assert.ok(header, 'cabecalho da tabela de itens ausente');
  assert.deepEqual(header.children.map((c) => c.textContent),
    ['Img', 'Tipo', 'Modelo', 'Cores', 'Largura', 'Metragem (m)', 'Observacao', 'Acoes']);

  const headerCols = gridTracks(header);
  assert.equal(headerCols.length, 8);
  for (const row of rowsOf(root)) {
    assert.deepEqual(gridTracks(row), headerCols, 'linha e cabecalho devem usar a MESMA grade');
    assert.equal(row.children.length, 8);
  }
  assert.equal(rowsOf(root)[0].children[1].getAttribute('data-item-tipo-select'), '1',
    'a 2a celula e o Tipo, inline');
  assert.equal(rowsOf(root)[0].children[2].getAttribute('data-item-modelo-select'), '1',
    'a 3a celula e o Modelo, imediatamente depois do Tipo');
});

test('batch2/8+9. Tipo e um dropdown INLINE e Modelo comeca desabilitado', async () => {
  const { root } = await bootPedidoForm();
  const row = rowsOf(root)[0];
  const tipo = rowTipo(row);
  const modelo = rowModelo(row);

  assert.equal(tipo.getAttribute('role'), 'combobox',
    'Tipo deve ser um dropdown na propria linha');
  assert.equal(tipo.tagName, 'BUTTON', 'o dropdown canonico e um trigger de botao');
  assert.deepEqual(optionValues(tipo), ['', 'tapete', 'manta']);
  assert.deepEqual(optionTexts(tipo), ['Tipo...', 'Tapete', 'Manta']);
  assert.equal(tipo.value, '', 'Tipo nasce vazio');

  assert.equal(modelo.hasAttribute('disabled'), true, 'Modelo deve nascer desabilitado');
  assert.equal(modelo.disabled, true);
  // Pass-7: o controle desabilitado NAO abre, entao "sem Tipo nao ha modelo
  // listado" fica mais forte do que na versao nativa — antes o placeholder
  // ainda existia como <option>; agora nenhuma opcao e alcancavel.
  assert.equal(modelo.value, '', 'sem Tipo o Modelo nasce vazio');
  assert.equal(modelo.textContent, 'Modelo...', 'sem Tipo o Modelo mostra so o placeholder');
  assert.deepEqual(optionValues(modelo), [], 'sem Tipo nao ha modelo listado');

  pick(tipo, 'tapete');
  assert.equal(rowModelo(rowsOf(root)[0]).hasAttribute('disabled'), false,
    'escolher Tipo habilita Modelo');
});

test('batch2/10+11. Tapete lista so tapete e Manta lista so manta', async () => {
  const { root } = await bootPedidoForm();
  const row = rowsOf(root)[0];

  pick(rowTipo(row), 'tapete');
  let vals = optionValues(rowModelo(row)).filter(Boolean);
  assert.deepEqual(vals.slice().sort(), ['1', '3'], 'Tapete = Paris + Manta Legado');
  assert.doesNotMatch(optionTexts(rowModelo(row)).join('|'), /Manta Barcelona/);

  pick(rowTipo(row), 'manta');
  vals = optionValues(rowModelo(row)).filter(Boolean);
  assert.deepEqual(vals, ['2'], 'Manta = apenas Manta Barcelona');
  assert.doesNotMatch(optionTexts(rowModelo(row)).join('|'), /Paris|Manta Legado/);
});

test('batch2/12. trocar o Tipo limpa Modelo e TODO derivado incompativel', async () => {
  const { root } = await bootPedidoForm();
  const row = rowsOf(root)[0];

  pick(rowTipo(row), 'tapete');
  pick(rowModelo(row), '1');
  assert.equal(rowModelo(row).value, '1');
  assert.equal(findByAttr(row, 'data-item-cores')[0].textContent, 'KRAFT / CRU');
  assert.equal(findByAttr(row, 'data-item-largura')[0].textContent, '1,40 m');
  assert.equal(findByAttr(row, 'data-preview-slot')[0].children.length, 1);

  pick(rowTipo(row), 'manta');
  assert.equal(rowModelo(row).value, '', 'Paris nao pertence a Manta: a selecao e limpa');
  assert.equal(findByAttr(row, 'data-item-cores')[0].textContent, '-', 'cores limpas');
  assert.equal(findByAttr(row, 'data-item-largura')[0].textContent, '-', 'largura limpa');
  assert.deepEqual(optionValues(rowModelo(row)).filter(Boolean), ['2']);
});

test('batch2/13+14. nem o NOME nem a LARGURA podem influenciar a rota', async () => {
  const { root } = await bootPedidoForm();
  const row = rowsOf(root)[0];

  pick(rowTipo(row), 'tapete');
  assert.ok(optionTexts(rowModelo(row)).some((t) => /Manta Legado/.test(t)),
    'um tapete NOMEADO "Manta" continua sob Tapete — o filtro e por tipo_produto');
  pick(rowModelo(row), '3');
  assert.equal(findByAttr(row, 'data-item-largura')[0].textContent, '1,40 m',
    'mesma largura da Manta real, e ainda assim Tapete');

  pick(rowTipo(row), 'manta');
  assert.equal(rowModelo(row).value, '', 'Manta Legado nao sobrevive a rota Manta');
  assert.doesNotMatch(optionTexts(rowModelo(row)).join('|'), /Manta Legado/);
});

test('batch2/15. modelo_id e a UNICA identidade de produto persistida', async () => {
  const { root, calls } = await bootPedidoForm();
  // Pass-7: Cliente is a canonical select popover, located by its
  // accessible name rather than by a native tag.
  const cliente = findByAttr(root, 'aria-label', 'Cliente')[0];
  cliente.value = '501';
  cliente._listeners.change();
  const row = rowsOf(root)[0];
  pick(rowTipo(row), 'manta');
  pick(rowModelo(row), '2');
  setRowMetragem(row, '25');

  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();

  assert.ok(Array.isArray(calls.pedidoItensInsert));
  for (const linha of calls.pedidoItensInsert) {
    assert.deepEqual(Object.keys(linha).sort(),
      ['metros', 'modelo_id', 'observacao', 'ordem', 'pedido_id'],
      'pedido_itens nao pode ganhar campo algum');
    for (const proibido of ['tipo_produto', 'tipo', 'rota', 'cor', 'largura']) {
      assert.equal(Object.prototype.hasOwnProperty.call(linha, proibido), false,
        'o Tipo NAO pode ser persistido de forma redundante: ' + proibido);
    }
  }
  assert.equal(calls.pedidoItensInsert[0].modelo_id, 2);
});

test('batch2/16. nenhum editor de item completo sobrevive dentro de um modal', () => {
  assert.doesNotMatch(screen, /function\s+openItemModal\s*\(/,
    'o modal de item nao pode sobreviver em pedido-form.js');
  assert.doesNotMatch(screen, /function\s+openAddItemModal\s*\(/);
  assert.doesNotMatch(screen, /position:fixed; inset:0/,
    'nenhum overlay de modal de item pode restar');
  assert.doesNotMatch(screen, /Salvar altera/,
    'a acao primaria do modal de item sumiu junto com ele');
  assert.match(screen, /state\.itens\.push\(\{[\s\S]{0,200}?uid: novoUid\(\)/,
    '"Adicionar item" deve acrescentar uma linha editavel');
  assert.match(rowEditor, /function\s+buildRow\s*\(options\)/);
  assert.doesNotMatch(screen, /function\s+buildItemRow\s*\(/,
    'pedido-form.js nao pode manter uma segunda implementacao de linha');
});

test('batch2/17. carregar tipo_produto FALHA FECHADA: nada de degradar para Tapete', async () => {
  const { root } = await bootPedidoForm({ failTipoProduto: true });
  assert.match(root.textContent, /Erro ao carregar dados de tipo de produto dos modelos/,
    'a falha de tipo_produto deve ser reportada, nao silenciada');
  assert.equal(rowsOf(root).length, 0, 'nenhuma linha de item editavel sem metadado de tipo');
  assert.match(rowEditor, /FALHA FECHADA/);
});

test('batch2/18. um modelo sem tipo_produto nao entra em NENHUMA das duas listas', async () => {
  const { sandbox } = await bootPedidoForm();
  const api = sandbox.window.RAVATEX_PEDIDO_ITEM_ROW;
  const semTipo = { id: 99, nome: 'Sem Tipo', largura: 1.4 };
  const lista = [semTipo, { id: 1, tipo_produto: 'tapete' }, { id: 2, tipo_produto: 'manta' }];
  assert.equal(api.rotaDoModelo(semTipo), null, 'sem tipo_produto a rota e null, nunca tapete');
  assert.deepEqual(api.modelosPorTipo(lista, 'tapete').map((m) => m.id), [1]);
  assert.deepEqual(api.modelosPorTipo(lista, 'manta').map((m) => m.id), [2]);
  assert.equal(api.tipoLabel(null), '-');
});

test('batch2/19. index.html carrega o modulo da linha antes de pedido-form.js', () => {
  const iRoute = index.indexOf('js/product-route.js');
  const iRow = index.indexOf('js/screens/pedido-item-row-editor.js');
  const iForm = index.indexOf('js/screens/pedido-form.js');
  const iBoot = index.indexOf('js/boot.js');
  assert.ok(iRow > 0, 'pedido-item-row-editor.js deve ser carregado');
  assert.equal((index.match(/js\/screens\/pedido-item-row-editor\.js/g) || []).length, 1,
    'o modulo deve ser carregado exatamente uma vez');
  assert.ok(iRoute < iRow, 'o modulo depende de product-route.js');
  assert.ok(iRow < iForm, 'o modulo deve vir antes de pedido-form.js');
  assert.ok(iForm < iBoot);
  // A passada 7 (select nativo -> popover canonico) retokenizou o modulo pela
  // ultima vez; a prova de ordem/carga unica acima e o sujeito deste guard, e
  // o token segue sendo verificado literalmente.
  // PEDIDO-SCREEN-GROUP-1 passou a acao destrutiva da linha para o dono
  // canonico actionButton(), entao o modulo carrega o token dessa ordem.
  assert.match(index, /pedido-item-row-editor\.js\?v=20260727-ui-pedido-screen-group-1/);
});

// O sujeito deste guard e a EXTRACAO de BATCH-02: a tela encolheu de 1089 para
// ~708 linhas e o debito estrutural de BATCH-01 foi quitado. Medir contra um
// HEAD movel converteria o guard em "nenhuma ordem futura pode acrescentar uma
// linha a esta tela", que nao e o que BATCH-02 provou nem o que
// CODE_HEALTH_RULES.md sec.7 exige. A medida passa a ser o teto declarado da
// faixa excepcional (900), com a extracao provada pelo tamanho dos modulos
// filhos e pela ausencia do marcador de debito.
test('batch2/20. a extracao de BATCH-02 se mantem e o debito estrutural segue quitado', () => {
  const now = screen.split('\n').length;
  assert.ok(now <= 900,
    `pedido-form.js deve permanecer na faixa excepcional de code-health (<=900; atual ${now})`);
  assert.ok(now < 1089,
    `a extracao de BATCH-02 nao pode ser desfeita (pre-extracao 1089; atual ${now})`);
  assert.ok(rowEditor.split('\n').length <= 500,
    'o modulo da linha de item deve respeitar o limite normal de code-health');
  assert.ok(fs.readFileSync(NUMSUG, 'utf8').split('\n').length <= 500,
    'o modulo de sugestao de numero deve respeitar o limite normal de code-health');
  assert.doesNotMatch(screen, /DEBITO ESTRUTURAL NAO BLOQUEANTE/,
    'o debito estrutural de BATCH-01 foi quitado pela extracao');
});
