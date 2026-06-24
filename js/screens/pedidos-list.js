// =====================================================================
// === SCREENS: PEDIDOS LIST ==========================================
// Tela admin `#/pedidos` — listagem de Pedidos do cliente.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1
// Escopo: APENAS listagem admin. Sem formulário, sem edição, sem
//   geração de OP, sem cliente público, sem token. Botão "Novo pedido"
//   e "Visualizar" ficam como placeholders ("em breve") nesta fase.
//
// Carregar via <script src="js/screens/pedidos-list.js?v=...></script>
// no <head>, DEPOIS de js/screens/common.js, js/pedido-ui.js, js/ui.js,
// e ANTES do <script> inline principal (compatibilidade com o
// setRoutes registrado em js/boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.dataTable
//     (js/ui.js)
//   - window.shellLayout / window.ADMIN_MENU
//     (js/screens/common.js)
//   - window.RAVATEX_PEDIDO_UI / window.pedidoStatusBadge
//     / window.pedidoStatusLabel / window.fmtDataCurta
//     (js/pedido-ui.js)
//   - window.navigate
//     (js/router.js)
//   - window.supa
//     (js/supabase-client.js)
//
// A tela é read-only: NÃO faz insert/update/delete/rpc. Apenas
// `select` em `pedidos` com join em `clientes`.
//
// Compatibilidade: window.screenPedidosLista e
// window.RAVATEX_SCREENS.pedidosList ficam disponíveis para o
// setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  async function screenPedidosLista() {
    const container = window.el('div', {});

    let allRows = [];
    let allClientesById = {};
    let filtroStatus = 'todos';

    async function reload() {
      const [pedidosRes, clientesRes] = await Promise.all([
        window.supa
          .from('pedidos')
          .select('id, numero, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em')
          .order('criado_em', { ascending: false })
          .limit(200),
        window.supa
          .from('clientes')
          .select('id, nome')
          .limit(500),
      ]);

      if (pedidosRes.error) {
        window.toast('Erro ao carregar pedidos', 'error');
        console.error(pedidosRes.error);
        allRows = [];
      } else {
        allRows = pedidosRes.data || [];
      }

      if (clientesRes.error) {
        // Não bloqueia a listagem se clientes falhar; apenas não teremos nome.
        console.error('pedidos-list: erro ao carregar clientes', clientesRes.error);
        allClientesById = {};
      } else {
        allClientesById = Object.fromEntries(
          (clientesRes.data || []).map(c => [c.id, c])
        );
      }

      render();
    }

    function render() {
      const header = window.pageHeader('Pedidos', [
        {
          label: '+ Novo pedido',
          onclick: () => window.toast('Formulário será implementado na próxima fase.', 'info'),
        },
      ]);

      const statusFiltro = window.el('div', { class: 'flex flex-wrap gap-2 mb-3' });
      const statusOptions = ['todos'].concat(window.pedidoStatusTodos());
      for (const s of statusOptions) {
        const active = filtroStatus === s;
        statusFiltro.appendChild(
          window.el('button', {
            class: 'px-3 py-1 rounded-lg text-xs font-semibold '
              + (active
                ? 'bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'),
            onclick: () => { filtroStatus = s; render(); },
          }, s === 'todos' ? 'Todos' : window.pedidoStatusLabel(s))
        );
      }

      const visiveis = filtroStatus === 'todos'
        ? allRows
        : allRows.filter(r => r.status === filtroStatus);

      const body = visiveis.length === 0
        ? window.el('div', {
            class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500',
          }, 'Nenhum pedido encontrado.')
        : window.dataTable({
            columns: [
              {
                key: 'numero',
                label: 'Número',
                render: (r) => '#' + (r.numero != null ? r.numero : '—'),
              },
              {
                key: 'cliente',
                label: 'Cliente',
                render: (r) => (allClientesById[r.cliente_id] && allClientesById[r.cliente_id].nome)
                  || '—',
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => window.pedidoStatusBadge(r.status),
              },
              {
                key: 'prazo',
                label: 'Prazo',
                render: (r) => r.prazo_entrega
                  ? window.fmtDataCurta(r.prazo_entrega)
                  : '—',
              },
              {
                key: 'criado_em',
                label: 'Criado em',
                render: (r) => window.fmtDataCurta(r.criado_em),
              },
            ],
            rows: visiveis,
            actions: [
              {
                label: 'Visualizar',
                onclick: () => window.toast('Detalhe do pedido será implementado em fase futura.', 'info'),
              },
            ],
          });

      container.replaceChildren(header, statusFiltro, body);
    }

    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidosList = {
    screenPedidosLista,
  };

  // Compatibilidade com setRoutes em boot.js
  window.screenPedidosLista = screenPedidosLista;
})(window);
