// tests/op-nova-nativo.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A, Emenda 3 — a tela da OP passa a
// tirar TODO teto produtivo da projeção nativa `oc_disponibilidade_op`.
//
// A leitura plana `fetchOrdensCompraFio()` NÃO é apagada: ela continua
// alimentando as superfícies que não são de disponibilidade produtiva — o
// resumo read-only de Pedido de Compra, as linhas de recebimento legado
// enquanto o recebimento nativo está inativo, a métrica de ordens e o PDF de
// compra de fios. O que este arquivo prova é que NENHUMA delas volta a decidir
// teto, ajuste ou início de produção.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OPN  = path.join(ROOT, 'js', 'screens', 'op-nova.js');
const opnSrc = fs.readFileSync(OPN, 'utf8');

// Só linhas executáveis: uma proibição de mecanismo não pode ser satisfeita
// nem violada por um comentário que descreve o passado.
function executavel(src) {
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
const opnExec = executavel(opnSrc);

// Corpo de uma função nomeada, do cabeçalho até a próxima declaração de
// função no mesmo nível de indentação.
function corpoFuncao(src, nome) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + nome + '\\s*\\([\\s\\S]*?\\n  \\}', 'm');
  const m = src.match(re);
  assert.ok(m, 'função ' + nome + ' não encontrada em op-nova.js');
  return m[0];
}

test('1. op-nova.js: sintaxe JS válida', () => {
  cp.execSync(`node --check "${OPN}"`, { stdio: 'pipe' });
});

// ---------------------------------------------------------------------
// A disponibilidade nativa existe e é carregada
// ---------------------------------------------------------------------

test('2. existe um carregador dedicado da disponibilidade NATIVA', () => {
  assert.match(opnExec, /function\s+carregarDisponibilidadeNativa/,
    'a tela precisa de um carregador dedicado da projeção nativa');
  assert.match(opnExec, /carregarDisponibilidadeOP\s*\(/,
    'o carregador tem de delegar ao cliente de oc_disponibilidade_op');
});

test('3. o estado `disponibilidade` existe e é distinto de `ordens`', () => {
  assert.match(opnExec, /let\s+disponibilidade\s*=\s*\[\]/,
    'a disponibilidade nativa tem de ter seu próprio estado');
  assert.match(opnExec, /let\s+ordens\s*=\s*\[\]/,
    '`ordens` continua existindo para as superfícies de ENTIDADE');
});

test('4. a disponibilidade é carregada na carga inicial e na recarga', () => {
  const chamadas = (opnExec.match(/await\s+carregarDisponibilidadeNativa\(\)/g) || []).length;
  assert.ok(chamadas >= 2,
    'a disponibilidade tem de ser carregada na carga inicial E na recarga (encontrado ' + chamadas + ')');
});

test('5. o carregador falha honestamente: sem fallback ao modelo plano', () => {
  const corpo = corpoFuncao(opnSrc, 'carregarDisponibilidadeNativa');
  assert.doesNotMatch(corpo, /ordens_compra_fio|fetchOrdensCompraFio/,
    'o carregador nativo não pode cair para o modelo plano');
  assert.match(corpo, /disponibilidade\s*=\s*\[\]/,
    'em erro a disponibilidade fica vazia, e não com dados de outra autoridade');
});

// ---------------------------------------------------------------------
// O teto produtivo NÃO vem mais do modelo plano
// ---------------------------------------------------------------------

test('6. o bloco de distribuição recebe `disponibilidade`, NUNCA `ordens`', () => {
  const corpo = corpoFuncao(opnSrc, 'buildProposta');
  assert.match(corpo, /disponibilidade:\s*disponibilidade/,
    'buildDistribuicaoBlock tem de receber a projeção nativa');
  assert.doesNotMatch(executavel(corpo), /ordens:\s*ordens/,
    'o bloco de distribuição NÃO pode mais receber as ordens planas');
  assert.match(corpo, /ajusteRevisao:/, 'a revisão de ajuste tem de ser submetida');
});

test('7. o botão "Iniciar produção" recebe `disponibilidade`, NUNCA `ordens`', () => {
  const corpo = corpoFuncao(opnSrc, 'buildAcaoAberta');
  assert.match(corpo, /disponibilidade:\s*disponibilidade/);
  assert.doesNotMatch(executavel(corpo), /ordens:\s*ordens/,
    'o início de produção não pode depender das ordens planas');
  assert.match(corpo, /iniciarProducaoState\(\s*opItensRaw\s*,\s*op\s*,\s*disponibilidade/,
    'a elegibilidade tem de ser calculada sobre status da OP + disponibilidade nativa');
});

test('8. a continuação usa a ROTA devolvida pelo servidor', () => {
  const corpo = corpoFuncao(opnSrc, 'buildAcaoAberta');
  assert.match(corpo, /proximaAcao\s*&&\s*proximaAcao\.rota/,
    'a navegação pós-início tem de consumir proxima_acao.rota do servidor');
});

// ---------------------------------------------------------------------
// A leitura plana sobrevive, mas SEM autoridade produtiva
// ---------------------------------------------------------------------

test('9. fetchOrdensCompraFio continua existindo (Emenda 3: não é apagada em P2-A)', () => {
  assert.match(opnExec, /async\s+function\s+fetchOrdensCompraFio/,
    'a leitura de ENTIDADE de Pedido de Compra permanece em P2-A');
});

test('10. fetchOrdensCompraFio NÃO alimenta teto, ajuste nem início de produção', () => {
  // Os três consumidores produtivos são estes; nenhum pode citar a leitura
  // plana nem a variável que ela preenche.
  for (const nome of ['buildProposta', 'buildAcaoAberta']) {
    const corpo = executavel(corpoFuncao(opnSrc, nome));
    assert.doesNotMatch(corpo, /fetchOrdensCompraFio/,
      nome + ' não pode chamar a leitura plana');
    assert.doesNotMatch(corpo, /\bordens\b\s*[,)]/,
      nome + ' não pode passar as ordens planas adiante');
  }
});

test('11. os consumidores remanescentes de `ordens` são só os não-produtivos', () => {
  // Cada uso restante tem de estar numa superfície de ENTIDADE: resumo,
  // recebimento legado, métrica ou PDF. Nenhum é teto produtivo.
  const linhas = opnSrc.split('\n');
  const usos = [];
  linhas.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l)) return;
    if (/\bordens\b/.test(l) && !/ordens_compra_fio|ordens de|ordens-compra|reloadOrdens|fetchOrdensCompraFio|let ordens/.test(l)) {
      usos.push({ n: i + 1, l: l.trim() });
    }
  });
  // Nenhum uso pode estar num contexto de slider/ajuste/início.
  for (const u of usos) {
    assert.doesNotMatch(u.l, /buildDistribuicaoBlock|buildIniciarProducaoButton|iniciarProducaoState|maxMetrosItem/,
      'op-nova.js:' + u.n + ' ainda liga as ordens planas ao caminho produtivo: ' + u.l);
  }
});

