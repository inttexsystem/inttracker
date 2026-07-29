// =====================================================================
// === tests/pedido-alteracao-review.smoke.js ==========================
// Smoke de runtime (vm sandbox + doubles fieis) da tela administrativa
// dedicada de comparacao e decisao de solicitacao de alteracao de Pedido
// (js/screens/pedido-alteracao-review.js) e do seu ponto de entrada no hub
// de detalhe do Pedido.
//
// Fase: PEDIDO-ADMIN-CHANGE-REQUEST-COMPARISON-APPROVAL-R1.
// Contrato: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md :: U10.4.
//
// Cobre, na ordem exigida pela ordem de execucao:
//   A. roteamento (dois UUIDs, admin-only, precedencia, mismatch fecha);
//   B. ponto de entrada no hub de detalhe (pendente / ausente / leitura
//      falhada / zero DML);
//   C. carga da comparacao (uma chamada, payload malformado falha fechado,
//      nenhuma consulta secundaria de itens, nenhum helper owner-only);
//   D. campos de cabecalho (proposta NULL vs proposta ausente, antes/atual/
//      proposto, marcador de atual divergente);
//   E. itens (inserido, removido, modelo/metragem/largura/observacao
//      alterados, reordenado, sem alteracao, marcadores combinados, remocao
//      nunca omitida);
//   F. prioridade (base, atual, proposta, dono canonico reaproveitado);
//   G. aprovacao (RPC exata, sucesso com reload, recusa por base
//      desatualizada, recusa estrutural, confirmacao de impacto de
//      prioridade com UMA unica retentativa, falha de aplicacao em
//      data.ok === false, nenhum sucesso parcial);
//   H. rejeicao (motivo obrigatorio e trimado, RPC exata, uma chamada,
//      reload, Pedido inalterado);
//   I. estados decididos somente-leitura;
//   J. fronteiras (zero escrita no render inicial, zero DML direto,
//      nenhuma entidade completa dentro de modal).
//
// Nao executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FaithfulNode, createDocument, makeFakeSupa } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');

const SCREEN_REL = 'js/screens/pedido-alteracao-review.js';
const screenSrc = read(SCREEN_REL);
const routerSrc = read('js/router.js');
const detailDataSrc = read('js/screens/pedido-detail-data.js');
const detailRenderSrc = read('js/screens/pedido-detail-render.js');
const indexHtml = read('index.html');

const SOURCES = [
  'js/select-popover.js',
  'js/ui.js',
  'js/pedido-ui.js',
  'js/pedido-priority.js',
  'js/pedido-fields.js',
  SCREEN_REL,
].map((rel) => [rel, read(rel)]);

const PID = '11111111-2222-3333-4444-555555555555';
const OTHER_PID = '99999999-8888-7777-6666-555555555555';
const SID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ---------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------

class ReviewNode extends FaithfulNode {
  setAttribute(name, value) {
    const coerced = (name === 'style' || typeof value === 'string') ? value : String(value);
    super.setAttribute(name, coerced);
    if (name === 'value') this.value = coerced;
  }
}

function allByTag(root, tag) {
  const wanted = String(tag).toUpperCase();
  const out = [];
  (function walk(node) {
    if (!node || !node.children) return;
    if (node.tagName === wanted) out.push(node);
    node.children.forEach(walk);
  })(root);
  return out;
}

function allWithAttr(root, attr, value) {
  const out = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c && c._attrs && Object.prototype.hasOwnProperty.call(c._attrs, attr)) {
        if (value == null || String(c._attrs[attr]) === String(value)) out.push(c);
      }
      if (c && c.children) walk(c);
    }
  })(root);
  return out;
}

function oneWithAttr(root, attr, value) {
  const hits = allWithAttr(root, attr, value);
  return hits[0] || null;
}

function findButtonByText(root, re) {
  return allByTag(root, 'button').find((b) => re.test(b.textContent));
}

function item(over) {
  return Object.assign({
    pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris',
    metros: '2.00', largura: null, observacao: null, ordem: 0,
  }, over || {});
}

function snapshot(over) {
  return Object.assign({
    pedido_id: PID, revisao: 5, status: 'confirmado', data_pedido: '2026-07-01',
    prazo_entrega: '2026-08-01', referencia_cliente: 'PO-1', tipo_recebimento: 'entrega',
    observacao: 'observacao aceita', prioridade_status: 'nenhuma', prioridade_observacao: null,
    metros_total: 5,
    itens: [
      item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 }),
      item({ pedido_item_id: 'it-2', modelo_id: 2, modelo_nome: 'Roma', metros: '3.00', ordem: 1 }),
    ],
  }, over || {});
}

function solicitacao(over) {
  return Object.assign({
    id: SID, pedido_id: PID, status: 'pendente',
    solicitante_id: 'ffffffff-1111-2222-3333-444444444444', solicitante_papel: 'cliente',
    base_revisao: 5, criado_em: '2026-07-20T13:00:00Z',
    decidido_em: null, decidido_por: null, decisao_motivo: null, falha_identificador: null,
    mensagem_cliente: 'Preciso antecipar o prazo.',
    campos_alterados: ['prazo_entrega'], itens_propostos: false, prioridade_proposta: false,
  }, over || {});
}

function comparison(over) {
  const o = over || {};
  return Object.assign({
    ok: true,
    solicitacao: solicitacao(o.solicitacao),
    antes: snapshot(o.antes),
    atual: snapshot(o.atual),
    proposto_header: Object.prototype.hasOwnProperty.call(o, 'proposto_header')
      ? o.proposto_header : { prazo_entrega: '2026-07-25' },
    proposto_itens: o.proposto_itens || [],
    impacto: Object.assign({
      tem_op_relacionada: false, revisao_atual: 5, base_desatualizada: false,
    }, o.impacto || {}),
  }, o.raw || {});
}

