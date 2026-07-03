// =====================================================================
// === SCREENS: PEDIDO DETAIL ==========================================
// Tela admin do detalhe de um Pedido existente.
// Rota: `#/pedidos/<uuid>` (matchRoute dinamico).
//
// Fase:
//   - RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B
//   - RAVATEX-TAPETES-PEDIDO-DETAIL-UI-B1
//   - RAVATEX-TAPETES-PEDIDO-DETAIL-UI-B1-R1
//
// Escopo:
//   - manter as transicoes controladas do status do pedido;
//   - manter atalhos de edicao de dados gerais e itens;
//   - orquestrar a tela modularizada em data/progress/render/events;
//   - nao criar fonte paralela de movimentacao produtiva.
//
// Compatibilidade:
//   - window.screenPedidoDetalhe
//   - window.RAVATEX_SCREENS.pedidoDetail.screenPedidoDetalhe
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  ns.UUID_RE = ns.UUID_RE || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  ns.TRANSITIONS = ns.TRANSITIONS || Object.freeze({
    rascunho: Object.freeze(['recebido', 'cancelado']),
    recebido: Object.freeze(['confirmado', 'cancelado']),
    confirmado: Object.freeze(['cancelado']),
    produzindo: Object.freeze([]),
    entregue: Object.freeze([]),
    cancelado: Object.freeze([]),
  });

  ns.ACTION_LABEL = ns.ACTION_LABEL || Object.freeze({
    recebido: 'Marcar como recebido',
    confirmado: 'Confirmar pedido',
    cancelado: 'Cancelar pedido',
  });

  ns.RECEBIMENTO_LABEL = ns.RECEBIMENTO_LABEL || Object.freeze({
    retirada: 'Retirada',
    entrega: 'Entrega',
  });

  ns.READY_SITUATIONS = ns.READY_SITUATIONS || Object.freeze([
    'pronto_retirada',
    'pronto_envio',
    'em_transporte',
  ]);

  ns.canTransition = ns.canTransition || function canTransition(from, to) {
    if (!from || !to) return false;
    var destinos = ns.TRANSITIONS[from];
    return Array.isArray(destinos) && destinos.indexOf(to) !== -1;
  };

  ns.nextActionsForStatus = ns.nextActionsForStatus || function nextActionsForStatus(status) {
    var destinos = ns.TRANSITIONS[status] || [];
    return destinos.map(function (item) {
      return { status: item, label: ns.ACTION_LABEL[item] || item };
    });
  };

  ns.toFiniteNumber = ns.toFiniteNumber || function toFiniteNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  ns.round2 = ns.round2 || function round2(value) {
    return Math.round(ns.toFiniteNumber(value) * 100) / 100;
  };

  ns.round1 = ns.round1 || function round1(value) {
    return Math.round(ns.toFiniteNumber(value) * 10) / 10;
  };

  ns.clampPercent = ns.clampPercent || function clampPercent(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 100) return 100;
    return Number(value.toFixed(1));
  };

  ns.fmtNumero = ns.fmtNumero || function fmtNumero(value) {
    if (value == null) return '-';
    return '#' + value;
  };

  ns.fmtMetros = ns.fmtMetros || function fmtMetros(value) {
    if (value == null) return '-';
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toFixed(2).replace('.', ',') + ' m';
  };

  ns.fmtMetrosShort = ns.fmtMetrosShort || function fmtMetrosShort(value) {
    if (value == null) return '-';
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (Math.abs(n - Math.round(n)) < 0.0001) return Math.round(n) + ' m';
    return n.toFixed(2).replace('.', ',') + ' m';
  };

  ns.fmtKg = ns.fmtKg || function fmtKg(value) {
    if (value == null) return '-';
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toFixed(3).replace('.', ',') + ' kg';
  };

  ns.fmtTextoOuEmpty = ns.fmtTextoOuEmpty || function fmtTextoOuEmpty(value, fallback) {
    if (value == null) return fallback || '-';
    var text = String(value).trim();
    return text || fallback || '-';
  };

  ns.fmtData = ns.fmtData || function fmtData(iso) {
    if (!iso) return '-';
    return window.fmtDataCurta ? window.fmtDataCurta(iso) : String(iso);
  };

  ns.fmtDataHora = ns.fmtDataHora || function fmtDataHora(iso) {
    if (!iso) return '-';
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return ns.fmtData(iso);
      var date = d.toLocaleDateString('pt-BR');
      var time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return date + ' as ' + time;
    } catch (_) {
      return ns.fmtData(iso);
    }
  };

  ns.svgEl = ns.svgEl || function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstChild;
  };

  ns.getTrackingApi = ns.getTrackingApi || function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  };

  ns.SVG_BACK = ns.SVG_BACK || '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  ns.SVG_CAL = ns.SVG_CAL || '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';
  ns.SVG_DOC = ns.SVG_DOC || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
  ns.SVG_EDIT = ns.SVG_EDIT || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
  ns.SVG_LOCK = ns.SVG_LOCK || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  ns.SVG_CHECK = ns.SVG_CHECK || '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  ns.SVG_INFO = ns.SVG_INFO || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>';
  ns.SVG_WARN = ns.SVG_WARN || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  ns.SVG_FILE = ns.SVG_FILE || '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';

  ns.createInitialState = ns.createInitialState || function createInitialState() {
    return {
      pedido: null,
      cliente: null,
      itens: [],
      lotes: [],
      ops: [],
      parciais: [],
      parcialItens: [],
      entregaItens: [],
      entregasById: {},
      expedicoes: [],
      expedicaoItens: [],
      expedicaoMovimentos: [],
      expedicaoMovimentoItens: [],
      ordensFio: [],
      modelosById: {},
      coresById: {},
      opsLoadError: false,
      opsEnrichError: false,
      docsLoadError: false,
      expedicoesLoadError: false,
      partialItemLoadError: false,
    };
  };

  async function screenPedidoDetalhe(pedidoId) {
    if (!ns.UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido invalido.', 'error');
      var invalidNode = window.el('div', {},
        window.el('div', {
          style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;color:#b42318;',
        }, 'Pedido invalido. Volte para a listagem e tente novamente.'),
        window.el('div', { style: 'margin-top:14px;' },
          window.el('button', {
            type: 'button',
            style: 'display:inline-flex;align-items:center;gap:8px;border:1px solid #d8dce2;background:#fff;color:#3f4757;border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;',
            onclick: function () { window.navigate('#/pedidos'); },
          }, ns.svgEl(ns.SVG_BACK), 'Voltar para pedidos')
        )
      );
      return window.shellLayout(window.ADMIN_MENU, invalidNode);
    }

    var container = window.el('div', {});
    var state = ns.createInitialState();
    var loadingError = null;

    function render() {
      if (typeof ns.renderPedidoDetailScreen !== 'function') {
        container.replaceChildren(window.el('div', {
          style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;color:#b42318;',
        }, 'Modulo de render do pedido-detail indisponivel.'));
        return;
      }

      var view = null;
      if (!loadingError && state.pedido && typeof ns.computeViewModel === 'function') {
        view = ns.computeViewModel(state);
      }

      ns.renderPedidoDetailScreen({
        container: container,
        state: state,
        pedidoId: pedidoId,
        loadingError: loadingError,
        view: view,
        handlers: handlers,
      });
    }

    async function reload() {
      if (typeof ns.loadPedidoDetailData !== 'function') {
        loadingError = 'modulo-dados';
        render();
        return;
      }
      loadingError = await ns.loadPedidoDetailData(pedidoId, state);
      render();
    }

    var handlers = typeof ns.createPedidoDetailEvents === 'function'
      ? ns.createPedidoDetailEvents({
          pedidoId: pedidoId,
          state: state,
          reload: reload,
          render: render,
          getLoadingError: function () { return loadingError; },
          setLoadingError: function (value) { loadingError = value; },
        })
      : {};

    render();
    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  ns.screenPedidoDetalhe = screenPedidoDetalhe;
  window.screenPedidoDetalhe = screenPedidoDetalhe;
})(window);
