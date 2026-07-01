// =====================================================================
// === SCREENS: PEDIDO DETAIL EVENTS ===================================
// Handlers e modais da tela de detalhe do pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  function createPedidoDetailEvents(ctx) {
    var pedidoId = ctx.pedidoId;
    var state = ctx.state;
    var reload = ctx.reload;
    var render = ctx.render;

    function navigateToPedidos() {
      window.navigate('#/pedidos');
    }

    function navigateToOp(opId) {
      window.navigate('#/ops/' + opId);
    }

    function navigateToNovaOp() {
      window.navigate('#/ops/nova?pedido_id=' + pedidoId);
    }

    function scrollToSection(id) {
      var node = document.getElementById(id);
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function buildTrackingAdmin() {
      if (typeof window.buildPedidoTrackingAdminCard !== 'function') return window.el('div', {});
      return window.buildPedidoTrackingAdminCard({
        pedido: state.pedido,
        onReload: async function () {
          ctx.setLoadingError(null);
          await reload();
          render();
        },
      });
    }

    function buildParciaisAdmin() {
      if (typeof window.buildPedidoParciaisAdminCard !== 'function') return window.el('div', {});
      return window.buildPedidoParciaisAdminCard({
        pedido: state.pedido,
        itens: state.itens,
        onReload: async function () {
          ctx.setLoadingError(null);
          await reload();
          render();
        },
      });
    }

    function placeholderButton(label, title) {
      return window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#b6bdc8;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:not-allowed;',
        disabled: 'disabled',
        title: title || 'Em breve',
      }, label);
    }

    function buildEditItensButton() {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#2563eb;border:1px solid #2563eb;border-radius:4px;padding:7px 13px;font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer;',
          onclick: function () { window.navigate('#/pedidos/' + pedidoId + '/itens'); },
        }, 'Editar itens');
      }
      var motivo = 'Edicao de itens permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar itens', motivo);
    }

    function buildEditButton() {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');
      if (editavel) {
        return window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
          onclick: function () { openEditWarning('dados'); },
        }, ns.svgEl(ns.SVG_EDIT), 'Editar');
      }
      var motivo = 'Edicao permitida apenas em status "Rascunho" ou "Recebido"';
      return placeholderButton('Editar', motivo);
    }

    async function alterarStatus(novoStatus, btn) {
      if (!state.pedido) {
        window.toast('Pedido nao carregado.', 'error');
        return;
      }
      var statusAtual = state.pedido.status;
      if (!ns.canTransition(statusAtual, novoStatus)) {
        window.toast('Transicao nao permitida: ' + statusAtual + ' -> ' + novoStatus + '.', 'error');
        return;
      }

      var oldLabel = btn ? btn.textContent : null;
      var oldDisabled = btn ? btn.disabled : false;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }

      var apply = async function () {
        var res = await window.supa
          .from('pedidos')
          .update({ status: novoStatus })
          .eq('id', pedidoId);

        if (res.error) {
          window.toast('Erro ao atualizar status: ' + (res.error.message || 'desconhecido'), 'error');
          console.error('pedido-detail: erro ao atualizar status', res.error);
          if (btn) {
            btn.disabled = oldDisabled;
            btn.textContent = oldLabel;
          }
          return;
        }

        state.pedido.status = novoStatus;
        window.toast('Pedido marcado como ' + (window.pedidoStatusLabel ? window.pedidoStatusLabel(novoStatus) : novoStatus) + '.', 'success');
        await reload();
        render();
      };

      if (novoStatus === 'cancelado') {
        window.confirmDialog({
          title: 'Cancelar pedido',
          message: 'Tem certeza que deseja cancelar este pedido? Esta acao nao pode ser desfeita nesta fase.',
          confirmLabel: 'Sim, cancelar',
          danger: true,
          onConfirm: apply,
        });
        if (btn) {
          btn.disabled = oldDisabled;
          btn.textContent = oldLabel;
        }
        return;
      }

      await apply();
    }

    function movementField(label, value) {
      return window.el('div', {},
        window.el('label', {
          style: 'display:block;font-size:12px;font-weight:600;color:#5b6472;margin-bottom:6px;',
        }, label),
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;padding:9px 12px;font-size:13.5px;color:#16203a;background:#f8f9fb;',
        }, ns.fmtTextoOuEmpty(value, '-'))
      );
    }

    function movementMetricCard(label, value, accent) {
      return window.el('div', {
        style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;padding:12px 14px;',
      },
        window.el('div', {
          style: 'font-size:11px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;margin-bottom:6px;',
        }, label),
        window.el('div', {
          style: 'font-size:16px;font-weight:800;color:' + (accent || '#16203a') + ';',
        }, ns.fmtTextoOuEmpty(value, '-'))
      );
    }

    function resolveUniquePedidoItemByModelo() {
      var countByModelo = {};
      var map = {};
      state.itens.forEach(function (item) {
        countByModelo[item.modelo_id] = (countByModelo[item.modelo_id] || 0) + 1;
        map[item.modelo_id] = item;
      });
      Object.keys(map).forEach(function (modeloId) {
        if (countByModelo[modeloId] !== 1) delete map[modeloId];
      });
      return map;
    }

    function movementItemLabel(opItem, uniquePedidoItemByModelo) {
      var modelo = state.modelosById[opItem.modelo_id] || {};
      var pedidoItem = opItem.pedido_item_id
        ? state.itens.find(function (item) { return item.id === opItem.pedido_item_id; }) || null
        : uniquePedidoItemByModelo[opItem.modelo_id] || null;
      var larguraValue = pedidoItem && pedidoItem.largura != null
        ? pedidoItem.largura
        : modelo.largura;
      var larguraLabel = larguraValue != null
        ? Number(larguraValue).toFixed(2).replace('.', ',') + ' m'
        : null;
      var cor1Id = pedidoItem && pedidoItem.cor_1_id != null ? pedidoItem.cor_1_id : modelo.cor_1_id;
      var cor2Id = pedidoItem && pedidoItem.cor_2_id != null ? pedidoItem.cor_2_id : modelo.cor_2_id;
      var cor1 = cor1Id != null && state.coresById[cor1Id] ? state.coresById[cor1Id].nome : null;
      var cor2 = cor2Id != null && state.coresById[cor2Id] ? state.coresById[cor2Id].nome : null;
      var label = modelo.nome || 'Item sem modelo';
      if (larguraLabel) label += ' · ' + larguraLabel;
      if (cor1 || cor2) label += ' · ' + (cor1 || '-') + ' / ' + (cor2 || '-');
      return label;
    }

    function buildMovementItems(ctxMovement) {
      if (Array.isArray(ctxMovement.items) && ctxMovement.items.length) return ctxMovement.items;
      if (!ctxMovement.op || !Array.isArray(ctxMovement.op.op_itens) || !ctxMovement.op.op_itens.length) return [];

      var uniquePedidoItemByModelo = resolveUniquePedidoItemByModelo();
      return ctxMovement.op.op_itens.map(function (opItem) {
        var metros = typeof ns.targetMetersForOpItem === 'function'
          ? ns.targetMetersForOpItem(opItem)
          : ns.round2(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
        return {
          label: movementItemLabel(opItem, uniquePedidoItemByModelo),
          meta: ns.fmtMetrosShort(metros),
        };
      });
    }

    function buildMovementMetrics(ctxMovement) {
      if (ctxMovement.metrics) return ctxMovement.metrics;
      if (!ctxMovement.op || !Array.isArray(ctxMovement.op.op_itens) || !ctxMovement.op.op_itens.length) {
        return {
          totalLabel: '-',
          movedLabel: '-',
          remainingLabel: '-',
        };
      }

      var stage = typeof ns.deliveryStageForOp === 'function'
        ? ns.deliveryStageForOp(ctxMovement.op)
        : (ctxMovement.op && ctxMovement.op.tipo === 'latex' ? 'latex' : 'cima');
      var opItemIds = {};
      var total = 0;
      var moved = 0;

      ctxMovement.op.op_itens.forEach(function (opItem) {
        if (opItem && opItem.id != null) opItemIds[opItem.id] = true;
        total += typeof ns.targetMetersForOpItem === 'function'
          ? ns.targetMetersForOpItem(opItem)
          : ns.toFiniteNumber(opItem && opItem.metros_ajustados != null ? opItem.metros_ajustados : opItem.metros_pedidos);
      });

      state.entregaItens.forEach(function (ei) {
        if (!opItemIds[ei.op_item_id] || ei.defeito) return;
        var entrega = state.entregasById[ei.entrega_id];
        if (!entrega || entrega.etapa !== stage) return;
        moved += ns.toFiniteNumber(ei.metros_entregues);
      });

      total = ns.round2(total);
      moved = ns.round2(moved);
      return {
        totalLabel: ns.fmtMetros(total),
        movedLabel: ns.fmtMetros(moved),
        remainingLabel: ns.fmtMetros(Math.max(total - moved, 0)),
      };
    }

    function buildMovementDocs(ctxMovement) {
      if (Array.isArray(ctxMovement.docsList) && ctxMovement.docsList.length) return ctxMovement.docsList;
      if (Array.isArray(ctxMovement.docs) && ctxMovement.docs.length) return ctxMovement.docs;
      var raw = ns.fmtTextoOuEmpty(ctxMovement.docs, 'Romaneio e NF');
      return raw.split(/\s*,\s*|\s+e\s+/i).filter(Boolean).map(function (item) {
        return item.charAt(0).toUpperCase() + item.slice(1);
      });
    }

    function openMovementModal(ctxMovement) {
      var opLabel = ctxMovement.op ? ns.opLabel(ctxMovement.op) : 'Sem OP vinculada';
      var items = buildMovementItems(ctxMovement);
      var metrics = buildMovementMetrics(ctxMovement);
      var docs = buildMovementDocs(ctxMovement);
      var body = window.el('div', {},
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'width:36px;height:36px;border-radius:50%;background:#eef3ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
          }, ns.svgEl(ns.SVG_INFO)),
          window.el('div', {},
            window.el('div', {
              style: 'font-size:11px;font-weight:700;letter-spacing:.04em;color:#2563eb;text-transform:uppercase;margin-bottom:4px;',
            }, 'Operacao canonica da OP'),
            window.el('div', {
              style: 'font-size:15px;font-weight:800;color:#16203a;',
            }, ctxMovement.title),
            window.el('div', {
              style: 'font-size:13px;color:#5b6472;margin-top:6px;line-height:1.5;',
            }, ctxMovement.detalhe)
          )
        ),
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:10px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:12px 14px;margin-bottom:14px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('span', {
            style: 'font-size:12.5px;color:#2c4a78;line-height:1.5;',
          }, 'Este modal e somente leitura nesta fase. Revise o contexto abaixo e use "Abrir OP de origem" para executar a movimentacao canonica na OP.')
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;',
        },
          movementField('Origem', ctxMovement.origem),
          movementField('Destino', ctxMovement.destino)
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;',
        },
          movementField('OP de origem', opLabel),
          movementField('Saldo/restante calculado', metrics.remainingLabel)
        ),
        window.el('div', {
          style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;',
        },
          movementMetricCard('Planejado na OP', metrics.totalLabel),
          movementMetricCard('Ja movimentado', metrics.movedLabel, '#2563eb'),
          movementMetricCard('Restante na origem', metrics.remainingLabel, '#c2610c')
        ),
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
          }, 'Itens envolvidos'),
          items.length
            ? items.map(function (item, index) {
                return window.el('div', {
                  style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;' + (index < items.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
                },
                  window.el('div', {
                    style: 'font-size:13px;color:#16203a;line-height:1.45;',
                  }, item.label),
                  window.el('div', {
                    style: 'font-size:12px;font-weight:700;color:#2563eb;white-space:nowrap;',
                  }, item.meta)
                );
              })
            : window.el('div', {
                style: 'padding:12px 14px;font-size:13px;color:#8a93a3;',
              }, 'Nenhum item consolidado para exibir nesta origem.')
        ),
        window.el('div', {
          style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;',
        },
          window.el('div', {
            style: 'padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;',
          }, 'Documentos esperados'),
          docs.map(function (doc, index) {
            return window.el('div', {
              style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;' + (index < docs.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : ''),
            },
              window.el('div', { style: 'display:flex;align-items:center;gap:9px;min-width:0;' },
                ns.svgEl(ns.SVG_FILE),
                window.el('span', {
                  style: 'font-size:13px;font-weight:600;color:#3f4757;',
                }, doc)
              ),
              window.el('span', {
                style: 'display:inline-flex;align-items:center;border:1px solid #fbe8c6;background:#fff9ee;color:#8a5a15;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;',
              }, 'Esperado')
            );
          })
        ),
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:10px;background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:12px 14px;margin-top:12px;',
        },
          ns.svgEl(ns.SVG_INFO),
          window.el('span', {
            style: 'font-size:12.5px;color:#5b6472;line-height:1.5;',
          }, ctxMovement.op
            ? 'A operacao continua canonica na OP de origem. Este atalho nao grava entrega, nao cria movimentacao no Pedido e nao mantem estado paralelo.'
            : 'Ainda nao existe uma OP de origem vinculada para este atalho. O Pedido continua sem gravacao propria de movimentacao nesta fase.')
        )
      );

      var overlay = window.el('div', {
        style: 'position:fixed;inset:0;background:rgba(20,30,45,.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;',
      });

      function closeModal() {
        overlay.remove();
        document.removeEventListener('keydown', escListener);
      }

      function escListener(evt) {
        if (evt.key === 'Escape') closeModal();
      }

      overlay.addEventListener('click', function (evt) {
        if (evt.target === overlay) closeModal();
      });
      document.addEventListener('keydown', escListener);

      var card = window.el('div', {
        style: 'position:relative;background:#fff;border-radius:4px;width:520px;max-height:calc(100vh - 48px);overflow-y:auto;box-shadow:0 24px 60px rgba(20,30,45,.2);',
      });
      var closeBtn = window.el('button', {
        type: 'button',
        style: 'position:absolute;top:18px;right:18px;background:none;border:none;cursor:pointer;padding:4px;color:#9aa2af;line-height:0;',
        onclick: closeModal,
      }, ns.svgEl('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'));
      var content = window.el('div', {
        style: 'padding:20px 22px 18px;',
      }, body);
      var footer = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid #eceef1;',
      });
      var cancelBtn = window.el('button', {
        type: 'button',
        style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 18px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;',
        onclick: closeModal,
      }, 'Cancelar');
      var primaryBtn = window.el('button', {
        type: 'button',
        style: 'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 20px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;',
        onclick: function () {
          if (ctxMovement.op) {
            closeModal();
            window.navigate('#/ops/' + ctxMovement.op.id);
            return;
          }
          closeModal();
        },
      }, ctxMovement.op ? 'Abrir OP de origem' : 'Fechar');

      footer.appendChild(cancelBtn);
      footer.appendChild(primaryBtn);
      card.appendChild(closeBtn);
      card.appendChild(content);
      card.appendChild(footer);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    function openEditWarning(mode) {
      var statusAtual = state.pedido ? state.pedido.status : null;
      var editavel = window.isPedidoEditavel
        ? window.isPedidoEditavel(statusAtual)
        : (statusAtual === 'rascunho' || statusAtual === 'recebido');

      if (!editavel) {
        window.toast('Edicao permitida apenas em pedidos em rascunho ou recebido.', 'error');
        return;
      }

      var hasOps = state.ops && state.ops.length > 0;
      if (!hasOps) {
        window.navigate(mode === 'itens'
          ? '#/pedidos/' + pedidoId + '/itens'
          : '#/pedidos/' + pedidoId + '/editar');
        return;
      }

      var body = window.el('div', {},
        window.el('div', {
          style: 'display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;',
        },
          window.el('div', {
            style: 'width:36px;height:36px;border-radius:50%;background:#fff4e6;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
          }, ns.svgEl(ns.SVG_WARN)),
          window.el('div', {},
            window.el('div', {
              style: 'font-size:15.5px;font-weight:700;color:#16203a;',
            }, 'Este pedido ja tem OPs vinculadas'),
            window.el('div', {
              style: 'font-size:13px;color:#5b6472;margin-top:6px;line-height:1.5;',
            }, 'Editar dados gerais ou itens nao altera a producao ja lancada nas OPs - a OP continua sendo a origem oficial da movimentacao. Para mudar quantidades em producao, use "Movimentar".')
          )
        ),
        window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:10px 12px;',
        },
          window.el('div', {
            style: 'font-size:12.5px;color:#5b6472;line-height:1.5;',
          }, 'Se voce precisar ajustar a composicao do pedido comercial, a rota de itens continua disponivel.'),
          buildEditItensButton()
        )
      );

      window.modal({
        title: 'Editar pedido',
        body: body,
        saveLabel: mode === 'itens' ? 'Editar itens' : 'Editar mesmo assim',
        onSave: async function () {
          window.navigate(mode === 'itens'
            ? '#/pedidos/' + pedidoId + '/itens'
            : '#/pedidos/' + pedidoId + '/editar');
          return true;
        },
      });
    }

    function openStatusActions() {
      if (!state.pedido) return;

      var actions = ns.nextActionsForStatus(state.pedido.status);
      var body = window.el('div', {});

      if (actions.length === 0) {
        body.appendChild(window.el('div', {
          style: 'font-size:13px;color:#5b6472;line-height:1.5;',
        }, state.pedido.status === 'cancelado'
          ? 'Pedido cancelado. Nenhuma transicao disponivel nesta fase.'
          : 'Nenhuma acao de status disponivel para este pedido.'));
        window.modal({
          title: 'Acoes do pedido',
          body: body,
          saveLabel: 'Fechar',
          onSave: async function () { return true; },
        });
        return;
      }

      body.appendChild(window.el('div', {
        style: 'font-size:13px;color:#5b6472;margin-bottom:12px;line-height:1.5;',
      }, 'Use estas transicoes para manter o status comercial do pedido alinhado ao fluxo administrativo.'));

      var buttonsWrap = window.el('div', {
        style: 'display:flex;flex-direction:column;gap:8px;',
      });
      body.appendChild(buttonsWrap);

      var modalRef = window.modal({
        title: 'Acoes do pedido',
        body: body,
        saveLabel: 'Fechar',
        onSave: async function () { return true; },
      });

      actions.forEach(function (action) {
        var isCancel = action.status === 'cancelado';
        var btn = window.el('button', {
          type: 'button',
          style: 'display:flex;align-items:center;justify-content:center;background:' + (isCancel ? '#fff' : '#2563eb') + ';color:' + (isCancel ? '#b42318' : '#fff') + ';border:' + (isCancel ? '1px solid #f5c2c7' : 'none') + ';border-radius:4px;padding:10px 12px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;',
          onclick: async function () {
            await alterarStatus(action.status, btn);
            modalRef.close();
          },
        }, action.label);
        buttonsWrap.appendChild(btn);
      });
    }

    function buildTrackingPreviewNode(statusInput, exceptionInput, messageInput) {
      var api = ns.getTrackingApi();
      var payload = {
        status_cliente_visual: statusInput.value || 'recebido',
        status_cliente_excecao: exceptionInput.value || null,
        status_cliente_mensagem: messageInput.value ? messageInput.value.trim() : null,
      };

      if (!api) {
        return window.el('div', {
          style: 'font-size:13px;color:#9aa2af;',
        }, 'Taxonomia de acompanhamento indisponivel.');
      }

      var progress = api.getClienteTrackingProgress(payload);
      var label = api.getClienteTrackingStatusLabel(payload);
      var message = api.getClienteTrackingMensagem(payload);
      var percent = Math.round((((progress.currentIndex >= 0 ? progress.currentIndex : 0) + 1) / progress.totalSteps) * 100);
      var badgeBg = '#eaf1fd';
      var badgeColor = '#2563eb';
      var badgeDot = '#2563eb';

      if (progress.exception) {
        if (progress.exception.tom === 'danger') {
          badgeBg = '#fdecec';
          badgeColor = '#a23434';
          badgeDot = '#b23b3b';
        } else if (progress.exception.tom === 'warning') {
          badgeBg = '#fff4e6';
          badgeColor = '#c2610c';
          badgeDot = '#e07b39';
        } else {
          badgeBg = '#f1f3f6';
          badgeColor = '#5b6472';
          badgeDot = '#6b7280';
        }
      }

      return window.el('div', {
        style: 'background:#f6f7f9;border:1px solid #eceef1;border-radius:4px;padding:14px 16px;',
      },
        window.el('div', {
          style: 'font-size:10.5px;font-weight:700;color:#8a93a3;letter-spacing:.05em;margin-bottom:10px;',
        }, 'PREVIEW'),
        window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:7px;background:' + badgeBg + ';color:' + badgeColor + ';border-radius:4px;padding:5px 12px;font-size:13px;font-weight:700;margin-bottom:12px;',
        },
          window.el('span', {
            style: 'width:7px;height:7px;border-radius:50%;background:' + badgeDot + ';display:inline-block;',
          }),
          label
        ),
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
          window.el('span', {}, 'Etapa ' + ((progress.currentIndex >= 0 ? progress.currentIndex : 0) + 1) + ' de ' + progress.totalSteps),
          window.el('span', {}, percent + '%')
        )
      );
    }

    function openTrackingModal() {
      var api = ns.getTrackingApi();
      if (!api) {
        window.toast('Taxonomia visual do cliente indisponivel.', 'error');
        return;
      }

      var statusOptions = api.CLIENTE_TRACKING_STEPS.map(function (step) {
        return { value: step.key, label: step.label };
      });
      var exceptionOptions = api.CLIENTE_TRACKING_EXCECOES.map(function (item) {
        return { value: item.key, label: item.label };
      });

      var statusInput = window.selectInput({
        options: statusOptions,
        value: state.pedido.status_cliente_visual || (state.pedido.status === 'confirmado' ? 'confirmado' : 'recebido'),
        placeholder: 'Selecione uma etapa',
      });
      var exceptionInput = window.selectInput({
        options: exceptionOptions,
        value: state.pedido.status_cliente_excecao || '',
        placeholder: 'Sem excecao',
      });
      var messageInput = window.el('textarea', {
        style: 'width:100%;min-height:92px;border:1px solid #d8dce2;border-radius:4px;padding:9px 12px;font-size:13.5px;font-family:inherit;color:#16203a;resize:none;outline:none;',
        placeholder: 'Mensagem opcional ao cliente',
      });
      messageInput.value = state.pedido.status_cliente_mensagem || '';

      var previewWrap = window.el('div', { style: 'margin-top:4px;' });
      function renderPreview() {
        previewWrap.replaceChildren(buildTrackingPreviewNode(statusInput, exceptionInput, messageInput));
      }
      statusInput.addEventListener('change', renderPreview);
      exceptionInput.addEventListener('change', renderPreview);
      messageInput.addEventListener('input', renderPreview);
      renderPreview();

      var body = window.el('div', {},
        window.formField({
          label: 'Etapa principal',
          input: statusInput,
          hint: 'Mantem a trilha visual compartilhada com o portal do cliente.',
        }),
        window.formField({
          label: 'Excecao',
          input: exceptionInput,
          hint: 'Opcional. Quando definida, a comunicacao visual prioriza a excecao.',
        }),
        window.formField({
          label: 'Mensagem',
          input: messageInput,
          hint: 'Se ficar vazia, o sistema usa a frase padrao da etapa/excecao.',
        }),
        previewWrap
      );

      window.modal({
        title: 'Editar evolucao do cliente',
        body: body,
        saveLabel: 'Salvar mensagem',
        onSave: async function () {
          var updatePayload = {
            status_cliente_visual: statusInput.value || 'recebido',
            status_cliente_excecao: exceptionInput.value || null,
            status_cliente_mensagem: messageInput.value ? messageInput.value.trim() : null,
          };

          var updateRes = await window.supa
            .from('pedidos')
            .update(updatePayload)
            .eq('id', state.pedido.id);

          if (updateRes.error) {
            window.toast('Erro ao salvar situacao visivel: ' + (updateRes.error.message || 'desconhecido'), 'error');
            console.error('pedido-detail: erro ao atualizar situacao visivel', updateRes.error);
            return false;
          }

          var currentUserId = window.CURRENT_USER && window.CURRENT_USER.id
            ? window.CURRENT_USER.id
            : null;

          var insertRes = await window.supa
            .from('pedido_cliente_eventos')
            .insert({
              pedido_id: state.pedido.id,
              status: updatePayload.status_cliente_excecao || updatePayload.status_cliente_visual,
              titulo: api.getClienteTrackingStatusLabel(updatePayload),
              mensagem: api.getClienteTrackingMensagem(updatePayload),
              origem: 'manual',
              visivel_cliente: true,
              criado_por: currentUserId,
              metadata: null,
            });

          if (insertRes.error) {
            console.error('pedido-detail: erro ao inserir pedido_cliente_eventos', insertRes.error);
            window.toast('Situacao visivel salva, mas o historico visual nao foi registrado.', 'error');
          } else {
            window.toast('Situacao visivel salva com sucesso.', 'success');
          }

          await reload();
          render();
          return true;
        },
      });
    }

    return {
      buildTrackingAdmin: buildTrackingAdmin,
      buildParciaisAdmin: buildParciaisAdmin,
      buildEditButton: buildEditButton,
      buildEditItensButton: buildEditItensButton,
      navigateToPedidos: navigateToPedidos,
      navigateToOp: navigateToOp,
      navigateToNovaOp: navigateToNovaOp,
      scrollToSection: scrollToSection,
      openMovementModal: openMovementModal,
      openEditWarning: openEditWarning,
      openStatusActions: openStatusActions,
      openTrackingModal: openTrackingModal,
    };
  }

  ns.createPedidoDetailEvents = createPedidoDetailEvents;
})(window);
