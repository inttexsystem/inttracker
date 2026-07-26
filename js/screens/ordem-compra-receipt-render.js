// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RECEIPT RENDER (PHASE-C4) =============
// Phase: PHASE-C4 (docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md,
// OC-C4-ADMIN-001). Pure render for the persistent "Recebimentos" section on
// the dedicated purchase-order detail screen (§R.24.9). Receives
// (state, handlers) and returns DOM nodes — NO Supabase, NO state mutation,
// NO DML (CODE_HEALTH §9). All action availability is read from the
// server-derived `acoes` object in the read model (state.receiptHistory) —
// never recomputed client-side, never inferred from local status fields.
//
// Rendered ONLY for native orders past the draft stage; legacy
// (modelo==='legado') and native-draft orders render no section (contract §7
// matrix). NULL-op / Pedido-origin allocations render as a first-class,
// honest "Pedido (compartilhada)" attribution — never a fabricated OP
// (§R.28.6/§R.29.2). Excess is shown explicitly and distinctly from
// allocation quantities.
//
// VISUAL — canonical --rv-* tokens (css/tokens.css, linked globally at
// index.html and defined on :root, so resolvable on this screen;
// C4-ADMIN-RECEIPT-UI-VISUAL-GATE-R1 corrected the earlier literal values):
// flat hairline card at --rv-radius-card (6px) with --rv-color-line-200
// border and no shadow (§3), a section icon chip using --rv-color-chip-bg /
// --rv-color-chip-glyph + an 11px UPPERCASE --rv-color-section-label label
// (§6), golden-rule tables (§7) with text-right tabular numerics
// (--rv-color-value) and decimal comma + unit (§2), one dominant
// --rv-color-accent "Registrar recebimento" action (§8), and the ratified
// compact icon-only row-level reversal button (§8.1) via js/ui.js's
// actionButton() (already token-equivalent). Layout/spacing/type-size use
// Tailwind utilities (no canonical --rv token exists for those). Tables are
// hand-built with the sibling ordem-compra-render.js idiom so numeric HEADERS
// align right with their VALUES (dataTable() header cells are text-left only).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  var el = window.el;

  // Feather/Lucide 14px functional glyphs (§13). svgIcon mirrors the ratified
  // cadastros.js pattern (innerHTML → firstChild); stroke:currentColor so the
  // actionButton/chip color styling applies.
  function svgIcon(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(markup).trim();
    return tmp.firstChild;
  }
  var ICON_INBOX = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>';
  var ICON_UNDO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';

  function fmtKg(v) {
    if (v == null) return '—';
    return (typeof window.fmtKg === 'function') ? window.fmtKg(v) : String(v);
  }

  // ISO timestamp → DD/MM/AAAA HH:MM (§2).
  function fmtDateTime(ts) {
    if (!ts) return '—';
    var s = String(ts);
    var d = s.slice(0, 10).split('-');
    if (d.length !== 3) return s;
    var time = s.length >= 16 ? (' ' + s.slice(11, 16)) : '';
    return d[2] + '/' + d[1] + '/' + d[0] + time;
  }

  // Honest OP attribution — a real OP id, or the first-class shared/excess
  // state. NEVER fabricates an OP for a NULL-op (Pedido-origin) or excess line.
  function opLabel(opId) {
    if (opId == null) return 'Pedido (compartilhada)';
    return 'OP ' + opId;
  }

  function sectionCard(children) {
    return el('div', {
      id: 'oc-recebimentos', class: 'overflow-hidden mb-4',
      style: 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);border-radius:var(--rv-radius-card);',
    }, children);
  }

  // Section header: icon chip (20px, --rv-radius-control) using the neutral
  // section chip tokens (§6) + 11px UPPERCASE --rv-color-section-label label +
  // optional dominant action on the right (§8).
  function sectionHeader(actionNode) {
    var chip = el('span', {
      style: 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;'
        + 'border-radius:var(--rv-radius-control);background:var(--rv-color-chip-bg);color:var(--rv-color-chip-glyph);flex:none;',
    }, svgIcon(ICON_INBOX));
    var label = el('span', {
      style: 'font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--rv-color-section-label);',
    }, 'Recebimentos');
    var left = el('div', { class: 'flex items-center gap-2' }, chip, label);
    return el('div', {
      class: 'px-5 py-3 flex items-center justify-between',
      style: 'border-bottom:1px solid var(--rv-color-line-200);',
    }, left, actionNode || el('span', {}));
  }

  function th(label, right) {
    return el('th', {
      class: 'px-4 py-2 text-xs font-semibold uppercase ' + (right ? 'text-right' : 'text-left'),
      style: 'color:var(--rv-color-muted);',
    }, label);
  }
  function tdNum(value) {
    return el('td', {
      class: 'px-4 py-2 text-sm text-right',
      style: 'color:var(--rv-color-value);font-variant-numeric:tabular-nums;',
    }, fmtKg(value));
  }
  function tdText(value, muted) {
    return el('td', {
      class: 'px-4 py-2 text-sm',
      style: 'color:' + (muted ? 'var(--rv-color-muted)' : 'var(--rv-color-value)') + ';',
    }, value);
  }
  function theadRow(cells) {
    return el('thead', { style: 'background:var(--rv-color-bg-header);border-bottom:1px solid var(--rv-color-line-200);' },
      el('tr', {}, cells));
  }
  // Token-based row separator (§4 line-100) — replaces the Tailwind
  // divide-gray-* utility so re-theming flows through the tokens.
  function bodyRow(attrs, cells) {
    var style = 'border-top:1px solid var(--rv-color-line-100);' + (attrs.style || '');
    var merged = Object.assign({}, attrs, { style: style });
    return el('tr', merged, cells);
  }

  function fioLabel(row) {
    var mat = row.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = row.cor_poliester || (row.cor_id != null ? ('Cor ' + row.cor_id) : '—');
    return mat + ' · ' + cor;
  }

  // Per-item saldos: Kg pedido / recebido / restante / excesso (item totals).
  function itensTable(itens) {
    var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
    t.appendChild(theadRow([th('Fio'), th('Kg pedido', true), th('Kg recebido', true), th('Kg restante', true), th('Kg excesso', true)]));
    var body = el('tbody', {});
    itens.forEach(function (it) {
      body.appendChild(bodyRow({ 'data-item-id': String(it.item_id) },
        [tdText(fioLabel(it)), tdNum(it.kg_pedido), tdNum(it.kg_recebido), tdNum(it.kg_restante), tdNum(it.kg_excesso)]));
    });
    t.appendChild(body);
    return el('div', { class: 'overflow-x-auto' }, t);
  }

  // Per-allocation remaining: honest OP/Pedido attribution + kg remaining.
  function alocacoesTable(itens) {
    var count = 0;
    itens.forEach(function (it) { count += (it.alocacoes || []).length; });
    if (!count) {
      return el('div', { class: 'px-5 py-4 text-sm', style: 'color:var(--rv-color-muted);' }, 'Nenhuma alocação neste item.');
    }
    var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
    t.appendChild(theadRow([th('Fio'), th('Origem'), th('Kg alocado', true), th('Kg recebido', true), th('Kg restante', true)]));
    var body = el('tbody', {});
    itens.forEach(function (it) {
      (it.alocacoes || []).forEach(function (a) {
        body.appendChild(bodyRow({ 'data-alocacao-id': String(a.alocacao_id) },
          [tdText(fioLabel(it)), tdText(opLabel(a.op_id), a.op_id == null),
            tdNum(a.kg_alocado), tdNum(a.kg_recebido), tdNum(a.kg_restante)]));
      });
    });
    t.appendChild(body);
    return el('div', { class: 'overflow-x-auto' }, t);
  }

  function tipoBadge(comandoTipo) {
    var isEstorno = comandoTipo === 'estorno';
    return el('span', {
      'data-ui-pill': '1', style: 'display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--rv-radius-pill);white-space:nowrap;'
        + (isEstorno ? 'background:var(--rv-surface);color:var(--rv-color-danger);' : 'background:var(--rv-signal-positive-bg);color:var(--rv-color-success);'),
    }, isEstorno ? 'Estorno' : 'Recebimento');
  }

  // One reversal control per reversible receipt lançamento. Compact icon-only
  // row action (§8.1) via actionButton(): 30×30, --rv-radius-control, title +
  // aria-label + sr-only label (all inside actionButton), disabled derived
  // strictly from the server model (acoes.estornar AND kg_reversivel > 0).
  // The confirmDialog gate before execution is wired in the events layer.
  function reversalButton(comando, lanc, acoes, handlers) {
    var reversible = comando.comando_tipo === 'recebimento'
      && acoes && acoes.estornar === true
      && Number(lanc.kg_reversivel) > 0;
    return window.actionButton({
      title: 'Estornar recebimento',
      icon: svgIcon(ICON_UNDO),
      danger: true,
      disabled: !reversible,
      srLabel: 'Estornar recebimento do lançamento ' + lanc.id,
      onclick: reversible ? function () { handlers.estornarLancamento(comando, lanc); } : undefined,
    });
  }

  function metaSpan(label, value, title) {
    var attrs = { style: 'color:var(--rv-color-muted);' };
    if (title) attrs.title = title;
    return el('span', attrs, label + (value == null ? '—' : value));
  }

  // Command history: one block per command (recebimento/estorno) with its
  // header metadata and a nested lançamentos table carrying honest per-line
  // OP/excess attribution and the row-level reversal control.
  function historico(comandos, acoes, handlers) {
    if (!comandos.length) {
      return el('div', { id: 'oc-recebimentos-historico', class: 'px-5 py-8 text-center text-sm', style: 'color:var(--rv-color-muted);' },
        'Nenhum recebimento registrado ainda.');
    }
    var wrap = el('div', { id: 'oc-recebimentos-historico' });
    comandos.forEach(function (c, i) {
      var block = el('div', {
        class: 'px-5 py-4', 'data-comando-id': String(c.id),
        style: i > 0 ? 'border-top:1px solid var(--rv-color-line-100);' : '',
      });
      var meta = el('div', { class: 'flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm' },
        tipoBadge(c.comando_tipo),
        el('span', { style: 'color:var(--rv-color-muted);font-variant-numeric:tabular-nums;' }, fmtDateTime(c.ocorrido_em)),
        metaSpan('Ator: ', c.ator_tipo || '—'),
        metaSpan('Doc.: ', c.documento_ref || '—', c.documento_ref || undefined),
        metaSpan('Origem: ', (c.origem_tipo || '—') + (c.origem_ref ? (' / ' + c.origem_ref) : ''), c.origem_ref || undefined));
      block.appendChild(meta);

      var showActions = c.comando_tipo === 'recebimento';
      var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
      t.appendChild(theadRow([th('Fio'), th('Origem'), th('Kg', true), th('Kg excesso', true), th('Reversível', true),
        el('th', { class: 'px-4 py-2 text-xs font-semibold uppercase text-right', style: 'color:var(--rv-color-muted);' }, showActions ? 'Ações' : '')]));
      var body = el('tbody', {});
      (c.lancamentos || []).forEach(function (l) {
        var actTd = el('td', { class: 'px-4 py-2 text-right' });
        if (showActions) actTd.appendChild(reversalButton(c, l, acoes, handlers));
        body.appendChild(bodyRow({ 'data-lancamento-id': String(l.id) }, [
          tdText(fioLabel(l)),
          tdText(opLabel(l.op_id), l.op_id == null),
          el('td', { class: 'px-4 py-2 text-sm text-right', style: 'color:var(--rv-color-value);font-variant-numeric:tabular-nums;' }, fmtKg(l.kg)),
          tdNum(l.kg_excesso),
          el('td', { class: 'px-4 py-2 text-sm text-right', style: 'color:var(--rv-color-muted);font-variant-numeric:tabular-nums;' }, fmtKg(l.kg_reversivel)),
          actTd,
        ]));
      });
      t.appendChild(body);
      block.appendChild(el('div', { class: 'overflow-x-auto' }, t));
      wrap.appendChild(block);
    });
    return wrap;
  }

  function subHeader(label) {
    return el('div', {
      class: 'px-5 py-2 text-xs font-semibold uppercase tracking-wide',
      style: 'color:var(--rv-color-section-label);background:var(--rv-color-bg-header);border-bottom:1px solid var(--rv-color-line-200);',
    }, label);
  }

  // renderReceiptSection(state, handlers) → DOM node, or null when no section
  // must exist (non-native order, or native draft — contract §7 matrix).
  ns.renderReceiptSection = function (state, handlers) {
    var o = state && state.ordem;
    if (!o || o.modelo !== 'nativo') return null;
    if (o.status_administrativo === 'rascunho') return null;

    var hist = state.receiptHistory;

    // Loading / error / empty are honest, distinct states (§15).
    if (!hist || hist.loading) {
      return sectionCard([
        sectionHeader(null),
        el('div', { class: 'px-5 py-8 text-center text-sm', style: 'color:var(--rv-color-muted);' }, 'Carregando recebimentos…'),
      ]);
    }
    if (hist.ok !== true) {
      return sectionCard([
        sectionHeader(null),
        el('div', { id: 'oc-recebimentos-erro', class: 'px-5 py-8 text-center text-sm', style: 'color:var(--rv-color-muted);' },
          'Não foi possível carregar os recebimentos.'),
      ]);
    }

    var acoes = hist.acoes || {};
    var registrarBtn = null;
    if (acoes.receber === true) {
      registrarBtn = el('button', {
        id: 'oc-registrar-recebimento',
        class: 'text-white text-sm font-semibold px-3 py-2 hover:opacity-90',
        style: 'background:var(--rv-color-accent);border-radius:var(--rv-radius-control);',
        onclick: function () { handlers.abrirRegistroRecebimento(); },
      }, 'Registrar recebimento');
    }

    var children = [sectionHeader(registrarBtn)];
    var itens = hist.itens || [];
    children.push(subHeader('Saldos por item'));
    children.push(itens.length ? itensTable(itens) : el('div', { class: 'px-5 py-4 text-sm', style: 'color:var(--rv-color-muted);' }, 'Nenhum item nesta ordem.'));
    children.push(subHeader('Alocações'));
    children.push(alocacoesTable(itens));
    children.push(subHeader('Histórico'));
    children.push(historico(hist.comandos || [], acoes, handlers));

    return sectionCard(children);
  };
})(window);
