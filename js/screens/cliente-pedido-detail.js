// =====================================================================
// === SCREENS: CLIENTE PEDIDO DETAIL ==================================
// Tela cliente do detalhe sanitizado de um Pedido próprio.
// Rota: `#/cliente/pedidos/<uuid>` (parseada por js/router.js).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A +
//   RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A
// Escopo: leitura apenas. Sem modificar, cancelar ou criar pedido.
//   Confia na RLS para bloquear acesso a pedidos de outros clientes.
//   Não expõe dados internos, de produção ou administrativos.
//   Exibe no topo o card de acompanhamento visual (stepper + situação
//   atual), delegado a cliente-pedido-tracking.js.
//
// Carregar via <script src="js/screens/cliente-pedido-detail.js"></script>
// no <head>, DEPOIS de cliente-common.js, cliente-pedido-tracking.js,
// pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.dataTable
//     (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.buildClientePedidoTrackingCard
//     (js/screens/cliente-pedido-tracking.js)
//   - window.pedidoStatusBadge / window.pedidoStatusLabel
//     / window.corPreviewElement / window.corPreviewHex
//     / window.fmtDataCurta (js/pedido-ui.js)
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// SELECT-only em `pedidos`, `pedido_itens`, `modelos`, `cores`.
// Sem insert/update/delete/rpc.
//
// Compatibilidade: window.screenClientePedidoDetalhe fica disponível
// para o matchRoute.
// =====================================================================

