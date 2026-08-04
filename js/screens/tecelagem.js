// =====================================================================
// === SCREENS: TECELAGEM V1 — primeira fatia vertical ==================
//
// Superfície operacional do fornecedor de TECELAGEM. Três telas:
//
//   MINHAS OPs -> ABRIR OP -> INICIAR PRODUÇÃO -> REGISTRAR PRODUÇÃO
//                                              -> VER ROLOS
//                                                 -> SELECIONAR ROLOS
//                                                    -> DAR SAÍDA PARA ACABAMENTO
//                                                 -> EXCLUIR ROLO
//                                                 -> DESFAZER LANÇAMENTO
//
// DUAS CORREÇÕES DISTINTAS E INDEPENDENTES (nenhuma substitui a outra):
//   EXCLUIR ROLO         remove UM rolo físico registrado por engano (db/127);
//   DESFAZER LANÇAMENTO  reverte o LOTE inteiro de produção (db/126).
// Excluir um rolo NUNCA renumera os demais: o número está impresso numa
// etiqueta física, a lacuna é permanente e o número liberado nunca é reemitido.
//
// A UNIDADE DO REGISTRO É ROLOS, E ISSO TEM DE SER IMPOSSÍVEL DE CONFUNDIR.
// Um operador real digitou 75 querendo dizer «75 metros» e a superfície criou
// 75 rolos persistentes, sem caminho de volta. As duas metades da correção:
//
//   PREVENÇÃO   o campo primário nomeia ROLOS, nega a metragem por escrito,
//               ecoa «75 ROLOS» enquanto se digita, e uma quantidade alta
//               exige uma confirmação que REPETE a unidade antes de gravar.
//   RECUPERAÇÃO um lançamento é um EVENTO EM LOTE e pode ser DESFEITO como
//               tal — nunca apagando 75 rolos um a um.
//
// A regra de segurança do desfazer é do SERVIDOR (db/126): enquanto todos os
// rolos do lote estiverem `na_tecelagem` ele pode ser desfeito; se algum já
// saiu para o acabamento, o desfazer normal é RECUSADO e explicado, e nenhuma
// movimentação de acabamento é revertida automaticamente nesta fase.
//
// SAÍDA PARA O ACABAMENTO (db/125) opera sobre ROLOS INDIVIDUAIS, nunca uma
// quantidade abstrata: o operador seleciona rolos concretos, ainda
// `na_tecelagem`, e confirma. Só os selecionados mudam para
// `enviado_acabamento`; nenhum outro rolo é tocado. Um rolo já enviado não
// pode ser selecionado de novo pelo fluxo normal, e MANTA nunca oferece esta
// ação — nem o botão nem, defensivamente, o servidor a aceitam para um
// produto Manta. Como toda escrita desta superfície, a recusa de verdade é
// do servidor (public.enviar_rolos_acabamento, db/125); esta tela apenas
// antecipa o estado.
//
// INICIAR PRODUÇÃO É LOCAL A ESTA SUPERFÍCIE (regra de produto ratificada)
// Iniciar a produção aqui grava UM fato operacional desta superfície — «esta
// OP foi iniciada pelo operador da tecelagem» — e NADA no Admin. Não é a
// transição autoritativa do ciclo de vida administrativo: ops.status não é
// escrito, public.iniciar_producao_op não é chamada, e a integração com o
// Admin é fase posterior. O registro de rolos fica indisponível até esse
// início, e essa recusa mora no SERVIDOR (db/123), não neste arquivo.
//
//   - screenTecelagemOps     '#/tecelagem/ops'
//   - screenTecelagemOp      '#/tecelagem/ops/<opId>'
//   - screenTecelagemRolos   '#/tecelagem/ops/<opId>/produtos/<opItemId>/rolos'
//
// ISOLAMENTO (restrição vinculante desta fase)
// Esta superfície LÊ a OP e o produto definidos pela Ravatex e ESCREVE apenas
// o próprio estado operacional de tecelagem. A leitura passa pelas políticas
// SELECT que já existem para o fornecedor (db/03); a escrita passa por UM
// único dono, public.registrar_producao_tecelagem (db/123). Nenhuma tela
// daqui grava em tabela do Admin, nem direta nem indiretamente.
//
// DADO DA RAVATEX É SOMENTE LEITURA — e isso é garantido no SERVIDOR, não
// aqui: o fornecedor não tem grant de escrita em ops, op_itens nem modelos.
// A ausência de controle de edição nesta tela é consequência, não a defesa.
//
// O ESTADO EXIBIDO É O OPERACIONAL DA TECELAGEM, não o ciclo de vida do
// Admin. Nesta fase os dois são fatos distintos e mostrá-los lado a lado só
// produziria contradição visível ("Aberta" + "Produção iniciada"). O que o
// operador precisa saber é o que ele pode fazer agora.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el, window.pageHeader, window.modal, window.confirmDialog,
//     window.toast, window.textInput, window.formField        (js/ui.js)
//   - window.RV_BADGES.rvStatusPill                          (js/badges.js)
//   - window.RAVATEX_OP_DISPLAY.formatOpOperationalCode      (js/op-display.js)
//   - window.shellLayout                                     (js/screens/common.js)
//   - window.supa                                            (js/supabase-client.js)
//   - window.CURRENT_USER                                    (js/auth.js)
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Ícones Lucide (stroke 1.8–2, sem preenchimento, sem emoji) — §7.
  var ICON_LAYERS = '<path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="m2 17 10 5 10-5"></path><path d="m2 12 10 5 10-5"></path>';
  var ICON_BOX = '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>';
  var ICON_LIST = '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>';
  var ICON_PRINT = '<path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect>';
  var ICON_UNDO = '<path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>';
  var ICON_TRASH = '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>';

  function icon(markup, size) {
    var svg = window.el('span', {});
    svg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size
      + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
      + ' stroke-linecap="round" stroke-linejoin="round">' + markup + '</svg>';
    return svg.firstChild;
  }

  // Menu lateral da superfície de tecelagem.
  function menu() {
    return [{ href: '#/tecelagem/ops', label: 'Minhas OPs' }];
  }

  // Card canônico (§2.4): superfície, borda simples, raio do token, PLANO.
  function card() {
    var children = Array.prototype.slice.call(arguments);
    return window.el('div', {
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border);'
        + ' border-radius:var(--rv-radius); padding:var(--rv-pad-card);'
        + ' box-shadow:var(--rv-shadow-none);',
    }, ...children);
  }

  // Cabeçalho de seção (§2.4): chip de 20px + rótulo caixa-alta.
  function sectionChip(label, iconMarkup) {
    return window.el('div', { style: 'display:flex; align-items:center; gap:8px; margin-bottom:11px;' },
      window.el('span', {
        style: 'width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;'
          + ' border-radius:var(--rv-radius); background:var(--rv-chip-bg);'
          + ' color:var(--rv-chip-glyph); flex:none;',
      }, icon(iconMarkup, 13)),
      window.el('span', {
        style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
          + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
      }, label)
    );
  }

  // Rodapé de ações do card (§2.1): SEMPRE à direita, com divisor superior.
  function cardFooter() {
    var children = Array.prototype.slice.call(arguments);
    return window.el('div', {
      style: 'display:flex; justify-content:flex-end; gap:8px; margin-top:13px;'
        + ' border-top:1px solid var(--rv-border-soft); padding-top:11px;',
    }, ...children);
  }

  function primaryButton(label, onclick, disabled) {
    var attrs = {
      style: 'border-radius:var(--rv-radius); font-size:var(--rv-fs-body); font-weight:600;'
        + ' height:var(--rv-h-primary); padding:0 16px; display:inline-flex;'
        + ' align-items:center; justify-content:center; border:none;'
        + ' background:var(--rv-brand); color:var(--rv-text-on-brand);'
        + (disabled ? ' opacity:.45; cursor:default;' : ' cursor:pointer;'),
      onclick: disabled ? null : onclick,
    };
    // §2.1: a chave `disabled` entra no objeto SOMENTE quando a condição é
    // verdadeira, e com valor TRUTHY — el() trata `disabled` como atributo
    // booleano e um valor falsy (por exemplo '') o REMOVE, deixando o botão
    // acionável.
    if (disabled) attrs.disabled = true;
    return window.el('button', attrs, label);
  }

  // `disabled` segue exatamente a mesma disciplina de primaryButton (§2.1): a
  // chave só entra no objeto quando a condição é verdadeira, porque el() trata
  // `disabled` como atributo booleano e um valor falsy o REMOVE.
  function secondaryButton(label, onclick, disabled) {
    var attrs = {
      style: 'border-radius:var(--rv-radius); font-size:var(--rv-fs-body); font-weight:600;'
        + ' height:var(--rv-h-default); padding:0 14px; display:inline-flex;'
        + ' align-items:center; justify-content:center;'
        + ' background:var(--rv-surface); border:1px solid var(--rv-border-strong);'
        + ' color:var(--rv-text-secondary);'
        + (disabled ? ' opacity:.45; cursor:default;' : ' cursor:pointer;'),
      onclick: disabled ? null : onclick,
    };
    if (disabled) attrs.disabled = true;
    return window.el('button', attrs, label);
  }

  function emptyText(message) {
    return window.el('p', {
      style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin:0;',
    }, message);
  }

  // -------------------------------------------------------------------
  // Formatação pt-BR: vírgula decimal, unidade explícita, .tnum (§7).
  function fmtMetros(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function fmtLargura(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function fmtRolo(numero) {
    var n = Number(numero);
    if (!isFinite(n)) return '—';
    return String(n).padStart(3, '0');
  }

  function num(node) {
    node.className = 'tnum';
    return node;
  }

  // COR do modelo, no formato compartilhado por rótulo de tela e etiquetas:
  // "KRAFT/CRU" com as duas cores, ou uma só quando a outra está ausente.
  function corProduto(modelo) {
    if (!modelo) return null;
    var cor1 = modelo.cor_1 && modelo.cor_1.nome ? modelo.cor_1.nome : null;
    var cor2 = modelo.cor_2 && modelo.cor_2.nome ? modelo.cor_2.nome : null;
    return (cor1 && cor2) ? (cor1 + '/' + cor2) : (cor1 || cor2 || null);
  }

  // Rótulo do produto: NOITE · 2,10 m · KRAFT/CRU
  function rotuloProduto(modelo) {
    if (!modelo) return 'Produto não identificado';
    var cores = corProduto(modelo);
    var partes = [modelo.nome, fmtLargura(modelo.largura)];
    if (cores) partes.push(cores);
    return partes.join(' · ');
  }

  function fmtData(valor) {
    if (!valor) return null;
    var d = new Date(valor);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR');
  }

  // O MOMENTO do lançamento, com hora: numa recuperação de erro de digitação
  // dois lançamentos do mesmo produto podem ser do mesmo dia, e só a data não
  // distinguiria o que o operador acabou de fazer do que fez antes.
  function fmtMomento(valor) {
    if (!valor) return null;
    var d = new Date(valor);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR') + ' às '
      + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Motivos estáveis devolvidos por _tecelagem_op_pode_iniciar (db/123), que
  // por sua vez encaminha os de _pedido_permite_op_tecelagem (db/121).
  // Um código desconhecido nunca é escondido nem traduzido em suposição.
  var MOTIVO = {
    PEDIDO_NAO_CONFIRMADO:   'o pedido ainda não foi confirmado',
    PEDIDO_CANCELADO:        'o pedido foi cancelado',
    PEDIDO_NAO_ENCONTRADO:   'o pedido não foi localizado',
    OP_TECELAGEM_SEM_PEDIDO: 'a OP ainda não está ligada a um pedido',
    OP_AINDA_NAO_ABERTA:     'a OP ainda não foi aberta',
    OP_ENCERRADA:            'a OP já foi encerrada',
    OP_TECELAGEM_INEXISTENTE:'a OP não está mais disponível',
  };

  // O estado da execução mapeado para um estado de ciclo de vida JÁ regrado em
  // js/badges.js. A tela não declara família nem cor: escolhe o significado e
  // o dono canônico decide como ele se parece.
  var ESTADO_CANONICO = {
    em_producao: 'em_producao',
    pode_iniciar: 'aberta',
    encerrada: 'finalizada',
  };

  // O que o operador pode fazer com esta OP AGORA — derivado do read model,
  // nunca recalculado aqui. `podeIniciar` e `podeRegistrar` são as duas únicas
  // portas de ação, e são mutuamente exclusivas por construção do read model.
  function execucao(op) {
    var s = op && op.situacao_execucao;

    if (s === 'em_producao') {
      var data = fmtData(op && op.producao_iniciada_em);
      return {
        podeIniciar: false,
        podeRegistrar: true,
        pill: 'Produção iniciada',
        rotulo: data
          ? ('Produção iniciada em ' + data + '. O registro de rolos está liberado.')
          : 'Produção iniciada. O registro de rolos está liberado.',
      };
    }

    if (s === 'pode_iniciar') {
      return {
        podeIniciar: true,
        podeRegistrar: false,
        pill: 'Pronta para iniciar',
        rotulo: 'Pronta para iniciar produção. Inicie a produção para registrar rolos.',
      };
    }

    if (s === 'encerrada') {
      return {
        podeIniciar: false,
        podeRegistrar: false,
        pill: 'Encerrada',
        rotulo: 'OP encerrada. Os rolos permanecem visíveis para consulta.',
      };
    }

    var motivo = MOTIVO[op && op.motivo_bloqueio] || null;
    return {
      podeIniciar: false,
      podeRegistrar: false,
      pill: 'Não liberada',
      rotulo: motivo
        ? ('Ainda não liberada: ' + motivo + '.')
        : 'Ainda não liberada para produção.',
    };
  }

  // A pílula carrega o estado OPERACIONAL da tecelagem — o mesmo que a linha
  // de texto declara por extenso logo abaixo.
  function execucaoPill(op) {
    var e = execucao(op);
    return window.RV_BADGES.rvStatusPill(
      e.pill, ESTADO_CANONICO[op && op.situacao_execucao] || 'bloqueada');
  }

  // Linha de execução: o estado NUNCA é comunicado só pela cor da pílula.
  function linhaExecucao(op) {
    return window.el('div', {
      style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-top:6px;',
    }, execucao(op).rotulo);
  }

  // Cliente — informação definida pela Ravatex, somente leitura.
  function linhaCliente(op) {
    var nome = op && op.cliente_nome ? String(op.cliente_nome).trim() : '';
    return window.el('div', { style: 'margin-top:5px;' },
      window.el('span', {
        style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
      }, 'Cliente: '),
      window.el('span', {
        style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-primary); font-weight:600;',
      }, nome || 'não informado')
    );
  }

  function guardaFornecedor(container, titulo) {
    if (window.CURRENT_USER && window.CURRENT_USER.fornecedor_id) return false;
    container.replaceChildren(
      window.pageHeader(titulo),
      card(emptyText('Seu usuário não está vinculado a um fornecedor. Fale com o administrador.'))
    );
    return true;
  }

  // -------------------------------------------------------------------
  // Leituras. Todas passam pelas políticas SELECT do fornecedor: uma OP que
  // não é deste fornecedor simplesmente não retorna linha.
  // -------------------------------------------------------------------

  // A lista de trabalho da tecelagem. Vem inteira do dono do read model, que
  // já resolve o CLIENTE e a elegibilidade de execução a partir do ciclo de
  // vida existente. A tela não recalcula nem reinterpreta nenhum dos dois.
  async function carregarOps() {
    var res = await window.supa.rpc('tecelagem_minhas_ops');
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function carregarOp(opId) {
    var ops = await carregarOps();
    return ops.filter(function (o) { return String(o.op_id) === String(opId); })[0] || null;
  }

  // Produtos da OP + o modelo que os descreve. Dado definido pela Ravatex.
  //
  // emborrachar mora em op_itens (db/124), não em modelos: é a instrução da
  // ESPECIFICAÇÃO deste produto NESTA OP, não um atributo do modelo
  // reutilizável — o mesmo modelo em outra OP pode carregar outra instrução.
  // tipo_produto vem de modelos porque é o dono existente e único da
  // distinção tapete/manta (db/78); é lido aqui só para decidir a
  // aplicabilidade de EMBORRACHAR, nunca reescrito.
  async function carregarProdutos(opId) {
    var itensRes = await window.supa.from('op_itens')
      .select('id, op_id, modelo_id, metros_pedidos, metros_ajustados, emborrachar')
      .eq('op_id', opId)
      .order('id');
    if (itensRes.error) throw itensRes.error;
    var itens = itensRes.data || [];
    if (!itens.length) return [];

    var modeloIds = Array.from(new Set(itens.map(function (i) { return i.modelo_id; })));
    var modelosRes = await window.supa.from('modelos')
      .select('id, nome, largura, tipo_produto, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)')
      .in('id', modeloIds);
    if (modelosRes.error) throw modelosRes.error;

    var porId = {};
    (modelosRes.data || []).forEach(function (m) { porId[m.id] = m; });
    itens.forEach(function (i) { i.modelo = porId[i.modelo_id] || null; });
    return itens;
  }

  // Rolos já registrados, por produto. RLS garante que só vêm os deste
  // fornecedor.
  async function carregarRolos(opItemIds) {
    if (!opItemIds.length) return {};
    var res = await window.supa.from('tecelagem_rolos')
      .select('id, op_id, op_item_id, numero, comprimento_m, situacao, criado_em')
      .in('op_item_id', opItemIds)
      .order('numero');
    if (res.error) throw res.error;
    var porItem = {};
    (res.data || []).forEach(function (r) {
      (porItem[r.op_item_id] = porItem[r.op_item_id] || []).push(r);
    });
    return porItem;
  }

  // LANÇAMENTOS DE PRODUÇÃO deste produto — a superfície de recuperação.
  //
  // Vem do read model de db/126, e não de uma leitura direta da tabela, porque
  // a ELEGIBILIDADE do desfazer tem um dono único no servidor
  // (_tecelagem_lancamento_pode_desfazer). Recalcular aqui o que já está
  // decidido lá seria criar uma segunda regra livre para divergir da primeira.
  async function carregarLancamentos(opItemId) {
    var res = await window.supa.rpc('tecelagem_lancamentos_recentes', { p_op_item_id: Number(opItemId) });
    if (res.error) throw res.error;
    return res.data || [];
  }

  // -------------------------------------------------------------------
  // ETIQUETAS — dois conceitos de produto distintos, nunca fundidos (§6).
  //
  //   ETIQUETA DO ROLO         identifica o rolo físico da tecelagem.
  //   ETIQUETA PARA O ACABAMENTO   carrega a instrução operacional da
  //                                 próxima etapa (EMBORRACHAR).
  //
  // As duas são SOMENTE LEITURA sobre dado já carregado nesta tela: nenhuma
  // delas chama RPC nova, grava nada, cria rolo ou lançamento, nem muda
  // estado de OP. Imprimir é saída de informação existente, não mutação de
  // produção — a isolação desta fase (db/123) permanece intacta.
  //
  // Mecânica de impressão: cada etiqueta é montada UMA vez, como uma lista
  // ordenada de pares [rótulo, valor] (`camposEtiquetaRolo` /
  // `camposBasicosAcabamento`). Essa mesma lista alimenta dois
  // renderizadores — o nó DOM da pré-visualização dentro do modal
  // (`campoBloco`/`nodeEtiquetaGenerica`) e o HTML da janela de impressão
  // (`linhaHtml`) — para que os dois nunca possam divergir sobre QUAIS
  // campos aparecem. QR físico escaneável fica fora desta fase (fora de
  // escopo: "workflow de leitura de QR"); IDENTIFICAÇÃO é o código de texto
  // legível que a etiqueta do rolo exige.
  // -------------------------------------------------------------------

  function escapeHtml(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Código de identificação textual do rolo. Não é um QR escaneável — a
  // leitura por QR é workflow de fase futura (fora de escopo desta fatia).
  function identificacaoRolo(op, rolo) {
    return window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op) + ' · ROLO ' + fmtRolo(rolo.numero);
  }

  // ETIQUETA DO ROLO — CLIENTE, MODELO, COR, LARGURA, OP, ROLO,
  // IDENTIFICAÇÃO e, SE o rolo tiver comprimento registrado, COMPRIMENTO.
  // A ausência de comprimento nunca bloqueia a etiqueta (§1/§2 do produto).
  function camposEtiquetaRolo(op, produto, rolo) {
    var modelo = produto && produto.modelo;
    var linhas = [
      ['CLIENTE', op && op.cliente_nome ? String(op.cliente_nome).trim() : null],
      ['MODELO', modelo ? modelo.nome : null],
      ['COR', corProduto(modelo)],
      ['LARGURA', modelo ? fmtLargura(modelo.largura) : null],
      ['OP', window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)],
      ['ROLO', fmtRolo(rolo.numero)],
    ];
    if (rolo.comprimento_m != null) linhas.push(['COMPRIMENTO', fmtMetros(rolo.comprimento_m)]);
    linhas.push(['IDENTIFICAÇÃO', identificacaoRolo(op, rolo)]);
    return linhas.filter(function (par) { return par[1] != null && par[1] !== ''; });
  }

  // Campos comuns da ETIQUETA PARA O ACABAMENTO. EMBORRACHAR e COMPRIMENTO
  // NÃO entram aqui: EMBORRACHAR tem renderização própria com destaque
  // visual (§4), e COMPRIMENTO é sempre uma linha em branco para
  // preenchimento manual (§5) — nunca um valor filtrável como os demais.
  function camposBasicosAcabamento(op, produto) {
    var modelo = produto && produto.modelo;
    var linhas = [
      ['CLIENTE', op && op.cliente_nome ? String(op.cliente_nome).trim().toUpperCase() : null],
      ['MODELO', modelo ? modelo.nome : null],
      ['COR', corProduto(modelo)],
    ];
    return linhas.filter(function (par) { return par[1] != null && par[1] !== ''; });
  }

  // EMBORRACHAR: definido pela Ravatex por PRODUTO DA OP (op_itens.emborrachar,
  // db/124) — nunca pelo modelo reutilizável, e nunca escolhido ou editado
  // pela tecelagem aqui. Três estados de primeira classe, nenhum inferido:
  //
  //   'valor'         — a Ravatex já definiu a instrução para ESTE produto
  //                      desta OP.
  //   'nao_definido'  — produto aplicável (Tapete), mas ainda sem instrução
  //                      registrada. Nunca bloqueia a etiqueta.
  //   'nao_aplica'    — Manta nunca leva borracha (regra de produto); isto é
  //                      DIFERENTE de "não definido" e não pode ser
  //                      confundido com ele.
  //
  // A distinção tapete/manta vem do único dono existente dela,
  // modelos.tipo_produto (db/78) — esta função não inventa uma segunda
  // classificação nem infere o lado/cor a emborrachar por nenhuma regra
  // implícita.
  function estadoEmborrachar(produto) {
    var modelo = produto && produto.modelo;
    if (modelo && String(modelo.tipo_produto).trim().toLowerCase() === 'manta') {
      return { estado: 'nao_aplica', valor: null };
    }
    var bruto = produto && produto.emborrachar ? String(produto.emborrachar).trim() : '';
    return bruto ? { estado: 'valor', valor: bruto } : { estado: 'nao_definido', valor: null };
  }

  var TEXTO_EMBORRACHAR = {
    nao_definido: 'Não definido pela Ravatex',
    nao_aplica: 'Não se aplica',
  };

  function textoEmborrachar(estado) {
    return estado.estado === 'valor' ? estado.valor : TEXTO_EMBORRACHAR[estado.estado];
  }

  // MANTA NÃO TEM ETIQUETA DE ACABAMENTO (regra de produto, não apenas um
  // valor diferente dentro da etiqueta): a própria AÇÃO fica indisponível.
  // Deriva do MESMO estado tri-valor acima — não é uma segunda classificação
  // tapete/manta, é a mesma decisão lida de outro ângulo.
  function temEtiquetaAcabamento(produto) {
    return estadoEmborrachar(produto).estado !== 'nao_aplica';
  }

  // MANTA TAMBÉM NÃO OFERECE A SAÍDA PARA O ACABAMENTO (§6 do produto): a
  // mesma regra de aplicabilidade da etiqueta de acabamento, porque é
  // literalmente o mesmo fato de produto — Manta não passa pelo acabamento
  // de látex. Delegar em estadoEmborrachar mantém um ÚNICO dono da distinção
  // tapete/manta; esta função só nomeia a mesma decisão para a ação de saída.
  function temSaidaAcabamento(produto) {
    return estadoEmborrachar(produto).estado !== 'nao_aplica';
  }

  // -- pré-visualização em DOM (dentro do modal) --------------------------

  function campoBloco(rotulo, valor) {
    return window.el('div', { style: 'margin-bottom:10px;' },
      window.el('div', {
        style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
          + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
      }, rotulo),
      window.el('div', {
        style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary); margin-top:2px;',
      }, valor)
    );
  }

  function nodeEtiquetaGenerica(linhas) {
    var wrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
    linhas.forEach(function (par) { wrap.appendChild(campoBloco(par[0], par[1])); });
    return wrap;
  }

  // O bloco EMBORRACHAR é visualmente destacado (borda + fonte maior) porque
  // é uma instrução operacional para a PRÓXIMA etapa, não um dado de
  // identificação como os demais (§4 do produto).
  function blocoEmborrachar(produto) {
    return window.el('div', {
      style: 'margin:2px 0 10px; padding:10px 12px; border:1px solid var(--rv-border-strong);'
        + ' border-radius:var(--rv-radius); background:var(--rv-chip-bg);',
    },
      window.el('div', {
        style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
          + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
      }, 'Emborrachar'),
      window.el('div', {
        style: 'font-size:var(--rv-fs-section-heading); font-weight:800; color:var(--rv-text-primary); margin-top:3px;',
      }, textoEmborrachar(estadoEmborrachar(produto)))
    );
  }

  function nodeEtiquetaAcabamento(op, produto) {
    var wrap = window.el('div', { style: 'display:flex; flex-direction:column;' });
    camposBasicosAcabamento(op, produto).forEach(function (par) { wrap.appendChild(campoBloco(par[0], par[1])); });
    wrap.appendChild(blocoEmborrachar(produto));
    wrap.appendChild(campoBloco('OP', window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)));
    // Comprimento do ACABAMENTO nunca reaproveita o comprimento do rolo de
    // tecelagem (§5): na próxima etapa rolos podem ser abertos e emendados,
    // então o comprimento final é outro. Fica em branco para preenchimento
    // manual, deliberadamente.
    wrap.appendChild(campoBloco('Comprimento', '________________ m'));
    return wrap;
  }

  // -- HTML de impressão (janela dedicada) ---------------------------------

  function linhaHtml(rotulo, valor) {
    return '<div style="margin-bottom:10px;">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#667085;">'
      + escapeHtml(rotulo) + '</div>'
      + '<div style="font-size:15px;font-weight:700;color:#101828;margin-top:2px;">' + escapeHtml(valor) + '</div>'
      + '</div>';
  }

  function corpoEtiquetaRolo(op, produto, rolo) {
    return camposEtiquetaRolo(op, produto, rolo).map(function (par) { return linhaHtml(par[0], par[1]); }).join('');
  }

  function corpoEtiquetaAcabamento(op, produto) {
    var partes = camposBasicosAcabamento(op, produto).map(function (par) { return linhaHtml(par[0], par[1]); });
    partes.push(
      '<div style="margin:2px 0 10px; padding:10px 12px; border:1px solid #667085; border-radius:4px;">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#667085;">EMBORRACHAR</div>'
      + '<div style="font-size:18px;font-weight:800;color:#101828;margin-top:3px;">'
      + escapeHtml(textoEmborrachar(estadoEmborrachar(produto))) + '</div></div>'
    );
    partes.push(linhaHtml('OP', window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)));
    partes.push(linhaHtml('Comprimento', '________________ m'));
    return partes.join('');
  }

  function documentoImpressao(titulo, corpoHtml) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeHtml(titulo) + '</title>'
      + '<style>@page{size:80mm auto; margin:6mm;} body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:12px;color:#101828;}'
      + '.rv-etiqueta{page-break-after:always;}</style></head><body>' + corpoHtml + '</body></html>';
  }

  // Mecânica de impressão do navegador (§7 do produto: implementação livre
  // do executor, nunca virando regra de produto permanente). Uma janela
  // nova evita tocar no CSS/impressão do resto do app; se o navegador
  // bloquear o pop-up, a recusa é comunicada — nunca falha silenciosa.
  function imprimir(titulo, corpoHtml) {
    var win = window.open('', '_blank');
    if (!win) {
      window.toast('Não foi possível abrir a janela de impressão. Habilite pop-ups.', 'error');
      return;
    }
    win.document.open();
    win.document.write(documentoImpressao(titulo, corpoHtml));
    win.document.close();
    win.focus();
    win.print();
  }

  // -- ações que abrem a pré-visualização ----------------------------------

  function abrirEtiquetaRolo(op, produto, rolo) {
    window.modal({
      title: 'Etiqueta do rolo ' + fmtRolo(rolo.numero),
      saveLabel: 'Imprimir',
      body: nodeEtiquetaGenerica(camposEtiquetaRolo(op, produto, rolo)),
      onSave: function () {
        imprimir('Etiqueta - Rolo ' + fmtRolo(rolo.numero), corpoEtiquetaRolo(op, produto, rolo));
      },
    });
  }

  function abrirEtiquetaAcabamento(op, produto) {
    window.modal({
      title: 'Etiqueta para o acabamento',
      saveLabel: 'Imprimir',
      body: nodeEtiquetaAcabamento(op, produto),
      onSave: function () {
        imprimir('Etiqueta de acabamento', corpoEtiquetaAcabamento(op, produto));
      },
    });
  }

  // ETIQUETAS DISPONÍVEIS: aberta logo depois de um registro de produção
  // bem-sucedido, com os rolos que ACABARAM de ser criados. O operador não
  // precisa voltar a identificá-los para poder imprimir (§2 do produto).
  function abrirEtiquetasDisponiveis(op, produto, rolosCriados) {
    var lista = window.el('div', { style: 'display:flex; flex-direction:column;' });
    rolosCriados.forEach(function (rolo) {
      lista.appendChild(window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:8px;'
          + ' padding:9px 0; border-top:1px solid var(--rv-border-soft);',
      },
        window.el('span', {
          style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
        }, 'Rolo ' + fmtRolo(rolo.numero)),
        secondaryButton('Imprimir etiqueta', function () {
          imprimir('Etiqueta - Rolo ' + fmtRolo(rolo.numero), corpoEtiquetaRolo(op, produto, rolo));
        })
      ));
    });

    window.modal({
      title: rolosCriados.length === 1
        ? '1 rolo criado — etiqueta disponível'
        : rolosCriados.length + ' rolos criados — etiquetas disponíveis',
      saveLabel: 'Imprimir todas',
      body: lista,
      onSave: function () {
        var corpo = rolosCriados.map(function (rolo) {
          return '<div class="rv-etiqueta">' + corpoEtiquetaRolo(op, produto, rolo) + '</div>';
        }).join('');
        imprimir('Etiquetas - ' + window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op), corpo);
      },
    });
  }

  // -------------------------------------------------------------------
  // SAÍDA PARA O ACABAMENTO — VER ROLOS -> SELECIONAR ROLOS -> DAR SAÍDA
  //
  // A situação operacional do rolo (§1 do produto). Exatamente dois valores
  // nesta fase; um valor desconhecido nunca é escondido nem traduzido em
  // suposição — mesma disciplina de MOTIVO acima.
  // -------------------------------------------------------------------
  var SITUACAO_ROLO = {
    na_tecelagem:       { rotulo: 'Na tecelagem',          estado: 'em_producao' },
    enviado_acabamento: { rotulo: 'Enviado ao acabamento', estado: 'concluida' },
  };

  function situacaoRolo(rolo) {
    var chave = rolo && rolo.situacao;
    return SITUACAO_ROLO[chave] || { rotulo: chave || 'Situação desconhecida', estado: 'neutral' };
  }

  // Traduz a recusa do escritor de saída. Um código desconhecido nunca é
  // escondido: cai numa mensagem honesta e genérica, mesma disciplina de
  // mensagemDeErro/mensagemDeInicio acima.
  function mensagemDeSaida(error) {
    var texto = (error && (error.message || error.details)) || '';
    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_ROLOS_OBRIGATORIOS') >= 0) {
      return 'Selecione ao menos um rolo.';
    }
    if (texto.indexOf('TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Um ou mais rolos selecionados não pertencem a você.';
    }
    if (texto.indexOf('TECELAGEM_ROLO_NAO_ELEGIVEL_PARA_SAIDA') >= 0) {
      return 'Um ou mais rolos selecionados já não estão na tecelagem. Atualize a lista e tente novamente.';
    }
    if (texto.indexOf('TECELAGEM_MANTA_NAO_VAI_PARA_ACABAMENTO') >= 0) {
      return 'Manta não vai para o acabamento.';
    }
    return 'Não foi possível confirmar a saída. Nada foi gravado.';
  }

  // DAR SAÍDA PARA ACABAMENTO — a seleção opera sobre ROLOS INDIVIDUAIS,
  // nunca uma quantidade. Só rolos `na_tecelagem` aparecem como
  // selecionáveis: um rolo já enviado simplesmente não entra nesta lista
  // (§5 do produto) em vez de aparecer marcável e ser recusado depois.
  function abrirSaidaAcabamento(op, produto, rolos, aoConcluir) {
    var elegiveis = rolos.filter(function (r) { return r.situacao === 'na_tecelagem'; });
    var selecionados = {};
    var checkboxPorId = {};

    var checkboxTodos = window.checkboxInput({
      checked: false,
      ariaLabel: 'Selecionar todos os rolos',
      onchange: function (e) {
        var marcado = !!e.target.checked;
        elegiveis.forEach(function (r) { selecionados[r.id] = marcado; });
        sincronizarLinhas();
      },
    });

    function sincronizarLinhas() {
      elegiveis.forEach(function (r) {
        var cb = checkboxPorId[r.id];
        if (cb) cb.checked = !!selecionados[r.id];
      });
      checkboxTodos.checked = elegiveis.length > 0
        && elegiveis.every(function (r) { return !!selecionados[r.id]; });
    }

    var linhas = window.el('div', { style: 'display:flex; flex-direction:column;' });

    if (!elegiveis.length) {
      linhas.appendChild(emptyText('Nenhum rolo disponível para dar saída.'));
    } else {
      elegiveis.forEach(function (rolo) {
        var cb = window.checkboxInput({
          checked: false,
          ariaLabel: 'Selecionar rolo ' + fmtRolo(rolo.numero),
          onchange: function (e) {
            selecionados[rolo.id] = !!e.target.checked;
            sincronizarLinhas();
          },
        });
        checkboxPorId[rolo.id] = cb;
        linhas.appendChild(window.el('div', {
          style: 'display:flex; align-items:center; gap:10px; padding:9px 0;'
            + ' border-top:1px solid var(--rv-border-soft);',
        },
          cb,
          window.el('span', {
            style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
          }, 'Rolo ' + fmtRolo(rolo.numero)),
          rolo.comprimento_m != null
            ? num(window.el('span', {
                style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-left:auto;',
              }, fmtMetros(rolo.comprimento_m)))
            : null
        ));
      });
    }

    var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:10px;' },
      elegiveis.length
        ? window.el('div', { style: 'display:flex; align-items:center; gap:10px;' },
            checkboxTodos,
            window.el('span', {
              style: 'font-size:var(--rv-fs-sm); font-weight:600; color:var(--rv-text-secondary);',
            }, 'Selecionar todos'))
        : null,
      linhas
    );

    window.modal({
      title: 'Dar saída para acabamento',
      saveLabel: 'Confirmar saída',
      body: corpo,
      onSave: async function () {
        var idsSelecionados = elegiveis
          .filter(function (r) { return !!selecionados[r.id]; })
          .map(function (r) { return r.id; });

        if (!idsSelecionados.length) {
          window.toast('Selecione ao menos um rolo.', 'error');
          return false;
        }

        var res = await window.supa.rpc('enviar_rolos_acabamento', { p_rolo_ids: idsSelecionados });
        if (res.error) {
          console.error(res.error);
          window.toast(mensagemDeSaida(res.error), 'error');
          return false;
        }

        // O toast identifica QUAIS rolos saíram, nunca apenas uma contagem
        // (§3 do produto): "3 rolos saíram" sozinho não é uma frase válida
        // nesta tela.
        var enviados = elegiveis.filter(function (r) { return idsSelecionados.indexOf(r.id) >= 0; });
        var numeros = enviados.map(function (r) { return fmtRolo(r.numero); }).sort().join(', ');
        window.toast(
          enviados.length === 1
            ? ('Rolo ' + numeros + ' enviado ao acabamento.')
            : ('Rolos ' + numeros + ' enviados ao acabamento.'),
          'success'
        );
        if (typeof aoConcluir === 'function') aoConcluir();
      },
    });
  }

  // -------------------------------------------------------------------
  // TELA 1 — MINHAS OPs
  // -------------------------------------------------------------------
  function screenTecelagemOps() {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'Minhas OPs')) return;

      var ops;
      try {
        ops = await carregarOps();
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('Minhas OPs'),
          card(emptyText('Não foi possível carregar suas OPs agora. Tente novamente.')));
        return;
      }

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      if (!ops.length) {
        corpo.appendChild(card(emptyText('Nenhuma OP em produção atribuída a você no momento.')));
      } else {
        ops.forEach(function (op) {
          var identidade = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);
          corpo.appendChild(card(
            window.el('div', {},
              window.el('div', {
                style: 'font-size:var(--rv-fs-section-heading); font-weight:700; color:var(--rv-text-primary);',
              }, identidade),
              linhaCliente(op),
              window.el('div', { style: 'margin-top:6px;' }, execucaoPill(op)),
              linhaExecucao(op)
            ),
            cardFooter(primaryButton('Abrir OP', function () {
              window.navigate('#/tecelagem/ops/' + op.op_id);
            }))
          ));
        });
      }

      container.replaceChildren(window.pageHeader('Minhas OPs'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // -------------------------------------------------------------------
  // TELA 2 — OP / PRODUÇÃO
  // O produto é a unidade operacional desta tela.
  // -------------------------------------------------------------------
  function screenTecelagemOp(opId) {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'OP')) return;

      var op, produtos, rolosPorItem;
      try {
        op = await carregarOp(opId);
        if (!op) {
          container.replaceChildren(
            window.pageHeader('OP'),
            card(emptyText('Esta OP não está disponível para o seu usuário.')),
            window.el('div', { style: 'margin-top:12px;' },
              secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); }))
          );
          return;
        }
        produtos = await carregarProdutos(opId);
        rolosPorItem = await carregarRolos(produtos.map(function (p) { return p.id; }));
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('OP'),
          card(emptyText('Não foi possível carregar a OP agora. Tente novamente.')));
        return;
      }

      var identidade = window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      // Identidade da OP e CLIENTE — dado da Ravatex, somente leitura.
      // INICIAR PRODUÇÃO pertence à OP, não ao produto: o fato local que ela
      // grava é da OP inteira, e é o que libera o registro em todos os
      // produtos dela.
      var estado = execucao(op);
      var opCard = card(
        sectionChip('Ordem de produção', ICON_LAYERS),
        window.el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;' },
          window.el('span', {
            style: 'font-size:var(--rv-fs-section-heading); font-weight:700; color:var(--rv-text-primary);',
          }, identidade),
          execucaoPill(op)
        ),
        linhaCliente(op),
        linhaExecucao(op)
      );
      if (estado.podeIniciar) {
        var botaoIniciar = primaryButton('Iniciar produção', function () {
          iniciarProducao(op, botaoIniciar, reload);
        });
        opCard.appendChild(cardFooter(botaoIniciar));
      }
      corpo.appendChild(opCard);

      var podeRegistrar = estado.podeRegistrar;

      // Produtos.
      if (!produtos.length) {
        corpo.appendChild(card(
          sectionChip('Produtos', ICON_BOX),
          emptyText('Esta OP ainda não tem produtos cadastrados.')
        ));
      } else {
        produtos.forEach(function (produto) {
          var rolos = rolosPorItem[produto.id] || [];
          var previsto = produto.metros_ajustados != null ? produto.metros_ajustados : produto.metros_pedidos;

          corpo.appendChild(card(
            sectionChip('Produto', ICON_BOX),
            window.el('div', {
              style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
            }, rotuloProduto(produto.modelo)),
            window.el('div', {
              style: 'display:flex; gap:24px; flex-wrap:wrap; margin-top:11px;',
            },
              window.el('div', {},
                window.el('div', {
                  style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
                    + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
                }, 'Previsto'),
                num(window.el('div', {
                  style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); margin-top:3px;',
                }, fmtMetros(previsto)))
              ),
              window.el('div', {},
                window.el('div', {
                  style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
                    + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
                }, 'Produzido'),
                num(window.el('div', {
                  style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); margin-top:3px;',
                }, rolos.length === 1 ? '1 rolo' : rolos.length + ' rolos'))
              )
            ),
            cardFooter(
              secondaryButton('Ver rolos', function () {
                window.navigate('#/tecelagem/ops/' + op.op_id + '/produtos/' + produto.id + '/rolos');
              }),
              // Etiqueta para o acabamento: saída de leitura, sempre
              // disponível — nunca depende do estado de produção (§7 ISOLAMENTO).
              // AUSENTE para manta: a ação em si não existe, não só o valor
              // dentro dela (regra de produto — manta nunca é emborrachada).
              temEtiquetaAcabamento(produto) && secondaryButton('Etiqueta de acabamento', function () {
                abrirEtiquetaAcabamento(op, produto);
              }),
              // A ação só fica acionável depois do INÍCIO LOCAL da produção
              // desta OP. A recusa de verdade é do servidor (db/123); aqui ela
              // é apenas antecipada para o operador ver o estado.
              primaryButton('Registrar produção', function () {
                abrirRegistro(op, produto, reload);
              }, !podeRegistrar)
            )
          ));
        });
      }

      corpo.appendChild(window.el('div', {},
        secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); })));

      container.replaceChildren(window.pageHeader('OP'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // -------------------------------------------------------------------
  // INICIAR PRODUÇÃO (local à tecelagem)
  //
  // Grava o fato operacional desta superfície e recarrega a tela a partir do
  // read model — o estado exibido depois do início é o que o SERVIDOR diz, não
  // uma suposição otimista do cliente.
  // -------------------------------------------------------------------
  async function iniciarProducao(op, botao, aoConcluir) {
    // Um segundo clique enquanto o primeiro está em voo não pode virar uma
    // segunda chamada. (O dono da escrita é idempotente, mas a tela não pode
    // depender disso para não confundir o operador.)
    if (botao) {
      if (botao.disabled) return;
      botao.disabled = true;
    }

    var res = await window.supa.rpc('iniciar_producao_tecelagem', { p_op_id: op.op_id });

    if (res.error) {
      console.error(res.error);
      if (botao) botao.disabled = false;
      window.toast(mensagemDeInicio(res.error), 'error');
      return;
    }

    window.toast('Produção iniciada.', 'success');
    if (typeof aoConcluir === 'function') aoConcluir();
  }

  // -------------------------------------------------------------------
  // REGISTRAR PRODUÇÃO
  // A quantidade de rolos é a entrada primária. O comprimento individual é
  // OPCIONAL: registrar sem informá-lo é um caminho normal, não uma exceção.
  //
  // A UNIDADE É A DEFESA PRINCIPAL. Um operador real digitou 75 querendo dizer
  // «75 metros» e o sistema criou 75 rolos persistentes. O campo não pode ser
  // um número nu cujo significado seja razoavelmente confundível com metragem:
  // o rótulo diz ROLOS, o texto de apoio nega explicitamente a metragem, e o
  // eco abaixo do campo repete a unidade enquanto o operador digita.
  // -------------------------------------------------------------------

  // Acima desta quantidade o registro pede uma confirmação explícita que
  // REPETE A UNIDADE antes de materializar os rolos. É o ponto único onde essa
  // decisão de produto mora: mudá-la é mudar este número, não caçar condições
  // espalhadas. 75 — a quantidade do erro real — fica acima do limiar.
  var CONFIRMACAO_QUANTIDADE_ALTA = 20;

  function ecoQuantidade(qtd) {
    if (!isFinite(qtd) || qtd < 1) return '';
    return qtd === 1 ? '1 ROLO' : qtd + ' ROLOS';
  }

  function abrirRegistro(op, produto, aoConcluir) {
    var inputQtd = window.textInput({ type: 'number', value: '', placeholder: 'Ex.: 10' });
    inputQtd.setAttribute('min', '1');
    inputQtd.setAttribute('step', '1');
    inputQtd.setAttribute('inputmode', 'numeric');

    var inputComprimento = window.textInput({ type: 'number', value: '', placeholder: 'Opcional' });
    inputComprimento.setAttribute('min', '0');
    inputComprimento.setAttribute('step', '0.01');
    inputComprimento.setAttribute('inputmode', 'decimal');

    // O eco vive ao lado do campo e repete a unidade em caixa alta enquanto o
    // operador digita: 75 aparece como «75 ROLOS» ANTES de qualquer gravação.
    var eco = window.el('div', {
      'data-rv-tecelagem-eco-rolos': '',
      style: 'font-size:var(--rv-fs-sm); font-weight:700; letter-spacing:.02em;'
        + ' color:var(--rv-text-secondary); margin-top:6px; min-height:1.2em;',
    }, '');

    function atualizarEco() {
      eco.textContent = ecoQuantidade(parseInt(String(inputQtd.value).trim(), 10));
    }
    inputQtd.addEventListener('input', atualizarEco);

    // O eco acompanha o campo num invólucro próprio, em vez de ser injetado
    // dentro do nó que formField() devolve: a composição interna daquele nó
    // pertence ao dono canônico (js/ui.js) e esta tela não a manipula.
    var campoQtd = window.el('div', {},
      window.formField({
        label: 'Quantidade de rolos produzidos',
        input: inputQtd,
        hint: 'Informe a quantidade de rolos, não a metragem.',
      }),
      eco
    );

    var ref = window.modal({
      title: 'Registrar produção',
      saveLabel: 'Registrar produção',
      body: window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' },
        window.el('div', {},
          window.el('div', {
            style: 'font-size:var(--rv-fs-label); font-weight:700; text-transform:uppercase;'
              + ' letter-spacing:.02em; color:var(--rv-text-tertiary);',
          }, 'Produto'),
          window.el('div', {
            style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary); margin-top:3px;',
          }, rotuloProduto(produto.modelo))
        ),
        campoQtd,
        window.formField({
          label: 'Comprimento de cada rolo (metros)',
          input: inputComprimento,
          hint: 'Opcional. Se informado, vale para todos os rolos deste registro.',
        })
      ),
      // O dono do modal fecha sozinho quando onSave NÃO devolve `false`. Toda
      // recusa devolve `false` explicitamente para manter o formulário aberto
      // com o que o operador digitou.
      onSave: async function () {
        var qtd = parseInt(String(inputQtd.value).trim(), 10);
        if (!isFinite(qtd) || qtd < 1) {
          window.toast('Informe quantos rolos foram produzidos.', 'error');
          return false;
        }

        // O comprimento é opcional. Vazio significa "não informado", e isso
        // NÃO impede o registro: os rolos nascem sem comprimento e seguem
        // válidos.
        var bruto = String(inputComprimento.value).trim();
        var comprimentos = null;
        if (bruto !== '') {
          var c = Number(bruto.replace(',', '.'));
          if (!isFinite(c) || c <= 0) {
            window.toast('O comprimento informado precisa ser maior que zero.', 'error');
            return false;
          }
          comprimentos = new Array(qtd).fill(c);
        }

        // CONFIRMAÇÃO DE QUANTIDADE ALTA. O formulário fica aberto atrás do
        // diálogo (`return false`), com tudo o que o operador digitou, para
        // que CANCELAR devolva a chance de corrigir em vez de recomeçar.
        if (qtd >= CONFIRMACAO_QUANTIDADE_ALTA) {
          window.confirmDialog({
            title: 'Confirmar quantidade',
            message: textoConfirmacaoQuantidade(qtd),
            confirmLabel: 'Sim, registrar ' + qtd + ' rolos',
            danger: false,
            onConfirm: async function () {
              var ok = await gravarRegistro(op, produto, qtd, comprimentos, aoConcluir);
              if (ok) ref.close();
            },
          });
          return false;
        }

        var ok = await gravarRegistro(op, produto, qtd, comprimentos, aoConcluir);
        return ok ? undefined : false;
      },
    });
  }

  // A frase de confirmação REPETE A UNIDADE e nomeia explicitamente o engano
  // que ela existe para impedir. Não adivinha que um número alto significa
  // metros: pergunta.
  function textoConfirmacaoQuantidade(qtd) {
    return 'VOCÊ ESTÁ REGISTRANDO ' + qtd + ' ROLOS. '
      + 'Isto vai criar ' + qtd + ' rolos individuais, um a um. '
      + 'Se você quis informar a METRAGEM produzida, cancele: este campo é a '
      + 'quantidade de rolos, não os metros.';
  }

  // O caminho único de gravação do registro, compartilhado pelo fluxo direto e
  // pelo fluxo confirmado — os dois não podem divergir. Devolve `true` quando
  // gravou.
  async function gravarRegistro(op, produto, qtd, comprimentos, aoConcluir) {
    var res = await window.supa.rpc('registrar_producao_tecelagem', {
      p_op_item_id: produto.id,
      p_quantidade_rolos: qtd,
      p_comprimentos: comprimentos,
    });

    if (res.error) {
      console.error(res.error);
      window.toast(mensagemDeErro(res.error), 'error');
      return false;
    }

    var criados = (res.data && res.data.quantidade_rolos) || qtd;
    window.toast(criados === 1 ? '1 rolo registrado.' : criados + ' rolos registrados.', 'success');
    if (typeof aoConcluir === 'function') aoConcluir();

    // ETIQUETAS DISPONÍVEIS logo após o registro: o operador não precisa
    // voltar a identificar os rolos que acabou de criar (§2 do produto).
    // Os rolos vêm do PRÓPRIO retorno do dono da escrita
    // (numero_inicial/numero_final) e do comprimento que este mesmo
    // formulário já validou — sem nova leitura ao servidor.
    var numeroInicial = res.data && res.data.numero_inicial;
    var numeroFinal = res.data && res.data.numero_final;
    if (numeroInicial != null && numeroFinal != null) {
      var rolosCriados = [];
      for (var n = numeroInicial; n <= numeroFinal; n += 1) {
        rolosCriados.push({
          numero: n,
          comprimento_m: comprimentos ? comprimentos[n - numeroInicial] : null,
        });
      }
      abrirEtiquetasDisponiveis(op, produto, rolosCriados);
    }
    return true;
  }

  // Traduz a recusa do dono da escrita para uma frase operacional. Um código
  // desconhecido nunca é escondido: cai numa mensagem honesta e genérica.
  function mensagemDeErro(error) {
    var texto = (error && (error.message || error.details)) || '';
    if (texto.indexOf('TECELAGEM_PRODUTO_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Este produto não pertence a uma OP atribuída a você.';
    }
    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_PRODUCAO_NAO_INICIADA') >= 0) {
      return 'Inicie a produção desta OP antes de registrar rolos.';
    }
    if (texto.indexOf('TECELAGEM_OP_ENCERRADA') >= 0) {
      return 'Esta OP já foi encerrada e não recebe mais produção.';
    }
    if (texto.indexOf('TECELAGEM_QUANTIDADE_ACIMA_DO_LIMITE') >= 0) {
      return 'Registre no máximo 500 rolos por vez.';
    }
    if (texto.indexOf('TECELAGEM_QUANTIDADE_INVALIDA') >= 0) {
      return 'Informe quantos rolos foram produzidos.';
    }
    if (texto.indexOf('TECELAGEM_COMPRIMENTO_INVALIDO') >= 0) {
      return 'O comprimento informado precisa ser maior que zero.';
    }
    return 'Não foi possível registrar a produção. Nada foi gravado.';
  }

  // Recusas do início local. O DETAIL carrega o motivo estável de
  // _tecelagem_op_pode_iniciar, então a mensagem diz POR QUE, sem inventar.
  function mensagemDeInicio(error) {
    var texto = (error && (error.message || '')) || '';
    var detalhe = (error && (error.details || error.detail || '')) || '';

    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_OP_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Esta OP não está atribuída a você.';
    }
    if (texto.indexOf('TECELAGEM_OP_NAO_ELEGIVEL_PARA_INICIO') >= 0) {
      var motivo = null;
      Object.keys(MOTIVO).forEach(function (codigo) {
        if (detalhe.indexOf(codigo) >= 0) motivo = MOTIVO[codigo];
      });
      return motivo
        ? ('Não é possível iniciar a produção: ' + motivo + '.')
        : 'Esta OP ainda não pode ter a produção iniciada.';
    }
    return 'Não foi possível iniciar a produção. Nada foi gravado.';
  }

  // -------------------------------------------------------------------
  // DESFAZER LANÇAMENTO
  //
  // Um lançamento de produção é um EVENTO EM LOTE: uma ação do operador que
  // materializa N rolos. A recuperação de um erro de digitação tem de operar
  // no mesmo nível — o lote — e não obrigar a apagar 75 rolos um a um.
  //
  // A REGRA DE SEGURANÇA É DO SERVIDOR (db/126). Esta tela apenas antecipa o
  // veredito que o read model já traz (`pode_desfazer` / `motivo_bloqueio`):
  // se algum rolo do lote já saiu para o acabamento, o desfazer normal é
  // RECUSADO e explicado, nunca aplicado em silêncio, e nenhuma movimentação
  // de acabamento é revertida automaticamente nesta fase.
  // -------------------------------------------------------------------

  // Descreve o lote pelo EVENTO DE NEGÓCIO — produto, quantidade, momento e
  // faixa de rolos —, nunca pelo id técnico.
  function descricaoLancamento(lancamento) {
    var qtd = Number(lancamento.quantidade_rolos);
    var partes = [isFinite(qtd) ? (qtd === 1 ? '1 rolo' : qtd + ' rolos') : 'rolos'];
    if (lancamento.numero_inicial != null && lancamento.numero_final != null) {
      partes.push(lancamento.numero_inicial === lancamento.numero_final
        ? ('Rolo ' + fmtRolo(lancamento.numero_inicial))
        : ('Rolos ' + fmtRolo(lancamento.numero_inicial) + ' a ' + fmtRolo(lancamento.numero_final)));
    }
    var momento = fmtMomento(lancamento.criado_em);
    if (momento) partes.push(momento);
    return partes.join(' · ');
  }

  // Motivos estáveis de _tecelagem_lancamento_pode_desfazer (db/126). Um
  // código desconhecido nunca é escondido nem traduzido em suposição.
  var MOTIVO_DESFAZER = {
    LANCAMENTO_COM_ROLOS_JA_ENVIADOS:
      'Rolos deste lançamento já saíram para o acabamento. Ele não pode mais ser'
      + ' revertido por completo nesta ação. Fale com a Ravatex.',
    LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR:
      'Este lançamento não pertence ao seu usuário.',
    LANCAMENTO_INEXISTENTE:
      'Este lançamento não está mais disponível.',
  };

  function motivoDesfazer(lancamento) {
    return MOTIVO_DESFAZER[lancamento && lancamento.motivo_bloqueio]
      || 'Este lançamento não pode ser desfeito por esta ação.';
  }

  function mensagemDeDesfazer(error) {
    var texto = (error && (error.message || error.details)) || '';
    if (texto.indexOf('TECELAGEM_LANCAMENTO_JA_PROGREDIU') >= 0) {
      return MOTIVO_DESFAZER.LANCAMENTO_COM_ROLOS_JA_ENVIADOS;
    }
    if (texto.indexOf('TECELAGEM_LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return MOTIVO_DESFAZER.LANCAMENTO_FORA_DO_ESCOPO_DO_FORNECEDOR;
    }
    if (texto.indexOf('TECELAGEM_LANCAMENTO_NAO_ENCONTRADO') >= 0) {
      return MOTIVO_DESFAZER.LANCAMENTO_INEXISTENTE;
    }
    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    if (texto.indexOf('TECELAGEM_DESFAZER_CARDINALIDADE_INCONSISTENTE') >= 0) {
      return 'Este lançamento está inconsistente e não foi alterado. Fale com a Ravatex.';
    }
    return 'Não foi possível desfazer o lançamento. Nada foi alterado.';
  }

  function abrirDesfazerLancamento(produto, lancamento, aoConcluir) {
    var qtd = Number(lancamento.quantidade_rolos);
    window.confirmDialog({
      title: 'Desfazer lançamento',
      message: 'Este lançamento de ' + (qtd === 1 ? '1 rolo' : qtd + ' rolos')
        + ' em ' + rotuloProduto(produto.modelo) + ' será desfeito, junto com todos os '
        + 'rolos que ele criou (' + descricaoLancamento(lancamento) + '). '
        + 'Depois disso você pode registrar a produção correta.',
      confirmLabel: 'Desfazer lançamento',
      onConfirm: async function () {
        var res = await window.supa.rpc('desfazer_lancamento_tecelagem', {
          p_lancamento_id: Number(lancamento.lancamento_id),
        });
        if (res.error) {
          console.error(res.error);
          window.toast(mensagemDeDesfazer(res.error), 'error');
          return;
        }
        var removidos = (res.data && res.data.rolos_removidos) != null
          ? res.data.rolos_removidos : qtd;
        window.toast('Lançamento desfeito. '
          + (removidos === 1 ? '1 rolo removido.' : removidos + ' rolos removidos.'), 'success');
        if (typeof aoConcluir === 'function') aoConcluir();
      },
    });
  }

  // O card de recuperação. Só existe quando há lançamento: um card vazio não
  // ensina nada ao operador.
  function cardLancamentos(produto, lancamentos, aoConcluir) {
    if (!lancamentos.length) return null;

    var bloco = card(sectionChip('Lançamentos de produção', ICON_UNDO));
    bloco.appendChild(window.el('p', {
      style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin:0 0 4px;',
    }, 'Cada lançamento é um registro em lote. Desfazer um lançamento remove'
      + ' todos os rolos que ele criou.'));

    lancamentos.forEach(function (lancamento) {
      var linha = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:12px;'
          + ' flex-wrap:wrap; padding:10px 0; border-top:1px solid var(--rv-border-soft);',
      });

      var texto = window.el('div', { style: 'min-width:0;' },
        window.el('div', {
          style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
        }, descricaoLancamento(lancamento))
      );
      // O estado NUNCA é comunicado só pela ausência do botão: quando o lote
      // já progrediu, a tela DIZ por quê.
      if (!lancamento.pode_desfazer) {
        texto.appendChild(window.el('div', {
          style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-top:4px;',
        }, motivoDesfazer(lancamento)));
      }
      linha.appendChild(texto);

      linha.appendChild(secondaryButton('Desfazer lançamento', function () {
        abrirDesfazerLancamento(produto, lancamento, aoConcluir);
      }, !lancamento.pode_desfazer));

      bloco.appendChild(linha);
    });

    return bloco;
  }

  // -------------------------------------------------------------------
  // EXCLUIR ROLO — a segunda correção, e deliberadamente independente da
  // primeira.
  //
  //   EXCLUIR ROLO         remove UM rolo físico registrado por engano.
  //   DESFAZER LANÇAMENTO  reverte o LOTE inteiro (db/126), inalterado.
  //
  // NENHUMA das duas é expressa em termos da outra. Desfazer cinco rolos para
  // corrigir um não seria correção, seria um segundo erro.
  //
  // NUMERAÇÃO É IDENTIDADE. Excluir o rolo 003 deixa 001, 002, 004 e 005 com os
  // próprios números: o número está impresso numa etiqueta já colada num rolo
  // físico, e renumerar faria o banco discordar do galpão. A lacuna é
  // permanente e o servidor (db/127) nunca reemite o número liberado.
  //
  // A recusa é do SERVIDOR: a ação que a tela desabilita é conveniência, nunca
  // a defesa.
  // -------------------------------------------------------------------

  // Deriva do MESMO fato que o dono da elegibilidade no servidor
  // (_tecelagem_rolo_pode_excluir) lê: a situação do próprio rolo. Escrita como
  // «é na_tecelagem», e não «não é enviado», para que uma situação futura
  // desconhecida caia do lado seguro, igual ao servidor.
  function podeExcluirRolo(rolo) {
    return !!rolo && rolo.situacao === 'na_tecelagem';
  }

  function mensagemDeExclusao(error) {
    var texto = (error && (error.message || error.details)) || '';
    if (texto.indexOf('TECELAGEM_ROLO_JA_ENVIADO') >= 0) {
      return 'Este rolo já saiu para o acabamento e não pode ser excluído por esta ação.';
    }
    if (texto.indexOf('TECELAGEM_ROLO_FORA_DO_ESCOPO_DO_FORNECEDOR') >= 0) {
      return 'Este rolo não pertence ao seu usuário.';
    }
    if (texto.indexOf('TECELAGEM_ROLO_NAO_ENCONTRADO') >= 0) {
      return 'Este rolo não está mais disponível.';
    }
    if (texto.indexOf('TECELAGEM_FORNECEDOR_NAO_IDENTIFICADO') >= 0) {
      return 'Seu usuário não está ativo como fornecedor. Fale com o administrador.';
    }
    return 'Não foi possível excluir o rolo. Nada foi alterado.';
  }

  // Excluir um rolo físico é destrutivo, então a confirmação IDENTIFICA o rolo
  // pelo número que o operador vê na etiqueta — nunca por id técnico.
  function abrirExcluirRolo(rolo, aoConcluir) {
    window.confirmDialog({
      title: 'Excluir Rolo ' + fmtRolo(rolo.numero) + '?',
      message: 'Este rolo será removido do lançamento de produção. Os demais rolos'
        + ' do mesmo lançamento continuam como estão, com os mesmos números.',
      confirmLabel: 'Excluir rolo',
      onConfirm: async function () {
        var res = await window.supa.rpc('excluir_rolo_tecelagem', { p_rolo_id: Number(rolo.id) });
        if (res.error) {
          console.error(res.error);
          window.toast(mensagemDeExclusao(res.error), 'error');
          return;
        }
        window.toast('Rolo ' + fmtRolo(rolo.numero) + ' excluído.', 'success');
        if (typeof aoConcluir === 'function') aoConcluir();
      },
    });
  }

  // -------------------------------------------------------------------
  // TELA 3 — VER ROLOS
  // -------------------------------------------------------------------
  function screenTecelagemRolos(opId, opItemId) {
    var container = window.el('div', {});

    async function reload() {
      if (guardaFornecedor(container, 'Rolos')) return;

      var op, produtos, produto, rolos, lancamentos;
      try {
        op = await carregarOp(opId);
        produtos = op ? await carregarProdutos(opId) : [];
        produto = produtos.filter(function (p) { return String(p.id) === String(opItemId); })[0] || null;
        if (!op || !produto) {
          container.replaceChildren(
            window.pageHeader('Rolos'),
            card(emptyText('Este produto não está disponível para o seu usuário.')),
            window.el('div', { style: 'margin-top:12px;' },
              secondaryButton('Voltar para Minhas OPs', function () { window.navigate('#/tecelagem/ops'); }))
          );
          return;
        }
        rolos = (await carregarRolos([produto.id]))[produto.id] || [];
        lancamentos = await carregarLancamentos(produto.id);
      } catch (e) {
        console.error(e);
        container.replaceChildren(window.pageHeader('Rolos'),
          card(emptyText('Não foi possível carregar os rolos agora. Tente novamente.')));
        return;
      }

      var corpo = window.el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

      var produtoCard = card(
        sectionChip('Produto', ICON_BOX),
        window.el('div', {
          style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
        }, rotuloProduto(produto.modelo)),
        window.el('div', {
          style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-top:5px;',
        }, window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op)),
        linhaCliente(op)
      );
      // AUSENTE para manta (regra de produto, §6): sem NENHUMA das duas
      // ações, o rodapé do card não existe — nunca um rodapé vazio.
      if (temEtiquetaAcabamento(produto) || temSaidaAcabamento(produto)) {
        var rodapeAcoes = [];
        if (temEtiquetaAcabamento(produto)) {
          rodapeAcoes.push(secondaryButton('Etiqueta de acabamento', function () {
            abrirEtiquetaAcabamento(op, produto);
          }));
        }
        if (temSaidaAcabamento(produto)) {
          var haRolosNaTecelagem = rolos.some(function (r) { return r.situacao === 'na_tecelagem'; });
          rodapeAcoes.push(primaryButton('Dar saída para acabamento', function () {
            abrirSaidaAcabamento(op, produto, rolos, reload);
          }, !haRolosNaTecelagem));
        }
        produtoCard.appendChild(cardFooter.apply(null, rodapeAcoes));
      }
      corpo.appendChild(produtoCard);

      var tabela = card(sectionChip('Rolos registrados', ICON_LIST));
      if (!rolos.length) {
        tabela.appendChild(emptyText('Nenhum rolo registrado ainda.'));
      } else {
        tabela.appendChild(tabelaRolos(op, produto, rolos, reload));
      }
      corpo.appendChild(tabela);

      // A superfície de recuperação vem DEPOIS dos rolos: o operador primeiro
      // vê o que existe, depois a ação que desfaz o lote que o criou.
      var recuperacao = cardLancamentos(produto, lancamentos, reload);
      if (recuperacao) corpo.appendChild(recuperacao);

      corpo.appendChild(window.el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' },
        secondaryButton('Voltar para a OP', function () { window.navigate('#/tecelagem/ops/' + op.op_id); }),
        secondaryButton('Minhas OPs', function () { window.navigate('#/tecelagem/ops'); })
      ));

      container.replaceChildren(window.pageHeader('Ver rolos'), corpo);
    }

    reload();
    return window.shellLayout(menu(), container);
  }

  // Tabela §2.5: UM dono de largura, lido pelo cabeçalho E pelas linhas, para
  // que os dois não possam divergir. Coluna numérica alinhada à direita no
  // cabeçalho e no valor. A quarta coluna (Ações) carrega as DUAS ações que se
  // referem sempre ao MESMO rolo já existente — REIMPRIMIR ETIQUETA (§3) e
  // EXCLUIR ROLO (db/127). Nenhuma delas cria rolo ou lançamento novo.
  var GRID_COLS = '90px 1fr 1fr 80px';

  function tabelaRolos(op, produto, rolos, aoConcluir) {
    var wrap = window.el('div', { style: 'overflow-x:auto;', 'data-rv-table-scroll': '' });
    var tabela = window.el('div', { style: 'min-width:440px;' });

    function linha(estilo, celulas) {
      return window.el('div', {
        style: 'display:grid; grid-template-columns:' + GRID_COLS + '; gap:8px; ' + estilo,
      }, ...celulas);
    }

    var thStyle = 'font-size:var(--rv-fs-thead); font-weight:600; text-transform:uppercase;'
      + ' color:var(--rv-text-tertiary);';

    tabela.appendChild(linha('padding:0 8px 8px;', [
      window.el('div', { style: thStyle }, 'Rolo'),
      window.el('div', { style: thStyle + ' text-align:right;' }, 'Comprimento'),
      window.el('div', { style: thStyle }, 'Situação'),
      window.el('div', { style: thStyle }, ''),
    ]));

    rolos.forEach(function (rolo) {
      var comprimento = rolo.comprimento_m == null ? '—' : fmtMetros(rolo.comprimento_m);
      var celComprimento = window.el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); text-align:right;',
      }, comprimento);
      // .tnum só onde há número de verdade; o travessão não é número.
      if (rolo.comprimento_m != null) celComprimento.className = 'tnum';

      tabela.appendChild(linha(
        'padding:9px 8px; border-top:1px solid var(--rv-border-soft); align-items:center;',
        [
          num(window.el('div', {
            style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary);',
          }, fmtRolo(rolo.numero))),
          celComprimento,
          window.el('div', {}, window.RV_BADGES.rvStatusPill(situacaoRolo(rolo).rotulo, situacaoRolo(rolo).estado)),
          window.el('div', { style: 'display:flex; gap:6px; justify-content:flex-end;' },
            window.actionButton({
              title: 'Reimprimir etiqueta do rolo ' + fmtRolo(rolo.numero),
              icon: icon(ICON_PRINT, 15),
              onclick: function () { abrirEtiquetaRolo(op, produto, rolo); },
            }),
            // EXCLUIR ROLO só enquanto o rolo é reversível com segurança. Um
            // rolo já enviado mantém a ação VISÍVEL e desabilitada, com o
            // motivo no nome acessível: sumir com o controle deixaria a linha
            // desalinhada e o operador sem saber por que a opção some.
            window.actionButton({
              title: podeExcluirRolo(rolo)
                ? ('Excluir o rolo ' + fmtRolo(rolo.numero))
                : ('O rolo ' + fmtRolo(rolo.numero) + ' já saiu para o acabamento e não pode ser excluído'),
              icon: icon(ICON_TRASH, 15),
              danger: true,
              disabled: !podeExcluirRolo(rolo),
              onclick: function () { abrirExcluirRolo(rolo, aoConcluir); },
            })
          ),
        ]
      ));
    });

    wrap.appendChild(tabela);
    return wrap;
  }

  // -------------------------------------------------------------------
  window.screenTecelagemOps = screenTecelagemOps;
  window.screenTecelagemOp = screenTecelagemOp;
  window.screenTecelagemRolos = screenTecelagemRolos;

  window.RAVATEX_TECELAGEM = {
    screenTecelagemOps: screenTecelagemOps,
    screenTecelagemOp: screenTecelagemOp,
    screenTecelagemRolos: screenTecelagemRolos,
    rotuloProduto: rotuloProduto,
    fmtRolo: fmtRolo,
    fmtMetros: fmtMetros,
    execucao: execucao,
    mensagemDeErro: mensagemDeErro,
    mensagemDeInicio: mensagemDeInicio,
    camposEtiquetaRolo: camposEtiquetaRolo,
    camposBasicosAcabamento: camposBasicosAcabamento,
    estadoEmborrachar: estadoEmborrachar,
    temEtiquetaAcabamento: temEtiquetaAcabamento,
    temSaidaAcabamento: temSaidaAcabamento,
    situacaoRolo: situacaoRolo,
    mensagemDeSaida: mensagemDeSaida,
    // Recuperação de lançamento (db/126) e clareza de unidade.
    CONFIRMACAO_QUANTIDADE_ALTA: CONFIRMACAO_QUANTIDADE_ALTA,
    ecoQuantidade: ecoQuantidade,
    textoConfirmacaoQuantidade: textoConfirmacaoQuantidade,
    descricaoLancamento: descricaoLancamento,
    motivoDesfazer: motivoDesfazer,
    mensagemDeDesfazer: mensagemDeDesfazer,
    fmtMomento: fmtMomento,
    // Exclusão de rolo individual (db/127).
    podeExcluirRolo: podeExcluirRolo,
    mensagemDeExclusao: mensagemDeExclusao,
  };
})(window);
