// =====================================================================
// === tests/cliente-pedidos-list.smoke.js ==============================
// Smoke estático para a tela cliente js/screens/cliente-pedidos-list.js
// (`screenClientePedidosLista`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A
// Escopo: valida que a UI cliente é read-only, usa RLS, não expõe
// campos internos. Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenClientePedidosLista;
//   - index.html carrega os 3 scripts cliente na ordem correta;
//   - usa from('pedidos') apenas;
//   - NÃO usa from('clientes'), from('usuarios'), from('pedido_eventos'),
//     from('op'), from('lotes');
//   - NÃO referencia token_acesso, service_role, functions.invoke;
//   - NÃO referencia OP, lote, fornecedor;
//   - boot.js registra rota #/cliente/pedidos com role ['cliente'];
//   - CLIENTE_MENU tem apenas "Meus pedidos".
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'cliente-pedidos-list.js');
const COMMON_CLI = path.join(ROOT, 'js', 'screens', 'cliente-common.js');
const DETAIL_CLI = path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const commonCli = readOrFail(COMMON_CLI);
const detailCli = readOrFail(DETAIL_CLI);
const boot = readOrFail(BOOT);
const index = readOrFail(INDEX);

// ---------------------------------------------------------------------
// 1. Existência e sintaxe
// ---------------------------------------------------------------------

test('cliente-pedidos-list: arquivo existe', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/cliente-pedidos-list.js ausente');
});

test('cliente-pedidos-list: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  execSync(`node --check "${SCREEN}"`, { stdio: 'pipe' });
});

test('cliente-pedidos-list: script clássico (não ES module)', () => {
  assert.equal(/^\s*export\s+/m.test(screen), false, 'deve ser script clássico, não ES module');
  assert.equal(/import\s+.*\s+from\s+/.test(screen), false, 'deve ser script clássico, não ES module');
});

// ---------------------------------------------------------------------
// 2. Namespace
// ---------------------------------------------------------------------

test('cliente-pedidos-list: expõe window.screenClientePedidosLista', () => {
  assert.match(screen, /window\.screenClientePedidosLista\s*=\s*screenClientePedidosLista/);
});

test('cliente-pedidos-list: expõe RAVATEX_SCREENS.clientePedidosList', () => {
  assert.match(screen, /window\.RAVATEX_SCREENS\s*=\s*window\.RAVATEX_SCREENS\s*\|\|\s*\{\}/);
  assert.match(screen, /RAVATEX_SCREENS\.clientePedidosList/);
});

// ---------------------------------------------------------------------
// 3. Ordem no index.html
// ---------------------------------------------------------------------

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

test('index.html: carrega cliente-common.js antes de cliente-pedidos-list.js', () => {
  const ccmIdx = findScriptIdx(index, 'js/screens/cliente-common.js');
  const cplIdx = findScriptIdx(index, 'js/screens/cliente-pedidos-list.js');
  assert.ok(ccmIdx > 0, 'cliente-common.js não encontrado em index.html');
  assert.ok(cplIdx > 0, 'cliente-pedidos-list.js não encontrado em index.html');
  assert.ok(ccmIdx < cplIdx, 'cliente-common.js deve vir antes de cliente-pedidos-list.js');
});

test('index.html: carrega cliente-pedidos-list.js antes de cliente-pedido-detail.js', () => {
  const cplIdx = findScriptIdx(index, 'js/screens/cliente-pedidos-list.js');
  const cpdIdx = findScriptIdx(index, 'js/screens/cliente-pedido-detail.js');
  assert.ok(cplIdx > 0, 'cliente-pedidos-list.js não encontrado');
  assert.ok(cpdIdx > 0, 'cliente-pedido-detail.js não encontrado');
  assert.ok(cplIdx < cpdIdx, 'cliente-pedidos-list.js deve vir antes de cliente-pedido-detail.js');
});

test('index.html: todos os scripts cliente EXATAMENTE UMA VEZ cada', () => {
  for (const f of ['js/screens/cliente-common.js', 'js/screens/cliente-pedidos-list.js', 'js/screens/cliente-pedido-detail.js']) {
    const re = new RegExp(`<script\\s+src="${f.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*></script>`, 'g');
    const matches = index.match(re) || [];
    assert.equal(matches.length, 1, `${f} deveria aparecer exatamente 1 vez, encontrado ${matches.length}`);
  }
});

