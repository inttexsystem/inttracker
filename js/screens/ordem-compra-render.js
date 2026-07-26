// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RENDER ===============================
// Phase: REFUND-B1 (spec §R.22). Pure render helpers for the native
// purchase-order administration screens. No Supabase, no state mutation:
// receive (state, handlers) and return DOM nodes. All action availability
// is read from the server-derived `acoes` object on each order
// (§R.22.10) — the client never decides which actions are allowed.
//
// Emission (PHASE-C5, OC-C5-EMISSION-001): the Emitir control's enabled
// state derives EXCLUSIVELY from the server `acoes.emitir` flag
// (obter_ordem_compra_admin, db/77) — never recomputed client-side. When
// enabled it opens the CONTROLLED_IRREVERSIBLE_TRANSITION confirmation modal
// (handlers.emitir, ordem-compra-events.js); when disabled it shows the
// server `bloqueio_emissao` reason. `status_aceite` is surfaced on the header
// for native orders (nao_aplicavel/pendente/aceita/rejeitada, §R.7); no
// acceptance/rejection control exists here (that is PHASE-C5B, not authorized).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  var el = window.el;
  var LEGACY_ITEM_MUTATION_ENABLED = false;
  ns.LEGACY_ITEM_MUTATION_ENABLED = LEGACY_ITEM_MUTATION_ENABLED;

  var STATUS_LABEL = { rascunho: 'Rascunho', emitida: 'Emitida', cancelada: 'Cancelada' };
  var RECEB_LABEL = { nao_recebido: 'Não recebido', parcial: 'Recebimento parcial', recebido: 'Recebido' };
  // Server-derived emission blockers (obter_ordem_compra_admin, db/77). The
  // client renders these reasons honestly; it never recomputes readiness.
  var BLOQUEIO_LABEL = {
    distribuicao_necessidades_pendente:
      'Conclua a distribuição de necessidades de todos os itens para habilitar a emissão.',
    emissao_bloqueada_exige_aceite:
      'Esta ordem exige aceite; a decisão de aceite ainda não está disponível nesta fase.',
    // Defensive: an environment without db/77 (or db/69's terminal body) may
    // still return this legacy readiness code.
    recebimento_nativo_ainda_inativo:
      'Distribuição completa — a emissão aguarda a ativação do recebimento nativo (Fase C).',
  };
  ns.BLOQUEIO_LABEL = BLOQUEIO_LABEL;

  // Acceptance status (status_aceite, §R.7). Frozen at emission
  // (nao_aplicavel when exige_aceite=false; pendente when true), then
  // aceita/rejeitada only by an explicit decision (PHASE-C5B — no such control
  // exists here). `pendente` is NEVER shown as accepted.
  var ACEITE_LABEL = {
    nao_aplicavel: 'Aceite não aplicável',
    pendente: 'Aguardando aceite',
    aceita: 'Aceite confirmado',
    rejeitada: 'Aceite rejeitado',
  };
  ns.ACEITE_LABEL = ACEITE_LABEL;

  function badge(text, bg, fg) {
    return el('span', {
      style: 'display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;'
        + 'padding:3px 10px;border-radius:var(--rv-radius-pill);white-space:nowrap;background:' + bg + ';color:' + fg + ';',
    }, text);
  }

  function modeloBadge(modelo) {
    return modelo === 'nativo'
      ? badge('Nativa', 'var(--rv-pill-info-bg)', 'var(--rv-accent-blue)')
      : badge('Legado', 'var(--rv-surface-subtle)', 'var(--rv-text-tertiary)');
  }

  function statusBadge(status) {
    var map = {
      rascunho: ['var(--rv-signal-caution-bg)', 'var(--rv-signal-caution)'],
      emitida: ['var(--rv-pill-info-bg)', 'var(--rv-accent-blue)'],
      cancelada: ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)'],
    };
    var c = map[status] || ['var(--rv-surface-subtle)', 'var(--rv-text-tertiary)'];
    return badge(STATUS_LABEL[status] || status, c[0], c[1]);
  }

  // Acceptance-status pill (§R.7). Canonical --rv-* tokens (contract §10): a
  // neutral chip for nao_aplicavel and distinct soft semantic pastels + token
  // foregrounds for the others. `pendente` uses the warning treatment, never the
  // success/accepted one. Returns null for an unknown/absent value so a fixture
  // without status_aceite (or a legacy order) renders no badge.
  function statusAceiteBadge(statusAceite) {
    var colors = {
      nao_aplicavel: ['var(--rv-color-chip-bg)', 'var(--rv-color-muted)'],
      pendente: ['var(--rv-signal-caution-bg)', 'var(--rv-color-warning)'],
      aceita: ['var(--rv-signal-positive-bg)', 'var(--rv-color-success)'],
      rejeitada: ['var(--rv-surface)', 'var(--rv-color-danger)'],
    };
    var c = colors[statusAceite];
    if (!c) return null;
    return el('span', {
      id: 'oc-status-aceite',
      'data-status-aceite': statusAceite,
      style: 'display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;'
        + 'padding:3px 10px;border-radius:var(--rv-radius-pill);white-space:nowrap;'
        + 'background:' + c[0] + ';color:' + c[1] + ';',
    }, ACEITE_LABEL[statusAceite] || statusAceite);
  }
  ns.statusAceiteBadge = statusAceiteBadge;

  function fioLabel(item) {
    var mat = item.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = item.cor_nome || item.cor_poliester || '—';
    return mat + ' · ' + cor;
  }
  ns.fioLabel = fioLabel;

  function fmtKg(v) {
    if (v == null) return '—';
    return (typeof window.fmtKg === 'function') ? window.fmtKg(v) : String(v);
  }

  // ---- LIST -----------------------------------------------------------
  ns.renderList = function (state, handlers) {
    var box = el('div', { id: 'ordens-compra-list' });

    var header = el('div', { class: 'flex justify-between items-center mb-4' },
      el('h1', { class: 'text-2xl font-bold' }, 'Ordens de compra'));
    box.appendChild(header);

    if (state.indisponivel) {
      box.appendChild(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' },
        'Administração de ordens de compra indisponível neste ambiente (migração db/68 não aplicada).'));
      return box;
    }

    if (!state.ordens.length) {
      box.appendChild(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' },
        'Nenhuma ordem de compra ainda.'));
      return box;
    }

    var wrap = el('div', { class: 'bg-white rounded-xl shadow overflow-hidden' });
    var table = el('table', { class: 'w-full' });
    var thead = el('thead', { class: 'bg-gray-50 border-b' });
    thead.appendChild(el('tr', {},
      el('th', { class: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase' }, 'Modelo'),
      el('th', { class: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase' }, 'Fornecedor'),
      el('th', { class: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase' }, 'Situação'),
      el('th', { class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Itens'),
      el('th', { class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' }, '')));
    var tbody = el('tbody', { class: 'divide-y divide-gray-100' });
    state.ordens.forEach(function (o) {
      var tr = el('tr', { class: 'hover:bg-gray-50', 'data-ordem-id': String(o.ordem_id) });
      tr.appendChild(el('td', { class: 'px-4 py-3 text-sm' }, modeloBadge(o.modelo)));
      tr.appendChild(el('td', { class: 'px-4 py-3 text-sm text-gray-800' }, o.fornecedor_nome || '— não atribuído'));
      tr.appendChild(el('td', { class: 'px-4 py-3 text-sm' }, statusBadge(o.status_administrativo)));
      tr.appendChild(el('td', { class: 'px-4 py-3 text-sm text-right text-gray-800', style: 'font-variant-numeric:tabular-nums;' }, String(o.itens_total)));
      tr.appendChild(el('td', { class: 'px-4 py-3 text-right' },
        el('button', {
          class: 'text-sm text-blue-700 hover:underline',
          onclick: function () { handlers.verOrdem(o.ordem_id); },
        }, 'Ver ordem')));
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    return box;
  };

  // ---- DETAIL ---------------------------------------------------------
  ns.renderDetail = function (state, handlers) {
    var box = el('div', { id: 'ordem-compra-detail' });

    box.appendChild(el('div', { class: 'mb-4' },
      el('button', { class: 'text-sm text-blue-700 hover:underline', onclick: function () { handlers.voltar(); } }, '← Ordens de compra')));

    if (state.indisponivel) {
      box.appendChild(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' },
        'Administração de ordens de compra indisponível neste ambiente (migração db/68 não aplicada).'));
      return box;
    }

    var o = state.ordem;
    if (!o) {
      box.appendChild(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' }, 'Ordem de compra não encontrada.'));
      return box;
    }

    var acoes = o.acoes || {};

    // Header card
    var head = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' });
    head.appendChild(el('div', { class: 'flex items-center gap-3 mb-3 flex-wrap' },
      el('h1', { class: 'text-xl font-bold' }, 'Ordem de compra #' + o.ordem_id),
      modeloBadge(o.modelo), statusBadge(o.status_administrativo),
      o.modelo === 'nativo' ? statusAceiteBadge(o.status_aceite) : null));
    head.appendChild(el('div', { class: 'text-sm text-gray-600' },
      'Fornecedor: ' + (o.fornecedor_nome || '— não atribuído')));
    if (o.modelo === 'legado') {
      head.appendChild(el('div', { class: 'mt-2 text-xs text-gray-500' },
        'Ordem importada do modelo legado — inerte no novo modelo (administração pela via legada).'));
    }

    // Actions row (server-derived)
    var actions = el('div', { class: 'flex items-center gap-2 mt-4' });
    if (acoes.cancelar) {
      actions.appendChild(el('button', {
        id: 'oc-cancelar',
        class: 'border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold px-3 py-2 rounded-lg',
        onclick: function () { handlers.cancelar(o); },
      }, 'Cancelar ordem'));
    }
    if (o.pedido_id) {
      actions.appendChild(el('button', {
        id: 'oc-abrir-pedido', class: 'text-blue-700 text-sm font-semibold px-3 py-2',
        onclick: function () { handlers.verPedido(o.pedido_id); },
      }, 'Abrir Pedido'));
    }
    // Emission (PHASE-C5) — the enabled state derives EXCLUSIVELY from the
    // server acoes.emitir flag (db/77), never recomputed client-side. Enabled:
    // primary/neutral accent button that opens the CONTROLLED_IRREVERSIBLE_
    // TRANSITION confirmation modal (§21). Disabled: honest disabled state with
    // the server bloqueio_emissao reason. NOT the destructive-red treatment.
    var podeEmitir = acoes.emitir === true;
    var emitBtn;
    if (podeEmitir) {
      emitBtn = el('button', {
        id: 'oc-emitir',
        class: 'text-white text-sm font-semibold px-3 py-2 hover:opacity-90',
        style: 'background:var(--rv-color-accent);border-radius:var(--rv-radius-control);',
        onclick: function () { handlers.emitir(o); },
      }, 'Emitir ordem');
    } else {
      emitBtn = el('button', {
        id: 'oc-emitir',
        class: 'text-sm font-semibold px-3 py-2',
        style: 'background:var(--rv-color-chip-bg);color:var(--rv-color-muted);'
          + 'border-radius:var(--rv-radius-control);cursor:not-allowed;opacity:0.6;',
        title: BLOQUEIO_LABEL[o.bloqueio_emissao] || 'Emissão indisponível nesta fase.',
        disabled: true,
      }, 'Emitir ordem');
    }
    actions.appendChild(emitBtn);
    head.appendChild(actions);

    // Readiness / blocker context (server-derived, §7 matrix). Emittable orders
    // show a readiness + irreversibility note; blocked orders show the honest
    // server reason.
    if (podeEmitir) {
      head.appendChild(el('div', { id: 'oc-emissao-pronta', class: 'mt-2 text-xs', style: 'color:var(--rv-color-success);' },
        'Distribuição completa — pronta para emissão. A emissão é definitiva (reversível apenas por cancelamento).'));
    } else if (o.bloqueio_emissao) {
      head.appendChild(el('div', { id: 'oc-bloqueio-emissao', class: 'mt-2 text-xs text-amber-700' },
        BLOQUEIO_LABEL[o.bloqueio_emissao] || o.bloqueio_emissao));
    }

    // An emitted order that awaits acceptance is NOT lifecycle-complete until the
    // acceptance decision ships (PHASE-C5B) — surfaced honestly (§21). Currently
    // unreachable via the canonical path (exige_aceite is seeded false), so this
    // is a defensive notice; no acceptance/rejection control is offered.
    if (o.status_administrativo === 'emitida' && o.status_aceite === 'pendente') {
      head.appendChild(el('div', { id: 'oc-aceite-pendente-aviso', class: 'mt-2 text-xs', style: 'color:var(--rv-color-warning);' },
        'Ordem emitida, aguardando aceite — o fluxo de aceite ainda não está disponível, portanto a ordem ainda não está concluída.'));
    }
    box.appendChild(head);

    // Items
    var itemsCard = el('div', { class: 'bg-white rounded-xl shadow overflow-hidden mb-4' });
    itemsCard.appendChild(el('div', { class: 'px-5 py-3 border-b text-xs font-semibold text-gray-600 uppercase' }, 'Itens'));
    var items = o.itens || [];
    if (!items.length) {
      itemsCard.appendChild(el('div', { class: 'p-6 text-center text-gray-500 text-sm' }, 'Nenhum item neste rascunho.'));
    } else {
      var t = el('table', { class: 'w-full' });
      var th = el('thead', { class: 'bg-gray-50 border-b' });
      th.appendChild(el('tr', {},
        el('th', { class: 'px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase' }, 'Fio'),
        el('th', { class: 'px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Kg pedido'),
        el('th', { class: 'px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Kg alocado'),
        el('th', { class: 'px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase' }, '')));
      var tb = el('tbody', { class: 'divide-y divide-gray-100' });
      items.forEach(function (it) {
        var tr = el('tr', { 'data-item-id': String(it.item_id) });
        tr.appendChild(el('td', { class: 'px-4 py-2 text-sm text-gray-800' }, fioLabel(it)));
        tr.appendChild(el('td', { class: 'px-4 py-2 text-sm text-right text-gray-800', style: 'font-variant-numeric:tabular-nums;' }, fmtKg(it.kg_pedido)));
        tr.appendChild(el('td', { class: 'px-4 py-2 text-sm text-right text-gray-500', style: 'font-variant-numeric:tabular-nums;' }, fmtKg(it.kg_alocado)));
        var actTd = el('td', { class: 'px-4 py-2 text-right whitespace-nowrap' });
        tr.appendChild(actTd);
        tb.appendChild(tr);
      });
      t.appendChild(th); t.appendChild(tb);
      itemsCard.appendChild(t);
    }
    box.appendChild(itemsCard);

    // Distribution of native needs (PRE-PROD-A, §R.23.10) — native orders only.

    // Event history
    var evCard = el('div', { class: 'bg-white rounded-xl shadow overflow-hidden' });
    evCard.appendChild(el('div', { class: 'px-5 py-3 border-b text-xs font-semibold text-gray-600 uppercase' }, 'Histórico'));
    var evs = state.eventos || [];
    if (!evs.length) {
      evCard.appendChild(el('div', { class: 'p-6 text-center text-gray-500 text-sm' }, 'Sem eventos administrativos.'));
    } else {
      var list = el('div', { class: 'divide-y divide-gray-100' });
      evs.forEach(function (e) {
        list.appendChild(el('div', { class: 'px-5 py-3 text-sm text-gray-700 flex justify-between' },
          el('span', {}, (e.tipo_evento || '') + (e.valor_anterior ? (' (' + e.valor_anterior + ' → ' + e.valor_novo + ')') : '')),
          el('span', { class: 'text-gray-400 text-xs' }, e.criado_em ? String(e.criado_em).slice(0, 19).replace('T', ' ') : '')));
      });
      evCard.appendChild(list);
    }
    box.appendChild(evCard);

    return box;
  };
})(window);
