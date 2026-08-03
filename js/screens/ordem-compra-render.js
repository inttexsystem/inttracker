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

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1 (completion): a identidade de
  // negocio da OC e `ordem_compra.identidade_operacional` (db/95), resolvida
  // por ordem-compra-data.js e formatada pelo dono central. ANTES esta tela
  // imprimia `'Ordem de compra #' + o.ordem_id`, ou seja, o BIGSERIAL global —
  // por isso a primeira OC do Pedido 001 aparecia como `#100`.
  function ocLabel(ordemId, state) {
    return window.RAVATEX_OP_DISPLAY.formatOcIdentityFromMap(
      ordemId, state && state.ocIdentidades);
  }
  ns.ocLabel = ocLabel;

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
      nao_aplicavel: ['var(--rv-chip-bg)', 'var(--rv-text-secondary)'],
      pendente: ['var(--rv-signal-caution-bg)', 'var(--rv-signal-caution)'],
      aceita: ['var(--rv-signal-positive-bg)', 'var(--rv-signal-positive)'],
      rejeitada: ['var(--rv-surface)', 'var(--rv-signal-negative)'],
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

  // ---- BACKLOG-7 PHASE 1: canonical surface primitives -----------------
  //
  // This screen held the OLDEST visual generation in the purchase-order
  // surface: `bg-white shadow` cards (a shadow on a card is forbidden outright
  // by §6), Tailwind grey/blue/red/amber literals for every foreground, and
  // `text-sm` (14px) — a size absent from the §5 enum — for every cell. The
  // four helpers below are the single owners of card, table-header, cell and
  // hover geometry on this screen, so the idiom is declared once instead of
  // being retyped at 52 literal sites.

  // §2.4: --rv-surface fill, one --rv-border hairline, --rv-radius, FLAT.
  function card(extraClass) {
    return el('div', {
      class: extraClass || '',
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);'
        + 'border-radius:var(--rv-radius);box-shadow:var(--rv-shadow-none);',
    });
  }

  // §2.11 / D12 standalone notice card. Full width of its content region, one
  // matching semantic family for background, border, icon and text. The three
  // families this screen can raise are enumerated whole — a name assembled by
  // concatenating a family suffix would hide the token from static validation.
  var NOTICE_SKIN = {
    positive: 'background:var(--rv-signal-positive-bg);border:1px solid var(--rv-signal-positive-border);color:var(--rv-signal-positive);',
    caution: 'background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);color:var(--rv-signal-caution);',
    negative: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);color:var(--rv-signal-negative);',
  };
  var NOTICE_ICON = {
    positive: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    caution: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    negative: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  };

  function noticeIcon(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(markup).trim();
    return tmp.firstChild;
  }

  function noticeCard(id, familia, message) {
    var skin = NOTICE_SKIN[familia];
    if (!skin) throw new Error('ordem-compra-render: familia de aviso desconhecida: ' + familia);
    return el('div', {
      id: id,

      style: 'display:flex;align-items:flex-start;gap:8px;width:100%;box-sizing:border-box;'
        + 'padding:10px 14px;border-radius:var(--rv-radius);font-size:var(--rv-fs-body);' + skin,
    },
    el('span', { style: 'display:inline-flex;flex:none;', 'aria-hidden': 'true' },
      noticeIcon(NOTICE_ICON[familia])),
    el('span', {}, message));
  }

  // §2.11 honest empty/unavailable state inside a card.
  function emptyCard(message) {
    var node = card('p-8 text-center');
    node.appendChild(el('div', {
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
    }, message));
    return node;
  }

  // §2.5 TABLE_HEADER role: --rv-fs-thead / 600 / uppercase / --rv-text-tertiary.
  //
  // Every style below is written as ONE STRING LITERAL, never assembled from a
  // shared variable. The js-screen conformance front-end can only decode a
  // literal; a `style: SOME_CONST` or `style: A + b` site becomes a
  // NON_LITERAL_STYLE_VALUE / CONCATENATED_STYLE_EXPRESSION coverage gap, so
  // factoring these into constants would hide the very values this pass exists
  // to make visible. Reuse lives at the FUNCTION level instead.
  function th(label, right) {
    return el('th', {
      class: 'px-4 py-3 ' + (right ? 'text-right' : 'text-left'),
      style: 'font-size:var(--rv-fs-thead);font-weight:600;text-transform:uppercase;letter-spacing:var(--rv-tracking-thead);color:var(--rv-text-tertiary);',
    }, label);
  }
  // Same role, the tighter vertical padding the detail item table already used.
  function thCompact(label, right) {
    return el('th', {
      class: 'px-4 py-2 ' + (right ? 'text-right' : 'text-left'),
      style: 'font-size:var(--rv-fs-thead);font-weight:600;text-transform:uppercase;letter-spacing:var(--rv-tracking-thead);color:var(--rv-text-tertiary);',
    }, label);
  }

  // Cell constructors — BODY_CONTROL_CELL (§5). `pad` is the only variable part
  // and it lives in `class`, never in `style`.
  function tdText(value, pad) {
    return el('td', {
      class: (pad || 'px-4 py-3'),
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);',
    }, value);
  }
  function tdNum(value, pad) {
    return el('td', {
      class: (pad || 'px-4 py-3') + ' text-right',
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-variant-numeric:tabular-nums;',
    }, value);
  }
  function tdNumMuted(value, pad) {
    return el('td', {
      class: (pad || 'px-4 py-3') + ' text-right',
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;',
    }, value);
  }

  // The band that titles a card section. SECTION_LABEL role (§2.4/§5).
  function sectionBand(label) {
    return el('div', {
      class: 'px-5 py-3',
      style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
        + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);'
        + 'border-bottom:1px solid var(--rv-border);',
    }, label);
  }

  // A row hover cannot be expressed by an inline style, and this screen holds
  // no stylesheet class of its own. The imperative pair mirrors the ratified
  // precedent in js/ui.js's pageHeader() and actionButton().
  function hoverable(node) {
    node.onmouseenter = function () { node.style.background = 'var(--rv-surface-subtle)'; };
    node.onmouseleave = function () { node.style.background = ''; };
    return node;
  }

  // The row separator (border-top: 1px --rv-border-soft) replaces Tailwind's
  // divide-gray-* utility, and the §2.1 Destructive variant (--rv-surface fill,
  // --rv-signal-negative-border hairline, --rv-signal-negative text, 34px from
  // the closed ladder) replaces the `border-red-300 / text-red-600 /
  // hover:bg-red-50` trio, which painted three reds belonging to no token while
  // `py-2` put the control off the ladder entirely. Both are written inline at
  // their call sites for the literal-decoding reason stated above.

  // §2.5.1 non-mutating contextual navigation link — interactive text takes
  // --rv-accent-blue, never a Tailwind blue ramp.
  function linkButton(label, onclick, extraClass) {
    return el('button', {
      class: 'hover:underline ' + (extraClass || ''),
      style: 'font-size:var(--rv-fs-body);color:var(--rv-accent-blue);background:none;border:none;padding:0;cursor:pointer;',
      onclick: onclick,
    }, label);
  }

  // ---- LIST -----------------------------------------------------------
  ns.renderList = function (state, handlers) {
    var box = el('div', { id: 'ordens-compra-list' });

    var header = el('div', { class: 'flex justify-between items-center mb-4' },
      el('h1', { style: 'font-size:var(--rv-fs-title);', class: 'font-bold' }, 'Ordens de compra'));
    box.appendChild(header);

    if (state.indisponivel) {
      box.appendChild(emptyCard(
        'Administração de ordens de compra indisponível neste ambiente (migração db/68 não aplicada).'));
      return box;
    }

    if (!state.ordens.length) {
      box.appendChild(emptyCard('Nenhuma ordem de compra ainda.'));
      return box;
    }

    var wrap = card('overflow-hidden');
    // Pass-8 §2.5: `table-layout:fixed` + a <colgroup> whose five <col>s match
    // the five rendered columns, so every header takes exactly the width of its
    // values. Percentage widths only — no fixed-pixel column, so this table
    // needs no scroll owner of its own.
    var table = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
    table.appendChild(el('colgroup', {},
      el('col', { style: 'width:26%;' }),
      el('col', { style: 'width:30%;' }),
      el('col', { style: 'width:20%;' }),
      el('col', { style: 'width:12%;' }),
      el('col', { style: 'width:12%;' })));
    var thead = el('thead', {
      style: 'background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);',
    });
    thead.appendChild(el('tr', {},
      th('Ordem'), th('Fornecedor'), th('Situação'), th('Itens', true), th('', true)));
    var tbody = el('tbody', {});
    state.ordens.forEach(function (o) {
      var tr = hoverable(el('tr', { 'data-ordem-id': String(o.ordem_id), style: 'border-top:1px solid var(--rv-border-soft);' }));
      // A identidade canonica e o identificador primario da linha; o modelo
      // (nativo/legado) continua visivel como qualificacao secundaria. A
      // geometria de 5 colunas do contrato pass-8 (S01) e preservada: nenhuma
      // coluna foi adicionada e nenhuma largura mudou.
      tr.appendChild(el('td', { class: 'px-4 py-3', style: 'font-size:var(--rv-fs-body);' },
        el('div', { class: 'font-semibold', style: 'color:var(--rv-text-primary);' }, ocLabel(o.ordem_id, state)),
        el('div', { class: 'mt-1' }, modeloBadge(o.modelo))));
      tr.appendChild(tdText(o.fornecedor_nome || '— não atribuído'));
      tr.appendChild(el('td', { class: 'px-4 py-3', style: 'font-size:var(--rv-fs-body);' },
        statusBadge(o.status_administrativo)));
      tr.appendChild(tdNum(String(o.itens_total)));
      tr.appendChild(el('td', { class: 'px-4 py-3 text-right' },
        linkButton('Ver ordem', function () { handlers.verOrdem(o.ordem_id); })));
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
    // A PILHA e dona do seu proprio espacamento, com o valor canonico
    // --rv-gap-stack (14px). Antes cada cartao carregava `mb-4` (16px, fora do
    // enum §5) e o ULTIMO nao carregava nada — por isso a secao Recebimentos,
    // anexada como irma logo a seguir, encostava no cartao anterior sem folga
    // nenhuma. Um gap no contentor nao pode esquecer o ultimo filho.
    var box = el('div', {
      id: 'ordem-compra-detail',
      style: 'display:flex;flex-direction:column;gap:var(--rv-gap-stack);',
    });

    // O link "<- Ordens de compra" foi REMOVIDO. Era a forma legada de uma
    // navegacao de volta: uma seta desenhada com um caractere de texto dentro
    // de um link azul sublinhado, solto acima do cartao. O archetype A pede um
    // BREADCRUMB no cabecalho, nao isto, e a barra lateral ja roteia para
    // #/ordens-compra. O breadcrumb canonico entra com o cabecalho da fase 3.

    if (state.indisponivel) {
      box.appendChild(emptyCard(
        'Administração de ordens de compra indisponível neste ambiente (migração db/68 não aplicada).'));
      return box;
    }

    var o = state.ordem;
    if (!o) {
      box.appendChild(emptyCard('Ordem de compra não encontrada.'));
      return box;
    }

    var acoes = o.acoes || {};

    // ---- ENTITY HEADER (§2.1) ------------------------------------------
    //
    // A barra de acoes era uma linha `mt-4` ABAIXO do bloco de titulo, alinhada
    // a ESQUERDA dentro do cartao. §2.1 e categorico nos dois pontos: "entity
    // header: bar RIGHT-ALIGNED, align-items: flex-start (aligns to the TOP of
    // the title block), gap 8px, flex-wrap on the parent", e fecha a secao com
    // "A left-aligned button inside a card is a DEFECT."
    //
    // Esta e exatamente a geometria ja ratificada em
    // ADMIN-DASHBOARD-REVIEW-DEFECT-STABILIZATION-R1, que corrigiu o mesmo
    // defeito no painel: acoes no topo do bloco de titulo, nao centradas nem
    // empurradas para baixo dele.
    var head = card('p-5');

    var titleBlock = el('div', { class: 'min-w-0' });
    titleBlock.appendChild(el('div', { class: 'flex items-center gap-3 flex-wrap' },
      el('h1', { style: 'font-size:var(--rv-fs-title);', class: 'font-bold' }, ocLabel(o.ordem_id, state)),
      modeloBadge(o.modelo), statusBadge(o.status_administrativo),
      o.modelo === 'nativo' ? statusAceiteBadge(o.status_aceite) : null));
    titleBlock.appendChild(el('div', {
      class: 'mt-2',
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
    }, 'Fornecedor: ' + (o.fornecedor_nome || '— não atribuído')));
    if (o.modelo === 'legado') {
      titleBlock.appendChild(el('div', {
        class: 'mt-2',
        style: 'font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);',
      }, 'Ordem importada do modelo legado — inerte no novo modelo (administração pela via legada).'));
    }

    // Actions bar (server-derived). `data-rv-page-actions` declara o papel de
    // grupo de acoes de cabecalho, como o dono compartilhado js/ui.js::pageHeader
    // ja faz nas telas que o consomem.
    // `flex:none` seria um defeito de alcance: com quatro acoes a barra mede
    // 467px, e a 375px ela empurrava o documento para 520px de largura — o
    // operador perdia o botao Emitir fora da tela, sem rolagem local. A barra
    // encolhe e as suas proprias acoes quebram; `min-width:0` e o que permite
    // que um filho flex encolha abaixo do seu conteudo minimo.
    var actions = el('div', {
      'data-rv-page-actions': '',
      class: 'flex flex-wrap justify-end',
      style: 'gap:8px;min-width:0;',
    });

    // ---- Barra estreita: menos texto, nao mais linhas -------------------
    //
    // A 375px as quatro acoes por extenso ocupam 467px e so cabem quebrando em
    // duas linhas. A decisao do arquiteto: no estreito, "Abrir Pedido" sai — e
    // navegacao, nao acao de estado, e o Pedido continua alcancavel pela
    // barra lateral — e as outras tres ficam so com o verbo.
    //
    // O breakpoint e literalmente o mesmo 767px que css/responsive.css ja
    // possui, avaliado NO MOMENTO DO RENDER. Sem listener de resize, sem
    // matchMedia guardado em estado e sem folha de estilo tocada: e o mesmo
    // mecanismo ja aceito em cadastros.js (`window.innerWidth < breakpoint`),
    // e a proibicao vigente de editar css/responsive.css para adaptar uma tela
    // continua respeitada. Uma mudanca de largura ao vivo so se reflete no
    // proximo render, exatamente como na marca do topo.
    var estreito = (typeof window.innerWidth === 'number' && window.innerWidth > 0)
      ? window.innerWidth < 768
      : false;
    // O rotulo encurta; o NOME ACESSIVEL nunca. "Cancelar" sozinho e ambiguo
    // para quem ouve a tela, entao a forma completa continua no aria-label.
    function acaoLabel(completo, curto) {
      return estreito ? curto : completo;
    }
    if (acoes.cancelar) {
      actions.appendChild(el('button', {
        id: 'oc-cancelar',
        class: 'font-semibold px-3',
        style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);color:var(--rv-signal-negative);height:var(--rv-h-default);padding-top:0;padding-bottom:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:var(--rv-fs-body);border-radius:var(--rv-radius);',
        'aria-label': 'Cancelar ordem',
        onclick: function () { handlers.cancelar(o); },
      }, acaoLabel('Cancelar ordem', 'Cancelar')));
    }
    // EXCLUIR (db/96 + db/97). Distinto de Cancelar: Cancelar preserva uma
    // ordem real na historia; Excluir apaga uma que nao deveria existir. A
    // disponibilidade vem EXCLUSIVAMENTE de `acoes.excluir`, decidido pelo
    // servidor em public.oc_elegivel_exclusao — a tela nunca recalcula a regra.
    if (acoes.excluir === true) {
      actions.appendChild(el('button', {
        id: 'oc-excluir',
        class: 'font-semibold px-3',
        style: 'background:var(--rv-surface);border:1px solid var(--rv-signal-negative-border);color:var(--rv-signal-negative);height:var(--rv-h-default);padding-top:0;padding-bottom:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:var(--rv-fs-body);border-radius:var(--rv-radius);',
        'aria-label': 'Excluir ordem',
        onclick: function () { handlers.excluir(o); },
      }, acaoLabel('Excluir ordem', 'Excluir')));
    }
    // AUSENTE no estreito, nao encurtado: e navegacao contextual (§2.5.1), nao
    // uma acao de estado, e a barra lateral ja roteia para o Pedido.
    if (o.pedido_id && !estreito) {
      actions.appendChild(el('button', {
        id: 'oc-abrir-pedido', class: 'font-semibold px-3',
        style: 'background:none;border:none;cursor:pointer;height:var(--rv-h-default);'
          + 'display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:var(--rv-fs-body);color:var(--rv-accent-blue);',
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
        class: 'font-semibold px-3 hover:opacity-90',
        style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;'
          + 'height:var(--rv-h-primary);padding-top:0;padding-bottom:0;cursor:pointer;'
          + 'display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:var(--rv-fs-body);border-radius:var(--rv-radius);',
        'aria-label': 'Emitir ordem',
        onclick: function () { handlers.emitir(o); },
      }, acaoLabel('Emitir ordem', 'Emitir'));
    } else {
      // §2.1: "A disabled control KEEPS ITS ENABLED COLOURS — there is no
      // disabled colour token and a washed-out substitute value is a defect
      // (D9)." This used to swap the brand fill for a --rv-chip-bg/secondary
      // pair, which is exactly that substitute. Opacity .45 and the default
      // cursor are the declared disabled expression.
      emitBtn = el('button', {
        id: 'oc-emitir',
        class: 'font-semibold px-3',
        style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;'
          + 'height:var(--rv-h-primary);padding-top:0;padding-bottom:0;'
          + 'display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:var(--rv-fs-body);border-radius:var(--rv-radius);'
          + 'opacity:.45;cursor:default;',
        title: BLOQUEIO_LABEL[o.bloqueio_emissao] || 'Emissão indisponível nesta fase.',
        'aria-label': 'Emitir ordem',
        disabled: true,
      }, acaoLabel('Emitir ordem', 'Emitir'));
    }
    actions.appendChild(emitBtn);

    // A linha do cabecalho: titulo a esquerda, acoes a direita, alinhadas ao
    // TOPO do bloco de titulo. `flex-wrap` no PAI, para que num viewport
    // estreito a barra caia inteira em vez de espremer o titulo.
    head.appendChild(el('div', {
      class: 'flex flex-wrap justify-between',
      style: 'align-items:flex-start;gap:12px;',
    }, titleBlock, actions));

    // Readiness / blocker context (server-derived, §7 matrix).
    //
    // §2.11/D12: estes sao AVISOS AUTONOMOS. A regra e global — cada um ocupa a
    // largura inteira da sua regiao de conteudo COMO CARTAO, com fundo, borda,
    // icone e texto de UMA familia semantica coerente, e "must not be rendered
    // INLINE INSIDE A PAGE-TITLE BLOCK". Eram tres linhas de texto colorido de
    // 11,5px penduradas no cartao do cabecalho — o mesmo defeito que D12 fechou
    // no painel administrativo, onde a correcao ratificada foi exatamente
    // mover o aviso "out of the title block into its own full-width card row".
    box.appendChild(head);

    if (podeEmitir) {
      box.appendChild(noticeCard('oc-emissao-pronta', 'positive',
        'Distribuição completa — pronta para emissão. A emissão é definitiva (reversível apenas por cancelamento).'));
    } else if (o.bloqueio_emissao) {
      box.appendChild(noticeCard('oc-bloqueio-emissao', 'caution',
        BLOQUEIO_LABEL[o.bloqueio_emissao] || o.bloqueio_emissao));
    }

    // An emitted order that awaits acceptance is NOT lifecycle-complete until the
    // acceptance decision ships (PHASE-C5B) — surfaced honestly (§21). Currently
    // unreachable via the canonical path (exige_aceite is seeded false), so this
    // is a defensive notice; no acceptance/rejection control is offered.
    if (o.status_administrativo === 'emitida' && o.status_aceite === 'pendente') {
      box.appendChild(noticeCard('oc-aceite-pendente-aviso', 'caution',
        'Ordem emitida, aguardando aceite — o fluxo de aceite ainda não está disponível, portanto a ordem ainda não está concluída.'));
    }

    // ---- MATERIAIS — FALLBACK ONLY (BACKLOG-7 PHASE 3) ------------------
    //
    // Esta tabela era a PRIMEIRA das tres representacoes concorrentes do mesmo
    // material: "Itens" aqui, "Saldos por item" e "Alocações" na superficie de
    // recebimento logo abaixo. A fase 3 funde as tres num unico bloco
    // MATERIAIS, dono por ordem-compra-receipt-render.js, que e onde as
    // quantidades recebidas, restantes e excedentes de facto existem.
    //
    // Ela NAO e removida, porque a superficie de recebimento so existe para uma
    // ordem NATIVA fora do rascunho (contrato §7). Para uma ordem LEGADA ou um
    // RASCUNHO nativo nao ha recebimento nenhum, e apaga-la deixaria essas duas
    // rotas sem material visivel — uma regressao. Nesses casos ela e a UNICA
    // representacao do material, portanto nao concorre com nada, e passa a
    // chamar-se "Materiais" como o bloco canonico.
    //
    // A condicao e a NEGACAO EXATA da condicao de montagem de
    // renderReceiptSection, escrita a partir dos mesmos dois campos do read
    // model, e nao uma segunda regra a manter em sincronia por memoria.
    var temSuperficieRecebimento = o.modelo === 'nativo' && o.status_administrativo !== 'rascunho';
    var items = o.itens || [];
    var itemsCard = card('overflow-hidden');
    itemsCard.appendChild(sectionBand('Materiais'));
    if (!items.length) {
      itemsCard.appendChild(el('div', {
        class: 'p-6 text-center',
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
      }, 'Nenhum item neste rascunho.'));
    } else {
      // Pass-8 §2.5: four <col>s for the four rendered columns (Fio, Kg pedido,
      // Kg alocado, ações). The two kg columns were already right-aligned with
      // tabular numerals; only the width owner was missing.
      var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
      t.appendChild(el('colgroup', {},
        el('col', { style: 'width:40%;' }),
        el('col', { style: 'width:22%;' }),
        el('col', { style: 'width:22%;' }),
        el('col', { style: 'width:16%;' })));
      // Renamed from `th`: a local of that name hoisted over the module-level
      // th() helper for the whole of renderDetail, so any later call would have
      // thrown on a DOM node.
      var itemsHead = el('thead', {
        style: 'background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);',
      });
      itemsHead.appendChild(el('tr', {},
        thCompact('Fio'), thCompact('Kg pedido', true), thCompact('Kg alocado', true), thCompact('', true)));
      var tb = el('tbody', {});
      items.forEach(function (it) {
        var tr = el('tr', { 'data-item-id': String(it.item_id), style: 'border-top:1px solid var(--rv-border-soft);' });
        tr.appendChild(tdText(fioLabel(it), 'px-4 py-2'));
        tr.appendChild(tdNum(fmtKg(it.kg_pedido), 'px-4 py-2'));
        tr.appendChild(tdNumMuted(fmtKg(it.kg_alocado), 'px-4 py-2'));
        var actTd = el('td', { class: 'px-4 py-2 text-right whitespace-nowrap' });
        tr.appendChild(actTd);
        tb.appendChild(tr);
      });
      t.appendChild(itemsHead); t.appendChild(tb);
      itemsCard.appendChild(t);
    }
    if (!temSuperficieRecebimento) box.appendChild(itemsCard);

    return box;
  };

  // ---- PROVENIÊNCIA ----------------------------------------------------
  //
  // PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1. `state.distribuicao` já
  // era carregado a cada abertura desta tela e o resultado era descartado,
  // porque nada montava a seção que o consumia. Ele alimenta a seção de
  // proveniência somente-leitura: de onde veio cada quilo deste documento
  // (Pedido, necessidade, OP ou Pedido compartilhado, quantidade original por
  // origem e a reconciliação com a quantidade pedida do item). Nenhum controle
  // de mutação é montado — o planejamento continua pertencendo a
  // Pedido › Planejamento de compras.
  //
  // BACKLOG-7 PHASE 3: EXTRAÍDA de renderDetail pela MESMA razão pela qual
  // renderEventosAdmin já o foi em 648f09c. Enquanto era construída aqui dentro,
  // ela caía entre o cabeçalho e a superfície de recebimento — ou seja, um
  // bloco de APOIO somente-leitura separava o operador da leitura operacional
  // principal. Agora o orquestrador a coloca depois do cockpit.
  //
  // O CONTEÚDO, a fonte e a representação NÃO mudam: a demoção de proveniência
  // é fase 6 e não é iniciada aqui.
  ns.renderProvenanceSection = function (state) {
    var o = state && state.ordem;
    if (state.indisponivel || !o) return null;
    var distribApi = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraDistribuicao;
    if (!distribApi || typeof distribApi.renderProvenance !== 'function') return null;
    return distribApi.renderProvenance(state.distribuicao, o) || null;
  };

  // ---- EVENTOS ADMINISTRATIVOS ----------------------------------------
  //
  // DUAS correcoes de revisao numa so extracao.
  //
  // 1. POSICAO. Este bloco era construido DENTRO de renderDetail e ficava
  //    ACIMA da secao Recebimentos, porque o orquestrador anexa a secao de
  //    recebimento como IRMA do detalhe, depois dele. O resultado era a tela
  //    a apresentar o log administrativo (emitida, recebimento_registrado,
  //    recebimento_estornado) ANTES do estado operacional que ele descreve, e
  //    DOIS blocos chamados "Histórico" a poucos pixels um do outro. Agora ele
  //    e o ULTIMO bloco da pilha, como manda a IA aceita do BACKLOG 7:
  //    proveniencia e log administrativo sao apoio, nao a leitura principal.
  //
  // 2. NOME. Passa a chamar-se "Eventos administrativos". "Histórico" era o
  //    mesmo rotulo que a secao de recebimento ja usa para a sua propria
  //    historia de comandos — duas coisas diferentes com o mesmo nome, na
  //    mesma tela.
  //
  // O conteudo, a fonte (state.eventos) e a formatacao das linhas nao mudam.
  ns.renderEventosAdmin = function (state) {
    var o = state && state.ordem;
    if (state.indisponivel || !o) return null;

    var evCard = card('overflow-hidden');
    evCard.appendChild(sectionBand('Eventos administrativos'));
    var evs = state.eventos || [];
    if (!evs.length) {
      evCard.appendChild(el('div', {
        class: 'p-6 text-center',
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
      }, 'Sem eventos administrativos.'));
    } else {
      var list = el('div', {});
      evs.forEach(function (e, i) {
        list.appendChild(el('div', {
          class: 'px-5 py-3 flex justify-between',
          style: i > 0
            ? 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);border-top:1px solid var(--rv-border-soft);'
            : 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);',
        },
          el('span', {}, (e.tipo_evento || '') + (e.valor_anterior ? (' (' + e.valor_anterior + ' → ' + e.valor_novo + ')') : '')),
          el('span', {
            style: 'font-size:var(--rv-fs-2xs);color:var(--rv-text-tertiary);',
          }, e.criado_em ? String(e.criado_em).slice(0, 19).replace('T', ' ') : '')));
      });
      evCard.appendChild(list);
    }
    return evCard;
  };
})(window);
