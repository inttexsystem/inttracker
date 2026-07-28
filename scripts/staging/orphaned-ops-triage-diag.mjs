// =====================================================================
// === scripts/staging/orphaned-ops-triage-diag.mjs ====================
// Diagnostico READ-ONLY aprofundado das 11 OPs historicas orfas na
// PRODUCAO definitiva (ucrjtfswnfdlxwtmxnoo), somente leitura.
//
// Fase: RAVATEX-TAPETES-OP-ORPHANED-HISTORICAL-TRIAGE-D
//
// - SOMENTE SELECT via PostgREST/PG. Nenhum write/RPC/DDL.
// - Exige a flag exata --confirm-production-readonly-diagnostic.
// - Projeto retirado (gqmpsxkxynrjvidfmojk) e projeto proibido
//   (bhgifjrfagkzubpyqpew) sempre falham.
// - Nunca imprime anon key / password / JWT.
//
// Uso: node scripts/staging/orphaned-ops-triage-diag.mjs
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
const ORPHAN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15];

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
    console.log('  (SELECT opcional indisponivel: ' + pathq + ' - HTTP ' + res.status + ')');
    return [];
  }
  return res.json();
}

async function sqlQuery(query, params) {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL || '';
  if (!dbUrl) return [];
  assertProductionTarget('DB_URL', dbUrl);

  const { Client } = await import('pg');
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }
function fmt(n) { return round2(n).toFixed(2); }
function byId(rows) { return Object.fromEntries(rows.map((r) => [String(r.id), r])); }
function opLabel(op) { return op ? 'OP ' + (op.numero ?? '?') + '/' + (op.ano ?? '?') + ' (id ' + op.id + ')' : 'OP ?'; }

// =====================================================================
// ====================== CLASSIFICACAO =================================
// =====================================================================
const A1 = 'A1 — pode ser vinculada com seguranca a Pedido X';
const A2 = 'A2 — pode ser descartada/ignorada como teste/legado sem movimento';
const B1 = 'B1 — tem movimentacao e precisa decisao manual do usuario';
const B2 = 'B2 — tem movimentacao mas vinculo e inferivel com alta confianca';
const D  = 'D  — legado sem correcao segura; manter fallback e documentar';

