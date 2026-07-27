(function (window) {
  'use strict';

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function normalizeOptionalText(value) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function exceptionToneClass(tom) {
    if (tom === 'danger') return 'bg-red-100 text-red-700 border-red-200';
    if (tom === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }

  function buildProgressText(progress) {
    if (!progress) return 'Sem progresso visual definido.';
    if (progress.isException && progress.exception && progress.exception.key === 'cancelado') {
      return 'Fluxo visual encerrado.';
    }
    if (progress.currentIndex >= 0) {
      return 'Etapa ' + (progress.currentIndex + 1) + ' de ' + progress.totalSteps + '.';
    }
    return 'Sem etapa principal ativa.';
  }

  function buildPreviewCard(api, pedido) {
    var progress = api.getClienteTrackingProgress(pedido);
    var label = api.getClienteTrackingStatusLabel(pedido);
    var mensagem = api.getClienteTrackingMensagem(pedido);
    var exception = progress.exception;

    var toneClass = exception
      ? exceptionToneClass(exception.tom)
      : 'bg-blue-100 text-blue-700 border-blue-200';

    var wrap = window.el('div', {
      style: 'border-radius:var(--rv-radius);', class: 'border border-dashed border-gray-300 bg-gray-50 p-4',
    });

    wrap.appendChild(window.el('div', { class: 'text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2' },
      'Preview do cliente'
    ));

    wrap.appendChild(window.el('div', { class: 'flex flex-wrap items-center gap-2 mb-2' },
      window.el('span', {
        'data-ui-pill': '1', style: 'border-radius:var(--rv-radius-pill);', class: 'inline-flex items-center border px-3 py-1 text-xs font-semibold ' + toneClass,
      }, label),
      exception
        ? window.el('span', { class: 'text-xs text-gray-500' }, 'Excecao ativa')
        : null
    ));

    wrap.appendChild(window.el('p', { class: 'text-sm text-gray-800 mb-2' }, mensagem));
    wrap.appendChild(window.el('p', { class: 'text-xs text-gray-500' }, buildProgressText(progress)));

    if (progress.fallbackToRecebido) {
      wrap.appendChild(window.el('p', { class: 'text-xs text-gray-400 mt-2' },
        'Sem status visual publicado ainda; preview usando fallback de recebido.'
      ));
    }

    return wrap;
  }

  function buildEventPayload(api, pedido, formState) {
    var statusKey = formState.status_cliente_excecao || formState.status_cliente_visual;
    var label = api.getClienteTrackingStatusLabel(formState);
    var mensagem = api.getClienteTrackingMensagem(formState);
    var currentUserId = window.CURRENT_USER && window.CURRENT_USER.id
      ? window.CURRENT_USER.id
      : null;

    return {
      pedido_id: pedido.id,
      status: statusKey,
      titulo: label,
      mensagem: mensagem,
      origem: 'manual',
      visivel_cliente: true,
      criado_por: currentUserId,
      metadata: null,
    };
  }

  function buildPedidoTrackingAdminCard(options) {
    var pedido = options && options.pedido;
    var onReload = options && options.onReload;

    if (!pedido) return window.el('div', {});
    if (!window.CURRENT_USER || window.CURRENT_USER.tipo !== 'admin') {
      return window.el('div', {});
    }

    var api = getTrackingApi();
    if (!api) {
      return window.el('div', {
        style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-6 mb-4 border border-amber-200 text-amber-700',
      }, 'Taxonomia visual do cliente indisponivel.');
    }

    var resolved = api.getClienteTrackingProgress(pedido);
    var formState = {
      id: pedido.id,
      status_cliente_visual: (pedido.status_cliente_visual || resolved.currentKey || 'recebido'),
      status_cliente_excecao: pedido.status_cliente_excecao || '',
      status_cliente_mensagem: pedido.status_cliente_mensagem || '',
    };

    var statusOptions = api.CLIENTE_TRACKING_STEPS.map(function (step) {
      return { value: step.key, label: step.label };
    });
    var exceptionOptions = api.CLIENTE_TRACKING_EXCECOES.map(function (item) {
      return { value: item.key, label: item.label };
    });

    var card = window.el('div', { style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow p-6 mb-4' });
    card.appendChild(window.el('h2', { class: 'text-base font-bold text-gray-900 mb-1' },
      'Situacao visivel ao cliente'
    ));
    card.appendChild(window.el('p', { class: 'text-sm text-gray-500 mb-4' },
      'Publica a comunicacao externa do pedido sem alterar o status operacional.'
    ));

    var statusInput = window.selectInput({
      options: statusOptions,
      value: formState.status_cliente_visual,
      placeholder: 'Selecione uma etapa',
    });

    var exceptionInput = window.selectInput({
      options: exceptionOptions,
      value: formState.status_cliente_excecao,
      placeholder: 'Sem excecao',
    });

    // B1: the 110px Tailwind minimum becomes the canonical `tracking` role;
    // the border, radius, padding and focus ring move to css/tokens.css. The
    // value, the placeholder and syncFormState are unchanged.
    var mensagemInput = window.textArea({
      role: 'tracking',
      value: formState.status_cliente_mensagem,
      placeholder: 'Mensagem opcional para o cliente',
      ariaLabel: 'Mensagem',
    });

    var previewWrap = window.el('div', { class: 'mt-2' });
    var helperText = window.el('p', { class: 'text-xs text-gray-500 mt-2' },
      'Se a mensagem ficar vazia, o sistema usa a frase padrao da etapa ou da excecao.'
    );

    function syncFormState() {
      formState.status_cliente_visual = statusInput.value || 'recebido';
      formState.status_cliente_excecao = exceptionInput.value || '';
      formState.status_cliente_mensagem = mensagemInput.value || '';
    }

    function previewPedido() {
      return {
        status_cliente_visual: formState.status_cliente_visual,
        status_cliente_excecao: formState.status_cliente_excecao || null,
        status_cliente_mensagem: normalizeOptionalText(formState.status_cliente_mensagem),
      };
    }

    function renderPreview() {
      syncFormState();
      previewWrap.replaceChildren(buildPreviewCard(api, previewPedido()));
    }

    statusInput.addEventListener('change', renderPreview);
    exceptionInput.addEventListener('change', renderPreview);
    mensagemInput.addEventListener('input', renderPreview);

    var btnSalvar = window.el('button', {
      type: 'button',
      style: 'border-radius:var(--rv-radius);', class: 'px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold',
    }, 'Salvar situacao visivel');

    async function handleSave() {
      syncFormState();

      var updatePayload = {
        status_cliente_visual: formState.status_cliente_visual,
        status_cliente_excecao: formState.status_cliente_excecao || null,
        status_cliente_mensagem: normalizeOptionalText(formState.status_cliente_mensagem),
      };

      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';

      try {
        var updateRes = await window.supa
          .from('pedidos')
          .update(updatePayload)
          .eq('id', pedido.id);

        if (updateRes.error) {
          window.toast(
            'Erro ao salvar situacao visivel: ' + (updateRes.error.message || 'desconhecido'),
            'error'
          );
          console.error('pedido-tracking-admin: erro ao atualizar pedidos', updateRes.error);
          return;
        }

        var eventPayload = buildEventPayload(api, pedido, {
          status_cliente_visual: updatePayload.status_cliente_visual,
          status_cliente_excecao: updatePayload.status_cliente_excecao,
          status_cliente_mensagem: updatePayload.status_cliente_mensagem,
        });

        var insertRes = await window.supa
          .from('pedido_cliente_eventos')
          .insert(eventPayload);

        if (insertRes.error) {
          console.error('pedido-tracking-admin: erro ao inserir historico visual', insertRes.error);
          if (typeof onReload === 'function') {
            await onReload();
          }
          window.toast(
            'Situacao visivel salva, mas o historico visual nao foi registrado.',
            'error'
          );
          return;
        }

        if (typeof onReload === 'function') {
          await onReload();
        }
        window.toast('Situacao visivel salva com sucesso.', 'success');
      } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar situacao visivel';
      }
    }

    btnSalvar.addEventListener('click', handleSave);

    card.appendChild(window.formField({
      label: 'Etapa principal',
      input: statusInput,
      hint: 'Usa a trilha visual compartilhada do cliente.',
    }));
    card.appendChild(window.formField({
      label: 'Excecao',
      input: exceptionInput,
      hint: 'Opcional. Quando preenchida, o preview e o evento priorizam a excecao.',
    }));
    card.appendChild(window.formField({
      label: 'Mensagem',
      input: mensagemInput,
      hint: 'Opcional. Se ficar vazia, o sistema usa a frase padrao.',
    }));
    card.appendChild(previewWrap);
    card.appendChild(helperText);
    card.appendChild(window.el('div', { class: 'mt-4 flex justify-end' }, btnSalvar));

    renderPreview();
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoTrackingAdmin = {
    buildPedidoTrackingAdminCard: buildPedidoTrackingAdminCard,
  };

  window.buildPedidoTrackingAdminCard = buildPedidoTrackingAdminCard;
})(window);
