// =====================================================================
// === SCREENS: CLIENTE PEDIDOS LIST ===================================
// Tela cliente `#/cliente/pedidos` — listagem read-only dos próprios
// pedidos. Confia na RLS para filtrar por `cliente_id`.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A +
//   RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A +
//   RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A (lista alinhada ao
//   tracking visual publicado pelo admin, preservando o fallback
//   seguro para pedidos sem status visual)
// Escopo: listagem cliente. Sem criar/editar/cancelar pedido.
//   Sem expor dados internos, de produção ou administrativos.
//
// Carregar via <script src="js/screens/cliente-pedidos-list.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.dataTable
//     (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.fmtDataCurta (js/pedido-ui.js)
//   - window.RavatexPedidoTracking (js/pedido-tracking-ui.js)
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// A tela é read-only: APENAS `select` em `pedidos`. Sem
// insert/update/delete/rpc. O select inclui os campos
// `status_cliente_*` apenas para refletir ao cliente o mesmo estado
// visual já consumido pelo dashboard e pelo detalhe.
//
// Compatibilidade: window.screenClientePedidosLista fica disponível
// para o setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  async function screenClientePedidosLista() {
    var container = window.el('div', {});

    var allRows = [];
    var filtroStatus = 'todos';

    function getTrackingApi() {
      return window.RavatexPedidoTracking
        || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
        || null;
    }

    function normalizarKey(value) {
      if (typeof value !== 'string') return '';
      return value.trim().toLowerCase();
    }

    function resolveStatusFiltro(row) {
      var api = getTrackingApi();
      var visualKey = normalizarKey(row && row.status_cliente_visual);
      if (api && api.getClienteTrackingStep) {
        var step = api.getClienteTrackingStep(visualKey);
        if (step) return step.key;
      }
      return normalizarKey(row && row.status);
    }

    function renderStatusBadge(row) {
      var api = getTrackingApi();
      var excecaoKey = normalizarKey(row && row.status_cliente_excecao);
      var excecao = api && api.getClienteTrackingException
        ? api.getClienteTrackingException(excecaoKey)
        : null;
      var label = api && api.getClienteTrackingStatusLabel
        ? api.getClienteTrackingStatusLabel(row || {})
        : (row && row.status ? row.status : null);
      var toneClass = 'bg-blue-50 text-blue-700';

      if (excecao) {
        if (excecao.tom === 'danger') toneClass = 'bg-red-50 text-red-700';
        else if (excecao.tom === 'warning') toneClass = 'bg-amber-50 text-amber-700';
        else if (excecao.tom === 'neutral') toneClass = 'bg-gray-100 text-gray-700';
      }

      return window.el('span', {
        class: 'px-2 py-1 rounded text-xs font-semibold ' + toneClass,
      }, label || 'Recebido');
    }

    async function reload() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, observacao, criado_em')
        .order('criado_em', { ascending: false })
        .limit(200);

      if (pedidosRes.error) {
        window.toast('Erro ao carregar pedidos', 'error');
        console.error(pedidosRes.error);
        allRows = [];
      } else {
        allRows = pedidosRes.data || [];
      }

      render();
    }

    function render() {
      var header = window.pageHeader('Meus pedidos', [
        {
          label: '+ Novo pedido',
          onclick: function () { window.navigate('#/cliente/pedidos/novo'); },
        },
      ]);

      var statusFiltro = window.el('div', { class: 'flex flex-wrap gap-2 mb-3' });
      var statusOptions = ['todos'].concat(window.pedidoStatusTodos());
      for (var i = 0; i < statusOptions.length; i++) {
        var s = statusOptions[i];
        var active = filtroStatus === s;
        statusFiltro.appendChild(
          window.el('button', {
            class: 'px-3 py-1 rounded-full text-xs font-semibold transition-colors '
              + (active
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'),
            onclick: (function (st) {
              return function () { filtroStatus = st; render(); };
            })(s),
          }, s === 'todos' ? 'Todos' : window.pedidoStatusLabel(s))
        );
      }

      var visiveis = filtroStatus === 'todos'
        ? allRows
        : allRows.filter(function (r) { return resolveStatusFiltro(r) === filtroStatus; });

      var contagem = window.el('div', { class: 'text-xs text-gray-500 mb-2' },
        visiveis.length + (visiveis.length === 1 ? ' pedido encontrado' : ' pedidos encontrados'));

      var body = visiveis.length === 0
        ? window.el('div', {
            class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500',
          }, 'Nenhum pedido encontrado.')
        : window.el('div', { class: 'overflow-x-auto' }, window.dataTable({
            columns: [
              {
                key: 'numero',
                label: 'Número',
                render: function (r) { return '#' + (r.numero != null ? r.numero : '—'); },
              },
              {
                key: 'status',
                label: 'Status',
                render: function (r) { return renderStatusBadge(r); },
              },
              {
                key: 'prazo',
                label: 'Prazo',
                render: function (r) { return r.prazo_entrega ? window.fmtDataCurta(r.prazo_entrega) : '—'; },
              },
              {
                key: 'observacao',
                label: 'Observação',
                render: function (r) {
                  var obs = r.observacao;
                  if (!obs) return '—';
                  return obs.length > 60 ? obs.slice(0, 60) + '…' : obs;
                },
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                render: function (r) { return window.fmtDataCurta(r.criado_em); },
              },
            ],
            rows: visiveis,
            actions: [
              {
                label: 'Ver pedido',
                onclick: function (row) { window.navigate('#/cliente/pedidos/' + row.id); },
              },
            ],
          }));

      container.replaceChildren(header, statusFiltro, contagem, body);
    }

    await reload();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidosList = {
    screenClientePedidosLista: screenClientePedidosLista,
  };

  window.screenClientePedidosLista = screenClientePedidosLista;
})(window);
