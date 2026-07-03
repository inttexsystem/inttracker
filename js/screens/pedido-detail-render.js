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
    return modelo.nome + ' · ' + larguraLabel;
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
      var thumb = window.corPreviewElement(corNome);
      if (thumb) {
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

  function buildStatusPill(statusKey, handlers) {
    var map = {
      rascunho: { bg: '#f1f3f6', text: '#5b6472' },
      recebido: { bg: '#eaf1fd', text: '#2563eb' },
      confirmado: { bg: '#eef3ff', text: '#3b5bdb' },
      produzindo: { bg: '#fff4e6', text: '#c2610c' },
      entregue: { bg: '#e6f4ec', text: '#18794a' },
      cancelado: { bg: '#fdecec', text: '#a23434' },
    };
    var tone = map[statusKey] || { bg: '#f1f3f6', text: '#5b6472' };
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
        style: 'width:7px;height:7px;border-radius:50%;background:' + tone.text + ';display:inline-block;flex-shrink:0;',
      }) : null,
      label
    );
  }

  function buildOperationalPill(chainState) {
    var label = chainState && chainState.displayStatus ? chainState.displayStatus : 'Pedido';
    return window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:7px;background:#fff4e6;color:#c2610c;border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;',
      title: 'Status operacional derivado das OPs vinculadas',
    },
      window.el('span', {
        style: 'width:7px;height:7px;border-radius:50%;background:#e07b39;display:inline-block;flex-shrink:0;',
      }),
      label
    );
  }

  function buildSummaryMetric(title, value, color) {
    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:13px 15px;',
    },
      window.el('div', {
        style: 'font-size:11.5px;color:#8a93a3;font-weight:600;margin-bottom:6px;',
      }, title),
      window.el('div', {
        style: 'font-size:19px;font-weight:800;color:' + color + ';',
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
          style: 'font-size:23px;font-weight:800;color:#16203a;letter-spacing:-.01em;',
        }, 'Pedido'),
        window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:8px;border:1px solid #d8dce2;background:#fff;color:#3f4757;border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;',
          onclick: handlers.navigateToPedidos,
        }, ns.svgEl(ns.SVG_BACK), 'Voltar')
      );
    }

    var numero = ns.fmtNumero(pedido.numero);
    var updatedAt = ns.fmtDataHora(pedido.atualizado_em);
    var prazo = ns.fmtData(pedido.prazo_desejado || pedido.prazo_entrega);
    var editBtn = handlers.buildEditButton();
    var chainState = view && view.chainState ? view.chainState : null;
    var showOperationalStatus = !!(chainState && chainState.isOperationalOverride);

    var breadcrumb = window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;',
    },
      window.el('div', { style: 'font-size:14px;color:#9aa2af;' },
        'Pedidos',
        window.el('span', { style: 'margin:0 4px;color:#d0d5dc;' }, '/'),
        window.el('span', { style: 'color:#5b6472;font-weight:600;' }, ' Pedido ' + numero)
      ),
      window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:8px;border:1px solid #d8dce2;background:#fff;color:#3f4757;border-radius:4px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;',
        onclick: handlers.navigateToPedidos,
      }, ns.svgEl(ns.SVG_BACK), 'Voltar')
    );

    var titleRow = window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px 16px;margin-bottom:16px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:240px;' },
          window.el('div', {
            style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
          },
            window.el('h1', {
              style: 'margin:0;font-size:23px;font-weight:800;color:#16203a;letter-spacing:-.01em;line-height:1.1;',
            }, 'Pedido ' + numero),
            showOperationalStatus ? buildOperationalPill(chainState) : buildStatusPill(pedido.status, handlers),
            showOperationalStatus ? window.el('span', {
              style: 'display:inline-flex;align-items:center;gap:6px;background:#f1f3f6;color:#5b6472;border-radius:4px;padding:4px 11px;font-size:12px;font-weight:600;',
            }, 'Comercial: ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(pedido.status) : ns.fmtTextoOuEmpty(pedido.status, 'Status'))) : null,
            window.el('span', {
              style: 'display:inline-flex;align-items:center;gap:6px;background:#f1f3f6;color:#8a93a3;border-radius:4px;padding:4px 11px;font-size:12px;font-weight:600;',
            }, 'Origem: Cliente')
          ),
          window.el('div', {
            style: 'font-size:13px;color:#8a93a3;margin-top:6px;',
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
                style: 'font-size:11.5px;color:#9aa2af;',
              }, 'Prazo previsto'),
              window.el('div', {
                style: 'font-size:14.5px;font-weight:700;color:#16203a;',
              }, prazo)
            )
          ),
          window.el('div', {
            style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
          },
            editBtn,
            window.el('button', {
              type: 'button',
              style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
              onclick: function () { handlers.scrollToSection('documentos'); },
            }, ns.svgEl(ns.SVG_DOC), 'Documentos')
          )
        )
      )
    );

    return window.el('div', {}, breadcrumb, titleRow);
  }

  function buildResumo(view) {
    return window.el('div', {
      style: 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:16px;',
    },
      buildSummaryMetric('Total do pedido', ns.fmtMetrosShort(view.totalPedido), '#16203a'),
      buildSummaryMetric('Em tecelagem', ns.fmtMetrosShort(view.emTecelagem), '#7c3aed'),
      buildSummaryMetric('Em acabamento', ns.fmtMetrosShort(view.emAcabamento), '#c2610c'),
      buildSummaryMetric('Pronto/expedicao', ns.fmtMetrosShort(view.prontoExpedicao), '#2563eb'),
      buildSummaryMetric('Entregue', ns.fmtMetrosShort(view.entregue), '#18794a'),
      buildSummaryMetric('Pendencias documentais', String(view.pendingDocs), '#d6403a')
    );
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
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'font-size:15.5px;font-weight:700;color:#16203a;',
        }, 'Dados gerais'),
        window.el('div', {
          style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:#9aa2af;font-weight:600;',
        }, ns.svgEl(ns.SVG_LOCK), 'Bloqueado apos emissao')
      ),
      window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;',
      }, fields.map(function (field) {
        return window.el('div', {},
          window.el('label', {
            style: 'display:block;font-size:12px;color:#9aa2af;margin-bottom:6px;',
          }, field.label),
          window.el('div', {
            style: 'border:1px solid #e2e5ea;background:#f8f9fb;border-radius:4px;padding:9px 12px;font-size:13.5px;color:#3f4757;' + (field.strong ? 'font-weight:600;' : ''),
          }, field.value)
        );
      }))
    );
  }

  function buildStageNode(stage, index) {
    var outerStyle;
    var inner;

    if (stage.state === 'done') {
      outerStyle = 'width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px #fff;background:' + stage.color + ';color:#fff;';
      inner = ns.svgEl(ns.SVG_CHECK);
    } else {
      var pct = Math.max(0, Math.min(100, stage.percent || 0));
      outerStyle = 'width:42px;height:42px;border-radius:50%;background:conic-gradient(from -90deg,' + stage.color + ' 0% ' + pct + '%,#e8eaee ' + pct + '%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px #fff;';
      inner = window.el('div', {
        style: 'width:32px;height:32px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:' + (stage.state === 'future' ? '#9aa2af' : stage.color) + ';',
      }, String(index + 1));
    }

    return window.el('div', {
      style: 'display:flex;flex-direction:column;align-items:center;',
    },
      window.el('div', { style: outerStyle }, inner),
      window.el('div', {
        style: 'margin-top:10px;font-size:12.5px;color:' + (stage.state === 'future' ? '#475065' : '#16203a') + ';font-weight:700;text-align:center;',
      }, stage.label),
      window.el('div', {
        style: 'font-size:11px;color:' + (stage.state === 'future' ? '#9aa2af' : stage.color) + ';margin-top:2px;' + (stage.state === 'current' ? 'font-weight:600;' : ''),
      }, stage.sublabel)
    );
  }

  function isConnectorDoneAction(action) {
    var label = String(action && action.label ? action.label : '').toLowerCase();
    return label.indexOf('conclu') >= 0;
  }

  function buildConnectorVisual(action, disabled) {
    var mode = action && action.mode ? action.mode : 'enabled';
    var rawLabel = String(action && action.label ? action.label : '').toLowerCase();
    if (isConnectorDoneAction(action)) {
      return { state: 'done', label: 'Concluído' };
    }
    if (disabled || mode === 'disabled') {
      return { state: 'waiting', label: 'Aguardar' };
    }
    if (mode === 'view') {
      return { state: 'view', label: rawLabel.indexOf('editar') >= 0 ? 'Editar' : 'Ver' };
    }
    return { state: 'active', label: 'Transferir' };
  }

  function buildConnectorTitle(stage, action, visual) {
    if (visual.state === 'active' && stage.transfer && stage.transfer.origem && stage.transfer.destino) {
      return 'Transferir de ' + stage.transfer.origem + ' para ' + stage.transfer.destino;
    }
    return (stage.transfer && stage.transfer.title) || (action && action.label) || visual.label;
  }

  function buildConnectorStyle(visual, clickable) {
    var tones = {
      done: { bg: '#edf7e8', color: '#4f7f37', border: '1px solid #c9dfc0' },
      waiting: { bg: '#eef1f5', color: '#8a93a3', border: '1px solid #dde2e8' },
      view: { bg: '#fff', color: '#2563eb', border: '1px solid #2563eb' },
      active: { bg: '#2563eb', color: '#fff', border: '1px solid #2563eb' },
    };
    var tone = tones[visual.state] || tones.waiting;
    return 'width:96px;height:28px;padding:0 13px 0 18px;display:inline-flex;align-items:center;justify-content:center;'
      + 'background:' + tone.bg + ';color:' + tone.color + ';border:' + tone.border + ';'
      + 'font-size:11px;font-weight:700;font-family:inherit;line-height:1;white-space:nowrap;box-sizing:border-box;'
      + 'clip-path:polygon(0% 0%, 80% 0%, 100% 50%, 80% 100%, 0% 100%, 15% 50%);'
      + 'cursor:' + (clickable ? 'pointer' : 'default') + ';';
  }

  function buildTransferButton(stage, handlers) {
    if (!stage.transfer) {
      return window.el('div', { style: 'display:flex;align-items:center;justify-content:center;height:42px;' });
    }
    var action = stage.transfer.action || {};
    if (action.mode === 'hidden') {
      return window.el('div', { style: 'display:flex;align-items:center;justify-content:center;height:42px;' });
    }
    var mode = action.mode || 'enabled';
    var disabled = mode === 'disabled' || (!stage.transfer.op && (stage.transfer.title !== 'Registrar saida para entrega'));
    var visual = buildConnectorVisual(action, disabled);
    var title = buildConnectorTitle(stage, action, visual);
    var clickable = visual.state === 'active' || visual.state === 'view';
    if (visual.state === 'done' || visual.state === 'waiting') {
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:center;height:42px;',
      },
        window.el('span', {
          title: title,
          'aria-label': title,
          style: buildConnectorStyle(visual, false),
        }, visual.label)
      );
    }
    return window.el('div', {
      style: 'display:flex;align-items:center;justify-content:center;height:42px;',
    },
      window.el('button', {
        type: 'button',
        title: title,
        'aria-label': title,
        style: buildConnectorStyle(visual, clickable),
        onclick: function () {
          handlers.openMovementModal(stage.transfer);
        },
      }, visual.label)
    );
  }

  function buildStepper(view, handlers) {
    var gridChildren = [];
    view.stepper.forEach(function (stage, index) {
      gridChildren.push(buildStageNode(stage, index));
      if (index < view.stepper.length - 1) {
        gridChildren.push(buildTransferButton(stage, handlers));
      }
    });

    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 22px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:20px;',
      }, 'Progresso produtivo'),
      window.el('div', {
        style: 'display:grid;grid-template-columns:1fr 104px 1fr 104px 1fr 104px 1fr 104px 1fr;align-items:start;',
      }, gridChildren),
      window.el('div', {
        style: 'display:flex;align-items:flex-start;gap:10px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:12px 14px;margin-top:22px;',
      },
        ns.svgEl(ns.SVG_INFO),
        window.el('span', {
          style: 'font-size:13px;color:#2c4a78;font-weight:500;line-height:1.5;',
        }, 'Estes numeros refletem as OPs vinculadas ao pedido. Cada botao "Transferir" abre a mesma operacao canonica da OP de origem - nao existe lancamento paralelo no Pedido.')
      )
    );
  }

  function buildItemRow(state, item, metrics, handlers) {
    var ids = resolveItemColorIds(state, item);
    var c1Nome = corNomeById(state, ids.cor1);
    var c2Nome = corNomeById(state, ids.cor2);
    var c1Hex = c1Nome && window.corPreviewHex ? window.corPreviewHex(c1Nome) : '#e5e7eb';
    var c2Hex = c2Nome && window.corPreviewHex ? window.corPreviewHex(c2Nome) : '#e5e7eb';

    return window.el('div', {
      style: 'display:grid;grid-template-columns:44px 1.3fr .8fr .8fr .8fr .8fr .8fr 1.2fr 90px;gap:10px;padding:12px 20px;align-items:center;border-bottom:1px solid #f1f3f6;min-width:980px;',
    },
      window.el('div', {}, itemPreviewEl(state, item)),
      window.el('div', {},
        window.el('div', {
          style: 'font-size:13.5px;font-weight:700;color:#16203a;margin-bottom:4px;',
        }, modelLabel(state, item)),
        window.el('div', { style: 'display:flex;align-items:center;gap:5px;margin-bottom:4px;' },
          window.el('span', {
            style: 'width:14px;height:14px;border-radius:50%;background:' + c1Hex + ';border:1px solid rgba(0,0,0,0.08);display:inline-block;flex-shrink:0;',
          }),
          c2Nome ? window.el('span', {
            style: 'width:14px;height:14px;border-radius:50%;background:' + c2Hex + ';border:1px solid rgba(0,0,0,0.12);display:inline-block;flex-shrink:0;',
          }) : null
        ),
        window.el('div', {
          style: 'font-size:12px;color:#8a93a3;',
        }, itemCoresLabel(state, item))
      ),
      window.el('div', { style: 'font-size:13.5px;color:#16203a;font-weight:600;' }, ns.fmtMetrosShort(item.metros)),
      window.el('div', { style: 'font-size:13.5px;color:#7c3aed;font-weight:700;' }, ns.fmtMetrosShort(metrics.tecelagem)),
      window.el('div', { style: 'font-size:13.5px;color:#c2610c;font-weight:700;' }, ns.fmtMetrosShort(metrics.acabamento)),
      window.el('div', { style: 'font-size:13.5px;color:#2563eb;font-weight:700;' }, ns.fmtMetrosShort(metrics.prontos)),
      window.el('div', { style: 'font-size:13.5px;color:#18794a;font-weight:700;' }, ns.fmtMetrosShort(metrics.entregues)),
      window.el('div', { style: 'font-size:12.5px;color:#2563eb;font-weight:600;' }, metrics.relatedOpsLabel),
      window.el('div', { style: 'text-align:right;' },
        window.el('button', {
          type: 'button',
          style: 'font-size:12.5px;color:#2563eb;font-weight:600;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;',
          onclick: function () { handlers.scrollToSection('ops-vinculadas'); },
        }, 'Ver cadeia')
      )
    );
  }

  function buildItens(state, view, handlers) {
    var card = window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;margin-bottom:14px;overflow:hidden;',
    });

    card.appendChild(window.el('div', {
      style: 'padding:16px 20px 12px;font-size:15.5px;font-weight:700;color:#16203a;',
    }, 'Itens do pedido'));

    if (state.itens.length === 0) {
      card.appendChild(window.el('div', {
        style: 'padding:18px 20px;font-size:14px;color:#9aa2af;',
      }, 'Este pedido nao possui itens.'));
      return card;
    }

    var head = window.el('div', {
      style: 'overflow-x:auto;',
    });

    head.appendChild(window.el('div', {
      style: 'display:grid;grid-template-columns:44px 1.3fr .8fr .8fr .8fr .8fr .8fr 1.2fr 90px;gap:10px;padding:9px 20px;background:#f8f9fb;border-top:1px solid #eceef1;border-bottom:1px solid #eceef1;min-width:980px;',
    },
      window.el('div', {}),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'MODELO / CORES'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'PEDIDO'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'TECELAGEM'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'ACABAMENTO'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'PRONTOS'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'ENTREGUES'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, 'OPs RELACIONADAS'),
      window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;text-align:right;' }, 'ACAO')
    ));

    state.itens.forEach(function (item) {
      head.appendChild(buildItemRow(state, item, view.itemMetricsById[item.id] || {
        tecelagem: 0,
        acabamento: 0,
        prontos: 0,
        entregues: 0,
        relatedOpsLabel: '-',
      }, handlers));
    });

    card.appendChild(head);
    return card;
  }

  function buildDocBanner(banner) {
    var tone = banner && banner.tone === 'danger'
      ? { bg: '#fdecec', border: '#f7d4d2', text: '#a23434', stroke: '#b23b3b' }
      : banner && banner.tone === 'warning'
        ? { bg: '#fff9ee', border: '#fbe8c6', text: '#8a5a15', stroke: '#c2610c' }
        : { bg: '#f6f7f9', border: '#eceef1', text: '#6b7280', stroke: '#9aa2af' };

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
    return window.el('button', {
      type: 'button',
      disabled: disabled ? 'disabled' : null,
      style: 'flex:1;background:' + (disabled ? '#f1f3f6' : (primary ? '#2563eb' : '#fff')) + ';color:' + (disabled ? '#9aa2af' : (primary ? '#fff' : '#3f4757')) + ';border:' + (primary && !disabled ? 'none' : '1px solid #d8dce2') + ';border-radius:4px;padding:8px 0;font-size:12.5px;font-weight:' + (primary ? '700' : '600') + ';font-family:inherit;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';',
      onclick: disabled ? null : onclick,
    }, label);
  }

  function buildOpCard(summary, handlers) {
    var typeTone = summary.stageKey === 'tecelagem'
      ? { bg: '#f3effe', text: '#7c3aed' }
      : { bg: '#fef9ec', text: '#b45309' };

    var statusPill = window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:6px;background:' + summary.statusTone.bg + ';color:' + summary.statusTone.text + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:600;',
    },
      window.el('span', {
        style: 'width:6px;height:6px;border-radius:50%;background:' + summary.statusTone.dot + ';display:inline-block;',
      }),
      summary.statusTone.label
    );

    var metricsBlock;
    if (summary.stageKey === 'tecelagem') {
      metricsBlock = window.el('div', {
        style: 'padding:14px 18px;display:flex;flex-direction:column;gap:9px;',
      },
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
        }, window.el('span', {}, 'Itens'), window.el('span', { style: 'color:#16203a;font-weight:600;' }, summary.modelNames.length + (summary.modelNames.length ? ' (' + summary.modelNames.join(', ') + ')' : ''))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
        }, window.el('span', {}, 'Pedido total'), window.el('span', { style: 'color:#16203a;font-weight:600;' }, ns.fmtMetros(summary.target))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
        }, window.el('span', {}, 'Entregue p/ acabamento'), window.el('span', { style: 'color:#16203a;font-weight:600;' }, ns.fmtMetros(summary.done))),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
        }, window.el('span', {}, 'Saldo em tecelagem'), window.el('span', { style: 'color:#2563eb;font-weight:700;' }, ns.fmtMetros(summary.remaining))),
        buildDocBanner(summary.docBanner)
      );
    } else {
      metricsBlock = window.el('div', {},
        summary.origemOp
          ? window.el('div', {
              style: 'padding:12px 18px 0;font-size:11.5px;color:#9aa2af;',
            }, 'Origem: entrega parcial de ', window.el('span', { style: 'color:#2563eb;font-weight:600;' }, ns.opLabel(summary.origemOp)))
          : null,
        window.el('div', {
          style: 'padding:10px 18px 14px;display:flex;flex-direction:column;gap:9px;',
        },
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
          }, window.el('span', {}, 'Recebido da tecelagem'), window.el('span', { style: 'color:#16203a;font-weight:600;' }, ns.fmtMetros(summary.target))),
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
          }, window.el('span', {}, 'Finalizado (pronto + entregue)'), window.el('span', { style: 'color:#16203a;font-weight:600;' }, ns.fmtMetros(summary.done))),
          window.el('div', {
            style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;',
          }, window.el('span', {}, 'Saldo em acabamento'), window.el('span', { style: 'color:#c2610c;font-weight:700;' }, ns.fmtMetros(summary.remaining))),
          buildDocBanner(summary.docBanner)
        )
      );
    }

    var movementAction = summary.chainAction || { mode: 'enabled', label: 'Movimentar' };
    var movementDisabled = movementAction.mode === 'disabled' || movementAction.mode === 'hidden';
    var movementView = movementAction.mode === 'view';
    var movementLabel = movementAction.label || (movementView ? 'Visualizar' : 'Movimentar');

    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;overflow:hidden;',
    },
      window.el('div', {
        style: 'padding:14px 18px;border-bottom:1px solid #f1f3f6;display:flex;align-items:center;justify-content:space-between;',
      },
        window.el('div', { style: 'display:flex;align-items:center;gap:9px;' },
          window.el('span', {
            style: 'font-size:14.5px;font-weight:700;color:#2563eb;',
          }, summary.label),
          window.el('span', {
            style: 'background:' + typeTone.bg + ';color:' + typeTone.text + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:600;',
          }, summary.stageLabel)
        ),
        statusPill
      ),
      metricsBlock,
      window.el('div', {
        style: 'display:flex;gap:8px;padding:12px 18px;border-top:1px solid #f1f3f6;',
      },
        buildFooterAction('Abrir OP', function () { handlers.navigateToOp(summary.id); }, false),
        buildFooterAction(movementLabel, function () {
          handlers.openMovementModal({
            title: summary.stageKey === 'tecelagem' ? 'Movimentar Tecelagem -> Acabamento' : 'Movimentar Acabamento -> Expedicao',
            origem: summary.stageLabel + ' - ' + summary.label,
            destino: summary.stageKey === 'tecelagem' ? 'Acabamento' : 'Expedicao',
            detalhe: 'A movimentacao continua sendo registrada na OP vinculada.',
            op: summary.op,
            docs: summary.stageKey === 'tecelagem' ? 'Romaneio e NF' : 'NF de expedicao',
            action: movementAction,
          });
        }, movementAction.mode === 'enabled', movementDisabled),
        buildFooterAction('Documentos', function () { handlers.scrollToSection('documentos'); }, false)
      )
    );
  }

  function buildOps(state, view, handlers) {
    var wrap = window.el('div', {
      id: 'ops-vinculadas',
      style: 'margin-bottom:14px;',
    });

    wrap.appendChild(window.el('div', {
      style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:10px;',
    }, 'OPs vinculadas'));

    if (state.opsLoadError) {
      wrap.appendChild(window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;font-size:14px;color:#b45309;',
      }, 'Nao foi possivel consolidar as OPs vinculadas agora.'));
      return wrap;
    }

    if (view.opSummaries.length === 0) {
      wrap.appendChild(window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;',
      },
        window.el('div', {
          style: 'font-size:14.5px;font-weight:700;color:#16203a;margin-bottom:6px;',
        }, 'Este pedido ainda nao possui OPs vinculadas'),
        window.el('div', {
          style: 'font-size:13px;color:#5b6472;line-height:1.5;margin-bottom:12px;',
        }, 'Assim que a primeira OP for aberta com este pedido vinculado, a cadeia produtiva passa a ser refletida aqui.'),
        window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:7px;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 14px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
          onclick: handlers.navigateToNovaOp,
        }, 'Gerar primeira OP')
      ));
      return wrap;
    }

    wrap.appendChild(window.el('div', {
      style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;',
    }, view.opSummaries.map(function (summary) {
      return buildOpCard(summary, handlers);
    })));
    return wrap;
  }

  function buildExpedicoes(state, view, handlers) {
    var wrap = window.el('div', {
      id: 'expedicoes-vinculadas',
      style: 'margin-bottom:14px;',
    });

    wrap.appendChild(window.el('div', {
      style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:10px;',
    }, 'Expedicoes vinculadas'));

    if (state.expedicoesLoadError) {
      wrap.appendChild(window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;font-size:14px;color:#b45309;',
      }, 'Nao foi possivel validar as expedicoes vinculadas agora.'));
      return wrap;
    }

    if (!view.expedicaoSummaries.length) {
      wrap.appendChild(window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;',
      },
        window.el('div', { style: 'font-size:14.5px;font-weight:700;color:#16203a;margin-bottom:6px;' }, 'Nenhuma expedicao liberada'),
        window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
          'A expedicao aparece aqui depois que uma OP de acabamento finalizada for liberada para entrega/coleta.')
      ));
      return wrap;
    }

    wrap.appendChild(window.el('div', {
      style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;',
    }, view.expedicaoSummaries.map(function (summary) {
      var concluida = summary.status === 'concluida' && summary.saldo <= 0;
      return window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;overflow:hidden;',
      },
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #f1f3f6;',
        },
          window.el('div', { style: 'font-size:14.5px;font-weight:700;color:#2563eb;' }, 'Expedicao #' + summary.id),
          window.el('span', {
            style: 'background:' + (concluida ? '#e6f4ec' : '#fff4e6') + ';color:' + (concluida ? '#18794a' : '#c2610c') + ';border-radius:4px;padding:3px 9px;font-size:11.5px;font-weight:700;',
          }, summary.status)
        ),
        window.el('div', { style: 'padding:13px 18px;display:flex;flex-direction:column;gap:8px;' },
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;' },
            window.el('span', {}, 'Liberado'), window.el('span', { style: 'color:#16203a;font-weight:700;' }, ns.fmtMetros(summary.liberado))),
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;' },
            window.el('span', {}, 'Entregue/coletado'), window.el('span', { style: 'color:#18794a;font-weight:700;' }, ns.fmtMetros(summary.entregue))),
          window.el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;' },
            window.el('span', {}, 'Saldo'), window.el('span', { style: 'color:' + (summary.saldo > 0 ? '#c2610c' : '#18794a') + ';font-weight:700;' }, ns.fmtMetros(summary.saldo))),
          window.el('div', { style: 'font-size:12px;color:#8a93a3;' },
            summary.movimentos.length ? summary.movimentos.length + ' movimento(s) registrado(s)' : 'Sem entrega/coleta registrada')
        ),
        window.el('div', { style: 'padding:12px 18px;border-top:1px solid #f1f3f6;' },
          buildFooterAction('Abrir expedicao', function () { handlers.navigateToExpedicao(summary.id); }, true))
      );
    })));

    return wrap;
  }

  function buildConclusaoPedido(state, view, handlers) {
    var conclusao = view.pedidoConclusao || { pronto: false, pendencias: [], label: 'Validacao indisponivel.' };
    var jaEntregue = state.pedido && state.pedido.status === 'entregue';
    var ready = conclusao.pronto && !jaEntregue;
    var pendencias = conclusao.pendencias || [];

    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;margin-bottom:14px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:260px;max-width:720px;' },
          window.el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:6px;' }, 'Conclusao do pedido'),
          window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
            jaEntregue ? 'Pedido ja concluido no fluxo operacional.' : conclusao.label),
          pendencias.length ? window.el('div', { style: 'margin-top:10px;display:flex;flex-direction:column;gap:5px;' },
            pendencias.map(function (pendencia) {
              return window.el('div', { style: 'font-size:12.5px;color:#b45309;line-height:1.4;' }, '- ' + pendencia);
            })) : null
        ),
        window.el('button', {
          type: 'button',
          disabled: ready ? null : 'disabled',
          style: 'display:inline-flex;align-items:center;justify-content:center;background:' + (ready ? '#18794a' : '#f1f3f6') + ';color:' + (ready ? '#fff' : '#9aa2af') + ';border:none;border-radius:4px;padding:10px 16px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:' + (ready ? 'pointer' : 'not-allowed') + ';',
          onclick: function (event) { if (ready) handlers.concluirPedido(event && event.currentTarget ? event.currentTarget : null); },
        }, jaEntregue ? 'Pedido concluido' : 'Concluir pedido')
      )
    );
  }

  function buildClienteStatusBadge(state, view) {
    var label = 'Recebido';
    var dot = '#2563eb';
    var bg = '#eaf1fd';
    var color = '#2563eb';

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
          dot = '#b23b3b';
          bg = '#fdecec';
          color = '#a23434';
        } else if (exception.tom === 'warning') {
          dot = '#e07b39';
          bg = '#fff4e6';
          color = '#c2610c';
        } else {
          dot = '#6b7280';
          bg = '#f1f3f6';
          color = '#5b6472';
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
        style: 'width:7px;height:7px;border-radius:50%;background:' + dot + ';display:inline-block;',
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
    var totalSteps = progress && progress.totalSteps ? progress.totalSteps : 8;
    var percent = Math.round(((currentIndex + 1) / totalSteps) * 100);
    var message = view.trackingSummary && view.trackingSummary.mensagemCliente
      ? view.trackingSummary.mensagemCliente
      : (state.pedido && state.pedido.status_cliente_mensagem)
        || 'A visao do cliente sera atualizada a partir das OPs vinculadas.';

    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;',
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;',
      },
        window.el('div', {
          style: 'font-size:15.5px;font-weight:700;color:#16203a;',
        }, 'Evolucao do Cliente'),
        window.el('span', {
          style: 'background:#f1f3f6;color:#8a93a3;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:600;',
        }, 'Pre-visualizacao')
      ),
      window.el('div', {
        style: 'background:#f6f7f9;border:1px solid #eceef1;border-radius:4px;padding:14px 16px;',
      },
        window.el('div', {
          style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.05em;margin-bottom:10px;',
        }, 'O QUE O CLIENTE VE'),
        buildClienteStatusBadge(state, view),
        window.el('div', {
          style: 'font-size:13.5px;color:#2c4a78;font-weight:500;line-height:1.5;margin-bottom:12px;',
        }, '"' + message + '"'),
        window.el('div', {
          style: 'height:6px;border-radius:99px;background:#e2e5ea;overflow:hidden;margin-bottom:6px;',
        },
          window.el('div', {
            style: 'width:' + percent + '%;height:100%;background:#2563eb;',
          })
        ),
        window.el('div', {
          style: 'display:flex;justify-content:space-between;font-size:11.5px;color:#9aa2af;',
        },
          window.el('span', {}, 'Etapa ' + (currentIndex + 1) + ' de ' + totalSteps),
          window.el('span', {}, percent + '%')
        )
      ),
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:12px;',
      },
        window.el('span', {
          style: 'font-size:11.5px;color:#9aa2af;',
        }, 'Atualiza a partir das OPs. Edite apenas a mensagem.'),
        window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#2563eb;border:1px solid #2563eb;border-radius:4px;padding:7px 13px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;',
          onclick: handlers.openTrackingModal,
        }, ns.svgEl(ns.SVG_EDIT), 'Editar mensagem')
      )
    );
  }

  function buildDocumentStatusPill(status) {
    var tones = {
      anexado: { bg: '#e6f4ec', text: '#18794a', label: 'Anexado' },
      pendente: { bg: '#fff4e6', text: '#c2610c', label: 'Pendente' },
    };
    var tone = tones[status] || tones.pendente;
    return window.el('span', {
      style: 'background:' + tone.bg + ';color:' + tone.text + ';border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;flex-shrink:0;',
    }, tone.label);
  }

  function buildDocumentRow(row, withBorder) {
    return window.el('div', {
      style: 'padding:9px 0;' + (withBorder ? 'border-bottom:1px solid #f1f3f6;' : ''),
    },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;',
      },
        window.el('div', {
          style: 'display:flex;align-items:center;gap:9px;min-width:0;',
        },
          ns.svgEl(ns.SVG_FILE),
          window.el('span', {
            style: 'font-size:13px;color:#3f4757;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
          }, row.label)
        ),
        buildDocumentStatusPill(row.status)
      ),
      window.el('div', {
        style: 'font-size:11px;color:#9aa2af;margin-top:3px;',
      }, row.meta)
    );
  }

  function buildDocuments(view) {
    var card = window.el('div', {
      id: 'documentos',
      style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:16px 20px;',
    });

    card.appendChild(window.el('div', {
      style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:12px;',
    }, 'Documentos'));

    card.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;margin-bottom:8px;',
    }, 'DOCUMENTOS DO PEDIDO'));

    view.documentRowsPedido.forEach(function (row, index) {
      card.appendChild(buildDocumentRow(row, index !== view.documentRowsPedido.length - 1));
    });

    card.appendChild(window.el('div', {
      style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;margin:14px 0 8px;',
    }, 'DOCUMENTOS OPERACIONAIS'));

    if (view.documentRowsOperacionais.length === 0) {
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:#9aa2af;padding:9px 0;',
      }, 'Nenhum documento operacional esperado ainda.'));
    } else {
      view.documentRowsOperacionais.forEach(function (row, index) {
        card.appendChild(buildDocumentRow(row, index !== view.documentRowsOperacionais.length - 1));
      });
    }

    card.appendChild(window.el('div', {
      style: 'margin-top:12px;font-size:11.5px;color:#9aa2af;line-height:1.5;',
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
          style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;color:#b42318;',
        }, 'Pedido nao encontrado. Ele pode ter sido removido.'));
      return;
    }

    if (loadingError) {
      container.replaceChildren(header,
        window.el('div', {
          style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;padding:18px 20px;color:#b42318;',
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
      buildItens(state, view, handlers),
      buildOps(state, view, handlers),
      buildExpedicoes(state, view, handlers),
      buildConclusaoPedido(state, view, handlers),
      window.el('div', {
        style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:14px;',
      },
        buildClienteEvolution(state, view, handlers),
        buildDocuments(view)
      )
    );
  }

  ns.renderPedidoDetailScreen = renderPedidoDetailScreen;
})(window);
