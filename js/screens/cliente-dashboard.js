// =====================================================================
// === SCREENS: CLIENTE DASHBOARD ======================================
// Página inicial read-only do portal B2B do cliente. Resume os
// pedidos próprios em KPIs, pedidos em destaque, resumo (donut),
// últimas atualizações visíveis e prazos próximos.
// Rota: `#/cliente/dashboard`.
//
// Fase: RAVATEX-TAPETES-CLIENTE-DASHBOARD-A +
//   RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A +
//   RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM
//   (redesign visual completo do miolo para igualar ao HTML
//   standalone "Dashboard Cliente v3": header com ação Novo pedido,
//   4 KPI cards com ícone, linha do meio com pedidos em destaque
//   (tabela 7 colunas com badge de situação + avanço parcial/total
//   + resumo de itens/metragem) e resumo em donut, linha de baixo
//   com últimas atualizações e prazos próximos — sem alterar o
//   shell/sidebar/topbar globais nem o contrato de dados/RLS.)
//
// Escopo: leitura apenas. Nenhuma ação de escrita. Sem
//   insert/update/delete/rpc, sem Edge Function, sem credencial de
//   serviço. Confia na RLS para filtrar por `cliente_id` e na policy
//   `pedido_cliente_eventos_cliente_select` para os eventos visíveis.
//   Não expõe dados internos, de produção ou administrativos.
//
// Shell: NÃO renderiza sidebar/topbar próprios — o miolo é montado e
//   entregue a window.clienteShellLayout (js/screens/cliente-common.js
//   → js/screens/common.js shellLayout), que fornece o chrome global
//   já homologado (mesmo shell usado por cliente-pedido-detail.js e
//   cliente-pedido-form.js).
//
// Carregar via <script src="js/screens/cliente-dashboard.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-tracking-ui.js,
// pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.pageHeader (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.RavatexPedidoTracking (js/pedido-tracking-ui.js) — usado
//     para rotular o status visual, o tom (cor) do badge e o avanço
//     parcial/total via buildPedidoAcompanhamentoParcial (mesma API
//     já homologada no detalhe do pedido).
//   - window.fmtDataCurta (js/pedido-ui.js) — formatação de datas.
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// Dados de pedidos: SELECT explícito apenas dos campos seguros
//   (id, numero, status, status_cliente_*, prazo_entrega,
//   prazo_desejado, tipo_recebimento, criado_em, atualizado_em).
// Dados de itens (para resumo "N itens · X m" e metragem total do
//   acompanhamento): SELECT explícito em `pedido_itens`
//   (id, pedido_id, metros). Apenas metros; nada de custos/OP/lote.
// Dados de parciais (para o avanço "Parcial · X / Y m"): SELECT
//   explícito em `pedido_parciais`
//   (id, pedido_id, sequencia, situacao, metros, data_referencia,
//   criado_em). Mesmas colunas cliente-visíveis já usadas no detalhe.
// Dados de atualizações: SELECT explícito em `pedido_cliente_eventos`
//   (id, pedido_id, status, titulo, mensagem, criado_em). Apenas
//   colunas visíveis; nenhuma coluna interna de auditoria. Não
//   consulta a tabela interna de eventos. Falha nos eventos não
//   quebra o restante do dashboard.
//
// Compatibilidade: window.screenClienteDashboard e
// RAVATEX_SCREENS.clienteDashboard ficam disponíveis para o setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  var PEDIDOS_LIMIT = 100;
  var DESTAQUE_LIMIT = 6;
  var ATUALIZACOES_LIMIT = 6;
  var PRAZOS_LIMIT = 5;
  var ITENS_LIMIT = 500;

  var EM_ANDAMENTO_KEYS = ['tecelagem', 'acabamento', 'expedicao', 'transporte'];
  var PRONTO_KEYS = ['expedicao', 'transporte', 'concluido'];
  var PRODUCAO_KEYS = ['tecelagem', 'acabamento'];

  // Paleta de tons dos badges do destaque (extraída do standalone).
  var TONE = {
    green:  { bg: '#e6f4ec', color: '#18794a', dot: '#1ea05a' },
    amber:  { bg: '#fdf3e0', color: '#9a6b15', dot: '#d99a2b' },
    gray:   { bg: '#f4f5f7', color: '#5b6472', dot: '#aab2bf' },
    red:    { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  };

  // Cores fixas do donut de resumo (extraídas do standalone).
  var DONUT = {
    emProducao: '#2563eb',
    concluido:  '#1ea05a',
    atrasado:   '#ef4444',
    rascunho:   '#d1d5db',
    track:      '#eef0f3',
  };

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  // Resolve o estado visual de um pedido para fins de KPI. Usa a
  // taxonomia compartilhada com fallback seguro para "recebido" quando
  // `status_cliente_visual` ainda não foi publicado.
  function resolveEstadoVisual(pedido) {
    var api = getTrackingApi();
    var excecaoKey = normalizarKey(pedido && pedido.status_cliente_excecao);
    if (api && api.getClienteTrackingException) {
      var excecao = api.getClienteTrackingException(excecaoKey);
      if (excecao && excecao.key === 'cancelado') return 'cancelado';
    } else if (excecaoKey === 'cancelado') {
      return 'cancelado';
    }

    var visualKey = normalizarKey(pedido && pedido.status_cliente_visual);
    if (api && api.getClienteTrackingStep) {
      var step = api.getClienteTrackingStep(visualKey);
      if (step) return step.key;
      return 'recebido';
    }
    return visualKey || 'recebido';
  }

  function pedidoLabelVisual(pedido) {
    var api = getTrackingApi();
    if (api && api.getClienteTrackingStatusLabel) {
      return api.getClienteTrackingStatusLabel(pedido);
    }
    return '—';
  }

  // Tom do badge de situação da linha de destaque, derivado apenas do
  // estado visual publicado (mesma fonte segura do detalhe). Puramente
  // decorativo: não deriva novo dado, só cor.
  function destaqueEstadoTone(estado) {
    if (estado === 'cancelado') return TONE.red;
    if (estado === 'concluido') return TONE.green;
    if (PRONTO_KEYS.indexOf(estado) !== -1) return TONE.green;
    if (PRODUCAO_KEYS.indexOf(estado) !== -1) return TONE.amber;
    return TONE.gray;
  }

  // Tom do ponto das atualizações, derivado do status do evento.
  function eventoDotTone(evento) {
    var api = getTrackingApi();
    var status = normalizarKey(evento && evento.status);
    if (!api || !status) return '#cfd5de';
    var step = api.getClienteTrackingStep ? api.getClienteTrackingStep(status) : null;
    if (step) return destaqueEstadoTone(step.key).dot;
    var excecao = api.getClienteTrackingException ? api.getClienteTrackingException(status) : null;
    if (excecao) {
      if (excecao.tom === 'danger') return TONE.red.dot;
      if (excecao.tom === 'warning') return TONE.amber.dot;
      if (excecao.tom === 'neutral') return TONE.gray.dot;
    }
    return '#cfd5de';
  }

  function fmtData(v) {
    if (!v) return null;
    return window.fmtDataCurta ? window.fmtDataCurta(v) : String(v);
  }

  function fmtDataHora(v) {
    if (!v) return '—';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var hh = String(d.getHours()).padStart(2, '0');
      var mi = String(d.getMinutes()).padStart(2, '0');
      return dd + '/' + mm + '/' + d.getFullYear() + ' ' + hh + ':' + mi;
    } catch (_) {
      return String(v);
    }
  }

  function fmtNumero(n) {
    return '#' + (n != null ? n : '—');
  }

  function fmtMetros(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  // Cria elemento SVG via innerHTML para suporte a namespace.
  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild || tmp.firstChild;
  }

  function isAtrasado(pedido, estado) {
    if (!pedido || !pedido.prazo_entrega) return false;
    if (estado === 'concluido' || estado === 'cancelado') return false;
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var prazo = new Date(pedido.prazo_entrega);
    if (isNaN(prazo.getTime())) return false;
    prazo.setHours(0, 0, 0, 0);
    return prazo.getTime() < hoje.getTime();
  }

  function computeResumo(pedidos) {
    var emProducao = 0;
    var concluido = 0;
    var atrasado = 0;
    var rascunho = 0;

    pedidos.forEach(function (p) {
      var estado = resolveEstadoVisual(p);
      if (estado === 'cancelado') return; // não entra no donut
      if (estado === 'concluido') {
        concluido += 1;
      } else if (isAtrasado(p, estado)) {
        atrasado += 1;
      } else if (EM_ANDAMENTO_KEYS.indexOf(estado) !== -1) {
        emProducao += 1;
      } else {
        rascunho += 1; // recebido/confirmado/insumos/aguardando — fora de produção
      }
    });

    return {
      emProducao: emProducao,
      concluido: concluido,
      atrasado: atrasado,
      rascunho: rascunho,
      total: emProducao + concluido + atrasado + rascunho,
    };
  }

  function computeKpis(pedidos, eventosCount) {
    var resumo = computeResumo(pedidos);
    return {
      meusPedidos: resumo.total,
      emProducao: resumo.emProducao,
      concluido: resumo.concluido,
      atrasado: resumo.atrasado,
      atualizacoes: eventosCount,
    };
  }

  // Pré-computa o acompanhamento (parcial/total + totais) por pedido,
  // usando a mesma API já homologada no detalhe do pedido. Só lê
  // metros de itens/parciais — nenhum campo interno.
  function buildAcompanhamentoByPedido(pedidos, itensByPedido, parciaisByPedido) {
    var api = getTrackingApi();
    var map = {};
    if (!api || !api.buildPedidoAcompanhamentoParcial) return map;
    pedidos.forEach(function (p) {
      if (!p || !p.id) return;
      var itens = itensByPedido[p.id] || [];
      var parciais = parciaisByPedido[p.id] || [];
      try {
        map[p.id] = api.buildPedidoAcompanhamentoParcial(p, itens, parciais, { forCliente: true });
      } catch (e) {
        map[p.id] = null;
      }
    });
    return map;
  }

  async function screenClienteDashboard() {
    var container = window.el('div', {});

    var state = {
      pedidos: [],
      itensByPedido: {},
      parciaisByPedido: {},
      acompanhamentoByPedido: {},
      numeroByPedidoId: {},
      eventos: [],
      pedidosError: false,
      eventosError: false,
      itensError: false,
      parciaisError: false,
    };

    async function carregar() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, prazo_desejado, tipo_recebimento, criado_em, atualizado_em')
        .order('criado_em', { ascending: false })
        .limit(PEDIDOS_LIMIT);

      if (pedidosRes.error) {
        state.pedidosError = true;
        state.pedidos = [];
        console.error('cliente-dashboard: erro ao carregar pedidos', pedidosRes.error);
      } else {
        state.pedidosError = false;
        state.pedidos = pedidosRes.data || [];
      }

      state.numeroByPedidoId = {};
      state.pedidos.forEach(function (p) {
        if (p && p.id) state.numeroByPedidoId[p.id] = p.numero;
      });

      // Itens: somente metros para resumo (N itens · X m) e metragem
      // total do acompanhamento. Falha aqui não quebra o dashboard —
      // apenas deixa o resumo/avanço sem metragem.
      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, pedido_id, metros')
        .limit(ITENS_LIMIT);
      if (itensRes.error) {
        state.itensError = true;
        state.itensByPedido = {};
        console.error('cliente-dashboard: erro ao carregar itens', itensRes.error);
      } else {
        state.itensError = false;
        var byPedido = {};
        (itensRes.data || []).forEach(function (it) {
          if (!it || !it.pedido_id) return;
          if (!byPedido[it.pedido_id]) byPedido[it.pedido_id] = [];
          byPedido[it.pedido_id].push(it);
        });
        state.itensByPedido = byPedido;
      }

      // Parciais: mesmas colunas cliente-visíveis do detalhe, para o
      // avanço "Parcial · X / Y m".
      var parciaisRes = await window.supa
        .from('pedido_parciais')
        .select('id, pedido_id, sequencia, situacao, metros, data_referencia, criado_em')
        .limit(ITENS_LIMIT);
      if (parciaisRes.error) {
        state.parciaisError = true;
        state.parciaisByPedido = {};
        console.error('cliente-dashboard: erro ao carregar parciais', parciaisRes.error);
      } else {
        state.parciaisError = false;
        var byPed = {};
        (parciaisRes.data || []).forEach(function (pa) {
          if (!pa || !pa.pedido_id) return;
          if (!byPed[pa.pedido_id]) byPed[pa.pedido_id] = [];
          byPed[pa.pedido_id].push(pa);
        });
        state.parciaisByPedido = byPed;
      }

      state.acompanhamentoByPedido = buildAcompanhamentoByPedido(
        state.pedidos, state.itensByPedido, state.parciaisByPedido);

      var eventosRes = await window.supa
        .from('pedido_cliente_eventos')
        .select('id, pedido_id, status, titulo, mensagem, criado_em')
        .order('criado_em', { ascending: false })
        .limit(ATUALIZACOES_LIMIT);

      if (eventosRes.error) {
        state.eventosError = true;
        state.eventos = [];
        console.error('cliente-dashboard: erro ao carregar atualizações', eventosRes.error);
      } else {
        state.eventosError = false;
        state.eventos = eventosRes.data || [];
      }
    }

    // -----------------------------------------------------------------
    // Card primitives
    // -----------------------------------------------------------------
    var CARD = 'background:#fff;border:1px solid #eceef1;border-radius:4px;'
      + 'box-shadow:0 1px 2px rgba(20,30,45,.04);';
    var LINK_BLUE = 'color:#2563eb;text-decoration:none;cursor:pointer;';

    function kpiCard(iconSvg, iconBg, iconStroke, label, valor, sub) {
      var icon = svgEl(
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + iconStroke
          + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + iconSvg + '</svg>'
      );
      var iconWrap = window.el('div', {
        style: 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
          + 'border-radius:50%;background:' + iconBg + ';width:44px;height:44px;',
      });
      if (icon) iconWrap.appendChild(icon);

      return window.el('div', {
        style: CARD + 'display:flex;align-items:center;gap:14px;padding:14px 16px;',
      }, iconWrap,
        window.el('div', {},
          window.el('div', { style: 'font-size:14px;color:#8a93a3;' }, label),
          window.el('div', {
            style: 'font-size:24px;font-weight:800;color:#16203a;line-height:1;margin:1px 0;',
          }, String(valor)),
          window.el('div', { style: 'font-size:11px;color:#aab2bf;white-space:nowrap;' }, sub)
        )
      );
    }

    function buildHeader() {
      var novoBtn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:9px;background:#2563eb;color:#fff;'
          + 'border:none;border-radius:4px;padding:9px 16px;font-size:14px;font-weight:600;'
          + 'font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: function () { window.navigate('#/cliente/pedidos/novo'); },
      },
        svgEl('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
          + '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'),
        'Novo pedido'
      );

      return window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;',
      },
        window.el('div', {},
          window.el('h1', {
            style: 'margin:0;font-size:23px;font-weight:700;color:#16203a;line-height:1.15;letter-spacing:-.01em;',
          }, 'Dashboard'),
          window.el('div', {
            style: 'font-size:13.5px;color:#8a93a3;margin-top:5px;',
          }, 'Visão geral dos seus pedidos e atualizações')
        ),
        novoBtn
      );
    }

    function buildKpis() {
      var k = computeKpis(state.pedidos, state.eventos.length);
      var iconPedido = '<rect x="5" y="3" width="14" height="18" rx="2"></rect>'
        + '<path d="M9 3v3h6V3"></path>'
        + '<line x1="9" y1="11" x2="15" y2="11"></line><line x1="9" y1="15" x2="13" y2="15"></line>';
      var iconProd = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
      var iconOk = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>'
        + '<polyline points="22 4 12 14.01 9 11.01"></polyline>';
      var iconAtraso = '<rect x="3" y="4" width="18" height="18" rx="2"></rect>'
        + '<line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line>'
        + '<line x1="3" y1="10" x2="21" y2="10"></line>'
        + '<line x1="12" y1="14" x2="12" y2="17"></line><line x1="12" y1="19.5" x2="12.01" y2="19.5"></line>';

      return window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;',
      },
        kpiCard(iconPedido, '#eaf1fd', '#2563eb', 'Meus pedidos', k.meusPedidos, 'Total de pedidos'),
        kpiCard(iconProd, '#fdf3e0', '#d99a2b', 'Em produção', k.emProducao, 'Pedidos em andamento'),
        kpiCard(iconOk, '#e6f4ec', '#18794a', 'Concluído', k.concluido, 'Pedidos finalizados'),
        kpiCard(iconAtraso, '#fdecec', '#d6403a', 'Atrasado', k.atrasado, 'Pedidos fora do prazo')
      );
    }

    // -----------------------------------------------------------------
    // Pedidos em destaque (tabela 7 colunas)
    // -----------------------------------------------------------------
    var DESTAQUE_COLS = '52px 140px 1fr 100px 108px 44px';

    function destaqueBadge(pedido) {
      var estado = resolveEstadoVisual(pedido);
      var tone = destaqueEstadoTone(estado);
      return window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:6px;background:' + tone.bg
          + ';color:' + tone.color + ';border-radius:4px;padding:4px 8px;font-size:12px;'
          + 'font-weight:600;white-space:nowrap;',
      },
        window.el('span', {
          style: 'width:6px;height:6px;border-radius:50%;background:' + tone.dot
            + ';flex-shrink:0;display:inline-block;',
        }),
        pedidoLabelVisual(pedido)
      );
    }

    function destaqueAvanco(pedido) {
      var ac = state.acompanhamentoByPedido[pedido.id];
      if (!ac || !ac.totais || !(Number(ac.totais.pedido) > 0)) {
        return window.el('div', { style: 'font-size:13.5px;color:#aab2bf;' }, '—');
      }
      var total = ac.totais.pedido;
      if (ac.parcialHabilitado && Number(ac.totais.parcialVisivel) > 0) {
        return window.el('div', {
          style: 'font-size:13.5px;font-weight:500;color:#2563eb;white-space:nowrap;',
        }, 'Parcial · ' + fmtMetros(ac.totais.parcialVisivel) + ' / ' + fmtMetros(total));
      }
      return window.el('div', {
        style: 'font-size:13.5px;font-weight:500;color:#1ea05a;white-space:nowrap;',
      }, 'Total · ' + fmtMetros(total));
    }

    function destaqueRow(pedido, isLast) {
      var atualizado = fmtData(pedido.status_cliente_atualizado_em) || fmtData(pedido.atualizado_em) || '—';
      var prazo = fmtData(pedido.prazo_entrega);

      var eyeBtn = window.el('button', {
        type: 'button',
        style: 'background:none;border:none;cursor:pointer;color:#9aa2af;padding:0;display:inline-flex;',
        title: 'Ver pedido',
        onclick: function () { window.navigate('#/cliente/pedidos/' + pedido.id); },
      }, svgEl('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
        + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>'
        + '<circle cx="12" cy="12" r="3"></circle></svg>'));

      return window.el('div', {
        style: 'display:grid;grid-template-columns:' + DESTAQUE_COLS + ';align-items:center;gap:12px;'
          + 'padding:13px 0;' + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;'),
      },
        window.el('div', {
          style: 'font-size:15px;font-weight:700;color:#16203a;',
        }, fmtNumero(pedido.numero)),
        window.el('div', {}, destaqueBadge(pedido)),
        destaqueAvanco(pedido),
        window.el('div', { style: 'font-size:13.5px;color:#3f4757;white-space:nowrap;' }, atualizado),
        window.el('div', {
          style: 'font-size:13.5px;color:' + (prazo ? '#3f4757' : '#aab2bf') + ';white-space:nowrap;',
        }, prazo || '—'),
        window.el('div', { style: 'display:flex;justify-content:center;' }, eyeBtn)
      );
    }

    function buildDestaque() {
      var card = window.el('div', { style: CARD + 'padding:16px 20px;' });

      var verTodos = window.el('a', {
        style: 'display:inline-flex;align-items:center;gap:4px;' + LINK_BLUE
          + 'font-size:13px;font-weight:600;white-space:nowrap;margin-top:2px;',
        onclick: function () { window.navigate('#/cliente/pedidos'); },
      },
        'Ver todos ',
        svgEl('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
          + '<polyline points="9 6 15 12 9 18"></polyline></svg>'));

      card.appendChild(window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:3px;',
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, 'Pedidos em destaque'),
          window.el('div', {
            style: 'font-size:13px;color:#8a93a3;margin-top:3px;',
          }, 'Pedidos que precisam da sua atenção ou estão em etapas avançadas.')
        ),
        verTodos
      ));

      // Cabeçalho da tabela
      var head = window.el('div', {
        style: 'display:grid;grid-template-columns:' + DESTAQUE_COLS + ';gap:12px;'
          + 'padding-bottom:12px;border-bottom:1px solid #eceef1;margin-top:18px;',
      });
      [['Pedido', ''], ['Situação', ''], ['Avanço', ''], ['Atualizado', ''],
       ['Prazo previsto', ''], ['Ação', 'center']].forEach(function (c) {
        head.appendChild(window.el('div', {
          style: 'font-size:12.5px;color:#9aa2af;' + (c[1] === 'center' ? 'text-align:center;' : ''),
        }, c[0]));
      });
      card.appendChild(head);

      if (state.pedidosError) {
        card.appendChild(window.el('p', {
          style: 'font-size:14px;color:#b45309;padding:18px 0;',
        }, 'Não foi possível carregar seus pedidos agora. Tente recarregar a página.'));
        return card;
      }

      var visiveis = state.pedidos.filter(function (p) {
        return resolveEstadoVisual(p) !== 'cancelado';
      }).slice(0, DESTAQUE_LIMIT);

      if (visiveis.length === 0) {
        card.appendChild(window.el('p', {
          style: 'font-size:14px;color:#9aa2af;padding:18px 0;',
        }, 'Você ainda não tem pedidos em destaque.'));
      } else {
        visiveis.forEach(function (p, idx) {
          card.appendChild(destaqueRow(p, idx === visiveis.length - 1));
        });
      }

      card.appendChild(window.el('div', {
        style: 'border-top:1px solid #eceef1;margin-top:6px;padding-top:18px;',
      },
        window.el('a', {
          style: 'display:inline-flex;align-items:center;gap:7px;' + LINK_BLUE
            + 'font-size:14.5px;font-weight:600;',
          onclick: function () { window.navigate('#/cliente/pedidos'); },
        },
          'Ver todos os pedidos ',
          svgEl('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
            + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
            + '<polyline points="9 6 15 12 9 18"></polyline></svg>'))
      ));

      return card;
    }

    // -----------------------------------------------------------------
    // Resumo dos pedidos (donut)
    // -----------------------------------------------------------------
    function buildDonutSvg(resumo) {
      var r = 60;
      var C = 2 * Math.PI * r; // ≈ 376.99
      var segs = [
        { color: DONUT.emProducao, count: resumo.emProducao },
        { color: DONUT.concluido, count: resumo.concluido },
        { color: DONUT.atrasado, count: resumo.atrasado },
        { color: DONUT.rascunho, count: resumo.rascunho },
      ];
      var arcs = '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="' + DONUT.track
        + '" stroke-width="28"></circle>';
      var total = resumo.total;
      if (total > 0) {
        var cum = 0;
        for (var i = 0; i < segs.length; i++) {
          var s = segs[i];
          if (s.count <= 0) continue;
          var frac = s.count / total;
          var visible = frac * C;
          arcs += '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="' + s.color
            + '" stroke-width="28" stroke-dasharray="' + visible.toFixed(2) + ' '
            + (C - visible).toFixed(2) + '" stroke-dashoffset="' + (-cum).toFixed(2)
            + '" transform="rotate(-90 100 100)"></circle>';
          cum += visible;
        }
      }
      return svgEl('<svg width="110" height="110" viewBox="0 0 200 200" style="flex-shrink:0;min-width:0;max-width:110px;">' + arcs + '</svg>');
    }

    function buildResumoCard() {
      var resumo = computeResumo(state.pedidos);
      function pct(n) {
        return resumo.total > 0 ? Math.round((n / resumo.total) * 100) : 0;
      }
      function legendRow(color, label, n) {
        return window.el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;',
        },
          window.el('div', {
            style: 'display:flex;align-items:center;gap:8px;font-size:13.5px;color:#3f4757;'
              + 'min-width:0;white-space:nowrap;',
          },
            window.el('span', {
              style: 'width:8px;height:8px;border-radius:50%;background:' + color
                + ';flex-shrink:0;display:inline-block;',
            }),
            window.el('span', { style: 'white-space:nowrap;' }, label)),
          window.el('span', {
            style: 'font-size:12.5px;color:#8a93a3;white-space:nowrap;flex-shrink:0;',
          }, pct(n) + '% (' + n + ')')
        );
      }

      var donutWrap = window.el('div', { style: 'display:flex;align-items:center;gap:20px;width:100%;' });
      var donut = buildDonutSvg(resumo);
      if (donut) donutWrap.appendChild(donut);
      donutWrap.appendChild(window.el('div', {
        style: 'display:flex;flex-direction:column;gap:13px;flex:1;min-width:0;',
      },
        legendRow(DONUT.emProducao, 'Em produção', resumo.emProducao),
        legendRow(DONUT.concluido, 'Concluído', resumo.concluido),
        legendRow(DONUT.atrasado, 'Atrasado', resumo.atrasado),
        legendRow(DONUT.rascunho, 'Rascunho', resumo.rascunho)
      ));

      return window.el('div', {
        style: CARD + 'padding:16px 20px;display:flex;flex-direction:column;width:100%;',
      },
        window.el('div', {
          style: 'font-size:16px;font-weight:700;color:#16203a;margin-bottom:20px;',
        }, 'Resumo dos pedidos'),
        donutWrap,
        window.el('div', {
          style: 'border-top:1px solid #eceef1;margin-top:20px;padding-top:16px;'
            + 'display:flex;align-items:center;justify-content:space-between;',
        },
          window.el('span', { style: 'font-size:13px;color:#5b6472;' }, 'Total de pedidos'),
          window.el('span', {
            style: 'font-size:15px;font-weight:700;color:#16203a;',
          }, String(resumo.total))
        )
      );
    }

    // -----------------------------------------------------------------
    // Últimas atualizações
    // -----------------------------------------------------------------
    function buildAtualizacoes() {
      var card = window.el('div', { style: CARD + 'padding:16px 20px;' });

      var verTodas = window.el('a', {
        style: 'display:inline-flex;align-items:center;gap:4px;' + LINK_BLUE
          + 'font-size:13px;font-weight:600;white-space:nowrap;margin-top:2px;',
        onclick: function () { window.navigate('#/cliente/pedidos'); },
      }, 'Ver todas ',
        svgEl('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
          + '<polyline points="9 6 15 12 9 18"></polyline></svg>'));

      card.appendChild(window.el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:3px;',
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:16px;font-weight:700;color:#16203a;' }, 'Últimas atualizações'),
          window.el('div', {
            style: 'font-size:13px;color:#8a93a3;margin-top:3px;',
          }, 'Acompanhe as movimentações e atualizações mais recentes dos seus pedidos.')
        ),
        verTodas
      ));

      var body = window.el('div', { style: 'margin-top:16px;' });

      if (state.eventosError) {
        body.appendChild(window.el('p', { style: 'font-size:14px;color:#b45309;padding:13px 0;' },
          'Não foi possível carregar as atualizações agora.'));
        card.appendChild(body);
        return card;
      }

      if (state.eventos.length === 0) {
        body.appendChild(window.el('p', { style: 'font-size:14px;color:#9aa2af;padding:13px 0;' },
          'Suas atualizações aparecerão aqui.'));
        card.appendChild(body);
        return card;
      }

      state.eventos.forEach(function (ev, idx) {
        var numero = ev.pedido_id ? state.numeroByPedidoId[ev.pedido_id] : null;
        var labelPedido = numero != null ? ('Pedido ' + fmtNumero(numero)) : (ev.titulo || 'Atualização');
        var msg = ev.mensagem || (ev.titulo && ev.titulo !== labelPedido ? ev.titulo : '');
        var isLast = idx === state.eventos.length - 1;
        var dotColor = eventoDotTone(ev);

        var row = window.el('div', {
          style: 'display:flex;align-items:center;gap:16px;padding:13px 0;'
            + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;'),
        },
          window.el('span', {
            style: 'width:9px;height:9px;border-radius:50%;background:' + dotColor
              + ';flex-shrink:0;display:inline-block;',
          }),
          window.el('span', {
            style: 'font-size:14px;font-weight:600;color:#16203a;flex-shrink:0;width:100px;',
          }, labelPedido),
          window.el('span', {
            style: 'flex:1;font-size:13.5px;color:#3f4757;min-width:0;',
          }, msg || '—'),
          window.el('span', {
            style: 'font-size:12.5px;color:#aab2bf;white-space:nowrap;',
          }, fmtDataHora(ev.criado_em))
        );
        if (ev.pedido_id) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', function () {
            window.navigate('#/cliente/pedidos/' + ev.pedido_id);
          });
        }
        body.appendChild(row);
      });

      card.appendChild(body);
      return card;
    }

    // -----------------------------------------------------------------
    // Prazos próximos
    // -----------------------------------------------------------------
    function buildPrazos() {
      var card = window.el('div', { style: CARD + 'padding:16px 20px;' });
      card.appendChild(window.el('div', {
        style: 'font-size:16px;font-weight:700;color:#16203a;',
      }, 'Prazos próximos'));
      card.appendChild(window.el('div', {
        style: 'font-size:13px;color:#8a93a3;margin-top:3px;margin-bottom:16px;',
      }, 'Pedidos com vencimento nos próximos dias.'));

      // Ordena por prazo asc (sem prazo por último), exclui concluído/cancelado.
      var lista = state.pedidos.filter(function (p) {
        var e = resolveEstadoVisual(p);
        return e !== 'concluido' && e !== 'cancelado';
      }).slice().sort(function (a, b) {
        var pa = a.prazo_entrega ? new Date(a.prazo_entrega).getTime() : Infinity;
        var pb = b.prazo_entrega ? new Date(b.prazo_entrega).getTime() : Infinity;
        if (pa !== pb) return pa - pb;
        return 0;
      }).slice(0, PRAZOS_LIMIT);

      if (state.pedidosError || lista.length === 0) {
        card.appendChild(window.el('p', { style: 'font-size:14px;color:#9aa2af;padding:8px 0;' },
          state.pedidosError
            ? 'Não foi possível carregar seus prazos agora.'
            : 'Nenhum prazo próximo.'));
        return card;
      }

      lista.forEach(function (p, idx) {
        var isLast = idx === lista.length - 1;
        var prazo = fmtData(p.prazo_entrega);
        var atras = isAtrasado(p, resolveEstadoVisual(p));
        card.appendChild(window.el('div', {
          style: 'display:flex;align-items:flex-start;justify-content:space-between;padding:12px 0;'
            + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;') + 'cursor:pointer;',
          onclick: function () { window.navigate('#/cliente/pedidos/' + p.id); },
        },
          window.el('div', {},
            window.el('div', {
              style: 'font-size:14px;font-weight:600;color:#16203a;',
            }, fmtNumero(p.numero)),
            window.el('div', {
              style: 'font-size:12.5px;color:#8a93a3;margin-top:2px;',
            }, pedidoLabelVisual(p))
          ),
          window.el('span', {
            style: 'font-size:13px;font-weight:' + (prazo ? '600' : '500')
              + ';color:' + (prazo ? (atras ? '#d6403a' : '#d6403a') : '#aab2bf')
              + ';white-space:nowrap;',
          }, prazo || 'Sem prazo definido')
        ));
      });

      card.appendChild(window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;padding-top:14px;cursor:pointer;',
        onclick: function () { window.navigate('#/cliente/pedidos'); },
      },
        window.el('span', { style: 'font-size:14px;font-weight:600;color:#3f4757;' }, 'Ver todos os pedidos'),
        svgEl('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa2af"'
          + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
          + '<polyline points="9 6 15 12 9 18"></polyline></svg>')
      ));

      return card;
    }

    function render() {
      var middle = window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,0.95fr);gap:22px;margin-bottom:22px;',
      }, buildDestaque(), buildResumoCard());

      var bottom = window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,0.95fr);gap:22px;',
      }, buildAtualizacoes(), buildPrazos());

      container.replaceChildren(
        buildHeader(),
        buildKpis(),
        middle,
        bottom
      );
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clienteDashboard = {
    screenClienteDashboard: screenClienteDashboard,
  };

  window.screenClienteDashboard = screenClienteDashboard;
})(window);
