// =====================================================================
// === tests/pedido-itens-edit.smoke.js ================================
// Smoke estático para a tela admin de edição de itens do Pedido
// `js/screens/pedido-itens-edit.js` (`screenPedidoItensEditar`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C1
// Escopo: edição de `modelo_id`, `metros`, `observacao` em
//   itens JÁ EXISTENTES (C3C2B) + ADICIONAR novos itens (C3C2C1).
//   SEM remover (C3C2C2), SEM reordenar manualmente, SEM
//   editar `largura`/`cor_1_id`/`cor_2_id` (overrides opcionais
//   ficam para C3C2D). Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenPedidoItensEditar e
//     RAVATEX_SCREENS.pedidoItensEdit;
//   - index.html carrega pedido-itens-edit.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedido-form → pedido-detail
//     → pedido-edit → pedido-itens-edit → boot;
//   - faz SELECT em `pedidos` (status), `pedido_itens`,
//     `modelos` e `cores` (para label/preview);
//   - faz `update` em `pedido_itens` (apenas itens existentes) com
//     `.eq('id', item.dbId).eq('pedido_id', pedidoId)`;
//   - payload de update contém EXATAMENTE 3 chaves:
//     `modelo_id`, `metros`, `observacao`;
//   - faz `insert` em `pedido_itens` (apenas itens novos) com
//     5 chaves: `pedido_id`, `modelo_id`, `metros`, `observacao`,
//     `ordem`;
//   - NÃO atualiza `id`, `pedido_id`, `ordem`, `largura`,
//     `cor_1_id`, `cor_2_id`, `criado_em` em updates;
//   - NÃO seta `id`, `largura`, `cor_1_id`, `cor_2_id`,
//     `criado_em` em inserts;
//   - NÃO faz delete/upsert em `pedido_itens`;
//   - NÃO faz update em `pedidos`;
//   - NÃO toca `pedido_eventos`;
//   - NÃO toca `lotes`;
//   - NÃO mexe em OP;
//   - NÃO chama `functions.invoke` / Edge Function;
//   - NÃO usa `token_acesso` / `service_role`;
//   - NÃO cria rota pública de cliente;
//   - valida status editável (rascunho / recebido) — se não
//     editável, exibe aviso e bloqueia salvamento;
//   - usa helper `window.isPedidoEditavel` (de `pedido-ui.js`);
//   - navega de volta para `#/pedidos/<uuid>` após sucesso;
//   - TEM botão "+ Adicionar item" (C3C2C1);
//   - TEM botão "Descartar novo item" apenas para itens com isNew;
//   - SEM botão "Remover item" de item existente (C3C2C2);
//   - SEM drag-and-drop / reordenação manual (C3C2C2);
//   - rota dinâmica `#/pedidos/<uuid>/itens` é admin-only.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-itens-edit.js');
const DETAIL = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const detail = readOrFail(DETAIL);
const helper = readOrFail(HELPER);
const router = readOrFail(ROUTER);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);

// Strip line comments and block comments for code-only assertions.
function codeOnly(src) {
  return src
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
}

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('pedido-itens-edit: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-itens-edit.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-itens-edit: sintaxe JS válida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('pedido-itens-edit: expõe screenPedidoItensEditar no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(screen, sandbox);
  assert.equal(typeof sandbox.window.screenPedidoItensEditar, 'function',
    'window.screenPedidoItensEditar deve estar exposto como função');
  assert.ok(sandbox.window.RAVATEX_SCREENS, 'RAVATEX_SCREENS ausente');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoItensEdit, 'object',
    'window.RAVATEX_SCREENS.pedidoItensEdit deve ser objeto');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoItensEdit.screenPedidoItensEditar, 'function',
    'window.RAVATEX_SCREENS.pedidoItensEdit.screenPedidoItensEditar deve ser função');
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez e na ordem correta
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedido-itens-edit.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedido-itens-edit\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-itens-edit.js deve ser carregado exatamente 1 vez');
});

test('index.html: pedido-itens-edit.js vem antes de boot.js', () => {
  const idxItensEdit = index.indexOf('js/screens/pedido-itens-edit.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxItensEdit > 0, 'pedido-itens-edit.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxItensEdit < idxBoot, 'pedido-itens-edit.js deve vir antes de boot.js');
});

