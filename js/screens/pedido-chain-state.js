// =====================================================================
// === SCREENS: PEDIDO CHAIN STATE =====================================
// Matriz pura de estado operacional e acoes da cadeia do Pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  var STAGE_INDEX = Object.freeze({
    recebido: 0,
    confirmado: 1,
    insumos: 2,
    tecelagem: 3,
    acabamento: 4,
    expedicao: 5,
    transporte: 6,
    concluido: 7,
  });

  var CLIENT_STEPS = Object.freeze([
    Object.freeze({ key: 'recebido', label: 'Recebido' }),
    Object.freeze({ key: 'confirmado', label: 'Confirmado' }),
    Object.freeze({ key: 'insumos', label: 'Insumos' }),
    Object.freeze({ key: 'tecelagem', label: 'Tecelagem' }),
    Object.freeze({ key: 'acabamento', label: 'Acabamento' }),
    Object.freeze({ key: 'expedicao', label: 'Expedicao' }),
    Object.freeze({ key: 'transporte', label: 'Transporte' }),
    Object.freeze({ key: 'concluido', label: 'Concluido' }),
  ]);

  function toFiniteNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(value) {
    return Math.round(toFiniteNumber(value) * 100) / 100;
  }

  function clampPercent(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 100) return 100;
    return Number(value.toFixed(1));
  }

  function pedidoStatusLabel(status) {
    var map = {
      rascunho: 'Rascunho',
      recebido: 'Recebido',
      confirmado: 'Confirmado',
      produzindo: 'Produzindo',
      entregue: 'Concluido',
      cancelado: 'Cancelado',
    };
    return map[status] || (status ? String(status) : 'Recebido');
  }

  // PHASE-MANTA-B2B: `ops.tipo` identifica a ETAPA produtiva; a ROTA vem
  // so de `modelos.tipo_produto` (js/product-route.js). Os dois nunca
  // podem ser confundidos de novo.
  function routeApi() {
    return window.RAVATEX_PRODUCT_ROUTE || null;
  }

  function routeForOp(op, modelosById) {
    var api = routeApi();
    return api ? api.routeForOp(op, modelosById) : null;
  }

  function expedicaoSourceOpId(expedicao) {
    var api = routeApi();
    if (api) return api.expedicaoSourceOpId(expedicao);
    return expedicao && expedicao.op_latex_id != null ? expedicao.op_latex_id : null;
  }

  function stageKeyForOp(row) {
    return row && row.tipo === 'latex' ? 'acabamento' : 'tecelagem';
  }

  function deliveryStageForOp(row) {
    return stageKeyForOp(row) === 'acabamento' ? 'latex' : 'cima';
  }

  function isTerminalOpStatus(status) {
    return status === 'concluida' || status === 'finalizada' || status === 'cancelada';
  }

  function opDisplayLabel(op, pedido, ops) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(op, { pedido: pedido, ops: ops });
    }
    return 'OP ' + (op && op.numero != null ? op.numero : '-') + (op && op.ano != null ? '/' + op.ano : '');
  }

  function targetMetersForOpItem(row) {
    if (!row) return 0;
    return round2(row.metros_ajustados != null ? row.metros_ajustados : row.metros_pedidos);
  }

  function action(mode, label, extra) {
    var safeMode = mode || 'hidden';
    var visible = safeMode !== 'hidden';
    var payload = {
      visible: visible,
      enabled: safeMode === 'enabled',
      mode: safeMode,
      label: label || (safeMode === 'enabled' ? 'Transferir' : safeMode === 'view' ? 'Visualizar' : 'Indisponivel'),
    };
    Object.keys(extra || {}).forEach(function (key) {
      payload[key] = extra[key];
    });
    return payload;
  }

  function buildOpSummaries(input) {
    var entregaItens = Array.isArray(input.entregaItens) ? input.entregaItens : [];
    var entregasById = input.entregasById || {};
    var expedicoesById = {};
    var liberadoBySourceOp = {};

    (Array.isArray(input.expedicoes) ? input.expedicoes : []).forEach(function (expedicao) {
      if (expedicao) expedicoesById[expedicao.id] = expedicao;
    });
    (Array.isArray(input.expedicaoItens) ? input.expedicaoItens : []).forEach(function (item) {
      var expedicao = expedicoesById[item.expedicao_id];
      var sourceOpId = expedicao ? expedicaoSourceOpId(expedicao) : null;
      if (sourceOpId == null) return;
      liberadoBySourceOp[sourceOpId] = round2((liberadoBySourceOp[sourceOpId] || 0) + toFiniteNumber(item.metros_liberados));
    });

    return (Array.isArray(input.ops) ? input.ops : []).map(function (op) {
      var target = 0;
      var done = 0;
      var stageKey = stageKeyForOp(op);
      var route = routeForOp(op, input.modelosById);
      var deliveryStage = deliveryStageForOp(op);
      var itemIds = {};

      (op.op_itens || []).forEach(function (item) {
        target += targetMetersForOpItem(item);
        if (item && item.id != null) itemIds[item.id] = true;
      });

      entregaItens.forEach(function (item) {
        if (!item || item.defeito) return;
        if (item.op_id !== op.id && !itemIds[item.op_item_id]) return;
        var entrega = entregasById[item.entrega_id];
        if (!entrega || entrega.etapa !== deliveryStage) return;
        done += toFiniteNumber(item.metros_entregues);
      });

      if (stageKey === 'acabamento') {
        done = Math.max(done, liberadoBySourceOp[op.id] || 0);
      }

      target = round2(target);
      done = round2(done);
      return {
        id: op.id,
        op: op,
        stageKey: stageKey,
        route: route,
        status: op.status,
        target: target,
        done: done,
        // Manta: a saida medida (`done`) menos o ja liberado por
        // op_tecelagem_id e o que ainda pode ir para a Expedicao.
        liberado: round2(liberadoBySourceOp[op.id] || 0),
        remaining: round2(Math.max(target - done, 0)),
      };
    });
  }

  function sum(rows, key) {
    return round2((rows || []).reduce(function (acc, row) {
      return acc + toFiniteNumber(row && row[key]);
    }, 0));
  }

  // As etapas do cliente passam a ser DERIVADAS da rota: `acabamento` so
  // existe no Tapete. Um Pedido misto mantem a uniao (cada rota e
  // renderizada em sua propria secao pela superficie que consome isto).
  function clientStepsForRoutes(routes) {
    var api = routeApi();
    if (!api || typeof api.filterClientSteps !== 'function') return CLIENT_STEPS.slice();
    var filtered = api.filterClientSteps(CLIENT_STEPS, routes);
    return filtered.length ? filtered : CLIENT_STEPS.slice();
  }

  function buildClientSteps(currentKey, routes) {
    var steps = clientStepsForRoutes(routes);
    var currentIndex = STAGE_INDEX[currentKey] != null ? STAGE_INDEX[currentKey] : 0;
    return steps.map(function (step) {
      var index = STAGE_INDEX[step.key] != null ? STAGE_INDEX[step.key] : 0;
      var state = index < currentIndex ? 'concluido' : (index === currentIndex ? 'atual' : 'futuro');
      return {
        key: step.key,
        label: step.label,
        state: state,
        percentual: state === 'futuro' ? 0 : 100,
        sublabel: state === 'concluido' ? 'concluido' : (state === 'atual' ? 'em andamento' : 'aguardando'),
      };
    });
  }

  function derivePedidoChainState(input) {
    input = input || {};
    var pedido = input.pedido || {};
    var opSummaries = buildOpSummaries(input);
    var tecelagem = opSummaries.filter(function (row) { return row.stageKey === 'tecelagem'; });
    var acabamento = opSummaries.filter(function (row) { return row.stageKey === 'acabamento'; });
    var routeApiRef = routeApi();
    var pedidoRoutes = routeApiRef
      ? routeApiRef.routesForPedido({ ops: input.ops, itens: input.itens, modelosById: input.modelosById })
      : [];
    var mantaTec = tecelagem.filter(function (row) { return row.route === 'manta'; });

    var tecTarget = sum(tecelagem, 'target');
    var tecDone = sum(tecelagem, 'done');
    var tecRemaining = sum(tecelagem, 'remaining');
    var acabTarget = sum(acabamento, 'target');
    var acabDone = sum(acabamento, 'done');
    var acabRemaining = sum(acabamento, 'remaining');

    var hasTec = tecelagem.length > 0;
    var hasAcab = acabamento.length > 0;
    var tecProduction = tecelagem.some(function (row) { return row.status === 'em_producao'; });
    var tecOpen = tecelagem.some(function (row) { return row.status === 'aberta' || row.status === 'simulada'; });
    var tecOpenAcceptance = tecelagem.find(function (row) { return row.status === 'aberta'; }) || null;
    var tecFormalPending = tecelagem.some(function (row) { return !isTerminalOpStatus(row.status); });
    var tecFinished = hasTec && !tecFormalPending;
    var tecSaldoEntregue = tecTarget > 0 && tecRemaining <= 0;
    var acabOpen = acabamento.some(function (row) { return row.status === 'aberta' || row.status === 'simulada'; });
    var acabProduction = acabamento.some(function (row) { return row.status === 'em_producao'; });
    var acabFormalPending = acabamento.some(function (row) { return !isTerminalOpStatus(row.status); });
    var acabFinished = hasAcab && !acabFormalPending;
    var acabSaldoEntregue = acabTarget > 0 && acabRemaining <= 0;

    var ordens = Array.isArray(input.ordensFio) ? input.ordensFio : [];
    var insumoPedidoKg = sum(ordens, 'kg_pedido');
    var insumoRecebidoKg = sum(ordens, 'kg_recebido');
    var insumosConcluidos = insumoPedidoKg > 0
      ? insumoRecebidoKg >= insumoPedidoKg
      : (tecProduction || tecDone > 0 || hasAcab);

    var expedicaoItens = Array.isArray(input.expedicaoItens) ? input.expedicaoItens : [];
    var expedicoes = Array.isArray(input.expedicoes) ? input.expedicoes : [];
    var expedicaoLiberado = sum(expedicaoItens, 'metros_liberados');
    var expedicaoEntregue = sum(expedicaoItens, 'metros_entregues');
    var expedicaoSaldo = round2(Math.max(expedicaoLiberado - expedicaoEntregue, 0));
    var hasExpedicao = expedicoes.length > 0 || expedicaoItens.length > 0;
    var expedicoesById = {};
    var expedicoesByOp = {};
    expedicoes.forEach(function (expedicao) {
      if (!expedicao) return;
      expedicoesById[expedicao.id] = expedicao;
      var sourceOpId = expedicaoSourceOpId(expedicao);
      if (sourceOpId != null) expedicoesByOp[sourceOpId] = expedicao;
    });
    var liberadoByLatexOp = {};
    expedicaoItens.forEach(function (item) {
      var expedicao = expedicoesById[item.expedicao_id];
      var itemSourceOpId = expedicao ? expedicaoSourceOpId(expedicao) : null;
      if (itemSourceOpId == null) return;
      liberadoByLatexOp[itemSourceOpId] = round2((liberadoByLatexOp[itemSourceOpId] || 0) + toFiniteNumber(item.metros_liberados));
    });
    // Paridade com Tecelagem: o material disponivel na OP de Acabamento e o
    // RECEBIDO da Tecelagem (op_itens acumulados = row.target), nao um
    // movimento intermediario "registrar acabamento" (etapa='latex'). O saldo
    // movimentavel para Expedicao = recebido - ja movimentado para expedicao.
    // OP aberta tambem pode movimentar quando ja tem saldo recebido
    // acumulado nos op_itens. Finalizar a OP e terminalidade formal separada.
    function acabPodeMovimentar(status) {
      return status === 'aberta' || status === 'em_producao' || status === 'concluida' || status === 'finalizada';
    }
    var acabLiberavel = round2(acabamento.reduce(function (acc, row) {
      var recebido = acabPodeMovimentar(row.status) ? row.target : 0;
      return acc + Math.max(round2(recebido - (liberadoByLatexOp[row.id] || 0)), 0);
    }, 0));
    var hasAcabLiberavel = acabLiberavel > 0;
    var acabTerminalSemExpedicao = acabamento.some(function (row) {
      return (row.status === 'finalizada' || row.status === 'concluida') && !expedicoesByOp[row.id];
    });

    // Rota Manta: a autoridade da saida e a entrega medida de tecelagem
    // (`done`), nunca o planejado. O que ainda pode ir para a Expedicao e
    // medido - ja liberado por op_tecelagem_id. Uma OP de tecelagem Manta
    // terminal com saida medida nao liberada esta "pronta para expedicao"
    // e NUNCA "aguardando acabamento".
    var mantaLiberavel = round2(mantaTec.reduce(function (acc, row) {
      return acc + Math.max(round2(toFiniteNumber(row.done) - toFiniteNumber(row.liberado)), 0);
    }, 0));
    var hasMantaLiberavel = mantaLiberavel > 0;
    var mantaTerminalSemExpedicao = mantaTec.some(function (row) {
      return (row.status === 'finalizada' || row.status === 'concluida') && !expedicoesByOp[row.id];
    });
    var mantaLiberavelSummary = mantaTec.find(function (row) {
      return Math.max(round2(toFiniteNumber(row.done) - toFiniteNumber(row.liberado)), 0) > 0;
    }) || mantaTec.find(function (row) {
      return (row.status === 'finalizada' || row.status === 'concluida') && !expedicoesByOp[row.id];
    }) || null;
    var mantaOp = mantaLiberavelSummary ? mantaLiberavelSummary.op : (mantaTec.length ? mantaTec[0].op : null);

    var totalPedido = round2(toFiniteNumber(input.totalPedido || pedido.metros_total));
    // Conclusão formal depende exclusivamente do status gravado pela RPC
    // concluir_pedido_se_pronto (status='entregue'). A derivacao por
    // expedicaoEntregue >= totalPedido fica como metrica operacional
    // (expedicaoCompletamenteEntregue), sem antecipar stage/status.
    var expedicaoCompletamenteEntregue = totalPedido > 0 && expedicaoEntregue >= totalPedido;
    var pedidoConcluido = pedido.status === 'entregue';

    var stage = 'comercial';
    var clientStep = pedido.status === 'confirmado' ? 'confirmado' : 'recebido';
    var displayStatus = pedidoStatusLabel(pedido.status);
    var adminBadge = displayStatus;

    if (pedidoConcluido) {
      stage = 'concluido';
      clientStep = 'concluido';
      displayStatus = 'Concluido';
      adminBadge = 'Concluido';
    } else if (hasExpedicao && expedicaoSaldo > 0) {
      stage = 'expedicao';
      clientStep = 'transporte';
      displayStatus = 'Expedicao em andamento';
      adminBadge = 'Expedicao';
    } else if (hasMantaLiberavel || mantaTerminalSemExpedicao) {
      // Ramo Manta antes de qualquer ramo de Acabamento: a rota direta
      // nunca pode cair num estado "aguardando acabamento".
      stage = 'pronto_expedicao';
      clientStep = 'expedicao';
      displayStatus = hasExpedicao ? 'Expedicao liberada' : 'Pronto para expedicao';
      adminBadge = 'Pronto para expedicao';
    } else if (hasAcabLiberavel || acabTerminalSemExpedicao || acabFinished) {
      stage = 'pronto_expedicao';
      clientStep = 'expedicao';
      displayStatus = hasExpedicao ? 'Expedicao liberada' : 'Pronto para expedicao';
      adminBadge = 'Pronto para expedicao';
    } else if (acabProduction) {
      stage = 'acabamento';
      clientStep = 'acabamento';
      displayStatus = 'Acabamento em andamento';
      adminBadge = 'Em acabamento';
    } else if (acabOpen || (hasAcab && acabTarget > 0)) {
      stage = 'acabamento_entrada';
      clientStep = 'acabamento';
      displayStatus = 'Acabamento aguardando entrada';
      adminBadge = 'Aguardando entrada';
    } else if (tecFinished) {
      stage = 'tecelagem_concluida';
      clientStep = 'tecelagem';
      displayStatus = 'Tecelagem concluida';
      adminBadge = 'Tecelagem concluida';
    } else if (tecProduction || (tecRemaining > 0 && (insumosConcluidos || tecDone > 0))) {
      stage = 'tecelagem';
      clientStep = 'tecelagem';
      displayStatus = 'Tecelagem em andamento';
      adminBadge = 'Em producao';
    } else if (hasTec || tecOpen) {
      stage = 'preparacao';
      clientStep = 'insumos';
      displayStatus = insumosConcluidos ? 'Tecelagem pronta para iniciar' : 'Preparacao de insumos';
      adminBadge = insumosConcluidos ? 'Preparado' : 'Insumos';
    }

    var tecOp = tecelagem.length ? tecelagem[0].op : null;
    var acabLiberavelSummary = acabamento.find(function (row) {
      var recebido = acabPodeMovimentar(row.status) ? row.target : 0;
      return Math.max(round2(recebido - (liberadoByLatexOp[row.id] || 0)), 0) > 0;
    }) || acabamento.find(function (row) {
      return (row.status === 'finalizada' || row.status === 'concluida') && !expedicoesByOp[row.id];
    }) || null;
    var acabOp = acabLiberavelSummary ? acabLiberavelSummary.op : (acabamento.length ? acabamento[0].op : null);
    var tecPendingAcceptance = !!(tecOpenAcceptance && insumosConcluidos && !tecProduction);
    var tecPendingAcceptanceOp = tecOpenAcceptance ? tecOpenAcceptance.op : null;
    // Codigo operacional (OP {pedido}/{ano}-{tipo}{seq}) via helper central;
    // cai no legado `OP {numero}/{ano}` sem helper/contexto de Pedido.
    var tecPendingAcceptanceLabel = tecPendingAcceptanceOp
      ? opDisplayLabel(tecPendingAcceptanceOp, pedido, input.ops) + ' pendente de aceite'
      : 'OP pendente de aceite';
    var canMoveTecToAcab = hasTec && tecRemaining > 0 && (tecProduction || tecDone > 0 || tecFinished);
    var canReleaseExpedicao = hasAcabLiberavel || acabTerminalSemExpedicao;
    var hasManta = mantaTec.length > 0;
    var mantaTecRemaining = sum(mantaTec, 'remaining');
    var canRegistrarSaidaManta = hasManta && mantaTecRemaining > 0;
    var canRegisterDelivery = hasExpedicao && expedicaoSaldo > 0;

    var actions = {
      openTecelagemOp: hasTec
        ? action('view', 'Ver OP Tecelagem', { op: tecOp })
        : action('enabled', 'Abrir OP de Tecelagem'),
      transferInsumosToTecelagem: !hasTec
        ? action('disabled', 'Vincule uma OP')
        : (tecPendingAcceptance
          ? action('disabled', 'Aguardar aceite da OP', { op: tecPendingAcceptanceOp || tecOp })
          : (insumosConcluidos || tecProduction || tecDone > 0 || hasAcab
            ? action('view', 'Insumos concluidos', { op: tecOp })
            : action('enabled', 'Transferir', { op: tecOp }))),
      transferTecelagemToAcabamento: !hasTec
        ? action('hidden')
        : (canMoveTecToAcab
          ? action('enabled', 'Transferir', { op: tecOp })
          : (tecDone > 0 || hasAcab
            ? action('view', 'Movimento', { op: tecOp })
            : action('disabled', tecPendingAcceptance ? 'OP pendente de aceite' : 'Sem saldo disponivel', { op: tecOp }))),
      confirmAcabamentoEntry: !hasAcab
        ? action('hidden')
        : (acabOpen
          ? action('enabled', 'Confirmar entrada', { op: acabOp })
          : action('view', 'Ver OP Acabamento', { op: acabOp })),
      // Rota Manta: a saida medida de tecelagem substitui a transferencia
      // para acabamento. Nunca oferece acao de acabamento.
      registrarSaidaManta: !hasManta
        ? action('hidden')
        : (canRegistrarSaidaManta
          ? action('enabled', 'Registrar saida', { op: mantaOp, route: 'manta' })
          : action('view', 'Saida registrada', { op: mantaOp, route: 'manta' })),
      releaseExpedicaoManta: !hasManta
        ? action('hidden')
        : (hasMantaLiberavel || mantaTerminalSemExpedicao
          ? action('enabled', 'Liberar exp.', { op: mantaOp, route: 'manta' })
          : (hasExpedicao
            ? action('view', 'Ver expedicao', { op: mantaOp, route: 'manta' })
            : action('disabled', 'Aguardando saida medida', { op: mantaOp, route: 'manta' }))),
      releaseExpedicao: canReleaseExpedicao
        ? action('enabled', 'Liberar exp.', { op: acabOp })
        : (hasExpedicao ? action('view', 'Ver expedicao', { op: acabOp }) : action('disabled', 'Aguardando acabamento', { op: acabOp })),
      registerDelivery: canRegisterDelivery
        ? action('enabled', 'Registrar entrega')
        : (hasExpedicao ? action('view', 'Ver entrega') : action('hidden')),
      concludePedido: pedidoConcluido
        ? action('view', 'Pedido concluido')
        : action('disabled', 'Aguardando cadeia'),
    };

    var adminStepper = {
      insumos: tecPendingAcceptance
        ? 'current'
        : (insumosConcluidos ? 'done' : (hasTec ? 'current' : 'future')),
      tecelagem: tecFinished ? 'done' : (stage === 'tecelagem' || tecSaldoEntregue ? 'current' : (tecDone > 0 ? 'current' : 'future')),
      acabamento: acabFinished ? 'done' : (acabSaldoEntregue ? 'current' : ((stage === 'acabamento' || stage === 'acabamento_entrada') ? 'current' : (acabDone > 0 ? 'current' : 'future'))),
      expedicao: pedidoConcluido || (hasExpedicao && expedicaoSaldo <= 0 && expedicaoLiberado > 0) ? 'done' : ((stage === 'expedicao' || stage === 'pronto_expedicao') ? 'current' : 'future'),
      entrega: pedidoConcluido ? 'done' : (expedicaoEntregue > 0 ? 'current' : 'future'),
    };

    return {
      stage: stage,
      displayStatus: displayStatus,
      clientStep: clientStep,
      adminBadge: adminBadge,
      isOperationalOverride: hasTec || hasAcab || hasExpedicao || pedidoConcluido,
      routes: pedidoRoutes,
      metrics: {
        manta: { liberavel: mantaLiberavel, terminalSemExpedicao: mantaTerminalSemExpedicao, remaining: mantaTecRemaining, has: hasManta },
        tecelagem: { target: tecTarget, done: tecDone, remaining: tecRemaining, saldoEntregue: tecSaldoEntregue, terminal: tecFinished, formalPending: tecFormalPending },
        acabamento: { target: acabTarget, done: acabDone, remaining: acabRemaining, saldoEntregue: acabSaldoEntregue, terminal: acabFinished, formalPending: acabFormalPending },
        insumos: { pedidoKg: insumoPedidoKg, recebidoKg: insumoRecebidoKg, concluido: insumosConcluidos },
        expedicao: { liberado: expedicaoLiberado, entregue: expedicaoEntregue, saldo: expedicaoSaldo, liberavel: acabLiberavel },
      },
      tecPendingAcceptance: tecPendingAcceptance ? {
        label: tecPendingAcceptanceLabel,
        message: 'Insumos recebidos; OP pendente de aceite',
        op: tecPendingAcceptanceOp,
        opId: tecPendingAcceptanceOp ? tecPendingAcceptanceOp.id : null,
        numero: tecPendingAcceptanceOp ? tecPendingAcceptanceOp.numero : null,
        ano: tecPendingAcceptanceOp ? tecPendingAcceptanceOp.ano : null,
        status: tecPendingAcceptanceOp ? tecPendingAcceptanceOp.status : null,
      } : null,
      actions: actions,
      adminStepper: adminStepper,
      clientSteps: buildClientSteps(clientStep, pedidoRoutes),
      progressPercent: clampPercent(((STAGE_INDEX[clientStep] || 0) + 1) / CLIENT_STEPS.length * 100),
    };
  }

  window.RAVATEX_SCREENS.pedidoChainState = {
    derivePedidoChainState: derivePedidoChainState,
    clientStepsForRoutes: clientStepsForRoutes,
  };
})(window);
