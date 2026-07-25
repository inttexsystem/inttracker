// =====================================================================
// === PRODUCT ROUTE (helper central, puro) ============================
// PHASE-MANTA-B2B. Rota do produto e forma das etapas por rota.
//
//   TAPETE: Insumos -> Tecelagem -> Acabamento -> Expedicao -> Entrega
//   MANTA:  Insumos -> Tecelagem ->               Expedicao -> Entrega
//
// Regra binding (MANTA_DIRECT_ROUTE_ACTIVATION_CONTRACT.md sec.1/sec.6):
// a rota vem EXCLUSIVAMENTE de `modelos.tipo_produto`, alcancado por
// `op_itens.modelo_id` (superficies administrativas) ou por
// `pedido_itens.modelo_id` (superficie do cliente, que nao le op_itens).
// NUNCA do nome do modelo, de `ops.tipo`, da largura sozinha, do nome da
// tela ou da presenca de um fornecedor de acabamento. `ops.tipo`
// (tecelagem/latex) identifica a ETAPA produtiva, nunca a rota.
//
// A derivacao reusa `window.RAVATEX_OP_DISPLAY.deriveProductType`
// (js/op-display.js) — o helper aceito — em vez de duplica-la.
//
// Puro: sem DOM, sem `window.supa`, sem escrita, sem regra de negocio
// de quantidade. Carregar cedo (index.html: logo apos js/op-display.js).
// Consumidores DEVEM degradar para Tapete quando este helper faltar.
// =====================================================================

