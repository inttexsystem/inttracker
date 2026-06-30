// =====================================================================
// === SCREENS: OPS LIST ================================================
// Tela admin `#/ops` alinhada visualmente ao standalone
// "Admin - Lista de OPs", preservando:
//   - shell/sidebar/topbar globais;
//   - rota `#/ops` e navegação real para `#/ops/nova` e `#/ops/:id`;
//   - leitura segura em Supabase (somente SELECTs);
//   - ações e permissões já existentes (editar só simulada; demais ver).
// =====================================================================

(function (window) {
  'use strict';

  var PAGE_SIZE = 8;
  var TABS = [
    { key: 'todos', label: 'Todas' },
    { key: 'tecelagem', label: 'Tecelagem' },
    { key: 'latex', label: 'Látex' }
  ];

  function svgEl(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild || tmp.firstChild;
  }

  var ICON_PLUS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  var ICON_CHEVRON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var ICON_X = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var ICON_EYE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  var ICON_MORE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="12" cy="19" r="1.2"></circle></svg>';
  var ICON_LEFT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_RIGHT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  var ICON_TOTAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>';
  var ICON_PROD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b39" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>';
  var ICON_SIM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b6472" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>';
  var ICON_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2"></circle></svg>';

  function normalizarKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function fmtData(v) {
    if (!v) return '—';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR');
    } catch (_) {
      return '—';
    }
  }

  function kpiCard(iconBg, iconMarkup, label, value) {
    return window.el('div', {
      style: 'background:#fff;border:1px solid #eceef1;border-radius:6px;padding:14px 16px;display:flex;align-items:center;gap:12px;min-width:0;'
    },
    window.el('div', {
      style: 'width:36px;height:36px;border-radius:50%;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;'
    }, svgEl(iconMarkup)),
    window.el('div', { style: 'min-width:0;' },
      window.el('div', { style: 'font-size:12.5px;color:#8a93a3;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, label),
      window.el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;line-height:1;' }, String(value))
    ));
  }

  function buildSelectLike(label, value) {
    return window.el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border:1px solid #d8dce2;border-radius:4px;padding:7px 12px;min-width:0;flex:1;'
    },
    window.el('div', { style: 'min-width:0;' },
      window.el('div', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;margin-bottom:2px;' }, label),
      window.el('div', { style: 'font-size:13px;color:#16203a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, value)
    ),
    svgEl(ICON_CHEVRON));
  }

  function navBtn(svgMarkup, disabled, onclick) {
    var attrs = {
      type: 'button',
      style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid #d8dce2;border-radius:4px;background:#fff;color:' + (disabled ? '#d8dce2' : '#9aa2af') + ';cursor:' + (disabled ? 'default' : 'pointer') + ';font-family:inherit;'
    };
    if (disabled) attrs.disabled = 'disabled';
    else attrs.onclick = onclick;
    return window.el('button', attrs, svgEl(svgMarkup));
  }

  function actionIconButton(label, title, iconMarkup, disabled, onclick) {
    var attrs = {
      type: 'button',
      title: title,
      style: 'width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;border-radius:4px;background:#fff;color:' + (disabled ? '#c4cad4' : '#5b6472') + ';cursor:' + (disabled ? 'default' : 'pointer') + ';font-family:inherit;'
    };
    if (disabled) attrs.disabled = 'disabled';
    else attrs.onclick = onclick;
    return window.el('button', attrs,
      svgEl(iconMarkup),
      window.el('span', { style: 'display:none;' }, label)
    );
  }

  async function screenListaOPs() {
    var container = window.el('div', {});
    var state = {
      rows: [],
      itensPorOpId: {},
      error: false
    };
    var ui = {
      busca: '',
      tab: 'todos',
      cliente: 'todos',
      status: 'todos',
      criadaEm: 'todos',
      pagina: 1
    };
    var searchHasFocus = false;
    var searchCursorPos = 0;

    async function carregar() {
      var opsRes = await window.supa.from('ops')
        .select('id, numero, ano, status, tipo, criado_em, lote:lote_id(numero, cliente:cliente_id(nome)), op_itens(id, metros_pedidos, metros_ajustados)')
        .order('ano', { ascending: false })
        .order('numero', { ascending: false });

      var entregaRes = await window.supa.from('entrega_itens')
        .select('op_id, metros_entregues, defeito');

      if (opsRes.error) {
        state.error = true;
        state.rows = [];
        window.toast('Erro ao carregar OPs', 'error');
        console.error('ops-list: erro ao carregar ops', opsRes.error);
        return;
      }

      if (entregaRes.error) {
        state.error = true;
        state.rows = [];
        window.toast('Erro ao carregar progresso', 'error');
        console.error('ops-list: erro ao carregar progresso', entregaRes.error);
        return;
      }

      state.error = false;
      state.rows = opsRes.data || [];
      state.itensPorOpId = {};
      (entregaRes.data || []).forEach(function (item) {
        if (!item || item.op_id == null) return;
        if (!state.itensPorOpId[item.op_id]) state.itensPorOpId[item.op_id] = [];
        state.itensPorOpId[item.op_id].push(item);
      });
    }

    function entreguePct(row) {
      return window.percentualEntregueOP(row.op_itens || [], state.itensPorOpId[row.id] || []);
    }

    function clienteNome(row) {
      return row && row.lote && row.lote.cliente && row.lote.cliente.nome
        ? String(row.lote.cliente.nome)
        : '—';
    }

    function statusBucket(row) {
      var key = normalizarKey(row && row.status);
      return key || 'todos';
    }

    function createdBucket(row) {
      if (!row || !row.criado_em) return 'todos';
      var d = new Date(row.criado_em);
      if (isNaN(d.getTime())) return 'todos';
      var now = new Date();
      var diff = (now.getTime() - d.getTime()) / 86400000;
      if (diff <= 7) return '7d';
      if (diff <= 30) return '30d';
      return 'old';
    }

    function tabMatches(row, key) {
      if (key === 'todos') return true;
      return normalizarKey(row.tipo || 'tecelagem') === key;
    }

    function computeKpis() {
      var total = state.rows.length;
      var emProducao = 0;
      var simuladas = 0;
      var abertas = 0;

      state.rows.forEach(function (row) {
        var status = normalizarKey(row.status);
        if (status === 'em_producao') emProducao += 1;
        if (status === 'simulada') simuladas += 1;
        if (status === 'aberta') abertas += 1;
      });

      return {
        total: total,
        emProducao: emProducao,
        simuladas: simuladas,
        abertas: abertas
      };
    }

    function applyFilters() {
      var termo = normalizarKey(ui.busca);
      return state.rows.filter(function (row) {
        if (!tabMatches(row, ui.tab)) return false;
        if (ui.cliente !== 'todos' && clienteNome(row) !== ui.cliente) return false;
        if (ui.status !== 'todos' && statusBucket(row) !== ui.status) return false;
        if (ui.criadaEm !== 'todos' && createdBucket(row) !== ui.criadaEm) return false;
        if (termo) {
          var opLabel = row.numero != null ? String(row.numero).toLowerCase() : '';
          var loteLabel = row.lote && row.lote.numero != null ? String(row.lote.numero).toLowerCase() : '';
          var cliente = clienteNome(row).toLowerCase();
          if (opLabel.indexOf(termo) === -1 && loteLabel.indexOf(termo) === -1 && cliente.indexOf(termo) === -1) return false;
        }
        return true;
      });
    }

    function buildHeader() {
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;'
      },
      window.el('div', {},
        window.el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;' }, 'Ordens de Produção'),
        window.el('div', { style: 'font-size:13px;color:#8a93a3;margin-top:3px;' }, 'Acompanhe as OPs da operação.')
      ),
      window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:7px;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:9px 16px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;white-space:nowrap;',
        onclick: function () { window.navigate('#/ops/nova'); }
      }, svgEl(ICON_PLUS), 'Nova OP'));
    }

    function buildKpis() {
      var kpi = computeKpis();
      return window.el('div', {
        style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;'
      },
      kpiCard('#eaf1fd', ICON_TOTAL, 'Total', kpi.total),
      kpiCard('#fff4e6', ICON_PROD, 'Em produção', kpi.emProducao),
      kpiCard('#f1f3f6', ICON_SIM, 'Simuladas', kpi.simuladas),
      kpiCard('#eaf1fd', ICON_OPEN, 'Abertas', kpi.abertas));
    }

    function buildBuscaTabs() {
      var wrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;'
      });

      var searchBox = window.el('div', {
        style: 'flex:1;min-width:260px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #d8dce2;border-radius:4px;padding:7px 13px;'
      }, svgEl(ICON_SEARCH));
      var input = window.el('input', {
        type: 'text',
        placeholder: 'Buscar por OP, lote ou cliente...',
        style: 'border:none;outline:none;background:transparent;flex:1;min-width:0;font-size:13px;color:#16203a;font-family:inherit;'
      });
      input.value = ui.busca;
      input.addEventListener('focus', function () { searchHasFocus = true; });
      input.addEventListener('blur', function () { searchHasFocus = false; });
      input.addEventListener('input', function () {
        ui.busca = input.value;
        searchCursorPos = input.selectionStart || 0;
        ui.pagina = 1;
        render();
      });
      searchBox.appendChild(input);
      wrap.appendChild(searchBox);

      var tabsWrap = window.el('div', {
        style: 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;max-width:100%;padding-bottom:2px;'
      });
      TABS.forEach(function (tab) {
        var active = ui.tab === tab.key;
        tabsWrap.appendChild(window.el('button', {
          type: 'button',
          style: 'display:inline-flex;align-items:center;gap:5px;border-radius:4px;padding:6px 11px;font-size:13px;font-weight:' + (active ? '600' : '500') + ';border:1px solid ' + (active ? '#2563eb' : '#d8dce2') + ';background:' + (active ? '#2563eb' : '#fff') + ';color:' + (active ? '#fff' : '#5b6472') + ';cursor:pointer;white-space:nowrap;font-family:inherit;',
          onclick: function () {
            ui.tab = tab.key;
            ui.pagina = 1;
            render();
          }
        }, tab.label));
      });
      wrap.appendChild(tabsWrap);
      return wrap;
    }

    function buildFilterControls() {
      var wrap = window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) auto;gap:8px;margin-bottom:16px;align-items:stretch;'
      });

      function buildSelect(label, value, options, onChange) {
        var holder = window.el('div', { style: 'position:relative;' });
        var select = window.el('select', {
          style: 'width:100%;border:1px solid transparent;background:transparent;color:transparent;position:absolute;inset:0;cursor:pointer;opacity:0;',
          onchange: function () { onChange(select.value); }
        });
        options.forEach(function (opt) {
          var option = window.el('option', { value: opt.value }, opt.label);
          if (opt.value === value) option.selected = 'selected';
          select.appendChild(option);
        });
        holder.appendChild(buildSelectLike(label, (options.find(function (opt) { return opt.value === value; }) || options[0]).label));
        holder.appendChild(select);
        return holder;
      }

      var clientesSeen = {};
      var clienteOptions = [{ value: 'todos', label: 'Todos os clientes' }];
      state.rows.forEach(function (row) {
        var nome = clienteNome(row);
        if (nome === '—' || clientesSeen[nome]) return;
        clientesSeen[nome] = true;
        clienteOptions.push({ value: nome, label: nome });
      });
      clienteOptions.sort(function (a, b) {
        if (a.value === 'todos') return -1;
        if (b.value === 'todos') return 1;
        return a.label.localeCompare(b.label, 'pt-BR');
      });

      wrap.appendChild(buildSelect('Cliente', ui.cliente, clienteOptions, function (value) {
        ui.cliente = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(buildSelect('Status', ui.status, [
        { value: 'todos', label: 'Todos' },
        { value: 'simulada', label: 'Simulada' },
        { value: 'aberta', label: 'Aberta' },
        { value: 'em_producao', label: 'Em produção' },
        { value: 'finalizada', label: 'Finalizada' }
      ], function (value) {
        ui.status = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(buildSelect('Criada em', ui.criadaEm, [
        { value: 'todos', label: 'Todos os períodos' },
        { value: '7d', label: 'Últimos 7 dias' },
        { value: '30d', label: 'Últimos 30 dias' },
        { value: 'old', label: 'Mais antigas' }
      ], function (value) {
        ui.criadaEm = value;
        ui.pagina = 1;
        render();
      }));

      wrap.appendChild(window.el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:#5b6472;border:1px solid #d8dce2;border-radius:4px;padding:7px 13px;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;white-space:nowrap;align-self:stretch;',
        onclick: function () {
          ui.busca = '';
          ui.tab = 'todos';
          ui.cliente = 'todos';
          ui.status = 'todos';
          ui.criadaEm = 'todos';
          ui.pagina = 1;
          render();
        }
      }, 'Limpar', svgEl(ICON_X)));

      return wrap;
    }

    function progressCell(pct) {
      var fillColor = pct >= 100 ? '#18794a' : '#2563eb';
      var textColor = pct >= 100 ? '#18794a' : (pct > 0 ? '#5b6472' : '#aab2bf');
      return window.el('div', {},
        window.el('div', {
          style: 'font-size:12px;color:' + textColor + ';font-weight:600;margin-bottom:4px;'
        }, pct + '%'),
        window.el('div', {
          style: 'width:120px;max-width:100%;height:6px;background:#eef2f7;border-radius:999px;overflow:hidden;'
        },
        window.el('div', {
          style: 'height:100%;width:' + pct + '%;background:' + fillColor + ';border-radius:999px;'
        })));
    }

    function rowActions(row) {
      var canEdit = normalizarKey(row.status) === 'simulada';
      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:center;gap:6px;'
      },
      actionIconButton(
        canEdit ? 'Editar' : 'Ver',
        canEdit ? 'Editar' : 'Visualizar',
        canEdit ? ICON_EDIT : ICON_EYE,
        false,
        function () { window.navigate('#/ops/' + row.id); }
      ),
      actionIconButton('Mais', 'Mais', ICON_MORE, true));
    }

    function buildTableHead() {
      var row = window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(130px,1.05fr) minmax(120px,.9fr) minmax(170px,1.3fr) minmax(130px,1fr) minmax(130px,.95fr) 110px 90px;gap:18px;align-items:center;padding:10px 16px;background:#f8f9fb;border-bottom:1px solid #eceef1;min-width:980px;'
      });
      ['OP / LOTE', 'TIPO', 'CLIENTE', 'STATUS', 'ENTREGUE', 'CRIADA EM', 'AÇÕES'].forEach(function (label, idx) {
        row.appendChild(window.el('div', {
          style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;white-space:nowrap;' + (idx === 6 ? 'text-align:center;justify-self:center;' : '')
        }, label));
      });
      return row;
    }

    function buildRow(row, isLast) {
      return window.el('div', {
        style: 'display:grid;grid-template-columns:minmax(130px,1.05fr) minmax(120px,.9fr) minmax(170px,1.3fr) minmax(130px,1fr) minmax(130px,.95fr) 110px 90px;gap:18px;align-items:center;padding:14px 16px;min-width:980px;' + (isLast ? '' : 'border-bottom:1px solid #f1f3f6;')
      },
      window.el('div', {},
        window.el('div', { style: 'font-size:14px;font-weight:700;color:#2563eb;' }, 'Nº ' + row.numero + '/' + row.ano),
        window.el('div', { style: 'font-size:11px;color:#9aa2af;margin-top:1px;' }, row.lote ? 'Lote Nº ' + row.lote.numero : 'Sem lote')
      ),
      window.el('div', {}, window.badgeTipo(row.tipo || 'tecelagem')),
      window.el('div', { style: 'font-size:13px;color:#3f4757;' }, clienteNome(row)),
      window.el('div', {}, window.badgeStatus(row.status)),
      progressCell(entreguePct(row)),
      window.el('div', { style: 'font-size:13px;color:#5b6472;' }, fmtData(row.criado_em)),
      rowActions(row));
    }

    function buildTable(rows) {
      var wrap = window.el('div', {
        style: 'background:#fff;border:1px solid #eceef1;border-radius:6px;overflow:hidden;'
      });
      var scroll = window.el('div', { style: 'overflow-x:auto;' });
      scroll.appendChild(buildTableHead());

      if (state.error) {
        scroll.appendChild(window.el('div', {
          style: 'padding:34px 16px;text-align:center;font-size:14px;color:#b45309;min-width:980px;'
        }, 'Não foi possível carregar as OPs agora. Tente recarregar a página.'));
        wrap.appendChild(scroll);
        return wrap;
      }

      if (rows.length === 0) {
        scroll.appendChild(window.el('div', {
          style: 'padding:34px 16px;text-align:center;font-size:14px;color:#9aa2af;min-width:980px;'
        }, 'Nenhuma OP para este filtro.'));
        wrap.appendChild(scroll);
        return wrap;
      }

      rows.forEach(function (row, idx) {
        scroll.appendChild(buildRow(row, idx === rows.length - 1));
      });
      wrap.appendChild(scroll);
      return wrap;
    }

    function buildPagination(totalFiltrado) {
      var totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var inicio = totalFiltrado === 0 ? 0 : ((ui.pagina - 1) * PAGE_SIZE) + 1;
      var fim = Math.min(ui.pagina * PAGE_SIZE, totalFiltrado);

      return window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #eceef1;border-top:none;border-radius:0 0 6px 6px;padding:11px 18px;margin-bottom:8px;'
      },
      window.el('span', {
        style: 'font-size:13px;color:#9aa2af;'
      }, totalFiltrado === 0
        ? 'Nenhuma OP encontrada'
        : 'Mostrando ' + inicio + ' a ' + fim + ' de ' + totalFiltrado + (totalFiltrado === 1 ? ' OP' : ' OPs')),
      window.el('div', { style: 'display:flex;align-items:center;gap:5px;' },
        navBtn(ICON_LEFT, ui.pagina <= 1, function () {
          ui.pagina -= 1;
          render();
        }),
        window.el('button', {
          type: 'button',
          style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;border-radius:4px;background:#2563eb;color:#fff;font-size:13px;font-weight:700;cursor:default;font-family:inherit;'
        }, String(ui.pagina)),
        navBtn(ICON_RIGHT, ui.pagina >= totalPaginas, function () {
          ui.pagina += 1;
          render();
        })));
    }

    function render() {
      var filtrados = applyFilters();
      var totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
      if (ui.pagina > totalPaginas) ui.pagina = totalPaginas;
      var rows = filtrados.slice((ui.pagina - 1) * PAGE_SIZE, ui.pagina * PAGE_SIZE);

      container.replaceChildren(
        buildHeader(),
        buildKpis(),
        buildBuscaTabs(),
        buildFilterControls(),
        buildTable(rows),
        buildPagination(filtrados.length)
      );

      if (searchHasFocus) {
        var input = container.querySelector('input[type="text"]');
        if (input) {
          input.focus();
          try {
            input.setSelectionRange(searchCursorPos, searchCursorPos);
          } catch (_) {}
        }
      }
    }

    await carregar();
    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opsList = {
    screenListaOPs: screenListaOPs
  };

  window.screenListaOPs = screenListaOPs;
})(window);
