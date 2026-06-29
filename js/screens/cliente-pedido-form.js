// =====================================================================
// === SCREENS: CLIENTE PEDIDO FORM ====================================
// Tela cliente `#/cliente/pedidos/novo` — formulário de criação de
// Pedido pelo cliente autenticado.
//
// Fase: RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO +
//   RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL
// Escopo: visual match ao standalone "Novo Pedido - standalone.html"
//   e ao standalone "Modal Adicionar Item - standalone.html"
//   (openAddItemModal). Cor 1/Cor 2 no modal são derivadas do
//   modelo selecionado (somente leitura); override por item fica
//   para fase futura.
//
// Carregar via <script src="js/screens/cliente-pedido-form.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-ui.js e ui.js.
// =====================================================================

(function (window) {
  'use strict';

  function novoUid() {
    return 'i_' + Math.random().toString(36).slice(2, 10);
  }

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3f4757" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_EDIT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
  var SVG_TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d6403a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var SVG_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';
  var SVG_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  async function screenClientePedidoNovo() {
    var clienteId = window.CURRENT_USER && window.CURRENT_USER.cliente_id;

    if (clienteId == null) {
      window.toast('Conta de cliente sem cliente_id vinculado. Contate o suporte.', 'error');
      var errNode = window.el('div', { style: 'padding:24px;' },
        window.el('div', { style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; padding:24px; color:#d6403a;' },
          'Sua conta não está vinculada a um cliente. Contate o suporte.'),
        window.el('div', { style: 'margin-top:12px;' },
          window.el('button', {
            type: 'button',
            style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, '← Voltar para lista')
        )
      );
      return window.clienteShellLayout(errNode);
    }

    var container = window.el('div', {});

    var modelos = [];
    var coresById = {};
    var loadingError = null;

    var state = {
      referencia: '',
      prazoEntrega: '',
      recebimento: 'retirada',
      observacao: '',
      itens: [
        { uid: novoUid(), modeloId: '', metros: '', observacao: '' },
      ],
    };

    async function carregarDados() {
      var modRes = await window.supa
        .from('modelos')
        .select('id, nome, largura, cor_1_id, cor_2_id')
        .order('nome');
      if (modRes.error) {
        loadingError = 'modelos';
        window.toast('Erro ao carregar modelos', 'error');
        console.error(modRes.error);
        return;
      }
      modelos = modRes.data || [];

      var corIds = [];
      for (var i = 0; i < modelos.length; i++) {
        if (modelos[i].cor_1_id) corIds.push(modelos[i].cor_1_id);
        if (modelos[i].cor_2_id) corIds.push(modelos[i].cor_2_id);
      }
      corIds = Array.from(new Set(corIds));
      if (corIds.length > 0) {
        var corRes = await window.supa
          .from('cores')
          .select('id, nome')
          .in('id', corIds);
        if (corRes.error) {
          console.error('cliente-pedido-form: erro ao carregar cores', corRes.error);
        } else {
          coresById = Object.fromEntries((corRes.data || []).map(function (c) { return [c.id, c]; }));
        }
      }
    }

    function modeloById(id) {
      for (var i = 0; i < modelos.length; i++) {
        if (String(modelos[i].id) === String(id)) return modelos[i];
      }
      return null;
    }

    function larguraStr(modelo) {
      if (!modelo) return '—';
      return typeof modelo.largura === 'number'
        ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
        : String(modelo.largura || '—');
    }

    function corNome(id) {
      return (coresById[id] && coresById[id].nome) || '—';
    }

    function metrosStr(val) {
      var n = parseFloat(val);
      if (!Number.isFinite(n) || n <= 0) return '—';
      return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
    }

    function totalMetros() {
      var t = 0;
      for (var i = 0; i < state.itens.length; i++) {
        var n = parseFloat(state.itens[i].metros);
        if (Number.isFinite(n) && n > 0) t += n;
      }
      return t;
    }

    // ------------------------------------------------------------------
    // Header
    // ------------------------------------------------------------------
    function buildHeader() {
      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px;'
      },
        window.el('div', { style: 'display:flex; align-items:flex-start; gap:16px;' },
          window.el('div', {
            style: 'width:36px; height:36px; border:1px solid #e2e5ea; border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, svgEl(SVG_BACK)),
          window.el('div', {},
            window.el('h1', {
              style: 'margin:0; font-size:23px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
            }, 'Novo pedido'),
            window.el('div', {
              style: 'font-size:13.5px; color:#8a93a3; margin-top:4px;'
            }, 'Preencha os itens do pedido. Após o envio, ele ficará como Recebido para conferência.')
          )
        ),
        window.el('button', {
          type: 'button',
          style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap;',
          onclick: function () { window.navigate('#/cliente/pedidos'); },
        }, 'Cancelar')
      );
    }

    // ------------------------------------------------------------------
    // Card: Dados gerais
    // ------------------------------------------------------------------
    function buildDadosGeraisCard() {
      var referenciaInput = window.el('input', {
        type: 'text',
        placeholder: 'Ex.: Pedido #8431',
        value: state.referencia,
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff; outline:none; font-family:inherit; box-sizing:border-box;',
      });
      referenciaInput.addEventListener('input', function () { state.referencia = referenciaInput.value; });

      var prazoInput = window.el('input', {
        type: 'date',
        value: state.prazoEntrega,
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; min-width:0;',
      });
      prazoInput.addEventListener('change', function () { state.prazoEntrega = prazoInput.value; });
      var prazoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, prazoInput, svgEl(SVG_CALENDAR));

      var recebimentoSelect = window.el('select', {
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;',
      },
        window.el('option', { value: 'retirada' }, 'Retirada'),
        window.el('option', { value: 'entrega' }, 'Entrega')
      );
      recebimentoSelect.value = state.recebimento;
      recebimentoSelect.addEventListener('change', function () { state.recebimento = recebimentoSelect.value; });
      var recebimentoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, recebimentoSelect, svgEl(SVG_CHEVRON));

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
        window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:12px;' }, 'Dados gerais'),
        window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;' },
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:#5b6472; margin-bottom:6px;' }, 'Referência do cliente'),
            referenciaInput
          ),
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:#5b6472; margin-bottom:6px;' }, 'Prazo desejado'),
            prazoWrap
          ),
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:#5b6472; margin-bottom:6px;' }, 'Recebimento'),
            recebimentoWrap
          )
        )
      );
    }

    // ------------------------------------------------------------------
    // Item row (inline editable table row)
    // ------------------------------------------------------------------
    function buildItemRow(item) {
      var modelo = modeloById(item.modeloId);

      // Swatch placeholder
      var swatch = window.el('div', {
        style: 'width:36px; height:36px; border-radius:4px; border:1px solid rgba(0,0,0,.08); background:#d8d0c0; flex-shrink:0;'
      });

      // Modelo select (compact, inside cell)
      var selectEl = window.el('select', {
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; color:#16203a; background:#fff; font-family:inherit; cursor:pointer; outline:none;',
      }, window.el('option', { value: '' }, 'Modelo…'));
      for (var i = 0; i < modelos.length; i++) {
        var m = modelos[i];
        var opt = window.el('option', { value: m.id }, m.nome);
        if (String(m.id) === String(item.modeloId)) opt.selected = true;
        selectEl.appendChild(opt);
      }
      selectEl.addEventListener('change', function () {
        item.modeloId = selectEl.value;
        // update largura cell
        var mod = modeloById(item.modeloId);
        larguraCell.textContent = mod ? larguraStr(mod) : '—';
        // update swatch color
        swatch.style.background = mod ? swatchColor(item.modeloId) : '#d8d0c0';
      });

      // Cores cell (placeholder)
      var coresCell = window.el('div', { style: 'font-size:14px; color:#b6bdc8;' }, '—');

      // Largura cell (auto from modelo)
      var larguraCell = window.el('div', { style: 'font-size:14px; color:#3f4757;' }, modelo ? larguraStr(modelo) : '—');

      // Update swatch if model already selected
      if (modelo) swatch.style.background = swatchColor(item.modeloId);

      // Metragem input
      var metrosInput = window.el('input', {
        type: 'number',
        value: item.metros,
        placeholder: '0,00',
        step: '0.01',
        min: '0.01',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; font-weight:600; color:#16203a; background:#fff; font-family:inherit; outline:none;',
      });
      metrosInput.addEventListener('input', function () { item.metros = metrosInput.value; });

      // Obs input
      var obsInput = window.el('input', {
        type: 'text',
        value: item.observacao,
        placeholder: '—',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; color:#3f4757; background:#fff; font-family:inherit; outline:none;',
      });
      obsInput.addEventListener('input', function () { item.observacao = obsInput.value; });

      // Ações
      var editBtn = window.el('span', {
        style: 'cursor:default; opacity:.5;',
        title: 'Edição via modal (em breve)',
      }, svgEl(SVG_EDIT));

      var removeBtn = window.el('span', {
        style: 'cursor:pointer;',
        onclick: function () {
          state.itens = state.itens.filter(function (it) { return it.uid !== item.uid; });
          render();
        },
      }, svgEl(SVG_TRASH));

      var acoesCell = window.el('div', { style: 'display:flex; align-items:center; gap:16px;' }, editBtn, removeBtn);

      return window.el('div', {
        style: 'display:grid; grid-template-columns:60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px; align-items:center; gap:12px; padding:9px 18px; border-bottom:1px solid #f1f3f6;',
        'data-uid': item.uid,
      },
        window.el('div', {}, swatch),
        selectEl,
        coresCell,
        larguraCell,
        metrosInput,
        obsInput,
        acoesCell
      );
    }

    function swatchColor(modeloId) {
      var palette = ['#cfc6b4', '#8f8a80', '#c8a87a', '#7a8fa6', '#b0a898', '#a8b8c8', '#c4b8a0'];
      var idx = Math.abs(parseInt(String(modeloId), 10) || 0) % palette.length;
      return palette[idx];
    }

    // ------------------------------------------------------------------
    // Modal: Adicionar item
    // Visual fiel ao standalone "Modal Adicionar Item". Modelo é select
    // real; Cor 1/Cor 2/Largura são derivados do modelo selecionado
    // (somente leitura — override por item fica para fase futura);
    // Metragem e Observação usam as mesmas validações do formulário.
    // ------------------------------------------------------------------
    function openAddItemModal() {
      var draft = { modeloId: '', metros: '', observacao: '' };

      var overlay = window.el('div', {
        style: 'position:fixed; inset:0; background:rgba(22,32,58,.45); display:flex; align-items:center; justify-content:center; padding:40px; z-index:1000;',
      });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

      function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);
      }
      function onKeydown(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKeydown);

      function requiredLabel(text) {
        return window.el('label', {
          style: 'display:block; font-size:13px; font-weight:600; color:#3f4757; margin-bottom:6px;'
        }, text + ' ', window.el('span', { style: 'color:#d6403a;' }, '*'));
      }
      function plainLabel(text) {
        return window.el('div', {
          style: 'font-size:13px; font-weight:600; color:#3f4757; margin-bottom:6px;'
        }, text);
      }
      function staticBox(span) {
        return window.el('div', {
          style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff;'
        }, span, svgEl(SVG_CHEVRON));
      }

      var closeBtn = window.el('button', {
        type: 'button',
        style: 'background:none; border:none; cursor:pointer; padding:4px; color:#9aa2af;',
        onclick: close,
      }, svgEl(SVG_CLOSE));

      var header = window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px 12px;'
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Adicionar item'),
          window.el('div', { style: 'font-size:13px; color:#8a93a3; margin-top:3px;' },
            'Informe os dados do item que será incluído no pedido.')
        ),
        closeBtn
      );

      // Modelo (select real)
      var modeloSelect = window.el('select', {
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;',
      }, window.el('option', { value: '' }, 'Modelo…'));
      for (var i = 0; i < modelos.length; i++) {
        modeloSelect.appendChild(window.el('option', { value: modelos[i].id }, modelos[i].nome));
      }
      var modeloWrap = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, modeloSelect, svgEl(SVG_CHEVRON));
      var modeloField = window.el('div', {}, requiredLabel('Modelo'), modeloWrap);

      // Cores (derivadas do modelo selecionado — somente leitura)
      var cor1Span = window.el('span', {}, '—');
      var cor2Span = window.el('span', {}, '—');
      var coresField = window.el('div', {},
        requiredLabel('Cores'),
        window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;' },
          window.el('div', {},
            window.el('div', { style: 'font-size:12.5px; color:#9aa2af; margin-bottom:6px;' }, 'Cor 1'),
            staticBox(cor1Span)
          ),
          window.el('div', {},
            window.el('div', { style: 'font-size:12.5px; color:#9aa2af; margin-bottom:6px;' }, 'Cor 2'),
            staticBox(cor2Span)
          )
        )
      );

      // Largura (derivada do modelo) + Metragem (input real)
      var larguraSpan = window.el('span', {}, '—');
      var larguraField = window.el('div', {}, requiredLabel('Largura'), staticBox(larguraSpan));

      var metragemInput = window.el('input', {
        type: 'number',
        step: '0.01',
        min: '0.01',
        placeholder: '0,00',
        style: 'flex:1; border:none; outline:none; padding:9px 12px; font-size:14px; font-family:inherit; color:#16203a; background:transparent; min-width:0;',
      });
      metragemInput.addEventListener('input', function () { draft.metros = metragemInput.value; });
      var metragemWrap = window.el('div', {
        style: 'display:flex; align-items:center; border:1px solid #d8dce2; border-radius:4px; overflow:hidden; background:#fff;'
      }, metragemInput, window.el('span', { style: 'padding:9px 12px 9px 0; color:#9aa2af; font-size:14px;' }, 'm'));
      var metragemField = window.el('div', {}, requiredLabel('Metragem'), metragemWrap);

      var larguraMetragemRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;'
      }, larguraField, metragemField);

      modeloSelect.addEventListener('change', function () {
        draft.modeloId = modeloSelect.value;
        var mod = modeloById(draft.modeloId);
        larguraSpan.textContent = mod ? larguraStr(mod) : '—';
        cor1Span.textContent = mod ? corNome(mod.cor_1_id) : '—';
        cor2Span.textContent = mod ? corNome(mod.cor_2_id) : '—';
      });

      // Referência visual (decorativo, estático — sem dado real associado)
      var referenciaField = window.el('div', {},
        plainLabel('Referência visual'),
        window.el('div', { style: 'height:120px; border-radius:4px; overflow:hidden; background:#d4c9a8; position:relative;' },
          window.el('div', { style: 'position:absolute; inset:0; background:'
            + 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(180,155,100,.25) 18px, rgba(180,155,100,.25) 19px),'
            + 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(180,155,100,.25) 18px, rgba(180,155,100,.25) 19px),'
            + 'repeating-linear-gradient(45deg, rgba(160,130,80,.15) 0 4px, transparent 4px 14px),'
            + 'linear-gradient(135deg, #c9b98a 0%, #d9caa0 30%, #c8b680 50%, #ddd0a8 70%, #c4b47c 100%);' }),
          window.el('div', { style: 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:72px; height:72px; border-radius:50%; border:3px solid rgba(100,75,30,.28); background:radial-gradient(circle, rgba(140,110,55,.3) 0%, transparent 70%);' }),
          window.el('div', { style: 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:40px; height:40px; border-radius:50%; border:2px solid rgba(100,75,30,.35); background:rgba(150,120,60,.2);' }),
          window.el('div', { style: 'position:absolute; inset:6px; border:1.5px solid rgba(100,75,30,.2); border-radius:2px;' }),
          window.el('div', { style: 'position:absolute; inset:10px; border:1px dashed rgba(100,75,30,.14); border-radius:2px;' })
        )
      );

      // Observação do item
      var obsTextarea = window.el('textarea', {
        placeholder: 'Ex.: prioridade vitrine, embalagem separada, atenção na largura...',
        maxlength: '200',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px 24px; font-size:14px; font-family:inherit; color:#16203a; background:#fff; resize:none; outline:none; min-height:80px; line-height:1.5; box-sizing:border-box;',
      });
      var counterSpan = window.el('span', {
        style: 'position:absolute; right:12px; bottom:10px; font-size:12px; color:#c2c8d0;'
      }, '0/200');
      obsTextarea.addEventListener('input', function () {
        draft.observacao = obsTextarea.value;
        counterSpan.textContent = obsTextarea.value.length + '/200';
      });
      var obsField = window.el('div', {},
        plainLabel('Observação do item'),
        window.el('div', { style: 'position:relative;' }, obsTextarea, counterSpan)
      );

      var body = window.el('div', {
        style: 'padding:0 20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex:1; min-height:0;'
      }, modeloField, coresField, larguraMetragemRow, referenciaField, obsField);

      var cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: close,
      }, 'Cancelar');

      var confirmBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 20px; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: function () {
          if (!draft.modeloId) {
            window.toast('Selecione um modelo.', 'error');
            return;
          }
          var m = Number(draft.metros);
          if (!Number.isFinite(m) || m <= 0) {
            window.toast('Metragem deve ser maior que zero.', 'error');
            return;
          }
          state.itens.push({
            uid: novoUid(),
            modeloId: draft.modeloId,
            metros: draft.metros,
            observacao: draft.observacao,
          });
          close();
          render();
        },
      }, 'Adicionar item');

      var footer = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:flex-end; gap:12px; padding:14px 20px; border-top:1px solid #eceef1; margin-top:14px;'
      }, cancelBtn, confirmBtn);

      var card = window.el('div', {
        style: 'background:#fff; border-radius:4px; width:460px; max-width:100%; max-height:90vh; box-shadow:0 24px 60px rgba(20,30,45,.14); overflow:hidden; display:flex; flex-direction:column;'
      }, header, body, footer);

      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    // ------------------------------------------------------------------
    // Card: Itens do pedido
    // ------------------------------------------------------------------
    function buildItensCard() {
      var COLS = '60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px';

      var addBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:8px; background:#fff; color:#2563eb; border:1px solid #2563eb; border-radius:4px; padding:7px 13px; font-weight:600; font-size:13.5px; font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () { openAddItemModal(); },
      }, svgEl(SVG_PLUS), 'Adicionar item');

      var tableHeader = window.el('div', {
        style: 'display:grid; grid-template-columns:' + COLS + '; align-items:center; gap:12px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1;'
      },
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Img'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Modelo'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Cores'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Largura'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Metragem (m)'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Observação'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Ações')
      );

      var rowsWrap = window.el('div', {});
      for (var i = 0; i < state.itens.length; i++) {
        rowsWrap.appendChild(buildItemRow(state.itens[i]));
      }

      var t = totalMetros();
      var totalStr = t > 0
        ? t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
        : '0,00 m';

      var tableFooter = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; padding:10px 18px; background:#f8f9fb;'
      },
        window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
          'Total de itens: ',
          window.el('strong', { style: 'color:#16203a; font-weight:700;' }, String(state.itens.length))
        ),
        window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
          'Metragem total: ',
          window.el('strong', { style: 'color:#16203a; font-weight:700;' }, totalStr)
        )
      );

      var tableWrap = window.el('div', {
        style: 'border:1px solid #eceef1; border-radius:4px; overflow:hidden;'
      }, tableHeader, rowsWrap, tableFooter);

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
        window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;' },
          window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Itens do pedido'),
          addBtn
        ),
        tableWrap
      );
    }

    // ------------------------------------------------------------------
    // Section: Instruções + Finalizar
    // ------------------------------------------------------------------
    function buildBottomSection(saveBtn) {
      var obsTextarea = window.el('textarea', {
        rows: 1,
        placeholder: 'Informações adicionais sobre entrega, conferência ou prioridade…',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff; font-family:inherit; outline:none; resize:none; line-height:1.5; box-sizing:border-box; overflow-y:hidden;',
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', function () {
        state.observacao = obsTextarea.value;
        obsTextarea.style.height = 'auto';
        obsTextarea.style.height = obsTextarea.scrollHeight + 'px';
      });

      var instrCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px;'
      },
        window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:10px;' }, 'Instruções gerais'),
        obsTextarea
      );

      var checkoutCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; display:flex; flex-direction:column; justify-content:center;'
      },
        window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:10px;' }, 'Ir para checkout'),
        saveBtn
      );

      return window.el('div', {
        style: 'display:grid; grid-template-columns:3fr 1fr; gap:14px; align-items:stretch;'
      }, instrCard, checkoutCard);
    }

    // ------------------------------------------------------------------
    // Save
    // ------------------------------------------------------------------
    async function salvar(btn) {
      if (state.itens.length === 0) {
        window.toast('Adicione ao menos um item.', 'error');
        return;
      }
      for (var i = 0; i < state.itens.length; i++) {
        var it = state.itens[i];
        if (!it.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione um modelo.', 'error');
          return;
        }
        var m = Number(it.metros);
        if (!Number.isFinite(m) || m <= 0) {
          window.toast('Item ' + (i + 1) + ': metragem deve ser > 0.', 'error');
          return;
        }
      }

      btn.disabled = true;
      var oldLabel = btn.textContent;
      btn.textContent = 'Enviando…';

      try {
        var pedidoPayload = {
          cliente_id: Number(clienteId),
          status: 'recebido',
        };
        if (state.prazoEntrega) pedidoPayload.prazo_entrega = state.prazoEntrega;
        if (state.observacao) pedidoPayload.observacao = state.observacao;

        var pedidoRes = await window.supa
          .from('pedidos')
          .insert(pedidoPayload)
          .select('id, numero, status')
          .single();

        if (pedidoRes.error || !pedidoRes.data) {
          window.toast('Erro ao criar pedido: ' + (pedidoRes.error && pedidoRes.error.message
            ? pedidoRes.error.message : 'desconhecido'), 'error');
          console.error(pedidoRes.error);
          return;
        }
        var pedidoId = pedidoRes.data.id;

        var itensPayload = [];
        for (var j = 0; j < state.itens.length; j++) {
          var it2 = state.itens[j];
          var row2 = {
            pedido_id: pedidoId,
            modelo_id: Number(it2.modeloId),
            metros: Number(it2.metros),
            ordem: j,
          };
          if (it2.observacao && String(it2.observacao).trim() !== '') {
            row2.observacao = it2.observacao;
          }
          itensPayload.push(row2);
        }

        var itensRes = await window.supa
          .from('pedido_itens')
          .insert(itensPayload)
          .select('id');

        if (itensRes.error) {
          console.error('Erro ao inserir itens, compensando:', itensRes.error);
          try {
            var delRes = await window.supa.from('pedidos').delete().eq('id', pedidoId);
            if (delRes.error) {
              window.toast(
                'Erro: pedido #' + pedidoRes.data.numero + ' criado sem itens e compensação falhou. Contate o suporte.',
                'error'
              );
              console.error('Compensação falhou:', delRes.error);
            } else {
              window.toast('Erro ao inserir itens. Pedido cancelado. Tente novamente.', 'error');
            }
          } catch (e) {
            window.toast(
              'Erro: pedido #' + pedidoRes.data.numero + ' criado sem itens e compensação falhou. Contate o suporte.',
              'error'
            );
            console.error('Compensação threw:', e);
          }
          return;
        }

        window.toast('Pedido #' + pedidoRes.data.numero + ' enviado.', 'success');
        window.navigate('#/cliente/pedidos/' + pedidoId);
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    function render() {
      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb; color:#fff; border:none; border-radius:4px; padding:10px 0; width:100%; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: function () { salvar(saveBtn); },
      }, 'Finalizar pedido');

      if (loadingError) {
        container.replaceChildren(
          buildHeader(),
          window.el('div', {
            style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; padding:24px; color:#d6403a;'
          }, 'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a página.')
        );
        return;
      }

      container.replaceChildren(
        buildHeader(),
        buildDadosGeraisCard(),
        buildItensCard(),
        buildBottomSection(saveBtn)
      );
    }

    await carregarDados();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoForm = {
    screenClientePedidoNovo: screenClientePedidoNovo,
  };

  window.screenClientePedidoNovo = screenClientePedidoNovo;
})(window);
