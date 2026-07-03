// =====================================================================
// === tests/pedido-detail-linked-ops.smoke.js =========================
// Invariantes do vínculo Pedido <-> OPs e da resiliência da camada de
// consolidação Látex no detalhe do Pedido.
//
// Fase: RAVATEX-TAPETES-LINKED-OPS-AND-PARTIALS-DOMAIN-INVARIANT-FIX-A
//
// Regressão corrigida: o detalhe do Pedido deixou de mostrar a OP
// Tecelagem aberta (ex.: OP 15/2026 no Pedido 17) e passou a exibir
// "Nao foi possivel consolidar as OPs vinculadas agora." porque a
// consulta BASE de `ops` selecionava `destino_fornecedor_id` — coluna
// adicionada por db/25 e AINDA NÃO aplicada em staging. O PostgREST
// devolvia erro na consulta base, zerando a lista inteira.
//
// Este teste executa loadPedidoDetailData contra um mock de `supa` que
// simula o schema de staging SEM db/25:
//   - a consulta a `ops` FALHA se selecionar destino_fornecedor_id
//     (coluna inexistente);
//   - a tabela op_latex_entregas não existe (consulta retorna erro).
//
// Invariantes validados:
//   1. OP vinculada não depende de movimento: a OP Tecelagem aberta,
//      sem insumos, aparece na lista base.
//   3. Falha de enriquecimento (Látex) não derruba o bloco: a base
//      permanece; apenas opsEnrichError é sinalizado.
//   4. App não depende de DDL não aplicada: a consulta base não
//      referencia destino_fornecedor_id nem op_latex_entregas.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DETAIL_DATA = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');

const detailData = fs.readFileSync(DETAIL_DATA, 'utf8');
const detailRender = fs.readFileSync(DETAIL_RENDER, 'utf8');

// ---------------------------------------------------------------------
// Mock mínimo do query-builder do Supabase.
// Cada builder é "thenable": `await builder` resolve para { data, error }
// consultando o handler da tabela. Handlers recebem o contexto da query
// (incluindo a string de select) para simular colunas/tabelas ausentes.
// ---------------------------------------------------------------------
function makeSupa(handlers) {
  function makeBuilder(table) {
    const ctx = { table, select: null, filters: [] };
    const builder = {
      select(s) { ctx.select = s; return builder; },
      eq(c, v) { ctx.filters.push(['eq', c, v]); return builder; },
      in(c, v) { ctx.filters.push(['in', c, v]); return builder; },
      order() { return builder; },
      maybeSingle() { return builder; },
      then(resolve, reject) {
        let res;
        try {
          const h = handlers[table] || (() => ({ data: [], error: null }));
          res = h(ctx);
        } catch (e) {
          res = { data: null, error: { message: String(e && e.message || e) } };
        }
        return Promise.resolve(res).then(resolve, reject);
      },
    };
    return builder;
  }
  return { from: (t) => makeBuilder(t) };
}

