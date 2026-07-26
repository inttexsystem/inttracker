// =====================================================================
// === tests/pedido-batch02-surfaces.smoke.js ==========================
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1 — static/structural
// proofs for the Pedido surfaces OTHER than #/pedidos/novo, whose runtime
// behaviour is already covered by tests/pedido-form.smoke.js.
//
// Proves, per the order's "OTHER PEDIDO SURFACES" section:
//   - saved-item editing follows Tipo -> Modelo and filters by tipo_produto;
//   - client creation follows Tipo -> Modelo and carries data_pedido;
//   - client creation does NOT expose the internal Pedido number;
//   - header editing loads/saves data_pedido but can never change numero;
//   - the Pedido detail read model selects data_pedido;
//   - db/89 owns the column, the positivity check, the immutability guard
//     and the sequence synchronizer, and never touches db/01..db/88.
//
// Does not execute the app and does not touch Supabase.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => {
  const full = path.join(ROOT, ...p);
  assert.ok(fs.existsSync(full), 'arquivo não encontrado: ' + full);
  return fs.readFileSync(full, 'utf8');
};

const itensEdit = read('js', 'screens', 'pedido-itens-edit.js');
const clienteForm = read('js', 'screens', 'cliente-pedido-form.js');
const pedidoEdit = read('js', 'screens', 'pedido-edit.js');
const detailData = read('js', 'screens', 'pedido-detail-data.js');
const rowEditor = read('js', 'screens', 'pedido-item-row-editor.js');
const db89 = read('db', '89_pedido_commercial_date_and_number_control.sql');
const index = read('index.html');

// ---------------------------------------------------------------------
// 1. Saved Pedido item editing — Tipo before Modelo.
// ---------------------------------------------------------------------

