// =====================================================================
// === scripts/staging/production-flow-invariants-diag.mjs =============
// Diagnóstico READ-ONLY do fluxo produtivo inteiro em Supabase STAGING
// (ucrjtfswnfdlxwtmxnoo): Pedido -> Tecelagem -> Acabamento/Látex.
//
// Fase: RAVATEX-TAPETES-PRODUCTION-FLOW-FULL-INVARIANT-AUDIT-AND-FIX-A
//
// - SOMENTE SELECT via PostgREST. Nenhum write/RPC/DDL.
// - Bloqueia se a URL for produção (bhgifjrfagkzubpyqpew).
// - Exige staging (ucrjtfswnfdlxwtmxnoo).
// - Nunca imprime anon key / password / JWT.
//
// Uso:  node scripts/staging/production-flow-invariants-diag.mjs
// Config: .ravatex-local/admin-disable-user-e2e.config.json (gitignored)
// =====================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CONFIG = resolve(ROOT, '.ravatex-local', 'admin-disable-user-e2e.config.json');

const PROD_REF = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

function die(msg) { console.error('ABORT: ' + msg); process.exit(1); }

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const anonKey = cfg.anonKey;
if (!url || !anonKey || !cfg.adminEmail || !cfg.adminPassword) die('config incompleto');
if (url.includes(PROD_REF)) die('URL aponta para PRODUÇÃO — bloqueado');
if (!url.includes(STAGING_REF)) die('URL não é staging autorizado');

console.log('Ambiente staging:', url.replace(/https:\/\/([a-z0-9]+)\..*/, 'https://$1.supabase.co'));

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
  if (!res.ok) die('SELECT falhou (' + pathq + '): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function selOptional(pathq) {
  const res = await fetch(url + '/rest/v1/' + pathq, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + TOKEN },
  });
  if (!res.ok) {
    console.log('SELECT opcional indisponivel (' + pathq + '): HTTP ' + res.status);
    return null;
  }
  return res.json();
}

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const opLbl = (o) => o ? (o.numero + '/' + o.ano) : '—';

