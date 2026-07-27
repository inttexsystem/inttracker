// =====================================================================
// === SCREENS: ORDEM DE COMPRA — RECEIPT EVENTS (PHASE-C4) =============
// Phase: PHASE-C4 (docs/architecture/ORDEM_COMPRA_C4_PHASE_CONTRACT.md,
// OC-C4-ADMIN-001). Wires the receipt registration and admin reversal
// actions to dedicated action modals (js/ui.js primitives only) and submits
// through ordem-compra-receipt-data.js's native writers. Owns the TWO
// independent in-memory idempotency attempt trackers (§12) — one for
// registration, one for reversal, never shared.
//
// Transition modals contain actions only (§R.16): the receipt entity,
// balances, allocations and full history stay on the dedicated screen
// (rendered by ordem-compra-receipt-render.js); these modals carry just the
// inputs needed to perform the transition. After a deterministic success the
// UI performs an authoritative server reload (never patches local state as
// the final truth). Deterministic rejections render as toasts with the form
// kept open; a genuinely ambiguous transport keeps the same token for a
// same-intent retry and never falls back to any other path.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.ordemCompra = window.RAVATEX_SCREENS.ordemCompra || {};

  var el = window.el;

  function fmtKg(v) {
    if (v == null) return '—';
    return (typeof window.fmtKg === 'function') ? window.fmtKg(v) : String(v);
  }
  function opLabel(opId) { return opId == null ? 'Pedido (compartilhada)' : ('OP ' + opId); }
  function fioLabel(row) {
    var mat = row.material === 'algodao' ? 'Algodão' : 'Poliéster';
    var cor = row.cor_poliester || (row.cor_id != null ? ('Cor ' + row.cor_id) : '—');
    return mat + ' · ' + cor;
  }
  function todayIso() { return new Date().toISOString().slice(0, 10); }

  var CODE_MESSAGES = {
    recebimento_canonico_inativo: 'Recebimento canônico inativo neste ambiente.',
    aceite_pendente: 'A ordem aguarda aceite; recebimento indisponível.',
    aceite_rejeitada: 'Aceite rejeitado; recebimento indisponível.',
    estado_invalido: 'Estado da ordem inválido para esta operação.',
    excede_alocacao: 'Quantidade acima do saldo da alocação.',
    excede_item: 'Quantidade acima do saldo do item.',
    excede_estornavel: 'Quantidade acima do saldo reversível.',
    idempotencia_conflitante: 'Conflito de idempotência; recarregue a ordem e tente novamente.',
    idempotencia_invalida: 'Chave de idempotência inválida.',
    sem_permissao: 'Sem permissão para esta ação.',
    fornecedor_incorreto: 'Fornecedor incorreto para esta ordem.',
    linha_invalida: 'Linhas de recebimento inválidas.',
    linhas_invalidas: 'Linhas de recebimento inválidas.',
    ordem_nao_encontrada: 'Ordem de compra não encontrada.',
    lancamento_invalido: 'Lançamento inválido para estorno.',
    item_invalido: 'Item inválido.',
    alocacao_invalida: 'Alocação inválida.',
    erro_interno: 'Erro interno ao processar a solicitação.',
  };

  function rejectionMessage(res) {
    if (res.outcome === 'hard_failure') {
      var code = res.codigo && CODE_MESSAGES[res.codigo];
      return code || (res.error && res.error.message) || 'Erro ao processar a solicitação.';
    }
    var data = res.result || {};
    return CODE_MESSAGES[data.codigo] || data.erro || 'Não foi possível concluir a ação.';
  }

  ns.createReceiptEvents = function (ctx) {
    var state = ctx.state || {};
    var reload = ctx.reload;
    var ordemId = ctx.ordemId;

    // Two independent attempt trackers (contract §12) — never shared, never
    // persisted outside these closures.
    var registrationTracker = ns.createReceiptAttemptTracker();
    var reversalTracker = ns.createReceiptAttemptTracker();

    // ---- Registration modal ------------------------------------------
    function abrirRegistroRecebimento() {
      var hist = state.receiptHistory;
      if (!hist || hist.ok !== true || !(hist.acoes && hist.acoes.receber)) {
        window.toast('Registro de recebimento indisponível para esta ordem.', 'error');
        return;
      }

      var dateInput = window.textInput({ type: 'date', value: todayIso() });
      var docInput = window.textInput({ placeholder: 'Documento / referência (opcional)' });
      var origemTipoInput = window.textInput({ placeholder: 'Ex.: nota_fiscal (opcional)' });
      var origemRefInput = window.textInput({ placeholder: 'Referência de origem (opcional)' });

      var body = el('div', {});
      body.appendChild(window.formField({ label: 'Data do recebimento', input: dateInput }));
      body.appendChild(window.formField({ label: 'Documento', input: docInput }));
      body.appendChild(window.formField({ label: 'Tipo de origem', input: origemTipoInput }));
      body.appendChild(window.formField({ label: 'Referência de origem', input: origemRefInput }));

      // One kg input per allocation + exactly one explicit "Excesso" row per
      // item. Excess is entered distinctly and never fabricates an allocation.
      var rows = [];
      (hist.itens || []).forEach(function (it) {
        body.appendChild(el('div', { class: 'mt-4 mb-1 text-xs font-semibold text-gray-500 uppercase' },
          fioLabel(it) + ' — restante ' + fmtKg(it.kg_restante)));
        (it.alocacoes || []).forEach(function (a) {
          var input = window.textInput({ placeholder: '0,000' });
          input.setAttribute('data-alocacao-id', String(a.alocacao_id));
          rows.push({ itemId: it.item_id, destino: 'alocacao', alocacaoId: a.alocacao_id, input: input });
          body.appendChild(window.formField({ label: opLabel(a.op_id) + ' — restante ' + fmtKg(a.kg_restante), input: input }));
        });
        var exInput = window.textInput({ placeholder: '0,000' });
        exInput.setAttribute('data-excesso-item', String(it.item_id));
        rows.push({ itemId: it.item_id, destino: 'excesso', input: exInput });
        body.appendChild(window.formField({
          label: 'Excesso (sem alocação)', input: exInput,
          hint: 'Quantidade recebida além do pedido; não vincula alocação nem OP.',
        }));
      });

      // Sticky total summary — stays visible above the modal footer even when
      // a multi-item order makes the body scroll (VISUAL-GATE-R1). Token colors.
      var totalEl = el('div', {
        id: 'oc-reg-total', class: 'text-sm font-semibold',
        style: 'position:sticky;bottom:0;margin:12px -24px 0;padding:10px 24px;'
          + 'background:var(--rv-color-surface);border-top:1px solid var(--rv-color-line-200);'
          + 'color:var(--rv-color-value);font-variant-numeric:tabular-nums;',
      });
      body.appendChild(totalEl);
      function recompute() {
        var aloc = 0, exc = 0;
        rows.forEach(function (r) {
          var kg = ns.parseKgInput(r.input.value);
          if (!(kg > 0)) return;
          if (r.destino === 'excesso') exc += kg; else aloc += kg;
        });
        totalEl.textContent = 'Alocado: ' + fmtKg(aloc) + ' · Excesso: ' + fmtKg(exc) + ' · Total: ' + fmtKg(aloc + exc);
      }
      rows.forEach(function (r) { r.input.addEventListener('input', recompute); });
      recompute();

      window.modal({
        title: 'Registrar recebimento',
        body: body,
        saveLabel: 'Registrar',
        onClose: function () { registrationTracker.complete(); },
        onSave: async function () {
          var linhas = ns.buildReceiptLinhas(rows.map(function (r) {
            return { itemId: r.itemId, destino: r.destino, alocacaoId: r.alocacaoId, kg: ns.parseKgInput(r.input.value) };
          }));
          if (!linhas.length) {
            window.toast('Informe ao menos uma quantidade maior que zero.', 'error');
            return false;
          }
          var params = {
            ordemId: ordemId,
            ocorridoEm: dateInput.value || null,
            documentoRef: docInput.value || null,
            origemTipo: origemTipoInput.value || null,
            origemRef: origemRefInput.value || null,
            linhas: linhas,
          };
          var intent = {
            ordemId: ordemId, ocorridoEm: params.ocorridoEm || '', documentoRef: params.documentoRef || '',
            origemTipo: params.origemTipo || '', origemRef: params.origemRef || '', sig: JSON.stringify(linhas),
          };
          var attempt = registrationTracker.resolveAttempt(intent);
          var res = await ns.registrarRecebimento(params, attempt);
          if (res.outcome === 'success') {
            registrationTracker.complete();
            window.toast('Recebimento registrado.', 'success');
            await reload();
            return; // closes the modal
          }
          if (res.outcome === 'ambiguous') {
            // Commit status unknown: retain the token (no complete()); a same-
            // intent resubmit reuses it. Never fall back to any other path.
            window.toast('Falha de conexão. A operação pode não ter sido concluída — tente novamente.', 'error');
            return false;
          }
          // Deterministic rejection / hard failure: new token next submission.
          registrationTracker.complete();
          window.toast(rejectionMessage(res), 'error');
          return false;
        },
      });
    }

    // ---- Reversal modal ----------------------------------------------
    function estornarLancamento(comando, lanc) {
      var hist = state.receiptHistory;
      if (!hist || !(hist.acoes && hist.acoes.estornar) || !(Number(lanc.kg_reversivel) > 0)) {
        window.toast('Estorno indisponível para este lançamento.', 'error');
        return;
      }

      var kgInput = window.textInput({ value: '', placeholder: '0,000' });
      kgInput.setAttribute('data-reversal-kg', String(lanc.id));
      // B1: a row-sized textarea declares no minimum — the rows attribute is
      // its geometry — so it takes the canonical `rows` role. The reversal
      // reason itself, its placeholder and the submit handling that reads it
      // are unchanged; the two deprecated compatibility tokens it used to
      // reference (--rv-color-input-border, --rv-radius-control) are retired
      // with the inline style, because css/tokens.css now owns the border.
      var motivoInput = window.textArea({
        role: 'rows',
        rows: 3,
        placeholder: 'Motivo do estorno',
        ariaLabel: 'Motivo do estorno',
      });

      var body = el('div', {});
      body.appendChild(el('div', { class: 'text-sm text-gray-600 mb-3' },
        'Lançamento #' + lanc.id + ' — ' + fioLabel(lanc) + ' · ' + opLabel(lanc.op_id)
        + ' · reversível ' + fmtKg(lanc.kg_reversivel) + '.'));
      body.appendChild(window.formField({ label: 'Quantidade a estornar (kg)', input: kgInput }));
      body.appendChild(window.formField({ label: 'Motivo', input: motivoInput }));

      var modalRef = window.modal({
        title: 'Estornar recebimento',
        body: body,
        saveLabel: 'Estornar',
        danger: true,
        onClose: function () { reversalTracker.complete(); },
        onSave: function () {
          var kg = ns.parseKgInput(kgInput.value);
          var motivo = String(motivoInput.value || '').trim();
          if (!(kg > 0)) { window.toast('Informe uma quantidade válida.', 'error'); return false; }
          if (kg > Number(lanc.kg_reversivel)) { window.toast('Quantidade acima do saldo reversível.', 'error'); return false; }
          if (!motivo) { window.toast('Informe o motivo do estorno.', 'error'); return false; }

          // Guard 6 (§8.1): confirmDialog before execution — reversal never
          // fires on a single click. Executed inside onConfirm; the reversal
          // modal is kept open (onSave returns false) and is closed on
          // success. Cancelling the confirm leaves the reversal modal open.
          window.confirmDialog({
            title: 'Confirmar estorno',
            message: 'Estornar ' + fmtKg(kg) + ' do lançamento #' + lanc.id + '? Esta ação é irreversível.',
            confirmLabel: 'Estornar',
            onConfirm: async function () {
              var params = {
                ordemId: ordemId,
                motivo: motivo,
                linhas: ns.buildReversalLinhas(lanc.id, kg),
              };
              var intent = { ordemId: ordemId, lancamentoId: lanc.id, kg: kg, motivo: motivo };
              var attempt = reversalTracker.resolveAttempt(intent);
              var res = await ns.estornarRecebimento(params, attempt);
              if (res.outcome === 'success') {
                reversalTracker.complete();
                window.toast('Estorno registrado.', 'success');
                modalRef.close();
                await reload();
                return;
              }
              if (res.outcome === 'ambiguous') {
                window.toast('Falha de conexão. A operação pode não ter sido concluída — tente novamente.', 'error');
                return; // retain token; reversal modal stays open
              }
              reversalTracker.complete();
              window.toast(rejectionMessage(res), 'error');
            },
          });
          return false;
        },
      });
    }

    return {
      abrirRegistroRecebimento: abrirRegistroRecebimento,
      estornarLancamento: estornarLancamento,
    };
  };
})(window);
