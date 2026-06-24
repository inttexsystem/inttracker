// =====================================================================
// === SCREENS: PEDIDO DETAIL ==========================================
// Tela admin read-only do detalhe de um Pedido existente.
// Rota: `#/pedidos/<uuid>` (parseada por js/router.js via matchRoute
// dinâmico). Botão "Visualizar" da listagem `#/pedidos` navega para
// esta tela.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A
// Escopo: APENAS leitura. Sem edição, sem cancelamento, sem transição
//   de status, sem geração de OP, sem lote, sem cliente público, sem
//   token, sem Edge Function. Ações da tela são placeholders
//   "em breve" (botões desabilitados). Consultas: SELECT em `pedidos`,
//   `pedido_itens`, `clientes`, `modelos` e `cores` (joins via select
//   aninhado do Supabase; sem RPC).
//
// Carregar via <script src="js/screens/pedido-detail.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedido-form.js, js/pedido-ui.js e
// js/ui.js, e ANTES de <script> principal (boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.dataTable
//     / window.shellLayout / window.ADMIN_MENU  (js/ui.js, common.js)
//   - window.RAVATEX_PEDIDO_UI / window.pedidoStatusBadge
//     / window.pedidoStatusLabel / window.corPreviewElement
//     / window.corPreviewHex / window.fmtDataCurta
//     (js/pedido-ui.js)
//   - window.navigate                  (js/router.js)
//   - window.supa                      (js/supabase-client.js)
//
// A tela é estritamente read-only: NÃO faz insert/update/delete/rpc/
// functions.invoke. Apenas SELECT em tabelas admin-only via RLS.
//
// Compatibilidade: window.screenPedidoDetalhe e
// window.RAVATEX_SCREENS.pedidoDetail ficam disponíveis para o
// matchRoute de js/router.js.
// =====================================================================