test('index.html: pedido-itens-edit.js vem depois de pedido-ui.js, pedido-detail.js, pedido-form.js, pedido-edit.js', () => {
  const idxHelper = index.indexOf('js/pedido-ui.js');
  const idxList   = index.indexOf('js/screens/pedidos-list.js');
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  const idxForm   = index.indexOf('js/screens/pedido-form.js');
  const idxEdit   = index.indexOf('js/screens/pedido-edit.js');
  const idxItensEdit = index.indexOf('js/screens/pedido-itens-edit.js');
  assert.ok(idxHelper > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxList > 0, 'pedidos-list.js deve estar no <head>');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxEdit > 0, 'pedido-edit.js deve estar no <head>');
  assert.ok(idxItensEdit > 0, 'pedido-itens-edit.js deve estar no <head>');
  assert.ok(idxHelper < idxItensEdit, 'pedido-itens-edit.js deve vir depois de pedido-ui.js');
  assert.ok(idxDetail < idxItensEdit, 'pedido-itens-edit.js deve vir depois de pedido-detail.js');
  assert.ok(idxForm < idxItensEdit, 'pedido-itens-edit.js deve vir depois de pedido-form.js');
  assert.ok(idxEdit < idxItensEdit, 'pedido-itens-edit.js deve vir depois de pedido-edit.js');
});

// ---------------------------------------------------------------------
// 4. Router tem match dinâmico para #/pedidos/<uuid>/itens (admin only)
// ---------------------------------------------------------------------

test('router.js: tem match dinâmico para #/pedidos/<uuid>/itens chamando screenPedidoItensEditar', () => {
  assert.ok(router.includes('#/pedidos/'),
    'router.js deve referenciar #/pedidos/ no matchRoute');
  assert.ok(router.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
    'router.js deve validar formato UUID do id do pedido');
  assert.match(router, /screenPedidoItensEditar/,
    'router.js deve chamar screenPedidoItensEditar no matchRoute');
  // O match dinâmico deve ter /itens ancorado em $ próximo de
  // screenPedidoItensEditar.
  const idxItens = router.indexOf('/itens$');
  const idxRender = router.indexOf('screenPedidoItensEditar');
  assert.ok(idxItens > 0, 'regex de edição de itens (com /itens$ ancorado) deve existir em router.js');
  assert.ok(idxRender > 0, 'chamada screenPedidoItensEditar deve existir em router.js');
  const distancia = Math.abs(idxRender - idxItens);
  assert.ok(distancia <= 400,
    'regex de itens e screenPedidoItensEditar devem estar próximos (distância ' + distancia + ' > 400)');
});

test('router.js: rota dinâmica #/pedidos/<uuid>/itens é admin-only', () => {
  // O bloco do match dinâmico de itens deve ter `roles: ['admin']`
  // próximo do screenPedidoItensEditar.
  const m = router.match(/\/itens\$[\s\S]{0,400}?roles\s*:\s*\[[^\]]+\]/m);
  assert.ok(m, 'trecho do match dinâmico de itens não encontrado em router.js');
  assert.match(m[0], /['"]admin['"]/,
    'rota dinâmica #/pedidos/<uuid>/itens deve ser admin-only');
});

test('router.js: matchRoute dinâmico #/pedidos/<uuid>/itens NÃO é público', () => {
  const m = router.match(/\/itens\$[\s\S]{0,400}/m);
  assert.ok(m, 'trecho do match dinâmico de itens não encontrado em router.js');
  assert.doesNotMatch(m[0], /public\s*:\s*true/,
    'rota dinâmica #/pedidos/<uuid>/itens NÃO deve ser pública');
});

// ---------------------------------------------------------------------
// 5. pedido-itens-edit.js consultas: SELECT em pedidos/itens/modelos/cores
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: faz SELECT em pedidos filtrando por id', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em pedidos');
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/,
    'deve filtrar por id com .eq("id", pedidoId)');
});

