// =====================================================================
// === SCREENS: CLIENTE PEDIDO DETAIL ==================================
// Tela cliente do detalhe sanitizado de um Pedido próprio.
// Rota: `#/cliente/pedidos/<uuid>` (parseada por js/router.js).
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A +
//   RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-UI-A +
//   RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-EVENTS-A +
//   RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A +
//   RAVATEX-TAPETES-CLIENTE-DETAIL-REFERENCE-ALIGN-B1 +
//   RAVATEX-TAPETES-CLIENTE-DETAIL-MATCH-STANDALONE-CLAUDE
//   (redesign visual completo para igualar ao HTML standalone de
//   referencia: breadcrumb + titulo inline, meta card 3 colunas,
//   itens em grade 4 colunas com dots de cor, distribuicao com
//   barras coloridas por situacao, parciais com badge inline-style,
//   historico com timeline vertical flat — sem alterar contrato de
//   dados, RLS, selects ou funcionalidades ja homologadas)
// Escopo: leitura apenas. Sem modificar, cancelar ou criar pedido.
//   Confia na RLS para bloquear acesso a pedidos de outros clientes.
//   Não expõe dados internos, de produção ou administrativos.
//   Ordem de renderização: header/titulo →
//   resumo (meta card) → observação geral →
//   acompanhamento (stepper, delegado a cliente-pedido-tracking.js) →
//   itens + distribuição atual (2 colunas) → resumo de entrega →
//   parciais do pedido → histórico read-only com os eventos públicos.
//
// Carregar via <script src="js/screens/cliente-pedido-detail.js"></script>
// no <head>, DEPOIS de cliente-common.js, cliente-pedido-tracking.js,
// pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast / window.pageHeader (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.buildClientePedidoTrackingCard
//     (js/screens/cliente-pedido-tracking.js)
//   - window.RavatexPedidoTracking (js/pedido-tracking-ui.js)
//   - window.pedidoStatusBadge / window.pedidoStatusLabel
//     / window.corPreviewElement / window.corPreviewHex
//     / window.fmtDataCurta (js/pedido-ui.js)
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// Leitura por RPC pública `cliente_pedido_summary`.
// =====================================================================

