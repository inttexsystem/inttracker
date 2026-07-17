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

function makePedidoFormRuntime() {
  const calls = { pedidoInsert: null, pedidoItensInsert: null };
  // Document double from the shared module; createElement is widened to the
  // attribute-aware PedidoFormNode (see above). createTextNode / body / the
  // #toasts node all come straight from _doubles.js.
  const document = createDocument();
  document.createElement = (tag) => new PedidoFormNode(tag);
  function tableData(table) {
    if (table === 'clientes') return [{ id: 501, nome: 'Cliente Atlas' }];
    if (table === 'modelos') {
      return [{
        id: 1,
        nome: 'Modelo A',
        largura: 1.4,
        cor_1: { id: 1, nome: 'Azul' },
        cor_2: { id: 2, nome: 'Branco' },
      }];
    }
    return [];
  }
  function chain(table) {
    let mutation = null;
    let payload = null;
    const api = {
      select() { return api; },
      order() { return api; },
      eq() { return api; },
      insert(value) {
        mutation = 'insert';
        payload = value;
        if (table === 'pedidos') calls.pedidoInsert = value;
        if (table === 'pedido_itens') calls.pedidoItensInsert = value;
        return api;
      },
      delete() { mutation = 'delete'; return api; },
      single() {
        if (table === 'pedidos' && mutation === 'insert') {
          return Promise.resolve({ data: { id: 'ped-1', numero: 7, status: 'rascunho' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        const result = table === 'pedido_itens' && mutation === 'insert'
          ? { data: [{ id: 'pi-1' }], error: null }
          : { data: tableData(table), error: null };
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
  // js/ui.js also defines a real toast() that appends to #toasts and arms a
  // setTimeout; the runtime test never asserts on toast, so re-override it with
  // a no-op AFTER ui.js (representation translation, rule 4).
  sandbox.toast = () => {};
  vm.runInContext(screen, sandbox, { filename: 'js/screens/pedido-form.js' });
  return { sandbox, calls };
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
  const buildItemRow = (screen.match(/function\s+buildItemRow\s*\(item\)\s*\{[\s\S]*?\n    function openAddItemModal/) || [''])[0];
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
