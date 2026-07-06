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

function classifyPedido(c) {
  if (c.expedicoes > 0) return { classification: 'blocked', reason: 'expedicao' };
  if (c.entregas > 0 || c.ops_filhas > 0 || c.ops_filhas_nao_tratadas > 0) {
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
  if (c.expedicoes > 0) return { classification: 'blocked', reason: 'expedicao' };
  if (c.entregas > 0 || c.ops_filhas > 0) {
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

  console.log('\n===== PEDIDOS =====');
  pedidos
    .filter((pedido) => !pedidoFilter || pedido.id === pedidoFilter)
    .forEach((pedido) => {
      const loteIds = lotes.filter((lote) => lote.pedido_id === pedido.id).map((lote) => lote.id);
      const pedidoOps = ops.filter((op) => loteIds.includes(op.lote_id));
      const opIds = pedidoOps.map((op) => op.id);
      const entregaIds = uniq(entregaItens.filter((item) => opIds.includes(item.op_id)).map((item) => item.entrega_id));
      const expIds = expedicoes.filter((exp) => exp.pedido_id === pedido.id || opIds.includes(exp.op_latex_id)).map((exp) => exp.id);
      const c = {
        pedido_itens: count(pedidoItens, (row) => row.pedido_id === pedido.id),
        pedido_eventos: count(pedidoEventos, (row) => row.pedido_id === pedido.id),
        pedido_cliente_eventos: count(pedidoClienteEventos, (row) => row.pedido_id === pedido.id),
        pedido_parciais: count(pedidoParciais, (row) => row.pedido_id === pedido.id),
        pedido_parcial_itens: count(pedidoParcialItens, (row) => parcialById[String(row.parcial_id)]?.pedido_id === pedido.id),
        lotes: loteIds.length,
        ops_vinculadas: pedidoOps.length,
        ops_tecelagem: count(pedidoOps, (op) => (op.tipo || 'tecelagem') === 'tecelagem'),
        ops_latex_acabamento: count(pedidoOps, (op) => op.tipo === 'latex'),
        entregas: entregaIds.length,
        entrega_itens: count(entregaItens, (row) => opIds.includes(row.op_id)),
        expedicoes: expIds.length,
        expedicao_itens: count(expedicaoItens, (row) => expIds.includes(row.expedicao_id)),
        expedicao_movimentos: count(expedicaoMovimentos, (row) => expIds.includes(row.expedicao_id)),
        op_eventos: count(opEventos, (row) => opIds.includes(row.op_id)),
        op_itens: count(opItens, (row) => opIds.includes(row.op_id)),
        op_latex_entregas: count(opLatexEntregas, (row) => opIds.includes(row.op_latex_id) || entregaIds.includes(row.entrega_id)),
        ops_filhas: count(ops, (op) => opIds.includes(op.origem_op_id)),
        ops_filhas_nao_tratadas: count(ops, (op) => opIds.includes(op.origem_op_id) && !opIds.includes(op.id)),
      };
      const cls = classifyPedido(c);
      console.log('Pedido #' + pedido.numero + ' id=' + pedido.id + ' status=' + pedido.status + ' -> ' + cls.classification + ' (' + cls.reason + ') ' + JSON.stringify(c));
    });

  console.log('\n===== OPS =====');
  ops
    .filter((op) => !opFilter || String(op.id) === String(opFilter))
    .forEach((op) => {
      const expIds = expedicoes.filter((exp) => exp.op_latex_id === op.id).map((exp) => exp.id);
      const c = {
        op_itens: count(opItens, (row) => row.op_id === op.id),
        op_eventos: count(opEventos, (row) => row.op_id === op.id),
        op_fornecedores: count(opFornecedores, (row) => row.op_id === op.id),
        ordens_compra_fio: count(ordensFio, (row) => row.op_id === op.id),
        saldo_fios_op: count(saldoFiosOp, (row) => row.op_id === op.id),
        entregas: uniq(entregaItens.filter((row) => row.op_id === op.id).map((row) => row.entrega_id)).length,
        entrega_itens: count(entregaItens, (row) => row.op_id === op.id),
        expedicoes: expIds.length,
        expedicao_itens: count(expedicaoItens, (row) => expIds.includes(row.expedicao_id)),
        ops_filhas: count(ops, (row) => row.origem_op_id === op.id),
        op_mae: op.origem_op_id == null ? 0 : 1,
        op_latex_entregas: count(opLatexEntregas, (row) => row.op_latex_id === op.id),
      };
      const cls = classifyOp(c);
      console.log('OP ' + op.numero + '/' + op.ano + ' id=' + op.id + ' tipo=' + (op.tipo || 'tecelagem') + ' status=' + op.status + ' -> ' + cls.classification + ' (' + cls.reason + ') ' + JSON.stringify(c));
    });
})();
