// tests/op-canonical-identity-schema.smoke.js
//
// OP-CANONICAL-IDENTITY-REFOUNDATION-R1 — guards ESTATICOS da identidade
// canonica de OP e de Ordem de Compra.
//
// Estes guards nao substituem a prova comportamental
// (tests/op-canonical-identity-invariant.mjs, cluster descartavel). Eles
// impedem a REGRESSAO das construcoes que criaram o defeito auditado, e cada
// um existe porque a construcao correspondente foi encontrada no codigo real:
//
//   1. concatenacao de `op.numero`/`op.ano` em superficie de produto — era a
//      fonte de `OP de origem: OP 42/2026` ao lado de `OPs relacionadas:
//      OP 1/2026-T01`, dois nomes para a MESMA OP na MESMA tela;
//   2. `'OP ' + opId` — a chave primaria crua como nome de negocio, uma
//      TERCEIRA identidade (`OP 137`) nas telas de recebimento;
//   3. sequencia POSICIONAL (indice em lista de irmas) — era reciclavel:
//      removida uma irma, a seguinte herdava o codigo dela;
//   4. fallback silencioso para o numero interno quando faltava contexto;
//   5. campo editavel de numero interno na criacao/edicao de OP;
//   6. as garantias de banco de db/95.
//
// Run: node --test tests/op-canonical-identity-schema.smoke.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIGRATION = 'db/95_op_canonical_identity_refoundation.sql';

// O dono central da formatacao. E o UNICO arquivo autorizado a conter a
// construcao do numero interno, porque e onde ela e deliberadamente definida.
const OWNER = 'js/op-display.js';

// Todo arquivo de produto sob js/. Testes, docs e o proprio dono ficam fora.
function productFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.js')) out.push(rel);
    }
  })('js');
  return out.filter((f) => f !== OWNER);
}

