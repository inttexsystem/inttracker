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
//   - pedido-form.js NÃO navega para rota de geração de OP.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-form.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const LIST   = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

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

test('pedidos-list.js: botão "+ Novo pedido" navega para #/pedidos/novo', () => {
  // Deve haver um bloco com "Novo pedido" e navigate('#/pedidos/novo')
  // no mesmo callback.
  const re = /['"]\+ Novo pedido['"][\s\S]{0,200}navigate\(\s*['"]#\/pedidos\/novo['"]\s*\)/;
  assert.match(list, re, "botão '+ Novo pedido' deve navegar para '#/pedidos/novo'");
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

test('pedido-form: NÃO navega para #/ops/nova ou outra rota de OP', () => {
  assert.doesNotMatch(screen, /navigate\(\s*['"]#\/ops/);
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
