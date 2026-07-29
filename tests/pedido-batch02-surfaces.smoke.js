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
  // A passada 7 (UIC-006) trocou o select nativo pelo popover canonico, cuja
  // propriedade `disabled` e o dono unico do estado. A regra de negocio e
  // identica — sem Tipo, ou sem metadado de tipo, o Modelo fica desabilitado —
  // e agora e afirmada como UMA expressao em vez de um par if/else de
  // atributos, que era apenas a forma antiga de escreve-la.
  assert.match(itensEdit, /modeloSel\.disabled = !\(item\.tipo && state\.tipoMetadataOk\);/);
  // A falha fechada continua: nenhum caminho pode habilitar o Modelo sem os
  // dois pre-requisitos.
  assert.doesNotMatch(itensEdit, /modeloSel\.disabled = false/,
    'o Modelo nao pode ser habilitado incondicionalmente');
  assert.doesNotMatch(itensEdit, /modeloSel\.removeAttribute\('disabled'\)/,
    'o estado desabilitado passou a ser propriedade do controle canonico');
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

// PEDIDO-UNIFIED-ADMIN-EDITOR-R1 substituiu a edição parcial (só dados
// gerais, écran 768px) pelo editor administrativo unificado. Os campos
// gerais (incluindo data_pedido/numero) agora têm um dono compartilhado
// — js/pedido-fields.js — em vez de estado e payload locais a
// pedido-edit.js; as três provas abaixo foram atualizadas para a nova
// arquitetura, preservando exatamente os mesmos invariantes de negócio
// (data_pedido carregada/salva, numero jamais editável ou no payload,
// Data antes de Prazo).
const pedidoFields = read('js', 'pedido-fields.js');

test('pedido-edit: carrega e salva data_pedido (via js/pedido-fields.js)', () => {
  assert.match(pedidoEdit, /data_pedido, status, cliente_id, referencia_cliente, prazo_entrega, tipo_recebimento, observacao/,
    'select do pedido deve incluir data_pedido');
  assert.match(pedidoEdit, /state\.fields = FIELDS\(\)\.fromPersisted\(pedidoRes\.data\);/,
    'estado de campos gerais deve vir do dono compartilhado a partir da linha persistida');
  assert.match(pedidoFields, /dataPedido: p\.data_pedido \|\| '',/,
    'js/pedido-fields.js deve mapear data_pedido para o estado local');
  assert.match(pedidoFields, /if \(!f\.dataPedido\) errors\.push\('Informe a data do pedido\.'\);/,
    'data_pedido continua obrigatória na edição administrativa');
});

test('pedido-edit: numero é contexto SOMENTE-LEITURA e nunca entra no payload (via js/pedido-fields.js)', () => {
  assert.match(pedidoEdit, /numeroControl = window\.createReadonlyFieldValue/,
    'numero deve ser renderizado como campo somente-leitura canônico, não input readonly');
  // O conjunto de campos permitidos no payload de cabeçalho (ADMIN_HEADER_KEYS)
  // nunca inclui numero/status — eles só aparecem em readOnlyFields.
  const headerKeysLine = (pedidoFields.match(/var ADMIN_HEADER_KEYS = \[[^\]]*\];/) || [''])[0];
  assert.ok(headerKeysLine, 'ADMIN_HEADER_KEYS não encontrado em js/pedido-fields.js');
  assert.doesNotMatch(headerKeysLine, /'numero'/, 'numero jamais pode entrar na lista de campos editáveis');
  assert.doesNotMatch(headerKeysLine, /'status'/, 'status jamais pode entrar na lista de campos editáveis');
  assert.match(headerKeysLine, /'cliente_id', 'data_pedido', 'prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao'/,
    'a lista de campos editáveis pelo admin deve espelhar exatamente public.pedido_header_validar');
  assert.match(pedidoFields, /readOnlyFields: \['numero', 'status'\]/,
    'numero e status devem estar declarados como somente-leitura, nunca editáveis');
});