// ---------------------------------------------------------------------------
test('guard 1 — nenhuma superficie de produto concatena op.numero com op.ano', () => {
  // Padroes reais encontrados na auditoria, em template string e em concat:
  //   `OP ${op.numero}/${op.ano}`      `'OP ' + op.numero + '/' + op.ano`
  //   `Lote Nº ${opRef.numero}/${opRef.ano}`
  const PATTERNS = [
    /\$\{[A-Za-z_$][\w$]*\.numero\}\s*\/\s*\$\{[A-Za-z_$][\w$]*\.ano\}/,
    /\.numero\s*\+\s*['"`]\s*\/\s*['"`]\s*\+\s*[A-Za-z_$][\w$]*\.ano/,
    /\.numero\s*\+\s*['"`]\/['"`]\s*\+\s*[A-Za-z_$][\w$]*\.ano/,
  ];
  const offenders = [];
  for (const file of productFiles()) {
    const text = read(file);
    text.split('\n').forEach((line, i) => {
      // Linhas de comentario documentam o defeito antigo de proposito.
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*')) return;
      if (PATTERNS.some((re) => re.test(line))) offenders.push(`${file}:${i + 1}: ${code}`);
    });
  }
  assert.deepStrictEqual(offenders, [],
    `numero/ano concatenados fora de ${OWNER}:\n${offenders.join('\n')}`);
});

test('guard 2 — nenhuma superficie usa a chave primaria como nome de OP/OC', () => {
  // `'OP ' + opId`, `'OP ' + op.id`, `'OC #' + ordem.id` em posicao de rotulo.
  //
  // FORWARD CORRECTION (cutover de producao): os dois primeiros padroes exigem
  // o prefixo literal "OP"/"OC" e por isso NAO viam a forma NUA — `'#' + opId`
  // sozinho, que o portal do fornecedor usava nas suas DUAS telas de historico
  // quando a linha da OP nao estava no conjunto carregado. Visualmente `#137` e
  // indistinguivel de um numero de negocio, entao e a mesma classe de defeito
  // e nao uma variante benigna.
  //
  // O padrao e ancorado no NOME do identificador de OP/OC de proposito: `'#' +
  // pedido.numero` e `'#' + it.modelo_id` sao outros dominios, legitimos, e um
  // banimento cego de `'#' + x` os quebraria sem provar nada sobre identidade
  // de OP.
  const PATTERNS = [
    /['"`]OP\s+['"`]\s*\+\s*[A-Za-z_$][\w$]*(\.id)?\b/,
    /['"`]OP\s*#?\s*\$\{[A-Za-z_$][\w$]*(\.id)?\}/,
    /['"`]#['"`]\s*\+\s*(opId|op_id|ocId|oc_id)\b/,
    /['"`]#['"`]\s*\+\s*[A-Za-z_$][\w$]*\.(op_id|oc_id)\b/,
    /['"`]#['"`]\s*\+\s*(op|oc|ordem|opRef)\.id\b/,
    /#\$\{\s*(opId|op_id|ocId|oc_id)\s*\}/,
    /#\$\{\s*(op|oc|ordem|opRef)\.id\s*\}/,
  ];
  const offenders = [];
  for (const file of productFiles()) {
    read(file).split('\n').forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*')) return;
      if (PATTERNS.some((re) => re.test(line))) offenders.push(`${file}:${i + 1}: ${code}`);
    });
  }
  assert.deepStrictEqual(offenders, [],
    `chave primaria usada como nome de OP:\n${offenders.join('\n')}`);
});

test('guard 3 — a sequencia posicional foi removida do dono central', () => {
  const owner = read(OWNER);
  // A construcao removida: montar a sequencia por posicao entre irmas.
  assert.ok(!/buildOpOperationalSequence/.test(owner),
    'buildOpOperationalSequence (sequencia por posicao) nao pode voltar');
  assert.ok(!/siblingOps/.test(owner),
    'a identidade nao pode depender de lista de OPs irmas');
  assert.ok(!/getPedidoOperationalYear/.test(owner),
    'o ano nao e mais derivado em tempo de render; ele vem congelado do banco');
  // E a identidade e LIDA, nao montada.
  assert.ok(/identidade_operacional/.test(owner),
    'o dono central deve ler ops.identidade_operacional');
});

test('guard 4 — nenhum fallback silencioso para o numero interno', () => {
  const owner = read(OWNER);
  // `formatOpOperationalCode` deve ter o estado diagnostico explicito.
  assert.ok(/IDENTITY_PENDING/.test(owner),
    'o estado diagnostico explicito deve existir');
  assert.ok(/identidade pendente/.test(owner),
    'o texto do estado diagnostico deve ser visivel ao usuario');
  // Nenhum consumidor pode montar a identidade por conta propria.
  //
  // O guard 2 ja cobre a CONSTRUCAO (`'OP ' + valor`) em qualquer posicao.
  // Aqui verificamos a consequencia estrutural: `formatOpLegacyCode` e a
  // identidade da OP AVULSA e so o dono da tela de OP avulsa pode invoca-la.
  // Qualquer outro consumidor chamando-a estaria escolhendo o numero interno
  // como nome de uma OP que pode ser vinculada a Pedido — o fallback
  // silencioso que esta ordem eliminou.
  //
  // Frases que apenas COMECAM com "OP" nao sao identidade e nao entram aqui:
  // mensagens de erro (`'OP incompativel com o Pedido...'`), rotulos de etapa
  // (`'OP de acabamento'`) e os estados diagnosticos (`'OP (identidade
  // pendente)'`, `'OP --'`) sao texto, nao nome de entidade.
  const AVULSA_OWNERS = new Set(['js/screens/op-latex-admin.js']);
  const offenders = [];
  for (const file of productFiles()) {
    if (AVULSA_OWNERS.has(file)) continue;
    if (/formatOpLegacyCode/.test(read(file))) offenders.push(file);
  }
  assert.deepStrictEqual(offenders, [],
    `formatOpLegacyCode e a identidade da OP AVULSA; so o dono pode usa-la:\n${offenders.join('\n')}`);
});

test('guard 5 — a criacao de OP nao expoe campo editavel de numero interno', () => {
  const nova = read('js/screens/op-nova.js');
  assert.ok(!/fieldBlock\('Número',/.test(nova),
    'o campo editavel Numero foi removido da criacao de OP');
  assert.ok(!/fieldBlock\('Ano',/.test(nova),
    'o campo editavel Ano foi removido da criacao de OP');
  assert.ok(!/numInput/.test(nova), 'nenhum input de numero interno pode existir');
  assert.ok(!/anoInput/.test(nova), 'nenhum input de ano pode existir');

  const persistir = read('js/screens/op-persistir.js');
  // O UPDATE de edicao nao pode reescrever numero/ano.
  assert.ok(!/update\(\{\s*numero:/.test(persistir),
    'a edicao de OP nao pode reescrever ops.numero');
  assert.ok(!/\bnumero,\s*$/m.test(persistir.split('async function persistirOP')[1] || ''),
    'persistirOP nao pode aceitar um parametro `numero` que ela ignora');
});

test('guard 6 — db/95 carrega as garantias de banco da identidade', () => {
  const sql = read(MIGRATION);

  // Persistencia e unicidade.
  assert.ok(/ADD COLUMN identidade_operacional TEXT\s+GENERATED ALWAYS AS/.test(sql),
    'a identidade deve ser coluna GERADA e ARMAZENADA, sem caminho de escrita');
  assert.ok(/CREATE UNIQUE INDEX IF NOT EXISTS ops_identidade_operacional_uidx/.test(sql),
    'a unicidade da identidade de OP deve ser garantida pelo banco');
  assert.ok(/CREATE UNIQUE INDEX IF NOT EXISTS ordem_compra_identidade_operacional_uidx/.test(sql),
    'a unicidade da identidade de OC deve ser garantida pelo banco');

  // Formato ratificado: OP-T005-1-26 e OC-005-1-26.
  assert.ok(/'OP-'\s*\|\|\s*identidade_tipo_letra/.test(sql), 'o formato da OP deve ser OP-{letra}...');
  assert.ok(/'OC-'\s*\|\|\s*lpad\(identidade_pedido_numero/.test(sql), 'o formato da OC deve ser OC-{pedido}...');
  assert.ok(/lpad\(identidade_pedido_numero::TEXT,\s*3,\s*'0'\)/.test(sql),
    'o numero do Pedido deve ter 3 digitos com zero a esquerda');
  assert.ok(/lpad\(\(identidade_pedido_ano % 100\)::TEXT,\s*2,\s*'0'\)/.test(sql),
    'o ano deve ter 2 digitos');

  // Reserva atomica e escopos INDEPENDENTES (T, A, OC).
  assert.ok(/ON CONFLICT \(pedido_id, escopo\) DO UPDATE/.test(sql),
    'a reserva deve ser um UPSERT por (pedido, escopo), nunca um contador global');
  assert.ok(/escopo\s+TEXT\s+NOT NULL CHECK \(escopo IN \('T', 'A', 'OC'\)\)/.test(sql),
    'os tres escopos de sequencia devem ser independentes');
  assert.ok(/PRIMARY KEY \(pedido_id, escopo\)/.test(sql),
    'uma LINHA de contador por (pedido, escopo) — o que os torna independentes');
  assert.ok(/ultimo_seq = n\.ultimo_seq \+ 1/.test(sql),
    'a sequencia deve ser monotonica e nunca reaproveitada');

  // Atribuicao exatamente uma vez, cobrindo os dois caminhos reais.
  assert.ok(/BEFORE INSERT OR UPDATE OF lote_id ON public\.ops/.test(sql),
    'a OP deve receber identidade no INSERT com lote e no UPDATE que vincula o lote');
  assert.ok(/BEFORE INSERT OR UPDATE OF pedido_id ON public\.ordem_compra/.test(sql),
    'a OC deve receber identidade no vinculo com o Pedido');
  assert.ok(/IF NEW\.identidade_seq IS NOT NULL THEN\s*\n\s*RETURN NEW;/.test(sql),
    'a atribuicao deve ser idempotente: identidade existente nunca e recalculada');

  // Imutabilidade executavel, incluindo o numero interno.
  assert.ok(/Identidade canonica da OP e imutavel apos a atribuicao/.test(sql),
    'a imutabilidade da identidade de OP deve ser aplicada por trigger');
  assert.ok(/Numero interno da OP e imutavel apos a criacao/.test(sql),
    'ops.numero/ano nao pode ser reescrito arbitrariamente');
  assert.ok(/Identidade canonica da Ordem de Compra e imutavel/.test(sql),
    'a imutabilidade da identidade de OC deve ser aplicada por trigger');

  // Backfill deterministico + invariante que falha fechado.
  assert.ok(/ORDER BY o\.criado_em ASC, o\.id ASC/.test(sql),
    'o backfill deve ser deterministico');
  assert.ok(/db\/95 post-invariant falhou/.test(sql),
    'a migracao deve falhar fechada se os invariantes nao valerem');
  assert.ok(/LIMITE DE RECONSTRUCAO HISTORICA/.test(sql),
    'a migracao deve registrar explicitamente que OP removida nao e reconstruivel');

  // op_numeros preservado: a ordem proibe reset.
  assert.ok(!/DELETE FROM public\.op_numeros|UPDATE public\.op_numeros|ALTER SEQUENCE/.test(sql),
    'db/95 nao pode resetar nem reescrever a numeracao interna legada');
});

test('guard 7 — toda consulta de OP projeta a identidade canonica', () => {
  // Uma tela que busca `numero, ano` sem projetar `identidade_operacional`
  // renderizaria o estado diagnostico para todas as suas OPs.
  const offenders = [];
  for (const file of productFiles()) {
    read(file).split('\n').forEach((line, i) => {
      if (!/\.select\(|opsSelect\s*=/.test(line)) return;
      if (!/numero,\s*ano|numero,ano/.test(line)) return;
      if (/identidade_operacional/.test(line)) return;
      offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 110)}`);
    });
  }
  assert.deepStrictEqual(offenders, [],
    `consulta de OP sem identidade_operacional:\n${offenders.join('\n')}`);
});
