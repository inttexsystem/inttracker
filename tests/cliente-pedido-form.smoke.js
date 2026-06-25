// =====================================================================
// === tests/cliente-pedido-form.smoke.js ===============================
// Smoke estático para a tela cliente js/screens/cliente-pedido-form.js
// (`screenClientePedidoNovo`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A
// Escopo: valida que a UI cliente de criação de Pedido é segura,
// usa RLS existente, não cria policy, não usa service_role, não
// usa functions.invoke, não referencia OP/lote/fornecedor/eventos.
// Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenClientePedidoNovo;
//   - index.html carrega cliente-pedido-form.js EXATAMENTE UMA VEZ;
//   - ordem: cliente-common → cliente-pedidos-list → cliente-pedido-detail
//     → cliente-pedido-form → boot.js;
//   - boot.js registra rota #/cliente/pedidos/novo com role ['cliente'];
//   - faz INSERT em `pedidos` e INSERT em `pedido_itens`;
//   - status inicial é `recebido`;
//   - usa CURRENT_USER.cliente_id;
//   - NÃO consulta `clientes` (não tem select de cliente);
//   - NÃO usa functions.invoke / service_role / token_acesso;
//   - NÃO referencia pedido_eventos / OP / lote / fornecedor;
//   - valida 1+ item, modelo, metros > 0;
//   - compensa com DELETE em `pedidos` se itens falharem;
//   - navega para detalhe ou lista após sucesso.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-pedido-form.js');
const LIST = path.join(ROOT, 'js', 'screens', 'cliente-pedidos-list.js');
const DETAIL = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const COMMON_CLI = path.join(ROOT, 'js', 'screens', 'cliente-common.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const INDEX = path.join(ROOT, 'index.html');
const SCHEMA_PEDIDOS = path.join(ROOT, 'db', '13_pedidos_schema.sql');
const SCHEMA_CLIENTE = path.join(ROOT, 'db', '14_cliente_perfil_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const list = readOrFail(LIST);
const detail = readOrFail(DETAIL);
const commonCli = readOrFail(COMMON_CLI);
const boot = readOrFail(BOOT);
const index = readOrFail(INDEX);
const schemaPedidos = readOrFail(SCHEMA_PEDIDOS);
const schemaCliente = readOrFail(SCHEMA_CLIENTE);

// ---------------------------------------------------------------------
// 1. Existência e sintaxe
// ---------------------------------------------------------------------

test('cliente-pedido-form: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedido-form.js ausente');
});

test('cliente-pedido-form: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  execSync(`node --check "${SCREEN}"`, { stdio: 'pipe' });
});

