// Smoke test da superfície TECELAGEM V1 (js/screens/tecelagem.js).
//
// TECELAGEM-V1-FIRST-VERTICAL-SLICE. Prova a fatia vertical inteira no nível
// da TELA, com o Supabase substituído por um duplo — o que sobra sendo
// exatamente o código de produto:
//
//   MINHAS OPs -> ABRIR OP -> INICIAR PRODUÇÃO -> REGISTRAR PRODUÇÃO
//                                              -> VER ROLOS
//
// O critério de aceitação central é verificado aqui do lado do CLIENTE
// (registrar 10 rolos chama o dono da escrita com quantidade 10 e SEM
// comprimento) e do lado do BANCO em tests/db123-tecelagem-rolos.integration
// (essa mesma chamada materializa 10 linhas individuais). Os dois juntos
// cobrem a afirmação inteira; nenhum dos dois sozinho cobre.
//
// A tela é montada FORA do body: assim o único conteúdo do body é o modal,
// e uma busca por rótulo no body não pode confundir o botão do card com o
// botão de salvar do modal, que deliberadamente têm o mesmo nome.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createScreenHarness } = require('./_screen-harness.js');

const ROOT = path.resolve(__dirname, '..');
const SCREEN_REL = 'js/screens/tecelagem.js';
const screenSrc = fs.readFileSync(path.join(ROOT, SCREEN_REL), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------
// Duplo do Supabase: responde por tabela e registra o que foi perguntado.
// ---------------------------------------------------------------------
function makeSupa({ rolos = [], lancamentos = [], rpcResult, inicioResult, desfazerResult, excluirResult,
                    ops, modelo, modelos, item, itens } = {}) {
  const calls = { from: [], rpc: [] };
  const listaOps = ops || [OP_EM_PRODUCAO];
  // `item`/`modelo` aceitam um único objeto (caso comum, um produto); `itens`/
  // `modelos` aceitam listas, para o caso de uma OP com mais de um produto
  // (ex.: um Tapete e uma Manta na mesma OP).
  const dadosItens = itens || (item ? [].concat(item) : [ITEM]);
  const dadosModelos = modelos || (modelo ? [].concat(modelo) : [MODELO]);

  function resolve(state) {
    calls.from.push({ table: state.table, filters: state.filters });
    switch (state.table) {
      case 'op_itens':
        return { data: dadosItens, error: null };
      case 'modelos':
        return { data: dadosModelos, error: null };
      case 'tecelagem_rolos':
        return { data: rolos, error: null };
      default:
        return { data: [], error: null };
    }
  }

  function builder(table) {
    const state = { table, filters: {} };
    const chain = {
      select() { return chain; },
      eq(col, val) { state.filters[col] = val; return chain; },
      in(col, vals) { state.filters[col] = vals; return chain; },
      order() { return chain; },
      maybeSingle() { return Promise.resolve(resolve(state)); },
      then(onOk, onErr) { return Promise.resolve(resolve(state)).then(onOk, onErr); },
    };
    return chain;
  }

  return {
    supa: {
      from: builder,
      rpc: async (name, params) => {
        calls.rpc.push({ name, params });
        if (name === 'tecelagem_minhas_ops') return { data: listaOps, error: null };
        if (name === 'iniciar_producao_tecelagem') {
          return inicioResult || { data: { op_id: params.p_op_id, ja_iniciada: false }, error: null };
        }
        // db/126: os dois nomes da recuperação respondem por si. Deixá-los
        // cair no `rpcResult` genérico faria a tela de rolos herdar o
        // resultado (às vezes um ERRO) preparado para OUTRA chamada.
        if (name === 'tecelagem_lancamentos_recentes') return { data: lancamentos, error: null };
        if (name === 'desfazer_lancamento_tecelagem') {
          return desfazerResult || { data: { rolos_removidos: 3 }, error: null };
        }
        if (name === 'excluir_rolo_tecelagem') {
          return excluirResult || { data: { rolo_id: params.p_rolo_id, rolos_restantes: 4 }, error: null };
        }
        return rpcResult || { data: { quantidade_rolos: params.p_quantidade_rolos }, error: null };
      },
    },
    calls,
  };
}

// Linhas como o read model public.tecelagem_minhas_ops() as devolve.
//
// REPARE em OP_EM_PRODUCAO: `status` (o ciclo de vida do Admin) continua
// 'aberta' enquanto `situacao_execucao` já é 'em_producao'. É exatamente essa
// a fatia: o início é LOCAL à tecelagem e não mexe no status do Admin.
const OP_EM_PRODUCAO = {
  op_id: 501, numero: 3, ano: 2026, identidade_operacional: 'OP 003/2026',
  status: 'aberta', cliente_nome: 'Felipe Grandi',
  situacao_execucao: 'em_producao', motivo_bloqueio: null,
  producao_iniciada_em: '2026-08-03T12:00:00.000Z',
};
const OP_PRONTA = {
  op_id: 502, numero: 4, ano: 2026, identidade_operacional: 'OP 004/2026',
  status: 'aberta', cliente_nome: 'Felipe Grandi',
  situacao_execucao: 'pode_iniciar', motivo_bloqueio: null,
  producao_iniciada_em: null,
};
const OP_BLOQUEADA = {
  op_id: 503, numero: 5, ano: 2026, identidade_operacional: 'OP 005/2026',
  status: 'aberta', cliente_nome: 'Felipe Grandi',
  situacao_execucao: 'bloqueada', motivo_bloqueio: 'PEDIDO_NAO_CONFIRMADO',
};
const ITEM = { id: 511, op_id: 501, modelo_id: 221, metros_pedidos: 4000, metros_ajustados: null };
const MODELO = {
  id: 221, nome: 'NOITE', largura: 2.10, tipo_produto: 'tapete',
  cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' },
};
// db/124: EMBORRACHAR é definido pela Ravatex POR PRODUTO DA OP
// (op_itens.emborrachar), nunca por modelo — o mesmo modelo NOITE em outra OP
// pode carregar outro valor, ou nenhum. Um produto aplicável (Tapete) pode ou
// não já ter o valor registrado; os dois casos são de primeira classe.
const ITEM_COM_EMBORRACHAR = Object.assign({}, ITEM, { emborrachar: 'CRU' });
// Manta nunca é emborrachada (regra de produto): 'Não se aplica' é um estado
// DIFERENTE de 'não definido', derivado do único dono existente da distinção
// tapete/manta, modelos.tipo_produto (db/78). Cores deliberadamente
// diferentes de MODELO (nenhuma é "CRU"), para que um teste possa provar que
// nada do texto de EMBORRACHAR vaza sem colidir com um nome de cor legítimo.
const MODELO_MANTA = Object.assign({}, MODELO, {
  id: 222, nome: 'ARABESCO', tipo_produto: 'manta',
  cor_1: { id: 3, nome: 'AZUL' }, cor_2: { id: 4, nome: 'BEGE' },
});

function boot({ rolos, lancamentos, rpcResult, inicioResult, desfazerResult, excluirResult, ops,
                fornecedorId = 401, modelo, modelos, item, itens } = {}) {
  const { supa, calls } = makeSupa({ rolos, lancamentos, rpcResult, inicioResult, desfazerResult,
    excluirResult, ops, modelo, modelos, item, itens });
  const toasts = [];
  const h = createScreenHarness({
    files: ['js/op-display.js', SCREEN_REL],
    rpc: async () => ({ data: null, error: null }),
    globals: {
      supa,
      CURRENT_USER: { nome: 'Operador', tipo: 'fornecedor', fornecedor_id: fornecedorId },
    },
  });
  // js/ui.js declara o seu próprio `toast` ao ser carregado, então a captura
  // tem de ser instalada DEPOIS da carga, não via globals.
  h.win.toast = (msg, kind) => { toasts.push({ msg, kind }); };

  // Duplo de window.open: a mecânica real de impressão abre uma janela e
  // grava HTML nela (js/screens/tecelagem.js `imprimir`). Aqui só provamos
  // QUE a impressão foi acionada e COM QUE conteúdo — nunca a renderização
  // real do navegador, que este harness não reproduz.
  const opens = [];
  h.win.open = () => {
    const janela = {
      document: { open() {}, write(html) { janela.html = html; }, close() {} },
      focus() {}, print() { janela.impressa = true; },
    };
    opens.push(janela);
    return janela;
  };

  // Deixa a cadeia assíncrona de reload() drenar por inteiro.
  const settle = async () => { for (let i = 0; i < 8; i += 1) await h.settle(); };

  return { h, calls, toasts, opens, settle };
}

const btn = (h, label, root) => h.findOne(h.buttonLabelled(label), root);

// =====================================================================
// Estáticos
// =====================================================================

test('1. js/screens/tecelagem.js existe, é script clássico e tem sintaxe válida', () => {
  assert.ok(fs.existsSync(path.join(ROOT, SCREEN_REL)), `${SCREEN_REL} não existe`);
  assert.ok(!/^\s*(import|export)\s/m.test(screenSrc), 'não deve ser ES module');
  execFileSync(process.execPath, ['--check', path.join(ROOT, SCREEN_REL)]);
});

test('2. index.html carrega tecelagem.js exatamente uma vez, com cache-token, antes de boot.js', () => {
  const re = /<script\s+src="js\/screens\/tecelagem\.js\?v=[^"]+"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1, `esperado 1 <script> de tecelagem.js, encontrado ${matches.length}`);
  assert.ok(indexSrc.indexOf('js/screens/tecelagem.js') < indexSrc.indexOf('js/boot.js'),
    'tecelagem.js deve ser carregado antes de js/boot.js');
});

