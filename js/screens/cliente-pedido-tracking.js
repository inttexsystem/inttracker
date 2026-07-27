// =====================================================================
// === SCREENS: CLIENTE PEDIDO TRACKING ================================
// Componente visual de acompanhamento do pedido para o cliente B2B.
// Renderiza um stepper + banner de situacao usando o status visual
// publicado pelo admin em `pedidos.status_cliente_*`.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A +
//   RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A +
//   RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A +
//   RAVATEX-TAPETES-CLIENTE-DETAIL-MATCH-STANDALONE-CLAUDE
//   (redesign visual completo para igualar ao HTML standalone de
//   referencia: stepper inline com circulos 42px, conectores em
//   top:20px, conic-gradient nos steps parciais, check SVG nos
//   concluidos, banner azul flat com icone info)
// Escopo: componente puro de apresentacao, sem rota propria. Recebe
//   `pedido` (ja carregado por cliente-pedido-detail.js) e devolve um
//   node DOM. Nao consulta o Supabase, nao insere/atualiza/deleta
//   nada, nao chama Edge Function. Nao expoe dados internos de
//   producao, comerciais ou administrativos sensiveis.
//
//   `buildClientePedidoTrackingCard(pedido, itens, parciais)` aceita
//   `itens`/`parciais` como parametros opcionais. Quando ambos sao
//   arrays, o componente chama `buildPedidoAcompanhamentoParcial` para
//   obter `steps[].percentual` e exibir conic-gradient nas etapas com
//   situacao 'parcial'. Sem esses parametros, a renderizacao permanece
//   identica a anterior (compatibilidade com chamadas com 1 argumento).
//
// Carregar via <script src="js/screens/cliente-pedido-tracking.js"></script>
// no <head>, DEPOIS de js/pedido-tracking-ui.js e ANTES de
// js/screens/cliente-pedido-detail.js.
//
// Dependencias resolvidas em tempo de chamada:
//   - window.el (js/ui.js)
//   - window.fmtDataCurta (js/pedido-ui.js)
//   - window.RavatexPedidoTracking / window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING
//
// Compatibilidade: window.buildClientePedidoTrackingCard e
// window.RAVATEX_SCREENS.clientePedidoTracking ficam disponiveis
// para cliente-pedido-detail.js.
// =====================================================================