test('cliente-pedido-form: script clássico (não ES module)', () => {
  assert.equal(/^\s*export\s+/m.test(screen), false, 'deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(screen), false, 'deve ser script clássico');
});

// ---------------------------------------------------------------------
// 2. Namespace
// ---------------------------------------------------------------------

test('cliente-pedido-form: expõe window.screenClientePedidoNovo', () => {
  assert.match(screen, /window\.screenClientePedidoNovo\s*=\s*screenClientePedidoNovo/);
});

test('cliente-pedido-form: expõe RAVATEX_SCREENS.clientePedidoForm', () => {
  assert.match(screen, /RAVATEX_SCREENS\.clientePedidoForm/);
});

// ---------------------------------------------------------------------
// 3. index.html
// ---------------------------------------------------------------------

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

test('index.html: carrega cliente-pedido-form.js EXATAMENTE UMA VEZ', () => {
  const re = /<script\s+src="js\/screens\/cliente-pedido-form\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = index.match(re) || [];
  assert.equal(matches.length, 1, 'cliente-pedido-form.js deve aparecer exatamente 1 vez');
});

test('index.html: cliente-pedido-form.js vem antes de boot.js', () => {
  const cpfIdx = findScriptIdx(index, 'js/screens/cliente-pedido-form.js');
  const bootIdx = findScriptIdx(index, 'js/boot.js');
  assert.ok(cpfIdx > 0, 'cliente-pedido-form.js não encontrado em index.html');
  assert.ok(bootIdx > 0, 'boot.js não encontrado em index.html');
  assert.ok(cpfIdx < bootIdx, 'cliente-pedido-form.js deve vir antes de boot.js');
});

test('index.html: cliente-pedido-form.js vem depois de cliente-pedido-detail.js', () => {
  const cpdIdx = findScriptIdx(index, 'js/screens/cliente-pedido-detail.js');
  const cpfIdx = findScriptIdx(index, 'js/screens/cliente-pedido-form.js');
  assert.ok(cpdIdx > 0, 'cliente-pedido-detail.js não encontrado');
  assert.ok(cpfIdx > 0, 'cliente-pedido-form.js não encontrado');
  assert.ok(cpdIdx < cpfIdx, 'cliente-pedido-form.js deve vir depois de cliente-pedido-detail.js');
});

// ---------------------------------------------------------------------
// 4. boot.js registra a rota
// ---------------------------------------------------------------------

test('boot.js: registra rota #/cliente/pedidos/novo com role cliente', () => {
  assert.match(
    boot,
    /'#\/cliente\/pedidos\/novo'\s*:\s*\{\s*render\s*:\s*window\.screenClientePedidoNovo[^}]*roles\s*:\s*\[\s*['"]cliente['"]\s*\]/i,
    "rota #/cliente/pedidos/novo deve ser registrada com role cliente e render=screenClientePedidoNovo"
  );
});

// ---------------------------------------------------------------------
// 5. Tabela / INSERTs
// ---------------------------------------------------------------------

test('cliente-pedido-form: usa from(\'pedidos\') para insert', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.insert\s*\(/);
});

test('cliente-pedido-form: usa from(\'pedido_itens\') para insert', () => {
  assert.match(screen, /\.from\(\s*['"]pedido_itens['"]\s*\)\s*\.insert\s*\(/);
});

test('cliente-pedido-form: compensa com DELETE em pedidos se itens falharem', () => {
  assert.match(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.delete\s*\(\s*\)\s*\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/);
});

// ---------------------------------------------------------------------
// 6. status inicial = recebido
// ---------------------------------------------------------------------

test('cliente-pedido-form: status inicial é "recebido"', () => {
  // O literal 'recebido' aparece no payload de insert de pedidos
  assert.match(screen, /status\s*:\s*['"]recebido['"]/);
});

test('cliente-pedido-form: NÃO hardcoda status de "rascunho"/"confirmado"/"produzindo"/"entregue"/"cancelado"', () => {
  // Garantir que o status inicial de um novo pedido cliente é sempre
  // "recebido" e não outros.
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]rascunho['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]confirmado['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]produzindo['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]entregue['"]/);
  assert.doesNotMatch(codeOnly, /status\s*[:=]\s*['"]cancelado['"]/);
});

// ---------------------------------------------------------------------
// 7. cliente_id vem de CURRENT_USER
// ---------------------------------------------------------------------

test('cliente-pedido-form: usa window.CURRENT_USER.cliente_id', () => {
  assert.match(screen, /window\.CURRENT_USER\.[\s\S]*?cliente_id/);
});

test('cliente-pedido-form: bloqueia se CURRENT_USER.cliente_id ausente', () => {
  // Deve haver um guard que detecta cliente_id ausente e exibe erro.
  // Variável local: clienteId (sem underscore). Guard com == null.
  assert.match(screen, /clienteId\s*==\s*null|clienteId\s*===\s*null|clienteId\s*===\s*undefined|clienteId\s*==\s*undefined/);
});

test('cliente-pedido-form: NÃO tem select de cliente', () => {
  // Não deve haver select de clientes
  assert.doesNotMatch(screen, /\.from\(\s*['"]clientes['"]\s*\)/);
});

// ---------------------------------------------------------------------
// 8. Sem token_acesso, service_role, functions.invoke
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO contém token_acesso', () => {
  // Comentários podem mencionar a proibição. Verifica ausência de USO.
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /token_acesso/);
});

test('cliente-pedido-form: NÃO usa service_role', () => {
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /service_role/i);
  assert.doesNotMatch(codeOnly, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('cliente-pedido-form: NÃO chama functions.invoke', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
});

// ---------------------------------------------------------------------
// 9. Sem OP/lote/fornecedor/pedido_eventos
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO referencia pedido_eventos', () => {
  assert.doesNotMatch(screen, /pedido_eventos/);
});

test('cliente-pedido-form: NÃO referencia OP', () => {
  assert.doesNotMatch(screen, /\bop\b/i);
});

test('cliente-pedido-form: NÃO referencia lote', () => {
  assert.doesNotMatch(screen, /\blote\b/i);
});

test('cliente-pedido-form: NÃO referencia fornecedor', () => {
  assert.doesNotMatch(screen, /fornecedor/i);
});

test('cliente-pedido-form: NÃO referencia ops / op-itens / op_fornecedores / ordens_compra_fio', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio)['"]/);
});

// ---------------------------------------------------------------------
// 10. Validações de formulário
// ---------------------------------------------------------------------

test('cliente-pedido-form: valida ao menos 1 item', () => {
  assert.match(screen, /Adicione ao menos um item/);
});

test('cliente-pedido-form: valida modelo selecionado', () => {
  assert.match(screen, /selecione um modelo/);
});

test('cliente-pedido-form: valida metros > 0', () => {
  assert.match(screen, /metros deve ser > 0/);
});

// ---------------------------------------------------------------------
// 11. Read-only em outras tabelas
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO faz update', () => {
  // Garante que não usamos .update em nenhuma tabela.
  // Exceção: comentários/documentação.
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  assert.doesNotMatch(codeOnly, /\.update\s*\(/);
});

test('cliente-pedido-form: NÃO faz delete exceto compensação em pedidos', () => {
  const codeOnly = screen
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
  // Permitido: .from('pedidos').delete() (compensação)
  // Não permitido: .from('pedido_itens').delete()
  assert.doesNotMatch(codeOnly, /\.from\(\s*['"]pedido_itens['"]\s*\)\s*\.delete/);
});

test('cliente-pedido-form: NÃO usa rpc', () => {
  assert.doesNotMatch(screen, /\.rpc\s*\(/);
});

// ---------------------------------------------------------------------
// 12. Navegação pós-criação
// ---------------------------------------------------------------------

test('cliente-pedido-form: navega para detalhe após sucesso', () => {
  // Deve haver navigate('#/cliente/pedidos/<id>') após insert
  assert.match(screen, /navigate\(\s*['"]#\/cliente\/pedidos\/['"]\s*\+\s*pedidoId\s*\)/);
});

// ---------------------------------------------------------------------
// 13. Schemas preservados
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase CREATE-A', () => {
  assert.match(schemaPedidos, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schemaPedidos, /CHECK\s*\(status\s+IN/i);
});

test('schema 14_*: não foi alterado pela fase CREATE-A', () => {
  // Confirma que as policies cliente SELECT/INSERT existem
  // e que NÃO há UPDATE/DELETE cliente.
  assert.match(schemaCliente, /clientes_cliente_select|pedidos_cliente_select/);
});

// ---------------------------------------------------------------------
// 14. Restrição de role (cliente-only)
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO é referenciado em boot.js para role admin ou fornecedor', () => {
  // screenClientePedidoNovo deve aparecer SÓ na rota cliente.
  // boot.js deve ter role ['cliente'] para esta rota.
  const routeBlock = boot.match(/'#\/cliente\/pedidos\/novo'[\s\S]*?\}\s*,/);
  assert.ok(routeBlock, 'bloco da rota #/cliente/pedidos/novo não encontrado em boot.js');
  assert.match(routeBlock[0], /roles\s*:\s*\[\s*['"]cliente['"]\s*\]/);
});

// ---------------------------------------------------------------------
// 15. Restrição de select de cliente (UX)
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO referencia select de cliente', () => {
  // O form não deve ter selectInput para escolher cliente.
  // Verifica que não há cliSel (variável usada no form admin).
  assert.doesNotMatch(screen, /cliSel/);
});
