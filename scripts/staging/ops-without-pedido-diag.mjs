// =====================================================================
// === scripts/staging/ops-without-pedido-diag.mjs =====================
// Diagnostico READ-ONLY de OPs/lotes sem Pedido na PRODUCAO definitiva
// (ucrjtfswnfdlxwtmxnoo), somente leitura.
//
// - SOMENTE SELECT via PostgREST. Nenhum write/RPC/DDL.
// - Exige a flag exata --confirm-production-readonly-diagnostic.
// - Projeto retirado (gqmpsxkxynrjvidfmojk) e projeto proibido
//   (bhgifjrfagkzubpyqpew) sempre falham.
// - Nunca imprime anon key / password / JWT.
//
// Uso: node scripts/staging/ops-without-pedido-diag.mjs
// Config: .ravatex-local/admin-disable-user-e2e.config.json (gitignored)
// =====================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CONFIG = resolve(ROOT, '.ravatex-local', 'admin-disable-user-e2e.config.json');

// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1
// Identidades de ambiente correntes. Nao existe banco nao-produtivo.
const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';
const CONFIRM_FLAG = '--confirm-production-readonly-diagnostic';
const LIMIT_EXAMPLES = 25;

function die(msg) {
  console.error('ABORT: ' + msg);
  process.exit(1);
}

// Confirmacao booleana exata, exigida ANTES de ler credenciais, criar
// client, abrir conexao, emitir fetch ou escrever artefato local.
function assertProductionReadonlyDiagnostic() {
  if (!process.argv.slice(2).includes(CONFIRM_FLAG)) {
    die('diagnostico READ-ONLY contra a PRODUCAO (' + PRODUCTION_REF + ') exige a flag exata '
      + CONFIRM_FLAG + '. Nenhuma variavel de ambiente, valor de string ou --confirm generico a substitui.');
  }
}

function assertProductionTarget(label, value) {
  if (typeof value !== 'string' || !value) die(label + ' ausente ou invalido - bloqueado');
  if (value.includes(RETIRED_REF)) die(label + ' aponta para o projeto RETIRADO (' + RETIRED_REF + ') - bloqueado');
  if (value.includes(FORBIDDEN_REF)) die(label + ' aponta para o projeto PROIBIDO (' + FORBIDDEN_REF + ') - bloqueado');
  if (!value.includes(PRODUCTION_REF)) die(label + ' nao aponta para a producao autorizada (' + PRODUCTION_REF + ') - bloqueado');
}

function opLabel(op) {
  if (!op) return 'OP ?';
  return 'OP ' + (op.numero ?? '?') + '/' + (op.ano ?? '?') + ' (id ' + op.id + ')';
}

function keyTipoStatus(row) {
  return String(row.tipo || 'sem_tipo') + '::' + String(row.status || 'sem_status');
}

function inc(map, key) {
  map[key] = (map[key] || 0) + 1;
}

assertProductionReadonlyDiagnostic();

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const anonKey = cfg.anonKey;

if (!url || !anonKey || !cfg.adminEmail || !cfg.adminPassword) die('config incompleto em .ravatex-local');
assertProductionTarget('URL do Supabase', url);

console.log('Ambiente PRODUCAO (somente leitura):', url.replace(/https:\/\/([a-z0-9]+)\..*/, 'https://$1.supabase.co'));

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
  if (!res.ok) die('SELECT falhou (' + pathq + '): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 240));
  return res.json();
}

async function selOptional(pathq) {
  const res = await fetch(url + '/rest/v1/' + pathq, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + TOKEN },
  });
  if (!res.ok) {
    console.log('SELECT opcional indisponivel (' + pathq + '): HTTP ' + res.status);
    return [];
  }
  return res.json();
}

function printCounts(title, counts) {
  console.log('\n===== ' + title + ' =====');
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  if (!rows.length) {
    console.log('0');
    return;
  }
  rows.forEach(([key, total]) => {
    const [tipo, status] = key.split('::');
    console.log('tipo=' + tipo + ' status=' + status + ' total=' + total);
  });
}

function printExamples(title, rows) {
  console.log('\n===== ' + title + ' =====');
  if (!rows.length) {
    console.log('0');
    return;
  }
  rows.slice(0, LIMIT_EXAMPLES).forEach((op) => {
    console.log('  - ' + opLabel(op)
      + ' tipo=' + (op.tipo || 'NULL')
      + ' status=' + (op.status || 'NULL')
      + ' lote_id=' + (op.lote_id == null ? 'NULL' : op.lote_id)
      + ' lote_pedido_id=' + (op.lote && op.lote.pedido_id != null ? op.lote.pedido_id : 'NULL'));
  });
  if (rows.length > LIMIT_EXAMPLES) console.log('  ... +' + (rows.length - LIMIT_EXAMPLES) + ' exemplo(s)');
}

