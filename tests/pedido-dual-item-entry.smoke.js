// =====================================================================
// === tests/pedido-dual-item-entry.smoke.js ===========================
// PEDIDO-ADMIN-DUAL-ITEM-ENTRY-RESTORE-R1 — guard de regressao da DUPLA
// ENTRADA de item na tela administrativa `#/pedidos/novo`.
//
// BATCH-02 substituiu o modal detalhado pela linha editavel e REMOVEU o
// modal. A linha e valida e permanece; o modal tambem e homologado e foi
// restaurado. Este arquivo existe para que NENHUM dos dois possa sumir em
// silencio outra vez, e para que os dois continuem convergindo no mesmo
// estado local e no mesmo payload de `pedido_itens`.
//
// Prova, dirigindo a tela como o operador (botoes, seletores, Escape) e
// nunca por dentro do estado:
//   1. "Adicionar item" existe no cabecalho do cartao;
//   2. clicar nele ABRE o modal detalhado;
//   3. abrir o modal NAO acrescenta linha alguma;
//   4. "Adicionar linha" existe, e uma acao SEPARADA em estilo hyperlink no
//      rodape do cartao, e nao esta ao lado de "Adicionar item";
//   5. clicar em "Adicionar linha" acrescenta EXATAMENTE uma linha em branco;
//   6. clicar em "Adicionar linha" NAO abre o modal;
//   7. confirmar o modal acrescenta EXATAMENTE um item;
//   8. item do modal e item da linha rapida tem a MESMA estrutura final e
//      chegam ao MESMO payload;
//   9. Tipo-antes-de-Modelo vale na linha;
//  10. Tipo-antes-de-Modelo vale no modal;
//  11. nenhum dos dois caminhos salva sozinho.
//
// Nao toca Supabase: o cliente e um duplo local.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { FaithfulNode, createDocument } = require('./_doubles.js');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => {
  const full = path.join(ROOT, rel);
  assert.ok(fs.existsSync(full), 'arquivo nao encontrado: ' + rel);
  return fs.readFileSync(full, 'utf8');
};

const SOURCES = [
  'js/select-popover.js',
  'js/ui.js',
  // Dono canonico de corPreviewHex/corPreviewElement: a cor do swatch e da
  // referencia visual e dado de negocio, nao um stub de suite.
  'js/pedido-ui.js',
  'js/op-display.js',
  'js/product-route.js',
  // PEDIDO-UNIFIED-ADMIN-EDITOR-R1: dono compartilhado de identidade/totais
  // de item, consumido por pedido-form.js — precisa carregar antes dela.
  'js/pedido-draft.js',
  'js/screens/pedido-item-row-editor.js',
  'js/screens/pedido-numero-sugestao.js',
  'js/screens/pedido-item-modal.js',
  'js/screens/pedido-form.js',
];

const screenSrc = read('js/screens/pedido-form.js');
const modalSrc = read('js/screens/pedido-item-modal.js');
const indexSrc = read('index.html');

const MODELOS = [
  { id: 1, nome: 'Paris', largura: 1.4, cor_1: { id: 1, nome: 'KRAFT' }, cor_2: { id: 2, nome: 'CRU' }, tipo_produto: 'tapete' },
  { id: 2, nome: 'Manta Barcelona', largura: 1.6, cor_1: { id: 3, nome: 'PRETO' }, cor_2: { id: 2, nome: 'CRU' }, tipo_produto: 'manta' },
];

// FaithfulNode alargado em direcao ao DOM real — STRENGTHENING, nunca
// enfraquecimento (CODE_HEALTH_RULES.md §20):
//   - o DOM real coage todo valor de atributo para string e reflete o atributo
//     `value` de um <input> recem-criado na propriedade `.value`. Sem isso,
//     `el('input', { value: '12.5' }).value` leria '' e a suite ficaria cega
//     justamente para a metragem que ela precisa provar;
//   - querySelectorAll por [data-*] e capacidade de qualquer navegador, e e o
//     que updateItensSummary() usa para atualizar os totais.
// O modulo compartilhado fica intocado.
class AttrNode extends FaithfulNode {
  constructor(tag) {
    super(tag);
    this._listeners = {};
  }
  setAttribute(name, value) {
    const coerced = (name === 'style' || typeof value === 'string') ? value : String(value);
    super.setAttribute(name, coerced);
    if (name === 'value') this.value = coerced;
  }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter((h) => h !== fn);
  }
  fire(type, event) {
    for (const fn of (this._listeners[type] || [])) fn(event || { target: this });
  }
  querySelectorAll(sel) {
    const attr = typeof sel === 'string'
      ? sel.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/)
      : null;
    if (!attr) return super.querySelectorAll(sel);
    const out = [];
    walk(this, (n) => {
      const actual = n._attrs ? n._attrs[attr[1]] : undefined;
      if (actual != null && (attr[2] == null || String(actual) === attr[2])) out.push(n);
    });
    return out;
  }
}

