// =====================================================================
// === SCREENS: PEDIDO DETAIL PROGRESS ================================
// Calculos e normalizacao de progresso do detalhe do pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  function opLabel(op) {
    return 'OP ' + op.numero + '/' + op.ano;
  }

  function stageKeyForOp(op) {
    return op && op.tipo === 'latex' ? 'acabamento' : 'tecelagem';
  }

  function stageLabelForOp(op) {
    return stageKeyForOp(op) === 'acabamento' ? 'Acabamento' : 'Tecelagem';
  }

  function deliveryStageForOp(op) {
    return op && op.tipo === 'latex' ? 'latex' : 'cima';
  }

  function targetMetersForOpItem(opItem) {
    var value = opItem && opItem.metros_ajustados != null
      ? opItem.metros_ajustados
      : opItem && opItem.metros_pedidos;
    return ns.round2(value);
  }

  function sumPedidoMetros(state) {
    if (state.pedido && ns.toFiniteNumber(state.pedido.metros_total) > 0) {
      return ns.round2(state.pedido.metros_total);
    }
    return ns.round2(state.itens.reduce(function (acc, item) {
      return acc + ns.toFiniteNumber(item.metros);
    }, 0));
  }

  function buildUniquePedidoItemByModelo(state) {
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

  function sortOpsForDisplay(rows) {
    return rows.slice().sort(function (a, b) {
      var aStage = stageKeyForOp(a) === 'tecelagem' ? 0 : 1;
      var bStage = stageKeyForOp(b) === 'tecelagem' ? 0 : 1;
      if (aStage !== bStage) return aStage - bStage;
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.numero - b.numero;
    });
  }

  function collectPartialMeta(state) {
    var meta = {
      anyDeliveredBreakdown: false,
      anyReadyBreakdown: false,
      deliveredByItem: {},
      readyByItem: {},
    };
    if (!state.parcialItens.length || !state.parciais.length) return meta;

    var parcialById = {};
    state.parciais.forEach(function (parcial) {
      parcialById[parcial.id] = parcial;
    });

    state.parcialItens.forEach(function (row) {
      var parcial = parcialById[row.parcial_id];
      if (!parcial || parcial.situacao === 'cancelado') return;
      var itemId = row.pedido_item_id;
      var metros = ns.toFiniteNumber(row.metros);

      if (parcial.situacao === 'entregue') {
        meta.anyDeliveredBreakdown = true;
        meta.deliveredByItem[itemId] = ns.round2((meta.deliveredByItem[itemId] || 0) + metros);
      }
      if (ns.READY_SITUATIONS.indexOf(parcial.situacao) !== -1) {
        meta.anyReadyBreakdown = true;
        meta.readyByItem[itemId] = ns.round2((meta.readyByItem[itemId] || 0) + metros);
      }
    });

    return meta;
  }

  function allocateByWeight(total, rows, keyName) {
    var result = {};
    var safeRows = rows.filter(function (row) { return ns.toFiniteNumber(row.weight) > 0; });
    if (!(ns.toFiniteNumber(total) > 0) || safeRows.length === 0) return result;

    var totalWeight = safeRows.reduce(function (acc, row) {
      return acc + ns.toFiniteNumber(row.weight);
    }, 0);
    if (!(totalWeight > 0)) return result;

    var allocated = 0;
    safeRows.forEach(function (row, index) {
      var raw = index === safeRows.length - 1
        ? total - allocated
        : ns.round2((ns.toFiniteNumber(total) * ns.toFiniteNumber(row.weight)) / totalWeight);
      var value = ns.round2(raw);
      allocated = ns.round2(allocated + value);
      result[row[keyName]] = value;
    });
    return result;
  }

  function stageState(percent, hasBase, remaining, done, terminalAtFull) {
    if (terminalAtFull && done >= hasBase && hasBase > 0) return 'done';
    if (hasBase > 0 && remaining <= 0) return 'done';
    if (hasBase > 0 || done > 0 || percent > 0) return 'current';
    return 'future';
  }

  function isTerminalOpStatus(status) {
    return status === 'concluida' || status === 'finalizada' || status === 'cancelada';
  }

  function hasFormalPendingOp(summaries) {
    return summaries.some(function (row) { return !isTerminalOpStatus(row.status); });
  }

  function applyFormalPendingStage(stepper, key, hasBase, remaining, hasPending, label) {
    if (!hasPending || !(hasBase > 0) || remaining > 0) return;
    stepper.forEach(function (stage) {
      if (stage.key !== key) return;
      stage.state = 'current';
      stage.sublabel = label;
    });
  }

  function computeViewModel(state) {
    var pedido = state.pedido || {};
    var trackingApi = ns.getTrackingApi();
    var trackingSummary = trackingApi && typeof trackingApi.buildPedidoAcompanhamentoParcial === 'function'
      ? trackingApi.buildPedidoAcompanhamentoParcial(pedido, state.itens, state.parciais, { forCliente: false })
      : null;

    var totalPedido = sumPedidoMetros(state);
    var uniquePedidoItemByModelo = buildUniquePedidoItemByModelo(state);
    var opById = {};
    var opItemsFlat = [];
    var opSummaries = [];

    sortOpsForDisplay(state.ops).forEach(function (op) {
      opById[op.id] = op;
    });

    // Movido para a Expedicao por OP Latex (paridade com Tecelagem): a saida
    // de uma OP de Acabamento e o que ja foi movimentado para a Expedicao,
    // nao um movimento intermediario etapa='latex'.
    var expedicoesByIdEarly = {};
    (state.expedicoes || []).forEach(function (expedicao) {
      if (expedicao) expedicoesByIdEarly[expedicao.id] = expedicao;
    });
    var liberadoByLatexOp = {};
    var liberadoByLatexOpItem = {};
    var entregueByLatexOpItem = {};
    (state.expedicaoItens || []).forEach(function (row) {
      var expedicao = expedicoesByIdEarly[row.expedicao_id];
      if (expedicao && expedicao.op_latex_id != null) {
        liberadoByLatexOp[expedicao.op_latex_id] = ns.round2((liberadoByLatexOp[expedicao.op_latex_id] || 0) + ns.toFiniteNumber(row.metros_liberados));
      }
      if (row.op_item_id != null) {
        liberadoByLatexOpItem[row.op_item_id] = ns.round2((liberadoByLatexOpItem[row.op_item_id] || 0) + ns.toFiniteNumber(row.metros_liberados));
        entregueByLatexOpItem[row.op_item_id] = ns.round2((entregueByLatexOpItem[row.op_item_id] || 0) + ns.toFiniteNumber(row.metros_entregues));
      }
    });

    state.ops.forEach(function (op) {
      var totalTarget = 0;
      var doneTarget = 0;
      var itemNamesMap = {};
      var deliveryStage = deliveryStageForOp(op);
      var relatedEntregas = [];
      var entregaIdsSeen = {};

      (op.op_itens || []).forEach(function (opItem) {
        opItemsFlat.push({ op: op, opItem: opItem });
        totalTarget += targetMetersForOpItem(opItem);
        var modelo = state.modelosById[opItem.modelo_id];
        if (modelo && modelo.nome) itemNamesMap[modelo.nome] = true;
      });

      state.entregaItens.forEach(function (ei) {
        if (ei.op_id !== op.id || ei.defeito) return;
        var entrega = state.entregasById[ei.entrega_id];
        if (!entrega || entrega.etapa !== deliveryStage) return;
        doneTarget += ns.toFiniteNumber(ei.metros_entregues);
        if (!entregaIdsSeen[entrega.id]) {
          entregaIdsSeen[entrega.id] = true;
          relatedEntregas.push(entrega);
        }
      });

      totalTarget = ns.round2(totalTarget);
      doneTarget = ns.round2(doneTarget);
      // Acabamento: "movido" da OP = ja movimentado para a Expedicao;
      // "remaining" = em acabamento = recebido - movimentado.
      if (stageKeyForOp(op) === 'acabamento') {
        doneTarget = ns.round2(liberadoByLatexOp[op.id] || 0);
      }
      var remaining = ns.round2(Math.max(totalTarget - doneTarget, 0));
      var modelNames = Object.keys(itemNamesMap);
      var progress = totalTarget > 0
        ? ns.clampPercent((doneTarget / totalTarget) * 100)
        : 0;

      var statusTone = {
        simulada: { bg: '#f1f3f6', text: '#5b6472', dot: '#9aa2af', label: 'Simulada' },
        aberta: { bg: '#eaf1fd', text: '#2563eb', dot: '#2563eb', label: 'Aberta' },
        em_producao: { bg: '#fff4e6', text: '#c2610c', dot: '#e07b39', label: 'Em producao' },
        concluida: { bg: '#e6f4ec', text: '#18794a', dot: '#18794a', label: 'Concluida' },
        finalizada: { bg: '#e6f4ec', text: '#18794a', dot: '#18794a', label: 'Finalizada' },
      }[op.status] || { bg: '#f1f3f6', text: '#5b6472', dot: '#9aa2af', label: ns.fmtTextoOuEmpty(op.status, 'Status') };

      var docBanner;
      if (stageKeyForOp(op) === 'tecelagem') {
        docBanner = doneTarget > 0
          ? { tone: 'warning', text: 'Romaneio tecelagem -> acabamento pendente' }
          : { tone: 'neutral', text: 'Sem movimentacao para acabamento registrada ainda' };
      } else {
        docBanner = doneTarget > 0
          ? { tone: 'danger', text: 'NF de expedicao pendente' }
          : { tone: 'neutral', text: 'Sem saida para expedicao registrada ainda' };
      }

      opSummaries.push({
        id: op.id,
        numero: op.numero,
        ano: op.ano,
        label: opLabel(op),
        tipo: op.tipo,
        stageKey: stageKeyForOp(op),
        stageLabel: stageLabelForOp(op),
        status: op.status,
        statusTone: statusTone,
        target: totalTarget,
        done: doneTarget,
        remaining: remaining,
        progress: progress,
        modelNames: modelNames,
        relatedEntregas: relatedEntregas,
        origemOp: op.origem_op_id ? opById[op.origem_op_id] || null : null,
        op: op,
        docBanner: docBanner,
      });
    });

    var linkedOpCount = opSummaries.length;
    var tecelagemSummaries = opSummaries.filter(function (row) { return row.stageKey === 'tecelagem'; });
    var acabamentoSummaries = opSummaries.filter(function (row) { return row.stageKey === 'acabamento'; });

    var emTecelagem = ns.round2(tecelagemSummaries.reduce(function (acc, row) { return acc + row.remaining; }, 0));
    var emAcabamento = ns.round2(acabamentoSummaries.reduce(function (acc, row) { return acc + row.remaining; }, 0));
    var finishedLatex = ns.round2(acabamentoSummaries.reduce(function (acc, row) { return acc + row.done; }, 0));

    var expedicaoItens = state.expedicaoItens || [];
    var expedicoes = state.expedicoes || [];
    var expedicaoLiberado = ns.round2(expedicaoItens.reduce(function (acc, row) {
      return acc + ns.toFiniteNumber(row.metros_liberados);
    }, 0));
    var expedicaoEntregue = ns.round2(expedicaoItens.reduce(function (acc, row) {
      return acc + ns.toFiniteNumber(row.metros_entregues);
    }, 0));
    var expedicaoSaldo = ns.round2(Math.max(expedicaoLiberado - expedicaoEntregue, 0));
    var hasExpedicaoData = expedicoes.length > 0 || expedicaoItens.length > 0;
    var expedicaoItensByExpedicaoId = {};
    var expedicaoDeliveredByItem = {};
    expedicaoItens.forEach(function (row) {
      if (!expedicaoItensByExpedicaoId[row.expedicao_id]) expedicaoItensByExpedicaoId[row.expedicao_id] = [];
      expedicaoItensByExpedicaoId[row.expedicao_id].push(row);
      if (row.pedido_item_id) {
        expedicaoDeliveredByItem[row.pedido_item_id] = ns.round2((expedicaoDeliveredByItem[row.pedido_item_id] || 0) + ns.toFiniteNumber(row.metros_entregues));
      }
    });

    var movimentosByExpedicaoId = {};
    (state.expedicaoMovimentos || []).forEach(function (movimento) {
      if (!movimentosByExpedicaoId[movimento.expedicao_id]) movimentosByExpedicaoId[movimento.expedicao_id] = [];
      movimentosByExpedicaoId[movimento.expedicao_id].push(movimento);
    });

    var expedicaoSummaries = expedicoes.map(function (expedicao) {
      var itensExp = expedicaoItensByExpedicaoId[expedicao.id] || [];
      var liberado = ns.round2(itensExp.reduce(function (acc, row) { return acc + ns.toFiniteNumber(row.metros_liberados); }, 0));
      var entregue = ns.round2(itensExp.reduce(function (acc, row) { return acc + ns.toFiniteNumber(row.metros_entregues); }, 0));
      return {
        id: expedicao.id,
        status: expedicao.status,
        pedidoId: expedicao.pedido_id,
        opLatexId: expedicao.op_latex_id,
        loteId: expedicao.lote_id,
        liberado: liberado,
        entregue: entregue,
        saldo: ns.round2(Math.max(liberado - entregue, 0)),
        movimentos: movimentosByExpedicaoId[expedicao.id] || [],
        op: opById[expedicao.op_latex_id] || null,
      };
    });

    var deliveredExactTotal = hasExpedicaoData
      ? expedicaoEntregue
      : (trackingSummary && trackingSummary.totais ? ns.toFiniteNumber(trackingSummary.totais.entregue) : 0);
    if (!(deliveredExactTotal > 0) && (pedido.status === 'entregue' || (trackingSummary && trackingSummary.statusVisual === 'concluido'))) {
      deliveredExactTotal = totalPedido;
    }
    deliveredExactTotal = ns.round2(deliveredExactTotal);

    // Pronto/expedicao = ja movimentado para a Expedicao - entregue ao cliente.
    var prontoExpedicao = expedicaoSaldo;

    var tecMeta = ns.round2(tecelagemSummaries.reduce(function (acc, row) { return acc + row.target; }, 0));
    var tecDone = ns.round2(tecelagemSummaries.reduce(function (acc, row) { return acc + row.done; }, 0));
    var tecFormalPending = hasFormalPendingOp(tecelagemSummaries);
    var tecTerminal = tecelagemSummaries.length > 0 && !tecFormalPending;
    var acabMeta = ns.round2(acabamentoSummaries.reduce(function (acc, row) { return acc + row.target; }, 0));
    var acabDone = ns.round2(acabamentoSummaries.reduce(function (acc, row) { return acc + row.done; }, 0));
    var acabFormalPending = hasFormalPendingOp(acabamentoSummaries);
    var acabTerminal = acabamentoSummaries.length > 0 && !acabFormalPending;

    var tecOpIds = tecelagemSummaries.map(function (row) { return row.id; });
    var insumoOrdens = state.ordensFio.filter(function (ordem) {
      return tecOpIds.indexOf(ordem.op_id) !== -1;
    });
    var insumoPedidoKg = ns.round2(insumoOrdens.reduce(function (acc, ordem) {
      return acc + ns.toFiniteNumber(ordem.kg_pedido);
    }, 0));
    var insumoRecebidoKg = ns.round2(insumoOrdens.reduce(function (acc, ordem) {
      return acc + ns.toFiniteNumber(ordem.kg_recebido);
    }, 0));
    var insumoPercent = insumoPedidoKg > 0
      ? ns.clampPercent((insumoRecebidoKg / insumoPedidoKg) * 100)
      : 0;
    var chainApi = window.RAVATEX_SCREENS
      && window.RAVATEX_SCREENS.pedidoChainState;
    var chainState = chainApi && typeof chainApi.derivePedidoChainState === 'function'
      ? chainApi.derivePedidoChainState({
          pedido: pedido,
          totalPedido: totalPedido,
          ops: state.ops,
          ordensFio: state.ordensFio,
          entregaItens: state.entregaItens,
          entregasById: state.entregasById,
          expedicoes: state.expedicoes,
          expedicaoItens: state.expedicaoItens,
        })
      : null;
    var releaseExpedicaoAction = chainState && chainState.actions ? chainState.actions.releaseExpedicao : null;

    var partialMeta = collectPartialMeta(state);
    var itemMetricsById = {};
    var fallbackDeliveredByItem = {};

    if (!partialMeta.anyDeliveredBreakdown && deliveredExactTotal > 0) {
      var fallbackRows = state.itens.map(function (item) {
        var recebidoByItem = 0;
        opItemsFlat.forEach(function (row) {
          if ((row.opItem.pedido_item_id || (uniquePedidoItemByModelo[row.opItem.modelo_id] && uniquePedidoItemByModelo[row.opItem.modelo_id].id)) !== item.id) return;
          if (stageKeyForOp(row.op) !== 'acabamento') return;
          recebidoByItem += targetMetersForOpItem(row.opItem);
        });
        return {
          itemId: item.id,
          weight: recebidoByItem > 0 ? recebidoByItem : ns.toFiniteNumber(item.metros),
        };
      });
      fallbackDeliveredByItem = allocateByWeight(deliveredExactTotal, fallbackRows, 'itemId');
    }

    state.itens.forEach(function (item) {
      var linkedOpLabels = {};
      var tecTotal = 0;
      var tecDoneItem = 0;
      var acabTotal = 0;
      var acabDoneItem = 0;
      var acabEntregueItem = 0;

      opItemsFlat.forEach(function (row) {
        var resolvedPedidoItemId = row.opItem.pedido_item_id
          || (uniquePedidoItemByModelo[row.opItem.modelo_id] && uniquePedidoItemByModelo[row.opItem.modelo_id].id)
          || null;
        if (resolvedPedidoItemId !== item.id) return;

        linkedOpLabels[row.op.id] = row.op;

        if (stageKeyForOp(row.op) === 'tecelagem') {
          tecTotal += targetMetersForOpItem(row.opItem);
        } else {
          acabTotal += targetMetersForOpItem(row.opItem);
          // Acabamento: movido = ja movimentado para a Expedicao por op_item;
          // entregue = ja entregue ao cliente por op_item.
          acabDoneItem += ns.toFiniteNumber(liberadoByLatexOpItem[row.opItem.id]);
          acabEntregueItem += ns.toFiniteNumber(entregueByLatexOpItem[row.opItem.id]);
        }

        state.entregaItens.forEach(function (ei) {
          if (ei.op_item_id !== row.opItem.id || ei.defeito) return;
          var entrega = state.entregasById[ei.entrega_id];
          if (!entrega) return;
          if (stageKeyForOp(row.op) === 'tecelagem' && entrega.etapa === 'cima') {
            tecDoneItem += ns.toFiniteNumber(ei.metros_entregues);
          }
        });
      });

      tecTotal = ns.round2(tecTotal);
      tecDoneItem = ns.round2(tecDoneItem);
      acabTotal = ns.round2(acabTotal);
      acabDoneItem = ns.round2(acabDoneItem);
      acabEntregueItem = ns.round2(acabEntregueItem);

      var deliveredItem = partialMeta.anyDeliveredBreakdown
        ? ns.toFiniteNumber(partialMeta.deliveredByItem[item.id])
        : (hasExpedicaoData
          ? acabEntregueItem
          : ns.toFiniteNumber(fallbackDeliveredByItem[item.id]));
      deliveredItem = ns.round2(deliveredItem);

      var readyItem = partialMeta.anyReadyBreakdown
        ? ns.round2(ns.toFiniteNumber(partialMeta.readyByItem[item.id]))
        : ns.round2(Math.max(acabDoneItem - deliveredItem, 0));

      var relatedOps = sortOpsForDisplay(Object.keys(linkedOpLabels).map(function (opId) {
        return linkedOpLabels[opId];
      }));

      itemMetricsById[item.id] = {
        tecelagem: ns.round2(Math.max(tecTotal - tecDoneItem, 0)),
        acabamento: ns.round2(Math.max(acabTotal - acabDoneItem, 0)),
        prontos: readyItem,
        entregues: deliveredItem,
        relatedOps: relatedOps,
        relatedOpsLabel: relatedOps.length
          ? relatedOps.map(function (op) { return opLabel(op); }).join(' -> ')
          : '-',
      };
    });

    var documentRowsPedido = [
      {
        label: (pedido.referencia_cliente ? 'Pedido comercial · ' + pedido.referencia_cliente : 'Pedido comercial do cliente'),
        status: 'pendente',
        meta: 'Vinculo documental comercial ainda nao consolidado nesta fase.',
      },
      {
        label: 'Aprovacao comercial',
        status: 'pendente',
        meta: 'A centralizacao de anexos do pedido entra na fase documental.',
      },
    ];

    var documentRowsOperacionais = [];
    if (insumoOrdens.length > 0) {
      documentRowsOperacionais.push({
        label: 'Documentos de insumos',
        status: 'pendente',
        meta: 'Ordens de fio vinculadas as OPs de tecelagem.',
      });
    }
    opSummaries.forEach(function (summary) {
      if (summary.stageKey === 'tecelagem') {
        documentRowsOperacionais.push({
          label: 'Movimento: Tecelagem -> Acabamento · ' + summary.label,
          status: 'pendente',
          meta: summary.done > 0 ? 'Romaneio/NF ainda nao consolidados na tela de pedido.' : 'Sem transferencia registrada ainda.',
        });
      } else {
        documentRowsOperacionais.push({
          label: 'Movimento: Acabamento -> Expedicao · ' + summary.label,
          status: 'pendente',
          meta: summary.done > 0 ? 'Documentacao de saida ainda nao consolidada.' : 'Sem saida para expedicao registrada ainda.',
        });
      }
    });
    expedicaoSummaries.forEach(function (summary) {
      documentRowsOperacionais.push({
        label: 'Expedicao #' + summary.id + (summary.op ? ' - ' + opLabel(summary.op) : ''),
        status: summary.status === 'concluida' ? 'anexado' : 'pendente',
        meta: summary.movimentos.length
          ? String(summary.movimentos.length) + ' entrega/coleta registrada(s).'
          : 'Sem entrega/coleta registrada ainda.',
      });
    });
    if (deliveredExactTotal > 0 || pedido.status === 'entregue') {
      documentRowsOperacionais.push({
        label: 'Comprovante de entrega',
        status: 'pendente',
        meta: 'Entrega ao cliente ainda sem documento consolidado nesta fase.',
      });
    }

    var pendingDocs = documentRowsPedido.concat(documentRowsOperacionais).filter(function (row) {
      return row.status !== 'anexado';
    }).length;

    var pendenciasConclusao = [];
    if (totalPedido <= 0) {
      pendenciasConclusao.push('Pedido sem metragem consolidada.');
    }
    if (linkedOpCount === 0) {
      pendenciasConclusao.push('Pedido sem OP vinculada.');
    }
    if (tecelagemSummaries.length > 0 && acabamentoSummaries.length === 0) {
      pendenciasConclusao.push('Pedido sem OP de acabamento vinculada.');
    }
    opSummaries.forEach(function (summary) {
      if (!isTerminalOpStatus(summary.status)) {
        pendenciasConclusao.push(summary.label + ' ainda esta aberta ou em producao.');
      }
    });
    // Explica a pendencia em termos do fluxo Acabamento -> Expedicao: se ha
    // material recebido no acabamento ainda nao movimentado para a expedicao,
    // o clique de conclusao nao pode parecer morto sem esse motivo.
    if (emAcabamento > 0) {
      pendenciasConclusao.push('Ha saldo em acabamento (' + ns.fmtMetros(emAcabamento) + ') nao movimentado para expedicao.');
    }
    acabamentoSummaries.forEach(function (summary) {
      var temExpedicao = expedicoes.some(function (expedicao) {
        return expedicao.op_latex_id === summary.id;
      });
      if ((summary.status === 'concluida' || summary.status === 'finalizada') && !temExpedicao) {
        pendenciasConclusao.push(summary.label + ' finalizada sem expedicao liberada.');
      }
    });
    if (state.expedicoesLoadError) {
      pendenciasConclusao.push('Nao foi possivel validar expedicoes vinculadas.');
    }
    expedicaoSummaries.forEach(function (summary) {
      if (summary.status !== 'concluida' || summary.saldo > 0) {
        pendenciasConclusao.push('Expedicao #' + summary.id + ' ainda possui saldo pendente.');
      }
    });

    var pedidoConclusao = {
      pronto: pendenciasConclusao.length === 0,
      pendencias: pendenciasConclusao,
      label: pendenciasConclusao.length === 0
        ? 'Toda a cadeia vinculada esta concluida.'
        : 'Pedido ainda possui pendencias operacionais.',
    };

    var stepper = [
      {
        key: 'insumos',
        label: 'INSUMOS',
        color: '#2563eb',
        percent: insumoPercent,
        state: stageState(insumoPercent, insumoPedidoKg, Math.max(insumoPedidoKg - insumoRecebidoKg, 0), insumoRecebidoKg, false),
        sublabel: insumoPercent >= 100 ? 'concluido' : (insumoPedidoKg > 0 ? ns.fmtKg(insumoRecebidoKg) : 'aguardando'),
        transfer: {
          title: linkedOpCount ? 'Registrar recebimento de insumos' : 'Gerar primeira OP de Tecelagem',
          origem: 'Insumos',
          destino: 'Tecelagem',
          detalhe: linkedOpCount ? 'O recebimento de fio continua canonico na OP de tecelagem vinculada.' : 'Este pedido ainda nao possui OP de Tecelagem vinculada. Gere a primeira OP para iniciar o fluxo produtivo.',
          op: tecelagemSummaries.length ? tecelagemSummaries[0].op : null,
          docs: 'NF de compra e romaneio',
          action: chainState && chainState.actions ? chainState.actions.transferInsumosToTecelagem : null,
        },
      },
      {
        key: 'tecelagem',
        label: 'TECELAGEM',
        color: '#2563eb',
        percent: tecMeta > 0 ? ns.clampPercent((tecDone / tecMeta) * 100) : 0,
        state: stageState(tecMeta > 0 ? ns.clampPercent((tecDone / tecMeta) * 100) : 0, tecMeta, emTecelagem, tecDone, false),
        sublabel: emTecelagem > 0 ? ns.fmtMetros(emTecelagem) : (tecMeta > 0 ? (tecTerminal ? 'concluido' : 'entregue; finalizar OP') : 'aguardando'),
        transfer: {
          title: 'Movimentar Tecelagem -> Acabamento',
          origem: 'Tecelagem',
          destino: 'Acabamento',
          detalhe: tecelagemSummaries.length ? 'A mesma movimentacao da OP de origem deve ser usada aqui.' : 'Nenhuma OP de tecelagem vinculada.',
          op: tecelagemSummaries.length ? tecelagemSummaries[0].op : null,
          docs: 'Romaneio e NF',
          action: chainState && chainState.actions ? chainState.actions.transferTecelagemToAcabamento : null,
        },
      },
      {
        key: 'acabamento',
        label: 'ACABAMENTO',
        color: '#e07b39',
        percent: acabMeta > 0 ? ns.clampPercent((acabDone / acabMeta) * 100) : 0,
        state: stageState(acabMeta > 0 ? ns.clampPercent((acabDone / acabMeta) * 100) : 0, acabMeta, emAcabamento, acabDone, false),
        sublabel: emAcabamento > 0 ? ns.fmtMetros(emAcabamento) : (acabMeta > 0 ? (acabTerminal ? 'concluido' : 'OP pendente') : 'aguardando'),
        transfer: {
          title: 'Movimentar Acabamento -> Expedicao',
          origem: 'Acabamento',
          destino: 'Expedicao',
          detalhe: acabamentoSummaries.length ? 'Movimente para expedicao a quantidade recebida da tecelagem ainda disponivel; a finalizacao da OP continua separada.' : 'Nenhuma OP de acabamento vinculada.',
          op: releaseExpedicaoAction && releaseExpedicaoAction.op
            ? releaseExpedicaoAction.op
            : (acabamentoSummaries.length ? acabamentoSummaries[0].op : null),
          docs: 'NF de servico e romaneio',
          action: releaseExpedicaoAction,
        },
      },
      {
        key: 'expedicao',
        label: 'EXPEDICAO',
        color: '#2563eb',
        percent: totalPedido > 0 ? ns.clampPercent(((hasExpedicaoData ? expedicaoLiberado : prontoExpedicao) / totalPedido) * 100) : 0,
        state: hasExpedicaoData && expedicaoSaldo <= 0 && expedicaoLiberado > 0 && prontoExpedicao <= 0
          ? 'done'
          : ((hasExpedicaoData && expedicaoLiberado > 0) || prontoExpedicao > 0 ? 'current' : 'future'),
        sublabel: hasExpedicaoData
          ? (expedicaoSaldo > 0 ? ns.fmtMetros(expedicaoSaldo) : 'concluido')
          : (prontoExpedicao > 0 ? ns.fmtMetros(prontoExpedicao) : 'aguardando'),
        transfer: {
          title: 'Registrar saida para entrega',
          origem: 'Expedicao',
          destino: 'Entrega',
          detalhe: hasExpedicaoData ? 'Abra a expedicao vinculada para registrar entrega/coleta.' : 'Libere a expedicao a partir da OP de acabamento.',
          op: acabamentoSummaries.length ? acabamentoSummaries[0].op : null,
          docs: 'NF de expedicao',
          action: chainState && chainState.actions ? chainState.actions.registerDelivery : null,
        },
      },
      {
        key: 'entrega',
        label: 'ENTREGA',
        color: '#18794a',
        percent: totalPedido > 0 ? ns.clampPercent((deliveredExactTotal / totalPedido) * 100) : 0,
        state: deliveredExactTotal >= totalPedido && totalPedido > 0
          ? 'done'
          : (deliveredExactTotal > 0 ? 'current' : 'future'),
        sublabel: deliveredExactTotal > 0 ? ns.fmtMetros(deliveredExactTotal) : 'aguardando',
        transfer: null,
      },
    ];

    if (chainState && chainState.adminStepper) {
      stepper.forEach(function (stage) {
        var nextState = chainState.adminStepper[stage.key];
        if (!nextState) return;
        stage.state = nextState;
        if (nextState === 'done') {
          stage.percent = 100;
          stage.sublabel = 'concluido';
        }
      });
    }

    applyFormalPendingStage(stepper, 'tecelagem', tecMeta, emTecelagem, tecFormalPending, 'entregue; finalizar OP');
    applyFormalPendingStage(stepper, 'acabamento', acabMeta, emAcabamento, acabFormalPending, 'OP pendente');

    if (chainState && chainState.tecPendingAcceptance) {
      stepper.forEach(function (stage) {
        if (stage.key === 'tecelagem') {
          stage.state = stage.state === 'done' ? 'current' : stage.state;
          stage.sublabel = 'OP pendente de aceite';
          return;
        }
        if (stage.key === 'insumos') {
          // Recebimento ocorreu, mas a transicao produtiva aguarda aceite da OP;
          // nao deve induzir que a cadeia esta fechada.
          stage.state = 'current';
          stage.sublabel = 'Recebido — aguardando aceite';
        }
      });
    }

    if (chainState && chainState.actions) {
      opSummaries.forEach(function (summary) {
        summary.chainAction = summary.stageKey === 'tecelagem'
          ? chainState.actions.transferTecelagemToAcabamento
          : chainState.actions.releaseExpedicao;
      });
    }

    return {
      trackingApi: trackingApi,
      trackingSummary: trackingSummary,
      chainState: chainState,
      totalPedido: totalPedido,
      opSummaries: opSummaries,
      itemMetricsById: itemMetricsById,
      pendingDocs: pendingDocs,
      finishedLatex: finishedLatex,
      emTecelagem: emTecelagem,
      emAcabamento: emAcabamento,
      prontoExpedicao: prontoExpedicao,
      expedicaoLiberado: expedicaoLiberado,
      expedicaoSaldo: expedicaoSaldo,
      expedicaoSummaries: expedicaoSummaries,
      entregue: deliveredExactTotal,
      insumoPedidoKg: insumoPedidoKg,
      insumoRecebidoKg: insumoRecebidoKg,
      stepper: stepper,
      documentRowsPedido: documentRowsPedido,
      documentRowsOperacionais: documentRowsOperacionais,
      linkedOpCount: linkedOpCount,
      pedidoConclusao: pedidoConclusao,
    };
  }

  ns.opLabel = opLabel;
  ns.stageKeyForOp = stageKeyForOp;
  ns.stageLabelForOp = stageLabelForOp;
  ns.deliveryStageForOp = deliveryStageForOp;
  ns.targetMetersForOpItem = targetMetersForOpItem;
  ns.sortOpsForDisplay = sortOpsForDisplay;
  ns.computeViewModel = computeViewModel;
})(window);
