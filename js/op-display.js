// =====================================================================
// === OP CANONICAL IDENTITY (helper central) ===========================
// Identidade canonica, UNICA e produto-facing da OP vinculada a Pedido:
//
//   OP-{T|A}{pedido:3}-{sequencia}-{ano:2}
//
// Exemplos: OP-T005-1-26, OP-T005-2-26, OP-A005-1-26
// Ordem de compra casada: OC-{pedido:3}-{sequencia}-{ano:2}
// Exemplos: OC-005-1-26, OC-005-2-26
//
// POLITICA DE IDENTIDADE (OP-CANONICAL-IDENTITY-REFOUNDATION-R1)
//   A identidade canonica e LIDA do banco, em `ops.identidade_operacional` e
//   `ordem_compra.identidade_operacional` (db/95). Ela e atribuida uma vez,
//   persistida, unica por constraint e imutavel. Este modulo NAO a calcula,
//   NAO a deriva de contexto de Pedido e NAO a reconstroi por posicao em
//   lista de irmas.
//
//   A sequencia da OP conta por (Pedido, tipo) — um Pedido pode ser dividido
//   entre fornecedores de tecelagem diferentes. A da Ordem de Compra conta
//   por PEDIDO: o codigo OC nao carrega letra de tipo, entao contar por OP
//   produziria codigos duplicados. De qual OP a compra veio e exibido como
//   informacao de origem, nunca embutido no nome.
//
//   As decisoes D-OC05 (fallback silencioso obrigatorio para o legado),
//   D-OC07 (adocao restrita ao Pedido Detail Admin) e D-OC08 (adocao
//   parcial aceita) foram SUPERADAS por correcao forward nesta ordem. O
//   motivo esta registrado em docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md.
//
//   Por que o calculo posicional foi removido e nao apenas corrigido: a
//   sequencia era o indice da OP na lista de irmas VIVAS, ordenada por
//   criado_em. Removida uma irma anterior, a seguinte HERDAVA o codigo da
//   removida. O rotulo era, portanto, reciclavel — exatamente o que a
//   politica de numeracao de db/26 proibia para o numero interno. Nenhuma
//   correcao de renderizacao consegue tornar estavel um valor derivado de
//   posicao; so a persistencia consegue.
//
// TRES ESTADOS, NENHUM SILENCIOSO
//   1. OP vinculada a Pedido COM identidade persistida  -> a identidade.
//   2. OP AVULSA (sem Pedido)                           -> `OP {numero}/{ano}`,
//      que e legitimamente a sua identidade visivel, porque nenhuma
//      identidade derivada de Pedido existe.
//   3. OP vinculada a Pedido SEM identidade persistida  -> ESTADO
//      DIAGNOSTICO explicito (`OP (identidade pendente)`). NUNCA o numero
//      interno, que e o nome de OUTRA coisa. Este estado significa
//      exatamente uma condicao operacional real: a migracao db/95 nao esta
//      aplicada no ambiente, ou a consulta da tela nao projetou
//      `identidade_operacional`. Ambos sao defeitos que devem ficar
//      VISIVEIS, nao mascarados por um segundo nome da mesma OP.
//
// NUMERO INTERNO
//   `ops.numero`/`ops.ano` continuam existindo como numero INTERNO de
//   rastreabilidade. `formatOpInternalLabel` e o UNICO formatador
//   autorizado a exibi-lo, e ele sempre emite o rotulo explicito
//   "No interno". Nenhuma superficie pode concatenar numero/ano por conta
//   propria (guard: tests/op-canonical-identity-schema.smoke.js).
//
// Puro: sem DOM, sem Supabase, sem regra de negocio. Carregar cedo
// (index.html: logo apos js/badges.js). Consumidores NAO devem implementar
// fallback proprio: a ausencia deste modulo e um defeito de carregamento,
// nao um caso de negocio.
// =====================================================================

