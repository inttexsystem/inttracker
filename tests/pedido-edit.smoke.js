// =====================================================================
// === tests/pedido-edit.smoke.js =======================================
// Smoke estático para a tela admin de edição
// `js/screens/pedido-edit.js` (`screenPedidoEditar`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1
// Escopo: edição APENAS dos dados gerais do Pedido (cliente_id,
//   prazo_entrega, observacao) para status editáveis (rascunho /
//   recebido). Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenPedidoEditar e RAVATEX_SCREENS.pedidoEdit;
//   - index.html carrega pedido-edit.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedido-detail → pedido-edit → boot;
//   - faz SELECT em `pedidos` (com campos editáveis) e `clientes`;
//   - faz APENAS `update` em `pedidos`;
//   - payload de update contém EXATAMENTE 3 chaves:
//     `cliente_id`, `prazo_entrega`, `observacao`;
//   - NÃO atualiza `status`;
//   - NÃO atualiza `numero`;
//   - NÃO toca `pedido_itens`;
//   - NÃO toca `lotes`;
//   - NÃO mexe em OP;
//   - NÃO chama `functions.invoke` / Edge Function;
//   - NÃO usa `token_acesso` / `service_role`;
//   - NÃO cria rota pública de cliente;
//   - valida status editável (rascunho / recebido) — se não
//     editável, exibe aviso e bloqueia salvamento;
//   - usa helper `window.isPedidoEditavel` (de `pedido-ui.js`);
//   - navega de volta para `#/pedidos/<uuid>` após sucesso;
//   - rota dinâmica `#/pedidos/<uuid>/editar` é admin-only.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-edit.js');
const DETAIL = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const DETAIL_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

// HARNESS: leitura normalizada em LF. O `codeOnly` abaixo remove comentarios
// de linha com uma regex ancorada em fim de linha, e essa ancora NAO casa num
// checkout CRLF (em JS o ponto nao casa CR, e a ancora sem flag multiline nao
// casa antes de CR). Sem normalizar, os bans textuais passam a acusar o que o
// modulo DOCUMENTA em vez do que ele contem. Ver tests/_app-source.js.
function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return require('./_app-source.js').toLf(fs.readFileSync(p, 'utf8'));
}

const screen = readOrFail(SCREEN);
const detail = readOrFail(DETAIL);
const detailEvents = readOrFail(DETAIL_EVENTS);
const helper = readOrFail(HELPER);
const router = readOrFail(ROUTER);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);
const detailBundle = [detail, detailEvents].join('\n\n');

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

test('pedido-edit: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-edit.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-edit: sintaxe JS válida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('pedido-edit: expõe screenPedidoEditar no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(screen, sandbox);
  assert.equal(typeof sandbox.window.screenPedidoEditar, 'function',
    'window.screenPedidoEditar deve estar exposto como função');
  assert.ok(sandbox.window.RAVATEX_SCREENS, 'RAVATEX_SCREENS ausente');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoEdit, 'object',
    'window.RAVATEX_SCREENS.pedidoEdit deve ser objeto');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoEdit.screenPedidoEditar, 'function',
    'window.RAVATEX_SCREENS.pedidoEdit.screenPedidoEditar deve ser função');
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez e na ordem correta
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedido-edit.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedido-edit\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-edit.js deve ser carregado exatamente 1 vez');
});

test('index.html: pedido-edit.js vem antes de boot.js', () => {
  const idxEdit = index.indexOf('js/screens/pedido-edit.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxEdit > 0, 'pedido-edit.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxEdit < idxBoot, 'pedido-edit.js deve vir antes de boot.js');
});

test('index.html: pedido-edit.js vem depois de pedido-ui.js, pedido-detail.js e pedido-form.js', () => {
  const idxHelper = index.indexOf('js/pedido-ui.js');
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  const idxForm   = index.indexOf('js/screens/pedido-form.js');
  const idxEdit   = index.indexOf('js/screens/pedido-edit.js');
  assert.ok(idxHelper > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxEdit > 0, 'pedido-edit.js deve estar no <head>');
  assert.ok(idxHelper < idxEdit, 'pedido-edit.js deve vir depois de pedido-ui.js');
  assert.ok(idxDetail < idxEdit, 'pedido-edit.js deve vir depois de pedido-detail.js');
  assert.ok(idxForm < idxEdit, 'pedido-edit.js deve vir depois de pedido-form.js');
});

