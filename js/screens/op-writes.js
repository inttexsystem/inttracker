// =====================================================================
// === SCREENS: OP WRITES (Seam A) ======================================
// Helpers de write de OP extraídos do <script> inline de index.html,
// de dentro de screenNovaOP. Concentra:
//
//   - registrarRecebimentoOrdemFio(...)
//   - definirEmborracharOpItem(...) (TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1)
//
// P2-A aposentou atribuirFornecedorFioOp e sua exportação em window (ver o
// bloco APOSENTADO abaixo).
//
// Carregar via <script src="js/screens/op-writes.js"></script> no
// <head>, DEPOIS de js/screens/op-form-helpers.js e ANTES de jspdf +
// script inline principal. As telas inline (screenNovaOP)
// referenciam os helpers acima com prefixo `window.` (call-sites
// explícitos).
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa (js/supabase-client.js) — client Supabase + write-guard
//   - window.RAVATEX_SCREENS.ordemCompraReceiptCutover
//     (js/screens/ordem-compra-receipt-cutover.js) — PHASE-C3C-B legacy-compat
//     receipt adapter; registrarRecebimentoOrdemFio attempts it first and
//     falls back to the exact pre-phase flat UPDATE (§32 of
//     docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md)
//
// NÃO depende de: window.toast, window.navigate, window.CURRENT_USER.
// NÃO faz select ou rpc diretamente — apenas update, delete, insert, e a
// delegação ao adapter acima (que por sua vez isola o único rpc do arquivo).
//
// Compatibilidade: window.registrarRecebimentoOrdemFio segue disponível para
// os call-sites do inline.
// =====================================================================

(function (window) {
  'use strict';

  // PHASE-C3C-B (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md §32,
  // corrected §34): attempts the canonical legacy-compat receipt adapter
  // first; falls back to the exact pre-phase flat UPDATE, byte-identical,
  // only on the documented inactive signal or the bounded missing-function
  // condition. Never issues both writes for one successful attempt. The
  // adapter is resolved at call time (not module load), matching this
  // file's existing window.supa convention.
  //
  // `attempt` (optional): a receipt-attempt object from the adapter's
  // createReceiptAttempt()/createAttemptTracker().resolveAttempt(). Every
  // real authorized receipt UI call-site owns and passes its own attempt so
  // a retry of unchanged intent reuses the same idempotency token (§34); if
  // omitted, a fresh attempt is created internally for backward
  // compatibility with any caller not yet supplying one.
  //
  // Return shape adds `ambiguous` (boolean) alongside the existing
  // `{ data, error }` contract every caller already checks: `ambiguous:
  // true` means the RPC call itself failed with unknown server commit
  // status (network/timeout) — the caller must retain its attempt for a
  // retry of unchanged intent, never treat it as done. `ambiguous: false`
  // means the outcome was deterministic (success, legacy fallback, or a
  // recognized/unrecognized server rejection) — the caller should close its
  // attempt lifecycle.
  async function registrarRecebimentoOrdemFio({
    ordemId,
    kgRecebido,
    dataRecebimento,
    status,
    attempt,
  }) {
    var cutover = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
    if (cutover) {
      var useAttempt = attempt || cutover.createReceiptAttempt();
      var canonical = await cutover.attemptCanonicalReceipt({
        ordensCompraFioId: ordemId,
        kgTotalAbsoluto: kgRecebido,
        dataRecebimento: dataRecebimento,
      }, useAttempt);
      if (canonical.outcome === 'canonical_success') {
        return { data: canonical.result, error: null, ambiguous: false };
      }
      if (canonical.outcome === 'ambiguous_failure') {
        return { data: null, error: canonical.error, ambiguous: true };
      }
      if (canonical.outcome === 'hard_failure') {
        return {
          data: null,
          error: canonical.error || Object.assign(
            new Error((canonical.result && (canonical.result.erro || canonical.result.codigo)) || 'Falha ao registrar recebimento'),
            { codigo: canonical.result && canonical.result.codigo }
          ),
          ambiguous: false,
        };
      }
      // outcome === 'legacy_fallback' — fall through to the exact existing
      // flat write below.
    }
    var flat = await window.supa
      .from('ordens_compra_fio')
      .update({
        kg_recebido: kgRecebido,
        data_recebimento: dataRecebimento,
        status,
      })
      .eq('id', ordemId);
    return Object.assign({}, flat, { ambiguous: false });
  }

  // db/124 + TECELAGEM-V1-EMBORRACHAR-ADMIN-SURFACE-R1: escreve a
  // especificação de emborrachar (definida pela Ravatex) para UM op_item.
  // `valor` é a string escolhida (deve corresponder a cor_1/cor_2 do modelo
  // do item, resolvida pelo chamador) ou `null` para voltar ao estado "não
  // definido". Escrita direta (sem RPC): op_itens_admin (db/03) já concede
  // UPDATE irrestrito de coluna para is_admin(), o mesmo mecanismo que já
  // sustenta o update de metros_pedidos em op-latex-admin.js.
  async function definirEmborracharOpItem({ opItemId, valor }) {
    return await window.supa
      .from('op_itens')
      .update({ emborrachar: valor })
      .eq('id', opItemId);
  }

  // -------------------------------------------------------------------
  // APOSENTADO — atribuirFornecedorFioOp
  //
  // NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 12; fecha
  // DEBT-1-ATRIBUIR-FORNECEDOR-FIO-SEM-CHAMADOR). A decisão do supervisor é
  // APOSENTAR, não "aposentar ou repontar".
  //
  // O que existia aqui gravava DIRETO no modelo PLANO em dois writes soltos e
  // não transacionais: UPDATE ordens_compra_fio.fornecedor_id por (op_id,
  // tipo), seguido de DELETE + INSERT em op_fornecedores. Não tinha nenhum
  // chamador na aplicação, e a escolha de fornecedor de compra passou a ser
  // feita em Pedido -> Insumos, pelo planejamento nativo, contra
  // necessidade_compra_planejamento e ordem_compra.
  //
  // NENHUM escritor manual de alocação substitui este: quem aloca compra é o
  // escritor do servidor. Não reintroduzir este símbolo, nem sua exportação em
  // window, nem seus dois writes planos.
  // -------------------------------------------------------------------

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opWrites = {
    ...window.RAVATEX_SCREENS.opWrites,
    registrarRecebimentoOrdemFio,
    definirEmborracharOpItem,
  };

  window.registrarRecebimentoOrdemFio = registrarRecebimentoOrdemFio;
  window.definirEmborracharOpItem = definirEmborracharOpItem;
})(window);