(function (window) {
  'use strict';

  // Regex UUID v4 (case-insensitive) para validação rápida do id
  // antes de mandar para o Supabase. O router já valida o formato,
  // mas esta defesa evita queries inúteis com lixo na URL.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function fmtNumero(n) {
    if (n == null) return '—';
    return '#' + n;
  }

  function fmtMetros(v) {
    if (v == null) return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtLargura(v) {
    if (v == null) return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtTextoOuEmpty(s, fallback) {
    if (s == null) return fallback || '—';
    const t = String(s).trim();
    if (!t) return fallback || '—';
    return t;
  }

  async function screenPedidoDetalhe(pedidoId) {
    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido inválido.', 'error');
      // Tela mínima de erro — sem quebrar o shell.
      const errWrap = window.el('div', {},
        window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
          'Pedido inválido. Volte para a listagem e tente novamente.'),
        window.el('div', { class: 'mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
            onclick: function () { window.navigate('#/pedidos'); },
          }, '← Voltar para lista')
        )
      );
      const errHeader = window.pageHeader('Pedido');
      return window.shellLayout(window.ADMIN_MENU,
        window.el('div', {}, errHeader, errWrap));
    }

    const container = window.el('div', {});
    let loadingError = null;

    // Estado da tela
    const state = {
      pedido: null,
      cliente: null,
      itens: [],
      modelosById: {},
      coresById: {},
    };

    function modelLabel(item) {
      const m = state.modelosById[item.modelo_id];
      if (!m) return '—';
      const w = (typeof m.largura === 'number')
        ? m.largura.toFixed(2).replace('.', ',') + ' m'
        : (m.largura != null ? String(m.largura) : '—');
      return m.nome + ' · ' + w;
    }

    function corNomeById(id) {
      if (id == null) return null;
      const c = state.coresById[id];
      return c && c.nome ? c.nome : null;
    }

    function itemCoresLabel(item) {
      // Prioriza o override em pedido_itens; se nulo, usa o do modelo.
      const c1Id = item.cor_1_id != null
        ? item.cor_1_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_1_id);
      const c2Id = item.cor_2_id != null
        ? item.cor_2_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_2_id);
      const c1 = corNomeById(c1Id) || '—';
      const c2 = corNomeById(c2Id) || '—';
      return c1 + ' / ' + c2;
    }

    function itemLargura(item) {
      // Override em pedido_itens; se nulo, usa o do modelo.
      if (item.largura != null) return fmtLargura(item.largura);
      const m = state.modelosById[item.modelo_id];
      if (m && m.largura != null) return fmtLargura(m.largura);
      return '—';
    }

    function itemPreviewEl(item) {
      // Usa cor_1 do item (override) ou do modelo.
      const c1Id = item.cor_1_id != null
        ? item.cor_1_id
        : (state.modelosById[item.modelo_id] && state.modelosById[item.modelo_id].cor_1_id);
      const c1Nome = corNomeById(c1Id);
      if (c1Nome && window.corPreviewElement) return window.corPreviewElement(c1Nome);
      return window.el('span', { class: 'text-gray-400 text-xs' }, '—');
    }

    async function carregar() {
      // SELECT do pedido + cliente relacionado + itens.
      // Joins via select aninhado do Supabase (admin-only via RLS).
      const pedidoRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em, cliente:cliente_id(id, nome)')
        .eq('id', pedidoId)
        .maybeSingle();

      if (pedidoRes.error || !pedidoRes.data) {
        loadingError = 'pedido';
        window.toast('Pedido não encontrado.', 'error');
        console.error(pedidoRes.error);
        state.pedido = null;
        return;
      }

      state.pedido = pedidoRes.data;
      // O join vem como objeto único (FK 1:1).
      state.cliente = (pedidoRes.data.cliente && typeof pedidoRes.data.cliente === 'object')
        ? pedidoRes.data.cliente
        : null;

      const itensRes = await window.supa
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

      // Carrega modelos + cores referenciados pelos itens (consultas
      // separadas para evitar joins frágeis no PostgREST).
      let modeloIds = Array.from(new Set(state.itens
        .map(function (it) { return it.modelo_id; })
        .filter(function (x) { return x != null; })));
      let corIds = Array.from(new Set([].concat.apply([], state.itens.map(function (it) {
        return [it.cor_1_id, it.cor_2_id];
      })).filter(function (x) { return x != null; })));

      if (modeloIds.length > 0) {
        const modRes = await window.supa
          .from('modelos')
          .select('id, nome, largura, cor_1_id, cor_2_id')
          .in('id', modeloIds);
        if (modRes.error) {
          console.error('pedido-detail: erro ao carregar modelos', modRes.error);
        } else {
          state.modelosById = Object.fromEntries(
            (modRes.data || []).map(function (m) { return [m.id, m]; })
          );
          // Coleta IDs de cor dos modelos caso itens não tenham override.
          for (let i = 0; i < (modRes.data || []).length; i++) {
            const m = modRes.data[i];
            if (m.cor_1_id) corIds.push(m.cor_1_id);
            if (m.cor_2_id) corIds.push(m.cor_2_id);
          }
        }
      }

      corIds = Array.from(new Set(corIds.filter(function (x) { return x != null; })));
      if (corIds.length > 0) {
        const corRes = await window.supa
          .from('cores')
          .select('id, nome')
          .in('id', corIds);
        if (corRes.error) {
          console.error('pedido-detail: erro ao carregar cores', corRes.error);
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
          onclick: function () { window.navigate('#/pedidos'); },
        },
      ]);
    }

    function buildResumo() {
      if (!state.pedido) return window.el('div', {});
      const p = state.pedido;
      const clienteNome = (state.cliente && state.cliente.nome) || '—';
      return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' },
        window.el('div', { class: 'flex flex-wrap items-center gap-3' },
          window.el('div', { class: 'text-2xl font-bold' }, fmtNumero(p.numero)),
          window.pedidoStatusBadge(p.status),
        ),
        window.el('dl', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm' },
          kv('Cliente', clienteNome),
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
      const p = state.pedido;
      const obs = fmtTextoOuEmpty(p.observacao, '');
      // Só mostra o card se houver observação.
      if (!obs || obs === '—') return window.el('div', {});
      return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' },
        window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-2' }, 'Observação geral'),
        window.el('p', { class: 'text-gray-800 whitespace-pre-line' }, obs),
      );
    }

    function buildItens() {
      const itens = state.itens;
      if (itens.length === 0) {
        return window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-gray-500' },
          'Este pedido não possui itens.');
      }
      const body = window.dataTable({
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
        // Sem ações na tabela de itens (read-only).
        actions: [],
      });
      const wrap = window.el('div', {});
      wrap.appendChild(window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-2' },
        'Itens (' + itens.length + ')'));
      wrap.appendChild(body);
      return wrap;
    }

    function placeholderButton(label) {
      return window.el('button', {
        type: 'button',
        class: 'px-4 py-2 rounded-lg border bg-gray-50 text-gray-400 cursor-not-allowed',
        disabled: 'disabled',
        title: 'Em breve',
      }, label);
    }

    function buildActions() {
      const actions = window.el('div', { class: 'bg-white rounded-xl shadow p-4 mt-4 flex flex-wrap gap-2 justify-end' },
        placeholderButton('Confirmar / Receber'),
        placeholderButton('Cancelar pedido'),
        placeholderButton('Editar'),
      );
      return actions;
    }

    function render() {
      const header = buildHeader();
      if (loadingError === 'pedido') {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Pedido não encontrado. Ele pode ter sido removido.'));
        return;
      }
      if (loadingError) {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar dados do pedido (' + loadingError + '). Tente recarregar a página.'));
        return;
      }
      container.replaceChildren(header, buildResumo(), buildDadosGerais(), buildItens(), buildActions());
    }

    await carregar();
    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoDetail = {
    screenPedidoDetalhe: screenPedidoDetalhe,
  };

  // Compatibilidade com matchRoute dinâmico em js/router.js
  window.screenPedidoDetalhe = screenPedidoDetalhe;
})(window);