test('3. a superfície de tecelagem não tem nenhum caminho de escrita no Admin', () => {
  // O isolamento é estrutural no banco (db/123). Aqui garantimos que a TELA
  // sequer tenta um caminho de escrita, direto ou por RPC de outro domínio.
  assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(screenSrc),
    'a superfície de tecelagem não pode conter DML direto');
  const rpcs = [...screenSrc.matchAll(/\.rpc\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  // db/126 acrescentou DOIS nomes (o dono da escrita do DESFAZER e o read model
  // de recuperação) e db/127 acrescenta UM (o dono da escrita da EXCLUSÃO de um
  // rolo). Todos são da própria tecelagem — o inventário cresce, a fronteira
  // não.
  assert.deepEqual(
    rpcs,
    ['desfazer_lancamento_tecelagem', 'enviar_rolos_acabamento', 'excluir_rolo_tecelagem',
      'iniciar_producao_tecelagem', 'registrar_producao_tecelagem',
      'tecelagem_lancamentos_recentes', 'tecelagem_minhas_ops'],
    `a tela só pode chamar os read models e os donos de escrita da tecelagem, encontrou: ${rpcs.join(', ')}`);

  // O início da produção aqui é LOCAL à tecelagem. A transição autoritativa do
  // Admin não pertence a esta fatia e não pode ser acionada, nem por engano. A
  // varredura ignora comentários: citar o dono da transição ao explicar por
  // que NÃO a acionamos é documentação, não chamada.
  const codigo = screenSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/iniciar_producao_op|abrir_op_tecelagem|alterar_status_op/.test(codigo),
    'a tecelagem não pode acionar nenhuma transição de ciclo de vida do Admin');
});

// =====================================================================
// MINHAS OPs
// =====================================================================

test('4. Minhas OPs lista a OP com CLIENTE e estado, vinda do read model', async () => {
  const { h, calls, settle } = boot();
  const node = h.win.screenTecelagemOps();
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /OP 003\/2026/, 'a identidade da OP deve aparecer');
  assert.match(texto, /Cliente: Felipe Grandi/, 'o cliente da OP deve estar visível');
  assert.match(texto, /Produção iniciada/, 'o estado operacional da OP deve aparecer');
  assert.ok(btn(h, 'Abrir OP', node), 'deve haver a ação Abrir OP');

  // O escopo por fornecedor e etapa é do dono do read model, não da tela.
  assert.ok(calls.rpc.some((c) => c.name === 'tecelagem_minhas_ops'),
    'a lista deve vir do read model de tecelagem');
  assert.equal(calls.from.length, 0, 'Minhas OPs não deve montar consulta própria de escopo');
});

test('4b. Minhas OPs inclui OP pronta para iniciar e OP bloqueada, e diz qual é qual', async () => {
  const { h, settle } = boot({ ops: [OP_EM_PRODUCAO, OP_PRONTA, OP_BLOQUEADA] });
  const node = h.win.screenTecelagemOps();
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /OP 003\/2026/);
  assert.match(texto, /OP 004\/2026/, 'a OP pronta para iniciar deve aparecer na lista');
  assert.match(texto, /OP 005\/2026/, 'a OP bloqueada deve aparecer na lista');

  assert.match(texto, /Pronta para iniciar produção/, 'o estado "pode iniciar" deve ser comunicado');
  assert.match(texto, /Produção iniciada em 03\/08\/2026/,
    'o estado "produção iniciada" deve ser comunicado, com o momento do início');
  assert.match(texto, /Ainda não liberada: o pedido ainda não foi confirmado/,
    'o motivo do bloqueio deve ser comunicado ao operador');
});

test('4d. Minhas OPs não oferece a ação de iniciar: ela vive na tela da OP', async () => {
  const { h, settle } = boot({ ops: [OP_PRONTA] });
  const node = h.win.screenTecelagemOps();
  await settle();

  assert.ok(!btn(h, 'Iniciar produção', node),
    'o fluxo ratificado é MINHAS OPs -> ABRIR OP -> INICIAR PRODUÇÃO');
  assert.ok(btn(h, 'Abrir OP', node));
});

test('4c. um motivo de bloqueio desconhecido não é escondido nem inventado', async () => {
  const desconhecida = Object.assign({}, OP_BLOQUEADA, { motivo_bloqueio: 'CODIGO_NOVO_QUALQUER' });
  const { h, settle } = boot({ ops: [desconhecida] });
  const node = h.win.screenTecelagemOps();
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Ainda não liberada para produção/,
    'sem tradução conhecida, a tela declara o bloqueio sem inventar um motivo');
  assert.ok(!/CODIGO_NOVO_QUALQUER/.test(texto), 'o código cru não vaza para o operador');
});

test('5. Minhas OPs sem vínculo de fornecedor não consulta nada e explica o motivo', async () => {
  const { h, calls, settle } = boot({ fornecedorId: null });
  const node = h.win.screenTecelagemOps();
  await settle();

  assert.match(h.textOf(node), /não está vinculado a um fornecedor/);
  assert.equal(calls.rpc.length, 0, 'não pode haver consulta sem fornecedor');
  assert.equal(calls.from.length, 0, 'não pode haver consulta sem fornecedor');
});

// =====================================================================
// ABRIR OP — o produto é a unidade operacional, e é somente leitura
// =====================================================================

test('6. Abrir OP mostra CLIENTE, produto, previsto e produzido, sem campo editável', async () => {
  const { h, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Cliente: Felipe Grandi/, 'o cliente deve estar visível ao abrir a OP');
  assert.match(texto, /NOITE · 2,10 m · KRAFT\/CRU/, 'o rótulo do produto deve seguir o formato do produto');
  assert.match(texto, /Previsto/);
  assert.match(texto, /4\.000,00 m/, 'o previsto deve vir em pt-BR com unidade');
  assert.match(texto, /Produzido/);
  assert.match(texto, /0 rolos/);

  assert.ok(btn(h, 'Registrar produção', node), 'deve haver a ação Registrar produção');
  assert.ok(btn(h, 'Ver rolos', node), 'deve haver a ação Ver rolos');

  // Dado definido pela Ravatex é somente leitura: a tela de OP não expõe
  // nenhum controle de entrada sobre ele.
  const editaveis = h.findAll((n) => n.tagName === 'INPUT' || n.tagName === 'TEXTAREA', node);
  assert.equal(editaveis.length, 0,
    'a tela de OP não pode expor campo editável sobre dado definido pela Ravatex');
});

