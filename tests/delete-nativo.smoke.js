// tests/delete-nativo.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 14) — a exclusão
// controlada passa a MOSTRAR o grafo de dependências NATIVO.
//
// O diagnóstico do servidor já contava as tabelas nativas; sem os rótulos, elas
// eram contadas e não exibidas, e o operador confirmava uma exclusão cujo
// impacto real ficava invisível.
//
// O que este arquivo guarda com igual força é o que NÃO mudou: `remover_pedido`
// e `remover_op` continuam sendo os ÚNICOS donos da remoção. Nenhuma exclusão
// direta foi adicionada e nenhum escritor do servidor é contornado.
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
const DEL  = path.join(ROOT, 'js', 'delete-helpers.js');
const delSrc = fs.readFileSync(DEL, 'utf8');

function executavel(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const delExec = executavel(delSrc);

// Tabelas do grafo NATIVO que uma exclusão de Pedido/OP pode alcançar.
const DEPENDENCIAS_NATIVAS = [
  'necessidade_compra_fio',
  'necessidade_compra_planejamento',
  'ordem_compra',
  'ordem_compra_item',
  'ordem_compra_item_alocacao',
  'ordem_compra_recebimentos',
  'ordem_compra_fio_lancamentos',
  'ordem_compra_fio_movimentos_estoque',
  'ordem_compra_eventos',
];

function makeSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableCalls = [];
  const sandbox = {
    console, Promise, Object, Array, Number, String, JSON, Error, Boolean,
    supa: {
      from: (t) => { tableCalls.push(t); return new Proxy({}, { get: () => () => ({}) }); },
      rpc: (fn, params) => {
        rpcCalls.push({ fn, params });
        return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: null, error: null });
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(delSrc, sandbox, { filename: 'js/delete-helpers.js' });
  return { sandbox, rpcCalls, tableCalls };
}

test('1. delete-helpers.js: sintaxe JS válida', () => {
  cp.execSync(`node --check "${DEL}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// A cobertura nativa
// ---------------------------------------------------------------------

test('2. o resumo de impacto cobre o grafo de dependências NATIVO', () => {
  const { sandbox } = makeSandbox();
  const counts = {};
  DEPENDENCIAS_NATIVAS.forEach((t, i) => { counts[t] = i + 1; });
  const resumo = sandbox.RAVATEX_DELETE.buildImpactSummary({ counts });
  const chaves = Array.from(resumo).map((r) => r.key);
  for (const tabela of DEPENDENCIAS_NATIVAS) {
    assert.ok(chaves.includes(tabela),
      tabela + ' é contada pelo servidor e tem de ser MOSTRADA ao operador');
  }
});

test('3. cada dependência nativa tem rótulo legível e valor correto', () => {
  const { sandbox } = makeSandbox();
  const resumo = Array.from(sandbox.RAVATEX_DELETE.buildImpactSummary({
    counts: { ordem_compra: 2, ordem_compra_item_alocacao: 9 },
  }));
  const oc = resumo.find((r) => r.key === 'ordem_compra');
  assert.ok(oc && oc.label && oc.label.length > 0, 'a linha precisa de um rótulo legível');
  assert.equal(oc.value, 2);
  const aloc = resumo.find((r) => r.key === 'ordem_compra_item_alocacao');
  assert.equal(aloc.value, 9);
});

test('4. a cobertura antiga permanece — nada foi trocado por nada', () => {
  const { sandbox } = makeSandbox();
  const antigas = ['pedido_itens', 'lotes', 'ops_vinculadas', 'op_itens', 'entregas',
    'expedicoes', 'ordens_compra_fio', 'saldo_fios_op', 'documentos_vinculados'];
  const counts = {}; antigas.forEach((t, i) => { counts[t] = i; });
  const chaves = Array.from(sandbox.RAVATEX_DELETE.buildImpactSummary({ counts })).map((r) => r.key);
  for (const t of antigas) assert.ok(chaves.includes(t), t + ' não pode ter sido perdida');
});

test('5. uma tabela ausente do diagnóstico continua não sendo inventada', () => {
  const { sandbox } = makeSandbox();
  const resumo = Array.from(sandbox.RAVATEX_DELETE.buildImpactSummary({ counts: { ordem_compra: 1 } }));
  assert.equal(resumo.length, 1,
    'só o que o servidor contou aparece; nada de linha fantasma com zero');
  assert.equal(resumo[0].key, 'ordem_compra');
});

// ---------------------------------------------------------------------
// O dono canônico da remoção NÃO mudou
// ---------------------------------------------------------------------

test('6. a remoção continua sendo dos escritores do servidor', async () => {
  const { sandbox, rpcCalls, tableCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.RAVATEX_DELETE.removerPedido('ped-1', { confirmacao: 'EXCLUIR' });
  await sandbox.RAVATEX_DELETE.removerOP(900001, { confirmacao: 'EXCLUIR' });
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['remover_pedido', 'remover_op']);
  assert.deepEqual(tableCalls, [], 'nenhuma exclusão direta por tabela pode existir');
});

test('7. NENHUMA exclusão direta irrestrita foi adicionada', () => {
  assert.doesNotMatch(delExec, /\.delete\(\)/,
    'delete-helpers.js não pode fazer DELETE direto em tabela nenhuma');
  assert.doesNotMatch(delExec, /from\(\s*['"][a-z_]+['"]\s*\)/,
    'o módulo só fala por RPC — nenhum acesso direto a tabela');
});

test('8. o diagnóstico continua sendo do servidor', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true, impacto: { counts: {} } }, error: null }));
  await sandbox.RAVATEX_DELETE.diagnosticarPedido('ped-1');
  await sandbox.RAVATEX_DELETE.diagnosticarOP(900001);
  assert.deepEqual(rpcCalls.map((c) => c.fn), ['diagnosticar_impacto_pedido', 'diagnosticar_impacto_op']);
});

test('9. os quatro donos canônicos continuam expostos', () => {
  const { sandbox } = makeSandbox();
  for (const nome of ['diagnosticarPedido', 'diagnosticarOP', 'removerPedido', 'removerOP',
    'buildImpactSummary', 'showDeleteConfirmation', 'excluirPedidoComFluxo', 'excluirOPComFluxo']) {
    assert.equal(typeof sandbox.RAVATEX_DELETE[nome], 'function', nome + ' tem de continuar exposto');
  }
});

test('10. as mensagens de bloqueio continuam intactas', () => {
  const { sandbox } = makeSandbox();
  const msgs = sandbox.RAVATEX_DELETE.messages;
  for (const chave of ['entrega', 'expedicao', 'filha', 'documental', 'confirmacao', 'confirmacaoCascata', 'aviso']) {
    assert.equal(typeof msgs[chave], 'string', 'a mensagem ' + chave + ' não pode ter sumido');
    assert.ok(msgs[chave].length > 0);
  }
});

test('11. a confirmação forte continua exigida quando o servidor pede', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: { ok: true }, error: null }));
  await sandbox.RAVATEX_DELETE.removerPedido('ped-1', { confirmacao: 'EXCLUIR TUDO' });
  assert.equal(rpcCalls[0].params.p_confirmacao, 'EXCLUIR TUDO',
    'a confirmação do operador tem de chegar ao escritor do servidor');
});
