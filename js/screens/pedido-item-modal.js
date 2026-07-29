// =====================================================================
// === SCREENS: PEDIDO ITEM MODAL ======================================
// Dono UNICO do modal detalhado "Adicionar item" da tela administrativa
// `#/pedidos/novo`.
//
// Fase: PEDIDO-ADMIN-DUAL-ITEM-ENTRY-RESTORE-R1.
//
// POR QUE ESTE MODULO EXISTE
//   BATCH-02 substituiu o modal detalhado por uma LINHA EDITAVEL e removeu o
//   modal da tela admin. A entrada rapida em linha e valida e permanece, mas o
//   modal detalhado tambem e homologado e foi restaurado: a tela oferece os
//   DOIS caminhos, e nenhum substitui o outro.
//
//   O ARQUITETO DECIDIU (ordem PEDIDO-ADMIN-DUAL-ITEM-ENTRY-RESTORE-R1,
//   DECIDED_FACTS 10 e 11): o item de Pedido e um ITEM FILHO delimitado, nao
//   uma entidade de topo. A regra estrutural que proibe uma entidade completa
//   dentro de um modal de transicao NAO alcanca este modal de criacao de filho.
//   A mesma decisao ja governa o modal homologado da superficie de cliente
//   (js/screens/cliente-pedido-form.js), usado aqui como referencia visual e
//   comportamental.
//
//   O modal mora aqui, e nao em js/screens/pedido-form.js, porque aquela tela
//   ja esta na faixa EXCEPCIONAL de tamanho (CODE_HEALTH_RULES.md sec.7, teto
//   900) e absorver ~250 linhas a colocaria fora dela. A extracao de BATCH-02
//   segue quitada.
//
// REGRA BINDING — TIPO ANTES DE MODELO
//   Identica a da linha: a rota vem EXCLUSIVAMENTE de `modelos.tipo_produto`,
//   pelo derivador unico de js/screens/pedido-item-row-editor.js. Modelo fica
//   desabilitado ate haver Tipo, e a lista e o recorte estrito da rota.
//   FALHA FECHADA: sem o metadado de tipo o modal nao oferece modelo algum.
//
// CONTRATO DE SAIDA
//   O modal NAO toca em `state.itens` e NAO salva nada. Ele mantem um rascunho
//   LOCAL e, na confirmacao, entrega ao chamador um objeto com a MESMA forma
//   que a linha rapida produz: { tipo, modeloId, metros, observacao }. Quem
//   atribui o `uid` e empurra para `state.itens` e a tela — entao os dois
//   caminhos de entrada convergem no mesmo estado local e no mesmo payload de
//   `pedido_itens`. O Tipo continua sendo selecao de UI e filtro: nunca e
//   persistido; a identidade de produto gravada e apenas `modelo_id`.
//
// Carregar via <script src="js/screens/pedido-item-modal.js?v=..."></script>
// DEPOIS de js/screens/pedido-item-row-editor.js e ANTES de
// js/screens/pedido-form.js.
// =====================================================================

