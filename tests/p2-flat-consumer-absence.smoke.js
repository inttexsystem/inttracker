// tests/p2-flat-consumer-absence.smoke.js
//
// P2 consolidado — o modelo PLANO perdeu toda autoridade produtiva.
//
// A afirmação honesta NÃO é "a string ordens_compra_fio desapareceu do
// repositório". A arquitetura transitória ACEITA consumidores de LEITURA do
// Pedido de Compra legado enquanto o cutover nativo continua inativo. O que
// este arquivo prova é a fronteira: nada do modelo plano ALIMENTA um caminho
// produtivo ou um escritor canônico do P2, e os consumidores retidos são
// exatamente os quatro declarados.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exec = (s) => s.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const SRC = {
  recalculo:  exec(read('js/screens/op-recalculo.js')),
  distrib:    exec(read('js/screens/op-distribuicao-ui.js')),
  persistir:  exec(read('js/screens/op-persistir.js')),
  detailData: exec(read('js/screens/pedido-detail-data.js')),
  detailEvts: exec(read('js/screens/pedido-detail-events.js')),
  painel:     exec(read('js/screens/pedido-producao-panel.js')),
  fornecedor: exec(read('js/screens/fornecedor.js')),
  entregaW:   exec(read('js/screens/entrega-writes.js')),
  entregaF:   exec(read('js/screens/entrega-form.js')),
  expedicao:  exec(read('js/screens/expedicao-admin.js')),
  opWrites:   exec(read('js/screens/op-writes.js')),
  opNova:     exec(read('js/screens/op-nova.js')),
  calculo:    exec(read('js/calculo-op.js')),
};

const FLAT = /ordens_compra_fio/;

// ---------------------------------------------------------------------
// PROIBIDO depois do P2 — o plano não é dono de nada produtivo
// ---------------------------------------------------------------------

