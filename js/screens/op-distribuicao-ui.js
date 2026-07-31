// =====================================================================
// === SCREENS: OP DISTRIBUICAO UI (shared builder) ====================
// Builder ÚNICO da "distribuição de metros" da OP de Tecelagem,
// consumido por DUAS telas (uma implementação, zero duplicação —
// YARN-BUTTONS-FINAL-CONTRACT):
//   - Tela da OP (js/screens/op-nova.js) — bloco de insumos + rail.
//   - Painel do Pedido (js/screens/pedido-detail-events.js) — hub de
//     controle, onde a movimentação/produção é operada.
//
// DONO ÚNICO E COMPARTILHADO (NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A).
// Este arquivo é o único dono de:
//   - disponibilidade (projeção nativa oc_disponibilidade_op);
//   - construção dos sliders;
//   - quantidades ajustadas;
//   - validação contra o teto por eixo;
//   - tratamento de revisão (ops.ajuste_revisao) e do conflito;
//   - salvamento atômico (salvar_ajuste_producao_op);
//   - início de produção (iniciar_producao_op).
// O futuro painel de produção do Pedido CONSOME este dono; não pode
// reimplementar slider, validação, revisão nem início de produção.
//
// CONTRATO (ambas as telas consomem estes builders, sem reimplementar):
//   - buildDistribuicaoBlock(): sliders + consumo + rodapé com
//     EXATAMENTE dois botões — "Manter pedido" e "Salvar distribuição".
//     Ambos SÓ persistem a distribuição (window.salvarDistribuicaoOP);
//     NENHUM inicia produção, muda status ou grava saldo. "Aceitar
//     proposta" não existe.
//   - buildIniciarProducaoButton(): ÚNICO ponto de início de produção
//     (window.iniciarProducaoOP). Habilita só quando a OP está ABERTA e
//     existe ajuste completo salvo; senão desabilitado com title
//     explicativo. Uma OP 'simulada' NUNCA é aberta em silêncio.
//
// P2-A: NENHUM teto, validação, salvamento ou início lê `ordens_compra_fio`.
// O teto vem de ctx.disponibilidade (oc_disponibilidade_op) e o servidor
// revalida tudo dentro do lock — o que se faz aqui é capar e explicar.
//
// Carregar DEPOIS de op-recalculo.js (usa salvar/iniciarProducaoOP) e
// ANTES de op-nova.js. pedido-detail-events.js chama em runtime.
// Dependências resolvidas em call-time via window: el, toast, svgEl,
// fmtMetros, fmtKg, rotuloModelo, calcularFiosOP, maxMetrosItem,
// salvarDistribuicaoOP, iniciarProducaoOP.
// =====================================================================

