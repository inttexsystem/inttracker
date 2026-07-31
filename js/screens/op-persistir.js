// =====================================================================
// === SCREENS: OP PERSISTIR PURE HELPERS + WRITE (Seam A/B) ============
// Helpers de payload + write helper de persistência de OP,
// extraídos do <script> inline de index.html, de dentro de
// screenNovaOP. Concentra:
//
//   - itensValidosOP(itens)
//   - montarPayloadItensOP(itensValidos, opId)
//   - montarPayloadFornecedoresOP(fornSel, opId)
//   - montarPayloadOP({ numero, ano, status })
//   - montarPayloadLote({ numero, clienteSel })
//   - persistirOP({ status, op, ano, clienteSel, itens,
//                   fornSel, modelosById, parametrosByLargura,
//                   pedidoId })
//
// Carregar via <script src="js/screens/op-persistir.js"></script>
// no <head>, DEPOIS de js/screens/op-recalculo.js e ANTES de jspdf +
// script inline principal.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa (js/supabase-client.js) — usado por persistirOP
//   - window.RAVATEX_SCREENS.opCompraRegime (js/screens/op-compra-regime.js)
//     — regime de compra e sincronização NATIVA das necessidades quando
//     status='aberta'. P2-A removeu o ramo plano, que era o único consumidor
//     de window.calcularFiosOP/montarOrdensCompraFio aqui.
//
// NÃO depende de: window.toast, window.modal, window.confirmDialog,
// window.CURRENT_USER, window.navigate, window.saving.
//
// Compatibilidade: window.itensValidosOP, window.montarPayloadItensOP,
// window.montarPayloadFornecedoresOP, window.montarPayloadOP,
// window.montarPayloadLote e window.persistirOP seguem disponíveis
// para os call-sites do inline (prefixados com `window.`).
// =====================================================================

