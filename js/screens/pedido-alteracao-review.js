// =====================================================================
// === SCREENS: PEDIDO ALTERACAO REVIEW ================================
// Tela administrativa DEDICADA de comparacao e decisao de uma solicitacao
// de alteracao de Pedido — Fase 5 da sequencia unificada.
// Rota: `#/pedidos/<pedido-uuid>/alteracoes/<request-uuid>` (js/router.js).
//
// Fase: PEDIDO-ADMIN-CHANGE-REQUEST-COMPARISON-APPROVAL-R1.
// Contrato: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md :: U10.4.
//
// POR QUE UMA TELA INTEIRA, E NAO UM MODAL
//   Uma solicitacao de alteracao e uma ENTIDADE COMPLETA (U10.4): a
//   comparacao antes/atual/proposto, a colecao de itens e a prioridade nao
//   cabem — nem podem — dentro de um modal de transicao. O modal aqui e usado
//   EXCLUSIVAMENTE para a confirmacao final de aprovar e de rejeitar, e a
//   comparacao inteira permanece na pagina, atras dele.
//
// DONO UNICO DA LEITURA DE COMPARACAO
//   public.admin_alteracao_comparacao(p_solicitacao_id) (db/92) e a fonte
//   EXCLUSIVA e COMPLETA: `solicitacao`, `antes`, `atual`, `proposto_header`,
//   `proposto_itens` e `impacto`. Esta tela NUNCA consulta
//   pedido_alteracao_solicitacao_itens separadamente, NUNCA chama um helper
//   owner-only (pedido_snapshot, pedido_tem_op_relacionada,
//   pedido_itens_payload_e_estrutural, ...) e NUNCA normaliza o payload da RPC.
//
// DONO UNICO DA ESCRITA
//   Aprovar  -> public.aprovar_alteracao_pedido(p_solicitacao_id,
//               p_confirmar_impacto, p_motivo)
//   Rejeitar -> public.rejeitar_alteracao_pedido(p_solicitacao_id, p_motivo)
//   Nenhum INSERT/UPDATE/DELETE direto em pedidos, pedido_itens,
//   pedido_alteracao_solicitacoes, pedido_alteracao_solicitacao_itens,
//   prioridade ou tabelas de evento. O render inicial escreve ZERO.
//
// O QUE ESTA TELA NAO DECIDE
//   Ela CONSOME `impacto` e `solicitacao`, e nao os reinterpreta. Base
//   desatualizada e vinculo de producao sao estados devolvidos pelo servidor;
//   a elegibilidade final da aprovacao e sempre da RPC. As diferencas que a
//   tela calcula sao de APRESENTACAO (o que mudou, para o revisor ver), nunca
//   regra de negocio nem decisao de aplicabilidade.
//
// IDENTIDADE DO SOLICITANTE
//   O payload devolve `solicitante_papel` (sanitizado) e `solicitante_id`.
//   NAO existe hoje um resolvedor de identidade administrativo reaproveitavel
//   que traduza um id de auth.users em nome legivel, e esta ordem proibe criar
//   um novo dono de dado ou qualquer leitura privilegiada. A tela exibe,
//   portanto, o PAPEL sanitizado mais um identificador administrativo
//   abreviado — exatamente a alternativa prevista pela ordem.
//
// Carregar via <script src="js/screens/pedido-alteracao-review.js?v=...">
// no <head>, DEPOIS de js/ui.js, js/pedido-ui.js, js/pedido-priority.js e
// js/pedido-fields.js, e ANTES do <script> principal (boot.js).
// =====================================================================

