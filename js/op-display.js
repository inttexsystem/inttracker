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
// DOIS ESTADOS, NENHUM SILENCIOSO
//   1. identidade persistida presente -> a identidade. Fim.
//   2. identidade persistida ausente  -> ESTADO DIAGNOSTICO explicito
//      (`OP (identidade pendente)`).
//
//   Nao existe terceiro estado. `ops.numero`/`ops.ano` NUNCA sao exibidos:
//   permanecem no banco como numeracao interna de rastreabilidade, reservada
//   automaticamente e imutavel apos a criacao, e nenhum formatador deste
//   modulo os projeta.
//
//   Por que nao ha caminho "OP avulsa exibe numero/ano": o produto nao cria
//   OP sem Pedido — a tela de criacao recusa incondicionalmente e o banco
//   reforca a exigencia na rota de latex. Um formatador para esse caso seria
//   codigo inalcancavel, e e por precaucao inalcancavel que a identidade
//   dupla volta. Uma OP sem identidade persistida e sempre um defeito
//   operacional (migracao db/95 nao aplicada, ou consulta sem a coluna
//   projetada), e a resposta honesta e declarar isso em vez de chamar a OP
//   por outro nome.
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

  // A identidade produto-facing da OP. `context` e aceito e IGNORADO: existe
  // apenas para nao quebrar chamadores que ainda o passam, e nao participa da
  // resolucao. A identidade vem inteira da linha.
  function formatOpOperationalCode(op) {
    if (!op) return IDENTITY_ABSENT;
    return getCanonicalIdentity(op) || IDENTITY_PENDING;
  }

  // Verdadeiro quando a superficie esta exibindo o estado diagnostico, para
  // uma tela sinalizar a condicao sem reimplementar a politica.
  function isIdentityPending(op) {
    return formatOpOperationalCode(op) === IDENTITY_PENDING;
  }

  // Identidade de uma OP a partir de um mapa `op_id -> linha` ja resolvido.
  //
  // Existe porque as RPCs aceitas de compra e recebimento
  // (`obter_distribuicao_ordem_compra` db/69,
  // `obter_historico_recebimento_ordem_compra` db/70/db/74) atribuem a origem
  // de cada alocacao/lancamento APENAS por `op_id` — era isso que fazia as
  // telas imprimirem `OP 137`, a chave primaria como nome de negocio. O mapa e
  // carregado da view public.op_identidade_projecao (db/95) pelo dono de dados
  // daquele fluxo; aqui apenas se formata.
  //
  // `op_id` nulo e um estado de primeira classe: a necessidade e do Pedido,
  // compartilhada, e nao pertence a OP alguma. Nunca se fabrica uma OP para ele.
  //
  // `rotuloSemOp` e do CHAMADOR de proposito: esse texto e rotulo de PRODUTO e
  // difere por tela ('Pedido compartilhado' na distribuicao de compra,
  // 'Pedido (compartilhada)' no recebimento). Centralizar a formatacao da
  // IDENTIDADE nao autoriza unificar rotulos de produto de telas diferentes.
  function formatOpIdentityFromMap(opId, mapa, rotuloSemOp) {
    if (opId == null) return rotuloSemOp || 'Pedido (compartilhada)';
    var row = mapa ? mapa[String(opId)] : null;
    return row ? formatOpOperationalCode(row) : IDENTITY_PENDING;
  }

  // ===================================================================
  // Ordem de Compra — identidade casada com o Pedido.
  // `public.ordem_compra` (db/67) nunca teve numero de negocio: era
  // identificada apenas pelo BIGSERIAL, e as telas de distribuicao e de
  // recebimento exibiam essa chave crua (`OC #48`, `OP 137`) como se fosse
  // nome. db/95 deu a ela o codigo que deveria ter sempre tido.
  // ===================================================================

  // OC legada sem Pedido: NAO existe identidade derivada, e nenhuma pode ser
  // fabricada — inventar um vinculo de Pedido para uma ordem historica que
  // genuinamente nao tem Pedido seria mentir sobre a origem da compra.
  //
  // O rotulo e INTENCIONALMENTE NAO NUMERADO. A chave primaria (`ordem_compra.id`,
  // um BIGSERIAL interno) nao e identidade de negocio e nao volta pela porta do
  // fallback: era exatamente ela que as telas de distribuicao e recebimento
  // imprimiam como se fosse nome (`OC #48`). Um numero interno exibido e
  // indistinguivel, para o operador, de um numero de negocio — e foi essa
  // ambiguidade que a refundacao existiu para eliminar.
  //
  // O modelo de dados nao oferece alternativa numerada honesta: uma OC legada
  // e caracterizada por `legado = TRUE` e `legado_provenance` (db/67), que e
  // PROVENIENCIA, nao identidade — nao distingue duas OCs legadas entre si.
  // Declarar a condicao e a resposta honesta; numerar seria inventar.
  var OC_LEGACY_LABEL = 'OC legada (sem Pedido)';

  function formatOcLegacyLabel(oc) {
    if (!oc || oc.id == null) return 'OC -';
    return OC_LEGACY_LABEL;
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
    IDENTITY_ABSENT: IDENTITY_ABSENT,
    getOpTypeLetter: getOpTypeLetter,
    getCanonicalIdentity: getCanonicalIdentity,
    isIdentityPending: isIdentityPending,
    formatOpOperationalCode: formatOpOperationalCode,
    formatOpIdentityFromMap: formatOpIdentityFromMap,
    formatOcOperationalCode: formatOcOperationalCode,
    formatOcLegacyLabel: formatOcLegacyLabel,
    productTypeLabel: productTypeLabel,
    formatProductLabel: formatProductLabel,
    deriveProductType: deriveProductType,
    opProductTypeLabel: opProductTypeLabel,
  };

  window.RAVATEX_OP_DISPLAY = api;
})(window);
