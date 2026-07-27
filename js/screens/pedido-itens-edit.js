// =====================================================================
// === SCREENS: PEDIDO ITENS EDIT ======================================
// Tela admin de edição dos itens de um Pedido
// (C3C2B + C3C2C1 + C3C2C2 + C3C2C3).
// Rota: `#/pedidos/<uuid>/itens` (parseada por js/router.js via
// matchRoute dinâmico). Botão "Editar itens" da tela de detalhe
// `#/pedidos/<uuid>` (C3A/C3B/C3C1) navega para esta tela quando
// o status é editável.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3C2C3
// Escopo: edição de `modelo_id`, `metros`, `observacao` em
//   itens JÁ EXISTENTES (C3C2B) + ADICIONAR novos itens
//   (C3C2C1) + REMOVER itens existentes (C3C2C2) +
//   NORMALIZAR automaticamente `ordem` no `salvar()`
//   (C3C2C3, sem UI de reordenação manual).
//   SEM drag-and-drop, SEM setas de subir/descer, SEM
//   reordenação manual (fica para C3C2C4+), SEM editar
//   `largura`/`cor_1_id`/`cor_2_id` (overrides opcionais
//   ficam para C3C2D), SEM alterar status (fica para C3B
//   já entregue), SEM mexer em dados gerais (fica para C3C1
//   já entregue), SEM geração de OP, SEM lote, SEM cliente
//   público, SEM token, SEM Edge Function, SEM RPC, SEM schema.
//
//   Itens novos: criados no estado local com flag `isNew: true`,
//   botão "Descartar novo item" (apenas local, antes de salvar).
//
//   Itens existentes removidos: clique em "Remover item" abre
//   `window.confirmDialog`; após confirmar, item é marcado com
//   `markedForDeletion: true` (visual "riscado" + botão
//   "Desfazer remoção"); remoção aplicada apenas no `salvar()`
//   via DELETE em `pedido_itens` com `.eq('id', dbId).eq('pedido_id',
//   pedidoId)`. Mínimo de 1 item é garantido: `marcarParaRemocao`
//   bloqueia se a remoção deixaria 0 itens.
//
//   Normalização de `ordem` (C3C2C3): no `salvar()`, antes de
//   qualquer operação de banco, os itens ativos
//   (`activeItems = state.itens.filter(!markedForDeletion)`)
//   têm `ordem` recalculada pela posição final no array
//   (0, 1, 2, 3, ...). Lacunas são eliminadas. Sem UI
//   para o usuário controlar a ordem — a normalização é
//   totalmente automática.
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
//     `observacao`, `ordem`) para itens existentes NÃO marcados
//     para remoção. `ordem` é incluída para aplicar a
//     normalização de C3C2C3.
//   - `insert` em `pedido_itens` (campos `pedido_id`, `modelo_id`,
//     `metros`, `observacao`, `ordem`) para itens novos. `ordem`
//     vem da posição final do item em `activeItems`.
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

  // -------------------------------------------------------------------
  // SCREEN-GROUP-1 — a mesma linguagem de cartao de js/screens/pedido-edit.js
  // e das duas telas de criacao do grupo. Ver o bloco equivalente naquele
  // arquivo: nenhum valor novo, apenas a densidade que BATCH-03 ja aceitou.
  // Acao de linha, NAO destrutiva (Desfazer remocao) e acao de linha
  // DESTRUTIVA (Remover item / Descartar novo item). As duas eram o mesmo
  // link sublinhado, distinguidas so pela cor; agora a destrutiva e separada
  // do grupo de campos por um divisor proprio (ver buildItemRow).

  // PASS-7-A4: um <label> IRMAO nao nomeia nada, e role="combobox" — ao
  // contrario de um botao comum — nao herda nome do proprio conteudo. O
  // popover canonico precisa do rotulo visivel ligado explicitamente, senao
  // chega sem nome na tecnologia assistiva. So liga um trigger canonico ainda
  // sem nome; nenhum outro controle e tocado.
  let pedidoItensLabelSeq = 0;
  function bindSelectPopoverLabel(labelNode, control) {
    if (!control || typeof control.getAttribute !== 'function') return;
    if (control.getAttribute('data-rv-select-popover') !== '1') return;
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
    pedidoItensLabelSeq += 1;
    const id = 'rv-pedido-itens-edit-field-label-' + pedidoItensLabelSeq;
    labelNode.setAttribute('id', id);
    control.setAttribute('aria-labelledby', id);
  }

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
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { window.navigate('#/pedidos'); },
      }, '← Voltar para lista');
    }
    function backToDetailBtn(id) {
      return window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { window.navigate('#/pedidos/' + id); },
      }, '← Voltar para o detalhe');
    }
    function errorCard(message) {
      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; color:var(--rv-signal-negative); font-size:var(--rv-fs-body);',
      }, message);
    }
    function errorShell(headerTitle, message, backBtn) {
      return window.shellLayout(window.ADMIN_MENU,
        window.el('div', {},
          errorHeader(headerTitle),
          errorCard(message),
          window.el('div', {}, backBtn)
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
      tipoMetadataOk: false,
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

      // PHASE-MANTA-A: best-effort tipo_produto augmentation. Graceful before
      // the migration is applied (column absent => models stay type-less and
      // render as Tapete); never fatal.
      // BATCH-02: FALHA FECHADA. Sem `modelos.tipo_produto` a tela nao pode
      // oferecer modelo algum — degradar tudo para Tapete colocaria uma Manta
      // na rota de acabamento sem ninguem perceber.
      try {
        const tpRes = await window.supa.from('modelos').select('id, tipo_produto');
        if (tpRes.error || !Array.isArray(tpRes.data)) {
          state.loadingError = 'tipo de produto dos modelos';
          window.toast('Erro ao carregar o tipo de produto dos modelos.', 'error');
          console.error(tpRes.error);
          return;
        }
        const tpById = Object.fromEntries(tpRes.data.map(function (r) { return [String(r.id), r.tipo_produto]; }));
        state.modelos.forEach(function (m) { if (tpById[String(m.id)] != null) m.tipo_produto = tpById[String(m.id)]; });
        state.tipoMetadataOk = true;
      } catch (e) {
        state.loadingError = 'tipo de produto dos modelos';
        console.error('pedido-itens-edit: tipo_produto indisponivel', e);
        return;
      }

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
      const c1 = (state.coresById[modelo.cor_1_id] && state.coresById[modelo.cor_1_id].nome) || '—';
      const c2 = (state.coresById[modelo.cor_2_id] && state.coresById[modelo.cor_2_id].nome) || '—';
      // PHASE-MANTA-A: canonical "Tipo · Nome · Largura · Cores" when the model
      // carries tipo_produto; legacy label otherwise (pre-migration).
      const display = window.RAVATEX_OP_DISPLAY;
      if (modelo.tipo_produto != null && display && typeof display.formatProductLabel === 'function') {
        return display.formatProductLabel({ tipo_produto: modelo.tipo_produto, nome: modelo.nome, largura: modelo.largura, cor1: c1, cor2: c2 });
      }
      const w = (typeof modelo.largura === 'number')
        ? modelo.largura.toFixed(2).replace('.', ',') + ' m'
        : (modelo.largura != null ? String(modelo.largura) : '—');
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
      // SCREEN-GROUP-1: os tres estados da linha passam a ser declarados pelos
      // tokens que ja carregam esses papeis — a superficie sutil canonica para
      // a linha normal, e as familias `pill` info/negative para "novo" e "sera
      // removido". As tres tonalidades Tailwind (`bg-gray-50` / `bg-blue-50` /
      // `bg-red-50`) nao tinham dono e nao correspondiam a nenhuma familia do
      // contrato. A distincao por borda tracejada e a opacidade do estado
      // marcado sao PRESERVADAS: elas e que carregam o significado.
      // Os tres estados sao tres declaracoes COMPLETAS e LITERAIS. O detector
      // so decodifica um style que seja UM literal: um prefixo comum
      // concatenado com um sufixo variavel, ou uma variavel de estilo, viraria
      // um COVERAGE_GAP e tiraria a linha de item da analise de conformidade
      // justamente na tela que este lote consolida. A repeticao e deliberada.
      const row = window.el('div', {
        style: 'border-radius:var(--rv-radius); display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; margin-bottom:12px; padding:12px; background:var(--rv-surface-subtle); border:1px solid var(--rv-border-soft);',
        'data-uid': item.uid,
        'data-db-id': item.dbId,
        'data-is-new': isNew ? '1' : '0',
        'data-marked-deletion': isMarked ? '1' : '0',
      });
      if (isMarked) {
        row.setAttribute('style', 'border-radius:var(--rv-radius); display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; margin-bottom:12px; padding:12px; background:var(--rv-pill-negative-bg); border:1px dashed var(--rv-pill-negative-border); opacity:.7;');
      } else if (isNew) {
        row.setAttribute('style', 'border-radius:var(--rv-radius); display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; margin-bottom:12px; padding:12px; background:var(--rv-pill-info-bg); border:1px dashed var(--rv-pill-info-border);');
      }

      // Label "Será removido ao salvar" para itens existentes
      // marcados (C3C2C2).
      if (isMarked) {
        row.appendChild(window.el('div', { style: 'width:100%;' },
          window.el('span',
            { 'data-ui-pill': '1', style: 'display:inline-block; border-radius:var(--rv-radius-pill); padding:2px 8px; font-size:var(--rv-fs-xs); font-weight:600; background:var(--rv-pill-negative-bg); color:var(--rv-pill-negative-text); border:1px solid var(--rv-pill-negative-border);' },
            'Será removido ao salvar'
          )
        ));
      } else if (isNew) {
        // Label "Novo" para itens ainda não salvos.
        row.appendChild(window.el('div', { style: 'width:100%;' },
          window.el('span',
            { 'data-ui-pill': '1', style: 'display:inline-block; border-radius:var(--rv-radius-pill); padding:2px 8px; font-size:var(--rv-fs-xs); font-weight:600; background:var(--rv-pill-info-bg); color:var(--rv-pill-info-text); border:1px solid var(--rv-pill-info-border);' },
            'Novo (não salvo)'
          )
        ));
      }

      // TIPO ANTES DE MODELO (BATCH-02). O Tipo corrente e DERIVADO do
      // modelo_id autoritativo do item; o operador so o escolhe para trocar de
      // rota. O Tipo nunca e persistido: pedido_itens grava apenas modelo_id.
      const rowApi = window.RAVATEX_PEDIDO_ITEM_ROW;
      const modeloAtual = modeloById(item.modeloId);
      if (modeloAtual) item.tipo = rowApi.rotaDoModelo(modeloAtual);
      if (!item.tipo) item.tipo = item.tipo || '';

      const tipoSel = window.selectInput({
        options: [
          { value: rowApi.TAPETE, label: rowApi.tipoLabel(rowApi.TAPETE) },
          { value: rowApi.MANTA, label: rowApi.tipoLabel(rowApi.MANTA) },
        ],
        value: item.tipo,
        placeholder: 'Tipo...',
      });
      tipoSel.setAttribute('data-item-tipo-select', '1');
      const tipoLabelNode = window.el('label', { style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px;' }, 'Tipo');
      bindSelectPopoverLabel(tipoLabelNode, tipoSel);
      row.appendChild(window.el('div', { style: 'flex:0 0 160px; min-width:0;' }, tipoLabelNode, tipoSel));

      // Select de modelo — recorte estrito da rota escolhida.
      const modeloSel = window.selectInput({ options: [], value: '', placeholder: 'Modelo...' });
      modeloSel.setAttribute('data-item-modelo-select', '1');
      function preencherModelos() {
        const lista = rowApi.modelosPorTipo(state.modelos, item.tipo);
        // Pass-7 (UIC-006): a repopulacao passa por setOptions(); nao existe
        // mais option nativa, replaceChildren nem option.selected. setOptions
        // preserva o valor quando uma opcao equivalente sobrevive e o limpa
        // quando ela some — e nunca emite change por si.
        modeloSel.setOptions(lista.map(function (m) {
          return { value: String(m.id), label: modeloLabel(m) };
        }), {
          value: item.modeloId ? String(item.modeloId) : '',
          placeholder: 'Modelo...',
        });
        modeloSel.disabled = !(item.tipo && state.tipoMetadataOk);
      }
      tipoSel.addEventListener('change', function () {
        item.tipo = tipoSel.value;
        // Trocar o Tipo limpa o modelo que deixou de pertencer a rota.
        const atual = modeloById(item.modeloId);
        if (!item.tipo || (atual && rowApi.rotaDoModelo(atual) !== item.tipo)) item.modeloId = '';
        preencherModelos();
      });
      modeloSel.addEventListener('change', function () {
        // modelo_id continua sendo a UNICA identidade de produto persistida.
        item.modeloId = modeloSel.value;
      });
      preencherModelos();
      const modeloLabelNode = window.el('label', { style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px;' }, 'Modelo');
      bindSelectPopoverLabel(modeloLabelNode, modeloSel);
      row.appendChild(window.el('div', { style: 'flex:1 1 256px; min-width:0;' }, modeloLabelNode, modeloSel));

      // Input de metros.
      const metrosInput = window.textInput({
        type: 'number',
        value: item.metros,
        placeholder: '0',
        step: '0.01',
      });
      metrosInput.addEventListener('input', function () {
        item.metros = metrosInput.value;
      });
      row.appendChild(window.el('div', { style: 'flex:0 0 128px; min-width:0;' },
        window.el('label', { style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px;' }, 'Metros'),
        metrosInput));

      // Observação do item (opcional).
      const obsInput = window.textInput({
        value: item.observacao,
        placeholder: 'Observação do item (opcional)',
      });
      obsInput.addEventListener('input', function () {
        item.observacao = obsInput.value;
      });
      row.appendChild(window.el('div', { style: 'flex:1 1 192px; min-width:0;' },
        window.el('label', { style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px;' }, 'Observação'),
        obsInput));

      // Botões de descarte/remoção/desfazer — distinguem 3 casos:
      //  1. isNew=true: "Descartar novo item" (remove do estado
      //     local apenas; não toca no banco).
      //  2. !isNew && !markedForDeletion: "Remover item" (marca
      //     para remoção local; DELETE só no `salvar()`).
      //  3. !isNew && markedForDeletion: "Desfazer remoção"
      //     (limpa a flag local; item volta a ser normal).
      //
      // SCREEN-GROUP-1 — SEPARACAO DA ACAO DESTRUTIVA.
      // As tres acoes ficavam soltas logo depois do campo Observacao, na mesma
      // linha de campos e com o mesmo peso visual de um link. Duas delas
      // ("Remover item", "Descartar novo item") sao DESTRUTIVAS e ficavam a um
      // clique de distancia do campo de texto vizinho.
      // Agora a acao mora num container proprio, empurrado para a direita e
      // separado do grupo de campos por um divisor vertical. A acao NAO
      // destrutiva ("Desfazer remocao") usa o azul interativo canonico; as
      // destrutivas usam o sinal negativo canonico. O contrato de confirmacao
      // nao muda: `marcarParaRemocao` continua abrindo confirmDialog.
      const acoesCell = window.el('div', {
        'data-item-actions': '1',
        style: 'flex:0 0 auto; margin-left:auto; align-self:flex-end; display:flex; align-items:center; gap:12px; padding-left:12px; border-left:1px solid var(--rv-border-soft); min-height:var(--rv-h-compact);',
      });
      if (isMarked) {
        const undoBtn = window.el('button', {
          type: 'button',
          style: 'background:none; border:none; height:var(--rv-h-compact); padding:0; display:inline-flex; align-items:center; font-size:var(--rv-fs-body); font-weight:600; font-family:inherit; cursor:pointer; text-decoration:underline; color:var(--rv-accent-blue);',
          'data-action': 'undo-delete',
          onclick: function () { desfazerRemocao(item.uid); },
        }, 'Desfazer remoção');
        acoesCell.appendChild(undoBtn);
      } else if (isNew) {
        const discardBtn = window.el('button', {
          type: 'button',
          style: 'background:none; border:none; height:var(--rv-h-compact); padding:0; display:inline-flex; align-items:center; font-size:var(--rv-fs-body); font-weight:600; font-family:inherit; cursor:pointer; text-decoration:underline; color:var(--rv-signal-negative);',
          'data-action': 'discard-new',
          onclick: function () { descartarItemNovo(item.uid); },
        }, 'Descartar novo item');
        acoesCell.appendChild(discardBtn);
      } else {
        const removeBtn = window.el('button', {
          type: 'button',
          style: 'background:none; border:none; height:var(--rv-h-compact); padding:0; display:inline-flex; align-items:center; font-size:var(--rv-fs-body); font-weight:600; font-family:inherit; cursor:pointer; text-decoration:underline; color:var(--rv-signal-negative);',
          'data-action': 'remove-existing',
          onclick: function () { marcarParaRemocao(item.uid); },
        }, 'Remover item');
        acoesCell.appendChild(removeBtn);
      }
      row.appendChild(acoesCell);

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
      const wrap = window.el('div', {});
      wrap.appendChild(window.el('h2', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:12px;' },
        'Itens do pedido (' + state.itens.length + ') — edite modelo, metros e observação; ou adicione um novo item.'));
      for (let i = 0; i < state.itens.length; i++) {
        wrap.appendChild(buildItemRow(state.itens[i]));
      }
      // Botão "+ Adicionar item" — visível apenas se status editável.
      // Em status bloqueado, não permite criar novos itens nesta
      // sessão (decisão defensiva de C3C2C1).
      //
      // SCREEN-GROUP-1: e a MESMA acao que `#/pedidos/novo` oferece, entao usa
      // a mesma forma — botao delineado na marca, degrau --rv-h-default — em
      // vez de um link sublinhado. As duas telas de item deixam de discordar
      // sobre o que "Adicionar item" parece.
      if (!state.blockedStatus) {
        const addBtn = window.el('button', {
          type: 'button',
          style: 'display:inline-flex; align-items:center; justify-content:center; gap:8px; background:var(--rv-surface); color:var(--rv-accent-blue); border:1px solid var(--rv-brand); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 13px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer; white-space:nowrap;',
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
      const banner = window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; display:flex; flex-wrap:wrap; align-items:center; gap:12px;',
      },
        window.el('div', { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-secondary);' }, 'Status atual:'),
        window.pedidoStatusBadge ? window.pedidoStatusBadge(s) : window.el('span', {}, s)
      );
      if (state.blockedStatus) {
        banner.appendChild(window.el('div',
          { style: 'font-size:var(--rv-fs-body); color:var(--rv-signal-negative); margin-left:auto;' },
          'Este pedido está em status "' + label + '". '
            + 'A edição de itens é permitida apenas para "Rascunho" e "Recebido".'
        ));
      } else {
        banner.appendChild(window.el('div',
          { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); margin-left:auto;' },
          'Edição permitida neste status. Você pode alterar modelo, '
            + 'metros e observação dos itens existentes, adicionar '
            + 'novos itens, remover itens existentes e a ordem é '
            + 'normalizada automaticamente ao salvar.'
        ));
      }
      return banner;
    }

    function buildItensAviso() {
      // Aviso simples: escopo desta fase (C3C2C3).
      return window.el('div',
        { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; font-size:var(--rv-fs-body); color:var(--rv-text-secondary);' },
        'Nesta fase (C3C2C3) você pode editar modelo, metros e '
          + 'observação dos itens existentes, adicionar novos itens, '
          + 'remover itens existentes, e a ordem dos itens é '
          + 'normalizada automaticamente ao salvar. Reordenação '
          + 'manual e overrides de largura/cor ficam para fases '
          + 'seguintes.'
      );
    }

    function buildNoItemsMessage() {
      return window.el('div',
        { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; text-align:center; font-size:var(--rv-fs-body); color:var(--rv-text-tertiary);' },
        'Pedido sem itens cadastrados.');
    }

    // -----------------------------------------------------------------
    // salvar: valida + normaliza + aplica writes em `pedido_itens`.
    //   - Bloqueado se status não for editável.
    //   - Bloqueado se não houver itens ativos (não marcados para
    //     remoção) — mínimo 1 (defesa; `marcarParaRemocao` também
    //     pré-checa).
    //   - Para cada item ativo, valida modelo_id e metros > 0.
    //   - Normalização de `ordem` (C3C2C3): antes de qualquer
    //     operação de banco, atribui `it.ordem = i` para cada item
    //     em `activeItems` (posição final no array). Isso elimina
    //     lacunas após add/remove e garante sequência 0, 1, 2, ...
    //     sem que o usuário tenha controle sobre a ordem (sem UI
    //     de reordenação manual nesta fase).
    //   - Separa:
    //     * existingItems: itens com isNew=false (atualizar no banco)
    //     * newItems:      itens com isNew=true (inserir no banco)
    //     * removedItems:  itens com markedForDeletion=true (deletar
    //                       do banco; existem no banco, isNew=false)
    //   - Sequência:
    //     1) UPDATE de `existingItems` (sequencial):
    //        `.update({ modelo_id, metros, observacao, ordem })
    //         .eq('id', dbId).eq('pedido_id', pedidoId)`.
    //        O `ordem` é incluído para aplicar a normalização
    //        de C3C2C3 (pode mudar se houve remoção de item
    //        anterior ou se itens foram reordenados no estado).
    //     2) INSERT em batch de `newItems` com 5 chaves
    //        (pedido_id, modelo_id, metros, observacao, ordem).
    //        `ordem` vem da posição final do item em
    //        `activeItems` (já normalizada acima).
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

      // Normalização de `ordem` (C3C2C3): para cada item ativo,
      // atribui `ordem = i` onde `i` é a posição final no array
      // `activeItems`. Isso elimina lacunas após add/remove
      // (ex: itens [0,1,2,3] com item 1 removido → [0,2,3]
      // normalizado para [0,1,2]). Sequência final garantida:
      // 0, 1, 2, 3, ... sem sobreposição e sem gaps.
      for (let i = 0; i < activeItems.length; i++) {
        activeItems[i].ordem = i;
      }

      // Separa ativos em existentes (atualizar) e novos (inserir).
      const existingItems = activeItems.filter(function (it) { return !it.isNew; });
      const newItems = activeItems.filter(function (it) { return it.isNew; });

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = 'Salvando...';

      let algumFalhou = false;
      let failedStep = null;

      // 1) Updates de itens existentes (sequencial, mesmo padrão C3C2B
      // + C3C2C3: payload inclui `ordem` para aplicar normalização).
      for (let i = 0; i < existingItems.length; i++) {
        const it = existingItems[i];
        const payload = {
          modelo_id: Number(it.modeloId),
          metros: Number(it.metros),
          observacao: it.observacao ? it.observacao : null,
          ordem: it.ordem,
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

      // 2) Insert em batch dos itens novos. `ordem` vem da posição
      // final do item em `activeItems` (já normalizada acima com
      // `it.ordem = i` por posição). Só tenta se updates não
      // falharam.
      if (!algumFalhou && newItems.length > 0) {
        const insertPayload = newItems.map(function (it) {
          return {
            pedido_id: pedidoId,
            modelo_id: Number(it.modeloId),
            metros: Number(it.metros),
            observacao: it.observacao ? it.observacao : null,
            ordem: it.ordem,
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

      // Botão Salvar — acao dominante do fluxo, degrau --rv-h-primary.
      const saveBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0 20px; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { salvar(saveBtn); },
      }, 'Salvar alterações');

      // Botão Cancelar (volta para o detalhe).
      const cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
      }, 'Cancelar');

      // Se bloqueado por status, desabilita botão Salvar.
      if (state.blockedStatus) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('style', 'background:var(--rv-surface-subtle); color:var(--rv-text-tertiary); border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0 20px; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:not-allowed;');
        saveBtn.textContent = 'Edição bloqueada';
      }

      const form = window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; max-width:768px;' },
        buildItensList(),
        // SCREEN-GROUP-1 — CONTENCAO LOCAL DE ACAO. Mesmo contrato de rodape
        // da tela de dados gerais: STANDARD_ACTION_FOOTER, so acoes, alinhado
        // a direita, divisor e padding-top canonicos (longhand).
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rv-border-soft);padding-top:11px;margin-top:16px;',
          'data-pedido-itens-edit-actions': 'itens',
          'data-card-actions': '',
        },
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
          errorCard(
            'Pedido não encontrado. Ele pode ter sido removido.')
        );
        return;
      }
      if (state.loadingError === 'itens') {
        container.replaceChildren(
          buildHeader(),
          errorCard(
            'Erro ao carregar itens do pedido. Tente recarregar a página.')
        );
        return;
      }
      if (state.loadingError === 'modelos') {
        container.replaceChildren(
          buildHeader(),
          errorCard(
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
