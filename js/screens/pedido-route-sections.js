// =====================================================================
// === SCREENS: PEDIDO ROUTE SECTIONS ==================================
// PHASE-MANTA-B2B. Modelo de visao das SECOES POR ROTA do Pedido.
// Extraido de js/screens/pedido-detail-progress.js (que nao pode
// crescer, R-5 do contrato) sem duplicar regra: aquele modulo continua
// dono dos agregados e delega a forma das etapas aqui.
//
// Apresentacao canonica aceita (sec.7 do contrato): UMA secao por rota
// aplicavel, cada uma com seu proprio stepper. Um Pedido homogeneo
// degenera para exatamente uma secao — a visao de hoje, inalterada.
//
//   TAPETE: Insumos -> Tecelagem -> Acabamento -> Expedicao -> Entrega
//   MANTA:  Insumos -> Tecelagem ->               Expedicao -> Entrega
//
// Um stepper fixo de 5 estagios e PROIBIDO para Manta e para misto; as
// rotas nunca sao fundidas num unico stepper e uma rota concluida nunca
// conclui a outra.
//
// Puro: calculo e forma. Sem DOM, sem `window.supa`, sem escrita.
// =====================================================================

(function (window) {
  'use strict';

  function routeApi() {
    return window.RAVATEX_PRODUCT_ROUTE || null;
  }

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

  function isTerminalOpStatus(status) {
    return status === 'concluida' || status === 'finalizada' || status === 'cancelada';
  }

  function hasFormalPendingOp(summaries) {
    return summaries.some(function (row) { return !isTerminalOpStatus(row.status); });
  }

  function sumBy(rows, key) {
    return round2((rows || []).reduce(function (acc, row) {
      return acc + toFiniteNumber(row && row[key]);
    }, 0));
  }

  function stageState(percent, hasBase, remaining, done, terminalAtFull) {
    if (terminalAtFull && done >= hasBase && hasBase > 0) return 'done';
    if (hasBase > 0 && remaining <= 0) return 'done';
    if (hasBase > 0 || done > 0 || percent > 0) return 'current';
    return 'future';
  }

  function applyFormalPendingStage(stepper, key, hasBase, remaining, hasPending, label) {
    if (!hasPending || !(hasBase > 0) || remaining > 0) return;
    stepper.forEach(function (stage) {
      if (stage.key !== key) return;
      stage.state = 'current';
      stage.sublabel = label;
    });
  }

  // -------------------------------------------------------------------
  // Particionamento por rota. A expedicao pertence a rota da sua ORIGEM
  // real (op_latex_id -> Tapete; op_tecelagem_id -> Manta), nunca de
  // op_latex_id por presuncao.
  // -------------------------------------------------------------------
  function partitionForRoute(input, route) {
    var api = routeApi();
    var opSummaries = (input.opSummaries || []).filter(function (row) {
      return row && (row.route === route || (row.route == null && route === input.routes[0]));
    });
    var opIds = {};
    opSummaries.forEach(function (row) { opIds[row.id] = true; });

    var expedicoes = (input.expedicoes || []).filter(function (expedicao) {
      var opId = api ? api.expedicaoSourceOpId(expedicao) : (expedicao && expedicao.op_latex_id);
      return opId != null && opIds[opId];
    });
    var expedicaoIds = {};
    expedicoes.forEach(function (expedicao) { expedicaoIds[expedicao.id] = true; });
    var expedicaoItens = (input.expedicaoItens || []).filter(function (row) {
      return row && expedicaoIds[row.expedicao_id];
    });

    var tecOpIds = {};
    opSummaries.forEach(function (row) { if (row.stageKey === 'tecelagem') tecOpIds[row.id] = true; });
    var insumoOrdens = (input.insumoOrdens || []).filter(function (ordem) {
      return ordem && tecOpIds[ordem.op_id];
    });

    return {
      opSummaries: opSummaries,
      expedicoes: expedicoes,
      expedicaoItens: expedicaoItens,
      insumoOrdens: insumoOrdens,
    };
  }

  function computeRouteMetrics(input, route, single) {
    var part = partitionForRoute(input, route);
    var tec = part.opSummaries.filter(function (row) { return row.stageKey === 'tecelagem'; });
    var acab = part.opSummaries.filter(function (row) { return row.stageKey === 'acabamento'; });

    var insumoPedidoKg = sumBy(part.insumoOrdens, 'kg_pedido');
    var insumoRecebidoKg = sumBy(part.insumoOrdens, 'kg_recebido');

    var expedicaoLiberado = sumBy(part.expedicaoItens, 'metros_liberados');
    var expedicaoEntregue = sumBy(part.expedicaoItens, 'metros_entregues');
    var hasExpedicaoData = part.expedicoes.length > 0 || part.expedicaoItens.length > 0;

    // Numa rota unica, os totais globais ja calculados pelo modulo de
    // progresso continuam mandando — a visao Tapete-only nao muda.
    var totalRota = single
      ? round2(input.totalPedido)
      : round2(sumBy(tec, 'target') || sumBy(acab, 'target'));
    var entregueRota = single
      ? round2(input.deliveredExactTotal)
      : expedicaoEntregue;

    return {
      route: route,
      opSummaries: part.opSummaries,
      tecelagemSummaries: tec,
      acabamentoSummaries: acab,
      expedicoes: part.expedicoes,
      expedicaoItens: part.expedicaoItens,
      linkedOpCount: part.opSummaries.length,
      insumoPedidoKg: insumoPedidoKg,
      insumoRecebidoKg: insumoRecebidoKg,
      insumoPercent: insumoPedidoKg > 0 ? clampPercent((insumoRecebidoKg / insumoPedidoKg) * 100) : 0,
      tecMeta: sumBy(tec, 'target'),
      tecDone: sumBy(tec, 'done'),
      tecRemaining: sumBy(tec, 'remaining'),
      tecFormalPending: hasFormalPendingOp(tec),
      tecTerminal: tec.length > 0 && !hasFormalPendingOp(tec),
      acabMeta: sumBy(acab, 'target'),
      acabDone: sumBy(acab, 'done'),
      acabRemaining: sumBy(acab, 'remaining'),
      acabFormalPending: hasFormalPendingOp(acab),
      acabTerminal: acab.length > 0 && !hasFormalPendingOp(acab),
      expedicaoLiberado: expedicaoLiberado,
      expedicaoEntregue: expedicaoEntregue,
      expedicaoSaldo: round2(Math.max(expedicaoLiberado - expedicaoEntregue, 0)),
      hasExpedicaoData: hasExpedicaoData,
      totalRota: totalRota,
      entregueRota: entregueRota,
    };
  }

  // -------------------------------------------------------------------
  // Estagios. Cada rota emite APENAS os seus; `acabamento` nunca aparece
  // numa secao Manta e a Manta liga Tecelagem direto a Expedicao.
  // -------------------------------------------------------------------
  function buildInsumosStage(m, chainState, fmt) {
    return {
      key: 'insumos',
      label: 'INSUMOS',
      color: '#2563eb',
      percent: m.insumoPercent,
      state: stageState(m.insumoPercent, m.insumoPedidoKg, Math.max(m.insumoPedidoKg - m.insumoRecebidoKg, 0), m.insumoRecebidoKg, false),
      sublabel: m.insumoPercent >= 100 ? 'concluido' : (m.insumoPedidoKg > 0 ? fmt.kg(m.insumoRecebidoKg) : 'aguardando'),
      transfer: {
        title: m.linkedOpCount ? 'Registrar recebimento de insumos' : 'Gerar primeira OP',
        connectorLabel: m.linkedOpCount ? 'Receber' : 'Iniciar',
        allowWithoutOp: !m.linkedOpCount,
        forceActionConnector: !m.linkedOpCount,
        origem: 'Insumos',
        destino: 'Tecelagem',
        detalhe: m.linkedOpCount
          ? 'O recebimento de fio continua canonico na OP de tecelagem vinculada.'
          : 'Este pedido ainda nao possui OP de Tecelagem vinculada. Gere a primeira OP para iniciar o fluxo produtivo.',
        op: m.tecelagemSummaries.length ? m.tecelagemSummaries[0].op : null,
        docs: 'NF de compra e romaneio',
        action: chainState && chainState.actions ? chainState.actions.transferInsumosToTecelagem : null,
      },
    };
  }

  function buildTecelagemStage(m, chainState, fmt, isManta) {
    var percent = m.tecMeta > 0 ? clampPercent((m.tecDone / m.tecMeta) * 100) : 0;
    var mantaAction = chainState && chainState.actions ? chainState.actions.registrarSaidaManta : null;
    return {
      key: 'tecelagem',
      label: 'TECELAGEM',
      color: '#2563eb',
      percent: percent,
      state: stageState(percent, m.tecMeta, m.tecRemaining, m.tecDone, false),
      sublabel: m.tecRemaining > 0
        ? fmt.metros(m.tecRemaining)
        : (m.tecMeta > 0 ? (m.tecTerminal ? 'concluido' : 'entregue; finalizar OP') : 'aguardando'),
      transfer: isManta
        ? {
            title: 'Registrar saida medida',
            connectorLabel: 'Registrar',
            origem: 'Tecelagem',
            destino: 'Expedicao',
            detalhe: m.tecelagemSummaries.length
              ? 'A Manta vai direto da Tecelagem para a Expedicao; registre a saida medida na OP de origem.'
              : 'Nenhuma OP de tecelagem vinculada.',
            op: m.tecelagemSummaries.length ? m.tecelagemSummaries[0].op : null,
            docs: 'Romaneio e NF',
            action: mantaAction || (chainState && chainState.actions ? chainState.actions.transferTecelagemToAcabamento : null),
          }
        : {
            title: 'Transferir para Acabamento',
            connectorLabel: 'Transferir',
            origem: 'Tecelagem',
            destino: 'Acabamento',
            detalhe: m.tecelagemSummaries.length
              ? 'A mesma movimentacao da OP de origem deve ser usada aqui.'
              : 'Nenhuma OP de tecelagem vinculada.',
            op: m.tecelagemSummaries.length ? m.tecelagemSummaries[0].op : null,
            docs: 'Romaneio e NF',
            action: chainState && chainState.actions ? chainState.actions.transferTecelagemToAcabamento : null,
          },
    };
  }

  function buildAcabamentoStage(m, chainState, fmt, releaseExpedicaoAction) {
    var percent = m.acabMeta > 0 ? clampPercent((m.acabDone / m.acabMeta) * 100) : 0;
    return {
      key: 'acabamento',
      label: 'ACABAMENTO',
      color: '#e07b39',
      percent: percent,
      state: stageState(percent, m.acabMeta, m.acabRemaining, m.acabDone, false),
      sublabel: m.acabRemaining > 0
        ? fmt.metros(m.acabRemaining)
        : (m.acabMeta > 0 ? (m.acabTerminal ? 'concluido' : 'OP pendente') : 'aguardando'),
      transfer: {
        title: 'Movimentar para Expedicao',
        connectorLabel: 'Movimentar',
        origem: 'Acabamento',
        destino: 'Expedicao',
        detalhe: m.acabamentoSummaries.length
          ? 'Movimente para expedicao a quantidade recebida da tecelagem ainda disponivel; a finalizacao da OP continua separada.'
          : 'Nenhuma OP de acabamento vinculada.',
        op: releaseExpedicaoAction && releaseExpedicaoAction.op
          ? releaseExpedicaoAction.op
          : (m.acabamentoSummaries.length ? m.acabamentoSummaries[0].op : null),
        docs: 'NF de servico e romaneio',
        action: releaseExpedicaoAction,
      },
    };
  }

  function buildExpedicaoStage(m, chainState, fmt, isManta) {
    var prontoExpedicao = m.expedicaoSaldo;
    var base = m.hasExpedicaoData ? m.expedicaoLiberado : prontoExpedicao;
    var origemOp = isManta
      ? (m.tecelagemSummaries.length ? m.tecelagemSummaries[0].op : null)
      : (m.acabamentoSummaries.length ? m.acabamentoSummaries[0].op : null);
    return {
      key: 'expedicao',
      label: 'EXPEDICAO',
      color: '#2563eb',
      percent: m.totalRota > 0 ? clampPercent((base / m.totalRota) * 100) : 0,
      state: m.hasExpedicaoData && m.expedicaoSaldo <= 0 && m.expedicaoLiberado > 0 && prontoExpedicao <= 0
        ? 'done'
        : ((m.hasExpedicaoData && m.expedicaoLiberado > 0) || prontoExpedicao > 0 ? 'current' : 'future'),
      sublabel: m.hasExpedicaoData
        ? (m.expedicaoSaldo > 0 ? fmt.metros(m.expedicaoSaldo) : 'concluido')
        : (prontoExpedicao > 0 ? fmt.metros(prontoExpedicao) : 'aguardando'),
      transfer: {
        title: 'Registrar entrega',
        connectorLabel: 'Entregar',
        allowWithoutOp: true,
        origem: 'Expedicao',
        destino: 'Entrega',
        detalhe: m.hasExpedicaoData
          ? 'Abra a expedicao vinculada para registrar entrega/coleta.'
          : (isManta
            ? 'Libere a expedicao a partir da OP de tecelagem Manta.'
            : 'Libere a expedicao a partir da OP de acabamento.'),
        op: origemOp,
        docs: 'NF de expedicao',
        action: chainState && chainState.actions ? chainState.actions.registerDelivery : null,
      },
    };
  }

  function buildEntregaStage(m, fmt) {
    return {
      key: 'entrega',
      label: 'ENTREGA',
      color: '#18794a',
      percent: m.totalRota > 0 ? clampPercent((m.entregueRota / m.totalRota) * 100) : 0,
      state: m.entregueRota >= m.totalRota && m.totalRota > 0
        ? 'done'
        : (m.entregueRota > 0 ? 'current' : 'future'),
      sublabel: m.entregueRota > 0 ? fmt.metros(m.entregueRota) : 'aguardando',
      transfer: null,
    };
  }

  function buildStepperForRoute(m, route, chainState, fmt, releaseExpedicaoAction) {
    var api = routeApi();
    var isManta = api ? api.isManta(route) : route === 'manta';
    var stepper = [
      buildInsumosStage(m, chainState, fmt),
      buildTecelagemStage(m, chainState, fmt, isManta),
    ];
    if (!isManta) stepper.push(buildAcabamentoStage(m, chainState, fmt, releaseExpedicaoAction));
    stepper.push(buildExpedicaoStage(m, chainState, fmt, isManta));
    stepper.push(buildEntregaStage(m, fmt));

    // O estado derivado da matriz de cadeia so pode reescrever um estagio
    // que EXISTE nesta rota — a rota Manta nunca recebe `acabamento`.
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

    applyFormalPendingStage(stepper, 'tecelagem', m.tecMeta, m.tecRemaining, m.tecFormalPending, 'entregue; finalizar OP');
    if (!isManta) {
      applyFormalPendingStage(stepper, 'acabamento', m.acabMeta, m.acabRemaining, m.acabFormalPending, 'OP pendente');
    }

    if (chainState && chainState.tecPendingAcceptance) {
      stepper.forEach(function (stage) {
        if (stage.key === 'tecelagem') {
          stage.state = stage.state === 'done' ? 'current' : stage.state;
          stage.sublabel = 'OP pendente de aceite';
          return;
        }
        if (stage.key === 'insumos') {
          // Recebimento ocorreu, mas a transicao produtiva aguarda aceite
          // da OP; nao deve induzir que a cadeia esta fechada.
          stage.state = 'current';
          stage.sublabel = 'Recebido — aguardando aceite';
        }
      });
    }

    return stepper;
  }

  // input = {
  //   routes, opSummaries (com `route`), expedicoes, expedicaoItens,
  //   insumoOrdens, totalPedido, deliveredExactTotal, chainState,
  //   releaseExpedicaoAction, fmt: { metros, kg }
  // }
  // Retorna { sections, stepper } — `stepper` e o da PRIMEIRA secao, que
  // num Pedido homogeneo e exatamente a visao de hoje.
  function buildRouteSections(input) {
    var safe = input || {};
    var api = routeApi();
    var routes = Array.isArray(safe.routes) && safe.routes.length
      ? safe.routes.slice()
      : [api ? api.TAPETE : 'tapete'];
    var single = routes.length <= 1;
    var fmt = safe.fmt || {};
    var fmtSafe = {
      metros: typeof fmt.metros === 'function' ? fmt.metros : function (v) { return String(v); },
      kg: typeof fmt.kg === 'function' ? fmt.kg : function (v) { return String(v); },
    };

    var normalized = {
      routes: routes,
      opSummaries: safe.opSummaries || [],
      expedicoes: safe.expedicoes || [],
      expedicaoItens: safe.expedicaoItens || [],
      insumoOrdens: safe.insumoOrdens || [],
      totalPedido: safe.totalPedido,
      deliveredExactTotal: safe.deliveredExactTotal,
    };

    var sections = routes.map(function (route) {
      var metrics = computeRouteMetrics(normalized, route, single);
      return {
        route: route,
        label: api ? api.routeLabel(route) : route,
        stageKeys: api ? api.stageKeysForRoute(route) : ['insumos', 'tecelagem', 'acabamento', 'expedicao', 'entrega'],
        metrics: metrics,
        stepper: buildStepperForRoute(metrics, route, safe.chainState, fmtSafe, safe.releaseExpedicaoAction),
      };
    });

    return {
      sections: sections,
      stepper: sections.length ? sections[0].stepper : [],
      summary: buildPedidoSummaryMetrics(routes, normalized.opSummaries),
    };
  }

  // PHASE-MANTA-B2B-R2 (D4.4): semantica DOCUMENTAL por rota, extraida de
  // pedido-detail-progress.js (que ja excede o limite excepcional e nao
  // pode crescer — R-5). A regra: uma exigencia documental so pode citar
  // uma transicao que a rota REALMENTE tem.
  //   - Tapete/tecelagem: Tecelagem -> Acabamento (verbatim, inalterado).
  //   - Manta/tecelagem:  a rota nao tem Acabamento. O contrato documental
  //     existente nao define documento proprio para a saida medida, logo a
  //     pendencia e OMITIDA em vez de fabricada; nenhum tipo de documento
  //     novo e criado. A transicao real citada e Tecelagem -> Expedicao.
  //   - Acabamento (latex): NF de expedicao (verbatim, inalterado).
  function buildOpDocBanner(stageKey, route, done) {
    var moved = toFiniteNumber(done) > 0;
    if (stageKey !== 'tecelagem') {
      return moved
        ? { tone: 'danger', text: 'NF de expedicao pendente' }
        : { tone: 'neutral', text: 'Sem saida para expedicao registrada ainda' };
    }
    if (route === 'manta') {
      return moved
        ? { tone: 'neutral', text: 'Saida medida registrada; a rota Manta nao tem movimento para acabamento' }
        : { tone: 'neutral', text: 'Sem saida medida registrada ainda' };
    }
    return moved
      ? { tone: 'warning', text: 'Romaneio tecelagem -> acabamento pendente' }
      : { tone: 'neutral', text: 'Sem movimentacao para acabamento registrada ainda' };
  }

  // Linha documental operacional de uma OP, com a transicao correta da rota.
  function buildOpDocumentRow(summary) {
    var safe = summary || {};
    var moved = toFiniteNumber(safe.done) > 0;
    if (safe.stageKey === 'tecelagem' && safe.route === 'manta') {
      return {
        label: 'Movimento: Tecelagem -> Expedicao · ' + safe.label,
        status: 'pendente',
        meta: moved
          ? 'Saida medida registrada; a documentacao de saida e consolidada na expedicao vinculada.'
          : 'Sem saida medida registrada ainda.',
      };
    }
    if (safe.stageKey === 'tecelagem') {
      return {
        label: 'Movimento: Tecelagem -> Acabamento · ' + safe.label,
        status: 'pendente',
        meta: moved ? 'Romaneio/NF ainda nao consolidados na tela de pedido.' : 'Sem transferencia registrada ainda.',
      };
    }
    return {
      label: 'Movimento: Acabamento -> Expedicao · ' + safe.label,
      status: 'pendente',
      meta: moved ? 'Documentacao de saida ainda nao consolidada.' : 'Sem saida para expedicao registrada ainda.',
    };
  }

  // PHASE-MANTA-B2B-R2 (D4.2): metricas de nivel Pedido conscientes da
  // rota, para que a superficie nao apresente uma metrica de Acabamento
  // que nao se aplica.
  //   - `hasAcabamento`: alguma rota aplicavel tem o estagio Acabamento.
  //     Falso num Pedido Manta-only — a metrica agregada e SUPRIMIDA em
  //     vez de exibida como zero (zero afirma "nada em acabamento", o que
  //     implica que o estagio existe).
  //   - `mantaMedido`: saida medida da rota Manta, que e a metrica
  //     equivalente e VERDADEIRA daquela rota (nunca contada como
  //     Acabamento).
  // Num Pedido misto `hasAcabamento` e verdadeiro e o agregado de
  // Acabamento continua vindo SO das OPs de acabamento (`stageKey ===
  // 'acabamento'`, isto e, `ops.tipo='latex'`), portanto apenas de valores
  // Tapete por construcao; nenhum metro Manta entra nele.
  function buildPedidoSummaryMetrics(routes, opSummaries) {
    var api = routeApi();
    var list = Array.isArray(routes) && routes.length ? routes : [api ? api.TAPETE : 'tapete'];
    var hasAcabamento = list.some(function (route) {
      return api ? api.routeHasStage(route, 'acabamento') : route !== 'manta';
    });
    var mantaMedido = round2((opSummaries || []).reduce(function (acc, row) {
      if (!row || row.stageKey !== 'tecelagem' || row.route !== 'manta') return acc;
      return acc + toFiniteNumber(row.done);
    }, 0));
    return {
      routes: list.slice(),
      hasAcabamento: hasAcabamento,
      hasManta: list.indexOf('manta') !== -1,
      mantaMedido: mantaMedido,
    };
  }

  // Saldo movimentavel de uma OP de origem para a Expedicao, por item:
  // recebido (op_item acumulado) menos o ja movimentado. Puro, extraido
  // de pedido-detail-events.js (que nao pode crescer). Atribui a
  // expedicao pela ORIGEM real, nunca por op_latex_id presumido.
  // input = { op, expedicoes, expedicaoItens, targetMeters }
  function expedicaoLiberavelRows(input) {
    var safe = input || {};
    var op = safe.op;
    if (!op || !Array.isArray(op.op_itens)) return [];
    var api = routeApi();
    var expedicaoIds = {};
    (safe.expedicoes || []).forEach(function (expedicao) {
      var opId = api ? api.expedicaoSourceOpId(expedicao) : (expedicao && expedicao.op_latex_id);
      if (String(opId) === String(op.id)) expedicaoIds[expedicao.id] = true;
    });
    var liberadoByItem = {};
    (safe.expedicaoItens || []).forEach(function (item) {
      if (!expedicaoIds[item.expedicao_id]) return;
      liberadoByItem[item.op_item_id] = round2((liberadoByItem[item.op_item_id] || 0) + toFiniteNumber(item.metros_liberados));
    });
    var target = typeof safe.targetMeters === 'function'
      ? safe.targetMeters
      : function (opItem) { return round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos); };
    return op.op_itens.map(function (opItem) {
      var recebido = round2(target(opItem));
      var liberado = round2(toFiniteNumber(liberadoByItem[opItem.id]));
      return {
        opItem: opItem,
        recebido: recebido,
        liberado: liberado,
        saldo: round2(Math.max(recebido - liberado, 0)),
      };
    });
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoRouteSections = {
    expedicaoLiberavelRows: expedicaoLiberavelRows,
    buildRouteSections: buildRouteSections,
    buildPedidoSummaryMetrics: buildPedidoSummaryMetrics,
    buildOpDocBanner: buildOpDocBanner,
    buildOpDocumentRow: buildOpDocumentRow,
    buildStepperForRoute: buildStepperForRoute,
    computeRouteMetrics: computeRouteMetrics,
    stageState: stageState,
    applyFormalPendingStage: applyFormalPendingStage,
  };
})(window);
