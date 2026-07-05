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
      + ' stroke="' + (color || '#2563eb') + '" stroke-width="2"'
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
  function buildStepNode(step, index, progress, dtoStep, totalSteps) {
    var currentIndex = progress.currentIndex;
    var isException = progress.isException;
    var isLastStep = index === totalSteps - 1;

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

    var accentColor = isLastStep ? '#18794a' : '#2563eb';

    // Conector horizontal que vem do step anterior (top:20px = centro do circulo 42px)
    var connectorEl = null;
    if (index > 0) {
      var connBlue = (index <= currentIndex + 1)
        || (dtoStep && dtoStep.state === 'parcial' && dtoStep.percentual > 0);
      var connColor = connBlue ? '#2563eb' : '#e2e5ea';
      if (isException && index === currentIndex) connColor = '#fbbf24';
      connectorEl = window.el('div', {
        style: 'position:absolute;top:20px;left:-50%;width:100%;height:2px;background:'
          + connColor + ';z-index:0;',
      });
    }

    // Circulo interno
    var innerEl;
    if (estado === 'parcial') {
      innerEl = window.el('div', {
        style: 'width:30px;height:30px;border-radius:50%;background:#fff;'
          + 'display:flex;align-items:center;justify-content:center;'
          + 'font-weight:700;font-size:13px;color:' + accentColor + ';',
      }, String(index + 1));
    } else if (estado === 'concluido') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:50%;background:#2563eb;color:#fff;'
          + 'display:flex;align-items:center;justify-content:center;',
      }, svgCheck());
    } else if (estado === 'atual-excecao') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:50%;background:transparent;color:#fff;'
          + 'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;',
      }, '!');
    } else if (estado === 'atual') {
      innerEl = window.el('div', {
        style: 'width:32px;height:32px;border-radius:50%;background:#2563eb;color:#fff;'
          + 'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;',
      }, String(index + 1));
    } else {
      innerEl = window.el('div', {
        style: 'width:30px;height:30px;border-radius:50%;background:#fff;'
          + 'border:1.5px solid #dfe3e8;display:flex;align-items:center;justify-content:center;'
          + 'font-weight:600;font-size:13px;color:#9aa2af;',
      }, String(index + 1));
    }

    // Wrapper 42px (serve de container para o conector ficar em top:20px)
    var circleWrapStyle = 'width:42px;height:42px;border-radius:50%;display:flex;align-items:center;'
      + 'justify-content:center;position:relative;z-index:1;box-shadow:0 0 0 4px #fff;flex-shrink:0;';
    if (estado === 'parcial') {
      var pct2 = Math.min(Math.max(dtoStep.percentual, 0), 100);
      circleWrapStyle += 'background:conic-gradient(from -90deg, ' + accentColor
        + ' 0% ' + pct2 + '%, #dbeafe ' + pct2 + '%);';
    } else if (estado === 'atual-excecao') {
      circleWrapStyle += 'background:#f59e0b;';
    }
    var circleWrap = window.el('div', { style: circleWrapStyle }, innerEl);

    // Label
    var labelColor, labelWeight;
    if (estado === 'concluido') {
      labelColor = '#475065'; labelWeight = '600';
    } else if (estado === 'parcial') {
      labelColor = accentColor; labelWeight = '700';
    } else if (estado === 'atual-excecao') {
      labelColor = '#b45309'; labelWeight = '700';
    } else if (estado === 'atual') {
      labelColor = '#2563eb'; labelWeight = '700';
    } else {
      labelColor = '#aab2bf'; labelWeight = '500';
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
        style: 'font-size:11px;color:#2563eb;font-weight:600;margin-top:2px;',
      }, 'em andamento');
    } else if (estado === 'atual-excecao') {
      sublabelEl = window.el('div', {
        style: 'font-size:11px;color:#d97706;font-weight:600;margin-top:2px;',
      }, 'excecao ativa');
    }

    return window.el('div', {
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
    var bgColor = '#f1f6fe';
    var borderColor = '#d7e6fb';
    var iconColor = '#2563eb';
    var textColor = '#2c4a78';

    if (progress.exception) {
      if (progress.exception.tom === 'danger') {
        bgColor = '#fee2e2'; borderColor = '#fca5a5';
        iconColor = '#dc2626'; textColor = '#7f1d1d';
      } else if (progress.exception.tom === 'warning') {
        bgColor = '#fef3c7'; borderColor = '#fcd34d';
        iconColor = '#d97706'; textColor = '#78350f';
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
      style: 'background:#fff;border:1px solid #fca5a5;border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'font-size:16px;font-weight:700;color:#16203a;margin-bottom:12px;',
      }, 'Acompanhamento do pedido'),
      window.el('div', {
        style: 'display:flex;align-items:center;gap:10px;background:#fee2e2;border:1px solid #fca5a5;border-radius:4px;padding:11px 16px;',
      },
        svgInfo('#dc2626'),
        window.el('span', {
          style: 'font-size:13.5px;color:#7f1d1d;font-weight:500;',
        }, api.getClienteTrackingMensagem(pedido))
      ),
      updatedLabel
        ? window.el('p', {
            style: 'font-size:12px;color:#ef4444;margin:12px 0 0;',
          }, updatedLabel)
        : null,
      progress.fallbackToRecebido
        ? window.el('p', {
            style: 'font-size:12px;color:#ef4444;opacity:0.8;margin:8px 0 0;',
          }, 'Sem status visual principal publicado antes do cancelamento.')
        : null
    );
  }

  function buildStepsComPercentual(api, pedido, itens, parciais) {
    if (!Array.isArray(itens) || !Array.isArray(parciais)) return null;
    if (typeof api.buildPedidoAcompanhamentoParcial !== 'function') return null;
    var acompanhamento = api.buildPedidoAcompanhamentoParcial(pedido, itens, parciais, { forCliente: true });
    return acompanhamento && Array.isArray(acompanhamento.steps) ? acompanhamento.steps : null;
  }

  function buildClientePedidoTrackingCard(pedido, itens, parciais, chainState) {
    if (!pedido) return window.el('div', {});

    var api = getTrackingApi();
    var exceptions = api && api.CLIENTE_TRACKING_EXCECOES;
    if (!api || !api.CLIENTE_TRACKING_STEPS || !exceptions) {
      return window.el('div', {
        style: 'background:#fff;border:1px solid #fef3c7;border-radius:4px;padding:16px 20px;margin-bottom:14px;color:#92400e;',
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

    var card = window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    });
    card.appendChild(window.el('div', {
      style: 'font-size:16px;font-weight:700;color:#16203a;margin-bottom:18px;',
    }, 'Acompanhamento do pedido'));

    var stepperRow = window.el('div', {
      style: 'display:flex;align-items:flex-start;padding:0 4px;',
    });
    for (var i = 0; i < api.CLIENTE_TRACKING_STEPS.length; i++) {
      var dtoStep = stepsComPercentual ? stepsComPercentual[i] : null;
      stepperRow.appendChild(
        buildStepNode(api.CLIENTE_TRACKING_STEPS[i], i, progress, dtoStep, totalSteps)
      );
    }

    card.appendChild(stepperRow);
    card.appendChild(buildBanner(api, trackingPedido, progress, hasParciais, chainState));
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoTracking = {
    buildClientePedidoTrackingCard: buildClientePedidoTrackingCard,
  };

  window.buildClientePedidoTrackingCard = buildClientePedidoTrackingCard;
})(window);