test('pedido-itens-edit.js: faz SELECT em pedido_itens filtrando por pedido_id', () => {
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em pedido_itens');
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,500}\.eq\s*\(\s*['"]pedido_id['"]\s*,\s*pedidoId\s*\)/,
    'deve filtrar por pedido_id com .eq("pedido_id", pedidoId)');
});

test('pedido-itens-edit.js: faz SELECT em modelos (para popular select)', () => {
  assert.match(screen, /\.from\(\s*['"]modelos['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em modelos');
  assert.match(screen, /\.from\(\s*['"]modelos['"][\s\S]{0,500}\.order\s*\(\s*['"]nome['"]\s*\)/,
    'deve ordenar modelos por nome');
});

test('pedido-itens-edit.js: faz SELECT em cores (para label/preview)', () => {
  assert.match(screen, /\.from\(\s*['"]cores['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em cores');
});

// ---------------------------------------------------------------------
// 6. pedido-itens-edit.js write: APENAS update em pedido_itens
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: faz .update() em pedido_itens com .eq("id", item.dbId) e .eq("pedido_id", pedidoId)', () => {
  // Update com dupla condição: id do item + pedido_id (defesa contra
  // update acidental em item de outro pedido).
  const m = screen.match(
    /\.from\(\s*['"]pedido_itens['"][\s\S]{0,400}?\.update\s*\(\s*payload\s*\)[\s\S]{0,300}?\.eq\s*\(\s*['"]id['"]\s*,\s*it\.dbId\s*\)[\s\S]{0,100}?\.eq\s*\(\s*['"]pedido_id['"]\s*,\s*pedidoId\s*\)/
  );
  assert.ok(m, 'deve fazer .update(payload).eq("id", it.dbId).eq("pedido_id", pedidoId)');
});

test('pedido-itens-edit.js: payload de update contém EXATAMENTE 3 chaves (modelo_id, metros, observacao)', () => {
  // O objeto `payload` deve ter APENAS essas 3 chaves.
  const m = screen.match(/const\s+payload\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'objeto payload deve existir');
  const chaves = m[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.equal(chaves.length, 3,
    'payload deve ter EXATAMENTE 3 chaves (modelo_id, metros, observacao)');
  const chavesStr = chaves.join(' ');
  assert.match(chavesStr, /modelo_id\s*:/,
    'payload deve incluir modelo_id');
  assert.match(chavesStr, /metros\s*:/,
    'payload deve incluir metros');
  assert.match(chavesStr, /observacao\s*:/,
    'payload deve incluir observacao');
});

test('pedido-itens-edit.js: NÃO atualiza campos proibidos (id, pedido_id, ordem, largura, cor_1_id, cor_2_id, criado_em)', () => {
  const m = screen.match(/const\s+payload\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'objeto payload deve existir');
  const chavesStr = m[1];
  for (const proibido of ['id', 'pedido_id', 'ordem', 'largura', 'cor_1_id', 'cor_2_id', 'criado_em']) {
    assert.doesNotMatch(chavesStr, new RegExp('\\b' + proibido + '\\s*:'),
      'payload NÃO deve conter campo "' + proibido + '" (C3C2C1 restrito a modelo_id/metros/observacao)');
  }
});

test('pedido-itens-edit.js: NÃO faz .delete() / .upsert() em pedido_itens', () => {
  // C3C2C1: insert permitido (para novos itens), mas delete e
  // upsert permanecem proibidos. Remoção fica para C3C2C2.
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.delete\s*\(/,
    'pedido-itens-edit.js NÃO deve fazer .delete() em pedido_itens (C3C2C2)');
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.upsert\s*\(/,
    'pedido-itens-edit.js NÃO deve fazer .upsert() em pedido_itens');
});

test('pedido-itens-edit.js: faz .insert() em pedido_itens (C3C2C1)', () => {
  // C3C2C1: insert é permitido para adicionar novos itens.
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,400}\.insert\s*\(/,
    'deve fazer .insert() em pedido_itens (C3C2C1)');
});

test('pedido-itens-edit.js: NÃO faz .update() em pedidos', () => {
  // Update de pedidos é feito em C3C1 e C3B. C3C2C1 só mexe em
  // pedido_itens.
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.update\s*\(/,
    'C3C2C1 NÃO deve fazer .update() em pedidos');
});

test('pedido-itens-edit.js: NÃO toca pedido_eventos / lotes', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_eventos['"]/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]lotes['"]/);
});

// ---------------------------------------------------------------------
// 7. pedido-itens-edit.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
  assert.doesNotMatch(screen, /supabase\/functions/);
  assert.doesNotMatch(screen, /admin-create-user/);
  assert.doesNotMatch(screen, /admin-disable-user/);
  assert.doesNotMatch(screen, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 8. pedido-itens-edit.js não referencia OP/lote/entrega
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: NÃO referencia tabelas de OP/lote/entrega', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens)['"]/);
  assert.doesNotMatch(screen, /gerar_op_latex/);
  assert.doesNotMatch(screen, /gerar_op_pedido/);
  assert.doesNotMatch(screen, /criar_lote/);
  assert.doesNotMatch(screen, /persistirOP/);
  assert.doesNotMatch(screen, /aplicarRecalculoOP/);
  assert.doesNotMatch(screen, /screenNovaOP/);
  assert.doesNotMatch(screen, /window\.screenNovaOP/);
  assert.doesNotMatch(screen, /renderOPLatexAdmin/);
});

test('pedido-itens-edit.js: NÃO referencia arquivos críticos de OP/Fornecedor', () => {
  assert.doesNotMatch(screen, /op-nova\.js/);
  assert.doesNotMatch(screen, /op-persistir\.js/);
  assert.doesNotMatch(screen, /op-latex-admin\.js/);
  assert.doesNotMatch(screen, /op-recalculo\.js/);
  assert.doesNotMatch(screen, /op-writes\.js/);
  assert.doesNotMatch(screen, /entrega-writes\.js/);
  assert.doesNotMatch(screen, /entrega-form\.js/);
  assert.doesNotMatch(screen, /fornecedor\.js/);
  assert.doesNotMatch(screen, /screenFornecedor/);
  assert.doesNotMatch(screen, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});

// ---------------------------------------------------------------------
// 9. pedido-itens-edit.js usa isPedidoEditavel de pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: usa window.isPedidoEditavel para validar status', () => {
  assert.match(screen, /window\.isPedidoEditavel/,
    'deve usar window.isPedidoEditavel para validar status editável');
});

test('pedido-itens-edit.js: bloqueia salvamento se status não for editável', () => {
  // Deve haver uma checagem de `state.blockedStatus` ou de
  // `isPedidoEditavel` que impede `salvar()` de prosseguir.
  const co = codeOnly(screen);
  // blockedStatus definido OU isPedidoEditavel(...) === false
  assert.match(co, /(state\.blockedStatus|isPedidoEditavel\s*\([\s\S]{0,80}?===?\s*false)/,
    'salvamento deve ser bloqueado se status não for editável');
  // salvar() deve checar blockedStatus antes do update.
  assert.match(co, /async function salvar[\s\S]{0,400}?blockedStatus/,
    'salvar() deve verificar blockedStatus antes do update');
});

// ---------------------------------------------------------------------
// 10. pedido-itens-edit.js navega de volta para o detalhe após sucesso
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: navega de volta para #/pedidos/<uuid> após sucesso', () => {
  // Após o update bem-sucedido, deve navegar para o detalhe.
  assert.match(screen, /window\.navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\)/,
    'deve navegar para "#/pedidos/" + pedidoId após sucesso');
});

test('pedido-itens-edit.js: tem botão Cancelar que volta para o detalhe', () => {
  // O botão Cancelar do form deve navegar para o detalhe, não para a lista.
  assert.match(screen, /navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\)/,
    'botão Cancelar deve navegar para "#/pedidos/" + pedidoId');
});

// ---------------------------------------------------------------------
// 11. pedido-itens-edit.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(screen, /CREATE\s+POLICY/i);
  assert.doesNotMatch(screen, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(screen, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 12. pedido-itens-edit.js não tem token público / service_role
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

test('pedido-itens-edit.js: NÃO contém service_role / SUPERUSER', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(co, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 13. pedido-itens-edit.js não cria rota pública de cliente
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: NÃO cria rota pública de cliente (sem public: true)', () => {
  assert.doesNotMatch(screen, /public\s*:\s*true/);
  assert.doesNotMatch(screen, /['"]#\/cliente/);
  assert.doesNotMatch(screen, /setRoutes/);
  assert.doesNotMatch(screen, /window\.RAVATEX_ROUTER\.setRoutes/);
});

// ---------------------------------------------------------------------
// 14. pedido-itens-edit.js usa helper pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: usa window.pedidoStatusBadge para badge de status', () => {
  assert.match(screen, /window\.pedidoStatusBadge/);
});

test('pedido-itens-edit.js: usa window.pedidoStatusLabel para label de status', () => {
  assert.match(screen, /window\.pedidoStatusLabel/);
});

test('pedido-itens-edit.js: usa formField / selectInput / textInput do ui.js', () => {
  assert.match(screen, /window\.formField|window\.selectInput|window\.textInput/);
});

// ---------------------------------------------------------------------
// 15. C3C2B não tem controles de add/remove/reordenar
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: TEM botão "+ Adicionar item" (C3C2C1)', () => {
  // C3C2C1: o botão "+ Adicionar item" existe e chama adicionarItem().
  // Visível apenas se status editável (controlado em buildItensList).
  assert.match(screen, /\+ Adicionar item/,
    'botão "+ Adicionar item" deve existir como label');
  // Deve existir função adicionarItem() que adiciona item com isNew.
  assert.match(screen, /function\s+adicionarItem/,
    'deve existir função adicionarItem()');
  // Deve existir handler que adiciona item ao state.itens.
  assert.match(screen, /state\.itens\.push/,
    'deve haver state.itens.push para adicionar novo item ao estado');
  // Deve existir marcador isNew em item novo.
  assert.match(screen, /isNew\s*:\s*true/,
    'item novo deve ter flag isNew: true');
});

test('pedido-itens-edit.js: NÃO tem botão "Remover item" de item existente (C3C2C2)', () => {
  // C3C2C1 NÃO remove itens existentes. Remoção fica para C3C2C2.
  // O único botão de descarte é "Descartar novo item", que só
  // aparece em itens com isNew=true.
  // Defesa: o handler de descarte (descartarItemNovo) deve checar
  // isNew antes de remover.
  const co = codeOnly(screen);
  assert.match(co, /function\s+descartarItemNovo/,
    'deve existir função descartarItemNovo()');
  // A função deve checar isNew antes de remover.
  assert.match(co, /descartarItemNovo[\s\S]{0,300}?isNew/,
    'descartarItemNovo deve checar isNew antes de remover');
  // Defesa: não deve haver lógica genérica de "remover item existente".
  assert.doesNotMatch(co, /removeBtn/,
    'pedido-itens-edit.js NÃO deve ter "removeBtn" (apenas C3C2C2)');
});

test('pedido-itens-edit.js: NÃO tem drag-and-drop / reordenação manual (C3C2C2)', () => {
  // Reordenação manual é escopo de C3C2C2.
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /drag/i,
    'pedido-itens-edit.js NÃO deve ter drag-and-drop (C3C2C2)');
  assert.doesNotMatch(co, /reordenar|reorder|moveUp|moveDown/i,
    'pedido-itens-edit.js NÃO deve ter reordenação manual (C3C2C2)');
});

