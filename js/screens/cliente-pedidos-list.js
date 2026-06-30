// =====================================================================
// === SCREENS: CLIENTE PEDIDOS LIST ===================================
// Tela cliente `#/cliente/pedidos` — listagem read-only dos próprios
// pedidos. Confia na RLS para filtrar por `cliente_id`.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-UI-A +
//   RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A +
//   RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A +
//   RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1
//   (redesign visual do miolo para igualar ao HTML standalone "Cliente -
//   Lista de Pedidos": header com ação "Solicitar pedido", busca +
//   tabs com contagem por situação, tabela de 7 colunas — Pedido /
//   Situação / Avanço / Prazo / Recebimento / Atualizado / Ação — e
//   paginação, sem alterar o shell/sidebar/topbar globais nem o
//   contrato de dados/RLS já homologado.)
// Escopo: listagem cliente. Sem criar/editar/cancelar pedido.
//   Sem expor dados internos, de produção ou administrativos.
//
// Carregar via <script src="js/screens/cliente-pedidos-list.js"></script>
// no <head>, DEPOIS de cliente-common.js, pedido-tracking-ui.js,
// pedido-ui.js e ui.js.
//
// Dependências resolvidas em tempo de chamada:
//   - window.el / window.toast (js/ui.js)
//   - window.clienteShellLayout (js/screens/cliente-common.js)
//   - window.fmtDataCurta (js/pedido-ui.js)
//   - window.RavatexPedidoTracking (js/pedido-tracking-ui.js) — usado
//     para rotular o status visual, o tom do badge de situação e o
//     avanço parcial/total via buildPedidoAcompanhamentoParcial (mesma
//     API já homologada no dashboard e no detalhe do pedido).
//   - window.navigate (js/router.js)
//   - window.supa (js/supabase-client.js)
//
// A tela é read-only: APENAS `select` em `pedidos`, `pedido_itens` e
// `pedido_parciais` (mesmas tabelas/colunas já consultadas pelo
// dashboard cliente, só para alimentar o indicador de avanço). Sem
// insert/update/delete/rpc.
//
// Dados de pedidos: SELECT explícito apenas dos campos seguros
//   (id, numero, status, status_cliente_*, prazo_entrega, observacao,
//   criado_em) — contrato inalterado desde a fase de polish visual.
// Dados de itens (metragem total do acompanhamento): SELECT explícito
//   em `pedido_itens` (id, pedido_id, metros). Apenas a metragem —
//   nenhum dado interno de produção.
// Dados de parciais (avanço "Parcial · X / Y m"): SELECT explícito em
//   `pedido_parciais` (id, pedido_id, sequencia, situacao, metros,
//   data_referencia, criado_em). Mesmas colunas cliente-visíveis já
//   usadas no dashboard/detalhe.
//
// Pendência conhecida (reportada, não inventada): o standalone exibe
// uma coluna "Recebimento" (retirada/envio). O schema já tem a coluna
// `pedidos.tipo_recebimento` (db/15_status_cliente_visual.sql), mas
// ela não está no contrato de SELECT travado por
// tests/cliente-pedidos-list.smoke.js nem é hoje capturada pelo
// formulário de criação (docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md).
// Por isso a coluna é exibida com fallback seguro "—" em vez de
// inventar o dado ou quebrar o contrato de SELECT já homologado.
//
// Compatibilidade: window.screenClientePedidosLista fica disponível
// para o setRoutes.
// =====================================================================

