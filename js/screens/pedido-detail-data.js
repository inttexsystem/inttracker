// =====================================================================
// === SCREENS: PEDIDO DETAIL DATA =====================================
// Carregamento e normalizacao dos dados do detalhe do pedido.
// =====================================================================

(function (window) {
  'use strict';

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  var ns = window.RAVATEX_SCREENS.pedidoDetail = window.RAVATEX_SCREENS.pedidoDetail || {};

  function resetState(state) {
    state.pedido = null;
    state.cliente = null;
    state.itens = [];
    state.lotes = [];
    state.ops = [];
    state.parciais = [];
    state.parcialItens = [];
    state.entregaItens = [];
    state.entregasById = {};
    state.opLatexEntregas = [];
    state.expedicoes = [];
    state.expedicaoItens = [];
    state.expedicaoMovimentos = [];
    state.expedicaoMovimentoItens = [];
    state.ordensFio = [];
    state.latexOptions = [];
    state.modelosById = {};
    state.coresById = {};
    state.opsLoadError = false;
    state.opsEnrichError = false;
    state.docsLoadError = false;
    state.expedicoesLoadError = false;
    state.partialItemLoadError = false;
    state.alteracaoPendente = null;
    state.alteracaoPendenteLoadError = false;
  }

  function uniqueNonNull(values) {
    return Array.from(new Set((values || []).filter(function (value) {
      return value != null;
    })));
  }

  async function loadPedidoDetailData(pedidoId, state) {
    resetState(state);

    var pedidoRes = await window.supa
      .from('pedidos')
      // db/89: `data_pedido` e a data COMERCIAL e entra explicitamente no read
      // model. Nunca derivar a data comercial de `criado_em`, que continua
      // sendo apenas o carimbo tecnico de criacao.
      // db/91: o estado de prioridade entra explicitamente no read model. A
      // sequencia em si NAO e uma coluna: ela e `pedido_itens.ordem`, ja lido
      // abaixo com `.order('ordem')`.
      .select('id, numero, data_pedido, status, cliente_id, referencia_cliente, prazo_entrega, prazo_desejado, tipo_recebimento, observacao, criado_em, atualizado_em, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, parcial_habilitado, parcial_atualizado_em, metros_total, prioridade_status, prioridade_observacao, prioridade_confirmada_em, prioridade_confirmada_por, prioridade_atualizada_em, cliente:cliente_id(id, nome)')
      .eq('id', pedidoId)
      .maybeSingle();

    if (pedidoRes.error || !pedidoRes.data) {
      state.pedido = null;
      window.toast('Pedido nao encontrado.', 'error');
      console.error(pedidoRes.error);
      return 'pedido';
    }

    state.pedido = pedidoRes.data;
    state.cliente = (pedidoRes.data.cliente && typeof pedidoRes.data.cliente === 'object')
      ? pedidoRes.data.cliente
      : null;

    // PEDIDO-ADMIN-CHANGE-REQUEST-COMPARISON-APPROVAL-R1 (Fase 5): descoberta
    // da solicitacao de alteracao PENDENTE, para o ponto de entrada da tela de
    // revisao. SELECT administrativo MINIMO — exatamente id, status e criado_em
    // — filtrado por pedido_id e status='pendente'. O indice parcial unico
    // pedido_alteracao_um_pendente_por_pedido_uq (db/92) garante NO MAXIMO uma
    // linha, entao `limit(1)` descreve a realidade e nao esconde nada.
    //
    // Nenhum INSERT, UPDATE ou DELETE: db/92 revoga toda escrita direta destas
    // tabelas de `authenticated` e mantem apenas SELECT; a escrita e das RPC
    // SECURITY DEFINER.
    //
    // Uma leitura que FALHA nao pode virar "nao existe solicitacao": ela liga
    // `alteracaoPendenteLoadError` e a tela mostra um aviso administrativo
    // nao-bloqueante, sem afirmar ausencia e sem derrubar o detalhe do Pedido.
    var alteracaoRes = await window.supa
      .from('pedido_alteracao_solicitacoes')
      .select('id, status, criado_em')
      .eq('pedido_id', pedidoId)
      .eq('status', 'pendente')
      .limit(1);

    if (alteracaoRes.error) {
      state.alteracaoPendente = null;
      state.alteracaoPendenteLoadError = true;
      console.error('pedido-detail: erro ao carregar solicitacao de alteracao pendente', alteracaoRes.error);
    } else {
      state.alteracaoPendente = (alteracaoRes.data && alteracaoRes.data[0]) || null;
      state.alteracaoPendenteLoadError = false;
    }

    var itensRes = await window.supa
      .from('pedido_itens')
      .select('id, pedido_id, modelo_id, metros, largura, cor_1_id, cor_2_id, observacao, ordem')
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true });

    if (itensRes.error) {
      window.toast('Erro ao carregar itens do pedido.', 'error');
      console.error(itensRes.error);
      return 'itens';
    }

    state.itens = itensRes.data || [];

    var parciaisRes = await window.supa
      .from('pedido_parciais')
      .select('id, pedido_id, sequencia, situacao, metros, data_referencia, titulo, mensagem_cliente, visivel_cliente, criado_em, atualizado_em')
      .eq('pedido_id', pedidoId)
      .order('sequencia', { ascending: true })
      .order('criado_em', { ascending: true });

    if (parciaisRes.error) {
      state.parciais = [];
      console.error('pedido-detail: erro ao carregar pedido_parciais', parciaisRes.error);
    } else {
      state.parciais = parciaisRes.data || [];
    }

    var modeloIds = uniqueNonNull(state.itens.map(function (item) {
      return item.modelo_id;
    }));

    var corIds = [];
    state.itens.forEach(function (item) {
      if (item.cor_1_id != null) corIds.push(item.cor_1_id);
      if (item.cor_2_id != null) corIds.push(item.cor_2_id);
    });

    if (modeloIds.length > 0) {
      var modelosRes = await window.supa
        .from('modelos')
        .select('id, nome, largura, cor_1_id, cor_2_id')
        .in('id', modeloIds);

      if (modelosRes.error) {
        console.error('pedido-detail: erro ao carregar modelos', modelosRes.error);
      } else {
        state.modelosById = Object.fromEntries((modelosRes.data || []).map(function (modelo) {
          return [modelo.id, modelo];
        }));
        // PHASE-MANTA-A: best-effort tipo_produto augmentation (graceful
        // before the migration is applied; absent => rendered as Tapete).
        try {
          var tpRes = await window.supa.from('modelos').select('id, tipo_produto').in('id', modeloIds);
          if (!tpRes.error && Array.isArray(tpRes.data)) {
            tpRes.data.forEach(function (r) { if (state.modelosById[r.id]) state.modelosById[r.id].tipo_produto = r.tipo_produto; });
          }
        } catch (e) { /* coluna ausente: tratado como Tapete */ }
        (modelosRes.data || []).forEach(function (modelo) {
          if (modelo.cor_1_id != null) corIds.push(modelo.cor_1_id);
          if (modelo.cor_2_id != null) corIds.push(modelo.cor_2_id);
        });
      }
    }

    corIds = uniqueNonNull(corIds);
    if (corIds.length > 0) {
      var coresRes = await window.supa
        .from('cores')
        .select('id, nome')
        .in('id', corIds);

      if (coresRes.error) {
        console.error('pedido-detail: erro ao carregar cores', coresRes.error);
      } else {
        state.coresById = Object.fromEntries((coresRes.data || []).map(function (cor) {
          return [cor.id, cor];
        }));
      }
    }

    var latexRes = await window.supa
      .from('fornecedores')
      .select('id, nome, tipo')
      .eq('tipo', 'latex')
      .order('nome', { ascending: true });

    if (latexRes.error) {
      state.latexOptions = [];
      console.error('pedido-detail: erro ao carregar fornecedores latex', latexRes.error);
    } else {
      state.latexOptions = (latexRes.data || []).map(function (fornecedor) {
        return { value: fornecedor.id, label: fornecedor.nome };
      });
    }

    // PHASE-MANTA-B2B: a expedicao tem EXATAMENTE uma origem — op_latex_id
    // (Tapete) ou op_tecelagem_id (Manta, db/81). Ler so op_latex_id perde
    // toda expedicao Manta. Degrada com elegancia antes de db/81.
    var EXPEDICAO_COLS = 'id, pedido_id, op_latex_id, op_tecelagem_id, lote_id, cliente_id, status, liberado_em, criado_em, atualizado_em';
    var expedicoesRes = await window.supa
      .from('expedicoes')
      .select(EXPEDICAO_COLS)
      .eq('pedido_id', pedidoId)
      .order('id', { ascending: true });
    if (expedicoesRes.error) {
      expedicoesRes = await window.supa
        .from('expedicoes')
        .select(EXPEDICAO_COLS.replace(', op_tecelagem_id', ''))
        .eq('pedido_id', pedidoId)
        .order('id', { ascending: true });
    }

    if (expedicoesRes.error) {
      state.expedicoes = [];
      state.expedicoesLoadError = true;
      console.error('pedido-detail: erro ao carregar expedicoes', expedicoesRes.error);
    } else {
      state.expedicoes = expedicoesRes.data || [];
    }

    var expedicaoIds = uniqueNonNull(state.expedicoes.map(function (expedicao) {
      return expedicao.id;
    }));

    if (expedicaoIds.length > 0) {
      var expedicaoItensRes = await window.supa
        .from('expedicao_itens')
        .select('id, expedicao_id, op_item_id, pedido_item_id, modelo_id, metros_liberados, metros_entregues')
        .in('expedicao_id', expedicaoIds);

      if (expedicaoItensRes.error) {
        state.expedicaoItens = [];
        state.expedicoesLoadError = true;
        console.error('pedido-detail: erro ao carregar expedicao_itens', expedicaoItensRes.error);
      } else {
        state.expedicaoItens = expedicaoItensRes.data || [];
      }

      var expedicaoMovimentosRes = await window.supa
        .from('expedicao_movimentos')
        .select('id, expedicao_id, tipo, data, observacao, criado_em')
        .in('expedicao_id', expedicaoIds)
        .order('data', { ascending: false })
        .order('id', { ascending: false });

      if (expedicaoMovimentosRes.error) {
        state.expedicaoMovimentos = [];
        state.expedicoesLoadError = true;
        console.error('pedido-detail: erro ao carregar expedicao_movimentos', expedicaoMovimentosRes.error);
      } else {
        state.expedicaoMovimentos = expedicaoMovimentosRes.data || [];
      }

      var movimentoIds = uniqueNonNull(state.expedicaoMovimentos.map(function (movimento) {
        return movimento.id;
      }));

      if (movimentoIds.length > 0) {
        var expedicaoMovimentoItensRes = await window.supa
          .from('expedicao_movimento_itens')
          .select('id, movimento_id, expedicao_item_id, metros')
          .in('movimento_id', movimentoIds);

        if (expedicaoMovimentoItensRes.error) {
          state.expedicaoMovimentoItens = [];
          state.expedicoesLoadError = true;
          console.error('pedido-detail: erro ao carregar expedicao_movimento_itens', expedicaoMovimentoItensRes.error);
        } else {
          state.expedicaoMovimentoItens = expedicaoMovimentoItensRes.data || [];
        }
      }
    }

    var lotesRes = await window.supa
      .from('lotes')
      .select('id, numero, pedido_id')
      .eq('pedido_id', pedidoId)
      .order('numero', { ascending: true });

    if (lotesRes.error) {
      state.lotes = [];
      state.ops = [];
      state.opsLoadError = true;
      console.error('pedido-detail: erro ao carregar lotes', lotesRes.error);
      return null;
    }

    state.lotes = lotesRes.data || [];
    if (state.lotes.length === 0) {
      state.ops = [];
      return null;
    }

    var loteIds = state.lotes.map(function (lote) { return lote.id; });
    // CAMADA BASE: OPs diretamente vinculadas ao Pedido (via lote). Esta
    // consulta é a fonte canônica das "OPs vinculadas" e NÃO pode depender
    // de DDL da consolidação Látex (db/25). Ela precisa carregar a OP
    // Tecelagem aberta/preparação independentemente de recebimento, aceite,
    // entrega ou acabamento. Por isso NÃO seleciona ops.destino_fornecedor_id
    // (coluna adicionada por db/25): selecioná-la faria o PostgREST devolver
    // erro em ambientes sem a migration aplicada, derrubando toda a lista
    // base. Campos da consolidação Látex entram na camada de enriquecimento.
    var opsSelect = 'id, numero, ano, identidade_operacional, identidade_pedido_id, status, tipo, criado_em, observacao, origem_op_id, origem_entrega_id, lote_id, op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(id, nome))';
    var opsRes = await window.supa
      .from('ops')
      .select(opsSelect)
      .in('lote_id', loteIds)
      .order('ano', { ascending: true })
      .order('numero', { ascending: true });

    if (opsRes.error) {
      state.ops = [];
      state.opsLoadError = true;
      console.error('pedido-detail: erro ao carregar ops', opsRes.error);
      return null;
    }

    state.ops = opsRes.data || [];
    if (state.ops.length === 0) return null;

    var opIds = state.ops.map(function (op) { return op.id; });

    // CAMADA DE ENRIQUECIMENTO (isolada da base): consolidação Látex,
    // vínculo N entregas (cima) -> 1 OP Látex. Usado para resolver a OP
    // Látex de origem de cada entrega parcial no histórico. Depende da
    // tabela op_latex_entregas (db/25) que pode ainda não existir; se a
    // leitura falhar, sinalizamos opsEnrichError e seguimos SEM apagar a
    // lista base de OPs (Invariante 3: falha de enriquecimento não derruba
    // o bloco). A base já foi carregada acima; aqui só agregamos detalhes.
    var latexOpIds = state.ops
      .filter(function (op) { return op.tipo === 'latex'; })
      .map(function (op) { return op.id; });
    if (latexOpIds.length > 0) {
      var opLatexEntregasRes = await window.supa
        .from('op_latex_entregas')
        .select('op_latex_id, entrega_id')
        .in('op_latex_id', latexOpIds);
      if (opLatexEntregasRes.error) {
        state.opLatexEntregas = [];
        state.opsEnrichError = true;
        console.error('pedido-detail: erro ao enriquecer op_latex_entregas (base preservada)', opLatexEntregasRes.error);
      } else {
        state.opLatexEntregas = opLatexEntregasRes.data || [];
      }
    }

    var entregaItensRes = await window.supa
      .from('entrega_itens')
      .select('id, entrega_id, op_id, op_item_id, metros_entregues, defeito, observacao')
      .in('op_id', opIds);

    if (entregaItensRes.error) {
      state.entregaItens = [];
      state.docsLoadError = true;
      console.error('pedido-detail: erro ao carregar entrega_itens', entregaItensRes.error);
    } else {
      state.entregaItens = entregaItensRes.data || [];
    }

    var entregaIds = uniqueNonNull(state.entregaItens.map(function (row) {
      return row.entrega_id;
    }));

    if (entregaIds.length > 0) {
      var entregasRes = await window.supa
        .from('entregas')
        .select('id, etapa, data, observacao, fornecedor_id, destino_fornecedor_id, destino:destino_fornecedor_id(nome), fornecedores:fornecedor_id(nome)')
        .in('id', entregaIds);

      if (entregasRes.error) {
        state.entregasById = {};
        state.docsLoadError = true;
        console.error('pedido-detail: erro ao carregar entregas', entregasRes.error);
      } else {
        state.entregasById = Object.fromEntries((entregasRes.data || []).map(function (entrega) {
          return [entrega.id, entrega];
        }));
      }
    }

    // PHASE-C3C-B (docs/architecture/ORDEM_COMPRA_C3C_B_PHASE_CONTRACT.md
    // §32): attempts the canonical legacy-compat projection scoped by
    // p_pedido_id first; falls back to the exact pre-phase flat select,
    // byte-identical, only on the documented inactive signal or the bounded
    // missing-function condition. state.ordensFio's field names/shape are
    // preserved exactly for every downstream consumer either way.
    var cutover = window.RAVATEX_SCREENS && window.RAVATEX_SCREENS.ordemCompraReceiptCutover;
    var canonicalOrdens = cutover ? await cutover.attemptCanonicalRead({ pedidoId: pedidoId }) : null;
    if (canonicalOrdens && canonicalOrdens.outcome === 'canonical_success') {
      state.ordensFio = canonicalOrdens.rows;
    } else {
      // P2-A (§9.9.N linha 11): o FALLBACK PLANO foi REMOVIDO. Antes, quando a
      // projeção canônica não respondia, esta tela relia `ordens_compra_fio`
      // direto e seguia como se nada tivesse acontecido — voltando ao modelo
      // plano em silêncio, que é justamente o que a proibição canônica veda.
      //
      // Agora a falha é HONESTA: lista vazia e docsLoadError, que a tela já
      // renderiza como estado de erro. Um dado ausente é melhor do que um dado
      // de outra autoridade apresentado como se fosse o corrente.
      state.ordensFio = [];
      state.docsLoadError = true;
      console.error(
        'pedido-detail: leitura canonica de ordens de fio indisponivel; sem fallback plano',
        canonicalOrdens ? (canonicalOrdens.error || canonicalOrdens.outcome) : 'adaptador ausente'
      );
    }

    if (state.parciais.length > 0) {
      var parcialIds = state.parciais.map(function (parcial) { return parcial.id; });
      var parcialItensRes = await window.supa
        .from('pedido_parcial_itens')
        .select('id, parcial_id, pedido_item_id, metros')
        .in('parcial_id', parcialIds);

      if (parcialItensRes.error) {
        state.parcialItens = [];
        state.partialItemLoadError = true;
        console.error('pedido-detail: erro ao carregar pedido_parcial_itens', parcialItensRes.error);
      } else {
        state.parcialItens = parcialItensRes.data || [];
      }
    }

    var parametrosRes = await window.supa
      .from('parametros_largura')
      .select('largura')
      .order('largura', { ascending: true });
    if (parametrosRes.error) {
      state.parametrosLargura = [];
      console.error('pedido-detail: erro ao carregar parametros_largura', parametrosRes.error);
    } else {
      state.parametrosLargura = parametrosRes.data || [];
    }

    return null;
  }

  ns.loadPedidoDetailData = loadPedidoDetailData;
})(window);
