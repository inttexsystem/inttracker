// =====================================================================
// === SCREENS: MANTA OUTPUT FORM ======================================
// PHASE-MANTA-B2B. Formulario de SAIDA MEDIDA de tecelagem da rota Manta.
//
// Diferenca canonica em relacao ao form Tapete (buildEntregaInlineForm):
//   - NAO existe seletor de destino de acabamento (a Manta nunca entra em
//     acabamento; o guard de rota de db/85 rejeita um destino);
//   - NAO existe opcao de split (nao ha OP de latex a criar);
//   - o estado de defeito e explicito por item e vai no payload.
//
// Puro: apenas DOM e leitura dos proprios inputs. Sem `window.supa`, sem
// escrita, sem navegacao, sem toast. A escrita e de
// `window.RAVATEX_MANTA_WRITES.registrarSaidaMantaCima`.
//
// Retorna { node, getPayload, fillRemaining, hasRemaining }.
// =====================================================================

(function (window) {
  'use strict';

  var LABEL_STYLE = 'display:block;font-size:12px;font-weight:600;color:#5b6472;margin-bottom:5px;';
  var SECTION_HEAD_STYLE = 'font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;';

  function hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtNum(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fieldBlock(labelText, input) {
    return window.el('div', {},
      window.el('label', { style: LABEL_STYLE }, labelText),
      input);
  }

  // Toggle visual ligado ao checkbox real (a fonte de verdade lida pelo
  // getPayload continua sendo chk.checked), no mesmo vocabulario do form
  // Tapete stacked para nao criar uma segunda linguagem visual.
  function defeitoToggle(chk) {
    var knob = window.el('span', {
      style: 'position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(20,30,45,.25);transition:transform .15s ease;',
    });
    var track = window.el('span', {}, knob);
    var paint = function () {
      track.style.cssText = 'position:relative;display:inline-block;width:40px;height:22px;border-radius:999px;transition:background .15s ease;background:' + (chk.checked ? '#c2610c' : '#cfd5df') + ';';
      knob.style.transform = chk.checked ? 'translateX(18px)' : 'translateX(0)';
    };
    paint();
    chk.style.cssText = 'position:absolute;opacity:0;width:0;height:0;margin:0;';
    chk.addEventListener('change', paint);
    return window.el('div', {},
      window.el('label', { style: LABEL_STYLE }, 'Defeito'),
      window.el('label', { style: 'position:relative;display:inline-flex;align-items:center;height:36px;cursor:pointer;' }, chk, track));
  }

  function modeloRotulo(modelo, modeloId) {
    if (!modelo) return '#' + modeloId;
    var display = window.RAVATEX_OP_DISPLAY;
    if (display && typeof display.formatProductLabel === 'function' && modelo.tipo_produto != null) {
      return display.formatProductLabel(modelo);
    }
    var largura = window.larguraKey ? window.larguraKey(modelo.largura) : modelo.largura;
    var c1 = (modelo.cor_1 && modelo.cor_1.nome) || '?';
    var c2 = (modelo.cor_2 && modelo.cor_2.nome) || '?';
    return modelo.nome + ' ' + largura + 'm · ' + c1 + '/' + c2;
  }

  // opItens        : [{ id, modelo_id }]
  // modelosById    : { [id]: modelo }
  // pendingByOpItemId (opcional) : saldo produtivo pendente por op_item.
  function buildMantaOutputForm(input) {
    var safe = input || {};
    var opItens = Array.isArray(safe.opItens) ? safe.opItens : [];
    var modelosById = safe.modelosById || {};
    var pendingByOpItemId = safe.pendingByOpItemId || null;

    var dataInput = window.textInput({ type: 'date', value: safe.data || hoje() });
    var obsInput = window.textInput({ type: 'text', value: '', placeholder: 'observação (opcional)' });

    var linhasState = opItens.map(function (it) {
      return {
        op_item_id: it.id,
        modelo_id: it.modelo_id,
        metrosInput: window.textInput({ type: 'number', step: '0.01', value: '', placeholder: '0,00' }),
        defeitoChk: window.el('input', { type: 'checkbox', class: 'h-4 w-4' }),
        obsLinha: window.textInput({ type: 'text', value: '', placeholder: 'obs (opcional)' }),
      };
    });

    function pendingOf(opItemId) {
      return pendingByOpItemId && pendingByOpItemId[opItemId] != null
        ? Number(pendingByOpItemId[opItemId])
        : null;
    }

    function fillRemaining() {
      linhasState.forEach(function (ls) {
        var pend = pendingOf(ls.op_item_id);
        if (pend != null && pend > 0 && !ls.metrosInput.disabled) ls.metrosInput.value = String(pend);
      });
    }

    var hasRemaining = linhasState.some(function (ls) {
      var pend = pendingOf(ls.op_item_id);
      return pend != null && pend > 0;
    });

    var rows = linhasState.map(function (ls, idx) {
      var pend = pendingOf(ls.op_item_id);
      var pill = (pend != null && pend > 0)
        ? window.el('span', { style: 'display:inline-flex;align-items:center;border:1px solid #fbe8c6;background:#fff9ee;color:#8a5a15;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap;' }, fmtNum(pend) + ' m pendente')
        : window.el('span', { style: 'display:inline-flex;align-items:center;border:1px solid #eceef1;background:#f7f8fa;color:#8a93a3;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap;' }, 'sem pendência');
      return window.el('div', { style: 'padding:12px 14px;' + (idx < linhasState.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
        window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;' },
          window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;line-height:1.35;min-width:0;' },
            modeloRotulo(modelosById[ls.modelo_id], ls.modelo_id)),
          pill),
        window.el('div', { style: 'display:grid;grid-template-columns:130px auto minmax(0,1fr);gap:12px;align-items:end;' },
          fieldBlock('Metros medidos', ls.metrosInput),
          defeitoToggle(ls.defeitoChk),
          fieldBlock('Observação', ls.obsLinha)));
    });

    var preencherLink = null;
    if (hasRemaining) {
      preencherLink = window.el('button', {
        type: 'button',
        style: 'background:none;border:none;padding:0;color:#2563eb;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;',
      }, 'Preencher restante');
      preencherLink.addEventListener('click', fillRemaining);
    }

    var productsCard = window.el('div', { style: 'border:1px solid #eceef1;border-radius:4px;background:#fff;overflow:hidden;' },
      window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid #f1f3f6;' },
        window.el('span', { style: SECTION_HEAD_STYLE }, 'Saída medida de tecelagem'),
        preencherLink || window.el('span', {})),
      rows);

    // A rota Manta vai direto para a Expedicao; a ausencia de destino e
    // uma regra de produto, nao um campo faltando — declarada ao operador.
    var rotaNota = window.el('div', {
      style: 'display:flex;align-items:flex-start;gap:8px;background:#f6f9ff;border:1px solid #d0e0fb;border-radius:4px;padding:10px 12px;font-size:12.5px;color:#2c4a78;line-height:1.5;',
    }, 'Rota Manta: a saída medida vai direto para a Expedição. Não há destino de acabamento a informar.');

    var node = window.el('div', { style: 'display:flex;flex-direction:column;gap:14px;width:100%;' },
      window.el('div', { style: 'display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;' },
        fieldBlock('Data', dataInput),
        fieldBlock('Observação da saída', obsInput)),
      rotaNota,
      productsCard);

    function getPayload() {
      var linhas = linhasState
        .map(function (ls) {
          return {
            op_item_id: ls.op_item_id,
            metros_entregues: ls.metrosInput.value === '' ? 0 : Number(ls.metrosInput.value),
            defeito: ls.defeitoChk.checked,
            observacao: ls.obsLinha.value || null,
          };
        })
        .filter(function (linha) { return linha.metros_entregues > 0; });
      return {
        data: dataInput.value || hoje(),
        observacao: obsInput.value || null,
        itens: linhas,
      };
    }

    return {
      node: node,
      getPayload: getPayload,
      fillRemaining: fillRemaining,
      hasRemaining: hasRemaining,
    };
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.mantaOutputForm = {
    buildMantaOutputForm: buildMantaOutputForm,
  };
  window.buildMantaOutputForm = buildMantaOutputForm;
})(window);
