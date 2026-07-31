// =====================================================================
// === SCREENS: PEDIDO PRODUCAO PANEL ==================================
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-C, ruling R12.
//
// Rota: #/pedidos/<pedido-id>/producao
//
// PARA QUE ESTA TELA EXISTE. Quando um recebimento afeta MAIS DE UMA OP,
// mandar o operador para "a OP" é ambíguo e mandá-lo para o detalhe do
// Pedido o obriga a caçar cada OP. Esta é a superfície onde as OPs afetadas
// aparecem juntas, cada uma com o seu próprio bloco de ajuste.
//
// O QUE ELA NÃO É. Ela não é um segundo dono de ajuste. Todo slider, toda
// validação de teto, todo salvamento atômico e todo início de produção vêm
// de js/screens/op-distribuicao-ui.js — o dono compartilhado. Esta tela
// carrega dados, monta o dono e trata navegação; não reimplementa nada
// disso, e um segundo slider aqui seria um defeito.
//
// FAIL-CLOSED. O dono compartilhado exige as duas entradas nativas: a
// projeção `oc_disponibilidade_op` e a revisão REAL (`ops.ajuste_revisao`).
// Esta tela carrega ambas por OP e, quando uma delas falta para uma OP,
// entrega o contexto incompleto ao dono compartilhado, que se recusa a
// operar — em vez de inventar teto ou revisão.
//
// ISOLAMENTO POR OP. Cada OP tem o seu próprio bloco, a sua própria
// revisão e o seu próprio conflito. Uma OP que falhe não corrompe nem
// bloqueia o estado das outras.
//
// Carregar via <script src="js/screens/pedido-producao-panel.js"></script>
// DEPOIS de js/screens/op-distribuicao-ui.js (dono compartilhado) e ANTES
// de js/boot.js.
// =====================================================================

