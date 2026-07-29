// =====================================================================
// === tests/pedido-unified-admin-editor.smoke.js ======================
// Smoke de runtime (vm sandbox + doubles fiéis) para o editor
// administrativo UNIFICADO do Pedido (js/screens/pedido-edit.js).
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
//
// Prova, dentre os 28 itens exigidos pela ordem (secs.17-18):
//   - composição full-width (sem max-width:768px residual);
//   - numero/status somente-leitura;
//   - entrada dupla convergindo no mesmo estado local;
//   - painel de prioridade presente (>=2 itens);
//   - zero chamada de escrita no carregamento;
//   - payload seco: sem mudança nenhuma NÃO chama a RPC;
//   - payload seco: mudança só de cabeçalho manda p_itens/p_prioridade NULL;
//   - trava estrutural após vínculo de produção (Adicionar item bloqueado);
//   - falha na leitura de vínculo TRAVA por segurança (fail closed);
//   - Pedido terminal é somente-leitura, sem ação Salvar;
//   - revisão desatualizada mostra aviso e "Recarregar dados", sem retry
//     automático.
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
  'js/screens/pedido-item-modal.js',
  'js/screens/pedido-edit.js',
].map((rel) => [rel, read(rel)]);

// Attribute-aware querySelectorAll — needed because pedido-edit.js reads
// back nodes by data-* attribute (updateItensSummary) exactly like
// pedido-form.js already does in tests/pedido-form.smoke.js.
class EditNode extends FaithfulNode {
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

function allStyles(root) {
  const out = [];
  (function walk(node) {
    if (node && node._attrs && node._attrs.style) out.push(node._attrs.style);
    (node.children || []).forEach(walk);
  })(root);
  return out.join(' | ');
}

const PID = '11111111-2222-3333-4444-555555555555';

function basePedidoRow(overrides) {
  return Object.assign({
    id: PID, numero: 42, data_pedido: '2026-07-20', status: 'recebido',
    cliente_id: 501, referencia_cliente: null, prazo_entrega: null,
    tipo_recebimento: null, observacao: null, prioridade_status: 'nenhuma',
    revisao: 3,
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

// The shared document double (tests/_doubles.js) has no
// createDocumentFragment — never needed until now, because production held
// zero non-empty pedido_itens.observacao rows and no prior suite exercised
// the legacy-hint fragment branch of buildRow(). A real DocumentFragment
// flattens its children into the parent on appendChild(); this double keeps
// them nested one level under a plain {children:[]} holder instead — every
// suite walker here recurses into ANY node's `.children`, so both the row
// and the hint are still found exactly as they would be in a real DOM.
// Widening toward real-DOM semantics, kept LOCAL to this file so the shared
// module stays untouched (same rule EditNode already documents above).
function createFragmentDouble() {
  return {
    children: [],
    appendChild(node) {
      this.children.push(node);
      if (node && typeof node === 'object') node.parentNode = this;
      return node;
    },
  };
}

async function bootPedidoEdit(opts) {
  const o = opts || {};
  const document = createDocument();
  document.createDocumentFragment = createFragmentDouble;
  const tableData = Object.assign({
    pedidos: [basePedidoRow(o.pedido)],
    pedido_itens: o.itens || baseItens(),
    clientes: [{ id: 501, nome: 'Cliente Atlas' }],
    modelos: baseModelos(),
    lotes: [], expedicoes: [], op_itens: [], expedicao_itens: [], ops: [],
  }, o.tableData || {});
  const supa = makeFakeSupa({ tableData, rpcImpl: o.rpcImpl || {} });

  const sandbox = { window: {}, document, console, Node: EditNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = supa;
  sandbox.ADMIN_MENU = [];
  sandbox.shellLayout = (_menu, content) => content;
  sandbox.navigate = (hash) => { sandbox.__navigated = hash; };
  sandbox.requestAnimationFrame = (fn) => fn();
  sandbox.confirmDialog = (o2) => { if (o2 && o2.onConfirm) o2.onConfirm(); };
  vm.createContext(sandbox);
  for (const [rel, src] of SOURCES) vm.runInContext(src, sandbox, { filename: rel });
  sandbox.toast = (msg, tone) => { (sandbox.__toasts = sandbox.__toasts || []).push({ msg, tone }); };

  const root = await vm.runInContext(`window.screenPedidoEditar(${JSON.stringify(PID)})`, sandbox);
  return { sandbox, root, supa, tableData };
}

// ---------------------------------------------------------------------
// 1. Composição full-width e read-only de numero/status.
// ---------------------------------------------------------------------

test('pedido-edit: full-width — a antiga moldura max-width:768px não sobrevive', async () => {
  const { root } = await bootPedidoEdit({});
  assert.doesNotMatch(allStyles(root), /max-width:\s*768px/);
});

test('pedido-edit: numero e status são sempre somente-leitura (data-rv-readonly-field)', async () => {
  const { root } = await bootPedidoEdit({});
  const readonlyFields = allWithAttr(root, 'data-rv-readonly-field');
  assert.ok(readonlyFields.length >= 2, 'esperado ao menos 2 campos somente-leitura (numero, status)');
  const texts = readonlyFields.map((n) => n.textContent);
  assert.ok(texts.some((t) => t === '42'), 'numero deve aparecer como valor somente-leitura');
});

test('pedido-edit: zero chamada de escrita ocorre apenas ao carregar a tela', async () => {
  const { supa } = await bootPedidoEdit({});
  const writes = supa._calls.filter((c) => c.op === 'rpc' || c.op === 'insert' || c.op === 'update' || c.op === 'delete');
  assert.deepEqual(writes, [], 'carregar a tela não pode escrever nada');
});

// ---------------------------------------------------------------------
// 2. Entrada dupla + prioridade.
// ---------------------------------------------------------------------

test('pedido-edit: "Adicionar item" e "Adicionar linha" convergem no MESMO estado, e o painel de prioridade aparece (>=2 itens)', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  const addLinha = findButtonByText(root, /^Adicionar linha$/);
  assert.ok(addLinha, '"Adicionar linha" deve existir');
  const before = allWithAttr(root, 'data-pedido-total-itens')[0].textContent;
  assert.equal(before, '2');
  addLinha._listeners.click();
  const after = allWithAttr(root, 'data-pedido-total-itens')[0].textContent;
  assert.equal(after, '3', '"Adicionar linha" deve acrescentar ao MESMO state.itens do modal');
  assert.ok(sandbox.window.RAVATEX_PEDIDO_PRIORITY, 'dono de prioridade deve estar carregado');
  const toggle = allWithAttr(root, 'data-pedido-priority-toggle');
  assert.ok(toggle.length >= 1, 'painel de prioridade deve renderizar com >=2 itens');
});

// ---------------------------------------------------------------------
// 3. Payload seco (dirty sections) — EXECUTION ORDER sec.10.1.
// ---------------------------------------------------------------------

test('pedido-edit: sem NENHUMA alteração, Salvar não chama a RPC e apenas avisa', async () => {
  const { root, supa, sandbox } = await bootPedidoEdit({});
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  assert.ok(saveBtn, 'botão Salvar deve existir para pedido não-terminal');
  await saveBtn._listeners.click();
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 0, 'sem mudanças, salvar_pedido_admin não pode ser chamada');
  assert.ok((sandbox.__toasts || []).some((t) => /Não há alterações/.test(t.msg)));
});

test('pedido-edit: mudar SÓ o cabeçalho manda p_header preenchido e p_itens/p_prioridade NULL', async () => {
  let captured = null;
  const { root, supa } = await bootPedidoEdit({
    rpcImpl: { salvar_pedido_admin: (params) => { captured = params; return { data: { ok: true }, error: null }; } },
  });
  // Acha o campo de Referência do cliente (input de texto livre) e digita.
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  assert.ok(refInputs.length >= 1, 'input de texto (Referência do cliente) deve existir');
  refInputs[0].value = 'PO-123';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  assert.ok(captured, 'salvar_pedido_admin deveria ter sido chamada');
  assert.equal(captured.p_pedido_id, PID);
  assert.equal(captured.p_base_revisao, 3);
  assert.equal(captured.p_itens, null, 'itens inalterados devem viajar como NULL');
  assert.equal(captured.p_prioridade, null, 'prioridade inalterada deve viajar como NULL');
  assert.ok(captured.p_header && Object.keys(captured.p_header).length > 0, 'cabeçalho alterado não pode ser NULL');
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 1, 'exatamente uma chamada de RPC esperada');
});

// ---------------------------------------------------------------------
// 4. Trava estrutural (EXECUTION ORDER sec.9.1) e fail-closed.
// ---------------------------------------------------------------------

// PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: a Observação por item foi retirada
// da linha (não existe mais input a testar). A prova equivalente agora é a
// ação de menção (não-estrutural): permanece disponível sob trava
// estrutural, junto com Observações gerais — ver EXECUTION ORDER sec.J.
test('pedido-edit: OP vinculada trava "Adicionar item" e mostra o aviso, mas a menção de item e Observações gerais continuam disponíveis', async () => {
  const { root } = await bootPedidoEdit({
    tableData: { op_itens: [{ id: 'oi-1', pedido_item_id: 'it-1' }] },
  });
  const addItem = findButtonByText(root, /Adicionar item/);
  assert.ok(addItem, '"Adicionar item" deve continuar visível (não removido, apenas travado)');
  assert.equal(addItem.getAttribute('disabled'), 'disabled', '"Adicionar item" deve estar desabilitado sob trava estrutural');
  assert.match(root.textContent, /já tem produção vinculada/);
  // Ação de menção: NÃO estrutural, permanece habilitada mesmo sob trava
  // (desde que o item tenha um modelo selecionado no fixture de boot).
  const mentionBtns = allWithAttr(root, 'data-item-mention-action');
  assert.ok(mentionBtns.length >= 1, 'ação de menção deve existir em cada linha de item');
  assert.notEqual(mentionBtns[0].disabled, true, 'a menção do item deve continuar disponível sob trava estrutural');
  // Observações gerais (campo geral, não mais "Instruções gerais") continua editável.
  const obsGerais = allByTag(root, 'textarea').find((t) => t.getAttribute('aria-label') === 'Observações gerais');
  assert.ok(obsGerais, 'Observações gerais deve existir');
  assert.notEqual(obsGerais.disabled, true, 'Observações gerais deve continuar editável sob trava estrutural');
});

test('pedido-edit: falha ao detectar vínculo de produção TRAVA por segurança (fail closed, nunca assume "sem OP")', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  // Simula falha de leitura substituindo from('lotes') para devolver erro.
  const originalFrom = sandbox.supa.from;
  sandbox.supa.from = (t) => {
    if (t === 'lotes') {
      return { select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: null, error: { message: 'RLS negado' } }).then(resolve); } };
    }
    return originalFrom(t);
  };
  const root2 = await vm.runInContext(`window.screenPedidoEditar(${JSON.stringify(PID)})`, sandbox);
  const addItem = findButtonByText(root2, /Adicionar item/);
  assert.equal(addItem.getAttribute('disabled'), 'disabled', 'falha de leitura deve travar os controles estruturais');
  assert.match(root2.textContent, /Não foi possível confirmar/);
});

