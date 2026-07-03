// =====================================================================
// === scripts/staging/latex-merge-precheck.mjs ========================
// Gate READ-ONLY de pré-merge para reconciliar OPs Látex duplicadas
// no staging antes do índice UNIQUE parcial.
//
// Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-CONSOLIDATED-LATEX-OP-A
//
// Valida, por SELECT, o contrato exigido antes de autorizar o merge:
//   - ambas tipo='latex';
//   - mesma origem_op_id;
//   - mesmo destino_fornecedor_id (op_fornecedores etapa='latex');
//   - ambas status='aberta';
//   - zero entregas latex (recebimentos) em cada OP;
//   - zero expedições;
//   - zero movimentos de expedição.
// Se QUALQUER condição falhar -> imprime STOP e sai != 0.
//
// SOMENTE SELECT. Bloqueia produção. Não imprime segredos.
// =====================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const CONFIG = resolve(ROOT, '.ravatex-local', 'admin-disable-user-e2e.config.json');
const PROD_REF = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

// Grupo(s) a reconciliar: canônica (manter) + redundante(s) (mesclar).
const CANONICAL_ID = 17; // OP 3/2026 (mais antiga)
const REDUNDANT_IDS = [18]; // OP 4/2026

function die(msg) { console.error('ABORT: ' + msg); process.exit(1); }

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const url = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
const anonKey = cfg.anonKey;
if (url.includes(PROD_REF)) die('URL de PRODUÇÃO — bloqueado');
if (!url.includes(STAGING_REF)) die('URL não é staging autorizado');

async function login() {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.adminEmail, password: cfg.adminPassword }),
  });
  if (!res.ok) die('login falhou HTTP ' + res.status);
  return (await res.json()).access_token;
}
async function sel(token, q) {
  const res = await fetch(url + '/rest/v1/' + q, { headers: { apikey: anonKey, Authorization: 'Bearer ' + token } });
  if (!res.ok) die('SELECT falhou (' + q + '): HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

(async () => {
  const token = await login();
  const ids = [CANONICAL_ID, ...REDUNDANT_IDS];
  const idList = ids.join(',');

  const ops = await sel(token,
    'ops?id=in.(' + idList + ')&select=id,numero,ano,tipo,status,origem_op_id,origem_entrega_id,lote_id,op_fornecedores(fornecedor_id,etapa),op_itens(id,modelo_id,metros_pedidos)');
  // Recebimentos latex: entrega_itens ligados a estas OPs cuja entrega é etapa='latex'.
  const eiLatex = await sel(token,
    'entrega_itens?op_id=in.(' + idList + ')&select=id,op_id,entrega_id,metros_entregues,entregas!inner(id,etapa)&entregas.etapa=eq.latex');
  const exps = await sel(token, 'expedicoes?op_latex_id=in.(' + idList + ')&select=id,op_latex_id,status');
  const cimaEnt = await sel(token,
    'entregas?etapa=eq.cima&select=id,destino_fornecedor_id,entrega_itens(op_id,metros_entregues,defeito)');

  const byId = Object.fromEntries(ops.map((o) => [o.id, o]));
  const destinoOf = (op) => ((op.op_fornecedores || []).find((f) => f.etapa === 'latex') || {}).fornecedor_id ?? null;

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const canon = byId[CANONICAL_ID];
  add('canônica existe (id ' + CANONICAL_ID + ')', !!canon, canon ? 'OP ' + canon.numero + '/' + canon.ano : 'ausente');
  REDUNDANT_IDS.forEach((rid) => add('redundante existe (id ' + rid + ')', !!byId[rid], byId[rid] ? 'OP ' + byId[rid].numero + '/' + byId[rid].ano : 'ausente'));

  const allLatex = ops.every((o) => o.tipo === 'latex');
  add('todas tipo=latex', allLatex, ops.map((o) => o.id + ':' + o.tipo).join(' '));

  const origemSet = new Set(ops.map((o) => o.origem_op_id));
  add('mesma origem_op_id', origemSet.size === 1, [...origemSet].join(','));

  const destSet = new Set(ops.map((o) => destinoOf(o)));
  add('mesmo destino_fornecedor_id (latex)', destSet.size === 1 && [...destSet][0] != null, [...destSet].join(','));

  const allAberta = ops.every((o) => o.status === 'aberta');
  add('todas status=aberta', allAberta, ops.map((o) => o.id + ':' + o.status).join(' '));

  add('zero recebimentos latex', eiLatex.length === 0, eiLatex.length + ' recebimento(s)');
  add('zero expedições', exps.length === 0, exps.length + ' expedição(ões)');

  // Canônica deve ser a mais antiga (menor id/numero) do grupo.
  const minId = Math.min(...ids);
  add('canônica é a mais antiga', CANONICAL_ID === minId, 'min=' + minId);

  console.log('===== PRÉ-MERGE: OP', canon ? canon.numero + '/' + canon.ano : '?', '(canônica) <-',
    REDUNDANT_IDS.map((r) => byId[r] ? byId[r].numero + '/' + byId[r].ano : r).join(','), '=====\n');
  ops.forEach((o) => {
    console.log('OP ' + o.numero + '/' + o.ano + ' (id ' + o.id + '): status=' + o.status
      + ' origem_op=' + o.origem_op_id + ' destino_latex=' + destinoOf(o)
      + ' origem_entrega_id=' + o.origem_entrega_id
      + ' | op_itens=[' + (o.op_itens || []).map((it) => 'modelo ' + it.modelo_id + ':' + it.metros_pedidos + 'm (item ' + it.id + ')').join('; ') + ']');
  });
  console.log('');
  // Entregas cima que alimentam cada OP (via origem_entrega_id) — provenance p/ N:1.
   REDUNDANT_IDS.concat(CANONICAL_ID).forEach((oid) => {
    const op = byId[oid];
    if (!op) return;
    console.log('  provenance OP id ' + oid + ': origem_entrega_id=' + op.origem_entrega_id);
  });
  console.log('');
  checks.forEach((c) => console.log((c.ok ? '  PASS ' : '  FAIL ') + c.name + '  [' + c.detail + ']'));

  const failed = checks.filter((c) => !c.ok);
  console.log('\n================ GATE ================');
  if (failed.length === 0) {
    console.log('MERGE AUTORIZADO (staging): todas as condições satisfeitas.');
    console.log('Plano: manter OP ' + canon.numero + '/' + canon.ano + '; acumular metros das redundantes em seus op_itens;');
    console.log('       vincular entregas ' + REDUNDANT_IDS.map((r) => byId[r] && byId[r].origem_entrega_id).join(',') + ' e ' + (canon && canon.origem_entrega_id) + ' à canônica em op_latex_entregas;');
    console.log('       remover OP redundante(s) ' + REDUNDANT_IDS.map((r) => byId[r] ? byId[r].numero + '/' + byId[r].ano : r).join(',') + '.');
    process.exit(0);
  } else {
    console.log('STOP — NÃO fazer merge. Condições não satisfeitas:');
    failed.forEach((c) => console.log('   - ' + c.name + ' [' + c.detail + ']'));
    process.exit(2);
  }
})().catch((e) => die(e && e.message ? e.message : String(e)));
