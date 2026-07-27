// =====================================================================
// === SCREENS: PEDIDOS LIST ===========================================
// Tela admin `#/pedidos` read-only, alinhada ao idioma visual da tela
// nova `#/cliente/pedidos`, preservando dados, filtros e acoes admin.
//
// Sem insert/update/delete direto. Exclusao controlada usa helper/RPC central.
// =====================================================================

(function (window) {
  'use strict';

  // Pass-7: the filter chevron now belongs to the canonical select popover;
  // this counter only mints the stable caption ids the triggers point at.
  var filterSeq = 0;
  var PAGE_SIZE = 10;
  var ITENS_LIMIT = 1000;
  var TABS = [
    { key: 'todos', label: 'Todos' },
    { key: 'rascunho', label: 'Rascunho' },
    { key: 'recebido', label: 'Recebido' },
    { key: 'confirmado', label: 'Confirmado' },
    { key: 'producao', label: 'Produção' },
    { key: 'parcial', label: 'Parcial' },
    { key: 'pronto', label: 'Pronto' },
    { key: 'entregue', label: 'Entregue' },
    { key: 'cancelado', label: 'Cancelado' }
  ];

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild || tmp.firstChild;
  }

  var ICON_PLUS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  var ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  // UI-ACTION-BUTTON-MIGRATION-1: 14px per UI_VISUAL_CONTRACT.md §8.1
  // (was 17px before conformance).
  var ICON_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var ICON_MORE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="12" cy="19" r="1.2"></circle></svg>';
  var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  var ICON_LEFT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_RIGHT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  var ICON_DOC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-accent-blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><polyline points="14 3 14 8 19 8"></polyline></svg>';
  var ICON_CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-stage-tecelagem)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>';
  var ICON_WARN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-negative)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg>';
  var ICON_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-positive)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="9 12 11 14 15 10"></polyline></svg>';
  var ICON_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-caution)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';

  var CLIENT_TONE = {
    green: { bg: 'var(--rv-pill-positive-bg)', color: 'var(--rv-signal-positive)', dot: 'var(--rv-signal-positive)' },
    amber: { bg: 'var(--rv-pill-caution-bg)', color: 'var(--rv-signal-caution)', dot: 'var(--rv-signal-caution)' },
    gray: { bg: 'var(--rv-pill-neutral-bg)', color: 'var(--rv-text-secondary)', dot: 'var(--rv-text-tertiary)' },
    red: { bg: 'var(--rv-pill-negative-bg)', color: 'var(--rv-signal-negative)', dot: 'var(--rv-signal-negative)' }
  };
  var CLIENT_PRONTO_KEYS = ['concluido', 'expedicao', 'transporte'];
  var CLIENT_PRODUCAO_KEYS = ['tecelagem', 'acabamento', 'insumos'];
  var TR_COLS = '76px minmax(180px,1.28fr) minmax(126px,0.94fr) minmax(156px,1.08fr) minmax(126px,0.92fr) 98px 112px 98px 72px';

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function fmtData(value) {
    if (!value) return '—';
    return window.fmtDataCurta ? window.fmtDataCurta(value) : String(value);
  }

  function fmtDataHoraCurta(value) {
    if (!value) return '—';
    try {
      var date = new Date(value);
      if (isNaN(date.getTime())) return '—';
      var dd = String(date.getDate()).padStart(2, '0');
      var mm = String(date.getMonth() + 1).padStart(2, '0');
      var hh = String(date.getHours()).padStart(2, '0');
      var mi = String(date.getMinutes()).padStart(2, '0');
      return dd + '/' + mm + ' ' + hh + ':' + mi;
    } catch (_) {
      return '—';
    }
  }

  function fmtMetros(value, decimals) {
    var number = Number(value);
    var fractionDigits = Number.isFinite(decimals) ? decimals : 0;
    if (!Number.isFinite(number)) return '—';
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }) + ' m';
  }

  function isAtrasado(pedido) {
    if (!pedido || !pedido.prazo_entrega) return false;
    if (pedido.status === 'entregue' || pedido.status === 'cancelado') return false;
    var prazo = new Date(pedido.prazo_entrega);
    if (isNaN(prazo.getTime())) return false;
    prazo.setHours(0, 0, 0, 0);
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return prazo.getTime() < hoje.getTime();
  }

  function tipoRecebimentoLabel(tipo) {
    var key = normalizarKey(tipo);
    if (key === 'retirada') return 'Retirada';
    if (key === 'entrega') return 'Entrega';
    return '—';
  }

  function visualClienteLabel(pedido) {
    var api = getTrackingApi();
    if (api && api.getClienteTrackingStatusLabel) {
      return api.getClienteTrackingStatusLabel(pedido);
    }
    return 'Não publicado';
  }

  function resolveVisibleState(pedido) {
    var api = getTrackingApi();
    var excecaoKey = normalizarKey(pedido && pedido.status_cliente_excecao);
    if (api && api.getClienteTrackingException) {
      var excecao = api.getClienteTrackingException(excecaoKey);
      if (excecao && excecao.key === 'cancelado') return 'cancelado';
    } else if (excecaoKey === 'cancelado') {
      return 'cancelado';
    }

    var visualKey = normalizarKey(pedido && pedido.status_cliente_visual);
    if (api && api.getClienteTrackingStep) {
      var step = api.getClienteTrackingStep(visualKey);
      return step ? step.key : '';
    }
    return visualKey;
  }

  function resolveVisibleTone(pedido) {
    var stateKey = resolveVisibleState(pedido);
    var tone = CLIENT_TONE.gray;
    if (stateKey === 'cancelado') tone = CLIENT_TONE.red;
    else if (CLIENT_PRONTO_KEYS.indexOf(stateKey) !== -1) tone = CLIENT_TONE.green;
    else if (CLIENT_PRODUCAO_KEYS.indexOf(stateKey) !== -1) tone = CLIENT_TONE.amber;
    return {
      bg: tone.bg,
      color: tone.color,
      dot: tone.dot,
      label: stateKey ? visualClienteLabel(pedido) : 'Não publicado'
    };
  }

  function visibleBucket(pedido) {
    var stateKey = resolveVisibleState(pedido);
    if (stateKey === 'cancelado') return 'cancelado';
    if (CLIENT_PRODUCAO_KEYS.indexOf(stateKey) !== -1) return 'producao';
    if (CLIENT_PRONTO_KEYS.indexOf(stateKey) !== -1) return 'pronto';
    return '';
  }

  function internalTone(status) {
    var key = normalizarKey(status);
    if (key === 'rascunho') return { bg: 'var(--rv-pill-neutral-bg)', color: 'var(--rv-text-secondary)', dot: 'var(--rv-text-tertiary)', label: 'Rascunho' };
    if (key === 'recebido') return { bg: 'var(--rv-pill-info-bg)', color: 'var(--rv-accent-blue)', dot: 'var(--rv-accent-blue)', label: 'Recebido' };
    if (key === 'confirmado') return { bg: 'var(--rv-pill-positive-bg)', color: 'var(--rv-signal-positive)', dot: 'var(--rv-signal-positive)', label: 'Confirmado' };
    if (key === 'produzindo') return { bg: 'var(--rv-pill-caution-bg)', color: 'var(--rv-signal-caution)', dot: 'var(--rv-signal-caution)', label: 'Em produção' };
    if (key === 'entregue') return { bg: 'var(--rv-pill-positive-bg)', color: 'var(--rv-signal-positive)', dot: 'var(--rv-signal-positive)', label: 'Entregue' };
    if (key === 'cancelado') return { bg: 'var(--rv-pill-negative-bg)', color: 'var(--rv-signal-negative)', dot: 'var(--rv-signal-negative)', label: 'Cancelado' };
    return {
      bg: 'var(--rv-surface-subtle)',
      color: 'var(--rv-text-secondary)',
      dot: 'var(--rv-text-tertiary)',
      label: window.pedidoStatusLabel ? window.pedidoStatusLabel(status) : '—'
    };
  }

  function pill(tone) {
    return window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:6px;border-radius:4px;padding:3px 9px;font-size:12px;font-weight:600;white-space:nowrap;background:' + tone.bg + ';color:' + tone.color + ';'
    },
    window.el('span', {
      style: 'width:6px;height:6px;border-radius:var(--rv-radius-pill);background:' + tone.dot + ';display:inline-block;flex-shrink:0;'
    }),
    tone.label);
  }

  function kpiCard(iconBg, iconMarkup, label, value) {
    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:13px 14px;display:flex;align-items:center;gap:10px;min-width:0;'
    },
    window.el('div', {
      style: 'width:34px;height:34px;border-radius:var(--rv-radius-pill);background:' + iconBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;'
    }, svgEl(iconMarkup)),
    window.el('div', { style: 'min-width:0;' },
      window.el('div', {
        style: 'font-size:12px;color:var(--rv-text-tertiary);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      }, label),
      window.el('div', { style: 'font-size:22px;font-weight:800;color:var(--rv-text-primary);line-height:1;' }, String(value))
    ));
  }

  // UI-ACTION-BUTTON-MIGRATION-1: pagination nav button, now built via
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

  async function screenPedidosLista() {
    var container = window.el('div', {});
    var state = {
      pedidos: [],
      clientesById: {},
      itensByPedido: {},
      parciaisByPedido: {},
      acompanhamentoByPedido: {},
      error: false
    };
    var ui = {
      busca: '',
      tab: 'todos',
      clienteId: 'todos',
      prazo: 'todos',
      recebimento: 'todos',
      atualizado: 'todos',
      pagina: 1
    };
    var searchHasFocus = false;
    var searchCursorPos = 0;

    async function carregar() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, parcial_habilitado, parcial_atualizado_em, metros_total, tipo_recebimento')
        .order('criado_em', { ascending: false })
        .limit(200);

      var clientesRes = await window.supa
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true })
        .limit(500);

      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, pedido_id, metros')
        .limit(ITENS_LIMIT);

      var parciaisRes = await window.supa
        .from('pedido_parciais')
        .select('id, pedido_id, sequencia, situacao, metros, data_referencia, criado_em')
        .limit(ITENS_LIMIT);

      if (pedidosRes.error) {
        state.error = true;
        state.pedidos = [];
        window.toast('Erro ao carregar pedidos', 'error');
        console.error('pedidos-list: erro ao carregar pedidos', pedidosRes.error);
      } else {
        state.error = false;
        state.pedidos = pedidosRes.data || [];
      }

      if (clientesRes.error) {
        state.clientesById = {};
        console.error('pedidos-list: erro ao carregar clientes', clientesRes.error);
      } else {
        state.clientesById = Object.fromEntries((clientesRes.data || []).map(function (cliente) {
          return [cliente.id, cliente];
        }));
      }

      if (itensRes.error) {
        state.itensByPedido = {};
        console.error('pedidos-list: erro ao carregar itens', itensRes.error);
      } else {
        var itensByPedido = {};
        (itensRes.data || []).forEach(function (item) {
          if (!item || !item.pedido_id) return;
          if (!itensByPedido[item.pedido_id]) itensByPedido[item.pedido_id] = [];
          itensByPedido[item.pedido_id].push(item);
        });
        state.itensByPedido = itensByPedido;
      }

      if (parciaisRes.error) {
        state.parciaisByPedido = {};
        console.error('pedidos-list: erro ao carregar parciais', parciaisRes.error);
      } else {
        var parciaisByPedido = {};
        (parciaisRes.data || []).forEach(function (parcial) {
          if (!parcial || !parcial.pedido_id) return;
          if (!parciaisByPedido[parcial.pedido_id]) parciaisByPedido[parcial.pedido_id] = [];
          parciaisByPedido[parcial.pedido_id].push(parcial);
        });
        state.parciaisByPedido = parciaisByPedido;
      }

      state.acompanhamentoByPedido = {};
      var trackingApi = getTrackingApi();
      if (trackingApi && trackingApi.buildPedidoAcompanhamentoParcial) {
        state.pedidos.forEach(function (pedido) {
          if (!pedido || !pedido.id) return;
          try {
            state.acompanhamentoByPedido[pedido.id] = trackingApi.buildPedidoAcompanhamentoParcial(
              pedido,
              state.itensByPedido[pedido.id] || [],
              state.parciaisByPedido[pedido.id] || [],
              { forCliente: false }
            );
          } catch (_) {
            state.acompanhamentoByPedido[pedido.id] = null;
          }
        });
      }
    }

    function clienteNome(pedido) {
      var cliente = pedido && pedido.cliente_id ? state.clientesById[pedido.cliente_id] : null;
      return cliente && cliente.nome ? cliente.nome : '—';
    }

    function parcialCell(pedido) {
      var acompanhamento = state.acompanhamentoByPedido[pedido.id];
      if (!acompanhamento || !acompanhamento.parcialHabilitado || !acompanhamento.totais || !(Number(acompanhamento.totais.parcialVisivel) > 0)) {
        return window.el('div', { style: 'font-size:13.5px;color:var(--rv-text-tertiary);' }, '—');
      }
      return window.el('div', {
        style: 'font-size:13.5px;font-weight:500;color:var(--rv-accent-blue);white-space:nowrap;'
      }, fmtMetros(acompanhamento.totais.parcialVisivel, 0) + ' / ' + fmtMetros(acompanhamento.totais.pedido, 0));
    }

    function atualizadoEm(pedido) {
      return pedido.parcial_atualizado_em
        || pedido.status_cliente_atualizado_em
        || pedido.atualizado_em
        || pedido.criado_em
        || null;
    }

    function prazoBucket(pedido) {
      if (!pedido || !pedido.prazo_entrega) return 'sem_prazo';
      if (isAtrasado(pedido)) return 'atrasado';
      var prazo = new Date(pedido.prazo_entrega);
      if (isNaN(prazo.getTime())) return 'todos';
      prazo.setHours(0, 0, 0, 0);
      var hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      var diff = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
      if (diff <= 7) return 'proximos_7';
      return 'futuro';
    }

    function updatedBucket(pedido) {
      var base = atualizadoEm(pedido);
      if (!base) return 'todos';
      var date = new Date(base);
      if (isNaN(date.getTime())) return 'todos';
      var now = new Date();
      var diff = (now.getTime() - date.getTime()) / 86400000;
      if (diff <= 7) return '7d';
      if (diff <= 30) return '30d';
      return 'old';
    }

    function tabMatches(pedido, key) {
      if (key === 'todos') return true;
      if (key === 'parcial') {
        var acompanhamento = state.acompanhamentoByPedido[pedido.id];
        return !!(acompanhamento && acompanhamento.parcialHabilitado && Number(acompanhamento.totais && acompanhamento.totais.parcialVisivel) > 0);
      }
      if (key === 'producao' || key === 'pronto') return visibleBucket(pedido) === key;
      return normalizarKey(pedido.status) === key;
    }

    function countTab(key) {
      return state.pedidos.filter(function (pedido) {
        return tabMatches(pedido, key);
      }).length;
    }

    function computeKpis() {
      var abertos = 0;
      var producao = 0;
      var parciais = 0;
      var atrasados = 0;
      var prontos = 0;

      state.pedidos.forEach(function (pedido) {
        var status = normalizarKey(pedido.status);
        var visible = visibleBucket(pedido);
        var acompanhamento = state.acompanhamentoByPedido[pedido.id];
        if (status !== 'cancelado' && status !== 'entregue') abertos += 1;
        if (visible === 'producao') producao += 1;
        if (acompanhamento && acompanhamento.parcialHabilitado && Number(acompanhamento.totais && acompanhamento.totais.parcialVisivel) > 0) parciais += 1;
        if (isAtrasado(pedido)) atrasados += 1;
        if (visible === 'pronto' || status === 'entregue') prontos += 1;
      });

      return {
        abertos: abertos,
        producao: producao,
        parciais: parciais,
        atrasados: atrasados,
        prontos: prontos
      };
    }

    function applyFilters() {
      var termo = normalizarKey(ui.busca);
      return state.pedidos.filter(function (pedido) {
        if (!tabMatches(pedido, ui.tab)) return false;
        if (ui.clienteId !== 'todos' && String(pedido.cliente_id || '') !== ui.clienteId) return false;
        if (ui.recebimento !== 'todos' && normalizarKey(pedido.tipo_recebimento) !== ui.recebimento) return false;
        if (ui.prazo !== 'todos' && prazoBucket(pedido) !== ui.prazo) return false;
        if (ui.atualizado !== 'todos' && updatedBucket(pedido) !== ui.atualizado) return false;
        if (termo) {
          var numero = pedido.numero != null ? String(pedido.numero).toLowerCase() : '';
          var nome = clienteNome(pedido).toLowerCase();
          if (numero.indexOf(termo) === -1 && nome.indexOf(termo) === -1) return false;
        }
        return true;
      });
    }

    function buildHeader() {
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;'
      },
      window.el('div', {},
        window.el('div', {
          style: 'font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;line-height:1.1;'
        }, 'Pedidos'),
        window.el('div', {
          style: 'font-size:12.5px;color:var(--rv-text-tertiary);margin-top:3px;'
        }, 'Visão administrativa dos pedidos, prazos e status visíveis ao cliente.')
      ),
      window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:9px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: function () { window.navigate('#/pedidos/novo'); }
      }, svgEl(ICON_PLUS), 'Novo pedido'));
    }

    function buildKpis() {
      var kpi = computeKpis();
      return window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px;'
      },
      kpiCard('var(--rv-pill-info-bg)', ICON_DOC, 'Abertos', kpi.abertos),
      kpiCard('var(--rv-signal-caution-bg)', ICON_SUN, 'Em produção', kpi.producao),
      kpiCard('var(--rv-stage-tecelagem-bg)', ICON_CLOCK, 'Parciais', kpi.parciais),
      kpiCard('var(--rv-surface)', ICON_WARN, 'Atrasados', kpi.atrasados),
      kpiCard('var(--rv-signal-positive-bg)', ICON_CHECK, 'Prontos', kpi.prontos));
    }

    function buildBuscaTabs() {
      var wrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:nowrap;'
      });

      var searchBox = window.el('div', {
        style: 'display:flex;align-items:center;gap:8px;background:var(--rv-surface);border:1px solid var(--rv-border-strong);border-radius:4px;padding:7px 13px;flex:1;min-width:0;'
      }, svgEl(ICON_SEARCH));

      var input = window.el('input', {
        type: 'text',
        placeholder: 'Buscar por número ou cliente...',
        style: 'border:none;outline:none;background:transparent;flex:1;min-width:0;font-size:13px;color:var(--rv-text-primary);font-family:inherit;'
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
        style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap;overflow-x:auto;max-width:100%;padding-bottom:2px;'
      });
      TABS.forEach(function (tab) {
        var active = ui.tab === tab.key;
        tabsWrap.appendChild(window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:5px;border-radius:4px;padding:6px 11px;font-size:13px;font-weight:' + (active ? '600' : '500') + ';border:1px solid ' + (active ? 'var(--rv-brand)' : 'var(--rv-border-strong)') + ';background:' + (active ? 'var(--rv-brand)' : 'var(--rv-surface)') + ';color:' + (active ? 'var(--rv-text-on-brand)' : 'var(--rv-text-secondary)') + ';cursor:pointer;white-space:nowrap;font-family:inherit;',
          onclick: function () {
            ui.tab = tab.key;
            ui.pagina = 1;
            render();
          }
        },
        tab.label + ' ',
        window.el('span', {
          style: 'background:' + (active ? 'var(--rv-active-bg)' : 'var(--rv-surface-subtle)') + ';border-radius:var(--rv-radius);padding:1px 6px;font-size:11px;color:' + (active ? 'var(--rv-text-on-brand)' : 'var(--rv-text-tertiary)') + ';'
        }, String(countTab(tab.key)))));
      });
      wrap.appendChild(tabsWrap);
      return wrap;
    }

    function buildFilterControls() {
      var wrap = window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(4,minmax(168px,1fr)) auto;gap:8px;margin-bottom:16px;align-items:stretch;'
      });

      // Pass-7 (UIC-006): the filter was a visible facade with a hidden
      // opacity-zero native <select> stretched over it owning the value.
      // Both are gone: the canonical popover IS the visible control and the
      // single value owner. The filter caption stays visible above it and
      // names the trigger through aria-labelledby.
      function buildSelect(label, value, options, onChange) {
        filterSeq += 1;
        var captionId = 'rv-pedidos-filter-' + filterSeq;
        var holder = window.el('div', { style: 'display:flex;flex-direction:column;gap:3px;min-width:0;' });
        holder.appendChild(window.el('div', {
          id: captionId,
          style: 'font-size:11px;color:var(--rv-text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
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

      var clienteOptions = [{ value: 'todos', label: 'Todos os clientes' }];
      Object.keys(state.clientesById).forEach(function (id) {
        clienteOptions.push({ value: id, label: state.clientesById[id].nome });
      });

      wrap.appendChild(buildSelect('Cliente', ui.clienteId, clienteOptions, function (value) {
        ui.clienteId = value;
        ui.pagina = 1;
        render();
      }));
      wrap.appendChild(buildSelect('Prazo', ui.prazo, [
        { value: 'todos', label: 'Todos' },
        { value: 'atrasado', label: 'Atrasados' },
        { value: 'proximos_7', label: 'Próximos 7 dias' },
        { value: 'futuro', label: 'No prazo' },
        { value: 'sem_prazo', label: 'Sem prazo' }
      ], function (value) {
        ui.prazo = value;
        ui.pagina = 1;
        render();
      }));
      wrap.appendChild(buildSelect('Recebimento', ui.recebimento, [
        { value: 'todos', label: 'Todos' },
        { value: 'retirada', label: 'Retirada' },
        { value: 'entrega', label: 'Entrega' }
      ], function (value) {
        ui.recebimento = value;
        ui.pagina = 1;
        render();
      }));
      wrap.appendChild(buildSelect('Atualizado', ui.atualizado, [
        { value: 'todos', label: 'Todos' },
        { value: '7d', label: 'Últimos 7 dias' },
        { value: '30d', label: 'Últimos 30 dias' },
        { value: 'old', label: 'Mais antigos' }
      ], function (value) {
        ui.atualizado = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface);color:var(--rv-text-secondary);border:1px solid var(--rv-border-strong);border-radius:4px;padding:8px 13px;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;white-space:nowrap;justify-content:center;',
        onclick: function () {
          ui.busca = '';
          ui.tab = 'todos';
          ui.clienteId = 'todos';
          ui.prazo = 'todos';
          ui.recebimento = 'todos';
          ui.atualizado = 'todos';
          ui.pagina = 1;
          render();
        }
      }, 'Limpar filtros', svgEl(ICON_X)));

      return wrap;
    }

    function rowActions(row) {
      async function excluirPedido() {
        if (!window.RAVATEX_DELETE || typeof window.RAVATEX_DELETE.excluirPedidoComFluxo !== 'function') {
          window.toast('Exclusao controlada indisponivel.', 'error');
          return;
        }
        await window.RAVATEX_DELETE.excluirPedidoComFluxo(row.id, async function () {
          await carregar();
          render();
        });
      }

      // UI-ACTION-BUTTON-MIGRATION-1: both row actions now built via the
      // shared actionButton() primitive (UI_VISUAL_CONTRACT.md §8.1).
      // Excluir keeps the exact same handler — excluirPedidoComFluxo()
      // already gates the destructive action behind its own confirmation
      // flow (js/delete-helpers.js showDeleteConfirmation), which
      // satisfies the §8.1 confirmDialog guard; no extra confirmation
      // wrapper added here.
      var eyeBtn = window.actionButton({
        title: 'Visualizar',
        icon: svgEl(ICON_EYE),
        onclick: function () { window.navigate('#/pedidos/' + row.id); }
      });

      var deleteBtn = window.actionButton({
        title: 'Excluir Pedido',
        icon: svgEl(ICON_TRASH),
        danger: true,
        onclick: excluirPedido
      });

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:center;gap:6px;'
      }, eyeBtn, deleteBtn);
    }

    function buildTableHead() {
      var row = window.el('div', {
        style: 'display:grid;grid-template-columns:' + TR_COLS + ';align-items:center;gap:12px;padding:10px 16px;background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);min-width:1110px;'
      });
      ['PEDIDO', 'CLIENTE', 'SIT. INTERNA', 'VISÍVEL AO CLIENTE', 'PARCIAL', 'PRAZO', 'RECEBIMENTO', 'ATUALIZADO', 'AÇÕES'].forEach(function (label, index) {
        row.appendChild(window.el('div', {
          style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;' + (index === 1 ? window.TRUNCATE_CELL_STYLE : 'white-space:nowrap;' + (index === 8 ? 'text-align:center;' : ''))
        }, label));
      });
      return row;
    }

    function buildVisibleCell(visTone) {
      if (visTone.label !== 'Não publicado') return pill(visTone);
      return window.el('div', {
        style: 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--rv-text-tertiary);'
      },
      window.el('span', {
        style: 'width:6px;height:6px;border-radius:var(--rv-radius-pill);background:var(--rv-surface-subtle);display:inline-block;flex-shrink:0;'
      }),
      'Não publicado');
    }

    function buildRow(pedido, isLast) {
      var created = fmtDataHoraCurta(pedido.criado_em);
      var updated = fmtDataHoraCurta(atualizadoEm(pedido));
      var visTone = resolveVisibleTone(pedido);
      return window.el('div', {
        style: 'display:grid;grid-template-columns:' + TR_COLS + ';align-items:center;gap:12px;padding:11px 16px;min-width:1110px;' + (isLast ? '' : 'border-bottom:1px solid var(--rv-border-soft);')
      },
      window.el('div', {},
        window.el('div', { style: 'font-size:14px;font-weight:700;color:var(--rv-accent-blue);' }, '#' + (pedido.numero != null ? pedido.numero : '—')),
        window.el('div', { style: 'font-size:11px;color:var(--rv-text-tertiary);margin-top:1px;' }, created)
      ),
      (function () {
        var nome = clienteNome(pedido);
        return window.truncatedCell(nome, nome === '—' ? null : nome, 'font-size:13.5px;color:var(--rv-text-primary);');
      })(),
      window.el('div', {}, pill(internalTone(pedido.status))),
      window.el('div', {}, buildVisibleCell(visTone)),
      parcialCell(pedido),
      window.el('div', {
        style: 'font-size:13.5px;color:' + (pedido.prazo_entrega ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)') + ';'
      }, fmtData(pedido.prazo_entrega)),
      window.el('div', {
        style: 'font-size:13.5px;color:' + (pedido.tipo_recebimento ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)') + ';'
      }, tipoRecebimentoLabel(pedido.tipo_recebimento)),
      window.el('div', { style: 'font-size:12.5px;color:var(--rv-text-tertiary);' }, updated),
      rowActions(pedido));
    }

    function buildTable(rows) {
      var wrap = window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;overflow-x:auto;'
      });
      wrap.appendChild(buildTableHead());

      if (state.error) {
        wrap.appendChild(window.el('div', {
          style: 'padding:32px 16px;text-align:center;font-size:14px;color:var(--rv-signal-caution);min-width:1110px;'
        }, 'Não foi possível carregar os pedidos agora. Tente recarregar a página.'));
        return wrap;
      }

      if (rows.length === 0) {
        wrap.appendChild(window.el('div', {
          style: 'padding:32px 16px;text-align:center;font-size:14px;color:var(--rv-text-tertiary);min-width:1110px;'
        }, 'Nenhum pedido encontrado.'));
        return wrap;
      }

      rows.forEach(function (pedido, index) {
        wrap.appendChild(buildRow(pedido, index === rows.length - 1));
      });
      return wrap;
    }

    function buildPagination(totalFiltrado) {
      var totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var inicio = totalFiltrado === 0 ? 0 : ((ui.pagina - 1) * PAGE_SIZE) + 1;
      var fim = Math.min(ui.pagina * PAGE_SIZE, totalFiltrado);

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;background:var(--rv-surface);border:1px solid var(--rv-border);border-top:none;border-radius:var(--rv-radius);padding:11px 16px;margin-bottom:14px;'
      },
      window.el('span', {
        style: 'font-size:13px;color:var(--rv-text-tertiary);'
      }, totalFiltrado === 0
        ? 'Nenhum pedido encontrado'
        : 'Mostrando ' + inicio + ' a ' + fim + ' de ' + totalFiltrado + (totalFiltrado === 1 ? ' pedido' : ' pedidos')),
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
          style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;border-radius:4px;background:var(--rv-brand);color:var(--rv-text-on-brand);font-size:13px;font-weight:700;cursor:default;font-family:inherit;'
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
        buildHeader(),
        buildKpis(),
        buildBuscaTabs(),
        buildFilterControls(),
        buildTable(rows),
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
  window.RAVATEX_SCREENS.pedidosList = {
    screenPedidosLista: screenPedidosLista
  };

  window.screenPedidosLista = screenPedidosLista;
})(window);
