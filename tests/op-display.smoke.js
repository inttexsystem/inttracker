// =====================================================================
// === tests/op-display.smoke.js ========================================
// Smoke do dono central da identidade de OP e de Ordem de Compra
// (js/op-display.js -> window.RAVATEX_OP_DISPLAY).
//
// Fase: OP-CANONICAL-IDENTITY-REFOUNDATION-R1
// Contrato: OP-{T|A}{pedido:3}-{seq}-{ano:2}   ex. OP-T005-1-26
//           OC-{pedido:3}-{seq}-{ano:2}        ex. OC-005-1-26
//   - a identidade e LIDA de `ops.identidade_operacional` /
//     `ordem_compra.identidade_operacional` (db/95): atribuida uma vez,
//     persistida, unica por constraint e imutavel;
//   - este modulo NAO calcula sequencia, NAO deriva ano e NAO consulta lista
//     de OPs irmas;
//   - OP AVULSA (sem Pedido) exibe `OP {numero}/{ano}` como identidade
//     legitima, porque nenhuma identidade derivada de Pedido existe;
//   - OP/OC vinculada a Pedido SEM identidade persistida => estado
//     diagnostico explicito, NUNCA o numero interno nem a chave primaria.
//
// HISTORICO DESTE ARQUIVO
//   Os blocos que provavam o calculo POSICIONAL (sequencia pelo indice na
//   lista de irmas, ano derivado de `pedido.criado_em`, fallback silencioso
//   ao legado) foram REMOVIDOS porque provavam o comportamento defeituoso:
//   removida uma OP irma, a seguinte HERDAVA o codigo dela. A prova
//   comportamental da estabilidade esta em
//   tests/op-canonical-identity-invariant.mjs (Partes C e D).
//
// Puro/estatico: nao executa o app nem acessa Supabase.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(ROOT, 'js', 'op-display.js');
const INDEX = path.join(ROOT, 'index.html');

function loadApi() {
  const src = fs.readFileSync(HELPER, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'js/op-display.js' });
  return sandbox.window.RAVATEX_OP_DISPLAY;
}

const INTERNO_LABEL = 'º interno';

// ---------------------------------------------------------------------
// 1. Existencia / API
// ---------------------------------------------------------------------

test('op-display: arquivo existe e sintaxe valida', () => {
  assert.ok(fs.existsSync(HELPER), 'js/op-display.js ausente');
  require('node:child_process').execFileSync(process.execPath, ['--check', HELPER], { stdio: 'pipe' });
});

test('op-display: expoe a API de identidade canonica', () => {
  const api = loadApi();
  assert.ok(api, 'window.RAVATEX_OP_DISPLAY ausente');
  for (const fn of ['getOpTypeLetter', 'getCanonicalIdentity', 'isPedidoLinked',
    'isIdentityPending', 'formatOpOperationalCode', 'formatOpInternalLabel',
    'formatOpLegacyCode', 'formatOcOperationalCode', 'formatOcLegacyLabel']) {
    assert.equal(typeof api[fn], 'function', 'funcao ausente: ' + fn);
  }
});

test('op-display: as funcoes de calculo posicional NAO existem mais', () => {
  const api = loadApi();
  for (const fn of ['buildOpOperationalSequence', 'getPedidoOperationalYear']) {
    assert.equal(api[fn], undefined,
      fn + ' derivava a identidade em tempo de render e nao pode voltar');
  }
});

