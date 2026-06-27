// =====================================================================
// === SCREENS: CLIENTE DASHBOARD ======================================
// Página inicial read-only do portal B2B do cliente. Resume os
// pedidos próprios em cards/KPIs, lista os pedidos recentes e mostra
// as últimas atualizações visíveis. Rota: `#/cliente/dashboard`.
//
// Fase: RAVATEX-TAPETES-CLIENTE-DASHBOARD-A
// Escopo: leitura apenas. Nenhuma ação de escrita. Sem
//   insert/update/delete/rpc, sem Edge Function, sem credencial de
//   serviço. Confia na RLS para filtrar por `cliente_id` e na policy
//   `pedido_cliente_eventos_cliente_select` para os eventos visíveis.
//   Não expõe dados internos, de produção ou administrativos.
//
// Carregar via <script src="js/screens/cliente-dashboard.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-tracking-ui.js,
// pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.pageHeader (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.RavatexPedidoTracking (js/pedido-tracking-ui.js) — usado
//     para rotular o status visual com a taxonomia compartilhada.
//   - window.fmtDataCurta (js/pedido-ui.js) — formatação de datas.
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// Dados de pedidos: SELECT explícito apenas dos campos seguros
//   (id, numero, status, status_cliente_*, prazo_entrega,
//   prazo_desejado, tipo_recebimento, criado_em, atualizado_em).
// Dados de atualizações: SELECT explícito em `pedido_cliente_eventos`
//   (id, pedido_id, status, titulo, mensagem, criado_em). Apenas
//   colunas visíveis; nenhuma coluna interna de auditoria. Não
//   consulta a tabela interna de eventos. Falha nos eventos não
//   quebra o restante do dashboard.
//
// Compatibilidade: window.screenClienteDashboard e
// RAVATEX_SCREENS.clienteDashboard ficam disponíveis para o setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  var PEDIDOS_LIMIT = 100;
  var RECENTES_LIMIT = 5;
  var EVENTOS_LIMIT = 8;

  var EM_ANDAMENTO_KEYS = ['tecelagem', 'acabamento', 'expedicao', 'transporte'];

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  // Resolve o estado visual de um pedido para fins de KPI. Usa a
  // taxonomia compartilhada com fallback seguro para "recebido" quando
  // `status_cliente_visual` ainda não foi publicado.
  function resolveEstadoVisual(pedido) {
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
      if (step) return step.key;
      return 'recebido';
    }
    return visualKey || 'recebido';
  }

  function pedidoLabelVisual(pedido) {
    var api = getTrackingApi();
    if (api && api.getClienteTrackingStatusLabel) {
      return api.getClienteTrackingStatusLabel(pedido);
    }
    return '—';
  }

  function eventoStatusLabel(status) {
    var api = getTrackingApi();
    if (!api) return null;
    var step = api.getClienteTrackingStep ? api.getClienteTrackingStep(status) : null;
    if (step) return step.label;
    var excecao = api.getClienteTrackingException ? api.getClienteTrackingException(status) : null;
    if (excecao) return excecao.label;
    return null;
  }

  function fmtData(v) {
    if (!v) return null;
    return window.fmtDataCurta ? window.fmtDataCurta(v) : String(v);
  }

  function fmtNumero(n) {
    return '#' + (n != null ? n : '—');
  }

  function computeKpis(pedidos, eventosCount) {
    var aberto = 0;
    var andamento = 0;
    var pronto = 0;

    pedidos.forEach(function (p) {
      var estado = resolveEstadoVisual(p);
      if (estado === 'concluido') {
        pronto += 1;
      } else if (estado !== 'cancelado') {
        aberto += 1;
      }
      if (EM_ANDAMENTO_KEYS.indexOf(estado) !== -1) {
        andamento += 1;
      }
    });

    return {
      aberto: aberto,
      andamento: andamento,
      pronto: pronto,
      atualizacoes: eventosCount,
    };
  }

  async function screenClienteDashboard() {
    var container = window.el('div', {});

    var state = {
      pedidos: [],
      eventos: [],
      pedidosError: false,
      eventosError: false,
    };

    async function carregar() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, prazo_desejado, tipo_recebimento, criado_em, atualizado_em')
        .order('criado_em', { ascending: false })
        .limit(PEDIDOS_LIMIT);

      if (pedidosRes.error) {
        state.pedidosError = true;
        state.pedidos = [];
        console.error('cliente-dashboard: erro ao carregar pedidos', pedidosRes.error);
      } else {
        state.pedidosError = false;
        state.pedidos = pedidosRes.data || [];
      }

      var eventosRes = await window.supa
        .from('pedido_cliente_eventos')
        .select('id, pedido_id, status, titulo, mensagem, criado_em')
        .order('criado_em', { ascending: false })
        .limit(EVENTOS_LIMIT);

      if (eventosRes.error) {
        state.eventosError = true;
        state.eventos = [];
        console.error('cliente-dashboard: erro ao carregar atualizações', eventosRes.error);
      } else {
        state.eventosError = false;
        state.eventos = eventosRes.data || [];
      }
    }

    function buildKpiCard(label, valor, tone) {
      return window.el('div', { class: 'bg-white rounded-xl shadow p-5 border border-gray-100' },
        window.el('div', { class: 'text-3xl font-bold ' + tone }, String(valor)),
        window.el('div', { class: 'text-sm text-gray-500 mt-1' }, label)
      );
    }

    function buildKpis() {
      var kpis = computeKpis(state.pedidos, state.eventos.length);
      return window.el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6' },
        buildKpiCard('Pedidos em aberto', kpis.aberto, 'text-blue-700'),
        buildKpiCard('Em andamento', kpis.andamento, 'text-amber-600'),
        buildKpiCard('Prontos / concluídos', kpis.pronto, 'text-green-600'),
        buildKpiCard('Atualizações recentes', kpis.atualizacoes, 'text-gray-700')
      );
    }

    function buildPedidoRow(pedido) {
      var prazo = fmtData(pedido.prazo_entrega) || fmtData(pedido.prazo_desejado);
      var atualizado = fmtData(pedido.status_cliente_atualizado_em) || fmtData(pedido.atualizado_em);

      return window.el('div', {
        class: 'flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 last:border-0 py-3',
      },
        window.el('div', { class: 'min-w-0' },
          window.el('div', { class: 'flex items-center gap-2' },
            window.el('span', { class: 'text-sm font-semibold text-gray-900' }, fmtNumero(pedido.numero)),
            window.el('span', { class: 'text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700' },
              pedidoLabelVisual(pedido))
          ),
          window.el('div', { class: 'text-xs text-gray-400 mt-1' },
            (prazo ? 'Prazo: ' + prazo : 'Prazo não definido')
              + (atualizado ? ' · Atualizado em ' + atualizado : ''))
        ),
        window.el('button', {
          type: 'button',
          class: 'text-sm text-blue-700 hover:underline shrink-0',
          onclick: function () { window.navigate('#/cliente/pedidos/' + pedido.id); },
        }, 'Ver pedido')
      );
    }

    function buildPedidosRecentes() {
      var card = window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-6' });
      card.appendChild(window.el('div', { class: 'flex items-center justify-between mb-2' },
        window.el('h2', { class: 'text-sm font-semibold text-gray-700' }, 'Pedidos recentes'),
        window.el('button', {
          type: 'button',
          class: 'text-sm text-blue-700 hover:underline',
          onclick: function () { window.navigate('#/cliente/pedidos'); },
        }, 'Ver todos')
      ));

      if (state.pedidosError) {
        card.appendChild(window.el('p', { class: 'text-sm text-red-700' },
          'Não foi possível carregar seus pedidos agora. Tente recarregar a página.'));
        return card;
      }

      if (state.pedidos.length === 0) {
        card.appendChild(window.el('p', { class: 'text-sm text-gray-500' },
          'Você ainda não tem pedidos.'));
        return card;
      }

      state.pedidos.slice(0, RECENTES_LIMIT).forEach(function (pedido) {
        card.appendChild(buildPedidoRow(pedido));
      });
      return card;
    }

    function buildEventoItem(evento) {
      var badge = eventoStatusLabel(evento.status);
      var data = fmtData(evento.criado_em);
      return window.el('div', { class: 'border-b border-gray-100 last:border-0 py-3' },
        window.el('div', { class: 'flex flex-wrap items-center gap-2 mb-1' },
          window.el('span', { class: 'text-sm font-semibold text-gray-900' },
            evento.titulo ? String(evento.titulo) : 'Atualização'),
          badge
            ? window.el('span', { class: 'text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700' }, badge)
            : null
        ),
        evento.mensagem
          ? window.el('p', { class: 'text-sm text-gray-700 mb-1' }, String(evento.mensagem))
          : null,
        window.el('div', { class: 'flex items-center justify-between gap-2' },
          window.el('span', { class: 'text-xs text-gray-400' }, data || '—'),
          evento.pedido_id
            ? window.el('button', {
                type: 'button',
                class: 'text-xs text-blue-700 hover:underline',
                onclick: function () { window.navigate('#/cliente/pedidos/' + evento.pedido_id); },
              }, 'Ver pedido')
            : null
        )
      );
    }

    function buildEventos() {
      var card = window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-6' });
      card.appendChild(window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-2' },
        'Últimas atualizações'));

      if (state.eventosError) {
        card.appendChild(window.el('p', { class: 'text-sm text-amber-600' },
          'Não foi possível carregar as atualizações agora.'));
        return card;
      }

      if (state.eventos.length === 0) {
        card.appendChild(window.el('p', { class: 'text-sm text-gray-500' },
          'Suas atualizações aparecerão aqui.'));
        return card;
      }

      state.eventos.forEach(function (evento) {
        card.appendChild(buildEventoItem(evento));
      });
      return card;
    }

    function render() {
      var header = window.pageHeader('Início');
      container.replaceChildren(header, buildKpis(), buildPedidosRecentes(), buildEventos());
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clienteDashboard = {
    screenClienteDashboard: screenClienteDashboard,
  };

  window.screenClienteDashboard = screenClienteDashboard;
})(window);
