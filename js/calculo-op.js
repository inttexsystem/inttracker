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

// Transforma o resultado de calcularFiosOP em NECESSIDADES DE COMPRA nativas.
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A (§9.9.N linha 13): antes chamava-se
// montarOrdensCompraFio e emitia linhas do modelo PLANO (`ordens_compra_fio`:
// tipo/kg_pedido, uma Ordem de Compra por cor, por OP). Esse payload plano foi
// APOSENTADO — o modelo nativo separa NECESSIDADE (o que a receita exige) de
// ORDEM DE COMPRA (o documento que a cobre), e a necessidade é sincronizada
// pelo escritor do servidor, nunca montada como documento aqui.
//
// A MATEMÁTICA DA RECEITA É IDÊNTICA: mesmas somas de calcularFiosOP, mesmo
// arredondamento a 3 casas, mesmo descarte de linhas <= 0, mesma ordem
// (algodão por cor, depois PRETO e BRANCO). Só os NOMES DOS CAMPOS mudam, para
// os do eixo nativo lido por oc_disponibilidade_op:
//   tipo       -> material
//   kg_pedido  -> kg_necessario
// e nenhum campo de documento (status, op_id, fornecedor_id) é produzido.
function montarNecessidadesCompra(calculo) {
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const necessidades = [];

  for (const { corId, kg } of Object.values(calculo.algodaoPorCor)) {
    const kgNecessario = round3(kg);
    if (kgNecessario > 0) necessidades.push({ material: 'algodao', cor_id: corId, cor_poliester: null, kg_necessario: kgNecessario });
  }
  for (const cor of ['PRETO', 'BRANCO']) {
    const kgNecessario = round3(calculo.poliester[cor]);
    if (kgNecessario > 0) necessidades.push({ material: 'poliester', cor_id: null, cor_poliester: cor, kg_necessario: kgNecessario });
  }
  return necessidades;
}

// Recalcula a OP a partir do fio realmente recebido (fator-gargalo).
// A cor de fio com menor (kg_recebido / kg_pedido) define o quanto a OP escala.
// itens:  [{ op_item_id, metros_pedidos }]
// ordens: [{ id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido }]
// Retorna: { fator, itens:[{op_item_id, metros_pedidos, metros_ajustados}],
//            sobras:[{ordem_id, tipo, cor_id, cor_poliester, kg_sobra}] }  (só sobras > 0)
function recalcularOP(itens, ordens) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const round3 = (n) => Math.round(n * 1000) / 1000;

  let fator = Infinity;
  for (const o of ordens) {
    const pedido = Number(o.kg_pedido);
    if (!(pedido > 0)) continue; // ordem sem pedido não restringe o fator (schema garante > 0; guarda defensiva)
    const ratio = Number(o.kg_recebido) / pedido;
    if (ratio < fator) fator = ratio;
  }
  if (!Number.isFinite(fator)) fator = 1; // sem ordens válidas: nada a ajustar

  const itensOut = itens.map((i) => ({
    op_item_id: i.op_item_id,
    metros_pedidos: Number(i.metros_pedidos),
    metros_ajustados: round2(Number(i.metros_pedidos) * fator),
  }));

  const sobras = [];
  for (const o of ordens) {
    const kgSobra = round3(Number(o.kg_recebido) - fator * Number(o.kg_pedido));
    if (kgSobra > 0) {
      sobras.push({
        ordem_id: o.id,
        tipo: o.tipo,
        cor_id: o.cor_id ?? null,
        cor_poliester: o.cor_poliester ?? null,
        kg_sobra: kgSobra,
      });
    }
  }

  return { fator, itens: itensOut, sobras };
}

