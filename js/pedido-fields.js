// =====================================================================
// === PEDIDO FIELDS — SHARED OWNER ====================================
// Dono UNICO do estado de campos GERAIS do Pedido (cabecalho), da sua
// normalizacao, da comparacao suja campo-a-campo e da construcao do
// payload `p_header` permitido por papel.
//
// Fase: PEDIDO-UNIFIED-ADMIN-EDITOR-R1.
//
// PURO POR CONTRATO — nao chama `window.supa`, nao renderiza tela, nao
// decide lifecycle/status. O conjunto de campos e a normalizacao ESPELHAM
// (nao substituem) public.pedido_header_validar / pedido_header_aplicar
// (db/92): o servidor e sempre a autoridade final.
//
// CAPACIDADE POR PAPEL — nesta fase apenas a projecao ADMINISTRATIVA e
// implementada (EXECUTION ORDER sec.8.2). `numero` e `status` nunca
// entram no payload: sao contexto somente-leitura em qualquer papel.
//
// Carregar via <script src="js/pedido-fields.js?v=..."></script> no
// <head>, DEPOIS de js/pedido-draft.js e ANTES de qualquer consumidor em
// js/screens/.
// =====================================================================

(function (window) {
  'use strict';

  // Mesma lista de public.pedido_header_validar(p_papel='admin').
  var ADMIN_HEADER_KEYS = ['cliente_id', 'data_pedido', 'prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao'];

  // Mesma lista de public.pedido_header_validar(p_papel<>'admin') —
  // exatamente os 4 campos que salvar_pedido_cliente/solicitar_alteracao_pedido
  // aceitam do Cliente. `data_pedido` NUNCA entra aqui (U13.1/C2): e visivel e
  // somente-leitura em toda tela do Cliente, e o servidor recusa qualquer
  // tentativa de altera-la depois que o Pedido existe.
  var CLIENT_HEADER_KEYS = ['prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao'];

  // Dominio real de pedidos.tipo_recebimento (CHECK pedidos_tipo_recebimento_check).
  var TIPO_RECEBIMENTO_OPTIONS = [
    { value: 'retirada', label: 'Retirada' },
    { value: 'entrega', label: 'Entrega' },
  ];

  // `mode` e exclusivo do papel Cliente (PEDIDO-CLIENT-EDITOR-REQUEST-
  // SUBMISSION-R1): 'preAceite' | 'posAceite' | 'terminal'. Omitido (chamada
  // antiga `capabilities('cliente')`), preserva a projecao adiada anterior —
  // compatibilidade retroativa, nunca reinterpretada.
  //
  // U4 nao distingue os 4 campos entre si dentro de preAceite/posAceite: os
  // MESMOS 4 campos sao DIRECT_EDIT antes da aceitacao e CHANGE_REQUEST
  // depois — a diferenca e o MODO DE ESCRITA (qual RPC a tela chama), nao uma
  // capacidade por campo. Por isso um unico conjunto serve os dois modos; a
  // tela e quem decide salvar_pedido_cliente vs solicitar_alteracao_pedido.
  function capabilities(role, mode) {
    if (role === 'admin') {
      return {
        readOnlyFields: ['numero', 'status'],
        editableHeaderFields: ADMIN_HEADER_KEYS.slice(),
      };
    }
    if (mode == null) {
      return { readOnlyFields: ['numero', 'status'], editableHeaderFields: [] };
    }
    if (mode === 'terminal') {
      return {
        readOnlyFields: ['numero', 'status', 'data_pedido', 'prazo_entrega', 'referencia_cliente', 'tipo_recebimento', 'observacao'],
        editableHeaderFields: [],
      };
    }
    return {
      readOnlyFields: ['numero', 'status', 'data_pedido'],
      editableHeaderFields: CLIENT_HEADER_KEYS.slice(),
    };
  }

  // Estado local a partir da linha persistida de `pedidos`. `numero` e
  // `status` nao entram no estado editavel: a tela os le direto do pedido
  // carregado para exibicao somente-leitura.
  function fromPersisted(pedido) {
    var p = pedido || {};
    return {
      clienteId: p.cliente_id != null ? String(p.cliente_id) : '',
      dataPedido: p.data_pedido || '',
      prazoEntrega: p.prazo_entrega || '',
      referenciaCliente: p.referencia_cliente || '',
      tipoRecebimento: p.tipo_recebimento || '',
      observacao: p.observacao || '',
    };
  }

  function normalizedValue(key, raw) {
    if (key === 'cliente_id') return raw ? Number(raw) : null;
    if (key === 'data_pedido') return raw || null;
    if (key === 'prazo_entrega') return raw || null;
    if (key === 'referencia_cliente') { var t1 = (raw || '').trim(); return t1 === '' ? null : t1; }
    if (key === 'tipo_recebimento') return raw || null;
    if (key === 'observacao') { var t2 = (raw || '').trim(); return t2 === '' ? null : t2; }
    return raw;
  }

  var FIELD_TO_KEY = {
    clienteId: 'cliente_id',
    dataPedido: 'data_pedido',
    prazoEntrega: 'prazo_entrega',
    referenciaCliente: 'referencia_cliente',
    tipoRecebimento: 'tipo_recebimento',
    observacao: 'observacao',
  };

  function isDirty(current, baseline) {
    var cur = current || {};
    var base = baseline || {};
    return Object.keys(FIELD_TO_KEY).some(function (field) {
      var key = FIELD_TO_KEY[field];
      return normalizedValue(key, cur[field]) !== normalizedValue(key, base[field]);
    });
  }

  // p_header: apenas as chaves que MUDARAM, com o valor normalizado.
  // `null` quando nada mudou (EXECUTION ORDER sec.10.1).
  function buildHeaderPayload(current, baseline) {
    var cur = current || {};
    var base = baseline || {};
    var payload = {};
    var changed = false;
    Object.keys(FIELD_TO_KEY).forEach(function (field) {
      var key = FIELD_TO_KEY[field];
      var vCur = normalizedValue(key, cur[field]);
      var vBase = normalizedValue(key, base[field]);
      if (vCur !== vBase) {
        payload[key] = vCur;
        changed = true;
      }
    });
    return changed ? payload : null;
  }

  // `role` e opcional (compatibilidade retroativa: chamada antiga
  // `validate(fields)` preserva a validacao administrativa de sempre). O
  // Cliente nunca escolhe cliente_id (o proprio Pedido ja e seu) nem edita
  // data_pedido (U13.1/C2, somente-leitura) — nao ha campo de cabecalho
  // obrigatorio a validar do lado do Cliente nesta fase.
  function validate(fields, role) {
    if (role === 'cliente') return { valid: true, errors: [] };
    var f = fields || {};
    var errors = [];
    if (!f.clienteId) errors.push('Selecione um cliente.');
    if (!f.dataPedido) errors.push('Informe a data do pedido.');
    return { valid: errors.length === 0, errors: errors };
  }

  window.RAVATEX_PEDIDO_FIELDS = {
    ADMIN_HEADER_KEYS: ADMIN_HEADER_KEYS,
    CLIENT_HEADER_KEYS: CLIENT_HEADER_KEYS,
    TIPO_RECEBIMENTO_OPTIONS: TIPO_RECEBIMENTO_OPTIONS,
    capabilities: capabilities,
    fromPersisted: fromPersisted,
    isDirty: isDirty,
    buildHeaderPayload: buildHeaderPayload,
    validate: validate,
  };
})(window);