function byId(rows) {
  return Object.fromEntries(rows.map((row) => [String(row.id), row]));
}

function unique(values) {
  return [...new Set(values.filter((v) => v != null).map((v) => String(v)))];
}

function summarizeIds(rows) {
  if (!rows.length) return '0';
  return rows.map((row) => '#' + row.id).join(',');
}

function classifyOrphan(ctx) {
  if (ctx.pedidoIdsInferidos.length > 0) return 'C) orfa com possivel Pedido inferivel';
  if (ctx.temMovimentacao) return 'B) orfa com movimentacao';
  if (ctx.op.status === 'aberta' || ctx.op.status === 'simulada' || !ctx.op.status) {
    return 'A) orfa sem movimentacao';
  }
  return 'D) legado sem correcao segura';
}

function buildOrphanContext(op, refs) {
  const opItemIds = refs.opItens
    .filter((item) => String(item.op_id) === String(op.id))
    .map((item) => String(item.id));
  const directEntregaItens = refs.entregaItens.filter((item) => (
    String(item.op_id) === String(op.id) || opItemIds.includes(String(item.op_item_id))
  ));
  const latexLinks = refs.opLatexEntregas.filter((link) => String(link.op_latex_id) === String(op.id));
  const entregaIds = unique([
    ...directEntregaItens.map((item) => item.entrega_id),
    ...latexLinks.map((link) => link.entrega_id),
    op.origem_entrega_id,
  ]);
  const expedicoesOp = refs.expedicoes.filter((exp) => String(exp.op_latex_id) === String(op.id));
  const expedicoesLote = op.lote_id == null ? [] : refs.expedicoes.filter((exp) => String(exp.lote_id) === String(op.lote_id));
  const expedicaoIds = unique([...expedicoesOp.map((exp) => exp.id), ...expedicoesLote.map((exp) => exp.id)]);
  const expedicaoItens = refs.expedicaoItens.filter((item) => (
    expedicaoIds.includes(String(item.expedicao_id)) || opItemIds.includes(String(item.op_item_id))
  ));
  const pedidoIdsPorOpItem = refs.opItens
    .filter((item) => String(item.op_id) === String(op.id) && item.pedido_item_id != null)
    .map((item) => refs.pedidoItemById[String(item.pedido_item_id)] && refs.pedidoItemById[String(item.pedido_item_id)].pedido_id);
  const pedidoIdsPorExpedicao = [
    ...expedicoesOp.map((exp) => exp.pedido_id),
    ...expedicoesLote.map((exp) => exp.pedido_id),
    ...expedicaoItens.map((item) => {
      const pedidoItem = item.pedido_item_id == null ? null : refs.pedidoItemById[String(item.pedido_item_id)];
      return pedidoItem && pedidoItem.pedido_id;
    }),
  ];
  const pedidoIdsInferidos = unique([...pedidoIdsPorOpItem, ...pedidoIdsPorExpedicao]);
  const temEntregas = entregaIds.length > 0;
  const temExpedicao = expedicoesOp.length > 0 || expedicoesLote.length > 0 || expedicaoItens.length > 0;
  const temMovimentacao = temEntregas || temExpedicao;
  const ctx = {
    op,
    opItemIds,
    entregaIds,
    latexLinks,
    expedicoesOp,
    expedicoesLote,
    expedicaoItens,
    pedidoIdsInferidos,
    temEntregas,
    temExpedicao,
    temMovimentacao,
  };
  ctx.classificacao = classifyOrphan(ctx);
  return ctx;
}

function printOrphanDetails(rows, refs) {
  console.log('\n===== DETALHE OPs ORFAS SEM PEDIDO =====');
  if (!rows.length) {
    console.log('0');
    return;
  }

  rows.forEach((op) => {
    const ctx = buildOrphanContext(op, refs);
    const lote = op.lote || {};
    console.log('  - op_id=' + op.id
      + ' numero=' + (op.numero ?? 'NULL')
      + ' ano=' + (op.ano ?? 'NULL')
      + ' tipo=' + (op.tipo || 'NULL')
      + ' status=' + (op.status || 'NULL')
      + ' lote_id=' + (op.lote_id == null ? 'NULL' : op.lote_id)
      + ' lote.numero=' + (lote.numero == null ? 'NULL' : lote.numero)
      + ' lote.pedido_id=' + (lote.pedido_id == null ? 'NULL' : lote.pedido_id)
      + ' criado_em=' + (op.criado_em || 'NULL'));
    console.log('    natureza=' + (op.tipo === 'latex' ? 'Latex/Acabamento' : 'Tecelagem/Origem')
      + ' | entregas_vinculadas=' + (ctx.temEntregas ? ctx.entregaIds.join(',') : '0')
      + ' | op_latex_entregas=' + summarizeIds(ctx.latexLinks));
    console.log('    expedicao_movimentacao=' + (ctx.temExpedicao ? 'sim' : 'nao')
      + ' | expedicoes_por_op=' + summarizeIds(ctx.expedicoesOp)
      + ' | expedicoes_por_lote=' + summarizeIds(ctx.expedicoesLote)
      + ' | expedicao_itens=' + summarizeIds(ctx.expedicaoItens));
    console.log('    pedido_inferivel=' + (ctx.pedidoIdsInferidos.length ? ctx.pedidoIdsInferidos.join(',') : 'nao')
      + ' | classificacao=' + ctx.classificacao);
  });
}

