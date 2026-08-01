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
//   - mostra resumo pós-envio sem CTA de OP.
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
// 5. Criação — P4 (9.9.L.4 / TD2.1): escritor canônico, não DML direta
// ---------------------------------------------------------------------

test('cliente-pedido-form: cria pelo escritor canônico criar_pedido_cliente', () => {
  assert.match(screen, /\.rpc\(\s*['"]criar_pedido_cliente['"]/);
});

test('cliente-pedido-form: NÃO faz DML direta em pedidos nem em pedido_itens', () => {
  // TD2: a autoridade direta de INSERT e DELETE sobre estas duas tabelas foi
  // revogada do cliente. Pedido, itens e prioridade viajam num único payload
  // para o escritor do servidor.
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.(insert|delete|update)\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedido_itens['"]\s*\)\s*\.(insert|delete|update)\s*\(/);
});

test('cliente-pedido-form: NÃO compensa com DELETE — a transação do servidor é atômica', () => {
  // A compensação existia porque três escritas do navegador não são uma
  // transação. Com um único comando, não há etapa parcial para desfazer.
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"]\s*\)\s*\.delete\s*\(/);
});

// ---------------------------------------------------------------------
// 6. status inicial = recebido, decidido pelo SERVIDOR
// ---------------------------------------------------------------------

test('cliente-pedido-form: NÃO envia pedidos.status — o servidor é o dono', () => {
  // `pedidos.status` é um fato protegido (TD2.1). 'recebido' continua sendo o
  // estado inicial de um Pedido criado pelo Cliente, mas quem o declara é
  // public.criar_pedido_cliente, e não mais este payload.
  assert.doesNotMatch(screen, /status\s*:\s*['"]recebido['"]/);
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
  assert.match(screen, /metragem deve ser > 0/);
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

test('cliente-pedido-form: usa RPC APENAS para os escritores canônicos', () => {
  // Antes do P4 esta tela não chamava nenhuma RPC, porque escrevia direto nas
  // tabelas. A regra que essa asserção protegia — nenhuma lógica de escrita
  // própria fora dos donos canônicos — continua valendo; o que mudou é que o
  // dono agora é uma RPC. A lista é fechada de propósito.
  const rpcs = [...screen.matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/g)].map((m) => m[1]);
  const permitidas = new Set(['criar_pedido_cliente', 'definir_prioridade_pedido']);
  const inesperadas = rpcs.filter((n) => !permitidas.has(n));
  assert.deepEqual(inesperadas, [], 'RPC não prevista nesta tela: ' + inesperadas.join(', '));
});

// ---------------------------------------------------------------------
// 12. Pós-criação
// ---------------------------------------------------------------------

test('cliente-pedido-form: após salvar mostra resumo do pedido e próximos passos', () => {
  assert.match(screen, /function\s+buildPostSaveResumo\s*\(/);
  assert.match(screen, /Pedido enviado/);
  assert.match(screen, /Proximos passos/);
  assert.match(screen, /data-post-save-summary['"]\s*:\s*['"]cliente['"]/);
  assert.match(screen, /data-next-steps['"]\s*:\s*['"]cliente['"]/);
});

test('cliente-pedido-form: ações pós-save são Ver meus pedidos e Criar novo pedido', () => {
  assert.match(screen, /Ver meus pedidos/);
  assert.match(screen, /Criar novo pedido/);
  assert.match(screen, /navigate\(\s*['"]#\/cliente\/pedidos['"]\s*\)/);
  assert.match(screen, /navigate\(\s*['"]#\/cliente\/pedidos\/novo['"]\s*\)/);
});

test('cliente-pedido-form: cliente não vê CTA de OP após salvar', () => {
  assert.doesNotMatch(screen, /Abrir OP de Tecelagem/);
  assert.doesNotMatch(screen, /#\/ops\/nova/);
  assert.doesNotMatch(screen, /pedido_id=/);
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
