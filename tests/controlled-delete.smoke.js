const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '34_controlled_delete_pedido_op.sql');
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

const sql = read(SQL);
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
    assert.match(sql, new RegExp('CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + fn, 'i'));
    assert.match(sql, new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + fn, 'i'));
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
  assert.match(sql, /diagnosticar_impacto_op[\s\S]*v_entregas\s*>\s*0[\s\S]*existe entrega vinculada/i);
  assert.match(sql, /diagnosticar_impacto_op[\s\S]*v_expedicoes\s*>\s*0[\s\S]*existe expedicao vinculada/i);
  assert.match(sql, /diagnosticar_impacto_op[\s\S]*v_filhas\s*>\s*0[\s\S]*OP de Acabamento vinculada/i);
});

test('SQL desativa bloqueio legado por OP numerada em modo teste', () => {
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+ops_numeradas_no_delete\s+ON\s+public\.ops/i);
  assert.match(sql, /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.ops_numeradas_no_delete_fn\s*\(\s*\)/i);
  assert.doesNotMatch(sql, /nao pode ser removida fisicamente/i);
  assert.doesNotMatch(sql, /Use cancelamento\/arquivamento\/consolidacao com rastro/i);
});

test('SQL permite remocao de OP sem bloqueadores e nao altera op_numeros', () => {
  assert.match(sql, /DELETE\s+FROM\s+public\.ops\s+WHERE\s+id\s*=\s*p_op_id/i);
  assert.doesNotMatch(sql, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.op_numeros/i);
  assert.doesNotMatch(sql, /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+op_numeros/i);
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
  assert.match(helper, /Não é possível excluir: existe expedição vinculada\. Exclua a expedição antes\./);
  assert.match(helper, /Não é possível excluir esta OP: existe OP de Acabamento vinculada\. Exclua a OP filha primeiro\./);
  assert.match(helper, /Digite EXCLUIR para confirmar\./);
  assert.match(helper, /Esta ação é irreversível no ambiente de testes\./);
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