// ---------------------------------------------------------------------
// 5. Pedido terminal — somente-leitura, sem ação Salvar.
// ---------------------------------------------------------------------

test('pedido-edit: Pedido terminal (entregue) é somente-leitura, sem botão Salvar e sem controles estruturais', async () => {
  const { root } = await bootPedidoEdit({ pedido: { status: 'entregue' } });
  assert.equal(findButtonByText(root, /^Salvar alterações$/), undefined, 'pedido terminal não pode ter ação Salvar');
  assert.equal(findButtonByText(root, /Adicionar item/), undefined, 'pedido terminal não pode oferecer Adicionar item');
  assert.match(root.textContent, /encerrado|terminal/i);
});

// ---------------------------------------------------------------------
// 6. Concorrência — revisão desatualizada.
// ---------------------------------------------------------------------

test('pedido-edit: revisão desatualizada mostra aviso e "Recarregar dados", sem retry automático nem merge', async () => {
  const { root, supa } = await bootPedidoEdit({
    rpcImpl: {
      salvar_pedido_admin: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base 3, atual 4)' } }),
    },
  });
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  refInputs[0].value = 'Mudou';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  assert.match(root.textContent, /mudou desde a abertura do editor/);
  const reloadBtn = findButtonByText(root, /^Recarregar dados$/);
  assert.ok(reloadBtn, 'deve oferecer "Recarregar dados"');
  const rpcCallsAfterFirstFailure = supa._calls.filter((c) => c.op === 'rpc').length;
  assert.equal(rpcCallsAfterFirstFailure, 1, 'não pode haver retry automático da RPC');
  const saveBtnNow = findButtonByText(root, /alterações/);
  assert.equal(saveBtnNow.getAttribute('disabled'), 'disabled', 'Salvar deve ficar desabilitado até recarregar explicitamente');
});