async function boot(opts) {
  const o = opts || {};
  const document = createDocument();
  document.createElement = (tag) => new ReviewNode(tag);

  // Fila de payloads: a PRIMEIRA carga consome o primeiro; cada recarga
  // consome o proximo e o ultimo permanece, exatamente como o banco real
  // devolve o estado corrente a cada leitura.
  const queue = (o.comparisons || [comparison(o.comparison)]).slice();
  const rpcCalls = [];
  let comparisonErrorPending = Object.prototype.hasOwnProperty.call(o, 'comparisonError');

  const rpcImpl = Object.assign({
    admin_alteracao_comparacao: () => {
      if (comparisonErrorPending) {
        comparisonErrorPending = false;
        return { data: null, error: { message: o.comparisonError } };
      }
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return { data: next, error: null };
    },
  }, o.rpcImpl || {});

  const wrappedRpc = {};
  for (const [name, fn] of Object.entries(rpcImpl)) {
    wrappedRpc[name] = (params) => { rpcCalls.push({ name, params }); return fn(params); };
  }

  const supa = makeFakeSupa({ tableData: o.tableData || {}, rpcImpl: wrappedRpc });

  const sandbox = { window: {}, document, console, Node: ReviewNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = supa;
  sandbox.ADMIN_MENU = [];
  sandbox.shellLayout = (menu, content) => content;
  sandbox.navigate = (hash) => { (sandbox.__navigated = sandbox.__navigated || []).push(hash); };
  sandbox.requestAnimationFrame = (fn) => fn();
  vm.createContext(sandbox);
  for (const [rel, src] of SOURCES) vm.runInContext(src, sandbox, { filename: rel });
  // js/ui.js declara o seu proprio toast() de topo, que (re)liga
  // window.toast quando o script roda — o stub tem de vir DEPOIS do loop.
  sandbox.toast = (msg, tone) => { (sandbox.__toasts = sandbox.__toasts || []).push({ msg, tone }); };

  const pedidoArg = o.pedidoId || PID;
  const root = await vm.runInContext(
    `window.screenPedidoAlteracaoReview(${JSON.stringify(pedidoArg)}, ${JSON.stringify(o.solicitacaoId || SID)})`,
    sandbox
  );
  return { sandbox, root, supa, document, rpcCalls };
}

function overlays(document) {
  return (document.body.children || []).filter((n) => n && !n._removed);
}

function modalButton(document, re) {
  for (const overlay of overlays(document)) {
    const btn = findButtonByText(overlay, re);
    if (btn) return btn;
  }
  return null;
}

function writeOps(supa) {
  return supa._calls.filter((c) => ['insert', 'update', 'delete', 'upsert'].includes(c.op));
}

// ---------------------------------------------------------------------
// A. Roteamento
// ---------------------------------------------------------------------

function bootRouter() {
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.location = { hash: '' };
  sandbox.__calls = [];
  sandbox.screenPedidoAlteracaoReview = (a, b) => { sandbox.__calls.push(['review', a, b]); return 'review'; };
  sandbox.screenPedidoDetalhe = (a) => { sandbox.__calls.push(['detalhe', a]); return 'detalhe'; };
  sandbox.screenPedidoEditar = (a) => { sandbox.__calls.push(['editar', a]); return 'editar'; };
  vm.createContext(sandbox);
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  sandbox.RAVATEX_ROUTER.setRoutes({});
  return sandbox;
}

test('A1. matchRoute resolve #/pedidos/<uuid>/alteracoes/<uuid> para a tela de revisao, admin-only', () => {
  const s = bootRouter();
  const route = s.matchRoute('#/pedidos/' + PID + '/alteracoes/' + SID);
  assert.ok(route, 'a rota de dois UUIDs deve casar');
  // `route.roles` nasce no vm.Context (outro realm), entao deepEqual recusaria
  // um array estruturalmente identico so por prototype mismatch.
  assert.equal(JSON.stringify(route.roles), JSON.stringify(['admin']),
    'a rota e exclusivamente admin');
  assert.equal(route.public, undefined, 'a rota nunca e publica');
  assert.equal(route.render(), 'review');
  assert.deepEqual(s.__calls, [['review', PID, SID]],
    'render deve chamar screenPedidoAlteracaoReview com os DOIS identificadores da rota');
});

test('A2. papel cliente e papel fornecedor NAO alcancam a rota de revisao', () => {
  const s = bootRouter();
  const route = s.matchRoute('#/pedidos/' + PID + '/alteracoes/' + SID);
  assert.equal(route.roles.includes('cliente'), false);
  assert.equal(route.roles.includes('fornecedor'), false);
  // handleRoute() aplica a lista por inclusao: qualquer papel fora dela cai em
  // screenForbidden. Provamos a regra na sua fonte, o array de papeis.
  assert.match(routerSrc, /route\.roles\s*&&\s*!route\.roles\.includes\(window\.CURRENT_USER\.tipo\)/,
    'handleRoute deve negar por inclusao de papel');
});

test('A3. identificadores nao-UUID nao casam a rota, em NENHUMA das duas posicoes', () => {
  const s = bootRouter();
  assert.equal(s.matchRoute('#/pedidos/123/alteracoes/' + SID), null);
  assert.equal(s.matchRoute('#/pedidos/' + PID + '/alteracoes/abc'), null);
  assert.equal(s.matchRoute('#/pedidos/' + PID + '/alteracoes/'), null);
  assert.equal(s.matchRoute('#/pedidos/' + PID + '/alteracoes/' + SID + '/extra'), null);
});

test('A4. a rota de revisao PRECEDE a rota generica de detalhe do Pedido', () => {
  const s = bootRouter();
  // Comportamento: o caminho de revisao nunca cai no detalhe.
  s.matchRoute('#/pedidos/' + PID + '/alteracoes/' + SID).render();
  assert.deepEqual(s.__calls.map((c) => c[0]), ['review']);
  // E o detalhe generico continua funcionando.
  assert.equal(s.matchRoute('#/pedidos/' + PID).render(), 'detalhe');
  // Precedencia declarada na fonte: o match de /alteracoes/ vem ANTES do
  // match ancorado do detalhe.
  const idxAlteracao = routerSrc.indexOf('\\/alteracoes\\/');
  const idxDetalhe = routerSrc.indexOf('screenPedidoDetalhe');
  assert.ok(idxAlteracao > 0, 'o match de /alteracoes/ deve existir em router.js');
  assert.ok(idxAlteracao < idxDetalhe,
    'o match de /alteracoes/ deve ser declarado antes do match generico de detalhe');
});

test('A5. o Pedido da rota tem de ser o Pedido da solicitacao; divergencia FALHA FECHADA', async () => {
  const { sandbox, supa } = await boot({ pedidoId: OTHER_PID });
  assert.ok((sandbox.__navigated || []).includes('#/pedidos/' + OTHER_PID),
    'a divergencia deve retornar ao hub de detalhe do Pedido da rota');
  assert.ok((sandbox.__toasts || []).some((t) => /n.o pertence a este pedido/i.test(t.msg)));
  assert.deepEqual(writeOps(supa), [], 'a divergencia nunca escreve');
  const rpcs = supa._calls.filter((c) => c.op === 'rpc').map((c) => c.name);
  assert.deepEqual(rpcs, ['admin_alteracao_comparacao'],
    'a divergencia e detectada pela unica leitura autorizada, sem nenhuma outra chamada');
});

test('A6. index.html registra e cache-tokeniza o modulo novo exatamente uma vez, depois dos seus donos', () => {
  const hits = indexHtml.match(new RegExp('js/screens/pedido-alteracao-review\\.js\\?v=[^"]+', 'g')) || [];
  assert.equal(hits.length, 1, 'o modulo deve ser carregado exatamente uma vez, com ?v=');
  assert.match(hits[0], /\?v=20260729-pedido-admin-change-request-comparison-approval-r1$/);
  const idxOf = (rel) => indexHtml.indexOf('<script src="' + rel + '?v=');
  for (const dono of ['js/ui.js', 'js/pedido-ui.js', 'js/pedido-priority.js', 'js/pedido-fields.js']) {
    assert.ok(idxOf(dono) > 0 && idxOf(dono) < idxOf(SCREEN_REL),
      SCREEN_REL + ' deve ser carregado depois de ' + dono);
  }
  assert.ok(idxOf(SCREEN_REL) < indexHtml.indexOf('<script src="js/boot.js'),
    SCREEN_REL + ' deve ser carregado antes de js/boot.js');
});

// ---------------------------------------------------------------------
// B. Ponto de entrada no hub de detalhe do Pedido
// ---------------------------------------------------------------------

function bootDetailRender() {
  const document = createDocument();
  document.createElement = (tag) => new ReviewNode(tag);
  const sandbox = { window: {}, document, console, Node: ReviewNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.navigate = (hash) => { (sandbox.__navigated = sandbox.__navigated || []).push(hash); };
  vm.createContext(sandbox);
  for (const rel of ['js/select-popover.js', 'js/ui.js', 'js/pedido-ui.js', 'js/pedido-priority.js',
    'js/screens/pedido-detail.js', 'js/screens/pedido-detail-render.js']) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  return sandbox;
}

test('B1. uma solicitacao pendente produz UMA acao de revisao apontando para a rota exata', () => {
  const s = bootDetailRender();
  const state = s.RAVATEX_SCREENS.pedidoDetail.createInitialState();
  state.pedido = { id: PID, numero: 42 };
  state.alteracaoPendente = { id: SID, status: 'pendente', criado_em: '2026-07-20T13:00:00Z' };
  const node = s.RAVATEX_SCREENS.pedidoDetail.buildAlteracaoPendenteEntry(state);
  assert.ok(node, 'o aviso do ponto de entrada deve existir');
  assert.equal(node.getAttribute('data-rv-alteracao-entry'), 'pendente');
  const actions = allWithAttr(node, 'data-rv-alteracao-entry-action');
  assert.equal(actions.length, 1, 'exatamente UMA acao de revisao');
  assert.equal(actions[0].textContent, 'Revisar solicitação de alteração');
  actions[0]._listeners.click();
  assert.deepEqual(s.__navigated, ['#/pedidos/' + PID + '/alteracoes/' + SID]);
});

test('B2. sem solicitacao pendente NAO existe acao de revisao', () => {
  const s = bootDetailRender();
  const state = s.RAVATEX_SCREENS.pedidoDetail.createInitialState();
  state.pedido = { id: PID, numero: 42 };
  state.alteracaoPendente = null;
  assert.equal(s.RAVATEX_SCREENS.pedidoDetail.buildAlteracaoPendenteEntry(state), null,
    'sem pendente, nenhum no e produzido');
});

test('B3. leitura falhada NAO fabrica ausencia e NAO derruba o detalhe do Pedido', () => {
  const s = bootDetailRender();
  const state = s.RAVATEX_SCREENS.pedidoDetail.createInitialState();
  state.pedido = { id: PID, numero: 42 };
  state.alteracaoPendente = null;
  state.alteracaoPendenteLoadError = true;
  const node = s.RAVATEX_SCREENS.pedidoDetail.buildAlteracaoPendenteEntry(state);
  assert.ok(node, 'a falha de leitura tem de ser visivel');
  assert.equal(node.getAttribute('data-rv-alteracao-entry'), 'indisponivel');
  assert.match(node.textContent, /n.o e poss.vel afirmar que\s+n.o existe solicitacao pendente/i);
  assert.equal(allWithAttr(node, 'data-rv-alteracao-entry-action').length, 0,
    'uma leitura falhada nunca oferece a acao de revisao');
});

test('B4. a descoberta e um SELECT administrativo MINIMO, sem NENHUM DML', async () => {
  const document = createDocument();
  document.createElement = (tag) => new ReviewNode(tag);
  const supa = makeFakeSupa({
    tableData: {
      pedidos: [{ id: PID, numero: 42, status: 'confirmado', cliente: { id: 1, nome: 'ACME' } }],
      pedido_alteracao_solicitacoes: [{ id: SID, status: 'pendente', criado_em: '2026-07-20T13:00:00Z' }],
    },
  });
  const sandbox = { window: {}, document, console, Node: ReviewNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = supa;
  vm.createContext(sandbox);
  for (const rel of ['js/select-popover.js', 'js/ui.js', 'js/pedido-ui.js',
    'js/screens/ordem-compra-receipt-cutover.js', 'js/screens/pedido-detail.js',
    'js/screens/pedido-detail-data.js']) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  sandbox.toast = () => {};
  const ns = sandbox.RAVATEX_SCREENS.pedidoDetail;
  const state = ns.createInitialState();
  await vm.runInContext('(state) => window.RAVATEX_SCREENS.pedidoDetail.loadPedidoDetailData('
    + JSON.stringify(PID) + ', state)', sandbox)(state);

  assert.deepEqual(writeOps(supa), [], 'o detalhe do Pedido nunca escreve nas tabelas de solicitacao');
  const alteracaoCalls = supa._calls.filter((c) => c.table === 'pedido_alteracao_solicitacoes');
  const ops = alteracaoCalls.map((c) => c.op);
  assert.ok(ops.includes('select'), 'deve haver um SELECT');
  assert.deepEqual(ops.filter((op) => !['from', 'select', 'eq'].includes(op)), [],
    'somente from/select/eq sao permitidos nesta tabela');
  const select = alteracaoCalls.find((c) => c.op === 'select');
  assert.equal(select.cols, 'id, status, criado_em',
    'exatamente os TRES campos minimos, e nenhum outro');
  const filtros = alteracaoCalls.filter((c) => c.op === 'eq').map((c) => c.col + '=' + c.val);
  assert.deepEqual(filtros, ['pedido_id=' + PID, 'status=pendente']);
  assert.equal(state.alteracaoPendente.id, SID);
  assert.equal(state.alteracaoPendenteLoadError, false);
  // A tabela de itens da solicitacao NUNCA e lida pelo hub.
  assert.equal(supa._calls.some((c) => c.table === 'pedido_alteracao_solicitacao_itens'), false);
});

test('B5. o hub nao contem NENHUM insert/update/delete sobre as tabelas de solicitacao', () => {
  for (const src of [detailDataSrc, detailRenderSrc]) {
    const trechos = src.split('pedido_alteracao_solicitac');
    assert.ok(trechos.length >= 2 || src === detailRenderSrc,
      'a fonte de dados deve mencionar a tabela de solicitacao');
    assert.doesNotMatch(src, /pedido_alteracao_solicitac[a-z_]*'\s*\)\s*\n?\s*\.(insert|update|delete|upsert)/,
      'nenhum DML direto sobre as tabelas de solicitacao');
  }
});

// ---------------------------------------------------------------------
// C. Carga da comparacao
// ---------------------------------------------------------------------

test('C1. admin_alteracao_comparacao e chamada EXATAMENTE uma vez por carga', async () => {
  const { supa } = await boot({});
  const calls = supa._calls.filter((c) => c.op === 'rpc' && c.name === 'admin_alteracao_comparacao');
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls[0].params), JSON.stringify({ p_solicitacao_id: SID }));
});

test('C2. a tela le a comparacao SOMENTE pela RPC dona: nenhuma tabela, nenhum helper owner-only', () => {
  const rpcNames = Array.from(new Set(
    (screenSrc.match(/rpc\('([a-z_]+)'/g) || []).map((m) => m.replace(/^rpc\('/, '').replace(/'$/, ''))
  )).sort();
  assert.deepEqual(rpcNames,
    ['admin_alteracao_comparacao', 'aprovar_alteracao_pedido', 'rejeitar_alteracao_pedido'],
    'a tela chama EXATAMENTE as tres RPCs publicas autorizadas');
  assert.doesNotMatch(screenSrc, /\.from\(/,
    'a tela nunca acessa tabela diretamente — nem para ler');
  assert.doesNotMatch(screenSrc, /rpc\('(pedido_snapshot|pedido_tem_op_relacionada|pedido_itens_[a-z_]+|pedido_header_[a-z_]+|pedido_prioridade_aplicar|diagnosticar_impacto_pedido|definir_prioridade_pedido)'/,
    'nenhum helper owner-only nem a RPC de prioridade e chamado diretamente');
});

test('C3. payload malformado (objeto de topo ausente) FALHA FECHADA, sem acoes', async () => {
  const semAtual = comparison({});
  delete semAtual.atual;
  const { root } = await boot({ comparisons: [semAtual] });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'payload-malformado'),
    'deve declarar a comparacao indisponivel');
  assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0,
    'sem comparacao completa nao existe rodape de decisao');
  assert.equal(allWithAttr(root, 'data-rv-alteracao-approve').length, 0);
  assert.equal(allWithAttr(root, 'data-rv-alteracao-reject').length, 0);
});

test('C4. proposto_itens nao-array tambem FALHA FECHADA', async () => {
  const mau = comparison({});
  mau.proposto_itens = { 0: item({}) };
  const { root } = await boot({ comparisons: [mau] });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'payload-malformado'));
});

