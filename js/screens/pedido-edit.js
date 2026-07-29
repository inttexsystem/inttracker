// =====================================================================
// === SCREENS: PEDIDO EDIT ============================================
// Editor administrativo UNIFICADO do Pedido existente.
// Rota: `#/pedidos/<uuid>/editar` (parseada por js/router.js via
// matchRoute dinâmico). `#/pedidos/<uuid>/itens` é um REDIRECT DE
// COMPATIBILIDADE para esta rota (js/router.js).
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
// Substitui integralmente a tela parcial anterior (dados gerais apenas,
// max-width:768px, itens "não editáveis nesta fase") e a tela separada
// de edição de itens (js/screens/pedido-itens-edit.js, mantida apenas
// como destino de compatibilidade fisicamente retirado numa fase futura).
//
// ARQUITETURA — a mesma composição visual de `#/pedidos/novo`:
//   header (voltar + título + status + subtítulo) -> cartão "Dados
//   gerais" (grade responsiva canônica) -> cartão "Itens do pedido"
//   (entrada dupla: modal detalhado "Adicionar item" + linha rápida
//   "Adicionar linha", edição inline, totais, sequência de prioridade de
//   produção) -> seção inferior de duas colunas (Observações gerais +
//   Salvar).
//
// PERSISTÊNCIA — exclusivamente public.salvar_pedido_admin(p_pedido_id,
// p_base_revisao, p_header, p_itens, p_prioridade, p_confirmar_impacto).
// Nenhum UPDATE/INSERT/DELETE direto em `pedidos`/`pedido_itens` sobrevive
// nesta tela. Cada seção viaja como NULL quando não mudou (db/92); se as
// três vierem NULL, a tela nem chama a RPC.
//
// DONOS COMPARTILHADOS consumidos, não duplicados:
//   - js/pedido-draft.js       — colecao local de itens, totais,
//     validação, payload de itens, detecção estrutural/de mudança.
//   - js/pedido-fields.js      — estado de campos gerais, payload de
//     cabeçalho, detecção de mudança.
//   - js/pedido-priority.js    — painel de prioridade, RPC de
//     prioridade (via p_prioridade desta RPC), modais de impacto.
//   - js/screens/pedido-item-row-editor.js — linha editável (com os
//     novos modos `locked`/`readOnly`).
//   - js/screens/pedido-item-modal.js — modal detalhado "Adicionar item".
//
// TRAVA ESTRUTURAL (EXECUTION ORDER sec.9.1) — quando qualquer OP,
// expedição ou vínculo de item a produção já existe para este Pedido,
// os controles estruturais de item (Tipo/Modelo/Metragem, Adicionar,
// Remover) ficam bloqueados; campos de cabeçalho, Observações gerais e a
// ação de menção (não-estrutural) continuam disponíveis, junto com a
// prioridade. A leitura é PROJEÇÃO DE USABILIDADE —
// a autoridade final é sempre `salvar_pedido_admin`; a detecção usa
// apenas leituras admin explícitas (ops/lotes/expedicoes/op_itens/
// expedicao_itens), nunca um helper interno de db/92. Falha na leitura
// de vínculo TRAVA por segurança (nunca assume "sem OP").
//
// Carregar via <script src="js/screens/pedido-edit.js?v=...></script>
// no <head>, DEPOIS de js/pedido-draft.js, js/pedido-fields.js,
// js/pedido-priority.js, js/screens/pedido-item-row-editor.js e
// js/screens/pedido-item-modal.js, e ANTES de <script> principal (boot.js).
// =====================================================================

