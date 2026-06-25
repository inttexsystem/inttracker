// =====================================================================
// === SCREENS: CLIENTE PEDIDOS LIST ===================================
// Tela cliente `#/cliente/pedidos` — listagem read-only dos próprios
// pedidos. Confia na RLS para filtrar por `cliente_id`.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A
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
//   - window.pedidoStatusBadge / window.pedidoStatusLabel
//     / window.fmtDataCurta (js/pedido-ui.js)
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// A tela é read-only: APENAS `select` em `pedidos`. Sem
// insert/update/delete/rpc.
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

    async function reload() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, prazo_entrega, observacao, criado_em')
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
            class: 'px-3 py-1 rounded-lg text-xs font-semibold '
              + (active
                ? 'bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'),
            onclick: (function (st) {
              return function () { filtroStatus = st; render(); };
            })(s),
          }, s === 'todos' ? 'Todos' : window.pedidoStatusLabel(s))
        );
      }

      var visiveis = filtroStatus === 'todos'
        ? allRows
        : allRows.filter(function (r) { return r.status === filtroStatus; });

      var body = visiveis.length === 0
        ? window.el('div', {
            class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500',
          }, 'Nenhum pedido encontrado.')
        : window.dataTable({
            columns: [
              {
                key: 'numero',
                label: 'Número',
                render: function (r) { return '#' + (r.numero != null ? r.numero : '—'); },
              },
              {
                key: 'status',
                label: 'Status',
                render: function (r) { return window.pedidoStatusBadge(r.status); },
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
                label: 'Visualizar',
                onclick: function (row) { window.navigate('#/cliente/pedidos/' + row.id); },
              },
            ],
          });

      container.replaceChildren(header, statusFiltro, body);
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