test('C5. ok:false devolve a recusa estavel e nao renderiza comparacao alguma', async () => {
  const { root } = await boot({ comparisons: [{ ok: false, erro: 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND' }] });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'recusada'));
  assert.equal(allWithAttr(root, 'data-rv-alteracao-header-diff').length, 0);
});

test('C6. erro de transporte na leitura nao inventa comparacao', async () => {
  const { root } = await boot({ comparisonError: 'network down' });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'erro-leitura'));
  assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0);
});

test('C7. o solicitante e apresentado por PAPEL sanitizado e identificador abreviado', async () => {
  const { root } = await boot({});
  const bloco = oneWithAttr(root, 'data-rv-alteracao-solicitante');
  assert.ok(bloco);
  assert.match(bloco.textContent, /Cliente/);
  assert.match(bloco.textContent, /identificador ffffffff/);
  assert.doesNotMatch(bloco.textContent, /ffffffff-1111-2222-3333-444444444444/,
    'o UUID completo do solicitante nao e exibido');
  assert.match(bloco.textContent, /Preciso antecipar o prazo\./);
});

// ---------------------------------------------------------------------
// D. Dados gerais
// ---------------------------------------------------------------------

test('D1. antes, atual e proposto aparecem por campo; campo sem proposta e explicitamente "sem alteracao"', async () => {
  const { root } = await boot({});
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-antes', 'prazo_entrega').textContent, '01/08/2026');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-atual', 'prazo_entrega').textContent, '01/08/2026');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-proposto', 'prazo_entrega').textContent, '25/07/2026');
  for (const campo of ['referencia_cliente', 'tipo_recebimento', 'observacao']) {
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-sem-proposta', campo),
      campo + ' nao foi proposto e tem de aparecer como sem proposta');
    assert.equal(oneWithAttr(root, 'data-rv-alteracao-proposto', campo), null);
  }
  // Os QUATRO campos permitidos ao Cliente, e nenhum outro.
  const campos = allWithAttr(root, 'data-rv-alteracao-header-field')
    .map((n) => n.getAttribute('data-rv-alteracao-header-field'));
  assert.deepEqual(campos, ['prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao']);
  assert.equal(campos.includes('data_pedido'), false, 'data_pedido nunca e comparado');
});