(function (window) {
  'use strict';

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function buildTrackingPedido(pedido) {
    return {
      status_cliente_visual: pedido && pedido.status_cliente_visual
        ? pedido.status_cliente_visual : null,
      status_cliente_excecao: pedido && pedido.status_cliente_excecao
        ? pedido.status_cliente_excecao : null,
      status_cliente_mensagem: pedido && pedido.status_cliente_mensagem
        ? pedido.status_cliente_mensagem : null,
      status_cliente_atualizado_em: pedido && pedido.status_cliente_atualizado_em
        ? pedido.status_cliente_atualizado_em : null,
    };
  }

  // Cria SVG via innerHTML. Gracioso em ambientes sem document (testes vm).
  function svgEl(markup) {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        var tmp = document.createElement('div');
        tmp.innerHTML = markup;
        return tmp.firstChild || window.el('span', {});
      }
    } catch (e) { /* ignore em sandbox de testes */ }
    return window.el('span', {});
  }

  function svgCheck() {
    return svgEl(
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"'
      + ' stroke="currentColor" stroke-width="3"'
      + ' stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="20 6 9 17 4 12"></polyline>'
      + '</svg>'
    );
  }

  function svgInfo(color) {
    return svgEl(
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"'
      + ' stroke="' + (color || 'var(--rv-accent-blue)') + '" stroke-width="2"'
      + ' stroke-linecap="round" stroke-linejoin="round"'
      + ' style="flex-shrink:0;">'
      + '<circle cx="12" cy="12" r="9"></circle>'
      + '<line x1="12" y1="11" x2="12" y2="16"></line>'
      + '<line x1="12" y1="8" x2="12.01" y2="8"></line>'
      + '</svg>'
    );
  }

  // Renderiza um no do stepper conforme o visual do standalone.
  // Anatomia: wrapper 42px (contem conector em top:20px) →
  //   circulo interno (32px done/atual ou 30px parcial/futuro) →
  //   label → sublabel opcional.
  // `index` continua sendo a posicao CANONICA da etapa na lista completa
  // (comparada com progress.currentIndex); displayIndex/displayCount sao a
  // posicao visual dentro do recorte da rota — a Manta omite `acabamento`,
  // entao as duas podem divergir sem quebrar o estado das etapas.
  //
  // D2: o NUMERO EXIBIDO e sempre `pos + 1` — a posicao local da rota, que
  // e contigua por construcao. Usar `index + 1` (o indice canonico) produzia
  // 1,2,3,4,6,7,8 numa Manta, com um buraco onde o Acabamento foi filtrado.
  // `prevReached` e calculado DENTRO da rota pelo chamador: o conector so e
  // azul quando a etapa anterior DESTA rota foi alcancada, nunca por
  // adjacencia canonica (que ligaria Tecelagem a Expedicao passando por um
  // Acabamento que a rota nao tem).
  function buildStepNode(step, index, progress, dtoStep, totalSteps, displayIndex, displayCount, prevReached) {
    var currentIndex = progress.currentIndex;
    var isException = progress.isException;
    var pos = typeof displayIndex === 'number' ? displayIndex : index;
    var total = typeof displayCount === 'number' ? displayCount : totalSteps;
    var isLastStep = pos === total - 1;
    var visibleNumber = String(pos + 1);

    var hasParcial = dtoStep
      && dtoStep.state === 'parcial'
      && Number.isFinite(dtoStep.percentual)
      && dtoStep.percentual > 0;

    var estado;
    if (hasParcial) {
      estado = 'parcial';
    } else if (dtoStep && dtoStep.state === 'concluido') {
      estado = 'concluido';
    } else if (dtoStep && dtoStep.state === 'atual') {
      estado = 'atual';
    } else if (dtoStep && dtoStep.state === 'futuro') {
      estado = 'futuro';
    } else if (isException && currentIndex >= 0 && index === currentIndex) {
      estado = 'atual-excecao';
    } else if (index < currentIndex) {
      estado = 'concluido';
    } else if (index === currentIndex) {
      estado = 'atual';
    } else {
      estado = 'futuro';
    }

    var accentColor = isLastStep ? 'var(--rv-signal-positive)' : 'var(--rv-accent-blue)';

    // Conector horizontal que vem do step anterior (top:20px = centro do circulo 42px)
    var connectorEl = null;
    if (pos > 0) {
      var connBlue = (typeof prevReached === 'boolean'
        ? prevReached
        : (index <= currentIndex + 1))
        || (dtoStep && dtoStep.state === 'parcial' && dtoStep.percentual > 0);
      var connColor = connBlue ? 'var(--rv-accent-blue)' : 'var(--rv-text-tertiary)';
      if (isException && index === currentIndex) connColor = 'var(--rv-signal-caution)';
      connectorEl = window.el('div', {
        style: 'position:absolute;top:20px;left:-50%;width:100%;height:2px;background:'
          + connColor + ';z-index:0;',
      });
    }

    // Circulo interno
    var innerEl;
    if (estado === 'parcial') {
      innerEl = window.el('div', {
        style: 'width:30px;height:30px;border-radius:var(--rv-radius-pill);background:var(--rv-surface);'
          + 'display:flex;align-items:center;justify-content:center;'
          + 'font-weight:700;font-size:13px;color:' + accentColor + ';',
      }, visibleNumber);
    } else if (estado === 'concluido') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:var(--rv-radius-pill);background:var(--rv-brand);color:var(--rv-text-on-brand);'
          + 'display:flex;align-items:center;justify-content:center;',
      }, svgCheck());
    } else if (estado === 'atual-excecao') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:var(--rv-radius-pill);background:transparent;color:var(--rv-text-on-brand);'
          + 'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;',
      }, '!');
    } else if (estado === 'atual') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:var(--rv-radius-pill);background:var(--rv-brand);color:var(--rv-text-on-brand);'
          + 'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;',
      }, visibleNumber);
    } else {
      innerEl = window.el('div', {
        style: 'width:30px;height:30px;border-radius:var(--rv-radius-pill);background:var(--rv-surface);'
          + 'border:1.5px solid var(--rv-border-soft);display:flex;align-items:center;justify-content:center;'
          + 'font-weight:600;font-size:13px;color:var(--rv-text-tertiary);',
      }, visibleNumber);
    }

    // Wrapper 42px (serve de container para o conector ficar em top:20px)
    var circleWrapStyle = 'width:42px;height:42px;border-radius:var(--rv-radius-pill);display:flex;align-items:center;'
      + 'justify-content:center;position:relative;z-index:1;box-shadow:0 0 0 4px var(--rv-surface);flex-shrink:0;';
    if (estado === 'parcial') {
      var pct2 = Math.min(Math.max(dtoStep.percentual, 0), 100);
      circleWrapStyle += 'background:conic-gradient(from -90deg, ' + accentColor
        + ' 0% ' + pct2 + '%, var(--rv-pill-info-bg) ' + pct2 + '%);';
    } else if (estado === 'atual-excecao') {
      circleWrapStyle += 'background:var(--rv-signal-caution);';
    }
    var circleWrap = window.el('div', { style: circleWrapStyle }, innerEl);

    // Label
    var labelColor, labelWeight;
    if (estado === 'concluido') {
      labelColor = 'var(--rv-text-primary)'; labelWeight = '600';
    } else if (estado === 'parcial') {
      labelColor = accentColor; labelWeight = '700';
    } else if (estado === 'atual-excecao') {
      labelColor = 'var(--rv-signal-caution)'; labelWeight = '700';
    } else if (estado === 'atual') {
      labelColor = 'var(--rv-accent-blue)'; labelWeight = '700';
    } else {
      labelColor = 'var(--rv-text-tertiary)'; labelWeight = '500';
    }
    var labelEl = window.el('div', {
      style: 'margin-top:9px;font-size:12px;color:' + labelColor
        + ';font-weight:' + labelWeight + ';text-align:center;line-height:1.3;',
    }, step.label);

    // Sublabel
    var sublabelEl = null;
    if (estado === 'parcial') {
      sublabelEl = window.el('div', {
        style: 'font-size:11px;color:' + accentColor + ';margin-top:2px;font-weight:600;',
      }, 'parcial');
    } else if (estado === 'atual') {
      sublabelEl = window.el('div', {
        style: 'font-size:11px;color:var(--rv-accent-blue);font-weight:600;margin-top:2px;',
      }, 'em andamento');
    } else if (estado === 'atual-excecao') {
      sublabelEl = window.el('div', {
        style: 'font-size:11px;color:var(--rv-signal-caution);font-weight:600;margin-top:2px;',
      }, 'excecao ativa');
    }

    return window.el('div', {
      'data-rv-step-key': step.key,
      'data-rv-step-number': visibleNumber,
      'data-rv-step-canonical': String(index),
      style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;position:relative;padding:0 4px;',
    },
      connectorEl,
      circleWrap,
      labelEl,
      sublabelEl
    );
  }

  // Banner abaixo do stepper, estilo info azul flat conforme standalone.
  // Mantém: getClienteTrackingStatusLabel, updatedAt e fallbackToRecebido
  // para compatibilidade com testes vm existentes.
  function buildBanner(api, pedido, progress, hasParciais, chainState) {
    var statusLabel = chainState && chainState.displayStatus
      ? chainState.displayStatus
      : api.getClienteTrackingStatusLabel(pedido);
    var mensagem = chainState && chainState.mensagem
      ? chainState.mensagem
      : (chainState && chainState.displayStatus
        ? 'Seu pedido esta em ' + chainState.displayStatus.toLowerCase() + '.'
        : api.getClienteTrackingMensagem(pedido));
    var bgColor = 'var(--rv-pill-info-bg)';
    var borderColor = 'var(--rv-pill-info-border)';
    var iconColor = 'var(--rv-accent-blue)';
    var textColor = 'var(--rv-accent-blue)';

    if (progress.exception) {
      if (progress.exception.tom === 'danger') {
        bgColor = 'var(--rv-surface)'; borderColor = 'var(--rv-signal-negative-border)';
        iconColor = 'var(--rv-signal-negative)'; textColor = 'var(--rv-signal-negative)';
      } else if (progress.exception.tom === 'warning') {
        bgColor = 'var(--rv-signal-caution-bg)'; borderColor = 'var(--rv-signal-caution-border)';
        iconColor = 'var(--rv-signal-caution)'; textColor = 'var(--rv-signal-caution)';
      }
    }

    var texto = (statusLabel ? statusLabel + '. ' : '') + (mensagem || '');
    if (hasParciais && !progress.exception) {
      if (texto && !texto.endsWith('.')) texto += '.';
      texto += ' O anel indica a proporção da metragem em cada etapa.';
    }

    var updatedLabel = pedido && pedido.status_cliente_atualizado_em && window.fmtDataCurta
      ? 'Atualizado em ' + window.fmtDataCurta(pedido.status_cliente_atualizado_em)
      : null;

    return window.el('div', {
      style: 'display:flex;flex-direction:column;background:' + bgColor
        + ';border:1px solid ' + borderColor
        + ';border-radius:4px;padding:11px 16px;margin-top:20px;',
    },
      window.el('div', { style: 'display:flex;gap:11px;align-items:center;' },
        svgInfo(iconColor),
        window.el('span', {
          style: 'font-size:13.5px;color:' + textColor + ';font-weight:500;',
        }, texto)
      ),
      updatedLabel
        ? window.el('p', {
            style: 'font-size:12px;opacity:0.7;margin:8px 0 0;color:' + textColor + ';',
          }, updatedLabel)
        : null,
      progress.fallbackToRecebido
        ? window.el('p', {
            style: 'font-size:12px;opacity:0.7;margin:8px 0 0;color:' + textColor + ';',
          }, 'Status visual ainda nao publicado; exibindo fallback seguro.')
        : null
    );
  }

  function buildCanceladoCard(api, pedido, progress) {
    var updatedLabel = pedido && pedido.status_cliente_atualizado_em && window.fmtDataCurta
      ? 'Atualizado em ' + window.fmtDataCurta(pedido.status_cliente_atualizado_em)
      : null;
    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:12px;',
      }, 'Acompanhamento do pedido'),
      window.el('div', {
        style: 'display:flex;align-items:center;gap:10px;background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);border-radius:4px;padding:11px 16px;',
      },
        svgInfo('var(--rv-signal-negative)'),
        window.el('span', {
          style: 'font-size:13.5px;color:var(--rv-signal-negative);font-weight:500;',
        }, api.getClienteTrackingMensagem(pedido))
      ),
      updatedLabel
        ? window.el('p', {
            style: 'font-size:12px;color:var(--rv-signal-negative);margin:12px 0 0;',
          }, updatedLabel)
        : null,
      progress.fallbackToRecebido
        ? window.el('p', {
            style: 'font-size:12px;color:var(--rv-signal-negative);opacity:0.8;margin:8px 0 0;',
          }, 'Sem status visual principal publicado antes do cancelamento.')
        : null
    );
  }

  // Recorte das etapas do cliente aplicavel as rotas do Pedido. Sem rota
  // conhecida a lista canonica completa e mantida (comportamento legado).
  function applicableSteps(api, routes) {
    if (typeof api.getClienteTrackingStepsForRoutes !== 'function') return api.CLIENTE_TRACKING_STEPS.slice();
    if (!Array.isArray(routes) || !routes.length) return api.CLIENTE_TRACKING_STEPS.slice();
    return api.getClienteTrackingStepsForRoutes(routes);
  }

  // D1: SECOES POR ROTA. Um Pedido misto rende duas secoes independentes,
  // nunca a uniao das rotas num stepper unico. Degrada para uma unica
  // secao (a lista canonica) quando a API de secoes nao esta disponivel,
  // preservando exatamente a apresentacao legada do Tapete.
  function applicableSections(api, routes) {
    if (typeof api.getClienteTrackingSectionsForRoutes === 'function') {
      return api.getClienteTrackingSectionsForRoutes(routes);
    }
    var steps = applicableSteps(api, routes);
    return [{
      route: null,
      label: null,
      steps: steps.map(function (step, index) {
        return { step: step, key: step.key, displayIndex: index, displayCount: steps.length };
      }),
    }];
  }

  // Estado de uma etapa DENTRO da rota, para decidir a cor do conector
  // seguinte. Espelha exatamente a precedencia de `buildStepNode`, sem
  // duplicar a construcao do no.
  function stepReached(entry, canonicalIndex, progress, dtoStep) {
    if (dtoStep && dtoStep.state === 'parcial' && Number.isFinite(dtoStep.percentual) && dtoStep.percentual > 0) return true;
    if (dtoStep && dtoStep.state === 'concluido') return true;
    if (dtoStep && dtoStep.state === 'atual') return true;
    if (dtoStep && dtoStep.state === 'futuro') return false;
    return progress.currentIndex >= 0 && canonicalIndex <= progress.currentIndex;
  }

  function buildStepsComPercentual(api, pedido, itens, parciais) {
    if (!Array.isArray(itens) || !Array.isArray(parciais)) return null;
    if (typeof api.buildPedidoAcompanhamentoParcial !== 'function') return null;
    var acompanhamento = api.buildPedidoAcompanhamentoParcial(pedido, itens, parciais, { forCliente: true });
    return acompanhamento && Array.isArray(acompanhamento.steps) ? acompanhamento.steps : null;
  }

  function buildClientePedidoTrackingCard(pedido, itens, parciais, chainState, routes) {
    if (!pedido) return window.el('div', {});

    var api = getTrackingApi();
    var exceptions = api && api.CLIENTE_TRACKING_EXCECOES;
    if (!api || !api.CLIENTE_TRACKING_STEPS || !exceptions) {
      return window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;color:var(--rv-signal-caution);',
      }, 'Tracking visual indisponivel no momento.');
    }

    var trackingPedido = buildTrackingPedido(pedido);
    var progress = api.getClienteTrackingProgress(trackingPedido);

    if (progress.exception && progress.exception.key === 'cancelado') {
      return buildCanceladoCard(api, trackingPedido, progress);
    }

    var stepsComPercentual = chainState && Array.isArray(chainState.clientSteps)
      ? chainState.clientSteps
      : buildStepsComPercentual(api, pedido, itens, parciais);
    var hasParciais = Array.isArray(parciais) && parciais.length > 0;
    var totalSteps = api.CLIENTE_TRACKING_STEPS.length;

    // PHASE-MANTA-B2B: a FORMA das etapas vem da rota derivada
    // (`modelos.tipo_produto`): Manta omite `acabamento`, Tapete mantem.
    // PHASE-MANTA-B2B-R2 (D1): um Pedido misto passa a render DUAS secoes
    // independentes — a uniao num stepper unico era o defeito. O dto de
    // percentual e casado por CHAVE, e apenas dentro da rota que possui
    // aquela chave, nunca por posicao (as listas tem tamanhos diferentes).
    var effectiveRoutes = (chainState && Array.isArray(chainState.routes) && chainState.routes.length)
      ? chainState.routes
      : routes;
    var sections = applicableSections(api, effectiveRoutes);
    var dtoByKey = {};
    (stepsComPercentual || []).forEach(function (dto) {
      if (dto && dto.key != null) dtoByKey[dto.key] = dto;
    });

    function canonicalIndexOf(key, fallback) {
      return typeof api.getClienteTrackingStepIndex === 'function'
        ? api.getClienteTrackingStepIndex(key)
        : fallback;
    }

    function buildStepperRow(section) {
      var entries = section.steps || [];
      var row = window.el('div', {
        'data-rv-client-stepper': section.route || 'legado',
        style: 'display:flex;align-items:flex-start;padding:0 4px;',
      });
      var prevReached = false;
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var canonicalIndex = canonicalIndexOf(entry.key, i);
        var dtoStep = dtoByKey[entry.key] || null;
        row.appendChild(buildStepNode(
          entry.step, canonicalIndex, progress, dtoStep, totalSteps,
          i, entries.length, i === 0 ? false : prevReached
        ));
        prevReached = stepReached(entry, canonicalIndex, progress, dtoStep);
      }
      return row;
    }

    // Posicao LOCAL de cada rota, para que a secao declare o proprio
    // estado sem exibir uma etapa que a rota nao possui.
    sections.forEach(function (section) {
      if (typeof api.getClienteTrackingRoutePosition !== 'function') return;
      var pos = api.getClienteTrackingRoutePosition(section.steps, progress.currentIndex);
      var entries = section.steps || [];
      var reached = pos.reachedDisplayIndex >= 0 ? entries[pos.reachedDisplayIndex] : null;
      var next = pos.nextDisplayIndex >= 0 ? entries[pos.nextDisplayIndex] : null;
      section.position = {
        reachedLabel: reached && reached.step ? reached.step.label : null,
        nextLabel: next && next.step ? next.step.label : null,
      };
    });

    var card = window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    });
    card.appendChild(window.el('div', {
      style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:18px;',
    }, 'Acompanhamento do pedido'));

    var sectionsUi = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.clienteRouteSectionsUi;
    if (sectionsUi && typeof sectionsUi.buildClienteRouteSectionsNode === 'function') {
      card.appendChild(sectionsUi.buildClienteRouteSectionsNode(sections, {
        buildStepperRow: buildStepperRow,
      }));
    } else {
      // Degradacao sem o modulo de arranjo: uma secao por rota, ainda
      // separada — nunca a uniao num stepper unico.
      sections.forEach(function (section) {
        card.appendChild(window.el('div', { 'data-rv-client-route-section': section.route || 'legado' },
          buildStepperRow(section)));
      });
    }
    card.appendChild(buildBanner(api, trackingPedido, progress, hasParciais, chainState));
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoTracking = {
    buildClientePedidoTrackingCard: buildClientePedidoTrackingCard,
  };

  window.buildClientePedidoTrackingCard = buildClientePedidoTrackingCard;
})(window);