// ---------------------------------------------------------------------
// 15b. C3C2C1: insert de novos itens + payload restrito
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: insert de novos itens contém pedido_id, modelo_id, metros, observacao, ordem (C3C2C1)', () => {
  // C3C2C1: o insert de novos itens deve ter 5 chaves permitidas.
  // A variável é `insertPayload` (array de objetos com essas chaves).
  // Procura o objeto literal dentro do map.
  const m = screen.match(/insertPayload\s*=\s*newItems\.map[\s\S]*?return\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'insertPayload deve existir com newItems.map(... return {...})');
  const chavesStr = m[1];
  for (const esperada of ['pedido_id', 'modelo_id', 'metros', 'observacao', 'ordem']) {
    assert.match(chavesStr, new RegExp('\\b' + esperada + '\\s*:'),
      'insertPayload deve incluir campo "' + esperada + '"');
  }
});

test('pedido-itens-edit.js: insert de novos itens NÃO contém campos proibidos (C3C2C1)', () => {
  // NÃO deve setar id, largura, cor_1_id, cor_2_id, criado_em.
  const m = screen.match(/insertPayload\s*=\s*newItems\.map[\s\S]*?return\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'insertPayload deve existir');
  for (const proibido of ['id', 'largura', 'cor_1_id', 'cor_2_id', 'criado_em']) {
    assert.doesNotMatch(m[1], new RegExp('\\b' + proibido + '\\s*:'),
      'insertPayload NÃO deve conter campo "' + proibido + '"');
  }
});