test('D2. proposta para NULL e distinguivel de "nao proposto"', async () => {
  const { root } = await boot({
    comparisons: [comparison({
      solicitacao: { campos_alterados: ['referencia_cliente'] },
      proposto_header: { referencia_cliente: null },
    })],
  });
  const proposto = oneWithAttr(root, 'data-rv-alteracao-proposto', 'referencia_cliente');
  assert.ok(proposto, 'a proposta existe, ainda que o valor seja NULL');
  assert.equal(proposto.textContent, '(vazio)');
  assert.equal(proposto.getAttribute('data-rv-alteracao-proposto-nulo'), '1');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-sem-proposta', 'referencia_cliente'), null,
    'uma proposta para NULL nunca pode ser lida como ausencia de proposta');
  // E o contraste: um campo REALMENTE nao proposto.
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-sem-proposta', 'observacao'));
});

test('D3. atual divergente da imagem-anterior ganha marcador de "mudou desde a criacao"', async () => {
  const { root } = await boot({
    comparisons: [comparison({
      atual: { referencia_cliente: 'PO-2-ALTERADO' },
      impacto: { base_desatualizada: true, revisao_atual: 6 },
    })],
  });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-atual-divergente', 'referencia_cliente'),
    'o campo cujo valor vivo mudou tem de ser marcado');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-atual-divergente', 'prazo_entrega'), null,
    'um campo inalterado nao pode ser marcado');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-atual', 'referencia_cliente').textContent
    .includes('PO-2-ALTERADO'), true);
});

// ---------------------------------------------------------------------
// E. Colecao de itens
// ---------------------------------------------------------------------

function itemRows(root) {
  return allWithAttr(root, 'data-rv-alteracao-item-row').map((n) => ({
    id: n.getAttribute('data-rv-alteracao-item-row'),
    marks: String(n.getAttribute('data-rv-alteracao-item-markers')).split(','),
    text: n.textContent,
  }));
}

const ITENS_PROPOSTOS_BASE = {
  solicitacao: { itens_propostos: true, campos_alterados: [] },
  proposto_header: {},
};

test('E1. item inserido (pedido_item_id NULL) e marcado Inserido', async () => {
  const { root } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      proposto_itens: [
        item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 }),
        item({ pedido_item_id: 'it-2', modelo_id: 2, modelo_nome: 'Roma', metros: '3.00', ordem: 1 }),
        item({ pedido_item_id: null, modelo_id: 3, modelo_nome: 'Lisboa', metros: '4.00', ordem: 2 }),
      ],
    }))],
  });
  const rows = itemRows(root);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2].marks, ['Inserido']);
  assert.match(rows[2].text, /Lisboa/);
  assert.deepEqual(rows[0].marks, ['Sem alteracao']);
});

test('E2. item removido NUNCA e omitido e e marcado Removido', async () => {
  const { root } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      proposto_itens: [item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 })],
    }))],
  });
  const rows = itemRows(root);
  assert.equal(rows.length, 2, 'a linha removida continua visivel');
  const removida = rows.find((r) => r.id === 'it-2');
  assert.ok(removida, 'it-2 esta ausente da proposta e tem de aparecer como remocao');
  assert.deepEqual(removida.marks, ['Removido']);
  assert.match(removida.text, /Roma/);
});

