const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '34_controlled_delete_pedido_op.sql');
const SQL_CASCADE = path.join(ROOT, 'db', '35_controlled_delete_test_cascade.sql');
const SQL_FIX = path.join(ROOT, 'db', '36_controlled_delete_fk_order_fix.sql');
const SQL_EXPEDICAO = path.join(ROOT, 'db', '37_controlled_delete_expedicao_cascade.sql');
const HELPER = path.join(ROOT, 'js', 'delete-helpers.js');
const INDEX = path.join(ROOT, 'index.html');
const PEDIDOS_LIST = path.join(ROOT, 'js', 'screens', 'pedidos-list.js');
const PEDIDO_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const PEDIDO_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');
const OPS_LIST = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const OP_NOVA = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const OP_TEC = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');
const OP_LATEX = path.join(ROOT, 'js', 'screens', 'op-latex-admin.js');
const STAGING_SCRIPT = path.join(ROOT, 'scripts', 'staging', 'delete-impact-diag.mjs');

function read(file) {
  assert.ok(fs.existsSync(file), 'arquivo ausente: ' + file);
  return fs.readFileSync(file, 'utf8');
}

function assertOrder(src, first, second, msg) {
  const a = src.search(first);
  const b = src.search(second);
  assert.ok(a >= 0, 'trecho inicial ausente: ' + first);
  assert.ok(b >= 0, 'trecho final ausente: ' + second);
  assert.ok(a < b, msg || 'ordem invalida');
}

const sql = read(SQL);
const sqlCascade = read(SQL_CASCADE);
const sqlFix = read(SQL_FIX);
const sqlExpedicao = read(SQL_EXPEDICAO);
const sqlAll = sql + '\n' + sqlCascade + '\n' + sqlFix + '\n' + sqlExpedicao;
const helper = read(HELPER);
const index = read(INDEX);
const pedidosList = read(PEDIDOS_LIST);
const pedidoEvents = read(PEDIDO_EVENTS);
const pedidoRender = read(PEDIDO_RENDER);
const opsList = read(OPS_LIST);
const opNova = read(OP_NOVA);
const opTec = read(OP_TEC);
const opLatex = read(OP_LATEX);
const stagingScript = read(STAGING_SCRIPT);

test('controlled delete: arquivos novos existem e JS tem sintaxe valida', () => {
  cp.execFileSync(process.execPath, ['--check', HELPER], { stdio: 'pipe' });
  cp.execFileSync(process.execPath, ['--check', STAGING_SCRIPT], { stdio: 'pipe' });
});

test('SQL cria as quatro RPCs exigidas', () => {
  for (const fn of ['diagnosticar_impacto_pedido', 'diagnosticar_impacto_op', 'remover_pedido', 'remover_op']) {
    assert.match(sqlAll, new RegExp('CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + fn, 'i'));
    assert.match(sqlAll, new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + fn, 'i'));
  }
});

test('SQL bloqueia Pedido com entrega, expedicao e OP filha nao tratada', () => {
  assert.match(sql, /v_entregas\s*>\s*0[\s\S]*existe entrega vinculada/i);
  assert.match(sql, /v_expedicoes\s*>\s*0[\s\S]*existe expedicao vinculada/i);
  assert.match(sql, /v_filhas_nao_tratadas\s*>\s*0[\s\S]*OP de Acabamento vinculada/i);
});

test('SQL exige EXCLUIR para Pedido com OP sem movimento', () => {
  assert.match(sql, /v_ops_total\s*>\s*0[\s\S]*v_requires\s*:=\s*TRUE/i);
  assert.match(sql, /remover_pedido[\s\S]*v_class\s*=\s*'requires_confirmation'[\s\S]*p_confirmacao[\s\S]*'EXCLUIR'/i);
});

test('SQL bloqueia OP com entrega, expedicao ou filha', () => {
  assert.match(sqlCascade, /diagnosticar_impacto_op[\s\S]*v_expedicoes\s*>\s*0[\s\S]*existe expedicao vinculada/i);
  assert.doesNotMatch(sqlCascade, /v_entregas\s*>\s*0[\s\S]{0,220}existe entrega vinculada/i);
  assert.doesNotMatch(sqlCascade, /v_filhas\s*>\s*0[\s\S]{0,220}OP de Acabamento vinculada/i);
});

test('SQL desativa bloqueio legado por OP numerada em modo teste', () => {
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+ops_numeradas_no_delete\s+ON\s+public\.ops/i);
  assert.match(sql, /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.ops_numeradas_no_delete_fn\s*\(\s*\)/i);
  assert.doesNotMatch(sql, /nao pode ser removida fisicamente/i);
  assert.doesNotMatch(sql, /Use cancelamento\/arquivamento\/consolidacao com rastro/i);
});

