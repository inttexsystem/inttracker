// =====================================================================
// === SCREENS: MANTA WRITES (rota direta) =============================
// PHASE-MANTA-B2B. Unico modulo de escrita da rota Manta. Concentra as
// quatro RPCs autoritativas de db/85-db/88:
//
//   - registrarSaidaMantaCima      -> registrar_entrega_cima_manta
//   - consultarSaldoExpedicaoManta -> consultar_saldo_expedicao_manta
//   - liberarExpedicaoMantaParcial -> liberar_expedicao_manta_parcial
//   - estornarExpedicaoMantaParcial-> estornar_expedicao_manta_parcial
//
// Regras estruturais (CODE_HEALTH_RULES sec.6):
//   - nenhuma funcao de render escreve; toda escrita passa por aqui;
//   - nenhuma escrita direta em tabela (sem insert/update/delete/upsert):
//     as RPCs sao atomicas e a atomicidade nao pode ser reproduzida no
//     cliente (contraste com o escritor cima legado, nao-atomico);
//   - o erro do backend e reportado sem reescrita: `codigo` + `erro` da
//     RPC chegam intactos ao chamador.
//
// A rota NUNCA e inferida aqui: quem chama ja resolveu a rota por
// `modelos.tipo_produto` (js/product-route.js). O backend revalida.
//
// Carregar via <script src="js/screens/manta-writes.js"></script>.
// =====================================================================

