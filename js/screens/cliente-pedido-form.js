// =====================================================================
// === SCREENS: CLIENTE PEDIDO FORM ====================================
// Tela cliente `#/cliente/pedidos/novo` — formulário de criação de
// Pedido pelo cliente autenticado.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-CREATE-A
// Escopo: criação cliente de Pedido (status inicial `recebido`).
//   Sem modificar, cancelar ou criar pedido via cliente (apenas
//   nesta fase). Sem expor dados internos, de produção ou
//   administrativos.
//
// Carregar via <script src="js/screens/cliente-pedido-form.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.selectInput
//     / window.textInput / window.formField
//     (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//   - window.CURRENT_USER (js/auth.js)
//
// Writes permitidos nesta fase:
//   - INSERT em `pedidos` (cliente_id, status, prazo_entrega,
//     observacao) — RLS `pedidos_cliente_insert` valida que
//     cliente_id = meu_cliente_id() e status IN ('rascunho',
//     'recebido'). Aqui sempre enviamos `recebido`.
//   - INSERT em `pedido_itens` (pedido_id, modelo_id, metros,
//     observacao, ordem) — RLS `pedido_itens_cliente_insert`
//     valida pedido pertencente ao cliente + status editável.
//   - DELETE de compensação em `pedidos` (somente se itens
//     falharem) — pode falhar por RLS, erro é tratado.
//
// Sem UPDATE/DELETE em `pedido_itens` (não há fluxo de remoção
// nesta fase), sem insert em tabelas de auditoria interna, sem
// mexer em tabelas de produção, sem `functions.invoke`, sem
// `service_role`.
//
// Compatibilidade: window.screenClientePedidoNovo fica disponível
// para o setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  function novoUid() {
    return 'i_' + Math.random().toString(36).slice(2, 10);
  }

  async function screenClientePedidoNovo() {
    var clienteId = window.CURRENT_USER && window.CURRENT_USER.cliente_id;
    var clienteNome = window.CURRENT_USER && window.CURRENT_USER.cliente_nome;

    if (clienteId == null) {
      window.toast('Conta de cliente sem cliente_id vinculado. Contate o suporte.', 'error');
      var errWrap = window.el('div', {},
        window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
          'Sua conta não está vinculada a um cliente. Contate o suporte.'),
        window.el('div', { class: 'mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, '← Voltar para lista')
        )
      );
      var errHeader = window.pageHeader('Novo pedido');
      return window.clienteShellLayout(
        window.el('div', {}, errHeader, errWrap));
    }

    var container = window.el('div', {});

    var modelos = [];
    var loadingError = null;

    var state = {
      prazoEntrega: '',
      observacao: '',
      itens: [
        { uid: novoUid(), modeloId: '', metros: '', observacao: '' },
      ],
    };

    async function carregarDados() {
      var modRes = await window.supa
        .from('modelos')
        .select('id, nome, largura')
        .order('nome');
      if (modRes.error) {
        loadingError = 'modelos';
        window.toast('Erro ao carregar modelos', 'error');
        console.error(modRes.error);
      } else {
        modelos = modRes.data || [];
      }
    }

    function modeloById(id) {
      for (var i = 0; i < modelos.length; i++) {
        if (String(modelos[i].id) === String(id)) return modelos[i];
      }
      return null;
    }

    function modeloLabel(modelo) {
      if (!modelo) return '';
      var w = (typeof modelo.largura === 'number')
        ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
        : String(modelo.largura);
      return modelo.nome + ' · ' + w;
    }

    function buildItemRow(item) {
      var row = window.el('div', {
        class: 'flex flex-wrap items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg',
        'data-uid': item.uid,
      });

      var options = [];
      for (var i = 0; i < modelos.length; i++) {
        options.push({ value: modelos[i].id, label: modeloLabel(modelos[i]) });
      }
      var modeloSel = window.selectInput({
        options: options,
        value: item.modeloId,
        placeholder: 'Modelo...',
      });
      modeloSel.classList.add('flex-1', 'min-w-64');

      var modeloWrap = window.el('div', { class: 'flex-1 min-w-64' }, modeloSel);
      row.appendChild(modeloWrap);

      var metrosInput = window.textInput({
        type: 'number',
        value: item.metros,
        placeholder: '0',
        step: '0.01',
        min: '0.01',
      });
      metrosInput.classList.add('w-32');
      metrosInput.addEventListener('input', function () {
        item.metros = metrosInput.value;
      });
      row.appendChild(window.el('div', {},
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Metros'),
        metrosInput));

      var obsInput = window.textInput({
        value: item.observacao,
        placeholder: 'Observação do item (opcional)',
      });
      obsInput.addEventListener('input', function () {
        item.observacao = obsInput.value;
      });
      row.appendChild(window.el('div', { class: 'flex-1 min-w-48' },
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Observação'),
        obsInput));

      modeloSel.addEventListener('change', function () {
        item.modeloId = modeloSel.value;
      });

      if (state.itens.length > 1) {
        var removeBtn = window.el('button', {
          type: 'button',
          class: 'text-red-600 hover:underline text-sm px-2 py-1',
          onclick: function () {
            state.itens = state.itens.filter(function (i) { return i.uid !== item.uid; });
            render();
          },
        }, 'Remover');
        row.appendChild(removeBtn);
      }
      return row;
    }

    function buildItensSection() {
      var wrap = window.el('div', { class: 'mb-4' });
      wrap.appendChild(window.el('label',
        { class: 'block text-sm font-semibold text-gray-700 mb-2' },
        'Itens do pedido'));
      for (var i = 0; i < state.itens.length; i++) {
        wrap.appendChild(buildItemRow(state.itens[i]));
      }
      var addBtn = window.el('button', {
        type: 'button',
        class: 'text-blue-700 hover:underline text-sm font-semibold',
        onclick: function () {
          state.itens.push({ uid: novoUid(), modeloId: '', metros: '', observacao: '' });
          render();
        },
      }, '+ Adicionar item');
      wrap.appendChild(addBtn);
      return wrap;
    }

    function buildHeader() {
      return window.pageHeader('Novo pedido', [
        {
          label: '← Voltar para lista',
          onclick: function () { window.navigate('#/cliente/pedidos'); },
        },
      ]);
    }

    function buildClienteBadge() {
      var nome = clienteNome || ('Cliente #' + clienteId);
      return window.el('div',
        { class: 'bg-white rounded-xl shadow p-4 mb-4 text-sm text-gray-700' },
        window.el('span', { class: 'font-semibold' }, 'Cliente: '),
        nome,
        window.el('span', { class: 'text-gray-400 ml-2 text-xs' },
          '(vinculado à sua conta)'
        )
      );
    }

    function buildForm() {
      var prazoInput = window.textInput({ type: 'date', value: state.prazoEntrega });
      prazoInput.addEventListener('change', function () {
        state.prazoEntrega = prazoInput.value;
      });

      var obsTextarea = window.el('textarea', {
        rows: 2,
        class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
        placeholder: 'Observação geral do pedido (opcional)',
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', function () {
        state.observacao = obsTextarea.value;
      });

      var saveBtn = window.el('button', {
        type: 'button',
        class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg',
        onclick: function () { salvar(saveBtn); },
      }, 'Enviar pedido');

      var form = window.el('div', { class: 'bg-white rounded-xl shadow p-6 max-w-3xl' },
        window.formField({
          label: 'Prazo desejado',
          input: prazoInput,
          hint: 'Data opcional. Pode ser ajustada depois.',
        }),
        window.formField({
          label: 'Observação geral',
          input: obsTextarea,
          hint: 'Texto livre para o pedido como um todo.',
        }),
        buildItensSection(),
        window.el('div', { class: 'flex justify-end gap-2 pt-4 border-t mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, 'Cancelar'),
          saveBtn,
        ),
      );
      return form;
    }

    async function salvar(btn) {
      if (state.itens.length === 0) {
        window.toast('Adicione ao menos um item.', 'error');
        return;
      }
      for (var i = 0; i < state.itens.length; i++) {
        var it = state.itens[i];
        if (!it.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione um modelo.', 'error');
          return;
        }
        var m = Number(it.metros);
        if (!Number.isFinite(m) || m <= 0) {
          window.toast('Item ' + (i + 1) + ': metros deve ser > 0.', 'error');
          return;
        }
      }

      btn.disabled = true;
      var oldLabel = btn.textContent;
      btn.textContent = 'Enviando...';

      try {
        var pedidoPayload = {
          cliente_id: Number(clienteId),
          status: 'recebido',
        };
        if (state.prazoEntrega) pedidoPayload.prazo_entrega = state.prazoEntrega;
        if (state.observacao) pedidoPayload.observacao = state.observacao;

        var pedidoRes = await window.supa
          .from('pedidos')
          .insert(pedidoPayload)
          .select('id, numero, status')
          .single();

        if (pedidoRes.error || !pedidoRes.data) {
          window.toast('Erro ao criar pedido: ' + (pedidoRes.error && pedidoRes.error.message
            ? pedidoRes.error.message : 'desconhecido'), 'error');
          console.error(pedidoRes.error);
          return;
        }
        var pedidoId = pedidoRes.data.id;

        var itensPayload = [];
        for (var j = 0; j < state.itens.length; j++) {
          var it2 = state.itens[j];
          var row2 = {
            pedido_id: pedidoId,
            modelo_id: Number(it2.modeloId),
            metros: Number(it2.metros),
            ordem: j,
          };
          if (it2.observacao && String(it2.observacao).trim() !== '') {
            row2.observacao = it2.observacao;
          }
          itensPayload.push(row2);
        }

        var itensRes = await window.supa
          .from('pedido_itens')
          .insert(itensPayload)
          .select('id');

        if (itensRes.error) {
          console.error('Erro ao inserir itens, compensando:', itensRes.error);
          try {
            var delRes = await window.supa.from('pedidos').delete().eq('id', pedidoId);
            if (delRes.error) {
              window.toast(
                'Erro: pedido #' + pedidoRes.data.numero + ' criado sem itens e compensação falhou. Contate o suporte.',
                'error'
              );
              console.error('Compensação falhou:', delRes.error);
            } else {
              window.toast('Erro ao inserir itens. Pedido cancelado. Tente novamente.', 'error');
            }
          } catch (e) {
            window.toast(
              'Erro: pedido #' + pedidoRes.data.numero + ' criado sem itens e compensação falhou. Contate o suporte.',
              'error'
            );
            console.error('Compensação threw:', e);
          }
          return;
        }

        window.toast('Pedido #' + pedidoRes.data.numero + ' enviado.', 'success');
        window.navigate('#/cliente/pedidos/' + pedidoId);
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    function render() {
      var header = buildHeader();
      if (loadingError) {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a página.'));
        return;
      }
      container.replaceChildren(header, buildClienteBadge(), buildForm());
    }

    await carregarDados();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoForm = {
    screenClientePedidoNovo: screenClientePedidoNovo,
  };

  window.screenClientePedidoNovo = screenClientePedidoNovo;
})(window);
