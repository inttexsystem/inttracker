// =====================================================================
// === SCREENS: ENTREGA WRITES (Seam A) ================================
// Helpers de escrita de entrega. Esta fase contém APENAS
// `excluirEntrega` (Fase 2.1 do DIAG). Os demais writes
// (salvarEntregaCima, atualizarEntregaCima, salvarEntregaLatex,
// atualizarEntregaLatex) permanecem inline por decisão
// arquitetural (risco médio/alto + rpc + rollback).
//
// Carregar via <script src="js/screens/entrega-writes.js"></script>
// no <head>, DEPOIS de js/screens/entrega-form.js e ANTES do
// script inline principal. As telas inline (screenFornecedorEntregas,
// screenFornecedorLatex, screenNovaOP, renderOPLatexAdmin)
// referenciam `excluirEntrega` como identificador bare, que é
// resolvido como global do <script> (window).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa            (js/supabase-client.js)
//   - window.toast           (js/ui.js)
//   - window.confirmDialog   (js/ui.js)
//
// Compatibilidade: window.excluirEntrega segue disponível
// exatamente como antes para o inline (call-sites bare
// preservados).
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Excluir entrega: usa o padrao de callback do confirmDialog (que so dispara
  // onConfirm em caso afirmativo). onSuccess() roda apos delete bem-sucedido.
  function excluirEntrega(entregaId, onSuccess) {
    window.confirmDialog({
      title: 'Excluir entrega',
      message: 'Esta ação remove a entrega e todos os seus itens. Continuar?',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const r = await window.supa.from('entregas').delete().eq('id', entregaId);
        if (r.error) { window.toast('Erro ao excluir entrega', 'error'); console.error(r.error); return; }
        window.toast('Entrega excluída', 'success');
        if (onSuccess) onSuccess();
      },
    });
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_ENTREGA_WRITES = window.RAVATEX_ENTREGA_WRITES || {};

  window.RAVATEX_ENTREGA_WRITES.excluirEntrega = excluirEntrega;

  // Compatibilidade com o inline (call-sites bare preservados).
  window.excluirEntrega = excluirEntrega;
})(window);