(function (window) {
  'use strict';

  // Uma chave de idempotencia por TENTATIVA do operador, estavel em toda
  // retentativa da mesma tentativa (o backend devolve o resultado
  // armazenado byte a byte no replay exato). Um novo comando exige uma
  // nova chave — por isso a chave e criada pelo chamador e nao aqui.
  function novaIdempotencyKey(prefixo) {
    var base = prefixo ? String(prefixo) : 'manta';
    var cryptoApi = window.crypto || window.msCrypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      return base + ':' + cryptoApi.randomUUID();
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      var buf = new Uint8Array(16);
      cryptoApi.getRandomValues(buf);
      var hex = '';
      for (var i = 0; i < buf.length; i++) hex += ('0' + buf[i].toString(16)).slice(-2);
      return base + ':' + hex;
    }
    return null;
  }

  // Um id nao numerico viraria NaN num Number() silencioso; e recusado
  // antes de qualquer chamada em vez de virar um payload invalido.
  function idNumerico(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function semSupabase() {
    return { ok: false, codigo: 'sem_conexao', erro: 'Conexao com o banco indisponivel.' };
  }

  // Normaliza a resposta PostgREST -> { ok, codigo, erro, ...payload }.
  // Preserva `codigo` e `erro` emitidos pela RPC (reporte atomico exigido
  // pelo contrato); so sintetiza quando o transporte falhou.
  function normalizeRpc(res) {
    if (!res) return { ok: false, codigo: 'resposta_vazia', erro: 'Sem resposta do servidor.' };
    if (res.error) {
      return {
        ok: false,
        codigo: res.error.code || 'erro_transporte',
        erro: res.error.message || 'Falha na comunicacao com o servidor.',
      };
    }
    var data = res.data;
    if (Array.isArray(data)) data = data[0] || null;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { /* mantem string */ }
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, codigo: 'resposta_invalida', erro: 'Resposta inesperada do servidor.' };
    }
    if (data.ok !== true) {
      return {
        ok: false,
        codigo: data.codigo || 'rejeitado',
        erro: data.erro || 'Operacao rejeitada pela regra operacional.',
        data: data,
      };
    }
    return data;
  }

  async function callRpc(nome, params) {
    if (!window.supa || typeof window.supa.rpc !== 'function') return semSupabase();
    try {
      return normalizeRpc(await window.supa.rpc(nome, params));
    } catch (err) {
      console.error('manta-writes: falha ao chamar ' + nome, err);
      return { ok: false, codigo: 'excecao', erro: (err && err.message) || 'Falha inesperada.' };
    }
  }

  function sanitizeItensSaida(linhas) {
    return (Array.isArray(linhas) ? linhas : [])
      .map(function (linha) {
        return {
          op_item_id: linha && linha.op_item_id != null ? Number(linha.op_item_id) : null,
          metros_entregues: Number((linha && linha.metros_entregues) || 0),
          defeito: !!(linha && linha.defeito),
        };
      })
      .filter(function (linha) {
        return linha.op_item_id != null && Number.isFinite(linha.metros_entregues) && linha.metros_entregues > 0;
      });
  }

  function sanitizeItensMetros(linhas) {
    return (Array.isArray(linhas) ? linhas : [])
      .map(function (linha) {
        return {
          op_item_id: linha && linha.op_item_id != null ? Number(linha.op_item_id) : null,
          metros: Number((linha && linha.metros) || 0),
        };
      })
      .filter(function (linha) {
        return linha.op_item_id != null && Number.isFinite(linha.metros) && linha.metros > 0;
      });
  }

  // -------------------------------------------------------------------
  // 1. Saida medida de tecelagem (db/85). Nao ha fornecedor de destino:
  //    a Manta nunca entra em acabamento, e o guard de rota rejeita um
  //    destino, e nao aciona a geracao automatica de OP de acabamento.
  // -------------------------------------------------------------------
  async function registrarSaidaMantaCima(input) {
    var safe = input || {};
    var opId = idNumerico(safe.opId);
    if (opId == null) {
      return { ok: false, codigo: 'op_invalida', erro: 'OP de tecelagem nao informada.' };
    }
    var itens = sanitizeItensSaida(safe.itens);
    if (!itens.length) {
      return { ok: false, codigo: 'payload_vazio', erro: 'Informe ao menos um item com metros medidos.' };
    }
    var observacao = safe.observacao != null ? String(safe.observacao).trim() : '';
    return await callRpc('registrar_entrega_cima_manta', {
      p_op_id: opId,
      p_fornecedor_id: safe.fornecedorId != null ? Number(safe.fornecedorId) : null,
      p_data: safe.data || null,
      p_itens: itens,
      p_observacao: observacao || null,
    });
  }

  // -------------------------------------------------------------------
  // 2. Saldo autoritativo da expedicao Manta (db/86). O `previsto` volta
  //    apenas como informacao; elegibilidade e saldo disponivel vem
  //    SOMENTE daqui — a formula do backend nunca e reproduzida em JS.
  // -------------------------------------------------------------------
  async function consultarSaldoExpedicaoManta(opTecelagemId) {
    var opId = idNumerico(opTecelagemId);
    if (opId == null) {
      return { ok: false, codigo: 'op_invalida', erro: 'OP de tecelagem nao informada.' };
    }
    return await callRpc('consultar_saldo_expedicao_manta', {
      p_op_tecelagem_id: opId,
    });
  }

  // -------------------------------------------------------------------
  // 3. Liberacao parcial/aditiva (db/86). A mesma chave reaproveitada
  //    numa retentativa da MESMA tentativa devolve o resultado gravado.
  // -------------------------------------------------------------------
  async function liberarExpedicaoMantaParcial(input) {
    var safe = input || {};
    var opId = idNumerico(safe.opTecelagemId);
    if (opId == null) {
      return { ok: false, codigo: 'op_invalida', erro: 'OP de tecelagem nao informada.' };
    }
    var itens = sanitizeItensMetros(safe.itens);
    if (!itens.length) {
      return { ok: false, codigo: 'payload_vazio', erro: 'Informe ao menos uma quantidade para liberar.' };
    }
    var observacao = safe.observacao != null ? String(safe.observacao).trim() : '';
    return await callRpc('liberar_expedicao_manta_parcial', {
      p_op_tecelagem_id: opId,
      p_itens: itens,
      p_observacao: observacao || null,
      p_idempotency_key: safe.idempotencyKey || null,
    });
  }

  // -------------------------------------------------------------------
  // 4. Estorno controlado (db/87). O motivo e OBRIGATORIO e trimado; o
  //    backend recusa estorno acima do liberado ou abaixo do entregue.
  // -------------------------------------------------------------------
  async function estornarExpedicaoMantaParcial(input) {
    var safe = input || {};
    var expedicaoId = idNumerico(safe.expedicaoId);
    if (expedicaoId == null) {
      return { ok: false, codigo: 'expedicao_invalida', erro: 'Expedicao nao informada.' };
    }
    var motivo = safe.motivo != null ? String(safe.motivo).trim() : '';
    if (!motivo) {
      return { ok: false, codigo: 'motivo_obrigatorio', erro: 'Informe o motivo do estorno.' };
    }
    var itens = sanitizeItensMetros(safe.itens);
    if (!itens.length) {
      return { ok: false, codigo: 'payload_vazio', erro: 'Informe ao menos uma quantidade para estornar.' };
    }
    return await callRpc('estornar_expedicao_manta_parcial', {
      p_expedicao_id: expedicaoId,
      p_itens: itens,
      p_motivo: motivo,
      p_idempotency_key: safe.idempotencyKey || null,
    });
  }

  window.RAVATEX_MANTA_WRITES = {
    novaIdempotencyKey: novaIdempotencyKey,
    registrarSaidaMantaCima: registrarSaidaMantaCima,
    consultarSaldoExpedicaoManta: consultarSaldoExpedicaoManta,
    liberarExpedicaoMantaParcial: liberarExpedicaoMantaParcial,
    estornarExpedicaoMantaParcial: estornarExpedicaoMantaParcial,
  };
})(window);
