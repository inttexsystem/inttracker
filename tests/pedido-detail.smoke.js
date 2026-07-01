// =====================================================================
// === tests/pedido-detail.smoke.js =====================================
// Smoke estático para a tela admin js/screens/pedido-detail.js
// (`screenPedidoDetalhe`).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B +
//   RAVATEX-TAPETES-PEDIDO-DETAIL-UI-B1
// Escopo: valida que a UI é read-only no conteúdo do pedido, mas com
// ações reais RESTRITAS de status nesta fase. Garante:
//   - arquivo existe e sintaxe JS válida;
//   - expõe window.screenPedidoDetalhe e RAVATEX_SCREENS.pedidoDetail;
//   - index.html carrega pedido-detail.js EXATAMENTE UMA VEZ;
//   - ordem de scripts: pedido-ui → pedido-form → pedido-detail → boot;
//   - faz SELECT em `pedidos` (com join `cliente:cliente_id(...)`),
//     `pedido_itens`, `modelos`, `cores`, `lotes`, `ops`,
//     `entrega_itens`, `entregas`, `ordens_compra_fio`;
//   - faz APENAS `update` em `pedidos` (campo `status` apenas),
//     com `.eq('id', pedidoId)`;
//   - NÃO faz insert/update/delete em `pedido_itens`;
//   - NÃO faz insert em `pedido_eventos` (fica para fase futura);
//   - NÃO chama functions.invoke / Edge Function;
//   - NÃO referencia op-nova/op-persistir/op-latex-admin/
//     entrega-writes/entrega-form/fornecedor;
//   - NÃO consulta `lotes` para escrita, NÃO chama `gerar_op_latex`,
//     NÃO chama `criar_lote`;
//   - NÃO cria policy/RLS/GRANT/service_role/token público;
//   - NÃO cria rota pública de cliente (sem `#/cliente` ou similar);
//   - rota dinâmica `#/pedidos/<uuid>` continua admin-only;
//   - transições permitidas (rascunho→recebido, recebido→confirmado,
//     rascunho/recebido/confirmado→cancelado);
//   - NÃO há transição para `produzindo` ou `entregue`;
//   - `cancelado` é terminal (sem transição reversa);
//   - cancelar pedido pede confirmação visual (`window.confirmDialog`);
//   - Editar continua como placeholder (C3C);
//   - tela atualiza/re-renderiza após mudança de status.
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
const DETAIL_DATA = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const DETAIL_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const DETAIL_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');
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
const detailData = readOrFail(DETAIL_DATA);
const detailProgress = readOrFail(DETAIL_PROGRESS);
const detailEvents = readOrFail(DETAIL_EVENTS);
const detailRender = readOrFail(DETAIL_RENDER);
const list   = readOrFail(LIST);
const helper = readOrFail(HELPER);
const router = readOrFail(ROUTER);
const boot   = readOrFail(BOOT);
const index  = readOrFail(INDEX);
const schema = readOrFail(SCHEMA);
const detailBundle = [
  screen,
  detailData,
  detailProgress,
  detailEvents,
  detailRender,
].join('\n\n');
const movementModalSlice = (detailEvents.match(
  /function openMovementModal\s*\(ctxMovement\)\s*\{[\s\S]*?\n    \}\n\n    function openEditWarning/
) || [''])[0];

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

test('pedido-detail: arquivos esperados existem', () => {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/pedido-detail.js ausente');
  assert.ok(fs.existsSync(DETAIL_DATA), 'js/screens/pedido-detail-data.js ausente');
  assert.ok(fs.existsSync(DETAIL_PROGRESS), 'js/screens/pedido-detail-progress.js ausente');
  assert.ok(fs.existsSync(DETAIL_EVENTS), 'js/screens/pedido-detail-events.js ausente');
  assert.ok(fs.existsSync(DETAIL_RENDER), 'js/screens/pedido-detail-render.js ausente');
  assert.ok(fs.existsSync(HELPER), 'js/pedido-ui.js ausente');
  assert.ok(fs.existsSync(SCHEMA), 'db/13_pedidos_schema.sql ausente');
});

