// =====================================================================
// === tests/pedido-detail.smoke.js =====================================
// Smoke estático para a tela admin read-only js/screens/pedido-detail.js
// (`screenPedidoDetalhe`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A
// Escopo: valida que a UI é estritamente read-only, sem edição, sem
// cancelamento, sem transição de status, sem geração de OP, sem lote,
// sem Edge Function, sem token público, sem service_role. Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenPedidoDetalhe e RAVATEX_SCREENS.pedidoDetail;
//   - index.html carrega pedido-detail.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedido-form → pedido-detail → boot;
//   - faz apenas SELECT (não faz insert/update/delete/upsert/rpc);
//   - consulta `pedidos`, `pedido_itens`, `clientes` (via join),
//     `modelos` e `cores`;
//   - usa helper pedido-ui.js para badge/preview/data;
//   - NÃO chama functions.invoke / Edge Function;
//   - NÃO referencia op-nova/op-persistir/op-latex-admin/
//     entrega-writes/entrega-form;
//   - NÃO consulta `lotes` para escrita, NÃO chama `gerar_op_latex`,
//     NÃO chama `criar_lote`;
//   - NÃO cria policy/RLS/GRANT/service_role/token público;
//   - NÃO cria rota pública de cliente (sem `#/cliente` ou similar);
//   - rota dinâmica `#/pedidos/<uuid>` está registrada no matchRoute
//     de js/router.js (apenas roteamento, não criação de rota pública);
//   - actions da tabela de itens não mutam dados (read-only).
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const LIST   = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const FORM   = path.join(ROOT, 'js', 'screens', 'pedido-form.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const list   = readOrFail(LIST);
const helper = readOrFail(HELPER);
const router = readOrFail(ROUTER);
const boot   = readOrFail(BOOT);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('pedido-detail: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-detail.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-detail: sintaxe JS válida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('pedido-detail: expõe screenPedidoDetalhe no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(screen, sandbox);
  assert.equal(typeof sandbox.window.screenPedidoDetalhe, 'function',
    'window.screenPedidoDetalhe deve estar exposto como função');
  assert.ok(sandbox.window.RAVATEX_SCREENS, 'RAVATEX_SCREENS ausente');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoDetail, 'object',
    'window.RAVATEX_SCREENS.pedidoDetail deve ser objeto');
  assert.equal(typeof sandbox.window.RAVATEX_SCREENS.pedidoDetail.screenPedidoDetalhe, 'function',
    'window.RAVATEX_SCREENS.pedidoDetail.screenPedidoDetalhe deve ser função');
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez e na ordem correta
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedido-detail.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedido-detail\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-detail.js deve ser carregado exatamente 1 vez');
});

test('index.html: pedido-detail.js vem antes de boot.js', () => {
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxDetail < idxBoot, 'pedido-detail.js deve vir antes de boot.js');
});

test('index.html: pedido-detail.js vem depois de pedido-ui.js, pedido-form.js e pedidos-list.js', () => {
  const idxHelper = index.indexOf('js/pedido-ui.js');
  const idxList = index.indexOf('js/screens/pedidos-list.js');
  const idxForm = index.indexOf('js/screens/pedido-form.js');
  const idxDetail = index.indexOf('js/screens/pedido-detail.js');
  assert.ok(idxHelper > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxList > 0, 'pedidos-list.js deve estar no <head>');
  assert.ok(idxForm > 0, 'pedido-form.js deve estar no <head>');
  assert.ok(idxDetail > 0, 'pedido-detail.js deve estar no <head>');
  assert.ok(idxHelper < idxDetail, 'pedido-detail.js deve vir depois de pedido-ui.js');
  assert.ok(idxList < idxDetail, 'pedido-detail.js deve vir depois de pedidos-list.js');
  assert.ok(idxForm < idxDetail, 'pedido-detail.js deve vir depois de pedido-form.js');
});

// ---------------------------------------------------------------------
// 4. Router tem match dinâmico para #/pedidos/<uuid> (admin only)
// ---------------------------------------------------------------------