test('E3. modelo, metragem, largura e observacao alterados sao marcados Alterado com o valor anterior', async () => {
  const { root } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      proposto_itens: [
        item({ pedido_item_id: 'it-1', modelo_id: 7, modelo_nome: 'Lisboa', metros: '2.00', ordem: 0 }),
        item({ pedido_item_id: 'it-2', modelo_id: 2, modelo_nome: 'Roma', metros: '9.50', largura: '2.10', observacao: 'sem emenda', ordem: 1 }),
      ],
    }))],
  });
  const rows = itemRows(root);
  const a = rows.find((r) => r.id === 'it-1');
  const b = rows.find((r) => r.id === 'it-2');
  assert.ok(a.marks.includes('Alterado'), 'modelo trocado e alteracao');
  assert.match(a.text, /Lisboa/);
  assert.match(a.text, /antes: Paris/);
  assert.ok(b.marks.includes('Alterado'), 'metragem/largura/observacao alteradas sao alteracao');
  assert.match(b.text, /9,50 m/);
  assert.match(b.text, /antes: 3,00 m/);
  assert.match(b.text, /2,10 m/);
  assert.match(b.text, /sem emenda/);
});

test('E4. reordenacao e marcada Reordenado, e pode combinar com Alterado', async () => {
  const { root } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      proposto_itens: [
        item({ pedido_item_id: 'it-2', modelo_id: 2, modelo_nome: 'Roma', metros: '3.00', ordem: 0 }),
        item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '5.00', ordem: 1 }),
      ],
    }))],
  });
  const rows = itemRows(root);
  assert.deepEqual(rows.map((r) => r.id), ['it-2', 'it-1'], 'as linhas seguem a ordem PROPOSTA');
  assert.deepEqual(rows[0].marks, ['Reordenado']);
  assert.deepEqual(rows[1].marks.sort(), ['Alterado', 'Reordenado']);
  assert.match(rows[1].text, /antes: 1/, 'a posicao anterior fica visivel');
});

test('E5. sem colecao proposta, a tela mostra a colecao viva como contexto e nao inventa proposta', async () => {
  const { root } = await boot({});
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-itens-propostos').getAttribute('data-rv-alteracao-itens-propostos'), '0');
  const rows = itemRows(root);
  assert.equal(rows.length, 2);
  rows.forEach((r) => assert.deepEqual(r.marks, ['Sem alteracao']));
});

test('E6. um item que existe SOMENTE na colecao viva e ausente da proposta tambem aparece como remocao', async () => {
  const { root } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      antes: { itens: [item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 })] },
      atual: {
        itens: [
          item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 }),
          item({ pedido_item_id: 'it-9', modelo_id: 9, modelo_nome: 'Porto', metros: '1.00', ordem: 1 }),
        ],
      },
      proposto_itens: [item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 })],
    }))],
  });
  const rows = itemRows(root);
  const viva = rows.find((r) => r.id === 'it-9');
  assert.ok(viva, 'a linha viva ausente da proposta nao pode desaparecer');
  assert.deepEqual(viva.marks, ['Removido']);
});

// ---------------------------------------------------------------------
// F. Prioridade
// ---------------------------------------------------------------------

test('F1. base, atual e proposta sao renderizadas pelo dono canonico read-only', async () => {
  const { root } = await boot({
    comparisons: [comparison({
      antes: { prioridade_status: 'confirmada' },
      atual: { prioridade_status: 'confirmada' },
      solicitacao: { prioridade_proposta: true, itens_propostos: true, campos_alterados: [] },
      proposto_header: {},
      proposto_itens: [
        item({ pedido_item_id: 'it-2', modelo_id: 2, modelo_nome: 'Roma', metros: '3.00', ordem: 0 }),
        item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 1 }),
      ],
    })],
  });
  const blocos = allWithAttr(root, 'data-rv-alteracao-prioridade-block')
    .map((n) => n.getAttribute('data-rv-alteracao-prioridade-block'));
  assert.deepEqual(blocos, ['base', 'atual', 'proposto']);
  // O dono canonico js/pedido-priority.js e quem constroi a sequencia.
  const sequencias = allWithAttr(root, 'data-pedido-priority-sequence');
  assert.equal(sequencias.length, 3, 'as tres sequencias vem de RAVATEX_PEDIDO_PRIORITY.buildSequence');
  // Somente leitura: nenhuma sequencia expoe controles de movimentacao.
  assert.equal(allWithAttr(root, 'data-pedido-priority-move').length, 0);
  const status = allWithAttr(root, 'data-rv-alteracao-prioridade-status').map((n) => n.textContent);
  assert.deepEqual(status, [
    'Prioridade confirmada', 'Prioridade confirmada', 'Prioridade solicitada pelo cliente',
  ]);
  // A sequencia proposta segue a ordem PROPOSTA.
  const propostoBloco = oneWithAttr(root, 'data-rv-alteracao-prioridade-block', 'proposto');
  const linhas = allWithAttr(propostoBloco, 'data-pedido-priority-row');
  assert.equal(linhas.length, 2);
  assert.match(linhas[0].textContent, /Roma/);
});

test('F2. a tela NUNCA chama definir_prioridade_pedido nem cria segunda implementacao de prioridade', async () => {
  const { supa } = await boot({});
  assert.equal(supa._calls.some((c) => c.op === 'rpc' && c.name === 'definir_prioridade_pedido'), false);
  assert.match(screenSrc, /RAVATEX_PEDIDO_PRIORITY/, 'a tela consome o dono canonico');
  assert.match(screenSrc, /api\.buildSequence\(/, 'a sequencia vem do dono canonico');
});

// ---------------------------------------------------------------------
// G. Aprovacao
// ---------------------------------------------------------------------

test('G1. base_desatualizada = true bloqueia Aprovar, mantem Rejeitar e mostra aviso bloqueante', async () => {
  const { root } = await boot({
    comparisons: [comparison({ impacto: { base_desatualizada: true, revisao_atual: 9 } })],
  });
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'base-desatualizada'));
  const approve = oneWithAttr(root, 'data-rv-alteracao-approve');
  const reject = oneWithAttr(root, 'data-rv-alteracao-reject');
  assert.equal(approve.getAttribute('disabled'), 'disabled', 'Aprovar fica desabilitado pelo estado do servidor');
  assert.equal(approve._listeners.click, undefined, 'um Aprovar desabilitado nao carrega handler');
  assert.equal(reject.getAttribute('disabled'), null, 'Rejeitar permanece disponivel');
  assert.ok(reject._listeners.click);
});

test('G2. producao vinculada mostra cautela sem expor NENHUM detalhe de OP', async () => {
  const { root } = await boot({
    comparisons: [comparison({ impacto: { tem_op_relacionada: true } })],
  });
  const aviso = oneWithAttr(root, 'data-rv-alteracao-notice', 'op-relacionada');
  assert.ok(aviso);
  assert.doesNotMatch(root.textContent, /\bOP-\d|\blote\b|romaneio|expedi..o n|fornecedor/i,
    'nenhuma linha de OP, lote ou expedicao pode ser exibida');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-approve').getAttribute('disabled'), null,
    'a tela nao decide elegibilidade: Aprovar continua habilitado e o servidor decide');
});