test('index.html: carrega js/op-display.js antes dos consumidores', () => {
  const index = fs.readFileSync(INDEX, 'utf8');
  assert.match(index, /<script src="js\/op-display\.js/, 'index.html deve carregar js/op-display.js');
  const posDisplay = index.indexOf('js/op-display.js');
  // Os consumidores nao tem mais fallback proprio: a ordem de carga passou a
  // ser um requisito real, nao uma conveniencia.
  for (const consumer of ['js/screens/pedido-chain-state.js', 'js/screens/pedido-detail-progress.js',
    'js/screens/painel.js', 'js/screens/ops-list.js']) {
    const pos = index.indexOf(consumer);
    assert.ok(pos > -1, 'consumidor ausente do index.html: ' + consumer);
    assert.ok(posDisplay < pos, 'op-display.js deve carregar ANTES de ' + consumer);
  }
});

// ---------------------------------------------------------------------
// 2. Letra do tipo (espelha public.op_tipo_letra de db/95)
// ---------------------------------------------------------------------

test('op-display: tecelagem -> T, latex/acabamento -> A, desconhecido -> null', () => {
  const api = loadApi();
  assert.equal(api.getOpTypeLetter({ tipo: 'tecelagem' }), 'T');
  assert.equal(api.getOpTypeLetter({ tipo: 'latex' }), 'A');
  assert.equal(api.getOpTypeLetter({ tipo: 'acabamento' }), 'A');
  assert.equal(api.getOpTypeLetter({ tipo: 'TECELAGEM' }), 'T', 'deve normalizar caixa');
  assert.equal(api.getOpTypeLetter({ tipo: 'expedicao' }), null);
  assert.equal(api.getOpTypeLetter({}), null);
  assert.equal(api.getOpTypeLetter(null), null);
});

// ---------------------------------------------------------------------
// 3. A identidade e LIDA, nunca montada
// ---------------------------------------------------------------------

test('IDENTIDADE: devolve exatamente o valor persistido pelo banco', () => {
  const api = loadApi();
  const op = { id: 1, numero: 42, ano: 2026, tipo: 'tecelagem',
    identidade_operacional: 'OP-T005-1-26', identidade_pedido_id: 'p1' };
  assert.equal(api.formatOpOperationalCode(op), 'OP-T005-1-26');
  // O numero interno NAO influencia a identidade.
  assert.equal(api.formatOpOperationalCode(Object.assign({}, op, { numero: 999, ano: 1999 })),
    'OP-T005-1-26');
});

test('IDENTIDADE: contexto de Pedido nao altera o codigo persistido', () => {
  const api = loadApi();
  const op = { id: 1, numero: 42, ano: 2026, tipo: 'tecelagem',
    identidade_operacional: 'OP-T005-1-26', identidade_pedido_id: 'p1' };
  // Qualquer contexto produz o MESMO resultado. Era exatamente aqui que o
  // modelo antigo divergia de tela para tela.
  assert.equal(api.formatOpOperationalCode(op, {}), 'OP-T005-1-26');
  assert.equal(api.formatOpOperationalCode(op, { pedido: { id: 'outro', numero: 99 } }), 'OP-T005-1-26');
  assert.equal(api.formatOpOperationalCode(op, { ops: [] }), 'OP-T005-1-26');
});

test('IDENTIDADE: remover uma OP irma nao muda a identidade das demais', () => {
  const api = loadApi();
  // Regressao do defeito auditado em nivel de helper: a identidade nao e
  // funcao do conjunto de irmas, portanto o conjunto pode mudar a vontade.
  const t2 = { id: 502, identidade_operacional: 'OP-T005-2-26', identidade_pedido_id: 'p1' };
  const antes = api.formatOpOperationalCode(t2, { ops: [{ id: 501 }, t2] });
  const depois = api.formatOpOperationalCode(t2, { ops: [t2] });
  assert.equal(antes, 'OP-T005-2-26');
  assert.equal(depois, 'OP-T005-2-26');
  assert.equal(antes, depois, 'a identidade nao pode depender das irmas vivas');
});

// ---------------------------------------------------------------------
// 4. Os tres estados, nenhum silencioso
// ---------------------------------------------------------------------

test('ESTADO 2 — OP AVULSA exibe numero/ano como identidade legitima', () => {
  const api = loadApi();
  const avulsa = { id: 9, numero: 42, ano: 2026, tipo: 'tecelagem' };
  assert.equal(api.formatOpOperationalCode(avulsa), 'OP 42/2026');
  assert.equal(api.isPedidoLinked(avulsa), false);
  assert.equal(api.isIdentityPending(avulsa), false,
    'avulsa nao esta pendente: ela TEM identidade');
});

test('ESTADO 3 — OP vinculada sem identidade persistida FALHA FECHADA', () => {
  const api = loadApi();
  // Cada forma de evidencia de vinculo, isolada.
  const casos = [
    ['identidade_pedido_id', { numero: 42, ano: 2026, identidade_pedido_id: 'p1' }],
    ['pedido_id', { numero: 42, ano: 2026, pedido_id: 'p1' }],
    ['lote.pedido_id', { numero: 42, ano: 2026, lote: { pedido_id: 'p1' } }],
    ['lotes.pedido_id', { numero: 42, ano: 2026, lotes: { pedido_id: 'p1' } }],
  ];
  for (const [nome, op] of casos) {
    const label = api.formatOpOperationalCode(op);
    assert.equal(label, 'OP (identidade pendente)', nome + ': NUNCA cai no numero interno');
    assert.ok(!label.includes('42'),
      nome + ': o numero interno nao pode aparecer no estado diagnostico');
    assert.equal(api.isIdentityPending(op), true);
    assert.equal(api.isPedidoLinked(op), true);
  }
  // Vinculo reconhecido apenas pelo contexto da tela.
  const semEvidenciaNaLinha = { numero: 42, ano: 2026 };
  assert.equal(api.formatOpOperationalCode(semEvidenciaNaLinha, { pedidoId: 'p1' }),
    'OP (identidade pendente)');
  assert.equal(api.formatOpOperationalCode(semEvidenciaNaLinha, { pedido: { id: 'p1' } }),
    'OP (identidade pendente)');
});

test('identidade vazia ou nao-string conta como ausente', () => {
  const api = loadApi();
  for (const bad of ['', '   ', null, undefined, 42, {}]) {
    assert.equal(api.getCanonicalIdentity({ identidade_operacional: bad }), null,
      'valor invalido deve contar como ausente: ' + JSON.stringify(bad));
  }
  assert.equal(api.getCanonicalIdentity({ identidade_operacional: '  OP-T005-1-26  ' }),
    'OP-T005-1-26', 'deve aparar espaco sem alterar o valor canonico');
});

// ---------------------------------------------------------------------
// 5. Numero interno — unico formatador autorizado, sempre rotulado
// ---------------------------------------------------------------------

test('formatOpInternalLabel: SEMPRE rotula e nunca parece identidade', () => {
  const api = loadApi();
  const label = api.formatOpInternalLabel({ numero: 42, ano: 2026 });
  assert.ok(label.includes(INTERNO_LABEL), 'deve conter o rotulo explicito');
  assert.ok(label.includes('42/2026'), 'deve conter o numero interno');
  assert.ok(!label.startsWith('OP'),
    'o rotulo interno NUNCA comeca com "OP": seria um segundo nome da OP');
  assert.ok(api.formatOpInternalLabel({ numero: 42 }).includes('42'));
});

test('formatOpLegacyCode: tolerante a campos ausentes', () => {
  const api = loadApi();
  assert.equal(api.formatOpLegacyCode({ numero: 42, ano: 2026 }), 'OP 42/2026');
  assert.equal(api.formatOpLegacyCode({ numero: 42 }), 'OP 42');
  assert.equal(api.formatOpLegacyCode({}), 'OP -');
  assert.equal(api.formatOpLegacyCode(null), 'OP -');
});

// ---------------------------------------------------------------------
// 6. Ordem de Compra — identidade casada com o Pedido
// ---------------------------------------------------------------------

test('OC: devolve a identidade persistida', () => {
  const api = loadApi();
  assert.equal(api.formatOcOperationalCode({ id: 48, identidade_operacional: 'OC-005-1-26' }),
    'OC-005-1-26');
});

test('OC: vinculada ao Pedido sem identidade FALHA FECHADA', () => {
  const api = loadApi();
  const oc = { id: 48, pedido_id: 'p1' };
  const label = api.formatOcOperationalCode(oc);
  assert.equal(label, 'OC (identidade pendente)');
  assert.ok(!label.includes('48'), 'a chave primaria NUNCA pode aparecer como nome');
});

test('OC: legada sem Pedido se declara legada, nao expoe a chave crua como nome', () => {
  const api = loadApi();
  const label = api.formatOcOperationalCode({ id: 48 });
  assert.equal(label, 'OC legada #48');
  assert.ok(/legada/.test(label),
    'uma OC sem Pedido deve se declarar legada em vez de usar o id como nome de negocio');
});

// ---------------------------------------------------------------------
// 7. Estrutura do modulo
// ---------------------------------------------------------------------

test('op-display: puro — sem DOM, sem Supabase, sem formato inventado', () => {
  const src = fs.readFileSync(HELPER, 'utf8');
  assert.ok(!/document\.|window\.supa|fetch\(/.test(src),
    'o helper deve permanecer puro: sem DOM, sem Supabase, sem rede');
  assert.ok(!/P\d+-T\d+-L\d+/.test(src), 'nenhum formato inventado');
  // A identidade e lida, nao montada: nenhum padding de sequencia sobrou.
  assert.ok(!/padStart|function pad2/.test(src),
    'nenhum padding de sequencia: a formatacao vive na coluna gerada do banco');
  assert.ok(/identidade_operacional/.test(src),
    'o dono central deve ler a coluna canonica');
});
