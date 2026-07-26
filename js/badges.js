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

// =====================================================================
// === CANONICAL BADGE OWNERSHIP (D9) ==================================
// Single runtime owner for lifecycle-status pills, production-stage
// badges and classification badges. Screens consume these helpers and
// MUST NOT declare their own family maps or colour literals.
//
// Family mapping is UI_VISUAL_CONTRACT.md §2.6 as amended by D9. Stage
// interpretation is §2.7. Every style below is composed from --rv-*
// tokens; there is no literal colour anywhere in this block.
// =====================================================================

/**
 * Normalize a lifecycle state for lookup: case, accents, underscores and
 * whitespace runs all collapse, so `em_producao`, `Em produção` and
 * `EM  PRODUCAO` reach the same key.
 */
const RV_COMBINING_MIN = 0x300;
const RV_COMBINING_MAX = 0x36f;

/**
 * Drop combining marks from an NFD-decomposed string. Written as an explicit
 * code-point range rather than a regular expression so no combining character
 * is ever stored literally in this source file.
 */
function rvStripDiacritics(decomposed) {
  let out = '';
  for (const ch of decomposed) {
    const code = ch.codePointAt(0);
    if (code >= RV_COMBINING_MIN && code <= RV_COMBINING_MAX) continue;
    out += ch;
  }
  return out;
}