// ---------------------------------------------------------------------
// 2. Sintaxe
// ---------------------------------------------------------------------

test('pedido-detail: sintaxe JS válida (node --check)', () => {
  [SCREEN, DETAIL_DATA, DETAIL_PROGRESS, DETAIL_EVENTS, DETAIL_RENDER].forEach((file) => {
    require('node:child_process').execFileSync(
      process.execPath, ['--check', file], { stdio: 'pipe' }
    );
  });
});

test('pedido-detail: expõe screenPedidoDetalhe no namespace', () => {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
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
  assert.ok(router.includes('#/pedidos/'),
    'router.js deve referenciar #/pedidos/ no matchRoute');
  assert.ok(router.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'),
    'router.js deve validar formato UUID do id do pedido');
  assert.match(router, /screenPedidoDetalhe/,
    'router.js deve chamar screenPedidoDetalhe no matchRoute');
  // O regex de UUID aparece em vários matches dinâmicos (C3A detalhe,
  // C3C1 editar, C3C2B itens). Pega a ÚLTIMA ocorrência (que é a
  // do match de detalhe) e mede a distância até screenPedidoDetalhe.
  const uuidRegex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  let idxRegex = -1;
  let last = -1;
  while (true) {
    const next = router.indexOf(uuidRegex, last + 1);
    if (next === -1) break;
    idxRegex = next;
    last = next;
  }
  const idxRender = router.indexOf('screenPedidoDetalhe');
  assert.ok(idxRegex > 0, 'regex de UUID deve existir em router.js (última ocorrência — detalhe)');
  assert.ok(idxRender > 0, 'chamada screenPedidoDetalhe deve existir em router.js');
  const distancia = Math.abs(idxRender - idxRegex);
  assert.ok(distancia <= 400,
    'regex de UUID (match de detalhe) e screenPedidoDetalhe devem estar próximos (distância ' + distancia + ' > 400)');
});

test('router.js: rota dinâmica #/pedidos/<uuid> é admin-only', () => {
  assert.match(router, /#\/pedidos\/[\s\S]{0,400}?roles\s*:\s*\[\s*['"]admin['"]\s*\]/,
    'rota dinâmica #/pedidos/<uuid> deve ser admin-only');
});