// Calcula o consumo de fio por ordem dado um conjunto livre de metros por item.
// Usado pela proposta manual (sliders): permite reaproveitar `calcularFiosOP`
// passando os metros escolhidos pelo admin e mapear o consumo para cada ordem.
// itens:  [{ op_item_id, modelo_id, metros }]
// ordens: [{ id, tipo, cor_id, cor_poliester, kg_recebido }]
// Retorna: [{ ordem_id, kg_recebido, kg_consumido, sobra }] — sobra pode ser negativa (excesso).
function consumoPorOrdem(itens, ordens, modelosById, parametrosByLargura) {
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const itensFmt = itens.map((i) => ({ modeloId: i.modelo_id, metros: i.metros }));
  const calc = calcularFiosOP(itensFmt, modelosById, parametrosByLargura);
  return ordens.map((o) => {
    const consumido = o.tipo === 'algodao'
      ? (calc.algodaoPorCor[o.cor_id]?.kg || 0)
      : (calc.poliester[o.cor_poliester] || 0);
    const kgRec = Number(o.kg_recebido);
    return {
      ordem_id: o.id,
      kg_recebido: kgRec,
      kg_consumido: round3(consumido),
      sobra: round3(kgRec - consumido),
    };
  });
}

// Soma metros entregues sem defeito por op_item_id.
// Usada na tecelagem (Fase 5a, "entregue") e no látex (Fase 5b, "recebido"):
// a forma de dados é a mesma (entrega_itens), então é agnóstica de etapa.
// Defeitos ficam gravados no banco mas não somam aqui.
// itens: [{ op_item_id, metros_entregues, defeito }]
// Retorna: { [op_item_id]: total_metros }  (arredondado a 2 casas)
function totalEntregueCimaPorItem(itens) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const acc = {};
  for (const i of itens) {
    if (i.defeito) continue;
    if (i.op_item_id == null) continue;
    const metros = Number(i.metros_entregues);
    if (!Number.isFinite(metros)) continue;
    acc[i.op_item_id] = (acc[i.op_item_id] || 0) + metros;
  }
  for (const k of Object.keys(acc)) acc[k] = round2(acc[k]);
  return acc;
}

// % entregue de uma OP (Fase 6). meta = soma de (ajustado ?? pedido) dos op_itens;
// feito = soma de metros_entregues sem defeito dos entrega_itens da OP. Cap 0..100.
function percentualEntregueOP(opItens, entregaItens) {
  const meta = (opItens || []).reduce((s, i) => {
    const m = (i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados));
    return s + (Number.isFinite(m) ? m : 0);
  }, 0);
  if (!(meta > 0)) return 0;
  const feito = (entregaItens || []).reduce((s, ei) => {
    if (ei.defeito) return s;
    const m = Number(ei.metros_entregues);
    return s + (Number.isFinite(m) ? m : 0);
  }, 0);
  return Math.min(100, Math.round((feito / meta) * 100));
}

// Agrupa ordens de compra de fio por tipo p/ o PDF (Fase 6). Soma kg por rótulo,
// ordena alfabeticamente. Algodão usa a cor; poliéster usa PRETO/BRANCO.
function agruparOrdensCompraFio(ordens) {
  const acc = { algodao: {}, poliester: {} };
  for (const o of (ordens || [])) {
    if (o.tipo === 'algodao') {
      const rot = (o.cores && o.cores.nome) ? o.cores.nome : '?';
      acc.algodao[rot] = (acc.algodao[rot] || 0) + (Number(o.kg_pedido) || 0);
    } else if (o.tipo === 'poliester') {
      const rot = o.cor_poliester || '?';
      acc.poliester[rot] = (acc.poliester[rot] || 0) + (Number(o.kg_pedido) || 0);
    }
  }
  const r2 = (n) => Math.round(n * 1000) / 1000;
  const toList = (m) => Object.keys(m).sort().map(rotulo => ({ rotulo, kg: r2(m[rotulo]) }));
  const algodao = toList(acc.algodao);
  const poliester = toList(acc.poliester);
  const soma = (l) => r2(l.reduce((s, x) => s + x.kg, 0));
  return { algodao, poliester, totalAlgodao: soma(algodao), totalPoliester: soma(poliester) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { larguraKey, calcularFiosOP, montarNecessidadesCompra, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem, percentualEntregueOP, agruparOrdensCompraFio };
}