test('6b. antes do início local o registro fica indisponível e explicado', async () => {
  const { h, calls, settle } = boot({ rolos: [], ops: [OP_PRONTA] });
  const node = h.win.screenTecelagemOp(502);
  await settle();

  assert.match(h.textOf(node), /Inicie a produção para registrar rolos/,
    'o operador precisa saber por que não pode registrar');

  const acao = btn(h, 'Registrar produção', node);
  assert.ok(acao, 'a ação continua visível, para o estado ser legível');
  // el() materializa um atributo booleano como disabled="disabled".
  assert.equal(acao.getAttribute('disabled'), 'disabled',
    'mas não pode estar acionável');

  h.click(acao);
  await settle();
  assert.equal(calls.rpc.filter((c) => c.name === 'registrar_producao_tecelagem').length, 0,
    'nenhum registro pode partir de uma OP fora de produção');
});

test('6c. Ver rolos continua acessível numa OP que ainda não está em produção', async () => {
  const { h, settle } = boot({ rolos: [], ops: [OP_PRONTA] });
  const node = h.win.screenTecelagemOp(502);
  await settle();
  const ver = btn(h, 'Ver rolos', node);
  assert.ok(ver && ver.disabled !== true, 'consultar rolos nunca depende do estado de produção');
});

// =====================================================================
// INICIAR PRODUÇÃO — local à tecelagem, e porta obrigatória do registro
// =====================================================================

test('6d. numa OP pronta a OP oferece INICIAR PRODUÇÃO e o registro fica travado', async () => {
  const { h, settle } = boot({ rolos: [], ops: [OP_PRONTA] });
  const node = h.win.screenTecelagemOp(502);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Pronta para iniciar produção/, 'o estado deve estar legível');

  const iniciar = btn(h, 'Iniciar produção', node);
  assert.ok(iniciar, 'a OP pronta deve oferecer INICIAR PRODUÇÃO');
  assert.ok(!iniciar.getAttribute('disabled'), 'e a ação deve estar acionável');

  assert.equal(btn(h, 'Registrar produção', node).getAttribute('disabled'), 'disabled',
    'REGISTRAR PRODUÇÃO só se abre depois do início local');
});

test('6e. iniciar produção chama o dono do início local com a OP, e nada do Admin', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: [], ops: [OP_PRONTA] });
  const node = h.win.screenTecelagemOp(502);
  await settle();

  h.click(btn(h, 'Iniciar produção', node));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'iniciar_producao_tecelagem');
  assert.ok(chamada, 'o dono do início local deve ter sido chamado');
  assert.equal(chamada.params.p_op_id, 502, 'a OP deve viajar no payload');
  assert.equal(calls.rpc.filter((c) => c.name === 'iniciar_producao_tecelagem').length, 1,
    'um clique é uma chamada');

  assert.ok(toasts.some((t) => t.kind === 'success' && /Produção iniciada/.test(t.msg)),
    'o operador deve receber a confirmação do início');

  // Nenhuma consulta ou escrita fora da superfície de tecelagem.
  assert.ok(calls.from.every((c) => ['op_itens', 'modelos', 'tecelagem_rolos'].includes(c.table)),
    'iniciar produção não pode tocar em tabela do Admin');
});

test('6f. depois do início a OP declara produção iniciada e libera o registro', async () => {
  const { h, settle } = boot({ rolos: [], ops: [OP_EM_PRODUCAO] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Produção iniciada/, 'a tela deve declarar que a produção foi iniciada');
  assert.ok(!btn(h, 'Iniciar produção', node),
    'iniciar deixa de ser oferecido depois de iniciado');

  const registrar = btn(h, 'Registrar produção', node);
  assert.ok(registrar, 'REGISTRAR PRODUÇÃO deve estar presente');
  assert.ok(!registrar.getAttribute('disabled'), 'e acionável');
  assert.ok(btn(h, 'Ver rolos', node), 'VER ROLOS deve estar presente');
});

test('6g. uma OP bloqueada NÃO ganha a ação de iniciar', async () => {
  const { h, settle } = boot({ rolos: [], ops: [OP_BLOQUEADA] });
  const node = h.win.screenTecelagemOp(503);
  await settle();

  assert.ok(!btn(h, 'Iniciar produção', node),
    'uma OP inelegível não pode ganhar a ação só porque a tela existe');
  assert.equal(btn(h, 'Registrar produção', node).getAttribute('disabled'), 'disabled');
  assert.match(h.textOf(node), /Ainda não liberada: o pedido ainda não foi confirmado/);
});

test('6h. uma recusa do início vira mensagem com motivo, e a ação volta a ser tentável', async () => {
  const { h, toasts, settle } = boot({
    rolos: [],
    ops: [OP_PRONTA],
    inicioResult: {
      data: null,
      error: {
        message: 'TECELAGEM_OP_NAO_ELEGIVEL_PARA_INICIO',
        details: 'PEDIDO_CANCELADO',
      },
    },
  });
  const node = h.win.screenTecelagemOp(502);
  await settle();

  const iniciar = btn(h, 'Iniciar produção', node);
  h.click(iniciar);
  await settle();

  assert.ok(toasts.some((t) => t.kind === 'error' && /o pedido foi cancelado/.test(t.msg)),
    'a recusa precisa chegar ao operador com o motivo');
  assert.ok(!toasts.some((t) => t.kind === 'success'), 'não pode haver confirmação de sucesso');
  assert.equal(iniciar.disabled, false, 'depois da recusa a ação volta a ser tentável');
});

// =====================================================================
// REGISTRAR PRODUÇÃO — o critério de aceitação central
// =====================================================================

test('7. registrar 10 rolos SEM comprimento envia quantidade 10 e nenhum comprimento', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();

  const qtd = h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10');
  assert.ok(qtd, 'o campo de quantidade de rolos deve existir no modal');
  h.type(qtd, '10');

  // O body contém apenas o modal, então este é o botão de salvar do modal.
  h.click(btn(h, 'Registrar produção'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'registrar_producao_tecelagem');
  assert.ok(chamada, 'o dono da escrita deve ter sido chamado');
  assert.equal(chamada.params.p_op_item_id, 511, 'o produto selecionado deve viajar no payload');
  assert.equal(chamada.params.p_quantidade_rolos, 10, 'a quantidade enviada deve ser 10');
  assert.equal(chamada.params.p_comprimentos, null,
    'sem comprimento informado, o payload NÃO pode inventar comprimentos');

  assert.ok(toasts.some((t) => /10 rolos registrados/.test(t.msg)),
    'o operador deve receber a confirmação dos 10 rolos');
});

test('8. o comprimento é opcional: existe, é declarado Opcional e não é obrigatório', async () => {
  const { h, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();

  const comprimento = h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Opcional');
  assert.ok(comprimento, 'o campo de comprimento deve existir');
  assert.ok(!comprimento.getAttribute('required'), 'o comprimento NÃO pode ser obrigatório');
  assert.match(h.textOf(h.body), /Opcional/,
    'a tela deve declarar ao operador que o comprimento é opcional');
});

test('9. um comprimento informado viaja uma vez por rolo', async () => {
  const { h, calls, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10'), '3');
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Opcional'), '28,4');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'registrar_producao_tecelagem');
  assert.deepEqual(chamada.params.p_comprimentos, [28.4, 28.4, 28.4],
    'a vírgula decimal deve ser aceita e o comprimento deve valer para os 3 rolos');
});

test('10. quantidade ausente é recusada no cliente e não chega ao dono da escrita', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();
  h.click(btn(h, 'Registrar produção'));
  await settle();

  assert.equal(calls.rpc.filter((c) => c.name === 'registrar_producao_tecelagem').length, 0,
    'nada pode ser enviado sem quantidade');
  assert.ok(toasts.some((t) => t.kind === 'error'), 'o operador deve ser avisado');
});

test('11. uma recusa do servidor vira mensagem operacional, nunca sucesso silencioso', async () => {
  const { h, toasts, settle } = boot({
    rolos: [],
    rpcResult: { data: null, error: { message: 'TECELAGEM_PRODUTO_FORA_DO_ESCOPO_DO_FORNECEDOR' } },
  });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10'), '4');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  assert.ok(toasts.some((t) => t.kind === 'error' && /não pertence a uma OP atribuída a você/.test(t.msg)),
    'a recusa precisa chegar ao operador com significado');
  assert.ok(!toasts.some((t) => t.kind === 'success'), 'não pode haver confirmação de sucesso');
});

// =====================================================================
// VER ROLOS
// =====================================================================

test('12. Ver rolos mostra os 10 rolos individuais, numerados e Na tecelagem', async () => {
  const rolos = Array.from({ length: 10 }, (_, i) => ({
    id: 900 + i, op_item_id: 511, numero: 43 + i,
    comprimento_m: null, situacao: 'na_tecelagem',
  }));
  const { h, settle } = boot({ rolos });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Na tecelagem/);
  for (let n = 43; n <= 52; n += 1) {
    assert.match(texto, new RegExp(String(n).padStart(3, '0')),
      `o rolo ${n} deve estar visível individualmente`);
  }
});