(function (window) {
  'use strict';

  var CARD = 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);';
  var BTN_SECONDARY = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:var(--rv-radius);padding:0 16px;min-height:var(--rv-h-compact);font-weight:600;font-size:var(--rv-fs-sm);font-family:inherit;cursor:pointer;';

  // Estados em que uma OP ainda aceita ajuste de distribuição.
  function opAjustavel(op) {
    return !!op && (op.status === 'simulada' || op.status === 'aberta');
  }

  function identidadeOp(op) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      try { return api.formatOpOperationalCode(op); } catch (e) { /* cai no rótulo abaixo */ }
    }
    return op && op.id != null ? ('OP #' + op.id) : 'OP';
  }

  async function screenPedidoProducaoPanel(pedidoId) {
    var container = window.el('div', {});
    var state = {
      pedido: null,
      ops: [],
      opItensByOp: {},
      disponibilidadeByOp: {},
      disponibilidadeErroByOp: {},
      modelosById: {},
      parametrosByLargura: {},
      loadError: null,
    };

    // -----------------------------------------------------------------
    // Carga
    // -----------------------------------------------------------------
    async function reload() {
      state.loadError = null;

      var pedRes = await window.supa.from('pedidos')
        .select('id, numero, status, revisao, cliente:cliente_id(id, nome)')
        .eq('id', pedidoId)
        .maybeSingle();
      if (pedRes.error || !pedRes.data) {
        state.loadError = 'pedido';
        console.error('pedido-producao-panel: pedido', pedRes.error);
        render();
        return;
      }
      state.pedido = pedRes.data;

      var lotesRes = await window.supa.from('lotes').select('id').eq('pedido_id', pedidoId);
      if (lotesRes.error) {
        state.loadError = 'lotes';
        console.error('pedido-producao-panel: lotes', lotesRes.error);
        render();
        return;
      }
      var loteIds = (lotesRes.data || []).map(function (l) { return l.id; }).filter(function (id) { return id != null; });
      if (!loteIds.length) { state.ops = []; render(); return; }

      // A revisão REAL viaja no select: ela é entrada obrigatória do dono
      // compartilhado e não pode ser sintetizada.
      var opsRes = await window.supa.from('ops')
        .select('id, numero, ano, identidade_operacional, identidade_pedido_id, status, ajuste_revisao, tipo, lote_id, op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id)')
        .in('lote_id', loteIds)
        .order('ano', { ascending: true })
        .order('numero', { ascending: true });
      if (opsRes.error) {
        state.loadError = 'ops';
        console.error('pedido-producao-panel: ops', opsRes.error);
        render();
        return;
      }
      state.ops = (opsRes.data || []).filter(function (op) { return op && op.tipo !== 'latex'; });

      // Modelos e parâmetros de largura — insumos de exibição e de receita do
      // dono compartilhado.
      var modeloIds = [];
      state.ops.forEach(function (op) {
        (op.op_itens || []).forEach(function (i) {
          if (i && i.modelo_id != null && modeloIds.indexOf(i.modelo_id) === -1) modeloIds.push(i.modelo_id);
        });
      });
      state.modelosById = {};
      if (modeloIds.length) {
        var modRes = await window.supa.from('modelos')
          .select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)')
          .in('id', modeloIds);
        if (!modRes.error) {
          (modRes.data || []).forEach(function (m) { state.modelosById[m.id] = m; });
        } else {
          console.error('pedido-producao-panel: modelos', modRes.error);
        }
      }
      state.parametrosByLargura = {};
      var parRes = await window.supa.from('parametros_largura')
        .select('largura, algodao_por_ml, poliester_por_ml, valor_x');
      if (!parRes.error) {
        (parRes.data || []).forEach(function (p) {
          if (!p) return;
          state.parametrosByLargura[Number(p.largura)] = p;
          if (typeof window.larguraKey === 'function') state.parametrosByLargura[window.larguraKey(p.largura)] = p;
        });
      } else {
        console.error('pedido-producao-panel: parametros_largura', parRes.error);
      }

      // DISPONIBILIDADE NATIVA por OP ajustável. FAIL-CLOSED e ISOLADA: a
      // falha de uma OP marca só aquela OP, e as demais seguem operáveis.
      state.disponibilidadeByOp = {};
      state.disponibilidadeErroByOp = {};
      var ajustaveis = state.ops.filter(opAjustavel);
      if (ajustaveis.length) {
        var leituras = await Promise.all(ajustaveis.map(function (op) {
          return window.supa.rpc('oc_disponibilidade_op', { p_op_id: op.id });
        }));
        ajustaveis.forEach(function (op, i) {
          var res = leituras[i];
          if (res && res.error) {
            state.disponibilidadeErroByOp[op.id] = true;
            console.error('pedido-producao-panel: oc_disponibilidade_op da OP ' + op.id, res.error);
            return;
          }
          state.disponibilidadeByOp[op.id] = Array.isArray(res && res.data) ? res.data : [];
        });
      }

      render();
    }

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    function buildHeader() {
      var p = state.pedido || {};
      var numero = p.numero != null ? ('#' + p.numero) : '';
      return window.el('div', { style: 'margin-bottom:14px;' },
        window.el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;' },
          window.el('div', {},
            window.el('div', { style: 'font-size:13.5px;color:var(--rv-text-tertiary);margin-bottom:6px;' },
              'Pedidos / ',
              window.el('span', { style: 'color:var(--rv-text-secondary);font-weight:600;' }, 'Pedido ' + numero)),
            window.el('h1', { style: 'margin:0;font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;' },
              'Produção do Pedido ' + numero),
            window.el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);margin-top:6px;' },
              ((p.cliente && p.cliente.nome) || 'Cliente')
              + ' · ' + (state.ops.length) + ' OP(s) de produção')),
          window.el('button', {
            type: 'button', style: BTN_SECONDARY,
            onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
          }, 'Voltar ao Pedido')));
    }

    // Um cartão por OP. O bloco de ajuste e o botão de início vêm INTEIROS do
    // dono compartilhado — esta função não constrói slider nenhum.
    function buildOpCard(op) {
      var api = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.opDistribuicao;
      var opItens = op.op_itens || [];
      var disponibilidade = state.disponibilidadeByOp[op.id];
      var ajustavel = opAjustavel(op);

      var card = window.el('div', {
        'data-rv-op-producao': String(op.id),
        style: CARD + 'padding:16px 20px;margin-bottom:14px;',
      });

      card.appendChild(window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;',
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);' },
            identidadeOp(op)),
          window.el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);margin-top:2px;' },
            opItens.length + ' item(ns) · revisão de ajuste ' + (op.ajuste_revisao != null ? op.ajuste_revisao : '—'))),
        window.badgeStatus ? window.badgeStatus(op.status) : window.el('span', {}, String(op.status || ''))));

      if (!ajustavel) {
        card.appendChild(window.el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);' },
          'Esta OP não está em fase de ajuste (status ' + (op.status || '—') + ').'));
        return card;
      }
      if (!opItens.length) {
        card.appendChild(window.el('div', { style: 'font-size:13px;color:var(--rv-text-tertiary);' },
          'Esta OP não tem itens para distribuir.'));
        return card;
      }
      if (!api || typeof api.buildDistribuicaoBlock !== 'function') {
        card.appendChild(window.el('div', {
          role: 'alert', 'aria-live': 'polite',
          style: 'font-size:13px;font-weight:700;color:var(--rv-signal-negative);',
        }, 'Componente compartilhado de distribuição indisponível.'));
        return card;
      }

      // ISOLAMENTO: `onRecarregar` e `onSaved` recarregam o painel inteiro do
      // servidor. Nenhum estado de OP é remendado localmente, então o
      // resultado de uma OP nunca sobrescreve o de outra.
      var ctx = {
        op: op,
        opItens: opItens,
        disponibilidade: disponibilidade,
        ajusteRevisao: op.ajuste_revisao,
        modelosById: state.modelosById,
        parametrosByLargura: state.parametrosByLargura,
        variant: 'compact',
        onRecarregar: async function () { await reload(); return true; },
        onSaved: async function () { await reload(); },
      };

      card.appendChild(api.buildDistribuicaoBlock(ctx));

      var iniciar = api.buildIniciarProducaoButton({
        op: op,
        opItens: opItens,
        disponibilidade: disponibilidade,
        ajusteRevisao: op.ajuste_revisao,
        modelosById: state.modelosById,
        parametrosByLargura: state.parametrosByLargura,
        styleEnabled: 'display:inline-flex;align-items:center;justify-content:center;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);padding:0 16px;min-height:var(--rv-h-compact);font-weight:700;font-size:var(--rv-fs-sm);font-family:inherit;cursor:pointer;',
        styleDisabled: 'display:inline-flex;align-items:center;justify-content:center;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);padding:0 16px;min-height:var(--rv-h-compact);font-weight:700;font-size:var(--rv-fs-sm);font-family:inherit;opacity:.45;cursor:default;',
        onIniciado: async function (proximaAcao) {
          if (proximaAcao && proximaAcao.rota) { window.navigate(proximaAcao.rota); return; }
          await reload();
        },
      });
      card.appendChild(window.el('div', { style: 'display:flex;justify-content:flex-end;padding-top:11px;border-top:1px solid var(--rv-border-soft);margin-top:12px;' }, iniciar));
      return card;
    }

    function render() {
      if (state.loadError) {
        container.replaceChildren(
          window.el('div', {
            role: 'alert', 'aria-live': 'polite',
            style: CARD + 'padding:18px 20px;color:var(--rv-signal-negative);font-weight:700;',
          }, 'Erro ao carregar a produção do Pedido (' + state.loadError + ').'),
          window.el('div', { style: 'margin-top:12px;' },
            window.el('button', {
              type: 'button', style: BTN_SECONDARY,
              onclick: function () { window.navigate('#/pedidos/' + pedidoId); },
            }, 'Voltar ao Pedido')));
        return;
      }
      if (!state.pedido) {
        container.replaceChildren(window.el('div', { style: CARD + 'padding:18px 20px;color:var(--rv-text-tertiary);' }, 'Carregando produção...'));
        return;
      }
      var nodes = [buildHeader()];
      if (!state.ops.length) {
        nodes.push(window.el('div', { style: CARD + 'padding:18px 20px;font-size:13px;color:var(--rv-text-tertiary);' },
          'Este Pedido ainda não tem OP de produção.'));
      } else {
        state.ops.forEach(function (op) { nodes.push(buildOpCard(op)); });
      }
      container.replaceChildren.apply(container, nodes);
    }

    render();
    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoProducaoPanel = {
    screenPedidoProducaoPanel: screenPedidoProducaoPanel,
    opAjustavel: opAjustavel,
  };
  window.screenPedidoProducaoPanel = screenPedidoProducaoPanel;
})(window);