test('index.html: scripts cliente vêm antes de boot.js', () => {
  const cpdIdx = findScriptIdx(index, 'js/screens/cliente-pedido-detail.js');
  const bootIdx = findScriptIdx(index, 'js/boot.js');
  assert.ok(cpdIdx > 0, 'cliente-pedido-detail.js não encontrado');
  assert.ok(bootIdx > 0, 'boot.js não encontrado');
  assert.ok(cpdIdx < bootIdx, 'scripts cliente devem vir antes de boot.js');
});

// ---------------------------------------------------------------------
// 4. RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A — botão "Novo pedido"
// ---------------------------------------------------------------------

test('cliente-pedidos-list: header inclui botão "+ Novo pedido" que navega para #/cliente/pedidos/novo', () => {
  // Garante que o botão foi adicionado e que ele chama navigate com a
  // rota cliente de criação.
  const re = /['"]\+ Novo pedido['"][\s\S]{0,200}navigate\(\s*['"]#\/cliente\/pedidos\/novo['"]\s*\)/;
  assert.match(screen, re, "botão '+ Novo pedido' deve navegar para '#/cliente/pedidos/novo'");
});

// ---------------------------------------------------------------------
// 4. Rotas no boot.js
// ---------------------------------------------------------------------

test('boot.js: registra rota #/cliente/pedidos com role cliente', () => {
  assert.match(boot, /'#\/cliente\/pedidos'/);
  assert.match(boot, /roles:\s*\[['"]cliente['"]\]/);
});

// ---------------------------------------------------------------------
// 5. SELECTs — usa apenas from('pedidos')
// ---------------------------------------------------------------------

test('cliente-pedidos-list: usa from(\'pedidos\')', () => {
  assert.match(screen, /from\(['"]pedidos['"]\)/);
});

test('cliente-pedidos-list: NÃO usa from(\'clientes\')', () => {
  assert.equal(/from\(['"]clientes['"]\)/.test(screen), false, 'não deve usar from("clientes")');
});

test('cliente-pedidos-list: NÃO usa from(\'usuarios\')', () => {
  assert.equal(/from\(['"]usuarios['"]\)/.test(screen), false, 'não deve usar from("usuarios")');
});

test('cliente-pedidos-list: NÃO usa from(\'pedido_eventos\')', () => {
  assert.equal(/from\(['"]pedido_eventos['"]\)/.test(screen), false, 'não deve usar from("pedido_eventos")');
});

test('cliente-pedidos-list: NÃO usa from(\'lotes\')', () => {
  assert.equal(/from\(['"]lotes['"]\)/.test(screen), false, 'não deve usar from("lotes")');
});

test('cliente-pedidos-list: NÃO referencia \'ops\'', () => {
  assert.equal(/from\(['"]ops['"]\)/.test(screen), false, 'não deve usar from("ops")');
});

// ---------------------------------------------------------------------
// 6. Sem token_acesso, service_role, functions.invoke
// ---------------------------------------------------------------------

test('cliente-pedidos-list: NÃO contém token_acesso', () => {
  assert.equal(/token_acesso/.test(screen), false, 'não deve referenciar token_acesso');
});

test('cliente-pedidos-list: NÃO contém service_role', () => {
  assert.equal(/service_role/.test(screen), false, 'não deve referenciar service_role');
});

test('cliente-pedidos-list: NÃO chama functions.invoke', () => {
  assert.equal(/functions\.invoke/.test(screen), false, 'não deve chamar functions.invoke');
});

// ---------------------------------------------------------------------
// 7. Sem OP/lote/fornecedor
// ---------------------------------------------------------------------

test('cliente-pedidos-list: NÃO referencia OP', () => {
  assert.equal(/\bop\b/i.test(screen), false, 'não deve referenciar OP');
});

test('cliente-pedidos-list: NÃO referencia lote', () => {
  assert.equal(/\blote\b/i.test(screen), false, 'não deve referenciar lote');
});

test('cliente-pedidos-list: NÃO referencia fornecedor', () => {
  assert.equal(/fornecedor/i.test(screen), false, 'não deve referenciar fornecedor');
});

// ---------------------------------------------------------------------
// 8. Campos selecionados — apenas comerciais
// ---------------------------------------------------------------------

test('cliente-pedidos-list: select não contém token_acesso', () => {
  assert.equal(/select\(.*token_acesso/.test(screen), false, 'select não deve incluir token_acesso');
});

test('cliente-pedidos-list: select não contém cliente_id (sanitizado)', () => {
  // O select de pedidos na lista cliente NÃO expõe cliente_id para o cliente.
  // O RLS filtra por cliente_id no servidor.
  assert.equal(/select\(.*cliente_id/.test(screen), false, 'select da lista cliente não deve expor cliente_id');
});

test('cliente-pedidos-list: ação Visualizar navega para #/cliente/pedidos/<id>', () => {
  assert.match(screen, /#\/cliente\/pedidos\//, 'ação Visualizar deve navegar para #/cliente/pedidos/<id>');
});

// ---------------------------------------------------------------------
// 9. Read-only (sem insert/update/delete)
// ---------------------------------------------------------------------

test('cliente-pedidos-list: NÃO faz insert', () => {
  assert.equal(/\.insert\s*\(/.test(screen), false, 'não deve fazer insert');
});

test('cliente-pedidos-list: NÃO faz update', () => {
  assert.equal(/\.update\s*\(/.test(screen), false, 'não deve fazer update');
});

test('cliente-pedidos-list: NÃO faz delete', () => {
  assert.equal(/\.delete\s*\(/.test(screen), false, 'não deve fazer delete');
});

test('cliente-pedidos-list: NÃO usa rpc', () => {
  assert.equal(/\.rpc\s*\(/.test(screen), false, 'não deve chamar rpc');
});

// ---------------------------------------------------------------------
// 10. Menu cliente — mínimo, sem admin
// ---------------------------------------------------------------------

test('cliente-common: CLIENTE_MENU contém apenas "Meus pedidos"', () => {
  assert.match(commonCli, /label:\s*['"]Meus pedidos['"]/);
  assert.match(commonCli, /href:\s*['"]#\/cliente\/pedidos['"]/);
});

test('cliente-common: CLIENTE_MENU NÃO contém Painel, OPs, Cadastros, Fornecedores', () => {
  assert.equal(/Painel/.test(commonCli), false, 'CLIENTE_MENU não deve ter Painel');
  assert.equal(/OPs/.test(commonCli), false, 'CLIENTE_MENU não deve ter OPs');
  assert.equal(/Cadastros/.test(commonCli), false, 'CLIENTE_MENU não deve ter Cadastros');
  assert.equal(/Fornecedores/.test(commonCli), false, 'CLIENTE_MENU não deve ter Fornecedores');
  assert.equal(/Usuários/.test(commonCli), false, 'CLIENTE_MENU não deve ter Usuários');
  assert.equal(/Parâmetros/.test(commonCli), false, 'CLIENTE_MENU não deve ter Parâmetros');
  assert.equal(/Produção/.test(commonCli), false, 'CLIENTE_MENU não deve ter Produção');
  assert.equal(/Entregas/.test(commonCli), false, 'CLIENTE_MENU não deve ter Entregas');
});

test('cliente-common: expõe window.CLIENTE_MENU e window.clienteShellLayout', () => {
  assert.match(commonCli, /window\.CLIENTE_MENU\s*=\s*CLIENTE_MENU/);
  assert.match(commonCli, /window\.clienteShellLayout\s*=\s*clienteShellLayout/);
});

// ---------------------------------------------------------------------
// 11. cliente-pedidos-list usa clienteShellLayout, não ADMIN_MENU
// ---------------------------------------------------------------------

test('cliente-pedidos-list: usa window.clienteShellLayout, não shellLayout com ADMIN_MENU', () => {
  assert.match(screen, /window\.clienteShellLayout/);
  assert.equal(/window\.ADMIN_MENU/.test(screen), false, 'não deve usar ADMIN_MENU');
});
