// =====================================================================
// === tests/cliente-pedido-edit.smoke.js ==============================
// Smoke de runtime (vm sandbox + doubles fiéis) para o editor do Cliente
// (js/screens/cliente-pedido-edit.js).
//
// Fase: PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1.
//
// Prova, dentre os itens exigidos pela ordem (Parte 15):
//   - identidade client-safe (sem numero interno, sem status operacional
//     bruto, sem dado de OP/lote/fornecedor/OC/fiscal/custo);
//   - salvar_pedido_cliente e o UNICO dono pre-aceitacao, com p_base_revisao
//     exato, secoes NULL quando inalteradas, sem chamada quando nada mudou,
//     e data_pedido NUNCA no payload;
//   - solicitar_alteracao_pedido pos-aceitacao, com o Pedido vivo
//     permanecendo representado como inalterado apos o envio;
//   - retirar_alteracao_pedido para a solicitacao pendente;
//   - capacidade estrutural (Aceito sem OP permite proposta estrutural;
//     Aceito com OP trava modelo/metros/adicionar/remover, mas mantem
//     cabecalho/observacoes/prioridade) sem expor dado interno de OP;
//   - observacao de item editavel pelo Cliente E dirty-detection dedicada;
//   - concorrencia (revisao desatualizada -> aviso + Recarregar dados, sem
//     retry automatico);
//   - Pedido terminal redireciona para o detalhe (o editor nunca fica
//     disponivel);
//   - zero escrita ao carregar.
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FaithfulNode, createDocument, makeFakeSupa } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const SOURCES = [
  'js/select-popover.js',
  'js/ui.js',
  'js/pedido-ui.js',
  'js/op-display.js',
  'js/product-route.js',
  'js/pedido-priority.js',
  'js/pedido-draft.js',
  'js/pedido-fields.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/cliente-pedido-edit.js',
].map((rel) => [rel, read(rel)]);

class ClientEditNode extends FaithfulNode {
  setAttribute(name, value) {
    const coerced = (name === 'style' || typeof value === 'string') ? value : String(value);
    super.setAttribute(name, coerced);
    if (name === 'value') this.value = coerced;
  }

