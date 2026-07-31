// tests/pos-recebimento-navegacao.smoke.js
//
// P2-C, ruling R12 — continuacao "Revisar producao" apos um recebimento
// gravado. Transporte MOCKADO, ids sinteticos.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RE = path.join(ROOT, 'js', 'screens', 'ordem-compra-receipt-events.js');
const src = fs.readFileSync(RE, 'utf8');
const exec = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

function makeApi(ordem) {
  const navegou = [];
  const modais = [];
  const sandbox = { console, Promise, Object, Array, Number, String, JSON, Error, Boolean };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.el = function (t, a) { return { tag: t, attrs: a, args: Array.prototype.slice.call(arguments, 2) }; };
  sandbox.toast = function (msg, kind) { modais.push({ toast: msg, kind }); };
  sandbox.navigate = function (r) { navegou.push(r); };
  sandbox.modal = function (cfg) { modais.push(cfg); return { close: function () {} }; };
  sandbox.textInput = () => ({});
  sandbox.formField = (o) => o.input;
  sandbox.RAVATEX_OP_DISPLAY = { formatOpIdentityFromMap: (id) => 'OP-A' + id };
  // A namespace real e `ordemCompra`; o rastreador de tentativas vive em
  // ordem-compra-receipt-data.js e e stubado aqui.
  sandbox.RAVATEX_SCREENS = { ordemCompra: {
    createReceiptAttemptTracker: () => ({ resolveAttempt: () => ({ token: 't' }), complete: () => {} }),
  } };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'js/screens/ordem-compra-receipt-events.js' });
  const ns = sandbox.RAVATEX_SCREENS.ordemCompra;
  const api = ns.createReceiptEvents({
    state: { ordem: ordem, opIdentidades: {} },
    reload: async () => {},
    ordemId: 1,
  });
  return { api, navegou, modais };
}

const ORDEM = { id: 1, pedido_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };

test('0. sintaxe JS valida', () => { cp.execSync(`node --check "${RE}"`, { stdio: 'pipe' }); });

test('1. a lista de OPs afetadas vem do resultado AUTORITATIVO do comando', () => {
  const { api } = makeApi(ORDEM);
  const ops = api.opsAfetadasDoResultado({
    lancamentos: [
      { op_id: 29, kg: 10 }, { op_id: 29, kg: 5 }, { op_id: 31, kg: 7 },
      { op_id: null, kg: 3 },
    ],
  });
  assert.deepEqual(Array.from(ops), [29, 31], 'op_id do razao, distintos; NULL nao entra');
});

test('2. UMA OP afetada abre a propria OP', () => {
  const { api } = makeApi(ORDEM);
  assert.equal(api.rotaContinuacao([29]), '#/ops/29');
});

test('3. VARIAS OPs afetadas abrem o painel consolidado do Pedido', () => {
  const { api } = makeApi(ORDEM);
  assert.equal(api.rotaContinuacao([29, 31]),
    '#/pedidos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/producao');
});

test('4. NENHUMA OP afetada nao inventa destino', () => {
  const { api } = makeApi(ORDEM);
  assert.equal(api.rotaContinuacao([]), null);
});

test('5. excedente/pool: estado de conclusao honesto, sem modal de continuacao', () => {
  const { api, modais, navegou } = makeApi(ORDEM);
  const r = api.abrirContinuacaoProducao({ lancamentos: [{ op_id: null, kg_excesso: 9 }] });
  assert.equal(r, null, 'nenhum modal de continuacao');
  assert.equal(navegou.length, 0, 'nenhuma navegacao inventada');
  assert.ok(modais.some((m) => m.toast && /Nenhuma OP foi afetada/.test(m.toast)));
});

test('6. o rotulo da acao e "Revisar producao"', () => {
  const { api, modais } = makeApi(ORDEM);
  api.abrirContinuacaoProducao({ lancamentos: [{ op_id: 29 }] });
  const m = modais.find((x) => x.saveLabel);
  assert.ok(m);
  assert.equal(m.saveLabel, 'Revisar produção');
});

test('7. confirmar navega para a rota resolvida', () => {
  const { api, modais, navegou } = makeApi(ORDEM);
  api.abrirContinuacaoProducao({ lancamentos: [{ op_id: 29 }, { op_id: 31 }] });
  modais.find((x) => x.saveLabel).onSave();
  assert.deepEqual(navegou, ['#/pedidos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/producao']);
});

test('8. o slider COMPLETO nunca e renderizado no modal de recebimento', () => {
  assert.doesNotMatch(exec, /buildDistribuicaoBlock/,
    'o modal de recebimento nao monta o bloco de distribuicao');
  assert.doesNotMatch(exec, /rangeInput/,
    'nenhum slider e construido aqui');
});

test('9. a recarga autoritativa vem ANTES da continuacao', () => {
  assert.match(exec, /await reload\(\);[\s\S]{0,120}abrirContinuacaoProducao\(res\.result\)/);
});

test('10. a contagem de alocacoes/linhas do formulario NAO decide as OPs', () => {
  const corpo = (exec.match(/function opsAfetadasDoResultado[\s\S]*?\n    \}/) || [''])[0];
  assert.ok(corpo);
  assert.match(corpo, /result && result\.lancamentos/,
    'a fonte e o razao devolvido pelo servidor');
  assert.doesNotMatch(corpo, /rows|alocacoes|hist\./,
    'nem linha de formulario nem projecao de tela decidem');
});

test('11. nenhum endpoint hospedado', () => {
  assert.doesNotMatch(fs.readFileSync(__filename, 'utf8'), /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