test('router.js: tem match dinâmico para #/pedidos/<uuid> chamando screenPedidoDetalhe', () => {
  // Valida no conteúdo de router.js: deve haver um regex com UUID e a
  // chamada para screenPedidoDetalhe.
  assert.ok(router.includes('#/pedidos/'),
    'router.js deve referenciar #/pedidos/ no matchRoute');
  // Regex literal de UUID presente no router.js (busca como string fixa).
  assert.ok(router.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
    'router.js deve validar formato UUID do id do pedido');
  assert.match(router, /screenPedidoDetalhe/,
    'router.js deve chamar screenPedidoDetalhe no matchRoute');
  // Confirma que o regex de UUID e a chamada estão no mesmo bloco
  // (até 400 chars entre eles).
  const idxRegex = router.indexOf('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  const idxRender = router.indexOf('screenPedidoDetalhe');
  assert.ok(idxRegex > 0, 'regex de UUID deve existir em router.js');
  assert.ok(idxRender > 0, 'chamada screenPedidoDetalhe deve existir em router.js');
  const distancia = Math.abs(idxRender - idxRegex);
  assert.ok(distancia <= 400,
    'regex de UUID e screenPedidoDetalhe devem estar próximos (distância ' + distancia + ' > 400)');
});

test('router.js: rota dinâmica #/pedidos/<uuid> é admin-only', () => {
  // O match dinâmico de pedidos deve ter `roles: ['admin']` próximo.
  assert.match(router, /#\/pedidos\/[\s\S]{0,400}?roles\s*:\s*\[\s*['"]admin['"]\s*\]/,
    'rota dinâmica #/pedidos/<uuid> deve ser admin-only');
});

test('router.js: matchRoute dinâmico #/pedidos/<uuid> NÃO é público', () => {
  // Pega o trecho entre o regex de pedidos e o final da função matchRoute
  // (até 500 chars após o regex).
  const pedidosSlice = router.match(/#\/pedidos\/[\s\S]{0,500}/);
  assert.ok(pedidosSlice, 'trecho do match dinâmico de pedidos não encontrado em router.js');
  assert.doesNotMatch(pedidosSlice[0], /public\s*:\s*true/,
    'rota dinâmica #/pedidos/<uuid> NÃO deve ser pública (sem public: true)');
});

// ---------------------------------------------------------------------
// 5. pedido-detail.js é read-only (sem insert/update/delete em pedidos)
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO faz .insert() / .update() / .delete() / .upsert() em pedidos', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.update\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() / .update() / .delete() em pedido_itens', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.update\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() em pedido_eventos', () => {
  // Eventos de auditoria NÃO são criados pelo detalhe read-only.
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_eventos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_eventos['"]/,
    'pedido-detail.js não deve referenciar pedido_eventos (somente schema)');
});

