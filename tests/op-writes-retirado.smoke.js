// tests/op-writes-retirado.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 12) — aposentadoria de
// `window.atribuirFornecedorFioOp`. Fecha DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR.
//
// A decisão do supervisor é APOSENTAR, não "aposentar ou repontar". O helper
// gravava direto no modelo plano em dois writes soltos e não transacionais
// (UPDATE ordens_compra_fio.fornecedor_id + DELETE/INSERT op_fornecedores),
// não tinha nenhum chamador na aplicação, e a escolha de fornecedor de compra
// passou a ser feita pelo planejamento nativo em Pedido -> Insumos.
//
// Este arquivo também prova o que NÃO pode acontecer junto: nenhum outro
// escritor manual de alocação pode nascer no lugar.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OPW  = path.join(ROOT, 'js', 'screens', 'op-writes.js');
const opwSrc = fs.readFileSync(OPW, 'utf8');

function executavel(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const opwExec = executavel(opwSrc);

function makeSandbox() {
  const ops = [];
  function chain(table) {
    const c = {
      select() { return c; },
      insert(p) { ops.push({ table, op: 'insert', payload: p }); return c; },
      update(p) { ops.push({ table, op: 'update', payload: p }); return c; },
      delete() { ops.push({ table, op: 'delete' }); return c; },
      eq() { return c; },
      then(res, rej) { return Promise.resolve({ data: null, error: null }).then(res, rej); },
    };
    return c;
  }
  const sandbox = {
    console, Promise, Object, Array, Number, String, JSON, Error, Boolean,
    supa: { from: (t) => chain(t), rpc: () => Promise.resolve({ data: null, error: null }) },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(opwSrc, sandbox, { filename: 'js/screens/op-writes.js' });
  return { sandbox, ops };
}

test('1. op-writes.js: sintaxe JS válida', () => {
  cp.execSync(`node --check "${OPW}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// O símbolo sumiu — de verdade, e não só do window
// ---------------------------------------------------------------------

test('2. a função atribuirFornecedorFioOp não existe mais no módulo', () => {
  assert.doesNotMatch(opwExec, /function\s+atribuirFornecedorFioOp/,
    'a implementação tem de estar aposentada, não apenas desexportada');
});

test('3. window.atribuirFornecedorFioOp NÃO é publicado', () => {
  const { sandbox } = makeSandbox();
  assert.equal(typeof sandbox.atribuirFornecedorFioOp, 'undefined',
    'o símbolo global não pode existir em tempo de execução');
  assert.doesNotMatch(opwExec, /window\.atribuirFornecedorFioOp\s*=/,
    'a atribuição em window tem de sumir do código');
});

test('4. a exportação na namespace RAVATEX_SCREENS.opWrites sumiu', () => {
  const { sandbox } = makeSandbox();
  const ns = sandbox.RAVATEX_SCREENS.opWrites;
  assert.equal('atribuirFornecedorFioOp' in ns, false,
    'a namespace não pode mais expor o helper aposentado');
  assert.equal(typeof ns.registrarRecebimentoOrdemFio, 'function',
    'o helper que PERMANECE tem de continuar exposto');
});

test('5. nenhum comentário sustenta o símbolo como call-site atual', () => {
  // O guard não pode ser satisfeito por texto morto: se o nome aparece, tem
  // de ser numa nota de APOSENTADORIA, nunca como dependência corrente.
  const linhas = opwSrc.split('\n')
    .filter((l) => /atribuirFornecedorFioOp/.test(l));
  for (const l of linhas) {
    assert.match(l, /APOSENTAD|aposentou|aposentado/i,
      'a única menção permitida é o registro da aposentadoria: ' + l.trim());
  }
});

// ---------------------------------------------------------------------
// Os dois writes planos sumiram
// ---------------------------------------------------------------------

test('6. o UPDATE plano de fornecedor em ordens_compra_fio sumiu', () => {
  assert.doesNotMatch(opwExec, /fornecedor_id:\s*fornecedorId/,
    'o write plano de fornecedor tem de sumir');
  assert.doesNotMatch(opwExec, /from\(\s*['"]op_fornecedores['"]\s*\)/,
    'o par DELETE/INSERT em op_fornecedores tem de sumir');
});

test('7. nenhum novo escritor manual de alocação nasceu no lugar', () => {
  assert.doesNotMatch(opwExec, /alocacao|alocar|ordem_compra_item_alocacao/i,
    'a alocação de compra é do escritor do servidor, não desta tela');
});

test('8. o único write remanescente é o recebimento legado, preservado', () => {
  const { sandbox } = makeSandbox();
  assert.equal(typeof sandbox.registrarRecebimentoOrdemFio, 'function',
    'registrarRecebimentoOrdemFio permanece: o recebimento nativo segue INATIVO');
  // O fallback plano do recebimento é deliberadamente preservado em P2-A.
  assert.match(opwExec, /from\(\s*['"]ordens_compra_fio['"]\s*\)/,
    'o recebimento legado continua sendo a superfície ativa enquanto o cutover nativo não acontece');
});

test('9. o recebimento legado continua funcionando após a aposentadoria', async () => {
  const { sandbox, ops } = makeSandbox();
  const r = await sandbox.registrarRecebimentoOrdemFio({
    ordemId: 'ocf-1', kgRecebido: 10, dataRecebimento: '2026-07-31', status: 'recebido_total',
  });
  assert.equal(r.error, null, 'a aposentadoria não pode ter quebrado o recebimento');
  assert.equal(r.ambiguous, false);
  const upd = ops.find((o) => o.table === 'ordens_compra_fio' && o.op === 'update');
  assert.ok(upd, 'o UPDATE de recebimento tem de continuar acontecendo');
  assert.equal(upd.payload.kg_recebido, 10);
});

test('10. o módulo expõe EXATAMENTE os helpers autorizados', () => {
  const { sandbox } = makeSandbox();
  const chaves = Object.keys(sandbox.RAVATEX_SCREENS.opWrites).sort();
  assert.deepEqual(Array.from(chaves), ['definirEmborracharOpItem', 'registrarRecebimentoOrdemFio'],
    'op-writes.js tem de expor só o recebimento e o emborrachar (TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1)');
});

test('11. nenhum outro módulo da aplicação chama o símbolo aposentado', () => {
  const arquivos = [];
  (function varrer(d) {
    for (const nome of fs.readdirSync(d)) {
      const p = path.join(d, nome);
      if (fs.statSync(p).isDirectory()) varrer(p);
      else if (nome.endsWith('.js')) arquivos.push(p);
    }
  })(path.join(ROOT, 'js'));
  for (const p of arquivos) {
    const src = executavel(fs.readFileSync(p, 'utf8'));
    assert.doesNotMatch(src, /atribuirFornecedorFioOp/,
      path.relative(ROOT, p) + ' ainda cita o símbolo aposentado em código executável');
  }
});

test('12. index.html não referencia o símbolo aposentado', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(index, /atribuirFornecedorFioOp/,
    'nenhum call-site inline pode restar');
});
