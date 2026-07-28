// =====================================================================
// === PEDIDO PRODUCTION PRIORITY — SHARED OWNER =======================
// Dono UNICO da semantica de PRIORIDADE DE PRODUCAO ENTRE OS ITENS DE UM
// MESMO PEDIDO, no front-end.
//
// Fase: PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1.
// Contrato de banco: db/91_pedido_item_production_priority.sql.
//
// O QUE ISTO E — E O QUE NAO E
//   E uma ORDENACAO RELATIVA entre os itens de UM Pedido: o primeiro item
//   exibido e o de maior prioridade, o segundo o seguinte, e assim por diante.
//   NAO e prioridade de um Pedido sobre outro, nao e nivel de urgencia global,
//   nao e prioridade de cliente, nao e prioridade de compra, nao e categoria de
//   prazo e NAO existe classificacao Alta/Media/Baixa. Nenhum rotulo desse tipo
//   pode aparecer em superficie alguma.
//
// POR QUE UM DONO COMPARTILHADO
//   Quatro superficies diferentes (criacao admin, criacao cliente, detalhe
//   admin, detalhe cliente) mais as listas e a OP precisam da MESMA semantica
//   de estado, do MESMO calculo de permissao e do MESMO texto. Duplicar isso
//   por tela produziria quatro definicoes que divergem no primeiro ajuste.
//   Aqui a semantica tem UM dono; as telas so consomem.
//
// POR QUE ESTE ARQUIVO VIVE EM js/ E NAO EM js/screens/
//   js/screens/*.js e a superficie de TELA auditada pelo detector de
//   conformidade (scripts/ui-conformance/inventory.mjs). Este modulo nao e uma
//   tela: e um dono de dominio compartilhado, como js/pedido-ui.js e
//   js/product-route.js, e fica ao lado deles.
//
// TAMANHO — JUSTIFICATIVA EXIGIDA POR CODE_HEALTH_RULES.md sec.7
//   Este arquivo passa das 500 linhas da faixa "aceitavel", entao a regra exige
//   justificar por que ele NAO foi dividido.
//
//   A ordem que o criou declara explicitamente UM dono bounded, e enumera o que
//   ele possui: constantes e rotulos de estado, formatacao de rank, reordenacao
//   determinista, formatacao de resumo de item, HELPERS DE CONTEUDO DE MODAL e
//   predicados de permissao. Ou seja: a semantica pura e as superficies que a
//   exibem sao, por decisao de projeto, o MESMO dono.
//
//   Dividir em "puro" e "DOM" produziria dois arquivos que so fazem sentido
//   juntos, obrigaria toda tela a carregar os dois e criaria exatamente a
//   fronteira que a ordem quis evitar — a chance de a semantica divergir da sua
//   apresentacao. O ganho seria contabil, e o custo, real.
//
//   O arquivo continua dentro da faixa excepcional (<=900), e o efeito liquido
//   sobre a saude estrutural do repositorio e NEGATIVO em linhas de tela: as
//   seis superficies consumidoras somadas encolheram, e nenhuma delas passou a
//   carregar logica de prioridade propria.
//
// Carregar via <script src="js/pedido-priority.js?v=..."></script> no <head>,
// DEPOIS de js/ui.js (usa el, switchToggle, modalActionBar, toast) e ANTES de
// qualquer consumidor em js/screens/.
// =====================================================================