(function (window) {
  'use strict';

  // Estado diagnostico do caso 3. Nunca e um nome alternativo da OP: e a
  // declaracao de que a identidade nao pode ser resolvida agora.
  var IDENTITY_PENDING = 'OP (identidade pendente)';
  var IDENTITY_ABSENT = 'OP -';

  // Mapa tipo real do banco -> letra operacional. `latex` e a etapa que o
  // fluxo do usuario chama de "Acabamento", por isso 'A'. `acabamento` fica
  // como sinonimo defensivo. Espelha public.op_tipo_letra (db/95); serve
  // apenas para leitura/diagnostico, nunca para montar a identidade.
  var TYPE_LETTER = { tecelagem: 'T', latex: 'A', acabamento: 'A' };

  function normalizeTipo(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function getOpTypeLetter(op) {
    if (!op) return null;
    return TYPE_LETTER[normalizeTipo(op.tipo)] || null;
  }

  // A identidade canonica persistida, exatamente como o banco a emitiu.
  // Nenhuma normalizacao alem de aparar espaco: o valor e canonico.
  function getCanonicalIdentity(op) {
    if (!op) return null;
    var raw = op.identidade_operacional;
    if (typeof raw !== 'string') return null;
    var trimmed = raw.trim();
    return trimmed === '' ? null : trimmed;
  }

  // Uma OP e considerada vinculada a Pedido quando QUALQUER evidencia direta
  // de vinculo esta presente na propria linha ou no contexto explicito da
  // tela. Deliberadamente amplo: em caso de duvida preferimos o estado
  // diagnostico visivel (caso 3) a exibir o numero interno como se fosse a
  // identidade (o defeito auditado).
  function isPedidoLinked(op, context) {
    if (!op) return false;
    if (op.identidade_pedido_id != null) return true;
    if (op.pedido_id != null) return true;
    if (op.lote && op.lote.pedido_id != null) return true;
    if (op.lotes && op.lotes.pedido_id != null) return true;
    if (context && context.pedido && context.pedido.id != null) return true;
    if (context && context.pedidoId != null) return true;
    return false;
  }

  // O UNICO formatador autorizado do numero interno. Sempre rotulado.
  function formatOpInternalLabel(op) {
    if (!op) return 'No interno -';
    var numero = op.numero != null ? op.numero : '-';
    if (op.ano != null) return 'Nº interno ' + numero + '/' + op.ano;
    return 'Nº interno ' + numero;
  }

  // Identidade visivel de uma OP AVULSA. Legitima porque nenhuma identidade
  // derivada de Pedido existe para ela.
  function formatOpLegacyCode(op) {
    if (!op) return IDENTITY_ABSENT;
    var numero = op.numero != null ? op.numero : '-';
    if (op.ano != null) return 'OP ' + numero + '/' + op.ano;
    return 'OP ' + numero;
  }

  // A identidade produto-facing da OP. `context` e OPCIONAL e serve apenas
  // para reconhecer o vinculo com Pedido quando a propria linha nao o
  // carrega; ele NAO participa mais da construcao do codigo.
  function formatOpOperationalCode(op, context) {
    if (!op) return IDENTITY_ABSENT;
    var canonical = getCanonicalIdentity(op);
    if (canonical) return canonical;
    // Fail closed: uma OP vinculada a Pedido sem identidade persistida NAO
    // volta a se chamar pelo numero interno.
    if (isPedidoLinked(op, context)) return IDENTITY_PENDING;
    return formatOpLegacyCode(op);
  }

  // Verdadeiro quando a identidade nao pode ser resolvida e a superficie
  // esta exibindo o estado diagnostico. Permite a uma tela sinalizar a
  // condicao sem reimplementar a politica.
  function isIdentityPending(op, context) {
    return formatOpOperationalCode(op, context) === IDENTITY_PENDING;
  }

  // ===================================================================
  // Ordem de Compra — identidade casada com o Pedido.
  // `public.ordem_compra` (db/67) nunca teve numero de negocio: era
  // identificada apenas pelo BIGSERIAL, e as telas de distribuicao e de
  // recebimento exibiam essa chave crua (`OC #48`, `OP 137`) como se fosse
  // nome. db/95 deu a ela o codigo que deveria ter sempre tido.
  // ===================================================================

  // OC legada sem Pedido: NAO existe identidade derivada. Rotulamos como
  // legada de forma explicita em vez de expor a chave primaria como nome.
  function formatOcLegacyLabel(oc) {
    if (!oc || oc.id == null) return 'OC -';
    return 'OC legada #' + oc.id;
  }

  function formatOcOperationalCode(oc) {
    if (!oc) return 'OC -';
    var canonical = getCanonicalIdentity(oc);
    if (canonical) return canonical;
    // Vinculada a Pedido mas sem identidade persistida: fail closed.
    if (oc.pedido_id != null || oc.identidade_pedido_id != null) return 'OC (identidade pendente)';
    return formatOcLegacyLabel(oc);
  }

  // ===================================================================
  // Product variation identity (PHASE-MANTA-A).
  // Pure display of the canonical modelos.tipo_produto ('tapete'|'manta').
  // Single source of the product-line label contract used across Pedido
  // and OP surfaces:
  //   "Manta · Arabesco · 1,40 m · KRAFT/CRU"
  //   "Tapete · Barcelona · 2,10 m · KRAFT/CRU"
  // Never infers the type from the model name.
  // ===================================================================

  // Any value other than the canonical 'manta' resolves to 'Tapete', the
  // backfill default carried by every existing row (modelos.tipo_produto
  // DEFAULT 'tapete'). Keeps the label honest without name inference.
  function productTypeLabel(tipoProduto) {
    return normalizeTipo(tipoProduto) === 'manta' ? 'Manta' : 'Tapete';
  }

  function formatWidthPtBr(largura) {
    var n = Number(largura);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(2).replace('.', ',');
  }

  function resolveCorNome(cor) {
    if (cor == null) return null;
    if (typeof cor === 'string') return cor;
    if (typeof cor === 'object' && cor.nome) return cor.nome;
    return null;
  }

  // model = { tipo_produto, nome, largura, cor_1|cor1, cor_2|cor2 } where a
  // cor may be a string or a { nome } object. Emits the canonical
  // "Tipo · Nome · L,LL m · COR1/COR2" contract, dropping any part
  // that is genuinely absent (never fabricating a value).
  function formatProductLabel(model) {
    if (!model) return '';
    var parts = [productTypeLabel(model.tipo_produto)];
    if (model.nome != null && String(model.nome).trim() !== '') parts.push(String(model.nome).trim());
    var w = formatWidthPtBr(model.largura);
    if (w != null) parts.push(w + ' m');
    var c1 = resolveCorNome(model.cor_1 != null ? model.cor_1 : model.cor1);
    var c2 = resolveCorNome(model.cor_2 != null ? model.cor_2 : model.cor2);
    if (c1 || c2) parts.push([c1 || '—', c2 || '—'].join('/'));
    return parts.join(' · ');
  }

  // Resolves a single tipo_produto for a whole OP from its items (each
  // carrying its modelo's tipo_produto, directly or via `modelo`/`modelos`).
  // Returns 'tapete' | 'manta' | 'misto' | null. A route-homogeneous OP
  // (DB-enforced) returns a single type; 'misto' is a defensive signal.
  function deriveProductType(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    var seen = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var raw = it.tipo_produto
        || (it.modelo && it.modelo.tipo_produto)
        || (it.modelos && it.modelos.tipo_produto);
      var tp = normalizeTipo(raw) === 'manta' ? 'manta' : 'tapete';
      seen[tp] = true;
    }
    var keys = Object.keys(seen);
    if (keys.length > 1) return 'misto';
    return keys[0];
  }

  // OP-level label: 'Tapete' | 'Manta' | 'Misto' | null (empty/unknown).
  function opProductTypeLabel(items) {
    var tp = deriveProductType(items);
    if (tp == null) return null;
    if (tp === 'misto') return 'Misto';
    return productTypeLabel(tp);
  }

  var api = {
    IDENTITY_PENDING: IDENTITY_PENDING,
    getOpTypeLetter: getOpTypeLetter,
    getCanonicalIdentity: getCanonicalIdentity,
    isPedidoLinked: isPedidoLinked,
    isIdentityPending: isIdentityPending,
    formatOpOperationalCode: formatOpOperationalCode,
    formatOpInternalLabel: formatOpInternalLabel,
    formatOpLegacyCode: formatOpLegacyCode,
    formatOcOperationalCode: formatOcOperationalCode,
    formatOcLegacyLabel: formatOcLegacyLabel,
    productTypeLabel: productTypeLabel,
    formatProductLabel: formatProductLabel,
    deriveProductType: deriveProductType,
    opProductTypeLabel: opProductTypeLabel,
  };

  window.RAVATEX_OP_DISPLAY = api;
})(window);