// ---------------------------------------------------------------------
// 4. Router tem match dinâmico para #/pedidos/<uuid>/editar
// ---------------------------------------------------------------------

test('router.js: tem match dinâmico para #/pedidos/<uuid>/editar chamando screenPedidoEditar', () => {
  assert.ok(router.includes('#/pedidos/'),
    'router.js deve referenciar #/pedidos/ no matchRoute');
  // Padrão: UUID + /editar (ancorado em $)
  assert.ok(router.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
    'router.js deve validar formato UUID do id do pedido');
  assert.match(router, /screenPedidoEditar/,
    'router.js deve chamar screenPedidoEditar no matchRoute');
  // Deve haver um match dinâmico com /editar ancorado em $ próximo de
  // screenPedidoEditar (até 400 chars entre eles).
  // Procuramos a string '/editar$' (que aparece como '/editar$' no source).
  const idxEditar = router.indexOf('/editar$');
  const idxRender = router.indexOf('screenPedidoEditar');
  assert.ok(idxEditar > 0, 'regex de edição (com /editar$ ancorado) deve existir em router.js');
  assert.ok(idxRender > 0, 'chamada screenPedidoEditar deve existir em router.js');
  const distancia = Math.abs(idxRender - idxEditar);
  assert.ok(distancia <= 400,
    'regex de edição e screenPedidoEditar devem estar próximos (distância ' + distancia + ' > 400)');
});

test('router.js: rota dinâmica #/pedidos/<uuid>/editar é admin-only', () => {
  // O bloco do match dinâmico de edição deve ter `roles: ['admin']`
  // próximo do screenPedidoEditar.
  const m = router.match(/\/editar\$[\s\S]{0,400}?roles\s*:\s*\[[^\]]+\]/m);
  assert.ok(m, 'trecho do match dinâmico de edição não encontrado em router.js');
  assert.match(m[0], /['"]admin['"]/,
    'rota dinâmica #/pedidos/<uuid>/editar deve ser admin-only');
});

test('router.js: matchRoute dinâmico #/pedidos/<uuid>/editar NÃO é público', () => {
  // Pega o trecho entre /editar$ e o final do bloco.
  const m = router.match(/\/editar\$[\s\S]{0,400}/m);
  assert.ok(m, 'trecho do match dinâmico de edição não encontrado em router.js');
  assert.doesNotMatch(m[0], /public\s*:\s*true/,
    'rota dinâmica #/pedidos/<uuid>/editar NÃO deve ser pública');
});

// ---------------------------------------------------------------------
// 5. pedido-edit.js consultas: SELECT em pedidos + clientes
// ---------------------------------------------------------------------

test('pedido-edit.js: faz SELECT em pedidos filtrando por id', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em pedidos');
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/,
    'deve filtrar por id com .eq("id", pedidoId)');
});