test('12. a tela não faz mais write direto de saldo nem de status de produção', () => {
  assert.doesNotMatch(opnExec, /from\(\s*['"]saldo_fios(_op)?['"]\s*\)[\s\S]{0,80}\.(insert|update|delete)/,
    'nenhuma escrita direta de saldo pode existir na tela');
  assert.doesNotMatch(opnExec, /from\(\s*['"]ops['"]\s*\)[\s\S]{0,120}status:\s*['"]em_producao['"]/,
    'a transição para em_producao é do servidor');
});

test('13. a OP é lida com ajuste_revisao (a revisão é submetida, não inventada)', () => {
  assert.match(opnExec, /ajuste_revisao/,
    'a projeção da OP tem de trazer ops.ajuste_revisao');
});

test('14. existe recarga COMPLETA para o conflito de revisão', () => {
  assert.match(opnExec, /async\s+function\s+recarregarAjusteOP/,
    'o conflito de revisão precisa de um dono de recarga completa');
  const corpo = corpoFuncao(opnSrc, 'recarregarAjusteOP');
  assert.match(corpo, /return\s+false/, 'uma recarga incompleta tem de devolver falso');
  assert.match(corpo, /carregarDisponibilidadeNativa/,
    'a recarga tem de reler também a disponibilidade');
  assert.match(corpo, /return\s+true/, 'só uma recarga completa devolve verdadeiro');
});

test('15. símbolos aposentados não sobrevivem em comentário de call-site', () => {
  assert.doesNotMatch(opnSrc, /window\.aplicarRecalculoOP/,
    'aplicarRecalculoOP foi aposentado — nem o código nem a documentação de call-site podem citá-lo como atual');
  assert.doesNotMatch(opnSrc, /window\.atribuirFornecedorFioOp/,
    'atribuirFornecedorFioOp foi aposentado — nem o código nem a documentação de call-site podem citá-lo como atual');
});