(async () => {
  TOKEN = await login();

  const fornecedores = await sel('fornecedores?select=id,nome,tipo');
  const fornById = Object.fromEntries(fornecedores.map((f) => [f.id, f.nome]));

  // ---- 2.1 / 2.2  Pedido 17 -> lotes -> ops (link é via lote_id; ops NÃO tem pedido_id)
  console.log('\n===== [2.1/2.2] PEDIDO 17 -> LOTES -> OPs (vínculo por lote_id) =====');
  const ped = await sel('pedidos?numero=eq.17&select=id,numero,status');
  if (!ped.length) { console.log('Pedido 17 não encontrado.'); }
  const pedido = ped[0];
  const lotes = pedido ? await sel('lotes?pedido_id=eq.' + pedido.id + '&select=id,numero,pedido_id') : [];
  const loteIds = lotes.map((l) => l.id);
  console.log('pedido_id=' + (pedido && pedido.id) + ' status=' + (pedido && pedido.status) + ' | lotes=' + JSON.stringify(loteIds));
  let pedidoOps = [];
  if (loteIds.length) {
    pedidoOps = await sel('ops?lote_id=in.(' + loteIds.join(',') + ')&select=id,numero,ano,tipo,status,origem_op_id,origem_entrega_id,destino_fornecedor_id,lote_id,criado_em&order=criado_em.asc');
  }
  pedidoOps.forEach((o) => console.log('  OP ' + opLbl(o) + ' id=' + o.id + ' tipo=' + o.tipo + ' status=' + o.status
    + ' origem_op_id=' + o.origem_op_id + ' destino=' + (o.destino_fornecedor_id ? fornById[o.destino_fornecedor_id] : '—')
    + ' lote=' + o.lote_id + ' criado=' + o.criado_em));

  // ---- 2.3 Todas OPs látex + origem + destino
  console.log('\n===== [2.3] OPs LÁTEX (origem + destino) =====');
  const latexOps = await sel('ops?tipo=eq.latex&select=id,numero,ano,tipo,status,origem_op_id,origem_entrega_id,destino_fornecedor_id,criado_em&order=ano.asc,numero.asc');
  const opById = Object.fromEntries((await sel('ops?select=id,numero,ano,tipo,status')).map((o) => [o.id, o]));
  latexOps.forEach((o) => console.log('  OP ' + opLbl(o) + ' id=' + o.id + ' status=' + o.status
    + ' | origem=' + opLbl(opById[o.origem_op_id]) + '(id ' + o.origem_op_id + ',' + (opById[o.origem_op_id] ? opById[o.origem_op_id].tipo : '?') + ')'
    + ' | origem_entrega_id=' + o.origem_entrega_id
    + ' | destino=' + (o.destino_fornecedor_id ? fornById[o.destino_fornecedor_id] : 'NULL') + '(id ' + o.destino_fornecedor_id + ')'
    + ' | criado=' + o.criado_em));

  // ---- 2.4 OP 4/2026 atual
  console.log('\n===== [2.4] OP 4/2026 ATUAL =====');
  const op4 = latexOps.filter((o) => o.numero === 4 && o.ano === 2026);
  op4.forEach((o) => console.log('  id=' + o.id + ' origem=' + opLbl(opById[o.origem_op_id]) + '(id ' + o.origem_op_id + ') destino=' + (fornById[o.destino_fornecedor_id] || o.destino_fornecedor_id) + ' status=' + o.status + ' criado=' + o.criado_em));
  const op18 = await sel('ops?id=eq.18&select=id,numero,ano,tipo');
  console.log('  id antigo 18 existe?', op18.length ? 'SIM ' + JSON.stringify(op18) : 'NÃO (removido pela db/25)');

  // ---- 2.5 Duplicatas por chave canônica
  console.log('\n===== [2.5] DUPLICATAS por (origem_op_id, destino_fornecedor_id) [tipo=latex] =====');
  const grp = {};
  latexOps.forEach((o) => { const k = o.origem_op_id + '::' + o.destino_fornecedor_id; (grp[k] = grp[k] || []).push(o); });
  const dups = Object.entries(grp).filter(([, a]) => a.length > 1);
  console.log(dups.length ? ('!!! ' + dups.length + ' grupo(s) DUPLICADO(s): ' + JSON.stringify(dups.map(([k, a]) => ({ k, ops: a.map(opLbl) })))) : 'OK — 0 duplicatas.');

  // ---- 2.6 op_latex_entregas N:1
  console.log('\n===== [2.6] op_latex_entregas (N entregas -> 1 OP) =====');
  const links = await sel('op_latex_entregas?select=id,op_latex_id,entrega_id,criado_em&order=op_latex_id.asc,entrega_id.asc');
  const entregas = await sel('entregas?etapa=eq.cima&select=id,etapa,data,fornecedor_id,destino_fornecedor_id,criado_em&order=id.asc');
  const entById = Object.fromEntries(entregas.map((e) => [e.id, e]));
  const linkByEntrega = {};
  links.forEach((l) => { (linkByEntrega[l.entrega_id] = linkByEntrega[l.entrega_id] || []).push(l.op_latex_id); });
  links.forEach((l) => console.log('  entrega #' + l.entrega_id + ' -> OP ' + opLbl(opById[l.op_latex_id]) + ' (op_latex_id ' + l.op_latex_id + ')'));
  const multi = Object.entries(linkByEntrega).filter(([, a]) => a.length > 1);
  console.log('  entregas em múltiplas OPs látex:', multi.length ? JSON.stringify(multi) : '0 (OK)');

  // ---- 2.7 op_itens das OPs látex (soma por modelo)
  console.log('\n===== [2.7] op_itens das OPs LÁTEX (soma metros_pedidos por modelo) =====');
  const latexIds = latexOps.map((o) => o.id);
  const litens = latexIds.length ? await sel('op_itens?op_id=in.(' + latexIds.join(',') + ')&select=op_id,modelo_id,metros_pedidos') : [];
  const byOp = {};
  litens.forEach((i) => { const k = i.op_id + '::' + i.modelo_id; byOp[k] = (byOp[k] || 0) + Number(i.metros_pedidos || 0); });
  const rowsPerOpModelo = {};
  litens.forEach((i) => { const k = i.op_id + '::' + i.modelo_id; rowsPerOpModelo[k] = (rowsPerOpModelo[k] || 0) + 1; });
  Object.entries(byOp).forEach(([k, m]) => { const [opId, mod] = k.split('::'); console.log('  OP ' + opLbl(opById[opId]) + ' (id ' + opId + ') modelo ' + mod + ' = ' + r2(m) + ' m | linhas op_itens=' + rowsPerOpModelo[k]); });

  // ---- 2.8 op_eventos (histórico) das OPs látex + OP 15 tecelagem
  console.log('\n===== [2.8] op_eventos (histórico) — OP 15 tecelagem + OPs látex =====');
  const op15 = (await sel('ops?numero=eq.15&ano=eq.2026&select=id,numero,ano,tipo,status,lote_id,origem_op_id'))[0];
  const evIds = [...latexIds];
  if (op15) evIds.push(op15.id);
  const eventos = evIds.length ? await sel('op_eventos?op_id=in.(' + evIds.join(',') + ')&select=op_id,tipo_evento,status_anterior,status_novo,observacao,criado_em&order=criado_em.asc') : [];
  if (!eventos.length) console.log('  (nenhum op_evento)');
  eventos.forEach((e) => console.log('  OP ' + opLbl(opById[e.op_id]) + ' | ' + e.tipo_evento + ' ' + (e.status_anterior || '') + '->' + (e.status_novo || '') + ' | obs=' + (e.observacao || '') + ' | ' + e.criado_em));

  // ---- INVARIANTES de fluxo
  console.log('\n===== INVARIANTES DE FLUXO =====');
  const latexSemDestino = latexOps.filter((o) => o.destino_fornecedor_id == null);
  const latexSemOrigem = latexOps.filter((o) => o.origem_op_id == null);
  const cimaSemVinculo = entregas.filter((e) => !linkByEntrega[e.id]);
  console.log('OPs látex sem destino_fornecedor_id:', latexSemDestino.length, latexSemDestino.map(opLbl).join(',') || '');
  console.log('OPs látex sem origem_op_id:', latexSemOrigem.length, latexSemOrigem.map(opLbl).join(',') || '');
  console.log('Entregas cima SEM vínculo op_latex_entregas (podem ser pré-látex/aguardando):', cimaSemVinculo.length,
    cimaSemVinculo.map((e) => '#' + e.id + '(destino ' + (fornById[e.destino_fornecedor_id] || e.destino_fornecedor_id) + ')').join(', '));

  // Numeração: colisões numero/ano/tipo e "buracos" (delete físico -> reaproveitamento)
  console.log('\n===== NUMERAÇÃO (numero/ano por tipo) =====');
  const allOps = await sel('ops?select=id,numero,ano,tipo,status&order=tipo.asc,ano.asc,numero.asc');
  const numKey = {};
  allOps.forEach((o) => { const k = o.tipo + ' ' + o.numero + '/' + o.ano; (numKey[k] = numKey[k] || []).push(o.id); });
  const numDup = Object.entries(numKey).filter(([, a]) => a.length > 1);
  console.log('Colisões (mesmo tipo+numero+ano em >1 id):', numDup.length ? JSON.stringify(numDup) : '0 (OK)');
  const byTipoAno = {};
  allOps.forEach((o) => { const k = o.tipo + '::' + o.ano; (byTipoAno[k] = byTipoAno[k] || []).push(o.numero); });
  Object.entries(byTipoAno).forEach(([k, nums]) => {
    nums.sort((a, b) => a - b);
    const max = nums[nums.length - 1];
    const missing = [];
    for (let i = 1; i <= max; i++) if (!nums.includes(i)) missing.push(i);
    console.log('  ' + k + ' -> usados [' + nums.join(',') + '] max=' + max + ' | buracos(possível delete/reuso)=' + (missing.length ? '[' + missing.join(',') + ']' : 'nenhum'));
  });

  console.log('\n===== OP_NUMEROS (db/26 high-water) =====');
  const opNumeros = await selOptional('op_numeros?select=tipo,ano,ultimo_numero,updated_at&order=tipo.asc,ano.asc');
  if (!opNumeros) {
    console.log('op_numeros indisponivel: db/26 ainda nao aplicada ou policy ausente.');
  } else if (!opNumeros.length) {
    console.log('op_numeros vazia: verificar backfill da db/26.');
  } else {
    opNumeros.forEach((row) => {
      const key = row.tipo + '::' + row.ano;
      const maxAtual = byTipoAno[key] && byTipoAno[key].length ? Math.max(...byTipoAno[key]) : 0;
      const ok = Number(row.ultimo_numero || 0) >= maxAtual;
      console.log('  ' + key + ' ultimo_numero=' + row.ultimo_numero + ' max_ops_atual=' + maxAtual + ' -> ' + (ok ? 'OK' : '!!! MENOR QUE MAX OPS'));
    });
  }

  console.log('\n================ FIM ================');
})().catch((e) => die(e && e.message ? e.message : String(e)));
