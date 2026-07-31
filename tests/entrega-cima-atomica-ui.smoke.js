// tests/entrega-cima-atomica-ui.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-B.2 — TD3, a entrega de tecelagem da
// rota Tapete submete EXATAMENTE UM comando.
//
// A ruling TD3 e vinculante: a atomicidade entrega-para-acabamento e do
// SERVIDOR. O JavaScript nao insere `entregas`, nao insere `entrega_itens`,
// nao faz delete compensatorio e nao chama nenhum escritor de acabamento em
// separado. Este arquivo tambem guarda a SEPARACAO DE ROTA: Manta continua
// exclusivamente no seu proprio comando, e a escolha entre as rotas vem da
// identidade do produto, nunca de inferencia sobre o nome do modelo.
//
// Transporte MOCKADO e ids sinteticos. Nenhuma conexao hospedada.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EW   = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const MW   = path.join(ROOT, 'js', 'screens', 'manta-writes.js');
const OTPA = path.join(ROOT, 'js', 'screens', 'op-tecelagem-producao-admin.js');

const ewSrc   = fs.readFileSync(EW, 'utf8');
const mwSrc   = fs.readFileSync(MW, 'utf8');
const otpaSrc = fs.readFileSync(OTPA, 'utf8');

function executavel(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const ewExec = executavel(ewSrc);

function makeSandbox(rpcHandler) {
  const rpcCalls = [];
  const tableOps = [];
  const toasts = [];
  const sandbox = {
    console, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean, Date,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = {
    from(table) {
      const chain = {
        insert(p) { tableOps.push({ table, op: 'insert', payload: p }); return chain; },
        update(p) { tableOps.push({ table, op: 'update', payload: p }); return chain; },
        delete() { tableOps.push({ table, op: 'delete' }); return chain; },
        select() { return chain; }, eq() { return chain; },
        single() { return Promise.resolve({ data: { id: 999 }, error: null }); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        then(res, rej) { return Promise.resolve({ data: null, error: null }).then(res, rej); },
      };
      return chain;
    },
    rpc(fn, params) {
      rpcCalls.push({ fn, params });
      return Promise.resolve(rpcHandler ? rpcHandler(fn, params) : { data: null, error: null });
    },
  };
  sandbox.toast = (msg, kind) => { toasts.push({ msg, kind }); };
  sandbox.RAVATEX_OP_DISPLAY = {
    getCanonicalIdentity: (o) => (o && o.identidade_operacional) || null,
    formatOpOperationalCode: (o) => (o && o.identidade_operacional) || 'OP',
  };
  vm.createContext(sandbox);
  vm.runInContext(ewSrc, sandbox, { filename: 'js/screens/entrega-writes.js' });
  return { sandbox, rpcCalls, tableOps, toasts };
}

const PAYLOAD = {
  data: '2026-07-31',
  observacao: 'lote A',
  destino_fornecedor_id: 77,
  linhas: [
    { op_item_id: 11, metros_entregues: 120.5, defeito: false, observacao: null },
    { op_item_id: 12, metros_entregues: 80, defeito: true, observacao: 'mancha' },
  ],
};

function enviar(sandbox, opts) {
  return sandbox.salvarEntregaCima({ fornecedorId: 5, opId: 10, payload: PAYLOAD }, opts);
}

const OK_COMPLETO = {
  data: { ok: true, entrega_registrada: true, entrega_id: 999, acabamento: { ok: true, op_latex_id: 44, identidade_operacional: 'OP-A005-2-26', split_seq: 1 } },
  error: null,
};

test('0. entrega-writes.js: sintaxe JS valida', () => {
  cp.execSync(`node --check "${EW}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// UM comando, zero DML
// ---------------------------------------------------------------------

test('1. a rota Tapete submete EXATAMENTE uma RPC de mutacao', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox);
  assert.equal(rpcCalls.length, 1, 'exatamente um comando');
  assert.equal(rpcCalls[0].fn, 'registrar_entrega_cima_com_acabamento');
});

test('2. nenhum insert em entregas', async () => {
  const { sandbox, tableOps } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox);
  assert.equal(tableOps.filter((o) => o.table === 'entregas' && o.op === 'insert').length, 0);
});

test('3. nenhum insert em entrega_itens', async () => {
  const { sandbox, tableOps } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox);
  assert.equal(tableOps.filter((o) => o.table === 'entrega_itens' && o.op === 'insert').length, 0);
});

test('4. nenhum delete compensatorio', async () => {
  const { sandbox, tableOps } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox);
  assert.equal(tableOps.filter((o) => o.op === 'delete').length, 0);
});

test('5. nenhuma chamada de acabamento em separado', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox, { forceSplit: true, motivo: 'amostra' });
  const nomes = rpcCalls.map((c) => c.fn);
  assert.equal(nomes.includes('gerar_op_latex'), false);
  assert.equal(nomes.includes('gerar_op_latex_split'), false);
  assert.equal(nomes.includes('gerar_op_acabamento'), false,
    'a entrega normal nunca chama o escritor de recuperacao');
  assert.equal(nomes.length, 1);
});

test('6. o fonte nao guarda mais nenhum desses mecanismos na rota Tapete', () => {
  assert.doesNotMatch(ewExec, /rpc\('gerar_op_latex'/);
  assert.doesNotMatch(ewExec, /rpc\('gerar_op_latex_split'/);
  assert.doesNotMatch(ewExec, /gerar manualmente|Gere manualmente/i,
    'a copia que mandava criar a OP na mao foi retirada');
});

// ---------------------------------------------------------------------
// Os tres estados autoritativos
// ---------------------------------------------------------------------

test('7. FALHA DE VALIDACAO: nada registrado, sem sugerir sucesso parcial', async () => {
  const { sandbox, toasts } = makeSandbox(() => ({ data: { ok: false, codigo: 'ENTREGA_ITEM_FORA_DA_OP' }, error: null }));
  const r = await enviar(sandbox);
  assert.equal(r, false);
  assert.equal(toasts.filter((t) => t.kind === 'success').length, 0);
  const erro = toasts.find((t) => t.kind === 'error');
  assert.match(erro.msg, /NAO registrada|NÃO registrada/);
  assert.match(erro.msg, /Nenhum dado foi gravado/);
  assert.match(erro.msg, /ENTREGA_ITEM_FORA_DA_OP/);
});

test('8. ENTREGA + ACABAMENTO: identifica a OP de acabamento canonica', async () => {
  const { sandbox, toasts } = makeSandbox(() => OK_COMPLETO);
  const r = await enviar(sandbox);
  assert.equal(r, true);
  const ok = toasts.find((t) => t.kind === 'success');
  assert.ok(ok);
  assert.match(ok.msg, /OP-A005-2-26/, 'a identidade autoritativa nomeia a OP');
});

test('9. ENTREGA SALVA + ACABAMENTO FALHO: diz as duas coisas e nao retenta', async () => {
  const { sandbox, rpcCalls, toasts } = makeSandbox(() => ({
    data: {
      ok: true, entrega_registrada: true, entrega_id: 999,
      acabamento: { ok: false, codigo: 'ACABAMENTO_CRIACAO_FALHOU', recuperavel: true },
      proxima_acao: 'RECUPERAR_OP_ACABAMENTO',
    },
    error: null,
  }));
  const r = await enviar(sandbox);
  assert.equal(r, true, 'a entrega esta salva; o retorno nao pode nega-la');
  assert.equal(toasts.filter((t) => t.kind === 'success').length, 0);
  const erro = toasts.find((t) => t.kind === 'error');
  assert.match(erro.msg, /Entrega salva/);
  assert.match(erro.msg, /FALHOU/);
  assert.match(erro.msg, /Recuperar OP de acabamento/, 'aponta a acao explicita de recuperacao');
  assert.equal(rpcCalls.length, 1, 'nenhuma retentativa automatica de acabamento');
});

test('10. o interpretador distingue os tres estados sem inferir um do outro', () => {
  const { sandbox } = makeSandbox();
  const f = sandbox.RAVATEX_ENTREGA_WRITES.interpretarResultadoEntregaCima;
  assert.equal(f({ ok: false, codigo: 'X' }).estado, 'falha_validacao');
  assert.equal(f({ entrega_registrada: true, acabamento: { ok: true } }).estado, 'entrega_e_acabamento');
  assert.equal(f({ entrega_registrada: true, acabamento: { ok: false } }).estado, 'entrega_sem_acabamento');
  assert.equal(f(null).estado, 'falha_validacao', 'resposta ausente e falha, nunca sucesso');
  assert.equal(f({ entrega_registrada: true }).estado, 'entrega_sem_acabamento',
    'sem bloco de acabamento, nao se pode afirmar que ele foi criado');
});

// ---------------------------------------------------------------------
// Idempotencia de topo
// ---------------------------------------------------------------------

test('11. a chave sobrevive a um reenvio ambiguo da MESMA submissao', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: null, error: new Error('timeout') }));
  await enviar(sandbox);
  await enviar(sandbox);
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[0].params.p_idempotency_key, rpcCalls[1].params.p_idempotency_key);
});

test('12. uma submissao ALTERADA nasce com chave nova', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => ({ data: null, error: new Error('timeout') }));
  await enviar(sandbox);
  await sandbox.salvarEntregaCima({
    fornecedorId: 5, opId: 10,
    payload: Object.assign({}, PAYLOAD, { observacao: 'outro lote' }),
  });
  assert.notEqual(rpcCalls[0].params.p_idempotency_key, rpcCalls[1].params.p_idempotency_key);
});

test('13. o motivo de split viaja no comando unico', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => OK_COMPLETO);
  await enviar(sandbox, { forceSplit: true, motivo: '  retrabalho  ' });
  assert.equal(rpcCalls[0].params.p_motivo_split, 'retrabalho');
});

test('14. split sem motivo bloqueia ANTES do comando', async () => {
  const { sandbox, rpcCalls } = makeSandbox(() => OK_COMPLETO);
  const r = await enviar(sandbox, { forceSplit: true, motivo: '   ' });
  assert.equal(r, false);
  assert.equal(rpcCalls.length, 0);
});

// ---------------------------------------------------------------------
// Separacao de rota
// ---------------------------------------------------------------------

test('15. Manta continua exclusivamente no seu proprio comando', () => {
  assert.match(mwSrc, /registrar_entrega_cima_manta/,
    'a rota Manta tem o seu escritor proprio');
  assert.doesNotMatch(ewSrc, /registrar_entrega_cima_manta/,
    'o escritor Tapete nunca atende a rota Manta');
});

test('16. Manta nunca chama o escritor atomico do Tapete', () => {
  assert.doesNotMatch(mwSrc, /registrar_entrega_cima_com_acabamento/);
});

test('17. Manta nunca chama escritor de acabamento nenhum', () => {
  assert.doesNotMatch(mwSrc, /gerar_op_acabamento/);
  assert.doesNotMatch(mwSrc, /gerar_op_latex/);
});

test('18. a escolha de rota vem da IDENTIDADE DO PRODUTO, nao do nome do modelo', () => {
  // O seletor real le modelos.tipo_produto; nenhuma comparacao com o NOME do
  // modelo pode decidir rota.
  assert.match(otpaSrc, /tipo_produto/,
    'a rota e decidida por tipo_produto');
  assert.doesNotMatch(executavel(otpaSrc), /modelo\.nome\s*===\s*['"]|nome\s*===\s*['"]manta['"]/i,
    'nenhuma inferencia por nome de modelo pode decidir a rota');
});

test('19. nenhum endpoint hospedado e contatado por este arquivo', () => {
  const meu = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
