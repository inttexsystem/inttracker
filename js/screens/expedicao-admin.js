// =====================================================================
// === SCREENS: EXPEDICAO ADMIN ========================================
// Tela operacional de expedicao vinculada ao Pedido e a OP de Acabamento.
// =====================================================================

(function (window) {
  'use strict';

  var CARD = 'background:#fff;border:1px solid #eceef1;border-radius:4px;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 14px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_SECONDARY = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var LABEL = 'display:block;font-size:12px;color:#8a93a3;font-weight:600;margin-bottom:6px;';

  function fmtMetros(value) {
    if (window.fmtMetros) return window.fmtMetros(value);
    var n = Number(value || 0);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtData(value) {
    if (!value) return '-';
    try { return new Date(value + (String(value).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR'); }
    catch (_) { return String(value); }
  }

  function formatOpDisplay(op, ctx) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(op, ctx || {});
    }
    var numero = op && op.numero != null ? op.numero : '-';
    return 'OP ' + numero + (op && op.ano != null ? '/' + op.ano : '');
  }

  function internalOpLabel(op) {
    var api = window.RAVATEX_OP_DISPLAY;
    var legacy = api && typeof api.formatOpLegacyCode === 'function'
      ? api.formatOpLegacyCode(op)
      : formatOpDisplay(op, null);
    return legacy.replace(/^OP /, 'Nº interno ');
  }

  function round2(value) {
    var n = Number(value || 0);
    return Math.round(n * 100) / 100;
  }

  function statusLabel(status) {
    return {
      aguardando_expedicao: 'Aguardando expedicao',
      parcial: 'Parcial',
      concluida: 'Concluida',
    }[status] || (status || '-');
  }

  function statusTone(status) {
    if (status === 'concluida') return { bg: '#e6f4ec', color: '#18794a' };
    if (status === 'parcial') return { bg: '#fff4e6', color: '#c2610c' };
    return { bg: '#eaf1fd', color: '#2563eb' };
  }

  function badge(status) {
    var tone = statusTone(status);
    return window.el('span', {
      style: 'display:inline-flex;align-items:center;border-radius:4px;padding:4px 10px;background:' + tone.bg + ';color:' + tone.color + ';font-size:12px;font-weight:700;',
    }, statusLabel(status));
  }

  function modeloLabel(item) {
    var modelo = item && item.modelo;
    if (!modelo) return item && item.modelo_id ? ('Modelo #' + item.modelo_id) : '-';
    var cores = [];
    if (modelo.cor_1 && modelo.cor_1.nome) cores.push(modelo.cor_1.nome);
    if (modelo.cor_2 && modelo.cor_2.nome) cores.push(modelo.cor_2.nome);
    var largura = modelo.largura != null ? Number(modelo.largura).toFixed(2).replace('.', ',') + ' m' : '';
    return [modelo.nome, largura, cores.join(' / ')].filter(Boolean).join(' - ');
  }

  function field(label, node) {
    return window.el('div', {},
      window.el('label', { style: LABEL }, label),
      node);
  }

  function value(text, weight, color) {
    return window.el('div', {
      style: 'font-size:13.5px;color:' + (color || '#16203a') + ';font-weight:' + (weight || '600') + ';',
    }, text);
  }

  function sum(rows, key) {
    return round2((rows || []).reduce(function (acc, row) {
      return acc + Number(row && row[key] ? row[key] : 0);
    }, 0));
  }

  async function screenExpedicaoAdmin(expedicaoId) {
    var container = window.el('div', {});
    var state = {
      expedicao: null,
      itens: [],
      movimentos: [],
      movimentoItens: [],
      opSiblings: [],
      loadingError: null,
    };

    async function reload() {
      state.loadingError = null;

      var expRes = await window.supa.from('expedicoes')
        .select('id, pedido_id, op_latex_id, lote_id, cliente_id, status, liberado_em, criado_em, atualizado_em, pedido:pedido_id(id, numero, status, tipo_recebimento, criado_em), op:op_latex_id(id, numero, ano, status, tipo, criado_em, lote_id), lote:lote_id(id, numero), cliente:cliente_id(id, nome)')
        .eq('id', expedicaoId)
        .maybeSingle();

      if (expRes.error || !expRes.data) {
        state.loadingError = 'expedicao';
        window.toast('Expedicao nao encontrada.', 'error');
        console.error(expRes.error);
        render();
        return;
      }

      state.expedicao = expRes.data;
      state.opSiblings = [];
      if (state.expedicao.pedido_id) {
        try {
          var lotesRes = await window.supa.from('lotes')
            .select('id')
            .eq('pedido_id', state.expedicao.pedido_id);
          var loteIds = lotesRes.error ? [] : (lotesRes.data || [])
            .map(function (lote) { return lote && lote.id; })
            .filter(function (id) { return id != null; });
          if (loteIds.length) {
            var siblingsRes = await window.supa.from('ops')
              .select('id, numero, ano, status, tipo, criado_em, lote_id')
              .in('lote_id', loteIds)
              .order('criado_em', { ascending: true })
              .order('id', { ascending: true });
            state.opSiblings = siblingsRes.error ? [] : (siblingsRes.data || []);
          }
        } catch (err) {
          console.error('expedicao-admin: erro ao carregar OPs irmas do pedido', err);
          state.opSiblings = [];
        }
      }

      var itensRes = await window.supa.from('expedicao_itens')
        .select('id, expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados, metros_entregues, modelo:modelo_id(id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome))')
        .eq('expedicao_id', expedicaoId)
        .order('id', { ascending: true });
      if (itensRes.error) {
        state.loadingError = 'itens';
        console.error(itensRes.error);
        render();
        return;
      }
      state.itens = itensRes.data || [];

      var movRes = await window.supa.from('expedicao_movimentos')
        .select('id, expedicao_id, tipo, data, observacao, criado_em')
        .eq('expedicao_id', expedicaoId)
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      if (movRes.error) {
        state.movimentos = [];
        state.movimentoItens = [];
        console.error(movRes.error);
      } else {
        state.movimentos = movRes.data || [];
        var movimentoIds = state.movimentos.map(function (row) { return row.id; });
        if (movimentoIds.length) {
          var movItensRes = await window.supa.from('expedicao_movimento_itens')
            .select('id, movimento_id, expedicao_item_id, metros')
            .in('movimento_id', movimentoIds);
          state.movimentoItens = movItensRes.error ? [] : (movItensRes.data || []);
          if (movItensRes.error) console.error(movItensRes.error);
        } else {
          state.movimentoItens = [];
        }
      }

      render();
    }

    function buildHeader(totalLiberado, totalEntregue) {
      var exp = state.expedicao || {};
      var pedidoNumero = exp.pedido && exp.pedido.numero ? ('#' + exp.pedido.numero) : ('#' + exp.pedido_id);
      var opCtx = { pedido: exp.pedido || null, ops: state.opSiblings };
      var opLabel = exp.op && exp.op.numero && exp.op.ano
        ? formatOpDisplay(exp.op, opCtx)
        : (exp.op_latex_id ? 'OP #' + exp.op_latex_id : null);

      var lineageNodes = [];
      lineageNodes.push(window.el('span', { style: 'font-size:12.5px;color:#2c4a78;font-weight:600;' }, 'Cadeia:'));
      lineageNodes.push(window.el('span', { style: 'font-size:12.5px;font-weight:700;color:#16203a;background:#fff;border-radius:3px;padding:3px 7px;' }, 'Pedido ' + pedidoNumero));
      lineageNodes.push(window.el('span', { style: 'font-size:12px;color:#9aa2af;' }, '→'));
      lineageNodes.push(opLabel
        ? window.el('button', {
            type: 'button',
            style: 'font-size:12.5px;font-weight:700;color:#2563eb;background:#fff;border:none;border-radius:3px;padding:3px 7px;cursor:pointer;font-family:inherit;',
            onclick: function () { window.navigate('#/ops/' + exp.op_latex_id); },
          }, opLabel)
        : window.el('span', { style: 'font-size:12.5px;font-weight:700;color:#8a93a3;background:#fff;border-radius:3px;padding:3px 7px;' }, 'OP sem vinculo'));
      if (exp.op) {
        lineageNodes.push(window.el('span', { style: 'font-size:11.5px;color:#8a93a3;background:#fff;border-radius:3px;padding:3px 7px;' }, internalOpLabel(exp.op)));
      }
      lineageNodes.push(window.el('span', { style: 'font-size:12px;color:#9aa2af;' }, '→'));
      lineageNodes.push(window.el('span', { style: 'font-size:12.5px;font-weight:700;color:#c2610c;background:#fff;border-radius:3px;padding:3px 7px;' }, 'Expedicao (esta tela)'));
      var lineageStrip = window.el('div', {
        style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#eaf1fd;border:1px solid #d7e6fb;border-radius:4px;padding:8px 14px;margin-bottom:12px;',
      }, lineageNodes);

      return window.el('div', { style: 'margin-bottom:14px;' },
        lineageStrip,
        window.el('div', {
          style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;',
        },
          window.el('div', {},
            window.el('div', { style: 'font-size:13.5px;color:#9aa2af;margin-bottom:6px;' },
              'Expedicoes / ', window.el('span', { style: 'color:#5b6472;font-weight:600;' }, 'Pedido ' + pedidoNumero)),
            window.el('h1', { style: 'margin:0;font-size:24px;font-weight:800;color:#16203a;letter-spacing:-.01em;' },
              'Expedicao do Pedido ' + pedidoNumero),
            window.el('div', { style: 'font-size:13px;color:#8a93a3;margin-top:6px;' },
              (exp.cliente && exp.cliente.nome ? exp.cliente.nome : 'Cliente') + ' - ' +
              (exp.lote && exp.lote.numero ? 'Lote ' + exp.lote.numero : 'Lote') + ' - ' +
              fmtMetros(totalEntregue) + ' de ' + fmtMetros(totalLiberado))
          ),
          window.el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' },
            badge(exp.status),
            exp.pedido_id ? window.el('button', { type: 'button', style: BTN_SECONDARY, onclick: function () { window.navigate('#/pedidos/' + exp.pedido_id); } }, 'Ver pedido') : null,
            exp.op_latex_id ? window.el('button', { type: 'button', style: BTN_SECONDARY, onclick: function () { window.navigate('#/ops/' + exp.op_latex_id); } }, 'Ver OP') : null)
        )
      );
    }

    function buildResumo(totalLiberado, totalEntregue) {
      var saldo = round2(totalLiberado - totalEntregue);
      return window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;',
      },
        window.el('div', { style: CARD + 'padding:14px 16px;' },
          window.el('div', { style: 'font-size:11px;color:#8a93a3;font-weight:700;margin-bottom:6px;' }, 'LIBERADO'),
          window.el('div', { style: 'font-size:20px;font-weight:800;color:#16203a;' }, fmtMetros(totalLiberado))),
        window.el('div', { style: CARD + 'padding:14px 16px;' },
          window.el('div', { style: 'font-size:11px;color:#8a93a3;font-weight:700;margin-bottom:6px;' }, 'ENTREGUE / COLETADO'),
          window.el('div', { style: 'font-size:20px;font-weight:800;color:#18794a;' }, fmtMetros(totalEntregue))),
        window.el('div', { style: CARD + 'padding:14px 16px;' },
          window.el('div', { style: 'font-size:11px;color:#8a93a3;font-weight:700;margin-bottom:6px;' }, 'SALDO'),
          window.el('div', { style: 'font-size:20px;font-weight:800;color:' + (saldo > 0 ? '#c2610c' : '#18794a') + ';' }, fmtMetros(Math.max(saldo, 0))))
      );
    }

    function buildItens() {
      var card = window.el('div', { style: CARD + 'overflow:hidden;margin-bottom:14px;' },
        window.el('div', { style: 'padding:16px 20px;font-size:15.5px;font-weight:700;color:#16203a;' }, 'Itens da expedicao'));
      if (!state.itens.length) {
        card.appendChild(window.el('div', { style: 'padding:0 20px 18px;font-size:13px;color:#9aa2af;' }, 'Nenhum item liberado para expedicao.'));
        return card;
      }
      var cols = '1fr 140px 150px 130px';
      card.appendChild(window.el('div', { style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;background:#f8f9fb;border-top:1px solid #eceef1;border-bottom:1px solid #eceef1;padding:9px 20px;min-width:720px;' },
        ['MODELO / CORES', 'LIBERADO', 'ENTREGUE', 'SALDO'].map(function (label) {
          return window.el('div', { style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.03em;' }, label);
        })));
      state.itens.forEach(function (item) {
        var liberado = Number(item.metros_liberados || 0);
        var entregue = Number(item.metros_entregues || 0);
        var saldo = Math.max(round2(liberado - entregue), 0);
        card.appendChild(window.el('div', { style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;padding:12px 20px;border-bottom:1px solid #f1f3f6;align-items:center;min-width:720px;' },
          value(modeloLabel(item), '700'),
          value(fmtMetros(liberado)),
          value(fmtMetros(entregue), '700', '#18794a'),
          value(fmtMetros(saldo), '700', saldo > 0 ? '#c2610c' : '#18794a')));
      });
      return card;
    }

    function buildRegistro(totalLiberado, totalEntregue) {
      var saldoTotal = round2(totalLiberado - totalEntregue);
      var tipoInput = window.selectInput({
        options: [
          { value: 'entrega', label: 'Entrega' },
          { value: 'coleta', label: 'Coleta' },
        ],
        value: 'entrega',
      });
      var dataInput = window.textInput({ type: 'date', value: new Date().toISOString().slice(0, 10) });
      var obsInput = window.el('textarea', {
        style: 'width:100%;min-height:56px;border:1px solid #d8dce2;border-radius:4px;padding:9px 12px;font-size:13.5px;font-family:inherit;color:#16203a;resize:none;outline:none;',
        placeholder: 'Observacao opcional',
      });
      var linhas = state.itens.map(function (item) {
        var saldo = Math.max(round2(Number(item.metros_liberados || 0) - Number(item.metros_entregues || 0)), 0);
        var input = window.textInput({ type: 'number', step: '0.01', value: saldo > 0 ? String(saldo) : '0' });
        input.disabled = saldo <= 0;
        return { item: item, input: input, saldo: saldo };
      });

      return window.el('div', { style: CARD + 'padding:16px 20px;margin-bottom:14px;' },
        window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;' },
          window.el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;' }, 'Registrar entrega/coleta'),
          saldoTotal <= 0 ? badge('concluida') : window.el('span', { style: 'font-size:12.5px;color:#8a93a3;' }, 'Saldo disponivel: ' + fmtMetros(saldoTotal))),
        saldoTotal <= 0
          ? window.el('div', { style: 'font-size:13px;color:#18794a;font-weight:600;' }, 'Expedicao sem saldo pendente.')
          : window.el('div', {},
              window.el('div', { style: 'display:grid;grid-template-columns:180px 180px 1fr;gap:12px;margin-bottom:12px;' },
                field('Tipo', tipoInput),
                field('Data', dataInput),
                field('Observacao', obsInput)),
              window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;overflow:hidden;margin-bottom:12px;' },
                linhas.map(function (linha, index) {
                  return window.el('div', { style: 'display:grid;grid-template-columns:1fr 150px;gap:12px;align-items:center;padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
                    window.el('div', {},
                      window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;' }, modeloLabel(linha.item)),
                      window.el('div', { style: 'font-size:11.5px;color:#8a93a3;margin-top:2px;' }, 'Saldo: ' + fmtMetros(linha.saldo))),
                    linha.input);
                })),
              window.el('button', {
                type: 'button',
                style: BTN_PRIMARY,
                onclick: async function (event) {
                  var btn = event && event.currentTarget ? event.currentTarget : null;
                  var payload = [];
                  for (var i = 0; i < linhas.length; i++) {
                    var metros = Number(linhas[i].input.value || 0);
                    if (metros > 0) {
                      if (metros > linhas[i].saldo) {
                        window.toast('Quantidade maior que o saldo do item.', 'error');
                        return;
                      }
                      payload.push({ expedicao_item_id: linhas[i].item.id, metros: metros });
                    }
                  }
                  if (!payload.length) {
                    window.toast('Informe ao menos uma quantidade para entrega/coleta.', 'error');
                    return;
                  }
                  if (btn) btn.disabled = true;
                  var r = await window.supa.rpc('registrar_entrega_expedicao', {
                    p_expedicao_id: state.expedicao.id,
                    p_tipo: tipoInput.value,
                    p_data: dataInput.value,
                    p_itens: payload,
                    p_observacao: obsInput.value ? obsInput.value.trim() : null,
                  });
                  if (r.error || (r.data && r.data.ok === false)) {
                    var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Nao foi possivel registrar');
                    window.toast('Erro ao registrar expedicao: ' + msg, 'error');
                    if (btn) btn.disabled = false;
                    return;
                  }
                  window.toast('Entrega/coleta registrada.', 'success');
                  await reload();
                },
              }, 'Salvar entrega/coleta')
            )
      );
    }

    function buildHistorico() {
      var itensById = {};
      state.itens.forEach(function (item) { itensById[item.id] = item; });
      var movItensByMov = {};
      state.movimentoItens.forEach(function (row) {
        if (!movItensByMov[row.movimento_id]) movItensByMov[row.movimento_id] = [];
        movItensByMov[row.movimento_id].push(row);
      });

      var card = window.el('div', { style: CARD + 'padding:16px 20px;margin-bottom:14px;' },
        window.el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:12px;' }, 'Historico'));
      if (!state.movimentos.length) {
        card.appendChild(window.el('div', { style: 'font-size:13px;color:#9aa2af;' }, 'Nenhuma entrega/coleta registrada ainda.'));
        return card;
      }
      state.movimentos.forEach(function (mov) {
        var linhas = movItensByMov[mov.id] || [];
        card.appendChild(window.el('div', { style: 'border-top:1px solid #f1f3f6;padding:12px 0;' },
          window.el('div', { style: 'display:flex;justify-content:space-between;gap:12px;align-items:center;' },
            window.el('div', { style: 'font-size:13.5px;font-weight:700;color:#16203a;' }, statusLabel(mov.tipo) + ' - ' + fmtData(mov.data)),
            window.el('div', { style: 'font-size:12px;color:#8a93a3;font-weight:600;' }, fmtData(mov.criado_em))),
          mov.observacao ? window.el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:3px;' }, mov.observacao) : null,
          window.el('div', { style: 'margin-top:7px;display:flex;flex-direction:column;gap:4px;' },
            linhas.map(function (linha) {
              var item = itensById[linha.expedicao_item_id];
              return window.el('div', { style: 'font-size:13px;color:#3f4757;' }, modeloLabel(item) + ': ' + fmtMetros(linha.metros));
            }))));
      });
      return card;
    }

    function buildConclusao(totalLiberado, totalEntregue) {
      var exp = state.expedicao || {};
      var saldo = round2(totalLiberado - totalEntregue);
      var ready = saldo <= 0 && exp.status === 'concluida';
      return window.el('div', { style: CARD + 'padding:16px 20px;' },
        window.el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:10px;' }, 'Conclusao'),
        window.el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;margin-bottom:12px;' },
          ready
            ? 'Toda a expedicao desta OP esta entregue/coletada. O pedido pode ser validado para conclusao.'
            : 'O pedido ainda nao pode ser concluido enquanto houver saldo pendente nesta expedicao.'),
        window.el('button', {
          type: 'button',
          style: ready ? BTN_PRIMARY : (BTN_SECONDARY + 'color:#9aa2af;cursor:not-allowed;'),
          disabled: ready ? null : 'disabled',
          onclick: async function (event) {
            if (!ready) return;
            var btn = event && event.currentTarget ? event.currentTarget : null;
            if (btn) btn.disabled = true;
            var r = await window.supa.rpc('concluir_pedido_se_pronto', { p_pedido_id: exp.pedido_id });
            if (r.error || (r.data && r.data.ok === false)) {
              var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Pedido com pendencias');
              window.toast('Pedido nao concluido: ' + msg, 'error');
              if (btn) btn.disabled = false;
              return;
            }
            window.toast('Pedido concluido.', 'success');
            await reload();
          },
        }, 'Concluir pedido')
      );
    }

    function render() {
      if (state.loadingError) {
        container.replaceChildren(
          window.el('div', { style: CARD + 'padding:18px 20px;color:#b42318;' }, 'Erro ao carregar expedicao (' + state.loadingError + ').'),
          window.el('div', { style: 'margin-top:12px;' },
            window.el('button', { type: 'button', style: BTN_SECONDARY, onclick: function () { window.navigate('#/pedidos'); } }, 'Voltar'))
        );
        return;
      }
      if (!state.expedicao) {
        container.replaceChildren(window.el('div', { style: CARD + 'padding:18px 20px;color:#8a93a3;' }, 'Carregando expedicao...'));
        return;
      }
      var totalLiberado = sum(state.itens, 'metros_liberados');
      var totalEntregue = sum(state.itens, 'metros_entregues');
      container.replaceChildren(
        buildHeader(totalLiberado, totalEntregue),
        buildResumo(totalLiberado, totalEntregue),
        buildItens(),
        buildRegistro(totalLiberado, totalEntregue),
        buildHistorico(),
        buildConclusao(totalLiberado, totalEntregue)
      );
    }

    render();
    await reload();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.expedicaoAdmin = {
    screenExpedicaoAdmin: screenExpedicaoAdmin,
  };
  window.screenExpedicaoAdmin = screenExpedicaoAdmin;
})(window);
