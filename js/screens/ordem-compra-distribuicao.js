// =====================================================================
// === SCREENS: ORDEM DE COMPRA — PROVENIÊNCIA (child of the detail) ====
//
// PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1.
//
// O QUE ESTE MÓDULO ERA E POR QUE MUDOU
//   Ele projetava uma superfície de DISTRIBUIÇÃO com controles de alocação
//   desligados por uma constante local (`ALLOCATION_ENABLED = false`),
//   um botão "Sincronizar necessidades" e a frase "a ativação dos controles
//   ocorrerá na Fase F2". Nada disso era alcançável: `renderSection` NUNCA
//   era chamado por `renderDetail`, então as duas leituras de rede que a
//   alimentavam (`obter_distribuicao_ordem_compra` e a resolução de
//   identidade de OP) rodavam a cada abertura do Pedido de Compra e o
//   resultado era descartado.
//
//   Além disso a autoridade de planejamento mudou: quem decide fornecedor e
//   quantidade é a tela `Pedido -> Planejamento de compras` (db/99), não o
//   Pedido de Compra. Reativar controles de alocação aqui criaria uma
//   SEGUNDA autoridade sobre o mesmo fato.
//
// O QUE ELE É AGORA
//   A seção de PROVENIÊNCIA, somente leitura: de onde veio cada quilo deste
//   documento. Pedido de origem, necessidade atendida, OP (ou Pedido
//   compartilhado), quantidade originalmente alocada por origem, quantidade
//   pedida do item e a reconciliação entre as duas. Quando a ordem está
//   cancelada, a seção diz explicitamente que aquelas quantidades são
//   história e já voltaram ao planejamento.
//
//   ZERO controles de mutação: sem alocar, sem remover alocação, sem
//   atribuir fornecedor, sem sincronizar necessidades.
//
// Autoridade do servidor: todo campo vem de `obter_distribuicao_ordem_compra`
// e de `public.op_identidade_projecao` (db/95). O cliente não reconstrói
// autoridade nenhuma (§R.23.8).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompraDistribuicao = window.RAVATEX_SCREENS.ordemCompraDistribuicao || {};

  // A fronteira de ativação F2 não é mais "um interruptor a ligar um dia":
  // ela foi RESOLVIDA. O planejamento pertence a Pedido › Planejamento de
  // compras (db/99) e esta superfície é somente leitura por construção — não
  // constrói nenhum controle de alocação, nem desligado. A constante
  // permanece e passou a ser EXECUTÁVEL: o render abaixo falha fechado se
  // alguém a ligar sem reabrir a decisão de autoridade, em vez de silenciosa-
  // mente materializar uma segunda autoridade sobre fornecedor e quantidade.
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
  ns.fioLabelItem = fioLabelItem;

  // Data: server-composed distribution read model for one order. Continua
  // sendo a ÚNICA fonte da proveniência exibida abaixo.
  ns.carregar = async function (ordemId) {
    var res = await window.supa.rpc('obter_distribuicao_ordem_compra', { p_ordem_id: Number(ordemId) });
    if (res.error) return { ok: false, codigo: 'transporte', erro: 'Falha ao carregar a proveniência', error: res.error };
    var data = res.data || { ok: false, codigo: 'resposta_vazia', erro: 'Proveniência vazia' };
    // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: a RPC atribui origem apenas por
    // `op_id`; a identidade canonica vem de public.op_identidade_projecao
    // (db/95). Resolvida UMA vez por carga, para os ids realmente exibidos.
    ns._opIdentidades = await window.RAVATEX_SCREENS.ordemCompra
      .carregarIdentidadesOp(ns.coletarOpIds(data));
    return data;
  };

  // Todos os `op_id` alcancaveis no read model: alocacoes atuais e
  // necessidades compativeis, por item.
  ns.coletarOpIds = function (data) {
    var ids = [];
    ((data && data.itens) || []).forEach(function (it) {
      (it.alocacoes || []).forEach(function (a) { if (a && a.op_id != null) ids.push(a.op_id); });
      (it.necessidades_compativeis || []).forEach(function (n) { if (n && n.op_id != null) ids.push(n.op_id); });
    });
    return ids;
  };

  // necessidade_id -> a necessidade projetada, para nomear a EXIGÊNCIA que
  // cada alocação atende sem imprimir a chave primária como se fosse nome.
  function needsById(item) {
    var map = {};
    (item.necessidades_compativeis || []).forEach(function (n) {
      if (n && n.necessidade_id != null) map[String(n.necessidade_id)] = n;
    });
    return map;
  }

  // Origem de negócio de uma alocação: a identidade canônica da OP, ou o
  // estado honesto "Pedido compartilhado" quando a origem é o próprio Pedido.
  function origemLabel(opId) {
    return window.RAVATEX_OP_DISPLAY.formatOpIdentityFromMap(
      opId, ns._opIdentidades, 'Pedido compartilhado');
  }
  ns.origemLabel = origemLabel;

  function metaLine(label, value) {
    return el('div', { style: 'font-size:var(--rv-fs-xs);color:var(--rv-color-muted);' },
      label + ': ' + value);
  }

  // Um bloco por item: identidade do fio, quantidade pedida, reconciliação e
  // a lista de origens que a compõem. Somente leitura por construção — nenhum
  // nó interativo é criado aqui.
  function renderItem(item, cancelada) {
    var alocado = Number(item.kg_alocado);
    var diferenca = Number(item.kg_diferenca);
    var conciliado = diferenca === 0 && Number(item.kg_pedido) > 0;
    var needs = needsById(item);

    var card = el('div', {
      style: 'border:1px solid var(--rv-color-line-100);border-radius:var(--rv-radius-card);'
        + 'padding:12px 14px;margin-bottom:10px;',
      'data-prov-item-id': String(item.item_id),
    });

    card.appendChild(el('div', {
      class: 'flex justify-between items-center gap-3 flex-wrap',
    },
      el('div', { style: 'font-size:var(--rv-fs-body);font-weight:600;color:var(--rv-color-value);' },
        fioLabelItem(item)),
      el('div', {
        class: 'tnum',
        style: 'font-size:var(--rv-fs-xs);font-variant-numeric:tabular-nums;color:'
          + (conciliado ? 'var(--rv-signal-positive)' : 'var(--rv-signal-caution)') + ';',
        'data-prov-reconciliacao': conciliado ? 'conciliado' : 'divergente',
      },
        'Pedido ' + fmtKg(item.kg_pedido)
        + ' · Alocado ' + fmtKg(alocado)
        + ' · Diferença ' + fmtKg(diferenca))));

    var alocs = item.alocacoes || [];
    if (!alocs.length) {
      card.appendChild(el('div', {
        style: 'font-size:var(--rv-fs-xs);color:var(--rv-color-muted);margin-top:8px;',
      }, 'Este item não tem origem registrada.'));
      return card;
    }

    var list = el('div', { style: 'margin-top:8px;' });
    alocs.forEach(function (a) {
      var need = needs[String(a.necessidade_id)] || null;
      var row = el('div', {
        style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;'
          + 'padding:6px 0;border-top:1px solid var(--rv-color-line-100);',
        'data-alocacao-id': String(a.alocacao_id),
      });
      var left = el('div', { style: 'min-width:0;' },
        el('div', { style: 'font-size:var(--rv-fs-sm);color:var(--rv-color-value);' },
          origemLabel(a.op_id)));
      // A EXIGÊNCIA atendida é nomeada pelo que o operador reconhece — fio e
      // origem —, nunca pela chave primária da necessidade.
      left.appendChild(metaLine('Necessidade',
        fioLabelItem(item)
        + (need ? (' · precisa ' + fmtKg(need.kg_necessario)
                   + ', restante ' + fmtKg(need.kg_restante)) : '')));
      row.appendChild(left);
      row.appendChild(el('div', {
        class: 'tnum',
        style: 'font-size:var(--rv-fs-sm);font-variant-numeric:tabular-nums;'
          + 'color:var(--rv-color-value);white-space:nowrap;'
          + (cancelada ? 'text-decoration:line-through;opacity:.65;' : ''),
      }, fmtKg(a.kg_alocado)));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  // renderProvenance(distrib, ordem) -> nó DOM, ou null quando não há
  // proveniência a mostrar (ordem legada, ou leitura indisponível numa ordem
  // sem itens). NUNCA recebe handlers: não existe ação nesta seção.
  ns.renderProvenance = function (distrib, ordem) {
    // Fail closed: a proveniência é somente leitura por contrato. Se alguém
    // ligar a constante esperando que esta seção volte a alocar, o erro
    // aparece aqui em vez de a tela abrir uma segunda autoridade sobre
    // fornecedor e quantidade.
    if (ALLOCATION_ENABLED) {
      throw new Error('ordem-compra-distribuicao: a proveniencia nao constroi controles de alocacao; '
        + 'o planejamento pertence a Pedido > Planejamento de compras');
    }
    if (!ordem || ordem.modelo !== 'nativo') return null;

    var card = el('div', {
      id: 'oc-proveniencia',
      class: 'overflow-hidden mb-4',
      style: 'background:var(--rv-color-surface);border:1px solid var(--rv-color-line-200);'
        + 'border-radius:var(--rv-radius-card);',
    });
    card.appendChild(el('div', {
      class: 'px-5 py-3 text-xs font-semibold uppercase',
      style: 'color:var(--rv-color-section-label);border-bottom:1px solid var(--rv-color-line-200);',
    }, 'Proveniência'));

    if (!distrib || distrib.ok !== true) {
      card.appendChild(el('div', {
        id: 'oc-proveniencia-indisponivel',
        class: 'px-5 py-6 text-center text-sm',
        style: 'color:var(--rv-color-muted);',
      }, (distrib && distrib.erro) ? distrib.erro : 'Proveniência indisponível.'));
      return card;
    }

    var body = el('div', { class: 'p-5' });

    // Identidade do Pedido de origem. `pedido_numero`/`pedido_ano` são
    // projetados por obter_ordem_compra_admin (db/100); sem eles a seção
    // declara o estado diagnóstico em vez de imprimir o UUID.
    var pedidoLabel = (ordem.pedido_numero != null && ordem.pedido_ano != null)
      ? ('Pedido ' + String(ordem.pedido_numero).padStart(3, '0')
         + '/' + String(ordem.pedido_ano))
      : 'Pedido sem identidade comercial atribuída';
    body.appendChild(el('div', {
      id: 'oc-proveniencia-pedido',
      style: 'font-size:var(--rv-fs-sm);color:var(--rv-color-value);font-weight:600;margin-bottom:4px;',
    }, pedidoLabel));
    body.appendChild(el('div', {
      style: 'font-size:var(--rv-fs-xs);color:var(--rv-color-muted);margin-bottom:12px;',
    }, 'Origem de cada quilo deste Pedido de Compra. O planejamento pertence à tela '
      + 'Pedido › Planejamento de compras; esta seção é somente leitura.'));

    // Estado histórico: uma ordem cancelada conserva as suas origens, mas as
    // quantidades já voltaram a ficar disponíveis para novo planejamento.
    var cancelada = ordem.status_administrativo === 'cancelada';
    if (cancelada) {
      body.appendChild(el('div', {
        id: 'oc-proveniencia-cancelada',
        style: 'display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;'
          + 'border-radius:var(--rv-radius-card);padding:10px 14px;margin-bottom:12px;'
          + 'font-size:var(--rv-fs-xs);background:var(--rv-surface-subtle);'
          + 'border:1px solid var(--rv-color-line-200);color:var(--rv-color-muted);',
      }, 'Ordem cancelada: as origens abaixo são histórico. As quantidades já foram '
        + 'liberadas e voltaram a ficar disponíveis para novo planejamento.'));
    }

    var itens = distrib.itens || [];
    if (!itens.length) {
      body.appendChild(el('div', {
        class: 'text-sm', style: 'color:var(--rv-color-muted);',
      }, 'Nenhum item neste Pedido de Compra.'));
    } else {
      itens.forEach(function (it) { body.appendChild(renderItem(it, cancelada)); });
    }

    card.appendChild(body);
    return card;
  };
})(window);
