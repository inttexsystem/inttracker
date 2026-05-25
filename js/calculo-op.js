// =====================================================================
// === CÁLCULO OP ======================================================
// Funções puras (sem DOM, sem Supabase) — testáveis com `node --test`.
// =====================================================================

// Normaliza largura para chave consistente ("1.4" e "1.40" -> "1.40").
function larguraKey(largura) {
  return Number(largura).toFixed(2);
}

// Calcula kg de fio por cor para os itens da OP.
// itens: [{ modeloId, metros }]
// modelosById: { [id]: { id, nome, largura, cor_1:{id,nome}, cor_2:{id,nome} } }
// parametrosByLargura: { [larguraKey]: { algodao_por_ml, poliester_por_ml, valor_x } }
// Retorna: { algodaoPorCor: { [corId]: {corId, corNome, kg} }, poliester: { PRETO, BRANCO } }
function calcularFiosOP(itens, modelosById, parametrosByLargura) {
  const algodaoPorCor = {};
  const poliester = { PRETO: 0, BRANCO: 0 };

  for (const item of itens) {
    const metros = Number(item.metros);
    if (!Number.isFinite(metros) || metros <= 0) continue;

    const modelo = modelosById[item.modeloId];
    if (!modelo) continue;

    const p = parametrosByLargura[larguraKey(modelo.largura)];
    if (!p) throw new Error('Sem parâmetros para largura ' + modelo.largura);

    const kgAlg = p.algodao_por_ml * p.valor_x * metros;
    for (const cor of [modelo.cor_1, modelo.cor_2]) {
      if (!algodaoPorCor[cor.id]) algodaoPorCor[cor.id] = { corId: cor.id, corNome: cor.nome, kg: 0 };
      algodaoPorCor[cor.id].kg += kgAlg;
    }

    const kgPol = p.poliester_por_ml * p.valor_x * metros;
    poliester.PRETO += kgPol;
    poliester.BRANCO += kgPol;
  }

  return { algodaoPorCor, poliester };
}

// Transforma o resultado de calcularFiosOP em payloads de ordens_compra_fio.
// kg_pedido > 0 (schema CHECK) e arredondado a 3 casas (NUMERIC(10,3)).
// op_id e fornecedor_id são preenchidos na hora de salvar (não aqui).
function montarOrdensCompraFio(calculo) {
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const ordens = [];

  for (const { corId, kg } of Object.values(calculo.algodaoPorCor)) {
    const kgPedido = round3(kg);
    if (kgPedido > 0) ordens.push({ tipo: 'algodao', cor_id: corId, cor_poliester: null, kg_pedido: kgPedido });
  }
  for (const cor of ['PRETO', 'BRANCO']) {
    const kgPedido = round3(calculo.poliester[cor]);
    if (kgPedido > 0) ordens.push({ tipo: 'poliester', cor_id: null, cor_poliester: cor, kg_pedido: kgPedido });
  }
  return ordens;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { larguraKey, calcularFiosOP, montarOrdensCompraFio };
}