(function (window) {
  'use strict';

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function fmtNumero(n) {
    if (n == null) return '—';
    return '#' + n;
  }

  function fmtMetros(v) {
    if (v == null) return '—';
    var n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtTextoOuEmpty(s, fallback) {
    if (s == null) return fallback || '—';
    var t = String(s).trim();
    if (!t) return fallback || '—';
    return t;
  }

  function fmtEventoData(v) {
    if (!v) return '—';
    return window.fmtDataCurta ? window.fmtDataCurta(v) : String(v);
  }

  // Cria elemento SVG via innerHTML para suporte a namespace.
  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstChild;
  }

  async function screenClientePedidoDetalhe(pedidoId) {
    if (!UUID_RE.test(String(pedidoId || ''))) {
      window.toast('Identificador de pedido inválido.', 'error');
      var errWrap = window.el('div', {},
        window.el('div', { class: 'bg-white rounded border border-gray-200 p-6 text-red-700' },
          'Pedido inválido. Volte para a listagem e tente novamente.'),
        window.el('div', { class: 'mt-4' },
          window.el('button', {
            type: 'button',
            class: 'px-4 py-2 rounded border border-gray-200 hover:bg-gray-50',
            onclick: function () { window.navigate('#/cliente/pedidos'); },
          }, '← Voltar para lista')
        )
      );
      var errHeader = window.pageHeader('Pedido');
      return window.clienteShellLayout(
        window.el('div', {}, errHeader, errWrap));
    }

    var container = window.el('div', {});
    var loadingError = null;

    var state = {
      pedido: null,
      parciais: [],
      parciaisError: false,
      itens: [],
      chainState: null,
      eventos: [],
      eventosError: false,
      entregasResumo: [],
      pendencias: [],
    };

    function modelLabel(item) {
      if (!item) return '—';
      var nome = fmtTextoOuEmpty(item.modelo, 'Modelo');
      var largura = item.largura;
      var w = (typeof largura === 'number')
        ? largura.toFixed(2).replace('.', ',') + ' m'
        : (largura != null ? String(largura) : '—');
      return nome + ' · ' + w;
    }

    function itemCoresLabel(item) {
      var c1 = fmtTextoOuEmpty(item && item.cor_1, '—');
      var c2 = fmtTextoOuEmpty(item && item.cor_2, '—');
      return c1 + ' / ' + c2;
    }

    function itemPreviewEl(item) {
      var c1Nome = item && item.cor_1 ? item.cor_1 : null;
      if (c1Nome && window.corPreviewElement) {
        var thumb = window.corPreviewElement(c1Nome);
        if (thumb) {
          // Ajusta tamanho sem sobrescrever background-image (textura do tapete).
          thumb.style.width = '32px';
          thumb.style.height = '32px';
          thumb.style.borderRadius = '4px';
          thumb.style.border = '1px solid rgba(0,0,0,0.08)';
          thumb.style.flexShrink = '0';
          return thumb;
        }
      }
      return window.el('div', {
        style: 'width:32px;height:32px;border-radius:4px;border:1px solid #eceef1;background:#f3f4f6;flex-shrink:0;',
      });
    }

    // Estilos do badge de situacao da parcial (inline, exatos do standalone).
    function parcialSituacaoStyle(situacao) {
      var map = {
        em_tecelagem:   { bg: '#eef3ff', color: '#3b5bdb', dot: '#5b9df0' },
        em_acabamento:  { bg: '#fff4e6', color: '#c05c1a', dot: '#e07b39' },
        pronto_retirada:{ bg: '#eaf1fd', color: '#2563eb', dot: '#2563eb' },
        pronto_envio:   { bg: '#eaf1fd', color: '#2563eb', dot: '#2563eb' },
        em_transporte:  { bg: '#f3e8ff', color: '#7c3aed', dot: '#8b5cf6' },
        entregue:       { bg: '#e6f4ec', color: '#18794a', dot: '#18794a' },
        cancelado:      { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
      };
      return map[situacao] || { bg: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' };
    }

    // Cor da barra na secao Distribuicao atual por situacao da parcial.
    function distribuicaoBarColor(situacao) {
      var map = {
        em_tecelagem:    '#5b9df0',
        em_acabamento:   '#e07b39',
        pronto_retirada: '#2563eb',
        pronto_envio:    '#2563eb',
        em_transporte:   '#8b5cf6',
        entregue:        '#18794a',
        concluido:       '#18794a',
      };
      return map[situacao] || '#5b9df0';
    }

    async function carregar() {
      var summaryRes = await window.supa.rpc('cliente_pedido_summary', {
        p_pedido_id: pedidoId,
      });

      if (summaryRes.error) {
        loadingError = 'summary';
        window.toast('Erro ao carregar o resumo do pedido.', 'error');
        console.error(summaryRes.error);
        return;
      }

      var payload = summaryRes.data || null;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (_) { payload = null; }
      }
      if (Array.isArray(payload)) payload = payload[0] || null;

      if (!payload || payload.ok === false || !payload.pedido) {
        loadingError = 'pedido';
        window.toast((payload && payload.erro) || 'Pedido não encontrado ou sem permissão.', 'error');
        state.pedido = null;
        return;
      }

      state.pedido = payload.pedido;
      state.itens = Array.isArray(payload.itens) ? payload.itens : [];
      state.parciais = Array.isArray(payload.parciais) ? payload.parciais : [];
      state.entregasResumo = Array.isArray(payload.entregas) ? payload.entregas : [];
      state.pendencias = Array.isArray(payload.pendencias) ? payload.pendencias : [];
      state.chainState = payload.chain_state || null;
      state.eventos = (Array.isArray(payload.timeline) ? payload.timeline : []).map(function (evento) {
        return {
          criado_em: evento.data,
          titulo: evento.titulo,
          mensagem: evento.descricao,
          status: evento.status,
        };
      });
    }

    // Breadcrumb + titulo + badge de status + data de atualizacao.
    // Substitui window.pageHeader para igualar ao standalone.
    function buildHeader() {
      var p = state.pedido;
      var numero = p ? fmtNumero(p.numero) : 'Pedido';

      var backBtn = window.el('button', {
        type: 'button',
        style: 'display:flex;align-items:center;gap:8px;border:1px solid #d8dce2;background:#fff;'
          + 'color:#3f4757;border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;'
          + 'cursor:pointer;font-family:inherit;',
        onclick: function () { window.navigate('#/cliente/pedidos'); },
      },
        svgEl('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
          + '<line x1="19" y1="12" x2="5" y2="12"></line>'
          + '<polyline points="12 19 5 12 12 5"></polyline>'
          + '</svg>'),
        'Voltar para pedidos'
      );

      var breadcrumb = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;',
      },
        window.el('div', { style: 'font-size:14px;color:#9aa2af;' },
          'Meus pedidos ',
          window.el('span', { style: 'margin:0 4px;color:#d0d5dc;' }, '/'),
          window.el('span', { style: 'color:#5b6472;font-weight:600;' }, ' ' + numero)
        ),
        backBtn
      );

      if (!p) return breadcrumb;

      // Badge de status: usa tracking visual quando disponivel; fallback para pedidoStatusBadge.
      var trackingApi = window.RavatexPedidoTracking
        || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING);
      var statusBadge;
      if (state.chainState && state.chainState.isOperationalOverride) {
        statusBadge = window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:7px;background:#eaf1fd;color:#2563eb;'
            + 'border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;',
        },
          window.el('span', {
            style: 'width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0;display:inline-block;',
          }),
          state.chainState.displayStatus
        );
      } else if (p.status_cliente_visual && trackingApi) {
        var trackingStep = trackingApi.getClienteTrackingStep
          ? trackingApi.getClienteTrackingStep(p.status_cliente_visual) : null;
        var trackingLabel = trackingStep ? trackingStep.label : p.status_cliente_visual;
        var hasParciais = state.parciais && state.parciais.length > 0;
        var badgeText = trackingLabel + (hasParciais ? ' · parcial' : '');
        statusBadge = window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:7px;background:#eaf1fd;color:#2563eb;'
            + 'border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;',
        },
          window.el('span', {
            style: 'width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0;display:inline-block;',
          }),
          badgeText
        );
      } else {
        statusBadge = window.pedidoStatusBadge(p.status);
      }

      var updatedAt = p.status_cliente_atualizado_em || p.atualizado_em;
      var titleRow = window.el('div', { style: 'margin-bottom:14px;' },
        window.el('div', {
          style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;',
        },
          window.el('h1', {
            style: 'margin:0;font-size:23px;font-weight:800;color:#16203a;letter-spacing:-.01em;line-height:1.1;',
          }, numero),
          statusBadge
        ),
        updatedAt
          ? window.el('div', {
              style: 'font-size:13px;color:#9aa2af;margin-top:5px;',
            }, 'Atualizado em ' + window.fmtDataCurta(updatedAt))
          : null
      );

      return window.el('div', {}, breadcrumb, titleRow);
    }

    function buildTracking() {
      if (!state.pedido) return window.el('div', {});
      return window.buildClientePedidoTrackingCard(state.pedido, state.itens, state.parciais, state.chainState);
    }

    // Meta card com 3 colunas: Atualizado em | Prazo previsto | Recebimento.
    function buildResumo() {
      if (!state.pedido) return window.el('div', {});
      var p = state.pedido;

      function metaCol(iconMarkup, labelText, valueText) {
        return window.el('div', {
          style: 'flex:1;display:flex;align-items:center;gap:14px;padding:12px 18px;',
        },
          svgEl(iconMarkup),
          window.el('div', {},
            window.el('div', { style: 'font-size:12px;color:#9aa2af;' }, labelText),
            window.el('div', {
              style: 'font-size:14.5px;font-weight:700;color:#16203a;',
            }, valueText)
          )
        );
      }

      var updatedAt = p.status_cliente_atualizado_em || p.atualizado_em;
      var updatedStr = updatedAt ? window.fmtDataCurta(updatedAt) : '—';
      var prazoStr = p.prazo_entrega ? window.fmtDataCurta(p.prazo_entrega) : '—';
      var tipoRecebimento = p.tipo_recebimento || p.tipo_entrega;
      var recebimentoStr = tipoRecebimento === 'entrega' || tipoRecebimento === 'envio'
        ? 'Entrega'
        : 'Retirada';

      var iconClock = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"'
        + ' stroke="#c2c8d0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
        + '<circle cx="12" cy="12" r="9"></circle>'
        + '<polyline points="12 7 12 12 15 14"></polyline>'
        + '</svg>';
      var iconCalendar = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"'
        + ' stroke="#c2c8d0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
        + '<rect x="3" y="5" width="18" height="16" rx="2"></rect>'
        + '<line x1="3" y1="9" x2="21" y2="9"></line>'
        + '<line x1="8" y1="3" x2="8" y2="6"></line>'
        + '<line x1="16" y1="3" x2="16" y2="6"></line>'
        + '</svg>';
      var iconBox = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"'
        + ' stroke="#c2c8d0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"></path>'
        + '<path d="M3 8l9 5 9-5"></path>'
        + '<line x1="12" y1="13" x2="12" y2="21"></line>'
        + '</svg>';

      var col1 = metaCol(iconClock, 'Atualizado em', updatedStr);
      var col2 = metaCol(iconCalendar, 'Prazo previsto', prazoStr);
      var col3 = metaCol(iconBox, 'Recebimento', recebimentoStr);
      col2.style.borderLeft = '1px solid #eceef1';
      col3.style.borderLeft = '1px solid #eceef1';

      return window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;display:flex;margin-bottom:14px;overflow:hidden;',
      }, col1, col2, col3);
    }

    function buildDadosGerais() {
      if (!state.pedido) return window.el('div', {});
      var p = state.pedido;
      var obs = fmtTextoOuEmpty(p.observacao, '');
      if (!obs || obs === '—') return window.el('div', {});
      return window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:10px;',
        }, 'Observação geral'),
        window.el('p', { style: 'font-size:14px;color:#3f4757;white-space:pre-line;' }, obs),
      );
    }

    function buildParciaisHeaderRow() {
      return window.el('div', {
        style: 'display:grid;grid-template-columns:.8fr 1.6fr .9fr .8fr;gap:12px;'
          + 'padding:10px 20px;background:#f8f9fb;border-bottom:1px solid #eceef1;',
      },
        window.el('div', { style: 'font-size:11.5px;font-weight:600;color:#9aa2af;' }, 'Parcial'),
        window.el('div', { style: 'font-size:11.5px;font-weight:600;color:#9aa2af;' }, 'Situação'),
        window.el('div', {
          style: 'font-size:11.5px;font-weight:600;color:#9aa2af;text-align:right;',
        }, 'Metragem'),
        window.el('div', {
          style: 'font-size:11.5px;font-weight:600;color:#9aa2af;text-align:right;',
        }, 'Atualizado em')
      );
    }

    function buildParcialRow(parcial, isLast) {
      var tone = parcialSituacaoStyle(parcial.situacao);
      var badgeStyle = 'display:inline-flex;align-items:center;gap:6px;background:' + tone.bg
        + ';color:' + tone.color + ';border-radius:4px;padding:3px 9px;font-size:12.5px;font-weight:600;';
      var dotStyle = 'width:6px;height:6px;border-radius:50%;background:' + tone.dot
        + ';flex-shrink:0;display:inline-block;';

      return window.el('div', {
        style: 'display:grid;grid-template-columns:.8fr 1.6fr .9fr .8fr;gap:12px;'
          + 'padding:11px 20px;align-items:center;'
          + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;'),
      },
        window.el('div', {
          style: 'font-size:14px;font-weight:600;color:#16203a;',
        }, parcial.codigo || 'Parcial'),
        window.el('div', {},
          parcial.label
            ? window.el('span', { style: badgeStyle },
                window.el('span', { style: dotStyle }),
                parcial.label)
            : window.el('span', { style: 'font-size:12px;color:#9aa2af;' }, '—'),
          parcial.titulo
            ? window.el('div', {
                style: 'font-size:11.5px;color:#9aa2af;margin-top:3px;',
              }, parcial.titulo)
            : null
        ),
        window.el('div', {
          style: 'text-align:right;font-size:14px;font-weight:600;color:#16203a;',
        }, fmtMetros(parcial.metros)),
        window.el('div', {
          style: 'text-align:right;font-size:13px;color:#9aa2af;',
        }, parcial.dataReferencia ? fmtEventoData(parcial.dataReferencia) : '—')
      );
    }

    function buildParciais() {
      if (!state.pedido) return window.el('div', {});

      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;overflow:hidden;margin-bottom:14px;',
      });
      card.appendChild(window.el('div', {
        style: 'padding:14px 20px 12px;font-size:15px;font-weight:700;color:#16203a;border-bottom:1px solid #eceef1;',
      }, 'Parciais do pedido'));

      if (state.parciaisError) {
        card.appendChild(window.el('p', {
          style: 'padding:14px 20px;font-size:14px;color:#b45309;',
        }, 'Nao foi possivel carregar as parciais agora.'));
        return card;
      }

      var trackingApi = window.RavatexPedidoTracking;
      var acompanhamento = trackingApi && trackingApi.buildPedidoAcompanhamentoParcial
        ? trackingApi.buildPedidoAcompanhamentoParcial(state.pedido, state.itens, state.parciais, { forCliente: true })
        : null;
      var parciais = acompanhamento && Array.isArray(acompanhamento.parciais)
        ? acompanhamento.parciais
        : [];

      if (parciais.length === 0) {
        card.appendChild(window.el('p', {
          style: 'padding:14px 20px;font-size:14px;color:#9aa2af;',
        }, 'Este pedido ainda nao possui parciais publicadas.'));
        return card;
      }

      card.appendChild(buildParciaisHeaderRow());
      parciais.forEach(function (parcial, idx) {
        card.appendChild(buildParcialRow(parcial, idx === parciais.length - 1));
      });
      return card;
    }

    // Grade 4 colunas: thumb (40px) | modelo | cores | metragem
    function buildItemRow(item, isLast) {
      var c1Nome = item && item.cor_1 ? item.cor_1 : null;
      var c2Nome = item && item.cor_2 ? item.cor_2 : null;
      var c1Hex = c1Nome && window.corPreviewHex ? window.corPreviewHex(c1Nome) : '#e5e7eb';
      var c2Hex = c2Nome && window.corPreviewHex ? window.corPreviewHex(c2Nome) : '#e5e7eb';

      return window.el('div', {
        style: 'display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:10px;'
          + 'padding:11px 0;align-items:center;'
          + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;'),
      },
        itemPreviewEl(item),
        window.el('div', {
          style: 'font-size:13.5px;font-weight:600;color:#16203a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        }, modelLabel(item)),
        window.el('div', {},
          window.el('div', { style: 'display:flex;gap:5px;align-items:center;' },
            window.el('span', {
              style: 'width:14px;height:14px;border-radius:50%;background:' + c1Hex
                + ';border:1px solid rgba(0,0,0,0.08);display:inline-block;flex-shrink:0;',
            }),
            c2Nome
              ? window.el('span', {
                  style: 'width:14px;height:14px;border-radius:50%;background:' + c2Hex
                    + ';border:1px solid rgba(0,0,0,0.12);display:inline-block;flex-shrink:0;',
                })
              : null
          ),
          window.el('div', {
            style: 'font-size:11px;color:#9aa2af;margin-top:4px;',
          }, itemCoresLabel(item))
        ),
        window.el('div', {
          style: 'text-align:right;font-size:13.5px;font-weight:600;color:#16203a;',
        }, fmtMetros(item.metros))
      );
    }

    function buildItens() {
      var itens = state.itens;
      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;',
      });
      card.appendChild(window.el('div', {
        style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:14px;',
      }, 'Itens do pedido'));

      if (itens.length === 0) {
        card.appendChild(window.el('p', { style: 'font-size:14px;color:#9aa2af;' },
          'Este pedido não possui itens.'));
        return card;
      }

      // Cabecalho da grade
      card.appendChild(window.el('div', {
        style: 'display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:10px;'
          + 'padding:8px 0;border-bottom:1px solid #eceef1;',
      },
        window.el('div', {}),
        window.el('div', { style: 'font-size:11.5px;font-weight:600;color:#9aa2af;' }, 'Modelo'),
        window.el('div', { style: 'font-size:11.5px;font-weight:600;color:#9aa2af;' }, 'Cores'),
        window.el('div', {
          style: 'font-size:11.5px;font-weight:600;color:#9aa2af;text-align:right;',
        }, 'Metragem')
      ));

      itens.forEach(function (item, idx) {
        card.appendChild(buildItemRow(item, idx === itens.length - 1));
      });
      return card;
    }

    function buildDistribuicaoAtual() {
      if (!state.pedido) return window.el('div', {});
      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;',
      });
      card.appendChild(window.el('div', {
        style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:14px;',
      }, 'Distribuição atual'));

      var trackingApi = window.RavatexPedidoTracking;
      var acompanhamento = trackingApi && trackingApi.buildPedidoAcompanhamentoParcial
        ? trackingApi.buildPedidoAcompanhamentoParcial(state.pedido, state.itens, state.parciais, { forCliente: true })
        : null;
      var distribuicao = acompanhamento && Array.isArray(acompanhamento.distribuicao)
        ? acompanhamento.distribuicao
        : [];

      if (distribuicao.length === 0) {
        card.appendChild(window.el('p', { style: 'font-size:14px;color:#9aa2af;' },
          'Sem distribuição parcial publicada para este pedido.'));
        return card;
      }

      var barsWrap = window.el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
      distribuicao.forEach(function (item) {
        var largura = Math.min(Math.max(Number(item.percentual) || 0, 0), 100);
        var barColor = distribuicaoBarColor(item.situacao);
        barsWrap.appendChild(window.el('div', { style: 'display:flex;align-items:center;gap:12px;' },
          window.el('div', {
            style: 'width:120px;font-size:13.5px;color:#3f4757;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
          }, item.label),
          window.el('div', {
            style: 'flex:1;height:6px;border-radius:99px;background:#eef1f5;overflow:hidden;',
          },
            window.el('div', {
              style: 'width:' + largura + '%;height:100%;background:' + barColor + ';border-radius:99px;',
            })
          ),
          window.el('div', {
            style: 'width:90px;text-align:right;font-size:13.5px;font-weight:600;color:#16203a;flex-shrink:0;',
          }, fmtMetros(item.metros))
        ));
      });
      card.appendChild(barsWrap);

      card.appendChild(window.el('div', {
        style: 'height:1px;background:#eceef1;margin:14px 0 12px;',
      }));
      card.appendChild(window.el('div', {
        style: 'display:flex;justify-content:space-between;align-items:center;',
      },
        window.el('span', {
          style: 'font-size:13.5px;font-weight:700;color:#16203a;',
        }, 'Total do pedido'),
        window.el('span', {
          style: 'font-size:14px;font-weight:800;color:#16203a;',
        }, fmtMetros(acompanhamento.totais.pedido))
      ));
      return card;
    }

    function buildAvisos() {
      if (!state.pedido || !state.pendencias.length) return window.el('div', {});
      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:14px 18px;margin-bottom:14px;',
      });
      card.appendChild(window.el('div', {
        style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:8px;',
      }, 'Pendências'));
      state.pendencias.forEach(function (item) {
        card.appendChild(window.el('div', {
          style: 'display:flex;align-items:center;gap:8px;font-size:13.5px;color:#5b6472;margin-top:6px;',
        },
          window.el('span', {
            style: 'width:7px;height:7px;border-radius:50%;background:#d99a2b;display:inline-block;flex-shrink:0;',
          }),
          String(item)
        ));
      });
      return card;
    }

    function buildEntregasResumo() {
      if (!state.pedido) return window.el('div', {});
      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;overflow:hidden;margin-bottom:14px;',
      });
      card.appendChild(window.el('div', {
        style: 'padding:14px 20px 12px;font-size:15px;font-weight:700;color:#16203a;border-bottom:1px solid #eceef1;',
      }, 'Entrega e expedição'));

      if (!state.entregasResumo.length) {
        card.appendChild(window.el('p', {
          style: 'padding:14px 20px;font-size:14px;color:#9aa2af;',
        }, 'Ainda não há entrega registrada para este pedido.'));
        return card;
      }

      card.appendChild(window.el('div', {
        style: 'display:grid;grid-template-columns:1fr 130px;gap:12px;padding:10px 20px;background:#f8f9fb;border-bottom:1px solid #eceef1;',
      },
        window.el('div', { style: 'font-size:11.5px;font-weight:600;color:#9aa2af;' }, 'Atualização'),
        window.el('div', {
          style: 'font-size:11.5px;font-weight:600;color:#9aa2af;text-align:right;',
        }, 'Quantidade')
      ));

      state.entregasResumo.forEach(function (row, idx) {
        card.appendChild(window.el('div', {
          style: 'display:grid;grid-template-columns:1fr 130px;gap:12px;padding:11px 20px;align-items:center;'
            + (idx === state.entregasResumo.length - 1 ? '' : 'border-bottom:1px solid #f1f3f6;'),
        },
          window.el('div', {},
            window.el('div', {
              style: 'font-size:14px;font-weight:600;color:#16203a;',
            }, fmtTextoOuEmpty(row.descricao, 'Entrega registrada')),
            window.el('div', {
              style: 'font-size:12.5px;color:#9aa2af;margin-top:2px;',
            }, fmtEventoData(row.data))
          ),
          window.el('div', {
            style: 'text-align:right;font-size:13.5px;font-weight:700;color:#16203a;',
          }, fmtMetros(row.quantidade))
        ));
      });
      return card;
    }

    // Item do historico: ponto + linha vertical + conteudo.
    function buildEventoItem(evento, isLast, isFirst) {
      var dotColor = isFirst ? '#2563eb' : '#cfd5de';
      return window.el('div', {
        style: 'display:flex;gap:14px;',
      },
        window.el('div', {
          style: 'display:flex;flex-direction:column;align-items:center;',
        },
          window.el('div', {
            style: 'width:11px;height:11px;border-radius:50%;background:' + dotColor
              + ';margin-top:4px;flex-shrink:0;',
          }),
          isLast ? null : window.el('div', {
            style: 'width:2px;flex:1;background:#eceef1;margin-top:4px;',
          })
        ),
        window.el('div', { style: 'padding-bottom:' + (isLast ? '0' : '14px') + ';' },
          window.el('div', {
            style: 'font-size:12px;color:#9aa2af;',
          }, fmtEventoData(evento.criado_em)),
          window.el('div', {
            style: 'font-size:14px;font-weight:' + (isFirst ? '700' : '600') + ';color:'
              + (isFirst ? '#16203a' : '#475065') + ';margin-top:2px;',
          }, fmtTextoOuEmpty(evento.titulo, 'Atualização')),
          evento.mensagem
            ? window.el('div', {
                style: 'font-size:13px;color:#7b8494;margin-top:1px;',
              }, evento.mensagem)
            : null
        )
      );
    }

    // Seção Histórico: titulo fora do card + card com timeline vertical.
    function buildEventos() {
      if (!state.pedido) return window.el('div', {});

      var wrap = window.el('div', {});

      wrap.appendChild(window.el('div', {
        style: 'font-size:15px;font-weight:700;color:#16203a;margin-bottom:10px;',
      }, 'Histórico'));

      var card = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;',
      });

      if (state.eventosError) {
        card.appendChild(window.el('p', { style: 'font-size:14px;color:#b45309;' },
          'Não foi possível carregar as atualizações agora.'));
        wrap.appendChild(card);
        return wrap;
      }

      if (state.eventos.length === 0) {
        card.appendChild(window.el('p', { style: 'font-size:14px;color:#9aa2af;' },
          'Assim que houver novas atualizações, elas aparecerão aqui.'));
        wrap.appendChild(card);
        return wrap;
      }

      state.eventos.forEach(function (evento, idx) {
        card.appendChild(
          buildEventoItem(evento, idx === state.eventos.length - 1, idx === 0)
        );
      });

      wrap.appendChild(card);
      return wrap;
    }

    function render() {
      var header = buildHeader();
      if (loadingError === 'pedido') {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded border border-gray-200 p-6 text-red-700' },
            'Pedido não encontrado ou sem permissão. Ele pode ter sido removido.'));
        return;
      }
      if (loadingError === 'summary') {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded border border-gray-200 p-6 text-red-700' },
            'Não foi possível carregar o resumo público do pedido. Tente recarregar a página.'));
        return;
      }
      if (loadingError) {
        container.replaceChildren(header,
          window.el('div', { class: 'bg-white rounded border border-gray-200 p-6 text-red-700' },
            'Erro ao carregar dados do pedido. Tente recarregar a página.'));
        return;
      }
      container.replaceChildren(
        header,
        buildResumo(),
        buildDadosGerais(),
        buildTracking(),
        buildAvisos(),
        window.el('div', { class: 'grid grid-cols-2 gap-3 mb-3' }, buildItens(), buildDistribuicaoAtual()),
        buildEntregasResumo(),
        buildParciais(),
        buildEventos()
      );
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidoDetail = {
    screenClientePedidoDetalhe: screenClientePedidoDetalhe,
  };

  window.screenClientePedidoDetalhe = screenClientePedidoDetalhe;
})(window);