function rvNormalizeStateKey(value) {
  if (value === null || value === undefined) return '';
  return rvStripDiacritics(String(value).normalize('NFD'))
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ruled lifecycle-state → pill family. Keys are already normalized. */
const RV_STATUS_FAMILY = {
  // positive
  'deferida': 'positive', 'ativo': 'positive', 'conectado': 'positive',
  'resolvido': 'positive', 'concluido': 'positive', 'concluida': 'positive',
  'aceito': 'positive', 'aceita': 'positive', 'recebido': 'positive',
  'entregue': 'positive', 'finalizada': 'positive', 'finalizado': 'positive',
  'pronto p retirada': 'positive', 'pronto retirada': 'positive',
  'pronto p envio': 'positive', 'pronto envio': 'positive',
  // caution
  'pendente': 'caution', 'em analise': 'caution', 'reconectar': 'caution',
  'em producao': 'caution', 'em transporte': 'caution', 'parcial': 'caution',
  // negative
  'indeferida': 'negative', 'encerrada': 'negative', 'cancelado': 'negative',
  'cancelada': 'negative', 'rejeitado': 'negative', 'rejeitada': 'negative',
  'atrasado': 'negative', 'atrasada': 'negative',
  // info
  'devolvida': 'info', 'emitida': 'info', 'aberta': 'info', 'atrelado': 'info',
  // neutral
  'inativo': 'neutral', 'desconectado': 'neutral', 'trancado': 'neutral',
  'rascunho': 'neutral', 'simulada': 'neutral', 'nao aplicavel': 'neutral',
  'nao recebido': 'neutral', 'unknown': 'neutral',
};

/**
 * Screen-local state keys whose rendered label IS a ruled state. Resolving
 * through the label is not an invented family — it is the same state under
 * the identifier this codebase happens to persist.
 */
const RV_STATUS_KEY_ALIAS = {
  'produzindo': 'em producao',
  'em produção': 'em producao',
  'pending': 'pendente',
  'assigned': 'atrelado',
  'accepted': 'aceito',
  'rejected': 'rejeitado',
  'green': 'concluido',
  'amber': 'pendente',
  'red': 'cancelado',
  'gray': 'rascunho',
  'ok': 'concluido',
  'done': 'concluido',
  'warn': 'pendente',
  'error': 'cancelado',
  'waiting': 'rascunho',
  'anexado': 'aceito',
};

/** Tone names used by dashboards, mapped to the same five families. */
const RV_TONE_FAMILY = {
  green: 'positive', ok: 'positive', success: 'positive', done: 'positive',
  amber: 'caution', warn: 'caution', warning: 'caution',
  red: 'negative', error: 'negative', danger: 'negative',
  blue: 'info', info: 'info',
  gray: 'neutral', grey: 'neutral', neutral: 'neutral', waiting: 'neutral',
};

const RV_STATUS_FAMILIES = ['positive', 'caution', 'negative', 'info', 'neutral'];

/**
 * Lifecycle state → pill family. An unrecognised state is `neutral`; it never
 * receives an invented semantic family.
 */
function rvStatusFamily(state) {
  const key = rvNormalizeStateKey(state);
  if (!key) return 'neutral';
  const aliased = RV_STATUS_KEY_ALIAS[key] || key;
  return RV_STATUS_FAMILY[aliased] || 'neutral';
}

/** Dashboard tone name → pill family. */
function rvToneFamily(tone) {
  return RV_TONE_FAMILY[rvNormalizeStateKey(tone)] || 'neutral';
}

/* ---- production stage (§2.7) ---- */

const RV_STAGE_OF = {
  'tecelagem': 'tecelagem', 'em tecelagem': 'tecelagem',
  'acabamento': 'acabamento', 'em acabamento': 'acabamento',
};

/** Production stage, or null when the value is a lifecycle status instead. */
function rvStageOf(value) {
  return RV_STAGE_OF[rvNormalizeStateKey(value)] || null;
}

/* ---- tokenized styles ---- */

/** §2.6 geometry, shared by the status pill and the classification badge. */
const RV_PILL_BASE =
  'display:inline-flex;align-items:center;gap:5px;height:18px;padding:0 6px;'
  + 'border-radius:var(--rv-radius-pill);font-size:var(--rv-fs-2xs);'
  + 'font-weight:600;white-space:nowrap;';

/* Every token name is written WHOLE. Building a name by concatenating a family
   suffix onto a partial prefix would hide the reference from static token
   validation, so the five families are enumerated instead. */
const RV_PILL_SKIN = {
  positive: 'background:var(--rv-pill-positive-bg);border:1px solid var(--rv-pill-positive-border);color:var(--rv-pill-positive-text);',
  caution: 'background:var(--rv-pill-caution-bg);border:1px solid var(--rv-pill-caution-border);color:var(--rv-pill-caution-text);',
  negative: 'background:var(--rv-pill-negative-bg);border:1px solid var(--rv-pill-negative-border);color:var(--rv-pill-negative-text);',
  info: 'background:var(--rv-pill-info-bg);border:1px solid var(--rv-pill-info-border);color:var(--rv-pill-info-text);',
  neutral: 'background:var(--rv-pill-neutral-bg);border:1px solid var(--rv-pill-neutral-border);color:var(--rv-pill-neutral-text);',
};

const RV_DOT_BASE = 'width:5px;height:5px;border-radius:var(--rv-radius-pill);flex-shrink:0;';

const RV_DOT_SKIN = {
  positive: 'background:var(--rv-pill-positive-dot);',
  caution: 'background:var(--rv-pill-caution-dot);',
  negative: 'background:var(--rv-pill-negative-dot);',
  info: 'background:var(--rv-pill-info-dot);',
  neutral: 'background:var(--rv-pill-neutral-dot);',
};

function rvStatusPillStyle(state) {
  return RV_PILL_BASE + RV_PILL_SKIN[rvStatusFamily(state)];
}

function rvStatusDotStyle(state) {
  return RV_DOT_BASE + RV_DOT_SKIN[rvStatusFamily(state)];
}

/** Classification badge: neutral family, no dot. Meaning is carried by copy. */
function rvClassificationBadgeStyle() {
  return RV_PILL_BASE + RV_PILL_SKIN.neutral;
}

/** §2.7 stage badge: soft pill, no dot, stage family only. */
const RV_STAGE_BASE =
  'display:inline-flex;align-items:center;padding:3px 9px;'
  + 'border-radius:var(--rv-radius-pill);font-size:var(--rv-fs-2xs);'
  + 'font-weight:600;white-space:nowrap;';

const RV_STAGE_SKIN = {
  tecelagem: 'background:var(--rv-stage-tecelagem-bg);color:var(--rv-stage-tecelagem);',
  acabamento: 'background:var(--rv-stage-acabamento-bg);color:var(--rv-stage-acabamento);',
};

function rvStageBadgeStyle(stage) {
  return RV_STAGE_BASE + RV_STAGE_SKIN[rvStageOf(stage) || 'tecelagem'];
}

/* ---- element constructors ---- */

function rvStatusPill(label, state) {
  if (typeof el !== 'function') return null;
  const key = state === undefined ? label : state;
  return el('span', { style: rvStatusPillStyle(key) },
    el('span', { style: rvStatusDotStyle(key), 'aria-hidden': 'true' }),
    String(label === null || label === undefined ? '' : label));
}

function rvClassificationBadge(label) {
  if (typeof el !== 'function') return null;
  return el('span', { style: rvClassificationBadgeStyle() },
    String(label === null || label === undefined ? '' : label));
}

function rvStageBadge(label, stage) {
  if (typeof el !== 'function') return null;
  return el('span', { style: rvStageBadgeStyle(stage === undefined ? label : stage) },
    String(label === null || label === undefined ? '' : label));
}

window.RV_BADGES = {
  RV_STATUS_FAMILY,
  RV_STATUS_KEY_ALIAS,
  RV_TONE_FAMILY,
  RV_STATUS_FAMILIES,
  RV_STAGE_OF,
  rvNormalizeStateKey,
  rvStatusFamily,
  rvToneFamily,
  rvStageOf,
  rvStatusPillStyle,
  rvStatusDotStyle,
  rvClassificationBadgeStyle,
  rvStageBadgeStyle,
  rvStatusPill,
  rvClassificationBadge,
  rvStageBadge,
};

Object.assign(window, {
  rvNormalizeStateKey,
  rvStatusFamily,
  rvToneFamily,
  rvStageOf,
  rvStatusPillStyle,
  rvStatusDotStyle,
  rvClassificationBadgeStyle,
  rvStageBadgeStyle,
  rvStatusPill,
  rvClassificationBadge,
  rvStageBadge,
});