test('pedido-edit.js: faz SELECT em clientes (para popular select)', () => {
  assert.match(screen, /\.from\(\s*['"]clientes['"][\s\S]{0,500}\.select\s*\(/,
    'deve fazer .select() em clientes');
  assert.match(screen, /\.from\(\s*['"]clientes['"][\s\S]{0,500}\.order\s*\(\s*['"]nome['"]\s*\)/,
    'deve ordenar clientes por nome');
});

// ---------------------------------------------------------------------
// 6. pedido-edit.js write: APENAS update em pedidos (campos restritos)
// ---------------------------------------------------------------------

test('pedido-edit.js: faz .update() em pedidos com .eq("id", pedidoId)', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,400}\.update\s*\(\s*payload\s*\)[\s\S]{0,200}\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/,
    'deve fazer .update(payload).eq("id", pedidoId) na tela de edição');
});

test('pedido-edit.js: payload de update contém SOMENTE 3 chaves (cliente_id, prazo_entrega, observacao)', () => {
  // O payload é montado em duas etapas:
  //   1) `const payload = { cliente_id: ... };`
  //   2) `payload.prazo_entrega = ...; payload.observacao = ...;`
  // Verifica que NENHUMA outra chave é setada no payload.
  const co = codeOnly(screen);

  // Coleta TODAS as atribuições a payload.chave = valor.
  // O payload é construído em if/else, então a mesma chave aparece 2x
  // (uma no `if`, outra no `else`). Conta chaves DISTINTAS.
  const assignments = co.match(/payload\.[a-zA-Z_][a-zA-Z0-9_]*\s*=/g) || [];
  const chavesSetadas = Array.from(new Set(assignments
    .map(a => a.match(/payload\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/))
    .filter(m => m)
    .map(m => m[1])));

  // Deve haver EXATAMENTE 2 chaves DISTINTAS setadas via atribuição:
  // prazo_entrega e observacao.
  assert.equal(chavesSetadas.length, 2,
    'payload deve ter EXATAMENTE 2 chaves DISTINTAS (prazo_entrega, observacao); encontradas: ' + chavesSetadas.join(', '));
  // As chaves esperadas (em qualquer ordem)
  assert.ok(chavesSetadas.indexOf('prazo_entrega') !== -1,
    'payload deve incluir prazo_entrega');
  assert.ok(chavesSetadas.indexOf('observacao') !== -1,
    'payload deve incluir observacao');
  // Defesa: nenhuma chave estranha foi setada.
  const chavesInvalidas = chavesSetadas.filter(c =>
    c !== 'prazo_entrega' && c !== 'observacao');
  assert.equal(chavesInvalidas.length, 0,
    'payload NÃO deve setar chaves extras; inválidas: ' + chavesInvalidas.join(', '));

  // O literal `payload` inicial deve incluir cliente_id.
  assert.match(co, /const\s+payload\s*=\s*\{[\s\S]*?cliente_id\s*:/,
    'payload inicial deve incluir cliente_id');
});

test('pedido-edit.js: NÃO atualiza `status`', () => {
  // Garante que `status` não aparece como chave no payload nem em
  // nenhum .update() em pedidos.
  const m = screen.match(/const\s+payload\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'objeto payload deve existir');
  assert.doesNotMatch(m[1], /status\s*:/,
    'payload NÃO deve conter campo "status" (C3C1 não mexe em status)');
  // Defesa extra: nenhum update com status:
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /\.update\s*\([\s\S]{0,100}?status\s*:/,
    'nenhum .update() em pedido-edit.js deve conter "status"');
});

test('pedido-edit.js: NÃO atualiza `numero`', () => {
  const m = screen.match(/const\s+payload\s*=\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'objeto payload deve existir');
  assert.doesNotMatch(m[1], /numero\s*:/,
    'payload NÃO deve conter campo "numero" (gerado automaticamente)');
  // Defesa extra: nenhum update com numero:
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /\.update\s*\([\s\S]{0,100}?numero\s*:/,
    'nenhum .update() em pedido-edit.js deve conter "numero"');
});

test('pedido-edit.js: NÃO faz .insert() / .delete() / .upsert() em pedidos', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-edit.js: NÃO toca pedido_itens / pedido_eventos / lotes', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"]/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_eventos['"]/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]lotes['"]/);
});

