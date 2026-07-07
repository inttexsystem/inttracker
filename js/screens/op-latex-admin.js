// =====================================================================
// === SCREENS: OP LATEX ADMIN (Seam A) =================================
// Tela admin da OP de latex/acabamento. A fase standalone separa
// preparacao (status aberta) de operacao (em_producao), preservando
// os writes legados de recebimento/finalizacao.
// =====================================================================

(function (window) {
  'use strict';

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  var SVG_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var SVG_ICON_OP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>';
  var SVG_ICON_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>';
  var SVG_ICON_LINES = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H3M21 6H3M21 14H3M21 18H3"></path></svg>';
  var SVG_ICON_SUMMARY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><path d="M8 7h8M8 11h8M8 15h5"></path></svg>';
  var SVG_INFO_BAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  var SVG_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
  var SVG_HINT_LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  var CARD = 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-card);';
  var FIELD_LABEL = 'font-size:var(--rv-font-size-body);font-weight:600;color:#3f4757;margin-bottom:7px;display:block;';
  var TH_STYLE = 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-muted);letter-spacing:.04em;white-space:nowrap;';
  var BTN_PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:38px;background:var(--rv-color-accent);color:#fff;border:none;border-radius:var(--rv-radius-control);padding:0 16px;font-weight:600;font-size:13.5px;font-family:inherit;white-space:nowrap;cursor:pointer;';
  var BTN_BACK = 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-color-surface);color:#5b6472;border:1px solid var(--rv-color-input-border);border-radius:var(--rv-radius-control);padding:8px 16px;font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;';
  var BTN_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:var(--rv-font-size-body);font-weight:600;color:var(--rv-color-accent);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var BTN_DANGER_LINK = 'display:inline-flex;align-items:center;gap:6px;font-size:var(--rv-font-size-body);font-weight:600;color:var(--rv-color-danger);background:none;border:none;padding:0;cursor:pointer;font-family:inherit;';
  var BTN_SOLID_SM = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--rv-color-accent);color:#fff;border:none;border-radius:var(--rv-radius-control);padding:8px 14px;font-weight:700;font-size:var(--rv-font-size-body);font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_SOFT_SM = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#fff;color:var(--rv-color-accent);border:1px solid #cfe0fb;border-radius:var(--rv-radius-control);padding:8px 14px;font-weight:700;font-size:var(--rv-font-size-body);font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_DANGER_SM = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#fff;color:var(--rv-color-danger);border:1px solid #f1c7c5;border-radius:var(--rv-radius-control);padding:8px 14px;font-weight:700;font-size:var(--rv-font-size-body);font-family:inherit;cursor:pointer;white-space:nowrap;';
  var SECTION_ICON = 'width:34px;height:34px;border-radius:var(--rv-radius-card);background:var(--rv-color-subtle-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;';

  // Header de seção estilo Inttex: quadradinho (chip) 22px com fundo claro,
  // borda sutil e um SVG pequeno (13px) — seguido do rótulo 11px UPPERCASE.
  // NÃO usa barra/strip vertical. Cada seção recebe um ícone distinto.
  var CHIP_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--rv-radius-control);background:var(--rv-color-chip-bg);border:1px solid var(--rv-color-line-200);color:var(--rv-color-chip-glyph);flex-shrink:0;';
  var SECTION_LABEL_STYLE = 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-section-label);letter-spacing:var(--rv-tracking-label);text-transform:uppercase;';

  function chipSvg(inner) {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var IC_DADOS    = chipSvg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect>');
  var IC_ITENS    = chipSvg('<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>');
  var IC_MATERIAL = chipSvg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>');
  var IC_RESUMO   = chipSvg('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>');
  var IC_MOV      = chipSvg('<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>');
  var IC_DOC      = chipSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>');
  var IC_HIST     = chipSvg('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>');
  var IC_FLAG     = chipSvg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>');
  var IC_CHECK    = chipSvg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>');

  function sectionIcon(svgMarkup) {
    return el('div', { style: SECTION_ICON }, svgEl(svgMarkup));
  }

  // Header de seção canônico (chip de ícone + rótulo UPPERCASE). `iconMarkup`
  // é o SVG do chip; se ausente cai no ícone de "dados".
  function rvSectionPill(label, iconMarkup) {
    return el('div', { style: 'display:flex;align-items:center;gap:9px;margin-bottom:14px;' },
      el('span', { style: CHIP_STYLE }, svgEl(iconMarkup || IC_DADOS)),
      el('span', { style: SECTION_LABEL_STYLE }, label));
  }

  function sectionHead(svgMarkup, title) {
    return el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:18px;' },
      sectionIcon(svgMarkup),
      el('span', { style: 'font-size:16px;font-weight:700;color:var(--rv-color-title);' }, title));
  }

  // Botões do cabeçalho da página (leves, altura 34px) — secundário,
  // sucesso (Finalizar) e destrutivo discreto (Excluir, sempre ícone+texto).
  var BTN_HDR_SECONDARY = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:500;color:#4a5462;border:1px solid var(--rv-color-input-border);background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;';
  var BTN_HDR_SUCCESS = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:600;color:#15803d;border:1px solid #bfe6cd;background:#f2fbf5;cursor:pointer;font-family:inherit;white-space:nowrap;';
  var BTN_HDR_DANGER = 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:var(--rv-radius-control);font-size:13px;font-weight:500;color:var(--rv-color-danger);border:1px solid #f0d2d2;background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;';
  var SVG_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  var SVG_FLAG_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';

  // Pílulas: ETAPA (teal, Acabamento) e STATUS (azul Preparação / âmbar Em
  // produção / verde Concluída) — cores distintas para não confundir os dois.
  var PILL_BASE = 'display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:var(--rv-radius-pill);white-space:nowrap;';
  function rvStageBadge() {
    return el('span', { style: PILL_BASE + 'background:var(--rv-stage-acabamento-bg);color:var(--rv-stage-acabamento);' }, 'Acabamento');
  }
  function rvDot(color) {
    return el('span', { style: 'width:6px;height:6px;border-radius:50%;background:' + color + ';' });
  }
  function rvStatusBadge(status) {
    if (status === 'em_producao') {
      return el('span', { style: PILL_BASE + 'background:var(--rv-status-prod-bg);color:var(--rv-status-prod);' }, rvDot('var(--rv-status-prod-dot)'), 'Em produção');
    }
    if (status === 'aberta') {
      return el('span', { style: PILL_BASE + 'background:var(--rv-status-prep-bg);color:var(--rv-status-prep);' }, rvDot('var(--rv-status-prep)'), 'Preparação');
    }
    var map = { concluida: 'Concluída', finalizada: 'Finalizada' };
    return el('span', { style: PILL_BASE + 'background:#eef4ec;color:var(--rv-color-success);' }, rvDot('var(--rv-color-success)'), map[status] || status);
  }

  function fieldBlock(label, valueNode, style) {
    return el('div', { style: style || '' },
      el('label', { style: FIELD_LABEL }, label),
      valueNode);
  }

  function thRow(colsTemplate, labels) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:10px 24px;background:var(--rv-color-bg-header);border-bottom:1px solid var(--rv-color-line-200);' },
      labels.map(function (label, idx) {
        return el('div', { style: TH_STYLE + (idx === labels.length - 1 ? 'text-align:right;' : '') }, label);
      }));
  }

  function gridRow(colsTemplate, cells) {
    return el('div', { style: 'display:grid;grid-template-columns:' + colsTemplate + ';gap:10px;padding:12px 24px;border-bottom:1px solid var(--rv-color-line-100);align-items:center;' }, cells);
  }

  function sumMetros(rows, key) {
    return Math.round((rows || []).reduce(function (acc, row) {
      return acc + Number(row && row[key] ? row[key] : 0);
    }, 0) * 100) / 100;
  }

  function formatOpDisplay(op, ctx) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(op, ctx || {});
    }
    var numero = op && op.numero != null ? op.numero : '---';
    return 'OP ' + numero + (op && op.ano != null ? '/' + op.ano : '');
  }

  function formatOpLegacy(op) {
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpLegacyCode === 'function') return api.formatOpLegacyCode(op);
    var numero = op && op.numero != null ? op.numero : '---';
    return 'OP ' + numero + (op && op.ano != null ? '/' + op.ano : '');
  }

  function internalOpLabel(op) {
    return formatOpLegacy(op).replace(/^OP /, 'Nº interno ');
  }

  async function loadPedidoOperationalContext(op) {
    var pedidoId = op && op.lote && op.lote.pedido_id ? op.lote.pedido_id : null;
    if (!pedidoId || !supa || typeof supa.from !== 'function') return null;
    try {
      var pedidoRes = await supa.from('pedidos')
        .select('id, numero, criado_em')
        .eq('id', pedidoId)
        .maybeSingle();
      if (pedidoRes.error || !pedidoRes.data) return null;
      var lotesRes = await supa.from('lotes')
        .select('id')
        .eq('pedido_id', pedidoId);
      if (lotesRes.error) return null;
      var loteIds = (lotesRes.data || [])
        .map(function (lote) { return lote && lote.id; })
        .filter(function (id) { return id != null; });
      if (!loteIds.length) return null;
      var opsRes = await supa.from('ops')
        .select('id, numero, ano, status, tipo, criado_em, lote_id')
        .in('lote_id', loteIds)
        .order('criado_em', { ascending: true })
        .order('id', { ascending: true });
      if (opsRes.error) return null;
      return { pedido: pedidoRes.data, ops: opsRes.data || [] };
    } catch (err) {
      console.error('op-latex-admin: erro ao carregar contexto operacional da OP', err);
      return null;
    }
  }

  async function renderOPLatexAdmin(opId) {
    var container = el('div', {});

    async function reload() {
      var opRes = await supa.from('ops')
        .select('id, numero, ano, status, tipo, observacao, origem_op_id, origem_entrega_id, criado_em, lote:lote_id(id, numero, pedido_id, cliente:cliente_id(id, nome)), op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(nome))')
        .eq('id', opId)
        .single();
      if (opRes.error) {
        toast('Erro ao carregar OP de latex', 'error');
        console.error(opRes.error);
        return;
      }

      var op = opRes.data;
      var latexForn = (op.op_fornecedores || []).find(function (row) { return row.etapa === 'latex'; });
      var latexFornecedorId = latexForn ? latexForn.fornecedor_id : null;
      var opDisplayContext = await loadPedidoOperationalContext(op);

      var origemOp = null;
      if (op.origem_op_id) {
        var origemRes = await supa.from('ops')
          .select('id, numero, ano, tipo, criado_em, lote_id, op_itens(id, modelo_id, pedido_item_id)')
          .eq('id', op.origem_op_id)
          .maybeSingle();
        if (!origemRes.error && origemRes.data) origemOp = origemRes.data;
      }

      var origemEntregaIds = [];
      var origemLinksRes = await supa.from('op_latex_entregas')
        .select('entrega_id')
        .eq('op_latex_id', op.id);
      if (!origemLinksRes.error) {
        origemEntregaIds = (origemLinksRes.data || [])
          .map(function (row) { return row.entrega_id; })
          .filter(function (id) { return id != null; });
      }
      if (!origemEntregaIds.length && op.origem_entrega_id) {
        origemEntregaIds = [op.origem_entrega_id];
      }
      origemEntregaIds = Array.from(new Set(origemEntregaIds));
      var origemEntregas = [];
      if (origemEntregaIds.length) {
        var origemEntRes = await supa.from('entregas')
          .select('id, fornecedor_id, destino_fornecedor_id, data, observacao, fornecedores:fornecedor_id(nome), destino:destino_fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
          .in('id', origemEntregaIds)
          .order('data', { ascending: false })
          .order('id', { ascending: false });
        origemEntregas = (origemEntRes.data || []).filter(function (row) {
          return (row.entrega_itens || []).some(function (ei) {
            return !ei.defeito && (!op.origem_op_id || ei.op_id === op.origem_op_id);
          });
        });
      }

      var entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'latex')
        .eq('fornecedor_id', latexFornecedorId)
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      var movimentosLatex = (entRes.data || []).filter(function (row) {
        return (row.entrega_itens || []).some(function (ei) { return ei.op_id === op.id; });
      });

      var modeloIds = Array.from(new Set((op.op_itens || [])
        .concat((origemOp && origemOp.op_itens) || [])
        .map(function (item) { return item.modelo_id; })
        .filter(function (id) { return id != null; })));
      var modelosRes = modeloIds.length
        ? await supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
        : { data: [] };
      var modelosById = {};
      (modelosRes.data || []).forEach(function (modelo) { modelosById[modelo.id] = modelo; });

      var expedicao = null;
      var expRes = await supa.from('expedicoes')
        .select('id, status, pedido_id, op_latex_id')
        .eq('op_latex_id', op.id)
        .maybeSingle();
      if (!expRes.error && expRes.data) expedicao = expRes.data;

      var saldoExpedicao = null;
      var saldoRes = await supa.rpc('consultar_saldo_expedicao_latex', { p_op_latex_id: op.id });
      if (!saldoRes.error && saldoRes.data && saldoRes.data.ok !== false) {
        saldoExpedicao = saldoRes.data;
      } else if (saldoRes.error || (saldoRes.data && saldoRes.data.ok === false)) {
        console.error('op-latex-admin: erro ao consultar saldo de expedicao', saldoRes.error || saldoRes.data);
      }

      render(op, movimentosLatex, origemEntregas, modelosById, latexFornecedorId, origemOp, expedicao, saldoExpedicao, opDisplayContext);
    }

    function render(op, movimentosLatex, origemEntregas, modelosById, latexFornecedorId, origemOp, expedicao, saldoExpedicao, opDisplayContext) {
      movimentosLatex = movimentosLatex || [];
      origemEntregas = origemEntregas || [];
      var recItens = movimentosLatex.flatMap(function (ent) {
        return (ent.entrega_itens || []).filter(function (ei) { return ei.op_id === op.id; });
      });
      var totalPorItem = totalEntregueCimaPorItem(recItens);
      function origemEntregaItens(ent) {
        return (ent.entrega_itens || []).filter(function (ei) {
          return !ei.defeito && (!op.origem_op_id || ei.op_id === op.origem_op_id);
        });
      }
      function origemItemLabel(ei) {
        var itemOrigem = ((origemOp && origemOp.op_itens) || []).find(function (item) { return item.id === ei.op_item_id; });
        var itemLatex = (op.op_itens || []).find(function (item) {
          return itemOrigem && item.modelo_id === itemOrigem.modelo_id;
        });
        var modelo = itemOrigem ? modelosById[itemOrigem.modelo_id] : (itemLatex ? modelosById[itemLatex.modelo_id] : null);
        return modelo ? window.rotuloModelo(modelo) : ('Item #' + ei.op_item_id);
      }
      function totalOrigemEntrega(ent) {
        return Math.round(origemEntregaItens(ent).reduce(function (acc, ei) {
          return acc + Number(ei.metros_entregues || 0);
        }, 0) * 100) / 100;
      }
      var totalOrigemTecelagem = Math.round(origemEntregas.reduce(function (acc, ent) {
        return acc + totalOrigemEntrega(ent);
      }, 0) * 100) / 100;
      function metrosAjustadosItem(item) {
        return item && item.metros_ajustados != null ? Number(item.metros_ajustados) : Number(item && item.metros_pedidos ? item.metros_pedidos : 0);
      }

      var totalEnviado = Math.round((op.op_itens || []).reduce(function (acc, item) {
        return acc + metrosAjustadosItem(item);
      }, 0) * 100) / 100;
      var totalRecebido = Math.round(Object.keys(totalPorItem).reduce(function (acc, key) {
        return acc + Number(totalPorItem[key] || 0);
      }, 0) * 100) / 100;
      // Contrato direto Acabamento -> Expedicao (db/32): a fonte canonica de
      // saldo e a RPC consultar_saldo_expedicao_latex. "Recebido da Tecelagem"
      // e o material que entrou na OP Latex (entregas etapa='cima' via
      // op_latex_entregas). Nao existe etapa intermediaria "registrar
      // acabamento"; movimentar para a Expedicao e a propria liberacao.
      var recebidoTecelagem = (saldoExpedicao && saldoExpedicao.recebido_total != null)
        ? Number(saldoExpedicao.recebido_total) : totalEnviado;
      var movimentadoExpedicao = (saldoExpedicao && saldoExpedicao.liberado_total != null)
        ? Number(saldoExpedicao.liberado_total) : 0;
      var disponivelMovimentar = (saldoExpedicao && saldoExpedicao.disponivel_total != null)
        ? Number(saldoExpedicao.disponivel_total)
        : Math.max(Math.round((recebidoTecelagem - movimentadoExpedicao) * 100) / 100, 0);
      var entregueCliente = (saldoExpedicao && saldoExpedicao.entregue_total != null)
        ? Number(saldoExpedicao.entregue_total) : 0;
      var saldoEmAcabamento = (saldoExpedicao && saldoExpedicao.saldo_em_acabamento_total != null)
        ? Number(saldoExpedicao.saldo_em_acabamento_total) : disponivelMovimentar;
      var saldoItemById = {};
      ((saldoExpedicao && Array.isArray(saldoExpedicao.itens)) ? saldoExpedicao.itens : []).forEach(function (row) {
        if (row && row.op_item_id != null) saldoItemById[row.op_item_id] = row;
      });
      var movimentadoPercent = recebidoTecelagem > 0 ? Math.round((movimentadoExpedicao / recebidoTecelagem) * 1000) / 10 : 0;
      var latexFornecedorNome = ((op.op_fornecedores || []).find(function (row) {
        return row.etapa === 'latex';
      }) || {}).fornecedores?.nome || '---';
      var origemLabel = origemOp
        ? (formatOpDisplay(origemOp, opDisplayContext) + ' - Tecelagem')
        : (op.origem_op_id ? ('OP #' + op.origem_op_id) : '---');
      function abrirEdicaoAdmin(ent, opArg, modelosByIdArg) {
        var form = buildEntregaInlineForm({ opItens: opArg.op_itens || [], modelosById: modelosByIdArg, entrega: ent, comDestino: false });
        modal({
          title: 'Editar recebimento - ' + new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'),
          body: form.node,
          saveLabel: 'Salvar alteracoes',
          onSave: async function () {
            var ok = await atualizarEntregaLatex({ entregaId: ent.id, opId: opArg.id, payload: form.getPayload() });
            if (ok) reload();
            return ok;
          },
        });
      }

      async function confirmarEntradaAcabamento(id) {
        var r = await supa.rpc('alterar_status_op', {
          p_op_id: id,
          p_novo_status: 'em_producao',
          p_observacao: 'Entrada no acabamento confirmada',
        });
        if (r.error || (r.data && r.data.ok === false)) {
          var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Transicao nao realizada');
          toast('Erro ao confirmar entrada: ' + msg, 'error');
          console.error(r.error || r.data);
          return false;
        }
        toast('Entrada confirmada.', 'success');
        await reload();
        return true;
      }

      async function liberarExpedicao(id, btn) {
        if (btn) btn.disabled = true;
        var r = await supa.rpc('liberar_expedicao', { p_op_latex_id: id });
        if (r.error || (r.data && r.data.ok === false)) {
          var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Liberacao nao realizada');
          toast('Erro ao liberar expedicao: ' + msg, 'error');
          console.error(r.error || r.data);
          if (btn) btn.disabled = false;
          return false;
        }
        var expedicaoId = r.data && r.data.expedicao_id;
        toast('Expedicao liberada.', 'success');
        if (expedicaoId) {
          navigate('#/expedicoes/' + expedicaoId);
        } else {
          await reload();
        }
        return true;
      }

      async function liberarExpedicaoParcial(id, itens, btn) {
        if (btn) btn.disabled = true;
        var r = await supa.rpc('liberar_expedicao_latex_parcial', {
          p_op_latex_id: id,
          p_itens: itens,
          p_observacao: 'Liberacao parcial pelo painel da OP Latex',
        });
        if (r.error || (r.data && r.data.ok === false)) {
          var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Movimentacao nao realizada');
          toast('Erro ao movimentar para expedicao: ' + msg, 'error');
          console.error(r.error || r.data);
          if (btn) btn.disabled = false;
          return false;
        }
        var expedicaoId = r.data && r.data.expedicao_id;
        toast('Movimentado para expedicao.', 'success');
        if (expedicaoId) {
          navigate('#/expedicoes/' + expedicaoId);
        } else {
          await reload();
        }
        return true;
      }

      function saldoLabel(valorBase, recebidoBase) {
        var falta = Math.round((Number(valorBase || 0) - Number(recebidoBase || 0)) * 100) / 100;
        if (falta > 0) return { text: window.fmtMetros(falta), color: '#d6403a' };
        if (falta < 0) return { text: 'Excedente ' + window.fmtMetros(Math.abs(falta)), color: '#c2610c' };
        return { text: 'Completo', color: '#18794a' };
      }

      function smallBadge(label, bg, color) {
        return el('span', { style: 'display:inline-flex;align-items:center;border-radius:4px;padding:4px 9px;background:' + bg + ';color:' + color + ';font-size:11.5px;font-weight:700;white-space:nowrap;' }, label);
      }

      function buildExpedicaoCard(opArg, expedicaoArg, saldoArg) {
        var statusOk = opArg.status === 'finalizada' || opArg.status === 'concluida';
        var saldoItens = ((saldoArg && Array.isArray(saldoArg.itens)) ? saldoArg.itens : [])
          .map(function (row) {
            return Object.assign({}, row, {
              recebido: Number(row.recebido || 0),
              liberado: Number(row.liberado || 0),
              disponivel: Number(row.disponivel || 0),
            });
          });
        var liberaveis = saldoItens.filter(function (row) { return row.disponivel > 0; });
        var saldoTotal = Math.round(liberaveis.reduce(function (acc, row) {
          return acc + Number(row.disponivel || 0);
        }, 0) * 100) / 100;
        var recebidoTotal = saldoArg ? Number(saldoArg.recebido_total || 0) : 0;
        var liberadoTotal = saldoArg ? Number(saldoArg.liberado_total || 0) : 0;

        function modeloSaldoLabel(row) {
          var modelo = modelosById[row.modelo_id];
          return modelo ? window.rotuloModelo(modelo) : ('Item #' + row.op_item_id);
        }

        var card = el('div', { style: CARD + 'padding:15px 17px;' });
        card.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;' },
          rvSectionPill('Expedição', IC_MOV),
          expedicaoArg
            ? smallBadge('Expedicao ' + expedicaoArg.status, 'var(--rv-color-subtle-bg)', 'var(--rv-color-accent)')
            : smallBadge(saldoTotal > 0 ? 'Saldo movimentavel' : (statusOk ? 'Fluxo total disponivel' : 'Sem saldo'), saldoTotal > 0 ? '#e6f4ec' : (statusOk ? '#fff4e6' : 'var(--rv-color-line-100)'), saldoTotal > 0 ? '#18794a' : (statusOk ? '#c2610c' : '#6b7280'))));

        if (expedicaoArg) {
          card.appendChild(el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;margin-bottom:12px;' },
            'Expedicao criada. Registre entrega/coleta na tela operacional de expedicao.'));
          card.appendChild(el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;' },
            fieldBlock('Recebido', el('div', { style: 'font-size:14px;font-weight:700;color:var(--rv-color-title);' }, window.fmtMetros(recebidoTotal))),
            fieldBlock('Movimentado', el('div', { style: 'font-size:14px;font-weight:700;color:#18794a;' }, window.fmtMetros(liberadoTotal))),
            fieldBlock('Disponivel', el('div', { style: 'font-size:14px;font-weight:700;color:' + (saldoTotal > 0 ? 'var(--rv-color-accent)' : 'var(--rv-color-muted)') + ';' }, window.fmtMetros(saldoTotal)))));
          if (saldoTotal > 0) {
            card.appendChild(el('div', { style: 'font-size:12px;color:var(--rv-color-muted);line-height:1.5;margin-bottom:10px;' },
              'Ainda ha saldo recebido para movimentar. Use a acao Movimentar na expedicao vinculada.'));
          }
          card.appendChild(el('button', {
            type: 'button',
            style: BTN_SOLID_SM,
            onclick: function () { navigate('#/expedicoes/' + expedicaoArg.id); },
          }, 'Abrir expedicao'));
          return card;
        }

        if (saldoTotal > 0) {
          var linhas = liberaveis.map(function (row) {
            var input = textInput({ type: 'number', step: '0.01', value: String(row.disponivel) });
            return { row: row, input: input };
          });
          card.appendChild(el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;' },
            fieldBlock('Recebido', el('div', { style: 'font-size:14px;font-weight:700;color:var(--rv-color-title);' }, window.fmtMetros(recebidoTotal))),
            fieldBlock('Movimentado', el('div', { style: 'font-size:14px;font-weight:700;color:#18794a;' }, window.fmtMetros(liberadoTotal))),
            fieldBlock('Disponivel', el('div', { style: 'font-size:14px;font-weight:800;color:var(--rv-color-accent);' }, window.fmtMetros(saldoTotal)))));
          card.appendChild(el('div', { style: 'border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-control);overflow:hidden;margin-bottom:12px;' },
            linhas.map(function (linha, index) {
              return el('div', { style: 'display:grid;grid-template-columns:1fr 100px 100px 120px;gap:10px;align-items:center;padding:10px 12px;' + (index < linhas.length - 1 ? 'border-bottom:1px solid var(--rv-color-line-100);' : '') },
                el('div', {},
                  el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-color-title);' }, modeloSaldoLabel(linha.row)),
                  el('div', { style: 'font-size:11.5px;color:var(--rv-color-muted);margin-top:2px;' }, 'Recebido ' + window.fmtMetros(linha.row.recebido) + ' | movimentado ' + window.fmtMetros(linha.row.liberado))),
                el('div', { style: 'font-size:12.5px;color:#5b6472;font-weight:700;' }, window.fmtMetros(linha.row.disponivel)),
                el('label', { style: 'font-size:11.5px;color:var(--rv-color-muted);font-weight:700;text-transform:uppercase;' }, 'Mover'),
                linha.input);
            })));
          card.appendChild(el('button', {
            type: 'button',
            style: BTN_SOLID_SM,
            onclick: function (event) {
              var payload = [];
              for (var i = 0; i < linhas.length; i++) {
                var metros = Number(linhas[i].input.value || 0);
                if (metros > linhas[i].row.disponivel) {
                  toast('Quantidade maior que o saldo disponivel para movimentar.', 'error');
                  return;
                }
                if (metros > 0) payload.push({ op_item_id: linhas[i].row.op_item_id, metros: metros });
              }
              if (!payload.length) {
                toast('Informe ao menos uma quantidade para movimentar.', 'error');
                return;
              }
              liberarExpedicaoParcial(opArg.id, payload, event && event.currentTarget ? event.currentTarget : null);
            },
          }, 'Movimentar'));
          card.appendChild(el('div', { style: 'font-size:12px;color:var(--rv-color-muted);line-height:1.5;margin-top:8px;' },
            'Movimenta a quantidade disponivel do Acabamento para Expedicao.'));
          return card;
        }

        if (!statusOk) {
          card.appendChild(el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;' },
            'Sem saldo recebido disponivel para movimentar.'));
          return card;
        }

        card.appendChild(el('div', { style: 'font-size:13px;color:#5b6472;line-height:1.5;margin-bottom:12px;' },
          'OP terminal sem saldo parcial calculado. Use a liberacao total legada para criar a expedicao desta OP.'));
        card.appendChild(el('button', {
          type: 'button',
          style: BTN_SOLID_SM,
          onclick: function (event) {
            liberarExpedicao(opArg.id, event && event.currentTarget ? event.currentTarget : null);
          },
        }, 'Liberar total'));
        return card;
      }

      // Nota: nao existe etapa intermediaria "registrar acabamento". O
      // material disponivel na OP e o recebido da Tecelagem (entregas
      // etapa='cima' via op_latex_entregas); o movimento Acabamento ->
      // Expedicao (buildExpedicaoCard) e a propria declaracao de acabado/
      // liberado. Por isso nao ha card operacional de "novo recebimento" de
      // acabamento nesta tela.

      function renderOPLatexProducao() {
        var CARD_PROD = 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-card);';
        var BTN_ACTION = 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#3f4757;border:1px solid var(--rv-color-input-border);border-radius:var(--rv-radius-control);padding:7px 12px;font-weight:600;font-size:12.5px;font-family:inherit;cursor:pointer;';
        var SVG_ARROW_RIGHT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>';
        var SVG_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
        var SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        var SVG_DOC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
        var SVG_CLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>';
        var SVG_LINEAGE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect></svg>';

        var resumoSaldoTexto = window.fmtMetros(saldoEmAcabamento);
        var resumoSaldoCor = saldoEmAcabamento > 0 ? '#c2610c' : '#18794a';
        var percentualClamp = Math.max(0, Math.min(100, movimentadoPercent));
        var pctLabel = String(movimentadoPercent).replace('.', ',');
        var pedidoId = op.lote && op.lote.pedido_id ? op.lote.pedido_id : null;
        var pedidoDisplay = opDisplayContext && opDisplayContext.pedido ? opDisplayContext.pedido : null;
        var pedidoLabelCurto = pedidoDisplay && pedidoDisplay.numero != null ? ('Pedido Nº ' + pedidoDisplay.numero) : (pedidoId ? ('Pedido #' + pedidoId) : 'Pedido vinculado');
        var pedidoCodigo = pedidoDisplay && pedidoDisplay.numero != null ? ('Pedido Nº ' + pedidoDisplay.numero) : (pedidoId ? ('PED-' + String(pedidoId).padStart(6, '0')) : '---');
        var clienteNome = op.lote?.cliente?.nome || '---';
        var itemVinculadoLabel = (op.op_itens || []).length
          ? String((op.op_itens || []).length) + ' ' + ((op.op_itens || []).length === 1 ? 'item' : 'itens') + ' (ver abaixo)'
          : '---';
        var abertaEm = op.criado_em ? new Date(op.criado_em).toLocaleDateString('pt-BR') : '';
        var origemProdLabel = origemOp ? (formatOpDisplay(origemOp, opDisplayContext) + ' · Tecelagem') : origemLabel;

        function fmtData(value) {
          if (!value) return '---';
          try { return new Date(value + (String(value).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR'); }
          catch (err) { return String(value); }
        }

        function modeloLabel(item) {
          var modelo = item ? modelosById[item.modelo_id] : null;
          return modelo ? window.rotuloModelo(modelo) : (item ? ('#' + item.modelo_id) : 'Item da OP');
        }

        function campo(label, node) {
          return el('div', {},
            el('label', { style: 'display:block;font-size:12px;color:#9aa2af;margin-bottom:6px;' }, label),
            node);
        }

        function valor(text, color, weight) {
          return el('div', { style: 'font-size:13.5px;color:' + (color || '#16203a') + ';font-weight:' + (weight || '600') + ';' }, text);
        }

        function linhaResumo(label, value, color) {
          return el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:#5b6472;gap:12px;' },
            el('span', {}, label),
            el('span', { style: 'color:' + (color || '#16203a') + ';font-weight:700;white-space:nowrap;' }, value));
        }

        function toastOperacional(msg) {
          if (typeof toast === 'function') toast(msg, 'info');
        }

        function buildBreadcrumb() {
          return el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:#9aa2af;font-weight:500;margin-bottom:8px;' },
            el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:#9aa2af;cursor:pointer;', onclick: function () { navigate('#/ops'); } }, 'OPs'),
            el('span', { style: 'color:#c8ced6;' }, '/'),
            el('span', { style: 'color:#5b6472;' }, formatOpDisplay(op, opDisplayContext)));
        }

        function buildHeaderProducao() {
          var meta = [internalOpLabel(op)];
          if (op.lote && op.lote.cliente && op.lote.cliente.nome) meta.push(op.lote.cliente.nome);
          if (op.lote) meta.push('Lote Nº ' + op.lote.numero);
          if (latexFornecedorNome && latexFornecedorNome !== '---') meta.push('Fornecedor ' + latexFornecedorNome);
          if (abertaEm) meta.push('Aberta em ' + abertaEm);
          return el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px;' },
            el('div', { style: 'min-width:0;' },
              el('div', { style: 'display:flex;align-items:center;gap:11px;flex-wrap:wrap;' },
                el('h1', { style: 'margin:0;font-size:22px;font-weight:800;color:var(--rv-color-title);letter-spacing:-.02em;' }, formatOpDisplay(op, opDisplayContext)),
                rvStageBadge(),
                rvStatusBadge('em_producao')),
              el('div', { style: 'font-size:12.5px;color:var(--rv-color-muted);margin-top:7px;line-height:1.5;' }, meta.join(' · '))),
            el('div', { style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;' },
              el('button', { type: 'button', style: BTN_HDR_SUCCESS, onclick: function () { finalizar(op.id); } }, svgEl(SVG_FLAG_CHECK), 'Finalizar OP'),
              el('button', { type: 'button', style: BTN_HDR_DANGER, onclick: function () { excluirOpLatex(op.id); } }, svgEl(SVG_TRASH), 'Excluir')));
        }

        function buildDados() {
          var origemNode = op.origem_op_id
            ? el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-color-accent);font-weight:600;cursor:pointer;text-align:left;', onclick: function () { navigate('#/ops/' + op.origem_op_id); } }, origemProdLabel)
            : valor(origemLabel, '#8a93a3');
          var pedidoNode = pedidoId
            ? el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:var(--rv-color-accent);font-weight:700;cursor:pointer;text-align:left;', onclick: function () { navigate('#/pedidos/' + pedidoId); } }, pedidoCodigo)
            : valor(pedidoCodigo, '#8a93a3');
          return el('div', { style: CARD_PROD + 'padding:15px 17px;' },
            rvSectionPill('Dados da OP', IC_DADOS),
            el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px 18px;' },
              campo('Cliente', valor(clienteNome)),
              campo('Lote', valor(op.lote ? ('Lote Nº ' + op.lote.numero) : '---')),
              campo('Fornecedor de acabamento', valor(latexFornecedorNome)),
              campo('Origem', origemNode),
              campo('Pedido vinculado', pedidoNode),
              campo('Item do pedido vinculado', valor(itemVinculadoLabel))));
        }

        function buildResumo() {
          return el('div', { style: CARD_PROD + 'padding:15px 17px;' },
            rvSectionPill('Resumo desta OP', IC_RESUMO),
            el('div', { style: 'display:flex;flex-direction:column;gap:9px;' },
              linhaResumo('Recebido da Tecelagem', window.fmtMetros(recebidoTecelagem)),
              linhaResumo('Ja movimentado para Expedicao', window.fmtMetros(movimentadoExpedicao), '#18794a'),
              linhaResumo('Disponivel para movimentar', window.fmtMetros(disponivelMovimentar), disponivelMovimentar > 0 ? '#2563eb' : '#8a93a3'),
              linhaResumo('Entregue ao Cliente', window.fmtMetros(entregueCliente), '#18794a'),
              linhaResumo('Saldo em Acabamento', resumoSaldoTexto, resumoSaldoCor)),
            el('div', { style: 'height:6px;border-radius:99px;background:#e2e5ea;overflow:hidden;margin:12px 0 6px;' },
              el('div', { style: 'width:' + percentualClamp + '%;height:100%;background:#2563eb;' })),
            el('div', { style: 'font-size:11.5px;color:#9aa2af;' }, pctLabel + '% ja movimentado para expedicao'));
        }

        function buildItens() {
          var cols = '1.3fr .8fr .8fr .8fr .8fr 1.3fr';
          function tableHead(labels) {
            return el('div', { style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;padding:9px 20px;background:var(--rv-color-bg-header);border-top:1px solid var(--rv-color-line-200);border-bottom:1px solid var(--rv-color-line-200);min-width:820px;' },
              labels.map(function (label) {
                return el('div', { style: 'font-size:var(--rv-font-size-label);font-weight:700;color:var(--rv-color-muted);letter-spacing:.03em;' }, label);
              }));
          }
          function tableRow(cells) {
            return el('div', { style: 'display:grid;grid-template-columns:' + cols + ';gap:10px;padding:12px 20px;align-items:center;min-width:820px;' }, cells);
          }
          var card = el('div', { style: CARD_PROD + 'overflow:hidden;' },
            el('div', { style: 'padding:16px 20px 12px;' }, rvSectionPill('Itens da OP', IC_ITENS)));
          if (!(op.op_itens || []).length) {
            card.appendChild(el('div', { style: 'padding:0 20px 18px;font-size:13px;color:#aab2bf;' }, 'Nenhum item vinculado a esta OP.'));
            return card;
          }
          var table = el('div', { style: 'overflow-x:auto;' });
          table.appendChild(tableHead(['MODELO / CORES', 'RECEBIDO', 'MOVIMENTADO', 'DISPONIVEL', 'ENTREGUE', 'ITEM DO PEDIDO']));
          (op.op_itens || []).forEach(function (item) {
            var saldoItem = saldoItemById[item.id] || {};
            var recebidoItem = saldoItem.recebido != null ? Number(saldoItem.recebido) : metrosAjustadosItem(item);
            var movimentadoItem = Number(saldoItem.liberado || 0);
            var disponivelItem = saldoItem.disponivel != null
              ? Number(saldoItem.disponivel)
              : Math.max(Math.round((recebidoItem - movimentadoItem) * 100) / 100, 0);
            var entregueItem = Number(saldoItem.entregue || 0);
            table.appendChild(tableRow([
              el('div', { style: 'font-size:13.5px;font-weight:700;color:var(--rv-color-title);' }, modeloLabel(item)),
              el('div', { style: 'font-size:13.5px;color:#3f4757;font-weight:600;' }, window.fmtMetros(recebidoItem)),
              el('div', { style: 'font-size:13.5px;color:#2563eb;font-weight:700;' }, window.fmtMetros(movimentadoItem)),
              el('div', { style: 'font-size:13.5px;color:' + (disponivelItem > 0 ? '#c2610c' : '#18794a') + ';font-weight:700;' }, window.fmtMetros(disponivelItem)),
              el('div', { style: 'font-size:13.5px;color:#18794a;font-weight:700;' }, window.fmtMetros(entregueItem)),
              el('div', { style: 'font-size:12.5px;color:#2563eb;font-weight:600;' }, item.pedido_item_id ? (pedidoId ? ('Pedido #' + pedidoId + ' · item ' + item.pedido_item_id) : ('Item #' + item.pedido_item_id)) : '---'),
            ]));
          });
          card.appendChild(table);
          return card;
        }

        function buildMaterialRecebido() {
          var listaEntregasOrigem = origemEntregas.length
            ? origemEntregas.map(function (ent) {
              var itens = origemEntregaItens(ent);
              return el('div', { style: 'border-top:1px solid var(--rv-color-line-100);padding:12px 0 0;margin-top:12px;' },
                el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;' },
                  el('div', { style: 'font-size:13.5px;font-weight:700;color:var(--rv-color-title);' }, 'Entrega #' + ent.id),
                  el('div', { style: 'font-size:12px;color:var(--rv-color-muted);font-weight:600;' }, fmtData(ent.data))),
                el('div', { style: 'font-size:12.5px;color:#5b6472;margin-top:4px;line-height:1.5;' },
                  origemProdLabel + ' para ' + ((ent.destino && ent.destino.nome) || latexFornecedorNome)),
                itens.map(function (ei) {
                  return el('div', { style: 'font-size:13.5px;color:#3f4757;margin-top:5px;' },
                    origemItemLabel(ei) + ': ' + window.fmtMetros(ei.metros_entregues));
                }));
            })
            : [el('div', { style: 'font-size:13px;color:#aab2bf;border-top:1px solid var(--rv-color-line-100);padding-top:12px;margin-top:12px;' },
              'Vinculos de origem nao encontrados; usando total consolidado da OP.')];
          return el('div', { style: CARD_PROD + 'padding:15px 17px;' },
            rvSectionPill('Material recebido da tecelagem', IC_MATERIAL),
            el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:14px;' },
              campo('OP origem',
                op.origem_op_id ? el('button', { type: 'button', style: 'font-size:13.5px;color:#2563eb;font-weight:700;text-decoration:none;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;', onclick: function () { navigate('#/ops/' + op.origem_op_id); } }, origemProdLabel)
                  : valor(origemLabel, '#8a93a3')),
              campo('Entregas vinculadas', valor(String(origemEntregas.length || 0))),
              campo('Metros recebidos', valor(window.fmtMetros(totalOrigemTecelagem || totalEnviado)))),
            el('div', { style: 'font-size:12.5px;font-weight:700;color:var(--rv-color-muted);letter-spacing:.03em;margin-bottom:8px;' }, 'ENTRADAS DA TECELAGEM'),
            el('div', {}, listaEntregasOrigem),
            el('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:14px;' },
              campo('Saldo em acabamento', valor(window.fmtMetros(saldoEmAcabamento), '#c2610c', '700'))));
        }

        function buildDocumentos() {
          // Sem storage de documentos wired nesta tela: estado vazio honesto,
          // sem fabricar nomes de arquivo/estados (nada de mock).
          return el('div', { id: 'documentos-op', style: CARD_PROD + 'padding:15px 17px;' },
            rvSectionPill('Documentos', IC_DOC),
            el('div', { style: 'font-size:12.5px;color:#a2aab6;line-height:1.5;' },
              'Nenhum documento anexado a esta OP.'));
        }

        function buildHistorico() {
          var dataBase = origemEntregas[0] ? fmtData(origemEntregas[0].data) : (abertaEm || '---');
          var resumoOrigem = origemEntregas.length
            ? String(origemEntregas.length) + ' entrega' + (origemEntregas.length === 1 ? '' : 's') + ' de Tecelagem vinculada' + (origemEntregas.length === 1 ? '' : 's')
            : 'Entrada consolidada sem vinculo detalhado';
          return el('div', { id: 'historico-op', style: CARD_PROD + 'padding:15px 17px;' },
            rvSectionPill('Histórico', IC_HIST),
            el('div', { style: 'display:flex;gap:12px;align-items:flex-start;' },
              el('div', { style: 'display:flex;flex-direction:column;align-items:center;' },
                el('div', { style: 'width:11px;height:11px;border-radius:50%;background:var(--rv-color-accent);margin-top:4px;flex-shrink:0;' }),
                el('div', { style: 'width:2px;flex:1;background:var(--rv-color-line-200);' })),
              el('div', { style: 'padding-bottom:16px;' },
                el('div', { style: 'font-size:12px;color:#9aa2af;' }, dataBase),
                el('div', { style: 'font-size:14px;font-weight:700;color:var(--rv-color-title);margin-top:2px;' }, 'Entrada consolidada da Tecelagem'),
                el('div', { style: 'font-size:13px;color:#7b8494;margin-top:1px;' }, resumoOrigem + ' em ' + formatOpDisplay(op, opDisplayContext) + ' (Acabamento). Romaneio marcado como pendente.'))),
            el('div', { style: 'display:flex;gap:12px;align-items:flex-start;' },
              el('div', { style: 'width:11px;height:11px;border-radius:50%;background:#cfd5de;margin-top:4px;flex-shrink:0;' }),
              el('div', {},
                el('div', { style: 'font-size:14px;font-weight:600;color:#475065;margin-top:2px;' }, 'OP aberta'),
                el('div', { style: 'font-size:12px;color:#9aa2af;' }, dataBase),
                el('div', { style: 'font-size:13px;color:#7b8494;margin-top:1px;' }, formatOpDisplay(op, opDisplayContext) + ' acompanha a origem consolidada da ' + origemProdLabel + '.'))));
        }

        return el('div', { style: 'display:block;' },
          buildBreadcrumb(),
          buildHeaderProducao(),
          el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) var(--rv-rail-w);gap:var(--rv-gap-cols);align-items:start;' },
            el('div', { style: 'min-width:0;display:flex;flex-direction:column;gap:14px;' },
              buildDados(),
              buildItens(),
              buildMaterialRecebido(),
              buildHistorico()),
            el('div', { style: 'min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:14px;' },
              buildResumo(),
              buildExpedicaoCard(op, expedicao, saldoExpedicao),
              buildDocumentos())));
      }

      if (op.status === 'em_producao') {
        container.replaceChildren(renderOPLatexProducao());
        return;
      }

      if (op.status !== 'aberta') {
        var acoes = [{ label: '← Voltar', onclick: function () { navigate('#/ops'); } }];
        if (op.origem_op_id) acoes.push({ label: 'Ir para OP de tecelagem', onclick: function () { navigate('#/ops/' + op.origem_op_id); } });
        if (op.status === 'em_producao') acoes.push({ label: 'Finalizar OP', onclick: function () { finalizar(op.id); } });
        if (op.status === 'em_producao') acoes.push({ label: 'Editar enviado', onclick: function () { editarEnviado(op, modelosById); } });
        acoes.push({ label: 'Excluir OP', onclick: function () { excluirOpLatex(op.id); } });

        var header = pageHeader(formatOpDisplay(op, opDisplayContext) + ' · Látex', acoes);
        var info = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' },
          el('div', { class: 'flex items-center gap-3 mb-2' }, badgeTipo('latex'), badgeStatus(op.status)),
          op.lote ? el('div', { class: 'text-sm text-gray-700 mb-1' }, 'Lote Nº ' + op.lote.numero + ' · ' + (op.lote.cliente?.nome || '—')) : el('span', {}),
          op.observacao ? el('div', { class: 'text-sm text-gray-600' }, op.observacao) : el('span', {}));

        var tabela = dataTable({
          columns: [
            { key: 'modelo', label: 'Modelo', render: function (item) {
                var modelo = modelosById[item.modelo_id];
                return modelo ? window.rotuloModelo(modelo) : ('#' + item.modelo_id);
              } },
            { key: 'enviado', label: 'Enviado', render: function (item) { return window.fmtMetros(item.metros_pedidos); } },
            { key: 'recebido', label: 'Recebido', render: function (item) { return window.fmtMetros(totalPorItem[item.id] || 0); } },
            { key: 'falta', label: 'Falta', render: function (item) {
                var falta = Math.round((Number(item.metros_pedidos) - (totalPorItem[item.id] || 0)) * 100) / 100;
                return el('span', { class: falta <= 0 ? 'text-green-700' : 'text-gray-800' }, falta <= 0 ? '✅ completo' : window.fmtMetros(falta));
              } },
          ],
          rows: op.op_itens || [],
        });

        var box = el('div', { class: 'bg-white rounded-xl shadow p-5' });
        box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Movimentos de acabamento (informativo)'));

        if (movimentosLatex.length === 0) {
          box.appendChild(el('p', { class: 'text-sm text-gray-400 mt-2' }, 'Nenhum movimento de acabamento registrado.'));
        } else {
          movimentosLatex.forEach(function (ent) {
            var sub = el('div', { class: 'border-b py-3' });
            sub.appendChild(el('div', { class: 'flex items-center justify-between' },
              el('div', { class: 'text-sm' }, el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'))),
              op.status === 'em_producao' ? el('div', {},
                el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
                  onclick: function () { abrirEdicaoAdmin(ent, op, modelosById); } }, 'Editar'),
                el('button', { class: 'text-sm text-red-600 hover:underline',
                  onclick: function () { excluirEntrega(ent.id, reload); } }, 'Excluir')) : ''));
            if (ent.observacao) sub.appendChild(el('div', { class: 'text-xs text-gray-500' }, ent.observacao));
            (ent.entrega_itens || []).filter(function (item) { return item.op_id === op.id; }).forEach(function (ei) {
              var it = (op.op_itens || []).find(function (item) { return item.id === ei.op_item_id; });
              var modelo = it ? modelosById[it.modelo_id] : null;
              sub.appendChild(el('div', { class: 'text-sm text-gray-700' },
                (modelo ? window.rotuloModelo(modelo) : ('#' + ei.op_item_id)) + ': ' + window.fmtMetros(ei.metros_entregues),
                ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
                ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : ''));
            });
            box.appendChild(sub);
          });
        }

        container.replaceChildren(header, info, tabela, el('div', { class: 'h-4' }), box, el('div', { class: 'h-4' }), buildExpedicaoCard(op, expedicao, saldoExpedicao));
        return;
      }

      var totalEnviado = sumMetros(op.op_itens, 'metros_pedidos');
      var totalRecebido = Math.round(recItens.reduce(function (acc, item) {
        return acc + Number(item.metros_entregues || 0);
      }, 0) * 100) / 100;
      var metrosAguardando = Math.round(Math.max(totalEnviado - totalRecebido, 0) * 100) / 100;
      var latexFornecedorNome = ((op.op_fornecedores || []).find(function (row) {
        return row.etapa === 'latex';
      }) || {}).fornecedores?.nome || '—';
      var origemLabel = origemOp
        ? (formatOpDisplay(origemOp, opDisplayContext) + ' · Tecelagem')
        : (op.origem_op_id ? ('OP #' + op.origem_op_id) : '—');

      function buildHeader() {
        var abertaEmH = op.criado_em ? new Date(op.criado_em).toLocaleDateString('pt-BR') : '';
        var meta = [internalOpLabel(op)];
        if (latexFornecedorNome && latexFornecedorNome !== '—') meta.push('Fornecedor ' + latexFornecedorNome);
        if (op.lote) meta.push('Lote Nº ' + op.lote.numero);
        if (op.lote && op.lote.cliente && op.lote.cliente.nome) meta.push(op.lote.cliente.nome);
        if (abertaEmH) meta.push('Aberta em ' + abertaEmH);
        return el('div', {},
          el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;color:#9aa2af;font-weight:500;margin-bottom:8px;' },
            el('button', { type: 'button', style: 'background:none;border:none;padding:0;font:inherit;color:#9aa2af;cursor:pointer;', onclick: function () { navigate('#/ops'); } }, 'OPs'),
            el('span', { style: 'color:#c8ced6;' }, '/'),
            el('span', { style: 'color:#5b6472;' }, formatOpDisplay(op, opDisplayContext))),
          el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px;' },
            el('div', { style: 'min-width:0;' },
              el('div', { style: 'display:flex;align-items:center;gap:11px;flex-wrap:wrap;' },
                el('h1', { style: 'margin:0;font-size:22px;font-weight:800;color:var(--rv-color-title);letter-spacing:-.02em;' }, formatOpDisplay(op, opDisplayContext)),
                rvStageBadge(),
                rvStatusBadge('aberta')),
              el('div', { style: 'font-size:12.5px;color:var(--rv-color-muted);margin-top:7px;line-height:1.5;' }, meta.join(' · '))),
            el('div', { style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;' },
              el('button', { type: 'button', style: BTN_HDR_DANGER, onclick: function () { excluirOpLatex(op.id); } }, svgEl(SVG_TRASH), 'Excluir'))));
      }

      function buildCardDados() {
        var loteLabel = op.lote
          ? ('Lote Nº ' + op.lote.numero + ' · ' + (op.lote.cliente?.nome || '—'))
          : 'Sem lote vinculado';
        return el('div', { style: CARD + 'padding:15px 17px;' },
          rvSectionPill('Dados da OP', IC_DADOS),
          el('div', { style: 'display:grid;grid-template-columns:1fr 140px;gap:14px;margin-bottom:16px;' },
            fieldBlock('Número', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, String(op.numero))),
            fieldBlock('Ano', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, String(op.ano)))),
          el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;' },
            fieldBlock('Fornecedor de acabamento', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, latexFornecedorNome)),
            fieldBlock('Lote', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, loteLabel))),
          op.observacao ? el('div', { style: 'margin-top:16px;font-size:12.5px;color:#5b6472;line-height:1.5;' }, op.observacao) : '');
      }

      function buildCardItens() {
        var card = el('div', { style: CARD + 'padding:15px 0 0;' },
          el('div', { style: 'display:flex;align-items:center;gap:8px;padding:0 17px 14px;' },
            rvSectionPill('Itens da OP', IC_ITENS),
            el('span', { style: 'font-size:11.5px;color:var(--rv-color-muted);font-weight:400;margin-bottom:14px;' }, 'modelo × metros')));

        if (!(op.op_itens || []).length) {
          card.appendChild(el('div', { style: 'padding:0 24px 20px;font-size:13px;color:#aab2bf;' }, 'Nenhum item vinculado a esta OP.'));
          return card;
        }

        card.appendChild(thRow('1fr 140px 140px', ['MODELO', 'ENVIADO', 'RECEBIDO']));
        (op.op_itens || []).forEach(function (item) {
          var modelo = modelosById[item.modelo_id];
          card.appendChild(gridRow('1fr 140px 140px', [
            el('div', { style: 'font-size:13.5px;font-weight:500;color:var(--rv-color-title);' }, modelo ? window.rotuloModelo(modelo) : ('#' + item.modelo_id)),
            el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtMetros(item.metros_pedidos)),
            el('div', { style: 'font-size:13.5px;color:#3f4757;' }, window.fmtMetros(totalPorItem[item.id] || 0)),
          ]));
        });
        return card;
      }

      function buildCardRecebimentos() {
        var box = el('div', { style: CARD + 'padding:15px 17px;' });
        box.appendChild(rvSectionPill('Material recebido da tecelagem', IC_MATERIAL));
        box.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;' },
          fieldBlock('OP origem',
            origemOp
              ? el('button', { type: 'button', style: BTN_LINK, onclick: function () { navigate('#/ops/' + origemOp.id); } }, origemLabel)
              : el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, origemLabel)),
          fieldBlock('Material recebido da tecelagem', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, window.fmtMetros(totalEnviado))),
          fieldBlock('Total ajustado da OP', el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, window.fmtMetros(totalEnviado))),
          fieldBlock('Metros aguardando inicio do acabamento', el('div', { style: 'font-size:14px;font-weight:700;color:var(--rv-color-accent);' }, window.fmtMetros(metrosAguardando)))));

        box.appendChild(el('div', { style: 'font-size:13px;font-weight:700;color:var(--rv-color-title);margin-bottom:8px;' }, 'Historico'));
        if (!origemEntregas.length) {
          box.appendChild(el('div', { style: 'font-size:13px;color:#aab2bf;' }, 'Nenhuma entrega de Tecelagem vinculada encontrada.'));
          return box;
        }

        box.appendChild(el('div', {},
          origemEntregas.map(function (ent) {
            var sub = el('div', { style: 'border-bottom:1px solid var(--rv-color-line-100);padding:14px 0;' });
            sub.appendChild(el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;' },
              el('div', { style: 'font-size:14px;font-weight:600;color:var(--rv-color-title);' }, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'))));
            if (ent.observacao) sub.appendChild(el('div', { style: 'font-size:12px;color:var(--rv-color-muted);margin-top:2px;' }, ent.observacao));
            origemEntregaItens(ent).forEach(function (ei) {
              sub.appendChild(el('div', { style: 'font-size:13.5px;color:#3f4757;margin-top:4px;' },
                origemItemLabel(ei) + ': ' + window.fmtMetros(ei.metros_entregues),
                ei.defeito ? el('span', { style: 'margin-left:8px;color:var(--rv-color-danger);font-weight:600;font-size:12.5px;' }, 'DEFEITO') : '',
                ei.observacao ? el('span', { style: 'margin-left:8px;font-size:12px;color:var(--rv-color-muted);' }, '(' + ei.observacao + ')') : ''));
            });
            return sub;
          })));
        return box;
      }

      function metricRow(label, value, color) {
        return el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;' },
          el('span', { style: 'font-size:12.5px;color:#5b6472;flex:1;min-width:0;' }, label),
          el('span', { style: 'font-size:15px;font-weight:700;color:' + (color || 'var(--rv-color-title)') + ';white-space:nowrap;font-variant-numeric:tabular-nums;' }, value));
      }

      function buildResumoRail() {
        var pct = totalEnviado > 0 ? Math.round((totalRecebido / totalEnviado) * 1000) / 10 : 0;
        var pctClamp = Math.max(0, Math.min(100, pct));
        return el('div', { style: CARD + 'padding:15px 17px;' },
          rvSectionPill('Movimentação da OP', IC_RESUMO),
          el('div', { style: 'display:flex;flex-direction:column;gap:11px;' },
            metricRow('Recebido da tecelagem', window.fmtMetros(totalEnviado), 'var(--rv-color-title)'),
            metricRow('Recebido no acabamento', window.fmtMetros(totalRecebido), '#a2aab6'),
            metricRow('Saldo aguardando', window.fmtMetros(metrosAguardando), metrosAguardando > 0 ? 'var(--rv-color-accent)' : 'var(--rv-color-success)')),
          el('div', { style: 'margin-top:14px;' },
            el('div', { style: 'height:6px;border-radius:var(--rv-radius-pill);background:#eef1f5;overflow:hidden;' },
              el('div', { style: 'height:100%;width:' + pctClamp + '%;background:var(--rv-color-accent);' })),
            el('div', { style: 'font-size:11.5px;color:#a2aab6;margin-top:6px;' }, String(pct).replace('.', ',') + '% recebido no acabamento')));
      }

      function buildConfirmarRail() {
        return el('div', { style: CARD + 'padding:15px 17px;' },
          rvSectionPill('Confirmar recebimento', IC_CHECK),
          el('button', {
            type: 'button',
            style: BTN_PRIMARY,
            onclick: async function (event) {
              var btn = event && event.currentTarget ? event.currentTarget : null;
              if (btn) btn.disabled = true;
              var ok = await confirmarEntradaAcabamento(op.id);
              if (!ok && btn) btn.disabled = false;
            },
          }, svgEl(SVG_FLAG_CHECK), 'Confirmar'),
          el('div', { style: 'font-size:11.5px;color:#a2aab6;margin-top:9px;line-height:1.45;' }, 'Confirma o recebimento do material vindo da Tecelagem e libera o início do acabamento.'));
      }

      container.replaceChildren(
        buildHeader(),
        el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) var(--rv-rail-w);gap:var(--rv-gap-cols);align-items:start;' },
          el('div', { style: 'min-width:0;display:flex;flex-direction:column;gap:14px;' },
            buildCardDados(),
            buildCardItens(),
            buildCardRecebimentos()),
          el('div', { style: 'min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:14px;' },
            buildResumoRail(),
            buildConfirmarRail())));
    }

    async function finalizar(id) {
      confirmDialog({
        title: 'Finalizar OP',
        message: 'Marcar esta OP de acabamento como concluida?',
        confirmLabel: 'Finalizar',
        onConfirm: async function () {
          var r = await supa.rpc('alterar_status_op', {
            p_op_id: id,
            p_novo_status: 'concluida',
            p_observacao: 'Finalizacao da OP Latex pelo painel administrativo',
          });
          if (r.error || (r.data && r.data.ok === false)) {
            var msg = r.error ? r.error.message : (r.data && r.data.erro ? r.data.erro : 'Transicao nao realizada');
            toast('Erro ao finalizar: ' + msg, 'error');
            console.error(r.error || r.data);
            return;
          }
          toast('OP de latex concluida', 'success');
          reload();
        },
      });
    }

    function editarEnviado(op, modelosById) {
      var linhas = (op.op_itens || []).map(function (it) {
        var m = modelosById[it.modelo_id];
        var rotulo = m
          ? (m.nome + ' ' + larguraKey(m.largura) + 'm · ' + (m.cor_1?.nome || '?') + '/' + (m.cor_2?.nome || '?'))
          : ('#' + it.modelo_id);
        var input = textInput({ type: 'number', step: '0.01', value: String(it.metros_pedidos) });
        return {
          id: it.id,
          input: input,
          node: el('div', { class: 'flex items-center gap-2 mb-2' },
            el('div', { class: 'flex-1 text-sm text-gray-700' }, rotulo),
            el('div', { class: 'w-32' }, formField({ label: 'Enviado (m)', input: input }))),
        };
      });

      modal({
        title: 'Editar enviado (manual)',
        body: el('div', {},
          el('p', { class: 'text-xs text-gray-500 mb-3' }, 'Ajuste os metros enviados por modelo.'),
          linhas.map(function (linha) { return linha.node; })),
        saveLabel: 'Salvar',
        onSave: async function () {
          for (var i = 0; i < linhas.length; i++) {
            var val = Number(linhas[i].input.value);
            if (!Number.isFinite(val) || val <= 0) {
              toast('Informe um valor maior que zero em todos os modelos', 'error');
              return false;
            }
          }
          for (var j = 0; j < linhas.length; j++) {
            var row = linhas[j];
            var r = await supa.from('op_itens').update({ metros_pedidos: Number(row.input.value) }).eq('id', row.id);
            if (r.error) {
              toast('Erro ao salvar enviado', 'error');
              console.error(r.error);
              return false;
            }
          }
          toast('Enviado atualizado', 'success');
          reload();
          return true;
        },
      });
    }

    function excluirOpLatex(id) {
      if (!window.RAVATEX_DELETE || typeof window.RAVATEX_DELETE.excluirOPComFluxo !== 'function') {
        toast('Exclusao controlada indisponivel.', 'error');
        return;
      }
      window.RAVATEX_DELETE.excluirOPComFluxo(id, async function () {
        navigate('#/ops');
      });
    }

    await reload();
    return shellLayout(ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opLatexAdmin = {
    renderOPLatexAdmin: renderOPLatexAdmin,
  };

  window.renderOPLatexAdmin = renderOPLatexAdmin;
})(window);