function loadModule() {
  const sandbox = { window: {}, console: { error() {}, log() {}, warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(detailData, sandbox, { filename: 'js/screens/pedido-detail-data.js' });
  sandbox.window.toast = function () {};
  return sandbox.window;
}

const PID = '00000000-0000-4000-8000-000000000017';

// OP Tecelagem 15/2026 — aberta, vinculada ao Pedido via lote, SEM
// recebimento de fios (zero insumos). Deve aparecer mesmo assim.
const TEC_OP = {
  id: 900, numero: 15, ano: 2026, status: 'aberta', tipo: 'tecelagem',
  observacao: null, origem_op_id: null, origem_entrega_id: null, lote_id: 500,
  op_itens: [{ id: 'oi1', modelo_id: 10, metros_pedidos: 100, metros_ajustados: null, pedido_item_id: 'it1' }],
  op_fornecedores: [],
};

const LATEX_OP = {
  id: 901, numero: 3, ano: 2026, status: 'aberta', tipo: 'latex',
  observacao: null, origem_op_id: 900, origem_entrega_id: null, lote_id: 500,
  op_itens: [], op_fornecedores: [],
};

// Handlers que simulam staging SEM db/25.
function stagingHandlers(opsRows, opts) {
  opts = opts || {};
  return {
    pedidos: () => ({ data: { id: PID, numero: 17, status: 'confirmado', cliente_id: 1, metros_total: 100, cliente: { id: 1, nome: 'Cliente X' } }, error: null }),
    pedido_itens: () => ({ data: [{ id: 'it1', pedido_id: PID, modelo_id: 10, metros: 100, largura: 2, cor_1_id: null, cor_2_id: null, observacao: null, ordem: 1 }], error: null }),
    pedido_parciais: () => ({ data: [], error: null }),
    modelos: () => ({ data: [{ id: 10, nome: 'Modelo', largura: 2, cor_1_id: null, cor_2_id: null }], error: null }),
    cores: () => ({ data: [], error: null }),
    fornecedores: () => ({ data: [], error: null }),
    expedicoes: () => ({ data: [], error: null }),
    lotes: () => ({ data: [{ id: 500, numero: 1, pedido_id: PID }], error: null }),
    ops: (ctx) => {
      // Simula coluna inexistente antes de db/25: qualquer select que
      // referencie destino_fornecedor_id em `ops` explode a consulta base.
      if (ctx.select && /destino_fornecedor_id/.test(ctx.select)) {
        return { data: null, error: { code: '42703', message: 'column ops.destino_fornecedor_id does not exist' } };
      }
      return { data: opsRows, error: null };
    },
    op_latex_entregas: () => (opts.latexEntregasError
      ? { data: null, error: { code: '42P01', message: 'relation "op_latex_entregas" does not exist' } }
      : { data: [], error: null }),
    entrega_itens: () => ({ data: [], error: null }),
    entregas: () => ({ data: [], error: null }),
    ordens_compra_fio: () => ({ data: [], error: null }),
  };
}

// ---------------------------------------------------------------------
// Caso A — Pedido com OP Tecelagem aberta, sem insumos (staging sem db/25)
// ---------------------------------------------------------------------

test('Caso A: OP Tecelagem aberta aparece mesmo em staging sem db/25 (base não usa destino_fornecedor_id)', async () => {
  const win = loadModule();
  win.supa = makeSupa(stagingHandlers([TEC_OP]));
  const state = {};
  const result = await win.RAVATEX_SCREENS.pedidoDetail.loadPedidoDetailData(PID, state);

  assert.equal(result, null, 'carregamento deve concluir sem token de falha');
  assert.equal(state.opsLoadError, false, 'base NÃO pode falhar por causa da consolidação Látex');
  assert.equal(state.ops.length, 1, 'a OP Tecelagem base deve estar presente');
  assert.equal(state.ops[0].numero, 15, 'a OP 15/2026 deve aparecer');
  assert.equal(state.ops[0].status, 'aberta', 'OP aberta/preparação sem insumos ainda deve aparecer');
  assert.equal(state.opsEnrichError, false, 'sem OP Látex não há enriquecimento a falhar');
});

// ---------------------------------------------------------------------
// Caso B — Falha no enriquecimento Látex não derruba a base (Invariante 3)
// ---------------------------------------------------------------------

test('Caso B: op_latex_entregas ausente/erro preserva as OPs base e sinaliza opsEnrichError', async () => {
  const win = loadModule();
  win.supa = makeSupa(stagingHandlers([TEC_OP, LATEX_OP], { latexEntregasError: true }));
  const state = {};
  const result = await win.RAVATEX_SCREENS.pedidoDetail.loadPedidoDetailData(PID, state);

  assert.equal(result, null, 'carregamento deve concluir sem token de falha');
  assert.equal(state.opsLoadError, false, 'falha de enriquecimento NÃO é falha de base');
  assert.equal(state.ops.length, 2, 'OP Tecelagem e OP Látex base permanecem visíveis');
  assert.equal(state.opsEnrichError, true, 'a falha de enriquecimento deve ficar localizada e visível');
  // Cross-realm: o array vem do contexto vm; comparo comprimento, não identidade de protótipo.
  assert.ok(Array.isArray(state.opLatexEntregas) && state.opLatexEntregas.length === 0,
    'vínculos de consolidação ficam vazios sem derrubar a base');
});

// ---------------------------------------------------------------------
// Caso base-falha real — só aí o fallback global é legítimo
// ---------------------------------------------------------------------

test('Falha real da consulta base de ops liga opsLoadError (fallback global legítimo)', async () => {
  const win = loadModule();
  const handlers = stagingHandlers([TEC_OP]);
  handlers.ops = () => ({ data: null, error: { message: 'boom base' } });
  win.supa = makeSupa(handlers);
  const state = {};
  await win.RAVATEX_SCREENS.pedidoDetail.loadPedidoDetailData(PID, state);

  assert.equal(state.opsLoadError, true, 'erro na consulta base de ops deve ligar opsLoadError');
  assert.equal(state.ops.length, 0, 'sem base não há OPs');
});

// ---------------------------------------------------------------------
// Invariante 4 (estático) — a consulta base não pode depender de db/25
// ---------------------------------------------------------------------

test('Invariante 4: opsSelect base NÃO referencia ops.destino_fornecedor_id', () => {
  const opsSelect = (detailData.match(/var opsSelect\s*=\s*'([^']*)'/) || [])[1];
  assert.ok(opsSelect, 'não localizei a string opsSelect base');
  assert.doesNotMatch(opsSelect, /destino_fornecedor_id/,
    'a consulta base de ops não pode selecionar destino_fornecedor_id (DDL db/25 não aplicada)');
  assert.match(opsSelect, /op_itens\(/, 'a base deve continuar trazendo op_itens');
  assert.match(opsSelect, /op_fornecedores\(/, 'a base deve continuar trazendo op_fornecedores');
});

test('Invariante 4: op_latex_entregas é enriquecimento — erro liga opsEnrichError, nunca opsLoadError', () => {
  // Do início do bloco de op_latex_entregas até a próxima consulta (entrega_itens).
  const slice = (detailData.match(/'op_latex_entregas'[\s\S]*?from\(\s*'entrega_itens'/) || [''])[0];
  assert.ok(slice, 'trecho de carregamento de op_latex_entregas não encontrado');
  assert.match(slice, /state\.opsEnrichError\s*=\s*true/,
    'erro em op_latex_entregas deve marcar opsEnrichError');
  assert.doesNotMatch(slice, /state\.opsLoadError\s*=\s*true/,
    'erro em op_latex_entregas NÃO pode marcar opsLoadError (não derruba a base)');
});

// ---------------------------------------------------------------------
// Render resiliente — fallback global só sob opsLoadError; aviso restrito
// sob opsEnrichError sem esconder as OPs base.
// ---------------------------------------------------------------------

test('Render: fallback global "Nao foi possivel consolidar" só ocorre sob opsLoadError', () => {
  const buildOps = (detailRender.match(
    /function buildOps\s*\(state,\s*view,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildExpedicoes/
  ) || [''])[0];
  assert.ok(buildOps, 'trecho buildOps não encontrado');
  // O texto de fallback global aparece exatamente uma vez e dentro do
  // guard de opsLoadError, que retorna antes de renderizar os cards.
  assert.match(buildOps, /if\s*\(\s*state\.opsLoadError\s*\)\s*\{[\s\S]{0,260}Nao foi possivel consolidar as OPs vinculadas agora\.[\s\S]{0,60}return wrap;/);
  const occurrences = (buildOps.match(/Nao foi possivel consolidar as OPs vinculadas agora/g) || []).length;
  assert.equal(occurrences, 1, 'o fallback global deve existir uma única vez');
});

test('Render: opsEnrichError mostra aviso restrito e NÃO esconde os cards de OP', () => {
  const buildOps = (detailRender.match(
    /function buildOps\s*\(state,\s*view,\s*handlers\)\s*\{[\s\S]*?\n  \}\n\n  function buildExpedicoes/
  ) || [''])[0];
  assert.ok(buildOps, 'trecho buildOps não encontrado');
  const enrichIdx = buildOps.indexOf('state.opsEnrichError');
  const cardsIdx = buildOps.indexOf('view.opSummaries.map');
  assert.ok(enrichIdx > 0, 'buildOps deve tratar state.opsEnrichError');
  assert.match(buildOps, /state\.opsEnrichError[\s\S]{0,260}Alguns detalhes de producao nao puderam ser carregados\./);
  assert.ok(enrichIdx < cardsIdx, 'o aviso restrito precede os cards e não faz return (cards continuam sendo renderizados)');
  // O aviso restrito não pode reaproveitar o texto do fallback global.
  const enrichSlice = buildOps.slice(enrichIdx, cardsIdx);
  assert.doesNotMatch(enrichSlice, /Nao foi possivel consolidar/);
});
