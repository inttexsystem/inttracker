// =====================================================================
// === scripts/staging/latex-consolidation-diag.mjs ====================
// Diagnóstico READ-ONLY do fluxo TECELAGEM -> ACABAMENTO/LÁTEX em
// Supabase STAGING (ucrjtfswnfdlxwtmxnoo).
//
// Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-CONSOLIDATED-LATEX-OP-A
//
// Objetivo: determinar se JÁ existem OPs de Látex duplicadas por
// (origem_op_id + fornecedor de acabamento) — sintoma do bug "cada
// parcial gera uma OP" — e se essas OPs já têm produção/expedição
// (o que dispara escalonamento antes de qualquer migration).
//
// - SOMENTE SELECT. Nenhum write, nenhum RPC, nenhuma migration.
// - Bloqueia se a URL for produção (bhgifjrfagkzubpyqpew).
// - Exige URL de staging (ucrjtfswnfdlxwtmxnoo).
// - Nunca imprime anon key, password, JWT ou tokens.
//
// Uso:  node scripts/staging/latex-consolidation-diag.mjs
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
const email = cfg.adminEmail;
const password = cfg.adminPassword;

if (!url || !anonKey || !email || !password) die('config incompleto em .ravatex-local');
if (url.includes(PROD_REF)) die('URL aponta para PRODUÇÃO — bloqueado por segurança');
if (!url.includes(STAGING_REF)) die('URL não é o staging autorizado (' + STAGING_REF + ')');

console.log('Ambiente staging:', url.replace(/https:\/\/([a-z0-9]+)\..*/, 'https://$1.supabase.co'));

async function login() {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) die('login admin falhou: HTTP ' + res.status);
  const body = await res.json();
  if (!body.access_token) die('login sem access_token');
  return body.access_token;
}

async function sel(token, pathq) {
  const res = await fetch(url + '/rest/v1/' + pathq, {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
  });
  if (!res.ok) {
    const t = await res.text();
    die('SELECT falhou (' + pathq + '): HTTP ' + res.status + ' ' + t.slice(0, 200));
  }
  return res.json();
}