(function (window) {
  'use strict';

  function fn(name, fallback) {
    return typeof window[name] === 'function' ? window[name] : fallback;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  // Revisão-base do ajuste. db/102 declara ops.ajuste_revisao NOT NULL
  // DEFAULT 0 e afirma que toda OP pré-existente começa em 0, então a
  // ausência do campo numa projeção que ainda não o seleciona significa 0 —
  // não "desconhecido". Se a OP tiver avançado, o servidor recusa com
  // AJUSTE_REVISAO_DESATUALIZADA e a tela mostra o estado de conflito, que é
  // exatamente o comportamento honesto.
  function baseAjusteRevisaoDe(ctx) {
    if (ctx && ctx.ajusteRevisao != null) return Number(ctx.ajusteRevisao);
    if (ctx && ctx.op && ctx.op.ajuste_revisao != null) return Number(ctx.op.ajuste_revisao);
    return 0;
  }

  // Distribuição salva = op_itens.metros_ajustados de TODOS os itens.
  // Retorna { [op_item_id]: metros } ou null se algum item ainda não
  // tem metros_ajustados (nada salvo / ajuste incompleto).
  function distribuicaoSalva(opItens) {
    if (!opItens || !opItens.length) return null;
    var acc = {};
    for (var i = 0; i < opItens.length; i++) {
      var it = opItens[i];
      if (it.metros_ajustados == null) return null;
      acc[it.id] = Math.round(Number(it.metros_ajustados));
    }
    return acc;
  }

  // Consumo de fio por EIXO NATIVO (material + cor), a partir da receita.
  // Reaproveita calcularFiosOP — a mesma matemática de sempre — e mapeia o
  // resultado sobre as linhas de oc_disponibilidade_op.
  function consumoPorEixo(metrosMap, opItens, modelosById, parametrosByLargura) {
    var calcularFiosOP = window.calcularFiosOP;
    if (typeof calcularFiosOP !== 'function') return null;
    var itensFmt = (opItens || []).map(function (i) {
      return { modeloId: i.modelo_id, metros: (metrosMap && metrosMap[i.id]) || 0 };
    });
    try { return calcularFiosOP(itensFmt, modelosById, parametrosByLargura); }
    catch (e) { return null; }
  }

  function kgConsumidoNoEixo(calc, eixo) {
    if (!calc) return 0;
    if (eixo.material === 'algodao') {
      var row = calc.algodaoPorCor[eixo.cor_id] || calc.algodaoPorCor[String(eixo.cor_id)];
      return row ? Number(row.kg) : 0;
    }
    return Number(calc.poliester[eixo.cor_poliester] || 0);
  }

  function rotuloEixo(eixo) {
    if (eixo.material === 'algodao') return 'Algodão — ' + (eixo.cor_nome || ('cor ' + eixo.cor_id));
    return 'Poliéster — ' + eixo.cor_poliester;
  }

  // Avalia uma distribuição contra o teto nativo. Sem disponibilidade
  // carregada não se INVENTA excesso: `algumExcede` fica false e quem valida
  // é o servidor no salvamento (que é o dono do teto de qualquer forma).
  function avaliarDistribuicao(metrosMap, opItens, modelosById, parametrosByLargura, disponibilidade) {
    var eixos = disponibilidade || [];
    var calc = consumoPorEixo(metrosMap, opItens, modelosById, parametrosByLargura);
    var linhas = eixos.map(function (d) {
      var consumido = kgConsumidoNoEixo(calc, d);
      var teto = Number(d.kg_disponivel);
      return {
        eixo: d,
        rotulo: rotuloEixo(d),
        kg_consumido: round3(consumido),
        kg_disponivel: round3(teto),
        sobra: round3(teto - consumido),
      };
    });
    return {
      linhas: linhas,
      algumExcede: linhas.some(function (l) { return l.sobra < 0; }),
      temDisponibilidade: eixos.length > 0,
    };
  }

  // Proposta proporcional a partir do TETO NATIVO (antes vinha de
  // recalcularOP sobre kg_pedido/kg_recebido de ordens_compra_fio). O eixo
  // mais escasso define o fator; sem disponibilidade o fator é 1 e a proposta
  // é a própria metragem do pedido.
  function propostaProporcional(opItens, modelosById, parametrosByLargura, disponibilidade) {
    var pedidoMap = {};
    (opItens || []).forEach(function (i) { pedidoMap[i.id] = Number(i.metros_pedidos); });
    var calc = consumoPorEixo(pedidoMap, opItens, modelosById, parametrosByLargura);
    var fator = Infinity;
    (disponibilidade || []).forEach(function (d) {
      var necessario = kgConsumidoNoEixo(calc, d);
      if (!(necessario > 0)) return;
      var ratio = Number(d.kg_disponivel) / necessario;
      if (ratio < fator) fator = ratio;
    });
    if (!Number.isFinite(fator)) fator = 1;
    var itens = {};
    (opItens || []).forEach(function (i) {
      itens[i.id] = round2(Number(i.metros_pedidos) * fator);
    });
    return { fator: fator, itens: itens };
  }

  // Estado da ação "Iniciar produção" para uma OP. Fonte de verdade =
  // ops.status + op_itens.metros_ajustados já persistido (não sliders ao
  // vivo). §9.9.D: começar produção exige uma OP JÁ ABERTA — abrir uma OP
  // simulada continua sendo ação explícita do operador, e esta tela não a
  // abre em silêncio.
  function iniciarProducaoState(opItens, op, disponibilidade, modelosById, parametrosByLargura) {
    var status = (op && op.status) || null;
    var aberta = status === 'aberta';
    var saved = distribuicaoSalva(opItens);
    var info = saved
      ? avaliarDistribuicao(saved, opItens, modelosById, parametrosByLargura, disponibilidade)
      : { algumExcede: false };
    var habilitado = aberta && saved != null && !info.algumExcede;
    var motivo = '';
    if (status === 'simulada') motivo = 'A OP ainda está simulada — abra a OP antes de iniciar a produção.';
    else if (!aberta) motivo = 'A produção só pode ser iniciada com a OP aberta.';
    else if (!saved) motivo = 'Salve a distribuição de todos os itens antes de iniciar a produção.';
    else if (info.algumExcede) motivo = 'Algum fio excede o disponível — ajuste e salve a distribuição.';
    return {
      habilitado: habilitado,
      motivo: motivo,
      aberta: aberta,
      temDistribuicaoSalva: saved != null,
    };
  }

  // Estado de CONFLITO DE REVISÃO, canônico e compartilhado. Aparece quando o
  // servidor recusa com AJUSTE_REVISAO_DESATUALIZADA: outra sessão salvou um
  // ajuste sobre a mesma OP. Nunca há retry automático nem merge — o operador
  // recarrega explicitamente, e Salvar fica travado até um recarregamento
  // COMPLETO e bem-sucedido.
  function buildConflitoRevisao(onRecarregar) {
    var el = window.el;
    var box = el('div', {
      role: 'alert',
      'aria-live': 'assertive',
      style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;box-sizing:border-box;'
        + 'color:var(--rv-signal-caution);background:var(--rv-signal-caution-bg);'
        + 'border:1px solid var(--rv-signal-caution-border);border-radius:var(--rv-radius);'
        + 'padding:11px 14px;font-size:var(--rv-fs-sm);font-weight:700;line-height:1.45;margin-bottom:14px;',
    }, el('span', { style: 'flex:1;min-width:200px;' },
      'Esta OP foi ajustada em outra sessão. Nada foi gravado. '
      + 'Recarregue os dados para continuar a partir do ajuste atual.'));
    if (typeof onRecarregar === 'function') {
      box.appendChild(el('button', {
        type: 'button',
        style: 'display:inline-flex;align-items:center;gap:6px;background:var(--rv-surface);'
          + 'color:var(--rv-signal-caution);border:1px solid var(--rv-signal-caution-border);'
          + 'border-radius:var(--rv-radius);padding:0 14px;min-height:var(--rv-h-compact);'
          + 'font-weight:700;font-size:var(--rv-fs-sm);font-family:inherit;cursor:pointer;',
        onclick: function () { onRecarregar(); },
      }, 'Recarregar dados'));
    }
    return box;
  }

  // Botão primário "Iniciar produção" — ÚNICO ponto de início de
  // produção em qualquer tela. ctx: { op, opItens, disponibilidade,
  // ajusteRevisao, modelosById, parametrosByLargura, styleEnabled,
  // styleDisabled, onIniciado }.
  function buildIniciarProducaoButton(ctx) {
    var el = window.el;
    var st = iniciarProducaoState(ctx.opItens, ctx.op, ctx.disponibilidade, ctx.modelosById, ctx.parametrosByLargura);
    var habilitado = st.habilitado;
    var btn = el('button', {
      type: 'button',
      style: habilitado ? ctx.styleEnabled : ctx.styleDisabled,
    }, 'Iniciar produção');
    btn.disabled = !habilitado;
    if (!habilitado && st.motivo) btn.setAttribute('title', st.motivo);
    if (habilitado) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
          var res = await window.iniciarProducaoOP({
            opId: ctx.op.id,
            baseAjusteRevisao: baseAjusteRevisaoDe(ctx),
          });
          if (res && res.error) {
            var mensagens = {
              AJUSTE_REVISAO_DESATUALIZADA: 'A OP foi ajustada em outra sessão — recarregue os dados e tente de novo',
              INICIO_OP_ESTADO_INVALIDO: 'A produção só pode ser iniciada com a OP aberta',
              INICIO_AJUSTE_INCOMPLETO: 'Há itens sem ajuste salvo — salve a distribuição completa antes',
              AJUSTE_EXCEDE_DISPONIVEL: 'O ajuste salvo excede o fio disponível — revise a distribuição',
              concorrencia_ocupada: 'Outra operação está em curso nesta OP — tente novamente em instantes',
              PEDIDO_CANCELADO: 'O Pedido foi cancelado — a produção não pode ser iniciada',
              sem_permissao: 'Sem permissão para iniciar a produção desta OP',
            };
            window.toast(mensagens[res.codigo] || 'Erro ao iniciar produção', 'error');
            console.error(res.error, res.codigo);
            btn.disabled = false;
            return;
          }
          // A rota e o rótulo da continuação vêm do SERVIDOR (proxima_acao);
          // a tela não inventa destino.
          window.toast('Produção iniciada', 'success');
          if (typeof ctx.onIniciado === 'function') await ctx.onIniciado(res && res.proximaAcao);
        } catch (e) {
          window.toast('Erro ao iniciar produção', 'error');
          console.error(e);
          btn.disabled = false;
        }
      });
    }
    return btn;
  }

  // Bloco de distribuição: sliders + consumo de fio + rodapé
  // [Voltar à proposta] [Limpar ajuste] · [Manter pedido] [Salvar distribuição].
  // AMBOS os botões do rodapé só persistem (save-only); nenhum inicia
  // produção. ctx: { op, opItens, disponibilidade, ajusteRevisao,
  // modelosById, parametrosByLargura, variant('full'|'compact'), onSaved,
  // onRecarregar }.
  function buildDistribuicaoBlock(ctx) {
    var el = window.el;
    var svgEl = window.svgEl;
    var fmtMetros = fn('fmtMetros', function (n) { return String(n); });
    var fmtKg = fn('fmtKg', function (n) { return String(n); });
    var rotuloModelo = fn('rotuloModelo', function (m) { return (m && m.nome) || 'Modelo'; });
    var toast = fn('toast', function () {});
    var opItens = ctx.opItens || [];
    var disponibilidade = ctx.disponibilidade || [];
    var modelosById = ctx.modelosById || {};
    var parametrosByLargura = ctx.parametrosByLargura || {};
    var compact = ctx.variant === 'compact';
    var baseRevisao = baseAjusteRevisaoDe(ctx);

    var itensCalc = opItens.map(function (i) {
      return { op_item_id: i.id, modelo_id: i.modelo_id, metros_pedidos: Number(i.metros_pedidos) };
    });

    var proposta = propostaProporcional(opItens, modelosById, parametrosByLargura, disponibilidade);

    // Snapshot da distribuição salva (fixo neste render; fonte =
    // op_itens.metros_ajustados). Sliders default = salvo ou proposta.
    var savedSnapshot = distribuicaoSalva(opItens);
    var metrosOverride = {};
    itensCalc.forEach(function (c) {
      metrosOverride[c.op_item_id] = (savedSnapshot && savedSnapshot[c.op_item_id] != null)
        ? savedSnapshot[c.op_item_id]
        : Math.round(proposta.itens[c.op_item_id] || 0);
    });
    // Distribuição "manter pedido" = metragem original do pedido.
    var pedidoMap = {};
    itensCalc.forEach(function (c) { pedidoMap[c.op_item_id] = Math.round(c.metros_pedidos); });

    // Conflito de revisão: enquanto ligado, Salvar fica travado. Só um
    // recarregamento COMPLETO e bem-sucedido o desliga (o chamador re-renderiza
    // este bloco com a revisão nova).
    var conflitoRevisao = false;

    function distribuicaoAtual() {
      var cur = {};
      for (var k in metrosOverride) cur[k] = Math.round(metrosOverride[k] || 0);
      return cur;
    }
    function metrosIguais(a, b) {
      if (!a || !b) return false;
      for (var k in metrosOverride) {
        if (Math.round(a[k] || 0) !== Math.round(b[k] || 0)) return false;
      }
      return true;
    }

    var wrap = el('div', {
      style: compact
        ? 'border:1px solid var(--rv-pill-info-border);border-radius:4px;background:var(--rv-surface-subtle);padding:12px 14px;margin-top:10px;'
        : 'border-top:2px solid var(--rv-border);padding:18px 24px 0;',
    });

    var conflitoBox = el('div', {});
    wrap.appendChild(conflitoBox);

    wrap.appendChild(el('div', { style: 'font-size:13px;color:var(--rv-text-primary);margin-bottom:2px;' },
      el('strong', {}, 'Fator proporcional (fio mais escasso): '),
      Number(proposta.fator).toFixed(2).replace('.', ',')));
    wrap.appendChild(el('div', { style: 'font-size:12px;color:var(--rv-text-tertiary);margin-bottom:18px;' },
      'Arraste os sliders para redistribuir os metros entre os modelos. O consumo de fio é recalculado ao vivo. ' +
      'Salve a distribuição aqui; depois use "Iniciar produção". Salvar apenas persiste — nunca inicia produção.'));

    // Sliders por item --------------------------------------------------
    var sliders = el('div', {});
    var itemRowState = {};

    // B1: the slider's TRACK AND THUMB GEOMETRY moved to the canonical range
    // primitive (css/tokens.css). What stays here is the PROGRESS FILL, which
    // is runtime state rather than geometry: it is recomputed on every input
    // event from the live value. It is now assigned to `style.background`
    // alone, so it can no longer overwrite the shared geometry the way the
    // previous whole-`style`-attribute rewrite did. The gradient, its stops
    // and the percentage arithmetic are byte-for-byte the same.
    function trackBg(slider) {
      var max = Number(slider.max) || 1;
      var pct = Math.max(0, Math.min(100, (Number(slider.value) / max) * 100));
      return 'linear-gradient(to right,var(--rv-brand) ' + pct + '%,var(--rv-surface-subtle) ' + pct + '%)';
    }

    itensCalc.forEach(function (c) {
      // Teto individual do item pela DISPONIBILIDADE NATIVA. Um teto ausente
      // nunca vira teto infinito: cai no piso da própria metragem do pedido.
      var maxCalc = c.metros_pedidos;
      if (typeof window.maxMetrosItem === 'function') {
        try { maxCalc = Math.max(window.maxMetrosItem(c, modelosById, parametrosByLargura, disponibilidade), c.metros_pedidos); }
        catch (e) { maxCalc = c.metros_pedidos; }
      }
      var modelo = modelosById[c.modelo_id];
      var slider = window.rangeInput({
        min: '0',
        max: String(maxCalc),
        step: '1',
        value: String(Math.round(metrosOverride[c.op_item_id] || 0)),
        ariaLabel: 'Metros — ' + rotuloModelo(modelo),
      });
      slider.style.background = trackBg(slider);
      var valorLabel = el('span', { style: 'font-size:13.5px;font-weight:700;color:var(--rv-text-primary);white-space:nowrap;' }, fmtMetros(Number(slider.value)));
      slider.addEventListener('input', function () {
        metrosOverride[c.op_item_id] = Number(slider.value);
        valorLabel.textContent = fmtMetros(Number(slider.value));
        slider.style.background = trackBg(slider);
        recompute();
      });
      sliders.appendChild(el('div', { style: 'margin-bottom:18px;' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;' },
          el('span', { style: 'font-size:13px;font-weight:600;color:var(--rv-text-primary);' }, rotuloModelo(modelo) + ' · pedido ' + fmtMetros(c.metros_pedidos)),
          valorLabel),
        slider,
        el('div', { style: 'display:flex;justify-content:space-between;margin-top:4px;' },
          el('span', { style: 'font-size:11px;color:var(--rv-text-tertiary);' }, '0 m'),
          el('span', { style: 'font-size:11px;color:var(--rv-text-tertiary);' }, 'máx individual: ' + fmtMetros(maxCalc)))
      ));
      itemRowState[c.op_item_id] = { slider: slider, valorLabel: valorLabel };
    });
    wrap.appendChild(sliders);

    // Consumo de fio (recomputa a cada movimento) -----------------------
    var consumoBox = el('div', { style: 'padding-bottom:16px;' });
    wrap.appendChild(consumoBox);

    var btnReset = el('button', {
      type: 'button',
      style: 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--rv-accent-blue);background:none;border:none;padding:0;margin-bottom:14px;cursor:pointer;font-family:inherit;',
      onclick: function () {
        itensCalc.forEach(function (c) {
          var v = Math.round(proposta.itens[c.op_item_id] || 0);
          metrosOverride[c.op_item_id] = v;
          var row = itemRowState[c.op_item_id];
          if (row) { row.slider.value = String(v); row.valorLabel.textContent = fmtMetros(v); row.slider.style.background = trackBg(row.slider); }
        });
        recompute();
      },
    }, (typeof window.SVG_UNDO === 'string' && svgEl) ? svgEl(window.SVG_UNDO) : '', 'Voltar à proposta proporcional');

    // "Limpar ajuste": devolve TODOS os itens ao estado sem ajuste. A limpeza
    // viaja pelo MESMO escritor atômico (metros_ajustados null no payload
    // absoluto) — nunca por um delete ou update avulso.
    var btnLimpar = el('button', {
      type: 'button',
      style: 'display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--rv-text-secondary);background:none;border:none;padding:0;margin-bottom:14px;margin-left:18px;cursor:pointer;font-family:inherit;',
      onclick: function () { return limparAjuste(); },
    }, 'Limpar ajuste');

    // Rodapé: EXATAMENTE dois botões — Manter pedido + Salvar distribuição.
    var btnManter = el('button', { type: 'button' }, 'Manter pedido');
    var btnSalvar = el('button', { type: 'button' }, 'Salvar distribuição');

    wrap.appendChild(el('div', { style: 'padding:14px 0 ' + (compact ? '4px' : '20px') + ';border-top:1px solid var(--rv-border);margin-top:0;' },
      el('div', {}, btnReset, btnLimpar),
      el('div', { style: 'display:flex;align-items:center;gap:10px;justify-content:flex-end;flex-wrap:wrap;' }, btnManter, btnSalvar)
    ));

    function styleSecondary(btn, disabled) {
      btn.disabled = disabled;
      btn.setAttribute('style', 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:var(--rv-accent-blue);border:1px solid var(--rv-pill-info-border);border-radius:4px;padding:10px 20px;font-weight:700;font-size:14px;font-family:inherit;' + (disabled ? 'opacity:.45;cursor:default;' : 'cursor:pointer;') + '');
    }
    function styleManter(btn, disabled) {
      btn.disabled = disabled;
      btn.setAttribute('style', 'display:inline-flex;align-items:center;gap:7px;background:var(--rv-surface);color:' + (disabled ? 'var(--rv-text-tertiary)' : 'var(--rv-text-primary)') + ';border:1px solid ' + (disabled ? 'var(--rv-border)' : 'var(--rv-border-strong)') + ';border-radius:4px;padding:10px 20px;font-weight:600;font-size:14px;font-family:inherit;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';');
    }

    function recompute() {
      var atual = distribuicaoAtual();
      var infoAtual = avaliarDistribuicao(atual, opItens, modelosById, parametrosByLargura, disponibilidade);
      var infoPedido = avaliarDistribuicao(pedidoMap, opItens, modelosById, parametrosByLargura, disponibilidade);

      var linhas = [el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:10px;' }, 'CONSUMO DE FIO')];
      if (!infoAtual.temDisponibilidade) {
        linhas.push(el('div', { style: 'font-size:12.5px;color:var(--rv-text-tertiary);' },
          'Disponibilidade de fio não carregada nesta tela — o servidor valida o teto ao salvar.'));
      }
      (infoAtual.linhas || []).forEach(function (l) {
        var sobraTxt = l.sobra >= 0 ? ('sobra ' + fmtKg(l.sobra)) : ('EXCEDE em ' + fmtKg(-l.sobra));
        linhas.push(el('div', { style: 'display:flex;justify-content:space-between;font-size:12.5px;color:' + (l.sobra < 0 ? 'var(--rv-signal-negative)' : 'var(--rv-text-primary)') + ';margin-bottom:6px;' },
          el('span', {}, l.rotulo + ': ' + fmtKg(l.kg_consumido) + ' / ' + fmtKg(l.kg_disponivel)),
          el('span', { style: 'font-weight:600;color:' + (l.sobra < 0 ? 'var(--rv-signal-negative)' : 'var(--rv-signal-positive)') + ';' }, sobraTxt)));
      });
      consumoBox.replaceChildren.apply(consumoBox, linhas);

      // "Salvar distribuição": habilita só com mudança não salva (atual
      // != última salva), sem excesso e sem conflito de revisão pendente.
      var mudouAtual = !metrosIguais(atual, savedSnapshot);
      styleSecondary(btnSalvar, conflitoRevisao || !mudouAtual || infoAtual.algumExcede);
      // "Manter pedido": save-only da metragem do pedido; habilita quando
      // o pedido difere do salvo e não excede o disponível.
      var mudouPedido = !metrosIguais(pedidoMap, savedSnapshot);
      styleManter(btnManter, conflitoRevisao || !mudouPedido || infoPedido.algumExcede);
      btnLimpar.disabled = conflitoRevisao || savedSnapshot == null;
      btnLimpar.style.opacity = btnLimpar.disabled ? '.45' : '';
      btnLimpar.style.cursor = btnLimpar.disabled ? 'default' : 'pointer';
    }

    // Trata a recusa por revisão: nada foi gravado, Salvar trava e o operador
    // recarrega explicitamente. Sem retry automático, sem merge.
    function entrarEmConflitoRevisao() {
      conflitoRevisao = true;
      conflitoBox.replaceChildren(buildConflitoRevisao(
        typeof ctx.onRecarregar === 'function'
          ? async function () { await ctx.onRecarregar(); }
          : null));
      recompute();
    }

    var saving = false;

    // Salvamento ÚNICO e ATÔMICO. `itensCalc` é construído a partir de TODOS
    // os op_itens, então o payload é absoluto e completo por construção — que
    // é exatamente o que salvar_ajuste_producao_op exige.
    async function enviarAjuste(itensFinais, okMsg, novoSnapshot) {
      if (saving || conflitoRevisao) return false;
      saving = true;
      try {
        var res = await window.salvarDistribuicaoOP({
          opId: ctx.op.id,
          baseAjusteRevisao: baseRevisao,
          itens: itensFinais,
        });
        if (res && res.revisaoDesatualizada) {
          entrarEmConflitoRevisao();
          return false;
        }
        if (res && res.error) {
          var mensagens = {
            AJUSTE_EXCEDE_DISPONIVEL: 'Algum fio excede o disponível — ajuste os sliders',
            AJUSTE_PAYLOAD_INCOMPLETO: 'A distribuição enviada está incompleta — recarregue os dados',
            AJUSTE_OP_ESTADO_INVALIDO: 'A OP não aceita mais ajuste de distribuição neste estado',
            concorrencia_ocupada: 'Outra operação está em curso nesta OP — tente novamente em instantes',
            PEDIDO_CANCELADO: 'O Pedido foi cancelado — a distribuição não pode ser salva',
            sem_permissao: 'Sem permissão para salvar a distribuição desta OP',
          };
          toast(mensagens[res.codigo] || 'Erro ao salvar distribuição', 'error');
          console.error(res.error, res.codigo);
          return false;
        }
        toast(okMsg, 'success');
        if (res && res.ajusteRevisao != null) baseRevisao = Number(res.ajusteRevisao);
        savedSnapshot = novoSnapshot;
        recompute();
        if (typeof ctx.onSaved === 'function') await ctx.onSaved(novoSnapshot);
        return true;
      } finally {
        saving = false;
      }
    }

    // Entrada dos dois botões do rodapé: recebe um mapa op_item_id -> metros e
    // o converte no payload ABSOLUTO (um registro por item da OP, sempre).
    function persistir(map, okMsg) {
      var info = avaliarDistribuicao(map, opItens, modelosById, parametrosByLargura, disponibilidade);
      if (info.algumExcede) { toast('Algum fio está excedido — ajuste os sliders', 'error'); return; }
      var itensFinais = itensCalc.map(function (c) {
        return { op_item_id: c.op_item_id, metros_ajustados: Math.round((map[c.op_item_id] || 0) * 100) / 100 };
      });
      var salvo = {};
      for (var k in map) salvo[k] = Math.round(map[k] || 0);
      return enviarAjuste(itensFinais, okMsg, salvo);
    }

    function limparAjuste() {
      var itensFinais = itensCalc.map(function (c) {
        return { op_item_id: c.op_item_id, metros_ajustados: null };
      });
      return enviarAjuste(itensFinais, 'Ajuste limpo', null);
    }

    // Os dois devolvem a promessa do salvamento: quem chama pode aguardar o
    // desfecho (inclusive o estado de conflito) em vez de adivinhar quando
    // terminou. No navegador, devolver uma promessa de um listener é inócuo.
    btnSalvar.addEventListener('click', function () { return persistir(distribuicaoAtual(), 'Distribuição salva'); });
    btnManter.addEventListener('click', function () { return persistir(pedidoMap, 'Distribuição salva (metragem do pedido)'); });

    recompute();
    return wrap;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opDistribuicao = {
    distribuicaoSalva: distribuicaoSalva,
    avaliarDistribuicao: avaliarDistribuicao,
    propostaProporcional: propostaProporcional,
    iniciarProducaoState: iniciarProducaoState,
    buildDistribuicaoBlock: buildDistribuicaoBlock,
    buildIniciarProducaoButton: buildIniciarProducaoButton,
  };
  window.distribuicaoSalvaOP = distribuicaoSalva;
  window.iniciarProducaoStateOP = iniciarProducaoState;
  window.buildDistribuicaoBlock = buildDistribuicaoBlock;
  window.buildIniciarProducaoButton = buildIniciarProducaoButton;
})(window);
