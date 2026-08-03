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
// VISUAL — BACKLOG-7 PHASE 1. Every visual value on this surface now resolves
// through a CANONICAL css/tokens.css owner. The file previously spoke the
// `--rv-color-*` / `--rv-radius-card` / `--rv-radius-control` compatibility
// namespace that tokens.css itself declares "LEGACY COMPATIBILITY —
// NONCONFORMING / DEPRECATED … New code must not use them", and took every type
// size from a Tailwind utility — including `text-sm` (14px), a value that is not
// in the UI_VISUAL_CONTRACT.md §5 enum at all.
//
// Now: flat hairline card at --rv-radius with a --rv-border hairline and no
// shadow (§2.4); a 20px section icon chip on --rv-chip-bg / --rv-chip-glyph with
// a SECTION_LABEL heading (§2.4); golden-rule tables (§2.5) whose headers take
// the TABLE_HEADER role and whose cells take BODY_CONTROL_CELL, right-aligned
// with tabular numerics and decimal comma + unit (§7); one dominant
// "Registrar recebimento" action on the §2.1 Primary variant at a declared ladder
// height; command-type badges built by the js/badges.js canonical owner (§2.6)
// rather than a screen-local family map; and the ratified compact icon-only
// row-level reversal button (§2.9) via js/ui.js's actionButton().
//
// Tailwind still owns LAYOUT and SPACING only (flex, grid, padding), for which
// no canonical --rv token exists. Tables are hand-built with the sibling
// ordem-compra-render.js idiom so numeric HEADERS align right with their VALUES
// (dataTable() header cells are text-left only).
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
  var ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

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

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: ANTES esta funcao devolvia
  // `'OP ' + opId` — a CHAVE PRIMARIA crua exibida como nome de negocio, uma
  // TERCEIRA identidade da mesma OP (`OP 137`) alem do numero interno e do
  // codigo canonico.
  //
  // As RPCs aceitas de recebimento atribuem origem apenas por `op_id`, entao
  // a identidade e resolvida por `public.op_identidade_projecao` (db/95) e
  // entregue aqui num mapa op_id -> identidade. Sem mapa, estado diagnostico
  // explicito: nunca mais a chave crua.
  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: as RPCs aceitas de recebimento
  // devolvem apenas `op_id`. O mapa op_id -> identidade e resolvido uma vez
  // por carga (ordem-compra-receipt-data.js) e guardado aqui em variavel de
  // modulo, porque as funcoes internas de tabela nao recebem `state` e
  // threadar o parametro por todas elas seria ruido sem ganho.
  var opIdentidades = null;

  function opLabel(opId) {
    return window.RAVATEX_OP_DISPLAY.formatOpIdentityFromMap(opId, opIdentidades);
  }

  function sectionCard(children) {
    return el('div', {
      id: 'oc-recebimentos', class: 'overflow-hidden mb-4',
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);',
    }, children);
  }

  // Section header: icon chip (20px, --rv-radius) using the neutral
  // section chip tokens (§6) + 11px UPPERCASE --rv-text-tertiary label +
  // optional dominant action on the right (§8).
  function sectionHeader(actionNode) {
    var chip = el('span', {
      style: 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;'
        + 'border-radius:var(--rv-radius);background:var(--rv-chip-bg);color:var(--rv-chip-glyph);flex:none;',
    }, svgIcon(ICON_INBOX));
    var label = el('span', {
      style: 'font-size:var(--rv-fs-label);font-weight:700;letter-spacing:var(--rv-tracking-label);'
        + 'text-transform:uppercase;color:var(--rv-text-tertiary);',
    }, 'Recebimentos');
    var left = el('div', { class: 'flex items-center gap-2' }, chip, label);
    return el('div', {
      class: 'px-5 py-3 flex items-center justify-between',
      style: 'border-bottom:1px solid var(--rv-border);',
    }, left, actionNode || el('span', {}));
  }

  // §2.5 owns the table header role: --rv-fs-thead / 600 / uppercase /
  // --rv-text-tertiary. The Tailwind `text-xs` this used to carry painted 12px,
  // which is COMPACT_CONTENT, not TABLE_HEADER — D10 classifies a site by its
  // role, never by the number nearest the one already written.
  function th(label, right) {
    return el('th', {
      class: 'px-4 py-2 ' + (right ? 'text-right' : 'text-left'),
      style: 'font-size:var(--rv-fs-thead);font-weight:600;text-transform:uppercase;'
        + 'letter-spacing:var(--rv-tracking-thead);color:var(--rv-text-tertiary);',
    }, label);
  }
  // `text-sm` painted 14px, a value that is NOT in the §5 enum at all. A table
  // cell is BODY_CONTROL_CELL and takes --rv-fs-body (13px).
  function tdNum(value) {
    return el('td', {
      class: 'px-4 py-2 text-right',
      style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-variant-numeric:tabular-nums;',
    }, fmtKg(value));
  }
  function tdText(value, muted) {
    return el('td', {
      class: 'px-4 py-2',
      style: 'font-size:var(--rv-fs-body);color:'
        + (muted ? 'var(--rv-text-secondary)' : 'var(--rv-text-primary)') + ';',
    }, value);
  }
  function theadRow(cells) {
    return el('thead', { style: 'background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);' },
      el('tr', {}, cells));
  }
  // Token-based row separator (§4 line-100) — replaces the Tailwind
  // divide-gray-* utility so re-theming flows through the tokens.
  function bodyRow(attrs, cells) {
    var style = 'border-top:1px solid var(--rv-border-soft);' + (attrs.style || '');
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
    // Pass-8 §2.5: `table-layout:fixed` alone left the column widths to the
    // browser. The <colgroup> is the missing width owner; its five <col>s match
    // the five header cells and the five value cells exactly. Every width is a
    // LITERAL style — a computed `'width:' + w` would be undecodable for the
    // conformance detector and would open a UIC-000 coverage gap for a value
    // that is entirely static.
    t.appendChild(el('colgroup', {},
      el('col', { style: 'width:36%;' }),
      el('col', { style: 'width:16%;' }),
      el('col', { style: 'width:16%;' }),
      el('col', { style: 'width:16%;' }),
      el('col', { style: 'width:16%;' })));
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
      return el('div', { class: 'px-5 py-4', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' }, 'Nenhuma alocação neste item.');
    }
    var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
    t.appendChild(el('colgroup', {},
      el('col', { style: 'width:28%;' }),
      el('col', { style: 'width:24%;' }),
      el('col', { style: 'width:16%;' }),
      el('col', { style: 'width:16%;' }),
      el('col', { style: 'width:16%;' })));
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

  // §2.6 names js/badges.js as the SINGLE runtime owner of the state → family
  // mapping, and forbids a screen from declaring its own. This used to hold a
  // local two-entry colour map painting `estorno` with a bare
  // --rv-signal-negative foreground on a plain --rv-surface fill: a mismatched
  // fill/border chroma (§1) built from a family map that is not this screen's
  // to own.
  //
  // The command type is now resolved through the canonical constructor with the
  // domain's own key. `recebimento` resolves through the ruled label `Recebido`
  // to the positive family; `estorno` is NOT in the ruled map and therefore
  // resolves to NEUTRAL — which is §2.6's explicit contract for an unrecognised
  // state ("it never receives an invented semantic family"), not an oversight.
  // Whether a reversal earns a named negative family is an event-typology
  // decision that belongs to the timeline phase, not to a token migration.
  function tipoBadge(comandoTipo) {
    return comandoTipo === 'estorno'
      ? window.rvStatusPill('Estorno', 'estorno')
      : window.rvStatusPill('Recebimento', 'recebido');
  }

  // One reversal control per reversible receipt lançamento. Compact icon-only
  // row action (§8.1) via actionButton(): 30×30, --rv-radius, title +
  // aria-label + sr-only label (all inside actionButton). Reversibility is
  // derived strictly from the server model (acoes.estornar AND
  // kg_reversivel > 0). The confirmDialog gate before execution is wired in
  // the events layer.
  //
  // AUSENTE, NÃO DESABILITADO. Antes o controle era sempre construído e só
  // ficava `disabled`, então um lançamento JÁ TOTALMENTE ESTORNADO continuava
  // anunciando "Estornar recebimento do lançamento 54" ao lado da própria
  // linha que dizia "Reversível 0,000 kg" — a mesma tela afirmando duas
  // coisas contrárias, e para leitor de tela a ação simplesmente existia.
  // Sem saldo reversível não há ação: devolver null é o que faz a célula
  // concordar com a coluna Reversível e com o bloco de estorno abaixo.
  // O estado "totalmente estornado" continua legível — ele é dito pelo valor
  // 0,000 em Reversível e pelo bloco de Estorno, não por um botão morto.
  function reversalButton(comando, lanc, acoes, handlers) {
    var reversible = comando.comando_tipo === 'recebimento'
      && acoes && acoes.estornar === true
      && Number(lanc.kg_reversivel) > 0;
    if (!reversible) return null;
    return window.actionButton({
      title: 'Estornar recebimento',
      icon: svgIcon(ICON_UNDO),
      danger: true,
      srLabel: 'Estornar recebimento do lançamento ' + lanc.id,
      onclick: function () { handlers.estornarLancamento(comando, lanc); },
    });
  }

  function metaSpan(label, value, title) {
    var attrs = { style: 'color:var(--rv-text-secondary);' };
    if (title) attrs.title = title;
    return el('span', attrs, label + (value == null ? '—' : value));
  }

  // db/119: administrative correction of the four metadata fields of a
  // RECEIPT command. Availability is not recomputed here — `atorTipo` is the
  // server's own classification of the caller, carried by the read model
  // (obter_historico_recebimento_ordem_compra returns ator_tipo). A reversal
  // command carries no correctable metadata and gets no control, matching the
  // server, which refuses it with estado_invalido.
  //
  // Compact icon-only row action (§8.1) via actionButton(): 30×30,
  // --rv-radius, title + aria-label + sr-only label. NOT danger:
  // correcting a document reference is an ordinary administrative edit and
  // must not borrow the destructive affordance of the reversal control.
  function editMetadataButton(comando, atorTipo, handlers) {
    var editable = comando.comando_tipo === 'recebimento' && atorTipo === 'admin';
    if (!editable) return null;
    return window.actionButton({
      title: 'Editar dados do recebimento',
      icon: svgIcon(ICON_EDIT),
      srLabel: 'Editar dados do recebimento de ' + fmtDateTime(comando.ocorrido_em),
      onclick: function () { handlers.editarMetadadosRecebimento(comando); },
    });
  }

  // Command history: one block per command (recebimento/estorno) with its
  // header metadata and a nested lançamentos table carrying honest per-line
  // OP/excess attribution and the row-level reversal control.
  function historico(comandos, acoes, handlers, atorTipo) {
    if (!comandos.length) {
      return el('div', {
        id: 'oc-recebimentos-historico', class: 'px-5 py-8 text-center',
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
      }, 'Nenhum recebimento registrado ainda.');
    }
    var wrap = el('div', { id: 'oc-recebimentos-historico' });
    comandos.forEach(function (c, i) {
      var block = el('div', {
        class: 'px-5 py-4', 'data-comando-id': String(c.id),
        style: i > 0 ? 'border-top:1px solid var(--rv-border-soft);' : '',
      });
      var meta = el('div', {
        class: 'flex flex-wrap items-center gap-x-4 gap-y-1',
        style: 'font-size:var(--rv-fs-body);',
      },
        tipoBadge(c.comando_tipo),
        el('span', { style: 'color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;' }, fmtDateTime(c.ocorrido_em)),
        metaSpan('Ator: ', c.ator_tipo || '—'),
        metaSpan('Doc.: ', c.documento_ref || '—', c.documento_ref || undefined),
        metaSpan('Origem: ', (c.origem_tipo || '—') + (c.origem_ref ? (' / ' + c.origem_ref) : ''), c.origem_ref || undefined));
      // db/119: the metadata line owns its own correction control, on the same
      // row and to the right, so the Edit action sits with the values it edits.
      var editBtn = editMetadataButton(c, atorTipo, handlers);
      block.appendChild(el('div', { class: 'flex items-start justify-between gap-3 mb-2' },
        meta, editBtn || el('span', {})));

      var showActions = c.comando_tipo === 'recebimento';
      // Pass-8 §2.5: this history table renders SIX columns — Fio, Origem, Kg,
      // Kg excesso, Reversível and the Ações cell that carries the row-level
      // reversal control. The <colgroup> declares all six.
      var t = el('table', { class: 'w-full', style: 'table-layout:fixed;' });
      t.appendChild(el('colgroup', {},
        el('col', { style: 'width:24%;' }),
        el('col', { style: 'width:20%;' }),
        el('col', { style: 'width:14%;' }),
        el('col', { style: 'width:14%;' }),
        el('col', { style: 'width:14%;' }),
        el('col', { style: 'width:14%;' })));
      // The sixth header used to be an inline copy of th() that had drifted from
      // it (12px vs the header role, secondary vs tertiary). It is the same role
      // as its five siblings and now goes through the same owner.
      t.appendChild(theadRow([th('Fio'), th('Origem'), th('Kg', true), th('Kg excesso', true),
        th('Reversível', true), th(showActions ? 'Ações' : '', true)]));
      var body = el('tbody', {});
      (c.lancamentos || []).forEach(function (l) {
        var actTd = el('td', { class: 'px-4 py-2 text-right' });
        // reversalButton devolve null quando não há saldo reversível; a
        // célula fica vazia em vez de hospedar uma ação morta.
        var acaoEstorno = showActions ? reversalButton(c, l, acoes, handlers) : null;
        if (acaoEstorno) actTd.appendChild(acaoEstorno);
        body.appendChild(bodyRow({ 'data-lancamento-id': String(l.id) }, [
          tdText(fioLabel(l)),
          tdText(opLabel(l.op_id), l.op_id == null),
          el('td', {
            class: 'px-4 py-2 text-right',
            style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-variant-numeric:tabular-nums;',
          }, fmtKg(l.kg)),
          tdNum(l.kg_excesso),
          el('td', {
            class: 'px-4 py-2 text-right',
            style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;',
          }, fmtKg(l.kg_reversivel)),
          actTd,
        ]));
      });
      t.appendChild(body);
      block.appendChild(el('div', { class: 'overflow-x-auto' }, t));
      wrap.appendChild(block);
    });
    return wrap;
  }

  // A subsection band inside the card. SECTION_LABEL role (§5): 11px / 700 /
  // uppercase / --rv-text-tertiary, with the canonical label tracking. The
  // Tailwind `text-xs`+`tracking-wide` pair painted 12px at .025em, neither of
  // which is the declared value for this role.
  function subHeader(label) {
    return el('div', {
      class: 'px-5 py-2',
      style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
        + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);'
        + 'background:var(--rv-surface-subtle);border-bottom:1px solid var(--rv-border);',
    }, label);
  }

  // renderReceiptSection(state, handlers) → DOM node, or null when no section
  // must exist (non-native order, or native draft — contract §7 matrix).
  ns.renderReceiptSection = function (state, handlers) {
    // Ponto de entrada unico desta secao: sincroniza o mapa de identidade.
    opIdentidades = (state && state.opIdentidades) || null;
    var o = state && state.ordem;
    if (!o || o.modelo !== 'nativo') return null;
    if (o.status_administrativo === 'rascunho') return null;

    var hist = state.receiptHistory;

    // Loading / error / empty are honest, distinct states (§15).
    if (!hist || hist.loading) {
      return sectionCard([
        sectionHeader(null),
        el('div', { class: 'px-5 py-8 text-center', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' }, 'Carregando recebimentos…'),
      ]);
    }
    if (hist.ok !== true) {
      return sectionCard([
        sectionHeader(null),
        el('div', { id: 'oc-recebimentos-erro', class: 'px-5 py-8 text-center', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' },
          'Não foi possível carregar os recebimentos.'),
      ]);
    }

    var acoes = hist.acoes || {};
    var registrarBtn = null;
    if (acoes.receber === true) {
      // §2.1 Primary: --rv-brand fill, --rv-text-on-brand foreground, no border,
      // and a declared height from the closed 3-rung ladder. It used to take its
      // height from `py-2` (~36px, off the ladder), its foreground from Tailwind
      // `text-white`, and its size from `text-sm` (14px, absent from the enum).
      registrarBtn = el('button', {
        id: 'oc-registrar-recebimento',
        class: 'font-semibold px-3 hover:opacity-90',
        style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;'
          + 'height:var(--rv-h-primary);padding-top:0;padding-bottom:0;'
          + 'display:inline-flex;align-items:center;justify-content:center;'
          + 'font-size:var(--rv-fs-body);border-radius:var(--rv-radius);',
        onclick: function () { handlers.abrirRegistroRecebimento(); },
      }, 'Registrar recebimento');
    }

    var children = [sectionHeader(registrarBtn)];

    // PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1. O recebimento canônico
    // só existe depois do cutover (ordem_compra_cutover = canonical_active /
    // canonical). Enquanto ele não vale, o escritor recusa com
    // `recebimento_canonico_inativo` — e, antes de db/100, o read model ainda
    // oferecia a ação: o operador preenchia o formulário inteiro e só então
    // descobria a recusa.
    //
    // O bloqueador é SERVIDOR (`hist.bloqueio_recebimento`). Esta tela apenas
    // o repete; nunca reconstrói o estado do cutover em JavaScript, e não
    // existe nenhum caminho aqui que leia ordem_compra_cutover.
    if (hist.bloqueio_recebimento === 'recebimento_canonico_inativo') {
      children.push(el('div', {
        id: 'oc-recebimento-inativo',
        class: 'px-5 py-3 text-sm',
        style: 'color:var(--rv-text-secondary);border-bottom:1px solid var(--rv-border-soft);',
      }, 'Registro de recebimento indisponível: a virada para o recebimento canônico ainda '
        + 'não foi ativada. O histórico abaixo é somente leitura.'));
    }

    var itens = hist.itens || [];
    children.push(subHeader('Saldos por item'));
    children.push(itens.length ? itensTable(itens) : el('div', { class: 'px-5 py-4', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' }, 'Nenhum item nesta ordem.'));
    children.push(subHeader('Alocações'));
    children.push(alocacoesTable(itens));
    children.push(subHeader('Histórico'));
    children.push(historico(hist.comandos || [], acoes, handlers, hist.ator_tipo));

    return sectionCard(children);
  };
})(window);
