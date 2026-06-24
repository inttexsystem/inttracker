// =====================================================================
// === SCREENS: PEDIDO DETAIL ==========================================
// Tela admin do detalhe de um Pedido existente, com ações reais de
// status nesta fase. Rota: `#/pedidos/<uuid>` (parseada por
// js/router.js via matchRoute dinâmico). Botão "Visualizar" da
// listagem `#/pedidos` navega para esta tela.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3B + C3C1
// Escopo: leitura + ações reais restritas de status no Pedido +
//   botão "Editar" FUNCIONAL para status editáveis (rascunho /
//   recebido), navegando para `#/pedidos/<uuid>/editar`.
//
//   Transições de status permitidas nesta fase:
//     - rascunho   → recebido
//     - recebido   → confirmado
//     - rascunho   → cancelado
//     - recebido   → cancelado
//     - confirmado → cancelado
//   Transições proibidas nesta fase:
//     - qualquer status → produzindo (fase futura)
//     - qualquer status → entregue   (fase futura)
//     - cancelado → qualquer outro  (terminal nesta fase)
//     - confirmado → recebido
//     - recebido → rascunho
//
//   Edição de dados gerais fica para C3C1 (`#pedidos/<uuid>/editar`).
//   Edição de itens fica para C3C2. Sem geração de OP, sem lote,
//   sem cliente público, sem token, sem Edge Function, sem RPC.
//
// Carregar via <script src="js/screens/pedido-detail.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedido-form.js, js/pedido-ui.js e
// js/ui.js, e ANTES de <script> principal (boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.dataTable
//     / window.shellLayout / window.ADMIN_MENU / window.confirmDialog
//     (js/ui.js, common.js)
//   - window.RAVATEX_PEDIDO_UI / window.pedidoStatusBadge
//     / window.pedidoStatusLabel / window.corPreviewElement
//     / window.corPreviewHex / window.fmtDataCurta
//     (js/pedido-ui.js)
//   - window.navigate                  (js/router.js)
//   - window.supa                      (js/supabase-client.js)
//
// Writes permitidos nesta fase: APENAS `update` em `pedidos` (campo
// `status` apenas, via RLS admin-only). Sem insert/update/delete em
// `pedido_itens`, sem insert em `pedido_eventos` (fica para fase
// futura), sem mexer em `lotes`/`pedido_eventos`.
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

  // -------------------------------------------------------------------
  // Transições de status permitidas nesta fase.
  // Origem: db/13_pedidos_schema.sql (CHECK status IN ...). Mantém
  //   `pedido` separado de `op` (status `produzindo`/`entregue` ficam
  //   para fases futuras, quando houver vínculo com OP).
  // -------------------------------------------------------------------
  const TRANSITIONS = Object.freeze({
    rascunho:   Object.freeze(['recebido', 'cancelado']),
    recebido:   Object.freeze(['confirmado', 'cancelado']),
    confirmado: Object.freeze(['cancelado']),
    // produzindo, entregue, cancelado: nenhuma transição nesta fase.
    produzindo: Object.freeze([]),
    entregue:   Object.freeze([]),
    cancelado:  Object.freeze([]),
  });

  const ACTION_LABEL = Object.freeze({
    recebido:  'Marcar como recebido',
    confirmado:'Confirmar pedido',
    cancelado: 'Cancelar pedido',
  });

  function canTransition(from, to) {
    if (!from || !to) return false;
    const destinos = TRANSITIONS[from];
    return Array.isArray(destinos) && destinos.indexOf(to) !== -1;
  }

  function nextActionsForStatus(status) {
    const destinos = TRANSITIONS[status] || [];
    return destinos.map(function (t) {
      return { status: t, label: ACTION_LABEL[t] || t };
    });
  }

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

    // -----------------------------------------------------------------
    // alterarStatus: aplica uma transição de status permitida.
    // - Valida origem e destino via canTransition().
    // - Executa APENAS `update` em `pedidos` (campo `status`).
    // - NÃO toca em `pedido_itens`, `pedido_eventos`, `lotes`, OP, etc.
    // - Após sucesso: atualiza state.pedido.status e re-renderiza.
    // - Cancelar pedido: pede confirmação visual antes de aplicar.
    // -----------------------------------------------------------------
    async function alterarStatus(novoStatus, btn) {
      if (!state.pedido) {
        window.toast('Pedido não carregado.', 'error');
        return;
      }
      const statusAtual = state.pedido.status;
      if (!canTransition(statusAtual, novoStatus)) {
        window.toast(
          'Transição não permitida: ' + statusAtual + ' → ' + novoStatus + '.',
          'error'
        );
        return;
      }

      // Helper de "ocupado" para o botão que disparou a ação.
      const oldLabel = btn ? btn.textContent : null;
      const oldDisabled = btn ? btn.disabled : false;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }

      const apply = async function () {
        const r = await window.supa
          .from('pedidos')
          .update({ status: novoStatus })
          .eq('id', pedidoId);
        if (r.error) {
          window.toast(
            'Erro ao atualizar status: ' + (r.error.message || 'desconhecido'),
            'error'
          );
          console.error('pedido-detail: erro ao atualizar status', r.error);
          if (btn) {
            btn.disabled = oldDisabled;
            btn.textContent = oldLabel;
          }
          return;
        }
        // Sucesso: atualiza estado local e re-renderiza.
        state.pedido.status = novoStatus;
        const labelAmigavel = window.pedidoStatusLabel
          ? window.pedidoStatusLabel(novoStatus)
          : novoStatus;
        window.toast('Pedido marcado como ' + labelAmigavel + '.', 'success');
        render();
      };

      // Cancelar exige confirmação visual. As outras transições
      // (recebido, confirmado) são aplicadas direto.
      if (novoStatus === 'cancelado') {
        window.confirmDialog({
          title: 'Cancelar pedido',
          message: 'Tem certeza que deseja cancelar este pedido? '
            + 'Esta ação altera o status para "Cancelado" '
            + 'e não pode ser desfeita nesta fase.',
          confirmLabel: 'Sim, cancelar',
          danger: true,
          onConfirm: apply,
        });
        // Reabilita o botão já — o confirmDialog é assíncrono e
        // a confirmação, se vier, dispara apply() que re-renderiza.
        if (btn) {
          btn.disabled = oldDisabled;
          btn.textContent = oldLabel;
        }
        return;
      }

      await apply();
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

    function placeholderButton(label, title) {
      return window.el('button', {
        type: 'button',
        class: 'px-4 py-2 rounded-lg border bg-gray-50 text-gray-400 cursor-not-allowed',
        disabled: 'disabled',
        title: title || 'Em breve',
      }, label);
    }

    // Botão Editar (C3C1):
    //   - Funcional (navega para `#/pedidos/<uuid>/editar`) quando o
    //     status é editável (rascunho / recebido).
    //   - Desabilitado (placeholder) para os demais status.
    function buildEditButton() {
      const statusAtual = state.pedido ? state.pedido.status : null;
      const editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          class: 'px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId + '/editar'); },
        }, 'Editar');
      }
      const motivo = 'Edição permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar', motivo);
    }

    // Botão Editar itens (C3C2B):
    //   - Funcional (navega para `#/pedidos/<uuid>/itens`) quando o
    //     status é editável (rascunho / recebido).
    //   - Desabilitado (placeholder) para os demais status.
    function buildEditItensButton() {
      const statusAtual = state.pedido ? state.pedido.status : null;
      const editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          class: 'px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId + '/itens'); },
        }, 'Editar itens');
      }
      const motivo = 'Edição de itens permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar itens', motivo);
    }

    function buildActions() {
      // Status terminal ou bloqueado nesta fase: sem ações reais de status.
      const statusAtual = state.pedido ? state.pedido.status : null;
      const proximas = nextActionsForStatus(statusAtual);

      const actions = window.el('div', {
        class: 'bg-white rounded-xl shadow p-4 mt-4 flex flex-wrap gap-2 justify-end',
      });

      // Sem ações reais disponíveis: mostra mensagem informativa.
      if (proximas.length === 0) {
        const info = window.el('div',
          { class: 'text-sm text-gray-500 mr-auto self-center' },
          statusAtual === 'cancelado'
            ? 'Pedido cancelado. Nenhuma transição disponível nesta fase.'
            : statusAtual === 'produzindo' || statusAtual === 'entregue'
              ? 'Status "' + (window.pedidoStatusLabel
                ? window.pedidoStatusLabel(statusAtual)
                : statusAtual) + '" é gerenciado pela OP. Nenhuma ação aqui.'
              : 'Nenhuma ação de status disponível para este pedido.');
        actions.appendChild(info);
      } else {
        for (let i = 0; i < proximas.length; i++) {
          const ac = proximas[i];
          const isCancelar = ac.status === 'cancelado';
          const btn = window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg font-semibold '
              + (isCancelar
                ? 'border border-red-300 text-red-700 hover:bg-red-50'
                : 'bg-blue-700 hover:bg-blue-800 text-white'),
            'data-action': ac.status,
            onclick: function () { alterarStatus(ac.status, btn); },
          }, ac.label);
          actions.appendChild(btn);
        }
      }

      // Editar (dados gerais, C3C1): funcional para rascunho/recebido;
      // placeholder para os demais status.
      actions.appendChild(buildEditButton());
      // Editar itens (C3C2B): funcional para rascunho/recebido;
      // placeholder para os demais status.
      actions.appendChild(buildEditItensButton());
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