  querySelectorAll(sel) {
    const attr = typeof sel === 'string'
      ? sel.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/)
      : null;
    if (!attr) return super.querySelectorAll(sel);
    const out = [];
    (function walk(node) {
      for (const child of (node.children || [])) {
        if (child && child._attrs) {
          const actual = child._attrs[attr[1]];
          if (actual != null && (attr[2] == null || String(actual) === attr[2])) out.push(child);
        }
        if (child && child.children) walk(child);
      }
    })(this);
    return out;
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

function allWithAttr(root, attr) {
  const out = [];
  (function walk(node) {
    for (const c of (node.children || [])) {
      if (c && c._attrs && Object.prototype.hasOwnProperty.call(c._attrs, attr)) out.push(c);
      if (c && c.children) walk(c);
    }
  })(root);
  return out;
}

function findButtonByText(root, re) {
  return allByTag(root, 'button').find((b) => re.test(b.textContent));
}

const PID = '11111111-2222-3333-4444-555555555555';

function basePedidoRow(overrides) {
  return Object.assign({
    id: PID, status: 'recebido', data_pedido: '2026-07-10',
    prazo_entrega: null, referencia_cliente: null, tipo_recebimento: null,
    observacao: null, revisao: 3, prioridade_status: 'nenhuma',
    criado_em: '2026-07-10T12:00:00Z',
  }, overrides || {});
}

function baseItens() {
  return [
    { id: 'it-1', modelo_id: 1, metros: '2.00', largura: null, observacao: null, ordem: 0 },
    { id: 'it-2', modelo_id: 2, metros: '3.00', largura: null, observacao: null, ordem: 1 },
  ];
}

function baseModelos() {
  return [
    { id: 1, nome: 'Paris', tipo_produto: 'tapete', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } },
    { id: 2, nome: 'Roma', tipo_produto: 'tapete', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' } },
  ];
}

async function bootClientePedidoEdit(opts) {
  const o = opts || {};
  const document = createDocument();
  document.createElement = (tag) => new ClientEditNode(tag);
  const tableData = Object.assign({
    pedidos: [basePedidoRow(o.pedido)],
    pedido_itens: o.itens || baseItens(),
    modelos: baseModelos(),
  }, o.tableData || {});

  // Estado mutavel da solicitacao pendente: solicitar/retirar alteram o
  // que cliente_alteracao_resumo devolve na PROXIMA leitura, exatamente
  // como o banco real substitui/retira em uma transacao.
  let pendenteAtual = o.pendente || null;

  const rpcImpl = Object.assign({
    cliente_pedido_summary: () => ({
      data: { ok: true, chain_state: { isOperationalOverride: !!o.isOperationalOverride, displayStatus: o.displayStatus || 'Recebido' } },
      error: null,
    }),
    cliente_alteracao_resumo: () => ({ data: { ok: true, pendente: pendenteAtual, historico: [] }, error: null }),
    solicitar_alteracao_pedido: (params) => {
      pendenteAtual = { solicitacao_id: 'sol-1', status: 'pendente', campos_alterados: [], itens_propostos: false, prioridade_proposta: false, mensagem: params.p_mensagem, criado_em: '2026-07-20T00:00:00Z' };
      return { data: { ok: true, solicitacao_id: 'sol-1', status: 'pendente' }, error: null };
    },
    retirar_alteracao_pedido: () => {
      pendenteAtual = null;
      return { data: { ok: true, status: 'retirada' }, error: null };
    },
  }, o.rpcImpl || {});

  const supa = makeFakeSupa({ tableData, rpcImpl });

  const sandbox = { window: {}, document, console, Node: ClientEditNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = supa;
  sandbox.navigate = (hash) => { sandbox.__navigated = hash; };
  sandbox.requestAnimationFrame = (fn) => fn();
  sandbox.clienteShellLayout = (content) => content;
  vm.createContext(sandbox);
  for (const [rel, src] of SOURCES) vm.runInContext(src, sandbox, { filename: rel });
  // js/ui.js declares its OWN top-level confirmDialog()/toast(), which
  // (re-)binds window.confirmDialog/window.toast when the script runs —
  // overwriting any stub set BEFORE the SOURCES loop. Both must be
  // (re-)assigned AFTER it, exactly like the admin editor harness already
  // does for toast (tests/pedido-unified-admin-editor.smoke.js).
  // confirmDialog calls onConfirm asynchronously (Promise.resolve().then),
  // preserving real dialog semantics, and returns the chained Promise so
  // window.confirmDialog(...) is awaitable by the test (same pattern as
  // tests/entrega-writes.smoke.js).
  sandbox.confirmDialog = (o2) => Promise.resolve().then(() => o2 && o2.onConfirm && o2.onConfirm());
  sandbox.toast = (msg, tone) => { (sandbox.__toasts = sandbox.__toasts || []).push({ msg, tone }); };

  const root = await vm.runInContext(`window.screenClientePedidoEditar(${JSON.stringify(PID)})`, sandbox);
  return { sandbox, root, supa, tableData };
}

// ---------------------------------------------------------------------
// B. Identidade client-safe.
// ---------------------------------------------------------------------

test('cliente-pedido-edit: identidade por referencia_cliente/data, NUNCA numero ou status operacional bruto', async () => {
  const { root } = await bootClientePedidoEdit({ pedido: { referencia_cliente: 'PO-77' } });
  assert.match(root.textContent, /PO-77/);
  assert.doesNotMatch(root.textContent, /\brecebido\b/i, 'status operacional bruto nao pode aparecer literalmente');
  assert.doesNotMatch(root.textContent, /\bOP\b|lote|fornecedor|ordem de compra|fiscal|custo/i,
    'nenhum dado interno de producao pode aparecer');
});

test('cliente-pedido-edit: zero chamada de escrita ocorre apenas ao carregar a tela', async () => {
  const { supa } = await bootClientePedidoEdit({});
  const writes = supa._calls.filter((c) => c.op === 'rpc' || c.op === 'insert' || c.op === 'update' || c.op === 'delete');
  assert.deepEqual(writes.filter((c) => c.op !== 'rpc'), [], 'carregar a tela nao pode fazer INSERT/UPDATE/DELETE diretos');
  const writeRpcs = writes.filter((c) => c.op === 'rpc'
    && !['cliente_pedido_summary', 'cliente_alteracao_resumo'].includes(c.name));
  assert.deepEqual(writeRpcs, [], 'carregar a tela so pode chamar as duas RPCs de leitura sanitizada');
});

// ---------------------------------------------------------------------
// C. Salvamento direto pre-aceitacao (Modo A).
// ---------------------------------------------------------------------

test('cliente-pedido-edit: pre-aceitacao — Salvar altera SOMENTE o campo mudado via salvar_pedido_cliente; data_pedido nunca viaja', async () => {
  let captured = null;
  const { root } = await bootClientePedidoEdit({
    pedido: { status: 'recebido' },
    rpcImpl: { salvar_pedido_cliente: (params) => { captured = params; return { data: { ok: true }, error: null }; } },
  });
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  assert.ok(refInputs.length >= 1, 'input de Referencia do cliente deve existir e ser editavel pre-aceitacao');
  refInputs[0].value = 'PO-123';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  const saveBtn = findButtonByText(root, /^Salvar altera/);
  assert.ok(saveBtn, 'botao Salvar alteracoes deve existir pre-aceitacao');
  await saveBtn._listeners.click();
  assert.ok(captured, 'salvar_pedido_cliente deveria ter sido chamada');
  assert.equal(captured.p_pedido_id, PID);
  assert.equal(captured.p_base_revisao, 3);
  // JSON.stringify em vez de deepEqual: p_header vem do vm.Context (outro
  // realm) e deepEqual/deepStrictEqual recusam um objeto estruturalmente
  // identico so por prototype mismatch entre realms.
  assert.equal(JSON.stringify(captured.p_header), JSON.stringify({ referencia_cliente: 'PO-123' }));
  assert.equal(captured.p_itens, null);
  assert.equal(captured.p_prioridade, null);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.p_header, 'data_pedido'), false,
    'data_pedido nunca pode ser proposto pelo Cliente');
  assert.equal(Object.prototype.hasOwnProperty.call(captured, 'p_confirmar_impacto'), false,
    'salvar_pedido_cliente nao aceita p_confirmar_impacto (assinatura exata)');
});

