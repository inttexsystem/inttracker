// =====================================================================
// === SCREENS: PEDIDO EDIT =============================================
// Tela admin de edição dos dados gerais de um Pedido existente.
// Rota: `#/pedidos/<uuid>/editar` (parseada por js/router.js via
// matchRoute dinâmico). Botão "Editar" da tela de detalhe
// `#/pedidos/<uuid>` (C3A/C3B) navega para esta tela quando o
// status é editável.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C1
// Escopo: APENAS edição dos dados gerais do Pedido:
//   - cliente_id       (obrigatório)
//   - prazo_entrega    (opcional)
//   - observacao       (opcional)
// Edição de itens, alteração de status, geração de OP, lote e
//   demais campos ficam para fases futuras (C3C2+).
//   Sem Edge Function, sem RPC, sem schema, sem token público.
//
// Regras de edição por status (via window.isPedidoEditavel):
//   - rascunho:  editável
//   - recebido:  editável
//   - confirmado: NÃO editável
//   - cancelado: NÃO editável
//   - produzindo: NÃO editável
//   - entregue:  NÃO editável
//
// Carregar via <script src="js/screens/pedido-edit.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedido-detail.js, js/pedido-ui.js
// e js/ui.js, e ANTES de <script> principal (boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.selectInput
//     / window.textInput / window.formField / window.shellLayout
//     / window.ADMIN_MENU  (js/ui.js, common.js)
//   - window.RAVATEX_PEDIDO_UI / window.isPedidoEditavel
//     / window.pedidoStatusBadge / window.pedidoStatusLabel
//     / window.fmtDataCurta  (js/pedido-ui.js)
//   - window.navigate   (js/router.js)
//   - window.supa       (js/supabase-client.js)
//
// Writes permitidos nesta fase: APENAS `update` em `pedidos` (campos
//   `cliente_id`, `prazo_entrega`, `observacao`). Sem update em
//   `status`/`numero`, sem update em `pedido_itens`, sem insert em
//   `pedido_eventos`, sem mexer em `lotes`. Sem Edge Function, sem
//   service_role, sem token_acesso, sem rota pública.
//
// Compatibilidade: window.screenPedidoEditar e
// window.RAVATEX_SCREENS.pedidoEdit ficam disponíveis para o
// matchRoute de js/router.js.
// =====================================================================

