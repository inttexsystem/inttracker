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

    var wrap = window.el('div', {
      class: 'rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 mt-4',
    });

    wrap.appendChild(window.el('div', { class: 'text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3' },
      'Preview tecnico das parciais'
    ));

    wrap.appendChild(window.el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm' },
      metric('Total do pedido', fmtMetros(dto.metrosTotal)),
      metric('Total parcial registrado', fmtMetros(dto.totais && dto.totais.parcialVisivel)),
      metric('Parciais cadastradas', String((dto.parciais || []).length))
    ));

    var distribuicao = Array.isArray(dto.distribuicao) ? dto.distribuicao : [];
    if (distribuicao.length === 0) {
      wrap.appendChild(window.el('p', { class: 'text-sm text-gray-500' },
        'Sem distribuicao parcial disponivel ainda.'
      ));
      return wrap;
    }

    var chips = window.el('div', { class: 'flex flex-wrap gap-2' });
    distribuicao.forEach(function (item) {
      var percentual = fmtPercentual(item.percentual);
      var texto = item.label + ' · ' + fmtMetros(item.metros) + (percentual ? ' · ' + percentual : '');
      chips.appendChild(window.el('span', {
        class: 'inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-700',
      }, texto));
    });
    wrap.appendChild(chips);
    return wrap;
  }

  function metric(label, value) {
    return window.el('div', { class: 'rounded-lg bg-white border border-gray-200 px-3 py-2' },
      window.el('div', { class: 'text-xs text-gray-500 mb-1' }, label),
      window.el('div', { class: 'text-sm font-semibold text-gray-900' }, value || '—')
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
    var card = window.el('div', { class: 'bg-white rounded-xl shadow p-6 mb-4' });
    var listWrap = window.el('div', { class: 'mt-4' });

    var dataHoje = new Date().toISOString().slice(0, 10);
    var situacaoInput = window.selectInput({
      options: situacaoOptions,
      value: '',
      placeholder: 'Selecione a situacao',
    });
    var metrosInput = window.textInput({ type: 'number', value: '', placeholder: '0,00', step: '0.01' });
    var dataInput = window.textInput({ type: 'date', value: dataHoje });
    var tituloInput = window.textInput({ type: 'text', value: '', placeholder: 'Titulo opcional' });
    var mensagemInput = window.el('textarea', {
      class: 'w-full border rounded-lg px-3 py-2 min-h-[96px] focus:outline-none focus:ring-2 focus:ring-blue-500',
      placeholder: 'Mensagem opcional para o cliente',
    });
    var sequenciaInput = window.textInput({ type: 'number', value: '', placeholder: '1', step: '1' });
    var visivelInput = window.el('input', {
      type: 'checkbox',
      class: 'h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500',
    });
    visivelInput.checked = false;

    card.appendChild(window.el('h2', { class: 'text-base font-bold text-gray-900 mb-1' },
      'Parciais do pedido'
    ));
    card.appendChild(window.el('p', { class: 'text-sm text-gray-500' },
      'Cadastro manual de parciais para uso futuro no acompanhamento read-only do cliente.'
    ));

    function buildList(parciais) {
      listWrap.replaceChildren();

      if (!Array.isArray(parciais) || parciais.length === 0) {
        listWrap.appendChild(window.el('div', {
          class: 'rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500',
        }, 'Este pedido ainda nao possui parciais cadastradas.'));
        return;
      }

      listWrap.appendChild(window.dataTable({
        columns: [
          {
            key: 'sequencia',
            label: 'Seq.',
            render: function (row) { return row.sequencia != null ? String(row.sequencia) : '—'; },
          },
          {
            key: 'situacao',
            label: 'Situacao',
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
            render: function (row) { return fmtMetros(row.metros); },
          },
          {
            key: 'data_referencia',
            label: 'Data ref.',
            render: function (row) { return row.data_referencia ? fmtData(row.data_referencia) : '—'; },
          },
          {
            key: 'titulo',
            label: 'Titulo',
            render: function (row) { return row.titulo || '—'; },
          },
          {
            key: 'mensagem_cliente',
            label: 'Mensagem cliente',
            render: function (row) { return row.mensagem_cliente || '—'; },
          },
          {
            key: 'visivel_cliente',
            label: 'Visivel ao cliente',
            render: function (row) { return row.visivel_cliente ? 'Sim' : 'Nao'; },
          },
          {
            key: 'criado_em',
            label: 'Criado em',
            render: function (row) { return fmtData(row.criado_em); },
          },
          {
            key: 'atualizado_em',
            label: 'Atualizado em',
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
          class: 'rounded-lg border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700',
        }, 'Erro ao carregar parciais: ' + (res.error.message || 'desconhecido')));
        console.error('pedido-parciais-admin: erro ao carregar pedido_parciais', res.error);
        return [];
      }

      var parciais = res.data || [];
      buildList(parciais);
      return parciais;
    }

    var formGrid = window.el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4 mt-5' },
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
        input: window.el('label', { class: 'inline-flex items-center gap-2 py-2' },
          visivelInput,
          window.el('span', { class: 'text-sm text-gray-700' }, 'Visivel ao cliente')
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

    var btnSalvar = window.el('button', {
      type: 'button',
      class: 'px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold',
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
    card.appendChild(window.el('div', { class: 'mt-4 flex justify-end' }, btnSalvar));

    refreshAll();
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoParciaisAdmin = {
    buildPedidoParciaisAdminCard: buildPedidoParciaisAdminCard,
  };

  window.buildPedidoParciaisAdminCard = buildPedidoParciaisAdminCard;
})(window);