(function (window) {
  'use strict';

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const TERMINAL_STATUSES = ['entregue', 'cancelado'];

  function DRAFT() { return window.RAVATEX_PEDIDO_DRAFT; }
  function FIELDS() { return window.RAVATEX_PEDIDO_FIELDS; }
  function PRIORITY() { return window.RAVATEX_PEDIDO_PRIORITY; }
  function itemRowApi() { return window.RAVATEX_PEDIDO_ITEM_ROW; }
  function itemModalApi() { return window.RAVATEX_PEDIDO_ITEM_MODAL; }

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }
  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>';

  function isTerminal(status) { return TERMINAL_STATUSES.indexOf(status) !== -1; }

  function fieldBoxStyle(erro) {
    return 'display:flex; align-items:center; gap:8px; height:var(--rv-h-compact); box-sizing:border-box;'
      + ' border:1px solid ' + (erro ? 'var(--rv-signal-negative-border)' : 'var(--rv-border-strong)')
      + '; border-radius:var(--rv-radius); padding:0 12px; background:var(--rv-surface);';
  }
  function buildFieldLabel(text, required) {
    var children = [text];
    if (required) {
      children.push(' ');
      children.push(window.el('span', { style: 'color:var(--rv-signal-negative);' }, '*'));
    }
    return window.el('label', {
      style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px; white-space:nowrap;'
    }, children);
  }

  function fullWidthNotice(tone, title, message, actions) {
    var palette = {
      caution: { bg: 'var(--rv-signal-caution-bg)', border: 'var(--rv-signal-caution-border)', text: 'var(--rv-signal-caution)' },
      negative: { bg: 'var(--rv-pill-negative-bg)', border: 'var(--rv-pill-negative-border)', text: 'var(--rv-signal-negative)' },
      neutral: { bg: 'var(--rv-surface-subtle)', border: 'var(--rv-border)', text: 'var(--rv-text-secondary)' },
    };
    var p = palette[tone] || palette.neutral;
    var children = [
      window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:4px;' }, title),
      window.el('div', { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-secondary); line-height:1.5;' }, message),
    ];
    if (actions && actions.length) {
      children.push(window.el('div', {
        'data-card-actions': '',
        style: 'display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; margin-top:12px;',
      }, actions));
    }
    return window.el('div', {
      style: 'background:' + p.bg + '; border:1px solid ' + p.border + '; border-radius:var(--rv-radius); padding:16px; margin-bottom:12px; border-left:3px solid ' + p.text + ';',
    }, children);
  }

  async function screenPedidoEditar(pedidoId) {
    function errorHeader(title) { return window.pageHeader(title || 'Editar Pedido'); }
    function backToListBtn() {
      return window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { window.navigate('#/pedidos'); },
      }, '← Voltar para lista');
    }
    function errorCard(message) {
      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px; color:var(--rv-signal-negative); font-size:var(--rv-fs-body);',
      }, message);
    }
    function errorShell(headerTitle, message, backBtn) {
      return window.shellLayout(window.ADMIN_MENU,
        window.el('div', {}, errorHeader(headerTitle), errorCard(message), window.el('div', {}, backBtn))
      );
    }

    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido inválido.', 'error');
      return errorShell('Editar Pedido', 'Pedido inválido. Volte para a listagem e tente novamente.', backToListBtn());
    }

    const container = window.el('div', {});

    // PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1 — estado da acao de mencao. O
    // <textarea> de Observacoes gerais e recriado a CADA render() (dentro de
    // buildBottomSection, chamado so em telas nao-terminais); estas
    // variaveis vivem no escopo externo porque buildItensCard() — que monta
    // as linhas com o callback onMention — roda ANTES de buildBottomSection()
    // no mesmo render(). O callback so LE estas variaveis no momento do
    // clique, entao o valor atribuido pela build mais recente do textarea e
    // sempre o que esta em vigor. Em renderizacao terminal, buildBottomSection
    // nunca roda e o botao de mencao ja vem desabilitado (readOnly), entao um
    // valor obsoleto aqui nunca e alcancado por um clique real.
    let obsTextareaRef = null;
    let obsTextareaFocused = false;
    let syncObservacaoRef = null;

    // Insere a mencao pronta em Observacoes gerais usando a aritmetica pura
    // de js/pedido-draft.js e o MESMO path normal de input (syncObservacaoRef)
    // que o listener de digitacao usa — nenhum estado paralelo e criado, e
    // nenhuma chamada a RPC ou a supa acontece aqui. Cliques repetidos
    // inserem referencias repetidas de proposito (sem deduplicacao).
    function handleItemMention(mentionText) {
      const textarea = obsTextareaRef;
      const draft = window.RAVATEX_PEDIDO_DRAFT;
      if (!textarea || !mentionText || !draft || typeof draft.computeMentionInsertion !== 'function') return;
      const result = draft.computeMentionInsertion(textarea.value, textarea.selectionStart, obsTextareaFocused, mentionText);
      textarea.value = result.value;
      if (typeof syncObservacaoRef === 'function') syncObservacaoRef();
      if (typeof textarea.focus === 'function') textarea.focus();
      if (typeof textarea.setSelectionRange === 'function') textarea.setSelectionRange(result.caret, result.caret);
      if (typeof window.autosizeTextarea === 'function') window.autosizeTextarea(textarea);
      if (typeof textarea.scrollIntoView === 'function') textarea.scrollIntoView({ block: 'nearest' });
    }

    const state = {
      pedido: null,
      baseRevisao: null,
      fields: null,
      fieldsBaseline: null,
      itens: [],
      itensBaseline: [],
      clientes: [],
      modelos: [],
      tipoMetadataOk: false,
      prioridadeHabilitada: false,
      prioridadeBaseline: { habilitada: false, sequencia: [] },
      loadingError: null,
      estruturaBloqueada: false,
      linkageCheckFailed: false,
      staleRevision: false,
    };

    async function carregarPedidoEItens() {
      const pedidoRes = await window.supa
        .from('pedidos')
        .select('id, numero, data_pedido, status, cliente_id, referencia_cliente, prazo_entrega, tipo_recebimento, observacao, prioridade_status, revisao')
        .eq('id', pedidoId)
        .maybeSingle();
      if (pedidoRes.error || !pedidoRes.data) {
        state.loadingError = 'pedido';
        window.toast('Pedido não encontrado.', 'error');
        console.error(pedidoRes.error);
        return;
      }
      state.pedido = pedidoRes.data;
      state.baseRevisao = pedidoRes.data.revisao;
      state.fields = FIELDS().fromPersisted(pedidoRes.data);
      state.fieldsBaseline = FIELDS().fromPersisted(pedidoRes.data);

      const itensRes = await window.supa
        .from('pedido_itens')
        .select('id, modelo_id, metros, largura, observacao, ordem')
        .eq('pedido_id', pedidoId)
        .order('ordem', { ascending: true });
      if (itensRes.error) {
        state.loadingError = 'itens';
        window.toast('Erro ao carregar itens do pedido.', 'error');
        console.error(itensRes.error);
        return;
      }
      state.itens = DRAFT().fromPersisted(itensRes.data);
      state.itensBaseline = DRAFT().fromPersisted(itensRes.data);
      state.prioridadeHabilitada = pedidoRes.data.prioridade_status !== 'nenhuma';
      state.prioridadeBaseline = {
        habilitada: state.prioridadeHabilitada,
        sequencia: state.itens.map(function (it) { return it.itemId; }),
      };
    }

    async function carregarClientesEModelos() {
      const results = await Promise.all([
        window.supa.from('clientes').select('id, nome').order('nome'),
        window.supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)').order('nome'),
      ]);
      const cliRes = results[0];
      const modRes = results[1];
      if (cliRes.error) {
        state.loadingError = state.loadingError || 'clientes';
        window.toast('Erro ao carregar clientes.', 'error');
        console.error(cliRes.error);
      } else {
        state.clientes = cliRes.data || [];
      }
      if (modRes.error) {
        state.loadingError = state.loadingError || 'modelos';
        window.toast('Erro ao carregar modelos.', 'error');
        console.error(modRes.error);
        return;
      }
      state.modelos = modRes.data || [];
      try {
        const tpRes = await window.supa.from('modelos').select('id, tipo_produto');
        if (tpRes.error || !Array.isArray(tpRes.data)) {
          state.loadingError = state.loadingError || 'tipo de produto dos modelos';
          console.error('pedido-edit: tipo_produto indisponivel', tpRes.error);
          return;
        }
        const tpById = {};
        tpRes.data.forEach(function (row) { if (row && row.id != null) tpById[String(row.id)] = row.tipo_produto; });
        state.modelos.forEach(function (m) { if (tpById[String(m.id)] != null) m.tipo_produto = tpById[String(m.id)]; });
        state.tipoMetadataOk = true;
      } catch (e) {
        state.loadingError = state.loadingError || 'tipo de produto dos modelos';
        console.error('pedido-edit: tipo_produto indisponivel', e);
      }
    }

    // Detecção de vínculo de produção via leituras admin EXPLÍCITAS —
    // nunca via helper interno de db/92 (pedido_tem_op_relacionada é
    // OWNER-ONLY). Espelha exatamente a mesma condição para que a
    // projeção de UI nunca prometa mais do que o servidor aceita.
    // Falha de leitura TRAVA por segurança (nunca assume "sem OP").
    async function detectarVinculoProducao() {
      const itemIds = state.itens.map(function (it) { return it.itemId; }).filter(Boolean);
      try {
        const lotesRes = await window.supa.from('lotes').select('id').eq('pedido_id', pedidoId);
        if (lotesRes.error) throw lotesRes.error;
        const loteIds = (lotesRes.data || []).map(function (r) { return r.id; });
        if (loteIds.length > 0) {
          const opsRes = await window.supa.from('ops').select('id').in('lote_id', loteIds).limit(1);
          if (opsRes.error) throw opsRes.error;
          if ((opsRes.data || []).length > 0) return true;
        }

        const expRes = await window.supa.from('expedicoes').select('id').eq('pedido_id', pedidoId).limit(1);
        if (expRes.error) throw expRes.error;
        if ((expRes.data || []).length > 0) return true;

        if (itemIds.length > 0) {
          const opItensRes = await window.supa.from('op_itens').select('id').in('pedido_item_id', itemIds).limit(1);
          if (opItensRes.error) throw opItensRes.error;
          if ((opItensRes.data || []).length > 0) return true;

          const expItensRes = await window.supa.from('expedicao_itens').select('id').in('pedido_item_id', itemIds).limit(1);
          if (expItensRes.error) throw expItensRes.error;
          if ((expItensRes.data || []).length > 0) return true;
        }
        return false;
      } catch (e) {
        console.error('pedido-edit: falha ao detectar vinculo de producao; travando estrutura por seguranca', e);
        state.linkageCheckFailed = true;
        return true;
      }
    }

    // `carregar()` é o UNICO ponto de leitura, tanto no boot da tela quanto no
    // "Recarregar dados" explicito apos PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA
    // (nunca ha retry automatico nem merge: o operador aciona, e cada chamada
    // SUBSTITUI integralmente fields/itens/baselines/prioridade a partir da
    // leitura fresca — DRAFT().fromPersisted()/FIELDS().fromPersisted() nunca
    // preservam rascunho local antigo).
    //
    // `staleRevision` e `linkageCheckFailed` sao estado TRANSIENTE de UMA
    // tentativa e nao podem sobreviver a uma recarga bem-sucedida:
    //   - `linkageCheckFailed` e limpo ANTES da nova checagem de vinculo, para
    //     que uma falha antiga nao continue aparecendo depois de uma leitura
    //     que desta vez funcionou;
    //   - `staleRevision` so e limpo no FINAL, depois que pedido+itens (e,
    //     quando necessario, clientes/modelos) carregaram sem erro — uma
    //     recarga que falhar (`state.loadingError` setado) preserva a trava
    //     de staleRevision e cai no ecrã de erro em vez de reabilitar Salvar
    //     sobre uma base incompleta ou mista.
    async function carregar() {
      state.loadingError = null;
      await carregarPedidoEItens();
      if (state.loadingError || !state.pedido) return;
      if (state.clientes.length === 0 || state.modelos.length === 0) await carregarClientesEModelos();
      if (state.loadingError) return;
      state.linkageCheckFailed = false;
      state.estruturaBloqueada = isTerminal(state.pedido.status) ? false : await detectarVinculoProducao();
      state.staleRevision = false;
    }

    await carregar();

    // -----------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------
    function buildHeader() {
      var labelPedido = state.pedido ? ('Editar pedido #' + state.pedido.numero) : 'Editar pedido';
      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap;'
      },
        window.el('div', { style: 'display:flex; align-items:flex-start; gap:16px;' },
          window.el('div', {
            style: 'width:36px; height:36px; border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
            onclick: function () { window.navigate('#/pedidos/' + pedidoId); }
          }, svgEl(SVG_BACK)),
          window.el('div', {},
            window.el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;' },
              window.el('h1', { style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;' }, labelPedido),
              state.pedido && window.pedidoStatusBadge ? window.pedidoStatusBadge(state.pedido.status) : null
            ),
            window.el('div', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-tertiary); margin-top:4px; max-width:760px;' },
              'Transições de status (confirmar, iniciar produção, cancelar) continuam na tela de detalhe do pedido.')
          )
        ),
        window.el('button', {
          type: 'button',
          style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer; white-space:nowrap;',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId); }
        }, 'Cancelar')
      );
    }

    // -----------------------------------------------------------------
    // Cartão "Dados gerais" — grade responsiva canônica (data-rv-pedido-dados,
    // já ratificada por #/pedidos/novo; 3/2/1 colunas nos mesmos breakpoints
    // independentemente do número de campos da linha).
    // -----------------------------------------------------------------
    function buildDadosGeraisCard(readOnly) {
      var clienteNome = (state.clientes.find(function (c) { return String(c.id) === String(state.fields.clienteId); }) || {}).nome || '—';

      var clienteControl;
      if (readOnly) {
        clienteControl = window.createReadonlyFieldValue({ text: clienteNome });
      } else {
        var clienteOpcoes = state.clientes.map(function (c) { return { value: c.id, label: c.nome }; });
        clienteControl = window.createSelectPopover({ options: clienteOpcoes, value: state.fields.clienteId, placeholder: 'Selecione o cliente...', ariaLabel: 'Cliente' });
        clienteControl.addEventListener('change', function () { state.fields.clienteId = clienteControl.value; });
      }

      var numeroControl = window.createReadonlyFieldValue({ text: state.pedido.numero != null ? String(state.pedido.numero) : '—' });

      var dataPedidoControl;
      if (readOnly) {
        dataPedidoControl = window.createReadonlyFieldValue({ text: window.fmtData ? window.fmtData(state.fields.dataPedido) : (state.fields.dataPedido || '—') });
      } else {
        var dataPedidoInput = window.el('input', {
          type: 'date', value: state.fields.dataPedido,
          style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
        });
        dataPedidoInput.addEventListener('change', function () { state.fields.dataPedido = dataPedidoInput.value; });
        dataPedidoControl = window.el('div', { style: fieldBoxStyle(false) }, dataPedidoInput, svgEl(SVG_CALENDAR));
      }

      var prazoControl;
      if (readOnly) {
        prazoControl = window.createReadonlyFieldValue({ text: state.fields.prazoEntrega ? (window.fmtData ? window.fmtData(state.fields.prazoEntrega) : state.fields.prazoEntrega) : '—' });
      } else {
        var prazoInput = window.el('input', {
          type: 'date', value: state.fields.prazoEntrega,
          style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
        });
        prazoInput.addEventListener('change', function () { state.fields.prazoEntrega = prazoInput.value; });
        prazoControl = window.el('div', { style: fieldBoxStyle(false) }, prazoInput, svgEl(SVG_CALENDAR));
      }

      var referenciaControl;
      if (readOnly) {
        referenciaControl = window.createReadonlyFieldValue({ text: state.fields.referenciaCliente || '—' });
      } else {
        var referenciaInput = window.el('input', {
          type: 'text', value: state.fields.referenciaCliente, maxlength: '120',
          style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
        });
        referenciaInput.addEventListener('input', function () { state.fields.referenciaCliente = referenciaInput.value; });
        referenciaControl = window.el('div', { style: fieldBoxStyle(false) }, referenciaInput);
      }

      var recebimentoOptions = FIELDS().TIPO_RECEBIMENTO_OPTIONS;
      var recebimentoLabel = (recebimentoOptions.find(function (o) { return o.value === state.fields.tipoRecebimento; }) || {}).label || '—';
      var recebimentoControl;
      if (readOnly) {
        recebimentoControl = window.createReadonlyFieldValue({ text: recebimentoLabel });
      } else {
        recebimentoControl = window.createSelectPopover({ options: recebimentoOptions, value: state.fields.tipoRecebimento, placeholder: 'Não definido', ariaLabel: 'Tipo de recebimento' });
        recebimentoControl.addEventListener('change', function () { state.fields.tipoRecebimento = recebimentoControl.value; });
      }

      var statusControl = window.createReadonlyFieldValue({ text: window.pedidoStatusLabel ? window.pedidoStatusLabel(state.pedido.status) : state.pedido.status });

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;'
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:12px;' }, 'Dados gerais'),
        window.el('div', {
          'data-rv-pedido-dados': '1',
          style: 'display:grid; grid-template-columns:minmax(0,22fr) minmax(0,11fr) minmax(0,13fr) minmax(0,13fr) minmax(0,17fr) minmax(0,13fr) minmax(0,11fr); column-gap:14px; row-gap:12px; align-items:start;'
        },
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Cliente', true), clienteControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Número do pedido'), numeroControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Data do pedido', true), dataPedidoControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Prazo desejado'), prazoControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Referência do cliente'), referenciaControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Tipo de recebimento'), recebimentoControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Status'), statusControl)
        )
      );
    }

    // -----------------------------------------------------------------
    // Cartão "Itens do pedido" — entrada dupla + prioridade.
    // -----------------------------------------------------------------
    function updateItensSummary() {
      var totals = DRAFT().totals(state.itens);
      container.querySelectorAll('[data-pedido-total-itens]').forEach(function (n) { n.textContent = String(totals.count); });
      container.querySelectorAll('[data-pedido-total-metros]').forEach(function (n) { n.textContent = totals.metrosLabel; });
      container.querySelectorAll('[data-pedido-checkout-summary]').forEach(function (n) {
        n.textContent = 'Resumo: ' + totals.count + ' item(ns) | ' + totals.metrosLabel;
      });
    }

    function buildItensCard(readOnly) {
      var api = itemRowApi();
      var locked = state.estruturaBloqueada;
      var rowsWrap = window.el('div', {});
      state.itens.forEach(function (item, idx) {
        rowsWrap.appendChild(api.buildRow({
          item: item, index: idx, modelos: state.modelos, typeMetadata: state.tipoMetadataOk,
          locked: locked, readOnly: readOnly,
          onChange: updateItensSummary,
          onMention: handleItemMention,
          onRemove: function (target) {
            state.itens = DRAFT().removeItem(state.itens, target.uid);
            render();
          }
        }));
      });

      var headerRow = window.el('div', {
        style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap;'
      }, window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Itens do pedido'));

      if (!readOnly) {
        var addBtn = window.el('button', {
          type: 'button', 'data-pedido-add-item': '1', disabled: locked ? 'disabled' : null,
          style: 'display:inline-flex; align-items:center; gap:8px; background:' + (locked ? 'var(--rv-surface-subtle)' : 'var(--rv-surface)') + '; color:' + (locked ? 'var(--rv-text-tertiary)' : 'var(--rv-accent-blue)') + '; border:1px solid ' + (locked ? 'var(--rv-border-soft)' : 'var(--rv-brand)') + '; border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 13px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:' + (locked ? 'not-allowed' : 'pointer') + '; white-space:nowrap;',
          onclick: locked ? null : function () {
            itemModalApi().openAddItemModal({
              modelos: state.modelos, typeMetadata: state.tipoMetadataOk,
              onConfirm: function (dados) { state.itens = DRAFT().addItem(state.itens, dados); render(); }
            });
          }
        }, svgEl(SVG_PLUS), 'Adicionar item');
        headerRow.appendChild(addBtn);
      }

      var table = window.el('div', { style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;' },
        window.el('div', { 'data-rv-table-scroll': '1', style: 'overflow-x:auto;' }, api.buildHeader(), rowsWrap),
        window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 14px; background:var(--rv-surface-subtle); flex-wrap:wrap;' },
          window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
            'Total de itens: ', window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;', 'data-pedido-total-itens': '1' }, String(state.itens.length))),
          window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
            'Metragem total: ', window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;', 'data-pedido-total-metros': '1' }, DRAFT().totalMetrosLabel(state.itens))))
      );

      var quickRowSlot = null;
      if (!readOnly) {
        var quickRowLink = window.el('button', {
          type: 'button', 'data-pedido-add-linha': '1', 'aria-label': 'Adicionar linha',
          title: locked ? 'Bloqueado: este pedido já tem produção vinculada' : 'Adicionar linha em branco à tabela',
          disabled: locked ? 'disabled' : null,
          style: 'display:inline-flex; align-items:center; background:none; border:none; border-radius:var(--rv-radius); padding:2px; margin:0; color:' + (locked ? 'var(--rv-text-tertiary)' : 'var(--rv-accent-blue)') + '; font-family:inherit; font-size:var(--rv-fs-sm); font-weight:600; line-height:1.4; text-decoration:underline; text-underline-offset:3px; cursor:' + (locked ? 'not-allowed' : 'pointer') + ';',
          onclick: locked ? null : function () { state.itens = DRAFT().addItem(state.itens); render(); }
        }, 'Adicionar linha');
        quickRowSlot = window.el('div', { 'data-pedido-add-linha-slot': '1', style: 'display:flex; align-items:center; justify-content:flex-end; margin-top:10px;' }, quickRowLink);
      }

      var priorityPanel = null;
      if (!readOnly) {
        priorityPanel = PRIORITY().painelDeCriacao(state, 'admin', { modelos: state.modelos }, render);
      }

      var children = [headerRow, table];
      if (quickRowSlot) children.push(quickRowSlot);
      if (priorityPanel) children.push(priorityPanel);
      if (readOnly) {
        var summary = PRIORITY().buildSummaryBlock({ pedido: state.pedido, role: 'admin', items: PRIORITY().projetarItensLocais(state, { modelos: state.modelos }), alwaysRender: true });
        if (summary) children.push(summary);
      }

      return window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;' }, children);
    }

    // -----------------------------------------------------------------
    // Observações gerais + Salvar (mesma composição de duas colunas de
    // #/pedidos/novo).
    // -----------------------------------------------------------------
    function buildBottomSection() {
      var obsTextarea = window.textArea({
        role: 'autosize', autosize: true, rows: 1, value: state.fields.observacao,
        placeholder: 'Informações adicionais sobre conferência, prazo ou observações internas...',
        ariaLabel: 'Observações gerais',
      });
      function syncObservacao() { state.fields.observacao = obsTextarea.value; }
      obsTextarea.addEventListener('input', syncObservacao);
      // Rastreamento de foco proprio, DELIBERADAMENTE sem reset no blur —
      // mesma tecnica e mesmo motivo de js/screens/pedido-form.js: um
      // clique no botao de mencao SEMPRE tira o foco do textarea ANTES do
      // onclick rodar, entao resetar no blur tornaria "inserir no caret
      // ativo" estruturalmente inalcancavel. selectionStart/selectionEnd
      // sobrevivem ao blur — o navegador nao os zera.
      obsTextarea.addEventListener('focus', function () { obsTextareaFocused = true; });
      obsTextareaRef = obsTextarea;
      obsTextareaFocused = false;
      syncObservacaoRef = syncObservacao;

      var instrCard = window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px;' },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Observações gerais'),
        obsTextarea);
      window.requestAnimationFrame(function () { window.autosizeTextarea(obsTextarea); });

      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0; width:100%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        disabled: state.staleRevision ? 'disabled' : null,
        onclick: function () { return salvar(saveBtn); }
      }, 'Salvar alterações');
      if (state.staleRevision) {
        saveBtn.setAttribute('style', 'background:var(--rv-surface-subtle); color:var(--rv-text-tertiary); border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0; width:100%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:not-allowed;');
      }

      var checkoutCard = window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; display:flex; flex-direction:column; justify-content:center;' },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Salvar alterações'),
        window.el('div', { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); line-height:1.5; margin-top:10px; margin-bottom:14px;', 'data-pedido-checkout-summary': '1' },
          'Resumo: ' + state.itens.length + ' item(ns) | ' + DRAFT().totalMetrosLabel(state.itens)),
        saveBtn);

      return window.el('div', { 'data-rv-2col': '1', style: 'display:grid; grid-template-columns:3fr 1fr; gap:12px; align-items:stretch;' }, instrCard, checkoutCard);
    }

    function buildTerminalNotice() {
      var label = window.pedidoStatusLabel ? window.pedidoStatusLabel(state.pedido.status) : state.pedido.status;
      return fullWidthNotice('neutral', 'Pedido encerrado',
        'Este pedido está no status "' + label + '", que é terminal. Ele não aceita mais edição administrativa.');
    }

    function buildStructuralLockNotice() {
      if (state.linkageCheckFailed) {
        return fullWidthNotice('caution', 'Não foi possível confirmar a produção vinculada',
          'Por segurança, os controles estruturais dos itens (tipo, modelo, metragem, adicionar e remover) foram bloqueados até que a verificação seja possível. Dados gerais, Observações gerais, a menção de itens e a prioridade continuam disponíveis.');
      }
      return fullWidthNotice('caution', 'Este pedido já tem produção vinculada',
        'Alterar modelo, quantidade ou a composição de itens exige o fluxo separado de reconciliação de produção. Dados gerais, Observações gerais, a menção de itens e a prioridade continuam disponíveis.');
    }

    function buildStaleRevisionNotice() {
      return fullWidthNotice('negative', 'Este pedido mudou desde a abertura do editor',
        'Alguém salvou uma alteração neste pedido enquanto esta tela estava aberta. Para evitar sobrescrever esse trabalho, recarregue os dados antes de salvar novamente.',
        [window.el('button', {
          type: 'button',
          style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 16px; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
          onclick: async function () { await carregar(); render(); },
        }, 'Recarregar dados')]);
    }

    // -----------------------------------------------------------------
    // Salvar — payload seco (NULL nas seções inalteradas), concorrência
    // por revisao, erros estáveis, retry congelado de impacto de produção.
    // -----------------------------------------------------------------
    function computePrioridadeChanged() {
      var enabledChanged = !!state.prioridadeHabilitada !== !!state.prioridadeBaseline.habilitada;
      if (!state.prioridadeHabilitada) return enabledChanged;
      var seqAtual = state.itens.map(function (it) { return it.itemId; });
      var seqBase = state.prioridadeBaseline.sequencia || [];
      var seqChanged = seqAtual.length !== seqBase.length || seqAtual.some(function (id, i) { return id !== seqBase[i]; });
      return enabledChanged || seqChanged;
    }

    async function salvar(btn) {
      if (!state.pedido || isTerminal(state.pedido.status) || state.staleRevision) return;

      var fieldsValidation = FIELDS().validate(state.fields);
      if (!fieldsValidation.valid) { window.toast(fieldsValidation.errors[0], 'error'); return; }
      var itemsValidation = DRAFT().validate(state.itens);
      if (!itemsValidation.valid) { window.toast(itemsValidation.errors[0].message, 'error'); return; }

      var headerPayload = FIELDS().buildHeaderPayload(state.fields, state.fieldsBaseline);
      var itensChanged = DRAFT().isCollectionChanged(state.itens, state.itensBaseline);
      var itensPayload = itensChanged ? DRAFT().toRpcPayload(state.itens) : null;
      var prioridadeChanged = computePrioridadeChanged();
      var pPrioridade = prioridadeChanged ? !!state.prioridadeHabilitada : null;

      if (headerPayload === null && itensPayload === null && pPrioridade === null) {
        window.toast('Não há alterações para salvar.', 'info');
        return;
      }

      await executarSalvar(btn, { header: headerPayload, itens: itensPayload, prioridade: pPrioridade, confirmarImpacto: false });
    }

    async function executarSalvar(btn, payload) {
      var oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      function restaurar() { btn.disabled = false; btn.textContent = oldLabel; }

      var r;
      try {
        r = await window.supa.rpc('salvar_pedido_admin', {
          p_pedido_id: pedidoId,
          p_base_revisao: state.baseRevisao,
          p_header: payload.header,
          p_itens: payload.itens,
          p_prioridade: payload.prioridade,
          p_confirmar_impacto: !!payload.confirmarImpacto,
        });
      } catch (e) {
        window.toast('Erro inesperado ao salvar.', 'error');
        console.error('pedido-edit: rpc salvar_pedido_admin lancou', e);
        restaurar();
        return;
      }

      if (r.error) {
        handleSaveError(r.error, btn, payload, restaurar);
        return;
      }

      window.toast('Pedido atualizado.', 'success');
      window.navigate('#/pedidos/' + pedidoId);
    }

    function handleSaveError(error, btn, payload, restaurar) {
      var msg = (error && error.message) || '';
      function has(token) { return msg.indexOf(token) !== -1; }

      if (has('PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA')) {
        state.staleRevision = true;
        render();
        return;
      }
      if (has('PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED')) {
        restaurar();
        PRIORITY().openImpactoProducao({
          onConfirmar: function () { executarSalvar(btn, Object.assign({}, payload, { confirmarImpacto: true })); },
          onCancelar: function () {},
        });
        return;
      }
      if (has('PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP') || has('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP')) {
        window.toast('Este pedido já tem produção vinculada; alterações estruturais exigem o fluxo de reconciliação de produção.', 'error');
        state.estruturaBloqueada = true;
        render();
        return;
      }
      if (has('PEDIDO_ALTERACAO_PEDIDO_TERMINAL')) {
        window.toast('Este pedido não aceita mais edição.', 'error');
        carregar().then(render);
        return;
      }
      if (has('PEDIDO_ALTERACAO_FORBIDDEN')) {
        window.toast('Operação restrita a administradores.', 'error');
        restaurar();
        return;
      }
      if (has('PEDIDO_ALTERACAO_ITEM_SET_INVALIDO')) {
        window.toast('Composição de itens inválida: ' + msg, 'error');
        restaurar();
        return;
      }
      if (has('PEDIDO_PRIORITY_PEDIDO_READ_ONLY')) {
        window.toast('A prioridade não pode ser alterada neste status.', 'error');
        restaurar();
        return;
      }

      window.toast('Erro ao salvar pedido: ' + (msg || 'desconhecido'), 'error');
      console.error('pedido-edit: erro ao salvar', error);
      restaurar();
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    function render() {
      if (state.loadingError === 'pedido') {
        container.replaceChildren(buildHeader(), errorCard('Pedido não encontrado. Ele pode ter sido removido.'));
        return;
      }
      if (state.loadingError) {
        container.replaceChildren(buildHeader(), errorCard('Erro ao carregar ' + state.loadingError + '. Tente recarregar a página.'));
        return;
      }

      if (isTerminal(state.pedido.status)) {
        container.replaceChildren(buildHeader(), buildTerminalNotice(), buildDadosGeraisCard(true), buildItensCard(true));
        return;
      }

      var nodes = [buildHeader()];
      if (state.staleRevision) nodes.push(buildStaleRevisionNotice());
      if (state.estruturaBloqueada) nodes.push(buildStructuralLockNotice());
      nodes.push(buildDadosGeraisCard(false));
      nodes.push(buildItensCard(false));
      nodes.push(buildBottomSection());
      container.replaceChildren.apply(container, nodes);
    }

    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoEdit = { screenPedidoEditar: screenPedidoEditar };
  window.screenPedidoEditar = screenPedidoEditar;
})(window);