// PEDIDO-UNIFIED-ADMIN-EDITOR-R1-REVIEW-CORRECTION: prova o ciclo completo —
// falha por revisão desatualizada, recarga explícita bem-sucedida restaura um
// editor fresco e utilizável, e o salvamento seguinte usa a base NOVA sem
// herdar o rascunho sujo anterior.
test('pedido-edit: recarga explícita bem-sucedida limpa o aviso, restaura Salvar e usa p_base_revisao FRESCO — sem herdar o rascunho antigo', async () => {
  const rpcCalls = [];
  const { root, supa, tableData } = await bootPedidoEdit({
    rpcImpl: {
      salvar_pedido_admin: (params) => {
        rpcCalls.push(params);
        if (rpcCalls.length === 1) {
          return { data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base 3, atual 4)' } };
        }
        return { data: { ok: true }, error: null };
      },
    },
  });

  // 1) Primeiro salvamento: base 3, falha por revisão desatualizada.
  const firstRefInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  firstRefInputs[0].value = 'Mudou antes da recarga';
  firstRefInputs[0]._listeners.input({ target: firstRefInputs[0] });
  const firstSaveBtn = findButtonByText(root, /^Salvar alterações$/);
  await firstSaveBtn._listeners.click();
  assert.equal(rpcCalls.length, 1, 'exatamente uma chamada antes da recarga');
  assert.equal(rpcCalls[0].p_base_revisao, 3, 'o primeiro salvamento deve usar a revisao carregada no boot (3)');
  assert.match(root.textContent, /mudou desde a abertura do editor/);
  assert.equal(findButtonByText(root, /alterações/).getAttribute('disabled'), 'disabled');

  // 2) Simula outra pessoa tendo avançado a revisão no servidor enquanto a
  // tela ficou aberta — e devolve referencia_cliente ao valor persistido
  // (nenhum rascunho local sobrevive à recarga).
  tableData.pedidos[0].revisao = 4;
  tableData.pedidos[0].referencia_cliente = null;

  // 3) Recarga explícita.
  const reloadBtn = findButtonByText(root, /^Recarregar dados$/);
  await reloadBtn._listeners.click();

  // 4) Aviso de revisão desatualizada desaparece; Salvar volta a ficar disponível.
  assert.doesNotMatch(root.textContent, /mudou desde a abertura do editor/, 'o aviso de revisão desatualizada deve sumir após a recarga bem-sucedida');
  const saveBtnAfterReload = findButtonByText(root, /^Salvar alterações$/);
  assert.ok(saveBtnAfterReload, 'Salvar deve voltar a existir após a recarga');
  assert.notEqual(saveBtnAfterReload.getAttribute('disabled'), 'disabled', 'Salvar deve estar habilitado após a recarga bem-sucedida');

  // 5) O rascunho sujo anterior ("Mudou antes da recarga") NÃO sobrevive: o
  // campo reflete o valor fresco do servidor (vazio), não o texto digitado.
  const refInputsAfterReload = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  assert.equal(refInputsAfterReload[0].value, '', 'o campo deve refletir o valor persistido fresco, não o rascunho antigo');

  // 6) Uma edição NOVA, feita após a recarga, salva com sucesso usando a
  // revisão FRESCA (4) — nunca a base 3 congelada da tentativa anterior.
  refInputsAfterReload[0].value = 'Editado depois da recarga';
  refInputsAfterReload[0]._listeners.input({ target: refInputsAfterReload[0] });
  await saveBtnAfterReload._listeners.click();
  assert.equal(rpcCalls.length, 2, 'o segundo salvamento deve chamar a RPC exatamente mais uma vez');
  assert.equal(rpcCalls[1].p_base_revisao, 4, 'o salvamento pós-recarga deve usar a revisao FRESCA (4), não a base 3 antiga');
  // JSON.stringify em vez de deepEqual: p_header vem do vm.Context (outro
  // realm), e deepStrictEqual recusa um objeto estruturalmente idêntico só
  // por prototype mismatch entre realms.
  assert.equal(JSON.stringify(rpcCalls[1].p_header), JSON.stringify({ referencia_cliente: 'Editado depois da recarga' }),
    'o payload deve refletir só a edição pós-recarga, não o rascunho descartado da tentativa anterior');
  assert.match(root.textContent, /Salvando/i);
});