test('SQL permite remocao de OP sem bloqueadores e nao altera op_numeros', () => {
  assert.match(sqlAll, /DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*p_op_id/i);
  assert.doesNotMatch(sqlAll, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.op_numeros/i);
  assert.doesNotMatch(sqlAll, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+op_numeros/i);
});

test('OP numerada sem movimento pode ser removida com EXCLUIR', () => {
  assert.match(sql, /'numero'\s*,\s*v_op\.numero/i);
  assert.match(sql, /'ano'\s*,\s*v_op\.ano/i);
  assert.doesNotMatch(sql, /v_op\.numero[\s\S]{0,220}v_blocked\s*:=\s*TRUE/i);
  assert.doesNotMatch(sql, /v_op\.ano[\s\S]{0,220}v_blocked\s*:=\s*TRUE/i);
  assert.match(sql, /remover_op[\s\S]*v_class\s*=\s*'requires_confirmation'[\s\S]*p_confirmacao[\s\S]*'EXCLUIR'[\s\S]*DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*p_op_id/i);
});

test('Pedido com OP numerada sem movimento pode remover OPs vinculadas com EXCLUIR', () => {
  assert.match(sql, /remover_pedido[\s\S]*v_class\s*=\s*'requires_confirmation'[\s\S]*p_confirmacao[\s\S]*'EXCLUIR'/i);
  assert.match(sql, /SELECT\s+COALESCE\(array_agg\(o\.id\)[\s\S]*FROM\s+public\.ops\s+o[\s\S]*o\.lote_id\s*=\s*ANY\(v_lote_ids\)/i);
  assert.match(sql, /DELETE\s+FROM\s+public\.ops[\s\S]*WHERE\s+id\s*=\s*ANY\(v_op_ids\)/i);
  assert.doesNotMatch(sql, /v_op_ids[\s\S]{0,260}numero[\s\S]{0,260}blocked/i);
});

test('SQL35 classifica cadeia de teste como requires_cascade_confirmation', () => {
  assert.match(sqlCascade, /requires_cascade_confirmation/i);
  assert.match(sqlCascade, /cascade_required/i);
  assert.match(sqlCascade, /cascade_reason/i);
  assert.match(sqlCascade, /confirmation_required/i);
  assert.match(sqlCascade, /EXCLUIR TUDO/i);
  assert.match(sqlCascade, /v_entregas\s*>\s*0\s+OR\s+v_filhas\s*>\s*0[\s\S]*v_cascade\s*:=\s*TRUE/i);
});

test('SQL35 remover_op exige EXCLUIR TUDO e apaga filha antes da OP mae', () => {
  assert.match(sqlCascade, /remover_op[\s\S]*v_class\s*=\s*'requires_cascade_confirmation'[\s\S]*p_confirmacao[\s\S]*EXCLUIR TUDO/i);
  assert.match(sqlCascade, /DELETE\s+FROM\s+public\.op_latex_entregas[\s\S]*op_latex_id\s*=\s*ANY\(v_op_ids\)/i);
  assert.match(sqlCascade, /DELETE\s+FROM\s+public\.entrega_itens[\s\S]*op_id\s*=\s*ANY\(v_op_ids\)/i);
  assert.match(sqlCascade, /DELETE\s+FROM\s+public\.ops[\s\S]*id\s*<>\s*p_op_id[\s\S]*DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*p_op_id/i);
});

test('SQL35 remover_pedido exige EXCLUIR TUDO e bloqueia expedicao', () => {
  assert.match(sqlCascade, /diagnosticar_impacto_pedido[\s\S]*v_expedicoes\s*>\s*0[\s\S]*existe expedicao vinculada/i);
  assert.match(sqlCascade, /remover_pedido[\s\S]*v_class\s*=\s*'requires_cascade_confirmation'[\s\S]*p_confirmacao[\s\S]*EXCLUIR TUDO/i);
  assert.match(sqlCascade, /DELETE\s+FROM\s+public\.op_latex_entregas[\s\S]*DELETE\s+FROM\s+public\.entrega_itens[\s\S]*DELETE\s+FROM\s+public\.entregas[\s\S]*DELETE\s+FROM\s+public\.ops[\s\S]*tipo\s*=\s*'latex'[\s\S]*DELETE\s+FROM\s+public\.ops[\s\S]*DELETE\s+FROM\s+public\.lotes[\s\S]*DELETE\s+FROM\s+public\.pedidos/i);
});

test('SQL35 nao usa mensagem antiga de entrega como bloqueio de cascata', () => {
  assert.doesNotMatch(sqlCascade, /existe entrega vinculada\. Exclua a entrega antes/i);
});

test('SQL36 remove entrega_itens por op_id/op_item_id antes de DELETE FROM ops', () => {
  assert.match(sqlFix, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.remover_op/i);
  assert.match(sqlFix, /DELETE\s+FROM\s+public\.entrega_itens[\s\S]*op_id\s*=\s*ANY\(v_target_ops\)[\s\S]*op_item_id\s*=\s*ANY\(v_target_op_itens\)/i);
  assert.match(sqlFix, /DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*v_op_id/i);
  assertOrder(
    sqlFix,
    /DELETE\s+FROM\s+public\.entrega_itens/i,
    /DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*v_op_id/i,
    'entrega_itens deve ser removido antes de ops'
  );
});

test('SQL36 verifica entrega_itens remanescentes antes de apagar OPs', () => {
  assert.match(sqlFix, /v_remaining_entrega_item_ids/i);
  assert.match(sqlFix, /WHERE\s+ei\.op_id\s*=\s*ANY\(v_target_ops\)[\s\S]*OR\s+ei\.op_item_id\s*=\s*ANY\(v_target_op_itens\)/i);
  assert.match(sqlFix, /RAISE\s+EXCEPTION\s+USING[\s\S]*Exclusao interrompida: ainda existem itens de entrega vinculados a OPs alvo\./i);
  assert.match(sqlFix, /DETAIL\s*=\s*format\([\s\S]*entrega_item_ids=%s; op_ids=%s; op_item_ids=%s/i);
  assert.doesNotMatch(sqlFix, /entrega_itens_op_id_fkey/i);
  assert.doesNotMatch(helper, /entrega_itens_op_id_fkey/i);
});

test('SQL36 guards de entrega retornam OLD em DELETE autorizado', () => {
  assert.match(sqlFix, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.entrega_cima_latex_guard_fn\(\)[\s\S]*IF\s+TG_OP\s*=\s*'DELETE'\s+THEN\s+RETURN\s+OLD;/i);
  assert.match(sqlFix, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.entrega_itens_cima_latex_guard_fn\(\)[\s\S]*IF\s+TG_OP\s*=\s*'DELETE'\s+THEN\s+RETURN\s+OLD;/i);
});

test('SQL36 OP com entrega_itens.op_id exige EXCLUIR TUDO e nao fica blocked por entrega', () => {
  assert.match(sqlFix, /v_entrega_itens_por_op_id\s*>\s*0[\s\S]*v_cascade\s*:=\s*TRUE/i);
  assert.match(sqlFix, /requires_cascade_confirmation/i);
  assert.match(sqlFix, /EXCLUIR TUDO/i);
  assert.doesNotMatch(sqlFix, /v_entrega_itens_por_op_id\s*>\s*0[\s\S]{0,260}v_blocked\s*:=\s*TRUE/i);
  assert.doesNotMatch(sqlFix, /existe entrega vinculada\. Exclua a entrega antes/i);
});

test('SQL36 OP com expedicao ou expedicao_itens continua blocked', () => {
  assert.match(sqlFix, /v_expedicoes\s*>\s*0\s+OR\s+v_expedicao_itens\s*>\s*0[\s\S]*v_blocked\s*:=\s*TRUE/i);
  assert.match(sqlFix, /existe expedicao vinculada/i);
  assert.match(sqlFix, /expedicao_itens[\s\S]*op_item_id\s*=\s*ANY\(v_target_op_itens\)/i);
});

test('SQL36 OP mae com filha sem expedicao entra em cascata', () => {
  assert.match(sqlFix, /v_filhas\s*>\s*0[\s\S]*v_cascade\s*:=\s*TRUE/i);
  assert.match(sqlFix, /target_child_ops/i);
  assert.match(sqlFix, /FOR\s+v_op_id\s+IN[\s\S]*unnest\(v_target_child_ops\)[\s\S]*DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*v_op_id/i);
});

test('SQL36 Pedido com OP e entrega_itens sem expedicao entra em cascata', () => {
  assert.match(sqlFix, /diagnosticar_impacto_pedido[\s\S]*v_entrega_itens_por_op_id\s*>\s*0[\s\S]*v_cascade\s*:=\s*TRUE/i);
  assert.match(sqlFix, /remover_pedido[\s\S]*p_confirmacao[\s\S]*EXCLUIR TUDO/i);
  assert.match(sqlFix, /DELETE\s+FROM\s+public\.op_latex_entregas[\s\S]*DELETE\s+FROM\s+public\.entrega_itens[\s\S]*DELETE\s+FROM\s+public\.entregas[\s\S]*v_remaining_entrega_item_ids[\s\S]*DELETE\s+FROM\s+public\.ops/i);
});

test('SQL36 mantem op_numeros fora de update/delete/insert', () => {
  assert.doesNotMatch(sqlFix, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.op_numeros/i);
  assert.doesNotMatch(sqlFix, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+op_numeros/i);
});

test('SQL37 expedição entra em cascata e nao fica blocked em staging/teste', () => {
  assert.match(sqlExpedicao, /CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2/i);
  assert.match(sqlExpedicao, /cascade_includes_expedicao/i);
  assert.match(sqlExpedicao, /v_expedicoes\s*>\s*0[\s\S]*v_cascade\s*:=\s*TRUE/i);
  assert.doesNotMatch(sqlExpedicao, /existe expedicao vinculada\. Exclua a expedicao antes/i);
  assert.doesNotMatch(sqlExpedicao, /v_expedicoes\s*>\s*0\s+OR\s+v_expedicao_itens\s*>\s*0[\s\S]{0,220}v_blocked\s*:=\s*TRUE/i);
});

test('SQL37 remove expedicao antes de entrega e ops', () => {
  assert.match(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicao_movimento_itens/i);
  assert.match(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicao_movimentos/i);
  assert.match(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicao_itens/i);
  assert.match(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicoes/i);
  assertOrder(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicao_movimentos/i, /DELETE\s+FROM\s+public\.expedicao_itens/i);
  assertOrder(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicao_itens/i, /DELETE\s+FROM\s+public\.expedicoes/i);
  assertOrder(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicoes/i, /DELETE\s+FROM\s+public\.op_latex_entregas/i);
  assertOrder(sqlExpedicao, /DELETE\s+FROM\s+public\.expedicoes/i, /DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*v_op_id/i);
});

test('SQL37 verifica remanescentes de expedicao antes de apagar OP/Pedido', () => {
  assert.match(sqlExpedicao, /v_remaining_expedicao_item_ids/i);
  assert.match(sqlExpedicao, /Exclusao interrompida: ainda existem itens de expedicao vinculados/i);
  assert.match(sqlExpedicao, /v_remaining_expedicao_ids/i);
  assert.match(sqlExpedicao, /Exclusao interrompida: ainda existem expedicoes vinculadas/i);
});

test('SQL37 mantem op_numeros fora de update/delete/insert', () => {
  assert.doesNotMatch(sqlExpedicao, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.op_numeros/i);
  assert.doesNotMatch(sqlExpedicao, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+op_numeros/i);
});

test('script staging mostra alvos FK e cobertura da cascata', () => {
  assert.match(stagingScript, /entrega_itens_por_op_id/);
  assert.match(stagingScript, /entrega_itens_por_op_item_id/);
  assert.match(stagingScript, /target_ops/);
  assert.match(stagingScript, /target_op_itens/);
  assert.match(stagingScript, /op_latex_entregas/);
  assert.match(stagingScript, /cascade_zera_entrega_itens_antes_de_ops/);
  assert.match(stagingScript, /cascade_inclui_expedicao/);
});

test('helper central expoe API RAVATEX_DELETE e chama RPCs', () => {
  assert.match(helper, /window\.RAVATEX_DELETE\s*=/);
  for (const fn of ['diagnosticarPedido', 'diagnosticarOP', 'removerPedido', 'removerOP', 'buildImpactSummary', 'showDeleteConfirmation']) {
    assert.match(helper, new RegExp(fn + '\\s*:', 'i'));
  }
  assert.match(helper, /window\.supa\.rpc\(\s*fn\s*,\s*params\s*\)/);
  for (const rpc of ['diagnosticar_impacto_pedido', 'diagnosticar_impacto_op', 'remover_pedido', 'remover_op']) {
    assert.match(helper, new RegExp(rpc));
  }
});

test('helper contem mensagens obrigatorias e relatorio antes da exclusao', () => {
  assert.match(helper, /Não é possível excluir: existe entrega vinculada\. Exclua a entrega antes\./);
  assert.doesNotMatch(helper, /Exclua a expedição antes\./);
  assert.match(helper, /A expedição vinculada entra na exclusão controlada de teste com EXCLUIR TUDO\./);
  assert.match(helper, /Não é possível excluir esta OP: existe OP de Acabamento vinculada\. Exclua a OP filha primeiro\./);
  assert.match(helper, /Digite EXCLUIR para confirmar\./);
  assert.match(helper, /Esta ação é irreversível no ambiente de testes\./);
  assert.match(helper, /EXCLUIR TUDO/);
  assert.match(helper, /requires_cascade_confirmation/);
  assert.match(helper, /cascade_required/);
  assert.match(helper, /confirmation_required/);
  assert.match(helper, /Impacto previsto/);
});

test('index carrega delete-helpers antes das telas que usam exclusao', () => {
  const helperIdx = index.indexOf('js/delete-helpers.js');
  assert.ok(helperIdx > 0, 'delete-helpers.js nao carregado');
  for (const src of ['js/screens/ops-list.js', 'js/screens/pedidos-list.js', 'js/screens/pedido-detail-events.js', 'js/screens/op-latex-admin.js']) {
    const idx = index.indexOf(src);
    assert.ok(idx > helperIdx, src + ' deve vir depois de delete-helpers.js');
  }
});

test('telas usam helper central e nao delete direto em pedidos/ops', () => {
  const bundle = [pedidosList, pedidoEvents, opsList, opNova, opTec, opLatex].join('\n');
  assert.match(bundle, /RAVATEX_DELETE\.excluirPedidoComFluxo/);
  assert.match(bundle, /RAVATEX_DELETE\.excluirOPComFluxo/);
  assert.doesNotMatch(bundle, /\.from\(\s*['"]ops['"]\s*\)[\s\S]{0,160}\.delete\s*\(/);
  assert.doesNotMatch(bundle, /\.from\(\s*['"]pedidos['"]\s*\)[\s\S]{0,160}\.delete\s*\(/);
});

test('botoes de exclusao aparecem nas telas principais', () => {
  assert.match(pedidosList, /Excluir Pedido/);
  assert.match(pedidoEvents, /buildDeleteButton/);
  assert.match(pedidoRender, /buildDeleteButton/);
  assert.match(opsList, /Excluir OP/);
  assert.match(opNova, /Excluir OP/);
  assert.match(opTec, /Excluir OP/);
  assert.match(opLatex, /excluirOpLatex[\s\S]*RAVATEX_DELETE\.excluirOPComFluxo/);
});

test('script staging e read-only e bloqueia producao', () => {
  assert.match(stagingScript, /READ-ONLY \/ SELECT only/);
  assert.match(stagingScript, /PROD_REF\s*=\s*['"]bhgifjrfagkzubpyqpew['"]/);
  assert.match(stagingScript, /STAGING_REF\s*=\s*['"]ucrjtfswnfdlxwtmxnoo['"]/);
  assert.doesNotMatch(stagingScript, /\/rest\/v1\/[\s\S]{0,160}method:\s*['"](POST|PATCH|DELETE|PUT)['"]/i);
  assert.doesNotMatch(stagingScript, /\.rpc\s*\(/i);
  assert.doesNotMatch(stagingScript, /\.(insert|update|delete|upsert)\s*\(/i);
});
