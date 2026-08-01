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

  // Limpeza best-effort de uma OP recem-criada que nao chegou a ganhar lote.
  // `remover_op` recusa sem o token da classe correta, e a classe depende do
  // que ja esta ligado a OP, entao as duas classes sao tentadas em ordem.
  // Falhar aqui NAO e mascarado: quem chama devolve o erro original do lote.
  async function removerOPRecemCriada(supa, opId) {
    for (const token of ['EXCLUIR', 'EXCLUIR TUDO']) {
      const r = await supa.rpc('remover_op', { p_op_id: Number(opId), p_confirmacao: token });
      if (!r.error && r.data && r.data.ok) return true;
    }
    console.error('op-persistir: nao foi possivel remover a OP recem-criada', opId);
    return false;
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
    //
    // P4 (§9.9.L.4 / TD2.1): `ops.status` NUNCA viaja daqui. O grant por
    // coluna admite apenas (numero, ano) no INSERT, e o status e um fato
    // protegido de dono servidor. Uma OP nova nasce 'simulada' por DEFAULT
    // (db/01) e a transicao para 'aberta' e o ULTIMO passo, feita pelo
    // escritor canonico `abrir_op_tecelagem`.
    let opRow;
    let opIdSalvo;
    if (!isNova) {
      // OP-CANONICAL-IDENTITY-REFOUNDATION-R1: o UPDATE nao toca
      // `numero`/`ano`. P4 removeu tambem a escrita de `status` que existia
      // aqui: reabrir/abrir passou a ser operacao do servidor, e regravar o
      // status atual era, na pratica, um no-op disfarçado.
      const r = await supa.from('ops').select().eq('id', op.id).single();
      if (r.error) {
        return { error: r.error, step: 'ops_update', partial: false, opId: op.id };
      }
      opRow = r.data;
      opIdSalvo = opRow.id;
    } else {
      const r = await supa.from('ops').insert({ numero: numeroPersistido, ano: anoInt }).select().single();
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
          // P4 (TD2.2): o DELETE direto em `ops` foi revogado do cliente. A
          // remocao de uma OP recem-criada e ainda pre-operacional passa pelo
          // escritor canonico de exclusao, que ja existia (db/34+). Ele exige
          // o token de confirmacao correspondente a CLASSE da exclusao, entao
          // a limpeza tenta a classe simples e so entao a cascata.
          await removerOPRecemCriada(supa, opIdSalvo);
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
    //
    // P4 (§9.9.L.4 / TD2.2): o par DELETE+INSERT direto perdeu o privilegio de
    // DELETE. A troca do conjunto passou a ser UMA transacao do servidor, o
    // que tambem elimina a janela em que a OP ficava sem itens.
    const itensRes = await supa.rpc('substituir_itens_op', {
      p_op_id: opIdSalvo,
      p_itens: montarPayloadItensOP(validos, opIdSalvo),
    });
    if (itensRes.error || !itensRes.data || !itensRes.data.ok) {
      const erro = itensRes.error || {
        message: (itensRes.data && (itensRes.data.erro || itensRes.data.codigo)) || 'Falha ao salvar itens',
      };
      return { error: erro, step: 'op_itens_insert', partial: true, opId: opIdSalvo };
    }

    // 4) substitui op_fornecedores — só tecelagem na criação (fios são atribuídos depois)
    //
    // `op_fornecedores` NAO e um fato protegido pelo P4 e mantem seus grants,
    // entao este par continua direto. Os rollbacks para 'simulada' saíram: a
    // transicao para 'aberta' agora acontece DEPOIS deste ponto, entao uma
    // falha aqui simplesmente deixa a OP como ela ja estava.
    const delForn = await supa.from('op_fornecedores').delete().eq('op_id', opIdSalvo);
    if (delForn.error) {
      return { error: delForn.error, step: 'op_fornecedores_delete', partial: true, opId: opIdSalvo };
    }
    if (fornSel && fornSel.cima) {
      const fornecedoresPayload = montarPayloadFornecedoresOP(fornSel, opIdSalvo);
      const fornRes = await supa.from('op_fornecedores').insert(fornecedoresPayload);
      if (fornRes.error) {
        return { error: fornRes.error, step: 'op_fornecedores_insert', partial: true, opId: opIdSalvo };
      }
    }

    // 5) se abrir: PRE-PROD-A (spec §R.23.2) regime cutover. The SERVER
    //    decides the purchasing regime; the client never decides locally and
    //    a native Pedido never silently falls back to flat purchasing.
    if (status === 'aberta') {
      // P4 (§9.9.L.4): ABRIR e UMA operacao do servidor.
      //
      // Nao da para reordenar isto no cliente. `sincronizar_necessidades_
      // compra_fio` so enxerga OPs cujo status JA e 'aberta', entao a
      // transicao precisa vir antes da sincronizacao; e a matriz de transicao
      // de db/21 nao tem aresta aberta -> simulada, entao o cliente nao
      // conseguiria desfazer a transicao se a sincronizacao falhasse. Os seis
      // rollbacks manuais para 'simulada' que existiam aqui eram uma
      // aproximacao disso, e nunca foram um rollback de verdade.
      //
      // `abrir_op_tecelagem` faz transicao + regime + sincronizacao na MESMA
      // transacao: ou a OP fica aberta e sincronizada, ou continua exatamente
      // como estava. As falhas de regime e de sincronizacao chegam como
      // excecao (e o que desfaz a transicao), com o codigo estavel na
      // mensagem.
      const abrir = await supa.rpc('abrir_op_tecelagem', { p_op_id: opIdSalvo });

      if (abrir.error) {
        const texto = String(abrir.error.message || '') + ' ' + String(abrir.error.details || '');
        let step = 'regime_resolve';
        if (texto.indexOf('regime_legado_sem_escritor') !== -1) step = 'regime_legado_sem_escritor';
        else if (texto.indexOf('necessidades_sync') !== -1) step = 'necessidades_sync';
        return { error: abrir.error, step, partial: true, opId: opIdSalvo };
      }
      if (!abrir.data || !abrir.data.ok) {
        return {
          error: { message: (abrir.data && (abrir.data.erro || abrir.data.codigo)) || 'Falha ao abrir a OP' },
          step: 'ops_update',
          partial: true,
          opId: opIdSalvo,
        };
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