test('pedido-edit: recarga explícita que FALHA permanece fail-closed — mantém a trava de revisão e não habilita Salvar', async () => {
  const { root, sandbox, supa } = await bootPedidoEdit({
    rpcImpl: {
      salvar_pedido_admin: () => ({ data: null, error: { message: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base 3, atual 4)' } }),
    },
  });
  const refInputs = allByTag(root, 'input').filter((i) => i.getAttribute('type') === 'text');
  refInputs[0].value = 'Mudou';
  refInputs[0]._listeners.input({ target: refInputs[0] });
  await findButtonByText(root, /^Salvar alterações$/)._listeners.click();
  assert.match(root.textContent, /mudou desde a abertura do editor/);

  // A recarga em si falha (leitura de `pedidos` recusada).
  const originalFrom = sandbox.supa.from;
  sandbox.supa.from = (t) => {
    if (t === 'pedidos') {
      return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: { message: 'falha de rede' } }); } };
    }
    return originalFrom(t);
  };

  const reloadBtn = findButtonByText(root, /^Recarregar dados$/);
  await reloadBtn._listeners.click();

  // Fail-closed: nenhum botão "Salvar alterações" habilitado deve existir —
  // a tela cai no ecrã de erro de carregamento em vez de reabilitar Salvar
  // sobre uma base incompleta ou mista.
  const saveBtnAfterFailedReload = findButtonByText(root, /^Salvar alterações$/);
  assert.equal(saveBtnAfterFailedReload, undefined, 'nenhum Salvar utilizável pode existir depois de uma recarga que falhou');
  assert.match(root.textContent, /[Ee]rro ao carregar|[Nn]ão encontrado/, 'deve mostrar um erro de carregamento útil');
  const rpcCallsTotal = supa._calls.filter((c) => c.op === 'rpc').length;
  assert.equal(rpcCallsTotal, 1, 'a recarga que falha não pode ter tentado salvar_pedido_admin de novo');
});

