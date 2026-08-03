// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RECEIPT RENDER (PHASE-C4) =============
// Phase: PHASE-C4 (docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md,
// OC-C4-ADMIN-001). Pure render for the persistent receipt surface on the
// dedicated purchase-order detail screen (§R.24.9). Receives
// (state, handlers) and returns DOM nodes — NO Supabase, NO state mutation,
// NO DML (CODE_HEALTH §9). All action availability is read from the
// server-derived `acoes` object in the read model (state.receiptHistory) —
// never recomputed client-side, never inferred from local status fields.
//
// Rendered ONLY for native orders past the draft stage; legacy
// (modelo==='legado') and native-draft orders render no surface (contract §7
// matrix). NULL-op / Pedido-origin allocations render as a first-class,
// honest "Pedido (compartilhada)" attribution — never a fabricated OP
// (§R.28.6/§R.29.2). Excess is shown explicitly and distinctly from
// allocation quantities.
//
// ---------------------------------------------------------------------
// VISUAL — BACKLOG-7 PHASE 3. THE MATERIAL IS THE OPERATIONAL UNIT.
//
// Until now this surface published the SAME operational reality as THREE
// competing primary representations, each a table of its own with its own
// band: "Itens" (on the detail card above), "Saldos por item" and
// "Alocações". A material's ordered quantity lived in the first, its
// received/remaining/excess in the second, and its destinations in the
// third — so the operator had to reassemble one material from three places
// and hold the join in their head. None of the three answered, on its own,
// the question that makes somebody open this screen: what did I order, how
// much of it arrived, how much is still missing, is any of it excess, and
// what can I do now.
//
// The three are now ONE block, MATERIAIS, whose unit is the material and not
// the row. Each material states its own identity, its own receipt state, its
// four quantities and its own destinations, together, in one place. The
// destinations are DEMOTED inside the material they belong to — secondary
// disclosure per the approved D1 — instead of standing as a third top-level
// table.
//
// The surface is now an Archetype-A cockpit (UI_VISUAL_CONTRACT.md §3A):
// content on the left, and a sticky rail carrying the ORDER-level state, the
// order-level aggregate and the one dominant flow action. §3A's "never repeat
// the same datum on both sides" is why the rail carries aggregates and the
// order's own status, and the left carries per-material facts: an aggregate
// is not the datum its parts are.
//
// ---------------------------------------------------------------------
// VISUAL — BACKLOG-7 PHASE 4. THE HISTORY IS A BUSINESS NARRATIVE.
//
// The receipt history was a LEDGER TABLE: one block per command, and inside it
// six columns — Fio, Origem, Kg, Kg excesso, Reversível, Ações. To learn that
// 880,650 kg arrived and later left, the operator read two separate tables,
// compared unsigned numbers, noticed that a column called "Reversível" had
// fallen to zero, and inferred the relation between them. Two of those six
// columns were structurally DEAD on every reversal row: a reversal is never
// reversible and never offers an action.
//
// The same history is now a chronological narrative of ENTRIES, each stating
// what happened, to which material, how much, in which direction, when and by
// whom. A reversal names the receipt it undoes BY ITS DATE, resolved through
// the server's own `estorno_de_id` link — so it reads as a business event tied
// to the quantity it removes, not as a loose technical row. Order is ASCENDING,
// exactly as db/100 returns it; the screen re-sorts nothing.
//
// THE TIMELINE DOES NOT OWN CURRENT STATE. The phase-3 materials cockpit
// remains the single owner of what the balance IS; the timeline explains only
// HOW it got there. No entry states an order-level running total — an entry
// speaks only of its own effect and of how much of itself has been reversed.
//
// WHAT THESE PHASES DO NOT DO. They do not change receipt accounting. Every
// number rendered here is projected by the server
// (obter_historico_recebimento_ordem_compra, db/100): kg_pedido, kg_recebido,
// kg_restante = GREATEST(kg_pedido - kg_recebido, 0), kg_excesso and
// kg_reversivel are read, never derived, and the +/- direction of a lançamento
// is the sign the db/70 writer stored. Action availability still comes only
// from `acoes`. The registration modal is phase 5; the demotion of provenance
// and administrative events is phase 6.
//
// THE THIRD FAMILY — ADMINISTRATIVE CORRECTION (db/122).
//
// db/119 always recorded every administrative metadata correction, with the
// full before/after image of the four correctable fields. But its table has RLS
// enabled and ALL privileges revoked from PUBLIC, anon, authenticated AND
// service_role, and the read model — db/100, written BEFORE db/119 — never knew
// about it. A correction could therefore exist in the system, and the business
// date of a real receipt could have been changed, with no trace anywhere in the
// product. That was an auditability gap, not a design choice.
//
// db/122 closes it WITHOUT weakening anything: the table keeps its RLS and its
// revocations, and the projection is added to the SECURITY DEFINER read model
// that already decides who may read this order. The correction's actor travels
// as a TYPE resolved through public.usuarios, never as the auth.users UUID the
// table stores.
//
// The surface degrades OPEN: while db/122 is not applied, the read model simply
// returns no `correcoes` and no `criado_em`, and the timeline renders exactly
// the receipt/reversal narrative it rendered before, in the server's own order.
//
// VISUAL — BACKLOG-7 PHASE 1 (retained). Every visual value on this surface
// resolves through a CANONICAL css/tokens.css owner: flat hairline card at
// --rv-radius (§2.4); 20px section icon chips on --rv-chip-bg /
// --rv-chip-glyph with SECTION_LABEL headings and A DISTINCT ICON PER SECTION
// (§2.4); tabular numerics with decimal comma + unit (§7); one dominant
// "Registrar recebimento" action on the §2.1 Primary variant at a declared
// ladder height, now width:100% because §2.1's first exception is exactly
// "in the rail every control is width:100%"; and command-type badges built by
// the js/badges.js canonical owner (§2.6).
//
// Tailwind still owns LAYOUT and SPACING only (flex, grid, padding), for which
// no canonical --rv token exists.
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
  // §2.4 requires A DISTINCT ICON PER SECTION. The surface now opens three
  // sections — Materiais, Histórico and the rail's Recebimento — so each takes
  // its own glyph instead of repeating the inbox three times.
  var ICON_LAYERS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>';
  var ICON_INBOX = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>';
  var ICON_CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  var ICON_UNDO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
  // §2.11/D12: a standalone notice carries an icon from its own semantic family.
  var ICON_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

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
  // explicito: nunca mais a chave crua. O mapa e resolvido uma vez por carga
  // (ordem-compra-receipt-data.js) e guardado aqui em variavel de modulo,
  // porque as funcoes internas nao recebem `state` e threadar o parametro por
  // todas elas seria ruido sem ganho.
  var opIdentidades = null;

  function opLabel(opId) {
    return window.RAVATEX_OP_DISPLAY.formatOpIdentityFromMap(opId, opIdentidades);
  }

  function sectionCard(id, children) {
    return el('div', {
      id: id, class: 'overflow-hidden',
      style: 'background:var(--rv-surface);border:1px solid var(--rv-border);border-radius:var(--rv-radius);',
    }, children);
  }

  // Section header: icon chip (20px, --rv-radius) using the neutral
  // section chip tokens (§6) + 11px UPPERCASE --rv-text-tertiary label +
  // optional trailing node on the right (§8).
  function sectionHeader(label, iconMarkup, trailingNode) {
    var chip = el('span', {
      style: 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;'
        + 'border-radius:var(--rv-radius);background:var(--rv-chip-bg);color:var(--rv-chip-glyph);flex:none;',
    }, svgIcon(iconMarkup));
    var title = el('span', {
      style: 'font-size:var(--rv-fs-label);font-weight:700;letter-spacing:var(--rv-tracking-label);'
        + 'text-transform:uppercase;color:var(--rv-text-tertiary);',
    }, label);
    var left = el('div', { class: 'flex items-center gap-2 min-w-0' }, chip, title);
    return el('div', {
      class: 'px-5 py-3 flex items-center justify-between gap-3 flex-wrap',
      style: 'border-bottom:1px solid var(--rv-border);',
    }, left, trailingNode || el('span', {}));
  }

  // BACKLOG-7 PHASE 2 — o estado de recebimento DA ORDEM, finalmente dito.
  //
  // `status_recebimento` e derivado pelo servidor e projetado pelos DOIS read
  // models (obter_ordem_compra_admin e obter_historico_recebimento_ordem_compra,
  // db/100), e nao era renderizado em lugar nenhum: ordem-compra-render.js ate
  // declarava um RECEB_LABEL que nenhum leitor consumia. A pergunta que faz o
  // operador abrir a tela — "isto chegou?" — tinha resposta pronta no servidor e
  // era jogada fora, obrigando-o a subtrair Kg restante de Kg pedido.
  //
  // As tres chaves resolvem por si no mapa ruled do §2.6: `recebido` -> positive,
  // `parcial` -> caution, `nao_recebido` -> neutral. Nenhuma familia inventada.
  var RECEBIMENTO_LABEL = {
    nao_recebido: 'Não recebido',
    parcial: 'Parcial',
    recebido: 'Recebido',
  };

  function statusRecebimentoPill(status) {
    var label = RECEBIMENTO_LABEL[status];
    if (!label) return null;
    var pill = window.rvStatusPill(label, status);
    if (pill && typeof pill.setAttribute === 'function') {
      pill.setAttribute('id', 'oc-status-recebimento');
      pill.setAttribute('data-status-recebimento', status);
    }
    return pill;
  }

  // BACKLOG-7 PHASE 3 — o estado de recebimento DE CADA MATERIAL.
  //
  // O servidor projeta `status_recebimento` para a ORDEM inteira; nao existe
  // coluna equivalente por item, e este phase NAO acrescenta uma. Esta funcao
  // e PRESENTATION sobre numeros que o servidor ja derivou — le kg_recebido e
  // kg_restante exatamente como vieram de db/100 e nao recalcula nenhum deles.
  //
  // O vocabulario e o MESMO ja ruled para a ordem (RECEBIMENTO_LABEL acima),
  // deliberadamente: as tres chaves resolvem a familia pelo dono canonico
  // js/badges.js (§2.6) e nenhuma quarta familia e inventada aqui. O excedente
  // NAO ganha pill propria — a decisao aberta D5 (vocabulario de pill de estado
  // de excedente) nao foi decidida pelo arquiteto, entao o excedente real e
  // dito como QUANTIDADE explicita e rotulada no bloco do material, que e o
  // que §1 chama de bare signal sobre um numero.
  function estadoMaterial(it) {
    if (!(Number(it.kg_recebido) > 0)) return 'nao_recebido';
    if (Number(it.kg_restante) > 0) return 'parcial';
    return 'recebido';
  }

  function estadoMaterialPill(it) {
    var chave = estadoMaterial(it);
    var pill = window.rvStatusPill(RECEBIMENTO_LABEL[chave], chave);
    if (pill && typeof pill.setAttribute === 'function') {
      pill.setAttribute('data-estado-material', chave);
    }
    return pill;
  }

  // ator_tipo e um enum do banco ('admin' | 'fornecedor'). A linha de metadados
  // imprimia o valor cru — "Ator: admin" — que e vocabulario interno numa
  // superficie operacional.
  var ATOR_LABEL = { admin: 'Administrador', fornecedor: 'Fornecedor' };

  // BACKLOG-7 PHASE 2 — o nome real da cor, nunca a chave.
  //
  // `obter_historico_recebimento_ordem_compra` projeta apenas cor_id e
  // cor_poliester, entao um item de ALGODAO (que nao tem cor_poliester) caia no
  // ramo `'Cor ' + cor_id` e a superficie de recebimento imprimia
  // "Algodão · Cor 3". A tabela Itens LOGO ACIMA, na mesma tela, ja imprimia
  // "Algodão · CRU": `obter_ordem_compra_admin` faz LEFT JOIN public.cores e
  // projeta `cor_nome` (db/100), e ordem-compra-render.js::fioLabel ja o prefere.
  //
  // A mesma tela dizia a mesma cor de duas maneiras. A correcao NAO precisa de
  // migracao: os dois read models chaveiam pelo mesmo ordem_compra_item.id, e o
  // detalhe da ordem ja esta carregado em state.ordem quando esta secao
  // renderiza. Resolvemos por item_id e delegamos ao dono ja existente.
  //
  // Falha ABERTA, nunca dura: sem mapa, sem item correspondente ou sem
  // cor_nome, cai exatamente no rotulo anterior. E apresentacao — o mesmo
  // criterio de 9fa9437, que corrigiu este defeito na superficie irma.
  var itensDaOrdem = null;

  function itemDaOrdem(itemId) {
    if (!itensDaOrdem || itemId == null) return null;
    return itensDaOrdem[String(itemId)] || null;
  }

  function fioLabel(row) {
    var doPedido = itemDaOrdem(row.item_id);
    var mat = row.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = (doPedido && (doPedido.cor_nome || doPedido.cor_poliester))
      || row.cor_poliester
      || (row.cor_id != null ? ('Cor ' + row.cor_id) : '—');
    return mat + ' · ' + cor;
  }

  // ---- MATERIAIS -------------------------------------------------------
  //
  // Um material e um BLOCO, nao uma linha: a linha de tabela nao comporta a
  // identidade, o estado, quatro quantidades e os destinos sem espremer todos
  // eles, e era exatamente por isso que a informacao estava repartida por tres
  // tabelas. O bloco tambem e o que deixa o material ser a unidade primaria de
  // leitura em vez de mais uma celula.
  //
  // Nenhuma tabela e construida aqui, e nenhuma coluna de px fixo: a grelha de
  // metricas e `auto-fit` sobre uma largura minima, entao ela mesma reduz de
  // quatro colunas para duas no viewport estreito sem precisar de container de
  // rolagem proprio nem de qualquer regra em css/responsive.css.

  // PAIR_VALUE (§5) — o valor de um par rotulo/valor, que e exatamente o que
  // cada metrica e. As duas variantes sao declaradas por extenso: §2.1 proibe
  // derivar uma declaracao da outra por substituicao de texto, e o excedente
  // real toma o bare signal de §1 (a cor sobre o NUMERO carrega o significado)
  // sem nunca ser a unica portadora — o rotulo "Kg excedente" esta sempre la.
  function metricaNeutra(label, valor) {
    return el('div', { class: 'min-w-0' },
      el('div', {
        style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
      }, label),
      el('div', {
        style: 'font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-text-primary);'
          + 'font-variant-numeric:tabular-nums;',
      }, fmtKg(valor)));
  }
  function metricaExcedente(label, valor) {
    return el('div', { class: 'min-w-0' },
      el('div', {
        style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
      }, label),
      el('div', {
        style: 'font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-signal-caution);'
          + 'font-variant-numeric:tabular-nums;',
      }, fmtKg(valor)));
  }

  // Os destinos DEIXAM de ser uma terceira tabela de topo e passam a ser o
  // detalhe secundario do material a que pertencem (D1: a distribuicao continua
  // disponivel como divulgacao secundaria). Nenhuma quantidade se perde: os
  // tres valores que a tabela "Alocações" mostrava continuam todos aqui,
  // rotulados, na linha do seu proprio destino.
  function destinos(it) {
    var alocacoes = it.alocacoes || [];
    if (!alocacoes.length) return null;
    var wrap = el('div', {
      style: 'margin-top:12px;padding-top:10px;border-top:1px solid var(--rv-border-soft);',
    });
    wrap.appendChild(el('div', {
      style: 'font-size:var(--rv-fs-label);font-weight:700;text-transform:uppercase;'
        + 'letter-spacing:var(--rv-tracking-label);color:var(--rv-text-tertiary);margin-bottom:6px;',
    }, 'Destinos'));
    alocacoes.forEach(function (a) {
      wrap.appendChild(el('div', {
        'data-alocacao-id': String(a.alocacao_id),
        class: 'flex items-baseline justify-between gap-3 flex-wrap',
        style: 'padding:3px 0;',
      },
        el('span', {
          style: 'font-size:var(--rv-fs-sm);color:'
            + (a.op_id == null ? 'var(--rv-text-secondary)' : 'var(--rv-text-primary)') + ';',
        }, opLabel(a.op_id)),
        el('span', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);'
            + 'font-variant-numeric:tabular-nums;',
        }, 'Alocado ' + fmtKg(a.kg_alocado) + ' · Recebido ' + fmtKg(a.kg_recebido)
          + ' · Restante ' + fmtKg(a.kg_restante))));
    });
    return wrap;
  }

  function materialBlock(it, primeiro) {
    var bloco = el('div', {
      'data-item-id': String(it.item_id),
      class: 'px-5 py-4',
      style: primeiro ? '' : 'border-top:1px solid var(--rv-border-soft);',
    });

    // Identidade + estado: a primeira linha do bloco responde "que material e
    // este" e "em que pe esta", que sao as duas primeiras perguntas da tela.
    bloco.appendChild(el('div', { class: 'flex items-center justify-between gap-3 flex-wrap mb-3' },
      el('span', {
        class: 'min-w-0',
        style: 'font-size:var(--rv-fs-component-heading);font-weight:600;color:var(--rv-text-primary);',
      }, fioLabel(it)),
      estadoMaterialPill(it)));

    // As quatro quantidades, na ordem em que o operador as le: quanto pedi,
    // quanto chegou, quanto falta, quanto veio a mais.
    bloco.appendChild(el('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px 16px;',
    },
      metricaNeutra('Kg pedido', it.kg_pedido),
      metricaNeutra('Kg recebido', it.kg_recebido),
      metricaNeutra('Kg restante', it.kg_restante),
      Number(it.kg_excesso) > 0
        ? metricaExcedente('Kg excedente', it.kg_excesso)
        : metricaNeutra('Kg excedente', it.kg_excesso)));

    var dest = destinos(it);
    if (dest) bloco.appendChild(dest);
    return bloco;
  }

  function materiaisSection(itens) {
    var corpo;
    if (!itens.length) {
      corpo = el('div', {
        class: 'px-5 py-8 text-center',
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
      }, 'Nenhum material nesta ordem.');
    } else {
      corpo = el('div', { id: 'oc-materiais' });
      itens.forEach(function (it, i) { corpo.appendChild(materialBlock(it, i === 0)); });
    }
    return sectionCard('oc-recebimentos', [
      sectionHeader('Materiais', ICON_LAYERS, null),
      corpo,
    ]);
  }

  // ---- RAIL (§3A) ------------------------------------------------------
  //
  // O rail carrega o que e da ORDEM: o seu estado de recebimento, o agregado e
  // a unica acao de fluxo que existe de verdade. §3A e explicito — "summary,
  // metrics and the flow action in the rail" e "never repeat the same datum on
  // both sides": o agregado NAO e o mesmo dado que as parcelas por material, e
  // o estado da ordem NAO e o estado de um material.
  //
  // A REGRA DO RAIL e "tudo vertical e width:100%", e um grid de colunas fixas
  // dentro do rail e proibido (§6) — por isso cada metrica e uma linha
  // rotulo/valor, nunca uma grelha.

  // O somatorio e de APRESENTACAO. O read model db/100 nao projeta totais de
  // ordem, e este agregado nao decide nada: nenhuma acao, nenhuma habilitacao e
  // nenhuma persistencia depende dele. Ele soma exatamente os quatro campos que
  // o servidor ja derivou por item, e nao reconstroi nenhuma regra de
  // contabilidade de recebimento.
  function agregado(itens) {
    var t = { kg_pedido: 0, kg_recebido: 0, kg_restante: 0, kg_excesso: 0, pendentes: 0 };
    itens.forEach(function (it) {
      t.kg_pedido += Number(it.kg_pedido) || 0;
      t.kg_recebido += Number(it.kg_recebido) || 0;
      t.kg_restante += Number(it.kg_restante) || 0;
      t.kg_excesso += Number(it.kg_excesso) || 0;
      if (Number(it.kg_restante) > 0) t.pendentes += 1;
    });
    return t;
  }

  function railMetrica(label, valor, excedente) {
    return el('div', {
      class: 'flex items-baseline justify-between gap-3',
      style: 'width:100%;',
    },
      el('span', { style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);' }, label),
      excedente
        ? el('span', {
          style: 'font-size:var(--rv-fs-metric-rail);font-weight:600;color:var(--rv-signal-caution);'
            + 'font-variant-numeric:tabular-nums;',
        }, fmtKg(valor))
        : el('span', {
          style: 'font-size:var(--rv-fs-metric-rail);font-weight:600;color:var(--rv-text-primary);'
            + 'font-variant-numeric:tabular-nums;',
        }, fmtKg(valor)));
  }

  // A frase que responde "o que posso fazer agora" no unico escopo em que a
  // acao existe de verdade. O escritor nativo
  // (registrar_recebimento_ordem_compra) recebe p_ordem_id e p_linhas: nao
  // existe recebimento por material, e um botao por material seria uma
  // affordance fabricada para uma operacao que o servidor nao oferece.
  function railOrientacao(total, itens) {
    if (!itens.length) return 'Esta ordem não tem materiais.';
    if (total.pendentes === 0) return 'Todos os materiais foram recebidos por completo.';
    if (total.pendentes === 1) return 'Falta receber 1 material.';
    return 'Faltam receber ' + total.pendentes + ' materiais.';
  }

  function railCard(hist, itens, registrarBtn) {
    var total = agregado(itens);
    var corpo = el('div', {
      style: 'padding:var(--rv-pad-card-rail);display:flex;flex-direction:column;gap:8px;',
    },
      railMetrica('Kg pedido', total.kg_pedido, false),
      railMetrica('Kg recebido', total.kg_recebido, false),
      railMetrica('Kg restante', total.kg_restante, false),
      railMetrica('Kg excedente', total.kg_excesso, total.kg_excesso > 0));

    var rodape = el('div', {
      style: 'padding:var(--rv-pad-card-rail);border-top:1px solid var(--rv-border-soft);'
        + 'display:flex;flex-direction:column;gap:10px;',
    },
      el('div', {
        id: 'oc-rail-orientacao',
        style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);',
      }, railOrientacao(total, itens)));
    if (registrarBtn) rodape.appendChild(registrarBtn);

    return sectionCard('oc-recebimento-rail', [
      sectionHeader('Recebimento', ICON_INBOX, statusRecebimentoPill(hist.status_recebimento)),
      corpo,
      rodape,
    ]);
  }

  // §2.11/D12: isto e um AVISO AUTONOMO, e a regra e global — "every standalone
  // warning ... occupies the full width of its containing content region and
  // renders as a card surface ... background, border, icon and text from ONE
  // MATCHING SEMANTIC FAMILY". Antes era uma linha cinza inline em
  // --rv-text-secondary, indistinguivel de uma legenda.
  function bloqueioCard() {
    return el('div', {
      id: 'oc-recebimento-inativo',
      style: 'display:flex;align-items:flex-start;gap:8px;width:100%;box-sizing:border-box;'
        + 'padding:10px 14px;border-radius:var(--rv-radius);font-size:var(--rv-fs-body);'
        + 'background:var(--rv-signal-caution-bg);border:1px solid var(--rv-signal-caution-border);'
        + 'color:var(--rv-signal-caution);',
    },
    el('span', {
      style: 'display:inline-flex;flex:none;color:var(--rv-signal-caution);',
      'aria-hidden': 'true',
    }, svgIcon(ICON_ALERT)),
    el('span', {}, 'Registro de recebimento indisponível: a virada para o recebimento canônico ainda '
      + 'não foi ativada. A linha do tempo permanece somente leitura.'));
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

  // One reversal control per reversible receipt lançamento. Reversibility is
  // derived strictly from the server model (acoes.estornar AND
  // kg_reversivel > 0). The confirmDialog gate before execution is wired in
  // the events layer.
  //
  // AUSENTE, NÃO DESABILITADO. Antes o controle era sempre construído e só
  // ficava `disabled`, então um lançamento JÁ TOTALMENTE ESTORNADO continuava
  // anunciando a sua própria ação ao lado da linha que dizia que não havia
  // nada a estornar — a mesma tela afirmando duas coisas contrárias, e para
  // leitor de tela a ação simplesmente existia. Sem saldo reversível não há
  // ação. O estado "totalmente estornado" continua legível: ele é dito pela
  // própria narrativa da linha do tempo, não por um botão morto.
  //
  // ÍCONE + TEXTO — BACKLOG-7 PHASE 4.
  //
  // A isenção "ícone sozinho" do §2.9 é escrita para a ação de LINHA DE TABELA,
  // e depois desta fase não existe mais tabela nenhuma nesta superfície: a
  // linha do tempo é uma narrativa, e a linha de um material dentro de uma
  // entrada já carrega texto escrito. É exatamente a distinção que o arquiteto
  // ratificou em d331154 para o controle de metadados vizinho — naquela
  // posição a regra da casa é texto. Não reivindicamos uma isenção que deixou
  // de se aplicar; §2.1 pede "entity-level destructive: icon + text, always", e
  // ícone + texto é válido sob as duas leituras.
  //
  // A GEOMETRIA é a do seu irmão "Editar": 30px de altura, largura automática,
  // para que os dois controles de linha da mesma entrada leiam como par. A pele
  // é a Destructive do §2.1 — --rv-surface sobre --rv-signal-negative-border com
  // texto --rv-signal-negative — porque estornar remove quantidade recebida.
  //
  // O NOME ACESSÍVEL passa a ser de NEGÓCIO, não de banco: antes dizia
  // "Estornar recebimento do lançamento 54", que é a chave primária lida em voz
  // alta. Agora diz o material, a quantidade e a data — a mesma informação que o
  // operador vê, que é o que o critério 8 desta fase pede.
  function reversalButton(comando, lanc, acoes, handlers) {
    var reversible = comando.comando_tipo === 'recebimento'
      && acoes && acoes.estornar === true
      && Number(lanc.kg_reversivel) > 0;
    if (!reversible) return null;
    var descricao = 'Estornar ' + fmtKg(lanc.kg_reversivel) + ' de ' + fioLabel(lanc)
      + ' recebidos em ' + fmtDateTime(comando.ocorrido_em);
    var btn = el('button', {
      type: 'button',
      title: 'Estornar recebimento',
      'aria-label': descricao,
      style: 'height:30px;padding:0 10px;display:inline-flex;align-items:center;'
        + 'justify-content:center;gap:7px;flex:none;white-space:nowrap;'
        + 'border:1px solid var(--rv-signal-negative-border);border-radius:var(--rv-radius);'
        + 'background:var(--rv-surface);color:var(--rv-signal-negative);'
        + 'font-size:var(--rv-fs-body);font-weight:600;cursor:pointer;',
      onclick: function () { handlers.estornarLancamento(comando, lanc); },
    }, svgIcon(ICON_UNDO), el('span', {}, 'Estornar'));
    return btn;
  }

  // db/119: administrative correction of the four metadata fields of a
  // RECEIPT command. Availability is not recomputed here — `atorTipo` is the
  // server's own classification of the caller, carried by the read model
  // (obter_historico_recebimento_ordem_compra returns ator_tipo). A reversal
  // command carries no correctable metadata and gets no control, matching the
  // server, which refuses it with estado_invalido.
  //
  // ROTULO DE TEXTO, NAO ICONE — decisao do arquiteto sobre a tela publicada.
  //
  // Este controle NAO fica numa linha de tabela: fica na linha de METADADOS que
  // encabeca o bloco do comando, ao lado de Data / Por / Doc. / Origem. A isencao
  // de "icone sozinho" do §2.9 e escrita para a acao de LINHA DE TABELA; nesta
  // posicao a regra da casa e texto. O lapis de 14px ficava mudo ao lado de
  // quatro rotulos escritos, e o operador tinha de passar o mouse para saber o
  // que ele fazia.
  //
  // A ALTURA NAO CRESCE: 30px, exatamente a mesma geometria de acao de linha que
  // o controle de estorno vizinho declara (§2.9), entao o bloco do comando fica
  // com a altura que ja tinha. So a largura passa a ser automatica, com padding
  // horizontal, para caber a palavra. Mesmo skin do §2.9 — --rv-surface sobre
  // --rv-border-soft com texto --rv-text-secondary — para que os dois controles
  // da mesma familia continuem lendo como irmaos.
  //
  // NAO e danger: corrigir a referencia de um documento e uma edicao
  // administrativa ordinaria e nao pode tomar emprestada a affordance
  // destrutiva do controle de estorno.
  //
  // O rotulo visivel diz "Editar"; o NOME ACESSIVEL continua completo, porque
  // "Editar" sozinho nao diz o que esta a ser editado nem de quando.
  function editMetadataButton(comando, atorTipo, handlers) {
    var editable = comando.comando_tipo === 'recebimento' && atorTipo === 'admin';
    if (!editable) return null;
    var descricao = 'Editar dados do recebimento de ' + fmtDateTime(comando.ocorrido_em);
    var btn = el('button', {
      type: 'button',
      title: 'Editar dados do recebimento',
      'aria-label': descricao,
      style: 'height:30px;padding:0 10px;display:inline-flex;align-items:center;'
        + 'justify-content:center;flex:none;white-space:nowrap;'
        + 'border:1px solid var(--rv-border-soft);border-radius:var(--rv-radius);'
        + 'background:var(--rv-surface);color:var(--rv-text-secondary);'
        + 'font-size:var(--rv-fs-body);font-weight:600;cursor:pointer;'
        + 'transition:border-color .18s ease, color .18s ease;',
      onclick: function () { handlers.editarMetadadosRecebimento(comando); },
    }, 'Editar');
    // Um estilo em linha nao exprime pseudo-classe; o par imperativo e o mesmo
    // precedente ja aceito em js/ui.js::actionButton() e pageHeader().
    btn.addEventListener('mouseenter', function () {
      btn.style.borderColor = 'var(--rv-border-strong)';
      btn.style.color = 'var(--rv-text-primary)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.borderColor = 'var(--rv-border-soft)';
      btn.style.color = 'var(--rv-text-secondary)';
    });
    return btn;
  }

  // ---- LINHA DO TEMPO DE NEGÓCIO (BACKLOG-7 PHASE 4) -------------------
  //
  // O QUE ISTO SUBSTITUI. Até aqui a história do recebimento era uma TABELA DE
  // RAZÃO: um bloco por comando, e dentro dele seis colunas — Fio, Origem, Kg,
  // Kg excesso, Reversível e Ações. Para descobrir que 880,650 kg entraram e
  // depois saíram, o operador tinha de ler duas tabelas separadas, comparar
  // números sem sinal, notar que uma coluna chamada "Reversível" tinha caído a
  // zero e inferir a relação entre as duas. Duas das seis colunas eram
  // estruturalmente MORTAS numa linha de estorno: um estorno nunca é reversível
  // e nunca oferece ação, então "Reversível 0,000" e uma célula Ações vazia
  // eram ruído em todas as linhas de estorno que existem.
  //
  // Agora a mesma história é NARRATIVA: uma entrada por evento, em ordem
  // cronológica, dizendo o que aconteceu, a que material, quanto, em que
  // direção, quando e por quem.
  //
  // ORDEM. Ascendente — a ordem em que o servidor já devolve os comandos
  // (`ORDER BY h.criado_em, h.id` em db/100). A tela não reordena nada: ler no
  // sentido do tempo é o que faz "recebeu X → estornou Y" contar uma história,
  // e é a própria forma do exemplo conceitual da ordem desta fase.
  //
  // O QUE ISTO NÃO FAZ. Não há saldo corrente aqui. O cockpit de materiais da
  // fase 3 continua o dono único do ESTADO ATUAL; a linha do tempo explica
  // COMO se chegou lá. Por isso uma entrada só fala do seu próprio efeito
  // (quanto entrou, quanto disso já foi estornado) e nunca de um total da ordem.

  // Índice de lançamento -> { comando, lancamento }, para que um estorno possa
  // nomear em NEGÓCIO o recebimento que ele desfaz. O elo é `estorno_de_id`,
  // que o escritor db/70 grava e o read model db/100 projeta; sem ele um
  // estorno seria mesmo uma linha técnica solta.
  function indexarLancamentos(comandos) {
    var idx = {};
    comandos.forEach(function (c) {
      (c.lancamentos || []).forEach(function (l) {
        if (l && l.id != null) idx[String(l.id)] = { comando: c, lancamento: l };
      });
    });
    return idx;
  }

  // Um estorno grava kg_recebido NEGATIVO (`-v_line.kg` no escritor db/70), e um
  // recebimento grava positivo. O sinal é, portanto, do SERVIDOR: a tela lê a
  // direção, não a decide.
  function ehEntrada(lanc) { return Number(lanc.kg) >= 0; }

  // §5 permite `--rv-radius-pill` em geometria circular verdadeira, e nomeia o
  // ponto de linha do tempo entre os três casos. A cor é bare signal do §1 sobre
  // um indicador: entrada some, estorno subtrai. Nunca é a única portadora —
  // o rótulo do badge e o sinal do número dizem o mesmo em texto (§8).
  function timelineDot(entrada) {
    return el('span', {
      style: entrada
        ? 'width:9px;height:9px;border-radius:var(--rv-radius-pill);flex:none;margin-top:5px;background:var(--rv-signal-positive);'
        : 'width:9px;height:9px;border-radius:var(--rv-radius-pill);flex:none;margin-top:5px;background:var(--rv-signal-negative);',
    });
  }

  // A quantidade com o seu SINAL explícito. `fmtKg` é o dono compartilhado do
  // número; o sinal é acrescentado aqui porque é a direção do evento, não a
  // formatação da grandeza.
  function delta(lanc) {
    var v = Number(lanc.kg) || 0;
    var texto = (v >= 0 ? '+ ' : '− ') + fmtKg(Math.abs(v));
    return el('span', {
      style: v >= 0
        ? 'font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-signal-positive);font-variant-numeric:tabular-nums;white-space:nowrap;'
        : 'font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-signal-negative);font-variant-numeric:tabular-nums;white-space:nowrap;',
    }, texto);
  }

  function notaSecundaria(texto) {
    return el('div', {
      style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
    }, texto);
  }

  // Quanto de UM recebimento já foi desfeito. `kg_reversivel` é o saldo que o
  // servidor calcula (kg do recebimento + soma dos estornos, que são negativos),
  // então isto é leitura, nunca recontabilização.
  function estadoDaLinhaRecebida(lanc) {
    var recebido = Number(lanc.kg) || 0;
    var reversivel = Number(lanc.kg_reversivel) || 0;
    if (recebido <= 0) return null;
    if (reversivel <= 0) return 'Totalmente estornado — não contribui para o saldo atual.';
    if (reversivel < recebido) {
      return 'Parcialmente estornado — restam ' + fmtKg(reversivel) + ' em vigor.';
    }
    return null;
  }

  // A linha de UM material dentro de uma entrada. Responde, de uma vez: que
  // material, quanto, em que direção — e, quando for um estorno, a que
  // recebimento ele se refere.
  function linhaMaterial(comando, lanc, indice, acoes, handlers) {
    var entrada = ehEntrada(lanc);
    var esquerda = el('div', { class: 'min-w-0' },
      el('div', {
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-weight:600;',
      }, fioLabel(lanc)));

    if (entrada) {
      if (Number(lanc.kg_excesso) > 0) {
        esquerda.appendChild(el('div', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-signal-caution);',
        }, 'Inclui ' + fmtKg(lanc.kg_excesso) + ' de excedente.'));
      }
      var estado = estadoDaLinhaRecebida(lanc);
      if (estado) esquerda.appendChild(notaSecundaria(estado));
    } else {
      // CRITÉRIO 6: o estorno tem de LER como relacionado ao recebimento que
      // afeta. `estorno_de_id` resolve o lançamento de origem e, através dele, a
      // DATA do recebimento — que é como o operador identifica um recebimento,
      // não pelo id.
      var origem = indice[String(lanc.estorno_de_id)];
      esquerda.appendChild(notaSecundaria(origem
        ? ('Estorna o recebimento de ' + fmtDateTime(origem.comando.ocorrido_em) + '.')
        : 'Estorna um recebimento anterior desta ordem.'));
      if (Number(lanc.kg_excesso) < 0) {
        esquerda.appendChild(notaSecundaria('Devolve ' + fmtKg(Math.abs(Number(lanc.kg_excesso)))
          + ' que tinham entrado como excedente.'));
      }
    }

    // O destino produtivo continua legível, mas como detalhe: é proveniência,
    // e o critério 8 pede que proveniência não domine a narrativa.
    if (lanc.op_id != null || lanc.alocacao_id != null) {
      esquerda.appendChild(notaSecundaria('Destino: ' + opLabel(lanc.op_id)));
    }

    var direita = el('div', { class: 'flex items-center gap-3' },
      delta(lanc));
    var acao = reversalButton(comando, lanc, acoes, handlers);
    if (acao) direita.appendChild(acao);

    // A linha QUEBRA em vez de espremer. Medido a 390px: com o bloco de
    // identidade em `flex-none`, a quantidade e o controlo de estorno ficavam
    // com largura fixa e sobrava ~55px para o texto da esquerda, o que punha
    // "Destino: OP-T001-1-26" em cinco linhas. Com `flex-wrap` e uma base de
    // 190px, abaixo dessa largura a quantidade desce para a sua propria linha e
    // os dois blocos ficam legiveis. Nenhum container de rolagem e necessario e
    // css/responsive.css continua intocado.
    return el('div', {
      'data-lancamento-id': String(lanc.id),
      class: 'flex items-start justify-between gap-3 flex-wrap',
      style: 'padding:7px 0;',
    },
    el('div', { class: 'min-w-0', style: 'flex:1 1 190px;' }, esquerda),
    el('div', { class: 'flex-none' }, direita));
  }

  // A frase de topo da entrada: o que aconteceu, em quanto, e em quantos
  // materiais — para que a entrada se entenda antes de se ler linha a linha.
  function resumoEntrada(comando) {
    var lancs = comando.lancamentos || [];
    var total = 0;
    var materiais = {};
    lancs.forEach(function (l) {
      total += Math.abs(Number(l.kg) || 0);
      if (l.item_id != null) materiais[String(l.item_id)] = true;
    });
    var n = Object.keys(materiais).length;
    var sufixo = n === 1 ? ' em 1 material' : (' em ' + n + ' materiais');
    return (comando.comando_tipo === 'estorno' ? 'Saíram ' : 'Entraram ')
      + fmtKg(total) + sufixo;
  }

  function entradaTimeline(comando, indice, acoes, handlers, atorTipo, ultimo) {
    var estorno = comando.comando_tipo === 'estorno';

    var cabecalho = el('div', { class: 'flex items-center justify-between gap-3 flex-wrap' },
      el('div', { class: 'flex items-center gap-2 min-w-0' },
        tipoBadge(comando.comando_tipo),
        el('span', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;',
        }, fmtDateTime(comando.ocorrido_em))),
      // db/119: a correção administrativa continua a pertencer à entrada cujos
      // metadados ela edita.
      editMetadataButton(comando, atorTipo, handlers) || el('span', {}));

    var conteudo = el('div', { class: 'min-w-0', style: 'flex:1 1 auto;' }, cabecalho);

    conteudo.appendChild(el('div', {
      style: 'margin-top:2px;font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-text-primary);',
    }, resumoEntrada(comando)));

    conteudo.appendChild(el('div', {
      style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);',
    }, 'por ' + (ATOR_LABEL[comando.ator_tipo] || comando.ator_tipo || '—')));

    // BACKLOG-7 PHASE 2 (preservado) — o MOTIVO do estorno deixa de vir
    // disfarçado. `_c3c_estornar_recebimento_impl` (db/70) grava o motivo
    // obrigatório no cabeçalho como origem_tipo='estorno_admin' +
    // origem_ref=motivo. A tela imprimia "Origem: estorno_admin / lancamento em
    // duplicidade": a resposta para "por que isto foi estornado" já estava lá,
    // escrita como um par técnico.
    if (estorno && comando.origem_tipo === 'estorno_admin' && comando.origem_ref) {
      conteudo.appendChild(el('div', {
        style: 'margin-top:6px;font-size:var(--rv-fs-body);color:var(--rv-text-primary);',
      }, 'Motivo: ' + comando.origem_ref));
    }

    var linhas = el('div', { style: 'margin-top:8px;' });
    (comando.lancamentos || []).forEach(function (l) {
      linhas.appendChild(linhaMaterial(comando, l, indice, acoes, handlers));
    });
    conteudo.appendChild(linhas);

    // CRITÉRIO 8: documento e origem são AUDITORIA, não narrativa. Descem para
    // uma linha secundária no pé da entrada, em tipo menor e cor terciária.
    // `origem_tipo` é texto livre escrito pelo operador (db/70 aceita 1..80
    // caracteres, e a tela de registro oferece "Sem nota" por omissão), portanto
    // é mostrado VERBATIM — traduzi-lo por um mapa local inventaria vocabulário
    // que esta tela não possui e corromperia o que o operador escreveu.
    if (!estorno) {
      var auditoria = [];
      if (comando.documento_ref) auditoria.push('Documento ' + comando.documento_ref);
      if (comando.origem_tipo) auditoria.push('Origem ' + comando.origem_tipo);
      if (comando.origem_ref) auditoria.push('Ref. ' + comando.origem_ref);
      if (auditoria.length) {
        conteudo.appendChild(el('div', {
          style: 'margin-top:8px;padding-top:7px;border-top:1px solid var(--rv-border-soft);'
            + 'font-size:var(--rv-fs-sm);color:var(--rv-text-tertiary);',
        }, auditoria.join(' · ')));
      }
    }

    // O trilho: ponto + fio vertical até a entrada seguinte. O fio é o que faz
    // as entradas lerem como UMA sequência em vez de cartões soltos.
    var trilho = el('div', {
      class: 'flex flex-col items-center flex-none',
      style: 'width:9px;align-self:stretch;',
    }, timelineDot(!estorno));
    if (!ultimo) {
      trilho.appendChild(el('div', {
        style: 'width:1px;flex:1 1 auto;margin-top:4px;background:var(--rv-border);',
      }));
    }

    return el('div', {
      'data-comando-id': String(comando.id),
      'data-evento-tipo': comando.comando_tipo,
      class: 'flex gap-3 px-5',
      style: ultimo ? 'padding-top:14px;padding-bottom:16px;' : 'padding-top:14px;',
    }, trilho, conteudo);
  }

  // ---- CORREÇÃO ADMINISTRATIVA (BACKLOG-7 PHASE 4 COMPLETION, db/122) ----
  //
  // A TERCEIRA família. db/119 sempre gravou cada correção administrativa de
  // metadados de recebimento, com a imagem completa antes/depois — mas a sua
  // tabela está revogada de todos os papéis e nenhum read model a projectava,
  // por isso uma correção podia existir no sistema e ser INVISÍVEL no produto.
  // db/122 fecha isso projectando-a através da própria função SECURITY DEFINER
  // que já decide quem pode ler aquela ordem, sem conceder privilégio nenhum
  // sobre a tabela.
  //
  // Os quatro campos corrigíveis são ditos pelo seu NOME DE NEGÓCIO, nunca pelo
  // nome da coluna: o operador corrige "a data do recebimento", não
  // `ocorrido_em`.
  var CORRECAO_CAMPOS = [
    { antes: 'ocorrido_em_antes', depois: 'ocorrido_em_depois', rotulo: 'Data do recebimento', data: true },
    { antes: 'documento_ref_antes', depois: 'documento_ref_depois', rotulo: 'Documento', data: false },
    { antes: 'origem_tipo_antes', depois: 'origem_tipo_depois', rotulo: 'Tipo de origem', data: false },
    { antes: 'origem_ref_antes', depois: 'origem_ref_depois', rotulo: 'Referência da origem', data: false },
  ];

  function valorCorrecao(v, ehData) {
    if (v == null || v === '') return '—';
    return ehData ? fmtDateTime(v) : String(v);
  }

  // SÓ o que realmente mudou. O escritor db/119 grava a imagem dos QUATRO
  // campos em toda correção, mesmo os que ficaram iguais; listar os quatro
  // faria o operador procurar a alteração no meio de três não-alterações.
  function camposAlterados(correcao) {
    var mudou = [];
    CORRECAO_CAMPOS.forEach(function (campo) {
      var antes = valorCorrecao(correcao[campo.antes], campo.data);
      var depois = valorCorrecao(correcao[campo.depois], campo.data);
      if (antes !== depois) mudou.push({ rotulo: campo.rotulo, antes: antes, depois: depois });
    });
    return mudou;
  }

  // Um ponto NEUTRO: uma correção administrativa não soma nem subtrai
  // quantidade recebida — não move a contabilidade de todo. Pintá-la de
  // positivo ou negativo diria uma direção que ela não tem. A família é
  // carregada pelo rótulo, como §2.6 exige de um estado não-ruled.
  function timelineDotNeutro() {
    return el('span', {
      style: 'width:9px;height:9px;border-radius:var(--rv-radius-pill);flex:none;margin-top:5px;background:var(--rv-text-tertiary);',
    });
  }

  function entradaCorrecao(correcao, comandoCorrigido, ultimo) {
    var conteudo = el('div', { class: 'min-w-0', style: 'flex:1 1 auto;' },
      el('div', { class: 'flex items-center gap-2 flex-wrap' },
        window.rvStatusPill('Correção administrativa', 'correcao_administrativa'),
        el('span', {
          style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;',
        }, fmtDateTime(correcao.corrigido_em))));

    // O CONTEXTO: qual recebimento foi corrigido. Identificado pela sua data
    // ATUAL — a que a própria correção deixou —, que é como o operador o
    // reconhece, e nunca pelo recebimento_id.
    conteudo.appendChild(el('div', {
      style: 'margin-top:2px;font-size:var(--rv-fs-value);font-weight:600;color:var(--rv-text-primary);',
    }, comandoCorrigido
      ? ('Dados do recebimento de ' + fmtDateTime(comandoCorrigido.ocorrido_em) + ' foram corrigidos')
      : 'Dados de um recebimento desta ordem foram corrigidos'));

    conteudo.appendChild(el('div', {
      style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);',
    }, 'por ' + (ATOR_LABEL[correcao.ator_tipo] || correcao.ator_tipo || '—')));

    // Os materiais daquele recebimento, para que o contexto material fique
    // explícito sem repetir as quantidades, que são do cockpit da fase 3.
    if (comandoCorrigido && (comandoCorrigido.lancamentos || []).length) {
      var materiais = [];
      comandoCorrigido.lancamentos.forEach(function (l) {
        var nome = fioLabel(l);
        if (materiais.indexOf(nome) < 0) materiais.push(nome);
      });
      conteudo.appendChild(notaSecundaria('Materiais do recebimento: ' + materiais.join(' · ')));
    }

    var mudou = camposAlterados(correcao);
    var lista = el('div', { style: 'margin-top:8px;' });
    if (!mudou.length) {
      // Honesto: o servidor registou a correção, mas nenhum dos quatro campos
      // ficou diferente. Inventar uma alteração seria pior do que dizê-lo.
      lista.appendChild(notaSecundaria('Nenhum dos dados do recebimento ficou diferente.'));
    } else {
      mudou.forEach(function (m) {
        lista.appendChild(el('div', {
          class: 'flex items-baseline justify-between gap-3 flex-wrap',
          style: 'padding:4px 0;',
        },
          el('span', {
            style: 'font-size:var(--rv-fs-body);color:var(--rv-text-primary);font-weight:600;',
          }, m.rotulo),
          el('span', {
            class: 'min-w-0',
            style: 'font-size:var(--rv-fs-sm);color:var(--rv-text-secondary);font-variant-numeric:tabular-nums;',
          }, m.antes + '  →  ' + m.depois)));
      });
    }
    conteudo.appendChild(lista);

    var trilho = el('div', {
      class: 'flex flex-col items-center flex-none',
      style: 'width:9px;align-self:stretch;',
    }, timelineDotNeutro());
    if (!ultimo) {
      trilho.appendChild(el('div', {
        style: 'width:1px;flex:1 1 auto;margin-top:4px;background:var(--rv-border);',
      }));
    }

    return el('div', {
      'data-correcao-id': String(correcao.id),
      'data-evento-tipo': 'correcao_administrativa',
      class: 'flex gap-3 px-5',
      style: ultimo ? 'padding-top:14px;padding-bottom:16px;' : 'padding-top:14px;',
    }, trilho, conteudo);
  }

  // A intercalação dos dois fluxos. O relógio é o de REGISTO — `criado_em` de um
  // comando (db/122) e `corrigido_em` de uma correção — porque `ocorrido_em` é a
  // data de NEGÓCIO e é justamente o que uma correção pode mover: ordenar por
  // ela faria a narrativa saltar para trás depois de uma correção de data.
  //
  // SEM CORREÇÕES, NADA É REORDENADO. Enquanto db/122 não estiver aplicado, o
  // read model não devolve `correcoes` nem `criado_em`, e este ramo devolve os
  // comandos exactamente na ordem em que o servidor os deu — o comportamento da
  // fase 4 fica byte a byte o que era. A superfície degrada ABERTA, nunca dura.
  function ordenarEventos(comandos, correcoes) {
    var eventos = comandos.map(function (c) {
      return { tipo: 'comando', comando: c };
    });
    if (!correcoes.length) return eventos;
    eventos.forEach(function (e, i) {
      e.relogio = e.comando.criado_em || e.comando.ocorrido_em || '';
      e.ordem = i;
    });
    correcoes.forEach(function (k, i) {
      eventos.push({
        tipo: 'correcao', correcao: k,
        relogio: k.corrigido_em || '', ordem: comandos.length + i,
      });
    });
    eventos.sort(function (a, b) {
      if (a.relogio === b.relogio) return a.ordem - b.ordem;
      return a.relogio < b.relogio ? -1 : 1;
    });
    return eventos;
  }

  function timeline(comandos, correcoes, acoes, handlers, atorTipo) {
    if (!comandos.length && !correcoes.length) {
      return el('div', {
        id: 'oc-recebimentos-historico', class: 'px-5 py-8 text-center',
        style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);',
      }, 'Nenhum recebimento registrado ainda.');
    }
    var indice = indexarLancamentos(comandos);
    var porRecebimento = {};
    comandos.forEach(function (c) { porRecebimento[String(c.id)] = c; });
    var eventos = ordenarEventos(comandos, correcoes);
    var wrap = el('div', { id: 'oc-recebimentos-historico' });
    eventos.forEach(function (e, i) {
      var ultimo = i === eventos.length - 1;
      wrap.appendChild(e.tipo === 'correcao'
        ? entradaCorrecao(e.correcao, porRecebimento[String(e.correcao.recebimento_id)], ultimo)
        : entradaTimeline(e.comando, indice, acoes, handlers, atorTipo, ultimo));
    });
    return wrap;
  }

  // renderReceiptSection(state, handlers) → DOM node, or null when no surface
  // must exist (non-native order, or native draft — contract §7 matrix).
  ns.renderReceiptSection = function (state, handlers) {
    // Ponto de entrada unico desta superficie: sincroniza os dois mapas de
    // resolucao — identidade canonica de OP e o item da ordem, que carrega o
    // nome real da cor (cor_nome) que o read model de recebimento nao projeta.
    opIdentidades = (state && state.opIdentidades) || null;
    itensDaOrdem = null;
    var itensDetalhe = (state && state.ordem && state.ordem.itens) || null;
    if (itensDetalhe && itensDetalhe.length) {
      itensDaOrdem = {};
      itensDetalhe.forEach(function (it) {
        if (it && it.item_id != null) itensDaOrdem[String(it.item_id)] = it;
      });
    }
    var o = state && state.ordem;
    if (!o || o.modelo !== 'nativo') return null;
    if (o.status_administrativo === 'rascunho') return null;

    var hist = state.receiptHistory;

    // Loading / error are honest, distinct states (§15). They are a single
    // card, not a cockpit: there is nothing yet to summarise in a rail, and a
    // rail of empty metrics beside a "loading" message would be an invented
    // aggregate.
    if (!hist || hist.loading) {
      return sectionCard('oc-recebimentos', [
        sectionHeader('Materiais', ICON_LAYERS, null),
        el('div', { class: 'px-5 py-8 text-center', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' }, 'Carregando recebimentos…'),
      ]);
    }
    if (hist.ok !== true) {
      return sectionCard('oc-recebimentos', [
        sectionHeader('Materiais', ICON_LAYERS, null),
        el('div', { id: 'oc-recebimentos-erro', class: 'px-5 py-8 text-center', style: 'font-size:var(--rv-fs-body);color:var(--rv-text-secondary);' },
          'Não foi possível carregar os recebimentos.'),
      ]);
    }

    var acoes = hist.acoes || {};
    var registrarBtn = null;
    if (acoes.receber === true) {
      // §2.1 Primary: --rv-brand fill, --rv-text-on-brand foreground, no border,
      // and a declared height from the closed 3-rung ladder. `width:100%` is
      // §2.1's FIRST declared exception — "in the rail every control is
      // width:100%" — not a liberty taken here.
      registrarBtn = el('button', {
        id: 'oc-registrar-recebimento',
        class: 'font-semibold px-3 hover:opacity-90',
        style: 'background:var(--rv-brand);color:var(--rv-text-on-brand);border:none;'
          + 'height:var(--rv-h-primary);padding-top:0;padding-bottom:0;width:100%;'
          + 'display:inline-flex;align-items:center;justify-content:center;cursor:pointer;'
          + 'font-size:var(--rv-fs-body);border-radius:var(--rv-radius);',
        onclick: function () { handlers.abrirRegistroRecebimento(); },
      }, 'Registrar recebimento');
    }

    var itens = hist.itens || [];

    // ---- LEFT: the material-centric reading, then the history ------------
    var esquerda = el('div', {
      style: 'min-width:0;display:flex;flex-direction:column;gap:var(--rv-gap-stack);',
    },
      materiaisSection(itens),
      sectionCard('oc-recebimentos-historico-card', [
        sectionHeader('Linha do tempo', ICON_CLOCK, null),
        timeline(hist.comandos || [], hist.correcoes || [], acoes, handlers, hist.ator_tipo),
      ]));

    // ---- RIGHT: the rail (§3A) -------------------------------------------
    var railKids = [railCard(hist, itens, registrarBtn)];
    // PURCHASE-ORDER-POST-GENERATION-STABILIZATION-R1. O recebimento canônico
    // só existe depois do cutover (ordem_compra_cutover = canonical_active /
    // canonical). Enquanto ele não vale, o escritor recusa com
    // `recebimento_canonico_inativo` — e, antes de db/100, o read model ainda
    // oferecia a ação: o operador preenchia o formulário inteiro e só então
    // descobria a recusa.
    //
    // O bloqueador é SERVIDOR (`hist.bloqueio_recebimento`). Esta tela apenas
    // o repete; nunca reconstrói o estado do cutover em JavaScript, e não
    // existe nenhum caminho aqui que leia ordem_compra_cutover. Ele vive no
    // rail porque é exatamente "o que o operador precisa entender antes de
    // agir", ao lado da ação que ele bloqueia.
    if (hist.bloqueio_recebimento === 'recebimento_canonico_inativo') {
      railKids.push(bloqueioCard());
    }
    var direita = el('div', {
      'data-rv-rail': '',
      style: 'min-width:0;position:sticky;top:0;display:flex;flex-direction:column;gap:var(--rv-gap-stack);',
    }, railKids);

    // A grade do arquetipo A. css/responsive.css é o dono único do breakpoint:
    // abaixo dele `[data-rv-cockpit]` vira uma coluna e `[data-rv-rail]` perde
    // o sticky, por atributo, sem uma linha de folha de estilo nova.
    return el('div', {
      'data-rv-cockpit': '',
      style: 'display:grid;grid-template-columns:minmax(0,1fr) var(--rv-rail-w);'
        + 'gap:var(--rv-gap-cols);align-items:start;',
    }, esquerda, direita);
  };
})(window);