test('1. disponibilidade produtiva de OP nao vem do plano', () => {
  assert.doesNotMatch(SRC.recalculo, FLAT);
  assert.match(SRC.recalculo, /rpc\('oc_disponibilidade_op'/);
});

test('2. teto do slider nao vem do plano', () => {
  assert.doesNotMatch(SRC.distrib, FLAT);
  assert.match(SRC.distrib, /kg_disponivel/);
});

test('3. persistencia do ajuste nao passa pelo plano', () => {
  assert.doesNotMatch(SRC.recalculo, /from\(\s*['"]op_itens['"]\s*\)/);
  assert.match(SRC.recalculo, /rpc\('salvar_ajuste_producao_op'/);
});

test('4. inicio de producao nao passa pelo plano', () => {
  assert.match(SRC.recalculo, /rpc\('iniciar_producao_op'/);
  assert.doesNotMatch(SRC.recalculo, /saldo_fios|em_producao/);
});

test('5. fila de aceite do fornecedor nao vem do plano', () => {
  assert.match(SRC.fornecedor, /rpc\('listar_fila_aceite_fornecedor'\)/);
  assert.doesNotMatch(SRC.fornecedor, /from\(\s*['"]ordem_compra['"]\s*\)/);
});

test('6. status e cancelamento do Pedido nao passam pelo plano', () => {
  assert.match(SRC.detailEvts, /rpc\('alterar_status_pedido'/);
  assert.match(SRC.detailEvts, /rpc\('cancelar_pedido'/);
  assert.doesNotMatch(SRC.detailEvts, /update\(\s*\{\s*status:\s*novoStatus/);
});

test('7. entrega Tapete -> acabamento e um comando so, sem plano', () => {
  assert.match(SRC.entregaW, /rpc\('registrar_entrega_cima_com_acabamento'/);
  assert.doesNotMatch(SRC.entregaW, /rpc\('gerar_op_latex'/);
  assert.doesNotMatch(SRC.entregaW, /rpc\('gerar_op_latex_split'/);
});

test('8. estorno e correcao de expedicao Tapete nao passam pelo plano', () => {
  assert.match(SRC.expedicao, /estornar_expedicao_tapete_parcial/);
  assert.match(SRC.expedicao, /corrigir_entrega_expedicao/);
  assert.doesNotMatch(SRC.expedicao, FLAT);
  assert.doesNotMatch(SRC.expedicao, /from\(\s*['"]pedidos['"]\s*\)/);
});

test('9. o painel consolidado nao conhece o modelo plano', () => {
  assert.doesNotMatch(SRC.painel, FLAT);
  assert.match(SRC.painel, /rpc\('oc_disponibilidade_op'/);
});

test('10. o detalhe do Pedido nao tem mais fallback plano', () => {
  assert.doesNotMatch(SRC.detailData, /from\(\s*['"]ordens_compra_fio['"]\s*\)/);
  assert.match(SRC.detailData, /attemptCanonicalRead/);
});

test('11. a abertura de OP nao materializa linhas planas', () => {
  assert.doesNotMatch(SRC.persistir, /from\(\s*['"]ordens_compra_fio['"]\s*\)/);
  // P4 (9.9.L.4): a sincronizacao das necessidades deixou de ser uma chamada
  // separada da tela e passou para DENTRO de abrir_op_tecelagem, junto com a
  // transicao de status, porque as duas precisam ser atomicas — a
  // sincronizacao so enxerga uma OP que JA esta 'aberta', e o cliente nao tem
  // como desfazer a transicao se ela falhar. A garantia deste guard nao muda:
  // a abertura continua sincronizando NECESSIDADE nativa e nunca documento
  // plano; o dono e que passou a ser o servidor.
  assert.match(SRC.persistir, /rpc\(\s*['"]abrir_op_tecelagem['"]/);
});

test('12. a receita produz NECESSIDADE, nao documento plano', () => {
  assert.match(SRC.calculo, /function montarNecessidadesCompra/);
  assert.doesNotMatch(SRC.calculo, /function montarOrdensCompraFio/);
  assert.doesNotMatch(SRC.calculo, /kg_pedido:/);
});

test('13. o escritor manual de alocacao plana foi aposentado', () => {
  assert.doesNotMatch(SRC.opWrites, /atribuirFornecedorFioOp/);
});

// ---------------------------------------------------------------------
// RETIDO temporariamente — leitura de ENTIDADE, sem autoridade produtiva
// ---------------------------------------------------------------------

test('14. os consumidores planos RETIDOS sao exatamente os declarados', () => {
  // Enquanto o cutover nativo continua INATIVO, quatro superficies de LEITURA
  // do Pedido de Compra legado permanecem: resumo read-only, linhas de
  // recebimento legado, metrica de ordens e projecao do PDF de fios. Elas
  // vivem em op-nova.js (as tres primeiras, sobre `fetchOrdensCompraFio`) e no
  // proprio escritor de recebimento legado em op-writes.js.
  assert.match(SRC.opNova, /async function fetchOrdensCompraFio/,
    'a leitura de ENTIDADE permanece em P2');
  assert.match(SRC.opWrites, /from\(\s*['"]ordens_compra_fio['"]\s*\)/,
    'o recebimento legado permanece enquanto o recebimento nativo esta inativo');
  assert.match(SRC.fornecedor, /from\(\s*['"]ordens_compra_fio['"]\s*\)/,
    'a tela de recebimento legado do fornecedor permanece, ao lado da fila nativa');
});

test('15. NENHUM consumidor retido alimenta caminho produtivo', () => {
  // As tres funcoes produtivas de op-nova.js nao podem citar a leitura plana
  // nem repassar a lista plana adiante.
  for (const nome of ['buildProposta', 'buildAcaoAberta']) {
    const re = new RegExp('function\\s+' + nome + '\\s*\\([\\s\\S]*?\\n  \\}', 'm');
    const corpo = (SRC.opNova.match(re) || [''])[0];
    assert.ok(corpo, nome + ' nao encontrado');
    assert.doesNotMatch(corpo, /fetchOrdensCompraFio/, nome + ' nao le o modelo plano');
    assert.doesNotMatch(corpo, /ordens:\s*ordens/, nome + ' nao repassa a lista plana');
    assert.match(corpo, /disponibilidade/, nome + ' usa a projecao nativa');
  }
});

test('16. nenhum escritor canonico do P2 recebe dado plano', () => {
  // A fronteira honesta e por FUNCAO, nao por arquivo: fornecedor.js hospeda,
  // no MESMO modulo, a fila de aceite nativa e a tela de RECEBIMENTO legado
  // (`screenFornecedorOrdens`), que continua lendo e escrevendo o modelo plano
  // enquanto o recebimento nativo esta inativo. Coabitar nao e alimentar.
  const CAMINHOS_CANONICOS = [
    ['buildLinhaAceite', SRC.fornecedor],
    ['carregarFilaAceite', SRC.fornecedor],
    ['salvarEntregaCima', SRC.entregaW],
    ['recuperarOpAcabamento', SRC.entregaW],
    ['buildComandoTapete', SRC.expedicao],
    ['alterarStatus', SRC.detailEvts],
    ['cancelarPedido', SRC.detailEvts],
    ['salvarDistribuicaoOP', SRC.recalculo],
    ['iniciarProducaoOP', SRC.recalculo],
  ];
  for (const [nome, src] of CAMINHOS_CANONICOS) {
    const re = new RegExp(String.raw`(?:async\s+)?function\s+${nome}\s*\([\s\S]*?\n  \}`, 'm');
    const corpo = (src.match(re) || [''])[0];
    assert.ok(corpo, 'funcao nao encontrada: ' + nome);
    assert.doesNotMatch(corpo, /ordens_compra_fio/,
      nome + ' e caminho canonico do P2 e nao pode tocar o modelo plano');
  }
});

test('17. a afirmacao NAO e "zero ocorrencia textual" — a fronteira e explicita', () => {
  // Este teste existe para impedir uma futura simplificacao desonesta: enquanto
  // o cutover estiver inativo, EXISTEM ocorrencias do nome do modelo plano, e
  // isso e a arquitetura aceita, nao um defeito.
  const total = SRC.opNova.match(/ordens_compra_fio/g) || [];
  assert.ok(total.length > 0,
    'os consumidores read-only retidos ainda existem — nao se afirma ausencia total');
});
