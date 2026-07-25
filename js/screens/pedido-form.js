// =====================================================================
// === SCREENS: PEDIDO FORM ============================================
// Tela admin `#/pedidos/novo` - formulario de criacao de Pedido.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 +
//   RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A
// Escopo: criacao admin de Pedido (rascunho), reaproveitando a base
//   visual homologada de Cliente -> Novo Pedido sem alterar o payload,
//   permissoes, fluxo de salvamento ou navegacao administrativa.
//
// Carregar via <script src="js/screens/pedido-form.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedidos-list.js, js/pedido-ui.js e
// js/ui.js, e ANTES do <script> inline principal (compatibilidade com
// o setRoutes registrado em js/boot.js).
//
// Limitacao conhecida:
//   - Sem RPC/transacao atomica: grava 1 INSERT em `pedidos` e depois
//     N INSERTs em `pedido_itens`. Se a segunda etapa falhar, compensa
//     com DELETE do pedido criado.
//
// KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-01-R1:
//   - coluna `Tipo` na tabela de itens, derivada EXCLUSIVAMENTE de
//     `modelos.tipo_produto` (nunca do nome, largura, cores ou fornecedor);
//   - seletor de Tipo no modal de item, que FILTRA a lista de modelos;
//   - opcao do modal exibe "<MODELO> - <COR 1>/<COR 2>";
//   - icone de lapis ativo: edita o item local (mesmo `uid`, mesma posicao)
//     pelo MESMO modal, sem nenhuma escrita Supabase.
//   O payload de `pedido_itens` permanece semanticamente inalterado: o tipo
//   NAO e persistido, continua sendo fato de `modelos.tipo_produto`.
//
// DEBITO ESTRUTURAL NAO BLOQUEANTE (CODE_HEALTH_RULES.md sec.7):
//   Este arquivo passou de 863 para 1089 linhas neste lote, entrando no
//   patamar excepcional (>900) e permanecendo abaixo do limite duro de 1.200.
//   O split coeso — extrair o modal de item para um modulo proprio — foi
//   DEFERIDO porque a ordem autoriza um lote de defeitos localizado e proibe
//   reescrita ampla e caminho novo. Fazer o split preferencialmente na
//   proxima mudanca material que tocar este modal.
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

  // Definicao UNICA das colunas da tabela de itens — o cabecalho e TODA
  // linha de dado consomem esta mesma constante, entao um desalinhamento
  // entre eles e impossivel por construcao. A largura antes dedicada a
  // Metragem (1.1fr) foi dividida exatamente entre Tipo e Metragem
  // (.55fr + .55fr), preservando a largura total da tabela.
  var ITENS_GRID_COLS = '60px 1.1fr 1.1fr .8fr .55fr .55fr 1.2fr 84px';

  async function screenPedidoNovo() {
    var container = window.el('div', {});

    var clientes = [];
    var modelos = [];
    var loadingError = null;
    var isLoading = true;

    var state = {
      clienteId: '',
      prazoEntrega: '',
      observacao: '',
      itens: [
        { uid: novoUid(), modeloId: '', metros: '', observacao: '' }
      ]
    };
    var postSave = null;

    function modeloById(id) {
      for (var i = 0; i < modelos.length; i++) {
        if (String(modelos[i].id) === String(id)) return modelos[i];
      }
      return null;
    }

    function larguraStr(modelo) {
      if (!modelo) return '-';
      return typeof modelo.largura === 'number'
        ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
        : String(modelo.largura || '-');
    }

    function corNome(cor) {
      return cor && cor.nome ? cor.nome : '-';
    }

    function corResumo(modelo) {
      if (!modelo) return '-';
      return corNome(modelo.cor_1) + ' / ' + corNome(modelo.cor_2);
    }

    // -----------------------------------------------------------------
    // Rota / tipo de produto. A rota vem EXCLUSIVAMENTE de
    // `modelos.tipo_produto` (MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT sec.1),
    // nunca do nome do modelo, da largura, das cores, do fornecedor ou do
    // tipo da OP. Delega ao helper aceito js/product-route.js e degrada para
    // Tapete quando ele falta (contrato do proprio helper) ou quando o
    // modelo legado ainda nao carrega a coluna.
    // -----------------------------------------------------------------
    function routeApi() {
      return window.RAVATEX_PRODUCT_ROUTE || null;
    }

    function rotaDoModelo(modelo) {
      if (!modelo) return null;
      var api = routeApi();
      if (api && typeof api.normalizeRoute === 'function') return api.normalizeRoute(modelo.tipo_produto);
      return String(modelo.tipo_produto == null ? '' : modelo.tipo_produto).trim().toLowerCase() === 'manta'
        ? 'manta'
        : 'tapete';
    }

    function rotaLabel(rota) {
      var api = routeApi();
      if (api && typeof api.routeLabel === 'function') return api.routeLabel(rota);
      return rota === 'manta' ? 'Manta' : 'Tapete';
    }

    function tipoStr(modelo) {
      return modelo ? rotaLabel(rotaDoModelo(modelo)) : '-';
    }

    // Lista de modelos da rota escolhida. Nao existe lista Tapete/Manta
    // mantida a mao: e sempre um recorte da unica lista carregada.
    function modelosPorTipo(tipo) {
      if (!tipo) return [];
      return modelos.filter(function (modelo) { return rotaDoModelo(modelo) === tipo; });
    }

    // Formatador UNICO da opcao de modelo: "<MODELO> - <COR 1>/<COR 2>"
    // (travessao entre nome e cores, sem espacos em volta da barra). As
    // cores vem das cores ja carregadas junto do modelo, nunca do nome.
    function modeloOptionLabel(modelo) {
      if (!modelo) return '';
      return String(modelo.nome == null ? '' : modelo.nome)
        + ' – ' + corNome(modelo.cor_1) + '/' + corNome(modelo.cor_2);
    }

    function totalMetros() {
      var total = 0;
      for (var i = 0; i < state.itens.length; i++) {
        var value = parseFloat(state.itens[i].metros);
        if (Number.isFinite(value) && value > 0) total += value;
      }
      return total;
    }

    function totalMetrosStr() {
      var total = totalMetros();
      return total > 0
        ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
        : '0,00 m';
    }

    function updateItensSummary() {
      var totalLabel = totalMetrosStr();
      var itemCountLabel = String(state.itens.length);
      if (!container.querySelectorAll) return;

      var totalNodes = container.querySelectorAll('[data-pedido-total-metros]');
      for (var i = 0; i < totalNodes.length; i++) {
        totalNodes[i].textContent = totalLabel;
      }

      var countNodes = container.querySelectorAll('[data-pedido-total-itens]');
      for (var c = 0; c < countNodes.length; c++) {
        countNodes[c].textContent = itemCountLabel;
      }

      var summaryNodes = container.querySelectorAll('[data-pedido-checkout-summary]');
      for (var s = 0; s < summaryNodes.length; s++) {
        summaryNodes[s].textContent = 'Resumo: ' + itemCountLabel + ' item(ns) | ' + totalLabel;
      }
    }

    function clienteNomeById(id) {
      for (var i = 0; i < clientes.length; i++) {
        if (String(clientes[i].id) === String(id)) return clientes[i].nome;
      }
      return '-';
    }

    function swatchColor(modeloId) {
      var palette = ['#cfc6b4', '#8f8a80', '#c8a87a', '#7a8fa6', '#b0a898', '#a8b8c8', '#c4b8a0'];
      var idx = Math.abs(parseInt(String(modeloId), 10) || 0) % palette.length;
      return palette[idx];
    }

    async function carregarDados() {
      var results = await Promise.all([
        window.supa.from('clientes').select('id, nome').order('nome'),
        window.supa
          .from('modelos')
          .select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)')
          .order('nome')
      ]);

      var cliRes = results[0];
      var modRes = results[1];

      if (cliRes.error) {
        loadingError = 'clientes';
        window.toast('Erro ao carregar clientes', 'error');
        console.error(cliRes.error);
      } else {
        clientes = cliRes.data || [];
      }

      if (modRes.error) {
        loadingError = loadingError || 'modelos';
        window.toast('Erro ao carregar modelos', 'error');
        console.error(modRes.error);
      } else {
        modelos = modRes.data || [];
        await augmentarTipoProduto();
      }
    }

    // PHASE-MANTA-A: augmentacao best-effort de `tipo_produto` — o mesmo
    // padrao ja estabelecido em js/screens/pedido-itens-edit.js. Ambiente sem
    // a coluna disponivel nao pode derrubar a tela de Pedido: o modelo fica
    // sem o campo e resolve para Tapete. Somente LEITURA; nunca escreve
    // `tipo_produto`.
    async function augmentarTipoProduto() {
      try {
        var tpRes = await window.supa.from('modelos').select('id, tipo_produto');
        if (tpRes.error || !Array.isArray(tpRes.data)) return;
        var tpById = {};
        tpRes.data.forEach(function (row) {
          if (row && row.id != null) tpById[String(row.id)] = row.tipo_produto;
        });
        modelos.forEach(function (modelo) {
          if (tpById[String(modelo.id)] != null) modelo.tipo_produto = tpById[String(modelo.id)];
        });
      } catch (e) { /* coluna ausente: tratado como Tapete */ }
    }

    function buildHeader() {
      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap;'
      },
      window.el('div', { style: 'display:flex; align-items:flex-start; gap:16px;' },
        window.el('div', {
          style: 'width:36px; height:36px; border:1px solid #e2e5ea; border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
          onclick: function () { window.navigate('#/pedidos'); }
        }, svgEl(SVG_BACK)),
        window.el('div', {},
          window.el('h1', {
            style: 'margin:0; font-size:23px; font-weight:800; color:#16203a; letter-spacing:-.01em;'
          }, 'Novo pedido'),
          window.el('div', {
            style: 'font-size:13.5px; color:#8a93a3; margin-top:4px; max-width:760px;'
          }, 'Preencha os itens do pedido. Após o salvamento, ele ficará como Rascunho.')
        )
      ),
      window.el('button', {
        type: 'button',
        style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:8px 18px; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap;',
        onclick: function () { window.navigate('#/pedidos'); }
      }, 'Cancelar'));
    }

    function buildFieldLabel(text, required) {
      var children = [text];
      if (required) {
        children.push(' ');
        children.push(window.el('span', { style: 'color:#d6403a;' }, '*'));
      }
      return window.el('label', {
        style: 'display:block; font-size:13px; color:#5b6472; margin-bottom:6px;'
      }, children);
    }

    function buildSelectBox(selectEl) {
      return window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, selectEl, svgEl(SVG_CHEVRON));
    }

    function buildDadosGeraisCard() {
      var clienteSelect = window.el('select', {
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;'
      }, window.el('option', { value: '' }, 'Selecione o cliente...'));
      for (var i = 0; i < clientes.length; i++) {
        var option = window.el('option', { value: clientes[i].id }, clientes[i].nome);
        if (String(clientes[i].id) === String(state.clienteId)) option.selected = true;
        clienteSelect.appendChild(option);
      }
      clienteSelect.addEventListener('change', function () {
        state.clienteId = clienteSelect.value;
      });

      var prazoInput = window.el('input', {
        type: 'date',
        value: state.prazoEntrega,
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; min-width:0;'
      });
      prazoInput.addEventListener('change', function () {
        state.prazoEntrega = prazoInput.value;
      });
      var prazoWrap = window.el('div', {
        style: 'display:flex; align-items:center; gap:8px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, prazoInput, svgEl(SVG_CALENDAR));

      var statusSelect = window.el('select', {
        disabled: 'disabled',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:default; -webkit-appearance:none; appearance:none; min-width:0; opacity:1;'
      }, window.el('option', { value: 'rascunho', selected: 'selected' }, 'Rascunho'));

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:12px;' }, 'Dados gerais'),
      window.el('div', {
        style: 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;'
      },
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Cliente', true),
        buildSelectBox(clienteSelect)
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Prazo desejado'),
        prazoWrap
      ),
      window.el('div', { style: 'min-width:0;' },
        buildFieldLabel('Status inicial'),
        buildSelectBox(statusSelect)
      )));
    }

    function buildItemRow(item) {
      var modelo = modeloById(item.modeloId);
      var row = window.el('div', {
        style: 'display:grid; grid-template-columns:' + ITENS_GRID_COLS + '; align-items:center; gap:12px; padding:9px 18px; border-bottom:1px solid #f1f3f6; min-width:920px;',
        'data-uid': item.uid
      });

      var previewSlot = window.el('div', {
        'data-preview-slot': '1',
        style: 'width:36px; height:36px; border-radius:4px; overflow:hidden; border:1px solid rgba(0,0,0,.08); background:#f5f2ea; flex-shrink:0; display:flex; align-items:center; justify-content:center;'
      });

      function updatePreview() {
        previewSlot.replaceChildren();
        var selectedModel = modeloById(item.modeloId);
        if (selectedModel && selectedModel.cor_1 && window.corPreviewElement) {
          var previewNode = window.corPreviewElement(selectedModel.cor_1.nome);
          if (previewNode) {
            previewNode.style.width = '100%';
            previewNode.style.height = '100%';
            previewNode.style.borderRadius = '0';
            previewNode.style.border = 'none';
            previewSlot.appendChild(previewNode);
            return;
          }
        }
        previewSlot.appendChild(window.el('div', {
          style: 'width:100%; height:100%; background:' + (selectedModel ? swatchColor(item.modeloId) : '#d8d0c0') + ';'
        }));
      }

      var selectEl = window.el('select', {
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; color:#16203a; background:#fff; font-family:inherit; cursor:pointer; outline:none;'
      }, window.el('option', { value: '' }, 'Modelo...'));
      for (var i = 0; i < modelos.length; i++) {
        var opt = window.el('option', { value: modelos[i].id }, modelos[i].nome);
        if (String(modelos[i].id) === String(item.modeloId)) opt.selected = true;
        selectEl.appendChild(opt);
      }

      var coresCell = window.el('div', {
        style: 'font-size:13.5px; color:' + (modelo ? '#3f4757' : '#aab2bf') + ';'
      }, modelo ? corResumo(modelo) : '-');
      var larguraCell = window.el('div', {
        style: 'font-size:13.5px; color:' + (modelo ? '#3f4757' : '#aab2bf') + ';'
      }, modelo ? larguraStr(modelo) : '-');
      // Tipo do item: projecao de `modelos.tipo_produto` do modelo escolhido.
      // Linha sem modelo exibe '-' (nunca um tipo fabricado).
      var tipoCell = window.el('div', {
        'data-item-tipo': '1',
        style: 'font-size:13.5px; color:' + (modelo ? '#3f4757' : '#aab2bf') + ';'
      }, modelo ? tipoStr(modelo) : '-');

      selectEl.addEventListener('change', function () {
        item.modeloId = selectEl.value;
        var selectedModel = modeloById(item.modeloId);
        updatePreview();
        coresCell.textContent = selectedModel ? corResumo(selectedModel) : '-';
        coresCell.style.color = selectedModel ? '#3f4757' : '#aab2bf';
        larguraCell.textContent = selectedModel ? larguraStr(selectedModel) : '-';
        larguraCell.style.color = selectedModel ? '#3f4757' : '#aab2bf';
        tipoCell.textContent = selectedModel ? tipoStr(selectedModel) : '-';
        tipoCell.style.color = selectedModel ? '#3f4757' : '#aab2bf';
      });

      var metrosInput = window.el('input', {
        type: 'number',
        value: item.metros,
        placeholder: '0,00',
        step: '0.01',
        min: '0.01',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; font-weight:600; color:#16203a; background:#fff; font-family:inherit; outline:none;'
      });
      metrosInput.addEventListener('input', function () {
        item.metros = metrosInput.value;
        updateItensSummary();
      });

      var obsInput = window.el('input', {
        type: 'text',
        value: item.observacao,
        placeholder: '-',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:6px 8px; font-size:13.5px; color:#3f4757; background:#fff; font-family:inherit; outline:none;'
      });
      obsInput.addEventListener('input', function () {
        item.observacao = obsInput.value;
      });

      // Edicao do item AINDA NAO PERSISTIDO: abre o mesmo modal em modo de
      // edicao. Toda escrita continua exclusiva do fluxo final salvar().
      var editBtn = window.el('span', {
        style: 'cursor:pointer; opacity:1;',
        title: 'Editar item',
        onclick: function () { openItemModal({ mode: 'edit', item: item }); }
      }, svgEl(SVG_EDIT));

      var removeBtn = window.el('span', {
        style: 'cursor:pointer;',
        onclick: function () {
          state.itens = state.itens.filter(function (current) { return current.uid !== item.uid; });
          render();
        }
      }, svgEl(SVG_TRASH));

      updatePreview();
      row.appendChild(previewSlot);
      row.appendChild(selectEl);
      row.appendChild(coresCell);
      row.appendChild(larguraCell);
      row.appendChild(tipoCell);
      row.appendChild(metrosInput);
      row.appendChild(obsInput);
      row.appendChild(window.el('div', { style: 'display:flex; align-items:center; gap:16px;' }, editBtn, removeBtn));
      return row;
    }

    // Dono UNICO do modal de item, nos dois modos:
    //   openItemModal({ mode: 'add' })
    //   openItemModal({ mode: 'edit', item: <entrada de state.itens> })
    // Em modo de edicao o modal trabalha sobre um RASCUNHO e so grava sobre a
    // entrada local em "Salvar alteracoes"; cancelar/X/Escape/overlay deixam o
    // item original intacto. Nenhum dos modos escreve no Supabase.
    function openItemModal(options) {
      var opts = options || {};
      var target = opts.mode === 'edit' && opts.item ? opts.item : null;
      var isEdit = !!target;
      var modeloAtual = target ? modeloById(target.modeloId) : null;
      var draft = {
        tipo: modeloAtual ? rotaDoModelo(modeloAtual) : '',
        modeloId: target ? target.modeloId : '',
        metros: target ? target.metros : '',
        observacao: target ? (target.observacao || '') : ''
      };

      var overlay = window.el('div', {
        style: 'position:fixed; inset:0; background:rgba(22,32,58,.45); display:flex; align-items:center; justify-content:center; padding:40px; z-index:1000;'
      });
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) close();
      });

      function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') close();
      }

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

      function staticBox(content) {
        return window.el('div', {
          style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff;'
        }, content, svgEl(SVG_CHEVRON));
      }

      document.addEventListener('keydown', onKeydown);

      var closeBtn = window.el('button', {
        type: 'button',
        style: 'background:none; border:none; cursor:pointer; padding:4px; color:#9aa2af;',
        onclick: close
      }, svgEl(SVG_CLOSE));

      var header = window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px 12px;'
      },
      window.el('div', {},
        window.el('div', {
          style: 'font-size:16px; font-weight:700; color:#16203a;',
          'data-item-modal-title': '1'
        }, isEdit ? 'Editar item' : 'Adicionar item'),
        window.el('div', {
          style: 'font-size:13px; color:#8a93a3; margin-top:3px;'
        }, isEdit
          ? 'Altere os dados deste item. A alteracao vale para o rascunho local ate salvar o pedido.'
          : 'Informe os dados do item que sera incluido neste pedido administrativo.')
      ),
      closeBtn);

      // Tipo: selecao de UI que filtra os modelos. NAO e persistido; o tipo
      // continua sendo fato de `modelos.tipo_produto`, alcancado por modelo_id.
      var tipoSelect = window.el('select', {
        'data-item-modal-tipo': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;'
      });
      [
        { value: '', label: 'Selecione o tipo...' },
        { value: 'tapete', label: rotaLabel('tapete') },
        { value: 'manta', label: rotaLabel('manta') }
      ].forEach(function (spec) {
        var option = window.el('option', { value: spec.value }, spec.label);
        if (spec.value === draft.tipo) option.selected = true;
        tipoSelect.appendChild(option);
      });
      tipoSelect.value = draft.tipo;
      var tipoWrap = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, tipoSelect, svgEl(SVG_CHEVRON));

      var modeloSelect = window.el('select', {
        'data-item-modal-modelo': '1',
        style: 'flex:1; border:none; outline:none; font-size:14px; color:#16203a; background:transparent; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none; min-width:0;'
      });
      var modeloWrap = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; background:#fff;'
      }, modeloSelect, svgEl(SVG_CHEVRON));

      var cor1Span = window.el('span', { 'data-item-modal-cor1': '1' }, '-');
      var cor2Span = window.el('span', { 'data-item-modal-cor2': '1' }, '-');
      var larguraSpan = window.el('span', { 'data-item-modal-largura': '1' }, '-');

      // A lista do dropdown e SEMPRE um recorte de `modelos` pela rota
      // escolhida; sem tipo o campo permanece desabilitado e vazio.
      function renderModeloOptions() {
        var disponiveis = modelosPorTipo(draft.tipo);
        modeloSelect.replaceChildren(window.el('option', { value: '' }, 'Modelo...'));
        for (var m = 0; m < disponiveis.length; m++) {
          var option = window.el('option', { value: disponiveis[m].id }, modeloOptionLabel(disponiveis[m]));
          if (String(disponiveis[m].id) === String(draft.modeloId)) option.selected = true;
          modeloSelect.appendChild(option);
        }
        modeloSelect.value = draft.modeloId ? String(draft.modeloId) : '';
        if (draft.tipo) modeloSelect.removeAttribute('disabled');
        else modeloSelect.setAttribute('disabled', 'disabled');
      }

      function refreshModeloDependentes() {
        var selectedModel = modeloById(draft.modeloId);
        cor1Span.textContent = selectedModel ? corNome(selectedModel.cor_1) : '-';
        cor2Span.textContent = selectedModel ? corNome(selectedModel.cor_2) : '-';
        larguraSpan.textContent = selectedModel ? larguraStr(selectedModel) : '-';
        updateModalPreview();
      }

      tipoSelect.addEventListener('change', function () {
        draft.tipo = tipoSelect.value;
        // Trocar o Tipo limpa o modelo que deixou de pertencer a rota.
        var atual = modeloById(draft.modeloId);
        if (!draft.tipo || (atual && rotaDoModelo(atual) !== draft.tipo)) draft.modeloId = '';
        renderModeloOptions();
        refreshModeloDependentes();
      });

      modeloSelect.addEventListener('change', function () {
        draft.modeloId = modeloSelect.value;
        refreshModeloDependentes();
      });

      var metragemInput = window.el('input', {
        type: 'number',
        step: '0.01',
        min: '0.01',
        placeholder: '0,00',
        style: 'flex:1; border:none; outline:none; padding:9px 12px; font-size:14px; font-family:inherit; color:#16203a; background:transparent; min-width:0;'
      });
      metragemInput.value = draft.metros == null ? '' : String(draft.metros);
      metragemInput.addEventListener('input', function () {
        draft.metros = metragemInput.value;
      });
      var metragemWrap = window.el('div', {
        style: 'display:flex; align-items:center; border:1px solid #d8dce2; border-radius:4px; overflow:hidden; background:#fff;'
      }, metragemInput, window.el('span', { style: 'padding:9px 12px 9px 0; color:#9aa2af; font-size:14px;' }, 'm'));

      var obsTextarea = window.el('textarea', {
        placeholder: 'Ex.: prioridade, conferencia especial, observacao operacional...',
        maxlength: '200',
        style: 'width:100%; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px 24px; font-size:14px; font-family:inherit; color:#16203a; background:#fff; resize:none; outline:none; min-height:80px; line-height:1.5; box-sizing:border-box;'
      });
      obsTextarea.value = draft.observacao;
      var counterSpan = window.el('span', {
        style: 'position:absolute; right:12px; bottom:10px; font-size:12px; color:#c2c8d0;'
      }, String(draft.observacao.length) + '/200');
      obsTextarea.addEventListener('input', function () {
        draft.observacao = obsTextarea.value;
        counterSpan.textContent = obsTextarea.value.length + '/200';
      });

      // Referencia visual: reflete a cor 1 do modelo escolhido (mesmo helper
      // da linha da tabela) e cai no padrao decorativo quando nao ha modelo.
      var previewSlot = window.el('div', {
        'data-item-modal-preview': '1',
        style: 'height:120px; border-radius:4px; overflow:hidden; background:#d4c9a8; position:relative;'
      });

      function previewDecorativo() {
        return [
          window.el('div', { style: 'position:absolute; inset:0; background:repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(180,155,100,.25) 18px, rgba(180,155,100,.25) 19px),repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(180,155,100,.25) 18px, rgba(180,155,100,.25) 19px),repeating-linear-gradient(45deg, rgba(160,130,80,.15) 0 4px, transparent 4px 14px),linear-gradient(135deg, #c9b98a 0%, #d9caa0 30%, #c8b680 50%, #ddd0a8 70%, #c4b47c 100%);' }),
          window.el('div', { style: 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:72px; height:72px; border-radius:50%; border:3px solid rgba(100,75,30,.28); background:radial-gradient(circle, rgba(140,110,55,.3) 0%, transparent 70%);' }),
          window.el('div', { style: 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:40px; height:40px; border-radius:50%; border:2px solid rgba(100,75,30,.35); background:rgba(150,120,60,.2);' }),
          window.el('div', { style: 'position:absolute; inset:6px; border:1.5px solid rgba(100,75,30,.2); border-radius:2px;' }),
          window.el('div', { style: 'position:absolute; inset:10px; border:1px dashed rgba(100,75,30,.14); border-radius:2px;' })
        ];
      }

      function updateModalPreview() {
        previewSlot.replaceChildren();
        var selectedModel = modeloById(draft.modeloId);
        if (selectedModel && selectedModel.cor_1 && window.corPreviewElement) {
          var previewNode = window.corPreviewElement(selectedModel.cor_1.nome);
          if (previewNode) {
            previewNode.style.width = '100%';
            previewNode.style.height = '100%';
            previewNode.style.borderRadius = '0';
            previewNode.style.border = 'none';
            previewSlot.appendChild(previewNode);
            return;
          }
        }
        previewDecorativo().forEach(function (node) { previewSlot.appendChild(node); });
      }

      var body = window.el('div', {
        style: 'padding:0 20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex:1; min-height:0;'
      },
      window.el('div', {}, requiredLabel('Tipo'), tipoWrap),
      window.el('div', {}, requiredLabel('Modelo'), modeloWrap),
      window.el('div', {},
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
      ),
      window.el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:12px;' },
        window.el('div', {}, requiredLabel('Largura'), staticBox(larguraSpan)),
        window.el('div', {}, requiredLabel('Metragem'), metragemWrap)
      ),
      window.el('div', {},
        plainLabel('Referencia visual'),
        previewSlot
      ),
      window.el('div', {},
        plainLabel('Observacao do item'),
        window.el('div', { style: 'position:relative;' }, obsTextarea, counterSpan)
      ));

      var cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:#fff; color:#3f4757; border:1px solid #d8dce2; border-radius:4px; padding:9px 18px; font-weight:600; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: close
      }, 'Cancelar');

      var confirmBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb; color:#fff; border:none; border-radius:4px; padding:9px 20px; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: function () {
          if (!draft.tipo) {
            window.toast('Selecione o tipo do produto.', 'error');
            return;
          }
          if (!draft.modeloId) {
            window.toast('Selecione um modelo.', 'error');
            return;
          }
          var meters = Number(draft.metros);
          if (!Number.isFinite(meters) || meters <= 0) {
            window.toast('Metragem deve ser maior que zero.', 'error');
            return;
          }
          if (isEdit) {
            // O Pedido ainda NAO existe no banco: a edicao altera apenas a
            // entrada local correspondente, identificada pelo `uid` estavel.
            // O `uid` e a posicao sao preservados — nada e removido, anexado
            // ao fim, duplicado ou reordenado — e nenhuma escrita Supabase
            // acontece aqui (isso e exclusivo de salvar()).
            for (var e = 0; e < state.itens.length; e++) {
              if (state.itens[e].uid !== target.uid) continue;
              state.itens[e].modeloId = draft.modeloId;
              state.itens[e].metros = draft.metros;
              state.itens[e].observacao = draft.observacao;
              break;
            }
          } else {
            state.itens.push({
              uid: novoUid(),
              modeloId: draft.modeloId,
              metros: draft.metros,
              observacao: draft.observacao
            });
          }
          close();
          render();
        }
      }, isEdit ? 'Salvar alterações' : 'Adicionar item');

      var footer = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:flex-end; gap:12px; padding:14px 20px; border-top:1px solid #eceef1; margin-top:14px;'
      }, cancelBtn, confirmBtn);

      var card = window.el('div', {
        style: 'background:#fff; border-radius:4px; width:460px; max-width:100%; max-height:90vh; box-shadow:0 24px 60px rgba(20,30,45,.14); overflow:hidden; display:flex; flex-direction:column;'
      }, header, body, footer);

      // Estado inicial coerente nos dois modos: em 'add' o Modelo nasce
      // desabilitado (sem Tipo); em 'edit' o modal ja abre preenchido.
      renderModeloOptions();
      refreshModeloDependentes();

      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    function buildItensCard() {
      var cols = ITENS_GRID_COLS;
      var rowsWrap = window.el('div', {});
      for (var i = 0; i < state.itens.length; i++) {
        rowsWrap.appendChild(buildItemRow(state.itens[i]));
      }

      var addBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex; align-items:center; gap:8px; background:#fff; color:#2563eb; border:1px solid #2563eb; border-radius:4px; padding:7px 13px; font-weight:600; font-size:13.5px; font-family:inherit; cursor:pointer; white-space:nowrap;',
        onclick: function () { openItemModal({ mode: 'add' }); }
      }, svgEl(SVG_PLUS), 'Adicionar item');

      var table = window.el('div', {
        style: 'border:1px solid #eceef1; border-radius:4px; overflow:hidden;'
      },
      window.el('div', { style: 'overflow-x:auto;' },
        window.el('div', {
          style: 'display:grid; grid-template-columns:' + cols + '; align-items:center; gap:12px; padding:10px 18px; background:#f8f9fb; border-bottom:1px solid #eceef1; min-width:920px;'
        },
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Img'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Modelo'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Cores'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Largura'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Tipo'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Metragem (m)'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Observacao'),
        window.el('div', { style: 'font-size:13px; font-weight:600; color:#5b6472;' }, 'Acoes')
        ),
        rowsWrap
      ),
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 18px; background:#f8f9fb; flex-wrap:wrap;'
      },
      window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
        'Total de itens: ',
        window.el('strong', {
          style: 'color:#16203a; font-weight:700;',
          'data-pedido-total-itens': '1'
        }, String(state.itens.length))
      ),
      window.el('span', { style: 'font-size:13.5px; color:#5b6472;' },
        'Metragem total: ',
        window.el('strong', {
          style: 'color:#16203a; font-weight:700;',
          'data-pedido-total-metros': '1'
        }, totalMetrosStr())
      )));

      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; margin-bottom:14px;'
      },
      window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Itens do pedido'),
      addBtn),
      table);
    }

    function buildBottomSection(saveBtn) {
      function syncTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(textarea.scrollHeight, 40) + 'px';
      }

      var obsTextarea = window.el('textarea', {
        rows: 1,
        placeholder: 'Informações adicionais sobre conferência, prazo ou observações internas...',
        style: 'width:100%; min-height:40px; border:1px solid #d8dce2; border-radius:4px; padding:9px 12px; font-size:14px; color:#16203a; background:#fff; font-family:inherit; outline:none; resize:none; line-height:1.5; box-sizing:border-box; overflow-y:hidden;'
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', function () {
        state.observacao = obsTextarea.value;
        syncTextareaHeight(obsTextarea);
      });

      var instrCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a; margin-bottom:10px;' }, 'Instruções gerais'),
      obsTextarea);

      window.requestAnimationFrame(function () {
        syncTextareaHeight(obsTextarea);
      });

      var checkoutCard = window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:16px 20px; display:flex; flex-direction:column; justify-content:center;'
      },
      window.el('div', { style: 'font-size:16px; font-weight:700; color:#16203a;' }, 'Salvar rascunho'),
      window.el('div', {
        style: 'font-size:13px; color:#8a93a3; line-height:1.5; margin-top:10px; margin-bottom:14px;',
        'data-pedido-checkout-summary': '1'
      },
        'Resumo: ' + String(state.itens.length) + ' item(ns) | ' + totalMetrosStr()
      ),
      saveBtn);

      return window.el('div', {
        style: 'display:grid; grid-template-columns:3fr 1fr; gap:14px; align-items:stretch;'
      }, instrCard, checkoutCard);
    }

    function buildPostSaveResumo() {
      var pedido = postSave && postSave.pedido ? postSave.pedido : {};
      var resumo = postSave && postSave.resumo ? postSave.resumo : {};
      var pedidoLabel = pedido.numero != null ? '#' + pedido.numero : pedido.id;
      var fields = [
        { label: 'Cliente', value: resumo.clienteNome || '-' },
        { label: 'Pedido', value: pedidoLabel || '-' },
        { label: 'Itens', value: String(resumo.itemCount || 0) },
        { label: 'Metragem total', value: resumo.totalMetrosLabel || '0,00 m' },
      ];

      return window.el('div', {
        style: 'background:#fff;border:1px solid #d7e6fb;border-radius:4px;box-shadow:0 1px 2px rgba(20,30,45,.04);padding:18px 20px;margin-bottom:14px;',
        'data-post-save-summary': 'admin',
      },
        window.el('div', {
          style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;',
        },
          window.el('div', { style: 'min-width:240px;' },
            window.el('div', { style: 'font-size:18px;font-weight:800;color:#16203a;margin-bottom:5px;' }, 'Pedido salvo com sucesso'),
            window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
              'O pedido foi salvo. Abra a OP de tecelagem quando estiver pronto para iniciar a producao.')
          )
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;',
        }, fields.map(function (field) {
          return window.el('div', {
            style: 'background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:10px 12px;',
          },
            window.el('div', { style: 'font-size:11.5px;color:#8a93a3;font-weight:600;margin-bottom:5px;' }, field.label),
            window.el('div', { style: 'font-size:14px;color:#16203a;font-weight:700;' }, field.value)
          );
        })),
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;',
          'data-post-save-actions': 'right',
        },
          window.el('button', {
            type: 'button',
            style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/' + pedido.id); },
          }, 'Ver pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/novo'); },
          }, 'Novo pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 16px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
            onclick: function () { window.location.hash = '#/ops/nova?pedido_id=' + pedido.id; },
          }, 'Abrir OP de Tecelagem')
        )
      );
    }

    async function salvar(btn, status) {
      if (!state.clienteId) {
        window.toast('Selecione um cliente.', 'error');
        return;
      }
      if (state.itens.length === 0) {
        window.toast('Adicione ao menos um item.', 'error');
        return;
      }
      for (var i = 0; i < state.itens.length; i++) {
        var item = state.itens[i];
        if (!item.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione um modelo.', 'error');
          return;
        }
        var meters = Number(item.metros);
        if (!Number.isFinite(meters) || meters <= 0) {
          window.toast('Item ' + (i + 1) + ': metros deve ser > 0.', 'error');
          return;
        }
      }

      btn.disabled = true;
      var oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      try {
        var pedidoPayload = {
          cliente_id: Number(state.clienteId),
          status: status
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
            ? pedidoRes.error.message
            : 'desconhecido'), 'error');
          console.error(pedidoRes.error);
          return;
        }

        var pedidoId = pedidoRes.data.id;
        var itensPayload = state.itens.map(function (item, index) {
          return {
            pedido_id: pedidoId,
            modelo_id: Number(item.modeloId),
            metros: Number(item.metros),
            ordem: index,
            observacao: item.observacao || null
          };
        });

        var itensRes = await window.supa
          .from('pedido_itens')
          .insert(itensPayload)
          .select('id');

        if (itensRes.error) {
          console.error('Erro ao inserir itens, compensando:', itensRes.error);
          var delRes = await window.supa.from('pedidos').delete().eq('id', pedidoId);
          if (delRes.error) {
            window.toast(
              'Erro grave: pedido #' + pedidoRes.data.numero + ' criado sem itens e nao compensado. Contate suporte.',
              'error'
            );
            console.error('Compensacao falhou:', delRes.error);
          } else {
            window.toast('Erro ao inserir itens. Pedido cancelado. Tente novamente.', 'error');
          }
          return;
        }

        postSave = {
          pedido: pedidoRes.data,
          resumo: {
            clienteNome: clienteNomeById(state.clienteId),
            itemCount: state.itens.length,
            totalMetrosLabel: totalMetrosStr(),
          },
        };
        window.toast('Pedido #' + pedidoRes.data.numero + ' salvo como ' + status + '.', 'success');
        render();
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    function buildLoadingCard() {
      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:24px; color:#5b6472;'
      }, 'Carregando dados do formulario...');
    }

    function buildErrorCard() {
      return window.el('div', {
        style: 'background:#fff; border:1px solid #eceef1; border-radius:4px; box-shadow:0 1px 2px rgba(20,30,45,.04); padding:24px; color:#d6403a;'
      }, 'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a pagina.');
    }

    function render() {
      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb; color:#fff; border:none; border-radius:4px; padding:10px 0; width:100%; font-weight:700; font-size:14px; font-family:inherit; cursor:pointer;',
        onclick: function () { salvar(saveBtn, 'rascunho'); }
      }, 'Salvar rascunho');

      if (isLoading) {
        container.replaceChildren(buildHeader(), buildLoadingCard());
        return;
      }

      if (loadingError) {
        container.replaceChildren(buildHeader(), buildErrorCard());
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

    render();
    carregarDados()
      .catch(function (error) {
        loadingError = loadingError || 'dados';
        console.error('pedido-form: erro inesperado ao carregar dados', error);
      })
      .finally(function () {
        isLoading = false;
        render();
      });

    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoForm = {
    screenPedidoNovo: screenPedidoNovo
  };

  window.screenPedidoNovo = screenPedidoNovo;
})(window);
