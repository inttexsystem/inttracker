// =====================================================================
// === scripts/staging/delete-impact-diag.mjs ==========================
// Diagnostico READ-ONLY de impacto de exclusao controlada em STAGING.
//
// - Somente SELECT via PostgREST.
// - Bloqueia producao.
// - Lista Pedidos e OPs como safe / requires_confirmation /
//   requires_cascade_confirmation / blocked.
// - Filtros opcionais: PEDIDO_ID=uuid OP_ID=123 ou args
//   --pedido-id=uuid --op-id=123.
// =====================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CONFIG = resolve(ROOT, '.ravatex-local', 'admin-disable-user-e2e.config.json');

const PROD_REF = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

function die(msg) {
  console.error('ABORT: ' + msg);
  process.exit(1);
}

function argValue(name) {
  const prefix = '--' + name + '=';
  const item = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

const pedidoFilter = process.env.PEDIDO_ID || argValue('pedido-id');
const opFilter = process.env.OP_ID || argValue('op-id');

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const anonKey = cfg.anonKey;
if (!url || !anonKey || !cfg.adminEmail || !cfg.adminPassword) die('config incompleto');
if (url.includes(PROD_REF)) die('URL aponta para PRODUCAO - bloqueado');
if (!url.includes(STAGING_REF)) die('URL nao e staging autorizado');

console.log('Ambiente staging:', url.replace(/https:\/\/([a-z0-9]+)\..*/, 'https://$1.supabase.co'));
console.log('Modo: READ-ONLY / SELECT only');

async function login() {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.adminEmail, password: cfg.adminPassword }),
  });
  if (!res.ok) die('login admin falhou: HTTP ' + res.status);
  const body = await res.json();
  if (!body.access_token) die('login sem access_token');
  return body.access_token;
}

let TOKEN;
async function sel(pathq) {
  const res = await fetch(url + '/rest/v1/' + pathq, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + TOKEN },
  });
  if (!res.ok) die('SELECT falhou (' + pathq + '): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 220));
  return res.json();
}

function byId(rows) {
  return Object.fromEntries((rows || []).map((row) => [String(row.id), row]));
}

function count(rows, pred) {
  return (rows || []).filter(pred).length;
}

function uniq(values) {
  return Array.from(new Set(values.filter((value) => value != null)));
}

function summarizeIds(ids, max = 12) {
  const clean = uniq(ids);
  const head = clean.slice(0, max).join(',');
  return '[' + head + (clean.length > max ? ',...' : '') + ']';
}

function collectTargetOps(rootIds, opsByParent) {
  const out = [];
  const seen = new Set();
  const queue = rootIds.filter((id) => id != null);
  while (queue.length) {
    const id = queue.shift();
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
    (opsByParent.get(key) || []).forEach((child) => queue.push(child.id));
  }
  return out;
}

function classifyPedido(c) {
  if (c.expedicoes > 0 || c.expedicao_itens > 0 || c.expedicao_movimentos > 0 || c.entregas > 0 || c.entrega_itens_por_op_id > 0 || c.entrega_itens_por_op_item_id > 0 || c.op_latex_entregas > 0 || c.ops_filhas > 0 || c.ops_filhas_nao_tratadas > 0) {
    return {
      classification: 'requires_cascade_confirmation',
      reason: 'cadeia_produtiva_teste',
      cascade_required: true,
      confirmation_required: 'EXCLUIR TUDO'
    };
  }
  if (c.ops_vinculadas > 0) return { classification: 'requires_confirmation', reason: 'ops_sem_movimento' };
  return { classification: 'safe', reason: 'sem_cadeia_produtiva' };
}

