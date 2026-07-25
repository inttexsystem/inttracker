// =====================================================================
// === SCREENS: MANTA MOVIMENTO FORM ===================================
// PHASE-MANTA-B2B. Composicao unica da acao "registrar saida medida" da
// rota Manta: junta o formulario puro (`manta-output-form.js`) ao
// escritor autoritativo (`manta-writes.js`).
//
// Um unico caminho de gravacao serve as duas superficies que oferecem a
// acao — a tela da OP de Tecelagem e o modal de movimentacao do Pedido —
// para que nao existam duas logicas de rota em paralelo.
//
// Garantias:
//   - nunca passa pelo escritor de entrega cima do Tapete;
//   - nunca aciona a geracao automatica de OP de acabamento/latex;
//   - nao oferece destino de acabamento;
//   - envia op_item_id, metros medidos e defeito explicito;
//   - o erro atomico do backend chega intacto ao operador;
//   - trava de submissao dupla por instancia do formulario.
//
// Este modulo nao escreve em tabela: delega em RAVATEX_MANTA_WRITES.
// =====================================================================

(function (window) {
  'use strict';

  // input = { op, modelosById, pendingByOpItemId, fornecedorId, onDone }
  // Retorna a mesma forma consumida pelo modal de movimentacao do Pedido:
  // { node, saveLabel, fillRemaining, hasRemaining, onSave }.
  function buildMantaMovimentoForm(input) {
    var safe = input || {};
    if (!safe.op || typeof window.buildMantaOutputForm !== 'function') return null;
    var writes = window.RAVATEX_MANTA_WRITES;
    if (!writes) return null;

    var form = window.buildMantaOutputForm({
      opItens: safe.op.op_itens || [],
      modelosById: safe.modelosById || {},
      pendingByOpItemId: safe.pendingByOpItemId || null,
    });
    var enviando = false;

    return {
      node: form.node,
      saveLabel: 'Registrar saida medida',
      fillRemaining: form.fillRemaining,
      hasRemaining: form.hasRemaining,
      getPayload: form.getPayload,
      onSave: async function () {
        if (enviando) return false;
        if (safe.fornecedorId == null) {
          window.toast('Fornecedor de tecelagem nao vinculado a OP.', 'error');
          return false;
        }
        var payload = form.getPayload();
        if (!payload.itens.length) {
          window.toast('Informe ao menos um item com metros medidos.', 'error');
          return false;
        }
        enviando = true;
        var res = await writes.registrarSaidaMantaCima({
          opId: safe.op.id,
          fornecedorId: safe.fornecedorId,
          data: payload.data,
          itens: payload.itens,
          observacao: payload.observacao,
        });
        enviando = false;
        if (!res.ok) {
          window.toast('Saida nao registrada: ' + res.erro, 'error');
          console.error('manta-movimento-form: registrar_entrega_cima_manta', res);
          return false;
        }
        window.toast('Saida medida registrada.', 'success');
        if (typeof safe.onDone === 'function') safe.onDone(res);
        return true;
      },
    };
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.mantaMovimentoForm = {
    buildMantaMovimentoForm: buildMantaMovimentoForm,
  };
})(window);
