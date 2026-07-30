// =====================================================================
// === ORDEM DE COMPRA — ENTITY ACTIONS =================================
// Purchase orders retain lifecycle consultation, cancellation, and — from
// PHASE-C5 (OC-C5-EMISSION-001) — native emission. F2 moved purchasing
// distribution to Pedido / Insumos; no order-first item or allocation writer
// remains reachable from this module.
//
// Emission (§R.22.5) uses ONLY public.emitir_ordem_compra(BIGINT) via the
// ordem-compra-data.js wrapper, gated by the server acoes.emitir signal
// (never recomputed here). It is a CONTROLLED_IRREVERSIBLE_TRANSITION (§21):
// an explicit confirmation modal (js/ui.js modal(), primary/neutral — NOT the
// destructive-red confirmDialog), an in-flight duplicate-submit guard, a fixed
// pt-BR message per deterministic writer codigo (no retry, no fallback writer),
// an authoritative reload after a deterministic success, and reload-first
// resolution of an ambiguous transport (§8 — the RPC has no idempotency key).
// No acceptance/rejection control exists here (PHASE-C5B is not authorized).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  var el = window.el;

  // Fixed pt-BR messages for the emitir_ordem_compra deterministic vocabulary
  // (db/68 body: the eight ordered codes) plus the call-time permission-denied
  // (42501) and missing-function (PGRST202) cases. No raw SQL / stack traces are
  // ever surfaced (§7); any unmapped deterministic result falls back to a clean
  // generic message.
  var EMISSAO_CODE_MESSAGES = {
    sem_permissao: 'Sem permissão para emitir esta ordem.',
    nao_encontrada: 'Ordem de compra não encontrada.',
    ordem_legado: 'Ordem legado não pode ser emitida por esta via.',
    estado_invalido: 'Somente uma ordem em rascunho pode ser emitida.',
    sem_fornecedor: 'Defina o fornecedor da ordem antes de emitir.',
    sem_itens: 'A ordem não possui itens para emitir.',
    alocacao_incompleta: 'A distribuição de necessidades está incompleta; conclua a alocação de todos os itens.',
    alocacao_incoerente: 'Há alocações incoerentes com o Pedido ou com o material/cor do item.',
    '42501': 'Sem permissão para emitir esta ordem.',
  };

  function emissionRejectionMessage(res) {
    var codigo = res.codigo || (res.result && res.result.codigo);
    if (codigo && EMISSAO_CODE_MESSAGES[codigo]) return EMISSAO_CODE_MESSAGES[codigo];
    return 'Não foi possível emitir a ordem.';
  }
  ns.emissionRejectionMessage = emissionRejectionMessage;

  async function rpcWrite(name, params, successMsg) {
    var result = await window.supa.rpc(name, params);
    if (result.error || !result.data || result.data.ok !== true) {
      var data = result.data || {};
      window.toast(data.erro || 'Não foi possível concluir a ação.', 'error');
      return null;
    }
    window.toast(successMsg, 'success');
    return result.data;
  }

  ns.rpcWrite = rpcWrite;

  ns.createEvents = function (ctx) {
    var state = ctx.state || {};
    var reload = ctx.reload;
    // NAO capture aqui nenhum campo de `state`. screenOrdemCompra chama esta
    // fabrica ANTES de loadOrdemDetail, e os carregadores REATRIBUEM
    // `state.ordem` — um `var ordem = state.ordem || {}` a esta altura congela
    // o valor inicial nulo para sempre. Foi exatamente isso que quebrou o
    // cancelamento (p_ordem_id: undefined -> PGRST202 -> erro generico).
    // Guarde apenas o CONTAINER `state` e leia `state.<campo>` no momento do
    // clique, ou receba o registro atual como argumento do handler.

    // Local, in-memory emission attempt tracker (contract §9/§13). Its token is
    // NEVER transmitted (emitir_ordem_compra has no idempotency parameter); it is
    // purely local bookkeeping so a same-attempt transport-ambiguous retry is
    // distinguished from a new deliberate attempt.
    var emissionTracker = ns.createEmissionAttemptTracker();

    return {
      // `o` is the CURRENT order handed over by the render layer at click time.
      // It MUST be read here and not from the `ordem` closure above:
      // createEvents() runs in screenOrdemCompra BEFORE loadOrdemDetail, so
      // that closure captured `state.ordem` while it was still null and never
      // saw the loaded order. Cancelling therefore sent p_ordem_id: undefined;
      // supabase-js drops an undefined key, PostgREST received {} , found no
      // zero-argument cancelar_ordem_compra() and answered PGRST202 — which the
      // client could only report as the generic "Não foi possível concluir a
      // ação.". The RPC was never reached and no order was ever cancelled.
      // `emitir` below already reads its order at click time for this reason.
      cancelar: function (o) {
        var atual = o || state.ordem || {};
        var ordemId = atual.ordem_id;
        if (ordemId == null) {
          window.toast('Ordem de compra inválida.', 'error');
          return;
        }
        var nome = ns.ocLabel(ordemId, state);
        window.confirmDialog({
          title: 'Cancelar ordem de compra',
          message: 'Cancelar a ordem ' + nome + '? A distribuição não será alterada por esta ação.',
          confirmLabel: 'Cancelar ordem',
          onConfirm: async function () {
            var data = await rpcWrite('cancelar_ordem_compra', { p_ordem_id: ordemId }, 'Ordem cancelada.');
            if (data) await reload();
          },
        });
      },

      // EXCLUIR — remocao permanente. Como `cancelar`, le a ordem no momento
      // do clique. A confirmacao nomeia a OC pelo codigo de negocio visivel e
      // diz exatamente o que desaparece; a chave primaria continua sendo so o
      // argumento tecnico da RPC.
      excluir: function (o) {
        var atual = o || state.ordem || {};
        var ordemId = atual.ordem_id;
        if (ordemId == null) {
          window.toast('Ordem de compra inválida.', 'error');
          return;
        }
        var nome = ns.ocLabel(ordemId, state);
        var body = el('div', { style: 'color:var(--rv-color-text);font-size:13.5px;line-height:1.55;' });
        body.appendChild(el('p', { class: 'mb-2' },
          'Excluir permanentemente a ordem ' + nome + '?'));
        body.appendChild(el('p', { class: 'mb-2' },
          'A ordem, os seus itens e as suas alocações são removidos definitivamente. '
          + 'As quantidades alocadas voltam a ficar disponíveis nas necessidades do Pedido.'));
        body.appendChild(el('p', { class: 'mb-0', style: 'color:var(--rv-color-muted);' },
          'Esta ação não pode ser desfeita. Para preservar a ordem no histórico, use Cancelar.'));
        var submitting = false;
        window.modal({
          title: 'Excluir ordem de compra ' + nome,
          body: body,
          saveLabel: 'Excluir definitivamente',
          danger: true,
          onSave: async function () {
            if (submitting) return false;
            submitting = true;
            var data = await ns.excluirOrdem(ordemId);
            submitting = false;
            if (!data || data.ok !== true) {
              // A recusa do servidor e mostrada literalmente: elegibilidade e
              // decisao dele, e o operador precisa saber qual foi o motivo.
              window.toast((data && data.erro) || 'Não foi possível excluir a ordem.', 'error');
              return false;
            }
            window.toast('Ordem ' + nome + ' excluída.', 'success');
            // A entidade aberta deixou de existir: voltar para a lista e
            // recarregar dela, nunca renderizar um detalhe orfao.
            window.navigate('#/ordens-compra');
            return true;
          },
        });
      },

      // Emission (PHASE-C5). `o` is the CURRENT order passed by the render layer
      // (handlers.emitir(o)) — read at click time so a re-render's fresh order is
      // used, not a stale closure snapshot. Enablement was already decided by the
      // server acoes.emitir flag in the render layer; this only performs the
      // controlled irreversible transition behind an explicit confirmation.
      emitir: function (o) {
        var order = o || state.ordem || {};
        var ordemId = order.ordem_id;
        if (ordemId == null) {
          window.toast('Ordem de compra inválida.', 'error');
          return;
        }

        // CONTROLLED_IRREVERSIBLE_TRANSITION copy (§21): explains the resulting
        // state (leaves rascunho → emitida; items/allocations frozen), that this
        // is NOT an edit to items/distribution, and the irreversibility. The
        // modal holds ONLY this explanation + the confirmation — the
        // purchase-order entity stays on #/ordens-compra/:id, never duplicated
        // here (§R.16).
        // OP-CANONICAL-IDENTITY-REFOUNDATION-R1 (completion): a confirmacao de
        // uma transicao irreversivel precisa nomear a ordem pela identidade que
        // o operador reconhece. `ordemId` (o BIGSERIAL) segue sendo apenas o
        // argumento tecnico do RPC, nunca o nome exibido.
        var ocNome = window.RAVATEX_SCREENS.ordemCompra.ocLabel(ordemId, state);
        var body = el('div', { style: 'color:var(--rv-color-text);font-size:13.5px;line-height:1.55;' });
        body.appendChild(el('p', { class: 'mb-2' },
          'Emitir a ordem ' + ocNome + ' a retira do rascunho e a marca como emitida.'));
        body.appendChild(el('p', { class: 'mb-2' },
          'Após a emissão, os itens e as alocações ficam congelados. Esta ação não edita itens nem a distribuição.'));
        body.appendChild(el('p', { class: 'mb-0', style: 'color:var(--rv-color-muted);' },
          'A emissão é definitiva — o único caminho de reversão é cancelar a ordem. Esta ordem não exige aceite.'));

        // Mint the local attempt on modal open (§13).
        emissionTracker.resolveAttempt({ ordemId: ordemId });

        // Per-modal in-flight guard: a second confirm click while the first
        // request is in flight is a no-op (§8, duplicate-submit prevention). The
        // shared modal() additionally disables its confirm control during onSave.
        var submitting = false;

        window.modal({
          title: 'Emitir ordem de compra ' + ocNome,
          body: body,
          saveLabel: 'Emitir ordem',
          // `danger` omitted → primary/neutral (blue) treatment, NOT destructive-red.
          onClose: function () { emissionTracker.complete(); },
          onSave: async function () {
            if (submitting) return false;
            submitting = true;
            try {
              var res = await ns.emitirOrdem(ordemId);

              if (res.outcome === 'success') {
                emissionTracker.complete();
                window.toast('Ordem emitida.', 'success');
                await reload();               // authoritative reload; no local state fabrication
                return;                        // closes the modal
              }

              if (res.outcome === 'ambiguous') {
                // No idempotency key exists (§8/§9): do NOT auto-retry and do NOT
                // call another writer. Reload authoritatively exactly once; the
                // server state resolves the honest uncertainty. The token is
                // retained across the ambiguity, then released once the reload
                // resolves it.
                window.toast('Falha de conexão; o resultado é incerto. Verificando o estado da ordem…', 'error');
                await reload();
                emissionTracker.complete();
                var now = state.ordem;
                var sameOrder = !!now && now.ordem_id === ordemId;

                if (sameOrder && now.status_administrativo === 'emitida') {
                  window.toast('A ordem foi emitida.', 'success');
                  return;                      // closes the modal; the screen shows emitida
                }

                if (sameOrder && now.status_administrativo === 'rascunho') {
                  // The reloaded Emitir button (render layer, gated on the
                  // server acoes.emitir flag) is the deliberate retry — only
                  // describe it as available when the server itself says so.
                  var podeReemitir = !!(now.acoes && now.acoes.emitir === true);
                  window.toast(
                    podeReemitir
                      ? 'A ordem continua em rascunho. Você pode tentar emitir novamente.'
                      : 'A ordem continua em rascunho.',
                    'info'
                  );
                  return;
                }

                // The reload failed, returned no order, returned a different
                // order, or returned an unrecognized state: the emission
                // result is genuinely unknown. Never assert draft or emitted —
                // preserve honest uncertainty. No automatic retry, no
                // fallback writer, no raw transport detail exposed.
                window.toast('Não foi possível confirmar o resultado da emissão. Recarregue a ordem antes de tentar novamente.', 'error');
                return;
              }

              // Deterministic rejection / hard failure: fixed pt-BR message, no
              // retry, no fallback writer, new token next attempt. Keep the modal
              // open so the user reads the reason and cancels deliberately.
              emissionTracker.complete();
              window.toast(emissionRejectionMessage(res), 'error');
              return false;
            } finally {
              submitting = false;
            }
          },
        });
      },
    };
  };
})(window);
