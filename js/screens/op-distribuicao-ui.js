// =====================================================================
// === SCREENS: OP DISTRIBUICAO UI (shared builder) ====================
// Builder ÚNICO da "distribuição de metros" da OP de Tecelagem,
// consumido por DUAS telas (uma implementação, zero duplicação —
// YARN-BUTTONS-FINAL-CONTRACT):
//   - Tela da OP (js/screens/op-nova.js) — bloco de insumos + rail.
//   - Painel do Pedido (js/screens/pedido-detail-events.js) — hub de
//     controle, onde a movimentação/produção é operada.
//
// CONTRATO (ambas as telas consomem estes builders, sem reimplementar):
//   - buildDistribuicaoBlock(): sliders + consumo + rodapé com
//     EXATAMENTE dois botões — "Manter pedido" e "Salvar distribuição".
//     Ambos SÓ persistem a distribuição (window.salvarDistribuicaoOP);
//     NENHUM inicia produção, muda status ou grava saldo. "Aceitar
//     proposta" não existe.
//   - buildIniciarProducaoButton(): ÚNICO ponto de início de produção
//     (window.iniciarProducaoOP: snapshot de saldo + status
//     em_producao). Habilita só quando existe distribuição salva E o
//     fio recebido a cobre; senão desabilitado com title explicativo.
//
// Carregar DEPOIS de op-recalculo.js (usa salvar/iniciarProducaoOP) e
// ANTES de op-nova.js. pedido-detail-events.js chama em runtime.
// Dependências resolvidas em call-time via window: el, toast, svgEl,
// fmtMetros, fmtKg, rotuloModelo, recalcularOP, consumoPorOrdem,
// maxMetrosItem, salvarDistribuicaoOP, iniciarProducaoOP.
// =====================================================================