(function (window) {
  'use strict';

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var STATUS_PENDENTE = 'pendente';
  var DECIDED_STATUSES = ['aprovada', 'rejeitada', 'retirada', 'substituida', 'falha_aplicacao'];

  var STATUS_LABELS = {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    rejeitada: 'Rejeitada',
    retirada: 'Retirada',
    substituida: 'Substituida',
    falha_aplicacao: 'Falha ao aplicar',
  };

  var PAPEL_LABELS = { cliente: 'Cliente', admin: 'Administrador' };

  // Os QUATRO campos de cabecalho que uma solicitacao de Cliente pode propor
  // (db/92 :: campos_alterados + a recomposicao de `proposto_header`). A tela
  // nao infere nem exibe campo proibido ao Cliente.
  var HEADER_FIELDS = [
    { key: 'prazo_entrega', label: 'Prazo de entrega', kind: 'date' },
    { key: 'referencia_cliente', label: 'Referencia do cliente', kind: 'text' },
    { key: 'tipo_recebimento', label: 'Tipo de recebimento', kind: 'recebimento' },
    { key: 'observacao', label: 'Observacoes gerais', kind: 'multiline' },
  ];

  // Marcadores de APRESENTACAO da colecao de itens. Uma linha pode carregar
  // mais de um (por exemplo Alterado + Reordenado).
  var MARK_INSERIDO = 'Inserido';
  var MARK_REMOVIDO = 'Removido';
  var MARK_ALTERADO = 'Alterado';
  var MARK_REORDENADO = 'Reordenado';
  var MARK_SEM_ALTERACAO = 'Sem alteracao';

  var ERR = {
    STALE: 'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA',
    ESTRUTURA_OP: 'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP',
    ITEM_OP: 'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP',
    PRIORITY_IMPACT: 'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED',
    FALHA: 'PEDIDO_ALTERACAO_FALHA_APLICACAO',
    JA_DECIDIDA: 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA',
    NOT_FOUND: 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND',
    PEDIDO_NOT_FOUND: 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND',
    FORBIDDEN: 'PEDIDO_ALTERACAO_FORBIDDEN',
    TERMINAL: 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL',
    MOTIVO: 'PEDIDO_ALTERACAO_MOTIVO_OBRIGATORIO',
  };

  function PRIORITY() { return window.RAVATEX_PEDIDO_PRIORITY; }
  function FIELDS() { return window.RAVATEX_PEDIDO_FIELDS; }

  function svgEl(markup) {
    var tmp = window.document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }
  var SVG_BACK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

  // ------------------------------------------------------------------
  // 1. Formatacao de valor (apresentacao apenas)
  // ------------------------------------------------------------------
  var VAZIO = '(vazio)';
  var SEM_PROPOSTA = 'Sem alteracao proposta';

  function fmtDataHora(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('pt-BR') + ' as '
        + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return String(iso);
    }
  }

  function fmtMetros(value) {
    if (value == null || value === '') return '—';
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function fmtLargura(value) {
    if (value == null || value === '') return '—';
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function recebimentoLabel(value) {
    if (value == null || value === '') return VAZIO;
    var options = (FIELDS() && FIELDS().TIPO_RECEBIMENTO_OPTIONS) || [];
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === value) return options[i].label;
    }
    return String(value);
  }

  // Um valor NULO de verdade e distinguivel de "nao proposto": este formatador
  // devolve `(vazio)` para NULL/'' e o chamador decide separadamente se ha
  // proposta. Nunca colapsa os dois casos.
  function fmtFieldValue(kind, value) {
    if (value == null || value === '') return VAZIO;
    if (kind === 'date') return window.fmtDataCurta ? window.fmtDataCurta(value) : String(value);
    if (kind === 'recebimento') return recebimentoLabel(value);
    return String(value);
  }

  function sameValue(a, b) {
    var na = (a == null || a === '') ? null : String(a);
    var nb = (b == null || b === '') ? null : String(b);
    return na === nb;
  }

  // ------------------------------------------------------------------
  // 2. Normalizacao defensiva do payload
  // ------------------------------------------------------------------
  // Objetos de topo AUSENTES ou malformados fazem a tela FALHAR FECHADA: nao
  // existe comparacao parcial silenciosa. `proposto_itens` tem de ser array.
  function normalizeComparison(raw) {
    var payload = raw;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { return null; }
    }
    if (Array.isArray(payload)) payload = payload[0] || null;
    if (!payload || typeof payload !== 'object') return null;
    if (payload.ok === false) return { refused: String(payload.erro || 'PEDIDO_ALTERACAO_FORBIDDEN') };

    function obj(value) { return (value && typeof value === 'object' && !Array.isArray(value)) ? value : null; }
    var solicitacao = obj(payload.solicitacao);
    var antes = obj(payload.antes);
    var atual = obj(payload.atual);
    var propostoHeader = obj(payload.proposto_header);
    var impacto = obj(payload.impacto);
    var propostoItens = Array.isArray(payload.proposto_itens) ? payload.proposto_itens : null;

    if (!solicitacao || !antes || !atual || !propostoHeader || !impacto || !propostoItens) return null;
    if (!solicitacao.id || !solicitacao.pedido_id || !solicitacao.status) return null;

    return {
      solicitacao: solicitacao,
      antes: antes,
      atual: atual,
      propostoHeader: propostoHeader,
      propostoItens: propostoItens,
      impacto: impacto,
      camposAlterados: Array.isArray(solicitacao.campos_alterados) ? solicitacao.campos_alterados : [],
    };
  }

  function itensOf(snapshot) {
    var itens = snapshot && Array.isArray(snapshot.itens) ? snapshot.itens : [];
    return itens.slice().sort(function (a, b) {
      var ao = Number(a && a.ordem);
      var bo = Number(b && b.ordem);
      if (!Number.isFinite(ao)) ao = Number.MAX_SAFE_INTEGER;
      if (!Number.isFinite(bo)) bo = Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a && a.pedido_item_id).localeCompare(String(b && b.pedido_item_id));
    });
  }

  function byItemId(rows) {
    var map = {};
    (rows || []).forEach(function (row, index) {
      if (row && row.pedido_item_id != null) map[String(row.pedido_item_id)] = { row: row, position: index };
    });
    return map;
  }

  function corOf(row) {
    if (!row) return null;
    if (row.cores) return String(row.cores);
    var c1 = row.cor_1_nome || (row.cor_1 && row.cor_1.nome) || null;
    var c2 = row.cor_2_nome || (row.cor_2 && row.cor_2.nome) || null;
    if (!c1 && !c2) return null;
    return c2 ? c1 + '/' + c2 : c1;
  }

  // ------------------------------------------------------------------
  // 3. Diferenca de APRESENTACAO da colecao de itens
  // ------------------------------------------------------------------
  // `pedido_item_id` e o dono estavel da correspondencia. A POSICAO comparada e
  // o indice dentro da colecao ordenada, e nao o valor bruto de `ordem`: o
  // Cliente submete `ordem` 0-based e a colecao viva pode ter lacunas, entao
  // comparar valores brutos produziria "Reordenado" falso. O que o revisor
  // precisa ver e a posicao percebida.
  //
  // Isto NAO e uma regra de aprovacao: e o que mudou, para leitura humana.
  function buildItemDiff(cmp) {
    var base = itensOf(cmp.antes);
    var current = itensOf(cmp.atual);
    var proposed = cmp.solicitacao.itens_propostos === true
      ? cmp.propostoItens.slice().sort(function (a, b) { return Number(a.ordem) - Number(b.ordem); })
      : null;

    var baseMap = byItemId(base);
    var currentMap = byItemId(current);
    var rows = [];

    if (proposed === null) {
      // Nenhuma colecao proposta: a tela mostra a colecao VIVA como contexto,
      // sem inventar proposta alguma.
      current.forEach(function (row, index) {
        var b = baseMap[String(row.pedido_item_id)] || null;
        rows.push({
          marks: [MARK_SEM_ALTERACAO],
          proposedProvided: false,
          base: b ? b.row : null,
          basePosition: b ? b.position : null,
          current: row,
          currentPosition: index,
          proposed: null,
          proposedPosition: null,
          staleCurrent: b ? !sameItemValues(b.row, row) : true,
        });
      });
      return { rows: rows, hasProposal: false, base: base, current: current, proposed: null };
    }

    proposed.forEach(function (row, index) {
      var key = row.pedido_item_id != null ? String(row.pedido_item_id) : null;
      var b = key ? (baseMap[key] || null) : null;
      var c = key ? (currentMap[key] || null) : null;
      var marks = [];

      if (key === null) {
        marks.push(MARK_INSERIDO);
      } else {
        if (!b) {
          // `pedido_item_id` presente que nao existe na imagem-anterior: o
          // revisor precisa ver a linha, e ela nao e uma insercao nem uma
          // alteracao provada. Marcada como inserida em relacao a base.
          marks.push(MARK_INSERIDO);
        } else {
          if (!sameItemValues(b.row, row)) marks.push(MARK_ALTERADO);
          if (b.position !== index) marks.push(MARK_REORDENADO);
        }
      }
      if (!marks.length) marks.push(MARK_SEM_ALTERACAO);

      rows.push({
        marks: marks,
        proposedProvided: true,
        base: b ? b.row : null,
        basePosition: b ? b.position : null,
        current: c ? c.row : null,
        currentPosition: c ? c.position : null,
        proposed: row,
        proposedPosition: index,
        staleCurrent: !!(b && c && !sameItemValues(b.row, c.row)),
      });
    });

    // REMOCOES NUNCA SAO OMITIDAS. Um item presente na imagem-anterior ou na
    // colecao viva e ausente da colecao proposta e uma remocao proposta
    // (db/92: a colecao proposta e ABSOLUTA) e ganha a sua propria linha.
    var proposedIds = {};
    proposed.forEach(function (row) {
      if (row && row.pedido_item_id != null) proposedIds[String(row.pedido_item_id)] = true;
    });
    var seenRemoved = {};
    [base, current].forEach(function (collection, collectionIndex) {
      collection.forEach(function (row, index) {
        var key = row && row.pedido_item_id != null ? String(row.pedido_item_id) : null;
        if (!key || proposedIds[key] || seenRemoved[key]) return;
        seenRemoved[key] = true;
        var b = baseMap[key] || null;
        var c = currentMap[key] || null;
        rows.push({
          marks: [MARK_REMOVIDO],
          proposedProvided: true,
          base: b ? b.row : null,
          basePosition: b ? b.position : null,
          current: c ? c.row : null,
          currentPosition: c ? c.position : null,
          proposed: null,
          proposedPosition: null,
          staleCurrent: !!(b && c && !sameItemValues(b.row, c.row)),
          fromCurrentOnly: collectionIndex === 1 && !b,
        });
      });
    });

    return { rows: rows, hasProposal: true, base: base, current: current, proposed: proposed };
  }

  function sameItemValues(a, b) {
    if (!a || !b) return false;
    return sameValue(a.modelo_id, b.modelo_id)
      && Number(a.metros) === Number(b.metros)
      && sameValue(a.largura, b.largura)
      && sameValue(a.observacao, b.observacao);
  }

  // Projecao para o dono canonico read-only de sequencia
  // (RAVATEX_PEDIDO_PRIORITY.buildSequence): a forma exigida por itemSummary().
  function projectForSequence(rows) {
    return (rows || []).map(function (row) {
      return {
        modeloNome: row.modelo_nome || row.modeloNome || null,
        cores: corOf(row),
        largura: row.largura,
        metros: row.metros,
      };
    });
  }

  // ------------------------------------------------------------------
  // 4. Primitivas visuais locais
  // ------------------------------------------------------------------
  function card(children, extraStyle) {
    return window.el('div', {
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border); border-radius:var(--rv-radius);'
        + ' box-shadow:var(--rv-shadow-none); padding:16px; margin-bottom:12px;' + (extraStyle || ''),
    }, children);
  }

  function cardTitle(text, trailing) {
    return window.el('div', {
      style: 'display:flex; align-items:center; justify-content:space-between; gap:12px;'
        + ' margin-bottom:12px; flex-wrap:wrap;',
    },
      window.el('div', {
        style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);',
      }, text),
      trailing || null
    );
  }

  // UI_VISUAL_CONTRACT.md sec.2.11 — AVISO AUTONOMO: largura total da regiao de
  // conteudo, superficie de card, uma unica familia semantica, jamais inline no
  // bloco de titulo, jamais pill/chip/banner de largura de texto.
  var NOTICE_PALETTE = {
    caution: { bg: 'var(--rv-signal-caution-bg)', border: 'var(--rv-signal-caution-border)', text: 'var(--rv-signal-caution)' },
    negative: { bg: 'var(--rv-pill-negative-bg)', border: 'var(--rv-pill-negative-border)', text: 'var(--rv-signal-negative)' },
    info: { bg: 'var(--rv-pill-info-bg)', border: 'var(--rv-accent-blue)', text: 'var(--rv-accent-blue)' },
    neutral: { bg: 'var(--rv-surface-subtle)', border: 'var(--rv-border)', text: 'var(--rv-text-secondary)' },
    positive: { bg: 'var(--rv-pill-positive-bg)', border: 'var(--rv-pill-positive-border)', text: 'var(--rv-signal-positive)' },
  };

  function notice(tone, title, message, marker) {
    var p = NOTICE_PALETTE[tone] || NOTICE_PALETTE.neutral;
    var attrs = {
      style: 'background:' + p.bg + '; border:1px solid ' + p.border + '; border-left:3px solid ' + p.text + ';'
        + ' border-radius:var(--rv-radius); padding:16px; margin-bottom:12px;',
      'data-rv-alteracao-notice': marker || tone,
    };
    return window.el('div', attrs,
      window.el('div', {
        style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary); margin-bottom:4px;',
      }, title),
      window.el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-secondary); line-height:1.5; white-space:pre-wrap;',
      }, message)
    );
  }

  function statusPill(status) {
    var tone = status === 'aprovada' ? 'positive'
      : (status === 'rejeitada' || status === 'falha_aplicacao') ? 'negative'
        : status === STATUS_PENDENTE ? 'caution' : 'neutral';
    var p = NOTICE_PALETTE[tone];
    return window.el('span', {
      'data-rv-alteracao-status': status,
      style: 'display:inline-flex; align-items:center; background:' + p.bg + '; color:' + p.text + ';'
        + ' border:1px solid ' + p.border + '; border-radius:var(--rv-radius); padding:4px 11px;'
        + ' font-size:12.5px; font-weight:700; white-space:nowrap;',
    }, STATUS_LABELS[status] || String(status || '—'));
  }

  function markPill(mark) {
    var tone = mark === MARK_INSERIDO ? 'positive'
      : mark === MARK_REMOVIDO ? 'negative'
        : mark === MARK_SEM_ALTERACAO ? 'neutral' : 'caution';
    var p = NOTICE_PALETTE[tone];
    return window.el('span', {
      style: 'display:inline-flex; align-items:center; background:' + p.bg + '; color:' + p.text + ';'
        + ' border:1px solid ' + p.border + '; border-radius:var(--rv-radius); padding:1px 7px;'
        + ' font-size:var(--rv-fs-2xs); font-weight:700; white-space:nowrap;',
    }, mark);
  }

  function metaLine(label, value) {
    return window.el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;' },
      window.el('span', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);' }, label),
      window.el('span', { style: 'font-size:var(--rv-fs-value); color:var(--rv-text-primary); font-weight:600;' }, value)
    );
  }

  function primaryButton(label, onclick, disabled, danger) {
    var attrs = {
      type: 'button',
      style: 'height:var(--rv-h-default); padding:0 18px; border-radius:var(--rv-radius);'
        + ' display:inline-flex; align-items:center; justify-content:center; font-family:inherit;'
        + ' font-size:var(--rv-fs-body); font-weight:700; white-space:nowrap;'
        + (disabled
          ? ' background:var(--rv-surface-subtle); color:var(--rv-text-tertiary);'
            + ' border:1px solid var(--rv-border-soft); cursor:not-allowed;'
          : danger
            ? ' background:var(--rv-surface); color:var(--rv-signal-negative);'
              + ' border:1px solid var(--rv-signal-negative-border); cursor:pointer;'
            : ' background:var(--rv-brand); color:var(--rv-text-on-brand); border:none; cursor:pointer;'),
    };
    if (disabled) attrs.disabled = true;
    else if (typeof onclick === 'function') attrs.onclick = onclick;
    return window.el('button', attrs, label);
  }

  function secondaryButton(label, onclick) {
    return window.el('button', {
      type: 'button',
      style: 'display:inline-flex; align-items:center; gap:8px; height:var(--rv-h-default); padding:0 16px;'
        + ' background:var(--rv-surface); color:var(--rv-text-primary); border:1px solid var(--rv-border-strong);'
        + ' border-radius:var(--rv-radius); font-family:inherit; font-size:var(--rv-fs-body); font-weight:600;'
        + ' cursor:pointer; white-space:nowrap;',
      onclick: onclick,
    }, svgEl(SVG_BACK), label);
  }

  // ------------------------------------------------------------------
  // 5. Tela
  // ------------------------------------------------------------------
  async function screenPedidoAlteracaoReview(pedidoId, solicitacaoId) {
    function backToPedido() { window.navigate('#/pedidos/' + pedidoId); }

    function notFoundShell(message) {
      return window.shellLayout(window.ADMIN_MENU, window.el('div', {},
        window.el('div', {
          style: 'display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; flex-wrap:wrap;',
        },
          window.el('h1', {
            style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;',
          }, 'Solicitacao de alteracao'),
          secondaryButton('Voltar para o pedido', backToPedido)
        ),
        notice('negative', 'Solicitacao nao encontrada', message, 'not-found')
      ));
    }

    if (!UUID_RE.test(String(pedidoId || '')) || !UUID_RE.test(String(solicitacaoId || ''))) {
      window.toast('Identificadores de solicitacao invalidos.', 'error');
      return notFoundShell('O endereco desta solicitacao e invalido. Volte ao pedido e abra a solicitacao pela acao de revisao.');
    }

    var container = window.el('div', { 'data-rv-alteracao-review': '1' });

    var state = {
      cmp: null,
      loadError: null,       // 'malformada' | 'rpc'
      refused: null,         // identificador estavel devolvido com ok:false
      mismatch: false,
      decisionNotice: null,  // { tone, title, message, marker }
      priorityRetryUsed: false,
      busy: false,
    };

    function isPending() {
      return !!state.cmp && state.cmp.solicitacao.status === STATUS_PENDENTE;
    }
    function isDecided() {
      return !!state.cmp && DECIDED_STATUSES.indexOf(state.cmp.solicitacao.status) !== -1;
    }

    // --------------------------------------------------------------
    // 5.1 Carregamento — UMA chamada por atualizacao de tela
    // --------------------------------------------------------------
    async function carregar() {
      state.loadError = null;
      state.refused = null;
      state.mismatch = false;

      var res;
      try {
        res = await window.supa.rpc('admin_alteracao_comparacao', { p_solicitacao_id: solicitacaoId });
      } catch (e) {
        state.cmp = null;
        state.loadError = 'rpc';
        console.error('pedido-alteracao-review: admin_alteracao_comparacao lancou', e);
        return;
      }
      if (res && res.error) {
        state.cmp = null;
        state.loadError = 'rpc';
        console.error('pedido-alteracao-review: admin_alteracao_comparacao', res.error);
        return;
      }

      var normalized = normalizeComparison(res && res.data);
      if (!normalized) {
        state.cmp = null;
        state.loadError = 'malformada';
        console.error('pedido-alteracao-review: payload de comparacao ausente ou malformado');
        return;
      }
      if (normalized.refused) {
        state.cmp = null;
        state.refused = normalized.refused;
        return;
      }

      // O Pedido da ROTA tem de ser o Pedido da solicitacao. Divergencia FALHA
      // FECHADA: nada e renderizado e o revisor volta ao hub do Pedido.
      if (String(normalized.solicitacao.pedido_id) !== String(pedidoId)) {
        state.cmp = null;
        state.mismatch = true;
        return;
      }

      state.cmp = normalized;
    }

    // --------------------------------------------------------------
    // 5.2 Cabecalho
    // --------------------------------------------------------------
    function buildHeader() {
      var sol = state.cmp ? state.cmp.solicitacao : null;
      var identity = sol ? ('Pedido ' + shortId(sol.pedido_id)) : 'Pedido';
      var titleBits = [
        window.el('h1', {
          style: 'margin:0; font-size:var(--rv-fs-title); font-weight:800; color:var(--rv-text-primary); letter-spacing:-.01em;',
        }, 'Solicitacao de alteracao'),
      ];
      if (sol) titleBits.push(statusPill(sol.status));

      return window.el('div', {
        style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:16px;'
          + ' margin-bottom:16px; flex-wrap:wrap;',
      },
        window.el('div', { style: 'min-width:0;' },
          window.el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;' }, titleBits),
          window.el('div', {
            style: 'font-size:var(--rv-fs-value); color:var(--rv-text-tertiary); margin-top:4px;',
          }, identity + (sol ? ' · Criada em ' + fmtDataHora(sol.criado_em) : ''))
        ),
        secondaryButton('Voltar para o pedido', backToPedido)
      );
    }

    function shortId(value) {
      var s = String(value || '');
      return s.length > 8 ? s.slice(0, 8) : (s || '—');
    }

    // --------------------------------------------------------------
    // 5.3 Solicitante
    // --------------------------------------------------------------
    function buildSolicitanteCard() {
      var sol = state.cmp.solicitacao;
      var papel = PAPEL_LABELS[sol.solicitante_papel] || String(sol.solicitante_papel || '—');
      var identidade = sol.solicitante_id
        ? papel + ' · identificador ' + shortId(sol.solicitante_id)
        : papel;

      var children = [
        cardTitle('Solicitante'),
        metaLine('Identidade', identidade),
        metaLine('Papel', papel),
        metaLine('Criada em', fmtDataHora(sol.criado_em)),
      ];
      if (sol.decidido_em) children.push(metaLine('Decidida em', fmtDataHora(sol.decidido_em)));
      if (sol.decisao_motivo) {
        children.push(window.el('div', { style: 'margin-top:12px;' },
          window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-bottom:4px;' }, 'Motivo da decisao'),
          window.el('div', {
            style: 'font-size:var(--rv-fs-body); color:var(--rv-text-primary); line-height:1.5; white-space:pre-wrap;',
          }, sol.decisao_motivo)
        ));
      }
      children.push(window.el('div', { style: 'margin-top:12px;' },
        window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-bottom:4px;' }, 'Mensagem do cliente'),
        window.el('div', {
          'data-rv-alteracao-mensagem': '1',
          style: 'font-size:var(--rv-fs-body); color:' + (sol.mensagem_cliente ? 'var(--rv-text-primary)' : 'var(--rv-text-tertiary)')
            + '; line-height:1.5; white-space:pre-wrap;',
        }, sol.mensagem_cliente || 'Nenhuma mensagem foi enviada.')
      ));

      // O identificador de falha de aplicacao e DIAGNOSTICO ADMINISTRATIVO e
      // aparece SOMENTE nesta secao, nunca em copy de usuario nem em toast.
      if (sol.status === 'falha_aplicacao' && sol.falha_identificador) {
        children.push(window.el('div', {
          'data-rv-alteracao-falha-diagnostico': '1',
          style: 'margin-top:12px; padding:10px 12px; background:var(--rv-surface-subtle);'
            + ' border:1px solid var(--rv-border); border-radius:var(--rv-radius);',
        },
          window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary); margin-bottom:4px;' },
            'Diagnostico administrativo da falha de aplicacao'),
          window.el('code', {
            style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-secondary); word-break:break-word;',
          }, String(sol.falha_identificador))
        ));
      }

      return window.el('div', { 'data-rv-alteracao-solicitante': '1' }, card(children));
    }

    // --------------------------------------------------------------
    // 5.4 Impacto vivo (consumido, nunca reinterpretado)
    // --------------------------------------------------------------
    function buildImpactoNotices() {
      var imp = state.cmp.impacto;
      var sol = state.cmp.solicitacao;
      var nodes = [];

      if (imp.base_desatualizada === true) {
        nodes.push(notice('negative', 'O pedido mudou depois da criacao desta solicitacao',
          'A revisao aceita mudou de ' + String(sol.base_revisao) + ' para ' + String(imp.revisao_atual) + '.'
          + ' A aprovacao nao pode mesclar nem sobrescrever o estado mais recente do pedido.'
          + ' O Cliente precisa abrir o editor e enviar uma solicitacao substituta.',
          'base-desatualizada'));
      }

      if (imp.tem_op_relacionada === true) {
        nodes.push(notice('caution', 'Este pedido ja tem producao vinculada',
          'Uma proposta estrutural — trocar modelo, alterar metragem, inserir ou remover item —'
          + ' pode ser recusada pela aprovacao. A decisao final e do servidor.',
          'op-relacionada'));
      }

      // O aviso NEUTRO afirma que a solicitacao esta pronta para revisao, o que
      // so e verdade enquanto ela esta pendente. Base desatualizada e producao
      // vinculada continuam sendo fatos materiais mesmo depois da decisao, e
      // permanecem visiveis; a copy de "pronta para revisao" nao.
      if (isPending() && imp.base_desatualizada !== true && imp.tem_op_relacionada !== true) {
        nodes.push(notice('neutral', 'Solicitacao pronta para revisao',
          'A revisao base da solicitacao coincide com a revisao aceita atual e nenhuma producao'
          + ' esta vinculada a este pedido.',
          'revisao-neutra'));
      }

      nodes.push(card([
        cardTitle('Impacto e concorrencia'),
        window.el('div', {
          'data-rv-alteracao-impacto': '1',
          'data-rv-metrics': '',
          style: 'display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px;',
        },
          impactMetric('Revisao base da solicitacao', String(sol.base_revisao)),
          impactMetric('Revisao atual do pedido', String(imp.revisao_atual)),
          impactMetric('Base desatualizada', imp.base_desatualizada === true ? 'Sim' : 'Nao'),
          impactMetric('Producao vinculada', imp.tem_op_relacionada === true ? 'Sim' : 'Nao')
        ),
      ]));

      return nodes;
    }

    function impactMetric(label, value) {
      return window.el('div', {
        style: 'min-width:0; border:1px solid var(--rv-border); border-radius:var(--rv-radius);'
          + ' padding:10px 12px; background:var(--rv-surface-subtle);',
      },
        window.el('div', { style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);' }, label),
        window.el('div', {
          style: 'font-size:var(--rv-fs-metric-rail); font-weight:700; color:var(--rv-text-primary); margin-top:2px;',
        }, value)
      );
    }

    // --------------------------------------------------------------
    // 5.5 Dados gerais — antes / atual / proposto
    // --------------------------------------------------------------
    var HEADER_COLS = 'minmax(150px,1.1fr) minmax(120px,1fr) minmax(120px,1fr) minmax(120px,1fr)';

    function buildHeaderDiffCard() {
      var cmp = state.cmp;
      var head = window.el('div', {
        style: 'display:grid; grid-template-columns:' + HEADER_COLS + '; gap:10px; padding:8px 12px;'
          + ' background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border); min-width:620px;',
      }, ['Campo', 'Aceito na criacao', 'Atual (vivo)', 'Proposto'].map(function (label) {
        return window.el('div', {
          style: 'font-size:12.5px; font-weight:600; color:var(--rv-text-secondary);',
        }, label);
      }));

      var rowsWrap = window.el('div', {});
      HEADER_FIELDS.forEach(function (field, index) {
        var antesValue = cmp.antes[field.key];
        var atualValue = cmp.atual[field.key];
        var proposed = cmp.camposAlterados.indexOf(field.key) !== -1;
        var propostoValue = proposed ? cmp.propostoHeader[field.key] : undefined;
        var staleCurrent = !sameValue(antesValue, atualValue);

        var propostoCell;
        if (!proposed) {
          propostoCell = window.el('div', {
            'data-rv-alteracao-sem-proposta': field.key,
            style: 'font-size:13.5px; color:var(--rv-text-tertiary);',
          }, SEM_PROPOSTA);
        } else {
          var changed = !sameValue(antesValue, propostoValue);
          propostoCell = window.el('div', {
            'data-rv-alteracao-proposto': field.key,
            'data-rv-alteracao-proposto-nulo': (propostoValue == null || propostoValue === '') ? '1' : null,
            style: 'font-size:13.5px; font-weight:' + (changed ? '700' : '600') + ';'
              + ' color:' + (changed ? 'var(--rv-accent-blue)' : 'var(--rv-text-primary)') + '; white-space:pre-wrap;',
          }, fmtFieldValue(field.kind, propostoValue));
        }

        var atualCell = window.el('div', { style: 'min-width:0;' },
          window.el('div', {
            'data-rv-alteracao-atual': field.key,
            style: 'font-size:13.5px; color:var(--rv-text-primary); white-space:pre-wrap;',
          }, fmtFieldValue(field.kind, atualValue)),
          staleCurrent ? window.el('div', {
            'data-rv-alteracao-atual-divergente': field.key,
            style: 'font-size:var(--rv-fs-2xs); color:var(--rv-signal-caution); margin-top:2px; font-weight:700;',
          }, 'Mudou desde a criacao da solicitacao') : null
        );

        rowsWrap.appendChild(window.el('div', {
          'data-rv-alteracao-header-field': field.key,
          style: 'display:grid; grid-template-columns:' + HEADER_COLS + '; gap:10px; padding:9px 12px;'
            + ' align-items:start; min-width:620px;'
            + (index === HEADER_FIELDS.length - 1 ? '' : ' border-bottom:1px solid var(--rv-border-soft);'),
        },
          window.el('div', { style: 'font-size:13.5px; font-weight:600; color:var(--rv-text-secondary);' }, field.label),
          window.el('div', {
            'data-rv-alteracao-antes': field.key,
            style: 'font-size:13.5px; color:var(--rv-text-secondary); white-space:pre-wrap;',
          }, fmtFieldValue(field.kind, cmp.antes[field.key])),
          atualCell,
          propostoCell
        ));
      });

      return card([
        cardTitle('Dados gerais'),
        window.el('div', {
          'data-rv-alteracao-header-diff': '1',
          style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;',
        },
          window.el('div', { 'data-rv-table-scroll': '1', style: 'overflow-x:auto;' }, head, rowsWrap)
        ),
      ]);
    }

    // --------------------------------------------------------------
    // 5.6 Colecao de itens — antes / atual / proposto por linha
    // --------------------------------------------------------------
    var ITEM_COLS = '78px minmax(150px,1.3fr) minmax(90px,.9fr) minmax(80px,.7fr) minmax(90px,.8fr) minmax(140px,1.2fr) minmax(120px,.9fr)';
    var ITEM_MIN_WIDTH = '860px';

    function buildItensCard(diff) {
      var showCores = diff.rows.some(function (row) {
        return !!(corOf(row.proposed) || corOf(row.current) || corOf(row.base));
      });

      var labels = ['Posicao', 'Modelo', 'Cores', 'Largura', 'Metragem', 'Observacao do item', 'Situacao'];
      var cols = ITEM_COLS;
      if (!showCores) {
        labels.splice(2, 1);
        cols = '78px minmax(150px,1.3fr) minmax(80px,.7fr) minmax(90px,.8fr) minmax(140px,1.2fr) minmax(120px,.9fr)';
      }

      var head = window.el('div', {
        style: 'display:grid; grid-template-columns:' + cols + '; gap:10px; padding:8px 12px;'
          + ' background:var(--rv-surface-subtle); border-bottom:1px solid var(--rv-border); min-width:' + ITEM_MIN_WIDTH + ';',
      }, labels.map(function (label) {
        return window.el('div', { style: 'font-size:12.5px; font-weight:600; color:var(--rv-text-secondary);' }, label);
      }));

      var rowsWrap = window.el('div', {});
      diff.rows.forEach(function (row) {
        rowsWrap.appendChild(buildItemRow(row, cols, showCores));
      });
      if (!diff.rows.length) {
        rowsWrap.appendChild(window.el('div', {
          style: 'padding:14px 12px; font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
        }, 'Este pedido nao tem itens.'));
      }

      var subtitle = diff.hasProposal
        ? 'A colecao proposta e ABSOLUTA: um item vivo ausente dela e uma remocao proposta.'
        : 'Esta solicitacao nao propoe colecao de itens; a colecao viva aparece apenas como contexto.';

      return card([
        cardTitle('Itens do pedido', window.el('span', {
          'data-rv-alteracao-itens-propostos': diff.hasProposal ? '1' : '0',
          style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
        }, subtitle)),
        window.el('div', {
          'data-rv-alteracao-itens-diff': '1',
          style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;',
        },
          window.el('div', { 'data-rv-table-scroll': '1', style: 'overflow-x:auto;' }, head, rowsWrap)
        ),
      ]);
    }

    // Cada celula mostra o valor PROPOSTO (ou o vivo, quando nao ha proposta),
    // a imagem-anterior quando ela difere, e o marcador de "atual divergente"
    // quando o valor vivo ja nao e mais o da imagem-anterior.
    function valueCell(kind, row, pick) {
      var baseValue = row.base ? pick(row.base) : null;
      var currentValue = row.current ? pick(row.current) : null;
      var hasProposed = !!row.proposed;
      var proposedValue = hasProposed ? pick(row.proposed) : null;

      var mainRaw = hasProposed ? proposedValue : currentValue;
      var main = kind === 'metros' ? fmtMetros(mainRaw)
        : kind === 'largura' ? fmtLargura(mainRaw)
          : (mainRaw == null || mainRaw === '') ? '—' : String(mainRaw);

      var changed = hasProposed && row.base && !sameValue(baseValue, proposedValue);
      var stale = !!(row.base && row.current && !sameValue(baseValue, currentValue));

      var children = [window.el('div', {
        style: 'font-size:13.5px; font-weight:' + (changed ? '700' : '500') + ';'
          + ' color:' + (changed ? 'var(--rv-accent-blue)' : 'var(--rv-text-primary)') + '; white-space:pre-wrap;',
      }, main)];

      if (changed) {
        children.push(window.el('div', {
          style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-tertiary); margin-top:2px;',
        }, 'antes: ' + (kind === 'metros' ? fmtMetros(baseValue)
          : kind === 'largura' ? fmtLargura(baseValue)
            : (baseValue == null || baseValue === '') ? VAZIO : String(baseValue))));
      }
      if (stale) {
        children.push(window.el('div', {
          style: 'font-size:var(--rv-fs-2xs); color:var(--rv-signal-caution); margin-top:2px; font-weight:700;',
        }, 'atual: ' + (kind === 'metros' ? fmtMetros(currentValue)
          : kind === 'largura' ? fmtLargura(currentValue)
            : (currentValue == null || currentValue === '') ? VAZIO : String(currentValue))));
      }
      return window.el('div', { style: 'min-width:0;' }, children);
    }

    function buildItemRow(row, cols, showCores) {
      var removed = row.marks.indexOf(MARK_REMOVIDO) !== -1;
      var reference = row.proposed || row.current || row.base || {};

      var posicaoBits = [];
      if (row.proposedPosition != null) {
        posicaoBits.push(window.el('div', {
          style: 'font-size:13.5px; font-weight:700; color:var(--rv-text-primary);',
        }, PRIORITY().rankLabel(row.proposedPosition)));
      } else {
        posicaoBits.push(window.el('div', {
          style: 'font-size:13.5px; font-weight:700; color:var(--rv-text-tertiary);',
        }, '—'));
      }
      if (row.basePosition != null && row.basePosition !== row.proposedPosition) {
        posicaoBits.push(window.el('div', {
          style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-tertiary); margin-top:2px;',
        }, 'antes: ' + PRIORITY().rankLabel(row.basePosition)));
      }

      var cells = [
        window.el('div', { style: 'min-width:0;' }, posicaoBits),
        valueCell('text', row, function (r) { return r.modelo_nome || r.modeloNome || null; }),
      ];
      if (showCores) cells.push(valueCell('text', row, function (r) { return corOf(r); }));
      cells.push(valueCell('largura', row, function (r) { return r.largura; }));
      cells.push(valueCell('metros', row, function (r) { return r.metros; }));
      cells.push(valueCell('text', row, function (r) { return r.observacao; }));
      cells.push(window.el('div', { style: 'display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-width:0;' },
        row.marks.map(markPill)));

      return window.el('div', {
        'data-rv-alteracao-item-row': String(reference.pedido_item_id || 'novo'),
        'data-rv-alteracao-item-markers': row.marks.join(','),
        style: 'display:grid; grid-template-columns:' + cols + '; gap:10px; padding:9px 12px;'
          + ' align-items:start; border-bottom:1px solid var(--rv-border-soft); min-width:' + ITEM_MIN_WIDTH + ';'
          + (removed ? ' background:var(--rv-pill-negative-bg);' : ''),
      }, cells);
    }

    // --------------------------------------------------------------
    // 5.7 Prioridade — dono canonico read-only
    // --------------------------------------------------------------
    function buildPrioridadeCard(diff) {
      var api = PRIORITY();
      var cmp = state.cmp;

      var propostaHabilitada = cmp.solicitacao.prioridade_proposta === true;
      var propostaStatus = propostaHabilitada ? api.STATUS.SOLICITADA : api.STATUS.NENHUMA;
      var propostaItens = diff.hasProposal ? diff.proposed : diff.current;

      function block(marker, title, statusKey, rows) {
        var children = [
          window.el('div', {
            style: 'font-size:var(--rv-fs-sm); font-weight:700; color:var(--rv-text-secondary); margin-bottom:6px;',
          }, title),
          window.el('div', {
            'data-rv-alteracao-prioridade-status': marker,
            style: 'font-size:var(--rv-fs-value); color:var(--rv-text-primary); margin-bottom:8px;',
          }, api.ADMIN_LABEL[statusKey] || String(statusKey)),
        ];
        if (rows && rows.length) {
          children.push(api.buildSequence(projectForSequence(rows), { controls: false }));
        } else {
          children.push(window.el('div', {
            style: 'font-size:var(--rv-fs-sm); color:var(--rv-text-tertiary);',
          }, 'Nenhuma sequencia a exibir.'));
        }
        return window.el('div', { 'data-rv-alteracao-prioridade-block': marker, style: 'min-width:0;' }, children);
      }

      return card([
        cardTitle('Prioridade de producao'),
        window.el('div', {
          'data-rv-alteracao-prioridade': '1',
          'data-rv-2col': '1',
          style: 'display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; align-items:start;',
        },
          block('base', 'Aceita na criacao', api.statusDe(cmp.antes), diff.base),
          block('atual', 'Atual (vivo)', api.statusDe(cmp.atual), diff.current),
          block('proposto', 'Proposta', propostaStatus, propostaItens)
        ),
      ]);
    }

    // --------------------------------------------------------------
    // 5.8 Rodape de acoes
    // --------------------------------------------------------------
    function buildActionFooter() {
      if (!isPending()) return null;
      var staleBase = state.cmp.impacto.base_desatualizada === true;

      var rejectBtn = primaryButton('Rejeitar', function () { return abrirRejeicao(); }, false, true);
      rejectBtn.setAttribute('data-rv-alteracao-reject', '1');

      var approveBtn = primaryButton('Aprovar', function () { return abrirAprovacao(); }, staleBase || state.busy, false);
      approveBtn.setAttribute('data-rv-alteracao-approve', '1');
      if (staleBase) {
        approveBtn.setAttribute('title',
          'A aprovacao esta indisponivel porque o pedido mudou depois da criacao desta solicitacao.');
      }

      return card([
        window.el('div', {
          'data-rv-alteracao-actions': '1',
          'data-card-actions': '',
          style: 'display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap;',
        }, rejectBtn, approveBtn),
      ]);
    }

    // --------------------------------------------------------------
    // 5.9 Aprovacao
    // --------------------------------------------------------------
    function reasonField(placeholder, ariaLabel) {
      return window.textArea({
        role: 'autosize', autosize: true, rows: 2, value: '',
        placeholder: placeholder, ariaLabel: ariaLabel,
      });
    }

    // O modal carrega SOMENTE copy de confirmacao concisa e as acoes. A
    // comparacao inteira continua na pagina, atras dele.
    function abrirAprovacao() {
      var motivoInput = reasonField('Motivo administrativo (opcional)...', 'Motivo da aprovacao');
      var body = window.el('div', { 'data-rv-alteracao-approve-modal': '1' },
        window.el('p', {
          style: 'font-size:var(--rv-fs-body); color:var(--rv-text-secondary); line-height:1.5; margin:0 0 12px;',
        }, 'A revisao proposta sera aplicada ao pedido e a solicitacao passa a Aprovada.'),
        motivoInput
      );
      window.modal({
        title: 'Aprovar solicitacao de alteracao',
        body: body,
        saveLabel: 'Aprovar solicitacao',
        onSave: async function () {
          var motivo = String(motivoInput.value || '').trim() || null;
          await aprovar(motivo, false);
        },
      });
    }

    // UMA chamada por acao. `p_confirmar_impacto` so pode ser true numa unica
    // retentativa, e SOMENTE apos confirmacao explicita do administrador no
    // padrao canonico de impacto de prioridade. Nunca ha retentativa silenciosa.
    async function aprovar(motivo, confirmarImpacto) {
      if (state.busy) return;
      state.busy = true;
      var r;
      try {
        r = await window.supa.rpc('aprovar_alteracao_pedido', {
          p_solicitacao_id: solicitacaoId,
          p_confirmar_impacto: confirmarImpacto === true,
          p_motivo: motivo,
        });
      } catch (e) {
        state.busy = false;
        window.toast('Erro inesperado ao aprovar.', 'error');
        console.error('pedido-alteracao-review: aprovar_alteracao_pedido lancou', e);
        return;
      }
      state.busy = false;

      if (r && r.error) {
        await tratarRecusaDeAprovacao(r.error, motivo);
        return;
      }

      var data = r ? r.data : null;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { data = null; } }
      if (Array.isArray(data)) data = data[0] || null;

      if (data && data.ok === false) {
        await tratarResultadoNegativo(data, motivo);
        return;
      }

      // SUCESSO SO E AFIRMADO DEPOIS DA RECARGA PROVAR O ESTADO DECIDIDO.
      await carregar();
      if (state.cmp && state.cmp.solicitacao.status === 'aprovada') {
        state.decisionNotice = {
          tone: 'positive', marker: 'aprovada',
          title: 'Solicitacao aprovada',
          message: 'A revisao proposta foi aplicada ao pedido e esta solicitacao esta encerrada.',
        };
        window.toast('Solicitacao de alteracao aprovada.', 'success');
      } else {
        state.decisionNotice = {
          tone: 'caution', marker: 'estado-indeterminado',
          title: 'Nao foi possivel confirmar o resultado',
          message: 'A recarga da comparacao nao confirmou o estado Aprovada. Revise o estado atual desta'
            + ' solicitacao antes de qualquer nova acao.',
        };
      }
      render();
    }

    function tokenIn(error, token) {
      return PRIORITY().erroContem(error, token);
    }

    async function tratarRecusaDeAprovacao(error, motivo) {
      // Recusa ESPERADA de validacao: a solicitacao continua pendente e
      // NENHUMA linha viva do Pedido mudou.
      if (tokenIn(error, ERR.STALE)) {
        await carregar();
        state.decisionNotice = {
          tone: 'negative', marker: 'recusa-base-desatualizada',
          title: 'Aprovacao recusada: o pedido mudou',
          message: 'A solicitacao continua PENDENTE e o pedido nao foi alterado. Nao existe mesclagem,'
            + ' rebase nem nova tentativa: o Cliente precisa enviar uma solicitacao substituta.',
        };
        render();
        return;
      }
      if (tokenIn(error, ERR.ESTRUTURA_OP) || tokenIn(error, ERR.ITEM_OP)) {
        await carregar();
        state.decisionNotice = {
          tone: 'negative', marker: 'recusa-estrutural',
          title: 'Aprovacao recusada: producao vinculada',
          message: 'A proposta estrutural nao pode ser aprovada porque este pedido ja tem producao'
            + ' vinculada, e a aprovacao nao e um override. A solicitacao continua PENDENTE e o pedido'
            + ' nao foi alterado. Rejeite a solicitacao com justificativa.',
        };
        render();
        return;
      }
      if (tokenIn(error, ERR.PRIORITY_IMPACT)) {
        abrirConfirmacaoDeImpactoDePrioridade(motivo);
        return;
      }
      if (tokenIn(error, ERR.JA_DECIDIDA)) {
        await carregar();
        state.decisionNotice = {
          tone: 'caution', marker: 'ja-decidida',
          title: 'Esta solicitacao ja estava decidida',
          message: 'Nenhuma aprovacao foi registrada por esta acao. O estado abaixo e o estado atual.',
        };
        render();
        return;
      }
      if (tokenIn(error, ERR.TERMINAL)) {
        await carregar();
        state.decisionNotice = {
          tone: 'negative', marker: 'pedido-terminal',
          title: 'O pedido esta encerrado',
          message: 'Um pedido entregue ou cancelado nao aceita aplicacao. Nenhuma aprovacao foi registrada.',
        };
        render();
        return;
      }
      if (tokenIn(error, ERR.NOT_FOUND) || tokenIn(error, ERR.PEDIDO_NOT_FOUND) || tokenIn(error, ERR.FORBIDDEN)) {
        window.toast('Nao foi possivel confirmar a solicitacao ou a permissao.', 'error');
        backToPedido();
        return;
      }

      window.toast('Nao foi possivel aprovar a solicitacao.', 'error');
      console.error('pedido-alteracao-review: aprovar_alteracao_pedido recusou', error);
      await carregar();
      render();
    }

    // db/92 devolve `ok:false` em EXATAMENTE um caso: a falha INESPERADA de
    // aplicacao, integralmente desfeita pela subtransacao PL/pgSQL. O frontend
    // NUNCA grava esse estado; ele apenas o le de volta.
    async function tratarResultadoNegativo(data, motivo) {
      var identificador = String(data.falha_identificador || '');
      await carregar();

      if (identificador.indexOf(ERR.ESTRUTURA_OP) !== -1 || identificador.indexOf(ERR.ITEM_OP) !== -1) {
        state.decisionNotice = {
          tone: 'negative', marker: 'falha-estrutural',
          title: 'Falha ao aplicar: producao vinculada',
          message: 'A proposta estrutural nao pode ser aplicada porque este pedido ja tem producao'
            + ' vinculada. O banco desfez integralmente a aplicacao e o pedido continua exatamente como'
            + ' estava. Rejeite a solicitacao com justificativa; nao existe nova tentativa com override.',
        };
        render();
        return;
      }
      if (identificador.indexOf(ERR.PRIORITY_IMPACT) !== -1) {
        state.decisionNotice = {
          tone: 'negative', marker: 'falha-prioridade-impacto',
          title: 'Falha ao aplicar: a prioridade exige confirmacao de impacto',
          message: 'O banco desfez integralmente a aplicacao e o pedido continua exatamente como estava,'
            + ' mas registrou esta solicitacao como Falha ao aplicar. Nenhuma nova tentativa e possivel'
            + ' sobre uma solicitacao decidida; o Cliente precisa enviar uma solicitacao substituta.',
        };
        render();
        return;
      }

      state.decisionNotice = {
        tone: 'negative', marker: 'falha-aplicacao',
        title: 'Falha ao aplicar',
        message: 'O banco desfez integralmente a aplicacao: o pedido continua exatamente como estava e a'
          + ' imagem-anterior da solicitacao foi preservada. Nada foi aprovado. O diagnostico tecnico'
          + ' aparece na secao do solicitante.',
      };
      render();
    }

    // Padrao canonico de confirmacao de impacto de prioridade
    // (RAVATEX_PEDIDO_PRIORITY.openImpactoProducao). SOMENTE a confirmacao
    // explicita retenta, UMA unica vez, com o MESMO id de solicitacao e o
    // MESMO motivo.
    function abrirConfirmacaoDeImpactoDePrioridade(motivo) {
      if (state.priorityRetryUsed) {
        window.toast('A confirmacao de impacto de prioridade ja foi usada nesta solicitacao.', 'error');
        return;
      }
      PRIORITY().openImpactoProducao({
        onCancelar: function () {
          state.decisionNotice = {
            tone: 'caution', marker: 'prioridade-nao-confirmada',
            title: 'Aprovacao interrompida',
            message: 'A alteracao de prioridade exigia confirmacao de impacto e nao foi confirmada.'
              + ' A solicitacao continua PENDENTE e o pedido nao foi alterado.',
          };
          render();
        },
        onConfirmar: function () {
          state.priorityRetryUsed = true;
          return aprovar(motivo, true);
        },
      });
    }

    // --------------------------------------------------------------
    // 5.10 Rejeicao — motivo OBRIGATORIO
    // --------------------------------------------------------------
    function abrirRejeicao() {
      var motivoInput = reasonField('Explique por que a solicitacao nao pode ser aprovada...', 'Motivo da rejeicao');
      var body = window.el('div', { 'data-rv-alteracao-reject-modal': '1' },
        window.el('p', {
          style: 'font-size:var(--rv-fs-body); color:var(--rv-text-secondary); line-height:1.5; margin:0 0 12px;',
        }, 'O pedido nao sera alterado. O motivo e obrigatorio e fica visivel ao Cliente.'),
        motivoInput
      );
      window.modal({
        title: 'Rejeitar solicitacao de alteracao',
        body: body,
        saveLabel: 'Rejeitar solicitacao',
        danger: true,
        onSave: async function () {
          var motivo = String(motivoInput.value || '').trim();
          if (!motivo) {
            window.toast('Informe o motivo da rejeicao.', 'error');
            return false;                 // mantem o modal aberto; NENHUMA RPC
          }
          await rejeitar(motivo);
        },
      });
    }

    async function rejeitar(motivo) {
      if (state.busy) return;
      state.busy = true;
      var r;
      try {
        r = await window.supa.rpc('rejeitar_alteracao_pedido', {
          p_solicitacao_id: solicitacaoId,
          p_motivo: motivo,
        });
      } catch (e) {
        state.busy = false;
        window.toast('Erro inesperado ao rejeitar.', 'error');
        console.error('pedido-alteracao-review: rejeitar_alteracao_pedido lancou', e);
        return;
      }
      state.busy = false;

      if (r && r.error) {
        if (tokenIn(r.error, ERR.MOTIVO)) {
          window.toast('Informe o motivo da rejeicao.', 'error');
          return;
        }
        if (tokenIn(r.error, ERR.JA_DECIDIDA)) {
          await carregar();
          state.decisionNotice = {
            tone: 'caution', marker: 'ja-decidida',
            title: 'Esta solicitacao ja estava decidida',
            message: 'Nenhuma rejeicao foi registrada por esta acao. O estado abaixo e o estado atual.',
          };
          render();
          return;
        }
        if (tokenIn(r.error, ERR.NOT_FOUND) || tokenIn(r.error, ERR.FORBIDDEN)) {
          window.toast('Nao foi possivel confirmar a solicitacao ou a permissao.', 'error');
          backToPedido();
          return;
        }
        window.toast('Nao foi possivel rejeitar a solicitacao.', 'error');
        console.error('pedido-alteracao-review: rejeitar_alteracao_pedido recusou', r.error);
        await carregar();
        render();
        return;
      }

      await carregar();
      if (state.cmp && state.cmp.solicitacao.status === 'rejeitada') {
        state.decisionNotice = {
          tone: 'neutral', marker: 'rejeitada',
          title: 'Solicitacao rejeitada',
          message: 'O pedido permanece exatamente como estava. O motivo informado fica visivel ao Cliente.',
        };
        window.toast('Solicitacao de alteracao rejeitada.', 'success');
      } else {
        state.decisionNotice = {
          tone: 'caution', marker: 'estado-indeterminado',
          title: 'Nao foi possivel confirmar o resultado',
          message: 'A recarga da comparacao nao confirmou o estado Rejeitada. Revise o estado atual desta'
            + ' solicitacao antes de qualquer nova acao.',
        };
      }
      render();
    }

    // --------------------------------------------------------------
    // 5.11 Render
    // --------------------------------------------------------------
    function buildDecidedNotice() {
      var sol = state.cmp.solicitacao;
      if (sol.status === STATUS_PENDENTE) return null;
      if (!isDecided()) return null;
      var tone = sol.status === 'aprovada' ? 'positive'
        : (sol.status === 'rejeitada' || sol.status === 'falha_aplicacao') ? 'negative' : 'neutral';
      var messages = {
        aprovada: 'Esta solicitacao foi aprovada e aplicada. A comparacao abaixo e somente leitura.',
        rejeitada: 'Esta solicitacao foi rejeitada e o pedido nao foi alterado. A comparacao abaixo e somente leitura.',
        retirada: 'Esta solicitacao foi retirada pelo Cliente e nao esta pendente. A comparacao abaixo e somente leitura.',
        substituida: 'Esta solicitacao foi substituida por uma solicitacao mais recente e nao esta pendente.'
          + ' A comparacao abaixo e somente leitura.',
        falha_aplicacao: 'A aplicacao desta solicitacao falhou e foi integralmente desfeita pelo banco: o pedido'
          + ' continua exatamente como estava. A comparacao abaixo e somente leitura.',
      };
      return notice(tone, 'Solicitacao ' + (STATUS_LABELS[sol.status] || sol.status).toLowerCase(),
        messages[sol.status] || 'Esta solicitacao nao esta pendente. A comparacao abaixo e somente leitura.',
        'decidida-' + sol.status);
    }

    function render() {
      if (state.mismatch) {
        window.toast('Esta solicitacao nao pertence a este pedido.', 'error');
        backToPedido();
        return;
      }
      if (state.refused) {
        container.replaceChildren(buildHeader(),
          notice('negative', 'Solicitacao indisponivel',
            state.refused === ERR.FORBIDDEN
              ? 'Esta revisao e restrita a administradores.'
              : 'A solicitacao informada nao existe. Volte ao pedido e abra a solicitacao pela acao de revisao.',
            'recusada'));
        return;
      }
      if (state.loadError === 'malformada') {
        container.replaceChildren(buildHeader(),
          notice('negative', 'Comparacao indisponivel',
            'A comparacao desta solicitacao nao pode ser exibida porque a resposta de'
            + ' admin_alteracao_comparacao esta ausente ou incompleta. Nenhuma decisao pode ser tomada sem'
            + ' a comparacao completa.',
            'payload-malformado'));
        return;
      }
      if (state.loadError) {
        container.replaceChildren(buildHeader(),
          notice('negative', 'Erro ao carregar a comparacao',
            'Nao foi possivel carregar a comparacao desta solicitacao. Tente recarregar a pagina.',
            'erro-leitura'));
        return;
      }
      if (!state.cmp) {
        container.replaceChildren(buildHeader());
        return;
      }

      var nodes = [buildHeader()];
      if (state.decisionNotice) {
        nodes.push(notice(state.decisionNotice.tone, state.decisionNotice.title,
          state.decisionNotice.message, state.decisionNotice.marker));
      }
      var decidedNotice = buildDecidedNotice();
      if (decidedNotice) nodes.push(decidedNotice);
      nodes.push(buildSolicitanteCard());
      buildImpactoNotices().forEach(function (node) { nodes.push(node); });
      nodes.push(buildHeaderDiffCard());
      // UMA passada de diferenca de apresentacao por render, consumida pela
      // tabela de itens e pela comparacao de prioridade.
      var diff = buildItemDiff(state.cmp);
      nodes.push(buildItensCard(diff));
      nodes.push(buildPrioridadeCard(diff));
      var footer = buildActionFooter();
      if (footer) nodes.push(footer);

      container.replaceChildren.apply(container, nodes);
    }

    await carregar();
    if (state.mismatch) {
      window.toast('Esta solicitacao nao pertence a este pedido.', 'error');
      backToPedido();
      return notFoundShell('Esta solicitacao nao pertence ao pedido informado no endereco.');
    }
    render();
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.pedidoAlteracaoReview = {
    screenPedidoAlteracaoReview: screenPedidoAlteracaoReview,
    STATUS_LABELS: STATUS_LABELS,
    DECIDED_STATUSES: DECIDED_STATUSES,
    HEADER_FIELDS: HEADER_FIELDS,
    normalizeComparison: normalizeComparison,
  };
  window.screenPedidoAlteracaoReview = screenPedidoAlteracaoReview;
  window.RAVATEX_PEDIDO_ALTERACAO_REVIEW_MARKS = {
    INSERIDO: MARK_INSERIDO,
    REMOVIDO: MARK_REMOVIDO,
    ALTERADO: MARK_ALTERADO,
    REORDENADO: MARK_REORDENADO,
    SEM_ALTERACAO: MARK_SEM_ALTERACAO,
  };
})(window);