// =====================================================================
// 7. PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1-REVIEW-CORRECTION
//
// Defeito 1 (caret intent): o sinalizador antigo nunca resetava no blur,
// entao qualquer clique posterior em @ — mesmo apos o foco ter migrado para
// outro campo — ainda inseria no caret velho. As provas abaixo reproduzem a
// ordem GENUINA de eventos do navegador real (mousedown -> blur -> click),
// nunca chamando computeMentionInsertion/handleItemMention diretamente.
// =====================================================================

function obsTextareaOf(root) {
  return allByTag(root, 'textarea').find((t) => t.getAttribute('aria-label') === 'Observações gerais');
}

function mentionButtonsOf(root) { return allWithAttr(root, 'data-item-mention-action'); }

// FaithfulNode nao modela o vinculo real entre .focus()/.blur() e os
// eventos 'focus'/'blur' — este fio faz o double se comportar como um
// <textarea> real nesse UNICO aspecto, para que a sequencia simulada nos
// testes abaixo seja genuina.
function wireFocusBlur(node) {
  node.focus = function () { if (node._listeners.focus) node._listeners.focus(); };
  node.blur = function () { if (node._listeners.blur) node._listeners.blur(); };
  return node;
}

test('pedido-edit: textarea NUNCA focado — @ acrescenta a mencao ao final (caso A)', async () => {
  const { root, sandbox, supa } = await bootPedidoEdit({});
  const textarea = wireFocusBlur(obsTextareaOf(root));
  textarea.value = 'Nota existente';
  const mentionBtn = mentionButtonsOf(root)[0];
  mentionBtn._listeners.mousedown();
  mentionBtn._listeners.click();
  const expected = sandbox.window.RAVATEX_PEDIDO_DRAFT.buildItemMention({ modeloId: 1 }, baseModelos(), 0);
  assert.equal(textarea.value, 'Nota existente\n' + expected, 'sem foco algum, a mencao deve ser acrescentada ao final');
  assert.equal(textarea.selectionStart, textarea.value.length, 'o caret deve terminar logo apos ": "');
  assert.equal(supa._calls.filter((c) => c.op === 'rpc' || c.op === 'insert' || c.op === 'update' || c.op === 'delete').length, 0,
    'clicar em @ nunca chama RPC ou escreve');
  assert.deepEqual(sandbox.__toasts || [], [], 'clicar em @ nao deve mostrar toast');
});