(function (window) {
  'use strict';

  // Regex UUID v4 (case-insensitive) para validação rápida do id
  // antes de mandar para o Supabase. O router já valida o formato,
  // mas esta defesa evita queries inúteis com lixo na URL.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function screenPedidoEditar(pedidoId) {
    // -----------------------------------------------------------------
    // Helpers de UI de erro (UUID inválido, pedido não encontrado,
    // status não editável). Padrão: header + card vermelho + Voltar.
    // -----------------------------------------------------------------
    function errorHeader(title) {
      return window.pageHeader(title || 'Editar Pedido');
    }
    function backToListBtn() {
      return window.el('button', {
        type: 'button',
        class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
        onclick: function () { window.navigate('#/pedidos'); },
      }, '← Voltar para lista');
    }
    function backToDetailBtn(id) {
      return window.el('button', {
        type: 'button',
        class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
        onclick: function () { window.navigate('#/pedidos/' + id); },
      }, '← Voltar para o detalhe');
    }
    function errorShell(headerTitle, message, backBtn) {
      return window.shellLayout(window.ADMIN_MENU,
        window.el('div', {},
          errorHeader(headerTitle),
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            message),
          window.el('div', { class: 'mt-4' }, backBtn)
        )
      );
    }

    // -----------------------------------------------------------------
    // Validação de UUID
    // -----------------------------------------------------------------
    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido inválido.', 'error');
      return errorShell('Editar Pedido',
        'Pedido inválido. Volte para a listagem e tente novamente.',
        backToListBtn());
    }

    const container = window.el('div', {});

    // Estado da tela
    const state = {
      pedido: null,        // { id, numero, data_pedido, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em }
      clientes: [],        // [{ id, nome }]
      clienteId: '',       // estado editável (cliente_id)
      dataPedido: '',      // estado editável (data_pedido, YYYY-MM-DD) — db/89
      prazoEntrega: '',    // estado editável (prazo_entrega, YYYY-MM-DD)
      observacao: '',      // estado editável (observacao)
      loadingError: null,
      blockedStatus: false,
    };

    // -----------------------------------------------------------------
    // Carregamento: pedido + clientes
    // -----------------------------------------------------------------
    async function carregar() {
      // SELECT do pedido (admin-only via RLS).
      const pedidoRes = await window.supa
        .from('pedidos')
        .select('id, numero, data_pedido, status, cliente_id, prazo_entrega, observacao, criado_em, atualizado_em')
        .eq('id', pedidoId)
        .maybeSingle();

      if (pedidoRes.error || !pedidoRes.data) {
        state.loadingError = 'pedido';
        window.toast('Pedido não encontrado.', 'error');
        console.error(pedidoRes.error);
        return;
      }

      state.pedido = pedidoRes.data;
      state.clienteId = pedidoRes.data.cliente_id != null
        ? String(pedidoRes.data.cliente_id) : '';
      state.dataPedido = pedidoRes.data.data_pedido || '';
      state.prazoEntrega = pedidoRes.data.prazo_entrega || '';
      state.observacao = pedidoRes.data.observacao || '';

      // SELECT de clientes para popular o select.
      const cliRes = await window.supa
        .from('clientes')
        .select('id, nome')
        .order('nome');
      if (cliRes.error) {
        state.loadingError = 'clientes';
        window.toast('Erro ao carregar clientes.', 'error');
        console.error(cliRes.error);
        state.clientes = [];
        return;
      }
      state.clientes = cliRes.data || [];
    }

    await carregar();

    // -----------------------------------------------------------------
    // Validação de status editável
    // -----------------------------------------------------------------
    const statusAtual = state.pedido ? state.pedido.status : null;
    const editavel = window.isPedidoEditavel
      ? window.isPedidoEditavel(statusAtual)
      : (statusAtual === 'rascunho' || statusAtual === 'recebido');
    if (state.pedido && !editavel) {
      state.blockedStatus = true;
    }

    // -----------------------------------------------------------------
    // Header + ações
    // -----------------------------------------------------------------
    function buildHeader() {
      const labelPedido = state.pedido
        ? ('Editar Pedido #' + state.pedido.numero)
        : 'Editar Pedido';
      return window.pageHeader(labelPedido, [
        {
          label: '← Voltar para o detalhe',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
        },
      ]);
    }

    function buildStatusBanner() {
      // Banner com status atual + nota de editabilidade.
      if (!state.pedido) return window.el('div', {});
      const s = state.pedido.status;
      const label = window.pedidoStatusLabel ? window.pedidoStatusLabel(s) : s;
      const banner = window.el('div',
        { class: 'bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap items-center gap-3' },
        window.el('div', { class: 'text-sm text-gray-600' }, 'Status atual:'),
        window.pedidoStatusBadge ? window.pedidoStatusBadge(s) : window.el('span', {}, s)
      );
      if (state.blockedStatus) {
        banner.appendChild(window.el('div',
          { class: 'text-sm text-red-700 ml-auto' },
          'Este pedido está em status "' + label + '". '
            + 'A edição dos dados gerais é permitida apenas para '
            + '"Rascunho" e "Recebido".'
        ));
      } else {
        banner.appendChild(window.el('div',
          { class: 'text-sm text-gray-500 ml-auto' },
          'Edição permitida neste status.'
        ));
      }
      return banner;
    }

    function buildForm() {
      if (!state.pedido) return window.el('div', {});

      // Select de cliente (obrigatório).
      const cliSel = window.selectInput({
        options: state.clientes.map(c => ({ value: String(c.id), label: c.nome })),
        value: state.clienteId,
        placeholder: 'Selecione o cliente...',
      });
      cliSel.addEventListener('change', function () { state.clienteId = cliSel.value; });

      // Data do pedido (db/89): data COMERCIAL, obrigatoria, editavel aqui.
      const dataPedidoInput = window.textInput({
        type: 'date',
        value: state.dataPedido,
        placeholder: '',
      });
      dataPedidoInput.setAttribute('data-pedido-data', '1');
      dataPedidoInput.addEventListener('change', function () { state.dataPedido = dataPedidoInput.value; });

      // Numero do pedido: CONTEXTO SOMENTE-LEITURA. Renumerar um Pedido ja
      // criado e proibido e o banco recusa (db/89).
      const numeroInput = window.textInput({
        type: 'text',
        value: state.pedido && state.pedido.numero != null ? String(state.pedido.numero) : '—',
        placeholder: '',
      });
      numeroInput.setAttribute('data-pedido-numero-readonly', '1');
      numeroInput.setAttribute('readonly', 'readonly');
      numeroInput.disabled = true;

      // Prazo de entrega (opcional, date).
      const prazoInput = window.textInput({
        type: 'date',
        value: state.prazoEntrega,
        placeholder: '',
      });
      prazoInput.addEventListener('change', function () { state.prazoEntrega = prazoInput.value; });

      // Observação geral (opcional, textarea).
      const obsTextarea = window.el('textarea', {
        rows: 3,
        class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
        placeholder: 'Observação geral do pedido (opcional)',
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', function () { state.observacao = obsTextarea.value; });

      // Botão Salvar.
      const saveBtn = window.el('button', {
        type: 'button',
        class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg',
        onclick: function () { salvar(saveBtn); },
      }, 'Salvar alterações');

      // Botão Cancelar (volta para o detalhe).
      const cancelBtn = window.el('button', {
        type: 'button',
        class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
        onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
      }, 'Cancelar');

      // Se bloqueado por status, desabilita campos e botão Salvar.
      if (state.blockedStatus) {
        cliSel.disabled = true;
        dataPedidoInput.disabled = true;
        prazoInput.disabled = true;
        obsTextarea.disabled = true;
        saveBtn.disabled = true;
        saveBtn.className = 'px-6 py-2 rounded-lg border bg-gray-50 text-gray-400 cursor-not-allowed font-semibold';
        saveBtn.textContent = 'Edição bloqueada';
      }

      const form = window.el('div', { class: 'bg-white rounded-xl shadow p-6 max-w-3xl' },
        window.el('h2', { class: 'text-sm font-semibold text-gray-700 mb-4' },
          'Dados gerais do pedido'),
        window.formField({ label: 'Cliente', input: cliSel }),
        window.formField({
          label: 'Número do pedido',
          input: numeroInput,
          hint: 'Identidade comercial do pedido. Não pode ser alterada após a criação.',
        }),
        window.formField({
          label: 'Data do pedido',
          input: dataPedidoInput,
          hint: 'Data comercial do pedido. Obrigatória.',
        }),
        window.formField({
          label: 'Prazo de entrega',
          input: prazoInput,
          hint: 'Data opcional. Pode ser ajustada depois.',
        }),
        window.formField({
          label: 'Observação geral',
          input: obsTextarea,
          hint: 'Texto livre para o pedido como um todo.',
        }),
        window.el('div', { class: 'flex justify-end gap-2 pt-4 border-t mt-4' },
          cancelBtn,
          saveBtn,
        ),
      );
      return form;
    }

    function buildItensAviso() {
      // Itens NÃO são editáveis nesta fase. Aviso simples.
      return window.el('div',
        { class: 'bg-white rounded-xl shadow p-4 mb-4 text-sm text-gray-600' },
        'Itens do pedido não são editáveis nesta fase (fica para C3C2). '
          + 'Esta tela altera apenas cliente, prazo de entrega e observação geral.'
      );
    }

    // -----------------------------------------------------------------
    // salvar: valida + aplica update restrito em `pedidos`.
    //   - Bloqueado se status não for editável.
    //   - Bloqueado se cliente não selecionado.
    //   - Payload permitido: cliente_id, data_pedido, prazo_entrega, observacao.
    //   - NÃO atualiza status, numero, item, lote, OP. `numero` e IMUTAVEL: o
    //     banco recusa qualquer renumeracao (db/89 pedidos_numero_immutability_guard).
    //   - Após sucesso, navega de volta para o detalhe.
    // -----------------------------------------------------------------
    async function salvar(btn) {
      if (state.blockedStatus) {
        window.toast('Edição bloqueada para este status.', 'error');
        return;
      }
      if (!state.pedido) {
        window.toast('Pedido não carregado.', 'error');
        return;
      }
      if (!state.clienteId) {
        window.toast('Selecione um cliente.', 'error');
        return;
      }

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      // db/89: `data_pedido` e obrigatoria e NUNCA derivada de `criado_em`.
      if (!state.dataPedido) {
        window.toast('Informe a data do pedido.', 'error');
        btn.disabled = false;
        return;
      }

      // Monta payload com EXATAMENTE os 4 campos editáveis. `numero` jamais
      // entra aqui: renumerar um Pedido existente e proibido.
      const payload = {
        cliente_id: Number(state.clienteId),
        data_pedido: state.dataPedido,
      };
      if (state.prazoEntrega) {
        payload.prazo_entrega = state.prazoEntrega;
      } else {
        payload.prazo_entrega = null;
      }
      if (state.observacao) {
        payload.observacao = state.observacao;
      } else {
        payload.observacao = null;
      }

      try {
        const r = await window.supa
          .from('pedidos')
          .update(payload)
          .eq('id', pedidoId);
        if (r.error) {
          window.toast(
            'Erro ao salvar pedido: ' + (r.error.message || 'desconhecido'),
            'error'
          );
          console.error('pedido-edit: erro ao atualizar', r.error);
          btn.disabled = false;
          btn.textContent = oldLabel;
          return;
        }
        window.toast('Pedido atualizado.', 'success');
        window.navigate('#/pedidos/' + pedidoId);
      } catch (e) {
        window.toast('Erro inesperado ao salvar.', 'error');
        console.error(e);
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    function render() {
      if (state.loadingError === 'pedido') {
        container.replaceChildren(
          buildHeader(),
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Pedido não encontrado. Ele pode ter sido removido.')
        );
        return;
      }
      if (state.loadingError === 'clientes') {
        container.replaceChildren(
          buildHeader(),
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar clientes. Tente recarregar a página.')
        );
        return;
      }
      container.replaceChildren(
        buildHeader(),
        buildStatusBanner(),
        buildItensAviso(),
        buildForm()
      );
    }

    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoEdit = {
    screenPedidoEditar: screenPedidoEditar,
  };

  // Compatibilidade com matchRoute dinâmico em js/router.js
  window.screenPedidoEditar = screenPedidoEditar;
})(window);
