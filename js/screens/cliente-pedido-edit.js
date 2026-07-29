// =====================================================================
// === SCREENS: CLIENTE PEDIDO EDIT ====================================
// Editor do Cliente sobre o proprio Pedido — Fase 4 da sequencia unificada.
// Rota: `#/cliente/pedidos/<uuid>/editar` (parseada por js/router.js).
//
// Fase: PEDIDO-CLIENT-EDITOR-REQUEST-SUBMISSION-R1.
//
// DOIS MODOS DE ESCRITA, decididos por lifecycle (U10.3), nunca por uma
// tela separada:
//   - PRE-ACEITACAO (status rascunho|recebido) — "Salvar alteracoes",
//     direto em public.salvar_pedido_cliente(p_pedido_id, p_base_revisao,
//     p_header, p_itens, p_prioridade). Concorrencia por pedidos.revisao.
//   - POS-ACEITACAO, nao terminal — "Enviar solicitacao de alteracao",
//     via public.solicitar_alteracao_pedido(p_pedido_id, p_header, p_itens,
//     p_prioridade, p_mensagem). NUNCA toca o Pedido vivo; substitui
//     atomicamente qualquer solicitacao pendente anterior.
//   - TERMINAL — o editor nao abre; ver render().
//
// DONOS COMPARTILHADOS consumidos, nunca duplicados (U10.1):
//   - js/pedido-draft.js   — colecao local de itens, totais, validacao,
//     payload de itens, deteccao de mudanca (com o novo terceiro
//     parametro opcional `{ compareObservacao: true }`, que este editor
//     usa e o administrativo nunca usa).
//   - js/pedido-fields.js  — estado de campos gerais, payload de
//     cabecalho, deteccao de mudanca. `capabilities('cliente', modo)` e o
//     descritor de capacidade por lifecycle (novo nesta fase).
//   - js/pedido-priority.js — painel de prioridade (`painelDeCriacao`),
//     reaproveitado tal como o editor administrativo reaproveita.
//   - js/screens/pedido-item-row-editor.js — SOMENTE os derivadores puros
//     (rotaDoModelo, modelosPorTipo, modeloOptionLabel, fillTipoSelect,
//     fillModeloSelect, corResumo, larguraStr): a linha do Cliente precisa
//     de uma observacao de item EDITAVEL, que o contrato administrativo
//     aceito RETIROU da linha (PEDIDO-ITEM-MENTION-OBSERVATION-UX-R1) — as
//     duas linhas tem formas visuais genuinamente diferentes, entao esta
//     tela constroi a SUA PROPRIA linha em vez de forcar um modo condicional
//     dentro de buildRow() que pesaria sobre o contrato administrativo
//     aceito (sete colunas, 790px, sem observacao editavel, com a acao de
//     mencao). buildRow()/GRID_COLS/HEADER_LABELS permanecem INTOCADOS.
//
// CAPACIDADE ESTRUTURAL (Modo C — aceito, com OP): nao existe leitura
// client-safe do helper owner-only public.pedido_tem_op_relacionada (db/93
// revogou EXECUTE ate de `authenticated`). O sinal usado e
// `chain_state.isOperationalOverride`, ja devolvido pela RPC client-safe
// ACEITA `cliente_pedido_summary()` (db/30) e ja consumido para o mesmo fim
// em js/screens/cliente-pedido-detail.js. E uma APROXIMACAO honesta (cobre
// ops-via-lotes e expedicoes-via-pedido_id; nao cobre isoladamente um
// op_itens/expedicao_itens sem OP/expedicao propria vinculada ao pedido —
// um caso extremo que exigiria uma nova leitura client-safe, fora do escopo
// desta fase) — NUNCA a autoridade. A autoridade e sempre o servidor:
// solicitar_alteracao_pedido recusa uma proposta estrutural de verdade com
// PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP independentemente do que esta
// tela mostrar. Na pior hipotese de descompasso, o Cliente ve controles
// habilitados e recebe uma recusa clara ao submeter — nunca um bypass.
//
// NUNCA renderiza: pedidos.numero, pedidos.status bruto, OP, lote,
// fornecedor, ordem de compra, documento fiscal, custo ou qualquer
// identificador interno de producao.
//
// Leituras diretas em `pedidos`/`pedido_itens` (SELECT apenas — a mesma
// tecnica ja usada por js/screens/cliente-pedido-detail.js em
// carregarPrioridade()). Toda ESCRITA passa exclusivamente por
// salvar_pedido_cliente / solicitar_alteracao_pedido / retirar_alteracao_
// pedido, ou pelo caminho direto de prioridade ja aceito (definir_
// prioridade_pedido, via js/pedido-priority.js) antes da aceitacao.
//
// Carregar via <script src="js/screens/cliente-pedido-edit.js?v=...">
// no <head>, DEPOIS de js/pedido-draft.js, js/pedido-fields.js,
// js/pedido-priority.js e js/screens/pedido-item-row-editor.js, e ANTES do
// <script> principal (boot.js).
// =====================================================================

