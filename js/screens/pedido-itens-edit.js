// =====================================================================
// === SCREENS: PEDIDO ITENS EDIT ======================================
// Tela admin de edição dos itens de um Pedido
// (C3C2B + C3C2C1 + C3C2C2).
// Rota: `#/pedidos/<uuid>/itens` (parseada por js/router.js via
// matchRoute dinâmico). Botão "Editar itens" da tela de detalhe
// `#/pedidos/<uuid>` (C3A/C3B/C3C1) navega para esta tela quando
// o status é editável.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C2
// Escopo: edição de `modelo_id`, `metros`, `observacao` em
//   itens JÁ EXISTENTES (C3C2B) + ADICIONAR novos itens
//   (C3C2C1) + REMOVER itens existentes (C3C2C2).
//   SEM reordenar manualmente, SEM editar `largura`/`cor_1_id`/
//   `cor_2_id` (overrides opcionais ficam para C3C2D), SEM
//   alterar status (fica para C3B já entregue), SEM mexer em
//   dados gerais (fica para C3C1 já entregue), SEM geração de
//   OP, SEM lote, SEM cliente público, SEM token, SEM Edge
//   Function, SEM RPC, SEM schema.
//
//   Itens novos: criados no estado local com flag `isNew: true`,
//   botão "Descartar novo item" (apenas local, antes de salvar).
//
//   Itens existentes removidos: clique em "Remover item" abre
//   `window.confirmDialog`; após confirmar, item é removido do
//   `state.itens` e seu `dbId` vai para `state.deletedDbIds`
//   (remoção aplicada apenas no `salvar()` via DELETE em
//   `pedido_itens` com `.eq('id', dbId).eq('pedido_id', pedidoId)`).
//   Mínimo de 1 item no Pedido é garantido: `marcarParaRemocao`
//   bloqueia se a remoção deixaria 0 itens.
//
// Regras de edição por status (via window.isPedidoEditavel):
//   - rascunho:  editável
//   - recebido:  editável
//   - confirmado: NÃO editável
//   - cancelado: NÃO editável
//   - produzindo: NÃO editável
//   - entregue:  NÃO editável
//
// Carregar via <script src="js/screens/pedido-itens-edit.js?v=...></script>
// no <head>, DEPOIS de js/screens/pedido-edit.js, js/pedido-ui.js
// e js/ui.js, e ANTES de <script> principal (boot.js).
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader / window.selectInput
//     / window.textInput / window.formField / window.shellLayout
//     / window.ADMIN_MENU / window.confirmDialog  (js/ui.js, common.js)
//   - window.RAVATEX_PEDIDO_UI / window.isPedidoEditavel
//     / window.pedidoStatusBadge / window.pedidoStatusLabel
//     / window.corPreviewElement / window.fmtDataCurta
//     (js/pedido-ui.js)
//   - window.navigate   (js/router.js)
//   - window.supa       (js/supabase-client.js)
//
// Writes permitidos nesta fase:
//   - `update` em `pedido_itens` (campos `modelo_id`, `metros`,
//     `observacao`) para itens existentes NÃO marcados para
//     remoção.
//   - `insert` em `pedido_itens` (campos `pedido_id`, `modelo_id`,
//     `metros`, `observacao`, `ordem`) para itens novos.
//   - `delete` em `pedido_itens` (`.eq('id', dbId).eq('pedido_id',
//     pedidoId)`) para itens marcados para remoção.
//   Sem update em `pedidos`, sem `pedido_eventos`, sem mexer em
//   `lotes`. Sem Edge Function, sem service_role, sem token_acesso,
//   sem rota pública.
//
// Limitação documentada: sem transação/RPC. Se uma etapa falhar
//   (update/insert/delete), etapas anteriores podem ter sido
//   aplicadas. Sem compensação automática nesta fase. Usuário
//   re-edita e tenta novamente.
//
// Compatibilidade: window.screenPedidoItensEditar e
// window.RAVATEX_SCREENS.pedidoItensEdit ficam disponíveis para o
// matchRoute de js/router.js.
// =====================================================================