(function (window) {
  'use strict';

  // ------------------------------------------------------------------
  // 1. Estados e rotulos
  // ------------------------------------------------------------------
  var NENHUMA = 'nenhuma';
  var SOLICITADA = 'solicitada';
  var CONFIRMADA = 'confirmada';

  var STATUS = Object.freeze({
    NENHUMA: NENHUMA,
    SOLICITADA: SOLICITADA,
    CONFIRMADA: CONFIRMADA,
  });

  var ADMIN_LABEL = Object.freeze({
    nenhuma: 'Nenhuma prioridade definida',
    solicitada: 'Prioridade solicitada pelo cliente',
    confirmada: 'Prioridade confirmada',
  });

  var CLIENTE_LABEL = Object.freeze({
    nenhuma: 'Nenhuma prioridade definida',
    solicitada: 'Prioridade solicitada',
    confirmada: 'Prioridade confirmada',
  });

  var CLIENTE_HELP = Object.freeze({
    solicitada: 'Aguardando análise e confirmação da Inttex.',
    confirmada: 'Esta sequência foi aceita pela Inttex e somente a equipe administrativa pode alterá-la.',
  });

  var BADGE_LABEL = Object.freeze({
    solicitada: 'Prioridade solicitada',
    confirmada: 'Prioridade confirmada',
  });

  // Textos binding das duas superficies de criacao.
  var ADMIN_TOGGLE_LABEL = 'Definir prioridade de produção';
  var ADMIN_TOGGLE_HELP = 'Organize os itens da maior para a menor prioridade. '
    + 'Esta sequência vale somente entre os itens deste pedido.';
  var CLIENTE_TOGGLE_LABEL = 'Solicitar prioridade de produção';
  var CLIENTE_TOGGLE_HELP = 'Organize os itens da maior para a menor prioridade. '
    + 'A sequência será analisada pela equipe da Inttex e vale somente entre os itens deste pedido.';

  var HIGHEST_LABEL = 'Maior prioridade';

  // ------------------------------------------------------------------
  // 2. Erros estaveis do banco (db/91)
  // ------------------------------------------------------------------
  var ERROS = Object.freeze({
    ADMIN_REVIEW_REQUIRED: 'PEDIDO_PRIORITY_ADMIN_REVIEW_REQUIRED',
    REVIEW_REQUIRED_BEFORE_OP: 'PEDIDO_PRIORITY_REVIEW_REQUIRED_BEFORE_OP',
    PRODUCTION_IMPACT: 'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED',
    CLIENT_LOCKED: 'PEDIDO_PRIORITY_CLIENT_LOCKED',
    DIRECT_WRITE: 'PEDIDO_PRIORITY_DIRECT_WRITE_FORBIDDEN',
    ITEM_SET_INVALID: 'PEDIDO_PRIORITY_ITEM_SET_INVALID',
    MIN_ITEMS: 'PEDIDO_PRIORITY_MIN_ITEMS',
    READ_ONLY: 'PEDIDO_PRIORITY_PEDIDO_READ_ONLY',
    FORBIDDEN: 'PEDIDO_PRIORITY_FORBIDDEN',
  });

  // PostgREST devolve a mensagem do RAISE em `message`, e as vezes tambem em
  // `details`/`hint`. Procurar o token em todos evita depender de UM campo.
  function erroContem(error, token) {
    if (!error || !token) return false;
    var campos = [error.message, error.details, error.hint, error.erro];
    for (var i = 0; i < campos.length; i++) {
      if (campos[i] && String(campos[i]).indexOf(token) !== -1) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // 3. Formatacao
  // ------------------------------------------------------------------
  // Posicao ORDINAL visivel. A posicao e 1-based na tela; `pedido_itens.ordem`
  // continua sendo 0-based no banco. A conversao mora aqui e em nenhum outro
  // lugar.
  function rankLabel(index) {
    return String((Number(index) || 0) + 1) + 'º';
  }

  function fmtMetros(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  }

  function fmtLargura(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return n.toFixed(2).replace('.', ',') + ' m';
  }

  function textoOuTraco(value) {
    if (value == null) return '—';
    var s = String(value).trim();
    return s === '' ? '—' : s;
  }

  // Resumo textual de UM item, na forma exigida pela confirmacao do Cliente:
  // posicao, modelo, cores, largura, metragem.
  function itemSummary(item, index) {
    var it = item || {};
    return {
      rank: rankLabel(index),
      modelo: textoOuTraco(it.modeloNome),
      cores: textoOuTraco(it.cores),
      largura: it.largura == null ? '—' : fmtLargura(it.largura),
      metros: fmtMetros(it.metros),
      destaque: index === 0,
    };
  }

  function itemSummaryLine(item, index) {
    var s = itemSummary(item, index);
    return s.rank + ' · ' + s.modelo + ' · ' + s.cores + ' · ' + s.largura + ' · ' + s.metros;
  }

  // ------------------------------------------------------------------
  // 4. Reordenacao determinista
  // ------------------------------------------------------------------
  // Devolve um NOVO array. Um indice fora da faixa devolve a lista inalterada,
  // entao o chamador nunca precisa checar limites antes de chamar.
  function moveItem(list, from, to) {
    var arr = (list || []).slice();
    if (!Number.isInteger(from) || !Number.isInteger(to)) return arr;
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr;
    var moved = arr.splice(from, 1)[0];
    arr.splice(to, 0, moved);
    return arr;
  }

  function moveUp(list, index) { return moveItem(list, index, index - 1); }
  function moveDown(list, index) { return moveItem(list, index, index + 1); }

  // Ordena uma colecao persistida pelo rank canonico. Desempate por id para que
  // duas leituras da MESMA linha nunca produzam duas ordens diferentes — o
  // banco nao promete ordem de retorno.
  function sortByOrdem(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var ao = Number(a && a.ordem);
      var bo = Number(b && b.ordem);
      if (!Number.isFinite(ao)) ao = Number.MAX_SAFE_INTEGER;
      if (!Number.isFinite(bo)) bo = Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a && a.id).localeCompare(String(b && b.id));
    });
  }

  // ------------------------------------------------------------------
  // 5. Predicados de permissao, derivados do estado do Pedido
  // ------------------------------------------------------------------
  function statusDe(pedido) {
    var s = pedido && pedido.prioridade_status;
    return (s === SOLICITADA || s === CONFIRMADA) ? s : NENHUMA;
  }

  function aplicavel(totalItens) {
    return Number(totalItens) >= 2;
  }

  function terminal(pedido) {
    var st = pedido && pedido.status;
    return st === 'entregue' || st === 'cancelado';
  }

  // O Cliente edita a propria solicitacao SOMENTE antes da aceitacao
  // administrativa. Este predicado espelha exatamente a trava de db/91 §7.5 —
  // ele NAO e a autoridade, e apenas a projecao dela na tela.
  function clientePodeEditar(pedido, totalItens) {
    if (!pedido || terminal(pedido)) return false;
    if (!aplicavel(totalItens)) return false;
    if (pedido.status !== 'recebido') return false;
    return statusDe(pedido) !== CONFIRMADA;
  }

  function adminPodeEditar(pedido, totalItens) {
    if (!pedido || terminal(pedido)) return false;
    return aplicavel(totalItens);
  }

  // Uma alteracao administrativa com producao ja iniciada exige confirmacao
  // explicita de impacto antes de chamar a RPC.
  function exigeConfirmacaoDeImpacto(pedido) {
    return !!pedido && pedido.status === 'produzindo';
  }

  // Uma solicitacao pendente bloqueia aceitacao e criacao de OP.
  function bloqueiaAceitacao(pedido) {
    return statusDe(pedido) === SOLICITADA;
  }

  // ------------------------------------------------------------------
  // 6. Chamada canonica da RPC
  // ------------------------------------------------------------------
  // Nenhuma tela chama `definir_prioridade_pedido` por conta propria: todas
  // passam por aqui, entao a forma dos argumentos tem um dono so.
  async function definirPrioridade(options) {
    var opts = options || {};
    var payload = {
      p_pedido_id: opts.pedidoId,
      p_item_ids: opts.habilitada ? (opts.itemIds || []) : null,
      p_habilitada: !!opts.habilitada,
      p_observacao: opts.observacao == null ? null : opts.observacao,
      p_confirmar_impacto_producao: !!opts.confirmarImpactoProducao,
    };
    try {
      var res = await window.supa.rpc('definir_prioridade_pedido', payload);
      if (res.error) return { ok: false, error: res.error };
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  // ------------------------------------------------------------------
  // 7. Superficies compartilhadas
  // ------------------------------------------------------------------
  function el() { return window.el.apply(null, arguments); }

  var SVG_UP = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
  var SVG_DOWN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  function svgEl(markup) {
    var tmp = window.document.createElement('div');
    tmp.innerHTML = markup;
    return tmp.firstElementChild;
  }

  // Botao de movimentacao. E um <button> REAL, com nome acessivel que NOMEIA O
  // ITEM afetado — "Mover Tapete X para cima" e nao "Mover para cima" —, com
  // estado desabilitado correto nas pontas e sem `outline:none`, para que o
  // anel nativo de :focus-visible continue sendo a indicacao de foco.
  function moveButton(direction, itemLabel, disabled, onclick) {
    var isUp = direction === 'up';
    var nome = (isUp ? 'Mover para cima' : 'Mover para baixo') + ': ' + itemLabel;
    var btn = el('button', {
      type: 'button',
      title: nome,
      'aria-label': nome,
      'data-pedido-priority-move': isUp ? 'up' : 'down',
      style: 'display:inline-flex; align-items:center; justify-content:center;'
        + ' width:28px; height:28px; box-sizing:border-box;'
        + ' border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius);'
        + ' background:var(--rv-surface); font-family:inherit; padding:0;'
        + ' color:' + (disabled ? 'var(--rv-text-tertiary)' : 'var(--rv-text-primary)') + ';'
        + ' cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';',
    }, svgEl(isUp ? SVG_UP : SVG_DOWN));
    if (disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', onclick);
    }
    return btn;
  }

  function rankPill(index) {
    return el('span', {
      'data-pedido-priority-rank': String(index + 1),
      style: 'display:inline-flex; align-items:center; justify-content:center;'
        + ' min-width:30px; height:22px; padding:0 7px; box-sizing:border-box;'
        + ' border-radius:var(--rv-radius); font-size:var(--rv-fs-2xs); font-weight:700;'
        + ' background:' + (index === 0 ? 'var(--rv-pill-info-bg)' : 'var(--rv-surface-subtle)') + ';'
        + ' color:' + (index === 0 ? 'var(--rv-pill-info-text)' : 'var(--rv-text-secondary)') + ';'
        + ' border:1px solid ' + (index === 0 ? 'var(--rv-pill-info-border)' : 'var(--rv-border)') + ';',
    }, rankLabel(index));
  }

  // Uma linha da sequencia. `controls` false produz a MESMA linha em modo
  // somente leitura — e por isso que o estado confirmado do Cliente mostra
  // exatamente a mesma sequencia, apenas sem controles.
  function priorityRow(item, index, total, options) {
    var opts = options || {};
    var s = itemSummary(item, index);
    var label = s.modelo;

    // `flex:1 1 160px` e o que faz o selo REALMENTE descer de linha em 390px.
    // Com apenas `min-width:0` o flexbox prefere ESMAGAR a identidade a quebrar
    // a linha, e — medido em 390px — o unico item que aparecia truncado era
    // justamente o de maior prioridade ("Tapete ..."), que e o que a sequencia
    // mais precisa deixar legivel. Com uma base minima declarada, falta espaco
    // para o selo e ele vai para a linha seguinte, em vez de o nome encolher.
    //
    // A linha de metadados QUEBRA em vez de reticenciar: espaco vertical e
    // barato aqui, e cores/largura/metragem sao o que distingue dois itens do
    // mesmo modelo. O nome mantem reticencias apenas como ultimo recurso.
    var identidade = el('div', { style: 'flex:1 1 160px; min-width:160px;' },
      el('div', {
        style: 'font-size:var(--rv-fs-value); font-weight:600; color:var(--rv-text-primary);'
          + ' overflow:hidden; text-overflow:ellipsis; white-space:nowrap;',
      }, s.modelo),
      el('div', {
        style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-tertiary); margin-top:2px;'
          + ' line-height:1.4;',
      }, s.cores + ' · ' + s.largura + ' · ' + s.metros)
    );

    // `flex-wrap` medido em 390px: sem ele o selo "Maior prioridade" disputa a
    // largura com o nome do modelo e ganha, e o item de MAIOR prioridade — o
    // unico que a sequencia realmente precisa deixar legivel — era o unico a
    // aparecer truncado ("Tapete ..."). Com wrap, o selo desce para a linha
    // seguinte quando falta espaco e o nome fica inteiro. Em 1440px nada muda:
    // sobra largura e o selo permanece na mesma linha.
    var esquerda = el('div', { style: 'display:flex; align-items:center; gap:10px; min-width:0; flex-wrap:wrap;' },
      rankPill(index),
      identidade,
      index === 0 ? el('span', {
        'data-pedido-priority-highest': '1',
        style: 'flex-shrink:0; font-size:var(--rv-fs-2xs); font-weight:700;'
          + ' color:var(--rv-pill-info-text); background:var(--rv-pill-info-bg);'
          + ' border:1px solid var(--rv-pill-info-border); border-radius:var(--rv-radius);'
          + ' padding:1px 7px; white-space:nowrap;',
      }, HIGHEST_LABEL) : null
    );

    var direita = null;
    if (opts.controls) {
      direita = el('div', { style: 'display:flex; align-items:center; gap:6px; flex-shrink:0;' },
        moveButton('up', label, index === 0, function () { opts.onMoveUp(index); }),
        moveButton('down', label, index === total - 1, function () { opts.onMoveDown(index); })
      );
    }

    return el('div', {
      'data-pedido-priority-row': String(index),
      style: 'display:flex; align-items:center; justify-content:space-between; gap:12px;'
        + ' padding:8px 12px;'
        + (index === total - 1 ? '' : ' border-bottom:1px solid var(--rv-border-soft);'),
    }, esquerda, direita);
  }

  // Lista ordenada completa. Usada pela criacao (com controles), pelo detalhe
  // (com ou sem controles) e pela confirmacao do Cliente (sem controles).
  function buildSequence(items, options) {
    var opts = options || {};
    var list = items || [];
    var wrap = el('div', {
      'data-pedido-priority-sequence': '1',
      style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius); overflow:hidden;',
    });
    for (var i = 0; i < list.length; i++) {
      wrap.appendChild(priorityRow(list[i], i, list.length, opts));
    }
    return wrap;
  }

  // Painel completo de criacao: rotulo, ajuda, interruptor e — quando ligado —
  // a sequencia com os controles de movimentacao.
  //
  //   role      'admin' | 'cliente'  (decide APENAS os textos)
  //   items     lista JA na ordem corrente
  //   enabled   estado do interruptor
  //   onToggle(checked)
  //   onReorder(novaLista)
  //
  // Abaixo de dois itens o painel inteiro nao e renderizado: a prioridade nao
  // se aplica e um interruptor desabilitado sem explicacao seria pior do que
  // sua ausencia.
  function buildCreationPanel(options) {
    var opts = options || {};
    var isAdmin = opts.role === 'admin';
    var items = opts.items || [];

    if (!aplicavel(items.length)) return null;

    var rotulo = isAdmin ? ADMIN_TOGGLE_LABEL : CLIENTE_TOGGLE_LABEL;

    // UI_VISUAL_CONTRACT §2.1 — ALINHAMENTO, regra fechada: o controle fica a
    // DIREITA e na MESMA LINHA do texto que o nomeia; um controle sozinho numa
    // linha, alinhado a esquerda dentro de um cartao, e defeito.
    //
    // O primitivo canonico `switchToggle()` monta `.rv-switch-field`, que
    // css/tokens.css declara `display:block` — ou seja, ele EMPILHA rotulo
    // sobre controle. Reescrever esse container aqui seria um chamador
    // restilizando o dono compartilhado, exatamente o que §2.3 proibe. Entao a
    // LINHA e montada aqui e o primitivo recebe apenas o portador de estado ja
    // NOMEADO (`ariaLabel`), sem rotulo visivel proprio: o dono continua dono
    // da sua geometria, e o rotulo visivel passa a ser o texto desta linha.
    var box = window.checkboxInput({
      checked: !!opts.enabled,
      ariaLabel: rotulo,
      collapsed: true,
      onchange: function (ev) {
        opts.onToggle(!!(ev && ev.target && ev.target.checked));
      },
    });
    var toggle = window.switchToggle({ input: box });
    toggle.setAttribute('data-pedido-priority-toggle', isAdmin ? 'admin' : 'cliente');

    var linhaControle = el('div', {
      'data-pedido-priority-toggle-row': '1',
      style: 'display:flex; align-items:center; justify-content:space-between;'
        + ' gap:8px; flex-wrap:wrap;',
    },
      el('div', {
        style: 'font-size:var(--rv-fs-xs); font-weight:600;'
          + ' color:var(--rv-text-secondary); min-width:0;',
      }, rotulo),
      toggle
    );

    var panel = el('div', {
      'data-pedido-priority-panel': isAdmin ? 'admin' : 'cliente',
      style: 'border:1px solid var(--rv-border); border-radius:var(--rv-radius);'
        + ' background:var(--rv-surface-subtle); padding:12px 14px; margin-top:12px;',
    },
      linhaControle,
      el('div', {
        style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-tertiary);'
          + ' line-height:1.45; margin-top:6px; max-width:720px;',
      }, isAdmin ? ADMIN_TOGGLE_HELP : CLIENTE_TOGGLE_HELP)
    );

    if (opts.enabled) {
      panel.appendChild(el('div', { style: 'margin-top:10px;' },
        buildSequence(items, {
          controls: true,
          onMoveUp: function (i) { opts.onReorder(moveUp(items, i)); },
          onMoveDown: function (i) { opts.onReorder(moveDown(items, i)); },
        })
      ));
    }

    return panel;
  }

  // Badge discreto das listas. `nenhuma` NAO produz badge algum — a ausencia de
  // prioridade nao e uma informacao que mereca ocupar espaco em cada linha.
  function buildBadge(pedido) {
    var st = statusDe(pedido);
    if (st === NENHUMA) return null;
    var confirmada = st === CONFIRMADA;
    return el('span', {
      'data-pedido-priority-badge': st,
      title: BADGE_LABEL[st],
      style: 'display:inline-flex; align-items:center; margin-top:3px;'
        + ' font-size:var(--rv-fs-micro); font-weight:700; white-space:nowrap;'
        + ' border-radius:var(--rv-radius); padding:1px 6px;'
        + (confirmada
          ? ' background:var(--rv-pill-info-bg); color:var(--rv-pill-info-text); border:1px solid var(--rv-pill-info-border);'
          : ' background:var(--rv-signal-caution-bg); color:var(--rv-signal-caution); border:1px solid var(--rv-signal-caution);'),
    }, BADGE_LABEL[st]);
  }

  // ------------------------------------------------------------------
  // 8. Modais
  // ------------------------------------------------------------------
  // Modal proprio, e nao window.modal(), porque as duas confirmacoes de
  // finalizacao do Cliente exigem DOIS rotulos proprios ("Voltar e revisar" /
  // "Enviar pedido"), e o modal generico so parametriza o rotulo da acao
  // primaria. A geometria continua canonica: camada em var(--rv-z-modal) e
  // rodape por window.modalActionBar().
  function openTwoActionModal(options) {
    var opts = options || {};
    var overlay = el('div', {
      'data-pedido-priority-modal': opts.marker || '1',
      style: 'position:fixed; inset:0; background:var(--rv-overlay-scrim);'
        + ' display:flex; align-items:center; justify-content:center;'
        + ' padding:16px; z-index:var(--rv-z-modal);',
    });

    function close() {
      overlay.remove();
      window.document.removeEventListener('keydown', onKeydown);
    }
    function onKeydown(e) { if (e.key === 'Escape') close(); }
    window.document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var secundario = el('button', {
      type: 'button',
      'data-pedido-priority-modal-secondary': '1',
      style: 'background:var(--rv-surface); color:var(--rv-text-primary);'
        + ' border:1px solid var(--rv-border-strong); border-radius:var(--rv-radius);'
        + ' height:var(--rv-h-default); padding:0 18px; display:inline-flex;'
        + ' align-items:center; justify-content:center; font-weight:600;'
        + ' font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
      onclick: function () {
        close();
        if (typeof opts.onSecondary === 'function') opts.onSecondary();
      },
    }, opts.secondaryLabel);

    var primario = el('button', {
      type: 'button',
      'data-pedido-priority-modal-primary': '1',
      style: 'background:var(--rv-brand); color:var(--rv-text-on-brand);'
        + ' border:none; border-radius:var(--rv-radius);'
        + ' height:var(--rv-h-primary); padding:0 20px; display:inline-flex;'
        + ' align-items:center; justify-content:center; font-weight:700;'
        + ' font-size:var(--rv-fs-body); font-family:inherit; cursor:pointer;',
      onclick: function () {
        close();
        if (typeof opts.onPrimary === 'function') opts.onPrimary();
      },
    }, opts.primaryLabel);

    var header = el('div', {
      style: 'padding:14px 20px; border-bottom:1px solid var(--rv-border-soft);',
    },
      el('div', {
        style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);',
      }, opts.title),
      el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); margin-top:4px; line-height:1.5;',
      }, opts.message)
    );

    var body = el('div', {
      style: 'padding:14px 20px; display:flex; flex-direction:column; gap:12px;'
        + ' overflow-y:auto; flex:1; min-height:0;',
    });
    if (opts.body) body.appendChild(opts.body);

    var card = el('div', {
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border);'
        + ' border-radius:var(--rv-radius); width:520px; max-width:100%; max-height:90vh;'
        + ' box-shadow:var(--rv-shadow-popover); overflow:hidden;'
        + ' display:flex; flex-direction:column;',
    }, header, body, window.modalActionBar([secundario, primario]));

    overlay.appendChild(card);
    window.document.body.appendChild(overlay);
    return { close: close };
  }

  // Confirmacao de finalizacao COM prioridade. Nada e salvo aqui: o modal so
  // decide, e quem persiste e a tela.
  function openClienteConfirmacaoComPrioridade(options) {
    var opts = options || {};
    return openTwoActionModal({
      marker: 'cliente-com-prioridade',
      title: 'Confirmar ordem de prioridade',
      message: 'A sequência abaixo representa sua preferência de produção. '
        + 'Ela será analisada e confirmada pela equipe da Inttex.',
      body: buildSequence(opts.items || [], { controls: false }),
      secondaryLabel: 'Voltar e revisar',
      primaryLabel: 'Enviar pedido',
      onSecondary: opts.onVoltar,
      onPrimary: opts.onEnviar,
    });
  }

  // Confirmacao de finalizacao SEM prioridade. "Definir prioridade" fecha a
  // confirmacao e devolve o foco ao controle de prioridade.
  function openClienteConfirmacaoSemPrioridade(options) {
    var opts = options || {};
    return openTwoActionModal({
      marker: 'cliente-sem-prioridade',
      title: 'Enviar sem prioridade definida?',
      message: 'Nenhuma prioridade foi informada entre os itens. '
        + 'A sequência de produção poderá ser definida pela equipe da Inttex.',
      secondaryLabel: 'Definir prioridade',
      primaryLabel: 'Enviar sem prioridade',
      onSecondary: opts.onDefinir,
      onPrimary: opts.onEnviar,
    });
  }

  // Confirmacao de impacto com producao ja iniciada. O texto e binding.
  function openImpactoProducao(options) {
    var opts = options || {};
    return openTwoActionModal({
      marker: 'impacto-producao',
      title: 'Alterar prioridade com produção iniciada',
      message: 'A produção deste Pedido já foi iniciada. Alterar a prioridade '
        + 'pode afetar o planejamento atual. Confirma a mudança?',
      secondaryLabel: 'Cancelar',
      primaryLabel: 'Confirmar alteração',
      onSecondary: opts.onCancelar,
      onPrimary: opts.onConfirmar,
    });
  }

  // Editor de sequencia usado pelo detalhe (Admin e Cliente). Reaproveita
  // exatamente os mesmos controles da criacao.
  function openSequenceEditor(options) {
    var opts = options || {};
    var atual = (opts.items || []).slice();
    var host = el('div', {});

    function paint() {
      host.replaceChildren(buildSequence(atual, {
        controls: true,
        onMoveUp: function (i) { atual = moveUp(atual, i); paint(); },
        onMoveDown: function (i) { atual = moveDown(atual, i); paint(); },
      }));
    }
    paint();

    return openTwoActionModal({
      marker: 'sequence-editor',
      title: opts.title || 'Definir prioridade de produção',
      message: opts.message || ADMIN_TOGGLE_HELP,
      body: host,
      secondaryLabel: 'Cancelar',
      primaryLabel: opts.primaryLabel || 'Salvar sequência',
      onPrimary: function () { opts.onConfirm(atual); },
      onSecondary: opts.onCancel,
    });
  }

  // ------------------------------------------------------------------
  // 9. Fachada das DUAS telas de criacao
  // ------------------------------------------------------------------
  // POR QUE A FACHADA EXISTE
  //   `js/screens/pedido-form.js` esta no TETO da faixa excepcional de
  //   CODE_HEALTH_RULES.md sec.7 (900 linhas). O precedente daquele arquivo e
  //   explicito — a linha de item (BATCH-02) e o modal detalhado
  //   (DUAL-ITEM-ENTRY) foram EXTRAIDOS em vez de absorvidos, justamente para
  //   nao estourar a faixa. Esta ordem segue o mesmo caminho: a projecao dos
  //   itens, a reordenacao, o estado do interruptor, a chamada da RPC e a
  //   compensacao vivem AQUI, e cada tela de criacao gasta duas linhas.
  //
  //   O beneficio nao e so de tamanho: as duas telas de criacao passam a ter
  //   UMA implementacao de prioridade, e nao duas parecidas.
  //
  // ONDE MORA O ESTADO
  //   `state.prioridadeHabilitada` e criado aqui, sob demanda, no proprio
  //   objeto de estado da tela. A tela nao precisa declarar o campo, e a
  //   ORDEM de `state.itens` continua sendo a sequencia — nao existe rank
  //   paralelo a manter em lugar nenhum.

  // Nome da cor tolerando as DUAS formas que as telas carregam: o objeto
  // embutido (`modelo.cor_1`) do formulario admin e o id mais o mapa
  // (`coresById`) do formulario de cliente.
  function corDoModelo(modelo, campoObjeto, campoId, coresById) {
    if (!modelo) return null;
    var obj = modelo[campoObjeto];
    if (obj && obj.nome) return obj.nome;
    var id = modelo[campoId];
    var cor = (id != null && coresById) ? coresById[id] : null;
    return cor && cor.nome ? cor.nome : null;
  }

  function projetarItemLocal(item, ctx) {
    var c = ctx || {};
    var modelos = c.modelos || [];
    var modelo = null;
    for (var i = 0; i < modelos.length; i++) {
      if (String(modelos[i].id) === String(item.modeloId)) { modelo = modelos[i]; break; }
    }
    var n1 = corDoModelo(modelo, 'cor_1', 'cor_1_id', c.coresById);
    var n2 = corDoModelo(modelo, 'cor_2', 'cor_2_id', c.coresById);
    return {
      uid: item.uid,
      modeloNome: modelo ? modelo.nome : 'Item sem modelo',
      cores: n2 ? (n1 + ' / ' + n2) : n1,
      largura: modelo ? modelo.largura : null,
      metros: item.metros,
    };
  }

  function projetarItensLocais(state, ctx) {
    return (state.itens || []).map(function (item) { return projetarItemLocal(item, ctx); });
  }

  // Painel de criacao pronto para as duas telas. Devolve `null` abaixo de dois
  // itens — e nesse caso tambem DESLIGA o interruptor, para que remover um item
  // nao deixe uma prioridade ligada e invisivel pendurada no estado.
  function painelDeCriacao(state, role, ctx, onRender) {
    if (!state) return null;
    if (state.prioridadeHabilitada == null) state.prioridadeHabilitada = false;
    if (!aplicavel((state.itens || []).length)) {
      state.prioridadeHabilitada = false;
      return null;
    }
    var projetados = projetarItensLocais(state, ctx);
    return buildCreationPanel({
      role: role,
      items: projetados,
      enabled: state.prioridadeHabilitada,
      onToggle: function (checked) {
        state.prioridadeHabilitada = checked;
        onRender();
      },
      // A projecao devolvida carrega o `uid`, que e a identidade que liga a
      // sequencia exibida de volta aos itens locais reais.
      onReorder: function (novaProjecao) {
        var porUid = {};
        (state.itens || []).forEach(function (item) { porUid[item.uid] = item; });
        var reordenados = [];
        novaProjecao.forEach(function (p) { if (porUid[p.uid]) reordenados.push(porUid[p.uid]); });
        if (reordenados.length === (state.itens || []).length) state.itens = reordenados;
        onRender();
      },
    });
  }

  // Persistencia da prioridade LOGO APOS a criacao do Pedido e dos itens.
  //
  // Devolve `true` quando nao ha nada a fazer OU quando a prioridade foi
  // gravada; devolve `false` depois de JA TER COMPENSADO, para que a tela
  // apenas pare. Um Pedido nunca fica salvo sem a prioridade que o operador
  // selecionou: ou os dois existem, ou nenhum dos dois.
  //
  // `itensInseridos` sao as linhas devolvidas pelo INSERT, com `ordem`. A
  // sequencia sai de `ordem`, e NUNCA da ordem em que o banco devolveu as
  // linhas — que nada promete.
  async function persistirNaCriacao(state, pedidoId, itensInseridos, pedidoNumero) {
    if (!state || !state.prioridadeHabilitada) return true;
    if (!aplicavel((state.itens || []).length)) return true;

    var ordenados = sortByOrdem(itensInseridos || []);
    var res = await definirPrioridade({
      pedidoId: pedidoId,
      itemIds: ordenados.map(function (row) { return row.id; }),
      habilitada: true,
    });
    if (res.ok) return true;

    console.error('pedido-priority: falha ao persistir a prioridade, compensando', res.error);
    var del = { error: null };
    try {
      del = await window.supa.from('pedidos').delete().eq('id', pedidoId);
    } catch (e) {
      del = { error: e };
    }
    if (del.error) {
      window.toast('Erro grave: pedido #' + pedidoNumero
        + ' criado sem a prioridade selecionada e nao compensado. Contate o suporte.', 'error');
      console.error('pedido-priority: compensacao falhou', del.error);
    } else {
      window.toast('Erro ao salvar a prioridade. Pedido cancelado. Tente novamente.', 'error');
    }
    return false;
  }

  // ------------------------------------------------------------------
  // 10. Bloco somente leitura para detalhe e OP
  // ------------------------------------------------------------------
  // `nenhuma` NAO renderiza bloco vazio: um cartao "Nenhuma prioridade" numa
  // OP seria ruido permanente. O detalhe passa `alwaysRender` porque ali a
  // ausencia de prioridade E uma informacao acionavel.
  function buildSummaryBlock(options) {
    var opts = options || {};
    var pedido = opts.pedido;
    var st = statusDe(pedido);
    if (st === NENHUMA && !opts.alwaysRender) return null;

    var isCliente = opts.role === 'cliente';
    var titulo = isCliente ? CLIENTE_LABEL[st] : ADMIN_LABEL[st];
    var ajuda = isCliente ? CLIENTE_HELP[st] : null;

    // UI_VISUAL_CONTRACT §2.1: dentro de um cartao as acoes vao num RODAPE DE
    // BLOCO alinhado a direita, com `border-top: 1px solid var(--rv-border-soft)`
    // e `padding-top: 11px` — nao no cabecalho. O padrao "texto a esquerda,
    // acao a direita na mesma linha" e o do cartao em ESTADO VAZIO, e e o que
    // este bloco usa quando nao ha sequencia a listar.
    var vazio = st === NENHUMA;
    var temAcoes = !!(opts.actions && opts.actions.length);

    var tituloBloco = el('div', { style: 'min-width:0;' },
      el('div', {
        'data-pedido-priority-state': st,
        style: 'font-size:var(--rv-fs-component-heading); font-weight:700; color:var(--rv-text-primary);',
      }, titulo),
      ajuda ? el('div', {
        style: 'font-size:var(--rv-fs-body); color:var(--rv-text-tertiary); margin-top:4px; line-height:1.5;',
      }, ajuda) : null
    );

    function barraDeAcoes(rodape) {
      return el('div', {
        'data-card-actions': '',
        style: 'display:flex; align-items:center; justify-content:flex-end;'
          + ' gap:8px; flex-wrap:wrap;'
          + (rodape ? ' border-top:1px solid var(--rv-border-soft); padding-top:11px; margin-top:12px;' : ' flex-shrink:0;'),
      }, opts.actions);
    }

    // Estado vazio: texto a esquerda, acao a direita, MESMA LINHA.
    var head = vazio
      ? el('div', {
          style: 'display:flex; align-items:center; justify-content:space-between;'
            + ' gap:12px; flex-wrap:wrap;',
        }, tituloBloco, temAcoes ? barraDeAcoes(false) : null)
      : el('div', { style: 'margin-bottom:10px;' }, tituloBloco);

    var card = el('div', {
      'data-pedido-priority-summary': opts.role || 'admin',
      style: 'background:var(--rv-surface); border:1px solid var(--rv-border);'
        + ' border-radius:var(--rv-radius); box-shadow:var(--rv-shadow-none);'
        + ' padding:16px; margin-bottom:14px;',
    }, head);

    if (!vazio) {
      card.appendChild(buildSequence(opts.items || [], { controls: false }));
      if (pedido && pedido.prioridade_observacao) {
        card.appendChild(el('div', {
          style: 'font-size:var(--rv-fs-2xs); color:var(--rv-text-secondary); margin-top:9px; line-height:1.5;',
        }, 'Observação: ' + String(pedido.prioridade_observacao)));
      }
      if (temAcoes) card.appendChild(barraDeAcoes(true));
    }

    return card;
  }

  window.RAVATEX_PEDIDO_PRIORITY = {
    STATUS: STATUS,
    ERROS: ERROS,
    ADMIN_LABEL: ADMIN_LABEL,
    CLIENTE_LABEL: CLIENTE_LABEL,
    CLIENTE_HELP: CLIENTE_HELP,
    BADGE_LABEL: BADGE_LABEL,
    ADMIN_TOGGLE_LABEL: ADMIN_TOGGLE_LABEL,
    ADMIN_TOGGLE_HELP: ADMIN_TOGGLE_HELP,
    CLIENTE_TOGGLE_LABEL: CLIENTE_TOGGLE_LABEL,
    CLIENTE_TOGGLE_HELP: CLIENTE_TOGGLE_HELP,
    HIGHEST_LABEL: HIGHEST_LABEL,
    erroContem: erroContem,
    rankLabel: rankLabel,
    itemSummary: itemSummary,
    itemSummaryLine: itemSummaryLine,
    moveItem: moveItem,
    moveUp: moveUp,
    moveDown: moveDown,
    sortByOrdem: sortByOrdem,
    statusDe: statusDe,
    aplicavel: aplicavel,
    clientePodeEditar: clientePodeEditar,
    adminPodeEditar: adminPodeEditar,
    exigeConfirmacaoDeImpacto: exigeConfirmacaoDeImpacto,
    bloqueiaAceitacao: bloqueiaAceitacao,
    definirPrioridade: definirPrioridade,
    buildCreationPanel: buildCreationPanel,
    painelDeCriacao: painelDeCriacao,
    persistirNaCriacao: persistirNaCriacao,
    projetarItensLocais: projetarItensLocais,
    buildSequence: buildSequence,
    buildBadge: buildBadge,
    buildSummaryBlock: buildSummaryBlock,
    openClienteConfirmacaoComPrioridade: openClienteConfirmacaoComPrioridade,
    openClienteConfirmacaoSemPrioridade: openClienteConfirmacaoSemPrioridade,
    openImpactoProducao: openImpactoProducao,
    openSequenceEditor: openSequenceEditor,
  };
})(window);