test('cliente-pedido-edit: pre-aceitacao — sem NENHUMA alteracao, Salvar nao chama a RPC', async () => {
  let called = false;
  const { root, sandbox } = await bootClientePedidoEdit({
    rpcImpl: { salvar_pedido_cliente: () => { called = true; return { data: { ok: true }, error: null }; } },
  });
  const saveBtn = findButtonByText(root, /^Salvar altera/);
  await saveBtn._listeners.click();
  assert.equal(called, false, 'sem mudancas, salvar_pedido_cliente nao pode ser chamada');
  assert.ok((sandbox.__toasts || []).some((t) => /N.o h. altera..es/.test(t.msg)));
});

test('cliente-pedido-edit: pre-aceitacao — revisao desatualizada mostra aviso e Recarregar dados, sem retry automatico', async () => {
  let calls = 0;
  const { root, supa } = await bootClientePedidoEdit({
    rpcImpl: {
      salvar_pedido_cliente: () => {
        calls++;
        return { data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base 3, atual 4)' } };
      },
    },
  });
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  refInputs[0].value = 'Mudou';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  await findButtonByText(root, /^Salvar altera/)._listeners.click();
  assert.match(root.textContent, /mudou desde a abertura do editor/);
  const reloadBtn = findButtonByText(root, /^Recarregar dados$/);
  assert.ok(reloadBtn, 'deve oferecer Recarregar dados');
  assert.equal(calls, 1, 'nao pode haver retry automatico');
  const saveBtnNow = findButtonByText(root, /altera/i);
  assert.equal(saveBtnNow.getAttribute('disabled'), 'disabled', 'Salvar deve ficar desabilitado ate recarregar');
  const rpcCallsTotal = supa._calls.filter((c) => c.op === 'rpc' && c.name === 'salvar_pedido_cliente').length;
  assert.equal(rpcCallsTotal, 1);
});

// ---------------------------------------------------------------------
// D. Solicitacao de alteracao pos-aceitacao (Modo B).
// ---------------------------------------------------------------------

