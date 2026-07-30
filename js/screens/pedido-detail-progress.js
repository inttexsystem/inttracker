// =====================================================================
// === SCREENS: PEDIDO DETAIL PROGRESS ================================
// Calculos e normalizacao de progresso do detalhe do pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: identidade canonica persistida.
  // ANTES esta funcao concatenava `ops.numero/ops.ano` incondicionalmente, e
  // era exatamente ela que fazia o modal de movimentacao imprimir
  // `OP de origem: OP 42/2026` ao lado de `OPs relacionadas: OP 1/2026-T01`
  // — dois nomes para a MESMA OP na MESMA superficie.
  //
  // Agora delega ao dono central. Nao precisa mais de contexto de Pedido nem
  // de lista de irmas: a identidade vem persistida da linha. Sem fallback
  // proprio — a ausencia do helper e defeito de carregamento, nao caso de
  // negocio.
  function opLabel(op) {
    return window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op);
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

  // PHASE-MANTA-B2B: a rota do produto vem so de `modelos.tipo_produto`
  // (js/product-route.js), nunca de `ops.tipo`, do nome ou da largura.
  function routeApi() {
    return window.RAVATEX_PRODUCT_ROUTE || null;
  }

  function routeForOp(op, modelosById) {
    var api = routeApi();
    return api ? api.routeForOp(op, modelosById) : null;
  }

  // Origem real da expedicao: op_latex_id (Tapete) OU op_tecelagem_id
  // (Manta). Hard-codar op_latex_id perde toda expedicao Manta.
  function expedicaoSourceOpId(expedicao) {
    var api = routeApi();
    if (api) return api.expedicaoSourceOpId(expedicao);
    return expedicao && expedicao.op_latex_id != null ? expedicao.op_latex_id : null;
  }

  // Semantica documental/resumo POR ROTA (D4.2/D4.4): vive no modulo de rota.
  function routeDocs() {
    return (window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.pedidoRouteSections) || null;
  }

  function isTerminalOpStatus(status) {
    return status === 'concluida' || status === 'finalizada' || status === 'cancelada';
  }

  function hasFormalPendingOp(summaries) {
    return summaries.some(function (row) { return !isTerminalOpStatus(row.status); });
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

    // Codigo operacional atrelado ao Pedido (OP {pedido}/{ano}-{tipo}{seq}),
    // via helper central. Cai no legado `OP {numero}/{ano}` (opLabel) quando o
    // helper nao esta carregado ou falta contexto confiavel de Pedido.
    var opDisplayApi = window.RAVATEX_OP_DISPLAY;
    function opCode(op) {
      if (!op) return '';
      if (opDisplayApi && typeof opDisplayApi.formatOpOperationalCode === 'function') {
        return opDisplayApi.formatOpOperationalCode(op, { pedido: state.pedido, ops: state.ops });
      }
      return opLabel(op);
    }

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
      // Atribuicao pela origem REAL da expedicao (Tapete: op_latex_id;
      // Manta: op_tecelagem_id).
      var sourceOpId = expedicao ? expedicaoSourceOpId(expedicao) : null;
      if (sourceOpId != null) {
        liberadoByLatexOp[sourceOpId] = ns.round2((liberadoByLatexOp[sourceOpId] || 0) + ns.toFiniteNumber(row.metros_liberados));
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
        simulada: { bg: 'var(--rv-pill-neutral-bg)', text: 'var(--rv-text-secondary)', dot: 'var(--rv-pill-neutral-dot)', label: 'Simulada' },
        aberta: { bg: 'var(--rv-pill-info-bg)', text: 'var(--rv-pill-info-text)', dot: 'var(--rv-pill-info-dot)', label: 'Aberta' },
        em_producao: { bg: 'var(--rv-pill-caution-bg)', text: 'var(--rv-pill-caution-text)', dot: 'var(--rv-pill-caution-dot)', label: 'Em producao' },
        concluida: { bg: 'var(--rv-pill-positive-bg)', text: 'var(--rv-pill-positive-text)', dot: 'var(--rv-pill-positive-dot)', label: 'Concluida' },
        finalizada: { bg: 'var(--rv-pill-positive-bg)', text: 'var(--rv-pill-positive-text)', dot: 'var(--rv-pill-positive-dot)', label: 'Finalizada' },
      }[op.status] || { bg: 'var(--rv-pill-neutral-bg)', text: 'var(--rv-text-secondary)', dot: 'var(--rv-pill-neutral-dot)', label: ns.fmtTextoOuEmpty(op.status, 'Status') };

      // D4.4: semantica documental por rota extraida (R-5).
      var opRoute = routeForOp(op, state.modelosById);
      var docBanner = routeDocs()
        ? routeDocs().buildOpDocBanner(stageKeyForOp(op), opRoute, doneTarget)
        : { tone: 'neutral', text: 'Pendencia documental' };

      opSummaries.push({
        id: op.id,
        numero: op.numero,
        ano: op.ano,
        label: opCode(op),
        legacyLabel: opLabel(op),
        tipo: op.tipo,
        route: opRoute,
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
        origemOpLabel: op.origem_op_id && opById[op.origem_op_id] ? opCode(opById[op.origem_op_id]) : null,
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
      var sourceOpId = expedicaoSourceOpId(expedicao);
      return {
        id: expedicao.id,
        status: expedicao.status,
        pedidoId: expedicao.pedido_id,
        opLatexId: expedicao.op_latex_id,
        opTecelagemId: expedicao.op_tecelagem_id != null ? expedicao.op_tecelagem_id : null,
        sourceOpId: sourceOpId,
        loteId: expedicao.lote_id,
        liberado: liberado,
        entregue: entregue,
        saldo: ns.round2(Math.max(liberado - entregue, 0)),
        movimentos: movimentosByExpedicaoId[expedicao.id] || [],
        op: opById[sourceOpId] || null,
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
          itens: state.itens,
          modelosById: state.modelosById,
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
          // D4.3: na Manta a expedicao referencia o op_item da propria OP de
          // TECELAGEM; sem isto liberado/entregue da Manta ficava zerado.
          if (routeForOp(row.op, state.modelosById) === 'manta') {
            acabDoneItem += ns.toFiniteNumber(liberadoByLatexOpItem[row.opItem.id]);
            acabEntregueItem += ns.toFiniteNumber(entregueByLatexOpItem[row.opItem.id]);
          }
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
        // Rota do item comercial (so `modelos.tipo_produto`) — D4.3.
        route: routeApi() ? routeApi().routeForPedidoItem(item, state.modelosById) : null,
        tecelagem: ns.round2(Math.max(tecTotal - tecDoneItem, 0)),
        acabamento: ns.round2(Math.max(acabTotal - acabDoneItem, 0)),
        prontos: readyItem,
        entregues: deliveredItem,
        relatedOps: relatedOps,
        relatedOpsLabel: relatedOps.length
          ? relatedOps.map(function (op) { return opCode(op); }).join(' -> ')
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
      if (routeDocs()) documentRowsOperacionais.push(routeDocs().buildOpDocumentRow(summary));
    });
    expedicaoSummaries.forEach(function (summary) {
      documentRowsOperacionais.push({
        label: 'Expedicao #' + summary.id + (summary.op ? ' - ' + opCode(summary.op) : ''),
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
    // Simetria de rota (db/87): so a rota Tapete exige OP de acabamento.
    // Uma OP de tecelagem Manta terminal exige expedicao por op_tecelagem_id.
    var tapeteTecSummaries = tecelagemSummaries.filter(function (row) { return row.route !== 'manta'; });
    var mantaTecSummaries = tecelagemSummaries.filter(function (row) { return row.route === 'manta'; });
    if (tapeteTecSummaries.length > 0 && acabamentoSummaries.length === 0) {
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
    mantaTecSummaries.forEach(function (summary) {
      var temExpedicao = expedicoes.some(function (expedicao) {
        return expedicao.op_tecelagem_id === summary.id;
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

    // PHASE-MANTA-B2B: secoes por rota. O stepper fixo de 5 estagios foi
    // substituido — a forma das etapas e derivada de `modelos.tipo_produto`
    // e delegada a `pedidoRouteSections` (R-5: este modulo nao pode crescer).
    // Um Pedido homogeneo degenera para exatamente uma secao.
    var routeApiRef = routeApi();
    var pedidoRoutes = routeApiRef
      ? routeApiRef.routesForPedido({ ops: state.ops, itens: state.itens, modelosById: state.modelosById })
      : [];
    var sectionsApi = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.pedidoRouteSections;
    var routeBuild = sectionsApi && typeof sectionsApi.buildRouteSections === 'function'
      ? sectionsApi.buildRouteSections({
          routes: pedidoRoutes,
          opSummaries: opSummaries,
          expedicoes: expedicoes,
          expedicaoItens: expedicaoItens,
          insumoOrdens: insumoOrdens,
          totalPedido: totalPedido,
          deliveredExactTotal: deliveredExactTotal,
          chainState: chainState,
          releaseExpedicaoAction: releaseExpedicaoAction,
          fmt: { metros: ns.fmtMetros, kg: ns.fmtKg },
        })
      : { sections: [], stepper: [], summary: null };
    var routeSections = routeBuild.sections;
    var stepper = routeBuild.stepper;
    // D4.2: resumo consciente da rota, derivado no modulo de rota (R-5).
    var routeSummary = routeBuild.summary || null;

    if (chainState && chainState.actions) {
      opSummaries.forEach(function (summary) {
        // Uma OP de tecelagem Manta nunca recebe a acao de acabamento.
        if (summary.stageKey === 'tecelagem') {
          summary.chainAction = summary.route === 'manta'
            ? chainState.actions.registrarSaidaManta
            : chainState.actions.transferTecelagemToAcabamento;
          return;
        }
        summary.chainAction = chainState.actions.releaseExpedicao;
      });
    }

    var ingestorDocumentRows = [];
    var ingestorTimeline = [];
    var ingestorDocsLoaded = false;

    if (pedido && typeof window.RAVATEX_DOCUMENTS !== 'undefined'
      && typeof window.RAVATEX_DOCUMENTS.buildDocumentsForPedido === 'function'
      && typeof window.RAVATEX_DOCUMENTS.normalizePedidoKey === 'function') {
      var pedidoAno = null;
      try {
        if (pedido.criado_em) {
          pedidoAno = new Date(pedido.criado_em).getFullYear();
        }
      } catch (_e) { /* ignora */ }
      var pedidoKey = window.RAVATEX_DOCUMENTS.normalizePedidoKey(pedido.numero, pedidoAno);
      var loadedEvents = (typeof window.RAVATEX_DOCUMENTS_LOADED_EVENTS !== 'undefined'
        && Array.isArray(window.RAVATEX_DOCUMENTS_LOADED_EVENTS))
        ? window.RAVATEX_DOCUMENTS_LOADED_EVENTS : [];
      var receivedSupabasePrimary = window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE === 'supabase';
      if (!receivedSupabasePrimary && loadedEvents.length > 0 && pedidoKey) {
        var result = window.RAVATEX_DOCUMENTS.buildDocumentsForPedido(loadedEvents, pedidoKey);

        // Fallback: se nao encontrou eventos pelo pedidoKey exato (ano do
        // criado_em pode divergir do ano usado no pedido_manual da fixture),
        // tenta casar pelo prefixo do numero do pedido.
        if ((!result || !Array.isArray(result.consolidatedDocuments) || result.consolidatedDocuments.length === 0)
            && pedido.numero != null) {
          var numeroPad = String(pedido.numero).padStart(2, '0');
          var prefixo = 'PED-' + numeroPad + '-';
          var matchingEvents = loadedEvents.filter(function (ev) {
            return ev.pedido_manual && ev.pedido_manual.indexOf(prefixo) === 0;
          });
          if (matchingEvents.length > 0) {
            // Coleta chaves distintas (ex: PED-02-2025, PED-02-2026).
            // So faz fallback se houver exatamente uma chave unica.
            // Multiplas chaves = ambiguo; nao vincula automaticamente.
            var distinct = {};
            for (var k = 0; k < matchingEvents.length; k++) {
              if (matchingEvents[k].pedido_manual) {
                distinct[matchingEvents[k].pedido_manual] = true;
              }
            }
            var uniqueKeys = Object.keys(distinct);
            if (uniqueKeys.length === 1) {
              result = window.RAVATEX_DOCUMENTS.buildDocumentsForPedido(loadedEvents, uniqueKeys[0]);
            }
          }
        }

        if (result && Array.isArray(result.consolidatedDocuments)) {
          result.consolidatedDocuments.forEach(function (ev) {
            var doc = ev.document;
            var statusMeta = window.RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta(ev.status || 'pending_app_acceptance');
            var tipoMeta = window.RAVATEX_DOCUMENTS.getDocumentTipoBadgeMeta(doc && doc.tipo_documento);
            var formatoMeta = window.RAVATEX_DOCUMENTS.getDocumentFormatoBadgeMeta(doc && doc.formato);
            var direcaoMeta = window.RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta(doc && doc.direcao_nf);
            var reason = doc && doc.reason ? doc.reason : null;
            var driveLink = doc && doc.drive_web_view_link ? doc.drive_web_view_link : null;

            var badges = [];
            badges.push({ bg: tipoMeta.bg, text: tipoMeta.text, label: tipoMeta.label });
            if (formatoMeta) {
              badges.push({ bg: formatoMeta.bg, text: formatoMeta.text, label: formatoMeta.label });
            }
            if (direcaoMeta) {
              badges.push({ bg: direcaoMeta.bg, text: direcaoMeta.text, label: direcaoMeta.label });
            }

            ingestorDocumentRows.push({
              label: doc && doc.filename_original ? doc.filename_original : 'Documento',
              status: ev.status || 'pending_app_acceptance',
              statusMeta: statusMeta,
              badges: badges,
              reason: reason,
              driveLink: driveLink,
              meta: 'Ingestor · ' + (window.RAVATEX_DOCUMENTS.fmtTimestamp
                ? window.RAVATEX_DOCUMENTS.fmtTimestamp(ev.created_at)
                : String(ev.created_at || '')),
            });
          });

          if (Array.isArray(result.timeline)) {
            result.timeline.forEach(function (ev) {
              ingestorTimeline.push({
                eventType: ev.event_type || '',
                label: (typeof window.RAVATEX_DOCUMENTS.getDocumentEventLabel === 'function'
                  ? window.RAVATEX_DOCUMENTS.getDocumentEventLabel(ev.event_type)
                  : ev.event_type),
                timestamp: ev.created_at || '',
                formattedTime: (typeof window.RAVATEX_DOCUMENTS.fmtTimestamp === 'function'
                  ? window.RAVATEX_DOCUMENTS.fmtTimestamp(ev.created_at)
                  : String(ev.created_at || '')),
                docLabel: ev.document && ev.document.filename_original
                  ? ev.document.filename_original : (ev.document && ev.document.document_id || ''),
              });
            });
          }

          if (ingestorDocumentRows.length > 0) {
            ingestorDocsLoaded = true;
          }
        }
      }

      // Fallback G14-B: bridge RAVATEX_DOCUMENTS_RECEIVED (JSONL flat)
      // quando nao ha eventos carregados pela rota legada.
      if (ingestorDocumentRows.length === 0 && pedidoKey
          && typeof window.RAVATEX_DOCUMENTS_RECEIVED !== 'undefined'
          && Array.isArray(window.RAVATEX_DOCUMENTS_RECEIVED)
          && typeof window.RAVATEX_DOCUMENTS.mapReceivedDocToEventShape === 'function') {
        var receivedDocs = window.RAVATEX_DOCUMENTS_RECEIVED;
        // Filtra por pedido_manual exato do pedidoKey.
        // Se nenhum doc corresponder, tenta fallback por prefixo do numero.
        var matchingReceived = [];
        for (var ri = 0; ri < receivedDocs.length; ri++) {
          var rd = receivedDocs[ri];
          if (rd && rd.pedido_manual === pedidoKey) {
            matchingReceived.push(rd);
          }
        }

        // Fallback: prefixo do numero do pedido (ano do criado_em pode divergir).
        if (matchingReceived.length === 0 && pedido.numero != null) {
          var recvNumeroPad = String(pedido.numero).padStart(2, '0');
          var recvPrefixo = 'PED-' + recvNumeroPad + '-';
          var recvByKey = {};
          for (var rj = 0; rj < receivedDocs.length; rj++) {
            var rd2 = receivedDocs[rj];
            if (rd2 && typeof rd2.pedido_manual === 'string'
                && rd2.pedido_manual.indexOf(recvPrefixo) === 0) {
              var k = rd2.pedido_manual;
              if (!recvByKey[k]) {
                recvByKey[k] = [];
              }
              recvByKey[k].push(rd2);
            }
          }
          var recvUniqueKeys = Object.keys(recvByKey);
          if (recvUniqueKeys.length === 1) {
            matchingReceived = recvByKey[recvUniqueKeys[0]];
          }
        }

        // Deduplica por document_id antes de montar as linhas.
        var seenRecvIds = {};
        for (var rk = 0; rk < matchingReceived.length; rk++) {
          var rdoc = matchingReceived[rk];
          var rdocId = rdoc && rdoc.document_id;
          if (!rdocId || seenRecvIds[rdocId]) continue;
          seenRecvIds[rdocId] = true;

          var rev = window.RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(rdoc);
          if (!rev) continue;

          // G20-B: aplicar decisão local se houver
          var effectiveSt = null;
          var isLocalDecision = false;
          if (typeof window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus === 'function') {
            var eff = window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus(rdoc);
            if (eff && eff.isLocalDecision) {
              effectiveSt = eff.effectiveStatus;
              isLocalDecision = true;
            }
          }
          var effectiveStatus = effectiveSt || rev.status;

          var rdocDoc = rev.document;
          var rstatusMeta = window.RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta(effectiveStatus || 'pending');
          var rtipoMeta = window.RAVATEX_DOCUMENTS.getDocumentTipoBadgeMeta(rdocDoc && rdocDoc.tipo_documento);
          var rformatoMeta = window.RAVATEX_DOCUMENTS.getDocumentFormatoBadgeMeta(rdocDoc && rdocDoc.formato);
          var rdirecaoMeta = window.RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta(rdocDoc && rdocDoc.direcao_nf);
          var rreason = rdocDoc && rdocDoc.reason ? rdocDoc.reason : null;
          var rdriveLink = rdocDoc && rdocDoc.drive_web_view_link ? rdocDoc.drive_web_view_link : null;

          var rbadges = [];
          rbadges.push({ bg: rtipoMeta.bg, text: rtipoMeta.text, label: rtipoMeta.label });
          if (rformatoMeta) {
            rbadges.push({ bg: rformatoMeta.bg, text: rformatoMeta.text, label: rformatoMeta.label });
          }
          if (rdirecaoMeta) {
            rbadges.push({ bg: rdirecaoMeta.bg, text: rdirecaoMeta.text, label: rdirecaoMeta.label });
          }

          ingestorDocumentRows.push({
            label: rdocDoc && rdocDoc.filename_original ? rdocDoc.filename_original : 'Documento',
            status: effectiveStatus || 'pending',
            statusMeta: rstatusMeta,
            badges: rbadges,
            reason: rreason,
            driveLink: rdriveLink,
            isLocalDecision: isLocalDecision || undefined,
            meta: 'Ingestor · ' + (typeof window.RAVATEX_DOCUMENTS.fmtTimestamp === 'function'
              ? window.RAVATEX_DOCUMENTS.fmtTimestamp(rev.created_at)
              : String(rev.created_at || '')),
          });

          if (ingestorDocumentRows.length > 0) {
            ingestorDocsLoaded = true;
          }
        }
      }
    }

    // G28-B7: canonical CONFIRMED document links for this Pedido, derived
    // exclusively from the active canonical link revision. pedido_manual /
    // candidate.pedido_id are never read here — those remain Ingestor
    // suggestions surfaced separately (ingestorDocumentRows above).
    var linkedDocumentRows = [];
    var linkedDocumentsState = 'unavailable';
    var linkedDocumentsReason = 'read_model_unavailable';
    var linkedDocumentTimeline = { state: 'unavailable', entries: [] };
    if (pedido && pedido.id
        && typeof window.RAVATEX_DOCUMENT_SURFACE_LINKS !== 'undefined'
        && typeof window.RAVATEX_DOCUMENT_SURFACE_LINKS.buildLinkedDocumentsForPedido === 'function'
        && typeof window.RAVATEX_DOCUMENTS !== 'undefined') {
      if (typeof window.RAVATEX_DOCUMENT_SURFACE_LINKS.buildDocumentLinkTimelineForPedido === 'function') {
        linkedDocumentTimeline = window.RAVATEX_DOCUMENT_SURFACE_LINKS.buildDocumentLinkTimelineForPedido(pedido.id);
      }
      var linkResult = window.RAVATEX_DOCUMENT_SURFACE_LINKS.buildLinkedDocumentsForPedido(pedido.id);
      linkedDocumentsState = (linkResult && linkResult.state) ? linkResult.state : 'unavailable';
      linkedDocumentsReason = (linkResult && linkResult.reason) ? linkResult.reason : null;
      var confirmedLinks = (linkResult && Array.isArray(linkResult.confirmed)) ? linkResult.confirmed : [];
      confirmedLinks.forEach(function (item) {
        var lStatusMeta = window.RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta(item.status || 'pending');
        var lTipoMeta = window.RAVATEX_DOCUMENTS.getDocumentTipoBadgeMeta(item.tipo_documento);
        var lFormatoMeta = window.RAVATEX_DOCUMENTS.getDocumentFormatoBadgeMeta(item.formato);
        var lDirecaoMeta = window.RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta(item.direcao_nf);
        var lBadges = [];
        if (lTipoMeta) lBadges.push({ bg: lTipoMeta.bg, text: lTipoMeta.text, label: lTipoMeta.label });
        if (lFormatoMeta) lBadges.push({ bg: lFormatoMeta.bg, text: lFormatoMeta.text, label: lFormatoMeta.label });
        if (lDirecaoMeta) lBadges.push({ bg: lDirecaoMeta.bg, text: lDirecaoMeta.text, label: lDirecaoMeta.label });
        linkedDocumentRows.push({
          label: item.filename_original || 'Documento',
          status: item.status || 'pending',
          statusMeta: lStatusMeta,
          badges: lBadges,
          driveLink: item.drive_web_view_link || null,
          linkVersion: (typeof item.link_version === 'number') ? item.link_version : null,
          targetCancelled: !!item.target_cancelled,
          opIds: Array.isArray(item.op_ids) ? item.op_ids : [],
        });
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
      pedidoRoutes: pedidoRoutes,
      routeSummary: routeSummary,
      routeSections: routeSections,
      stepper: stepper,
      documentRowsPedido: documentRowsPedido,
      documentRowsOperacionais: documentRowsOperacionais,
      ingestorDocumentRows: ingestorDocumentRows,
      ingestorTimeline: ingestorTimeline,
      ingestorDocsLoaded: ingestorDocsLoaded,
      linkedDocumentRows: linkedDocumentRows,
      linkedDocumentsState: linkedDocumentsState,
      linkedDocumentsReason: linkedDocumentsReason,
      linkedDocumentTimeline: linkedDocumentTimeline,
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