test('13. um rolo sem comprimento continua visível e válido, com travessão', async () => {
  const rolos = [
    { id: 901, op_item_id: 511, numero: 43, comprimento_m: 28.4, situacao: 'na_tecelagem' },
    { id: 902, op_item_id: 511, numero: 44, comprimento_m: null, situacao: 'na_tecelagem' },
    { id: 903, op_item_id: 511, numero: 45, comprimento_m: null, situacao: 'na_tecelagem' },
  ];
  const { h, settle } = boot({ rolos });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /28,40 m/, 'o comprimento medido deve vir em pt-BR');
  assert.match(texto, /—/, 'a ausência de comprimento é declarada, não escondida');
  assert.match(texto, /044/);
  assert.match(texto, /045/);
});

test('14. Ver rolos sem nenhum rolo mostra um estado vazio honesto', async () => {
  const { h, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();
  assert.match(h.textOf(node), /Nenhum rolo registrado ainda/);
});

// =====================================================================
// ETIQUETAS — TECELAGEM-V1-LABELS-SLICE
// =====================================================================

// -- campos puros: nenhum rende DOM, então provam a REGRA sem depender de
//    layout -------------------------------------------------------------

test('15. etiqueta do rolo SEM comprimento não exige nem inventa o campo', () => {
  const rolo = { numero: 43, comprimento_m: null };
  const campos = h_pure().camposEtiquetaRolo(OP_EM_PRODUCAO, { modelo: MODELO }, rolo);
  const rotulos = campos.map((par) => par[0]);
  assert.ok(!rotulos.includes('COMPRIMENTO'), 'sem comprimento, o campo não aparece — nunca um valor inventado');
  assert.deepEqual(rotulos, ['CLIENTE', 'MODELO', 'COR', 'LARGURA', 'OP', 'ROLO', 'IDENTIFICAÇÃO'],
    'os campos obrigatórios da etiqueta do rolo devem estar todos presentes');
});

test('16. etiqueta do rolo COM comprimento mostra o valor em pt-BR', () => {
  const rolo = { numero: 43, comprimento_m: 28.4 };
  const campos = h_pure().camposEtiquetaRolo(OP_EM_PRODUCAO, { modelo: MODELO }, rolo);
  const comprimento = campos.find((par) => par[0] === 'COMPRIMENTO');
  assert.ok(comprimento, 'com comprimento informado, o campo deve aparecer');
  assert.equal(comprimento[1], '28,40 m');
});

test('17. EMBORRACHAR vem do PRODUTO DA OP (não do modelo) e nunca bloqueia quando ausente', () => {
  const helpers = h_pure();
  const produtoComValor = { modelo: MODELO, emborrachar: 'CRU' };
  const produtoSemValor = { modelo: MODELO, emborrachar: null };
  assert.deepEqual(helpers.estadoEmborrachar(produtoComValor), { estado: 'valor', valor: 'CRU' });
  assert.deepEqual(helpers.estadoEmborrachar(produtoSemValor), { estado: 'nao_definido', valor: null },
    'produto aplicável sem o campo ainda preenchido é um estado válido, não um erro');
});

test('17b. dois produtos do MESMO modelo em OPs diferentes carregam EMBORRACHAR independentes', () => {
  const helpers = h_pure();
  // Mesma modelo_id (221 / NOITE), duas linhas de op_itens distintas — a
  // cardinalidade correta é por produto da OP, nunca por modelo reutilizável.
  const produtoOpA = { modelo: MODELO, emborrachar: 'CRU' };
  const produtoOpB = { modelo: MODELO, emborrachar: null };
  assert.equal(helpers.estadoEmborrachar(produtoOpA).valor, 'CRU');
  assert.equal(helpers.estadoEmborrachar(produtoOpB).estado, 'nao_definido',
    'a mesma modelo_id em outra OP não pode herdar o valor da primeira');
});

test('17c. MANTA é "não se aplica", nunca confundida com "não definido", e nunca inferida por cor', () => {
  const helpers = h_pure();
  const mantaSemValor = { modelo: MODELO_MANTA, emborrachar: null };
  const mantaComValorEsquecido = { modelo: MODELO_MANTA, emborrachar: 'CRU' };
  assert.deepEqual(helpers.estadoEmborrachar(mantaSemValor), { estado: 'nao_aplica', valor: null });
  // Mesmo que um valor tenha sido gravado por engano, MANTA continua
  // "não se aplica": a regra de produto (manta nunca é emborrachada) prevalece.
  assert.equal(helpers.estadoEmborrachar(mantaComValorEsquecido).estado, 'nao_aplica');
});

test('17d. MANTA não tem etiqueta de acabamento; produto aplicável (Tapete) tem, com ou sem valor', () => {
  const helpers = h_pure();
  assert.equal(helpers.temEtiquetaAcabamento({ modelo: MODELO_MANTA, emborrachar: null }), false,
    'manta: a AÇÃO em si não existe, não é só um valor diferente dentro da etiqueta');
  assert.equal(helpers.temEtiquetaAcabamento({ modelo: MODELO, emborrachar: 'CRU' }), true);
  assert.equal(helpers.temEtiquetaAcabamento({ modelo: MODELO, emborrachar: null }), true,
    'tapete sem instrução ainda cadastrada continua com a ação disponível');
});

test('18. a etiqueta de acabamento NUNCA inclui EMBORRACHAR ou COMPRIMENTO como campo filtrável',
  () => {
    const helpers = h_pure();
    const campos = helpers.camposBasicosAcabamento(OP_EM_PRODUCAO, { modelo: MODELO, emborrachar: 'CRU' });
    const rotulos = campos.map((par) => par[0]);
    assert.deepEqual(rotulos, ['CLIENTE', 'MODELO', 'COR']);
    assert.equal(campos.find((par) => par[0] === 'CLIENTE')[1], 'FELIPE GRANDI',
      'a etiqueta de acabamento mostra o cliente em caixa alta');
  });

// Um harness leve só para os pure helpers acima: nenhuma tela é montada.
function h_pure() {
  const { supa } = makeSupa({});
  const h = createScreenHarness({
    files: ['js/op-display.js', SCREEN_REL],
    rpc: async () => ({ data: null, error: null }),
    globals: { supa, CURRENT_USER: { tipo: 'fornecedor', fornecedor_id: 401 } },
  });
  return h.win.RAVATEX_TECELAGEM;
}

// -- fluxo completo: REGISTRAR -> ETIQUETAS DISPONÍVEIS -----------------

test('19. registrar rolos SEM comprimento abre ETIQUETAS DISPONÍVEIS, e nenhuma etiqueta trava', async () => {
  const { h, opens, settle } = boot({
    rolos: [],
    rpcResult: { data: { quantidade_rolos: 10, numero_inicial: 1, numero_final: 10 }, error: null },
  });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10'), '10');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  assert.match(h.textOf(h.body), /10 rolos criados — etiquetas disponíveis/,
    'as etiquetas devem ficar disponíveis imediatamente, sem nova navegação');
  const botoesImprimir = h.findAll((n) => n.tagName === 'BUTTON' && h.textOf(n) === 'Imprimir etiqueta');
  assert.equal(botoesImprimir.length, 10, 'cada um dos 10 rolos criados deve oferecer a própria etiqueta');

  h.click(botoesImprimir[0]);
  await settle();
  assert.equal(opens.length, 1, 'imprimir uma etiqueta deve abrir a janela de impressão');
  assert.ok(opens[0].impressa, 'a impressão deve ser efetivamente acionada');
  assert.ok(!/COMPRIMENTO/.test(opens[0].html),
    'sem comprimento informado no registro, a etiqueta impressa não pode inventar o campo');
});