test('pedido-edit: textarea focado, clique DIRETO em @ insere no caret ativo (caso B) — texto antes/depois preservado', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  const textarea = wireFocusBlur(obsTextareaOf(root));
  textarea.value = 'ABCDEF';
  textarea.focus();
  textarea.selectionStart = 3;
  const mentionBtn = mentionButtonsOf(root)[0];
  // Ordem genuina do navegador: mousedown ANTES do blur, blur ANTES do click.
  mentionBtn._listeners.mousedown();
  textarea.blur();
  mentionBtn._listeners.click();
  const expected = sandbox.window.RAVATEX_PEDIDO_DRAFT.buildItemMention({ modeloId: 1 }, baseModelos(), 0);
  assert.equal(textarea.value, 'ABC\n' + expected + 'DEF', 'deve inserir no caret, preservando texto antes E depois');
  assert.equal(textarea.selectionStart, ('ABC\n' + expected).length, 'o caret deve terminar logo apos ": "');
});

test('pedido-edit: foco sai para outro campo ANTES do clique em @ (caso C) — acrescenta ao final, nao usa o caret antigo', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  const textarea = wireFocusBlur(obsTextareaOf(root));
  textarea.value = 'ABCDEF';
  textarea.focus();
  textarea.selectionStart = 3;
  // O operador sai do textarea para um campo QUALQUER nao relacionado a
  // mencao — o blur acontece MUITO antes do clique em @, sem mousedown algum
  // no botao de mencao nesse instante.
  textarea.blur();
  const mentionBtn = mentionButtonsOf(root)[0];
  mentionBtn._listeners.mousedown();
  mentionBtn._listeners.click();
  const expected = sandbox.window.RAVATEX_PEDIDO_DRAFT.buildItemMention({ modeloId: 1 }, baseModelos(), 0);
  assert.equal(textarea.value, 'ABCDEF\n' + expected,
    'foco ja perdido para outro campo: deve acrescentar ao final, NUNCA reusar o caret 3 antigo');
});

test('pedido-edit: mencao imediatamente repetida usa o caret POS-insercao (caso D), sem dedup', async () => {
  const { root, sandbox } = await bootPedidoEdit({});
  const textarea = wireFocusBlur(obsTextareaOf(root));
  textarea.value = '';
  const mentionBtn = mentionButtonsOf(root)[0];
  mentionBtn._listeners.mousedown();
  mentionBtn._listeners.click();
  const expected = sandbox.window.RAVATEX_PEDIDO_DRAFT.buildItemMention({ modeloId: 1 }, baseModelos(), 0);
  assert.equal(textarea.value, expected);
  assert.equal(textarea.selectionStart, expected.length,
    'apos inserir, a tela deve focar o textarea e posicionar o caret no fim do texto inserido');
  // Clique imediatamente seguinte, sem qualquer blur intermediario: deve usar
  // o caret pos-insercao (fim), nunca reacrescentar cegamente nem deduplicar.
  mentionBtn._listeners.mousedown();
  mentionBtn._listeners.click();
  assert.equal(textarea.value, expected + '\n' + expected,
    'cliques repetidos inserem referencias repetidas de proposito');
});

test('pedido-edit: ativacao por teclado (Enter/Espaco, sem mousedown) continua operavel', async () => {
  const { root, sandbox, supa } = await bootPedidoEdit({});
  const textarea = wireFocusBlur(obsTextareaOf(root));
  textarea.value = 'Texto';
  // Um Tab real ja teria disparado o blur do textarea antes do foco chegar ao
  // botao; ativacao por teclado (Enter/Espaco) dispara apenas 'click', nunca
  // 'mousedown' — o gancho onMentionIntent nao roda, e o resultado correto e
  // acrescentar ao final (o foco ja tinha saido do campo).
  textarea.blur();
  const mentionBtn = mentionButtonsOf(root)[0];
  mentionBtn._listeners.click();
  const expected = sandbox.window.RAVATEX_PEDIDO_DRAFT.buildItemMention({ modeloId: 1 }, baseModelos(), 0);
  assert.equal(textarea.value, 'Texto\n' + expected, 'ativacao por teclado deve continuar funcionando');
  assert.equal(supa._calls.filter((c) => c.op === 'rpc').length, 0, 'clicar em @ nao pode chamar RPC');
});