test('itens-edit: Tipo é construído ANTES do Modelo e filtra por tipo_produto', () => {
  const iTipo = itensEdit.indexOf("data-item-tipo-select");
  const iModelo = itensEdit.indexOf("data-item-modelo-select");
  assert.ok(iTipo > 0, 'select de Tipo ausente na edição de item salvo');
  assert.ok(iModelo > 0, 'select de Modelo ausente');
  assert.ok(iTipo < iModelo, 'Tipo deve ser construído antes de Modelo');
  assert.match(itensEdit, /rowApi\.modelosPorTipo\(\s*state\.modelos\s*,\s*item\.tipo\s*\)/,
    'a lista de modelos deve ser o recorte estrito da rota escolhida');
  assert.match(itensEdit, /rowApi\.rotaDoModelo\(/,
    'a rota deve vir do derivador único, nunca de heurística local');
});

test('itens-edit: o Tipo corrente é DERIVADO do modelo_id autoritativo do item', () => {
  assert.match(itensEdit, /const modeloAtual = modeloById\(item\.modeloId\);\s*\n\s*if \(modeloAtual\) item\.tipo = rowApi\.rotaDoModelo\(modeloAtual\);/,
    'o Tipo exibido deve ser derivado do modelo salvo, não guardado à parte');
});

test('itens-edit: trocar o Tipo limpa o modelo incompatível', () => {
  assert.match(itensEdit, /if \(!item\.tipo \|\| \(atual && rowApi\.rotaDoModelo\(atual\) !== item\.tipo\)\) item\.modeloId = '';/);
});

test('itens-edit: Modelo permanece desabilitado sem Tipo ou sem metadado', () => {
  assert.match(itensEdit, /if \(item\.tipo && state\.tipoMetadataOk\) modeloSel\.removeAttribute\('disabled'\);/);
  assert.match(itensEdit, /else modeloSel\.setAttribute\('disabled', 'disabled'\);/);
});

test('itens-edit: tipo_produto FALHA FECHADA (sem degradar para Tapete)', () => {
  assert.match(itensEdit, /FALHA FECHADA/);
  assert.doesNotMatch(itensEdit, /catch \(e\) \{ \/\* coluna ausente: tratado como Tapete \*\/ \}/,
    'a degradação silenciosa para Tapete precisa ter sido removida');
});

test('itens-edit: só modelo_id é persistido — nenhum tipo redundante', () => {
  // `tipo_produto:` aparece legitimamente na chamada de rótulo de exibição
  // (formatProductLabel). A proibição real é sobre PAYLOAD de escrita: nenhum
  // insert/update de pedido_itens pode carregar o tipo de forma redundante.
  const payloads = itensEdit.match(/\.(?:insert|update|upsert)\([\s\S]{0,600}?\)/g) || [];
  assert.ok(payloads.length > 0, 'nenhuma escrita encontrada para inspecionar');
  for (const payload of payloads) {
    assert.doesNotMatch(payload, /tipo_produto/, 'payload nao pode carregar tipo_produto');
    assert.doesNotMatch(payload, /tipo\s*:/, 'payload nao pode carregar um campo tipo');
  }
  assert.match(itensEdit, /item\.modeloId = modeloSel\.value;/);
});

// ---------------------------------------------------------------------
// 2. Client-facing creation.
// ---------------------------------------------------------------------

test('cliente-form: Tipo é construído ANTES do Modelo e filtra por tipo_produto', () => {
  const iTipo = clienteForm.indexOf("data-item-modal-tipo");
  const iModelo = clienteForm.indexOf("data-item-modal-modelo");
  assert.ok(iTipo > 0 && iModelo > 0, 'selects de Tipo/Modelo ausentes no formulário do cliente');
  assert.ok(iTipo < iModelo, 'Tipo deve vir antes de Modelo');
  assert.match(clienteForm, /rowApi\.modelosPorTipo\(modelos, draft\.tipo\)/);
  assert.match(clienteForm, /tipoField, modeloField/,
    'no corpo do modal, o campo Tipo deve preceder o campo Modelo');
});

test('cliente-form: trocar o Tipo limpa o modelo incompatível e os derivados', () => {
  assert.match(clienteForm, /if \(!draft\.tipo \|\| \(atual && rowApi\.rotaDoModelo\(atual\) !== draft\.tipo\)\) draft\.modeloId = '';/);
  assert.match(clienteForm, /refreshDerivados\(\);/);
});

test('cliente-form: confirmar sem Tipo é rejeitado', () => {
  assert.match(clienteForm, /if \(!draft\.tipo\) \{[\s\S]{0,140}?Selecione o tipo do produto/);
});

test('cliente-form: data_pedido é enviada e aparece ANTES de Prazo desejado', () => {
  assert.match(clienteForm, /pedidoPayload\.data_pedido = state\.dataPedido;/);
  const iData = clienteForm.indexOf("'Data do pedido'");
  const iPrazo = clienteForm.indexOf("'Prazo desejado'");
  assert.ok(iData > 0 && iPrazo > 0, 'rótulos de data/prazo ausentes');
  assert.ok(iData < iPrazo, 'Data do pedido deve vir antes de Prazo desejado');
});

test('cliente-form: NUNCA expõe o número interno do Pedido', () => {
  assert.doesNotMatch(clienteForm, /Número do pedido/i,
    'o formulário do cliente não pode expor seleção de número interno');
  assert.doesNotMatch(clienteForm, /pedidoPayload\.numero/,
    'o insert do cliente deve manter a alocação automática');
  assert.doesNotMatch(clienteForm, /data-pedido-numero/);
});

test('cliente-form: tipo_produto FALHA FECHADA', () => {
  assert.match(clienteForm, /FALHA FECHADA/);
  assert.match(clienteForm, /loadingError = 'tipo de produto dos modelos';/);
});

// ---------------------------------------------------------------------
// 3. Pedido header editing.
// ---------------------------------------------------------------------

test('pedido-edit: carrega e salva data_pedido', () => {
  assert.match(pedidoEdit, /\.select\('id, numero, data_pedido, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em'\)/);
  assert.match(pedidoEdit, /state\.dataPedido = pedidoRes\.data\.data_pedido \|\| '';/);
  assert.match(pedidoEdit, /data_pedido: state\.dataPedido,/);
  assert.match(pedidoEdit, /Informe a data do pedido\./, 'data_pedido é obrigatória na edição');
});

test('pedido-edit: numero é contexto SOMENTE-LEITURA e nunca entra no payload', () => {
  assert.match(pedidoEdit, /data-pedido-numero-readonly/);
  assert.match(pedidoEdit, /numeroInput\.setAttribute\('readonly', 'readonly'\)/);
  assert.match(pedidoEdit, /numeroInput\.disabled = true;/);
  // O payload de update tem exatamente cliente_id, data_pedido, prazo_entrega e observacao.
  const payload = (pedidoEdit.match(/const payload = \{[\s\S]*?\n      \};/) || [''])[0];
  assert.ok(payload, 'bloco de payload não encontrado');
  assert.doesNotMatch(payload, /numero/, 'numero jamais pode entrar no payload de update');
  assert.doesNotMatch(pedidoEdit, /payload\.numero/);
});

test('pedido-edit: campo de data aparece antes do prazo', () => {
  const iData = pedidoEdit.indexOf("label: 'Data do pedido'");
  const iPrazo = pedidoEdit.indexOf("label: 'Prazo de entrega'");
  assert.ok(iData > 0 && iPrazo > 0);
  assert.ok(iData < iPrazo, 'Data do pedido deve vir antes do Prazo de entrega');
});

// ---------------------------------------------------------------------
// 4. Read model.
// ---------------------------------------------------------------------

test('pedido-detail-data: o read model seleciona data_pedido e numero', () => {
  const sel = (detailData.match(/\.select\('id, numero[^']*'\)/) || [''])[0];
  assert.ok(sel, 'select explícito do pedido não encontrado');
  assert.match(sel, /\bnumero\b/);
  assert.match(sel, /\bdata_pedido\b/);
  assert.match(sel, /prazo_desejado/, 'o campo canônico de prazo permanece no read model');
});

test('nenhuma superfície deriva a data comercial de criado_em', () => {
  // Selecionar as duas colunas na MESMA linha é correto e necessário — o read
  // model precisa das duas. O que é proibido é ATRIBUIR data_pedido a partir
  // de criado_em em código de aplicação.
  for (const [name, src] of Object.entries({ detailData, pedidoEdit, clienteForm })) {
    const codeOnly = src.split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .filter((l) => !/\.select\(/.test(l))
      .join('\n');
    assert.doesNotMatch(codeOnly, /data_pedido\s*[:=][^;\n]*criado_em/,
      name + ' não pode derivar data_pedido de criado_em');
    assert.doesNotMatch(codeOnly, /dataPedido\s*=[^;\n]*criado_em/,
      name + ' não pode derivar o estado de data do pedido de criado_em');
  }
});

// ---------------------------------------------------------------------
// 5. db/89.
// ---------------------------------------------------------------------

test('db/89: adiciona data_pedido na sequência exigida', () => {
  const iAdd = db89.indexOf('ADD COLUMN IF NOT EXISTS data_pedido DATE');
  const iBackfill = db89.indexOf("SET data_pedido = (criado_em AT TIME ZONE 'America/Sao_Paulo')::date");
  const iDefault = db89.indexOf("SET DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date");
  const iNotNull = db89.indexOf('ALTER COLUMN data_pedido SET NOT NULL');
  assert.ok(iAdd > 0 && iBackfill > iAdd && iDefault > iBackfill && iNotNull > iDefault,
    'ordem exigida: coluna nullable -> backfill -> default -> NOT NULL');
  assert.match(db89, /WHERE data_pedido IS NULL;/,
    'o backfill só pode tocar linhas ainda nulas (replay não reescreve correção do operador)');
});

test('db/89: positividade, imutabilidade e sincronização de sequência', () => {
  assert.match(db89, /ADD CONSTRAINT pedidos_numero_positivo_chk CHECK \(numero > 0\)/);
  assert.match(db89, /CREATE OR REPLACE FUNCTION public\.pedidos_numero_immutability_guard_fn\(\)/);
  assert.match(db89, /CREATE TRIGGER pedidos_numero_immutability_guard/);
  assert.match(db89, /WHEN \(NEW\.numero IS DISTINCT FROM OLD\.numero\)/,
    'update de mesmo valor não pode nem disparar o guard');
  assert.match(db89, /CREATE OR REPLACE FUNCTION public\.pedidos_numero_sequence_sync_fn\(\)/);
  assert.match(db89, /pg_advisory_xact_lock/, 'a sincronização precisa ser serializada');
  assert.match(db89, /IF v_last IS NULL OR NEW\.numero > v_last THEN/,
    'a sequência só pode avançar, nunca retroceder');
});

test('db/89: é forward-only e não reescreve db/01..db/88', () => {
  assert.match(db89, /Forward-only; db\/01\.\.db\/88 are untouched/);
  assert.match(db89, /^BEGIN;/m);
  assert.match(db89, /^COMMIT;/m);
  assert.match(db89, /NOTIFY pgrst, 'reload schema';/);
  // Nenhum GRANT novo a PUBLIC/anon.
  assert.doesNotMatch(db89, /GRANT[^\n]*TO PUBLIC/i);
  assert.doesNotMatch(db89, /GRANT[^\n]*TO anon/i);
});

// O sujeito deste guard é db/89: ela existe uma única vez e nada foi inserido
// antes dela. Qual número é o TERMINAL do repositório é fato de
// tests/ordem-compra-c3d-deploy.smoke.js, que avança a cada migração
// autorizada — aqui isso seria um segundo dono do mesmo fato.
test('db/89: existe exatamente uma migração 89 e nada foi inserido antes dela', () => {
  const migs = fs.readdirSync(path.join(ROOT, 'db'))
    .filter((f) => /^\d{2,}_.*\.sql$/.test(f) && !/\.verify\.sql$/.test(f) && f !== 'setup_completo.sql')
    .map((f) => Number(f.match(/^(\d+)_/)[1]))
    .sort((a, b) => a - b);
  assert.equal(migs.filter((n) => n === 89).length, 1, 'só pode existir uma db/89');
  assert.equal(migs.filter((n) => n < 89).length, 88,
    'db/01..db/88 devem permanecer intactas antes de db/89');
});

// ---------------------------------------------------------------------
// 6. Cache invalidation for every changed surface.
// ---------------------------------------------------------------------

test('index.html: toda superfície alterada recebeu o token do lote 2', () => {
  // A2 removeu a segunda fonte de raio (utilitarios Tailwind) de pedido-edit.js e
  // pedido-itens-edit.js, entao cada um passa a ser verificado contra a ordem que
  // o alterou por ultimo. A garantia nao muda: toda superficie alterada continua
  // invalidada, e nenhuma delas pode reter um token anterior ao seu.
  const ULTIMA_ORDEM = {
    'js/screens/pedido-detail-data.js': '20260725-pedido-operational-batch2',
    'js/screens/pedido-edit.js': '20260726-ui-p5-pass2-a2',
    'js/screens/pedido-itens-edit.js': '20260726-ui-p5-pass2-a2',
  };
  for (const [asset, token] of Object.entries(ULTIMA_ORDEM)) {
    const re = new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=' + token);
    assert.match(index, re, asset + ' deve carregar o token da ordem que o alterou por ultimo');
  }
});

// cliente-pedido-form.js foi retokenizado DE NOVO pela passada 1 de cor
// (UI-CONSOLIDATION-PHASE-5-PASS-1). Vale aqui a mesma regra ja documentada
// abaixo para o lote 3: a superfície alterada segue invalidada, sob o token da
// ordem que a alterou por último.
test('index.html: a superfície tocada pela passada 1 de cor carrega o token dela', () => {
  const asset = 'js/screens/cliente-pedido-form.js';
  const re = new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=20260726-ui-p5-pass1');
  assert.match(index, re, asset + ' deve carregar o token da passada 1 de cor');
});

// pedido-form.js e pedido-item-row-editor.js foram retokenizados DE NOVO pelo
// lote 3 (sugestão de número + layout compacto). Reter o token do lote 2 aqui
// serviria um arquivo desatualizado ao browser; a garantia original — toda
// superfície alterada é invalidada — segue integral, apenas sob o token da
// ordem que a alterou por último.
test('index.html: os assets tocados pelo lote 3 carregam o token do lote 3, não o do lote 2', () => {
  // Ancorado em `screens/`: sem isso o padrão também casaria
  // `cliente-pedido-form.js`, que legitimamente conserva o token do lote 2.
  // Ambos foram retokenizados MAIS UMA VEZ pela passada 1 de cor; a garantia
  // ("a superfície alterada é invalidada, sob o token da ordem que a alterou
  // por último") é a mesma, apenas um lote adiante.
  // A passada 2 de raio alterou APENAS pedido-item-row-editor.js, entao os dois
  // deixam de compartilhar um token: cada um e verificado contra a ordem que o
  // alterou por ultimo. A garantia nao muda — nenhum dos dois pode reter o
  // token do lote 2, e nenhum pode ficar num token anterior ao seu.
  const ULTIMA_ORDEM = {
    'screens/pedido-form.js': '20260726-ui-p5-pass1',
    'screens/pedido-item-row-editor.js': '20260726-ui-p5-pass2',
  };
  for (const [asset, token] of Object.entries(ULTIMA_ORDEM)) {
    const esc = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(index, new RegExp(esc + '\\?v=' + token),
      asset + ' deve carregar o token da ordem que o alterou por ultimo');
    assert.doesNotMatch(index, new RegExp(esc + '\\?v=20260725-pedido-operational-batch2'),
      asset + ' não pode reter o token do lote 2');
  }
});

test('o módulo da linha de item respeita o limite normal de code-health', () => {
  const linhas = rowEditor.split('\n').length;
  assert.ok(linhas <= 500, 'novo módulo de UI deve ficar em ≤500 linhas; atual: ' + linhas);
});