(function (window) {
  'use strict';

  var SVG_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  function svgEl(markup) {
    var tmp = window.document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  // Dono UNICO da derivacao de rota, do recorte por tipo e dos formatadores
  // de modelo/cor/largura. Este modulo nunca reimplementa nenhum deles.
  function rowApi() {
    return window.RAVATEX_PEDIDO_ITEM_ROW;
  }

  // ===================================================================
  // openAddItemModal — o editor detalhado do item.
  //
  //   modelos       lista unica ja carregada (com tipo_produto)
  //   typeMetadata  false => falha fechada: Tipo/Modelo desabilitados
  //   onConfirm     recebe { tipo, modeloId, metros, observacao } quando o
  //                 operador confirma. Nao e chamado no cancelamento.
  // ===================================================================
  function openAddItemModal(options) {
    var opts = options || {};
    var modelos = Array.isArray(opts.modelos) ? opts.modelos : [];
    var typeMetadata = opts.typeMetadata !== false;
    var onConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : function () {};
    var api = rowApi();

    // Rascunho LOCAL. Abrir o modal nao insere linha alguma em state.itens.
    var draft = { tipo: '', modeloId: '', metros: '', observacao: '' };

    // Empilhamento canonico de css/tokens.css: modal 200 < popover 225 <
    // toast 250. Um literal cru aqui abriria o painel dos seletores ATRAS do
    // scrim e deixaria Tipo e Modelo inselecionaveis — o defeito que a
    // superficie de cliente ja pagou uma vez.
    var overlay = window.el('div', {
      'data-pedido-item-modal': '1',
      style: 'position:fixed; inset:0; background:var(--rv-overlay-scrim); display:flex; align-items:center; justify-content:center; padding:16px; z-index:var(--rv-z-modal);'
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    function close() {
      overlay.remove();
      window.document.removeEventListener('keydown', onKeydown);
    }
    function onKeydown(e) { if (e.key === 'Escape') close(); }
    window.document.addEventListener('keydown', onKeydown);

    function requiredLabel(text) {
      return window.el('label', {
        style: 'display:block; font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary); margin-bottom:6px;'
      }, text + ' ', window.el('span', { style: 'color:var(--rv-signal-negative);' }, '*'));
    }
    function plainLabel(text) {
      return window.el('div', {
        style: 'font-size:var(--rv-fs-body); font-weight:600; color:var(--rv-text-primary); margin-bottom:6px;'
      }, text);
    }
    // Campo somente-leitura canonico (degrau --rv-h-compact, 12px horizontais,
    // sem chevron): Cores e Largura sao DERIVADOS do modelo, nao seletores.
    function staticBox(span) {
      return window.el('div', {
        'data-rv-static-value': '1',
        style: 'box-sizing:border-box; display:flex; align-items:center; height:var(--rv-h-compact); padding:0 12px; border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:var(--rv-surface);'
      }, span);
    }

    var closeBtn = window.el('button', {
      type: 'button',
      title: 'Fechar',
      'aria-label': 'Fechar',
      style: 'display:inline-flex; align-items:center; justify-content:center; background:none; border:none; cursor:pointer; padding:4px; color:var(--rv-text-tertiary);',
      onclick: close
    }, svgEl(SVG_CLOSE));

    var header = window.el('div', {
      style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:14px 20px; border-bottom:1px solid var(--rv-border-soft);'
    },
      window.el('div', {},
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Adicionar item'),
        window.el('div', { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); margin-top:3px;' },
          'Informe os dados do item que será incluído no pedido.')
      ),
      closeBtn
    );

    // Tipo ANTES de Modelo. Os marcadores data-* sao os mesmos que a
    // superficie de cliente ja usa, entao o guard de ordem e o mesmo.
    var tipoSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Tipo' });
    tipoSelect.setAttribute('data-item-modal-tipo', '1');
    var tipoField = window.el('div', {}, requiredLabel('Tipo do produto'), tipoSelect);

    var modeloSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Modelo' });
    modeloSelect.setAttribute('data-item-modal-modelo', '1');
    var modeloField = window.el('div', {}, requiredLabel('Modelo'), modeloSelect);

    function preencherModelos() {
      // O dono do recorte e fillModeloSelect: ele aplica modelosPorTipo,
      // preserva o valor equivalente, cai para o placeholder quando o modelo
      // deixa de pertencer a rota e desabilita o controle sem Tipo.
      api.fillModeloSelect(modeloSelect, modelos, typeMetadata ? draft.tipo : '', draft.modeloId);
    }

    var cor1Span = window.el('span', {}, '—');
    var cor2Span = window.el('span', {}, '—');
    var coresField = window.el('div', {},
      requiredLabel('Cores'),
      window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;' },
        window.el('div', {},
          window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-bottom:6px;' }, 'Cor 1'),
          staticBox(cor1Span)
        ),
        window.el('div', {},
          window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-bottom:6px;' }, 'Cor 2'),
          staticBox(cor2Span)
        )
      )
    );

    var larguraSpan = window.el('span', {}, '—');
    var larguraField = window.el('div', {}, requiredLabel('Largura'), staticBox(larguraSpan));

    var metragemInput = window.el('input', {
      type: 'number',
      step: '0.01',
      min: '0.01',
      placeholder: '0,00',
      'data-item-modal-metragem': '1',
      style: 'flex:1; border:none; outline:none; padding:0 12px; font-size:var(--rv-fs-body); font-family:inherit; color:var(--rv-text-primary); background:transparent; min-width:0;'
    });
    metragemInput.addEventListener('input', function () { draft.metros = metragemInput.value; });
    var metragemWrap = window.el('div', {
      style: 'box-sizing:border-box; display:flex; align-items:center; height:var(--rv-h-compact); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); overflow:hidden; background:var(--rv-surface);'
    }, metragemInput, window.el('span', { style: 'padding:0 12px 0 0; color:var(--rv-text-tertiary); font-size:var(--rv-fs-body);' }, 'm'));
    var metragemField = window.el('div', {}, requiredLabel('Metragem'), metragemWrap);

    var larguraMetragemRow = window.el('div', {
      style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;'
    }, larguraField, metragemField);

    // Referencia visual: as cores REAIS do modelo escolhido, ou um estado
    // vazio honesto. Nada de ilustracao sintetica sem dado por tras (D9).
    var referenciaBox = window.el('div', {
      'data-item-modal-referencia': '1',
      style: 'height:120px; border-radius:var(--rv-radius); overflow:hidden; position:relative; border:1px solid var(--rv-border); background:var(--rv-surface-subtle); display:flex; align-items:center; justify-content:center;'
    });

    function renderReferencia() {
      var mod = api.modeloById(modelos, draft.modeloId);
      var nome1 = mod && mod.cor_1 ? api.corNome(mod.cor_1) : null;
      var nome2 = mod && mod.cor_2 ? api.corNome(mod.cor_2) : null;
      if (!mod || ((!nome1 || nome1 === '-') && (!nome2 || nome2 === '-'))) {
        referenciaBox.replaceChildren(window.el('span', {
          style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);'
        }, 'Selecione um modelo para ver as cores.'));
        return;
      }
      var faixas = window.el('div', { style: 'display:flex; width:100%; height:100%;' });
      [nome1, nome2].forEach(function (nome) {
        if (!nome || nome === '-') return;
        faixas.appendChild(window.el('div', {
          title: nome,
          style: 'flex:1 1 0; background:' + window.corPreviewHex(nome) + ';'
        }));
      });
      referenciaBox.replaceChildren(faixas);
    }

    function refreshDerivados() {
      var mod = api.modeloById(modelos, draft.modeloId);
      larguraSpan.textContent = mod ? api.larguraStr(mod) : '—';
      cor1Span.textContent = mod ? api.corNome(mod.cor_1) : '—';
      cor2Span.textContent = mod ? api.corNome(mod.cor_2) : '—';
      renderReferencia();
    }

    tipoSelect.addEventListener('change', function () {
      draft.tipo = tipoSelect.value;
      // Trocar o Tipo limpa o modelo que deixou de pertencer a rota, e com ele
      // TODO derivado: cores, largura e referencia.
      var atual = api.modeloById(modelos, draft.modeloId);
      if (!draft.tipo || (atual && api.rotaDoModelo(atual) !== draft.tipo)) draft.modeloId = '';
      preencherModelos();
      refreshDerivados();
    });

    modeloSelect.addEventListener('change', function () {
      // modelo_id continua sendo a UNICA identidade de produto persistida.
      draft.modeloId = modeloSelect.value;
      refreshDerivados();
    });

    api.fillTipoSelect(tipoSelect, draft.tipo, !typeMetadata);
    preencherModelos();
    refreshDerivados();

    var referenciaField = window.el('div', {}, plainLabel('Referência visual'), referenciaBox);

    // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 sec.D: o campo de observacao por
    // item foi RETIRADO deste modal — a administrativa nao cria mais uma
    // observacao que ficaria invisivel assim que o item fosse confirmado.
    // `draft.observacao` permanece no rascunho (nunca mutado por nenhum
    // input aqui) so para que onConfirm continue entregando a MESMA forma
    // { tipo, modeloId, metros, observacao } que a linha rapida produz; o
    // valor e sempre '' — que o INSERT de pedido-form.js normaliza para
    // NULL, exatamente como um item sem observacao hoje.

    var body = window.el('div', {
      style: 'padding:14px 20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex:1; min-height:0;'
    }, tipoField, modeloField, coresField, larguraMetragemRow, referenciaField);

    var cancelBtn = window.el('button', {
      type: 'button',
      style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
      onclick: close
    }, 'Cancelar');

    var confirmBtn = window.el('button', {
      type: 'button',
      'data-item-modal-confirmar': '1',
      style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0 20px; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
      onclick: function () {
        if (!draft.tipo) {
          window.toast('Selecione o tipo do produto.', 'error');
          return;
        }
        if (!draft.modeloId) {
          window.toast('Selecione um modelo.', 'error');
          return;
        }
        var m = Number(draft.metros);
        if (!Number.isFinite(m) || m <= 0) {
          window.toast('Metragem deve ser maior que zero.', 'error');
          return;
        }
        // Entrega a MESMA forma que a linha rapida produz. Quem atribui uid e
        // empurra para state.itens e a tela: um unico dono de estado.
        onConfirm({
          tipo: draft.tipo,
          modeloId: draft.modeloId,
          metros: draft.metros,
          observacao: draft.observacao
        });
        close();
      }
    }, 'Adicionar item');

    // Dono canonico da barra de acoes de modal (js/ui.js).
    var footer = window.modalActionBar([cancelBtn, confirmBtn]);

    var card = window.el('div', {
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); width:460px; max-width:100%; max-height:90vh; box-shadow:var(--rv-shadow-popover); overflow:hidden; display:flex; flex-direction:column;'
    }, header, body, footer);

    overlay.appendChild(card);
    window.document.body.appendChild(overlay);
    return overlay;
  }

  window.RAVATEX_PEDIDO_ITEM_MODAL = {
    openAddItemModal: openAddItemModal
  };
})(window);
