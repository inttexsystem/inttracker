// =====================================================================
// === SCREENS: PEDIDO PARCIAIS ADMIN ==================================
// Card administrativo "Parciais do pedido" do detalhe do Pedido.
//
// SCREEN-GROUP-2 — CONSOLIDACAO VISUAL, pelo mesmo motivo e com a mesma
// geometria de js/screens/pedido-tracking-admin.js: a superficie era um
// cartao Tailwind (`bg-white shadow p-6 mb-4`) — elevacao fora do enum
// ratificado, sem `--rv-border` e invisivel ao detector — empilhado na
// mesma tela que ja fala a lingua do token.
//
// PRESERVADO INTEGRALMENTE: a permissao (somente `tipo === 'admin'`), as
// tres validacoes de entrada (situacao obrigatoria, sequencia inteira
// positiva, metros > 0), o payload de `pedido_parciais`, a limpeza do
// formulario apos gravar, o recarregamento e a ordem das acoes. O contrato
// de tabela e a posse do scroll responsivo continuam inteiramente com
// `window.dataTable`, que nao e tocado aqui.
//
// DIVULGADO: como em pedido-tracking-admin.js, `buildPedidoParciaisAdminCard`
// e alcancado por `pedido-detail-events.js::buildParciaisAdmin()` e esse
// handler NAO tem chamador — a superficie nao e montada por nenhuma tela.
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

  function toFiniteNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMetros(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtPercentual(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toFixed(2).replace('.', ',') + '%';
  }

  function fmtData(value) {
    if (!value) return '—';
    if (window.fmtDataCurta) return window.fmtDataCurta(value);
    return String(value);
  }

  function buildSituacaoOptions(api) {
    var source = api && Array.isArray(api.CLIENTE_PARCIAL_SITUACOES)
      ? api.CLIENTE_PARCIAL_SITUACOES
      : [];

    return source.map(function (item) {
      return {
        value: item.key,
        label: item.label,
      };
    });
  }

  function buildPreview(api, pedido, itens, parciais) {
    if (!api || typeof api.buildPedidoAcompanhamentoParcial !== 'function') {
      return window.el('div', {});
    }

    var dto = api.buildPedidoAcompanhamentoParcial(pedido || {}, itens || [], parciais || [], {
      forCliente: false,
    });

    // Mesma caixa de PREVIEW encaixada de pedido-tracking-admin.js.
    var wrap = window.el('div', {
      style: 'background:var(--rv-surface-subtle);border:1px dashed var(--rv-border-strong);border-radius:var(--rv-radius);padding:14px 16px;margin-top:14px;',
    });

    wrap.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px;',
    }, 'Preview tecnico das parciais'));

    // `data-rv-metrics` e o dono ja aceito da adaptacao por largura desta
    // trinca de metricas; substitui o par de utilitarios responsivos
    // `grid-cols-1 sm:grid-cols-3`, que era o unico ponto da tela a decidir
    // largura por conta propria.
    wrap.appendChild(window.el('div', {
      'data-rv-metrics': '',
      style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;',
    },
      metric('Total do pedido', fmtMetros(dto.metrosTotal)),
      metric('Total parcial registrado', fmtMetros(dto.totais && dto.totais.parcialVisivel)),
      metric('Parciais cadastradas', String((dto.parciais || []).length))
    ));

    var distribuicao = Array.isArray(dto.distribuicao) ? dto.distribuicao : [];
    if (distribuicao.length === 0) {
      wrap.appendChild(window.el('p', {
        style: 'margin:0;font-size:13px;color:var(--rv-text-tertiary);',
      }, 'Sem distribuicao parcial disponivel ainda.'));
      return wrap;
    }

    var chips = window.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' });
    distribuicao.forEach(function (item) {
      var percentual = fmtPercentual(item.percentual);
      var texto = item.label + ' · ' + fmtMetros(item.metros) + (percentual ? ' · ' + percentual : '');
      chips.appendChild(window.el('span', {
        style: 'display:inline-flex;align-items:center;background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:3px 9px;font-size:11.5px;color:var(--rv-text-secondary);',
      }, texto));
    });
    wrap.appendChild(chips);
    return wrap;
  }

  // Bloco de metrica do preview: mesma caixa rebaixada que buildSummaryMetric
  // usa no detalhe do Pedido, agora declarada por token em vez de
  // `bg-white border-gray-200` com escalas de cinza do Tailwind.
  function metric(label, value) {
    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:10px 12px;',
    },
      window.el('div', {
        style: 'font-size:11.5px;color:var(--rv-text-tertiary);font-weight:600;margin-bottom:5px;',
      }, label),
      window.el('div', {
        style: 'font-size:13.5px;font-weight:700;color:var(--rv-text-primary);',
      }, value || '—')
    );
  }

  function buildPedidoParciaisAdminCard(options) {
    var pedido = options && options.pedido;
    var itens = options && options.itens;
    var onReload = options && options.onReload;

    if (!pedido) return window.el('div', {});
    if (!window.CURRENT_USER || window.CURRENT_USER.tipo !== 'admin') {
      return window.el('div', {});
    }

    var api = getTrackingApi();
    var situacaoOptions = buildSituacaoOptions(api);
    var card = window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);padding:16px 20px;margin-bottom:14px;',
    });
    var listWrap = window.el('div', { style: 'margin-top:14px;' });

    var dataHoje = new Date().toISOString().slice(0, 10);
    var situacaoInput = window.selectInput({
      options: situacaoOptions,
      value: '',
      placeholder: 'Selecione a situacao',
    });
    var metrosInput = window.textInput({ type: 'number', value: '', placeholder: '0,00', step: '0.01' });
    var dataInput = window.textInput({ type: 'date', value: dataHoje });
    var tituloInput = window.textInput({ type: 'text', value: '', placeholder: 'Titulo opcional' });
    // B1: the 96px Tailwind minimum becomes the canonical `notice` textarea
    // role; the border, radius, padding and focus ring move to css/tokens.css.
    var mensagemInput = window.textArea({
      role: 'notice',
      placeholder: 'Mensagem opcional para o cliente',
      ariaLabel: 'Mensagem',
    });
    var sequenciaInput = window.textInput({ type: 'number', value: '', placeholder: '1', step: '1' });
    // B1: the partial-shipment visibility flag resolves through the canonical
    // visible checkbox. Its unchecked default and the `.checked` read on submit
    // are unchanged.
    var visivelInput = window.checkboxInput({ checked: false, ariaLabel: 'Visivel para o cliente' });

    card.appendChild(window.el('h2', {
      style: 'margin:0;font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
    }, 'Parciais do pedido'));
    card.appendChild(window.el('p', {
      style: 'margin:6px 0 0;font-size:13px;color:var(--rv-text-secondary);line-height:1.5;',
    }, 'Cadastro manual de parciais para uso futuro no acompanhamento read-only do cliente.'));

    function buildList(parciais) {
      listWrap.replaceChildren();

      if (!Array.isArray(parciais) || parciais.length === 0) {
        listWrap.appendChild(window.el('div', {
          style: 'background:var(--rv-surface-subtle);border:1px dashed var(--rv-border-strong);border-radius:var(--rv-radius);padding:18px 16px;font-size:13px;color:var(--rv-text-tertiary);',
        }, 'Este pedido ainda nao possui parciais cadastradas.'));
        return;
      }

      // Pass-8 §2.5: `metros` is the only quantity here. `sequencia` is a
      // sequence identifier and the three date columns are temporal labels
      // (architect rulings 6.1 / 6.2), so none of them is right-aligned.
      listWrap.appendChild(window.dataTable({
        columns: [
          {
            key: 'sequencia',
            label: 'Seq.',
            width: '6%',
            render: function (row) { return row.sequencia != null ? String(row.sequencia) : '—'; },
          },
          {
            key: 'situacao',
            label: 'Situacao',
            width: '12%',
            render: function (row) {
              var situacao = api && api.getClienteParcialSituacao
                ? api.getClienteParcialSituacao(row.situacao)
                : null;
              return situacao ? situacao.label : (row.situacao || '—');
            },
          },
          {
            key: 'metros',
            label: 'Metros',
            width: '9%',
            numeric: true,
            render: function (row) { return fmtMetros(row.metros); },
          },
          {
            key: 'data_referencia',
            label: 'Data ref.',
            width: '10%',
            render: function (row) { return row.data_referencia ? fmtData(row.data_referencia) : '—'; },
          },
          {
            key: 'titulo',
            label: 'Titulo',
            width: '14%',
            render: function (row) { return row.titulo || '—'; },
          },
          {
            key: 'mensagem_cliente',
            label: 'Mensagem cliente',
            width: '19%',
            render: function (row) { return row.mensagem_cliente || '—'; },
          },
          {
            key: 'visivel_cliente',
            label: 'Visivel ao cliente',
            width: '9%',
            render: function (row) { return row.visivel_cliente ? 'Sim' : 'Nao'; },
          },
          {
            key: 'criado_em',
            label: 'Criado em',
            width: '10.5%',
            render: function (row) { return fmtData(row.criado_em); },
          },
          {
            key: 'atualizado_em',
            label: 'Atualizado em',
            width: '10.5%',
            render: function (row) { return fmtData(row.atualizado_em); },
          },
        ],
        rows: parciais,
        actions: [],
      }));
    }

    async function carregarParciais() {
      var res = await window.supa
        .from('pedido_parciais')
        .select('id, pedido_id, sequencia, situacao, metros, data_referencia, titulo, mensagem_cliente, visivel_cliente, criado_em, atualizado_em')
        .eq('pedido_id', pedido.id)
        .order('sequencia', { ascending: true })
        .order('criado_em', { ascending: true });

      if (res.error) {
        listWrap.replaceChildren(window.el('div', {
          style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);border-radius:var(--rv-radius);padding:18px 16px;font-size:13px;color:var(--rv-signal-negative);',
        }, 'Erro ao carregar parciais: ' + (res.error.message || 'desconhecido')));
        console.error('pedido-parciais-admin: erro ao carregar pedido_parciais', res.error);
        return [];
      }

      var parciais = res.data || [];
      buildList(parciais);
      return parciais;
    }

    // `data-rv-2col` e o dono ja aceito da grade de duas colunas que empilha
    // em telas estreitas; substitui `grid-cols-1 md:grid-cols-2`, que decidia
    // a mesma coisa por conta propria e num ponto de quebra diferente do resto
    // do detalhe do Pedido.
    var formGrid = window.el('div', {
      'data-rv-2col': '',
      style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px;',
    },
      window.formField({
        label: 'Situacao',
        input: situacaoInput,
        hint: 'Usa o catalogo compartilhado de situacoes parciais.',
      }),
      window.formField({
        label: 'Sequencia',
        input: sequenciaInput,
        hint: 'Inteiro positivo usado para ordenar as parciais.',
      }),
      window.formField({
        label: 'Metros',
        input: metrosInput,
        hint: 'Informe um numero maior que zero.',
      }),
      window.formField({
        label: 'Data de referencia',
        input: dataInput,
        hint: 'Pode ser ajustada manualmente.',
      }),
      window.formField({
        label: 'Titulo',
        input: tituloInput,
        hint: 'Opcional. Texto simples.',
      }),
      window.formField({
        label: 'Visibilidade',
        input: window.el('label', {
          style: 'display:inline-flex;align-items:center;gap:8px;height:var(--rv-h-compact);cursor:pointer;',
        },
          visivelInput,
          window.el('span', { style: 'font-size:13px;color:var(--rv-text-primary);' }, 'Visivel ao cliente')
        ),
        hint: 'Padrao inicial: desmarcado, para evitar publicacao acidental.',
      })
    );

    card.appendChild(listWrap);
    card.appendChild(formGrid);
    card.appendChild(window.formField({
      label: 'Mensagem ao cliente',
      input: mensagemInput,
      hint: 'Opcional. Nao altera status visual nem gera evento nesta fase.',
    }));

    var previewWrap = window.el('div', {});
    card.appendChild(previewWrap);

    // Mesma acao dominante canonica de pedido-tracking-admin.js.
    var btnSalvar = window.el('button', {
      type: 'button',
      style: 'display:inline-flex;align-items:center;justify-content:center;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:var(--rv-radius);height:var(--rv-h-primary);padding:0 16px;font-size:var(--rv-fs-body);font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;',
    }, 'Cadastrar parcial');

    async function refreshAll() {
      var parciais = await carregarParciais();
      previewWrap.replaceChildren(buildPreview(api, pedido, itens, parciais));
    }

    async function handleSave() {
      var situacao = situacaoInput.value;
      var sequencia = Number(sequenciaInput.value);
      var metros = Number(metrosInput.value);
      var dataReferencia = dataInput.value || null;

      if (!situacao) {
        window.toast('Selecione a situacao da parcial.', 'error');
        return;
      }
      if (!Number.isInteger(sequencia) || sequencia <= 0) {
        window.toast('Sequencia deve ser um inteiro positivo.', 'error');
        return;
      }
      if (!Number.isFinite(metros) || metros <= 0) {
        window.toast('Metros deve ser maior que zero.', 'error');
        return;
      }

      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';

      try {
        var payload = {
          pedido_id: pedido.id,
          sequencia: sequencia,
          situacao: situacao,
          metros: Number(metros.toFixed(2)),
          data_referencia: dataReferencia,
          titulo: normalizeOptionalText(tituloInput.value),
          mensagem_cliente: normalizeOptionalText(mensagemInput.value),
          visivel_cliente: !!visivelInput.checked,
          origem: 'manual',
        };

        var currentUserId = window.CURRENT_USER && window.CURRENT_USER.id
          ? window.CURRENT_USER.id
          : null;
        if (currentUserId) {
          payload.criado_por = currentUserId;
        }

        var insertRes = await window.supa
          .from('pedido_parciais')
          .insert(payload);

        if (insertRes.error) {
          window.toast('Erro ao cadastrar parcial: ' + (insertRes.error.message || 'desconhecido'), 'error');
          console.error('pedido-parciais-admin: erro ao inserir pedido_parciais', insertRes.error);
          return;
        }

        situacaoInput.value = '';
        metrosInput.value = '';
        dataInput.value = dataHoje;
        tituloInput.value = '';
        mensagemInput.value = '';
        sequenciaInput.value = '';
        visivelInput.checked = false;

        if (typeof onReload === 'function') {
          await onReload();
        } else {
          await refreshAll();
        }

        window.toast('Parcial cadastrada com sucesso.', 'success');
      } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Cadastrar parcial';
      }
    }

    btnSalvar.addEventListener('click', handleSave);
    // SCREEN-GROUP-2 — CONTENCAO LOCAL DA ACAO (ACTION-CONTAINMENT-A1),
    // identica a de pedido-tracking-admin.js: STANDARD_ACTION_FOOTER
    // DECLARADO por `data-card-actions`, com divisor superior e
    // padding-top:11px como longhand.
    card.appendChild(window.el('div', {
      style: 'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--rv-border-soft);padding-top:11px;margin-top:14px;',
      'data-pedido-parciais-admin-actions': 'cadastro',
      'data-card-actions': '',
    }, btnSalvar));

    refreshAll();
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoParciaisAdmin = {
    buildPedidoParciaisAdminCard: buildPedidoParciaisAdminCard,
  };

  window.buildPedidoParciaisAdminCard = buildPedidoParciaisAdminCard;
})(window);