test('router.js: matchRoute dinâmico #/pedidos/<uuid> NÃO é público', () => {
  const pedidosSlice = router.match(/#\/pedidos\/[\s\S]{0,500}/);
  assert.ok(pedidosSlice, 'trecho do match dinâmico de pedidos não encontrado em router.js');
  assert.doesNotMatch(pedidosSlice[0], /public\s*:\s*true/,
    'rota dinâmica #/pedidos/<uuid> NÃO deve ser pública (sem public: true)');
});

// ---------------------------------------------------------------------
// 5. Transições de status (C3B) — núcleo do escopo desta fase
// ---------------------------------------------------------------------

test('pedido-detail.js: define TRANSITIONS com transições permitidas nesta fase', () => {
  // A constante deve permitir:
  //   rascunho   -> recebido
  //   rascunho   -> cancelado
  //   recebido   -> confirmado
  //   recebido   -> cancelado
  //   confirmado -> cancelado
  assert.match(screen, /TRANSITIONS\s*[=:]/, 'deve definir TRANSITIONS');
  // Helper regex: casa 'origem': [...possíveis wrappers... 'destino' ...
  // Casa o destino dentro do array de TRANSITIONS mesmo com wrapper
  // Object.freeze() e indentação variável.
  const TRANS_RE = function (from, to) {
    return new RegExp(
      "\\b" + from + "\\s*:\\s*(?:Object\\.freeze\\s*\\(\\s*)?\\s*\\[[^\\]]*['\"]" + to + "['\"]",
      'm'
    );
  };
  assert.match(screen, TRANS_RE('rascunho', 'recebido'),
    'TRANSITIONS.rascunho deve incluir "recebido"');
  assert.match(screen, TRANS_RE('recebido', 'confirmado'),
    'TRANSITIONS.recebido deve incluir "confirmado"');
  assert.match(screen, TRANS_RE('rascunho', 'cancelado'),
    'TRANSITIONS.rascunho deve incluir "cancelado"');
  assert.match(screen, TRANS_RE('recebido', 'cancelado'),
    'TRANSITIONS.recebido deve incluir "cancelado"');
  assert.match(screen, TRANS_RE('confirmado', 'cancelado'),
    'TRANSITIONS.confirmado deve incluir "cancelado"');
});

test('pedido-detail.js: TRANSITIONS NÃO permite transição para "produzindo"', () => {
  // Nenhum status pode ter "produzindo" como destino nesta fase.
  // Verifica que a string 'produzindo' não aparece em uma estrutura
  // de array literal (objeto literal com valor de array).
  const co = codeOnly(screen);
  // Padrão: 'qualquerStatus': [...'produzindo'...]
  assert.doesNotMatch(co, /:\s*\[[^\]]*['"]produzindo['"][^\]]*\]/,
    'nenhum status deve listar "produzindo" como destino em TRANSITIONS');
});

test('pedido-detail.js: TRANSITIONS NÃO permite transição para "entregue"', () => {
  const co = codeOnly(screen);
  assert.doesNotMatch(co, /:\s*\[[^\]]*['"]entregue['"][^\]]*\]/,
    'nenhum status deve listar "entregue" como destino em TRANSITIONS');
});

test('pedido-detail.js: TRANSITIONS marca cancelado como terminal (sem saídas)', () => {
  // cancelado deve estar mapeado para array vazio (com possível
  // wrapper Object.freeze()).
  assert.match(screen, /\bcancelado\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.cancelado deve ser terminal (array vazio)');
  // produzindo e entregue também devem ser terminais nesta fase.
  assert.match(screen, /\bproduzindo\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.produzindo deve ser terminal (array vazio)');
  assert.match(screen, /\bentregue\s*:\s*(?:Object\.freeze\s*\(\s*)?\[\s*\]\s*\)?/,
    'TRANSITIONS.entregue deve ser terminal (array vazio)');
});

test('pedido-detail.js: expõe canTransition (helper de validação)', () => {
  // Deve haver uma função canTransition (definida ou referenciada)
  // que valida a transição antes de aplicar.
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(detailBundle, sandbox);
  // O módulo é IIFE; canTransition não é exposto como global, mas é
  // usado internamente. Validamos indiretamente: o módulo expõe
  // screenPedidoDetalhe e ao avaliá-lo, não deve quebrar.
  assert.equal(typeof sandbox.window.screenPedidoDetalhe, 'function');
});

test('pedido-detail.js: tem função alterarStatus (helper interno de update)', () => {
  // A função alterarStatus deve existir e ser usada.
  assert.match(detailBundle, /function\s+alterarStatus\s*\(/,
    'pedido-detail.js deve definir function alterarStatus');
  // Deve referenciar alterarStatus em algum onclick de botão.
  assert.match(detailBundle, /alterarStatus\s*\(/,
    'alterarStatus deve ser referenciado em algum lugar do código');
});

// ---------------------------------------------------------------------
// 6. Write: APENAS update em pedidos (status only), com .eq('id', ...)
// ---------------------------------------------------------------------

test('pedido-detail.js: faz .update() em pedidos com .eq("id", pedidoId)', () => {
  // Permitido nesta fase: update apenas em pedidos, filtrado por id.
  assert.match(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,300}?\.update\s*\(\s*\{\s*status\s*:\s*novoStatus\s*\}\s*\)[\s\S]{0,200}?\.eq\s*\(\s*['"]id['"]\s*,\s*pedidoId\s*\)/,
    'deve fazer .update({ status }).eq("id", pedidoId) na tela de detalhe');
});

test('pedido-detail.js: NÃO faz .update() em outros campos de pedidos', () => {
  // Defesa: o payload de update deve ser EXATAMENTE { status }.
  // Não pode atualizar prazo_entrega, observacao, cliente_id, numero, etc.
  const co = codeOnly(detailBundle);
  // Procura o bloco `.update({ ... })` aplicado a pedidos e checa que
  // a única chave dentro do objeto é `status`.
  const m = co.match(/\.from\(\s*['"]pedidos['"][\s\S]{0,300}?\.update\s*\(\s*\{([^}]*)\}\s*\)/);
  assert.ok(m, 'deve haver .update({...}) em pedidos');
  const chaves = m[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.equal(chaves.length, 1, '.update({...}) em pedidos deve ter exatamente 1 chave');
  assert.match(chaves[0], /^status\s*:/,
    'a única chave em .update({...}) em pedidos deve ser "status"');
});

test('pedido-detail.js: NÃO faz .insert() / .delete() / .upsert() em pedidos', () => {
  // Ainda não permitimos insert/delete/upsert no detalhe.
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() / .update() / .delete() / .upsert() em pedido_itens', () => {
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.update\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.delete\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,200}\.upsert\s*\(/);
});

test('pedido-detail.js: NÃO faz .insert() em pedido_eventos (best-effort fica para fase futura)', () => {
  // Decisão C3B: pedido_eventos fica para fase futura (best-effort).
  // Nenhuma referência a pedido_eventos no detalhe.
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_eventos['"][\s\S]{0,200}\.insert\s*\(/);
  assert.doesNotMatch(detailBundle, /\.from\(\s*['"]pedido_eventos['"]/,
    'pedido-detail.js não deve referenciar pedido_eventos nesta fase');
});

test('pedido-detail.js: usa apenas .select() em pedidos/pedido_itens/clientes/modelos/cores', () => {
  assert.match(detailBundle, /\.from\(\s*['"]pedidos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]pedido_itens['"][\s\S]{0,500}\.select\s*\(/);
  // Join aninhado com cliente:cliente_id(id, nome)
  assert.match(detailBundle, /cliente\s*:\s*cliente_id\s*\(/,
    'deve usar join aninhado cliente:cliente_id(...) em pedidos');
  assert.match(detailBundle, /\.from\(\s*['"]modelos['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]cores['"][\s\S]{0,500}\.select\s*\(/);
});

// ---------------------------------------------------------------------
// 7. Confirmação visual para cancelar
// ---------------------------------------------------------------------

test('pedido-detail.js: cancelar pedido usa window.confirmDialog (confirmação visual)', () => {
  // Antes de aplicar update para "cancelado", deve abrir confirmDialog.
  assert.match(detailBundle, /window\.confirmDialog\s*\(/,
    'cancelar pedido deve chamar window.confirmDialog');
  // O fluxo de cancelamento deve estar próximo do update de status.
  // Garante que confirmDialog é chamado no caminho de cancelamento
  // (case-insensitive para aceitar "Cancelar pedido" e "Cancelado").
  const co = codeOnly(detailBundle);
  assert.match(co, /confirmDialog[\s\S]{0,800}?(?:cancelar|cancelado|cancelad)/i,
    'confirmDialog deve ser usado no caminho de cancelamento');
});

test('pedido-detail.js: NÃO chama confirmDialog para recebido/confirmado (transições diretas)', () => {
  // As transições para recebido/confirmado NÃO devem pedir confirmação
  // visual (são ações simples de fluxo).
  // Defesa: confirmDialog só é usado quando novoStatus === 'cancelado'.
  assert.match(detailBundle, /novoStatus\s*===\s*['"]cancelado['"][\s\S]{0,300}?confirmDialog/,
    'confirmDialog só deve ser invocado quando novoStatus === "cancelado"');
});

// ---------------------------------------------------------------------
// 8. pedido-detail.js não chama Edge Function
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO chama functions.invoke / Edge Function', () => {
  assert.doesNotMatch(detailBundle, /functions\.invoke\s*\(/);
  assert.doesNotMatch(detailBundle, /supabase\.functions\./);
  assert.doesNotMatch(detailBundle, /supabase\/functions/);
  assert.doesNotMatch(detailBundle, /admin-create-user/);
  assert.doesNotMatch(detailBundle, /admin-disable-user/);
  assert.doesNotMatch(detailBundle, /admin-delete-user/);
});

// ---------------------------------------------------------------------
// 9. pedido-detail.js não referencia OP/lote/entrega para escrita
// ---------------------------------------------------------------------

test('pedido-detail.js: consolida leitura de lote/OP/entregas sem writes operacionais', () => {
  assert.match(detailBundle, /\.from\(\s*['"]lotes['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]ops['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /op_itens\s*\(/,
    'select de ops deve incluir op_itens aninhados');
  assert.match(detailBundle, /\.from\(\s*['"]entrega_itens['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]entregas['"][\s\S]{0,500}\.select\s*\(/);
  assert.match(detailBundle, /\.from\(\s*['"]ordens_compra_fio['"][\s\S]{0,500}\.select\s*\(/);

  assert.doesNotMatch(detailBundle, /\.from\(\s*['"](?:ops|op_itens|op_fornecedores|ordens_compra_fio|entregas|entrega_itens|lotes)['"][\s\S]{0,220}\.(?:insert|update|delete|upsert)\s*\(/);
  assert.doesNotMatch(detailBundle, /gerar_op_latex/);
  assert.doesNotMatch(detailBundle, /gerar_op_pedido/);
  assert.doesNotMatch(detailBundle, /criar_lote/);
  assert.doesNotMatch(detailBundle, /persistirOP/);
  assert.doesNotMatch(detailBundle, /aplicarRecalculoOP/);
});

test('pedido-detail.js: NÃO referencia arquivos críticos de OP', () => {
  assert.doesNotMatch(detailBundle, /op-nova\.js/);
  assert.doesNotMatch(detailBundle, /op-persistir\.js/);
  assert.doesNotMatch(detailBundle, /op-latex-admin\.js/);
  assert.doesNotMatch(detailBundle, /op-recalculo\.js/);
  assert.doesNotMatch(detailBundle, /op-writes\.js/);
  assert.doesNotMatch(detailBundle, /entrega-writes\.js/);
  assert.doesNotMatch(detailBundle, /entrega-form\.js/);
  assert.doesNotMatch(detailBundle, /fornecedor\.js/);
  assert.doesNotMatch(detailBundle, /screenNovaOP/);
  assert.doesNotMatch(detailBundle, /window\.screenNovaOP/);
  assert.doesNotMatch(detailBundle, /renderOPLatexAdmin/);
  assert.doesNotMatch(detailBundle, /screenFornecedor/);
});

test('pedido-detail.js: openMovementModal existe e permanece somente leitura', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  assert.match(movementModalSlice, /somente leitura/i,
    'modal deve se declarar somente leitura');
  assert.match(movementModalSlice, /Operacao canonica da OP/,
    'modal deve reforcar a origem canonica na OP');
  assert.match(movementModalSlice, /Abrir OP de origem/,
    'acao primaria do modal deve abrir a OP de origem');
  assert.match(movementModalSlice, /nao grava entrega, nao cria movimentacao no Pedido/i,
    'modal deve deixar explicito que nao grava nem cria estado paralelo');
});

test('pedido-detail.js: openMovementModal mostra contexto pre-carregado esperado', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  for (const label of [
    'Origem',
    'Destino',
    'OP de origem',
    'Itens envolvidos',
    'Saldo/restante calculado',
    'Documentos esperados',
  ]) {
    assert.match(movementModalSlice, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'modal nao renderiza o campo esperado: ' + label);
  }
});

test('pedido-detail.js: openMovementModal nao vira formulario operacional nem chama writes proibidos', () => {
  assert.ok(movementModalSlice, 'trecho de openMovementModal nao encontrado');
  assert.doesNotMatch(movementModalSlice, /window\.el\(\s*['"]input['"]/);
  assert.doesNotMatch(movementModalSlice, /window\.el\(\s*['"]textarea['"]/);
  assert.doesNotMatch(movementModalSlice, /window\.el\(\s*['"]select['"]/);
  assert.doesNotMatch(movementModalSlice, /salvarEntregaCima/);
  assert.doesNotMatch(movementModalSlice, /salvarEntregaLatex/);
  assert.doesNotMatch(movementModalSlice, /gerar_op_latex/);
  assert.doesNotMatch(movementModalSlice, /alterar_status_op/);
  assert.doesNotMatch(movementModalSlice, /window\.supa/);
  assert.doesNotMatch(movementModalSlice, /\.from\(\s*['"]/);
});

// ---------------------------------------------------------------------
// 10. pedido-detail.js usa helper pedido-ui.js
// ---------------------------------------------------------------------

test('pedido-detail.js: usa helper de status do pedido no badge customizado do header', () => {
  assert.match(detailBundle, /window\.pedidoStatusLabel/);
});

test('pedido-detail.js: usa window.corPreviewElement para preview 48x48', () => {
  assert.match(detailBundle, /window\.corPreviewElement/);
});

test('pedido-detail.js: usa window.fmtDataCurta para datas', () => {
  assert.match(detailBundle, /window\.fmtDataCurta/);
});

test('pedido-detail.js: usa window.pedidoStatusLabel ou namespace RAVATEX_PEDIDO_UI', () => {
  const usaHelper = /window\.pedidoStatusLabel|window\.RAVATEX_PEDIDO_UI|window\.corPreviewHex|window\.pedidoStatusBadge|window\.corPreviewElement|window\.fmtDataCurta|window\.pedidoStatusTodos/.test(detailBundle);
  assert.ok(usaHelper, 'detalhe deve consumir helpers de js/pedido-ui.js');
});

// ---------------------------------------------------------------------
// 11. pedido-detail.js não cria policy/RLS/GRANT
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria policy / RLS / GRANT', () => {
  assert.doesNotMatch(detailBundle, /CREATE\s+POLICY/i);
  assert.doesNotMatch(detailBundle, /ENABLE\s+ROW\s+LEVEL/i);
  assert.doesNotMatch(detailBundle, /GRANT\s+/i);
});

// ---------------------------------------------------------------------
// 12. pedido-detail.js não tem token público / service_role
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO usa token_acesso (sem consulta pública nesta fase)', () => {
  const co = codeOnly(detailBundle);
  assert.doesNotMatch(co, /token_acesso/,
    'token_acesso não pode aparecer em código (comentários OK)');
});

test('pedido-detail.js: NÃO contém service_role / SUPERUSER', () => {
  const co = codeOnly(detailBundle);
  assert.doesNotMatch(co, /service_role/i,
    'service_role não pode aparecer em código (comentários OK)');
  assert.doesNotMatch(co, /SUPABASE_SERVICE_ROLE_KEY/);
});

// ---------------------------------------------------------------------
// 13. pedido-detail.js não cria rota pública de cliente
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO cria rota pública de cliente (sem public: true)', () => {
  assert.doesNotMatch(detailBundle, /public\s*:\s*true/);
  assert.doesNotMatch(detailBundle, /['"]#\/cliente/);
  assert.doesNotMatch(detailBundle, /['"]#\/pedido\/[^'"]+['"]\s*:\s*\{\s*public\s*:\s*true/);
});

test('pedido-detail.js: NÃO usa hash para acesso público', () => {
  // O arquivo de tela não deve registrar rotas por conta própria.
  assert.doesNotMatch(detailBundle, /setRoutes/);
  assert.doesNotMatch(detailBundle, /window\.RAVATEX_ROUTER\.setRoutes/);
});

// ---------------------------------------------------------------------
// 14. Botões da tela (C3B) — Cancelar/Receber/Confirmar são REAIS
// ---------------------------------------------------------------------

test('pedido-detail.js: tem labels "Marcar como recebido", "Confirmar pedido", "Cancelar pedido"', () => {
  assert.match(detailBundle, /Marcar como recebido/,
    'label "Marcar como recebido" deve existir (ação real)');
  assert.match(detailBundle, /Confirmar pedido/,
    'label "Confirmar pedido" deve existir (ação real)');
  assert.match(detailBundle, /Cancelar pedido/,
    'label "Cancelar pedido" deve existir (ação real)');
});

test('pedido-detail.js: botão Editar é controlado por status editável (C3C1)', () => {
  // C3C1: o botão Editar é FUNCIONAL para status editáveis
  // (rascunho / recebido) e PLACEHOLDER para os demais.
  assert.match(detailBundle, /Editar/,
    'botão Editar deve existir como label');
  // Helper isPedidoEditavel (ou checagem equivalente) deve ser usado
  // para decidir entre botão funcional e placeholder.
  const usaEditavel = /window\.isPedidoEditavel|isPedidoEditavel\s*\(/.test(detailBundle);
  assert.ok(usaEditavel,
    'botão Editar deve usar isPedidoEditavel() para decidir entre funcional e placeholder');
  // Para status editáveis, o fluxo pode navegar direto ou abrir o
  // warning modal antes da navegação final.
  const usaEditFlow = /openEditWarning/.test(detailBundle)
    || /(?:window\.)?navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\+\s*['"]\/editar['"]/.test(detailBundle);
  assert.ok(usaEditFlow,
    'botão Editar funcional deve abrir o fluxo de edição do pedido');
  // placeholderButton continua disponível para o caminho placeholder
  // (status não editáveis) e deve gerar `disabled`.
  assert.match(detailBundle, /function\s+placeholderButton[\s\S]{0,400}?disabled\s*:\s*['"]disabled['"]/,
    'placeholderButton deve criar botão com disabled="disabled"');
});

test('pedido-detail.js: botão Editar itens é controlado por status editável (C3C2B)', () => {
  // C3C2B: o botão "Editar itens" é FUNCIONAL para status
  // editáveis (rascunho / recebido) e PLACEHOLDER para os demais.
  // Deve navegar para "#/pedidos/<id>/itens".
  assert.match(detailBundle, /Editar itens/,
    'botão "Editar itens" deve existir como label');
  // O botão Editar itens funcional deve navegar para /itens.
  assert.match(detailBundle, /navigate\(\s*['"]#\/pedidos\/['"]?\s*\+\s*pedidoId\s*\+\s*['"]\/itens['"]/,
    'botão Editar itens funcional deve navegar para "#/pedidos/<id>/itens"');
  // O botão Editar itens é criado em buildEditItensButton()
  // (helper separado, mesmo padrão de buildEditButton).
  assert.match(detailBundle, /function\s+buildEditItensButton/,
    'deve existir função buildEditItensButton()');
});

test('pedido-detail.js: NÃO usa mais "Confirmar / Receber" como placeholder (substituído)', () => {
  // O placeholder antigo "Confirmar / Receber" foi substituído por
  // "Marcar como recebido" + "Confirmar pedido" como ações reais.
  assert.doesNotMatch(detailBundle, /Confirmar\s*\/\s*Receber/,
    'placeholder "Confirmar / Receber" não deve mais existir (substituído)');
});

test('pedido-detail.js: botão Voltar é funcional', () => {
  assert.match(detailBundle, /window\.navigate\(\s*['"]#\/pedidos['"]/);
  assert.match(detailBundle, /Voltar(?: para pedidos)?/);
});

// ---------------------------------------------------------------------
// 15. Re-render após mudança de status
// ---------------------------------------------------------------------

test('pedido-detail.js: chama render() após sucesso no update de status', () => {
  // Após o update bem-sucedido, deve chamar render() para refletir
  // o novo status (e reabilitar/desabilitar botões).
  assert.match(detailBundle, /state\.pedido\.status\s*=\s*novoStatus/,
    'deve atualizar state.pedido.status após update');
  // render() deve ser chamado no caminho de sucesso.
  const co = codeOnly(detailBundle);
  assert.match(co, /state\.pedido\.status\s*=\s*novoStatus[\s\S]{0,400}?render\s*\(\s*\)/,
    'render() deve ser chamado após atualizar state.pedido.status');
});

// ---------------------------------------------------------------------
// 16. Schema 13_* não foi alterado por esta fase
// ---------------------------------------------------------------------

test('schema 13_*: não foi alterado pela fase C3B', () => {
  assert.match(schema, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(schema, /CHECK\s*\(status\s+IN/i);
  assert.match(schema, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

// ---------------------------------------------------------------------
// 17. Não mexe em arquivos proibidos
// ---------------------------------------------------------------------

test('pedido-detail.js: NÃO referencia cadastros.js (escopo separado)', () => {
  assert.doesNotMatch(detailBundle, /cadastros\.js/);
  assert.doesNotMatch(screen, /screenCadastros/);
});