(function (window) {
  'use strict';

  // Regex UUID v4 (case-insensitive) para validação rápida do id
  // antes de mandar para o Supabase. O router já valida o formato,
  // mas esta defesa evita queries inúteis com lixo na URL.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Gera uid local para controle de UI (não usado para update — o
  // update usa item.dbId, o UUID real do banco).
  function novoUid() {
    return 'i_' + Math.random().toString(36).slice(2, 10);
  }

  function fmtNumero(n) {
    if (n == null) return '—';
    return '#' + n;
  }

  async function screenPedidoItensEditar(pedidoId) {
    // -----------------------------------------------------------------
    // Helpers de UI de erro (UUID inválido, pedido não encontrado,
    // status não editável). Padrão: header + card vermelho + Voltar.
    // -----------------------------------------------------------------
    function errorHeader(title) {
      return window.pageHeader(title || 'Editar Itens do Pedido');
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
      return errorShell('Editar Itens do Pedido',
        'Pedido inválido. Volte para a listagem e tente novamente.',
        backToListBtn());
    }

    const container = window.el('div', {});

    // Estado da tela
    // - pedido: { id, numero, status }
    // - itens: [{ dbId, uid, modeloId, metros, observacao, isNew, markedForDeletion }]
    //   * dbId é o UUID real do banco (null para itens novos)
    //   * isNew é true para itens adicionados nesta sessão
    //   * markedForDeletion é true para itens EXISTENTES marcados
    //     para remoção nesta sessão (C3C2C2). A remoção só é
    //     aplicada no `salvar()` via DELETE em `pedido_itens`
    //     com `.eq('id', dbId).eq('pedido_id', pedidoId)`. Até
    //     salvar, o item permanece no array e pode ser restaurado
    //     via `desfazerRemocao()`.
    //   * uid é o identificador local de UI
    // - modelos: [{ id, nome, largura, cor_1_id, cor_2_id }]
    // - cores: { [id]: { id, nome } }
    const state = {
      pedido: null,
      itens: [],
      modelos: [],
      coresById: {},
      loadingError: null,
      blockedStatus: false,
      noItems: false,
    };

    // -----------------------------------------------------------------
    // Carregamento: pedido + itens + modelos + cores
    // -----------------------------------------------------------------
    async function carregar() {
      // SELECT do pedido (apenas campos necessários para a tela).
      const pedidoRes = await window.supa
        .from('pedidos')
        .select('id, numero, status')
        .eq('id', pedidoId)
        .maybeSingle();
      if (pedidoRes.error || !pedidoRes.data) {
        state.loadingError = 'pedido';
        window.toast('Pedido não encontrado.', 'error');
        console.error(pedidoRes.error);
        return;
      }
      state.pedido = pedidoRes.data;

      // SELECT de itens existentes do pedido (inclui join com modelo
      // para exibir preview/label).
      const itensRes = await window.supa
        .from('pedido_itens')
        .select('id, pedido_id, modelo_id, metros, largura, cor_1_id, cor_2_id, observacao, ordem')
        .eq('pedido_id', pedidoId)
        .order('ordem', { ascending: true });
      if (itensRes.error) {
        state.loadingError = 'itens';
        window.toast('Erro ao carregar itens do pedido.', 'error');
        console.error(itensRes.error);
        return;
      }
      const itensDb = itensRes.data || [];
      state.itens = itensDb.map(function (it) {
        return {
          dbId: it.id,                                 // UUID real do banco
          uid: novoUid(),                              // uid local para UI
          modeloId: it.modelo_id != null ? String(it.modelo_id) : '',
          metros: it.metros != null ? String(it.metros) : '',
          observacao: it.observacao || '',
          isNew: false,                               // item existente
          markedForDeletion: false,                   // C3C2C2: removido pelo usuário?
        };
      });
      if (state.itens.length === 0) {
        state.noItems = true;
      }

      // SELECT de modelos (para o select de modelo_id).
      const modRes = await window.supa
        .from('modelos')
        .select('id, nome, largura, cor_1_id, cor_2_id')
        .order('nome');
      if (modRes.error) {
        state.loadingError = 'modelos';
        window.toast('Erro ao carregar modelos.', 'error');
        console.error(modRes.error);
        state.modelos = [];
        return;
      }
      state.modelos = modRes.data || [];

      // Coleta IDs de cor referenciadas (dos itens override + dos modelos)
      // para buscar nomes para o preview.
      const corIds = [];
      for (let i = 0; i < itensDb.length; i++) {
        if (itensDb[i].cor_1_id) corIds.push(itensDb[i].cor_1_id);
        if (itensDb[i].cor_2_id) corIds.push(itensDb[i].cor_2_id);
      }
      for (let i = 0; i < state.modelos.length; i++) {
        const m = state.modelos[i];
        if (m.cor_1_id) corIds.push(m.cor_1_id);
        if (m.cor_2_id) corIds.push(m.cor_2_id);
      }
      const corIdsUniq = Array.from(new Set(corIds.filter(function (x) { return x != null; })));
      if (corIdsUniq.length > 0) {
        const corRes = await window.supa
          .from('cores')
          .select('id, nome')
          .in('id', corIdsUniq);
        if (corRes.error) {
          console.error('pedido-itens-edit: erro ao carregar cores', corRes.error);
        } else {
          state.coresById = Object.fromEntries(
            (corRes.data || []).map(function (c) { return [c.id, c]; })
          );
        }
      }
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
    // Helpers
    // -----------------------------------------------------------------
    function modeloById(id) {
      if (id == null) return null;
      return state.modelos.find(function (m) {
        return String(m.id) === String(id);
      }) || null;
    }

    function modeloLabel(modelo) {
      if (!modelo) return '—';
      const w = (typeof modelo.largura === 'number')
        ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
        : (modelo.largura != null ? String(modelo.largura) : '—');
      const c1 = (state.coresById[modelo.cor_1_id] && state.coresById[modelo.cor_1_id].nome) || '—';
      const c2 = (state.coresById[modelo.cor_2_id] && state.coresById[modelo.cor_2_id].nome) || '—';
      return modelo.nome + ' · ' + c1 + '/' + c2 + ' · ' + w;
    }

    // Cor 1 efetiva: override do item OU do modelo.
    function itemCor1Id(item) {
      const it = state.itens.find(function (x) { return x.uid === item.uid; });
      // Como item já é o objeto do state, podemos usar direto:
      // Mas recebemos o item param direto, então buscamos o db.
      return null;
    }

    function buildItemRow(item) {
      // Itens novos têm visual distinto (borda tracejada + label "Novo")
      // para deixar claro que ainda não foram salvos.
      // Itens existentes marcados para remoção (C3C2C2) têm
      // visual "riscado" (borda tracejada vermelha + opacidade) e
      // mostram label "Será removido ao salvar".
      const isNew = !!item.isNew;
      const isMarked = !!item.markedForDeletion;
      const row = window.el('div', {
        class: 'flex flex-wrap items-end gap-2 mb-3 p-3 rounded-lg '
          + (isMarked
            ? 'bg-red-50 border border-dashed border-red-300 opacity-70'
            : (isNew
              ? 'bg-blue-50 border border-dashed border-blue-300'
              : 'bg-gray-50')),
        'data-uid': item.uid,
        'data-db-id': item.dbId,
        'data-is-new': isNew ? '1' : '0',
        'data-marked-deletion': isMarked ? '1' : '0',
      });

      // Label "Será removido ao salvar" para itens existentes
      // marcados (C3C2C2).
      if (isMarked) {
        row.appendChild(window.el('div', { class: 'w-full mb-1' },
          window.el('span',
            { class: 'inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700' },
            'Será removido ao salvar'
          )
        ));
      } else if (isNew) {
        // Label "Novo" para itens ainda não salvos.
        row.appendChild(window.el('div', { class: 'w-full mb-1' },
          window.el('span',
            { class: 'inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700' },
            'Novo (não salvo)'
          )
        ));
      }

      // Select de modelo.
      const modeloSel = window.selectInput({
        options: state.modelos.map(function (m) {
          return { value: String(m.id), label: modeloLabel(m) };
        }),
        value: item.modeloId,
        placeholder: 'Modelo...',
      });
      modeloSel.classList.add('flex-1', 'min-w-64');
      modeloSel.addEventListener('change', function () {
        item.modeloId = modeloSel.value;
      });
      row.appendChild(window.el('div', { class: 'flex-1 min-w-64' }, modeloSel));

      // Input de metros.
      const metrosInput = window.textInput({
        type: 'number',
        value: item.metros,
        placeholder: '0',
        step: '0.01',
      });
      metrosInput.classList.add('w-32');
      metrosInput.addEventListener('input', function () {
        item.metros = metrosInput.value;
      });
      row.appendChild(window.el('div', {},
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Metros'),
        metrosInput));

      // Observação do item (opcional).
      const obsInput = window.textInput({
        value: item.observacao,
        placeholder: 'Observação do item (opcional)',
      });
      obsInput.addEventListener('input', function () {
        item.observacao = obsInput.value;
      });
      row.appendChild(window.el('div', { class: 'flex-1 min-w-48' },
        window.el('label', { class: 'block text-xs text-gray-500 mb-1' }, 'Observação'),
        obsInput));

      // Botões de descarte/remoção/desfazer — distinguem 3 casos:
      //  1. isNew=true: "Descartar novo item" (remove do estado
      //     local apenas; não toca no banco).
      //  2. !isNew && !markedForDeletion: "Remover item" (marca
      //     para remoção local; DELETE só no `salvar()`).
      //  3. !isNew && markedForDeletion: "Desfazer remoção"
      //     (limpa a flag local; item volta a ser normal).
      if (isMarked) {
        const undoBtn = window.el('button', {
          type: 'button',
          class: 'text-blue-600 hover:underline text-sm px-2 py-1',
          'data-action': 'undo-delete',
          onclick: function () { desfazerRemocao(item.uid); },
        }, 'Desfazer remoção');
        row.appendChild(undoBtn);
      } else if (isNew) {
        const discardBtn = window.el('button', {
          type: 'button',
          class: 'text-red-600 hover:underline text-sm px-2 py-1',
          'data-action': 'discard-new',
          onclick: function () { descartarItemNovo(item.uid); },
        }, 'Descartar novo item');
        row.appendChild(discardBtn);
      } else {
        const removeBtn = window.el('button', {
          type: 'button',
          class: 'text-red-600 hover:underline text-sm px-2 py-1',
          'data-action': 'remove-existing',
          onclick: function () { marcarParaRemocao(item.uid); },
        }, 'Remover item');
        row.appendChild(removeBtn);
      }

      // Se bloqueado por status, desabilita campos (read-only).
      // Para itens novos, desabilitar é defensivo (não deveriam existir
      // em status bloqueado porque o botão "+ Adicionar item" não
      // aparece, mas cobre o caso de race condition).
      if (state.blockedStatus) {
        modeloSel.disabled = true;
        metrosInput.disabled = true;
        obsInput.disabled = true;
      }
      return row;
    }

    // -----------------------------------------------------------------
    // adicionarItem: cria novo item no estado local com isNew=true.
    // Só funciona se status for editável. Re-renderiza a lista.
    // -----------------------------------------------------------------
    function adicionarItem() {
      if (state.blockedStatus) {
        window.toast('Adição de item bloqueada para este status.', 'error');
        return;
      }
      if (!state.pedido) {
        window.toast('Pedido não carregado.', 'error');
        return;
      }
      state.itens.push({
        dbId: null,
        uid: novoUid(),
        modeloId: '',
        metros: '',
        observacao: '',
        isNew: true,
        markedForDeletion: false,
      });
      render();
    }

    // -----------------------------------------------------------------
    // descartarItemNovo: remove um item novo (ainda não salvo) do
    // estado local. Não afeta itens existentes no banco. Só permite
    // descartar itens com isNew=true.
    // -----------------------------------------------------------------
    function descartarItemNovo(uid) {
      const idx = state.itens.findIndex(function (it) { return it.uid === uid; });
      if (idx === -1) return;
      if (!state.itens[idx].isNew) {
        // Defesa: não permite descartar item existente nesta fase.
        return;
      }
      state.itens.splice(idx, 1);
      // Se era o último item e não há mais nada, atualiza flag noItems.
      if (state.itens.length === 0) {
        state.noItems = true;
      }
      render();
    }

    // -----------------------------------------------------------------
    // marcarParaRemocao: marca um item EXISTENTE (isNew=false) para
    // remoção local (C3C2C2). A remoção só é aplicada no `salvar()`
    // via DELETE em `pedido_itens` com `.eq('id', dbId).eq('pedido_id',
    // pedidoId)`. Bloqueia se a remoção deixaria 0 itens (mínimo 1).
    // Bloqueia se status não for editável. Abre `window.confirmDialog`
    // antes de marcar.
    // -----------------------------------------------------------------
    function marcarParaRemocao(uid) {
      const idx = state.itens.findIndex(function (it) { return it.uid === uid; });
      if (idx === -1) return;
      const it = state.itens[idx];
      // Defesa: apenas itens existentes podem ser marcados.
      if (it.isNew) return;
      // Já marcado: no-op.
      if (it.markedForDeletion) return;
      // Bloqueio por status.
      if (state.blockedStatus) {
        window.toast('Remoção bloqueada para este status.', 'error');
        return;
      }
      // Bloqueio por mínimo: conta itens NÃO marcados. Se a remoção
      // deixaria 0, bloqueia.
      const naoMarcados = state.itens.filter(function (x) {
        return !x.markedForDeletion;
      }).length;
      if (naoMarcados <= 1) {
        window.toast('Pedido precisa ter pelo menos 1 item.', 'error');
        return;
      }
      // Confirmação visual via `window.confirmDialog` (C3B padrão).
      if (typeof window.confirmDialog === 'function') {
        window.confirmDialog({
          title: 'Remover item do pedido?',
          message: 'O item será excluído apenas ao salvar as alterações. '
            + 'Para reverter, clique em "Desfazer remoção" antes de salvar.',
          confirmLabel: 'Remover item',
          danger: true,
          onConfirm: function () {
            it.markedForDeletion = true;
            render();
          },
        });
      } else {
        // Fallback: confirma via `window.confirm` se `confirmDialog`
        // não estiver disponível (defesa). Em produção `confirmDialog`
        // é provido por `js/ui.js` e está sempre presente.
        if (window.confirm('Remover item do pedido? Esta ação só será '
            + 'aplicada ao salvar.')) {
          it.markedForDeletion = true;
          render();
        }
      }
    }

    // -----------------------------------------------------------------
    // desfazerRemocao: limpa a flag `markedForDeletion` de um item
    // existente (C3C2C2). Reverte uma marcação de remoção feita nesta
    // sessão, sem efeitos no banco. Só faz sentido para itens
    // existentes (!isNew).
    // -----------------------------------------------------------------
    function desfazerRemocao(uid) {
      const it = state.itens.find(function (x) { return x.uid === uid; });
      if (!it) return;
      if (it.isNew) return;     // defesa
      if (!it.markedForDeletion) return; // no-op
      it.markedForDeletion = false;
      render();
    }

    function buildItensList() {
      const wrap = window.el('div', { class: 'mb-4' });
      wrap.appendChild(window.el('h2',
        { class: 'text-sm font-semibold text-gray-700 mb-2' },
        'Itens do pedido (' + state.itens.length + ') — edite modelo, metros e observação; ou adicione um novo item.'));
      for (let i = 0; i < state.itens.length; i++) {
        wrap.appendChild(buildItemRow(state.itens[i]));
      }
      // Botão "+ Adicionar item" — visível apenas se status editável.
      // Em status bloqueado, não permite criar novos itens nesta
      // sessão (decisão defensiva de C3C2C1).
      if (!state.blockedStatus) {
        const addBtn = window.el('button', {
          type: 'button',
          class: 'text-blue-700 hover:underline text-sm font-semibold',
          'data-action': 'add-item',
          onclick: function () { adicionarItem(); },
        }, '+ Adicionar item');
        wrap.appendChild(addBtn);
      }
      return wrap;
    }

    // -----------------------------------------------------------------
    // Header + banner de status
    // -----------------------------------------------------------------
    function buildHeader() {
      const labelPedido = state.pedido
        ? ('Editar Itens do Pedido #' + state.pedido.numero)
        : 'Editar Itens do Pedido';
      return window.pageHeader(labelPedido, [
        {
          label: '← Voltar para o detalhe',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
        },
      ]);
    }

    function buildStatusBanner() {
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
            + 'A edição de itens é permitida apenas para "Rascunho" e "Recebido".'
        ));
      } else {
        banner.appendChild(window.el('div',
          { class: 'text-sm text-gray-500 ml-auto' },
          'Edição permitida neste status. Você pode alterar modelo, '
            + 'metros e observação dos itens existentes, adicionar '
            + 'novos itens e remover itens existentes.'
        ));
      }
      return banner;
    }

    function buildItensAviso() {
      // Aviso simples: escopo desta fase (C3C2C2).
      return window.el('div',
        { class: 'bg-white rounded-xl shadow p-4 mb-4 text-sm text-gray-600' },
        'Nesta fase (C3C2C2) você pode editar modelo, metros e '
          + 'observação dos itens existentes, adicionar novos itens '
          + 'e remover itens existentes. Reordenação manual e '
          + 'overrides de largura/cor ficam para fases seguintes.'
      );
    }

    function buildNoItemsMessage() {
      return window.el('div',
        { class: 'bg-white rounded-xl shadow p-6 text-center text-gray-500' },
        'Pedido sem itens cadastrados.');
    }

    // -----------------------------------------------------------------
    // salvar: valida + aplica writes em `pedido_itens`.
    //   - Bloqueado se status não for editável.
    //   - Bloqueado se não houver itens ativos (não marcados para
    //     remoção) — mínimo 1 (defesa; `marcarParaRemocao` também
    //     pré-checa).
    //   - Para cada item ativo, valida modelo_id e metros > 0.
    //   - Separa:
    //     * existingItems: itens com isNew=false (atualizar no banco)
    //     * newItems:      itens com isNew=true (inserir no banco)
    //     * removedItems:  itens com markedForDeletion=true (deletar
    //                       do banco; existem no banco, isNew=false)
    //   - Sequência:
    //     1) UPDATE de `existingItems` (sequencial, mesmo padrão C3C2B):
    //        `.update({ modelo_id, metros, observacao })
    //         .eq('id', dbId).eq('pedido_id', pedidoId)`.
    //     2) INSERT em batch de `newItems` com 5 chaves
    //        (pedido_id, modelo_id, metros, observacao, ordem).
    //        Ordem atribuída como `existingItems.length + i`.
    //     3) DELETE de `removedItems` (sequencial) com
    //        `.delete().eq('id', dbId).eq('pedido_id', pedidoId)`.
    //   - Sem update em `pedidos`, sem insert em `pedido_eventos`,
    //     sem mexer em `lotes`. Sem Edge Function, sem service_role,
    //     sem token_acesso.
    //   - Limitação documentada: sem transação/RPC. Se uma etapa
    //     falhar, etapas anteriores podem ter sido aplicadas. Sem
    //     compensação automática nesta fase. Usuário re-edita e
    //     tenta novamente.
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

      // Separa: ativos (sobreviverão), removidos (marcados para delete).
      // Itens ativos: !markedForDeletion. Itens removidos: marcados
      // (só faz sentido para isNew=false; defesa explícita).
      const activeItems = state.itens.filter(function (it) {
        return !it.markedForDeletion;
      });
      const removedItems = state.itens.filter(function (it) {
        return it.markedForDeletion && !it.isNew;
      });

      if (activeItems.length === 0) {
        window.toast('Pedido sem itens. Nada para salvar.', 'error');
        return;
      }

      // Validação cliente-side por item ATIVO.
      for (let i = 0; i < activeItems.length; i++) {
        const it = activeItems[i];
        if (!it.modeloId) {
          window.toast('Item ' + (i + 1) + ': selecione um modelo.', 'error');
          return;
        }
        const m = Number(it.metros);
        if (!Number.isFinite(m) || m <= 0) {
          window.toast('Item ' + (i + 1) + ': metros deve ser > 0.', 'error');
          return;
        }
      }

      // Separa ativos em existentes (atualizar) e novos (inserir).
      const existingItems = activeItems.filter(function (it) { return !it.isNew; });
      const newItems = activeItems.filter(function (it) { return it.isNew; });

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      let algumFalhou = false;
      let failedStep = null;

      // 1) Updates de itens existentes (sequencial, mesmo padrão C3C2B).
      for (let i = 0; i < existingItems.length; i++) {
        const it = existingItems[i];
        const payload = {
          modelo_id: Number(it.modeloId),
          metros: Number(it.metros),
          observacao: it.observacao ? it.observacao : null,
        };
        try {
          const r = await window.supa
            .from('pedido_itens')
            .update(payload)
            .eq('id', it.dbId)
            .eq('pedido_id', pedidoId);
          if (r.error) {
            algumFalhou = true;
            failedStep = 'update';
            window.toast(
              'Erro ao atualizar item ' + (i + 1) + ': ' + (r.error.message || 'desconhecido'),
              'error'
            );
            console.error('pedido-itens-edit: erro ao atualizar item', r.error);
            break;
          }
        } catch (e) {
          algumFalhou = true;
          failedStep = 'update';
          window.toast('Erro inesperado ao atualizar item ' + (i + 1) + '.', 'error');
          console.error(e);
          break;
        }
      }

      // 2) Insert em batch dos itens novos. Ordem é atribuída
      // como: existingItems.length + i (novos vão para o fim).
      // Só tenta se updates não falharam.
      if (!algumFalhou && newItems.length > 0) {
        const insertPayload = newItems.map(function (it, i) {
          return {
            pedido_id: pedidoId,
            modelo_id: Number(it.modeloId),
            metros: Number(it.metros),
            observacao: it.observacao ? it.observacao : null,
            ordem: existingItems.length + i,
          };
        });
        try {
          const r = await window.supa
            .from('pedido_itens')
            .insert(insertPayload);
          if (r.error) {
            algumFalhou = true;
            failedStep = 'insert';
            window.toast(
              'Erro ao inserir novos itens: ' + (r.error.message || 'desconhecido'),
              'error'
            );
            console.error('pedido-itens-edit: erro ao inserir novos itens', r.error);
          }
        } catch (e) {
          algumFalhou = true;
          failedStep = 'insert';
          window.toast('Erro inesperado ao inserir novos itens.', 'error');
          console.error(e);
        }
      }

      // 3) Delete de itens marcados para remoção (sequencial,
      // dupla condição: id do item E pedido_id do pedido). Só
      // tenta se updates/inserts não falharam.
      if (!algumFalhou && removedItems.length > 0) {
        for (let i = 0; i < removedItems.length; i++) {
          const it = removedItems[i];
          try {
            const r = await window.supa
              .from('pedido_itens')
              .delete()
              .eq('id', it.dbId)
              .eq('pedido_id', pedidoId);
            if (r.error) {
              algumFalhou = true;
              failedStep = 'delete';
              window.toast(
                'Erro ao remover item: ' + (r.error.message || 'desconhecido'),
                'error'
              );
              console.error('pedido-itens-edit: erro ao remover item', r.error);
              break;
            }
          } catch (e) {
            algumFalhou = true;
            failedStep = 'delete';
            window.toast('Erro inesperado ao remover item.', 'error');
            console.error(e);
            break;
          }
        }
      }

      if (algumFalhou) {
        console.warn('pedido-itens-edit: salvar falhou na etapa ' + failedStep
          + '. Etapas anteriores podem ter sido aplicadas. Sem compensação automática.');
        btn.disabled = false;
        btn.textContent = oldLabel;
        return;
      }

      // Toast com contadores (update/insert/delete).
      const parts = [];
      if (newItems.length > 0) {
        parts.push(newItems.length + ' novo(s) inserido(s)');
      }
      if (removedItems.length > 0) {
        parts.push(removedItems.length + ' removido(s)');
      }
      const msg = parts.length > 0
        ? 'Itens atualizados e ' + parts.join(' e ') + '.'
        : 'Itens atualizados.';
      window.toast(msg, 'success');
      window.navigate('#/pedidos/' + pedidoId);
    }

    // -----------------------------------------------------------------
    // Form com lista de itens + ações
    // -----------------------------------------------------------------
    function buildForm() {
      if (!state.pedido) return window.el('div', {});

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

      // Se bloqueado por status, desabilita botão Salvar.
      if (state.blockedStatus) {
        saveBtn.disabled = true;
        saveBtn.className = 'px-6 py-2 rounded-lg border bg-gray-50 text-gray-400 cursor-not-allowed font-semibold';
        saveBtn.textContent = 'Edição bloqueada';
      }

      const form = window.el('div', { class: 'bg-white rounded-xl shadow p-6 max-w-3xl' },
        buildItensList(),
        window.el('div', { class: 'flex justify-end gap-2 pt-4 border-t mt-4' },
          cancelBtn,
          saveBtn,
        ),
      );
      return form;
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
      if (state.loadingError === 'itens') {
        container.replaceChildren(
          buildHeader(),
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar itens do pedido. Tente recarregar a página.')
        );
        return;
      }
      if (state.loadingError === 'modelos') {
        container.replaceChildren(
          buildHeader(),
          window.el('div', { class: 'bg-white rounded-xl shadow p-6 text-red-700' },
            'Erro ao carregar modelos. Tente recarregar a página.')
        );
        return;
      }
      // Sem erro de carregamento: renderiza header + banner + aviso
      // + lista (ou mensagem de "sem itens") + form.
      const noItems = state.noItems;
      container.replaceChildren(
        buildHeader(),
        buildStatusBanner(),
        buildItensAviso(),
        noItems ? buildNoItemsMessage() : buildForm()
      );
    }

    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoItensEdit = {
    screenPedidoItensEditar: screenPedidoItensEditar,
  };

  // Compatibilidade com matchRoute dinâmico em js/router.js
  window.screenPedidoItensEditar = screenPedidoItensEditar;
})(window);
