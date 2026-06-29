(function (window) {
  'use strict';

  var CLIENTE_PARCIAL_SITUACOES = Object.freeze([
    Object.freeze({ key: 'em_tecelagem', label: 'Em tecelagem', stepKey: 'tecelagem' }),
    Object.freeze({ key: 'em_acabamento', label: 'Em acabamento', stepKey: 'acabamento' }),
    Object.freeze({ key: 'pronto_retirada', label: 'Pronto para retirada', stepKey: 'expedicao' }),
    Object.freeze({ key: 'pronto_envio', label: 'Pronto para envio', stepKey: 'expedicao' }),
    Object.freeze({ key: 'em_transporte', label: 'Em transporte', stepKey: 'transporte' }),
    Object.freeze({ key: 'entregue', label: 'Entregue', stepKey: 'concluido' }),
    Object.freeze({ key: 'cancelado', label: 'Cancelado', stepKey: null }),
  ]);

  var CLIENTE_TRACKING_STEPS = Object.freeze([
    Object.freeze({ key: 'recebido', label: 'Recebido', frasePadrao: 'Seu pedido foi recebido.' }),
    Object.freeze({ key: 'confirmado', label: 'Confirmado', frasePadrao: 'Seu pedido foi confirmado para atendimento.' }),
    Object.freeze({ key: 'insumos', label: 'Insumos', frasePadrao: 'Seu pedido esta na etapa de insumos.', pulavel: true }),
    Object.freeze({ key: 'tecelagem', label: 'Tecelagem', frasePadrao: 'Seu pedido esta em tecelagem.' }),
    Object.freeze({ key: 'acabamento', label: 'Acabamento', frasePadrao: 'Seu pedido esta em acabamento.' }),
    Object.freeze({ key: 'expedicao', label: 'Expedição', frasePadrao: 'Seu pedido esta em expedicao.' }),
    Object.freeze({ key: 'transporte', label: 'Transporte', frasePadrao: 'Seu pedido esta em transporte.', pulavel: true }),
    Object.freeze({ key: 'concluido', label: 'Concluído', frasePadrao: 'Seu pedido foi concluido.' }),
  ]);

  var CLIENTE_TRACKING_EXCECOES = Object.freeze([
    Object.freeze({ key: 'aguardando_definicao', label: 'Aguardando definicao', tom: 'warning', frasePadrao: 'Seu pedido esta aguardando definicao.' }),
    Object.freeze({ key: 'aguardando_insumo', label: 'Aguardando insumo', tom: 'warning', frasePadrao: 'Seu pedido esta aguardando insumo.' }),
    Object.freeze({ key: 'pausado', label: 'Pausado', tom: 'neutral', frasePadrao: 'Seu pedido esta pausado no momento.' }),
    Object.freeze({ key: 'cancelado', label: 'Cancelado', tom: 'danger', frasePadrao: 'Seu pedido foi cancelado.' }),
  ]);

  var STEP_BY_KEY = Object.create(null);
  var EXCECAO_BY_KEY = Object.create(null);
  var STEP_INDEX_BY_KEY = Object.create(null);
  var PARCIAL_SITUACAO_BY_KEY = Object.create(null);

  CLIENTE_TRACKING_STEPS.forEach(function (step, index) {
    STEP_BY_KEY[step.key] = step;
    STEP_INDEX_BY_KEY[step.key] = index;
  });

  CLIENTE_TRACKING_EXCECOES.forEach(function (item) {
    EXCECAO_BY_KEY[item.key] = item;
  });

  CLIENTE_PARCIAL_SITUACOES.forEach(function (item) {
    PARCIAL_SITUACAO_BY_KEY[item.key] = item;
  });

  function normalizarTrackingKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function getClienteTrackingStep(key) {
    return STEP_BY_KEY[normalizarTrackingKey(key)] || null;
  }

  function getClienteTrackingException(key) {
    return EXCECAO_BY_KEY[normalizarTrackingKey(key)] || null;
  }

  function getClienteParcialSituacao(key) {
    return PARCIAL_SITUACAO_BY_KEY[normalizarTrackingKey(key)] || null;
  }

  function toFiniteNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function clampPercent(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 100) return 100;
    return Number(value.toFixed(2));
  }

  function calcularPercentual(metros, metrosTotal) {
    var total = toFiniteNumber(metrosTotal);
    if (total <= 0) return 0;
    return clampPercent((toFiniteNumber(metros) / total) * 100);
  }

  function somarMetrosItens(itens) {
    if (!Array.isArray(itens)) return 0;
    var total = 0;
    for (var i = 0; i < itens.length; i++) {
      total += toFiniteNumber(itens[i] && itens[i].metros);
    }
    return Number(total.toFixed(2));
  }

  function resolveMetrosTotal(pedido, itens) {
    var totalPedido = toFiniteNumber(pedido && pedido.metros_total);
    if (totalPedido > 0) return Number(totalPedido.toFixed(2));
    return somarMetrosItens(itens);
  }

  function sortParciais(parciais) {
    return (Array.isArray(parciais) ? parciais.slice() : []).sort(function (a, b) {
      var seqA = toFiniteNumber(a && a.sequencia);
      var seqB = toFiniteNumber(b && b.sequencia);
      if (seqA > 0 || seqB > 0) {
        if (seqA === 0) return 1;
        if (seqB === 0) return -1;
        if (seqA !== seqB) return seqA - seqB;
      }

      var dataA = String((a && (a.data_referencia || a.criado_em)) || '');
      var dataB = String((b && (b.data_referencia || b.criado_em)) || '');
      if (dataA !== dataB) return dataA.localeCompare(dataB);

      var idA = String((a && a.id) || '');
      var idB = String((b && b.id) || '');
      return idA.localeCompare(idB);
    });
  }

  function normalizeParciais(parciais, options) {
    var forCliente = !!(options && options.forCliente);
    var source = sortParciais(parciais);
    if (!forCliente) return source;
    return source.filter(function (parcial) {
      return parcial && parcial.visivel_cliente !== false;
    });
  }

  function buildParcialCodigo(parcial, index) {
    var seq = toFiniteNumber(parcial && parcial.sequencia);
    var base = seq > 0 ? seq : (index + 1);
    return 'P' + String(base).padStart(2, '0');
  }

  function deriveStatusVisualFromParciais(parciaisNormalizadas) {
    var bestStepKey = null;
    var bestIndex = -1;

    for (var i = 0; i < parciaisNormalizadas.length; i++) {
      var parcial = parciaisNormalizadas[i];
      var situacao = getClienteParcialSituacao(parcial && parcial.situacao);
      if (!situacao || !situacao.stepKey) continue;
      var idx = STEP_INDEX_BY_KEY[situacao.stepKey];
      if (typeof idx === 'number' && idx > bestIndex && toFiniteNumber(parcial && parcial.metros) > 0) {
        bestIndex = idx;
        bestStepKey = situacao.stepKey;
      }
    }

    return bestStepKey;
  }

  function buildDistribuicao(parciaisNormalizadas, metrosTotal, options) {
    var forCliente = !!(options && options.forCliente);
    var bySituacao = Object.create(null);
    var distribuicao = [];

    for (var i = 0; i < parciaisNormalizadas.length; i++) {
      var parcial = parciaisNormalizadas[i];
      var situacaoKey = normalizarTrackingKey(parcial && parcial.situacao);
      if (!situacaoKey) continue;
      if (situacaoKey === 'cancelado') continue;
      if (forCliente && parcial && parcial.visivel_cliente === false) continue;

      if (!bySituacao[situacaoKey]) {
        bySituacao[situacaoKey] = {
          situacao: situacaoKey,
          label: (getClienteParcialSituacao(situacaoKey) || { label: situacaoKey }).label,
          metros: 0,
        };
      }
      bySituacao[situacaoKey].metros += toFiniteNumber(parcial && parcial.metros);
    }

    Object.keys(bySituacao).forEach(function (situacaoKey) {
      var row = bySituacao[situacaoKey];
      row.metros = Number(row.metros.toFixed(2));
      row.percentual = calcularPercentual(row.metros, metrosTotal);
      distribuicao.push(row);
    });

    distribuicao.sort(function (a, b) {
      var stepA = getClienteParcialSituacao(a.situacao);
      var stepB = getClienteParcialSituacao(b.situacao);
      var idxA = stepA && stepA.stepKey ? STEP_INDEX_BY_KEY[stepA.stepKey] : 999;
      var idxB = stepB && stepB.stepKey ? STEP_INDEX_BY_KEY[stepB.stepKey] : 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.label.localeCompare(b.label);
    });

    return distribuicao;
  }

  function buildPartialStepMeters(distribuicao) {
    var stepMeters = Object.create(null);
    for (var i = 0; i < CLIENTE_TRACKING_STEPS.length; i++) {
      stepMeters[CLIENTE_TRACKING_STEPS[i].key] = 0;
    }

    for (var j = 0; j < distribuicao.length; j++) {
      var item = distribuicao[j];
      var situacao = getClienteParcialSituacao(item && item.situacao);
      if (!situacao || !situacao.stepKey) continue;
      stepMeters[situacao.stepKey] += toFiniteNumber(item && item.metros);
    }

    Object.keys(stepMeters).forEach(function (key) {
      stepMeters[key] = Number(stepMeters[key].toFixed(2));
    });

    return stepMeters;
  }

  function buildStepsFromPartialMode(progress, stepMeters, metrosTotal) {
    return CLIENTE_TRACKING_STEPS.map(function (step, index) {
      var metros = toFiniteNumber(stepMeters[step.key]);
      var state = 'futuro';

      if (progress.isException && progress.exception && progress.exception.key === 'cancelado' && progress.currentKey === step.key) {
        state = 'excecao';
      } else if (metros > 0) {
        state = 'parcial';
      } else if (progress.currentIndex >= 0 && index < progress.currentIndex) {
        state = 'concluido';
      } else if (progress.currentIndex >= 0 && index === progress.currentIndex) {
        state = progress.isException ? 'excecao' : 'atual';
      }

      return {
        key: step.key,
        label: step.label,
        state: state,
        percentual: calcularPercentual(metros, metrosTotal),
        metros: Number(metros.toFixed(2)),
      };
    });
  }

  function buildStepsFromTotalMode(progress, metrosTotal) {
    return CLIENTE_TRACKING_STEPS.map(function (step, index) {
      var state = 'futuro';
      var percentual = 0;

      if (progress.isException && progress.exception && progress.exception.key === 'cancelado' && progress.currentKey === step.key) {
        state = 'excecao';
      } else if (progress.currentIndex >= 0 && index < progress.currentIndex) {
        state = 'concluido';
        percentual = 100;
      } else if (progress.currentIndex >= 0 && index === progress.currentIndex) {
        state = progress.isException ? 'excecao' : 'atual';
        percentual = 100;
      }

      return {
        key: step.key,
        label: step.label,
        state: state,
        percentual: percentual,
        metros: percentual > 0 ? Number(toFiniteNumber(metrosTotal).toFixed(2)) : 0,
      };
    });
  }

  function buildParciaisDto(parciaisNormalizadas, metrosTotal, options) {
    var forCliente = !!(options && options.forCliente);
    var rows = [];

    for (var i = 0; i < parciaisNormalizadas.length; i++) {
      var parcial = parciaisNormalizadas[i];
      if (forCliente && parcial && parcial.visivel_cliente === false) continue;

      var metros = Number(toFiniteNumber(parcial && parcial.metros).toFixed(2));
      var situacaoKey = normalizarTrackingKey(parcial && parcial.situacao);
      var situacao = getClienteParcialSituacao(situacaoKey);

      rows.push({
        id: parcial && parcial.id ? parcial.id : null,
        codigo: buildParcialCodigo(parcial, rows.length),
        situacao: situacaoKey,
        label: situacao ? situacao.label : situacaoKey,
        metros: metros,
        percentual: calcularPercentual(metros, metrosTotal),
        dataReferencia: parcial && parcial.data_referencia ? parcial.data_referencia : null,
        titulo: parcial && parcial.titulo ? parcial.titulo : null,
        mensagemCliente: parcial && parcial.mensagem_cliente ? parcial.mensagem_cliente : null,
        visivelCliente: parcial ? parcial.visivel_cliente !== false : true,
      });
    }

    return rows;
  }

  function getPedidoMensagemPublicada(pedido) {
    if (!pedido || typeof pedido.status_cliente_mensagem !== 'string') return '';
    return pedido.status_cliente_mensagem.trim();
  }

  function resolveClienteTrackingStep(pedido) {
    var visualKey = pedido && pedido.status_cliente_visual;
    var step = getClienteTrackingStep(visualKey);
    return {
      fallbackToRecebido: !step,
      step: step || STEP_BY_KEY.recebido,
    };
  }

  function getClienteTrackingStatusLabel(pedido) {
    var excecao = getClienteTrackingException(pedido && pedido.status_cliente_excecao);
    if (excecao) return excecao.label;
    return resolveClienteTrackingStep(pedido).step.label;
  }

  function getClienteTrackingMensagem(pedido) {
    var mensagemPublicada = getPedidoMensagemPublicada(pedido);
    if (mensagemPublicada) return mensagemPublicada;

    var excecao = getClienteTrackingException(pedido && pedido.status_cliente_excecao);
    if (excecao) return excecao.frasePadrao;

    return resolveClienteTrackingStep(pedido).step.frasePadrao;
  }

  function getClienteTrackingProgress(pedido) {
    var excecao = getClienteTrackingException(pedido && pedido.status_cliente_excecao);
    var resolved = resolveClienteTrackingStep(pedido);
    var currentStep = excecao && excecao.key === 'cancelado' ? null : resolved.step;
    var currentIndex = currentStep ? STEP_INDEX_BY_KEY[currentStep.key] : -1;

    return {
      steps: CLIENTE_TRACKING_STEPS,
      exception: excecao,
      currentStep: currentStep,
      currentKey: currentStep ? currentStep.key : null,
      currentIndex: currentIndex,
      totalSteps: CLIENTE_TRACKING_STEPS.length,
      isException: !!excecao,
      isTerminal: !!(excecao && excecao.key === 'cancelado') || !!(currentStep && currentStep.key === 'concluido'),
      fallbackToRecebido: resolved.fallbackToRecebido,
    };
  }

  function buildPedidoAcompanhamentoParcial(pedido, itens, parciais, options) {
    var pedidoSafe = pedido || {};
    var itensSafe = Array.isArray(itens) ? itens : [];
    var parciaisNormalizadas = normalizeParciais(parciais, options);
    var metrosTotal = resolveMetrosTotal(pedidoSafe, itensSafe);
    var hasParciais = !!pedidoSafe.parcial_habilitado || parciaisNormalizadas.length > 0;
    var statusVisualParcial = hasParciais ? deriveStatusVisualFromParciais(parciaisNormalizadas) : null;
    var trackingPedido = {
      status_cliente_visual: statusVisualParcial || pedidoSafe.status_cliente_visual || null,
      status_cliente_excecao: pedidoSafe.status_cliente_excecao || null,
      status_cliente_mensagem: pedidoSafe.status_cliente_mensagem || null,
      status_cliente_atualizado_em: pedidoSafe.parcial_atualizado_em || pedidoSafe.status_cliente_atualizado_em || null,
    };
    var progress = getClienteTrackingProgress(trackingPedido);
    var distribuicao = buildDistribuicao(parciaisNormalizadas, metrosTotal, options);
    var stepMeters = buildPartialStepMeters(distribuicao);
    var parciaisDto = buildParciaisDto(parciaisNormalizadas, metrosTotal, options);
    var totalParcialVisivel = Number(distribuicao.reduce(function (acc, item) {
      return acc + toFiniteNumber(item && item.metros);
    }, 0).toFixed(2));
    var totalEntregue = Number(toFiniteNumber(stepMeters.concluido).toFixed(2));
    var steps = hasParciais
      ? buildStepsFromPartialMode(progress, stepMeters, metrosTotal)
      : buildStepsFromTotalMode(progress, metrosTotal);

    return {
      pedidoId: pedidoSafe.id || null,
      numero: pedidoSafe.numero != null ? pedidoSafe.numero : null,
      metrosTotal: metrosTotal,
      parcialHabilitado: hasParciais,
      statusVisual: progress.currentKey || resolveClienteTrackingStep(trackingPedido).step.key,
      statusModo: hasParciais ? 'parcial' : 'total',
      mensagemCliente: getClienteTrackingMensagem(trackingPedido),
      atualizadoEm: trackingPedido.status_cliente_atualizado_em || null,
      steps: steps,
      distribuicao: distribuicao,
      parciais: parciaisDto,
      totais: {
        pedido: metrosTotal,
        parcialVisivel: totalParcialVisivel,
        entregue: totalEntregue,
        pendente: Number(Math.max(metrosTotal - totalEntregue, 0).toFixed(2)),
      },
    };
  }

  var trackingApi = {
    CLIENTE_PARCIAL_SITUACOES: CLIENTE_PARCIAL_SITUACOES,
    CLIENTE_TRACKING_STEPS: CLIENTE_TRACKING_STEPS,
    CLIENTE_TRACKING_EXCECOES: CLIENTE_TRACKING_EXCECOES,
    getClienteParcialSituacao: getClienteParcialSituacao,
    getClienteTrackingStep: getClienteTrackingStep,
    getClienteTrackingException: getClienteTrackingException,
    getClienteTrackingStatusLabel: getClienteTrackingStatusLabel,
    getClienteTrackingMensagem: getClienteTrackingMensagem,
    getClienteTrackingProgress: getClienteTrackingProgress,
    buildPedidoAcompanhamentoParcial: buildPedidoAcompanhamentoParcial,
  };

  window.RavatexPedidoTracking = trackingApi;

  window.RAVATEX_PEDIDO_UI = window.RAVATEX_PEDIDO_UI || {};
  window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING = trackingApi;
})(window);
