// =====================================================================
// === SCREENS: PEDIDO FORM ============================================
// Tela admin `#/pedidos/novo` — formulário de criação de Pedido.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2
// Escopo: criação admin de Pedido (rascunho). Sem edição, sem
//   detalhe, sem geração de OP, sem lote, sem cliente público, sem
//   token, sem Edge Function.
//
// Carregar via <script src="js/screens/pedido-form.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedidos-list.js, js/pedido-ui.js e
// js/ui.js, e ANTES do <script> inline principal (compatibilidade com
// o setRoutes registrado em js/boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.selectInput
//     / window.textInput / window.formField / window.shellLayout
//     / window.ADMIN_MENU                       (js/ui.js, common.js)
//   - window.RAVATEX_PEDIDO_UI / window.corPreviewElement
//     / window.pedidoStatusBadge                (js/pedido-ui.js)
//   - window.navigate                           (js/router.js)
//   - window.supa                              (js/supabase-client.js)
//
// Limitações conhecidas (documentadas no plano de release):
//   - Sem RPC/transação atômica: a gravação faz 1 INSERT em `pedidos`
//     e N INSERTs em `pedido_itens`. Se algum item falhar, o pedido
//     criado fica "órfão" e é compensado por um DELETE manual do
//     próprio pedido. Não usar service_role. Não usar Edge Function.
// =====================================================================