test('G3. sem base desatualizada e sem producao, o aviso e neutro', async () => {
  const { root } = await boot({});
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'revisao-neutra'));
});

test('G4. Aprovar abre modal de confirmacao e chama aprovar_alteracao_pedido com a forma EXATA', async () => {
  let captured = null;
  const aprovada = comparison({
    solicitacao: { status: 'aprovada', decidido_em: '2026-07-21T10:00:00Z', decisao_motivo: 'Prazo viavel' },
  });
  const { root, document, supa } = await boot({
    comparisons: [comparison({}), aprovada],
    rpcImpl: {
      aprovar_alteracao_pedido: (params) => { captured = params; return { data: { ok: true, status: 'aprovada' }, error: null }; },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Aprovar solicitacao$/));
  assert.ok(modal, 'o modal de confirmacao de aprovacao deve abrir');
  const motivo = allByTag(modal, 'textarea')[0];
  assert.ok(motivo, 'o modal oferece o motivo administrativo OPCIONAL');
  motivo.value = '  Prazo viavel  ';
  await findButtonByText(modal, /^Aprovar solicitacao$/)._listeners.click();

  assert.ok(captured, 'aprovar_alteracao_pedido deveria ter sido chamada');
  assert.deepEqual(Object.keys(captured).sort(),
    ['p_confirmar_impacto', 'p_motivo', 'p_solicitacao_id']);
  assert.equal(captured.p_solicitacao_id, SID);
  assert.equal(captured.p_confirmar_impacto, false, 'a primeira chamada NUNCA confirma impacto');
  assert.equal(captured.p_motivo, 'Prazo viavel');
  assert.equal(supa._calls.filter((c) => c.op === 'rpc' && c.name === 'aprovar_alteracao_pedido').length, 1);
  assert.deepEqual(writeOps(supa), [], 'nenhum DML direto');
});

test('G5. aprovacao bem-sucedida recarrega, vira somente-leitura e as acoes desaparecem', async () => {
  const aprovada = comparison({
    solicitacao: { status: 'aprovada', decidido_em: '2026-07-21T10:00:00Z', decisao_motivo: 'Prazo viavel' },
  });
  const { root, document, supa, sandbox } = await boot({
    comparisons: [comparison({}), aprovada],
    rpcImpl: { aprovar_alteracao_pedido: () => ({ data: { ok: true, status: 'aprovada' }, error: null }) },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();

  assert.equal(supa._calls.filter((c) => c.op === 'rpc' && c.name === 'admin_alteracao_comparacao').length, 2,
    'o sucesso so e afirmado depois de UMA recarga da comparacao');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'aprovada');
  assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0, 'o rodape de decisao desaparece');
  assert.equal(allWithAttr(root, 'data-rv-alteracao-approve').length, 0);
  assert.equal(allWithAttr(root, 'data-rv-alteracao-reject').length, 0);
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'aprovada'));
  assert.ok(findButtonByText(root, /Voltar para o pedido/), 'a acao de retorno permanece');
  assert.ok((sandbox.__toasts || []).some((t) => t.tone === 'success'));
  // A comparacao completa continua na pagina.
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-header-diff'));
});

test('G6. se a recarga NAO confirmar o estado decidido, nenhum sucesso e afirmado', async () => {
  const { root, document, sandbox } = await boot({
    comparisons: [comparison({}), comparison({})],
    rpcImpl: { aprovar_alteracao_pedido: () => ({ data: { ok: true, status: 'aprovada' }, error: null }) },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'estado-indeterminado'),
    'a tela nao pode presumir aplicacao antes da prova');
  assert.equal((sandbox.__toasts || []).filter((t) => t.tone === 'success').length, 0);
});

