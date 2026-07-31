// tests/pedido-detail-nativo.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 11) — o detalhe do
// Pedido perde o FALLBACK PLANO.
//
// Antes, quando a projeção canônica não respondia, a tela relia
// `ordens_compra_fio` direto e seguia como se nada tivesse acontecido —
// voltando ao modelo plano em silêncio, exatamente o que a proibição canônica
// veda. Agora a falha é HONESTA: lista vazia e estado de erro.
//
// Transporte MOCKADO, ids sintéticos, nenhuma conexão hospedada.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PDD  = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const pddSrc = fs.readFileSync(PDD, 'utf8');

function executavel(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const pddExec = executavel(pddSrc);

// Sandbox mínimo: registra toda tabela lida e controla o desfecho do
// adaptador canônico.
function makeSandbox(outcome) {
  const tabelas = [];
  const erros = [];
  function chain(table) {
    const c = {
      select() { return c; }, eq() { return c; }, in() { return c; },
      order() { return c; }, limit() { return c; }, maybeSingle() { return Promise.resolve(dataFor(table)); },
      single() { return Promise.resolve(dataFor(table)); },
      then(res, rej) { return Promise.resolve(dataFor(table)).then(res, rej); },
    };
    return c;
  }
  function dataFor(table) {
    if (table === 'pedidos') return { data: { id: 'ped-1', numero: 1, status: 'confirmado' }, error: null };
    if (table === 'lotes') return { data: [{ id: 5, pedido_id: 'ped-1' }], error: null };
    if (table === 'ops') return { data: [{ id: 900001, lote_id: 5, status: 'aberta', op_itens: [] }], error: null };
    return { data: [], error: null };
  }

  const sandbox = {
    console: Object.assign({}, console, { error: (...a) => { erros.push(a.join(' ')); } }),
    Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Set,
    supa: { from: (t) => { tabelas.push(t); return chain(t); }, rpc: () => Promise.resolve({ data: null, error: null }) },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  sandbox.RAVATEX_SCREENS = {
    ordemCompraReceiptCutover: {
      attemptCanonicalRead: async () => outcome,
    },
  };
  vm.runInContext(pddSrc, sandbox, { filename: 'js/screens/pedido-detail-data.js' });
  return { sandbox, tabelas, erros };
}

// O módulo publica o carregador na namespace RAVATEX_SCREENS.pedidoDetail.
function carregarDetalhe(sandbox, state) {
  return sandbox.RAVATEX_SCREENS.pedidoDetail.loadPedidoDetailData('ped-1', state);
}

test('1. pedido-detail-data.js: sintaxe JS válida', () => {
  cp.execSync(`node --check "${PDD}"`, { stdio: 'pipe' });
});

test('2. o SELECT plano de ordens_compra_fio não existe mais no código executável', () => {
  assert.doesNotMatch(pddExec, /from\(\s*['"]ordens_compra_fio['"]\s*\)/,
    'o fallback plano foi removido em P2-A');
  assert.doesNotMatch(pddExec, /kg_pedido,\s*kg_recebido/,
    'a projeção de colunas planas de fio não pode sobreviver');
});

test('3. a leitura canônica continua sendo a única fonte', () => {
  assert.match(pddExec, /attemptCanonicalRead/,
    'a projeção canônica continua sendo consultada');
  assert.match(pddExec, /canonical_success/,
    'só o desfecho canônico de sucesso alimenta state.ordensFio');
});

test('4. sucesso canônico preenche ordensFio e não toca o modelo plano', async () => {
  const linhas = [{ id: 'x1', op_id: 900001, tipo: 'algodao' }];
  const { sandbox, tabelas } = makeSandbox({ outcome: 'canonical_success', rows: linhas });
  const state = {};
  await carregarDetalhe(sandbox, state);
  assert.deepEqual(Array.from(state.ordensFio), linhas);
  assert.equal(tabelas.includes('ordens_compra_fio'), false,
    'no caminho feliz o modelo plano não é lido');
  assert.notEqual(state.docsLoadError, true, 'sucesso não pode marcar erro');
});

test('5. hard_failure falha HONESTAMENTE: lista vazia, erro marcado, sem fallback', async () => {
  const { sandbox, tabelas } = makeSandbox({ outcome: 'hard_failure', error: new Error('boom') });
  const state = {};
  await carregarDetalhe(sandbox, state);
  assert.deepEqual(Array.from(state.ordensFio), [], 'a lista tem de ficar vazia');
  assert.equal(state.docsLoadError, true, 'o erro tem de ficar visível para a tela');
  assert.equal(tabelas.includes('ordens_compra_fio'), false,
    'NENHUM fallback plano pode acontecer');
});

test('6. legacy_fallback TAMBÉM falha honestamente — o sinal não reabre o modelo plano', async () => {
  const { sandbox, tabelas } = makeSandbox({ outcome: 'legacy_fallback' });
  const state = {};
  await carregarDetalhe(sandbox, state);
  assert.deepEqual(Array.from(state.ordensFio), [],
    'o antigo sinal de fallback não pode mais devolver dados planos');
  assert.equal(state.docsLoadError, true);
  assert.equal(tabelas.includes('ordens_compra_fio'), false,
    'este era EXATAMENTE o caminho que voltava ao modelo plano em silêncio');
});

test('7. adaptador ausente também falha honestamente', async () => {
  const { sandbox, tabelas } = makeSandbox({ outcome: 'canonical_success', rows: [] });
  // Remove o adaptador: a tela não pode inventar uma segunda autoridade.
  sandbox.RAVATEX_SCREENS.ordemCompraReceiptCutover = null;
  const state = {};
  await carregarDetalhe(sandbox, state);
  assert.deepEqual(Array.from(state.ordensFio), []);
  assert.equal(state.docsLoadError, true);
  assert.equal(tabelas.includes('ordens_compra_fio'), false);
});

test('8. a falha é registrada e nomeia a ausência de fallback', async () => {
  const { sandbox, erros } = makeSandbox({ outcome: 'hard_failure', error: new Error('boom') });
  await carregarDetalhe(sandbox, {});
  assert.ok(erros.some((e) => /sem fallback plano/i.test(e)),
    'o log tem de dizer que não houve fallback, e não sumir em silêncio');
});

test('9. a tela não ganhou nenhum escritor: continua só leitura', () => {
  assert.doesNotMatch(pddExec, /\.(insert|update|delete|upsert)\(/,
    'pedido-detail-data.js é um carregador; não pode gravar nada');
});
