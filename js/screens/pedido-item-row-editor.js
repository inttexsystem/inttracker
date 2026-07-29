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
  //
  // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: a coluna Observacao foi retirada.
  // Sete colunas (era oito); Metragem ganha a largura liberada. A observacao
  // administrativa por item deixou de ser editavel na linha — ver a acao de
  // mencao em Acoes e o dono compartilhado do formato em js/pedido-draft.js.
  var GRID_COLS = '60px .70fr 1.45fr 1.15fr .80fr .90fr 92px';
  var HEADER_LABELS = ['Img', 'Tipo', 'Modelo', 'Cores', 'Largura', 'Metragem (m)', 'Acoes'];
  var ROW_MIN_WIDTH = '790px';

  var SVG_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-negative)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

  // '@' glyph da acao discreta de mencao. Stroke neutro/accent — nunca o
  // vermelho de SVG_TRASH — porque mencionar um item nao e destrutivo.
  var SVG_MENTION = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>';

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

  // Formatador UNICO da opcao de modelo: "<MODELO> - <COR 1>/<COR 2> · <LARGURA>".
  function modeloOptionLabel(modelo) {
    if (!modelo) return '';
    return String(modelo.nome == null ? '' : modelo.nome)
      + ' – ' + corNome(modelo.cor_1) + '/' + corNome(modelo.cor_2)
      + ' · ' + larguraStr(modelo);
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

  // Preenche o controle de Tipo. `disabled` cobre a falha fechada: sem
  // metadado de tipo nao ha o que escolher.
  // Pass-7 (UIC-006): o alvo e o popover canonico, nao um <select> nativo,
  // entao a repopulacao passa por setOptions() — nunca por replaceChildren()
  // ou option.selected. setOptions sozinho nao emite change.
  function fillTipoSelect(control, current, disabled) {
    control.setOptions([
      { value: TAPETE, label: tipoLabel(TAPETE) },
      { value: MANTA, label: tipoLabel(MANTA) }
    ], { value: current || '', placeholder: 'Tipo...' });
    control.disabled = !!disabled;
  }

  // Preenche o controle de Modelo com o recorte da rota. Sem Tipo o campo
  // fica desabilitado e vazio.
  function fillModeloSelect(control, modelos, tipo, currentId) {
    var disponiveis = modelosPorTipo(modelos, tipo);
    var opcoes = [];
    for (var i = 0; i < disponiveis.length; i++) {
      opcoes.push({ value: disponiveis[i].id, label: modeloOptionLabel(disponiveis[i]) });
    }
    control.setOptions(opcoes, {
      value: currentId ? String(currentId) : '',
      placeholder: 'Modelo...'
    });
    control.disabled = !tipo;
  }

  // ===================================================================
  // buildRow — a linha editavel completa.
  //
  //   item          entrada local { uid, tipo, modeloId, metros, observacao }
  //   modelos       lista unica ja carregada (com tipo_produto)
  //   index         posicao 0-based ATUAL do item no array local; usada para
  //                 numerar a acao de mencao ("Item {index+1}") e para o
  //                 dono compartilhado do formato da mencao.
  //   onChange      chamado apos qualquer mutacao do item (para totais)
  //   onRemove      chamado com o item quando o lixo e clicado
  //   onMention     chamado com o TEXTO PRONTO da mencao quando a acao @ e
  //                 clicada (PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1). Este
  //                 modulo apenas monta o texto via o dono compartilhado
  //                 (js/pedido-draft.js buildItemMention) e notifica; a
  //                 insercao no campo Observacoes gerais e responsabilidade
  //                 exclusiva da tela chamadora.
  //   typeMetadata  false => falha fechada: Tipo/Modelo desabilitados
  //   locked        true => TRAVA ESTRUTURAL (PEDIDO-UNIFIED-ADMIN-EDITOR-R1):
  //                 Tipo, Modelo, Metragem e o botao de remocao ficam
  //                 desabilitados. A acao de mencao NAO e estrutural e
  //                 permanece disponivel (EXECUTION ORDER sec.9.1 /
  //                 PEDIDO-ITEM-MENTION-OBSERVATION-UX-DESIGN-R1 sec.J).
  //   readOnly      true => pedido em status terminal: TUDO desabilitado,
  //                 inclusive a acao de mencao. Implica `locked`.
  // ===================================================================
  function buildRow(options) {
    var opts = options || {};
    var item = opts.item;
    var modelos = opts.modelos || [];
    var index = typeof opts.index === 'number' ? opts.index : -1;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var onRemove = typeof opts.onRemove === 'function' ? opts.onRemove : function () {};
    var onMention = typeof opts.onMention === 'function' ? opts.onMention : function () {};
    var typeMetadata = opts.typeMetadata !== false;
    var locked = !!opts.locked || !!opts.readOnly;

    // O Tipo corrente e DERIVADO do modelo autoritativo sempre que existe um;
    // so um item ainda sem modelo carrega o Tipo escolhido pelo operador.
    var modeloAtual = modeloById(modelos, item.modeloId);
    if (modeloAtual) item.tipo = rotaDoModelo(modeloAtual);
    if (!item.tipo) item.tipo = item.tipo || '';

    // Compatibilidade com valor legado de item.observacao (PEDIDO-ITEM-
    // MENTION-OBSERVATION-UX-R1 sec.K): a administrativa nao cria nem edita
    // mais observacao por item, mas um valor nao-vazio ja persistido deve
    // continuar visivel — nunca escondido, nunca editavel, nunca uma coluna
    // permanente. Ver hintNode mais abaixo.
    var legacyObsValue = item.observacao != null ? String(item.observacao).trim() : '';
    var hasLegacyObs = legacyObsValue !== '';

    // BATCH-03 (densidade operacional): o padding vertical caiu de 9px para
    // 7px e o horizontal de 18px para 14px. Os CONTROLES nao encolheram — os
    // selects e o campo de metragem mantem os mesmos 6px/8px de padding e
    // 13.5px de fonte, entao o alvo de clique continua o mesmo. O que saiu
    // foi folga morta em volta deles.
    var row = window.el('div', {
      style: 'display:grid; grid-template-columns:' + GRID_COLS + '; align-items:center; gap:12px; padding:7px 14px; border-bottom:' + (hasLegacyObs ? 'none' : '1px solid var(--rv-border-soft)') + '; min-width:' + ROW_MIN_WIDTH + ';',
      'data-uid': item.uid
    });

    var previewSlot = window.el('div', {
      'data-preview-slot': '1',
      style: 'width:32px; height:32px; border-radius:var(--rv-radius); overflow:hidden; border:1px solid var(--rv-border); background:var(--rv-signal-caution-bg); flex-shrink:0; display:flex; align-items:center; justify-content:center;'
    });

    function updatePreview() {
      previewSlot.replaceChildren();
      var selectedModel = modeloById(modelos, item.modeloId);
      if (selectedModel && selectedModel.cor_1 && window.corPreviewElement) {
        var previewNode = window.corPreviewElement(selectedModel.cor_1.nome, '100%');
        if (previewNode) {
          previewNode.style.border = 'none';
          previewSlot.appendChild(previewNode);
          return;
        }
      }
      previewSlot.appendChild(window.el('div', {
        style: 'width:100%; height:100%; background:' + (selectedModel ? swatchColor(selectedModel) : 'var(--rv-surface-subtle)') + ';'
      }));
    }

    var tipoSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Tipo' });
    tipoSelect.setAttribute('data-item-tipo-select', '1');
    var modeloSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Modelo' });
    modeloSelect.setAttribute('data-item-modelo-select', '1');

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
      refreshMention();
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
      style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); padding:6px 8px; font-size:13.5px; font-weight:600; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;'
    });
    metrosInput.addEventListener('input', function () {
      item.metros = metrosInput.value;
      onChange(item);
    });

    // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 — ACAO DE MENCAO DISCRETA.
    // Nao-destrutiva e nao-estrutural: so exige um modelo selecionado (para
    // que exista identidade legivel a mencionar) e permanece disponivel sob
    // trava estrutural pos-OP. So fica desabilitada quando a tela e terminal
    // (readOnly) ou quando o item ainda nao tem modelo.
    //
    // actionButton() nao expoe um jeito de alternar `disabled` depois de
    // construido sem deixar hover/opacidade dessincronizados (os listeners
    // de hover so sao presos na construcao). Por isso a acao de mencao vive
    // num SLOT que a linha reconstroi via refreshMention() sempre que
    // refreshDerived() roda (troca de Tipo ou de Modelo) — nunca um estado
    // congelado no momento em que a linha foi criada.
    var posLabel = index >= 0 ? String(index + 1) : '?';
    function buildMentionBtn() {
      var hasModelo = !!item.modeloId;
      var modeloParaMencao = hasModelo ? modeloById(modelos, item.modeloId) : null;
      var mentionDisabled = !!opts.readOnly || !hasModelo;
      var mentionTitle = hasModelo
        ? 'Mencionar item ' + posLabel + ' nas observações gerais'
        : 'Selecione o modelo para poder mencionar este item';
      var mentionAriaLabel = mentionTitle;
      if (hasModelo && modeloParaMencao) {
        mentionAriaLabel = 'Mencionar item ' + posLabel + ' — ' + modeloParaMencao.nome + ' · '
          + corResumo(modeloParaMencao) + ' · ' + larguraStr(modeloParaMencao) + ', nas observações gerais';
      }
      var btn = window.actionButton({
        title: mentionTitle,
        icon: svgEl(SVG_MENTION),
        disabled: mentionDisabled,
        onclick: function () {
          var draft = window.RAVATEX_PEDIDO_DRAFT;
          var mention = draft && typeof draft.buildItemMention === 'function'
            ? draft.buildItemMention(item, modelos, index)
            : null;
          if (mention) onMention(mention);
        }
      });
      btn.setAttribute('aria-label', mentionAriaLabel);
      btn.setAttribute('data-item-mention-action', '1');
      return btn;
    }
    var mentionSlot = window.el('span', { style: 'display:inline-flex;' }, buildMentionBtn());
    function refreshMention() {
      mentionSlot.replaceChildren(buildMentionBtn());
    }

    // SCREEN-GROUP-1 — ACAO DESTRUTIVA PELO DONO CANONICO.
    // Remover um item era um <span> com um SVG: nao focavel, sem resposta a
    // Enter/Espaco e sem nome acessivel — a unica acao destrutiva da linha
    // existia apenas para quem usa mouse. `window.actionButton` e o dono
    // ratificado da acao de linha 30x30 (UI_VISUAL_CONTRACT.md §8.1) e fornece
    // <button> real, `title` + `aria-label` e rotulo de leitor de tela, alem do
    // tratamento `danger` que separa visualmente a acao destrutiva. O
    // comportamento nao muda: continua chamando onRemove(item).
    var removeBtn = window.actionButton({
      title: 'Remover item',
      icon: svgEl(SVG_TRASH),
      danger: true,
      disabled: locked,
      onclick: function () { onRemove(item); }
    });

    fillTipoSelect(tipoSelect, item.tipo, locked || !typeMetadata);
    fillModeloSelect(modeloSelect, modelos, typeMetadata ? item.tipo : '', item.modeloId);
    if (locked) modeloSelect.disabled = true;
    refreshDerived();
    if (locked) metrosInput.disabled = true;

    row.appendChild(previewSlot);
    row.appendChild(tipoSelect);
    row.appendChild(modeloSelect);
    row.appendChild(coresCell);
    row.appendChild(larguraCell);
    row.appendChild(metrosInput);
    // PEDIDO-SCREEN-GROUP-3 fecha UI-ACTION-BUTTON-CALLER-WORKAROUND-REDUNDANT.
    // PEDIDO-SCREEN-GROUP-1 declarava aqui um `position:relative` de contorno:
    // actionButton() anexava o rotulo de leitor de tela como um
    // <span position:absolute> sem declarar contexto de posicionamento proprio,
    // entao o span resolvia contra o BLOCO CONTENDOR INICIAL e empurrava
    // `documentElement.scrollWidth` para 870 num viewport de 390px.
    // PEDIDO-SCREEN-GROUP-2 corrigiu o defeito no DONO COMPARTILHADO —
    // js/ui.js::actionButton() declara `position:relative` no proprio botao —,
    // o que tornou esta declaracao de chamador provadamente REDUNDANTE. Ela e
    // removida aqui sem reintroduzir overflow: o contexto continua existindo,
    // apenas passou a ser declarado por quem constroi o rotulo.
    //
    // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1: a mencao vem ANTES do remover
    // (referenciar antes de destruir); gap de 10px cabe as duas acoes 30x30
    // dentro dos 92px da coluna Acoes.
    row.appendChild(window.el('div', { style: 'display:flex; align-items:center; justify-content:center; gap:10px;' }, mentionSlot, removeBtn));

    if (!hasLegacyObs) return row;

    // Dica de compatibilidade legada (sec.K/PART 10): texto integral,
    // somente-leitura, sem coluna permanente — um bloco de largura total
    // ABAIXO da linha, nunca dentro da grade de colunas. Associada a linha
    // via aria-describedby para leitor de tela sem depender de foco. O
    // fragmento devolve DOIS nos irmaos ao chamador (rowsWrap.appendChild
    // aceita fragment normalmente); nenhum wrapper extra e introduzido, entao
    // `[data-uid]` continua sendo a propria linha de grade, diretamente
    // localizavel como antes.
    var hintId = 'pedido-item-legacy-obs-' + item.uid;
    row.setAttribute('aria-describedby', hintId);
    var hintNode = window.el('div', {
      id: hintId,
      'data-item-legacy-observacao': '1',
      role: 'note',
      style: 'padding:6px 14px 10px 14px; border-bottom:1px solid var(--rv-border-soft); background:var(--rv-surface-subtle); font-size:12.5px; line-height:1.5; color:var(--rv-text-secondary); white-space:normal; overflow-wrap:break-word;'
    },
      window.el('strong', { style: 'color:var(--rv-text-tertiary); font-weight:600;' }, 'Observação anterior do item: '),
      legacyObsValue
    );

    var fragment = window.document.createDocumentFragment();
    fragment.appendChild(row);
    fragment.appendChild(hintNode);
    return fragment;
  }

  function buildHeader() {
    var header = window.el('div', {
      'data-itens-header': '1',
      style: 'display:grid; grid-template-columns:' + GRID_COLS + '; align-items:center; gap:12px; padding:8px 14px; background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border); min-width:' + ROW_MIN_WIDTH + ';'
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
    ROW_MIN_WIDTH: ROW_MIN_WIDTH,
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
