// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RECEIPT DATA (PHASE-C4) ===============
// Phase: PHASE-C4 (docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md,
// OC-C4-ADMIN-001). Data layer for the admin receipt UI on the dedicated
// purchase-order detail screen (#/ordens-compra/:id). Reopens the shared
// window.RAVATEX_SCREENS.ordemCompra namespace (like ordem-compra-data.js).
//
// Owns, and ONLY owns:
//   - the canonical receipt/history read model
//     (obter_historico_recebimento_ordem_compra);
//   - the native receipt writer (registrar_recebimento_ordem_compra);
//   - the admin reversal writer (estornar_recebimento_ordem_compra);
//   - its OWN idempotency-token / attempt-tracker / transport-ambiguity
//     primitives.
//
// Binding scoping rule (contract §8): these primitives are a structurally
// INDEPENDENT re-implementation of the pattern in
// ordem-compra-receipt-cutover.js — this module NEVER imports, calls, or
// extends that legacy-compat adapter, and the native writers here NEVER fall
// back to registrar_recebimento_ordem_compra_fio_compat, any flat-table
// mutation, or any other RPC. No DOM, no rendering (CODE_HEALTH §9): rendering
// lives in ordem-compra-receipt-render.js; modal wiring in
// ordem-compra-receipt-events.js.
//
// Dependency resolved at call time: window.supa (js/supabase-client.js).
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: todos os `op_id` alcancaveis no
  // read model de recebimento — alocacoes por item e lancamentos por comando.
  // Deliberadamente tolerante a forma: uma colecao ausente contribui zero em
  // vez de lancar, porque a unica consequencia de perder um id e a tela
  // mostrar o estado diagnostico daquela linha, nunca a chave primaria.
  function coletarOpIds(hist) {
    var ids = [];
    ((hist && hist.itens) || []).forEach(function (it) {
      ((it && it.alocacoes) || []).forEach(function (a) {
        if (a && a.op_id != null) ids.push(a.op_id);
      });
    });
    ((hist && hist.comandos) || []).forEach(function (c) {
      ((c && c.lancamentos) || []).forEach(function (l) {
        if (l && l.op_id != null) ids.push(l.op_id);
      });
    });
    return ids;
  }

  // ---- Idempotency primitives (independent copy, contract §8) ----------
  // A fresh random token per deliberate submission attempt. Reused verbatim
  // as p_idempotency_key ONLY across a retry of the same in-flight attempt
  // (genuinely ambiguous transport); a new token is minted after any
  // deterministic outcome (success or deterministic rejection). Never
  // persisted (no localStorage/sessionStorage/URL/global state).
  function newReceiptIdempotencyToken() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'c4-recb-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  ns.newReceiptIdempotencyToken = newReceiptIdempotencyToken;

  function createReceiptAttempt() {
    return { token: newReceiptIdempotencyToken() };
  }

  // One tracker per open action modal (one for registration, one for
  // reversal — never shared). resolveAttempt(intent) returns the retained
  // attempt when `intent` is shallow-equal to the last unresolved attempt's
  // intent, otherwise mints a fresh attempt. complete() closes the current
  // attempt so the next resolveAttempt mints a new token — call it after any
  // DETERMINISTIC outcome, and NOT after an ambiguous one.
  function createReceiptAttemptTracker() {
    var attempt = null;
    var intent = null;

    function sameIntent(a, b) {
      if (!a || !b) return false;
      var aKeys = Object.keys(a);
      var bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(function (key) { return a[key] === b[key]; });
    }

    return {
      resolveAttempt: function (currentIntent) {
        if (attempt && sameIntent(intent, currentIntent)) return attempt;
        attempt = createReceiptAttempt();
        intent = currentIntent;
        return attempt;
      },
      complete: function () {
        attempt = null;
        intent = null;
      },
    };
  }
  ns.createReceiptAttemptTracker = createReceiptAttemptTracker;

  // The FINITE "commit status genuinely unknown" signal, grounded in the real
  // @supabase/postgrest-js response shape: a fetch() rejection (network/DNS/
  // timeout/abort/CORS) is the ONLY path that yields status === 0 with a
  // present error. Every deterministic server response carries a real HTTP
  // status. Never inferred from message text.
  function isReceiptTransportAmbiguous(res) {
    return !!res && !!res.error && res.status === 0;
  }
  ns.isReceiptTransportAmbiguous = isReceiptTransportAmbiguous;

  // ---- Pure payload builders (testable in isolation, CODE_HEALTH §8) ----
  // pt-BR decimal-comma tolerant kg parser: "183,000" -> 183, "1.234,5" ->
  // 1234.5 (comma present => dots are thousands), "12.5" -> 12.5.
  function parseKgInput(str) {
    if (str == null) return NaN;
    var s = String(str).trim();
    if (s === '') return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s);
  }
  ns.parseKgInput = parseKgInput;

  // Builds the exact allocation-shaped p_linhas array the native writer
  // requires. rows: [{ itemId, destino:'alocacao'|'excesso', alocacaoId?, kg }].
  // Only rows with kg > 0 are emitted. An 'excesso' line carries NO
  // alocacao_id key (the server rejects an excess line that has one), never a
  // fabricated allocation or OP.
  function buildReceiptLinhas(rows) {
    return (rows || [])
      .filter(function (r) { return r && Number(r.kg) > 0; })
      .map(function (r) {
        if (r.destino === 'excesso') {
          return { item_id: r.itemId, destino: 'excesso', kg: Number(r.kg) };
        }
        return { item_id: r.itemId, destino: 'alocacao', alocacao_id: r.alocacaoId, kg: Number(r.kg) };
      });
  }
  ns.buildReceiptLinhas = buildReceiptLinhas;

  // Reversal p_linhas: one line, targeting a single receipt lançamento by its
  // canonical id (input key is `lancamento_id`, not `estorno_de_id`).
  function buildReversalLinhas(lancamentoId, kg) {
    return [{ lancamento_id: lancamentoId, kg: Number(kg) }];
  }
  ns.buildReversalLinhas = buildReversalLinhas;

  // Classifies a window.supa.rpc() result for a native receipt/reversal
  // writer into one deterministic-or-ambiguous outcome:
  //   'success'      — data.ok === true (deterministic): mint a new token next.
  //   'rejected'     — data.ok === false with a business codigo
  //                    (deterministic, e.g. recebimento_canonico_inativo,
  //                    excede_alocacao, aceite_pendente): mint a new token.
  //   'hard_failure' — an RPC error that carried a real HTTP status
  //                    (deterministic; e.g. sem_permissao/42501): new token.
  //   'ambiguous'    — status === 0 (transport unknown): RETAIN the token for
  //                    a same-intent retry; never fall back to another path.
  function classifyReceiptWriteResult(res) {
    if (res && res.error) {
      if (isReceiptTransportAmbiguous(res)) {
        return { outcome: 'ambiguous', error: res.error };
      }
      return { outcome: 'hard_failure', error: res.error, codigo: (res.error.code || null) };
    }
    var data = (res && res.data) || {};
    if (data.ok === true) return { outcome: 'success', result: data };
    return { outcome: 'rejected', result: data, codigo: (data.codigo || null) };
  }
  ns.classifyReceiptWriteResult = classifyReceiptWriteResult;

  // ---- Read model ------------------------------------------------------
  // Loads the canonical immutable receipt/history projection for a NATIVE
  // order and writes it onto state.receiptHistory. Never reconstructs receipt
  // authority via client-side joins, and never infers action availability
  // from local status fields — action availability comes only from the
  // server-derived `acoes` object in the projection.
  //   state.receiptHistory shape:
  //     { loading: true }             — in flight;
  //     null                          — not a native order (no section);
  //     <projection data>             — { ok:true, itens, comandos, acoes, ... };
  //     { ok:false, codigo, erro }    — deterministic load failure.
  ns.loadReceiptHistory = async function (ordemId, state) {
    var o = state && state.ordem;
    if (!o || o.modelo !== 'nativo') {
      state.receiptHistory = null;
      return null;
    }
    state.receiptHistory = { loading: true };
    var res = await window.supa.rpc('obter_historico_recebimento_ordem_compra', { p_ordem_id: ordemId });
    if (res.error) {
      state.receiptHistory = {
        ok: false,
        codigo: res.error.code || 'erro',
        erro: res.error.message || 'Erro ao carregar recebimentos.',
      };
      return 'erro';
    }
    if (!res.data || res.data.ok !== true) {
      state.receiptHistory = res.data || { ok: false, codigo: 'desconhecido' };
      return (res.data && res.data.codigo) || 'recusado';
    }
    state.receiptHistory = res.data;
    // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: a RPC aceita atribui a origem de
    // cada alocacao e lancamento apenas por `op_id`. A identidade canonica vem
    // de public.op_identidade_projecao (db/95), resolvida UMA vez por carga
    // para os ids realmente exibidos. Falha de leitura devolve mapa vazio e a
    // tela mostra o estado diagnostico — nunca a chave primaria.
    state.opIdentidades = await ns.carregarIdentidadesOp(coletarOpIds(res.data));
    return null;
  };

  // ---- Writers (native RPCs only; no legacy/flat fallback ever) --------
  // params: { ordemId, ocorridoEm, documentoRef, origemTipo, origemRef,
  //           linhas }. `attempt` is the object from the caller's tracker;
  // its token is sent verbatim as p_idempotency_key (including on a retained
  // ambiguous retry).
  ns.registrarRecebimento = async function (params, attempt) {
    var res = await window.supa.rpc('registrar_recebimento_ordem_compra', {
      p_ordem_id: params.ordemId,
      p_idempotency_key: attempt && attempt.token,
      p_ocorrido_em: params.ocorridoEm || null,
      p_documento_ref: params.documentoRef || null,
      p_origem_tipo: params.origemTipo || null,
      p_origem_ref: params.origemRef || null,
      p_linhas: params.linhas,
    });
    return classifyReceiptWriteResult(res);
  };

  // params: { ordemId, ocorridoEm, motivo, linhas }.
  ns.estornarRecebimento = async function (params, attempt) {
    var res = await window.supa.rpc('estornar_recebimento_ordem_compra', {
      p_ordem_id: params.ordemId,
      p_idempotency_key: attempt && attempt.token,
      p_ocorrido_em: params.ocorridoEm || null,
      p_motivo: params.motivo || null,
      p_linhas: params.linhas,
    });
    return classifyReceiptWriteResult(res);
  };
})(window);