(function (window) {
  'use strict';

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var TERMINAL_STATUSES = ['entregue', 'cancelado'];
  var PRE_ACCEPTANCE_STATUSES = ['rascunho', 'recebido'];

  function DRAFT() { return window.RAVATEX_PEDIDO_DRAFT; }
  function FIELDS() { return window.RAVATEX_PEDIDO_FIELDS; }
  function PRIORITY() { return window.RAVATEX_PEDIDO_PRIORITY; }
  function ROWAPI() { return window.RAVATEX_PEDIDO_ITEM_ROW; }

  function svgEl(markup) {
    var tmp = window.document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }
  var SVG_BACK = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  var SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var SVG_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rv-signal-negative)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

  function modeOf(status) {
    if (TERMINAL_STATUSES.indexOf(status) !== -1) return 'terminal';
    if (PRE_ACCEPTANCE_STATUSES.indexOf(status) !== -1) return 'preAceite';
    return 'posAceite';
  }

  function fieldBoxStyle() {
    return 'display:flex; align-items:center; gap:8px; height:var(--rv-h-compact); box-sizing:border-box;'
      + ' border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); padding:0 12px; background:var(--rv-surface);';
  }
  function buildFieldLabel(text) {
    return window.el('label', {
      style: 'display:block; font-size:var(--rv-fs-sm); color:var(--rv-text-secondary); margin-bottom:5px; white-space:nowrap;'
    }, text);
  }

  function fullWidthNotice(tone, title, message, actions) {
    var palette = {
      caution: { bg: 'var(--rv-signal-caution-bg)', border: 'var(--rv-signal-caution-border)', text: 'var(--rv-signal-caution)' },
      negative: { bg: 'var(--rv-pill-negative-bg)', border: 'var(--rv-pill-negative-border)', text: 'var(--rv-signal-negative)' },
      neutral: { bg: 'var(--rv-surface-subtle)', border: 'var(--rv-border)', text: 'var(--rv-text-secondary)' },
      info: { bg: 'var(--rv-pill-info-bg)', border: 'var(--rv-accent-blue)', text: 'var(--rv-accent-blue)' },
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
      'data-cliente-pedido-notice': '1',
    }, children);
  }

  async function screenClientePedidoEditar(pedidoId) {
    function backToDetail() { window.navigate('#/cliente/pedidos/' + pedidoId); }

    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido invalido.', 'error');
      return window.clienteShellLayout(window.el('div', {},
        window.pageHeader('Pedido'),
        window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-signal-negative-border); border-radius:var(--rv-radius); padding:16px 20px; color:var(--rv-signal-negative);' },
          'Pedido invalido. Volte para a lista e tente novamente.'),
        window.el('div', { style: 'margin-top:14px;' },
          window.el('button', {
            type: 'button',
            style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, '← Voltar para pedidos'))
      ));
    }

    var container = window.el('div', {});

    var state = {
      pedido: null,
      fields: null,
      fieldsBaseline: null,
      itens: [],
      itensBaseline: [],
      modelos: [],
      tipoMetadataOk: false,
      mode: 'preAceite',
      isOperationalOverride: false,
      statusLabel: '',
      pendente: null,
      loadingError: null,
      staleRevision: false,
      mensagem: '',
      prioridadeHabilitada: false,
      prioridadeBaseline: { habilitada: false, sequencia: [] },
    };

    function locked() { return state.mode === 'posAceite' && state.isOperationalOverride; }

    // -------------------------------------------------------------
    // Carregamento — leituras SOMENTE de SELECT (nunca UPDATE/DELETE
    // diretos). A mesma RLS de "le so o proprio pedido" que ja sustenta
    // js/screens/cliente-pedido-detail.js.
    // -------------------------------------------------------------
    async function carregarPedidoEItens() {
      var pedidoRes = await window.supa
        .from('pedidos')
        .select('id, data_pedido, status, prazo_entrega, referencia_cliente, tipo_recebimento, observacao, revisao, prioridade_status, criado_em')
        .eq('id', pedidoId)
        .maybeSingle();
      if (pedidoRes.error || !pedidoRes.data) {
        state.loadingError = 'pedido';
        window.toast('Pedido nao encontrado ou sem permissao.', 'error');
        console.error('cliente-pedido-edit:', pedidoRes.error);
        return;
      }
      state.pedido = pedidoRes.data;
      state.mode = modeOf(pedidoRes.data.status);
      state.fields = FIELDS().fromPersisted(pedidoRes.data);
      state.fieldsBaseline = FIELDS().fromPersisted(pedidoRes.data);

      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, modelo_id, metros, largura, observacao, ordem')
        .eq('pedido_id', pedidoId)
        .order('ordem', { ascending: true });
      if (itensRes.error) {
        state.loadingError = 'itens';
        window.toast('Erro ao carregar itens do pedido.', 'error');
        console.error('cliente-pedido-edit:', itensRes.error);
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

    async function carregarModelos() {
      var modRes = await window.supa
        .from('modelos')
        .select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)')
        .order('nome');
      if (modRes.error) {
        state.loadingError = state.loadingError || 'modelos';
        window.toast('Erro ao carregar modelos.', 'error');
        console.error('cliente-pedido-edit:', modRes.error);
        return;
      }
      state.modelos = modRes.data || [];
      try {
        var tpRes = await window.supa.from('modelos').select('id, tipo_produto');
        if (tpRes.error || !Array.isArray(tpRes.data)) {
          state.loadingError = state.loadingError || 'tipo de produto dos modelos';
          console.error('cliente-pedido-edit: tipo_produto indisponivel', tpRes.error);
          return;
        }
        var tpById = {};
        tpRes.data.forEach(function (row) { if (row && row.id != null) tpById[String(row.id)] = row.tipo_produto; });
        state.modelos.forEach(function (m) { if (tpById[String(m.id)] != null) m.tipo_produto = tpById[String(m.id)]; });
        state.tipoMetadataOk = true;
      } catch (e) {
        state.loadingError = state.loadingError || 'tipo de produto dos modelos';
        console.error('cliente-pedido-edit: tipo_produto indisponivel', e);
      }
    }

    // `chain_state.isOperationalOverride` (db/30, ja aceito e ja consumido em
    // cliente-pedido-detail.js) e o UNICO sinal client-safe disponivel para
    // aproximar "existe OP relacionada" nesta tela. Ver nota de topo do
    // arquivo. Falha de leitura aqui NAO bloqueia a tela — apenas mantem o
    // sinal em `false` (o servidor continua sendo a autoridade real).
    async function carregarResumoESinalOperacional() {
      var res = await window.supa.rpc('cliente_pedido_summary', { p_pedido_id: pedidoId });
      if (res.error || !res.data) return;
      var payload = res.data;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (_) { payload = null; } }
      if (Array.isArray(payload)) payload = payload[0] || null;
      if (!payload || payload.ok === false) return;
      var chain = payload.chain_state || {};
      state.isOperationalOverride = !!chain.isOperationalOverride;
      state.statusLabel = chain.displayStatus || (window.pedidoStatusLabel ? window.pedidoStatusLabel(state.pedido.status) : '');
    }

    async function carregarSolicitacaoPendente() {
      var res = await window.supa.rpc('cliente_alteracao_resumo', { p_pedido_id: pedidoId });
      if (res.error || !res.data) { state.pendente = null; return; }
      var payload = res.data;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (_) { payload = null; } }
      if (Array.isArray(payload)) payload = payload[0] || null;
      state.pendente = (payload && payload.ok !== false) ? (payload.pendente || null) : null;
    }

    // `carregar()` e o UNICO ponto de leitura, tanto no boot da tela quanto
    // na recarga explicita apos PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA — sem
    // retry automatico e sem merge: cada chamada SUBSTITUI integralmente
    // fields/itens/baselines a partir da leitura fresca.
    async function carregar() {
      state.loadingError = null;
      await carregarPedidoEItens();
      if (state.loadingError || !state.pedido) return;
      if (state.modelos.length === 0) await carregarModelos();
      if (state.loadingError) return;
      await carregarResumoESinalOperacional();
      await carregarSolicitacaoPendente();
      state.staleRevision = false;
    }

    // -------------------------------------------------------------
    // Header — identidade pelo referencia_cliente + data, NUNCA pelo
    // numero interno; status sanitizado apenas.
    // -------------------------------------------------------------
    function buildHeader() {
      var identidade = state.fields && state.fields.referenciaCliente
        ? state.fields.referenciaCliente
        : (state.pedido && state.pedido.criado_em ? 'Pedido de ' + window.fmtDataCurta(state.pedido.criado_em) : 'Pedido');
      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap;'
      },
        window.el('div', { style: 'display:flex; align-items:flex-start; gap:16px;' },
          window.el('div', {
            style: 'width:36px; height:36px; border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer;',
            onclick: backToDetail,
          }, svgEl(SVG_BACK)),
          window.el('div', {},
            window.el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;' },
              window.el('h1', { style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;' }, 'Editar pedido'),
              state.statusLabel ? window.el('span', {
                style: 'display:inline-flex; align-items:center; background:var(--rv-pill-info-bg); color:var(--rv-accent-blue); border-radius:var(--rv-radius); padding:4px 11px; font-size:12.5px; font-weight:700;',
              }, state.statusLabel) : null
            ),
            window.el('div', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-tertiary); margin-top:4px;' }, identidade)
          )
        ),
        window.el('button', {
          type: 'button',
          style: 'background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 18px; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer; white-space:nowrap;',
          onclick: backToDetail,
        }, 'Cancelar')
      );
    }

    // -------------------------------------------------------------
    // Dados gerais — data_pedido sempre somente-leitura (U13.1/C2).
    // -------------------------------------------------------------
    function buildDadosGeraisCard() {
      var cap = FIELDS().capabilities('cliente', state.mode);
      var editable = cap.editableHeaderFields.length > 0;

      var dataPedidoControl = window.createReadonlyFieldValue({
        text: state.fields.dataPedido ? window.fmtDataCurta(state.fields.dataPedido) : '—',
      });

      var prazoControl;
      if (editable) {
        var prazoInput = window.el('input', {
          type: 'date', value: state.fields.prazoEntrega,
          style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
        });
        prazoInput.addEventListener('change', function () { state.fields.prazoEntrega = prazoInput.value; });
        prazoControl = window.el('div', { style: fieldBoxStyle() }, prazoInput);
      } else {
        prazoControl = window.createReadonlyFieldValue({ text: state.fields.prazoEntrega ? window.fmtDataCurta(state.fields.prazoEntrega) : '—' });
      }

      var referenciaControl;
      if (editable) {
        var referenciaInput = window.el('input', {
          type: 'text', value: state.fields.referenciaCliente, maxlength: '120',
          style: 'flex:1; border:none; outline:none; font-size:var(--rv-fs-body); color:var(--rv-text-primary); background:transparent; font-family:inherit; min-width:0;'
        });
        referenciaInput.addEventListener('input', function () { state.fields.referenciaCliente = referenciaInput.value; });
        referenciaControl = window.el('div', { style: fieldBoxStyle() }, referenciaInput);
      } else {
        referenciaControl = window.createReadonlyFieldValue({ text: state.fields.referenciaCliente || '—' });
      }

      var recebimentoOptions = FIELDS().TIPO_RECEBIMENTO_OPTIONS;
      var recebimentoLabel = (recebimentoOptions.find(function (o) { return o.value === state.fields.tipoRecebimento; }) || {}).label || '—';
      var recebimentoControl;
      if (editable) {
        recebimentoControl = window.createSelectPopover({ options: recebimentoOptions, value: state.fields.tipoRecebimento, placeholder: 'Nao definido', ariaLabel: 'Tipo de recebimento' });
        recebimentoControl.addEventListener('change', function () { state.fields.tipoRecebimento = recebimentoControl.value; });
      } else {
        recebimentoControl = window.createReadonlyFieldValue({ text: recebimentoLabel });
      }

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;'
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:12px;' }, 'Dados gerais'),
        window.el('div', {
          'data-rv-pedido-dados': '1',
          style: 'display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr); column-gap:14px; row-gap:12px; align-items:start;'
        },
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Data do pedido'), dataPedidoControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Prazo desejado'), prazoControl),
          window.el('div', { style: 'min-width:0;' }, buildFieldLabel('Tipo de recebimento'), recebimentoControl),
          window.el('div', { style: 'min-width:0; grid-column:1 / -1;' }, buildFieldLabel('Referencia do cliente'), referenciaControl)
        )
      );
    }

    // -------------------------------------------------------------
    // Itens — linha PROPRIA do Cliente (observacao editavel, sem mencao).
    // Reaproveita SOMENTE os derivadores puros de pedido-item-row-editor.js.
    // -------------------------------------------------------------
    function updateItensSummary() {
      var totals = DRAFT().totals(state.itens);
      container.querySelectorAll('[data-pedido-total-itens]').forEach(function (n) { n.textContent = String(totals.count); });
      container.querySelectorAll('[data-pedido-total-metros]').forEach(function (n) { n.textContent = totals.metrosLabel; });
    }

    function buildClientItemRow(item, index) {
      var api = ROWAPI();
      var itemLocked = locked();

      if (item.modeloId) {
        var atual = api.modeloById(state.modelos, item.modeloId);
        if (atual) item.tipo = api.rotaDoModelo(atual);
      }

      var previewSlot = window.el('div', {
        style: 'width:32px; height:32px; border-radius:var(--rv-radius); overflow:hidden; border:1px solid var(--rv-border); background:var(--rv-surface-subtle); flex-shrink:0; display:flex; align-items:center; justify-content:center;'
      });
      function refreshPreview() {
        previewSlot.replaceChildren();
        var m = api.modeloById(state.modelos, item.modeloId);
        if (m && m.cor_1 && window.corPreviewElement) {
          var node = window.corPreviewElement(m.cor_1.nome, '100%');
          if (node) { node.style.border = 'none'; previewSlot.appendChild(node); return; }
        }
        previewSlot.appendChild(window.el('div', { style: 'width:100%; height:100%; background:' + (m ? window.corPreviewHex(m.cor_1 && m.cor_1.nome) : 'var(--rv-surface-subtle)') + ';' }));
      }

      var tipoSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Tipo' });
      var modeloSelect = window.createSelectPopover({ options: [], value: '', ariaLabel: 'Modelo' });
      var coresCell = window.el('div', { style: 'font-size:13.5px;' });
      var larguraCell = window.el('div', { style: 'font-size:13.5px;' });

      function paint(cell, value, filled) {
        cell.textContent = value;
        cell.style.color = filled ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)';
      }
      function refreshDerived() {
        var m = api.modeloById(state.modelos, item.modeloId);
        paint(coresCell, m ? api.corResumo(m) : '-', !!m);
        paint(larguraCell, m ? api.larguraStr(m) : '-', !!m);
        refreshPreview();
      }

      tipoSelect.addEventListener('change', function () {
        item.tipo = tipoSelect.value;
        var atual2 = api.modeloById(state.modelos, item.modeloId);
        if (!item.tipo || (atual2 && api.rotaDoModelo(atual2) !== item.tipo)) item.modeloId = '';
        api.fillModeloSelect(modeloSelect, state.modelos, item.tipo, item.modeloId);
        refreshDerived();
        updateItensSummary();
      });
      modeloSelect.addEventListener('change', function () {
        item.modeloId = modeloSelect.value;
        refreshDerived();
        updateItensSummary();
      });

      var metrosInput = window.el('input', {
        type: 'number', value: item.metros, placeholder: '0,00', step: '0.01', min: '0.01',
        style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); padding:6px 8px; font-size:13.5px; font-weight:600; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;'
      });
      metrosInput.addEventListener('input', function () { item.metros = metrosInput.value; updateItensSummary(); });

      var obsInput = window.el('input', {
        type: 'text', value: item.observacao, placeholder: 'Observacao do item (opcional)',
        'data-cliente-item-observacao': '1',
        style: 'width:100%; border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius); padding:6px 8px; font-size:13.5px; color:var(--rv-text-primary); background:var(--rv-surface); font-family:inherit; outline:none;'
      });
      obsInput.addEventListener('input', function () { item.observacao = obsInput.value; });

      var removeBtn = window.actionButton({
        title: 'Remover item',
        icon: svgEl(SVG_TRASH),
        danger: true,
        disabled: itemLocked,
        onclick: function () {
          state.itens = state.itens.filter(function (it) { return it.uid !== item.uid; });
          render();
        },
      });

      api.fillTipoSelect(tipoSelect, item.tipo, itemLocked || !state.tipoMetadataOk);
      api.fillModeloSelect(modeloSelect, state.modelos, state.tipoMetadataOk ? item.tipo : '', item.modeloId);
      if (itemLocked) modeloSelect.disabled = true;
      refreshDerived();
      if (itemLocked) metrosInput.disabled = true;

      return window.el('div', {
        style: 'display:grid; grid-template-columns:40px .70fr 1.30fr .95fr .70fr .80fr 1.30fr 40px; align-items:center; gap:10px; padding:9px 14px; border-bottom:1px solid var(--rv-border-soft); min-width:820px;',
        'data-uid': item.uid,
      }, previewSlot, tipoSelect, modeloSelect, coresCell, larguraCell, metrosInput, obsInput, removeBtn);
    }

    function buildItensHeader() {
      var labels = ['Img', 'Tipo', 'Modelo', 'Cores', 'Largura', 'Metragem (m)', 'Observacao', 'Acoes'];
      return window.el('div', {
        style: 'display:grid; grid-template-columns:40px .70fr 1.30fr .95fr .70fr .80fr 1.30fr 40px; align-items:center; gap:10px; padding:8px 14px; background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border); min-width:820px;'
      }, labels.map(function (l) { return window.el('div', { style: 'font-size:12.5px; font-weight:600; color:var(--rv-text-secondary);' }, l); }));
    }

    function buildItensCard() {
      var rowsWrap = window.el('div', {});
      state.itens.forEach(function (item, idx) { rowsWrap.appendChild(buildClientItemRow(item, idx)); });

      var addBtn = window.el('button', {
        type: 'button',
        disabled: locked() ? 'disabled' : null,
        style: 'display:inline-flex; align-items:center; gap:8px; background:' + (locked() ? 'var(--rv-surface-subtle)' : 'var(--rv-surface)') + '; color:' + (locked() ? 'var(--rv-text-tertiary)' : 'var(--rv-accent-blue)') + '; border:1px solid ' + (locked() ? 'var(--rv-border-soft)' : 'var(--rv-brand)') + '; border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 13px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:' + (locked() ? 'not-allowed' : 'pointer') + ';',
        onclick: locked() ? null : function () { state.itens = DRAFT().addItem(state.itens); render(); },
      }, svgEl(SVG_PLUS), 'Adicionar item');

      var table = window.el('div', { style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;' },
        window.el('div', { 'data-rv-table-scroll': '1', style: 'overflow-x:auto;' }, buildItensHeader(), rowsWrap),
        window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 14px; background:var(--rv-surface-subtle); flex-wrap:wrap;' },
          window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
            'Total de itens: ', window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;', 'data-pedido-total-itens': '1' }, String(state.itens.length))),
          window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-secondary);' },
            'Metragem total: ', window.el('strong', { style: 'color:var(--rv-text-primary); font-weight:700;', 'data-pedido-total-metros': '1' }, DRAFT().totalMetrosLabel(state.itens)))
        ));

      var priorityPanel = null;
      var api = PRIORITY();
      var showPriorityControls = state.mode === 'preAceite'
        ? api.clientePodeEditar(state.pedido, state.itens.length)
        : api.aplicavel(state.itens.length);
      if (showPriorityControls) {
        priorityPanel = api.painelDeCriacao(state, 'cliente', { modelos: state.modelos }, render);
      } else {
        priorityPanel = api.buildSummaryBlock({
          pedido: state.pedido, role: 'cliente',
          items: api.projetarItensLocais(state, { modelos: state.modelos }),
          alwaysRender: false,
        });
      }

      return window.el('div', {
        style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;'
      },
        window.el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap;' },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' }, 'Itens do pedido'),
          addBtn),
        table,
        priorityPanel
      );
    }

    // -------------------------------------------------------------
    // Observacoes gerais + mensagem da solicitacao (so em modo posAceite).
    // -------------------------------------------------------------
    function buildBottomSection(saveBtn) {
      var cap = FIELDS().capabilities('cliente', state.mode);
      var editable = cap.editableHeaderFields.indexOf('observacao') !== -1;

      var obsControl;
      if (editable) {
        var obsTextarea = window.textArea({
          role: 'autosize', autosize: true, rows: 1, value: state.fields.observacao,
          placeholder: 'Informacoes adicionais sobre o pedido...', ariaLabel: 'Observacoes gerais',
        });
        obsTextarea.addEventListener('input', function () { state.fields.observacao = obsTextarea.value; });
        obsControl = obsTextarea;
      } else {
        obsControl = window.createReadonlyFieldValue({ text: state.fields.observacao || '—' });
      }

      var cards = [
        window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px;' },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Observacoes gerais'),
          obsControl)
      ];

      if (state.mode === 'posAceite') {
        var msgTextarea = window.textArea({
          role: 'autosize', autosize: true, rows: 1, value: state.mensagem,
          placeholder: 'Explique o motivo da solicitacao (opcional)...', ariaLabel: 'Mensagem da solicitacao',
        });
        msgTextarea.addEventListener('input', function () { state.mensagem = msgTextarea.value; });
        cards.push(window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px;' },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:10px;' }, 'Mensagem para a equipe'),
          msgTextarea));
      }

      var instrCard = window.el('div', {}, cards);

      var checkoutCard = window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none); padding:16px; display:flex; flex-direction:column; justify-content:center;' },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);' },
          state.mode === 'preAceite' ? 'Salvar alteracoes' : 'Enviar solicitacao de alteracao'),
        window.el('div', { style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); line-height:1.5; margin-top:10px; margin-bottom:14px;' },
          state.mode === 'preAceite'
            ? 'As alteracoes sao aplicadas imediatamente ao seu pedido.'
            : 'O pedido aceito pela equipe permanece inalterado ate a revisao administrativa.'),
        saveBtn);

      return window.el('div', { 'data-rv-2col': '1', style: 'display:grid; grid-template-columns:3fr 1fr; gap:12px; align-items:stretch;' }, instrCard, checkoutCard);
    }

    // -------------------------------------------------------------
    // Notices de lifecycle e de solicitacao pendente.
    // -------------------------------------------------------------
    function buildStructuralLockNotice() {
      return fullWidthNotice('caution', 'Este pedido ja esta em producao',
        'Alterar modelo, metragem, adicionar ou remover itens exige revisao administrativa e pode nao ser aprovado. Dados gerais, observacoes, itens e prioridade continuam propostos normalmente.');
    }
    function buildStaleRevisionNotice() {
      return fullWidthNotice('negative', 'Este pedido mudou desde a abertura do editor',
        'Para evitar sobrescrever uma alteracao mais recente, recarregue os dados antes de salvar novamente.',
        [window.el('button', {
          type: 'button',
          style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 16px; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
          onclick: async function () { await carregar(); render(); },
        }, 'Recarregar dados')]);
    }
    function buildPendingRequestNotice() {
      if (!state.pendente) return null;
      var acoes = [window.el('button', {
        type: 'button',
        style: 'background:var(--rv-surface); color:var(--rv-signal-negative); border:1px solid var(--rv-signal-negative-border); border-radius:var(--rv-radius); height:var(--rv-h-default); padding:0 16px; font-weight:600; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        onclick: function () { return retirarSolicitacao(state.pendente.solicitacao_id); },
      }, 'Retirar solicitacao')];
      return fullWidthNotice('info', 'Voce tem uma solicitacao de alteracao pendente',
        'O pedido aceito pela equipe continua exatamente como esta. As alteracoes que voce propos aguardam revisao administrativa. Enviar uma nova solicitacao substitui esta automaticamente.',
        acoes);
    }

    // -------------------------------------------------------------
    // Salvar (Modo A) / Enviar solicitacao (Modo B/C) / Retirar.
    // -------------------------------------------------------------
    function computePrioridadeChanged() {
      var enabledChanged = !!state.prioridadeHabilitada !== !!state.prioridadeBaseline.habilitada;
      if (!state.prioridadeHabilitada) return enabledChanged;
      var seqAtual = state.itens.map(function (it) { return it.itemId; });
      var seqBase = state.prioridadeBaseline.sequencia || [];
      var seqChanged = seqAtual.length !== seqBase.length || seqAtual.some(function (id, i) { return id !== seqBase[i]; });
      return enabledChanged || seqChanged;
    }

    function buildDirtyPayload() {
      var headerPayload = FIELDS().buildHeaderPayload(state.fields, state.fieldsBaseline);
      var itensChanged = DRAFT().isCollectionChanged(state.itens, state.itensBaseline, { compareObservacao: true });
      var itensPayload = itensChanged ? DRAFT().toRpcPayload(state.itens) : null;
      var prioridadeChanged = computePrioridadeChanged();
      var pPrioridade = prioridadeChanged ? !!state.prioridadeHabilitada : null;
      return { header: headerPayload, itens: itensPayload, prioridade: pPrioridade };
    }

    async function salvarOuSolicitar(btn) {
      if (!state.pedido || state.mode === 'terminal' || state.staleRevision) return;

      var fieldsValidation = FIELDS().validate(state.fields, 'cliente');
      if (!fieldsValidation.valid) { window.toast(fieldsValidation.errors[0], 'error'); return; }
      var itemsValidation = DRAFT().validate(state.itens);
      if (!itemsValidation.valid) { window.toast(itemsValidation.errors[0].message, 'error'); return; }

      var payload = buildDirtyPayload();
      if (payload.header === null && payload.itens === null && payload.prioridade === null) {
        window.toast('Nao ha alteracoes para ' + (state.mode === 'preAceite' ? 'salvar' : 'propor') + '.', 'info');
        return;
      }

      var oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = state.mode === 'preAceite' ? 'Salvando...' : 'Enviando...';
      function restaurar() { btn.disabled = false; btn.textContent = oldLabel; }

      var r;
      try {
        if (state.mode === 'preAceite') {
          r = await window.supa.rpc('salvar_pedido_cliente', {
            p_pedido_id: pedidoId,
            p_base_revisao: state.pedido.revisao,
            p_header: payload.header,
            p_itens: payload.itens,
            p_prioridade: payload.prioridade,
          });
        } else {
          r = await window.supa.rpc('solicitar_alteracao_pedido', {
            p_pedido_id: pedidoId,
            p_header: payload.header,
            p_itens: payload.itens,
            p_prioridade: payload.prioridade,
            p_mensagem: state.mensagem || null,
          });
        }
      } catch (e) {
        window.toast('Erro inesperado.', 'error');
        console.error('cliente-pedido-edit: rpc lancou', e);
        restaurar();
        return;
      }

      if (r.error) { handleSaveError(r.error, restaurar); return; }

      if (state.mode === 'preAceite') {
        window.toast('Pedido atualizado.', 'success');
      } else {
        window.toast('Solicitacao de alteracao enviada. Aguardando revisao administrativa.', 'success');
      }
      await carregar();
      render();
    }

    function handleSaveError(error, restaurar) {
      var msg = (error && error.message) || '';
      function has(token) { return msg.indexOf(token) !== -1; }

      if (has('PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA')) {
        state.staleRevision = true;
        render();
        return;
      }
      if (has('PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP') || has('PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP')) {
        window.toast('Este pedido ja tem producao vinculada; alteracoes de modelo, metragem ou composicao de itens nao podem ser aplicadas por aqui.', 'error');
        state.isOperationalOverride = true;
        render();
        return;
      }
      if (has('PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE')) {
        window.toast('A data do pedido nao pode ser alterada depois que ele existe.', 'error');
        restaurar();
        return;
      }
      if (has('PEDIDO_ALTERACAO_PEDIDO_TERMINAL') || has('PEDIDO_ALTERACAO_PEDIDO_NAO_EDITAVEL') || has('PEDIDO_ALTERACAO_PEDIDO_NAO_ACEITO')) {
        window.toast('Este pedido mudou de status. Recarregando...', 'error');
        carregar().then(render);
        return;
      }
      if (has('PEDIDO_ALTERACAO_FORBIDDEN') || has('PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND')) {
        window.toast('Nao foi possivel confirmar a permissao sobre este pedido.', 'error');
        restaurar();
        return;
      }
      if (has('PEDIDO_ALTERACAO_ITEM_SET_INVALIDO')) {
        window.toast('Composicao de itens invalida: ' + msg, 'error');
        restaurar();
        return;
      }

      window.toast('Erro ao processar: ' + (msg || 'desconhecido'), 'error');
      console.error('cliente-pedido-edit: erro', error);
      restaurar();
    }

    async function retirarSolicitacao(solicitacaoId) {
      return window.confirmDialog({
        title: 'Retirar solicitacao',
        message: 'A solicitacao de alteracao pendente sera retirada. O pedido aceito pela equipe nao e afetado.',
        confirmLabel: 'Retirar solicitacao',
        danger: true,
        onConfirm: async function () {
          var r = await window.supa.rpc('retirar_alteracao_pedido', { p_solicitacao_id: solicitacaoId });
          if (r.error) {
            window.toast('Nao foi possivel retirar a solicitacao.', 'error');
            console.error('cliente-pedido-edit: retirar_alteracao_pedido', r.error);
            return;
          }
          window.toast('Solicitacao retirada.', 'success');
          await carregar();
          render();
        },
      });
    }

    // -------------------------------------------------------------
    // Render
    // -------------------------------------------------------------
    function render() {
      if (state.loadingError === 'pedido') {
        container.replaceChildren(buildHeader(),
          window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-signal-negative-border); border-radius:var(--rv-radius); padding:16px 20px; color:var(--rv-signal-negative);' },
            'Pedido nao encontrado ou sem permissao. Ele pode ter sido removido.'));
        return;
      }
      if (state.loadingError) {
        container.replaceChildren(buildHeader(),
          window.el('div', { style: 'background:var(--rv-surface); border:1px solid var(--rv-signal-negative-border); border-radius:var(--rv-radius); padding:16px 20px; color:var(--rv-signal-negative);' },
            'Erro ao carregar ' + state.loadingError + '. Tente recarregar a pagina.'));
        return;
      }

      // Modo D (terminal): pode ser descoberto so DEPOIS do boot inicial —
      // por exemplo, uma recarga apos erro de RPC revela que o pedido virou
      // terminal enquanto a tela estava aberta. O editor nunca permanece
      // disponivel nesse caso; a mesma regra do boot (ver abaixo) se aplica
      // aqui, redirecionando para o detalhe em vez de renderizar a tela.
      if (state.mode === 'terminal') {
        window.toast('Este pedido esta encerrado e nao aceita mais edicao.', 'info');
        window.navigate('#/cliente/pedidos/' + pedidoId);
        return;
      }

      var nodes = [buildHeader()];
      var pendingNotice = buildPendingRequestNotice();
      if (pendingNotice) nodes.push(pendingNotice);
      if (state.staleRevision) nodes.push(buildStaleRevisionNotice());
      if (locked()) nodes.push(buildStructuralLockNotice());
      nodes.push(buildDadosGeraisCard());
      nodes.push(buildItensCard());

      var saveBtn = window.el('button', {
        type: 'button',
        style: 'background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0; width:100%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
        disabled: state.staleRevision ? 'disabled' : null,
        onclick: function () { return salvarOuSolicitar(saveBtn); },
      }, state.mode === 'preAceite' ? 'Salvar alteracoes' : 'Enviar solicitacao de alteracao');
      if (state.staleRevision) {
        saveBtn.setAttribute('style', 'background:var(--rv-surface-subtle); color:var(--rv-text-tertiary); border:1px solid var(--rv-border-soft); border-radius:var(--rv-radius); height:var(--rv-h-primary); padding:0; width:100%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--rv-fs-body); font-family:inherit; cursor:not-allowed;');
      }
      nodes.push(buildBottomSection(saveBtn));

      container.replaceChildren.apply(container, nodes);
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoEdit = { screenClientePedidoEditar: screenClientePedidoEditar };
  window.screenClientePedidoEditar = screenClientePedidoEditar;
})(window);
