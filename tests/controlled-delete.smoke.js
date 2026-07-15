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
const SQL53 = path.join(ROOT, 'db', '53_controlled_delete_document_link_guard.sql');
const SQL54 = path.join(ROOT, 'db', '54_controlled_delete_document_link_grants.sql');
const SQL56 = path.join(ROOT, 'db', '56_controlled_delete_document_link_diagnostics_null_safe.sql');
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

function fnBlock(src, name) {
  const re = new RegExp(
    'CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + name + '[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$'
  );
  const m = src.match(re);
  assert.ok(m, 'funcao ' + name + ' encontrada');
  return m[1];
}

const sql = read(SQL);
const sqlCascade = read(SQL_CASCADE);
const sqlFix = read(SQL_FIX);
const sqlExpedicao = read(SQL_EXPEDICAO);
const sql53 = read(SQL53);
const sql54 = read(SQL54);
const sql56 = read(SQL56);
const sqlAll = sql + '\n' + sqlCascade + '\n' + sqlFix + '\n' + sqlExpedicao + '\n' + sql53 + '\n' + sql54;
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
  assert.match(opTec, /BTN_HDR_DANGER[\s\S]{0,120}['"]Excluir['"]/);
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

test('SQL53 renomeia quatro RPCs legadas para _pre53 e revoga acesso publico', () => {
  for (const fn of ['diagnosticar_impacto_pedido', 'diagnosticar_impacto_op', 'remover_pedido', 'remover_op']) {
    assert.match(sql53, new RegExp('ALTER\\s+FUNCTION\\s+public\\.' + fn + '\\s*\\([^)]*\\)\\s+RENAME\\s+TO\\s+' + fn + '_pre53', 'i'));
  }
  for (const fn of ['diagnosticar_impacto_pedido_pre53', 'diagnosticar_impacto_op_pre53', 'remover_pedido_pre53', 'remover_op_pre53']) {
    assert.match(sql53, new RegExp('REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + fn, 'i'));
    assert.doesNotMatch(sql53, new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + fn, 'i'));
  }
});

test('SQL53 recria quatro RPCs publicas com grant authenticated', () => {
  for (const fn of ['diagnosticar_impacto_pedido', 'diagnosticar_impacto_op', 'remover_pedido', 'remover_op']) {
    assert.match(sql53, new RegExp('CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + fn, 'i'));
    assert.match(sql53, new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + fn, 'i'));
  }
});

test('SQL53 diagnostico OP chama pre53 e enriquece contagens documentais', () => {
  const body = fnBlock(sql53, 'diagnosticar_impacto_op');
  assert.match(body, /diagnosticar_impacto_op_pre53\s*\(\s*p_op_id\s*\)/i);
  assert.match(body, /v_pre->'impacto'->'ids'->'target_ops'/i);
  assert.match(body, /document_link_revision_ops/i);
  assert.match(body, /document_link_revisions/i);
  assert.match(body, /documentos_vinculados/i);
  assert.match(body, /documentary_history_blocker/i);
  assert.match(body, /v_doc_link_revision_ops\s*>\s*0[\s\S]*v_blocked\s*:=\s*TRUE/i);
  assert.match(body, /jsonb_set\s*\(\s*v_impacto\s*,\s*'\{classification\}'\s*,\s*'"blocked"'/i);
  assert.ok(body.indexOf('{documentary_history_blocker}') < body.indexOf('{counts,'), 'documentary_history_blocker deve estar diretamente em impacto, nao so aninhado em counts');
  assert.match(body, /'\{documentary_history_blocker\}'\s*,\s*to_jsonb\s*\(\s*v_doc_link_revision_ops\s*>\s*0\s*\)/i);
  assert.match(body, /v_blocked\s*:=\s*COALESCE\s*\(\s*\(\s*v_pre->>'blocked'\s*\)::BOOLEAN\s*,\s*FALSE\s*\)/i);
  assert.match(body, /v_reason\s*:=\s*v_pre->>'reason'/i);
});

test('SQL53 diagnostico Pedido chama pre53 e bloqueia por OP ou pedido_id direto', () => {
  const body = fnBlock(sql53, 'diagnosticar_impacto_pedido');
  assert.match(body, /diagnosticar_impacto_pedido_pre53\s*\(\s*p_pedido_id\s*\)/i);
  assert.match(body, /v_pre->'impacto'->'ids'->'target_ops'/i);
  assert.match(body, /document_link_revision_ops/i);
  assert.match(body, /document_link_revisions/i);
  assert.match(body, /documentos_vinculados/i);
  assert.match(body, /documentary_history_blocker/i);
  assert.match(body, /dlr\.pedido_id\s*=\s*p_pedido_id/i);
  assert.match(body, /v_doc_link_revision_ops\s*>\s*0\s+OR\s+v_doc_link_revisions\s*>\s*0[\s\S]*v_blocked\s*:=\s*TRUE/i);
  assert.ok(body.indexOf('{documentary_history_blocker}') < body.indexOf('{counts,'), 'documentary_history_blocker deve estar diretamente em impacto, nao so aninhado em counts');
  assert.match(body, /'\{documentary_history_blocker\}'\s*,\s*to_jsonb\s*\(\s*v_doc_link_revision_ops\s*>\s*0\s+OR\s+v_doc_link_revisions\s*>\s*0\s*\)/i);
  assert.match(body, /v_blocked\s*:=\s*COALESCE\s*\(\s*\(\s*v_pre->>'blocked'\s*\)::BOOLEAN\s*,\s*FALSE\s*\)/i);
  assert.match(body, /v_reason\s*:=\s*v_pre->>'reason'/i);
});

test('SQL53 considera TODO o historico, inclusive revisoes inactive', () => {
  const diagOp = fnBlock(sql53, 'diagnosticar_impacto_op');
  const diagPedido = fnBlock(sql53, 'diagnosticar_impacto_pedido');
  assert.doesNotMatch(diagOp, /active\s+IS\s+TRUE[\s\S]{0,120}document_link_revision_ops/i);
  assert.doesNotMatch(diagPedido, /active\s+IS\s+TRUE[\s\S]{0,120}document_link_revisions/i);
});

test('SQL53 nao contem DELETE direto nem muta tabelas de historico documental/op_numeros', () => {
  assert.doesNotMatch(sql53, /DELETE\s+FROM\s+public\.ops/i);
  assert.doesNotMatch(sql53, /DELETE\s+FROM\s+public\.pedidos/i);
  assert.doesNotMatch(sql53, /DELETE\s+FROM\s+public\.lotes/i);
  assert.doesNotMatch(sql53, /DELETE\s+FROM\s+public\.expedicoes/i);
  assert.doesNotMatch(sql53, /DELETE\s+FROM\s+public\.entregas/i);
  assert.doesNotMatch(sql53, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.document_link_revisions/i);
  assert.doesNotMatch(sql53, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.document_link_revision_ops/i);
  assert.doesNotMatch(sql53, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.op_numeros/i);
  assert.doesNotMatch(sql53, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+op_numeros/i);
});

test('SQL53 remover_op invoca diagnostico novo e bloqueia antes de delegar pre53', () => {
  const body = fnBlock(sql53, 'remover_op');
  assert.match(body, /v_diag\s*:=\s*public\.diagnosticar_impacto_op\s*\(\s*p_op_id\s*\)/i);
  assert.match(body, /v_diag->>'blocked'[\s\S]*RETURN\s+jsonb_set\s*\(\s*v_diag/i);
  assert.match(body, /RETURN\s+public\.remover_op_pre53\s*\(\s*p_op_id\s*,\s*p_confirmacao\s*\)/i);
  assertOrder(body,
    /v_diag\s*:=\s*public\.diagnosticar_impacto_op\s*\(\s*p_op_id\s*\)/i,
    /RETURN\s+public\.remover_op_pre53\s*\(\s*p_op_id\s*,\s*p_confirmacao\s*\)/i,
    'diagnostico deve vir antes da delegacao a pre53 em remover_op'
  );
});

test('SQL53 remover_pedido invoca diagnostico novo e bloqueia antes de delegar pre53', () => {
  const body = fnBlock(sql53, 'remover_pedido');
  assert.match(body, /v_diag\s*:=\s*public\.diagnosticar_impacto_pedido\s*\(\s*p_pedido_id\s*\)/i);
  assert.match(body, /v_diag->>'blocked'[\s\S]*RETURN\s+jsonb_set\s*\(\s*v_diag/i);
  assert.match(body, /RETURN\s+public\.remover_pedido_pre53\s*\(\s*p_pedido_id\s*,\s*p_confirmacao\s*\)/i);
  assertOrder(body,
    /v_diag\s*:=\s*public\.diagnosticar_impacto_pedido\s*\(\s*p_pedido_id\s*\)/i,
    /RETURN\s+public\.remover_pedido_pre53\s*\(\s*p_pedido_id\s*,\s*p_confirmacao\s*\)/i,
    'diagnostico deve vir antes da delegacao a pre53 em remover_pedido'
  );
});

test('SQL53 delegacao pre53 preserva argumentos e confirmacao', () => {
  const opBody = fnBlock(sql53, 'remover_op');
  const pedidoBody = fnBlock(sql53, 'remover_pedido');
  assert.match(opBody, /remover_op_pre53\s*\(\s*p_op_id\s*,\s*p_confirmacao\s*\)/i);
  assert.match(pedidoBody, /remover_pedido_pre53\s*\(\s*p_pedido_id\s*,\s*p_confirmacao\s*\)/i);
});

test('SQL54 existe como correcao de seguranca aditiva', () => {
  assert.ok(fs.existsSync(SQL54), 'arquivo SQL54 ausente');
  assert.match(sql54, /CONTROLLED-DELETE-DOCUMENT-LINK-GRANTS-54/i);
  assert.match(sql54, /correcao de seguranca/i);
});

test('SQL54 revoga PUBLIC e anon nas quatro RPCs publicas', () => {
  for (const fn of [
    'public.diagnosticar_impacto_pedido(UUID)',
    'public.diagnosticar_impacto_op(BIGINT)',
    'public.remover_pedido(UUID, TEXT)',
    'public.remover_op(BIGINT, TEXT)'
  ]) {
    const lower = sql54.toLowerCase();
    assert.ok(lower.includes(`revoke execute on function ${fn.toLowerCase()} from public`), fn + ' deve revogar PUBLIC');
    assert.ok(lower.includes(`revoke execute on function ${fn.toLowerCase()} from anon`), fn + ' deve revogar anon');
  }
});

test('SQL54 concede EXECUTE somente a authenticated nas quatro RPCs publicas', () => {
  for (const fn of [
    'public.diagnosticar_impacto_pedido(UUID)',
    'public.diagnosticar_impacto_op(BIGINT)',
    'public.remover_pedido(UUID, TEXT)',
    'public.remover_op(BIGINT, TEXT)'
  ]) {
    assert.ok(sql54.toLowerCase().includes(`grant execute on function ${fn.toLowerCase()} to authenticated`), fn + ' deve conceder a authenticated');
  }
  assert.doesNotMatch(sql54, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(diagnosticar_impacto_pedido|diagnosticar_impacto_op|remover_pedido|remover_op)\s+TO\s+(anon|PUBLIC|service_role)/i);
});

test('SQL54 nao contem DDL/DML perigosos', () => {
  const executableSql54 = sql54.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(executableSql54, /CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
  assert.doesNotMatch(executableSql54, /ALTER\s+FUNCTION/i);
  assert.doesNotMatch(executableSql54, /DELETE\s+FROM/i);
  assert.doesNotMatch(executableSql54, /UPDATE\s+/i);
  assert.doesNotMatch(executableSql54, /INSERT\s+INTO/i);
  assert.doesNotMatch(executableSql54, /DROP\s+/i);
});

test('helper expoe contagens documentais no impacto', () => {
  assert.match(helper, /document_link_revision_ops/);
  assert.match(helper, /document_link_revisions/);
  assert.match(helper, /documentos_vinculados/);
});

test('helper mapeia mensagem documental e bloqueia modal sem onConfirm', { concurrency: false }, async () => {
  const g = globalThis;
  g.window = {
    el: function (tag, attrs, ...children) {
      const flat = (children || []).flat();
      return { tag, attrs, children: flat, appendChild: function (c) { this.children.push(c); } };
    },
    modal: function (opts) { g.lastModal = opts; },
    toast: function () {}
  };
  delete require.cache[require.resolve(HELPER)];
  require(HELPER);
  const api = g.window.RAVATEX_DELETE;
  assert.ok(api, 'RAVATEX_DELETE exposto');
  const summary = api.buildImpactSummary({ counts: { document_link_revision_ops: 3, document_link_revisions: 2, documentos_vinculados: 1 } });
  const keys = summary.map(function (r) { return r.key; });
  assert.ok(keys.includes('document_link_revision_ops'), 'summary inclui document_link_revision_ops');
  assert.ok(keys.includes('document_link_revisions'), 'summary inclui document_link_revisions');
  assert.ok(keys.includes('documentos_vinculados'), 'summary inclui documentos_vinculados');

  let confirmCalled = false;
  api.showDeleteConfirmation({
    tipo: 'OP',
    impacto: {
      blocked: true,
      classification: 'blocked',
      counts: { document_link_revision_ops: 2, document_link_revisions: 1, documentos_vinculados: 1 },
      documentary_history_blocker: true
    },
    blocked: true,
    reason: 'Exclusao fisica bloqueada: existe historico canonico de vinculos documentais.',
    onConfirm: function () { confirmCalled = true; return true; }
  });
  assert.ok(g.lastModal, 'modal foi aberto');
  assert.equal(g.lastModal.saveLabel, 'Fechar', 'rotulo salvar deve ser Fechar quando bloqueado');
  const saveResult = await g.lastModal.onSave();
  assert.equal(saveResult, true, 'onSave retorna true sem executar acao');
  assert.equal(confirmCalled, false, 'onConfirm nao deve ser invocado quando bloqueado');

  delete g.window;
  delete g.lastModal;
});

test('SQL56 existe e documenta a correcao do colapso NULL das diagnosticas documentais', () => {
  assert.ok(fs.existsSync(SQL56), 'arquivo SQL56 ausente');
  assert.match(sql56, /CONTROLLED-DELETE-DOCUMENT-LINK-DIAGNOSTICS-NULL-SAFE-56/i);
});

test('SQL56 redefine as duas diagnosticas publicas com CREATE OR REPLACE', () => {
  for (const fn of ['diagnosticar_impacto_op', 'diagnosticar_impacto_pedido']) {
    assert.match(sql56, new RegExp('CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + fn + '\\b', 'i'));
  }
});

test('SQL56 usa construcao null-safe COALESCE(to_jsonb(v_reason), \'null\'::jsonb) nas duas diagnosticas', () => {
  const nullSafePattern = /'\{reason\}',\s*COALESCE\(\s*to_jsonb\(v_reason\)\s*,\s*'null'::jsonb\s*\)\s*,\s*TRUE/i;
  const opBody = fnBlock(sql56, 'diagnosticar_impacto_op');
  const pedidoBody = fnBlock(sql56, 'diagnosticar_impacto_pedido');
  assert.match(opBody, nullSafePattern, 'diagnosticar_impacto_op deve usar COALESCE null-safe em reason');
  assert.match(pedidoBody, nullSafePattern, 'diagnosticar_impacto_pedido deve usar COALESCE null-safe em reason');
});

test('SQL56 nao contem o padrao vulneravel to_jsonb(v_reason) sem COALESCE', () => {
  const vulnerablePattern = /'\{reason\}',\s*to_jsonb\(v_reason\),\s*TRUE/i;
  const opBody = fnBlock(sql56, 'diagnosticar_impacto_op');
  const pedidoBody = fnBlock(sql56, 'diagnosticar_impacto_pedido');
  assert.doesNotMatch(opBody, vulnerablePattern, 'diagnosticar_impacto_op nao deve ter to_jsonb(v_reason) direto sem COALESCE');
  assert.doesNotMatch(pedidoBody, vulnerablePattern, 'diagnosticar_impacto_pedido nao deve ter to_jsonb(v_reason) direto sem COALESCE');
});

test('SQL56 nao redefine remover_op, remover_pedido, funcoes *_pre53 nem grants/revokes', () => {
  const executableSql56 = sql56.replace(/^\s*--.*$/gm, '');
  // Chamar/delegar para as funcoes *_pre53 e esperado (preserva a logica original);
  // o que nao pode ocorrer e a REDEFINICAO (CREATE OR REPLACE / ALTER / RENAME) delas,
  // nem de remover_op/remover_pedido, nem qualquer GRANT/REVOKE.
  assert.doesNotMatch(executableSql56, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.remover_op\b/i);
  assert.doesNotMatch(executableSql56, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.remover_pedido\b/i);
  assert.doesNotMatch(executableSql56, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.\w*_pre53\b/i);
  assert.doesNotMatch(executableSql56, /ALTER\s+FUNCTION\s+public\.\w+/i);
  assert.doesNotMatch(executableSql56, /RENAME\s+TO\s+\w*_pre53\b/i);
  assert.doesNotMatch(executableSql56, /\bGRANT\s+EXECUTE\b/i);
  assert.doesNotMatch(executableSql56, /\bREVOKE\s+EXECUTE\b/i);
});

test('SQL56 limita-se as duas diagnosticas publicas (nenhuma outra CREATE OR REPLACE FUNCTION)', () => {
  const matches = sql56.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.\w+/gi) || [];
  const names = matches.map(function (m) {
    return m.replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\./i, '').trim();
  });
  assert.deepEqual(new Set(names), new Set(['diagnosticar_impacto_op', 'diagnosticar_impacto_pedido']));
});
