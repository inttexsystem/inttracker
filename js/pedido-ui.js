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
  // Mapeamento cor → hex para preview visual
  // -------------------------------------------------------------------
  const COR_PREVIEW_MAP = Object.freeze({
    'PRETO': '#111111',
    'CRU':   '#e8dfc8',
    'KRAFT': '#b08a55',
    'CINZA': '#8a8a8a',
  });
  const COR_PREVIEW_FALLBACK = '#9ca3af';

  function normalizarCorNome(nome) {
    if (typeof nome !== 'string') return '';
    return nome.trim().toUpperCase();
  }

  function corPreviewHex(nome) {
    const key = normalizarCorNome(nome);
    return COR_PREVIEW_MAP[key] || COR_PREVIEW_FALLBACK;
  }

  function corPreviewElement(nome) {
    if (typeof window.el !== 'function') return null;
    return window.el('div', {
      style: `width:48px;height:48px;background:${corPreviewHex(nome)};border-radius:4px;border:1px solid #ddd;flex-shrink:0;`,
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

  function pedidoStatusBadge(status) {
    if (typeof window.el !== 'function') return null;
    const label = pedidoStatusLabel(status);
    const cls = pedidoStatusBadgeClass(status);
    return window.el('span', {
      class: 'px-2 py-1 rounded text-xs font-semibold ' + cls,
    }, label);
  }

  function pedidoStatusTodos() {
    return Object.values(PEDIDO_STATUS);
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
    COR_PREVIEW_FALLBACK,
    PEDIDO_STATUS,
    PEDIDO_STATUS_LABEL,
    PEDIDO_STATUS_BADGE,
    normalizarCorNome,
    corPreviewHex,
    corPreviewElement,
    pedidoStatusLabel,
    pedidoStatusBadgeClass,
    pedidoStatusBadge,
    pedidoStatusTodos,
    fmtDataCurta,
  };

  // Compatibilidade com padrão de screen: helpers acessíveis como
  // window.pedidoStatusLabel etc. para os call-sites existentes
  // que esperam globais bare (estilo do app).
  Object.assign(window, {
    corPreviewHex,
    corPreviewElement,
    normalizarCorNome,
    pedidoStatusLabel,
    pedidoStatusBadgeClass,
    pedidoStatusBadge,
    pedidoStatusTodos,
    fmtDataCurta,
  });
})(window);
