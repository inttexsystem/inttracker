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

function optionTexts(selectNode) {
  return (selectNode.children || []).filter((c) => c.tagName === 'OPTION').map((c) => c.textContent);
}

function optionValues(selectNode) {
  return (selectNode.children || []).filter((c) => c.tagName === 'OPTION').map((c) => c.getAttribute('value'));
}

function makePedidoFormRuntime() {
  const calls = { pedidoInsert: null, pedidoItensInsert: null, pedidoDelete: 0, selects: [] };
  const failItensInsert = arguments.length && arguments[0] && arguments[0].failItensInsert;
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
        if (table === 'pedidos') calls.pedidoInsert = value;
        if (table === 'pedido_itens') calls.pedidoItensInsert = value;
        return api;
      },
      delete() { mutation = 'delete'; if (table === 'pedidos') calls.pedidoDelete += 1; return api; },
      single() {
        if (table === 'pedidos' && mutation === 'insert') {
          return Promise.resolve({ data: { id: 'ped-1', numero: 7, status: 'rascunho' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        let result;
        if (table === 'pedido_itens' && mutation === 'insert') {
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
  sandbox.supa = { from: (table) => chain(table) };
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
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });
  // The REAL route helpers, in their index.html order (op-display owns
  // deriveProductType; product-route delegates to it). Loading them means the
  // Tipo proofs exercise the accepted derivation, not a suite-local copy.
  vm.runInContext(opDispSrc, sandbox, { filename: 'js/op-display.js' });
  vm.runInContext(pRouteSrc, sandbox, { filename: 'js/product-route.js' });
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
      modeloId: allByTag(row, 'select')[0].value,
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
  assert.match(screen, /window\.corPreviewElement/);
});

test('pedido-form: usa helpers de pedido-ui (status)', () => {
  // Se o form usa badge de status (não estritamente necessário no form
  // de criação, mas é um sinal de que consome o helper).
  const usaHelper = /window\.RAVATEX_PEDIDO_UI|window\.pedidoStatus|window\.corPreview/i.test(screen);
  assert.ok(usaHelper, 'form deve consumir helpers de js/pedido-ui.js');
});

// C2-R1: correção do preview — slot fixo + updatePreview(), sem insertBefore

test('pedido-form: NÃO usa row.insertBefore(previewSlot, metrosInput) (bug C2 corrigido)', () => {
  // O bug original usava row.insertBefore(previewSlot, metrosInput)
  // mas metrosInput está em wrapper, não é filho direto de row.
  assert.doesNotMatch(
    screen,
    /row\.insertBefore\s*\(\s*previewSlot\s*,\s*metrosInput\s*\)/,
    "não deve usar row.insertBefore(previewSlot, metrosInput) — bug C2"
  );
});

test('pedido-form: NÃO usa insertBefore genérico para o preview (slot fixo)', () => {
  // Garantia mais ampla: nenhum insertBefore envolvendo o previewSlot
  // e metrosInput (em qualquer ordem).
  assert.doesNotMatch(
    screen,
    /insertBefore\s*\(\s*previewSlot/,
    "previewSlot não deve ser alvo de insertBefore (deve ser slot fixo)"
  );
});

test('pedido-form: usa slot fixo de preview (data-preview-slot)', () => {
  // Slot fixo deve ser criado UMA vez e permanecer no row.
  assert.match(
    screen,
    /window\.el\(\s*['"]div['"]\s*,\s*\{\s*['"]data-preview-slot['"]\s*:\s*['"]1['"]/,
    "deve criar slot fixo com atributo data-preview-slot"
  );
});

test('pedido-form: usa updatePreview() para atualizar o slot de preview', () => {
  // Função updatePreview() deve ser definida e usada.
  assert.match(
    screen,
    /function\s+updatePreview\s*\(\s*\)\s*\{/,
    "deve definir função updatePreview()"
  );
  // updatePreview deve usar replaceChildren para limpar.
  assert.match(
    screen,
    /updatePreview\s*\(\s*\)\s*\{[\s\S]*?replaceChildren\s*\(/,
    "updatePreview deve usar replaceChildren para limpar o slot"
  );
  // updatePreview deve ser chamado no change do modelo.
  assert.match(
    screen,
    /addEventListener\(\s*['"]change['"][\s\S]*?updatePreview\s*\(\s*\)/,
    "updatePreview deve ser chamado no change do select de modelo"
  );
  // updatePreview deve ser chamado na inicialização (modelo pré-selecionado).
  const updateCount = (screen.match(/updatePreview\s*\(\s*\)/g) || []).length;
  assert.ok(updateCount >= 2,
    'updatePreview deve ser chamado ao menos 2x (init + change); encontrado: ' + updateCount);
});

test('pedido-form: previewSlot é filho direto de row (appendChild, não insertBefore)', () => {
  // Slot fixo deve ser anexado com appendChild (não insertBefore).
  assert.match(
    screen,
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
  // Ancora reapontada pelo lote 1: openAddItemModal virou openItemModal
  // (dono unico do modal nos modos add/edit). A assercao segue identica.
  const buildItemRow = (screen.match(/function\s+buildItemRow\s*\(item\)\s*\{[\s\S]*?\n    function openItemModal/) || [''])[0];
  assert.ok(buildItemRow, 'trecho buildItemRow nao encontrado');
  const inputHandler = (buildItemRow.match(/metrosInput\.addEventListener\(\s*['"]input['"]\s*,\s*function\s*\(\)\s*\{[\s\S]*?\n      \}\);/) || [''])[0];
  assert.ok(inputHandler, 'handler input de metros nao encontrado');
  assert.match(inputHandler, /item\.metros\s*=\s*metrosInput\.value/);
  assert.match(inputHandler, /updateItensSummary\s*\(\s*\)/,
    'handler deve atualizar totais/resumo localmente');
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

  const selects = allByTag(root, 'select');
  assert.ok(selects.length >= 3, 'selects de cliente/status/modelo nao renderizados');
  selects[0].value = '501';
  selects[0]._listeners.change();
  selects[2].value = '1';
  selects[2]._listeners.change();

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
// 17. KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-01-R1
//
// Bounded operational defect batch on `#/pedidos/novo`:
//   (1) Tipo column in the item table;
//   (2) Tipo selector in the item modal, filtering the model list;
//   (3) model options rendered as "<MODELO> – <COR1>/<COR2>";
//   (4) the row pencil activated, editing the UNSAVED local item through
//       the same modal.
//
// Every proof below is BEHAVIOURAL (boot the screen, drive real controls)
// except where a source-level invariant is the actual subject. The fixture
// deliberately contains a Tapete model NAMED "Manta Legado" carrying the
// same 1,40 m width as the real Manta, so a name-based or width-based
// derivation cannot pass these tests.
// =====================================================================

test('batch1/1. o tipo do modelo e carregado por augmentacao dedicada (a query base NAO traz tipo_produto)', async () => {
  const { calls, root } = await bootPedidoForm();
  const modelosSelects = calls.selects.filter((c) => c.table === 'modelos');
  assert.equal(modelosSelects.length, 2,
    'deve haver a query base de modelos MAIS a augmentacao de tipo_produto');
  assert.doesNotMatch(String(modelosSelects[0].cols), /tipo_produto/,
    'a query base de modelos nao seleciona tipo_produto');
  assert.match(String(modelosSelects[1].cols), /^\s*id,\s*tipo_produto\s*$/,
    'a augmentacao seleciona exatamente `id, tipo_produto`');
  // E o dado realmente chega a tela: sem a augmentacao a celula seria Tapete.
  const row = findByAttr(root, 'data-uid')[0];
  const sel = allByTag(row, 'select')[0];
  sel.value = '2';
  sel._listeners.change();
  assert.equal(findByAttr(row, 'data-item-tipo')[0].textContent, 'Manta',
    'o tipo exibido so pode vir da augmentacao de modelos.tipo_produto');
});

test('batch1/1b. a augmentacao de tipo_produto e best-effort: falhar nao derruba a tela', async () => {
  // Reproduz um ambiente onde a coluna ainda nao e legivel: a query rejeita.
  const rt = makePedidoFormRuntime();
  const realFrom = rt.sandbox.supa.from;
  rt.sandbox.supa.from = (table) => {
    const chain = realFrom(table);
    if (table !== 'modelos') return chain;
    const select = chain.select;
    chain.select = (cols) => {
      const out = select(cols);
      if (!/tipo_produto/.test(String(cols))) return out;
      return {
        then: (res, rej) => Promise.reject(
          new Error('column modelos.tipo_produto does not exist')
        ).then(res, rej),
      };
    };
    return chain;
  };
  const root = await vm.runInContext('window.screenPedidoNovo()', rt.sandbox);
  await flushRuntime();
  await flushRuntime();

  assert.ok(findByAttr(root, 'data-uid').length >= 1,
    'a tela de Pedido deve continuar renderizando mesmo sem tipo_produto');
  const row = findByAttr(root, 'data-uid')[0];
  const sel = allByTag(row, 'select')[0];
  sel.value = '2';
  sel._listeners.change();
  assert.equal(findByAttr(row, 'data-item-tipo')[0].textContent, 'Tapete',
    'modelo legado sem tipo_produto resolve para Tapete (o default do banco)');
});

test('batch1/2. o Tipo vem de modelos.tipo_produto, nunca do nome do modelo nem da largura', async () => {
  const { root } = await bootPedidoForm();
  const row = findByAttr(root, 'data-uid')[0];
  const sel = allByTag(row, 'select')[0];
  const tipoCell = findByAttr(row, 'data-item-tipo')[0];

  assert.equal(tipoCell.textContent, '-', 'linha sem modelo nao exibe um tipo fabricado');
  sel.value = '1';
  sel._listeners.change();
  assert.equal(tipoCell.textContent, 'Tapete', 'Paris e Tapete');
  sel.value = '2';
  sel._listeners.change();
  assert.equal(tipoCell.textContent, 'Manta', 'Manta Barcelona e Manta');
  // Prova negativa: o nome comeca com "Manta" e a largura e a MESMA da Manta,
  // mas tipo_produto e 'tapete'. Inferir do nome ou da largura falha aqui.
  sel.value = '3';
  sel._listeners.change();
  assert.equal(tipoCell.textContent, 'Tapete',
    'derivar o tipo do NOME do modelo ou da LARGURA produziria "Manta" e falharia');
});

test('batch1/3. a tabela tem a coluna Tipo ENTRE Largura e Metragem', async () => {
  const { root } = await bootPedidoForm();
  const header = itensHeader(root);
  assert.ok(header, 'cabecalho da tabela de itens nao encontrado');
  const labels = header.children.map((c) => c.textContent);
  assert.deepEqual(labels,
    ['Img', 'Modelo', 'Cores', 'Largura', 'Tipo', 'Metragem (m)', 'Observacao', 'Acoes'],
    'ordem de colunas exigida pelo lote 1');
  assert.equal(labels.indexOf('Tipo'), labels.indexOf('Largura') + 1);
  assert.equal(labels.indexOf('Tipo'), labels.indexOf('Metragem (m)') - 1);
});

test('batch1/4. cabecalho e TODA linha de dado compartilham a mesma grade de 8 colunas', async () => {
  const { root } = await bootPedidoForm();
  const header = itensHeader(root);
  const headerCols = gridTracks(header);
  assert.ok(headerCols, 'grid-template-columns do cabecalho nao encontrado');
  assert.equal(headerCols.length, 8, 'a tabela tem exatamente 8 colunas');

  const rows = findByAttr(root, 'data-uid');
  assert.ok(rows.length >= 1, 'nenhuma linha de item renderizada');
  for (const row of rows) {
    assert.deepEqual(gridTracks(row), headerCols,
      'a linha de dado deve usar exatamente a mesma definicao de colunas do cabecalho');
    assert.equal(row.children.length, 8, 'a linha deve ter 8 celulas, uma por coluna');
  }
  assert.equal(rows[0].children[4].getAttribute('data-item-tipo'), '1',
    'a 5a celula da linha e a celula de Tipo, alinhada ao cabecalho');
});

test('batch1/5. a largura antiga de Metragem (1.1fr) foi DIVIDIDA em .55fr + .55fr', () => {
  const { execFileSync } = require('node:child_process');
  const before = execFileSync('git', ['show', 'HEAD:js/screens/pedido-form.js'], { cwd: ROOT, encoding: 'utf8' });
  const beforeCols = (before.match(/grid-template-columns:(60px[^;']+)/) || [])[1].trim().split(/\s+/);
  const afterCols = (screen.match(/ITENS_GRID_COLS\s*=\s*'([^']+)'/) || [])[1].trim().split(/\s+/);

  assert.equal(beforeCols.length, 7, 'a tabela anterior tinha 7 colunas');
  assert.equal(afterCols.length, 8, 'a tabela atual tem 8 colunas');
  assert.equal(beforeCols[4], '1.1fr', 'a coluna Metragem anterior valia 1.1fr');
  assert.equal(afterCols[4], '.55fr', 'Tipo recebe .55fr');
  assert.equal(afterCols[5], '.55fr', 'Metragem passa a .55fr');
  assert.equal(
    Number(afterCols[4].replace('fr', '')) + Number(afterCols[5].replace('fr', '')),
    Number(beforeCols[4].replace('fr', '')),
    'Tipo + Metragem devem somar exatamente a largura anterior de Metragem'
  );
  assert.deepEqual(afterCols.slice(0, 4), beforeCols.slice(0, 4), 'colunas a esquerda inalteradas');
  assert.deepEqual(afterCols.slice(6), beforeCols.slice(5), 'colunas a direita inalteradas');
  assert.equal(afterCols.join(' '), '60px 1.1fr 1.1fr .8fr .55fr .55fr 1.2fr 84px');
});

test('batch1/7. o modal Adicionar item tem o dropdown Tipo obrigatorio, antes de Modelo', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  assert.ok(modal, 'modal de item nao abriu');

  const tipo = modalTipoSelect(modal);
  assert.ok(tipo, 'dropdown de Tipo ausente no modal');
  assert.deepEqual(optionValues(tipo), ['', 'tapete', 'manta']);
  assert.deepEqual(optionTexts(tipo), ['Selecione o tipo...', 'Tapete', 'Manta']);

  const order = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c.getAttribute && c.getAttribute('data-item-modal-tipo')) order.push('tipo');
      if (c.getAttribute && c.getAttribute('data-item-modal-modelo')) order.push('modelo');
      if (c.children) walk(c);
    }
  })(modal);
  assert.deepEqual(order, ['tipo', 'modelo'], 'Tipo deve preceder Modelo');

  const labelTipo = allByTag(modal, 'label').find((l) => /^Tipo\s/.test(l.textContent));
  assert.ok(labelTipo, 'rotulo "Tipo" nao encontrado');
  assert.match(labelTipo.textContent, /\*/, 'Tipo deve ser marcado como obrigatorio');
});

test('batch1/8. o dropdown de Modelo comeca DESABILITADO enquanto nao ha Tipo', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  const modelo = modalModeloSelect(modal);

  assert.equal(modelo.hasAttribute('disabled'), true, 'Modelo deve nascer desabilitado');
  assert.equal(modelo.disabled, true, 'a propriedade refletida deve ser true');
  assert.deepEqual(optionValues(modelo), [''], 'sem Tipo nao ha modelo algum listado');

  pickTipo(modal, 'tapete');
  assert.equal(modalModeloSelect(modal).hasAttribute('disabled'), false,
    'escolher o Tipo habilita o Modelo');
  assert.equal(modalModeloSelect(modal).disabled, false);
});

test('batch1/9. Tipo=Tapete lista somente modelos tapete (exclui a Manta)', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  pickTipo(modal, 'tapete');

  const values = optionValues(modalModeloSelect(modal)).filter(Boolean);
  assert.deepEqual(values.slice().sort(), ['1', '3'], 'apenas Paris e Manta Legado (ambos tapete)');
  const texts = optionTexts(modalModeloSelect(modal)).join(' | ');
  assert.doesNotMatch(texts, /Manta Barcelona/, 'o modelo Manta nao pode aparecer sob Tapete');
  assert.match(texts, /Manta Legado/,
    'um tapete NOMEADO "Manta" deve continuar listado — o filtro e por tipo_produto, nao por nome');
});

test('batch1/10. Tipo=Manta lista somente modelos manta (exclui os tapetes)', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  pickTipo(modal, 'manta');

  const values = optionValues(modalModeloSelect(modal)).filter(Boolean);
  assert.deepEqual(values, ['2'], 'apenas Manta Barcelona');
  const texts = optionTexts(modalModeloSelect(modal)).join(' | ');
  assert.doesNotMatch(texts, /Paris/, 'Paris e tapete e nao pode aparecer sob Manta');
  assert.doesNotMatch(texts, /Manta Legado/,
    'Manta Legado e tapete: o nome nao pode coloca-lo na rota Manta');
});

test('batch1/11. a opcao do modal exibe "<MODELO> – <COR1>/<COR2>"', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);

  pickTipo(modal, 'tapete');
  assert.ok(optionTexts(modalModeloSelect(modal)).includes('Paris – KRAFT/CRU'),
    'esperado exatamente "Paris – KRAFT/CRU"');

  pickTipo(modal, 'manta');
  assert.ok(optionTexts(modalModeloSelect(modal)).includes('Manta Barcelona – PRETO/CRU'),
    'esperado exatamente "Manta Barcelona – PRETO/CRU"');
});

test('batch1/11b. o formatador da opcao de modelo e UNICO (nao duplicado em varios lacos)', () => {
  assert.match(screen, /function\s+modeloOptionLabel\s*\(/,
    'deve existir um formatador reutilizavel modeloOptionLabel()');
  const composicoes = (screen.match(/corNome\([^)]*cor_1\)\s*\+\s*'\/'/g) || []).length;
  assert.equal(composicoes, 1,
    'a composicao "COR1/COR2" pode aparecer uma unica vez, dentro do formatador');
});

test('batch1/12. trocar o Tipo limpa o modelo que deixou de pertencer a rota', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);

  pickTipo(modal, 'tapete');
  pickModelo(modal, '1');
  assert.equal(modalModeloSelect(modal).value, '1');
  assert.equal(findByAttr(modal, 'data-item-modal-cor1')[0].textContent, 'KRAFT');
  assert.equal(findByAttr(modal, 'data-item-modal-cor2')[0].textContent, 'CRU');
  assert.equal(findByAttr(modal, 'data-item-modal-largura')[0].textContent, '1,40 m');

  pickTipo(modal, 'manta');
  assert.equal(modalModeloSelect(modal).value, '',
    'Paris nao pertence a rota Manta: a selecao deve ser limpa');
  assert.deepEqual(optionValues(modalModeloSelect(modal)).filter(Boolean), ['2']);
  assert.equal(findByAttr(modal, 'data-item-modal-cor1')[0].textContent, '-');
  assert.equal(findByAttr(modal, 'data-item-modal-cor2')[0].textContent, '-');
  assert.equal(findByAttr(modal, 'data-item-modal-largura')[0].textContent, '-');
  assert.ok(findByAttr(modal, 'data-item-modal-preview')[0], 'slot de preview ausente');
});

test('batch1/12b. confirmar sem Tipo ou sem Modelo e rejeitado (nenhum item e criado)', async () => {
  const { root, document } = await bootPedidoForm();
  const before = snapshotItens(root).length;

  const modal = openAddModal(root, document);
  setModalMetragem(modal, '10');
  confirmModal(modal, /^Adicionar item$/);
  assert.equal(currentModal(document), modal, 'o modal nao pode fechar sem Tipo');
  assert.equal(snapshotItens(root).length, before, 'nenhum item pode ser adicionado sem Tipo');

  pickTipo(modal, 'tapete');
  confirmModal(modal, /^Adicionar item$/);
  assert.equal(currentModal(document), modal, 'o modal nao pode fechar sem Modelo');
  assert.equal(snapshotItens(root).length, before, 'nenhum item pode ser adicionado sem Modelo');

  pickModelo(modal, '1');
  setModalMetragem(modal, '0');
  confirmModal(modal, /^Adicionar item$/);
  assert.equal(snapshotItens(root).length, before, 'metragem <= 0 continua rejeitada');
});

test('batch1/13. o icone de edicao esta ATIVO e clicavel', async () => {
  const { root } = await bootPedidoForm();
  const icon = editIconOf(root, 0);
  assert.ok(icon, 'icone de edicao nao encontrado na linha');
  assert.match(icon.style.cssText, /cursor:pointer/, 'cursor deve ser pointer');
  assert.match(icon.style.cssText, /opacity:1/, 'opacidade deve ser 1');
  assert.doesNotMatch(icon.style.cssText, /cursor:default/);
  assert.equal(icon.getAttribute('title'), 'Editar item');
  assert.equal(typeof icon._listeners.click, 'function', 'o icone deve ter acao de clique');
  assert.doesNotMatch(screen, /em breve/i, 'o placeholder "em breve" deve ter sumido');
});

test('batch1/14. o modal de edicao abre PREENCHIDO a partir do item correto', async () => {
  const { root, document } = await bootPedidoForm();

  let modal = openAddModal(root, document);
  pickTipo(modal, 'manta');
  pickModelo(modal, '2');
  setModalMetragem(modal, '33');
  setModalObservacao(modal, 'segunda entrada');
  confirmModal(modal, /^Adicionar item$/);

  assert.equal(snapshotItens(root).length, 2, 'devem existir 2 itens locais');

  modal = openEditModal(root, document, 1);
  assert.ok(modal, 'modal de edicao nao abriu');
  assert.equal(findByAttr(modal, 'data-item-modal-title')[0].textContent, 'Editar item');
  assert.ok(findButton(modal, /^Salvar alterações$/), 'acao primaria deve ser "Salvar alterações"');
  assert.equal(findButton(modal, /^Adicionar item$/), undefined,
    'em modo de edicao nao existe acao "Adicionar item"');

  assert.equal(modalTipoSelect(modal).value, 'manta', 'Tipo prefilled');
  assert.equal(modalModeloSelect(modal).value, '2', 'Modelo prefilled');
  assert.equal(modalModeloSelect(modal).hasAttribute('disabled'), false, 'Modelo habilitado em edicao');
  assert.equal(findByAttr(modal, 'data-item-modal-cor1')[0].textContent, 'PRETO');
  assert.equal(findByAttr(modal, 'data-item-modal-cor2')[0].textContent, 'CRU');
  assert.equal(findByAttr(modal, 'data-item-modal-largura')[0].textContent, '1,40 m');
  assert.equal(allByTag(modal, 'input').find((i) => i.getAttribute('placeholder') === '0,00').value, '33');
  assert.equal(allByTag(modal, 'textarea')[0].value, 'segunda entrada');
  assert.ok(findByAttr(modal, 'data-item-modal-preview')[0], 'preview prefilled');
});

test('batch1/15+16. salvar a edicao altera EXATAMENTE um item local, sem duplicar nem reordenar', async () => {
  const { root, document } = await bootPedidoForm();

  let modal = openAddModal(root, document);
  pickTipo(modal, 'manta');
  pickModelo(modal, '2');
  setModalMetragem(modal, '33');
  confirmModal(modal, /^Adicionar item$/);

  modal = openAddModal(root, document);
  pickTipo(modal, 'tapete');
  pickModelo(modal, '3');
  setModalMetragem(modal, '44');
  confirmModal(modal, /^Adicionar item$/);

  const before = snapshotItens(root);
  assert.equal(before.length, 3);

  // Edita o item DO MEIO — o caso em que um remove+append apareceria.
  modal = openEditModal(root, document, 1);
  pickTipo(modal, 'tapete');
  pickModelo(modal, '1');
  setModalMetragem(modal, '77');
  setModalObservacao(modal, 'editado');
  confirmModal(modal, /^Salvar alterações$/);

  const after = snapshotItens(root);
  assert.equal(after.length, before.length, 'a edicao nao pode criar nem remover item');
  assert.deepEqual(after.map((i) => i.uid), before.map((i) => i.uid),
    'os uid devem ser preservados NA MESMA ORDEM (sem remove+append)');
  assert.deepEqual(after[0], before[0], 'o item anterior fica intacto');
  assert.deepEqual(after[2], before[2], 'o item posterior fica intacto');
  assert.deepEqual(
    { modeloId: after[1].modeloId, tipo: after[1].tipo, metros: after[1].metros, observacao: after[1].observacao },
    { modeloId: '1', tipo: 'Tapete', metros: '77', observacao: 'editado' },
    'exatamente o item editado mudou, inclusive a celula de Tipo'
  );
});

test('batch1/15b. confirmar a edicao NAO escreve no Supabase', async () => {
  const { root, document, calls } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  pickTipo(modal, 'tapete');
  pickModelo(modal, '1');
  setModalMetragem(modal, '5');
  confirmModal(modal, /^Adicionar item$/);

  const edit = openEditModal(root, document, 1);
  setModalMetragem(edit, '6');
  confirmModal(edit, /^Salvar alterações$/);

  assert.equal(calls.pedidoInsert, null, 'nenhum INSERT em pedidos');
  assert.equal(calls.pedidoItensInsert, null, 'nenhum INSERT em pedido_itens');
  assert.equal(calls.pedidoDelete, 0, 'nenhum DELETE');
});

test('batch1/17. edicao cancelada por Cancelar / X / Escape / overlay deixa o item INTACTO', async () => {
  const { root, document } = await bootPedidoForm();
  const modal = openAddModal(root, document);
  pickTipo(modal, 'manta');
  pickModelo(modal, '2');
  setModalMetragem(modal, '12');
  setModalObservacao(modal, 'original');
  confirmModal(modal, /^Adicionar item$/);

  const pristine = JSON.stringify(snapshotItens(root));

  function editAndAbort(abort) {
    const m = openEditModal(root, document, 1);
    pickTipo(m, 'tapete');
    pickModelo(m, '1');
    setModalMetragem(m, '999');
    setModalObservacao(m, 'lixo descartado');
    abort(m);
    assert.equal(JSON.stringify(snapshotItens(root)), pristine,
      'o item local deve permanecer byte-equivalente apos o cancelamento');
  }

  editAndAbort((m) => findButton(m, /^Cancelar$/)._listeners.click());
  // X: o unico botao do cabecalho sem texto.
  editAndAbort((m) => allByTag(m, 'button').find((b) => b.textContent === '')._listeners.click());
  editAndAbort(() => (document._listeners.keydown || []).slice().forEach((fn) => fn({ key: 'Escape' })));
  editAndAbort((m) => m._listeners.click({ target: m }));

  assert.equal(currentModal(document), null, 'todo modal abortado deve ter sido fechado');
});

test('batch1/18. o payload de pedido_itens permanece semanticamente inalterado', async () => {
  const { root, document, calls, sandbox } = await bootPedidoForm();

  const selects = allByTag(root, 'select');
  selects[0].value = '501';
  selects[0]._listeners.change();

  const modal = openAddModal(root, document);
  pickTipo(modal, 'manta');
  pickModelo(modal, '2');
  setModalMetragem(modal, '25');
  confirmModal(modal, /^Adicionar item$/);

  // Remove a linha inicial vazia, deixando apenas o item valido.
  removeRow(root, 0);

  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();

  assert.ok(Array.isArray(calls.pedidoItensInsert), 'INSERT em pedido_itens nao ocorreu');
  for (const linha of calls.pedidoItensInsert) {
    assert.deepEqual(Object.keys(linha).sort(),
      ['metros', 'modelo_id', 'observacao', 'ordem', 'pedido_id'],
      'o payload de pedido_itens nao pode ganhar campo algum');
    for (const proibido of ['tipo_produto', 'tipo', 'rota', 'cor', 'cor_1_id', 'cor_2_id', 'largura']) {
      assert.equal(Object.prototype.hasOwnProperty.call(linha, proibido), false,
        'o payload nao pode carregar `' + proibido + '`: o tipo permanece derivado de modelos.tipo_produto');
    }
  }
  assert.equal(calls.pedidoItensInsert[0].modelo_id, 2);
  assert.equal(calls.pedidoItensInsert[0].metros, 25);
  assert.ok(sandbox.window.RAVATEX_PRODUCT_ROUTE, 'o helper de rota permanece o dono do fato');
});

test('batch1/19. a criacao de Pedido e a compensacao continuam inalteradas', async () => {
  const { root, document, calls } = await bootPedidoForm({ failItensInsert: true });

  const selects = allByTag(root, 'select');
  selects[0].value = '501';
  selects[0]._listeners.change();

  const modal = openAddModal(root, document);
  pickTipo(modal, 'tapete');
  pickModelo(modal, '1');
  setModalMetragem(modal, '9');
  confirmModal(modal, /^Adicionar item$/);

  removeRow(root, 0);

  findButton(root, /^Salvar rascunho$/)._listeners.click();
  await flushRuntime();
  await flushRuntime();
  await flushRuntime();

  assert.ok(calls.pedidoInsert, 'o INSERT em pedidos deve ter ocorrido');
  assert.equal(calls.pedidoInsert.status, 'rascunho', 'status inicial continua rascunho');
  assert.ok(Array.isArray(calls.pedidoItensInsert), 'o INSERT em pedido_itens foi tentado');
  assert.equal(calls.pedidoDelete, 1,
    'falha nos itens deve compensar com exatamente um DELETE do pedido criado');
});

test('batch1/20. o lote NAO introduz tabela nem RPC alguma', () => {
  const tabelas = Array.from(new Set(
    (screen.match(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g) || [])
      .map((m) => m.replace(/^.*['"]([a-z_]+)['"].*$/, '$1'))
  )).sort();
  assert.deepEqual(tabelas, ['clientes', 'modelos', 'pedido_itens', 'pedidos'],
    'o conjunto de tabelas lidas/escritas pela tela nao pode crescer');
  assert.doesNotMatch(screen, /\.rpc\s*\(/, 'a tela nao pode passar a chamar RPC');
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /tipo_produto\s*:/, 'nenhum payload pode carregar tipo_produto');
  assert.doesNotMatch(screen, /\.update\s*\(|\.upsert\s*\(/, 'a tela nao faz update/upsert');
});

test('batch1/21. o modal de item tem UM unico dono, nos dois modos', () => {
  assert.match(screen, /function\s+openItemModal\s*\(\s*options\s*\)/,
    'deve existir um unico openItemModal({ mode, item })');
  assert.doesNotMatch(screen, /function\s+openAddItemModal\s*\(/,
    'a implementacao duplicada de "adicionar" nao pode sobreviver');
  assert.equal((screen.match(/document\.body\.appendChild\(\s*overlay\s*\)/g) || []).length, 1,
    'existe uma unica montagem de modal de item');
  assert.match(screen, /maxlength:\s*'200'/, 'limite de 200 caracteres da observacao preservado');
  assert.match(screen, /max-height:90vh/, 'altura maxima responsiva preservada');
  assert.match(screen, /overflow-y:auto/, 'rolagem interna preservada');
});

test('batch1/22. o arquivo permanece abaixo do limite duro de 1.200 linhas', () => {
  const linhas = screen.split('\n').length;
  assert.ok(linhas < 1200, 'pedido-form.js deve ficar abaixo de 1.200 linhas; atual: ' + linhas);
  assert.match(screen, /DEBITO ESTRUTURAL NAO BLOQUEANTE/,
    'o overrun do patamar de 900 linhas deve estar declarado no cabecalho');
});