test('pedido-detail.js: NÃO altera status (não chama .update com status=...)', () => {
  // Defesa extra: nenhum update em pedidos (qualquer campo).
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.update\s*\(/,
    'não deve haver .update() em pedidos no detalhe read-only');
  // E não pode haver string "cancelar" / "cancelado" como mutação (apenas
  // como label de botão placeholder, que é OK). Verificamos ausência de
  // DELETE pedidos, que é o write destrutivo.
  assert.doesNotMatch(codeOnly, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
});

test('pedido-detail.js: usa apenas .select() em pedidos/pedido_itens/clientes/modelos/cores', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,500}\.select\s*\(/);
  // Join aninhado com cliente:cliente_id(id, nome)
  assert.match(screen, /cliente\s*:\s*cliente_id\s*\(/,
    'deve usar join aninhado cliente:cliente_id(...) em pedidos');
  assert.match(screen, /\.from\(\s*['"]modelos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(screen, /\.from\(\s*['"]cores['"][\s\S]{0,500}\.select\s*\(/);
});

// ---------------------------------------------------------------------
// 6. pedido-detail.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
  assert.doesNotMatch(screen, /supabase\/functions/);
  assert.doesNotMatch(screen, /admin-create-user/);
  assert.doesNotMatch(screen, /admin-disable-user/);
  assert.doesNotMatch(screen, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 7. pedido-detail.js não referencia OP/lote/entrega para escrita
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO referencia tabelas de OP/lote/entrega', () => {
  // Não deve consultar tabelas de OP/lote/entrega para escrita.
  assert.doesNotMatch(screen, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens)['"]/);
  // Não chama helpers de geração/operação de OP.
  assert.doesNotMatch(screen, /gerar_op_latex/);
  assert.doesNotMatch(screen, /gerar_op_pedido/);
  assert.doesNotMatch(screen, /criar_lote/);
  assert.doesNotMatch(screen, /persistirOP/);
  assert.doesNotMatch(screen, /aplicarRecalculoOP/);
  // Não mexe em `lotes.pedido_id` para escrita.
  assert.doesNotMatch(screen, /\.from\(\s*['"]lotes['"]/);
});

test('pedido-detail.js: NÃO referencia arquivos críticos de OP', () => {
  assert.doesNotMatch(screen, /op-nova\.js/);
  assert.doesNotMatch(screen, /op-persistir\.js/);
  assert.doesNotMatch(screen, /op-latex-admin\.js/);
  assert.doesNotMatch(screen, /op-recalculo\.js/);
  assert.doesNotMatch(screen, /op-writes\.js/);
  assert.doesNotMatch(screen, /entrega-writes\.js/);
  assert.doesNotMatch(screen, /entrega-form\.js/);
  assert.doesNotMatch(screen, /fornecedor\.js/);
  assert.doesNotMatch(screen, /screenNovaOP/);
  assert.doesNotMatch(screen, /window\.screenNovaOP/);
  assert.doesNotMatch(screen, /renderOPLatexAdmin/);
  assert.doesNotMatch(screen, /screenFornecedor/);
});

// ---------------------------------------------------------------------
// 8. pedido-detail.js usa helper pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-detail.js: usa window.pedidoStatusBadge para badge de status', () => {
  assert.match(screen, /window\.pedidoStatusBadge/);
});

test('pedido-detail.js: usa window.corPreviewElement para preview 48x48', () => {
  assert.match(screen, /window\.corPreviewElement/);
});

test('pedido-detail.js: usa window.fmtDataCurta para datas', () => {
  assert.match(screen, /window\.fmtDataCurta/);
});

test('pedido-detail.js: usa window.pedidoStatusLabel ou namespace RAVATEX_PEDIDO_UI', () => {
  const usaHelper = /window\.pedidoStatusLabel|window\.RAVATEX_PEDIDO_UI|window\.corPreviewHex|window\.pedidoStatusBadge|window\.corPreviewElement|window\.fmtDataCurta|window\.pedidoStatusTodos/.test(screen);
  assert.ok(usaHelper, 'detalhe deve consumir helpers de js/pedido-ui.js');
});

// ---------------------------------------------------------------------
// 9. pedido-detail.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(screen, /CREATE\s+POLICY/i);
  assert.doesNotMatch(screen, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(screen, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 10. pedido-detail.js não tem token público / service_role
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

test('pedido-detail.js: NÃO contém service_role / SUPERUSER', () => {
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(codeOnly, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 11. pedido-detail.js não cria rota pública de cliente
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria rota pública de cliente (sem public: true)', () => {
  // Nenhuma definição de rota com public: true em pedido-detail.js.
  assert.doesNotMatch(screen, /public\s*:\s*true/);
  // Nenhum registro de rota `#/cliente` (acesso público por token seria
  // desnecessário nesta fase e está proibido).
  assert.doesNotMatch(screen, /['"]#\/cliente/);
  assert.doesNotMatch(screen, /['"]#\/pedido\/[^'"]+['"]\s*:\s*\{\s*public\s*:\s*true/);
});

test('pedido-detail.js: NÃO usa hash para acesso público', () => {
  // Defesa extra: nenhuma rota com prefixo público/cliente.
  // Esta rota é resolvida via matchRoute dinâmico do router (admin-only).
  // O arquivo de tela não deve registrar rotas por conta própria.
  assert.doesNotMatch(screen, /setRoutes/);
  assert.doesNotMatch(screen, /window\.RAVATEX_ROUTER\.setRoutes/);
});

// ---------------------------------------------------------------------
// 12. pedido-detail.js tem botões placeholder desabilitados
// ---------------------------------------------------------------------

test('pedido-detail.js: botões Editar/Cancelar/Receber são placeholder desabilitados', () => {
  // Não devem ser botões funcionais: devem ter `disabled` no atributo
  // e/ou classe "cursor-not-allowed" e/ou texto indicativo "em breve".
  assert.match(screen, /Editar/);
  assert.match(screen, /Cancelar pedido|Cancelar/);
  assert.match(screen, /Confirmar|Receber/);
  // Pelo menos um botão desabilitado (representa o placeholder).
  assert.match(screen, /disabled\s*:\s*['"]disabled['"]/,
    'pelo menos um botão placeholder deve estar desabilitado');
  // Título indicativo de "em breve" para acessibilidade.
  assert.match(screen, /title\s*:\s*['"]Em breve['"]/,
    'pelo menos um botão placeholder deve ter title="Em breve"');
});

test('pedido-detail.js: botão Voltar (← Voltar para lista) é funcional', () => {
  // O botão Voltar DEVE chamar navigate('#/pedidos') (não é placeholder).
  assert.match(screen, /window\.navigate\(\s*['"]#\/pedidos['"]/);
  assert.match(screen, /←\s*Voltar para lista|Voltar para lista/);
});

// ---------------------------------------------------------------------
// 13. Schema 13_* não foi alterado por esta fase
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C3A', () => {
  // Estrutura esperada mantida.
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  // RLS continua admin-only.
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

// ---------------------------------------------------------------------
// 14. Não mexe em arquivos proibidos
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO referencia cadastros.js (escopo separado)', () => {
  assert.doesNotMatch(screen, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});
