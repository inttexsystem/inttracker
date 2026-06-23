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
  function buildEntregaInlineForm({ opItens, modelosById, entrega = null, latexOptions = [], comDestino = true }) {
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

    const linhasNode = window.el('div', { class: 'space-y-2 mt-2 mb-3' });
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

    const node = window.el('div', { class: 'mt-3 border-t pt-3' },
      window.el('div', { class: 'flex flex-wrap gap-3 mb-2' },
        window.el('div', { class: 'w-40' }, window.formField({ label: 'Data', input: dataInput })),
        comDestino ? window.el('div', { class: 'w-64 min-w-[200px]' }, window.formField({ label: 'Destino (látex)', input: destinoSelect })) : window.el('span', {}),
        window.el('div', { class: 'flex-1 min-w-[200px]' }, window.formField({ label: 'Observação da entrega', input: obsInput })),
      ),
      linhasNode,
    );

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

    return { node, getPayload };
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