(function (window) {
  'use strict';

  var TAPETE = 'tapete';
  var MANTA = 'manta';

  // Forma das etapas por rota (admin). O Acabamento existe apenas na rota
  // Tapete; um stepper fixo de 5 estagios e proibido para Manta e misto.
  var ROUTE_STAGE_KEYS = Object.freeze({
    tapete: Object.freeze(['insumos', 'tecelagem', 'acabamento', 'expedicao', 'entrega']),
    manta: Object.freeze(['insumos', 'tecelagem', 'expedicao', 'entrega']),
  });

  // Etapas publicadas ao cliente. Mesma unica verdade: quais etapas
  // EXISTEM e fato de produto derivado; a POSICAO publicada continua
  // sendo `status_cliente_visual` / parciais.
  var ROUTE_CLIENT_STEP_KEYS = Object.freeze({
    tapete: Object.freeze(['recebido', 'confirmado', 'insumos', 'tecelagem', 'acabamento', 'expedicao', 'transporte', 'concluido']),
    manta: Object.freeze(['recebido', 'confirmado', 'insumos', 'tecelagem', 'expedicao', 'transporte', 'concluido']),
  });

  var ROUTE_LABEL = Object.freeze({ tapete: 'Tapete', manta: 'Manta' });

  function normalizeRoute(value) {
    return String(value == null ? '' : value).trim().toLowerCase() === MANTA ? MANTA : TAPETE;
  }

  function display() {
    return window.RAVATEX_OP_DISPLAY || null;
  }

  // items = [{ tipo_produto }] | [{ modelo: { tipo_produto } }] | ...
  // Delegado ao helper aceito; 'misto' e sinal defensivo (uma OP e
  // homogenea por garantia do banco) e resolve para Tapete no consumo.
  function deriveRouteFromItems(items) {
    var api = display();
    if (api && typeof api.deriveProductType === 'function') {
      var tp = api.deriveProductType(items);
      if (tp == null) return null;
      return tp === MANTA ? MANTA : TAPETE;
    }
    if (!Array.isArray(items) || items.length === 0) return null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var raw = it.tipo_produto
        || (it.modelo && it.modelo.tipo_produto)
        || (it.modelos && it.modelos.tipo_produto);
      if (normalizeRoute(raw) === TAPETE) return TAPETE;
    }
    return MANTA;
  }

  // op = { op_itens: [{ modelo_id }] }; modelosById = { id: { tipo_produto } }.
  // Retorna 'tapete' | 'manta' | null (sem itens / sem metadados).
  function routeForOp(op, modelosById) {
    if (!op) return null;
    var byId = modelosById || {};
    var items = (op.op_itens || []).map(function (opItem) {
      var modelo = opItem ? byId[opItem.modelo_id] : null;
      return { tipo_produto: modelo && modelo.tipo_produto };
    });
    return deriveRouteFromItems(items);
  }

  // Itens do Pedido (pedido_itens) — usado pela superficie do cliente,
  // que nao le op_itens. Mesmo dono do fato: modelos.tipo_produto.
  function routeForPedidoItem(item, modelosById) {
    if (!item) return null;
    var modelo = (modelosById || {})[item.modelo_id];
    return deriveRouteFromItems([{ tipo_produto: modelo && modelo.tipo_produto }]);
  }

  function pushRoute(list, route) {
    if (route && list.indexOf(route) === -1) list.push(route);
  }

  // Conjunto ordenado e estavel de rotas aplicaveis: Tapete antes de Manta.
  function orderRoutes(list) {
    var out = [];
    if (list.indexOf(TAPETE) !== -1) out.push(TAPETE);
    if (list.indexOf(MANTA) !== -1) out.push(MANTA);
    return out;
  }

  // Rotas de um Pedido a partir das OPs vinculadas.
  function routesForOps(ops, modelosById) {
    var found = [];
    (Array.isArray(ops) ? ops : []).forEach(function (op) {
      pushRoute(found, routeForOp(op, modelosById));
    });
    return orderRoutes(found);
  }

  // Rotas de um Pedido a partir dos itens comerciais (pedido_itens).
  function routesForPedidoItens(itens, modelosById) {
    var found = [];
    (Array.isArray(itens) ? itens : []).forEach(function (item) {
      pushRoute(found, routeForPedidoItem(item, modelosById));
    });
    return orderRoutes(found);
  }

  // Rotas aplicaveis do Pedido. As OPs sao a fonte preferencial (a rota
  // realmente em producao); os itens comerciais cobrem o Pedido ainda sem
  // OP e a superficie do cliente. Nunca fabrica uma rota: sem metadados
  // confiaveis retorna [] e o consumidor mantem a forma Tapete legada.
  function routesForPedido(input) {
    var safe = input || {};
    var fromOps = routesForOps(safe.ops, safe.modelosById);
    if (fromOps.length > 0) return fromOps;
    return routesForPedidoItens(safe.itens, safe.modelosById);
  }

  function routeLabel(route) {
    return ROUTE_LABEL[normalizeRoute(route)];
  }

  function isManta(route) {
    return normalizeRoute(route) === MANTA;
  }

  function stageKeysForRoute(route) {
    return ROUTE_STAGE_KEYS[normalizeRoute(route)].slice();
  }

  function clientStepKeysForRoute(route) {
    return ROUTE_CLIENT_STEP_KEYS[normalizeRoute(route)].slice();
  }

  // Uma etapa pertence a rota? `acabamento` so existe no Tapete.
  function routeHasStage(route, stageKey) {
    return ROUTE_STAGE_KEYS[normalizeRoute(route)].indexOf(stageKey) !== -1;
  }

  function routeHasClientStep(route, stepKey) {
    return ROUTE_CLIENT_STEP_KEYS[normalizeRoute(route)].indexOf(stepKey) !== -1;
  }

  // Filtra uma lista fixa de etapas do cliente ([{key,...}]) para as
  // etapas aplicaveis ao conjunto de rotas. Um Pedido misto mantem a
  // uniao (o Acabamento continua existindo pela rota Tapete); cada rota
  // e renderizada em sua propria secao pelo consumidor.
  function filterClientSteps(steps, routes) {
    var list = Array.isArray(steps) ? steps : [];
    var applicable = Array.isArray(routes) && routes.length ? routes : [TAPETE];
    return list.filter(function (step) {
      if (!step || step.key == null) return false;
      for (var i = 0; i < applicable.length; i++) {
        if (routeHasClientStep(applicable[i], step.key)) return true;
      }
      return false;
    });
  }

  // ===================================================================
  // Origem da expedicao (db/81..db/84): EXATAMENTE uma de op_latex_id
  // (Tapete, via OP de Acabamento) OU op_tecelagem_id (Manta, via OP de
  // Tecelagem). "Ver OP" deve apontar para a origem realmente nao nula —
  // hard-codar op_latex_id produz `#/ops/null` numa expedicao Manta.
  // ===================================================================
  function resolveExpedicaoSource(expedicao) {
    var exp = expedicao || {};
    if (exp.op_tecelagem_id != null) {
      return {
        opId: exp.op_tecelagem_id,
        column: 'op_tecelagem_id',
        route: MANTA,
        label: 'Tecelagem (Manta)',
      };
    }
    if (exp.op_latex_id != null) {
      return {
        opId: exp.op_latex_id,
        column: 'op_latex_id',
        route: TAPETE,
        label: 'Acabamento (Tapete)',
      };
    }
    return { opId: null, column: null, route: null, label: null };
  }

  function expedicaoSourceOpId(expedicao) {
    return resolveExpedicaoSource(expedicao).opId;
  }

  function isMantaExpedicao(expedicao) {
    return resolveExpedicaoSource(expedicao).route === MANTA;
  }

  window.RAVATEX_PRODUCT_ROUTE = {
    TAPETE: TAPETE,
    MANTA: MANTA,
    ROUTE_STAGE_KEYS: ROUTE_STAGE_KEYS,
    ROUTE_CLIENT_STEP_KEYS: ROUTE_CLIENT_STEP_KEYS,
    normalizeRoute: normalizeRoute,
    deriveRouteFromItems: deriveRouteFromItems,
    routeForOp: routeForOp,
    routeForPedidoItem: routeForPedidoItem,
    routesForOps: routesForOps,
    routesForPedidoItens: routesForPedidoItens,
    routesForPedido: routesForPedido,
    routeLabel: routeLabel,
    isManta: isManta,
    stageKeysForRoute: stageKeysForRoute,
    clientStepKeysForRoute: clientStepKeysForRoute,
    routeHasStage: routeHasStage,
    routeHasClientStep: routeHasClientStep,
    filterClientSteps: filterClientSteps,
    resolveExpedicaoSource: resolveExpedicaoSource,
    expedicaoSourceOpId: expedicaoSourceOpId,
    isMantaExpedicao: isMantaExpedicao,
  };
})(window);