// ---------------------------------------------------------------------
// 7. pedido-edit.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-edit.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
  assert.doesNotMatch(screen, /supabase\/functions/);
  assert.doesNotMatch(screen, /admin-create-user/);
  assert.doesNotMatch(screen, /admin-disable-user/);
  assert.doesNotMatch(screen, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 8. pedido-edit.js não referencia OP/lote/entrega
// ---------------------------------------------------------------------

test('pedido-edit.js: NÃO referencia tabelas de OP/lote/entrega', () => {
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

test('pedido-edit.js: NÃO referencia arquivos críticos de OP/Fornecedor', () => {
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
// 9. pedido-edit.js usa isPedidoEditavel de pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-edit.js: usa window.isPedidoEditavel para validar status', () => {
  assert.match(screen, /window\.isPedidoEditavel/,
    'deve usar window.isPedidoEditavel para validar status editável');
});

test('pedido-ui.js: expõe isPedidoEditavel e PEDIDO_STATUS_EDITAVEL', () => {
  // O helper deve ser carregado em pedido-ui.js.
  assert.match(helper, /PEDIDO_STATUS_EDITAVEL\s*[=:]/,
    'PEDIDO_STATUS_EDITAVEL deve estar definido em pedido-ui.js');
  assert.match(helper, /function\s+isPedidoEditavel/,
    'function isPedidoEditavel deve estar definida em pedido-ui.js');
  // Deve ser exposto como global bare para compatibilidade.
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(helper, sandbox);
  assert.equal(typeof sandbox.window.isPedidoEditavel, 'function',
    'isPedidoEditavel deve estar exposto como global bare');
  // Comportamento básico:
  assert.equal(sandbox.window.isPedidoEditavel('rascunho'), true);
  assert.equal(sandbox.window.isPedidoEditavel('recebido'), true);
  assert.equal(sandbox.window.isPedidoEditavel('confirmado'), false);
  assert.equal(sandbox.window.isPedidoEditavel('cancelado'), false);
  assert.equal(sandbox.window.isPedidoEditavel('produzindo'), false);
  assert.equal(sandbox.window.isPedidoEditavel('entregue'), false);
  assert.equal(sandbox.window.isPedidoEditavel(null), false);
  assert.equal(sandbox.window.isPedidoEditavel(undefined), false);
  assert.equal(sandbox.window.isPedidoEditavel(''), false);
});

test('pedido-edit.js: bloqueia salvamento se status não for editável', () => {
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
// 10. pedido-edit.js navega de volta para o detalhe após sucesso
// ---------------------------------------------------------------------

test('pedido-edit.js: navega de volta para #/pedidos/<uuid> após sucesso', () => {
  // Após o update bem-sucedido, deve navegar para o detalhe.
  assert.match(screen, /window\.navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\)/,
    'deve navegar para "#/pedidos/" + pedidoId após sucesso');
});

test('pedido-edit.js: tem botão Cancelar que volta para o detalhe', () => {
  // O botão Cancelar do form deve navegar para o detalhe, não para a lista.
  assert.match(screen, /navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\)/,
    'botão Cancelar deve navegar para "#/pedidos/" + pedidoId');
});

// ---------------------------------------------------------------------
// 11. pedido-edit.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-edit.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(screen, /CREATE\s+POLICY/i);
  assert.doesNotMatch(screen, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(screen, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 12. pedido-edit.js não tem token público / service_role
// ---------------------------------------------------------------------

test('pedido-edit.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

test('pedido-edit.js: NÃO contém service_role / SUPERUSER', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(co, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 13. pedido-edit.js não cria rota pública de cliente
// ---------------------------------------------------------------------

test('pedido-edit.js: NÃO cria rota pública de cliente (sem public: true)', () => {
  assert.doesNotMatch(screen, /public\s*:\s*true/);
  assert.doesNotMatch(screen, /['"]#\/cliente/);
  assert.doesNotMatch(screen, /setRoutes/);
  assert.doesNotMatch(screen, /window\.RAVATEX_ROUTER\.setRoutes/);
});

// ---------------------------------------------------------------------
// 14. pedido-edit.js usa helper pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-edit.js: usa window.pedidoStatusBadge para badge de status', () => {
  assert.match(screen, /window\.pedidoStatusBadge/);
});

test('pedido-edit.js: usa window.pedidoStatusLabel para label de status', () => {
  assert.match(screen, /window\.pedidoStatusLabel/);
});

test('pedido-edit.js: usa formField / selectInput / textInput do ui.js', () => {
  assert.match(screen, /window\.formField/);
  assert.match(screen, /window\.selectInput/);
  assert.match(screen, /window\.textInput/);
});

// ---------------------------------------------------------------------
// 15. pedido-detail.js → botão Editar funcional por status
// ---------------------------------------------------------------------

test('pedido-detail.js: botão Editar abre fluxo que navega para screenPedidoEditar', () => {
  // C3C1: o detalhe pode intermediar a edição com aviso/modal antes de
  // navegar para `#/pedidos/<id>/editar`.
  assert.match(detailBundle, /openEditWarning\(\s*['"]dados['"]\s*\)/,
    'botão Editar no detalhe deve abrir o fluxo de edição dos dados');
  assert.match(detailBundle, /['"]#\/pedidos\/['"]\s*\+\s*pedidoId\s*\+\s*['"]\/editar['"]/,
    'fluxo de edição no detalhe deve navegar para "#/pedidos/<id>/editar"');
});

test('pedido-detail.js: usa window.isPedidoEditavel para decidir Editar', () => {
  // C3C1: o detalhe deve usar isPedidoEditavel para controlar se o
  // botão Editar é funcional ou placeholder.
  assert.match(detailBundle, /window\.isPedidoEditavel/,
    'pedido-detail.js deve usar window.isPedidoEditavel');
});

// ---------------------------------------------------------------------
// 16. Schema 13_* não foi alterado por esta fase
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C3C1', () => {
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});
