// =====================================================================
// === SCREENS: ENTREGA WRITES (Seam A) ================================
// Helpers de escrita de entrega. Esta fase contém:
//   - excluirEntrega            (Fase 2.1 do DIAG)
//   - salvarEntregaLatex        (Fase 2.2 do DIAG)
//   - atualizarEntregaLatex     (Fase 2.2 do DIAG)
//   - salvarEntregaCima         (Fase 2.3 do DIAG)
//   - atualizarEntregaCima      (Fase 2.3 do DIAG)
//
// Carregar via <script src="js/screens/entrega-writes.js"></script>
// no <head>, DEPOIS de js/screens/entrega-form.js e ANTES do
// script inline principal. As telas inline (screenFornecedorEntregas,
// screenFornecedorLatex, screenNovaOP, renderOPLatexAdmin)
// referenciam os helpers acima como identificadores bare, que são
// resolvidos como globais do <script> (window).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa            (js/supabase-client.js)
//   - window.toast           (js/ui.js)
//   - window.confirmDialog   (js/ui.js)
//
// Compatibilidade: window.excluirEntrega, window.salvarEntregaLatex,
// window.atualizarEntregaLatex, window.salvarEntregaCima e
// window.atualizarEntregaCima seguem disponíveis exatamente como
// antes para o inline (call-sites bare preservados).
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
  // Persistência dos recebimentos de látex (Fase 5b). Espelha as de
  // tecelagem, mas etapa='latex', sem destino e sem gerar OP (a OP
  // de látex já existe).
  async function salvarEntregaLatex({ fornecedorId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
    const ins = await window.supa.from('entregas').insert({
      fornecedor_id: fornecedorId, etapa: 'latex', data: payload.data, observacao: payload.observacao,
    }).select().single();
    if (ins.error) { window.toast('Erro ao gravar recebimento', 'error'); console.error(ins.error); return false; }
    const entregaId = ins.data.id;
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    if (insItens.error) {
      await window.supa.from('entregas').delete().eq('id', entregaId);
      window.toast('Erro ao gravar itens do recebimento', 'error'); console.error(insItens.error); return false;
    }
    window.toast('Recebimento registrado', 'success');
    return true;
  }

  async function atualizarEntregaLatex({ entregaId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
    const upd = await window.supa.from('entregas').update({
      data: payload.data, observacao: payload.observacao,
    }).eq('id', entregaId);
    if (upd.error) { window.toast('Erro ao atualizar recebimento', 'error'); console.error(upd.error); return false; }
    await window.supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    // MVP: se a reinsercao falhar aqui, a entrega fica sem itens.
    // Como o app eh single-admin e baixo volume, aceitamos o risco
    // e a correcao manual via Supabase.
    if (insItens.error) { window.toast('Erro ao regravar itens do recebimento', 'error'); console.error(insItens.error); return false; }
    window.toast('Recebimento atualizado', 'success');
    return true;
  }

  // -------------------------------------------------------------------
  // Persistência das entregas de tecelagem (Fase 5a).
  // - salvarEntregaCima: após gravar a entrega, chama a RPC
  //   `gerar_op_latex` em modo best-effort. Falha da RPC NÃO
  //   desfaz a entrega; apenas emite toast de aviso.
  async function salvarEntregaCima({ fornecedorId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
    if (!payload.destino_fornecedor_id) { window.toast('Escolha a empresa de látex de destino', 'error'); return false; }
    const ins = await window.supa.from('entregas').insert({
      fornecedor_id: fornecedorId, etapa: 'cima', data: payload.data, observacao: payload.observacao,
      destino_fornecedor_id: payload.destino_fornecedor_id,
    }).select().single();
    if (ins.error) { window.toast('Erro ao gravar entrega', 'error'); console.error(ins.error); return false; }
    const entregaId = ins.data.id;
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    if (insItens.error) {
      await window.supa.from('entregas').delete().eq('id', entregaId);
      window.toast('Erro ao gravar itens da entrega', 'error'); console.error(insItens.error); return false;
    }
    // Fase 5b: a entrega de tecelagem gera automaticamente a OP de látex.
    const rpc = await window.supa.rpc('gerar_op_latex', { p_entrega_id: entregaId });
    if (rpc.error) {
      window.toast('Entrega salva, mas falhou ao gerar a OP de látex. Gere manualmente.', 'error');
      console.error(rpc.error);
      return true;
    }
    window.toast('Entrega registrada' + (rpc.data ? ' · OP de látex gerada' : ''), 'success');
    return true;
  }

  // - atualizarEntregaCima: delete+insert não transacional. Se a
  //   reinserção dos itens falhar, a entrega fica sem itens.
  //   Decisão aceita por design (single-admin / baixo volume);
  //   correção manual via Supabase.
  async function atualizarEntregaCima({ entregaId, opId, payload }) {
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
    if (!payload.destino_fornecedor_id) { window.toast('Escolha a empresa de látex de destino', 'error'); return false; }
    const upd = await window.supa.from('entregas').update({
      data: payload.data, observacao: payload.observacao,
      destino_fornecedor_id: payload.destino_fornecedor_id,
    }).eq('id', entregaId);
    if (upd.error) { window.toast('Erro ao atualizar entrega', 'error'); console.error(upd.error); return false; }
    await window.supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    // MVP: se a reinsercao falhar aqui, a entrega fica sem itens. Como o app eh
    // single-admin e baixo volume, aceitamos o risco e a correcao manual via Supabase.
    if (insItens.error) { window.toast('Erro ao regravar itens da entrega', 'error'); console.error(insItens.error); return false; }
    window.toast('Entrega atualizada', 'success');
    return true;
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_ENTREGA_WRITES = window.RAVATEX_ENTREGA_WRITES || {};

  window.RAVATEX_ENTREGA_WRITES.excluirEntrega = excluirEntrega;
  window.RAVATEX_ENTREGA_WRITES.salvarEntregaLatex = salvarEntregaLatex;
  window.RAVATEX_ENTREGA_WRITES.atualizarEntregaLatex = atualizarEntregaLatex;
  window.RAVATEX_ENTREGA_WRITES.salvarEntregaCima = salvarEntregaCima;
  window.RAVATEX_ENTREGA_WRITES.atualizarEntregaCima = atualizarEntregaCima;

  // Compatibilidade com o inline (call-sites bare preservados).
  window.excluirEntrega = excluirEntrega;
  window.salvarEntregaLatex = salvarEntregaLatex;
  window.atualizarEntregaLatex = atualizarEntregaLatex;
  window.salvarEntregaCima = salvarEntregaCima;
  window.atualizarEntregaCima = atualizarEntregaCima;
})(window);