(function (window) {
  'use strict';

  // P2-A: clearFenceError foi REMOVIDO junto com o ramo plano. Ele existia só
  // para traduzir o erro `legacy_receipt_fenced` da guarda de mutação
  // protegida do db/75 sobre as escritas planas de ordens_compra_fio, e este
  // arquivo não faz mais nenhuma dessas escritas.

  function itensValidosOP(itens) {
    return (itens || []).filter((item) => item && item.modeloId && Number(item.metros) > 0);
  }

  // PHASE-MANTA-A: distinct product types present in the OP items, derived
  // from modelos.tipo_produto via modelo_id. Missing metadata resolves to
  // 'tapete' (the backfill default), so a pre-migration model map never
  // yields a false mixed-route block.
  function tiposProdutoOP(itensValidos, modelosById) {
    var set = {};
    for (var i = 0; i < (itensValidos || []).length; i++) {
      var it = itensValidos[i];
      var m = (modelosById && it) ? modelosById[it.modeloId] : null;
      set[(m && m.tipo_produto === 'manta') ? 'manta' : 'tapete'] = true;
    }
    return Object.keys(set);
  }

  // A weaving OP must be route-homogeneous (only Tapete or only Manta). This
  // is the in-code guard; the DB trigger op_itens_route_homogeneity_guard is
  // the ultimate authority.
  function opRotaHomogenea(itensValidos, modelosById) {
    return tiposProdutoOP(itensValidos, modelosById).length <= 1;
  }

  function montarPayloadItensOP(itensValidos, opId) {
    return itensValidos.map((item) => {
      var payload = {
        op_id: opId,
        modelo_id: item.modeloId,
        metros_pedidos: Number(item.metros),
      };
      if (item.pedidoItemId) {
        payload.pedido_item_id = item.pedidoItemId;
      }
      return payload;
    });
  }

  function montarPayloadFornecedoresOP(fornSel, opId) {
    if (!fornSel || !fornSel.cima) return [];
    return [{
      op_id: opId,
      fornecedor_id: fornSel.cima,
      etapa: 'cima',
    }];
  }

  function montarPayloadOP({ numero, ano, status }) {
    return {
      numero: Number(numero),
      ano: Number(ano),
      status,
    };
  }

  function montarPayloadLote({ numero, clienteSel }) {
    return {
      numero: Number(numero),
      cliente_id: Number(clienteSel),
    };
  }

  function hasPedidoIdValido(pedidoId) {
    return pedidoId != null && String(pedidoId).trim() !== '';
  }

  // Persiste OP + filhos. Retorna envelope { error, step, partial, opId }.
  //
  // Steps:
  //   'ok' — sucesso
  //   'ops_insert' / 'ops_update' — falha no primeiro write
  //   'lotes_insert' / 'lotes_update' / 'lotes_vincular' — falhas no lote
  //   'op_itens_delete' / 'op_itens_insert' — falhas em itens
  //   'op_fornecedores_delete' / 'op_fornecedores_insert' — falhas em fornecedores
  //   'regime_resolve' — o servidor não resolveu o regime de compra
  //   'regime_legado_sem_escritor' — Pedido em regime legado, sem escritor
  //   'necessidades_sync' — falha na sincronização NATIVA das necessidades
  //
  // P2-A retirou 'ordens_compra_fio_delete' / 'ordens_compra_fio_insert':
  // não existe mais escrita plana de ordens de fio aqui.
  //
  // NÃO chama toast, navigate, saving, ou DOM. NÃO acessa estado
  // de closure de screenNovaOP — recebe tudo por argumento e usa
  // window.supa internamente.
  async function persistirOP({
    status,
    op,
    ano,
    clienteSel,
    itens,
    fornSel,
    modelosById,
    parametrosByLargura,
    pedidoId,
  }) {
    if (!hasPedidoIdValido(pedidoId)) {
      return {
        error: { message: 'Nao e possivel criar OP sem Pedido vinculado.' },
        step: 'pedido_required',
        partial: false,
        opId: op && op.id ? op.id : null,
      };
    }

    const supa = window.supa;
    // `numero` nao e mais um valor de entrada: a reserva interna e sempre
    // automatica. `ano` permanece como o ano da reserva por tipo/ano.
    const anoInt = parseInt(ano, 10);
    const validos = itensValidosOP(itens);
    const isNova = !op;
    // Sempre reservado por public.proximo_numero_op abaixo; nunca vem da UI.
    let numeroPersistido = null;

    // PHASE-MANTA-A: reject a mixed-route OP BEFORE reserving an OP number.
    // The database trigger remains the ultimate authority.
    if (!opRotaHomogenea(validos, modelosById)) {
      return {
        error: { message: 'OP nao pode misturar Tapete e Manta; crie OPs separadas por tipo de produto.' },
        step: 'route_homogeneity',
        partial: false,
        opId: op && op.id ? op.id : null,
      };
    }

    // PEDIDO-ITEM-PRODUCTION-PRIORITY-R1: uma solicitacao de prioridade ainda
    // pendente de analise BLOQUEIA a criacao de OP. A checagem vem ANTES de
    // reservar o numero da OP e antes de qualquer INSERT, entao nenhum numero e
    // consumido e nenhum Lote/OP e criado por uma tentativa que nao podia
    // passar. Os gatilhos de db/91 sobre `lotes.pedido_id` e `ops.lote_id`
    // continuam sendo a autoridade final e cobrem todo outro dono de criacao.
    const prioRes = await supa.from('pedidos').select('prioridade_status').eq('id', pedidoId).maybeSingle();
    if (prioRes.error) {
      return { error: prioRes.error, step: 'pedido_priority_read', partial: false, opId: op && op.id ? op.id : null };
    }
    if (prioRes.data && prioRes.data.prioridade_status === 'solicitada') {
      return {
        error: { message: 'O Pedido tem uma prioridade solicitada pelo cliente aguardando analise. Confirme, ajuste ou remova a sequencia antes de gerar a OP.' },
        step: 'pedido_priority_review',
        partial: false,
        opId: op && op.id ? op.id : null,
      };
    }

    if (isNova) {
      const numeroRes = await supa.rpc('proximo_numero_op', { p_tipo: 'tecelagem', p_ano: anoInt });
      if (numeroRes.error) {
        return { error: numeroRes.error, step: 'op_numero_next', partial: false, opId: null };
      }
      numeroPersistido = parseInt(numeroRes.data, 10);
      if (!numeroPersistido) {
        return { error: { message: 'proximo_numero_op nao retornou numero valido' }, step: 'op_numero_next', partial: false, opId: null };
      }
    }

    // 1) upsert ops PRIMEIRO — evita lote órfão se o número da OP duplicar.
    let opRow;
    let opIdSalvo;
    if (!isNova) {
      // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: o UPDATE nao toca mais
      // `numero`/`ano`. ANTES gravava os valores digitados na tela, sem
      // sincronizar `op_numeros`, dessincronizando o high-water. A numeracao
      // interna e imutavel apos a criacao e o guard de db/95 recusa qualquer
      // tentativa; o cliente nao depende mais desse guard porque simplesmente
      // nao envia os campos.
      const r = await supa.from('ops').update({ status }).eq('id', op.id).select().single();
      if (r.error) {
        return { error: r.error, step: 'ops_update', partial: false, opId: op.id };
      }
      opRow = r.data;
      opIdSalvo = opRow.id;
    } else {
      // P2-A (§9.9.L.4 / TD2.1, caminho 3): NÃO enviar ops.status na criação
      // quando o valor é o próprio default canônico. Uma OP nova nasce
      // 'simulada' por DEFAULT do schema (db/01) e o cliente não precisa —
      // nem deve — declarar esse fato protegido. Só permanece explícito o
      // status que NÃO é o default; quando o P4 estreitar o grant por coluna,
      // o caminho do default já estará limpo.
      const insertPayload = { numero: numeroPersistido, ano: anoInt };
      if (status !== 'simulada') insertPayload.status = status;
      const r = await supa.from('ops').insert(insertPayload).select().single();
      if (r.error) {
        return { error: r.error, step: 'ops_insert', partial: false, opId: null };
      }
      opRow = r.data;
      opIdSalvo = opRow.id;
    }

    // 2) lote: cria no 1º salvamento (OP nova ou legada sem lote); senão atualiza o
    //    cliente. Liga em ops.lote_id. Numeração depende do UNIQUE(numero) de lotes.
    let loteId = op?.lote_id || null;
    if (loteId) {
      const updatePayload = { cliente_id: clienteSel, pedido_id: pedidoId };
      const lu = await supa.from('lotes').update(updatePayload).eq('id', loteId);
      if (lu.error) {
        return { error: lu.error, step: 'lotes_update', partial: true, opId: opIdSalvo };
      }
    } else {
      const proxRes = await supa.from('lotes').select('numero').order('numero', { ascending: false }).limit(1);
      if (proxRes.error) {
        return { error: proxRes.error, step: 'lotes_insert', partial: true, opId: opIdSalvo };
      }
      const prox = (proxRes.data && proxRes.data[0]) ? Number(proxRes.data[0].numero) + 1 : 1;
      const lotePayload = { numero: prox, cliente_id: clienteSel, pedido_id: pedidoId };
      const li = await supa.from('lotes').insert(lotePayload).select().single();
      if (li.error) {
        if (isNova) {
          // limpa OP recém-criada
          await supa.from('ops').delete().eq('id', opIdSalvo);
        }
        return { error: li.error, step: 'lotes_insert', partial: true, opId: opIdSalvo };
      }
      loteId = li.data.id;
      const ou = await supa.from('ops').update({ lote_id: loteId }).eq('id', opIdSalvo);
      if (ou.error) {
        return { error: ou.error, step: 'lotes_vincular', partial: true, opId: opIdSalvo };
      }
    }

    // 3) substitui op_itens
    const delItens = await supa.from('op_itens').delete().eq('op_id', opIdSalvo);
    if (delItens.error) {
      return { error: delItens.error, step: 'op_itens_delete', partial: true, opId: opIdSalvo };
    }
    const itensPayload = montarPayloadItensOP(validos, opIdSalvo);
    const itensRes = await supa.from('op_itens').insert(itensPayload);
    if (itensRes.error) {
      if (status === 'aberta') {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
      }
      return { error: itensRes.error, step: 'op_itens_insert', partial: true, opId: opIdSalvo };
    }

    // 4) substitui op_fornecedores — só tecelagem na criação (fios são atribuídos depois)
    const delForn = await supa.from('op_fornecedores').delete().eq('op_id', opIdSalvo);
    if (delForn.error) {
      if (status === 'aberta') {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
      }
      return { error: delForn.error, step: 'op_fornecedores_delete', partial: true, opId: opIdSalvo };
    }
    if (fornSel && fornSel.cima) {
      const fornecedoresPayload = montarPayloadFornecedoresOP(fornSel, opIdSalvo);
      const fornRes = await supa.from('op_fornecedores').insert(fornecedoresPayload);
      if (fornRes.error) {
        if (status === 'aberta') {
          await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        }
        return { error: fornRes.error, step: 'op_fornecedores_insert', partial: true, opId: opIdSalvo };
      }
    }

    // 5) se abrir: PRE-PROD-A (spec §R.23.2) regime cutover. The SERVER
    //    decides the purchasing regime; the client never decides locally and
    //    a native Pedido never silently falls back to flat purchasing.
    if (status === 'aberta') {
      const regimeApi = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.opCompraRegime;
      const regime = regimeApi
        ? await regimeApi.resolverRegimeCompraFio(pedidoId)
        : { ok: false, erro: 'Modulo de regime de compra indisponivel' };
      if (!regime || regime.ok !== true) {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        return { error: regime && regime.error ? regime.error : { message: (regime && regime.erro) || 'Falha ao resolver regime de compra' }, step: 'regime_resolve', partial: true, opId: opIdSalvo };
      }

      // P2-A (§9.9.N linha 9): SOMENTE sincronização NATIVA. O ramo legado —
      // que montava linhas planas de `ordens_compra_fio` a partir da receita
      // e as gravava com delete+insert diretos — foi REMOVIDO. A proibição
      // canônica é explícita: nenhuma escrita dupla nativo-para-plano, nenhuma
      // materialização sintética de ordens_compra_fio, nem sequer como medida
      // temporária de compatibilidade.
      //
      // O regime continua sendo do SERVIDOR e não é ignorado. Um Pedido que o
      // servidor ainda classifica como 'legacy' (evidência de compra plana
      // pré-existente) não tem mais escritor de compra nesta tela: a operação
      // FALHA HONESTAMENTE e devolve a OP a 'simulada'. Fingir sucesso, ou
      // recriar as linhas planas, seria exatamente o que a proibição veda.
      if (regime.modelo !== 'native') {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        return {
          error: { message: 'Este Pedido está no regime de compra legado, que não tem mais escritor de ordens de fio nesta tela. Trate a compra pelo planejamento nativo antes de abrir a OP.' },
          step: 'regime_legado_sem_escritor',
          partial: true,
          opId: opIdSalvo,
        };
      }

      // O que persiste é NECESSIDADE, não documento, e quem persiste é o
      // escritor do servidor. Falha para a operação e devolve a OP a
      // 'simulada' — nunca cai para o modelo plano em silêncio.
      const sync = await regimeApi.sincronizarNecessidadesCompraFio(pedidoId);
      if (!sync || sync.ok !== true) {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        return { error: sync && sync.error ? sync.error : { message: (sync && sync.erro) || 'Falha ao sincronizar necessidades nativas' }, step: 'necessidades_sync', partial: true, opId: opIdSalvo };
      }
      return { error: null, step: 'ok', partial: false, opId: opIdSalvo, numero: numeroPersistido, modelo: 'native' };
    }

    return { error: null, step: 'ok', partial: false, opId: opIdSalvo, numero: numeroPersistido };
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.opPersistir = {
    itensValidosOP,
    tiposProdutoOP,
    opRotaHomogenea,
    montarPayloadItensOP,
    montarPayloadFornecedoresOP,
    montarPayloadOP,
    montarPayloadLote,
    hasPedidoIdValido,
    persistirOP,
  };

  window.itensValidosOP = itensValidosOP;
  window.tiposProdutoOP = tiposProdutoOP;
  window.opRotaHomogenea = opRotaHomogenea;
  window.montarPayloadItensOP = montarPayloadItensOP;
  window.montarPayloadFornecedoresOP = montarPayloadFornecedoresOP;
  window.montarPayloadOP = montarPayloadOP;
  window.montarPayloadLote = montarPayloadLote;
  window.hasPedidoIdValidoOP = hasPedidoIdValido;
  window.persistirOP = persistirOP;
})(window);
