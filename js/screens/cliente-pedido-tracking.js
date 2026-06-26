// =====================================================================
// === SCREENS: CLIENTE PEDIDO TRACKING ================================
// Componente visual de acompanhamento do pedido para o cliente B2B.
// Renderiza um stepper + banner de situacao usando o status visual
// publicado pelo admin em `pedidos.status_cliente_*`.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A +
//   RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A
// Escopo: componente puro de apresentacao, sem rota propria. Recebe
//   `pedido` (ja carregado por cliente-pedido-detail.js) e devolve um
//   node DOM. Nao consulta o Supabase, nao insere/atualiza/deleta
//   nada, nao chama Edge Function. Nao expoe dados internos de
//   producao, comerciais ou administrativos sensiveis.
//
//   Nesta fase, o componente passa a usar a taxonomia compartilhada de
//   `js/pedido-tracking-ui.js`. `pedido.status` permanece apenas como
//   fallback minimo e defensivo quando o status visual ainda nao foi
//   publicado.
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
        ? pedido.status_cliente_visual
        : null,
      status_cliente_excecao: pedido && pedido.status_cliente_excecao
        ? pedido.status_cliente_excecao
        : null,
      status_cliente_mensagem: pedido && pedido.status_cliente_mensagem
        ? pedido.status_cliente_mensagem
        : null,
      status_cliente_atualizado_em: pedido && pedido.status_cliente_atualizado_em
        ? pedido.status_cliente_atualizado_em
        : null,
    };
  }

  function buildToneClass(exception) {
    if (!exception) return 'bg-blue-50 border-blue-100 text-blue-800';
    if (exception.tom === 'danger') return 'bg-red-50 border-red-100 text-red-700';
    if (exception.tom === 'warning') return 'bg-amber-50 border-amber-100 text-amber-700';
    return 'bg-gray-50 border-gray-200 text-gray-700';
  }

  function buildProgressText(progress) {
    if (!progress) return 'Sem progresso visual definido.';
    if (progress.isException && progress.exception && progress.exception.key === 'cancelado') {
      return 'Fluxo visual encerrado.';
    }
    if (progress.currentIndex >= 0) {
      return 'Etapa ' + (progress.currentIndex + 1) + ' de ' + progress.totalSteps + '.';
    }
    return 'Aguardando atualizacao do status visual.';
  }

  function buildStepNode(step, index, progress) {
    var currentIndex = progress.currentIndex;
    var isException = progress.isException;
    var estado = index < currentIndex ? 'concluido' : (index === currentIndex ? 'atual' : 'futuro');
    if (isException && currentIndex >= 0 && index === currentIndex) {
      estado = 'atual-excecao';
    }

    var wrap = window.el('div', { class: 'flex-1 min-w-[88px] flex flex-col items-center relative px-1' });

    if (index > 0) {
      var corConector = index <= currentIndex ? 'bg-blue-600' : 'bg-gray-200';
      if (isException && index === currentIndex) corConector = 'bg-amber-400';
      wrap.appendChild(window.el('div', {
        class: 'absolute top-4 -left-1/2 w-full h-0.5 ' + corConector,
      }));
    }

    var circuloClasse = 'w-8 h-8 rounded-full flex items-center justify-center relative z-10 '
      + 'text-sm font-bold ring-4 ring-white ';
    var circuloConteudo;
    if (estado === 'concluido') {
      circuloClasse += 'bg-blue-600 text-white';
      circuloConteudo = 'OK';
    } else if (estado === 'atual-excecao') {
      circuloClasse += 'bg-amber-400 text-white shadow-[0_0_0_4px_rgba(251,191,36,0.18)]';
      circuloConteudo = '!';
    } else if (estado === 'atual') {
      circuloClasse += 'bg-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.18)]';
      circuloConteudo = String(index + 1);
    } else {
      circuloClasse += 'bg-white border-2 border-gray-200 text-gray-400';
      circuloConteudo = String(index + 1);
    }
    wrap.appendChild(window.el('div', { class: circuloClasse }, circuloConteudo));

    var labelClasse = 'mt-2 text-xs text-center leading-snug ';
    if (estado === 'concluido') labelClasse += 'text-gray-600 font-semibold';
    else if (estado === 'atual-excecao') labelClasse += 'text-amber-700 font-bold';
    else if (estado === 'atual') labelClasse += 'text-blue-700 font-bold';
    else labelClasse += 'text-gray-400 font-medium';
    wrap.appendChild(window.el('div', { class: labelClasse }, step.label));

    if (estado === 'atual') {
      wrap.appendChild(window.el('div', { class: 'text-[11px] text-blue-600 font-semibold mt-0.5' }, 'em andamento'));
    } else if (estado === 'atual-excecao') {
      wrap.appendChild(window.el('div', { class: 'text-[11px] text-amber-600 font-semibold mt-0.5' }, 'excecao ativa'));
    }

    return wrap;
  }

  function buildBanner(api, pedido, progress) {
    var label = api.getClienteTrackingStatusLabel(pedido);
    var mensagem = api.getClienteTrackingMensagem(pedido);
    var toneClass = buildToneClass(progress.exception);
    var updatedLabel = pedido && pedido.status_cliente_atualizado_em && window.fmtDataCurta
      ? 'Atualizado em ' + window.fmtDataCurta(pedido.status_cliente_atualizado_em)
      : null;

    return window.el('div', {
      class: 'rounded-lg border px-4 py-3 mt-6 ' + toneClass,
    },
    window.el('div', { class: 'flex flex-wrap items-center gap-2 mb-2' },
      window.el('span', { class: 'text-sm font-semibold' }, label),
      progress.exception
        ? window.el('span', { class: 'text-xs opacity-80' }, 'Excecao ativa')
        : null
    ),
    window.el('p', { class: 'text-sm' }, mensagem),
    window.el('p', { class: 'text-xs opacity-80 mt-2' }, buildProgressText(progress)),
    updatedLabel
      ? window.el('p', { class: 'text-xs opacity-70 mt-2' }, updatedLabel)
      : null,
    progress.fallbackToRecebido
      ? window.el('p', { class: 'text-xs opacity-70 mt-2' },
        'Status visual ainda nao publicado; exibindo fallback seguro.')
      : null);
  }

  function buildCanceladoCard(api, pedido, progress) {
    return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4 border border-red-100' },
      window.el('div', { class: 'text-base font-bold text-gray-900 mb-3' }, 'Acompanhamento do pedido'),
      window.el('div', { class: 'flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3' },
        window.el('span', { class: 'text-red-700 text-sm font-medium' },
          api.getClienteTrackingMensagem(pedido))
      ),
      pedido && pedido.status_cliente_atualizado_em && window.fmtDataCurta
        ? window.el('p', { class: 'text-xs text-red-500 mt-3' },
          'Atualizado em ' + window.fmtDataCurta(pedido.status_cliente_atualizado_em))
        : null,
      progress.fallbackToRecebido
        ? window.el('p', { class: 'text-xs text-red-400 mt-2' },
          'Sem status visual principal publicado antes do cancelamento.')
        : null
    );
  }

  function buildClientePedidoTrackingCard(pedido) {
    if (!pedido) return window.el('div', {});

    var api = getTrackingApi();
    var exceptions = api && api.CLIENTE_TRACKING_EXCECOES;
    if (!api || !api.CLIENTE_TRACKING_STEPS || !exceptions) {
      return window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4 border border-amber-200 text-amber-700' },
        'Tracking visual indisponivel no momento.');
    }

    var trackingPedido = buildTrackingPedido(pedido);
    var progress = api.getClienteTrackingProgress(trackingPedido);

    if (progress.exception && progress.exception.key === 'cancelado') {
      return buildCanceladoCard(api, trackingPedido, progress);
    }

    var card = window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' });
    card.appendChild(window.el('div', { class: 'text-base font-bold text-gray-900 mb-6' },
      'Acompanhamento do pedido'));

    var stepperRow = window.el('div', { class: 'flex flex-wrap items-start gap-y-6' });
    for (var i = 0; i < api.CLIENTE_TRACKING_STEPS.length; i++) {
      stepperRow.appendChild(buildStepNode(api.CLIENTE_TRACKING_STEPS[i], i, progress));
    }

    card.appendChild(stepperRow);
    card.appendChild(buildBanner(api, trackingPedido, progress));
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoTracking = {
    buildClientePedidoTrackingCard: buildClientePedidoTrackingCard,
  };

  window.buildClientePedidoTrackingCard = buildClientePedidoTrackingCard;
})(window);
