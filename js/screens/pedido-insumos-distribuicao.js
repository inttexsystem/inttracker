// =====================================================================
// === PEDIDO / INSUMOS — PLANEJAMENTO DE COMPRAS =======================
//
// ETAPA 1 desta tela: decidir qual fornecedor atende cada necessidade do
// Pedido. ETAPA 2, separada e explicita: gerar o Pedido de Compra a
// partir das distribuicoes salvas de UM fornecedor.
//
// O que mudou em relacao a versao anterior (PURCHASE-PLANNING-REFOUNDATION-R1):
//   · atribuir um fornecedor NAO cria mais documento algum. Antes,
//     `definir_alocacao_necessidade_compra_fio` criava a ordem no ato da
//     primeira atribuicao, porque `ordem_compra_item_alocacao.item_id` e
//     NOT NULL e o fornecedor so existia no cabecalho da ordem — nao havia
//     como guardar "planejado, ainda nao comprado". db/99 criou a entidade
//     que faltava e esta tela passou a falar com ela;
//   · o numero do Pedido de Compra saiu daqui. Ele aparece uma vez so, ja
//     sugerido e editavel, na confirmacao da geracao;
//   · a distribuicao deixou de ser um modal por necessidade e virou linha
//     inline, porque a tela e uma fila de trabalho (arquetipo B) e nao um
//     formulario de uma entidade.
//
// O servidor continua sendo a autoridade: compatibilidade fornecedor x
// material, teto da necessidade, unicidade do codigo e elegibilidade de
// geracao sao decididos em db/99, nunca aqui.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var el = window.el;

  var QTY_PATTERN = /^\d+(\.\d{1,3})?$/;

  // Situacao -> rotulo visivel. A familia da pilha vem de js/badges.js pelo
  // proprio rotulo; pendente e parcial caem na MESMA familia (caution), por
  // isso a linha numerica "faltam X kg" abaixo e obrigatoria: contraste §2.6
  // proibe distinguir estado so por cor.
  var SITUACAO_LABEL = {
    pendente: 'Pendente',
    parcial: 'Parcialmente distribuído',
    distribuido: 'Distribuído',
  };

  var SITUACAO_PILL_STATE = {
    pendente: 'pendente',
    parcial: 'parcial',
    distribuido: 'concluido',
  };

  function kg(value) {
    return typeof window.fmtKg === 'function' ? window.fmtKg(value) : String(value || 0);
  }

  function commandKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'plan-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function errorText(code, fallback) {
    var texts = {
      sem_permissao: 'Você não tem permissão para planejar compras deste Pedido.',
      pedido_invalido: 'O Pedido informado é inválido.',
      nao_encontrada: 'O Pedido de Compra não foi encontrado. Recarregue a tela.',
      necessidade_nao_encontrada: 'A necessidade não foi encontrada. Recarregue a tela.',
      necessidade_invalida: 'Esta necessidade não é distribuível.',
      fornecedor_invalido: 'O fornecedor não foi encontrado.',
      fornecedor_incompativel: 'Este fornecedor não atende o tipo de fio desta necessidade.',
      kg_invalido: 'Informe uma quantidade válida, com até três casas decimais.',
      excede_saldo: 'A quantidade excede o saldo ainda não distribuído desta necessidade.',
      idempotencia_invalida: 'Comando inválido. Recarregue a tela e tente de novo.',
      idempotencia_conflitante: 'Esta chave de comando já foi usada com uma ação diferente. Recarregue a tela.',
      planejamento_gerado: 'Esta distribuição já virou Pedido de Compra e não pode ser alterada aqui.',
      planejamento_nao_encontrado: 'Alguma distribuição selecionada não existe mais. Recarregue a tela.',
      planejamento_ja_gerado: 'Alguma distribuição selecionada já pertence a um Pedido de Compra. Recarregue a tela.',
      selecao_vazia: 'Selecione ao menos uma distribuição.',
      selecao_invalida: 'O conjunto de distribuições enviado é inválido. Recarregue a tela.',
      selecao_duplicada: 'A mesma necessidade aparece mais de uma vez na seleção.',
      fornecedor_duplicado: 'O mesmo fornecedor aparece mais de uma vez nesta necessidade. Some as quantidades em uma única linha.',
      rascunho_em_aberto: 'Já existe um Pedido de Compra em rascunho para este fornecedor neste Pedido. Emita ou cancele aquele antes de gerar outro.',
      fornecedor_misturado: 'Um Pedido de Compra pertence a um único fornecedor. Selecione somente distribuições do mesmo fornecedor.',
      pedido_misturado: 'Um Pedido de Compra pertence a um único Pedido.',
      pedido_incoerente: 'A necessidade não pertence a este Pedido.',
      pedido_sem_identidade: 'O Pedido ainda não tem número e ano definidos, então não é possível sugerir um número de compra.',
      codigo_ordem_invalido: 'O número deve ter até 40 caracteres, sem espaço no início ou fim.',
      codigo_ordem_duplicado: 'Já existe um Pedido de Compra com este número. Escolha outro.',
      sugestao_desatualizada: 'A numeração deste Pedido avançou enquanto a confirmação estava aberta. Confira o número sugerido e confirme novamente.',
    };
    return texts[code] || fallback || 'Não foi possível concluir a operação.';
  }

  // ---------------------------------------------------------------------
  // Leitura — dono unico e servidor
  // ---------------------------------------------------------------------
  async function loadPlanning(pedidoId) {
    var result = await window.supa.rpc('obter_planejamento_compra_pedido', { p_pedido_id: pedidoId });
    if (result.error) throw result.error;
    if (!result.data || result.data.ok !== true) {
      var err = new Error(errorText(result.data && result.data.codigo));
      err.codigo = result.data && result.data.codigo;
      throw err;
    }
    return result.data;
  }

  function supplierType(need) {
    return need.material === 'algodao' ? 'fio_algodao' : 'fio_poliester';
  }

  function compatibleSuppliers(need, suppliers) {
    var wanted = supplierType(need);
    return (suppliers || []).filter(function (item) { return item.tipo === wanted; });
  }

  function materialLabel(need) {
    var cor = need.cor_nome || need.cor_poliester || '—';
    return (need.material === 'algodao' ? 'Algodão' : 'Poliéster') + ' · ' + cor;
  }

  function needOrigin(need) {
    if (need.origem_tipo === 'op') {
      if (need.op_identidade) return need.op_identidade;
      if (window.RAVATEX_OP_DISPLAY && typeof window.RAVATEX_OP_DISPLAY.formatOpOperationalCode === 'function') {
        return window.RAVATEX_OP_DISPLAY.formatOpOperationalCode({ id: need.op_id });
      }
      return 'OP';
    }
    return 'Pedido compartilhado';
  }

  // Saldo ainda distribuivel da necessidade, ignorando uma linha que esta
  // sendo reeditada — mesmo calculo que db/99 aplica no servidor
  // (kg_necessario - (total - anterior)), quantizado em tres casas porque
  // as colunas sao NUMERIC(12,3) e a subtracao binaria deixa residuo.
  // Uma linha cujo Pedido de Compra foi CANCELADO é história: db/100 a mantém
  // visível e para de contá-la em qualquer saldo. `ativo` é servidor; a
  // ausência da chave (payload anterior a db/100) é lida como ativa, que é o
  // comportamento antigo e o único seguro.
  function isActivePlanRow(row) {
    return !row || row.ativo !== false;
  }

  function planningBalance(need, ignoredPlanId) {
    var necessary = Number(need && need.kg_necessario);
    if (!Number.isFinite(necessary)) return 0;
    var used = 0;
    (need.planejamentos || []).forEach(function (row) {
      if (ignoredPlanId != null && Number(row.planejamento_id) === Number(ignoredPlanId)) return;
      if (!isActivePlanRow(row)) return;
      var value = Number(row.kg_planejado);
      if (Number.isFinite(value)) used += value;
    });
    var available = Math.round((necessary - used) * 1000) / 1000;
    return available > 0 ? available : 0;
  }

  // Fornecedores ja ocupados por uma linha VIVA. Uma linha ja gerada NAO
  // entra: comprar de novo do mesmo fornecedor para a mesma necessidade e
  // legitimo, e foi por isso que a unicidade passou a valer so para a linha
  // viva (db/99, indice necessidade_compra_planejamento_viva_uidx).
  function suppliersAlreadyUsed(need, ignoredPlanId) {
    var used = {};
    (need.planejamentos || []).forEach(function (row) {
      if (row.gerado) return;
      if (ignoredPlanId != null && Number(row.planejamento_id) === Number(ignoredPlanId)) return;
      used[String(row.fornecedor_id)] = true;
    });
    return used;
  }

  // ---------------------------------------------------------------------
  // Primitivas visuais locais — composicao apenas, zero valor proprio
  // ---------------------------------------------------------------------
  var CARD_STYLE = 'background:var(--rv-surface);border:1px solid var(--rv-border);'
    + 'border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);'
    + 'padding:var(--rv-pad-card);margin-bottom:var(--rv-gap-stack);';

  var CARD_FOOTER_STYLE = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;'
    + 'border-top:1px solid var(--rv-border-soft);padding-top:11px;margin-top:12px;flex-wrap:wrap;';

  var BTN_BASE = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;'
    + 'border-radius:var(--rv-radius);font-family:inherit;font-size:var(--rv-fs-body);'
    + 'font-weight:600;padding:0 14px;cursor:pointer;white-space:nowrap;';

  function primaryButton(label, onclick, disabled) {
    var style = BTN_BASE + 'height:var(--rv-h-primary);background:var(--rv-brand);'
      + 'color:var(--rv-text-on-brand);border:none;';
    if (disabled) style += 'opacity:.45;cursor:default;';
    var attrs = { type: 'button', style: style };
    if (disabled) attrs.disabled = true;
    else {
      attrs.onclick = onclick;
      attrs.onmouseenter = function (e) { e.currentTarget.style.background = 'var(--rv-brand-strong)'; };
      attrs.onmouseleave = function (e) { e.currentTarget.style.background = 'var(--rv-brand)'; };
    }
    return el('button', attrs, label);
  }

  function secondaryButton(label, onclick, disabled) {
    var style = BTN_BASE + 'height:var(--rv-h-default);background:var(--rv-surface);'
      + 'color:var(--rv-text-secondary);border:1px solid var(--rv-border-strong);';
    if (disabled) style += 'opacity:.45;cursor:default;';
    var attrs = { type: 'button', style: style };
    if (disabled) attrs.disabled = true;
    else attrs.onclick = onclick;
    return el('button', attrs, label);
  }

  function sectionChip(glyph, label) {
    return el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px;' },
      el('span', {
        'aria-hidden': 'true',
        style: 'width:20px;height:20px;border-radius:var(--rv-radius);background:var(--rv-chip-bg);'
          + 'color:var(--rv-chip-glyph);display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:var(--rv-fs-micro);font-weight:700;flex-shrink:0;',
      }, glyph),
      el('span', {
        style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
          + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);',
      }, label));
  }

  // §2.11 — aviso autonomo ocupa a largura do conteudo e e um cartao.
  function noticeCard(family, text) {
    var skin = {
      caution: 'background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);color:var(--rv-signal-caution);',
      negative: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);color:var(--rv-signal-negative);',
      positive: 'background:var(--rv-signal-positive-bg);border:1px solid var(--rv-signal-positive-border);color:var(--rv-signal-positive);',
    };
    return el('div', {
      style: 'display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;'
        + 'border-radius:var(--rv-radius);padding:12px 16px;margin-bottom:var(--rv-gap-stack);'
        + 'font-size:var(--rv-fs-sm);font-weight:600;'
        + (skin[family] || skin.caution),
    }, text);
  }

  // ---------------------------------------------------------------------
  // Região de erro LOCAL de um modal
  // ---------------------------------------------------------------------
  // Uma recusa de negócio nascia no `notice` do topo da página — que fica
  // ATRÁS do overlay do modal. O operador confirmava, a confirmação continuava
  // aberta e aparentemente sem resposta, e a explicação estava escondida.
  //
  // Cada modal passa a carregar a sua própria região de erro, dentro do seu
  // próprio corpo. Não é um refactor de window.modal: o corpo do modal já é um
  // nó que o chamador constrói, então a solução local é suficiente e o dono
  // compartilhado permanece intocado.
  function modalErrorRegion() {
    var node = el('div', {
      // `role=alert` + `aria-live=assertive` fazem o leitor de tela anunciar a
      // recusa no instante em que ela aparece, sem que o foco precise ir até
      // ela. `aria-atomic` garante que a mensagem seja lida inteira.
      role: 'alert',
      'aria-live': 'assertive',
      'aria-atomic': 'true',
      'data-rv-modal-error': '',
      style: 'display:none;align-items:center;gap:8px;width:100%;box-sizing:border-box;'
        + 'border-radius:var(--rv-radius);padding:10px 14px;margin-bottom:12px;'
        + 'font-size:var(--rv-fs-sm);font-weight:600;'
        + 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);'
        + 'color:var(--rv-signal-negative);',
    });
    return {
      node: node,
      show: function (message) {
        node.replaceChildren(el('span', {}, message));
        node.style.display = 'flex';
      },
      clear: function () {
        node.replaceChildren();
        node.style.display = 'none';
      },
    };
  }

  function figure(label, value, emphasise) {
    return el('div', {
      style: 'display:flex;flex-direction:column;gap:2px;min-width:0;',
    },
      el('span', {
        style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
          + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);',
      }, label),
      el('span', {
        class: 'tnum',
        style: 'font-size:var(--rv-fs-metric);font-weight:600;'
          + (emphasise ? 'color:var(--rv-signal-caution);' : 'color:var(--rv-text-primary);'),
      }, value));
  }

  // ---------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------
  async function screenPedidoInsumosDistribuicao(pedidoId) {
    var root = el('div', { id: 'pedido-insumos-distribuicao' });
    var notice = el('div', { id: 'pedido-insumos-distribuicao-notice' });

    // Estado LOCAL de interacao apenas. Nenhum dado de negocio mora aqui:
    // toda escrita vai ao servidor e a tela recarrega da projecao canonica.
    var state = {
      data: null,
      editing: {},        // necessidade_id -> true
      drafts: {},         // necessidade_id -> [{ planejamento_id, fornecedor_id, kg }]
      selecting: false,
      selected: {},       // planejamento_id -> true
      lockedSupplier: null,
      busy: false,
    };

    function setNotice(kind, text) {
      notice.replaceChildren(text ? noticeCard(kind === 'error' ? 'negative' : 'positive', text) : null);
    }
    function clearNotice() { notice.replaceChildren(); }

    function needById(id) {
      return (state.data.necessidades || []).filter(function (n) {
        return Number(n.necessidade_id) === Number(id);
      })[0] || null;
    }

    // -------------------------------------------------------------------
    // Escrita
    // -------------------------------------------------------------------
    async function callRpc(name, params) {
      var result;
      try {
        result = await window.supa.rpc(name, params);
      } catch (error) {
        return { ok: false, codigo: 'transporte', erro: 'Resposta incerta. Recarregue a tela antes de repetir.' };
      }
      if (result.error) return { ok: false, codigo: 'transporte', erro: result.error.message };
      return result.data || { ok: false, codigo: 'transporte' };
    }

    // NOTA: o escritor linha-a-linha `definir_planejamento_compra` continua
    // existindo em db/99 e continua sendo o destino do caminho de
    // compatibilidade de cliente antigo, mas esta tela NAO o chama mais: o
    // salvar de um cartao pertence inteiro a RPC atomica de substituicao.

    // -------------------------------------------------------------------
    // Estado A — nenhuma distribuicao salva: uma linha inline ja editavel
    // Estado B/C — distribuicoes salvas: leitura
    // Estado F — edicao: linhas editaveis + adicionar fornecedor
    // -------------------------------------------------------------------
    function draftFor(need) {
      var key = String(need.necessidade_id);
      if (!state.drafts[key]) {
        var rows = (need.planejamentos || [])
          .filter(function (row) { return !row.gerado; })
          .map(function (row) {
            return {
              planejamento_id: row.planejamento_id,
              fornecedor_id: row.fornecedor_id,
              kg: String(row.kg_planejado),
            };
          });
        if (!rows.length) {
          rows = [{ planejamento_id: null, fornecedor_id: '', kg: String(planningBalance(need) || '') }];
        }
        state.drafts[key] = rows;
      }
      return state.drafts[key];
    }

    function discardDraft(need) { delete state.drafts[String(need.necessidade_id)]; }

    function editableRow(need, row, index, rerenderCard, inlineSubmit) {
      // Um fornecedor ja usado por outra linha VIVA da mesma necessidade nao
      // pode ser escolhido de novo: o alvo e absoluto por (necessidade,
      // fornecedor) enquanto a linha vive. Uma linha JA GERADA nao entra
      // nesta exclusao — comprar de novo do mesmo fornecedor e legitimo.
      var used = {};
      draftFor(need).forEach(function (other, i) {
        if (i !== index && other.fornecedor_id) used[String(other.fornecedor_id)] = true;
      });
      var options = compatibleSuppliers(need, state.data.fornecedores)
        .filter(function (item) {
          return !used[String(item.fornecedor_id)] || Number(item.fornecedor_id) === Number(row.fornecedor_id);
        })
        .map(function (item) { return { value: item.fornecedor_id, label: item.nome }; });

      var supplier = window.selectInput({
        options: options,
        value: row.fornecedor_id || '',
        placeholder: 'Selecione o fornecedor...',
        ariaLabel: 'Fornecedor para ' + materialLabel(need),
      });
      supplier.addEventListener('change', function () { row.fornecedor_id = supplier.value; });

      var quantity = window.textInput({ type: 'number', value: row.kg, step: '0.001' });
      quantity.setAttribute('min', '0');
      quantity.setAttribute('aria-label', 'Quantidade planejada em kg para ' + materialLabel(need));
      quantity.addEventListener('input', function () { row.kg = quantity.value; });

      var remove = window.actionButton({
        title: 'Remover esta distribuição',
        icon: el('span', { 'aria-hidden': 'true', style: 'font-size:var(--rv-fs-body);line-height:1;' }, '×'),
        danger: true,
        onclick: function () {
          var rows = draftFor(need);
          rows.splice(index, 1);
          if (!rows.length) rows.push({ planejamento_id: null, fornecedor_id: '', kg: '' });
          rerenderCard();
        },
      });

      var cells = [supplier, quantity, remove];
      var template = 'minmax(0,1fr) 150px 30px';
      if (typeof inlineSubmit === 'function') {
        cells.push(secondaryButton('Distribuir', inlineSubmit));
        template += ' auto';
      }

      // el() stringifies a null attribute value, so the zero-state marker is
      // added only when it genuinely applies.
      var rowAttrs = {
        'data-rv-planning-row': '',
        style: 'display:grid;grid-template-columns:' + template + ';gap:8px;align-items:center;'
          + 'padding:9px 0;border-top:1px solid var(--rv-border-soft);',
      };
      if (typeof inlineSubmit === 'function') rowAttrs['data-rv-planning-row-zero'] = '';

      return el('div', rowAttrs, cells);
    }

    function readOnlyRow(need, row) {
      var right = el('div', { style: 'display:flex;align-items:center;gap:10px;justify-content:flex-end;' },
        el('span', { class: 'tnum', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-weight:600;' },
          kg(row.kg_planejado)),
        row.gerado
          ? el('a', {
              href: '#/ordens-compra/' + row.ordem_compra_id,
              style: 'font-size:var(--rv-fs-sm);color:var(--rv-brand);font-weight:600;text-decoration:none;',
            }, row.ordem_identidade || 'Pedido de Compra')
          : null);

      var left = el('div', { style: 'display:flex;align-items:center;gap:8px;min-width:0;' }, null);
      if (state.selecting && !row.gerado) {
        var blockedReason = state.lockedSupplier != null
          && Number(state.lockedSupplier) !== Number(row.fornecedor_id)
          ? 'Já há um fornecedor selecionado nesta geração'
          : null;
        var box = window.checkboxInput({
          checked: !!state.selected[String(row.planejamento_id)],
          disabled: !!blockedReason,
          ariaLabel: 'Selecionar ' + row.fornecedor_nome + ' para o Pedido de Compra',
          onchange: function (event) {
            if (event.target.checked) state.selected[String(row.planejamento_id)] = true;
            else delete state.selected[String(row.planejamento_id)];
            recomputeLock();
            render();
          },
        });
        left.appendChild(box);
        if (blockedReason) {
          left.appendChild(el('span', {
            style: 'font-size:var(--rv-fs-xs);color:var(--rv-text-tertiary);',
            title: blockedReason,
          }, '(' + blockedReason + ')'));
        }
      }
      left.appendChild(el('span', {
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);' + window.TRUNCATE_CELL_STYLE,
        title: row.fornecedor_nome,
      }, row.fornecedor_nome));
      if (row.gerado) {
        // Uma linha gerada cujo documento foi CANCELADO continua visível como
        // história, mas não ocupa mais saldo. Rotulá-la "Gerado" faria o
        // operador acreditar que a compra ainda existe.
        left.appendChild(window.rvClassificationBadge(
          isActivePlanRow(row) ? 'Gerado' : 'Cancelado'));
      }

      return el('div', {
        'data-rv-planning-row': '',
        style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;'
          + 'padding:9px 0;border-top:1px solid var(--rv-border-soft);',
      }, left, right);
    }

    function recomputeLock() {
      var ids = Object.keys(state.selected);
      if (!ids.length) { state.lockedSupplier = null; return; }
      var found = null;
      (state.data.necessidades || []).forEach(function (need) {
        (need.planejamentos || []).forEach(function (row) {
          if (state.selected[String(row.planejamento_id)] && found === null) found = row.fornecedor_id;
        });
      });
      state.lockedSupplier = found;
    }

    function buildNeedCard(need) {
      var card = el('section', {
        style: CARD_STYLE,
        'data-necessidade-id': String(need.necessidade_id),
        'data-rv-situacao': need.situacao,
      });
      var editing = !!state.editing[String(need.necessidade_id)];
      var savedRows = (need.planejamentos || []);
      var hasSaved = savedRows.length > 0;
      var remaining = Number(need.kg_restante) || 0;

      function rerenderCard() {
        var replacement = buildNeedCard(need);
        if (card.parentNode) card.parentNode.replaceChild(replacement, card);
      }

      // --- cabecalho -------------------------------------------------
      card.appendChild(el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;',
      },
        el('div', { style: 'min-width:0;' },
          el('h2', {
            style: 'font-size:var(--rv-fs-component-heading);font-weight:700;color:var(--rv-text-title);margin:0;',
          }, materialLabel(need)),
          el('div', {
            style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);margin-top:3px;',
          }, needOrigin(need))),
        window.rvStatusPill(SITUACAO_LABEL[need.situacao] || need.situacao,
          SITUACAO_PILL_STATE[need.situacao] || need.situacao)));

      // --- as tres figuras obrigatorias ------------------------------
      card.appendChild(el('div', {
        style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--rv-gap-cols);margin-top:14px;',
      },
        figure('Necessário', kg(need.kg_necessario)),
        figure('Planejado', kg(need.kg_planejado)),
        figure('Restante', kg(remaining), remaining > 0)));

      // Pendente e parcial compartilham a familia caution, entao a distincao
      // tem de ser textual e numerica — nunca so a cor.
      if (remaining > 0) {
        card.appendChild(el('div', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-signal-caution);font-weight:600;margin-top:8px;',
        }, 'Faltam ' + kg(remaining) + ' para distribuir.'));
      }

      // --- corpo ------------------------------------------------------
      // Linhas GERADAS aparecem sempre, em leitura, em TODOS os modos —
      // inclusive em edicao. Elas sao a historia de compra da necessidade e
      // escondê-las durante a edicao faria o operador editar contra um total
      // que ele nao consegue ver.
      var generatedRows = savedRows.filter(function (row) { return row.gerado; });
      var liveRows = savedRows.filter(function (row) { return !row.gerado; });
      // Estado ZERO = nada salvo, nem vivo nem gerado. Uma necessidade que ja
      // tem historia de compra NAO abre em edicao: ela mostra o que ja foi
      // comprado e oferece uma acao explicita para o saldo que falta.
      var isZeroState = savedRows.length === 0 && !editing;

      var body = el('div', { style: 'margin-top:14px;' });

      if (generatedRows.length) {
        body.appendChild(sectionChip('✓', 'Já comprado'));
        generatedRows.forEach(function (row) { body.appendChild(readOnlyRow(need, row)); });
      }

      if (editing || isZeroState) {
        body.appendChild(sectionChip('✎', generatedRows.length ? 'Distribuir o restante' : 'Distribuição'));
        var rows = draftFor(need);
        rows.forEach(function (row, index) {
          // O contrato ratificado coloca Distribuir DENTRO da linha inline do
          // estado zero, e nao no rodape do cartao. Ele submete o cartao
          // inteiro de forma atomica; so a sua posicao muda.
          var inline = (isZeroState && index === rows.length - 1)
            ? function () { submitDraft(need); }
            : null;
          body.appendChild(editableRow(need, row, index, rerenderCard, inline));
        });
      } else if (liveRows.length) {
        body.appendChild(sectionChip('◔', 'Distribuição planejada'));
        liveRows.forEach(function (row) { body.appendChild(readOnlyRow(need, row)); });
      }
      card.appendChild(body);

      if (state.selecting) {
        card.appendChild(el('div', {
          style: 'font-size:var(--rv-fs-xs);color:var(--rv-text-tertiary);margin-top:12px;',
        }, 'Seleção de geração ativa. Saia da seleção para alterar a distribuição.'));
        return card;
      }

      // --- rodape de acoes -------------------------------------------
      var footer = el('div', { style: CARD_FOOTER_STYLE });
      var footerActions = 0;

      if (editing || isZeroState) {
        // Adicionar fornecedor e a acao secundaria EXTERNA em ambos os modos.
        footer.appendChild(secondaryButton('Adicionar fornecedor', function () {
          var list = draftFor(need);
          list.push({ planejamento_id: null, fornecedor_id: '', kg: '' });
          rerenderCard();
        }));
        footerActions += 1;

        if (editing) {
          footer.appendChild(secondaryButton('Cancelar', function () {
            discardDraft(need);
            delete state.editing[String(need.necessidade_id)];
            render();
          }));
          footer.appendChild(primaryButton('Salvar', function () { submitDraft(need); }));
          footerActions += 2;
        }
      } else if (liveRows.length) {
        // Existe linha VIVA: ela pode de facto ser editada.
        footer.appendChild(secondaryButton('Alterar distribuição', function () {
          state.editing[String(need.necessidade_id)] = true;
          discardDraft(need);
          render();
        }));
        footerActions += 1;
      } else if (remaining > 0) {
        // So existe historia gerada, mas ainda falta saldo. Oferecer
        // "Alterar distribuicao" aqui seria mentira — nao ha nada editavel;
        // o que o operador precisa e distribuir o que falta.
        footer.appendChild(primaryButton('Distribuir saldo restante', function () {
          state.editing[String(need.necessidade_id)] = true;
          discardDraft(need);
          render();
        }));
        footerActions += 1;
      }
      // Nem linha viva nem saldo: nenhuma acao. Um botao de edicao aqui nao
      // teria o que editar e so enganaria o operador.

      if (footerActions > 0) card.appendChild(footer);
      return card;
    }

    // Salvar um cartao e UMA operacao de negocio.
    //
    // Antes esta funcao emitia varias chamadas independentes — uma remocao
    // por linha desaparecida, depois um alvo por linha preenchida — e uma
    // recusa no meio deixava as anteriores ja gravadas: o operador via um
    // cartao num estado que nunca pediu. Agora o conjunto COMPLETO de linhas
    // vivas viaja numa unica RPC atomica, que valida tudo antes de escrever
    // qualquer coisa. Uma recusa devolve o cartao intacto.
    async function submitDraft(need) {
      if (state.busy) return;
      var rows = draftFor(need);
      var filled = rows.filter(function (row) { return row.fornecedor_id && String(row.kg).trim() !== ''; });
      var partial = rows.filter(function (row) {
        var hasSupplier = !!row.fornecedor_id;
        var hasQty = String(row.kg).trim() !== '';
        return (hasSupplier && !hasQty) || (!hasSupplier && hasQty);
      });

      if (partial.length) {
        setNotice('error', 'Informe fornecedor e quantidade em cada distribuição, ou remova a linha incompleta.');
        return;
      }
      var invalid = filled.filter(function (row) {
        var value = Number(row.kg);
        return !Number.isFinite(value) || value <= 0 || !QTY_PATTERN.test(String(row.kg).trim());
      });
      if (invalid.length) {
        setNotice('error', errorText('kg_invalido'));
        return;
      }

      state.busy = true;
      clearNotice();
      try {
        var result = await callRpc('substituir_planejamento_compra_necessidade', {
          p_necessidade_id: Number(need.necessidade_id),
          p_linhas: filled.map(function (row) {
            return { fornecedor_id: Number(row.fornecedor_id), kg: Number(row.kg) };
          }),
          p_idempotency_key: commandKey(),
        });
        if (result.ok !== true) {
          // Nada foi gravado: o rascunho local continua exatamente como o
          // operador o deixou, para que ele corrija em vez de recomecar.
          setNotice('error', errorText(result.codigo, result.erro));
          return;
        }
        discardDraft(need);
        delete state.editing[String(need.necessidade_id)];
        await reload();
        // reload() troca state.data e ZERA state.drafts. Sem repintar aqui, o
        // cartao continua exibindo os nos do rascunho ja descartado: o operador
        // ve fornecedor e quantidade preenchidos, as tres figuras ainda em
        // 0,000 planejado, conclui que a gravacao falhou e clica de novo — e o
        // segundo clique monta um rascunho NOVO e vazio a partir do `need`
        // velho, caindo na recusa "linha incompleta" contra uma linha que a
        // tela mesma acabou de recriar. A gravacao tinha funcionado.
        render();
        setNotice('success', 'Distribuição salva. Nenhum Pedido de Compra foi criado.');
      } finally {
        state.busy = false;
      }
    }

    // -------------------------------------------------------------------
    // Distribuição rápida
    // -------------------------------------------------------------------
    function openQuickPlanning() {
      var suppliers = (state.data.fornecedores || []);
      var supplier = window.selectInput({
        options: suppliers.map(function (item) { return { value: item.fornecedor_id, label: item.nome + ' · ' + (item.tipo === 'fio_algodao' ? 'Algodão' : 'Poliéster') }; }),
        value: '',
        placeholder: 'Selecione o fornecedor...',
      });
      // DOIS MODOS REAIS. "Saldo exato" e o padrao porque cobre o caso comum
      // numa tacada so, mas nao pode ser o UNICO: comprar PARTE do que falta
      // de um fornecedor e corrente, e sem o modo ajustado o operador teria de
      // aplicar o saldo inteiro e depois corrigir cartao por cartao.
      var mode = 'exato';
      var listBox = el('div', {});
      var picked = {};
      var modeBox = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;' });

      function modeButton(value, label) {
        var active = mode === value;
        return el('button', {
          type: 'button',
          'aria-pressed': active ? 'true' : 'false',
          'data-rv-quick-mode': value,
          style: BTN_BASE + 'height:var(--rv-h-compact);'
            + (active
              ? 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;'
              : 'background:var(--rv-surface);color:var(--rv-text-secondary);border:1px solid var(--rv-border-strong);'),
          onclick: function () { mode = value; renderMode(); renderList(); },
        }, label);
      }

      function renderMode() {
        modeBox.replaceChildren(
          modeButton('exato', 'Preencher com o saldo exato'),
          modeButton('ajustado', 'Informar quantidade por necessidade'));
      }

      function renderList() {
        picked = {};
        var chosen = suppliers.filter(function (item) {
          return String(item.fornecedor_id) === String(supplier.value);
        })[0];
        if (!chosen) {
          listBox.replaceChildren(el('div', {
            style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
          }, 'Escolha o fornecedor para ver as necessidades compatíveis.'));
          return;
        }
        var material = chosen.tipo === 'fio_algodao' ? 'algodao' : 'poliester';
        var eligible = (state.data.necessidades || []).filter(function (need) {
          return need.material === material && Number(need.kg_restante) > 0;
        });
        if (!eligible.length) {
          listBox.replaceChildren(el('div', {
            style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
          }, 'Nenhuma necessidade pendente compatível com este fornecedor.'));
          return;
        }
        var rows = eligible.map(function (need) {
          var key = String(need.necessidade_id);
          var qty = null;

          if (mode === 'ajustado') {
            qty = window.textInput({ type: 'number', value: String(need.kg_restante), step: '0.001' });
            qty.setAttribute('min', '0');
            qty.setAttribute('aria-label', 'Quantidade para ' + materialLabel(need));
            qty.addEventListener('input', function () {
              if (picked[key]) picked[key].kg = qty.value;
            });
          }

          var box = window.checkboxInput({
            checked: false,
            ariaLabel: 'Selecionar ' + materialLabel(need),
            onchange: function (event) {
              if (event.target.checked) picked[key] = { kg: qty ? qty.value : null };
              else delete picked[key];
            },
          });

          return el('div', {
            'data-rv-quick-row': '',
            style: 'display:grid;grid-template-columns:auto minmax(0,1fr) '
              + (mode === 'ajustado' ? '150px' : 'auto')
              + ';gap:10px;align-items:center;padding:9px 0;'
              + 'border-top:1px solid var(--rv-border-soft);',
          },
            box,
            el('div', { style: 'min-width:0;' },
              el('div', { style: 'font-size:var(--rv-fs-body);' + window.TRUNCATE_CELL_STYLE, title: materialLabel(need) },
                materialLabel(need)),
              el('div', { class: 'tnum', style: 'font-size:var(--rv-fs-xs);color:var(--rv-text-tertiary);' },
                'faltam ' + kg(need.kg_restante))),
            mode === 'ajustado'
              ? qty
              : el('span', { class: 'tnum', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' },
                  kg(need.kg_restante)));
        });
        listBox.replaceChildren.apply(listBox, rows);
      }
      supplier.addEventListener('change', renderList);
      renderMode();
      renderList();

      // Recusas desta confirmação aparecem AQUI, dentro do modal aberto, e não
      // no aviso de página que o overlay esconde.
      var erro = modalErrorRegion();

      var body = el('div', {},
        erro.node,
        el('p', { style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);margin:0 0 12px;' },
          'Aplique um fornecedor a várias necessidades de uma vez. Nenhum Pedido de Compra é criado aqui.'),
        window.formField({ label: 'Fornecedor', input: supplier }),
        modeBox,
        listBox);

      window.modal({
        title: 'Distribuição rápida',
        body: body,
        saveLabel: 'Aplicar',
        onSave: async function () {
          // Toda nova tentativa começa limpa: uma mensagem antiga ao lado de
          // um novo resultado é indistinguível de um erro que não saiu.
          erro.clear();
          var ids = Object.keys(picked);
          if (!supplier.value || !ids.length) {
            erro.show('Escolha o fornecedor e ao menos uma necessidade.');
            return false;
          }
          var itens = [];
          for (var i = 0; i < ids.length; i += 1) {
            if (mode === 'ajustado') {
              var raw = String(picked[ids[i]].kg == null ? '' : picked[ids[i]].kg).trim();
              if (!QTY_PATTERN.test(raw) || Number(raw) <= 0) {
                erro.show(errorText('kg_invalido'));
                return false;
              }
              itens.push({ necessidade_id: Number(ids[i]), kg: Number(raw) });
            } else {
              // Sem a chave `kg` o servidor preenche o saldo exato. E o MESMO
              // RPC: o modo e uma escolha da tela, nao um segundo escritor.
              itens.push({ necessidade_id: Number(ids[i]) });
            }
          }

          var result = await callRpc('aplicar_planejamento_rapido', {
            p_pedido_id: pedidoId,
            p_fornecedor_id: Number(supplier.value),
            p_itens: itens,
            p_idempotency_key: commandKey(),
          });
          if (result.ok !== true) {
            // Recusa de negócio E falha de transporte: as duas são visíveis
            // dentro do modal, que permanece aberto para a correção.
            erro.show(errorText(result.codigo, result.erro));
            return false;
          }
          await reload();
          // Mesmo motivo do salvar de um cartao: sem repintar, a fila inteira
          // continua mostrando o estado anterior a distribuicao rapida.
          render();
          setNotice('success', result.necessidades_aplicadas + ' necessidade(s) distribuída(s). Nenhum Pedido de Compra foi criado.');
          return true;
        },
      });
    }

    // -------------------------------------------------------------------
    // Geração do Pedido de Compra
    // -------------------------------------------------------------------
    function selectedRows() {
      var out = [];
      (state.data.necessidades || []).forEach(function (need) {
        (need.planejamentos || []).forEach(function (row) {
          if (state.selected[String(row.planejamento_id)]) out.push({ need: need, row: row });
        });
      });
      return out;
    }

    async function openGenerationConfirm() {
      var chosen = selectedRows();
      if (!chosen.length) {
        setNotice('error', errorText('selecao_vazia'));
        return;
      }

      var suggestion = await callRpc('sugerir_codigo_ordem_compra', { p_pedido_id: pedidoId });
      if (suggestion.ok !== true) {
        setNotice('error', errorText(suggestion.codigo, suggestion.erro));
        return;
      }

      var total = chosen.reduce(function (sum, entry) { return sum + Number(entry.row.kg_planejado); }, 0);
      var supplierName = chosen[0].row.fornecedor_nome;

      var codeInput = window.textInput({ value: suggestion.codigo_sugerido });
      codeInput.setAttribute('maxlength', '40');
      codeInput.setAttribute('autocomplete', 'off');

      var summary = el('div', {
        style: 'border:1px solid var(--rv-border);border-radius:var(--rv-radius);'
          + 'background:var(--rv-surface-subtle);padding:12px 14px;margin-bottom:14px;',
      },
        el('div', { style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);' }, 'Fornecedor'),
        el('div', { style: 'font-size:var(--rv-fs-body);font-weight:600;margin-bottom:10px;' }, supplierName));

      chosen.forEach(function (entry) {
        summary.appendChild(el('div', {
          style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:6px 0;'
            + 'border-top:1px solid var(--rv-border-soft);',
        },
          el('span', { style: 'font-size:var(--rv-fs-sm);' + window.TRUNCATE_CELL_STYLE, title: materialLabel(entry.need) },
            materialLabel(entry.need)),
          el('span', { class: 'tnum', style: 'font-size:var(--rv-fs-sm);' }, kg(entry.row.kg_planejado))));
      });

      summary.appendChild(el('div', {
        style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 0 0;'
          + 'border-top:1px solid var(--rv-border);margin-top:6px;',
      },
        el('span', { style: 'font-size:var(--rv-fs-body);font-weight:700;' }, 'Total'),
        el('span', { class: 'tnum', style: 'font-size:var(--rv-fs-summary-total);font-weight:700;' }, kg(total))));

      // Recusas da geração aparecem dentro desta confirmação. Antes iam para o
      // aviso de página, atrás do overlay: a geração parecia simplesmente não
      // responder.
      var erro = modalErrorRegion();

      // Sugestão fresca devolvida pelo servidor quando a numeração avançou.
      // Fica visível ao lado do campo, e NÃO substitui o que o operador
      // digitou — o número é uma decisão dele e a tela não a sobrescreve.
      var sugestaoFresca = el('div', {
        id: 'oc-sugestao-fresca',
        'data-rv-sugestao-fresca': '',
        style: 'display:none;font-size:var(--rv-fs-xs);color:var(--rv-signal-caution);'
          + 'font-weight:600;margin-top:6px;',
      });

      window.modal({
        title: 'Gerar Pedido de Compra',
        body: el('div', {},
          erro.node,
          summary,
          window.formField({
            label: 'Número do Pedido de Compra',
            input: codeInput,
            hint: 'Sugerido a partir da numeração deste Pedido. Você pode substituir antes de confirmar; depois de gerado o número não muda.',
          }),
          sugestaoFresca),
        saveLabel: 'Gerar',
        onSave: async function () {
          erro.clear();
          var result = await callRpc('gerar_ordem_compra_do_planejamento', {
            p_planejamento_ids: chosen.map(function (entry) { return Number(entry.row.planejamento_id); }),
            p_codigo: String(codeInput.value || '').trim(),
            p_sequencia_esperada: Number(suggestion.sequencia_sugerida),
            p_idempotency_key: commandKey(),
          });
          if (result.ok !== true) {
            // Sugestão vencida: falha fechada do servidor, nada foi criado. A
            // confirmação continua aberta, a sequência esperada interna é
            // atualizada para que a reconfirmação explícita passe, e a sugestão
            // fresca é MOSTRADA — mas o código digitado é preservado
            // exatamente. Sobrescrever o campo apagaria silenciosamente um
            // número que o operador pode ter escolhido de propósito.
            if (result.codigo === 'sugestao_desatualizada' && result.codigo_sugerido) {
              suggestion.sequencia_sugerida = result.sequencia_sugerida;
              suggestion.codigo_sugerido = result.codigo_sugerido;
              sugestaoFresca.replaceChildren(el('span', {},
                'Sugestão atualizada: ' + result.codigo_sugerido
                + '. O número que você digitou foi mantido.'));
              sugestaoFresca.style.display = 'block';
            }
            erro.show(errorText(result.codigo, result.erro));
            return false;
          }
          state.selecting = false;
          state.selected = {};
          state.lockedSupplier = null;
          window.navigate('#/ordens-compra/' + result.ordem_compra_id);
          return true;
        },
      });
    }

    // -------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------
    function header() {
      var actions = el('div', {
        'data-rv-page-actions': '',
        style: 'display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;',
      });

      if (state.selecting) {
        var count = Object.keys(state.selected).length;
        actions.appendChild(secondaryButton('Cancelar seleção', function () {
          state.selecting = false;
          state.selected = {};
          state.lockedSupplier = null;
          render();
        }));
        actions.appendChild(primaryButton('Confirmar ' + count + ' distribuição(ões)', function () {
          openGenerationConfirm();
        }, count === 0));
      } else {
        actions.appendChild(secondaryButton('Distribuição rápida', openQuickPlanning));
        actions.appendChild(primaryButton('Gerar pedido de compra', function () {
          state.selecting = true;
          state.selected = {};
          state.lockedSupplier = null;
          state.editing = {};
          clearNotice();
          render();
        }, !hasGeneratableRows()));
      }

      return el('div', {
        style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;'
          + 'flex-wrap:wrap;margin-bottom:var(--rv-gap-stack);',
      },
        el('div', { style: 'min-width:0;' },
          el('h1', {
            style: 'font-size:var(--rv-fs-title);font-weight:700;color:var(--rv-text-title);margin:0;'
              + 'letter-spacing:var(--rv-tracking-title);',
          }, 'Planejamento de compras'),
          el('div', {
            style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);margin-top:4px;max-width:70ch;',
          }, 'Defina qual fornecedor atenderá cada necessidade do Pedido. Os pedidos de compra serão gerados depois.'),
          el('a', {
            href: '#/pedidos/' + pedidoId,
            style: 'display:inline-block;margin-top:8px;font-size:var(--rv-fs-sm);'
              + 'color:var(--rv-brand);font-weight:600;text-decoration:none;',
          }, 'Voltar ao Pedido')),
        actions);
    }

    function hasGeneratableRows() {
      var found = false;
      (state.data && state.data.necessidades || []).forEach(function (need) {
        (need.planejamentos || []).forEach(function (row) { if (!row.gerado) found = true; });
      });
      return found;
    }

    function render() {
      var body = el('div', {}, header());

      if (state.selecting) {
        body.appendChild(noticeCard('caution',
          state.lockedSupplier == null
            ? 'Selecione as distribuições que entram neste Pedido de Compra. O primeiro fornecedor escolhido fixa os demais.'
            : 'Fornecedor fixado nesta geração. Distribuições de outros fornecedores ficam indisponíveis.'));
      }

      var needs = (state.data.necessidades || []);
      if (!needs.length) {
        body.appendChild(el('div', {
          style: CARD_STYLE + 'color:var(--rv-text-tertiary);font-size:var(--rv-fs-sm);',
        }, 'Nenhuma necessidade nativa disponível para este Pedido.'));
      } else {
        needs.forEach(function (need) { body.appendChild(buildNeedCard(need)); });
      }
      root.replaceChildren(body);
    }

    function renderLoading() {
      root.replaceChildren(el('div', {
        style: CARD_STYLE + 'color:var(--rv-text-tertiary);font-size:var(--rv-fs-sm);',
      }, 'Carregando planejamento de compras...'));
    }

    async function reload() {
      state.data = await loadPlanning(pedidoId);
      state.drafts = {};
      recomputeLock();
    }

    async function boot() {
      renderLoading();
      try {
        await reload();
        render();
      } catch (error) {
        setNotice('error', errorText(error && error.codigo, 'Não foi possível carregar o planejamento. Tente novamente.'));
        root.replaceChildren(el('div', { style: CARD_STYLE },
          secondaryButton('Tentar novamente', boot)));
      }
    }

    if (!UUID.test(String(pedidoId || ''))) setNotice('error', 'Identificador de Pedido inválido.');
    else await boot();

    return window.shellLayout(window.ADMIN_MENU, el('div', {}, notice, root));
  }

  ns.pedidoInsumosDistribuicao = {
    screenPedidoInsumosDistribuicao: screenPedidoInsumosDistribuicao,
    commandKey: commandKey,
    errorText: errorText,
    planningBalance: planningBalance,
    suppliersAlreadyUsed: suppliersAlreadyUsed,
    compatibleSuppliers: compatibleSuppliers,
    materialLabel: materialLabel,
    needOrigin: needOrigin,
    SITUACAO_LABEL: SITUACAO_LABEL,
    SITUACAO_PILL_STATE: SITUACAO_PILL_STATE,
  };
  window.screenPedidoInsumosDistribuicao = screenPedidoInsumosDistribuicao;
})(window);
