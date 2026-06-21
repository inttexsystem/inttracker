// =====================================================================
// === STATUS BADGES (Seam A UI) ========================================
// Helpers visuais de badge de status/tipo para OPs. Apenas DOM; sem
// Supabase, sem regra de negócio. Carregar DEPOIS de js/ui.js e ANTES
// do <script> principal em index.html, pois depende de `el(...)` e é
// referenciado por handlers inline (nomes globais preservados).
// =====================================================================

const OP_STATUS_BADGE = {
  simulada:    'bg-gray-100 text-gray-700',
  aberta:      'bg-blue-100 text-blue-700',
  em_producao: 'bg-amber-100 text-amber-700',
  finalizada:  'bg-green-100 text-green-700',
};

const OP_STATUS_LABEL = {
  simulada: 'Simulada', aberta: 'Aberta', em_producao: 'Em produção', finalizada: 'Finalizada',
};

const OP_TIPO_LABEL = { tecelagem: 'Tecelagem', latex: 'Látex' };
const OP_TIPO_BADGE = { tecelagem: 'bg-indigo-100 text-indigo-700', latex: 'bg-amber-100 text-amber-700' };

function badgeTipo(tipo) {
  return el('span', { class: 'px-2 py-1 rounded text-xs font-semibold ' + (OP_TIPO_BADGE[tipo] || 'bg-gray-100 text-gray-700') },
    OP_TIPO_LABEL[tipo] || tipo);
}

function badgeStatus(status) {
  return el('span', { class: 'px-2 py-1 rounded text-xs font-semibold ' + (OP_STATUS_BADGE[status] || 'bg-gray-100 text-gray-700') },
    OP_STATUS_LABEL[status] || status);
}
