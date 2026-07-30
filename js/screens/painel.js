// =====================================================================
// === SCREENS: PAINEL / ADMIN DASHBOARD ===============================
// Dashboard administrativo real da rota #/painel, alinhado ao standalone
// "Admin - Dashboard - standalone.html".
//
// Mantém o shell/topbar/sidebar globais de js/screens/common.js e faz
// somente leituras Supabase. Nenhuma escrita, RPC, migration ou mudança
// em fluxos Pedido/OP/Expedição.
// =====================================================================

(function (window) {
  'use strict';

  var ICONS = {
    pedidos: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><polyline points="14 3 14 8 19 8"></polyline>',
    clipboard: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line>',
    opDoc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 9.6H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9.4a1.6 1.6 0 0 0 1.5 1.1H21a2 2 0 0 1 0 4z"></path>',
    truck: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    triangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12" y2="17"></line>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    arrowRight: '<polyline points="9 6 15 12 9 18"></polyline>',
    warning: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line>'
  };

  var STATUS_LABELS = {
    rascunho: 'Rascunho',
    recebido: 'Recebido',
    confirmado: 'Confirmado',
    produzindo: 'Em produção',
    simulada: 'Simulada',
    aberta: 'Aberta',
    em_producao: 'Em produção',
    finalizada: 'Finalizada',
    concluida: 'Concluída',
    concluido: 'Concluído',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    cancelada: 'Cancelada',
    parcial: 'Parcial',
    liberada: 'Liberada'
  };

  // O painel NÃO declara tipografia própria: herda a fonte do produto
  // (index.html) e consome os tokens de css/tokens.css por PAPEL. Cor
  // semântica só permanece onde a condição viva realmente a possui —
  // estado de ciclo de vida, etapa de produção ou sinal operacional real.
  function dashboardCss() {
    return [
      '.rv-admin-dashboard{color:var(--rv-text-primary);margin:-2px 2px 0 2px;}',
      '.rv-admin-dashboard *{box-sizing:border-box;}',
      '.rv-admin-dashboard button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--rv-focus-ring);}',
      '.rv-adm-head{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px;}',
      '.rv-adm-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;width:100%;}',
      '.rv-adm-title{margin:0;font-size:var(--rv-fs-title);line-height:1.12;font-weight:800;color:var(--rv-text-title);letter-spacing:var(--rv-tracking-title);}',
      '.rv-adm-sub{font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);margin-top:5px;}',
      '.rv-adm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.rv-adm-btn{display:inline-flex;align-items:center;gap:7px;border-radius:var(--rv-radius);padding:0 14px;font-size:var(--rv-fs-body);font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;}',
      '.rv-adm-btn.secondary{height:var(--rv-h-default);background:var(--rv-surface);border:1px solid var(--rv-border-strong);color:var(--rv-text-secondary);}',
      '.rv-adm-btn.secondary:hover{background:var(--rv-surface-subtle);}',
      '.rv-adm-btn.primary{height:var(--rv-h-primary);background:var(--rv-brand);border:none;color:var(--rv-text-on-brand);font-weight:700;}',
      '.rv-adm-btn.primary:hover{background:var(--rv-brand-strong);}',
      '.rv-adm-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px;}',
      '.rv-adm-card{background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);}',
      '.rv-adm-kpi{padding:var(--rv-pad-card);min-width:0;}',
      '.rv-adm-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;}',
      '.rv-adm-icon{width:34px;height:34px;border-radius:var(--rv-radius);background:var(--rv-chip-bg);color:var(--rv-chip-glyph);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.rv-adm-kpi-value{font-size:var(--rv-fs-kpi-hero);font-weight:800;color:var(--rv-text-primary);line-height:.95;}',
      '.rv-adm-kpi-label{font-size:var(--rv-fs-body);font-weight:600;color:var(--rv-text-primary);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-kpi-sub{font-size:var(--rv-fs-xs);color:var(--rv-text-tertiary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-two{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(280px,1fr);gap:var(--rv-gap-cols);margin-bottom:18px;align-items:start;}',
      '.rv-adm-section{padding:0;overflow:hidden;}',
      '.rv-adm-section-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;border-bottom:1px solid var(--rv-border);}',
      '.rv-adm-chip{width:20px;height:20px;border-radius:var(--rv-radius);background:var(--rv-chip-bg);color:var(--rv-chip-glyph);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.rv-adm-section-title{font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);line-height:1.2;}',
      '.rv-adm-section-note{font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);flex-shrink:0;}',
      '.rv-adm-head-left{display:flex;align-items:center;gap:8px;min-width:0;}',
      '.rv-adm-action-row{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid var(--rv-border-soft);}',
      '.rv-adm-action-row:last-child{border-bottom:0;}',
      '.rv-adm-action-main{min-width:0;flex:1;}',
      '.rv-adm-action-line{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}',
      '.rv-adm-ref{font-size:var(--rv-fs-value);font-weight:700;color:var(--rv-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-action-title{font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-text-primary);min-width:0;}',
      '.rv-adm-action-sub{font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-action-side{text-align:right;flex-shrink:0;}',
      '.rv-adm-action-side>span{margin-top:4px;}',
      '.rv-adm-mini{font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-cta{flex-shrink:0;height:var(--rv-h-compact);border-radius:var(--rv-radius);border:1px solid var(--rv-border-strong);background:var(--rv-surface);color:var(--rv-text-secondary);font-size:var(--rv-fs-body);font-weight:600;font-family:inherit;padding:0 14px;cursor:pointer;white-space:nowrap;}',
      '.rv-adm-cta:hover{background:var(--rv-surface-subtle);}',
      '.rv-adm-alert{display:flex;align-items:flex-start;gap:11px;padding:12px 18px;border-bottom:1px solid var(--rv-border-soft);}',
      '.rv-adm-alert:last-child{border-bottom:0;}',
      '.rv-adm-alert>span:last-child{flex-shrink:0;}',
      '.rv-adm-dot{width:8px;height:8px;border-radius:var(--rv-radius-pill);margin-top:5px;flex-shrink:0;}',
      '.rv-adm-alert-title{font-size:var(--rv-fs-body);font-weight:600;color:var(--rv-text-primary);}',
      '.rv-adm-alert-sub{font-size:var(--rv-fs-xs);color:var(--rv-text-tertiary);margin-top:2px;line-height:1.35;}',
      '.rv-adm-alert-body{min-width:0;flex:1;}',
      '.rv-adm-pipeline{margin-bottom:18px;}',
      '.rv-adm-pipeline-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:stretch;padding:16px 18px;}',
      '.rv-adm-stage{position:relative;border:1px solid var(--rv-border);background:var(--rv-surface-subtle);border-radius:var(--rv-radius);padding:11px 12px;min-height:150px;}',
      '.rv-adm-stage.warn{background:var(--rv-signal-caution-bg);border-color:var(--rv-signal-caution-border);}',
      // The 10px grid gap spans between adjacent .rv-adm-stage BORDER boxes.
      // `position:relative` offsets resolve against the PADDING edge, and
      // box-sizing:border-box (declared above) insets that by the 1px
      // border, so `right:-11px` centred the arrow 3px left of the true gap
      // midpoint. `right:-14px` puts the 16px arrow's own midpoint exactly
      // on the gap midpoint; proved by rendered measurement, not by eye.
      '.rv-adm-stage-arrow{position:absolute;top:50%;right:-14px;transform:translateY(-50%);z-index:2;background:var(--rv-surface-subtle);color:var(--rv-text-tertiary);}',
      '.rv-adm-stage-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}',
      '.rv-adm-stage-title{font-size:var(--rv-fs-2xs);font-weight:700;letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);text-transform:uppercase;}',
      '.rv-adm-stage[data-rv-stage="tecelagem"] .rv-adm-stage-title{color:var(--rv-stage-tecelagem);}',
      '.rv-adm-stage[data-rv-stage="acabamento"] .rv-adm-stage-title{color:var(--rv-stage-acabamento);}',
      '.rv-adm-stage.warn .rv-adm-stage-title{color:var(--rv-signal-caution);}',
      '.rv-adm-stage-count{font-size:var(--rv-fs-metric);font-weight:800;color:var(--rv-text-primary);}',
      '.rv-adm-stage-badge{display:inline-flex;align-items:center;gap:4px;background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);color:var(--rv-signal-caution);border-radius:var(--rv-radius);padding:2px 7px;font-size:var(--rv-fs-micro);font-weight:700;margin-bottom:8px;}',
      '.rv-adm-stage-items{display:flex;flex-direction:column;gap:6px;}',
      '.rv-adm-stage-item{background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);padding:6px 8px;}',
      '.rv-adm-stage-primary{font-size:var(--rv-fs-xs);font-weight:600;color:var(--rv-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-stage-secondary{font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-activity-row{display:flex;align-items:center;gap:14px;padding:9px 18px;border-bottom:1px solid var(--rv-border-soft);}',
      '.rv-adm-activity-row:last-child{border-bottom:0;}',
      '.rv-adm-time{font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);font-variant-numeric:tabular-nums;width:96px;flex-shrink:0;white-space:nowrap;}',
      '.rv-adm-activity-text{font-size:var(--rv-fs-value);color:var(--rv-text-primary);line-height:1.35;}',
      '.rv-adm-history{background:none;border:0;color:var(--rv-accent-blue);font-size:var(--rv-fs-sm);font-weight:600;font-family:inherit;cursor:pointer;padding:0;}',
      '.rv-adm-empty{font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);padding:14px 18px;}',
      '.rv-adm-warning{display:flex;align-items:center;gap:7px;width:100%;min-height:var(--rv-h-default);box-sizing:border-box;color:var(--rv-signal-caution);background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);border-radius:var(--rv-radius);padding:0 14px;font-size:var(--rv-fs-sm);font-weight:700;}',
      '@media (max-width:1180px){.rv-adm-kpis{grid-template-columns:repeat(3,minmax(0,1fr));}.rv-adm-pipeline-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '@media (max-width:900px){.rv-adm-two{grid-template-columns:1fr;}.rv-adm-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.rv-adm-pipeline-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '@media (max-width:640px){.rv-admin-dashboard{margin:0;}.rv-adm-kpis,.rv-adm-pipeline-grid{grid-template-columns:1fr;}.rv-adm-action-row{align-items:flex-start;flex-wrap:wrap;}.rv-adm-action-main{flex-basis:100%;}.rv-adm-action-side{text-align:left;}.rv-adm-stage-arrow{display:none;}.rv-adm-activity-row{align-items:flex-start;flex-wrap:wrap;gap:8px 12px;}.rv-adm-time{width:auto;}.rv-adm-activity-text{flex-basis:100%;}.rv-adm-head{align-items:flex-start;}.rv-adm-actions{width:100%;}.rv-adm-btn{flex:1;justify-content:center;}}'
    ].join('');
  }

  function svgEl(markup, size, stroke) {
    var tmp = document.createElement('div');
    if (typeof tmp.innerHTML === 'undefined') return null;
    tmp.innerHTML = '<svg width="' + (size || 18) + '" height="' + (size || 18)
      + '" viewBox="0 0 24 24" fill="none" stroke="' + (stroke || 'currentColor')
      + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + markup + '</svg>';
    return tmp.firstElementChild || tmp.firstChild || null;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizar(value) {
    if (value == null) return '';
    return String(value).trim().toLowerCase();
  }

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function unique(values) {
    var seen = {};
    var result = [];
    safeArray(values).forEach(function (value) {
      if (value == null || seen[value]) return;
      seen[value] = true;
      result.push(value);
    });
    return result;
  }

  function fmtMetros(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' m';
  }

  function fmtNumeroPedido(pedido) {
    if (!pedido) return '#--';
    return '#' + (pedido.numero != null ? pedido.numero : pedido.id || '--');
  }

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: identidade canonica persistida.
  // O fallback inline para numero/ano foi REMOVIDO: era um segundo nome da
  // mesma OP, escolhido silenciosamente quando o contexto faltava.
  function fmtOp(op, ctx) {
    if (!op) return 'OP --';
    return window.RAVATEX_OP_DISPLAY.formatOpOperationalCode(op, ctx || {});
  }

  function fmtAcabamento(op, ctx) {
    if (!op) return 'Acab. --';
    return fmtOp(op, ctx).replace(/^OP /, 'Acab. ');
  }

  function labelStatus(value) {
    var key = normalizar(value);
    return STATUS_LABELS[key] || (value ? String(value) : '--');
  }

  function fmtDataHora(value) {
    if (!value) return '--';
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return '--';
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var hh = String(d.getHours()).padStart(2, '0');
      var mi = String(d.getMinutes()).padStart(2, '0');
      return dd + '/' + mm + ' às ' + hh + ':' + mi;
    } catch (_) {
      return '--';
    }
  }

  function fmtDataCurta(value) {
    if (!value) return '--';
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return '--';
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    } catch (_) {
      return '--';
    }
  }

  function diasDesde(value) {
    if (!value) return null;
    try {
      var d = new Date(value);
      if (isNaN(d.getTime())) return null;
      var diff = Date.now() - d.getTime();
      return Math.max(0, Math.floor(diff / 86400000));
    } catch (_) {
      return null;
    }
  }

  function tempoRelativo(value) {
    var dias = diasDesde(value);
    if (dias == null) return 'data não informada';
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'há 1 dia';
    if (dias < 30) return 'há ' + dias + ' dias';
    var meses = Math.floor(dias / 30);
    return meses === 1 ? 'há 1 mês' : 'há ' + meses + ' meses';
  }

  function sortByRecent(a, b) {
    var da = new Date(a && (a.atualizado_em || a.criado_em || a.liberado_em || 0)).getTime() || 0;
    var db = new Date(b && (b.atualizado_em || b.criado_em || b.liberado_em || 0)).getTime() || 0;
    return db - da;
  }

  function navigateTo(hash) {
    if (!hash) return;
    if (window.navigate) window.navigate(hash);
    else if (window.location) window.location.hash = hash;
  }

  function pedidoHref(pedido) {
    var id = pedido && pedido.id ? String(pedido.id) : '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return '#/pedidos/' + id;
    }
    return '#/pedidos';
  }

  async function queryRows(table, select, orders) {
    if (!window.supa || typeof window.supa.from !== 'function') {
      return { data: [], error: null, skipped: true };
    }
    try {
      var q = window.supa.from(table).select(select);
      safeArray(orders).forEach(function (order) {
        if (q && typeof q.order === 'function') {
          q = q.order(order.column, { ascending: !!order.ascending });
        }
      });
      var res = await q;
      return {
        data: safeArray(res && res.data),
        error: res && res.error ? res.error : null,
        skipped: false
      };
    } catch (e) {
      console.error('admin-dashboard: erro ao carregar ' + table, e);
      return { data: [], error: e, skipped: false };
    }
  }

  async function loadDashboardData() {
    var results = await Promise.all([
      queryRows('pedidos',
        'id, numero, status, cliente_id, prazo_entrega, criado_em, atualizado_em, metros_total, tipo_recebimento',
        [{ column: 'criado_em', ascending: false }]),
      queryRows('clientes',
        'id, nome',
        [{ column: 'nome', ascending: true }]),
      queryRows('lotes',
        'id, numero, pedido_id, cliente_id',
        [{ column: 'numero', ascending: true }]),
      queryRows('ops',
        'id, numero, ano, identidade_operacional, identidade_pedido_id, status, tipo, criado_em, atualizado_em, lote_id, origem_op_id, op_itens(id, metros_pedidos, metros_ajustados, pedido_item_id)',
        [{ column: 'ano', ascending: false }, { column: 'numero', ascending: false }]),
      queryRows('expedicoes',
        'id, pedido_id, op_latex_id, lote_id, cliente_id, status, liberado_em, criado_em, atualizado_em',
        [{ column: 'id', ascending: false }]),
      queryRows('expedicao_itens',
        'id, expedicao_id, metros_liberados, metros_entregues',
        []),
      queryRows('pedido_cliente_eventos',
        'id, pedido_id, status, titulo, mensagem, criado_em',
        [{ column: 'criado_em', ascending: false }])
    ]);

    var errors = [];
    ['pedidos', 'clientes', 'lotes', 'ops', 'expedicoes', 'expedicao_itens', 'pedido_cliente_eventos'].forEach(function (table, idx) {
      if (results[idx].error) errors.push(table);
    });

    return {
      pedidos: results[0].data,
      clientes: results[1].data,
      lotes: results[2].data,
      ops: results[3].data,
      expedicoes: results[4].data,
      expedicaoItens: results[5].data,
      eventos: results[6].data,
      errors: errors
    };
  }

  function isPedidoAberto(pedido) {
    var status = normalizar(pedido && pedido.status);
    return ['entregue', 'cancelado', 'cancelada', 'concluido', 'concluida'].indexOf(status) === -1;
  }

  function isPedidoConcluido(pedido) {
    var status = normalizar(pedido && pedido.status);
    return ['entregue', 'concluido', 'concluida'].indexOf(status) !== -1;
  }

  function isLatex(op) {
    return normalizar(op && op.tipo) === 'latex';
  }

  function isOpPreparacao(op) {
    var status = normalizar(op && op.status);
    return status === 'simulada' || status === 'aberta';
  }

  function isOpProducao(op) {
    return normalizar(op && op.status) === 'em_producao';
  }

  function isOpFinalizada(op) {
    var status = normalizar(op && op.status);
    return status === 'finalizada' || status === 'concluida' || status === 'concluido';
  }

  function isExpedicaoPendente(expedicao) {
    var status = normalizar(expedicao && expedicao.status);
    return ['concluida', 'concluido', 'entregue', 'cancelada', 'cancelado'].indexOf(status) === -1;
  }

  function clienteNome(pedido, clientesById) {
    if (!pedido) return 'Cliente não informado';
    var cliente = clientesById[pedido.cliente_id];
    return cliente && cliente.nome ? String(cliente.nome) : 'Cliente não informado';
  }

  function opMetros(op) {
    return safeArray(op && op.op_itens).reduce(function (acc, item) {
      return acc + num(item && (item.metros_ajustados != null ? item.metros_ajustados : item.metros_pedidos));
    }, 0);
  }

  function expedicaoSaldo(expedicao, itensByExpedicao) {
    var itens = safeArray(itensByExpedicao[expedicao && expedicao.id]);
    return itens.reduce(function (acc, item) {
      var liberado = num(item && item.metros_liberados);
      var entregue = num(item && item.metros_entregues);
      acc.liberado += liberado;
      acc.entregue += entregue;
      acc.saldo += Math.max(0, liberado - entregue);
      return acc;
    }, { liberado: 0, entregue: 0, saldo: 0 });
  }

  function buildView(state) {
    var clientesById = {};
    var lotesById = {};
    var lotesByPedido = {};
    var opsByPedido = {};
    var pedidoById = {};
    var expedicoesByOp = {};
    var expedicoesByPedido = {};
    var itensByExpedicao = {};

    safeArray(state.clientes).forEach(function (cliente) {
      if (cliente && cliente.id != null) clientesById[cliente.id] = cliente;
    });
    safeArray(state.pedidos).forEach(function (pedido) {
      if (pedido && pedido.id != null) pedidoById[pedido.id] = pedido;
    });
    safeArray(state.lotes).forEach(function (lote) {
      if (!lote || lote.id == null) return;
      lotesById[lote.id] = lote;
      if (lote.pedido_id != null) {
        if (!lotesByPedido[lote.pedido_id]) lotesByPedido[lote.pedido_id] = [];
        lotesByPedido[lote.pedido_id].push(lote);
      }
    });
    safeArray(state.ops).forEach(function (op) {
      var lote = op && op.lote_id != null ? lotesById[op.lote_id] : null;
      var pedidoId = lote && lote.pedido_id != null ? lote.pedido_id : null;
      if (pedidoId != null) {
        if (!opsByPedido[pedidoId]) opsByPedido[pedidoId] = [];
        opsByPedido[pedidoId].push(op);
      }
    });
    safeArray(state.expedicoes).forEach(function (expedicao) {
      if (!expedicao) return;
      if (expedicao.op_latex_id != null) {
        if (!expedicoesByOp[expedicao.op_latex_id]) expedicoesByOp[expedicao.op_latex_id] = [];
        expedicoesByOp[expedicao.op_latex_id].push(expedicao);
      }
      if (expedicao.pedido_id != null) {
        if (!expedicoesByPedido[expedicao.pedido_id]) expedicoesByPedido[expedicao.pedido_id] = [];
        expedicoesByPedido[expedicao.pedido_id].push(expedicao);
      }
    });
    safeArray(state.expedicaoItens).forEach(function (item) {
      if (!item || item.expedicao_id == null) return;
      if (!itensByExpedicao[item.expedicao_id]) itensByExpedicao[item.expedicao_id] = [];
      itensByExpedicao[item.expedicao_id].push(item);
    });

    function opDisplayContext(op) {
      var lote = op && op.lote_id != null ? lotesById[op.lote_id] : null;
      var pedidoId = lote && lote.pedido_id != null ? lote.pedido_id : null;
      var pedido = pedidoId != null ? pedidoById[pedidoId] : null;
      if (!pedido) return null;
      return { pedido: pedido, ops: safeArray(opsByPedido[pedidoId]) };
    }

    var pedidosAbertos = safeArray(state.pedidos).filter(isPedidoAberto);
    var pedidosSemOp = pedidosAbertos.filter(function (pedido) {
      return !safeArray(opsByPedido[pedido.id]).length;
    });
    var opsPreparacao = safeArray(state.ops).filter(isOpPreparacao);
    var opsProducao = safeArray(state.ops).filter(isOpProducao);
    var opsTecelagemProducao = opsProducao.filter(function (op) { return !isLatex(op); });
    var opsAcabamento = safeArray(state.ops).filter(function (op) {
      return isLatex(op) && (isOpPreparacao(op) || isOpProducao(op));
    });
    var latexProntasSemExpedicao = safeArray(state.ops).filter(function (op) {
      return isLatex(op) && isOpFinalizada(op) && !safeArray(expedicoesByOp[op.id]).length;
    });
    var expedicoesPendentes = safeArray(state.expedicoes).filter(isExpedicaoPendente);
    var expedicoesParciais = expedicoesPendentes.filter(function (expedicao) {
      return expedicaoSaldo(expedicao, itensByExpedicao).saldo > 0;
    });
    var pedidosConcluidos = safeArray(state.pedidos).filter(isPedidoConcluido);
    var tecelagemProntas = safeArray(state.ops).filter(function (op) {
      return !isLatex(op) && isOpFinalizada(op);
    });
    var latexAbertas = safeArray(state.ops).filter(function (op) {
      return isLatex(op) && normalizar(op.status) === 'aberta';
    });

    var actionRows = [];
    var pedidoSemOp = pedidosSemOp.slice().sort(sortByRecent)[0];
    if (pedidoSemOp) {
      actionRows.push({
        type: 'PEDIDO',
        ref: fmtNumeroPedido(pedidoSemOp),
        title: 'Abrir OP de Tecelagem',
        sub: clienteNome(pedidoSemOp, clientesById) + ' - recebido ' + tempoRelativo(pedidoSemOp.criado_em),
        meta: pedidoSemOp.metros_total ? fmtMetros(pedidoSemOp.metros_total) : 'Sem metragem',
        // "Sem OP" é uma condição derivada da fila, não um estado de ciclo
        // de vida persistido: classificação, não pílula de status.
        status: 'Sem OP',
        statusState: null,
        cta: 'Abrir OP',
        href: '#/ops/nova?pedido_id=' + encodeURIComponent(pedidoSemOp.id)
      });
    }

    var tecPronta = tecelagemProntas.slice().sort(sortByRecent)[0];
    if (tecPronta) {
      actionRows.push({
        type: 'OP',
        ref: fmtOp(tecPronta, opDisplayContext(tecPronta)).replace(/^OP /, ''),
        title: 'Transferir para Acabamento',
        sub: 'Tecelagem finalizada - ' + tempoRelativo(tecPronta.atualizado_em || tecPronta.criado_em),
        meta: fmtMetros(opMetros(tecPronta)),
        status: 'Pronta',
        statusState: tecPronta.status,
        cta: 'Resolver',
        href: '#/ops/' + tecPronta.id
      });
    }

    var latexAberta = latexAbertas.slice().sort(sortByRecent)[0];
    if (latexAberta) {
      actionRows.push({
        type: 'OP',
        ref: fmtAcabamento(latexAberta, opDisplayContext(latexAberta)),
        title: 'Confirmar entrada em Acabamento',
        sub: 'OP de látex aberta - ' + tempoRelativo(latexAberta.criado_em),
        meta: fmtMetros(opMetros(latexAberta)),
        status: 'Em trânsito',
        statusState: latexAberta.status,
        cta: 'Confirmar',
        href: '#/ops/' + latexAberta.id
      });
    }

    var parcial = expedicoesParciais.slice().sort(sortByRecent)[0];
    if (parcial) {
      var saldo = expedicaoSaldo(parcial, itensByExpedicao);
      actionRows.push({
        type: 'EXPEDICAO',
        ref: '#' + parcial.id,
        title: 'Registrar entrega parcial',
        sub: 'Expedicao com saldo pendente - ' + tempoRelativo(parcial.atualizado_em || parcial.criado_em),
        meta: fmtMetros(saldo.entregue) + ' / ' + fmtMetros(saldo.liberado),
        // "Parcial" é um estado regido pelo dono canônico (família caution);
        // o roxo anterior era um token de ETAPA usado como status.
        status: 'Parcial',
        statusState: 'parcial',
        cta: 'Resolver',
        href: '#/expedicoes/' + parcial.id
      });
    }

    var pedidoConcluido = pedidosConcluidos.slice().sort(sortByRecent)[0];
    if (pedidoConcluido) {
      actionRows.push({
        type: 'PEDIDO',
        ref: fmtNumeroPedido(pedidoConcluido),
        title: 'Conferir pedido concluído',
        sub: clienteNome(pedidoConcluido, clientesById) + ' - atualizado ' + tempoRelativo(pedidoConcluido.atualizado_em || pedidoConcluido.criado_em),
        meta: pedidoConcluido.metros_total ? fmtMetros(pedidoConcluido.metros_total) : 'Sem metragem',
        status: 'Pronto',
        statusState: pedidoConcluido.status,
        cta: 'Ver pedido',
        href: pedidoHref(pedidoConcluido)
      });
    }

    // Alertas são condições operacionais VIVAS, calculadas do estado atual —
    // não registros persistidos de alerta (§2.11), por isso não usam a família
    // --rv-alert-*. A severidade fica no ponto; o rótulo é classificação.
    var alerts = [];
    if (pedidosSemOp.length) {
      alerts.push({
        severity: 'caution',
        title: 'Pedido sem OP',
        sub: pedidosSemOp.length + ' pedido(s) aberto(s) ainda não tem OP vinculada.',
        tag: 'Bloqueio'
      });
    }
    var prepParadas = opsPreparacao.filter(function (op) {
      var dias = diasDesde(op && (op.atualizado_em || op.criado_em));
      return dias != null && dias >= 5;
    });
    if (prepParadas.length) {
      alerts.push({
        severity: 'negative',
        title: 'OP parada em preparação',
        sub: prepParadas.length + ' OP(s) sem avanço há 5 dias ou mais.',
        tag: '5 dias'
      });
    }
    if (latexProntasSemExpedicao.length) {
      alerts.push({
        severity: 'caution',
        title: 'Acabamento sem expedição',
        sub: latexProntasSemExpedicao.length + ' OP(s) de acabamento pronta(s) aguardam expedição.',
        tag: 'Atenção'
      });
    }
    if (expedicoesParciais.length) {
      alerts.push({
        severity: 'caution',
        title: 'Entrega parcial pendente',
        sub: expedicoesParciais.length + ' expedição(ões) tem saldo de entrega em aberto.',
        tag: 'Info'
      });
    }
    if (safeArray(state.errors).length) {
      alerts.push({
        severity: 'neutral',
        title: 'Fonte auxiliar indisponível',
        sub: 'Alguns dados não carregaram: ' + state.errors.join(', ') + '.',
        tag: 'Dados'
      });
    }

    function pedidoStageItem(pedido) {
      return {
        primary: fmtNumeroPedido(pedido) + ' - ' + clienteNome(pedido, clientesById),
        secondary: labelStatus(pedido && pedido.status)
      };
    }

    function opStageItem(op) {
      return {
        primary: fmtOp(op, opDisplayContext(op)),
        secondary: labelStatus(op && op.status) + (opMetros(op) ? ' - ' + fmtMetros(opMetros(op)) : '')
      };
    }

    function expedicaoStageItem(expedicao) {
      var pedido = expedicao && expedicao.pedido_id != null ? pedidoById[expedicao.pedido_id] : null;
      return {
        primary: 'Exp. #' + (expedicao && expedicao.id != null ? expedicao.id : '--'),
        secondary: pedido ? fmtNumeroPedido(pedido) + ' - ' + labelStatus(expedicao.status) : labelStatus(expedicao && expedicao.status)
      };
    }

    var stages = [
      {
        title: 'Pedidos',
        count: pedidosAbertos.length,
        items: pedidosAbertos.slice().sort(sortByRecent).slice(0, 3).map(pedidoStageItem)
      },
      {
        title: 'OP Aberta',
        count: opsPreparacao.length,
        items: opsPreparacao.slice().sort(sortByRecent).slice(0, 3).map(opStageItem)
      },
      {
        title: 'Tecelagem',
        count: opsTecelagemProducao.length,
        tone: opsTecelagemProducao.length >= opsAcabamento.length + 2 ? 'warn' : '',
        badge: opsTecelagemProducao.length >= opsAcabamento.length + 2 ? 'Gargalo' : '',
        items: opsTecelagemProducao.slice().sort(sortByRecent).slice(0, 3).map(opStageItem)
      },
      {
        title: 'Acabamento',
        count: opsAcabamento.length,
        items: opsAcabamento.slice().sort(sortByRecent).slice(0, 3).map(opStageItem)
      },
      {
        title: 'Expedição',
        count: expedicoesPendentes.length,
        items: expedicoesPendentes.slice().sort(sortByRecent).slice(0, 3).map(expedicaoStageItem)
      },
      {
        title: 'Concluído',
        count: pedidosConcluidos.length,
        items: pedidosConcluidos.slice().sort(sortByRecent).slice(0, 3).map(pedidoStageItem)
      }
    ];
    stages.forEach(function (stage, idx) {
      stage.showArrow = idx < stages.length - 1;
    });

    var activities = [];
    safeArray(state.eventos).slice(0, 4).forEach(function (evento) {
      var pedido = evento && evento.pedido_id != null ? pedidoById[evento.pedido_id] : null;
      activities.push({
        when: fmtDataCurta(evento && evento.criado_em),
        text: (pedido ? fmtNumeroPedido(pedido) + ': ' : '') + (evento.mensagem || evento.titulo || 'Atualizacao de pedido registrada.')
      });
    });
    safeArray(state.pedidos).slice().sort(sortByRecent).slice(0, 3).forEach(function (pedido) {
      activities.push({
        when: fmtDataCurta(pedido && (pedido.atualizado_em || pedido.criado_em)),
        text: fmtNumeroPedido(pedido) + ' - ' + clienteNome(pedido, clientesById) + ' esta como ' + labelStatus(pedido && pedido.status) + '.'
      });
    });
    safeArray(state.ops).slice().sort(sortByRecent).slice(0, 3).forEach(function (op) {
      activities.push({
        when: fmtDataCurta(op && (op.atualizado_em || op.criado_em)),
        text: fmtOp(op, opDisplayContext(op)) + ' atualizada para ' + labelStatus(op && op.status) + '.'
      });
    });

    return {
      updatedAt: state.updatedAt,
      loading: state.loading,
      errors: safeArray(state.errors),
      // Um KPI é uma MEDIDA categórica, não uma severidade: as cinco
      // superfícies de ícone tomam o chip neutro canônico e o indicador de
      // apoio é uma classificação. A hierarquia fica no número KPI_HERO.
      kpis: [
        {
          icon: ICONS.pedidos,
          label: 'Pedidos em aberto',
          value: pedidosAbertos.length,
          trend: pedidosSemOp.length ? '+' + pedidosSemOp.length : 'ok',
          sub: pedidosSemOp.length + ' aguardam primeira OP'
        },
        {
          icon: ICONS.opDoc,
          label: 'OPs em preparação',
          value: opsPreparacao.length,
          trend: tecelagemProntas.length ? tecelagemProntas.length + ' p/ liberar' : 'fila limpa',
          sub: prepParadas.length + ' parada(s) há 5 dias'
        },
        {
          icon: ICONS.gear,
          label: 'OPs em produção',
          value: opsProducao.length,
          trend: opsProducao.length ? 'ativo' : 'sem fila',
          sub: 'Tecelagem e Acabamento'
        },
        {
          icon: ICONS.truck,
          label: 'Aguardando expedição',
          value: latexProntasSemExpedicao.length,
          trend: latexProntasSemExpedicao.length ? latexProntasSemExpedicao.length + ' pronta(s)' : 'ok',
          sub: expedicoesPendentes.length + ' expedição(ões) em aberto'
        },
        {
          icon: ICONS.triangle,
          label: 'Entregas pendentes',
          value: unique(expedicoesParciais.map(function (e) { return e.id; })).length,
          trend: expedicoesParciais.length ? 'atenção' : 'ok',
          sub: expedicoesParciais.length + ' parcial(is) em aberto'
        }
      ],
      actions: actionRows.slice(0, 5),
      alerts: alerts.slice(0, 5),
      stages: stages,
      activities: activities.slice(0, 7)
    };
  }

  function styleNode() {
    return window.el('style', {}, dashboardCss());
  }

  function icon(markup, size, stroke) {
    return svgEl(markup, size, stroke);
  }

  // Rótulos, categorias e contagens não semânticas são CLASSIFICAÇÕES
  // (UI_VISUAL_CONTRACT.md §2.6.1): família neutra, sem ponto de status.
  function badge(text) {
    return window.rvClassificationBadge(String(text == null ? '' : text));
  }

  // O ponto do alerta é o único lugar do painel onde a cor ainda carrega
  // severidade, e ela vem da condição viva — não de um nome de tom antigo.
  var ALERT_DOT = {
    caution: 'var(--rv-signal-caution)',
    negative: 'var(--rv-signal-negative)',
    neutral: 'var(--rv-text-tertiary)'
  };

  // Somente Tecelagem e Acabamento são ETAPAS DE PRODUÇÃO (§2.7); os demais
  // passos da cadeia são marcos de ciclo de vida e não recebem token de etapa.
  var STAGE_KEY = { 'Tecelagem': 'tecelagem', 'Acabamento': 'acabamento' };

  function actionButton(label, href, primary, iconMarkup) {
    return window.el('button', {
      type: 'button',
      class: 'rv-adm-btn ' + (primary ? 'primary' : 'secondary'),
      onclick: function () { navigateTo(href); }
    }, iconMarkup ? icon(iconMarkup, 15) : null, label);
  }

  function buildHeader(view) {
    var subtitle = view.loading
      ? 'Visão geral da produção e pedidos · atualizando dados'
      : 'Visão geral da produção e pedidos · atualizado ' + fmtDataHora(view.updatedAt);
    // D12: a standalone notice is its own full-width information surface —
    // never nested inside the title block, never sized to its own text.
    var warn = !view.loading && view.errors.length
      ? window.el('div', { class: 'rv-adm-warning' },
        icon(ICONS.warning, 14, 'var(--rv-signal-caution)'),
        'Algumas fontes auxiliares não carregaram')
      : null;

    return window.el('div', { class: 'rv-adm-head' },
      window.el('div', { class: 'rv-adm-head-row' },
        window.el('div', {},
          window.el('h1', { class: 'rv-adm-title' }, 'Dashboard'),
          window.el('div', { class: 'rv-adm-sub' }, subtitle)
        ),
        window.el('div', { class: 'rv-adm-actions' },
          actionButton('Ver pedidos', '#/pedidos', false),
          actionButton('Ver OPs', '#/ops', false),
          actionButton('Novo pedido', '#/pedidos/novo', true, ICONS.plus)
        )
      ),
      warn
    );
  }

  function buildKpi(card) {
    var value = card.loading ? '--' : card.value;
    return window.el('div', { class: 'rv-adm-card rv-adm-kpi' },
      window.el('div', { class: 'rv-adm-kpi-top' },
        window.el('div', { class: 'rv-adm-icon' }, icon(card.icon, 18)),
        badge(card.trend)
      ),
      window.el('div', { class: 'rv-adm-kpi-value' }, String(value)),
      window.el('div', { class: 'rv-adm-kpi-label' }, card.label),
      window.el('div', { class: 'rv-adm-kpi-sub' }, card.sub)
    );
  }

  function buildKpis(view) {
    return window.el('div', { class: 'rv-adm-kpis' }, view.kpis.map(function (kpi) {
      return buildKpi(Object.assign({}, kpi, { loading: view.loading }));
    }));
  }

  // Toda seção abre com o chip de ícone canônico de 20px (§2.4). A barra
  // vertical colorida que existia aqui é explicitamente proibida em seu lugar.
  function sectionHead(iconMarkup, title, right, extraLeft) {
    return window.el('div', { class: 'rv-adm-section-head' },
      window.el('div', { class: 'rv-adm-head-left' },
        window.el('span', { class: 'rv-adm-chip' }, icon(iconMarkup, 13)),
        window.el('span', { class: 'rv-adm-section-title' }, title),
        extraLeft || null
      ),
      right || null
    );
  }

  function actionRow(row) {
    return window.el('div', { class: 'rv-adm-action-row' },
      window.el('div', { class: 'rv-adm-action-main' },
        window.el('div', { class: 'rv-adm-action-line' },
          badge(row.type),
          window.el('span', { class: 'rv-adm-ref' }, row.ref),
          window.el('span', { class: 'rv-adm-action-title' }, row.title)
        ),
        window.el('div', { class: 'rv-adm-action-sub' }, row.sub)
      ),
      window.el('div', { class: 'rv-adm-action-side' },
        window.el('div', { class: 'rv-adm-mini' }, row.meta),
        // Pílula de status só quando existe um estado de ciclo de vida real
        // persistido por trás do rótulo; caso contrário é classificação.
        row.statusState
          ? window.rvStatusPill(row.status, row.statusState)
          : badge(row.status)
      ),
      window.el('button', {
        type: 'button',
        class: 'rv-adm-cta',
        onclick: function () { navigateTo(row.href); }
      }, row.cta)
    );
  }

  function alertRow(row) {
    return window.el('div', { class: 'rv-adm-alert' },
      window.el('span', {
        class: 'rv-adm-dot',
        style: 'background:' + (ALERT_DOT[row.severity] || ALERT_DOT.neutral) + ';'
      }),
      window.el('div', { class: 'rv-adm-alert-body' },
        window.el('div', { class: 'rv-adm-alert-title' }, row.title),
        window.el('div', { class: 'rv-adm-alert-sub' }, row.sub)
      ),
      badge(row.tag || 'Info')
    );
  }

  function buildActions(view) {
    var body = view.loading
      ? [window.el('div', { class: 'rv-adm-empty' }, 'Carregando fila operacional...')]
      : (view.actions.length ? view.actions.map(actionRow)
        : [window.el('div', { class: 'rv-adm-empty' }, 'Sem ações operacionais pendentes no momento.')]);

    var head = sectionHead(ICONS.clipboard, 'Fila de ações',
      window.el('span', { class: 'rv-adm-section-note' }, 'Prioridade'),
      badge(view.loading ? '-- pendentes' : view.actions.length + ' pendentes'));

    return window.el('div', { class: 'rv-adm-card rv-adm-section' },
      head,
      body
    );
  }

  function buildAlerts(view) {
    var body = view.loading
      ? [window.el('div', { class: 'rv-adm-empty' }, 'Carregando alertas...')]
      : (view.alerts.length ? view.alerts.map(alertRow)
        : [window.el('div', { class: 'rv-adm-empty' }, 'Sem alertas operacionais no momento.')]);

    var head = sectionHead(ICONS.triangle, 'Alertas',
      badge(view.loading ? '--' : String(view.alerts.length)));

    return window.el('div', { class: 'rv-adm-card rv-adm-section' },
      head,
      body
    );
  }

  function buildActionAlerts(view) {
    return window.el('div', { class: 'rv-adm-two' },
      buildActions(view),
      buildAlerts(view)
    );
  }

  function stageCard(stage) {
    var attrs = { class: 'rv-adm-stage' + (stage.tone ? ' ' + stage.tone : '') };
    if (STAGE_KEY[stage.title]) attrs['data-rv-stage'] = STAGE_KEY[stage.title];
    var items = stage.items && stage.items.length ? stage.items : [{ primary: 'Sem itens', secondary: 'Fila vazia' }];
    return window.el('div', attrs,
      stage.showArrow ? window.el('span', { class: 'rv-adm-stage-arrow' }, icon(ICONS.arrowRight, 16, 'var(--rv-text-tertiary)')) : null,
      window.el('div', { class: 'rv-adm-stage-head' },
        window.el('div', { class: 'rv-adm-stage-title' }, stage.title),
        window.el('span', { class: 'rv-adm-stage-count' }, String(stage.count))
      ),
      stage.badge ? window.el('div', { class: 'rv-adm-stage-badge' },
        icon('<line x1="12" y1="2" x2="12" y2="12"></line><path d="M5 8a7 7 0 0 0 14 0"></path>', 10, 'currentColor'),
        stage.badge
      ) : null,
      window.el('div', { class: 'rv-adm-stage-items' },
        items.map(function (item) {
          return window.el('div', { class: 'rv-adm-stage-item' },
            window.el('div', { class: 'rv-adm-stage-primary' }, item.primary),
            window.el('div', { class: 'rv-adm-stage-secondary' }, item.secondary)
          );
        })
      )
    );
  }

  function buildPipeline(view) {
    return window.el('div', { class: 'rv-adm-card rv-adm-section rv-adm-pipeline' },
      sectionHead(ICONS.gear, 'Cadeia produtiva',
        window.el('span', { class: 'rv-adm-section-note' }, 'Fluxo do pedido à conclusão')),
      window.el('div', { class: 'rv-adm-pipeline-grid' }, view.stages.map(stageCard))
    );
  }

  function activityRow(row) {
    return window.el('div', { class: 'rv-adm-activity-row' },
      window.el('div', { class: 'rv-adm-time' }, row.when),
      window.el('div', { class: 'rv-adm-activity-text' }, row.text)
    );
  }

  function buildActivity(view) {
    var rows = view.loading
      ? [window.el('div', { class: 'rv-adm-empty' }, 'Carregando atividade recente...')]
      : (view.activities.length ? view.activities.map(activityRow)
        : [window.el('div', { class: 'rv-adm-empty' }, 'A atividade recente aparecerá aqui quando houver movimentações.')]);

    var historico = window.el('button', {
      type: 'button',
      class: 'rv-adm-history',
      onclick: function () { navigateTo('#/pedidos'); }
    }, 'Ver histórico');

    return window.el('div', { class: 'rv-adm-card rv-adm-section' },
      sectionHead(ICONS.check, 'Atividade recente', historico),
      rows
    );
  }

  function renderDashboard(container, state) {
    var view = buildView(state);
    container.replaceChildren(
      styleNode(),
      buildHeader(view),
      buildKpis(view),
      buildActionAlerts(view),
      buildPipeline(view),
      buildActivity(view)
    );
  }

  function screenPainel() {
    var container = window.el('div', {
      class: 'rv-admin-dashboard'
    });

    var state = {
      loading: true,
      pedidos: [],
      clientes: [],
      lotes: [],
      ops: [],
      expedicoes: [],
      expedicaoItens: [],
      eventos: [],
      errors: [],
      updatedAt: new Date()
    };

    renderDashboard(container, state);

    loadDashboardData().then(function (data) {
      state.loading = false;
      state.pedidos = data.pedidos;
      state.clientes = data.clientes;
      state.lotes = data.lotes;
      state.ops = data.ops;
      state.expedicoes = data.expedicoes;
      state.expedicaoItens = data.expedicaoItens;
      state.eventos = data.eventos;
      state.errors = data.errors;
      state.updatedAt = new Date();
      renderDashboard(container, state);
    }).catch(function (e) {
      console.error('admin-dashboard: erro inesperado', e);
      state.loading = false;
      state.errors = ['dashboard'];
      state.updatedAt = new Date();
      renderDashboard(container, state);
    });

    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.painel = {
    screenPainel: screenPainel
  };

  window.screenPainel = screenPainel;
})(window);
