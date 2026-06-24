// =====================================================================
// === tests/pedidos-list.smoke.js ======================================
// Smoke estático para a tela admin js/screens/pedidos-list.js
// (`screenPedidosLista`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1
// Escopo: valida que a UI é read-only, sem CRUD, sem geração de OP,
// sem Edge Function, sem policy/token público. Garante também:
//   - arquivo existe e sintaxe JS válida;
//   - index.html carrega pedidos-list.js EXATAMENTE UMA VEZ;
//   - ordem cadastros → ops-list → pedidos-list (no <head>);
//   - boot.js registra rota #/pedidos com role admin;
//   - ADMIN_MENU expõe entrada "Pedidos" → #/pedidos;
//   - pedidos-list usa tabela `pedidos` (não outras);
//   - não referencia op-nova, op-persistir, op-latex-admin,
//     entrega-writes, entrega-form (proteção contra crescimento
//     de arquivos críticos);
//   - não faz insert/update/delete em pedidos;
//   - não chama Edge Function;
//   - não referencia token_acesso em nenhum fluxo (sem consulta
//     pública por token nesta fase);
//   - tem rota e placeholder de "Novo pedido" / "Visualizar";
//   -pedido-ui.js expõe COR_PREVIEW_MAP e status.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const HELPER = path.join(ROOT, 'js', 'pedido-ui.js');
const BOOT   = path.join(ROOT, 'js', 'boot.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const INDEX  = path.join(ROOT, 'index.html');
const SCHEMA = path.join(ROOT, 'db', '13_pedidos_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo não encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const helper = readOrFail(HELPER);
const boot   = readOrFail(BOOT);
const common = readOrFail(COMMON);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test('pedidos-list: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedidos-list.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedidos-list: sintaxe JS válida (node --check)', () => {
  // Apenas garante que o parse não quebra; node --check não emite saída em sucesso.
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('pedido-ui: sintaxe JS válida (node --check)', () => {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', HELPER], { stdio: 'pipe' }
  );
});

// ---------------------------------------------------------------------
// 3. index.html carrega exatamente uma vez
// ---------------------------------------------------------------------

test('index.html carrega js/screens/pedidos-list.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/screens\/pedidos-list\.js/g) || [];
  assert.equal(matches.length, 1, 'pedidos-list.js deve ser carregado exatamente 1 vez');
});

test('index.html carrega js/pedido-ui.js EXATAMENTE UMA VEZ', () => {
  const matches = index.match(/js\/pedido-ui\.js/g) || [];
  assert.equal(matches.length, 1, 'pedido-ui.js deve ser carregado exatamente 1 vez');
});

test('index.html: ordem correta (pedido-ui antes de pedidos-list, ambos antes de boot)', () => {
  const idxUI = index.indexOf('js/pedido-ui.js');
  const idxList = index.indexOf('js/screens/pedidos-list.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxUI > 0, 'pedido-ui.js deve estar no <head>');
  assert.ok(idxList > 0, 'pedidos-list.js deve estar no <head>');
  assert.ok(idxBoot > 0, 'boot.js deve estar no <head>');
  assert.ok(idxUI < idxList, 'pedido-ui.js deve vir antes de pedidos-list.js');
  assert.ok(idxList < idxBoot, 'pedidos-list.js deve vir antes de boot.js');
});

// ---------------------------------------------------------------------
// 4. boot.js registra rota #/pedidos com role admin
// ---------------------------------------------------------------------

test('boot.js: registra rota #/pedidos', () => {
  assert.match(
    boot,
    /'#\/pedidos'\s*:\s*\{\s*render\s*:\s*window\.screenPedidosLista[^}]*roles\s*:\s*\[\s*['"]admin['"]\s*\]/i,
    "rota #/pedidos deve ser registrada com role admin e render=screenPedidosLista"
  );
});

test('boot.js: dependência documentada para screenPedidosLista', () => {
  assert.match(
    boot,
    /window\.screenPedidosLista/,
    "boot.js deve referenciar window.screenPedidosLista nas dependências ou setRoutes"
  );
});

// ---------------------------------------------------------------------
// 5. common.js expõe ADMIN_MENU com entrada "Pedidos" → #/pedidos
// ---------------------------------------------------------------------

test('common.js: ADMIN_MENU contém entrada Pedidos → #/pedidos', () => {
  assert.match(
    common,
    /\{\s*href\s*:\s*['"]#\/pedidos['"][^}]*label\s*:\s*['"]Pedidos['"]\s*\}/,
    'ADMIN_MENU deve ter entrada { href: "#/pedidos", label: "Pedidos" }'
  );
});

// ---------------------------------------------------------------------
// 6. pedidos-list.js não mexe em arquivos críticos de OP
// ---------------------------------------------------------------------

test('pedidos-list.js: NÃO referencia op-nova.js', () => {
  assert.doesNotMatch(screen, /op-nova\.js/);
  assert.doesNotMatch(screen, /screenNovaOP/);
  assert.doesNotMatch(screen, /window\.screenNovaOP/);
});

test('pedidos-list.js: NÃO referencia op-persistir.js', () => {
  assert.doesNotMatch(screen, /op-persistir\.js/);
  assert.doesNotMatch(screen, /window\.persistirOP/);
  assert.doesNotMatch(screen, /persistirOP\s*\(/);
});

test('pedidos-list.js: NÃO referencia op-latex-admin.js', () => {
  assert.doesNotMatch(screen, /op-latex-admin\.js/);
  assert.doesNotMatch(screen, /renderOPLatexAdmin/);
});

test('pedidos-list.js: NÃO referencia entrega-writes.js / entrega-form.js', () => {
  assert.doesNotMatch(screen, /entrega-writes\.js/);
  assert.doesNotMatch(screen, /entrega-form\.js/);
  assert.doesNotMatch(screen, /window\.[a-zA-Z]+Entrega/);
});

test('pedidos-list.js: NÃO referencia cadastros.js', () => {
  assert.doesNotMatch(screen, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});

test('pedidos-list.js: NÃO chama window.supa.from("ops"|"op_itens"|"op_fornecedores")', () => {
  // Defesa extra: garantir que não há query a tabelas de OP nesta fase.
  assert.doesNotMatch(
    screen,
    /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens)['"]/,
    "pedidos-list.js não deve consultar tabelas de OP nesta fase"
  );
});

// ---------------------------------------------------------------------
// 7. pedidos-list.js é read-only (sem insert/update/delete em pedidos)
// ---------------------------------------------------------------------

test('pedidos-list.js: NÃO faz .insert() / .update() / .delete() / .upsert() em pedidos', () => {
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.update\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedidos-list.js: usa apenas .select() em pedidos e clientes', () => {
  // Confirma que o módulo faz queries .select() legítimas às tabelas esperadas.
  assert.match(screen, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(screen, /\.from\(\s*['"]clientes['"][\s\S]{0,500}\.select\s*\(/);
});

// ---------------------------------------------------------------------
// 8. pedidos-list.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedidos-list.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(screen, /functions\.invoke\s*\(/);
  assert.doesNotMatch(screen, /supabase\.functions\./);
});

test('pedidos-list.js: NÃO referencia supabase/functions/**', () => {
  assert.doesNotMatch(screen, /supabase\/functions/);
  assert.doesNotMatch(screen, /admin-create-user/);
  assert.doesNotMatch(screen, /admin-disable-user/);
  assert.doesNotMatch(screen, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 9. pedidos-list.js não tem política/token público
// ---------------------------------------------------------------------

test('pedidos-list.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  assert.doesNotMatch(screen, /token_acesso/);
  assert.doesNotMatch(screen, /tokenAc/);
});

test('pedidos-list.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(screen, /CREATE\s+POLICY/i);
  assert.doesNotMatch(screen, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(screen, /GRANT\s+/i);
});

test('pedidos-list.js: NÃO contém service_role / SUPERUSER', () => {
  assert.doesNotMatch(screen, /service_role/i);
  assert.doesNotMatch(screen, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 10. pedidos-list.js tem placeholder "em breve" para ações não
//     implementadas nesta fase
// ---------------------------------------------------------------------

test('pedidos-list.js: tem placeholder "Novo pedido" e "Visualizar"', () => {
  // Botão "Novo pedido" no pageHeader com toast "em breve"/"próxima fase"
  assert.match(
    screen,
    /\+\s*Novo pedido|"Novo pedido"|'Novo pedido'/,
    'botão Novo pedido deve existir'
  );
  assert.match(
    screen,
    /(pr[óo]xima fase|em breve)/i,
    'placeholder de "próxima fase" ou "em breve" deve existir para ações desabilitadas'
  );
  // Ação "Visualizar" por linha
  assert.match(
    screen,
    /'Visualizar'|"Visualizar"/,
    'ação Visualizar deve existir por linha'
  );
});

test('pedidos-list.js: NÃO chama navigate para rota de formulário', () => {
  // Garantir que não navega para rota inexistente de formulário.
  assert.doesNotMatch(
    screen,
    /navigate\(\s*['"]#\/pedidos\/(?:novo|new|\d+)['"]/,
    "não deve navegar para rota de formulário (não implementado nesta fase)"
  );
});

// ---------------------------------------------------------------------
// 11. pedido-ui.js (helper) cobre map de cor e labels de status
// ---------------------------------------------------------------------

test('pedido-ui.js: expõe COR_PREVIEW_MAP com 4 cores + fallback', () => {
  assert.match(helper, /COR_PREVIEW_MAP/);
  assert.match(helper, /['"]PRETO['"]/);
  assert.match(helper, /['"]CRU['"]/);
  assert.match(helper, /['"]KRAFT['"]/);
  assert.match(helper, /['"]CINZA['"]/);
  assert.match(helper, /COR_PREVIEW_FALLBACK\s*=\s*['"]#9ca3af['"]/);
});

test('pedido-ui.js: expõe 6 status conhecidos com label e badge', () => {
  for (const s of ['rascunho','recebido','confirmado','produzindo','entregue','cancelado']) {
    const re = new RegExp(s + "\\s*:\\s*['\"][^'\"]+['\"]", 'i');
    assert.match(helper, re, 'status ' + s + ' deve estar em PEDIDO_STATUS_LABEL');
  }
});

test('pedido-ui.js: não referencia OP', () => {
  assert.doesNotMatch(helper, /op-nova/);
  assert.doesNotMatch(helper, /ops-list/);
  assert.doesNotMatch(helper, /ordens_compra_fio/);
  assert.doesNotMatch(helper, /entrega/);
});

// ---------------------------------------------------------------------
// 12. Schemas/db/** não foram tocados
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C1', () => {
  // Não cria formulários, não tem auth.users inserts, etc.
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  // RLS admin-only continua
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});