function walk(root, visit) {
  for (const child of (root.children || [])) {
    visit(child);
    if (child.children) walk(child, visit);
  }
}

function byAttr(root, name, value) {
  const out = [];
  walk(root, (n) => {
    if (n._attrs && Object.prototype.hasOwnProperty.call(n._attrs, name)
      && (value == null || String(n._attrs[name]) === value)) out.push(n);
  });
  return out;
}

function buttonsByText(root, re) {
  const out = [];
  walk(root, (n) => { if (n.tagName === 'BUTTON' && re.test(n.textContent)) out.push(n); });
  return out;
}

function makeRuntime() {
  const calls = { pedidoInsert: null, itensInsert: null };
  const document = createDocument();
  document.createElement = (tag) => new AttrNode(tag);
  document._listeners = {};
  document.addEventListener = (t, fn) => { (document._listeners[t] = document._listeners[t] || []).push(fn); };
  document.removeEventListener = (t, fn) => {
    document._listeners[t] = (document._listeners[t] || []).filter((h) => h !== fn);
  };

  function chain(table) {
    let mutation = null;
    let cols = null;
    const api = {
      select(v) { if (cols == null) cols = v; return api; },
      order() { return api; },
      eq() { return api; },
      insert(v) {
        mutation = 'insert';
        if (table === 'pedidos') calls.pedidoInsert = v;
        if (table === 'pedido_itens') calls.itensInsert = v;
        return api;
      },
      delete() { mutation = 'delete'; return api; },
      single() {
        return Promise.resolve({ data: { id: 'ped-1', numero: 7, status: 'rascunho', data_pedido: '2026-07-28' }, error: null });
      },
      then(resolve, reject) {
        let data = [];
        if (table === 'clientes') data = [{ id: 501, nome: 'Cliente Atlas' }];
        if (table === 'modelos') {
          data = /tipo_produto/.test(String(cols || ''))
            ? MODELOS.map((m) => ({ id: m.id, tipo_produto: m.tipo_produto }))
            : MODELOS.map((m) => ({ id: m.id, nome: m.nome, largura: m.largura, cor_1: m.cor_1, cor_2: m.cor_2 }));
        }
        if (table === 'pedido_itens' && mutation === 'insert') data = [{ id: 'pi-1' }];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  const sandbox = { window: {}, document, console, Node: FaithfulNode, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.supa = {
    from: (t) => chain(t),
    rpc: () => Promise.resolve({ data: 69, error: null }),
  };
  sandbox.ADMIN_MENU = [];
  sandbox.shellLayout = (_m, content) => content;
  sandbox.navigate = () => {};
  sandbox.requestAnimationFrame = (fn) => fn();
  sandbox.corPreviewElement = () => new AttrNode('div');
  vm.createContext(sandbox);
  for (const rel of SOURCES) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  sandbox.toast = () => {};
  return { sandbox, document, calls };
}

const flush = () => new Promise((r) => setImmediate(r));

async function boot() {
  const rt = makeRuntime();
  const root = await vm.runInContext('window.screenPedidoNovo()', rt.sandbox);
  await flush();
  await flush();
  return { ...rt, root };
}

// Superficies observaveis. A linha e o no que carrega data-uid; o modal e o
// no que carrega data-pedido-item-modal, portalizado em document.body.
const rows = (root) => byAttr(root, 'data-uid');
const openModals = (document) => (document.body.children || []).filter(
  (n) => !n._removed && n._attrs && n._attrs['data-pedido-item-modal']);
const addItemBtn = (root) => byAttr(root, 'data-pedido-add-item')[0];
const addLinhaLink = (root) => byAttr(root, 'data-pedido-add-linha')[0];

// Opcoes REAIS de um seletor canonico: elas vivem no painel portalizado, que
// so existe enquanto o controle esta aberto. Abrir/fechar e leitura pura — nem
// um nem outro emite change. O placeholder (valor vazio) nao e um modelo
// oferecido e por isso nao entra na contagem.
function optionsOf(document, control) {
  control.open();
  const out = [];
  walk(document.body, (n) => {
    if (n.getAttribute && n.getAttribute('role') === 'option') {
      const value = n.getAttribute('data-rv-option-value');
      if (value !== '' && value != null) out.push({ value, text: n.textContent });
    }
  });
  control.close({ focus: false });
  return out;
}

function pick(control, value) {
  control.value = value;
  control.fire('change');
}

// ---------------------------------------------------------------------
// 1. As DUAS entradas existem e sao distintas.
// ---------------------------------------------------------------------

test('dual/1. "Adicionar item" existe no cabecalho do cartao de itens', async () => {
  const { root } = await boot();
  const btn = addItemBtn(root);
  assert.ok(btn, 'o botao principal "Adicionar item" desapareceu');
  assert.equal(btn.tagName, 'BUTTON');
  assert.match(btn.textContent, /Adicionar item/);
});

test('dual/2. "Adicionar linha" existe como acao SEPARADA no rodape do cartao', async () => {
  const { root } = await boot();
  const link = addLinhaLink(root);
  assert.ok(link, 'a acao rapida "Adicionar linha" desapareceu');
  assert.equal(link.textContent, 'Adicionar linha');
  assert.equal(link.getAttribute('aria-label'), 'Adicionar linha',
    'a acao precisa de nome acessivel');
  assert.equal(link.tagName, 'BUTTON',
    'deve ser um controle real, para ativacao por teclado');

  // Nao e o mesmo no que o botao principal, e nao e irmao dele.
  const btn = addItemBtn(root);
  assert.notEqual(link, btn);
  assert.notEqual(link.parentNode, btn.parentNode,
    '"Adicionar linha" nao pode ficar ao lado de "Adicionar item"');

  // Fica DEPOIS da tabela e dos totais, dentro do mesmo cartao.
  const slot = byAttr(root, 'data-pedido-add-linha-slot')[0];
  assert.ok(slot, 'o rodape da acao rapida deve existir');
  const card = slot.parentNode;
  const totais = byAttr(card, 'data-pedido-total-metros')[0];
  assert.ok(totais, 'os totais devem estar no mesmo cartao');
  assert.equal(card.children[card.children.length - 1], slot,
    'a acao rapida deve ser o ULTIMO bloco do cartao');
  assert.match(String(slot.style.cssText), /justify-content:flex-end/,
    'a acao rapida deve ficar alinhada a direita');
});

test('dual/3. "Adicionar linha" e hyperlink, nao botao: sem fundo, sem borda, sem altura de botao', async () => {
  const { root } = await boot();
  const css = String(addLinhaLink(root).style.cssText);
  assert.match(css, /background:none/, 'nao pode ter fundo preenchido');
  assert.match(css, /border:none/, 'nao pode ter borda');
  assert.match(css, /color:var\(--rv-accent-blue\)/,
    'deve usar a cor canonica de texto interativo');
  assert.doesNotMatch(css, /height:var\(--rv-h-/,
    'nao pode assumir geometria de botao do enum de altura');
  assert.doesNotMatch(css, /width:100%/, 'nao pode ser um botao largo');
  // Suprimir o anel nativo sem repor um equivalente em TODO caminho de foco
  // deixa a acao sem indicacao visivel — defeito de acessibilidade medido no
  // navegador durante a implementacao desta ordem.
  assert.doesNotMatch(css, /outline:none/,
    'a acao nao pode suprimir a indicacao de foco do navegador');

  // O botao principal, por contraste, MANTEM a geometria de botao.
  assert.match(String(addItemBtn(root).style.cssText), /height:var\(--rv-h-default\)/);
});

// ---------------------------------------------------------------------
// 2. "Adicionar item" abre o modal e NAO acrescenta linha.
// ---------------------------------------------------------------------

test('dual/4. clicar em "Adicionar item" ABRE o modal detalhado', async () => {
  const { root, document } = await boot();
  assert.equal(openModals(document).length, 0, 'nenhum modal antes do clique');
  addItemBtn(root).fire('click');
  assert.equal(openModals(document).length, 1, '"Adicionar item" deve abrir o modal');
});

test('dual/5. abrir o modal NAO acrescenta linha alguma', async () => {
  const { root, document } = await boot();
  const antes = rows(root).length;
  addItemBtn(root).fire('click');
  assert.equal(rows(root).length, antes,
    'abrir o modal nao pode inserir item no estado local');
  assert.match(modalSrc, /var draft = \{ tipo: '', modeloId: '', metros: '', observacao: '' \}/,
    'o modal deve manter um rascunho LOCAL');
});

test('dual/6. o modal fecha por Cancelar, por Escape e pelo scrim, sem tocar no estado', async () => {
  const { root, document } = await boot();
  const antes = rows(root).length;

  addItemBtn(root).fire('click');
  buttonsByText(openModals(document)[0], /^Cancelar$/)[0].fire('click');
  assert.equal(openModals(document).length, 0, 'Cancelar deve fechar');

  addItemBtn(root).fire('click');
  for (const fn of (document._listeners.keydown || [])) fn({ key: 'Escape' });
  assert.equal(openModals(document).length, 0, 'Escape deve fechar');

  addItemBtn(root).fire('click');
  const overlay = openModals(document)[0];
  overlay.fire('click', { target: overlay });
  assert.equal(openModals(document).length, 0, 'clique no scrim deve fechar');

  assert.equal(rows(root).length, antes, 'fechar o modal nunca altera o estado');
});

// ---------------------------------------------------------------------
// 3. "Adicionar linha" acrescenta UMA linha e nao abre o modal.
// ---------------------------------------------------------------------

test('dual/7. "Adicionar linha" acrescenta EXATAMENTE uma linha em branco', async () => {
  const { root, document } = await boot();
  const antes = rows(root).length;
  addLinhaLink(root).fire('click');
  const depois = rows(root);
  assert.equal(depois.length, antes + 1, 'deve acrescentar exatamente uma linha');
  assert.equal(openModals(document).length, 0, 'a linha rapida NAO pode abrir o modal');

  // A nova linha nasce em branco e editavel, com os controles da linha inline.
  const nova = depois[depois.length - 1];
  const selects = byAttr(nova, 'data-rv-select-popover');
  assert.equal(selects.length, 2, 'Tipo e Modelo devem existir na linha');
  assert.equal(selects[0].value, '', 'Tipo nasce vazio');
  assert.equal(selects[1].value, '', 'Modelo nasce vazio');
  assert.equal(selects[1].disabled, true, 'Modelo nasce desabilitado, sem Tipo');
  assert.equal(byAttr(nova, 'data-item-tipo-select').length, 1);
  assert.equal(byAttr(nova, 'data-item-modelo-select').length, 1);
});

test('dual/8. "Adicionar linha" nao altera nenhuma linha existente', async () => {
  const { root } = await boot();
  // Editar a linha NAO re-renderiza a tabela: os controles continuam sendo os
  // mesmos nos, e por isso podem ser dirigidos direto.
  const selects = byAttr(rows(root)[0], 'data-rv-select-popover');
  pick(selects[0], 'tapete');
  pick(selects[1], '1');

  const antes = rows(root).map((r) => byAttr(r, 'data-rv-select-popover')[1].value);
  addLinhaLink(root).fire('click');
  const depois = rows(root).map((r) => byAttr(r, 'data-rv-select-popover')[1].value);
  assert.deepEqual(depois.slice(0, antes.length), antes,
    'as linhas anteriores devem sobreviver intactas');
  assert.equal(depois[depois.length - 1], '', 'so a nova linha nasce vazia');
});

test('dual/9. os totais acompanham as duas entradas', async () => {
  const { root } = await boot();
  const totalItens = () => byAttr(root, 'data-pedido-total-itens')[0].textContent;
  assert.equal(totalItens(), '1');
  addLinhaLink(root).fire('click');
  assert.equal(totalItens(), '2');
  addLinhaLink(root).fire('click');
  assert.equal(totalItens(), '3');
});

// ---------------------------------------------------------------------
// 4. Tipo antes de Modelo — nos DOIS caminhos.
// ---------------------------------------------------------------------

test('dual/10. na LINHA, Modelo comeca desabilitado e depois filtra pela rota', async () => {
  const { root, document } = await boot();
  const linha = rows(root)[0];
  const [tipo, modelo] = byAttr(linha, 'data-rv-select-popover');
  assert.equal(modelo.disabled, true, 'Modelo comeca desabilitado');
  assert.deepEqual(optionsOf(document, modelo), [], 'sem Tipo nao ha modelo');

  pick(tipo, 'tapete');
  assert.equal(modelo.disabled, false);
  assert.deepEqual(optionsOf(document, modelo).map((o) => o.value), ['1'],
    'Tapete lista apenas modelos tapete');

  pick(tipo, 'manta');
  assert.deepEqual(optionsOf(document, modelo).map((o) => o.value), ['2'],
    'Manta lista apenas modelos manta');
});

test('dual/11. no MODAL, Modelo comeca desabilitado e depois filtra pela rota', async () => {
  const { root, document } = await boot();
  addItemBtn(root).fire('click');
  const modal = openModals(document)[0];
  const tipo = byAttr(modal, 'data-item-modal-tipo')[0];
  const modelo = byAttr(modal, 'data-item-modal-modelo')[0];
  assert.ok(tipo && modelo, 'o modal deve ter Tipo e Modelo');
  assert.equal(modelo.disabled, true, 'Modelo comeca desabilitado no modal');
  assert.deepEqual(optionsOf(document, modelo), [], 'sem Tipo nao ha modelo');

  pick(tipo, 'manta');
  assert.equal(modelo.disabled, false);
  assert.deepEqual(optionsOf(document, modelo).map((o) => o.value), ['2'],
    'Manta lista apenas modelos manta');

  // Trocar o Tipo limpa o modelo incompativel e os derivados.
  pick(modelo, '2');
  pick(tipo, 'tapete');
  assert.equal(modelo.value, '', 'o modelo de outra rota deve ser limpo');
  assert.deepEqual(optionsOf(document, modelo).map((o) => o.value), ['1']);
});

test('dual/12. o modal declara Tipo ANTES de Modelo no corpo', () => {
  const iTipo = modalSrc.indexOf('data-item-modal-tipo');
  const iModelo = modalSrc.indexOf('data-item-modal-modelo');
  assert.ok(iTipo > 0 && iModelo > 0);
  assert.ok(iTipo < iModelo, 'Tipo deve ser construido antes de Modelo');
  assert.match(modalSrc, /tipoField, modeloField/,
    'no corpo do modal, Tipo deve preceder Modelo');
  assert.match(modalSrc, /api\.fillModeloSelect\(modeloSelect, modelos,/,
    'o recorte por rota deve vir do dono unico, nunca de heuristica local');
});

// ---------------------------------------------------------------------
// 5. Confirmacao do modal e convergencia dos dois caminhos.
// ---------------------------------------------------------------------

async function addViaModal(root, document, tipo, modeloId, metros, obs) {
  addItemBtn(root).fire('click');
  const modal = openModals(document)[0];
  pick(byAttr(modal, 'data-item-modal-tipo')[0], tipo);
  pick(byAttr(modal, 'data-item-modal-modelo')[0], modeloId);
  const metragem = byAttr(modal, 'data-item-modal-metragem')[0];
  metragem.value = metros;
  metragem.fire('input');
  if (obs != null) {
    const ta = [];
    walk(modal, (n) => { if (n.tagName === 'TEXTAREA') ta.push(n); });
    ta[0].value = obs;
    ta[0].fire('input');
  }
  byAttr(modal, 'data-item-modal-confirmar')[0].fire('click');
}

test('dual/13. confirmar o modal acrescenta EXATAMENTE um item e fecha', async () => {
  const { root, document } = await boot();
  const antes = rows(root).length;
  await addViaModal(root, document, 'tapete', '1', '12.5', 'vitrine');
  assert.equal(rows(root).length, antes + 1, 'exatamente um item');
  assert.equal(openModals(document).length, 0, 'o modal deve fechar na confirmacao');

  const nova = rows(root)[rows(root).length - 1];
  const inputs = [];
  walk(nova, (n) => { if (n.tagName === 'INPUT') inputs.push(n); });
  assert.equal(byAttr(nova, 'data-rv-select-popover')[1].value, '1');
  assert.equal(inputs.find((i) => i.getAttribute('placeholder') === '0,00').value, '12.5');
  assert.equal(inputs.find((i) => i.getAttribute('placeholder') === '-').value, 'vitrine');
});

test('dual/14. o modal recusa Tipo, Modelo ou Metragem invalidos, sem inserir', async () => {
  const { root, document } = await boot();
  const antes = rows(root).length;

  addItemBtn(root).fire('click');
  let modal = openModals(document)[0];
  byAttr(modal, 'data-item-modal-confirmar')[0].fire('click');
  assert.equal(rows(root).length, antes, 'sem Tipo nao insere');
  assert.equal(openModals(document).length, 1, 'e nao fecha');

  pick(byAttr(modal, 'data-item-modal-tipo')[0], 'tapete');
  byAttr(modal, 'data-item-modal-confirmar')[0].fire('click');
  assert.equal(rows(root).length, antes, 'sem Modelo nao insere');

  pick(byAttr(modal, 'data-item-modal-modelo')[0], '1');
  const metragem = byAttr(modal, 'data-item-modal-metragem')[0];
  metragem.value = '0';
  metragem.fire('input');
  byAttr(modal, 'data-item-modal-confirmar')[0].fire('click');
  assert.equal(rows(root).length, antes, 'metragem <= 0 nao insere');
  assert.equal(openModals(document).length, 1);
});

test('dual/15. item do MODAL e item da LINHA RAPIDA sao estruturalmente identicos', async () => {
  const { root, document } = await boot();

  // Modal.
  await addViaModal(root, document, 'tapete', '1', '10', 'do modal');
  // Linha rapida, preenchida a mao com os MESMOS valores.
  addLinhaLink(root).fire('click');
  const atual = rows(root)[rows(root).length - 1];
  const [tipoSel, modeloSel] = byAttr(atual, 'data-rv-select-popover');
  pick(tipoSel, 'tapete');
  pick(modeloSel, '1');

  const ins = [];
  walk(atual, (n) => { if (n.tagName === 'INPUT') ins.push(n); });
  const met = ins.find((i) => i.getAttribute('placeholder') === '0,00');
  met.value = '10';
  met.fire('input');
  const obs = ins.find((i) => i.getAttribute('placeholder') === '-');
  obs.value = 'do modal';
  obs.fire('input');

  const forma = (row) => {
    const inputs = [];
    walk(row, (n) => { if (n.tagName === 'INPUT') inputs.push(n); });
    return {
      temUid: typeof row.getAttribute('data-uid') === 'string' && row.getAttribute('data-uid').length > 0,
      modeloId: byAttr(row, 'data-rv-select-popover')[1].value,
      tipo: byAttr(row, 'data-rv-select-popover')[0].value,
      metros: inputs.find((i) => i.getAttribute('placeholder') === '0,00').value,
      observacao: inputs.find((i) => i.getAttribute('placeholder') === '-').value,
      cores: byAttr(row, 'data-item-cores')[0].textContent,
      largura: byAttr(row, 'data-item-largura')[0].textContent,
    };
  };
  const all = rows(root);
  assert.deepEqual(forma(all[all.length - 1]), forma(all[all.length - 2]),
    'os dois caminhos devem produzir a MESMA estrutura de item');

  // E a tela tem um unico construtor para os dois.
  assert.match(screenSrc, /function novoItem\(dados\)/,
    'deve existir um construtor UNICO da forma local do item');
  assert.match(screenSrc, /state\.itens\.push\(novoItem\(dados\)\)/,
    'o caminho do modal deve usar o construtor unico');
  assert.match(screenSrc, /state\.itens\.push\(novoItem\(\)\)/,
    'o caminho da linha rapida deve usar o construtor unico');
});

test('dual/16. os dois caminhos convergem no MESMO payload de pedido_itens', async () => {
  const { root, document, calls } = await boot();

  // Cliente (obrigatorio para salvar).
  pick(byAttr(root, 'data-rv-select-popover')[0], '501');

  // Linha inicial preenchida a mao.
  const linha = rows(root)[0];
  const [tipoSel, modeloSel] = byAttr(linha, 'data-rv-select-popover');
  pick(tipoSel, 'tapete');
  pick(modeloSel, '1');
  const ins = [];
  walk(linha, (n) => { if (n.tagName === 'INPUT') ins.push(n); });
  const met = ins.find((i) => i.getAttribute('placeholder') === '0,00');
  met.value = '4';
  met.fire('input');

  // Item pelo modal.
  await addViaModal(root, document, 'manta', '2', '6', 'via modal');

  buttonsByText(root, /^Salvar rascunho$/)[0].fire('click');
  await flush();
  await flush();
  await flush();

  assert.ok(calls.itensInsert, 'o insert de itens deve ter acontecido');
  assert.equal(calls.itensInsert.length, 2, 'os dois itens devem ir juntos');

  // MESMA forma, MESMAS chaves, MESMA semantica — e nenhum tipo redundante.
  const chaves = calls.itensInsert.map((i) => Object.keys(i).sort().join(','));
  assert.equal(chaves[0], chaves[1], 'os dois itens devem ter as mesmas chaves');
  assert.equal(chaves[0], 'metros,modelo_id,observacao,ordem,pedido_id');
  // O payload nasce DENTRO do contexto vm, entao ele carrega o Object.prototype
  // daquele realm. A copia traz o valor para o realm da suite sem alterar nada
  // do que esta sendo provado.
  const payload = (i) => ({ ...i });
  assert.deepEqual(payload(calls.itensInsert[0]), {
    pedido_id: 'ped-1', modelo_id: 1, metros: 4, ordem: 0, observacao: null,
  });
  assert.deepEqual(payload(calls.itensInsert[1]), {
    pedido_id: 'ped-1', modelo_id: 2, metros: 6, ordem: 1, observacao: 'via modal',
  });
  for (const item of calls.itensInsert) {
    assert.ok(!('tipo' in item), 'o tipo nunca e persistido');
    assert.ok(!('tipo_produto' in item), 'tipo_produto nunca e persistido');
  }
});

test('dual/17. nenhum dos dois caminhos salva sozinho', async () => {
  const { root, document, calls } = await boot();
  addLinhaLink(root).fire('click');
  await addViaModal(root, document, 'tapete', '1', '3');
  await flush();
  assert.equal(calls.pedidoInsert, null, 'nenhuma escrita em pedidos');
  assert.equal(calls.itensInsert, null, 'nenhuma escrita em pedido_itens');
});

// ---------------------------------------------------------------------
// 6. Nenhum dos dois caminhos pode sumir em silencio.
// ---------------------------------------------------------------------

test('dual/18. o modal nao pode ser removido nem reabsorvido pela tela', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'screens', 'pedido-item-modal.js')),
    'o dono do modal detalhado nao pode ser apagado');
  assert.match(modalSrc, /window\.RAVATEX_PEDIDO_ITEM_MODAL/,
    'o modal deve continuar publicado no namespace');
  assert.match(screenSrc, /itemModalApi\(\)\.openAddItemModal\(/,
    '"Adicionar item" deve continuar abrindo o modal');
  assert.doesNotMatch(screenSrc, /position:fixed; inset:0/,
    'a tela nao pode reimplantar o overlay do modal');
  assert.match(indexSrc, /js\/screens\/pedido-item-modal\.js\?v=/,
    'index.html deve carregar o modulo do modal');
  const iRow = indexSrc.indexOf('js/screens/pedido-item-row-editor.js');
  const iModal = indexSrc.indexOf('js/screens/pedido-item-modal.js');
  const iForm = indexSrc.indexOf('js/screens/pedido-form.js');
  assert.ok(iRow < iModal && iModal < iForm,
    'ordem de carga: linha -> modal -> tela');
  assert.equal((indexSrc.match(/js\/screens\/pedido-item-modal\.js/g) || []).length, 1,
    'o modulo deve ser carregado exatamente uma vez');
});

test('dual/19. a entrada rapida em linha nao pode ser removida', () => {
  assert.match(screenSrc, /'data-pedido-add-linha': '1'/,
    'a acao rapida deve continuar declarada');
  assert.match(screenSrc, /}, 'Adicionar linha'\);/,
    'o texto visivel deve continuar sendo exatamente "Adicionar linha"');
  assert.doesNotMatch(screenSrc, /Adicionar linha rápida/,
    'o rotulo proibido nao pode aparecer');
  assert.match(screenSrc, /quickRowSlot/,
    'o rodape da acao rapida deve continuar montado no cartao');
});
