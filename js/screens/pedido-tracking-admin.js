// =====================================================================
// === SCREENS: PEDIDO TRACKING ADMIN ==================================
// Card administrativo "Situacao visivel ao cliente" do detalhe do Pedido.
//
// SCREEN-GROUP-2 — CONSOLIDACAO VISUAL.
// Este card declarava a superficie por utilitarios Tailwind
// (`bg-white shadow p-6 mb-4`): uma elevacao FORA do enum ratificado, sem
// `--rv-border`, e invisivel ao detector porque nenhuma declaracao inline
// existia para ele ler. Todo o resto do detalhe do Pedido ja fala a lingua
// do token — `background:var(--rv-surface)`, `1px solid var(--rv-border)`,
// `var(--rv-radius)`, `padding:16px 20px`, `margin-bottom:14px` — entao o
// mesmo empilhamento mostrava dois cartoes diferentes. A geometria passa a
// ser a MESMA das demais secoes da tela que hospeda este card.
//
// PRESERVADO INTEGRALMENTE: o ciclo de vida, a transicao, a permissao
// (somente `tipo === 'admin'`), o payload de `pedidos`, o evento de
// `pedido_cliente_eventos`, a ordem das acoes, os textos e a rota.
//
// DIVULGADO: `buildPedidoTrackingAdminCard` e exportado e e alcancado por
// `pedido-detail-events.js::buildTrackingAdmin()`, mas NENHUM chamador
// invoca esse handler hoje — a superficie nao e montada por nenhuma tela.
// A consolidacao acima e visual; religar ou aposentar a superficie e uma
// decisao de produto e NAO foi feita aqui.
// =====================================================================

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

    // A caixa de PREVIEW e uma superficie encaixada, nao um cartao proprio: o
    // tracejado e o fundo rebaixado agora saem dos tokens de superficie em vez
    // do par Tailwind gray-300/gray-50. Os TONS SEMANTICOS das pilulas abaixo
    // NAO sao tocados — eles pertencem ao dono canonico de badge e mexer neles
    // seria mudanca de semantica de cor, nao consolidacao de cartao.
    var wrap = window.el('div', {
      style: 'background:var(--rv-surface-subtle);border:1px dashed var(--rv-border-strong);border-radius:var(--rv-radius);padding:14px 16px;margin-top:12px;',
    });

    wrap.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;',
    }, 'Preview do cliente'));

    wrap.appendChild(window.el('div', {
      style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;',
    },
      window.el('span', {
        'data-ui-pill': '1', style: 'border-radius:var(--rv-radius-pill);', class: 'inline-flex items-center border px-3 py-1 text-xs font-semibold ' + toneClass,
      }, label),
      exception
        ? window.el('span', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);' }, 'Excecao ativa')
        : null
    ));

    wrap.appendChild(window.el('p', {
      style: 'margin:0 0 8px;font-size:13px;color:var(--rv-text-primary);line-height:1.5;',
    }, mensagem));
    wrap.appendChild(window.el('p', {
      style: 'margin:0;font-size:11.5px;color:var(--rv-text-tertiary);',
    }, buildProgressText(progress)));

    if (progress.fallbackToRecebido) {
      wrap.appendChild(window.el('p', {
        style: 'margin:8px 0 0;font-size:11.5px;color:var(--rv-text-tertiary);',
      }, 'Sem status visual publicado ainda; preview usando fallback de recebido.'));
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
      // O estado de indisponibilidade usa a MESMA caixa das demais secoes e
      // os sinais canonicos de atencao, no lugar do par Tailwind
      // amber-200/amber-700, que nao pertence a nenhum token.
      return window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-caution-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:16px 20px;margin-bottom:14px;font-size:13.5px;color:var(--rv-signal-caution);',
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

    var card = window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:16px 20px;margin-bottom:14px;',
    });
    // O titulo da secao e um COMPONENT_HEADING e o subtitulo um texto de
    // apoio: ambos passam a consumir os tokens de tipografia que o resto do
    // detalhe do Pedido ja usa, no lugar de `text-base`/`text-sm` e das
    // escalas de cinza do Tailwind.
    card.appendChild(window.el('h2', {
      style: 'margin:0;font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
    }, 'Situacao visivel ao cliente'));
    card.appendChild(window.el('p', {
      style: 'margin:6px 0 14px;font-size:13px;color:var(--rv-text-secondary);line-height:1.5;',
    }, 'Publica a comunicacao externa do pedido sem alterar o status operacional.'));

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

    var previewWrap = window.el('div', {});
    var helperText = window.el('p', {
      style: 'margin:10px 0 0;font-size:11.5px;color:var(--rv-text-tertiary);line-height:1.45;',
    }, 'Se a mensagem ficar vazia, o sistema usa a frase padrao da etapa ou da excecao.');

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

    // Acao dominante da secao, na MESMA lingua do `buildFooterAction`
    // primario do detalhe do Pedido: var(--rv-brand) sobre
    // var(--rv-text-on-brand). A rampa Tailwind bg-blue-700 pintava um azul
    // que nenhum token declara e que divergia do azul primario que a mesma
    // pagina ja mostrava logo acima.
    var btnSalvar = window.el('button', {
      type: 'button',
      style: 'display:inline-flex;align-items:center;justify-content:center;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);height:var(--rv-h-primary);padding:0 16px;font-size:var(--rv-fs-body);font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;',
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
    // SCREEN-GROUP-2 — CONTENCAO LOCAL DA ACAO (ACTION-CONTAINMENT-A1).
    // A A1 cancelou a fase global A2 e mandou corrigir a contencao DENTRO de
    // cada batch de tela. Esta linha era `mt-4 flex justify-end`: um agrupador
    // Tailwind sem divisor, sem geometria declarada e invisivel a qualquer
    // guarda ancorada em texto de estilo. Passa a ser um STANDARD_ACTION_FOOTER
    // DECLARADO — `data-card-actions` — com a geometria canonica da passada 5:
    // acoes a direita, divisor superior e padding-top:11px como longhand.
    card.appendChild(window.el('div', {
      style: 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rv-border-soft);padding-top:11px;margin-top:14px;',
      'data-pedido-tracking-admin-actions': 'situacao',
      'data-card-actions': '',
    }, btnSalvar));

    renderPreview();
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoTrackingAdmin = {
    buildPedidoTrackingAdminCard: buildPedidoTrackingAdminCard,
  };

  window.buildPedidoTrackingAdminCard = buildPedidoTrackingAdminCard;
})(window);
