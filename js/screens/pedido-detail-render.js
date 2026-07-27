// =====================================================================
// === SCREENS: PEDIDO DETAIL RENDER ===================================
// Render do detalhe do pedido alinhado ao standalone.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  function corNomeById(state, id) {
    if (id == null) return null;
    var cor = state.coresById[id];
    return cor && cor.nome ? cor.nome : null;
  }

  function resolveItemColorIds(state, item) {
    var modelo = state.modelosById[item.modelo_id] || {};
    return {
      cor1: item.cor_1_id != null ? item.cor_1_id : modelo.cor_1_id,
      cor2: item.cor_2_id != null ? item.cor_2_id : modelo.cor_2_id,
    };
  }

  function modelLabel(state, item) {
    var modelo = state.modelosById[item.modelo_id];
    if (!modelo) return '-';
    var larguraValue = item.largura != null ? item.largura : modelo.largura;
    var larguraLabel = larguraValue != null
      ? Number(larguraValue).toFixed(2).replace('.', ',') + ' m'
      : '-';
    var base = modelo.nome + ' · ' + larguraLabel;
    // PHASE-MANTA-A: prefix the canonical product type when available; the
    // colors are rendered separately by itemCoresLabel.
    var display = window.RAVATEX_OP_DISPLAY;
    if (modelo.tipo_produto != null && display && typeof display.productTypeLabel === 'function') {
      return display.productTypeLabel(modelo.tipo_produto) + ' · ' + base;
    }
    return base;
  }

  function itemCoresLabel(state, item) {
    var ids = resolveItemColorIds(state, item);
    var cor1 = corNomeById(state, ids.cor1) || '-';
    var cor2 = corNomeById(state, ids.cor2) || '-';
    return cor1 + ' / ' + cor2;
  }

  function itemPreviewEl(state, item) {
    var ids = resolveItemColorIds(state, item);
    var corNome = corNomeById(state, ids.cor1);
    if (corNome && window.corPreviewElement) {
      var thumb = window.corPreviewElement(corNome, '32px');
      if (thumb) {
        thumb.style.borderRadius = '4px';
        thumb.style.border = '1px solid var(--rv-border)';
        thumb.style.flexShrink = '0';
        return thumb;
      }
    }
    return window.el('div', {
      style: 'width:32px;height:32px;border-radius:4px;border:1px solid var(--rv-border);background:var(--rv-bg);flex-shrink:0;',
    });
  }

  function buildStatusPill(statusKey, handlers) {
    var map = {
      rascunho: { bg: 'var(--rv-surface-subtle)', text: 'var(--rv-text-secondary)' },
      recebido: { bg: 'var(--rv-pill-info-bg)', text: 'var(--rv-accent-blue)' },
      confirmado: { bg: 'var(--rv-pill-info-bg)', text: 'var(--rv-accent-blue)' },
      produzindo: { bg: 'var(--rv-signal-caution-bg)', text: 'var(--rv-signal-caution)' },
      entregue: { bg: 'var(--rv-signal-positive-bg)', text: 'var(--rv-signal-positive)' },
      cancelado: { bg: 'var(--rv-surface)', text: 'var(--rv-signal-negative)' },
    };
    var tone = map[statusKey] || { bg: 'var(--rv-surface-subtle)', text: 'var(--rv-text-secondary)' };
    var actions = ns.nextActionsForStatus(statusKey);
    var label = window.pedidoStatusLabel
      ? window.pedidoStatusLabel(statusKey)
      : ns.fmtTextoOuEmpty(statusKey, 'Status');
    var attrs = {
      type: 'button',
      style: 'display:inline-flex;align-items:center;gap:7px;background:' + tone.bg + ';color:' + tone.text + ';border:none;border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;font-family:inherit;cursor:' + (actions.length ? 'pointer' : 'default') + ';',
      title: actions.length ? 'Abrir acoes do pedido' : 'Sem acoes disponiveis',
    };
    if (actions.length) attrs.onclick = handlers.openStatusActions;
    return window.el('button', attrs,
      actions.length ? window.el('span', {
        style: 'width:7px;height:7px;border-radius:var(--rv-radius-pill);background:' + tone.text + ';display:inline-block;flex-shrink:0;',
      }) : null,
      label
    );
  }

  function buildOperationalPill(chainState) {
    var label = chainState && chainState.displayStatus ? chainState.displayStatus : 'Pedido';
    return window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-signal-caution-bg);color:var(--rv-signal-caution);border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;',
      title: 'Status operacional derivado das OPs vinculadas',
    },
      window.el('span', {
        style: 'width:7px;height:7px;border-radius:var(--rv-radius-pill);background:var(--rv-signal-caution);display:inline-block;flex-shrink:0;',
      }),
      label
    );
  }

  function buildSummaryMetric(title, value, color) {
    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:13px 15px;',
    },
      window.el('div', {
        style: 'font-size:11.5px;color:var(--rv-text-tertiary);font-weight:600;margin-bottom:6px;',
      }, title),
      window.el('div', {
        style: 'font-size:var(--rv-fs-metric);font-weight:800;color:' + color + ';',
      }, value)
    );
  }

  function buildHeader(state, view, handlers) {
    var pedido = state.pedido;
    if (!pedido) {
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;',
      },
        window.el('div', {
          style: 'font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;',
        }, 'Pedido'),
        window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:8px;border:1px solid var(--rv-border-strong);background:var(--rv-surface);color:var(--rv-text-primary);border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;',
          onclick: handlers.navigateToPedidos,
        }, ns.svgEl(ns.SVG_BACK), 'Voltar')
      );
    }

    var numero = ns.fmtNumero(pedido.numero);
    var updatedAt = ns.fmtDataHora(pedido.atualizado_em);
    var prazo = ns.fmtData(pedido.prazo_desejado || pedido.prazo_entrega);
    var editBtn = handlers.buildEditButton();
    var deleteBtn = handlers.buildDeleteButton ? handlers.buildDeleteButton() : null;
    var chainState = view && view.chainState ? view.chainState : null;
    var showOperationalStatus = !!(chainState && chainState.isOperationalOverride);

    var breadcrumb = window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;',
    },
      window.el('div', { style: 'font-size:14px;color:var(--rv-text-tertiary);' },
        'Pedidos',
        window.el('span', { style: 'margin:0 4px;color:var(--rv-text-tertiary);' }, '/'),
        window.el('span', { style: 'color:var(--rv-text-secondary);font-weight:600;' }, ' Pedido ' + numero)
      ),
      window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:8px;border:1px solid var(--rv-border-strong);background:var(--rv-surface);color:var(--rv-text-primary);border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;',
        onclick: handlers.navigateToPedidos,
      }, ns.svgEl(ns.SVG_BACK), 'Voltar')
    );

    var titleRow = window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px 16px;margin-bottom:16px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:240px;' },
          window.el('div', {
            style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
          },
            window.el('h1', {
              style: 'margin:0;font-size:var(--rv-fs-title);font-weight:800;color:var(--rv-text-primary);letter-spacing:-.01em;line-height:1.1;',
            }, 'Pedido ' + numero),
            showOperationalStatus ? buildOperationalPill(chainState) : buildStatusPill(pedido.status, handlers),
            showOperationalStatus ? window.el('span', {
              style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface-subtle);color:var(--rv-text-secondary);border-radius:4px;padding:4px 11px;font-size:12px;font-weight:600;',
            }, 'Comercial: ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(pedido.status) : ns.fmtTextoOuEmpty(pedido.status, 'Status'))) : null,
            window.el('span', {
              style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface-subtle);color:var(--rv-text-tertiary);border-radius:4px;padding:4px 11px;font-size:12px;font-weight:600;',
            }, 'Origem: Cliente')
          ),
          window.el('div', {
            style: 'font-size:13px;color:var(--rv-text-tertiary);margin-top:6px;',
          }, ns.fmtTextoOuEmpty((state.cliente && state.cliente.nome) || 'Pedido', 'Pedido') + ' · Atualizado em ' + updatedAt)
        ),
        window.el('div', {
          style: 'display:flex;align-items:center;gap:18px;flex-wrap:wrap;',
        },
          window.el('div', {
            style: 'display:flex;align-items:center;gap:10px;',
          },
            ns.svgEl(ns.SVG_CAL),
            window.el('div', {},
              window.el('div', {
                style: 'font-size:11.5px;color:var(--rv-text-tertiary);',
              }, 'Prazo previsto'),
              window.el('div', {
                style: 'font-size:var(--rv-fs-metric-rail);font-weight:700;color:var(--rv-text-primary);',
              }, prazo)
            )
          ),
          window.el('div', {
            style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
          },
            editBtn,
            deleteBtn,
            window.el('button', {
              type: 'button',
              style: 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-text-primary);border:1px solid var(--rv-border-strong);border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
              onclick: function () { handlers.scrollToSection('documentos'); },
            }, ns.svgEl(ns.SVG_DOC), 'Documentos')
          )
        )
      )
    );

    return window.el('div', {}, breadcrumb, titleRow);
  }

  // PHASE-MANTA-B2B-R2 (D4.2): as metricas agregadas seguem as rotas
  // APLICAVEIS do Pedido.
  //   - Manta-only: a metrica "Em acabamento" e SUPRIMIDA (exibi-la como
  //     zero afirmaria que o estagio existe na rota) e substituida pela
  //     metrica verdadeira daquela rota, a saida medida.
  //   - Misto: "Em acabamento" permanece e continua contendo SO valores
  //     Tapete — `view.emAcabamento` soma apenas OPs de acabamento
  //     (`ops.tipo='latex'`), onde nenhuma Manta pode existir; a saida
  //     medida da Manta e exibida ao lado, na sua propria metrica.
  //   - Tapete-only: identico ao comportamento anterior.
  function buildResumo(view) {
    var summary = view.routeSummary || null;
    var hasAcabamento = summary ? summary.hasAcabamento !== false : true;
    var hasManta = !!(summary && summary.hasManta);
    var metrics = [
      buildSummaryMetric('Total do pedido', ns.fmtMetrosShort(view.totalPedido), 'var(--rv-text-primary)'),
      buildSummaryMetric('Em tecelagem', ns.fmtMetrosShort(view.emTecelagem), 'var(--rv-stage-tecelagem)'),
    ];
    if (hasAcabamento) {
      metrics.push(buildSummaryMetric('Em acabamento', ns.fmtMetrosShort(view.emAcabamento), 'var(--rv-signal-caution)'));
    }
    if (hasManta) {
      metrics.push(buildSummaryMetric('Saida medida (Manta)', ns.fmtMetrosShort(summary.mantaMedido), 'var(--rv-stage-tecelagem)'));
    }
    metrics.push(buildSummaryMetric('Pronto/expedicao', ns.fmtMetrosShort(view.prontoExpedicao), 'var(--rv-accent-blue)'));
    metrics.push(buildSummaryMetric('Entregue', ns.fmtMetrosShort(view.entregue), 'var(--rv-signal-positive)'));
    metrics.push(buildSummaryMetric('Pendencias documentais', String(view.pendingDocs), 'var(--rv-signal-negative)'));

    return window.el('div', {
      'data-rv-metrics': '',
      style: 'display:grid;grid-template-columns:repeat(' + metrics.length + ',minmax(0,1fr));gap:10px;margin-bottom:16px;',
    }, metrics);
  }

  function buildDadosGerais(state) {
    var pedido = state.pedido || {};
    var fields = [
      { label: 'Cliente', value: ns.fmtTextoOuEmpty(state.cliente && state.cliente.nome, '-'), strong: true },
      { label: 'Referencia do cliente', value: ns.fmtTextoOuEmpty(pedido.referencia_cliente, '-') },
      { label: 'Prazo desejado', value: ns.fmtData(pedido.prazo_desejado || pedido.prazo_entrega) },
      { label: 'Recebimento', value: ns.RECEBIMENTO_LABEL[pedido.tipo_recebimento] || ns.fmtTextoOuEmpty(pedido.tipo_recebimento, '-') },
    ];

    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
        }, 'Dados gerais'),
        window.el('div', {
          style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:var(--rv-text-tertiary);font-weight:600;',
        }, ns.svgEl(ns.SVG_LOCK), 'Bloqueado apos emissao')
      ),
      window.el('div', {
        'data-rv-metrics': '',
        style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;',
      }, fields.map(function (field) {
        return window.el('div', {},
          window.el('label', {
            style: 'display:block;font-size:12px;color:var(--rv-text-tertiary);margin-bottom:6px;',
          }, field.label),
          window.el('div', {
            style: 'border:1px solid var(--rv-border-soft);background:var(--rv-surface-subtle);border-radius:4px;padding:9px 12px;font-size:13.5px;color:var(--rv-text-primary);' + (field.strong ? 'font-weight:600;' : ''),
          }, field.value)
        );
      }))
    );
  }

  function buildStageNode(stage, index, onclick) {
    var outerStyle;
    var inner;

    if (stage.state === 'done') {
      outerStyle = 'width:42px;height:42px;border-radius:var(--rv-radius-pill);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px var(--rv-surface);background:' + stage.color + ';color:var(--rv-text-on-brand);';
      inner = ns.svgEl(ns.SVG_CHECK);
    } else {
      var pct = Math.max(0, Math.min(100, stage.percent || 0));
      outerStyle = 'width:42px;height:42px;border-radius:var(--rv-radius-pill);background:conic-gradient(from -90deg,' + stage.color + ' 0% ' + pct + '%,var(--rv-surface-subtle) ' + pct + '%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px var(--rv-surface);';
      inner = window.el('div', {
        style: 'width:32px;height:32px;border-radius:var(--rv-radius-pill);background:var(--rv-surface);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:' + (stage.state === 'future' ? 'var(--rv-text-tertiary)' : stage.color) + ';',
      }, String(index + 1));
    }

    var circleNode = window.el('div', { style: outerStyle }, inner);
    if (typeof onclick === 'function') {
      circleNode = window.el('button', {
        type: 'button',
        style: outerStyle + 'cursor:pointer;border:none;padding:0;font-family:inherit;',
        onclick: onclick,
        title: 'Ver detalhes da etapa ' + (stage.label || ''),
        'aria-label': 'Ver detalhes da etapa ' + (stage.label || ''),
      }, inner);
    }

    return window.el('div', {
      style: 'display:flex;flex-direction:column;align-items:center;',
    },
      circleNode,
      window.el('div', {
        style: 'margin-top:10px;font-size:12.5px;color:' + (stage.state === 'future' ? 'var(--rv-text-primary)' : 'var(--rv-text-primary)') + ';font-weight:700;text-align:center;',
      }, stage.label),
      window.el('div', {
        style: 'font-size:11px;color:' + (stage.state === 'future' ? 'var(--rv-text-tertiary)' : stage.color) + ';margin-top:2px;' + (stage.state === 'current' ? 'font-weight:600;' : ''),
      }, stage.sublabel)
    );
  }

  function isConnectorDoneAction(action) {
    var label = String(action && action.label ? action.label : '').toLowerCase();
    // Defesa B2: labels de aguardo/bloqueio nunca podem ser lidos como
    // "Concluído", mesmo que o mode seja view por engano.
    if (label.indexOf('aguard') >= 0) return false;
    return label.indexOf('conclu') >= 0;
  }

  function buildConnectorVisual(stage, action, disabled) {
    var mode = action && action.mode ? action.mode : 'enabled';
    var label = String(action && action.label ? action.label : '').toLowerCase();
    var transfer = stage && stage.transfer ? stage.transfer : {};
    // Defesa B2: uma action que representa aguardo/bloqueio (mesmo em
    // modo view) não pode virar Concluído. O gate canônico fica em
    // pedido-chain-state.js (transferInsumosToTecelagem); este é o
    // backstop do render.
    var isWaiting = mode === 'disabled' || mode === 'hidden' || label.indexOf('aguard') >= 0;
    if (!isWaiting && (isConnectorDoneAction(action) || mode === 'view')) {
      return { state: 'done', label: 'Concluído' };
    }
    if (disabled || isWaiting) {
      if (transfer.forceActionConnector && transfer.connectorLabel) {
        return { state: 'active', label: transfer.connectorLabel };
      }
      return { state: 'waiting', label: 'Aguardar' };
    }
    if (transfer.connectorLabel) {
      return { state: 'active', label: transfer.connectorLabel };
    }
    return { state: 'active', label: 'Transferir' };
  }

  function buildConnectorTitle(stage, action, visual) {
    return (stage.transfer && stage.transfer.title) || (action && action.label) || visual.label;
  }

  function buildConnectorStyle(visual, clickable) {
    var tones = {
      done: { bg: 'var(--rv-signal-positive-bg)', color: 'var(--rv-signal-positive)' },
      waiting: { bg: 'var(--rv-surface-subtle)', color: 'var(--rv-text-tertiary)' },
      active: { bg: 'var(--rv-accent-blue)', color: 'var(--rv-text-on-brand)' },
    };
    var tone = tones[visual.state] || tones.waiting;
    return 'min-width:100px;height:30px;padding:0 14px;display:flex;align-items:center;justify-content:center;gap:5px;'
      + 'background:' + tone.bg + ';color:' + tone.color + ';border:none;'
      + 'font-size:11px;font-weight:700;font-family:inherit;line-height:1;letter-spacing:.02em;white-space:nowrap;box-sizing:border-box;'
      + 'clip-path:polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%, 13px 50%);'
      + 'cursor:' + (clickable ? 'pointer' : 'default') + ';'
      + (visual.state === 'active' && clickable ? '' : '');
  }

  function buildTransferButton(stage, handlers, view) {
    if (!stage.transfer) {
      return window.el('div', { style: 'display:flex;align-items:center;justify-content:center;height:42px;' });
    }
    var action = stage.transfer.action || {};
    var mode = action.mode || 'enabled';
    var disabled = mode === 'disabled' || (!stage.transfer.op && !stage.transfer.allowWithoutOp);
    var visual = buildConnectorVisual(stage, action, disabled);
    var title = buildConnectorTitle(stage, action, visual);
    var clickable = typeof handlers.openMovementModal === 'function';
    return window.el('div', {
      style: 'display:flex;align-items:center;justify-content:center;height:42px;',
    },
      clickable
        ? window.el('button', {
            type: 'button',
            title: title,
            'aria-label': title,
            style: buildConnectorStyle(visual, true),
            onclick: function () {
              handlers.openMovementModal(stage.transfer);
            },
          }, visual.label)
        : window.el('div', {
            title: title,
            'aria-label': title,
            style: buildConnectorStyle(visual, false),
          }, visual.label)
    );
  }

  // PHASE-MANTA-B2B: o stepper fixo de 5 estagios deu lugar a uma SECAO
  // por rota. O arranjo por rota vive em `pedidoRouteSectionsUi`; este
  // modulo continua dono dos nos de estagio e conector e os injeta.
  function buildStepper(view, handlers) {
    var sections = Array.isArray(view.routeSections) && view.routeSections.length
      ? view.routeSections
      : [{ route: null, label: null, stepper: view.stepper || [] }];
    var sectionsUi = (window.RAVATEX_SCREENS || {}).pedidoRouteSectionsUi;
    var body = sectionsUi ? sectionsUi.buildRouteSectionsNode(sections, {
      buildStageNode: function (stage, index) {
        return buildStageNode(stage, index, typeof handlers.openStageDetailModal === 'function'
          ? function () { handlers.openStageDetailModal(stage, view); } : null);
      },
      buildTransferButton: function (stage) { return buildTransferButton(stage, handlers, view); },
    }) : window.el('div', {});

    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 22px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:20px;',
      }, 'Progresso produtivo'),
      body,
      window.el('div', {
        style: 'display:flex;align-items:flex-start;gap:10px;background:var(--rv-surface-subtle);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:12px 14px;margin-top:22px;',
      },
        ns.svgEl(ns.SVG_INFO),
        window.el('span', {
          style: 'font-size:13px;color:var(--rv-pill-info-text);font-weight:500;line-height:1.5;',
        }, 'Estes numeros refletem as OPs vinculadas ao pedido. Cada botao "Transferir" abre a mesma operacao canonica da OP de origem - nao existe lancamento paralelo no Pedido.')
      )
    );
  }

  // D4.3: a coluna Acabamento so existe quando alguma rota do Pedido tem o
  // estagio. Num Pedido misto ela permanece, mas a linha de um item MANTA
  // mostra "—" (nao se aplica) em vez de 0 — zero afirmaria "nada em
  // acabamento", implicando que o estagio existe naquela rota.
  var ITEM_COLS_COM_ACAB = '44px 1.3fr .8fr .8fr .8fr .8fr .8fr 1.2fr 90px';
  var ITEM_COLS_SEM_ACAB = '44px 1.3fr .8fr .8fr .8fr .8fr 1.2fr 90px';

  function itemColsFor(showAcabamento) {
    return showAcabamento ? ITEM_COLS_COM_ACAB : ITEM_COLS_SEM_ACAB;
  }

  function itemMinWidthFor(showAcabamento) {
    return showAcabamento ? '980px' : '900px';
  }

  function buildItemRow(state, item, metrics, handlers, showAcabamento) {
    var ids = resolveItemColorIds(state, item);
    var c1Nome = corNomeById(state, ids.cor1);
    var c2Nome = corNomeById(state, ids.cor2);
    var c1Hex = window.corPreviewHex(c1Nome);
    var c2Hex = window.corPreviewHex(c2Nome);
    var isManta = metrics.route === 'manta';

    return window.el('div', {
      'data-rv-item-route': metrics.route || '',
      style: 'display:grid;grid-template-columns:' + itemColsFor(showAcabamento)
        + ';gap:10px;padding:12px 20px;align-items:center;border-bottom:1px solid var(--rv-border-soft);min-width:'
        + itemMinWidthFor(showAcabamento) + ';',
    },
      window.el('div', {}, itemPreviewEl(state, item)),
      window.el('div', {},
        window.el('div', {
          style: 'font-size:13.5px;font-weight:700;color:var(--rv-text-primary);margin-bottom:4px;',
        }, modelLabel(state, item)),
        window.el('div', { style: 'display:flex;align-items:center;gap:5px;margin-bottom:4px;' },
          window.el('span', {
            style: 'width:14px;height:14px;border-radius:var(--rv-radius-pill);background:' + c1Hex + ';border:1px solid var(--rv-border);display:inline-block;flex-shrink:0;',
          }),
          c2Nome ? window.el('span', {
            style: 'width:14px;height:14px;border-radius:var(--rv-radius-pill);background:' + c2Hex + ';border:1px solid var(--rv-border-strong);display:inline-block;flex-shrink:0;',
          }) : null
        ),
        window.el('div', {
          style: 'font-size:12px;color:var(--rv-text-tertiary);',
        }, itemCoresLabel(state, item))
      ),
      window.el('div', { style: 'font-size:13.5px;color:var(--rv-text-primary);font-weight:600;' }, ns.fmtMetrosShort(item.metros)),
      window.el('div', { style: 'font-size:13.5px;color:var(--rv-stage-tecelagem);font-weight:700;' }, ns.fmtMetrosShort(metrics.tecelagem)),
      showAcabamento
        ? window.el('div', {
            'data-rv-item-acabamento': isManta ? 'nao-aplicavel' : 'aplicavel',
            style: 'font-size:13.5px;color:' + (isManta ? 'var(--rv-text-tertiary)' : 'var(--rv-signal-caution)') + ';font-weight:700;',
            title: isManta ? 'A rota Manta nao tem etapa de acabamento.' : '',
          }, isManta ? '—' : ns.fmtMetrosShort(metrics.acabamento))
        : null,
      window.el('div', { style: 'font-size:13.5px;color:var(--rv-accent-blue);font-weight:700;' }, ns.fmtMetrosShort(metrics.prontos)),
      window.el('div', { style: 'font-size:13.5px;color:var(--rv-signal-positive);font-weight:700;' }, ns.fmtMetrosShort(metrics.entregues)),
      window.el('div', { style: 'font-size:12.5px;color:var(--rv-accent-blue);font-weight:600;' }, metrics.relatedOpsLabel),
      window.el('div', { style: 'text-align:right;' },
        window.el('button', {
          type: 'button',
          style: 'font-size:12.5px;color:var(--rv-accent-blue);font-weight:600;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;',
          onclick: function () { handlers.scrollToSection('ops-vinculadas'); },
        }, 'Ver cadeia')
      )
    );
  }

  function buildItens(state, view, handlers) {
    var card = window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;margin-bottom:14px;overflow:hidden;',
    });

    card.appendChild(window.el('div', {
      style: 'padding:16px 20px 12px;font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
    }, 'Itens do pedido'));

    if (state.itens.length === 0) {
      card.appendChild(window.el('div', {
        style: 'padding:18px 20px;font-size:14px;color:var(--rv-text-tertiary);',
      }, 'Este pedido nao possui itens.'));
      return card;
    }

    // A coluna ACABAMENTO desaparece quando nenhuma rota aplicavel tem o
    // estagio (Pedido Manta-only). Num Pedido misto ela fica, com "—" nas
    // linhas Manta.
    var showAcabamento = view.routeSummary ? view.routeSummary.hasAcabamento !== false : true;
    var head = window.el('div', {
      'data-rv-table-scroll': '',
      style: 'overflow-x:auto;',
    });

    function th(label, alignRight) {
      return window.el('div', {
        style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.03em;' + (alignRight ? 'text-align:right;' : ''),
      }, label);
    }

    head.appendChild(window.el('div', {
      style: 'display:grid;grid-template-columns:' + itemColsFor(showAcabamento)
        + ';gap:10px;padding:9px 20px;background:var(--rv-surface-subtle);border-top:1px solid var(--rv-border);border-bottom:1px solid var(--rv-border);min-width:'
        + itemMinWidthFor(showAcabamento) + ';',
    },
      window.el('div', {}),
      th('MODELO / CORES'),
      th('PEDIDO'),
      th('TECELAGEM'),
      showAcabamento ? th('ACABAMENTO') : null,
      th('PRONTOS'),
      th('ENTREGUES'),
      th('OPs RELACIONADAS'),
      th('ACAO', true)
    ));

    state.itens.forEach(function (item) {
      head.appendChild(buildItemRow(state, item, view.itemMetricsById[item.id] || {
        route: null,
        tecelagem: 0,
        acabamento: 0,
        prontos: 0,
        entregues: 0,
        relatedOpsLabel: '-',
      }, handlers, showAcabamento));
    });

    card.appendChild(head);
    return card;
  }

  function buildDocBanner(banner) {
    var tone = banner && banner.tone === 'danger'
      ? { bg: 'var(--rv-surface)', border: 'var(--rv-signal-negative-border)', text: 'var(--rv-signal-negative)', stroke: 'var(--rv-signal-negative)' }
      : banner && banner.tone === 'warning'
        ? { bg: 'var(--rv-signal-caution-bg)', border: 'var(--rv-signal-caution-border)', text: 'var(--rv-signal-caution)', stroke: 'var(--rv-signal-caution)' }
        : { bg: 'var(--rv-surface-subtle)', border: 'var(--rv-border)', text: 'var(--rv-text-secondary)', stroke: 'var(--rv-text-tertiary)' };

    return window.el('div', {
      style: 'display:flex;align-items:center;gap:7px;background:' + tone.bg + ';border:1px solid ' + tone.border + ';border-radius:4px;padding:8px 10px;margin-top:2px;',
    },
      ns.svgEl('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + tone.stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'),
      window.el('span', {
        style: 'font-size:12px;color:' + tone.text + ';font-weight:500;',
      }, banner ? banner.text : 'Pendencia documental')
    );
  }

  function buildFooterAction(label, onclick, primary, disabled) {
    var attrs = {
      type: 'button',
      style: 'min-width:72px;min-height:34px;box-sizing:border-box;background:' + (disabled ? 'var(--rv-surface-subtle)' : (primary ? 'var(--rv-brand)' : 'var(--rv-surface)')) + ';color:' + (disabled ? 'var(--rv-text-tertiary)' : (primary ? 'var(--rv-text-on-brand)' : 'var(--rv-text-primary)')) + ';border:' + (primary && !disabled ? 'none' : '1px solid var(--rv-border-strong)') + ';border-radius:4px;padding:7px 12px;font-size:12.5px;font-weight:' + (primary ? '700' : '600') + ';font-family:inherit;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';white-space:nowrap;line-height:1.3;display:inline-flex;align-items:center;justify-content:center;',
    };
    if (disabled) {
      attrs.disabled = 'disabled';
    } else if (typeof onclick === 'function') {
      attrs.onclick = onclick;
    }
    return window.el('button', attrs, label);
  }

  // D4.3/D4.4: vocabulario do card de OP por rota. Uma OP de tecelagem
  // MANTA nunca entrega "p/ acabamento" nem transita "Tecelagem ->
  // Acabamento": a saida medida vai direto para a Expedicao. A rota vem de
  // `summary.route` (`modelos.tipo_produto`), nunca de `ops.tipo`.
  var OP_CARD_LABELS = {
    manta: {
      entregue: 'Saida medida',
      movTitle: 'Movimentar para Expedicao',
      movDestino: 'Expedicao',
      movDocs: 'NF de expedicao',
    },
    tapete: {
      entregue: 'Entregue p/ acabamento',
      movTitle: 'Transferir para Acabamento',
      movDestino: 'Acabamento',
      movDocs: 'Romaneio e NF',
    },
  };

  function opCardLabels(summary) {
    if (summary.stageKey !== 'tecelagem') {
      return { entregue: null, movTitle: 'Movimentar para Expedicao', movDestino: 'Expedicao', movDocs: 'NF de expedicao' };
    }
    return OP_CARD_LABELS[summary.route === 'manta' ? 'manta' : 'tapete'];
  }

  function buildOpCard(state, summary, handlers) {
    var labels = opCardLabels(summary);
    var typeTone = summary.stageKey === 'tecelagem'
      ? { bg: 'var(--rv-stage-tecelagem-bg)', text: 'var(--rv-stage-tecelagem)' }
      : { bg: 'var(--rv-signal-caution-bg)', text: 'var(--rv-signal-caution)' };

    var statusPill = window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:6px;background:' + summary.statusTone.bg + ';color:' + summary.statusTone.text + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:600;',
    },
      window.el('span', {
        style: 'width:6px;height:6px;border-radius:var(--rv-radius-pill);background:' + summary.statusTone.dot + ';display:inline-block;',
      }),
      summary.statusTone.label
    );

    var metricsBlock;
    if (summary.stageKey === 'tecelagem') {
      metricsBlock = window.el('div', {
        style: 'padding:14px 18px;display:flex;flex-direction:column;gap:9px;',
      },
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
        }, window.el('span', {}, 'Itens'), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:600;' }, summary.modelNames.length + (summary.modelNames.length ? ' (' + summary.modelNames.join(', ') + ')' : ''))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
        }, window.el('span', {}, 'Pedido total'), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:600;' }, ns.fmtMetros(summary.target))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
        }, window.el('span', {}, labels.entregue), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:600;' }, ns.fmtMetros(summary.done))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
        }, window.el('span', {}, 'Saldo em tecelagem'), window.el('span', { style: 'color:var(--rv-accent-blue);font-weight:700;' }, ns.fmtMetros(summary.remaining))),
        buildDocBanner(summary.docBanner)
      );
    } else {
      metricsBlock = window.el('div', {},
        summary.origemOp
          ? window.el('div', {
              style: 'padding:12px 18px 0;font-size:11.5px;color:var(--rv-text-tertiary);',
            }, 'Origem: entrega parcial de ', window.el('span', { style: 'color:var(--rv-accent-blue);font-weight:600;' }, summary.origemOpLabel || ns.opLabel(summary.origemOp)))
          : null,
        window.el('div', {
          style: 'padding:10px 18px 14px;display:flex;flex-direction:column;gap:9px;',
        },
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
          }, window.el('span', {}, 'Recebido da tecelagem'), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:600;' }, ns.fmtMetros(summary.target))),
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
          }, window.el('span', {}, 'Finalizado (pronto + entregue)'), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:600;' }, ns.fmtMetros(summary.done))),
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);',
          }, window.el('span', {}, 'Saldo em acabamento'), window.el('span', { style: 'color:var(--rv-signal-caution);font-weight:700;' }, ns.fmtMetros(summary.remaining))),
          buildDocBanner(summary.docBanner)
        )
      );
    }

    var movementAction = summary.chainAction || { mode: 'enabled', label: 'Movimentar' };
    var movementDisabled = movementAction.mode === 'disabled' || movementAction.mode === 'hidden';
    var movementView = movementAction.mode === 'view';
    var movementLabel = movementAction.label || (movementView ? 'Visualizar' : 'Movimentar');

    var pedidoNumero = state.pedido && state.pedido.numero ? state.pedido.numero : null;
    var lineageNodes = [];
    if (pedidoNumero) {
      lineageNodes.push(window.el('button', {
        type: 'button',
        style: 'font-size:12px;font-weight:600;color:var(--rv-accent-blue);background:var(--rv-pill-info-bg);border:none;border-radius:var(--rv-radius);padding:3px 7px;cursor:pointer;font-family:inherit;white-space:nowrap;',
        onclick: function () { handlers.scrollToSection ? null : null; },
      }, 'Pedido ' + pedidoNumero));
      lineageNodes.push(ns.svgEl('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'));
    }
    lineageNodes.push(window.el('span', {
      style: 'font-size:12.5px;font-weight:700;color:var(--rv-text-primary);',
    }, summary.label));
    if (summary.origemOp) {
      lineageNodes.push(ns.svgEl('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-tertiary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'));
      lineageNodes.push(window.el('button', {
        type: 'button',
        style: 'font-size:11.5px;font-weight:600;color:var(--rv-accent-blue);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;',
        onclick: function () { handlers.navigateToOp(summary.origemOp.id); },
      }, summary.origemOpLabel || ns.opLabel(summary.origemOp)));
    }
    var lineageStrip = window.el('div', {
      style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 18px;background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border-soft);',
    }, lineageNodes);

    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;overflow:hidden;',
    },
      lineageStrip,
      window.el('div', {
        style: 'padding:14px 18px;border-bottom:1px solid var(--rv-border-soft);display:flex;align-items:center;justify-content:space-between;',
      },
        window.el('div', { style: 'display:flex;align-items:center;gap:9px;' },
          window.el('span', {
            style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-accent-blue);',
          }, summary.label),
          window.el('span', {
            style: 'background:' + typeTone.bg + ';color:' + typeTone.text + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:600;',
          }, summary.stageLabel)
        ),
        statusPill
      ),
      metricsBlock,
      // Pass-5 SPLIT_RISK_FOOTER: the non-destructive action group stays on
      // the left and the destructive "Excluir OP" stays isolated on the
      // right. The separation is intentional and is preserved.
      window.el('div', {
        'data-card-actions': '',
        style: 'display:flex;gap:8px;padding-top:11px;padding-right:18px;padding-bottom:12px;padding-left:18px;border-top:1px solid var(--rv-border-soft);flex-wrap:wrap;align-items:center;justify-content:space-between;',
      },
        window.el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;' },
          buildFooterAction('Ver OP', function () { handlers.navigateToOp(summary.id); }, false),
          summary.stageKey === 'acabamento' && summary.op && summary.op.status === 'aberta' && typeof handlers.confirmEntradaAcabamento === 'function'
            ? buildFooterAction('Confirmar', function () { handlers.confirmEntradaAcabamento(summary.op); }, true)
            : null,
          buildFooterAction(movementLabel, function () {
            handlers.openMovementModal({
              title: labels.movTitle,
              origem: summary.stageLabel + ' - ' + summary.label,
              destino: labels.movDestino,
              detalhe: 'A movimentacao continua sendo registrada na OP vinculada.',
              op: summary.op,
              docs: labels.movDocs,
              action: movementAction,
            });
          }, movementAction.mode === 'enabled', movementDisabled),
          buildFooterAction('Documentos', function () { handlers.scrollToSection('documentos'); }, false)
        ),
        handlers && typeof handlers.excluirOpRelacionada === 'function' && summary.op && summary.op.id != null
          ? window.el('button', {
              type: 'button',
              title: 'Excluir OP (controlado, exige confirmacao forte)',
              style: 'display:inline-flex;align-items:center;justify-content:center;min-height:34px;box-sizing:border-box;background:var(--rv-surface);color:var(--rv-signal-negative);border:1px solid var(--rv-signal-negative-border);border-radius:4px;padding:7px 12px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;',
              onclick: function () { handlers.excluirOpRelacionada(summary.op); },
            }, 'Excluir OP')
          : null
      )
    );
  }

  function buildOps(state, view, handlers) {
    var wrap = window.el('div', {
      id: 'ops-vinculadas',
      style: 'margin-bottom:14px;',
    });
    var semOps = view.opSummaries.length === 0 && !state.opsLoadError;
    var firstOpButton = function () {
      return window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:9px 14px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: handlers.navigateToNovaOp,
      }, 'Gerar primeira OP');
    };

    wrap.appendChild(window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;',
    },
      window.el('div', {
        style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
      }, 'OPs vinculadas'),
      semOps ? firstOpButton() : null
    ));

    // Fallback global APENAS quando a camada base de OPs falhou de fato
    // (erro na consulta canônica de `ops`). Uma falha de enriquecimento
    // (consolidação Látex) nunca deve chegar aqui — ela é tratada como
    // aviso restrito abaixo, mantendo as OPs base visíveis.
    if (state.opsLoadError) {
      wrap.appendChild(window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px;font-size:14px;color:var(--rv-signal-caution);',
      }, 'Nao foi possivel consolidar as OPs vinculadas agora.'));
      return wrap;
    }

    if (view.opSummaries.length === 0) {
      wrap.appendChild(window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:240px;flex:1;' },
          window.el('div', {
            style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:6px;',
          }, 'Nenhuma OP vinculada ainda.'),
          window.el('div', {
            style: 'font-size:13px;color:var(--rv-text-secondary);line-height:1.5;',
          }, 'Proxima acao: gerar a primeira OP de Tecelagem. A cadeia produtiva passa a ser refletida aqui depois disso.'))
      ));
      return wrap;
    }

    // Aviso restrito: a base de OPs carregou, mas o enriquecimento da
    // consolidação Látex falhou (ex.: db/25 ainda não aplicada). As OPs
    // continuam visíveis; só alguns detalhes de produção podem faltar.
    if (state.opsEnrichError) {
      wrap.appendChild(window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:10px 14px;font-size:12.5px;color:var(--rv-signal-caution);margin-bottom:10px;',
      }, 'Alguns detalhes de producao nao puderam ser carregados.'));
    }

    wrap.appendChild(window.el('div', {
      'data-rv-2col': '',
      style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;',
    }, view.opSummaries.map(function (summary) {
      return buildOpCard(state, summary, handlers);
    })));
    return wrap;
  }

  function buildPurchaseDistributionEntry(state) {
    var pedidoId = state.pedido && state.pedido.id;
    if (!pedidoId) return null;
    return window.el('div', { id: 'pedido-insumos-distribuicao-entry', style: 'background:var(--rv-surface);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;' },
      window.el('div', {},
        window.el('div', { style: 'font-size:15px;font-weight:700;color:var(--rv-text-primary);' }, 'Insumos — distribuição de compra'),
        window.el('div', { style: 'font-size:13px;color:var(--rv-text-secondary);margin-top:4px;' }, 'Defina fornecedores e quantidades alvo das necessidades deste Pedido.')),
      window.el('button', { type: 'button', style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:9px 14px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;', onclick: function () { window.navigate('#/pedidos/' + pedidoId + '/insumos'); } }, 'Abrir distribuição'));
  }

  function buildExpedicoes(state, view, handlers) {
    var wrap = window.el('div', {
      id: 'expedicoes-vinculadas',
      style: 'margin-bottom:14px;',
    });

    wrap.appendChild(window.el('div', {
      style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:10px;',
    }, 'Expedicoes vinculadas'));

    if (state.expedicoesLoadError) {
      wrap.appendChild(window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px;font-size:14px;color:var(--rv-signal-caution);',
      }, 'Nao foi possivel validar as expedicoes vinculadas agora.'));
      return wrap;
    }

    if (!view.expedicaoSummaries.length) {
      wrap.appendChild(window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px;',
      },
        window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:6px;' }, 'Nenhuma expedicao liberada'),
        window.el('div', { style: 'font-size:13px;color:var(--rv-text-secondary);line-height:1.5;' },
          'A expedicao aparece aqui depois que uma OP de acabamento finalizada for liberada para entrega/coleta.')
      ));
      return wrap;
    }

    wrap.appendChild(window.el('div', {
      'data-rv-2col': '',
      style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;',
    }, view.expedicaoSummaries.map(function (summary) {
      var concluida = summary.status === 'concluida' && summary.saldo <= 0;
      return window.el('div', {
        style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;overflow:hidden;',
      },
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--rv-border-soft);',
        },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-accent-blue);' }, 'Expedicao #' + summary.id),
          window.el('span', {
            style: 'background:' + (concluida ? 'var(--rv-signal-positive-bg)' : 'var(--rv-signal-caution-bg)') + ';color:' + (concluida ? 'var(--rv-signal-positive)' : 'var(--rv-signal-caution)') + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:700;',
          }, summary.status)
        ),
        window.el('div', { style: 'padding:13px 18px;display:flex;flex-direction:column;gap:8px;' },
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);' },
            window.el('span', {}, 'Liberado'), window.el('span', { style: 'color:var(--rv-text-primary);font-weight:700;' }, ns.fmtMetros(summary.liberado))),
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);' },
            window.el('span', {}, 'Entregue/coletado'), window.el('span', { style: 'color:var(--rv-signal-positive);font-weight:700;' }, ns.fmtMetros(summary.entregue))),
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--rv-text-secondary);' },
            window.el('span', {}, 'Saldo'), window.el('span', { style: 'color:' + (summary.saldo > 0 ? 'var(--rv-signal-caution)' : 'var(--rv-signal-positive)') + ';font-weight:700;' }, ns.fmtMetros(summary.saldo))),
          window.el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);' },
            summary.movimentos.length ? summary.movimentos.length + ' movimento(s) registrado(s)' : 'Sem entrega/coleta registrada')
        ),
        window.el('div', { style: 'padding:12px 18px;border-top:1px solid var(--rv-border-soft);' },
          buildFooterAction('Abrir expedicao', function () { handlers.navigateToExpedicao(summary.id); }, true))
      );
    })));

    return wrap;
  }

  function buildConclusaoPedido(state, view, handlers) {
    var conclusao = view.pedidoConclusao || { pronto: false, pendencias: [], label: 'Validacao indisponivel.' };
    var jaEntregue = state.pedido && state.pedido.status === 'entregue';
    var ready = conclusao.pronto && !jaEntregue;
    var actionable = ready && handlers && typeof handlers.concluirPedido === 'function';
    var pendencias = conclusao.pendencias || [];
    var buttonAttrs = {
      type: 'button',
      style: 'display:inline-flex;align-items:center;justify-content:center;background:' + (actionable ? 'var(--rv-signal-positive)' : 'var(--rv-surface-subtle)') + ';color:' + (actionable ? 'var(--rv-text-on-brand)' : 'var(--rv-text-tertiary)') + ';border:none;border-radius:4px;padding:10px 16px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:' + (actionable ? 'pointer' : 'not-allowed') + ';',
    };
    if (actionable) {
      buttonAttrs.onclick = function (event) {
        handlers.concluirPedido(event && event.currentTarget ? event.currentTarget : null);
      };
    } else {
      buttonAttrs.disabled = 'disabled';
    }

    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:260px;max-width:720px;' },
          window.el('div', { style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:6px;' }, 'Conclusao do pedido'),
          window.el('div', { style: 'font-size:13px;color:var(--rv-text-secondary);line-height:1.5;' },
            jaEntregue ? 'Pedido ja concluido no fluxo operacional.' : conclusao.label),
          pendencias.length ? window.el('div', { style: 'margin-top:10px;display:flex;flex-direction:column;gap:5px;' },
            pendencias.map(function (pendencia) {
              return window.el('div', { style: 'font-size:12.5px;color:var(--rv-signal-caution);line-height:1.4;' }, '- ' + pendencia);
            })) : null
        ),
        window.el('button', buttonAttrs, jaEntregue ? 'Pedido concluido' : 'Concluir pedido')
      )
    );
  }

  function buildClienteStatusBadge(state, view) {
    var label = 'Recebido';
    var dot = 'var(--rv-pill-info-dot)';
    var bg = 'var(--rv-pill-info-bg)';
    var color = 'var(--rv-accent-blue)';

    if (view.trackingApi) {
      var statusKey = view.trackingSummary && view.trackingSummary.statusVisual
        ? view.trackingSummary.statusVisual
        : (state.pedido && state.pedido.status_cliente_visual) || 'recebido';
      var step = view.trackingApi.getClienteTrackingStep
        ? view.trackingApi.getClienteTrackingStep(statusKey)
        : null;
      var exception = view.trackingApi.getClienteTrackingException
        ? view.trackingApi.getClienteTrackingException(state.pedido && state.pedido.status_cliente_excecao)
        : null;
      if (exception) {
        label = exception.label;
        if (exception.tom === 'danger') {
          dot = 'var(--rv-pill-negative-dot)';
          bg = 'var(--rv-surface)';
          color = 'var(--rv-signal-negative)';
        } else if (exception.tom === 'warning') {
          dot = 'var(--rv-pill-caution-dot)';
          bg = 'var(--rv-signal-caution-bg)';
          color = 'var(--rv-signal-caution)';
        } else {
          dot = 'var(--rv-text-secondary)';
          bg = 'var(--rv-surface-subtle)';
          color = 'var(--rv-text-secondary)';
        }
      } else if (step) {
        label = step.label;
      }
    }

    if (view.trackingSummary && view.trackingSummary.statusModo === 'parcial') {
      label += ' · parcial';
    }

    return window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:7px;background:' + bg + ';color:' + color + ';border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;margin-bottom:12px;',
    },
      window.el('span', {
        style: 'width:7px;height:7px;border-radius:var(--rv-radius-pill);background:' + dot + ';display:inline-block;',
      }),
      label
    );
  }

  function buildClienteEvolution(state, view, handlers) {
    var progress = view.trackingApi && typeof view.trackingApi.getClienteTrackingProgress === 'function'
      ? view.trackingApi.getClienteTrackingProgress({
          status_cliente_visual: view.trackingSummary && view.trackingSummary.statusVisual ? view.trackingSummary.statusVisual : (state.pedido && state.pedido.status_cliente_visual),
          status_cliente_excecao: state.pedido && state.pedido.status_cliente_excecao,
          status_cliente_mensagem: state.pedido && state.pedido.status_cliente_mensagem,
        })
      : null;

    var currentIndex = progress && progress.currentIndex >= 0 ? progress.currentIndex : 0;
    // PHASE-MANTA-B2B-R3: a pre-visualizacao tem de exibir a MESMA posicao
    // visivel que a apresentacao real do cliente — um Pedido Manta-only
    // publica 7 etapas, logo "de 8" era falso. A traducao da posicao
    // comercial canonica para a forma da rota vive no dono do vocabulario
    // de tracking (js/pedido-tracking-ui.js); este modulo NAO reproduz
    // nenhuma lista de etapas por rota. A rota vem do view, ja derivada de
    // `modelos.tipo_produto`.
    var preview = view.trackingApi && typeof view.trackingApi.getClienteTrackingPreviewPosition === 'function'
      ? view.trackingApi.getClienteTrackingPreviewPosition(view.pedidoRoutes, currentIndex)
      : null;
    var totalSteps = preview ? preview.visibleTotal : (progress && progress.totalSteps ? progress.totalSteps : 8);
    var percent = preview ? preview.percent : Math.round(((currentIndex + 1) / totalSteps) * 100);
    var positionLabel = preview ? preview.label : ('Etapa ' + (currentIndex + 1) + ' de ' + totalSteps);
    // Pedido misto: o ordinal exibido e declaradamente de nivel Pedido, e a
    // posicao LOCAL de cada rota e resumida ao lado, sem inventar um total.
    var routeNote = preview && preview.mode === 'pedido-level' && preview.routePositions.length
      ? preview.routePositions.map(function (rp) {
          return 'Rota ' + (rp.label || '—') + ': ' + (rp.reachedLabel || '—')
            + (rp.nextLabel ? ' · próxima ' + rp.nextLabel : '');
        }).join(' | ')
      : null;
    var message = view.trackingSummary && view.trackingSummary.mensagemCliente
      ? view.trackingSummary.mensagemCliente
      : (state.pedido && state.pedido.status_cliente_mensagem)
        || 'A visao do cliente sera atualizada a partir das OPs vinculadas.';

    return window.el('div', {
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:16px 20px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);',
        }, 'Evolucao do Cliente'),
        window.el('span', {
          style: 'background:var(--rv-surface-subtle);color:var(--rv-text-tertiary);border-radius:4px;padding:3px 9px;font-size:11px;font-weight:600;',
        }, 'Pre-visualizacao')
      ),
      window.el('div', {
        style: 'background:var(--rv-surface-subtle);border:1px solid var(--rv-border);border-radius:4px;padding:14px 16px;',
      },
        window.el('div', {
          style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.05em;margin-bottom:10px;',
        }, 'O QUE O CLIENTE VE'),
        buildClienteStatusBadge(state, view),
        window.el('div', {
          style: 'font-size:13.5px;color:var(--rv-pill-info-text);font-weight:500;line-height:1.5;margin-bottom:12px;',
        }, '"' + message + '"'),
        window.el('div', {
          style: 'height:6px;border-radius:var(--rv-radius);background:var(--rv-surface-subtle);overflow:hidden;margin-bottom:6px;',
        },
          window.el('div', {
            style: 'width:' + percent + '%;height:100%;background:var(--rv-brand);',
          })
        ),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:11.5px;color:var(--rv-text-tertiary);',
        },
          window.el('span', { 'data-rv-preview-position': preview ? preview.mode : 'legado' }, positionLabel),
          window.el('span', {}, percent + '%')
        ),
        routeNote
          ? window.el('div', {
              'data-rv-preview-route-note': '',
              style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-top:6px;line-height:1.45;',
            }, routeNote)
          : null
      ),
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:12px;',
      },
        window.el('span', {
          style: 'font-size:11.5px;color:var(--rv-text-tertiary);',
        }, 'Atualiza a partir das OPs. Edite apenas a mensagem.'),
        window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface);color:var(--rv-accent-blue);border:1px solid var(--rv-brand);border-radius:4px;padding:7px 13px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;',
          onclick: handlers.openTrackingModal,
        }, ns.svgEl(ns.SVG_EDIT), 'Editar mensagem')
      )
    );
  }

  function buildDocumentStatusPill(status) {
    var tones = {
      anexado: { bg: 'var(--rv-signal-positive-bg)', text: 'var(--rv-signal-positive)', label: 'Anexado' },
      pendente: { bg: 'var(--rv-signal-caution-bg)', text: 'var(--rv-signal-caution)', label: 'Pendente' },
    };
    var tone = tones[status] || tones.pendente;
    return window.el('span', {
      style: 'background:' + tone.bg + ';color:' + tone.text + ';border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;flex-shrink:0;',
    }, tone.label);
  }

  function buildDocumentRow(row, withBorder) {
    return window.el('div', {
      style: 'padding:9px 0;' + (withBorder ? 'border-bottom:1px solid var(--rv-border-soft);' : ''),
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;',
      },
        window.el('div', {
          style: 'display:flex;align-items:center;gap:9px;min-width:0;',
        },
          ns.svgEl(ns.SVG_FILE),
          window.el('span', {
            style: 'font-size:13px;color:var(--rv-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
          }, row.label)
        ),
        buildDocumentStatusPill(row.status)
      ),
      window.el('div', {
        style: 'font-size:11px;color:var(--rv-text-tertiary);margin-top:3px;',
      }, row.meta)
    );
  }

  // G28-B7: one CONFIRMED canonical link row (Documento -> Pedido). Uses the
  // same badge helpers as the rest of the surface; distinguished from Ingestor
  // suggestions by an explicit "Vinculo confirmado" pill.
  function buildLinkedDocumentRow(row, withBorder) {
    var docRow = window.el('div', {
      style: 'padding:9px 0;' + (withBorder ? 'border-bottom:1px solid var(--rv-border-soft);' : ''),
    });

    var leftGroup = window.el('div', {
      style: 'display:flex;align-items:center;gap:9px;min-width:0;',
    },
      ns.svgEl(ns.SVG_FILE),
      window.el('span', {
        style: 'font-size:13px;color:var(--rv-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      }, row.label)
    );

    (row.badges || []).forEach(function (b) {
      leftGroup.appendChild(window.el('span', {
        style: 'background:' + b.bg + ';color:' + b.text + ';border-radius:4px;padding:1px 6px;font-size:var(--rv-fs-micro);font-weight:700;flex-shrink:0;white-space:nowrap;',
      }, b.label));
    });

    var rightGroup = window.el('div', {
      style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;',
    });

    rightGroup.appendChild(window.el('span', {
      style: 'background:var(--rv-signal-positive-bg);color:var(--rv-signal-positive);border-radius:4px;padding:2px 8px;font-size:var(--rv-fs-micro);font-weight:700;flex-shrink:0;white-space:nowrap;',
    }, 'Vinculo confirmado'));

    if (row.statusMeta) {
      rightGroup.appendChild(window.el('span', {
        style: 'background:' + row.statusMeta.bg + ';color:' + row.statusMeta.text + ';border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;flex-shrink:0;',
      }, row.statusMeta.label));
    }

    if (row.driveLink) {
      rightGroup.appendChild(window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface);color:var(--rv-accent-blue);border:1px solid var(--rv-brand);border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;',
        onclick: function () {
          window.open(row.driveLink, '_blank', 'noopener,noreferrer');
        },
      }, 'Ver'));
    } else {
      rightGroup.appendChild(window.el('span', {
        style: 'color:var(--rv-text-tertiary);font-size:11px;font-style:italic;',
      }, 'Link indisponivel'));
    }

    docRow.appendChild(window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;',
    }, leftGroup, rightGroup));

    var metaParts = [];
    if (typeof row.linkVersion === 'number') metaParts.push('Revisao v' + row.linkVersion);
    if (row.opIds && row.opIds.length > 0) metaParts.push('OPs vinculadas: ' + row.opIds.join(', '));
    docRow.appendChild(window.el('div', {
      style: 'font-size:11px;color:var(--rv-text-tertiary);margin-top:3px;',
    }, metaParts.join(' · ')));

    if (row.targetCancelled) {
      docRow.appendChild(window.el('div', {
        style: 'font-size:11px;color:var(--rv-signal-negative);margin-top:2px;',
      }, 'Atencao: alvo vinculado esta cancelado.'));
    }

    return docRow;
  }

  function buildDocuments(view) {
    var card = window.el('div', {
      id: 'documentos',
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:16px 20px;',
    });

    card.appendChild(window.el('div', {
      style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-primary);margin-bottom:12px;',
    }, 'Documentos'));

    card.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;margin-bottom:8px;',
    }, 'DOCUMENTOS DO PEDIDO'));

    view.documentRowsPedido.forEach(function (row, index) {
      card.appendChild(buildDocumentRow(row, index !== view.documentRowsPedido.length - 1));
    });

    card.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;margin:14px 0 8px;',
    }, 'DOCUMENTOS OPERACIONAIS'));

    if (view.documentRowsOperacionais.length === 0) {
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:var(--rv-text-tertiary);padding:9px 0;',
      }, 'Nenhum documento operacional esperado ainda.'));
    } else {
      view.documentRowsOperacionais.forEach(function (row, index) {
        card.appendChild(buildDocumentRow(row, index !== view.documentRowsOperacionais.length - 1));
      });
    }

    // G28-B7: CONFIRMED canonical document links (Documento -> Pedido 0..1).
    // Consumes the same canonical revision every surface reads. Explicit
    // empty / unavailable states — never a silent "no documents".
    card.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:var(--rv-signal-positive);letter-spacing:.04em;margin:14px 0 8px;',
    }, 'DOCUMENTOS VINCULADOS'));

    if (view.linkedDocumentsState === 'available'
        && view.linkedDocumentRows && view.linkedDocumentRows.length > 0) {
      view.linkedDocumentRows.forEach(function (row, index) {
        card.appendChild(buildLinkedDocumentRow(row, index !== view.linkedDocumentRows.length - 1));
      });
    } else if (view.linkedDocumentsState === 'empty') {
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:var(--rv-text-tertiary);padding:9px 0;',
      }, 'Nenhum documento vinculado a este pedido.'));
    } else if (view.linkedDocumentsState === 'loading') {
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:var(--rv-text-tertiary);padding:9px 0;',
      }, 'Carregando vinculos de documentos...'));
    } else {
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:var(--rv-text-tertiary);padding:9px 0;',
      }, 'Vinculos canonicos de documentos indisponiveis nesta sessao.'));
    }

    // G28-B7: canonical document-link timeline for this Pedido (same canonical
    // projection; confirmed links only). Rendered via the shared surface UI.
    if (typeof window.RAVATEX_DOCUMENT_LINKS_UI !== 'undefined' && view.linkedDocumentTimeline) {
      var tlBuilt = window.RAVATEX_DOCUMENT_LINKS_UI.buildLinkTimelineNodes(
        { el: window.el }, view.linkedDocumentTimeline, {});
      if (tlBuilt.nodes.length > 0) {
        card.appendChild(window.el('div', {
          style: 'font-size:11px;font-weight:700;color:var(--rv-signal-positive);letter-spacing:.04em;margin:14px 0 8px;',
        }, 'LINHA DO TEMPO DOS VINCULOS'));
        tlBuilt.nodes.forEach(function (n) { card.appendChild(n); });
      }
    }

    if (view.ingestorDocsLoaded && view.ingestorDocumentRows && view.ingestorDocumentRows.length > 0) {
      card.appendChild(window.el('div', {
        style: 'font-size:11px;font-weight:700;color:var(--rv-accent-blue);letter-spacing:.04em;margin:14px 0 8px;',
      }, 'DOCUMENTOS RECEBIDOS (INGESTOR)'));
      card.appendChild(window.el('div', {
        style: 'font-size:11px;color:var(--rv-text-tertiary);margin:-4px 0 8px;',
      }, 'Sugestoes do Ingestor (nao confirmadas). Somente a secao Documentos vinculados representa vinculo canonico.'));

      view.ingestorDocumentRows.forEach(function (row, index) {
        var isLast = index === view.ingestorDocumentRows.length - 1;
        var docRow = window.el('div', {
          style: 'padding:9px 0;' + (isLast && view.ingestorTimeline.length === 0 ? '' : 'border-bottom:1px solid var(--rv-border-soft);'),
        });

        // Linha superior: filename + badges + status pill + botao Ver
        var topRow = window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;',
        });

        var leftGroup = window.el('div', {
          style: 'display:flex;align-items:center;gap:9px;min-width:0;',
        },
          ns.svgEl(ns.SVG_FILE),
          window.el('span', {
            style: 'font-size:13px;color:var(--rv-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
          }, row.label)
        );

        if (row.badges && row.badges.length > 0) {
          row.badges.forEach(function (b) {
            leftGroup.appendChild(window.el('span', {
              style: 'background:' + b.bg + ';color:' + b.text + ';border-radius:4px;padding:1px 6px;font-size:var(--rv-fs-micro);font-weight:700;flex-shrink:0;white-space:nowrap;',
            }, b.label));
          });
        }

        var rightGroup = window.el('div', {
          style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;',
        });

        var statusMeta = row.statusMeta || window.RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta(row.status);
        rightGroup.appendChild(window.el('span', {
          style: 'background:' + statusMeta.bg + ';color:' + statusMeta.text + ';border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;flex-shrink:0;',
        }, statusMeta.label));

        if (row.driveLink) {
          rightGroup.appendChild(window.el('button', {
            type: 'button',
            style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface);color:var(--rv-accent-blue);border:1px solid var(--rv-brand);border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;',
            onclick: function () {
              window.open(row.driveLink, '_blank', 'noopener,noreferrer');
            },
          }, 'Ver'));
        } else {
          rightGroup.appendChild(window.el('span', {
            style: 'color:var(--rv-text-tertiary);font-size:11px;font-style:italic;',
          }, 'Link indisponivel'));
        }

        topRow.appendChild(leftGroup);
        topRow.appendChild(rightGroup);
        docRow.appendChild(topRow);

        // Linha inferior: meta timestamp + reason
        var bottomLine = row.meta || '';
        if (row.reason) {
          bottomLine = (bottomLine ? bottomLine + ' · ' : '') + 'Rejeitado: ' + row.reason;
        }
        var bottomColor = row.reason ? 'var(--rv-signal-negative)' : 'var(--rv-text-tertiary)';
        docRow.appendChild(window.el('div', {
          style: 'font-size:11px;color:' + bottomColor + ';margin-top:3px;',
        }, bottomLine));

        card.appendChild(docRow);
      });

      // Timeline de eventos
      if (view.ingestorTimeline && view.ingestorTimeline.length > 0) {
        card.appendChild(window.el('div', {
          style: 'font-size:11px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.04em;margin:14px 0 8px;',
        }, 'EVENTOS'));

        view.ingestorTimeline.forEach(function (item, idx) {
          var isLastTimeline = idx === view.ingestorTimeline.length - 1;
          var isFirst = idx === 0;
          var dotColor = isFirst ? 'var(--rv-accent-blue)' : 'var(--rv-text-tertiary)';

          var timelineItem = window.el('div', {
            style: 'display:flex;gap:12px;',
          },
            window.el('div', {
              style: 'display:flex;flex-direction:column;align-items:center;',
            },
              window.el('div', {
                style: 'width:9px;height:9px;border-radius:var(--rv-radius-pill);background:' + dotColor
                  + ';margin-top:3px;flex-shrink:0;',
              }),
              isLastTimeline ? null : window.el('div', {
                style: 'width:2px;flex:1;background:var(--rv-surface-subtle);margin-top:3px;',
              })
            ),
            window.el('div', { style: 'padding-bottom:' + (isLastTimeline ? '0' : '10px') + ';' },
              window.el('div', {
                style: 'font-size:11px;color:var(--rv-text-tertiary);',
              }, item.formattedTime),
              window.el('div', {
                style: 'font-size:12px;font-weight:' + (isFirst ? '700' : '500') + ';color:'
                  + (isFirst ? 'var(--rv-text-primary)' : 'var(--rv-text-secondary)') + ';margin-top:1px;',
              }, item.label),
              item.docLabel ? window.el('div', {
                style: 'font-size:11px;color:var(--rv-text-secondary);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
              }, item.docLabel) : null
            )
          );

          card.appendChild(timelineItem);
        });
      }
    }

    card.appendChild(window.el('div', {
      style: 'margin-top:12px;font-size:11.5px;color:var(--rv-text-tertiary);line-height:1.5;',
    }, 'A tabela de anexos operacionais ainda nao existe no schema atual. A tela ja consolida as pendencias e preserva o layout do fluxo final.'));

    return card;
  }

  function renderPedidoDetailScreen(ctx) {
    var container = ctx.container;
    var state = ctx.state;
    var handlers = ctx.handlers || {};
    var loadingError = ctx.loadingError;
    var header = buildHeader(state, ctx.view, handlers);

    if (loadingError === 'pedido') {
      container.replaceChildren(header,
        window.el('div', {
          style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px;color:var(--rv-signal-negative);',
        }, 'Pedido nao encontrado. Ele pode ter sido removido.'));
      return;
    }

    if (loadingError) {
      container.replaceChildren(header,
        window.el('div', {
          style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;padding:18px 20px;color:var(--rv-signal-negative);',
        }, 'Erro ao carregar dados do pedido (' + loadingError + '). Tente recarregar a pagina.'));
      return;
    }

    if (!ctx.view) {
      container.replaceChildren(header);
      return;
    }

    var view = ctx.view;
    container.replaceChildren(
      header,
      buildResumo(view),
       buildDadosGerais(state),
       buildStepper(view, handlers),
       buildPurchaseDistributionEntry(state),
       buildItens(state, view, handlers),
      buildOps(state, view, handlers),
      buildExpedicoes(state, view, handlers),
      buildConclusaoPedido(state, view, handlers),
      window.el('div', {
        'data-rv-2col': '',
        style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:14px;',
      },
        buildClienteEvolution(state, view, handlers),
        buildDocuments(view)
      )
    );
  }

  ns.renderPedidoDetailScreen = renderPedidoDetailScreen;
  ns.buildDocuments = buildDocuments;
})(window);
