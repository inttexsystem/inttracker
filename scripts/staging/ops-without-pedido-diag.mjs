// =====================================================================
// === scripts/staging/ops-without-pedido-diag.mjs =====================
// Diagnostico READ-ONLY de OPs/lotes sem Pedido em Supabase STAGING.
//
// - SOMENTE SELECT via PostgREST. Nenhum write/RPC/DDL.
// - Bloqueia se a URL for producao (bhgifjrfagkzubpyqpew).
// - Exige staging (ucrjtfswnfdlxwtmxnoo).
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

const PROD_REF = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';
const LIMIT_EXAMPLES = 25;

function die(msg) {
  console.error('ABORT: ' + msg);
  process.exit(1);
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

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const anonKey = cfg.anonKey;

if (!url || !anonKey || !cfg.adminEmail || !cfg.adminPassword) die('config incompleto em .ravatex-local');
if (url.includes(PROD_REF)) die('URL aponta para PRODUCAO - bloqueado');
if (!url.includes(STAGING_REF)) die('URL nao e staging autorizado (' + STAGING_REF + ')');

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
  if (!res.ok) die('SELECT falhou (' + pathq + '): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 240));
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

(async () => {
  TOKEN = await login();

  const ops = await sel(
    'ops?select=id,numero,ano,tipo,status,lote_id,criado_em,lote:lote_id(id,numero,pedido_id)&order=ano.asc,numero.asc,id.asc'
  );
  const lotes = await sel('lotes?select=id,numero,pedido_id&order=id.asc');

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
    console.log('STATUS ALERTA - existem OPs/lotes sem Pedido vinculado em staging.');
    process.exitCode = 2;
  } else {
    console.log('STATUS OK - nenhuma OP/lote orfao detectado em staging.');
  }
})().catch((e) => die(e && e.message ? e.message : String(e)));
