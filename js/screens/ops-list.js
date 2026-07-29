// =====================================================================
// === SCREENS: OPS LIST ================================================
// Tela admin `#/ops`, fila de trabalho operacional, reconciliada com a
// identidade visual ratificada (ADMIN-OPS-LIST-VISUAL-IDENTITY-R1).
// Preserva integralmente: shell/sidebar/topbar globais; rota `#/ops` e
// navegacao para `#/ops/:id`; a regra de que a OP nasce de um Pedido
// (`Nova OP` orienta e vai para `#/pedidos`); leitura segura em Supabase
// (somente SELECTs); KPIs, filtros, busca, paginacao e exclusao
// controlada; acoes e permissoes (editar so simulada; demais ver).
// =====================================================================

(function (window) {
  'use strict';

  var PAGE_SIZE = 8;
  // Pass-7: the filter chevron now belongs to the canonical select popover;
  // this counter only mints the stable caption ids the triggers point at.
  var filterSeq = 0;
  var TABS = [
    { key: 'todos', label: 'Todas' },
    { key: 'tecelagem', label: 'Tecelagem' },
    { key: 'latex', label: 'Látex' }
  ];

  // §2.5: UM dono de largura, lido pelo cabecalho E por cada linha. As sete
  // faixas sao exatamente as que a tela ja declarava duas vezes.
  var TR_COLS = 'minmax(130px,1.05fr) minmax(120px,.9fr) minmax(170px,1.3fr) minmax(130px,1fr) minmax(130px,.95fr) 110px 90px';
  var TR_BASE = 'display:grid;grid-template-columns:' + TR_COLS + ';gap:18px;align-items:center;min-width:980px;';
  var THEAD_STYLE = 'font-size:var(--rv-fs-thead);font-weight:600;color:var(--rv-text-tertiary);text-transform:uppercase;letter-spacing:var(--rv-tracking-thead);';
  var CELL_STYLE = 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);';
  var TAB_BASE = 'display:inline-flex;align-items:center;height:var(--rv-h-compact);border-radius:var(--rv-radius);padding:0 11px;font-size:var(--rv-fs-body);cursor:pointer;white-space:nowrap;font-family:inherit;';
  var TAB_ACTIVE = TAB_BASE + 'font-weight:600;border:1px solid var(--rv-brand);background:var(--rv-brand);color:var(--rv-text-on-brand);';
  var TAB_IDLE = TAB_BASE + 'font-weight:500;border:1px solid var(--rv-border-strong);background:var(--rv-surface);color:var(--rv-text-secondary);';
  // Somente os estados que um `style` inline nao declara (hover, focus).
  var SCREEN_CSS = '.rv-ops-primary:hover{background:var(--rv-brand-strong);}'
    + '.rv-ops-compact:hover,.rv-ops-tab:hover{background:var(--rv-surface-subtle);}'
    + '.rv-ops-tab[aria-pressed="true"]:hover{background:var(--rv-brand);}'
    + '.rv-ops-search:hover{border-color:var(--rv-accent-blue);}'
    + '.rv-ops-search:focus-within{border-color:var(--rv-accent-blue);box-shadow:0 0 0 3px var(--rv-focus-ring);}'
    + '.rv-ops-list button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--rv-focus-ring);}';

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild || tmp.firstChild;
  }

  var ICON_PLUS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  var ICON_X ='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  // UI-ACTION-BUTTON-MIGRATION-2: 14px per UI_VISUAL_CONTRACT.md §8.1
  // (was 15px before conformance).
  var ICON_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var ICON_LEFT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_RIGHT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  var ICON_ALERT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg>';
  // Um KPI e MEDIDA categorica, nao severidade: as quatro superficies de icone
  // tomam o chip neutro (§2.4) e o glifo herda --rv-chip-glyph por currentColor.
  var ICON_TOTAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>';
  var ICON_PROD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';
  var ICON_SIM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>';
  var ICON_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2"></circle></svg>';

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function fmtData(v) {
    if (!v) return '—';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR');
    } catch (_) {
      return '—';
    }
  }

  function fmtOpLegacy(row) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpLegacyCode === 'function') return api.formatOpLegacyCode(row);
    var numero = row && row.numero != null ? row.numero : '---';
    return 'OP ' + numero + (row && row.ano != null ? '/' + row.ano : '');
  }

  function fmtOpDisplay(row, ctx) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') return api.formatOpOperationalCode(row, ctx || {});
    return fmtOpLegacy(row);
  }

  function kpiCard(iconMarkup, label, value) {
    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:var(--rv-pad-card);display:flex;align-items:center;gap:10px;min-width:0;'
    },
    window.el('div', {
      style: 'width:34px;height:34px;border-radius:var(--rv-radius);background:var(--rv-chip-bg);color:var(--rv-chip-glyph);display:flex;align-items:center;justify-content:center;flex-shrink:0;'
    }, svgEl(iconMarkup)),
    window.el('div', { style: 'min-width:0;' },
      window.el('div', { style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, label),
      window.el('div', { style: 'font-size:var(--rv-fs-kpi-card);font-weight:800;color:var(--rv-text-primary);line-height:1;' }, String(value))
    ));
  }

  // UI-ACTION-BUTTON-MIGRATION-2: pagination nav button, now built via
  // the shared actionButton() primitive (UI_VISUAL_CONTRACT.md §8.1).
  // `title` is new — the previous inline button had no accessible name
  // at all; this is a conformance gain (sr-only label), not a feature.
  function navBtn(svgMarkup, disabled, onclick, title) {
    return window.actionButton({
      title: title,
      icon: svgEl(svgMarkup),
      disabled: disabled,
      onclick: onclick
    });
  }

  // UI-ACTION-BUTTON-MIGRATION-2: row action button, now built via the
  // shared actionButton() primitive. Fixes the a11y divergence recorded
  // during the conformance diagnosis — the sr-only label previously used
  // display:none (hides it from assistive tech too, defeating the
  // purpose); actionButton() provides the correct clip-rect pattern
  // natively. `label`/`title` can still diverge (e.g. label "Ver" vs.
  // tooltip "Visualizar") via the explicit srLabel param.
  function actionIconButton(label, title, iconMarkup, disabled, onclick, danger) {
    return window.actionButton({
      title: title,
      srLabel: label,
      icon: svgEl(iconMarkup),
      disabled: disabled,
      danger: !!danger,
      onclick: onclick
    });
  }

  async function screenListaOPs() {
    var container = window.el('div', { class: 'rv-ops-list' });
    var state = {
      rows: [],
      itensPorOpId: {},
      error: false
    };
    var ui = {
      busca: '',
      tab: 'todos',
      cliente: 'todos',
      status: 'todos',
      criadaEm: 'todos',
      pagina: 1
    };
    var searchHasFocus = false;
    var searchCursorPos = 0;

    async function carregar() {
      var opsRes = await window.supa.from('ops')
        .select('id, numero, ano, status, tipo, criado_em, lote:lote_id(numero, pedido_id, pedido:pedido_id(id,numero,criado_em), cliente:cliente_id(nome)), op_itens(id, metros_pedidos, metros_ajustados)')
        .order('ano', { ascending: false })
        .order('numero', { ascending: false });

      var entregaRes = await window.supa.from('entrega_itens')
        .select('op_id, metros_entregues, defeito');

      if (opsRes.error) {
        state.error = true;
        state.rows = [];
        window.toast('Erro ao carregar OPs', 'error');
        console.error('ops-list: erro ao carregar ops', opsRes.error);
        return;
      }

      if (entregaRes.error) {
        state.error = true;
        state.rows = [];
        window.toast('Erro ao carregar progresso', 'error');
        console.error('ops-list: erro ao carregar progresso', entregaRes.error);
        return;
      }

      state.error = false;
      state.rows = opsRes.data || [];
      // PHASE-MANTA-A: best-effort product type per OP, derived from its items'
      // modelo.tipo_produto. Graceful before the migration is applied (column
      // absent => no product chip); never blocks the list.
      state.produtoTipoPorOp = {};
      try {
        var tpRes = await window.supa.from('op_itens').select('op_id, modelo:modelo_id(tipo_produto)');
        if (!tpRes.error && Array.isArray(tpRes.data)) {
          var disp = window.RAVATEX_OP_DISPLAY;
          var byOp = {};
          tpRes.data.forEach(function (r) { (byOp[r.op_id] = byOp[r.op_id] || []).push({ tipo_produto: r.modelo && r.modelo.tipo_produto }); });
          Object.keys(byOp).forEach(function (opId) {
            state.produtoTipoPorOp[opId] = (disp && disp.deriveProductType) ? disp.deriveProductType(byOp[opId]) : null;
          });
        }
      } catch (e) { /* coluna ausente: sem chip de produto */ }
      state.itensPorOpId = {};
      (entregaRes.data || []).forEach(function (item) {
        if (!item || item.op_id == null) return;
        if (!state.itensPorOpId[item.op_id]) state.itensPorOpId[item.op_id] = [];
        state.itensPorOpId[item.op_id].push(item);
      });
    }

    function entreguePct(row) {
      return window.percentualEntregueOP(row.op_itens || [], state.itensPorOpId[row.id] || []);
    }

    function clienteNome(row) {
      return row && row.lote && row.lote.cliente && row.lote.cliente.nome
        ? String(row.lote.cliente.nome)
        : '—';
    }

    function opsByPedido() {
      var grouped = {};
      state.rows.forEach(function (row) {
        var pedidoId = row && row.lote && row.lote.pedido_id != null ? row.lote.pedido_id : null;
        if (pedidoId == null) return;
        if (!grouped[pedidoId]) grouped[pedidoId] = [];
        grouped[pedidoId].push(row);
      });
      return grouped;
    }

    function opContext(row, grouped) {
      var pedido = row && row.lote && row.lote.pedido ? row.lote.pedido : null;
      var pedidoId = row && row.lote && row.lote.pedido_id != null ? row.lote.pedido_id : null;
      if (!pedido || pedidoId == null) return null;
      return { pedido: pedido, ops: grouped[pedidoId] || [] };
    }

    function statusBucket(row) {
      var key = normalizarKey(row && row.status);
      return key || 'todos';
    }

    function createdBucket(row) {
      if (!row || !row.criado_em) return 'todos';
      var d = new Date(row.criado_em);
      if (isNaN(d.getTime())) return 'todos';
      var now = new Date();
      var diff = (now.getTime() - d.getTime()) / 86400000;
      if (diff <= 7) return '7d';
      if (diff <= 30) return '30d';
      return 'old';
    }

    function tabMatches(row, key) {
      if (key === 'todos') return true;
      return normalizarKey(row.tipo || 'tecelagem') === key;
    }

    function computeKpis() {
      var total = state.rows.length;
      var emProducao = 0;
      var simuladas = 0;
      var abertas = 0;

      state.rows.forEach(function (row) {
        var status = normalizarKey(row.status);
        if (status === 'em_producao') emProducao += 1;
        if (status === 'simulada') simuladas += 1;
        if (status === 'aberta') abertas += 1;
      });

      return {
        total: total,
        emProducao: emProducao,
        simuladas: simuladas,
        abertas: abertas
      };
    }

    function applyFilters() {
      var termo = normalizarKey(ui.busca);
      var grouped = termo ? opsByPedido() : {};
      return state.rows.filter(function (row) {
        if (!tabMatches(row, ui.tab)) return false;
        if (ui.cliente !== 'todos' && clienteNome(row) !== ui.cliente) return false;
        if (ui.status !== 'todos' && statusBucket(row) !== ui.status) return false;
        if (ui.criadaEm !== 'todos' && createdBucket(row) !== ui.criadaEm) return false;
        if (termo) {
          var opLabel = row.numero != null ? String(row.numero).toLowerCase() : '';
          var displayLabel = fmtOpDisplay(row, opContext(row, grouped)).toLowerCase();
          var legacyLabel = fmtOpLegacy(row).toLowerCase();
          var loteLabel = row.lote && row.lote.numero != null ? String(row.lote.numero).toLowerCase() : '';
          var cliente = clienteNome(row).toLowerCase();
          if (opLabel.indexOf(termo) === -1 && displayLabel.indexOf(termo) === -1 && legacyLabel.indexOf(termo) === -1 && loteLabel.indexOf(termo) === -1 && cliente.indexOf(termo) === -1) return false;
        }
        return true;
      });
    }

    // §2.1: a barra de acao alinha ao TOPO do bloco de titulo, e `Nova OP` e a
    // unica acao dominante. A OP nasce de um Pedido: o botao orienta e navega
    // para `#/pedidos` — nunca para uma criacao avulsa.
    function buildHeader() {
      return window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;'
      },
      window.el('div', {},
        window.el('div', {
          style: 'font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-text-title);letter-spacing:var(--rv-tracking-title);line-height:1.1;'
        }, 'Ordens de Produção'),
        window.el('div', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);margin-top:3px;'
        }, 'Acompanhe as OPs da operação.')
      ),
      window.el('div', { style: 'display:flex;align-items:center;gap:8px;' },
        window.el('button', {
          type: 'button',
          class: 'rv-ops-primary',
          style: 'display:inline-flex;align-items:center;gap:7px;height:var(--rv-h-primary);background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);padding:0 16px;font-weight:600;font-size:var(--rv-fs-body);font-family:inherit;cursor:pointer;white-space:nowrap;',
          onclick: function () {
            window.toast('Crie a OP a partir de um Pedido.', 'info');
            window.navigate('#/pedidos');
          }
        }, svgEl(ICON_PLUS), 'Nova OP')));
    }

    function buildKpis() {
      var kpi = computeKpis();
      return window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;'
      },
      kpiCard(ICON_TOTAL, 'Total', kpi.total),
      kpiCard(ICON_PROD, 'Em produção', kpi.emProducao),
      kpiCard(ICON_SIM, 'Simuladas', kpi.simuladas),
      kpiCard(ICON_OPEN, 'Abertas', kpi.abertas));
    }

    function buildBuscaTabs() {
      var wrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;'
      });

      var searchBox = window.el('div', {
        class: 'rv-ops-search',
        style: 'flex:1;min-width:260px;display:flex;align-items:center;gap:8px;height:var(--rv-h-compact);background:var(--rv-surface);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);padding:0 13px;'
      }, svgEl(ICON_SEARCH));
      var input = window.el('input', {
        type: 'text',
        placeholder: 'Buscar por OP, lote ou cliente...',
        style: 'border:none;outline:none;background:transparent;flex:1;min-width:0;font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-family:inherit;'
      });
      input.value = ui.busca;
      input.addEventListener('focus', function () { searchHasFocus = true; });
      input.addEventListener('blur', function () { searchHasFocus = false; });
      input.addEventListener('input', function () {
        ui.busca = input.value;
        searchCursorPos = input.selectionStart || 0;
        ui.pagina = 1;
        render();
      });
      searchBox.appendChild(input);
      wrap.appendChild(searchBox);

      var tabsWrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;max-width:100%;padding-bottom:2px;'
      });
      // Estas abas selecionam CLASSIFICACOES de OP (Tecelagem/Latex); nao sao
      // pilulas de ciclo de vida nem etapas. Degrau compacto canonico e a
      // superficie de controle selecionado — nunca uma cor por tipo.
      TABS.forEach(function (tab) {
        var active = ui.tab === tab.key;
        tabsWrap.appendChild(window.el('button', {
          type: 'button',
          class: 'rv-ops-tab',
          'aria-pressed': active ? 'true' : 'false',
          style: active ? TAB_ACTIVE : TAB_IDLE,
          onclick: function () {
            ui.tab = tab.key;
            ui.pagina = 1;
            render();
          }
        }, tab.label));
      });
      wrap.appendChild(tabsWrap);
      return wrap;
    }

    function buildFilterControls() {
      // A grade declara um piso de 180px por coluna, entao os tres filtros mais
      // o `Limpar` nao cabem numa faixa estreita. Ela vive num container PROPRIO
      // de rolagem — o mesmo idioma ja aceito na lista de Pedidos — para que
      // nenhum controle fique inalcancavel e o documento nunca seja empurrado.
      var scroll = window.el('div', {
        style: 'overflow-x:auto;max-width:100%;margin-bottom:16px;padding-bottom:2px;'
      });
      var wrap = window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) auto;gap:8px;align-items:stretch;'
      });
      scroll.appendChild(wrap);

      // Pass-7 (UIC-006): the filter was a visible facade with a hidden
      // opacity-zero native <select> stretched over it owning the value.
      // Both are gone: the canonical popover IS the visible control and the
      // single value owner. The filter caption stays visible above it and
      // names the trigger through aria-labelledby.
      function buildSelect(label, value, options, onChange) {
        filterSeq += 1;
        var captionId = 'rv-ops-filter-' + filterSeq;
        var holder = window.el('div', { style: 'display:flex;flex-direction:column;gap:3px;min-width:0;' });
        holder.appendChild(window.el('div', {
          id: captionId,
          style: 'font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
        }, label));
        var control = window.createSelectPopover({
          options: options,
          value: value,
          labelledBy: captionId
        });
        control.addEventListener('change', function () { onChange(control.value); });
        holder.appendChild(control);
        return holder;
      }

      var clientesSeen = {};
      var clienteOptions = [{ value: 'todos', label: 'Todos os clientes' }];
      state.rows.forEach(function (row) {
        var nome = clienteNome(row);
        if (nome === '—' || clientesSeen[nome]) return;
        clientesSeen[nome] = true;
        clienteOptions.push({ value: nome, label: nome });
      });
      clienteOptions.sort(function (a, b) {
        if (a.value === 'todos') return -1;
        if (b.value === 'todos') return 1;
        return a.label.localeCompare(b.label, 'pt-BR');
      });

      wrap.appendChild(buildSelect('Cliente', ui.cliente, clienteOptions, function (value) {
        ui.cliente = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(buildSelect('Status', ui.status, [
        { value: 'todos', label: 'Todos' },
        { value: 'simulada', label: 'Simulada' },
        { value: 'aberta', label: 'Aberta' },
        { value: 'em_producao', label: 'Em produção' },
        { value: 'finalizada', label: 'Finalizada' }
      ], function (value) {
        ui.status = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(buildSelect('Criada em', ui.criadaEm, [
        { value: 'todos', label: 'Todos os períodos' },
        { value: '7d', label: 'Últimos 7 dias' },
        { value: '30d', label: 'Últimos 30 dias' },
        { value: 'old', label: 'Mais antigas' }
      ], function (value) {
        ui.criadaEm = value;
        ui.pagina = 1;
        render();
      }));

      // Botao compacto canonico (§2.1), icone a ESQUERDA. O comportamento de
      // reset e exatamente o anterior.
      wrap.appendChild(window.el('button', {
        type: 'button',
        class: 'rv-ops-compact',
        style: 'display:inline-flex;align-items:center;justify-content:center;gap:6px;align-self:end;height:var(--rv-h-compact);background:var(--rv-surface);color:var(--rv-text-secondary);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);padding:0 13px;font-size:var(--rv-fs-body);font-weight:500;font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: function () {
          ui.busca = '';
          ui.tab = 'todos';
          ui.cliente = 'todos';
          ui.status = 'todos';
          ui.criadaEm = 'todos';
          ui.pagina = 1;
          render();
        }
      }, svgEl(ICON_X), 'Limpar'));

      return scroll;
    }

    // §2.12: trilho de visualizacao e preenchimento generico; a cor semantica
    // so entra onde a conclusao real a possui (100%). O calculo nao muda.
    function progressCell(pct) {
      var done = pct >= 100;
      var textColor = done ? 'var(--rv-signal-positive)' : (pct > 0 ? 'var(--rv-text-secondary)' : 'var(--rv-text-tertiary)');
      return window.el('div', {},
        window.el('div', {
          style: 'font-size:var(--rv-fs-xs);font-weight:600;font-variant-numeric:tabular-nums;color:' + textColor + ';margin-bottom:4px;'
        }, pct + '%'),
        window.el('div', {
          style: 'width:120px;max-width:100%;height:6px;background:var(--rv-viz-track);border-radius:var(--rv-radius);overflow:hidden;'
        },
        window.el('div', {
          style: 'height:100%;border-radius:var(--rv-radius);width:' + pct + '%;background:' + (done ? 'var(--rv-signal-positive)' : 'var(--rv-viz-primary)') + ';'
        })));
    }

    // Manta e Tapete sao CLASSIFICACOES de produto (§2.6.1), nao estados: ambas
    // tomam o badge neutro do dono canonico. Tipo nao resolvido => sem badge.
    function produtoBadge(row) {
      var pt = state.produtoTipoPorOp && state.produtoTipoPorOp[row.id];
      if (pt !== 'manta' && pt !== 'tapete') return null;
      return window.rvClassificationBadge(pt === 'manta' ? 'Manta' : 'Tapete');
    }

    function rowActions(row) {
      var canEdit = normalizarKey(row.status) === 'simulada';
      async function excluirOP() {
        if (!window.RAVATEX_DELETE || typeof window.RAVATEX_DELETE.excluirOPComFluxo !== 'function') {
          window.toast('Exclusao controlada indisponivel.', 'error');
          return;
        }
        await window.RAVATEX_DELETE.excluirOPComFluxo(row.id, async function () {
          await carregar();
          render();
        });
      }
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:center;gap:6px;'
      },
      actionIconButton(
        canEdit ? 'Editar' : 'Ver',
        canEdit ? 'Editar' : 'Visualizar',
        canEdit ? ICON_EDIT : ICON_EYE,
        false,
        function () { window.navigate('#/ops/' + row.id); }
      ),
      // UI-ACTION-BUTTON-MIGRATION-2: danger=true — matches the §8.1
      // treatment already applied to every other Excluir action
      // (previously neutral gray, same as Editar/Ver).
      actionIconButton('Excluir OP', 'Excluir OP', ICON_TRASH, false, excluirOP, true));
    }

    function buildTableHead() {
      var row = window.el('div', {
        style: TR_BASE + 'padding:10px 16px;background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);'
      });
      ['OP / LOTE', 'TIPO', 'CLIENTE', 'STATUS', 'ENTREGUE', 'CRIADA EM', 'AÇÕES'].forEach(function (label, idx) {
        row.appendChild(window.el('div', {
          style: THEAD_STYLE + (idx === 2 ? window.TRUNCATE_CELL_STYLE : 'white-space:nowrap;' + (idx === 6 ? 'text-align:center;justify-self:center;' : ''))
        }, label));
      });
      return row;
    }

    function buildRow(row, isLast, ctx) {
      var primaryLabel = fmtOpDisplay(row, ctx);
      var legacyLabel = fmtOpLegacy(row).replace(/^OP /, ctx ? 'Nº interno ' : 'Nº ');
      var loteLabel = row.lote ? 'Lote Nº ' + row.lote.numero : 'Sem lote';
      return window.el('div', {
        style: TR_BASE + 'padding:14px 16px;' + (isLast ? '' : 'border-bottom:1px solid var(--rv-border-soft);')
      },
      window.el('div', {},
        window.el('div', { style: 'font-size:var(--rv-fs-body);font-weight:700;color:var(--rv-accent-blue);' }, primaryLabel),
        window.el('div', { style: 'font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);margin-top:1px;' }, legacyLabel + ' · ' + loteLabel)
      ),
      window.el('div', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;' },
        window.badgeTipo(row.tipo || 'tecelagem'),
        produtoBadge(row)),
      (function () {
        var nome = clienteNome(row);
        return window.truncatedCell(nome, nome === '—' ? null : nome, CELL_STYLE);
      })(),
      window.el('div', {}, window.badgeStatus(row.status)),
      progressCell(entreguePct(row)),
      window.el('div', { style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' }, fmtData(row.criado_em)),
      rowActions(row));
    }

    // D12 / §2.11: uma notificacao autonoma e a sua PROPRIA superficie de
    // informacao, com a largura toda da regiao de conteudo — nunca uma linha de
    // 980px dentro da tabela. Fundo, borda, icone e texto vem todos da familia
    // negativa ratificada em §2.1 (superficie + borda e texto negativos).
    function buildErrorNotice() {
      return window.el('div', {
        style: 'display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);border-radius:var(--rv-radius);color:var(--rv-signal-negative);padding:14px 16px;font-size:var(--rv-fs-sm);font-weight:600;'
      }, svgEl(ICON_ALERT), 'Não foi possível carregar as OPs agora. Tente recarregar a página.');
    }

    function buildTable(rows) {
      var grouped = opsByPedido();
      // §2.5: `data-rv-table-scroll` e o dono CANONICO da rolagem horizontal —
      // ele acrescenta max-width:100% e min-width:0, que impedem a tabela de
      // esticar o <main> do shell numa grade estreita.
      var wrap = window.el('div', {
        'data-rv-table-scroll': '',
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);overflow-x:auto;'
      });
      wrap.appendChild(buildTableHead());

      if (rows.length === 0) {
        wrap.appendChild(window.el('div', {
          style: 'padding:34px 16px;text-align:center;font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);min-width:980px;'
        }, 'Nenhuma OP para este filtro.'));
        return wrap;
      }

      rows.forEach(function (row, idx) {
        wrap.appendChild(buildRow(row, idx === rows.length - 1, opContext(row, grouped)));
      });
      return wrap;
    }

    function buildPagination(totalFiltrado) {
      var totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var inicio = totalFiltrado === 0 ? 0 : ((ui.pagina - 1) * PAGE_SIZE) + 1;
      var fim = Math.min(ui.pagina * PAGE_SIZE, totalFiltrado);

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;background:var(--rv-surface);border:1px solid var(--rv-border);border-top:none;border-radius:var(--rv-radius);padding:11px 18px;margin-bottom:8px;'
      },
      window.el('span', {
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-tertiary);'
      }, totalFiltrado === 0
        ? 'Nenhuma OP encontrada'
        : 'Mostrando ' + inicio + ' a ' + fim + ' de ' + totalFiltrado + (totalFiltrado === 1 ? ' OP' : ' OPs')),
      window.el('div', { style: 'display:flex;align-items:center;gap:5px;' },
        navBtn(ICON_LEFT, ui.pagina <= 1, function () {
          ui.pagina -= 1;
          render();
        }, 'Página anterior'),
        // Pass-3 §5.5: the current-page element is a non-interactive
        // indicator, not a control. It never had a handler or a keyboard
        // action, so it is a span carrying aria-current="page".
        window.el('span', {
          'aria-current': 'page',
          style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;border-radius:var(--rv-radius);background:var(--rv-brand);color:var(--rv-text-on-brand);font-size:var(--rv-fs-body);font-weight:700;cursor:default;font-family:inherit;font-variant-numeric:tabular-nums;'
        }, String(ui.pagina)),
        navBtn(ICON_RIGHT, ui.pagina >= totalPaginas, function () {
          ui.pagina += 1;
          render();
        }, 'Próxima página')));
    }

    function render() {
      var filtrados = applyFilters();
      var totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var rows = filtrados.slice((ui.pagina - 1) * PAGE_SIZE, ui.pagina * PAGE_SIZE);

      container.replaceChildren(
        window.el('style', {}, SCREEN_CSS),
        buildHeader(),
        buildKpis(),
        buildBuscaTabs(),
        buildFilterControls(),
        state.error ? buildErrorNotice() : buildTable(rows),
        buildPagination(filtrados.length)
      );

      if (searchHasFocus) {
        var input = container.querySelector('input[type="text"]');
        if (input) {
          input.focus();
          try {
            input.setSelectionRange(searchCursorPos, searchCursorPos);
          } catch (_) {}
        }
      }
    }

    await carregar();
    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opsList = {
    screenListaOPs: screenListaOPs
  };

  window.screenListaOPs = screenListaOPs;
})(window);
