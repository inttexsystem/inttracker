// =====================================================================
// === tests/cliente-dashboard.smoke.js ================================
// Smoke estático do Dashboard Cliente read-only (#/cliente/dashboard).
//
// Fase: RAVATEX-TAPETES-CLIENTE-DASHBOARD-A
// Garante:
//   - módulo js/screens/cliente-dashboard.js existe e é script clássico;
//   - rota #/cliente/dashboard registrada (role cliente);
//   - menu cliente inclui "Início" (preserva "Meus pedidos");
//   - SELECT explícito em pedidos, apenas campos permitidos;
//   - sem select('*');
//   - pedido_cliente_eventos lido apenas com colunas seguras;
//   - não expõe metadata/criado_por/origem;
//   - não consulta a tabela interna pedido_eventos;
//   - usa a taxonomia compartilhada window.RavatexPedidoTracking;
//   - renderiza KPIs, pedidos recentes e últimas atualizações/empty;
//   - read-only (sem insert/update/delete/rpc/functions.invoke);
//   - sem service_role;
//   - não expõe OP/lote/fornecedor/NF/romaneio/custo/margem;
//   - não altera admin nem fornecedor.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-dashboard.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const COMMON_CLI = path.join(ROOT, 'js', 'screens', 'cliente-common.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const boot = readOrFail(BOOT);
const commonCli = readOrFail(COMMON_CLI);
const index = readOrFail(INDEX);

const PEDIDOS_ALLOWED = [
  'id', 'numero', 'status',
  'status_cliente_visual', 'status_cliente_excecao',
  'status_cliente_mensagem', 'status_cliente_atualizado_em',
  'prazo_entrega', 'prazo_desejado', 'tipo_recebimento',
  'criado_em', 'atualizado_em',
];