(function (window) {
  'use strict';

  var ITENS_LIMIT = 500;
  var PAGE_SIZE = 10;

  // Paleta de tons do pill de situação (idêntica à extraída do
  // standalone e já usada em cliente-dashboard.js).
  var TONE = {
    green: { bg: '#e6f4ec', color: '#18794a', dot: '#1ea05a' },
    amber: { bg: '#fdf3e0', color: '#9a6b15', dot: '#d99a2b' },
    gray: { bg: '#f4f5f7', color: '#5b6472', dot: '#aab2bf' },
    red: { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  };

  // Agrupamento p/ cor do pill (mesma regra do dashboard: concluído
  // entra no tom verde junto com pronto-para-expedição/transporte).
  var TONE_PRONTO_KEYS = ['expedicao', 'transporte', 'concluido'];
  var TONE_PRODUCAO_KEYS = ['tecelagem', 'acabamento'];

  // Agrupamento das tabs do standalone (Em produção / Pronto p/
  // expedição / Entregue ficam separados; concluído tem tab própria).
  var TAB_PRODUCAO_KEYS = ['tecelagem', 'acabamento'];
  var TAB_PRONTO_KEYS = ['expedicao', 'transporte'];

  var TABS = [
    { key: 'todos', label: 'Todos' },
    { key: 'producao', label: 'Em produção' },
    { key: 'pronto', label: 'Pronto p/ expedição' },
    { key: 'entregue', label: 'Entregue' },
    { key: 'cancelado', label: 'Cancelado' },
  ];

  function getTrackingApi() {
    return window.RavatexPedidoTracking
      || (window.RAVATEX_PEDIDO_UI && window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING)
      || null;
  }

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  // Resolve o estado visual de um pedido (mesma lógica já homologada
  // em cliente-dashboard.js), com fallback seguro para "recebido"
  // quando `status_cliente_visual` ainda não foi publicado.
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

  function estadoTone(estado) {
    if (estado === 'cancelado') return TONE.red;
    if (estado === 'concluido') return TONE.green;
    if (TONE_PRONTO_KEYS.indexOf(estado) !== -1) return TONE.green;
    if (TONE_PRODUCAO_KEYS.indexOf(estado) !== -1) return TONE.amber;
    return TONE.gray;
  }

  function tabBucket(pedido) {
    var excecaoKey = normalizarKey(pedido && pedido.status_cliente_excecao);
    if (excecaoKey === 'cancelado') return 'cancelado';
    var estado = resolveEstadoVisual(pedido);
    if (estado === 'concluido') return 'entregue';
    if (TAB_PRONTO_KEYS.indexOf(estado) !== -1) return 'pronto';
    if (TAB_PRODUCAO_KEYS.indexOf(estado) !== -1) return 'producao';
    return null;
  }

  function fmtData(v) {
    if (!v) return null;
    var s = window.fmtDataCurta ? window.fmtDataCurta(v) : String(v);
    return s === '—' ? null : s;
  }

  function fmtDataHoraCurta(v) {
    if (!v) return null;
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return null;
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var hh = String(d.getHours()).padStart(2, '0');
      var mi = String(d.getMinutes()).padStart(2, '0');
      return dd + '/' + mm + ' ' + hh + ':' + mi;
    } catch (_) {
      return null;
    }
  }

  function fmtMetros(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' m';
  }

  function fmtNumero(n) {
    return '#' + (n != null ? n : '—');
  }

  // Cria elemento SVG via innerHTML (suporta namespace corretamente em
  // qualquer navegador) — mesma convenção já homologada em
  // cliente-dashboard.js / cliente-pedido-detail.js.
  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild || tmp.firstChild;
  }

  var ICON_PLUS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

  var ICON_BUSCA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

  var ICON_OLHO = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path>'
    + '<circle cx="12" cy="12" r="3"></circle></svg>';

  var ICON_CHEVRON_LEFT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="15 18 9 12 15 6"></polyline></svg>';

  var ICON_CHEVRON_RIGHT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="9 18 15 12 9 6"></polyline></svg>';

  var TR_COLS = '60px 160px 1fr 96px 96px 96px 40px';

  async function screenClientePedidosLista() {
    var container = window.el('div', {});

    var state = {
      pedidos: [],
      itensByPedido: {},
      parciaisByPedido: {},
      acompanhamentoByPedido: {},
      pedidosError: false,
    };

    var ui = {
      busca: '',
      tab: 'todos',
      pagina: 1,
    };

    var searchHasFocus = false;
    var searchCursorPos = 0;

    async function carregar() {
      var pedidosRes = await window.supa
        .from('pedidos')
        .select('id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, observacao, criado_em')
        .order('criado_em', { ascending: false })
        .limit(200);

      if (pedidosRes.error) {
        state.pedidosError = true;
        state.pedidos = [];
        window.toast('Erro ao carregar pedidos', 'error');
        console.error('cliente-pedidos-list: erro ao carregar pedidos', pedidosRes.error);
      } else {
        state.pedidosError = false;
        state.pedidos = pedidosRes.data || [];
      }

      // Itens: somente metros, para a metragem total do acompanhamento.
      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, pedido_id, metros')
        .limit(ITENS_LIMIT);
      if (itensRes.error) {
        state.itensByPedido = {};
        console.error('cliente-pedidos-list: erro ao carregar itens', itensRes.error);
      } else {
        var byPedido = {};
        (itensRes.data || []).forEach(function (it) {
          if (!it || !it.pedido_id) return;
          if (!byPedido[it.pedido_id]) byPedido[it.pedido_id] = [];
          byPedido[it.pedido_id].push(it);
        });
        state.itensByPedido = byPedido;
      }

      // Parciais: mesmas colunas cliente-visíveis do dashboard/detalhe,
      // para o avanço "Parcial · X / Y m".
      var parciaisRes = await window.supa
        .from('pedido_parciais')
        .select('id, pedido_id, sequencia, situacao, metros, data_referencia, criado_em')
        .limit(ITENS_LIMIT);
      if (parciaisRes.error) {
        state.parciaisByPedido = {};
        console.error('cliente-pedidos-list: erro ao carregar parciais', parciaisRes.error);
      } else {
        var byPed = {};
        (parciaisRes.data || []).forEach(function (pa) {
          if (!pa || !pa.pedido_id) return;
          if (!byPed[pa.pedido_id]) byPed[pa.pedido_id] = [];
          byPed[pa.pedido_id].push(pa);
        });
        state.parciaisByPedido = byPed;
      }

      var api = getTrackingApi();
      state.acompanhamentoByPedido = {};
      if (api && api.buildPedidoAcompanhamentoParcial) {
        state.pedidos.forEach(function (p) {
          if (!p || !p.id) return;
          try {
            state.acompanhamentoByPedido[p.id] = api.buildPedidoAcompanhamentoParcial(
              p, state.itensByPedido[p.id] || [], state.parciaisByPedido[p.id] || [], { forCliente: true });
          } catch (e) {
            state.acompanhamentoByPedido[p.id] = null;
          }
        });
      }
    }

    // -----------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------
    function buildHeader() {
      var btn = window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:#2563eb;color:#fff;'
          + 'border:none;border-radius:4px;padding:9px 16px;font-weight:600;font-size:14px;'
          + 'font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: function () { window.navigate('#/cliente/pedidos/novo'); },
      }, svgEl(ICON_PLUS), 'Solicitar pedido');

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;',
      },
        window.el('div', {},
          window.el('div', {
            style: 'font-size:21px;font-weight:800;color:#16203a;letter-spacing:-.01em;line-height:1.1;',
          }, 'Meus Pedidos'),
          window.el('div', {
            style: 'font-size:12.5px;color:#8a93a3;margin-top:3px;',
          }, 'Acompanhe o status e o histórico dos seus pedidos.')
        ),
        btn
      );
    }

    // -----------------------------------------------------------------
    // Busca + Tabs
    // -----------------------------------------------------------------
    function countTab(key, rows) {
      if (key === 'todos') return rows.length;
      return rows.filter(function (p) { return tabBucket(p) === key; }).length;
    }

    function buildBuscaTabs() {
      var wrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:nowrap;',
      });

      var searchBox = window.el('div', {
        style: 'display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #d8dce2;'
          + 'border-radius:4px;padding:7px 13px;flex:1;min-width:0;',
      }, svgEl(ICON_BUSCA));

      var input = window.el('input', {
        type: 'text',
        placeholder: 'Buscar pedido...',
        style: 'border:none;outline:none;background:transparent;flex:1;min-width:0;font-size:13px;'
          + 'color:#16203a;font-family:inherit;',
      });
      input.value = ui.busca;
      input.addEventListener('focus', function () { searchHasFocus = true; });
      input.addEventListener('blur', function () { searchHasFocus = false; });
      input.addEventListener('input', function () {
        ui.busca = input.value;
        searchCursorPos = input.selectionStart;
        ui.pagina = 1;
        render();
      });
      searchBox.appendChild(input);
      wrap.appendChild(searchBox);

      TABS.forEach(function (t) {
        var active = ui.tab === t.key;
        var count = countTab(t.key, state.pedidos);
        var btn = window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:5px;border-radius:4px;padding:6px 11px;'
            + 'font-size:13px;font-weight:' + (active ? '600' : '500') + ';'
            + 'border:1px solid ' + (active ? '#2563eb' : '#d8dce2') + ';'
            + 'background:' + (active ? '#2563eb' : '#fff') + ';'
            + 'color:' + (active ? '#fff' : '#5b6472') + ';'
            + 'cursor:pointer;white-space:nowrap;font-family:inherit;',
          onclick: (function (key) {
            return function () { ui.tab = key; ui.pagina = 1; render(); };
          })(t.key),
        }, t.label + ' ', window.el('span', {
          style: 'background:' + (active ? 'rgba(255,255,255,.25)' : '#f1f3f6') + ';border-radius:99px;'
            + 'padding:1px 6px;font-size:11px;color:' + (active ? '#fff' : '#8a93a3') + ';',
        }, String(count)));
        wrap.appendChild(btn);
      });

      return wrap;
    }

    // -----------------------------------------------------------------
    // Tabela
    // -----------------------------------------------------------------
    function pillSituacao(pedido) {
      var excecaoKey = normalizarKey(pedido && pedido.status_cliente_excecao);
      var estado = resolveEstadoVisual(pedido);
      var tone = excecaoKey === 'cancelado' ? TONE.red : estadoTone(estado);
      return window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:5px;border-radius:4px;padding:3px 9px;'
          + 'font-size:12px;font-weight:600;white-space:nowrap;background:' + tone.bg
          + ';color:' + tone.color + ';',
      },
        window.el('span', {
          style: 'width:6px;height:6px;border-radius:50%;background:' + tone.dot
            + ';flex-shrink:0;display:inline-block;',
        }),
        pedidoLabelVisual(pedido)
      );
    }

    function avancoCell(pedido) {
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

    function buildRow(pedido) {
      var criado = fmtData(pedido.criado_em);
      var prazo = fmtData(pedido.prazo_entrega);
      var atualizado = fmtDataHoraCurta(pedido.status_cliente_atualizado_em)
        || fmtDataHoraCurta(pedido.criado_em);

      var eyeBtn = window.el('button', {
        type: 'button',
        style: 'background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;'
          + 'justify-content:center;color:#8a93a3;padding:4px;border-radius:3px;',
        title: 'Ver pedido',
        onclick: function () { window.navigate('#/cliente/pedidos/' + pedido.id); },
      }, svgEl(ICON_OLHO));
      eyeBtn.addEventListener('mouseenter', function () {
        eyeBtn.style.color = '#2563eb';
        eyeBtn.style.background = '#eaf1fd';
      });
      eyeBtn.addEventListener('mouseleave', function () {
        eyeBtn.style.color = '#8a93a3';
        eyeBtn.style.background = 'none';
      });

      return window.el('div', {
        style: 'display:grid;grid-template-columns:' + TR_COLS + ';align-items:center;gap:12px;'
          + 'padding:11px 16px;border-bottom:1px solid #f1f3f6;min-width:720px;',
      },
        window.el('div', {},
          window.el('div', { style: 'font-size:14px;font-weight:700;color:#2563eb;' }, fmtNumero(pedido.numero)),
          window.el('div', { style: 'font-size:11px;color:#9aa2af;margin-top:1px;' }, criado || '—')
        ),
        window.el('div', {}, pillSituacao(pedido)),
        avancoCell(pedido),
        window.el('div', {
          style: 'font-size:13.5px;color:' + (prazo ? '#3f4757' : '#aab2bf') + ';',
        }, prazo || '—'),
        // Recebimento: pendência reportada — ver comentário no topo do
        // arquivo (coluna `tipo_recebimento` fora do contrato de SELECT
        // travado e não capturada hoje na criação do pedido).
        window.el('div', { style: 'font-size:13.5px;color:#aab2bf;' }, '—'),
        window.el('div', { style: 'font-size:12.5px;color:#9aa2af;' }, atualizado || '—'),
        window.el('div', { style: 'display:flex;justify-content:center;' }, eyeBtn)
      );
    }

    function buildTableHead() {
      var head = window.el('div', {
        style: 'display:grid;grid-template-columns:' + TR_COLS + ';align-items:center;gap:12px;'
          + 'padding:10px 16px;background:#f8f9fb;border-bottom:1px solid #eceef1;min-width:720px;',
      });
      ['PEDIDO', 'SITUAÇÃO', 'AVANÇO', 'PRAZO', 'RECEBIMENTO', 'ATUALIZADO'].forEach(function (label) {
        head.appendChild(window.el('div', {
          style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;white-space:nowrap;',
        }, label));
      });
      head.appendChild(window.el('div', {
        style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;white-space:nowrap;'
          + 'text-align:center;',
      }, 'AÇÃO'));
      return head;
    }

    function buildTabela(rows) {
      var wrap = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:4px;overflow-x:auto;',
      });
      wrap.appendChild(buildTableHead());

      if (state.pedidosError) {
        wrap.appendChild(window.el('div', {
          style: 'padding:32px 16px;text-align:center;font-size:14px;color:#b45309;min-width:720px;',
        }, 'Não foi possível carregar seus pedidos agora. Tente recarregar a página.'));
      } else if (rows.length === 0) {
        wrap.appendChild(window.el('div', {
          style: 'padding:32px 16px;text-align:center;font-size:14px;color:#9aa2af;min-width:720px;',
        }, 'Nenhum pedido encontrado.'));
      } else {
        rows.forEach(function (p) { wrap.appendChild(buildRow(p)); });
      }

      return wrap;
    }

    // -----------------------------------------------------------------
    // Paginação
    // -----------------------------------------------------------------
    function navBtn(svgMarkup, disabled, onclick) {
      var attrs = {
        type: 'button',
        style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;'
          + 'border:1px solid #d8dce2;border-radius:4px;background:#fff;'
          + 'color:' + (disabled ? '#d8dce2' : '#9aa2af') + ';'
          + 'cursor:' + (disabled ? 'default' : 'pointer') + ';font-family:inherit;',
      };
      if (disabled) attrs.disabled = 'disabled';
      else attrs.onclick = onclick;
      return window.el('button', attrs, svgEl(svgMarkup));
    }

    function buildPaginacao(totalFiltrado) {
      var totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var inicio = totalFiltrado === 0 ? 0 : (ui.pagina - 1) * PAGE_SIZE + 1;
      var fim = Math.min(ui.pagina * PAGE_SIZE, totalFiltrado);

      var prev = navBtn(ICON_CHEVRON_LEFT, ui.pagina <= 1, function () { ui.pagina -= 1; render(); });
      var next = navBtn(ICON_CHEVRON_RIGHT, ui.pagina >= totalPaginas, function () { ui.pagina += 1; render(); });
      var pageNum = window.el('button', {
        type: 'button',
        style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;'
          + 'border:none;border-radius:4px;background:#2563eb;color:#fff;font-size:13px;'
          + 'font-weight:700;cursor:default;font-family:inherit;',
      }, String(ui.pagina));

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;background:#fff;'
          + 'border:1px solid #eceef1;border-top:none;border-radius:0 0 4px 4px;padding:11px 16px;'
          + 'margin-bottom:14px;',
      },
        window.el('span', { style: 'font-size:13px;color:#9aa2af;' },
          totalFiltrado === 0
            ? 'Nenhum pedido encontrado'
            : 'Mostrando ' + inicio + ' a ' + fim + ' de ' + totalFiltrado
              + (totalFiltrado === 1 ? ' pedido' : ' pedidos')),
        window.el('div', { style: 'display:flex;align-items:center;gap:5px;' }, prev, pageNum, next)
      );
    }

    // -----------------------------------------------------------------
    // Filtros + render
    // -----------------------------------------------------------------
    function aplicarFiltros() {
      var termo = normalizarKey(ui.busca);
      return state.pedidos.filter(function (p) {
        if (ui.tab !== 'todos' && tabBucket(p) !== ui.tab) return false;
        if (termo) {
          var numero = p.numero != null ? String(p.numero).toLowerCase() : '';
          if (numero.indexOf(termo) === -1) return false;
        }
        return true;
      });
    }

    function render() {
      var filtrados = aplicarFiltros();
      var totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var pageRows = filtrados.slice((ui.pagina - 1) * PAGE_SIZE, ui.pagina * PAGE_SIZE);

      container.replaceChildren(
        buildHeader(),
        buildBuscaTabs(),
        buildTabela(pageRows),
        buildPaginacao(filtrados.length)
      );

      if (searchHasFocus) {
        var newInput = container.querySelector('input[type="text"]');
        if (newInput) {
          newInput.focus();
          try { newInput.setSelectionRange(searchCursorPos, searchCursorPos); } catch (_) { /* noop */ }
        }
      }
    }

    await carregar();
    render();
    return window.clienteShellLayout(container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.clientePedidosList = {
    screenClientePedidosLista: screenClientePedidosLista,
  };

  window.screenClientePedidosLista = screenClientePedidosLista;
})(window);