function fornecedorLatex(op) {
  const row = (op.op_fornecedores || []).find((f) => f.etapa === 'latex');
  return row ? row.fornecedor_id : null;
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

(async () => {
  const token = await login();

  const latexOps = await sel(token,
    'ops?tipo=eq.latex&select=id,numero,ano,status,origem_op_id,origem_entrega_id,lote_id,op_fornecedores(fornecedor_id,etapa),op_itens(id,modelo_id,metros_pedidos)&order=id.asc');
  const allOps = await sel(token, 'ops?select=id,numero,ano,tipo,status,lote_id&order=id.asc');
  const cimaEntregas = await sel(token,
    'entregas?etapa=eq.cima&select=id,fornecedor_id,destino_fornecedor_id,data,entrega_itens(id,op_id,op_item_id,metros_entregues,defeito)&order=id.asc');
  const expedicoes = await sel(token, 'expedicoes?select=id,op_latex_id,status,pedido_id&order=id.asc');
  const fornecedores = await sel(token, 'fornecedores?select=id,nome,tipo&order=id.asc');

  const fornById = Object.fromEntries(fornecedores.map((f) => [f.id, f.nome]));
  const opById = Object.fromEntries(allOps.map((o) => [o.id, o]));
  const expByLatex = {};
  expedicoes.forEach((e) => { (expByLatex[e.op_latex_id] = expByLatex[e.op_latex_id] || []).push(e); });

  console.log('\n================ RESUMO DE CONTAGENS ================');
  console.log('OPs totais:', allOps.length,
    '| tecelagem:', allOps.filter((o) => o.tipo !== 'latex').length,
    '| latex:', allOps.filter((o) => o.tipo === 'latex').length);
  console.log('Entregas cima (tecelagem):', cimaEntregas.length);
  console.log('Expedições:', expedicoes.length);

  // ---- Q1: Duplicidade de OP Látex por (origem_op_id, fornecedor latex)
  console.log('\n===== Q1: OPs LÁTEX DUPLICADAS por (origem_op_id + fornecedor acabamento) =====');
  const groups = {};
  latexOps.forEach((op) => {
    const key = op.origem_op_id + '::' + fornecedorLatex(op);
    (groups[key] = groups[key] || []).push(op);
  });
  const dupGroups = Object.entries(groups).filter(([, ops]) => ops.length > 1);
  if (dupGroups.length === 0) {
    console.log('OK — nenhuma duplicidade. Cada (origem_op_id, fornecedor) tem no máximo 1 OP látex.');
  } else {
    console.log('!!! ' + dupGroups.length + ' grupo(s) COM DUPLICIDADE (bug materializado):');
    dupGroups.forEach(([key, ops]) => {
      const [origemOpId, fornId] = key.split('::');
      const origem = opById[origemOpId];
      console.log('  origem_op ' + (origem ? origem.numero + '/' + origem.ano : '#' + origemOpId)
        + ' | fornecedor látex: ' + (fornById[fornId] || '#' + fornId)
        + ' | ' + ops.length + ' OPs látex:');
      ops.forEach((op) => {
        const exps = expByLatex[op.id] || [];
        console.log('      - OP ' + op.numero + '/' + op.ano + ' (id ' + op.id + ') status=' + op.status
          + ' origem_entrega_id=' + op.origem_entrega_id
          + ' | op_itens=' + (op.op_itens || []).length
          + ' | expedições=' + exps.length + (exps.length ? ' [' + exps.map((e) => '#' + e.id + ':' + e.status).join(',') + ']' : ''));
      });
    });
  }

  // ---- Q2: OPs látex órfãs (origem_entrega_id null ou apontando p/ entrega inexistente)
  console.log('\n===== Q2: OPs LÁTEX ÓRFÃS / vínculo de origem =====');
  const cimaIds = new Set(cimaEntregas.map((e) => e.id));
  const orphan = latexOps.filter((op) => op.origem_entrega_id == null || !cimaIds.has(op.origem_entrega_id));
  console.log('latex_orfas (origem_entrega_id nula ou sem entrega cima):', orphan.length);
  orphan.forEach((op) => console.log('  - OP ' + op.numero + '/' + op.ano + ' id=' + op.id + ' origem_entrega_id=' + op.origem_entrega_id + ' status=' + op.status));

  // ---- Q3: Estado de produção/expedição das OPs látex (gatilho de escalonamento)
  console.log('\n===== Q3: ESTADO DAS OPs LÁTEX (produção/expedição já em curso?) =====');
  const beyondAberta = latexOps.filter((op) => op.status && op.status !== 'aberta');
  const comExped = latexOps.filter((op) => (expByLatex[op.id] || []).length > 0);
  console.log('OPs látex com status != aberta (em_producao/finalizada):', beyondAberta.length);
  beyondAberta.forEach((op) => console.log('  - OP ' + op.numero + '/' + op.ano + ' status=' + op.status));
  console.log('OPs látex já com expedição vinculada:', comExped.length);
  comExped.forEach((op) => console.log('  - OP ' + op.numero + '/' + op.ano + ' -> exp ' + (expByLatex[op.id] || []).map((e) => '#' + e.id + ':' + e.status).join(',')));

  // ---- Q4: Mapeamento entrega cima -> latex OP atual vs. destino consolidado esperado
  console.log('\n===== Q4: ENTREGAS CIMA — vínculo atual (origem_entrega_id) vs. chave consolidada esperada =====');
  const latexByOrigemEntrega = {};
  latexOps.forEach((op) => { if (op.origem_entrega_id != null) latexByOrigemEntrega[op.origem_entrega_id] = op; });
  cimaEntregas.forEach((ent) => {
    const itens = (ent.entrega_itens || []).filter((i) => !i.defeito && Number(i.metros_entregues) > 0);
    const opOrigemId = itens.length ? itens[0].op_id : null;
    const opOrigem = opOrigemId ? opById[opOrigemId] : null;
    const metros = round2(itens.reduce((a, i) => a + Number(i.metros_entregues || 0), 0));
    const cur = latexByOrigemEntrega[ent.id];
    const expectedKey = opOrigemId + '::' + ent.destino_fornecedor_id;
    const consolidatedGroup = groups[expectedKey] || [];
    console.log('  entrega #' + ent.id + ' data=' + ent.data
      + ' | op_origem=' + (opOrigem ? opOrigem.numero + '/' + opOrigem.ano : '#' + opOrigemId)
      + ' | destino_latex=' + (fornById[ent.destino_fornecedor_id] || '#' + ent.destino_fornecedor_id)
      + ' | metros_ok=' + metros
      + ' | OP látex atual(por origem_entrega)=' + (cur ? cur.numero + '/' + cur.ano : 'nenhuma')
      + ' | chave-consolidada agruparia ' + consolidatedGroup.length + ' OP(s)');
  });

  // ---- Veredicto
  console.log('\n================ VEREDICTO ================');
  const dupCount = dupGroups.reduce((a, [, ops]) => a + ops.length, 0);
  const dupWithProd = dupGroups.some(([, ops]) => ops.some((op) => (op.status && op.status !== 'aberta') || (expByLatex[op.id] || []).length > 0));
  if (dupGroups.length === 0) {
    console.log('SEM duplicidade materializada. Correção pode ser estrutural (schema+RPC+guard+UI) sem merge de dados.');
    console.log('Ainda assim, aplicar SOMENTE em staging e revalidar.');
  } else if (dupWithProd) {
    console.log('DUPLICIDADE COM PRODUÇÃO/EXPEDIÇÃO — ESCALONAR (merge de dados não trivial, risco de histórico).');
  } else {
    console.log('DUPLICIDADE SEM produção/expedição — merge de dados possível, porém ainda requer plano de migration cuidadoso.');
  }
  console.log('Grupos duplicados:', dupGroups.length, '| OPs látex envolvidas em duplicidade:', dupCount);
})().catch((e) => die(e && e.message ? e.message : String(e)));