test('pedido-itens-edit.js: ordem de novos itens é calculada automaticamente (C3C2C1)', () => {
  // Para novos itens, ordem = existingItems.length + i.
  const m = screen.match(/insertPayload\s*=\s*newItems\.map[\s\S]*?return\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'insertPayload deve existir');
  // A expressão de ordem deve usar existingItems.length.
  assert.match(m[1], /ordem\s*:\s*existingItems\.length\s*\+\s*i/,
    'ordem deve ser calculada como existingItems.length + i');
});

test('pedido-itens-edit.js: tem botão "Descartar novo item" para itens com isNew', () => {
  // Itens novos têm botão "Descartar novo item" (NÃO "Remover item").
  assert.match(screen, /Descartar novo item/,
    'deve existir label "Descartar novo item"');
  // Deve ser mostrado apenas em itens com isNew.
  const co = codeOnly(screen);
  assert.match(co, /isNew[\s\S]{0,300}?Descartar novo item/,
    'label "Descartar novo item" deve aparecer apenas em itens com isNew');
});

// ---------------------------------------------------------------------
// 16. pedido-itens-edit.js: mensagem "Pedido sem itens" quando vazio
// ---------------------------------------------------------------------

test('pedido-itens-edit.js: mostra mensagem "Pedido sem itens" quando não há itens', () => {
  assert.match(screen, /Pedido sem itens/,
    'deve mostrar mensagem "Pedido sem itens" quando count for 0');
});

