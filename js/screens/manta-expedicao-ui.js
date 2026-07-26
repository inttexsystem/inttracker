// =====================================================================
// === SCREENS: MANTA EXPEDICAO UI =====================================
// PHASE-MANTA-B2B. Painel de saldos e ACOES da expedicao Manta, montado
// dentro da tela dedicada `#/expedicoes/:id` (a entidade continua na sua
// tela; nenhuma entidade completa e embutida em modal).
//
// Fontes autoritativas:
//   - saldo/elegibilidade: `consultar_saldo_expedicao_manta` (db/86).
//     A formula do backend NAO e reproduzida aqui; o `previsto` do
//     planejamento e exibido apenas como informacao e nunca decide.
//   - liberacao:  `liberar_expedicao_manta_parcial`  (db/86)
//   - estorno:    `estornar_expedicao_manta_parcial` (db/87)
//
// Modais: contem SOMENTE o formulario da acao (quantidades + motivo).
// Nao contem expedicao, OP, Pedido nem qualquer outra entidade.
//
// Este modulo nao escreve em tabela: delega em
// `window.RAVATEX_MANTA_WRITES`.
// =====================================================================

(function (window) {
  'use strict';

  var CARD = 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:4px;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;border-radius:4px;padding:9px 14px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_WARN = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-surface);color:var(--rv-signal-caution);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:9px 14px;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_OFF = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-surface);color:var(--rv-text-tertiary);border:1px solid var(--rv-border);border-radius:4px;padding:9px 14px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:not-allowed;';
  var LABEL = 'display:block;font-size:12px;color:var(--rv-text-tertiary);font-weight:600;margin-bottom:6px;';

  function writes() {
    return window.RAVATEX_MANTA_WRITES || null;
  }

  // Coage antes de formatar: um total ausente na resposta nunca pode
  // chegar ao operador como "NaN m" dentro de uma mensagem de sucesso.
  function fmtMetros(value) {
    var n = Number(value);
    var safe = Number.isFinite(n) ? n : 0;
    if (window.fmtMetros) return window.fmtMetros(safe);
    return safe.toFixed(2).replace('.', ',') + ' m';
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function metric(label, value, color) {
    return window.el('div', { style: CARD + 'padding:12px 14px;' },
      window.el('div', { style: 'font-size:10.5px;color:var(--rv-text-tertiary);font-weight:700;letter-spacing:.03em;margin-bottom:5px;' }, label),
      window.el('div', { style: 'font-size:18px;font-weight:800;color:' + (color || 'var(--rv-text-primary)') + ';' }, fmtMetros(value)));
  }

  function cell(text, weight, color) {
    return window.el('div', {
      style: 'font-size:13px;color:' + (color || 'var(--rv-text-primary)') + ';font-weight:' + (weight || '600') + ';',
    }, text);
  }

  // Rotulo do item pela lineage ja carregada pela tela (expedicao_itens
  // embute o modelo). Cai no op_item quando o item ainda nao foi liberado.
  function itemLabel(saldoItem, modeloById) {
    var modelo = modeloById[saldoItem.modelo_id];
    var display = window.RAVATEX_OP_DISPLAY;
    if (modelo && display && typeof display.formatProductLabel === 'function') {
      return display.formatProductLabel(modelo);
    }
    if (modelo && modelo.nome) return modelo.nome;
    return 'Item #' + saldoItem.op_item_id;
  }

  // -------------------------------------------------------------------
  // Modal de ACAO — liberacao parcial/adicional.
  // -------------------------------------------------------------------
  function abrirModalLiberacao(ctx) {
    var elegiveis = ctx.saldo.itens.filter(function (item) { return num(item.disponivel) > 0; });
    if (!elegiveis.length) {
      window.toast('Sem saldo disponível para liberar.', 'error');
      return;
    }
    var obsInput = window.textInput({ type: 'text', value: '', placeholder: 'observação (opcional)' });
    var linhas = elegiveis.map(function (item) {
      var input = window.textInput({ type: 'number', step: '0.01', value: String(num(item.disponivel)) });
      return { item: item, input: input };
    });
    // Uma chave por TENTATIVA: toda retentativa desta mesma submissao
    // reusa a chave e o backend devolve o resultado gravado (sem duplicar).
    var idempotencyKey = writes() ? writes().novaIdempotencyKey('manta_release') : null;
    var enviando = false;

    var body = window.el('div', {},
      window.el('div', { style: 'font-size:12.5px;color:var(--rv-text-secondary);line-height:1.5;margin-bottom:12px;' },
        'Libere para expedição a saída medida disponível. O saldo abaixo vem do cálculo autoritativo do servidor.'),
      window.el('div', { style: 'border:1px solid var(--rv-border);border-radius:4px;overflow:hidden;margin-bottom:12px;' },
        linhas.map(function (linha, index) {
          return window.el('div', { style: 'padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid var(--rv-border-soft);' : '') },
            window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap;' },
              window.el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-text-primary);min-width:0;' }, itemLabel(linha.item, ctx.modeloById)),
              window.el('span', { style: 'font-size:11.5px;color:var(--rv-signal-caution);background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:2px 8px;font-weight:700;white-space:nowrap;' },
                fmtMetros(num(linha.item.disponivel)) + ' disponível')),
            window.el('label', { style: LABEL }, 'Liberar'),
            linha.input);
        })),
      window.el('label', { style: LABEL }, 'Observação'),
      obsInput);

    window.modal({
      title: 'Liberar para expedição',
      body: body,
      saveLabel: 'Liberar',
      onSave: async function () {
        if (enviando) return false;
        var api = writes();
        if (!api) { window.toast('Módulo de escrita Manta indisponível.', 'error'); return false; }
        var payload = [];
        for (var i = 0; i < linhas.length; i++) {
          var metros = num(linhas[i].input.value);
          if (metros > num(linhas[i].item.disponivel)) {
            window.toast('Quantidade maior que o saldo disponível do item.', 'error');
            return false;
          }
          if (metros > 0) payload.push({ op_item_id: linhas[i].item.op_item_id, metros: metros });
        }
        if (!payload.length) {
          window.toast('Informe ao menos uma quantidade para liberar.', 'error');
          return false;
        }
        enviando = true;
        var res = await api.liberarExpedicaoMantaParcial({
          opTecelagemId: ctx.opTecelagemId,
          itens: payload,
          observacao: obsInput.value,
          idempotencyKey: idempotencyKey,
        });
        enviando = false;
        if (!res.ok) {
          window.toast('Liberação não realizada: ' + res.erro, 'error');
          console.error('manta-expedicao-ui: liberar', res);
          return false;
        }
        window.toast('Expedição liberada: ' + fmtMetros(res.liberado_total) + '.', 'success');
        await ctx.reload();
        return true;
      },
    });
  }

  // -------------------------------------------------------------------
  // Modal de ACAO — estorno controlado. O motivo e obrigatorio e trimado;
  // o teto por item e (liberado - entregue): estornar abaixo do entregue
  // e recusado pelo backend e nem sequer e oferecido aqui.
  // -------------------------------------------------------------------
  function abrirModalEstorno(ctx) {
    var elegiveis = ctx.saldo.itens.filter(function (item) {
      return round2(num(item.liberado) - num(item.entregue)) > 0;
    });
    if (!elegiveis.length) {
      window.toast('Nenhum item possui liberação estornável.', 'error');
      return;
    }
    var motivoInput = window.textInput({ type: 'text', value: '', placeholder: 'Ex.: liberação lançada na OP errada' });
    var linhas = elegiveis.map(function (item) {
      var teto = round2(num(item.liberado) - num(item.entregue));
      var input = window.textInput({ type: 'number', step: '0.01', value: String(teto) });
      return { item: item, input: input, teto: teto };
    });
    var idempotencyKey = writes() ? writes().novaIdempotencyKey('manta_reversal') : null;
    var enviando = false;

    var body = window.el('div', {},
      window.el('div', { style: 'font-size:12.5px;color:var(--rv-signal-caution);background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:10px 12px;line-height:1.5;margin-bottom:12px;' },
        'O estorno reduz o liberado desta expedição. O limite por item é o liberado menos o já entregue ao cliente — o servidor recusa qualquer valor acima disso.'),
      window.el('div', { style: 'border:1px solid var(--rv-border);border-radius:4px;overflow:hidden;margin-bottom:12px;' },
        linhas.map(function (linha, index) {
          return window.el('div', { style: 'padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid var(--rv-border-soft);' : '') },
            window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap;' },
              window.el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-text-primary);min-width:0;' }, itemLabel(linha.item, ctx.modeloById)),
              window.el('span', { style: 'font-size:11.5px;color:var(--rv-signal-caution);background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);border-radius:4px;padding:2px 8px;font-weight:700;white-space:nowrap;' },
                'até ' + fmtMetros(linha.teto))),
            window.el('label', { style: LABEL }, 'Estornar'),
            linha.input);
        })),
      window.el('label', { style: LABEL }, 'Motivo do estorno (obrigatório)'),
      motivoInput);

    window.modal({
      title: 'Estornar liberação',
      body: body,
      saveLabel: 'Estornar',
      danger: true,
      onSave: async function () {
        if (enviando) return false;
        var api = writes();
        if (!api) { window.toast('Módulo de escrita Manta indisponível.', 'error'); return false; }
        var motivo = String(motivoInput.value || '').trim();
        if (!motivo) {
          window.toast('Informe o motivo do estorno.', 'error');
          return false;
        }
        var payload = [];
        for (var i = 0; i < linhas.length; i++) {
          var metros = num(linhas[i].input.value);
          if (metros > linhas[i].teto) {
            window.toast('Estorno maior que o liberado ainda não entregue do item.', 'error');
            return false;
          }
          if (metros > 0) payload.push({ op_item_id: linhas[i].item.op_item_id, metros: metros });
        }
        if (!payload.length) {
          window.toast('Informe ao menos uma quantidade para estornar.', 'error');
          return false;
        }
        enviando = true;
        var res = await api.estornarExpedicaoMantaParcial({
          expedicaoId: ctx.expedicaoId,
          itens: payload,
          motivo: motivo,
          idempotencyKey: idempotencyKey,
        });
        enviando = false;
        if (!res.ok) {
          window.toast('Estorno não realizado: ' + res.erro, 'error');
          console.error('manta-expedicao-ui: estornar', res);
          return false;
        }
        window.toast('Liberação estornada: ' + fmtMetros(res.estornado_total) + '.', 'success');
        await ctx.reload();
        return true;
      },
    });
  }

  // -------------------------------------------------------------------
  // Painel: previsto / medido / liberado / entregue / saldo por item e
  // agregado, mais as acoes de liberacao e estorno.
  // -------------------------------------------------------------------
  function buildMantaExpedicaoPanel(input) {
    var safe = input || {};
    var saldo = safe.saldo;

    if (!saldo) {
      return window.el('div', { style: CARD + 'padding:16px 20px;margin-bottom:14px;font-size:13px;color:var(--rv-text-tertiary);' },
        'Carregando saldo da expedição Manta...');
    }
    if (saldo.ok !== true) {
      return window.el('div', { style: CARD + 'padding:16px 20px;margin-bottom:14px;' },
        window.el('div', { style: 'font-size:15.5px;font-weight:700;color:var(--rv-text-primary);margin-bottom:8px;' }, 'Expedição Manta'),
        window.el('div', { style: 'font-size:13px;color:var(--rv-signal-negative);line-height:1.5;' },
          'Não foi possível obter o saldo autoritativo (' + (saldo.codigo || 'erro') + '): ' + (saldo.erro || '—')));
    }

    var ctx = {
      saldo: { itens: Array.isArray(saldo.itens) ? saldo.itens : [] },
      opTecelagemId: safe.opTecelagemId,
      expedicaoId: safe.expedicaoId,
      modeloById: safe.modeloById || {},
      reload: safe.reload || function () { return Promise.resolve(); },
    };

    var podeLiberar = num(saldo.disponivel_total) > 0;
    var podeEstornar = ctx.saldo.itens.some(function (item) {
      return round2(num(item.liberado) - num(item.entregue)) > 0;
    });

    var acoes = window.el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' });
    if (podeLiberar) {
      acoes.appendChild(window.el('button', {
        type: 'button', style: BTN_PRIMARY,
        onclick: function () { abrirModalLiberacao(ctx); },
      }, num(saldo.liberado_total) > 0 ? 'Liberar adicional' : 'Liberar para expedição'));
    } else {
      acoes.appendChild(window.el('button', {
        type: 'button', style: BTN_OFF, disabled: 'disabled',
        title: 'Sem saída medida disponível para liberar.',
      }, 'Liberar para expedição'));
    }
    // Estorno oculto (nao apenas desabilitado) quando nenhuma liberacao
    // pode ser desfeita sem cruzar o entregue: nao ha acao a oferecer.
    if (podeEstornar) {
      acoes.appendChild(window.el('button', {
        type: 'button', style: BTN_WARN,
        onclick: function () { abrirModalEstorno(ctx); },
      }, 'Estornar liberação'));
    }

    var card = window.el('div', { style: CARD + 'padding:16px 20px;margin-bottom:14px;' },
      window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;' },
        window.el('div', {},
          window.el('div', { style: 'font-size:15.5px;font-weight:700;color:var(--rv-text-primary);' }, 'Saldo da expedição Manta'),
          window.el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);margin-top:3px;' },
            'Origem: Tecelagem (Manta) · saldo autoritativo do servidor')),
        acoes),
      window.el('div', { 'data-rv-metrics': '', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;' },
        metric('PREVISTO', saldo.previsto_total, 'var(--rv-text-tertiary)'),
        metric('MEDIDO', saldo.recebido_total, 'var(--rv-text-primary)'),
        metric('LIBERADO', saldo.liberado_total, 'var(--rv-accent-blue)'),
        metric('ENTREGUE', saldo.entregue_total, 'var(--rv-signal-positive)'),
        metric('SALDO', saldo.disponivel_total, num(saldo.disponivel_total) > 0 ? 'var(--rv-signal-caution)' : 'var(--rv-signal-positive)')));

    var cols = 'minmax(0,1.4fr) 110px 110px 110px 110px 110px';
    var tabela = window.el('div', { 'data-rv-table-scroll': '', style: 'overflow-x:auto;' });
    var inner = window.el('div', { style: 'min-width:760px;border:1px solid var(--rv-border);border-radius:4px;overflow:hidden;' });
    inner.appendChild(window.el('div', {
      style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);padding:9px 14px;',
    }, ['ITEM', 'PREVISTO', 'MEDIDO', 'LIBERADO', 'ENTREGUE', 'SALDO'].map(function (label) {
      return window.el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.03em;' }, label);
    })));
    ctx.saldo.itens.forEach(function (item, index) {
      var disponivel = num(item.disponivel);
      inner.appendChild(window.el('div', {
        style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;padding:11px 14px;align-items:center;'
          + (index < ctx.saldo.itens.length - 1 ? 'border-bottom:1px solid var(--rv-border-soft);' : ''),
      },
        cell(itemLabel(item, ctx.modeloById), '700'),
        cell(fmtMetros(item.previsto), '500', 'var(--rv-text-tertiary)'),
        cell(fmtMetros(item.recebido), '700'),
        cell(fmtMetros(item.liberado), '700', 'var(--rv-accent-blue)'),
        cell(fmtMetros(item.entregue), '700', 'var(--rv-signal-positive)'),
        cell(fmtMetros(disponivel), '700', disponivel > 0 ? 'var(--rv-signal-caution)' : 'var(--rv-signal-positive)')));
    });
    if (!ctx.saldo.itens.length) {
      inner.appendChild(window.el('div', { style: 'padding:14px;font-size:13px;color:var(--rv-text-tertiary);' }, 'OP de tecelagem sem itens.'));
    }
    tabela.appendChild(inner);
    card.appendChild(tabela);
    card.appendChild(window.el('div', { style: 'font-size:11.5px;color:var(--rv-text-tertiary);margin-top:10px;line-height:1.45;' },
      'O previsto é o planejamento da OP e nunca autoriza liberação. Só a saída medida sem defeito gera saldo.'));
    return card;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.mantaExpedicaoUi = {
    buildMantaExpedicaoPanel: buildMantaExpedicaoPanel,
    abrirModalLiberacao: abrirModalLiberacao,
    abrirModalEstorno: abrirModalEstorno,
  };
})(window);
