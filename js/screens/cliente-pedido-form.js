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

  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_EDIT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
  var SVG_TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-negative)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var SVG_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';
  var SVG_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var SVG_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  async function screenClientePedidoNovo() {
    var clienteId = window.CURRENT_USER && window.CURRENT_USER.cliente_id;

    if (clienteId == null) {
      window.toast('Conta de cliente sem cliente_id vinculado. Contate o suporte.', 'error');
      var errNode = window.el('div', { style: 'padding:24px;' },
        window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; padding:24px; color:var(--rv-signal-negative);' },
          'Sua conta não está vinculada a um cliente. Contate o suporte.'),
        window.el('div', { style: 'margin-top:12px;' },
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer;',
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
    var tipoMetadataOk = false;

    var state = {
      referencia: '',
      // db/89: data COMERCIAL do Pedido. Default = hoje no fuso do NAVEGADOR
      // (toISOString converteria para UTC e devolveria o dia seguinte a noite).
      dataPedido: (function () {
        var d = new Date();
        var mes = String(d.getMonth() + 1);
        var dia = String(d.getDate());
        return d.getFullYear() + '-' + (mes.length < 2 ? '0' + mes : mes) + '-' + (dia.length < 2 ? '0' + dia : dia);
      })(),
      prazoEntrega: '',
      recebimento: 'retirada',
      observacao: '',
      itens: [
        { uid: novoUid(), modeloId: '', metros: '', observacao: '' },
      ],
    };
    var postSave = null;

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

      // Rota do produto: EXCLUSIVAMENTE modelos.tipo_produto. FALHA FECHADA —
      // sem o metadado nenhum modelo pode ser oferecido, porque degradar tudo
      // para Tapete colocaria uma Manta na rota de acabamento silenciosamente.
      var tpRes = await window.supa.from('modelos').select('id, tipo_produto');
      if (tpRes.error || !Array.isArray(tpRes.data)) {
        loadingError = 'tipo de produto dos modelos';
        window.toast('Erro ao carregar o tipo de produto dos modelos', 'error');
        console.error('cliente-pedido-form: tipo_produto indisponivel', tpRes.error);
        return;
      }
      var tpById = {};
      tpRes.data.forEach(function (row) { if (row && row.id != null) tpById[String(row.id)] = row.tipo_produto; });
      modelos.forEach(function (m) { if (tpById[String(m.id)] != null) m.tipo_produto = tpById[String(m.id)]; });
      tipoMetadataOk = true;

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

    function totalMetrosStr() {
      var t = totalMetros();
      return t > 0
        ? t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
        : '0,00 m';
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
            style: 'width:36px; height:36px; border:1px solid var(--rv-border-soft); border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, svgEl(SVG_BACK)),
          window.el('div', {},
            window.el('h1', {
              style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;'
            }, 'Novo pedido'),
            window.el('div', {
              style: 'font-size:13.5px; color:var(--rv-text-tertiary); margin-top:4px;'
            }, 'Preencha os itens do pedido. Após o envio, ele ficará como Recebido para conferência.')
          )
        ),
        window.el('button', {
          type: 'button',
          style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap;',
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
        style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:9px 12px; font-size:14px; color:var(--rv-text-primary); background:var(--rv-surface); outline:none; font-family:inherit; box-sizing:border-box;',
      });
      referenciaInput.addEventListener('input', function () { state.referencia = referenciaInput.value; });

      var dataPedidoInput = window.el('input', {
        type: 'date',
        value: state.dataPedido,
        'data-pedido-data': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;',
      });
      dataPedidoInput.addEventListener('change', function () { state.dataPedido = dataPedidoInput.value; });
      var dataPedidoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid var(--rv-border-strong); border-radius:4px; padding:9px 12px; background:var(--rv-surface);'
      }, dataPedidoInput, svgEl(SVG_CALENDAR));

      var prazoInput = window.el('input', {
        type: 'date',
        value: state.prazoEntrega,
        style: 'flex:1; border:none; outline:none; font-size:14px; color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;',
      });
      prazoInput.addEventListener('change', function () { state.prazoEntrega = prazoInput.value; });
      var prazoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid var(--rv-border-strong); border-radius:4px; padding:9px 12px; background:var(--rv-surface);'
      }, prazoInput, svgEl(SVG_CALENDAR));

      // Pass-7 (UIC-006): the canonical select popover owns its own border,
      // padding and chevron, so the former facade wrapper is gone. No
      // placeholder: Recebimento always holds one of the two real values.
      var recebimentoSelect = window.createSelectPopover({
        options: [
          { value: 'retirada', label: 'Retirada' },
          { value: 'entrega', label: 'Entrega' }
        ],
        value: state.recebimento,
        ariaLabel: 'Recebimento'
      });
      recebimentoSelect.addEventListener('change', function () { state.recebimento = recebimentoSelect.value; });

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; box-shadow:var(--rv-shadow-none); padding:16px 20px; margin-bottom:14px;'
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:12px;' }, 'Dados gerais'),
        window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;' },
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:var(--rv-text-secondary); margin-bottom:6px;' }, 'Referência do cliente'),
            referenciaInput
          ),
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:var(--rv-text-secondary); margin-bottom:6px;' }, 'Data do pedido'),
            dataPedidoWrap
          ),
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:var(--rv-text-secondary); margin-bottom:6px;' }, 'Prazo desejado'),
            prazoWrap
          ),
          window.el('div', {},
            window.el('label', { style: 'display:block; font-size:13px; color:var(--rv-text-secondary); margin-bottom:6px;' }, 'Recebimento'),
            recebimentoSelect
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
        style: 'width:36px; height:36px; border-radius:4px; border:1px solid var(--rv-border); background:var(--rv-surface-subtle); flex-shrink:0;'
      });

      // Modelo select (compact, inside cell) — Pass-7 canonical popover.
      var modeloOpcoes = [];
      for (var i = 0; i < modelos.length; i++) {
        modeloOpcoes.push({ value: modelos[i].id, label: modelos[i].nome });
      }
      var selectEl = window.createSelectPopover({
        options: modeloOpcoes,
        value: item.modeloId,
        placeholder: 'Modelo…',
        ariaLabel: 'Modelo'
      });
      selectEl.addEventListener('change', function () {
        item.modeloId = selectEl.value;
        // update largura cell
        var mod = modeloById(item.modeloId);
        larguraCell.textContent = mod ? larguraStr(mod) : '—';
        // update swatch color
        swatch.style.background = mod ? swatchColor(mod) : 'var(--rv-surface-subtle)';
      });

      // Cores cell (placeholder)
      var coresCell = window.el('div', { style: 'font-size:14px; color:var(--rv-text-tertiary);' }, '—');

      // Largura cell (auto from modelo)
      var larguraCell = window.el('div', { style: 'font-size:14px; color:var(--rv-text-primary);' }, modelo ? larguraStr(modelo) : '—');

      // Update swatch if model already selected
      if (modelo) swatch.style.background = swatchColor(modelo);

      // Metragem input
      var metrosInput = window.el('input', {
        type: 'number',
        value: item.metros,
        placeholder: '0,00',
        step: '0.01',
        min: '0.01',
        style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:6px 8px; font-size:13.5px; font-weight:600; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;',
      });
      metrosInput.addEventListener('input', function () { item.metros = metrosInput.value; });

      // Obs input
      var obsInput = window.el('input', {
        type: 'text',
        value: item.observacao,
        placeholder: '—',
        style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:6px 8px; font-size:13.5px; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;',
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
        style: 'display:grid; grid-template-columns:60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px; align-items:center; gap:12px; padding:9px 18px; border-bottom:1px solid var(--rv-border-soft);',
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

    // A cor do swatch e a cor real do modelo: dado de negocio, dono canonico
    // js/pedido-ui.js. Sem modelo selecionado nao ha cor a mostrar (D9).
    function swatchColor(modelo) {
      if (!modelo || !modelo.cor_1_id) return 'var(--rv-surface-subtle)';
      return window.corPreviewHex(corNome(modelo.cor_1_id));
    }

    // ------------------------------------------------------------------
    // Modal: Adicionar item
    // Visual fiel ao standalone "Modal Adicionar Item". Modelo é select
    // real; Cor 1/Cor 2/Largura são derivados do modelo selecionado
    // (somente leitura — override por item fica para fase futura);
    // Metragem e Observação usam as mesmas validações do formulário.
    // ------------------------------------------------------------------
    function openAddItemModal() {
      var draft = { tipo: '', modeloId: '', metros: '', observacao: '' };

      var overlay = window.el('div', {
        style: 'position:fixed; inset:0; background:var(--rv-overlay-scrim); display:flex; align-items:center; justify-content:center; padding:40px; z-index:1000;',
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
          style: 'display:block; font-size:13px; font-weight:600; color:var(--rv-text-primary); margin-bottom:6px;'
        }, text + ' ', window.el('span', { style: 'color:var(--rv-signal-negative);' }, '*'));
      }
      function plainLabel(text) {
        return window.el('div', {
          style: 'font-size:13px; font-weight:600; color:var(--rv-text-primary); margin-bottom:6px;'
        }, text);
      }
      function staticBox(span) {
        return window.el('div', {
          style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid var(--rv-border-strong); border-radius:4px; padding:9px 12px; font-size:14px; color:var(--rv-text-primary); background:var(--rv-surface);'
        }, span, svgEl(SVG_CHEVRON));
      }

      var closeBtn = window.el('button', {
        type: 'button',
        style: 'background:none; border:none; cursor:pointer; padding:4px; color:var(--rv-text-tertiary);',
        onclick: close,
      }, svgEl(SVG_CLOSE));

      var header = window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px 12px;'
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Adicionar item'),
          window.el('div', { style: 'font-size:13px; color:var(--rv-text-tertiary); margin-top:3px;' },
            'Informe os dados do item que será incluído no pedido.')
        ),
        closeBtn
      );

      // Tipo ANTES de Modelo — mesma regra binding da tela admin. O dono da
      // derivacao e js/screens/pedido-item-row-editor.js; o Tipo e selecao de
      // UI e filtro, nunca persistido (o item grava so modelo_id).
      var rowApi = window.RAVATEX_PEDIDO_ITEM_ROW;
      // Pass-7 (UIC-006): canonical popovers. The former borderless select
      // inside a bordered facade is gone — the trigger owns its own box and
      // chevron. The data-* markers are preserved for the existing guards.
      var tipoSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Tipo' });
      tipoSelect.setAttribute('data-item-modal-tipo', '1');
      var tipoField = window.el('div', {}, requiredLabel('Tipo'), tipoSelect);

      // Modelo — so e habilitado depois do Tipo.
      var modeloSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Modelo' });
      modeloSelect.setAttribute('data-item-modal-modelo', '1');
      var modeloField = window.el('div', {}, requiredLabel('Modelo'), modeloSelect);

      // Rotulo local: este arquivo carrega cores por id (coresById), nao o
      // objeto cor_1 embutido que o formatador do modulo espera.
      function opcaoModeloLabel(m) {
        return String(m.nome == null ? '' : m.nome) + ' – ' + corNome(m.cor_1_id) + '/' + corNome(m.cor_2_id);
      }
      function preencherModelos() {
        var lista = rowApi.modelosPorTipo(modelos, draft.tipo);
        var opcoes = [];
        for (var mi = 0; mi < lista.length; mi++) {
          opcoes.push({ value: lista[mi].id, label: opcaoModeloLabel(lista[mi]) });
        }
        // setOptions preserves the current value when an equivalent option
        // survives and clears it to the placeholder when it does not. It
        // never emits: the Tipo handler decides what changed.
        modeloSelect.setOptions(opcoes, {
          value: draft.modeloId ? String(draft.modeloId) : '',
          placeholder: 'Modelo…'
        });
        modeloSelect.disabled = !draft.tipo;
      }

      // Cores (derivadas do modelo selecionado — somente leitura)
      var cor1Span = window.el('span', {}, '—');
      var cor2Span = window.el('span', {}, '—');
      var coresField = window.el('div', {},
        requiredLabel('Cores'),
        window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;' },
          window.el('div', {},
            window.el('div', { style: 'font-size:12.5px; color:var(--rv-text-tertiary); margin-bottom:6px;' }, 'Cor 1'),
            staticBox(cor1Span)
          ),
          window.el('div', {},
            window.el('div', { style: 'font-size:12.5px; color:var(--rv-text-tertiary); margin-bottom:6px;' }, 'Cor 2'),
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
        style: 'flex:1; border:none; outline:none; padding:9px 12px; font-size:14px; font-family:inherit; color:var(--rv-text-primary); background:transparent; min-width:0;',
      });
      metragemInput.addEventListener('input', function () { draft.metros = metragemInput.value; });
      var metragemWrap = window.el('div', {
        style: 'display:flex; align-items:center; border:1px solid var(--rv-border-strong); border-radius:4px; overflow:hidden; background:var(--rv-surface);'
      }, metragemInput, window.el('span', { style: 'padding:9px 12px 9px 0; color:var(--rv-text-tertiary); font-size:14px;' }, 'm'));
      var metragemField = window.el('div', {}, requiredLabel('Metragem'), metragemWrap);

      var larguraMetragemRow = window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;'
      }, larguraField, metragemField);

      function refreshDerivados() {
        var mod = modeloById(draft.modeloId);
        larguraSpan.textContent = mod ? larguraStr(mod) : '—';
        cor1Span.textContent = mod ? corNome(mod.cor_1_id) : '—';
        cor2Span.textContent = mod ? corNome(mod.cor_2_id) : '—';
        renderReferencia();
      }

      tipoSelect.addEventListener('change', function () {
        draft.tipo = tipoSelect.value;
        // Trocar o Tipo limpa o modelo incompativel e tudo que dele deriva.
        var atual = modeloById(draft.modeloId);
        if (!draft.tipo || (atual && rowApi.rotaDoModelo(atual) !== draft.tipo)) draft.modeloId = '';
        preencherModelos();
        refreshDerivados();
      });

      modeloSelect.addEventListener('change', function () {
        // modelo_id continua sendo a UNICA identidade de produto persistida.
        draft.modeloId = modeloSelect.value;
        refreshDerivados();
      });

      rowApi.fillTipoSelect(tipoSelect, draft.tipo, !tipoMetadataOk);
      preencherModelos();

      // Referência visual. A ilustração sintética anterior não tinha nenhum
      // dado de produto por trás dela e foi retirada (D9): o que aparece aqui
      // são as cores reais do modelo selecionado, ou um estado vazio honesto.
      var referenciaBox = window.el('div', {
        style: 'height:120px; border-radius:4px; overflow:hidden; position:relative;'
          + 'border:1px solid var(--rv-border); background:var(--rv-surface-subtle);'
          + 'display:flex; align-items:center; justify-content:center;',
      });

      function renderReferencia() {
        var mod = modeloById(draft.modeloId);
        var nome1 = mod && mod.cor_1_id ? corNome(mod.cor_1_id) : null;
        var nome2 = mod && mod.cor_2_id ? corNome(mod.cor_2_id) : null;
        if (!mod || ((!nome1 || nome1 === '—') && (!nome2 || nome2 === '—'))) {
          referenciaBox.replaceChildren(window.el('span', {
            style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
          }, 'Selecione um modelo para ver as cores.'));
          return;
        }
        var faixas = window.el('div', { style: 'display:flex; width:100%; height:100%;' });
        [nome1, nome2].forEach(function (nome) {
          if (!nome || nome === '—') return;
          faixas.appendChild(window.el('div', {
            title: nome,
            style: 'flex:1 1 0; background:' + window.corPreviewHex(nome) + ';',
          }));
        });
        referenciaBox.replaceChildren(faixas);
      }
      renderReferencia();

      var referenciaField = window.el('div', {},
        plainLabel('Referência visual'),
        referenciaBox
      );

      // Observação do item
      // B1: the 80px inline minimum becomes the canonical `medium` role. The
      // extra bottom padding that reserves room for the character counter is
      // the named `counter` modifier, not a padding escape hatch, and the
      // non-resizable grip is the bounded `resize: 'none'` option. maxlength,
      // the counter and the draft binding are unchanged.
      var obsTextarea = window.textArea({
        role: 'medium',
        counter: true,
        resize: 'none',
        maxlength: 200,
        placeholder: 'Ex.: prioridade vitrine, embalagem separada, atenção na largura...',
        ariaLabel: 'Observação do item',
      });
      var counterSpan = window.el('span', {
        style: 'position:absolute; right:12px; bottom:10px; font-size:12px; color:var(--rv-text-tertiary);'
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
      }, tipoField, modeloField, coresField, larguraMetragemRow, referenciaField, obsField);

      var cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: close,
      }, 'Cancelar');

      var confirmBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:4px; padding:9px 20px; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
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

      // A1 §6: canonical modal action bar. Two deviations are surrendered to
      // the owner — gap 12px becomes the canonical 10px, and the stronger
      // var(--rv-border) divider becomes var(--rv-border-soft). The 14px of
      // outer separation from the body is NOT part of the bar contract, so it
      // is passed as caller-owned spacing and the bar keeps its exact
      // position in this modal.
      var footer = window.modalActionBar([cancelBtn, confirmBtn], { marginTop: '14px' });

      var card = window.el('div', {
        style: 'background:var(--rv-surface); border-radius:4px; width:460px; max-width:100%; max-height:90vh; box-shadow:var(--rv-shadow-popover); overflow:hidden; display:flex; flex-direction:column;'
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
        style: 'display:inline-flex; align-items:center; gap:8px; background:var(--rv-surface); color:var(--rv-accent-blue); border:1px solid var(--rv-brand); border-radius:4px; padding:7px 13px; font-weight:600; font-size:13.5px; font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () { openAddItemModal(); },
      }, svgEl(SVG_PLUS), 'Adicionar item');

      var tableHeader = window.el('div', {
        style: 'display:grid; grid-template-columns:' + COLS + '; align-items:center; gap:12px; padding:10px 18px; background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border);'
      },
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Img'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Modelo'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Cores'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Largura'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Metragem (m)'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Observação'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, 'Ações')
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
        style: 'display:flex; align-items:center; justify-content:space-between; padding:10px 18px; background:var(--rv-surface-subtle);'
      },
        window.el('span', { style: 'font-size:13.5px; color:var(--rv-text-secondary);' },
          'Total de itens: ',
          window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;' }, String(state.itens.length))
        ),
        window.el('span', { style: 'font-size:13.5px; color:var(--rv-text-secondary);' },
          'Metragem total: ',
          window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;' }, totalStr)
        )
      );

      // Pass-8 §2.5: the Img (60px) and Ações (84px) columns are fixed in
      // pixels, so header and rows scroll together inside their OWN container
      // — the canonical `data-rv-table-scroll` owner from css/responsive.css —
      // instead of being clipped by the wrapper's `overflow:hidden`. The total
      // footer stays outside the scroller, as it is not a table row.
      var tableScroll = window.el('div', { 'data-rv-table-scroll': '', style: 'overflow-x:auto;' },
        window.el('div', { style: 'min-width:880px;' }, tableHeader, rowsWrap));
      var tableWrap = window.el('div', {
        style: 'border:1px solid var(--rv-border); border-radius:4px; overflow:hidden;'
      }, tableScroll, tableFooter);

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; box-shadow:var(--rv-shadow-none); padding:16px 20px; margin-bottom:14px;'
      },
        window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;' },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Itens do pedido'),
          addBtn
        ),
        tableWrap
      );
    }

    // ------------------------------------------------------------------
    // Section: Instruções + Finalizar
    // ------------------------------------------------------------------
    function buildBottomSection(saveBtn) {
      // B1: autosizing is preserved exactly and becomes content-driven by the
      // shared owner. This textarea never declared a minimum — it is sized by
      // rows=1 and then by its content — so it keeps the `rows` role, which
      // declares none. The state binding is unchanged.
      var obsTextarea = window.textArea({
        role: 'rows',
        autosize: true,
        rows: 1,
        value: state.observacao,
        placeholder: 'Informações adicionais sobre entrega, conferência ou prioridade…',
        ariaLabel: 'Instruções gerais',
      });
      obsTextarea.addEventListener('input', function () {
        state.observacao = obsTextarea.value;
      });

      var instrCard = window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; box-shadow:var(--rv-shadow-none); padding:16px 20px;'
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Instruções gerais'),
        obsTextarea
      );

      var checkoutCard = window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; box-shadow:var(--rv-shadow-none); padding:16px 20px; display:flex; flex-direction:column; justify-content:center;'
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Ir para checkout'),
        saveBtn
      );

      return window.el('div', {
        style: 'display:grid; grid-template-columns:3fr 1fr; gap:14px; align-items:stretch;'
      }, instrCard, checkoutCard);
    }

    function buildPostSaveResumo() {
      var pedido = postSave && postSave.pedido ? postSave.pedido : {};
      var resumo = postSave && postSave.resumo ? postSave.resumo : {};
      var pedidoLabel = pedido.numero != null ? '#' + pedido.numero : pedido.id;
      var fields = [
        { label: 'Pedido', value: pedidoLabel || '-' },
        { label: 'Itens', value: String(resumo.itemCount || 0) },
        { label: 'Metragem total', value: resumo.totalMetrosLabel || '0,00 m' },
        { label: 'Recebimento', value: resumo.recebimento === 'entrega' ? 'Entrega' : 'Retirada' },
      ];

      return window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-pill-info-border);border-radius:4px;box-shadow:var(--rv-shadow-none);padding:18px 20px;margin-bottom:14px;',
        'data-post-save-summary': 'cliente',
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:800;color:var(--rv-text-primary);margin-bottom:6px;' }, 'Pedido enviado'),
        window.el('div', { style: 'font-size:13px;color:var(--rv-text-secondary);line-height:1.5;margin-bottom:14px;' },
          'Recebemos seu pedido. A equipe da Ravatex fara a conferencia e atualizara o acompanhamento.'),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;',
        }, fields.map(function (field) {
          return window.el('div', {
            style: 'background:var(--rv-surface-subtle);border:1px solid var(--rv-border);border-radius:4px;padding:10px 12px;',
          },
            window.el('div', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);font-weight:600;margin-bottom:5px;' }, field.label),
            window.el('div', { style: 'font-size:14px;color:var(--rv-text-primary);font-weight:700;' }, field.value)
          );
        })),
        window.el('div', {
          style: 'background:var(--rv-surface-subtle);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:12px 14px;font-size:13px;color:var(--rv-pill-info-text);line-height:1.5;margin-bottom:14px;',
          'data-next-steps': 'cliente',
        }, 'Proximos passos: acompanhe o andamento em Meus pedidos ou envie outro pedido quando precisar.'),
        // Pass-5 STANDARD_ACTION_FOOTER: actions only, right aligned.
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rv-border-soft);padding-top:11px;',
          'data-post-save-actions': 'cliente',
          'data-card-actions': '',
        },
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, 'Ver meus pedidos'),
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:9px 16px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos/novo'); },
          }, 'Criar novo pedido')
        )
      );
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
        pedidoPayload.data_pedido = state.dataPedido;
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

        postSave = {
          pedido: pedidoRes.data,
          resumo: {
            itemCount: state.itens.length,
            totalMetrosLabel: totalMetrosStr(),
            recebimento: state.recebimento,
          },
        };
        window.toast('Pedido #' + pedidoRes.data.numero + ' enviado.', 'success');
        render();
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
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:4px; padding:10px 0; width:100%; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: function () { salvar(saveBtn); },
      }, 'Finalizar pedido');

      if (loadingError) {
        container.replaceChildren(
          buildHeader(),
          window.el('div', {
            style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:4px; padding:24px; color:var(--rv-signal-negative);'
          }, 'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a página.')
        );
        return;
      }

      if (postSave) {
        container.replaceChildren(
          buildHeader(),
          buildPostSaveResumo()
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