(async () => {
  TOKEN = await login();

  const ops = await sel(
    'ops?select=id,numero,ano,tipo,status,lote_id,origem_op_id,origem_entrega_id,criado_em,lote:lote_id(id,numero,pedido_id)&order=ano.asc,numero.asc,id.asc'
  );
  const lotes = await sel('lotes?select=id,numero,pedido_id&order=id.asc');
  const opItens = await sel('op_itens?select=id,op_id,pedido_item_id&order=id.asc');
  const pedidoItens = await sel('pedido_itens?select=id,pedido_id&order=id.asc');
  const entregaItens = await sel('entrega_itens?select=id,entrega_id,op_id,op_item_id,metros_entregues,defeito&order=id.asc');
  const opLatexEntregas = await sel('op_latex_entregas?select=id,op_latex_id,entrega_id&order=id.asc');
  const expedicoes = await selOptional('expedicoes?select=id,pedido_id,op_latex_id,lote_id,status&order=id.asc');
  const expedicaoItens = await selOptional('expedicao_itens?select=id,expedicao_id,op_item_id,pedido_item_id,metros_liberados&order=id.asc');

  const opsSemLote = ops.filter((op) => op.lote_id == null);
  const opsLoteSemPedido = ops.filter((op) => op.lote_id != null && op.lote && op.lote.pedido_id == null);
  const orphanLoteIds = new Set(opsLoteSemPedido.map((op) => String(op.lote_id)));
  const lotesSemPedidoComOps = lotes.filter((lote) => lote.pedido_id == null && orphanLoteIds.has(String(lote.id)));

  const countsSemLote = {};
  opsSemLote.forEach((op) => inc(countsSemLote, keyTipoStatus(op)));
  const countsLoteSemPedido = {};
  opsLoteSemPedido.forEach((op) => inc(countsLoteSemPedido, keyTipoStatus(op)));

  console.log('\n===== RESUMO =====');
  console.log('OPs analisadas:', ops.length);
  console.log('Lotes analisados:', lotes.length);
  console.log('OPs com lote_id NULL:', opsSemLote.length);
  console.log('OPs cujo lote.pedido_id IS NULL:', opsLoteSemPedido.length);
  console.log('Lotes com pedido_id IS NULL vinculados a OPs:', lotesSemPedidoComOps.length);

  printCounts('CONTAGEM OPs COM lote_id NULL POR tipo/status', countsSemLote);
  printCounts('CONTAGEM OPs COM lote.pedido_id NULL POR tipo/status', countsLoteSemPedido);
  printExamples('EXEMPLOS OPs COM lote_id NULL', opsSemLote);
  printExamples('EXEMPLOS OPs COM lote.pedido_id NULL', opsLoteSemPedido);
  printOrphanDetails([...opsSemLote, ...opsLoteSemPedido], {
    opItens,
    pedidoItemById: byId(pedidoItens),
    entregaItens,
    opLatexEntregas,
    expedicoes,
    expedicaoItens,
  });

  console.log('\n===== LOTES SEM PEDIDO VINCULADOS A OPs =====');
  if (!lotesSemPedidoComOps.length) {
    console.log('0');
  } else {
    lotesSemPedidoComOps.slice(0, LIMIT_EXAMPLES).forEach((lote) => {
      const linkedOps = ops.filter((op) => String(op.lote_id) === String(lote.id));
      console.log('  - lote #' + lote.numero + ' id=' + lote.id + ' pedido_id=NULL | ops='
        + linkedOps.map((op) => opLabel(op)).join(', '));
    });
    if (lotesSemPedidoComOps.length > LIMIT_EXAMPLES) {
      console.log('  ... +' + (lotesSemPedidoComOps.length - LIMIT_EXAMPLES) + ' lote(s)');
    }
  }

  console.log('\n===== VEREDITO =====');
  const totalOrfas = opsSemLote.length + opsLoteSemPedido.length + lotesSemPedidoComOps.length;
  if (totalOrfas > 0) {
    console.log('STATUS ALERTA - existem OPs/lotes sem Pedido vinculado.');
    process.exitCode = 2;
  } else {
    console.log('STATUS OK - nenhuma OP/lote orfao detectado.');
  }
})().catch((e) => die(e && e.message ? e.message : String(e)));
