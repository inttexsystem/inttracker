// =====================================================================
// === SCREENS: ENTREGA FORM HELPERS (Seam A) ==========================
// Helpers de UI/read para o formulário inline de entrega (Fase 5a/5b).
// Extraídos do <script> inline de index.html sem alterar
// comportamento, escrita ou ordem de chamada. Concentra:
//
//   - rotuloFio(ordem)             — rótulo do fio de uma OCF
//   - OCF_STATUS_LABEL             — labels PT-BR para status de OCF
//   - buildEntregaInlineForm(...)  — form inline (data, obs,
//                                    destino, linhas por item).
//                                    Retorna { node, getPayload }.
//
// Carregar via <script src="js/screens/entrega-form.js"></script> no
// <head>, DEPOIS de js/screens/ops-list.js e ANTES do script inline
// principal. As telas inline (screenFornecedorEntregas,
// screenFornecedorLatex, screenFornecedorOrdens, screenNovaOP,
// renderOPLatexAdmin) referenciam `rotuloFio`, `OCF_STATUS_LABEL` e
// `buildEntregaInlineForm` como identificadores bare, que são
// resolvidos como globais do <script> (window).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el / window.textInput / window.selectInput /
//     window.formField                                (js/ui.js)
//   - window.larguraKey                               (js/calculo-op.js)
//
// NÃO depende de: window.supa, window.toast, window.modal,
// window.confirmDialog, window.CURRENT_USER, window.navigate.
// NÃO faz insert / update / delete / rpc — apenas DOM e constantes.
//
// Compatibilidade: window.rotuloFio, window.OCF_STATUS_LABEL e
// window.buildEntregaInlineForm seguem disponíveis exatamente como
// antes para o setRoutes no inline (call-sites bare preservados).
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Rótulos / constantes
  // -------------------------------------------------------------------

  // Rótulo do fio de uma ordem de compra.
  function rotuloFio(ordem) {
    if (ordem.tipo === 'algodao') return 'Algodão — ' + (ordem.cores?.nome || '?');
    return 'Poliéster — ' + (ordem.cor_poliester || '?');
  }

  const OCF_STATUS_LABEL = {
    pendente: 'Pendente', recebido_parcial: 'Recebido (parcial)', recebido_total: 'Recebido',
  };

  // -------------------------------------------------------------------
  // Form inline de entrega
  // -------------------------------------------------------------------

  // Form inline para criar/editar uma entrega de tecelagem (Fase 5a).
  // opItens: [{ id, modelo_id, metros_pedidos, metros_ajustados }]
  // modelosById: { [id]: { id, nome, largura, cor_1:{id,nome}, cor_2:{id,nome} } }
  // entrega (opcional, para edição): { id, data, observacao, entrega_itens: [...] }
  // Retorna: { node, getPayload }
  // layout: 'inline' (padrão histórico, linha única por item) ou 'stacked'
  // (empilhado — usado no modal Tecelagem → Acabamento do Pedido). Os inputs
  // e o getPayload são idênticos nos dois layouts — só muda a ordem/estrutura
  // do DOM para: Nome do item → Data/Destino/Metros → Observação.
  function buildEntregaInlineForm({ opItens, modelosById, entrega = null, latexOptions = [], comDestino = true, comOpcaoSplit = false, layout = 'inline', pendingByOpItemId = null }) {
    const hoje = new Date().toISOString().slice(0, 10);
    const dataInput = window.textInput({ type: 'date', value: entrega?.data || hoje });
    const obsInput = window.textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });
    const destinoSelect = comDestino ? window.selectInput({
      options: latexOptions,
      value: entrega?.destino_fornecedor_id ?? '',
      placeholder: '— selecione a empresa de látex —',
    }) : null;

    const existentesPorItem = {};
    if (entrega?.entrega_itens) {
      for (const ei of entrega.entrega_itens) existentesPorItem[ei.op_item_id] = ei;
    }

    const linhasState = opItens.map(it => {
      const existente = existentesPorItem[it.id];
      const metrosInput = window.textInput({ type: 'number', step: '0.01', value: existente ? String(existente.metros_entregues) : '', placeholder: '0,00' });
      const defeitoChk = window.el('input', { type: 'checkbox', class: 'h-4 w-4' });
      if (existente?.defeito) defeitoChk.checked = true;
      const obsLinha = window.textInput({ type: 'text', value: existente?.observacao || '', placeholder: 'obs (opcional)' });
      return { op_item_id: it.id, metrosInput, defeitoChk, obsLinha };
    });

    const stacked = layout === 'stacked';

    // Controles de split (Tipo de lançamento + Motivo). Construídos uma vez;
    // o markup que os posiciona é montado por layout mais abaixo. A operação
    // canônica (getSplitOption) continua lendo splitSelect/motivoInput.
    var splitSelect = null, motivoInput = null, avisoEl = null;
    var _resolveSplit = function () { return { forceSplit: false, motivo: null }; };
    if (comOpcaoSplit) {
      splitSelect = window.selectInput({
        options: [
          { value: 'acumular', label: 'Acumular na OP existente quando possível' },
          { value: 'split', label: 'Criar nova OP para esta parcial' },
        ],
        value: 'acumular',
      });
      motivoInput = window.textInput({ type: 'text', value: '', placeholder: 'Ex.: amostra separada, retrabalho...' });
      avisoEl = window.el('div', { style: 'display:none;font-size:12px;color:#b08b3a;margin-top:4px;line-height:1.4;' },
        'A exceção cria uma OP de acabamento separada e registra o motivo no histórico.');
      _resolveSplit = function () {
        if (splitSelect.value === 'split') {
          return { forceSplit: true, motivo: String(motivoInput.value || '').trim() };
        }
        return { forceSplit: false, motivo: null };
      };
    }

    var node;
    if (stacked) {
      // --- Layout 'stacked' (modal Movimentar Tecelagem → Acabamento) ------
      // Reescrito para o vocabulário inline do modal de movimentação do
      // Pedido: bordas #eceef1/#f1f3f6, raio 4px, labels 12px/600/#5b6472,
      // headers de seção uppercase #8a93a3, foco/links azul #2563eb.
      // Inputs e getPayload/getSplitOption inalterados.
      var LABEL_STYLE = 'display:block;font-size:12px;font-weight:600;color:#5b6472;margin-bottom:5px;';
      var SECTION_HEAD_STYLE = 'font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a93a3;text-transform:uppercase;';

      var fieldBlock = function (labelText, input) {
        return window.el('div', {},
          window.el('label', { style: LABEL_STYLE }, labelText),
          input);
      };

      var fmtPend = function (n) {
        return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Toggle visual ligado ao checkbox real de defeito (defeitoChk.checked
      // segue sendo a fonte de verdade lida pelo getPayload).
      var defeitoToggle = function (chk) {
        var knob = window.el('span', {
          style: 'position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(20,30,45,.25);transition:transform .15s ease;',
        });
        var track = window.el('span', {}, knob);
        var paint = function () {
          track.style.cssText = 'position:relative;display:inline-block;width:40px;height:22px;border-radius:999px;transition:background .15s ease;background:' + (chk.checked ? '#2563eb' : '#cfd5df') + ';';
          knob.style.transform = chk.checked ? 'translateX(18px)' : 'translateX(0)';
        };
        paint();
        chk.style.cssText = 'position:absolute;opacity:0;width:0;height:0;margin:0;';
        chk.addEventListener('change', paint);
        return window.el('div', {},
          window.el('label', { style: LABEL_STYLE }, 'Defeito'),
          window.el('label', { style: 'position:relative;display:inline-flex;align-items:center;height:36px;cursor:pointer;' }, chk, track));
      };

      // 1) Dados gerais da transferência inteira: Data + Destino (látex).
      var dadosGerais = window.el('div', { style: 'display:grid;grid-template-columns:180px 1fr;gap:12px;' },
        fieldBlock('Data', dataInput),
        comDestino ? fieldBlock('Destino (látex)', destinoSelect) : window.el('span', {}));

      // 2) Card "Produtos a transferir" — cada produto com os mesmos campos.
      var pendingOf = function (opItemId) {
        return pendingByOpItemId && pendingByOpItemId[opItemId] != null ? Number(pendingByOpItemId[opItemId]) : null;
      };
      var fillRemaining = function () {
        linhasState.forEach(function (ls) {
          var pend = pendingOf(ls.op_item_id);
          if (pend != null && pend > 0 && !ls.metrosInput.disabled) ls.metrosInput.value = String(pend);
        });
      };
      var hasRemaining = linhasState.some(function (ls) {
        var pend = pendingOf(ls.op_item_id);
        return pend != null && pend > 0;
      });

      var stackedRows = linhasState.map(function (ls, idx) {
        var it = opItens[idx];
        var modelo = modelosById[it.modelo_id];
        var rotulo = modelo
          ? `${modelo.nome} ${window.larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`
          : ('#' + it.modelo_id);
        var pend = pendingOf(it.id);
        var pill = (pend != null && pend > 0)
          ? window.el('span', { style: 'display:inline-flex;align-items:center;border:1px solid #fbe8c6;background:#fff9ee;color:#8a5a15;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap;' }, fmtPend(pend) + ' m pendente')
          : window.el('span', { style: 'display:inline-flex;align-items:center;border:1px solid #eceef1;background:#f7f8fa;color:#8a93a3;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:700;white-space:nowrap;' }, 'sem pendência');
        return window.el('div', { style: 'padding:12px 14px;' + (idx < linhasState.length - 1 ? 'border-bottom:1px solid #f1f3f6;' : '') },
          window.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;' },
            window.el('div', { style: 'font-size:13px;font-weight:700;color:#16203a;line-height:1.35;' }, rotulo),
            pill),
          window.el('div', { style: 'display:grid;grid-template-columns:130px auto 1fr;gap:12px;align-items:end;' },
            fieldBlock('Metros', ls.metrosInput),
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
          window.el('span', { style: SECTION_HEAD_STYLE }, 'Produtos a transferir'),
          preencherLink || window.el('span', {})),
        stackedRows);

      // 3) Tipo de lançamento e Observação da entrega em linhas distintas
      //    (largura total) e o campo condicional "Motivo da separação".
      var stackedTail;
      if (comOpcaoSplit) {
        var motivoWrapper = window.el('div', { style: 'display:none;' },
          fieldBlock('Motivo da separação', motivoInput),
          avisoEl);
        splitSelect.addEventListener('change', function () {
          var isSplit = splitSelect.value === 'split';
          motivoWrapper.style.display = isSplit ? '' : 'none';
          avisoEl.style.display = isSplit ? '' : 'none';
          if (!isSplit) motivoInput.value = '';
        });
        stackedTail = window.el('div', { style: 'display:flex;flex-direction:column;gap:14px;width:100%;' },
          fieldBlock('Tipo de lançamento', splitSelect),
          fieldBlock('Observação da entrega', obsInput),
          motivoWrapper);
      } else {
        stackedTail = fieldBlock('Observação da entrega', obsInput);
      }

      node = window.el('div', { style: 'display:flex;flex-direction:column;gap:14px;width:100%;' },
        dadosGerais,
        productsCard,
        stackedTail);
    } else {
      // --- Layout 'inline' (histórico, inalterado) -------------------------
      var linhasNode = window.el('div', { class: 'space-y-2 mt-2 mb-3' });
      for (let idx = 0; idx < linhasState.length; idx++) {
        const ls = linhasState[idx];
        const it = opItens[idx];
        const modelo = modelosById[it.modelo_id];
        const rotulo = modelo
          ? `${modelo.nome} ${window.larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`
          : ('#' + it.modelo_id);
        linhasNode.appendChild(window.el('div', { class: 'flex flex-wrap items-end gap-2 border-b pb-2' },
          window.el('div', { class: 'flex-1 min-w-[180px] text-sm text-gray-700' }, rotulo),
          window.el('div', { class: 'w-28' }, window.formField({ label: 'Metros', input: ls.metrosInput })),
          window.el('label', { class: 'flex items-center gap-1 text-sm text-gray-700 mb-1' }, ls.defeitoChk, 'defeito'),
          window.el('div', { class: 'flex-1 min-w-[140px]' }, window.formField({ label: 'Observação', input: ls.obsLinha })),
        ));
      }

      var splitNodeInline = window.el('span', {});
      if (comOpcaoSplit) {
        var motivoWrapperInline = window.el('div', { style: 'display:none;' });
        motivoWrapperInline.appendChild(window.formField({ label: 'Motivo da separação', input: motivoInput }));
        splitSelect.addEventListener('change', function () {
          var isSplit = splitSelect.value === 'split';
          motivoWrapperInline.style.display = isSplit ? '' : 'none';
          avisoEl.style.display = isSplit ? '' : 'none';
          if (!isSplit) motivoInput.value = '';
        });
        splitNodeInline = window.el('div', { class: 'mt-3 pt-3 border-t border-gray-100' },
          window.el('div', {}, window.formField({ label: 'Tipo de lançamento (Tecelagem → Acabamento)', input: splitSelect })),
          motivoWrapperInline,
          avisoEl);
      }

      node = window.el('div', { class: 'mt-3 border-t pt-3' },
        window.el('div', { class: 'flex flex-wrap gap-3 mb-2' },
          window.el('div', { class: 'w-40' }, window.formField({ label: 'Data', input: dataInput })),
          comDestino ? window.el('div', { class: 'w-64 min-w-[200px]' }, window.formField({ label: 'Destino (látex)', input: destinoSelect })) : window.el('span', {}),
          window.el('div', { class: 'flex-1 min-w-[200px]' }, window.formField({ label: 'Observação da entrega', input: obsInput })),
        ),
        linhasNode,
        splitNodeInline,
      );
    }

    function getPayload() {
      const linhas = linhasState
        .map(ls => ({
          op_item_id: ls.op_item_id,
          metros_entregues: ls.metrosInput.value === '' ? 0 : Number(ls.metrosInput.value),
          defeito: ls.defeitoChk.checked,
          observacao: ls.obsLinha.value || null,
        }))
        .filter(l => l.metros_entregues > 0);
      const destino = (comDestino && destinoSelect && destinoSelect.value !== '') ? Number(destinoSelect.value) : null;
      return { data: dataInput.value || hoje, observacao: obsInput.value || null, destino_fornecedor_id: destino, linhas };
    }

    function _getSplitOption() {
      return _resolveSplit();
    }

    return { node, getPayload, getSplitOption: _getSplitOption };
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};

  window.RAVATEX_SCREENS.entregaForm = {
    rotuloFio,
    OCF_STATUS_LABEL,
    buildEntregaInlineForm,
  };

  // Compatibilidade com o inline (call-sites bare preservados).
  window.rotuloFio = rotuloFio;
  window.OCF_STATUS_LABEL = OCF_STATUS_LABEL;
  window.buildEntregaInlineForm = buildEntregaInlineForm;
})(window);
