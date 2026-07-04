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
      .select('id, numero, status, cliente_id, referencia_cliente, prazo_entrega, prazo_desejado, tipo_recebimento, observacao, criado_em, atualizado_em, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, parcial_habilitado, parcial_atualizado_em, metros_total, cliente:cliente_id(id, nome)')
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

    var expedicoesRes = await window.supa
      .from('expedicoes')
      .select('id, pedido_id, op_latex_id, lote_id, cliente_id, status, liberado_em, criado_em, atualizado_em')
      .eq('pedido_id', pedidoId)
      .order('id', { ascending: true });

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
    var opsSelect = 'id, numero, ano, status, tipo, observacao, origem_op_id, origem_entrega_id, lote_id, op_itens(id, modelo_id, metros_pedidos, metros_ajustados, pedido_item_id), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(id, nome))';
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

    var ordensRes = await window.supa
      .from('ordens_compra_fio')
      .select('id, op_id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, cores:cor_id(id, nome)')
      .in('op_id', opIds);

    if (ordensRes.error) {
      state.ordensFio = [];
      state.docsLoadError = true;
      console.error('pedido-detail: erro ao carregar ordens_compra_fio', ordensRes.error);
    } else {
      state.ordensFio = ordensRes.data || [];
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
      .select('id, largura, r_algoritmo_poliester, r_algoritmo_algodao')
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