test('G7. recusa por revisao desatualizada: continua pendente, sem retry e sem merge', async () => {
  let calls = 0;
  const { root, document, supa } = await boot({
    comparisons: [comparison({}), comparison({ impacto: { base_desatualizada: true, revisao_atual: 9 } })],
    rpcImpl: {
      aprovar_alteracao_pedido: () => {
        calls++;
        return { data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a criacao da solicitacao (base 5, atual 9)' } };
      },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.equal(calls, 1, 'nenhuma retentativa automatica');
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'recusa-base-desatualizada'));
  assert.match(root.textContent, /continua PENDENTE/);
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'pendente');
  assert.deepEqual(writeOps(supa), []);
});

test('G8. recusa estrutural apos OP: continua pendente e instrui rejeitar, sem override', async () => {
  let calls = 0;
  const { root, document } = await boot({
    comparisons: [comparison({ impacto: { tem_op_relacionada: true } })],
    rpcImpl: {
      aprovar_alteracao_pedido: () => {
        calls++;
        return { data: null, error: { message: 'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada' } };
      },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.equal(calls, 1, 'nunca ha retentativa com override');
  const aviso = oneWithAttr(root, 'data-rv-alteracao-notice', 'recusa-estrutural');
  assert.ok(aviso);
  assert.match(aviso.textContent, /Rejeite a solicitacao com justificativa/);
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'pendente');
});

test('G9. item vinculado a producao tambem recusa sem override', async () => {
  const { root, document } = await boot({
    rpcImpl: {
      aprovar_alteracao_pedido: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item X ja esta vinculado a producao' } }),
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'recusa-estrutural'));
});

test('G10. impacto de prioridade: abre o padrao canonico e retenta UMA vez SO apos confirmacao explicita', async () => {
  const capturas = [];
  const { root, document } = await boot({
    comparisons: [comparison({}), comparison({ solicitacao: { status: 'aprovada', decidido_em: '2026-07-21T10:00:00Z' } })],
    rpcImpl: {
      aprovar_alteracao_pedido: (params) => {
        capturas.push(params);
        if (capturas.length === 1) {
          return { data: null, error: { message: 'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED: confirme o impacto' } };
        }
        return { data: { ok: true, status: 'aprovada' }, error: null };
      },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Aprovar solicitacao$/));
  allByTag(modal, 'textarea')[0].value = 'Cliente pediu';
  await findButtonByText(modal, /^Aprovar solicitacao$/)._listeners.click();

  assert.equal(capturas.length, 1, 'nenhuma retentativa silenciosa');
  const impacto = overlays(document).find((n) => n.getAttribute('data-pedido-priority-modal') === 'impacto-producao');
  assert.ok(impacto, 'o padrao canonico de confirmacao de impacto de prioridade tem de abrir');
  const primario = allWithAttr(impacto, 'data-pedido-priority-modal-primary')[0];
  await primario._listeners.click();

  assert.equal(capturas.length, 2, 'EXATAMENTE uma retentativa');
  assert.equal(capturas[1].p_confirmar_impacto, true);
  assert.equal(capturas[1].p_solicitacao_id, SID, 'mesmo id de solicitacao');
  assert.equal(capturas[1].p_motivo, 'Cliente pediu', 'mesmo motivo');
});

test('G11. cancelar a confirmacao de impacto NAO retenta e mantem a solicitacao pendente', async () => {
  const capturas = [];
  const { root, document } = await boot({
    rpcImpl: {
      aprovar_alteracao_pedido: (params) => {
        capturas.push(params);
        return { data: null, error: { message: 'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED' } };
      },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  const impacto = overlays(document).find((n) => n.getAttribute('data-pedido-priority-modal') === 'impacto-producao');
  await allWithAttr(impacto, 'data-pedido-priority-modal-secondary')[0]._listeners.click();
  assert.equal(capturas.length, 1, 'cancelar nunca retenta');
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'prioridade-nao-confirmada'));
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'pendente');
});

test('G12. falha de aplicacao chega em data.ok === false, nunca como sucesso parcial', async () => {
  const falha = comparison({
    solicitacao: {
      status: 'falha_aplicacao', decidido_em: '2026-07-21T10:00:00Z',
      falha_identificador: '23514:PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item X ja esta vinculado',
    },
  });
  const { root, document, sandbox } = await boot({
    comparisons: [comparison({}), falha],
    rpcImpl: {
      aprovar_alteracao_pedido: () => ({
        data: {
          ok: false, erro: 'PEDIDO_ALTERACAO_FALHA_APLICACAO', status: 'falha_aplicacao',
          falha_identificador: '23514:PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item X ja esta vinculado',
        },
        error: null,
      }),
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();

  assert.equal((sandbox.__toasts || []).filter((t) => t.tone === 'success').length, 0,
    'nenhuma mensagem de sucesso pode aparecer');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'falha_aplicacao');
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'falha-estrutural'));
  assert.match(root.textContent, /desfez integralmente a aplicacao/);
  // O identificador de falha aparece SOMENTE no diagnostico administrativo.
  const diag = oneWithAttr(root, 'data-rv-alteracao-falha-diagnostico');
  assert.ok(diag, 'o diagnostico administrativo deve existir');
  assert.match(diag.textContent, /23514:PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/);
  const fora = allWithAttr(root, 'data-rv-alteracao-notice')
    .map((n) => n.textContent).join(' ');
  assert.doesNotMatch(fora, /falha_identificador|23514:/,
    'o identificador tecnico nunca vaza para os avisos de usuario');
});

test('G13. falha de aplicacao GENERICA nao afirma causa estrutural', async () => {
  const falha = comparison({
    solicitacao: { status: 'falha_aplicacao', decidido_em: '2026-07-21T10:00:00Z', falha_identificador: 'XX000:algo inesperado' },
  });
  const { root, document } = await boot({
    comparisons: [comparison({}), falha],
    rpcImpl: {
      aprovar_alteracao_pedido: () => ({
        data: { ok: false, erro: 'PEDIDO_ALTERACAO_FALHA_APLICACAO', falha_identificador: 'XX000:algo inesperado' },
        error: null,
      }),
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'falha-aplicacao'));
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-notice', 'falha-estrutural'), null);
});

test('G14. solicitacao ja decidida nunca e apresentada como aprovada por esta acao', async () => {
  const { root, document, sandbox } = await boot({
    comparisons: [comparison({}), comparison({ solicitacao: { status: 'rejeitada', decidido_em: '2026-07-21T09:00:00Z', decisao_motivo: 'Ja decidida antes' } })],
    rpcImpl: {
      aprovar_alteracao_pedido: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em rejeitada' } }),
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'ja-decidida'));
  assert.equal((sandbox.__toasts || []).filter((t) => t.tone === 'success').length, 0);
  assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0);
});

test('G15. FORBIDDEN/NOT_FOUND retornam com seguranca e nunca alegam aprovacao', async () => {
  const { root, document, sandbox } = await boot({
    rpcImpl: {
      aprovar_alteracao_pedido: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' } }),
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-approve')._listeners.click();
  await modalButton(document, /^Aprovar solicitacao$/)._listeners.click();
  assert.ok((sandbox.__navigated || []).includes('#/pedidos/' + PID));
  assert.equal((sandbox.__toasts || []).filter((t) => t.tone === 'success').length, 0);
});

// ---------------------------------------------------------------------
// H. Rejeicao
// ---------------------------------------------------------------------

test('H1. motivo vazio (ou so espacos) NUNCA chama a RPC e o modal permanece aberto', async () => {
  let called = 0;
  const { root, document, sandbox } = await boot({
    rpcImpl: { rejeitar_alteracao_pedido: () => { called++; return { data: { ok: true }, error: null }; } },
  });
  oneWithAttr(root, 'data-rv-alteracao-reject')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Rejeitar solicitacao$/));
  assert.ok(modal, 'o modal de rejeicao deve abrir');
  const motivo = allByTag(modal, 'textarea')[0];
  motivo.value = '    ';
  await findButtonByText(modal, /^Rejeitar solicitacao$/)._listeners.click();
  assert.equal(called, 0, 'motivo vazio nunca chama rejeitar_alteracao_pedido');
  assert.ok(overlays(document).includes(modal), 'o modal permanece aberto para correcao');
  assert.ok((sandbox.__toasts || []).some((t) => /motivo da rejeicao/i.test(t.msg)));
});

test('H2. rejeicao chama rejeitar_alteracao_pedido UMA vez, com o motivo TRIMADO e a forma exata', async () => {
  let captured = null;
  const rejeitada = comparison({
    solicitacao: { status: 'rejeitada', decidido_em: '2026-07-21T11:00:00Z', decisao_motivo: 'Producao ja iniciada' },
  });
  const { root, document, supa } = await boot({
    comparisons: [comparison({}), rejeitada],
    rpcImpl: {
      rejeitar_alteracao_pedido: (params) => { captured = params; return { data: { ok: true, status: 'rejeitada' }, error: null }; },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-reject')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Rejeitar solicitacao$/));
  allByTag(modal, 'textarea')[0].value = '   Producao ja iniciada   ';
  await findButtonByText(modal, /^Rejeitar solicitacao$/)._listeners.click();

  assert.ok(captured);
  assert.deepEqual(Object.keys(captured).sort(), ['p_motivo', 'p_solicitacao_id']);
  assert.equal(captured.p_solicitacao_id, SID);
  assert.equal(captured.p_motivo, 'Producao ja iniciada', 'o motivo viaja trimado');
  assert.equal(supa._calls.filter((c) => c.op === 'rpc' && c.name === 'rejeitar_alteracao_pedido').length, 1);
  assert.deepEqual(writeOps(supa), [], 'nenhum DML direto');
});

test('H3. rejeicao bem-sucedida recarrega, vira somente-leitura e o Pedido permanece inalterado', async () => {
  const rejeitada = comparison({
    solicitacao: { status: 'rejeitada', decidido_em: '2026-07-21T11:00:00Z', decisao_motivo: 'Producao ja iniciada' },
  });
  const { root, document, supa } = await boot({
    comparisons: [comparison({}), rejeitada],
    rpcImpl: { rejeitar_alteracao_pedido: () => ({ data: { ok: true, status: 'rejeitada' }, error: null }) },
  });
  oneWithAttr(root, 'data-rv-alteracao-reject')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Rejeitar solicitacao$/));
  allByTag(modal, 'textarea')[0].value = 'Producao ja iniciada';
  await findButtonByText(modal, /^Rejeitar solicitacao$/)._listeners.click();

  assert.equal(supa._calls.filter((c) => c.op === 'rpc' && c.name === 'admin_alteracao_comparacao').length, 2);
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'rejeitada');
  assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0, 'o rodape de decisao desaparece');
  const aviso = oneWithAttr(root, 'data-rv-alteracao-notice', 'rejeitada');
  assert.ok(aviso);
  assert.match(aviso.textContent, /permanece exatamente como estava/);
  // O Pedido vivo continua representado pelos MESMOS valores da comparacao.
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-atual', 'prazo_entrega').textContent, '01/08/2026');
  assert.match(root.textContent, /Producao ja iniciada/, 'o motivo da decisao fica visivel');
});

test('H4. recusa da rejeicao preserva a solicitacao pendente, sem retry automatico', async () => {
  let calls = 0;
  const { root, document, supa } = await boot({
    rpcImpl: {
      rejeitar_alteracao_pedido: () => { calls++; return { data: null, error: { message: 'boom' } }; },
    },
  });
  oneWithAttr(root, 'data-rv-alteracao-reject')._listeners.click();
  const modal = overlays(document).find((n) => findButtonByText(n, /^Rejeitar solicitacao$/));
  allByTag(modal, 'textarea')[0].value = 'motivo';
  await findButtonByText(modal, /^Rejeitar solicitacao$/)._listeners.click();
  assert.equal(calls, 1, 'sem retry automatico');
  assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), 'pendente');
  assert.deepEqual(writeOps(supa), []);
});

// ---------------------------------------------------------------------
// I. Estados decididos
// ---------------------------------------------------------------------

for (const [status, label] of [
  ['aprovada', 'Aprovada'],
  ['rejeitada', 'Rejeitada'],
  ['retirada', 'Retirada'],
  ['substituida', 'Substituida'],
  ['falha_aplicacao', 'Falha ao aplicar'],
]) {
  test('I. ' + status + ' abre somente-leitura, com a comparacao completa e SEM acoes ativas', async () => {
    const { root } = await boot({
      comparisons: [comparison({
        solicitacao: {
          status: status, decidido_em: '2026-07-21T12:00:00Z',
          decisao_motivo: status === 'rejeitada' ? 'Motivo registrado' : null,
          falha_identificador: status === 'falha_aplicacao' ? 'XX000:erro' : null,
        },
      })],
    });
    assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').getAttribute('data-rv-alteracao-status'), status);
    assert.equal(oneWithAttr(root, 'data-rv-alteracao-status').textContent, label);
    assert.equal(allWithAttr(root, 'data-rv-alteracao-actions').length, 0);
    assert.equal(allWithAttr(root, 'data-rv-alteracao-approve').length, 0);
    assert.equal(allWithAttr(root, 'data-rv-alteracao-reject').length, 0);
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-notice', 'decidida-' + status));
    // A comparacao COMPLETA continua renderizada.
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-header-diff'));
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-itens-diff'));
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-prioridade'));
    assert.match(root.textContent, /21\/07\/2026/, 'o carimbo da decisao aparece');
    if (status === 'rejeitada') assert.match(root.textContent, /Motivo registrado/);
    if (status === 'falha_aplicacao') {
      assert.ok(oneWithAttr(root, 'data-rv-alteracao-falha-diagnostico'));
    } else {
      assert.equal(oneWithAttr(root, 'data-rv-alteracao-falha-diagnostico'), null);
    }
    // Nunca apresentada como pendente.
    assert.doesNotMatch(oneWithAttr(root, 'data-rv-alteracao-status').textContent, /^Pendente$/);
  });
}

// ---------------------------------------------------------------------
// J. Fronteiras
// ---------------------------------------------------------------------

test('J1. o render inicial faz ZERO escrita: nenhum DML e nenhuma RPC de escrita', async () => {
  const { supa } = await boot({});
  assert.deepEqual(writeOps(supa), []);
  const rpcs = supa._calls.filter((c) => c.op === 'rpc').map((c) => c.name);
  assert.deepEqual(rpcs, ['admin_alteracao_comparacao'],
    'a carga inicial chama SOMENTE a leitura de comparacao');
});

test('J2. NENHUMA entidade completa aparece dentro de um dos dois modais', async () => {
  const { root, document } = await boot({
    comparisons: [comparison(Object.assign({}, ITENS_PROPOSTOS_BASE, {
      proposto_itens: [item({ pedido_item_id: 'it-1', modelo_id: 1, modelo_nome: 'Paris', metros: '2.00', ordem: 0 })],
    }))],
  });
  for (const [attr, re] of [['data-rv-alteracao-approve', /^Aprovar solicitacao$/],
    ['data-rv-alteracao-reject', /^Rejeitar solicitacao$/]]) {
    oneWithAttr(root, attr)._listeners.click();
    const modal = overlays(document).find((n) => findButtonByText(n, re));
    assert.ok(modal, 'o modal de confirmacao final deve abrir');
    for (const marcador of ['data-rv-alteracao-header-diff', 'data-rv-alteracao-itens-diff',
      'data-rv-alteracao-prioridade', 'data-rv-alteracao-item-row', 'data-rv-alteracao-impacto',
      'data-rv-alteracao-solicitante']) {
      assert.equal(allWithAttr(modal, marcador).length, 0,
        marcador + ' nunca pode ser renderizado dentro de um modal');
    }
    // Copy concisa + acoes: no maximo um paragrafo e um campo de motivo.
    assert.ok(allByTag(modal, 'p').length <= 1, 'a copy do modal e concisa');
    assert.ok(allByTag(modal, 'textarea').length <= 1);
    // E a comparacao continua na PAGINA, atras do modal.
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-header-diff'));
    assert.ok(oneWithAttr(root, 'data-rv-alteracao-itens-diff'));
  }
});

test('J3. as tabelas de comparacao declaram o dono canonico de rolagem local', async () => {
  const { root } = await boot({});
  const scrolls = allWithAttr(root, 'data-rv-table-scroll');
  assert.ok(scrolls.length >= 2,
    'a tabela de cabecalho e a de itens declaram data-rv-table-scroll');
  for (const s of scrolls) assert.match(s.getAttribute('style'), /overflow-x:\s*auto/);
});

test('J4. a tela nunca renderiza numero interno de Pedido nem dado de producao', async () => {
  const { root } = await boot({ comparisons: [comparison({ impacto: { tem_op_relacionada: true } })] });
  assert.doesNotMatch(root.textContent, /romaneio|nota fiscal|fornecedor|ordem de compra/i);
  assert.doesNotMatch(screenSrc, /pedidos\.numero|'numero'/,
    'o numero interno do Pedido nao entra nesta tela');
});