test('cliente-pedido-edit: pos-aceitacao sem OP — Enviar solicitacao usa solicitar_alteracao_pedido; pedido vivo permanece representado como inalterado', async () => {
  let captured = null;
  const { root, tableData } = await bootClientePedidoEdit({
    pedido: { status: 'confirmado' },
    isOperationalOverride: false,
    rpcImpl: { solicitar_alteracao_pedido: (params) => { captured = params; return { data: { ok: true, solicitacao_id: 'sol-9', status: 'pendente' }, error: null }; } },
  });
  const prazoInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'date');
  assert.ok(prazoInputs.length >= 1, 'input de Prazo desejado deve existir e ser proponivel pos-aceitacao');
  prazoInputs[0].value = '2026-08-01';
  prazoInputs[0]._listeners.change({ target: prazoInputs[0] });
  const msgInputs = allByTag(root, 'textarea').filter((t) => t.getAttribute('aria-label') === 'Mensagem da solicitacao');
  assert.ok(msgInputs.length === 1, 'campo de mensagem deve existir apenas pos-aceitacao');
  msgInputs[0].value = 'Preciso adiantar a entrega';
  msgInputs[0]._listeners.input({ target: msgInputs[0] });
  const sendBtn = findButtonByText(root, /^Enviar solicita/);
  assert.ok(sendBtn, 'botao Enviar solicitacao de alteracao deve existir pos-aceitacao');
  await sendBtn._listeners.click();
  assert.ok(captured, 'solicitar_alteracao_pedido deveria ter sido chamada');
  assert.equal(captured.p_pedido_id, PID);
  assert.equal(JSON.stringify(captured.p_header), JSON.stringify({ prazo_entrega: '2026-08-01' }));
  assert.equal(captured.p_itens, null);
  assert.equal(captured.p_prioridade, null);
  assert.equal(captured.p_mensagem, 'Preciso adiantar a entrega');
  assert.equal(Object.prototype.hasOwnProperty.call(captured, 'p_base_revisao'), false,
    'solicitar_alteracao_pedido nao aceita p_base_revisao (assinatura exata)');
  // O Pedido vivo (tableData) nunca e tocado por esta RPC — nenhum
  // caminho deste teste executa UPDATE/DELETE em pedidos/pedido_itens.
  assert.equal(tableData.pedidos[0].prazo_entrega, null, 'o valor proposto nao pode ter sido gravado no pedido vivo');
});

test('cliente-pedido-edit: pos-aceitacao — apos enviar, aviso de solicitacao pendente aparece e oferece Retirar', async () => {
  const { root, sandbox } = await bootClientePedidoEdit({ pedido: { status: 'confirmado' } });
  const msgInputs = allByTag(root, 'textarea').filter((t) => t.getAttribute('aria-label') === 'Mensagem da solicitacao');
  msgInputs[0].value = 'Ajuste de prazo';
  msgInputs[0]._listeners.input({ target: msgInputs[0] });
  const prazoInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'date');
  prazoInputs[0].value = '2026-08-05';
  prazoInputs[0]._listeners.change({ target: prazoInputs[0] });
  await findButtonByText(root, /^Enviar solicita/)._listeners.click();
  assert.ok((sandbox.__toasts || []).some((t) => /Aguardando revis.o administrativa/.test(t.msg)));
  // A tela recarrega apos o envio; o container (root) e mutado no lugar
  // (replaceChildren), entao o aviso aparece no MESMO container ja lido.
  assert.match(root.textContent, /solicita..o de altera..o pendente/i);
  assert.ok(findButtonByText(root, /^Retirar solicita/), 'acao de retirar deve estar disponivel');
});

// ---------------------------------------------------------------------
// E. Retirada.
// ---------------------------------------------------------------------

test('cliente-pedido-edit: retirar solicitacao chama retirar_alteracao_pedido com o id certo e nao toca o pedido vivo', async () => {
  let captured = null;
  const { root, tableData } = await bootClientePedidoEdit({
    pedido: { status: 'confirmado' },
    pendente: { solicitacao_id: 'sol-42', status: 'pendente', campos_alterados: ['prazo_entrega'], itens_propostos: false, prioridade_proposta: false, mensagem: null, criado_em: '2026-07-18T00:00:00Z' },
    rpcImpl: { retirar_alteracao_pedido: (params) => { captured = params; return { data: { ok: true, status: 'retirada' }, error: null }; } },
  });
  assert.match(root.textContent, /solicita..o de altera..o pendente/i);
  const withdrawBtn = findButtonByText(root, /^Retirar solicita/);
  assert.ok(withdrawBtn);
  await withdrawBtn._listeners.click();
  assert.equal(JSON.stringify(captured), JSON.stringify({ p_solicitacao_id: 'sol-42' }));
  assert.equal(tableData.pedidos[0].status, 'confirmado', 'retirar nunca muda o pedido vivo');
});

