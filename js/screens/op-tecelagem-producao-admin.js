// =====================================================================
// === SCREENS: OP TECELAGEM EM PRODUCAO (ADMIN) ========================
// Template operacional da OP de Tecelagem quando status === 'em_producao'.
//
// Fase RAVATEX-TAPETES-DESIGN-TOKENS-TARGET-PILOT (piloto visual): mesma
// linguagem Inttex ja validada na OP Acabamento/Latex — icon-chips nos
// headers de secao (sem barras/numeros), cockpit de 2 colunas com rail
// sticky, badges de etapa (roxo) distintas do status (ambar), bordas de
// card via tokens --rv-*, Documentos como slots por tipo com Anexar
// (camada visual; upload/Google Drive entra depois). Os itens PROPRIOS da
// tecelagem sao preservados integralmente: insumos/recebimento de fios,
// capacidade e ajuste, entregas de tecelagem (+ Nova entrega), enviar para
// acabamento e finalizar. Nenhuma RPC/handler/regra foi alterada.
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

  // ---- Icon-chips de header de secao (chip 22px + rotulo UPPERCASE) ----
  var CHIP_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--rv-radius-control);background:var(--rv-color-chip-bg);border:1px solid var(--rv-color-line-200);color:var(--rv-color-chip-glyph);flex-shrink:0;';
  var SECTION_LABEL_STYLE = 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-section-label);letter-spacing:var(--rv-tracking-label);text-transform:uppercase;';
  function chipSvg(inner) {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var IC_DADOS  = chipSvg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect>');
  var IC_ITENS  = chipSvg('<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>');
  var IC_FIOS   = chipSvg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>');
  var IC_GAUGE  = chipSvg('<path d="M12 2a10 10 0 1 0 10 10"></path><path d="M12 12l6-3"></path><path d="M12 2v4"></path>');
  var IC_TRUCK  = chipSvg('<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>');
  var IC_RESUMO = chipSvg('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>');
  var IC_MOV    = chipSvg('<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>');
  var IC_DOC    = chipSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>');
  var IC_HIST   = chipSvg('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>');

  function chipLabel(label, iconMarkup) {
    return el('div', { style: 'display:flex;align-items:center;gap:9px;' },
      el('span', { style: CHIP_STYLE }, svgEl(iconMarkup || IC_DADOS)),
      el('span', { style: SECTION_LABEL_STYLE }, label));
  }
  function rvSectionPill(label, iconMarkup) {
    var node = chipLabel(label, iconMarkup);
    node.setAttribute('style', 'display:flex;align-items:center;gap:9px;margin-bottom:14px;');
    return node;
  }

  // ---- Cartoes / tokens ----
  var CARD = 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-card);';
  var TH_STYLE = 'font-size:10.5px;font-weight:700;color:var(--rv-color-muted);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;';

  // ---- Botoes ----
  var BTN_HDR_SUCCESS = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:600;color:#15803d;border:1px solid #bfe6cd;background:#f2fbf5;cursor:pointer;font-family:inherit;white-space:nowrap;';
  var BTN_HDR_SUCCESS_OFF = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:600;color:#9aa2af;border:1px solid var(--rv-color-line-200);background:#fff;cursor:not-allowed;font-family:inherit;white-space:nowrap;';
  var BTN_HDR_DANGER = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:500;color:var(--rv-color-danger);border:1px solid #f0d2d2;background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:38px;background:var(--rv-color-accent);color:#fff;border:none;border-radius:var(--rv-radius-control);padding:0 16px;font-weight:600;font-size:13.5px;font-family:inherit;white-space:nowrap;cursor:pointer;';
  var BTN_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--rv-color-accent);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var BTN_SOLID_SM = 'display:inline-flex;align-items:center;background:var(--rv-color-accent);color:#fff;border:none;border-radius:var(--rv-radius-control);padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var SVG_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  var SVG_FLAG_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  var SVG_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

  // ---- Badges: etapa (roxo) x status (ambar), pilulas ----
  var PILL_BASE = 'display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:var(--rv-radius-pill);white-space:nowrap;';
  function rvStageBadge() {
    return el('span', { style: PILL_BASE + 'background:var(--rv-stage-tecelagem-bg);color:var(--rv-stage-tecelagem);' }, 'Tecelagem');
  }
  function rvDot(color) {
    return el('span', { style: 'width:6px;height:6px;border-radius:50%;background:' + color + ';' });
  }
  function rvStatusBadge() {
    return el('span', { style: PILL_BASE + 'background:var(--rv-status-prod-bg);color:var(--rv-status-prod);' }, rvDot('var(--rv-status-prod-dot)'), 'Em produção');
  }

  function thRow(colsTemplate, labels) {
    var cells = labels.map(function (l, i) {
      return el('div', { style: TH_STYLE + (i > 0 ? 'text-align:right;' : '') }, l);
    });
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:9px 17px;background:var(--rv-color-bg-header);border-top:1px solid var(--rv-color-line-200);border-bottom:1px solid var(--rv-color-line-200);' }, cells);
  }

  function gridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:11px 17px;border-bottom:1px solid var(--rv-color-line-100);align-items:center;' }, cells);
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

  function formatOpDisplay(op, ctx) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(op, (ctx && ctx.opDisplayContext) || {});
    }
    var numero = op && op.numero != null ? op.numero : (ctx && ctx.numero != null ? ctx.numero : '—');
    var ano = op && op.ano != null ? op.ano : (ctx && ctx.ano != null ? ctx.ano : '—');
    return 'OP ' + numero + '/' + ano;
  }

  function internalOpLabel(op) {
    var api = window.RAVATEX_OP_DISPLAY;
    var legacy = api && typeof api.formatOpLegacyCode === 'function'
      ? api.formatOpLegacyCode(op)
      : formatOpDisplay(op, null);
    return legacy.replace(/^OP /, 'Nº interno ');
  }

  function resolveClienteNome(ctx) {
    if (ctx.pedidoCtx && ctx.pedidoCtx.clienteNome) return ctx.pedidoCtx.clienteNome;
    if (ctx.op && ctx.op.lote && ctx.op.lote.cliente && ctx.op.lote.cliente.nome) return ctx.op.lote.cliente.nome;
    return '—';
  }

  // Destino consolidado (OP de Acabamento gerada a partir de uma entrega desta OP).
  function resolveDestino(ctx) {
    for (var i = 0; i < ctx.entregasCima.length; i++) {
      var ent = ctx.entregasCima[i];
      if (ctx.latexOpInfo[ent.id]) return ctx.latexOpInfo[ent.id];
    }
    return null;
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

  function totalsBarColor(totais) {
    return totais.pct > 100 ? 'var(--rv-color-danger)' : 'var(--rv-color-accent)';
  }

  // ---------------------------------------------------------------------
  // Cabecalho de pagina
  // ---------------------------------------------------------------------

  function buildBreadcrumb(ctx) {
    return el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:#9aa2af;font-weight:500;margin-bottom:8px;' },
      el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:#9aa2af;cursor:pointer;', onclick: function () { window.navigate('#/ops'); } }, 'OPs'),
      el('span', { style: 'color:#c8ced6;' }, '/'),
      el('span', { style: 'color:#5b6472;' }, formatOpDisplay(ctx.op, ctx)));
  }

  function buildHeader(ctx, totais) {
    var podeConcluir = totais.totalAjustado > 0 && totais.saldo <= 0;

    var titleRow = el('div', { style: 'display:flex;align-items:center;gap:11px;flex-wrap:wrap;' },
      el('h1', { style: 'margin:0;font-size:22px;font-weight:800;color:var(--rv-color-title);letter-spacing:-.02em;' }, formatOpDisplay(ctx.op, ctx)),
      rvStageBadge(), rvStatusBadge());

    var metaParts = [internalOpLabel(ctx.op)];
    if (hasLinkedPedido(ctx)) metaParts.push('Pedido Nº ' + ctx.pedidoCtx.numero);
    metaParts.push(resolveClienteNome(ctx));
    if (ctx.op.lote) metaParts.push('Lote Nº ' + ctx.op.lote.numero);
    if (ctx.op.criado_em) metaParts.push('Aberta em ' + fmtDateLabel(ctx.op.criado_em));
    var metaLine = el('div', { style: 'font-size:12.5px;color:var(--rv-color-muted);margin-top:7px;line-height:1.5;' }, metaParts.join(' · '));

    var acoes = [];
    var finalizarAttrs = {
      type: 'button',
      style: podeConcluir ? BTN_HDR_SUCCESS : BTN_HDR_SUCCESS_OFF,
      title: podeConcluir ? 'Finalizar formalmente a OP Tecelagem pela RPC canonica.' : 'Finalizar fica disponivel quando nao houver saldo pendente.',
      onclick: function (event) { if (podeConcluir) finalizarTecelagem(ctx, totais, event && event.currentTarget); },
    };
    if (!podeConcluir) finalizarAttrs.disabled = 'disabled';
    acoes.push(el('button', finalizarAttrs, svgEl(SVG_FLAG_CHECK), 'Finalizar OP'));
    if (typeof ctx.excluirOP === 'function') {
      acoes.push(el('button', { type: 'button', style: BTN_HDR_DANGER, onclick: ctx.excluirOP }, svgEl(SVG_TRASH), 'Excluir'));
    }

    return el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px;' },
      el('div', { style: 'min-width:0;' }, titleRow, metaLine),
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;' }, acoes));
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

  // ---------------------------------------------------------------------
  // Coluna esquerda
  // ---------------------------------------------------------------------

  function campo(label, node) {
    return el('div', {},
      el('label', { style: 'display:block;font-size:11.5px;color:#9aa2af;margin-bottom:2px;' }, label),
      node);
  }
  function valor(text, color, weight) {
    return el('div', { style: 'font-size:13.5px;color:' + (color || 'var(--rv-color-value)') + ';font-weight:' + (weight || '600') + ';' }, text);
  }

  function buildCardDados(ctx) {
    var fornecedorNome = (ctx.forns.find(function (f) { return f.id === ctx.fornSel.cima; }) || {}).nome || '—';
    var itemVinculadoLabel = ctx.itens.length
      ? ctx.itens.length + ' ' + (ctx.itens.length === 1 ? 'item' : 'itens') + ' (ver abaixo)'
      : '—';
    var destino = resolveDestino(ctx);
    var destinoNode = destino
      ? el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-color-accent);font-weight:600;cursor:pointer;text-align:left;', onclick: function () { window.navigate('#/ops/' + destino.id); } }, formatOpDisplay(destino, ctx) + ' · Acabamento')
      : valor('Ainda não consolidada', '#8a93a3');
    var pedidoNode = hasLinkedPedido(ctx)
      ? el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-color-accent);font-weight:700;cursor:pointer;text-align:left;', onclick: function () { window.navigate('#/pedidos/' + ctx.pedidoCtx.id); } }, 'Pedido Nº ' + ctx.pedidoCtx.numero)
      : valor('—', '#8a93a3');

    return el('div', { style: CARD + 'padding:15px 17px;' },
      rvSectionPill('Dados da OP', IC_DADOS),
      el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px 18px;' },
        campo('Cliente', valor(resolveClienteNome(ctx))),
        campo('Lote', valor(ctx.op.lote ? 'Lote Nº ' + ctx.op.lote.numero : '—')),
        campo('Fornecedor de tecelagem', valor(fornecedorNome)),
        campo('Destino', destinoNode),
        campo('Pedido vinculado', pedidoNode),
        campo('Item do pedido vinculado', valor(itemVinculadoLabel))));
  }

  function buildCardItens(ctx, totalPorItem) {
    var cols = '1.4fr .8fr .8fr .8fr .8fr 1.2fr';
    var card = el('div', { style: CARD + 'overflow:hidden;' },
      el('div', { style: 'padding:15px 17px 12px;' }, rvSectionPill('Itens da OP', IC_ITENS)));
    var table = el('div', { style: 'overflow-x:auto;' });
    var inner = el('div', { style: 'min-width:640px;' });
    inner.appendChild(thRow(cols, ['MODELO / CORES', 'PEDIDO', 'AJUSTADO', 'ENTREGUE', 'FALTA', 'ITEM DO PEDIDO']));
    for (var idx = 0; idx < ctx.opItensRaw.length; idx++) {
      var item = ctx.opItensRaw[idx];
      var ajustado = item.metros_ajustados == null ? Number(item.metros_pedidos) : Number(item.metros_ajustados);
      var entregue = totalPorItem[item.id] || 0;
      var falta = Math.round((ajustado - entregue) * 100) / 100;
      var itemPedidoLabel = (hasLinkedPedido(ctx) && item.pedido_item_id) ? 'Pedido Nº ' + ctx.pedidoCtx.numero : '—';
      var faltaCor, faltaTxt;
      if (falta > 0) { faltaCor = 'var(--rv-color-danger)'; faltaTxt = window.fmtMetros(falta); }
      else if (falta === 0) { faltaCor = 'var(--rv-color-success)'; faltaTxt = 'completo'; }
      else { faltaCor = 'var(--rv-color-warning)'; faltaTxt = 'excedente ' + window.fmtMetros(-falta); }
      inner.appendChild(gridRow(cols, [
        el('div', { style: 'font-size:13px;font-weight:600;color:var(--rv-color-value);' }, window.rotuloModelo(ctx.modelosById[item.modelo_id])),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:#3a4453;' }, window.fmtMetros(item.metros_pedidos)),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:#3a4453;' }, window.fmtMetros(ajustado)),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;font-weight:700;color:' + (entregue > 0 ? 'var(--rv-color-success)' : '#a2aab6') + ';' }, window.fmtMetros(entregue)),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;font-weight:700;color:' + faltaCor + ';' }, faltaTxt),
        el('div', { style: 'font-size:12.5px;text-align:right;color:var(--rv-color-accent);font-weight:600;' }, itemPedidoLabel),
      ]));
    }
    table.appendChild(inner);
    card.appendChild(table);
    return card;
  }

  function buildBlocoCapacidade(ctx, totais) {
    var box = el('div', { id: 'capacidade-ajuste-op', style: CARD + 'padding:15px 17px;' });
    box.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;flex-wrap:wrap;' },
      chipLabel('Capacidade e ajuste', IC_GAUGE),
      el('span', { style: 'background:var(--rv-color-subtle-bg);color:var(--rv-color-accent);border-radius:var(--rv-radius-pill);padding:3px 10px;font-size:11px;font-weight:600;' }, 'Ajustado')));

    box.appendChild(el('div', { style: 'font-size:12.5px;color:#5b6472;margin-bottom:12px;line-height:1.5;' },
      'Capacidade liberada para produção nesta OP: ',
      el('strong', { style: 'color:var(--rv-color-title);' }, window.fmtMetros(totais.totalAjustado)),
      ', distribuída entre os itens acima conforme o fio efetivamente recebido.'));

    if (!ctx.saldoFiosOp.length) {
      box.appendChild(el('div', { style: 'font-size:12.5px;color:#a2aab6;' }, 'Sem dados de sobra de fio registrados para esta OP.'));
      return box;
    }

    var linhas = el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px;padding:12px 14px;background:var(--rv-color-bg-header);border:1px solid var(--rv-color-line-100);border-radius:var(--rv-radius-control);' });
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
        kgRecebido != null ? el('span', { style: 'color:var(--rv-color-success);' }, ' (sobra ' + window.fmtKg(kgSobra) + ')') : ''));
    }
    box.appendChild(linhas);
    return box;
  }

  // Entregas de tecelagem — tabela + Nova entrega (form) + histórico.
  function buildBlocoEntregas(ctx) {
    var box = el('div', { id: 'entregas-tecelagem-op', style: CARD + 'padding:15px 17px;' });
    box.appendChild(rvSectionPill('Entregas de tecelagem', IC_TRUCK));

    var todosItens = ctx.entregasCima.flatMap(function (e) {
      return (e.entrega_itens || []).filter(function (ei) { return ei.op_id === ctx.op.id; });
    });
    var totalPorItem = totalEntregueCimaPorItem(todosItens);

    var tabela = el('div', { style: 'overflow-x:auto;' });
    var tabelaInner = el('div', { style: 'min-width:560px;' });
    tabelaInner.appendChild(thRow('1fr 110px 110px 110px 110px', ['MODELO', 'PEDIDO', 'AJUSTADO', 'ENTREGUE', 'FALTA']));
    for (var i = 0; i < ctx.opItensRaw.length; i++) {
      var item = ctx.opItensRaw[i];
      var ajustado = item.metros_ajustados == null ? Number(item.metros_pedidos) : Number(item.metros_ajustados);
      var falta = Math.round((ajustado - (totalPorItem[item.id] || 0)) * 100) / 100;
      var faltaCor, faltaTxt;
      if (falta > 0) { faltaCor = 'var(--rv-color-danger)'; faltaTxt = window.fmtMetros(falta); }
      else if (falta === 0) { faltaCor = 'var(--rv-color-success)'; faltaTxt = 'completo'; }
      else { faltaCor = 'var(--rv-color-warning)'; faltaTxt = 'excedente ' + window.fmtMetros(-falta); }
      tabelaInner.appendChild(gridRow('1fr 110px 110px 110px 110px', [
        el('div', { style: 'font-size:13px;font-weight:500;color:var(--rv-color-value);' }, window.rotuloModelo(ctx.modelosById[item.modelo_id])),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:#3a4453;' }, window.fmtMetros(item.metros_pedidos)),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:#3a4453;' }, item.metros_ajustados == null ? window.fmtMetros(item.metros_pedidos) : window.fmtMetros(item.metros_ajustados)),
        el('div', { class: 'num', style: 'font-size:13px;text-align:right;color:#3a4453;' }, window.fmtMetros(totalPorItem[item.id] || 0)),
        el('span', { class: 'num', style: 'font-size:13px;text-align:right;font-weight:600;color:' + faltaCor + ';' }, faltaTxt),
      ]));
    }
    tabela.appendChild(tabelaInner);
    box.appendChild(tabela);

    var formHolder = el('div', {});
    var btnNova = el('button', {
      type: 'button', style: BTN_LINK + 'margin:14px 0 0;',
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
          type: 'button', style: 'background:#fff;color:#3f4757;border:1px solid var(--rv-color-input-border);border-radius:var(--rv-radius-control);padding:8px 16px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;',
          onclick: function () { formHolder.replaceChildren(); btnNova.style.display = ''; },
        }, 'Cancelar');
        formHolder.replaceChildren(el('div', { style: 'padding:12px 0;' }, form.node, el('div', { style: 'margin-top:10px;' }, btnSalvar, btnCancelar)));
        btnNova.style.display = 'none';
      },
    }, '+ Nova entrega');
    box.appendChild(btnNova);
    box.appendChild(formHolder);

    box.appendChild(el('div', { style: 'margin-top:16px;padding-top:14px;border-top:1px solid var(--rv-color-line-100);' },
      el('div', { style: 'font-size:11px;font-weight:700;color:var(--rv-color-section-label);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;' }, 'Histórico de entregas'),
      ctx.entregasCima.length === 0
        ? el('div', { style: 'font-size:12.5px;color:#a2aab6;' }, 'Nenhuma entrega registrada ainda.')
        : el('div', {}, ctx.entregasCima.map(function (ent) { return buildEntregaHistorico(ctx, ent); }))));
    return box;
  }

  function buildEntregaHistorico(ctx, ent) {
    var subcard = el('div', { style: 'border-bottom:1px solid var(--rv-color-line-100);padding:12px 0;' });
    var itensRow = (ent.entrega_itens || []).filter(function (x) { return x.op_id === ctx.op.id; }).map(function (ei) {
      var item = ctx.opItensRaw.find(function (i) { return i.id === ei.op_item_id; });
      var nome = item ? window.rotuloModelo(ctx.modelosById[item.modelo_id]) : '?';
      return el('div', { style: 'font-size:13px;color:#3f4757;margin-top:4px;' },
        nome + ': ' + window.fmtMetros(ei.metros_entregues),
        ei.defeito ? el('span', { style: 'margin-left:8px;color:var(--rv-color-danger);font-weight:600;font-size:12px;' }, 'DEFEITO') : '',
        ei.observacao ? el('span', { style: 'margin-left:8px;font-size:12px;color:#8a93a3;' }, '(' + ei.observacao + ')') : '');
    });
    // Se a entrega cima já gerou OP de acabamento, ela vira documento de
    // origem — edição/exclusão ficam bloqueadas; mantém o CTA "Ver OP".
    var vinculadaLatex = !!ctx.latexOpPorEntrega[ent.id];
    var acoes = el('div', { style: 'display:flex;align-items:center;gap:14px;' });
    if (!vinculadaLatex) {
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK, onclick: function () { abrirEdicaoAdmin(ctx, ent); } }, 'Editar'));
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK + 'color:var(--rv-color-danger);', onclick: function () { window.excluirEntrega(ent.id, ctx.reloadEntregasCima); } }, 'Excluir'));
    } else {
      acoes.appendChild(el('span', { style: 'font-size:12px;font-weight:700;color:var(--rv-color-warning);' }, 'Entrega vinculada à OP de acabamento'));
      acoes.appendChild(el('button', { type: 'button', style: BTN_LINK + 'color:var(--rv-color-warning);', onclick: function () { window.navigate('#/ops/' + ctx.latexOpPorEntrega[ent.id]); } }, 'Ver OP de látex'));
    }
    subcard.appendChild(el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;' },
      el('div', { style: 'font-size:13.5px;font-weight:600;color:var(--rv-color-title);' },
        new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        el('span', { style: 'font-weight:500;color:#5b6472;' },
          ' · ' + (ent.fornecedores?.nome || '?') + (ent.destino?.nome ? ' → ' + ent.destino.nome : ''))),
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

  function buildBlocoHistorico(ctx) {
    var box = el('div', { id: 'historico-op', style: CARD + 'padding:15px 17px;' },
      rvSectionPill('Histórico', IC_HIST));
    if (!ctx.opEventos.length) {
      box.appendChild(el('div', { style: 'font-size:12.5px;color:#a2aab6;' }, 'Nenhum evento registrado para esta OP.'));
      return box;
    }
    ctx.opEventos.forEach(function (ev, idx) {
      var linhaTxt = ev.tipo_evento === 'status_alterado'
        ? 'Status alterado: ' + humanizeLabel(ev.status_anterior) + ' → ' + humanizeLabel(ev.status_novo)
        : humanizeLabel(ev.tipo_evento);
      var isLast = idx === ctx.opEventos.length - 1;
      var trilha = el('div', { style: 'display:flex;flex-direction:column;align-items:center;' },
        el('div', { style: 'width:9px;height:9px;border-radius:50%;background:' + (idx === 0 ? 'var(--rv-color-accent)' : '#cfd5de') + ';margin-top:4px;flex-shrink:0;' }),
        isLast ? '' : el('div', { style: 'width:2px;flex:1;background:var(--rv-color-line-200);' }));
      var conteudo = el('div', { style: 'padding-bottom:' + (isLast ? '0' : '16px') + ';' },
        el('div', { style: 'font-size:11.5px;color:#9aa2af;' }, fmtDateLabel(ev.criado_em)),
        el('div', { style: 'font-size:13.5px;font-weight:600;color:var(--rv-color-title);margin-top:2px;' }, linhaTxt),
        ev.observacao ? el('div', { style: 'font-size:13px;color:#7b8494;margin-top:1px;' }, ev.observacao) : '');
      box.appendChild(el('div', { style: 'display:flex;gap:12px;' }, trilha, conteudo));
    });
    return box;
  }

  // ---------------------------------------------------------------------
  // Rail direito (sticky)
  // ---------------------------------------------------------------------

  function metricRow(label, value, color) {
    return el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;' },
      el('span', { style: 'font-size:12.5px;color:#5b6472;flex:1;min-width:0;' }, label),
      el('span', { style: 'font-size:15px;font-weight:700;color:' + (color || 'var(--rv-color-title)') + ';white-space:nowrap;font-variant-numeric:tabular-nums;' }, value));
  }

  function buildResumo(totais) {
    var pctLabel = String(totais.pct).replace('.', ',');
    var saldoCor = totais.excedente ? 'var(--rv-color-danger)' : 'var(--rv-color-accent)';
    var pctTexto = totais.excedente
      ? pctLabel + '% entregue — acima do total ajustado (excedente).'
      : pctLabel + '% já entregue para a próxima etapa';
    return el('div', { style: CARD + 'padding:15px 17px;' },
      rvSectionPill('Resumo desta OP', IC_RESUMO),
      el('div', { style: 'display:flex;flex-direction:column;gap:11px;' },
        metricRow('Total ajustado da OP', window.fmtMetros(totais.totalAjustado), 'var(--rv-color-title)'),
        metricRow('Entregue p/ acabamento', window.fmtMetros(totais.totalEntregue), totais.totalEntregue > 0 ? 'var(--rv-color-success)' : '#a2aab6'),
        metricRow('Saldo em tecelagem', window.fmtMetros(totais.saldo) + (totais.excedente ? ' (excedente)' : ''), saldoCor)),
      el('div', { style: 'margin-top:14px;' },
        el('div', { style: 'height:6px;border-radius:var(--rv-radius-pill);background:#eef1f5;overflow:hidden;' },
          el('div', { style: 'width:' + totais.pctClamped + '%;height:100%;background:' + totalsBarColor(totais) + ';' })),
        el('div', { style: 'font-size:11.5px;color:#a2aab6;margin-top:6px;' }, pctTexto)));
  }

  function buildEnviarAcabamento(ctx, totais) {
    var disponivelCor = totais.excedente ? 'var(--rv-color-danger)' : 'var(--rv-color-accent)';
    return el('div', { style: CARD + 'padding:15px 17px;' },
      rvSectionPill('Enviar para acabamento', IC_MOV),
      el('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-bottom:14px;' },
        metricRow('Disponível', window.fmtMetros(totais.saldo) + (totais.excedente ? ' (exced.)' : ''), disponivelCor),
        metricRow('Já enviado', window.fmtMetros(totais.totalEntregue), 'var(--rv-color-success)'),
        metricRow('Total ajustado', window.fmtMetros(totais.totalAjustado), 'var(--rv-color-title)')),
      el('button', {
        type: 'button', style: BTN_PRIMARY,
        onclick: function () { var alvo = document.getElementById('entregas-tecelagem-op'); if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      }, svgEl(SVG_ARROW), 'Transferir p/ acabamento'),
      el('div', { style: 'font-size:11.5px;color:#a2aab6;margin-top:9px;line-height:1.45;' },
        'Registre a transferência como uma nova entrega no bloco “Entregas de tecelagem”.'));
  }

  function buildDocumentos() {
    // Camada VISUAL (slots por tipo + Anexar full-width). Backend de anexo via
    // Google Drive entra depois — sem arquivos fabricados; Anexar só sinaliza.
    var SVG_CLIP = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
    var ANEXAR_BTN = 'width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;border:1px dashed var(--rv-color-input-border);border-radius:var(--rv-radius-control);background:#fff;color:#5b6472;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;';
    var tipos = ['Romaneio', 'NF de entrada', 'NF de saida'];
    var card = el('div', { id: 'documentos-op', style: CARD + 'padding:15px 17px;' },
      rvSectionPill('Documentos', IC_DOC));
    tipos.forEach(function (tipo, i) {
      card.appendChild(el('div', { style: (i > 0 ? 'border-top:1px solid var(--rv-color-line-100);margin-top:13px;padding-top:13px;' : '') },
        el('div', { style: 'display:flex;align-items:center;gap:7px;margin-bottom:8px;' },
          el('span', { style: 'font-size:12px;font-weight:600;color:var(--rv-color-value);' }, tipo),
          el('span', { style: 'font-size:10px;font-weight:600;color:var(--rv-color-accent);background:var(--rv-color-subtle-bg);padding:1px 6px;border-radius:var(--rv-radius-pill);' }, '0')),
        el('div', { style: 'font-size:11.5px;color:#a2aab6;margin-bottom:8px;' }, 'Nenhum arquivo anexado.'),
        el('button', {
          type: 'button', style: ANEXAR_BTN,
          onclick: function () { toast('Anexo de documentos sera integrado (Google Drive) em breve.', 'info'); },
        }, svgEl(SVG_CLIP), 'Anexar ' + tipo)));
    });
    return card;
  }

  // ---------------------------------------------------------------------
  // Composicao (cockpit 2 colunas com rail sticky) — largura ampla.
  // ---------------------------------------------------------------------

  function renderOPTecelagemProducaoAdmin(ctx) {
    var totais = computeTotaisProducao(ctx);

    var left = el('div', { style: 'min-width:0;display:flex;flex-direction:column;gap:14px;' },
      buildCardDados(ctx),
      buildCardItens(ctx, totais.totalPorItem),
      ctx.buildBlocoFios(),
      buildBlocoCapacidade(ctx, totais));
    if (ctx.cimaFornecedorId) left.appendChild(buildBlocoEntregas(ctx));
    left.appendChild(buildBlocoHistorico(ctx));

    var railKids = [buildResumo(totais)];
    if (ctx.cimaFornecedorId) railKids.push(buildEnviarAcabamento(ctx, totais));
    railKids.push(buildDocumentos());
    var right = el('div', { style: 'min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:14px;' }, railKids);

    var wrap = el('div', { style: 'display:block;' });
    wrap.appendChild(buildBreadcrumb(ctx));
    wrap.appendChild(buildHeader(ctx, totais));
    wrap.appendChild(el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) var(--rv-rail-w);gap:var(--rv-gap-cols);align-items:start;' }, left, right));
    return wrap;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opTecelagemProducaoAdmin = {
    renderOPTecelagemProducaoAdmin: renderOPTecelagemProducaoAdmin,
  };
  window.renderOPTecelagemProducaoAdmin = renderOPTecelagemProducaoAdmin;
})(window);