(function (window) {
  'use strict';

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function fmtNumero(n) {
    if (n == null) return '—';
    return '#' + n;
  }

  function fmtMetros(v) {
    if (v == null) return '—';
    var n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtLargura(v) {
    if (v == null) return '—';
    var n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtTextoOuEmpty(s, fallback) {
    if (s == null) return fallback || '—';
    var t = String(s).trim();
    if (!t) return fallback || '—';
    return t;
  }

  async function screenClientePedidoDetalhe(pedidoId) {
    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido inválido.', 'error');
      var errWrap = window.el('div', {},
        window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
          'Pedido inválido. Volte para a listagem e tente novamente.'),
        window.el('div', { class: 'mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, '← Voltar para lista')
        )
      );
      var errHeader = window.pageHeader('Pedido');
      return window.clienteShellLayout(
        window.el('div', {}, errHeader, errWrap));
    }

    var container = window.el('div', {});
    var loadingError = null;

    var state = {
      pedido: null,
      itens: [],
      modelosById: {},
      coresById: {},
    };

    function modelLabel(item) {
      var m = state.modelosById[item.modelo_id];
      if (!m) return '—';
      var w = (typeof m.largura === 'number')
        ? m.largura.toFixed(2).replace('.', ',') + ' m'
        : (m.largura != null ? String(m.largura) : '—');
      return m.nome + ' · ' + w;
    }

    function corNomeById(id) {
      if (id == null) return null;
      var c = state.coresById[id];
      return c && c.nome ? c.nome : null;
    }

    function itemCoresLabel(item) {
      var c1Id = item.cor_1_id != null
        ? item.cor_1_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_1_id);
      var c2Id = item.cor_2_id != null
        ? item.cor_2_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_2_id);
      var c1 = corNomeById(c1Id) || '—';
      var c2 = corNomeById(c2Id) || '—';
      return c1 + ' / ' + c2;
    }

    function itemLargura(item) {
      if (item.largura != null) return fmtLargura(item.largura);
      var m = state.modelosById[item.modelo_id];
      if (m && m.largura != null) return fmtLargura(m.largura);
      return '—';
    }

    function itemPreviewEl(item) {
      var c1Id = item.cor_1_id != null
        ? item.cor_1_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_1_id);
      var c1Nome = corNomeById(c1Id);
      if (c1Nome && window.corPreviewElement) return window.corPreviewElement(c1Nome);
      return window.el('span', { class: 'text-gray-400 text-xs' }, '—');
    }

    async function carregar() {
      var pedidoRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, observacao, criado_em, atualizado_em')
        .eq('id', pedidoId)
        .maybeSingle();

      if (pedidoRes.error || !pedidoRes.data) {
        loadingError = 'pedido';
        window.toast('Pedido não encontrado ou sem permissão.', 'error');
        console.error(pedidoRes.error);
        state.pedido = null;
        return;
      }

      state.pedido = pedidoRes.data;

      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, pedido_id, modelo_id, metros, largura, cor_1_id, cor_2_id, observacao, ordem')
        .eq('pedido_id', pedidoId)
        .order('ordem', { ascending: true });

      if (itensRes.error) {
        loadingError = 'itens';
        window.toast('Erro ao carregar itens do pedido.', 'error');
        console.error(itensRes.error);
        state.itens = [];
      } else {
        state.itens = itensRes.data || [];
      }

      var modeloIds = Array.from(new Set(state.itens
        .map(function (it) { return it.modelo_id; })
        .filter(function (x) { return x != null; })));
      var corIds = Array.from(new Set([].concat.apply([], state.itens.map(function (it) {
        return [it.cor_1_id, it.cor_2_id];
      })).filter(function (x) { return x != null; })));

      if (modeloIds.length > 0) {
        var modRes = await window.supa
          .from('modelos')
          .select('id, nome, largura, cor_1_id, cor_2_id')
          .in('id', modeloIds);
        if (modRes.error) {
          console.error('cliente-pedido-detail: erro ao carregar modelos', modRes.error);
        } else {
          state.modelosById = Object.fromEntries(
            (modRes.data || []).map(function (m) { return [m.id, m]; })
          );
          for (var i = 0; i < (modRes.data || []).length; i++) {
            var m = modRes.data[i];
            if (m.cor_1_id) corIds.push(m.cor_1_id);
            if (m.cor_2_id) corIds.push(m.cor_2_id);
          }
        }
      }

      corIds = Array.from(new Set(corIds.filter(function (x) { return x != null; })));
      if (corIds.length > 0) {
        var corRes = await window.supa
          .from('cores')
          .select('id, nome')
          .in('id', corIds);
        if (corRes.error) {
          console.error('cliente-pedido-detail: erro ao carregar cores', corRes.error);
        } else {
          state.coresById = Object.fromEntries(
            (corRes.data || []).map(function (c) { return [c.id, c]; })
          );
        }
      }
    }

    function buildHeader() {
      return window.pageHeader('Pedido', [
        {
          label: '← Voltar para lista',
          onclick: function () { window.navigate('#/cliente/pedidos'); },
        },
      ]);
    }

    function buildTracking() {
      if (!state.pedido) return window.el('div', {});
      return window.buildClientePedidoTrackingCard(state.pedido);
    }

    function buildResumo() {
      if (!state.pedido) return window.el('div', {});
      var p = state.pedido;
      return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' },
        window.el('div', { class: 'flex flex-wrap items-center gap-3' },
          window.el('div', { class: 'text-2xl font-bold' }, fmtNumero(p.numero)),
          window.pedidoStatusBadge(p.status),
        ),
        window.el('dl', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm' },
          kv('Prazo de entrega', p.prazo_entrega ? window.fmtDataCurta(p.prazo_entrega) : '—'),
          kv('Criado em', p.criado_em ? window.fmtDataCurta(p.criado_em) : '—'),
          kv('Atualizado em', p.atualizado_em ? window.fmtDataCurta(p.atualizado_em) : '—'),
        )
      );
    }

    function kv(label, value) {
      return window.el('div', { class: 'flex gap-2' },
        window.el('dt', { class: 'text-gray-500 min-w-32' }, label),
        window.el('dd', { class: 'text-gray-800 font-medium' }, value)
      );
    }

    function buildDadosGerais() {
      if (!state.pedido) return window.el('div', {});
      var p = state.pedido;
      var obs = fmtTextoOuEmpty(p.observacao, '');
      if (!obs || obs === '—') return window.el('div', {});
      return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' },
        window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-2' }, 'Observação geral'),
        window.el('p', { class: 'text-gray-800 whitespace-pre-line' }, obs),
      );
    }

    function buildItens() {
      var itens = state.itens;
      if (itens.length === 0) {
        return window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-gray-500' },
          'Este pedido não possui itens.');
      }
      var body = window.dataTable({
        columns: [
          {
            key: 'modelo',
            label: 'Modelo',
            render: function (r) { return modelLabel(r); },
          },
          {
            key: 'cor',
            label: 'Cor 1 / Cor 2',
            render: function (r) { return itemCoresLabel(r); },
          },
          {
            key: 'largura',
            label: 'Largura',
            render: function (r) { return itemLargura(r); },
          },
          {
            key: 'preview',
            label: 'Preview',
            render: function (r) { return itemPreviewEl(r); },
          },
          {
            key: 'metros',
            label: 'Metros',
            render: function (r) { return fmtMetros(r.metros); },
          },
          {
            key: 'observacao',
            label: 'Observação',
            render: function (r) { return fmtTextoOuEmpty(r.observacao, ''); },
          },
        ],
        rows: itens,
        actions: [],
      });
      var wrap = window.el('div', {});
      wrap.appendChild(window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-2' },
        'Itens (' + itens.length + ')'));
      wrap.appendChild(body);
      return wrap;
    }

    function render() {
      var header = buildHeader();
      if (loadingError === 'pedido') {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Pedido não encontrado ou sem permissão. Ele pode ter sido removido.'));
        return;
      }
      if (loadingError) {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar dados do pedido. Tente recarregar a página.'));
        return;
      }
      container.replaceChildren(header, buildTracking(), buildResumo(), buildDadosGerais(), buildItens());
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoDetail = {
    screenClientePedidoDetalhe: screenClientePedidoDetalhe,
  };

  window.screenClientePedidoDetalhe = screenClientePedidoDetalhe;
})(window);