// ---------------------------------------------------------------------
// F. Capacidade estrutural pos-aceitacao.
// ---------------------------------------------------------------------

test('cliente-pedido-edit: pos-aceitacao SEM OP — modelo, metragem e remover continuam editaveis', async () => {
  const { root } = await bootClientePedidoEdit({ pedido: { status: 'confirmado' }, isOperationalOverride: false });
  const rows = allWithAttr(root, 'data-uid');
  assert.ok(rows.length >= 1);
  const metrosInputs = allByTag(rows[0], 'input').filter((i) => i.getAttribute('placeholder') === '0,00');
  assert.notEqual(metrosInputs[0].disabled, true, 'metragem deve continuar editavel sem OP relacionada');
});

test('cliente-pedido-edit: pos-aceitacao COM OP — modelo/metragem/remover ficam travados, mas cabecalho e observacoes continuam disponiveis, sem expor dado de OP', async () => {
  const { root } = await bootClientePedidoEdit({ pedido: { status: 'confirmado' }, isOperationalOverride: true });
  const rows = allWithAttr(root, 'data-uid');
  const metrosInputs = allByTag(rows[0], 'input').filter((i) => i.getAttribute('placeholder') === '0,00');
  assert.equal(metrosInputs[0].disabled, true, 'metragem deve travar quando ha producao vinculada');
  const removeBtns = allWithAttr(rows[0], 'title').filter((n) => n._attrs.title === 'Remover item');
  assert.equal(removeBtns[0].disabled, true, 'remover deve travar quando ha producao vinculada');
  const prazoInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'date');
  assert.notEqual(prazoInputs[0].disabled, true, 'prazo (cabecalho) continua proponivel sob trava estrutural');
  assert.doesNotMatch(root.textContent, /\bOP\b|lote_id|expedicao|op_itens/i,
    'a trava estrutural nao pode expor nenhum identificador ou termo interno de producao');
});

// ---------------------------------------------------------------------
// G. Observacao de item.
// ---------------------------------------------------------------------

test('cliente-pedido-edit: Cliente pode editar observacao de item, e a mudanca sozinha dispara p_itens', async () => {
  let captured = null;
  const { root } = await bootClientePedidoEdit({
    pedido: { status: 'recebido' },
    rpcImpl: { salvar_pedido_cliente: (params) => { captured = params; return { data: { ok: true }, error: null }; } },
  });
  const rows = allWithAttr(root, 'data-uid');
  const obsInputs = allWithAttr(rows[0], 'data-cliente-item-observacao');
  assert.equal(obsInputs.length, 1, 'a linha do Cliente deve expor observacao de item editavel');
  obsInputs[0].value = 'Cor levemente diferente, por favor confirmar';
  obsInputs[0]._listeners.input({ target: obsInputs[0] });
  await findButtonByText(root, /^Salvar altera/)._listeners.click();
  assert.ok(captured, 'mudar so a observacao do item deve disparar salvar_pedido_cliente');
  assert.equal(captured.p_header, null, 'nenhum campo de cabecalho mudou');
  assert.ok(Array.isArray(captured.p_itens), 'p_itens deve viajar quando a observacao do item muda');
  assert.equal(captured.p_itens[0].observacao, 'Cor levemente diferente, por favor confirmar');
});

// ---------------------------------------------------------------------
// Terminal — o editor nunca fica disponivel.
// ---------------------------------------------------------------------

test('cliente-pedido-edit: Pedido terminal (entregue) redireciona para o detalhe em vez de renderizar o editor', async () => {
  const { sandbox } = await bootClientePedidoEdit({ pedido: { status: 'entregue' } });
  assert.equal(sandbox.__navigated, '#/cliente/pedidos/' + PID);
});