test('pedido-itens-edit.js: NÃO permite salvar quando não há itens', () => {
  // salvar() deve validar que há ao menos 1 item.
  const co = codeOnly(screen);
  assert.match(co, /itens\.length\s*===\s*0|itens\.length\s*<\s*1/,
    'salvar() deve bloquear quando state.itens.length === 0');
});

// ---------------------------------------------------------------------
// 17. pedido-detail.js → botão "Editar itens" funcional por status
// ---------------------------------------------------------------------

test('pedido-detail.js: tem botão "Editar itens" para status editáveis (C3C2B)', () => {
  // C3C2B: o botão "Editar itens" é FUNCIONAL para status
  // editáveis (rascunho / recebido) e PLACEHOLDER para os demais.
  assert.match(detail, /Editar itens/,
    'botão "Editar itens" deve existir como label');
  // O botão Editar itens funcional deve navegar para /itens.
  assert.match(detail, /navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\+\s*['"]\/itens['"]/,
    'botão Editar itens funcional deve navegar para "#/pedidos/<id>/itens"');
  // O botão Editar itens é criado em buildEditItensButton()
  // (helper separado, mesmo padrão de buildEditButton).
  assert.match(detail, /function\s+buildEditItensButton/,
    'deve existir função buildEditItensButton()');
});

test('pedido-detail.js: buildEditItensButton usa isPedidoEditavel', () => {
  // Defesa: buildEditItensButton deve checar isPedidoEditavel
  // antes de criar o botão funcional.
  const co = codeOnly(detail);
  assert.match(co, /function\s+buildEditItensButton[\s\S]{0,300}?isPedidoEditavel/,
    'buildEditItensButton deve usar isPedidoEditavel');
});

// ---------------------------------------------------------------------
// 18. Schema 13_* não foi alterado por esta fase
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C3C2C1', () => {
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});
