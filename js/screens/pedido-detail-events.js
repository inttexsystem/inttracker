// =====================================================================
// === SCREENS: PEDIDO DETAIL EVENTS ===================================
// Handlers e modais da tela de detalhe do pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  function createPedidoDetailEvents(ctx) {
    var pedidoId = ctx.pedidoId;
    var state = ctx.state;
    var reload = ctx.reload;
    var render = ctx.render;
    var currentView = null;

    function navigateToPedidos() {
      window.navigate('#/pedidos');
    }

    function navigateToOp(opId) {
      window.navigate('#/ops/' + opId);
    }

    function navigateToExpedicao(expedicaoId) {
      window.navigate('#/expedicoes/' + expedicaoId);
    }

    function navigateToNovaOp() {
      window.navigate('#/ops/nova?pedido_id=' + pedidoId);
    }

    function scrollToSection(id) {
      var node = document.getElementById(id);
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function buildTrackingAdmin() {
      if (typeof window.buildPedidoTrackingAdminCard !== 'function') return window.el('div', {});
      return window.buildPedidoTrackingAdminCard({
        pedido: state.pedido,
        onReload: async function () {
          ctx.setLoadingError(null);
          await reload();
          render();
        },
      });
    }

    function buildParciaisAdmin() {
      if (typeof window.buildPedidoParciaisAdminCard !== 'function') return window.el('div', {});
      return window.buildPedidoParciaisAdminCard({
        pedido: state.pedido,
        itens: state.itens,
        onReload: async function () {
          ctx.setLoadingError(null);
          await reload();
          render();
        },
      });
    }

    function placeholderButton(label, title) {
      return window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#b6bdc8;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:not-allowed;',
        disabled: 'disabled',
        title: title || 'Em breve',
      }, label);
    }

    function buildEditItensButton() {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#2563eb;border:1px solid #2563eb;border-radius:4px;padding:7px 13px;font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer;',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId + '/itens'); },
        }, 'Editar itens');
      }
      var motivo = 'Edicao de itens permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar itens', motivo);
    }

    function buildEditButton() {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
          onclick: function () { openEditWarning('dados'); },
        }, ns.svgEl(ns.SVG_EDIT), 'Editar');
      }
      var motivo = 'Edicao permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar', motivo);
    }

    async function alterarStatus(novoStatus, btn) {
      if (!state.pedido) {
        window.toast('Pedido nao carregado.', 'error');
        return;
      }
      var statusAtual = state.pedido.status;
      if (!ns.canTransition(statusAtual, novoStatus)) {
        window.toast('Transicao nao permitida: ' + statusAtual + ' -> ' + novoStatus + '.', 'error');
        return;
      }

      var oldLabel = btn ? btn.textContent : null;
      var oldDisabled = btn ? btn.disabled : false;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }

      var apply = async function () {
        var res = await window.supa
          .from('pedidos')
          .update({ status: novoStatus })
          .eq('id', pedidoId);

        if (res.error) {
          window.toast('Erro ao atualizar status: ' + (res.error.message || 'desconhecido'), 'error');
          console.error('pedido-detail: erro ao atualizar status', res.error);
          if (btn) {
            btn.disabled = oldDisabled;
            btn.textContent = oldLabel;
          }
          return;
        }

        state.pedido.status = novoStatus;
        window.toast('Pedido marcado como ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(novoStatus) : novoStatus) + '.', 'success');
        await reload();
        render();
      };

      if (novoStatus === 'cancelado') {
        window.confirmDialog({
          title: 'Cancelar pedido',
          message: 'Tem certeza que deseja cancelar este pedido? Esta acao nao pode ser desfeita nesta fase.',
          confirmLabel: 'Sim, cancelar',
          danger: true,
          onConfirm: apply,
        });
        if (btn) {
          btn.disabled = oldDisabled;
          btn.textContent = oldLabel;
        }
        return;
      }

      await apply();
    }

    async function concluirPedido(btn) {
      if (!state.pedido) {
        window.toast('Pedido nao carregado.', 'error');
        return;
      }
      var oldDisabled = btn ? btn.disabled : false;
      var oldLabel = btn ? btn.textContent : null;
      function restaurarBotao() {
        if (btn) {
          btn.disabled = oldDisabled;
          btn.textContent = oldLabel;
        }
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Concluindo...';
      }

      // A chamada da RPC pode lancar (rede/sessao). Sem este guard, a
      // rejeicao ficava sem tratamento: nenhum toast e o botao preso em
      // "Concluindo...", parecendo um clique morto.
      var r;
      try {
        r = await window.supa.rpc('concluir_pedido_se_pronto', { p_pedido_id: pedidoId });
      } catch (e) {
        window.toast('Erro ao concluir pedido: ' + (e && e.message ? e.message : 'falha de comunicacao'), 'error');
        console.error('pedido-detail: concluir_pedido_se_pronto lancou', e);
        restaurarBotao();
        return;
      }

      if (r.error || (r.data && r.data.ok === false)) {
        var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Pedido com pendencias');
        var pendencias = r.data && Array.isArray(r.data.pendencias) && r.data.pendencias.length
          ? ' (' + r.data.pendencias.join('; ') + ')'
          : '';
        window.toast('Pedido nao concluido: ' + msg + pendencias, 'error');
        restaurarBotao();
        return;
      }

      // Sucesso confirmado pelo backend. Uma falha ao recarregar/re-renderizar
      // NAO deve parecer falha de conclusao nem induzir novo clique (que
      // duplicaria pedido_eventos).
      window.toast('Pedido concluido.', 'success');
      try {
        await reload();
        render();
      } catch (e) {
        console.error('pedido-detail: falha ao atualizar a tela apos conclusao', e);
        window.toast('Pedido concluido. Recarregue a pagina para ver o estado atualizado.', 'info');
        restaurarBotao();
      }
    }

    // Finalizacao de OP pelo hub do Pedido: reutiliza o contrato canonico
    // alterar_status_op(..., 'concluida'). Nao ha update direto em ops.status,
    // nao finaliza automaticamente (exige confirmacao) e nao cria write
    // paralelo — e a mesma RPC usada pelas telas de OP.
    function finalizarOp(op) {
      if (!op || op.id == null) {
        window.toast('OP indisponivel para finalizacao.', 'error');
        return;
      }
      window.confirmDialog({
        title: 'Finalizar OP ' + ns.opLabel(op),
        message: 'Marcar a OP ' + ns.opLabel(op) + ' como concluida? Isto encerra o total desta OP; nao e pre-requisito para movimentacoes parciais ja registradas.',
        confirmLabel: 'Finalizar OP',
        onConfirm: async function () {
          var r;
          try {
            r = await window.supa.rpc('alterar_status_op', {
              p_op_id: op.id,
              p_novo_status: 'concluida',
              p_observacao: 'Finalizacao da OP pelo hub do Pedido',
            });
          } catch (e) {
            window.toast('Erro ao finalizar OP: ' + (e && e.message ? e.message : 'falha de comunicacao'), 'error');
            console.error('pedido-detail: alterar_status_op lancou', e);
            return;
          }
          if (r.error || (r.data && r.data.ok === false)) {
            var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Nao foi possivel finalizar');
            window.toast('Erro ao finalizar OP: ' + msg, 'error');
            console.error(r.error || r.data);
            return;
          }
          window.toast('OP ' + ns.opLabel(op) + ' concluida.', 'success');
          await reload();
          render();
        },
      });
    }

    function movementField(label, value) {
      return window.el('div', {},
        window.el('label', {
          style: 'display:block;font-size:12px;font-weight:600;color:#5b6472;margin-bottom:6px;',
        }, label),
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;padding:9px 12px;font-size:13.5px;color:#16203a;background:#f8f9fb;',
        }, ns.fmtTextoOuEmpty(value, '-'))
      );
    }

    function movementMetricCard(label, value, accent) {
      return window.el('div', {
        style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;padding:12px 14px;',
      },
        window.el('div', {
          style: 'font-size:11px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;margin-bottom:6px;',
        }, label),
        window.el('div', {
          style: 'font-size:16px;font-weight:800;color:' + (accent || '#16203a') + ';',
        }, ns.fmtTextoOuEmpty(value, '-'))
      );
    }

    var MOVEMENT_MODAL_RADIUS = '6px';
    var MOVEMENT_SURFACE_RADIUS = '4px';
    var MOVEMENT_MODAL_SHADOW = '0 18px 44px rgba(20,30,45,.16)';
    var MOVEMENT_CONTROL_HEIGHT = '36px';

    function normalizeMovementModalControls(root) {
      if (!root || typeof root.querySelectorAll !== 'function') return;
      root.querySelectorAll('input, select, textarea').forEach(function (control) {
        control.classList.remove('rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full');
        control.style.borderRadius = MOVEMENT_SURFACE_RADIUS;
        control.style.minHeight = MOVEMENT_CONTROL_HEIGHT;
        control.style.boxShadow = 'none';
      });
    }

    function resolveUniquePedidoItemByModelo() {
      var countByModelo = {};
      var map = {};
      state.itens.forEach(function (item) {
        countByModelo[item.modelo_id] = (countByModelo[item.modelo_id] || 0) + 1;
        map[item.modelo_id] = item;
      });
      Object.keys(map).forEach(function (modeloId) {
        if (countByModelo[modeloId] !== 1) delete map[modeloId];
      });
      return map;
    }

    function movementItemLabel(opItem, uniquePedidoItemByModelo) {
      var modelo = state.modelosById[opItem.modelo_id] || {};
      var pedidoItem = opItem.pedido_item_id
        ? state.itens.find(function (item) { return item.id === opItem.pedido_item_id; }) || null
        : uniquePedidoItemByModelo[opItem.modelo_id] || null;
      var larguraValue = pedidoItem && pedidoItem.largura != null
        ? pedidoItem.largura
        : modelo.largura;
      var larguraLabel = larguraValue != null
        ? Number(larguraValue).toFixed(2).replace('.', ',') + ' m'
        : null;
      var cor1Id = pedidoItem && pedidoItem.cor_1_id != null ? pedidoItem.cor_1_id : modelo.cor_1_id;
      var cor2Id = pedidoItem && pedidoItem.cor_2_id != null ? pedidoItem.cor_2_id : modelo.cor_2_id;
      var cor1 = cor1Id != null && state.coresById[cor1Id] ? state.coresById[cor1Id].nome : null;
      var cor2 = cor2Id != null && state.coresById[cor2Id] ? state.coresById[cor2Id].nome : null;
      var label = modelo.nome || 'Item sem modelo';
      if (larguraLabel) label += ' · ' + larguraLabel;
      if (cor1 || cor2) label += ' · ' + (cor1 || '-') + ' / ' + (cor2 || '-');
      return label;
    }

    function computePendingByItem(ctxMovement) {
      var key = transitionKey(ctxMovement);
      if (key === 'Insumos>Tecelagem') {
        var insumos = summarizeInsumos(ctxMovement);
        return insumos.ordens.map(function (ordem) {
          var pedido = ns.toFiniteNumber(ordem.kg_pedido);
          var recebido = ns.toFiniteNumber(ordem.kg_recebido);
          return {
            opItemId: ordem.id,
            target: pedido,
            moved: recebido,
            pending: ns.round2(Math.max(pedido - recebido, 0)),
          };
        });
      }
      if (key === 'Expedicao>Entrega') {
        return (state.expedicaoItens || []).map(function (item) {
          var liberado = ns.toFiniteNumber(item.metros_liberados);
          var entregue = ns.toFiniteNumber(item.metros_entregues);
          return {
            opItemId: item.id,
            target: liberado,
            moved: entregue,
            pending: ns.round2(Math.max(liberado - entregue, 0)),
          };
        });
      }
      if (key === 'Acabamento>Expedicao') {
        // Recebido da Tecelagem menos ja movimentado para Expedicao.
        return buildAcabamentoLiberavelRows(ctxMovement).map(function (row) {
          return { opItemId: row.opItem.id, target: row.recebido, moved: row.liberado, pending: row.saldo };
        });
      }
      if (ctxMovement.op && Array.isArray(ctxMovement.op.op_itens) && ctxMovement.op.op_itens.length) {
        var stage = typeof ns.deliveryStageForOp === 'function'
          ? ns.deliveryStageForOp(ctxMovement.op)
          : (ctxMovement.op && ctxMovement.op.tipo === 'latex' ? 'latex' : 'cima');
        var movedByOpItem = {};
        ctxMovement.op.op_itens.forEach(function (opItem) {
          if (opItem && opItem.id != null) movedByOpItem[opItem.id] = 0;
        });
        state.entregaItens.forEach(function (ei) {
          if (!(movedByOpItem.hasOwnProperty(ei.op_item_id)) || ei.defeito) return;
          var entrega = state.entregasById[ei.entrega_id];
          if (!entrega || entrega.etapa !== stage) return;
          movedByOpItem[ei.op_item_id] = ns.round2((movedByOpItem[ei.op_item_id] || 0) + ns.toFiniteNumber(ei.metros_entregues));
        });
        return ctxMovement.op.op_itens.map(function (opItem) {
          var target = typeof ns.targetMetersForOpItem === 'function'
            ? ns.targetMetersForOpItem(opItem)
            : ns.round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
          var moved = movedByOpItem[opItem.id] || 0;
          return {
            opItemId: opItem.id,
            target: target,
            moved: moved,
            pending: ns.round2(Math.max(target - moved, 0)),
          };
        });
      }
      return [];
    }

    function buildMovementItems(ctxMovement) {
      if (Array.isArray(ctxMovement.items) && ctxMovement.items.length) return ctxMovement.items;
      var key = transitionKey(ctxMovement);
      if (key === 'Insumos>Tecelagem') {
        return summarizeInsumos(ctxMovement).ordens.map(function (ordem) {
          var pedido = ns.toFiniteNumber(ordem.kg_pedido);
          var recebido = ns.toFiniteNumber(ordem.kg_recebido);
          var saldo = ns.round2(Math.max(pedido - recebido, 0));
          var op = (state.ops || []).find(function (row) { return row.id === ordem.op_id; }) || null;
          return {
            label: window.rotuloFio ? window.rotuloFio(ordem) : ns.fmtTextoOuEmpty(ordem.tipo, 'Fio'),
            meta: ns.fmtKg(recebido) + ' de ' + ns.fmtKg(pedido) + ' · ' + (saldo > 0 ? ns.fmtKg(saldo) + ' pendente' : 'completo') + (op ? ' · ' + ns.opLabel(op) : ''),
          };
        });
      }
      if (key === 'Expedicao>Entrega') {
        return (state.expedicaoItens || []).map(function (item) {
          var liberado = ns.toFiniteNumber(item.metros_liberados);
          var entregue = ns.toFiniteNumber(item.metros_entregues);
          var saldo = ns.round2(Math.max(liberado - entregue, 0));
          return {
            label: modelLabelByModeloId(item.modelo_id),
            meta: ns.fmtMetros(entregue) + ' de ' + ns.fmtMetros(liberado) + ' · ' + (saldo > 0 ? ns.fmtMetros(saldo) + ' pendente' : 'completo'),
          };
        });
      }
      if (key === 'Acabamento>Expedicao') {
        return buildAcabamentoLiberavelRows(ctxMovement).map(function (row) {
          return {
            label: modelLabelByModeloId(row.opItem.modelo_id),
            meta: ns.fmtMetros(row.liberado) + ' de ' + ns.fmtMetros(row.recebido) + ' · ' + (row.saldo > 0 ? ns.fmtMetros(row.saldo) + ' pendente' : 'completo'),
          };
        });
      }
      if (!ctxMovement.op || !Array.isArray(ctxMovement.op.op_itens) || !ctxMovement.op.op_itens.length) return [];

      var uniquePedidoItemByModelo = resolveUniquePedidoItemByModelo();
      var stage = typeof ns.deliveryStageForOp === 'function'
        ? ns.deliveryStageForOp(ctxMovement.op)
        : (ctxMovement.op && ctxMovement.op.tipo === 'latex' ? 'latex' : 'cima');
      var movedByOpItem = {};
      state.entregaItens.forEach(function (ei) {
        if (ei.defeito) return;
        var entrega = state.entregasById[ei.entrega_id];
        if (!entrega || entrega.etapa !== stage) return;
        movedByOpItem[ei.op_item_id] = ns.round2((movedByOpItem[ei.op_item_id] || 0) + ns.toFiniteNumber(ei.metros_entregues));
      });
      return ctxMovement.op.op_itens.map(function (opItem) {
        var metros = typeof ns.targetMetersForOpItem === 'function'
          ? ns.targetMetersForOpItem(opItem)
          : ns.round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
        var moved = movedByOpItem[opItem.id] || 0;
        var pendente = ns.round2(Math.max(metros - moved, 0));
        var statusMeta = pendente > 0 ? ns.fmtMetrosShort(pendente) + ' pendente' : 'completo';
        return {
          label: movementItemLabel(opItem, uniquePedidoItemByModelo),
          meta: ns.fmtMetrosShort(moved) + ' de ' + ns.fmtMetrosShort(metros) + ' · ' + statusMeta,
        };
      });
    }

    function buildTransitionPendingTable(ctxMovement) {
      var key = transitionKey(ctxMovement);
      var rows = [];

      if (key === 'Insumos>Tecelagem') {
        var insumos = summarizeInsumos(ctxMovement);
        rows = insumos.ordens.map(function (ordem) {
          var pedido = ns.toFiniteNumber(ordem.kg_pedido);
          var recebido = ns.toFiniteNumber(ordem.kg_recebido);
          var pendente = ns.round2(Math.max(pedido - recebido, 0));
          return {
            label: window.rotuloFio ? window.rotuloFio(ordem) : ns.fmtTextoOuEmpty(ordem.tipo, 'Fio'),
            target: ns.fmtKg(pedido),
            moved: ns.fmtKg(recebido),
            remaining: pendente > 0 ? ns.fmtKg(pendente) : 'Completo',
            remainingColor: pendente > 0 ? '#d6403a' : '#18794a',
            isComplete: pendente <= 0,
          };
        });
      } else if (key === 'Expedicao>Entrega') {
        rows = (state.expedicaoItens || []).map(function (item) {
          var liberado = ns.toFiniteNumber(item.metros_liberados);
          var entregue = ns.toFiniteNumber(item.metros_entregues);
          var pendente = ns.round2(Math.max(liberado - entregue, 0));
          return {
            label: modelLabelByModeloId(item.modelo_id),
            target: ns.fmtMetros(liberado),
            moved: ns.fmtMetros(entregue),
            remaining: pendente > 0 ? ns.fmtMetros(pendente) : 'Completo',
            remainingColor: pendente > 0 ? '#d6403a' : '#18794a',
            isComplete: pendente <= 0,
          };
        });
      } else if (key === 'Acabamento>Expedicao') {
        rows = buildAcabamentoLiberavelRows(ctxMovement).map(function (row) {
          var pendente = row.saldo;
          return {
            label: modelLabelByModeloId(row.opItem.modelo_id),
            target: ns.fmtMetros(row.recebido),
            moved: ns.fmtMetros(row.liberado),
            remaining: pendente > 0 ? ns.fmtMetros(pendente) : 'Completo',
            remainingColor: pendente > 0 ? '#d6403a' : '#18794a',
            isComplete: pendente <= 0,
          };
        });
      } else if (ctxMovement.op && Array.isArray(ctxMovement.op.op_itens) && ctxMovement.op.op_itens.length) {
        var stage = typeof ns.deliveryStageForOp === 'function'
          ? ns.deliveryStageForOp(ctxMovement.op)
          : (ctxMovement.op.tipo === 'latex' ? 'latex' : 'cima');
        var opItemIds = {};
        var movedByItem = {};
        ctxMovement.op.op_itens.forEach(function (opItem) {
          if (opItem && opItem.id != null) {
            opItemIds[opItem.id] = true;
            movedByItem[opItem.id] = 0;
          }
        });
        state.entregaItens.forEach(function (ei) {
          if (!opItemIds[ei.op_item_id] || ei.defeito) return;
          var entrega = state.entregasById[ei.entrega_id];
          if (!entrega || entrega.etapa !== stage) return;
          movedByItem[ei.op_item_id] = ns.round2((movedByItem[ei.op_item_id] || 0) + ns.toFiniteNumber(ei.metros_entregues));
        });
        var uniquePedidoItemByModelo = resolveUniquePedidoItemByModelo();
        rows = ctxMovement.op.op_itens.map(function (opItem) {
          var target = typeof ns.targetMetersForOpItem === 'function'
            ? ns.targetMetersForOpItem(opItem)
            : ns.round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
          var moved = movedByItem[opItem.id] || 0;
          var pendente = ns.round2(Math.max(target - moved, 0));
          return {
            label: movementItemLabel(opItem, uniquePedidoItemByModelo),
            target: ns.fmtMetros(target),
            moved: ns.fmtMetros(moved),
            remaining: pendente > 0 ? ns.fmtMetros(pendente) : 'Completo',
            remainingColor: pendente > 0 ? '#d6403a' : '#18794a',
            isComplete: pendente <= 0,
          };
        });
      }

      if (!rows.length) return null;

      return window.el('div', {
        style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
        }, 'Pendencias por produto'),
        window.el('div', {
          style: 'display:grid;grid-template-columns:1fr auto auto auto;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f3f6;background:#f8f9fb;font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;',
        },
          window.el('span', {}, 'Produto'),
          window.el('span', { style: 'text-align:right;' }, key === 'Insumos>Tecelagem' ? 'Pedido' : 'Alocado'),
          window.el('span', { style: 'text-align:right;' }, 'Transferido'),
          window.el('span', { style: 'text-align:right;' }, 'Pendente')
        ),
        rows.map(function (row, index) {
          return window.el('div', {
            style: 'display:grid;grid-template-columns:1fr auto auto auto;gap:10px;padding:11px 14px;align-items:center;' + (index < rows.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
          },
            window.el('div', { style: 'font-size:13px;color:#16203a;line-height:1.45;' }, row.label),
            window.el('div', { style: 'font-size:12.5px;font-weight:600;color:#3f4757;text-align:right;' }, row.target),
            window.el('div', { style: 'font-size:12.5px;font-weight:600;color:#2563eb;text-align:right;' }, row.moved),
            window.el('div', {
              style: 'font-size:12.5px;font-weight:700;color:' + row.remainingColor + ';text-align:right;white-space:nowrap;',
            }, row.remaining)
          );
        })
      );
    }

    function buildMovementMetrics(ctxMovement) {
      if (ctxMovement.metrics) return ctxMovement.metrics;
      var key = transitionKey(ctxMovement);
      if (key === 'Insumos>Tecelagem') {
        var insumos = summarizeInsumos(ctxMovement);
        return {
          totalLabel: ns.fmtKg(insumos.pedido),
          movedLabel: ns.fmtKg(insumos.recebido),
          remainingLabel: ns.fmtKg(insumos.saldo),
        };
      }
      if (key === 'Expedicao>Entrega') {
        var expedicao = summarizeExpedicao();
        return {
          totalLabel: ns.fmtMetros(expedicao.liberado),
          movedLabel: ns.fmtMetros(expedicao.entregue),
          remainingLabel: ns.fmtMetros(expedicao.saldo),
        };
      }
      if (key === 'Acabamento>Expedicao') {
        var acabRows = buildAcabamentoLiberavelRows(ctxMovement);
        var recebidoAcab = ns.round2(acabRows.reduce(function (acc, row) { return acc + row.recebido; }, 0));
        var movidoAcab = ns.round2(acabRows.reduce(function (acc, row) { return acc + row.liberado; }, 0));
        return {
          totalLabel: ns.fmtMetros(recebidoAcab),
          movedLabel: ns.fmtMetros(movidoAcab),
          remainingLabel: ns.fmtMetros(ns.round2(Math.max(recebidoAcab - movidoAcab, 0))),
        };
      }
      if (!ctxMovement.op || !Array.isArray(ctxMovement.op.op_itens) || !ctxMovement.op.op_itens.length) {
        return {
          totalLabel: '-',
          movedLabel: '-',
          remainingLabel: '-',
        };
      }

      var stage = typeof ns.deliveryStageForOp === 'function'
        ? ns.deliveryStageForOp(ctxMovement.op)
        : (ctxMovement.op && ctxMovement.op.tipo === 'latex' ? 'latex' : 'cima');
      var opItemIds = {};
      var total = 0;
      var moved = 0;

      ctxMovement.op.op_itens.forEach(function (opItem) {
        if (opItem && opItem.id != null) opItemIds[opItem.id] = true;
        total += typeof ns.targetMetersForOpItem === 'function'
          ? ns.targetMetersForOpItem(opItem)
          : ns.toFiniteNumber(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
      });

      state.entregaItens.forEach(function (ei) {
        if (!opItemIds[ei.op_item_id] || ei.defeito) return;
        var entrega = state.entregasById[ei.entrega_id];
        if (!entrega || entrega.etapa !== stage) return;
        moved += ns.toFiniteNumber(ei.metros_entregues);
      });

      total = ns.round2(total);
      moved = ns.round2(moved);
      return {
        totalLabel: ns.fmtMetros(total),
        movedLabel: ns.fmtMetros(moved),
        remainingLabel: ns.fmtMetros(Math.max(total - moved, 0)),
      };
    }

    function buildMovementDocs(ctxMovement) {
      if (Array.isArray(ctxMovement.docsList) && ctxMovement.docsList.length) return ctxMovement.docsList;
      if (Array.isArray(ctxMovement.docs) && ctxMovement.docs.length) return ctxMovement.docs;
      var raw = ns.fmtTextoOuEmpty(ctxMovement.docs, 'Romaneio e NF');
      return raw.split(/\s*,\s*|\s+e\s+/i).filter(Boolean).map(function (item) {
        return item.charAt(0).toUpperCase() + item.slice(1);
      });
    }

    function transitionKey(ctxMovement) {
      return String(ctxMovement.origem || '').split(' - ')[0] + '>' + String(ctxMovement.destino || '');
    }

    function formatTransitionDate(value) {
      if (!value) return '-';
      if (window.fmtDataCurta) return window.fmtDataCurta(value);
      return String(value).slice(0, 10);
    }

    function modelLabelByModeloId(modeloId) {
      var modelo = state.modelosById[modeloId] || {};
      var cor1 = modelo.cor_1_id != null && state.coresById[modelo.cor_1_id] ? state.coresById[modelo.cor_1_id].nome : null;
      var cor2 = modelo.cor_2_id != null && state.coresById[modelo.cor_2_id] ? state.coresById[modelo.cor_2_id].nome : null;
      var label = modelo.nome || ('Modelo #' + modeloId);
      if (modelo.largura != null) label += ' - ' + Number(modelo.largura).toFixed(2).replace('.', ',') + ' m';
      if (cor1 || cor2) label += ' - ' + (cor1 || '-') + ' / ' + (cor2 || '-');
      return label;
    }

    function buildModelosForEntregaForm() {
      var result = {};
      Object.keys(state.modelosById || {}).forEach(function (modeloId) {
        var modelo = state.modelosById[modeloId] || {};
        result[modeloId] = Object.assign({}, modelo, {
          cor_1: modelo.cor_1_id != null ? state.coresById[modelo.cor_1_id] || null : null,
          cor_2: modelo.cor_2_id != null ? state.coresById[modelo.cor_2_id] || null : null,
        });
      });
      return result;
    }

    function opFornecedorId(op, etapa) {
      var row = ((op && op.op_fornecedores) || []).find(function (fornecedor) {
        return fornecedor && fornecedor.etapa === etapa;
      });
      return row ? row.fornecedor_id : null;
    }

    function summarizeInsumos(ctxMovement) {
      var opIds = ctxMovement.op ? [ctxMovement.op.id] : (state.ops || [])
        .filter(function (op) { return ns.stageKeyForOp(op) === 'tecelagem'; })
        .map(function (op) { return op.id; });
      var ordens = (state.ordensFio || []).filter(function (ordem) {
        return opIds.indexOf(ordem.op_id) !== -1;
      });
      var pedido = ns.round2(ordens.reduce(function (acc, ordem) {
        return acc + ns.toFiniteNumber(ordem.kg_pedido);
      }, 0));
      var recebido = ns.round2(ordens.reduce(function (acc, ordem) {
        return acc + ns.toFiniteNumber(ordem.kg_recebido);
      }, 0));
      return {
        ordens: ordens,
        pedido: pedido,
        recebido: recebido,
        saldo: ns.round2(Math.max(pedido - recebido, 0)),
      };
    }

    function summarizeExpedicao() {
      var liberado = ns.round2((state.expedicaoItens || []).reduce(function (acc, item) {
        return acc + ns.toFiniteNumber(item.metros_liberados);
      }, 0));
      var entregue = ns.round2((state.expedicaoItens || []).reduce(function (acc, item) {
        return acc + ns.toFiniteNumber(item.metros_entregues);
      }, 0));
      return {
        liberado: liberado,
        entregue: entregue,
        saldo: ns.round2(Math.max(liberado - entregue, 0)),
      };
    }

    function findOpDestinoByEntregaId(entregaId) {
      // Consolidação: a OP Látex de destino é resolvida pelo vínculo N:1
      // op_latex_entregas (várias parciais -> mesma OP). Fallback legado
      // por origem_entrega_id para dados anteriores à consolidação.
      var link = (state.opLatexEntregas || []).find(function (row) {
        return row && row.entrega_id === entregaId;
      });
      if (link) {
        return (state.ops || []).find(function (op) {
          return op && op.id === link.op_latex_id;
        }) || null;
      }
      return (state.ops || []).find(function (op) {
        return op && op.origem_entrega_id === entregaId;
      }) || null;
    }

    function openTecAcceptanceModal(tecAcceptance) {
      var op = tecAcceptance.op;
      if (!op || !Array.isArray(op.op_itens)) return;
      var ordens = (state.ordensFio || []).filter(function (o) { return o.op_id === op.id; });
      var parametrosByLargura = {};
      (state.parametrosLargura || []).forEach(function (p) {
        parametrosByLargura[Number(p.largura)] = p;
      });
      var pedidoNumero = state.pedido && state.pedido.numero ? state.pedido.numero : null;

      function itemLabel(opItem) {
        var modelo = state.modelosById[opItem.modelo_id] || {};
        var cor1 = modelo.cor_1_id != null && state.coresById[modelo.cor_1_id] ? state.coresById[modelo.cor_1_id].nome : null;
        var cor2 = modelo.cor_2_id != null && state.coresById[modelo.cor_2_id] ? state.coresById[modelo.cor_2_id].nome : null;
        var label = modelo.nome || ('Modelo #' + opItem.modelo_id);
        if (modelo.largura != null) label += ' · ' + Number(modelo.largura).toFixed(2).replace('.', ',') + ' m';
        if (cor1 || cor2) label += ' · ' + (cor1 || '-') + ' / ' + (cor2 || '-');
        return label;
      }

      function buildItensTable() {
        return window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;overflow:hidden;margin-bottom:12px;' },
          window.el('div', {
            style: 'display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f3f6;background:#f8f9fb;font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;',
          },
            window.el('span', {}, 'Produto'),
            window.el('span', { style: 'text-align:right;' }, 'Metros pedido')),
          op.op_itens.map(function (opItem, index) {
            var metros = ns.toFiniteNumber(opItem.metros_pedidos);
            return window.el('div', {
              style: 'display:grid;grid-template-columns:1fr auto;gap:10px;padding:11px 14px;align-items:center;' + (index < op.op_itens.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
            },
              window.el('div', { style: 'font-size:13px;color:#16203a;line-height:1.45;' }, itemLabel(opItem)),
              window.el('div', { style: 'font-size:13px;font-weight:600;color:#3f4757;text-align:right;' }, ns.fmtMetros(metros))
            );
          })
        );
      }

      function buildInfoBanner() {
        return window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:8px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:10px 12px;margin-bottom:12px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('div', { style: 'font-size:12.5px;color:#2c4a78;line-height:1.45;' },
            'Aceitar a OP libera a producao e aplica o ajuste proporcional. O mesmo helper canonico usado pela tela de OP (' +
            (window.aplicarRecalculoOP ? 'aplicarRecalculoOP' : 'indisponivel') +
            ') sera usado. A tela da OP continua aceitando como antes.')
        );
      }

      async function aplicarAceite(modo) {
        var itensCalc = op.op_itens.map(function (opItem) {
          return {
            op_item_id: opItem.id,
            modelo_id: opItem.modelo_id,
            metros_pedidos: ns.toFiniteNumber(opItem.metros_pedidos),
            metros_ajustados: ns.round2(ns.toFiniteNumber(opItem.metros_ajustados || opItem.metros_pedidos)),
          };
        });
        var resultado;
        if (modo === 'aceitar' && typeof window.recalcularOP === 'function') {
          resultado = window.recalcularOP(itensCalc, ordens);
        } else {
          resultado = { fator: 1, itens: itensCalc, sobras: [] };
        }
        if (!window.aplicarRecalculoOP) {
          window.toast('Operacao de recalculo indisponivel.', 'error');
          return false;
        }
        var res = await window.aplicarRecalculoOP({ opId: op.id, resultado: resultado, modo: modo, ordens: ordens });
        if (res && res.error) {
          window.toast('Erro ao aceitar OP: ' + (res.error.message || 'desconhecido'), 'error');
          console.error(res.error);
          return false;
        }
        return true;
      }

      function buildActions() {
        return window.el('div', { style: 'display:flex;gap:8px;' },
          window.el('button', {
            type: 'button',
            style: 'flex:1;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:10px 14px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;',
            onclick: async function (event) {
              var btn = event && event.currentTarget ? event.currentTarget : null;
              if (btn) btn.disabled = true;
              var ok = await aplicarAceite('aceitar');
              if (!ok) {
                if (btn) btn.disabled = false;
                return;
              }
              window.toast('OP aceita e producao liberada.', 'success');
              await reload();
              render();
            },
          }, 'Aceitar proposta (proporcional)'),
          window.el('button', {
            type: 'button',
            style: 'flex:1;background:#fff;color:#2563eb;border:1px solid #cfe0fb;border-radius:4px;padding:10px 14px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;',
            onclick: async function (event) {
              var btn = event && event.currentTarget ? event.currentTarget : null;
              if (btn) btn.disabled = true;
              var ok = await aplicarAceite('manter');
              if (!ok) {
                if (btn) btn.disabled = false;
                return;
              }
              window.toast('OP aceita com metragem do pedido.', 'success');
              await reload();
              render();
            },
          }, 'Manter como pedido'),
          window.el('button', {
            type: 'button',
            style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:10px 14px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;',
            onclick: function () { navigateToOp(op.id); },
          }, 'Abrir na tela da OP')
        );
      }

      window.modal({
        title: 'Aceitar OP ' + ns.opLabel(op) + (pedidoNumero ? ' · Pedido ' + pedidoNumero : ''),
        body: window.el('div', {},
          buildInfoBanner(),
          window.el('div', {
            style: 'display:flex;gap:12px;margin-bottom:12px;',
          },
            movementField('OP', ns.opLabel(op)),
            movementField('Status', ns.fmtTextoOuEmpty(op.status, 'aberta'))
          ),
          window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:8px;' }, 'Itens da OP'),
          buildItensTable(),
          ordens.length
            ? window.el('div', { style: 'font-size:12px;color:#5b6472;margin-bottom:12px;line-height:1.45;' },
                'Fios recebidos: ' + ordens.filter(function (o) { return ns.toFiniteNumber(o.kg_recebido) > 0; }).length + ' de ' + ordens.length)
            : null,
          buildActions()
        ),
        saveLabel: null,
        onSave: null,
      });
    }

    function buildPendingAcceptanceBlock(ctxMovement) {
      if (transitionKey(ctxMovement) !== 'Insumos>Tecelagem') return null;
      if (!ctxMovement.op || ctxMovement.op.status !== 'aberta') return null;
      var insumos = summarizeInsumos(ctxMovement);
      if (!(insumos.pedido > 0) || insumos.saldo > 0) return null;
      var opLabelBtn = ctxMovement.op.numero && ctxMovement.op.ano
        ? 'Revisar e aceitar OP ' + ctxMovement.op.numero + '/' + ctxMovement.op.ano
        : 'Revisar e aceitar OP';

      var tecAcceptance = currentView && currentView.chainState && currentView.chainState.tecPendingAcceptance || null;

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff9ee;border:1px solid #fbe8c6;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';padding:11px 14px;margin-bottom:14px;',
      },
        window.el('div', { style: 'min-width:0;' },
          window.el('div', { style: 'font-size:13px;font-weight:800;color:#8a5a15;line-height:1.3;' }, 'OP pendente de aceite'),
          window.el('div', { style: 'font-size:12.5px;color:#8a5a15;line-height:1.45;margin-top:2px;' },
            'Insumos recebidos; revise e aceite a OP para liberar producao.')
        ),
        tecAcceptance && tecAcceptance.op
          ? window.el('button', {
              type: 'button',
              style: 'flex-shrink:0;background:#2563eb;color:#fff;border:none;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';padding:8px 14px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;',
              onclick: function () { openTecAcceptanceModal(tecAcceptance); },
            }, 'Revisar e aceitar OP')
          : window.el('button', {
              type: 'button',
              style: 'flex-shrink:0;background:#fff;color:#2563eb;border:1px solid #2563eb;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';padding:8px 12px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;',
              onclick: function () { navigateToOp(ctxMovement.op.id); },
            }, opLabelBtn)
      );
    }

    function buildTransitionHistoryEntries(ctxMovement) {
      var key = transitionKey(ctxMovement);
      var entries = [];
      if (key === 'Insumos>Tecelagem') {
        var opIds = ctxMovement.op ? [ctxMovement.op.id] : (state.ops || [])
          .filter(function (op) { return ns.stageKeyForOp(op) === 'tecelagem'; })
          .map(function (op) { return op.id; });
        (state.ordensFio || []).forEach(function (ordem) {
          if (opIds.indexOf(ordem.op_id) === -1) return;
          var recebido = ns.toFiniteNumber(ordem.kg_recebido);
          if (!(recebido > 0)) return;
          entries.push({
            title: 'Recebimento de insumos',
            meta: (window.rotuloFio ? window.rotuloFio(ordem) : ns.fmtTextoOuEmpty(ordem.tipo, 'Fio')),
            amount: ns.fmtKg(recebido) + ' de ' + ns.fmtKg(ordem.kg_pedido),
            status: (window.OCF_STATUS_LABEL && window.OCF_STATUS_LABEL[ordem.status]) || ns.fmtTextoOuEmpty(ordem.status, 'Recebido'),
            date: '-',
          });
        });
      }
      if (key === 'Tecelagem>Acabamento') {
        var tecOpIds = ctxMovement.op ? [ctxMovement.op.id] : (state.ops || [])
          .filter(function (op) { return ns.stageKeyForOp(op) === 'tecelagem'; })
          .map(function (op) { return op.id; });
        (state.entregaItens || []).forEach(function (item) {
          if (tecOpIds.indexOf(item.op_id) === -1 || item.defeito) return;
          var entrega = state.entregasById[item.entrega_id];
          if (!entrega || entrega.etapa !== 'cima') return;
          var opDestino = findOpDestinoByEntregaId(entrega.id);
          // Contrato 6 — o histórico deve distinguir CRIAÇÃO de ACUMULAÇÃO.
          // A OP Látex é consolidada por (origem_op_id, destino_fornecedor_id):
          // a primeira entrega a criá-la fica gravada em ops.origem_entrega_id;
          // as demais apenas acumulam (op_latex_entregas N:1). Dizer "Gerou"
          // para toda entrega mentiria quando ela só somou numa OP já existente.
          var criouDestino = opDestino && opDestino.origem_entrega_id === entrega.id;
          entries.push({
            title: 'Transferencia para acabamento',
            meta: modelLabelByModeloId((ctxMovement.op && (ctxMovement.op.op_itens || []).find(function (opItem) {
              return opItem.id === item.op_item_id;
            }) || {}).modelo_id),
            amount: ns.fmtMetros(item.metros_entregues),
            status: opDestino
              ? ((criouDestino ? 'Criou ' : 'Acumulou em ') + ns.opLabel(opDestino))
              : 'Registrada',
            date: formatTransitionDate(entrega.data),
            note: entrega.destino && entrega.destino.nome ? ('Destino: ' + entrega.destino.nome) : null,
          });
        });
      }
      if (key === 'Acabamento>Expedicao') {
        var latexOpIds = ctxMovement.op ? [ctxMovement.op.id] : (state.ops || [])
          .filter(function (op) { return ns.stageKeyForOp(op) === 'acabamento'; })
          .map(function (op) { return op.id; });
        (state.expedicoes || []).forEach(function (expedicao) {
          if (latexOpIds.indexOf(expedicao.op_latex_id) === -1) return;
          (state.expedicaoItens || []).forEach(function (item) {
            if (item.expedicao_id !== expedicao.id) return;
            entries.push({
              title: 'Liberacao para expedicao',
              meta: modelLabelByModeloId(item.modelo_id),
              amount: ns.fmtMetros(item.metros_liberados),
              status: ns.fmtTextoOuEmpty(expedicao.status, 'Liberada'),
              date: formatTransitionDate(expedicao.liberado_em || expedicao.criado_em),
              note: 'Expedicao #' + expedicao.id,
            });
          });
        });
      }
      if (key === 'Expedicao>Entrega') {
        var expedicoesById = {};
        (state.expedicoes || []).forEach(function (expedicao) { expedicoesById[expedicao.id] = expedicao; });
        var itensById = {};
        (state.expedicaoItens || []).forEach(function (item) { itensById[item.id] = item; });
        var movimentosById = {};
        (state.expedicaoMovimentos || []).forEach(function (movimento) { movimentosById[movimento.id] = movimento; });
        (state.expedicaoMovimentoItens || []).forEach(function (item) {
          var movimento = movimentosById[item.movimento_id];
          var expedicaoItem = itensById[item.expedicao_item_id];
          if (!movimento || !expedicaoItem || !expedicoesById[movimento.expedicao_id]) return;
          entries.push({
            title: movimento.tipo === 'coleta' ? 'Coleta registrada' : 'Entrega registrada',
            meta: modelLabelByModeloId(expedicaoItem.modelo_id),
            amount: ns.fmtMetros(item.metros),
            status: 'Registrada',
            date: formatTransitionDate(movimento.data || movimento.criado_em),
            note: movimento.observacao || ('Expedicao #' + movimento.expedicao_id),
          });
        });
      }
      return entries;
    }

    function buildHistoryBlock(entries) {
      return window.el('div', {
        style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
        }, 'Historico da transicao'),
        entries.length
          ? entries.map(function (entry, index) {
              return window.el('div', {
                style: 'display:grid;grid-template-columns:92px 1fr auto;gap:12px;align-items:flex-start;padding:12px 14px;' + (index < entries.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
              },
                window.el('div', { style: 'font-size:12px;font-weight:700;color:#8a93a3;white-space:nowrap;' }, entry.date || '-'),
                window.el('div', { style: 'min-width:0;' },
                  window.el('div', { style: 'font-size:13.5px;font-weight:700;color:#16203a;line-height:1.35;' }, entry.title),
                  window.el('div', { style: 'font-size:12.5px;color:#5b6472;line-height:1.45;margin-top:2px;' }, entry.meta || '-'),
                  entry.note ? window.el('div', { style: 'font-size:12px;color:#8a93a3;line-height:1.45;margin-top:2px;' }, entry.note) : null
                ),
                window.el('div', { style: 'text-align:right;' },
                  window.el('div', { style: 'font-size:13px;font-weight:800;color:#2563eb;white-space:nowrap;' }, entry.amount || '-'),
                  window.el('div', { style: 'font-size:11px;font-weight:700;color:#18794a;margin-top:4px;white-space:nowrap;' }, entry.status || 'Registrada')
                )
              );
            })
          : window.el('div', {
              style: 'padding:12px 14px;font-size:13px;color:#8a93a3;',
            }, 'Nenhuma parcial registrada para esta transicao.')
      );
    }

    function buildInsumosTransferForm(ctxMovement) {
      var opIds = ctxMovement.op ? [ctxMovement.op.id] : [];
      var ordens = (state.ordensFio || []).filter(function (ordem) {
        return opIds.indexOf(ordem.op_id) !== -1;
      });
      var dataInput = window.textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
      var linhas = ordens.map(function (ordem) {
        var recebido = ns.toFiniteNumber(ordem.kg_recebido);
        var pedido = ns.toFiniteNumber(ordem.kg_pedido);
        var saldo = ns.round2(Math.max(pedido - recebido, 0));
        var input = window.textInput({ type: 'number', step: '0.01', value: saldo > 0 ? String(saldo) : '0' });
        input.disabled = saldo <= 0;
        return { ordem: ordem, input: input, saldo: saldo, recebido: recebido, pedido: pedido };
      });
      return {
        node: window.el('div', {},
          window.el('div', { style: 'display:grid;grid-template-columns:180px 1fr;gap:12px;margin-bottom:12px;' },
            window.el('div', {}, window.formField({ label: 'Data do recebimento', input: dataInput })),
            window.el('div', { style: 'font-size:12.5px;color:#8a93a3;align-self:end;line-height:1.4;' },
              'Informe a quantidade recebida agora; o helper canonico atualiza o total recebido da ordem.')
          ),
          window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;' },
            linhas.length ? linhas.map(function (linha, index) {
              return window.el('div', { style: 'display:grid;grid-template-columns:1fr 130px;gap:12px;align-items:center;padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
                window.el('div', {},
                  window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' }, window.rotuloFio ? window.rotuloFio(linha.ordem) : ns.fmtTextoOuEmpty(linha.ordem.tipo, 'Fio')),
                  window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:2px;' }, 'Saldo: ' + ns.fmtKg(linha.saldo))),
                linha.input
              );
            }) : window.el('div', { style: 'padding:12px 14px;font-size:13px;color:#8a93a3;' }, 'Nenhuma ordem de fio vinculada.')
          )
        ),
        saveLabel: 'Registrar recebimento',
        fillRemaining: function () {
          linhas.forEach(function (linha) {
            if (linha.saldo > 0 && !linha.input.disabled) {
              linha.input.value = String(linha.saldo);
            }
          });
        },
        hasRemaining: linhas.some(function (linha) { return linha.saldo > 0; }),
        onSave: async function () {
          if (!window.registrarRecebimentoOrdemFio) {
            window.toast('Operacao canonica de recebimento indisponivel.', 'error');
            return false;
          }
          var changed = false;
          for (var i = 0; i < linhas.length; i++) {
            var qtd = ns.toFiniteNumber(linhas[i].input.value);
            if (!(qtd > 0)) continue;
            if (qtd > linhas[i].saldo) {
              window.toast('Quantidade maior que o saldo do fio.', 'error');
              return false;
            }
            changed = true;
            var total = ns.round2(linhas[i].recebido + qtd);
            var res = await window.registrarRecebimentoOrdemFio({
              ordemId: linhas[i].ordem.id,
              kgRecebido: total,
              dataRecebimento: dataInput.value,
              status: total < linhas[i].pedido ? 'recebido_parcial' : 'recebido_total',
            });
            if (res && res.error) {
              window.toast('Erro ao registrar recebimento de fio.', 'error');
              console.error(res.error);
              return false;
            }
          }
          if (!changed) {
            window.toast('Informe ao menos uma quantidade de fio.', 'error');
            return false;
          }
          return true;
        },
      };
    }

    function buildTecelagemTransferForm(ctxMovement) {
      if (!ctxMovement.op || !window.buildEntregaInlineForm || !window.salvarEntregaCima) {
        return null;
      }
      var form = window.buildEntregaInlineForm({
        opItens: ctxMovement.op.op_itens || [],
        modelosById: buildModelosForEntregaForm(),
        latexOptions: state.latexOptions || [],
        comOpcaoSplit: true,
      });
      var pendingByItem = computePendingByItem(ctxMovement);
      var hasRemaining = pendingByItem.some(function (row) { return row.pending > 0; });
      return {
        node: form.node,
        saveLabel: 'Salvar transferencia',
        fillRemaining: function () {
          var inputs = form.node.querySelectorAll
            ? form.node.querySelectorAll('input[type="number"]')
            : [];
          var itemList = ctxMovement.op.op_itens || [];
          for (var i = 0; i < inputs.length && i < itemList.length && i < pendingByItem.length; i++) {
            if (pendingByItem[i].pending > 0 && !inputs[i].disabled) {
              inputs[i].value = String(pendingByItem[i].pending);
            }
          }
        },
        hasRemaining: hasRemaining,
        onSave: async function () {
          var fornecedorId = opFornecedorId(ctxMovement.op, 'cima');
          if (!fornecedorId) {
            window.toast('Fornecedor de tecelagem nao vinculado a OP.', 'error');
            return false;
          }
          var splitOpt = form.getSplitOption();
          return await window.salvarEntregaCima({
            fornecedorId: fornecedorId,
            opId: ctxMovement.op.id,
            payload: form.getPayload(),
          }, splitOpt.forceSplit ? { forceSplit: true, motivo: splitOpt.motivo } : undefined);
        },
      };
    }

    function buildAcabamentoLiberavelRows(ctxMovement) {
      if (!ctxMovement.op || !Array.isArray(ctxMovement.op.op_itens)) return [];

      var expedicaoIds = {};
      (state.expedicoes || []).forEach(function (expedicao) {
        if (String(expedicao.op_latex_id) === String(ctxMovement.op.id)) expedicaoIds[expedicao.id] = true;
      });

      var liberadoByItem = {};
      (state.expedicaoItens || []).forEach(function (item) {
        if (!expedicaoIds[item.expedicao_id]) return;
        liberadoByItem[item.op_item_id] = ns.round2((liberadoByItem[item.op_item_id] || 0) + ns.toFiniteNumber(item.metros_liberados));
      });

      // Recebido no acabamento = op_item da OP Latex (acumulado a partir das
      // entregas Tecelagem->Acabamento). Sem premissa etapa='latex'.
      // Disponivel para movimentar = recebido - ja movimentado para expedicao.
      return ctxMovement.op.op_itens.map(function (opItem) {
        var recebido = typeof ns.targetMetersForOpItem === 'function'
          ? ns.targetMetersForOpItem(opItem)
          : ns.round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
        var liberado = ns.toFiniteNumber(liberadoByItem[opItem.id]);
        return {
          opItem: opItem,
          recebido: ns.round2(recebido),
          liberado: ns.round2(liberado),
          saldo: ns.round2(Math.max(recebido - liberado, 0)),
        };
      });
    }

    function buildAcabamentoTransferForm(ctxMovement) {
      var rows = buildAcabamentoLiberavelRows(ctxMovement).filter(function (row) { return row.saldo > 0; });
      if (!rows.length) {
        return {
          node: window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
            'Sem saldo recebido para movimentar. Para OP terminal, a liberacao total legada continua disponivel.'),
          saveLabel: 'Movimentar para expedicao',
          onSave: async function () {
            if (!ctxMovement.op || !window.supa) {
              window.toast('OP de acabamento indisponivel para movimentar.', 'error');
              return false;
            }
            var r = await window.supa.rpc('liberar_expedicao', { p_op_latex_id: ctxMovement.op.id });
            if (r.error || (r.data && r.data.ok === false)) {
              var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Movimentacao nao realizada');
              window.toast('Erro ao movimentar para expedicao: ' + msg, 'error');
              console.error(r.error || r.data);
              return false;
            }
            return true;
          },
        };
      }

      var linhas = rows.map(function (row) {
        var input = window.textInput({ type: 'number', step: '0.01', value: String(row.saldo) });
        return { row: row, input: input };
      });

      return {
        node: window.el('div', {},
          window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;' },
            linhas.map(function (linha, index) {
              return window.el('div', { style: 'display:grid;grid-template-columns:1fr 120px 120px 130px;gap:12px;align-items:center;padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
                window.el('div', {},
                  window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' }, modelLabelByModeloId(linha.row.opItem.modelo_id)),
                  window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:2px;' },
                    'Recebido: ' + ns.fmtMetros(linha.row.recebido) + ' | movimentado: ' + ns.fmtMetros(linha.row.liberado))),
                window.el('div', { style: 'font-size:12.5px;font-weight:700;color:#2563eb;' }, ns.fmtMetros(linha.row.saldo)),
                window.el('label', { style: 'font-size:11.5px;color:#8a93a3;font-weight:700;text-transform:uppercase;' }, 'Movimentar'),
                linha.input
              );
            })
          )
        ),
        saveLabel: 'Movimentar para expedicao',
        onSave: async function () {
          if (!ctxMovement.op || !window.supa) {
            window.toast('OP de acabamento indisponivel para movimentar.', 'error');
            return false;
          }
          var payload = [];
          for (var i = 0; i < linhas.length; i++) {
            var metros = ns.toFiniteNumber(linhas[i].input.value);
            if (metros > linhas[i].row.saldo) {
              window.toast('Quantidade maior que o saldo disponivel para movimentar.', 'error');
              return false;
            }
            if (metros > 0) payload.push({ op_item_id: linhas[i].row.opItem.id, metros: metros });
          }
          if (!payload.length) {
            window.toast('Informe ao menos uma quantidade para movimentar.', 'error');
            return false;
          }
          var r = await window.supa.rpc('liberar_expedicao_latex_parcial', {
            p_op_latex_id: ctxMovement.op.id,
            p_itens: payload,
            p_observacao: 'Movimentacao Acabamento -> Expedicao pelo detalhe do Pedido',
          });
          if (r.error || (r.data && r.data.ok === false)) {
            var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Movimentacao nao realizada');
            window.toast('Erro ao movimentar para expedicao: ' + msg, 'error');
            console.error(r.error || r.data);
            return false;
          }
          return true;
        },
      };
    }

    function buildExpedicaoTransferForm() {
      var expedicao = (state.expedicoes || []).find(function (row) {
        return (state.expedicaoItens || []).some(function (item) {
          return item.expedicao_id === row.id && ns.toFiniteNumber(item.metros_liberados) > ns.toFiniteNumber(item.metros_entregues);
        });
      });
      if (!expedicao) return null;
      var itens = (state.expedicaoItens || []).filter(function (item) { return item.expedicao_id === expedicao.id; });
      var tipoInput = window.selectInput({
        options: [{ value: 'entrega', label: 'Entrega' }, { value: 'coleta', label: 'Coleta' }],
        value: 'entrega',
      });
      var dataInput = window.textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
      var obsInput = window.textInput({ type: 'text', value: '', placeholder: 'observacao (opcional)' });
      var linhas = itens.map(function (item) {
        var saldo = ns.round2(Math.max(ns.toFiniteNumber(item.metros_liberados) - ns.toFiniteNumber(item.metros_entregues), 0));
        var input = window.textInput({ type: 'number', step: '0.01', value: saldo > 0 ? String(saldo) : '0' });
        input.disabled = saldo <= 0;
        return { item: item, input: input, saldo: saldo };
      });
      return {
        node: window.el('div', {},
          window.el('div', { style: 'display:grid;grid-template-columns:150px 150px 1fr;gap:12px;margin-bottom:12px;' },
            window.el('div', {}, window.formField({ label: 'Tipo', input: tipoInput })),
            window.el('div', {}, window.formField({ label: 'Data', input: dataInput })),
            window.el('div', {}, window.formField({ label: 'Observacao', input: obsInput }))
          ),
          window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;' },
            linhas.map(function (linha, index) {
              return window.el('div', { style: 'display:grid;grid-template-columns:1fr 130px;gap:12px;align-items:center;padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
                window.el('div', {},
                  window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' }, modelLabelByModeloId(linha.item.modelo_id)),
                  window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:2px;' }, 'Saldo: ' + ns.fmtMetros(linha.saldo))),
                linha.input
              );
            })
          )
        ),
        saveLabel: 'Registrar entrega',
        fillRemaining: function () {
          linhas.forEach(function (linha) {
            if (linha.saldo > 0 && !linha.input.disabled) {
              linha.input.value = String(linha.saldo);
            }
          });
        },
        hasRemaining: linhas.some(function (linha) { return linha.saldo > 0; }),
        onSave: async function () {
          var payload = [];
          linhas.forEach(function (linha) {
            var metros = ns.toFiniteNumber(linha.input.value);
            if (metros > 0) payload.push({ expedicao_item_id: linha.item.id, metros: metros });
          });
          for (var i = 0; i < payload.length; i++) {
            var linha = linhas.find(function (row) { return row.item.id === payload[i].expedicao_item_id; });
            if (linha && payload[i].metros > linha.saldo) {
              window.toast('Quantidade maior que o saldo do item.', 'error');
              return false;
            }
          }
          if (!payload.length) {
            window.toast('Informe ao menos uma quantidade para entrega/coleta.', 'error');
            return false;
          }
          var r = await window.supa.rpc('registrar_entrega_expedicao', {
            p_expedicao_id: expedicao.id,
            p_tipo: tipoInput.value,
            p_data: dataInput.value,
            p_itens: payload,
            p_observacao: obsInput.value ? obsInput.value.trim() : null,
          });
          if (r.error || (r.data && r.data.ok === false)) {
            var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Nao foi possivel registrar');
            window.toast('Erro ao registrar expedicao: ' + msg, 'error');
            console.error(r.error || r.data);
            return false;
          }
          return true;
        },
      };
    }

    function buildTransferForm(ctxMovement) {
      var key = transitionKey(ctxMovement);
      if (key === 'Insumos>Tecelagem') return buildInsumosTransferForm(ctxMovement);
      if (key === 'Tecelagem>Acabamento') return buildTecelagemTransferForm(ctxMovement);
      if (key === 'Acabamento>Expedicao') return buildAcabamentoTransferForm(ctxMovement);
      if (key === 'Expedicao>Entrega') return buildExpedicaoTransferForm(ctxMovement);
      return null;
    }

    function openMovementModal(ctxMovement) {
      var opLabel = ctxMovement.op ? ns.opLabel(ctxMovement.op) : 'Sem OP vinculada';
      var items = buildMovementItems(ctxMovement);
      var metrics = buildMovementMetrics(ctxMovement);
      var docs = buildMovementDocs(ctxMovement);
      var action = ctxMovement.action || {};
      var mode = action.mode === 'enabled' ? 'transfer' : 'history';
      var historyEntries = buildTransitionHistoryEntries(ctxMovement);
      var transferForm = mode === 'transfer' ? buildTransferForm(ctxMovement) : null;
      if (transferForm && transferForm.node) normalizeMovementModalControls(transferForm.node);
      var body = window.el('div', {},
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'width:36px;height:36px;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';background:#eef3ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
          }, ns.svgEl(ns.SVG_INFO)),
          window.el('div', {},
            window.el('div', {
              style: 'font-size:11px;font-weight:700;letter-spacing:.04em;color:#2563eb;text-transform:uppercase;margin-bottom:4px;',
            }, mode === 'transfer' ? 'Movimentacao no Pedido' : 'Historico da transicao'),
            window.el('div', {
              style: 'font-size:15px;font-weight:800;color:#16203a;',
            }, ctxMovement.title),
            window.el('div', {
              style: 'font-size:13px;color:#5b6472;margin-top:6px;line-height:1.5;',
            }, ctxMovement.detalhe)
          )
        ),
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:10px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:12px 14px;margin-bottom:14px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('span', {
            style: 'font-size:12.5px;color:#2c4a78;line-height:1.5;',
          }, mode === 'transfer'
            ? 'A transferencia acontece no contexto do Pedido, mas grava pela mesma operacao canonica usada na OP. Nao existe lancamento paralelo.'
            : 'Movimentos feitos pela OP ou pela seta do Pedido aparecem neste historico da transicao.')
        ),
        buildPendingAcceptanceBlock(ctxMovement),
        window.el('div', {
          style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;',
        },
          movementField('Origem', ctxMovement.origem),
          movementField('Destino', ctxMovement.destino)
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;',
        },
          movementField('OP de origem', opLabel),
          movementField('Saldo/restante calculado', metrics.remainingLabel)
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;',
        },
          movementMetricCard('Planejado na OP', metrics.totalLabel),
          movementMetricCard('Ja movimentado', metrics.movedLabel, '#2563eb'),
          movementMetricCard('Restante na origem', metrics.remainingLabel, '#c2610c')
        ),
        buildTransitionPendingTable(ctxMovement),
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
          }, 'Itens envolvidos'),
          items.length
            ? items.map(function (item, index) {
                return window.el('div', {
                  style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;' + (index < items.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
                },
                  window.el('div', {
                    style: 'font-size:13px;color:#16203a;line-height:1.45;',
                  }, item.label),
                  window.el('div', {
            style: 'font-size:12px;font-weight:700;color:#2563eb;white-space:nowrap;',
                  }, item.meta)
                );
              })
            : window.el('div', {
                style: 'padding:12px 14px;font-size:13px;color:#8a93a3;',
              }, 'Nenhum item consolidado para exibir nesta origem.')
        ),
        buildHistoryBlock(historyEntries),
        mode === 'transfer'
          ? window.el('div', {
              style: 'border:1px solid #d0e0fb;border-radius:4px;background:#f8fbff;padding:13px 14px;margin-bottom:14px;',
            },
              window.el('div', {
                style: 'font-size:12px;font-weight:700;letter-spacing:.03em;color:#2563eb;text-transform:uppercase;margin-bottom:10px;',
              }, 'Registrar nova transferencia'),
              transferForm
                ? transferForm.node
                : window.el('div', { style: 'font-size:13px;color:#8a93a3;line-height:1.5;' },
                    'Nao ha formulario canonico disponivel para esta transicao no estado atual.'),
              transferForm && transferForm.hasRemaining && typeof transferForm.fillRemaining === 'function'
                ? window.el('div', { style: 'margin-top:10px;' },
                    window.el('button', {
                      type: 'button',
                      style: 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#2563eb;border:1px solid #cfe0fb;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';padding:7px 12px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;',
                      onclick: function () { transferForm.fillRemaining(); },
                    }, 'Transferir restante'))
                : null
            )
          : null,
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;',
        },
          window.el('div', {
            style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
          }, 'Documentos esperados'),
          docs.map(function (doc, index) {
            return window.el('div', {
              style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;' + (index < docs.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
            },
              window.el('div', { style: 'display:flex;align-items:center;gap:9px;min-width:0;' },
                ns.svgEl(ns.SVG_FILE),
                window.el('span', {
                  style: 'font-size:13px;font-weight:600;color:#3f4757;',
                }, doc)
              ),
              window.el('span', {
                style: 'display:inline-flex;align-items:center;border:1px solid #fbe8c6;background:#fff9ee;color:#8a5a15;border-radius:' + MOVEMENT_SURFACE_RADIUS + ';padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;',
              }, 'Esperado')
            );
          })
        ),
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:10px;background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:12px 14px;margin-top:12px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('span', {
            style: 'font-size:12.5px;color:#5b6472;line-height:1.5;',
          }, ctxMovement.op
            ? 'A operacao continua canonica na OP de origem. Este atalho reutiliza o mesmo helper/RPC operacional e nao mantem estado paralelo no Pedido.'
            : 'Ainda nao existe uma OP de origem vinculada para esta transicao. O Pedido nao cria movimentacao propria fora da operacao canonica.')
        )
      );

      var overlay = window.el('div', {
        style: 'position:fixed;inset:0;background:rgba(20,30,45,.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;',
      });

      function closeModal() {
        overlay.remove();
        document.removeEventListener('keydown', escListener);
      }

      function escListener(evt) {
        if (evt.key === 'Escape') closeModal();
      }

      overlay.addEventListener('click', function (evt) {
        if (evt.target === overlay) closeModal();
      });
      document.addEventListener('keydown', escListener);

      var card = window.el('div', {
        style: 'position:relative;background:#fff;border:1px solid #eceef1;border-radius:' + MOVEMENT_MODAL_RADIUS + ';width:520px;max-height:calc(100vh - 48px);overflow-y:auto;box-shadow:' + MOVEMENT_MODAL_SHADOW + ';',
      });
      var closeBtn = window.el('button', {
        type: 'button',
        style: 'position:absolute;top:18px;right:18px;background:none;border:none;cursor:pointer;padding:4px;color:#9aa2af;line-height:0;',
        onclick: closeModal,
      }, ns.svgEl('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'));
      var content = window.el('div', {
        style: 'padding:20px 22px 18px;',
      }, body);
      var footer = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid #eceef1;',
      });
      var cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 18px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
        onclick: closeModal,
      }, mode === 'transfer' ? 'Cancelar' : 'Fechar');

      footer.appendChild(cancelBtn);
      if (mode === 'transfer' && transferForm && typeof transferForm.onSave === 'function') {
        var primaryBtn = window.el('button', {
          type: 'button',
          style: 'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 20px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
          onclick: async function (event) {
            var btn = event && event.currentTarget ? event.currentTarget : null;
            if (btn) btn.disabled = true;
            var ok = await transferForm.onSave();
            if (!ok) {
              if (btn) btn.disabled = false;
              return;
            }
            window.toast('Movimentacao registrada.', 'success');
            await reload();
            render();
            closeModal();
          },
        }, transferForm.saveLabel || 'Salvar');
        footer.appendChild(primaryBtn);
      }
      card.appendChild(closeBtn);
      card.appendChild(content);
      card.appendChild(footer);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    function buildStageDetailBody(stage, view) {
      var key = stage.key;
      var sectionTitle = function (title) {
        return window.el('div', {
          style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:10px;margin-top:16px;',
        }, title);
      };
      var emptyRow = function (msg) {
        return window.el('div', { style: 'font-size:12.5px;color:#8a93a3;' }, msg || 'Nenhuma informacao disponivel.');
      };
      var linkBtn = function (label, onclick) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:#2563eb;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;',
          onclick: onclick,
        }, label);
      };
      // Botao de acao solido (curto). As acoes REUTILIZAM handlers canonicos
      // (finalizarOp -> alterar_status_op; openMovementModal -> forms/RPCs;
      // openTecAcceptanceModal; concluirPedido). Nao ha write inline aqui.
      var actionBtn = function (label, onclick) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:7px 12px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;',
          onclick: onclick,
        }, label);
      };
      var actionsRow = function () {
        var btns = Array.prototype.slice.call(arguments).filter(Boolean);
        return window.el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;' }, btns);
      };
      var reasonRow = function (msg) {
        return window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:4px;line-height:1.4;' }, msg);
      };
      var infoRow = function (msg, tone) {
        var styles = {
          info: { bg: '#f6f9ff', border: '#d0e0fb', color: '#2c4a78' },
          warn: { bg: '#fff9ee', border: '#fbe8c6', color: '#8a5a15' },
          ok: { bg: '#e7f4ec', border: '#c2e7d1', color: '#2f8256' },
        };
        var s = styles[tone || 'info'] || styles.info;
        return window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:8px;background:' + s.bg + ';border:1px solid ' + s.border + ';border-radius:4px;padding:10px 12px;margin-top:10px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('div', { style: 'font-size:12.5px;color:' + s.color + ';line-height:1.4;' }, msg)
        );
      };
      // Reusa o objeto de transferencia canonico do stepper (mesma origem/
      // destino/RPC) forcando a acao para o modal de movimentacao existente.
      var stageTransfer = function (stepKey, op) {
        var st = ((view && view.stepper) || []).find(function (s) { return s.key === stepKey; });
        var t = (st && st.transfer) ? st.transfer : {};
        return Object.assign({}, t, { op: op || t.op, action: { mode: 'enabled' } });
      };
      var openMovimentar = function (stepKey, op) {
        return function () { openMovementModal(stageTransfer(stepKey, op)); };
      };
      var terminalStatus = function (st) { return st === 'concluida' || st === 'finalizada'; };

      if (key === 'insumos') {
        var insumos = summarizeInsumos({ op: null });
        var tecelagens = (state.ops || []).filter(function (op) { return ns.stageKeyForOp(op) === 'tecelagem'; });
        var tecOpen = tecelagens.some(function (op) { return op.status === 'aberta' || op.status === 'simulada'; });
        var tecProduction = tecelagens.some(function (op) { return op.status === 'em_producao'; });
        var semOp = (state.ops || []).length === 0;
        var tecPend = view && view.chainState && view.chainState.tecPendingAcceptance;

        return window.el('div', {},
          semOp
            ? window.el('div', {
                style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:12px 14px;margin-bottom:12px;flex-wrap:wrap;',
              },
                window.el('div', { style: 'font-size:12.5px;color:#2c4a78;line-height:1.4;min-width:180px;' },
                  'Pedido ainda sem OP vinculada. Gere a primeira OP para iniciar o fluxo produtivo.'),
                actionBtn('Gerar primeira OP', function () { navigateToNovaOp(); }))
            : null,
          semOp
            ? infoRow('Pedido ainda nao possui OP vinculada. Proxima acao: Gerar primeira OP neste hub.', 'info')
            : null,
          sectionTitle('Ordens de fio'),
          insumos.ordens.length
            ? insumos.ordens.map(function (ordem) {
                return window.el('div', {
                  style: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f3f6;',
                },
                  window.el('div', { style: 'font-size:12.5px;color:#3f4757;' },
                    window.rotuloFio ? window.rotuloFio(ordem) : ns.fmtTextoOuEmpty(ordem.tipo, 'Fio')),
                  window.el('div', { style: 'font-size:12.5px;font-weight:600;color:#2563eb;text-align:right;' },
                    ns.fmtKg(ordem.kg_recebido) + ' de ' + ns.fmtKg(ordem.kg_pedido) + ' · ' + (ns.toFiniteNumber(ordem.kg_recebido) >= ns.toFiniteNumber(ordem.kg_pedido) ? 'completo' : 'pendente'))
                );
              })
            : emptyRow('Nenhuma ordem de fio vinculada.'),
          tecelagens.length
            ? window.el('div', {},
                sectionTitle('OPs de Tecelagem'),
                tecelagens.map(function (op) {
                  var podeAceitar = op.status === 'aberta';
                  return window.el('div', {
                    style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f1f3f6;flex-wrap:wrap;',
                  },
                    window.el('div', { style: 'font-size:12.5px;color:#3f4757;' },
                      ns.opLabel(op) + ' · ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(op.status) : op.status)),
                    actionsRow(
                      linkBtn('Abrir OP', function () { navigateToOp(op.id); }),
                      podeAceitar ? actionBtn('Aceitar OP', function () { openTecAcceptanceModal({ op: op }); }) : null));
                })
              )
            : null,
          tecOpen && !tecProduction && insumos.ordens.length > 0
            ? window.el('div', {
                style: 'display:flex;align-items:flex-start;gap:8px;background:#fff9ee;border:1px solid #fbe8c6;border-radius:4px;padding:10px 12px;margin-top:10px;',
              },
                ns.svgEl(ns.SVG_INFO),
                window.el('div', { style: 'font-size:12.5px;color:#8a5a15;line-height:1.4;' },
                  tecPend
                    ? 'OP de Tecelagem pendente de aceite. Proxima acao: Aceitar OP neste hub ou abrir a OP.'
                    : 'OP de Tecelagem pendente de aceite. Insumos recebidos; proxima acao: Aceitar OP.'))
            : null
        );
      }

      if (key === 'tecelagem') {
        var tecOps = (state.ops || []).filter(function (op) { return ns.stageKeyForOp(op) === 'tecelagem'; });
        var tecSummaries = (view && view.opSummaries || []).filter(function (s) { return s.stageKey === 'tecelagem'; });

        return window.el('div', {},
          tecOps.length
            ? window.el('div', {},
                sectionTitle('OPs de Tecelagem'),
                tecOps.map(function (op) {
                  var summary = tecSummaries.find(function (s) { return s.id === op.id; }) || {};
                  var remaining = ns.toFiniteNumber(summary.remaining);
                  var saldoEntregue = ns.toFiniteNumber(summary.target) > 0 && remaining <= 0;
                  var terminal = terminalStatus(op.status);
                  var terminalidadeLabel = terminal
                    ? 'Finalizacao explicita registrada no status da OP.'
                    : (saldoEntregue
                      ? 'Tecelagem entregue; finalizar OP.'
                      : 'Tecelagem ainda possui saldo produtivo pendente.');
                  var podeAceitar = op.status === 'aberta';
                  var podeFinalizar = op.status === 'em_producao' && saldoEntregue && !terminal;
                  var podeTransferir = op.status === 'em_producao' && remaining > 0;
                  var semAcao = !podeAceitar && !podeFinalizar && !podeTransferir;
                  return window.el('div', { style: 'margin-bottom:12px;' },
                    window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;' },
                      window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' },
                        ns.opLabel(op) + ' · ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(op.status) : op.status)),
                      actionsRow(
                        linkBtn('Abrir OP', function () { navigateToOp(op.id); }),
                        podeAceitar ? actionBtn('Aceitar OP', function () { openTecAcceptanceModal({ op: op }); }) : null,
                        podeTransferir ? actionBtn('Transferir', openMovimentar('tecelagem', op)) : null,
                        podeFinalizar ? actionBtn('Finalizar OP', function () { finalizarOp(op); }) : null)),
                    window.el('div', { style: 'font-size:12.5px;color:#5b6472;margin-top:4px;line-height:1.4;' },
                      'Target: ' + ns.fmtMetros(summary.target || 0) + ' | Transferido: ' + ns.fmtMetros(summary.done || 0) + ' | Pendente: ' + ns.fmtMetros(summary.remaining || 0)),
                    window.el('div', { style: 'font-size:12px;color:' + (terminal ? '#18794a' : (saldoEntregue ? '#c2610c' : '#8a93a3')) + ';margin-top:2px;font-weight:600;' }, terminalidadeLabel),
                    podeTransferir ? reasonRow('Ha saldo disponivel para transferir. Proxima acao: Transferir para Acabamento.') : null,
                    podeFinalizar ? reasonRow('Saldo produtivo entregue. Proxima acao: Finalizar OP neste hub.') : null,
                    semAcao && !terminal ? reasonRow('Sem acao disponivel agora nesta OP.') : null,
                    summary.modelNames && summary.modelNames.length
                      ? window.el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:2px;' }, 'Modelos: ' + summary.modelNames.join(', '))
                      : null,
                    summary.docBanner
                      ? window.el('div', { style: 'font-size:11.5px;color:#c2610c;margin-top:2px;' }, summary.docBanner)
                      : null
                  );
                })
              )
            : window.el('div', {},
                sectionTitle('OPs de Tecelagem'),
                emptyRow('Nenhuma OP de tecelagem vinculada ao pedido.')),
          sectionTitle('Entregas recentes (Tecelagem → Acabamento)'),
          (state.entregaItens || []).filter(function (ei) {
            if (ei.defeito) return false;
            var entrega = state.entregasById[ei.entrega_id];
            if (!entrega || entrega.etapa !== 'cima') return false;
            return tecOps.some(function (op) { return op.id === ei.op_id; });
          }).slice(0, 5).map(function (ei) {
            var entrega = state.entregasById[ei.entrega_id];
            var opDestino = findOpDestinoByEntregaId(entrega && entrega.id);
            var item = (tecOps[0] && tecOps[0].op_itens || []).find(function (it) { return it.id === ei.op_item_id; });
            return window.el('div', {
              style: 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f3f6;',
            },
              window.el('div', { style: 'font-size:12px;color:#3f4757;' },
                formatTransitionDate(entrega && entrega.data) + ' · ' + ns.fmtMetros(ei.metros_entregues)),
              window.el('div', { style: 'font-size:11.5px;color:#8a93a3;text-align:right;' },
                opDestino ? ('→ ' + ns.opLabel(opDestino)) : 'Registrada'));
          }).length
            ? (tecOps.length ? '' : emptyRow('Nenhuma entrega registrada.'))
            : null,
          (state.ops || []).filter(function (op) { return op.tipo === 'latex'; }).filter(function (op) {
            return tecOps.some(function (tecOp) { return op.origem_op_id === tecOp.id; });
          }).length
            ? window.el('div', {},
                sectionTitle('OPs Latex geradas desta Tecelagem'),
                (state.ops || []).filter(function (op) { return op.tipo === 'latex'; }).filter(function (op) {
                  return tecOps.some(function (tecOp) { return op.origem_op_id === tecOp.id; });
                }).map(function (op) {
                  return window.el('div', {
                    style: 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f3f6;',
                  },
                    window.el('div', { style: 'font-size:12.5px;color:#3f4757;' },
                      ns.opLabel(op) + ' · ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(op.status) : op.status)),
                    linkBtn('Abrir OP', function () { navigateToOp(op.id); }));
                })
              )
            : null,
          view && view.chainState && view.chainState.tecPendingAcceptance
            ? window.el('div', {
                style: 'display:flex;align-items:flex-start;gap:8px;background:#fff9ee;border:1px solid #fbe8c6;border-radius:4px;padding:10px 12px;margin-top:10px;',
              },
                ns.svgEl(ns.SVG_INFO),
                window.el('div', { style: 'font-size:12.5px;color:#8a5a15;line-height:1.4;' }, 'OP Tecelagem pendente de aceite. Proxima acao: Aceitar OP neste hub.'))
            : null
        );
      }

      if (key === 'acabamento') {
        var acabOps = (state.ops || []).filter(function (op) { return ns.stageKeyForOp(op) === 'acabamento'; });
        var acabSummaries = (view && view.opSummaries || []).filter(function (s) { return s.stageKey === 'acabamento'; });
        var expSummariesAcab = (view && view.expedicaoSummaries) || [];

        return window.el('div', {},
          acabOps.length
            ? window.el('div', {},
                sectionTitle('OPs de Acabamento/Latex'),
                acabOps.map(function (op) {
                  var summary = acabSummaries.find(function (s) { return s.id === op.id; }) || {};
                  var fornecedor = ((op.op_fornecedores || []).find(function (f) { return f.etapa === 'latex'; }) || {}).fornecedores;
                  // Paridade com o contrato Acabamento->Expedicao: target =
                  // recebido da Tecelagem; done = ja movimentado p/ Expedicao;
                  // remaining = disponivel/saldo em acabamento.
                  var recebido = ns.toFiniteNumber(summary.target);
                  var movido = ns.toFiniteNumber(summary.done);
                  var disponivel = ns.toFiniteNumber(summary.remaining);
                  var exp = expSummariesAcab.find(function (e) { return String(e.opLatexId) === String(op.id); });
                  var entregueOp = exp ? ns.toFiniteNumber(exp.entregue) : 0;
                  var terminal = terminalStatus(op.status);
                  var movivel = op.status === 'em_producao' || terminal;
                  var podeMovimentar = movivel && disponivel > 0;
                  var podeFinalizar = op.status === 'em_producao' && recebido > 0 && disponivel <= 0 && !terminal;
                  var motivoBloqueio = null;
                  if (!podeMovimentar && !podeFinalizar) {
                    if (recebido <= 0) {
                      motivoBloqueio = 'Sem material recebido da Tecelagem. Proxima acao: transferir material pela etapa Tecelagem.';
                    } else if (!movivel) {
                      motivoBloqueio = 'OP Acabamento ainda nao esta em producao para movimentar. Abra a OP para revisar o status.';
                    } else if (disponivel <= 0 && exp) {
                      motivoBloqueio = 'Tudo ja movimentado para Expedicao. Proxima acao: Entregar pela etapa Expedicao.';
                    } else if (disponivel <= 0) {
                      motivoBloqueio = 'Sem saldo em acabamento disponivel para movimentar.';
                    }
                  }
                  return window.el('div', { style: 'margin-bottom:10px;' },
                    window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;' },
                      window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' },
                        ns.opLabel(op) + ' · ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(op.status) : op.status)),
                      actionsRow(
                        linkBtn('Abrir OP', function () { navigateToOp(op.id); }),
                        podeMovimentar ? actionBtn('Movimentar', openMovimentar('acabamento', op)) : null,
                        podeFinalizar ? actionBtn('Finalizar OP', function () { finalizarOp(op); }) : null)),
                    window.el('div', { style: 'font-size:12.5px;color:#5b6472;margin-top:4px;line-height:1.4;' },
                      'Recebido: ' + ns.fmtMetros(recebido) + ' | Movimentado: ' + ns.fmtMetros(movido) + ' | Disponivel: ' + ns.fmtMetros(disponivel) + ' | Entregue: ' + ns.fmtMetros(entregueOp)),
                    podeMovimentar ? reasonRow('Ha saldo em acabamento nao movimentado. Proxima acao: Movimentar para Expedicao.') : null,
                    podeFinalizar ? reasonRow('Saldo 0 em acabamento. Proxima acao: Finalizar OP neste hub.') : null,
                    motivoBloqueio ? reasonRow(motivoBloqueio) : null,
                    fornecedor
                      ? window.el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:2px;' }, 'Fornecedor: ' + fornecedor.nome)
                      : null
                  );
                })
              )
            : emptyRow('Nenhuma OP de acabamento vinculada.'),
          sectionTitle('Material recebido da Tecelagem'),
          (state.entregaItens || []).filter(function (ei) {
            if (ei.defeito) return false;
            var entrega = state.entregasById[ei.entrega_id];
            if (!entrega || entrega.etapa !== 'cima') return false;
            return acabOps.some(function (op) { return ei.op_id === (op.origem_op_id) || (state.ops || []).some(function (origemOp) { return origemOp.id === ei.op_id && origemOp.tipo === 'tecelagem'; }); });
          }).slice(0, 5).map(function (ei) {
            var entrega = state.entregasById[ei.entrega_id];
            return window.el('div', {
              style: 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f3f6;',
            },
              window.el('div', { style: 'font-size:12px;color:#3f4757;' },
                formatTransitionDate(entrega && entrega.data) + ' · ' + ns.fmtMetros(ei.metros_entregues)),
              window.el('div', { style: 'font-size:11.5px;color:#8a93a3;text-align:right;' }, 'Recebido da Tecelagem'));
          }).length ? null : emptyRow('Nenhum material registrado.')
        );
      }

      if (key === 'expedicao') {
        var expSummaries = view && view.expedicaoSummaries || [];
        return window.el('div', {},
          sectionTitle('Expedicoes'),
          expSummaries.length
            ? expSummaries.map(function (exp) {
                var podeEntregar = ns.toFiniteNumber(exp.saldo) > 0;
                return window.el('div', { style: 'margin-bottom:10px;' },
                  window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;' },
                    window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' },
                      'Expedicao #' + exp.id + ' · ' + ns.fmtTextoOuEmpty(exp.status, '-')),
                    actionsRow(
                      linkBtn('Abrir Expedicao', function () { navigateToExpedicao(exp.id); }),
                      podeEntregar ? actionBtn('Entregar', openMovimentar('expedicao', exp.op || null)) : null)),
                  window.el('div', { style: 'font-size:12.5px;color:#5b6472;margin-top:4px;line-height:1.4;' },
                    'Liberado: ' + ns.fmtMetros(exp.liberado) + ' | Entregue: ' + ns.fmtMetros(exp.entregue) + ' | Saldo: ' + ns.fmtMetros(exp.saldo)),
                  podeEntregar
                    ? reasonRow('Ha saldo liberado nesta expedicao. Proxima acao: Entregar.')
                    : null,
                  !podeEntregar
                    ? reasonRow('Sem saldo liberado pendente de entrega/coleta.')
                    : null,
                  exp.movimentos && exp.movimentos.length
                    ? window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:2px;' }, exp.movimentos.length + ' entrega/coleta registrada(s)')
                    : null
                );
              })
            : emptyRow('Nenhuma expedicao criada.'),
          expSummaries.length === 0
            ? infoRow('Nenhuma quantidade movimentada para Expedicao. Proxima acao: movimentar pela etapa Acabamento.', 'warn')
            : null,
          expSummaries.length === 0 && (view && view.prontoExpedicao > 0)
            ? window.el('div', {
                style: 'display:flex;align-items:flex-start;gap:8px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:10px 12px;margin-top:10px;',
              },
                ns.svgEl(ns.SVG_INFO),
                window.el('div', { style: 'font-size:12.5px;color:#2c4a78;line-height:1.4;' },
                  'Pronto para expedicao: ' + ns.fmtMetros(view.prontoExpedicao) + '. Libere a expedicao a partir da OP de acabamento.'))
            : null
        );
      }

      if (key === 'entrega') {
        var entregueTotal = view && view.entregue || 0;
        var total = view && view.totalPedido || 0;
        var pendentes = ns.round2(Math.max(total - entregueTotal, 0));
        var jaEntregue = state.pedido && state.pedido.status === 'entregue';
        var aptoConcluir = !jaEntregue && view && view.pedidoConclusao && view.pedidoConclusao.pronto;
        var pendConclusao = (view && view.pedidoConclusao && view.pedidoConclusao.pendencias) || [];
        return window.el('div', {},
          window.el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;' },
            movementMetricCard('Total do pedido', ns.fmtMetros(total)),
            movementMetricCard('Entregue ao cliente', ns.fmtMetros(entregueTotal), '#18794a')
          ),
          pendentes > 0
            ? window.el('div', {
                style: 'display:flex;align-items:flex-start;gap:8px;background:#fff9ee;border:1px solid #fbe8c6;border-radius:4px;padding:10px 12px;',
              },
                ns.svgEl(ns.SVG_INFO),
                window.el('div', { style: 'font-size:12.5px;color:#8a5a15;line-height:1.4;' },
                  'Pendencias restantes: ' + ns.fmtMetros(pendentes) + '. Registre todas as entregas de expedicao antes de concluir o pedido.'))
            : null,
          jaEntregue
            ? window.el('div', {
                style: 'display:flex;align-items:center;gap:8px;background:#e7f4ec;border:1px solid #c2e7d1;border-radius:4px;padding:10px 12px;',
              },
                ns.svgEl(ns.SVG_INFO),
                window.el('div', { style: 'font-size:12.5px;color:#2f8256;line-height:1.4;font-weight:700;' }, 'Pedido concluido.'))
            : (aptoConcluir
              ? window.el('div', {
                  style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:#e7f4ec;border:1px solid #c2e7d1;border-radius:4px;padding:10px 12px;flex-wrap:wrap;',
                },
                  window.el('div', { style: 'font-size:12.5px;color:#2f8256;line-height:1.4;min-width:180px;' },
                    'Cadeia concluida. Pode concluir o pedido.'),
                  window.el('button', {
                    type: 'button',
                    style: 'display:inline-flex;align-items:center;justify-content:center;background:#18794a;color:#fff;border:none;border-radius:4px;padding:8px 14px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;',
                    onclick: function (ev) { concluirPedido(ev && ev.currentTarget ? ev.currentTarget : null); },
                  }, 'Concluir'))
              : window.el('div', { style: 'font-size:12.5px;color:#8a93a3;line-height:1.5;' },
                  pendConclusao.length
                    ? window.el('div', {},
                        window.el('div', { style: 'font-weight:700;color:#8a5a15;margin-bottom:4px;' }, 'Pendencias para concluir:'),
                        pendConclusao.map(function (p) { return window.el('div', { style: 'color:#b45309;' }, '- ' + p); }))
                    : 'Cadeia produtiva ainda em andamento.')),
          stage.state === 'done'
            ? window.el('div', { style: 'margin-top:8px;font-size:12.5px;font-weight:700;color:#18794a;' }, 'Etapa concluida.')
            : null
        );
      }

      return window.el('div', {},
        emptyRow('Etapa em andamento. Dados operacionais serao exibidos conforme a cadeia produtiva avancar.'));
    }

    function openStageDetailModal(stage, view) {
      var bodyContent = buildStageDetailBody(stage, view);
      var titleText = 'Etapa: ' + (stage.label || stage.key || '');

      var overlay = window.el('div', {
        style: 'position:fixed;inset:0;background:rgba(20,30,45,.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;',
      });

      var card = window.el('div', {
        style: 'position:relative;background:#fff;border:1px solid #eceef1;border-radius:' + MOVEMENT_MODAL_RADIUS + ';width:520px;max-height:calc(100vh - 48px);overflow-y:auto;box-shadow:' + MOVEMENT_MODAL_SHADOW + ';',
      });

      var titleBar = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid #eceef1;',
      },
        window.el('div', { style: 'display:flex;align-items:center;gap:10px;' },
          window.el('div', {
            style: 'width:10px;height:10px;border-radius:50%;background:' + (stage.color || '#2563eb') + ';flex-shrink:0;',
          }),
          window.el('div', { style: 'font-size:16px;font-weight:800;color:#16203a;' }, titleText)),
        window.el('button', {
          type: 'button',
          style: 'background:none;border:none;cursor:pointer;padding:4px;color:#9aa2af;line-height:0;',
          onclick: function () { overlay.remove(); },
        }, ns.svgEl('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'))
      );

      var content = window.el('div', { style: 'padding:20px 22px 18px;' }, bodyContent);
      var footer = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid #eceef1;',
      },
        window.el('button', {
          type: 'button',
          style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 18px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
          onclick: function () { overlay.remove(); },
        }, 'Fechar')
      );

      card.appendChild(titleBar);
      card.appendChild(content);
      card.appendChild(footer);
      overlay.appendChild(card);
      overlay.addEventListener('click', function (evt) {
        if (evt.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);
    }

    function openEditWarning(mode) {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');

      if (!editavel) {
        window.toast('Edicao permitida apenas em pedidos em rascunho ou recebido.', 'error');
        return;
      }

      var hasOps = state.ops && state.ops.length > 0;
      if (!hasOps) {
        window.navigate(mode === 'itens'
          ? '#/pedidos/' + pedidoId + '/itens'
          : '#/pedidos/' + pedidoId + '/editar');
        return;
      }

      var body = window.el('div', {},
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'width:36px;height:36px;border-radius:50%;background:#fff4e6;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
          }, ns.svgEl(ns.SVG_WARN)),
          window.el('div', {},
            window.el('div', {
              style: 'font-size:15.5px;font-weight:700;color:#16203a;',
            }, 'Este pedido ja tem OPs vinculadas'),
            window.el('div', {
              style: 'font-size:13px;color:#5b6472;margin-top:6px;line-height:1.5;',
            }, 'Editar dados gerais ou itens nao altera a producao ja lancada nas OPs - a OP continua sendo a origem oficial da movimentacao. Para mudar quantidades em producao, use "Movimentar".')
          )
        ),
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:10px 12px;',
        },
          window.el('div', {
            style: 'font-size:12.5px;color:#5b6472;line-height:1.5;',
          }, 'Se voce precisar ajustar a composicao do pedido comercial, a rota de itens continua disponivel.'),
          buildEditItensButton()
        )
      );

      window.modal({
        title: 'Editar pedido',
        body: body,
        saveLabel: mode === 'itens' ? 'Editar itens' : 'Editar mesmo assim',
        onSave: async function () {
          window.navigate(mode === 'itens'
            ? '#/pedidos/' + pedidoId + '/itens'
            : '#/pedidos/' + pedidoId + '/editar');
          return true;
        },
      });
    }

    function openStatusActions() {
      if (!state.pedido) return;

      var actions = ns.nextActionsForStatus(state.pedido.status);
      var body = window.el('div', {});

      if (actions.length === 0) {
        body.appendChild(window.el('div', {
          style: 'font-size:13px;color:#5b6472;line-height:1.5;',
        }, state.pedido.status === 'cancelado'
          ? 'Pedido cancelado. Nenhuma transicao disponivel nesta fase.'
          : 'Nenhuma acao de status disponivel para este pedido.'));
        window.modal({
          title: 'Acoes do pedido',
          body: body,
          saveLabel: 'Fechar',
          onSave: async function () { return true; },
        });
        return;
      }

      body.appendChild(window.el('div', {
        style: 'font-size:13px;color:#5b6472;margin-bottom:12px;line-height:1.5;',
      }, 'Use estas transicoes para manter o status comercial do pedido alinhado ao fluxo administrativo.'));

      var buttonsWrap = window.el('div', {
        style: 'display:flex;flex-direction:column;gap:8px;',
      });
      body.appendChild(buttonsWrap);

      var modalRef = window.modal({
        title: 'Acoes do pedido',
        body: body,
        saveLabel: 'Fechar',
        onSave: async function () { return true; },
      });

      actions.forEach(function (action) {
        var isCancel = action.status === 'cancelado';
        var btn = window.el('button', {
          type: 'button',
          style: 'display:flex;align-items:center;justify-content:center;background:' + (isCancel ? '#fff' : '#2563eb') + ';color:' + (isCancel ? '#b42318' : '#fff') + ';border:' + (isCancel ? '1px solid #f5c2c7' : 'none') + ';border-radius:4px;padding:10px 12px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;',
          onclick: async function () {
            await alterarStatus(action.status, btn);
            modalRef.close();
          },
        }, action.label);
        buttonsWrap.appendChild(btn);
      });
    }

    function buildTrackingPreviewNode(statusInput, exceptionInput, messageInput) {
      var api = ns.getTrackingApi();
      var payload = {
        status_cliente_visual: statusInput.value || 'recebido',
        status_cliente_excecao: exceptionInput.value || null,
        status_cliente_mensagem: messageInput.value ? messageInput.value.trim() : null,
      };

      if (!api) {
        return window.el('div', {
          style: 'font-size:13px;color:#9aa2af;',
        }, 'Taxonomia de acompanhamento indisponivel.');
      }

      var progress = api.getClienteTrackingProgress(payload);
      var label = api.getClienteTrackingStatusLabel(payload);
      var message = api.getClienteTrackingMensagem(payload);
      var percent = Math.round((((progress.currentIndex >= 0 ? progress.currentIndex : 0) + 1) / progress.totalSteps) * 100);
      var badgeBg = '#eaf1fd';
      var badgeColor = '#2563eb';
      var badgeDot = '#2563eb';

      if (progress.exception) {
        if (progress.exception.tom === 'danger') {
          badgeBg = '#fdecec';
          badgeColor = '#a23434';
          badgeDot = '#b23b3b';
        } else if (progress.exception.tom === 'warning') {
          badgeBg = '#fff4e6';
          badgeColor = '#c2610c';
          badgeDot = '#e07b39';
        } else {
          badgeBg = '#f1f3f6';
          badgeColor = '#5b6472';
          badgeDot = '#6b7280';
        }
      }

      return window.el('div', {
        style: 'background:#f6f7f9;border:1px solid #eceef1;border-radius:4px;padding:14px 16px;',
      },
        window.el('div', {
          style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.05em;margin-bottom:10px;',
        }, 'PREVIEW'),
        window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:7px;background:' + badgeBg + ';color:' + badgeColor + ';border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;margin-bottom:12px;',
        },
          window.el('span', {
            style: 'width:7px;height:7px;border-radius:50%;background:' + badgeDot + ';display:inline-block;',
          }),
          label
        ),
        window.el('div', {
          style: 'font-size:13.5px;color:#2c4a78;font-weight:500;line-height:1.5;margin-bottom:12px;',
        }, '"' + message + '"'),
        window.el('div', {
          style: 'height:6px;border-radius:99px;background:#e2e5ea;overflow:hidden;margin-bottom:6px;',
        },
          window.el('div', {
            style: 'width:' + percent + '%;height:100%;background:#2563eb;',
          })
        ),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:11.5px;color:#9aa2af;',
        },
          window.el('span', {}, 'Etapa ' + ((progress.currentIndex >= 0 ? progress.currentIndex : 0) + 1) + ' de ' + progress.totalSteps),
          window.el('span', {}, percent + '%')
        )
      );
    }

    function openTrackingModal() {
      var api = ns.getTrackingApi();
      if (!api) {
        window.toast('Taxonomia visual do cliente indisponivel.', 'error');
        return;
      }

      var statusOptions = api.CLIENTE_TRACKING_STEPS.map(function (step) {
        return { value: step.key, label: step.label };
      });
      var exceptionOptions = api.CLIENTE_TRACKING_EXCECOES.map(function (item) {
        return { value: item.key, label: item.label };
      });

      var statusInput = window.selectInput({
        options: statusOptions,
        value: state.pedido.status_cliente_visual || (state.pedido.status === 'confirmado' ? 'confirmado' : 'recebido'),
        placeholder: 'Selecione uma etapa',
      });
      var exceptionInput = window.selectInput({
        options: exceptionOptions,
        value: state.pedido.status_cliente_excecao || '',
        placeholder: 'Sem excecao',
      });
      var messageInput = window.el('textarea', {
        style: 'width:100%;min-height:92px;border:1px solid #d8dce2;border-radius:4px;padding:9px 12px;font-size:13.5px;font-family:inherit;color:#16203a;resize:none;outline:none;',
        placeholder: 'Mensagem opcional ao cliente',
      });
      messageInput.value = state.pedido.status_cliente_mensagem || '';

      var previewWrap = window.el('div', { style: 'margin-top:4px;' });
      function renderPreview() {
        previewWrap.replaceChildren(buildTrackingPreviewNode(statusInput, exceptionInput, messageInput));
      }
      statusInput.addEventListener('change', renderPreview);
      exceptionInput.addEventListener('change', renderPreview);
      messageInput.addEventListener('input', renderPreview);
      renderPreview();

      var body = window.el('div', {},
        window.formField({
          label: 'Etapa principal',
          input: statusInput,
          hint: 'Mantem a trilha visual compartilhada com o portal do cliente.',
        }),
        window.formField({
          label: 'Excecao',
          input: exceptionInput,
          hint: 'Opcional. Quando definida, a comunicacao visual prioriza a excecao.',
        }),
        window.formField({
          label: 'Mensagem',
          input: messageInput,
          hint: 'Se ficar vazia, o sistema usa a frase padrao da etapa/excecao.',
        }),
        previewWrap
      );

      window.modal({
        title: 'Editar evolucao do cliente',
        body: body,
        saveLabel: 'Salvar mensagem',
        onSave: async function () {
          var updatePayload = {
            status_cliente_visual: statusInput.value || 'recebido',
            status_cliente_excecao: exceptionInput.value || null,
            status_cliente_mensagem: messageInput.value ? messageInput.value.trim() : null,
          };

          var updateRes = await window.supa
            .from('pedidos')
            .update(updatePayload)
            .eq('id', state.pedido.id);

          if (updateRes.error) {
            window.toast('Erro ao salvar situacao visivel: ' + (updateRes.error.message || 'desconhecido'), 'error');
            console.error('pedido-detail: erro ao atualizar situacao visivel', updateRes.error);
            return false;
          }

          var currentUserId = window.CURRENT_USER && window.CURRENT_USER.id
            ? window.CURRENT_USER.id
            : null;

          var insertRes = await window.supa
            .from('pedido_cliente_eventos')
            .insert({
              pedido_id: state.pedido.id,
              status: updatePayload.status_cliente_excecao || updatePayload.status_cliente_visual,
              titulo: api.getClienteTrackingStatusLabel(updatePayload),
              mensagem: api.getClienteTrackingMensagem(updatePayload),
              origem: 'manual',
              visivel_cliente: true,
              criado_por: currentUserId,
              metadata: null,
            });

          if (insertRes.error) {
            console.error('pedido-detail: erro ao inserir pedido_cliente_eventos', insertRes.error);
            window.toast('Situacao visivel salva, mas o historico visual nao foi registrado.', 'error');
          } else {
            window.toast('Situacao visivel salva com sucesso.', 'success');
          }

          await reload();
          render();
          return true;
        },
      });
    }

    return {
      get currentView() { return currentView; },
      set currentView(v) { currentView = v; },
      buildTrackingAdmin: buildTrackingAdmin,
      buildParciaisAdmin: buildParciaisAdmin,
      buildEditButton: buildEditButton,
      buildEditItensButton: buildEditItensButton,
      navigateToPedidos: navigateToPedidos,
      navigateToOp: navigateToOp,
      navigateToExpedicao: navigateToExpedicao,
      navigateToNovaOp: navigateToNovaOp,
      concluirPedido: concluirPedido,
      finalizarOp: finalizarOp,
      scrollToSection: scrollToSection,
      openMovementModal: openMovementModal,
      openStageDetailModal: openStageDetailModal,
      openTecAcceptanceModal: openTecAcceptanceModal,
      openEditWarning: openEditWarning,
      openStatusActions: openStatusActions,
      openTrackingModal: openTrackingModal,
    };
  }

  ns.createPedidoDetailEvents = createPedidoDetailEvents;
})(window);