test('pedido-edit: salvamento SO com mencao manda p_header.observacao preenchido e p_itens/p_prioridade NULL', async () => {
  let captured = null;
  const { root, sandbox } = await bootPedidoEdit({
    rpcImpl: { salvar_pedido_admin: (params) => { captured = params; return { data: { ok: true }, error: null }; } },
  });
  const textarea = wireFocusBlur(obsTextareaOf(root));
  const mentionBtn = mentionButtonsOf(root)[0];
  mentionBtn._listeners.mousedown();
  mentionBtn._listeners.click();
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  assert.ok(captured, 'salvar_pedido_admin deveria ter sido chamada');
  assert.equal(captured.p_itens, null, 'mencionar um item nao e mudanca estrutural de itens');
  assert.equal(captured.p_prioridade, null, 'prioridade inalterada deve viajar como NULL');
  assert.ok(captured.p_header && typeof captured.p_header.observacao === 'string' && captured.p_header.observacao.length > 0,
    'a observacao com a mencao inserida deve estar no payload de cabecalho');
});

// =====================================================================
// 8. PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1-REVIEW-CORRECTION
//
// Defeito 2 (preservacao legada): o dono da linha renderizava
// String(item.observacao).trim() com white-space:normal, removendo espacos
// nas pontas, colapsando espacos internos e quebras de linha — mudando o
// valor VISIVEL do que ja estava persistido. As provas abaixo usam um valor
// sintetico com espacos a esquerda/direita, espacos internos multiplos, uma
// quebra de linha e uma sequencia longa sem espaco.
// =====================================================================

const LEGACY_LONG_UNBROKEN = 'X'.repeat(180);
const LEGACY_RAW = '   observação  com   espaços múltiplos\ninclui quebra de linha e termina com espaços   ' + LEGACY_LONG_UNBROKEN;

function itensComObservacaoLegada() {
  return [
    { id: 'it-1', modelo_id: 1, metros: '2.00', largura: null, observacao: LEGACY_RAW, ordem: 0 },
    { id: 'it-2', modelo_id: 2, metros: '3.00', largura: null, observacao: null, ordem: 1 },
  ];
}

test('pedido-edit: observação legada preserva espaços nas pontas, espaços múltiplos, quebra de linha e sequência longa sem cortar nada', async () => {
  const { root } = await bootPedidoEdit({ itens: itensComObservacaoLegada() });
  const hints = allWithAttr(root, 'data-item-legacy-observacao');
  assert.equal(hints.length, 1, 'apenas o item com observação legada não-vazia deve mostrar a dica');
  const hint = hints[0];
  assert.equal(hint.textContent, 'Observação anterior do item: ' + LEGACY_RAW,
    'o texto integral (espaços e quebra de linha) deve sobreviver sem trim e sem colapso');
  assert.match(hint._attrs.style || '', /white-space:\s*pre-wrap/,
    'a dica deve preservar quebras/espaços via pre-wrap, nunca white-space:normal');
  assert.equal(hint.getAttribute('role'), 'note');
  assert.equal(hint.querySelectorAll('input').length, 0, 'a dica nao pode ser editavel');
  assert.equal(hint.querySelectorAll('textarea').length, 0, 'a dica nao pode ser editavel');
});

test('pedido-edit: a dica legada não reintroduz a coluna Observação nem cria estado sujo de item', async () => {
  const { root, supa } = await bootPedidoEdit({ itens: itensComObservacaoLegada() });
  const header = allWithAttr(root, 'data-itens-header')[0];
  assert.doesNotMatch(header.textContent, /Observa/i, 'o cabeçalho da tabela não pode reintroduzir a coluna Observação');
  const saveBtn = findButtonByText(root, /^Salvar alterações$/);
  await saveBtn._listeners.click();
  const rpcCalls = supa._calls.filter((c) => c.op === 'rpc');
  assert.equal(rpcCalls.length, 0,
    'exibir a dica legada não pode marcar o item como sujo; sem outra mudança, salvar não chama a RPC');
});
