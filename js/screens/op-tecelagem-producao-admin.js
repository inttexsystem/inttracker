// =====================================================================
// === SCREENS: OP TECELAGEM EM PRODUCAO (ADMIN) ========================
// Template operacional da OP de Tecelagem quando status === 'em_producao'.
//
// Este modulo existe para manter js/screens/op-nova.js focado na rota de
// Nova OP / OP Aberta / carregamento de dados. A tela operacional de
// producao tem ciclo visual e regras proprias, entao fica nomeada de modo
// explicito aqui.
//
// Compatibilidade: expõe window.renderOPTecelagemProducaoAdmin(ctx) e
// window.RAVATEX_SCREENS.opTecelagemProducaoAdmin.
// =====================================================================

(function (window) {
  'use strict';

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect></svg>';

  var CARD = 'background:#fff;border:1px solid #eceef1;border-radius:6px;';
  var TH_STYLE = 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;white-space:nowrap;';
  var BTN_BACK = 'display:inline-flex;align-items:center;gap:7px;background:#fff;color:#5b6472;border:1px solid #d8dce2;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_SOLID_SM = 'display:inline-flex;align-items:center;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#2563eb;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var BADGE_TECELAGEM = 'background:#f3effe;color:#7c3aed;border-radius:4px;padding:4px 11px;font-size:12.5px;font-weight:700;';
  var BADGE_EM_PRODUCAO = 'display:inline-flex;align-items:center;gap:6px;background:#fff4e6;color:#c2610c;border-radius:4px;padding:4px 11px;font-size:12.5px;font-weight:700;';

  function thRow(colsTemplate, labels) {
    var cells = labels.map(function (l, i) {
      return el('div', { style: TH_STYLE }, l);
    });
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:10px 24px;background:#f8f9fb;border-bottom:1px solid #eceef1;' }, cells);
  }

  function gridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:12px 24px;border-bottom:1px solid #f1f3f6;align-items:center;' }, cells);
  }

  function fmtDateLabel(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch (err) {
      return '';
    }
  }

  function humanizeLabel(value) {
    if (!value) return '—';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).replace(/_/g, ' ');
  }

  function hasLinkedPedido(ctx) {
    return !!(ctx.pedidoCtx && ctx.pedidoCtx.id);
  }

  function resolveClienteNome(ctx) {
    if (ctx.pedidoCtx && ctx.pedidoCtx.clienteNome) return ctx.pedidoCtx.clienteNome;
    if (ctx.op && ctx.op.lote && ctx.op.lote.cliente && ctx.op.lote.cliente.nome) return ctx.op.lote.cliente.nome;
    return '—';
  }

  function computeTotaisProducao(ctx) {
    var todosItens = ctx.entregasCima.flatMap(function (e) {
      return (e.entrega_itens || []).filter(function (ei) { return ei.op_id === ctx.op.id; });
    });
    var totalPorItem = totalEntregueCimaPorItem(todosItens);
    var totalAjustado = 0;
    var totalEntregue = 0;
    for (var i = 0; i < ctx.opItensRaw.length; i++) {
      var item = ctx.opItensRaw[i];
      var ajustado = item.metros_ajustados == null ? Number(item.metros_pedidos) : Number(item.metros_ajustados);
      totalAjustado += ajustado;
      totalEntregue += (totalPorItem[item.id] || 0);
    }
    totalAjustado = Math.round(totalAjustado * 100) / 100;
    totalEntregue = Math.round(totalEntregue * 100) / 100;
    var saldo = Math.round((totalAjustado - totalEntregue) * 100) / 100;
    var pct = totalAjustado > 0 ? Math.round((totalEntregue / totalAjustado) * 1000) / 10 : 0;
    var pctClamped = Math.max(0, Math.min(100, pct));
    var excedente = saldo < 0;
    return { totalPorItem: totalPorItem, totalAjustado: totalAjustado, totalEntregue: totalEntregue, saldo: saldo, pct: pct, pctClamped: pctClamped, excedente: excedente };
  }

  function buildBreadcrumbProducao(ctx) {
    return el('div', { style: 'display:flex;align-items:center;justify-content:space-between;' },
      el('div', { style: 'font-size:13.5px;color:#9aa2af;' },
        'OPs ', el('span', { style: 'margin:0 6px;color:#d0d5dc;' }, '/'),
        el('span', { style: 'color:#5b6472;font-weight:600;' }, 'OP ' + ctx.numero + '/' + ctx.ano)),
      el('button', { type: 'button', style: BTN_BACK, onclick: function () { window.navigate('#/ops'); } }, svgEl(SVG_BACK), 'Voltar'));
  }

  function buildLineageStripProducao(ctx) {
    var destino = null;
    for (var i = 0; i < ctx.entregasCima.length; i++) {
      var ent = ctx.entregasCima[i];
      if (ctx.latexOpInfo[ent.id]) {
        destino = ctx.latexOpInfo[ent.id];
        break;
      }
    }
    if (!destino) return null;
    var destinoStatus = destino.status === 'aberta'
      ? 'Aguardando entrada'
      : (destino.status === 'em_producao' ? 'Em producao' : '');
    var nodes = [];
    nodes.push(el('span', { style: 'font-size:12.5px;color:#2c4a78;' }, 'Cadeia produtiva:'));
    if (hasLinkedPedido(ctx)) {
      nodes.push(el('button', {
        type: 'button',
        style: 'font-size:12.5px;font-weight:700;color:#2563eb;background:#fff;border:none;border-radius:4px;padding:3px 9px;cursor:pointer;font-family:inherit;',
        onclick: function () { window.navigate('#/pedidos/' + ctx.pedidoCtx.id); },
      }, 'Pedido ' + ctx.pedidoCtx.numero));
      nodes.push(svgEl('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'));
    }
    nodes.push(el('span', { style: 'font-size:12.5px;font-weight:700;color:#16203a;background:#fff;border-radius:4px;padding:3px 9px;' }, 'OP ' + ctx.numero + '/' + ctx.ano + ' · Tecelagem (esta OP)'));
    nodes.push(el('button', {
      type: 'button',
      style: 'font-size:12.5px;font-weight:700;color:#2563eb;background:#fff;border:none;border-radius:4px;padding:3px 9px;cursor:pointer;font-family:inherit;',
      onclick: function () { window.navigate('#/ops/' + destino.id); },
    }, 'OP ' + destino.numero + '/' + destino.ano + ' · Acabamento'
      + (destinoStatus ? ' · ' + destinoStatus : '')
      + ' (consolidada desta OP de tecelagem)'));
    return el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#eaf1fd;border:1px solid #d7e6fb;border-radius:4px;padding:10px 16px;' }, nodes);
  }

  function buildHeaderProducao(ctx) {
    var totais = computeTotaisProducao(ctx);
    var podeConcluir = totais.totalAjustado > 0 && totais.saldo <= 0;
    var badgeTecelagem = el('span', { style: BADGE_TECELAGEM }, 'Tecelagem');
    var badgeEmProducao = el('span', { style: BADGE_EM_PRODUCAO },
      el('span', { style: 'width:6px;height:6px;border-radius:50%;background:#e07b39;' }), 'Em produção');

    var titleRow = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' },
      el('h1', { style: 'margin:0;font-size:24px;font-weight:800;color:#16203a;letter-spacing:-.01em;' }, 'OP ' + ctx.numero + '/' + ctx.ano),
      badgeTecelagem, badgeEmProducao);

    var metaParts = [];
    if (hasLinkedPedido(ctx)) metaParts.push('Pedido Nº ' + ctx.pedidoCtx.numero);
    metaParts.push(resolveClienteNome(ctx));
    if (ctx.op.lote) metaParts.push('Lote Nº ' + ctx.op.lote.numero);
    if (ctx.op.criado_em) metaParts.push('Aberta em ' + fmtDateLabel(ctx.op.criado_em));
    var metaLine = el('div', { style: 'font-size:13px;color:#8a93a3;margin-top:6px;' }, metaParts.join(' · '));

    var acoes = [];
    if (hasLinkedPedido(ctx)) {
      acoes.push(el('button', {
        type: 'button', style: BTN_BACK, onclick: function () { window.navigate('#/pedidos/' + ctx.pedidoCtx.id); },
      }, svgEl(SVG_OPEN), 'Abrir Pedido'));
    }
    acoes.push(el('button', { type: 'button', style: BTN_BACK + 'opacity:.55;cursor:not-allowed;', disabled: true }, 'Pausar'));
    if (ctx.cimaFornecedorId) acoes.push(el('a', { href: '#entregas-tecelagem-op', style: BTN_BACK + 'text-decoration:none;' }, 'Ir para entregas'));
    var concluirAttrs = {
      type: 'button',
      style: podeConcluir ? BTN_BACK : BTN_BACK + 'opacity:.55;cursor:not-allowed;',
      title: podeConcluir ? 'Registrar conclusao explicita da Tecelagem' : 'Concluir fica disponivel quando nao houver saldo pendente.',
      onclick: function (event) { if (podeConcluir) finalizarTecelagem(ctx, totais, event && event.currentTarget); },
    };
    if (!podeConcluir) concluirAttrs.disabled = 'disabled';
    acoes.push(el('button', concluirAttrs, 'Concluir'));
    acoes.push(el('a', { href: '#documentos-op', style: BTN_BACK + 'text-decoration:none;' }, 'Documentos'));
    acoes.push(el('a', { href: '#historico-op', style: BTN_BACK + 'text-decoration:none;' }, 'Histórico'));

    return el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;' },
      el('div', {}, titleRow, metaLine),
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' }, acoes));
  }

  async function finalizarTecelagem(ctx, totais, btn) {
    if (!ctx || !ctx.op || !ctx.op.id) {
      toast('OP de tecelagem indisponivel para conclusao.', 'error');
      return false;
    }
    if (!totais || !(totais.totalAjustado > 0) || totais.saldo > 0) {
      toast('Tecelagem ainda possui saldo pendente.', 'error');
      return false;
    }
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      toast('RPC de status indisponivel.', 'error');
      return false;
    }
    if (btn) btn.disabled = true;
    try {
      var result = await window.supa.rpc('alterar_status_op', {
        p_op_id: ctx.op.id,
        p_novo_status: 'concluida',
        p_observacao: 'Tecelagem concluida explicitamente sem saldo produtivo pendente.',
      });
      if (result.error) {
        console.error(result.error);
        toast(result.error.message || 'Erro ao concluir tecelagem.', 'error');
        return false;
      }
      if (result.data && result.data.ok === false) {
        console.error(result.data);
        toast(result.data.erro || 'Conclusao rejeitada pela regra operacional.', 'error');
        return false;
      }
      toast('Tecelagem concluida', 'success');
      window.navigate('#/ops/' + ctx.op.id);
      return true;
    } catch (err) {
      console.error(err);
      toast((err && err.message) || 'Erro ao concluir tecelagem.', 'error');
      return false;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function campoProducao(label, valor) {
    return el('div', {},
      el('label', { style: 'display:block;font-size:12px;color:#9aa2af;margin-bottom:6px;' }, label),
      el('div', { style: 'font-size:13.5px;color:#16203a;font-weight:600;' }, valor));
  }

  function buildCardDadosProducao(ctx) {
    var fornecedorNome = (ctx.forns.find(function (f) { return f.id === ctx.fornSel.cima; }) || {}).nome || '—';
    var itemVinculadoLabel = ctx.itens.length
      ? ctx.itens.length + ' ' + (ctx.itens.length === 1 ? 'item' : 'itens') + ' (ver abaixo)'
      : '—';

    var campos = [
      campoProducao('Cliente', resolveClienteNome(ctx)),
      campoProducao('Lote', ctx.op.lote ? 'Lote Nº ' + ctx.op.lote.numero : '—'),
      campoProducao('Etapa', 'Tecelagem'),
      campoProducao('Fornecedor de tecelagem', fornecedorNome),
    ];
    if (hasLinkedPedido(ctx)) campos.push(campoProducao('Pedido vinculado', 'Pedido Nº ' + ctx.pedidoCtx.numero));
    campos.push(campoProducao('Item do pedido vinculado', itemVinculadoLabel));

    return el('div', { style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:14px;' }, '1. Dados da OP'),
      el('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;' }, campos));
  }

  function buildResumoLateralProducao(totais) {
    function linha(label, valor, cor) {
      return el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;' },
        el('span', {}, label), el('span', { style: 'color:' + (cor || '#16203a') + ';font-weight:700;' }, valor));
    }
    var pctLabel = String(totais.pct).replace('.', ',');
    var saldoCor = totais.excedente ? '#d6403a' : '#2563eb';
    var barCor = totalsBarColor(totais);
    var pctTexto = totais.excedente
      ? pctLabel + '% entregue — acima do total ajustado desta OP (excedente).'
      : pctLabel + '% já entregue para a próxima etapa';
    return el('div', { style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:12px;' }, 'Resumo desta OP'),
      el('div', { style: 'display:flex;flex-direction:column;gap:9px;' },
        linha('Total ajustado da OP', window.fmtMetros(totais.totalAjustado)),
        linha('Entregue p/ acabamento', window.fmtMetros(totais.totalEntregue)),
        linha('Saldo em tecelagem', window.fmtMetros(totais.saldo) + (totais.excedente ? ' (excedente)' : ''), saldoCor)),
      el('div', { style: 'height:6px;border-radius:99px;background:#e2e5ea;overflow:hidden;margin:12px 0 6px;' },
        el('div', { style: 'width:' + totais.pctClamped + '%;height:100%;background:' + barCor + ';' })),
      el('div', { style: 'font-size:11.5px;color:#9aa2af;' }, pctTexto));
  }

  function totalsBarColor(totais) {
    return totais.pct > 100 ? '#d6403a' : '#2563eb';
  }

  function buildCardItensProducao(ctx, totalPorItem) {
    var card = el('div', { style: CARD + 'padding:16px 0 0;overflow:hidden;' },
      el('div', { style: 'padding:0 20px 12px;font-size:15.5px;font-weight:700;color:#16203a;' }, '2. Itens da OP'));
    card.appendChild(thRow('1.3fr .8fr .8fr .8fr .8fr 1.3fr', ['MODELO / CORES', 'PEDIDO', 'AJUSTADO', 'ENTREGUE', 'FALTA', 'ITEM DO PEDIDO']));
    for (var idx = 0; idx < ctx.opItensRaw.length; idx++) {
      var item = ctx.opItensRaw[idx];
      var ajustado = item.metros_ajustados == null ? Number(item.metros_pedidos) : Number(item.metros_ajustados);
      var entregue = totalPorItem[item.id] || 0;
      var falta = Math.round((ajustado - entregue) * 100) / 100;
      var itemPedidoLabel = (hasLinkedPedido(ctx) && item.pedido_item_id) ? 'Pedido Nº ' + ctx.pedidoCtx.numero : '—';
      var faltaCor;
      var faltaTxt;
      if (falta > 0) { faltaCor = '#d6403a'; faltaTxt = window.fmtMetros(falta); }
      else if (falta === 0) { faltaCor = '#18794a'; faltaTxt = '✅ completo'; }
      else { faltaCor = '#c2610c'; faltaTxt = 'excedente ' + window.fmtMetros(-falta); }
      card.appendChild(gridRow('1.3fr .8fr .8fr .8fr .8fr 1.3fr', [
        el('div', { style: 'font-size:13.5px;font-weight:700;color:#16203a;' }, window.rotuloModelo(ctx.modelosById[item.modelo_id])),
        el('div', { style: 'font-size:13.5px;color:#3f4757;font-weight:600;' }, window.fmtMetros(item.metros_pedidos)),
        el('div', { style: 'font-size:13.5px;color:#3f4757;font-weight:600;' }, window.fmtMetros(ajustado)),
        el('div', { style: 'font-size:13.5px;font-weight:700;color:' + (entregue > 0 ? '#18794a' : '#b6bdc8') + ';' }, window.fmtMetros(entregue)),
        el('div', { style: 'font-size:13.5px;font-weight:700;color:' + faltaCor + ';' }, faltaTxt),
        el('div', { style: 'font-size:12.5px;color:#2563eb;font-weight:600;' }, itemPedidoLabel),
      ]));
    }
    return card;
  }

  function buildBlocoCapacidadeAjuste(ctx, totais) {
    var box = el('div', { id: 'capacidade-ajuste-op', style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;' },
        el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;' }, '4. Capacidade e ajuste'),
        el('span', { style: 'background:#eaf1fd;color:#2563eb;border-radius:4px;padding:4px 10px;font-size:11.5px;font-weight:700;' }, 'Ajustado')));

    box.appendChild(el('div', { style: 'font-size:13px;color:#5b6472;margin-bottom:12px;line-height:1.5;' },
      'Capacidade liberada para produção nesta OP: ',
      el('strong', { style: 'color:#16203a;' }, window.fmtMetros(totais.totalAjustado)),
      ', distribuída entre os itens acima conforme o fio efetivamente recebido.'));

    if (!ctx.saldoFiosOp.length) {
      box.appendChild(el('div', { style: 'font-size:13px;color:#aab2bf;' }, 'Sem dados de sobra de fio registrados para esta OP.'));
      return box;
    }

    var linhas = el('div', { style: 'display:flex;flex-wrap:wrap;gap:16px;padding:12px 14px;background:#f8f9fb;border-radius:4px;' });
    for (var i = 0; i < ctx.saldoFiosOp.length; i++) {
      var row = ctx.saldoFiosOp[i];
      var ordemRef = ctx.ordens.find(function (o) {
        return o.tipo === row.tipo && (row.tipo === 'poliester' ? o.cor_poliester === row.cor_poliester : o.cor_id === row.cor_id);
      });
      var kgRecebido = ordemRef ? Number(ordemRef.kg_recebido) : null;
      var kgSobra = Number(row.kg_sobra);
      var label = window.rotuloFio(row);
      var consumoTxt = kgRecebido != null
        ? window.fmtKg(Math.round((kgRecebido - kgSobra) * 1000) / 1000) + ' / ' + window.fmtKg(kgRecebido)
        : window.fmtKg(kgSobra);
      linhas.appendChild(el('div', { style: 'font-size:12.5px;color:#3f4757;' },
        label + ': ', el('strong', {}, consumoTxt),
        kgRecebido != null ? el('span', { style: 'color:#18794a;' }, ' (sobra ' + window.fmtKg(kgSobra) + ')') : ''));
    }
    box.appendChild(linhas);
    return box;
  }

  function buildBlocoTecelagem(ctx, options) {
    var embedded = options && options.embedded;
    var box = el('div', { style: embedded ? 'border-top:1px solid #f1f3f6;margin-top:4px;padding-top:16px;' : CARD + 'padding:0;' });
    box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;' + (embedded ? 'padding:0 0 12px;' : 'padding:20px 24px 16px;') },
      el('span', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, 'Entregas tecelagem')));

    var todosItens = ctx.entregasCima.flatMap(function (e) {
      return (e.entrega_itens || []).filter(function (ei) { return ei.op_id === ctx.op.id; });
    });
    var totalPorItem = totalEntregueCimaPorItem(todosItens);

    var tabela = el('div', { style: 'overflow-x:auto;' });
    var tabelaInner = el('div', { style: 'min-width:600px;' });
    tabelaInner.appendChild(thRow('1fr 120px 120px 120px 120px', ['MODELO', 'PEDIDO', 'AJUSTADO', 'ENTREGUE', 'FALTA']));
    for (var i = 0; i < ctx.opItensRaw.length; i++) {
      var item = ctx.opItensRaw[i];
      var ajustado = item.metros_ajustados == null ? Number(item.metros_pedidos) : Number(item.metros_ajustados);
      var falta = Math.round((ajustado - (totalPorItem[item.id] || 0)) * 100) / 100;
      var faltaCor;
      var faltaTxt;
      if (falta > 0) { faltaCor = '#d6403a'; faltaTxt = window.fmtMetros(falta); }
      else if (falta === 0) { faltaCor = '#18794a'; faltaTxt = '✅ completo'; }
      else { faltaCor = '#c2610c'; faltaTxt = 'excedente ' + window.fmtMetros(-falta); }
      tabelaInner.appendChild(gridRow('1fr 120px 120px 120px 120px', [
        el('div', { style: 'font-size:13.5px;font-weight:500;color:#16203a;' }, window.rotuloModelo(ctx.modelosById[item.modelo_id])),
        el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtMetros(item.metros_pedidos)),
        el('div', { style: 'font-size:13.5px;color:#3f4757;' }, item.metros_ajustados == null ? window.fmtMetros(item.metros_pedidos) : window.fmtMetros(item.metros_ajustados)),
        el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtMetros(totalPorItem[item.id] || 0)),
        el('span', { style: 'font-size:13.5px;font-weight:600;color:' + faltaCor + ';' }, faltaTxt),
      ]));
    }
    tabela.appendChild(tabelaInner);
    box.appendChild(tabela);

    var formHolder = el('div', { style: embedded ? 'padding:0;' : 'padding:0 24px;' });
    var btnNova = el('button', {
      type: 'button', style: BTN_LINK + (embedded ? 'margin:14px 0 0;' : 'margin:14px 24px 0;'),
      onclick: function () {
        var form = window.buildEntregaInlineForm({ opItens: ctx.opItensRaw, modelosById: ctx.modelosById, latexOptions: ctx.latexOptions, comOpcaoSplit: true });
        var btnSalvar = el('button', {
          type: 'button', style: BTN_SOLID_SM + 'margin-right:8px;',
          onclick: async function () {
            btnSalvar.disabled = true;
            var splitOpt = form.getSplitOption();
            var ok = await window.salvarEntregaCima({ fornecedorId: ctx.cimaFornecedorId, opId: ctx.op.id, payload: form.getPayload() }, splitOpt.forceSplit ? { forceSplit: true, motivo: splitOpt.motivo } : undefined);
            btnSalvar.disabled = false;
            if (ok) ctx.reloadEntregasCima();
          },
        }, 'Salvar entrega');
        var btnCancelar = el('button', {
          type: 'button', style: 'background:#fff;color:#3f4757;border:1px solid #d8dce2;border-radius:4px;padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;',
          onclick: function () { formHolder.replaceChildren(); btnNova.style.display = ''; },
        }, 'Cancelar');
        formHolder.replaceChildren(el('div', { style: 'padding:12px 0;' }, form.node, el('div', { style: 'margin-top:10px;' }, btnSalvar, btnCancelar)));
        btnNova.style.display = 'none';
      },
    }, '+ Nova entrega');
    box.appendChild(btnNova);
    box.appendChild(formHolder);

    box.appendChild(el('div', { style: embedded ? 'padding:16px 0 0;' : 'padding:16px 24px 20px;' },
      el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;margin-bottom:8px;' }, 'Histórico'),
      ctx.entregasCima.length === 0
        ? el('div', { style: 'font-size:13px;color:#aab2bf;' }, 'Nenhuma entrega registrada ainda.')
        : el('div', {}, ctx.entregasCima.map(function (ent) { return buildEntregaHistorico(ctx, ent); }))));
    return box;
  }

  function buildEntregaHistorico(ctx, ent) {
    var subcard = el('div', { style: 'border-bottom:1px solid #f1f3f6;padding:14px 0;' });
    var itensRow = (ent.entrega_itens || []).filter(function (x) { return x.op_id === ctx.op.id; }).map(function (ei) {
      var item = ctx.opItensRaw.find(function (i) { return i.id === ei.op_item_id; });
      var nome = item ? window.rotuloModelo(ctx.modelosById[item.modelo_id]) : '?';
      return el('div', { style: 'font-size:13.5px;color:#3f4757;margin-top:3px;' },
        nome + ': ' + window.fmtMetros(ei.metros_entregues),
        ei.defeito ? el('span', { style: 'margin-left:8px;color:#d6403a;font-weight:600;font-size:12.5px;' }, '⚠ DEFEITO') : '',
        ei.observacao ? el('span', { style: 'margin-left:8px;font-size:12px;color:#8a93a3;' }, '(' + ei.observacao + ')') : '');
    });
    // D-B: se a entrega cima já gerou OP de acabamento (latexOpPorEntrega),
    // ela vira documento de origem — edição/exclusão livres ficam
    // bloqueadas pelo app. Mantém histórico e o CTA "Ver OP de látex".
    var vinculadaLatex = !!ctx.latexOpPorEntrega[ent.id];
    var acoes = el('div', { style: 'display:flex;align-items:center;gap:14px;' });
    if (!vinculadaLatex) {
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK, onclick: function () { abrirEdicaoAdmin(ctx, ent); } }, 'Editar'));
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK + 'color:#d6403a;', onclick: function () { window.excluirEntrega(ent.id, ctx.reloadEntregasCima); } }, 'Excluir'));
    }
    if (vinculadaLatex) {
      acoes.appendChild(el('span', { style: 'font-size:12px;font-weight:700;color:#c2610c;' }, 'Entrega vinculada à OP de acabamento'));
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK + 'color:#c2610c;', onclick: function () { window.navigate('#/ops/' + ctx.latexOpPorEntrega[ent.id]); } }, 'Ver OP de látex'));
    }
    subcard.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;' },
      el('div', { style: 'font-size:14px;font-weight:600;color:#16203a;' },
        new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        ' · ' + (ent.fornecedores?.nome || '?'),
        ent.destino?.nome ? ' → látex: ' + ent.destino.nome : ''),
      acoes));
    if (ent.observacao) subcard.appendChild(el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:2px;' }, ent.observacao));
    itensRow.forEach(function (n) { subcard.appendChild(n); });
    return subcard;
  }

  function abrirEdicaoAdmin(ctx, entrega) {
    var form = window.buildEntregaInlineForm({ opItens: ctx.opItensRaw, modelosById: ctx.modelosById, entrega: entrega, latexOptions: ctx.latexOptions });
    window.modal({
      title: 'Editar entrega — ' + new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR'),
      body: form.node,
      saveLabel: 'Salvar alterações',
      onSave: async function () {
        var ok = await window.atualizarEntregaCima({ entregaId: entrega.id, opId: ctx.op.id, payload: form.getPayload() });
        if (ok) ctx.reloadEntregasCima();
        return ok;
      },
    });
  }

  function buildBlocoMovimentacao(ctx, totais) {
    var disponivelCor = totais.excedente ? '#d6403a' : '#2563eb';

    return el('div', { id: 'entregas-tecelagem-op', style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;' },
        el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;' }, '5. Movimentação — enviar para acabamento'),
        el('a', { href: '#entregas-tecelagem-op', style: BTN_SOLID_SM + 'text-decoration:none;' }, 'Transferir')),
      el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin-bottom:14px;' },
        el('div', {}, el('div', { style: 'font-size:11.5px;color:#9aa2af;margin-bottom:4px;' }, 'Disponível'), el('div', { style: 'font-size:16px;font-weight:800;color:' + disponivelCor + ';' }, window.fmtMetros(totais.saldo) + (totais.excedente ? ' (excedente)' : ''))),
        el('div', {}, el('div', { style: 'font-size:11.5px;color:#9aa2af;margin-bottom:4px;' }, 'Já enviado'), el('div', { style: 'font-size:16px;font-weight:800;color:#18794a;' }, window.fmtMetros(totais.totalEntregue))),
        el('div', {}, el('div', { style: 'font-size:11.5px;color:#9aa2af;margin-bottom:4px;' }, 'Total ajustado da OP'), el('div', { style: 'font-size:16px;font-weight:800;color:#16203a;' }, window.fmtMetros(totais.totalAjustado)))),
      buildBlocoTecelagem(ctx, { embedded: true }));
  }

  function buildBlocoDocumentos() {
    function linhaDoc(nome, isLast) {
      return el('div', { style: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;' + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;') },
        el('span', { style: 'font-size:13px;color:#3f4757;' }, nome),
        el('span', { style: 'background:#f1f3f6;color:#8a93a3;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;' }, 'Aguardando integração'));
    }
    return el('div', { id: 'documentos-op', style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:12px;' }, '6. Documentos da OP'),
      linhaDoc('Romaneio', false),
      linhaDoc('Nota fiscal de entrada', false),
      linhaDoc('Nota fiscal de saída', true),
      el('div', { style: 'font-size:12px;color:#8a93a3;margin-top:12px;' }, 'Documentos da OP serão integrados em fase própria.'));
  }

  function buildBlocoHistorico(ctx) {
    var box = el('div', { id: 'historico-op', style: CARD + 'padding:16px 20px;' },
      el('div', { style: 'font-size:15.5px;font-weight:700;color:#16203a;margin-bottom:14px;' }, '7. Histórico'));
    if (!ctx.opEventos.length) {
      box.appendChild(el('div', { style: 'font-size:13px;color:#aab2bf;' }, 'Nenhum evento registrado para esta OP.'));
      return box;
    }
    ctx.opEventos.forEach(function (ev, idx) {
      var linhaTxt = ev.tipo_evento === 'status_alterado'
        ? 'Status alterado: ' + humanizeLabel(ev.status_anterior) + ' → ' + humanizeLabel(ev.status_novo)
        : humanizeLabel(ev.tipo_evento);
      var isLast = idx === ctx.opEventos.length - 1;
      var trilha = el('div', { style: 'display:flex;flex-direction:column;align-items:center;' },
        el('div', { style: 'width:11px;height:11px;border-radius:50%;background:' + (idx === 0 ? '#2563eb' : '#cfd5de') + ';margin-top:4px;flex-shrink:0;' }),
        isLast ? '' : el('div', { style: 'width:2px;flex:1;background:#eceef1;' }));
      var conteudo = el('div', { style: 'padding-bottom:' + (isLast ? '0' : '16px') + ';' },
        el('div', { style: 'font-size:12px;color:#9aa2af;' }, fmtDateLabel(ev.criado_em)),
        el('div', { style: 'font-size:14px;font-weight:700;color:#16203a;margin-top:2px;' }, linhaTxt),
        ev.observacao ? el('div', { style: 'font-size:13px;color:#7b8494;margin-top:1px;' }, ev.observacao) : '');
      box.appendChild(el('div', { style: 'display:flex;gap:14px;' }, trilha, conteudo));
    });
    return box;
  }

  function renderOPTecelagemProducaoAdmin(ctx) {
    var totais = computeTotaisProducao(ctx);
    var wrap = el('div', { style: 'display:flex;flex-direction:column;gap:14px;' });
    wrap.appendChild(buildBreadcrumbProducao(ctx));
    var lineage = buildLineageStripProducao(ctx);
    if (lineage) wrap.appendChild(lineage);
    wrap.appendChild(buildHeaderProducao(ctx));
    wrap.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start;' },
      buildCardDadosProducao(ctx), buildResumoLateralProducao(totais)));
    wrap.appendChild(buildCardItensProducao(ctx, totais.totalPorItem));
    wrap.appendChild(ctx.buildBlocoFios());
    wrap.appendChild(buildBlocoCapacidadeAjuste(ctx, totais));
    if (ctx.cimaFornecedorId) {
      wrap.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start;' },
        buildBlocoMovimentacao(ctx, totais), buildBlocoDocumentos()));
    } else {
      wrap.appendChild(buildBlocoDocumentos());
    }
    wrap.appendChild(buildBlocoHistorico(ctx));
    return wrap;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opTecelagemProducaoAdmin = {
    renderOPTecelagemProducaoAdmin: renderOPTecelagemProducaoAdmin,
  };
  window.renderOPTecelagemProducaoAdmin = renderOPTecelagemProducaoAdmin;
})(window);