// =====================================================================
// ====================== MAIN ==========================================
// =====================================================================
(async () => {
  TOKEN = await login();

  const orphanIdsStr = ORPHAN_IDS.join(',');

  // ---- 1. OPs orfas completas ------------------------
  const orphanOps = await sel(
    'ops?id=in.(' + orphanIdsStr + ')&select=id,numero,ano,tipo,status,lote_id,origem_op_id,origem_entrega_id,criado_em,observacao,motivo_separacao,lote:lote_id(id,numero,pedido_id,cliente_id)&order=ano.asc,numero.asc,id.asc'
  );
  console.log('\n===== OPs ORFAS ENCONTRADAS =====');
  console.log('Total:', orphanOps.length);
  orphanOps.forEach((op) => {
    const lote = op.lote || {};
    const pedidoNull = op.lote_id == null || lote.pedido_id == null;
    console.log('  - ' + opLabel(op) + ' tipo=' + op.tipo + ' status=' + op.status
      + ' lote_id=' + (op.lote_id == null ? 'NULL' : op.lote_id)
      + ' lote.numero=' + (lote.numero == null ? 'NULL' : lote.numero)
      + ' lote.pedido_id=' + (lote.pedido_id == null ? 'NULL' : lote.pedido_id)
      + ' lote.cliente_id=' + (lote.cliente_id == null ? 'NULL' : lote.cliente_id)
      + ' origem_op_id=' + (op.origem_op_id == null ? 'NULL' : op.origem_op_id)
      + ' origem_entrega_id=' + (op.origem_entrega_id == null ? 'NULL' : op.origem_entrega_id)
      + ' criado_em=' + (op.criado_em || 'NULL')
      + ' motivo_separacao=' + (op.motivo_separacao == null ? 'NULL' : JSON.stringify(op.motivo_separacao)));
  });

  // ---- 2. Lotes relacionados -------------------------
  const loteIds = [...new Set(orphanOps.map((op) => op.lote_id).filter(Boolean))];
  const lotesExtra = loteIds.length
    ? await sel('lotes?id=in.(' + loteIds.join(',') + ')&select=id,numero,pedido_id,cliente_id,cliente:cliente_id(id,nome)&order=id.asc')
    : [];
  const lotesById = byId(lotesExtra);

  console.log('\n===== LOTES RELACIONADOS =====');
  if (!lotesExtra.length) {
    console.log('0');
  } else {
    lotesExtra.forEach((lote) => {
      console.log('  - lote #' + (lote.numero ?? '?') + ' id=' + lote.id
        + ' pedido_id=' + (lote.pedido_id == null ? 'NULL' : lote.pedido_id)
        + ' cliente_id=' + (lote.cliente_id == null ? 'NULL' : lote.cliente_id)
        + ' cliente=' + (lote.cliente ? lote.cliente.nome : 'NULL'));
    });
  }

  // ---- 3. op_itens (por OP orfa) ---------------------
  const opItems = await sel(
    'op_itens?op_id=in.(' + orphanIdsStr + ')&select=id,op_id,pedido_item_id,modelo_id,metros_pedidos,metros_ajustados,modelo:modelo_id(id,nome)&order=op_id.asc,id.asc'
  );
  const opItemsByOp = {};
  opItems.forEach((item) => {
    (opItemsByOp[String(item.op_id)] = opItemsByOp[String(item.op_id)] || []).push(item);
  });

  console.log('\n===== OP_ITENS POR OP =====');
  orphanOps.forEach((op) => {
    const items = opItemsByOp[String(op.id)] || [];
    console.log('  ' + opLabel(op) + ' | itens=' + items.length);
    items.forEach((item) => {
      console.log('    item #' + item.id
        + ' pedido_item_id=' + (item.pedido_item_id == null ? 'NULL' : item.pedido_item_id)
        + ' modelo=' + (item.modelo ? item.modelo.nome : '?')
        + ' (modelo_id=' + item.modelo_id + ')'
        + ' metros_pedidos=' + fmt(item.metros_pedidos)
        + ' metros_ajustados=' + (item.metros_ajustados != null ? fmt(item.metros_ajustados) : 'NULL'));
    });
  });

  // ---- 4. entregas vinculadas por op_id --------------
  const entregaItens = await sel(
    'entrega_itens?op_id=in.(' + orphanIdsStr + ')&select=id,entrega_id,op_id,op_item_id,metros_entregues,defeito,observacao,entrega:entrega_id(id,etapa,data,fornecedor_id,destino_fornecedor_id)&order=op_id.asc,entrega_id.asc,id.asc'
  );
  const entregaItensByOp = {};
  entregaItens.forEach((ei) => {
    (entregaItensByOp[String(ei.op_id)] = entregaItensByOp[String(ei.op_id)] || []).push(ei);
  });

  // op_latex_entregas (OP latex orfa pode ser destino de entrega cima)
  const opLatexEntregas = await sel(
    'op_latex_entregas?select=id,op_latex_id,entrega_id&order=op_latex_id.asc,entrega_id.asc'
  );
  const entregaIdsByOpLatex = {};
  opLatexEntregas.forEach((link) => {
    if (ORPHAN_IDS.includes(Number(link.op_latex_id))) {
      (entregaIdsByOpLatex[String(link.op_latex_id)] = entregaIdsByOpLatex[String(link.op_latex_id)] || []).push(link.entrega_id);
    }
  });

  console.log('\n===== ENTREGAS VINCULADAS POR OP =====');
  orphanOps.forEach((op) => {
    const directItems = entregaItensByOp[String(op.id)] || [];
    const latexLinks = entregaIdsByOpLatex[String(op.id)] || [];
    const entregaIds = [...new Set([
      ...directItems.map((ei) => ei.entrega_id),
      ...latexLinks,
      op.origem_entrega_id,
    ].filter(Boolean))];
    console.log('  ' + opLabel(op)
      + ' | entrega_itens_diretos=' + directItems.length
      + ' | op_latex_entregas=' + latexLinks.length
      + ' | origem_entrega_id=' + (op.origem_entrega_id == null ? 'NULL' : op.origem_entrega_id)
      + ' | total_entrega_ids=' + entregaIds.length);
    if (directItems.length) {
      directItems.forEach((ei) => {
        const ent = ei.entrega || {};
        console.log('    entrega_item #' + ei.id
          + ' -> entrega #' + ei.entrega_id
          + ' etapa=' + (ent.etapa || '?')
          + ' data=' + (ent.data || 'NULL')
          + ' metros=' + fmt(ei.metros_entregues)
          + ' defeito=' + ei.defeito
          + ' obs=' + (ei.observacao || ''));
      });
    }
    // se ha latex links, buscar as entregas
    if (latexLinks.length) {
      (async () => {
        const entData = await selOptional('entregas?id=in.(' + latexLinks.join(',') + ')&select=id,etapa,data,fornecedor_id,destino_fornecedor_id');
        entData.forEach((ent) => {
          console.log('    (op_latex_entregas) entrega #' + ent.id
            + ' etapa=' + ent.etapa
            + ' data=' + (ent.data || 'NULL'));
        });
      })();
    }
  });

  // ---- 5. expedicoes vinculadas ----------------------
  const expedicoes = await selOptional(
    'expedicoes?select=id,pedido_id,op_latex_id,lote_id,status,criado_em&order=id.asc'
  );
  const expedicoesById = byId(expedicoes);

  console.log('\n===== EXPEDICOES VINCULADAS =====');
  orphanOps.forEach((op) => {
    const expPorOp = expedicoes.filter((exp) => Number(exp.op_latex_id) === Number(op.id));
    const expPorLote = op.lote_id ? expedicoes.filter((exp) => Number(exp.lote_id) === Number(op.lote_id)) : [];
    const allExp = [...expPorOp, ...expPorLote];
    console.log('  ' + opLabel(op)
      + ' | expedicoes_por_op_latex=' + expPorOp.length
      + ' | expedicoes_por_lote=' + expPorLote.length
      + ' | total=' + allExp.length);
    allExp.forEach((exp) => {
      console.log('    expedicao #' + exp.id
        + ' status=' + exp.status
        + ' pedido_id=' + (exp.pedido_id == null ? 'NULL' : exp.pedido_id)
        + ' op_latex_id=' + (exp.op_latex_id == null ? 'NULL' : exp.op_latex_id)
        + ' lote_id=' + (exp.lote_id == null ? 'NULL' : exp.lote_id));
    });
  });

  // ---- 6. op_eventos ---------------------------------
  const opEventos = await selOptional(
    'op_eventos?op_id=in.(' + orphanIdsStr + ')&select=id,op_id,tipo_evento,status_anterior,status_novo,observacao,payload,criado_em&order=op_id.asc,criado_em.asc'
  );
  const eventosByOp = {};
  opEventos.forEach((ev) => {
    (eventosByOp[String(ev.op_id)] = eventosByOp[String(ev.op_id)] || []).push(ev);
  });

  console.log('\n===== OP_EVENTOS =====');
  orphanOps.forEach((op) => {
    const evs = eventosByOp[String(op.id)] || [];
    console.log('  ' + opLabel(op) + ' | eventos=' + evs.length);
    evs.forEach((ev) => {
      console.log('    evento #' + ev.id
        + ' tipo=' + ev.tipo_evento
        + ' ' + (ev.status_anterior || 'NULL') + '->' + (ev.status_novo || 'NULL')
        + ' obs=' + (ev.observacao || '')
        + ' payload=' + JSON.stringify(ev.payload || {})
        + ' em=' + (ev.criado_em || 'NULL'));
    });
  });

  // ---- 7. pedidos candidatos por cliente/produto -------
  const clienteIds = [...new Set(lotesExtra.map((l) => l.cliente_id).filter(Boolean))];
  const modeloIds = [...new Set(opItems.map((item) => item.modelo_id).filter(Boolean))];

  let pedidosCandidatos = [];
  if (clienteIds.length > 0 || modeloIds.length > 0) {
    // try by cliente first
    const conditions = [];
    if (clienteIds.length) conditions.push('cliente_id=in.(' + clienteIds.join(',') + ')');
    if (conditions.length) {
      pedidosCandidatos = await selOptional(
        'pedidos?' + conditions.join('&') + '&select=id,numero,cliente_id,status,criado_em&order=criado_em.desc'
      );
    }
  }

  console.log('\n===== PEDIDOS CANDIDATOS (cliente compartilhado) =====');
  if (!pedidosCandidatos.length) {
    console.log('  (0 pedidos encontrados com mesmo cliente das OPs orfas)');
  } else {
    pedidosCandidatos.forEach((ped) => {
      console.log('  Pedido #' + ped.numero + ' id=' + ped.id
        + ' cliente_id=' + ped.cliente_id
        + ' status=' + ped.status
        + ' criado_em=' + (ped.criado_em || 'NULL'));
    });
  }

  // ---- 8. SQL query para cross-checks ----------------
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL || '';
  if (dbUrl) {
    assertProductionTarget('DB_URL', dbUrl);
    {
      console.log('\n===== SQL CROSS-CHECK (PG direto) =====');
      const { Client } = await import('pg');
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      try {
        // lote_itens e pedido_itens para as OPs orfas
        const crossItems = await client.query(`
          SELECT
            oi.id AS item_id,
            oi.op_id,
            oi.modelo_id,
            oi.metros_pedidos,
            oi.pedido_item_id,
            pi.id AS pi_id,
            pi.pedido_id AS pi_pedido_id,
            pi.metros AS pi_metros,
            pi.modelo_id AS pi_modelo_id
          FROM public.op_itens oi
          LEFT JOIN public.pedido_itens pi ON oi.pedido_item_id = pi.id
          WHERE oi.op_id = ANY($1)
          ORDER BY oi.op_id, oi.id
        `, [ORPHAN_IDS]);
        crossItems.rows.forEach((row) => {
          console.log('  op_id=' + row.op_id + ' item_id=' + row.item_id
            + ' modelo_id=' + row.modelo_id
            + ' metros_pedidos=' + fmt(row.metros_pedidos)
            + ' pedido_item_id=' + (row.pedido_item_id == null ? 'NULL' : row.pedido_item_id)
            + ' pi_pedido_id=' + (row.pi_pedido_id == null ? 'NULL' : row.pi_pedido_id)
            + ' pi_metros=' + (row.pi_metros != null ? fmt(row.pi_metros) : 'NULL'));
        });

        // quais lotes tem pedido e estao ligados ao mesmo cliente das orfas
        const lotePedidoCross = await client.query(`
          SELECT l.id, l.numero, l.pedido_id, l.cliente_id, p.numero AS pedido_numero, p.status AS pedido_status, p.criado_em
          FROM public.lotes l
          JOIN public.pedidos p ON l.pedido_id = p.id
          WHERE l.cliente_id = ANY($1)
            AND l.pedido_id IS NOT NULL
          ORDER BY l.id
        `, [clienteIds.length ? clienteIds : [-1]]);
        if (lotePedidoCross.rows.length) {
          console.log('\n  LOTES DO MESMO CLIENTE COM PEDIDO:');
          lotePedidoCross.rows.forEach((row) => {
            console.log('    lote #' + row.numero + ' id=' + row.id
              + ' -> Pedido #' + row.pedido_numero + ' id=' + row.pedido_id
              + ' status=' + row.pedido_status
              + ' criado_em=' + (row.criado_em || 'NULL'));
          });
        }
      } finally {
        await client.end();
      }
    }
  }

  // ---- 9. CLASSIFICACAO E RECOMENDACAO INDIVIDUAL -----
  console.log('\n');
  console.log('=====================================================================');
  console.log('=====            CLASSIFICACAO INDIVIDUAL POR OP                =====');
  console.log('=====================================================================\n');

  orphanOps.forEach((op) => {
    const lote = op.lote || {};
    const loteFull = lote.id ? (lotesById[String(lote.id)] || {}) : {};
    const clienteNome = loteFull.cliente ? loteFull.cliente.nome : 'NULL';
    const items = opItemsByOp[String(op.id)] || [];
    const directItems = entregaItensByOp[String(op.id)] || [];
    const latexLinks = entregaIdsByOpLatex[String(op.id)] || [];
    const expPorOp = expedicoes.filter((exp) => Number(exp.op_latex_id) === Number(op.id));
    const expPorLote = op.lote_id ? expedicoes.filter((exp) => Number(exp.lote_id) === Number(op.lote_id)) : [];
    const eventos = eventosByOp[String(op.id)] || [];
    const temMovimentacao = directItems.length > 0 || latexLinks.length > 0 || expPorOp.length > 0 || expPorLote.length > 0;

    // Check if any op_item has pedido_item_id pointing to a real pedido
    const pedidoIdsViaItems = items
      .filter((item) => item.pedido_item_id != null)
      .map((item) => item.pedido_item_id);
    const pedidoIdsViaExpedicoes = [...expPorOp, ...expPorLote]
      .filter((exp) => exp.pedido_id != null)
      .map((exp) => exp.pedido_id);

    console.log('---------------------------------------------------------------------');
    console.log('OP #' + op.id + ' | ' + opLabel(op)
      + ' | tipo=' + op.tipo
      + ' | status=' + op.status
      + ' | criado_em=' + (op.criado_em || 'NULL'));
    console.log('  Lote: #' + (lote.numero ?? '?') + ' id=' + (op.lote_id ?? 'NULL')
      + ' pedido_id=' + (lote.pedido_id ?? 'NULL')
      + ' cliente_id=' + (lote.cliente_id ?? 'NULL')
      + ' cliente=' + clienteNome);
    console.log('  Origem: origem_op_id=' + (op.origem_op_id ?? 'NULL')
      + ' origem_entrega_id=' + (op.origem_entrega_id ?? 'NULL')
      + ' motivo_separacao=' + (op.motivo_separacao ?? 'NULL'));
    console.log('  Itens: ' + items.length + ' | total_metros=' + fmt(items.reduce((a, i) => a + Number(i.metros_pedidos || 0), 0))
      + ' | com_pedido_item_id=' + items.filter((i) => i.pedido_item_id != null).length);
    console.log('  Entregas: entrega_itens=' + directItems.length
      + ' | op_latex_entregas=' + latexLinks.length
      + ' | expedicoes_por_op=' + expPorOp.length
      + ' | expedicoes_por_lote=' + expPorLote.length);
    console.log('  Eventos: ' + eventos.length);
    console.log('  Pedido via op_itens: ' + (pedidoIdsViaItems.length ? pedidoIdsViaItems.join(',') : 'nao'));
    console.log('  Pedido via expedicao: ' + (pedidoIdsViaExpedicoes.length ? pedidoIdsViaExpedicoes.join(',') : 'nao'));

    // ---- CLASSIFICACAO ----
    let classificacao = '';
    let recomendacao = '';
    let justificativa = '';

    if (temMovimentacao) {
      // B1 or B2
      const pedidoInferido = pedidoIdsViaItems.length > 0 || pedidoIdsViaExpedicoes.length > 0;
      if (pedidoInferido) {
        classificacao = B2;
        const pids = [...new Set([...pedidoIdsViaItems, ...pedidoIdsViaExpedicoes])].join(',');
        recomendacao = 'BACKFILL-D: vincular lote.lote_id a Pedido=' + pids + ' se confirmado visualmente.';
        justificativa = 'OP tem movimentacao real e evidencia de Pedido via op_itens.pedido_item_id ou expedicoes.pedido_id.';
      } else {
        classificacao = B1;
        recomendacao = 'MANUAL-DECISION-D: decisao manual do usuario sobre o que fazer com historico de movimentacao sem pedido.';
        justificativa = 'OP tem entregas/expedicoes reais registradas mas nenhum pedido inferivel por FK.';
      }
    } else {
      // A2 or D
      if (op.lote_id == null) {
        // sem lote = sem movimentacao, sem cliente
        classificacao = A2;
        recomendacao = 'LEGACY-FALLBACK-DOC-D: manter como legado, sem pedido, apenas documentar existencia.';
        justificativa = 'OP sem lote, sem entregas, sem expedicoes, sem eventos. Provavel fixture/troca de banco.';
      } else if (op.status === 'aberta' || op.status === 'simulada' || !op.status) {
        classificacao = A2;
        if (items.length > 0 && !temMovimentacao) {
          justificativa = 'OP com lote+itens, mas sem entregas/expedicoes registradas. Pode ser teste/descarte ou configuracao inicial.';
          recomendacao = 'LEGACY-FALLBACK-DOC-D: manter como legado. Se necessario associar a Pedido, fazer manualmente.';
        } else {
          justificativa = 'OP sem lote, sem itens, sem movimentacao. Fixture/troca de ambiente.';
          recomendacao = 'LEGACY-FALLBACK-DOC-D: ignorar como artefato sem valor operacional.';
        }
      } else {
        classificacao = D;
        recomendacao = 'LEGACY-FALLBACK-DOC-D: sem correcao segura possivel sem decisao do usuario.';
        justificativa = 'OP com status terminal mas sem movimentacao detectavel. Dado historico sem evidencia suficiente para backfill.';
      }
    }

    console.log('\n  >>> CLASSIFICACAO: ' + classificacao);
    console.log('  >>> JUSTIFICATIVA: ' + justificativa);
    console.log('  >>> RECOMENDACAO:  ' + recomendacao);
    console.log('');
  });

  // ---- 10. RESUMO FINAL --------------------------------
  console.log('=====================================================================');
  console.log('=====                    RESUMO FINAL                            =====');
  console.log('=====================================================================');
  const counts = { A1: 0, A2: 0, B1: 0, B2: 0, D: 0 };

  orphanOps.forEach((op) => {
    const lote = op.lote || {};
    const items = opItemsByOp[String(op.id)] || [];
    const directItems = entregaItensByOp[String(op.id)] || [];
    const latexLinks = entregaIdsByOpLatex[String(op.id)] || [];
    const expPorOp = expedicoes.filter((exp) => Number(exp.op_latex_id) === Number(op.id));
    const expPorLote = op.lote_id ? expedicoes.filter((exp) => Number(exp.lote_id) === Number(op.lote_id)) : [];
    const temMovimentacao = directItems.length > 0 || latexLinks.length > 0 || expPorOp.length > 0 || expPorLote.length > 0;
    const pedidoIdsViaItems = items.filter((it) => it.pedido_item_id != null).map((it) => it.pedido_item_id);
    const pedidoIdsViaExpedicoes = [...expPorOp, ...expPorLote].filter((exp) => exp.pedido_id != null).map((exp) => exp.pedido_id);
    const temPedidoInferido = pedidoIdsViaItems.length > 0 || pedidoIdsViaExpedicoes.length > 0;

    if (!temMovimentacao) {
      if (op.lote_id == null || op.status === 'aberta' || op.status === 'simulada' || !op.status) {
        counts.A2++;
      } else {
        counts.D++;
      }
    } else {
      if (temPedidoInferido) counts.B2++;
      else counts.B1++;
    }
  });

  console.log('A1 (vinculo seguro a Pedido): ' + counts.A1);
  console.log('A2 (legado sem movimento):    ' + counts.A2);
  console.log('B1 (movimentacao, decisao manual): ' + counts.B1);
  console.log('B2 (movimentacao, inferivel):      ' + counts.B2);
  console.log('D  (legado sem correcao segura):   ' + counts.D);
  console.log('');

  const totalClassificadas = counts.A1 + counts.A2 + counts.B1 + counts.B2 + counts.D;
  console.log('Total classificado: ' + totalClassificadas + ' / ' + orphanOps.length + ' OPs');

  // ---- VEREDITO ----------------
  console.log('\n===== VEREDITO =====');
  console.log('STATUS: TRIAGEM READ-ONLY PRONTA');
  console.log('PROXIMA FASE:');
  if (counts.B2 > 0) console.log('  - BACKFILL-D: ' + counts.B2 + ' OP(s) com Pedido inferivel com alta confianca.');
  if (counts.B1 > 0) console.log('  - MANUAL-DECISION-D: ' + counts.B1 + ' OP(s) precisam de decisao manual do usuario.');
  if (counts.A2 > 0 || counts.D > 0) console.log('  - LEGACY-FALLBACK-DOC-D: ' + (counts.A2 + counts.D) + ' OP(s) permanecem como legado documentado.');
  if (counts.A1 > 0) console.log('  - BACKFILL-D: ' + counts.A1 + ' OP(s) com vinculo seguro.');
  console.log('\nConfirmacao: nenhum dado foi alterado neste diagnostico (apenas SELECT).');

})().catch((e) => die(e && e.message ? e.message : String(e)));
