// =====================================================================
// === js/pedido-ui.js ===================================================
// Helper de UI de Pedidos: status, cores, preview de cor.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1
// Escopo: helper puro + utilitários visuais para o domínio Pedidos.
//   Não depende de OP. Não depende de DOM pesado salvo nas funções
//   específicas de criação de elementos.
//
// Carregar via <script src="js/pedido-ui.js?v=...></script> DEPOIS
// de js/ui.js e ANTES de js/screens/pedidos-list.js, pois esta tela
// usa os helpers aqui expostos.
//
// Compatibilidade: expõe window.RAVATEX_PEDIDO_UI com constantes
// e funções puras. Funções que criam elementos DOM verificam
// `window.el` antes (não dependem se não chamadas).
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // CANONICAL BUSINESS-COLOUR OWNER (D9)
  //
  // These are BUSINESS values — the real colour of a product — not design
  // tokens. They are the one place in the runtime where a literal colour
  // is legitimate. Screens consume `corPreviewHex` and MUST NOT declare
  // their own palette or substring fallbacks.
  //
  // Precedence, in order:
  //   1. an explicit valid colour value carried by the business record;
  //   2. an exact normalized business-colour name;
  //   3. the canonical substring fallback;
  //   4. the canonical default fallback.
  // -------------------------------------------------------------------
  const COR_PREVIEW_MAP = Object.freeze({
    'AMARELO':    '#facc15',
    'AREIA':      '#d6c3a1',
    'AZUL':       '#2563eb',
    'AZUL_CLARO': '#60a5fa',
    'BEGE':       '#d6b98c',
    'BRANCO':     '#f8fafc',
    'CINZA':      '#8a93a3',
    'CRU':        '#e8dcc8',
    'GRAFITE':    '#4b5563',
    'KRAFT':      '#b5722e',
    'LARANJA':    '#f97316',
    'MARINHO':    '#1e3a5f',
    'PRETO':      '#1a1a1a',
    'ROSA':       '#ec4899',
    'ROXO':       '#7c3aed',
    'VERDE':      '#16a34a',
    'VERMELHO':   '#dc2626',
  });

  // Order is significant and is preserved from the promoted implementation:
  // 'AZUL' is tested before 'AZUL_CLARO' would ever be reached by substring,
  // so 'AZUL CLARO' (space, not underscore) resolves to the base blue.
  const COR_PREVIEW_SUBSTRING = Object.freeze([
    ['AZUL', '#2563eb'],
    ['CINZA', '#8a93a3'],
    ['CRU', '#e8dcc8'],
    ['KRAFT', '#b5722e'],
    ['MARINHO', '#1e3a5f'],
    ['PRETO', '#1a1a1a'],
    ['BRANCO', '#f8fafc'],
    ['VERDE', '#16a34a'],
    ['VERMELHO', '#dc2626'],
    ['ROSA', '#ec4899'],
    ['ROXO', '#7c3aed'],
    ['AMARELO', '#facc15'],
    ['LARANJA', '#f97316'],
  ]);

  const COR_PREVIEW_FALLBACK = '#cbd5e1';

  // Swatches whose luminance is high enough that the chip needs a visible
  // outline rather than relying on its own edge.
  const COR_PREVIEW_LIGHT = Object.freeze([
    '#f8fafc', '#e8dcc8', '#facc15', '#d6c3a1', '#d6b98c',
  ]);

  const COR_VALOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  function normalizarCorNome(nome) {
    if (typeof nome !== 'string') return '';
    return nome.trim().toUpperCase();
  }

  /** An explicit record value, normalized, or '' when it is not a colour. */
  function normalizarCorValor(valor) {
    if (typeof valor !== 'string') return '';
    const v = valor.trim().toLowerCase();
    return COR_VALOR_RE.test(v) ? v : '';
  }

  function corRegistroValor(entrada) {
    if (!entrada || typeof entrada !== 'object') return '';
    return normalizarCorValor(entrada.cor_hex || entrada.hex || entrada.valor || '');
  }

  /**
   * Business preview colour for a product colour.
   *
   * @param {string|object} nome colour name, or a record carrying one
   * @param {string} [valorExplicito] explicit record value, when the caller
   *        holds it separately from the name
   */
  function corPreviewHex(nome, valorExplicito) {
    const explicito = normalizarCorValor(valorExplicito) || corRegistroValor(nome);
    if (explicito) return explicito;

    const bruto = nome && typeof nome === 'object' ? nome.nome : nome;
    const key = normalizarCorNome(bruto);
    if (COR_PREVIEW_MAP[key]) return COR_PREVIEW_MAP[key];

    for (const [fragmento, hex] of COR_PREVIEW_SUBSTRING) {
      if (key.includes(fragmento)) return hex;
    }
    return COR_PREVIEW_FALLBACK;
  }

  /** Does this swatch need an explicit outline to stay visible? */
  function corPreviewIsLight(nomeOuHex) {
    const direto = normalizarCorValor(nomeOuHex);
    const hex = direto || corPreviewHex(nomeOuHex);
    return COR_PREVIEW_LIGHT.indexOf(String(hex).toLowerCase()) !== -1;
  }

  // Pass-3 §9: the swatch is a proven non-control, and its geometry now stays
  // owned by this one statically tagged construction. Callers that need a
  // different edge used to mutate `.style.height` on the returned node, which
  // left an anonymous height the detector could not attribute to any tag.
  // `size` is optional and defaults to the original 48px.
  function corPreviewElement(nome, size) {
    if (typeof window.el !== 'function') return null;
    var edge = size || '48px';
    return window.el('div', {
      style: 'width:' + edge + ';height:' + edge + ';background:' + corPreviewHex(nome)
        + ';border-radius:var(--rv-radius);border:1px solid var(--rv-border);flex-shrink:0;',
      title: String(nome || ''),
    });
  }

  // -------------------------------------------------------------------
  // Status de Pedido: label, badge, cor de fundo
  // -------------------------------------------------------------------
  const PEDIDO_STATUS = Object.freeze({
    RASCUNHO:    'rascunho',
    RECEBIDO:    'recebido',
    CONFIRMADO:  'confirmado',
    PRODUZINDO:  'produzindo',
    ENTREGUE:    'entregue',
    CANCELADO:   'cancelado',
  });

  const PEDIDO_STATUS_LABEL = Object.freeze({
    rascunho:   'Rascunho',
    recebido:   'Recebido',
    confirmado: 'Confirmado',
    produzindo: 'Em produção',
    entregue:   'Entregue',
    cancelado:  'Cancelado',
  });

  // Tailwind classes alinhadas com o padrão visual de badges do app.
  // (Mesmo padrão de js/badges.js para OP — px-2 py-1 rounded text-xs font-semibold)
  const PEDIDO_STATUS_BADGE = Object.freeze({
    rascunho:   'bg-gray-100 text-gray-700',
    recebido:   'bg-blue-100 text-blue-700',
    confirmado: 'bg-indigo-100 text-indigo-700',
    produzindo: 'bg-amber-100 text-amber-700',
    entregue:   'bg-green-100 text-green-700',
    cancelado:  'bg-red-100 text-red-700',
  });

  function pedidoStatusLabel(status) {
    if (!status) return '—';
    return PEDIDO_STATUS_LABEL[status] || status;
  }

  function pedidoStatusBadgeClass(status) {
    if (!status) return 'bg-gray-100 text-gray-700';
    return PEDIDO_STATUS_BADGE[status] || 'bg-gray-100 text-gray-700';
  }

  /**
   * Pedido lifecycle status. Delegates to the canonical lifecycle-status
   * constructor in js/badges.js, so family, 18px pill geometry, the 5px dot and
   * the neutral fallback are decided by the one owner. `produzindo` resolves to
   * caution through the accepted `em producao` key alias.
   *
   * `PEDIDO_STATUS_BADGE` and `pedidoStatusBadgeClass` are retained only for
   * existing compatibility consumers; neither decides rendering any more.
   */
  function pedidoStatusBadge(status) {
    if (typeof window.rvStatusPill !== 'function') return null;
    return window.rvStatusPill(pedidoStatusLabel(status), status);
  }

  function pedidoStatusTodos() {
    return Object.values(PEDIDO_STATUS);
  }

  // -------------------------------------------------------------------
  // Status editáveis (C3C1) — dados gerais do Pedido.
  // Apenas `rascunho` e `recebido` aceitam edição de
  //   cliente, data de prazo e observação.
  // Para os demais status a edição fica bloqueada.
  // -------------------------------------------------------------------
  const PEDIDO_STATUS_EDITAVEL = Object.freeze(['rascunho', 'recebido']);

  function isPedidoEditavel(status) {
    if (!status) return false;
    return PEDIDO_STATUS_EDITAVEL.indexOf(status) !== -1;
  }

  // -------------------------------------------------------------------
  // Formatação simples de data
  // -------------------------------------------------------------------
  function fmtDataCurta(iso) {
    if (!iso) return '—';
    try {
      // Para strings YYYY-MM-DD (apenas data, sem hora), interpretar como
      // data LOCAL (não UTC) para evitar off-by-one em timezones negativos.
      const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        return new Date(y, mo, d).toLocaleDateString('pt-BR');
      }
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------
  window.RAVATEX_PEDIDO_UI = {
    COR_PREVIEW_MAP,
    COR_PREVIEW_SUBSTRING,
    COR_PREVIEW_FALLBACK,
    COR_PREVIEW_LIGHT,
    normalizarCorValor,
    corPreviewIsLight,
    PEDIDO_STATUS,
    PEDIDO_STATUS_LABEL,
    PEDIDO_STATUS_BADGE,
    PEDIDO_STATUS_EDITAVEL,
    normalizarCorNome,
    corPreviewHex,
    corPreviewElement,
    pedidoStatusLabel,
    pedidoStatusBadgeClass,
    pedidoStatusBadge,
    pedidoStatusTodos,
    isPedidoEditavel,
    fmtDataCurta,
  };

  // Compatibilidade com padrão de screen: helpers acessíveis como
  // window.pedidoStatusLabel etc. para os call-sites existentes
  // que esperam globais bare (estilo do app).
  Object.assign(window, {
    corPreviewHex,
    corPreviewElement,
    corPreviewIsLight,
    normalizarCorNome,
    normalizarCorValor,
    pedidoStatusLabel,
    pedidoStatusBadgeClass,
    pedidoStatusBadge,
    pedidoStatusTodos,
    isPedidoEditavel,
    fmtDataCurta,
  });
})(window);
