// =====================================================================
// === SCREENS: PEDIDO ITEM ROW EDITOR =================================
// Dono UNICO da linha editavel de item de Pedido e da regra
// Tipo-antes-de-Modelo.
//
// Fase: KLEBER-APP-OPERATIONAL-STABILIZATION-BATCH-02-R1.
//
// POR QUE ESTE MODULO EXISTE
//   O item deixou de ser uma entidade dentro de um modal: ele e editado
//   DIRETAMENTE na linha da tabela do Pedido. Como js/screens/pedido-form.js
//   ja estava no patamar excepcional de tamanho (CODE_HEALTH_RULES.md sec.7),
//   a linha de item foi extraida para ca em vez de engordar o monolito.
//   Nao existem dois editores de item concorrentes: este e o unico.
//
// REGRA BINDING — TIPO ANTES DE MODELO
//   A rota do produto vem EXCLUSIVAMENTE de `modelos.tipo_produto`
//   (MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT sec.1), alcancada por
//   `pedido_itens.modelo_id`. NUNCA do nome do modelo, da largura, das
//   cores, do fornecedor ou do tipo da OP.
//
//   FALHA FECHADA: se o metadado de tipo nao pode ser carregado, este modulo
//   NAO oferece modelo algum. Um modelo sem `tipo_produto` resolve para
//   `null` e nao aparece em NENHUMA das duas listas. Degradar silenciosamente
//   todo modelo desconhecido para Tapete e explicitamente proibido: isso
//   colocaria uma Manta na rota de acabamento sem ninguem perceber.
//
// O Tipo e SELECAO DE UI E FILTRO. Ele nunca e persistido em `pedido_itens`:
// a identidade do produto gravada continua sendo apenas `modelo_id`.
//
// Carregar via <script src="js/screens/pedido-item-row-editor.js?v=..."></script>
// DEPOIS de js/product-route.js e ANTES de js/screens/pedido-form.js.
// =====================================================================

