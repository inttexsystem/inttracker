// tests/op-persistir-nativo.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 9) — a abertura da OP
// sincroniza SOMENTE necessidades NATIVAS.
//
// O ramo plano — que montava linhas de `ordens_compra_fio` a partir da receita
// e as gravava com delete+insert diretos — foi removido. A proibição canônica
// é explícita: nenhuma escrita dupla nativo-para-plano e nenhuma materialização
// sintética de ordens_compra_fio, nem como medida temporária.
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
const OPP  = path.join(ROOT, 'js', 'screens', 'op-persistir.js');
const oppSrc = fs.readFileSync(OPP, 'utf8');

function executavel(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const oppExec = executavel(oppSrc);

// Sandbox mínimo: registra toda tabela tocada e toda mutação enviada.
function makeSandbox({ regime = { ok: true, modelo: 'native' }, sync = { ok: true } } = {}) {
  const ops = [];
  function chain(table) {
    const c = {
      _table: table, _mut: null, _payload: null,
      select() { return c; },
      insert(p) { c._mut = 'insert'; c._payload = p; ops.push({ table, op: 'insert', payload: p }); return c; },
      update(p) { c._mut = 'update'; c._payload = p; ops.push({ table, op: 'update', payload: p }); return c; },
      delete() { c._mut = 'delete'; ops.push({ table, op: 'delete' }); return c; },
      eq() { return c; }, in() { return c; }, order() { return c; }, limit() { return c; },
      maybeSingle() { return Promise.resolve(dataFor(table)); },
      single() { return Promise.resolve(dataFor(table)); },
      then(res, rej) { return Promise.resolve(dataFor(table)).then(res, rej); },
    };
    return c;
  }
  function dataFor(table) {
    if (table === 'ops') return { data: { id: 900001, status: 'aberta' }, error: null };
    if (table === 'lotes') return { data: { id: 5, numero: 5 }, error: null };
    if (table === 'pedidos') return { data: { prioridade_status: 'nenhuma' }, error: null };
    return { data: [], error: null };
  }

  const sandbox = {
    console, Promise, Object, Array, Number, String, Math, JSON, Error, Boolean,
    supa: {
      from: (t) => { ops.push({ table: t, op: 'from' }); return chain(t); },
      // proximo_numero_op reserva o número interno da OP nova; devolve um
      // número sintético para o caminho de criação chegar ao INSERT.
      rpc: (fn, params) => {
        ops.push({ op: 'rpc', fn, params });
        if (fn === 'proximo_numero_op') return Promise.resolve({ data: 7, error: null });
        if (fn === 'substituir_itens_op') {
          return Promise.resolve({ data: { ok: true, op_id: params && params.p_op_id }, error: null });
        }
        // P4: abrir_op_tecelagem é o dono da abertura. Ele resolve o regime e
        // sincroniza as necessidades DENTRO da mesma transação, então o
        // harness reproduz esse encadeamento aqui — inclusive o fato de que
        // uma falha chega como exceção, que é o que desfaz a transição.
        if (fn === 'abrir_op_tecelagem') {
          if (!regime || regime.ok !== true) {
            return Promise.resolve({ data: null, error: { message: 'regime_resolve' } });
          }
          if (regime.modelo !== 'native') {
            return Promise.resolve({ data: null, error: { message: 'regime_legado_sem_escritor' } });
          }
          ops.push({ op: 'sync_nativo' });
          if (!sync || sync.ok !== true) {
            return Promise.resolve({ data: null, error: { message: 'necessidades_sync' } });
          }
          return Promise.resolve({
            data: { ok: true, op_id: params && params.p_op_id, modelo: 'native', status: 'aberta' },
            error: null,
          });
        }
        if (fn === 'remover_op') return Promise.resolve({ data: { ok: true }, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  sandbox.RAVATEX_SCREENS = {
    opCompraRegime: {
      resolverRegimeCompraFio: async () => regime,
      sincronizarNecessidadesCompraFio: async () => { ops.push({ op: 'sync_nativo' }); return sync; },
    },
  };
  // Se o ramo plano ressuscitar, estas chamadas aparecem em `ops`.
  sandbox.calcularFiosOP = () => { ops.push({ op: 'calcularFiosOP' }); return { algodaoPorCor: {}, poliester: { PRETO: 0, BRANCO: 0 } }; };
  sandbox.montarNecessidadesCompra = () => { ops.push({ op: 'montarNecessidadesCompra' }); return []; };
  sandbox.montarOrdensCompraFio = () => { ops.push({ op: 'montarOrdensCompraFio' }); return []; };

  vm.runInContext(oppSrc, sandbox, { filename: 'js/screens/op-persistir.js' });
  return { sandbox, ops };
}

const BASE = {
  status: 'aberta',
  op: { id: 900001, lote_id: 5, status: 'simulada' },
  ano: 2026,
  clienteSel: 'cli-1',
  itens: [{ modeloId: 1, metros: 100 }],
  fornSel: { cima: 'f1' },
  modelosById: { 1: { id: 1, tipo_produto: 'tapete', largura: 2.10, cor_1: { id: 10 }, cor_2: { id: 10 } } },
  parametrosByLargura: { '2.10': { algodao_por_ml: 0.1, poliester_por_ml: 0.05, valor_x: 1 } },
  pedidoId: 'ped-1',
  numero: 7,
};

async function persistir(sandbox, over) {
  return await sandbox.persistirOP(Object.assign({}, BASE, over || {}));
}

test('1. op-persistir.js: sintaxe JS válida', () => {
  cp.execSync(`node --check "${OPP}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// O ramo plano sumiu
// ---------------------------------------------------------------------

test('2. nenhuma escrita em ordens_compra_fio resta no código executável', () => {
  assert.doesNotMatch(oppExec, /from\(\s*['"]ordens_compra_fio['"]\s*\)/,
    'a materialização plana de ordens de fio foi retirada em P2-A');
  assert.doesNotMatch(oppExec, /ordens_compra_fio_delete|ordens_compra_fio_insert/,
    'os steps do ramo plano não podem sobreviver');
});

test('3. o montador de payload plano não é mais chamado', () => {
  assert.doesNotMatch(oppExec, /montarOrdensCompraFio/,
    'montarOrdensCompraFio foi renomeado e não produz mais payload de documento');
  assert.doesNotMatch(oppExec, /calcularFiosOP/,
    'a receita não é mais transformada em documento de compra por esta tela');
});

test('4. clearFenceError saiu junto com as escritas planas que ele traduzia', () => {
  assert.doesNotMatch(oppExec, /function\s+clearFenceError/,
    'clearFenceError existia só para as escritas planas de fio');
});

// ---------------------------------------------------------------------
// A sincronização nativa é o único caminho
// ---------------------------------------------------------------------

test('5. abrir uma OP nativa sincroniza NECESSIDADES e não cria documento plano', async () => {
  const { sandbox, ops } = makeSandbox();
  const r = await persistir(sandbox);
  assert.equal(r.error, null, 'a abertura nativa devia ter sucesso: ' + JSON.stringify(r.error));
  assert.equal(r.modelo, 'native');
  assert.ok(ops.some((o) => o.op === 'sync_nativo'), 'a sincronização nativa tem de rodar');
  assert.equal(ops.some((o) => o.table === 'ordens_compra_fio'), false,
    'nenhuma linha plana pode ser criada');
  assert.equal(ops.some((o) => o.op === 'montarOrdensCompraFio'), false,
    'nenhum payload plano pode ser montado');
});

test('6. falha na sincronização nativa devolve a OP a simulada e NÃO cai para o plano', async () => {
  const { sandbox, ops } = makeSandbox({ sync: { ok: false, erro: 'falhou' } });
  const r = await persistir(sandbox);
  assert.ok(r.error, 'a falha tem de ser propagada');
  assert.equal(r.step, 'necessidades_sync');
  // P4: quem devolve a OP a 'simulada' é o ROLLBACK da transação do
  // servidor, não um UPDATE do cliente — que perdeu esse privilégio (TD2).
  const escritaStatus = ops.filter((o) => o.table === 'ops' && o.op === 'update' && o.payload && 'status' in o.payload);
  assert.equal(escritaStatus.length, 0, 'o cliente não pode escrever ops.status nem para compensar');
  assert.equal(ops.some((o) => o.table === 'ordens_compra_fio'), false,
    'a falha NÃO pode acionar um fallback plano');
});

test('7. um Pedido em regime LEGADO falha honestamente — sem escritor, sem fingir sucesso', async () => {
  const { sandbox, ops } = makeSandbox({ regime: { ok: true, modelo: 'legacy' } });
  const r = await persistir(sandbox);
  assert.ok(r.error, 'o regime legado não pode devolver sucesso silencioso');
  assert.equal(r.step, 'regime_legado_sem_escritor');
  assert.equal(ops.some((o) => o.table === 'ordens_compra_fio'), false,
    'o regime legado NÃO pode recriar as linhas planas');
  assert.equal(ops.some((o) => o.op === 'sync_nativo'), false,
    'o regime legado não pode ser sincronizado como se fosse nativo');
  const escritaStatus = ops.filter((o) => o.table === 'ops' && o.op === 'update' && o.payload && 'status' in o.payload);
  assert.equal(escritaStatus.length, 0, 'o cliente não pode escrever ops.status nem para compensar');
});

test('8. o regime continua sendo decidido pelo SERVIDOR, não pelo cliente', () => {
  // P4: a resolução do regime deixou de ser uma chamada separada da tela e
  // passou para DENTRO de abrir_op_tecelagem, junto com a transição e a
  // sincronização, porque as três precisam ser atômicas. A garantia que esta
  // asserção protege é a mesma — o cliente não decide o regime — e agora ela
  // é ainda mais forte: a tela sequer enxerga o regime.
  assert.match(oppExec, /rpc\(\s*['"]abrir_op_tecelagem['"]/,
    'a abertura, e com ela o regime, tem de vir do servidor');
  assert.doesNotMatch(oppExec, /resolverRegimeCompraFio\s*\(/,
    'a tela não resolve mais o regime por conta própria');
  assert.doesNotMatch(oppExec, /modelo\s*=\s*['"]native['"]/,
    'o cliente não pode decidir o regime localmente');
});

// ---------------------------------------------------------------------
// ops.status não é mais fornecido pelo cliente quando o default basta
// ---------------------------------------------------------------------

test('9. a criação de OP simulada NÃO envia ops.status (toma o default canônico)', async () => {
  const { sandbox, ops } = makeSandbox();
  await persistir(sandbox, { status: 'simulada', op: null });
  const insert = ops.find((o) => o.table === 'ops' && o.op === 'insert');
  assert.ok(insert, 'a OP nova tem de ser inserida');
  assert.equal('status' in insert.payload, false,
    'ops.status é fato protegido: a OP nova nasce simulada por DEFAULT do schema');
  assert.equal(insert.payload.numero, 7, 'os campos de criação legítimos continuam presentes');
  assert.equal(insert.payload.ano, 2026);
});

test('10. P4: nem um status não-default é declarado pelo cliente', async () => {
  const { sandbox, ops } = makeSandbox();
  await persistir(sandbox, { status: 'aberta', op: null });
  // P4 (TD2.1): ops.status deixou de ser declarável pelo cliente em QUALQUER
  // caso. Uma OP nova nasce 'simulada' pelo default e a abertura é uma
  // operação subsequente do servidor.
  const insert = ops.find((o) => o.table === 'ops' && o.op === 'insert');
  assert.equal('status' in insert.payload, false,
    'nem mesmo um estado não-default pode ser declarado pelo cliente');
  assert.ok(ops.find((o) => o.op === 'rpc' && o.fn === 'abrir_op_tecelagem'),
    'a abertura passa pelo escritor canônico');
});

test('11. nenhum escritor de criação do P4 foi antecipado aqui', () => {
  assert.doesNotMatch(oppExec, /criar_pedido|criar_op|rpc\(\s*['"]criar/,
    'P2-A não implementa o escritor de criação do P4');
});
