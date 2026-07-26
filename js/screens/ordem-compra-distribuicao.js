// =====================================================================
// === SCREENS: ORDEM DE COMPRA — DISTRIBUIÇÃO (child of the detail) ====
// Phase: PRE-PROD-A (spec §R.23.10). Focused child module of the dedicated
// purchase-order detail screen (#/ordens-compra/:id). Owns the native yarn
// need DISTRIBUTION (allocation) surface for a native draft order:
//
//   - preview / synchronize native needs (Pedido level);
//   - show, per item, the compatible native needs + current allocations
//     with OP attribution, remaining need, and item reconciliation;
//   - preserve the allocation surface as read-only until Phase F2;
//   - show complete / incomplete distribution + the disabled-emission
//     reason (Phase-C native receipt), never authorizing emission.
//
// Server authority: every field comes from obter_distribuicao_ordem_compra
// The client reconstructs no authority (§R.23.8).
//
// F1 installs the server contract only. Phase F2 owns UI activation and
// migration from the legacy mutation paths.
//
// Load via <script src="js/screens/ordem-compra-distribuicao.js"></script>
// among the ordem-compra-* children, BEFORE ordem-compra.js, and AFTER
// js/screens/op-compra-regime.js (need synchronization wrapper).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompraDistribuicao = window.RAVATEX_SCREENS.ordemCompraDistribuicao || {};

  var ALLOCATION_ENABLED = false;
  ns.ALLOCATION_ENABLED = ALLOCATION_ENABLED;

  var el = window.el;

  function fmtKg(v) {
    if (v == null) return '—';
    return (typeof window.fmtKg === 'function') ? window.fmtKg(v) : String(v);
  }

  function fioLabelItem(it) {
    var mat = it.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = it.cor_nome || it.cor_poliester || '—';
    return mat + ' · ' + cor;
  }

  // Data: server-composed distribution read model for one order.
  ns.carregar = async function (ordemId) {
    var res = await window.supa.rpc('obter_distribuicao_ordem_compra', { p_ordem_id: Number(ordemId) });
    if (res.error) return { ok: false, codigo: 'transporte', erro: 'Falha ao carregar distribuição', error: res.error };
    return res.data || { ok: false, codigo: 'resposta_vazia', erro: 'Distribuição vazia' };
  };

  // Render one item's distribution block (reconciliation + allocations + needs).
  function renderItem(it) {
    var completoItem = Number(it.kg_diferenca) === 0 && Number(it.kg_pedido) > 0;
    var card = el('div', { style: 'border-radius:var(--rv-radius);', class: 'border border-gray-100 p-4 mb-3', 'data-dist-item-id': String(it.item_id) });

    card.appendChild(el('div', { class: 'flex justify-between items-center mb-2' },
      el('div', { class: 'text-sm font-semibold text-gray-800' }, fioLabelItem(it)),
      el('div', { class: 'text-xs', style: 'font-variant-numeric:tabular-nums;color:' + (completoItem ? 'var(--rv-signal-positive)' : 'var(--rv-signal-caution)') + ';' },
        'Pedido ' + fmtKg(it.kg_pedido) + ' · Alocado ' + fmtKg(it.kg_alocado) + ' · Diferença ' + fmtKg(it.kg_diferenca))));

    // Current allocations (with OP attribution)
    var alocs = it.alocacoes || [];
    if (alocs.length) {
      var al = el('div', { class: 'mb-2' });
      alocs.forEach(function (a) {
        var row = el('div', { class: 'flex justify-between items-center text-xs text-gray-600 py-1', 'data-alocacao-id': String(a.alocacao_id) });
        var origem = a.op_id == null
          ? 'Pedido compartilhado'
          : 'OP ' + (a.op_numero != null ? a.op_numero : a.op_id) + (a.op_ano ? ('/' + a.op_ano) : '');
        row.appendChild(el('span', {}, origem + ' — ' + fmtKg(a.kg_alocado) + ' kg'));
        var rm = el('button', {
          class: 'text-red-600 hover:underline' + (ALLOCATION_ENABLED ? '' : ' opacity-40 cursor-not-allowed'),
          disabled: ALLOCATION_ENABLED ? null : true,
        }, 'Remover');
        if (ALLOCATION_ENABLED) rm.onclick = function () { ns._handlers && ns._handlers.removerAlocacao(a.alocacao_id); };
        row.appendChild(rm);
        al.appendChild(row);
      });
      card.appendChild(al);
    }

    // Compatible needs (with remaining)
    var needs = it.necessidades_compativeis || [];
    var needBox = el('div', { class: 'text-xs text-gray-500' });
    if (!needs.length) {
      needBox.appendChild(el('div', {}, 'Nenhuma necessidade nativa compatível — sincronize as necessidades do Pedido.'));
    } else {
      needs.forEach(function (n) {
        needBox.appendChild(el('div', { class: 'py-0.5', 'data-necessidade-id': String(n.necessidade_id) },
          'Necessidade ' + (n.origem_tipo === 'op' ? ('OP ' + (n.op_numero != null ? n.op_numero : n.op_id)) : 'Pedido')
          + ' — precisa ' + fmtKg(n.kg_necessario) + ', restante ' + fmtKg(n.kg_restante)));
      });
    }
    card.appendChild(needBox);

    // Absolute-allocation control remains visible but disabled until F2.
    if ((it.acoes && it.acoes.alocar)) {
      var ctl = el('div', { class: 'mt-3' });
      var btn = el('button', {
        style: 'border-radius:var(--rv-radius);', class: 'text-sm font-semibold px-3 py-1.5 '
          + (ALLOCATION_ENABLED ? 'bg-blue-700 hover:bg-blue-800 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'),
        title: ALLOCATION_ENABLED ? 'Distribuir necessidade' : 'Distribuição disponível após a Fase F2.',
        disabled: ALLOCATION_ENABLED ? null : true,
      }, 'Distribuir');
      if (ALLOCATION_ENABLED) btn.onclick = function () { ns._handlers && ns._handlers.abrirDistribuir(it); };
      ctl.appendChild(btn);
      card.appendChild(ctl);
    }
    return card;
  }

  // Pure render of the distribution section for the detail screen.
  // `distrib` is the obter_distribuicao_ordem_compra envelope; `handlers`
  // carries reload + sincronizarNecessidades.
  ns.renderSection = function (distrib, handlers) {
    ns._handlers = handlers || {};
    var card = el('div', { id: 'oc-distribuicao', style: 'border-radius:var(--rv-radius);', class: 'bg-white shadow overflow-hidden mb-4' });
    var heading = el('div', { class: 'px-5 py-3 border-b flex justify-between items-center gap-3' },
      el('div', { class: 'text-xs font-semibold text-gray-600 uppercase' }, 'Distribuição de necessidades'));
    if (ALLOCATION_ENABLED && distrib && distrib.ordem && distrib.ordem.pedido_id) {
      var syncBtn = el('button', {
        class: 'text-xs font-semibold text-blue-700 hover:underline',
      }, 'Sincronizar necessidades');
      syncBtn.onclick = function () {
        if (ns._handlers && ns._handlers.sincronizarNecessidades) {
          ns._handlers.sincronizarNecessidades(distrib.ordem.pedido_id);
        }
      };
      heading.appendChild(syncBtn);
    }
    card.appendChild(heading);

    if (!distrib || distrib.ok !== true) {
      card.appendChild(el('div', { class: 'p-6 text-center text-gray-500 text-sm' },
        (distrib && distrib.erro) ? distrib.erro : 'Distribuição indisponível.'));
      return card;
    }

    var body = el('div', { class: 'p-5' });

    // Completeness + emission-block reason (server-derived; never authorizes emission).
    var completa = distrib.distribuicao_completa === true;
    body.appendChild(el('div', { id: 'oc-dist-status', class: 'text-sm font-semibold mb-1', style: 'color:' + (completa ? 'var(--rv-signal-positive)' : 'var(--rv-signal-caution)') + ';' },
      completa ? 'Distribuição completa' : 'Distribuição incompleta'));
    if (distrib.bloqueio_emissao === 'recebimento_nativo_ainda_inativo') {
      body.appendChild(el('div', { class: 'text-xs text-amber-700 mb-3' },
        'Distribuição completa — a emissão aguarda a ativação do recebimento nativo (Fase C).'));
    } else if (distrib.bloqueio_emissao === 'distribuicao_necessidades_pendente') {
      body.appendChild(el('div', { class: 'text-xs text-amber-700 mb-3' },
        'Complete a alocação de todos os itens para habilitar a emissão (que ainda aguarda a Fase C).'));
    }

    if (!ALLOCATION_ENABLED) {
      body.appendChild(el('div', { style: 'border-radius:var(--rv-radius);', class: 'text-xs text-gray-500 mb-3 bg-gray-50 border border-gray-100 p-2' },
        'Distribuição em modo somente leitura — a ativação dos controles ocorrerá na Fase F2.'));
    }

    var itens = distrib.itens || [];
    if (!itens.length) {
      body.appendChild(el('div', { class: 'text-sm text-gray-500' }, 'Nenhum item para distribuir.'));
    } else {
      itens.forEach(function (it) { body.appendChild(renderItem(it)); });
    }

    card.appendChild(body);
    return card;
  };
})(window);