(function (window) {
  'use strict';

  var TAPETE = 'tapete';
  var MANTA = 'manta';

  // Definicao UNICA das colunas: cabecalho e TODA linha de dado consomem esta
  // constante, entao um desalinhamento entre eles e impossivel por construcao.
  var GRID_COLS = '60px .62fr 1.28fr 1.1fr .8fr .55fr 1.2fr 84px';
  var HEADER_LABELS = ['Img', 'Tipo', 'Modelo', 'Cores', 'Largura', 'Metragem (m)', 'Observacao', 'Acoes'];

  var SVG_TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-negative)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

  function svgEl(markup) {
    var tmp = window.document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  function routeApi() {
    return window.RAVATEX_PRODUCT_ROUTE || null;
  }

  // 'tapete' | 'manta' | null. NULL e o sinal de falha fechada: o modelo nao
  // declara tipo, entao nao pertence a rota nenhuma e nao pode ser oferecido.
  function rotaDoModelo(modelo) {
    if (!modelo) return null;
    var raw = modelo.tipo_produto;
    if (raw == null || String(raw).trim() === '') return null;
    var api = routeApi();
    if (api && typeof api.normalizeRoute === 'function') return api.normalizeRoute(raw);
    return String(raw).trim().toLowerCase() === MANTA ? MANTA : TAPETE;
  }

  function tipoLabel(rota) {
    if (rota !== TAPETE && rota !== MANTA) return '-';
    var api = routeApi();
    if (api && typeof api.routeLabel === 'function') return api.routeLabel(rota);
    return rota === MANTA ? 'Manta' : 'Tapete';
  }

  function tipoStrForModelo(modelo) {
    return tipoLabel(rotaDoModelo(modelo));
  }

  // Recorte da unica lista carregada. Nunca ha listas Tapete/Manta mantidas a
  // mao, e um modelo sem tipo declarado nao entra em recorte algum.
  function modelosPorTipo(modelos, tipo) {
    if (!tipo || !Array.isArray(modelos)) return [];
    return modelos.filter(function (modelo) { return rotaDoModelo(modelo) === tipo; });
  }

  function corNome(cor) {
    return cor && cor.nome ? cor.nome : '-';
  }

  function corResumo(modelo) {
    if (!modelo) return '-';
    return corNome(modelo.cor_1) + ' / ' + corNome(modelo.cor_2);
  }

  function larguraStr(modelo) {
    if (!modelo) return '-';
    return typeof modelo.largura === 'number'
      ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
      : String(modelo.largura || '-');
  }

  // Formatador UNICO da opcao de modelo: "<MODELO> - <COR 1>/<COR 2>".
  function modeloOptionLabel(modelo) {
    if (!modelo) return '';
    return String(modelo.nome == null ? '' : modelo.nome)
      + ' – ' + corNome(modelo.cor_1) + '/' + corNome(modelo.cor_2);
  }

  function modeloById(modelos, id) {
    var list = Array.isArray(modelos) ? modelos : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  // A cor do swatch e a cor real do modelo: dado de negocio, dono canonico
  // js/pedido-ui.js. Sem modelo selecionado nao ha cor a mostrar (D9).
  function swatchColor(modelo) {
    var nome = modelo && typeof modelo === 'object' ? (modelo.cor_1 && modelo.cor_1.nome) || modelo.nome : modelo;
    return window.corPreviewHex(nome);
  }

  function selectStyle() {
    return 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:6px 8px; font-size:13.5px; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; cursor:pointer; outline:none;';
  }

  // Preenche o select de Tipo. `disabled` cobre a falha fechada: sem metadado
  // de tipo nao ha o que escolher.
  function fillTipoSelect(select, current, disabled) {
    select.replaceChildren();
    [
      { value: '', label: 'Tipo...' },
      { value: TAPETE, label: tipoLabel(TAPETE) },
      { value: MANTA, label: tipoLabel(MANTA) }
    ].forEach(function (spec) {
      var option = window.el('option', { value: spec.value }, spec.label);
      if (spec.value === current) option.selected = true;
      select.appendChild(option);
    });
    select.value = current || '';
    if (disabled) select.setAttribute('disabled', 'disabled');
    else select.removeAttribute('disabled');
  }

  // Preenche o select de Modelo com o recorte da rota. Sem Tipo o campo fica
  // desabilitado e vazio.
  function fillModeloSelect(select, modelos, tipo, currentId) {
    var disponiveis = modelosPorTipo(modelos, tipo);
    select.replaceChildren(window.el('option', { value: '' }, 'Modelo...'));
    for (var i = 0; i < disponiveis.length; i++) {
      var option = window.el('option', { value: disponiveis[i].id }, modeloOptionLabel(disponiveis[i]));
      if (String(disponiveis[i].id) === String(currentId)) option.selected = true;
      select.appendChild(option);
    }
    select.value = currentId ? String(currentId) : '';
    if (tipo) select.removeAttribute('disabled');
    else select.setAttribute('disabled', 'disabled');
  }

  // ===================================================================
  // buildRow — a linha editavel completa.
  //
  //   item          entrada local { uid, tipo, modeloId, metros, observacao }
  //   modelos       lista unica ja carregada (com tipo_produto)
  //   onChange      chamado apos qualquer mutacao do item (para totais)
  //   onRemove      chamado com o item quando o lixo e clicado
  //   typeMetadata  false => falha fechada: Tipo/Modelo desabilitados
  // ===================================================================
  function buildRow(options) {
    var opts = options || {};
    var item = opts.item;
    var modelos = opts.modelos || [];
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var onRemove = typeof opts.onRemove === 'function' ? opts.onRemove : function () {};
    var typeMetadata = opts.typeMetadata !== false;

    // O Tipo corrente e DERIVADO do modelo autoritativo sempre que existe um;
    // so um item ainda sem modelo carrega o Tipo escolhido pelo operador.
    var modeloAtual = modeloById(modelos, item.modeloId);
    if (modeloAtual) item.tipo = rotaDoModelo(modeloAtual);
    if (!item.tipo) item.tipo = item.tipo || '';

    // BATCH-03 (densidade operacional): o padding vertical caiu de 9px para
    // 7px e o horizontal de 18px para 14px. Os CONTROLES nao encolheram — os
    // selects, o campo de metragem e o de observacao mantem os mesmos 6px/8px
    // de padding e 13.5px de fonte, entao o alvo de clique continua o mesmo.
    // O que saiu foi folga morta em volta deles.
    var row = window.el('div', {
      style: 'display:grid; grid-template-columns:' + GRID_COLS + '; align-items:center; gap:12px; padding:7px 14px; border-bottom:1px solid var(--rv-border-soft); min-width:920px;',
      'data-uid': item.uid
    });

    var previewSlot = window.el('div', {
      'data-preview-slot': '1',
      style: 'width:32px; height:32px; border-radius:4px; overflow:hidden; border:1px solid var(--rv-border); background:var(--rv-signal-caution-bg); flex-shrink:0; display:flex; align-items:center; justify-content:center;'
    });

    function updatePreview() {
      previewSlot.replaceChildren();
      var selectedModel = modeloById(modelos, item.modeloId);
      if (selectedModel && selectedModel.cor_1 && window.corPreviewElement) {
        var previewNode = window.corPreviewElement(selectedModel.cor_1.nome);
        if (previewNode) {
          previewNode.style.width = '100%';
          previewNode.style.height = '100%';
          previewNode.style.border = 'none';
          previewSlot.appendChild(previewNode);
          return;
        }
      }
      previewSlot.appendChild(window.el('div', {
        style: 'width:100%; height:100%; background:' + (selectedModel ? swatchColor(selectedModel) : 'var(--rv-surface-subtle)') + ';'
      }));
    }

    var tipoSelect = window.el('select', {
      'data-item-tipo-select': '1',
      style: selectStyle()
    });
    var modeloSelect = window.el('select', {
      'data-item-modelo-select': '1',
      style: selectStyle()
    });

    var coresCell = window.el('div', { 'data-item-cores': '1', style: 'font-size:13.5px;' });
    var larguraCell = window.el('div', { 'data-item-largura': '1', style: 'font-size:13.5px;' });

    function paint(cell, value, filled) {
      cell.textContent = value;
      cell.style.color = filled ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)';
    }

    // Reflete no DOM tudo que depende do modelo escolhido.
    function refreshDerived() {
      var selectedModel = modeloById(modelos, item.modeloId);
      paint(coresCell, selectedModel ? corResumo(selectedModel) : '-', !!selectedModel);
      paint(larguraCell, selectedModel ? larguraStr(selectedModel) : '-', !!selectedModel);
      updatePreview();
    }

    tipoSelect.addEventListener('change', function () {
      item.tipo = tipoSelect.value;
      // Trocar o Tipo limpa o modelo que deixou de pertencer a rota, e com ele
      // TODO derivado: cores, largura e preview.
      var atual = modeloById(modelos, item.modeloId);
      if (!item.tipo || (atual && rotaDoModelo(atual) !== item.tipo)) item.modeloId = '';
      fillModeloSelect(modeloSelect, modelos, item.tipo, item.modeloId);
      refreshDerived();
      onChange(item);
    });

    modeloSelect.addEventListener('change', function () {
      // modelo_id continua sendo a UNICA identidade de produto persistida.
      item.modeloId = modeloSelect.value;
      refreshDerived();
      onChange(item);
    });

    var metrosInput = window.el('input', {
      type: 'number',
      value: item.metros,
      placeholder: '0,00',
      step: '0.01',
      min: '0.01',
      style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:6px 8px; font-size:13.5px; font-weight:600; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;'
    });
    metrosInput.addEventListener('input', function () {
      item.metros = metrosInput.value;
      onChange(item);
    });

    var obsInput = window.el('input', {
      type: 'text',
      value: item.observacao,
      placeholder: '-',
      maxlength: '200',
      style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:4px; padding:6px 8px; font-size:13.5px; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;'
    });
    obsInput.addEventListener('input', function () {
      item.observacao = obsInput.value;
      onChange(item);
    });

    var removeBtn = window.el('span', {
      style: 'cursor:pointer;',
      title: 'Remover item',
      onclick: function () { onRemove(item); }
    }, svgEl(SVG_TRASH));

    fillTipoSelect(tipoSelect, item.tipo, !typeMetadata);
    fillModeloSelect(modeloSelect, modelos, typeMetadata ? item.tipo : '', item.modeloId);
    refreshDerived();

    row.appendChild(previewSlot);
    row.appendChild(tipoSelect);
    row.appendChild(modeloSelect);
    row.appendChild(coresCell);
    row.appendChild(larguraCell);
    row.appendChild(metrosInput);
    row.appendChild(obsInput);
    row.appendChild(window.el('div', { style: 'display:flex; align-items:center; gap:16px;' }, removeBtn));
    return row;
  }

  function buildHeader() {
    var header = window.el('div', {
      'data-itens-header': '1',
      style: 'display:grid; grid-template-columns:' + GRID_COLS + '; align-items:center; gap:12px; padding:8px 14px; background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border); min-width:920px;'
    });
    HEADER_LABELS.forEach(function (label) {
      header.appendChild(window.el('div', { style: 'font-size:13px; font-weight:600; color:var(--rv-text-secondary);' }, label));
    });
    return header;
  }

  window.RAVATEX_PEDIDO_ITEM_ROW = {
    TAPETE: TAPETE,
    MANTA: MANTA,
    GRID_COLS: GRID_COLS,
    HEADER_LABELS: HEADER_LABELS,
    rotaDoModelo: rotaDoModelo,
    tipoLabel: tipoLabel,
    tipoStrForModelo: tipoStrForModelo,
    modelosPorTipo: modelosPorTipo,
    modeloOptionLabel: modeloOptionLabel,
    modeloById: modeloById,
    corNome: corNome,
    corResumo: corResumo,
    larguraStr: larguraStr,
    fillTipoSelect: fillTipoSelect,
    fillModeloSelect: fillModeloSelect,
    buildRow: buildRow,
    buildHeader: buildHeader
  };
})(window);
