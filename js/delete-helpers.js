// =====================================================================
// === CONTROLLED DELETE HELPERS =======================================
// Ponto unico de exclusao fisica temporaria em ambiente de testes.
// Telas chamam RPCs transacionais; nao ha delete direto no front-end.
// =====================================================================

(function (window) {
  'use strict';

  var MSG_ENTREGA = 'Não é possível excluir: existe entrega vinculada. Exclua a entrega antes.';
  var MSG_EXPEDICAO = 'A expedição vinculada entra na exclusão controlada de teste com EXCLUIR TUDO.';
  var MSG_FILHA = 'Não é possível excluir esta OP: existe OP de Acabamento vinculada. Exclua a OP filha primeiro.';
  var MSG_DOCUMENTAL = 'Não é possível excluir: o histórico canônico de vínculos documentais bloqueia a exclusão física. Ajuste o vínculo pelo fluxo documental humano antes de tentar remover.';
  var MSG_FORTE = 'Digite EXCLUIR para confirmar.';
  var MSG_CASCADE_FORTE = 'Esta exclusão remove cadeia produtiva de teste: OPs, entregas, itens e vínculos. Digite EXCLUIR TUDO para confirmar.';
  var MSG_AVISO = 'Esta ação é irreversível no ambiente de testes.';

  function normalizeResult(res) {
    if (res && res.error) {
      return { ok: false, blocked: true, reason: res.error.message || 'Falha na RPC.', impacto: null };
    }
    return res && res.data ? res.data : res;
  }

  async function callRpc(fn, params) {
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      return { ok: false, blocked: true, reason: 'Cliente Supabase indisponível.', impacto: null };
    }
    try {
      return normalizeResult(await window.supa.rpc(fn, params));
    } catch (err) {
      return { ok: false, blocked: true, reason: err && err.message ? err.message : 'Falha de comunicação.', impacto: null };
    }
  }

  function diagnosticarPedido(pedidoId) {
    return callRpc('diagnosticar_impacto_pedido', { p_pedido_id: pedidoId });
  }

  function diagnosticarOP(opId) {
    return callRpc('diagnosticar_impacto_op', { p_op_id: Number(opId) });
  }

  function removerPedido(pedidoId, options) {
    options = options || {};
    return callRpc('remover_pedido', {
      p_pedido_id: pedidoId,
      p_confirmacao: options.confirmacao || null
    });
  }

  function removerOP(opId, options) {
    options = options || {};
    return callRpc('remover_op', {
      p_op_id: Number(opId),
      p_confirmacao: options.confirmacao || null
    });
  }

  function countValue(impacto, key) {
    var counts = impacto && impacto.counts ? impacto.counts : {};
    var value = Number(counts[key] || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function buildImpactSummary(impacto) {
    impacto = impacto || {};
    var counts = impacto.counts || {};
    var labels = [
      ['pedido_itens', 'Itens do pedido'],
      ['pedido_eventos', 'Eventos do pedido'],
      ['pedido_cliente_eventos', 'Eventos visíveis ao cliente'],
      ['pedido_parciais', 'Parciais'],
      ['pedido_parcial_itens', 'Itens de parciais'],
      ['lotes', 'Lotes'],
      ['ops_vinculadas', 'OPs vinculadas'],
      ['ops_tecelagem', 'OPs de Tecelagem'],
      ['ops_latex_acabamento', 'OPs de Acabamento'],
      ['op_itens', 'Itens da OP'],
      ['op_eventos', 'Eventos da OP'],
      ['fornecedores', 'Fornecedores vinculados'],
      ['ordens_compra_fio', 'Ordens de fio'],
      ['saldo_fios_op', 'Saldos de fio da OP'],
      ['entregas', 'Entregas'],
      ['entrega_itens', 'Itens de entrega'],
      ['expedicoes', 'Expedições'],
      ['expedicao_itens', 'Itens de expedição'],
      ['expedicao_movimentos', 'Movimentos de expedição'],
      ['expedicao_movimento_itens', 'Itens de movimentos de expedição'],
      ['op_latex_entregas', 'Vínculos de entrega para Acabamento'],
      ['ops_filhas', 'OPs filhas'],
      ['document_link_revision_ops', 'Vínculos documentais de OP'],
      ['document_link_revisions', 'Revisões de vínculo documental'],
      ['documentos_vinculados', 'Documentos vinculados']
    ];
    return labels
      .filter(function (row) { return counts[row[0]] != null; })
      .map(function (row) { return { key: row[0], label: row[1], value: countValue(impacto, row[0]) }; });
  }

  function reasonWithMandatoryText(reason) {
    if (!reason) return '';
    var plain = String(reason);
    if (/hist[óo]rico can[ôo]nico de v[íi]nculos documentais/i.test(plain)) return MSG_DOCUMENTAL;
    if (/entrega vinculada/i.test(plain)) return MSG_ENTREGA;
    if (/expedicao vinculada|expedição vinculada/i.test(plain)) return MSG_EXPEDICAO;
    if (/OP de Acabamento vinculada/i.test(plain)) return MSG_FILHA;
    return plain;
  }

  function showDeleteConfirmation(config) {
    config = config || {};
    var tipo = config.tipo || 'registro';
    var impacto = config.impacto || {};
    var blocked = !!(impacto.blocked || config.blocked);
    var requiresCascade = impacto.classification === 'requires_cascade_confirmation' || !!impacto.cascade_required;
    var requires = requiresCascade || impacto.classification === 'requires_confirmation' || !!impacto.requires_confirmation;
    var requiredText = impacto.confirmation_required || (requiresCascade ? 'EXCLUIR TUDO' : 'EXCLUIR');
    var requiredMessage = requiresCascade ? MSG_CASCADE_FORTE : MSG_FORTE;
    var summary = buildImpactSummary(impacto);
    var input = null;

    var body = window.el('div', {},
      window.el('div', {
        style: 'font-size:13px;color:#5b6472;line-height:1.5;margin-bottom:12px;'
      }, MSG_AVISO),
      window.el('div', {
        style: 'background:#f8f9fb;border:1px solid #eceef1;border-radius:4px;padding:10px 12px;margin-bottom:12px;'
      },
        window.el('div', { style: 'font-size:12px;font-weight:700;color:#8a93a3;margin-bottom:7px;' }, 'Impacto previsto'),
        summary.length
          ? window.el('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:6px 12px;' },
              summary.map(function (row) {
                return [
                  window.el('div', { style: 'font-size:12.5px;color:#5b6472;' }, row.label),
                  window.el('div', { style: 'font-size:12.5px;font-weight:700;color:#16203a;text-align:right;' }, String(row.value))
                ];
              }).flat()
            )
          : window.el('div', { style: 'font-size:12.5px;color:#9aa2af;' }, 'Nenhuma dependência encontrada.')
      ),
      impacto.policy ? window.el('div', {
        style: 'font-size:12.5px;color:#5b6472;line-height:1.45;margin-bottom:12px;'
      }, impacto.policy) : null
    );

    if (!blocked && requiresCascade) {
      body.appendChild(window.el('div', {
        style: 'background:#fff7e6;border:1px solid #ffd899;border-radius:4px;padding:10px 12px;font-size:13px;color:#8a5a00;font-weight:700;line-height:1.45;margin-bottom:12px;'
      }, impacto.cascade_reason || MSG_CASCADE_FORTE));
    }

    if (blocked) {
      body.appendChild(window.el('div', {
        style: 'background:#fdecec;border:1px solid #f5c2c7;border-radius:4px;padding:10px 12px;font-size:13px;color:#a23434;font-weight:700;line-height:1.45;'
      }, reasonWithMandatoryText(config.reason)));
    } else if (requires) {
      input = window.textInput ? window.textInput({ placeholder: requiredText }) : window.el('input', { type: 'text' });
      body.appendChild(window.formField ? window.formField({
        label: requiredMessage,
        input: input,
        hint: 'Use letras maiúsculas.'
      }) : input);
    }

    window.modal({
      title: 'Excluir ' + tipo,
      body: body,
      saveLabel: blocked ? 'Fechar' : 'Excluir',
      onSave: async function () {
        if (blocked) return true;
        if (requires && (!input || input.value !== requiredText)) {
          window.toast(requiredMessage, 'error');
          return false;
        }
        if (typeof config.onConfirm === 'function') {
          return await config.onConfirm({ confirmacao: requires ? requiredText : null });
        }
        return true;
      }
    });
  }

  async function excluirPedidoComFluxo(pedidoId, afterSuccess) {
    var diag = await diagnosticarPedido(pedidoId);
    if (!diag || diag.ok === false && !diag.impacto) {
      window.toast(reasonWithMandatoryText(diag && diag.reason) || 'Erro ao diagnosticar Pedido.', 'error');
      return false;
    }
    showDeleteConfirmation({
      tipo: 'Pedido',
      id: pedidoId,
      impacto: diag.impacto,
      blocked: diag.blocked,
      reason: diag.reason,
      onConfirm: async function (ctx) {
        var result = await removerPedido(pedidoId, ctx);
        if (!result || result.ok === false) {
          window.toast(reasonWithMandatoryText(result && result.reason) || 'Pedido não excluído.', 'error');
          return false;
        }
        window.toast('Pedido excluído.', 'success');
        if (typeof afterSuccess === 'function') await afterSuccess(result);
        return true;
      }
    });
    return true;
  }

  async function excluirOPComFluxo(opId, afterSuccess) {
    var diag = await diagnosticarOP(opId);
    if (!diag || diag.ok === false && !diag.impacto) {
      window.toast(reasonWithMandatoryText(diag && diag.reason) || 'Erro ao diagnosticar OP.', 'error');
      return false;
    }
    showDeleteConfirmation({
      tipo: 'OP',
      id: opId,
      impacto: diag.impacto,
      blocked: diag.blocked,
      reason: diag.reason,
      onConfirm: async function (ctx) {
        var result = await removerOP(opId, ctx);
        if (!result || result.ok === false) {
          window.toast(reasonWithMandatoryText(result && result.reason) || 'OP não excluída.', 'error');
          return false;
        }
        window.toast('OP excluída.', 'success');
        if (typeof afterSuccess === 'function') await afterSuccess(result);
        return true;
      }
    });
    return true;
  }

  window.RAVATEX_DELETE = {
    diagnosticarPedido: diagnosticarPedido,
    diagnosticarOP: diagnosticarOP,
    removerPedido: removerPedido,
    removerOP: removerOP,
    buildImpactSummary: buildImpactSummary,
    showDeleteConfirmation: showDeleteConfirmation,
    excluirPedidoComFluxo: excluirPedidoComFluxo,
    excluirOPComFluxo: excluirOPComFluxo,
    messages: {
      entrega: MSG_ENTREGA,
      expedicao: MSG_EXPEDICAO,
      filha: MSG_FILHA,
      documental: MSG_DOCUMENTAL,
      confirmacao: MSG_FORTE,
      confirmacaoCascata: MSG_CASCADE_FORTE,
      aviso: MSG_AVISO
    }
  };
})(window);