test('pedido-edit: campo de Data do pedido aparece antes do Prazo desejado', () => {
  const iData = pedidoEdit.indexOf("buildFieldLabel('Data do pedido', true)");
  const iPrazo = pedidoEdit.indexOf("buildFieldLabel('Prazo desejado')");
  assert.ok(iData > 0 && iPrazo > 0, 'labels de Data do pedido e Prazo desejado devem existir');
  assert.ok(iData < iPrazo, 'Data do pedido deve vir antes do Prazo desejado');
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
  // A passada 7 (UIC-006) alterou pedido-itens-edit.js — a repopulacao de
  // Modelo passou a usar setOptions() no controle canonico — entao ele e
  // retokenizado mais uma vez. Mesma regra: cada superficie carrega o token da
  // ordem que a alterou por ultimo, e nenhuma retem um token anterior ao seu.
  // SPECIALIZED-CONTROLS-B1 migrou a observacao geral de pedido-edit.js para
  // o primitivo de textarea compartilhado, entao esse asset passa a carregar o
  // token dessa ordem. Mesma regra de sempre.
  // PEDIDO-SCREEN-GROUP-1 consolidou as duas telas de edicao de Pedido — a
  // linguagem de cartao, o alinhamento de campos e rotulos, a contencao local
  // de acao e a separacao da acao destrutiva —, entao os dois assets passam a
  // carregar o token dessa ordem. Mesma regra de sempre: cada superficie
  // carrega o token da ordem que a alterou por ultimo, e nenhuma retem um
  // token anterior ao seu.
  // PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 acrescentou os campos
  // `prioridade_*` ao read model do detalhe administrativo, entao
  // pedido-detail-data.js passa a carregar o token dessa ordem. As duas telas
  // de edicao nao foram tocadas e mantem os seus. Mesma regra de sempre: cada
  // superficie carrega o token da ordem que a alterou POR ULTIMO, e nenhuma
  // retem um token anterior ao seu.
  // PEDIDO-UNIFIED-ADMIN-EDITOR-R1 reescreveu pedido-edit.js como o editor
  // unificado, entao ele passa a carregar o token dessa ordem.
  // pedido-itens-edit.js NAO foi tocado (fica rastreado para retirada
  // fisica futura) e mantem o token anterior.
  const ULTIMA_ORDEM = {
    'js/screens/pedido-detail-data.js': '20260728-pedido-item-production-priority-r1',
    'js/screens/pedido-edit.js': '20260729-pedido-unified-admin-editor-r1',
    'js/screens/pedido-itens-edit.js': '20260727-ui-pedido-screen-group-1',
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
// A passada 5 de alinhamento marcou o rodape de acoes pos-salvamento deste
// arquivo, entao ele e retokenizado mais uma vez. A garantia nao muda: a
// superficie alterada segue invalidada, sob o token da ordem que a alterou por
// ultimo, e nunca sob um token anterior ao seu.
// A passada 6 de tipografia levou os titulos de secao deste arquivo para o token
// de papel COMPONENT_HEADING, entao ele e retokenizado mais uma vez. Mesma regra.
test('index.html: a superfície tocada pela passada 1 de cor carrega o token dela', () => {
  const asset = 'js/screens/cliente-pedido-form.js';
  const esc = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A passada 7 substituiu os quatro selects nativos deste arquivo pelo
  // controle canonico, e a passada 8 de tabela deu ao cabecalho e as linhas da
  // tabela de itens o dono canonico de rolagem (`data-rv-table-scroll`).
  // ACTION-CONTAINMENT-A1 passou a barra de acoes do modal de adicionar item
  // para o dono canonico modalActionBar(), entao ele e retokenizado mais uma
  // vez. Mesma regra: sempre o token da ordem que o alterou por ultimo.
  // SPECIALIZED-CONTROLS-B1 migrou as duas textareas deste arquivo para o
  // primitivo compartilhado, entao ele e retokenizado mais uma vez.
  // PEDIDO-SCREEN-GROUP-1 alinhou os quatro campos de Dados gerais no degrau
  // canonico, corrigiu a grade de tres colunas que abrigava quatro campos,
  // tirou o chevron das caixas somente-leitura do modal e passou as acoes de
  // linha para o dono canonico, entao ele e retokenizado mais uma vez.
  // PEDIDO-SCREEN-GROUP-2 deu ao cartao do modal de adicionar item a moldura
  // canonica, o divisor de cabecalho, o nome acessivel do botao de fechar e o
  // empilhamento var(--rv-z-modal) que destravou os seletores Tipo e Modelo, e
  // removeu o contorno de posicionamento provado redundante nas acoes de linha.
  // Entao ele e retokenizado mais uma vez. Mesma regra de sempre.
  // PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 acrescentou a solicitacao de
  // prioridade e a confirmacao de finalizacao a esta tela, entao ela e
  // retokenizada mais uma vez. Mesma regra de sempre.
  assert.match(index, new RegExp(esc + '\\?v=20260728-pedido-item-production-priority-r1'),
    asset + ' deve carregar o token da ordem que o alterou por ultimo');
  assert.doesNotMatch(index, new RegExp(esc + '\\?v=20260727-ui-pedido-screen-group-2'),
    asset + ' não pode reter o token de PEDIDO-SCREEN-GROUP-2');
  assert.doesNotMatch(index, new RegExp(esc + '\\?v=20260727-ui-pedido-screen-group-1'),
    asset + ' não pode reter o token de PEDIDO-SCREEN-GROUP-1');
  assert.doesNotMatch(index, new RegExp(esc + '\\?v=20260727-ui-specialized-controls-b1'),
    asset + ' não pode reter o token de SPECIALIZED-CONTROLS-B1');
  assert.doesNotMatch(index, new RegExp(esc + '\\?v=20260726-ui-p5-pass1'),
    asset + ' não pode reter o token da passada 1 de cor');
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
  // A passada 3 de altura alterou OS DOIS, entao ambos voltam a compartilhar um
  // token — o da ordem que os alterou por ultimo. A garantia nao muda.
  // A passada 5 de alinhamento alterou APENAS pedido-form.js (o rodape de acoes
  // pos-salvamento), entao os dois voltam a divergir. Cada um continua sendo
  // verificado contra a ordem que o alterou por ultimo.
  // A passada 6 de tipografia alterou APENAS pedido-form.js (os titulos de
  // secao e o resumo pos-salvamento), entao os dois seguem divergindo.
  // A passada 7 alterou OS DOIS — Cliente e o Status somente-leitura em
  // pedido-form.js, e os dois controles inline em pedido-item-row-editor.js —
  // entao voltam a compartilhar um token, o da ordem que os alterou por
  // ultimo. A garantia nao muda.
  // SPECIALIZED-CONTROLS-B1 alterou APENAS pedido-form.js (a textarea de
  // instrucoes gerais, agora com autosize pelo dono compartilhado), entao os
  // dois voltam a divergir. Cada um segue verificado contra a ordem que o
  // alterou por ultimo.
  // PEDIDO-SCREEN-GROUP-1 alterou OS DOIS — a caixa de campo de Dados gerais e
  // o degrau das acoes em pedido-form.js, e a acao destrutiva de linha em
  // pedido-item-row-editor.js —, entao voltam a compartilhar um token, o da
  // ordem que os alterou por ultimo. A garantia nao muda.
  // PEDIDO-SCREEN-GROUP-3 fechou UI-ACTION-BUTTON-CALLER-WORKAROUND-REDUNDANT:
  // removeu de pedido-item-row-editor.js o `position:relative` de chamador que
  // PEDIDO-SCREEN-GROUP-2 tornou redundante ao declarar o contexto no proprio
  // actionButton(). Entao os dois voltam a divergir, e a linha de item carrega
  // o token dessa ordem. A garantia nao muda: cada asset e verificado contra a
  // ordem que o alterou POR ULTIMO, e nenhum retem o token do lote 2.
  // PEDIDO-ADMIN-DUAL-ITEM-ENTRY-RESTORE-R1 restaurou o modal detalhado de
  // item na tela admin e acrescentou a acao discreta "Adicionar linha", entao
  // pedido-form.js passa a carregar o token dessa ordem. A linha de item nao
  // foi tocada e mantem o seu. A garantia nao muda: cada asset e verificado
  // contra a ordem que o alterou POR ULTIMO, e nenhum retem o token do lote 2.
  // PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 acrescentou o painel de
  // prioridade a tela admin de criacao, entao pedido-form.js volta a divergir
  // e carrega o token dessa ordem. O modal de item e a linha de item nao foram
  // tocados e mantem os seus. A garantia nao muda: cada asset e verificado
  // contra a ordem que o alterou POR ULTIMO, e nenhum retem o token do lote 2.
  // PEDIDO-UNIFIED-ADMIN-EDITOR-R1 adotou js/pedido-draft.js em
  // pedido-form.js (identidade/totais de item) e acrescentou o modo
  // `locked`/`readOnly` em pedido-item-row-editor.js, entao os dois
  // passam a carregar o token dessa ordem. pedido-item-modal.js não foi
  // tocado e mantém o seu.
  const ULTIMA_ORDEM = {
    'screens/pedido-form.js': '20260729-pedido-unified-admin-editor-r1',
    'screens/pedido-item-modal.js': '20260728-pedido-dual-item-entry-r1',
    'screens/pedido-item-row-editor.js': '20260729-pedido-unified-admin-editor-r1',
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