function pedidosSelect() {
  const m = screen.match(/\.from\(['"]pedidos['"]\)\s*\.select\(\s*['"]([^'"]*)['"]\s*\)/);
  assert.ok(m, 'select de pedidos nao encontrado');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

function eventosSelect() {
  const m = screen.match(/\.from\(['"]pedido_cliente_eventos['"]\)\s*\.select\(\s*['"]([^'"]*)['"]\s*\)/);
  assert.ok(m, 'select de pedido_cliente_eventos nao encontrado');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------
// Arquivo / módulo
// ---------------------------------------------------------------------

test('cliente-dashboard: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-dashboard.js ausente');
});

test('cliente-dashboard: sintaxe JS valida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('cliente-dashboard: script classico (nao ES module)', () => {
  assert.equal(/^\s*export\s+/m.test(screen), false);
  assert.equal(/import\s+.*\s+from\s+/.test(screen), false);
});

test('cliente-dashboard: expoe window.screenClienteDashboard', () => {
  assert.match(screen, /window\.screenClienteDashboard\s*=\s*screenClienteDashboard/);
});

test('cliente-dashboard: expoe RAVATEX_SCREENS.clienteDashboard', () => {
  assert.match(screen, /RAVATEX_SCREENS\.clienteDashboard/);
});

test('cliente-dashboard: carregado em index.html', () => {
  assert.match(index, /js\/screens\/cliente-dashboard\.js/);
});

// ---------------------------------------------------------------------
// Rota / menu
// ---------------------------------------------------------------------

test('boot.js: registra rota #/cliente/dashboard com role cliente', () => {
  assert.match(
    boot,
    /'#\/cliente\/dashboard'\s*:\s*\{\s*render\s*:\s*window\.screenClienteDashboard[^}]*roles\s*:\s*\[\s*['"]cliente['"]\s*\]/i,
    'rota #/cliente/dashboard deve ser registrada com role cliente'
  );
});

test('boot.js: preserva rota #/cliente/pedidos', () => {
  assert.match(boot, /'#\/cliente\/pedidos'\s*:/);
  assert.match(boot, /'#\/cliente\/pedidos\/novo'\s*:/);
});

test('cliente-common: menu inclui "Início"', () => {
  assert.match(commonCli, /label:\s*['"]Início['"]/);
  assert.match(commonCli, /href:\s*['"]#\/cliente\/dashboard['"]/);
});

test('cliente-common: menu preserva "Meus pedidos"', () => {
  assert.match(commonCli, /label:\s*['"]Meus pedidos['"]/);
});

// ---------------------------------------------------------------------
// Dados de pedidos — SELECT explicito e campos permitidos
// ---------------------------------------------------------------------

test('cliente-dashboard: consulta from(\'pedidos\')', () => {
  assert.match(screen, /from\(['"]pedidos['"]\)/);
});

test('cliente-dashboard: usa SELECT explicito em pedidos (sem select(*))', () => {
  assert.doesNotMatch(screen, /\.select\(\s*['"]\*['"]\s*\)/);
});

test('cliente-dashboard: pedidos seleciona apenas campos permitidos', () => {
  const cols = pedidosSelect();
  for (const c of cols) {
    assert.ok(PEDIDOS_ALLOWED.includes(c), 'campo nao permitido no select de pedidos: ' + c);
  }
});

test('cliente-dashboard: pedidos seleciona status_cliente_visual e prazos', () => {
  const cols = pedidosSelect();
  assert.ok(cols.includes('status_cliente_visual'));
  assert.ok(cols.includes('prazo_entrega'));
  assert.ok(cols.includes('numero'));
});

test('cliente-dashboard: nao expoe cliente_id no select de pedidos', () => {
  assert.equal(pedidosSelect().includes('cliente_id'), false);
});

// ---------------------------------------------------------------------
// Dados de eventos — pedido_cliente_eventos, colunas seguras
// ---------------------------------------------------------------------

test('cliente-dashboard: consulta from(\'pedido_cliente_eventos\')', () => {
  assert.match(screen, /from\(['"]pedido_cliente_eventos['"]\)/);
});

test('cliente-dashboard: eventos com SELECT explicito id, pedido_id, status, titulo, mensagem, criado_em', () => {
  assert.match(
    screen,
    /\.select\(\s*['"]id,\s*pedido_id,\s*status,\s*titulo,\s*mensagem,\s*criado_em['"]\s*\)/
  );
});

test('cliente-dashboard: eventos ordenados por criado_em desc', () => {
  const idx = screen.indexOf("from('pedido_cliente_eventos')");
  assert.ok(idx !== -1);
  const trecho = screen.slice(idx, idx + 300);
  assert.match(trecho, /\.order\(['"]criado_em['"]\s*,\s*\{\s*ascending:\s*false\s*\}\)/);
});

test('cliente-dashboard: eventos nao selecionam metadata/criado_por/origem', () => {
  const cols = eventosSelect();
  assert.equal(cols.includes('metadata'), false);
  assert.equal(cols.includes('criado_por'), false);
  assert.equal(cols.includes('origem'), false);
});

test('cliente-dashboard: nao referencia metadata/criado_por/origem em lugar nenhum', () => {
  assert.equal(/metadata/.test(screen), false);
  assert.equal(/criado_por/.test(screen), false);
  assert.equal(/origem/.test(screen), false);
});

test('cliente-dashboard: nao consulta a tabela interna pedido_eventos', () => {
  assert.equal(/from\(['"]pedido_eventos['"]\)/.test(screen), false);
});

// ---------------------------------------------------------------------
// Taxonomia compartilhada / render
// ---------------------------------------------------------------------

test('cliente-dashboard: usa window.RavatexPedidoTracking', () => {
  assert.match(screen, /RavatexPedidoTracking/);
});

test('cliente-dashboard: usa window.clienteShellLayout (sem ADMIN_MENU)', () => {
  assert.match(screen, /window\.clienteShellLayout/);
  assert.equal(/ADMIN_MENU/.test(screen), false);
});

test('cliente-dashboard: renderiza cards/KPIs', () => {
  assert.match(screen, /Pedidos em aberto/);
  assert.match(screen, /Em andamento/);
  assert.match(screen, /Prontos/);
  assert.match(screen, /Atualizações recentes/);
});

test('cliente-dashboard: renderiza pedidos recentes com "Ver pedido"', () => {
  assert.match(screen, /Pedidos recentes/);
  assert.match(screen, /Ver pedido/);
});

test('cliente-dashboard: renderiza ultimas atualizacoes com empty state', () => {
  assert.match(screen, /Últimas atualizações/);
  assert.match(screen, /Suas atualizações aparecerão aqui\./);
});

// ---------------------------------------------------------------------
// Read-only / seguranca
// ---------------------------------------------------------------------

test('cliente-dashboard: nao faz insert/update/delete', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false);
  assert.equal(/\.update\s*\(/.test(screen), false);
  assert.equal(/\.delete\s*\(/.test(screen), false);
});

test('cliente-dashboard: nao usa rpc nem functions.invoke', () => {
  assert.equal(/\.rpc\s*\(/.test(screen), false);
  assert.equal(/functions\.invoke/.test(screen), false);
});

test('cliente-dashboard: nao referencia service_role nem token_acesso', () => {
  assert.equal(/service_role/.test(screen), false);
  assert.equal(/token_acesso/.test(screen), false);
});

test('cliente-dashboard: nao expoe OP/lote/fornecedor/NF/romaneio/custo/margem', () => {
  assert.equal(/\bop\b/i.test(screen), false);
  assert.equal(/\blote\b/i.test(screen), false);
  assert.equal(/fornecedor/i.test(screen), false);
  assert.equal(/\bNF\b/.test(screen), false);
  assert.equal(/romaneio/i.test(screen), false);
  assert.equal(/custo/i.test(screen), false);
  assert.equal(/margem/i.test(screen), false);
});

test('cliente-dashboard: nao altera admin (sem UI admin de tracking)', () => {
  assert.equal(/RAVATEX_SCREENS\.pedidoTrackingAdmin/.test(screen), false);
  assert.equal(/buildPedidoTrackingAdminCard/.test(screen), false);
});

test('cliente-dashboard: nao tem acoes de escrita (Editar/Cancelar/Confirmar pedido)', () => {
  assert.equal(/Editar/i.test(screen), false);
  assert.equal(/Cancelar pedido/i.test(screen), false);
  assert.equal(/Confirmar pedido/i.test(screen), false);
});
