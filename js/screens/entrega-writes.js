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
  // D-B preflight: uma entrega de tecelagem (etapa='cima') que já gerou
  // OP de Acabamento/Látex (ops.origem_entrega_id) não pode ser editada
  // nem excluída livremente pelo app — vira documento de origem da OP
  // seguinte. Correção futura deve ser retificação auditável (D-C).
  // Retorna { bloqueada: bool, opLabel: string|null }.
  //   - bloqueada=true quando existe ops tipo='latex' com origem_entrega_id=entregaId.
  //   - Silenciosa em erro de leitura (fallback permissivo) para não
  //     travar o app por falha de infra; o gate server-side (D-C) é a
  //     defesa definitiva.
  async function entregaCimaTemOpLatex(entregaId) {
    try {
      var res = await window.supa
        .from('ops')
        .select('id, numero, ano')
        .eq('tipo', 'latex')
        .eq('origem_entrega_id', entregaId)
        .maybeSingle();
      if (res && res.error) return { bloqueada: false, opLabel: null };
      if (res && res.data && res.data.id) {
        var label = 'OP ' + res.data.numero + '/' + res.data.ano;
        return { bloqueada: true, opLabel: label };
      }
    } catch (err) {
      console.error('entrega-writes: preflight OP Latex falhou', err);
    }
    return { bloqueada: false, opLabel: null };
  }

  async function etapaDaEntrega(entregaId) {
    try {
      var res = await window.supa
        .from('entregas')
        .select('etapa')
        .eq('id', entregaId)
        .maybeSingle();
      if (res && res.data) return res.data.etapa || null;
    } catch (err) {
      console.error('entrega-writes: preflight etapa falhou', err);
    }
    return null;
  }

  // -------------------------------------------------------------------
  // D-C-C: detecção de erro do trigger server-side
  // `entrega_cima_latex_guard` (em entregas) e
  // `entrega_itens_cima_latex_guard` (em entrega_itens) — ver
  // db/24_tec_to_acabamento_guard.sql. Quando o app tenta editar/
  // excluir uma entrega cima já vinculada a OP de Látex, o PostgREST
  // retorna um erro com code P0001 e a mensagem do trigger em
  // error.message / error.details / error.hint. Esta função detecta
  // esse padrão e devolve true para que o callsite mostre um toast
  // amigável em vez de vazar a mensagem técnica do Postgres.
  // Não classifica erros genéricos como sendo do guard.
  var GUARD_UPDATE_MSG = 'Esta entrega já gerou OP de acabamento e não pode ser alterada. Abra a OP de acabamento ou use uma retificação autorizada.';
  var GUARD_DELETE_MSG = 'Esta entrega já gerou OP de acabamento e não pode ser excluída. Abra a OP de acabamento ou use uma retificação autorizada.';

  function isEntregaLatexGuardError(err) {
    if (!err) return false;
    var parts = [];
    if (typeof err.message === 'string') parts.push(err.message);
    if (typeof err.details === 'string') parts.push(err.details);
    if (typeof err.hint === 'string') parts.push(err.hint);
    if (typeof err.code === 'string') parts.push(err.code);
    if (parts.length === 0) return false;
    var blob = parts.join(' \u0001 ').toLowerCase();
    // Marcadores suficientes para identificar a mensagem do trigger
    // (PostgREST prefixa o message com "P0001:" e pode quebrar a
    // frase original em message/details; checamos ambos os ramos
    // do trigger para tolerar variações de formato).
    var isGuardCode = /p0001/.test(blob);
    var isGuardText = blob.indexOf('tecelagem vinculada a op de acabamento') !== -1
      || blob.indexOf('retifica') !== -1 && blob.indexOf('autorizada') !== -1;
    return isGuardText || (isGuardCode && blob.indexOf('tecelagem') !== -1);
  }

  // -------------------------------------------------------------------
  // Excluir entrega: usa o padrao de callback do confirmDialog (que so dispara
  // onConfirm em caso afirmativo). onSuccess() roda apos delete bem-sucedido.
  async function excluirEntrega(entregaId, onSuccess) {
    // D-B: entrega cima que gerou OP Latex não pode ser excluída —
    // deixaria a OP órfã (origem_entrega_id ON DELETE SET NULL).
    var etapa = await etapaDaEntrega(entregaId);
    if (etapa === 'cima') {
      var pre = await entregaCimaTemOpLatex(entregaId);
      if (pre.bloqueada) {
        window.toast('Entrega vinculada à ' + (pre.opLabel || 'OP de acabamento') + '. Exclusão bloqueada — use retificação.', 'error');
        return false;
      }
    }
    window.confirmDialog({
      title: 'Excluir entrega',
      message: 'Esta ação remove a entrega e todos os seus itens. Continuar?',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const r = await window.supa.from('entregas').delete().eq('id', entregaId);
        if (r.error) {
          if (isEntregaLatexGuardError(r.error)) {
            window.toast(GUARD_DELETE_MSG, 'error');
            console.error('entrega-writes: trigger entrega_cima_latex_guard', r.error);
            return;
          }
          window.toast('Erro ao excluir entrega', 'error'); console.error(r.error); return;
        }
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
    // D-B: se a entrega cima já gerou OP Latex, a edição livre criaria
    // divergência silenciosa (op_itens da OP Latex não é propagada).
    var pre = await entregaCimaTemOpLatex(entregaId);
    if (pre.bloqueada) {
      window.toast('Entrega vinculada à ' + (pre.opLabel || 'OP de acabamento') + '. Edição bloqueada — use retificação.', 'error');
      return false;
    }
    if (payload.linhas.length === 0) { window.toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
    if (!payload.destino_fornecedor_id) { window.toast('Escolha a empresa de látex de destino', 'error'); return false; }
    const upd = await window.supa.from('entregas').update({
      data: payload.data, observacao: payload.observacao,
      destino_fornecedor_id: payload.destino_fornecedor_id,
    }).eq('id', entregaId);
    if (upd.error) {
      if (isEntregaLatexGuardError(upd.error)) {
        window.toast(GUARD_UPDATE_MSG, 'error');
        console.error('entrega-writes: trigger entrega_cima_latex_guard', upd.error);
        return false;
      }
      window.toast('Erro ao atualizar entrega', 'error'); console.error(upd.error); return false;
    }
    const delItens = await window.supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
    if (delItens && delItens.error && isEntregaLatexGuardError(delItens.error)) {
      window.toast(GUARD_UPDATE_MSG, 'error');
      console.error('entrega-writes: trigger entrega_itens_cima_latex_guard', delItens.error);
      return false;
    }
    const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
    const insItens = await window.supa.from('entrega_itens').insert(itens);
    // MVP: se a reinsercao falhar aqui, a entrega fica sem itens. Como o app eh
    // single-admin e baixo volume, aceitamos o risco e a correcao manual via Supabase.
    if (insItens.error) {
      if (isEntregaLatexGuardError(insItens.error)) {
        window.toast(GUARD_UPDATE_MSG, 'error');
        console.error('entrega-writes: trigger entrega_itens_cima_latex_guard', insItens.error);
        return false;
      }
      window.toast('Erro ao regravar itens da entrega', 'error'); console.error(insItens.error); return false;
    }
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