test('20. registrar rolos COM comprimento propaga o valor para a etiqueta de cada rolo', async () => {
  const { h, opens, settle } = boot({
    rolos: [],
    rpcResult: { data: { quantidade_rolos: 3, numero_inicial: 1, numero_final: 3 }, error: null },
  });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Registrar produção', node));
  await settle();
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10'), '3');
  h.type(h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Opcional'), '28,4');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  const botoesImprimir = h.findAll((n) => n.tagName === 'BUTTON' && h.textOf(n) === 'Imprimir etiqueta');
  assert.equal(botoesImprimir.length, 3);
  h.click(botoesImprimir[1]);
  await settle();
  assert.match(opens[0].html, /28,40 m/, 'o comprimento informado no registro deve chegar à etiqueta impressa');
});

// -- REIMPRIMIR (VER ROLOS): mesmo rolo, nenhuma criação -----------------

test('21. reimprimir etiqueta em VER ROLOS não chama o dono da escrita nem cria rolo novo', async () => {
  const rolos = [{ id: 901, op_item_id: 511, numero: 43, comprimento_m: 28.4, situacao: 'na_tecelagem' }];
  const { h, calls, opens, settle } = boot({ rolos });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const reimprimir = h.findOne((n) => n.tagName === 'BUTTON'
    && n.getAttribute('title') === 'Reimprimir etiqueta do rolo 043', node);
  assert.ok(reimprimir, 'a ação de reimprimir deve existir na linha do rolo 043');

  const chamadasAntes = calls.rpc.length;
  h.click(reimprimir);
  await settle();

  assert.match(h.textOf(h.body), /Etiqueta do rolo 043/, 'a pré-visualização deve identificar o rolo exato');
  assert.equal(calls.rpc.length, chamadasAntes, 'reimprimir não pode chamar RPC nenhuma — é leitura pura');
  assert.equal(calls.rpc.filter((c) => c.name === 'registrar_producao_tecelagem').length, 0,
    'reimprimir nunca pode criar um rolo ou um lançamento novo');

  h.click(btn(h, 'Imprimir'));
  await settle();
  assert.equal(opens.length, 1, 'confirmar a impressão deve acionar a janela');
  assert.equal(calls.rpc.length, chamadasAntes, 'nem a impressão em si chama RPC nenhuma');
});

// -- ETIQUETA PARA O ACABAMENTO ------------------------------------------

test('22. etiqueta de acabamento mostra EMBORRACHAR com destaque, sem nenhum campo editável', async () => {
  const { h, settle } = boot({ rolos: [], item: ITEM_COM_EMBORRACHAR });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  h.click(btn(h, 'Etiqueta de acabamento', node));
  await settle();

  const texto = h.textOf(h.body);
  assert.match(texto, /Emborrachar/i);
  assert.match(texto, /CRU/, 'o valor definido pela Ravatex para ESTE produto da OP deve estar visível');
  assert.match(texto, /FELIPE GRANDI/, 'o cliente aparece em caixa alta na etiqueta de acabamento');

  const editaveis = h.findAll((n) => n.tagName === 'INPUT' || n.tagName === 'TEXTAREA', h.body);
  assert.equal(editaveis.length, 0,
    'EMBORRACHAR é definido pela Ravatex: a tela do fornecedor não pode oferecer nenhum controle de edição');
});

test('23. sem EMBORRACHAR registrado ainda, a etiqueta declara o estado honestamente e não bloqueia', async () => {
  const { h, settle } = boot({ rolos: [] });
  const node = h.win.screenTecelagemOp(501);
  await settle();

  const acao = btn(h, 'Etiqueta de acabamento', node);
  assert.ok(acao, 'a ação deve continuar disponível mesmo sem o valor ainda cadastrado');
  h.click(acao);
  await settle();

  assert.match(h.textOf(h.body), /Não definido pela Ravatex/);
});

test('23b. MANTA não oferece a ação Etiqueta de acabamento na tela da OP; Tapete continua oferecendo',
  async () => {
    // Mesma OP, dois produtos: item 511/NOITE (tapete, com CRU gravado por
    // engano) e item 512/ARABESCO (manta). A ausência da ação é por PRODUTO,
    // não global à tela.
    const { h, settle } = boot({
      rolos: [],
      itens: [
        Object.assign({}, ITEM_COM_EMBORRACHAR, { id: 511, modelo_id: 221 }),
        Object.assign({}, ITEM, { id: 512, modelo_id: 222, emborrachar: null }),
      ],
      modelos: [MODELO, MODELO_MANTA],
    });
    const node = h.win.screenTecelagemOp(501);
    await settle();

    const botoesAcabamento = h.findAll((n) => n.tagName === 'BUTTON' && h.textOf(n) === 'Etiqueta de acabamento', node);
    assert.equal(botoesAcabamento.length, 1,
      'exatamente um produto desta OP (o Tapete) pode oferecer a ação; a Manta não');

    // "Ver rolos" (etiqueta do rolo) continua disponível para os dois produtos.
    const botoesVerRolos = h.findAll((n) => n.tagName === 'BUTTON' && h.textOf(n) === 'Ver rolos', node);
    assert.equal(botoesVerRolos.length, 2,
      'a etiqueta do ROLO nunca depende de EMBORRACHAR: continua disponível para a manta');
  });

test('23c. Ver rolos de um produto MANTA não oferece Etiqueta de acabamento, mas reimprimir etiqueta continua',
  async () => {
    const rolosManta = [{ id: 950, op_item_id: 512, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' }];
    const { h, settle } = boot({
      rolos: rolosManta,
      modelo: MODELO_MANTA,
      item: Object.assign({}, ITEM, { id: 512, modelo_id: 222 }),
    });
    const node = h.win.screenTecelagemRolos(501, 512);
    await settle();

    assert.equal(btn(h, 'Etiqueta de acabamento', node), null,
      'a manta não pode oferecer a etiqueta de acabamento em nenhuma tela');

    const reimprimir = h.findOne((n) => n.tagName === 'BUTTON'
      && n.getAttribute('title') === 'Reimprimir etiqueta do rolo 001', node);
    assert.ok(reimprimir, 'a etiqueta do ROLO da manta continua disponível normalmente');
    h.click(reimprimir);
    await settle();
    assert.match(h.textOf(h.body), /Etiqueta do rolo 001/,
      'a etiqueta do rolo abre normalmente para um produto manta');
  });

test('24. o comprimento da etiqueta de acabamento é SEMPRE uma linha em branco, mesmo com rolo medido', async () => {
  const rolos = [{ id: 901, op_item_id: 511, numero: 43, comprimento_m: 28.4, situacao: 'na_tecelagem' }];
  const { h, settle } = boot({ rolos, item: ITEM_COM_EMBORRACHAR });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Etiqueta de acabamento', node));
  await settle();

  const texto = h.textOf(h.body);
  assert.match(texto, /_{5,}\s*m/, 'o comprimento do acabamento deve ser uma linha em branco para preenchimento manual');
  assert.ok(!/28,40/.test(texto),
    'o comprimento do rolo de tecelagem NUNCA pode ser reaproveitado como comprimento do acabamento');
});

// =====================================================================
// SAÍDA PARA O ACABAMENTO — TECELAGEM-V1-FINISHING-OUTPUT-SLICE
// =====================================================================

// Marca/desmarca um checkbox do jeito que este harness exige: o handler lê
// e.target.checked, então o estado tem de estar certo ANTES do evento disparar
// (o duplo do DOM não tem o comportamento nativo de um <input type=checkbox>
// alternar .checked sozinho ao ser clicado).
function marcar(h, checkbox, valor) {
  checkbox.checked = valor;
  h.fire(checkbox, 'change');
}

const ROLOS_MISTOS = [
  { id: 901, op_item_id: 511, numero: 1, comprimento_m: 28.4, situacao: 'na_tecelagem' },
  { id: 902, op_item_id: 511, numero: 2, comprimento_m: null, situacao: 'na_tecelagem' },
  { id: 903, op_item_id: 511, numero: 3, comprimento_m: null, situacao: 'na_tecelagem' },
  { id: 904, op_item_id: 511, numero: 4, comprimento_m: 29.2, situacao: 'enviado_acabamento' },
];

test('25. Ver rolos mostra a situação real de cada rolo, não mais um valor fixo', async () => {
  const { h, settle } = boot({ rolos: ROLOS_MISTOS });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Na tecelagem/, 'os rolos ainda na tecelagem devem declarar isso');
  assert.match(texto, /Enviado ao acabamento/, 'o rolo já enviado deve declarar a nova situação');
});

test('26. Dar saída para acabamento só lista rolos na_tecelagem; o já enviado não aparece selecionável', async () => {
  const { h, settle } = boot({ rolos: ROLOS_MISTOS });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Dar saída para acabamento', node));
  await settle();

  const texto = h.textOf(h.body);
  assert.match(texto, /Rolo 001/);
  assert.match(texto, /Rolo 002/);
  assert.match(texto, /Rolo 003/);
  assert.ok(!/Rolo 004/.test(texto),
    'um rolo já enviado não pode aparecer como elegível para uma segunda saída normal');

  const checkboxes = h.findAll((n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox', h.body);
  // Selecionar todos + 3 elegíveis = 4 checkboxes.
  assert.equal(checkboxes.length, 4, 'deve haver um checkbox por rolo elegível, mais o de selecionar todos');
});

test('27. selecionar 2 de 3 rolos e confirmar move exatamente os selecionados, identificados por número', async () => {
  const { h, calls, toasts, settle } = boot({
    rolos: ROLOS_MISTOS,
    rpcResult: { data: { rolo_ids: [901, 902], quantidade: 2 }, error: null },
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Dar saída para acabamento', node));
  await settle();

  const linhaRolo = (numero) => h.findOne(
    (n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox'
      && n.getAttribute('aria-label') === ('Selecionar rolo ' + numero), h.body);
  marcar(h, linhaRolo('001'), true);
  marcar(h, linhaRolo('002'), true);

  h.click(btn(h, 'Confirmar saída'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'enviar_rolos_acabamento');
  assert.ok(chamada, 'o dono da escrita de saída deve ter sido chamado');
  assert.deepEqual(chamada.params.p_rolo_ids.slice().sort((a, b) => a - b), [901, 902],
    'a chamada deve identificar os ROLOS exatos selecionados, nunca uma contagem abstrata');

  assert.ok(toasts.some((t) => t.kind === 'success' && /Rolos 001, 002 enviados ao acabamento/.test(t.msg)),
    'a confirmação deve identificar QUAIS rolos saíram, nunca apenas "2 rolos saíram"');
});

test('28. Selecionar todos marca e desmarca todos os rolos elegíveis de uma vez', async () => {
  const { h, calls, settle } = boot({
    rolos: ROLOS_MISTOS,
    rpcResult: { data: { rolo_ids: [901, 902, 903], quantidade: 3 }, error: null },
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Dar saída para acabamento', node));
  await settle();

  const todos = h.findOne((n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox'
    && n.getAttribute('aria-label') === 'Selecionar todos os rolos', h.body);
  marcar(h, todos, true);

  h.click(btn(h, 'Confirmar saída'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'enviar_rolos_acabamento');
  assert.deepEqual(chamada.params.p_rolo_ids.slice().sort((a, b) => a - b), [901, 902, 903],
    'Selecionar todos deve incluir exatamente os 3 rolos elegíveis, nunca o já enviado');
});

test('29. confirmar sem selecionar nenhum rolo é recusado no cliente, sem chamar o servidor', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: ROLOS_MISTOS });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Dar saída para acabamento', node));
  await settle();
  h.click(btn(h, 'Confirmar saída'));
  await settle();

  assert.equal(calls.rpc.filter((c) => c.name === 'enviar_rolos_acabamento').length, 0,
    'nada pode ser enviado sem nenhum rolo selecionado');
  assert.ok(toasts.some((t) => t.kind === 'error'), 'o operador deve ser avisado');
});

test('30. uma recusa do servidor (ex.: rolo já não elegível) vira mensagem operacional, nunca sucesso silencioso',
  async () => {
    const { h, toasts, settle } = boot({
      rolos: ROLOS_MISTOS,
      rpcResult: { data: null, error: { message: 'TECELAGEM_ROLO_NAO_ELEGIVEL_PARA_SAIDA' } },
    });
    const node = h.win.screenTecelagemRolos(501, 511);
    await settle();

    h.click(btn(h, 'Dar saída para acabamento', node));
    await settle();
    const linha001 = h.findOne((n) => n.tagName === 'INPUT' && n._attrs && n._attrs.type === 'checkbox'
      && n.getAttribute('aria-label') === 'Selecionar rolo 001', h.body);
    marcar(h, linha001, true);
    h.click(btn(h, 'Confirmar saída'));
    await settle();

    assert.ok(toasts.some((t) => t.kind === 'error' && /não estão mais? na tecelagem|já não estão na tecelagem|Atualize a lista/.test(t.msg)),
      'a recusa deve virar uma frase operacional honesta, nunca um sucesso silencioso');
    assert.ok(!toasts.some((t) => t.kind === 'success'), 'nenhum sucesso pode ser reportado numa chamada recusada');
  });

test('31. o botão de saída fica indisponível quando não há nenhum rolo na_tecelagem', async () => {
  const rolosTodosEnviados = [
    { id: 904, op_item_id: 511, numero: 4, comprimento_m: null, situacao: 'enviado_acabamento' },
  ];
  const { h, settle } = boot({ rolos: rolosTodosEnviados });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const acao = btn(h, 'Dar saída para acabamento', node);
  assert.ok(acao, 'a ação continua visível, para o estado ser legível');
  assert.equal(acao.getAttribute('disabled'), 'disabled',
    'sem nenhum rolo elegível, a ação não pode ser acionável');
});

test('32. MANTA não oferece Dar saída para acabamento em nenhuma tela', async () => {
  const rolosManta = [{ id: 950, op_item_id: 512, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' }];
  const { h, settle } = boot({
    rolos: rolosManta, modelo: MODELO_MANTA, item: Object.assign({}, ITEM, { id: 512, modelo_id: 222 }),
  });
  const node = h.win.screenTecelagemRolos(501, 512);
  await settle();

  assert.equal(btn(h, 'Dar saída para acabamento', node), null,
    'a manta não pode oferecer a ação de saída para o acabamento em nenhuma circunstância');
  const reimprimir = h.findOne((n) => n.tagName === 'BUTTON'
    && n.getAttribute('title') === 'Reimprimir etiqueta do rolo 001', node);
  assert.ok(reimprimir, 'a manta continua com a etiqueta do ROLO normalmente');
});

test('33. imprimir a etiqueta do rolo ou a de acabamento nunca chama o dono da saída, nem muda a situação',
  async () => {
    const rolos = [{ id: 901, op_item_id: 511, numero: 1, comprimento_m: 28.4, situacao: 'na_tecelagem' }];
    const { h, calls, settle } = boot({ rolos, item: ITEM_COM_EMBORRACHAR });
    const node = h.win.screenTecelagemRolos(501, 511);
    await settle();

    h.click(btn(h, 'Etiqueta de acabamento', node));
    await settle();
    h.click(btn(h, 'Imprimir'));
    await settle();

    const reimprimir = h.findOne((n) => n.tagName === 'BUTTON'
      && n.getAttribute('title') === 'Reimprimir etiqueta do rolo 001', node);
    h.click(reimprimir);
    await settle();
    h.click(btn(h, 'Imprimir'));
    await settle();

    assert.equal(calls.rpc.filter((c) => c.name === 'enviar_rolos_acabamento').length, 0,
      'imprimir qualquer etiqueta não pode, em nenhuma circunstância, chamar o dono da saída para o acabamento');
  });

// =====================================================================
// CLAREZA DE UNIDADE E CONFIRMAÇÃO DE QUANTIDADE ALTA
//
// Um operador real digitou 75 querendo dizer «75 metros» e o sistema criou 75
// rolos persistentes. Estes casos provam que a mesma digitação agora comunica
// ROLOS antes de qualquer gravação.
// =====================================================================

const LANCAMENTO_DESFAZIVEL = {
  lancamento_id: 7001, op_id: 501, op_item_id: 511,
  quantidade_rolos: 3, criado_em: '2026-08-04T12:34:00.000Z',
  rolos_atuais: 3, rolos_progredidos: 0,
  numero_inicial: 1, numero_final: 3,
  pode_desfazer: true, motivo_bloqueio: null,
};
const LANCAMENTO_PROGREDIDO = {
  lancamento_id: 7002, op_id: 501, op_item_id: 511,
  quantidade_rolos: 4, criado_em: '2026-08-04T13:00:00.000Z',
  rolos_atuais: 4, rolos_progredidos: 1,
  numero_inicial: 4, numero_final: 7,
  pode_desfazer: false, motivo_bloqueio: 'LANCAMENTO_COM_ROLOS_JA_ENVIADOS',
};

const abrirModalRegistro = async (h, settle) => {
  const node = h.win.screenTecelagemOp(501);
  await settle();
  h.click(btn(h, 'Registrar produção', node));
  await settle();
  return node;
};
const campoQuantidade = (h) =>
  h.findOne((n) => n.tagName === 'INPUT' && n.getAttribute('placeholder') === 'Ex.: 10');

test('34. o campo primário nomeia ROLOS e nega explicitamente a metragem', async () => {
  const { h, settle } = boot({ rolos: [] });
  await abrirModalRegistro(h, settle);

  const texto = h.textOf(h.body);
  assert.match(texto, /Quantidade de rolos produzidos/,
    'o rótulo do campo primário tem de dizer ROLOS');
  assert.match(texto, /Informe a quantidade de rolos, não a metragem/,
    'o campo não pode ser um número nu: a tela precisa negar a metragem por escrito');
  assert.match(texto, /Comprimento de cada rolo \(metros\)/,
    'o campo de comprimento tem de declarar a sua própria unidade, para que os dois não se confundam');
});

test('35. digitar 75 ecoa "75 ROLOS" ANTES de qualquer gravação', async () => {
  const { h, calls, settle } = boot({ rolos: [] });
  await abrirModalRegistro(h, settle);

  h.type(campoQuantidade(h), '75');
  await settle();

  assert.match(h.textOf(h.body), /75 ROLOS/,
    'a unidade tem de ser repetida em caixa alta enquanto o operador digita');
  assert.equal(calls.rpc.filter((c) => c.name === 'registrar_producao_tecelagem').length, 0,
    'o eco é anterior a qualquer persistência');
});

test('36. 75 exige confirmação explícita que repete a unidade, e nada é gravado antes dela', async () => {
  const { h, calls, settle } = boot({ rolos: [] });
  await abrirModalRegistro(h, settle);

  h.type(campoQuantidade(h), '75');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  const texto = h.textOf(h.body);
  assert.match(texto, /VOCÊ ESTÁ REGISTRANDO 75 ROLOS/,
    'a confirmação tem de repetir a unidade exatamente como o produto exige');
  assert.match(texto, /metragem/i,
    'a confirmação tem de nomear o engano metros-versus-rolos que ela existe para impedir');
  assert.equal(calls.rpc.filter((c) => c.name === 'registrar_producao_tecelagem').length, 0,
    'NADA pode ser gravado enquanto a confirmação não for aceita');
});

test('37. confirmada, a quantidade alta é gravada exatamente como digitada', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: [] });
  await abrirModalRegistro(h, settle);

  h.type(campoQuantidade(h), '75');
  h.click(btn(h, 'Registrar produção'));
  await settle();
  h.click(btn(h, 'Sim, registrar 75 rolos'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'registrar_producao_tecelagem');
  assert.ok(chamada, 'a confirmação aceita tem de gravar');
  assert.equal(chamada.params.p_quantidade_rolos, 75,
    'a confirmação não pode reinterpretar o número: 75 rolos continuam 75 rolos');
  assert.ok(toasts.some((t) => /75 rolos registrados/.test(t.msg)));
});

test('38. uma quantidade normal continua sem confirmação extra (a fricção é proporcional)', async () => {
  const { h, calls, settle } = boot({ rolos: [] });
  await abrirModalRegistro(h, settle);

  h.type(campoQuantidade(h), '3');
  h.click(btn(h, 'Registrar produção'));
  await settle();

  assert.ok(!/VOCÊ ESTÁ REGISTRANDO/.test(h.textOf(h.body)),
    'um lote normal não pode exigir um passo a mais');
  const chamada = calls.rpc.find((c) => c.name === 'registrar_producao_tecelagem');
  assert.equal(chamada.params.p_quantidade_rolos, 3);
});

// =====================================================================
// DESFAZER LANÇAMENTO — recuperação normal de um erro de digitação em lote
// =====================================================================

test('39. Ver rolos apresenta o lançamento por fatos de negócio, sem id técnico', async () => {
  const { h, settle } = boot({
    rolos: [{ id: 901, op_item_id: 511, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' }],
    lancamentos: [LANCAMENTO_DESFAZIVEL],
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /Lançamentos de produção/);
  assert.match(texto, /3 rolos/, 'a quantidade do lote tem de estar visível');
  assert.match(texto, /Rolos 001 a 003/, 'a faixa de rolos resultante tem de estar visível');
  assert.match(texto, /04\/08\/2026 às/, 'o momento do registro tem de estar visível');
  assert.ok(!/7001/.test(texto), 'o id técnico do lançamento NUNCA pode chegar ao operador');
});

test('40. desfazer um lançamento chama o dono da escrita com o lançamento certo', async () => {
  const { h, calls, toasts, settle } = boot({
    rolos: [{ id: 901, op_item_id: 511, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' }],
    lancamentos: [LANCAMENTO_DESFAZIVEL],
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Desfazer lançamento', node));
  await settle();
  // O segundo botão de mesmo nome é o de confirmação do diálogo.
  h.click(btn(h, 'Desfazer lançamento'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'desfazer_lancamento_tecelagem');
  assert.ok(chamada, 'o dono da escrita do desfazer tem de ser chamado');
  assert.equal(chamada.params.p_lancamento_id, 7001);
  assert.ok(toasts.some((t) => /Lançamento desfeito/.test(t.msg) && /3 rolos removidos/.test(t.msg)),
    'o operador tem de saber quantos rolos saíram');
});

test('41. um lote que já foi para o acabamento RECUSA o desfazer e explica o motivo', async () => {
  const { h, calls, settle } = boot({
    rolos: [{ id: 901, op_item_id: 511, numero: 4, comprimento_m: null, situacao: 'enviado_acabamento' }],
    lancamentos: [LANCAMENTO_PROGREDIDO],
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  assert.match(h.textOf(node), /já saíram para o acabamento/,
    'a recusa tem de ser explicada, nunca apenas um botão ausente');

  const acao = btn(h, 'Desfazer lançamento', node);
  assert.ok(acao, 'a ação continua visível — é a explicação que a acompanha');
  // el() materializa um atributo booleano como disabled="disabled".
  assert.equal(acao.getAttribute('disabled'), 'disabled',
    'a ação não pode ser acionável para um lote que progrediu');

  h.click(acao);
  await settle();
  assert.equal(calls.rpc.filter((c) => c.name === 'desfazer_lancamento_tecelagem').length, 0,
    'nenhum desfazer pode chegar ao servidor para um lote que já progrediu');
});

test('42. uma recusa do servidor vira mensagem operacional, nunca sucesso silencioso', async () => {
  const { h, toasts, settle } = boot({
    rolos: [{ id: 901, op_item_id: 511, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' }],
    lancamentos: [LANCAMENTO_DESFAZIVEL],
    desfazerResult: { data: null, error: { message: 'TECELAGEM_LANCAMENTO_JA_PROGREDIU' } },
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(btn(h, 'Desfazer lançamento', node));
  await settle();
  h.click(btn(h, 'Desfazer lançamento'));
  await settle();

  assert.ok(toasts.some((t) => t.kind === 'error' && /já saíram para o acabamento/.test(t.msg)),
    'a recusa do servidor tem de virar uma frase operacional');
  assert.ok(!toasts.some((t) => /Lançamento desfeito/.test(t.msg)),
    'uma recusa NUNCA pode ser relatada como sucesso');
});

test('43. um produto sem lançamento nenhum não mostra um card de recuperação vazio', async () => {
  const { h, settle } = boot({ rolos: [], lancamentos: [] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  assert.ok(!/Lançamentos de produção/.test(h.textOf(node)),
    'um card vazio não ensina nada ao operador');
});

test('44. um motivo de bloqueio desconhecido não é escondido nem inventado', async () => {
  const desconhecido = Object.assign({}, LANCAMENTO_PROGREDIDO,
    { motivo_bloqueio: 'CODIGO_NOVO_QUALQUER' });
  const { h, settle } = boot({ rolos: [], lancamentos: [desconhecido] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const texto = h.textOf(node);
  assert.match(texto, /não pode ser desfeito por esta ação/,
    'sem tradução conhecida, a tela declara a recusa sem inventar um motivo');
  assert.ok(!/CODIGO_NOVO_QUALQUER/.test(texto), 'o código cru não vaza para o operador');
});

// =====================================================================
// EXCLUIR ROLO — a segunda correção, independente do desfazer do lote
//
// O cenário exato da ordem: um lançamento de 001..005, todos na tecelagem, e
// o operador exclui SÓ o 003.
// =====================================================================

const CINCO_ROLOS = [1, 2, 3, 4, 5].map((n) => ({
  id: 900 + n, op_item_id: 511, numero: n, comprimento_m: null, situacao: 'na_tecelagem',
}));
const LANCAMENTO_DE_CINCO = Object.assign({}, LANCAMENTO_DESFAZIVEL, {
  quantidade_rolos: 5, rolos_atuais: 5, numero_inicial: 1, numero_final: 5,
});

const acaoRolo = (h, node, numero, tipo) => h.findOne((n) => n.tagName === 'BUTTON'
  && new RegExp(tipo === 'excluir' ? `^Excluir o rolo ${numero}` : `^Reimprimir etiqueta do rolo ${numero}`)
    .test(n.getAttribute('title') || ''), node);

test('45. cada rolo na tecelagem oferece IMPRIMIR e EXCLUIR, lado a lado', async () => {
  const { h, settle } = boot({ rolos: CINCO_ROLOS, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  assert.ok(acaoRolo(h, node, '003', 'imprimir'), 'a reimpressão continua existindo, inalterada');
  assert.ok(acaoRolo(h, node, '003', 'excluir'), 'a exclusão individual tem de existir por rolo');
  assert.equal(
    h.findAll((n) => n.tagName === 'BUTTON' && /^Excluir o rolo/.test(n.getAttribute('title') || ''), node).length,
    5, 'os cinco rolos na tecelagem oferecem a ação');
});

test('46. excluir o rolo 003 confirma identificando o ROLO, sem id técnico', async () => {
  const { h, calls, settle } = boot({ rolos: CINCO_ROLOS, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(acaoRolo(h, node, '003', 'excluir'));
  await settle();

  const texto = h.textOf(h.body);
  assert.match(texto, /Excluir Rolo 003\?/, 'a confirmação tem de identificar o rolo pelo número visível');
  assert.match(texto, /removido do lançamento de produção/);
  assert.ok(!/903/.test(texto), 'o id técnico do rolo NUNCA pode chegar ao operador');
  assert.equal(calls.rpc.filter((c) => c.name === 'excluir_rolo_tecelagem').length, 0,
    'NADA pode ser excluído antes da confirmação');
});

test('47. confirmada, a exclusão envia exatamente o rolo escolhido', async () => {
  const { h, calls, toasts, settle } = boot({ rolos: CINCO_ROLOS, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(acaoRolo(h, node, '003', 'excluir'));
  await settle();
  h.click(btn(h, 'Excluir rolo'));
  await settle();

  const chamada = calls.rpc.find((c) => c.name === 'excluir_rolo_tecelagem');
  assert.ok(chamada, 'o dono da escrita da exclusão tem de ser chamado');
  assert.equal(chamada.params.p_rolo_id, 903, 'tem de viajar o rolo 003, e nenhum outro');
  assert.equal(calls.rpc.filter((c) => c.name === 'desfazer_lancamento_tecelagem').length, 0,
    'excluir UM rolo nunca pode acionar o desfazer do LOTE');
  assert.ok(toasts.some((t) => /Rolo 003 excluído/.test(t.msg)));
});

test('48. um rolo já enviado ao acabamento não pode ser excluído', async () => {
  const rolos = [
    { id: 901, op_item_id: 511, numero: 1, comprimento_m: null, situacao: 'na_tecelagem' },
    { id: 902, op_item_id: 511, numero: 2, comprimento_m: null, situacao: 'enviado_acabamento' },
  ];
  const { h, calls, settle } = boot({ rolos, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  const acao = h.findOne((n) => n.tagName === 'BUTTON'
    && /rolo 002 já saiu para o acabamento/.test(n.getAttribute('title') || ''), node);
  assert.ok(acao, 'a ação continua visível, com o motivo no nome acessível');
  assert.equal(acao.getAttribute('disabled'), 'disabled', 'e não pode ser acionável');

  assert.ok(acaoRolo(h, node, '001', 'excluir'), 'o rolo ainda na tecelagem segue excluível');

  h.click(acao);
  await settle();
  assert.equal(calls.rpc.filter((c) => c.name === 'excluir_rolo_tecelagem').length, 0,
    'nenhuma exclusão pode chegar ao servidor para um rolo já enviado');
});

test('49. uma recusa do servidor vira mensagem operacional, nunca sucesso silencioso', async () => {
  const { h, toasts, settle } = boot({
    rolos: CINCO_ROLOS,
    lancamentos: [LANCAMENTO_DE_CINCO],
    excluirResult: { data: null, error: { message: 'TECELAGEM_ROLO_JA_ENVIADO' } },
  });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(acaoRolo(h, node, '003', 'excluir'));
  await settle();
  h.click(btn(h, 'Excluir rolo'));
  await settle();

  assert.ok(toasts.some((t) => t.kind === 'error' && /já saiu para o acabamento/.test(t.msg)),
    'a recusa do servidor tem de virar uma frase operacional');
  // O texto da recusa também contém "excluído" ("...não pode ser excluído"), então
  // o que prova a ausência de sucesso é a AUSÊNCIA de um toast de sucesso.
  assert.ok(!toasts.some((t) => t.kind === 'success'),
    'uma recusa NUNCA pode ser relatada como sucesso');
  assert.ok(!toasts.some((t) => /^Rolo \d+ excluído\.$/.test(t.msg)),
    'e a frase de confirmação da exclusão não pode aparecer');
});

test('50. as duas correções coexistem: excluir rolo e desfazer lançamento', async () => {
  const { h, calls, settle } = boot({ rolos: CINCO_ROLOS, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  assert.ok(acaoRolo(h, node, '001', 'excluir'), 'a exclusão individual existe');
  assert.ok(btn(h, 'Desfazer lançamento', node), 'e o desfazer do lote inteiro continua existindo');

  h.click(btn(h, 'Desfazer lançamento', node));
  await settle();
  h.click(btn(h, 'Desfazer lançamento'));
  await settle();

  assert.equal(calls.rpc.filter((c) => c.name === 'desfazer_lancamento_tecelagem').length, 1,
    'o desfazer do lote segue funcionando depois de db/127');
  assert.equal(calls.rpc.filter((c) => c.name === 'excluir_rolo_tecelagem').length, 0,
    'e não passa a excluir rolos um a um por baixo dos panos');
});

test('51. a exclusão não toca reimpressão nem saída para acabamento', async () => {
  const { h, calls, opens, settle } = boot({ rolos: CINCO_ROLOS, lancamentos: [LANCAMENTO_DE_CINCO] });
  const node = h.win.screenTecelagemRolos(501, 511);
  await settle();

  h.click(acaoRolo(h, node, '002', 'imprimir'));
  await settle();
  h.click(btn(h, 'Imprimir'));
  await settle();
  assert.equal(opens.length, 1, 'a reimpressão continua abrindo a janela de impressão');
  assert.match(opens[0].html, /Rolo/, 'e continua identificando o rolo');

  assert.ok(btn(h, 'Dar saída para acabamento', node), 'a saída para acabamento continua disponível');
  assert.equal(calls.rpc.filter((c) => c.name === 'excluir_rolo_tecelagem').length, 0,
    'imprimir nunca pode excluir um rolo');
  assert.equal(calls.rpc.filter((c) => c.name === 'enviar_rolos_acabamento').length, 0,
    'nem acionar a saída para o acabamento');
});