(function (window) {
  'use strict';

  async function screenPedidoNovo() {
    const container = window.el('div', {});

    let clientes = [];
    let modelos = [];
    let loadingError = null;

    // Estado do formulário
    const state = {
      clienteId: '',
      prazoEntrega: '',
      observacao: '',
      itens: [
        { uid: novoUid(), modeloId: '', metros: '', observacao: '' },
      ],
    };

    function novoUid() {
      return 'i_' + Math.random().toString(36).slice(2, 10);
    }

    async function carregarDados() {
      const [cliRes, modRes] = await Promise.all([
        window.supa.from('clientes').select('id, nome').order('nome'),
        window.supa
          .from('modelos')
          .select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)')
          .order('nome'),
      ]);
      if (cliRes.error) {
        loadingError = 'clientes';
        window.toast('Erro ao carregar clientes', 'error');
        console.error(cliRes.error);
      } else {
        clientes = cliRes.data || [];
      }
      if (modRes.error) {
        loadingError = loadingError || 'modelos';
        window.toast('Erro ao carregar modelos', 'error');
        console.error(modRes.error);
      } else {
        modelos = modRes.data || [];
      }
    }

    function modeloById(id) {
      return modelos.find(m => String(m.id) === String(id)) || null;
    }

    function corResumo(modelo) {
      if (!modelo) return '';
      const c1 = modelo.cor_1 && modelo.cor_1.nome ? modelo.cor_1.nome : '—';
      const c2 = modelo.cor_2 && modelo.cor_2.nome ? modelo.cor_2.nome : '—';
      return `${c1}/${c2}`;
    }

    function modeloLabel(modelo) {
      if (!modelo) return '';
      const w = (typeof modelo.largura === 'number')
        ? modelo.largura.toFixed(2).replace('.', ',') + 'm'
        : String(modelo.largura);
      return `${modelo.nome} · ${corResumo(modelo)} · ${w}`;
    }

    function buildItemRow(item) {
      const row = window.el('div', {
        class: 'flex flex-wrap items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg',
        'data-uid': item.uid,
      });

      // Select de modelo (com preview ao lado)
      const modeloSel = window.selectInput({
        options: modelos.map(m => ({ value: m.id, label: modeloLabel(m) })),
        value: item.modeloId,
        placeholder: 'Modelo...',
      });
      modeloSel.classList.add('flex-1', 'min-w-64');

      // Slot fixo de preview (filho direto de row) — não é removido
      // nem reinserido em posição variável. Atualizado via updatePreview().
      const previewSlot = window.el('div', { 'data-preview-slot': '1' });
      function updatePreview() {
        previewSlot.replaceChildren();
        const m = modeloById(item.modeloId);
        if (m && m.cor_1 && window.corPreviewElement) {
          previewSlot.appendChild(window.corPreviewElement(m.cor_1.nome));
        }
      }

      modeloSel.addEventListener('change', () => {
        item.modeloId = modeloSel.value;
        updatePreview();
      });
      row.appendChild(window.el('div', { class: 'flex-1 min-w-64' }, modeloSel));

      // Inicializa preview com o modelo atual (se houver)
      updatePreview();
      row.appendChild(previewSlot);

      // Input de metros
      const metrosInput = window.textInput({
        type: 'number',
        value: item.metros,
        placeholder: '0',
        step: '0.01',
      });
      metrosInput.classList.add('w-32');
      metrosInput.addEventListener('input', () => {
        item.metros = metrosInput.value;
      });
      row.appendChild(window.el('div', {},
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Metros'),
        metrosInput));

      // Observação do item (opcional)
      const obsInput = window.textInput({
        value: item.observacao,
        placeholder: 'Observação do item (opcional)',
      });
      obsInput.addEventListener('input', () => {
        item.observacao = obsInput.value;
      });
      row.appendChild(window.el('div', { class: 'flex-1 min-w-48' },
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Observação'),
        obsInput));

      // Botão remover (só se houver mais de 1 item)
      if (state.itens.length > 1) {
        const removeBtn = window.el('button', {
          type: 'button',
          class: 'text-red-600 hover:underline text-sm px-2 py-1',
          onclick: () => {
            state.itens = state.itens.filter(i => i.uid !== item.uid);
            render();
          },
        }, 'Remover');
        row.appendChild(removeBtn);
      }
      return row;
    }

    function buildItensSection() {
      const wrap = window.el('div', { class: 'mb-4' });
      wrap.appendChild(window.el('label',
        { class: 'block text-sm font-semibold text-gray-700 mb-2' },
        'Itens do pedido'));
      for (const item of state.itens) {
        wrap.appendChild(buildItemRow(item));
      }
      const addBtn = window.el('button', {
        type: 'button',
        class: 'text-blue-700 hover:underline text-sm font-semibold',
        onclick: () => {
          state.itens.push({ uid: novoUid(), modeloId: '', metros: '', observacao: '' });
          render();
        },
      }, '+ Adicionar item');
      wrap.appendChild(addBtn);
      return wrap;
    }

    function buildHeader() {
      return window.pageHeader('Novo Pedido', [
        {
          label: '← Voltar para lista',
          onclick: () => window.navigate('#/pedidos'),
        },
      ]);
    }

    function buildForm() {
      const cliSel = window.selectInput({
        options: clientes.map(c => ({ value: c.id, label: c.nome })),
        value: state.clienteId,
        placeholder: 'Selecione o cliente...',
      });
      cliSel.addEventListener('change', () => { state.clienteId = cliSel.value; });

      const prazoInput = window.textInput({ type: 'date', value: state.prazoEntrega });
      prazoInput.addEventListener('change', () => { state.prazoEntrega = prazoInput.value; });

      const obsTextarea = window.el('textarea', {
        rows: 2,
        class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
        placeholder: 'Observação geral do pedido (opcional)',
      });
      obsTextarea.value = state.observacao;
      obsTextarea.addEventListener('input', () => { state.observacao = obsTextarea.value; });

      const saveBtn = window.el('button', {
        type: 'button',
        class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg',
        onclick: () => salvar(saveBtn, 'rascunho'),
      }, 'Salvar rascunho');

      const form = window.el('div', { class: 'bg-white rounded-xl shadow p-6 max-w-3xl' },
        window.formField({ label: 'Cliente', input: cliSel }),
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
        buildItensSection(),
        window.el('div', { class: 'flex justify-end gap-2 pt-4 border-t mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded-lg border hover:bg-gray-50',
            onclick: () => window.navigate('#/pedidos'),
          }, 'Cancelar'),
          saveBtn,
        ),
      );
      return form;
    }

    async function salvar(btn, status) {
      // Validação cliente-side
      if (!state.clienteId) {
        window.toast('Selecione um cliente.', 'error');
        return;
      }
      if (state.itens.length === 0) {
        window.toast('Adicione ao menos um item.', 'error');
        return;
      }
      for (const [i, item] of state.itens.entries()) {
        if (!item.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione um modelo.', 'error');
          return;
        }
        const m = Number(item.metros);
        if (!Number.isFinite(m) || m <= 0) {
          window.toast('Item ' + (i + 1) + ': metros deve ser > 0.', 'error');
          return;
        }
      }

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      try {
        // 1. Inserir pedido
        const pedidoPayload = {
          cliente_id: Number(state.clienteId),
          status: status,
        };
        if (state.prazoEntrega) pedidoPayload.prazo_entrega = state.prazoEntrega;
        if (state.observacao) pedidoPayload.observacao = state.observacao;

        const pedidoRes = await window.supa
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
        const pedidoId = pedidoRes.data.id;

        // 2. Inserir itens
        const itensPayload = state.itens.map((item, idx) => ({
          pedido_id: pedidoId,
          modelo_id: Number(item.modeloId),
          metros: Number(item.metros),
          ordem: idx,
          observacao: item.observacao || null,
        }));
        const itensRes = await window.supa
          .from('pedido_itens')
          .insert(itensPayload)
          .select('id');

        if (itensRes.error) {
          // Compensar: remover o pedido órfão
          console.error('Erro ao inserir itens, compensando:', itensRes.error);
          const delRes = await window.supa.from('pedidos').delete().eq('id', pedidoId);
          if (delRes.error) {
            window.toast(
              'Erro grave: pedido #' + pedidoRes.data.numero + ' criado sem itens e não compensado. Contate suporte.',
              'error'
            );
            console.error('Compensação falhou:', delRes.error);
          } else {
            window.toast('Erro ao inserir itens. Pedido cancelado. Tente novamente.', 'error');
          }
          return;
        }

        // Sucesso
        window.toast('Pedido #' + pedidoRes.data.numero + ' salvo como ' + status + '.', 'success');
        window.navigate('#/pedidos');
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    }

    function render() {
      const header = buildHeader();
      if (loadingError) {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar dados de ' + loadingError + '. Tente recarregar a página.'));
        return;
      }
      const form = buildForm();
      container.replaceChildren(header, form);
    }

    await carregarDados();
    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoForm = {
    screenPedidoNovo,
  };

  // Compatibilidade com setRoutes em boot.js
  window.screenPedidoNovo = screenPedidoNovo;
})(window);