function classifyOp(c) {
  if (c.expedicoes > 0 || c.expedicao_itens > 0 || c.expedicao_movimentos > 0 || c.entregas > 0 || c.entrega_itens_por_op_id > 0 || c.entrega_itens_por_op_item_id > 0 || c.op_latex_entregas > 0 || c.ops_filhas > 0) {
    return {
      classification: 'requires_cascade_confirmation',
      reason: 'cadeia_produtiva_teste',
      cascade_required: true,
      confirmation_required: 'EXCLUIR TUDO'
    };
  }
  if ((c.op_itens + c.op_eventos + c.op_fornecedores + c.ordens_compra_fio + c.saldo_fios_op + c.op_latex_entregas) > 0) {
    return { classification: 'requires_confirmation', reason: 'dependencias_sem_movimento' };
  }
  return { classification: 'safe', reason: 'sem_dependencias' };
}

(async () => {
  TOKEN = await login();

  const [
    pedidos,
    lotes,
    ops,
    pedidoItens,
    pedidoEventos,
    pedidoClienteEventos,
    pedidoParciais,
    pedidoParcialItens,
    opItens,
    opEventos,
    opFornecedores,
    ordensFio,
    saldoFiosOp,
    entregaItens,
    expedicoes,
    expedicaoItens,
    expedicaoMovimentos,
    opLatexEntregas,
  ] = await Promise.all([
    sel('pedidos?select=id,numero,status,cliente_id,criado_em&order=criado_em.desc&limit=500'),
    sel('lotes?select=id,numero,pedido_id,cliente_id&limit=2000'),
    sel('ops?select=id,numero,ano,tipo,status,lote_id,origem_op_id,criado_em&limit=3000'),
    sel('pedido_itens?select=id,pedido_id&limit=5000'),
    sel('pedido_eventos?select=id,pedido_id&limit=5000'),
    sel('pedido_cliente_eventos?select=id,pedido_id&limit=5000'),
    sel('pedido_parciais?select=id,pedido_id&limit=5000'),
    sel('pedido_parcial_itens?select=id,parcial_id&limit=5000'),
    sel('op_itens?select=id,op_id&limit=5000'),
    sel('op_eventos?select=id,op_id&limit=5000'),
    sel('op_fornecedores?select=id,op_id&limit=5000'),
    sel('ordens_compra_fio?select=id,op_id&limit=5000'),
    sel('saldo_fios_op?select=id,op_id&limit=5000'),
    sel('entrega_itens?select=id,entrega_id,op_id,op_item_id&limit=5000'),
    sel('expedicoes?select=id,pedido_id,op_latex_id&limit=5000'),
    sel('expedicao_itens?select=id,expedicao_id,op_item_id&limit=5000'),
    sel('expedicao_movimentos?select=id,expedicao_id&limit=5000'),
    sel('op_latex_entregas?select=id,op_latex_id,entrega_id&limit=5000'),
  ]);

  const parcialById = byId(pedidoParciais);
  const opsByParent = new Map();
  ops.forEach((op) => {
    if (op.origem_op_id == null) return;
    const key = String(op.origem_op_id);
    if (!opsByParent.has(key)) opsByParent.set(key, []);
    opsByParent.get(key).push(op);
  });

  console.log('\n===== PEDIDOS =====');
  pedidos
    .filter((pedido) => !pedidoFilter || pedido.id === pedidoFilter)
    .forEach((pedido) => {
      const loteIds = lotes.filter((lote) => lote.pedido_id === pedido.id).map((lote) => lote.id);
      const rootOps = ops.filter((op) => loteIds.includes(op.lote_id));
      const rootOpIds = rootOps.map((op) => op.id);
      const targetOpIds = collectTargetOps(rootOpIds, opsByParent);
      const targetChildOpIds = targetOpIds.filter((id) => !rootOpIds.includes(id));
      const targetOpItemIds = opItens.filter((item) => targetOpIds.includes(item.op_id)).map((item) => item.id);
      const targetChildOpItemIds = opItens.filter((item) => targetChildOpIds.includes(item.op_id)).map((item) => item.id);
      const entregaItensByOpId = entregaItens.filter((item) => targetOpIds.includes(item.op_id));
      const entregaItensByOpItemId = entregaItens.filter((item) => targetOpItemIds.includes(item.op_item_id));
      const entregaIds = uniq([
        ...entregaItensByOpId.map((item) => item.entrega_id),
        ...entregaItensByOpItemId.map((item) => item.entrega_id),
        ...opLatexEntregas.filter((link) => targetOpIds.includes(link.op_latex_id)).map((link) => link.entrega_id),
      ]);
      const opLatexLinks = opLatexEntregas.filter((link) => targetOpIds.includes(link.op_latex_id) || entregaIds.includes(link.entrega_id));
      const expIdsFromOpItems = expedicaoItens.filter((item) => targetOpItemIds.includes(item.op_item_id)).map((item) => item.expedicao_id);
      const expIds = uniq([
        ...expedicoes.filter((exp) => exp.pedido_id === pedido.id || targetOpIds.includes(exp.op_latex_id)).map((exp) => exp.id),
        ...expIdsFromOpItems,
      ]);
      const c = {
        pedido_itens: count(pedidoItens, (row) => row.pedido_id === pedido.id),
        pedido_eventos: count(pedidoEventos, (row) => row.pedido_id === pedido.id),
        pedido_cliente_eventos: count(pedidoClienteEventos, (row) => row.pedido_id === pedido.id),
        pedido_parciais: count(pedidoParciais, (row) => row.pedido_id === pedido.id),
        pedido_parcial_itens: count(pedidoParcialItens, (row) => parcialById[String(row.parcial_id)]?.pedido_id === pedido.id),
        lotes: loteIds.length,
        ops_vinculadas: targetOpIds.length,
        ops_tecelagem: count(ops, (op) => targetOpIds.includes(op.id) && (op.tipo || 'tecelagem') === 'tecelagem'),
        ops_latex_acabamento: count(ops, (op) => targetOpIds.includes(op.id) && op.tipo === 'latex'),
        entregas: entregaIds.length,
        entrega_itens: entregaItensByOpId.length + entregaItensByOpItemId.length,
        entrega_itens_por_op_id: entregaItensByOpId.length,
        entrega_itens_por_op_item_id: entregaItensByOpItemId.length,
        expedicoes: expIds.length,
        expedicao_itens: count(expedicaoItens, (row) => expIds.includes(row.expedicao_id) || targetOpItemIds.includes(row.op_item_id)),
        expedicao_movimentos: count(expedicaoMovimentos, (row) => expIds.includes(row.expedicao_id)),
        op_eventos: count(opEventos, (row) => targetOpIds.includes(row.op_id)),
        op_itens: targetOpItemIds.length,
        op_itens_filhas: targetChildOpItemIds.length,
        op_latex_entregas: opLatexLinks.length,
        ops_filhas: targetChildOpIds.length,
        ops_filhas_nao_tratadas: 0,
        target_ops: targetOpIds.length,
        target_op_itens: targetOpItemIds.length,
        cascade_can_zero_entrega_itens_before_ops: true,
        cascade_includes_expedicao: expIds.length > 0,
      };
      const cls = classifyPedido(c);
      console.log('Pedido #' + pedido.numero + ' id=' + pedido.id + ' status=' + pedido.status + ' -> ' + cls.classification + ' (' + cls.reason + ') ' + JSON.stringify(c));
      console.log('  targets: target_ops=' + summarizeIds(targetOpIds)
        + ' target_op_itens=' + summarizeIds(targetOpItemIds)
        + ' target_entregas=' + summarizeIds(entregaIds)
        + ' op_latex_entregas=' + summarizeIds(opLatexLinks.map((link) => link.id))
        + ' cascade_zera_entrega_itens_antes_de_ops=sim'
        + ' cascade_inclui_expedicao=' + (expIds.length > 0 ? 'sim' : 'nao'));
    });

  console.log('\n===== OPS =====');
  ops
    .filter((op) => !opFilter || String(op.id) === String(opFilter))
    .forEach((op) => {
      const targetOpIds = collectTargetOps([op.id], opsByParent);
      const targetChildOpIds = targetOpIds.filter((id) => id !== op.id);
      const targetOpItemIds = opItens.filter((item) => targetOpIds.includes(item.op_id)).map((item) => item.id);
      const targetChildOpItemIds = opItens.filter((item) => targetChildOpIds.includes(item.op_id)).map((item) => item.id);
      const entregaItensByOpId = entregaItens.filter((item) => targetOpIds.includes(item.op_id));
      const entregaItensByOpItemId = entregaItens.filter((item) => targetOpItemIds.includes(item.op_item_id));
      const entregaIds = uniq([
        ...entregaItensByOpId.map((item) => item.entrega_id),
        ...entregaItensByOpItemId.map((item) => item.entrega_id),
        ...opLatexEntregas.filter((link) => targetOpIds.includes(link.op_latex_id)).map((link) => link.entrega_id),
      ]);
      const opLatexLinks = opLatexEntregas.filter((link) => targetOpIds.includes(link.op_latex_id) || entregaIds.includes(link.entrega_id));
      const expIdsFromOpItems = expedicaoItens.filter((item) => targetOpItemIds.includes(item.op_item_id)).map((item) => item.expedicao_id);
      const expIds = uniq([
        ...expedicoes.filter((exp) => targetOpIds.includes(exp.op_latex_id)).map((exp) => exp.id),
        ...expIdsFromOpItems,
      ]);
      const c = {
        op_itens: targetOpItemIds.length,
        op_itens_filhas: targetChildOpItemIds.length,
        op_eventos: count(opEventos, (row) => targetOpIds.includes(row.op_id)),
        op_fornecedores: count(opFornecedores, (row) => targetOpIds.includes(row.op_id)),
        ordens_compra_fio: count(ordensFio, (row) => targetOpIds.includes(row.op_id)),
        saldo_fios_op: count(saldoFiosOp, (row) => targetOpIds.includes(row.op_id)),
        entregas: entregaIds.length,
        entrega_itens: entregaItensByOpId.length + entregaItensByOpItemId.length,
        entrega_itens_por_op_id: entregaItensByOpId.length,
        entrega_itens_por_op_item_id: entregaItensByOpItemId.length,
        expedicoes: expIds.length,
        expedicao_itens: count(expedicaoItens, (row) => expIds.includes(row.expedicao_id) || targetOpItemIds.includes(row.op_item_id)),
        expedicao_movimentos: count(expedicaoMovimentos, (row) => expIds.includes(row.expedicao_id)),
        ops_filhas: targetChildOpIds.length,
        op_mae: op.origem_op_id == null ? 0 : 1,
        op_latex_entregas: opLatexLinks.length,
        target_ops: targetOpIds.length,
        target_op_itens: targetOpItemIds.length,
        cascade_can_zero_entrega_itens_before_ops: true,
        cascade_includes_expedicao: expIds.length > 0,
      };
      const cls = classifyOp(c);
      console.log('OP ' + op.numero + '/' + op.ano + ' id=' + op.id + ' tipo=' + (op.tipo || 'tecelagem') + ' status=' + op.status + ' -> ' + cls.classification + ' (' + cls.reason + ') ' + JSON.stringify(c));
      console.log('  targets: target_ops=' + summarizeIds(targetOpIds)
        + ' target_op_itens=' + summarizeIds(targetOpItemIds)
        + ' target_entregas=' + summarizeIds(entregaIds)
        + ' op_latex_entregas=' + summarizeIds(opLatexLinks.map((link) => link.id))
        + ' cascade_zera_entrega_itens_antes_de_ops=sim'
        + ' cascade_inclui_expedicao=' + (expIds.length > 0 ? 'sim' : 'nao'));
    });
})();
