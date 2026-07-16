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

  function dashboardCss() {
    return [
      '@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap");',
      '.rv-admin-dashboard{font-family:"Hanken Grotesk",Inter,"Segoe UI",Arial,sans-serif;color:#16203a;margin:-2px 2px 0 2px;}',
      '.rv-admin-dashboard *{box-sizing:border-box;}',
      '.rv-adm-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px;flex-wrap:wrap;}',
      '.rv-adm-title{margin:0;font-size:23px;line-height:1.12;font-weight:800;color:#16203a;letter-spacing:0;}',
      '.rv-adm-sub{font-size:13.5px;color:#8a93a3;margin-top:5px;}',
      '.rv-adm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.rv-adm-btn{height:36px;display:inline-flex;align-items:center;gap:8px;border-radius:4px;padding:0 14px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;}',
      '.rv-adm-btn.secondary{background:#fff;border:1px solid #d8dce2;color:#3f4757;}',
      '.rv-adm-btn.primary{background:#2563eb;border:1px solid #2563eb;color:#fff;}',
      '.rv-adm-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px;}',
      '.rv-adm-card{background:#fff;border:1px solid #eceef1;border-radius:6px;box-shadow:0 1px 2px rgba(20,30,45,.04);}',
      '.rv-adm-kpi{padding:15px 16px;min-width:0;}',
      '.rv-adm-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;}',
      '.rv-adm-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.rv-adm-kpi-value{font-size:30px;font-weight:800;color:#16203a;line-height:.95;}',
      '.rv-adm-kpi-label{font-size:13px;font-weight:600;color:#3f4757;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-kpi-sub{font-size:12px;color:#9aa2af;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-pill{display:inline-flex;align-items:center;gap:3px;border-radius:99px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap;}',
      '.rv-adm-two{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(280px,1fr);gap:16px;margin-bottom:18px;align-items:start;}',
      '.rv-adm-section{padding:0;overflow:hidden;}',
      '.rv-adm-section-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:0;padding:14px 18px;border-bottom:1px solid #eceef1;}',
      '.rv-adm-section-title{font-size:15px;font-weight:700;color:#16203a;line-height:1.2;}',
      '.rv-adm-section-sub{font-size:12.5px;color:#8a93a3;margin-top:3px;}',
      '.rv-adm-head-left{display:flex;align-items:center;gap:9px;min-width:0;}',
      '.rv-adm-action-row{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid #f4f5f7;}',
      '.rv-adm-action-row:last-child{border-bottom:0;}',
      '.rv-adm-bar{width:4px;height:38px;border-radius:99px;background:#2563eb;flex-shrink:0;}',
      '.rv-adm-action-main{min-width:0;flex:1;}',
      '.rv-adm-action-line{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}',
      '.rv-adm-type{display:inline-flex;align-items:center;border-radius:4px;background:#f1f3f6;color:#8a93a3;padding:2px 7px;font-size:11px;font-weight:700;letter-spacing:0;}',
      '.rv-adm-ref{font-size:13.5px;font-weight:700;color:#2563eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-action-title{font-size:13.5px;font-weight:600;color:#16203a;min-width:0;}',
      '.rv-adm-action-sub{font-size:12.5px;color:#8a93a3;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-action-side{text-align:right;flex-shrink:0;}',
      '.rv-adm-action-side .rv-adm-pill{margin-top:4px;}',
      '.rv-adm-mini{font-size:13px;color:#3f4757;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-cta{flex-shrink:0;border-radius:4px;border:1px solid #bcd3f7;background:#fff;color:#2563eb;font-size:13px;font-weight:600;font-family:inherit;padding:8px 14px;cursor:pointer;white-space:nowrap;}',
      '.rv-adm-cta.primary{border-color:#2563eb;background:#2563eb;color:#fff;}',
      '.rv-adm-cta.neutral{border-color:#d8dce2;color:#5b6472;}',
      '.rv-adm-alert{display:flex;align-items:flex-start;gap:11px;padding:12px 18px;border-bottom:1px solid #f4f5f7;cursor:pointer;}',
      '.rv-adm-alert:last-child{border-bottom:0;}',
      '.rv-adm-dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex-shrink:0;}',
      '.rv-adm-alert .rv-adm-dot{width:8px;height:8px;}',
      '.rv-adm-alert-title{font-size:13px;font-weight:600;color:#26303f;}',
      '.rv-adm-alert-sub{font-size:12px;color:#8a93a3;margin-top:2px;line-height:1.35;}',
      '.rv-adm-alert-body{min-width:0;flex:1;}',
      '.rv-adm-alert-tag{flex-shrink:0;border-radius:99px;padding:1px 7px;font-size:11px;font-weight:700;}',
      '.rv-adm-pipeline{padding:16px 18px;margin-bottom:18px;}',
      '.rv-adm-pipeline-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:stretch;}',
      '.rv-adm-stage{position:relative;border:1px solid #eceef1;background:#f8f9fb;border-radius:6px;padding:11px 12px;min-height:150px;}',
      '.rv-adm-stage.warn{background:#fff8ef;border-color:#f0d9b8;}',
      '.rv-adm-stage.done{background:#f4faf6;border-color:#dcefe3;}',
      '.rv-adm-stage-arrow{position:absolute;top:50%;right:-11px;transform:translateY(-50%);z-index:2;background:#f6f7f9;color:#c5cad4;}',
      '.rv-adm-stage-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}',
      '.rv-adm-stage-title{font-size:11.5px;font-weight:700;letter-spacing:0;color:#8a93a3;text-transform:uppercase;}',
      '.rv-adm-stage.warn .rv-adm-stage-title{color:#b45309;}',
      '.rv-adm-stage.done .rv-adm-stage-title{color:#18794a;}',
      '.rv-adm-stage-count{font-size:16px;font-weight:800;color:#16203a;}',
      '.rv-adm-stage-badge{display:inline-flex;align-items:center;gap:4px;background:#fff4e6;color:#b45309;border-radius:4px;padding:2px 7px;font-size:10.5px;font-weight:700;margin-bottom:8px;}',
      '.rv-adm-stage-items{display:flex;flex-direction:column;gap:6px;}',
      '.rv-adm-stage-item{background:#fff;border:1px solid #eceef1;border-radius:4px;padding:6px 8px;}',
      '.rv-adm-stage-primary{font-size:12px;font-weight:600;color:#26303f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-stage-secondary{font-size:11px;color:#9aa2af;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.rv-adm-activity{padding:16px 18px 8px;}',
      '.rv-adm-activity .rv-adm-section-head{padding:0;border-bottom:0;margin-bottom:6px;}',
      '.rv-adm-activity-row{display:flex;align-items:center;gap:14px;padding:9px 0;border-bottom:1px solid #f4f5f7;}',
      '.rv-adm-activity-row:last-child{border-bottom:0;}',
      '.rv-adm-time{font-size:12.5px;color:#9aa2af;font-variant-numeric:tabular-nums;width:96px;flex-shrink:0;white-space:nowrap;}',
      '.rv-adm-activity-text{font-size:13.5px;color:#3f4757;line-height:1.35;}',
      '.rv-adm-history{background:none;border:0;color:#2563eb;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;padding:0;}',
      '.rv-adm-empty{font-size:13px;color:#9aa2af;padding:14px 18px;}',
      '.rv-adm-warning{display:inline-flex;align-items:center;gap:7px;color:#9a6b15;background:#fff8ef;border:1px solid #f0d9b8;border-radius:4px;padding:6px 9px;font-size:12.5px;font-weight:700;margin-top:10px;}',
      '@media (max-width:1180px){.rv-adm-kpis{grid-template-columns:repeat(3,minmax(0,1fr));}.rv-adm-pipeline-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '@media (max-width:900px){.rv-adm-two{grid-template-columns:1fr;}.rv-adm-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.rv-adm-pipeline-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '@media (max-width:640px){.rv-admin-dashboard{margin:0;}.rv-adm-kpis,.rv-adm-pipeline-grid{grid-template-columns:1fr;}.rv-adm-action-row{align-items:flex-start;flex-wrap:wrap;}.rv-adm-action-main{flex-basis:calc(100% - 18px);}.rv-adm-action-side{text-align:left;margin-left:18px;}.rv-adm-cta{margin-left:18px;}.rv-adm-stage-arrow{display:none;}.rv-adm-activity-row{align-items:flex-start;flex-wrap:wrap;gap:8px 12px;}.rv-adm-time{width:auto;}.rv-adm-activity-text{flex-basis:100%;padding-left:21px;}.rv-adm-head{align-items:flex-start;}.rv-adm-actions{width:100%;}.rv-adm-btn{flex:1;justify-content:center;}}'
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

  function fmtOp(op, ctx) {
    if (!op) return 'OP --';
    var api = window.RAVATEX_OP_DISPLAY;
    if (api && typeof api.formatOpOperationalCode === 'function') {
      return api.formatOpOperationalCode(op, ctx || {});
    }
    var numero = op.numero != null ? op.numero : '--';
    return 'OP ' + numero + (op.ano ? '/' + op.ano : '');
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
        'id, numero, ano, status, tipo, criado_em, atualizado_em, lote_id, origem_op_id, op_itens(id, metros_pedidos, metros_ajustados, pedido_item_id)',
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
        tone: 'blue',
        type: 'PEDIDO',
        ref: fmtNumeroPedido(pedidoSemOp),
        title: 'Abrir OP de Tecelagem',
        sub: clienteNome(pedidoSemOp, clientesById) + ' - recebido ' + tempoRelativo(pedidoSemOp.criado_em),
        meta: pedidoSemOp.metros_total ? fmtMetros(pedidoSemOp.metros_total) : 'Sem metragem',
        status: 'Sem OP',
        statusTone: 'red',
        cta: 'Abrir OP',
        ctaTone: 'primary',
        href: '#/ops/nova?pedido_id=' + encodeURIComponent(pedidoSemOp.id)
      });
    }

    var tecPronta = tecelagemProntas.slice().sort(sortByRecent)[0];
    if (tecPronta) {
      actionRows.push({
        tone: 'green',
        type: 'OP',
        ref: fmtOp(tecPronta, opDisplayContext(tecPronta)).replace(/^OP /, ''),
        title: 'Transferir para Acabamento',
        sub: 'Tecelagem finalizada - ' + tempoRelativo(tecPronta.atualizado_em || tecPronta.criado_em),
        meta: fmtMetros(opMetros(tecPronta)),
        status: 'Pronta',
        statusTone: 'green',
        cta: 'Resolver',
        ctaTone: 'default',
        href: '#/ops/' + tecPronta.id
      });
    }

    var latexAberta = latexAbertas.slice().sort(sortByRecent)[0];
    if (latexAberta) {
      actionRows.push({
        tone: 'amber',
        type: 'OP',
        ref: fmtAcabamento(latexAberta, opDisplayContext(latexAberta)),
        title: 'Confirmar entrada em Acabamento',
        sub: 'OP de látex aberta - ' + tempoRelativo(latexAberta.criado_em),
        meta: fmtMetros(opMetros(latexAberta)),
        status: 'Em trânsito',
        statusTone: 'blue',
        cta: 'Confirmar',
        ctaTone: 'default',
        href: '#/ops/' + latexAberta.id
      });
    }

    var parcial = expedicoesParciais.slice().sort(sortByRecent)[0];
    if (parcial) {
      var saldo = expedicaoSaldo(parcial, itensByExpedicao);
      actionRows.push({
        tone: 'red',
        type: 'EXPEDICAO',
        ref: '#' + parcial.id,
        title: 'Registrar entrega parcial',
        sub: 'Expedicao com saldo pendente - ' + tempoRelativo(parcial.atualizado_em || parcial.criado_em),
        meta: fmtMetros(saldo.entregue) + ' / ' + fmtMetros(saldo.liberado),
        status: 'Parcial',
        statusTone: 'purple',
        cta: 'Resolver',
        ctaTone: 'default',
        href: '#/expedicoes/' + parcial.id
      });
    }

    var pedidoConcluido = pedidosConcluidos.slice().sort(sortByRecent)[0];
    if (pedidoConcluido) {
      actionRows.push({
        tone: 'green',
        type: 'PEDIDO',
        ref: fmtNumeroPedido(pedidoConcluido),
        title: 'Conferir pedido concluído',
        sub: clienteNome(pedidoConcluido, clientesById) + ' - atualizado ' + tempoRelativo(pedidoConcluido.atualizado_em || pedidoConcluido.criado_em),
        meta: pedidoConcluido.metros_total ? fmtMetros(pedidoConcluido.metros_total) : 'Sem metragem',
        status: 'Pronto',
        statusTone: 'green',
        cta: 'Ver pedido',
        ctaTone: 'neutral',
        href: pedidoHref(pedidoConcluido)
      });
    }

    var alerts = [];
    if (pedidosSemOp.length) {
      alerts.push({
        tone: 'amber',
        title: 'Pedido sem OP',
        sub: pedidosSemOp.length + ' pedido(s) aberto(s) ainda não tem OP vinculada.',
        tag: 'Bloqueio',
        tagTone: 'red'
      });
    }
    var prepParadas = opsPreparacao.filter(function (op) {
      var dias = diasDesde(op && (op.atualizado_em || op.criado_em));
      return dias != null && dias >= 5;
    });
    if (prepParadas.length) {
      alerts.push({
        tone: 'red',
        title: 'OP parada em preparação',
        sub: prepParadas.length + ' OP(s) sem avanço há 5 dias ou mais.',
        tag: '5 dias',
        tagTone: 'amber'
      });
    }
    if (latexProntasSemExpedicao.length) {
      alerts.push({
        tone: 'amber',
        title: 'Acabamento sem expedição',
        sub: latexProntasSemExpedicao.length + ' OP(s) de acabamento pronta(s) aguardam expedição.',
        tag: 'Atenção',
        tagTone: 'amber'
      });
    }
    if (expedicoesParciais.length) {
      alerts.push({
        tone: 'blue',
        title: 'Entrega parcial pendente',
        sub: expedicoesParciais.length + ' expedição(ões) tem saldo de entrega em aberto.',
        tag: 'Info',
        tagTone: 'blue'
      });
    }
    if (safeArray(state.errors).length) {
      alerts.push({
        tone: 'gray',
        title: 'Fonte auxiliar indisponível',
        sub: 'Alguns dados não carregaram: ' + state.errors.join(', ') + '.',
        tag: 'Dados',
        tagTone: 'gray'
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
        tone: 'done',
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
        text: (pedido ? fmtNumeroPedido(pedido) + ': ' : '') + (evento.mensagem || evento.titulo || 'Atualizacao de pedido registrada.'),
        tone: 'blue'
      });
    });
    safeArray(state.pedidos).slice().sort(sortByRecent).slice(0, 3).forEach(function (pedido) {
      activities.push({
        when: fmtDataCurta(pedido && (pedido.atualizado_em || pedido.criado_em)),
        text: fmtNumeroPedido(pedido) + ' - ' + clienteNome(pedido, clientesById) + ' esta como ' + labelStatus(pedido && pedido.status) + '.',
        tone: 'green'
      });
    });
    safeArray(state.ops).slice().sort(sortByRecent).slice(0, 3).forEach(function (op) {
      activities.push({
        when: fmtDataCurta(op && (op.atualizado_em || op.criado_em)),
        text: fmtOp(op, opDisplayContext(op)) + ' atualizada para ' + labelStatus(op && op.status) + '.',
        tone: isLatex(op) ? 'amber' : 'blue'
      });
    });

    return {
      updatedAt: state.updatedAt,
      loading: state.loading,
      errors: safeArray(state.errors),
      kpis: [
        {
          icon: ICONS.pedidos,
          iconBg: '#eaf1fd',
          iconColor: '#2563eb',
          label: 'Pedidos em aberto',
          value: pedidosAbertos.length,
          trend: pedidosSemOp.length ? '+' + pedidosSemOp.length : 'ok',
          trendTone: pedidosSemOp.length ? 'amber' : 'green',
          sub: pedidosSemOp.length + ' aguardam primeira OP'
        },
        {
          icon: ICONS.opDoc,
          iconBg: '#fff4e6',
          iconColor: '#e07b39',
          label: 'OPs em preparação',
          value: opsPreparacao.length,
          trend: tecelagemProntas.length ? tecelagemProntas.length + ' p/ liberar' : 'fila limpa',
          trendTone: tecelagemProntas.length ? 'gray' : 'green',
          sub: prepParadas.length + ' parada(s) há 5 dias'
        },
        {
          icon: ICONS.gear,
          iconBg: '#f3effe',
          iconColor: '#8b5cf6',
          label: 'OPs em produção',
          value: opsProducao.length,
          trend: opsProducao.length ? 'ativo' : 'sem fila',
          trendTone: opsProducao.length ? 'purple' : 'gray',
          sub: 'Tecelagem e Acabamento'
        },
        {
          icon: ICONS.truck,
          iconBg: '#f4faf6',
          iconColor: '#18794a',
          label: 'Aguardando expedição',
          value: latexProntasSemExpedicao.length,
          trend: latexProntasSemExpedicao.length ? latexProntasSemExpedicao.length + ' pronta(s)' : 'ok',
          trendTone: latexProntasSemExpedicao.length ? 'amber' : 'green',
          sub: expedicoesPendentes.length + ' expedição(ões) em aberto'
        },
        {
          icon: ICONS.triangle,
          iconBg: '#fdecec',
          iconColor: '#d6403a',
          label: 'Entregas pendentes',
          value: unique(expedicoesParciais.map(function (e) { return e.id; })).length,
          trend: expedicoesParciais.length ? 'atenção' : 'ok',
          trendTone: expedicoesParciais.length ? 'red' : 'green',
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

  function pillStyle(tone) {
    var styles = {
      blue: 'background:#eaf1fd;color:#2563eb;',
      green: 'background:#e6f4ec;color:#18794a;',
      amber: 'background:#fdf3e0;color:#9a6b15;',
      red: 'background:#fdecec;color:#b91c1c;',
      purple: 'background:#f3effe;color:#7c3aed;',
      gray: 'background:#f1f3f6;color:#8a93a3;'
    };
    return styles[tone || 'gray'] || styles.gray;
  }

  function pill(text, tone) {
    return window.el('span', {
      class: 'rv-adm-pill',
      style: pillStyle(tone)
    }, text);
  }

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
    var warn = !view.loading && view.errors.length
      ? window.el('div', { class: 'rv-adm-warning' },
        icon(ICONS.warning, 14, '#9a6b15'),
        'Algumas fontes auxiliares não carregaram')
      : null;

    return window.el('div', { class: 'rv-adm-head' },
      window.el('div', {},
        window.el('h1', { class: 'rv-adm-title' }, 'Dashboard'),
        window.el('div', { class: 'rv-adm-sub' }, subtitle),
        warn
      ),
      window.el('div', { class: 'rv-adm-actions' },
        actionButton('Ver pedidos', '#/pedidos', false),
        actionButton('Ver OPs', '#/ops', false),
        actionButton('Novo pedido', '#/pedidos/novo', true, ICONS.plus)
      )
    );
  }

  function buildKpi(card) {
    var value = card.loading ? '--' : card.value;
    return window.el('div', { class: 'rv-adm-card rv-adm-kpi' },
      window.el('div', { class: 'rv-adm-kpi-top' },
        window.el('div', {
          class: 'rv-adm-icon',
          style: 'background:' + card.iconBg + ';color:' + card.iconColor + ';'
        }, icon(card.icon, 18, card.iconColor)),
        pill(card.trend, card.trendTone)
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

  function sectionHead(title, sub, right) {
    return window.el('div', { class: 'rv-adm-section-head' },
      window.el('div', {},
        window.el('div', { class: 'rv-adm-section-title' }, title),
        sub ? window.el('div', { class: 'rv-adm-section-sub' }, sub) : null
      ),
      right || null
    );
  }

  function actionRow(row) {
    var barColor = row.tone === 'red' ? '#d6403a'
      : row.tone === 'amber' ? '#d99a2b'
      : row.tone === 'green' ? '#18794a'
      : '#2563eb';
    var ctaClass = 'rv-adm-cta'
      + (row.ctaTone === 'primary' ? ' primary' : '')
      + (row.ctaTone === 'neutral' ? ' neutral' : '');

    return window.el('div', { class: 'rv-adm-action-row' },
      window.el('div', { class: 'rv-adm-bar', style: 'background:' + barColor + ';' }),
      window.el('div', { class: 'rv-adm-action-main' },
        window.el('div', { class: 'rv-adm-action-line' },
          window.el('span', { class: 'rv-adm-type' }, row.type),
          window.el('span', { class: 'rv-adm-ref' }, row.ref),
          window.el('span', { class: 'rv-adm-action-title' }, row.title)
        ),
        window.el('div', { class: 'rv-adm-action-sub' }, row.sub)
      ),
      window.el('div', { class: 'rv-adm-action-side' },
        window.el('div', { class: 'rv-adm-mini' }, row.meta),
        pill(row.status, row.statusTone)
      ),
      window.el('button', {
        type: 'button',
        class: ctaClass,
        onclick: function () { navigateTo(row.href); }
      }, row.cta)
    );
  }

  function alertRow(row) {
    var dot = row.tone === 'red' ? '#d6403a'
      : row.tone === 'amber' ? '#d99a2b'
      : row.tone === 'green' ? '#18794a'
      : row.tone === 'gray' ? '#9aa2af'
      : '#2563eb';
    var tag = row.tag || 'Info';
    var tagTone = row.tagTone || 'blue';
    return window.el('div', { class: 'rv-adm-alert' },
      window.el('span', { class: 'rv-adm-dot', style: 'background:' + dot + ';' }),
      window.el('div', { class: 'rv-adm-alert-body' },
        window.el('div', { class: 'rv-adm-alert-title' }, row.title),
        window.el('div', { class: 'rv-adm-alert-sub' }, row.sub)
      ),
      window.el('span', {
        class: 'rv-adm-alert-tag',
        style: pillStyle(tagTone)
      }, tag)
    );
  }

  function buildActions(view) {
    var body = view.loading
      ? [window.el('div', { class: 'rv-adm-empty' }, 'Carregando fila operacional...')]
      : (view.actions.length ? view.actions.map(actionRow)
        : [window.el('div', { class: 'rv-adm-empty' }, 'Sem ações operacionais pendentes no momento.')]);

    var head = window.el('div', { class: 'rv-adm-section-head' },
      window.el('div', { class: 'rv-adm-head-left' },
        window.el('span', { class: 'rv-adm-section-title' }, 'Fila de ações'),
        pill(view.loading ? '-- pendentes' : view.actions.length + ' pendentes', view.actions.length ? 'red' : 'green')
      ),
      window.el('span', { style: 'font-size:12.5px;color:#8a93a3;font-weight:600;' }, 'Prioridade')
    );

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

    var head = window.el('div', { class: 'rv-adm-section-head' },
      window.el('div', { class: 'rv-adm-head-left' },
        icon(ICONS.triangle, 16, '#e07b39'),
        window.el('span', { class: 'rv-adm-section-title' }, 'Alertas')
      ),
      pill(view.loading ? '--' : String(view.alerts.length), view.alerts.length ? 'amber' : 'green')
    );

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
    var classes = 'rv-adm-stage' + (stage.tone ? ' ' + stage.tone : '');
    var items = stage.items && stage.items.length ? stage.items : [{ primary: 'Sem itens', secondary: 'Fila vazia' }];
    return window.el('div', { class: classes },
      stage.showArrow ? window.el('span', { class: 'rv-adm-stage-arrow' }, icon(ICONS.arrowRight, 16, '#c5cad4')) : null,
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
    return window.el('div', { class: 'rv-adm-card rv-adm-pipeline' },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:14px;'
      },
        window.el('span', { style: 'font-size:15px;font-weight:700;color:#16203a;' }, 'Cadeia produtiva'),
        window.el('span', { style: 'font-size:12.5px;color:#8a93a3;' }, 'Fluxo do pedido à conclusão')
      ),
      window.el('div', { class: 'rv-adm-pipeline-grid' }, view.stages.map(stageCard))
    );
  }

  function activityRow(row) {
    var color = row.tone === 'green' ? '#18794a'
      : row.tone === 'amber' ? '#d99a2b'
      : row.tone === 'red' ? '#d6403a'
      : '#2563eb';
    return window.el('div', { class: 'rv-adm-activity-row' },
      window.el('span', { class: 'rv-adm-dot', style: 'background:' + color + ';margin-top:0;' }),
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

    return window.el('div', { class: 'rv-adm-card rv-adm-activity' },
      sectionHead('Atividade recente', null, historico),
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