(function (window) {
  'use strict';

  function fn(name, fallback) {
    return typeof window[name] === 'function' ? window[name] : fallback;
  }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  // Distribuição salva = op_itens.metros_ajustados de TODOS os itens.
  // Retorna { [op_item_id]: metros } ou null se algum item ainda não
  // tem metros_ajustados (nada salvo).
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

  // Consumo/sobras de uma distribuição (mapa op_item_id -> metros).
  function calcSobras(metrosMap, opItens, ordens, modelosById, parametrosByLargura) {
    var consumoPorOrdem = window.consumoPorOrdem;
    var itens = (opItens || []).map(function (i) {
      return { op_item_id: i.id, modelo_id: i.modelo_id, metros: (metrosMap && metrosMap[i.id]) || 0 };
    });
    var consumos = (typeof consumoPorOrdem === 'function')
      ? consumoPorOrdem(itens, ordens, modelosById, parametrosByLargura)
      : [];
    var algumExcede = consumos.some(function (c) { return c.sobra < 0; });
    var sobras = consumos.filter(function (c) { return c.sobra > 0; }).map(function (c) {
      var o = (ordens || []).find(function (x) { return x.id === c.ordem_id; }) || {};
      return {
        ordem_id: o.id, tipo: o.tipo,
        cor_id: o.cor_id != null ? o.cor_id : null,
        cor_poliester: o.cor_poliester != null ? o.cor_poliester : null,
        kg_sobra: round3(c.sobra),
      };
    });
    return { algumExcede: algumExcede, sobras: sobras, consumos: consumos };
  }

  // Estado da ação "Iniciar produção" para uma OP (fonte de verdade =
  // op_itens.metros_ajustados já persistido, não sliders ao vivo).
  function iniciarProducaoState(opItens, ordens, modelosById, parametrosByLargura) {
    var lista = ordens || [];
    var pendentes = lista.filter(function (o) { return o.status === 'pendente'; });
    var todasRecebidas = lista.length > 0 && pendentes.length === 0;
    var saved = distribuicaoSalva(opItens);
    var info = (todasRecebidas && saved)
      ? calcSobras(saved, opItens, ordens, modelosById, parametrosByLargura)
      : { algumExcede: false, sobras: [] };
    var habilitado = todasRecebidas && saved != null && !info.algumExcede;
    var motivo = '';
    if (!todasRecebidas) motivo = 'Aguardando recebimento de todos os fios.';
    else if (!saved) motivo = 'Salve a distribuição antes de iniciar a produção.';
    else if (info.algumExcede) motivo = 'Algum fio excede o recebido — ajuste e salve a distribuição.';
    return {
      habilitado: habilitado,
      motivo: motivo,
      sobras: info.sobras,
      todasRecebidas: todasRecebidas,
      temDistribuicaoSalva: saved != null,
    };
  }

  // Botão primário "Iniciar produção" — ÚNICO ponto de início de
  // produção em qualquer tela. ctx: { op, opItens, ordens, modelosById,
  // parametrosByLargura, styleEnabled, styleDisabled, onIniciado }.
  function buildIniciarProducaoButton(ctx) {
    var el = window.el;
    var st = iniciarProducaoState(ctx.opItens, ctx.ordens, ctx.modelosById, ctx.parametrosByLargura);
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
          var res = await window.iniciarProducaoOP({ opId: ctx.op.id, sobras: st.sobras });
          if (res && res.error) {
            var mensagens = {
              saldo_fios_op_insert: 'Erro ao gravar saldo da OP — verifique no Supabase',
              saldo_fios_select: 'Erro ao ler saldo total — verifique no Supabase',
              saldo_fios_update: 'Erro ao gravar saldo total — verifique no Supabase',
              saldo_fios_insert: 'Erro ao gravar saldo total — verifique no Supabase',
              ops_update_status: 'Erro ao mudar status — saldo já gravado, verifique no Supabase',
            };
            window.toast(mensagens[res.step] || 'Erro ao iniciar produção', 'error');
            console.error(res.error);
            btn.disabled = false;
            return;
          }
          window.toast('Produção iniciada', 'success');
          if (typeof ctx.onIniciado === 'function') await ctx.onIniciado();
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
  // [Voltar à proposta] [Manter pedido] [Salvar distribuição].
  // AMBOS os botões de rodapé só persistem (save-only); nenhum inicia
  // produção. ctx: { op, opItens, ordens, modelosById,
  // parametrosByLargura, variant('full'|'compact'), onSaved }.
  function buildDistribuicaoBlock(ctx) {
    var el = window.el;
    var svgEl = window.svgEl;
    var fmtMetros = fn('fmtMetros', function (n) { return String(n); });
    var fmtKg = fn('fmtKg', function (n) { return String(n); });
    var rotuloModelo = fn('rotuloModelo', function (m) { return (m && m.nome) || 'Modelo'; });
    var toast = fn('toast', function () {});
    var opItens = ctx.opItens || [];
    var ordens = ctx.ordens || [];
    var modelosById = ctx.modelosById || {};
    var parametrosByLargura = ctx.parametrosByLargura || {};
    var compact = ctx.variant === 'compact';

    var itensCalc = opItens.map(function (i) {
      return { op_item_id: i.id, modelo_id: i.modelo_id, metros_pedidos: Number(i.metros_pedidos) };
    });
    var resultado = (typeof window.recalcularOP === 'function')
      ? window.recalcularOP(itensCalc, ordens)
      : {
          fator: 1,
          itens: itensCalc.map(function (i) {
            return { op_item_id: i.op_item_id, metros_pedidos: i.metros_pedidos, metros_ajustados: i.metros_pedidos };
          }),
          sobras: [],
        };

    // Snapshot da distribuição salva (fixo neste render; fonte =
    // op_itens.metros_ajustados). Sliders default = salvo ou proposta.
    var savedSnapshot = distribuicaoSalva(opItens);
    var metrosOverride = {};
    resultado.itens.forEach(function (it) {
      metrosOverride[it.op_item_id] = (savedSnapshot && savedSnapshot[it.op_item_id] != null)
        ? savedSnapshot[it.op_item_id]
        : Math.round(it.metros_ajustados);
    });
    // Distribuição "manter pedido" = metragem original do pedido.
    var pedidoMap = {};
    itensCalc.forEach(function (c) { pedidoMap[c.op_item_id] = Math.round(c.metros_pedidos); });

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

    var semFio = ordens.some(function (o) { return Number(o.kg_recebido) <= 0; });
    if (semFio) {
      wrap.appendChild(el('p', { style: 'font-size:13px;color:var(--rv-signal-negative);margin-bottom:8px;' },
        'Atenção: alguma ordem foi recebida com 0 kg.'));
    }

    wrap.appendChild(el('div', { style: 'font-size:13px;color:var(--rv-text-primary);margin-bottom:2px;' },
      el('strong', {}, 'Fator proporcional (cor mais escassa): '),
      Number(resultado.fator).toFixed(2).replace('.', ',')));
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
      var maxCalc = c.metros_pedidos;
      if (typeof window.maxMetrosItem === 'function') {
        try { maxCalc = Math.max(window.maxMetrosItem(c, modelosById, parametrosByLargura, ordens), c.metros_pedidos); }
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
        resultado.itens.forEach(function (it) {
          var v = Math.round(it.metros_ajustados);
          metrosOverride[it.op_item_id] = v;
          var row = itemRowState[it.op_item_id];
          if (row) { row.slider.value = String(v); row.valorLabel.textContent = fmtMetros(v); row.slider.style.background = trackBg(row.slider); }
        });
        recompute();
      },
    }, (typeof window.SVG_UNDO === 'string' && svgEl) ? svgEl(window.SVG_UNDO) : '', 'Voltar à proposta proporcional');

    // Rodapé: EXATAMENTE dois botões — Manter pedido + Salvar distribuição.
    var btnManter = el('button', { type: 'button' }, 'Manter pedido');
    var btnSalvar = el('button', { type: 'button' }, 'Salvar distribuição');

    wrap.appendChild(el('div', { style: 'padding:14px 0 ' + (compact ? '4px' : '20px') + ';border-top:1px solid var(--rv-border);margin-top:0;' },
      btnReset,
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

    function itensComMetros(map) {
      return itensCalc.map(function (c) {
        return { op_item_id: c.op_item_id, modelo_id: c.modelo_id, metros: (map[c.op_item_id]) || 0 };
      });
    }

    function recompute() {
      var atual = distribuicaoAtual();
      var infoAtual = calcSobras(atual, opItens, ordens, modelosById, parametrosByLargura);
      var infoPedido = calcSobras(pedidoMap, opItens, ordens, modelosById, parametrosByLargura);

      var linhas = [el('div', { style: 'font-size:10.5px;font-weight:700;color:var(--rv-text-tertiary);letter-spacing:.06em;margin-bottom:10px;' }, 'CONSUMO DE FIO')];
      (infoAtual.consumos || []).forEach(function (c) {
        var o = ordens.find(function (x) { return x.id === c.ordem_id; }) || {};
        var nome = o.tipo === 'algodao'
          ? 'Algodão — ' + ((o.cores && o.cores.nome) || '?')
          : 'Poliéster — ' + o.cor_poliester;
        var sobraTxt = c.sobra >= 0 ? ('sobra ' + fmtKg(c.sobra)) : ('EXCEDE em ' + fmtKg(-c.sobra));
        linhas.push(el('div', { style: 'display:flex;justify-content:space-between;font-size:12.5px;color:' + (c.sobra < 0 ? 'var(--rv-signal-negative)' : 'var(--rv-text-primary)') + ';margin-bottom:6px;' },
          el('span', {}, nome + ': ' + fmtKg(c.kg_consumido) + ' / ' + fmtKg(c.kg_recebido)),
          el('span', { style: 'font-weight:600;color:' + (c.sobra < 0 ? 'var(--rv-signal-negative)' : 'var(--rv-signal-positive)') + ';' }, sobraTxt)));
      });
      consumoBox.replaceChildren.apply(consumoBox, linhas);

      // "Salvar distribuição": habilita só com mudança não salva (atual
      // != última salva) e sem excesso.
      var mudouAtual = !metrosIguais(atual, savedSnapshot);
      styleSecondary(btnSalvar, !mudouAtual || infoAtual.algumExcede);
      // "Manter pedido": save-only da metragem do pedido; habilita quando
      // o pedido difere do salvo e não excede o recebido.
      var mudouPedido = !metrosIguais(pedidoMap, savedSnapshot);
      styleManter(btnManter, !mudouPedido || infoPedido.algumExcede);
    }

    var saving = false;
    async function persistir(map, okMsg) {
      if (saving) return;
      var info = calcSobras(map, opItens, ordens, modelosById, parametrosByLargura);
      if (info.algumExcede) { toast('Algum fio está excedido — ajuste os sliders', 'error'); return; }
      saving = true;
      try {
        var itensFinais = itensCalc.map(function (c) {
          return { op_item_id: c.op_item_id, metros_ajustados: Math.round((map[c.op_item_id] || 0) * 100) / 100 };
        });
        var res = await window.salvarDistribuicaoOP({ opId: ctx.op.id, itens: itensFinais });
        if (res && res.error) {
          toast('Erro ao salvar distribuição — verifique no Supabase', 'error');
          console.error(res.error, res.step);
          return;
        }
        toast(okMsg, 'success');
        var salvo = {};
        for (var k in map) salvo[k] = Math.round(map[k] || 0);
        if (typeof ctx.onSaved === 'function') await ctx.onSaved(salvo);
      } finally {
        saving = false;
      }
    }

    btnSalvar.addEventListener('click', function () { persistir(distribuicaoAtual(), 'Distribuição salva'); });
    btnManter.addEventListener('click', function () { persistir(pedidoMap, 'Distribuição salva (metragem do pedido)'); });

    recompute();
    return wrap;
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opDistribuicao = {
    distribuicaoSalva: distribuicaoSalva,
    calcSobras: calcSobras,
    iniciarProducaoState: iniciarProducaoState,
    buildDistribuicaoBlock: buildDistribuicaoBlock,
    buildIniciarProducaoButton: buildIniciarProducaoButton,
  };
  window.distribuicaoSalvaOP = distribuicaoSalva;
  window.iniciarProducaoStateOP = iniciarProducaoState;
  window.buildDistribuicaoBlock = buildDistribuicaoBlock;
  window.buildIniciarProducaoButton = buildIniciarProducaoButton;
})(window);
