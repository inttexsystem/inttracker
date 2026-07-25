// =====================================================================
// === SCREENS: CLIENTE ROUTE READ =====================================
// PHASE-MANTA-B2B. Leitor da(s) ROTA(S) de produto de um Pedido para as
// superficies do cliente.
//
// Por que existe um modulo proprio: `cliente-pedido-detail.js` tem uma
// fronteira arquitetural deliberada — consome SOMENTE o payload publico
// de `cliente_pedido_summary`, sem select direto e sem IDs de catalogo no
// front. Essa RPC (db/30) nao devolve `modelo_id` nem `tipo_produto`, e
// PHASE-MANTA-B2B nao autoriza migracao. O contrato de ativacao prevê
// exatamente este caso: "o leitor de rota e extraido quando compartilhado".
//
// Autoridade e permissao:
//   - a rota vem SO de `modelos.tipo_produto` (js/product-route.js);
//   - `pedido_itens` do proprio pedido ja e legivel pelo cliente
//     (policy `pedido_itens_cliente_select`, db/14);
//   - `modelos` ja e legivel (policy `modelos_read`, db/03);
//   - nenhuma permissao e ampliada, nenhuma tabela operacional interna e
//     tocada e nenhum controle administrativo e exposto.
//
// Falha ou ausencia de metadado devolve [] — a superficie mantem a forma
// Tapete legada em vez de inventar uma rota.
// =====================================================================

(function (window) {
  'use strict';

  async function carregarRotasDoPedido(pedidoId) {
    var api = window.RAVATEX_PRODUCT_ROUTE;
    if (!api || !window.supa || pedidoId == null) return [];
    try {
      var itensRes = await window.supa
        .from('pedido_itens')
        .select('id, modelo_id')
        .eq('pedido_id', pedidoId);
      if (itensRes.error || !Array.isArray(itensRes.data) || !itensRes.data.length) return [];

      var ids = [];
      itensRes.data.forEach(function (row) {
        if (row && row.modelo_id != null && ids.indexOf(row.modelo_id) === -1) ids.push(row.modelo_id);
      });
      if (!ids.length) return [];

      var modelosRes = await window.supa
        .from('modelos')
        .select('id, tipo_produto')
        .in('id', ids);
      if (modelosRes.error || !Array.isArray(modelosRes.data)) return [];

      var modelosById = {};
      modelosRes.data.forEach(function (row) {
        if (row && row.id != null) modelosById[row.id] = row;
      });
      return api.routesForPedidoItens(itensRes.data, modelosById);
    } catch (err) {
      console.error('cliente-route-read: rota do pedido indisponivel', err);
      return [];
    }
  }

  window.RAVATEX_CLIENTE_ROUTE = {
    carregarRotasDoPedido: carregarRotasDoPedido,
  };
})(window);
